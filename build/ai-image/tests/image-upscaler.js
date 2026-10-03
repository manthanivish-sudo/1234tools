/*
 * Drives /ai-image/image-upscaler/ in headless Chrome against the local
 * server: upload car.jpg and 4× it (size, sharpness, PNG export), unblur
 * it, run with denoise, cancel a run, then take a 1,000 px photo to the
 * 4,000 px cap with the JS heap watched. Exits non-zero on any failure.
 *
 *   node image-upscaler.js [--port 8726] [--root <export>] [--out <dir>] [--img <dir>] [--quick]
 *
 * --root is accepted for symmetry with the server and not needed here;
 * --quick skips the 1,000 px run. Needs E:/tmp/1234-agents/harness/serve.js
 * (or any static server) on the port first.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8726));
const OUT = flag('out', path.join(__dirname, 'out', 'image-upscaler'));
const IMG = flag('img', 'E:/tmp/1234-agents/harness/img');
const QUICK = flag('quick', false) === true;
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:' + PORT + '/ai-image/image-upscaler/';
let failures = 0;
const check = (ok, what) => { console.log('  ' + (ok ? 'PASS' : 'FAIL') + ' ' + what); if (!ok) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pngDims = (buf) => (buf.length > 24 && buf.toString('latin1', 1, 4) === 'PNG' ? buf.readUInt32BE(16) + '×' + buf.readUInt32BE(20) : '?');

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU', '--enable-precise-memory-info'],
    protocolTimeout: 1800000
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  const logs = [];
  const upLines = [];
  page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(stamp() + ' ' + t); if (/\[upscaler\]/.test(t)) { upLines.push(m.text()); console.log('  ', m.text()); } else if (/error|warn/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
  page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); failures++; });
  page.on('requestfailed', (r) => console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText));
  const net = [];
  const models = [];
  page.on('response', (r) => { const u = r.url(); if (!/127\.0\.0\.1/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); if (/\.(onnx|wasm)$/.test(u)) { models.push(u.split('/').pop() + ' ' + r.status()); logs.push(stamp() + ' response ' + r.status() + ' ' + u.split('/').pop()); } });
  const save = () => { try { fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n')); } catch (e) { /* */ } };
  process.on('exit', save);

  /* the JS heap, sampled while a run is going */
  let peak = 0, sampling = false;
  const sampler = setInterval(async () => {
    if (!sampling) return;
    try { const h = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0)); if (h > peak) peak = h; } catch (e) { /* page busy */ }
  }, 300);
  const MB = (n) => (n / 1048576).toFixed(0) + ' MB';

  const status = () => page.$eval('.aiimg-pane[data-pane=upscale] .aiimg-status', (e) => e.textContent.trim());
  const waitDone = (timeout) => page.waitForFunction(() => { const s = document.querySelector('.aiimg-pane[data-pane=upscale] .aiimg-status'); return s && /ready$|failed|Cancelled/.test(s.textContent.trim()); }, { timeout: timeout || 900000, polling: 500 });
  const outDims = () => page.$eval('.aiimg-up-after', (c) => ({ w: c.width, h: c.height }));
  const setMode = (v) => page.$eval('#aiimg-up-mode', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  const setDenoise = (v) => page.$eval('#aiimg-up-denoise', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, String(v));
  /** Laplacian variance of the original and of the result reduced to the original's size, in the page. */
  const sharpness = () => page.evaluate(() => {
    const out = document.querySelector('.aiimg-up-after'), src = document.querySelector('.aiimg-up-src');
    const lapvar = (c) => {
      const w = c.width, h = c.height;
      const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      const g = new Float32Array(w * h);
      for (let i = 0, j = 0; i < w * h; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
      let s = 0, s2 = 0, n = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; const v = -4 * g[i] + g[i - 1] + g[i + 1] + g[i - w] + g[i + w]; s += v; s2 += v * v; n++; }
      const m = s / n; return s2 / n - m * m;
    };
    const down = document.createElement('canvas'); down.width = src.width; down.height = src.height;
    const x = down.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(out, 0, 0, down.width, down.height);
    return { orig: Math.round(lapvar(src)), down: Math.round(lapvar(down)) };
  });
  /** Mean |difference| between neighbouring columns/rows, at the tile joins and in general, to show whether a seam is there. */
  const seams = () => page.evaluate(() => {
    const out = document.querySelector('.aiimg-up-after');
    const w = out.width, h = out.height;
    const d = out.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const col = new Float64Array(w - 1);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w - 1; x++) { const o = (y * w + x) * 4; col[x] += Math.abs(d[o] - d[o + 4]) + Math.abs(d[o + 1] - d[o + 5]) + Math.abs(d[o + 2] - d[o + 6]); }
    const rows = Math.ceil(h / 2);
    for (let x = 0; x < w - 1; x++) col[x] /= rows * 3;
    const sorted = Array.from(col).sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1], max = sorted[sorted.length - 1];
    const maxAt = Array.from(col).indexOf(max);
    return { median: +median.toFixed(2), max: +max.toFixed(2), maxAt, p99: +sorted[Math.floor(sorted.length * 0.99)].toFixed(2) };
  });
  const pullBlob = async (sel) => {
    const b = await page.evaluate(async (sel) => {
      const el = document.querySelector(sel); const r = await fetch(el.src); const b = await r.blob();
      const buf = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { type: b.type, size: b.size, b64: btoa(bin) };
    }, sel);
    return { type: b.type, size: b.size, buf: Buffer.from(b.b64, 'base64') };
  };

  /* ---------------- the page ---------------- */
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 });
  const title = await page.title();
  console.log(stamp(), 'page loaded; title =', title, '(' + title.length + ')');
  check(title.length <= 70 && /^AI Image Upscaler/.test(title), 'title ≤ 70 chars and keyword first');
  const h1 = await page.$eval('h1', (e) => e.textContent.trim());
  const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
  const active = await page.$eval('.side-link.is-active', (e) => e.getAttribute('href')).catch(() => null);
  console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '), '| sidebar active =', active);
  check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
  check((await page.$$('.aiimg input[type=file][accept="image/*"]')).length === 1, 'one file input');
  check(await page.$eval('.privacy-line', (e) => /Real-ESRGAN general-x4v3/.test(e.textContent) && /4\.7 MB/.test(e.textContent) && /BSD-3-Clause/.test(e.textContent)), 'privacy line names the model, size and licence');
  check((await page.$$('details')).length >= 6, 'at least 6 FAQ entries');
  await page.screenshot({ path: path.join(OUT, '1-empty.png') });

  /* ---------------- car.jpg, 4× ---------------- */
  const input = await page.$('.aiimg input[type=file][accept="image/*"]');
  await input.uploadFile(path.join(IMG, 'car.jpg'));
  await page.waitForFunction(() => /Photo loaded/.test((document.querySelector('.aiimg-pane[data-pane=upscale] .aiimg-status') || {}).textContent || ''), { timeout: 30000 });
  console.log(stamp(), 'uploaded car.jpg |', await page.$eval('.aiimg-up-plan', (e) => e.textContent));
  await page.screenshot({ path: path.join(OUT, '2-loaded.png') });
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'deny' });

  peak = 0; sampling = true;
  let tr = Date.now();
  await page.click('#aiimg-up-run');
  await waitDone();
  sampling = false;
  let st = await status();
  console.log(stamp(), 'car 4×:', st, '| took', ((Date.now() - tr) / 1000).toFixed(1) + 's', '| peak heap', MB(peak));
  check(/^Upscaled 4× — ready$/.test(st), 'status "Upscaled 4× — ready"');
  let dims = await outDims();
  check(dims.w === 2560 && dims.h === 1920, 'output is 4× the input: ' + dims.w + '×' + dims.h);
  check(peak < 500 * 1048576, 'peak JS heap under 500 MB (' + MB(peak) + ')');
  let sh = await sharpness();
  check(sh.down >= sh.orig, 'sharper than the original: Laplacian variance ' + sh.orig + ' → ' + sh.down + ' (4× reduced back)');
  let sm = await seams();
  console.log('  column-difference profile: median', sm.median, 'p99', sm.p99, 'max', sm.max, 'at x =', sm.maxAt);
  check(await page.$eval('.aiimg-up-before', (e) => !e.hidden) && await page.$eval('.aiimg-up-divider', (e) => !e.hidden), 'before/after view shown');
  await page.screenshot({ path: path.join(OUT, '3-car-x4.png') });
  /* the divider: drag the handle and read the clip */
  const hb = await (await page.$('.aiimg-up-handle')).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down(); await page.mouse.move(hb.x + hb.width / 2 - 120, hb.y + hb.height / 2, { steps: 6 }); await page.mouse.up();
  const split = await page.$eval('.aiimg-up-handle', (e) => Number(e.getAttribute('aria-valuenow')));
  check(split < 50 && split > 5, 'divider drags (now at ' + split + '%)');
  await page.click('#aiimg-up-zoom-one');
  await wait(300);
  await page.screenshot({ path: path.join(OUT, '3-car-x4-1to1.png') });
  await page.click('#aiimg-up-zoom-fit');

  /* export */
  await page.click('.aiimg-tabs [data-pane=export]');
  await page.click('#aiimg-up-download');
  await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 1, { timeout: 120000 });
  const head = await page.$eval('.aiimg-result-head', (e) => e.textContent.trim());
  const blob = await pullBlob('.aiimg-result img');
  fs.writeFileSync(path.join(OUT, 'result-car-x4.png'), blob.buf);
  console.log(stamp(), 'export:', head, '|', blob.type, blob.size, 'bytes, magic', blob.buf.subarray(0, 8).toString('hex'), 'dims', pngDims(blob.buf));
  check(blob.buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'PNG magic bytes');
  check(pngDims(blob.buf) === '2560×1920', 'PNG is 2560×1920');
  await page.screenshot({ path: path.join(OUT, '4-export.png') });

  /* ---------------- unblur ---------------- */
  await page.click('.aiimg-tabs [data-pane=upscale]');
  await setMode('unblur');
  tr = Date.now();
  await page.click('#aiimg-up-run');
  await waitDone();
  st = await status();
  dims = await outDims();
  sh = await sharpness();
  console.log(stamp(), 'car unblur:', st, '| took', ((Date.now() - tr) / 1000).toFixed(1) + 's', '|', dims.w + '×' + dims.h, '| sharpness', sh.orig, '→', sh.down);
  check(/^Unblurred — ready$/.test(st), 'status "Unblurred — ready"');
  check(dims.w === 640 && dims.h === 480, 'unblur keeps the size');
  check(sh.down >= sh.orig, 'unblur is sharper than the original');
  await page.screenshot({ path: path.join(OUT, '5-car-unblur.png') });

  /* ---------------- denoise 50% (both models) ---------------- */
  await setMode('x4');
  await setDenoise(50);
  console.log('  plan:', await page.$eval('.aiimg-up-plan', (e) => e.textContent));
  tr = Date.now();
  peak = 0; sampling = true;
  await page.click('#aiimg-up-run');
  await waitDone();
  sampling = false;
  st = await status();
  dims = await outDims();
  sh = await sharpness();
  console.log(stamp(), 'car 4× denoise 50%:', st, '| took', ((Date.now() - tr) / 1000).toFixed(1) + 's', '|', dims.w + '×' + dims.h, '| sharpness', sh.orig, '→', sh.down, '| peak heap', MB(peak));
  check(/^Upscaled 4× — ready$/.test(st), 'denoise run completes');
  check(models.some((m) => /wdn/.test(m)), 'the wdn model was fetched: ' + models.filter((m) => /onnx/.test(m)).join(', '));
  await page.screenshot({ path: path.join(OUT, '6-car-denoise.png') });

  /* ---------------- cancel ---------------- */
  await setDenoise(0);
  await setMode('x2');
  await page.click('#aiimg-up-run');
  await page.waitForFunction(() => /Tile \d+ of/.test((document.querySelector('.aiimg-pane[data-pane=upscale] .aiimg-status') || {}).textContent || ''), { timeout: 120000, polling: 100 });
  await page.click('#aiimg-up-cancel');
  await waitDone(60000);
  st = await status();
  check(st === 'Cancelled.', 'cancel stops the run: "' + st + '"');
  check(await page.$eval('#aiimg-up-run', (b) => !b.disabled), 'run button re-enabled after cancel');

  /* ---------------- a 1,000 px photo to the cap ---------------- */
  if (!QUICK) {
    const jpg = fs.readFileSync(path.join(IMG, 'city-streets.jpg')).toString('base64');
    const dataUrl = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = 1000; c.height = Math.round(1000 * img.height / img.width);
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    }, jpg);
    const big = path.join(OUT, 'city-1000.png');
    fs.writeFileSync(big, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(stamp(), 'wrote', path.basename(big), pngDims(fs.readFileSync(big)));
    await (await page.$('.aiimg input[type=file][accept="image/*"]')).uploadFile(big);
    await page.waitForFunction(() => /Photo loaded/.test((document.querySelector('.aiimg-pane[data-pane=upscale] .aiimg-status') || {}).textContent || ''), { timeout: 30000 });
    await setMode('x4');
    console.log('  plan:', await page.$eval('.aiimg-up-plan', (e) => e.textContent));
    peak = 0; sampling = true;
    tr = Date.now();
    await page.click('#aiimg-up-run');
    await waitDone(1500000);
    sampling = false;
    st = await status();
    dims = await outDims();
    console.log(stamp(), 'city 1000 → 4×:', st, '| took', ((Date.now() - tr) / 1000).toFixed(1) + 's', '|', dims.w + '×' + dims.h, '| peak heap', MB(peak));
    check(/^Upscaled 4× — ready$/.test(st), '1,000 px run completes');
    check(dims.w === 4000 && dims.h === 4000, 'output is 4000×4000');
    check(peak < 500 * 1048576, 'peak JS heap under 500 MB during the 4,000 px run (' + MB(peak) + ')');
    await page.screenshot({ path: path.join(OUT, '7-city-x4.png') });
    await page.click('#aiimg-up-zoom-one');
    await page.evaluate(() => { const c = document.querySelector('.aiimg-up-compare'); c.scrollLeft = 900; c.scrollTop = 900; });
    await wait(300);
    await page.screenshot({ path: path.join(OUT, '8-city-1to1-at-a-tile-corner.png') });
    sh = await sharpness();
    check(sh.down >= sh.orig, 'city: sharper than the original (' + sh.orig + ' → ' + sh.down + ')');
    sm = await seams();
    console.log('  column-difference profile: median', sm.median, 'p99', sm.p99, 'max', sm.max, 'at x =', sm.maxAt);
    check(sm.max < sm.median * 6 || sm.maxAt % 4 !== 0, 'no column stands out as a seam');
  }

  clearInterval(sampler);
  console.log('  models fetched:', models.join(' | '));
  const shell = net.filter((n) => /google-analytics|googletagmanager/.test(n)); if (shell.length) console.log('  site-shell analytics (not the tool):', shell.length, 'request(s)');
  const third = [...new Set(net.filter((n) => !/ data:/.test(n) && !/google-analytics|googletagmanager/.test(n)).map((n) => n.replace(/\?.*$/, '')))];
  check(third.length === 0, 'zero third-party requests' + (third.length ? ': ' + third.join(', ') : ''));
  console.log('  [upscaler] lines:\n    ' + upLines.join('\n    '));
  save();
  await browser.close();
  console.log(stamp(), failures ? 'FAILED: ' + failures + ' check(s)' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
