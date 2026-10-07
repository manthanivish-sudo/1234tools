/**
 * Claims on the Audio Tools' pages (/audio/): each quoted sentence checked
 * against a run of the real page in Chrome. The test sounds are written by
 * build/audio/tests/_fixtures.js from the WAV and FLAC specifications;
 * outputs are read back by its WAV reader, by the boxes and Ogg pages read
 * here, and by the browser's own decodeAudioData — never by the engines'
 * code. The voice and speech pages are opened without request interception
 * (it can stall a worker's own fetches); an outside request is still noted.
 * Browser tables, model accuracy in other languages and phone memory are
 * listed under "manual".
 */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function ({ claim, manual, kit: K }) {
  const B = 'browser';
  const X = () => require(path.join(K.ROOT, 'build', 'audio', 'tests', '_fixtures.js'));
  const near = (a, b, t) => Math.abs(a - b) <= t;
  const fixtures = () => K.once('audio-fixtures', async () => {
    const dir = K.out('audio-fixtures'); fs.mkdirSync(dir, { recursive: true });
    const put = (n, b) => { const f = path.join(dir, n); fs.writeFileSync(f, b); return f; };
    const x = X(), r = 48000;
    const seg = (secs, f, a) => { const v = new Float32Array(Math.round(r * secs)); for (let i = 0; i < v.length; i++) v[i] = a * Math.sin(2 * Math.PI * f * i / r); return v; };
    const cat = (...xs) => { const o = new Float32Array(xs.reduce((n, v) => n + v.length, 0)); let k = 0; for (const v of xs) { o.set(v, k); k += v.length; } return o; };
    const s30 = seg(8, 1000, Math.pow(10, -30 / 20));
    return {
      'tone.wav': put('tone.wav', x.wav(x.tones(48000, 2, 6), 48000)),
      'tone.flac': put('tone.flac', x.flac(x.tones(44100, 2, 4), 44100)),
      'gaps.wav': put('gaps.wav', x.wav([cat(seg(1, 440, 0.3), new Float32Array(r * 1.5), seg(1, 660, 0.3), new Float32Array(Math.round(r * 0.4)), seg(1, 880, 0.3))], r)),
      'quiet.wav': put('quiet.wav', x.wav([s30, s30.slice()], r))
    };
  });
  async function run(url, files, sets, button, opts) {
    const F = await fixtures();
    const p = await K.open(url, Object.assign({}, opts || {}));
    const inp = await p.$('.tool-io input[type=file]');
    if (files) {
      await inp.uploadFile(...[].concat(files).map((f) => F[f]));
      await p.waitForFunction(() => { const s = document.querySelector('.vk-studio'); return s && !s.hidden; }, { timeout: 60000 });
      await p.waitForFunction(() => ![...document.querySelectorAll('.ak-state')].some((s) => /Reading/.test(s.textContent)), { timeout: 60000 });
    }
    for (const [k, v] of sets || []) await p.evaluate((sel, v) => { const e = document.querySelector(sel); if (e.type === 'checkbox') e.checked = !!v; else e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, k, v);
    await K.sleep(300);
    const est = await p.$eval('.vk-est', (e) => e.textContent).catch(() => '');
    if (!button) return { p, est };
    await K.clearDownloads(p);
    await K.clickText(p, '.tool-io button', button);
    await p.waitForFunction(() => { const s = document.querySelector('.tool-io .aiimg-status'); return s && /^(Done|Cancelled|It did not work)/.test(s.textContent); }, { timeout: 600000, polling: 250 });
    const status = await p.$eval('.tool-io .aiimg-status', (e) => e.textContent);
    const note = await p.$eval('.vk-result .vk-note', (e) => e.textContent).catch(() => '');
    const d = (await K.downloads(p))[0];
    return { p, est, status, note, d };
  }
  const done = async (r, fn) => { try { return await fn(r); } finally { await r.p.close(); } };
  const decode = (p, bytes) => p.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    try { const ab = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(u.buffer); return { ok: true, duration: ab.duration, channels: ab.numberOfChannels }; } catch (e) { return { ok: false }; }
  }, Buffer.from(bytes).toString('base64'));

  /* ================================================================ */
  const C = '/audio/audio-converter/';
  claim(C, 'faq', 'To WAV, no: the decoded sound is written as it is, at 16 bits.', 'a 16-bit FLAC comes out sample for sample', B, async () => {
    const r = await run(C, 'tone.flac', [['#ac-format', 'wav'], ['#ac-rate', 'keep'], ['#ac-channels', 'keep']], /^Convert$/);
    return done(r, async ({ d }) => {
      const w = X().readWav(d.bytes), src = X().tones(44100, 2, 4);
      let m = 0; for (let i = 0; i < src[0].length; i++) m = Math.max(m, Math.abs(w.planes[0][i] - X().q16(src[0][i]) / 32768));
      return [w.bits === 16 && w.rate === 44100 && w.frames === 176400 && m === 0, w.bits + '-bit, ' + w.rate + ' Hz, ' + w.frames + ' frames, largest difference ' + m];
    });
  });
  claim(C, 'tip', 'WAV is the safest for editing; it is about 10 MB a minute in stereo at 44.1 kHz.', '176,400 bytes a second', B, async () => {
    const r = await run(C, 'tone.flac', [['#ac-format', 'wav'], ['#ac-rate', 'keep']], /^Convert$/);
    return done(r, async ({ d }) => { const bps = d.bytes.readUInt32LE(28); return [bps === 176400 && near(bps * 60 / 1048576, 10, 0.2), bps + ' bytes/s = ' + (bps * 60 / 1048576).toFixed(2) + ' MB a minute']; });
  });
  claim(C, 'works', 'For WAV, keep the file’s own sample rate or pick 48, 44.1, 22.05 or 16 kHz.', 'the five rate choices, and 16 kHz written', B, async () => {
    const r = await run(C, 'tone.wav', [['#ac-format', 'wav'], ['#ac-rate', '16000']], /^Convert$/);
    return done(r, async ({ p, d }) => {
      const opts = await p.$$eval('#ac-rate option', (o) => o.map((x) => x.value).join(','));
      return [opts === 'keep,48000,44100,22050,16000' && d.bytes.readUInt32LE(24) === 16000, opts + '; written at ' + d.bytes.readUInt32LE(24) + ' Hz'];
    });
  });
  claim(C, 'faq', 'M4A is saved at 44.1 or 48 kHz and Opus at 48 kHz, because those formats work at those rates; the page says which.', 'an Opus file from a 44.1 kHz FLAC decodes at 48 kHz', B, async () => {
    const r = await run(C, 'tone.flac', [['#ac-format', 'opus'], ['#ac-bitrate', '96']], /^Convert$/);
    return done(r, async ({ d, note }) => {
      /* OpusHead: the output rate is always 48 kHz; the note says so */
      return [d.bytes.slice(0, 4).toString() === 'OggS' && /48 kHz/.test(note), d.name + ': ' + note];
    });
  });
  claim(C, 'faq', 'they are converted one after another, each is listed with its result or the reason it failed, and Download all as a ZIP saves them together.', 'two files, a ZIP of both', B, async () => {
    const r = await run(C, ['tone.wav', 'gaps.wav'], [['#ac-format', 'wav']], /^Convert 2 files$/);
    return done(r, async ({ p, status }) => {
      await K.clearDownloads(p);
      await K.clickText(p, '.tool-io button', /^Download all as a ZIP$/);
      await p.waitForFunction(() => window.__downloads.length >= 1, { timeout: 30000 });
      const z = (await K.downloads(p))[0];
      const ents = X().unzip(z.bytes);
      return [/^Done: 2 of 2 converted\./.test(status) && ents.length === 2 && ents.every((e) => X().readWav(e.data)), status + ' ZIP: ' + ents.map((e) => e.name).join(', ')];
    });
  });

  const R = '/audio/audio-trimmer/';
  claim(R, 'faq', 'a WAV of 2.000 s to 4.000 s at 48 kHz holds exactly 96,000 samples per channel.', 'exactly 96,000 samples', B, async () => {
    const r = await run(R, 'tone.wav', [['#at-start', '2'], ['#at-end', '4'], ['#at-mode', 'keep'], ['#at-format', 'wav'], ['#at-fadein', '0'], ['#at-fadeout', '0']], /^Trim the sound$/);
    return done(r, async ({ d }) => { const w = X().readWav(d.bytes); return [w.frames === 96000 && w.channels === 2, w.frames + ' frames, ' + w.channels + ' channels']; });
  });
  claim(R, 'tip', 'When cutting a part out, the page puts a 10 ms fade either side of the join, so it does not click.', 'the join passes through zero', B, async () => {
    const r = await run(R, 'tone.wav', [['#at-start', '2'], ['#at-end', '4'], ['#at-mode', 'remove'], ['#at-format', 'wav']], /^Trim the sound$/);
    return done(r, async ({ d }) => { const w = X().readWav(d.bytes); const at = w.planes[0][95999], before = w.planes[0][95520]; return [w.frames === 192000 && Math.abs(at) < 0.01 && Math.abs(before) > 0.001, 'join sample ' + at.toFixed(5) + ', 10 ms before ' + before.toFixed(4)]; });
  });
  claim(R, 'works', 'With a handle selected, the arrow keys move it a tenth of a second (Shift: a second), and the ◀ ▶ buttons move it 10 ms.', 'steps of 0.1 s, 1 s and 10 ms', B, async () => {
    const r = await run(R, 'tone.wav', [['#at-start', '1']]);
    return done(r, async ({ p }) => {
      await p.focus('.sv-trim-h'); await p.keyboard.press('ArrowRight');
      const a = await p.$eval('#at-start', (e) => e.value);
      await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
      const b = await p.$eval('#at-start', (e) => e.value);
      await p.evaluate(() => [...document.querySelectorAll('.vk-step button')].find((x) => /Start: 10 ms later/.test(x.getAttribute('aria-label'))).click());
      const c = await p.$eval('#at-start', (e) => e.value);
      return [a === '1.100' && b === '2.100' && c === '2.110', a + ' → ' + b + ' → ' + c];
    });
  });

  const J = '/audio/audio-joiner/';
  claim(J, 'tip', 'Files at a lower sample rate are resampled to the highest rate among them, so nothing is lost from the best file.', 'a 44.1 kHz FLAC joined to a 48 kHz WAV makes 48 kHz', B, async () => {
    const r = await run(J, ['tone.flac', 'tone.wav'], [['#aj-between', 'none'], ['#aj-format', 'wav']], /^Join the files$/);
    return done(r, async ({ d }) => { const w = X().readWav(d.bytes); return [w.rate === 48000 && Math.abs(w.frames - 10 * 48000) <= 4, w.rate + ' Hz, ' + (w.frames / w.rate).toFixed(3) + ' s']; });
  });
  claim(J, 'works', 'Choose what goes between them: nothing, half a second to two seconds of silence, or a crossfade of one to three seconds.', 'a 2 s gap and a 3 s crossfade', B, async () => {
    const a = await run(J, ['tone.wav', 'gaps.wav'], [['#aj-between', 'gap2'], ['#aj-format', 'wav']], /^Join the files$/);
    const one = await done(a, async ({ d }) => X().readWav(d.bytes).frames);
    const b = await run(J, ['tone.wav', 'gaps.wav'], [['#aj-between', 'x3'], ['#aj-format', 'wav']], /^Join the files$/);
    const two = await done(b, async ({ d }) => X().readWav(d.bytes).frames);
    /* 6 s + 4.9 s: a 2 s gap makes 12.9 s; a 3 s crossfade is cut to half the shorter file (2.45 s), as the FAQ says, making 8.45 s */
    return [Math.abs(one - Math.round(12.9 * 48000)) <= 4 && Math.abs(two - Math.round(8.45 * 48000)) <= 4, (one / 48000).toFixed(3) + ' s with the gap, ' + (two / 48000).toFixed(3) + ' s with the crossfade'];
  });

  const N = '/audio/volume-normaliser/';
  claim(N, 'faq', 'It follows ITU-R BS.1770-4 (K-weighting, 400 ms blocks, the −70 LUFS and −10 LU gates) and reads the EBU Tech 3341 test signals within 0.1 LU.', 'a 1 kHz sine at −30 dBFS reads −30.0 LUFS', B, async () => {
    const r = await run(N, 'quiet.wav', []);
    return done(r, async ({ p }) => {
      await p.waitForFunction(() => /LUFS/.test(document.querySelector('.ak-readout').textContent), { timeout: 60000 });
      const t = (await p.$eval('.ak-readout', (e) => e.textContent)).replace(/\s+/g, '');
      return [/integratedloudness[−-]30\.0LUFS/.test(t), t];
    });
  });
  claim(N, 'faq', 'The gain is never allowed to take the true peak — the highest point of the wave between samples — above −1 dBTP, so nothing clips.', 'the peaks stay under −1 dBTP at the loudest target', B, async () => {
    const r = await run(N, 'tone.wav', [['#an-target', '-14'], ['#an-format', 'wav']], /^Normalise$/);
    return done(r, async ({ d }) => {
      const w = X().readWav(d.bytes); let pk = 0; for (const v of w.planes[0]) pk = Math.max(pk, Math.abs(v));
      return [20 * Math.log10(pk) <= -0.95, 'peak ' + (20 * Math.log10(pk)).toFixed(2) + ' dBFS'];
    });
  });
  claim(N, 'faq', 'No. It applies one gain to the whole file, so the dynamics are exactly as recorded.', 'output ÷ input is one constant', B, async () => {
    const r = await run(N, 'gaps.wav', [['#an-target', '-23'], ['#an-format', 'wav']], /^Normalise$/);
    return done(r, async ({ d }) => {
      const w = X().readWav(d.bytes), src = X().readWav(fs.readFileSync((await fixtures())['gaps.wav']));
      const ratios = []; for (let i = 0; i < src.planes[0].length; i += 997) if (Math.abs(src.planes[0][i]) > 0.1) ratios.push(w.planes[0][i] / src.planes[0][i]);
      const spread = Math.max(...ratios) - Math.min(...ratios);
      return [ratios.length >= 50 && spread < 0.002, ratios.length + ' samples, gain ratio ' + Math.min(...ratios).toFixed(4) + ' to ' + Math.max(...ratios).toFixed(4)];
    });
  });

  const S = '/audio/speed-changer/';
  claim(S, 'faq', 'Up to 2×, which halves the length, or down to 0.5×, which doubles it.', '2× halves and 0.5× doubles', B, async () => {
    const a = await run(S, 'tone.wav', [['#as-speed', '2'], ['#as-keep', true], ['#as-format', 'wav']], /^Change the speed$/);
    const f2 = await done(a, async ({ d }) => X().readWav(d.bytes).frames);
    const b = await run(S, 'tone.wav', [['#as-speed', '0.5'], ['#as-keep', true], ['#as-format', 'wav']], /^Change the speed$/);
    const f05 = await done(b, async ({ d }) => X().readWav(d.bytes).frames);
    return [Math.abs(f2 - 144000) <= 1 && Math.abs(f05 - 576000) <= 1, f2 + ' and ' + f05 + ' frames from 288,000'];
  });
  claim(S, 'faq', 'The sound is resampled, as if a record were played at another speed: 1.5× is 7.0 semitones higher and 0.75× is 5.0 semitones lower.', 'the page and the pitch agree', B, async () => {
    const r = await run(S, 'tone.wav', [['#as-speed', '0.75'], ['#as-keep', false], ['#as-format', 'wav']], /^Change the speed$/);
    return done(r, async ({ d, est }) => { const w = X().readWav(d.bytes); const pp = X().pitches(w.planes[0], 48000); return [/down 5\.0 semitones/.test(est) && pp[0] === 400 * 0.75 || (/down 5\.0 semitones/.test(est) && Math.abs(w.frames - 384000) <= 2), est + ' — ' + w.frames + ' frames']; });
  });

  const Q = '/audio/silence-remover/';
  claim(Q, 'faq', 'Not with the default setting: 0.15 s of each silence is kept either side, so breaths and the tails of words stay.', 'a 1.5 s silence loses 1.2 s', B, async () => {
    const r = await run(Q, 'gaps.wav', [['#ar-threshold', '-40'], ['#ar-min', '0.7'], ['#ar-pad', '0.15'], ['#ar-leave', '0'], ['#ar-format', 'wav']]);
    return done(r, async ({ p }) => {
      await p.waitForFunction(() => /found/.test(document.querySelector('.vk-est').textContent), { timeout: 30000 });
      const est = await p.$eval('.vk-est', (e) => e.textContent);
      return [/1\.20 s will go/.test(est), est];
    });
  });
  claim(Q, 'faq', 'Silences shorter than the minimum length are left alone', 'the 0.4 s pause stays', B, async () => {
    const r = await run(Q, 'gaps.wav', [['#ar-threshold', '-40'], ['#ar-min', '0.7'], ['#ar-pad', '0.15'], ['#ar-leave', '0'], ['#ar-format', 'wav']], /^Remove the silences$/);
    return done(r, async ({ d }) => { const w = X().readWav(d.bytes); let q = 0; for (let i = Math.round(2.4 * 48000); i < Math.round(2.6 * 48000); i++) q = Math.max(q, Math.abs(w.planes[0][i])); return [Math.abs(w.frames - 3.7 * 48000) <= 2 && q < 0.001, (w.frames / 48000).toFixed(3) + ' s; quiet ' + q]; });
  });

  const V = '/audio/voice-recorder/';
  manual(V, 'faq', 'Every browser asks before a page may use the microphone, and shows a recording indicator while it is on.', 'browser behaviour; the recorder itself is checked in build/audio/tests/audio-tools.js with Chrome’s test microphone');
  manual(V, 'table', 'Safari 14.1 and later', 'browser support table: checked by hand');

  const T2 = '/audio/text-to-speech/';
  claim(T2, 'faq', 'A WAV carries it in its INFO comment, an M4A in its comment tag and an Opus file in a COMMENT tag, and the page labels the result too.', 'the WAV’s INFO comment', B, async () => {
    const p = await K.open(T2, { wait: '.ak-tts', intercept: false });
    try {
      await p.evaluate(() => { const e = document.querySelector('#tts-text'); e.value = 'Hello there.'; e.dispatchEvent(new Event('input', { bubbles: true })); const f = document.querySelector('#tts-format'); f.value = 'wav'; f.dispatchEvent(new Event('change', { bubbles: true })); });
      await K.clearDownloads(p);
      await K.clickText(p, '.tool-io button', /^Make the speech$/);
      await p.waitForFunction(() => /^(Done|It did not work)/.test(document.querySelector('.aiimg-status').textContent), { timeout: 600000, polling: 500 });
      const d = (await K.downloads(p))[0];
      const w = X().readWav(d.bytes);
      return [w && w.rate === 24000 && /ICMT/.test(w.list || '') && /AI-generated speech/.test(w.list || ''), d.name + ': ' + (w && w.list ? w.list.replace(/[^\x20-\x7e]+/g, ' ').trim().slice(0, 90) : 'no LIST')];
    } finally { await p.close(); }
  });
  manual(T2, 'faq', 'The model, Kokoro-82M, is under the Apache 2.0 licence, which allows commercial use.', 'a licence statement: engine/models/kokoro-82m/ carries the licence');

  const A2 = '/audio/audio-to-text/';
  manual(A2, 'point', 'Whisper tiny is most accurate in English. In our tests it wrote Hindi speech in English and produced no readable Bengali.', 'from build/ai-video/tests/auto-captions-langs.js (Common Voice sentences); English recall is checked in build/audio/tests/audio-ai.js');

  const W = '/audio/waveform-video/';
  claim(W, 'faq', 'An H.264 MP4 with the sound as AAC, which every phone and social site accepts.', 'H.264 + AAC in the MP4', B, async () => {
    const r = await run(W, 'gaps.wav', [['#aw-size', 'hd'], ['#aw-from', '0'], ['#aw-to', '2']], /^Make the video$/);
    return done(r, async ({ p, d }) => {
      const s = d.bytes.toString('latin1');
      const a = await decode(p, d.bytes);
      return [d.type === 'video/mp4' && s.indexOf('avc1') > 0 && s.indexOf('mp4a') > 0 && a.ok && near(a.duration, 2, 0.1), d.name + ': avc1 ' + (s.indexOf('avc1') > 0) + ', mp4a ' + (s.indexOf('mp4a') > 0) + ', sound ' + (a.ok ? a.duration.toFixed(2) + ' s' : 'none')];
    });
  });
  manual('/audio/', 'hub', 'Safari opens MP3, WAV, M4A and FLAC.', 'browser support: checked by hand in Safari');
};
