/**
 * The PDF tools' fixes, proved: what a rebuilt file leaves behind, what it
 * keeps, where stamps land, the signature pad, dragging pages, and the line
 * items of the quotation and purchase order.
 *
 *   node build/tests/pdf-fixes.js [--root <site>] [--port 8700] [--out <dir>] [--no-browser]
 *
 * --root defaults to the site this file sits in; it is served on --port
 * (8700–8709) by build/tests/serve.js. The node part runs the shipped files
 * from --root — engine/pdfcore.bundle.js and the engine/pdf-*.js specs — the
 * way a page loads them; build/pdf-package/engine/pdfcore.js (the same
 * engine as a module) writes the fixtures and reads the outputs back. The
 * browser part drives the real pages in headless Chrome and reads results
 * with the site's own pdf.js. Exit code 2 when an assertion fails, 1 when
 * the run itself breaks.
 *
 * The fixture, secrets-<tag>.pdf, is three A4 pages built object by object
 * with pdfcore's writer. Everything that belongs to page 2 carries the marker
 * MARKER-<tag>2: its text, an image only it draws (listed, FPDF-style, in the
 * one resource dictionary every page shares), a comment and its popup, a
 * form field's value and appearance, and a radio kid's tooltip. Links run
 * between all three pages (by /Dest, by GoTo action and by a named
 * destination), every annotation carries /P, and the file has bookmarks
 * (one with a child on page 2, one on page 3 with a child on page 1), a
 * form (a field on page 1 with no appearance, one on page 2, one with a kid
 * on each), Info and XMP.
 *
 *   1  delete page 2: no trace of page 2 in any byte or inflated stream; no
 *      page object beyond the listed pages; links to page 2 gone, the link
 *      to page 3 lands on the new page 2; bookmarks, form, Info, XMP kept
 *   2  extract page 1, and split into single pages: nothing of the others
 *   3  merge two such files: file 2's links land on file 2's pages (also by
 *      pdf.js), each file's bookmarks under an entry named after it, a
 *      clashing field renamed
 *   4  rotate, organise, add text, metadata: what each keeps or strips
 *   5  stamps on pages turned 90/180/270 and cropped: page numbers,
 *      watermark, signature and added text are upright and inside the
 *      visible area, rendered by pdf.js
 *   6  signature: X or Y of 0 is honoured; a drawing is placed as strokes;
 *      the pad on the real page
 *   7  organise: drag to reorder, and the arrow buttons keep the focus
 *   8  quotation and purchase order: thousands separators, ambiguity shown
 *      not guessed, amount in words
 *   9  the merge page's copy and the delete page
 *  10  payslip: blank UAN, PAN and bank print an em dash; delivery challan:
 *      the CGST Rule 55(2) copy markings word for word; signature: one
 *      "legally binding" FAQ, matching its FAQPage JSON-LD
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8700));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-pdf-fixes')));
const BROWSER = !process.argv.includes('--no-browser');
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
function check(ok, what, detail) {
  if (ok) { pass++; console.log('  ok    ' + what); }
  else { fail++; failures.push(what + (detail ? '  (' + detail + ')' : '')); console.log('  FAIL  ' + what + (detail ? '  -> ' + detail : '')); }
}
const group = (t) => console.log('\n' + t);

/* ---------- the engine, as the pages load it ---------- */

const pkg = require(path.join(ROOT, 'build/pdf-package/engine/pdfcore.js'));
const { PDFWriter, PDFStream, Name, Ref, pdfString, isDict, isName } = pkg;

function loadCore() {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'engine/pdfcore.bundle.js'), 'utf8'))(w);
  return w.MVRPdfCore;
}
function loadSpec(id) {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'engine/pdf-' + id + '.js'), 'utf8'))(w);
  return w.PDF_TOOLS[id];
}
/* the helpers inside a spec's closure, for the line-item and words checks */
function specInternals(id, names) {
  const src = fs.readFileSync(path.join(ROOT, 'engine/pdf-' + id + '.js'), 'utf8');
  const body = src.slice(src.indexOf('{') + 1, src.indexOf('window.PDF_TOOLS = '));
  return new Function(body + '; return {' + names.map((n) => n + ': typeof ' + n + ' !== "undefined" ? ' + n + ' : null').join(', ') + '};')();
}
const core = loadCore();

/* ---------- fixtures ---------- */

const N = (s) => new Name(s);
const R = (n) => new Ref(n, 0);
const S = (s) => pdfString(s);
const bytes = (s) => new Uint8Array(Buffer.from(s, 'latin1'));
const flate = (s, d) => new PDFStream(Object.assign({ Filter: N('FlateDecode') }, d || {}), new Uint8Array(zlib.deflateSync(Buffer.from(s, 'latin1'))));

function secrets(tag) {
  const w = new PDFWriter();
  const cat = w.alloc(), pages = w.alloc();
  const p = [w.alloc(), w.alloc(), w.alloc()];
  const font = w.add({ Type: N('Font'), Subtype: N('Type1'), BaseFont: N('Helvetica'), Encoding: N('WinAnsiEncoding') });
  /* 4 x 4 grey pixels: sixteen bytes that spell the marker */
  const img = w.add(new PDFStream({ Type: N('XObject'), Subtype: N('Image'), Width: 4, Height: 4, ColorSpace: N('DeviceGray'), BitsPerComponent: 8 },
    bytes('MARKER-' + tag + '2-IMG!')));
  const res = w.add({ Font: { F1: R(font) }, XObject: { Im2: R(img) } });
  const body = (n, extra) => flate('BT /F1 18 Tf 72 760 Td (MARKER-' + tag + n + '-BODY) Tj ET\n' + extra);
  const c1 = w.add(body(1, 'BT /F1 12 Tf 72 700 Td (Name:) Tj ET'));
  const c2 = w.add(body(2, 'q 40 0 0 40 72 600 cm /Im2 Do Q\nBT /F1 12 Tf 72 700 Td (Sort code 20-00-00, MARKER-' + tag + '2-ACCOUNT) Tj ET'));
  const c3 = w.add(body(3, 'BT /F1 12 Tf 72 700 Td (Terms) Tj ET'));

  const annot = (page, d) => w.add(Object.assign({ Type: N('Annot'), P: R(page), Rect: [72, 500, 200, 520] }, d));
  const l12 = annot(p[0], { Subtype: N('Link'), Dest: [R(p[1]), N('Fit')] });
  const l13 = annot(p[0], { Subtype: N('Link'), A: { S: N('GoTo'), D: [R(p[2]), N('XYZ'), 0, 842, 0] } });
  const lNamed = annot(p[0], { Subtype: N('Link'), Dest: S('toP2') });
  const lNamed1 = annot(p[2], { Subtype: N('Link'), A: { S: N('GoTo'), D: S('toP1') } });
  const lUri = annot(p[0], { Subtype: N('Link'), A: { S: N('URI'), URI: S('https://www.1234tools.com/') } });
  const fName = annot(p[0], { Subtype: N('Widget'), FT: N('Tx'), T: S('name'), V: S(''), Rect: [150, 690, 450, 712], DA: S('/Helv 12 Tf 0 g') });
  const ap2 = w.add(new PDFStream({ Type: N('XObject'), Subtype: N('Form'), BBox: [0, 0, 300, 22], Resources: { Font: { Helv: R(font) } } },
    bytes('BT /Helv 12 Tf 2 6 Td (MARKER-' + tag + '2-WIDGET) Tj ET')));
  const fAcct = annot(p[1], { Subtype: N('Widget'), FT: N('Tx'), T: S('account'), V: S('MARKER-' + tag + '2-FIELD'), Rect: [150, 640, 450, 662], DA: S('/Helv 12 Tf 0 g'), AP: { N: R(ap2) } });
  const choice = w.alloc();
  const k1 = annot(p[0], { Subtype: N('Widget'), Parent: R(choice), Rect: [72, 600, 90, 618], AS: N('Off') });
  const k2 = annot(p[1], { Subtype: N('Widget'), Parent: R(choice), Rect: [72, 560, 90, 578], AS: N('Off'), TU: S('MARKER-' + tag + '2-KID') });
  w.set(choice, { FT: N('Btn'), T: S('choice'), Ff: 49152, Kids: [R(k1), R(k2)] });
  const note = w.alloc(), pop = w.alloc();
  w.set(note, { Type: N('Annot'), Subtype: N('Text'), P: R(p[1]), Rect: [400, 700, 420, 720], Contents: S('MARKER-' + tag + '2-COMMENT'), Popup: R(pop) });
  w.set(pop, { Type: N('Annot'), Subtype: N('Popup'), P: R(p[1]), Rect: [420, 600, 560, 700], Parent: R(note) });
  const l21 = annot(p[1], { Subtype: N('Link'), Dest: [R(p[0]), N('Fit')] });
  const l32 = annot(p[2], { Subtype: N('Link'), Dest: [R(p[1]), N('Fit')] });
  const l31 = annot(p[2], { Subtype: N('Link'), Dest: [R(p[0]), N('Fit')] });

  const page = (i, c, annots) => w.set(p[i], { Type: N('Page'), Parent: R(pages), MediaBox: [0, 0, 595.28, 841.89], Resources: R(res), Contents: R(c), Annots: annots.map(R) });
  page(0, c1, [l12, l13, lNamed, lUri, fName, k1]);
  page(1, c2, [l21, fAcct, k2, note, pop]);
  page(2, c3, [l32, l31, lNamed1]);
  w.set(pages, { Type: N('Pages'), Kids: p.map(R), Count: 3 });

  const tree = w.add({ Names: [S('toP1'), [R(p[0]), N('Fit')], S('toP2'), [R(p[1]), N('Fit')]] });

  /* bookmarks: Cover -> 1; Payment -> 2 { Sort code -> 2 }; Terms -> 3 { Annex -> 1 } */
  const ol = w.alloc(), oCover = w.alloc(), oPay = w.alloc(), oSort = w.alloc(), oTerms = w.alloc(), oAnnex = w.alloc();
  w.set(oCover, { Title: S('Cover'), Parent: R(ol), Next: R(oPay), Dest: [R(p[0]), N('Fit')] });
  w.set(oPay, { Title: S('Payment'), Parent: R(ol), Prev: R(oCover), Next: R(oTerms), First: R(oSort), Last: R(oSort), Count: 1, Dest: [R(p[1]), N('Fit')] });
  w.set(oSort, { Title: S('Sort code'), Parent: R(oPay), A: { S: N('GoTo'), D: [R(p[1]), N('XYZ'), 0, 700, 0] } });
  w.set(oTerms, { Title: S('Terms'), Parent: R(ol), Prev: R(oPay), First: R(oAnnex), Last: R(oAnnex), Count: 1, Dest: [R(p[2]), N('Fit')] });
  w.set(oAnnex, { Title: S('Annex'), Parent: R(oTerms), Dest: S('toP1') });
  w.set(ol, { Type: N('Outlines'), First: R(oCover), Last: R(oTerms), Count: 5 });

  const af = w.add({ Fields: [R(fName), R(fAcct), R(choice)], DA: S('/Helv 0 Tf 0 g'), DR: { Font: { Helv: R(font) } } });
  const xmp = w.add(new PDFStream({ Type: N('Metadata'), Subtype: N('XML') }, bytes(
    '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Secrets ' + tag +
    '</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>')));
  w.set(cat, { Type: N('Catalog'), Pages: R(pages), Outlines: R(ol), AcroForm: R(af), Names: { Dests: R(tree) }, Metadata: R(xmp) });
  const info = w.add({ Title: S('Secrets ' + tag), Author: S('Fixture') });
  return w.build(R(cat), R(info), '1.7');
}

/* Pages turned and cropped: 90, 180, 270, a cropped upright page, and a
   cropped page turned 90. Each says which it is near its visible centre. */
function turned() {
  const w = new PDFWriter();
  const cat = w.alloc(), pages = w.alloc();
  const font = w.add({ Type: N('Font'), Subtype: N('Type1'), BaseFont: N('Helvetica'), Encoding: N('WinAnsiEncoding') });
  const specs = [
    { rotate: 90 }, { rotate: 180 }, { rotate: 270 },
    { crop: [100, 150, 495, 742] }, { rotate: 90, crop: [50, 100, 545, 742] }
  ];
  const kids = specs.map((s, i) => {
    const c = w.add(flate('BT /F1 10 Tf 280 420 Td (fixture page ' + (i + 1) + ') Tj ET'));
    const d = { Type: N('Page'), Parent: R(pages), MediaBox: [0, 0, 595, 842], Resources: { Font: { F1: R(font) } }, Contents: R(c) };
    if (s.rotate) d.Rotate = s.rotate;
    if (s.crop) d.CropBox = s.crop;
    return R(w.add(d));
  });
  w.set(pages, { Type: N('Pages'), Kids: kids, Count: kids.length });
  w.set(cat, { Type: N('Catalog'), Pages: R(pages) });
  return { bytes: w.build(R(cat), null, '1.7'), specs };
}

/* n plain A4 pages saying "ORDER-PAGE-<n>", for the organiser */
function plain(n) {
  return core.createPDF(Array.from({ length: n }, (_, i) => ({ ops: [{ text: 'ORDER-PAGE-' + (i + 1), x: 72, y: 760, size: 20 }] })), {});
}

/* ---------- reading an output back ---------- */

async function analyse(out) {
  const doc = await pkg.PDFDocument.load(out);
  let text = Buffer.from(out).toString('latin1');
  for (const v of doc.objects.values()) {
    if (!(v instanceof PDFStream)) continue;
    try { text += '\n' + Buffer.from(await doc.decodeStream(v)).toString('latin1'); } catch (e) { /* undecodable: raw bytes already counted */ }
    try { text += '\n' + zlib.inflateSync(Buffer.from(v.raw)).toString('latin1'); } catch (e) { /* not deflate */ }
  }
  const pages = await doc.getPages();
  const pageObjs = [...doc.objects.values()].filter((v) => isDict(v) && isName(v.Type, 'Page')).length;
  const root = await doc.resolve(doc.trailer.Root);
  const idx = (ref) => ref instanceof Ref ? pages.findIndex((p) => p.ref && p.ref.num === ref.num) : -1;
  const named = async (key) => {
    const names = await doc.resolve(root.Names);
    const walk = async (ref) => {
      const node = await doc.resolve(ref);
      if (!isDict(node)) return undefined;
      const arr = (await doc.resolve(node.Names)) || [];
      for (let i = 0; i + 1 < arr.length; i += 2) if (Buffer.from(arr[i].__string).toString('latin1') === key) return arr[i + 1];
      for (const k of (await doc.resolve(node.Kids)) || []) { const v = await walk(k); if (v !== undefined) return v; }
      return undefined;
    };
    return isDict(names) ? walk(names.Dests) : undefined;
  };
  const dest = async (d) => {
    d = await doc.resolve(d);
    if (d && d.__string) d = await doc.resolve(await named(Buffer.from(d.__string).toString('latin1')));
    if (isDict(d) && d.D) d = await doc.resolve(d.D);
    return Array.isArray(d) ? idx(d[0]) + 1 : null;
  };
  const links = async (i) => {
    const arr = (await doc.resolve(pages[i].dict.Annots)) || [];
    const outl = [];
    for (const r of arr) {
      const a = await doc.resolve(r);
      if (!isDict(a)) continue;
      const row = { subtype: a.Subtype && a.Subtype.name, p: a.P ? idx(a.P) + 1 : null };
      if (a.Dest !== undefined) row.to = await dest(a.Dest);
      const act = await doc.resolve(a.A);
      if (isDict(act) && isName(act.S, 'GoTo')) row.to = await dest(act.D);
      if (isDict(act) && isName(act.S, 'URI')) row.uri = true;
      outl.push(row);
    }
    return outl;
  };
  const outline = async () => {
    const ol = await doc.resolve(root.Outlines);
    const walk = async (ref) => {
      const list = [];
      while (ref) {
        const it = await doc.resolve(ref);
        if (!isDict(it)) break;
        const t = await doc.resolve(it.Title);
        let to = null;
        if (it.Dest !== undefined) to = await dest(it.Dest);
        const act = await doc.resolve(it.A);
        if (isDict(act) && isName(act.S, 'GoTo')) to = await dest(act.D);
        list.push({ title: t ? pkg.decodePdfString(t.__string) : '', to, kids: await walk(it.First) });
        ref = it.Next;
      }
      return list;
    };
    return isDict(ol) ? walk(ol.First) : [];
  };
  const fields = async () => {
    const af = await doc.resolve(root.AcroForm);
    if (!isDict(af)) return null;
    const out = { need: (await doc.resolve(af.NeedAppearances)) === true, names: [], kids: {} };
    for (const r of (await doc.resolve(af.Fields)) || []) {
      const f = await doc.resolve(r);
      const name = f && f.T ? pkg.decodePdfString(f.T.__string) : '?';
      out.names.push(name);
      const k = await doc.resolve(f.Kids);
      if (Array.isArray(k)) out.kids[name] = k.length;
    }
    return out;
  };
  return { doc, text, pages, pageObjs, root, links, outline, fields, info: await doc.getInfo() };
}

const flat = (ol) => ol.map((e) => e.title + (e.to ? '@' + e.to : '') + (e.kids.length ? '{' + flat(e.kids) + '}' : '')).join(', ');

async function runSpec(id, files, opts) {
  const docs = [];
  for (const f of files) docs.push({ doc: await core.PDFDocument.load(f.bytes), name: f.name });
  const res = await loadSpec(id).run({ docs, opts, core });
  if (res.error) throw new Error(id + ': ' + res.error);
  return res;
}

/* ================================================================== */

async function nodePart() {
  const A = secrets('A'), B = secrets('B');
  fs.writeFileSync(path.join(OUT, 'secrets-A.pdf'), A);
  fs.writeFileSync(path.join(OUT, 'secrets-B.pdf'), B);

  group('0  the fixture holds what the tests say it does');
  const src = await analyse(A);
  check(src.pages.length === 3 && /MARKER-A2-BODY/.test(src.text) && /MARKER-A2-IMG!/.test(src.text) && /MARKER-A2-COMMENT/.test(src.text),
    'secrets-A.pdf: 3 pages, page 2 marked in its text, image and comment');
  check(flat(await src.outline()) === 'Cover@1, Payment@2{Sort code@2}, Terms@3{Annex@1}', 'its bookmarks', flat(await src.outline()));

  group('1  delete page 2');
  const del = (await runSpec('delete-pdf-pages', [{ name: 'secrets-A.pdf', bytes: A }], { pages: '2' })).files[0].bytes;
  fs.writeFileSync(path.join(OUT, 'deleted.pdf'), del);
  const d = await analyse(del);
  check(d.pages.length === 2, 'two pages listed');
  check(!/MARKER-A2/.test(d.text), 'no trace of page 2 in the bytes or any inflated stream',
    (d.text.match(/MARKER-A2-[A-Z!]+/g) || []).join(' '));
  check(d.pageObjs === 2, 'no page object beyond the two listed', d.pageObjs + ' /Type /Page objects');
  check(/MARKER-A1-BODY/.test(d.text) && /MARKER-A3-BODY/.test(d.text), 'pages 1 and 3 are intact');
  const d1 = await d.links(0), d2 = await d.links(1);
  check(!d1.some((l) => l.subtype === 'Link' && (l.to === null || l.to === 0)) && d1.filter((l) => l.subtype === 'Link' && !l.uri).map((l) => l.to).join() === '2',
    'page 1 keeps only its link to old page 3, now pointing at page 2', JSON.stringify(d1));
  check(d1.some((l) => l.uri), 'the web link stays');
  check(d1.every((l) => l.p === 1) && d2.every((l) => l.p === 2), 'every annotation\'s /P is its new page');
  check(d2.filter((l) => l.subtype === 'Link').map((l) => l.to).sort().join() === '1,1', 'old page 3: the link to page 2 is gone, both links to page 1 (one named) land on page 1', JSON.stringify(d2));
  check(flat(await d.outline()) === 'Cover@1, Terms@2{Annex@1}', 'bookmarks: those to page 2 dropped, the rest remapped', flat(await d.outline()));
  const df = await d.fields();
  check(df && df.names.join() === 'name,choice' && df.kids.choice === 1, 'form: the page-2 field gone, the shared field keeps its page-1 kid', JSON.stringify(df));
  check(df && df.need === true, 'NeedAppearances is set: the name field has no appearance');
  check(d.info.Title === 'Secrets A' && d.info.Author === 'Fixture', 'Info kept (Title, Author)', JSON.stringify(d.info));
  check(d.root.Metadata !== undefined && /Secrets A<\/rdf:li>/.test(d.text), 'XMP kept');

  group('2  extract page 1; split into single pages');
  const ex = await analyse((await runSpec('extract-pdf-pages', [{ name: 'secrets-A.pdf', bytes: A }], { pages: '1', order: 'asis' })).files[0].bytes);
  check(ex.pages.length === 1 && ex.pageObjs === 1, 'one page, one page object');
  check(!/MARKER-A2|MARKER-A3/.test(ex.text), 'nothing of pages 2 or 3', (ex.text.match(/MARKER-A[23]-[A-Z!]+/g) || []).join(' '));
  check((await ex.links(0)).filter((l) => l.subtype === 'Link').every((l) => l.uri), 'only the web link remains among the links');
  check(flat(await ex.outline()) === 'Cover@1, Annex@1', 'bookmarks: Annex moves up when Terms\' page is gone', flat(await ex.outline()));
  const sp = (await runSpec('split-pdf', [{ name: 'secrets-A.pdf', bytes: A }], { mode: 'each' })).files;
  let own = sp.length === 3;
  for (let i = 0; i < sp.length; i++) {
    const t = (await analyse(sp[i].bytes)).text;
    const others = [1, 2, 3].filter((n) => n !== i + 1).map((n) => 'MARKER-A' + n);
    if (!new RegExp('MARKER-A' + (i + 1) + '-BODY').test(t) || others.some((m) => t.indexOf(m) >= 0)) own = false;
  }
  check(own, 'split, one file per page: each file holds its own page and nothing of the others');

  group('3  merge two such files');
  const mg = (await runSpec('merge-pdf', [{ name: 'first.pdf', bytes: A }, { name: 'second.pdf', bytes: B }], { ranges: 'all', keepMeta: 'strip', title: '' })).files[0].bytes;
  fs.writeFileSync(path.join(OUT, 'merged.pdf'), mg);
  const m = await analyse(mg);
  check(m.pages.length === 6 && m.pageObjs === 6, 'six pages, six page objects');
  const m4 = (await m.links(3)).filter((l) => l.subtype === 'Link' && !l.uri).map((l) => l.to);
  check(m4.join() === '5,6,5', 'file 2 page 1: its links land on file 2\'s pages 2, 3 and (named) 2 = 5, 6, 5', m4.join());
  const m6 = (await m.links(5)).filter((l) => l.subtype === 'Link').map((l) => l.to);
  check(m6.join() === '5,4,4', 'file 2 page 3: links land on 5, 4, 4', m6.join());
  const m1 = (await m.links(0)).filter((l) => l.subtype === 'Link' && !l.uri).map((l) => l.to);
  check(m1.join() === '2,3,2', 'file 1 page 1: links land on 2, 3, 2', m1.join());
  check(flat(await m.outline()) === 'first@1{Cover@1, Payment@2{Sort code@2}, Terms@3{Annex@1}}, second@4{Cover@4, Payment@5{Sort code@5}, Terms@6{Annex@4}}',
    'each file\'s bookmarks under an entry named after it', flat(await m.outline()));
  const mf = await m.fields();
  check(mf && mf.names.join() === 'name,account,choice,name_2,account_2,choice_2', 'both forms kept; the second file\'s clashing names renamed', mf && mf.names.join());
  check(JSON.stringify(m.info) === '{}' && m.root.Metadata === undefined, 'metadata stripped by default, XMP too');
  const mk = await analyse((await runSpec('merge-pdf', [{ name: 'first.pdf', bytes: A }, { name: 'second.pdf', bytes: B }], { ranges: '1 | 3', keepMeta: 'first', title: '' })).files[0].bytes);
  check(mk.pages.length === 2 && !/MARKER-A2|MARKER-A3|MARKER-B1|MARKER-B2/.test(mk.text), 'merge "1 | 3": nothing of the pages left out', (mk.text.match(/MARKER-[AB][123]-[A-Z!]+/g) || []).filter((x) => !/A1|B3/.test(x)).join(' '));
  check(flat(await mk.outline()) === 'first@1{Cover@1, Annex@1}, second@2{Terms@2}', 'and the bookmarks that survive', flat(await mk.outline()));
  check(mk.info.Title === 'Secrets A' && /Secrets A<\/rdf:li>/.test(mk.text), 'keepMeta first: the first file\'s Info and XMP');

  group('4  rotate, organise, add text, metadata');
  const rot = await analyse((await runSpec('rotate-pdf', [{ name: 'secrets-A.pdf', bytes: A }], { angle: '90', pages: 'all' })).files[0].bytes);
  check(rot.pageObjs === 3 && rot.info.Title === 'Secrets A' && rot.root.Metadata !== undefined &&
    flat(await rot.outline()) === flat(await src.outline()) && (await rot.fields()).names.join() === 'name,account,choice',
    'rotate keeps Title, XMP, every bookmark and every field');
  const docA = await core.PDFDocument.load(A);
  const org = await analyse(await core.assemble([2, 0].map((i) => ({ doc: docA, pageIndex: i, rotate: 90 })), {}));
  check(!/MARKER-A2/.test(org.text) && flat(await org.outline()) === 'Cover@2, Terms@1{Annex@2}', 'organise (3, 1 rotated, 2 removed): page 2 gone, bookmarks follow the new order', flat(await org.outline()));
  const ed = await analyse((await runSpec('pdf-editor', [{ name: 'secrets-A.pdf', bytes: A }], { text: 'Added line', size: 12, colour: '#000000', x: 72, y: 300, pages: '1', width: 0, items: [] })).files[0].bytes);
  check(ed.info.Title === 'Secrets A' && ed.root.Metadata !== undefined && (await ed.outline()).length === 3 && (await ed.fields()).names.length === 3,
    'add text keeps Title, XMP, bookmarks and form');
  const ms = await analyse((await runSpec('pdf-metadata', [{ name: 'secrets-A.pdf', bytes: A }], { action: 'strip' })).files[0].bytes);
  check(JSON.stringify(ms.info) === '{}' && ms.root.Metadata === undefined && !/Secrets A/.test(ms.text), 'metadata strip removes Info and XMP');
  check((await ms.outline()).length === 3 && (await ms.fields()).names.length === 3, 'and keeps bookmarks and form, which are not metadata');

  group('6  signature: 0 is a position; a drawing is strokes');
  const one = plain(1);
  const sig0 = (await runSpec('pdf-signature', [{ name: 'one.pdf', bytes: one }], { signatureText: 'AT-ZERO', date: 'no', x: 0, y: 0, pages: '1', drawn: null, drawWidth: 150 })).files[0].bytes;
  check(/1 0 0 1 0 0 Tm\n\(AT-ZERO\) Tj/.test((await analyse(sig0)).text), 'X 0, Y 0 writes the text at 0, 0 (it used to be 400, 100)');
  const sigX0 = (await runSpec('pdf-signature', [{ name: 'one.pdf', bytes: one }], { signatureText: 'X-ZERO', date: 'no', x: '0', y: '250', pages: '1', drawn: null })).files[0].bytes;
  check(/1 0 0 1 0 250 Tm/.test((await analyse(sigX0)).text), 'X "0" from the box with Y 250');
  const drawn = { w: 360, h: 120, strokes: [[[20, 90], [60, 30], [100, 90], [140, 30]], [[200, 60]]] };
  const sres = await runSpec('pdf-signature', [{ name: 'one.pdf', bytes: one }], { signatureText: '', date: 'no', x: 50, y: 60, pages: '1', drawn, drawWidth: 150 });
  const st = (await analyse(sres.files[0].bytes)).text;
  /* ink 20..200 x 30..90 pad units, scaled 150/180: the first point (20, 90)
     is the bottom-left corner, (200, 60) lands 150 right and 25 up */
  check(/1\.4 w/.test(st) && /\n50 60 m\n/.test(st) && /\n200 85 m\n200 85 l\n/.test(st) && (st.match(/\nS\n/g) || []).length >= 2,
    'a drawing becomes stroked paths, scaled to 150 points wide, bottom-left at X, Y');
  check(sres.stats.some((r) => r[0] === 'Signature' && r[1] === 'Drawn'), 'the stats say it was drawn');
  let empty = null;
  try { await runSpec('pdf-signature', [{ name: 'one.pdf', bytes: one }], { signatureText: '  ', date: 'yes', x: 1, y: 1, pages: '1', drawn: null }); }
  catch (e) { empty = e.message; }
  check(/Type a signature or draw one/.test(empty || ''), 'neither typed nor drawn: asked for one', empty);

  group('8  quotation and purchase order');
  for (const id of ['quotation-pdf', 'purchase-order-pdf']) {
    const f = specInternals(id, ['parseLineItems', 'amountWords']);
    const one1 = (t) => { const r = f.parseLineItems(t, 'Nos'); return r.rows.length === 1 && !r.ambiguous.length && !r.bad.length ? r.rows[0] : r; };
    const a = one1('Item, 2, 2,650');
    check(a.qty === 2 && a.rate === 2650 && a.desc === 'Item', id + ': "Item, 2, 2,650" is 2 at 2,650', JSON.stringify(a));
    const b = one1('Item, 1, 1,25,000');
    check(b.qty === 1 && b.rate === 125000, id + ': "Item, 1, 1,25,000" is 1 at 1,25,000 (Indian grouping)', JSON.stringify(b));
    const c = one1('Item x2 @ 2,650');
    check(c.qty === 2 && c.rate === 2650 && c.desc === 'Item', id + ': "Item x2 @ 2,650" is 2 at 2,650', JSON.stringify(c));
    const w1 = one1('Steel, 7308, 1,000, Kg, 1,234,567.50, 5%');
    check(w1.hsn === '7308' && w1.qty === 1000 && w1.unit === 'Kg' && w1.rate === 1234567.5 && w1.disc === 5, id + ': western grouping in quantity and rate, with HSN, unit and discount', JSON.stringify(w1));
    const amb = f.parseLineItems('Item,2,2,650', 'Nos');
    check(!amb.rows.length && amb.ambiguous.length === 1 && /can be read 2 ways/.test(amb.ambiguous[0].message), id + ': "Item,2,2,650" (no spaces) is reported as ambiguous, not guessed', JSON.stringify(amb));
    const odd = f.parseLineItems('Item, 2, 2,65', 'Nos');
    check(!odd.rows.length && odd.ambiguous.length === 1 && /2,65/.test(odd.ambiguous[0].message), id + ': "2,65" is not a grouped number and is reported', JSON.stringify(odd));
    const keep = f.parseLineItems('Consulting,2,500\nSite survey and structural report, 998346, 1, Job, 25000', 'Nos');
    check(keep.rows.length === 2 && keep.rows[0].qty === 2 && keep.rows[0].rate === 500 && keep.rows[1].hsn === '998346' && keep.rows[1].rate === 25000,
      id + ': lines that were always read right still are', JSON.stringify(keep.rows.map((r) => [r.qty, r.rate])));
    const words = {
      0: 'Pounds Zero Only', 1: 'Pounds One Only', 101: 'Pounds One Hundred and One Only', 1001: 'Pounds One Thousand and One Only',
      2650.5: 'Pounds Two Thousand Six Hundred and Fifty and Fifty Pence Only', 125000: 'Pounds One Hundred and Twenty-Five Thousand Only'
    };
    for (const [v, want] of Object.entries(words)) {
      const got = f.amountWords(Number(v), 'GBP');
      check(got === want, id + ': ' + v + ' in GBP words', got);
    }
    check(f.amountWords(2650.5, 'USD') === 'Dollars Two Thousand Six Hundred and Fifty and Fifty Cents Only' &&
      f.amountWords(1100, 'EUR') === 'Euros One Thousand One Hundred Only', id + ': USD and EUR the same way');
    check(f.amountWords(125000, 'INR') === 'Rupees One Lakh Twenty-Five Thousand Only' && f.amountWords(2650.5, 'INR') === 'Rupees Two Thousand Six Hundred and Fifty and Fifty Paise Only',
      id + ': INR unchanged');
    check(!/\band and\b|\bThousand and \w+ Hundred\b/.test([0, 1, 101, 1001, 2650.5, 125000, 1100, 1234567.89].map((v) => f.amountWords(v, 'GBP')).join(' ')), id + ': never "and and", never "Thousand and Six Hundred"');
  }
  const qerr = await loadSpec('quotation-pdf').run({ docs: [], opts: Object.assign(defaults('quotation-pdf'), { items: 'Item,2,2,650' }), core });
  check(qerr.error && /can be read 2 ways/.test(qerr.error), 'quotation run: an ambiguous line stops the run with the readings', qerr.error);
  const qok = await loadSpec('quotation-pdf').run({ docs: [], opts: Object.assign(defaults('quotation-pdf'), { items: 'Item, 2, 2,650', taxMode: 'none', currency: 'INR' }), core });
  const qt = qok.files ? (await analyse(qok.files[0].bytes)).text : '';
  check(/5,300\.00/.test(qt) && /2,650\.00/.test(qt), 'quotation run: the PDF prices 2 at 2,650.00 = 5,300.00', qok.error);
  const perr = await loadSpec('purchase-order-pdf').run({ docs: [], opts: Object.assign(defaults('purchase-order-pdf'), { items: 'Item,2,2,650' }), core });
  check(perr.error && /can be read 2 ways/.test(perr.error), 'purchase-order run: the same', perr.error);
  const dc = specInternals('delivery-challan-pdf', ['amountWords']);
  check(dc.amountWords(2650.5, 'GBP') === 'Pounds Two Thousand Six Hundred and Fifty and Fifty Pence Only', 'delivery challan words (same function) fixed too', dc.amountWords(2650.5, 'GBP'));

  group('10 payslip blanks, challan copy markings, the signature FAQ');
  /* a blank UAN, PAN or bank account is drawn as an em dash: WinAnsi byte 0x97, octal \227 */
  const ps = await runSpec('payslip-pdf', [], Object.assign(defaults('payslip-pdf'), { uan: '', pan: '', bank: '' }));
  const pst = (await analyse(ps.files[0].bytes)).text;
  /* the label's own Tj, then the very next Tj is the lone dash */
  const dashAfter = (label) => new RegExp('\\(' + label.replace(/[/]/g, '\\/') + '\\) Tj(?:(?!Tj)[\\s\\S]){0,200}\\((?:\\\\227|\\x97)\\) Tj').test(pst);
  const dashed = ['PAN', 'UAN', 'BANK ACCOUNT / UPI'].filter(dashAfter);
  check(dashed.length === 3 && /\/Encoding\s*\/WinAnsiEncoding/.test(pst), 'payslip: blank UAN, PAN and bank each print an em dash in a WinAnsi font', 'dash after: ' + dashed.join(', '));
  const ps1 = await runSpec('payslip-pdf', [], defaults('payslip-pdf'));
  const ps1t = (await analyse(ps1.files[0].bytes)).text;
  check(!/\((?:\\227|\x97)\) Tj/.test(ps1t) && /\(100123456789\) Tj/.test(ps1t), 'payslip: a filled UAN prints itself, no dash', '');
  /* CGST Rule 55(2), word for word, including the Rule's spelling CONSIGNER */
  const ch = await runSpec('delivery-challan-pdf', [], Object.assign(defaults('delivery-challan-pdf'), { copies: '3' }));
  const cht = (await analyse(ch.files[0].bytes)).text;
  check(['ORIGINAL FOR CONSIGNEE', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR CONSIGNER'].every((s) => cht.indexOf(s) >= 0) && cht.indexOf('FOR CONSIGNOR') < 0,
    'challan: the three copies carry the Rule 55(2) markings, TRIPLICATE FOR CONSIGNER', (cht.match(/TRIPLICATE FOR \w+/) || ['none'])[0]);
  const sg = loadSpec('pdf-signature');
  check((sg.faq || []).length === 1 && !/PKI|additional libraries/.test(JSON.stringify(sg.faq)), 'signature: one "legally binding" FAQ, not two near-duplicates', (sg.faq || []).map((f) => f.q).join(' | '));
  const sgPage = path.join(ROOT, 'pdf/pdf-signature/index.html');
  if (fs.existsSync(sgPage)) {
    const h = fs.readFileSync(sgPage, 'utf8');
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch (e) { return null; } });
    const all = []; const walk = (x) => { if (!x || typeof x !== 'object') return; if (x['@type'] === 'FAQPage') all.push(x); Object.values(x).forEach(walk); }; ld.forEach(walk);
    const qs = all.flatMap((f) => (f.mainEntity || []).map((e) => e.name));
    const visible = [...h.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    check(qs.filter((q) => /legally binding/i.test(q)).length === 1 && qs.every((q) => visible.some((v) => v.replace(/&#39;|&rsquo;/g, '’') === q.replace(/'/g, '’') || v === q)),
      'signature page: FAQPage JSON-LD has one "legally binding" question and every question is on the page', qs.join(' | '));
  }
}

function defaults(id) {
  const o = {};
  for (const c of loadSpec(id).controls || []) o[c.key] = c.default === 'TODAY' ? '2026-10-04' : c.default;
  return o;
}

/* ================================================================== */

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}

function hook() {
  try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* */ }
  const blobs = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = function (o) { const u = orig.call(URL, o); try { if (o && typeof o.size === 'number') blobs.push(o); } catch (e) { /* */ } return u; };
  const names = [];
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) names.push(this.download); return click.call(this); };
  window.__h = {
    blobs, names,
    b64: (i) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blobs[i]); }),
    set(el, v) {
      if (!el) return false;
      if (el.tagName === 'SELECT') { el.value = String(v); }
      else { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, String(v)); }
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  };
}

let browser, server, driving = null;

async function open(tool) {
  const page = await browser.newPage();
  driving = page;
  await page.setViewport({ width: 1280, height: 1000 });
  await page.evaluateOnNewDocument(hook);
  await page.goto(BASE + tool, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  await page.waitForSelector('.pdf-run .btn-primary', { timeout: 30000 });
  return page;
}
async function setControls(page, c) {
  const missing = await page.evaluate((c) => Object.keys(c).filter((k) => !window.__h.set(document.getElementById('pc-' + k), c[k])), c);
  if (missing.length) throw new Error('controls not found: ' + missing.join(', '));
}
async function upload(page, files) {
  const input = await page.$('.tool-io .dropzone input[type=file]');
  for (const f of files) {
    const n = await page.$$eval('.file-list .file-row', (l) => l.length);
    await input.uploadFile(f);
    await page.waitForFunction((k) => document.querySelectorAll('.file-list .file-row').length > k, { timeout: 30000 }, n);
  }
  await page.waitForFunction(() => !document.querySelector('.file-list .file-row.is-loading'), { timeout: 60000 });
}
async function press(page) {
  await page.click('.pdf-run .btn-primary');
  await page.waitForFunction(() => { const s = document.querySelector('.pdf-summary'); const m = document.querySelector('.tool-io > .io-msg'); return (s && !s.hidden) || (m && m.classList.contains('is-error')); }, { timeout: 120000 });
  return page.evaluate(() => { const m = document.querySelector('.tool-io > .io-msg'); return { cls: m.className, msg: m.textContent }; });
}
async function download(page) {
  const n0 = await page.evaluate(() => window.__h.blobs.length);
  await page.$eval('.pdf-summary-actions .btn-primary', (b) => b.click());
  await page.waitForFunction((n) => window.__h.blobs.length > n, { timeout: 30000 }, n0);
  return new Uint8Array(Buffer.from(await page.evaluate((n) => window.__h.b64(n), n0), 'base64'));
}

/* pdf.js on a PDF, in the page: per page the viewport, every text item's
   matrix in viewport space, link targets, the outline, and ink counts. */
async function pdfjs(page, pdfBytes, probes) {
  /* A tab behind another one is throttled: pdf.js's render never finishes
     there, and nor does a click's wait for the element. So the reading tab
     comes forward for the read, and the tab being driven goes back after. */
  await page.bringToFront();
  try { return await readWithPdfjs(page, pdfBytes, probes); }
  finally { if (driving && !driving.isClosed()) await driving.bringToFront(); }
}
async function readWithPdfjs(page, pdfBytes, probes) {
  return page.evaluate(async (b64, probes) => {
    const lib = await import('/engine/vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = '/engine/vendor/pdfjs/pdf.worker.min.mjs';
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const pdf = await lib.getDocument({ data: u8, standardFontDataUrl: '/engine/vendor/pdfjs/standard_fonts/' }).promise;
    const outline = await pdf.getOutline();
    const out = { pages: [], outline: (outline || []).map((o) => ({ title: o.title, kids: (o.items || []).map((k) => k.title) })) };
    for (let p = 1; p <= pdf.numPages; p++) {
      const pg = await pdf.getPage(p);
      const vp = pg.getViewport({ scale: 1 });
      const tc = await pg.getTextContent();
      const items = tc.items.map((it) => ({ str: it.str, m: lib.Util.transform(vp.transform, it.transform), w: it.width }));
      const links = [];
      for (const a of await pg.getAnnotations()) {
        if (a.subtype !== 'Link' || !a.dest) continue;
        let d = a.dest;
        if (typeof d === 'string') d = await pdf.getDestination(d);
        links.push(d ? (await pdf.getPageIndex(d[0])) + 1 : null);
      }
      const row = { w: vp.width, h: vp.height, items, links, ink: [] };
      const want = (probes || []).filter((x) => x.page === p);
      if (want.length) {
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
        for (const pr of want) {
          const [x, y, w, h] = pr.rect.map(Math.round);
          const d = ctx.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h)).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) n++;
          row.ink.push(n);
        }
      }
      out.pages.push(row);
    }
    return out;
  }, Buffer.from(pdfBytes).toString('base64'), probes || []);
}

const upright = (m) => m[0] > 0 && Math.abs(m[1]) < 1e-3 && Math.abs(m[2]) < 1e-3 && m[3] < 0;
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function browserPart() {
  const puppeteer = loadPuppeteer();
  const { serve } = require('./serve.js');
  server = await serve(ROOT, PORT);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], protocolTimeout: 90000 });
  const requests = new Set();

  const probe = await open('/pdf/merge-pdf/');
  probe.on('request', (r) => { try { requests.add(new URL(r.url()).host); } catch (e) { /* */ } });

  group('3b merge, read by pdf.js');
  const mg = await pdfjs(probe, fs.readFileSync(path.join(OUT, 'merged.pdf')));
  check(mg.pages[3].links.join() === '5,6,5', 'pdf.js: file 2\'s first page links to pages 5, 6, 5', mg.pages[3].links.join());
  check(mg.pages[0].links.join() === '2,3,2', 'pdf.js: file 1\'s first page links to pages 2, 3, 2', mg.pages[0].links.join());
  check(mg.outline.map((o) => o.title).join() === 'first,second' && mg.outline[1].kids.join() === 'Cover,Payment,Terms', 'pdf.js: one bookmark per file, its own underneath', JSON.stringify(mg.outline));

  group('5  stamps on turned and cropped pages, rendered by pdf.js');
  const T = turned();
  fs.writeFileSync(path.join(OUT, 'turned.pdf'), T.bytes);
  const runs = [
    ['pdf-page-numbers', { format: 'page-n-of-t', position: 'bc', start: 1, skip: 0, size: 10, colour: '#000000', extra: '' }, 'Page 1 of 5'],
    ['watermark-pdf', { text: 'WMARK', size: 40, angle: '0', colour: '#000000', opacity: 100, position: 'center', pages: 'all' }, 'WMARK'],
    ['pdf-signature', { signatureText: 'SIGNED-HERE', date: 'no', x: 40, y: 50, pages: 'all', drawn: null, drawWidth: 150 }, 'SIGNED-HERE'],
    ['pdf-editor', { text: 'ADDED-TEXT', size: 12, colour: '#000000', x: 40, y: 50, pages: 'all', width: 0, items: [] }, 'ADDED-TEXT']
  ];
  for (const [id, opts, label] of runs) {
    const outBytes = (await runSpec(id, [{ name: 'turned.pdf', bytes: T.bytes }], opts)).files[0].bytes;
    fs.writeFileSync(path.join(OUT, 'turned-' + id + '.pdf'), outBytes);
    const probes = [];
    for (let p = 1; p <= 5; p++) {
      /* where the ink must be, in viewport pixels at scale 1 */
      const frame = await core.pageFrame(await core.PDFDocument.load(T.bytes), p - 1);
      const W = frame.width, H = frame.height;
      if (id === 'pdf-page-numbers') probes.push({ page: p, rect: [W / 2 - 40, H - 32 - 9, 80, 12] });
      else if (id === 'watermark-pdf') probes.push({ page: p, rect: [W / 2 - 60, H / 2 - 20, 120, 28] });
      else probes.push({ page: p, rect: [40, H - 50 - 10, 80, 12] });
    }
    const rep = await pdfjs(probe, outBytes, probes);
    for (let p = 1; p <= 5; p++) {
      const pg = rep.pages[p - 1];
      const it = pg.items.find((x) => x.str.indexOf(id === 'pdf-page-numbers' ? 'Page ' + p + ' of 5' : label) >= 0);
      const s = T.specs[p - 1];
      const what = id + ', page ' + p + ' (' + (s.rotate ? 'rotated ' + s.rotate : '') + (s.rotate && s.crop ? ', ' : '') + (s.crop ? 'cropped' : '') + ')';
      if (!it) { check(false, what + ': the stamp is found by pdf.js'); continue; }
      const m = it.m, x = m[4], y = m[5];
      let placed;
      if (id === 'pdf-page-numbers') placed = near(x + it.w / 2, pg.w / 2, 3) && near(y, pg.h - 32, 2);
      else if (id === 'watermark-pdf') placed = near(x + it.w / 2, pg.w / 2, 6) && Math.abs(y - pg.h / 2) < 30;
      else placed = near(x, 40, 1.5) && near(y, pg.h - 50, 1.5);
      check(upright(m) && x >= 0 && x + it.w <= pg.w + 0.5 && y <= pg.h && y - 12 >= 0 && placed && pg.ink[0] > 15,
        what + ': upright, inside the visible ' + Math.round(pg.w) + ' × ' + Math.round(pg.h) + ', where it was asked for, and drawn',
        'm=' + m.map((v) => Math.round(v * 100) / 100).join(' ') + ' ink=' + pg.ink[0]);
    }
  }

  group('6b the signature pad, on the real page');
  const one = path.join(OUT, 'one.pdf');
  fs.writeFileSync(one, plain(1));
  const sg = await open('/pdf/pdf-signature/');
  check(await sg.$('canvas.draw-canvas#pc-drawn') !== null && /Draw or type/.test(await sg.$eval('.lede', (e) => e.textContent)), 'the page offers a pad, and says draw or type');
  await upload(sg, [one]);
  await setControls(sg, { signatureText: '', date: 'no', x: 0, y: 0, pages: '1' });
  await sg.$eval('#pc-drawn', (e) => window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - 300, behavior: 'instant' }));
  const box = await (await sg.$('#pc-drawn')).boundingBox();
  await sg.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.7);
  await sg.mouse.down();
  for (let i = 1; i <= 12; i++) await sg.mouse.move(box.x + box.width * (0.1 + i * 0.06), box.y + box.height * (i % 2 ? 0.25 : 0.7), { steps: 3 });
  await sg.mouse.up();
  const r1 = await press(sg);
  check(!/is-error/.test(r1.cls), 'Add signature with only a drawing works', r1.msg);
  const sb = await download(sg);
  const st = (await analyse(sb)).text;
  check((st.match(/ l\n/g) || []).length >= 12 && /1 J\n1 j/.test(st), 'the downloaded file has the drawing as round-capped strokes');
  const sr = await pdfjs(probe, sb, [{ page: 1, rect: [0, 842 - 52, 155, 52] }, { page: 1, rect: [300, 300, 200, 200] }]);
  check(sr.pages[0].ink[0] > 60 && sr.pages[0].ink[1] === 0, 'pdf.js draws it at the bottom-left corner, X 0 and Y 0, and nowhere else', 'ink ' + sr.pages[0].ink.join('/'));
  await sg.click('.draw-clear');
  await setControls(sg, { signatureText: 'TYPED-ZERO', x: 0, y: 300 });
  await press(sg);
  const tr = await pdfjs(probe, await download(sg));
  const ti = tr.pages[0].items.find((i) => i.str === 'TYPED-ZERO');
  check(ti && near(ti.m[4], 0, 0.5) && near(ti.m[5], tr.pages[0].h - 300, 0.5), 'cleared and typed, X 0: the text starts at the left edge', ti && ti.m.join(' '));
  await sg.close();

  group('7  organise: drag, and the arrow buttons from the keyboard');
  const three = path.join(OUT, 'three.pdf');
  fs.writeFileSync(three, plain(3));
  const og = await open('/pdf/pdf-organise/');
  await upload(og, [three]);
  /* the grid comes with the file now: no button to press first */
  await og.waitForFunction(() => document.querySelectorAll('.page-card').length === 3, { timeout: 60000 });
  const order = () => og.$$eval('.page-card .page-num', (l) => l.map((x) => x.textContent).join(','));
  /* the whole grid on screen (under the sticky header), so the pointer can reach both cards */
  await og.$eval('.page-grid', (e) => window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - 90, behavior: 'instant' }));
  const cards = await og.$$('.page-card');
  const from = await cards[2].boundingBox(), to = await cards[0].boundingBox();
  await og.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await og.mouse.down();
  /* the top quarter of page 1's card, left of its middle: before it, in either layout */
  await og.mouse.move(to.x + to.width * 0.2, to.y + to.height * 0.15, { steps: 12 });
  const marked = await og.$$eval('.page-card.is-drop-before', (l) => l.length);
  await og.mouse.up();
  await og.waitForFunction(() => document.querySelector('.page-card .page-num').textContent === '3', { timeout: 10000 }).catch(() => {});
  check(marked === 1 && (await order()) === '3,1,2', 'dragging page 3 onto the left of page 1 makes 3, 1, 2 (with a drop marker on the way)', await order());
  await og.focus('.page-card:nth-child(2) button[title="Move later"]');
  await og.keyboard.press('Enter');
  await og.waitForFunction(() => document.querySelectorAll('.page-card .page-num')[2].textContent === '1', { timeout: 10000 }).catch(() => {});
  const focused = await og.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'));
  check((await order()) === '3,2,1' && focused === 'Move later, page 1', 'Enter on "Move later" moves page 1 one place and the focus stays on it', (await order()) + ' / ' + focused);
  await og.$eval('.pdf-run .btn-primary', (b) => b.click());
  await og.waitForFunction(() => { const s = document.querySelector('.pdf-summary'); return s && !s.hidden; }, { timeout: 60000 });
  const orr = await pdfjs(probe, await download(og));
  check(orr.pages.map((p) => (p.items.find((i) => /ORDER-PAGE/.test(i.str)) || {}).str).join() === 'ORDER-PAGE-3,ORDER-PAGE-2,ORDER-PAGE-1', 'the built PDF has that order');
  await og.close();

  group('8b quotation: an ambiguous line is shown, not priced');
  const q = await open('/pdf/quotation-pdf/');
  await setControls(q, { items: 'Item,2,2,650' });
  const qr = await press(q);
  check(/is-error/.test(qr.cls) && /can be read 2 ways/.test(qr.msg) && await q.$eval('.pdf-summary', (s) => s.hidden), 'the message names both readings and no PDF is made', qr.msg);
  await setControls(q, { items: 'Item, 2, 2,650' });
  const qr2 = await press(q);
  const qt = (await pdfjs(probe, await download(q))).pages.map((p) => p.items.map((i) => i.str).join(' ')).join(' ');
  check(!/is-error/.test(qr2.cls) && /2,650\.00/.test(qt) && /5,300\.00/.test(qt), 'with spaces after the separating commas: 2 at 2,650.00 = 5,300.00');
  await q.close();

  group('9  the merge and delete pages');
  const mp = await open('/pdf/merge-pdf/');
  const mtext = await mp.evaluate(() => document.querySelector('main').textContent);
  check(!/not carried across|deliberately drops them|annotations from the source files are not/i.test(mtext), 'the merge page no longer says annotations or bookmarks are dropped');
  check(/Links, comments and form fields travel with their page/.test(mtext) && /one top-level bookmark per file/.test(mtext), 'it says what happens now');
  await upload(mp, [path.join(OUT, 'secrets-A.pdf'), path.join(OUT, 'secrets-B.pdf')]);
  await press(mp);
  const mr = await pdfjs(probe, await download(mp));
  check(mr.pages.length === 6 && mr.pages[3].links.join() === '5,6,5', 'merged on the page: file 2\'s links land on its own pages');
  await mp.close();
  const dp = await open('/pdf/delete-pdf-pages/');
  await upload(dp, [path.join(OUT, 'secrets-A.pdf')]);
  await setControls(dp, { pages: '2' });
  await press(dp);
  const db = await analyse(await download(dp));
  check(db.pages.length === 2 && db.pageObjs === 2 && !/MARKER-A2/.test(db.text), 'deleted on the page: no trace of page 2 in the downloaded file');
  await dp.close();

  /* ================================================================ */
  group('11 shell v2: page grids, drag, progress, cancel, previews, guards, memory');

  /* 11a: every PDF-to-images card saves its own page (the Save buttons all
     used the last page's name) */
  const five = path.join(OUT, 'five.pdf');
  fs.writeFileSync(five, plain(5));
  const pi = await open('/pdf/pdf-to-images/');
  await upload(pi, [five]);
  await setControls(pi, { pages: '1-3', dpi: '72', format: 'image/png' });
  await pi.click('.pdf-run .btn-primary');
  await pi.waitForFunction(() => document.querySelectorAll('.pdf-results .pdf-file-card button').length === 3, { timeout: 60000 });
  const names = [];
  for (let k = 0; k < 3; k++) {
    const n0 = await pi.evaluate(() => window.__h.names.length);
    await pi.evaluate((k) => document.querySelectorAll('.pdf-results .pdf-file-card button')[k].click(), k);
    await pi.waitForFunction((n) => window.__h.names.length > n, { timeout: 10000 }, n0);
    names.push(await pi.evaluate(() => window.__h.names[window.__h.names.length - 1]));
  }
  check(names.join() === 'five-p1.png,five-p2.png,five-p3.png', 'PDF to images: each card\'s Save downloads its own page under its own name', names.join());
  await pi.close();

  /* 11b: the delete grid and the Pages box are the same selection */
  const twelve = path.join(OUT, 'twelve.pdf');
  fs.writeFileSync(twelve, plain(12));
  const dg = await open('/pdf/delete-pdf-pages/');
  await upload(dg, [twelve]);
  await dg.waitForFunction(() => document.querySelectorAll('.page-card').length === 12, { timeout: 30000 });
  const pagesBox = () => dg.$eval('#pc-pages', (e) => e.value);
  const chosen = () => dg.$$eval('.page-card.is-selected', (l) => l.map((c) => Number(c.dataset.index) + 1).join(','));
  await dg.click('.page-card[data-index="0"]');
  check(await pagesBox() === '' && await chosen() === '', 'clicking the chosen page 1 unchooses it, and the box empties', await pagesBox());
  await dg.click('.page-card[data-index="1"]');
  await dg.keyboard.down('Shift'); await dg.click('.page-card[data-index="3"]'); await dg.keyboard.up('Shift');
  check(await pagesBox() === '2-4' && await chosen() === '2,3,4', 'click page 2, shift-click page 4: "2-4" in the box, three cards marked', await pagesBox() + ' / ' + await chosen());
  /* along the second row of the grid, so the pointer passes only those cards */
  const k = await dg.$$eval('.page-card', (l) => l.filter((c) => c.offsetTop === l[0].offsetTop).length);
  await dg.$eval('.page-card[data-index="' + k + '"]', (c) => c.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const c6 = await (await dg.$('.page-card[data-index="' + k + '"]')).boundingBox();
  const c8 = await (await dg.$('.page-card[data-index="' + (k + 2) + '"]')).boundingBox();
  await dg.mouse.move(c6.x + c6.width / 2, c6.y + c6.height / 2);
  await dg.mouse.down();
  await dg.mouse.move(c8.x + c8.width / 2, c8.y + c8.height / 2, { steps: 10 });
  await dg.mouse.up();
  check(await pagesBox() === '2-4, ' + (k + 1) + '-' + (k + 3), 'dragging across three pages of the next row adds them', await pagesBox());
  await setControls(dg, { pages: '1, 12' });
  check(await chosen() === '1,12', 'typing "1, 12" in the box marks those two cards', await chosen());
  await dg.focus('.page-card[data-index="0"]');
  await dg.keyboard.press('ArrowRight');
  await dg.keyboard.press('Space');
  const kb = await pagesBox();
  await dg.keyboard.press('ArrowRight');
  await dg.keyboard.down('Shift'); await dg.keyboard.press('ArrowRight'); await dg.keyboard.up('Shift');
  check(kb === '1, 12, 2' && await pagesBox() === '1, 12, 2, 4', 'keyboard: arrow then Space chooses page 2; Shift+arrow adds page 4 (the box keeps the order chosen)', kb + ' → ' + await pagesBox());
  const roles = await dg.evaluate(() => ({ grid: document.querySelector('.page-grid').getAttribute('role'), multi: document.querySelector('.page-grid').getAttribute('aria-multiselectable'), sel: document.querySelector('.page-card[data-index="0"]').getAttribute('aria-selected') }));
  check(roles.grid === 'listbox' && roles.multi === 'true' && roles.sel === 'true', 'the grid is a multi-select listbox and each card says whether it is chosen', JSON.stringify(roles));
  await setControls(dg, { pages: '2, 5' });
  const r11b = await press(dg);
  const d11b = await analyse(await download(dg));
  check(!/is-error/.test(r11b.cls) && d11b.pages.length === 10 && !/ORDER-PAGE-2\)|ORDER-PAGE-5\)/.test(d11b.text), 'the file keeps the ten pages not chosen', d11b.pages.length + ' pages');
  await dg.close();

  /* 11c: thumbnails are drawn as their cards come near the screen */
  const eighty = path.join(OUT, 'eighty.pdf');
  fs.writeFileSync(eighty, plain(80));
  const lz = await open('/pdf/extract-pdf-pages/');
  await upload(lz, [eighty]);
  await lz.waitForFunction(() => document.querySelectorAll('.page-card').length === 80 && document.querySelectorAll('.page-card canvas').length > 4, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  const drawn0 = await lz.$$eval('.page-card canvas', (l) => l.length);
  const lastBefore = await lz.$eval('.page-card[data-index="79"]', (c) => !!c.querySelector('canvas'));
  await lz.$eval('.page-grid', (g) => { g.scrollTop = g.scrollHeight; });
  await lz.waitForFunction(() => !!document.querySelector('.page-card[data-index="79"] canvas'), { timeout: 30000 }).catch(() => {});
  const lastAfter = await lz.$eval('.page-card[data-index="79"]', (c) => !!c.querySelector('canvas'));
  check(drawn0 < 80 && !lastBefore && lastAfter, 'an 80-page file: ' + drawn0 + ' thumbnails drawn at first, page 80 only once the grid scrolls to it', 'drawn ' + drawn0 + ', last before ' + lastBefore + ', after ' + lastAfter);
  await lz.close();

  /* 11d: a page turned on its own card is saved turned */
  const rt = await open('/pdf/rotate-pdf/');
  await upload(rt, [five]);
  await rt.waitForFunction(() => document.querySelectorAll('.page-card').length === 5, { timeout: 30000 });
  await setControls(rt, { pages: '1' });
  await rt.$eval('.page-card[data-index="2"] .page-rot', (b) => b.click());
  await rt.$eval('.page-card[data-index="2"] .page-rot', (b) => b.click());
  await press(rt);
  const rta = await analyse(await download(rt));
  const rots = [];
  for (const pg of rta.pages) rots.push(Number(await rta.doc.resolve(pg.dict.Rotate)) || 0);
  check(rots.join() === '90,0,180,0,0', 'rotate: page 1 by the angle, page 3 by its own button twice', rots.join());
  await rt.close();

  /* 11e: merge — drag a file above another, and take some pages of one */
  const fa = path.join(OUT, 'alpha.pdf'), fb = path.join(OUT, 'beta.pdf');
  fs.writeFileSync(fa, core.createPDF([1, 2, 3].map((i) => ({ ops: [{ text: 'ALPHA-' + i, x: 72, y: 760, size: 20 }] })), {}));
  fs.writeFileSync(fb, core.createPDF([1, 2].map((i) => ({ ops: [{ text: 'BETA-' + i, x: 72, y: 760, size: 20 }] })), {}));
  const mg2 = await open('/pdf/merge-pdf/');
  await upload(mg2, [fa, fb]);
  const rows = await mg2.$$('.file-list .file-row');
  const rb = await rows[1].boundingBox(), ra = await rows[0].boundingBox();
  await mg2.mouse.move(rb.x + rb.width * 0.5, rb.y + rb.height / 2);
  await mg2.mouse.down();
  await mg2.mouse.move(ra.x + ra.width * 0.5, ra.y + 3, { steps: 10 });
  await mg2.mouse.up();
  const order2 = await mg2.$$eval('.file-list .file-row .file-name', (l) => l.map((x) => x.textContent).join(','));
  check(order2 === 'beta.pdf,alpha.pdf', 'dragging the second file above the first puts it first', order2);
  await mg2.$eval('.file-row[data-pos="1"] .file-pages-btn', (b) => b.click());
  await mg2.waitForFunction(() => document.querySelectorAll('.file-pages .page-card').length === 3, { timeout: 30000 });
  await mg2.click('.file-pages .page-card[data-index="0"]');
  await mg2.click('.file-pages .page-card[data-index="2"]');
  const rangesNow = await mg2.$eval('#pc-ranges', (e) => e.value);
  check(rangesNow === 'all | 2', 'choosing pages on alpha.pdf\'s grid (unchoosing 1 and 3) writes "all | 2"', rangesNow);
  /* drag alpha back to the top: its pages go with it */
  const rows2 = await mg2.$$('.file-list .file-row');
  const q1 = await rows2[1].boundingBox(), q0 = await rows2[0].boundingBox();
  await mg2.mouse.move(q1.x + 30, q1.y + q1.height / 2); await mg2.mouse.down();
  await mg2.mouse.move(q0.x + 30, q0.y + 3, { steps: 10 }); await mg2.mouse.up();
  const ranges2 = await mg2.$eval('#pc-ranges', (e) => e.value);
  await press(mg2);
  const sumName = await mg2.$eval('.pdf-summary-name', (e) => e.textContent);
  const mt2 = (await pdfjs(probe, await download(mg2))).pages.map((p) => p.items.map((i) => i.str).join(' ')).join(',');
  check(ranges2 === '2 | all' && mt2 === 'ALPHA-2,BETA-1,BETA-2', 'moved back to the top, alpha.pdf keeps its page choice: "2 | all", merged as ALPHA-2, BETA-1, BETA-2', ranges2 + ' / ' + mt2);
  check(sumName === 'alpha-merged.pdf', 'the merged file is named after the first file', sumName);
  await mg2.close();

  /* 11f: a long merge shows progress, leaves the page responsive, and Cancel stops it */
  const big = path.join(OUT, 'big.pdf');
  fs.writeFileSync(big, plain(5000));
  const cx = await open('/pdf/merge-pdf/');
  await upload(cx, [big, big, big]);
  await cx.evaluate(() => {
    window.__gap = 0; let last = performance.now();
    const tick = () => { const t = performance.now(); window.__gap = Math.max(window.__gap, t - last); last = t; if (!window.__stopTick) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await cx.click('.pdf-run .btn-primary');
  await cx.waitForFunction(() => { const p = document.querySelector('.pdf-progress'); return p && !p.hidden && /Writing page \d+ of 15000/.test(p.textContent); }, { timeout: 60000 });
  const label1 = await cx.$eval('.pdf-progress-label', (e) => e.textContent);
  const gap = await cx.evaluate(() => window.__gap);
  await cx.click('.pdf-progress-cancel');
  await cx.waitForFunction(() => /Cancelled/.test(document.querySelector('.tool-io > .io-msg').textContent), { timeout: 20000 });
  const after = await cx.evaluate(() => ({ summary: !document.querySelector('.pdf-summary').hidden, prog: !document.querySelector('.pdf-progress').hidden, btn: document.querySelector('.pdf-run .btn-primary').disabled }));
  check(/Writing page \d+ of 15000/.test(label1) && gap < 250, 'a 15,000-page merge reports "Writing page n of 15000" and the page keeps drawing (longest frame gap ' + Math.round(gap) + ' ms)', label1);
  check(!after.summary && !after.prog && !after.btn, 'Cancel stops it: no result, the bar gone, the button back', JSON.stringify(after));
  await cx.evaluate(() => { window.__stopTick = true; });
  await setControls(cx, { ranges: '1-3 | 1 | 2' });
  const again = await press(cx);
  check(!/is-error/.test(again.cls) && /5 pages/.test(await cx.$eval('.pdf-summary', (e) => e.textContent)), 'after a Cancel the next run works (the files are sent to a new worker)', again.msg);
  await cx.close();

  /* 11g: the watermark preview is the real output, and follows the controls */
  const wm = await open('/pdf/watermark-pdf/');
  await upload(wm, [five]);
  const inkOfLive = () => wm.$eval('.live-canvas', (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 120 && d[i + 2] < 120) n++; return n; });
  await wm.waitForFunction(() => /real output/.test((document.querySelector('.live-note') || {}).textContent || ''), { timeout: 60000 });
  await setControls(wm, { opacity: 100, text: 'X' });
  await new Promise((r) => setTimeout(r, 1500));
  const small = await inkOfLive();
  await setControls(wm, { text: 'CONFIDENTIAL WATERMARK' });
  await new Promise((r) => setTimeout(r, 1500));
  const large = await inkOfLive();
  check(small > 50 && large > small * 3, 'the live preview redraws from the real output as the text changes (red ink ' + small + ' → ' + large + ' px)');
  await wm.close();

  /* 11h: the editor — drag, resize from the corner, nudge, two items */
  const ed2 = await open('/pdf/pdf-editor/');
  const two = path.join(OUT, 'two.pdf');
  fs.writeFileSync(two, plain(2));
  await upload(ed2, [two]);
  await ed2.waitForSelector('.place-canvas', { timeout: 60000 });
  await setControls(ed2, { text: 'DRAG-ME', x: 100, y: 700, size: 20 });
  await ed2.waitForSelector('.place-box.is-current', { timeout: 10000 });
  await ed2.$eval('.place-stage', (e) => window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - 120, behavior: 'instant' }));
  const scale = await ed2.$eval('.place-canvas', (c) => c.getBoundingClientRect().width / 595.28);
  let bb = await (await ed2.$('.place-box.is-current')).boundingBox();
  await ed2.mouse.move(bb.x + 10, bb.y + 10); await ed2.mouse.down();
  await ed2.mouse.move(bb.x + 10 + 100 * scale, bb.y + 10 + 50 * scale, { steps: 8 }); await ed2.mouse.up();
  const xy = [Number(await ed2.$eval('#pc-x', (e) => e.value)), Number(await ed2.$eval('#pc-y', (e) => e.value))];
  check(near(xy[0], 200, 1.5) && near(xy[1], 650, 1.5), 'dragging the box 100 points right and 50 down moves X 100 → 200 and Y 700 → 650', xy.join(', '));
  bb = await (await ed2.$('.place-box.is-current .place-handle-se')).boundingBox();
  await ed2.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await ed2.mouse.down();
  const boxH = (await (await ed2.$('.place-box.is-current')).boundingBox()).height;
  await ed2.mouse.move(bb.x + bb.width / 2 + 40, bb.y + bb.height / 2 + boxH, { steps: 8 }); await ed2.mouse.up();
  const sz = Number(await ed2.$eval('#pc-size', (e) => e.value));
  check(sz > 30 && sz < 50, 'pulling the corner down by the box\'s own height roughly doubles the size (20 → ' + sz + ')');
  await ed2.focus('.place-box.is-current');
  const x0 = Number(await ed2.$eval('#pc-x', (e) => e.value));
  await ed2.keyboard.press('ArrowRight');
  await ed2.keyboard.down('Shift'); await ed2.keyboard.press('ArrowLeft'); await ed2.keyboard.up('Shift');
  const x1 = Number(await ed2.$eval('#pc-x', (e) => e.value));
  await ed2.keyboard.press('-');
  const sz2 = Number(await ed2.$eval('#pc-size', (e) => e.value));
  check(near(x1, x0 - 18, 0.01) && near(sz2, Math.round(sz / 1.1 * 10) / 10, 0.11), 'with the box focused: → +2, Shift+← −20, minus shrinks by a tenth', x0 + ' → ' + x1 + '; size ' + sz + ' → ' + sz2);
  await ed2.click('.place-items-add');
  await setControls(ed2, { text: 'SECOND-PAGE-TEXT', x: 80, y: 400, pages: '2', size: 14 });
  await press(ed2);
  const edOut = await pdfjs(probe, await download(ed2));
  const e1 = edOut.pages[0].items.find((i) => i.str === 'DRAG-ME'), e2 = edOut.pages[1].items.find((i) => i.str === 'SECOND-PAGE-TEXT');
  check(e1 && e2 && near(e1.m[4], x1, 0.6) && !edOut.pages[1].items.some((i) => i.str === 'DRAG-ME'), 'two items: the dragged one on page 1 where it was left, the second on page 2 only', e1 && e1.m.join(' '));
  await ed2.close();

  /* 11i: signature — a banked one on every page, another on the last */
  const sg2 = await open('/pdf/pdf-signature/');
  await upload(sg2, [path.join(OUT, 'three.pdf')]);
  await sg2.waitForSelector('.place-items-add', { timeout: 60000 });
  await setControls(sg2, { signatureText: 'INITIALS-AB', date: 'no', x: 500, y: 40, pages: 'all' });
  await sg2.click('.place-items-add');
  await setControls(sg2, { signatureText: 'FULL-SIGNATURE', date: 'yes', x: 300, y: 120, pages: 'last' });
  await press(sg2);
  const so = await pdfjs(probe, await download(sg2));
  const per = so.pages.map((p) => p.items.map((i) => i.str).filter((x) => /INITIALS|FULL|Date/.test(x)).join('+'));
  check(per[0] === 'INITIALS-AB' && per[1] === 'INITIALS-AB' && /INITIALS-AB/.test(per[2]) && /FULL-SIGNATURE/.test(per[2]) && /Date:/.test(per[2]), 'initials on every page, the full signature and date on the last', per.join(' | '));
  await sg2.close();

  /* 11j: guards: too many pages, too many bytes for this device */
  const many = path.join(OUT, 'too-many.pdf');
  fs.writeFileSync(many, core.createPDF(Array.from({ length: 10001 }, () => ({ ops: [] })), {}));
  const gd = await open('/pdf/rotate-pdf/');
  await upload(gd, [many]);
  const gmsg = await gd.$eval('.file-list', (e) => e.textContent);
  check(/10,001 pages is more than these tools work on in one go/.test(gmsg) && !(await gd.$('.page-card')), 'a 10,001-page file is turned away with a message, not a hang', gmsg.slice(0, 160));
  await gd.close();
  const gp = await browser.newPage();
  driving = gp;
  await gp.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 1 }); });
  await gp.evaluateOnNewDocument(hook);
  await gp.goto(BASE + '/pdf/merge-pdf/', { waitUntil: 'load' });
  await gp.waitForSelector('.pdf-run .btn-primary');
  const t0 = Date.now();
  await gp.evaluate(() => {
    const f = new File([new Uint8Array(300 * 1048576)], 'huge.pdf', { type: 'application/pdf' });
    const dt = new DataTransfer(); dt.items.add(f);
    document.querySelector('.dropzone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await gp.waitForFunction(() => /huge\.pdf/.test((document.querySelector('.file-error') || {}).textContent || ''), { timeout: 20000 });
  const bigMsg = await gp.$eval('.file-error', (e) => e.textContent);
  check(/huge\.pdf: At 300\.00 MB this is more than a browser tab can safely work on here \(the limit on this device is 256\.00 MB\)/.test(bigMsg) && Date.now() - t0 < 5000, 'on a 1 GB device a 300 MB file is refused by name, at once, before it is read', bigMsg.slice(0, 140));
  await gp.close();

  /* 11k: settings are remembered on the device, and can be reset */
  const rm1 = await open('/pdf/watermark-pdf/');
  await rm1.evaluate(() => localStorage.removeItem('1234tools-pdf-watermark-pdf-v1'));
  await setControls(rm1, { size: 90, angle: '0', text: 'COPY' });
  await new Promise((r) => setTimeout(r, 700));
  const stored = await rm1.evaluate(() => localStorage.getItem('1234tools-pdf-watermark-pdf-v1'));
  await rm1.reload({ waitUntil: 'load' });
  await rm1.waitForSelector('.pdf-run .btn-primary');
  const back = await rm1.evaluate(() => ({ size: document.getElementById('pc-size').value, angle: document.getElementById('pc-angle').value, text: document.getElementById('pc-text').value, note: !!document.querySelector('.pdf-remembered') }));
  check(back.size === '90' && back.angle === '0' && back.text === 'COPY' && back.note, 'size, angle and watermark text come back after a reload, with a note saying so', JSON.stringify(back));
  check(stored && !/"pages"/.test(stored), 'the page range is not remembered (it belongs to one document)', stored);
  await rm1.click('.pdf-remembered .btn-link');
  const reset = await rm1.evaluate(() => ({ size: document.getElementById('pc-size').value, key: localStorage.getItem('1234tools-pdf-watermark-pdf-v1') }));
  check(reset.size === '60' && reset.key === null, 'Reset puts the defaults back and forgets the saved settings', JSON.stringify(reset));
  await rm1.close();
  const rs = await open('/pdf/pdf-signature/');
  await setControls(rs, { signatureText: 'PRIVATE NAME', x: 77 });
  await new Promise((r) => setTimeout(r, 700));
  const sgStored = await rs.evaluate(() => localStorage.getItem('1234tools-pdf-pdf-signature-v1') || '');
  check(!/PRIVATE NAME/.test(sgStored), 'a typed signature is never stored', sgStored);
  await rs.close();

  /* 11l: a 390 px phone: nothing wider than the screen */
  for (const [tool, files] of [['/pdf/delete-pdf-pages/', [twelve]], ['/pdf/merge-pdf/', [fa, fb]], ['/pdf/pdf-editor/', [two]], ['/pdf/split-pdf/', [five]]]) {
    const ph = await browser.newPage();
    driving = ph;
    await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ph.evaluateOnNewDocument(hook);
    await ph.goto(BASE + tool, { waitUntil: 'load' });
    await ph.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    await ph.waitForSelector('.pdf-run .btn-primary');
    await upload(ph, files);
    await new Promise((r) => setTimeout(r, 1200));
    const w = await ph.evaluate(() => {
      const wide = [...document.querySelectorAll('.tool-io *')].filter((n) => { const r = n.getBoundingClientRect(); return r.width && r.right > window.innerWidth + 1; }).map((n) => n.className || n.tagName).slice(0, 4);
      return { sw: document.documentElement.scrollWidth, wide };
    });
    check(w.sw <= 390 && !w.wide.length, tool + ' at 390 px with files loaded: no horizontal scroll', JSON.stringify(w));
    await ph.close();
  }

  const foreign = [...requests].filter((h) => !/^127\.0\.0\.1(:\d+)?$/.test(h));
  check(!foreign.length, 'no request left 127.0.0.1', foreign.join(', '));
}

(async () => {
  console.log('pdf-fixes: ' + ROOT + (BROWSER ? ' on ' + BASE : ' (node only)'));
  try {
    await nodePart();
    if (BROWSER) await browserPart();
  } catch (e) {
    console.error('\nthe run broke: ' + (e && e.stack || e));
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
  if (browser) await browser.close();
  if (server) server.close();
  console.log('\n' + (pass + fail) + ' assertions   ' + pass + ' passed   ' + fail + ' failed');
  if (fail) { console.log('\nFailures:\n  ' + failures.join('\n  ')); process.exit(2); }
})();
