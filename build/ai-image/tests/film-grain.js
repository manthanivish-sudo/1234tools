/*
 * Drives /ai-image/film-grain/ in headless Chrome against the local server:
 * upload a photo, check that a preset changes the pixels, that the date
 * stamp lands in its corner, that Random roll changes the picture again,
 * that the night-vision preset is green, then export a still, a GIF loop
 * (counting its frames) and an MP4. Exits non-zero on any failure.
 *
 *   node film-grain.js [--port 8726] [--root <export>] [--out <dir>] [--img <dir>] [--fallback]
 *
 * --fallback relaunches Chrome with WebGL off afterwards and checks the
 * plain-canvas version. Headless Chrome draws WebGL with SwiftShader.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8726));
const OUT = flag('out', path.join(__dirname, 'out', 'film-grain'));
const IMG = flag('img', 'E:/tmp/1234-agents/harness/img');
const FALLBACK = flag('fallback', false) === true;
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:' + PORT + '/ai-image/film-grain/';
let failures = 0;
const check = (ok, what) => { console.log('  ' + (ok ? 'PASS' : 'FAIL') + ' ' + what); if (!ok) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE_ARGS = ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/** Frames in a GIF, by walking its blocks. */
function gifFrames(buf) {
  const sig = buf.toString('latin1', 0, 6);
  if (sig !== 'GIF89a' && sig !== 'GIF87a') return -1;
  let p = 6;
  const flags = buf[p + 4]; p += 7;
  if (flags & 0x80) p += 3 * (1 << ((flags & 7) + 1));
  let frames = 0;
  const skipSub = () => { for (;;) { const n = buf[p++]; if (!n || p >= buf.length) break; p += n; } };
  while (p < buf.length) {
    const b = buf[p++];
    if (b === 0x3B) break;
    if (b === 0x21) { p++; skipSub(); }
    else if (b === 0x2C) { const f = buf[p + 8]; p += 9; if (f & 0x80) p += 3 * (1 << ((f & 7) + 1)); p++; skipSub(); frames++; }
    else return -2;
  }
  return frames;
}

async function session(launchArgs, label) {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: launchArgs, protocolTimeout: 900000 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(stamp() + ' ' + t); if (/error|warn/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
  page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); failures++; });
  page.on('requestfailed', (r) => console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText));
  const net = [];
  page.on('response', (r) => { const u = r.url(); if (!/127\.0\.0\.1/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); });
  const save = () => { try { fs.writeFileSync(path.join(OUT, 'console' + label + '.log'), logs.join('\n')); } catch (e) { /* */ } };
  return { browser, page, net, stamp, save };
}

const pause = (page) => page.evaluate(() => { const b = [...document.querySelectorAll('.aiimg-transport button')].find((x) => /Pause/.test(x.textContent)); if (b) b.click(); });
const canvasPng = (page) => page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png'));
const status = (page) => page.$eval('.aiimg-pane[data-pane=look] .aiimg-status', (e) => e.textContent.trim());
const waitReady = (page) => page.waitForFunction(() => /ready$/.test((document.querySelector('.aiimg-pane[data-pane=look] .aiimg-status') || {}).textContent || ''), { timeout: 60000, polling: 200 });
/** Mean |difference| over the preview between now and a PNG of it taken earlier. */
const diffFrom = (page, dataUrl) => page.evaluate(async (dataUrl) => {
  const c = document.querySelector('.aiimg-canvas');
  const img = new Image(); img.src = dataUrl; await img.decode();
  if (img.width !== c.width || img.height !== c.height) return { mean: 999, note: 'size changed ' + img.width + '×' + img.height + ' → ' + c.width + '×' + c.height };
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; o.getContext('2d').drawImage(img, 0, 0);
  const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, b = o.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return { mean: s / (a.length / 4 * 3) };
}, dataUrl);
/** Mean |difference| between the preview and the original photo drawn with the same crop. */
const diffFromOriginal = (page, b64) => page.evaluate(async (b64) => {
  const c = document.querySelector('.aiimg-canvas');
  const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
  const cw = c.width, ch = c.height, iw = img.width, ih = img.height;
  const sw = Math.min(iw, ih * cw / ch), sh = Math.min(ih, iw * ch / cw);
  const o = document.createElement('canvas'); o.width = cw; o.height = ch;
  o.getContext('2d').drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, cw, ch);
  const a = c.getContext('2d').getImageData(0, 0, cw, ch).data, b = o.getContext('2d').getImageData(0, 0, cw, ch).data;
  let s = 0, r = 0, g = 0, bl = 0; for (let i = 0; i < a.length; i += 4) { s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); r += a[i]; g += a[i + 1]; bl += a[i + 2]; }
  const n = a.length / 4;
  return { mean: s / (n * 3), r: r / n, g: g / n, b: bl / n, size: cw + '×' + ch };
}, b64);
/** Stamp-coloured pixels in a corner of the preview: orange by default, or the colour given. */
const stampPixels = (page, corner, green) => page.evaluate((corner, green) => {
  const c = document.querySelector('.aiimg-canvas');
  const w = c.width, h = c.height, rw = Math.round(w * 0.42), rh = Math.round(h * 0.14);
  const x0 = /r$/.test(corner) ? w - rw : 0, y0 = /^b/.test(corner) ? h - rh : 0;
  const d = c.getContext('2d').getImageData(x0, y0, rw, rh).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (green ? (g > 170 && r < 170 && b < 170 && g - r > 60) : (r > 170 && g > 60 && g < 190 && b < 110 && r - b > 100 && r - g > 30)) n++;
  }
  return n;
}, corner, green);
const pullBlob = async (page, sel) => {
  const b = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel); const r = await fetch(el.src); const b = await r.blob();
    const buf = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { type: b.type, size: b.size, b64: btoa(bin) };
  }, sel);
  return { type: b.type, size: b.size, buf: Buffer.from(b.b64, 'base64') };
};
const savePng = (dataUrl, name) => fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));

(async () => {
  const S = await session(BASE_ARGS, '');
  const { browser, page, net, stamp } = S;
  const photo = path.join(IMG, 'city-streets.jpg');
  const b64 = fs.readFileSync(photo).toString('base64');

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 });
  const title = await page.title();
  console.log(stamp(), 'page loaded; title =', title, '(' + title.length + ')');
  check(title.length <= 70 && /^Film Grain/.test(title), 'title ≤ 70 chars and keyword first');
  const h1 = await page.$eval('h1', (e) => e.textContent.trim());
  const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
  const active = await page.$eval('.side-link.is-active', (e) => e.getAttribute('href')).catch(() => null);
  console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '), '| sidebar active =', active);
  check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
  check((await page.$$('.aiimg input[type=file][accept="image/*"]')).length === 1, 'one file input');
  check(await page.$eval('.privacy-line', (e) => /no model/i.test(e.textContent) && /uploaded/.test(e.textContent)), 'privacy line says no model and nothing uploaded');
  check((await page.$$('details')).length >= 6, 'at least 6 FAQ entries');
  await page.screenshot({ path: path.join(OUT, '1-empty.png') });
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'deny' });

  /* ---------------- upload: the Disposable preset is on by default ---------------- */
  await (await page.$('.aiimg input[type=file][accept="image/*"]')).uploadFile(photo);
  await waitReady(page);
  await wait(400);
  await pause(page);
  await wait(300);
  const renderer = await page.$eval('.aiimg', (e) => e.dataset.renderer);
  console.log(stamp(), 'status:', await status(page), '| renderer =', renderer);
  check(renderer === 'webgl', 'WebGL path in use (gl present)');
  const hint = await page.$eval('.aiimg-pane[data-pane=stamp] .field-hint', (e) => e.textContent).catch(() => '');
  console.log('  date hint:', hint, '| date =', await page.$eval('#aiimg-grain-date', (e) => e.value));
  const d0 = await diffFromOriginal(page, b64);
  console.log('  Disposable vs original: mean |diff| =', d0.mean.toFixed(2), 'on', d0.size);
  check(d0.mean > 4, 'the preset changes the pixels (mean |diff| ' + d0.mean.toFixed(1) + ' > 4)');
  const orangeBR = await stampPixels(page, 'br');
  const orangeTL = await stampPixels(page, 'tl');
  check(orangeBR > 60 && orangeTL < orangeBR / 4, 'date stamp drawn in the bottom-right corner (' + orangeBR + ' orange px there, ' + orangeTL + ' top-left)');
  const pngDisposable = await canvasPng(page);
  savePng(pngDisposable, '2-canvas-disposable.png');
  await page.screenshot({ path: path.join(OUT, '2-disposable.png') });

  /* ---------------- VHS ---------------- */
  await page.click('#aiimg-grain-preset-vhs');
  await wait(300); await pause(page); await wait(300);
  const dv = await diffFrom(page, pngDisposable);
  console.log(stamp(), 'VHS:', await status(page), '| vs Disposable mean |diff| =', dv.mean.toFixed(2), dv.note || '');
  check(dv.mean > 2 || dv.note, 'VHS differs from Disposable');
  const pngVhs = await canvasPng(page);
  savePng(pngVhs, '3-canvas-vhs.png');
  await page.screenshot({ path: path.join(OUT, '3-vhs.png') });
  check(await stampPixels(page, 'br') > 60, 'VHS stamp (date and time) drawn bottom-right');

  /* ---------------- Random roll ---------------- */
  await page.click('#aiimg-grain-roll');
  await wait(300); await pause(page); await wait(300);
  const dr = await diffFrom(page, pngVhs);
  console.log(stamp(), 'roll:', await status(page), '| vs VHS mean |diff| =', dr.mean.toFixed(2));
  check(dr.mean > 0.5, 'Random roll produces a different output');
  await page.screenshot({ path: path.join(OUT, '4-roll.png') });

  /* ---------------- the stamp moves corner ---------------- */
  await page.click('.aiimg-tabs [data-pane=stamp]');
  await page.$eval('#aiimg-grain-corner', (e) => { e.value = 'tl'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await wait(300);
  const tl = await stampPixels(page, 'tl');
  check(tl > 60, 'stamp moves to the top-left corner (' + tl + ' orange px)');

  /* ---------------- Night-vision: green ---------------- */
  await page.click('.aiimg-tabs [data-pane=look]');
  await page.click('#aiimg-grain-preset-nightvision');
  await wait(300); await pause(page); await wait(300);
  const dn = await diffFromOriginal(page, b64);
  console.log(stamp(), 'night-vision: mean rgb =', dn.r.toFixed(0), dn.g.toFixed(0), dn.b.toFixed(0));
  check(dn.g > dn.r * 1.5 && dn.g > dn.b * 1.5, 'night-vision output is green');
  check(await stampPixels(page, 'br', true) > 40, 'green stamp drawn');
  savePng(await canvasPng(page), '5-canvas-nightvision.png');
  await page.screenshot({ path: path.join(OUT, '5-nightvision.png') });

  /* ---------------- exports ---------------- */
  await page.click('#aiimg-grain-preset-vhs');
  await wait(300); await pause(page);
  await page.click('.aiimg-tabs [data-pane=export]');
  const results = () => page.$$eval('.aiimg-result-head', (h) => h.map((x) => x.textContent.trim()));
  await page.$eval('#aiimg-grain-still-size', (e) => { e.value = '1080'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.$eval('#aiimg-grain-still', (b) => b.click());
  await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 1, { timeout: 60000 });
  console.log(stamp(), 'still:', (await results())[0]);
  const still = await pullBlob(page, '.aiimg-result img');
  fs.writeFileSync(path.join(OUT, 'result-still.png'), still.buf);
  check(still.buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'still is a PNG (' + still.size + ' bytes)');

  const clipDone = (n) => page.waitForFunction((k) => {
    const st = document.querySelector('.aiimg-grain-clipstatus');
    return document.querySelectorAll('.aiimg-result').length > k || /failed|Cancelled/.test(st ? st.textContent : '');
  }, { timeout: 600000, polling: 500 }, n);
  const set = (id, v, ev) => page.$eval('#' + id, (e, v, ev) => { e.value = v; e.dispatchEvent(new Event(ev || 'change', { bubbles: true })); }, v, ev);
  await set('aiimg-grain-clip-fmt', 'gif');
  await set('aiimg-grain-clip-size', '480');
  await set('aiimg-grain-clip-fps', '12');
  await set('aiimg-grain-dur', '2.5', 'input');
  let n0 = (await results()).length, tg = Date.now();
  await page.$eval('#aiimg-grain-clip', (b) => b.click());
  await clipDone(n0);
  let cs = await page.$eval('.aiimg-grain-clipstatus', (e) => e.textContent);
  console.log(stamp(), 'gif:', (await results())[0], '|', cs, '| took', ((Date.now() - tg) / 1000).toFixed(1) + 's');
  const gif = await pullBlob(page, '.aiimg-result img');
  fs.writeFileSync(path.join(OUT, 'result-loop.gif'), gif.buf);
  const frames = gifFrames(gif.buf);
  console.log('  gif:', gif.type, gif.size, 'bytes, magic', gif.buf.toString('latin1', 0, 6), '| frames counted', frames, '| status says', (/(\d+) frames/.exec(cs) || [])[1]);
  check(gif.buf.toString('latin1', 0, 6) === 'GIF89a', 'GIF89a header');
  check(frames >= 24, 'GIF has ≥ 24 frames (' + frames + ')');

  await set('aiimg-grain-clip-fmt', 'mp4');
  await set('aiimg-grain-clip-size', '720');
  n0 = (await results()).length; tg = Date.now();
  await page.$eval('#aiimg-grain-clip', (b) => b.click());
  await clipDone(n0);
  cs = await page.$eval('.aiimg-grain-clipstatus', (e) => e.textContent);
  console.log(stamp(), 'video:', (await results())[0], '|', cs, '| took', ((Date.now() - tg) / 1000).toFixed(1) + 's');
  const vid = await pullBlob(page, '.aiimg-result video');
  const ext = vid.type === 'video/mp4' ? 'mp4' : 'webm';
  fs.writeFileSync(path.join(OUT, 'result-loop.' + ext), vid.buf);
  console.log('  video:', vid.type, vid.size, 'bytes, bytes 4–8 =', vid.buf.toString('latin1', 4, 8));
  check(vid.type === 'video/mp4' && vid.buf.toString('latin1', 4, 8) === 'ftyp', 'MP4 with ftyp');
  await page.screenshot({ path: path.join(OUT, '6-export.png') });

  const shell = net.filter((n) => /google-analytics|googletagmanager/.test(n)); if (shell.length) console.log('  site-shell analytics (not the tool):', shell.length, 'request(s)');
  const third = [...new Set(net.filter((n) => !/ data:/.test(n) && !/google-analytics|googletagmanager/.test(n)).map((n) => n.replace(/\?.*$/, '')))];
  check(third.length === 0, 'zero third-party requests' + (third.length ? ': ' + third.join(', ') : ''));
  S.save();
  await browser.close();

  /* ---------------- the plain-canvas version ---------------- */
  if (FALLBACK) {
    const F = await session(BASE_ARGS.concat(['--disable-webgl', '--disable-3d-apis']), '-fallback');
    await F.page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 });
    await (await F.page.$('.aiimg input[type=file][accept="image/*"]')).uploadFile(photo);
    await waitReady(F.page);
    await wait(400); await pause(F.page); await wait(300);
    const r2 = await F.page.$eval('.aiimg', (e) => e.dataset.renderer);
    const d2 = await diffFromOriginal(F.page, b64);
    console.log(F.stamp(), 'fallback renderer =', r2, '| status:', await status(F.page), '| vs original mean |diff| =', d2.mean.toFixed(2));
    check(r2 === '2d', 'without WebGL the plain-canvas path is used');
    check(d2.mean > 4, 'the plain-canvas version still changes the pixels');
    check(await stampPixels(F.page, 'br') > 60, 'stamp drawn in the plain-canvas version');
    await F.page.screenshot({ path: path.join(OUT, '7-fallback.png') });
    F.save();
    await F.browser.close();
  }

  console.log(stamp(), failures ? 'FAILED: ' + failures + ' check(s)' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
