/*
 * Drives /ai-image/text-behind-image/ in headless Chrome and checks what
 * comes out: the layers the model finds, a still, a GIF, an MP4 (fast-start,
 * H.264), the optional corner credit, the caption, the preset links, the
 * 9:16 making-of clip, and AIImg.encodeVideoFrames with an audio track.
 * Nothing may be fetched from anywhere but the local server.
 *
 *   node build/ai-image/tests/text-behind-image.js <photo> [--root <site dir>] [--port 8720]
 *        [--out <dir>] [--expect People,Sky] [--gpu] [--no-serve] [--chrome <exe>] [--puppeteer <module path>]
 *
 * --root is the site to serve (default: the directory three levels above
 * this file); the test serves it on --port itself unless --no-serve says a
 * server is already there. Exit code 1 if any check fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const args = process.argv.slice(2);
const image = args.find((a) => !a.startsWith('--') && (args.indexOf(a) === 0 || !args[args.indexOf(a) - 1].startsWith('--') || ['--gpu', '--no-serve'].includes(args[args.indexOf(a) - 1])));
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
if (!image || !fs.existsSync(image)) { console.error('usage: node text-behind-image.js <photo> [--root dir] [--port n]'); process.exit(2); }
const ROOT = path.resolve(String(flag('root', path.join(__dirname, '..', '..', '..'))));
const PORT = Number(flag('port', 8720));
const OUT = path.resolve(String(flag('out', path.join(__dirname, 'out'))));
const GPU = flag('gpu', false) === true;
const SERVE = flag('no-serve', false) !== true;
const EXPECT = String(flag('expect', '') || '').split(',').filter(Boolean);
const CHROME = String(flag('chrome', process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'));
fs.mkdirSync(OUT, { recursive: true });

let puppeteer;
const PUP = flag('puppeteer', process.env.PUPPETEER_PATH || null);
try { puppeteer = require(PUP || 'puppeteer-core'); }
catch (e) { puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core'); }

/* ---------- a static server, the MIME types the tools need ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain', '.mp4': 'video/mp4', '.bin': 'application/octet-stream' };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const abs = path.join(ROOT, p);
      if (!abs.startsWith(path.resolve(ROOT))) { res.writeHead(403); res.end(); return; }
      fs.stat(abs, (err, st) => {
        if (err || !st.isFile()) {
          if (!err && st.isDirectory()) { res.writeHead(301, { Location: p + '/' }); res.end(); return; }
          res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found: ' + p); return;
        }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
        fs.createReadStream(abs).pipe(res);
      });
    });
    server.on('error', (e) => { console.log('  server not started (' + e.code + '); assuming one is already on port ' + PORT); resolve(null); });
    server.listen(PORT, '127.0.0.1', () => { console.log('  serving ' + ROOT + ' on http://127.0.0.1:' + PORT); resolve(server); });
  });
}

/* ---------- checks ---------- */
const fails = [];
function ok(cond, what, detail) {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail !== undefined ? '  (' + detail + ')' : ''));
  if (!cond) fails.push(what + (detail !== undefined ? ' — ' + detail : ''));
  return !!cond;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:' + PORT;
const PAGE = '/ai-image/text-behind-image/';

/* bytes of a blob: URL, pulled out of the page */
const BLOB_FN = async (src) => {
  const r = await fetch(src); const b = await r.blob();
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { type: b.type, size: b.size, b64: btoa(bin) };
};
function mp4Facts(buf) {
  const s = buf.toString('latin1');
  const idx = (box) => s.indexOf(box);
  let trak = 0; for (let i = s.indexOf('trak'); i >= 0; i = s.indexOf('trak', i + 4)) trak++;
  return { ftyp: s.slice(4, 8) === 'ftyp', moov: idx('moov'), mdat: idx('mdat'), trak, magic: s.slice(0, 12).replace(/[^\x20-\x7e]/g, '.') };
}
/* what a video element says about a blob, and the mean luminance of its bottom-right corner at the last frame */
const VIDEO_FN = async (src) => {
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = src;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('video did not load')); setTimeout(() => rej(new Error('video metadata timeout')), 15000); });
  const d = v.duration;
  await new Promise((res, rej) => { v.onseeked = res; v.currentTime = Math.max(0, d - 0.08); setTimeout(() => rej(new Error('seek timeout')), 15000); });
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  const x = c.getContext('2d'); x.drawImage(v, 0, 0);
  const bw = Math.round(c.width * 0.18), bh = Math.round(c.height * 0.07);
  const lum = (px) => { let s = 0; for (let i = 0; i < px.length; i += 4) s += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; return s / (px.length / 4); };
  const br = x.getImageData(c.width - bw, c.height - bh, bw, bh).data;
  const tl = x.getImageData(0, 0, bw, bh).data;
  return { duration: d, width: v.videoWidth, height: v.videoHeight, corner: lum(br), control: lum(tl),
    cornerPx: Array.from(br), controlPx: Array.from(tl), frame: c.toDataURL('image/png') };
};
/* mean absolute difference per channel between two pixel arrays */
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
/* a frame of a blob video at time t, as a PNG data URL */
const FRAME_AT = async (src, t) => {
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = src;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('video did not load')); setTimeout(() => rej(new Error('video metadata timeout')), 15000); });
  await new Promise((res, rej) => { v.onseeked = res; v.currentTime = Math.min(t, Math.max(0, v.duration - 0.05)); setTimeout(() => rej(new Error('seek timeout')), 15000); });
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  return c.toDataURL('image/png');
};

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const server = SERVE ? await serve() : null;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required']
      .concat(GPU ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=default'] : ['--disable-features=WebGPU']),
    protocolTimeout: 600000
  });
  const logs = [];
  const net = [];
  const saveLogs = () => { try { fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n')); } catch (e) { /* */ } };
  process.on('exit', saveLogs);
  const shots = [];
  const shot = async (page, name) => { const f = path.join(OUT, name + '.png'); await page.screenshot({ path: f }); shots.push(f); };

  function watch(page) {
    page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (/error|warn/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
    page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); });
    page.on('requestfailed', (r) => { if (!/^blob:/.test(r.url())) console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText); });
    page.on('response', (r) => { const u = r.url(); if (!/^(blob|data):/.test(u) && !/127\.0\.0\.1/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); });
    const big = (u) => /\.(onnx|wasm)$/.test(u);
    page.on('response', (r) => { if (big(r.url())) logs.push(stamp() + ' response ' + r.status() + ' sw=' + r.fromServiceWorker() + ' ' + r.url().split('/').pop()); });
  }
  const stubClipboard = (page) => page.evaluateOnNewDocument(() => {
    window.__copied = [];
    const fake = { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } };
    try { Object.defineProperty(navigator, 'clipboard', { value: fake, configurable: true }); } catch (e) { /* */ }
  });
  async function openTool(page, query) {
    await page.goto(BASE + PAGE + (query || ''), { waitUntil: 'networkidle0', timeout: 120000 });
    const mounted = await page.$('.aiimg .dropzone');
    if (!mounted) throw new Error('tool did not mount');
  }
  async function upload(page) {
    const input = await page.$('.aiimg input[type=file][accept="image/*"]');
    await input.uploadFile(image);
    console.log(stamp(), 'uploaded', path.basename(image));
    await page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && /layers? found|could not/.test(s.textContent); }, { timeout: 600000, polling: 500 });
    const status = await page.$eval('.aiimg-status', (e) => e.textContent);
    console.log(stamp(), 'status:', status);
    await page.waitForFunction(() => !document.querySelector('.aiimg-stagemsg') || document.querySelector('.aiimg-stagemsg').hidden, { timeout: 120000 });
    await wait(400);
    return status;
  }
  const set = (page, sel, value, ev) => page.$eval(sel, (e, v, k) => { e.value = v; e.dispatchEvent(new Event(k, { bubbles: true })); }, String(value), ev || 'input');
  const clickText = (page, re) => page.evaluate((src) => { const r = new RegExp(src); for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (r.test(b.textContent)) { b.click(); return true; } return false; }, re.source);
  const results = (p) => (p || page).$$eval('.aiimg-result-head', (h) => h.map((x) => x.textContent.trim()));
  const newestSrc = (page) => page.$eval('.aiimg-result img, .aiimg-result video', (e) => e.src);
  const exportDone = (page, n, statusSel) => page.waitForFunction((k, sel) => {
    const st = document.querySelector(sel);
    return document.querySelectorAll('.aiimg-result').length > k || /failed|Cancelled|could not/.test(st ? st.textContent : '');
  }, { timeout: 300000, polling: 500 }, n, statusSel);
  const saveBlob = (b, name) => { const f = path.join(OUT, name); fs.writeFileSync(f, Buffer.from(b.b64, 'base64')); return f; };

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  watch(page);
  await stubClipboard(page);
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'deny' });

  /* ---------- the page ---------- */
  await openTool(page);
  console.log(stamp(), 'page loaded; title =', await page.title());
  const h1 = await page.$eval('h1', (e) => e.textContent.trim());
  const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
  const active = await page.$eval('.side-link.is-active', (e) => e.getAttribute('href')).catch(() => null);
  console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '), '| sidebar active =', active);
  const scripts = await page.$$eval('script[src^="/engine/"]', (s) => s.map((x) => x.getAttribute('src')));
  ok(scripts.join(',') === '/engine/aiimg-core.js,/engine/aiimg-share.js,/engine/aiimg-text-behind.js', 'scripts load in order core, share, tool', scripts.join(' '));
  const api = await page.evaluate(() => ({
    core: ['loadImageFile', 'runtime', 'fetchModel', 'loadSession', 'segment', 'encodeGIF', 'encodeMP4', 'encodeVideo', 'encodeVideoFrames', 'drawText'].filter((k) => typeof AIImg[k] !== 'function'),
    share: ['credit', 'setCredit', 'creditControl', 'drawCredit', 'pageUrl', 'copyText', 'captionButton', 'presets', 'presetLink', 'makingOf'].filter((k) => !AIImg.share || typeof AIImg.share[k] !== 'function')
  }));
  ok(!api.core.length && !api.share.length, 'AIImg and AIImg.share expose their API', 'missing: ' + api.core.concat(api.share).join(',') || 'none');
  ok(await page.$('#aiimg-credit') !== null, 'credit checkbox is on the export pane');
  ok(await page.evaluate(() => !document.querySelector('#aiimg-credit').checked), 'credit is off by default');
  const chips = await page.$$eval('.aiimg-presets .chip[data-preset]', (c) => c.map((x) => x.dataset.preset));
  ok(chips.join(',') === 'neon-sunset,bold-white,outline-black,gold-headline,typewriter,wave', 'six looks as chips', chips.join(','));
  await shot(page, '1-empty');

  /* ---------- upload, layers ---------- */
  await upload(page);
  const err = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
  if (err) console.log('  io-msg:', err);
  const layers = await page.$$eval('.aiimg-layer', (rows) => rows.map((r) => ({ name: r.querySelector('.aiimg-lname').textContent, area: r.querySelector('.aiimg-area').textContent, front: r.querySelector('input').checked })));
  console.log('  layers:', layers.map((l) => (l.front ? '[x] ' : '[ ] ') + l.name + ' ' + l.area).join(' | '));
  ok(layers.length >= 2, 'at least two layers found', layers.length);
  for (const e of EXPECT) ok(layers.some((l) => l.name.toLowerCase() === e.toLowerCase()), 'expected layer present: ' + e);
  await shot(page, '2-layers');
  await page.click('#aiimg-tint'); await wait(300); await shot(page, '3-tint'); await page.click('#aiimg-tint');

  /* ---------- text ---------- */
  await page.click('.aiimg-tabs [data-pane=text]');
  await set(page, '#aiimg-text', 'BEHIND');
  await set(page, '#aiimg-size', '34');
  await set(page, '#aiimg-y', '42');
  await set(page, '#aiimg-fillmode', 'gradient', 'change');
  await set(page, '#aiimg-strokew', '2');
  await set(page, '#aiimg-shblur', '12');
  await wait(400);
  await shot(page, '4-text');
  const dataUrl = await page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png'));
  fs.writeFileSync(path.join(OUT, '4-canvas.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));

  /* a chip applies its look and writes ?preset= to the address bar; the link button copies it */
  await page.click('.aiimg-presets .chip[data-preset="gold-headline"]');
  await wait(200);
  ok(await page.evaluate(() => new URLSearchParams(location.search).get('preset')) === 'gold-headline', 'clicking a look sets ?preset=');
  ok(await page.$eval('#aiimg-fill2', (e) => e.value) === '#f7c948', 'the look changed the second colour', await page.$eval('#aiimg-fill2', (e) => e.value));
  await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-presets button')) if (/Copy link/.test(b.textContent)) b.click(); });
  await wait(150);
  const link = await page.evaluate(() => window.__copied[window.__copied.length - 1] || '');
  ok(link === BASE + PAGE + '?preset=gold-headline', 'Copy link to this look copies the preset URL', link);
  /* back to the typed style so the exports below are the known one */
  await set(page, '#aiimg-fillmode', 'gradient', 'change');
  await set(page, '#aiimg-fill', '#ffffff'); await set(page, '#aiimg-fill2', '#f7c948'); await set(page, '#aiimg-strokew', '2'); await set(page, '#aiimg-shblur', '12'); await set(page, '#aiimg-shy', '0');

  /* ---------- motion ---------- */
  await page.click('.aiimg-tabs [data-pane=motion]');
  await set(page, '#aiimg-anim', 'wave-scroll', 'change');
  await set(page, '#aiimg-dur', '3');
  await wait(800);
  await shot(page, '5-motion');

  /* ---------- exports ---------- */
  await page.click('.aiimg-tabs [data-pane=export]');
  const clipStatus = '.aiimg-pane[data-pane=export] .aiimg-status';
  const blobs = [];

  await set(page, '#aiimg-still-size', '1080', 'change');
  await clickText(page, /Download the image/);
  await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 1, { timeout: 60000 });
  console.log(stamp(), 'still:', (await results())[0]);
  const still = await page.evaluate(BLOB_FN, await newestSrc(page));
  ok(still.type === 'image/png' && still.size > 1000, 'still is a PNG', still.size + ' bytes');
  blobs.push(['still.png', still]);

  await clickText(page, /cut-out/);
  await wait(800);
  console.log(stamp(), 'cutout:', (await results())[0]);
  const cut = await page.evaluate(BLOB_FN, await newestSrc(page));
  ok(cut.type === 'image/png', 'cut-out is a PNG', cut.size + ' bytes');
  blobs.push(['cutout.png', cut]);

  await set(page, '#aiimg-clip-fmt', 'gif', 'change');
  await set(page, '#aiimg-clip-size', '480', 'change');
  await set(page, '#aiimg-clip-fps', '12', 'change');
  let n = (await results()).length, tg = Date.now();
  await clickText(page, /Export the clip/);
  await exportDone(page, n, clipStatus);
  const gifTime = (Date.now() - tg) / 1000;
  console.log(stamp(), 'gif:', (await results())[0], '|', await page.$eval(clipStatus, (e) => e.textContent), '| took', gifTime.toFixed(1) + 's');
  const gif = await page.evaluate(BLOB_FN, await newestSrc(page));
  const gifBuf = Buffer.from(gif.b64, 'base64');
  ok(gifBuf.subarray(0, 6).toString('latin1') === 'GIF89a', 'GIF magic bytes', gif.size + ' bytes, ' + gifTime.toFixed(1) + ' s');
  blobs.push(['clip.gif', gif]);

  await set(page, '#aiimg-clip-fmt', 'mp4', 'change');
  await set(page, '#aiimg-clip-size', '720', 'change');
  n = (await results()).length; let tv = Date.now();
  await clickText(page, /Export the clip/);
  await exportDone(page, n, clipStatus);
  const mp4Time = (Date.now() - tv) / 1000;
  console.log(stamp(), 'video:', (await results())[0], '|', await page.$eval(clipStatus, (e) => e.textContent), '| took', mp4Time.toFixed(1) + 's');
  const offSrc = await newestSrc(page);
  const mp4 = await page.evaluate(BLOB_FN, offSrc);
  const mp4Buf = Buffer.from(mp4.b64, 'base64');
  const facts = mp4Facts(mp4Buf);
  ok(mp4.type === 'video/mp4' && facts.ftyp, 'MP4 starts with ....ftyp', facts.magic + ', ' + mp4.size + ' bytes, ' + mp4Time.toFixed(1) + ' s');
  ok(facts.moov > 0 && facts.mdat > 0 && facts.moov < facts.mdat, 'moov comes before mdat (fast start)', 'moov@' + facts.moov + ' mdat@' + facts.mdat);
  ok(facts.trak === 1, 'one trak in a silent clip', facts.trak);
  blobs.push(['clip-credit-off.mp4', mp4]);
  const offVideo = await page.evaluate(VIDEO_FN, offSrc);
  ok(Math.abs(offVideo.duration - 3) <= 0.25, 'clip duration is 3 s', offVideo.duration.toFixed(2));

  /* the credit: tick it, export again, the bottom-right corner must be brighter */
  await page.click('#aiimg-credit');
  ok(await page.evaluate(() => localStorage.getItem('1234tools-aiimg-credit')) === '1', 'credit is remembered in localStorage');
  n = (await results()).length; tv = Date.now();
  await clickText(page, /Export the clip/);
  await exportDone(page, n, clipStatus);
  console.log(stamp(), 'video with credit:', (await results())[0], '| took', ((Date.now() - tv) / 1000).toFixed(1) + 's');
  const onSrc = await newestSrc(page);
  const onVideo = await page.evaluate(VIDEO_FN, onSrc);
  /* the credit must change the bottom-right corner of the last frame and nothing else: on a dark
     corner it brightens it, on a near-white one its shadow darkens it, so the test is the difference */
  const cornerDiff = diff(onVideo.cornerPx, offVideo.cornerPx), controlDiff = diff(onVideo.controlPx, offVideo.controlPx);
  ok(cornerDiff > 3 && controlDiff < 1.5, 'credit changes only the bottom-right corner of the last frame',
    'corner diff ' + cornerDiff.toFixed(2) + ', top-left diff ' + controlDiff.toFixed(2) + '; luminance off ' + offVideo.corner.toFixed(1) + ' → on ' + onVideo.corner.toFixed(1) + (onVideo.corner > offVideo.corner ? ' (brighter)' : ' (darker: shadow on a light corner)'));
  fs.writeFileSync(path.join(OUT, 'last-frame-credit-off.png'), Buffer.from(offVideo.frame.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'last-frame-credit-on.png'), Buffer.from(onVideo.frame.split(',')[1], 'base64'));
  blobs.push(['clip-credit-on.mp4', await page.evaluate(BLOB_FN, onSrc)]);

  /* the caption */
  await clickText(page, /Copy caption/);
  await wait(150);
  const caption = await page.evaluate(() => window.__copied[window.__copied.length - 1] || '');
  ok(/BEHIND/.test(caption) && caption.indexOf(BASE + PAGE) >= 0 && (caption.match(/#\w+/g) || []).length >= 3, 'Copy caption copies the words, hashtags and the page URL', JSON.stringify(caption).slice(0, 160));
  ok(await page.evaluate(() => [...document.querySelectorAll('.aiimg-share button')].some((b) => b.textContent === 'Copied')), 'button says Copied');

  /* the making-of */
  n = (await results()).length; const tm = Date.now();
  await clickText(page, /Making-of/);
  await exportDone(page, n, '.aiimg-share .aiimg-status');
  const moTime = (Date.now() - tm) / 1000;
  console.log(stamp(), 'making-of:', (await results())[0], '|', await page.$eval('.aiimg-share .aiimg-status', (e) => e.textContent), '| took', moTime.toFixed(1) + 's');
  const moSrc = await newestSrc(page);
  const mo = await page.evaluate(BLOB_FN, moSrc);
  const moFacts = mp4Facts(Buffer.from(mo.b64, 'base64'));
  const moVideo = await page.evaluate(VIDEO_FN, moSrc);
  ok(mo.type === 'video/mp4' && moFacts.ftyp && moFacts.moov < moFacts.mdat, 'making-of is a fast-start MP4', mo.size + ' bytes, ' + moTime.toFixed(1) + ' s');
  ok(moVideo.width === 1080 && moVideo.height === 1920, 'making-of is 1080×1920', moVideo.width + '×' + moVideo.height);
  ok(Math.abs(moVideo.duration - 6) <= 0.3, 'making-of lasts 6 s', moVideo.duration.toFixed(2));
  fs.writeFileSync(path.join(OUT, 'making-of-last-frame.png'), Buffer.from(moVideo.frame.split(',')[1], 'base64'));
  for (const t of [0.8, 2.6, 4.6]) {
    const f = await page.evaluate(FRAME_AT, moSrc, t);
    fs.writeFileSync(path.join(OUT, 'making-of-' + t.toFixed(1) + 's.png'), Buffer.from(f.split(',')[1], 'base64'));
  }
  blobs.push(['making-of.mp4', mo]);
  await page.evaluate(() => document.querySelector('.aiimg-share').scrollIntoView({ block: 'center' }));
  await shot(page, '6-export');
  const ioMsg = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
  if (ioMsg) console.log('  io-msg:', ioMsg);

  /* ---------- encodeVideoFrames: 3 s of generated frames plus a sine tone ---------- */
  const evf = await page.evaluate(async () => {
    const fps = 15, seconds = 3, total = fps * seconds, W = 640, H = 360;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    async function* frames() {
      for (let i = 0; i < total; i++) {
        x.fillStyle = '#123'; x.fillRect(0, 0, W, H);
        x.fillStyle = '#f7c948'; x.fillRect((i / total) * (W - 80), H / 2 - 40, 80, 80);
        await new Promise((r) => setTimeout(r, 5));
        yield { canvas: c, timestampUs: Math.round(i * 1e6 / fps), durationUs: Math.round(1e6 / fps) };
      }
    }
    const rate = 48000;
    const buffer = new AudioBuffer({ length: rate * seconds, sampleRate: rate, numberOfChannels: 1 });
    const d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = 0.3 * Math.sin(2 * Math.PI * 440 * i / rate);
    const t0 = performance.now();
    const r = await AIImg.encodeVideoFrames(frames(), { fps, total, audio: { buffer } });
    const buf = new Uint8Array(await r.blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    let trak = 0; for (let i = s.indexOf('trak'); i >= 0; i = s.indexOf('trak', i + 4)) trak++;
    const url = URL.createObjectURL(r.blob);
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('encodeVideoFrames result did not load')); setTimeout(() => rej(new Error('metadata timeout')), 15000); });
    /* the audio track must decode: duration and loudness of what comes back */
    let sound = { ok: false, error: '' };
    try {
      const ab = await new AudioContext().decodeAudioData(buf.buffer.slice(0));
      let sum = 0; const ch = ab.getChannelData(0);
      for (let i = 0; i < ch.length; i += 7) sum += ch[i] * ch[i];
      sound = { ok: true, duration: ab.duration, channels: ab.numberOfChannels, rate: ab.sampleRate, rms: Math.sqrt(sum / Math.ceil(ch.length / 7)) };
    } catch (e) { sound.error = String(e && e.message || e); }
    return { note: r.note, ext: r.ext, audio: r.audio, frames: r.frames, width: r.width, height: r.height, size: r.blob.size, type: r.blob.type,
      magic: s.slice(0, 12).replace(/[^\x20-\x7e]/g, '.'), ftyp: s.slice(4, 8) === 'ftyp', moov: s.indexOf('moov'), mdat: s.indexOf('mdat'), trak,
      duration: v.duration, vw: v.videoWidth, vh: v.videoHeight, ms: Math.round(performance.now() - t0), sound, b64: btoa(s) };
  });
  console.log(stamp(), 'encodeVideoFrames:', evf.note, '|', evf.frames, 'frames', evf.width + '×' + evf.height, '|', evf.size, 'bytes in', evf.ms, 'ms');
  ok(evf.type === 'video/mp4' && evf.ftyp && evf.moov < evf.mdat, 'encodeVideoFrames gives a fast-start MP4', evf.magic);
  ok(evf.audio === 'aac' || evf.audio === 'opus', 'audio track encoded', evf.audio + ' — ' + evf.note);
  ok(evf.trak === 2, 'two trak boxes (video + audio)', evf.trak);
  ok(Math.abs(evf.duration - 3) <= 0.25, 'encodeVideoFrames clip lasts 3 s', evf.duration.toFixed(2));
  ok(evf.vw === 640 && evf.vh === 360, 'encodeVideoFrames keeps the frame size', evf.vw + '×' + evf.vh);
  ok(evf.sound.ok && Math.abs(evf.sound.duration - 3) <= 0.3 && evf.sound.rms > 0.1, 'the audio track decodes to 3 s of tone',
    evf.sound.ok ? evf.sound.duration.toFixed(2) + ' s, ' + evf.sound.channels + ' ch @ ' + evf.sound.rate + ', rms ' + evf.sound.rms.toFixed(3) : evf.sound.error);
  fs.writeFileSync(path.join(OUT, 'frames-audio.mp4'), Buffer.from(evf.b64, 'base64'));

  /* ---------- a ?preset= link applies its look once the photo is in ---------- */
  await openTool(page, '?preset=neon-sunset');
  await upload(page);
  await page.click('.aiimg-tabs [data-pane=text]');
  await wait(200);
  const look = await page.evaluate(() => ({
    mode: document.querySelector('#aiimg-fillmode').value, fill: document.querySelector('#aiimg-fill').value, fill2: document.querySelector('#aiimg-fill2').value,
    glow: document.querySelector('#aiimg-glow').value, on: !!document.querySelector('.aiimg-presets .chip[data-preset="neon-sunset"].is-on'),
    url: location.search
  }));
  ok(look.mode === 'gradient' && look.fill === '#ff3cac' && look.fill2 === '#ffb347' && Number(look.glow) === 22, '?preset=neon-sunset changed the fill controls', JSON.stringify(look));
  ok(look.on, 'the neon-sunset chip is marked on');
  await shot(page, '7-preset');

  /* ---------- nothing left the machine ---------- */
  const third = [...new Set(net.map((x) => x.replace(/\?.*$/, '')))];
  ok(third.length === 0, 'zero non-127.0.0.1 responses', third.slice(0, 8).join(' | ') || 'none');
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const k of await caches.keys()) {
      const c = await caches.open(k);
      for (const u of ['/engine/models/efficientvit-seg-b1-ade20k.onnx', '/engine/vendor/ort/ort-wasm-simd-threaded.wasm']) {
        const m = await c.match(u);
        if (m) out.push(k + ' has ' + u.split('/').pop() + ' (' + (await m.blob()).size + ' bytes)');
      }
    }
    return out.length ? out.join('; ') : 'model/runtime not in the service-worker cache';
  });
  console.log('  sw cache:', cached);

  for (const [name, b] of blobs) { const f = saveBlob(b, name); console.log('  saved', path.basename(f), b.size, 'bytes'); }
  saveLogs();
  await browser.close();
  if (server) server.close();
  console.log('\n' + stamp(), fails.length ? 'FAILED ' + fails.length + ' check(s):\n  - ' + fails.join('\n  - ') : 'all checks passed');
  console.log('  screenshots:', shots.map((s) => path.basename(s)).join(', '));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
