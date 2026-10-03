/*
 * Drives /ai-image/blur-background/ in headless Chrome against a local
 * server of the export: upload a photo, wait for depth and layers, check
 * that the subject stayed sharp while the background softened (Laplacian
 * variance inside and outside the subject mask, result against original),
 * tap to focus, try the three styles, export a still, an MP4 clip and a
 * GIF, verify the files, and count third-party requests (must be zero).
 *
 *   node blur-background.js [image] [--port 8723] [--root <export>] [--out <dir>] [--expect People]
 *
 * Exits non-zero on any failure. Headless Chrome draws with SwiftShader,
 * so the timings reported are software-rendered.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8723));
const ROOT = flag('root', path.resolve(__dirname, '..', '..', '..'));
const OUT = flag('out', path.join(ROOT, '..', 'out', 'blur'));
const IMG = args.find((a) => !a.startsWith('--') && !['--port', '--root', '--out', '--expect'].includes(args[args.indexOf(a) - 1])) || 'E:/tmp/1234-agents/harness/img/portrait-of-woman_small.jpg';
const EXPECT = (flag('expect', '') || '').split(',').filter(Boolean);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

const fails = [];
const check = (ok, what) => { console.log((ok ? '  PASS ' : '  FAIL ') + what); if (!ok) fails.push(what); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, protocolTimeout: 900000,
    args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU', '--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    const logs = [];
    page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(stamp() + ' ' + t); if (/error|warn/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
    page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); fails.push('pageerror ' + e.message); });
    page.on('requestfailed', (r) => console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText));
    const net = [];
    page.on('response', (r) => { const u = r.url(); if (!/^http:\/\/127\.0\.0\.1/.test(u) && !/^(data|blob):/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); });
    page.on('response', (r) => { if (/\.(onnx|wasm)$/.test(r.url())) logs.push(stamp() + ' response ' + r.status() + ' ' + r.url().split('/').pop()); });
    const saveLogs = () => { try { fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n')); } catch (e) { /* */ } };

    await page.goto('http://127.0.0.1:' + PORT + '/ai-image/blur-background/', { waitUntil: 'networkidle0', timeout: 120000 });
    const title = await page.title();
    console.log(stamp(), 'page loaded; title =', title, '(' + title.length + ' chars)');
    check(title.length <= 70, 'title is 70 characters or fewer');
    const h1 = await page.$eval('h1', (e) => e.textContent.trim());
    const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
    const active = await page.$eval('.side-link.is-active', (e) => e.getAttribute('href')).catch(() => null);
    console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '), '| sidebar active =', active);
    check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
    check((await page.$$('.aiimg input[type=file][accept="image/*"]')).length === 1, 'exactly one image file input');
    const privacy = await page.$eval('.privacy-line', (e) => e.textContent);
    check(/EfficientViT-Seg B1 \(18 MB, Apache-2\.0\)/.test(privacy) && /Depth Anything V2 Small \(26 MB, Apache-2\.0\)/.test(privacy), 'privacy line names both models with size and licence');
    await page.screenshot({ path: path.join(OUT, '1-empty.png') });

    /* heap sampling for the whole run */
    await page.evaluate(() => { window.__peak = 0; setInterval(() => { if (performance.memory) window.__peak = Math.max(window.__peak, performance.memory.usedJSHeapSize); }, 250); });

    /* upload and wait for depth + layers */
    const input = await page.$('.aiimg input[type=file][accept="image/*"]');
    await input.uploadFile(IMG);
    console.log(stamp(), 'uploaded', path.basename(IMG));
    await page.waitForFunction(() => { const s = document.querySelector('.aiimg-pane[data-pane=blur] .aiimg-status'); return s && /ready$|could not/.test(s.textContent.trim()); }, { timeout: 600000, polling: 500 });
    const status = await page.$eval('.aiimg-pane[data-pane=blur] .aiimg-status', (e) => e.textContent.trim());
    console.log(stamp(), 'status:', status);
    check(/ready$/.test(status), 'status ends in "ready"');
    const ioMsg = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
    if (ioMsg) console.log('  io-msg:', ioMsg);
    const timing = await page.evaluate(() => AIImg.tools['blur-background'].instance.state.timing);
    console.log('  timing (ms, WASM on CPU — headless):', JSON.stringify(timing));
    const layers = await page.$$eval('.aiimg-layer', (rows) => rows.map((r) => ({ name: r.querySelector('.aiimg-lname').textContent, area: r.querySelector('.aiimg-area').textContent, on: r.querySelector('input').checked })));
    console.log('  layers:', layers.map((l) => (l.on ? '[x] ' : '[ ] ') + l.name + ' ' + l.area).join(' | '));
    for (const e of EXPECT) check(layers.some((l) => l.name.toLowerCase() === e.toLowerCase() && l.on), 'layer "' + e + '" found and kept sharp');
    await wait(600);
    await page.screenshot({ path: path.join(OUT, '2-ready.png') });

    /* sharpness: Laplacian variance of the result vs the original, inside the subject and in the background */
    const sharp = await page.evaluate(() => {
      const inst = AIImg.tools['blur-background'].instance, S = inst.state;
      const c = document.querySelector('.aiimg-canvas'), o = document.querySelector('.aiimg-blur-compare');
      const W = c.width, H = c.height;
      const grey = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, W, H).data; const g = new Float32Array(W * H); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]; return g; };
      const gr = grey(c), go = grey(o);
      const D = S.depth; const sub = S.subjectBase;
      const maskAt = (x, y) => { if (!sub) return 0; const mx = Math.min(D.w - 1, Math.round(x / W * D.w)), my = Math.min(D.h - 1, Math.round(y / H * D.h)); return sub[my * D.w + mx]; };
      const weightAt = (x, y) => { const mx = Math.min(D.w - 1, Math.round(x / W * D.w)), my = Math.min(D.h - 1, Math.round(y / H * D.h)); return S.weight[my * D.w + mx]; };
      /* the subject, as the tool defines it: the ticked layers' mask intersected
         with "near" depth (not far behind the focus); a passer-by across the
         street is in the People mask but is background to a lens. The raw
         mask's ratio is reported too, for honesty. */
      const depthAt = (x, y) => { const mx = Math.min(D.w - 1, Math.round(x / W * D.w)), my = Math.min(D.h - 1, Math.round(y / H * D.h)); return D.data[my * D.w + mx]; };
      const near = S.focus - S.dof / 100 - 0.25;
      const acc = { inR: 0, inO: 0, nIn: 0, bgR: 0, bgO: 0, nBg: 0, inR2: 0, inO2: 0, bgR2: 0, bgO2: 0, rawR: 0, rawO: 0, rawR2: 0, rawO2: 0, nRaw: 0 };
      const lap = (g, x, y) => 4 * g[y * W + x] - g[y * W + x - 1] - g[y * W + x + 1] - g[(y - 1) * W + x] - g[(y + 1) * W + x];
      for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) {
        const m = maskAt(x, y);
        const lr = lap(gr, x, y), lo = lap(go, x, y);
        if (m > 0.9) {
          acc.rawR += lr; acc.rawO += lo; acc.rawR2 += lr * lr; acc.rawO2 += lo * lo; acc.nRaw++;
          if (depthAt(x, y) >= near) { acc.inR += lr; acc.inO += lo; acc.inR2 += lr * lr; acc.inO2 += lo * lo; acc.nIn++; }
        }
        else if (m < 0.02 && weightAt(x, y) > 2.5) { acc.bgR += lr; acc.bgO += lo; acc.bgR2 += lr * lr; acc.bgO2 += lo * lo; acc.nBg++; }
      }
      const v = (s, s2, n) => n ? s2 / n - (s / n) * (s / n) : 0;
      return { W, H, nIn: acc.nIn, nRaw: acc.nRaw, nBg: acc.nBg,
        inRatio: v(acc.inR, acc.inR2, acc.nIn) / Math.max(1e-6, v(acc.inO, acc.inO2, acc.nIn)),
        rawMaskRatio: v(acc.rawR, acc.rawR2, acc.nRaw) / Math.max(1e-6, v(acc.rawO, acc.rawO2, acc.nRaw)),
        bgRatio: v(acc.bgR, acc.bgR2, acc.nBg) / Math.max(1e-6, v(acc.bgO, acc.bgO2, acc.nBg)),
        varInO: v(acc.inO, acc.inO2, acc.nIn), varBgO: v(acc.bgO, acc.bgO2, acc.nBg), focus: S.focus, dof: S.dof, near, strength: S.strength };
    });
    console.log('  sharpness:', JSON.stringify(sharp));
    check(sharp.nIn > 500, 'subject (ticked layers, near depth) covers a real area (' + sharp.nIn + ' of ' + sharp.nRaw + ' mask samples)');
    check(sharp.inRatio > 0.85, 'subject sharpness kept: Laplacian variance ratio ' + sharp.inRatio.toFixed(3) + ' > 0.85 (whole People mask incl. far people: ' + sharp.rawMaskRatio.toFixed(3) + ')');
    check(sharp.bgRatio < 0.5, 'background softened: Laplacian variance ratio ' + sharp.bgRatio.toFixed(3) + ' < 0.5');
    const canvasPng = await page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, '2-canvas.png'), Buffer.from(canvasPng.split(',')[1], 'base64'));
    const depthPng = await page.evaluate(() => AIImg.depth.toCanvas(AIImg.tools['blur-background'].instance.state.depth).toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, '2-depth.png'), Buffer.from(depthPng.split(',')[1], 'base64'));

    /* compare slider half way, then tap to focus on the background and on the subject */
    await page.evaluate(() => AIImg.tools['blur-background'].instance.setCompare(0.45));
    await wait(300);
    await page.screenshot({ path: path.join(OUT, '3-compare.png') });
    const before = sharp.focus;
    const tapped = await page.evaluate(() => { const inst = AIImg.tools['blur-background'].instance; inst.focusAt(0.08, 0.08); return inst.state.focus; });
    await wait(500);
    console.log('  tap to focus: top-left corner ->', tapped.toFixed(3), '(was', before.toFixed(3) + ')');
    check(Math.abs(tapped - before) > 0.05 || tapped < 0.5, 'tap to focus changes the focus depth');
    await page.screenshot({ path: path.join(OUT, '4-focus-background.png') });
    const centre = await page.evaluate(() => { const S = AIImg.tools['blur-background'].instance.state; if (!S.subjectBase) return null; const D = S.depth; let sx = 0, sy = 0, n = 0; for (let y = 0; y < D.h; y += 4) for (let x = 0; x < D.w; x += 4) if (S.subjectBase[y * D.w + x] > 0.9) { sx += x; sy += y; n++; } return n ? { u: sx / n / D.w, v: sy / n / D.h } : null; });
    if (centre) { await page.evaluate((c) => AIImg.tools['blur-background'].instance.focusAt(c.u, c.v), centre); await wait(500); }
    await page.evaluate(() => AIImg.tools['blur-background'].instance.setCompare(0));

    /* styles */
    for (const [style, fileName] of [['motion', '5-motion.png'], ['zoom', '6-zoom.png'], ['bokeh', '7-bokeh.png']]) {
      await page.$eval('#aiimg-blur-style', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, style);
      if (style === 'motion') await page.$eval('#aiimg-blur-angle', (e) => { e.value = '20'; e.dispatchEvent(new Event('input', { bubbles: true })); });
      if (style === 'bokeh') await page.$eval('#aiimg-blur-bloom', (e) => { e.value = '40'; e.dispatchEvent(new Event('input', { bubbles: true })); });
      await wait(900);
      await page.screenshot({ path: path.join(OUT, fileName) });
    }
    await page.$eval('#aiimg-blur-bloom', (e) => { e.value = '0'; e.dispatchEvent(new Event('input', { bubbles: true })); });

    /* exports */
    await page.click('.aiimg-tabs [data-pane=export]');
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
    const results = async () => page.$$eval('.aiimg-result-head', (h) => h.map((x) => x.textContent.trim()));
    const clickBtn = (re) => page.evaluate((src) => { const re = new RegExp(src); for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (re.test(b.textContent)) { b.click(); return true; } return false; }, re.source);

    await page.$eval('#aiimg-blur-still-size', (e) => { e.value = '1080'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    let n = (await results()).length, ts = Date.now();
    await clickBtn(/Download the image/);
    await page.waitForFunction((k) => document.querySelectorAll('.aiimg-result').length > k || /error/.test(document.querySelector('.aiimg > .io-msg').className), { timeout: 120000, polling: 300 }, n);
    console.log(stamp(), 'still:', (await results())[0], '| took', ((Date.now() - ts) / 1000).toFixed(1) + 's');

    const clipDone = (k) => page.waitForFunction((k) => { const st = document.querySelector('.aiimg-pane[data-pane=export] .aiimg-status'); return document.querySelectorAll('.aiimg-result').length > k || /failed|Cancelled/.test(st ? st.textContent : ''); }, { timeout: 600000, polling: 500 }, k);
    await page.$eval('#aiimg-blur-clip-fmt', (e) => { e.value = 'mp4'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.$eval('#aiimg-blur-clip-size', (e) => { e.value = '720'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    n = (await results()).length; ts = Date.now();
    await clickBtn(/Export the before-and-after clip/);
    await clipDone(n);
    const encodeMs = await page.evaluate(() => AIImg.tools['blur-background'].instance.state.timing.encode);
    console.log(stamp(), 'video:', (await results())[0], '|', await page.$eval('.aiimg-pane[data-pane=export] .aiimg-status', (e) => e.textContent), '| wall', ((Date.now() - ts) / 1000).toFixed(1) + 's', '| encode', Math.round(encodeMs || 0) + 'ms (software H.264 in headless)');

    await page.$eval('#aiimg-blur-clip-fmt', (e) => { e.value = 'gif'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.$eval('#aiimg-blur-clip-size', (e) => { e.value = '480'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    n = (await results()).length; ts = Date.now();
    await clickBtn(/Export the before-and-after clip/);
    await clipDone(n);
    console.log(stamp(), 'gif:', (await results())[0], '| took', ((Date.now() - ts) / 1000).toFixed(1) + 's');
    const ioMsg2 = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
    if (ioMsg2) console.log('  io-msg:', ioMsg2);
    await page.screenshot({ path: path.join(OUT, '8-export.png') });

    /* the blobs: magic bytes, and the video's duration and motion */
    const blobs = await page.evaluate(async () => {
      const out = [];
      for (const e of document.querySelectorAll('.aiimg-result img, .aiimg-result video')) {
        const r = await fetch(e.src); const b = await r.blob();
        const buf = new Uint8Array(await b.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        const info = { type: b.type, size: b.size, b64: btoa(bin), isBlob: /^blob:/.test(e.src) };
        if (e.tagName === 'VIDEO') {
          info.video = await new Promise((res) => {
            const v = document.createElement('video'); v.muted = true; v.src = e.src;
            v.addEventListener('loadedmetadata', async () => {
              const grab = (t) => new Promise((ok) => { v.currentTime = t; v.addEventListener('seeked', () => { const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 * v.videoHeight / v.videoWidth); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); ok(c.getContext('2d').getImageData(0, 0, c.width, c.height).data); }, { once: true }); });
              const a = await grab(0.5), b2 = await grab(2.0);
              let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b2[i]) + Math.abs(a[i + 1] - b2[i + 1]) + Math.abs(a[i + 2] - b2[i + 2]);
              res({ duration: v.duration, w: v.videoWidth, h: v.videoHeight, diff05vs2: d / (a.length / 4) / 3 });
            }, { once: true });
            v.addEventListener('error', () => res({ error: 'video failed to load' }), { once: true });
          });
        }
        out.push(info);
      }
      return out;
    });
    blobs.forEach((b, i) => {
      const ext = b.type === 'image/gif' ? 'gif' : b.type === 'video/mp4' ? 'mp4' : b.type === 'video/webm' ? 'webm' : b.type === 'image/jpeg' ? 'jpg' : 'png';
      const f = path.join(OUT, 'result-' + i + '.' + ext);
      const buf = Buffer.from(b.b64, 'base64');
      fs.writeFileSync(f, buf);
      const head = buf.subarray(0, 12).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
      console.log('  saved', path.basename(f), b.size, 'bytes, magic:', head, b.video ? JSON.stringify(b.video) : '');
      check(b.isBlob, path.basename(f) + ' is served from a blob: URL');
      if (ext === 'png') check(buf[0] === 0x89 && buf.subarray(1, 4).toString() === 'PNG', 'PNG magic');
      if (ext === 'mp4') { check(buf.subarray(4, 8).toString() === 'ftyp', 'MP4 ftyp box'); if (b.video) { check(Math.abs(b.video.duration - 4) < 0.25, 'clip duration ' + b.video.duration.toFixed(2) + ' s ≈ 4 s'); check(b.video.diff05vs2 > 2, 'clip frames differ over time (mean abs diff ' + b.video.diff05vs2.toFixed(1) + ')'); } }
      if (ext === 'webm') check(buf[0] === 0x1a && buf[1] === 0x45, 'WebM EBML magic (no WebCodecs here)');
      if (ext === 'gif') check(buf.subarray(0, 6).toString() === 'GIF89a' || buf.subarray(0, 6).toString() === 'GIF87a', 'GIF magic');
    });
    check(blobs.length >= 3, 'three results produced (still, video, gif)');
    const peak = await page.evaluate(() => window.__peak);
    console.log('  peak JS heap:', (peak / 1048576).toFixed(0), 'MB');
    const third = [...new Set(net.map((x) => x.replace(/\?.*$/, '')))];
    console.log('  third-party requests:', third.length ? third.join('\n    ') : 'none');
    check(third.length === 0, 'zero third-party requests');
    saveLogs();
    console.log(stamp(), fails.length ? 'FAILED: ' + fails.length + ' check(s)' : 'all checks passed');
  } finally {
    await browser.close();
  }
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
