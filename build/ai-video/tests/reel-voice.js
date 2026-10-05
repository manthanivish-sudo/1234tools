/*
 * Drives the Reel Maker's "Generate voice" in headless Chrome against a local
 * server and proves it end to end:
 *
 *   1. the page says what the voice is: Kokoro-82M, 92 MB, Apache-2.0, a
 *      synthetic voice, the script never sent; the FAQ answers the labelling
 *      question; nothing under /engine/models/kokoro-82m/ is fetched before a
 *      button asks for it;
 *   2. the picker lists the 28 voices of the manifest (20 American, 8
 *      British; 15 women, 13 men), grouped by accent;
 *   3. Preview speaks one sentence in a British voice (non-silent);
 *   4. speed: the same sentence at 0.8× lasts longer than at 1.2×;
 *   5. Cancel stops a generation part-way and leaves the voiceover as it was;
 *   6. Generate makes S.voice (duration > 0, the plan, fitted scenes that
 *      each last their line plus the pause), captions timed from the script,
 *      and the mixed sound is not silent; the page kept repainting while the
 *      worker spoke (longest main-thread gap measured);
 *   7. Whisper tiny, on the device, hears the script's key words in the
 *      generated American voice and in a British one;
 *   8. the post caption says the voice is AI-generated and the labelling
 *      hint shows;
 *   9. the model was downloaded once, no request left 127.0.0.1, no page error.
 *
 *   node build/ai-video/tests/reel-voice.js --root <export dir> --port <port> [--out <dir>]
 */
'use strict';
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core'); }

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8729));
const ROOT = flag('root', null);
const OUT = path.resolve(flag('out', path.join(__dirname, 'out-voice')));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:' + PORT;
const SCRIPT = 'Stop guessing your taxes.\nType the amount and pick the rate.\nThe split is done in your browser, in a second.';
const KEY = ['stop', 'guessing', 'taxes', 'type', 'amount', 'pick', 'rate', 'split', 'done', 'browser', 'second'];
const GB_LINE = 'Merge your files in seconds, free, with nothing uploaded.';
const GB_KEY = ['merge', 'files', 'seconds', 'free', 'nothing', 'uploaded'];
fs.mkdirSync(OUT, { recursive: true });

const fails = [];
let passes = 0;
const check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (!ok) fails.push(what); else passes++; };
const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const hits = (key, got) => { const g = new Set(words(got)); return key.filter((k) => g.has(k)); };
const { serve } = require('../../tests/serve.js');

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const server = ROOT ? await serve(ROOT, PORT) : null;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 1800000,
    args: ['--window-size=1400,1000', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebGPU'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  const logs = [], errors = [];
  page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (/error/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
  page.on('pageerror', (e) => { errors.push(e.message); console.log('  [pageerror]', e.message); });
  /* every request, the page's and the voice worker's, once each (by request id) */
  const seen = new Map();
  const watch = (u, id) => { seen.set(id || ('x' + seen.size), u); };
  const all = () => [...seen.values()];
  const offsite = () => all().filter((u) => !/^(https?:\/\/127\.0\.0\.1[:/]|blob:|data:)/.test(u)).map((u) => u.slice(0, 140));
  const kokoroReqs = () => all().filter((u) => /\/engine\/models\/kokoro-82m\//.test(u)).map((u) => u.replace(BASE, ''));
  page.on('request', (r) => watch(r.url(), r.id));
  page.on('workercreated', async (w) => {
    try { const c = w.client; await c.send('Network.enable'); c.on('Network.requestWillBeSent', (e) => watch(e.request.url, e.requestId)); } catch (e) { /* the page's listener covers it */ }
  });
  const kokoro = { get length() { return kokoroReqs().length; }, some: (f) => kokoroReqs().some(f), filter: (f) => kokoroReqs().filter(f) };
  const status = () => page.$eval('#reel-tts-status', (e) => e.textContent.trim());
  const waitStatus = (re, timeout) => page.waitForFunction((src) => new RegExp(src).test((document.querySelector('#reel-tts-status') || {}).textContent || ''), { timeout: timeout || 900000, polling: 200 }, re.source);

  try {
    await page.goto(BASE + '/ai-video/reel-maker/', { waitUntil: 'networkidle0', timeout: 120000 });
    await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/^No thanks$/.test(b.textContent.trim()) && b.offsetParent) { b.click(); break; } });

    /* ---- 1. the copy ---- */
    const privacy = await page.$eval('.privacy-line', (e) => e.textContent);
    check(/Kokoro-82M/.test(privacy) && /92 MB/.test(privacy) && /Apache-2\.0/.test(privacy) && /never sent/.test(privacy), 'privacy line: Kokoro-82M, 92 MB, Apache-2.0, never sent');
    check(/Whisper/.test(privacy) && /41 MB/.test(privacy) && /MIT/.test(privacy) && /watermark/.test(privacy), 'privacy line still names Whisper, 41 MB, MIT, watermark');
    check(!/100% private|no third-party (requests|server)/i.test(privacy), 'no blanket privacy claim');
    const faq = await page.$$eval('article details', (d) => d.map((x) => x.textContent));
    check(faq.some((f) => /read my script aloud/.test(f) && /28 English voices/.test(f) && /synthetic/.test(f)), 'FAQ: reads the script aloud, 28 voices, synthetic');
    check(faq.some((f) => /label a generated voice/.test(f) && /realistic-sounding audio/.test(f)), 'FAQ: the labelling question quotes Meta');
    check(kokoro.length === 0, 'nothing fetched from /engine/models/kokoro-82m/ on page load (' + kokoro.length + ')');

    /* ---- script ---- */
    await page.$eval('#reel-script', (t, s) => { t.value = s; t.dispatchEvent(new Event('input', { bubbles: true })); }, SCRIPT);
    await page.evaluate(() => { for (const b of document.querySelectorAll('.reel-start button')) if (/^Make my reel$/.test(b.textContent.trim())) { b.click(); break; } });
    await page.waitForFunction(() => document.querySelectorAll('.reel-scene').length >= 3, { timeout: 30000 });
    await page.click('.aiimg-side .aiimg-tabs [data-pane=sound]');

    /* ---- 2. the voices ---- */
    const list = await page.evaluate(async () => {
      const sel = document.querySelector('#reel-tts-voice');
      const groups = [...sel.querySelectorAll('optgroup')].map((g) => ({ label: g.label, n: g.children.length }));
      const opts = [...sel.options].map((o) => ({ id: o.value, text: o.textContent }));
      return { groups, opts, catalogue: AIVidTTS.voices.map((v) => v.id + v.gender + v.accent) };
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT || '.', 'engine/models/kokoro-82m/kokoro-82m.json'), 'utf8'));
    check(list.opts.length === 28 && manifest.voices.length === 28, 'the picker lists 28 voices (' + list.opts.length + '), as the manifest does (' + manifest.voices.length + ')');
    check(JSON.stringify(list.opts.map((o) => o.id).sort()) === JSON.stringify(manifest.voices.map((v) => v.id).sort()), 'picker ids = manifest ids');
    check(manifest.voices.every((v) => list.catalogue.includes(v.id + (v.gender === 'F' ? 'female' : 'male') + v.accent)), 'names, genders and accents agree with the manifest');
    const us = list.opts.filter((o) => /American English/.test(o.text)).length, gb = list.opts.filter((o) => /British English/.test(o.text)).length;
    const women = list.opts.filter((o) => /female/.test(o.text)).length, men = list.opts.filter((o) => /, male/.test(o.text)).length;
    check(us === 20 && gb === 8 && women === 15 && men === 13, '20 American + 8 British, 15 women + 13 men (' + [us, gb, women, men].join('/') + ')');
    check(list.groups.length === 2 && list.groups.every((g) => g.n > 0), 'grouped by accent (' + list.groups.map((g) => g.label + ' ' + g.n).join(', ') + ')');
    for (const v of manifest.voices) check(fs.statSync(path.join(ROOT, 'engine/models/kokoro-82m/voices', v.id + '.bin')).size === 522240, 'voice file ' + v.id + '.bin is 510×256 float32');

    /* ---- 3. Preview ---- */
    await page.select('#reel-tts-voice', 'bf_emma');
    const tp = Date.now();
    await page.click('#reel-tts-preview');
    await waitStatus(/^Preview:|could not|Cancelled/);
    const prev = await page.evaluate(() => AIImg.tools['reel-maker'].state().ttsPreview);
    console.log(stamp(), 'preview (includes the first download):', ((Date.now() - tp) / 1000).toFixed(1) + ' s', JSON.stringify(prev), '·', await status());
    check(prev && prev.voice === 'bf_emma' && prev.duration > 1 && prev.peak > 0.05, 'Preview speaks a sentence in Emma’s voice (' + (prev ? prev.duration.toFixed(2) + ' s, peak ' + prev.peak.toFixed(2) : 'none') + ')');
    check(kokoro.some((u) => /model_quantized\.onnx/.test(u)) && kokoro.some((u) => /bf_emma\.bin/.test(u)) && kokoro.some((u) => /lexicon-gb\.json/.test(u)), 'Preview fetched the model, the voice and the British dictionary from this site');
    const inputs = await page.evaluate(async () => (await AIVidTTS.load()).inputs);
    check(JSON.stringify(inputs) === JSON.stringify(['input_ids', 'style', 'speed']), 'model inputs are input_ids, style, speed (' + inputs + ')');

    /* ---- 4. speed ---- */
    const sp = await page.evaluate(async () => {
      const a = await AIVidTTS.speak('The quick brown fox jumps over the lazy dog.', { voice: 'am_michael', speed: 0.8 });
      const b = await AIVidTTS.speak('The quick brown fox jumps over the lazy dog.', { voice: 'am_michael', speed: 1.2 });
      const c = await AIVidTTS.speak('x', { voice: 'am_michael', speed: 5 });
      return { slow: a.duration, fast: b.duration, clamped: c.duration > 0 };
    });
    check(sp.slow / sp.fast > 1.25, 'speed 0.8× lasts longer than 1.2× (' + sp.slow.toFixed(2) + ' s vs ' + sp.fast.toFixed(2) + ' s)');

    /* ---- 5. Cancel ---- */
    await page.select('#reel-tts-voice', 'af_heart');
    await page.click('#reel-tts-generate');
    await waitStatus(/Speaking scene/, 120000);
    const cancelVisible = await page.$eval('#reel-tts-cancel', (b) => !b.hidden);
    await page.click('#reel-tts-cancel');
    await waitStatus(/Cancelled/, 120000);
    const afterCancel = await page.evaluate(() => { const S = AIImg.tools['reel-maker'].state(); return { voice: !!S.voice, gen: !document.querySelector('#reel-tts-generate').disabled }; });
    check(cancelVisible && !afterCancel.voice && afterCancel.gen, 'Cancel stops the generation, leaves no voice and re-enables Generate (' + await status() + ')');

    /* ---- 6. Generate ---- */
    await page.evaluate(() => {
      window.__gap = 0; let last = performance.now();
      window.__tick = setInterval(() => { const n = performance.now(); window.__gap = Math.max(window.__gap, n - last); last = n; }, 20);
    });
    const tg = Date.now();
    await page.click('#reel-tts-generate');
    await waitStatus(/^Generated:|could not/);
    const genSecs = (Date.now() - tg) / 1000;
    const gap = await page.evaluate(() => { clearInterval(window.__tick); return window.__gap; });
    const st = await status();
    console.log(stamp(), st);
    const g = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const out = await T.mixAudio(S);
      let s2 = 0, n = 0; for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i += 4) { s2 += d[i] * d[i]; n++; } }
      return {
        duration: S.voice.duration, offset: S.voice.offset, generated: S.voice.generated, plan: S.voice.plan, fit: S.fitVoice,
        scenes: S.scenes.map((x) => ({ id: x.id, type: x.type, seconds: x.seconds, text: x.text })),
        segs: S.captions.segments.map((x) => ({ start: x.start, end: x.end, text: x.text, words: x.words.length })),
        cues: S.captions.cues.length, source: S.captions.source, rms: Math.sqrt(s2 / n), mixSeconds: out.duration,
        speech: S.voice.samples.length / 16000
      };
    });
    console.log('  plan', JSON.stringify(g.plan), '· segments', JSON.stringify(g.segs));
    check(g.duration > 3 && g.generated && g.generated.voice === 'af_heart', 'S.voice is the generated voice (' + g.duration.toFixed(2) + ' s, ' + (g.generated && g.generated.voice) + ')');
    check(g.fit && g.scenes.filter((x) => x.type !== 'endcard').every((x) => g.plan[x.id] !== undefined && Math.abs(x.seconds - g.plan[x.id]) < 1e-9), 'Fit scenes is on and every spoken scene lasts its planned length');
    const pause = g.generated.pause;
    const spans = g.scenes.filter((x) => g.plan[x.id] !== undefined).map((x) => x.seconds);
    check(spans.every((s) => s >= 1 && s <= 15) && Math.abs(pause - 0.4) < 1e-9, 'scene lengths within 1–15 s with the 0.4 s pause (' + spans.join(', ') + ')');
    check(g.segs.length === 3 && g.cues > 0 && g.source === 'auto', 'captions: 3 sentences timed from the script, ' + g.cues + ' cues, source "auto"');
    check(g.segs.every((s, i) => i === 0 || s.start >= g.segs[i - 1].end), 'caption segments are in order and do not overlap');
    check(words(g.segs.map((s) => s.text).join(' ')).join(' ') === words(SCRIPT).join(' '), 'the captions are the script’s own words');
    check(g.rms > 0.01 && g.mixSeconds > 3, 'the mixed sound is not silent (RMS ' + g.rms.toFixed(3) + ', ' + g.mixSeconds.toFixed(1) + ' s)');
    check(gap < 1000, 'the page kept running while the worker spoke (longest main-thread gap ' + Math.round(gap) + ' ms)');
    console.log('  generation took ' + genSecs.toFixed(1) + ' s for ' + g.speech.toFixed(1) + ' s of track (' + (genSecs / g.duration).toFixed(2) + '× the speech, model already loaded)');
    fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify({ genSecs, voiceSeconds: g.duration, ratio: genSecs / g.duration }, null, 1));

    /* ---- 7. Whisper hears it ---- */
    const heard = await page.evaluate(async (line) => {
      const S = AIImg.tools['reel-maker'].state();
      const a = await AIVidWhisper.transcribe(S.voice.samples, {});
      const r = await AIVidTTS.speak(line, { voice: 'bm_george' });
      const ab = new AudioBuffer({ length: r.samples.length, numberOfChannels: 1, sampleRate: r.sampleRate }); ab.copyToChannel(r.samples, 0);
      const b = await AIVidWhisper.transcribe(await AIVidWhisper.toMono16k(ab), {});
      return { us: a.segments.map((s) => s.text).join(' '), gb: b.segments.map((s) => s.text).join(' ') };
    }, GB_LINE);
    const hu = hits(KEY, heard.us), hg = hits(GB_KEY, heard.gb);
    console.log('  Whisper (American, Heart): "' + heard.us + '"\n  Whisper (British, George): "' + heard.gb + '"');
    check(hu.length >= KEY.length - 1, 'Whisper hears ' + hu.length + '/' + KEY.length + ' key words in the generated American voice');
    check(hg.length >= GB_KEY.length - 1, 'Whisper hears ' + hg.length + '/' + GB_KEY.length + ' key words in a generated British voice');
    fs.writeFileSync(path.join(OUT, 'whisper.json'), JSON.stringify({ heard, us: hu, gb: hg }, null, 1));

    /* ---- 7b. a real story script, acronyms and rupees included ---- */
    const story = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker'];
      await T.loadStories();
      const st = T.storyFor('india/gst-calculator/');
      const lines = [st.hook, st.pain, st.promise].filter(Boolean).join(' ') + ' Pay ₹1,50,000 at 18% GST.';
      const r = await AIVidTTS.speak(lines, { voice: 'af_bella' });
      const ab = new AudioBuffer({ length: r.samples.length, numberOfChannels: 1, sampleRate: r.sampleRate }); ab.copyToChannel(r.samples, 0);
      const w = await AIVidWhisper.transcribe(await AIVidWhisper.toMono16k(ab), {});
      return { lines, phonemes: r.phonemes, heard: w.segments.map((s) => s.text).join(' ') };
    });
    /* Whisper writes letters and numbers its own way (GST, G.S.T., 1,50,000, 1.5 lakh); compare words with those squeezed out */
    const squeeze = (s) => words(s.replace(/\b([A-Za-z])\.(?=[A-Za-z]\.)/g, '$1').replace(/\b([A-Z])\.?\s(?=[A-Z]\b)/g, '$1'));
    const want = squeeze(story.lines).filter((w) => !/\d/.test(w));
    const got = new Set(squeeze(story.heard));
    const rec = want.filter((w) => got.has(w)).length / Math.max(1, want.length);
    console.log('  story: "' + story.lines + '"\n  heard: "' + story.heard + '"');
    check(rec >= 0.8, 'Whisper hears ' + Math.round(rec * 100) + '% of the words of the GST story script (letters and numbers aside)');
    check(/\bGST\b|G\.?\s?S\.?\s?T/i.test(story.heard), 'the acronym GST is heard as G-S-T');
    fs.writeFileSync(path.join(OUT, 'story.json'), JSON.stringify(Object.assign(story, { recall: rec }), null, 1));

    /* ---- 7c. the words people asked about, said and heard back ---- */
    const PRON = [
      ['Connect to the Wi-Fi in the lobby.', /wi-?\s?fi/i, 'Wi-Fi'],
      ['Save the photo as a JPEG.', /jpe?g|jay\s?peg/i, 'JPEG'],
      ['Paste the JSON here.', /json|jason/i, 'JSON'],
      ['Made with 1234Tools, for free.', /1234|12\s?34|twelve[ -]thirty|1,234/i, '1234Tools'],
      ['Check your GST before you file.', /\bGST\b|G\.?\s?S\.?\s?T\b/i, 'GST'],
      ['The flat costs ₹1,50,000 a year.', /lakh|lac\b|lak\b|lock|150,?000|1,50,000|1\.5/i, '₹1,50,000']
    ];
    const pron = await page.evaluate(async (lines) => {
      const out = [];
      for (const t of lines) {
        const r = await AIVidTTS.speak(t, { voice: 'af_heart' });
        const ab = new AudioBuffer({ length: r.samples.length, numberOfChannels: 1, sampleRate: r.sampleRate }); ab.copyToChannel(r.samples, 0);
        const w = await AIVidWhisper.transcribe(await AIVidWhisper.toMono16k(ab), {});
        out.push({ text: t, phonemes: r.phonemes, heard: w.segments.map((s) => s.text).join(' ').trim() });
      }
      return out;
    }, PRON.map((p) => p[0]));
    pron.forEach((p, i) => check(PRON[i][1].test(p.heard), PRON[i][2] + ' is said so Whisper hears it: "' + p.heard + '" (' + p.phonemes + ')'));
    fs.writeFileSync(path.join(OUT, 'pronunciation.json'), JSON.stringify(pron, null, 1));

    /* ---- 7d. Generate voice reads the voice-over script only, captions follow it, a pronunciation override applies ---- */
    const SCREEN = 'Join our Wi-Fi: WIFI:T:WPA;S:Harbour Cafe;P:flatwhite2026;;\nMenu at https://example.com/menu today.\nTwelve tables, one code.';
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-transport button')) if (/^Start over$/.test(b.textContent.trim())) { b.click(); break; } });
    await page.$eval('#reel-script', (t, s) => { t.value = s; t.dispatchEvent(new Event('input', { bubbles: true })); }, SCREEN);
    await page.evaluate(() => { for (const b of document.querySelectorAll('.reel-start button')) if (/^Make my reel$/.test(b.textContent.trim())) { b.click(); break; } });
    await page.waitForFunction(() => document.querySelectorAll('#reel-vo .reel-vo-text').length >= 3, { timeout: 30000 });
    await page.click('.aiimg-side .aiimg-tabs [data-pane=sound]');
    const sugg = await page.$$eval('#reel-vo .reel-vo-text', (t) => t.map((x) => x.value));
    console.log('  suggested voice-over: ' + JSON.stringify(sugg));
    check(!/WIFI:|flatwhite|https|example/.test(sugg.join(' ')) && /Wi-Fi/.test(sugg[0]) && /link in our bio/.test(sugg[1]), 'the suggested voice-over leaves out the Wi-Fi payload and the URL');
    const CUSTOM = 'Welcome to Harbour. Scan the code and you are online.';
    await page.evaluate((c) => {
      const boxes = document.querySelectorAll('#reel-vo .reel-vo-text');
      const set = (ta, v) => { ta.value = v; ta.dispatchEvent(new Event('input', { bubbles: true })); };
      set(boxes[0], c); set(boxes[1], '');
      const pb = document.querySelector('#reel-pron'); pb.value = 'Harbour = Zanzibar'; pb.dispatchEvent(new Event('input', { bubbles: true }));
    }, CUSTOM);
    await page.click('#reel-tts-generate');
    await waitStatus(/^Generated:|could not/);
    const vd = await page.evaluate(async () => {
      const S = AIImg.tools['reel-maker'].state();
      const w = await AIVidWhisper.transcribe(S.voice.samples, {});
      let stored = null; try { stored = localStorage.getItem('reel-maker-pronunciation'); } catch (e) { /* */ }
      /* sound in each scene's stretch of the voice track (voice time = reel time − offset) */
      const sm = S.voice.samples, o = S.voice.offset;
      let st = 0;
      const rms = S.scenes.map((x) => { const a = Math.max(0, Math.round((st - o + 0.1) * 16000)), b = Math.min(sm.length, Math.round((st + x.seconds - o - 0.1) * 16000)); st += x.seconds; let s2 = 0; for (let i = a; i < b; i++) s2 += sm[i] * sm[i]; return b > a ? Math.sqrt(s2 / (b - a)) : 0; });
      return { plan: S.voice.plan, ids: S.scenes.map((x) => x.id), secs: S.scenes.map((x) => x.seconds), base: S.scenes.map((x) => x.base), rms,
        caps: S.captions.segments.map((s) => s.text), heard: w.segments.map((s) => s.text).join(' '), stored };
    });
    console.log('  voice-over reel: captions ' + JSON.stringify(vd.caps) + ' | heard "' + vd.heard + '"');
    check(vd.plan[vd.ids[0]] !== undefined && vd.plan[vd.ids[1]] === undefined, 'only scenes with a voice-over line are spoken; the emptied scene is silent');
    check(Math.abs(vd.secs[1] - vd.base[1]) < 1e-9, 'the silent scene keeps its own length (' + vd.secs[1] + ' s)');
    check(vd.rms[0] > 0.02 && vd.rms[1] < 0.002 && vd.rms[2] > 0.02, 'sound in scenes 1 and 3, silence in scene 2 (RMS ' + vd.rms.map((x) => x.toFixed(4)).join(', ') + ')');
    check(vd.caps.join(' ') === CUSTOM + ' ' + sugg[2], 'the captions are the voice-over lines as written (' + JSON.stringify(vd.caps) + ')');
    check(/zanz[ai]bar/i.test(vd.heard) && !/harbour|harbor/i.test(vd.heard), 'the pronunciation override "Harbour = Zanzibar" is what the voice says ("' + vd.heard + '")');
    /* Whisper tiny may drop a line that follows a long silence, so the third scene is proved by its sound above, not its words */
    check(!/menu|example|flatwhite|bio/i.test(vd.heard) && /online/i.test(vd.heard), 'the voice says the voice-over, not the screen text');
    check(vd.stored === 'Harbour = Zanzibar', 'the pronunciation list is kept in this browser');
    const prom = await page.$$eval('.reel-prompter li', (l) => l.map((x) => x.textContent));
    check(prom.length === 0 || prom[0] === CUSTOM, 'the teleprompter lists the voice-over lines');

    /* ---- 8. disclosure ---- */
    await page.click('.aiimg-side .aiimg-tabs [data-pane=export]');
    await new Promise((r) => setTimeout(r, 300));
    const cap = await page.evaluate(() => AIImg.tools['reel-maker'].captionFor());
    const hintShown = await page.$eval('#reel-ai-hint', (e) => !e.hidden && /AI info/.test(e.textContent));
    check(/AI-generated voice/.test(cap) && /#\w+/.test(cap.split('\n').pop()), 'the post caption says the voice is AI-generated and still ends with the hashtags');
    check(hintShown, 'the labelling hint shows in Export');

    /* ---- 8b. the AI label: on and locked with a generated voice, drawn in the frames and written into the MP4 ---- */
    const lock = await page.evaluate(() => { const c = document.querySelector('#reel-ai-label'); return { checked: c.checked, disabled: c.disabled, label: AIImg.tools['reel-maker'].aiLabelOf(AIImg.tools['reel-maker'].state()) }; });
    check(lock.checked && lock.disabled && lock.label === 'AI voice', 'with a generated voice the AI label is on and cannot be switched off, and reads “AI voice”');
    await (await page.target().createCDPSession()).send('Page.setDownloadBehavior', { behavior: 'deny' });
    await page.click('#reel-export');
    await page.waitForFunction(() => document.querySelectorAll('.aiimg-result video').length > 0 || /failed|Cancelled/.test((document.querySelector('.reel-exstatus') || {}).textContent || ''), { timeout: 600000, polling: 300 });
    const vsrc = await page.$eval('.aiimg-result video', (v) => v.src);
    const vm = await page.evaluate(async (src) => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const buf = await (await fetch(src)).arrayBuffer();
      const tags = AIImg.readMP4Tags(buf);
      const v = document.createElement('video'); v.muted = true; v.src = src;
      await new Promise((r) => { v.onloadeddata = r; setTimeout(r, 8000); });
      const t = Math.min(2.0, v.duration / 2);
      await new Promise((r) => { v.onseeked = () => setTimeout(r, 250); v.currentTime = t; setTimeout(r, 8000); });
      const W = v.videoWidth, H = v.videoHeight;
      const grab = (draw) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); draw(x); return x; };
      const fr = grab((x) => x.drawImage(v, 0, 0, W, H));
      const off = Object.assign({}, S, { voice: null, brand: Object.assign({}, S.brand, { aiLabel: false }) });
      const r = T.marks(W, H, S).ai, rc = T.marks(W, H, S).credit;
      const mad = (a, b, q) => { const x0 = Math.floor(q.x), y0 = Math.floor(q.y), w = Math.ceil(q.w), h = Math.ceil(q.h); const d1 = a.getImageData(x0, y0, w, h).data, d2 = b.getImageData(x0, y0, w, h).data; let s = 0; for (let i = 0; i < d1.length; i += 4) s += (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2])) / 3; return s / (d1.length / 4); };
      const on = grab((x) => T.renderFrame(x, W, H, t, S)), noLabel = grab((x) => T.renderFrame(x, W, H, t, off));
      const noCredit = grab((x) => T.renderFrame(x, W, H, t, Object.assign({}, S, { brand: Object.assign({}, S.brand, { madeWith: false }) })));
      return { tags, duration: v.duration, D: S.scenes.reduce((s, x) => s + x.seconds, 0), W, H, ai: { as: mad(fr, on, r), flip: mad(fr, noLabel, r) }, credit: { as: mad(fr, on, rc), flip: mad(fr, noCredit, rc) }, png: fr.canvas.toDataURL('image/png') };
    }, vsrc);
    fs.writeFileSync(path.join(OUT, 'marks-frame-1080x1920.png'), Buffer.from(vm.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, 'mp4-tags.json'), JSON.stringify(vm.tags, null, 1));
    console.log('  MP4 metadata read back: ' + JSON.stringify(vm.tags));
    check(vm.W === 1080 && vm.H === 1920 && vm.ai.as < vm.ai.flip * 0.5, 'the exported 1080×1920 frames carry the “AI voice” label (as/flip ' + vm.ai.as.toFixed(1) + '/' + vm.ai.flip.toFixed(1) + ')');
    check(vm.credit.as < vm.credit.flip * 0.5, 'and “Made with 1234Tools.com” (as/flip ' + vm.credit.as.toFixed(1) + '/' + vm.credit.flip.toFixed(1) + ')');
    check(!!vm.tags && /Contains AI-generated audio \(synthetic voice, Kokoro-82M\)/.test(vm.tags['©cmt'] || '') && /https:\/\/www\.1234tools\.com\/ai-video\/reel-maker\//.test(vm.tags.desc || '') && /1234Tools Reel Maker/.test(vm.tags['©too'] || ''), 'the MP4 carries ©cmt, desc and ©too saying the audio is AI-generated');
    check(Math.abs(vm.duration - vm.D) <= 0.5, 'the tagged MP4 plays to its full length (' + vm.duration.toFixed(2) + ' s of ' + vm.D.toFixed(2) + ')');
    /* removing the generated voice frees the switch and takes the label away */
    await page.click('.aiimg-side .aiimg-tabs [data-pane=sound]');
    await page.evaluate(() => { for (const b of document.querySelectorAll('.reel-voice-info button')) if (/^Remove$/.test(b.textContent.trim())) { b.click(); break; } });
    const unlock = await page.evaluate(() => { const c = document.querySelector('#reel-ai-label'); return { checked: c.checked, disabled: c.disabled, label: AIImg.tools['reel-maker'].aiLabelOf(AIImg.tools['reel-maker'].state()) }; });
    check(!unlock.checked && !unlock.disabled && unlock.label === '', 'without the generated voice the label goes and the switch is free again');
    await page.click('.aiimg-side .aiimg-tabs [data-pane=export]');
    await page.screenshot({ path: path.join(OUT, 'export.png') });
    await page.click('.aiimg-side .aiimg-tabs [data-pane=sound]');
    await page.evaluate(() => document.querySelector('#reel-vo').scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(OUT, 'voice-over.png') });
    await page.evaluate(() => document.querySelector('#reel-tts-voice').scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(OUT, 'sound.png') });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => document.querySelector('#reel-tts-voice').scrollIntoView({ block: 'start' }));
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    check(wide <= 390, 'no sideways scroll at 390 px (' + wide + ')');
    await page.screenshot({ path: path.join(OUT, 'sound-phone.png') });

    /* ---- 9. requests ---- */
    /* the model ships as parts of at most 20 MiB (build/split-models.js): each once */
    const modelReqs = kokoro.filter((u) => /model_quantized\.onnx/.test(u));
    const nParts = ((manifest.files['model_quantized.onnx'] || {}).parts || ['model_quantized.onnx']).length;
    check(modelReqs.length === nParts && new Set(modelReqs).size === nParts, 'the 92 MB model was downloaded once (' + modelReqs.length + ' request(s) for its ' + nParts + ' part(s))');
    const net = offsite();
    check(net.length === 0, 'no request left 127.0.0.1 (' + seen.size + ' requests seen)' + (net.length ? ': ' + net.slice(0, 3).join(', ') : ''));
    check(errors.length === 0, 'no page error' + (errors.length ? ': ' + errors[0] : ''));
    console.log('  kokoro files fetched: ' + [...new Set(kokoroReqs())].join(', '));
  } catch (e) {
    fails.push('crashed: ' + (e && e.stack || e));
    console.log('CRASH', e && e.stack || e);
  } finally {
    fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n'));
    await browser.close();
    if (server) server.close();
  }
  console.log('\n' + passes + ' passed, ' + fails.length + ' failed (' + stamp() + ')');
  if (fails.length) { fails.forEach((f) => console.log('  FAIL ' + f)); process.exit(1); }
})();
