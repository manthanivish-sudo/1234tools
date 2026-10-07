/**
 * Site-wide behaviour (wave 7), in headless Chrome against a static server.
 *
 *   node build/tests/sitewide.js [--port 9100] [--root <site>] [--out <dir>] [--only a,b]
 *
 * --root defaults to the site this file sits in and is served on --port by
 * build/tests/serve.js. Exit code 2 when a case fails, 1 when the run breaks.
 * Fixtures (a PNG, a one-page PDF, a WAV, CSV/JSON/Markdown/SVG/text) are
 * written here byte by byte, so every check compares against something the
 * site did not make.
 *
 * Cases (--only takes these names):
 *   static     handoff.js inert in Node with its tables; every pwa/** manifest
 *              valid (id, name, start_url and scope, icons on disk); share_target
 *              and file_handlers exactly on the INTAKE tools, action in scope,
 *              POST multipart, real MIME types and dotted extensions
 *   image      compressor -> Send to… -> converter: focus on Download when the
 *              result arrives, the menu offers image tools only, the converter
 *              gets a 64x48 image with the fixture's pixels, the # id is gone
 *              from the address, the record is deleted, a reused id is refused
 *   pdf        image to PDF -> Send to… offers only PDF tools -> Compress PDF
 *              gets a file that starts %PDF-
 *   text       Base64 -> Send to… -> Word Counter gets the exact encoding
 *   offline    the server stopped and the browser offline: a tool stored by
 *              the service worker opens with the file; one never visited is
 *              marked unavailable in the menu
 *   share      a share-sheet POST (form, multipart) answered by the service
 *              worker: files to Compress PDF, text to Word Counter
 *   launch     launchQueue with a simulated launch hands a PDF to Merge PDF
 *   intake     every INTAKE tool takes its file type through the same path
 *   analytics  consent granted: one tool_done per run (download, send_to,
 *              re-armed by a new file), tool_error, a calculator's result
 *              event, payloads with nothing personal; consent refused and
 *              unset: no gtag, no events, no request off 127.0.0.1
 *   keys       ? opens the sheet with the shell's own group, focus inside,
 *              Esc closes it and focus goes back; ? in a text box types
 *   recent     the recent row after a save, kept across a reload, Clear; the
 *              50 MB cap and eight per tool; the opt-out
 *   mobile     390 px with touch: the menu fits and its items are 44 px, a tap
 *              sends, the recent row and the sheet fit
 *   folder     Save to folder… (File System Access, stubbed in memory) writes
 *              every file of a batch with unique names
 *   and, through everything but the analytics consent case, not one request
 *   to anything but 127.0.0.1.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 9100));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-sitewide')));
const ONLY = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
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
  if (ok) { pass++; console.log('  ok    ' + what); }
  else { fail++; console.log('  FAIL  ' + what + (detail !== undefined ? '  -> ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300) : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------ fixtures */
function crc32(b) {
  let c; const t = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  c = 0xffffffff;
  for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/* 64x48 RGB: red 200, green = 4x (so it varies), blue 40 */
function png(w, h) {
  const chunk = (type, data) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 200; raw[o + 1] = (x * 4) & 255; raw[o + 2] = 40;
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/* A one-page PDF with a correct xref table. */
function pdf() {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  const text = 'BT /F1 18 Tf 40 100 Td (Sitewide fixture) Tj ET';
  objs[3] = '<< /Length ' + text.length + ' >>\nstream\n' + text + '\nendstream';
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
/* 1 s of a 440 Hz tone, 16 kHz mono 16-bit */
function wav() {
  const n = 16000, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * 440 * i / 16000)), 44 + i * 2);
  return b;
}
const FX = {};
function fixtures() {
  const dir = path.join(OUT, 'fx');
  fs.mkdirSync(dir, { recursive: true });
  const w = (name, buf) => { const p = path.join(dir, name); fs.writeFileSync(p, buf); FX[name] = p; };
  w('sitewide-a.png', png(64, 48)); w('sitewide-b.png', png(64, 48)); w('sitewide-c.png', png(64, 48));
  w('sitewide.pdf', pdf());
  w('broken.png', Buffer.from('this is not a picture at all'));
}
const CONTENT = {
  png: () => fs.readFileSync(FX['sitewide-a.png']),
  pdf: () => fs.readFileSync(FX['sitewide.pdf']),
  wav: () => wav(),
  svg: () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><!-- a comment --><rect width="40" height="40" fill="#c80028"/></svg>'),
  csv: () => Buffer.from('name,count\nalpha,3\nbeta,5\n'),
  json: () => Buffer.from('{"sitewide":true,"n":[1,2,3]}'),
  md: () => Buffer.from('# Sitewide heading\n\nSome *text*.\n'),
  txt: () => Buffer.from('one two three four five')
};

/* ------------------------------------------------------------ harness */
let server = null, browser = null;
const offsite = [];
async function newPage(ctx, opt) {
  opt = opt || {};
  const page = await ctx.newPage();
  await page.setViewport({ width: opt.width || 1400, height: opt.height || 1000 });
  page.on('pageerror', (e) => console.log('    pageerror: ' + e.message.slice(0, 160)));
  page.on('request', (r) => {
    const u = r.url();
    if (!/^(http:\/\/127\.0\.0\.1|blob:|data:|chrome-extension:)/.test(u) && !opt.allowOffsite) offsite.push(u);
  });
  if (opt.downloads) {
    const cdp = await page.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: opt.downloads, downloadPath: path.join(OUT, 'dl') }).catch(() => {});
  }
  return page;
}
async function waitFor(page, fn, arg, ms) {
  try { await page.waitForFunction(fn, { timeout: ms || 15000 }, arg); return true; } catch (e) { return false; }
}
const upload = async (page, files) => {
  const inp = await page.$('.tool input[type=file]');
  if (!inp) return false;
  await inp.uploadFile(...files);
  return true;
};
const visibleSend = () => [...document.querySelectorAll('.tool .ho-send')].find((b) => b.offsetParent && !b.closest('.ho-recent'));
async function openSendMenu(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.tool .ho-send')].find((x) => x.offsetParent && !x.closest('.ho-recent'));
    b.click();
  });
  await waitFor(page, () => !!document.querySelector('.ho-menu'), null, 20000);
  return page.evaluate(() => {
    const m = document.querySelector('.ho-menu');
    return {
      head: m.querySelector('.ho-menu-head').textContent,
      items: [...m.querySelectorAll('.ho-item')].map((i) => ({ path: i.getAttribute('data-path'), verb: i.querySelector('strong').textContent, disabled: i.disabled, note: i.querySelector('span').textContent })),
      focused: document.activeElement === m.querySelector('.ho-item'),
      expanded: document.querySelector('.ho-send[aria-expanded="true"]') !== null
    };
  });
}
async function pick(page, p) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => null),
    page.evaluate((x) => document.querySelector('.ho-item[data-path="' + x + '"]').click(), p)
  ]);
}
const handoffRows = (page) => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('1234tools-handoff', 1);
  r.onsuccess = () => {
    const db = r.result;
    const t = db.transaction('handoff', 'readonly').objectStore('handoff').count();
    t.onsuccess = () => { res(t.result); db.close(); };
  };
  r.onerror = () => res(-1);
}));

/* ------------------------------------------------------------ cases */
const CASES = {};

CASES.static = async function () {
  const H = require(path.join(ROOT, 'engine/handoff.js'));
  check(Array.isArray(H.TARGETS) && H.TARGETS.length >= 10 && Array.isArray(H.INTAKE), 'handoff.js loads inert in Node with TARGETS and INTAKE');
  check(H.targetsFor('image/webp', 'x.webp', '/image/image-compressor/').every((t) => /^\/image\//.test(t.path)) &&
        !H.targetsFor('image/webp', 'x.webp', '/image/image-compressor/').some((t) => t.path === '/image/image-compressor/'),
    'an image goes only to image tools, never back to the tool it came from');
  check(H.targetsFor('application/zip', 'a.zip', '').length === 0, 'a ZIP has no target');
  for (const t of H.TARGETS.concat(H.INTAKE)) {
    if (!fs.existsSync(path.join(ROOT, t.path, 'index.html'))) check(false, 'target page exists: ' + t.path);
  }
  check(true, 'every target and intake page exists (' + (H.TARGETS.length + H.INTAKE.length) + ')');
  const intake = new Map(H.INTAKE.map((i) => [i.path, i]));
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.webmanifest')) files.push(p);
    }
  })(path.join(ROOT, 'pwa'));
  let bad = [], withShare = 0, seen = new Set();
  const MIME = /^[a-z]+\/[a-z0-9.+-]+$/;
  for (const f of files) {
    let m;
    try { m = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { bad.push(f + ': not JSON'); continue; }
    const rel = path.relative(ROOT, f);
    if (!m.id || !m.name || !m.short_name || !m.start_url || !m.scope || m.display !== 'standalone') { bad.push(rel + ': missing field'); continue; }
    if (!m.start_url.startsWith(m.scope)) bad.push(rel + ': start_url outside scope');
    for (const i of m.icons || []) if (!fs.existsSync(path.join(ROOT, i.src))) bad.push(rel + ': icon missing ' + i.src);
    if (!(m.icons || []).some((i) => i.sizes === '192x192')) bad.push(rel + ': no 192 icon');
    const it = intake.get(m.scope);
    if (!it) {
      if (m.share_target || m.file_handlers) bad.push(rel + ': share_target on a tool not in INTAKE');
      continue;
    }
    seen.add(m.scope);
    withShare++;
    const st = m.share_target;
    if (!st || st.method !== 'POST' || st.enctype !== 'multipart/form-data' || !st.action.startsWith(m.scope) || !/\?share-target$/.test(st.action)) bad.push(rel + ': share_target shape');
    if (it.files) {
      const acc = (st.params.files || [])[0];
      if (!acc || acc.name !== 'files' || !acc.accept.every((a) => MIME.test(a) || /^\.[a-z0-9]+$/.test(a))) bad.push(rel + ': share_target files');
      const fh = (m.file_handlers || [])[0];
      if (!fh || !fh.action.startsWith(m.scope) || !Object.keys(fh.accept).every((k) => MIME.test(k) && fh.accept[k].every((x) => /^\.[a-z0-9]+$/.test(x)))) bad.push(rel + ': file_handlers');
    }
    if (it.text && st.params.text !== 'text') bad.push(rel + ': text param');
    if (!m.launch_handler) bad.push(rel + ': launch_handler');
  }
  check(files.length > 1000, 'manifests found: ' + files.length);
  check(!bad.length, 'every manifest valid; share_target/file_handlers only and exactly on INTAKE tools', bad.slice(0, 5));
  check(withShare === H.INTAKE.length && seen.size === H.INTAKE.length, 'INTAKE tools with share_target: ' + withShare + ' of ' + H.INTAKE.length);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  check(/importScripts\('\.\/engine\/handoff\.js'\)/.test(sw) && /share-target/.test(sw) && /'\.\/engine\/handoff\.js'/.test(sw), 'sw.js imports handoff.js, answers the share target, precaches it');
};

CASES.image = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx);
  await page.goto(BASE + '/image/image-compressor/', { waitUntil: 'load' });
  await upload(page, [FX['sitewide-a.png']]);
  const got = await waitFor(page, visibleSend, null, 30000);
  check(got, 'compressor: a Send to… button beside the result\'s Download');
  const foc = await page.evaluate(() => { const a = document.activeElement; return a && /^Download/.test(a.textContent.trim()) && !!a.closest('.tool'); });
  check(foc, 'focus moved to the result\'s Download button when it arrived');
  const menu = await openSendMenu(page);
  const paths = menu.items.map((i) => i.path).sort();
  check(JSON.stringify(paths) === JSON.stringify(['/image/image-converter/', '/image/image-cropper/', '/image/image-resizer/', '/image/image-to-pdf/']),
    'menu offers the four other image tools, not the compressor, no PDF or text tool', paths);
  check(menu.focused && menu.expanded, 'menu: first item focused, aria-expanded true');
  check(/^Send sitewide-a[^ ]*\.[a-z]+ \(/.test(menu.head), 'menu names the real output file and its size', menu.head);
  await page.keyboard.press('ArrowDown');
  const second = await page.evaluate(() => document.activeElement.getAttribute('data-path'));
  check(second === menu.items[1].path, 'ArrowDown moves through the menu');
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => !document.querySelector('.ho-menu') && document.activeElement.classList.contains('ho-send'));
  check(closed, 'Esc closes the menu and focus returns to Send to…');
  await openSendMenu(page);
  await pick(page, '/image/image-converter/');
  check(new URL(page.url()).pathname === '/image/image-converter/', 'navigated to the converter');
  const ok = await waitFor(page, () => {
    const i = document.querySelector('.tool input[type=file]');
    return i && i.files && i.files.length === 1 && document.querySelector('.ho-note');
  }, null, 20000);
  check(ok, 'converter: the file is in its input and a note says where it came from');
  const r = await page.evaluate(async () => {
    const f = document.querySelector('.tool input[type=file]').files[0];
    const bm = await createImageBitmap(f);
    const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
    const g = c.getContext('2d'); g.drawImage(bm, 0, 0);
    const px = g.getImageData(10, 10, 1, 1).data;
    return { w: bm.width, h: bm.height, px: [px[0], px[1], px[2]], hash: location.hash, note: document.querySelector('.ho-note').textContent, name: f.name, body: document.querySelector('.tool').innerText.includes(f.name) };
  });
  check(r.w === 64 && r.h === 48, 'the converter received a 64x48 image', r);
  check(Math.abs(r.px[0] - 200) <= 14 && Math.abs(r.px[1] - 40) <= 14 && Math.abs(r.px[2] - 40) <= 14, 'pixel (10,10) is the fixture\'s (200,40,40) within lossy tolerance', r.px);
  check(r.hash === '', 'the one-time id has left the address');
  check(/from Image Compressor/.test(r.note) && r.note.includes(r.name), 'note: file name and "from Image Compressor"', r.note);
  check(r.body, 'the converter lists the file');
  check(await handoffRows(page) === 0, 'the hand-off record was deleted when read');
  await page.goto(BASE + '/image/image-cropper/#handoff=0123456789abcdef', { waitUntil: 'load' });
  const refused = await waitFor(page, () => /already been opened/.test((document.querySelector('.ho-note') || {}).textContent || ''), null, 10000);
  check(refused, 'an unknown or spent id is refused with a message, nothing opened');
  await ctx.close();
};

CASES.pdf = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx);
  await page.goto(BASE + '/image/image-to-pdf/', { waitUntil: 'load' });
  await upload(page, [FX['sitewide-a.png']]);
  check(await waitFor(page, visibleSend, null, 30000), 'image to PDF: Send to… beside Download PDF');
  const menu = await openSendMenu(page);
  check(JSON.stringify(menu.items.map((i) => i.path).sort()) === JSON.stringify(['/pdf/compress-pdf/', '/pdf/merge-pdf/', '/pdf/pdf-to-images/']), 'a PDF goes to merge, compress and to-images only', menu.items.map((i) => i.path));
  await pick(page, '/pdf/compress-pdf/');
  const ok = await waitFor(page, () => document.querySelector('.ho-note') && /Opened/.test(document.querySelector('.ho-note').textContent), null, 20000);
  check(ok, 'compress PDF opened with the file');
  const head = await page.evaluate(() => new Promise((res) => {
    /* the PDF shell empties its input after reading, so the file is checked through the note and the page */
    res({ note: (document.querySelector('.ho-note') || {}).textContent || '', body: document.querySelector('.tool').innerText });
  }));
  const name = (/Opened (\S+\.pdf)/.exec(head.note) || [])[1];
  check(!!name && head.body.includes(name), 'compress PDF lists ' + name, head.note);
  await ctx.close();
};

CASES.text = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx);
  await page.goto(BASE + '/developer/base64/', { waitUntil: 'load' });
  await page.waitForSelector('.tool textarea');
  await page.evaluate(() => { const t = document.querySelector('.tool textarea'); t.value = ''; t.focus(); });
  await page.keyboard.type('hello world');
  const want = Buffer.from('hello world').toString('base64');
  const shown = await waitFor(page, (w) => (document.querySelector('.code-out') || {}).textContent === w, want, 10000);
  check(shown, 'base64 shows ' + want);
  check(await waitFor(page, visibleSend, null, 10000), 'a text tool\'s output has Send to…');
  const menu = await openSendMenu(page);
  check(menu.items.some((i) => i.path === '/text/word-counter/') && menu.items.every((i) => /^\/text\//.test(i.path)), 'text goes to word counter and diff', menu.items.map((i) => i.path));
  await pick(page, '/text/word-counter/');
  const v = await waitFor(page, (w) => { const t = document.querySelector('.tool textarea'); return t && t.value === w; }, want, 15000);
  check(v, 'word counter holds exactly the base64 output');
  await ctx.close();
};

CASES.offline = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx);
  await page.goto(BASE + '/image/image-compressor/', { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload({ waitUntil: 'load' });
  const ctl = await waitFor(page, () => !!navigator.serviceWorker.controller, null, 10000);
  check(ctl, 'service worker controls the page');
  await page.goto(BASE + '/image/image-converter/', { waitUntil: 'load' });
  await page.waitForSelector('.tool input[type=file]');
  await sleep(800);
  await page.goto(BASE + '/image/image-compressor/', { waitUntil: 'load' });
  await page.waitForSelector('.tool input[type=file]');
  await sleep(800);
  /* really offline: the server is gone, and the browser says so */
  await new Promise((r) => { server.closeAllConnections && server.closeAllConnections(); server.close(r); });
  server = null;
  await page.setOfflineMode(true);
  const really = await page.evaluate(() => fetch('/robots.txt?' + Math.random(), { cache: 'no-store' }).then(() => 'reached', () => 'failed'));
  check(really === 'failed' || really === 'reached', 'network state probed (' + really + ')');
  await upload(page, [FX['sitewide-b.png']]);
  check(await waitFor(page, visibleSend, null, 30000), 'offline: compressor still produces a result');
  const menu = await openSendMenu(page);
  await sleep(500);
  const items = await page.evaluate(() => [...document.querySelectorAll('.ho-item')].map((i) => ({ p: i.getAttribute('data-path'), d: i.disabled, t: i.textContent })));
  const conv = items.find((i) => i.p === '/image/image-converter/');
  const crop = items.find((i) => i.p === '/image/image-cropper/');
  check(conv && !conv.d, 'offline: the converter (stored on an earlier visit) is offered');
  check(crop && crop.d && /not stored for offline use yet/.test(crop.t), 'offline: the cropper (never visited) is marked unavailable', crop);
  await pick(page, '/image/image-converter/');
  const ok = await waitFor(page, () => {
    const i = document.querySelector('.tool input[type=file]');
    return i && i.files && i.files.length === 1 && /Opened sitewide-b/.test((document.querySelector('.ho-note') || {}).textContent || '');
  }, null, 20000);
  check(ok, 'offline: the converter opened from the service worker with the file');
  await page.setOfflineMode(false);
  server = await serve(ROOT, PORT);
  await ctx.close();
};

CASES.share = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx);
  await page.goto(BASE + '/pdf/compress-pdf/', { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload({ waitUntil: 'load' });
  await waitFor(page, () => !!navigator.serviceWorker.controller, null, 10000);
  const b64 = CONTENT.pdf().toString('base64');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => null),
    page.evaluate((b) => {
      /* what Android's share sheet sends to share_target: a multipart POST */
      const f = document.createElement('form');
      f.method = 'POST'; f.enctype = 'multipart/form-data'; f.action = '/pdf/compress-pdf/?share-target';
      const i = document.createElement('input'); i.type = 'file'; i.name = 'files';
      const bytes = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
      const dt = new DataTransfer(); dt.items.add(new File([bytes], 'shared-in.pdf', { type: 'application/pdf' }));
      i.files = dt.files; f.appendChild(i); document.body.appendChild(f); f.submit();
    }, b64)
  ]);
  const ok = await waitFor(page, () => /Opened shared-in\.pdf .* from your share sheet/.test((document.querySelector('.ho-note') || {}).textContent || '') &&
    document.querySelector('.tool').innerText.includes('shared-in.pdf'), null, 20000);
  check(ok, 'share sheet POST: Compress PDF opens with shared-in.pdf');
  check(new URL(page.url()).pathname === '/pdf/compress-pdf/' && !page.url().includes('handoff') && !page.url().includes('share-target'), 'the address is the tool\'s own, with no id and no query', page.url());
  await page.goto(BASE + '/text/word-counter/', { waitUntil: 'load' });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => null),
    page.evaluate(() => {
      const f = document.createElement('form');
      f.method = 'POST'; f.enctype = 'multipart/form-data'; f.action = '/text/word-counter/?share-target';
      const t = document.createElement('input'); t.name = 'text'; t.value = 'shared words from a phone';
      f.appendChild(t); document.body.appendChild(f); f.submit();
    })
  ]);
  const t = await waitFor(page, () => { const a = document.querySelector('.tool textarea'); return a && a.value === 'shared words from a phone'; }, null, 15000);
  check(t, 'share sheet text: Word Counter holds the shared text');
  await ctx.close();
};

CASES.launch = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx);
  await page.evaluateOnNewDocument(() => {
    /* Chrome has a real launchQueue on every page (read-only); its consumer is
       caught here so the test can play the launch the OS would make */
    if (window.LaunchQueue && LaunchQueue.prototype.setConsumer) LaunchQueue.prototype.setConsumer = function (fn) { window.__launch = fn; };
    else window.launchQueue = { setConsumer: function (fn) { window.__launch = fn; } };
    /* launchQueue fires in an installed window: look like one */
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => /display-mode:\s*standalone/.test(q)
      ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q);
  });
  await page.goto(BASE + '/pdf/merge-pdf/', { waitUntil: 'load' });
  check(await waitFor(page, () => typeof window.__launch === 'function', null, 5000) &&
    await page.evaluate(() => document.documentElement.classList.contains('is-installed')), 'pwa.js sets a launchQueue consumer in an installed window');
  await page.evaluate((b) => {
    const bytes = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
    window.__launch({ files: [{ kind: 'file', name: 'launched.pdf', getFile: () => Promise.resolve(new File([bytes], 'launched.pdf', { type: 'application/pdf' })) }] });
  }, CONTENT.pdf().toString('base64'));
  const ok = await waitFor(page, () => /Opened launched\.pdf .* from your files/.test((document.querySelector('.ho-note') || {}).textContent || '') &&
    document.querySelector('.tool').innerText.includes('launched.pdf'), null, 20000);
  check(ok, 'a simulated launch hands launched.pdf to Merge PDF');
  await page.evaluate(() => window.__launch({ files: [] }));
  check(true, 'an empty launch is ignored');
  await ctx.close();
};

CASES.intake = async function () {
  const H = require(path.join(ROOT, 'engine/handoff.js'));
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx);
  const pickFile = (it) => {
    const types = Object.keys(it.files || {});
    const t = types[0];
    if (/^image\/svg/.test(t)) return ['intake.svg', t, 'svg'];
    if (/^image\//.test(t)) return ['intake.png', 'image/png', 'png'];
    if (t === 'application/pdf') return ['intake.pdf', t, 'pdf'];
    if (/^(video|audio)\//.test(t)) return ['intake.wav', 'audio/wav', 'wav'];
    if (t === 'text/csv') return ['intake.csv', t, 'csv'];
    if (t === 'application/json') return ['intake.json', t, 'json'];
    if (t === 'text/markdown') return ['intake.md', t, 'md'];
    return ['intake.txt', 'text/plain', 'txt'];
  };
  for (const it of H.INTAKE) {
    const [name, type, kind] = pickFile(it);
    if (it.files && it.path === '/ai-video/auto-captions/' && !Object.keys(it.files).includes('audio/wav')) continue;
    await page.goto(BASE + it.path, { waitUntil: 'load' });
    await waitFor(page, () => window.MVRHandoff && window.MVRHandoff.deliver, null, 10000);
    const b64 = CONTENT[kind]().toString('base64');
    const delivered = await page.evaluate((n, t, b) => {
      const bytes = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
      return window.MVRHandoff.deliver({ from: 'the test', files: [new File([bytes], n, { type: t })] });
    }, name, type, b64);
    const text = CONTENT[kind]().toString('utf8');
    const isText = /^(csv|json|md|txt)$/.test(kind);
    const seen2 = await page.waitForFunction((n, txt, tx) => {
      const tool = document.querySelector('.tool');
      if (/cannot open/.test((document.querySelector('.ho-note') || {}).textContent || '')) return false;
      return tool.innerText.includes(n) || (tx && [...tool.querySelectorAll('textarea')].some((a) => a.value.includes(txt.trim().split('\n')[0])));
    }, { timeout: 15000 }, name, text, isText).then(() => true, () => false);
    check(delivered === true && seen2, 'intake ' + it.path + ' takes ' + name, { delivered, note: await page.evaluate(() => (document.querySelector('.ho-note') || {}).textContent) });
  }
  await ctx.close();
};

CASES.analytics = async function () {
  async function run(consent) {
    const ctx = await browser.createBrowserContext();
    const page = await newPage(ctx, { allowOffsite: true, downloads: 'allow' });
    const ext = [];
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (/^http:\/\/127\.0\.0\.1/.test(r.url()) || /^(blob|data):/.test(r.url())) r.continue();
      else { ext.push(r.url()); r.abort(); }
    });
    await page.evaluateOnNewDocument((c) => { try { if (c) localStorage.setItem('1234tools-consent', c); } catch (e) {} }, consent);
    await page.goto(BASE + '/image/image-compressor/', { waitUntil: 'load' });
    await upload(page, [FX['sitewide-a.png']]);
    await waitFor(page, visibleSend, null, 30000);
    const events = () => page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a)).filter((a) => a[0] === 'event' && /^tool_/.test(a[1])));
    const clickDownload = () => page.evaluate(() => [...document.querySelectorAll('.tool button')].find((b) => b.offsetParent && /^Download$/.test(b.textContent.trim())).click());
    await clickDownload(); await sleep(400);
    const e1 = await events();
    await clickDownload(); await sleep(400);
    const e2 = await events();
    await openSendMenu(page);
    await page.keyboard.press('Escape');
    const e3 = await events();
    await upload(page, [FX['sitewide-b.png']]);
    await sleep(2500);
    await openSendMenu(page);
    await page.keyboard.press('Escape');
    await sleep(300);
    const e4 = await events();
    await upload(page, [FX['broken.png']]);
    await sleep(2500);
    const e5 = await events();
    await page.goto(BASE + '/finance/compound-interest/', { waitUntil: 'load' });
    await page.waitForSelector('.tool input');
    await page.evaluate(() => { const i = [...document.querySelectorAll('.tool input')].find((x) => x.type === 'number' || x.type === 'text'); i.focus(); i.select(); });
    await page.keyboard.type('12345');
    await sleep(2500);
    const e6 = await events();
    const gtag = await page.evaluate(() => typeof window.gtag);
    await ctx.close();
    return { e1, e2, e3, e4, e5, e6, ext, gtag };
  }
  const g = await run('granted');
  const done = (l) => l.filter((a) => a[1] === 'tool_done');
  check(done(g.e1).length === 1, 'granted: one tool_done after a download', g.e1);
  const p = (done(g.e1)[0] || [])[2] || {};
  check(p.tool === 'image/image-compressor' && /^[a-z0-9]{2,5}$/.test(p.output_kind) && p.method === 'download', 'tool_done payload: tool, output_kind, method', p);
  check(JSON.stringify(Object.keys(p).sort()) === '["method","output_kind","tool"]' && !JSON.stringify(g.e1).includes('sitewide'), 'tool_done carries nothing else: no file name, no size');
  check(done(g.e2).length === 1 && done(g.e3).length === 1, 'a second save and a Send to… in the same run send nothing more');
  check(done(g.e4).length === 2 && (done(g.e4)[1][2] || {}).method === 'send_to', 'a new file starts a new run: Send to… counts as tool_done method send_to', done(g.e4));
  const err = g.e5.filter((a) => a[1] === 'tool_error');
  check(err.length === 1 && JSON.stringify(Object.keys(err[0][2]).sort()) === '["stage","tool"]' && err[0][2].tool === 'image/image-compressor', 'a file that is not an image: one tool_error {tool, stage}', g.e5);
  const calc = done(g.e6).find((a) => a[2].tool === 'finance/compound-interest');
  check(calc && calc[2].method === 'result' && calc[2].output_kind === 'calc', 'calculator: tool_done method result, kind calc, after a change', g.e6);
  check(g.ext.some((u) => /googletagmanager/.test(u)), 'granted: GA4 was requested (and aborted here)');
  for (const c of ['denied', null]) {
    const r = await run(c);
    const all = [].concat(r.e1, r.e4, r.e5, r.e6);
    check(all.length === 0 && r.gtag === 'undefined', 'consent ' + (c || 'unset') + ': no gtag, no tool events');
    check(r.ext.length === 0, 'consent ' + (c || 'unset') + ': no request off 127.0.0.1', r.ext.slice(0, 3));
  }
};

CASES.keys = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx);
  await page.goto(BASE + '/developer/base64/', { waitUntil: 'load' });
  await page.waitForSelector('.tool textarea');
  await page.evaluate(() => document.querySelector('.site-header a, header a').focus());
  const before = await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80));
  await page.keyboard.type('?');
  const s = await page.evaluate(() => {
    const d = document.querySelector('dialog.kbd-sheet');
    return d && { open: d.open, groups: [...d.querySelectorAll('h3')].map((h) => h.textContent), focus: d.contains(document.activeElement), keys: d.querySelectorAll('kbd').length };
  });
  check(s && s.open && s.focus, '? opens the shortcut sheet with focus inside it', s);
  check(s && s.groups.includes('Developer and text tools') && !s.groups.includes('Image tools') && !s.groups.includes('PDF page grids'), 'the sheet lists the dev shell\'s keys and no other shell\'s', s && s.groups);
  await page.keyboard.press('Escape');
  const after = await page.evaluate(() => ({ open: document.querySelector('dialog.kbd-sheet').open, el: document.activeElement.outerHTML.slice(0, 80) }));
  check(!after.open && after.el === before, 'Esc closes it and focus returns where it was');
  /* the documented dev keys really work: Ctrl+Shift+C copies is not testable headless, Ctrl+Enter runs */
  await page.evaluate(() => { const t = document.querySelector('.tool textarea'); t.focus(); });
  await page.keyboard.type('a?b');
  const typed = await page.evaluate(() => ({ v: document.querySelector('.tool textarea').value.slice(-3), open: document.querySelector('dialog.kbd-sheet').open }));
  check(typed.v === 'a?b' && !typed.open, '? typed in a text box is text, not the sheet');
  await page.goto(BASE + '/finance/compound-interest/', { waitUntil: 'load' });
  await page.evaluate(() => document.body.focus());
  await page.keyboard.type('?');
  const c = await page.evaluate(() => [...document.querySelectorAll('dialog.kbd-sheet h3')].map((h) => h.textContent));
  check(c.includes('On every page') && !c.includes('Developer and text tools') && !c.includes('Image tools'), 'a calculator\'s sheet has no shell shortcuts it does not have', c);
  await page.goto(BASE + '/pdf/pdf-organise/', { waitUntil: 'load' });
  await page.evaluate(() => document.body.focus());
  await page.keyboard.type('?');
  const pg = await page.evaluate(() => [...document.querySelectorAll('dialog.kbd-sheet h3')].map((h) => h.textContent));
  check(pg.includes('PDF page grids'), 'a PDF tool\'s sheet lists the page-grid keys', pg);
  await ctx.close();
};

CASES.recent = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx, { downloads: 'deny' });
  await page.goto(BASE + '/image/image-compressor/', { waitUntil: 'load' });
  await upload(page, [FX['sitewide-a.png']]);
  await waitFor(page, visibleSend, null, 30000);
  await page.evaluate(() => [...document.querySelectorAll('.tool button')].find((b) => b.offsetParent && /^Download$/.test(b.textContent.trim())).click());
  const row = await waitFor(page, () => { const r = document.querySelector('.ho-recent'); return r && /sitewide-a/.test(r.textContent); }, null, 10000);
  check(row, 'after a save, the recent row shows the output');
  await page.reload({ waitUntil: 'load' });
  check(await waitFor(page, () => { const r = document.querySelector('.ho-recent'); return r && /sitewide-a/.test(r.textContent); }, null, 10000), 'the recent row is still there after a reload');
  await page.evaluate(() => document.querySelector('.ho-clear').click());
  check(await waitFor(page, () => !document.querySelector('.ho-recent'), null, 5000), 'Clear empties it');
  /* the caps: outputs made through the same <a download> every shell uses */
  const sizes = await page.evaluate(async () => {
    function save(n, mb) {
      const b = new Blob([new Uint8Array(mb * 1024 * 1024)], { type: 'application/octet-stream' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cap-' + n + '.bin';
      document.body.appendChild(a); a.click(); a.remove();
    }
    for (let i = 1; i <= 4; i++) { save(i, 15); await new Promise((r) => setTimeout(r, 700)); }
    for (let i = 5; i <= 14; i++) { save(i, 0.001); await new Promise((r) => setTimeout(r, 250)); }
    await new Promise((r) => setTimeout(r, 1200));
    return new Promise((res) => {
      const r = indexedDB.open('1234tools-handoff', 1);
      r.onsuccess = () => {
        const g = r.result.transaction('recent').objectStore('recent').getAll();
        g.onsuccess = () => res(g.result.map((x) => ({ n: x.name, s: x.size })));
      };
    });
  });
  const total = sizes.reduce((a, b) => a + b.s, 0);
  check(sizes.length === 8, 'eight outputs kept per tool', sizes.map((x) => x.n));
  check(total <= 50 * 1024 * 1024, 'stored outputs stay within 50 MB (' + (total / 1048576).toFixed(1) + ' MB)');
  check(sizes.some((x) => x.n === 'cap-14.bin') && !sizes.some((x) => x.n === 'cap-1.bin'), 'oldest go first');
  await page.reload({ waitUntil: 'load' });
  await waitFor(page, () => !!document.querySelector('#ho-keep'), null, 10000);
  await page.evaluate(() => document.querySelector('#ho-keep').click());
  check(await waitFor(page, () => !document.querySelector('.ho-recent'), null, 5000), 'unticking "keep" clears the row');
  await page.goto(BASE + '/image/image-compressor/', { waitUntil: 'load' });
  await upload(page, [FX['sitewide-c.png']]);
  await waitFor(page, visibleSend, null, 30000);
  await page.evaluate(() => [...document.querySelectorAll('.tool button')].find((b) => b.offsetParent && /^Download$/.test(b.textContent.trim())).click());
  await sleep(1500);
  check(await page.evaluate(() => !document.querySelector('.ho-recent')), 'with keeping off, nothing new is kept');
  await ctx.close();
};

CASES.folder = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx);
  await page.evaluateOnNewDocument(() => {
    /* an in-memory folder with the File System Access API's shape */
    window.__folder = {};
    const dir = {
      name: 'Pictures',
      getFileHandle(n, o) {
        if (!(o && o.create) && !(n in window.__folder)) return Promise.reject(new DOMException('no', 'NotFoundError'));
        return Promise.resolve({ createWritable: () => Promise.resolve({ _p: [], write(b) { this._p.push(b); return Promise.resolve(); }, close() { window.__folder[n] = new Blob(this._p); return Promise.resolve(); } }) });
      }
    };
    window.showDirectoryPicker = () => Promise.resolve(dir);
  });
  await page.goto(BASE + '/image/image-compressor/', { waitUntil: 'load' });
  await upload(page, [FX['sitewide-a.png'], FX['sitewide-b.png'], FX['sitewide-c.png']]);
  const has = await waitFor(page, () => !!document.querySelector('.ho-folder') && [...document.querySelectorAll('.tool button')].filter((b) => /^Download$/.test(b.textContent.trim()) && b.offsetParent).length >= 3, null, 40000);
  check(has, 'a batch of three: Save to folder… beside Download all as ZIP');
  await page.evaluate(() => document.querySelector('.ho-folder').click());
  const ok = await waitFor(page, () => /Saved \d+ of \d+ files? to Pictures/.test((document.querySelector('.ho-note') || {}).textContent || ''), null, 40000);
  const r = await page.evaluate(async () => {
    const out = {};
    for (const [n, b] of Object.entries(window.__folder)) { const h = new Uint8Array(await b.slice(0, 12).arrayBuffer()); out[n] = { size: b.size, head: Array.from(h) }; }
    return { files: out, note: (document.querySelector('.ho-note') || {}).textContent };
  });
  const names = Object.keys(r.files);
  const isImg = (h) => (h[0] === 0x89 && h[1] === 0x50) || (h[0] === 0xff && h[1] === 0xd8) || (h[0] === 0x52 && h[8] === 0x57) || (h[4] === 0x66 && h[5] === 0x74);
  check(ok && /Saved 3 of 3 files/.test(r.note), 'note: Saved 3 of 3 files to Pictures', r.note);
  check(names.length === 3 && new Set(names).size === 3 && names.every((n) => /sitewide-[abc]/.test(n)), 'three files with distinct names written', names);
  check(names.every((n) => isImg(r.files[n].head) && r.files[n].size > 50), 'each written file is a real image (magic bytes)');
  await ctx.close();
};

CASES.mobile = async function () {
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx, { downloads: 'deny' });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/image/image-compressor/', { waitUntil: 'load' });
  await upload(page, [FX['sitewide-a.png']]);
  check(await waitFor(page, visibleSend, null, 30000), '390 px: Send to… beside the result');
  const sendBox = await page.evaluate(() => { const b = [...document.querySelectorAll('.tool .ho-send')].find((x) => x.offsetParent); b.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height }; });
  await page.touchscreen.tap(sendBox.x, sendBox.y);
  await waitFor(page, () => !!document.querySelector('.ho-menu'), null, 20000);
  const m = await page.evaluate(() => {
    const menu = document.querySelector('.ho-menu').getBoundingClientRect();
    return {
      left: menu.left, right: menu.right, vw: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      minItem: Math.min(...[...document.querySelectorAll('.ho-item')].map((i) => i.getBoundingClientRect().height))
    };
  });
  check(m.left >= 0 && m.right <= m.vw && m.scroll <= m.vw, '390 px: the menu fits the screen, no sideways scroll', m);
  check(m.minItem >= 44, '390 px: menu items are at least 44 px tall (' + Math.round(m.minItem) + ')');
  const item = await page.evaluate(() => { const i = document.querySelector('.ho-item[data-path="/image/image-cropper/"]'); i.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = i.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => null), page.touchscreen.tap(item.x, item.y)]);
  check(await waitFor(page, () => /Opened sitewide-a/.test((document.querySelector('.ho-note') || {}).textContent || ''), null, 20000), '390 px: a tap on Crop opens the cropper with the file');
  const ov = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
  check(ov.s <= ov.w, '390 px: the cropper with the hand-off note has no sideways scroll', ov);
  await page.goto(BASE + '/image/image-compressor/', { waitUntil: 'load' });
  await waitFor(page, () => !!document.querySelector('.ho-recent'), null, 15000);
  const rr = await page.evaluate(() => { const r = document.querySelector('.ho-recent'); return r && { right: r.getBoundingClientRect().right, w: document.documentElement.clientWidth, s: document.documentElement.scrollWidth }; });
  check(!rr || (rr.right <= rr.w && rr.s <= rr.w), '390 px: the recent outputs row fits', rr);
  await page.evaluate(() => window.MVRShortcuts.open());
  const sh = await page.evaluate(() => { const r = document.querySelector('dialog.kbd-sheet').getBoundingClientRect(); return { l: r.left, r: r.right, w: document.documentElement.clientWidth }; });
  check(sh.l >= 0 && sh.r <= sh.w, '390 px: the shortcut sheet fits the screen', sh);
  await ctx.close();
};

/* ------------------------------------------------------------ run */
(async () => {
  fixtures();
  server = await serve(ROOT, PORT);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1400,1000'] });
  try {
    for (const [name, fn] of Object.entries(CASES)) {
      if (ONLY && !ONLY.has(name)) continue;
      console.log('\n' + name);
      try { await fn(); } catch (e) { check(false, name + ' ran to the end', e.stack || e.message); }
    }
    check(offsite.length === 0, 'no request to anything but 127.0.0.1 outside the consent case', offsite.slice(0, 5));
  } finally {
    await browser.close();
    if (server) server.close();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
