/**
 * PDF engine — parse, manipulate and write PDF files with no dependencies.
 *
 * Handles both cross-reference forms: the classic `xref` table and the
 * compressed xref *stream* introduced in PDF 1.5, along with object streams.
 * Inflation uses the platform's own DecompressionStream, which is why this is
 * async throughout and why no compressor has to be shipped.
 *
 * Deliberately not attempted: encrypted documents, and editing existing body
 * text. PDF text is positioned glyphs in subset fonts with no concept of
 * reflow — "editing" it is a rendering-and-overlay trick, not editing.
 */

/* ============================================================
   Byte helpers
   ============================================================ */

/* The standard security handler (pdfcrypt.js). In the browser bundle it is
   declared just before this file; in Node it sits beside it. */
const CRYPT = (function () {
  try { if (typeof PDFCrypt !== 'undefined') return PDFCrypt; } catch (e) { /* not in this scope */ }
  try { if (typeof require === 'function') return require('./pdfcrypt.js').PDFCrypt; } catch (e) { /* absent */ }
  return null;
})();

/* The TrueType embedder (pdffont.js), the same way. */
const PFONT = (function () {
  try { if (typeof PDFFont !== 'undefined') return PDFFont; } catch (e) { /* not in this scope */ }
  try { if (typeof require === 'function') return require('./pdffont.js').PDFFont; } catch (e) { /* absent */ }
  return null;
})();

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);
const isWS = (c) => WS.has(c);
const isDelim = (c) => DELIM.has(c);
const isRegular = (c) => !isWS(c) && !isDelim(c);

function latin1(bytes, from, to) {
  let s = '';
  const end = to === undefined ? bytes.length : to;
  for (let i = from || 0; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function bytesOf(str) {
  const a = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xff;
  return a;
}

async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress PDF streams.');
  }
  // Most PDFs use zlib-wrapped deflate; a few emit raw. Try both.
  for (const fmt of ['deflate', 'deflate-raw']) {
    try {
      const ds = new DecompressionStream(fmt);
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { /* try the next format */ }
  }
  throw new Error('A compressed stream in this PDF could not be decoded.');
}

/** zlib-wrapped deflate, the platform's own (FlateDecode's format). */
async function deflate(bytes) {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('This browser cannot compress PDF streams.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ============================================================
   Progress and preview hooks

   The worker sets these around a run. Progress is reported per page as
   assemble writes it; a preview run (the page render before the real run)
   makes assemble write only the one page being looked at, so a 400-page
   watermark preview costs one page, not four hundred.
   ============================================================ */

let PROGRESS = null;
let PREVIEW = null;
function setProgress(fn) { PROGRESS = typeof fn === 'function' ? fn : null; }
function setPreview(p) { PREVIEW = p && typeof p.pageIndex === 'number' ? p : null; }
function progress(done, total, label) {
  if (PROGRESS) { try { PROGRESS(done, total, label); } catch (e) { /* a reporter must never break a run */ } }
}

/* PNG/TIFF predictors, used by xref streams and some image data */
function applyPredictor(data, predictor, colors, bpc, columns) {
  if (!predictor || predictor < 2) return data;
  if (predictor === 2) return data;                       // TIFF, rare
  const bpp = Math.ceil((colors * bpc) / 8);
  const rowLen = Math.ceil((colors * bpc * columns) / 8);
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  let prev = new Uint8Array(rowLen);

  for (let r = 0; r < rows; r++) {
    const ft = data[r * (rowLen + 1)];
    const src = data.subarray(r * (rowLen + 1) + 1, (r + 1) * (rowLen + 1));
    const cur = new Uint8Array(rowLen);
    for (let i = 0; i < rowLen; i++) {
      const raw = src[i];
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let v;
      switch (ft) {
        case 0: v = raw; break;
        case 1: v = raw + left; break;
        case 2: v = raw + up; break;
        case 3: v = raw + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
          v = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default: v = raw;
      }
      cur[i] = v & 0xff;
    }
    out.set(cur, r * rowLen);
    prev = cur;
  }
  return out;
}

/* ============================================================
   Object model
   ============================================================ */

class Name { constructor(n) { this.name = n; } toString() { return '/' + this.name; } }
class Ref  { constructor(n, g) { this.num = n; this.gen = g || 0; } toString() { return `${this.num} ${this.gen} R`; } }
class PDFStream {
  constructor(dict, raw) { this.dict = dict; this.raw = raw; this._decoded = null; }
}

const isName = (v, n) => v instanceof Name && (n === undefined || v.name === n);
const isRef = (v) => v instanceof Ref;
const isDict = (v) => v && typeof v === 'object' && !Array.isArray(v) &&
  !(v instanceof Name) && !(v instanceof Ref) && !(v instanceof PDFStream) && !(v instanceof Uint8Array);

/* ============================================================
   Lexer / parser
   ============================================================ */

class Lexer {
  constructor(bytes, pos) { this.b = bytes; this.p = pos || 0; }

  skipWS() {
    while (this.p < this.b.length) {
      const c = this.b[this.p];
      if (isWS(c)) { this.p++; continue; }
      if (c === 0x25) {                              // % comment
        while (this.p < this.b.length && this.b[this.p] !== 0x0a && this.b[this.p] !== 0x0d) this.p++;
        continue;
      }
      break;
    }
  }

  readToken() {
    this.skipWS();
    if (this.p >= this.b.length) return null;
    const start = this.p;
    while (this.p < this.b.length && isRegular(this.b[this.p])) this.p++;
    if (this.p === start) this.p++;                  // a delimiter is its own token
    return latin1(this.b, start, this.p);
  }

  peekByte() { this.skipWS(); return this.b[this.p]; }

  parse(depth) {
    if ((depth || 0) > 60) throw new Error('PDF object nesting is implausibly deep');
    this.skipWS();
    if (this.p >= this.b.length) return undefined;
    const c = this.b[this.p];

    if (c === 0x2f) {                                // /Name
      this.p++;
      const start = this.p;
      while (this.p < this.b.length && isRegular(this.b[this.p])) this.p++;
      let raw = latin1(this.b, start, this.p);
      raw = raw.replace(/#([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      return new Name(raw);
    }

    if (c === 0x28) return this.parseLiteralString();
    if (c === 0x3c) {
      if (this.b[this.p + 1] === 0x3c) return this.parseDict(depth || 0);
      return this.parseHexString();
    }
    if (c === 0x5b) {                                // [ array ]
      this.p++;
      const arr = [];
      for (;;) {
        this.skipWS();
        if (this.p >= this.b.length) throw new Error('Unterminated array');
        if (this.b[this.p] === 0x5d) { this.p++; return arr; }
        const v = this.parse((depth || 0) + 1);
        if (v === undefined) throw new Error('Bad value in array');
        arr.push(v);
      }
    }
    if (c === 0x5d || c === 0x3e || c === 0x29) { this.p++; return undefined; }

    // number, reference, keyword
    const save = this.p;
    const tok = this.readToken();
    if (tok === null) return undefined;
    if (tok === 'true') return true;
    if (tok === 'false') return false;
    if (tok === 'null') return null;

    if (/^[+-]?[\d.]+$/.test(tok)) {
      // possible "n g R"
      const save2 = this.p;
      const t2 = this.readToken();
      if (t2 !== null && /^\d+$/.test(t2)) {
        const save3 = this.p;
        const t3 = this.readToken();
        if (t3 === 'R' && /^\d+$/.test(tok)) return new Ref(parseInt(tok, 10), parseInt(t2, 10));
        this.p = save3;
      }
      this.p = save2;
      return parseFloat(tok);
    }

    this.p = save + tok.length;
    return { __keyword: tok };
  }

  parseDict(depth) {
    this.p += 2;                                     // <<
    const d = Object.create(null);
    for (;;) {
      this.skipWS();
      if (this.p >= this.b.length) throw new Error('Unterminated dictionary');
      if (this.b[this.p] === 0x3e && this.b[this.p + 1] === 0x3e) { this.p += 2; break; }
      const key = this.parse(depth + 1);
      if (!(key instanceof Name)) {
        if (key === undefined) throw new Error('Malformed dictionary key');
        continue;
      }
      const val = this.parse(depth + 1);
      d[key.name] = val;
    }

    // a dictionary followed by `stream` owns the bytes that follow
    const save = this.p;
    this.skipWS();
    if (latin1(this.b, this.p, this.p + 6) === 'stream') {
      this.p += 6;
      if (this.b[this.p] === 0x0d) this.p++;
      if (this.b[this.p] === 0x0a) this.p++;
      const start = this.p;
      let len = d.Length;
      let end;
      if (typeof len === 'number' && start + len <= this.b.length) {
        end = start + len;
        // trust /Length only if endstream really follows
        const after = latin1(this.b, end, end + 20);
        if (!/^\s*endstream/.test(after)) end = null;
      }
      if (end == null) {
        const idx = latin1(this.b, start).indexOf('endstream');
        if (idx < 0) throw new Error('Stream has no endstream marker');
        end = start + idx;
        while (end > start && (this.b[end - 1] === 0x0a || this.b[end - 1] === 0x0d)) end--;
      }
      const raw = this.b.slice(start, end);
      this.p = end;
      const ei = latin1(this.b, this.p, this.p + 40).indexOf('endstream');
      if (ei >= 0) this.p += ei + 9;
      return new PDFStream(d, raw);
    }
    this.p = save;
    return d;
  }

  parseLiteralString() {
    this.p++;
    const out = [];
    let depth = 1;
    while (this.p < this.b.length) {
      let c = this.b[this.p++];
      if (c === 0x5c) {                              // backslash
        const n = this.b[this.p++];
        const MAP = { 0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12 };
        if (MAP[n] !== undefined) out.push(MAP[n]);
        else if (n >= 0x30 && n <= 0x37) {           // octal
          let oct = String.fromCharCode(n);
          for (let k = 0; k < 2 && this.b[this.p] >= 0x30 && this.b[this.p] <= 0x37; k++) {
            oct += String.fromCharCode(this.b[this.p++]);
          }
          out.push(parseInt(oct, 8) & 0xff);
        } else if (n === 0x0a) { /* line continuation */ }
        else if (n === 0x0d) { if (this.b[this.p] === 0x0a) this.p++; }
        else out.push(n);
        continue;
      }
      if (c === 0x28) depth++;
      if (c === 0x29) { depth--; if (!depth) break; }
      out.push(c);
    }
    return { __string: new Uint8Array(out) };
  }

  parseHexString() {
    this.p++;
    let hex = '';
    while (this.p < this.b.length && this.b[this.p] !== 0x3e) {
      const c = String.fromCharCode(this.b[this.p++]);
      if (/[0-9a-fA-F]/.test(c)) hex += c;
    }
    this.p++;
    if (hex.length % 2) hex += '0';
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return { __string: out };
  }
}

/* ============================================================
   Document
   ============================================================ */

class PDFDocument {
  constructor(bytes) {
    this.bytes = bytes;
    this.objects = new Map();      // num -> value
    this.trailer = null;
    this.version = '1.4';
    this.warnings = [];
  }

  static async load(bytes, options) {
    const doc = new PDFDocument(bytes);
    doc._password = (options && options.password) || '';
    /* decrypt: false reads an encrypted file's objects as they are stored,
       still encrypted (the security handler's own tests use this) */
    doc._noDecrypt = !!(options && options.decrypt === false);
    await doc._parse();
    return doc;
  }

  async _parse() {
    const b = this.bytes;
    if (latin1(b, 0, 5) !== '%PDF-') throw new Error('This file does not begin with a PDF header.');
    this.version = latin1(b, 5, 8);

    const tail = latin1(b, Math.max(0, b.length - 2048));
    const sx = tail.lastIndexOf('startxref');
    let ok = false;
    if (sx >= 0) {
      const off = parseInt(tail.slice(sx + 9).trim(), 10);
      if (isFinite(off) && off > 0 && off < b.length) {
        try { await this._readXrefChain(off, new Set()); ok = true; }
        catch (e) { this.warnings.push('Cross-reference table unreadable: ' + e.message); }
      }
    }
    // A damaged or unusual xref is common in the wild; scanning always works.
    if (!ok || !this.trailer || !this.trailer.Root) await this._scanAllObjects();
    if (!this.trailer || !this.trailer.Root) {
      const found = this._findCatalogByScan();
      if (!found) throw new Error('No document catalogue found — the file may be damaged or encrypted.');
      this.trailer = this.trailer || Object.create(null);
      this.trailer.Root = found;
    }
    if (this.trailer && this.trailer.Encrypt) { if (this._noDecrypt) this.encrypted = true; else await this._decrypt(); }
    else if (this._deferred) await this._expandDeferred();
  }

  async _readXrefChain(offset, seen) {
    if (seen.has(offset) || seen.size > 64) return;
    seen.add(offset);

    const lex = new Lexer(this.bytes, offset);
    lex.skipWS();

    if (latin1(this.bytes, lex.p, lex.p + 4) === 'xref') {
      lex.p += 4;
      for (;;) {
        lex.skipWS();
        if (latin1(this.bytes, lex.p, lex.p + 7) === 'trailer') { lex.p += 7; break; }
        const start = lex.readToken(), count = lex.readToken();
        if (start === null || count === null || !/^\d+$/.test(start) || !/^\d+$/.test(count)) break;
        const s = parseInt(start, 10), n = parseInt(count, 10);
        for (let i = 0; i < n; i++) {
          lex.skipWS();
          const off = lex.readToken(), gen = lex.readToken(), type = lex.readToken();
          if (type === 'n' && !this.objects.has(s + i)) {
            this._offsets = this._offsets || new Map();
            if (!this._offsets.has(s + i)) this._offsets.set(s + i, parseInt(off, 10));
          }
        }
      }
      const tr = lex.parse(0);
      if (isDict(tr)) {
        this.trailer = this.trailer || Object.create(null);
        for (const k of Object.keys(tr)) if (!(k in this.trailer)) this.trailer[k] = tr[k];
        if (typeof tr.XRefStm === 'number') await this._readXrefChain(tr.XRefStm, seen);
        if (typeof tr.Prev === 'number') await this._readXrefChain(tr.Prev, seen);
      }
      await this._materialiseOffsets();
      return;
    }

    // xref stream: "N G obj << ... >> stream"
    lex.readToken(); lex.readToken(); lex.readToken();
    const st = lex.parse(0);
    if (!(st instanceof PDFStream)) throw new Error('Expected a cross-reference stream');
    const d = st.dict;
    const data = await this.decodeStream(st);
    const W = (d.W || []).map(Number);
    if (W.length < 3) throw new Error('Cross-reference stream has a malformed /W array');
    const size = Number(d.Size) || 0;
    const index = d.Index && d.Index.length ? d.Index.map(Number) : [0, size];

    const rowLen = W.reduce((a, c) => a + c, 0);
    let p = 0;
    this._offsets = this._offsets || new Map();
    this._inObjStm = this._inObjStm || new Map();

    for (let s = 0; s < index.length; s += 2) {
      const first = index[s], n = index[s + 1];
      for (let i = 0; i < n && p + rowLen <= data.length; i++) {
        const f = [];
        for (const w of W) {
          let v = 0;
          for (let k = 0; k < w; k++) v = v * 256 + data[p + k];
          f.push(w === 0 ? 1 : v);
          p += w;
        }
        const num = first + i;
        if (f[0] === 1 && !this._offsets.has(num) && !this._inObjStm.has(num)) this._offsets.set(num, f[1]);
        else if (f[0] === 2 && !this._offsets.has(num) && !this._inObjStm.has(num)) this._inObjStm.set(num, { stm: f[1], idx: f[2] });
      }
    }

    this.trailer = this.trailer || Object.create(null);
    for (const k of Object.keys(d)) if (!(k in this.trailer)) this.trailer[k] = d[k];
    if (typeof d.Prev === 'number') await this._readXrefChain(d.Prev, seen);
    await this._materialiseOffsets();
  }

  async _materialiseOffsets() {
    if (this._offsets) {
      for (const [num, off] of this._offsets) {
        if (this.objects.has(num)) continue;
        try {
          const lex = new Lexer(this.bytes, off);
          const a = lex.readToken(), b2 = lex.readToken(), c = lex.readToken();
          if (c !== 'obj') continue;
          if (parseInt(a, 10) !== num) continue;
          const v = lex.parse(0);
          if (v !== undefined) { this.objects.set(num, v); this._gen(num, b2); }
        } catch (e) { /* one bad object should not sink the document */ }
      }
      this._offsets = null;
    }
    if (this._inObjStm && this._inObjStm.size && this.trailer && this.trailer.Encrypt) {
      this._deferred = this._deferred || new Map();
      for (const [num, loc] of this._inObjStm) if (!this._deferred.has(num)) this._deferred.set(num, loc);
      this._inObjStm = null;
      return;
    }
    if (this._inObjStm && this._inObjStm.size) {
      const byStm = new Map();
      for (const [num, loc] of this._inObjStm) {
        if (!byStm.has(loc.stm)) byStm.set(loc.stm, []);
        byStm.get(loc.stm).push(num);
      }
      for (const [stmNum, nums] of byStm) {
        try { await this._expandObjStm(stmNum, nums); }
        catch (e) { this.warnings.push(`Object stream ${stmNum} could not be expanded.`); }
      }
      this._inObjStm = null;
    }
  }

  async _expandObjStm(stmNum, wanted) {
    const stm = this.objects.get(stmNum);
    if (!(stm instanceof PDFStream)) return;
    const data = await this.decodeStream(stm);
    const n = Number(await this.resolve(stm.dict.N)) || 0;
    const first = Number(await this.resolve(stm.dict.First)) || 0;

    const head = new Lexer(data, 0);
    const pairs = [];
    for (let i = 0; i < n; i++) {
      const num = head.readToken(), off = head.readToken();
      if (num === null || off === null) break;
      pairs.push([parseInt(num, 10), parseInt(off, 10)]);
    }
    for (const [num, off] of pairs) {
      if (this.objects.has(num)) continue;
      if (wanted && wanted.length && !wanted.includes(num)) { /* still parse — cheap and avoids a second pass */ }
      try {
        const lex = new Lexer(data, first + off);
        const v = lex.parse(0);
        if (v !== undefined) this.objects.set(num, v);
      } catch (e) { /* skip */ }
    }
  }

  /** Brute-force scan for "N G obj". Slower, but survives a broken xref. */
  async _scanAllObjects() {
    const s = latin1(this.bytes);
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const num = parseInt(m[1], 10);
      try {
        const lex = new Lexer(this.bytes, m.index + m[0].length);
        const v = lex.parse(0);
        if (v !== undefined) { this.objects.set(num, v); this._gen(num, m[2]); }   // later wins
      } catch (e) { /* skip */ }
    }
    if (this._findEncryptByScan()) { this._scanDeferred = true; }
    // expand any object streams we found
    for (const [num, v] of (this._scanDeferred ? [] : [...this.objects])) {
      if (v instanceof PDFStream && isName(v.dict.Type, 'ObjStm')) {
        try { await this._expandObjStm(num, null); } catch (e) { /* skip */ }
      }
    }
    if (!this.trailer || !this.trailer.Root) {
      const ti = s.lastIndexOf('trailer');
      if (ti >= 0) {
        try {
          const lex = new Lexer(this.bytes, ti + 7);
          const tr = lex.parse(0);
          if (isDict(tr)) { this.trailer = this.trailer || Object.create(null); Object.assign(this.trailer, tr); }
        } catch (e) { /* fall through to catalogue scan */ }
      }
    }
  }

  _gen(num, g) {
    const n = parseInt(g, 10);
    if (n > 0) { this._gens = this._gens || new Map(); this._gens.set(num, n); }
  }

  /** A damaged file's trailer may be lost; its Encrypt dictionary is not. */
  _findEncryptByScan() {
    if (this.trailer && this.trailer.Encrypt) return true;
    for (const [num, v] of this.objects) {
      if (isDict(v) && isName(v.Filter) && v.O !== undefined && v.U !== undefined && v.P !== undefined && v.R !== undefined) {
        this.trailer = this.trailer || Object.create(null);
        this.trailer.Encrypt = new Ref(num, 0);
        return true;
      }
    }
    return false;
  }

  /**
   * Open an encrypted file with the password given to load(), or with none:
   * a file protected only against printing or copying has an empty user
   * password and opens like any other. Every string and stream is decrypted
   * in place, so the rest of the engine never sees ciphertext and what it
   * writes is a plain file. doc.security says how it was opened.
   */
  async _decrypt() {
    if (!CRYPT) throw Object.assign(new Error('This PDF is encrypted, and this copy of the engine cannot open encrypted files.'), { code: 'unsupported' });
    const encRef = this.trailer.Encrypt;
    const enc = await this.resolve(encRef);
    if (!isDict(enc)) throw Object.assign(new Error('This PDF says it is encrypted but its encryption dictionary is missing.'), { code: 'damaged' });
    const plain = (v, depth) => {
      if (depth > 6) return null;
      if (v instanceof Ref) return plain(this.objects.get(v.num), depth + 1);
      if (v instanceof Name) return v.name;
      if (v && v.__string !== undefined) return v.__string;
      if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1));
      if (isDict(v)) { const o = {}; for (const k of Object.keys(v)) o[k] = plain(v[k], depth + 1); return o; }
      return v;
    };
    const ids = await this.resolve(this.trailer.ID);
    const id0 = Array.isArray(ids) && ids[0] && ids[0].__string ? ids[0].__string : new Uint8Array(0);
    const h = CRYPT.openHandler({ encrypt: plain(enc, 0), id0, password: this._password || '' });
    if (!h.ok) {
      if (h.reason === 'password') {
        throw Object.assign(new Error(this._password ? 'That password did not open it.' : 'This PDF needs a password to open.'), { code: 'password' });
      }
      throw Object.assign(new Error(h.message || 'This PDF uses an encryption method these tools cannot open (a certificate rather than a password, for example).'), { code: 'unsupported' });
    }
    const skip = encRef instanceof Ref ? encRef.num : -1;
    const gens = this._gens || new Map();
    const walk = (v, num, gen) => {
      if (!v || typeof v !== 'object') return;
      if (v.__string !== undefined) { v.__string = CRYPT.decryptBytes(h, num, gen, v.__string, 'string'); return; }
      if (Array.isArray(v)) { for (const x of v) walk(x, num, gen); return; }
      if (v instanceof PDFStream) { walk(v.dict, num, gen); return; }
      if (isDict(v)) for (const k of Object.keys(v)) walk(v[k], num, gen);
    };
    for (const [num, v] of this.objects) {
      if (num === skip) continue;
      const gen = gens.get(num) || 0;
      if (v instanceof PDFStream) {
        const type = v.dict.Type;
        if (isName(type, 'XRef')) continue;
        const kind = isName(type, 'Metadata') ? 'metadata' : isName(type, 'EmbeddedFile') ? 'embeddedFile' : 'stream';
        walk(v.dict, num, gen);
        v.raw = CRYPT.decryptBytes(h, num, gen, v.raw, kind);
        v._decoded = null;
      } else walk(v, num, gen);
    }
    this.security = {
      method: h.method || (h.stmf === 'AESV3' ? 'AES-256' : h.stmf === 'AESV2' ? 'AES-128' : 'RC4'),
      openedWith: h.openedWith || (this._password ? (h.isOwner ? 'owner' : 'user') : 'empty'),
      isOwner: !!h.isOwner,
      permissions: CRYPT.permissionsFromP(h.permissions, h.revision),
      describe: CRYPT.describeHandler(h)
    };
    delete this.trailer.Encrypt;
    if (this._deferred) await this._expandDeferred();
    if (this._scanDeferred) {
      this._scanDeferred = false;
      for (const [num, v] of [...this.objects]) {
        if (v instanceof PDFStream && isName(v.dict.Type, 'ObjStm')) {
          try { await this._expandObjStm(num, null); } catch (e) { /* skip */ }
        }
      }
    }
  }

  async _expandDeferred() {
    const byStm = new Map();
    for (const [num, loc] of this._deferred) {
      if (!byStm.has(loc.stm)) byStm.set(loc.stm, []);
      byStm.get(loc.stm).push(num);
    }
    this._deferred = null;
    for (const [stmNum, nums] of byStm) {
      try { await this._expandObjStm(stmNum, nums); }
      catch (e) { this.warnings.push(`Object stream ${stmNum} could not be expanded.`); }
    }
  }

  _findCatalogByScan() {
    for (const [num, v] of this.objects) {
      const d = v instanceof PDFStream ? v.dict : v;
      if (isDict(d) && isName(d.Type, 'Catalog')) return new Ref(num, 0);
    }
    return null;
  }

  async resolve(v) {
    let guard = 0;
    while (v instanceof Ref) {
      if (++guard > 64) throw new Error('Circular reference in the PDF');
      v = this.objects.get(v.num);
    }
    return v;
  }

  async decodeStream(stm) {
    if (stm._decoded) return stm._decoded;
    let data = stm.raw;
    let filters = await this.resolve(stm.dict.Filter);
    if (!filters) { stm._decoded = data; return data; }
    if (!Array.isArray(filters)) filters = [filters];
    let parms = await this.resolve(stm.dict.DecodeParms || stm.dict.DP);
    if (!Array.isArray(parms)) parms = [parms];

    for (let i = 0; i < filters.length; i++) {
      const f = await this.resolve(filters[i]);
      if (!(f instanceof Name)) continue;
      if (f.name === 'FlateDecode' || f.name === 'Fl') {
        data = await inflate(data);
        const pm = await this.resolve(parms[i]);
        if (isDict(pm) && pm.Predictor) {
          data = applyPredictor(data, Number(await this.resolve(pm.Predictor)),
            Number(await this.resolve(pm.Colors)) || 1,
            Number(await this.resolve(pm.BitsPerComponent)) || 8,
            Number(await this.resolve(pm.Columns)) || 1);
        }
      } else if (f.name === 'ASCIIHexDecode' || f.name === 'AHx') {
        let hex = latin1(data).replace(/[^0-9a-fA-F>]/g, '');
        hex = hex.slice(0, hex.indexOf('>') >= 0 ? hex.indexOf('>') : hex.length);
        if (hex.length % 2) hex += '0';
        const out = new Uint8Array(hex.length / 2);
        for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.substr(k * 2, 2), 16);
        data = out;
      } else if (f.name === 'ASCII85Decode' || f.name === 'A85') {
        data = ascii85Decode(data);
      } else {
        // DCTDecode, JPXDecode and friends stay compressed; that is correct,
        // since we copy image data through untouched.
        break;
      }
    }
    stm._decoded = data;
    return data;
  }

  /** Flatten the page tree into an ordered array of page dictionaries. */
  async getPages() {
    if (this._pages) return this._pages;
    const root = await this.resolve(this.trailer.Root);
    if (!isDict(root)) throw new Error('The document catalogue is missing or malformed.');
    const pagesRef = root.Pages;
    const out = [];
    const seen = new Set();

    const walk = async (ref, inherited, depth) => {
      if (depth > 64 || out.length > 20000) return;
      const key = ref instanceof Ref ? ref.num : null;
      if (key !== null) { if (seen.has(key)) return; seen.add(key); }
      const node = await this.resolve(ref);
      if (!isDict(node)) return;

      const inh = Object.assign({}, inherited);
      for (const k of ['Resources', 'MediaBox', 'CropBox', 'Rotate']) {
        if (node[k] !== undefined) inh[k] = node[k];
      }
      if (isName(node.Type, 'Page') || (!node.Kids && node.Contents !== undefined)) {
        out.push({ ref: ref instanceof Ref ? ref : null, dict: node, inherited: inh });
        return;
      }
      const kids = await this.resolve(node.Kids);
      if (Array.isArray(kids)) for (const k of kids) await walk(k, inh, depth + 1);
    };

    await walk(pagesRef, Object.create(null), 0);
    if (!out.length) {
      // last resort: any object that looks like a page
      for (const [num, v] of this.objects) {
        if (isDict(v) && isName(v.Type, 'Page')) out.push({ ref: new Ref(num, 0), dict: v, inherited: Object.create(null) });
      }
    }
    this._pages = out;
    return out;
  }

  async pageCount() { return (await this.getPages()).length; }

  async getInfo() {
    const info = await this.resolve(this.trailer && this.trailer.Info);
    const out = {};
    if (isDict(info)) {
      for (const k of ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate']) {
        const v = await this.resolve(info[k]);
        if (v && v.__string) out[k] = decodePdfString(v.__string);
        else if (typeof v === 'string') out[k] = v;
      }
    }
    return out;
  }
}

function decodePdfString(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let s = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return s;
  }
  return latin1(bytes);
}

function ascii85Decode(data) {
  const s = latin1(data).replace(/\s/g, '').replace(/^<~/, '');
  const end = s.indexOf('~>');
  const body = end >= 0 ? s.slice(0, end) : s;
  const out = [];
  let tuple = [], i = 0;
  while (i < body.length) {
    const c = body[i++];
    if (c === 'z' && tuple.length === 0) { out.push(0, 0, 0, 0); continue; }
    tuple.push(c.charCodeAt(0) - 33);
    if (tuple.length === 5) {
      let v = 0;
      for (const t of tuple) v = v * 85 + t;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      tuple = [];
    }
  }
  if (tuple.length) {
    const n = tuple.length;
    for (let k = n; k < 5; k++) tuple.push(84);
    let v = 0;
    for (const t of tuple) v = v * 85 + t;
    const b = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    for (let k = 0; k < n - 1; k++) out.push(b[k]);
  }
  return new Uint8Array(out);
}

/* ============================================================
   Writer
   ============================================================ */

class PDFWriter {
  constructor() {
    this.objects = [null];        // 1-indexed
  }
  alloc() { this.objects.push(undefined); return this.objects.length - 1; }
  set(num, val) { this.objects[num] = val; }
  add(val) { const n = this.alloc(); this.objects[n] = val; return n; }

  serialiseValue(v) {
    if (v === null) return 'null';
    if (v === true) return 'true';
    if (v === false) return 'false';
    if (typeof v === 'number') {
      if (!isFinite(v)) return '0';
      return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
    }
    if (v instanceof Name) return '/' + v.name.replace(/[^\x21-\x7e]|[#()<>\[\]{}\/%]/g,
      c => '#' + c.charCodeAt(0).toString(16).padStart(2, '0'));
    if (v instanceof Ref) return `${v.num} ${v.gen} R`;
    if (Array.isArray(v)) return '[' + v.map(x => this.serialiseValue(x)).join(' ') + ']';
    if (v && v.__string !== undefined) return '(' + escapeString(v.__string) + ')';
    if (v && v.__raw !== undefined) return v.__raw;
    if (v instanceof PDFStream) return this.serialiseValue(v.dict);
    if (isDict(v)) {
      const parts = [];
      for (const k of Object.keys(v)) {
        if (v[k] === undefined) continue;
        parts.push('/' + k + ' ' + this.serialiseValue(v[k]));
      }
      return '<<' + parts.join(' ') + '>>';
    }
    return 'null';
  }

  build(rootRef, infoRef, version, extraTrailer) {
    const chunks = [];
    let len = 0;
    const push = (x) => { const a = typeof x === 'string' ? bytesOf(x) : x; chunks.push(a); len += a.length; };

    push(`%PDF-${version || '1.7'}\n%\xE2\xE3\xCF\xD3\n`);
    const offsets = new Array(this.objects.length).fill(0);

    for (let i = 1; i < this.objects.length; i++) {
      const v = this.objects[i];
      if (v === undefined) continue;
      offsets[i] = len;
      push(`${i} 0 obj\n`);
      if (v instanceof PDFStream) {
        const d = Object.assign(Object.create(null), v.dict);
        d.Length = v.raw.length;
        push(this.serialiseValue(d));
        push('\nstream\n');
        push(v.raw);
        push('\nendstream');
      } else {
        push(this.serialiseValue(v));
      }
      push('\nendobj\n');
    }

    const xrefAt = len;
    push(`xref\n0 ${this.objects.length}\n`);
    push('0000000000 65535 f \n');
    for (let i = 1; i < this.objects.length; i++) {
      /* a number left empty (a duplicate folded into another) is free */
      push(this.objects[i] === undefined ? '0000000000 65535 f \n' : String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    }
    const trailer = { Size: this.objects.length, Root: rootRef };
    if (infoRef) trailer.Info = infoRef;
    if (extraTrailer) Object.assign(trailer, extraTrailer);
    push('trailer\n' + this.serialiseValue(trailer) + `\nstartxref\n${xrefAt}\n%%EOF\n`);

    const out = new Uint8Array(len);
    let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return out;
  }
}

function escapeString(bytes) {
  let s = '';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += '\\' + String.fromCharCode(b);
    else if (b < 32 || b > 126) s += '\\' + b.toString(8).padStart(3, '0');
    else s += String.fromCharCode(b);
  }
  return s;
}

const pdfString = (str) => {
  // UTF-16BE with a BOM whenever the text leaves Latin-1
  const needsUnicode = /[^\x00-\xff]/.test(str);
  if (!needsUnicode) return { __string: bytesOf(str) };
  const out = [0xfe, 0xff];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      const hi = 0xd800 + (v >> 10), lo = 0xdc00 + (v & 0x3ff);
      out.push(hi >> 8, hi & 255, lo >> 8, lo & 255);
    } else out.push(cp >> 8, cp & 255);
  }
  return { __string: new Uint8Array(out) };
};

/* ============================================================
   Pictures: image XObjects for logos, stamps and scans
   ============================================================ */

/**
 * Make a picture ready to embed. A JPEG goes in as its own bytes
 * (DCTDecode); raw pixels are deflated, with their transparency as a soft
 * mask. Input, from the page's image control or a canvas:
 *   { kind: 'jpeg', bytes, width, height, components }
 *   { kind: 'raw', width, height, rgb, alpha | null }      (8 bits per sample)
 *   { kind: 'grey', width, height, grey }
 * Async because deflating uses the platform's CompressionStream.
 */
async function prepareImage(img) {
  if (!img || !(img.width > 0) || !(img.height > 0)) throw new Error('That picture has no size.');
  if (img.prepared) return img;
  if (img.kind === 'jpeg') {
    return { prepared: true, width: img.width, height: img.height, filter: 'DCTDecode', data: img.bytes,
      colorSpace: img.components === 1 ? 'DeviceGray' : img.components === 4 ? 'DeviceCMYK' : 'DeviceRGB', smask: null };
  }
  if (img.kind === 'grey') {
    return { prepared: true, width: img.width, height: img.height, filter: 'FlateDecode', data: await deflate(img.grey), colorSpace: 'DeviceGray', smask: null };
  }
  if (img.kind === 'raw') {
    const out = { prepared: true, width: img.width, height: img.height, filter: 'FlateDecode', data: await deflate(img.rgb), colorSpace: 'DeviceRGB', smask: null };
    if (img.alpha) out.smask = await deflate(img.alpha);
    return out;
  }
  throw new Error('Unknown picture format.');
}

/** Add a prepared picture to a writer once, however many pages draw it. */
function imageRef(writer, prep) {
  writer._images = writer._images || new Map();
  if (writer._images.has(prep)) return writer._images.get(prep);
  const d = Object.create(null);
  d.Type = new Name('XObject'); d.Subtype = new Name('Image');
  d.Width = prep.width; d.Height = prep.height;
  d.ColorSpace = new Name(prep.colorSpace); d.BitsPerComponent = 8;
  d.Filter = new Name(prep.filter);
  if (prep.colorSpace === 'DeviceCMYK' && prep.filter === 'DCTDecode') d.Decode = [1, 0, 1, 0, 1, 0, 1, 0];
  if (prep.smask) {
    const m = Object.create(null);
    m.Type = new Name('XObject'); m.Subtype = new Name('Image');
    m.Width = prep.width; m.Height = prep.height;
    m.ColorSpace = new Name('DeviceGray'); m.BitsPerComponent = 8; m.Filter = new Name('FlateDecode');
    d.SMask = new Ref(writer.add(new PDFStream(m, prep.smask)), 0);
  }
  const ref = new Ref(writer.add(new PDFStream(d, prep.data)), 0);
  writer._images.set(prep, ref);
  return ref;
}

/* ============================================================
   Page operations
   ============================================================ */

/* What copyObject returns for a reference it must not follow. A dictionary
   leaves that key out; a list of things (Kids, Annots, Fields, CO) leaves the
   entry out; any other array gets null in its place. */
const BARRED = Object.freeze({ __barred: true });
const LIST_KEYS = new Set(['Kids', 'Annots', 'Fields', 'CO']);

/**
 * Deep-copy an object graph from a source document into a writer, renumbering.
 *
 * With `ctx` (assemble passes one per source document) two kinds of reference
 * are never followed. A page the output keeps is pointed at its new page
 * object. Every other page, the page tree, the catalogue, and anything that
 * belongs only to a page the output leaves out (its annotations, the form
 * fields only it shows) is cut. Without that, a link or a form field on a kept
 * page drags a deleted page into the file behind it, content and all — present
 * in the bytes, invisible in every viewer.
 */
async function copyObject(doc, writer, value, map, depth, ctx) {
  depth = depth || 0;
  if (depth > 80) return null;
  if (value instanceof Ref) {
    const key = value.num;
    if (ctx) {
      if (ctx.kept.has(key)) return new Ref(ctx.kept.get(key), 0);
      if (ctx.barred.has(key)) return BARRED;
    }
    if (map.has(key)) return new Ref(map.get(key), 0);
    const slot = writer.alloc();
    map.set(key, slot);
    let target = await doc.resolve(value);
    if (ctx && ctx.rewrite) target = await ctx.rewrite(key, target);
    const copied = await copyObject(doc, writer, target, map, depth + 1, ctx);
    writer.set(slot, copied === undefined || copied === BARRED ? null : copied);
    return new Ref(slot, 0);
  }
  if (Array.isArray(value)) return copyArray(doc, writer, value, map, depth, ctx, false);
  if (value instanceof PDFStream) {
    const d = Object.create(null);
    for (const k of Object.keys(value.dict)) {
      if (k === 'Length') continue;
      const c = await copyEntry(doc, writer, k, value.dict[k], map, depth, ctx);
      if (c !== BARRED) d[k] = c;
    }
    return new PDFStream(d, value.raw);
  }
  if (isDict(value)) {
    const d = Object.create(null);
    for (const k of Object.keys(value)) {
      const c = await copyEntry(doc, writer, k, value[k], map, depth, ctx);
      if (c !== BARRED) d[k] = c;
    }
    return d;
  }
  return value;
}

async function copyEntry(doc, writer, key, v, map, depth, ctx) {
  if (Array.isArray(v)) return copyArray(doc, writer, v, map, depth, ctx, LIST_KEYS.has(key));
  return copyObject(doc, writer, v, map, depth + 1, ctx);
}

async function copyArray(doc, writer, value, map, depth, ctx, isList) {
  const out = [];
  for (const v of value) {
    const c = await copyObject(doc, writer, v, map, depth + 1, ctx);
    if (c === BARRED) { if (!isList) out.push(null); }
    else out.push(c);
  }
  return out;
}

/* ============================================================
   The visible page, the right way up
   ============================================================ */

async function readBox(doc, v) {
  const a = await doc.resolve(v);
  if (!Array.isArray(a) || a.length < 4) return null;
  const n = [];
  for (const x of a.slice(0, 4)) {
    const r = Number(await doc.resolve(x));
    if (!isFinite(r)) return null;
    n.push(r);
  }
  return [Math.min(n[0], n[2]), Math.min(n[1], n[3]), Math.max(n[0], n[2]), Math.max(n[1], n[3])];
}

/**
 * The part of a page a viewer shows (the CropBox, clipped to the MediaBox),
 * turned the way the viewer turns it (/Rotate, plus any `extraRotate`).
 *
 * Returns { width, height, rotate, box, matrix }: width and height are what
 * the reader sees, and matrix maps that upright frame — origin at the bottom
 * left of the visible page, x to the right, y up — onto the page's own
 * coordinates. A stamp drawn in the frame through that matrix lands upright
 * and inside the visible area whatever the page's rotation and crop. It is
 * the same frame pdf.js draws at scale 1, so a click on a preview and the
 * point written to the file agree.
 */
async function pageFrame(doc, pageIndex, extraRotate) {
  const pages = await doc.getPages();
  const page = pages[pageIndex];
  if (!page) throw new Error('There is no page ' + (pageIndex + 1) + ' in this document.');
  const get = (k) => (page.dict[k] !== undefined ? page.dict[k] : page.inherited[k]);
  const media = (await readBox(doc, get('MediaBox'))) || [0, 0, 595.28, 841.89];
  let box = media;
  const crop = await readBox(doc, get('CropBox'));
  if (crop) {
    const x0 = Math.max(crop[0], media[0]), y0 = Math.max(crop[1], media[1]);
    const x1 = Math.min(crop[2], media[2]), y1 = Math.min(crop[3], media[3]);
    if (x1 > x0 && y1 > y0) box = [x0, y0, x1, y1];
  }
  let rot = (Number(await doc.resolve(get('Rotate'))) || 0) + (Number(extraRotate) || 0);
  rot = ((rot % 360) + 360) % 360;
  if (rot % 90) rot = 0;                          // what viewers do with a bad angle
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0, h = y1 - y0;
  const matrix = rot === 90 ? [0, 1, -1, 0, x1, y0]
    : rot === 180 ? [-1, 0, 0, -1, x1, y1]
    : rot === 270 ? [0, -1, 1, 0, x0, y1]
    : [1, 0, 0, 1, x0, y0];
  return { width: rot % 180 ? h : w, height: rot % 180 ? w : h, rotate: rot, box, matrix };
}

/* ============================================================
   What a rebuilt file may carry from each source
   ============================================================ */

function newSource(doc) {
  return {
    doc, map: new Map(),
    kept: new Map(),          // source page object number -> output page object number
    keptIdx: new Set(),       // source page indices in the output
    first: null,              // output object number of the first page taken from it
    pageNums: new Set(), barred: new Set(),
    annotNums: new Set(), aliveAnnots: new Set(),
    aliveFields: new Set(), liveWidgets: [],
    root: null, acroForm: null, named: null, ctx: null
  };
}

/** Everything about one source that assemble needs before it copies a page. */
async function prepareSource(doc, st) {
  const pages = await doc.getPages();
  pages.forEach((p) => { if (p.ref) st.pageNums.add(p.ref.num); });
  /* every page is barred; the kept ones are caught first and remapped */
  for (const n of st.pageNums) st.barred.add(n);

  const rootRef = doc.trailer && doc.trailer.Root;
  if (rootRef instanceof Ref) st.barred.add(rootRef.num);
  const root = await doc.resolve(rootRef);
  st.root = isDict(root) ? root : Object.create(null);

  /* the page tree */
  const tree = async (ref, depth) => {
    if (!(ref instanceof Ref) || depth > 64 || st.pageNums.has(ref.num)) return;
    const node = await doc.resolve(ref);
    if (!isDict(node) || isName(node.Type, 'Page') || st.barred.has(ref.num)) return;
    st.barred.add(ref.num);
    const kids = await doc.resolve(node.Kids);
    if (Array.isArray(kids)) for (const k of kids) await tree(k, depth + 1);
  };
  await tree(st.root.Pages, 0);

  /* document-level dictionaries no page owns */
  for (const k of ['Outlines', 'AcroForm', 'Names', 'Dests', 'StructTreeRoot', 'Threads', 'PageLabels']) {
    if (st.root[k] instanceof Ref) st.barred.add(st.root[k].num);
  }
  const ol = await doc.resolve(st.root.Outlines);
  if (isDict(ol)) {
    const seen = new Set();
    const walk = async (ref, depth) => {
      while (ref instanceof Ref && !seen.has(ref.num) && depth < 32 && seen.size < 100000) {
        seen.add(ref.num);
        st.barred.add(ref.num);
        const it = await doc.resolve(ref);
        if (!isDict(it)) return;
        await walk(it.First, depth + 1);
        ref = it.Next;
      }
    };
    await walk(ol.First, 0);
  }

  /* annotations: alive when they sit on a page the output keeps */
  for (let i = 0; i < pages.length; i++) {
    const arr = await doc.resolve(pages[i].dict.Annots);
    if (!Array.isArray(arr)) continue;
    for (const r of arr) {
      if (!(r instanceof Ref)) continue;
      st.annotNums.add(r.num);
      if (st.keptIdx.has(i)) st.aliveAnnots.add(r.num);
    }
  }
  for (const n of st.annotNums) if (!st.aliveAnnots.has(n)) st.barred.add(n);

  /* form fields: alive when one of their widgets is */
  const af = await doc.resolve(st.root.AcroForm);
  st.acroForm = isDict(af) ? af : null;
  const nodes = new Set();
  const down = async (ref, depth) => {
    if (!(ref instanceof Ref) || nodes.has(ref.num) || depth > 32) return;
    nodes.add(ref.num);
    const d = await doc.resolve(ref);
    if (!isDict(d)) return;
    const kids = await doc.resolve(d.Kids);
    if (Array.isArray(kids)) for (const k of kids) await down(k, depth + 1);
  };
  if (st.acroForm) {
    const f = await doc.resolve(st.acroForm.Fields);
    if (Array.isArray(f)) for (const r of f) await down(r, 0);
  }
  for (const n of st.annotNums) {
    const a = await doc.resolve(new Ref(n, 0));
    if (!isDict(a) || !isName(await doc.resolve(a.Subtype), 'Widget')) continue;
    const live = st.aliveAnnots.has(n);
    nodes.add(n);
    if (live) { st.aliveFields.add(n); st.liveWidgets.push(a); }
    let d = a, guard = 0;
    while (isDict(d) && d.Parent instanceof Ref && guard++ < 32) {
      nodes.add(d.Parent.num);
      if (live) st.aliveFields.add(d.Parent.num);
      d = await doc.resolve(d.Parent);
    }
  }
  for (const n of nodes) if (!st.aliveFields.has(n)) st.barred.add(n);

  st.ctx = {
    kept: st.kept, barred: st.barred,
    rewrite: async (num, v) => (st.annotNums.has(num) && isDict(v)) ? rewriteAnnot(doc, st, v) : v
  };
}

/** Name -> destination, from the catalogue's /Dests and its /Names tree. */
async function namedDests(doc, st) {
  if (st.named) return st.named;
  const m = new Map();
  const old = await doc.resolve(st.root.Dests);
  if (isDict(old)) for (const k of Object.keys(old)) m.set(k, old[k]);
  const names = await doc.resolve(st.root.Names);
  const seen = new Set();
  const walk = async (ref, depth) => {
    if (depth > 32) return;
    if (ref instanceof Ref) { if (seen.has(ref.num)) return; seen.add(ref.num); }
    const node = await doc.resolve(ref);
    if (!isDict(node)) return;
    const arr = await doc.resolve(node.Names);
    if (Array.isArray(arr)) {
      for (let i = 0; i + 1 < arr.length; i += 2) {
        const k = await doc.resolve(arr[i]);
        if (k && k.__string && !m.has(latin1(k.__string))) m.set(latin1(k.__string), arr[i + 1]);
      }
    }
    const kids = await doc.resolve(node.Kids);
    if (Array.isArray(kids)) for (const k of kids) await walk(k, depth + 1);
  };
  if (isDict(names)) await walk(names.Dests, 0);
  st.named = m;
  return m;
}

/**
 * A destination as an explicit array whose first element is the source page's
 * reference: { ok, page, array }. ok is false when it names nothing, or
 * nothing that is a page of this document.
 */
async function resolveDest(doc, st, dest) {
  let d = await doc.resolve(dest);
  if (d instanceof Name || (d && d.__string)) {
    const key = d instanceof Name ? d.name : latin1(d.__string);
    d = await doc.resolve((await namedDests(doc, st)).get(key));
  }
  if (isDict(d) && d.D !== undefined) d = await doc.resolve(d.D);
  if (!Array.isArray(d) || !d.length) return { ok: false, page: null, array: null };
  let first = d[0];
  if (typeof first === 'number') {               // a page index: meant for remote files, but some writers use it
    const p = (await doc.getPages())[first];
    first = p && p.ref ? p.ref : null;
  }
  if (!(first instanceof Ref) || !st.pageNums.has(first.num)) return { ok: false, page: null, array: null };
  return { ok: true, page: first.num, array: [first].concat(d.slice(1)) };
}

/** Where an annotation jumps to inside its own file, or null when it does not. */
async function annotTarget(doc, st, a) {
  if (a.Dest !== undefined) return Object.assign({ via: 'Dest' }, await resolveDest(doc, st, a.Dest));
  const act = await doc.resolve(a.A);
  if (isDict(act) && isName(await doc.resolve(act.S), 'GoTo')) {
    return Object.assign({ via: 'A', act }, await resolveDest(doc, st, act.D));
  }
  return null;
}

/** The annotation with its jump pointed at the kept page, or removed if that page is gone. */
async function rewriteAnnot(doc, st, a) {
  const t = await annotTarget(doc, st, a);
  if (!t) return a;
  const out = Object.assign(Object.create(null), a);
  const live = t.ok && st.kept.has(t.page);
  if (t.via === 'Dest') {
    if (live) out.Dest = t.array; else delete out.Dest;
  } else if (live) {
    const act = Object.assign(Object.create(null), t.act);
    act.D = t.array;
    out.A = act;
  } else delete out.A;
  return out;
}

/** A kept page's annotations, without the links that lead to a page the output leaves out. */
async function keptAnnots(doc, st, value, drop) {
  const arr = await doc.resolve(value);
  if (!Array.isArray(arr)) return undefined;
  const out = [];
  for (const r of arr) {
    if (r instanceof Ref && st.barred.has(r.num)) continue;
    if (drop && r instanceof Ref && drop.has(r.num)) continue;
    const a = await doc.resolve(r);
    if (!isDict(a)) continue;
    if (isName(await doc.resolve(a.Subtype), 'Link')) {
      const t = await annotTarget(doc, st, a);
      if (t && !(t.ok && st.kept.has(t.page))) continue;
    }
    out.push(r instanceof Ref ? r : await rewriteAnnot(doc, st, a));
  }
  return out;
}

/* Every /Name a page's content streams mention, or null when one of them
   cannot be read — and then nothing is pruned. */
async function contentNames(doc, contents) {
  let list = await doc.resolve(contents);
  if (list === undefined || list === null) return new Set();
  if (!Array.isArray(list)) list = [contents];
  const names = new Set();
  for (const c of list) {
    const s = await doc.resolve(c);
    if (!(s instanceof PDFStream)) return null;
    let filters = await doc.resolve(s.dict.Filter);
    filters = filters === undefined || filters === null ? [] : Array.isArray(filters) ? filters : [filters];
    for (const f of filters) {
      const fn = await doc.resolve(f);
      if (!(fn instanceof Name) || !/^(FlateDecode|Fl|ASCIIHexDecode|AHx|ASCII85Decode|A85)$/.test(fn.name)) return null;
    }
    let data;
    try { data = await doc.decodeStream(s); } catch (e) { return null; }
    const text = latin1(data);
    const re = /\/([^\s\/\[\]()<>{}%]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      names.add(m[1].replace(/#([0-9a-fA-F]{2})/g, (x, h) => String.fromCharCode(parseInt(h, 16))));
    }
  }
  return names;
}

const PRUNABLE = ['XObject', 'Font', 'ExtGState', 'Pattern', 'Shading', 'ColorSpace', 'Properties'];

/**
 * A page's resources without the entries its content never names.
 *
 * Many writers give every page one shared resource dictionary listing every
 * image and font in the file. Copied whole, it would carry a deleted page's
 * scanned image into a file that no longer has the page. Returns the source
 * value untouched when nothing is dropped, so sharing survives where it is
 * harmless, and when anything is in doubt: a content stream it cannot read,
 * or a form or Type 3 font with no resources of its own, which draws with the
 * page's.
 */
async function pruneResources(doc, res, contents) {
  const d = await doc.resolve(res);
  if (!isDict(d)) return res;
  const used = await contentNames(doc, contents);
  if (!used) return res;
  const out = Object.create(null);
  let dropped = 0;
  for (const k of Object.keys(d)) {
    const sub = await doc.resolve(d[k]);
    if (PRUNABLE.indexOf(k) < 0 || !isDict(sub)) { out[k] = d[k]; continue; }
    const keep = Object.create(null);
    for (const n of Object.keys(sub)) {
      if (!used.has(n)) { dropped++; continue; }
      const o = await doc.resolve(sub[n]);
      const od = o instanceof PDFStream ? o.dict : o;
      if (isDict(od) && od.Resources === undefined) {
        const st = await doc.resolve(od.Subtype);
        if (isName(st, 'Form') || isName(st, 'Type3')) return res;
      }
      keep[n] = sub[n];
    }
    out[k] = keep;
  }
  return dropped ? out : res;
}

/* ============================================================
   Bookmarks and form fields
   ============================================================ */

/** A source outline, keeping entries whose destination survives; children of a dropped entry move up. */
async function outlineEntries(doc, st, first, depth, seen) {
  const out = [];
  let ref = first;
  while (ref !== undefined && ref !== null && depth < 32 && seen.size < 100000) {
    if (ref instanceof Ref) { if (seen.has(ref.num)) break; seen.add(ref.num); }
    const it = await doc.resolve(ref);
    if (!isDict(it)) break;
    const children = await outlineEntries(doc, st, it.First, depth + 1, seen);
    const count = Number(await doc.resolve(it.Count)) || 0;
    const e = { st, title: await doc.resolve(it.Title), C: it.C, F: it.F, open: count > 0, children };
    let target = null, other = null;
    if (it.Dest !== undefined) target = await resolveDest(doc, st, it.Dest);
    else {
      const act = await doc.resolve(it.A);
      if (isDict(act)) {
        if (isName(await doc.resolve(act.S), 'GoTo')) target = await resolveDest(doc, st, act.D);
        else other = it.A;
      }
    }
    if (target) {
      if (target.ok && st.kept.has(target.page)) { e.dest = target.array; out.push(e); }
      else out.push.apply(out, children);
    } else if (other) { e.action = other; out.push(e); }
    else if (children.length) out.push(e);
    ref = it.Next;
  }
  return out;
}

const visibleCount = (list) => list.reduce((s, e) => s + 1 + (e.open ? visibleCount(e.children) : 0), 0);

async function writeOutline(writer, top) {
  const rootNum = writer.alloc();
  const write = async (list, parentNum) => {
    const nums = list.map(() => writer.alloc());
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const d = Object.create(null);
      d.Title = e.title && e.title.__string !== undefined ? e.title : pdfString(String(e.title || ''));
      d.Parent = new Ref(parentNum, 0);
      if (i > 0) d.Prev = new Ref(nums[i - 1], 0);
      if (i < list.length - 1) d.Next = new Ref(nums[i + 1], 0);
      if (e.children.length) {
        const kids = await write(e.children, nums[i]);
        d.First = kids[0];
        d.Last = kids[kids.length - 1];
        const n = visibleCount(e.children);
        d.Count = e.open ? n : -n;
      }
      if (e.destOut) d.Dest = e.destOut;
      else if (e.dest) d.Dest = await copyObject(e.st.doc, writer, e.dest, e.st.map, 0, e.st.ctx);
      else if (e.action) {
        const a = await copyObject(e.st.doc, writer, e.action, e.st.map, 0, e.st.ctx);
        if (a !== BARRED) d.A = a;
      }
      for (const k of ['C', 'F']) {
        if (e[k] === undefined) continue;
        const c = await copyObject(e.st.doc, writer, e[k], e.st.map, 0, e.st.ctx);
        if (c !== BARRED) d[k] = c;
      }
      writer.set(nums[i], d);
    }
    return nums.map((n) => new Ref(n, 0));
  };
  const kids = await write(top, rootNum);
  writer.set(rootNum, {
    Type: new Name('Outlines'), First: kids[0], Last: kids[kids.length - 1], Count: visibleCount(top)
  });
  return rootNum;
}

/**
 * A form holding the fields that still have a widget on a kept page. Fields
 * from different files that share a name are renamed (name_2, name_3…), or a
 * viewer would treat them as one field and type into both at once.
 */
async function buildForm(writer, states) {
  const fields = [], co = [];
  const taken = new Set();
  let da, q, dr = null, need = false;
  for (const [doc, st] of states) {
    const af = st.acroForm;
    if (!af || !st.aliveFields.size) continue;
    const list = await doc.resolve(af.Fields);
    if (!Array.isArray(list)) continue;
    const mine = new Set();
    for (const r of list) {
      if (!(r instanceof Ref) || !st.aliveFields.has(r.num)) continue;
      const c = await copyObject(doc, writer, r, st.map, 0, st.ctx);
      if (!(c instanceof Ref)) continue;
      const d = writer.objects[c.num];
      if (isDict(d) && d.T && d.T.__string !== undefined) {
        const t = decodePdfString(d.T.__string);
        let name = t, k = 2;
        while (taken.has(name)) name = t + '_' + k++;
        if (name !== t) d.T = pdfString(name);
        mine.add(name);
      }
      fields.push(c);
    }
    mine.forEach((n) => taken.add(n));
    if (da === undefined && af.DA !== undefined) da = await copyObject(doc, writer, af.DA, st.map, 0, st.ctx);
    if (q === undefined && af.Q !== undefined) q = await copyObject(doc, writer, af.Q, st.map, 0, st.ctx);
    if (af.DR !== undefined) {
      const c = await copyObject(doc, writer, af.DR, st.map, 0, st.ctx);
      const cd = c instanceof Ref ? writer.objects[c.num] : c;
      if (!dr) dr = isDict(cd) ? cd : null;
      else if (isDict(cd)) {
        /* fonts the later file's fields name, added where the first file has no font of that name */
        const into = dr.Font instanceof Ref ? writer.objects[dr.Font.num] : dr.Font;
        const from = cd.Font instanceof Ref ? writer.objects[cd.Font.num] : cd.Font;
        if (isDict(from)) {
          if (!isDict(into)) dr.Font = Object.assign(Object.create(null), from);
          else for (const k of Object.keys(from)) if (into[k] === undefined) into[k] = from[k];
        }
      }
    }
    if ((await doc.resolve(af.NeedAppearances)) === true) need = true;
    if (st.liveWidgets.some((w) => w.AP === undefined)) need = true;
    const order = await doc.resolve(af.CO);
    if (Array.isArray(order)) {
      for (const r of order) {
        if (!(r instanceof Ref) || !st.aliveFields.has(r.num)) continue;
        const c = await copyObject(doc, writer, r, st.map, 0, st.ctx);
        if (c instanceof Ref) co.push(c);
      }
    }
  }
  if (!fields.length) return null;
  const form = { Fields: fields };
  if (da !== undefined && da !== BARRED) form.DA = da;
  if (dr) form.DR = dr;
  if (q !== undefined && q !== BARRED) form.Q = q;
  if (co.length) form.CO = co;
  if (need) form.NeedAppearances = true;
  return form;
}

/**
 * Assemble a new PDF from a list of {doc, pageIndex, rotate, overlay}
 * instructions. This is the shared core of merge, split, extract, delete,
 * reorder, rotate and every tool that stamps a page.
 *
 * What the output carries, besides the pages:
 *   - a page's annotations, minus links to pages the output leaves out; a
 *     link or bookmark to a kept page points at its new page;
 *   - bookmarks whose destination survives (options.outline 'per-file', for
 *     a merge, puts each source's under an entry named after it — from
 *     options.names, a Map of doc -> name);
 *   - the form, with the fields that still have a widget on a kept page;
 *   - options.info, when given; with no options.info and one source file,
 *     that file's own Info dictionary;
 *   - the XMP metadata of options.xmp (a source doc), or by default of the
 *     only source file; false writes none.
 * Nothing that belongs only to a page left out is copied: see copyObject.
 *
 * overlay: { content, fontKey, fontName, needsGS, opacity, upright }. The
 * page's own content is wrapped in q … Q so whatever state it leaves cannot
 * shift the overlay; with upright, the overlay is drawn in the visible,
 * upright frame pageFrame() describes.
 */
async function assemble(items, options) {
  const opts = Object.assign({}, options || {});
  if (PREVIEW) {
    /* one page, as it will be written, and nothing a preview cannot show */
    const want = PREVIEW.pageIndex;
    const first = items.length ? items[0].doc : null;
    const hit = items.filter((it) => it.doc === (PREVIEW.doc || first) && it.pageIndex === want).slice(0, 1);
    items = hit.length ? hit : items.slice(0, 1);
    opts.outline = 'none'; opts.noForm = true; opts.xmp = null; opts.info = {};
  }
  const writer = new PDFWriter();
  const catalogNum = writer.alloc();
  const pagesNum = writer.alloc();
  const kids = [];

  /* Number every output page before anything is copied, so a link or a
     bookmark to a page the output keeps can point at its new object. */
  const plan = [];
  const states = new Map();       // doc -> what is kept of it, and how it maps
  for (const item of items) {
    const pages = await item.doc.getPages();
    const page = pages[item.pageIndex];
    if (!page) continue;
    let st = states.get(item.doc);
    if (!st) { st = newSource(item.doc); states.set(item.doc, st); }
    const num = writer.alloc();
    plan.push({ item, page, num, st });
    st.keptIdx.add(item.pageIndex);
    if (page.ref && !st.kept.has(page.ref.num)) st.kept.set(page.ref.num, num);
    if (st.first === null) st.first = num;
  }
  if (!plan.length) throw new Error('No pages were selected.');
  for (const [doc, st] of states) await prepareSource(doc, st);
  if (opts.replace) {
    /* compression swaps some objects (pictures) for smaller ones as they are copied */
    for (const [doc, st] of states) {
      const swap = opts.replace.get(doc);
      if (!swap || !st.ctx) continue;
      const inner = st.ctx.rewrite;
      st.ctx.rewrite = async (num, v) => swap.has(num) ? swap.get(num) : (inner ? inner(num, v) : v);
    }
  }

  let isolate = 0;                // one shared "q" stream for every stamped page
  const fmt = (v) => String(Number(Number(v).toFixed(4)));

  let written = 0;
  for (const { item, page, num, st } of plan) {
    const doc = item.doc;
    const map = st.map;
    const src = page.dict;
    const out = Object.create(null);
    out.Type = new Name('Page');

    for (const k of ['Resources', 'MediaBox', 'CropBox', 'BleedBox', 'TrimBox',
                     'ArtBox', 'Contents', 'Annots', 'Group', 'UserUnit']) {
      let v = src[k] !== undefined ? src[k] : page.inherited[k];
      if (v === undefined) continue;
      if (k === 'Annots') {
        v = await keptAnnots(doc, st, v, item.dropAnnots);
        if (!v || !v.length) continue;
      }
      if (k === 'Resources') v = await pruneResources(doc, v, src.Contents);
      const c = await copyObject(doc, writer, v, map, 0, st.ctx);
      if (c !== BARRED && c !== undefined) out[k] = c;
    }
    if (out.MediaBox === undefined) out.MediaBox = [0, 0, 595.28, 841.89];
    if (Array.isArray(item.cropBox) && item.cropBox.length === 4) {
      /* a new visible area; the boxes printers use must lie inside it */
      out.CropBox = item.cropBox.map((v) => Number(Number(v).toFixed(3)));
      delete out.TrimBox; delete out.BleedBox; delete out.ArtBox;
    }
    if (out.Resources === undefined) out.Resources = Object.create(null);

    const baseRotate = Number(src.Rotate !== undefined ? src.Rotate : page.inherited.Rotate) || 0;
    const extra = Number(item.rotate) || 0;
    const rot = (((baseRotate + extra) % 360) + 360) % 360;
    if (rot) out.Rotate = rot;

    if (item.overlay) {
      let body = item.overlay.content;
      if (item.overlay.upright) {
        const fr = await pageFrame(doc, item.pageIndex, item.rotate);
        if (fr.matrix.join(' ') !== '1 0 0 1 0 0') {
          body = 'q\n' + fr.matrix.map(fmt).join(' ') + ' cm\n' + body + '\nQ\n';
        }
      }
      if (!isolate) isolate = writer.add(new PDFStream(Object.create(null), bytesOf('q\n')));
      const streamNum = writer.add(new PDFStream(
        Object.create(null), bytesOf('\nQ\n' + body)));
      let existing = out.Contents;
      if (existing instanceof Ref && Array.isArray(writer.objects[existing.num])) existing = writer.objects[existing.num];
      const arr = existing === undefined ? []
        : Array.isArray(existing) ? existing.slice() : [existing];
      out.Contents = [new Ref(isolate, 0)].concat(arr, [new Ref(streamNum, 0)]);

      /* /Resources and its sub-dictionaries are usually indirect objects in
         real documents, and copyObject preserves that. Writing a key onto a
         Ref would be lost at serialisation — the overlay would then name a
         font that the page does not declare, and the watermark or page number
         would silently not render. Resolve through the writer to the real
         dictionary before adding anything. */
      const deref = (v) => (v instanceof Ref && isDict(writer.objects[v.num]))
        ? writer.objects[v.num] : v;

      let res = deref(out.Resources);
      if (!isDict(res)) { res = Object.create(null); out.Resources = res; }

      let font = deref(res.Font);
      if (!isDict(font)) { font = Object.create(null); res.Font = font; }
      if (item.overlay.fontKey && !font[item.overlay.fontKey]) {
        /* one font object per face for the whole file, not one per page */
        const face = item.overlay.fontName || 'Helvetica';
        writer._base14 = writer._base14 || Object.create(null);
        if (!writer._base14[face]) {
          writer._base14[face] = new Ref(writer.add({
            Type: new Name('Font'), Subtype: new Name('Type1'),
            BaseFont: new Name(face), Encoding: new Name('WinAnsiEncoding')
          }), 0);
        }
        font[item.overlay.fontKey] = writer._base14[face];
      }
      if (item.overlay.xobjects) {
        /* objects of the source drawn by the overlay (a form field's
           appearance, when flattening), copied like the rest of the page */
        let xo = deref(res.XObject);
        if (!isDict(xo)) { xo = Object.create(null); res.XObject = xo; }
        for (const [key, src] of Object.entries(item.overlay.xobjects)) {
          let c = await copyObject(doc, writer, src, st.map, 0, st.ctx);
          if (c instanceof PDFStream) c = new Ref(writer.add(c), 0);
          if (c instanceof Ref) xo[key] = c;
        }
      }
      if (item.overlay.gs) {
        let eg2 = deref(res.ExtGState);
        if (!isDict(eg2)) { eg2 = Object.create(null); res.ExtGState = eg2; }
        for (const [key, a] of Object.entries(item.overlay.gs)) {
          eg2[key] = new Ref(writer.add({ Type: new Name('ExtGState'), ca: a, CA: a }), 0);
        }
      }
      if (item.overlay.images) {
        let xo = deref(res.XObject);
        if (!isDict(xo)) { xo = Object.create(null); res.XObject = xo; }
        for (const [key, prep] of Object.entries(item.overlay.images)) xo[key] = imageRef(writer, prep);
      }
      if (item.overlay.fonts) {
        for (const [key, ref] of Object.entries(item.overlay.fonts)) font[key] = typeof ref === 'function' ? ref(writer) : ref;
      }
      if (item.overlay.needsGS) {
        let eg = deref(res.ExtGState);
        if (!isDict(eg)) { eg = Object.create(null); res.ExtGState = eg; }
        if (!eg.MVRgs) {
          eg.MVRgs = new Ref(writer.add({
            Type: new Name('ExtGState'), ca: item.overlay.opacity, CA: item.overlay.opacity
          }), 0);
        }
      }
    }

    out.Parent = new Ref(pagesNum, 0);
    writer.set(num, out);
    kids.push(new Ref(num, 0));
    progress(++written, plan.length, 'page');
  }

  writer.set(pagesNum, { Type: new Name('Pages'), Kids: kids, Count: kids.length });
  const catalog = { Type: new Name('Catalog'), Pages: new Ref(pagesNum, 0) };

  /* bookmarks */
  const top = [];
  let anyOutline = false;
  for (const [doc, st] of (opts.outline === 'none' ? [] : states)) {
    const ol = await doc.resolve(st.root.Outlines);
    const entries = isDict(ol) ? await outlineEntries(doc, st, ol.First, 0, new Set()) : [];
    if (entries.length) anyOutline = true;
    if (opts.outline === 'per-file') {
      const name = String((opts.names && opts.names.get(doc)) || 'Document').replace(/\.pdf$/i, '');
      top.push({ st, title: name, destOut: [new Ref(st.first, 0), new Name('Fit')], open: true, children: entries });
    } else top.push.apply(top, entries);
  }
  if (anyOutline && top.length) catalog.Outlines = new Ref(await writeOutline(writer, top), 0);

  /* the form */
  const form = opts.noForm ? null : await buildForm(writer, states);
  if (form) catalog.AcroForm = new Ref(writer.add(form), 0);

  const only = states.size === 1 ? states.keys().next().value : null;

  /* XMP metadata */
  const xmpDoc = opts.xmp === undefined ? only : (opts.xmp || null);
  const xst = xmpDoc && states.get(xmpDoc);
  if (xst && xst.root.Metadata !== undefined) {
    const c = await copyObject(xmpDoc, writer, xst.root.Metadata, xst.map, 0, xst.ctx);
    if (c instanceof Ref) catalog.Metadata = c;
    else if (c instanceof PDFStream) catalog.Metadata = new Ref(writer.add(c), 0);
  }

  writer.set(catalogNum, catalog);

  let infoRef = null;
  if (opts.info === undefined) {
    const ist = only && states.get(only);
    if (ist && only.trailer && only.trailer.Info !== undefined) {
      const c = await copyObject(only, writer, only.trailer.Info, ist.map, 0, ist.ctx);
      if (c instanceof Ref) infoRef = c;
      else if (isDict(c) && Object.keys(c).length) infoRef = new Ref(writer.add(c), 0);
    }
  } else if (opts.info && Object.keys(opts.info).length) {
    const info = Object.create(null);
    for (const [k, v] of Object.entries(opts.info)) {
      if (v !== undefined && v !== null && String(v) !== '') info[k] = pdfString(String(v));
    }
    if (Object.keys(info).length) infoRef = new Ref(writer.add(info), 0);
  }

  if (opts.finish) await opts.finish(writer);
  if (opts.protect) return encryptAndBuild(writer, new Ref(catalogNum, 0), infoRef, opts.protect);
  if (opts.compact) return compactBuild(writer, new Ref(catalogNum, 0), infoRef);
  return writer.build(new Ref(catalogNum, 0), infoRef, opts.version || '1.7');
}

/* ============================================================
   Writing an encrypted file
   ============================================================ */

function randomBytes(n) {
  const out = new Uint8Array(n);
  const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
  if (!c) throw new Error('This browser has no secure random numbers, so it cannot encrypt.');
  c.getRandomValues(out);
  return out;
}
const hexOf = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Encrypt every string and stream the writer holds with the standard
 * security handler, then write the file with /Encrypt and /ID in its
 * trailer. options: { userPassword, ownerPassword, permissions, method:
 * 'AES-256' | 'AES-128', encryptMetadata }.
 */
function encryptAndBuild(writer, rootRef, infoRef, options) {
  if (!CRYPT) throw new Error('This copy of the engine cannot encrypt.');
  const id0 = randomBytes(16);
  const { handler, encryptDict } = CRYPT.createHandler({
    userPassword: options.userPassword || '', ownerPassword: options.ownerPassword || '',
    permissions: options.permissions || {}, method: options.method === 'AES-128' ? 'AES-128' : 'AES-256',
    id0, encryptMetadata: options.encryptMetadata !== false, random: randomBytes
  });
  const walk = (v, num) => {
    if (!v || typeof v !== 'object') return;
    if (v.__string !== undefined) { v.__string = CRYPT.encryptBytes(handler, num, 0, v.__string, 'string', randomBytes); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, num); return; }
    if (v instanceof PDFStream) { walk(v.dict, num); return; }
    if (isDict(v)) for (const k of Object.keys(v)) walk(v[k], num);
  };
  for (let num = 1; num < writer.objects.length; num++) {
    const v = writer.objects[num];
    if (v === undefined || v === null) continue;
    if (v instanceof PDFStream) {
      const kind = isName(v.dict.Type, 'Metadata') ? 'metadata' : isName(v.dict.Type, 'EmbeddedFile') ? 'embeddedFile' : 'stream';
      walk(v.dict, num);
      writer.objects[num] = new PDFStream(v.dict, CRYPT.encryptBytes(handler, num, 0, v.raw, kind, randomBytes));
    } else walk(v, num);
  }
  const toCore = (v) => {
    if (v instanceof Uint8Array) return { __raw: '<' + hexOf(v) + '>' };
    if (Array.isArray(v)) return v.map(toCore);
    if (typeof v === 'string') return new Name(v);
    if (v && typeof v === 'object') { const o = Object.create(null); for (const k of Object.keys(v)) o[k] = toCore(v[k]); return o; }
    return v;
  };
  const encNum = writer.add(toCore(encryptDict));
  const idHex = { __raw: '<' + hexOf(handler.id0 || id0) + '>' };
  return writer.build(rootRef, infoRef, '1.7', { Encrypt: new Ref(encNum, 0), ID: [idHex, { __raw: '<' + hexOf(randomBytes(16)) + '>' }] });
}

/**
 * The whole document again, every page, its bookmarks, form and metadata,
 * encrypted with a password (protect), or written plain (unlock: the
 * document was opened with its password, so it is already decrypted).
 */
async function protectDocument(doc, options) {
  const n = await doc.pageCount();
  const items = Array.from({ length: n }, (_, i) => ({ doc, pageIndex: i }));
  return assemble(items, options && options.protect === false ? {} : { protect: options || {} });
}

/* ============================================================
   Compression
   ============================================================ */

/**
 * The writer's objects as a PDF 1.5 file: every object that is not a stream
 * packed into compressed object streams, and a compressed cross-reference
 * stream in place of the table. For a text-heavy file this is where most of
 * the structure's bytes go: a classic table costs 20 bytes an object and
 * every dictionary is stored as plain text.
 */
async function compactBuild(writer, rootRef, infoRef) {
  const objs = writer.objects;
  const size0 = objs.length;
  const packable = [];
  for (let i = 1; i < size0; i++) {
    const v = objs[i];
    if (v === undefined || v instanceof PDFStream) continue;
    packable.push(i);
  }
  const where = new Map();          /* object number -> [stream number, index] */
  const streams = [];
  for (let k = 0; k < packable.length; k += 200) {
    const group = packable.slice(k, k + 200);
    const bodies = group.map((i) => writer.serialiseValue(objs[i]));
    let head = '', off = 0;
    group.forEach((num, j) => { head += num + ' ' + off + ' '; off += bodies[j].length + 1; });
    const first = head.length;
    const data = bytesOf(head + bodies.join('\n') + '\n');
    const z = await deflate(data);
    const num = writer.add(null);
    streams.push({ num, dict: { Type: new Name('ObjStm'), N: group.length, First: first, Filter: new Name('FlateDecode') }, raw: z });
    group.forEach((i, j) => where.set(i, [num, j]));
  }
  for (const st of streams) objs[st.num] = new PDFStream(st.dict, st.raw);

  const chunks = [];
  let len = 0;
  const push = (x) => { const a = typeof x === 'string' ? bytesOf(x) : x; chunks.push(a); len += a.length; };
  push('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
  const offsets = new Map();
  for (let i = 1; i < objs.length; i++) {
    const v = objs[i];
    if (!(v instanceof PDFStream)) continue;
    offsets.set(i, len);
    const d = Object.assign(Object.create(null), v.dict);
    d.Length = v.raw.length;
    push(i + ' 0 obj\n' + writer.serialiseValue(d) + '\nstream\n');
    push(v.raw);
    push('\nendstream\nendobj\n');
  }
  const xrefNum = objs.length;
  const size = xrefNum + 1;
  const rows = new Uint8Array(size * 7);
  for (let i = 0; i < size; i++) {
    const r = i * 7;
    if (i === 0) { rows[r] = 0; rows[r + 5] = 0xff; rows[r + 6] = 0xff; continue; }
    if (offsets.has(i) || i === xrefNum) {
      const off = i === xrefNum ? len : offsets.get(i);
      rows[r] = 1; rows[r + 1] = (off >>> 24) & 255; rows[r + 2] = (off >>> 16) & 255; rows[r + 3] = (off >>> 8) & 255; rows[r + 4] = off & 255;
    } else if (where.has(i)) {
      const [sn, idx] = where.get(i);
      rows[r] = 2; rows[r + 1] = (sn >>> 24) & 255; rows[r + 2] = (sn >>> 16) & 255; rows[r + 3] = (sn >>> 8) & 255; rows[r + 4] = sn & 255;
      rows[r + 5] = (idx >>> 8) & 255; rows[r + 6] = idx & 255;
    }
  }
  const z = await deflate(rows);
  const xd = { Type: new Name('XRef'), Size: size, W: [1, 4, 2], Root: rootRef, Filter: new Name('FlateDecode'), Length: z.length };
  if (infoRef) xd.Info = infoRef;
  const xrefAt = len;
  push(xrefNum + ' 0 obj\n' + writer.serialiseValue(xd) + '\nstream\n');
  push(z);
  push('\nendstream\nendobj\nstartxref\n' + xrefAt + '\n%%EOF\n');
  const out = new Uint8Array(len);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]
];

async function streamBytes(doc, contents) {
  const list = await doc.resolve(contents);
  const parts = [];
  for (const c of Array.isArray(list) ? list : [list]) {
    const st = await doc.resolve(c);
    if (st instanceof PDFStream) { try { parts.push(await doc.decodeStream(st)); } catch (e) { /* unreadable: skip */ } }
  }
  const len = parts.reduce((n, x) => n + x.length + 1, 0);
  const out = new Uint8Array(len);
  let at = 0;
  for (const x of parts) { out.set(x, at); at += x.length; out[at++] = 10; }
  return out;
}

/**
 * How large each picture is drawn, in points, the largest use winning:
 * the page content is walked for q, Q, cm and Do (into forms too), which is
 * all the geometry a picture's size depends on.
 */
async function drawnSizes(doc, res, bytes, ctm, out, depth) {
  if (depth > 8 || !bytes || !bytes.length) return;
  const resources = await doc.resolve(res);
  const xobjects = isDict(resources) ? await doc.resolve(resources.XObject) : null;
  const lex = new Lexer(bytes, 0);
  const stack = [];
  let m = ctm, ops = [];
  for (let guard = 0; guard < 5e6; guard++) {
    let v;
    try { v = lex.parse(0); } catch (e) { lex.p++; ops = []; continue; }
    if (v === undefined) { if (lex.p >= bytes.length) break; ops = []; continue; }
    if (!v || v.__keyword === undefined) { ops.push(v); continue; }
    const op = v.__keyword;
    if (op === 'q') stack.push(m);
    else if (op === 'Q') m = stack.length ? stack.pop() : ctm;
    else if (op === 'cm' && ops.length >= 6) m = mul(ops.slice(-6).map(Number), m);
    else if (op === 'BI') {
      /* an inline image: its data is binary, skip to EI */
      const at = latin1(bytes, lex.p).search(/\sEI[\s]/);
      lex.p = at < 0 ? bytes.length : lex.p + at + 4;
    } else if (op === 'Do' && ops.length && xobjects && isDict(xobjects)) {
      const nm = ops[ops.length - 1];
      const ref = nm instanceof Name ? xobjects[nm.name] : null;
      const x = await doc.resolve(ref);
      if (x instanceof PDFStream) {
        if (isName(x.dict.Subtype, 'Image') && ref instanceof Ref) {
          const w = Math.hypot(m[0], m[1]), h = Math.hypot(m[2], m[3]);
          const was = out.get(ref.num);
          if (!was || w * h > was.w * was.h) out.set(ref.num, { w, h });
        } else if (isName(x.dict.Subtype, 'Form')) {
          const fm = await doc.resolve(x.dict.Matrix);
          const fmat = Array.isArray(fm) && fm.length === 6 ? fm.map(Number) : [1, 0, 0, 1, 0, 0];
          let fb = null;
          try { fb = await doc.decodeStream(x); } catch (e) { fb = null; }
          await drawnSizes(doc, x.dict.Resources !== undefined ? x.dict.Resources : res, fb, mul(fmat, m), out, depth + 1);
        }
      }
    }
    ops = [];
  }
}

/** A picture, decoded to RGBA for a canvas, or null when it cannot be. */
async function imageToBitmap(doc, stm) {
  if (typeof createImageBitmap !== 'function') return null;
  const d = stm.dict;
  let filters = await doc.resolve(d.Filter);
  if (filters && !Array.isArray(filters)) filters = [filters];
  const names = (filters || []).map((f) => f && f.name);
  if (names.length && /^(DCTDecode|DCT)$/.test(names[names.length - 1]) &&
      names.slice(0, -1).every((n) => /^(FlateDecode|Fl|ASCII85Decode|A85|ASCIIHexDecode|AHx)$/.test(n))) {
    /* a JPEG, possibly wrapped in ASCII85 or Flate (reportlab writes
       [/ASCII85Decode /DCTDecode]): decodeStream undoes the wrappers and
       stops at the JPEG */
    const jpeg = names.length === 1 ? stm.raw : await doc.decodeStream(stm);
    return createImageBitmap(new Blob([jpeg], { type: 'image/jpeg' }));
  }
  if (names.some((n) => !/^(FlateDecode|Fl|ASCII85Decode|A85|ASCIIHexDecode|AHx)$/.test(n))) return null;
  const W = Number(await doc.resolve(d.Width)), H = Number(await doc.resolve(d.Height));
  const comps = (await colourComponents(doc, d.ColorSpace));
  if (!comps || comps === 4) return null;
  const data = await doc.decodeStream(stm);
  if (data.length < W * H * comps) return null;
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0, j = 0; i < W * H; i++, j += comps) {
    const k = i * 4;
    if (comps === 1) { rgba[k] = rgba[k + 1] = rgba[k + 2] = data[j]; }
    else { rgba[k] = data[j]; rgba[k + 1] = data[j + 1]; rgba[k + 2] = data[j + 2]; }
    rgba[k + 3] = 255;
  }
  return createImageBitmap(new ImageData(rgba, W, H));
}
async function colourComponents(doc, cs) {
  const v = await doc.resolve(cs);
  if (isName(v, 'DeviceRGB') || isName(v, 'CalRGB')) return 3;
  if (isName(v, 'DeviceGray') || isName(v, 'CalGray')) return 1;
  if (isName(v, 'DeviceCMYK')) return 4;
  if (Array.isArray(v) && isName(v[0], 'ICCBased')) {
    const st = await doc.resolve(v[1]);
    const n = st instanceof PDFStream ? Number(await doc.resolve(st.dict.N)) : 0;
    return n === 1 || n === 3 || n === 4 ? n : null;
  }
  if (Array.isArray(v) && (isName(v[0], 'CalRGB'))) return 3;
  if (Array.isArray(v) && (isName(v[0], 'CalGray'))) return 1;
  return null;
}

/**
 * Make a PDF smaller: pictures drawn at more than the chosen resolution are
 * scaled down and pictures re-encoded as JPEG at the chosen quality (only
 * where that is actually smaller), uncompressed streams are deflated,
 * identical streams and fonts are stored once, objects nothing uses are left
 * out (assemble copies only what the pages reach), and the metadata is
 * removed on request. Options: { dpi, quality (0.1–1), images: true,
 * metadata: 'keep' | 'strip', greyscale: false }.
 * Returns { bytes, report }.
 */
async function compressDocument(doc, options) {
  const o = Object.assign({ dpi: 150, quality: 0.75, images: true, metadata: 'strip' }, options || {});
  const pages = await doc.getPages();
  const report = { images: 0, recoded: 0, downsampled: 0, kept: {}, imageBytesBefore: 0, imageBytesAfter: 0, deflated: 0, merged: 0 };
  const keep = (why) => { report.kept[why] = (report.kept[why] || 0) + 1; };

  /* 1. how big each picture is drawn */
  const sizes = new Map();
  for (let i = 0; i < pages.length; i++) {
    progress(i, pages.length, 'Measuring the pictures on page ' + (i + 1));
    const pg = pages[i];
    const res = pg.dict.Resources !== undefined ? pg.dict.Resources : pg.inherited.Resources;
    let bytes = null;
    try { bytes = await streamBytes(doc, pg.dict.Contents); } catch (e) { bytes = null; }
    try { await drawnSizes(doc, res, bytes, [1, 0, 0, 1, 0, 0], sizes, 0); } catch (e) { /* a page we cannot read keeps its pictures */ }
  }

  /* 2. pictures, re-encoded where it pays */
  const replace = new Map();
  const masks = new Set();
  for (const v of doc.objects.values()) {
    const d = v instanceof PDFStream ? v.dict : null;
    if (d && d.SMask instanceof Ref) masks.add(d.SMask.num);
    if (d && d.Mask instanceof Ref) masks.add(d.Mask.num);
  }
  const canEncode = typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function';
  const imgs = [...doc.objects].filter(([n, v]) => v instanceof PDFStream && isName(v.dict.Subtype, 'Image') && !masks.has(n));
  let done = 0;
  for (const [num, stm] of imgs) {
    progress(done++, imgs.length, 'Pictures');
    report.images++;
    report.imageBytesBefore += stm.raw.length;
    const d = stm.dict;
    const fallback = () => { report.imageBytesAfter += stm.raw.length; };
    if (!o.images) { keep('pictures left as they are'); fallback(); continue; }
    if (!canEncode) { keep('this browser cannot re-encode pictures here'); fallback(); continue; }
    if ((await doc.resolve(d.ImageMask)) === true) { keep('a stencil mask'); fallback(); continue; }
    if (Number(await doc.resolve(d.BitsPerComponent)) !== 8) { keep('not 8 bits per sample'); fallback(); continue; }
    if (d.Decode !== undefined || Array.isArray(await doc.resolve(d.Mask))) { keep('a colour key or decode array'); fallback(); continue; }
    const comps = await colourComponents(doc, d.ColorSpace);
    if (comps !== 1 && comps !== 3) { keep(comps === 4 ? 'CMYK' : 'an unusual colour space'); fallback(); continue; }
    const W = Number(await doc.resolve(d.Width)), H = Number(await doc.resolve(d.Height));
    if (!(W > 0 && H > 0)) { fallback(); continue; }
    const drawn = sizes.get(num);
    let scale = 1;
    if (drawn && drawn.w > 0 && drawn.h > 0) {
      const tw = drawn.w / 72 * o.dpi, th = drawn.h / 72 * o.dpi;
      scale = Math.min(1, Math.max(tw / W, th / H));
      if (scale > 0.87) scale = 1;            /* not worth a generation of loss */
    }
    if (scale === 1 && stm.raw.length < 24 * 1024) { keep('already small'); fallback(); continue; }
    let bmp = null;
    try { bmp = await imageToBitmap(doc, stm); } catch (e) { bmp = null; }
    if (!bmp) { keep('a format the browser cannot decode (JPEG 2000, JBIG2, CCITT …)'); fallback(); continue; }
    const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale));
    const cv = new OffscreenCanvas(w, h);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    let blob;
    try { blob = await cv.convertToBlob({ type: 'image/jpeg', quality: Math.max(0.1, Math.min(1, o.quality)) }); }
    catch (e) { keep('could not be encoded'); fallback(); continue; }
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    if (blob.type !== 'image/jpeg' || jpeg.length >= stm.raw.length * 0.95) { keep('re-encoding would not make it smaller'); fallback(); continue; }
    const nd = Object.create(null);
    for (const k of Object.keys(d)) if (!/^(Filter|DecodeParms|DP|Length|Width|Height|BitsPerComponent|ColorSpace|Intent)$/.test(k)) nd[k] = d[k];
    nd.Width = w; nd.Height = h; nd.BitsPerComponent = 8;
    nd.ColorSpace = new Name('DeviceRGB');
    nd.Filter = new Name('DCTDecode');
    replace.set(num, new PDFStream(nd, jpeg));
    report.recoded++;
    if (scale < 1) report.downsampled++;
    report.imageBytesAfter += jpeg.length;
  }

  /* 3. write it again, deflating and folding duplicates on the way out */
  const finish = async (writer) => {
    const fnv = (b) => { let h = 2166136261; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
    const all = writer.objects;
    let k = 0;
    for (let i = 1; i < all.length; i++) {
      const v = all[i];
      if (!(v instanceof PDFStream) || v.dict.Filter !== undefined || v.raw.length < 64) continue;
      if (isName(v.dict.Type, 'Metadata') || isName(v.dict.Type, 'XRef')) continue;
      if (++k % 50 === 0) progress(i, all.length, 'Compressing streams');
      const z = await deflate(v.raw);
      if (z.length < v.raw.length) {
        const dd = Object.assign(Object.create(null), v.dict);
        dd.Filter = new Name('FlateDecode');
        all[i] = new PDFStream(dd, z);
        report.deflated++;
      }
    }
    /* identical streams, and identical fonts, descriptors and graphics states */
    const FOLD = new Set(['Font', 'FontDescriptor', 'ExtGState']);
    for (let pass = 0; pass < 3; pass++) {
      const seen = new Map(), alias = new Map();
      for (let i = 1; i < all.length; i++) {
        const v = all[i];
        let key = null;
        if (v instanceof PDFStream) key = 's' + writer.serialiseValue(v.dict) + '|' + v.raw.length + '|' + fnv(v.raw);
        else if (isDict(v) && v.Type instanceof Name && FOLD.has(v.Type.name)) key = 'd' + writer.serialiseValue(v);
        if (!key) continue;
        const first = seen.get(key);
        if (first === undefined) { seen.set(key, i); continue; }
        if (v instanceof PDFStream) {
          const a = all[first].raw, b = v.raw;
          let same = a.length === b.length;
          for (let j = 0; same && j < a.length; j++) if (a[j] !== b[j]) same = false;
          if (!same) continue;
        }
        alias.set(i, first);
      }
      if (!alias.size) break;
      const swap = (x) => {
        if (x instanceof Ref) return alias.has(x.num) ? new Ref(alias.get(x.num), 0) : x;
        if (Array.isArray(x)) { for (let j = 0; j < x.length; j++) x[j] = swap(x[j]); return x; }
        if (x instanceof PDFStream) { swap(x.dict); return x; }
        if (isDict(x)) { for (const key of Object.keys(x)) x[key] = swap(x[key]); return x; }
        return x;
      };
      for (let i = 1; i < all.length; i++) if (all[i] !== undefined && !alias.has(i)) swap(all[i]);
      for (const i of alias.keys()) { all[i] = undefined; report.merged++; }
    }
  };

  const items = pages.map((pg, i) => ({ doc, pageIndex: i }));
  const strip = o.metadata === 'strip';
  const bytes = await assemble(items, Object.assign({ replace: new Map([[doc, replace]]), finish, compact: o.compact !== false },
    strip ? { info: {}, xmp: false } : {}));
  report.before = doc.bytes.length;
  report.after = bytes.length;
  return { bytes, report };
}

/* ============================================================
   Flattening: form answers and comments drawn into the page
   ============================================================ */

/** The field dictionary a widget's value lives in (itself, or a parent). */
async function fieldValue(doc, a) {
  let f = a, guard = 0;
  while (f && guard++ < 10) {
    const v = await doc.resolve(f.V);
    const ft = await doc.resolve(f.FT);
    if (v !== undefined || ft !== undefined) return { v, ft: ft && ft.name, ff: Number(await doc.resolve(f.Ff)) || 0, da: await doc.resolve(f.DA), q: Number(await doc.resolve(f.Q)) || 0, field: f };
    f = await doc.resolve(f.Parent);
  }
  return { v: undefined, ft: undefined };
}

/**
 * Draw every form field's answer and every comment into the page content
 * as it appears now, and remove the live objects, so nothing can be changed
 * or lost and every printer and viewer shows the same. Links stay links.
 * options: { forms: true, comments: true }.
 */
async function flattenDocument(doc, options) {
  const o = Object.assign({ forms: true, comments: true }, options || {});
  const pages = await doc.getPages();
  const stats = { fields: 0, comments: 0, generated: 0, hidden: 0, links: 0 };
  const items = [];
  const fmt = (v) => String(Number(Number(v).toFixed(4)));
  for (let i = 0; i < pages.length; i++) {
    progress(i, pages.length, 'Flattening page ' + (i + 1));
    const pg = pages[i];
    const arr = await doc.resolve(pg.dict.Annots);
    const drop = new Set();
    const xobjects = {};
    let ops = '';
    let k = 0;
    for (const r of Array.isArray(arr) ? arr : []) {
      const a = await doc.resolve(r);
      if (!isDict(a)) continue;
      const sub = (await doc.resolve(a.Subtype)) || {};
      const name = sub.name || '';
      if (name === 'Link') { stats.links++; continue; }
      const widget = name === 'Widget';
      if (widget ? !o.forms : !o.comments) continue;
      if (!(r instanceof Ref)) continue;
      drop.add(r.num);
      if (name === 'Popup') continue;
      const flags = Number(await doc.resolve(a.F)) || 0;
      if (flags & (2 | 32)) { stats.hidden++; continue; }          /* Hidden, NoView: not drawn now, not drawn after */
      const rect = (await doc.resolve(a.Rect)) || [0, 0, 0, 0];
      const R = [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])].map(Number);
      if (!(R[2] > R[0] && R[3] > R[1])) continue;
      const ap = await doc.resolve(a.AP);
      let nRef = isDict(ap) ? ap.N : undefined;
      let n = await doc.resolve(nRef);
      if (isDict(n) && !(n instanceof PDFStream)) {
        const as = await doc.resolve(a.AS);
        const key = as instanceof Name ? as.name : null;
        nRef = key ? n[key] : undefined;
        n = await doc.resolve(nRef);
      }
      if (n instanceof PDFStream) {
        const bb = (await doc.resolve(n.dict.BBox)) || [0, 0, 1, 1];
        const mm = await doc.resolve(n.dict.Matrix);
        const M = Array.isArray(mm) && mm.length === 6 ? mm.map(Number) : [1, 0, 0, 1, 0, 0];
        const pts = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]].map(([x, y]) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]);
        const bx0 = Math.min(...pts.map((q) => q[0])), bx1 = Math.max(...pts.map((q) => q[0]));
        const by0 = Math.min(...pts.map((q) => q[1])), by1 = Math.max(...pts.map((q) => q[1]));
        const sx = (bx1 - bx0) ? (R[2] - R[0]) / (bx1 - bx0) : 1, sy = (by1 - by0) ? (R[3] - R[1]) / (by1 - by0) : 1;
        const key = 'MVRflat' + (k++);
        xobjects[key] = nRef;
        ops += 'q ' + [sx, 0, 0, sy, R[0] - bx0 * sx, R[1] - by0 * sy].map(fmt).join(' ') + ' cm /' + key + ' Do Q\n';
      } else if (widget) {
        /* no appearance (a form saved with NeedAppearances): the answer is
           drawn plainly in Helvetica, so it is not lost */
        const fv = await fieldValue(doc, a);
        let text = null;
        if (fv.v && fv.v.__string !== undefined) text = decodePdfString(fv.v.__string);
        else if (fv.v instanceof Name && fv.v.name !== 'Off') text = fv.ft === 'Btn' ? 'X' : fv.v.name;
        else if (Array.isArray(fv.v)) text = fv.v.map((x) => x && x.__string ? decodePdfString(x.__string) : '').join(', ');
        if (text) {
          const m = /([\d.]+)\s+Tf/.exec(fv.da && fv.da.__string ? latin1(fv.da.__string) : '');
          let size = m ? Number(m[1]) : 0;
          const h = R[3] - R[1];
          if (!size) size = Math.max(6, Math.min(12, h * 0.7));
          const w = textWidth(text, 'Helvetica', size);
          const x = fv.q === 1 ? R[0] + (R[2] - R[0] - w) / 2 : fv.q === 2 ? R[2] - 2 - w : R[0] + 2;
          const y = R[1] + Math.max(1, (h - size) / 2 + size * 0.22);
          ops += 'q BT 0 g /MVRflatF ' + fmt(size) + ' Tf ' + fmt(x) + ' ' + fmt(y) + ' Td (' + contentEscape(text) + ') Tj ET Q\n';
          stats.generated++;
        }
      }
      if (widget) stats.fields++; else stats.comments++;
    }
    items.push({ doc, pageIndex: i, dropAnnots: drop, overlay: ops ? { content: ops, fontKey: 'MVRflatF', fontName: 'Helvetica', xobjects, upright: false } : undefined });
  }
  const bytes = await assemble(items, { noForm: !!o.forms });
  return { bytes, stats };
}

/** Parse "1-3, 5, 8-" style page selections into zero-based indices. */
function parsePageRange(spec, total) {
  // Strip all whitespace before splitting: people type "3 - 4" and "1, 5",
  // and splitting on whitespace would turn the dash into its own token.
  const s = String(spec || '').replace(/\s+/g, '');
  if (!s || s.toLowerCase() === 'all') return Array.from({ length: total }, (_, i) => i);
  const out = [];
  for (const part of s.split(/[,;]+/).filter(Boolean)) {
    let m = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m) {
      let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) if (i >= 1 && i <= total) out.push(i - 1);
      continue;
    }
    m = /^(\d+)\s*-$/.exec(part);
    if (m) {
      for (let i = parseInt(m[1], 10); i <= total; i++) if (i >= 1) out.push(i - 1);
      continue;
    }
    m = /^-\s*(\d+)$/.exec(part);
    if (m) {
      for (let i = 1; i <= Math.min(total, parseInt(m[1], 10)); i++) out.push(i - 1);
      continue;
    }
    if (/^\d+$/.test(part)) {
      const i = parseInt(part, 10);
      if (i >= 1 && i <= total) out.push(i - 1);
      continue;
    }
    throw new Error(`"${part}" is not a valid page selection. Use forms like 1-3, 5, 8-`);
  }
  if (!out.length) throw new Error('That selection matches no pages in this document.');
  return out;
}

/* ============================================================
   Unicode text: Noto Sans subsets, shaped where the script needs it

   Text that WinAnsi can hold is still drawn in the base-14 fonts, which
   embed nothing. Anything else (Polish, Greek, Cyrillic, the rupee sign,
   Hindi) is drawn with a subset of a vendored Noto font, embedded as a
   CIDFontType2 with a ToUnicode map so it can be searched and copied.
   Devanagari is shaped by HarfBuzz (engine/pdf-shaper.js), loaded the first
   time a run needs it; the fonts are fetched from engine/vendor/fonts/ the
   same way, and kept for the rest of the session.
   ============================================================ */

const UNI = { base: null, loader: null, fonts: new Map(), shaper: null, shaperLoader: null };
/** Where engine/ is (the worker and the shell set it). */
function setFontBase(url) { UNI.base = url; }
/** fn(relativePath) -> Promise<Uint8Array>, for Node and the tests. */
function setFontLoader(fn, shaperLoader) { UNI.loader = fn; if (shaperLoader) UNI.shaperLoader = shaperLoader; }

async function engineFile(rel) {
  if (UNI.loader) return UNI.loader(rel);
  const base = UNI.base || (typeof self !== 'undefined' && self.location ? new URL('./', self.location.href).href : '');
  const r = await fetch(base + rel);
  if (!r.ok) throw new Error('The font ' + rel.split('/').pop() + ' could not be loaded (HTTP ' + r.status + ').');
  return new Uint8Array(await r.arrayBuffer());
}
async function fontFile(name) {
  if (!UNI.fonts.has(name)) {
    UNI.fonts.set(name, (async () => {
      const bytes = await engineFile('vendor/fonts/' + name);
      const font = PFONT.parse(bytes);
      return { font, bytes };
    })());
  }
  return UNI.fonts.get(name);
}
async function shaper() {
  if (UNI.shaper) return UNI.shaper;
  let S = null;
  if (UNI.shaperLoader) S = await UNI.shaperLoader();
  if (!S) { try { if (typeof MVRShaper !== 'undefined') S = MVRShaper; } catch (e) { /* none */ } }
  if (!S && typeof importScripts === 'function' && UNI.base) { importScripts(UNI.base + 'pdf-shaper.js'); S = self.MVRShaper; }
  if (!S) throw new Error('The text shaper for this script could not be loaded.');
  UNI.shaper = await S.load(UNI.base || undefined);
  return UNI.shaper;
}

/**
 * The fonts one output document draws Unicode text with. Prepare every
 * string first (async: fonts and the shaper load on demand), then draw with
 * show(), which is synchronous; finish(writer) embeds each font used, once,
 * as a subset of exactly the glyphs drawn.
 */
class TextFonts {
  /* force: every string in a Noto font, not only those WinAnsi cannot hold,
     so a document that needs one non-Latin line reads as one typeface */
  constructor(options) { this.cache = new Map(); this.used = new Map(); this.force = !!(options && options.force); }
  wants(text) { const t = String(text == null ? '' : text); return this.force ? !!PFONT && t.trim() !== '' : TextFonts.needs(t); }
  static needs(text) { return !!PFONT && PFONT.needsUnicode(String(text == null ? '' : text)); }
  key(text, bold) { return (bold ? 'B' : 'R') + '\u0000' + text; }
  has(text, bold) { return this.cache.has(this.key(String(text), !!bold)); }
  async prepare(text, bold) {
    text = String(text == null ? '' : text);
    if (!this.wants(text)) return null;
    const k = this.key(text, !!bold);
    if (this.cache.has(k)) return this.cache.get(k);
    const file = PFONT.pickFont(text, !!bold);
    const { font, bytes } = await fontFile(file);
    let glyphs;
    if (PFONT.scriptOf(text) === 'latin') glyphs = PFONT.shapeSimple(font, text);
    else {
      const sh = await shaper();
      glyphs = PFONT.fromShaper(font, text, sh.shape(bytes, text, {}));
    }
    const rec = { file, font, glyphs, em: glyphs.reduce((sum, g) => sum + (g.adv || 0), 0) / font.unitsPerEm };
    /* characters neither Noto font has (Chinese, Arabic, emoji …) draw as
       empty boxes; they are collected so the tool can say so */
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp > 0x20 && !/\p{Mn}|\p{Cf}|\s/u.test(ch) && font.glyphForCodePoint(cp) === 0) (this.missingChars = this.missingChars || new Set()).add(ch);
    }
    this.cache.set(k, rec);
    return rec;
  }
  /** characters drawn as empty boxes, for a warning */
  missing() { return this.missingChars ? [...this.missingChars] : []; }
  async prepareAll(texts, bold) { for (const t of texts) await this.prepare(t, bold); return this; }
  /** points, after prepare() (base-14 metrics for text that needs no font) */
  widthSync(text, size, bold, base14) {
    const r = this.cache.get(this.key(String(text), !!bold));
    return r ? r.em * size : textWidth(text, base14 || (bold ? 'Helvetica-Bold' : 'Helvetica'), size);
  }
  async width(text, size, bold, base14) { await this.prepare(text, bold); return this.widthSync(text, size, bold, base14); }
  /** "/MVRuN size Tf" and the glyphs, inside BT … ET at the current point */
  show(text, size, bold) {
    const r = this.cache.get(this.key(String(text), !!bold));
    if (!r) throw new Error('Text was drawn before it was prepared.');
    let u = this.used.get(r.file);
    if (!u) { u = { font: r.font, registry: PFONT.createRegistry(r.font), key: 'MVRu' + this.used.size, refs: new Map() }; this.used.set(r.file, u); }
    return { key: u.key, ops: '/' + u.key + ' ' + n(size) + ' Tf\n' + PFONT.showGlyphs(u.registry, r.glyphs, size) };
  }
  /** the Ref a page's /Font entry names, allocated now and filled by finish() */
  refFor(writer, key) {
    for (const u of this.used.values()) {
      if (u.key !== key) continue;
      if (!u.refs.has(writer)) u.refs.set(writer, new Ref(writer.alloc(), 0));
      return u.refs.get(writer);
    }
    throw new Error('Unknown font ' + key);
  }
  /** { MVRu0: (writer) => Ref, … } for an assemble overlay */
  overlayFonts() {
    const out = {};
    for (const u of this.used.values()) out[u.key] = (writer) => this.refFor(writer, u.key);
    return out;
  }
  finish(writer) {
    for (const u of this.used.values()) {
      const ref = u.refs.get(writer);
      if (!ref) continue;
      PFONT.embedType0(writer, { Name, Ref, PDFStream }, { font: u.font, registry: u.registry, ref });
    }
  }
  /** pdfcore's wrapText, measured with the right font for each line */
  async wrap(text, size, bold, maxWidth, base14) {
    /* each word is measured once and a line is the sum of its words and
       spaces: shaping never joins across a space, and measuring every
       growing line would cost the square of a paragraph's length */
    const lines = [];
    const words = new Map();
    const wordWidth = async (w) => {
      if (!words.has(w)) words.set(w, await this.width(w, size, bold, base14));
      return words.get(w);
    };
    const space = await wordWidth(' ');
    for (const para of String(text).split('\n')) {
      if (!para.trim()) { lines.push(''); continue; }
      let line = '', lw = 0;
      for (const word of para.split(/\s+/)) {
        const ww = await wordWidth(word);
        if (line && lw + space + ww > maxWidth) { lines.push(line); line = word; lw = ww; }
        else { line = line ? line + ' ' + word : word; lw = line === word ? ww : lw + space + ww; }
      }
      if (line) lines.push(line);
    }
    for (const l of lines) await this.prepare(l, bold);
    return lines;
  }
}

/** A text helper for specs: textRun(...) -> new TextFonts() */
function textRun() { return new TextFonts(); }

/** createPDF, with every op's text prepared first so any script can be drawn. */
async function createDocument(pages, opts) {
  const tf = (opts && opts.text) || new TextFonts();
  for (const pg of pages) for (const op of pg.ops || []) {
    if (op.text !== undefined && tf.wants(op.text)) await tf.prepare(op.text, /Bold/.test(op.font || ''));
  }
  return createPDF(pages, Object.assign({}, opts || {}, { text: tf.used.size || tf.cache.size ? tf : null }));
}

const unicodeFonts = { setFontBase, setFontLoader, TextFonts, needs: (t) => TextFonts.needs(t) };

/* ============================================================
   Base-14 text: widths, wrapping, page building
   ============================================================ */

/* AFM widths for the WinAnsi range, indexed 32..126 then a flat value for the
   rest. Enough for accurate wrapping and centring of Latin text. */
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const TIMES = [250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541];

const FONTS = {
  Helvetica:        { widths: HELV,  name: 'Helvetica' },
  'Helvetica-Bold': { widths: HELVB, name: 'Helvetica-Bold' },
  'Times-Roman':    { widths: TIMES, name: 'Times-Roman' },
  Courier:          { widths: null,  name: 'Courier' }      // monospace, 600
};

function textWidth(text, fontKey, size) {
  const f = FONTS[fontKey] || FONTS.Helvetica;
  let units = 0;
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    if (!f.widths) { units += 600; continue; }
    if (c >= 32 && c <= 126) { units += f.widths[c - 32]; continue; }
    // en/em dashes and curly quotes are common enough to be worth measuring
    if (c === 0x2014) { units += 1000; continue; }
    if (c === 0x2013) { units += 556; continue; }
    if (c === 0x2018 || c === 0x2019) { units += 222; continue; }
    if (c === 0x201c || c === 0x201d) { units += 333; continue; }
    if (c === 0x2026) { units += 1000; continue; }
    units += 556;
  }
  return (units / 1000) * size;
}

function wrapText(text, fontKey, size, maxWidth) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (textWidth(test, fontKey, size) > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/* WinAnsiEncoding is not Latin-1: positions 0x80–0x9F carry typographic
   characters that Latin-1 leaves undefined. Without this map, every smart
   quote, en-dash and ellipsis in pasted text renders as "?" — which is most
   text copied out of a word processor. */
const WINANSI = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f
};

/* Characters with no WinAnsi slot but an obvious ASCII stand-in. Better a
   readable approximation than a row of question marks. */
const FALLBACK = {
  0x2212: '-', 0x2010: '-', 0x2011: '-', 0x2015: '-',
  0x00a0: ' ', 0x2009: ' ', 0x200a: ' ', 0x2002: ' ', 0x2003: ' ',
  0x2032: "'", 0x2033: '"', 0x00ad: ''
};

/** Escape a string for a PDF content stream, mapping to WinAnsi. */
function contentEscape(s) {
  let out = '';
  for (const ch of String(s)) {
    let c = ch.codePointAt(0);
    if (WINANSI[c] !== undefined) c = WINANSI[c];
    else if (FALLBACK[c] !== undefined) {
      const sub = FALLBACK[c];
      if (sub) out += sub;
      continue;
    }
    if (c === 0x28 || c === 0x29 || c === 0x5c) out += '\\' + String.fromCharCode(c);
    else if (c < 32) out += ' ';
    else if (c < 127) out += String.fromCharCode(c);
    else if (c < 256) out += '\\' + c.toString(8).padStart(3, '0');
    else out += '?';                                   // genuinely unrepresentable
  }
  return out;
}

const PAGE_SIZES = {
  a3:     [841.89, 1190.55],
  a4:     [595.28, 841.89],
  a5:     [419.53, 595.28],
  letter: [612, 792],
  legal:  [612, 1008],
  tabloid:[792, 1224]
};

/**
 * Build a PDF from page descriptors, each a list of drawing ops.
 * ops: {text,x,y,size,font,colour} | {rect,...} | {line,...}
 */
function createPDF(pages, opts) {
  const o = opts || {};
  const writer = new PDFWriter();
  const catalogNum = writer.alloc();
  const pagesNum = writer.alloc();

  const fontRefs = Object.create(null);
  const fontKeyFor = (key) => {
    const k = FONTS[key] ? key : 'Helvetica';
    if (!fontRefs[k]) {
      fontRefs[k] = new Ref(writer.add({
        Type: new Name('Font'), Subtype: new Name('Type1'),
        BaseFont: new Name(FONTS[k].name), Encoding: new Name('WinAnsiEncoding')
      }), 0);
    }
    return k;
  };

  const kids = [];
  for (const page of pages) {
    const [W, H] = page.size || PAGE_SIZES[o.pageSize || 'a4'];
    const used = new Set();
    const usedImages = Object.create(null);
    const usedUnicode = Object.create(null);
    let cs = '';

    for (const op of page.ops || []) {
      if (op.rect) {
        const [x, y, w, h] = op.rect;
        if (op.fill) cs += `${rgb(op.fill)} rg\n${n(x)} ${n(y)} ${n(w)} ${n(h)} re f\n`;
        if (op.stroke) cs += `${rgb(op.stroke)} RG\n${n(op.lineWidth || 1)} w\n${n(x)} ${n(y)} ${n(w)} ${n(h)} re S\n`;
      } else if (op.line) {
        const [x1, y1, x2, y2] = op.line;
        cs += `${rgb(op.stroke || '#000000')} RG\n${n(op.lineWidth || 1)} w\n${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S\n`;
      } else if (op.image) {
        const key = 'Im' + imageRef(writer, op.image).num;
        usedImages[key] = imageRef(writer, op.image);
        const w = op.w, h = op.h !== undefined ? op.h : op.w * op.image.height / op.image.width;
        cs += `q\n${n(w)} 0 0 ${n(h)} ${n(op.x)} ${n(op.y)} cm\n/${key} Do\nQ\n`;
      } else if (op.raw !== undefined) {
        cs += op.raw + '\n';
      } else if (op.text !== undefined && o.text && o.text.has(op.text, /Bold/.test(op.font || ''))) {
        /* text outside WinAnsi: a Noto subset, shaped where the script needs it */
        const size = op.size || 11;
        const bold = /Bold/.test(op.font || '');
        const w = o.text.widthSync(op.text, size, bold);
        let x = op.x || 0;
        if (op.align === 'center') x = op.x - w / 2;
        else if (op.align === 'right') x = op.x - w;
        const shown = o.text.show(op.text, size, bold);
        usedUnicode[shown.key] = true;
        cs += `BT\n${rgb(op.colour || '#000000')} rg\n${n(x)} ${n(op.y)} Td\n${shown.ops}\nET\n`;
      } else if (op.text !== undefined) {
        const fk = fontKeyFor(op.font || 'Helvetica');
        used.add(fk);
        const size = op.size || 11;
        let x = op.x || 0;
        if (op.align === 'center') x = op.x - textWidth(op.text, fk, size) / 2;
        else if (op.align === 'right') x = op.x - textWidth(op.text, fk, size);
        cs += `BT\n/${fk.replace(/[^A-Za-z0-9]/g, '')} ${n(size)} Tf\n` +
              `${rgb(op.colour || '#000000')} rg\n` +
              `${n(x)} ${n(op.y)} Td\n(${contentEscape(op.text)}) Tj\nET\n`;
      }
    }

    const res = Object.create(null);
    const fdict = Object.create(null);
    used.forEach(k => { fdict[k.replace(/[^A-Za-z0-9]/g, '')] = fontRefs[k]; });
    for (const key of page.unicodeKeys || []) usedUnicode[key] = true;
    for (const key of Object.keys(usedUnicode)) fdict[key] = o.text.refFor(writer, key);
    if (Object.keys(fdict).length) res.Font = fdict;
    if (Object.keys(usedImages).length) res.XObject = usedImages;
    if (page.gs) {
      const gs = Object.create(null);
      for (const [k, v] of Object.entries(page.gs)) gs[k] = { Type: new Name('ExtGState'), ca: v, CA: v };
      res.ExtGState = gs;
    }

    const contentNum = writer.add(new PDFStream(Object.create(null), bytesOf(cs)));
    const pageNum = writer.alloc();
    writer.set(pageNum, {
      Type: new Name('Page'), Parent: new Ref(pagesNum, 0),
      MediaBox: [0, 0, W, H], Resources: res, Contents: new Ref(contentNum, 0)
    });
    kids.push(new Ref(pageNum, 0));
  }

  writer.set(pagesNum, { Type: new Name('Pages'), Kids: kids, Count: kids.length });
  writer.set(catalogNum, { Type: new Name('Catalog'), Pages: new Ref(pagesNum, 0) });
  if (o.text) o.text.finish(writer);

  let infoRef = null;
  if (o.info) {
    const info = Object.create(null);
    for (const [k, v] of Object.entries(o.info)) {
      if (v) info[k] = pdfString(String(v));
    }
    if (Object.keys(info).length) infoRef = new Ref(writer.add(info), 0);
  }
  return writer.build(new Ref(catalogNum, 0), infoRef, '1.4');
}

const n = (v) => Number.isInteger(v) ? String(v) : String(Number(Number(v).toFixed(4)));
function rgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex));
  if (!m) return '0 0 0';
  return [1, 2, 3].map(i => n(parseInt(m[i], 16) / 255)).join(' ');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PDFDocument, PDFWriter, Lexer, Name, Ref, PDFStream,
    assemble, parsePageRange, copyObject, pageFrame,
    createPDF, textWidth, wrapText, contentEscape, PAGE_SIZES, FONTS,
    pdfString, decodePdfString, inflate, applyPredictor, ascii85Decode,
    latin1, bytesOf, isDict, isName, isRef,
    deflate, setProgress, setPreview, protectDocument, prepareImage, imageRef,
    compressDocument, unicodeFonts, textRun, createDocument, TextFonts, flattenDocument
  };
}
