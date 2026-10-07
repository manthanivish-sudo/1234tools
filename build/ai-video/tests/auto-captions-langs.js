/*
 * Auto Captions in other languages, in headless Chrome against a local
 * server: real speech in, checked against the sentences that were spoken.
 *
 *   node build/ai-video/tests/auto-captions-langs.js --samples <dir> [--root <export dir>] [--port 8886]
 *        [--out <dir>] [--langs hi,zh,es,...]
 *
 * <dir> holds short clips and a manifest.json: [{ lang, file, text, licence,
 * source_url }, …]. The clips are NOT in the repository: use public-domain
 * or CC0 recordings (Mozilla Common Voice is CC0; the run that wrote the
 * figures in the wave-S report used five Common Voice 17.0 test clips per
 * language) and keep them outside the repo.
 *
 * For each language the clips are decoded by the page, joined with 0.4 s of
 * silence and transcribed twice by the engine (window.AIVidWhisper): once
 * with the language chosen, once with Auto-detect. Checked, against the
 * manifest's sentences only (never against the engine's own output):
 *   - with the language chosen, the transcript is written in that
 *     language's script (Arabic, Han, kana, Cyrillic or Latin) — so the
 *     prompt really selects the language;
 *   - recall of the spoken words (characters for Chinese and Japanese, which
 *     have no spaces) is at least the floor below for the language;
 *   - Hindi and Bengali, where Whisper tiny itself fails (the Python
 *     reference, build/ai-video/prepare-whisper.py, writes the same English
 *     and the same unreadable bytes): no U+FFFD reaches the transcript, and
 *     the engine reports the failure (issues) so the page can say so;
 *   - Auto-detect names the right language for at least 8 of the 12;
 *   - for Chinese and Japanese the words come from a segmenter, not spaces:
 *     more than one word per segment and no space added between them in
 *     the caption files.
 * Then, in the page itself (UI): the language choice is remembered in the
 * versioned localStorage key across a reload; a Hindi clip transcribed
 * through the page lands in a textarea with lang="hi"; an Arabic cue is laid
 * out right to left (the first spoken word lights up on the right); and no
 * request leaves 127.0.0.1. Prints a recall table. Exits non-zero on failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core'); }
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8886));
const ROOT = flag('root', null);
const OUT = flag('out', path.join(__dirname, 'out-langs'));
const SAMPLES = flag('samples', null);
const ONLY = flag('langs', null);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!SAMPLES || SAMPLES === true) { console.error('pass --samples <dir with manifest.json>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

/* The script each language is written in, and the recall floor. The floors
   are what Whisper tiny managed on the Common Voice clips, rounded down with
   room to spare: they catch a broken pipeline (wrong prompt, wrong script,
   garbled bytes), not a model that is merely weak in a language. */
const SCRIPT = {
  hi: /\p{Script=Devanagari}/u, bn: /\p{Script=Bengali}/u, ar: /\p{Script=Arabic}/u, ur: /\p{Script=Arabic}/u,
  zh: /\p{Script=Han}/u, ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u, ru: /\p{Script=Cyrillic}/u,
  es: /\p{Script=Latin}/u, fr: /\p{Script=Latin}/u, pt: /\p{Script=Latin}/u, id: /\p{Script=Latin}/u, de: /\p{Script=Latin}/u, en: /\p{Script=Latin}/u
};
/* recall measured on 2026-10-06: es 59%, de 64%, fr 52%, ja 88%, ar 45%,
   ur 42%, ru 40%, id 28%, zh 15%, pt 5%, hi 0%, bn 0% */
const FLOOR = { es: 0.4, de: 0.4, fr: 0.35, ja: 0.5, ar: 0.3, ur: 0.25, ru: 0.25, id: 0.15, zh: 0.1, pt: 0, hi: 0, bn: 0 };
/* the languages Whisper tiny cannot write: checked for honesty, not accuracy */
const FAILS = new Set(['hi', 'bn']);
const CHARS = new Set(['zh', 'ja']);

const fails = [];
const check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (!ok) fails.push(what); };
const tokens = (s, lang) => {
  const t = String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ');
  return CHARS.has(lang) ? Array.from(t.replace(/\s+/g, '')) : t.split(/\s+/).filter(Boolean);
};
function recall(known, got, lang) {
  const pool = tokens(got, lang);
  const want = tokens(known, lang);
  let hit = 0;
  for (const w of want) { const i = pool.indexOf(w); if (i >= 0) { hit++; pool.splice(i, 1); } }
  return want.length ? hit / want.length : 0;
}
function scriptShare(text, lang) {
  const letters = Array.from(String(text)).filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  return letters.filter((c) => SCRIPT[lang].test(c)).length / letters.length;
}
const { serve } = require('../../tests/serve.js');

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(SAMPLES, 'manifest.json'), 'utf8'));
  const byLang = {};
  for (const m of manifest) { if (ONLY && ONLY !== true && ONLY.split(',').indexOf(m.lang) < 0) continue; (byLang[m.lang] = byLang[m.lang] || []).push(m); }
  for (const m of manifest) if (!/^(CC0|public domain)/i.test(m.licence || '')) throw new Error(m.file + ': licence ' + m.licence + ' is not CC0 or public domain');
  const server = ROOT ? await serve(ROOT, PORT) : null;
  /* the clips are served from their own folder, not from the site */
  const http = require('http');
  const clipServer = http.createServer((req, res) => {
    const f = path.join(SAMPLES, decodeURIComponent(req.url.replace(/^\/+/, '').split('?')[0]));
    if (!f.startsWith(path.resolve(SAMPLES)) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => clipServer.listen(PORT + 1, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1400,1000', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebGPU'], protocolTimeout: 900000 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  const net = [];
  page.on('response', (r) => { const u = r.url(); if (!/^(https?:\/\/127\.0\.0\.1|blob:|data:)/.test(u)) net.push(u); });
  page.on('pageerror', (e) => { console.log('  [pageerror]', e.message); fails.push('pageerror: ' + e.message); });
  const rows = [];
  try {
    await page.goto('http://127.0.0.1:' + PORT + '/ai-video/auto-captions/', { waitUntil: 'networkidle0', timeout: 120000 });
    await page.evaluate(() => window.AIVidWhisper.load());
    for (const lang of Object.keys(byLang)) {
      const clips = byLang[lang];
      const known = clips.map((c) => c.text).join(' ');
      const r = await page.evaluate(async (urls, lang) => {
        const Wh = window.AIVidWhisper;
        const parts = [];
        for (const u of urls) { const b = await (await fetch(u)).blob(); const d = await Wh.decodeAudio(new File([b], 'clip.mp3', { type: 'audio/mpeg' })); parts.push(d.samples); }
        const gap = 0.4 * 16000;
        const all = new Float32Array(parts.reduce((s, p) => s + p.length + gap, 0));
        let o = 0; for (const p of parts) { all.set(p, o); o += p.length + gap; }
        const forced = await Wh.transcribe(all, { language: lang });
        const auto = await Wh.transcribe(all, { language: 'auto' });
        const AC = window.AIImg.tools['auto-captions'];
        const files = AC.fileCues(forced.segments);
        return {
          seconds: all.length / 16000, text: forced.segments.map((s) => s.text).join(' '), timing: forced.timing,
          words: forced.segments.map((s) => s.words.length), detected: auto.language, p: auto.detection && auto.detection.probability,
          autoText: auto.segments.map((s) => s.text).join(' '), fileLines: files.map((c) => c.lines.join(' / ')), issues: forced.issues || []
        };
      }, clips.map((c) => 'http://127.0.0.1:' + (PORT + 1) + '/' + c.file), lang);
      const rec = recall(known, r.text, lang);
      const share = scriptShare(r.text, lang);
      console.log('\n' + lang + ' — ' + clips.length + ' clips, ' + r.seconds.toFixed(1) + ' s; timing ' + r.timing);
      console.log('  spoken:  ' + known);
      console.log('  heard:   ' + r.text);
      console.log('  auto:    ' + r.detected + ' (' + Math.round((r.p || 0) * 100) + '%) ' + r.autoText.slice(0, 120));
      if (FAILS.has(lang)) {
        console.log('  (Whisper tiny cannot write ' + lang + ': script ' + Math.round(share * 100) + '%, issues ' + JSON.stringify(r.issues) + ')');
        check(!/\uFFFD/.test(r.text), lang + ': no unreadable characters reach the transcript');
        check(share >= 0.8 || r.issues.length > 0, lang + ': the engine reports the failure instead of passing it off as a transcript');
      } else {
        check(share >= 0.8, lang + ': transcript is in the expected script (' + Math.round(share * 100) + '% of letters)');
        check(rec >= (FLOOR[lang] || 0), lang + ': recall ' + Math.round(rec * 100) + '% ≥ floor ' + Math.round((FLOOR[lang] || 0) * 100) + '%');
      }
      console.log('  ' + (r.detected === lang ? 'ok  ' : 'note') + ' ' + lang + ': Auto-detect named ' + r.detected);
      if (CHARS.has(lang)) {
        check(r.words.some((n) => n > 1), lang + ': words come from a segmenter (' + r.words.join(', ') + ' words per segment)');
        const added = r.fileLines.some((l) => / (?![/])/.test(l.replace(/ \/ /g, '')));
        check(!added, lang + ': no spaces added between words in the caption files');
      }
      rows.push({ lang, seconds: r.seconds, recall: rec, share, detected: r.detected, p: r.p });
    }

    const right = rows.filter((x) => x.detected === x.lang).length;
    check(rows.length < 12 || right >= 8, 'Auto-detect named the right language for ' + right + ' of ' + rows.length + ' (at least 8 of 12)');

    /* the remembered choice */
    await page.select('#aivid-lang', 'hi');
    const stored = await page.evaluate(() => localStorage.getItem('aivid-auto-captions:v1'));
    await page.reload({ waitUntil: 'networkidle0' });
    const after = await page.$eval('#aivid-lang', (s) => s.value);
    check(/"v":1/.test(stored || '') && /"lang":"hi"/.test(stored || '') && after === 'hi', 'the language choice is kept in aivid-auto-captions:v1 across a reload (' + after + ')');

    /* a Hindi clip through the page */
    const hi = (byLang.hi || [])[0];
    if (hi) {
      const input = await page.$('.aiimg input[type=file]');
      await input.uploadFile(path.join(SAMPLES, hi.file));
      await page.waitForFunction(() => { const s = document.querySelector('.aiimg-pane[data-pane=words] .aiimg-status'); return s && (/ready$/.test(s.textContent.trim()) || /failed|could not|Cancelled/i.test(s.textContent)); }, { timeout: 300000, polling: 300 });
      const st = await page.$eval('.aiimg-pane[data-pane=words] .aiimg-status', (e) => e.textContent.trim());
      const ta = await page.$$eval('.aivid-seg-text', (t) => t.map((x) => ({ v: x.value, lang: x.lang, dir: x.dir })));
      console.log('\n  page: ' + st + '\n  textareas: ' + JSON.stringify(ta));
      check(/Hindi/.test(st) && /ready$/.test(st), 'the page transcribes a Hindi clip as Hindi');
      check(ta.length > 0 && ta.every((x) => x.lang === 'hi' && x.dir === 'auto'), 'transcript boxes carry lang="hi" and dir="auto"');
      const warn = await page.$eval('.aiimg > .io-msg', (e) => e.className + ' | ' + e.textContent).catch(() => '');
      console.log('  io-msg: ' + warn);
      const deva = ta.length > 0 && scriptShare(ta.map((x) => x.v).join(' '), 'hi') >= 0.8;
      check(deva || (/is-warn/.test(warn) && /different script/.test(warn)), 'the page either shows Devanagari or warns that the model wrote another script');
      const hint = await page.$eval('#aivid-lang-hint', (e) => e.textContent);
      check(/weak in Hindi/.test(hint), 'the language hint says Whisper tiny is weak in Hindi');
      await page.screenshot({ path: path.join(OUT, 'hindi.png') });
    }

    /* right to left: in an Arabic cue the first word is drawn on the right */
    const rtl = await page.evaluate(() => {
      const AC = window.AIImg.tools['auto-captions'];
      const side = (words) => {
        const c = document.createElement('canvas'); c.width = 720; c.height = 400;
        const x = c.getContext('2d');
        const cues = [{ start: 0, end: 3, until: 3, lines: [words.map((w) => w.text).join(' ')], words }];
        AC.drawCaptions(x, 720, 400, 0.5, cues, { preset: 'karaoke', position: 'middle', size: 9, fill: '#ffffff', accent: '#ff0000' });
        const d = x.getImageData(0, 0, 720, 400).data;
        let sx = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60 && d[i + 3] > 200) { sx += (i / 4) % 720; n++; }
        return n ? sx / n / 720 : -1;
      };
      return {
        ar: side([{ text: 'مرحبا', start: 0, end: 1 }, { text: 'بالعالم', start: 1, end: 2 }, { text: 'الجميل', start: 2, end: 3 }]),
        en: side([{ text: 'Hello', start: 0, end: 1 }, { text: 'lovely', start: 1, end: 2 }, { text: 'world', start: 2, end: 3 }])
      };
    });
    console.log('  first-word highlight centre (0 = left, 1 = right): Arabic ' + rtl.ar.toFixed(2) + ', English ' + rtl.en.toFixed(2));
    check(rtl.ar > 0.6 && rtl.en >= 0 && rtl.en < 0.4, 'Arabic is laid out right to left, English left to right');
    check(net.length === 0, 'zero third-party requests' + (net.length ? ': ' + net.slice(0, 3).join(', ') : ''));
  } catch (e) {
    console.error('ERROR', e);
    fails.push('exception: ' + (e && e.message));
  } finally {
    await browser.close();
    clipServer.close();
    if (server) server.close();
  }
  console.log('\n  lang  seconds  recall  script  auto-detect');
  for (const r of rows) console.log('  ' + r.lang.padEnd(5) + ' ' + r.seconds.toFixed(1).padStart(6) + '  ' + (Math.round(r.recall * 100) + '%').padStart(6) + '  ' + (Math.round(r.share * 100) + '%').padStart(6) + '  ' + r.detected + ' ' + Math.round((r.p || 0) * 100) + '%');
  fs.writeFileSync(path.join(OUT, 'recall.json'), JSON.stringify(rows, null, 1));
  console.log('\n' + (fails.length ? 'FAILED: ' + fails.length + ' check(s)\n  - ' + fails.join('\n  - ') : 'all checks passed'));
  process.exit(fails.length ? 1 : 0);
})();
