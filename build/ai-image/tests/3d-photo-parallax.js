/*
 * Drives /ai-image/3d-photo-parallax/ in headless Chrome against a local
 * server of the export: upload a photo, wait for depth (and the subject),
 * screenshot the preview at three moments, export the 6-second 1080×1920
 * MP4 and a GIF, verify duration, size, motion and that the loop closes,
 * log the peak JS heap, count third-party requests (must be zero), and run
 * the 2D fallback once with WebGL switched off.
 *
 *   node 3d-photo-parallax.js [image] [--port 8723] [--root <export>] [--out <dir>]
 *
 * Exits non-zero on any failure. Headless Chrome's WebGL runs on SwiftShader
 * (software) and its H.264 encoder is software too, so the encode time
 * reported is a ceiling, not what a laptop with a GPU sees.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8723));
const ROOT = flag('root', path.resolve(__dirname, '..', '..', '..'));
const OUT = flag('out', path.join(ROOT, '..', 'out', 'parallax'));
const IMG = args.find((a) => !a.startsWith('--') && !['--port', '--root', '--out'].includes(args[args.indexOf(a) - 1])) || 'E:/tmp/1234-agents/harness/img/portrait-of-woman_small.jpg';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

const fails = [];
const check = (ok, what) => { console.log((ok ? '  PASS ' : '  FAIL ') + what); if (!ok) fails.push(what); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, protocolTimeout: 1200000,
    args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const logs = [];
  const net = [];
  const wire = (page) => {
    page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(stamp() + ' ' + t); if (/error|warn/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
    page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); fails.push('pageerror ' + e.message); });
    page.on('requestfailed', (r) => console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText));
    page.on('response', (r) => { const u = r.url(); if (!/^http:\/\/127\.0\.0\.1/.test(u) && !/^(data|blob):/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); if (/\.(onnx|wasm)$/.test(u)) logs.push(stamp() + ' response ' + r.status() + ' ' + u.split('/').pop()); });
  };
  const saveLogs = () => { try { fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n')); } catch (e) { /* */ } };
  const readyRe = /subject ready$|centred · depth ready$|could not be estimated/;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    wire(page);
    await page.goto('http://127.0.0.1:' + PORT + '/ai-image/3d-photo-parallax/', { waitUntil: 'networkidle0', timeout: 120000 });
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
    await page.evaluate(() => { window.__peak = 0; setInterval(() => { if (performance.memory) window.__peak = Math.max(window.__peak, performance.memory.usedJSHeapSize); }, 250); });

    const input = await page.$('.aiimg input[type=file][accept="image/*"]');
    await input.uploadFile(IMG);
    console.log(stamp(), 'uploaded', path.basename(IMG));
    await page.waitForFunction(() => { const s = document.querySelector('.aiimg-pane[data-pane=motion] .aiimg-status'); return s && /ready$|could not/.test(s.textContent.trim()); }, { timeout: 600000, polling: 500 });
    console.log(stamp(), 'first status:', await page.$eval('.aiimg-pane[data-pane=motion] .aiimg-status', (e) => e.textContent.trim()));
    await page.waitForFunction((src) => { const s = document.querySelector('.aiimg-pane[data-pane=motion] .aiimg-status'); return s && new RegExp(src).test(s.textContent.trim()); }, { timeout: 600000, polling: 500 }, readyRe.source);
    const status = await page.$eval('.aiimg-pane[data-pane=motion] .aiimg-status', (e) => e.textContent.trim());
    console.log(stamp(), 'status:', status);
    check(/ready$/.test(status), 'status ends in "ready"');
    const ioMsg = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
    if (ioMsg) console.log('  io-msg:', ioMsg);
    const info = await page.evaluate(() => { const S = AIImg.tools['3d-photo-parallax'].instance.state; return { timing: S.timing, gl: S.gl, image: [S.image.width, S.image.height], depth: [S.depth.w, S.depth.h], mesh: S.mesh && S.mesh.N, win: S.win, subject: S.subject }; });
    console.log('  info:', JSON.stringify(info));
    check(info.gl === true, 'WebGL path in use (SwiftShader in headless)');
    check(Math.max(info.image[0], info.image[1]) <= 1536, 'working image capped at 1536 px');
    check(info.mesh > 10000, 'mesh has ' + info.mesh + ' vertices');

    /* the preview at three moments */
    const shot = async (t, name) => {
      await page.evaluate((t) => { const inst = AIImg.tools['3d-photo-parallax'].instance; const S = inst.state; S.playing = false; S.t = t; inst.render(null, document.querySelector('.aiimg-par-canvas').width, document.querySelector('.aiimg-par-canvas').height, t); }, t);
      await wait(200);
      const png = await page.$eval('.aiimg-par-canvas', (c) => c.toDataURL('image/png'));
      fs.writeFileSync(path.join(OUT, name), Buffer.from(png.split(',')[1], 'base64'));
    };
    await page.waitForFunction(() => AIImg.tools['3d-photo-parallax'].instance.state.playing === true || true);
    await shot(0, '2-t0.png'); await shot(1.5, '3-t1.5.png'); await shot(3, '4-t3.png');
    await page.screenshot({ path: path.join(OUT, '5-page.png') });
    const depthPng = await page.evaluate(() => AIImg.depth.toCanvas(AIImg.tools['3d-photo-parallax'].instance.state.depth).toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, '2-depth.png'), Buffer.from(depthPng.split(',')[1], 'base64'));
    /* the other moves, one frame each */
    for (const move of ['dolly', 'circle', 'drift', 'tilt']) {
      await page.$eval('#aiimg-par-move', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, move);
      await shot(1.5, '6-' + move + '.png');
    }
    await page.$eval('#aiimg-par-move', (e) => { e.value = 'sway'; e.dispatchEvent(new Event('change', { bubbles: true })); });

    /* export 1080×1920 MP4, then a 480 GIF */
    await page.click('.aiimg-tabs [data-pane=export]');
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
    const results = async () => page.$$eval('.aiimg-result-head', (h) => h.map((x) => x.textContent.trim()));
    const clickExport = () => page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Export the 6-second loop/.test(b.textContent)) { b.click(); return true; } return false; });
    const clipDone = (k) => page.waitForFunction((k) => { const st = document.querySelector('.aiimg-pane[data-pane=export] .aiimg-status'); return document.querySelectorAll('.aiimg-result').length > k || /failed|Cancelled/.test(st ? st.textContent : ''); }, { timeout: 1200000, polling: 500 }, k);
    await page.$eval('#aiimg-par-clip-fmt', (e) => { e.value = 'mp4'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.$eval('#aiimg-par-clip-size', (e) => { e.value = '1080'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    let n = (await results()).length, ts = Date.now();
    await clickExport();
    await clipDone(n);
    console.log(stamp(), 'video:', (await results())[0], '|', await page.$eval('.aiimg-pane[data-pane=export] .aiimg-status', (e) => e.textContent), '| wall', ((Date.now() - ts) / 1000).toFixed(1) + 's (software GL + software H.264 in headless)');
    await page.$eval('#aiimg-par-clip-fmt', (e) => { e.value = 'gif'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.$eval('#aiimg-par-clip-size', (e) => { e.value = '480'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    n = (await results()).length; ts = Date.now();
    await clickExport();
    await clipDone(n);
    console.log(stamp(), 'gif:', (await results())[0], '| took', ((Date.now() - ts) / 1000).toFixed(1) + 's');
    const ioMsg2 = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
    if (ioMsg2) console.log('  io-msg:', ioMsg2);
    await page.screenshot({ path: path.join(OUT, '7-export.png') });

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
              const grab = (t) => new Promise((ok) => { v.currentTime = t; v.addEventListener('seeked', () => { const c = document.createElement('canvas'); c.width = 180; c.height = Math.round(180 * v.videoHeight / v.videoWidth); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); ok({ d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data, url: c.toDataURL('image/png') }); }, { once: true }); });
              const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return d / (a.length / 4) / 3; };
              const f0 = await grab(0.04), f05 = await grab(0.5), f3 = await grab(3.0), fEnd = await grab(Math.max(0, v.duration - 0.04));
              res({ duration: v.duration, w: v.videoWidth, h: v.videoHeight, diff05vs3: diff(f05.d, f3.d), diffLoop: diff(f0.d, fEnd.d), frames: [f0.url, f3.url, fEnd.url] });
            }, { once: true });
            v.addEventListener('error', () => res({ error: 'video failed to load' }), { once: true });
          });
        }
        out.push(info);
      }
      return out;
    });
    blobs.forEach((b, i) => {
      const ext = b.type === 'image/gif' ? 'gif' : b.type === 'video/mp4' ? 'mp4' : b.type === 'video/webm' ? 'webm' : 'png';
      const f = path.join(OUT, 'result-' + i + '.' + ext);
      const buf = Buffer.from(b.b64, 'base64');
      fs.writeFileSync(f, buf);
      const head = buf.subarray(0, 12).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
      const v = b.video ? Object.assign({}, b.video, { frames: undefined }) : null;
      console.log('  saved', path.basename(f), b.size, 'bytes, magic:', head, v ? JSON.stringify(v) : '');
      check(b.isBlob, path.basename(f) + ' is served from a blob: URL');
      if (ext === 'mp4') {
        check(buf.subarray(4, 8).toString() === 'ftyp', 'MP4 ftyp box');
        if (b.video && !b.video.error) {
          check(Math.abs(b.video.duration - 6) < 0.25, 'clip duration ' + b.video.duration.toFixed(2) + ' s ≈ 6 s');
          check(b.video.w === 1080 && b.video.h === 1920, 'clip is 1080×1920 (got ' + b.video.w + '×' + b.video.h + ')');
          check(b.video.diff05vs3 > 1.5, 'frames at 0.5 s and 3 s differ (mean abs diff ' + b.video.diff05vs3.toFixed(2) + ')');
          check(b.video.diffLoop < Math.max(1.5, b.video.diff05vs3 * 0.25), 'loop closes: first and last frames near-identical (mean abs diff ' + b.video.diffLoop.toFixed(2) + ' vs ' + b.video.diff05vs3.toFixed(2) + ' across the clip)');
          b.video.frames.forEach((u, k) => fs.writeFileSync(path.join(OUT, 'result-' + i + '-frame-' + ['start', 'middle', 'end'][k] + '.png'), Buffer.from(u.split(',')[1], 'base64')));
        } else check(false, 'video element could load the MP4');
      }
      if (ext === 'webm') check(buf[0] === 0x1a && buf[1] === 0x45, 'WebM EBML magic (no WebCodecs here)');
      if (ext === 'gif') check(/^GIF8[79]a$/.test(buf.subarray(0, 6).toString()), 'GIF magic');
    });
    check(blobs.length >= 2, 'two results produced (video, gif)');
    const peak = await page.evaluate(() => window.__peak);
    console.log('  peak JS heap:', (peak / 1048576).toFixed(0), 'MB');
    check(peak < 500 * 1048576, 'peak JS heap under 500 MB');
    await page.close();

    /* the 2D fallback: WebGL refused */
    console.log(stamp(), '--- 2D fallback (WebGL switched off) ---');
    const p2 = await browser.newPage();
    await p2.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    wire(p2);
    await p2.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/.test(t) ? null : g.call(this, t, o); }; });
    await p2.goto('http://127.0.0.1:' + PORT + '/ai-image/3d-photo-parallax/', { waitUntil: 'networkidle0', timeout: 120000 });
    const in2 = await p2.$('.aiimg input[type=file][accept="image/*"]');
    await in2.uploadFile(IMG);
    await p2.waitForFunction((src) => { const s = document.querySelector('.aiimg-pane[data-pane=motion] .aiimg-status'); return s && new RegExp(src).test(s.textContent.trim()); }, { timeout: 600000, polling: 500 }, readyRe.source);
    const st2 = await p2.evaluate(() => { const S = AIImg.tools['3d-photo-parallax'].instance.state; return { gl: S.gl, note: document.querySelector('.aiimg-par-note').textContent, status: document.querySelector('.aiimg-pane[data-pane=motion] .aiimg-status').textContent.trim() }; });
    console.log(stamp(), '2D status:', st2.status, '| gl =', st2.gl, '|', st2.note.slice(0, 60) + '…');
    check(st2.gl === false && /WebGL is not available/.test(st2.note), '2D fallback engaged and explained');
    await p2.evaluate(() => { const inst = AIImg.tools['3d-photo-parallax'].instance; inst.state.playing = false; const c = document.querySelector('.aiimg-par-canvas'); inst.render(null, c.width, c.height, 1.5); });
    await wait(200);
    const png2 = await p2.$eval('.aiimg-par-canvas', (c) => c.toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, '8-2d-t1.5.png'), Buffer.from(png2.split(',')[1], 'base64'));
    await p2.click('.aiimg-tabs [data-pane=export]');
    const c2 = await p2.target().createCDPSession();
    await c2.send('Page.setDownloadBehavior', { behavior: 'deny' });
    await p2.$eval('#aiimg-par-clip-fmt', (e) => { e.value = 'gif'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await p2.$eval('#aiimg-par-clip-size', (e) => { e.value = '480'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    ts = Date.now();
    await p2.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Export the 6-second loop/.test(b.textContent)) b.click(); });
    await p2.waitForFunction(() => { const st = document.querySelector('.aiimg-pane[data-pane=export] .aiimg-status'); return document.querySelectorAll('.aiimg-result').length > 0 || /failed|Cancelled/.test(st ? st.textContent : ''); }, { timeout: 600000, polling: 500 });
    const head2 = await p2.$eval('.aiimg-result-head', (e) => e.textContent.trim()).catch(() => 'no result');
    console.log(stamp(), '2D gif:', head2, '| took', ((Date.now() - ts) / 1000).toFixed(1) + 's');
    check(/GIF/.test(head2), '2D fallback exported a GIF');
    await p2.screenshot({ path: path.join(OUT, '9-2d-export.png') });
    await p2.close();

    const third = [...new Set(net.map((x) => x.replace(/\?.*$/, '')))];
    console.log('  third-party requests:', third.length ? third.join('\n    ') : 'none');
    check(third.length === 0, 'zero third-party requests');
    saveLogs();
    console.log(stamp(), fails.length ? 'FAILED: ' + fails.length + ' check(s)' : 'all checks passed');
  } finally {
    saveLogs();
    await browser.close();
  }
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
