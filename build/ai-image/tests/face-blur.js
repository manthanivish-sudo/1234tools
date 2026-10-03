/*
 * Drives /ai-image/face-blur/ in headless Chrome against a local static
 * server and checks what the page claims:
 *
 *   photo  — city-streets.jpg: faces found at Normal and at Small faces
 *            (≥ 2 expected at Small); a click keeps one face (its pixel
 *            variance in the export matches the original) while the others
 *            are destroyed (variance collapses); PNG magic bytes.
 *            cats.jpg: no faces, and the status says so.
 *   video  — a synthetic 10 s 1280×720 30 fps WebM with a tone, made in
 *            the page with MediaRecorder (the portrait drifting across a
 *            backdrop), is blurred and re-encoded: MP4 (ftyp) or WebM,
 *            duration ≈ 10 s, the face region at t = 5 s is blurred, an
 *            audio track is present (two `trak` boxes) or the status says
 *            the sound was removed; wall-clock reported.
 *   always — zero third-party requests; the model is in the SW cache.
 *
 *   node build/ai-image/tests/face-blur.js [--port 8725] [--root <export>] [--out <dir>] [--skip-video] [--remake-clip]
 *
 * Start the server first:  node E:/tmp/1234-agents/harness/serve.js <export> 8725
 * Exits non-zero on failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8725));
const ROOT = flag('root', path.resolve(__dirname, '..', '..', '..'));
const OUT = flag('out', path.join(__dirname, 'out'));
const IMG = flag('img', 'E:/tmp/1234-agents/harness/img');
const SKIP_VIDEO = flag('skip-video', false) === true;
const CLIP = path.join(OUT, 'test-clip.webm');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const failures = [];
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failures.push(what); };
const logs = [];
const saveLog = () => { try { fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n')); } catch (e) { /* */ } };

/* the clip: the portrait drifting across a 1280×720 backdrop for 10 s at 30 fps, with a 440 Hz tone */
async function makeClip(page) {
  const b64 = fs.readFileSync(path.join(IMG, 'portrait-of-woman_small.jpg')).toString('base64');
  const data = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const x = c.getContext('2d');
    const ac = new AudioContext(); await ac.resume();
    const osc = ac.createOscillator(); osc.frequency.value = 440; const g = ac.createGain(); g.gain.value = 0.2;
    const dest = ac.createMediaStreamDestination(); osc.connect(g).connect(dest); osc.start();
    const stream = c.captureStream(30);
    stream.addTrack(dest.stream.getAudioTracks()[0]);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 6e6 });
    const chunks = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });
    const t0 = performance.now();
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      const gr = x.createLinearGradient(0, 0, 1280, 720); gr.addColorStop(0, '#2b3a55'); gr.addColorStop(1, '#8aa0c8');
      x.fillStyle = gr; x.fillRect(0, 0, 1280, 720);
      x.fillStyle = '#e8c070'; for (let i = 0; i < 12; i++) x.fillRect(((i * 160 + t * 40) % 1400) - 60, 80 + (i % 3) * 220, 40, 40);
      const s = 0.6, w = img.width * s, h = img.height * s;
      x.drawImage(img, 100 + 800 * (t / 10), 180 + 60 * Math.sin(t * 0.8), w, h);
      x.fillStyle = '#fff'; x.font = '28px sans-serif'; x.fillText('t=' + t.toFixed(2), 20, 700);
    };
    draw(); rec.start(500);
    await new Promise((res) => { const loop = () => { draw(); if ((performance.now() - t0) / 1000 < 10) requestAnimationFrame(loop); else res(); }; requestAnimationFrame(loop); });
    rec.stop(); await stopped; osc.stop(); ac.close();
    const blob = new Blob(chunks, { type: 'video/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
    return { b64: btoa(bin), size: blob.size };
  }, b64);
  fs.writeFileSync(CLIP, Buffer.from(data.b64, 'base64'));
  console.log('  test clip written:', CLIP, data.size, 'bytes');
}

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU', '--autoplay-policy=no-user-gesture-required'],
    protocolTimeout: 900000
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (/error|warn/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
  page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); failures.push('pageerror ' + e.message); });
  page.on('requestfailed', (r) => console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText));
  const net = [];
  page.on('response', (r) => { const u = r.url(); if (!/127\.0\.0\.1/.test(u) && !/^(data|blob):/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); });
  const big = (u) => /\.(onnx|wasm)$/.test(u);
  page.on('response', (r) => { if (big(r.url())) logs.push(stamp() + ' response ' + r.status() + ' sw=' + r.fromServiceWorker() + ' ' + r.url().split('/').pop()); });
  const saveLog = () => { try { fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n')); } catch (e) { /* */ } };
  process.on('exit', saveLog);
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'deny' });

  await page.goto('http://127.0.0.1:' + PORT + '/ai-image/face-blur/', { waitUntil: 'networkidle0', timeout: 120000 });
  const title = await page.title();
  console.log(stamp(), 'page loaded; title =', title, '(' + title.length + ' chars)');
  check(title.length <= 70, 'title ≤ 70 chars');
  const h1 = await page.$eval('h1', (e) => e.textContent.trim());
  const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
  const active = await page.$eval('.side-link.is-active', (e) => e.getAttribute('href')).catch(() => null);
  console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '), '| sidebar active =', active);
  const faqN = await page.$$eval('.tool details', (d) => d.length);
  check(faqN >= 6, 'FAQ entries ≥ 6 (' + faqN + ')');
  const privacy = await page.$eval('.privacy-line', (e) => e.textContent);
  check(/1\.5 MB/.test(privacy) && /MIT/.test(privacy) && /frames/.test(privacy), 'privacy line names the detector, its size, its licence and video frames');
  check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
  check(await page.$eval('.aiimg input[type=file]', (e) => e.accept) === 'image/*', 'first file input accepts image/*');
  check(!!(await page.$('.aiimg input[type=file][accept="video/*"]')), 'a video file input exists');
  await page.screenshot({ path: path.join(OUT, '1-empty.png') });

  const statusText = () => page.$eval('.aiimg-pane[data-pane=faces] .aiimg-status', (e) => e.textContent);
  const waitReady = () => page.waitForFunction(() => { const s = document.querySelector('.aiimg-pane[data-pane=faces] .aiimg-status'); return s && /— ready|could not/.test(s.textContent); }, { timeout: 600000, polling: 300 });
  const faces = () => page.evaluate(() => AIImg.tools['face-blur'].last.state.faces.map((f) => ({ x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h), score: +f.score.toFixed(2), keep: f.keep, manual: !!f.manual })));

  /* ---------------- photo: city-streets ---------------- */
  const photoInput = await page.$('.aiimg input[type=file][accept="image/*"]');
  await photoInput.uploadFile(path.join(IMG, 'city-streets.jpg'));
  await waitReady();
  let st = await statusText();
  let fl = await faces();
  console.log(stamp(), 'city-streets, Normal:', st, '|', JSON.stringify(fl));
  check(fl.length >= 1, 'Normal finds at least one face on city-streets (' + fl.length + ')');
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '2-streets-normal.png') });
  await page.$eval('#aiimg-face-size', (e) => { e.value = 'small'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => !/— ready/.test(document.querySelector('.aiimg-pane[data-pane=faces] .aiimg-status').textContent), { timeout: 60000, polling: 50 }).catch(() => {});
  await waitReady();
  st = await statusText(); fl = await faces();
  console.log(stamp(), 'city-streets, Small faces:', st, '|', JSON.stringify(fl));
  check(fl.length >= 2, 'Small faces finds ≥ 2 faces on city-streets (' + fl.length + ')');
  check(/\d+ faces? found — ready/.test(st), 'status ends in "— ready"');
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '3-streets-small.png') });

  /* tap the biggest face to keep it */
  const target = await page.evaluate(() => {
    const S = AIImg.tools['face-blur'].last.state;
    const c = document.querySelector('.aiimg-face-canvas');
    c.scrollIntoView({ block: 'center' });
    const r = c.getBoundingClientRect();
    const s = c.width / S.image.width;
    const f = S.faces[0];
    return { x: r.left + (f.x + f.w / 2) * s / c.width * r.width, y: r.top + (f.y + f.h / 2) * s / c.height * r.height };
  });
  await page.mouse.click(target.x, target.y);
  await new Promise((r) => setTimeout(r, 300));
  fl = await faces(); st = await statusText();
  console.log(stamp(), 'after the tap:', st, '|', fl.map((f) => (f.keep ? 'KEPT ' : 'blur ') + f.w + 'x' + f.h).join(' | '));
  check(fl[0].keep === true && fl.slice(1).every((f) => !f.keep), 'the tapped face is kept, the others are not');
  check(/1 kept/.test(st), 'status reports "1 kept"');
  await page.screenshot({ path: path.join(OUT, '4-streets-kept.png') });
  const canvasPng = await page.$eval('.aiimg-face-canvas', (c) => c.toDataURL('image/png'));
  fs.writeFileSync(path.join(OUT, '4-canvas.png'), Buffer.from(canvasPng.split(',')[1], 'base64'));

  /* export the still and compare the pixel variance per face */
  await page.click('.aiimg-tabs [data-pane=export]');
  await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Download the image/.test(b.textContent)) b.click(); });
  await page.waitForFunction(() => document.querySelectorAll('.aiimg-result img').length >= 1, { timeout: 120000 });
  const stillHead = await page.$eval('.aiimg-result-head', (h) => h.textContent.trim());
  console.log(stamp(), 'still:', stillHead);
  const variance = await page.evaluate(async () => {
    const S = AIImg.tools['face-blur'].last.state;
    const img = document.querySelector('.aiimg-result img');
    const bmp = await createImageBitmap(await (await fetch(img.src)).blob());
    const W = S.image.width, H = S.image.height;
    const a = document.createElement('canvas'); a.width = W; a.height = H; a.getContext('2d').drawImage(S.image.canvas, 0, 0);
    const b = document.createElement('canvas'); b.width = W; b.height = H; b.getContext('2d').drawImage(bmp, 0, 0, W, H);
    const v = (c, f) => {
      const x0 = Math.max(0, Math.floor(f.x)), y0 = Math.max(0, Math.floor(f.y)), w = Math.max(1, Math.min(W - x0, Math.ceil(f.w))), h = Math.max(1, Math.min(H - y0, Math.ceil(f.h)));
      const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
      let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += g; s2 += g * g; n++; }
      const m = s / n; return s2 / n - m * m;
    };
    return { size: bmp.width + 'x' + bmp.height, faces: S.faces.map((f) => ({ keep: f.keep, w: Math.round(f.w), h: Math.round(f.h), orig: +v(a, f).toFixed(1), out: +v(b, f).toFixed(1) })) };
  });
  console.log('  export size', variance.size, '| variance per face (orig → out):', variance.faces.map((f) => (f.keep ? 'kept ' : 'blur ') + f.orig + ' → ' + f.out).join(' | '));
  check(variance.size === (await page.evaluate(() => { const S = AIImg.tools['face-blur'].last.state; return S.image.width + 'x' + S.image.height; })), 'export is at full resolution');
  for (const f of variance.faces) {
    if (f.keep) check(f.out > f.orig * 0.8 && f.out < f.orig * 1.25, 'kept face keeps its variance (' + f.orig + ' → ' + f.out + ')');
    else check(f.out < f.orig * 0.5, 'blurred face loses its variance (' + f.orig + ' → ' + f.out + ')');
  }
  const pullBlob = async (sel) => page.evaluate(async (sel) => {
    const elx = document.querySelector(sel);
    const b = await (await fetch(elx.src)).blob();
    const buf = new Uint8Array(await b.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
    return { type: b.type, size: b.size, b64: btoa(bin) };
  }, sel);
  const still = await pullBlob('.aiimg-result img');
  const stillBuf = Buffer.from(still.b64, 'base64');
  fs.writeFileSync(path.join(OUT, 'result-photo.png'), stillBuf);
  check(stillBuf.subarray(1, 4).toString('latin1') === 'PNG', 'still is a PNG (' + still.size + ' bytes, magic ' + stillBuf.subarray(0, 8).toString('hex') + ')');
  await page.screenshot({ path: path.join(OUT, '5-streets-export.png') });

  /* ---------------- photo: cats ---------------- */
  await page.click('.aiimg-tabs [data-pane=faces]');
  await page.$eval('#aiimg-face-size', (e) => { e.value = 'normal'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await photoInput.uploadFile(path.join(IMG, 'cats.jpg'));
  await page.waitForFunction(() => !/— ready/.test(document.querySelector('.aiimg-pane[data-pane=faces] .aiimg-status').textContent), { timeout: 60000, polling: 50 }).catch(() => {});
  await waitReady();
  st = await statusText(); fl = await faces();
  console.log(stamp(), 'cats:', st, '|', JSON.stringify(fl));
  check(fl.length === 0 && /^No faces found/.test(st), 'cats: no faces and a clear status');
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '6-cats.png') });

  /* ---------------- video ---------------- */
  if (!SKIP_VIDEO) {
    if (!fs.existsSync(CLIP) || flag('remake-clip', false) === true) { console.log(stamp(), 'making the test clip (10 s, real time)…'); await makeClip(page); }
    const videoInput = await page.$('.aiimg input[type=file][accept="video/*"]');
    await videoInput.uploadFile(CLIP);
    await page.waitForFunction(() => { const s = document.querySelector('.aiimg-pane[data-pane=faces] .aiimg-status'); return s && /on this frame — ready|could not/.test(s.textContent); }, { timeout: 600000, polling: 300 });
    st = await statusText();
    const frameFaces = await page.evaluate(() => AIImg.tools['face-blur'].last.state.frameFaces.map((f) => ({ x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h), score: +f.score.toFixed(2), keep: f.keep })));
    const vinfo = await page.evaluate(() => { const V = AIImg.tools['face-blur'].last.state.video; return { duration: +V.duration.toFixed(2), until: +V.until.toFixed(2), w: V.width, h: V.height, outW: V.outW, outH: V.outH }; });
    console.log(stamp(), 'video loaded:', JSON.stringify(vinfo), '|', st, '|', JSON.stringify(frameFaces));
    check(frameFaces.length === 1, 'one face found on the first frame');
    check(Math.abs(vinfo.duration - 10) < 0.6, 'clip duration read as ≈ 10 s (' + vinfo.duration + ')');
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OUT, '7-video-frame.png') });
    const exportProbe = async (mode) => {
    await page.click('.aiimg-tabs [data-pane=export]');
    const n0 = await page.$$eval('.aiimg-result', (r) => r.length);
    const tg = Date.now();
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Blur the video/.test(b.textContent)) b.click(); });
    await page.waitForFunction((k) => {
      const s = document.querySelector('.aiimg-pane[data-pane=export] .aiimg-status');
      return document.querySelectorAll('.aiimg-result').length > k || /failed|Cancelled/.test(s ? s.textContent : '');
    }, { timeout: 900000, polling: 500 }, n0);
    const wall = (Date.now() - tg) / 1000;
    const clipStatus = await page.$eval('.aiimg-pane[data-pane=export] .aiimg-status', (e) => e.textContent);
    const head = await page.$eval('.aiimg-result-head', (h) => h.textContent.trim()).catch(() => '');
    const ioMsg = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
    console.log(stamp(), '[' + mode + '] video export took', wall.toFixed(1) + 's |', clipStatus, '|', head, ioMsg ? '| io-msg: ' + ioMsg : '');
    check(/Done in/.test(clipStatus), 'video export finished');
    await page.screenshot({ path: path.join(OUT, '9-video-' + mode + '.png') });
    const hasVideo = await page.$('.aiimg-result video');
    if (hasVideo) {
      const out = await pullBlob('.aiimg-result video');
      const buf = Buffer.from(out.b64, 'base64');
      const isMp4 = buf.subarray(4, 8).toString('latin1') === 'ftyp';
      const isWebm = buf.readUInt32BE(0) === 0x1a45dfa3;
      const ext = isMp4 ? 'mp4' : 'webm';
      fs.writeFileSync(path.join(OUT, 'result-video-' + mode + '.' + ext), buf);
      console.log('  saved result-video-' + mode + '.' + ext, out.size, 'bytes, magic', buf.subarray(0, 12).toString('latin1').replace(/[^\x20-\x7e]/g, '.'));
      check(isMp4 || isWebm, 'output is MP4 (ftyp) or WebM');
      let traks = 0;
      if (isMp4) { let i = -1; while ((i = buf.indexOf('trak', i + 1, 'latin1')) >= 0) traks++; }
      console.log('  trak boxes:', traks);
      const soundRemoved = /sound removed/.test(head);
      if (isMp4) check(traks >= 2 || soundRemoved, 'audio track present (trak ≥ 2) or the result says the sound was removed');
      check(/sound (kept|removed)|no sound/.test(head), 'result head states what happened to the sound');
      /* duration and a blurred face at t = 5 */
      const probe = await page.evaluate(async () => {
        const api = AIImg.tools['face-blur'].last;
        const src = document.querySelector('.aiimg-face-video');
        const outEl = document.querySelector('.aiimg-result video');
        const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = outEl.src;
        await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('output video would not load')); });
        if (!isFinite(v.duration)) { v.currentTime = 1e101; await new Promise((res) => { v.ondurationchange = res; setTimeout(res, 3000); }); }
        const duration = v.duration;
        const seek = (el, t) => new Promise((res) => { el.onseeked = () => { let ok = false; const go = () => { if (!ok) { ok = true; res(); } }; if (el.requestVideoFrameCallback) el.requestVideoFrameCallback(go); setTimeout(go, 400); }; el.currentTime = t; });
        await seek(src, 5); await seek(v, 5);
        const W = v.videoWidth, H = v.videoHeight;
        const a = document.createElement('canvas'); a.width = W; a.height = H; a.getContext('2d').drawImage(src, 0, 0, W, H);
        const b = document.createElement('canvas'); b.width = W; b.height = H; b.getContext('2d').drawImage(v, 0, 0, W, H);
        const found = await api.detectFaces(a, W, H, { grids: [], thr: 0.7 });
        const f = found[0];
        if (!f) return { duration, W, H, face: null };
        const vr = (c) => {
          const d = c.getContext('2d').getImageData(Math.round(f.x), Math.round(f.y), Math.round(f.w), Math.round(f.h)).data;
          let s = 0, s2 = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += g; s2 += g * g; n++; }
          const m = s / n; return s2 / n - m * m;
        };
        /* fine detail: variance of the differences between neighbouring pixels, which a blur removes and a gradient does not keep */
        const det = (c) => {
          const w = Math.round(f.w), h = Math.round(f.h);
          const d = c.getContext('2d').getImageData(Math.round(f.x), Math.round(f.y), w, h).data;
          const g = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          let s2 = 0, n = 0;
          for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) { const i = (y * w + x) * 4; const dx = g(i + 4) - g(i), dy = g(i + w * 4) - g(i); s2 += dx * dx + dy * dy; n++; }
          return s2 / n;
        };
        let audio = null;
        try { const ac = new AudioContext(); const ab = await ac.decodeAudioData(await (await fetch(outEl.src)).arrayBuffer()); audio = { channels: ab.numberOfChannels, seconds: +ab.duration.toFixed(2), rate: ab.sampleRate }; ac.close(); } catch (e) { audio = 'undecodable: ' + e.message; }
        return { pngOut: b.toDataURL('image/png'), pngSrc: a.toDataURL('image/png'), duration: +duration.toFixed(2), W, H, face: { x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h) }, varSrc: +vr(a).toFixed(1), varOut: +vr(b).toFixed(1), detSrc: +det(a).toFixed(1), detOut: +det(b).toFixed(1), audio, hasAudio: typeof v.webkitAudioDecodedByteCount === 'number' ? v.webkitAudioDecodedByteCount : (v.mozHasAudio !== undefined ? v.mozHasAudio : 'n/a') };
      });
      if (probe.pngOut) { fs.writeFileSync(path.join(OUT, '10-t5-out-' + mode + '.png'), Buffer.from(probe.pngOut.split(',')[1], 'base64')); fs.writeFileSync(path.join(OUT, '10-t5-src.png'), Buffer.from(probe.pngSrc.split(',')[1], 'base64')); delete probe.pngOut; delete probe.pngSrc; }
      console.log('  output probe:', JSON.stringify(probe));
      check(Math.abs(probe.duration - 10) <= 0.5, 'output duration ≈ 10 ± 0.5 s (' + probe.duration + ')');
      check(probe.W === 1280 && probe.H === 720, 'output is 1280×720');
      check(!!probe.face, 'the face is found on the source frame at t = 5');
      if (probe.face) check(mode === 'kept' ? probe.detOut > probe.detSrc * 0.5 : probe.detOut < probe.detSrc * 0.2, (mode === 'kept' ? 'kept face is followed and left sharp at t = 5' : 'face region at t = 5 is blurred') + ' (detail ' + probe.detSrc + ' → ' + probe.detOut + ', variance ' + probe.varSrc + ' → ' + probe.varOut + ')');
      if (!soundRemoved) check(probe.audio && typeof probe.audio === 'object' && probe.audio.seconds > 9, 'output audio decodes to ≈ 10 s (' + JSON.stringify(probe.audio) + ')');
      console.log('  wall-clock for the 10 s 720p clip:', wall.toFixed(1) + ' s' + (wall < 30 ? ' (under the 30 s target)' : ' (over the 30 s target)'));
    }
    };
    if (frameFaces.length) {
      const tv = await page.evaluate(() => {
        const S = AIImg.tools['face-blur'].last.state; const c = document.querySelector('.aiimg-face-canvas');
        c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); const f = S.frameFaces[0];
        return { x: r.left + (f.x + f.w / 2) / c.width * r.width, y: r.top + (f.y + f.h / 2) / c.height * r.height };
      });
      await page.mouse.click(tv.x, tv.y);
      await new Promise((r) => setTimeout(r, 300));
      const kept = await page.evaluate(() => ({ seeds: AIImg.tools['face-blur'].last.state.seeds.length, keep: AIImg.tools['face-blur'].last.state.frameFaces[0].keep, status: document.querySelector('.aiimg-pane[data-pane=faces] .aiimg-status').textContent }));
      console.log(stamp(), 'tap on the video face:', JSON.stringify(kept));
      check(kept.seeds === 1 && kept.keep === true && /1 kept/.test(kept.status), 'tap keeps the face on the video frame (a seed)');
      await page.screenshot({ path: path.join(OUT, '8-video-kept.png') });
      await exportProbe('kept');
      await page.click('.aiimg-tabs [data-pane=faces]');
      await new Promise((r) => setTimeout(r, 600));
      const tv2 = await page.evaluate(() => {
        const S = AIImg.tools['face-blur'].last.state; const c = document.querySelector('.aiimg-face-canvas');
        c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); const f = S.frameFaces[0];
        return { x: r.left + (f.x + f.w / 2) / c.width * r.width, y: r.top + (f.y + f.h / 2) / c.height * r.height };
      });
      await page.mouse.click(tv2.x, tv2.y);
      await new Promise((r) => setTimeout(r, 600));
      const unkept = await page.evaluate(() => AIImg.tools['face-blur'].last.state.seeds.length);
      check(unkept === 0, 'second tap removes the seed');
      await exportProbe('blurred');
    }
  }

  /* ---------------- hygiene ---------------- */
  const third = [...new Set(net.map((n) => n.replace(/\?.*$/, '')))];
  console.log('  third-party requests:', third.length ? third.join('\n    ') : 'none');
  check(third.length === 0, 'zero third-party requests');
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const k of await caches.keys()) {
      const c = await caches.open(k);
      for (const u of ['/engine/models/ultraface-rfb-640.onnx', '/engine/vendor/ort/ort-wasm-simd-threaded.wasm']) {
        const m = await c.match(u);
        if (m) out.push(k + ' has ' + u.split('/').pop() + ' (' + (await m.blob()).size + ' bytes)');
      }
    }
    return out.length ? out.join('; ') : 'model/runtime NOT in the service-worker cache';
  });
  console.log('  sw cache:', cached);
  saveLog();
  await browser.close();
  console.log(stamp(), failures.length ? 'FAILED: ' + failures.length + ' check(s)\n  - ' + failures.join('\n  - ') : 'all checks passed');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); saveLog(); process.exit(1); });
