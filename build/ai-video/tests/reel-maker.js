/*
 * Drives /ai-video/reel-maker/ in headless Chrome against a local server
 * and proves the tool end to end:
 *
 *   1. the page: title, h1, sidebar, crumbs, FAQ, privacy line;
 *   2. script mode: "Try an example" → "Make my reel" → scenes and a total;
 *   3. deep links: ?tool=india/gst-calculator/ and ?tool=/pdf/merge-pdf/
 *      preselect the tool and write its script and end card; a hook frame
 *      drawn by renderFrame has text in the content band, a quiet top band
 *      and the accent colour; the QR payload carries the UTM link;
 *   4. ?preset=paper turns the look light;
 *   5. the caption copy: link-in-bio line, 3–8 hashtags (#gst, #1234tools),
 *      the share module's credit line; the bio link carries the UTMs;
 *   6. a voiceover WAV (Windows TTS) is transcribed by Whisper on the device;
 *   7. the export is an MP4 (ftyp) with two trak boxes, the right length and
 *      size, and captions drawn mid-reel; three frames are saved as PNG;
 *   8. the cover PNG is 1080×1920;
 *   9. a batch of two tools gives two MP4s and a captions file naming both;
 *  10. timing: a 15 s reel at 1080×1920, text only and with music;
 *  11. the microphone path, with Chrome's fake device;
 *  12. no request left 127.0.0.1 and no page error.
 * With --recorder, VideoEncoder and AudioEncoder are removed before the
 * page runs (what Firefox looks like): the export is recorded in real time
 * and the sound comes as a separate WAV with a warning that says so.
 *
 *   node build/ai-video/tests/reel-maker.js [--root <export dir>] [--port 8728]
 *        [--wav <speech.wav>] [--out <dir>] [--skip-video] [--skip-batch] [--recorder]
 *
 * Screenshots (desktop and 390 px phone, dark and light) and console.log go
 * to --out (default build/ai-video/tests/out-reel). Exits non-zero on failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core'); }

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8728));
const ROOT = flag('root', null);
const WAV_FLAG = flag('wav', null);
const OUT = path.resolve(flag('out', path.join(__dirname, 'out-reel')));
const SKIP_VIDEO = flag('skip-video', false) === true;
const SKIP_BATCH = flag('skip-batch', false) === true;
const RECORDER = flag('recorder', false) === true;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SENTENCE = 'Stop guessing your GST. Type the amount, pick the slab, and the split is done in your browser.';
const BASE = 'http://127.0.0.1:' + PORT;
fs.mkdirSync(OUT, { recursive: true });

function speechSample() {
  if (WAV_FLAG && WAV_FLAG !== true) return path.resolve(WAV_FLAG);
  if (process.platform !== 'win32') throw new Error('pass --wav <file>: the built-in speech synthesis needs Windows (PowerShell System.Speech)');
  const out = path.join(OUT, 'speech.wav');
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)',
    "$s.SetOutputToWaveFile('" + path.win32.normalize(out) + "', $f)",
    "$s.Speak('" + SENTENCE.replace(/'/g, "''") + "')",
    '$s.Dispose()'
  ].join('; ');
  const r = require('child_process').spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error('speech synthesis failed: ' + ((r.stderr || r.stdout || '').trim() || 'no output'));
  console.log('spoke the test sentence into ' + out + ' (' + fs.statSync(out).size + ' bytes)');
  return out;
}

const fails = [];
let passes = 0;
const check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (!ok) fails.push(what); else passes++; };
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
function recall(known, got) {
  const pool = norm(got);
  let hit = 0;
  for (const w of norm(known)) { const i = pool.indexOf(w); if (i >= 0) { hit++; pool.splice(i, 1); } }
  return hit / norm(known).length;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const countTraks = (b) => { let n = 0; for (let i = 0; i < b.length - 4; i++) if (b[i] === 0x74 && b[i + 1] === 0x72 && b[i + 2] === 0x61 && b[i + 3] === 0x6b) n++; return n; };
const isEbml = (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
const hashtags = (s) => (s.match(/#[A-Za-z0-9_]+/g) || []);
const { serve } = require('../../tests/serve.js');

/* In the page: fetch a blob URL, report its bytes, duration, size and frames at the given fractions. */
async function probe(page, src, fractions, band) {
  return page.evaluate(async (src, fractions, band) => {
    const r = await fetch(src); const b = await r.blob();
    const buf = new Uint8Array(await b.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = src;
    await new Promise((res) => { v.onloadedmetadata = res; v.onerror = res; setTimeout(res, 10000); });
    let duration = v.duration;
    if (!isFinite(duration)) { await new Promise((res) => { v.ondurationchange = () => { if (isFinite(v.duration)) res(); }; v.currentTime = 1e9; setTimeout(res, 5000); }); duration = v.duration; }
    const frames = [];
    for (const f of fractions) {
      const t = isFinite(duration) ? duration * f : 1;
      await new Promise((res) => { v.onseeked = () => setTimeout(res, 300); v.onerror = res; v.currentTime = t; setTimeout(res, 8000); });
      const c = document.createElement('canvas'); c.width = v.videoWidth || 1080; c.height = v.videoHeight || 1920;
      const x = c.getContext('2d'); x.drawImage(v, 0, 0, c.width, c.height);
      const std = (y0, y1) => { const d = x.getImageData(0, Math.round(y0 * c.height), c.width, Math.max(1, Math.round((y1 - y0) * c.height))).data; let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)); };
      frames.push({ t, std: band ? std(band[0], band[1]) : 0, png: c.toDataURL('image/png') });
    }
    return { type: b.type, size: b.size, b64: btoa(bin), duration, width: v.videoWidth, height: v.videoHeight, frames };
  }, src, fractions, band || null);
}
const savePng = (dataUrl, name) => fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
const clickText = (page, scope, re) => page.evaluate((scope, src) => {
  const re = new RegExp(src);
  for (const b of document.querySelectorAll(scope + ' button')) if (re.test(b.textContent.trim()) && !b.disabled && b.offsetParent !== null) { b.click(); return true; }
  return false;
}, scope, re.source);
const setTheme = (page, mode) => page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), mode);

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const WAV = speechSample();
  const server = ROOT ? await serve(ROOT, PORT) : null;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--window-size=1400,1000', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebGPU',
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    protocolTimeout: 1800000
  });
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write', 'microphone']);
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  const logs = [], errors = [], net = [];
  page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (/error|warn/i.test(m.type()) && !/beforeinstallprompt/.test(t)) console.log('  [console]', t.slice(0, 300)); });
  page.on('pageerror', (e) => { errors.push(e.message); logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); });
  page.on('request', (r) => { const u = r.url(); if (!/^(https?:\/\/127\.0\.0\.1[:/]|blob:|data:)/.test(u)) net.push(r.method() + ' ' + u.slice(0, 120)); });
  const saveLog = () => { try { fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n')); } catch (e) { /* */ } };
  process.on('exit', saveLog);
  /* every copy the page makes is also kept in window.__copied, so the test can read it without clipboard focus rules */
  await page.evaluateOnNewDocument((recorder) => {
    if (recorder) { try { delete window.VideoEncoder; delete window.AudioEncoder; } catch (e) { window.VideoEncoder = undefined; window.AudioEncoder = undefined; } }
    window.__copied = [];
    const cb = navigator.clipboard;
    if (cb && cb.writeText) { const orig = cb.writeText.bind(cb); cb.writeText = (t) => { window.__copied.push(String(t)); return orig(t).catch(() => {}); }; }
  }, RECORDER);
  const timings = {};

  const gotoTool = async (q) => {
    await page.goto(BASE + '/ai-video/reel-maker/' + (q || ''), { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForSelector('.aiimg .reel-start', { timeout: 20000 });
    /* the analytics consent bar would sit over the screenshots: decline it (nothing is sent either way here) */
    await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/^No thanks$/.test(b.textContent.trim()) && b.offsetParent) { b.click(); break; } });
  };
  const waitStudio = () => page.waitForFunction(() => { const s = document.querySelector('.aiimg-studio'); return s && !s.hidden && document.querySelectorAll('.reel-scene').length > 0; }, { timeout: 30000, polling: 200 });
  const pane = async (k) => { await page.click('.aiimg-side .aiimg-tabs [data-pane=' + k + ']'); await sleep(150); };
  const lastCopy = () => page.evaluate(() => window.__copied[window.__copied.length - 1] || '');
  const readClipboard = () => page.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e.message; } });
  const waitExport = async (timeout) => {
    const n = await page.$$eval('.aiimg-result video', (v) => v.length);
    return page.waitForFunction((n) => {
      const st = document.querySelector('.reel-exstatus');
      return document.querySelectorAll('.aiimg-result video').length > n || /failed|Cancelled/.test(st ? st.textContent : '');
    }, { timeout: timeout || 600000, polling: 300 }, n);
  };

  try {
    /* ---- 1. the page ---- */
    await gotoTool('');
    const title = await page.title();
    console.log(stamp(), 'page loaded; title =', title, '(' + title.length + ' chars)');
    check(title.length <= 70 && /^Free Reel Maker/.test(title), 'title ≤ 70 chars and starts "Free Reel Maker"');
    const h1 = await page.$eval('h1', (e) => e.textContent.trim());
    const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
    const active = await page.$eval('.side-link.is-active', (e) => e.getAttribute('href')).catch(() => null);
    check(/Reel Maker/.test(h1), 'h1 names the tool');
    check(active === '/ai-video/', 'sidebar marks /ai-video/ active');
    check(crumbs.some((c) => /AI Video/.test(c)), 'breadcrumb has the section (' + crumbs.join(' > ') + ')');
    const faq = await page.$$eval('article details', (d) => d.length);
    check(faq >= 8, 'FAQ has ≥ 8 entries (' + faq + ')');
    const privacy = await page.$eval('.privacy-line', (e) => e.textContent);
    check(/Whisper/.test(privacy) && /MB/.test(privacy) && /MIT/.test(privacy) && /watermark/.test(privacy), 'privacy line names Whisper, MB, MIT, watermark');
    check(!/100% private|no third-party (requests|server)/i.test(privacy), 'privacy line makes no blanket third-party claim');

    if (!RECORDER) {
      /* ---- 2. script mode ---- */
      check(!!(await page.$('#reel-script')), 'script textarea present');
      await clickText(page, '.reel-start', /^Try an example$/);
      const lines = await page.$eval('#reel-script', (t) => t.value.split('\n').filter((l) => l.trim()).length);
      check(lines >= 3, '"Try an example" fills ≥ 3 lines (' + lines + ')');
      await page.screenshot({ path: path.join(OUT, '1-start.png') });
      await clickText(page, '.reel-start', /^Make my reel$/);
      await waitStudio();
      const n2 = await page.$$eval('.reel-scene', (s) => s.length);
      const total2 = await page.$eval('#reel-total', (e) => e.textContent);
      check(n2 >= 3, 'script makes ≥ 3 scenes (' + n2 + ')');
      check(/\d+ scenes · [\d.]+ s/.test(total2), '#reel-total reads "' + total2 + '"');
      await sleep(1200);
      await page.screenshot({ path: path.join(OUT, '3-studio-script.png') });
      const scriptCap = await page.evaluate(() => AIImg.tools['reel-maker'].captionFor());
      console.log('  script-mode caption:\n    ' + scriptCap.split('\n').join('\n    '));
      check(hashtags(scriptCap).length >= 1 && !/#1234tools/i.test(scriptCap), 'script-mode caption has its own hashtags and none of ours');
    }

    /* ---- 3. deep links ---- */
    await gotoTool('?tool=india/gst-calculator/');
    await waitStudio();
    await page.waitForSelector('.reel-chosen:not([hidden])', { timeout: 20000 });
    const chosen = await page.$eval('.reel-chosen', (e) => e.textContent);
    check(/GST Calculator/.test(chosen), '?tool= preselects "GST Calculator" (' + chosen.slice(0, 60) + ')');
    const types = await page.$$eval('.reel-scene', (s) => s.map((x) => x.dataset.type));
    check(types.length >= 5 && types[types.length - 1] === 'endcard', 'promote script has ≥ 5 scenes ending in an end card (' + types.join(',') + ')');
    const sceneTexts = await page.$$eval('.reel-scene-text', (t) => t.map((x) => x.value));
    console.log('  GST script:\n    ' + sceneTexts.map((s) => s.replace(/\n/g, ' / ')).join('\n    '));
    await sleep(800);
    const mid = await page.evaluate(async () => {
      await document.fonts.ready;
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const t = 0.75 * S.scenes[0].seconds;
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d');
      T.renderFrame(x, 1080, 1920, t);
      const std = (y0, y1) => { const d = x.getImageData(0, Math.round(y0 * 1920), 1080, Math.round((y1 - y0) * 1920)).data; let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)); };
      const all = x.getImageData(0, 0, 1080, 1920).data;
      let gold = 0; for (let i = 0; i < all.length; i += 4) if (Math.abs(all[i] - 0xf7) <= 12 && Math.abs(all[i + 1] - 0xc9) <= 12 && Math.abs(all[i + 2] - 0x48) <= 12) gold++;
      const qr = T.qrUrlFor(S.promote.path, 'instagram');
      const D = S.scenes.reduce((s, x) => s + x.seconds, 0);
      const e = document.createElement('canvas'); e.width = 1080; e.height = 1920; T.renderFrame(e.getContext('2d'), 1080, 1920, D - 0.05);
      /* scan the QR on the end card: the white plate is the only pure-white thing; sample every module centre and decode */
      const ed = e.getContext('2d').getImageData(0, 0, 1080, 1920).data;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < 1920; y++) for (let x = 0; x < 1080; x++) { const i = (y * 1080 + x) * 4; if (ed[i] === 255 && ed[i + 1] === 255 && ed[i + 2] === 255) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      let scanned = 'no plate';
      if (x1 > x0) {
        const size = (x1 - x0 + 1) / 1.12, pad = size * 0.06, n = QR.encode(qr, 'M').size + 4, mod = size / n;
        const m = [];
        for (let r = 2; r < n - 2; r++) { const rowM = []; for (let col = 2; col < n - 2; col++) { const px = Math.round(x0 + pad + (col + 0.5) * mod), py = Math.round(y0 + pad + (r + 0.5) * mod); const i = (py * 1080 + px) * 4; rowM.push((ed[i] + ed[i + 1] + ed[i + 2]) / 3 < 128 ? 1 : 0); } m.push(rowM); }
        const got = QR.decode(m);
        scanned = got.ok ? got.text : 'ERR ' + got.error;
      }
      return { t, band: std(0.20, 0.70), top: std(0.02, 0.10), gold, png: c.toDataURL('image/png'), end: e.toDataURL('image/png'), qr, scanned, hook: S.scenes[0].text };
    });
    savePng(mid.png, '5-midframe.png'); savePng(mid.end, '5-endcard-frame.png');
    console.log('  hook "' + mid.hook.replace(/\n/g, ' / ') + '" at ' + mid.t.toFixed(2) + ' s: band std ' + mid.band.toFixed(1) + ', top std ' + mid.top.toFixed(1) + ', gold px ' + mid.gold);
    check(mid.band > 25, 'hook frame: content band [0.20H, 0.70H] luminance std > 25');
    check(mid.top < 8, 'hook frame: band [0.02H, 0.10H] std < 8');
    check(mid.gold >= 200, 'hook frame: accent #f7c948 on ≥ 200 pixels (' + mid.gold + ')');
    check(mid.qr === 'https://www.1234tools.com/india/gst-calculator/?utm_source=instagram&utm_medium=social&utm_campaign=india&utm_content=gst-calculator', 'QR payload is the UTM link (' + mid.qr + ')');
    check(mid.scanned === mid.qr, 'the QR drawn on the end card scans back to the UTM link (' + mid.scanned + ')');

    await gotoTool('?tool=' + encodeURIComponent('/pdf/merge-pdf/'));
    await waitStudio();
    await page.waitForSelector('.reel-chosen:not([hidden])', { timeout: 20000 });
    const chosen2 = await page.$eval('.reel-chosen', (e) => e.textContent);
    const texts2 = await page.$$eval('.reel-scene-text', (t) => t.map((x) => x.value));
    const types2 = await page.$$eval('.reel-scene', (s) => s.map((x) => x.dataset.type));
    console.log('  Merge PDF script:\n    ' + texts2.map((s) => s.replace(/\n/g, ' / ')).join('\n    '));
    check(/Merge PDF Files/.test(chosen2), '?tool=/pdf/merge-pdf/ (leading slash, encoded) preselects Merge PDF Files');
    check(types2.length >= 5 && types2[types2.length - 1] === 'endcard' && texts2.some((t) => /PDFs/.test(t)), 'Merge PDF auto-script has the io scene and an end card');
    check(!texts2.some((t) => /100% private|no third-party|unlimited/i.test(t)), 'auto-script makes no forbidden claim');
    const aiFacts = await page.evaluate(() => { const T = AIImg.tools['reel-maker']; const r = FINDER_INDEX.tools.find((x) => /^ai\//.test(x[1])); const sc = T.buildScript(r, { endcard: true }); return { title: r[0], texts: sc.map((s) => s.text || s.title) }; });
    console.log('  /ai/ tool script (' + aiFacts.title + '):\n    ' + aiFacts.texts.map((s) => String(s).replace(/\n/g, ' / ')).join('\n    '));
    check(aiFacts.texts.some((t) => /AI model/.test(t)) && aiFacts.texts.some((t) => /10 free/.test(t)) && !aiFacts.texts.some((t) => /on your device|in your browser|offline|unlimited/i.test(t)), '/ai/ tool script says it sends text to an AI model, 10 free a month, never on-device');

    /* ---- 4. ?preset=paper ---- */
    await gotoTool('?tool=india/gst-calculator/&preset=paper');
    await waitStudio();
    await sleep(500);
    const paper = await page.evaluate(() => {
      const chip = document.querySelector('.aiimg-presets .chip[data-preset=paper]');
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d');
      T.renderFrame(x, 1080, 1920, 0.75 * S.scenes[0].seconds);
      const d = x.getImageData(0, 0, 1080, 1920).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return { pressed: chip && chip.getAttribute('aria-pressed'), mean: s / (d.length / 4), png: c.toDataURL('image/png') };
    });
    savePng(paper.png, '5-paper-frame.png');
    check(paper.pressed === 'true', '?preset=paper marks the Paper chip pressed');
    check(paper.mean > 180, 'paper frame mean luminance > 180 (' + paper.mean.toFixed(0) + ')');

    if (RECORDER) {
      /* ---- recorder path ---- */
      await gotoTool('?tool=india/gst-calculator/');
      await waitStudio();
      await pane('captions');
      await page.select('#reel-cap-source', 'none');
      await pane('sound');
      const vin = await page.$('#reel-voice-file');
      await vin.uploadFile(WAV);
      await page.waitForFunction(() => /Voice/.test(document.querySelector('#reel-sound-status').textContent), { timeout: 60000 });
      await page.select('#reel-cap-source', 'none').catch(() => {});
      await pane('export');
      const hint = await page.$eval('.aiimg-pane[data-pane=export] .field-hint', (e) => e.textContent);
      check(/real time/.test(hint) && /WAV/.test(hint), 'export hint explains the real-time WebM and the separate WAV');
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
      const te = Date.now();
      await page.click('#reel-export');
      await waitExport(300000);
      console.log(stamp(), 'recorder export took', ((Date.now() - te) / 1000).toFixed(1) + 's');
      const rows = await page.$$eval('.aiimg-result', (r) => r.map((x) => x.dataset.name));
      console.log('  results:', rows.join(', '));
      const vid = await page.$eval('.aiimg-result video', (v) => v.src);
      const p = await probe(page, vid, [0.3]);
      const bytes = Buffer.from(p.b64, 'base64');
      fs.writeFileSync(path.join(OUT, 'recorder.' + (isEbml(bytes) ? 'webm' : 'mp4')), bytes);
      console.log('  recorded:', p.type, p.size, 'bytes,', isEbml(bytes) ? 'EBML (WebM)' : bytes.subarray(4, 8).toString('latin1'), ', duration', p.duration);
      check(isEbml(bytes) || bytes.subarray(4, 8).toString('latin1') === 'ftyp', 'recorder export is WebM (or MediaRecorder MP4)');
      const wav = rows.find((n) => /-sound\.wav$/.test(n));
      check(!!wav, 'a reel-…-sound.wav row exists');
      if (wav) {
        const magic = await page.evaluate(async (n) => { const a = document.querySelector('.aiimg-result[data-name="' + n + '"] a[download]'); const b = new Uint8Array(await (await fetch(a.href)).arrayBuffer()); return String.fromCharCode(b[0], b[1], b[2], b[3]); }, wav);
        check(magic === 'RIFF', 'the WAV starts with RIFF');
      }
      const warn = await page.$eval('.aiimg > .io-msg', (e) => ({ cls: e.className, text: e.textContent }));
      check(/is-warn/.test(warn.cls) && /WAV/.test(warn.text), '.io-msg is a warning that mentions the WAV');
      await page.screenshot({ path: path.join(OUT, 'recorder-export.png') });
    } else {
      /* ---- 5. caption and bio link ---- */
      await gotoTool('?tool=india/gst-calculator/');
      await waitStudio();
      await pane('export');
      await page.click('#reel-copy-caption');
      await sleep(400);
      const cap = await lastCopy();
      const clip = await readClipboard();
      fs.writeFileSync(path.join(OUT, 'caption.txt'), cap);
      console.log('  caption:\n    ' + cap.split('\n').join('\n    '));
      /* headless Chrome may refuse clipboard reads without window focus; the wrapper above saw the exact text written */
      if (clip && !/^ERR/.test(clip)) check(clip.replace(/\r\n/g, '\n') === cap, 'the system clipboard holds the same caption' + (clip.replace(/\r\n/g, '\n') === cap ? '' : ' (read ' + JSON.stringify(clip.slice(0, 80)) + ')'));
      else console.log('  (system clipboard not readable here: ' + (clip || 'empty') + '; using the text the page wrote)');
      const tags = hashtags(cap);
      check(/1234tools\.com\/india\/gst-calculator\//.test(cap), 'caption has 1234tools.com/india/gst-calculator/');
      check(cap.split('\n').some((l) => /link in bio/i.test(l)), 'caption has a "link in bio" line');
      check(tags.length >= 3 && tags.length <= 8, 'caption has 3–8 hashtags (' + tags.length + ': ' + tags.join(' ') + ')');
      check(tags.length >= 5, 'caption has ≥ 5 hashtags (copy-spec)');
      check(tags.some((t) => /^#gst$/i.test(t)) && tags.some((t) => /^#1234tools$/i.test(t)), 'caption tags include #GST and #1234Tools');
      check(/Made free, on my device:/.test(cap), 'caption ends with the share module credit line');
      check(!/100% private|no third-party|unlimited/i.test(cap), 'caption makes no forbidden claim');
      await page.click('#reel-copy-link');
      await sleep(300);
      const bio = await lastCopy();
      check(/utm_source=instagram&utm_medium=social&utm_campaign=india&utm_content=gst-calculator/.test(bio), 'bio link carries the UTMs (' + bio + ')');
      await page.screenshot({ path: path.join(OUT, '4-export.png') });

      /* ---- 6. voice + Whisper ---- */
      await pane('sound');
      const vin = await page.$('#reel-voice-file');
      await vin.uploadFile(WAV);
      console.log(stamp(), 'uploaded', path.basename(WAV), 'as the voiceover');
      await page.waitForFunction(() => { const s = document.querySelector('#reel-cap-status'); const t = s ? s.textContent.trim() : ''; return /ready$/.test(t) || /No speech|failed|Cancelled/.test(t); }, { timeout: 600000, polling: 500 });
      const capStatus = await page.$eval('#reel-cap-status', (e) => e.textContent.trim());
      console.log(stamp(), 'captions:', capStatus);
      const speechOk = /ready$/.test(capStatus);
      check(speechOk, '#reel-cap-status ends in "ready"');
      const transcript = await page.$$eval('.aivid-seg-text', (t) => t.map((x) => x.value).join(' '));
      const segs = await page.$$eval('.aivid-seg', (s) => s.length);
      const rc = recall(SENTENCE, transcript);
      console.log('  transcript (' + segs + ' segments): ' + transcript + ' | recall ' + Math.round(rc * 100) + '%');
      check(rc >= 0.7, 'voice transcript recall ≥ 70%');
      check(segs >= 2, '≥ 2 caption segments (' + segs + ')');
      const sound = await page.$eval('#reel-sound-status', (e) => e.textContent);
      check(/Voice/.test(sound), '#reel-sound-status mentions the voice (' + sound + ')');
      await pane('scenes');
      await page.click('#reel-fit');
      await sleep(300);
      const totalTxt = await page.$eval('#reel-total', (e) => e.textContent);
      const expectD = Number((/· ([\d.]+) s/.exec(totalTxt) || [])[1]);
      console.log('  after "Fit scenes to the voice":', totalTxt);
      await page.screenshot({ path: path.join(OUT, '3-studio.png') });

      if (!SKIP_VIDEO) {
        /* ---- 7. export ---- */
        await pane('export');
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
        const te = Date.now();
        await page.click('#reel-export');
        await waitExport();
        const took = (Date.now() - te) / 1000;
        const exStatus = await page.$eval('.reel-exstatus', (e) => e.textContent);
        const head = await page.$eval('.aiimg-result-head', (e) => e.textContent.trim()).catch(() => '');
        console.log(stamp(), 'export:', exStatus, '| head:', head, '| took', took.toFixed(1) + 's for', expectD, 's');
        timings.voiceReel = { seconds: took, D: expectD };
        const src = await page.$eval('.aiimg-result video', (v) => v.src);
        /* captions are on from the voice offset to its end; 45% of the fitted reel is inside the speech */
        const p = await probe(page, src, [0.15, 0.45, 0.97], [0.70, 0.86]);
        const bytes = Buffer.from(p.b64, 'base64');
        fs.writeFileSync(path.join(OUT, 'reel-gst-calculator.mp4'), bytes);
        p.frames.forEach((f, i) => savePng(f.png, 'frame-' + (i + 1) + '-' + f.t.toFixed(1) + 's.png'));
        const magic = bytes.subarray(4, 8).toString('latin1');
        const traks = countTraks(bytes);
        console.log('  mp4:', p.size, 'bytes | magic', magic, '| trak', traks, '| duration', p.duration, '| ' + p.width + 'x' + p.height, '| caption band std at 45%:', p.frames[1].std.toFixed(1));
        check(magic === 'ftyp', 'export is an MP4 (ftyp)');
        check(traks >= 2, 'MP4 has ≥ 2 trak boxes (voice muxed in)');
        check(Math.abs(p.duration - expectD) <= 0.5, 'duration within 0.5 s of #reel-total (' + p.duration.toFixed(2) + ' vs ' + expectD + ')');
        check(p.width === 1080 && p.height === 1920, 'export is 1080×1920');
        if (speechOk) check(p.frames[1].std > 12, 'frame at 45% has captions in [0.70H, 0.86H] (std ' + p.frames[1].std.toFixed(1) + ')');
        check(/AAC|Opus/.test(head), 'result head names the audio codec');
        await page.screenshot({ path: path.join(OUT, '4-export-done.png') });

        /* ---- 8. cover ---- */
        await page.select('#reel-cover-format', 'image/png');
        await page.click('#reel-cover');
        await page.waitForFunction(() => !!document.querySelector('.aiimg-result img'), { timeout: 30000 });
        const cover = await page.evaluate(async () => {
          const im = document.querySelector('.aiimg-result img');
          await (im.decode ? im.decode().catch(() => {}) : null);
          const b = new Uint8Array(await (await fetch(im.src)).arrayBuffer());
          return { w: im.naturalWidth, h: im.naturalHeight, magic: Array.from(b.slice(0, 4)), name: im.closest('.aiimg-result').dataset.name };
        });
        check(cover.w === 1080 && cover.h === 1920, 'cover is 1080×1920 (' + cover.w + '×' + cover.h + ')');
        check(cover.magic[0] === 0x89 && cover.magic[1] === 0x50 && cover.magic[2] === 0x4e && cover.magic[3] === 0x47, 'cover is a PNG (' + cover.name + ')');
      }

      if (!SKIP_VIDEO && !SKIP_BATCH) {
        /* ---- 9. batch ---- */
        await page.click('.aiimg-transport .btn-ghost:last-child');
        await page.click('.reel-start [data-mode=promote]');
        await page.waitForSelector('.reel-tool', { timeout: 20000 });
        await page.screenshot({ path: path.join(OUT, '2-promote.png') });
        for (const label of ['Select GST Calculator (India)', 'Select Merge PDF Files']) {
          const ok = await page.evaluate((l) => { const c = document.querySelector('.reel-pick[aria-label="' + l + '"]'); if (!c) return false; c.click(); return c.checked; }, label);
          check(ok, 'ticked "' + label + '"');
        }
        const btn = await page.$eval('#reel-batch', (b) => ({ text: b.textContent, disabled: b.disabled }));
        check(btn.text === 'Make 2 reels' && !btn.disabled, 'batch button reads "Make 2 reels"');
        await page.click('#reel-batch');
        await page.waitForSelector('.reel-batch:not([hidden])', { timeout: 20000 });
        const before = await page.$$eval('.aiimg-result video', (v) => v.length);
        const tb = Date.now();
        await clickText(page, '.reel-batch', /^Start$/);
        await page.waitForFunction(() => { const s = document.querySelector('.reel-batch-status'); return s && /\d+ reels,|stopped|Cancelled/.test(s.textContent); }, { timeout: 900000, polling: 500 });
        const bs = await page.$eval('.reel-batch-status', (e) => e.textContent);
        console.log(stamp(), 'batch:', bs, '| took', ((Date.now() - tb) / 1000).toFixed(1) + 's');
        timings.batch2 = (Date.now() - tb) / 1000;
        check(/^2 reels, 2 covers and reel-captions\.txt/.test(bs), 'batch finished: "' + bs + '"');
        const vids = await page.$$eval('.aiimg-result', (r) => r.filter((x) => x.querySelector('video')).map((x) => ({ name: x.dataset.name, src: x.querySelector('video').src })));
        check(vids.length - before === 2, 'batch of 2 tools gave 2 clips (' + vids.map((v) => v.name).join(', ') + ')');
        for (const want of ['reel-gst-calculator.mp4', 'reel-merge-pdf.mp4']) {
          const v = vids.find((x) => x.name === want);
          if (!v) { check(false, want + ' is in the results'); continue; }
          const p = await probe(page, v.src, [0.1]);
          const b = Buffer.from(p.b64, 'base64');
          fs.writeFileSync(path.join(OUT, 'batch-' + want), b);
          check(b.subarray(4, 8).toString('latin1') === 'ftyp' && p.duration >= 12 && p.duration <= 30, want + ': ftyp, ' + p.duration.toFixed(1) + ' s (12–30)');
        }
        const caps = await page.evaluate(async () => { const a = document.querySelector('a[download="reel-captions.txt"]'); return a ? (await (await fetch(a.href)).text()) : ''; });
        fs.writeFileSync(path.join(OUT, 'reel-captions.txt'), caps);
        check(/GST Calculator \(India\)/.test(caps) && /Merge PDF Files/.test(caps), 'reel-captions.txt names both tools');
        const blocks = caps.split(/\n(?=Merge PDF Files\n)/);
        check(blocks.length === 2 && blocks.every((b) => /link in bio/i.test(b) && hashtags(b).length >= 3 && hashtags(b).length <= 8), 'each batch caption has a link-in-bio line and 3–8 hashtags');
        await page.screenshot({ path: path.join(OUT, '6-batch.png') });
      }

      if (!SKIP_VIDEO) {
        /* ---- 9b. pictures and clips: a PNG and a 3 s WebM made in the page, dropped into the media input ---- */
        await gotoTool('');
        await clickText(page, '.reel-start', /^Try an example$/);
        await clickText(page, '.reel-start', /^Make my reel$/);
        await waitStudio();
        await pane('media');
        const made = await page.evaluate(async () => {
          const pic = document.createElement('canvas'); pic.width = 900; pic.height = 1600;
          const px = pic.getContext('2d'); px.fillStyle = '#2a7fff'; px.fillRect(0, 0, 900, 1600); px.fillStyle = '#ffffff'; px.fillRect(150, 300, 600, 600);
          const png = await new Promise((r) => pic.toBlob(r, 'image/png'));
          const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const x = c.getContext('2d');
          const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 4e6 });
          const chunks = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          const stopped = new Promise((r) => { rec.onstop = r; });
          let run = true; const t0 = performance.now();
          (function f() { const t = (performance.now() - t0) / 1000; x.fillStyle = '#ff3d6e'; x.fillRect(0, 0, 1280, 720); x.fillStyle = '#ffe600'; x.fillRect(100 + t * 250, 260, 200, 200); if (run) requestAnimationFrame(f); })();
          rec.start(200); await new Promise((r) => setTimeout(r, 3000)); run = false; rec.stop(); await stopped;
          const dt = new DataTransfer();
          dt.items.add(new File([png], 'screenshot.png', { type: 'image/png' }));
          dt.items.add(new File([new Blob(chunks, { type: 'video/webm' })], 'clip.webm', { type: 'video/webm' }));
          const input = document.querySelector('#reel-media-file'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
          return chunks.length;
        });
        await page.waitForFunction(() => document.querySelectorAll('.reel-scene[data-type=media]').length >= 2, { timeout: 30000 });
        const media = await page.evaluate(() => { const S = AIImg.tools['reel-maker'].state(); const st = []; let s = 0; for (const sc of S.scenes) { st.push({ type: sc.type, kind: sc.media && sc.media.kind, fit: sc.fit, start: s, seconds: sc.seconds }); s += sc.seconds; } return { scenes: st, D: s }; });
        console.log('  media scenes:', JSON.stringify(media.scenes.filter((x) => x.type === 'media')), 'total', media.D.toFixed(1));
        const pic = media.scenes.find((x) => x.kind === 'image'), clipSc = media.scenes.find((x) => x.kind === 'video');
        check(made > 0 && pic && clipSc && pic.fit === 'phone' && clipSc.fit === 'card', 'a portrait PNG goes in a phone frame and a landscape clip in a card');
        await page.screenshot({ path: path.join(OUT, '8-media.png') });
        await pane('export');
        const clientM = await page.target().createCDPSession();
        await clientM.send('Page.setDownloadBehavior', { behavior: 'deny' });
        const tm = Date.now();
        await page.click('#reel-export');
        await waitExport();
        const headM = await page.$eval('.aiimg-result-head', (e) => e.textContent.trim()).catch(() => '');
        console.log(stamp(), 'media reel export:', ((Date.now() - tm) / 1000).toFixed(1) + 's |', headM);
        const srcM = await page.$eval('.aiimg-result video', (v) => v.src);
        const fr = (sc, f) => (sc.start + sc.seconds * f) / media.D;
        const pm = await probe(page, srcM, [fr(pic, 0.6), fr(clipSc, 0.3), fr(clipSc, 0.8)]);
        const bm = Buffer.from(pm.b64, 'base64');
        fs.writeFileSync(path.join(OUT, 'reel-media.mp4'), bm);
        pm.frames.forEach((f, i) => savePng(f.png, 'media-frame-' + (i + 1) + '.png'));
        const colours = await page.evaluate(async (pngs) => {
          const out = [];
          for (const p of pngs) {
            const im = new Image(); im.src = p; await im.decode();
            const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
            const d = x.getImageData(0, 0, c.width, c.height).data; let blue = 0, pink = 0, yellowX = 0, yellowN = 0;
            for (let i = 0, k = 0; i < d.length; i += 4, k++) {
              if (d[i] < 80 && d[i + 1] > 100 && d[i + 2] > 200) blue++;
              if (d[i] > 220 && d[i + 1] < 110 && d[i + 2] > 80 && d[i + 2] < 150) pink++;
              if (d[i] > 220 && d[i + 1] > 200 && d[i + 2] < 90) { yellowX += k % c.width; yellowN++; }
            }
            out.push({ blue, pink, yellowX: yellowN ? yellowX / yellowN : -1 });
          }
          return out;
        }, pm.frames.map((f) => f.png));
        console.log('  media frames:', JSON.stringify(colours));
        check(bm.subarray(4, 8).toString('latin1') === 'ftyp' && Math.abs(pm.duration - media.D) <= 0.5, 'media reel is an MP4 of the right length (' + pm.duration.toFixed(2) + ' vs ' + media.D.toFixed(2) + ')');
        check(colours[0].blue > 20000, 'the picture scene shows the picture (' + colours[0].blue + ' blue px)');
        check(colours[1].pink > 20000 && colours[2].pink > 20000, 'the clip scene shows the clip');
        check(colours[2].yellowX > colours[1].yellowX + 20, 'the clip plays inside its scene (moving square: x ' + Math.round(colours[1].yellowX) + ' → ' + Math.round(colours[2].yellowX) + ')');

        /* ---- 10. timing: a 15 s reel at 1080×1920 ---- */
        for (const withMusic of [false, true]) {
          await gotoTool('');
          await clickText(page, '.reel-start', /^Try an example$/);
          await clickText(page, '.reel-start', /^Make my reel$/);
          await waitStudio();
          await page.evaluate(() => { const ins = document.querySelectorAll('.reel-secs'); const each = 15 / ins.length; for (const i of ins) { i.value = String(each); i.dispatchEvent(new Event('change', { bubbles: true })); } });
          const tt = await page.$eval('#reel-total', (e) => e.textContent);
          if (withMusic) {
            await pane('sound');
            const m = await page.$('#reel-music-file');
            await m.uploadFile(WAV);
            await page.waitForFunction(() => /music/i.test(document.querySelector('#reel-sound-status').textContent), { timeout: 60000 });
          }
          await pane('export');
          const client = await page.target().createCDPSession();
          await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
          const te = Date.now();
          await page.click('#reel-export');
          await waitExport();
          const took = (Date.now() - te) / 1000;
          const head = await page.$eval('.aiimg-result-head', (e) => e.textContent.trim()).catch(() => '');
          const src = await page.$eval('.aiimg-result video', (v) => v.src);
          const p = await probe(page, src, [0.5]);
          const traks = countTraks(Buffer.from(p.b64, 'base64'));
          console.log(stamp(), '15 s timing' + (withMusic ? ' with music' : '') + ':', tt, '→', took.toFixed(1) + 's |', head, '| duration', p.duration.toFixed(2), '| trak', traks);
          timings[withMusic ? 'reel15music' : 'reel15'] = took;
          check(Math.abs(p.duration - 15) <= 0.5 && traks === (withMusic ? 2 : 1), '15 s reel' + (withMusic ? ' with music' : '') + ' exports at 15 s with ' + (withMusic ? 'two tracks' : 'one track'));
        }
      }

      /* ---- 11. the microphone, with Chrome's fake device ---- */
      await gotoTool('');
      await clickText(page, '.reel-start', /^Try an example$/);
      await clickText(page, '.reel-start', /^Make my reel$/);
      await waitStudio();
      await pane('captions');
      await page.select('#reel-cap-source', 'none');
      await pane('sound');
      await page.click('#reel-rec-voice');
      await sleep(600);
      const recState = await page.evaluate(() => ({ pressed: document.querySelector('#reel-rec-voice').getAttribute('aria-pressed'), prompter: !document.querySelector('.reel-prompter').hidden, items: document.querySelectorAll('.reel-prompter li').length }));
      await sleep(1800);
      await page.screenshot({ path: path.join(OUT, '7-recording.png') });
      await page.click('#reel-rec-voice');
      await page.waitForFunction(() => /^Voice/.test(document.querySelector('#reel-sound-status').textContent) || /refused|No microphone/.test(document.querySelector('.aiimg > .io-msg').textContent), { timeout: 30000 });
      const micStatus = await page.$eval('#reel-sound-status', (e) => e.textContent);
      check(recState.pressed === 'true' && recState.prompter && recState.items >= 3, 'recording shows the teleprompter (' + recState.items + ' lines)');
      check(/^Voice [\d.]+ s/.test(micStatus), 'a microphone recording becomes the voiceover (' + micStatus + ')');

      /* ---- screenshots: desktop and phone, dark and light ---- */
      await gotoTool('?tool=india/gst-calculator/');
      await waitStudio();
      await sleep(900);
      for (const theme of ['dark', 'light']) {
        await setTheme(page, theme);
        await sleep(200);
        await page.screenshot({ path: path.join(OUT, 'desktop-' + theme + '.png') });
      }
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await gotoTool('?tool=india/gst-calculator/');
      await waitStudio();
      await sleep(900);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 0, 'no horizontal scroll at 390 px (' + overflow + ')');
      for (const theme of ['dark', 'light']) {
        await setTheme(page, theme);
        await sleep(200);
        await page.evaluate(() => document.querySelector('.tool-io').scrollIntoView());
        await page.screenshot({ path: path.join(OUT, 'phone-' + theme + '.png') });
      }
      await setTheme(page, 'dark');
      await page.evaluate(() => document.querySelector('.aiimg-side').scrollIntoView());
      await page.screenshot({ path: path.join(OUT, 'phone-dark-panes.png') });
      await gotoTool('');
      await page.click('.reel-start [data-mode=promote]');
      await page.waitForSelector('.reel-tool', { timeout: 20000 });
      await page.screenshot({ path: path.join(OUT, 'phone-picker.png') });
      await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    }

    console.log('  third-party requests:', [...new Set(net)].slice(0, 12).join('\n    ') || 'none');
    check(net.length === 0, 'zero requests left 127.0.0.1');
    check(errors.length === 0, 'no page errors' + (errors.length ? ' (' + errors.slice(0, 3).join(' | ') + ')' : ''));
  } catch (e) {
    console.error('ERROR', e);
    fails.push('exception: ' + (e && e.message));
    try { await page.screenshot({ path: path.join(OUT, 'error.png') }); } catch (e2) { /* */ }
  } finally {
    saveLog();
    if (Object.keys(timings).length) { console.log('  timings:', JSON.stringify(timings)); fs.writeFileSync(path.join(OUT, 'timings.json'), JSON.stringify(timings, null, 2)); }
    await browser.close();
    if (server) server.close();
  }
  console.log('\n' + stamp(), passes + ' passed, ' + fails.length + ' failed' + (fails.length ? '\n  - ' + fails.join('\n  - ') : ' — all checks passed'));
  process.exit(fails.length ? 1 : 0);
})();
