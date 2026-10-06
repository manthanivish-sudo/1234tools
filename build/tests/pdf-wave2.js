/**
 * The PDF tools added or rebuilt in wave 2, proved against readers that
 * share no code with the site's engine: pdf.js (the site's vendored copy,
 * run in Node and in the page) and MuPDF (PyMuPDF, through python).
 *
 *   node build/tests/pdf-wave2.js [--root <site>] [--port 8852] [--out <dir>] [--no-browser] [--only a,b]
 *
 * --root defaults to the site this file sits in; it is served on --port by
 * build/tests/serve.js for the browser part. Groups (for --only):
 *
 *   crypt     opening encrypted files (RC4 40/128, AES-128/256, object
 *             streams, wrong and missing passwords); Protect and Unlock
 *   compress  Compress PDF: structure in Node; pictures in the browser
 *   pages     the password prompt, Protect, Unlock and Compress on their pages
 *
 * Fixtures are written by this test (pdfcore's writer, or PyMuPDF for the
 * encrypted ones, so the encryption comes from an independent producer).
 * Exit code 2 when an assertion fails, 1 when the run itself breaks.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8852));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-pdf-wave2')));
const BROWSER = !process.argv.includes('--no-browser');
const ONLY = arg('--only', '') ? arg('--only', '').split(',') : null;
const want = (g) => !ONLY || ONLY.includes(g);
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
function check(ok, what, detail) {
  if (ok) { pass++; console.log('  ok    ' + what + (detail && process.argv.includes('--verbose') ? '  (' + detail + ')' : '')); }
  else { fail++; failures.push(what + (detail ? '  (' + detail + ')' : '')); console.log('  FAIL  ' + what + (detail ? '  -> ' + detail : '')); }
}
const group = (t) => console.log('\n' + t);

/* ---------- the engine as the pages and the worker load it ---------- */
const pkg = require(path.join(ROOT, 'build/pdf-package/engine/pdfcore.js'));
const { PDFWriter, PDFStream, Name, Ref, pdfString } = pkg;
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
const core = loadCore();
async function runSpec(id, files, opts, extra) {
  const docs = [];
  for (const f of files) docs.push({ doc: await core.PDFDocument.load(f.bytes, { password: f.password || '' }), name: f.name });
  return loadSpec(id).run(Object.assign({ docs, opts: opts || {}, core, text: '' }, extra || {}));
}

/* ---------- independent readers ---------- */
let pdfjsLib = null;
async function pdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.min.mjs')).href);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.worker.min.mjs')).href;
  return pdfjsLib;
}
/** pdf.js on bytes: per page text, the document's permissions and title */
async function readPdfjs(bytes, password) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(bytes), password, standardFontDataUrl: path.join(ROOT, 'engine/vendor/pdfjs/standard_fonts') + path.sep, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    const tc = await pg.getTextContent();
    pages.push(tc.items.map((x) => x.str).join(' ').replace(/\s+/g, ' ').trim());
  }
  const perms = await doc.getPermissions();
  const meta = await doc.getMetadata().catch(() => ({}));
  const outline = (await doc.getOutline()) || [];
  await doc.destroy();
  return { pages, perms, title: meta && meta.info ? meta.info.Title : undefined, outline: outline.map((o) => o.title) };
}
async function pdfjsError(bytes, password) {
  try { await readPdfjs(bytes, password); return null; }
  catch (e) { return e && (e.name + ':' + (e.code || '')); }
}
/** MuPDF through python: needs_pass, auth levels, permissions, text */
function mupdf(file, passwords) {
  const py = [
    'import json, sys, pymupdf',
    'd = pymupdf.open(sys.argv[1])',
    'out = {"needs": bool(d.needs_pass), "auth": {}}',
    'for pw in json.loads(sys.argv[2]):',
    '    e = pymupdf.open(sys.argv[1]); out["auth"][pw] = e.authenticate(pw) if e.needs_pass else -1',
    'if d.needs_pass: d.authenticate(json.loads(sys.argv[2])[0] if json.loads(sys.argv[2]) else "")',
    'out["perm"] = d.permissions',
    'out["pages"] = d.page_count',
    'out["text"] = [p.get_text().strip() for p in d] if not d.needs_pass else []',
    'out["encrypted"] = bool(d.is_encrypted) if hasattr(d, "is_encrypted") else None',
    'out["meta"] = d.metadata.get("encryption") if d.metadata else None',
    'print(json.dumps(out))'
  ].join('\n');
  const r = spawnSync('python', ['-c', py, file, JSON.stringify(passwords || [])], { encoding: 'utf8' });
  if (r.status !== 0) return { error: (r.stderr || '').slice(-300) };
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { return { error: r.stdout }; }
}
function python(code, args) {
  const r = spawnSync('python', ['-c', code].concat(args || []), { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('python: ' + (r.stderr || '').slice(-400));
  return r.stdout;
}

/* ---------- fixtures ---------- */
const plain = (n, tag) => pkg.createPDF(Array.from({ length: n }, (_, i) => ({ ops: [{ text: (tag || 'PAGE') + '-' + (i + 1), x: 72, y: 760, size: 20 }] })), { info: { Title: 'Plain ' + n } });
const write = (name, bytes) => { const p = path.join(OUT, name); fs.writeFileSync(p, bytes); return p; };

/** Encrypted files written by MuPDF: three pages, bookmarks, compressed object streams. */
function mupdfEncrypted() {
  const code = [
    'import pymupdf, sys, os',
    'out = sys.argv[1]',
    'cases = [("rc4-40", pymupdf.PDF_ENCRYPT_RC4_40), ("rc4-128", pymupdf.PDF_ENCRYPT_RC4_128), ("aes-128", pymupdf.PDF_ENCRYPT_AES_128), ("aes-256", pymupdf.PDF_ENCRYPT_AES_256)]',
    'for stem, m in cases:',
    '    for objstm in (0, 1):',
    '        d = pymupdf.open()',
    '        for i in range(3):',
    '            p = d.new_page(width=595, height=842)',
    '            p.insert_text((72, 100), "W2-" + stem.upper() + "-P" + str(i + 1), fontname="helv", fontsize=16)',
    '        d.set_toc([[1, "First", 1], [1, "Third", 3]])',
    '        d.set_metadata({"title": "W2 " + stem})',
    '        perm = pymupdf.PDF_PERM_PRINT | pymupdf.PDF_PERM_ACCESSIBILITY',
    '        name = os.path.join(out, "w2-" + stem + ("-objstm" if objstm else "") + ".pdf")',
    '        kw = dict(encryption=m, owner_pw="owner-w2", user_pw="user-w2", permissions=perm)',
    '        if objstm: kw.update(use_objstms=1, garbage=3, deflate=True)',
    '        d.save(name, **kw)',
    '    d = pymupdf.open()',
    'p = d.new_page(width=595, height=842)',
    'p.insert_text((72, 100), "W2-RESTRICTED", fontname="helv", fontsize=16)',
    'd.save(os.path.join(out, "w2-restricted.pdf"), encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="owner-w2", user_pw="", permissions=pymupdf.PDF_PERM_ACCESSIBILITY)',
    'print("ok")'
  ].join('\n');
  python(code, [OUT]);
}

/* ================================================================== */

async function cryptPart() {
  group('crypt  opening files MuPDF encrypted, with and without object streams');
  mupdfEncrypted();
  for (const stem of ['rc4-40', 'rc4-128', 'aes-128', 'aes-256']) {
    for (const suffix of ['', '-objstm']) {
      const file = 'w2-' + stem + suffix + '.pdf';
      const bytes = new Uint8Array(fs.readFileSync(path.join(OUT, file)));
      let code = null;
      try { await core.PDFDocument.load(bytes); } catch (e) { code = e.code; }
      check(code === 'password', file + ': no password → asked for one (code "password")', code);
      code = null;
      try { await core.PDFDocument.load(bytes, { password: 'wrong' }); } catch (e) { code = e.code; }
      check(code === 'password', file + ': a wrong password is refused', code);
      const doc = await core.PDFDocument.load(bytes, { password: 'user-w2' });
      check(doc.security && doc.security.openedWith === 'user' && (await doc.pageCount()) === 3, file + ': the user password opens it: 3 pages', JSON.stringify(doc.security));
      const owner = await core.PDFDocument.load(bytes, { password: 'owner-w2' });
      check(owner.security && owner.security.isOwner, file + ': the owner password opens it as owner');
      /* unlock, then read the result with readers that are not ours */
      const res = await runSpec('unlock-pdf', [{ name: file, bytes, password: 'user-w2' }], {});
      const out = res.files && res.files[0].bytes;
      const f = out ? write('unlocked-' + file, out) : null;
      const pj = out ? await readPdfjs(out) : null;
      const label = 'W2-' + stem.toUpperCase();
      check(pj && pj.pages.join('|') === [1, 2, 3].map((i) => label + '-P' + i).join('|') && pj.title === 'W2 ' + stem && pj.outline.join() === 'First,Third',
        file + ': unlocked, pdf.js opens it with no password: text, title and bookmarks intact', pj && JSON.stringify(pj));
      const mu = f ? mupdf(f, []) : {};
      check(mu.needs === false && mu.pages === 3 && /W2-/.test((mu.text || [])[0] || ''), file + ': MuPDF needs no password for the unlocked file', JSON.stringify(mu));
      check(out && !/\/Encrypt/.test(Buffer.from(out).toString('latin1')), file + ': no /Encrypt left in the unlocked file');
    }
  }
  const restricted = new Uint8Array(fs.readFileSync(path.join(OUT, 'w2-restricted.pdf')));
  const rdoc = await core.PDFDocument.load(restricted);
  check(rdoc.security && rdoc.security.openedWith === 'empty' && rdoc.security.permissions.print === false && rdoc.security.permissions.copy === false,
    'restrictions only (empty user password): opens with no password, printing and copying shown as not allowed', JSON.stringify(rdoc.security));
  const ur = await runSpec('unlock-pdf', [{ name: 'r.pdf', bytes: restricted }], {});
  const urj = await readPdfjs(ur.files[0].bytes);
  check(urj.perms === null && urj.pages[0] === 'W2-RESTRICTED', 'unlocking it lifts the restrictions: pdf.js reports no permission limits', JSON.stringify(urj.perms));
  const none = await runSpec('unlock-pdf', [{ name: 'p.pdf', bytes: plain(1) }], {});
  check(/no password and no restrictions/.test(none.error || ''), 'a file with no password: Unlock says there is nothing to remove', none.error);

  group('crypt  Protect PDF, read back by pdf.js and MuPDF');
  const src = plain(3, 'PROTECT');
  for (const method of ['AES-256', 'AES-128']) {
    const r = await runSpec('protect-pdf', [{ name: 'p3.pdf', bytes: src }], { userPassword: 'open sesame', userPassword2: 'open sesame', ownerPassword: 'boss-key', method, allowPrint: true, allowCopy: false, allowModify: false, allowAnnotate: true });
    const out = r.files[0].bytes;
    const f = write('protected-' + method + '.pdf', out);
    check(r.files[0].name === 'p3-protected.pdf', method + ': named after the source', r.files[0].name);
    check(await pdfjsError(out) === 'PasswordException:1', method + ': pdf.js asks for a password', await pdfjsError(out));
    check(await pdfjsError(out, 'nope') === 'PasswordException:2', method + ': pdf.js refuses a wrong one');
    const pj = await readPdfjs(out, 'open sesame');
    const P = (await pdfjs()).PermissionFlag;
    check(pj.pages.join('|') === 'PROTECT-1|PROTECT-2|PROTECT-3' && pj.title === 'Plain 3', method + ': the open password gives pdf.js the text and the title', JSON.stringify(pj.pages));
    check(Array.isArray(pj.perms) && pj.perms.includes(P.PRINT) && !pj.perms.includes(P.COPY) && !pj.perms.includes(P.MODIFY_CONTENTS) && pj.perms.includes(P.MODIFY_ANNOTATIONS),
      method + ': pdf.js reports print allowed, copy and changes not, comments allowed', JSON.stringify(pj.perms));
    const mu = mupdf(f, ['open sesame', 'boss-key', 'nope']);
    check(mu.needs === true && mu.auth['open sesame'] > 0 && mu.auth['boss-key'] >= 4 && mu.auth.nope === 0, method + ': MuPDF: user password at user level, owner password at owner level, a wrong one refused', JSON.stringify(mu.auth));
    check(((mu.perm & 4) !== 0) && ((mu.perm & 16) === 0), method + ': MuPDF reads the same permissions', String(mu.perm));
    const back = await core.PDFDocument.load(out, { password: 'open sesame' });
    check((await back.pageCount()) === 3 && back.security.method === method, method + ': and the site\'s own engine opens what it wrote', JSON.stringify(back.security));
  }
  const ro = await runSpec('protect-pdf', [{ name: 'p3.pdf', bytes: src }], { userPassword: '', userPassword2: '', ownerPassword: '', method: 'AES-256', allowPrint: false, allowCopy: false, allowModify: true, allowAnnotate: true });
  const roj = await readPdfjs(ro.files[0].bytes);
  check(roj.pages[0] === 'PROTECT-1' && Array.isArray(roj.perms) && !roj.perms.includes((await pdfjs()).PermissionFlag.PRINT), 'restrictions only: opens without a password, printing not allowed', JSON.stringify(roj.perms));
  const mism = await runSpec('protect-pdf', [{ name: 'p3.pdf', bytes: src }], { userPassword: 'a', userPassword2: 'b', method: 'AES-256', allowPrint: true, allowCopy: true, allowModify: true, allowAnnotate: true });
  check(/not the same/.test(mism.error || ''), 'two different passwords are refused', mism.error);
  const nothing = await runSpec('protect-pdf', [{ name: 'p3.pdf', bytes: src }], { userPassword: '', userPassword2: '', method: 'AES-256', allowPrint: true, allowCopy: true, allowModify: true, allowAnnotate: true });
  check(/nothing to protect/.test(nothing.error || ''), 'no password and nothing restricted is refused, not written', nothing.error);
}

/* ---------- compression, the part Node can check ---------- */
function photoPdf(W, H, drawnW, copies) {
  /* a smooth gradient with noise: compresses like a photograph */
  const rgb = Buffer.alloc(W * H * 3);
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    rgb[i] = Math.min(255, (x / W) * 200 + rnd() * 40);
    rgb[i + 1] = Math.min(255, (y / H) * 200 + rnd() * 40);
    rgb[i + 2] = Math.min(255, 120 + Math.sin(x / 30) * 60 + rnd() * 30);
  }
  const w = new PDFWriter();
  const cat = w.alloc(), pages = w.alloc();
  const img = w.add(new PDFStream({ Type: new Name('XObject'), Subtype: new Name('Image'), Width: W, Height: H, ColorSpace: new Name('DeviceRGB'), BitsPerComponent: 8, Filter: new Name('FlateDecode') }, new Uint8Array(zlib.deflateSync(rgb))));
  const font = w.add({ Type: new Name('Font'), Subtype: new Name('Type1'), BaseFont: new Name('Helvetica'), Encoding: new Name('WinAnsiEncoding') });
  const kids = [];
  for (let k = 0; k < copies; k++) {
    const dh = drawnW * H / W;
    /* each page has its own (identical, uncompressed) copy of the same font dictionary and content */
    const f2 = w.add({ Type: new Name('Font'), Subtype: new Name('Type1'), BaseFont: new Name('Helvetica'), Encoding: new Name('WinAnsiEncoding') });
    const c = w.add(new PDFStream({}, pkg.bytesOf('q ' + drawnW + ' 0 0 ' + dh + ' 72 400 cm /Im1 Do Q\nBT /F1 14 Tf 72 360 Td (PHOTO-PAGE-' + (k + 1) + ') Tj ET\nBT /F2 9 Tf 72 340 Td (' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(3) + ') Tj ET\n')));
    kids.push(new Ref(w.add({ Type: new Name('Page'), Parent: new Ref(pages, 0), MediaBox: [0, 0, 595, 842], Resources: { XObject: { Im1: new Ref(img, 0) }, Font: { F1: new Ref(font, 0), F2: new Ref(f2, 0) } }, Contents: new Ref(c, 0) }), 0));
  }
  w.set(pages, { Type: new Name('Pages'), Kids: kids, Count: kids.length });
  w.set(cat, { Type: new Name('Catalog'), Pages: new Ref(pages, 0) });
  const info = w.add({ Title: pdfString('Photo fixture'), Author: pdfString('pdf-wave2') });
  return w.build(new Ref(cat, 0), new Ref(info, 0), '1.4');
}

async function compressPart() {
  group('compress  structure, in Node (no canvas here, so pictures stay)');
  const ph = photoPdf(1200, 900, 200, 4);
  write('photo.pdf', ph);
  const r = await runSpec('compress-pdf', [{ name: 'photo.pdf', bytes: ph }], { preset: 'lossless', metadata: 'strip' });
  const out = r.files && r.files[0].bytes;
  const pj = out ? await readPdfjs(out) : null;
  const stat = (k) => ((r.stats || []).find((x) => x[0] === k) || [])[1];
  check(out && out.length < ph.length && r.files[0].name === 'photo-compressed.pdf', 'lossless: smaller than the original and named after it', out && (ph.length + ' → ' + out.length));
  check(pj && pj.pages.length === 4 && pj.pages.every((t, i) => t.indexOf('PHOTO-PAGE-' + (i + 1)) === 0), 'pdf.js reads every page\'s text from the result', pj && pj.pages.join(' | ').slice(0, 120));
  check(pj && pj.title === undefined, 'metadata removed: pdf.js finds no title', pj && pj.title);
  check(/^[1-9]/.test(stat('Streams compressed') || '') && /^[1-9]/.test(stat('Duplicates stored once') || ''), 'the uncompressed content was deflated and the four identical font dictionaries stored once', stat('Streams compressed') + ' / ' + stat('Duplicates stored once'));
  check(/smaller \(/.test(stat('Change') || '') && stat('Before') && stat('After'), 'the stats give the size before, after and the change', stat('Before') + ' → ' + stat('After') + ', ' + stat('Change'));
  const keep = await runSpec('compress-pdf', [{ name: 'photo.pdf', bytes: ph }], { preset: 'lossless', metadata: 'keep' });
  check((await readPdfjs(keep.files[0].bytes)).title === 'Photo fixture', 'metadata kept when asked');
  const f = write('photo-lossless.pdf', out);
  const mu = mupdf(f, []);
  check(mu.pages === 4 && !mu.error, 'MuPDF opens the compressed file (object streams, xref stream) without complaint', JSON.stringify(mu).slice(0, 160));
  const tiny = pkg.createPDF([{ ops: [{ text: 'x', x: 10, y: 10 }] }], {});
  const t = await runSpec('compress-pdf', [{ name: 'tiny.pdf', bytes: tiny }], { preset: 'email' });
  check(!t.files || t.files[0].bytes.length < tiny.length, 'a file that would not get smaller is never offered larger', t.warn || (t.files && t.files[0].bytes.length + ' vs ' + tiny.length));
}

/* ================================================================== */
/* the browser part                                                    */

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found');
}
function hook() {
  try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* */ }
  const blobs = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = function (o) { const u = orig.call(URL, o); try { if (o && typeof o.size === 'number') blobs.push(o); } catch (e) { /* */ } return u; };
  window.__h = {
    blobs,
    b64: (i) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blobs[i]); }),
    set(el, v) {
      if (!el) return false;
      if (el.type === 'checkbox') el.checked = v === true || v === 'true';
      else if (el.tagName === 'SELECT') el.value = String(v);
      else { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, String(v)); }
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  };
}
let browser, server;
const requests = new Set();
async function open(tool) {
  const page = await browser.newPage();
  page.on('request', (r) => { try { const u = new URL(r.url()); if (/^(https?|wss?):$/.test(u.protocol)) requests.add(u.host); } catch (e) { /* */ } });
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
  await page.waitForFunction(() => { const s = document.querySelector('.pdf-summary'); const m = document.querySelector('.tool-io > .io-msg'); return (s && !s.hidden) || (m && /is-(error|warn|note)/.test(m.className) && !document.querySelector('.pdf-run .btn-primary').disabled); }, { timeout: 180000 });
  return page.evaluate(() => { const m = document.querySelector('.tool-io > .io-msg'); return { cls: m.className, msg: m.textContent, summary: !document.querySelector('.pdf-summary').hidden }; });
}
async function download(page) {
  const n0 = await page.evaluate(() => window.__h.blobs.length);
  await page.$eval('.pdf-summary-actions .btn-primary', (b) => b.click());
  await page.waitForFunction((n) => window.__h.blobs.length > n, { timeout: 30000 }, n0);
  return new Uint8Array(Buffer.from(await page.evaluate((n) => window.__h.b64(n), n0), 'base64'));
}
const stats = (page) => page.$$eval('.stat-row', (l) => Object.fromEntries(l.map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent])));

async function browserPart() {
  const puppeteer = loadPuppeteer();
  const { serve } = require('./serve.js');
  server = await serve(ROOT, PORT);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], protocolTimeout: 180000 });

  if (want('pages')) {
    group('pages  the password prompt, Protect and Unlock on their pages');
    const enc = path.join(OUT, 'w2-aes-256-objstm.pdf');
    if (!fs.existsSync(enc)) mupdfEncrypted();
    const mg = await open('/pdf/merge-pdf/');
    await upload(mg, [enc, write('second.pdf', plain(2, 'SECOND'))]);
    const asked = await mg.evaluate(() => { const f = document.querySelector('.file-pass'); return f ? { text: f.textContent, focus: document.activeElement && document.activeElement.type } : null; });
    check(asked && /needs its password to open/.test(asked.text) && asked.focus === 'password', 'merge: a protected file asks for its password in its row, and the box has the focus', JSON.stringify(asked));
    const r0 = await press(mg);
    check(/Open or remove w2-aes-256-objstm\.pdf first/.test(r0.msg) && !r0.summary, 'merging is held until the protected file is opened or removed', r0.msg);
    await mg.type('.file-pass input', 'wrong');
    await mg.click('.file-pass .btn-primary');
    await mg.waitForFunction(() => /did not open it/.test((document.querySelector('.file-pass') || {}).textContent || ''), { timeout: 20000 });
    check(true, 'a wrong password says so and asks again');
    await mg.$eval('.file-pass input', (i) => { i.value = ''; });
    await mg.type('.file-pass input', 'user-w2');
    await mg.click('.file-pass .btn-primary');
    await mg.waitForFunction(() => !document.querySelector('.file-pass') && /opened with its password/.test(document.querySelector('.file-list').textContent), { timeout: 20000 });
    const r1 = await press(mg);
    const merged = await download(mg);
    const mj = await readPdfjs(merged);
    check(!/is-error/.test(r1.cls) && mj.pages.join('|') === 'W2-AES-256-P1|W2-AES-256-P2|W2-AES-256-P3|SECOND-1|SECOND-2', 'with the password the protected file merges, and the result opens with no password', mj.pages.join('|'));
    await mg.close();

    const ul = await open('/pdf/unlock-pdf/');
    await upload(ul, [path.join(OUT, 'w2-rc4-128.pdf')]);
    await ul.type('.file-pass input', 'owner-w2');
    await ul.click('.file-pass .btn-primary');
    await ul.waitForFunction(() => !document.querySelector('.file-pass'), { timeout: 20000 });
    await press(ul);
    const ub = await download(ul);
    const us = await stats(ul);
    check((await readPdfjs(ub)).pages[0] === 'W2-RC4-128-P1' && /RC4/.test(us.Was) && /owner password/.test(us.Was), 'Unlock page: an RC4 file opened with its owner password is saved with none', JSON.stringify(us));
    await ul.close();

    const pr = await open('/pdf/protect-pdf/');
    await upload(pr, [write('to-protect.pdf', plain(2, 'SECRET'))]);
    await setControls(pr, { userPassword: 'pässwörd', userPassword2: 'pässwörd', allowCopy: false });
    await press(pr);
    const pb = await download(pr);
    const pjp = await readPdfjs(pb, 'pässwörd');
    check(pjp.pages.join('|') === 'SECRET-1|SECRET-2' && await pdfjsError(pb) === 'PasswordException:1', 'Protect page: a non-ASCII password protects the file; pdf.js needs it and reads the pages with it');
    const leftover = await pr.evaluate(() => Object.keys(localStorage).map((k) => k + '=' + localStorage.getItem(k)).join('\n'));
    check(!/pässwörd/.test(leftover) && /allowCopy/.test(leftover), 'the password is never stored; the permission switches are', leftover.split('\n').filter((x) => /protect/.test(x)).join(' '));
    await pr.close();
  }

  if (want('compress')) {
    group('compress  pictures re-encoded in the page\'s worker, read back by pdf.js');
    const ph = path.join(OUT, 'photo.pdf');
    if (!fs.existsSync(ph)) fs.writeFileSync(ph, photoPdf(1200, 900, 200, 4));
    const cp = await open('/pdf/compress-pdf/');
    await upload(cp, [ph]);
    await setControls(cp, { preset: 'screen' });
    await press(cp);
    const cb = await download(cp);
    const cs = await stats(cp);
    const before = fs.statSync(ph).size;
    const a = await pkg.PDFDocument.load(cb);
    const imgs = [...a.objects.values()].filter((v) => v instanceof PDFStream && v.dict.Subtype && v.dict.Subtype.name === 'Image');
    const w = imgs.length ? Number(imgs[0].dict.Width) : 0;
    /* drawn 200 pt wide at 110 DPI: 200 / 72 × 110 = 306 px */
    check(imgs.length === 1 && Math.abs(w - 306) <= 2 && imgs[0].dict.Filter.name === 'DCTDecode', 'screen preset: the 1200-pixel picture, drawn 200 pt wide, becomes one ' + w + '-pixel JPEG (200/72 × 110 = 306)', imgs.map((x) => x.dict.Width + ' ' + x.dict.Filter.name).join());
    check(cb.length < before / 4, 'the file shrinks from ' + before + ' to ' + cb.length + ' bytes, and the page says ' + cs.Change, cs.Change);
    const cj = await readPdfjs(cb);
    check(cj.pages.length === 4 && cj.pages[3].indexOf('PHOTO-PAGE-4') === 0, 'pdf.js reads all four pages\' text');
    /* the picture still looks like itself: mean colour of the drawn area, original against compressed */
    const meanOf = async (bytes) => cp.evaluate(async (b64) => {
      const lib = await import('/engine/vendor/pdfjs/pdf.min.mjs');
      lib.GlobalWorkerOptions.workerSrc = '/engine/vendor/pdfjs/pdf.worker.min.mjs';
      const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const pdf = await lib.getDocument({ data: u8 }).promise;
      const pg = await pdf.getPage(1); const vp = pg.getViewport({ scale: 1 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      const x = c.getContext('2d'); await pg.render({ canvasContext: x, viewport: vp }).promise;
      const d = x.getImageData(72, 842 - 400 - 150, 200, 150).data;
      const m = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; }
      return m.map((v) => v / (d.length / 4));
    }, Buffer.from(bytes).toString('base64'));
    const m0 = await meanOf(fs.readFileSync(ph)), m1 = await meanOf(cb);
    check(m0.every((v, i) => Math.abs(v - m1[i]) < 6), 'the re-encoded picture renders with the same average colour (within 6 of 255 per channel)', m0.map(Math.round) + ' vs ' + m1.map(Math.round));
    await setControls(cp, { preset: 'lossless' });
    await press(cp);
    const lb = await download(cp);
    const la = await pkg.PDFDocument.load(lb);
    const limg = [...la.objects.values()].filter((v) => v instanceof PDFStream && v.dict.Subtype && v.dict.Subtype.name === 'Image');
    check(limg.length === 1 && Number(limg[0].dict.Width) === 1200 && limg[0].dict.Filter.name === 'FlateDecode', 'lossless leaves the picture exactly as it was');
    await cp.close();
  }

  const foreign = [...requests].filter((h) => !/^127\.0\.0\.1(:\d+)?$/.test(h));
  check(!foreign.length, 'no request left 127.0.0.1', foreign.join(', '));
}

(async () => {
  console.log('pdf-wave2: ' + ROOT + (BROWSER ? ' on ' + BASE : ' (node only)'));
  try {
    if (want('crypt')) await cryptPart();
    if (want('compress')) await compressPart();
    if (BROWSER && (want('pages') || want('compress'))) await browserPart();
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
