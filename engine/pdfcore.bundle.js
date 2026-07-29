(function(){
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

  static async load(bytes) {
    const doc = new PDFDocument(bytes);
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
    if (this.trailer && this.trailer.Encrypt) {
      throw new Error('This PDF is encrypted. Remove the password in the application that created it first.');
    }
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
          if (v !== undefined) this.objects.set(num, v);
        } catch (e) { /* one bad object should not sink the document */ }
      }
      this._offsets = null;
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
        if (v !== undefined) this.objects.set(num, v);         // later wins
      } catch (e) { /* skip */ }
    }
    // expand any object streams we found
    for (const [num, v] of [...this.objects]) {
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

  build(rootRef, infoRef, version) {
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
      push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    }
    const trailer = { Size: this.objects.length, Root: rootRef };
    if (infoRef) trailer.Info = infoRef;
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
   Page operations
   ============================================================ */

/** Deep-copy an object graph from a source document into a writer, renumbering. */
async function copyObject(doc, writer, value, map, depth) {
  if ((depth || 0) > 80) return null;
  if (value instanceof Ref) {
    const key = value.num;
    if (map.has(key)) return new Ref(map.get(key), 0);
    const slot = writer.alloc();
    map.set(key, slot);
    const target = await doc.resolve(value);
    const copied = await copyObject(doc, writer, target, map, (depth || 0) + 1);
    writer.set(slot, copied === undefined ? null : copied);
    return new Ref(slot, 0);
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await copyObject(doc, writer, v, map, (depth || 0) + 1));
    return out;
  }
  if (value instanceof PDFStream) {
    const d = Object.create(null);
    for (const k of Object.keys(value.dict)) {
      if (k === 'Length') continue;
      d[k] = await copyObject(doc, writer, value.dict[k], map, (depth || 0) + 1);
    }
    return new PDFStream(d, value.raw);
  }
  if (isDict(value)) {
    const d = Object.create(null);
    for (const k of Object.keys(value)) {
      d[k] = await copyObject(doc, writer, value[k], map, (depth || 0) + 1);
    }
    return d;
  }
  return value;
}

/**
 * Assemble a new PDF from a list of {doc, pageIndex, rotate} instructions.
 * This is the shared core of merge, split, extract, delete, reorder and rotate.
 */
async function assemble(items, options) {
  const opts = options || {};
  const writer = new PDFWriter();
  const catalogNum = writer.alloc();
  const pagesNum = writer.alloc();
  const kids = [];

  const maps = new Map();       // doc -> renumber map

  for (const item of items) {
    const doc = item.doc;
    if (!maps.has(doc)) maps.set(doc, new Map());
    const map = maps.get(doc);

    const pages = await doc.getPages();
    const page = pages[item.pageIndex];
    if (!page) continue;

    const src = page.dict;
    const out = Object.create(null);
    out.Type = new Name('Page');

    for (const k of ['Resources', 'MediaBox', 'CropBox', 'BleedBox', 'TrimBox',
                     'ArtBox', 'Contents', 'Annots', 'Group', 'UserUnit']) {
      const v = src[k] !== undefined ? src[k] : page.inherited[k];
      if (v !== undefined) out[k] = await copyObject(doc, writer, v, map, 0);
    }
    if (out.MediaBox === undefined) out.MediaBox = [0, 0, 595.28, 841.89];
    if (out.Resources === undefined) out.Resources = Object.create(null);

    const baseRotate = Number(src.Rotate !== undefined ? src.Rotate : page.inherited.Rotate) || 0;
    const extra = Number(item.rotate) || 0;
    const rot = (((baseRotate + extra) % 360) + 360) % 360;
    if (rot) out.Rotate = rot;

    if (item.overlay) {
      const streamNum = writer.add(new PDFStream(
        Object.create(null), bytesOf(item.overlay.content)));
      const existing = out.Contents;
      const arr = existing === undefined ? []
        : Array.isArray(existing) ? existing.slice() : [existing];
      arr.push(new Ref(streamNum, 0));
      out.Contents = arr;

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
      if (!font[item.overlay.fontKey]) {
        font[item.overlay.fontKey] = new Ref(writer.add({
          Type: new Name('Font'), Subtype: new Name('Type1'),
          BaseFont: new Name(item.overlay.fontName || 'Helvetica'),
          Encoding: new Name('WinAnsiEncoding')
        }), 0);
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

    const num = writer.alloc();
    out.Parent = new Ref(pagesNum, 0);
    writer.set(num, out);
    kids.push(new Ref(num, 0));
  }

  if (!kids.length) throw new Error('No pages were selected.');

  writer.set(pagesNum, { Type: new Name('Pages'), Kids: kids, Count: kids.length });
  writer.set(catalogNum, { Type: new Name('Catalog'), Pages: new Ref(pagesNum, 0) });

  let infoRef = null;
  if (opts.info && Object.keys(opts.info).length) {
    const info = Object.create(null);
    for (const [k, v] of Object.entries(opts.info)) {
      if (v !== undefined && v !== null && String(v) !== '') info[k] = pdfString(String(v));
    }
    if (Object.keys(info).length) infoRef = new Ref(writer.add(info), 0);
  }

  return writer.build(new Ref(catalogNum, 0), infoRef, opts.version || '1.7');
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
    let cs = '';

    for (const op of page.ops || []) {
      if (op.rect) {
        const [x, y, w, h] = op.rect;
        if (op.fill) cs += `${rgb(op.fill)} rg\n${n(x)} ${n(y)} ${n(w)} ${n(h)} re f\n`;
        if (op.stroke) cs += `${rgb(op.stroke)} RG\n${n(op.lineWidth || 1)} w\n${n(x)} ${n(y)} ${n(w)} ${n(h)} re S\n`;
      } else if (op.line) {
        const [x1, y1, x2, y2] = op.line;
        cs += `${rgb(op.stroke || '#000000')} RG\n${n(op.lineWidth || 1)} w\n${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S\n`;
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
    if (Object.keys(fdict).length) res.Font = fdict;

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


window.MVRPdfCore={PDFDocument:PDFDocument,assemble:assemble,parsePageRange:parsePageRange,createPDF:createPDF,textWidth:textWidth,wrapText:wrapText,contentEscape:contentEscape,PAGE_SIZES:PAGE_SIZES,FONTS:FONTS,latin1:latin1,isDict:isDict,isName:isName};
})();