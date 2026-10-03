/*
 * Drives /ai-video/auto-captions/ in headless Chrome against a local
 * server and proves the pipeline end to end:
 *
 *   1. a WAV of known words (Windows TTS) is transcribed on the device; the
 *      transcript must contain "captions" and "browser" and at least 70% of
 *      the spoken words; the SRT has ≥ 2 cues with strictly increasing,
 *      non-overlapping times; the VTT starts with WEBVTT;
 *   2. a synthetic 1080×1920 video is made inside the page — moving shapes
 *      recorded with MediaRecorder from canvas.captureStream(30), with the
 *      WAV played into the same stream, so it has real speech — captioned
 *      and exported: the blob is an MP4 (ftyp) or WebM, its duration is
 *      within 0.5 s of the input, a mid-frame shows caption pixels in the
 *      chosen band, and the MP4 holds two trak boxes (sound preserved);
 *   3. no request left 127.0.0.1.
 *
 *   node build/ai-video/tests/auto-captions.js [--root <export dir>] [--port 8727]
 *        [--wav <speech.wav>] [--out <dir>] [--skip-video] [--recorder]
 *
 * With --root the test serves that directory itself; without it, a server
 * is expected on --port already. --recorder forces the MediaRecorder path
 * (what Firefox would do) instead of WebCodecs. Exits non-zero on failure.
 * Screenshots and console.log go to --out (default: build/ai-video/tests/out).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core'); }

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8727));
const ROOT = flag('root', null);
const WAV = flag('wav', 'E:/tmp/1234-agents/C7-captions/work/speech.wav');
const OUT = flag('out', path.join(__dirname, 'out'));
const SKIP_VIDEO = flag('skip-video', false) === true;
const RECORDER = flag('recorder', false) === true;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SENTENCE = 'Hello and welcome. This is a test of automatic captions for short videos. Nothing is uploaded, everything runs in the browser.';
fs.mkdirSync(OUT, { recursive: true });

const fails = [];
const check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (!ok) fails.push(what); };
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
function recall(known, got) {
  const pool = norm(got);
  let hit = 0;
  for (const w of norm(known)) { const i = pool.indexOf(w); if (i >= 0) { hit++; pool.splice(i, 1); } }
  return hit / norm(known).length;
}
function parseCues(text, vtt) {
  const cues = [];
  const re = vtt ? /(\d\d):(\d\d):(\d\d)\.(\d\d\d) --> (\d\d):(\d\d):(\d\d)\.(\d\d\d)/g : /(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)/g;
  let m;
  while ((m = re.exec(text))) {
    const t = (a, b, c, d) => Number(a) * 3600 + Number(b) * 60 + Number(c) + Number(d) / 1000;
    cues.push({ start: t(m[1], m[2], m[3], m[4]), end: t(m[5], m[6], m[7], m[8]) });
  }
  return cues;
}
function serve(root, port) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
  return new Promise((res) => {
    const s = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const abs = path.join(root, p);
      if (!abs.startsWith(path.resolve(root))) { r.writeHead(403); r.end(); return; }
      fs.stat(abs, (err, st) => {
        if (err || !st.isFile()) { r.writeHead(404); r.end('not found'); return; }
        r.writeHead(200, { 'Content-Type': TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
        fs.createReadStream(abs).pipe(r);
      });
    }).listen(port, '127.0.0.1', () => res(s));
  });
}

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const server = ROOT ? await serve(ROOT, PORT) : null;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--window-size=1400,1000', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebGPU'],
    protocolTimeout: 900000
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (/error|warn/i.test(m.type()) && !/beforeinstallprompt/.test(t)) console.log('  [console]', t.slice(0, 300)); });
  page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); });
  page.on('requestfailed', (r) => { logs.push('requestfailed ' + r.url()); console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText); });
  const net = [];
  page.on('response', (r) => { const u = r.url(); if (!/^(https?:\/\/127\.0\.0\.1|blob:|data:)/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); });
  const big = (u) => /\.(onnx|wasm|json)$/.test(u) && /models|vendor/.test(u);
  page.on('response', (r) => { if (big(r.url())) logs.push(stamp() + ' response ' + r.status() + ' ' + r.url().split('/').pop()); });
  const saveLog = () => { try { fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n')); } catch (e) { /* */ } };
  process.on('exit', saveLog);

  try {
    await page.goto('http://127.0.0.1:' + PORT + '/ai-video/auto-captions/', { waitUntil: 'networkidle0', timeout: 120000 });
    const title = await page.title();
    console.log(stamp(), 'page loaded; title =', title, '(' + title.length + ' chars)');
    check(title.length <= 70 && /^Auto Captions/.test(title), 'title ≤ 70 chars, keyword first');
    const h1 = await page.$eval('h1', (e) => e.textContent.trim());
    const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
    const active = await page.$eval('.side-link.is-active', (e) => e.getAttribute('href')).catch(() => null);
    console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '), '| sidebar active =', active);
    check(/Auto Captions/.test(h1), 'h1 names the tool');
    check(active === '/ai-video/', 'sidebar marks /ai-video/ active');
    check(crumbs.some((c) => /AI Video/.test(c)), 'breadcrumb has the section');
    const faq = await page.$$eval('article details', (d) => d.length);
    check(faq >= 6, 'FAQ has ≥ 6 entries (' + faq + ')');
    const privacy = await page.$eval('.privacy-line', (e) => e.textContent);
    check(/Whisper/.test(privacy) && /MB/.test(privacy) && /MIT/.test(privacy) && /browser/.test(privacy), 'privacy line names model, size, licence, browser');
    if (RECORDER) await page.evaluate(() => { window.AIImg.__forceRecorder = true; });
    const mounted = await page.$('.aiimg .dropzone');
    check(!!mounted, 'tool mounted');
    await page.screenshot({ path: path.join(OUT, '1-empty.png') });

    /* ---- part 1: the WAV ---- */
    const input = await page.$('.aiimg input[type=file]');
    const accept = await input.evaluate((e) => e.accept);
    check(accept === 'video/*,audio/*', 'file input accepts video/*,audio/*');
    await input.uploadFile(WAV);
    console.log(stamp(), 'uploaded', path.basename(WAV));
    const ready = () => page.waitForFunction(() => { const s = document.querySelector('.aiimg-pane[data-pane=words] .aiimg-status'); return s && (/ready$/.test(s.textContent.trim()) || /failed|could not|Cancelled/i.test(s.textContent)); }, { timeout: 600000, polling: 500 });
    const tw = Date.now();
    await ready();
    const status1 = await page.$eval('.aiimg-pane[data-pane=words] .aiimg-status', (e) => e.textContent.trim());
    console.log(stamp(), 'status:', status1, '| wall', ((Date.now() - tw) / 1000).toFixed(1) + 's');
    check(/ready$/.test(status1), 'status ends in "ready"');
    const ioMsg = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
    if (ioMsg) console.log('  io-msg:', ioMsg);
    const transcript = await page.$$eval('.aivid-seg-text', (t) => t.map((x) => x.value).join(' '));
    console.log('  transcript:', transcript);
    const rec = recall(SENTENCE, transcript);
    console.log('  word recall vs the spoken sentence: ' + Math.round(rec * 100) + '%');
    check(rec >= 0.7, 'word recall ≥ 70%');
    check(/captions/i.test(transcript), 'transcript contains "captions"');
    check(/browser/i.test(transcript), 'transcript contains "browser"');
    const srt = await page.evaluate(async () => { const a = document.querySelector('a[download$=".srt"]'); return a ? (await (await fetch(a.href)).text()) : ''; });
    const vtt = await page.evaluate(async () => { const a = document.querySelector('a[download$=".vtt"]'); return a ? (await (await fetch(a.href)).text()) : ''; });
    fs.writeFileSync(path.join(OUT, 'captions.srt'), srt); fs.writeFileSync(path.join(OUT, 'captions.vtt'), vtt);
    const cues = parseCues(srt, false);
    console.log('  SRT:', cues.length, 'cues;', srt.split('\n').filter((l) => / --> /.test(l)).length, '"-->" lines');
    console.log('  ' + srt.trim().split('\n').slice(0, 8).join('\n  '));
    check(cues.length >= 2, 'SRT has ≥ 2 cues');
    let mono = cues.length > 0;
    for (let i = 0; i < cues.length; i++) { if (cues[i].end <= cues[i].start) mono = false; if (i && cues[i].start < cues[i - 1].end) mono = false; }
    check(mono, 'SRT cues strictly increasing and non-overlapping');
    check(/^WEBVTT/.test(vtt), 'VTT starts with WEBVTT');
    check(parseCues(vtt, true).length === cues.length, 'VTT has the same cue count');
    await page.screenshot({ path: path.join(OUT, '2-transcript.png') });

    /* nudge + split + resplit do not break the files */
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aivid-seg-head button')) if (/\+0\.1/.test(b.textContent)) { b.click(); break; } });
    await page.evaluate(() => { const s = document.querySelector('#aivid-split-n'); s.value = '4'; s.dispatchEvent(new Event('change', { bubbles: true })); for (const b of document.querySelectorAll('.aivid-splitrow button')) if (/^Re-split$/.test(b.textContent)) b.click(); });
    const segsAfter = await page.$$eval('.aivid-seg', (s) => s.length);
    const srt2 = await page.evaluate(async () => { const a = document.querySelector('a[download$=".srt"]'); return a ? (await (await fetch(a.href)).text()) : ''; });
    const cues2 = parseCues(srt2, false);
    let mono2 = cues2.length > 0; for (let i = 1; i < cues2.length; i++) if (cues2[i].start < cues2[i - 1].end || cues2[i].end <= cues2[i].start) mono2 = false;
    check(segsAfter >= 4 && mono2, 'nudge + re-split into 4-word segments keeps the SRT monotonic (' + segsAfter + ' segments, ' + cues2.length + ' cues)');
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aivid-splitrow button')) if (/^Restore$/.test(b.textContent)) b.click(); });

    /* style pane screenshot */
    await page.click('.aiimg-tabs [data-pane=style]');
    await page.evaluate(() => { const r = document.querySelector('.aiimg-transport input[type=range]'); r.value = 300; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT, '3-style.png') });
    const previewPng = await page.$eval('.aivid-canvas', (c) => c.toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, '3-preview-canvas.png'), Buffer.from(previewPng.split(',')[1], 'base64'));

    if (!SKIP_VIDEO) {
      /* ---- part 2: a synthetic video with the same speech ---- */
      console.log(stamp(), 'making the synthetic 1080×1920 video in the page…');
      const wavB64 = fs.readFileSync(WAV).toString('base64');
      const made = await page.evaluate(async (b64) => {
        const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const ac = new AudioContext({ sampleRate: 48000 });
        const buf = await ac.decodeAudioData(u8.buffer.slice(0));
        const dest = ac.createMediaStreamDestination();
        const src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
        const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
        const x = c.getContext('2d');
        const stream = c.captureStream(30);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
        const mime = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        const stopped = new Promise((r) => { rec.onstop = r; });
        let running = true;
        const t0 = performance.now();
        /* moving shapes in the upper 60% only; the bottom 40% is a flat colour so caption pixels are measurable */
        (function frame() {
          const t = (performance.now() - t0) / 1000;
          x.fillStyle = '#243041'; x.fillRect(0, 0, 1080, 1920);
          x.fillStyle = '#1a2130'; x.fillRect(0, 1152, 1080, 768);
          for (let i = 0; i < 5; i++) {
            x.fillStyle = 'hsl(' + ((t * 40 + i * 70) % 360) + ' 70% 55%)';
            const cx = 540 + Math.sin(t * (0.7 + i * 0.2) + i) * 380, cy = 500 + Math.cos(t * (0.5 + i * 0.15) + i) * 380;
            x.beginPath(); x.arc(cx, cy, 90 + 40 * Math.sin(t + i), 0, Math.PI * 2); x.fill();
          }
          x.fillStyle = '#fff'; x.font = '700 60px Sora, Arial'; x.textAlign = 'center'; x.fillText('synthetic test clip ' + t.toFixed(1) + ' s', 540, 160);
          if (running) requestAnimationFrame(frame);
        })();
        rec.start(250);
        src.start(0);
        await new Promise((r) => { src.onended = r; setTimeout(r, buf.duration * 1000 + 1500); });
        await new Promise((r) => setTimeout(r, 300));
        running = false;
        rec.stop();
        await stopped;
        ac.close();
        const blob = new Blob(chunks, { type: mime });
        window.__synthetic = new File([blob], 'synthetic-test.webm', { type: 'video/webm' });
        return { size: blob.size, mime, duration: buf.duration };
      }, wavB64);
      console.log(stamp(), 'synthetic video:', made.size, 'bytes', made.mime, made.duration.toFixed(2) + 's');
      check(made.size > 50000, 'synthetic video recorded');
      await page.evaluate(() => {
        const input = document.querySelector('.aiimg input[type=file]');
        const dt = new DataTransfer(); dt.items.add(window.__synthetic);
        input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const tw2 = Date.now();
      await ready();
      const status2 = await page.$eval('.aiimg-pane[data-pane=words] .aiimg-status', (e) => e.textContent.trim());
      console.log(stamp(), 'status:', status2, '| wall', ((Date.now() - tw2) / 1000).toFixed(1) + 's');
      check(/ready$/.test(status2), 'video transcribed (status ends in "ready")');
      const transcript2 = await page.$$eval('.aivid-seg-text', (t) => t.map((x) => x.value).join(' '));
      console.log('  transcript:', transcript2);
      const rec2 = recall(SENTENCE, transcript2);
      console.log('  word recall: ' + Math.round(rec2 * 100) + '%');
      check(rec2 >= 0.7, 'video transcript recall ≥ 70%');
      const hasVideo = await page.evaluate(() => { const v = document.querySelector('.aivid-video'); return v && v.tagName === 'VIDEO' && v.videoWidth > 0 ? v.videoWidth + 'x' + v.videoHeight : 'no video track seen'; });
      console.log('  source seen as:', hasVideo);
      check(/^1080x1920$/.test(hasVideo), 'the video track was found (1080x1920)');

      /* export */
      await page.click('.aiimg-tabs [data-pane=export]');
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
      const hint = await page.$eval('.aiimg-pane[data-pane=export] .field-hint, .aiimg-pane[data-pane=export] .io-msg', (e) => e.textContent);
      console.log('  audio hint:', hint);
      const te = Date.now();
      await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Export the captioned video/.test(b.textContent)) b.click(); });
      await page.waitForFunction(() => { const st = document.querySelector('.aivid-exstatus'); return document.querySelectorAll('.aiimg-result').length >= 1 || /failed|Cancelled/.test(st ? st.textContent : ''); }, { timeout: 600000, polling: 500 });
      const exStatus = await page.$eval('.aivid-exstatus', (e) => e.textContent);
      const head = await page.$eval('.aiimg-result-head', (e) => e.textContent.trim()).catch(() => '');
      console.log(stamp(), 'export:', exStatus, '| head:', head, '| took', ((Date.now() - te) / 1000).toFixed(1) + 's');
      const ioMsg2 = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
      if (ioMsg2) console.log('  io-msg:', ioMsg2);
      check(!!head, 'a result row appeared');
      await page.screenshot({ path: path.join(OUT, '4-export.png') });

      const out = await page.evaluate(async () => {
        const v = document.querySelector('.aiimg-result video');
        const r = await fetch(v.src); const b = await r.blob();
        const buf = new Uint8Array(await b.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        /* duration and a mid frame, from a fresh element */
        const probe = document.createElement('video'); probe.muted = true; probe.playsInline = true; probe.src = v.src;
        await new Promise((res) => { probe.onloadedmetadata = res; probe.onerror = res; setTimeout(res, 10000); });
        const duration = probe.duration;
        const mid = isFinite(duration) ? duration / 2 : 5;
        /* a frame is not drawable on the tick the seek completes; give the decoder a moment */
        await new Promise((res) => { probe.onseeked = () => setTimeout(res, 250); probe.onerror = res; probe.currentTime = mid; setTimeout(res, 10000); });
        const c = document.createElement('canvas'); c.width = probe.videoWidth || 1080; c.height = probe.videoHeight || 1920;
        const x = c.getContext('2d'); x.drawImage(probe, 0, 0, c.width, c.height);
        const band = (y0, y1) => { const d = x.getImageData(0, Math.round(y0 * c.height), c.width, Math.round((y1 - y0) * c.height)).data; let s = 0, s2 = 0, n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)); };
        const png = c.toDataURL('image/png');
        return { type: b.type, size: b.size, b64: btoa(bin), duration, width: c.width, height: c.height, mid, bandStd: band(0.70, 0.86), quietStd: band(0.88, 0.99), png };
      });
      const ext = out.type === 'video/mp4' ? 'mp4' : 'webm';
      const f = path.join(OUT, 'result.' + ext);
      const bytes = Buffer.from(out.b64, 'base64');
      fs.writeFileSync(f, bytes);
      fs.writeFileSync(path.join(OUT, '5-output-midframe.png'), Buffer.from(out.png.split(',')[1], 'base64'));
      const magic = bytes.subarray(4, 8).toString('latin1');
      let traks = 0; for (let i = 0; i < bytes.length - 4; i++) if (bytes[i] === 0x74 && bytes[i + 1] === 0x72 && bytes[i + 2] === 0x61 && bytes[i + 3] === 0x6b) traks++;
      const ebml = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
      console.log('  saved', path.basename(f), out.size, 'bytes, type', out.type, '| magic', ebml ? 'EBML (WebM)' : magic, '| duration', out.duration, '| ' + out.width + 'x' + out.height, '| trak boxes', traks);
      console.log('  mid-frame (' + out.mid.toFixed(2) + ' s) caption band luminance std', out.bandStd.toFixed(1), '| band below it', out.quietStd.toFixed(1));
      check(magic === 'ftyp' || ebml, 'output is an MP4 (ftyp) or WebM (EBML)');
      check(Math.abs(out.duration - made.duration) <= 0.5, 'output duration within 0.5 s of the input (' + out.duration.toFixed(2) + ' vs ' + made.duration.toFixed(2) + ')');
      check(out.bandStd > 12 && out.bandStd > out.quietStd * 3, 'mid-frame shows caption pixels in the bottom band');
      if (magic === 'ftyp') check(traks >= 2, 'MP4 has ≥ 2 trak boxes (sound preserved)');
      else check(/sound/.test(head) && !/silent|no sound/.test(head), 'WebM result says it has sound');
      check(!/silent|no sound/.test(head), 'result head does not say the sound was removed');
      check(out.width === 1080 && out.height === 1920, 'output is 1080x1920');
    }

    console.log('  third-party requests:', [...new Set(net.map((n) => n.replace(/\?.*$/, '')))].slice(0, 12).join('\n    ') || 'none');
    check(net.length === 0, 'zero third-party requests');
  } catch (e) {
    console.error('ERROR', e);
    fails.push('exception: ' + (e && e.message));
    try { await page.screenshot({ path: path.join(OUT, 'error.png') }); } catch (e2) { /* */ }
  } finally {
    saveLog();
    await browser.close();
    if (server) server.close();
  }
  console.log('\n' + stamp(), fails.length ? 'FAILED: ' + fails.length + ' check(s)\n  - ' + fails.join('\n  - ') : 'all checks passed');
  process.exit(fails.length ? 1 : 0);
})();
