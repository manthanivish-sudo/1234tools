/*
 * Drives /ai-image/sky-replacement/ in headless Chrome: upload
 * segmentation_input.jpg, wait for the sky mask, check that no sky alpha
 * lands on the buildings, that the sky was replaced, that matching the
 * light shifts the foreground, export a PNG, an MP4 and a GIF of the
 * drifting clouds and check their magic bytes, and that the skies on
 * disk total at most 2 MB. Records every non-local response.
 *
 *   node sky-replacement.js [--root <export dir>] [--port 8722] [--out <dir>] [--img <harness img dir>]
 *
 * With --root the script serves that directory itself on --port; without
 * it a server must already be listening there. Exits non-zero on failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8722));
const ROOT = flag('root', null);
const OUT = flag('out', path.join(__dirname, 'out', 'sky-replacement'));
const IMG = flag('img', 'E:/tmp/1234-agents/harness/img');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (cond, m) => { if (cond) console.log('  ok   ' + m); else { console.log('  FAIL ' + m); failures.push(m); } };

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
function serve(root, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const abs = path.join(root, p);
      fs.stat(abs, (err, st) => {
        if (err || !st.isFile()) { r.writeHead(404); r.end('not found'); return; }
        r.writeHead(200, { 'Content-Type': TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
        fs.createReadStream(abs).pipe(r);
      });
    }).listen(port, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const server = ROOT ? await serve(ROOT, PORT) : null;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU'], protocolTimeout: 600000 });
  const logs = [], net = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (/error/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
    page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); failures.push('page error: ' + e.message); });
    page.on('requestfailed', (r) => { logs.push('requestfailed ' + r.url()); console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText); });
    page.on('response', (r) => { const u = r.url(); if (!/^http:\/\/127\.0\.0\.1/.test(u) && !/^(data|blob):/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); });
    const skyLoads = [];
    page.on('response', (r) => { if (/\/engine\/skies\//.test(r.url())) skyLoads.push(r.url().split('/').pop()); });
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' });

    await page.goto('http://127.0.0.1:' + PORT + '/ai-image/sky-replacement/', { waitUntil: 'networkidle0', timeout: 120000 });
    console.log(stamp(), 'page loaded; title =', await page.title());
    check((await page.title()).length <= 70, 'title is at most 70 characters');
    const h1 = await page.$eval('h1', (e) => e.textContent.trim());
    const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
    console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '));
    check(/Sky Replacement/.test(h1), 'h1 names the tool');
    check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
    check((await page.$$('.aiimg input[type=file][accept="image/*"]')).length === 1, 'exactly one image file input');
    check(skyLoads.length === 0, 'no sky file is fetched before a photo is chosen');
    await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    await page.screenshot({ path: path.join(OUT, '1-empty.png') });

    const ready = () => page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && /ready$|could not/.test(s.textContent.trim()); }, { timeout: 600000, polling: 500 });
    const input = await page.$('.aiimg input[type=file][accept="image/*"]');
    await input.uploadFile(path.join(IMG, 'segmentation_input.jpg'));
    const tu = Date.now();
    await ready();
    const status = await page.$eval('.aiimg-status', (e) => e.textContent.trim());
    console.log(stamp(), 'status:', status, '(' + ((Date.now() - tu) / 1000).toFixed(1) + ' s)');
    check(/ready$/.test(status), 'status ends in "ready"');
    check(/Sky: \d+%/.test(status), 'status reports the sky share');
    const layers = await page.$$eval('.aiimg-layer', (rows) => rows.map((r) => (r.querySelector('input').checked ? '[x] ' : '[ ] ') + r.querySelector('.aiimg-lname').textContent + ' ' + r.querySelector('.aiimg-area').textContent));
    console.log('  layers:', layers.join(' | '));
    check(layers.some((l) => /\[x\] Sky/.test(l)), 'the Sky layer is ticked');
    await page.waitForFunction(() => { const S = document.querySelector('.tool').aiimgTool.state; return !!S.skyImg && Object.keys(S.levels).length > 0; }, { timeout: 60000 });
    await new Promise((r) => setTimeout(r, 400));
    console.log('  sky files fetched so far:', skyLoads.join(', ') || 'none');
    check(skyLoads.length === 1 && skyLoads[0] === 'soft-clouds.webp', 'only the chosen sky (soft-clouds.webp) was fetched');
    await page.screenshot({ path: path.join(OUT, '2-mask.png') });
    const canvasPng = (file) => page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png')).then((d) => fs.writeFileSync(path.join(OUT, file), Buffer.from(d.split(',')[1], 'base64')));
    await canvasPng('2-canvas-soft-clouds.png');

    /* no sky alpha on the buildings */
    const leak = await page.evaluate(() => {
      const S = document.querySelector('.tool').aiimgTool.state;
      const { mw, mh, classMap, layers } = S.seg;
      const b = layers.find((l) => l.label === 'building');
      if (!b) return null;
      const [x0, y0, x1, y1] = b.bbox;
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      let inSum = 0, inN = 0, bSum = 0, bN = 0, skySum = 0, skyN = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * mw + x, a = S.alpha[i];
        if (classMap[i] === b.key) { bSum += a; bN++; }
        if (x >= x0 + bw * 0.2 && x <= x1 - bw * 0.2 && y >= y0 + bh * 0.2 && y <= y1 - bh * 0.2) { inSum += a; inN++; }
      }
      const sky = layers.find((l) => l.label === 'sky');
      for (let i = 0; i < classMap.length; i++) if (classMap[i] === sky.key) { skySum += S.alpha[i]; skyN++; }
      return { onBuildingPixels: bSum / Math.max(1, bN), inBboxInterior: inSum / Math.max(1, inN), onSkyPixels: skySum / Math.max(1, skyN), bbox: b.bbox, mw, mh, buildingShare: b.area, horizon: S.horizon };
    });
    console.log('  sky alpha on building-labelled pixels =', leak && leak.onBuildingPixels.toFixed(4), '| in the inner 60% of the building bbox =', leak && leak.inBboxInterior.toFixed(4), '| on sky pixels =', leak && leak.onSkyPixels.toFixed(3), '| horizon =', leak && leak.horizon.toFixed(3));
    check(leak !== null, 'a building layer was found');
    check(leak && leak.onBuildingPixels < 0.05, 'mean sky alpha on building pixels < 0.05');
    check(leak && leak.onSkyPixels > 0.8, 'mean sky alpha on sky pixels > 0.8 (the sky is in the mask)');

    /* the sky was replaced: the top of the frame no longer matches the photo */
    const replaced = await page.evaluate(() => {
      const S = document.querySelector('.tool').aiimgTool.state;
      const c = document.querySelector('.aiimg-canvas'), x = c.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const src = document.createElement('canvas'); src.width = c.width; src.height = c.height;
      const sx = src.getContext('2d'); sx.drawImage(S.image.canvas, 0, 0, c.width, c.height);
      const o = sx.getImageData(0, 0, c.width, c.height).data;
      const { mw, mh } = S.seg;
      let diff = 0, n = 0;
      for (let y = 0; y < c.height; y += 2) for (let xx = 0; xx < c.width; xx += 2) {
        const a = S.alpha[Math.min(mh - 1, Math.floor(y / c.height * mh)) * mw + Math.min(mw - 1, Math.floor(xx / c.width * mw))];
        if (a < 0.9) continue;
        const j = (y * c.width + xx) * 4;
        diff += Math.abs(d[j] - o[j]) + Math.abs(d[j + 1] - o[j + 1]) + Math.abs(d[j + 2] - o[j + 2]); n++;
      }
      return { meanAbsDiff: diff / Math.max(1, n) / 3, skyPixels: n };
    });
    console.log('  mean |new − old| over sky pixels =', replaced.meanAbsDiff.toFixed(1), 'over', replaced.skyPixels, 'samples');
    check(replaced.meanAbsDiff > 15, 'the sky pixels changed (mean abs diff > 15)');

    /* matching the light shifts the foreground: sunset sky, warmth 0 vs 100 */
    await page.click('.aiimg-tabs [data-pane=sky]');
    await page.click('.aiimg-sky-choice[data-sky=sunset]');
    await page.waitForFunction(() => { const S = document.querySelector('.tool').aiimgTool.state; return S.sky === 'sunset' && !!S.skyImg && !S.skyLoading; }, { timeout: 60000 });
    await new Promise((r) => setTimeout(r, 300));
    check(skyLoads.length === 2 && skyLoads[1] === 'sunset.webp', 'choosing Sunset fetched sunset.webp and nothing else');
    await page.click('.aiimg-tabs [data-pane=light]');
    const fgMean = () => page.evaluate(() => {
      const S = document.querySelector('.tool').aiimgTool.state;
      const c = document.querySelector('.aiimg-canvas'), x = c.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const { mw, mh } = S.seg;
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = 0; y < c.height; y += 2) for (let xx = 0; xx < c.width; xx += 2) {
        const a = S.alpha[Math.min(mh - 1, Math.floor(y / c.height * mh)) * mw + Math.min(mw - 1, Math.floor(xx / c.width * mw))];
        if (a > 0.1) continue;
        const j = (y * c.width + xx) * 4;
        r += d[j]; g += d[j + 1]; b += d[j + 2]; n++;
      }
      return [r / n, g / n, b / n];
    });
    const setLight = async (warm, reflect) => {
      await page.$eval('#aiimg-sky-warmth', (e, val) => { e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(warm));
      await page.$eval('#aiimg-sky-reflect', (e, val) => { e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(reflect));
      await new Promise((r) => setTimeout(r, 500));
    };
    const fmt = (m) => m.map((v) => v.toFixed(1)).join(', ');
    const sgn = (m) => m.map((v) => (v >= 0 ? '+' : '') + v.toFixed(1)).join(', ');
    /* sunset, warmth and reflection together */
    await setLight(0, 0);
    const m0 = await fgMean();
    await canvasPng('3-sunset-light-0.png');
    await setLight(100, 100);
    const m1 = await fgMean();
    await canvasPng('3-sunset-light-100.png');
    const shift = m1.map((v, i) => v - m0[i]);
    console.log('  sunset: foreground mean RGB at match 0 =', fmt(m0), '| at warmth 100 + reflect 100 =', fmt(m1), '| shift =', sgn(shift));
    console.log('  tool reports:', await page.$eval('.aiimg-sky-shift', (e) => e.textContent).catch(() => ''));
    check(Math.max(...shift.map(Math.abs)) > 2, 'matching the light visibly shifts the foreground (|ΔRGB| > 2 on a channel)');
    /* golden hour, warmth only: the foreground must warm up */
    await page.click('.aiimg-tabs [data-pane=sky]');
    await page.click('.aiimg-sky-choice[data-sky=golden-hour]');
    await page.waitForFunction(() => { const S = document.querySelector('.tool').aiimgTool.state; return S.sky === 'golden-hour' && !!S.skyImg && !S.skyLoading; }, { timeout: 60000 });
    await page.click('.aiimg-tabs [data-pane=light]');
    await setLight(0, 0);
    const g0 = await fgMean();
    await setLight(100, 0);
    const g1 = await fgMean();
    await canvasPng('3-golden-warmth-100.png');
    const gs = g1.map((v, i) => v - g0[i]);
    console.log('  golden hour: foreground mean RGB at warmth 0 =', fmt(g0), '| at warmth 100 =', fmt(g1), '| shift =', sgn(gs), '| R−B before', (g0[0] - g0[2]).toFixed(1), 'after', (g1[0] - g1[2]).toFixed(1));
    console.log('  tool reports:', await page.$eval('.aiimg-sky-shift', (e) => e.textContent).catch(() => ''));
    check((g1[0] - g1[2]) - (g0[0] - g0[2]) > 3, 'a golden-hour sky warms the foreground (R − B rises by more than 3)');
    await setLight(70, 50);
    await page.click('.aiimg-tabs [data-pane=sky]');
    await page.click('.aiimg-sky-choice[data-sky=sunset]');
    await page.waitForFunction(() => { const S = document.querySelector('.tool').aiimgTool.state; return S.sky === 'sunset' && !!S.skyImg && !S.skyLoading; }, { timeout: 60000 });
    await page.click('.aiimg-tabs [data-pane=light]');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, '3-sunset-light.png') });

    /* a procedural sky draws without any fetch */
    await page.click('.aiimg-tabs [data-pane=sky]');
    await page.click('.aiimg-sky-choice[data-sky=night-stars]');
    await page.waitForFunction(() => { const S = document.querySelector('.tool').aiimgTool.state; return S.sky === 'night-stars' && !!S.skyImg; }, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 400));
    await canvasPng('4-night-stars.png');
    check(skyLoads.length === 3, 'the generated night sky fetched nothing');
    await page.click('.aiimg-sky-choice[data-sky=sunset]');
    await page.waitForFunction(() => { const S = document.querySelector('.tool').aiimgTool.state; return S.sky === 'sunset' && !!S.skyImg && !S.skyLoading; }, { timeout: 20000 });

    /* drifting clouds: MP4 and GIF, plus a PNG still */
    await page.click('.aiimg-tabs [data-pane=motion]');
    await page.click('#aiimg-sky-drift');
    await page.$eval('#aiimg-dur', (e) => { e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('.aiimg-tabs [data-pane=export]');
    const results = () => page.$$eval('.aiimg-result-head', (h) => h.map((x) => x.textContent.trim()));
    await page.$eval('#aiimg-still-size', (e) => { e.value = '1080'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Download the image/.test(b.textContent)) b.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 1, { timeout: 60000 });
    console.log(stamp(), 'still:', (await results())[0]);
    const clipDone = (n) => page.waitForFunction((k) => {
      const st = document.querySelector('.aiimg-pane[data-pane=export] .aiimg-status');
      return document.querySelectorAll('.aiimg-result').length > k || /failed|Cancelled/.test(st ? st.textContent : '');
    }, { timeout: 300000, polling: 500 }, n);
    for (const [fmt, size, fps] of [['mp4', '720', '24'], ['gif', '480', '10']]) {
      await page.$eval('#aiimg-clip-fmt', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, fmt);
      await page.$eval('#aiimg-clip-size', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, size);
      await page.$eval('#aiimg-clip-fps', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, fps);
      const n0 = (await results()).length, tg = Date.now();
      await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Export the clip/.test(b.textContent)) b.click(); });
      await clipDone(n0);
      console.log(stamp(), fmt + ':', (await results())[0], '|', await page.$eval('.aiimg-pane[data-pane=export] .aiimg-status', (e) => e.textContent), '| took', ((Date.now() - tg) / 1000).toFixed(1) + 's');
    }
    await page.screenshot({ path: path.join(OUT, '5-export.png') });
    const blobs = await page.evaluate(async () => {
      const out = [];
      for (const el of document.querySelectorAll('.aiimg-result img, .aiimg-result video')) {
        const b = await (await fetch(el.src)).blob();
        const buf = new Uint8Array(await b.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        out.push({ type: b.type, size: b.size, b64: btoa(bin) });
      }
      return out;
    });
    const seen = {};
    blobs.forEach((b, i) => {
      const ext = b.type === 'image/gif' ? 'gif' : b.type === 'video/mp4' ? 'mp4' : b.type === 'video/webm' ? 'webm' : 'png';
      const f = path.join(OUT, 'result-' + i + '.' + ext);
      const buf = Buffer.from(b.b64, 'base64');
      fs.writeFileSync(f, buf);
      console.log('  saved', path.basename(f), b.size, 'bytes, magic:', buf.subarray(0, 12).toString('latin1').replace(/[^\x20-\x7e]/g, '.'));
      seen[ext] = { size: b.size, buf };
    });
    check(seen.png && seen.png.buf.subarray(1, 4).toString() === 'PNG', 'PNG export has the PNG magic');
    check(seen.mp4 && seen.mp4.buf.subarray(4, 8).toString() === 'ftyp', 'MP4 export has ftyp');
    check(seen.gif && seen.gif.buf.subarray(0, 6).toString() === 'GIF89a', 'GIF export is GIF89a');

    /* the skies on disk */
    if (ROOT) {
      const dir = path.join(ROOT, 'engine', 'skies');
      const files = fs.readdirSync(dir).filter((f) => /\.webp$/.test(f));
      const total = files.reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
      console.log('  skies on disk:', files.length, 'files,', total, 'bytes');
      check(total <= 2 * 1024 * 1024, 'all skies together are at most 2 MB');
      check(fs.existsSync(path.join(dir, 'README.txt')) && /CC0/.test(fs.readFileSync(path.join(dir, 'README.txt'), 'utf8')), 'engine/skies/README.txt records the licences');
    }

    const third = [...new Set(net.map((n) => n.replace(/\?.*$/, '')))];
    console.log('  third-party responses:', third.length ? third.join('\n    ') : 'none');
    check(third.length === 0, 'zero third-party requests');
  } finally {
    fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n'));
    await browser.close();
    if (server) server.close();
  }
  console.log(stamp(), failures.length ? 'FAILED: ' + failures.length + ' check(s)\n  - ' + failures.join('\n  - ') : 'all checks passed');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
