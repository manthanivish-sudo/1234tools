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
 * Wave S added, each against an independent reference:
 *   - word timing: the synthesiser's own word boundaries (SpeakProgress) are
 *     the truth; the aligned word starts must be within 0.15 s on average
 *     (0.3 s at the 90th percentile) and beat the proportional split;
 *   - ASS: parsed here by a parser of this file's own — section headers, a
 *     23-field Style Format and Style line, a 10-field Events Format and
 *     Dialogue lines, times within 10 ms of the VTT's, \k tags that add up
 *     to each line and one per word, the chosen font and colours in the
 *     style, a keyword's colour, and \pos after a drag (moved by the arrow
 *     keys by exactly the step);
 *   - keywords: a word clicked in the transcript turns up in the keyword
 *     list and its colour appears on the preview (and not before);
 *   - looks: the four original looks draw pixel for pixel what the drawing
 *     code shipped before wave S drew (a copy of it is below); the four new
 *     ones differ from every other look, light the current word in the
 *     highlight colour (Word box: on the box around the middle word), and
 *     One word draws a single word;
 *   - drag: dragging the captions on the preview moves them there;
 *   - export, a second time: dragged low, Bold outline, auto emoji on — the
 *     exported frames carry the captions in the dragged band and the emoji's
 *     colour, at the same moments the preview does, and not without emoji.
 *
 *   node build/ai-video/tests/auto-captions.js [--root <export dir>] [--port 8727]
 *        [--wav <speech.wav>] [--out <dir>] [--skip-video] [--recorder]
 *
 * Without --wav the test sentence is spoken by Windows' own speech
 * synthesiser (PowerShell, System.Speech) into --out/speech.wav, so nothing
 * outside the repo is needed; on another OS pass --wav with a recording of
 * SENTENCE below.
 *
 * With --root the test serves that directory itself; without it, a server
 * is expected on --port already. --recorder forces the MediaRecorder path
 * (what Firefox would do) instead of WebCodecs. Exits non-zero on failure.
 * Screenshots and console.log go to --out (default: build/ai-video/tests/out).
 */
'use strict';
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core'); }

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8727));
const ROOT = flag('root', null);
const WAV_FLAG = flag('wav', null);
const OUT = flag('out', path.join(__dirname, 'out'));
const SKIP_VIDEO = flag('skip-video', false) === true;
const RECORDER = flag('recorder', false) === true;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SENTENCE = 'Hello and welcome. This is a test of automatic captions for short videos. Nothing is uploaded, everything runs in the browser.';
fs.mkdirSync(OUT, { recursive: true });

/** The speech sample: the recording given with --wav, or SENTENCE spoken by
 *  the Windows speech synthesiser as 16 kHz mono PCM, which is what Whisper
 *  hears anyway. */
function speechSample() {
  if (WAV_FLAG && WAV_FLAG !== true) return path.resolve(WAV_FLAG);
  if (process.platform !== 'win32') throw new Error('pass --wav <file>: the built-in speech synthesis needs Windows (PowerShell System.Speech)');
  const out = path.join(path.resolve(OUT), 'speech.wav');
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)',
    "$s.SetOutputToWaveFile('" + path.win32.normalize(out) + "', $f)",
    /* the synthesiser reports where each word starts in the audio: the reference for word timing */
    '$w = New-Object System.Collections.ArrayList',
    '$s.add_SpeakProgress([System.EventHandler[System.Speech.Synthesis.SpeakProgressEventArgs]] { param($o, $e) [void]$w.Add([ordered]@{ text = $e.Text; ms = $e.AudioPosition.TotalMilliseconds }) })',
    "$s.Speak('" + SENTENCE.replace(/'/g, "''") + "')",
    '$s.Dispose()',
    "ConvertTo-Json -InputObject @($w) -Compress | Set-Content -Encoding utf8 '" + path.win32.normalize(out.replace(/\.wav$/, '.words.json')) + "'"
  ].join('; ');
  const r = require('child_process').spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error('speech synthesis failed: ' + ((r.stderr || r.stdout || '').trim() || 'no output'));
  console.log('spoke the test sentence into ' + out + ' (' + fs.statSync(out).size + ' bytes)');
  return out;
}
const WAV = speechSample();

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
const { serve } = require('../../tests/serve.js');

/* the synthesiser's word boundaries, when this run spoke the sentence itself */
function refWords() {
  const f = WAV.replace(/\.wav$/i, '.words.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')).map((w) => ({ text: w.text, start: w.ms / 1000 })); } catch (e) { return null; }
}
/** Start-time errors of `got` words against the reference, matched in order by their letters. */
function timingErrors(ref, got) {
  const n = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const errs = [];
  let j = 0;
  for (const r of ref) {
    for (let k = j; k < Math.min(j + 4, got.length); k++) if (n(got[k].text) === n(r.text)) { errs.push(Math.abs(got[k].start - r.start)); j = k + 1; break; }
  }
  errs.sort((a, b) => a - b);
  const mean = errs.reduce((s, e) => s + e, 0) / Math.max(1, errs.length);
  return { n: errs.length, mean, p90: errs.length ? errs[Math.min(errs.length - 1, Math.floor(errs.length * 0.9))] : Infinity, max: errs.length ? errs[errs.length - 1] : Infinity };
}

/** An ASS parser of this test's own: sections, Format lines and the fields of every Style and Dialogue line. */
function parseASS(text) {
  const out = { sections: {}, info: {}, styleFormat: null, styles: [], eventFormat: null, events: [], bad: [] };
  let sec = null;
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    const h = /^\[(.+)\]$/.exec(line);
    if (h) { sec = h[1]; out.sections[sec] = true; continue; }
    const m = /^([^:]+):\s?(.*)$/.exec(line);
    if (!m) { out.bad.push(line); continue; }
    const key = m[1], val = m[2];
    if (sec === 'Script Info') out.info[key] = val;
    else if (sec === 'V4+ Styles') {
      if (key === 'Format') out.styleFormat = val.split(',').map((s) => s.trim());
      else if (key === 'Style') out.styles.push(val.split(','));
    } else if (sec === 'Events') {
      if (key === 'Format') out.eventFormat = val.split(',').map((s) => s.trim());
      else if (key === 'Dialogue') {
        /* the Text field is last and may hold commas: split the first nine only */
        const f = []; let rest = val;
        for (let i = 0; i < 9; i++) { const k = rest.indexOf(','); if (k < 0) break; f.push(rest.slice(0, k)); rest = rest.slice(k + 1); }
        f.push(rest);
        out.events.push(f);
      }
    }
  }
  return out;
}
const assSec = (t) => { const m = /^(\d+):(\d\d):(\d\d)\.(\d\d)$/.exec(String(t).trim()); return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 100 : NaN; };

/* The caption drawing exactly as shipped before wave S (engine/aivid-auto-captions.js,
   2026-10-05): the four original looks must still draw these pixels. */
function legacyDrawFactory() {
  const MAX_LINE = 42;
  /** Greedy line fill: arrays of words, each line at most maxChars. */
  function wrapWords(words, maxChars) {
    const lines = [];
    let cur = [], len = 0;
    for (const w of words) {
      const add = (cur.length ? 1 : 0) + w.text.length;
      if (cur.length && len + add > maxChars) { lines.push(cur); cur = [w]; len = w.text.length; }
      else { cur.push(w); len += add; }
    }
    if (cur.length) lines.push(cur);
    return lines;
  }
  const fontFor = (st, px) => (st.preset === 'minimal' ? 600 : 800) + ' ' + px + 'px "' + (st.font || 'Sora') + '", "Inter", Arial, sans-serif';
  const hexA = (hex, a) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ''); return m ? 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')' : 'rgba(0,0,0,' + a + ')'; };
  function drawCaptions(ctx, W, H, t, cues, st) {
    let cue = null;
    for (const c of cues) { if (t >= c.start && t < c.until) { cue = c; break; } }
    if (!cue) return;
    const portrait = H > W;
    const safeW = W * 0.86;
    let px = Math.max(8, (Number(st.size) || 7) / 100 * W);
    const words = cue.words;
    const text = (w) => (st.uppercase ? w.text.toUpperCase() : w.text);
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    let lines = cue.lines.length > 1 ? wrapWords(words, MAX_LINE) : [words];
    const widest = () => { ctx.font = fontFor(st, px); return Math.max(...lines.map((l) => l.reduce((s, w) => s + ctx.measureText(text(w)).width, 0) + (l.length - 1) * px * 0.28)); };
    for (let k = 0; k < 8 && widest() > safeW; k++) px *= 0.9;
    ctx.font = fontFor(st, px);
    const lineH = px * 1.22;
    const blockH = lineH * lines.length;
    let cy = st.position === 'top' ? H * (portrait ? 0.16 : 0.13) : st.position === 'middle' ? H * 0.5 : H * (portrait ? 0.78 : 0.86);
    if (st.maxBottom && st.position !== 'top' && st.position !== 'middle') cy = Math.min(cy, st.maxBottom - blockH / 2 - px * 0.3);
    const y0 = cy - blockH / 2 + lineH / 2;
    const strokeW = px * (st.preset === 'outline' ? 0.17 : st.preset === 'minimal' ? 0 : 0.11);
    lines.forEach((line, li) => {
      const widths = line.map((w) => ctx.measureText(text(w)).width);
      const gap = px * 0.28;
      const lineW = widths.reduce((s, w) => s + w, 0) + gap * (line.length - 1);
      let x = (W - lineW) / 2;
      const y = y0 + li * lineH;
      if (st.preset === 'minimal') {
        const padX = px * 0.4, padY = px * 0.22, r = px * 0.28;
        ctx.fillStyle = hexA(st.box || '#0b1020', 0.78);
        ctx.beginPath();
        ctx.roundRect(x - padX, y - lineH / 2 + px * 0.02 - padY / 2, lineW + padX * 2, lineH + padY - px * 0.04, r);
        ctx.fill();
      }
      line.forEach((w, i) => {
        const spoken = t >= w.start, current = t >= w.start && t < w.end;
        const s = text(w);
        const wx = x + widths[i] / 2, wy = y;
        let scale = 1, fill = st.fill || '#ffffff';
        if (st.preset === 'karaoke' && spoken) fill = st.accent || '#f7c948';
        if (st.preset === 'pop' && current) { fill = st.accent || '#f7c948'; scale = 1.18; }
        ctx.save();
        ctx.translate(wx, wy); ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        if (st.preset !== 'minimal') {
          ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = px * 0.22; ctx.shadowOffsetY = px * 0.05;
          ctx.fillStyle = fill; ctx.fillText(s, 0, 0);
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
          if (strokeW > 0) { ctx.lineWidth = strokeW * 2; ctx.strokeStyle = st.stroke || '#000000'; ctx.strokeText(s, 0, 0); }
        }
        ctx.fillStyle = fill; ctx.fillText(s, 0, 0);
        ctx.restore();
        x += widths[i] + gap;
      });
    });
    ctx.restore();
  }
  return drawCaptions;
}
/* set an <input type=color> or <select> the way a person would, so the page's listeners run */
const setValue = (page, sel, v) => page.evaluate((sel, v) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const fetchLink = (page, ext) => page.evaluate(async (ext) => { const a = document.querySelector('.aiimg-pane[data-pane=words] a[download$=".' + ext + '"]'); return a ? (await (await fetch(a.href)).text()) : ''; }, ext);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

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

    /* ---- wave S: word timing against the synthesiser's own word boundaries ---- */
    const ref = refWords();
    const wavB64Timing = fs.readFileSync(WAV).toString('base64');
    const timed = await page.evaluate(async (b64) => {
      const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const Wh = window.AIVidWhisper;
      const d = await Wh.decodeAudio(new File([u8], 'speech.wav', { type: 'audio/wav' }));
      const r = await Wh.transcribe(d.samples, { language: 'en' });
      /* the fallback for comparison: the same segments, split by length */
      const prop = r.segments.flatMap((s) => Wh.wordsFor({ start: s.start, end: s.end, text: s.text }));
      return { timing: r.timing, words: r.words.map((w) => ({ text: w.text, start: w.start, end: w.end })), prop: prop.map((w) => ({ text: w.text, start: w.start })) };
    }, wavB64Timing);
    check(timed.timing === 'aligned', 'the engine aligns words with the cross-attention (timing ' + timed.timing + ')');
    const timingNote = await page.$eval('.aivid-timing', (e) => e.textContent).catch(() => '');
    check(/from the model itself/.test(timingNote), 'the page says the word timings come from the model');
    if (ref) {
      const a = timingErrors(ref, timed.words), p = timingErrors(ref, timed.prop);
      console.log('  word starts vs the synthesiser: aligned ' + a.n + '/' + ref.length + ' words, mean ' + a.mean.toFixed(3) + ' s, p90 ' + a.p90.toFixed(3) + ' s, max ' + a.max.toFixed(3) +
        ' s | proportional mean ' + p.mean.toFixed(3) + ' s, p90 ' + p.p90.toFixed(3) + ' s, max ' + p.max.toFixed(3) + ' s');
      check(a.n >= ref.length * 0.7, 'aligned words matched to the reference (' + a.n + ' of ' + ref.length + ')');
      check(a.mean <= 0.15 && a.p90 <= 0.3, 'aligned word starts within 0.15 s on average and 0.3 s at p90');
      check(a.mean < p.mean, 'aligned timing beats the proportional split (' + a.mean.toFixed(3) + ' s vs ' + p.mean.toFixed(3) + ' s)');
    } else console.log('  (no synthesiser word boundaries for --wav input: timing accuracy not measured)');

    /* ---- wave S: ASS, parsed here ---- */
    const vttNow = await fetchLink(page, 'vtt');
    const ass1 = await fetchLink(page, 'ass');
    fs.writeFileSync(path.join(OUT, 'captions.ass'), ass1);
    const A1 = parseASS(ass1);
    const vcues = parseCues(vttNow, true);
    check(A1.sections['Script Info'] && A1.sections['V4+ Styles'] && A1.sections.Events && A1.bad.length === 0, 'ASS has [Script Info], [V4+ Styles], [Events] and nothing unparseable');
    check(A1.info.ScriptType === 'v4.00+' && Number(A1.info.PlayResX) > 0 && Number(A1.info.PlayResY) > 0, 'ASS Script Info: v4.00+, PlayResX × PlayResY ' + A1.info.PlayResX + '×' + A1.info.PlayResY);
    check(A1.styleFormat && A1.styleFormat.length === 23 && A1.styles.length >= 1 && A1.styles.every((s) => s.length === 23), 'ASS Style Format has 23 fields and so does every Style line');
    check(A1.eventFormat && A1.eventFormat.length === 10 && A1.events.length > 0 && A1.events.every((e) => e.length === 10), 'ASS Events Format has 10 fields and so does every Dialogue line');
    let timesOk = A1.events.length === vcues.length;
    A1.events.forEach((e, i) => { const v = vcues[i]; if (!v || Math.abs(assSec(e[1]) - v.start) > 0.01 || Math.abs(assSec(e[2]) - v.end) > 0.01) timesOk = false; });
    check(timesOk, 'ASS times round-trip within 10 ms of the VTT (' + A1.events.length + ' events, ' + vcues.length + ' cues)');
    let kOk = A1.events.length > 0;
    for (const e of A1.events) {
      const ks = [...e[9].matchAll(/\\k(\d+)/g)].map((m) => Number(m[1]));
      const words = e[9].replace(/\{[^}]*\}/g, '').replace(/\\N/g, ' ').split(/\s+/).filter(Boolean);
      const dur = Math.round(assSec(e[2]) * 100) - Math.round(assSec(e[1]) * 100);
      if (ks.length !== words.length || Math.abs(ks.reduce((s, k) => s + k, 0) - dur) > 1) kOk = false;
    }
    check(kOk, 'Karaoke: one \\k tag per word, adding up to each line');
    const fmt = (A) => Object.fromEntries(A.styleFormat.map((k, i) => [k, A.styles[0][i]]));
    await page.click('.aiimg-tabs [data-pane=style]');
    await setValue(page, '#aivid-font', 'Georgia');
    await setValue(page, '#aivid-fill', '#ff0000');
    await setValue(page, '#aivid-accent', '#00ff00');
    await pause(500);
    const S2 = fmt(parseASS(await fetchLink(page, 'ass')));
    console.log('  ASS style after Georgia / #ff0000 / #00ff00: ' + ['Fontname', 'Fontsize', 'PrimaryColour', 'SecondaryColour', 'OutlineColour', 'Outline', 'Alignment', 'MarginV'].map((k) => k + '=' + S2[k]).join(' '));
    check(S2.Fontname === 'Georgia' && S2.PrimaryColour === '&H0000FF00' && S2.SecondaryColour === '&H000000FF' && Number(S2.Outline) > 0 && S2.Alignment === '2', 'ASS style carries the chosen font, colours (karaoke: sung in the highlight), outline and bottom alignment');
    await setValue(page, '#aivid-font', 'Sora');
    await setValue(page, '#aivid-fill', '#ffffff');
    await setValue(page, '#aivid-accent', '#f7c948');

    /* ---- wave S: keywords, clicked in the transcript ---- */
    const scan = () => page.evaluate(async () => {
      /* the preview at 40 moments through the clip: frames holding the keyword colour (#ff4d6d) */
      const r = document.querySelector('.aiimg-transport input[type=range]'), c = document.querySelector('.aivid-canvas');
      let frames = 0;
      for (let i = 1; i < 40; i++) {
        r.value = Math.round(i * 1000 / 40); r.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let k = 0; k < d.length; k += 4) if (Math.abs(d[k] - 255) < 30 && Math.abs(d[k + 1] - 77) < 30 && Math.abs(d[k + 2] - 109) < 30) n++;
        if (n > 20) frames++;
      }
      return frames;
    });
    const before = await scan();
    await page.click('.aiimg-tabs [data-pane=words]');
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=words] button')) if (/Mark keywords/.test(b.textContent)) b.click(); });
    const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('.aivid-word')].find((x) => /^captions/i.test(x.textContent)); if (!b) return null; b.click(); return b.getAttribute('aria-pressed'); });
    const keyList = await page.$eval('#aivid-keywords', (e) => e.value);
    const after = await scan();
    console.log('  keyword: pressed=' + clicked + ', list "' + keyList + '", preview frames in the keyword colour: before ' + before + ', after ' + after);
    check(clicked === 'true' && /captions/i.test(keyList), 'clicking "captions" in the transcript marks it as a keyword');
    check(before === 0 && after > 0, 'the keyword colour appears on the preview only once the keyword is marked');
    const assKey = await fetchLink(page, 'ass');
    check(/\\1c&H6D4DFF&/.test(assKey), 'ASS colours the keyword (\\1c&H6D4DFF&)');
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aivid-word.is-key')) b.click(); for (const b of document.querySelectorAll('.aiimg-pane[data-pane=words] button')) if (/Back to editing/.test(b.textContent)) b.click(); });

    /* ---- wave S: the eight looks ---- */
    const looks = await page.evaluate((legacySrc) => {
      const AC = window.AIImg.tools['auto-captions'];
      const legacy = (0, eval)('(' + legacySrc + ')')();
      const words = [{ text: 'Hello', start: 0, end: 1 }, { text: 'brave', start: 1, end: 2 }, { text: 'world', start: 2, end: 3 }];
      const cues = [{ start: 0, end: 3, until: 3.35, lines: ['Hello brave world'], words }];
      const W = 540, H = 960, t = 1.5;
      const render = (fn, preset, extra) => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'); x.fillStyle = '#20304a'; x.fillRect(0, 0, W, H);
        fn(x, W, H, t, cues, Object.assign({ preset, mode: '3', position: 'bottom', size: 8, font: 'Sora', fill: '#ffffff', accent: '#00e000', stroke: '#000000', box: '#0b1020', uppercase: false }, extra || {}));
        return x.getImageData(0, 0, W, H).data;
      };
      const ids = AC.STYLES.map((s) => s[0]);
      const img = {}; for (const id of ids) img[id] = render(AC.drawCaptions, id);
      const same = {}; for (const id of ['karaoke', 'pop', 'outline', 'minimal']) { const a = img[id], b = render(legacy, id); let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; same[id] = d; }
      const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) d++; return d; };
      const minDiff = {}; for (const a of ids) { let m = Infinity; for (const b of ids) if (a !== b) m = Math.min(m, diff(img[a], img[b])); minDiff[a] = m; }
      /* the highlight colour (#00e000), and where it sits */
      const green = {}; for (const id of ids) { const d = img[id]; let n = 0, sx = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 90 && d[i + 1] > 170 && d[i + 2] < 90) { n++; sx += (i / 4) % W; } green[id] = { n, cx: n ? sx / n / W : -1 }; }
      const ink = (d) => { let x0 = W, x1 = -1; for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; if (l > 600) { const x = (i / 4) % W; if (x < x0) x0 = x; if (x > x1) x1 = x; } } return x1 - x0; };
      return { ids, same, minDiff, green, inkStack: ink(img.stack), inkOutline: ink(img.outline) };
    }, legacyDrawFactory.toString());
    console.log('  looks: ' + looks.ids.join(', ') + '\n  pixels differing from the pre-wave-S drawing: ' + JSON.stringify(looks.same) + '\n  fewest pixels differing from any other look: ' + JSON.stringify(looks.minDiff) + '\n  highlight pixels (count, centre x): ' + JSON.stringify(looks.green));
    check(looks.ids.length === 8 && ['box', 'yellow', 'neon', 'stack'].every((k) => looks.ids.includes(k)), 'STYLES lists the eight looks');
    check(Object.values(looks.same).every((d) => d === 0), 'Karaoke, Pop, Bold outline and Minimal draw exactly what they drew before wave S');
    check(looks.ids.every((k) => looks.minDiff[k] > 200), 'every look draws differently from every other (at least 200 pixels apart)');
    check(['karaoke', 'pop', 'box', 'yellow', 'neon'].every((k) => looks.green[k].n > 50), 'Karaoke, Pop, Word box, Bold capitals and Neon light the spoken word in the highlight colour');
    check(looks.green.box.cx > 0.35 && looks.green.box.cx < 0.65, 'Word box puts the box on the middle (current) word (centre ' + looks.green.box.cx.toFixed(2) + ')');
    check(looks.inkStack > 0 && looks.inkStack < looks.inkOutline * 0.6, 'One word draws a single word (' + looks.inkStack + ' px wide vs ' + looks.inkOutline + ' px for the line)');

    /* ---- wave S: drag the captions on the preview, then the arrow keys ---- */
    await page.click('.aiimg-tabs [data-pane=style]');
    await page.evaluate(() => { const r = document.querySelector('.aiimg-transport input[type=range]'); r.value = 300; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await pause(300);
    /* bring the caption band to the middle of the viewport, clear of the consent banner at the bottom */
    await page.evaluate(() => { const r = document.querySelector('.aivid-canvas').getBoundingClientRect(); window.scrollBy(0, r.top + r.height * 0.6 - window.innerHeight / 2); });
    await pause(200);
    const box = await page.$eval('.aivid-canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const under = await page.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e ? e.className : ''; }, box.x + box.w / 2, box.y + box.h * 0.78);
    check(/aivid-canvas/.test(under), 'the caption band of the preview is not covered (' + under + ')');
    await page.mouse.move(box.x + box.w / 2, box.y + box.h * 0.78);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.w / 2, box.y + box.h * (0.78 - 0.38 * i / 8));
    await page.mouse.up();
    await pause(300);
    const dragged = await page.evaluate(() => {
      const c = document.querySelector('.aivid-canvas'), x = c.getContext('2d');
      const band = (y0, y1) => { const d = x.getImageData(0, Math.round(y0 * c.height), c.width, Math.round((y1 - y0) * c.height)).data; let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)); };
      return { pos: document.querySelector('#aivid-pos').value, high: band(0.33, 0.47), low: band(0.71, 0.85) };
    });
    console.log('  after the drag: position ' + dragged.pos + ', luminance std in the new band ' + dragged.high.toFixed(1) + ', in the old band ' + dragged.low.toFixed(1));
    check(dragged.pos === 'custom' && dragged.high > 12 && dragged.high > dragged.low * 2, 'dragging the captions on the preview moves them up to where they were dropped');
    const posOf = (a) => { const m = /\\pos\((\d+),(\d+)\)/.exec(a); return m ? [Number(m[1]), Number(m[2])] : null; };
    await pause(400);
    const p0 = posOf(await fetchLink(page, 'ass'));
    await page.focus('.aivid-canvas');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    await pause(400);
    const assPos = await fetchLink(page, 'ass');
    const p1 = posOf(assPos);
    const resY = Number(parseASS(assPos).info.PlayResY);
    console.log('  ASS \\pos after the drag ' + JSON.stringify(p0) + ', after three ArrowDown ' + JSON.stringify(p1) + ' (PlayResY ' + resY + ')');
    check(!!p0 && !!p1 && Math.abs(p1[1] - p0[1] - resY * 0.03) <= 2 && p1[0] === p0[0], 'ASS carries the dragged position (\\an5\\pos), and three arrow presses move it 3% down');
    await setValue(page, '#aivid-pos', 'bottom');
    await pause(200);

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

      /* ---- wave S: a second export, dragged low, Bold outline, auto emoji ---- */
      await page.click('.aiimg-tabs [data-pane=style]');
      await page.evaluate(() => { document.querySelector('.aivid-swatch[data-preset=outline]').click(); });
      await page.evaluate(() => { const r = document.querySelector('.aiimg-transport input[type=range]'); r.value = 300; r.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.focus('.aivid-canvas');
      for (let i = 0; i < 3; i++) await page.keyboard.down('Shift'), await page.keyboard.press('ArrowDown'), await page.keyboard.up('Shift');
      /* the preview at 24 moments, without and with emoji: frames with emoji colour in the dragged band */
      const sample = (times) => page.evaluate(async (times) => {
        const c = document.querySelector('.aivid-canvas'), r = document.querySelector('.aiimg-transport input[type=range]');
        const dur = Number(document.querySelector('.aivid-video').duration) || 10;
        const out = [];
        for (const t of times) {
          r.value = Math.round(t / dur * 1000); r.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((res) => setTimeout(res, 120));
          await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
          const x = c.getContext('2d'), y0 = Math.round(0.86 * c.height), d = x.getImageData(0, y0, c.width, c.height - y0).data;
          let n = 0; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx - mn > 90 && mx > 120) n++; }
          out.push(n / (c.width * (c.height - y0)));
        }
        return out;
      }, times);
      const dur2 = made.duration;
      const times = Array.from({ length: 24 }, (_, i) => 0.2 + i * (dur2 - 0.6) / 23);
      const noEmoji = await sample(times);
      await page.evaluate(() => { const c = document.querySelector('#aivid-emoji'); if (!c.checked) c.click(); });
      const withEmoji = await sample(times);
      const SAT = 0.0005;
      const prevHits = withEmoji.map((v) => v > SAT);
      console.log('  preview, colourful share of the dragged band per moment, no emoji: ' + noEmoji.map((v) => (v * 1000).toFixed(1)).join(' ') + '\n  with emoji: ' + withEmoji.map((v) => (v * 1000).toFixed(1)).join(' '));
      check(noEmoji.every((v) => v <= SAT) && prevHits.filter(Boolean).length >= 2, 'emoji appear on the preview only with Auto emoji on (' + prevHits.filter(Boolean).length + ' of 24 moments)');
      await page.click('.aiimg-tabs [data-pane=export]');
      const before2 = await page.$$eval('.aiimg-result', (r) => r.length);
      await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Export the captioned video/.test(b.textContent)) b.click(); });
      await page.waitForFunction((n) => { const st = document.querySelector('.aivid-exstatus'); return document.querySelectorAll('.aiimg-result').length > n || /failed|Cancelled/.test(st ? st.textContent : ''); }, { timeout: 600000, polling: 500 }, before2);
      const ex2 = await page.evaluate(async (times) => {
        const v = document.querySelector('.aiimg-result video');
        const probe = document.createElement('video'); probe.muted = true; probe.playsInline = true; probe.src = v.src;
        await new Promise((res) => { probe.onloadedmetadata = res; probe.onerror = res; setTimeout(res, 10000); });
        const c = document.createElement('canvas'); c.width = probe.videoWidth || 1080; c.height = probe.videoHeight || 1920;
        const x = c.getContext('2d', { willReadFrequently: true });
        const band = (y0, y1) => { const d = x.getImageData(0, Math.round(y0 * c.height), c.width, Math.round((y1 - y0) * c.height)).data; let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)); };
        const sat = [], low = [], old = [];
        for (const t of times) {
          await new Promise((res) => { probe.onseeked = () => setTimeout(res, 150); probe.onerror = res; probe.currentTime = t; setTimeout(res, 5000); });
          x.drawImage(probe, 0, 0, c.width, c.height);
          const y0 = Math.round(0.86 * c.height), d = x.getImageData(0, y0, c.width, c.height - y0).data;
          let n = 0; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx - mn > 90 && mx > 120) n++; }
          sat.push(n / (c.width * (c.height - y0))); low.push(band(0.88, 0.99)); old.push(band(0.70, 0.86));
        }
        return { sat, low, old, type: (await (await fetch(v.src)).blob()).type };
      }, times);
      const expHits = ex2.sat.map((v) => v > SAT);
      const agree = prevHits.filter((h, i) => h === expHits[i]).length;
      console.log('  export, colourful share per moment: ' + ex2.sat.map((v) => (v * 1000).toFixed(1)).join(' ') + '\n  caption band std, dragged band vs the old band (max): ' + Math.max(...ex2.low).toFixed(1) + ' vs ' + Math.max(...ex2.old).toFixed(1) + ' | preview and export agree at ' + agree + ' of 24 moments');
      check(Math.max(...ex2.low) > 12 && Math.max(...ex2.low) > Math.max(...ex2.old) * 2, 'the export draws the captions where they were dragged (low band), not in the old bottom band');
      check(expHits.filter(Boolean).length >= 2 && agree >= 20, 'the exported video carries the emoji at the same moments as the preview (' + agree + ' of 24 agree)');
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
