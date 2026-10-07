/**
 * OCR PDF (/pdf/ocr-pdf/) and Image to Text (/pdf/image-to-text/), proved on
 * their own pages in headless Chrome against readers that share no code with
 * the site's writer: pdf.js (the site's vendored copy, in Node and in the
 * page) and MuPDF (PyMuPDF, through python).
 *
 *   node build/tests/pdf-ocr-tools.js [--root <site>] [--port 8862] [--out <dir>]
 *
 * --root defaults to the site this file sits in. It is served by
 * build/tests/serve.js on the first free port of 8862-8864 (from --port); a
 * second free port in that range runs a recording proxy set on the test's
 * browser context, so the pages, their workers and anything else they start
 * reach a host other than 127.0.0.1 only through it, and it fails the run.
 *
 * Fixtures: text is drawn on canvases in the page (Arial; Nirmala UI for
 * Hindi), every word's ink box recorded as drawn (the ground truth), and the
 * pictures are wrapped into PDFs by PyMuPDF, an independent producer:
 *
 *   scan.pdf    page 1: an A4 "scan" at 200 DPI, four lines of English;
 *               page 2: the same size, stored landscape with /Rotate 90, so
 *               it shows upright: two English lines and one Hindi line
 *   mixed.pdf   page 1: typed text (a real text page); page 2: a scan
 *   receipt.png, notice.jpg, hindi.png, broken.png (not an image)
 *
 *   1  OCR PDF, English and Hindi, 300 DPI: the text pdf.js and MuPDF read
 *      from the output equals what was drawn (English exactly, Hindi under 5%
 *      character error rate); word positions against where they were drawn;
 *      every page renders pixel for pixel as before; the layer is render mode
 *      3; progress labels; the .txt
 *   2  "Pages that already have text": skipped and untouched by default,
 *      read again on request; a file of text pages only says so
 *   3  Image to Text: PNG and JPEG, a heading per image, a broken file named;
 *      Hindi; one image
 *   4  Cancel mid-page: "Cancelled", and no Tesseract worker left
 *   5  1400 px and 390 px: no horizontal scroll on either page
 *   6  no request left 127.0.0.1
 *
 * Exit code 2 when an assertion fails, 1 when the run itself breaks.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const net = require('net');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORTS = [8862, 8863, 8864];
const PORT0 = Number(arg('--port', 8862));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-pdf-ocr-tools')));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!PORTS.includes(PORT0)) { console.error('--port must be 8862, 8863 or 8864'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
function check(ok, what, detail) {
  if (ok) { pass++; console.log('  ok    ' + what + (detail !== undefined && detail !== '' ? '  (' + detail + ')' : '')); }
  else { fail++; failures.push(what + (detail ? '  (' + detail + ')' : '')); console.log('  FAIL  ' + what + (detail ? '  -> ' + detail : '')); }
}
const group = (t) => console.log('\n' + t);

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'),
    'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found');
}

/* Levenshtein over code points */
function cer(ref, hyp) {
  const a = [...ref.normalize('NFC')], b = [...hyp.normalize('NFC')];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] / a.length;
}
const lines = (s) => String(s).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

/* ---------- pdf.js in Node ---------- */
let pdfjsLib = null;
async function pdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.min.mjs')).href);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.worker.min.mjs')).href;
  return pdfjsLib;
}
/** per page: the text as lines (hasEOL), and each item in the page's upright frame, in points */
async function readPdfjs(bytes) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: path.join(ROOT, 'engine/vendor/pdfjs/standard_fonts') + path.sep, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const text = tc.items.map((t) => (t.str || '') + (t.hasEOL ? '\n' : '')).join('');
    const items = tc.items.filter((t) => (t.str || '').trim()).map((t) => {
      const m = lib.Util.transform(vp.transform, t.transform);
      /* the item's run direction on the shown page, so a width can be laid along it */
      const len = Math.hypot(m[0], m[1]) || 1;
      return { str: t.str, x: m[4], y: m[5], dx: m[0] / len, dy: m[1] / len, w: t.width };
    });
    pages.push({ text, lines: lines(text), items, rotate: pg.rotate, w: vp.width, h: vp.height });
  }
  await doc.destroy();
  return pages;
}

/* ---------- MuPDF ---------- */
function python(code, args) {
  const r = spawnSync('python', ['-c', code].concat(args || []), { encoding: 'utf8', maxBuffer: 64 * 1048576 });
  if (r.status !== 0) throw new Error('python: ' + (r.stderr || '').slice(-600));
  return r.stdout;
}
/** MuPDF's text per page, its words in the shown (rotated) frame, and each page's raw content */
function mupdf(file) {
  const code = [
    'import json, sys, pymupdf',
    'd = pymupdf.open(sys.argv[1])',
    'out = []',
    'for p in d:',
    '    m = p.rotation_matrix',
    '    ws = []',
    '    for w in p.get_text("words", sort=False):',
    '        r = pymupdf.Rect(w[:4]) * m',
    '        ws.append([round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2), w[4]])',
    '    c = b"".join(d.xref_stream(x) or b"" for x in p.get_contents())',
    '    imgs = [d.xref_stream_raw(i[0]) for i in p.get_images(full=True)]',
    '    import hashlib',
    '    out.append({"text": p.get_text(), "words": ws, "rotation": p.rotation, "content": c.decode("latin1"), "images": [hashlib.sha256(x).hexdigest() for x in imgs]})',
    'print(json.dumps(out))'
  ].join('\n');
  return JSON.parse(python(code, [file]).trim().split('\n').pop());
}

/* ---------- the recording proxy ---------- */
function recordingProxy(port, hosts) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      try { hosts.add(new URL(req.url).host); } catch (e) { hosts.add(String(req.headers.host || req.url)); }
      res.writeHead(403); res.end();
    });
    s.on('connect', (req, sock) => { hosts.add(req.url); try { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); } catch (e) { /* */ } });
    s.once('error', () => resolve(null));
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}
const portFree = (port) => new Promise((resolve) => {
  const t = net.createServer();
  t.once('error', () => resolve(false));
  t.listen(port, '127.0.0.1', () => t.close(() => resolve(true)));
});

/* ---------- in the page ---------- */
function hook() {
  try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* */ }
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('no service worker in this test'));
  const blobs = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = function (o) { const u = orig.call(URL, o); try { if (o && typeof o.size === 'number') blobs.push(o); } catch (e) { /* */ } return u; };
  const labels = [];
  window.__h = {
    blobs, labels,
    b64: (i) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blobs[i]); }),
    watch() {
      const l = document.querySelector('.pdf-progress-label');
      if (!l || l.__w) return;
      l.__w = new MutationObserver(() => { const t = l.textContent; if (t && labels[labels.length - 1] !== t) labels.push(t); });
      l.__w.observe(l, { childList: true, characterData: true, subtree: true });
    }
  };
  /* drawing: lines of text on white, every word's ink box as drawn */
  window.__draw = function (spec) {
    const c = document.createElement('canvas');
    c.width = spec.w; c.height = spec.h;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111'; g.textBaseline = 'alphabetic';
    const words = [];
    for (const ln of spec.lines) {
      g.font = ln.size + 'px ' + ln.font;
      g.fillText(ln.text, ln.x, ln.y);
      let at = 0;
      for (const w of ln.text.split(' ')) {
        const i = ln.text.indexOf(w, at);
        const start = g.measureText(ln.text.slice(0, i)).width;
        const mt = g.measureText(w);
        words.push({ text: w, base: ln.y, x0: ln.x + start - mt.actualBoundingBoxLeft, x1: ln.x + start + mt.actualBoundingBoxRight,
          y0: ln.y - mt.actualBoundingBoxAscent, y1: ln.y + mt.actualBoundingBoxDescent, line: ln.text });
        at = i + w.length;
      }
    }
    let out = c;
    if (spec.rotateCCW) {
      out = document.createElement('canvas');
      out.width = c.height; out.height = c.width;
      const o = out.getContext('2d');
      o.translate(0, c.width); o.rotate(-Math.PI / 2); o.drawImage(c, 0, 0);
    }
    return { png: out.toDataURL(spec.type || 'image/png', 0.92).split(',')[1], words };
  };
}

const EN_FONT = 'Arial, Helvetica, sans-serif';
const HI_FONT = '"Nirmala UI", Mangal, "Noto Sans Devanagari", sans-serif';
/* A4 at 200 DPI */
const A4 = { w: 1654, h: 2339 };
const PAGE1 = ['Scanned letter for the OCR test', 'The quick brown fox jumps over the lazy dog', 'Invoice 2026-10 total 4,512.75 due 31 October', 'Please keep this copy for your records'];
const PAGE2_EN1 = 'Rotated page with a line in Hindi';
const HINDI = 'भारत एक विशाल देश है';
const PAGE2_EN2 = 'Thank you for reading';
const TYPED = 'This page was typed, not scanned';
const RECEIPT = ['Receipt 0417 from the corner shop', 'Two loaves 3.10 and milk 1.45', 'Total 4.55 paid by card'];
const NOTICE = ['Meeting moved to Thursday at 10:30', 'Room 4B on the second floor'];
const HINDI2 = 'आज मौसम बहुत अच्छा है';
const BIG = ['A photo far larger than it needs', 'to be still reads at sixteen megapixels'];

async function main() {
  const puppeteer = loadPuppeteer();
  const { serve } = require('./serve.js');
  let server = null, port = null;
  for (const p of [PORT0, ...PORTS.filter((x) => x !== PORT0)]) {
    if (!(await portFree(p))) continue;
    server = await serve(ROOT, p);
    if (server) { port = p; break; }
  }
  if (!server) throw new Error('no free port among 8862-8864 for the site');
  const proxyHosts = new Set();
  let proxy = null, proxyPort = null;
  for (const p of PORTS.filter((x) => x !== port)) {
    if (!(await portFree(p))) continue;
    proxy = await recordingProxy(p, proxyHosts);
    if (proxy) { proxyPort = p; break; }
  }
  const BASE = 'http://127.0.0.1:' + port;
  console.log('pdf-ocr-tools: ' + ROOT + ' on ' + BASE + (proxy ? ', recording proxy on ' + proxyPort : ', no free port for the proxy'));

  /* --disable-gpu: canvas text is rasterised in software, as in
     build/tests/claims.js, so the drawn fixtures are byte for byte the ones
     the claims draw, and the figures on the pages hold for both */
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
    args: ['--no-sandbox', '--disable-gpu', '--disable-features=AutofillServerCommunication,OptimizationHints,OptimizationHintsFetching,OptimizationGuideModelDownloading,Translate,MediaRouter,PreconnectToSearch,NetworkPrediction', '--dns-prefetch-disable']
  });
  const hosts = new Set();
  /* a dedicated worker's target type is "worker" in the default context and "other" in a new one: go by its script */
  const tessWorkers = () => browser.targets().filter((t) => /vendor\/tesseract\/worker\.min\.js/.test(t.url())).length;
  const settle = async () => { for (let i = 0; i < 50 && tessWorkers() > 0; i++) await new Promise((r) => setTimeout(r, 100)); return tessWorkers(); };
  let ctx;
  try {
    ctx = proxy ? await browser.createBrowserContext({ proxyServer: 'http://127.0.0.1:' + proxyPort }) : browser.defaultBrowserContext();
    /* Chrome opens a bare connection to its default search engine when a
       context starts (no request is sent on it); the proxy judges from the
       first page on, and what came before is printed */
    const blank = await ctx.newPage();
    await new Promise((r) => setTimeout(r, 1500));
    await blank.close();
    const beforePages = [...proxyHosts];
    proxyHosts.clear();
    if (beforePages.length) console.log('before any page, Chrome itself connected to: ' + beforePages.join(', '));
    const errors = [];
    async function open(tool, width) {
      const page = await ctx.newPage();
      page.on('request', (r) => { const u = r.url(); if (/^(data|blob):/.test(u)) return; try { hosts.add(new URL(u).host); } catch (e) { hosts.add(u); } });
      page.on('pageerror', (e) => errors.push(tool + ': ' + e.message));
      await page.setViewport({ width: width || 1400, height: 1000 });
      await page.evaluateOnNewDocument(hook);
      await page.goto(BASE + tool, { waitUntil: 'load', timeout: 120000 });
      await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
      await page.waitForSelector('.pdf-run .btn-primary', { timeout: 30000 });
      await page.evaluate(() => window.__h.watch());
      return page;
    }
    async function upload(page, files) {
      const input = await page.$('.tool-io .dropzone input[type=file]');
      const n = await page.$$eval('.file-list .file-row', (l) => l.length);
      await input.uploadFile(...files);
      await page.waitForFunction((k) => document.querySelectorAll('.file-list .file-row').length > k, { timeout: 30000 }, n);
      await page.waitForFunction(() => !document.querySelector('.file-list .file-row.is-loading'), { timeout: 60000 });
    }
    async function clearFiles(page) {
      for (let k = 0; k < 20; k++) {
        const b = await page.$('.file-list .file-row button[aria-label^="Remove"]');
        if (!b) break;
        await b.click();
      }
    }
    async function setControls(page, c) {
      const missing = await page.evaluate((c) => Object.keys(c).filter((k) => {
        const el = document.getElementById('pc-' + k);
        if (!el) return true;
        if (el.tagName === 'SELECT') el.value = String(c[k]);
        else { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, String(c[k])); }
        el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        return false;
      }), c);
      if (missing.length) throw new Error('controls not found: ' + missing.join(', '));
    }
    async function press(page) {
      await page.evaluate(() => { window.__h.labels.length = 0; });
      const t = Date.now();
      await page.evaluate(() => document.querySelector('.pdf-run .btn-primary').click());
      await page.waitForFunction(() => {
        const b = document.querySelector('.pdf-run .btn-primary');
        return b && !b.disabled && b.textContent !== 'Working…';
      }, { timeout: 280000, polling: 200 });
      return page.evaluate((ms) => {
        const m = document.querySelector('.tool-io > .io-msg');
        const s = document.querySelector('.pdf-summary');
        const rep = document.querySelector('.tool-io pre.code-out');
        const stats = Object.fromEntries([...document.querySelectorAll('.stat-row')].map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent]));
        return { cls: m ? m.className : '', msg: m ? m.textContent : '', summary: !!(s && !s.hidden), name: s && !s.hidden ? (s.querySelector('.pdf-summary-name') || {}).textContent : '',
          report: rep && !rep.hidden ? rep.textContent : '', stats, labels: window.__h.labels.slice(), ms,
          buttons: [...document.querySelectorAll('.pdf-actions button')].map((b) => b.textContent) };
      }, Date.now() - t);
    }
    async function blobAfter(page, click) {
      const n0 = await page.evaluate(() => window.__h.blobs.length);
      await click();
      await page.waitForFunction((n) => window.__h.blobs.length > n, { timeout: 30000 }, n0);
      const b64 = await page.evaluate((n) => window.__h.b64(n), n0);
      const type = await page.evaluate((n) => window.__h.blobs[n].type, n0);
      return { bytes: Buffer.from(b64, 'base64'), type };
    }
    const download = (page) => blobAfter(page, () => page.$eval('.pdf-summary-actions .btn-primary', (b) => b.click()));
    const write = (name, b) => { const p = path.join(OUT, name); fs.writeFileSync(p, b); return p; };

    /* ---------------- fixtures ---------------- */
    group('fixtures');
    const fx = await open('/pdf/ocr-pdf/');
    const draw = (spec) => fx.evaluate((s) => window.__draw(s), spec);
    const p1 = await draw({ w: A4.w, h: A4.h, lines: PAGE1.map((t, i) => ({ text: t, x: 180, y: 300 + i * 110, size: 42, font: EN_FONT })) });
    const p2 = await draw({ w: A4.w, h: A4.h, rotateCCW: true, lines: [
      { text: PAGE2_EN1, x: 180, y: 320, size: 42, font: EN_FONT },
      { text: HINDI, x: 180, y: 460, size: 56, font: HI_FONT },
      { text: PAGE2_EN2, x: 180, y: 600, size: 42, font: EN_FONT }] });
    const p3 = await draw({ w: A4.w, h: A4.h, lines: PAGE1.slice(1, 3).map((t, i) => ({ text: t, x: 180, y: 400 + i * 110, size: 42, font: EN_FONT })) });
    const receipt = await draw({ w: 1100, h: 330, lines: RECEIPT.map((t, i) => ({ text: t, x: 60, y: 90 + i * 80, size: 40, font: EN_FONT })) });
    const notice = await draw({ w: 1000, h: 260, type: 'image/jpeg', lines: NOTICE.map((t, i) => ({ text: t, x: 60, y: 100 + i * 90, size: 44, font: EN_FONT })) });
    const hindiImg = await draw({ w: 1000, h: 200, lines: [{ text: HINDI2, x: 60, y: 120, size: 60, font: HI_FONT }] });
    const webp = await draw({ w: 1000, h: 260, type: 'image/webp', lines: NOTICE.map((t, i) => ({ text: t, x: 60, y: 100 + i * 90, size: 44, font: EN_FONT })) });
    /* 5600 x 3600 = 20.2 megapixels, more than the 16 a picture is read at */
    const huge = await draw({ w: 5600, h: 3600, lines: BIG.map((t, i) => ({ text: t, x: 300, y: 900 + i * 500, size: 220, font: EN_FONT })) });
    await fx.close();
    const png1 = write('scan-p1.png', Buffer.from(p1.png, 'base64'));
    const png2 = write('scan-p2-ccw.png', Buffer.from(p2.png, 'base64'));
    const png3 = write('mixed-p2.png', Buffer.from(p3.png, 'base64'));
    const fReceipt = write('receipt.png', Buffer.from(receipt.png, 'base64'));
    const fNotice = write('notice.jpg', Buffer.from(notice.png, 'base64'));
    const fHindi = write('hindi.png', Buffer.from(hindiImg.png, 'base64'));
    const fBroken = write('broken.png', Buffer.from('this is not a picture at all, only text with a .png name'));
    const fWebp = write('notice.webp', Buffer.from(webp.png, 'base64'));
    const fHuge = write('huge.png', Buffer.from(huge.png, 'base64'));
    /* GIF and BMP by Pillow, from the receipt PNG */
    python(['import sys', 'from PIL import Image', 'im = Image.open(sys.argv[1]).convert("RGB")', 'im.save(sys.argv[2])',
      'im.convert("P", palette=Image.ADAPTIVE).save(sys.argv[3])', 'print("ok")'].join('\n'), [fReceipt, path.join(OUT, 'receipt.bmp'), path.join(OUT, 'receipt.gif')]);
    const fBmp = path.join(OUT, 'receipt.bmp'), fGif = path.join(OUT, 'receipt.gif');
    python([
      'import pymupdf, sys',
      'o = sys.argv[1]',
      'd = pymupdf.open()',
      'p = d.new_page(width=595.28, height=841.89); p.insert_image(p.rect, filename=sys.argv[2])',
      'p = d.new_page(width=841.89, height=595.28); p.insert_image(p.rect, filename=sys.argv[3]); p.set_rotation(90)',
      'd.save(o + "/scan.pdf", deflate=True)',
      'd = pymupdf.open()',
      'p = d.new_page(width=595.28, height=841.89); p.insert_text((72, 120), sys.argv[5], fontname="helv", fontsize=14)',
      'p = d.new_page(width=595.28, height=841.89); p.insert_image(p.rect, filename=sys.argv[4])',
      'd.save(o + "/mixed.pdf", deflate=True)',
      'd = pymupdf.open()',
      'p = d.new_page(width=595.28, height=841.89); p.insert_text((72, 120), sys.argv[5], fontname="helv", fontsize=14)',
      'd.save(o + "/typed.pdf")',
      'd = pymupdf.open()',
      'p = d.new_page(width=595.28, height=841.89); p.insert_image(p.rect, filename=sys.argv[2])',
      'p = d.new_page(width=595.28, height=841.89); p.insert_image(p.rect, filename=sys.argv[4])',
      'd.save(o + "/locked.pdf", encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="owner-ocr", user_pw="scan-pass")',
      'print("ok")'
    ].join('\n'), [OUT, png1, png2, png3, TYPED]);
    const scanPdf = path.join(OUT, 'scan.pdf'), mixedPdf = path.join(OUT, 'mixed.pdf'), typedPdf = path.join(OUT, 'typed.pdf');
    const scanSrc = await readPdfjs(fs.readFileSync(scanPdf));
    check(scanSrc.length === 2 && scanSrc[1].rotate === 90 && Math.round(scanSrc[1].w) === 595 && !scanSrc[0].items.length && !scanSrc[1].items.length,
      'scan.pdf: two pages with no text, page 2 stored landscape with /Rotate 90 and shown portrait', scanSrc.map((p) => p.rotate + '° ' + Math.round(p.w) + 'x' + Math.round(p.h)).join(', '));
    console.log('        written to ' + OUT);

    /* ground truth in points of the shown page: 200 DPI pixels * 72/200 */
    const K = 72 / 200;
    const truth1 = p1.words.map((w) => ({ text: w.text, x0: w.x0 * K, x1: w.x1 * K, base: w.base * K, line: w.line }));
    const truth2 = p2.words.map((w) => ({ text: w.text, x0: w.x0 * K, x1: w.x1 * K, base: w.base * K, line: w.line }));

    /* ---------------- 1 OCR PDF ---------------- */
    group('1  OCR PDF: scan.pdf, English and Hindi, 300 DPI');
    const op = await open('/pdf/ocr-pdf/');
    await upload(op, [scanPdf]);
    await setControls(op, { lang: 'both', dpi: '300', pages: 'all', existing: 'skip' });
    const r1 = await press(op);
    check(r1.summary && r1.name === 'scan-ocr.pdf', 'a result named scan-ocr.pdf', r1.name + ' ' + r1.msg);
    console.log('        stats: ' + JSON.stringify(r1.stats) + ', ' + (r1.ms / 1000).toFixed(1) + ' s');
    check(r1.stats['Pages recognised'] === '2 of 2' && r1.stats['Pages skipped (already text)'] === '0' && Number(r1.stats.Words) === PAGE1.join(' ').split(' ').length + [PAGE2_EN1, HINDI, PAGE2_EN2].join(' ').split(' ').length,
      'stats: 2 of 2 pages, 0 skipped, every drawn word counted', r1.stats.Words + ' words');
    check(/^\d+%$/.test(r1.stats['Mean confidence']) && parseInt(r1.stats['Mean confidence'], 10) >= 80, 'mean confidence shown, at least 80%', r1.stats['Mean confidence']);
    const want = ['Loading the OCR engine', 'Loading English and Hindi language data', 'Reading page 1 (1 of 2)', 'Reading page 2 (2 of 2)', 'Writing the searchable PDF'];
    const seen = want.filter((l) => r1.labels.some((x) => x.indexOf(l) === 0));
    check(seen.length === want.length, 'progress labels for each stage', r1.labels.filter((x, i, a) => a.indexOf(x) === i).slice(0, 12).join(' / '));
    const out1 = await download(op);
    check(out1.type === 'application/pdf' && out1.bytes.slice(0, 5).toString() === '%PDF-', 'the download is a PDF', out1.type + ', ' + out1.bytes.length + ' bytes');
    const fOut1 = write('scan-ocr.pdf', out1.bytes);
    const pj = await readPdfjs(out1.bytes);
    check(pj[0].lines.join('\n') === PAGE1.join('\n'), 'pdf.js reads page 1 exactly as drawn', JSON.stringify(pj[0].lines));
    check(pj[1].lines[0] === PAGE2_EN1 && pj[1].lines[2] === PAGE2_EN2, 'pdf.js reads the rotated page\'s English lines exactly', JSON.stringify(pj[1].lines));
    const hiPj = (pj[1].lines[1] || '');
    const cerPj = cer(HINDI, hiPj);
    check(cerPj < 0.05, 'pdf.js reads the Hindi line with a character error rate under 5%', 'CER ' + (cerPj * 100).toFixed(1) + '% ' + JSON.stringify(hiPj));
    const mu = mupdf(fOut1);
    check(lines(mu[0].text).join('\n') === PAGE1.join('\n'), 'MuPDF reads page 1 exactly as drawn', JSON.stringify(lines(mu[0].text)));
    const mu2 = lines(mu[1].text);
    const cerMu = cer(HINDI, mu2[1] || '');
    check(mu[1].rotation === 90 && mu2[0] === PAGE2_EN1 && mu2[2] === PAGE2_EN2 && cerMu < 0.05, 'MuPDF reads the rotated page: English exactly, Hindi CER under 5%', 'CER ' + (cerMu * 100).toFixed(1) + '% ' + JSON.stringify(mu2));
    console.log('        Hindi drawn ' + JSON.stringify(HINDI) + '; pdf.js CER ' + (cerPj * 100).toFixed(1) + '%, MuPDF CER ' + (cerMu * 100).toFixed(1) + '%');

    /* word positions: MuPDF's word boxes (shown frame) against the drawn ink boxes */
    const posCheck = (muWords, truth, label, tol) => {
      const got = muWords.filter((w) => w[4].trim());
      let worst = 0, bad = '';
      const enTruth = truth.filter((t) => !/[\u0900-\u097F]/.test(t.text));
      const enGot = got.filter((w) => !/[\u0900-\u097F]/.test(w[4]));
      if (enGot.length !== enTruth.length) bad = enGot.length + ' words read, ' + enTruth.length + ' drawn';
      for (let i = 0; !bad && i < enTruth.length; i++) {
        const t = enTruth[i], w = enGot[i];
        if (w[4] !== t.text) { bad = 'word ' + i + ' is ' + w[4] + ', drew ' + t.text; break; }
        const d = Math.max(Math.abs(w[0] - t.x0), Math.abs(w[2] - t.x1));
        const dy = Math.abs(w[3] - t.base) ;
        if (d > worst) worst = d;
        if (d > tol || w[1] > t.base || dy > 8) bad = t.text + ': MuPDF box ' + w.slice(0, 4).join(',') + ' vs drawn x ' + t.x0.toFixed(1) + '-' + t.x1.toFixed(1) + ' base ' + t.base.toFixed(1);
      }
      check(!bad, label + ': every English word\'s box, as MuPDF reads it, within ' + tol + ' pt of where it was drawn', bad || 'worst ' + worst.toFixed(2) + ' pt');
      return worst;
    };
    const w1 = posCheck(mu[0].words, truth1, 'page 1', 2);
    const w2 = posCheck(mu[1].words, truth2, 'page 2 (rotated)', 2);
    /* pdf.js: each line's items span from its first word's left edge to its last word's right edge, on its baseline */
    const linePos = (pg, truth, label) => {
      const byLine = new Map();
      for (const t of truth) { if (!byLine.has(t.line)) byLine.set(t.line, []); byLine.get(t.line).push(t); }
      let worst = 0, bad = '';
      for (const [ln, ws] of byLine) {
        const base = ws[0].base;
        const its = pg.items.filter((it) => Math.abs(it.y - base) < 6);
        if (!its.length) { bad = 'no pdf.js item on the baseline of "' + ln + '"'; break; }
        const x0 = Math.min(...its.map((it) => it.x)), x1 = Math.max(...its.map((it) => it.x + it.w * it.dx));
        const d = Math.max(Math.abs(x0 - ws[0].x0), Math.abs(x1 - ws[ws.length - 1].x1), ...its.map((it) => Math.abs(it.y - base)));
        worst = Math.max(worst, d);
        if (d > 3) bad = '"' + ln + '": pdf.js ' + x0.toFixed(1) + '-' + x1.toFixed(1) + ' vs drawn ' + ws[0].x0.toFixed(1) + '-' + ws[ws.length - 1].x1.toFixed(1);
      }
      check(!bad, label + ': pdf.js puts each line within 3 pt of where it was drawn (left, right, baseline)', bad || 'worst ' + worst.toFixed(2) + ' pt');
    };
    linePos(pj[0], truth1, 'page 1');
    linePos(pj[1], truth2, 'page 2 (rotated)');
    console.log('        worst MuPDF word edge: page 1 ' + w1.toFixed(2) + ' pt, page 2 ' + w2.toFixed(2) + ' pt');

    /* the layer draws nothing: render the source and the output in the page and compare */
    const pix = await op.evaluate(async (a, b) => {
      const lib = await import('/engine/vendor/pdfjs/pdf.min.mjs');
      lib.GlobalWorkerOptions.workerSrc = '/engine/vendor/pdfjs/pdf.worker.min.mjs';
      const dec = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
      const render = async (bytes) => {
        const pdf = await lib.getDocument({ data: bytes, standardFontDataUrl: '/engine/vendor/pdfjs/standard_fonts/' }).promise;
        const out = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const pg = await pdf.getPage(i); const vp = pg.getViewport({ scale: 1.5 });
          const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
          await pg.render({ canvasContext: x, viewport: vp }).promise;
          out.push(x.getImageData(0, 0, c.width, c.height).data);
        }
        return out;
      };
      const A = await render(dec(a)), B = await render(dec(b));
      return A.map((d, i) => { let diff = 0, ink = 0; for (let k = 0; k < d.length; k += 4) { if (d[k] !== B[i][k] || d[k + 1] !== B[i][k + 1] || d[k + 2] !== B[i][k + 2]) diff++; if (d[k] < 128) ink++; } return { diff, ink, px: d.length / 4 }; });
    }, fs.readFileSync(scanPdf).toString('base64'), out1.bytes.toString('base64'));
    check(pix.length === 2 && pix.every((p) => p.diff === 0 && p.ink > 1000), 'both pages render pixel for pixel as before (the layer adds no ink)', pix.map((p) => p.diff + ' of ' + p.px + ' px differ, ' + p.ink + ' ink px').join('; '));
    const srcMu = mupdf(scanPdf);
    check(mu.every((p, i) => p.images.join() === srcMu[i].images.join() && p.images.length === 1), 'each page\'s scan is carried over byte for byte (same image stream hash)');
    const trs = mu.map((p) => (p.content.match(/(\d+)\s+Tr\b/g) || []).join());
    check(mu.every((p) => /3\s+Tr\b/.test(p.content) && !/[0-24-7]\s+Tr\b/.test(p.content)), 'the added text is in render mode 3 only (invisible)', trs.join(' | '));
    check(/\/NotoSansDevanagari|MVRu0/.test(out1.bytes.toString('latin1')) || /FontFile2/.test(out1.bytes.toString('latin1')), 'the Hindi words are in an embedded font');
    check(!/%MVR-OCR text layer/.test(out1.bytes.toString('latin1')), 'the text layers are compressed (no raw layer in the file)');
    const txtBtn = r1.buttons.find((b) => /Save the text/.test(b));
    check(!!txtBtn && r1.buttons.some((b) => b === 'Copy the text'), 'the actions offer "Save the text (.txt)" and "Copy the text"', r1.buttons.join(' / '));
    const txt1 = await blobAfter(op, () => op.evaluate(() => [...document.querySelectorAll('.pdf-actions button')].find((b) => /Save the text/.test(b.textContent)).click()));
    const t1 = txt1.bytes.toString('utf8');
    check(txt1.type === 'text/plain' && /--- Page 1 ---/.test(t1) && /--- Page 2 ---/.test(t1) && PAGE1.every((l) => t1.indexOf(l) >= 0) && t1.indexOf(PAGE2_EN2) >= 0,
      'the .txt has every line under a heading per page', t1.length + ' characters');
    check(r1.report.trim() === t1.trim(), 'the report box shows the same text');
    await clearFiles(op);

    /* ---------------- 2 pages that already have text ---------------- */
    group('2  "Pages that already have text"');
    await upload(op, [mixedPdf]);
    await setControls(op, { lang: 'eng', dpi: '200', pages: 'all', existing: 'skip' });
    const r2 = await press(op);
    check(r2.stats['Pages recognised'] === '1 of 2' && r2.stats['Pages skipped (already text)'] === '1 (page 1)', 'skip (the default): the typed page is skipped, the scan read', JSON.stringify(r2.stats));
    const out2 = await download(op);
    const fOut2 = write('mixed-ocr.pdf', out2.bytes);
    const m2 = mupdf(fOut2), m2src = mupdf(mixedPdf);
    check(m2[0].content === m2src[0].content && lines(m2[0].text).join('|') === TYPED, 'the typed page is left untouched: same content stream, same text', JSON.stringify(lines(m2[0].text)));
    check(lines(m2[1].text).join('\n') === PAGE1.slice(1, 3).join('\n'), 'the scanned page reads as drawn (MuPDF)', JSON.stringify(lines(m2[1].text)));
    const pj2 = await readPdfjs(out2.bytes);
    check(pj2[1].lines.join('\n') === PAGE1.slice(1, 3).join('\n') && pj2[0].lines.join('|') === TYPED, 'and as pdf.js reads it', JSON.stringify(pj2.map((p) => p.lines)));
    check(r2.labels.some((l) => /^Loading English language data/.test(l)), 'English alone loads only the English data', r2.labels.filter((x, i, a) => a.indexOf(x) === i).slice(0, 4).join(' / '));
    await setControls(op, { existing: 'ocr' });
    const r3 = await press(op);
    check(r3.stats['Pages recognised'] === '2 of 2' && r3.stats['Pages skipped (already text)'] === '0', '"Recognise them too": both pages read', JSON.stringify(r3.stats));
    const pj3 = await readPdfjs((await download(op)).bytes);
    const typedTwice = (pj3[0].text.match(/typed, not scanned/g) || []).length;
    check(typedTwice === 2, 'the typed page then carries its own text and the recognised copy', typedTwice + ' copies');
    await clearFiles(op);
    await upload(op, [typedPdf]);
    await setControls(op, { existing: 'skip', pages: 'all' });
    const r4 = await press(op);
    check(!r4.summary && /already has text, so there was nothing to recognise/.test(r4.msg), 'a file whose pages all have text: no file, and the page says why', r4.msg);
    await setControls(op, { pages: '3' });
    const r5 = await press(op);
    check(!r5.summary && /is-error/.test(r5.cls), 'a page range beyond the file is refused', r5.msg);
    await clearFiles(op);
    await upload(op, [path.join(OUT, 'locked.pdf')]);
    await op.type('.file-pass input', 'scan-pass');
    await op.click('.file-pass .btn-primary');
    await op.waitForFunction(() => !document.querySelector('.file-pass') && !document.querySelector('.file-list .file-row.is-loading'), { timeout: 30000 });
    await setControls(op, { pages: '1', existing: 'skip', lang: 'eng', dpi: '200' });
    const r7 = await press(op);
    const pj7 = r7.summary ? await readPdfjs((await download(op)).bytes) : [];
    check(r7.stats['Pages recognised'] === '1 of 2' && pj7.length === 2 && pj7[0].lines.join('\n') === PAGE1.join('\n') && !pj7[1].items.length,
      'a password-protected scan, Pages 1: page 1 read, page 2 copied as it was; the result opens with no password', JSON.stringify(r7.stats) + ' ' + JSON.stringify(pj7.map((p) => p.lines)));
    await clearFiles(op);

    /* ---------------- 4 cancel ---------------- */
    group('4  Cancel mid-page');
    await upload(op, [scanPdf]);
    await setControls(op, { lang: 'eng', dpi: '300', pages: 'all', existing: 'skip' });
    await op.evaluate(() => { window.__h.labels.length = 0; });
    await op.evaluate(() => document.querySelector('.pdf-run .btn-primary').click());
    await op.waitForFunction(() => /^Reading page 1/.test((document.querySelector('.pdf-progress-label') || {}).textContent || ''), { timeout: 120000, polling: 20 });
    const during = tessWorkers();
    await new Promise((r) => setTimeout(r, 150));
    await op.evaluate(() => document.querySelector('.pdf-progress-cancel').click());
    await op.waitForFunction(() => !document.querySelector('.pdf-run .btn-primary').disabled, { timeout: 60000 });
    const cmsg = await op.evaluate(() => document.querySelector('.tool-io > .io-msg').textContent);
    check(/^Cancelled\./.test(cmsg) && await op.evaluate(() => document.querySelector('.pdf-summary').hidden), 'Cancel while a page is being read: "Cancelled", no result', cmsg);
    const after = await settle();
    check(during === 1 && after === 0, 'the Tesseract worker ran during the read and none is left after Cancel', during + ' during, ' + after + ' after');
    const r6 = await press(op);
    check(r6.summary && r6.stats['Pages recognised'] === '2 of 2', 'a run after the cancel works', JSON.stringify(r6));
    check((await settle()) === 0, 'and leaves no Tesseract worker behind');

    /* ---------------- 5 at 390 px ---------------- */
    group('5  1400 px and 390 px');
    const wideop = await op.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(wideop[0] <= wideop[1], 'OCR PDF at 1400 px: no horizontal scroll', wideop.join(' / '));
    await op.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 400));
    const sw1 = await op.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(sw1[0] <= sw1[1], 'OCR PDF with a result showing: no horizontal scroll at 390 px', sw1.join(' / '));
    await op.close();

    /* ---------------- 3 Image to Text ---------------- */
    group('3  Image to Text');
    const it = await open('/pdf/image-to-text/');
    const accept = await it.$eval('.tool-io .dropzone input[type=file]', (i) => [i.accept, i.multiple]);
    check(accept[0] === 'image/png,image/jpeg,image/webp,image/gif,image/bmp' && accept[1], 'the picker takes several PNG, JPEG, WebP, GIF and BMP images', accept.join(' '));
    await upload(it, [fReceipt, fNotice, fBroken]);
    await setControls(it, { lang: 'eng' });
    const i1 = await press(it);
    check(i1.summary && i1.name === 'image-text.txt', 'several images: one image-text.txt', i1.name + ' ' + i1.msg);
    const it1 = await download(it);
    const s1 = it1.bytes.toString('utf8');
    const want1 = '=== receipt.png ===\n' + RECEIPT.join('\n') + '\n\n=== notice.jpg ===\n' + NOTICE.join('\n') + '\n';
    check(s1 === want1, 'PNG and JPEG read exactly, each under a heading with its name', JSON.stringify(s1));
    check(it1.type === 'text/plain', 'the download is text/plain', it1.type);
    check(/broken\.png: it could not be read as an image/.test(i1.msg) && /is-warn/.test(i1.cls), 'the broken file is named, the others still read', i1.msg);
    check(/^\d+ words, \d+% mean confidence$/.test(i1.stats['receipt.png'] || '') && i1.stats['receipt.png'].indexOf(RECEIPT.join(' ').split(' ').length + ' words') === 0 && /^\d+ words/.test(i1.stats['notice.jpg'] || ''),
      'stats: words and mean confidence per image', JSON.stringify(i1.stats));
    check(i1.report === s1 && i1.buttons.includes('Copy the text'), 'the text is in the report box with "Copy the text"');
    console.log('        stats: ' + JSON.stringify(i1.stats));
    await clearFiles(it);
    await upload(it, [fHindi]);
    await setControls(it, { lang: 'hin' });
    const i2 = await press(it);
    const it2 = await download(it);
    const s2 = it2.bytes.toString('utf8').trim();
    const cerI = cer(HINDI2, s2.replace(/\s+/g, ' '));
    check(i2.name === 'hindi.txt' && !/===/.test(s2) && cerI < 0.05, 'one Hindi image: hindi.txt, no heading, CER under 5%', 'CER ' + (cerI * 100).toFixed(1) + '% ' + JSON.stringify(s2) + ' ' + JSON.stringify(i2.stats));
    check(i2.labels.some((l) => /^Loading Hindi language data/.test(l)), 'progress names the Hindi data', i2.labels.filter((x, i, a) => a.indexOf(x) === i).slice(0, 4).join(' / '));
    check((await settle()) === 0, 'no Tesseract worker left after the run');
    await clearFiles(it);
    await upload(it, [fWebp, fGif, fBmp]);
    await setControls(it, { lang: 'eng' });
    const i3 = await press(it);
    const s3 = (await download(it)).bytes.toString('utf8');
    const want3 = ['notice.webp', 'receipt.gif', 'receipt.bmp'].map((n, k) => '=== ' + n + ' ===\n' + (k ? RECEIPT : NOTICE).join('\n')).join('\n\n') + '\n';
    check(s3 === want3, 'WebP, GIF (Pillow, palette) and BMP (Pillow) read exactly', JSON.stringify(s3) + ' ' + i3.msg);
    await clearFiles(it);
    await upload(it, [fHuge]);
    const i4 = await press(it);
    const s4 = (await download(it)).bytes.toString('utf8').trim();
    check(s4 === BIG.join('\n') && /huge\.png was larger than 16 megapixels and read at that size/.test(i4.msg), 'a 20-megapixel picture is scaled to 16 and read, and the page says so', JSON.stringify(s4) + ' ' + i4.msg);
    /* cancel while reading the first of several */
    await clearFiles(it);
    await upload(it, [fReceipt, fNotice]);
    await setControls(it, { lang: 'eng' });
    await it.evaluate(() => document.querySelector('.pdf-run .btn-primary').click());
    await it.waitForFunction(() => /^Reading receipt\.png/.test((document.querySelector('.pdf-progress-label') || {}).textContent || ''), { timeout: 120000, polling: 10 });
    await it.evaluate(() => document.querySelector('.pdf-progress-cancel').click());
    await it.waitForFunction(() => !document.querySelector('.pdf-run .btn-primary').disabled, { timeout: 60000 });
    const imsg = await it.evaluate(() => document.querySelector('.tool-io > .io-msg').textContent);
    check(/^Cancelled\./.test(imsg) && (await settle()) === 0, 'Cancel while reading: "Cancelled", no Tesseract worker left', imsg);
    const wideit = await it.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(wideit[0] <= wideit[1], 'Image to Text at 1400 px: no horizontal scroll', wideit.join(' / '));
    await it.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 400));
    const sw2 = await it.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(sw2[0] <= sw2[1], 'Image to Text: no horizontal scroll at 390 px', sw2.join(' / '));
    await it.close();

    check(!errors.length, 'no page errors', errors.join(' | '));

    /* ---------------- 6 hosts ---------------- */
    group('6  hosts');
    const PROBE = 'mvr-proxy-probe.invalid';
    if (proxy) {
      const pp = await ctx.newPage();
      await pp.goto(BASE + '/pdf/ocr-pdf/', { waitUntil: 'load' });
      await pp.evaluate((h) => fetch('http://' + h + '/').catch(() => null), PROBE);
      await pp.close();
    }
    const foreign = [...hosts].filter((h) => !/^127\.0\.0\.1(:\d+)?$/.test(h) && h !== PROBE);
    check(!foreign.length, 'no page or worker request left 127.0.0.1', foreign.join(', ') || [...hosts].filter((h) => h !== PROBE).join(', '));
    if (proxy) {
      check(proxyHosts.has(PROBE), 'the recording proxy is live (it heard the probe)');
      const other = [...proxyHosts].filter((h) => h !== PROBE);
      check(!other.length, 'nothing else reached the recording proxy', other.join(', ') + ' / all: ' + [...proxyHosts].join(', '));
    }
  } finally {
    await browser.close();
    server.close();
    if (proxy) proxy.close();
  }
}

main().then(() => {
  console.log('\n' + (pass + fail) + ' assertions   ' + pass + ' passed   ' + fail + ' failed');
  if (fail) { console.log('\nFailures:\n  ' + failures.join('\n  ')); process.exit(2); }
}, (e) => {
  console.error('\nthe run broke: ' + (e && e.stack || e));
  process.exit(1);
});
