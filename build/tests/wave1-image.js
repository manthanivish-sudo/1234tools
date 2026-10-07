/**
 * Wave 1 (image): what the new shell and codecs promise, proved in headless
 * Chrome against a static server of the site, every result judged from its
 * own bytes with parsers of this file's own (a ZIP reader with CRC-32, a
 * JPEG segment and EXIF reader, a PNG chunk reader), never by the code that
 * made it:
 *
 *   node build/tests/wave1-image.js [--port 8910] [--root <site>] [--out <dir>] [--only 1,2,...]
 *
 * Ports 8910-8919 are this test's. Exit code 2 when a case fails, 1 when
 * the run itself breaks.
 *
 *   1  "make it under N KB": the 20, 50, 100, 200, 500 KB, 1 MB and 2 MB presets and
 *      a typed size give a file of at most N × 1,000 bytes (JPEG and WebP), in
 *      the right format, and the page names the limit
 *   2  batch: three photos give one ZIP; its central directory is read here,
 *      every entry's CRC-32 is recomputed, and every entry decodes to the
 *      size its name says
 *   3  save to a folder (File System Access API, stood in for): every result is
 *      written under its own name with its own bytes; a name that is taken gets (2)
 *   4  settings: "Copy settings link" gives a short link without the image;
 *      opening it sets the controls; a hostile link is clamped; the device
 *      remembers a changed setting under 1234tools-img-<tool>-v1 and nothing else
 *   5  no WebAssembly (and no canvas WebP, as in Safari): the page falls back, says so
 *      on screen, and the extension follows the bytes that were written
 *   6  HEIC: a HEIC file is named with the iPhone and Safari advice, and the
 *      other files of the batch are still made
 *   7  paste anywhere, and a dropped folder (webkitGetAsEntry), take images in
 *   8  metadata: nothing, colour profile, EXIF without GPS, everything: the
 *      result's own APP1 is parsed here
 *   9  the before/after view: a slider that the arrow keys move, side by side,
 *      and the saving shown for both sizes
 *  10  per-file settings: one file of a batch in its own format
 *  11  the codecs load on demand: no .wasm on page load, one after the first
 *      file; vendored codecs carry their licence file; nothing over 24 MiB
 *  12  the compare page's gap list is true of the compressor (target sizes, AVIF,
 *      metadata choices, HEIC only in Safari, no JPEG XL)
 *  13  the new Image Resizer is registered (job card, search, page) and opens
 *  14  an animated GIF converted to GIF is kept byte for byte; to PNG its first frame is used and the page says so
 *  15  the live before/after view: labelled sides, wheel, key and pinch zoom (10%-1600%), and a
 *      settings change shown in the same view at the same zoom, pan and divider; full screen; 390 px
 *  16  the Resize panel: % and width buttons, the shape lock, never enlarged, the method, the readout,
 *      per-file width, presets; the converter and the resizers share it (old maxWidth/maxSide links: case 4)
 *   and, through all of it, not one request to anything but 127.0.0.1.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const vm = require('vm');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8910));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-wave1-image')));
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
    if (location.hash !== '#keep') { try { Object.keys(localStorage).filter((k) => /^1234tools-img-/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* none */ } }
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
/* parsers and fixtures of this file's own                             */
/* ------------------------------------------------------------------ */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** A ZIP read from its end-of-central-directory record: [{ name, method, crc, data }], data inflated here. */
function readZip(z) {
  const zlib = require('zlib');
  let e = z.length - 22;
  while (e >= 0 && z.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) return null;
  const n = z.readUInt16LE(e + 10);
  let at = z.readUInt32LE(e + 16);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (z.readUInt32LE(at) !== 0x02014b50) return null;
    const method = z.readUInt16LE(at + 10), crc = z.readUInt32LE(at + 16), csize = z.readUInt32LE(at + 20), nl = z.readUInt16LE(at + 28), xl = z.readUInt16LE(at + 30), cl = z.readUInt16LE(at + 32), lh = z.readUInt32LE(at + 42);
    const name = z.slice(at + 46, at + 46 + nl).toString('utf8');
    const lnl = z.readUInt16LE(lh + 26), lxl = z.readUInt16LE(lh + 28);
    const raw = z.slice(lh + 30 + lnl + lxl, lh + 30 + lnl + lxl + csize);
    out.push({ name, method, crc, data: method === 8 ? zlib.inflateRawSync(raw) : raw });
    at += 46 + nl + xl + cl;
  }
  return out;
}

/** A two-frame animated GIF, 2×1 pixels, written byte by byte (LZW with no table growth: clear, p0, p1, end at 3 bits). */
function animatedGif() {
  const pack = (codes) => { let acc = 0, n = 0; const out = []; for (const c of codes) { acc |= c << n; n += 3; while (n >= 8) { out.push(acc & 255); acc >>= 8; n -= 8; } } if (n) out.push(acc & 255); return out; };
  const frame = (a, b, delay) => [0x21, 0xf9, 4, 0, delay, 0, 0, 0, 0x2c, 0, 0, 0, 0, 2, 0, 1, 0, 0, 2].concat([3 > 0 ? pack([4, a, b, 5]).length : 0], pack([4, a, b, 5]), [0]);
  return Buffer.from([].concat(
    Array.from(Buffer.from('GIF89a')), [2, 0, 1, 0, 0x80, 0, 0], [255, 0, 0, 0, 0, 255],
    [0x21, 0xff, 11], Array.from(Buffer.from('NETSCAPE2.0')), [3, 1, 0, 0, 0],
    frame(0, 1, 10), frame(1, 0, 10), [0x3b]));
}
const sample = (f) => path.join(SAMPLES, f);
const dlOf = async (p, re) => {
  await p.evaluate(() => { window.__downloads = []; });
  await p.evaluate((src) => { const b = [...document.querySelectorAll('.tool-io button')].find((x) => new RegExp(src).test(x.textContent)); if (!b) throw new Error('no button ' + src); b.click(); }, re.source);
  await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
  const [d] = await downloads(p);
  return { name: d.name, type: d.type, bytes: Buffer.from(d.bytes) };
};
const kind = (b) => isJpeg(b) ? 'jpeg' : isPng(b) ? 'png' : isWebp(b) ? 'webp' : b.slice(4, 12).toString('latin1') === 'ftypavif' ? 'avif' : 'other';
const files = (p) => p.$$eval('.tool-io .image-cap', (l) => l.map((c) => c.textContent));

/* ------------------------------------------------------------------ */
(async () => {
  const server = await serve(ROOT, PORT);
  /* every request the server answers, workers' included (a page-level listener does not see a module worker's fetches) */
  const served = [];
  if (server && server.on) server.on('request', (req) => { served.push(req.url); });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const t0 = Date.now();
  const errs = [];
  try {
    /* ============ 1 target size ============ */
    if (want(1)) {
      const p = await open(browser, '/image/image-compressor/');
      await setCtl(p, 'format', 'image/jpeg');
      await upload(p, [sample('street.jpg')]);
      const out = [];
      for (const kb of ['20', '50', '100', '200', '500', '1000', '2000']) {
        await change(p, 'target', kb);
        const [b] = await resultBytes(p); const d = await pixels(p, b, [[0, 0]]);
        const row = stat(await stats(p), 'Size limit') || '';
        const ok = isJpeg(b) && b.length <= Number(kb) * 1000 && row.indexOf((Number(kb) * 1000).toLocaleString('en-GB')) >= 0 && d.w <= 1600;
        out.push(kb + ': ' + b.length + ' B ' + d.w + '×' + d.h);
        check(ok, '1  JPEG under ' + (kb >= 1000 ? kb / 1000 + ' MB' : kb + ' KB') + ': ' + b.length.toLocaleString('en-GB') + ' bytes at ' + d.w + '×' + d.h + ', the page says "' + row + '"', out[out.length - 1] + ' / ' + row);
      }
      /* a size where the photo already fits is left at its own quality and size: not made smaller than it need be */
      const [big] = await resultBytes(p); const bd = await pixels(p, big, [[0, 0]]);
      check(bd.w === 1600 && bd.h === 1200, '1  under 2 MB the 321 KB photo keeps its 1600×1200 pixels', bd.w + '×' + bd.h);
      await setCtl(p, 'format', 'image/webp');
      for (const kb of ['50', '200']) {
        await change(p, 'target', kb);
        const [b] = await resultBytes(p);
        check(isWebp(b) && b.length <= Number(kb) * 1000, '1  WebP under ' + kb + ' KB: ' + b.length.toLocaleString('en-GB') + ' bytes', b.length);
      }
      await change(p, 'target', 'custom');
      await change(p, 'targetKB', 70);
      const [c] = await resultBytes(p);
      check(isWebp(c) && c.length <= 70000 && c.length > 40000, '1  "Another size…" 70 KB: ' + c.length.toLocaleString('en-GB') + ' bytes', c.length);
      /* the presets are exactly the brief's list */
      const opts = await p.$eval('#ic-target', (e) => [...e.options].map((o) => o.value));
      check(opts.join() === '0,20,50,100,200,500,1000,2000,custom', '1  the presets are none, 20, 50, 100, 200, 500 KB, 1, 2 MB and a typed size', opts.join());
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 2 batch and ZIP ============ */
    if (want(2)) {
      const p = await open(browser, '/image/bulk-image-resizer/');
      await setCtl(p, 'mode', 'longest'); await setCtl(p, 'value', 800);
      await upload(p, [sample('portrait.jpg'), sample('street.jpg'), sample('food.jpg')]);
      const d = await dlOf(p, /as ZIP/);
      const z = readZip(d.bytes);
      check(!!z && /\.zip$/.test(d.name),'2  one ZIP of three: "' + d.name + '" (' + d.bytes.length.toLocaleString('en-GB') + ' bytes)', d.name + ' ' + d.type);
      const names = (z || []).map((e) => e.name).sort().join();
      check(names === 'food-800x534.webp,portrait-800x534.webp,street-800x600.webp', '2  its entries are food-800x534.webp, portrait-800x534.webp, street-800x600.webp', names);
      check((z || []).every((e) => crc32(e.data) === e.crc), '2  every entry\'s CRC-32, recomputed here from the inflated bytes, equals the stored one', (z || []).map((e) => e.name + ' ' + crc32(e.data).toString(16) + '/' + e.crc.toString(16)).join(' '));
      const dims = [];
      for (const e of z || []) { const px = await pixels(p, e.data, [[0, 0]]); dims.push(e.name + ' ' + px.w + '×' + px.h + ' ' + kind(e.data)); }
      check(dims.every((s) => { const m = /-(\d+)x(\d+)\.webp (\d+)×(\d+) webp/.exec(s); return m && m[1] === m[3] && m[2] === m[4]; }), '2  each entry is a WebP of the size in its name', dims.join('; '));
      const one = await resultBytes(p);
      check(one.length === 3 && one.every((b) => (z || []).some((e) => e.data.equals(b))), '2  the ZIP holds exactly the bytes the page shows', '');
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 3 save to a folder ============ */
    if (want(3)) {
      const stub = () => {
        window.__saved = {};
        const existing = new Set(['street-800x600.webp']);
        window.showDirectoryPicker = async () => ({
          name: 'Photos',
          getFileHandle: async (name, o) => {
            if (!(o && o.create)) { if (existing.has(name) || name in window.__saved) return {}; throw new DOMException('not found', 'NotFoundError'); }
            return { createWritable: async () => ({ write: async (blob) => { window.__saved[name] = Array.from(new Uint8Array(await blob.arrayBuffer())); }, close: async () => {} }) };
          }
        });
      };
      const p = await open(browser, '/image/bulk-image-resizer/', stub);
      await setCtl(p, 'mode', 'longest'); await setCtl(p, 'value', 800);
      await upload(p, [sample('portrait.jpg'), sample('street.jpg'), sample('food.jpg')]);
      const have = await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].some((b) => /Save all to a folder/.test(b.textContent)));
      check(have, '3  with the File System Access API the page offers "Save all to a folder…"');
      await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => /Save all to a folder/.test(b.textContent)).click());
      await p.waitForFunction(() => Object.keys(window.__saved).length >= 3, { timeout: 20000 }).catch(() => {});
      const saved = await p.evaluate(() => window.__saved);
      const results = await resultBytes(p);
      const names = Object.keys(saved).sort().join();
      check(names === 'food-800x534.webp,portrait-800x534.webp,street-800x600 (2).webp', '3  three files written, the name already taken became "street-800x600 (2).webp", nothing overwritten', names);
      check(Object.values(saved).every((a) => results.some((b) => b.equals(Buffer.from(a)))), '3  each written file holds exactly the bytes of a result on the page', '');
      const m = await msg(p);
      check(/Saved 3 files to the folder “Photos”/.test(m.text), '3  the page says where they went: "' + m.text.slice(0, 80) + '"', m.text);
      errs.push(...p.__errors); await p.close();
      const q = await open(browser, '/image/bulk-image-resizer/', () => { window.showDirectoryPicker = undefined; });
      await upload(q, [sample('street.jpg'), sample('food.jpg')]);
      const none = await q.evaluate(() => [...document.querySelectorAll('.tool-io button')].some((b) => /Save all to a folder/.test(b.textContent)));
      check(!none, '3  in a browser without the API no such button is shown');
      errs.push(...q.__errors); await q.close();
    }

    /* ============ 4 settings ============ */
    if (want(4)) {
      const copyStub = () => { window.__copied = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true }); };
      const p = await open(browser, '/image/image-compressor/', copyStub);
      await setCtl(p, 'format', 'image/webp'); await setCtl(p, 'quality', 70); await setCtl(p, 'width', 1200);
      await upload(p, [sample('street.jpg')]);
      await p.evaluate(() => document.querySelector('.img-link').click());
      await sleep(300);
      const link = await p.evaluate(() => window.__copied);
      const u = new URL(link || 'http://x/');
      check(u.pathname === '/image/image-compressor/' && u.searchParams.get('f') === 'webp' && u.searchParams.get('q') === '70' && u.searchParams.get('width') === '1200', '4  "Copy settings link" gives ?f=webp&q=70&width=1200 on this page', link);
      check(link.length < 160 && !/blob:|data:|base64|street/i.test(link), '4  the link is short (' + link.length + ' characters) and carries no image or file name', link);
      await sleep(500);
      const kept = await p.evaluate(() => localStorage.getItem('1234tools-img-image-compressor-v1'));
      let kv = null; try { kv = JSON.parse(kept); } catch (e) { /* none */ }
      check(!!kv && kv.format === 'image/webp' && Number(kv.quality) === 70 && Number(kv.width) === 1200 && kept.length < 200 && !/blob|data:/.test(kept), '4  the device remembers it as 1234tools-img-image-compressor-v1: ' + kept, kept);
      errs.push(...p.__errors); await p.close();
      /* the link, opened on a first visit */
      const q = await open(browser, u.pathname + u.search);
      const v = await q.evaluate(() => ['format', 'quality', 'width'].map((k) => document.getElementById('ic-' + k).value));
      const pv = await previews(q);
      check(v.join() === 'image/webp,70,1200' && pv.length === 0, '4  opened on a first visit it sets WebP, quality 70, width 1200 and holds no image', v.join() + ' / ' + pv.length + ' previews');
      errs.push(...q.__errors); await q.close();
      /* links and remembered settings from before the Resize panel: maxWidth is now the width */
      const old = await open(browser, '/image/image-compressor/?maxWidth=1600&f=jpg', () => { try { localStorage.removeItem('1234tools-img-image-compressor-v1'); } catch (e) { /* none */ } });
      const ov = await old.evaluate(() => ['format', 'width', 'height', 'lockAspect'].map((k) => document.getElementById('ic-' + k).value));
      check(ov.join() === 'image/jpeg,1600,,yes', '4  an old link with maxWidth=1600 sets the width to 1600, the height automatic and the shape locked: ' + ov.join(), ov.join());
      errs.push(...old.__errors); await old.close();
      const oldc = await open(browser, '/image/image-converter/?maxSide=800');
      const oc = await oldc.evaluate(() => ['width', 'height', 'lockAspect'].map((k) => document.getElementById('ic-' + k).value));
      check(oc.join() === '800,800,yes', '4  an old converter link with maxSide=800 fits the picture inside 800×800: ' + oc.join(), oc.join());
      errs.push(...oldc.__errors); await oldc.close();
      /* a hostile link: out-of-range and unknown values are not taken */
      const h = await open(browser, '/image/image-compressor/?q=999999&f=exe&width=-5&height=99999999&maxWidth=-5&target=bogus&nope=1');
      const hv = await h.evaluate(() => ['format', 'quality', 'width', 'target', 'height'].map((k) => [document.getElementById('ic-' + k).value, document.getElementById('ic-' + k).min, document.getElementById('ic-' + k).max]));
      check(hv[0][0] === 'same' && Number(hv[1][0]) <= 100 && Number(hv[1][0]) >= 10 && Number(hv[2][0] || 0) >= 0 && hv[3][0] === '0' && Number(hv[4][0]) <= 30000, '4  a hostile link (q=999999, f=exe, width=-5, height=99999999, target=bogus) leaves valid settings: ' + hv.map((x) => x[0]).join(), JSON.stringify(hv));
      errs.push(...h.__errors); await h.close();
      /* the page remembers across visits: the same device, a new page */
      const r = await open(browser, '/image/image-compressor/#keep', () => { try { localStorage.setItem('1234tools-img-image-compressor-v1', JSON.stringify({ format: 'image/jpeg', quality: 55 })); } catch (e) { /* none */ } });
      const rv = await r.evaluate(() => ['format', 'quality'].map((k) => document.getElementById('ic-' + k).value));
      check(rv.join() === 'image/jpeg,55', '4  a new visit on the same device starts from the remembered settings', rv.join());
      await r.evaluate(() => document.querySelector('.img-reset').click());
      const rv2 = await r.evaluate(() => ['format', 'quality'].map((k) => document.getElementById('ic-' + k).value));
      check(rv2.join() === 'same,80', '4  "Reset settings" returns to the defaults (keep format, 80)', rv2.join());
      errs.push(...r.__errors); await r.close();
    }

    /* ============ 5 fallbacks ============ */
    if (want(5)) {
      /* no WebAssembly at all */
      const p = await open(browser, '/image/image-compressor/', () => { window.WebAssembly = undefined; });
      await setCtl(p, 'format', 'image/webp');
      await upload(p, [sample('street.jpg')]);
      const [b] = await resultBytes(p);
      const m = await msg(p);
      check(isWebp(b) && /WebAssembly encoders/.test(m.text) && /own encoder/.test(m.text), '5  without WebAssembly the browser\'s own WebP encoder is used and the page says so: "' + m.text.slice(0, 90) + '…"', kind(b) + ' / ' + m.text);
      errs.push(...p.__errors); await p.close();
      /* Safari: no WebAssembly path used, and the canvas writes PNG when WebP is asked for */
      const q = await open(browser, '/image/image-compressor/', () => {
        window.WebAssembly = undefined;
        const tb = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (cb, type, qq) { return tb.call(this, cb, type === 'image/webp' || type === 'image/avif' ? 'image/png' : type, qq); };
      });
      await setCtl(q, 'format', 'image/webp');
      await upload(q, [sample('street.jpg')]);
      const [c] = await resultBytes(q);
      const mm = await msg(q);
      const d = await dlOf(q, /^Download/);
      check(isPng(c) && /\.png$/.test(d.name) && isPng(d.bytes) && /PNG/.test(mm.text), '5  Safari stand-in: WebP asked for, PNG written, the download is named ' + d.name + ' and the page says "' + mm.text.slice(0, 100) + '…"', kind(c) + ' ' + d.name + ' / ' + mm.text);
      errs.push(...q.__errors); await q.close();
      /* with WebAssembly, the same Safari still gets a real WebP from libwebp */
      const r = await open(browser, '/image/image-compressor/', () => {
        const tb = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (cb, type, qq) { return tb.call(this, cb, type === 'image/webp' || type === 'image/avif' ? 'image/png' : type, qq); };
      });
      await setCtl(r, 'format', 'image/webp');
      await upload(r, [sample('street.jpg')]);
      const [w] = await resultBytes(r);
      const d2 = await dlOf(r, /^Download/);
      check(isWebp(w) && /\.webp$/.test(d2.name), '5  the same browser with WebAssembly gets a real WebP from libwebp and a .webp name', kind(w) + ' ' + d2.name);
      errs.push(...r.__errors); await r.close();
    }

    /* ============ 6 HEIC ============ */
    if (want(6)) {
      const p = await open(browser, '/image/image-converter/');
      const heic = path.join(OUT, 'IMG_0001.HEIC');
      fs.writeFileSync(heic, Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic', 'latin1'), Buffer.alloc(40)]));
      await setCtl(p, 'format', 'image/jpeg');
      await upload(p, [heic, sample('food.jpg')]);
      const m = await msg(p);
      const [b] = await resultBytes(p);
      check(/IMG_0001\.HEIC is a HEIC photo/.test(m.text) && /Most Compatible/.test(m.text) && /Safari/.test(m.text), '6  a HEIC file is named, with the iPhone setting and Safari: "' + m.text.slice(0, 120) + '…"', m.text);
      check(b && isJpeg(b), '6  the other file of the batch is still converted (a JPEG of ' + (b ? b.length : 0) + ' bytes)', '');
      const lic = fs.readFileSync(path.join(ROOT, 'compare', 'free-image-compressor', 'index.html'), 'utf8');
      check(/HEIC photos from an iPhone open here only in Safari/.test(lic), '6  the compare page says the same: HEIC opens only in Safari');
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 7 paste and folder drop ============ */
    if (want(7)) {
      const p = await open(browser, '/image/bulk-image-resizer/');
      const bytes = Array.from(fs.readFileSync(sample('food.jpg')));
      const before = await previews(p);
      await p.evaluate((arr) => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(arr)], 'image.png', { type: 'image/jpeg' }));
        document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      }, bytes);
      await p.waitForFunction((old) => [...document.querySelectorAll('.tool-io .image-stage img.image-preview')].some((i) => i.src.startsWith('blob:') && old.indexOf(i.src) < 0), { timeout: 30000 }, before).catch(() => {});
      await p.waitForFunction(() => !document.querySelector('.tool-io[aria-busy]'), { timeout: 30000 });
      const caps = await files(p);
      check(caps.length === 1 && /pasted-/.test(await p.$eval('.tool-io', (e) => e.textContent)), '7  an image pasted with Ctrl+V anywhere on the page is added and named "pasted-…"', caps.join(' | '));
      /* a dropped folder: two images and a text file, one inside a sub-folder */
      await p.evaluate((arr) => {
        const mk = (n) => ({ isFile: true, isDirectory: false, name: n, file: (cb) => cb(new File([new Uint8Array(arr)], n, { type: n.endsWith('.txt') ? 'text/plain' : 'image/jpeg' })) });
        const dir = (name, kids) => { let given = false; return { isFile: false, isDirectory: true, name, createReader: () => ({ readEntries: (cb) => { if (given) cb([]); else { given = true; cb(kids); } } }) }; };
        const top = dir('holiday', [mk('b-2.jpg'), mk('notes.txt'), dir('more', [mk('a-1.jpg')])]);
        const ev = new Event('drop', { bubbles: true, cancelable: true });
        ev.dataTransfer = { items: [{ kind: 'file', webkitGetAsEntry: () => top }], files: [] };
        document.querySelector('.tool-io .dropzone, .tool-io .drop, .tool-io [class*=drop]').dispatchEvent(ev);
      }, bytes);
      await p.waitForFunction(() => document.querySelectorAll('.tool-io .file-list .file-row').length >= 3, { timeout: 30000 }).catch(() => {});
      await p.waitForFunction(() => !document.querySelector('.tool-io[aria-busy]'), { timeout: 60000 });
      const names = await p.$$eval('.tool-io .file-list .file-row .file-name', (l) => l.map((e) => e.textContent));
      check(names.indexOf('a-1.jpg') >= 0 && names.indexOf('b-2.jpg') >= 0, '7  a dropped folder adds the images in it and below it: ' + names.join(', '), names.join(', '));
      const m = await msg(p);
      check(/notes\.txt/.test(m.text) || names.indexOf('notes.txt') < 0, '7  the text file in the folder is not taken as an image' + (m.text ? ' (the page says "' + m.text.slice(0, 80) + '")' : ''), names.join(', '));
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 8 metadata ============ */
    if (want(8)) {
      const tagged = path.join(OUT, 'tagged.jpg');
      fs.writeFileSync(tagged, withExifFields(fs.readFileSync(sample('street.jpg')), { Make: 'DemoCam', Artist: 'A. Photographer', Copyright: '(c) 2026', gps: true }));
      const p = await open(browser, '/image/image-compressor/');
      await setCtl(p, 'format', 'image/jpeg');
      await upload(p, [tagged]);
      const got = {};
      for (const mode of ['none', 'icc', 'exif', 'all']) {
        await change(p, 'metadata', mode);
        const [b] = await resultBytes(p);
        const segs = jpegSegs(b) || [];
        got[mode] = { tags: tiffTags(b), icc: segs.some((s) => s.m === 0xe2 && /ICC_PROFILE/.test(s.id)), xmp: segs.some((s) => s.m === 0xe1 && /ns\.adobe\.com/.test(s.body.toString('latin1', 0, 40))) };
      }
      check(got.none.tags === null, '8  Metadata "Remove all": no EXIF in the result', JSON.stringify(got.none));
      check(got.icc.tags === null, '8  "Keep the colour profile only": no EXIF', JSON.stringify(got.icc));
      check(got.exif.tags && got.exif.tags.Make === 'DemoCam' && got.exif.tags.Copyright === '(c) 2026' && !got.exif.tags.gps, '8  "Keep colour profile and EXIF, without GPS": camera and copyright kept, the GPS pointer gone', JSON.stringify(got.exif));
      check(got.all.tags && got.all.tags.Make === 'DemoCam' && got.all.tags.gps === true, '8  "Keep everything": EXIF with its GPS pointer', JSON.stringify(got.all));
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 9 compare ============ */
    if (want(9)) {
      const p = await open(browser, '/image/image-compressor/');
      await upload(p, [sample('street.jpg')]);
      const sel = await p.evaluate(() => {
        const v = document.querySelector('.img-compare, .compare, [class*=compare]');
        const sl = document.querySelector('[role=slider]');
        return { have: !!v, slider: !!sl, now: sl && sl.getAttribute('aria-valuenow'), min: sl && sl.getAttribute('aria-valuemin'), max: sl && sl.getAttribute('aria-valuemax'), label: sl && (sl.getAttribute('aria-label') || '') };
      });
      check(sel.have && sel.slider && sel.label.length > 0, '9  a before/after view with a labelled slider (role=slider, "' + sel.label + '")', JSON.stringify(sel));
      await p.focus('[role=slider]');
      const a = await p.$eval('[role=slider]', (e) => Number(e.getAttribute('aria-valuenow')));
      await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
      const b = await p.$eval('[role=slider]', (e) => Number(e.getAttribute('aria-valuenow')));
      await p.keyboard.press('Home');
      const c = await p.$eval('[role=slider]', (e) => Number(e.getAttribute('aria-valuenow')));
      check(b > a && c < b, '9  the arrow keys move the slider (' + a + ' → ' + b + '), Home sends it to ' + c, [a, b, c].join());
      const txt = await p.$eval('.tool-io', (e) => e.textContent);
      const btn = await p.$$eval('.tool-io button', (l) => l.map((x) => x.textContent.trim()));
      check(btn.some((t) => /Side by side/i.test(t)) && btn.some((t) => /^Fit$/.test(t)) && btn.some((t) => /100%/.test(t)) && btn.some((t) => /200%/.test(t)), '9  Side by side, Fit, 100% and 200% are offered', btn.join(' | '));
      await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((x) => /Side by side/i.test(x.textContent)).click());
      await sleep(300);
      const two = await p.$$eval('.tool-io .image-stage img', (l) => l.filter((i) => i.getBoundingClientRect().width > 50).length);
      check(two >= 2, '9  side by side shows the original and the result as two pictures', two + ' images');
      const readout = (await p.$$eval('.img-compare-readout, .compare-readout, .stat-grid', (l) => l.map((e) => e.textContent).join(' '))) || '';
      check(/321\.4 KB/.test(readout) && /KB|MB/.test(readout), '9  the sizes of both versions and the saving are shown (original 321.4 KB)', readout.slice(0, 200));
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 10 per-file settings ============ */
    if (want(10)) {
      const p = await open(browser, '/image/image-compressor/');
      await setCtl(p, 'format', 'image/jpeg');
      await upload(p, [sample('street.jpg'), sample('food.jpg')]);
      const btn = await p.evaluate(() => { const b = [...document.querySelectorAll('.tool-io .file-list button, .tool-io .file-row button')].find((x) => /Own settings/i.test(x.textContent + x.title)); return !!b; });
      check(btn, '10  every file in a batch has an "Own settings" button');
      await act(p, async () => {
        await p.evaluate(() => { const rows = [...document.querySelectorAll('.tool-io .file-row')]; [...rows[1].querySelectorAll('button')].find((x) => /Own settings/i.test(x.textContent + x.title)).click(); });
        await sleep(300);
        await p.evaluate(() => { const s = document.querySelectorAll('.tool-io .img-own-panel')[1].querySelector('select'); s.value = 'image/png'; s.dispatchEvent(new Event('input', { bubbles: true })); });
      });
      const r = await resultBytes(p);
      check(r.length === 2 && r.map(kind).sort().join() === 'jpeg,png', '10  the second file in its own format (PNG) while the first stays JPEG: ' + r.map(kind).join(', '), r.map(kind).join());
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 11 codecs on demand, licences, size ============ */
    if (want(11)) {
      const seen = served;
      /* a clean profile: no HTTP cache and no service worker from the cases before */
      const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
      const p = await ctx.newPage();
      await p.setViewport({ width: 1280, height: 900 });
      await p.setRequestInterception(true);
      p.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !/^(data|blob):/.test(u)) { outside.push('codecs -> ' + u); return r.abort(); } r.continue(); });
      await p.setCacheEnabled(false);   /* earlier cases left the codecs in the HTTP cache */
      served.length = 0;
      await p.evaluateOnNewDocument(() => { try { localStorage.setItem('1234tools-consent', 'declined'); } catch (e) { /* none */ } });
      await p.goto(BASE + '/image/image-compressor/', { waitUntil: 'networkidle0' });
      const onLoad = seen.filter((u) => /\.wasm|jsquash|img-codec-worker/.test(u));
      check(onLoad.length === 0, '11  loading the compressor page fetches no WebAssembly codec and no codec worker', onLoad.join(', '));
      const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(sample('street.jpg'));
      await p.waitForFunction(() => document.querySelector('.tool-io img.image-preview'), { timeout: 30000 });
      await p.waitForFunction(() => !document.querySelector('.tool-io[aria-busy]'), { timeout: 30000 });
      const after = seen.filter((u) => /\.wasm/.test(u));
      check(after.length >= 1 && after.length <= 2 && after.every((u) => /mozjpeg_enc|oxipng|webp_enc/.test(u)), '11  after the first file one codec is fetched, on demand: ' + after.join(', '), after.join(', '));
      check(!seen.some((u) => /avif_enc/.test(u)), '11  the 3.3 MB AVIF codec is not fetched until AVIF is chosen', seen.filter((u) => /avif/.test(u)).join());
      await p.close(); await ctx.close();
      const V = path.join(ROOT, 'engine', 'vendor', 'jsquash');
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
      const all = walk(V);
      const big = all.filter((f) => fs.statSync(f).size > 24 * 1024 * 1024);
      check(big.length === 0, '11  no vendored codec file is over 24 MiB (the largest is ' + Math.max(...all.map((f) => fs.statSync(f).size)).toLocaleString('en-GB') + ' bytes)', big.join());
      const dirs = [...new Set(all.map((f) => path.dirname(f)))].filter((d) => all.some((f) => path.dirname(f) === d && /\.wasm$/.test(f)));
      const noLic = dirs.filter((d) => { let up = d; for (let k = 0; k < 4; k++) { if (fs.readdirSync(up).some((n) => /^LICEN[SC]E/i.test(n))) return false; up = path.dirname(up); if (up.length <= V.length - 1) break; } return true; });
      check(noLic.length === 0 && fs.existsSync(path.join(V, 'LICENSE')), '11  every folder with a .wasm has a LICENSE file beside it or above it, up to engine/vendor/jsquash/', noLic.join());
      const lic = all.filter((f) => /LICEN[SC]E/i.test(path.basename(f))).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
      check(!/GNU (Lesser |Affero )?General Public|Mozilla Public License|Eclipse Public|SSPL|CC-BY|non-?commercial/i.test(lic) && /Apache License|MIT License|BSD|Permission is hereby granted/i.test(lic), '11  the vendored licences are permissive (Apache-2.0, MIT, BSD) and none is GPL, LGPL, MPL or non-commercial');
      const worker = fs.readFileSync(path.join(ROOT, 'engine', 'img-codec-worker.mjs'), 'utf8');
      check(!/https?:\/\//.test(worker.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), '11  the codec worker names no URL of any other site');
    }

    /* ============ 12 the compare page is true of the compressor ============ */
    if (want(12)) {
      const html = fs.readFileSync(path.join(ROOT, 'compare', 'free-image-compressor', 'index.html'), 'utf8');
      const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
      const p = await open(browser, '/image/image-compressor/');
      const o = await p.evaluate(() => ({
        target: [...document.getElementById('ic-target').options].map((x) => x.value + '|' + x.textContent),
        format: [...document.getElementById('ic-format').options].map((x) => x.value),
        meta: [...document.getElementById('ic-metadata').options].map((x) => x.value + '|' + x.textContent),
        png: !!document.getElementById('ic-pngColours')
      }));
      const limits = ['20 KB', '50 KB', '100 KB', '200 KB', '500 KB', '1 MB', '2 MB'];
      check(limits.every((l) => text.indexOf(l) >= 0) && limits.every((l) => o.target.some((t) => t.split('|')[1] === l)), '12  the compare page lists the size limits the compressor really has (' + limits.join(', ') + ')', o.target.join(' / '));
      check(/AVIF/.test(text) && o.format.indexOf('image/avif') >= 0 && /JPEG XL does not/.test(text) && !o.format.some((v) => /jxl/.test(v)), '12  it says AVIF goes out (the compressor offers it) and JPEG XL does not (the compressor has no such format)', o.format.join());
      check(/nothing, the colour profile only, EXIF without GPS, or everything/.test(text) && o.meta.length === 4 && /GPS/.test(o.meta[2]) && /everything/i.test(o.meta[3]), '12  it names the four metadata choices the compressor has', o.meta.join(' / '));
      check(/256, 128, 64, 32, 16 or 8 colours/.test(text) && o.png, '12  it says PNG goes down to 8 colours (the compressor\'s PNG colours control)');
      const pc = await p.$eval('#ic-pngColours', (e) => [...e.options].map((x) => x.value).join());
      check(pc === 'all,256,128,64,32,16,8', '12  …and the PNG colour counts are exactly all, 256, 128, 64, 32, 16, 8', pc);
      const first = /<tr data-edge="(\w+)">/.exec(html);
      check(first && first[1] === 'them', '12  the first table row is one the other side wins', first && first[1]);
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 13 the new Image Resizer ============ */
    if (want(13)) {
      const jobs = fs.readFileSync(path.join(ROOT, 'build', 'jobs.js'), 'utf8');
      const idx = fs.readFileSync(path.join(ROOT, 'assets', 'search-index.js'), 'utf8');
      check(/'\/image\/image-resizer\/': \['Convert'/.test(jobs) && /image\/image-resizer\//.test(idx), '13  /image/image-resizer/ has a job card in build/jobs.js and a place in the site search');
      const p = await open(browser, '/image/image-resizer/');
      const h1 = await p.$eval('h1', (e) => e.textContent);
      const mult = await p.$eval('.tool-io input[type=file]', (e) => e.multiple);
      check(/Image Resizer/i.test(h1) && mult === false, '13  the page opens with the heading "' + h1 + '" and takes one image at a time', h1 + ' multiple=' + mult);
      await setCtl(p, 'mode', 'longest'); await setCtl(p, 'value', 1000);
      await upload(p, [sample('street.jpg')]);
      const [b] = await resultBytes(p); const d = await pixels(p, b, [[0, 0]]);
      check(isWebp(b) && d.w === 1000 && d.h === 750, '13  street.jpg at a longest side of 1000 becomes a 1000×750 WebP', kind(b) + ' ' + d.w + '×' + d.h);
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 14 animation ============ */
    if (want(14)) {
      const gif = path.join(OUT, 'two-frames.gif');
      fs.writeFileSync(gif, animatedGif());
      const p = await open(browser, '/image/image-converter/');
      await setCtl(p, 'format', 'image/gif');
      await upload(p, [gif]);
      const [same] = await resultBytes(p);
      const m = await msg(p);
      check(same && Buffer.from(same).equals(fs.readFileSync(gif)) && /animated \(2 frames\), so it was kept exactly as it is, every frame/.test(m.text), '14  an animated GIF converted to GIF is kept byte for byte, and the page says so: "' + m.text.slice(0, 90) + '"', m.text);
      await change(p, 'format', 'image/png');
      const [png] = await resultBytes(p);
      const m2 = await msg(p);
      const px = png ? await pixels(p, png, [[0, 0], [1, 0]]) : null;
      check(png && isPng(png) && /only its first frame was converted/.test(m2.text) && px.w === 2 && near(px.px[0], [255, 0, 0, 255], 2) && near(px.px[1], [0, 0, 255, 255], 2), '14  to PNG only the first frame is used (red, blue) and the page says so: "' + m2.text.slice(0, 90) + '"', m2.text + ' ' + (px && JSON.stringify(px.px)));
      errs.push(...p.__errors); await p.close();
    }

    /* ============ 15 the live before/after view: wheel and pinch zoom, kept through a settings change ============ */
    if (want(15)) {
      const p = await open(browser, '/image/image-compressor/');
      await upload(p, [sample('street.jpg')]);
      const st = await p.evaluate(() => {
        const io = document.querySelector('.tool-io'), box = document.querySelector('.img-compare');
        window.__box = box;
        const tags = [...document.querySelectorAll('.img-compare-port .img-compare-tag')].map((t) => t.textContent);
        return { live: io.classList.contains('img-live'), box: !!box, tags, pct: box && box.querySelector('.img-zoom-pct').textContent,
          beside: (() => { const a = document.querySelector('.tool-io .image-stage').getBoundingClientRect(), b = document.querySelector('.tool-io .opt-bar').getBoundingClientRect(); return a.right <= b.left + 1; })() };
      });
      check(st.live && st.box, '15  one picture: the before/after view is the main view (img-live)', JSON.stringify(st));
      check(/Original/.test(st.tags[0]) && /JPEG · 1600×1200 · 321\.4 KB/.test(st.tags[0]) && /Result/.test(st.tags[1]) && /JPEG · 1600×1200 · [\d.]+ KB/.test(st.tags[1]), '15  each side is labelled with its format, size in pixels and bytes: ' + st.tags.join(' | '), st.tags.join(' | '));
      check(st.beside, '15  at 1280 px the view sits beside the settings, not below them');
      /* every picture in the view has really loaded: the original and the result, in both modes */
      const decoded = (q) => q.evaluate(async () => {
        const imgs = [...document.querySelectorAll('.img-compare img')];
        await Promise.all(imgs.map((i) => i.decode().catch(() => null)));
        return imgs.map((i) => i.alt.split(':')[0] + ' ' + (i.naturalWidth ? i.naturalWidth + 'px from ' + i.src.slice(0, 5) : 'NOT LOADED (' + i.getAttribute('src') + ')'));
      });
      const okAll = (l) => l.length === 4 && l.every((x) => / \d+px from blob:/.test(x)) && l.filter((x) => /^Before/.test(x)).length === 2;
      let dl = await decoded(p);
      check(okAll(dl) && dl.some((x) => /^Before 1600px/.test(x)), '15  slider: the original (1600 px) and the result have both loaded: ' + dl.join(', '), dl.join(' | '));
      await p.evaluate(() => [...document.querySelectorAll('.img-compare .img-seg-btn')].find((x) => /Side by side/.test(x.textContent)).click());
      await sleep(200);
      dl = await decoded(p);
      const shown = await p.evaluate(() => [...document.querySelectorAll('.img-compare-side img')].map((i) => Math.round(i.getBoundingClientRect().width)));
      check(okAll(dl) && shown.every((w) => w > 100), '15  side by side: both pictures have loaded and are shown (' + shown.join(' and ') + ' px wide)', dl.join(' | ') + ' / ' + shown);
      await p.evaluate(() => [...document.querySelectorAll('.img-compare .img-seg-btn')].find((x) => /^Slider$/.test(x.textContent)).click());
      await sleep(100);
      /* the mouse wheel zooms about the pointer */
      const vr = await p.$eval('.img-compare-view', (v) => { const r = v.getBoundingClientRect(); return { x: r.left + r.width * 0.7, y: r.top + r.height * 0.4 }; });
      await p.mouse.move(vr.x, vr.y);
      await p.mouse.wheel({ deltaY: -600 });
      await sleep(200);
      const z1 = await p.evaluate(() => { const b = window.__box, v = b.querySelector('.img-compare-view'); return { pct: parseInt(b.querySelector('.img-zoom-pct').textContent, 10), zoomed: v.classList.contains('is-zoomed'), l: v.scrollLeft, t: v.scrollTop }; });
      check(z1.pct > parseInt(st.pct, 10) && z1.zoomed && z1.l > 0, '15  the mouse wheel zooms in about the pointer (' + st.pct + ' → ' + z1.pct + '%, scrolled to ' + z1.l + ',' + z1.t + ')', JSON.stringify(z1));
      await p.mouse.wheel({ deltaY: 100000 });
      await sleep(150);
      const zmin = await p.$eval('.img-zoom-pct', (e) => parseInt(e.textContent, 10));
      await p.mouse.wheel({ deltaY: -100000 }); await p.mouse.wheel({ deltaY: -100000 });
      await sleep(150);
      const zmax = await p.$eval('.img-zoom-pct', (e) => parseInt(e.textContent, 10));
      check(zmin >= 10 && zmin <= 100 && zmax === 1600, '15  zoom is held between 10% and 1600% (' + zmin + '% … ' + zmax + '%)', zmin + ' ' + zmax);
      await p.evaluate(() => window.__box.setZoom(2));
      await sleep(100);
      await p.evaluate(() => document.querySelector('.img-compare-handle').focus({ preventScroll: true }));
      await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
      const split = await p.$eval('[role=slider]', (e) => e.getAttribute('aria-valuenow'));
      const z2 = await p.evaluate(() => { const v = window.__box.querySelector('.img-compare-view'); v.scrollLeft = 700; v.scrollTop = 300; return { l: v.scrollLeft, t: v.scrollTop, pct: window.__box.querySelector('.img-zoom-pct').textContent }; });
      const src0 = await p.$eval('.img-compare-after', (i) => i.src);
      /* a settings change: a new result in the same view, at the same zoom, pan and divider */
      await change(p, 'quality', 40);
      const z3 = await p.evaluate(() => { const b = document.querySelector('.img-compare'), v = b.querySelector('.img-compare-view'); return { same: b === window.__box, l: v.scrollLeft, t: v.scrollTop, pct: b.querySelector('.img-zoom-pct').textContent, split: b.querySelector('[role=slider]').getAttribute('aria-valuenow'), src: b.querySelector('.img-compare-after').src, tag: b.querySelector('.img-compare-port .is-after').textContent, busy: !b.querySelector('.img-compare-busy').hidden }; });
      check(z3.same && z3.src !== src0 && z3.src.startsWith('blob:'), '15  a settings change shows the new result in the same view, live', JSON.stringify(z3));
      check(z3.pct === z2.pct && Math.abs(z3.l - z2.l) <= 2 && Math.abs(z3.t - z2.t) <= 2 && z3.split === split && !z3.busy, '15  …at the same zoom (' + z3.pct + '), pan (' + z3.l + ',' + z3.t + ') and divider (' + z3.split + '%)', JSON.stringify([z2, z3, split]));
      const r40 = await resultBytes(p);
      const dl2 = await decoded(p);
      check(okAll(dl2), '15  after the change the original is still loaded beside the new result: ' + dl2.join(', '), dl2.join(' | '));
      check(r40.length === 1 && z3.tag.indexOf((r40[0].length / 1024).toFixed(1) + ' KB') >= 0, '15  the result label follows the new file (' + z3.tag + ')', z3.tag + ' / ' + (r40[0] && r40[0].length));
      /* keys: + zooms in, 0 fits, 1 is 100% */
      await p.focus('.img-compare-view');
      await p.keyboard.press('0');
      const kf = await p.$eval('.img-zoom-pct', (e) => e.textContent);
      await p.keyboard.press('+');
      const kp = await p.$eval('.img-zoom-pct', (e) => e.textContent);
      await p.keyboard.press('1');
      const k1 = await p.$eval('.img-zoom-pct', (e) => e.textContent);
      check(parseInt(kp, 10) > parseInt(kf, 10) && k1 === '100%', '15  the keys zoom too: 0 fits (' + kf + '), + zooms in (' + kp + '), 1 is ' + k1, [kf, kp, k1].join());
      /* a two-finger pinch on a touch screen */
      await p.keyboard.press('0');
      const c = await p.$eval('.img-compare-view', (v) => { const r = v.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      const cdp = await p.target().createCDPSession();
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 2, radiusY: 2, force: 1 })) });
      const zp0 = parseInt(await p.$eval('.img-zoom-pct', (e) => e.textContent), 10);
      await touch('touchStart', [[c.x - 40, c.y], [c.x + 40, c.y]]);
      for (let k = 1; k <= 8; k++) { await touch('touchMove', [[c.x - 40 - k * 12, c.y], [c.x + 40 + k * 12, c.y]]); await sleep(16); }
      await touch('touchEnd', []);
      await sleep(150);
      const zp1 = parseInt(await p.$eval('.img-zoom-pct', (e) => e.textContent), 10);
      check(zp1 > zp0 * 1.5, '15  a two-finger pinch zooms in (' + zp0 + '% → ' + zp1 + '%)', zp0 + ' ' + zp1);
      /* full screen, and Escape out of it */
      await p.evaluate(() => document.querySelector('.img-full-btn').click());
      await sleep(200);
      const fs1 = await p.evaluate(() => { const io = document.querySelector('.tool-io'); const r = io.getBoundingClientRect(); return { full: io.classList.contains('is-full'), pos: getComputedStyle(io).position, w: r.width, beside: document.querySelector('.tool-io .image-stage').getBoundingClientRect().right <= document.querySelector('.tool-io .opt-bar').getBoundingClientRect().left + 1 }; });
      await p.keyboard.press('Escape');
      await sleep(100);
      const fs2 = await p.evaluate(() => document.querySelector('.tool-io').classList.contains('is-full'));
      check(fs1.full && fs1.pos === 'fixed' && fs1.w >= 1260 && fs1.beside && !fs2, '15  "Full screen" fills the window with the view beside the settings; Escape leaves it', JSON.stringify(fs1));
      errs.push(...p.__errors); await p.close();

      /* a 390 px phone: the view first, no sideways scrolling */
      const q = await open(browser, '/image/image-compressor/');
      await q.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await upload(q, [sample('street.jpg')]);
      const mo = await q.evaluate(() => {
        const stage = document.querySelector('.tool-io .image-stage').getBoundingClientRect(), bar = document.querySelector('.tool-io .opt-bar').getBoundingClientRect(), v = document.querySelector('.img-compare-view').getBoundingClientRect();
        return { above: stage.bottom <= bar.top + 1, sw: document.scrollingElement.scrollWidth, vw: v.width, tags: [...document.querySelectorAll('.img-compare-port .img-compare-tag')].map((t) => Math.round(t.getBoundingClientRect().right)) };
      });
      check(mo.above && mo.sw <= 390 && mo.vw <= 390 && mo.tags.every((r) => r <= 390), '15  at 390 px the view comes first, above the settings, and nothing scrolls sideways (' + mo.sw + ' px)', JSON.stringify(mo));
      errs.push(...q.__errors); await q.close();
    }

    /* ============ 16 the Resize panel ============ */
    if (want(16)) {
      const p = await open(browser, '/image/image-compressor/');
      const btns = await p.$$eval('.img-resize button', (l) => l.map((b) => b.textContent.trim() || b.getAttribute('aria-label')));
      check(['100%', '75%', '50%', '33%', '25%', '3840', '1920', '1280', '1080', '800'].every((t) => btns.indexOf(t) >= 0) && btns.some((t) => /Keep the shape/.test(t)), '16  Resize offers 100/75/50/33/25%, widths 3840 to 800 and a shape lock: ' + btns.join(' '), btns.join(' | '));
      const meth = await p.$$eval('#ic-resizeMethod option', (l) => l.map((o) => o.textContent));
      check(meth.length === 2 && /Lanczos3/.test(meth[0]) && /Browser/.test(meth[1]), '16  the method is Lanczos3 or the browser’s own: ' + meth.join(' / '), meth.join());
      const empty = await p.$eval('.img-resize-readout', (e) => e.textContent);
      check(/Choose an image/.test(empty), '16  before a picture is chosen the readout says so: ' + empty, empty);
      await upload(p, [sample('street.jpg')]);
      const dimsOf = async () => { const r = await resultBytes(p); const px = await pixels(p, r[0], [[0, 0]]); return [px.w, px.h]; };
      const press = (label) => act(p, () => p.evaluate((t) => [...document.querySelectorAll('.img-resize button')].find((b) => b.textContent.trim() === t).click(), label));
      await press('1280');
      let d = await dimsOf(); let ro = await p.$eval('.img-resize-readout', (e) => e.textContent);
      const ph = await p.$eval('#ic-height', (e) => [e.value, e.placeholder]);
      check(d.join() === '1280,960' && /1600×1200 → 1280×960 \(−36% pixels\)/.test(ro) && ph[0] === '' && ph[1] === '960', '16  width 1280: the result is 1280×960, the height follows (placeholder ' + ph[1] + ') and the readout says "' + ro + '"', d.join() + ' / ' + ro + ' / ' + ph);
      const tag = await p.$eval('.img-compare-port .is-after', (e) => e.textContent);
      const fw = await p.evaluate(() => { const b = document.querySelector('.img-compare'); b.setZoom(1); return b.querySelector('.img-compare-frame').getBoundingClientRect().width; });
      check(/1280×960/.test(tag) && Math.round(fw) === 1600, '16  the smaller result is shown at the original’s size, so its loss is seen in place (100% = ' + Math.round(fw) + ' px wide)', tag + ' / ' + fw);
      await press('50%');
      d = await dimsOf(); ro = await p.$eval('.img-resize-readout', (e) => e.textContent);
      check(d.join() === '800,600' && /→ 800×600 \(−75% pixels\)/.test(ro), '16  50%: 800×600 (' + ro + ')', d.join() + ' / ' + ro);
      await press('25%');
      d = await dimsOf();
      check(d.join() === '400,300', '16  25%: 400×300', d.join());
      /* unlocked, both sides: stretched to exactly that, and shown side by side */
      await p.evaluate(() => document.querySelector('.img-lock').click());
      await sleep(200);
      await setCtl(p, 'width', 500);
      await change(p, 'height', 500);
      d = await dimsOf();
      const sideBy = await p.evaluate(() => ({ side: !document.querySelector('.img-compare-side').hidden, slider: document.querySelector('.img-compare .img-seg-btn').disabled, lock: document.querySelector('.img-lock').getAttribute('aria-pressed') }));
      check(d.join() === '500,500' && sideBy.side && sideBy.slider && sideBy.lock === 'false', '16  unlocked, 500 × 500 stretches to exactly 500×500, shown side by side', d.join() + ' ' + JSON.stringify(sideBy));
      /* locked again: the height gives way to the width */
      await act(p, () => p.evaluate(() => document.querySelector('.img-lock').click()));
      d = await dimsOf();
      const hv = await p.$eval('#ic-height', (e) => e.value);
      check(d.join() === '500,375' && hv === '', '16  locked again, the width leads: 500×375', d.join() + ' / ' + hv);
      /* never enlarged unless asked */
      await change(p, 'width', 5000);
      d = await dimsOf(); ro = await p.$eval('.img-resize-readout', (e) => e.textContent);
      check(d.join() === '1600,1200' && /never enlarged/.test(ro), '16  width 5000 on a 1600 px picture keeps it at 1600×1200 and says it is never enlarged', d.join() + ' / ' + ro);
      /* the browser's own method */
      await setCtl(p, 'width', 1080);
      await change(p, 'resizeMethod', 'browser');
      d = await dimsOf();
      check(d.join() === '1080,810', '16  the browser method gives the same size (1080×810)', d.join());
      /* a preset sets the width in the panel */
      await act(p, () => p.evaluate(() => [...document.querySelectorAll('.img-preset')].find((b) => /Email/.test(b.textContent)).click()));
      d = await dimsOf();
      const wv = await p.$eval('#ic-width', (e) => e.value);
      check(d.join() === '1600,1200' && wv === '1600', '16  the "Email attachment" preset sets a width of 1600 in the panel (' + d.join() + ')', d.join() + ' ' + wv);
      errs.push(...p.__errors); await p.close();

      /* per file: one file of a batch at its own width */
      const b = await open(browser, '/image/image-compressor/');
      await upload(b, [sample('street.jpg'), sample('food.jpg')]);
      await act(b, async () => {
        await b.evaluate(() => { const rows = [...document.querySelectorAll('.tool-io .file-row')]; [...rows[1].querySelectorAll('button')].find((x) => /Own settings/i.test(x.textContent)).click(); });
        await sleep(200);
        await b.evaluate(() => { const i = document.querySelectorAll('.tool-io .img-own-panel')[1].querySelector('input[name=width]'); i.value = '640'; i.dispatchEvent(new Event('input', { bubbles: true })); });
      });
      const rb = await resultBytes(b);
      const ws = [];
      for (const x of rb) ws.push((await pixels(b, x, [[0, 0]])).w);
      check(ws.length === 2 && ws[1] === 640 && ws[0] > 640, '16  per-file settings carry the width: the second file at 640 px, the first kept (' + ws.join(', ') + ')', ws.join());
      errs.push(...b.__errors); await b.close();

      /* the converter has the same panel and view; the resizers have the view */
      const cv = await open(browser, '/image/image-converter/');
      await upload(cv, [sample('street.jpg')]);
      await change(cv, 'width', 800);
      const cr = await resultBytes(cv);
      const cd = await pixels(cv, cr[0], [[0, 0]]);
      const cl = await cv.evaluate(() => document.querySelector('.tool-io').classList.contains('img-live') && !!document.querySelector('.img-resize'));
      check(cl && cd.w === 800 && cd.h === 600, '16  the Image Converter has the Resize panel and the live view (800×600)', cl + ' ' + cd.w + '×' + cd.h);
      errs.push(...cv.__errors); await cv.close();
      for (const url of ['/image/image-resizer/', '/image/bulk-image-resizer/']) {
        const r = await open(browser, url);
        await upload(r, [sample('street.jpg')]);
        const r1 = await r.evaluate(() => { window.__box = document.querySelector('.img-compare'); return { box: !!window.__box, cards: document.querySelectorAll('.image-stage .image-card:not(.img-compare-card) img.image-preview').length }; });
        await change(r, 'quality', 55);
        const r2 = await r.evaluate(async () => { const imgs = [...document.querySelectorAll('.img-compare img')]; await Promise.all(imgs.map((i) => i.decode().catch(() => null))); return { same: document.querySelector('.img-compare') === window.__box, cards: document.querySelectorAll('.image-stage .image-card:not(.img-compare-card) img.image-preview').length, loaded: imgs.every((i) => i.naturalWidth > 0) }; });
        check(r2.loaded, '16  ' + url + ': the original and the result in the view have both loaded', JSON.stringify(r2));
        check(r1.box && r1.cards === 1 && r2.same && r2.cards === 1, '16  ' + url + ' shows the before/after view above its result and keeps it through a change', JSON.stringify([r1, r2]));
        errs.push(...r.__errors); await r.close();
      }
    }

    check(errs.length === 0, 'no page errors on any page', errs.join(' | '));
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
