/**
 * The image-tool fixes of 2026-10-04, proved in headless Chrome against a
 * static server of the site, with every result checked from its own bytes:
 *
 *   node build/tests/image-fixes.js [--port 8690] [--root <site>] [--out <dir>]
 *
 * --root defaults to the site this file sits in, served on --port by
 * build/tests/serve.js (ports 8690-8699 are this test's). --out defaults to a
 * folder in the OS temp dir. Exit code 2 when a case fails, 1 when the run
 * itself breaks.
 *
 *   1  background remover: no AI option and no third-party URL anywhere in
 *      the image engines; the page links to the AI Background Remover;
 *      loading and using it (both methods, every control) makes no request
 *      outside the site's origin; tolerance 0 removes only the exact colour
 *      (a #f5f5f5 half survives) while 32 removes it too
 *   2  SVG optimiser: an SVG with a linearGradient, a clipPath, a mask, <use>
 *      (href and xlink:href), aria-labelledby and a <title> rasterises
 *      pixel-identically before and after; the title is kept and only the
 *      unreferenced ids go; Download saves image/svg+xml named .svg; a file
 *      opened with the file input, or dropped on the box, is read in
 *   3  EXIF remover: a JPEG with EXIF (camera, GPS) is cleaned; the result's
 *      own bytes are parsed here — APP0 JFIF and an sRGB ICC profile, no
 *      APP1 — and the page's "Metadata in result" row says exactly that; the
 *      PNG result's chunks agree with its row too
 *   4  colour palette: every swatch row has an HSL value and contrast ratios
 *      with white and black text, equal to what the site's own Colour
 *      Converter (engine/dev-color-converter.js, run here) gives for that hex
 *   5  passport photo: the JPEG says 300 DPI in its JFIF header, the PNG in a
 *      pHYs chunk (11,811 px/m), on the single photo and the print sheet;
 *      51 mm is 602 px and the page shows the rounding (602.36) and the
 *      printed size (50.97 mm); "Replace" cuts the person out on the device
 *      (MODNet, from this site) and the corners take the chosen colour
 *   6  image to PDF: a JPEG's bytes appear unchanged inside the PDF; a JPEG
 *      with EXIF and GPS goes in with its image data unchanged and no
 *      metadata; one turned by its orientation tag, a PNG, and "Re-encode"
 *      are re-encoded; the PDF renders in the site's pdf.js
 *   7  rotate, meme, filters, border, blur & redact: a Save as control with
 *      PNG, JPEG and WebP and a quality slider that works; JPEG corners of a
 *      rounded border are white; the "larger" warning names real controls
 *   8  bulk resizer: never enlarges by default and says which image was left
 *      at its size; "Allow enlarging" does enlarge
 *   9  cropper: with every ratio preset, on landscape, portrait and square
 *      pictures, mouse drags inside and past every edge and corner give a
 *      box inside the picture, anchored at the start, of the locked shape
 *      and as big as the drag allows, and the crop is exactly that
 *      rectangle; 1:1 past the street photo's bottom edge is a square (it
 *      was 1121×1080); touch drags do the same
 *  10  (2026-10-06) names come from what was produced: a browser that writes
 *      PNG when asked for WebP (Safari, stood in for) gets .png files, in
 *      the compressor, the bulk resizer's cards and ZIP, and the cropper,
 *      and is told so once; files that cannot be read are named and the
 *      rest are made; a result toBlob refuses is named with the
 *      16,777,216-pixel limit, as is one over that limit on a phone (stood
 *      in for), while desktop Chrome still makes 5000×4000; preview URLs
 *      are revoked by the next run and on pagehide; the cropper keeps one
 *      set of window listeners however many runs
 *   and, through all of it, not one request to anything but 127.0.0.1.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const vm = require('vm');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8690));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-image-fixes')));
const ONLY = arg('--only', '') ? arg('--only', '').split(',').map(Number) : null;
const want = (n) => !ONLY || ONLY.indexOf(n) >= 0;
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SAMPLES = path.join(ROOT, 'build', 'promo', 'samples');
fs.mkdirSync(OUT, { recursive: true });

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}
const puppeteer = loadPuppeteer();
const { serve } = require('./serve.js');

let pass = 0, fail = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (detail !== undefined && !ok ? '   (' + String(detail).slice(0, 500) + ')' : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* byte parsers of our own, so a result is never judged by the code    */
/* that made it                                                       */
/* ------------------------------------------------------------------ */
function jpegSegs(b) {
  const out = [];
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length - 3) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    out.push({ m, at: i, len, id: b.slice(i + 4, i + 4 + 12).toString('latin1'), body: b.slice(i + 4, i + 2 + len) });
    if (m === 0xda) break;
    i += 2 + len;
  }
  return out;
}
function pngChunks(b) {
  const out = [];
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  let i = 8;
  while (i + 8 <= b.length) {
    const len = b.readUInt32BE(i), type = b.slice(i + 4, i + 8).toString('latin1');
    out.push({ type, data: b.slice(i + 8, i + 8 + len) });
    if (type === 'IEND') break;
    i += 12 + len;
  }
  return out;
}
const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8;
const isPng = (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47;
const isWebp = (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP';
/** The scan: from the first SOS to the end-of-image marker, inclusive. */
function jpegScan(b) {
  const segs = jpegSegs(b);
  const sos = segs[segs.length - 1];
  const end = b.indexOf(Buffer.from([0xff, 0xd9]), sos.at + 2 + sos.len);
  return b.slice(sos.at, end + 2);
}

/** A JPEG with an EXIF APP1 (big-endian TIFF) put in after SOI: Make, Orientation, GPS 44°6'30.6"S 170°9'15"E. */
function withExif(jpeg, orientation) {
  const t = [];
  const u16 = (v) => t.push(v >> 8, v & 255);
  const u32 = (v) => t.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const make = Buffer.from('DemoCam\0', 'latin1');
  /* layout: header 8 | IFD0 (3 entries) 2+36+4=42 at 8 | make at 50 | GPS IFD (4 entries) 2+48+4=54 at 58 | lat at 112 | lon at 136 */
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
  const tiff = Buffer.from(t);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const head = Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]);
  return Buffer.concat([jpeg.slice(0, 2), head, body, jpeg.slice(2)]);
}

/** A JPEG with an EXIF APP1 (big-endian) holding the ASCII fields given (Make, Artist, Copyright) and, with gps, a GPS IFD. */
function withExifFields(jpeg, f) {
  const TAG = { Make: 0x010f, Artist: 0x013b, Copyright: 0x8298 };
  const ents = Object.keys(TAG).filter((k) => f[k]).map((k) => ({ tag: TAG[k], text: Buffer.from(f[k] + '\0', 'latin1') }));
  if (f.gps) ents.push({ tag: 0x8825, gps: true });
  ents.sort((a, b) => a.tag - b.tag);
  const ifdLen = 2 + ents.length * 12 + 4;
  let data = 8 + ifdLen;
  const head = Buffer.alloc(8 + ifdLen), parts = [];
  head.write('MM', 0, 'latin1'); head.writeUInt16BE(42, 2); head.writeUInt32BE(8, 4); head.writeUInt16BE(ents.length, 8);
  ents.forEach((e, k) => {
    const at = 10 + k * 12;
    head.writeUInt16BE(e.tag, at);
    if (e.gps) { head.writeUInt16BE(4, at + 2); head.writeUInt32BE(1, at + 4); e.at = at + 8; return; }
    head.writeUInt16BE(2, at + 2); head.writeUInt32BE(e.text.length, at + 4); head.writeUInt32BE(data, at + 8);
    parts.push(e.text); data += e.text.length;
  });
  const g = ents.find((e) => e.gps);
  if (g) {
    head.writeUInt32BE(data, g.at);
    const gi = Buffer.alloc(2 + 2 * 12 + 4 + 24);
    gi.writeUInt16BE(2, 0);
    gi.writeUInt16BE(1, 2); gi.writeUInt16BE(2, 4); gi.writeUInt32BE(2, 6); gi.write('S\0', 10, 'latin1');
    gi.writeUInt16BE(2, 14); gi.writeUInt16BE(5, 16); gi.writeUInt32BE(3, 18); gi.writeUInt32BE(data + 30, 22);
    [[44, 1], [6, 1], [3060, 100]].forEach(([n, d], i) => { gi.writeUInt32BE(n, 30 + i * 8); gi.writeUInt32BE(d, 34 + i * 8); });
    parts.push(gi);
  }
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), head].concat(parts));
  const app1 = Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]);
  return Buffer.concat([jpeg.slice(0, 2), app1, body, jpeg.slice(2)]);
}
/** The IFD0 fields of a JPEG's EXIF, parsed here: Make, Artist, Copyright, Orientation, and gps when a GPS pointer is there. Null without EXIF. */
function tiffTags(jpeg) {
  const seg = (jpegSegs(jpeg) || []).find((s) => s.m === 0xe1 && s.body.slice(0, 6).toString('latin1') === 'Exif\0\0');
  if (!seg) return null;
  const t = seg.body.slice(6);
  const le = t[0] === 0x49;
  const u16 = (o) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o)), u32 = (o) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  const NAMES = { 0x010f: 'Make', 0x013b: 'Artist', 0x8298: 'Copyright', 0x0112: 'Orientation', 0x0110: 'Model' };
  const out = {};
  const ifd = u32(4), n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
    if (tag === 0x8825) { out.gps = true; continue; }
    if (!NAMES[tag]) { out['tag' + tag.toString(16)] = true; continue; }
    if (type === 2) { const at = cnt > 4 ? u32(e + 8) : e + 8; out[NAMES[tag]] = t.slice(at, at + cnt).toString('latin1').replace(/\0+$/, ''); }
    else if (type === 3) out[NAMES[tag]] = u16(e + 8);
  }
  return out;
}

/** The RGB of the w×h image XObject in a PDF, from its FlateDecode stream with PNG predictors (Node's zlib), or null. */
function pdfImageRGB(pdf, w, h) {
  const zlib = require('zlib');
  const txt = pdf.toString('latin1');
  const re = new RegExp('/Width ' + w + '\\b[\\s\\S]{0,300}?/Height ' + h + '\\b|/Height ' + h + '\\b[\\s\\S]{0,300}?/Width ' + w + '\\b');
  const at = txt.search(re);
  if (at < 0) return null;
  const objAt = txt.lastIndexOf(' obj', at);
  const st = txt.indexOf('stream', at);
  const dict = txt.slice(objAt, st);
  if (!/FlateDecode/.test(dict)) return null;
  const len = Number((/\/Length (\d+)/.exec(dict) || [])[1]);
  let from = st + 6;
  if (txt[from] === '\r') from++;
  if (txt[from] === '\n') from++;
  const raw = zlib.inflateSync(pdf.slice(from, from + len));
  const bpr = w * 3, out = Buffer.alloc(bpr * h);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (bpr + 1)], row = raw.slice(y * (bpr + 1) + 1, (y + 1) * (bpr + 1));
    for (let i = 0; i < bpr; i++) {
      const a = i >= 3 ? out[y * bpr + i - 3] : 0, b = y ? out[(y - 1) * bpr + i] : 0, c = y && i >= 3 ? out[(y - 1) * bpr + i - 3] : 0;
      let v = row[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * bpr + i] = v & 255;
    }
  }
  return out;
}

/* The site's own Colour Converter engine, run here as the reference. */
function colourConverter() {
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'engine', 'dev-color-converter.js'), 'utf8'), { window: w, console });
  return w.DEV_TOOLS['color-converter'];
}

/* ------------------------------------------------------------------ */
/* browser helpers                                                    */
/* ------------------------------------------------------------------ */
const outside = [];
/** init, when given, runs in the page before any of its scripts (a browser
 *  stand-in: Safari's toBlob, a phone's canvas limit, listener counting). */
async function open(browser, url, init) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !/^(data|blob):/.test(u)) { outside.push(url + ' -> ' + u); return r.abort(); }
    r.continue();
  });
  p.__errors = [];
  p.on('pageerror', (e) => p.__errors.push(String(e && e.message || e)));
  await p.evaluateOnNewDocument(() => {
    /* downloads are recorded, not saved: name, type and bytes */
    window.__downloads = [];
    HTMLAnchorElement.prototype.click = function () {
      const a = this;
      if (a.download) window.__downloads.push(fetch(a.href).then((r) => r.blob()).then(async (b) => ({ name: a.download, type: b.type, bytes: Array.from(new Uint8Array(await b.arrayBuffer())) })));
    };
    try { localStorage.setItem('1234tools-consent', 'declined'); } catch (e) { /* none */ }
    /* a first visit: no image tool's remembered settings (1234tools-img-<tool>-v1) */
    try { Object.keys(localStorage).filter((k) => /^1234tools-img-/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* none */ }
  });
  if (init) await p.evaluateOnNewDocument(init);
  await p.goto(BASE + url, { waitUntil: 'load' });
  await p.waitForSelector('.tool-io > *', { timeout: 20000 });
  return p;
}
const setCtl = (p, key, v) => p.evaluate((k, v) => {
  const e = document.getElementById('ic-' + k);
  if (!e) throw new Error('no control ' + k);
  e.value = String(v);
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
}, key, v);
const previews = (p) => p.$$eval('.tool-io .image-stage img.image-preview', (l) => l.map((i) => i.src));
/** Wait for a fresh set of results after `act` (an upload or a control change). */
async function act(p, fn, timeout) {
  const before = await previews(p);
  const stamp = await p.evaluate(() => (window.__n = (window.__n || 0) + 1));
  await fn();
  await p.waitForFunction((old) => {
    const now = [...document.querySelectorAll('.tool-io .image-stage img.image-preview')].map((i) => i.src).filter((s) => s.startsWith('blob:'));
    const m = document.querySelector('.tool-io .io-msg');
    if (m && m.classList.contains('is-error')) return true;
    return now.length && now.every((s) => old.indexOf(s) < 0);
  }, { timeout: timeout || 30000, polling: 100 }, before);
  /* a batch appears card by card: wait until the run is over (aria-busy, since wave 1) and the set has stopped changing */
  await p.waitForFunction(() => !document.querySelector('.tool-io[aria-busy]'), { timeout: timeout || 30000, polling: 100 });
  let last = '';
  for (let k = 0; k < 60; k++) {
    await sleep(350);
    const now = (await previews(p)).join('|');
    if (now && now === last) break;
    last = now;
  }
  return stamp;
}
const upload = (p, files, timeout) => act(p, async () => { const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(...files); }, timeout);
const change = (p, key, v, timeout) => act(p, () => setCtl(p, key, v), timeout);
async function resultBytes(p) {
  const arr = await p.$$eval('.tool-io .image-stage img.image-preview', (l) => Promise.all(l.filter((i) => i.src.startsWith('blob:')).map(async (i) => Array.from(new Uint8Array(await (await fetch(i.src)).arrayBuffer())))));
  return arr.map((a) => Buffer.from(a));
}
const stats = (p) => p.$$eval('.tool-io .stat-row', (l) => l.map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent]));
const stat = (rows, k) => (rows.find((r) => r[0] === k) || [])[1];
const msg = (p) => p.$eval('.tool-io .io-msg', (e) => ({ text: e.textContent, cls: e.className }));
/** Decode an encoded image in the page and read pixels: [[x, y], …] → [[r, g, b, a], …] (negative x/y count from the far edge). */
const pixels = (p, buf, pts) => p.evaluate(async (arr, pts) => {
  const bm = await createImageBitmap(new Blob([new Uint8Array(arr)]));
  const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
  const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
  return { w: bm.width, h: bm.height, px: pts.map(([a, b]) => Array.from(x.getImageData(a < 0 ? bm.width + a : a, b < 0 ? bm.height + b : b, 1, 1).data)) };
}, Array.from(buf), pts);
const downloads = (p) => p.evaluate(() => Promise.all(window.__downloads));
const near = (a, b, tol) => a.every((v, i) => i > 2 || Math.abs(v - b[i]) <= tol);

/* ------------------------------------------------------------------ */
(async () => {
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const t0 = Date.now();
  try {
    /* ============ 1 background remover ============ */
    if (want(1)) {
      const engines = fs.readdirSync(path.join(ROOT, 'engine')).filter((f) => /^(img-|imagecore|render-image)/.test(f) && f.endsWith('.js'));
      /* a third-party host by name, or code that loads anything from an absolute http(s) URL */
      const hits = engines.filter((f) => /jsdelivr|imgly|img\.ly|staticimgly|unpkg|(import\s*\(|fetch\s*\(|\.src\s*=|loadScript\w*\s*\()\s*['"`]https?:/i.test(fs.readFileSync(path.join(ROOT, 'engine', f), 'utf8')));
      check(!hits.length, '1  no image engine names a third-party host (jsDelivr, img.ly) or loads a remote URL', hits.join(', '));
      const html = fs.readFileSync(path.join(ROOT, 'image', 'background-remover', 'index.html'), 'utf8');
      check(!/AI mode|img\.ly|imgly|90 MB/i.test(html), '1  the page no longer offers or describes an AI mode', (html.match(/.{60}(AI mode|img\.ly|imgly|90 MB).{60}/i) || [])[0]);
      const before = outside.length;
      const p = await open(browser, '/image/background-remover/');
      const opts = await p.$$eval('#ic-mode option', (l) => l.map((o) => o.value));
      check(opts.join() === 'auto,colour', '1  Method offers Automatic and Pick a colour only', opts.join());
      const link = await p.evaluate(() => {
        const a = document.querySelector('a[href="/ai-image/background-remover/"]');
        const box = a && a.closest('p, section, div');
        return a ? { text: box.textContent.replace(/\s+/g, ' ').trim(), visible: !!(a.offsetWidth && a.offsetHeight), btn: /btn/.test(a.className) } : null;
      });
      check(!!link && link.visible && link.btn && /For hair, people and complex scenes use the AI Background Remover — it runs a model on your device/.test(link.text),
        '1  a visible line and button send hair, people and complex scenes to /ai-image/background-remover/', JSON.stringify(link));
      /* a 200×100 PNG: left half #f5f5f5, right half white, a navy square on the white */
      const file = path.join(OUT, 'key-test.png');
      const b64 = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 200, 100); x.fillStyle = '#f5f5f5'; x.fillRect(0, 0, 100, 100); x.fillStyle = '#1d3557'; x.fillRect(120, 30, 40, 40); return c.toDataURL('image/png').split(',')[1]; });
      fs.writeFileSync(file, Buffer.from(b64, 'base64'));
      await setCtl(p, 'mode', 'colour');
      await setCtl(p, 'feather', 0);
      await setCtl(p, 'tolerance', 0);
      await upload(p, [file]);
      const clear = async () => {
        const [png] = await resultBytes(p);
        return p.evaluate(async (arr) => { const bm = await createImageBitmap(new Blob([new Uint8Array(arr)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let z = 0; for (let i = 3; i < d.length; i += 4) if (d[i] === 0) z++; return z / (d.length / 4); }, Array.from(png));
      };
      const at0 = await clear();
      check(Math.abs(at0 - 0.42) < 0.001, '1  tolerance 0 removes only the exact white: 42% transparent, the #f5f5f5 half kept', at0);
      await change(p, 'tolerance', 32);
      const at32 = await clear();
      check(Math.abs(at32 - 0.92) < 0.001, '1  tolerance 32 removes the #f5f5f5 half too: 92% transparent', at32);
      await change(p, 'mode', 'auto');
      await change(p, 'replace', 'colour');
      await change(p, 'bg', '#00aa00');
      const [last] = await resultBytes(p);
      check(isPng(last), '1  the result is a PNG');
      check(outside.length === before, '1  loading and using the page made no request outside ' + BASE, outside.slice(before).join(' | '));
      check(!p.__errors.length, '1  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* ============ 2 SVG optimiser ============ */
    if (want(2)) {
      const SVG = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!-- exported -->',
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="120" height="120" viewBox="0 0 120 120" aria-labelledby="t" role="img">',
        '  <title id="t">Test badge</title>',
        '  <metadata>rdf junk</metadata>',
        '  <defs>',
        '    <linearGradient id="grad" x1="0" x2="1"><stop offset="0" stop-color="#0b5fff"/><stop offset="1" stop-color="#ff2c7a"/></linearGradient>',
        '    <clipPath id="clip"><circle cx="60" cy="60" r="50"/></clipPath>',
        '    <mask id="hole"><rect width="120" height="120" fill="#ffffff"/><rect x="52" y="0" width="16" height="120" fill="#000000"/></mask>',
        '    <path id="star" d="M 10 0 L 13 7 L 20 7 L 14.5 11.5 L 17 19 L 10 14 L 3 19 L 5.5 11.5 L 0 7 L 7 7 Z" fill="#ffd400"/>',
        '  </defs>',
        '  <g id="layer1" inkscape:label="Layer 1">',
        '    <rect id="bg" width="120" height="120" fill="url(#grad)" clip-path="url(#clip)" mask="url(#hole)"/>',
        '    <use xlink:href="#star" x="12" y="12"/>',
        '    <use href="#star" x="82" y="84"/>',
        '    <rect id="unused" x="2" y="104" width="12" height="12" fill="#222222"/>',
        '  </g>',
        '</svg>'].join('\n');
      const file = path.join(OUT, 'badge.svg');
      fs.writeFileSync(file, SVG);
      const p = await open(browser, '/image/svg-optimizer/');
      const inputs = await p.$$('.tool-io input[type=file]');
      check(inputs.length === 1, '2  the page has a file input for .svg files', inputs.length);
      await inputs[0].uploadFile(file);
      await p.waitForFunction(() => /Test badge/.test(document.querySelector('.tool-io textarea').value), { timeout: 10000 });
      const ta = await p.$eval('.tool-io textarea', (e) => e.value);
      check(ta === SVG, '2  opening the file puts its markup in the box');
      await sleep(200);
      const out = await p.$eval('.tool-io pre.code-out', (e) => e.textContent);
      check(/<title id="t">Test badge<\/title>/.test(out), '2  <title> is kept, with the id aria-labelledby names', out.slice(0, 300));
      for (const id of ['grad', 'clip', 'hole', 'star']) check(out.indexOf('id="' + id + '"') >= 0, '2  referenced id "' + id + '" is kept');
      check(!/id="(bg|unused|layer1)"/.test(out), '2  unreferenced ids (bg, layer1, unused) are removed', out);
      check(!/metadata|inkscape|<!--|<\?xml/.test(out), '2  editor metadata, comments and the declaration are still removed');
      const raster = await p.evaluate(async (a, b) => {
        const draw = async (svg) => {
          const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
          const img = new Image(); img.src = url; await img.decode();
          const c = document.createElement('canvas'); c.width = 120; c.height = 120;
          const x = c.getContext('2d'); x.drawImage(img, 0, 0, 120, 120);
          URL.revokeObjectURL(url);
          return x.getImageData(0, 0, 120, 120).data;
        };
        const A = await draw(a), B = await draw(b);
        let diff = 0, painted = 0;
        for (let i = 0; i < A.length; i++) { if (A[i] !== B[i]) diff++; }
        for (let i = 3; i < A.length; i += 4) if (A[i]) painted++;
        const at = (d, x, y) => Array.from(d.slice((y * 120 + x) * 4, (y * 120 + x) * 4 + 4));
        return { diff, painted, grad: at(A, 30, 60), gap: at(A, 60, 60), star: at(A, 22, 22) };
      }, SVG, out);
      check(raster.diff === 0, '2  before and after rasterise to identical pixels in Chrome (120×120, every channel)', JSON.stringify(raster));
      check(raster.grad[3] === 255 && raster.grad[2] > 150 && raster.gap[3] === 0 && raster.star[0] > 200 && raster.star[1] > 150,
        '2  the test really draws the gradient, the clip, the mask hole and the <use> star', JSON.stringify(raster));
      await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => b.textContent === 'Download').click());
      let [dl] = await downloads(p);
      check(dl && dl.name === 'badge-optimised.svg' && dl.type === 'image/svg+xml', '2  Download saves badge-optimised.svg as image/svg+xml', dl && dl.name + ' ' + dl.type);
      check(dl && Buffer.from(dl.bytes).toString('utf8') === out, '2  the downloaded file is the optimised markup');
      /* drop a file on the box */
      await p.evaluate(() => {
        const dt = new DataTransfer();
        dt.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>Dropped</title><rect id="x" width="10" height="10"/></svg>'], 'dropped.svg', { type: 'image/svg+xml' }));
        const ta = document.querySelector('.tool-io textarea');
        ta.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
        ta.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      });
      await p.waitForFunction(() => /Dropped/.test(document.querySelector('.tool-io textarea').value), { timeout: 10000 }).catch(() => {});
      const dropped = await p.$eval('.tool-io textarea', (e) => e.value);
      check(/<title>Dropped<\/title>/.test(dropped), '2  a .svg file dropped on the box is read in');
      await p.evaluate(() => { window.__downloads = []; [...document.querySelectorAll('.tool-io button')].find((b) => b.textContent === 'Download').click(); });
      [dl] = await downloads(p);
      check(dl && dl.name === 'dropped-optimised.svg', '2  …and downloads as dropped-optimised.svg', dl && dl.name);
      check(!p.__errors.length, '2  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* ============ 3 EXIF remover ============ */
    if (want(3)) {
      const tagged = withExif(fs.readFileSync(path.join(SAMPLES, 'landscape.jpg')), 1);
      const file = path.join(OUT, 'tagged.jpg');
      fs.writeFileSync(file, tagged);
      const p = await open(browser, '/image/exif-remover/');
      await upload(p, [file]);
      let rows = await stats(p);
      check(/EXIF/.test(stat(rows, 'Metadata found in original') || ''), '3  the original\'s EXIF is listed', stat(rows, 'Metadata found in original'));
      check(/^-44\.10850, 170\.15417$/.test(stat(rows, 'GPS removed') || ''), '3  the GPS position being removed is shown', stat(rows, 'GPS removed'));
      let [jpg] = await resultBytes(p);
      const segs = jpegSegs(jpg);
      const appn = segs.filter((s) => (s.m >= 0xe0 && s.m <= 0xef) || s.m === 0xfe);
      const app0 = appn.find((s) => s.m === 0xe0), app2 = appn.find((s) => s.m === 0xe2);
      check(appn.length === 2 && app0 && /^JFIF\0/.test(app0.id) && app2 && /^ICC_PROFILE\0/.test(app2.id),
        '3  parsed from the result\'s bytes: APP0 JFIF and APP2 ICC only, no APP1', appn.map((s) => 'FF' + s.m.toString(16) + ':' + s.id.replace(/\0/g, '·')).join(', '));
      check(app2 && /sRGB|s\0R\0G\0B/.test(app2.body.toString('latin1')), '3  the ICC profile in the result is sRGB (its description, ASCII or UTF-16)');
      check(jpg.indexOf('Exif') < 0 && jpg.indexOf('DemoCam') < 0, '3  no "Exif" header or camera make anywhere in the result');
      check(stat(rows, 'Metadata in result') === 'No EXIF, GPS or camera data; standard JFIF header and sRGB colour profile kept',
        '3  the page reports what the JPEG really holds', stat(rows, 'Metadata in result'));
      /* since wave 1 the default is Lossless: the picture's own bytes, so the scan is the original's, byte for byte */
      check(jpegScan(jpg).equals(jpegScan(tagged)) && jpg.length < tagged.length, '3  Lossless (the default): the result\'s scan is the original\'s byte for byte, and the file is smaller', jpg.length + ' vs ' + tagged.length);
      /* keep copyright and author: a JPEG whose EXIF has Artist and Copyright beside the camera and GPS */
      {
        const rights = withExifFields(fs.readFileSync(path.join(SAMPLES, 'landscape.jpg')), { Make: 'DemoCam', Artist: 'A. Photographer', Copyright: '(c) 2026 A. Photographer', gps: true });
        const rf = path.join(OUT, 'rights.jpg'); fs.writeFileSync(rf, rights);
        await setCtl(p, 'keep', 'copyright');
        await upload(p, [rf]);
        const [out] = await resultBytes(p);
        const tags = tiffTags(out);
        const r2 = await stats(p);
        check(tags && tags.Artist === 'A. Photographer' && tags.Copyright === '(c) 2026 A. Photographer' && !tags.Make && !tags.gps && jpegScan(out).equals(jpegScan(rights)),
          '3  Keep "Copyright and author only": the result\'s own EXIF (parsed here) holds Artist and Copyright and nothing else, no GPS, same scan', JSON.stringify(tags));
        check(/^EXIF with only Artist and Copyright, kept as you chose; no GPS or camera data/.test(stat(r2, 'Metadata in result') || ''), '3  …and the page says exactly that', stat(r2, 'Metadata in result'));
        await setCtl(p, 'keep', 'orientation');
        await upload(p, [file]);
      }
      await change(p, 'method', 'redraw');
      await change(p, 'format', 'image/png');
      rows = await stats(p);
      [jpg] = await resultBytes(p);
      const chunks = pngChunks(jpg).map((c) => c.type);
      const extra = chunks.filter((t) => ['IHDR', 'IDAT', 'IEND', 'PLTE'].indexOf(t) < 0);
      const tech = { iCCP: 'colour profile', sRGB: 'sRGB colour tag', gAMA: 'gamma and colour values', cHRM: 'gamma and colour values', pHYs: 'print resolution' };
      const personal = extra.filter((t) => !tech[t]);
      const keptList = [...new Set(extra.filter((t) => tech[t]).map((t) => tech[t]))];
      const expect = personal.length ? null : 'No EXIF, GPS or camera data; ' + (keptList.length ? (keptList.length > 1 ? keptList.slice(0, -1).join(', ') + ' and ' + keptList[keptList.length - 1] : keptList[0]) + ' kept' : 'no other metadata either');
      check(!personal.length && stat(rows, 'Metadata in result') === expect, '3  PNG result: chunks ' + chunks.join(',') + ' and the row agrees', stat(rows, 'Metadata in result') + ' vs ' + expect);
      check(!p.__errors.length, '3  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* ============ 4 colour palette ============ */
    if (want(4)) {
      const cc = colourConverter();
      const p = await open(browser, '/image/color-palette-extractor/');
      await setCtl(p, 'count', 6);
      await p.$('.tool-io input[type=file]').then((i) => i.uploadFile(path.join(SAMPLES, 'food.jpg')));
      await p.waitForSelector('.tool-io .palette-grid .palette-swatch', { timeout: 15000 });
      await sleep(300);
      const rows = await stats(p);
      check(rows.length === 6, '4  six colour rows', rows.length);
      let good = 0;
      const bad = [];
      for (const [k, v] of rows) {
        const hex = (k.match(/#[0-9A-F]{6}/) || [])[0];
        const w = cc.generate({ colour: hex, bg: '#ffffff' }), b = cc.generate({ colour: hex, bg: '#000000' });
        const hsl = (w.output.match(/hsl\([^)]+\)/) || [])[0];
        const rw = w.stats.find((s) => s[0] === 'Contrast ratio')[1], rb = b.stats.find((s) => s[0] === 'Contrast ratio')[1];
        const ok = v.indexOf(hsl) >= 0 && v.indexOf('contrast with white text ' + rw) >= 0 && v.indexOf('with black text ' + rb) >= 0;
        if (ok) good++; else bad.push(k + ' → ' + v + ' (want ' + hsl + ', ' + rw + ', ' + rb + ')');
      }
      check(good === rows.length, '4  every swatch has the HSL and WCAG ratios the Colour Converter gives for its hex', bad.join(' | '));
      const grade = rows.every(([, v]) => /white text \d+\.\d\d:1 (AAA|AA|AA large|fail), with black text \d+\.\d\d:1 (AAA|AA|AA large|fail)/.test(v));
      check(grade, '4  each ratio carries its WCAG grade', rows.map((r) => r[1]).join(' | '));
      const sw = await p.$$eval('.palette-swatch', (l) => l.map((s) => s.textContent));
      check(sw.every((t) => /hsl\(/.test(t) && /on white \d/.test(t) && /on black \d/.test(t)), '4  the swatches themselves show HSL and both ratios', sw[0]);
      const css = await p.$eval('.tool-io pre.code-out', (e) => e.textContent);
      check(/--colour-1: #[0-9a-f]{6}; \/\* hsl\(/.test(css), '4  the CSS custom properties carry the HSL too', css.split('\n')[1]);
      check(!p.__errors.length, '4  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* ============ 5 passport photo ============ */
    if (want(5)) {
      const p = await open(browser, '/image/passport-photo/');
      await setCtl(p, 'preset', 0);                       // India 51×51 mm
      await upload(p, [path.join(SAMPLES, 'portrait.jpg')]);
      let outs = await resultBytes(p);
      let rows = await stats(p);
      check(outs.length === 2 && outs.every(isJpeg), '5  JPEG by default: the single photo and the print sheet', outs.map((b) => b.slice(0, 2).toString('hex')).join());
      const jfif = outs.map((b) => { const s = jpegSegs(b).find((x) => x.m === 0xe0 && /^JFIF/.test(x.id)); return s && { unit: s.body[7], x: s.body.readUInt16BE(8), y: s.body.readUInt16BE(10) }; });
      check(jfif.every((d) => d && d.unit === 1 && d.x === 300 && d.y === 300), '5  both JPEGs say 300 DPI in their JFIF header (units 1 = dots per inch)', JSON.stringify(jfif));
      let dims = await Promise.all(outs.map((b) => pixels(p, b, [[0, 0]])));
      check(dims[0].w === 602 && dims[0].h === 602 && dims[1].w === 1800 && dims[1].h === 1200, '5  51 mm at 300 DPI: 602×602 px; the 6×4 sheet 1800×1200', dims.map((d) => d.w + '×' + d.h).join(', '));
      check(/602\.36/.test(stat(rows, 'Rounding') || '') && /50\.97 × 50\.97 mm/.test(stat(rows, 'Print size') || ''), '5  the page documents the rounding: 602.36 px → 602, printed 50.97 mm', stat(rows, 'Rounding') + ' / ' + stat(rows, 'Print size'));
      await change(p, 'format', 'image/png');
      outs = await resultBytes(p);
      const phys = outs.map((b) => { const c = (pngChunks(b) || []).find((x) => x.type === 'pHYs'); return c && { x: c.data.readUInt32BE(0), y: c.data.readUInt32BE(4), unit: c.data[8] }; });
      check(outs.every(isPng) && phys.every((d) => d && d.x === 11811 && d.y === 11811 && d.unit === 1), '5  both PNGs carry a pHYs chunk of 11,811 px per metre (300 DPI)', JSON.stringify(phys));
      const order = pngChunks(outs[0]).map((c) => c.type);
      check(order[0] === 'IHDR' && order.indexOf('pHYs') < order.indexOf('IDAT'), '5  pHYs sits before the image data, where PNG requires it', order.join(','));
      const decodes = await Promise.all(outs.map((b) => pixels(p, b, [[0, 0]]).then(() => true, () => false)));
      check(decodes.every(Boolean), '5  the PNGs with the new chunk (and its CRC) still decode');
      /* keep: the colour does nothing, and the page says the background is as photographed */
      await change(p, 'format', 'image/jpeg');
      await change(p, 'sheet', 'single');
      rows = await stats(p);
      check(stat(rows, 'Background') === 'as photographed', '5  with "Keep", the page says the background is as photographed', stat(rows, 'Background'));
      /* replace: MODNet on the device */
      await change(p, 'bg', '#2255ee');
      const tm = Date.now();
      await change(p, 'bgmode', 'replace', 300000);
      const m1 = await msg(p);
      check(!/is-error/.test(m1.cls), '5  the cut-out model loads and runs', m1.text);
      outs = await resultBytes(p);
      const blue = await pixels(p, outs[0], [[3, 3], [-4, 3], [3, -4], [-4, -4], [301, 260]]);
      const corners = blue.px.slice(0, 2);
      check(corners.every((c) => near(c, [0x22, 0x55, 0xee], 14)), '5  "Replace": the top corners of the photo are the chosen #2255EE (' + ((Date.now() - tm) / 1000).toFixed(1) + ' s)', JSON.stringify(blue.px));
      check(!near(blue.px[4], [0x22, 0x55, 0xee], 40), '5  …and the face in the middle is not', JSON.stringify(blue.px[4]));
      await change(p, 'bg', '#ff3300', 120000);
      outs = await resultBytes(p);
      const red = await pixels(p, outs[0], [[3, 3], [-4, 3]]);
      check(red.px.every((c) => near(c, [0xff, 0x33, 0x00], 14)), '5  another colour re-composites without running the model again', JSON.stringify(red.px));
      rows = await stats(p);
      check(/replaced with #FF3300/.test(stat(rows, 'Background') || ''), '5  the page says the background was replaced', stat(rows, 'Background'));
      check(!p.__errors.length, '5  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* ============ 6 image to PDF ============ */
    if (want(6)) {
      const doc = fs.readFileSync(path.join(SAMPLES, 'document.jpg'));
      const tagged = withExif(fs.readFileSync(path.join(SAMPLES, 'street.jpg')), 1);
      const turned = withExif(fs.readFileSync(path.join(SAMPLES, 'food.jpg')), 6);
      fs.writeFileSync(path.join(OUT, 'pdf-tagged.jpg'), tagged);
      fs.writeFileSync(path.join(OUT, 'pdf-turned.jpg'), turned);
      const p = await open(browser, '/image/image-to-pdf/');
      const pngB64 = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#3366cc'; x.fillRect(0, 0, 300, 200); return c.toDataURL('image/png').split(',')[1]; });
      fs.writeFileSync(path.join(OUT, 'pdf-plain.png'), Buffer.from(pngB64, 'base64'));
      const makePdf = async (files, set) => {
        if (set) for (const k of Object.keys(set)) await setCtl(p, k, set[k]);
        await p.evaluate(() => { window.__downloads = []; });
        const i = await p.$('.tool-io input[type=file]');
        await i.uploadFile(...files);
        await p.waitForFunction(() => [...document.querySelectorAll('.tool-io .io-actions .btn-primary')].some((b) => /Download PDF/.test(b.textContent)), { timeout: 30000 });
        await sleep(300);
        await p.evaluate(() => [...document.querySelectorAll('.tool-io .io-actions .btn-primary')].find((b) => /Download PDF/.test(b.textContent)).click());
        const [d] = await downloads(p);
        return { pdf: Buffer.from(d.bytes), rows: await stats(p), name: d.name };
      };
      let r = await makePdf([path.join(SAMPLES, 'document.jpg')]);
      check(r.pdf.includes(doc), '6  the JPEG\'s ' + doc.length.toLocaleString('en-GB') + ' bytes appear unchanged inside the PDF', r.pdf.length);
      check(/1 JPEG embedded as it is, not re-encoded/.test(stat(r.rows, 'Embedding') || ''), '6  the page says it went in as it is', stat(r.rows, 'Embedding'));
      const ok = await p.evaluate(async (arr) => {
        const base = location.origin + '/engine/vendor/pdfjs/';
        const lib = await import(base + 'pdf.min.mjs');
        lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
        const pdf = await lib.getDocument({ data: new Uint8Array(arr), standardFontDataUrl: base + 'standard_fonts/' }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: x, viewport: vp }).promise;
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) dark++;
        return { pages: pdf.numPages, w: c.width, h: c.height, inked: dark / (d.length / 4) };
      }, Array.from(r.pdf));
      check(ok.pages === 1 && ok.inked > 0.2, '6  the PDF renders in the site\'s pdf.js with the photo on the page', JSON.stringify(ok));
      r = await makePdf([path.join(OUT, 'pdf-tagged.jpg')]);
      const scan = jpegScan(tagged);
      check(r.pdf.includes(scan), '6  a JPEG with EXIF: its image data (' + scan.length.toLocaleString('en-GB') + ' bytes from SOS to EOI) is unchanged in the PDF');
      check(r.pdf.indexOf('Exif') < 0 && r.pdf.indexOf('DemoCam') < 0, '6  …and its EXIF block (camera, GPS) is not');
      check(/metadata left out of 1/.test(stat(r.rows, 'Embedding') || ''), '6  …and the page says so', stat(r.rows, 'Embedding'));
      r = await makePdf([path.join(OUT, 'pdf-turned.jpg')]);
      const m = await msg(p);
      check(!r.pdf.includes(jpegScan(turned)) && /1 image re-encoded as JPEG at quality 88/.test(stat(r.rows, 'Embedding') || '') && /orientation/.test(m.text),
        '6  a JPEG turned by its orientation tag is re-encoded upright, and the page says why', stat(r.rows, 'Embedding') + ' / ' + m.text);
      /* since wave 1 a PNG goes in losslessly (FlateDecode): the stream, inflated and un-filtered here with
         Node's zlib, is the PNG's pixels exactly as the browser decodes the PNG itself */
      const gradB64 = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); const d = x.createImageData(300, 200); for (let i = 0; i < 300 * 200; i++) { d.data[i * 4] = i % 300 & 255; d.data[i * 4 + 1] = (i / 300 | 0) & 255; d.data[i * 4 + 2] = (i * 7) & 255; d.data[i * 4 + 3] = 255; } x.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1]; });
      fs.writeFileSync(path.join(OUT, 'pdf-grad.png'), Buffer.from(gradB64, 'base64'));
      r = await makePdf([path.join(OUT, 'pdf-grad.png')]);
      {
        const ref = await p.evaluate(async (b64) => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return Array.from(x.getImageData(0, 0, bm.width, bm.height).data); }, gradB64);
        const got = pdfImageRGB(r.pdf, 300, 200);
        let diff = got ? 0 : -1;
        if (got) for (let i = 0, j = 0; i < ref.length; i += 4, j += 3) if (ref[i] !== got[j] || ref[i + 1] !== got[j + 1] || ref[i + 2] !== got[j + 2]) diff++;
        check(/1 image kept lossless \(FlateDecode\)/.test(stat(r.rows, 'Embedding') || '') && diff === 0,
          '6  a PNG goes in lossless: its FlateDecode stream, inflated here, is every pixel of the PNG exactly', stat(r.rows, 'Embedding') + ', differing pixels ' + diff);
      }
      r = await makePdf([path.join(OUT, 'pdf-plain.png')], { png: 'jpeg' });
      check(/1 image re-encoded as JPEG at quality 88/.test(stat(r.rows, 'Embedding') || ''), '6  "As JPEG" encodes a PNG as JPEG at the slider\'s quality', stat(r.rows, 'Embedding'));
      await setCtl(p, 'png', 'lossless');

      r = await makePdf([path.join(SAMPLES, 'document.jpg')], { jpeg: 'reencode', quality: 60 });
      check(!r.pdf.includes(jpegScan(doc)) && /re-encoded as JPEG at quality 60/.test(stat(r.rows, 'Embedding') || ''), '6  "Re-encode" re-encodes a JPEG at the chosen quality', stat(r.rows, 'Embedding'));
      check(!p.__errors.length, '6  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* ============ 7 format choice on five tools ============ */
    for (const t of (want(7) ? ['image-rotate-flip', 'meme-generator', 'photo-filters', 'image-border', 'blur-redact'] : [])) {
      const p = await open(browser, '/image/' + t + '/');
      const fmts = await p.$$eval('#ic-format option', (l) => l.map((o) => o.value));
      check(fmts.join() === 'image/png,image/jpeg,image/webp' && !!(await p.$('#ic-quality')), '7  ' + t + ': Save as PNG / JPEG / WebP and a quality slider', fmts.join());
      if (t === 'image-rotate-flip') await setCtl(p, 'angle', 5);
      if (t === 'image-border') { await setCtl(p, 'radius', 80); await setCtl(p, 'width', 30); }
      await upload(p, [path.join(SAMPLES, 'street.jpg')]);
      let [b] = await resultBytes(p);
      let m = await msg(p);
      check(isPng(b), '7  ' + t + ': PNG by default');
      /* (blur & redact and, since wave 1, the meme editor make a new picture and do not compare sizes with the original) */
      if (t !== 'blur-redact' && t !== 'meme-generator') check(/choose JPEG or WebP under “Save as”/.test(m.text), '7  ' + t + ': the "larger" warning points at the real Save as control', m.text);
      await change(p, 'format', 'image/jpeg');
      const [j92] = await resultBytes(p);
      await change(p, 'quality', 50);
      const [j50] = await resultBytes(p);
      check(isJpeg(j92) && isJpeg(j50) && j50.length < j92.length, '7  ' + t + ': JPEG works, and quality 50 is smaller than 92', j92.length + ' → ' + j50.length);
      m = await msg(p);
      check(!/Save as/.test(m.text) || /quality/.test(m.text), '7  ' + t + ': no warning that names a missing control', m.text);
      if (t === 'image-border') {
        const px = await pixels(p, j50, [[1, 1], [-2, -2]]);
        check(px.px.every((c) => c[0] > 245 && c[1] > 245 && c[2] > 245), '7  image-border: rounded corners come out white in a JPEG, not black', JSON.stringify(px.px));
      }
      await change(p, 'format', 'image/webp');
      [b] = await resultBytes(p);
      check(isWebp(b), '7  ' + t + ': WebP works');
      check(!p.__errors.length, '7  ' + t + ': no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* ============ 8 bulk resizer ============ */
    if (want(8)) {
      const p = await open(browser, '/image/bulk-image-resizer/');
      const en = await p.$eval('#ic-enlarge', (e) => e.value);
      check(en === 'no', '8  "Allow enlarging" exists and is off by default', en);
      await setCtl(p, 'mode', 'width');
      await setCtl(p, 'value', 2400);
      await upload(p, [path.join(SAMPLES, 'street.jpg'), path.join(SAMPLES, 'food.jpg')]);
      let outs = await resultBytes(p);
      let d = await Promise.all(outs.map((b) => pixels(p, b, [[0, 0]])));
      let m = await msg(p);
      const caps = await p.$$eval('.tool-io .image-cap', (l) => l.map((c) => c.textContent));
      check(d.map((x) => x.w + '×' + x.h).join() === '1600×1200,1600×1067', '8  width 2400 leaves both 1600-px photos at their own size', d.map((x) => x.w + '×' + x.h).join());
      check(/2 of 2 images were smaller than that and were left at their own size/.test(m.text), '8  …and says so', m.text);
      check(caps.every((c) => /kept: smaller than 2400×/.test(c)), '8  …on each card too', caps.join(' | '));
      await change(p, 'enlarge', 'yes');
      outs = await resultBytes(p);
      d = await Promise.all(outs.map((b) => pixels(p, b, [[0, 0]])));
      m = await msg(p);
      /* asked for, so not silent: no warning (the shell names enlarging only when nobody asked for it) */
      check(d.map((x) => x.w + '×' + x.h).join() === '2400×1800,2400×1601' && !m.text, '8  "Allow enlarging: Yes" enlarges them', d.map((x) => x.w + '×' + x.h).join() + ' ' + m.text);
      await change(p, 'value', 800);
      outs = await resultBytes(p);
      d = await Promise.all(outs.map((b) => pixels(p, b, [[0, 0]])));
      check(d.map((x) => x.w + '×' + x.h).join() === '800×600,800×534', '8  shrinking is unaffected', d.map((x) => x.w + '×' + x.h).join());
      check(!p.__errors.length, '8  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 9  cropper: a locked ratio holds when the drag runs past an edge */
    if (want(9)) {
      /* `let`: the helpers below act on whichever page p is, the mouse page and then the touch page */
      let p = await open(browser, '/image/image-cropper/');
      await p.setViewport({ width: 1700, height: 2100 });
      /* a PNG whose every pixel says where it is: r = x & 255, g = y & 255, b = (x >> 8) << 4 | (y >> 8) */
      const posPng = (w, h) => p.evaluate((w, h) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d'); const d = x.createImageData(w, h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j * w + i) * 4; d.data[k] = i & 255; d.data[k + 1] = j & 255; d.data[k + 2] = ((i >> 8) << 4) | (j >> 8); d.data[k + 3] = 255; }
        x.putImageData(d, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      }, w, h);
      const ratios = await p.$$eval('#ic-ratio option', (l) => l.map((o) => o.value));
      check(ratios.join() === 'free,1:1,4:3,3:2,16:9,9:16,3:4,2:3', '9  the ratio presets are Free, 1:1, 4:3, 3:2, 16:9, 9:16, 3:4, 2:3', ratios.join());
      /* drags as fractions of the canvas; ±M means M px beyond that edge on screen */
      const M = 90;
      const DRAGS = {
        inside: [0.2, 0.2, 0.7, 0.6],
        E: [0.4, 0.3, '1+', 0.8], W: [0.6, 0.7, '-', 0.2], S: [0.3, 0.4, 0.9, '1+'], N: [0.7, 0.6, 0.1, '-'],
        SE: [0.5, 0.5, '1+', '1+'], SW: [0.5, 0.5, '-', '1+'], NE: [0.5, 0.5, '1+', '-'], NW: [0.5, 0.5, '-', '-'],
        'SE from a corner': [0.97, 0.97, '1+', '1+'], 'NW from a corner': [0.03, 0.03, '-', '-']
      };
      const readBox = async () => { const m = /(\d+) × (\d+) px\s+at (\d+), (\d+)/.exec(await p.$eval('.select-readout', (e) => e.textContent)) || []; return { w: +m[1], h: +m[2], x: +m[3], y: +m[4] }; };
      /* the result card's image: its size, and the positions its corner pixels carry */
      const readOut = () => p.evaluate(async () => {
        const i = document.querySelector('.tool-io .image-stage img.image-preview');
        const bm = await createImageBitmap(await (await fetch(i.src)).blob());
        const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
        const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
        const at = (a, b) => { const d = x.getImageData(a, b, 1, 1).data; return [d[0] | ((d[2] >> 4) << 8), d[1] | ((d[2] & 15) << 8)]; };
        return { w: bm.width, h: bm.height, tl: at(0, 0), br: at(bm.width - 1, bm.height - 1) };
      });
      const doDrag = async (W, H, d, touch) => {
        /* since wave 1 a drag that starts inside the box moves it and one on a handle resizes it; to test
           drawing, the box is first parked as a tiny one near the top-right corner with the X/Y/Width/Height
           boxes, away from every start point used here */
        await p.evaluate((W, H) => {
          const set = (k, v) => { const i = document.getElementById('crop-' + k); i.value = String(v); i.dispatchEvent(new Event('change')); };
          set('w', 2); set('h', 2); set('x', Math.round(W * 0.88)); set('y', Math.round(H * 0.05));
        }, W, H);
        /* …and its own render has landed, so a slow earlier render cannot pass for the drag's */
        await p.waitForFunction(() => { const i = document.querySelector('.tool-io .image-stage img.image-preview'); return i && i.complete && i.naturalWidth > 0 && i.naturalWidth <= 3; }, { timeout: 20000, polling: 50 });
        await sleep(100);
        await p.$eval('.select-canvas', (e) => window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - 150, behavior: 'instant' }));
        await sleep(60);
        const r = await p.$eval('.select-canvas', (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
        const vw = 1700, vh = 2100;
        const to = (f, o, len, max) => f === '1+' ? Math.min(max - 2, o + len + M) : f === '-' ? Math.max(2, o - M) : o + len * f;
        /* whole CSS pixels, so the event's clientX/Y is exactly the point computed here */
        const x0 = Math.round(r.x + r.w * d[0]), y0 = Math.round(r.y + r.h * d[1]);
        const x1 = Math.round(to(d[2], r.x, r.w, vw)), y1 = Math.round(to(d[3], r.y, r.h, vh));
        const before = await previews(p);
        if (touch) {
          await p.touchscreen.touchStart(x0, y0);
          for (let k = 1; k <= 6; k++) await p.touchscreen.touchMove(x0 + (x1 - x0) * k / 6, y0 + (y1 - y0) * k / 6);
          await p.touchscreen.touchEnd();
        } else {
          await p.mouse.move(x0, y0); await p.mouse.down();
          await p.mouse.move(x1, y1, { steps: 6 }); await p.mouse.up();
        }
        await p.waitForFunction((old) => { const i = document.querySelector('.tool-io .image-stage img.image-preview'); return i && i.src.startsWith('blob:') && old.indexOf(i.src) < 0; }, { timeout: 15000, polling: 50 }, before);
        /* what the page should do, worked out here from the pointer: anchor at the start, pointer held inside the picture */
        const src = (cx, cy) => ({ x: (cx - r.x) / r.w * W, y: (cy - r.y) / r.h * H });
        const s = src(x0, y0), e = src(x1, y1);
        const ex = Math.min(W, Math.max(0, e.x)), ey = Math.min(H, Math.max(0, e.y));
        return { s, beyond: { x: e.x < 0 || e.x > W, y: e.y < 0 || e.y > H }, availW: Math.abs(ex - s.x), availH: Math.abs(ey - s.y), left: e.x < s.x, up: e.y < s.y };
      };
      const faults = [], errs = [];
      let n = 0;
      const IMAGES = [['landscape', 1600, 1000], ['portrait', 900, 1500], ['square', 1200, 1200]];
      for (const [label, W, H] of IMAGES) {
        const f = path.join(OUT, 'crop-' + label + '.png');
        fs.writeFileSync(f, Buffer.from(await posPng(W, H), 'base64'));
        /* a fresh page per picture, ratio Free to start */
        if (label !== 'landscape') { errs.push(...p.__errors); await p.close(); p = await open(browser, '/image/image-cropper/'); await p.setViewport({ width: 1700, height: 2100 }); }
        await upload(p, [f]);
        for (const ratio of ratios) {
          if (ratio !== 'free') await change(p, 'ratio', ratio);
          const [ra, rb] = ratio === 'free' ? [0, 0] : ratio.split(':').map(Number);
          for (const [dn, d] of Object.entries(DRAGS)) {
            const g = await doDrag(W, H, d, false);
            const b = await readBox(); const o = await readOut();
            n++;
            const name = label + ' ' + W + '×' + H + ', ' + ratio + ', ' + dn + ': ' + b.w + '×' + b.h + ' at ' + b.x + ',' + b.y;
            const why = [];
            if (!(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H)) why.push('outside the picture');
            if (ra && (ra >= rb ? Math.abs(b.h - b.w * rb / ra) > 0.5 : Math.abs(b.w - b.h * ra / rb) > 0.5)) why.push('not ' + ratio);
            /* anchored: the edge the drag started from stays at the start point (rounding: 1 px) */
            const ax = g.left ? b.x + b.w : b.x, ay = g.up ? b.y + b.h : b.y;
            if (Math.abs(ax - g.s.x) > 1.01 || Math.abs(ay - g.s.y) > 1.01) why.push('moved off the start point ' + g.s.x.toFixed(1) + ',' + g.s.y.toFixed(1));
            /* as big as the drag allows: free uses both sides in full; a ratio uses one in full and trims the other */
            /* (the start is rounded to a whole pixel and a ratio's longer side rounds down: up to 1.5 px short) */
            const fullW = Math.abs(b.w - g.availW) <= 1.6, fullH = Math.abs(b.h - g.availH) <= 1.6;
            if (b.w > g.availW + 1.01 || b.h > g.availH + 1.01) why.push('bigger than the drag (' + g.availW.toFixed(1) + '×' + g.availH.toFixed(1) + ')');
            else if (ra ? !(fullW || fullH) : !(fullW && fullH)) why.push('smaller than the drag allows (' + g.availW.toFixed(1) + '×' + g.availH.toFixed(1) + ')');
            if (dn !== 'inside' && !g.beyond.x && !g.beyond.y) why.push('the pointer never left the picture');
            /* the downloaded crop is that rectangle, pixel for pixel at its corners */
            if (o.w !== b.w || o.h !== b.h || o.tl[0] !== b.x || o.tl[1] !== b.y || o.br[0] !== b.x + b.w - 1 || o.br[1] !== b.y + b.h - 1) why.push('result ' + o.w + '×' + o.h + ' from ' + o.tl + ' to ' + o.br);
            if (why.length) faults.push(name + ' — ' + why.join('; '));
          }
        }
      }
      check(!faults.length, '9  ' + n + ' mouse drags (3 images × 8 ratios × ' + Object.keys(DRAGS).length + ' drags, past every edge and corner): each box inside the picture, anchored, the locked shape, as big as the drag allows, and the crop is exactly that rectangle', faults.slice(0, 6).join(' | '));
      /* the regression the claims test found: 1:1 dragged past the bottom edge of the 1600×1200 street photo came out 1121×1080 */
      errs.push(...p.__errors); await p.close();
      p = await open(browser, '/image/image-cropper/'); await p.setViewport({ width: 1700, height: 2100 });
      await setCtl(p, 'ratio', '1:1');
      await upload(p, [path.join(SAMPLES, 'street.jpg')]);
      await doDrag(1600, 1200, [0.1, 0.1, 0.8, '1+'], false);
      let b = await readBox();
      check(b.w === b.h && b.y + b.h === 1200, '9  street.jpg, 1:1, dragged past the bottom edge: a square that reaches the edge (was 1121×1080)', b.w + '×' + b.h + ' at ' + b.x + ',' + b.y);
      errs.push(...p.__errors);
      check(!errs.length, '9  no page errors', errs.join(' | '));
      await p.close();
      /* the same with a finger: touch events, on a page that reports a touch screen */
      p = await open(browser, '/image/image-cropper/');
      await p.setViewport({ width: 1700, height: 2100, hasTouch: true });
      await upload(p, [path.join(OUT, 'crop-portrait.png')]);
      const touched = [];
      for (const [ratio, dn, ok] of [['16:9', 'SE', (b) => Math.abs(b.h - b.w * 9 / 16) <= 0.5], ['9:16', 'NW', (b) => Math.abs(b.w - b.h * 9 / 16) <= 0.5], ['1:1', 'E', (b) => b.w === b.h]]) {
        await change(p, 'ratio', ratio);
        await doDrag(900, 1500, DRAGS[dn], true);
        b = await readBox();
        const o = await readOut();
        touched.push({ s: ratio + ' ' + dn + ' ' + b.w + '×' + b.h + ' at ' + b.x + ',' + b.y, good: ok(b) && b.w > 50 && b.x >= 0 && b.y >= 0 && b.x + b.w <= 900 && b.y + b.h <= 1500 && o.w === b.w && o.h === b.h && o.tl[0] === b.x && o.tl[1] === b.y });
      }
      check(touched.every((x) => x.good), '9  touch drags past the edges of the 900×1500 picture keep 16:9, 9:16 and 1:1 inside it', touched.map((x) => x.s).join(' | '));
      check(!p.__errors.length, '9  no page errors (touch)', p.__errors.join(' | '));
      await p.close();
    }

    /* ============ 10 names from what was produced; failures named; previews and listeners let go ============ */
    if (want(10)) {
      const street = path.join(SAMPLES, 'street.jpg'), food = path.join(SAMPLES, 'food.jpg');
      /* Safari has no WebP encoder: asked for image/webp, its toBlob writes a PNG. This stand-in does the same. */
      const SAFARI = () => {
        const orig = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { return orig.call(this, cb, type === 'image/webp' ? 'image/png' : type, q); };
      };
      /* …and with WebAssembly switched off, so the page has only the browser's own encoder (since wave 1 the
         compressor and resizers encode with MozJPEG, libwebp and oxipng in a worker, which write WebP everywhere) */
      const SAFARI_NO_WASM = () => {
        const orig = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { return orig.call(this, cb, type === 'image/webp' ? 'image/png' : type, q); };
        try { delete window.WebAssembly; } catch (e) { window.WebAssembly = undefined; }
      };
      /* a browser whose toBlob gives null above a pixel count */
      const NULL_ABOVE = (limit) => '(() => { try { delete window.WebAssembly; } catch (e) { window.WebAssembly = undefined; } const orig = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { if (this.width * this.height > ' + limit + ') { setTimeout(() => cb(null), 0); return; } return orig.call(this, cb, type, q); }; })();';
      /* a phone: a canvas over 16,777,216 pixels gets no buffer, so it reads back empty and encodes to null */
      const PHONE = () => {
        const LIMIT = 16777216;
        const gid = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) { return this.canvas.width * this.canvas.height > LIMIT ? new ImageData(w, h) : gid.call(this, x, y, w, h); };
        const tb = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { if (this.width * this.height > LIMIT) { setTimeout(() => cb(null), 0); return; } return tb.call(this, cb, type, q); };
      };
      /* the window listeners a page holds, by type */
      const LISTEN = () => {
        const live = window.__live = {};
        const add = window.addEventListener, rem = window.removeEventListener;
        window.addEventListener = function (t, f, o) { (live[t] = live[t] || new Set()).add(f); return add.call(this, t, f, o); };
        window.removeEventListener = function (t, f, o) { if (live[t]) live[t].delete(f); return rem.call(this, t, f, o); };
      };
      const SWAP = 'This browser cannot write WebP, so PNG was produced.';
      const LIMIT_RE = /16,777,216 pixels \(4096×4096\)/;
      const clickAll = async (p, sel) => {
        await p.evaluate(() => { window.__downloads = []; });
        await p.$$eval(sel, (l) => l.forEach((b) => b.click()));
        for (let k = 0; k < 40 && !(await p.evaluate(() => window.__downloads.length)); k++) await sleep(100);
        await sleep(300);
        return (await downloads(p)).map((d) => { const b = Buffer.from(d.bytes); return { name: d.name, b, png: isPng(b), webp: isWebp(b), jpeg: isJpeg(b) }; });
      };
      /* the names in a ZIP, read from its local file headers */
      const zipNames = (b) => { const out = []; let i = 0; while (i + 30 <= b.length && b.readUInt32LE(i) === 0x04034b50) { const n = b.readUInt16LE(i + 26), x = b.readUInt16LE(i + 28), size = b.readUInt32LE(i + 18); out.push(b.slice(i + 30, i + 30 + n).toString('utf8')); i += 30 + n + x + size; } return out; };
      const alive = (p, urls) => p.evaluate((l) => Promise.all(l.map((u) => fetch(u).then(() => true, () => false))), urls);
      const smallPng = path.join(OUT, 'small-300x200.png');
      const errs = [];
      const engineSrc = fs.readFileSync(path.join(ROOT, 'engine', 'render-image.js'), 'utf8');
      check(!/function encode\s*\(/.test(engineSrc) && !/extFor\(fmt\)/.test(engineSrc), '10  render-image.js: the unused encode() is gone, and no file name takes its extension from the requested format');

      /* 10a  a browser that writes PNG when asked for WebP, without WebAssembly */
      let p = await open(browser, '/image/image-compressor/', SAFARI_NO_WASM);
      await setCtl(p, 'format', 'image/webp');
      await upload(p, [street, food]);
      let outs = await resultBytes(p);
      let m = await msg(p);
      let dl = await clickAll(p, '.tool-io .image-stage .image-card button:not(.ho-ui)');
      check(outs.length === 2 && outs.every(isPng), '10  compressor, WebP asked of a browser that writes PNG instead: both results are PNG bytes', outs.map((b) => b.slice(0, 4).toString('hex')).join());
      check(dl.length === 2 && dl.every((d) => d.png) && dl.map((d) => d.name).join() === 'street-image-compressor.png,food-image-compressor.png',
        '10  …saved as street-image-compressor.png and food-image-compressor.png, not .webp', dl.map((d) => d.name).join());
      check(m.text.split(SWAP).length === 2 && /is-warn/.test(m.cls), '10  …and the message says, once: "' + SWAP + '"', m.text);
      check(!/or WebP/.test(m.text), '10  …and the advice for a larger result no longer offers WebP in that browser', m.text);
      check(/WebAssembly encoders are not available in this browser, so its own encoder was used/.test(m.text), '10  …and the page says the WebAssembly encoders were not available', m.text);
      fs.writeFileSync(smallPng, Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#2a9d8f'; x.fillRect(0, 0, 300, 200); return c.toDataURL('image/png').split(',')[1]; }), 'base64'));
      errs.push(...p.__errors); await p.close();
      /* the same browser WITH WebAssembly (wave 1): libwebp writes real WebP, so the swap never happens */
      p = await open(browser, '/image/image-compressor/', SAFARI);
      await setCtl(p, 'format', 'image/webp');
      await upload(p, [street, food]);
      outs = await resultBytes(p);
      dl = await clickAll(p, '.tool-io .image-stage .image-card button:not(.ho-ui)');
      m = await msg(p);
      check(outs.length === 2 && outs.every(isWebp) && dl.length === 2 && dl.map((d) => d.name).join() === 'street-image-compressor.webp,food-image-compressor.webp' && m.text.indexOf('cannot write') < 0,
        '10  a browser whose canvas cannot write WebP, with WebAssembly: WebP bytes from libwebp, named .webp, no swap message', dl.map((d) => d.name).join() + ' | ' + m.text);
      errs.push(...p.__errors); await p.close();
      /* where WebP can be written, it still is */
      p = await open(browser, '/image/image-compressor/');
      await setCtl(p, 'format', 'image/webp');
      await upload(p, [street]);
      outs = await resultBytes(p);
      dl = await clickAll(p, '.tool-io .image-stage .image-card button:not(.ho-ui)');
      m = await msg(p);
      check(outs.length === 1 && isWebp(outs[0]) && dl.length === 1 && dl[0].webp && dl[0].name === 'street-image-compressor.webp' && m.text.indexOf('cannot write') < 0,
        '10  in a browser that writes WebP: street-image-compressor.webp, WebP bytes, no swap message', dl.map((d) => d.name).join() + ' | ' + m.text);
      errs.push(...p.__errors); await p.close();
      /* the bulk resizer: every card and every name in the ZIP */
      p = await open(browser, '/image/bulk-image-resizer/', SAFARI_NO_WASM);
      await setCtl(p, 'value', 800);
      await upload(p, [street, food]);
      outs = await resultBytes(p);
      dl = await clickAll(p, '.tool-io .image-stage .image-card button:not(.ho-ui)');
      const zip = await clickAll(p, '.tool-io .image-actions .btn-primary');
      const inZip = zip.length === 1 ? zipNames(zip[0].b) : [];
      m = await msg(p);
      check(outs.length === 2 && outs.every(isPng) && dl.length === 2 && dl.every((d) => d.png && /^(street|food)-.*\.png$/.test(d.name)),
        '10  bulk resizer, WebP asked, PNG written: each saved file is PNG bytes named .png', dl.map((d) => d.name).join());
      check(inZip.length === 2 && inZip.every((n) => /\.png$/.test(n)) && inZip.join() === dl.map((d) => d.name).join(), '10  …and so is every name inside the ZIP', inZip.join());
      check(m.text.split(SWAP).length === 2, '10  …and the message says so once', m.text);
      errs.push(...p.__errors); await p.close();
      /* the cropper, WebP chosen */
      p = await open(browser, '/image/image-cropper/', SAFARI_NO_WASM);
      await setCtl(p, 'format', 'image/webp');
      await upload(p, [street]);
      dl = await clickAll(p, '.tool-io .image-actions .btn-primary');
      m = await msg(p);
      check(dl.length === 1 && dl[0].png && dl[0].name === 'street-image-cropper.png' && m.text.indexOf(SWAP) >= 0,
        '10  cropper, WebP chosen, PNG written: street-image-cropper.png, PNG bytes, and the message says so', dl.map((d) => d.name).join() + ' | ' + m.text);
      errs.push(...p.__errors); await p.close();
      /* …and with WebAssembly the cropper's WebP comes from libwebp, since the canvas cannot write it */
      p = await open(browser, '/image/image-cropper/', SAFARI);
      await setCtl(p, 'format', 'image/webp');
      await upload(p, [street]);
      dl = await clickAll(p, '.tool-io .image-actions .btn-primary');
      m = await msg(p);
      check(dl.length === 1 && dl[0].webp && dl[0].name === 'street-image-cropper.webp' && m.text.indexOf(SWAP) < 0,
        '10  cropper, WebP chosen in that browser with WebAssembly: street-image-cropper.webp, WebP bytes, no swap', dl.map((d) => d.name).join() + ' | ' + m.text);
      errs.push(...p.__errors); await p.close();

      /* 10b  files that cannot be read are named, and the rest go on */
      const broken = path.join(OUT, 'broken.png');
      fs.writeFileSync(broken, Buffer.from('this is not a picture at all, whatever its name says'));
      const notes = path.join(OUT, 'notes.txt');
      fs.writeFileSync(notes, 'a shopping list');
      p = await open(browser, '/image/bulk-image-resizer/');
      await setCtl(p, 'value', 800);
      await upload(p, [street, broken, notes, food]);
      outs = await resultBytes(p);
      m = await msg(p);
      check(outs.length === 2 && /broken\.png could not be read as an image, so it was left out\./.test(m.text) && /notes\.txt is not an image, so it was left out\./.test(m.text) && /is-warn/.test(m.cls),
        '10  bulk resizer: a broken .png and a .txt among two photos are each named in the message, and both photos are resized', outs.length + ' | ' + m.text);
      await change(p, 'value', 600);
      m = await msg(p);
      check(/broken\.png could not be read/.test(m.text), '10  …the names stay on screen when a setting changes', m.text);
      errs.push(...p.__errors); await p.close();
      p = await open(browser, '/image/image-compressor/');
      await upload(p, [broken, street]);
      outs = await resultBytes(p);
      m = await msg(p);
      check(outs.length === 1 && /broken\.png could not be read as an image, so it was left out\./.test(m.text) && stat(await stats(p), 'Images processed') === '1',
        '10  compressor: the broken file is named, the photo is compressed', m.text);
      errs.push(...p.__errors); await p.close();

      /* 10c  a result the browser cannot encode is named with the size limit; the rest go on */
      p = await open(browser, '/image/image-compressor/', NULL_ABOVE(1000000));
      await upload(p, [street, smallPng]);
      outs = await resultBytes(p);
      m = await msg(p);
      check(outs.length === 1 && /street\.jpg: this browser could not encode the 1600×1200 result, so it was skipped\./.test(m.text) && LIMIT_RE.test(m.text) && !/could not encode that format/.test(m.text),
        '10  compressor, toBlob null for the 1600×1200 photo: named, with the size limit, and the 300×200 one is still made', m.text);
      check(stat(await stats(p), 'Images processed') === '1 of 2', '10  …"Images processed" says 1 of 2', stat(await stats(p), 'Images processed'));
      errs.push(...p.__errors); await p.close();
      p = await open(browser, '/image/bulk-image-resizer/', NULL_ABOVE(4000000));
      await setCtl(p, 'value', 2400);
      await setCtl(p, 'enlarge', 'yes');
      await upload(p, [street, food]);
      outs = await resultBytes(p);
      const dims = await Promise.all(outs.map((b) => pixels(p, b, [[0, 0]])));
      m = await msg(p);
      check(dims.map((d) => d.w + '×' + d.h).join() === '2400×1601' && /street\.jpg: this browser could not encode the 2400×1800 result, so it was skipped\./.test(m.text) && LIMIT_RE.test(m.text),
        '10  bulk resizer, toBlob null over 4,000,000 px: street.jpg at 2400×1800 is named, food.jpg at 2400×1601 is made', dims.map((d) => d.w + '×' + d.h).join() + ' | ' + m.text);
      errs.push(...p.__errors); await p.close();

      /* 10d  over 16,777,216 pixels: made where the browser can hold it, named with the limit where it cannot */
      const bigRun = async (init, w, h) => {
        const q = await open(browser, '/image/bulk-image-resizer/', init);
        await setCtl(q, 'mode', 'exact'); await setCtl(q, 'value', w); await setCtl(q, 'height', h);
        await setCtl(q, 'enlarge', 'yes'); await setCtl(q, 'format', 'image/jpeg');
        const inp = await q.$('.tool-io input[type=file]');
        await inp.uploadFile(food);
        await q.waitForFunction(() => { const m = document.querySelector('.tool-io .io-msg'); return document.querySelector('.tool-io .image-stage img.image-preview') || (m && /pixels/.test(m.textContent)); }, { timeout: 60000, polling: 200 }).catch(() => null);   // neither: judged below
        await sleep(500);
        const got = await resultBytes(q);
        const d = got.length ? await pixels(q, got[0], [[0, 0]]) : null;
        const mm = await msg(q);
        errs.push(...q.__errors); await q.close();
        return { d, m: mm.text };
      };
      let r = await bigRun(null, 5000, 4000);
      check(r.d && r.d.w === 5000 && r.d.h === 4000 && !LIMIT_RE.test(r.m), '10  desktop Chrome: a 5000×4000 (20,000,000 px) result is still made', JSON.stringify(r.d) + ' ' + r.m);
      r = await bigRun(PHONE, 5000, 4000);
      check(!r.d && /food\.jpg: the 5000×4000 result is 20,000,000 pixels, over the 16,777,216 pixels \(4096×4096\) this browser can draw, so it was skipped\./.test(r.m) && !/could not encode that format/.test(r.m),
        '10  a phone (no canvas over 16,777,216 px): the 5000×4000 result is refused with a message naming the limit', r.m);
      r = await bigRun(PHONE, 4096, 4096);
      check(r.d && r.d.w === 4096 && r.d.h === 4096 && !LIMIT_RE.test(r.m), '10  …and 4096×4096, exactly the limit, is still made there', JSON.stringify(r.d) + ' ' + r.m);

      /* 10e  preview object URLs are let go on the next run and when the page is left */
      p = await open(browser, '/image/bulk-image-resizer/');
      await setCtl(p, 'value', 800);
      await upload(p, [street, food]);
      const first = await previews(p);
      await change(p, 'value', 600);
      const second = await previews(p);
      const a1 = await alive(p, first), a2 = await alive(p, second);
      check(first.length === 2 && a1.every((x) => !x) && second.length === 2 && a2.every(Boolean), '10  bulk resizer: the last run\'s two preview URLs are revoked by the next run; the new ones work', JSON.stringify([a1, a2]));
      await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
      const a3 = await alive(p, second);
      check(a3.every((x) => !x), '10  …and on pagehide the current ones are revoked too', JSON.stringify(a3));
      errs.push(...p.__errors); await p.close();

      /* 10f  the cropper holds one set of window listeners however many runs */
      p = await open(browser, '/image/image-cropper/', LISTEN);
      await p.setViewport({ width: 1400, height: 1600 });
      await upload(p, [street]);
      const count = () => p.evaluate(() => ['mousemove', 'touchmove', 'mouseup', 'touchend'].map((t) => (window.__live[t] || new Set()).size).join(','));
      const c1 = await count();
      const firstCrop = await previews(p);
      for (const ratio of ['1:1', '4:3', '16:9', '3:2', 'free']) await change(p, 'ratio', ratio);
      const c6 = await count();
      check(c1 === c6, '10  cropper: after five more runs the window holds the same mousemove, touchmove, mouseup and touchend listeners (' + c1 + '), not one more set per run', c1 + ' → ' + c6);
      check((await alive(p, firstCrop)).every((x) => !x), '10  …and the first run\'s result preview was revoked');
      /* a drag still works, and its new result revokes the one before */
      const before = await previews(p);
      const box = await p.$eval('.select-canvas', (e) => { e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
      await p.mouse.move(box.x + box.w * 0.2, box.y + box.h * 0.2); await p.mouse.down();
      await p.mouse.move(box.x + box.w * 0.6, box.y + box.h * 0.7, { steps: 5 }); await p.mouse.up();
      await p.waitForFunction((old) => { const i = document.querySelector('.tool-io .image-stage img.image-preview'); return i && i.src.startsWith('blob:') && old.indexOf(i.src) < 0; }, { timeout: 15000, polling: 50 }, before);
      const ro = await p.$eval('.select-readout', (e) => e.textContent);
      check(/^\d+ × \d+ px/.test(ro) && (await alive(p, before)).every((x) => !x) && (await count()) === c1, '10  …a drag still crops (' + ro.trim() + '), revokes the result before it, and adds no listener');
      errs.push(...p.__errors); await p.close();
      check(!errs.length, '10  no page errors', errs.join(' | '));
    }

    check(outside.length === 0, 'not one request outside ' + BASE + ' on any page', outside.join(' | '));
  } catch (e) {
    console.error(e && e.stack || e);
    fail++;
    await browser.close();
    if (server) server.close();
    process.exit(1);
  }
  await browser.close();
  if (server) server.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  process.exit(fail ? 2 : 0);
})();
