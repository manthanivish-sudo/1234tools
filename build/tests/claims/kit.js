/**
 * The shared part of build/tests/claims.js: engines loaded the way the pages
 * load them, fixtures, byte readers, and a headless Chrome on the served
 * site. Everything here is read from --root, so a test of an export tests
 * that export's engines.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const zlib = require('zlib');
const { webcrypto } = require('crypto');

const K = module.exports;
K.CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

K.init = function ({ ROOT, OUT, PORT }) {
  K.ROOT = ROOT; K.OUT = OUT; K.PORT = PORT;
  K.BASE = 'http://127.0.0.1:' + PORT;
  K.SAMPLES = path.join(ROOT, 'build', 'promo', 'samples');
};

/* a value computed once and shared by every check that needs it */
const memos = new Map();
K.once = (key, fn) => { if (!memos.has(key)) memos.set(key, Promise.resolve().then(fn)); return memos.get(key); };
K.out = (name) => path.join(K.OUT, name);
K.write = (name, bytes) => { const f = K.out(name); fs.writeFileSync(f, bytes); return f; };
K.sample = (name) => path.join(K.SAMPLES, name);
K.read = (rel) => fs.readFileSync(path.join(K.ROOT, rel));
K.j = (v) => JSON.stringify(v);

/* ================================================================== */
/* developer and text engines, in a vm with a stub window              */
/* ================================================================== */

function context(extra) {
  const sb = Object.assign({
    console, Intl, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa,
    crypto: webcrypto, navigator: { language: 'en-GB' }, setTimeout, clearTimeout
  }, extra || {});
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  return vm.createContext(sb);
}
K.context = context;
const specCache = new Map();
/** A developer or text tool's spec: K.tool('dev-base64.js', 'base64'). */
K.tool = (file, id, extra) => {
  const key = file + '|' + id;
  if (extra || !specCache.has(key)) {
    /* a context with stand-ins (extra) is never cached: each call gets its own */
    const ctx = context(extra);
    vm.runInContext(fs.readFileSync(path.join(K.ROOT, 'engine', file), 'utf8'), ctx, { filename: file });
    const g = ctx.DEV_TOOLS || ctx.TEXT_TOOLS || ctx.IMAGE_TOOLS || {};
    if (!g[id]) throw new Error(file + ' defines no tool ' + id);
    if (extra) return g[id];
    specCache.set(key, g[id]);
  }
  return specCache.get(key);
};
const defaultsOf = (list) => { const o = {}; (list || []).forEach((x) => { o[x.key] = x.default; }); return o; };
/** transform(input) with the spec's defaults under opts */
K.tx = (spec, input, opts) => spec.transform(String(input), Object.assign(defaultsOf(spec.options || spec.controls), opts || {})) || {};
K.gen = (spec, fields) => spec.generate(Object.assign(defaultsOf(spec.fields || spec.options), fields || {})) || {};
K.stat = (res, label) => { const r = ((res && res.stats) || []).find((x) => x[0] === label); return r ? r[1] : undefined; };

/* ================================================================== */
/* PDF: the shipped bundle and specs; the package engine as a reader    */
/* ================================================================== */

K.core = () => {
  if (!K._core) {
    const w = {};
    new Function('window', fs.readFileSync(path.join(K.ROOT, 'engine/pdfcore.bundle.js'), 'utf8'))(w);
    K._core = w.MVRPdfCore;
  }
  return K._core;
};
K.pkg = () => K._pkg || (K._pkg = require(path.join(K.ROOT, 'build/pdf-package/engine/pdfcore.js')));
const pdfSpecs = new Map();
K.pdfSpec = (id) => {
  if (!pdfSpecs.has(id)) {
    const w = {};
    new Function('window', fs.readFileSync(path.join(K.ROOT, 'engine/pdf-' + id + '.js'), 'utf8'))(w);
    pdfSpecs.set(id, w.PDF_TOOLS[id]);
  }
  return pdfSpecs.get(id);
};
K.pdfDefaults = (id) => {
  const o = {};
  for (const c of K.pdfSpec(id).controls || []) o[c.key] = c.default === 'TODAY' ? '2026-10-04' : c.default;
  return o;
};
/** run a PDF spec on files [{name, bytes}] with its defaults under opts; never throws for a refusal */
K.runPdf = async (id, files, opts, text) => {
  const core = K.core();
  const docs = [];
  for (const f of files || []) docs.push({ doc: await core.PDFDocument.load(f.bytes), name: f.name, size: f.bytes.length });
  return (await K.pdfSpec(id).run({ docs, text, opts: Object.assign(K.pdfDefaults(id), opts || {}), core })) || {};
};
K.pdfOut = (res, i) => (res.files && res.files[i || 0] ? res.files[i || 0].bytes : null);

/** Everything readable in a PDF: its bytes, every stream decoded, page list, outline, fields, info. */
K.analyse = async (out) => {
  const pkg = K.pkg();
  const { PDFStream, Ref, isDict, isName } = pkg;
  const doc = await pkg.PDFDocument.load(out);
  let text = Buffer.from(out).toString('latin1');
  const streams = [];
  for (const v of doc.objects.values()) {
    if (!(v instanceof PDFStream)) continue;
    let dec = null;
    try { dec = Buffer.from(await doc.decodeStream(v)).toString('latin1'); } catch (e) { /* undecodable */ }
    if (dec !== null) { text += '\n' + dec; streams.push({ dict: v.dict, data: dec, raw: v.raw }); }
    else streams.push({ dict: v.dict, data: null, raw: v.raw });
  }
  const pages = await doc.getPages();
  const pageObjs = [...doc.objects.values()].filter((v) => isDict(v) && isName(v.Type, 'Page')).length;
  const root = await doc.resolve(doc.trailer.Root);
  const idx = (ref) => ref instanceof Ref ? pages.findIndex((p) => p.ref && p.ref.num === ref.num) : -1;
  const outline = async () => {
    const ol = await doc.resolve(root.Outlines);
    const walk = async (ref) => {
      const list = [];
      while (ref) {
        const it = await doc.resolve(ref);
        if (!isDict(it)) break;
        const t = await doc.resolve(it.Title);
        list.push({ title: t ? pkg.decodePdfString(t.__string) : '', kids: await walk(it.First) });
        ref = it.Next;
      }
      return list;
    };
    return isDict(ol) ? walk(ol.First) : [];
  };
  const fields = async () => {
    const af = await doc.resolve(root.AcroForm);
    if (!isDict(af)) return null;
    const names = [];
    for (const r of (await doc.resolve(af.Fields)) || []) {
      const f = await doc.resolve(r);
      names.push(f && f.T ? pkg.decodePdfString(f.T.__string) : '?');
    }
    return names;
  };
  /* the page's own content, decoded, in order */
  const content = async (i) => {
    const c = await doc.resolve(pages[i].dict.Contents);
    const list = Array.isArray(c) ? c : [pages[i].dict.Contents];
    let s = '';
    for (const r of list) {
      const st = await doc.resolve(r);
      if (st instanceof PDFStream) { try { s += Buffer.from(await doc.decodeStream(st)).toString('latin1') + '\n'; } catch (e) { /* */ } }
    }
    return s;
  };
  const annots = async (i) => {
    const arr = (await doc.resolve(pages[i].dict.Annots)) || [];
    const o = [];
    for (const r of arr) { const a = await doc.resolve(r); if (isDict(a)) o.push(a); }
    return o;
  };
  const rotate = async (i) => { const r = await doc.resolve(pages[i].dict.Rotate); return typeof r === 'number' ? r : 0; };
  let info = {};
  try { info = await doc.getInfo(); } catch (e) { /* none */ }
  return { doc, text, streams, pages, pageObjs, root, idx, outline, fields, content, annots, rotate, info, size: out.length, header: Buffer.from(out.slice(0, 9)).toString('latin1') };
};

/** the strings a content stream shows with Tj / TJ / ', in order, unescaped */
K.shown = (content) => {
  const out = [];
  const re = /\((?:\\[\s\S]|[^\\)])*\)\s*(?:Tj|')|\[((?:\((?:\\[\s\S]|[^\\)])*\)|[^\]])*)\]\s*TJ/g;
  const unesc = (s) => s.replace(/\\([nrtbf()\\]|[0-7]{1,3}|\r?\n)/g, (m, c) => {
    if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8));
    return { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[c] || '';
  });
  let m;
  while ((m = re.exec(content))) {
    if (m[1] !== undefined) {
      const parts = m[1].match(/\((?:\\[\s\S]|[^\\)])*\)/g) || [];
      out.push(parts.map((p) => unesc(p.slice(1, -1))).join(''));
    } else {
      const s = m[0].replace(/\s*(Tj|')$/, '');
      out.push(unesc(s.slice(1, -1)));
    }
  }
  return out;
};
/** all shown strings of every page, page by page */
K.pdfText = async (bytes) => {
  const a = await K.analyse(bytes);
  const pages = [];
  for (let i = 0; i < a.pages.length; i++) pages.push(K.shown(await a.content(i)));
  return { a, pages, all: pages.map((p) => p.join(' ')).join(' \f ') };
};

/* ---------- fixtures ---------- */

/** n plain pages saying "PAGE-<n>", from the site's own writer */
K.plain = (n, opts) => K.core().createPDF(Array.from({ length: n }, (_, i) => ({ ops: [{ text: 'PAGE-' + (i + 1), x: 72, y: 760, size: 20 }] })), opts || {});

/** Three A4 pages; page 2 owns an image (raw bytes MARKER-<tag>2-IMG!), a comment, a field;
    links between pages, bookmarks, a form, Info (Title, Author) and XMP. */
K.secrets = (tag) => {
  const pkg = K.pkg();
  const { PDFWriter, PDFStream, Name, Ref, pdfString } = pkg;
  const N = (s) => new Name(s), R = (n) => new Ref(n, 0), S = (s) => pdfString(s);
  const bytes = (s) => new Uint8Array(Buffer.from(s, 'latin1'));
  const flate = (s, d) => new PDFStream(Object.assign({ Filter: N('FlateDecode') }, d || {}), new Uint8Array(zlib.deflateSync(Buffer.from(s, 'latin1'))));
  const w = new PDFWriter();
  const cat = w.alloc(), pages = w.alloc();
  const p = [w.alloc(), w.alloc(), w.alloc()];
  const font = w.add({ Type: N('Font'), Subtype: N('Type1'), BaseFont: N('Helvetica'), Encoding: N('WinAnsiEncoding') });
  const img = w.add(new PDFStream({ Type: N('XObject'), Subtype: N('Image'), Width: 4, Height: 4, ColorSpace: N('DeviceGray'), BitsPerComponent: 8 }, bytes('MARKER-' + tag + '2-IMG!')));
  const res = w.add({ Font: { F1: R(font) }, XObject: { Im2: R(img) } });
  const body = (n, extra) => flate('BT /F1 18 Tf 72 760 Td (MARKER-' + tag + n + '-BODY) Tj ET\n' + extra);
  const c1 = w.add(body(1, ''));
  const c2 = w.add(body(2, 'q 40 0 0 40 72 600 cm /Im2 Do Q'));
  const c3 = w.add(body(3, ''));
  const annot = (page, d) => w.add(Object.assign({ Type: N('Annot'), P: R(page), Rect: [72, 500, 200, 520] }, d));
  const l12 = annot(p[0], { Subtype: N('Link'), Dest: [R(p[1]), N('Fit')] });
  const l13 = annot(p[0], { Subtype: N('Link'), Dest: [R(p[2]), N('Fit')] });
  const lUri = annot(p[0], { Subtype: N('Link'), A: { S: N('URI'), URI: S('https://www.1234tools.com/') } });
  const fName = annot(p[0], { Subtype: N('Widget'), FT: N('Tx'), T: S('name'), V: S(''), Rect: [150, 690, 450, 712], DA: S('/Helv 12 Tf 0 g') });
  const fAcct = annot(p[1], { Subtype: N('Widget'), FT: N('Tx'), T: S('account'), V: S('MARKER-' + tag + '2-FIELD'), Rect: [150, 640, 450, 662], DA: S('/Helv 12 Tf 0 g') });
  const note = annot(p[1], { Subtype: N('Text'), Contents: S('MARKER-' + tag + '2-COMMENT') });
  const l31 = annot(p[2], { Subtype: N('Link'), Dest: [R(p[0]), N('Fit')] });
  const page = (i, c, an) => w.set(p[i], { Type: N('Page'), Parent: R(pages), MediaBox: [0, 0, 595.28, 841.89], Resources: R(res), Contents: R(c), Annots: an.map(R) });
  page(0, c1, [l12, l13, lUri, fName]);
  page(1, c2, [fAcct, note]);
  page(2, c3, [l31]);
  w.set(pages, { Type: N('Pages'), Kids: p.map(R), Count: 3 });
  const ol = w.alloc(), oA = w.alloc(), oB = w.alloc(), oC = w.alloc();
  w.set(oA, { Title: S('Cover'), Parent: R(ol), Next: R(oB), Dest: [R(p[0]), N('Fit')] });
  w.set(oB, { Title: S('Payment'), Parent: R(ol), Prev: R(oA), Next: R(oC), Dest: [R(p[1]), N('Fit')] });
  w.set(oC, { Title: S('Terms'), Parent: R(ol), Prev: R(oB), Dest: [R(p[2]), N('Fit')] });
  w.set(ol, { Type: N('Outlines'), First: R(oA), Last: R(oC), Count: 3 });
  const af = w.add({ Fields: [R(fName), R(fAcct)], DA: S('/Helv 0 Tf 0 g'), DR: { Font: { Helv: R(font) } } });
  const xmp = w.add(new PDFStream({ Type: N('Metadata'), Subtype: N('XML') }, bytes(
    '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>XMP-AUTHOR-' + tag + '</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>')));
  w.set(cat, { Type: N('Catalog'), Pages: R(pages), Outlines: R(ol), AcroForm: R(af), Metadata: R(xmp), PageLabels: { Nums: [0, { S: N('r') }] } });
  const info = w.add({ Title: S('Secrets ' + tag), Author: S('Fixture Author'), Creator: S('Fixture Creator'), Producer: S('Fixture Producer'), Subject: S('Fixture Subject'), Keywords: S('fixture, test') });
  return w.build(R(cat), R(info), '1.7');
};

/** Pages whose /Rotate is inherited from the page tree (90) or set on the page (90), plus a plain one. */
K.rotated = () => {
  const pkg = K.pkg();
  const { PDFWriter, PDFStream, Name, Ref } = pkg;
  const N = (s) => new Name(s), R = (n) => new Ref(n, 0);
  const w = new PDFWriter();
  const cat = w.alloc(), root = w.alloc(), mid = w.alloc();
  const font = w.add({ Type: N('Font'), Subtype: N('Type1'), BaseFont: N('Helvetica') });
  const mk = (parent, n, extra) => w.add(Object.assign({ Type: N('Page'), Parent: R(parent), MediaBox: [0, 0, 595, 842], Resources: { Font: { F1: R(font) } },
    Contents: R(w.add(new PDFStream({}, new Uint8Array(Buffer.from('BT /F1 12 Tf 72 700 Td (ROT-' + n + ') Tj ET', 'latin1'))))) }, extra || {}));
  const a = mk(mid, 1), b = mk(root, 2, { Rotate: 90 }), c = mk(root, 3);
  w.set(mid, { Type: N('Pages'), Parent: R(root), Kids: [R(a)], Count: 1, Rotate: 90 });
  w.set(root, { Type: N('Pages'), Kids: [R(mid), R(b), R(c)], Count: 3 });
  w.set(cat, { Type: N('Catalog'), Pages: R(root) });
  return w.build(R(cat), null, '1.7');
};

/** An encrypted-looking PDF: a trailer with /Encrypt. */
K.encrypted = () => {
  const pkg = K.pkg();
  const { PDFWriter, Name, Ref } = pkg;
  const N = (s) => new Name(s), R = (n) => new Ref(n, 0);
  const w = new PDFWriter();
  const cat = w.alloc(), pages = w.alloc();
  const pg = w.add({ Type: N('Page'), Parent: R(pages), MediaBox: [0, 0, 595, 842] });
  w.set(pages, { Type: N('Pages'), Kids: [R(pg)], Count: 1 });
  w.set(cat, { Type: N('Catalog'), Pages: R(pages) });
  const enc = w.add({ Filter: N('Standard'), V: 2, R: 3, Length: 128, P: -44, O: pkg.pdfString('x'.repeat(32)), U: pkg.pdfString('y'.repeat(32)) });
  let b = Buffer.from(w.build(R(cat), null, '1.7')).toString('latin1');
  b = b.replace(/trailer\s*<</, 'trailer\n<< /Encrypt ' + enc + ' 0 R /ID [<00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff>]');
  return new Uint8Array(Buffer.from(b, 'latin1'));
};

/* ================================================================== */
/* QR                                                                  */
/* ================================================================== */

K.qr = () => {
  if (!K._qr) {
    const ctx = context();
    for (const f of ['engine/qr.bundle.js', 'engine/qr-detect.js']) vm.runInContext(fs.readFileSync(path.join(K.ROOT, f), 'utf8'), ctx, { filename: f });
    K._qr = ctx;
  }
  return K._qr;
};
K.raster = (matrix, px, dark, light, quiet) => {
  const n = matrix.length, size = (n + 2 * quiet) * px;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.floor(y / px) - quiet, c = Math.floor(x / px) - quiet;
    const on = r >= 0 && c >= 0 && r < n && c < n && matrix[r][c];
    const v = on ? dark : light, i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  return { width: size, height: size, data };
};

/* ================================================================== */
/* calculators: the spec a page mounts, run as build/content/_engine.js */
/* runs it, with the clock optionally held at a given moment            */
/* ================================================================== */

/** The engine file and slug a calculator page mounts, read from the page. */
K.calcEngine = (url) => {
  const html = fs.readFileSync(path.join(K.ROOT, url.replace(/^\/+/, ''), 'index.html'), 'utf8');
  const m = /MVRTool\.mount\(window\.TOOLS\[['"]([^'"]+)['"]\]/.exec(html);
  if (!m) throw new Error(url + ' mounts no calculator');
  const scripts = [];
  const re = /<script src="\/engine\/((?:calc|tool)[^"]*\.js)"/g;
  let s;
  while ((s = re.exec(html))) scripts.push(s[1]);
  return { slug: m[1], file: scripts.find((f) => f === 'calc-' + m[1] + '.js') || ('calc-' + m[1] + '.js') };
};
/** A Date whose "now" is held at `now` (ISO string or ms); every other use is the real Date. */
K.heldDate = (now) => {
  const t = typeof now === 'number' ? now : new Date(now).getTime();
  class D extends Date {
    constructor(...a) { if (a.length) super(...a); else super(t); }
    static now() { return t; }
  }
  return D;
};
const calcCache = new Map();
/**
 * K.calcSpec('/health/bmi/') — the spec (title, inputs, outputs, compute,
 * formula, tips, faq …). opts.now holds the clock (the examples were
 * captured on 2026-10-04), each held clock gets its own context.
 */
K.calcSpec = (url, opts) => {
  const now = opts && opts.now;
  const e = K.calcEngine(url);
  const key = e.file + '|' + (now || '');
  if (!calcCache.has(key)) {
    const window = { TOOLS: {} };
    const ctx = vm.createContext({ window, console, Intl, Math, Date: now ? K.heldDate(now) : Date, Number, String, Array, Object, JSON, isFinite, isNaN, parseFloat, parseInt });
    vm.runInContext(fs.readFileSync(path.join(K.ROOT, 'engine', e.file), 'utf8'), ctx, { filename: e.file });
    calcCache.set(key, window.TOOLS);
  }
  const t = calcCache.get(key)[e.slug];
  if (!t) throw new Error(e.file + ' defines no TOOLS["' + e.slug + '"]');
  return t;
};
/** The spec's defaults, as the page's inputs hold them (numbers as numbers). */
K.calcDefaults = (spec) => {
  const v = {};
  (spec.inputs || []).forEach((i) => {
    let d = i.default;
    if (i.type === 'number') d = d === null || d === undefined || d === '' ? null : Number(d);
    v[i.key] = d;
  });
  return v;
};
/** compute() on the defaults with `inputs` over them: K.calc('/health/bmi/', { weight: 80 }) */
K.calc = (url, inputs, opts) => {
  const spec = K.calcSpec(url, opts);
  return spec.compute(Object.assign(K.calcDefaults(spec), inputs || {}));
};
/** A "#k=v&…" fragment (or "k=v&…") as inputs, numbers for number inputs. */
K.calcHash = (spec, hash) => {
  const o = {};
  new URLSearchParams(String(hash || '').replace(/^#/, '')).forEach((v, k) => {
    const i = (spec.inputs || []).find((x) => x.key === k);
    o[k] = i && i.type === 'number' ? (v === '' ? null : Number(v)) : v;
  });
  return o;
};
/** An output value as render-core shows it, with no preferences set (the page's own currency). */
K.calcShow = (spec, key, v) => {
  const o = (spec.outputs || []).find((x) => x.key === key) || {};
  const code = spec.currency || 'GBP';
  const loc = code === 'INR' ? 'en-IN' : code === 'USD' ? 'en-US' : code === 'EUR' ? 'de-DE' : 'en-GB';
  const f = o.format || 'number';
  if (f === 'text') return v === null || v === undefined ? '' : String(v);
  if (f === 'auto' && typeof v === 'string') return v;
  if (f === 'percent') return isFinite(v) ? Number(v.toFixed(4)).toLocaleString(loc) + '%' : '—';
  if (f === 'currency') {
    if (!isFinite(v)) return '—';
    try { return v.toLocaleString(loc, { style: 'currency', currency: code, maximumFractionDigits: 2 }); } catch (e) { return code + ' ' + v.toLocaleString(loc, { maximumFractionDigits: 2 }); }
  }
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') return v;
  if (!isFinite(v)) return v > 0 ? '∞' : (isNaN(v) ? '—' : '−∞');
  const abs = Math.abs(v);
  let s;
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e12)) s = v.toExponential(6).replace(/\.?0+e/, 'e');
  else { const dp = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6; s = Number(v.toFixed(dp)).toLocaleString(loc, { maximumFractionDigits: dp }); }
  return o.unit ? s + ' ' + o.unit : s;
};
/** The number in a shown figure: "₹1,23,456.50" → 123456.5, "12.5%" → 12.5, "−3" → -3 */
K.num = (s) => {
  const m = String(s).replace(/−/g, '-').replace(/,/g, '').match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/i);
  return m ? Number(m[0]) : NaN;
};
/** true when `shown` is `v` to the decimals `shown` carries (or 1e-9 relative) */
K.near = (shown, v) => {
  const n = K.num(shown);
  if (!isFinite(n) || !isFinite(v)) return false;
  const dp = ((String(shown).replace(/,/g, '').match(/\.(\d+)/) || [, ''])[1]).length;
  return Math.abs(n - v) <= 0.5 * Math.pow(10, -dp) + 1e-9 * Math.max(1, Math.abs(v));
};

/* ================================================================== */
/* image bytes                                                         */
/* ================================================================== */

K.jpegSegs = (b) => {
  const out = [];
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length - 3) {
    if (b[i] !== 0xff) return out;
    const m = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    out.push({ m, at: i, len, id: b.slice(i + 4, i + 4 + 12).toString('latin1'), body: b.slice(i + 4, i + 2 + len) });
    if (m === 0xda) break;
    i += 2 + len;
  }
  return out;
};
K.pngChunks = (b) => {
  const out = [];
  if (b.length < 8 || b.readUInt32BE(0) !== 0x89504e47) return null;
  let i = 8;
  while (i + 8 <= b.length) {
    const len = b.readUInt32BE(i), type = b.slice(i + 4, i + 8).toString('latin1');
    out.push({ type, data: b.slice(i + 8, i + 8 + len) });
    if (type === 'IEND') break;
    i += 12 + len;
  }
  return out;
};
K.isJpeg = (b) => b && b[0] === 0xff && b[1] === 0xd8;
K.isPng = (b) => b && b.length > 8 && b.readUInt32BE(0) === 0x89504e47;
K.isWebp = (b) => b && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP';
K.kind = (b) => K.isJpeg(b) ? 'jpeg' : K.isPng(b) ? 'png' : K.isWebp(b) ? 'webp' : 'other';
K.jpegScan = (b) => {
  const segs = K.jpegSegs(b);
  const sos = segs[segs.length - 1];
  const end = b.indexOf(Buffer.from([0xff, 0xd9]), sos.at + 2 + sos.len);
  return b.slice(sos.at, end + 2);
};
/** A JPEG with an EXIF APP1 (Make "DemoCam", the given Orientation, a GPS position) after SOI. */
K.withExif = (jpeg, orientation) => {
  const t = [];
  const u16 = (v) => t.push(v >> 8, v & 255);
  const u32 = (v) => t.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const make = Buffer.from('DemoCam\0', 'latin1');
  t.push(0x4d, 0x4d); u16(42); u32(8);
  u16(3);
  u16(0x010f); u16(2); u32(make.length); u32(50);
  u16(0x0112); u16(3); u32(1); u16(orientation || 1); u16(0);
  u16(0x8825); u16(4); u32(1); u32(58);
  u32(0);
  for (const c of make) t.push(c);
  u16(4);
  u16(1); u16(2); u32(2); t.push(0x53, 0, 0, 0);
  u16(2); u16(5); u32(3); u32(112);
  u16(3); u16(2); u32(2); t.push(0x45, 0, 0, 0);
  u16(4); u16(5); u32(3); u32(136);
  u32(0);
  [[44, 1], [6, 1], [3060, 100], [170, 1], [9, 1], [1500, 100]].forEach(([n, d]) => { u32(n); u32(d); });
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from(t)]);
  const head = Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]);
  return Buffer.concat([jpeg.slice(0, 2), head, body, jpeg.slice(2)]);
};
/** an XMP APP1 segment after SOI */
K.withXmp = (jpeg, text) => {
  const body = Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'), Buffer.from(text, 'utf8')]);
  const head = Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]);
  return Buffer.concat([jpeg.slice(0, 2), head, body, jpeg.slice(2)]);
};
K.zipNames = (b) => {
  const names = [];
  let i = 0;
  while ((i = b.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), i)) >= 0) {
    const method = b.readUInt16LE(i + 8);
    const csize = b.readUInt32LE(i + 18), nlen = b.readUInt16LE(i + 26), xlen = b.readUInt16LE(i + 28);
    names.push({ name: b.slice(i + 30, i + 30 + nlen).toString('utf8'), method, size: csize, data: b.slice(i + 30 + nlen + xlen, i + 30 + nlen + xlen + csize) });
    i += 30 + nlen + xlen + csize;
  }
  return names;
};

/* ================================================================== */
/* the browser                                                         */
/* ================================================================== */

function loadPuppeteer() {
  for (const p of [path.join(K.ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}
const outside = [];
K.outsideRequests = () => outside.slice();
K.startBrowser = async () => {
  if (K.browser) return;
  const puppeteer = loadPuppeteer();
  const { serve } = require('../serve.js');
  K.server = await serve(K.ROOT, K.PORT);
  K.browser = await puppeteer.launch({ executablePath: K.CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'], protocolTimeout: 180000 });
};
K.stopBrowser = async () => {
  if (K.browser) { try { await K.browser.close(); } catch (e) { /* */ } K.browser = null; }
  if (K.server) { K.server.close(); K.server = null; }
};

/** Open a page of the site with downloads recorded, every blob URL kept, and outside requests refused and noted.
 *  opts.consent: the analytics choice already made ('denied', the default, or 'granted'). */
K.open = async (url, opts) => {
  const o = opts || {};
  const p = await K.browser.newPage();
  await p.setViewport({ width: 1280, height: 1000 });
  await p.setRequestInterception(true);
  p.__requests = [];
  p.on('request', (r) => {
    const u = r.url();
    if (!/^(data|blob):/.test(u)) p.__requests.push({ method: r.method(), url: u });
    /* with consent granted the analytics scripts are expected to be asked
       for: still refused (no test ever reaches Google or Clarity), kept on
       the page's own list, left out of the run's "outside requests" */
    if (!u.startsWith(K.BASE) && !/^(data|blob):/.test(u)) { if (o.consent !== 'granted') outside.push(url + ' -> ' + u); return r.abort(); }
    r.continue();
  });
  p.__errors = [];
  p.on('pageerror', (e) => p.__errors.push(String(e && e.message || e)));
  await p.evaluateOnNewDocument((consent) => {
    try { localStorage.setItem('1234tools-consent', consent); } catch (e) { /* */ }
    window.__downloads = [];
    window.__blobs = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = function (b) { const u = orig.call(URL, b); try { if (b && typeof b.size === 'number') window.__blobs.push({ u, b }); } catch (e) { /* */ } return u; };
    HTMLAnchorElement.prototype.click = function () {
      const a = this;
      if (a.download) window.__downloads.push(fetch(a.href).then((r) => r.blob()).then(async (b) => ({ name: a.download, type: b.type, bytes: Array.from(new Uint8Array(await b.arrayBuffer())) })));
    };
  }, o.consent || 'denied');
  await p.goto(K.BASE + url, { waitUntil: 'load', timeout: 120000 });
  await p.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  if (o.wait !== false) await p.waitForSelector(o.wait || '.tool-io > *', { timeout: 30000 });
  return p;
};
K.downloads = async (p) => (await p.evaluate(() => Promise.all(window.__downloads))).map((d) => ({ name: d.name, type: d.type, bytes: Buffer.from(d.bytes) }));
K.clearDownloads = (p) => p.evaluate(() => { window.__downloads = []; });
K.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
K.mainText = (p) => p.evaluate(() => document.querySelector('main').innerText);
K.clickText = (p, sel, re) => p.evaluate((sel, src) => {
  const b = [...document.querySelectorAll(sel)].find((x) => new RegExp(src).test(x.textContent));
  if (!b) return false; b.click(); return true;
}, sel, re.source);

/* ---------- image pages ---------- */
K.img = {};
K.img.set = (p, key, v) => p.evaluate((k, v) => {
  const e = document.getElementById('ic-' + k);
  if (!e) throw new Error('no control ' + k);
  if (e.type === 'checkbox') e.checked = !!v; else e.value = String(v);
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
}, key, v);
K.img.previews = (p) => p.$$eval('.tool-io .image-stage img.image-preview', (l) => l.map((i) => i.src));
K.img.act = async (p, fn, timeout) => {
  const before = await K.img.previews(p);
  await fn();
  await p.waitForFunction((old) => {
    const now = [...document.querySelectorAll('.tool-io .image-stage img.image-preview')].map((i) => i.src).filter((s) => s.startsWith('blob:'));
    const m = document.querySelector('.tool-io .io-msg');
    if (m && m.classList.contains('is-error')) return true;
    if (document.querySelector('.tool-io .palette-grid, .tool-io pre.code-out') && !now.length) return true;
    return now.length && now.every((s) => old.indexOf(s) < 0);
  }, { timeout: timeout || 60000, polling: 100 }, before);
  let last = '';
  for (let k = 0; k < 60; k++) {
    await K.sleep(300);
    const now = (await K.img.previews(p)).join('|') + (await p.$eval('.tool-io .stat-grid', (e) => e.textContent).catch(() => ''));
    if (now && now === last) break;
    last = now;
  }
};
K.img.upload = (p, files, timeout) => K.img.act(p, async () => { const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(...files); }, timeout);
K.img.change = async (p, key, v, timeout) => {
  /* a control already at that value starts no new run, so there is nothing to wait for */
  const now = await p.evaluate((k) => { const e = document.getElementById('ic-' + k); return e ? String(e.value) : null; }, key);
  if (now === String(v)) return;
  return K.img.act(p, () => K.img.set(p, key, v), timeout);
};
K.img.results = async (p) => (await p.$$eval('.tool-io .image-stage img.image-preview', (l) => Promise.all(l.filter((i) => i.src.startsWith('blob:')).map(async (i) => Array.from(new Uint8Array(await (await fetch(i.src)).arrayBuffer())))))).map((a) => Buffer.from(a));
K.img.stats = (p) => p.$$eval('.tool-io .stat-row', (l) => l.map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent]));
K.img.stat = (rows, k) => (rows.find((r) => r[0] === k) || [])[1];
K.img.msg = (p) => p.$eval('.tool-io .io-msg', (e) => ({ text: e.textContent, cls: e.className })).catch(() => ({ text: '', cls: '' }));
K.img.caps = (p) => p.$$eval('.tool-io .image-cap', (l) => l.map((c) => c.textContent));
/** decode an encoded image in the page: size, and pixels at [[x, y], …] (negative counts from the far edge) */
K.img.pixels = (p, buf, pts) => p.evaluate(async (arr, pts) => {
  const bm = await createImageBitmap(new Blob([new Uint8Array(arr)]));
  const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
  const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
  return { w: bm.width, h: bm.height, px: (pts || []).map(([a, b]) => Array.from(x.getImageData(a < 0 ? bm.width + a : a, b < 0 ? bm.height + b : b, 1, 1).data)) };
}, Array.from(buf), pts || []);
/** a PNG drawn in the page by a canvas script: fn(ctx, w, h) as source text */
K.img.makePng = async (p, w, h, draw) => Buffer.from(await p.evaluate((w, h, src) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); new Function('x', 'w', 'h', src)(x, w, h);
  return c.toDataURL('image/png').split(',')[1];
}, w, h, draw), 'base64');

/* ---------- PDF pages ---------- */
K.pdf = {};
K.pdf.open = (url) => K.open(url, { wait: '.pdf-run .btn-primary' });
K.pdf.set = async (p, c) => {
  const missing = await p.evaluate((c) => Object.keys(c).filter((k) => {
    const el = document.getElementById('pc-' + k);
    if (!el) return true;
    if (el.tagName === 'SELECT') el.value = String(c[k]);
    else { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, String(c[k])); }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return false;
  }), c);
  if (missing.length) throw new Error('controls not found: ' + missing.join(', '));
};
K.pdf.upload = async (p, files) => {
  const input = await p.$('.tool-io .dropzone input[type=file]');
  for (const f of files) {
    const n = await p.$$eval('.file-list .file-row', (l) => l.length);
    await input.uploadFile(f);
    await p.waitForFunction((k) => document.querySelectorAll('.file-list .file-row').length > k, { timeout: 30000 }, n);
  }
};
K.pdf.press = async (p) => {
  await p.click('.pdf-run .btn-primary');
  await p.waitForFunction(() => { const s = document.querySelector('.pdf-summary'); const m = document.querySelector('.tool-io > .io-msg'); return (s && !s.hidden) || (m && m.classList.contains('is-error')); }, { timeout: 180000 });
  return p.evaluate(() => { const m = document.querySelector('.tool-io > .io-msg'); return { cls: m ? m.className : '', msg: m ? m.textContent : '' }; });
};
K.pdf.download = async (p) => {
  await K.clearDownloads(p);
  const n0 = await p.evaluate(() => window.__blobs.length);
  await p.$eval('.pdf-summary-actions .btn-primary', (b) => b.click());
  await p.waitForFunction((n) => window.__blobs.length > n || window.__downloads.length > 0, { timeout: 60000 }, n0);
  const d = await K.downloads(p);
  if (d.length) return d[0];
  const b64 = await p.evaluate(async (n) => { const b = window.__blobs[window.__blobs.length - 1].b; return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(b); }); }, n0);
  return { name: '', type: '', bytes: Buffer.from(b64, 'base64') };
};
K.pdf.summary = (p) => p.$$eval('.pdf-summary .stat-row', (l) => l.map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent])).catch(() => []);

/** pdf.js, from the site's own copy, on PDF bytes: per page size, text items, and optionally a render with ink probes */
K.pdfjs = (p, bytes, opts) => p.evaluate(async (b64, o) => {
  const lib = await import('/engine/vendor/pdfjs/pdf.min.mjs');
  lib.GlobalWorkerOptions.workerSrc = '/engine/vendor/pdfjs/pdf.worker.min.mjs';
  const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const pdf = await lib.getDocument({ data: u8, standardFontDataUrl: '/engine/vendor/pdfjs/standard_fonts/' }).promise;
  const res = { pages: [], outline: ((await pdf.getOutline()) || []).map((x) => x.title), fields: Object.keys((await pdf.getFieldObjects()) || {}) };
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const row = { w: vp.width, h: vp.height, rotate: pg.rotate, items: tc.items.map((t) => ({ str: t.str, m: lib.Util.transform(vp.transform, t.transform), w: t.width, font: t.fontName })) };
    if (o && o.render) {
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let ink = 0; for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 600) ink++;
      row.ink = ink / (d.length / 4);
    }
    res.pages.push(row);
  }
  return res;
}, Buffer.from(bytes).toString('base64'), opts || {});
