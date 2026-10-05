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
 *  3a. the same tool twice (three times) gets different looks;
 *  3b. the story: GST makes hook, pain, usual, fix, example, steps, end card
 *      in that order from assets/stories.js (loaded on demand), the hook is
 *      the story's, the usual way carries its three frustrations, beats run
 *      1.6–4 s, the palettes pass the AA audit, the end-card QR reads back in
 *      three more looks, three caption shapes, the example degrades to the
 *      in → out line without assets/examples.js, and looks.png (every beat,
 *      settled and mid-motion, in three looks) is saved;
 *  3c. 8 palettes × treatments × motions at three sizes: no overflow flag,
 *      nothing under 20 px, nothing drawn in the 9:16 safe bands;
 *  3d. a fixture TOOL_EXAMPLES before/after is wiped: before left of the
 *      seam, after right of it, mid-wipe;
 *  3e. a batch of three is planned in three palettes;
 *   4. ?preset=paper turns the look light; 4b. each of the 7 visitor
 *      templates makes its own scenes with no overflow; Shuffle look works;
 *   5. the caption copy: link-in-bio line, 3–8 hashtags (#gst, #1234tools),
 *      the share module's credit line; the bio link carries the UTMs;
 *   6. a voiceover WAV (Windows TTS) is transcribed by Whisper on the device;
 *   7. the export is an MP4 (ftyp) with two trak boxes, the right length and
 *      size, and captions drawn mid-reel; three frames are saved as PNG;
 *   8. the cover PNG is 1080×1920;
 *   9. a batch of two tools gives two MP4s and a captions file naming both;
 *  10. timing: a 15 s reel at 1080×1920, text only and with music, and a
 *      20 s seven-beat story reel;
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
/*
 * In the page: does an exported video show each mark as the state says? At time t the
 * frame is compared, inside the mark's rectangle, with the page's own render of the
 * state (as) and of the state with that mark flipped (flip): the mark is as it should
 * be when `as` is well under `flip`. Also reads the MP4's metadata back.
 */
const marksInVideo = (page, src, t) => page.evaluate(async (src, t) => {
  const T = AIImg.tools['reel-maker']; const S = T.state();
  const buf = await (await fetch(src)).arrayBuffer();
  const tags = AIImg.readMP4Tags(buf);
  const v = document.createElement('video'); v.muted = true; v.src = src;
  await new Promise((r) => { v.onloadeddata = r; setTimeout(r, 8000); });
  await new Promise((r) => { v.onseeked = () => setTimeout(r, 250); v.currentTime = t; setTimeout(r, 8000); });
  const W = v.videoWidth, H = v.videoHeight;
  const grab = (draw) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); draw(x); return x; };
  const fr = grab((x) => x.drawImage(v, 0, 0, W, H));
  const X = Object.assign({}, S, { scenes: S.scenes.filter((sc) => sc.type !== 'endcard' || sc.title || S.brand.logo || S.brand.url || S.brand.handle) });
  const render = (Y) => grab((x) => T.renderFrame(x, W, H, t, Y));
  const flipAi = Object.assign({}, X, T.aiLabelOf(X) ? { voice: null, brand: Object.assign({}, X.brand, { aiLabel: false }) } : { brand: Object.assign({}, X.brand, { aiLabel: true }) });
  const flipCr = Object.assign({}, X, { brand: Object.assign({}, X.brand, { madeWith: !T.madeWithOn(X) }) });
  const rAi = T.marks(W, H, T.aiLabelOf(X) ? X : flipAi).ai, rCr = T.marks(W, H, T.madeWithOn(X) ? X : flipCr).credit;
  const mad = (a, b, r) => {
    const x0 = Math.floor(r.x), y0 = Math.floor(r.y), w = Math.ceil(r.w), h = Math.ceil(r.h);
    const d1 = a.getImageData(x0, y0, w, h).data, d2 = b.getImageData(x0, y0, w, h).data;
    let s = 0; for (let i = 0; i < d1.length; i += 4) s += (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2])) / 3;
    return s / (d1.length / 4);
  };
  const as = render(X);
  return { tags, W, H, duration: v.duration,
    ai: { on: !!T.aiLabelOf(X), as: mad(fr, as, rAi), flip: mad(fr, render(flipAi), rAi), rect: rAi },
    credit: { on: T.madeWithOn(X), as: mad(fr, as, rCr), flip: mad(fr, render(flipCr), rCr), rect: rCr } };
}, src, t);
const markOk = (m) => m.as < m.flip * 0.5;
const savePng = (dataUrl, name) => fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
/* The kits' looks, pinned, for the checks that need a known one. */
const MIDNIGHT = { palette: 'midnight', type: 'gradient', motion: 'pop', bg: 'glow', layout: 'classic' };
const TEMPLATE_TYPES = {
  problem: ['hook', 'pain', 'usual', 'fix', 'steps', 'cta'],
  beforeafter: ['hook', 'versus', 'text', 'steps', 'cta'],
  mistakes: ['hook', 'point', 'point', 'point', 'fix', 'cta'],
  myth: ['hook', 'versus', 'versus', 'text', 'cta'],
  howto: ['hook', 'point', 'point', 'point', 'steps', 'cta'],
  top5: ['hook', 'point', 'point', 'point', 'point', 'point', 'cta'],
  testimonial: ['hook', 'quote', 'pain', 'fix', 'cta']
};
/* In the page: pin a look (optional), render the last frame of the reel and read the QR on the end card's white plate back. */
const scanEndCard = (page, spec) => page.evaluate(async (spec) => {
  const T = AIImg.tools['reel-maker']; const S = T.state();
  if (spec) { T.current.setLook(spec); await T.current.prepare(); }
  const qr = T.qrUrlFor(S.promote.path, 'instagram');
  const D = S.scenes.reduce((s, x) => s + x.seconds, 0);
  const e = document.createElement('canvas'); e.width = 1080; e.height = 1920; T.renderFrame(e.getContext('2d'), 1080, 1920, D - 0.05);
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
  return { qr, scanned, look: S.look.name, png: e.toDataURL('image/png') };
}, spec || null);
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
    /* ---- 3a. variety: the same tool twice gets two different looks ---- */
    const twice = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const a = Object.assign({}, S.look.spec), an = S.look.name;
      await T.current.usePromote(S.promote);
      const b = Object.assign({}, S.look.spec), bn = S.look.name;
      await T.current.usePromote(S.promote);
      const c = Object.assign({}, S.look.spec), cn = S.look.name;
      return { a, b, c, names: [an, bn, cn] };
    });
    console.log('  three GST reels in a row:\n    ' + twice.names.join('\n    '));
    const combo = (v) => [v.palette, v.type, v.motion, v.bg, v.layout].join('|');
    check(combo(twice.a) !== combo(twice.b) && twice.a.palette !== twice.b.palette, 'two consecutive promo reels for one tool differ in look (palette ' + twice.a.palette + ' → ' + twice.b.palette + ')');
    check(new Set([twice.a.palette, twice.b.palette, twice.c.palette]).size === 3, 'three in a row use three palettes (the last three for a tool are avoided)');
    /* the checks below were written for the brand look: pin it, as the Look selects would */
    await page.evaluate(async (spec) => { const API = AIImg.tools['reel-maker'].current; API.setLook(spec); await API.prepare(); }, MIDNIGHT);
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

    /* ---- 3b. the story: seven beats, the story's own words ---- */
    const story = await page.evaluate(() => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const st = window.TOOL_STORIES && window.TOOL_STORIES['/india/gst-calculator/'];
      const ex = S.scenes.find((s) => s.type === 'example');
      return { types: S.scenes.map((s) => s.type), secs: S.scenes.map((s) => s.seconds), hook: S.scenes[0].text, story: st,
        usual: (S.scenes.find((s) => s.type === 'usual') || {}).text || '', exKind: ex && ex.ex && ex.ex.kind, fixture: !!(window.TOOL_EXAMPLES && window.TOOL_EXAMPLES['/india/gst-calculator/']),
        storiesScript: !!document.querySelector('script[src="/assets/stories.js"]'), audit: T.paletteAudit().filter((r) => !r.ok) };
    });
    const D7 = story.secs.reduce((a, b) => a + b, 0);
    console.log('  beats:', story.types.map((t, i) => t + ' ' + story.secs[i] + ' s').join(', '), '· total', D7.toFixed(1), 's');
    check(JSON.stringify(story.types) === JSON.stringify(['hook', 'pain', 'usual', 'fix', 'example', 'steps', 'endcard']), 'promote mode for /india/gst-calculator/ gives the 7 beats in order');
    check(!!story.story && story.hook === story.story.hook, 'the hook scene is the story hook ("' + story.hook + '")');
    check(!!story.story && story.story.usual.every((u) => story.usual.indexOf(u) >= 0), 'the usual-way scene carries the three frustrations');
    check(story.storiesScript, 'assets/stories.js was loaded on demand (promote mode)');
    check(D7 >= 15 && D7 <= 24 && story.secs.slice(0, -1).every((s) => s >= 1.6 && s <= 4), 'beats last 1.6–4 s each, ' + D7.toFixed(1) + ' s in all');
    check(story.exKind === (story.fixture ? 'calc' : 'flow'), 'the example scene is the ' + (story.fixture ? 'captured calculator receipt' : 'in → out line') + ' (' + story.exKind + ')');
    check(story.audit.length === 0, 'every palette passes the AA contrast audit' + (story.audit.length ? ' (' + story.audit.map((r) => r.palette + ' ' + r.pair).join('; ') + ')' : ''));
    for (const spec of [{ palette: 'block', type: 'caps', motion: 'punch', bg: 'grid', layout: 'split' }, { palette: 'paper', type: 'serif', motion: 'type', bg: 'grain', layout: 'poster' }, { palette: 'violet', type: 'outline', motion: 'slide', bg: 'mesh', layout: 'classic' }]) {
      const s2 = await scanEndCard(page, spec);
      check(s2.scanned === s2.qr, 'end card QR decodes to the UTM link in ' + s2.look);
    }
    /* captions: one shape per copy index, all with the link-in-bio line and 5–8 tags */
    const caps3 = await page.evaluate(() => { const T = AIImg.tools['reel-maker']; const out = []; for (const copy of [0, 1, 2]) { T.current.setLook({ copy }); out.push(T.captionFor()); } return out; });
    fs.writeFileSync(path.join(OUT, 'captions-3-shapes.txt'), caps3.join('\n\n=====\n\n'));
    check(new Set(caps3).size === 3, 'three caption structures for three copy indexes');
    check(caps3.every((c) => c.split('\n')[0] === story.hook && /link in bio/i.test(c) && hashtags(c).length >= 5 && hashtags(c).length <= 8 && !/100% private|no third-party|unlimited/i.test(c)), 'each caption leads with the hook, has the bio line and 5–8 hashtags');
    /* examples.js absent or without an entry: the in → out line */
    const degrade = await page.evaluate(() => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const keep = window.TOOL_EXAMPLES; window.TOOL_EXAMPLES = undefined;
      const sc = T.buildScript(S.promote, { endcard: true });
      window.TOOL_EXAMPLES = keep;
      const ex = sc.find((s) => s.type === 'example');
      return ex && ex.ex.kind;
    });
    check(degrade === 'flow', 'without assets/examples.js the example beat falls back to the in → out line');
    /* the contact sheet: every beat, settled and mid-motion, in three looks */
    const sheet = await page.evaluate(async (looks) => {
      const T = AIImg.tools['reel-maker']; const API = T.current; const S = T.state();
      const n = S.scenes.length, tw = 270, th = 480, g = 10;
      const c = document.createElement('canvas'); c.width = n * (tw + g) + g; c.height = looks.length * 2 * (th + g) + g;
      const x = c.getContext('2d'); x.fillStyle = '#2a2d36'; x.fillRect(0, 0, c.width, c.height);
      const f = document.createElement('canvas'); f.width = 1080; f.height = 1920; const fx = f.getContext('2d');
      for (let li = 0; li < looks.length; li++) {
        API.setLook(looks[li]); await API.prepare();
        let st = 0;
        S.scenes.forEach((sc, i) => {
          for (const [k, frac] of [[0, 0.88], [1, 0.32]]) {
            T.renderFrame(fx, 1080, 1920, st + sc.seconds * frac, S);
            x.drawImage(f, g + i * (tw + g), g + (li * 2 + k) * (th + g), tw, th);
          }
          st += sc.seconds;
        });
      }
      return c.toDataURL('image/png');
    }, [Object.assign({ copy: 0 }, MIDNIGHT), { palette: 'paper', type: 'serif', motion: 'slide', bg: 'grain', layout: 'poster', copy: 1 }, { palette: 'block', type: 'caps', motion: 'punch', bg: 'grid', layout: 'split', copy: 2 }]);
    savePng(sheet, 'looks.png');
    console.log('  contact sheet: ' + path.join(OUT, 'looks.png'));

    /* ---- 3c. no text overflows, nothing in the safe bands: every beat, every palette, three sizes ---- */
    const sweep = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const API = T.current; const S = T.state();
      T.clearOverflow();
      const pals = Object.keys(T.palettes), types = T.types, motions = T.motions, bgs = T.backgrounds, layouts = T.layouts;
      const sizes = [[1080, 1920], [1080, 1080], [1920, 1080]];
      const bands = { top: 0, bottom: 0, inked: 0 };
      const bgc = document.createElement('canvas'); bgc.width = 1080; bgc.height = 1920; const bgx = bgc.getContext('2d');
      /* pixels that differ from the bare background in the top 250 px or the bottom 340 px: something was drawn there */
      const inked = (x) => {
        let n = 0;
        for (const [y0, h] of [[0, 250], [1580, 340]]) {
          const a = x.getImageData(0, y0, 1080, h).data, b = bgx.getImageData(0, y0, 1080, h).data;
          for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 24) n++;
        }
        return n;
      };
      const std = (d) => { let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)); };
      let frames = 0;
      for (let p = 0; p < pals.length; p++) {
        API.setLook({ palette: pals[p], type: types[p % types.length], motion: motions[p % motions.length], bg: bgs[p % bgs.length], layout: layouts[p % layouts.length], copy: p % 3 });
        await API.prepare();
        for (const [W, H] of (p < 3 ? sizes : [sizes[0]])) {
          const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
          let st = 0;
          for (const sc of S.scenes) {
            for (const fr of [0.05, 0.3, 0.6, 0.98]) {
              T.renderFrame(x, W, H, st + sc.seconds * fr, S);
              frames++;
              if (W === 1080 && H === 1920 && (fr === 0.3 || fr === 0.98)) {
                bands.top = Math.max(bands.top, std(x.getImageData(0, 0, W, 240).data));
                bands.bottom = Math.max(bands.bottom, std(x.getImageData(0, 1600, W, 320).data));
                T.background(bgx, 1080, 1920, st + sc.seconds * fr, S);
                bands.inked += inked(x);
              }
            }
            st += sc.seconds;
          }
        }
      }
      return { over: T.overflow(), min: T.minPx(), bands, frames };
    });
    console.log('  sweep: ' + sweep.frames + ' frames · smallest text ' + sweep.min.toFixed(1) + ' px · band std top ' + sweep.bands.top.toFixed(1) + ', bottom ' + sweep.bands.bottom.toFixed(1));
    check(sweep.over.length === 0, 'no overflow flags in 8 palettes × 5 treatments × 4 motions, 3 sizes' + (sweep.over.length ? ' (' + sweep.over.slice(0, 4).join(' | ') + ')' : ''));
    check(sweep.min >= 19.9, 'no text drawn below 20 px on a 1080-wide frame (smallest ' + sweep.min.toFixed(1) + ')');
    check(sweep.bands.inked === 0, 'nothing but the background in the top 250 px and bottom 340 px of 1080×1920, in any look (' + sweep.bands.inked + ' pixels drawn over it)');

    /* ---- 3d. the example: a fixture before/after, wiped (pixel check mid-wipe) ---- */
    const wipe = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const API = T.current; const S = T.state();
      const solid = (col) => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 800, 600); return c.toDataURL('image/png'); };
      await T.loadExamples();
      window.TOOL_EXAMPLES = window.TOOL_EXAMPLES || {};
      window.TOOL_EXAMPLES['/image/image-compressor/'] = { kind: 'beforeAfter', caption: 'Fixture: blue before, orange after', before: solid('#1e50ff'), after: solid('#ff8a1e') };
      const row = FINDER_INDEX.tools.find((r) => r[1] === 'image/image-compressor/');
      await API.usePromote(row);
      API.setLook({ palette: 'midnight', type: 'gradient', motion: 'pop', bg: 'glow', layout: 'classic' });
      await API.prepare();
      const i = S.scenes.findIndex((s) => s.type === 'example');
      if (i < 0) return { err: 'no example scene: ' + S.scenes.map((s) => s.type).join(',') };
      const sc = S.scenes[i];
      const start = S.scenes.slice(0, i).reduce((a, s) => a + s.seconds, 0);
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d');
      let hit = null;
      for (let t = 0.5; t < 1.9; t += 1 / 30) {
        T.renderFrame(x, 1080, 1920, start + t, S);
        const b = sc._ba;
        if (b && b.sx > b.x + b.w * 0.42 && b.sx < b.x + b.w * 0.58) { hit = { t, b: Object.assign({}, b) }; break; }
      }
      if (!hit) return { err: 'the seam never crossed the middle' };
      const at = (px, py) => Array.from(x.getImageData(Math.round(px), Math.round(py), 1, 1).data);
      const b = hit.b, yy = b.y + b.h * 0.78;
      return { t: hit.t, seam: (b.sx - b.x) / b.w, left: at(b.sx - b.w * 0.15, yy), right: at(b.sx + b.w * 0.15, yy), png: c.toDataURL('image/png'), kind: sc.ex.kind };
    });
    if (wipe.err) check(false, 'mid-wipe frame: ' + wipe.err);
    else {
      savePng(wipe.png, '5-wipe-frame.png');
      console.log('  mid-wipe at ' + wipe.t.toFixed(2) + ' s into the example (seam ' + (wipe.seam * 100).toFixed(0) + '%): left ' + wipe.left + ', right ' + wipe.right);
      const blue = (p) => p[2] > 200 && p[0] < 90, orange = (p) => p[0] > 220 && p[1] > 100 && p[1] < 180 && p[2] < 90;
      check(wipe.kind === 'beforeAfter' && blue(wipe.left) && orange(wipe.right), 'with a fixture TOOL_EXAMPLES entry the example scene draws the before/after: before left of the seam, after right of it');
    }

    /* ---- 3e. a batch of three gets three looks ---- */
    const plan = await page.evaluate(() => {
      const T = AIImg.tools['reel-maker'];
      const rows = ['india/gst-calculator/', 'pdf/merge-pdf/', 'text/word-counter/'].map((p) => FINDER_INDEX.tools.find((r) => r[1] === p));
      T.current.state.lookLock = {};
      return T.current.planBatch(rows, { record: false });
    });
    console.log('  batch of three:', plan.map((v) => v.palette + '/' + v.type + '/' + v.motion + '/' + v.bg).join(', '));
    check(new Set(plan.map((v) => v.palette)).size === 3, 'a batch of 3 gives 3 different looks (three palettes)');

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

    /* ---- 4b. the visitor's templates: each makes its own scenes, nothing overflows ---- */
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await gotoTool('');
    const tplOpts = await page.$$eval('#reel-template option', (o) => o.map((x) => x.value).filter(Boolean));
    check(tplOpts.length === 7, 'the template select offers 7 templates (' + tplOpts.join(', ') + ')');
    const tplLooks = [];
    for (const id of Object.keys(TEMPLATE_TYPES)) {
      await page.select('#reel-template', id);
      await clickText(page, '.reel-start', /^Make my reel$/);
      await waitStudio();
      const got = await page.evaluate(async () => {
        const T = AIImg.tools['reel-maker']; const S = T.state();
        await T.current.prepare();
        T.clearOverflow();
        const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d');
        let st = 0;
        for (const sc of S.scenes) { for (const fr of [0.1, 0.4, 0.7, 0.99]) T.renderFrame(x, 1080, 1920, st + sc.seconds * fr, S); st += sc.seconds; }
        return { types: S.scenes.map((s) => s.type), over: T.overflow(), look: S.look.spec, D: st, png: (T.renderFrame(x, 1080, 1920, S.scenes[1].seconds * 0.9 + S.scenes[0].seconds, S), c.toDataURL('image/png')) };
      });
      savePng(got.png, 'template-' + id + '.png');
      tplLooks.push(got.look.palette + '/' + got.look.type);
      check(JSON.stringify(got.types) === JSON.stringify(TEMPLATE_TYPES[id]) && got.over.length === 0, 'template "' + id + '" makes ' + got.types.join(', ') + ' (' + got.D.toFixed(1) + ' s), no overflow' + (got.over.length ? ' — ' + got.over.join(' | ') : ''));
      await clickText(page, '.aiimg-transport', /^Start over$/);
    }
    console.log('  template looks: ' + tplLooks.join(', '));
    /* Shuffle look: a new palette and the look name says so */
    await clickText(page, '.reel-start', /^Make my reel$/);
    await waitStudio();
    const before = await page.evaluate(() => AIImg.tools['reel-maker'].state().look.spec);
    await page.click('#reel-shuffle');
    await sleep(200);
    const after = await page.evaluate(() => ({ spec: AIImg.tools['reel-maker'].state().look.spec, name: document.querySelector('#reel-look-name').textContent }));
    check(after.spec.palette !== before.palette && after.name.indexOf(after.spec.palette === 'block' ? 'Bold Block' : '') >= 0, 'Shuffle look changes the palette (' + before.palette + ' → ' + after.spec.palette + '; "' + after.name + '")');
    await clickText(page, '.aiimg-transport', /^Start over$/);

    /* ---- 4c. the voice-over script: written for the ear, never a payload, editable, resettable ---- */
    const vo = await page.evaluate(async (tplIds) => {
      const T = AIImg.tools['reel-maker'];
      await T.loadStories(); await T.loadExamples();
      await new Promise((res) => { if (window.FINDER_INDEX) return res(); const s = document.createElement('script'); s.src = '/assets/finder-index.js'; s.onload = res; s.onerror = res; document.head.appendChild(s); });
      const BAD = /WIFI:|https?:|www\.|\.(com|in|org|net)\b|(^|\s)[#@][A-Za-z]|utm_|[{}]|\.(pdf|png|jpe?g|csv|json|svg|zip|txt)\b|[₹£$€%×→✓✗•|]|\p{Extended_Pictographic}/u;
      const bad = [];
      const tpl = {};
      for (const t of T.templates) { const lines = T.scenesFromScript(t.script).map((sc) => T.voOf(sc)); tpl[t.id] = lines; lines.forEach((l) => { if (BAD.test(l)) bad.push(t.id + ': ' + l); }); }
      const rows = (window.FINDER_INDEX && window.FINDER_INDEX.tools) || [];
      let tools = 0, lines = 0, emptyVO = 0;
      const sample = {};
      for (const row of rows) {
        const scenes = T.buildScript(row, { endcard: true, qr: true });
        tools++;
        for (const sc of scenes) {
          const v = T.voOf(sc); lines++;
          if (!v.trim()) emptyVO++;
          if (BAD.test(v)) bad.push(row[1] + ' [' + sc.type + ']: ' + v);
        }
        if (/qr\/qr-code-generator\/|india\/gst-calculator\/|pdf\/merge-pdf\//.test(row[1])) sample[row[1]] = scenes.map((sc) => ({ type: sc.type, screen: sc.type === 'endcard' ? sc.cta : sc.text, vo: T.voOf(sc) }));
      }
      const rules = {
        wifi: T.toSpeech('Scan to join: WIFI:T:WPA;S:Harbour Cafe;P:flatwhite2026;;'),
        url: T.toSpeech('Menu at https://example.com/menu?x=1 or www.example.org'),
        ours: T.toSpeech('Free at 1234tools.com/qr/qr-code-generator/?utm_source=instagram'),
        sym: T.toSpeech('₹1,50,000 → 18% GST × 2 ✓ #tax @me 😀'),
        json: T.toSpeech('Paste {"a": 1} and get report.pdf back'),
        uk: T.toSpeech('Pick a color and organize your favorite files')
      };
      return { bad, tools, lines, emptyVO, tpl, sample, rules };
    }, Object.keys(TEMPLATE_TYPES));
    fs.writeFileSync(path.join(OUT, 'voice-over.json'), JSON.stringify(vo, null, 1));
    check(vo.tools >= 20 && vo.bad.length === 0, 'voice-over suggestions for ' + vo.tools + ' tools (' + vo.lines + ' lines) and all 7 templates hold no Wi-Fi payload, URL, hashtag, handle, UTM link, file name, emoji or symbol' + (vo.bad.length ? ': ' + vo.bad.slice(0, 3).join(' | ') : ''));
    const qrS = vo.sample['/qr/qr-code-generator/'] || vo.sample['qr/qr-code-generator/'] || [];
    const qrEx = qrS.find((x) => x.type === 'example');
    check(!!qrEx && /WIFI:/.test(qrEx.screen) && /joins the Wi-Fi/.test(qrEx.vo) && !/WIFI:|flatwhite/.test(qrEx.vo), 'QR Code Generator: the screen shows the Wi-Fi payload, the voice-over says "' + (qrEx ? qrEx.vo : '?') + '"');
    check(!/WIFI|flatwhite|Harbour/.test(vo.rules.wifi) && /the link in our bio/.test(vo.rules.url) && !/example\.|https/.test(vo.rules.url), 'toSpeech drops a Wi-Fi payload ("' + vo.rules.wifi + '") and says links as "the link in our bio" ("' + vo.rules.url + '")');
    check(/^Free at 1234Tools\.?$/.test(vo.rules.ours), 'our own link is said as the site’s name ("' + vo.rules.ours + '")');
    check(/1,50,000 rupees/.test(vo.rules.sym) && /18 per cent/.test(vo.rules.sym) && !/[#@→✓×😀]/u.test(vo.rules.sym), 'symbols said in words, tags and emoji dropped ("' + vo.rules.sym + '")');
    check(!/[{}"]|report/.test(vo.rules.json) && /PDF/.test(vo.rules.json), 'JSON dropped and a file name said only as its type ("' + vo.rules.json + '")');
    check(vo.rules.uk === 'Pick a colour and organise your favourite files.', 'British spelling ("' + vo.rules.uk + '")');
    /* editing, resetting, the Scenes pane and the Sound pane showing the same line */
    await gotoTool('?tool=qr/qr-code-generator/');
    await waitStudio();
    await pane('sound');
    const ed = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const boxes = [...document.querySelectorAll('#reel-vo .reel-vo-text')];
      const refs = [...document.querySelectorAll('#reel-vo .reel-vo-ref')].map((x) => x.textContent);
      const sugg = boxes.map((b) => b.value);
      const set = (ta, v) => { ta.value = v; ta.dispatchEvent(new Event('input', { bubbles: true })); };
      set(boxes[0], 'My own opening line.');
      const sceneBox = document.querySelector('.reel-scene-vo[data-id="' + S.scenes[0].id + '"]');
      const mirrored = sceneBox ? sceneBox.value : null;
      set(boxes[1], '');
      const silent = T.voOf(S.scenes[1]) === '';
      const resetBtn = boxes[0].closest('li').querySelector('.reel-vo-reset');
      resetBtn.click();
      const afterReset = T.voOf(S.scenes[0]) === sugg[0] && document.querySelectorAll('#reel-vo .reel-vo-text')[0].value === sugg[0];
      document.querySelector('#reel-vo-reset-all').click();
      const afterAll = T.voOf(S.scenes[1]) === sugg[1] && S.scenes.every((sc) => sc.vo === undefined);
      return { n: boxes.length, scenes: S.scenes.length, refs: refs.slice(0, 2), mirrored, silent, afterReset, afterAll };
    });
    check(ed.n === ed.scenes && ed.refs.every((r) => /^On screen: /.test(r)), 'Sound lists one voice-over box per scene (' + ed.n + '), each with the screen text beside it');
    check(ed.mirrored === 'My own opening line.', 'an edit in Sound shows in the Scenes pane’s voice-over box too');
    check(ed.silent, 'an emptied line makes that scene silent');
    check(ed.afterReset && ed.afterAll, '“Reset to suggested” restores one line, “Reset all to suggested” every line');
    await clickText(page, '.aiimg-transport', /^Start over$/);

    /* ---- 4d. the AI label and the "Made with 1234Tools.com" credit: defaults, places, contrast, no overflow, nothing in the bands, captions above ---- */
    await gotoTool('?tool=india/gst-calculator/');
    await waitStudio();
    await pane('export');
    const ui0 = await page.evaluate(() => ({ ai: document.querySelector('#reel-ai-label').checked, aiOff: !document.querySelector('#reel-ai-label').disabled, made: document.querySelector('#reel-made-with').checked,
      aiText: document.querySelector('#reel-ai-label').closest('label, .field-check').textContent, madeText: document.querySelector('#reel-made-with').closest('label, .field-check').textContent }));
    check(!ui0.ai && ui0.aiOff && ui0.made, 'Export: “Label this reel as AI-generated” is off and free to tick, “Show Made with 1234Tools.com” is on, without a generated voice');
    check(/Label this reel as AI-generated/.test(ui0.aiText) && /Made with 1234Tools\.com/.test(ui0.madeText), 'the two switches say what they do');
    const mk = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      await T.current.prepare();
      const out = { def: { ai: T.aiLabelOf(S), credit: T.madeWithOn(S), meta: T.aiMetadata(S) }, geo: [], contrast: [], over: [], bands: [], caps: null };
      S.brand.aiLabel = true;
      out.on = { ai: T.aiLabelOf(S), meta: T.aiMetadata(S) };
      for (const [W, H] of [[1080, 1920], [1080, 1080], [1920, 1080]]) out.geo.push(Object.assign({ W, H }, T.marks(W, H, S)));
      /* contrast: each palette's plate, 90% opaque, over pure white and pure black, against its text */
      const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      const blend = (rgba, under) => { const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(rgba); const a = Number(m[4]); return hex(...[1, 2, 3].map((i) => a * Number(m[i]) + (1 - a) * under)); };
      for (const id of Object.keys(T.palettes)) {
        const col = T.markColours(T.palettes[id]);
        out.contrast.push({ id, light: !!T.palettes[id].light, white: T.contrast(col.ink, blend(col.plate, 255)), black: T.contrast(col.ink, blend(col.plate, 0)) });
      }
      /* every beat, every palette, three sizes, both marks on: nothing overflows */
      T.clearOverflow();
      for (const id of Object.keys(T.palettes)) {
        T.current.setLook({ palette: id });
        await T.current.prepare();
        for (const [W, H] of [[1080, 1920], [1080, 1080], [1920, 1080]]) {
          const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
          let st = 0;
          for (const sc of S.scenes) { for (const f of [0.3, 0.95]) T.renderFrame(x, W, H, st + sc.seconds * f, S); st += sc.seconds; }
        }
      }
      out.over = T.overflow();
      /* the bands: the frame with both marks and without them is identical in the top 250 and bottom 340 px */
      const W = 1080, H = 1920;
      const draw = (Y, t) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); T.renderFrame(x, W, H, t, Y); return x; };
      const same = (a, b, y0, y1) => { const d1 = a.getImageData(0, y0, W, y1 - y0).data, d2 = b.getImageData(0, y0, W, y1 - y0).data; let n = 0; for (let i = 0; i < d1.length; i++) if (d1[i] !== d2[i]) n++; return n; };
      const none = Object.assign({}, S, { voice: null, brand: Object.assign({}, S.brand, { aiLabel: false, madeWith: false }) });
      for (const t of [S.scenes[0].seconds * 0.9, S.scenes[0].seconds + S.scenes[1].seconds * 0.8]) {
        const a = draw(S, t), b = draw(none, t);
        out.bands.push({ t, top: same(a, b, 0, 250), bottom: same(a, b, 1580, 1920), middle: same(a, b, 250, 1580) });
      }
      /* captions sit above the credit and the bar: the lowest caption pixel, from a frame with a cue on screen against one with it off-screen */
      const words = 'Stop guessing your GST today friends and family'.split(' ').map((w) => ({ text: w, start: 0, end: 99 }));
      const cue = (start) => ({ start, end: start + 99, until: start + 99, text: words.map((w) => w.text).join(' '), words, lines: [words.slice(0, 4), words.slice(4)] });
      const withCap = (c) => Object.assign({}, S, { captions: Object.assign({}, S.captions, { source: 'auto', cues: [c], style: Object.assign({}, S.captions.style, { mode: 'line', size: 9 }) }) });
      const t = S.scenes[0].seconds * 0.9;
      const a = draw(withCap(cue(0)), t), b = draw(withCap(cue(500)), t);
      const d1 = a.getImageData(0, 0, W, H).data, d2 = b.getImageData(0, 0, W, H).data;
      let low = -1, high = -1;
      for (let y = 0; y < H; y++) { for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; if (d1[i] !== d2[i] || d1[i + 1] !== d2[i + 1]) { if (high < 0) high = y; low = y; break; } } }
      out.caps = { top: high, bottom: low, credit: T.marks(W, H, S).credit, bar: T.marks(W, H, S).bar };
      S.brand.aiLabel = false;
      return out;
    });
    fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(mk, null, 1));
    check(mk.def.ai === '' && mk.def.credit === true && mk.def.meta === null, 'by default (no generated voice): no AI label, no metadata, the credit on');
    check(mk.on.ai === 'AI-generated' && /Labelled by its maker/.test(mk.on.meta.comment) && /1234tools\.com\/ai-video\/reel-maker\//.test(mk.on.meta.comment), 'ticking the switch: the label reads “AI-generated” and the metadata says so');
    for (const g of mk.geo) {
      const ok = g.ai.y >= g.top - 0.5 && g.ai.y + g.ai.h <= (g.head ? g.head.y : g.box.y) && g.box.y >= g.ai.y + g.ai.h
        && g.credit.y + g.credit.h <= g.bottom + 0.5 && (!g.bar || g.bar.y + g.bar.h <= g.credit.y) && g.box.y + g.box.h <= g.credit.y;
      check(ok, g.W + '×' + g.H + ': the label (' + Math.round(g.ai.y) + '–' + Math.round(g.ai.y + g.ai.h) + ') sits under the top band (' + Math.round(g.top) + ') and above the brand row and content; the credit (' + Math.round(g.credit.y) + '–' + Math.round(g.credit.y + g.credit.h) + ') above the bottom band (' + Math.round(g.bottom) + ') and below the bar and content');
    }
    const lowC = mk.contrast.filter((c) => c.white < 4.5 || c.black < 4.5);
    check(mk.contrast.length === 8 && !lowC.length, 'both marks keep AA contrast on all 8 palettes (light and dark), over white or black (lowest ' + Math.min(...mk.contrast.map((c) => Math.min(c.white, c.black))).toFixed(1) + ':1)');
    check(mk.over.length === 0, 'with both marks on, no text overflows: 8 palettes × every beat × 3 sizes' + (mk.over.length ? ' — ' + mk.over.slice(0, 3).join(' | ') : ''));
    check(mk.bands.every((b) => b.top === 0 && b.bottom === 0 && b.middle > 0), 'the marks change the frame only between the bands: top 250 px and bottom 340 px untouched (' + mk.bands.map((b) => b.top + '/' + b.bottom).join(', ') + ')');
    check(mk.caps.bottom > 0 && mk.caps.bottom < mk.caps.credit.y && (!mk.caps.bar || mk.caps.bottom < mk.caps.bar.y), 'a two-line caption ends at ' + mk.caps.bottom + ' px, above the bar (' + (mk.caps.bar ? Math.round(mk.caps.bar.y) : '-') + ') and the credit (' + Math.round(mk.caps.credit.y) + ')');
    await clickText(page, '.aiimg-transport', /^Start over$/);

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
        /* a recorded voice: no AI label in the frames and no note in the file; the credit is drawn */
        const mv = await marksInVideo(page, src, 2.0);
        console.log('  marks in the export at 2 s: label as/flip ' + mv.ai.as.toFixed(1) + '/' + mv.ai.flip.toFixed(1) + ', credit as/flip ' + mv.credit.as.toFixed(1) + '/' + mv.credit.flip.toFixed(1));
        check(!mv.ai.on && markOk(mv.ai), 'a reel with a recorded voice has no AI label in its frames');
        check(mv.credit.on && markOk(mv.credit), '“Made with 1234Tools.com” is in the exported frames by default');
        check(mv.tags === null && !/AI label in the file/.test(head), 'and its MP4 carries no AI metadata');
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

        /* ---- 8b. the video opens on the cover (the post preview is frame 0) ---- */
        const open = await page.evaluate(async (vsrc) => {
          const small = (src) => new Promise((res) => {
            const c = document.createElement('canvas'); c.width = 108; c.height = 192;
            const x = c.getContext('2d');
            const done = (m) => { x.drawImage(m, 0, 0, 108, 192); const d = x.getImageData(0, 0, 108, 192).data; const g = []; for (let i = 0; i < d.length; i += 4) g.push((d[i] + d[i + 1] + d[i + 2]) / 3); res(g); };
            if (src.kind === 'img') { const im = new Image(); im.onload = () => done(im); im.src = src.url; return; }
            const v = document.createElement('video'); v.muted = true; v.src = src.url;
            v.onloadeddata = () => { v.onseeked = () => setTimeout(() => done(v), 200); v.currentTime = src.t; };
          });
          const cov = await small({ kind: 'img', url: document.querySelector('.aiimg-result img').src });
          const f0 = await small({ kind: 'video', url: vsrc, t: 0 });
          const f2 = await small({ kind: 'video', url: vsrc, t: 2.0 });
          const mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
          const std = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length); };
          return { d0: mad(cov, f0), d2: mad(cov, f2), std0: std(f0), on: document.querySelector('#reel-open-cover').checked };
        }, src);
        console.log('  opening: frame 0 vs cover ' + open.d0.toFixed(1) + ', 2 s vs cover ' + open.d2.toFixed(1) + ', frame 0 std ' + open.std0.toFixed(1));
        check(open.on, '"Open the video on the cover" is on by default');
        check(open.d0 < 10 && open.d0 < open.d2 / 3, 'frame 0 of the MP4 is the cover (mean difference ' + open.d0.toFixed(1) + ' < 10, and under a third of the 2 s frame, ' + open.d2.toFixed(1) + ')');
        check(open.std0 > 20, 'frame 0 is not blank (luminance std ' + open.std0.toFixed(1) + ' > 20)');
      }

      if (!SKIP_VIDEO && !SKIP_BATCH) {
        /* ---- 9. batch ---- */
        await page.click('.aiimg-transport .btn-ghost:last-child');
        await page.click('.reel-start [data-mode=promote]');
        await page.waitForSelector('.reel-tool', { timeout: 20000 });
        await page.screenshot({ path: path.join(OUT, '2-promote.png') });
        const tick = (l) => page.evaluate((l) => { const c = document.querySelector('.reel-pick[aria-label="' + l + '"]'); if (!c) return null; c.click(); return c.checked; }, l);
        const btnNow = () => page.$eval('#reel-batch', (b) => ({ text: b.textContent, disabled: b.disabled }));
        const b0 = await btnNow();
        check(b0.disabled && b0.text === 'Make reels', 'with nothing ticked the batch button is off and names no number ("' + b0.text + '")');
        check(await tick('Select GST Calculator (India)') === true, 'ticked GST Calculator (India)');
        const b1 = await btnNow();
        check(b1.text === 'Make 1 reel' && !b1.disabled, 'one tool ticked: "Make 1 reel", singular and enabled ("' + b1.text + '")');
        check(await tick('Select Merge PDF Files') === true && await tick('Select QR Code Generator') === true, 'ticked Merge PDF Files and QR Code Generator');
        const b3 = await btnNow();
        check(b3.text === 'Make 3 reels', 'three tools ticked: "Make 3 reels" ("' + b3.text + '")');
        check(await tick('Select QR Code Generator') === false, 'unticked QR Code Generator');
        const btn = await btnNow();
        check(btn.text === 'Make 2 reels' && !btn.disabled, 'batch button reads "Make 2 reels"');
        const before = await page.$$eval('.aiimg-result video', (v) => v.length);
        /* the batch is labelled by hand: every reel in it must carry the label and the note */
        await page.evaluate(() => { const c = document.querySelector("#reel-ai-label"); if (!c.checked) c.click(); });
        const tb = Date.now();
        /* one click: the button changes in the same task, and a status line says what is happening, within 100 ms */
        const fb = await page.evaluate(async () => {
          const b = document.querySelector('#reel-batch');
          const t0 = performance.now();
          b.click();
          const now = { text: b.textContent, disabled: b.disabled, line: document.querySelector('#reel-batch-line').textContent, ms: performance.now() - t0 };
          await new Promise((r) => setTimeout(r, 100));
          return Object.assign(now, { after100: document.querySelector('#reel-batch-line').textContent || (document.querySelector('.reel-batch-status') || {}).textContent || '' });
        });
        check(fb.disabled && /^Making 2 reels…$/.test(fb.text) && fb.line.length > 0 && fb.ms < 100, 'one click: at once the button is disabled, reads "Making 2 reels…", and a status line shows (' + JSON.stringify(fb.text) + ', ' + JSON.stringify(fb.line) + ', ' + fb.ms.toFixed(1) + ' ms)');
        await page.waitForSelector('.reel-batch:not([hidden])', { timeout: 20000 });
        const started = await page.evaluate(() => !!AIImg.tools['reel-maker'].state().job || /\d+ reels?,/.test((document.querySelector('.reel-batch-status') || {}).textContent || ''));
        check(started, 'the batch starts on that one click — no second "Start" click');
        check(!(await page.evaluate(() => [...document.querySelectorAll('.reel-batch button')].some((b) => /^Start$/.test(b.textContent.trim())))), 'there is no separate Start button any more');
        await page.waitForFunction(() => { const s = document.querySelector('.reel-batch-status'); return s && /\d+ reels?,|stopped|Cancelled/.test(s.textContent); }, { timeout: 900000, polling: 500 });
        const bs = await page.$eval('.reel-batch-status', (e) => e.textContent);
        console.log(stamp(), 'batch:', bs, '| took', ((Date.now() - tb) / 1000).toFixed(1) + 's');
        timings.batch2 = (Date.now() - tb) / 1000;
        check(/^2 reels, 2 covers and reel-captions\.txt/.test(bs), 'batch finished: "' + bs + '"');
        const vids = await page.$$eval('.aiimg-result', (r) => r.filter((x) => x.querySelector('video')).map((x) => ({ name: x.dataset.name, src: x.querySelector('video').src })));
        check(vids.length - before === 2, 'batch of 2 tools gave 2 clips (' + vids.map((v) => v.name).join(', ') + ')');
        const after = await btnNow();
        check(after.text === 'Make 2 reels' && !after.disabled, 'the button is back to "Make 2 reels" when the batch is done ("' + after.text + '")');
        for (const want of ['reel-gst-calculator.mp4', 'reel-merge-pdf.mp4']) {
          const v = vids.find((x) => x.name === want);
          if (!v) { check(false, want + ' is in the results'); continue; }
          const p = await probe(page, v.src, [0.1]);
          const b = Buffer.from(p.b64, 'base64');
          fs.writeFileSync(path.join(OUT, 'batch-' + want), b);
          check(b.subarray(4, 8).toString('latin1') === 'ftyp' && p.duration >= 12 && p.duration <= 30, want + ': ftyp, ' + p.duration.toFixed(1) + ' s (12–30)');
          const bt = await page.evaluate(async (s) => AIImg.readMP4Tags(await (await fetch(s)).arrayBuffer()), v.src);
          check(!!bt && /AI-generated content/.test(bt['©cmt'] || ''), want + ': the batch reel carries the AI note too');
        }
        await page.evaluate(() => { const c = document.querySelector('#reel-ai-label'); if (c.checked && !c.disabled) c.click(); });
        const caps = await page.evaluate(async () => { const a = document.querySelector('a[download="reel-captions.txt"]'); return a ? (await (await fetch(a.href)).text()) : ''; });
        fs.writeFileSync(path.join(OUT, 'reel-captions.txt'), caps);
        check(/GST Calculator \(India\)/.test(caps) && /Merge PDF Files/.test(caps), 'reel-captions.txt names both tools');
        const bLooks = await page.evaluate(() => AIImg.tools['reel-maker'].state().lastBatchLooks || []);
        check(bLooks.length === 2 && bLooks[0] !== bLooks[1], 'the two batch reels were made in two looks (' + bLooks.join(' · ') + ')');
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
          /* the text-only reel goes out with the credit switched off, and labelled as AI-generated by hand */
          if (!withMusic) await page.evaluate(() => { for (const id of ['#reel-made-with', '#reel-ai-label']) document.querySelector(id).click(); });
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
          const mm = await marksInVideo(page, src, 7.5);
          if (!withMusic) {
            check(!mm.credit.on && markOk(mm.credit), 'with “Show Made with 1234Tools.com” off, the exported frames carry no credit (as/flip ' + mm.credit.as.toFixed(1) + '/' + mm.credit.flip.toFixed(1) + ')');
            check(mm.ai.on && markOk(mm.ai), 'labelled by hand, the exported frames carry the “AI-generated” label (as/flip ' + mm.ai.as.toFixed(1) + '/' + mm.ai.flip.toFixed(1) + ')');
            check(!!mm.tags && /Labelled by its maker as containing AI-generated content/.test(mm.tags['©cmt'] || '') && /1234Tools Reel Maker/.test(mm.tags['©too'] || '') && /AI label in the file/.test(head), 'its MP4 carries the AI note in moov/udta/meta (' + JSON.stringify(mm.tags) + ')');
            check(Math.abs(mm.duration - 15) <= 0.5, 'the tagged MP4 still plays, 15 s (' + mm.duration.toFixed(2) + ')');
            await page.evaluate(() => { for (const id of ['#reel-made-with', '#reel-ai-label']) document.querySelector(id).click(); });
          } else {
            check(mm.credit.on && markOk(mm.credit) && !mm.ai.on && markOk(mm.ai) && mm.tags === null, 'switched back: the credit is drawn again, no label, no metadata');
          }
          console.log(stamp(), '15 s timing' + (withMusic ? ' with music' : '') + ':', tt, '→', took.toFixed(1) + 's |', head, '| duration', p.duration.toFixed(2), '| trak', traks);
          timings[withMusic ? 'reel15music' : 'reel15'] = took;
          check(Math.abs(p.duration - 15) <= 0.5 && traks === (withMusic ? 2 : 1), '15 s reel' + (withMusic ? ' with music' : '') + ' exports at 15 s with ' + (withMusic ? 'two tracks' : 'one track'));
        }

        /* ---- 10b. timing: a 20 s story reel (seven beats, the receipt, the QR) at 1080×1920 ---- */
        await gotoTool('?tool=india/gst-calculator/');
        await waitStudio();
        await page.evaluate(() => { const ins = document.querySelectorAll('.reel-secs'); const each = 20 / ins.length; for (const i of ins) { i.value = String(Math.round(each * 10) / 10); i.dispatchEvent(new Event('change', { bubbles: true })); } });
        const t20 = await page.$eval('#reel-total', (e) => e.textContent);
        await pane('export');
        const client20 = await page.target().createCDPSession();
        await client20.send('Page.setDownloadBehavior', { behavior: 'deny' });
        const te20 = Date.now();
        await page.click('#reel-export');
        await waitExport();
        const took20 = (Date.now() - te20) / 1000;
        const src20 = await page.$eval('.aiimg-result video', (v) => v.src);
        const p20 = await probe(page, src20, [0.08, 0.3, 0.55, 0.97]);
        const b20 = Buffer.from(p20.b64, 'base64');
        fs.writeFileSync(path.join(OUT, 'reel-gst-story-20s.mp4'), b20);
        p20.frames.forEach((f, i) => savePng(f.png, 'story20-frame-' + (i + 1) + '.png'));
        console.log(stamp(), '20 s story reel:', t20, '→', took20.toFixed(1) + 's | duration', p20.duration.toFixed(2), '|', (p20.size / 1e6).toFixed(2), 'MB');
        timings.promo20 = took20;
        check(b20.subarray(4, 8).toString('latin1') === 'ftyp' && Math.abs(p20.duration - 20) <= 0.6, '20 s story reel exports as an MP4 of 20 s');
      }

      /* ---- 11. the microphone, with Chrome's fake device ---- */
      await gotoTool('');
      await clickText(page, '.reel-start', /^Try an example$/);
      await clickText(page, '.reel-start', /^Make my reel$/);
      await waitStudio();
      await pane('captions');
      await page.select('#reel-cap-source', 'none');
      await pane('sound');
      await page.evaluate(() => { const ta = document.querySelector('#reel-vo .reel-vo-text'); ta.value = 'Teleprompter line from the voice-over.'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.click('#reel-rec-voice');
      await sleep(600);
      const recState = await page.evaluate(() => ({ pressed: document.querySelector('#reel-rec-voice').getAttribute('aria-pressed'), prompter: !document.querySelector('.reel-prompter').hidden, items: document.querySelectorAll('.reel-prompter li').length, first: (document.querySelector('.reel-prompter li') || {}).textContent }));
      check(recState.first === 'Teleprompter line from the voice-over.', 'the teleprompter shows the voice-over script, not the screen text ("' + recState.first + '")');
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

    /* ---- music from a chosen position ----
       a synthetic track: 440 Hz for its first 2 s, 880 Hz after; started
       at 2 s, the mix carries 880 Hz from the reel's start, and a looped
       track goes back to 2 s, not to 0 */
    await gotoTool('?tool=india/gst-calculator/');
    await waitStudio();
    const mf = await page.evaluate(async () => {
      const api = window.AIImg.tools['reel-maker'];
      const S = api.state();
      const SR = 48000, secs = 4;
      const ab = new AudioBuffer({ length: SR * secs, numberOfChannels: 2, sampleRate: SR });
      for (let ch = 0; ch < 2; ch++) {
        const d = ab.getChannelData(ch);
        for (let i = 0; i < d.length; i++) { const t = i / SR; d[i] = 0.5 * Math.sin(2 * Math.PI * (t < 2 ? 440 : 880) * t); }
      }
      const keep = { music: S.music, voice: S.voice };
      const hz = (buf, t0, t1) => {
        const d = buf.getChannelData(0); let n = 0;
        const a = Math.round(t0 * buf.sampleRate), b = Math.round(t1 * buf.sampleRate);
        for (let i = a + 1; i < b; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) n++;
        return n / 2 / (t1 - t0);
      };
      try {
        S.voice = null;
        const mk = (from, loop) => ({ name: 'tone', duration: secs, audioBuffer: ab, gainDb: 0, duck: false, loop, from });
        S.music = mk(0, false); const m0 = await api.mixAudio(S);
        S.music = mk(2, false); const m2 = await api.mixAudio(S);
        S.music = mk(2, true); const l2 = await api.mixAudio(S);
        return { at0: hz(m0, 0.6, 1.4), at2: hz(m2, 0.6, 1.4), loop: hz(l2, 2.6, 3.4), ui: !!document.querySelector('#reel-music-from') && !!document.querySelector('#reel-music-listen') };
      } finally { S.music = keep.music; S.voice = keep.voice; }
    });
    console.log('  music from: ' + JSON.stringify(mf));
    check(Math.abs(mf.at0 - 440) < 15, 'music from 0:00 starts with the track\'s opening (' + mf.at0.toFixed(0) + ' Hz ≈ 440)');
    check(Math.abs(mf.at2 - 880) < 20, 'music from 0:02 starts 2 s into the track (' + mf.at2.toFixed(0) + ' Hz ≈ 880)');
    check(Math.abs(mf.loop - 880) < 20, 'a looped track goes back to 0:02, not to the intro (' + mf.loop.toFixed(0) + ' Hz ≈ 880)');
    check(mf.ui, '"Start the track at" and Listen are in the Sound pane');

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
