/*
 * Drives the /audio/ tools in headless Chrome against a local server and
 * checks every file they save against references that are not the
 * engines': fixtures written by build/audio/tests/_fixtures.js from the
 * WAV and FLAC specifications (a sine whose pitch steps every second,
 * 400 + 200 × s Hz), an M4A made in the page with WebCodecs and mp4-muxer
 * called directly, and the video kit's WebM; outputs read back by a WAV
 * reader written here, the Ogg and MP4 box readers, and the browser's own
 * decodeAudioData, with the pitch heard in each half second compared.
 *
 *   node build/audio/tests/audio-tools.js [--root <site>] [--port 9034] [--out <dir>] [--only converter,trimmer,…]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('../../video/tests/_kit.js')({ name: 'audio-tools', port: 9034 });
const X = require('./_fixtures.js');
const ONLY = T.flag('only', '') ? String(T.flag('only')).split(',') : null;
const want = (k) => !ONLY || ONLY.indexOf(k) >= 0;
const near = (a, b, t) => Math.abs(a - b) <= t;
const STEPS6 = '400,400,600,600,800,800,1000,1000,1200,1200,1400,1400';

async function fixtures() {
  const F = {};
  F['tone.wav'] = T.save('tone.wav', X.wav(X.tones(48000, 2, 6), 48000));
  F['tone44.wav'] = T.save('tone44.wav', X.wav(X.tones(44100, 1, 4), 44100));
  F['tone.flac'] = T.save('tone.flac', X.flac(X.tones(44100, 2, 4), 44100));
  F['note.txt'] = T.save('note.txt', Buffer.from('not a sound'));
  /* silences: 1 s tone, 1.5 s quiet, 1 s tone, 0.4 s quiet, 1 s tone (48 kHz mono) */
  const r = 48000, seg = (secs, f, a) => { const x = new Float32Array(Math.round(r * secs)); for (let i = 0; i < x.length; i++) x[i] = a * Math.sin(2 * Math.PI * f * i / r); return x; };
  const cat = (...xs) => { const o = new Float32Array(xs.reduce((n, x) => n + x.length, 0)); let k = 0; for (const x of xs) { o.set(x, k); k += x.length; } return o; };
  F['gaps.wav'] = T.save('gaps.wav', X.wav([cat(seg(1, 440, 0.3), new Float32Array(r * 1.5), seg(1, 660, 0.3), new Float32Array(Math.round(r * 0.4)), seg(1, 880, 0.3))], r));
  /* loudness: a 1 kHz stereo sine at -30 dBFS reads -30.0 LUFS (EBU Tech 3341 case 1 scaled) */
  const s30 = seg(8, 1000, Math.pow(10, -30 / 20));
  F['quiet.wav'] = T.save('quiet.wav', X.wav([s30, s30.slice()], r));
  /* quiet but peaky: a -30 dBFS tone with one sample at -2 dBFS every second (too little energy to move the loudness):
     lifting it to -14 LUFS would take the peaks far over -1 dBTP */
  const pk = seg(8, 1000, Math.pow(10, -30 / 20)); for (let k = 1; k < 8; k++) pk[k * r + 7] = Math.pow(10, -2 / 20);
  F['peaky.wav'] = T.save('peaky.wav', X.wav([pk, pk.slice()], r));
  const p = await T.open('/audio/', { wait: 'main' });
  F['tone.m4a'] = T.save('tone.m4a', await T.makeVideo(p, { box: 'mp4', video: false, seconds: 6 }));
  F['clip.webm'] = T.save('clip.webm', await T.makeVideo(p, { box: 'webm', seconds: 6 }));
  await p.close();
  return F;
}
async function loaded(url, files, opt) {
  const p = await T.open(url, opt);
  const inp = await p.$('.tool-io input[type=file]');
  await inp.uploadFile(...[].concat(files));
  await p.waitForFunction(() => { const s = document.querySelector('.vk-studio'); const m = document.querySelector('.tool-io .io-msg'); return (s && !s.hidden) || (m && /is-error/.test(m.className)); }, { timeout: 60000 });
  return p;
}
async function runJob(p, re, ms) {
  await T.clearDownloads(p);
  await T.press(p, re);
  await T.waitDone(p, ms);
  const st = await T.status(p);
  if (!/^Done/.test(st)) console.log('    status: ' + st);
  return st;
}
const pitchesOf = async (p, bytes) => { const a = await T.readAudio(p, bytes); return a; };

async function converter(F) {
  T.section('Audio Converter');
  const U = '/audio/audio-converter/';
  /* FLAC (16-bit) → WAV at its own rate: every sample the same */
  let p = await loaded(U, F['tone.flac']);
  await p.waitForFunction(() => /kHz/.test(document.querySelector('.ak-state').textContent), { timeout: 30000 });
  const desc = await p.$eval('.ak-state', (e) => e.textContent);
  T.check(/0:04\.00, 44\.1 kHz, stereo, FLAC/.test(desc), 'a FLAC is read at its own rate: ' + desc);
  await T.setVal(p, '#ac-format', 'wav');
  await T.setVal(p, '#ac-rate', 'keep');
  await T.setVal(p, '#ac-channels', 'keep');
  await runJob(p, /^Convert$/);
  let d = (await T.downloads(p))[0];
  let w = X.readWav(d.bytes);
  const src = X.tones(44100, 2, 4);
  let maxd = 0; for (let c = 0; c < 2; c++) for (let i = 0; i < src[0].length; i++) maxd = Math.max(maxd, Math.abs(w.planes[c][i] - X.q16(src[c][i]) / 32768));
  T.check(d.name === 'tone.wav' && w.rate === 44100 && w.channels === 2 && w.frames === 4 * 44100 && maxd < 1e-6 && w.riffOk, 'FLAC → WAV keeps every sample: ' + d.name + ' ' + w.rate + ' Hz, ' + w.frames + ' frames, largest difference ' + maxd);
  /* mono, 16 kHz */
  await T.setVal(p, '#ac-channels', '1');
  await T.setVal(p, '#ac-rate', '16000');
  await p.evaluate(() => { const b = [...document.querySelectorAll('.ak-state')]; b.forEach((x) => x.textContent = x.textContent); });
  /* a converted file is not converted twice: add it again */
  await T.upload(p, F['tone.flac']);
  await p.waitForFunction(() => document.querySelectorAll('.ak-item').length === 2 && /kHz/.test(document.querySelectorAll('.ak-state')[1].textContent), { timeout: 30000 });
  await runJob(p, /Convert/);
  d = (await T.downloads(p))[0];
  w = X.readWav(d.bytes);
  const pm = X.pitches(w.planes[0], 16000);
  T.check(w.rate === 16000 && w.channels === 1 && Math.abs(w.frames - 64000) <= 2 && pm.join() === '400,400,600,600,800,800,1000,1000', '16 kHz mono WAV: ' + w.rate + ' Hz, ' + w.channels + ' channel, ' + w.frames + ' frames, pitches ' + pm.join(','));
  await p.close();
  /* WAV → M4A, and → Opus */
  p = await loaded(U, F['tone.wav']);
  await p.waitForFunction(() => /kHz/.test(document.querySelector('.ak-state').textContent), { timeout: 30000 });
  await T.setVal(p, '#ac-format', 'm4a');
  await T.setVal(p, '#ac-bitrate', '128');
  await T.setVal(p, '#ac-channels', 'keep');
  await runJob(p, /^Convert$/);
  d = (await T.downloads(p))[0];
  let bx = T.mp4Boxes(d.bytes), a = await pitchesOf(p, d.bytes);
  T.check(d.name === 'tone.m4a' && d.type === 'audio/mp4' && bx.handlers.join() === 'soun' && a.ok && near(a.duration, 6, 0.05) && a.pitches.join() === STEPS6, 'WAV → M4A (AAC): ' + d.name + ' ' + bx.handlers + ' ' + (a.ok ? a.duration.toFixed(3) + ' s ' + a.pitches.join(',') : a.why));
  await p.close();
  p = await loaded(U, F['tone.wav']);
  await p.waitForFunction(() => /kHz/.test(document.querySelector('.ak-state').textContent), { timeout: 30000 });
  await T.setVal(p, '#ac-format', 'opus');
  await T.setVal(p, '#ac-bitrate', '32');
  await runJob(p, /^Convert$/);
  d = (await T.downloads(p))[0];
  a = await pitchesOf(p, d.bytes);
  T.check(d.name === 'tone.ogg' && d.bytes.slice(0, 4).toString() === 'OggS' && a.ok && near(a.duration, 6, 0.03) && a.pitches.join() === STEPS6 && d.bytes.length < 32000 / 8 * 6 * 1.3, 'WAV → Opus at 32 kbit/s: ' + d.bytes.length + ' bytes, ' + (a.ok ? a.pitches.join(',') : a.why));
  const kb = await T.keyboard(p);
  T.check(kb.n >= 5 && !kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')' + (kb.unlabelled.length ? ': ' + kb.unlabelled : ''));
  const stored = await p.evaluate(() => localStorage.getItem('1234tools-audio-converter-v1'));
  T.check(stored && /"format":"opus"/.test(stored) && /"bitrate":"32"/.test(stored) && !/tone/.test(stored), 'settings remembered without the file: ' + stored);
  await p.close();
  /* several at once, one refused by name; a ZIP of the rest */
  p = await loaded(U, [F['tone.wav'], F['tone.m4a'], F['clip.webm'], F['note.txt']]);
  await p.waitForFunction(() => document.querySelectorAll('.ak-item').length === 3 && [...document.querySelectorAll('.ak-state')].every((s) => /kHz|cannot/.test(s.textContent)), { timeout: 60000 });
  const m = await T.msg(p);
  T.check(/note\.txt: not a sound or video file/.test(m.text), 'a text file is refused by name: ' + m.text);
  await T.setVal(p, '#ac-format', 'wav');
  await T.setVal(p, '#ac-rate', '48000');
  await T.setVal(p, '#ac-channels', '2');
  const st = await runJob(p, /^Convert 3 files$/);
  T.check(/^Done: 3 of 3 converted\./.test(st), 'three files converted: ' + st);
  await T.clearDownloads(p);
  await T.press(p, /^Download all as a ZIP$/);
  const z = (await T.waitDownloads(p, 1))[0];
  const ents = X.unzip(z.bytes);
  const okAll = ents && ents.length === 3 && ents.every((e) => { const r = X.readWav(e.data); return r && r.rate === 48000 && r.channels === 2 && X.pitches(r.planes[0], 48000).slice(0, 4).join() === '400,400,600,600'; });
  T.check(z.name === 'converted-audio.zip' && okAll, 'the ZIP holds three 48 kHz stereo WAVs of the right sound: ' + (ents || []).map((e) => e.name).join(', '));
  await p.close();
}

async function trimmer(F) {
  T.section('Audio Trimmer');
  const U = '/audio/audio-trimmer/';
  let p = await loaded(U, F['tone.wav']);
  await T.setVal(p, '#at-start', '2');
  await T.setVal(p, '#at-end', '4');
  await T.setVal(p, '#at-mode', 'keep');
  await T.setVal(p, '#at-format', 'wav');
  await T.setVal(p, '#at-fadein', '0'); await T.setVal(p, '#at-fadeout', '0');
  await runJob(p, /^Trim the sound$/);
  let d = (await T.downloads(p))[0];
  let w = X.readWav(d.bytes);
  T.check(d.name === 'tone-trimmed.wav' && w.frames === 96000 && X.pitches(w.planes[0], 48000).join() === '800,800,1000,1000', 'keep 2 s to 4 s: exactly 96,000 samples of the right sound (' + w.frames + ', ' + X.pitches(w.planes[0], 48000).join(',') + ')');
  const src = X.tones(48000, 2, 6);
  let maxd = 0; for (let i = 0; i < 96000; i++) maxd = Math.max(maxd, Math.abs(w.planes[1][i] - X.q16(src[1][96000 + i]) / 32768));
  T.check(maxd < 1e-6, 'the kept samples are the original’s (largest difference ' + maxd + ')');
  /* cut the middle out */
  await T.setVal(p, '#at-mode', 'remove');
  await runJob(p, /^Trim the sound$/);
  d = (await T.downloads(p))[0];
  w = X.readWav(d.bytes);
  const pr = X.pitches(w.planes[0], 48000);
  T.check(w.frames === 192000 && pr.join() === '400,400,600,600,1200,1200,1400,1400', 'cut 2 s to 4 s out: 192,000 samples, the two sides joined (' + pr.join(',') + ')');
  let jump = 0; for (let i = 95990; i < 96010; i++) jump = Math.max(jump, Math.abs(w.planes[0][i] - w.planes[0][i - 1]));
  T.check(Math.abs(w.planes[0][95999]) < 0.01 && jump < 0.06, 'the join fades through zero, no click (step ' + jump.toFixed(4) + ')');
  /* fade in and out */
  await T.setVal(p, '#at-mode', 'keep');
  await T.setVal(p, '#at-start', '0'); await T.setVal(p, '#at-end', '6');
  await T.setVal(p, '#at-fadein', '1'); await T.setVal(p, '#at-fadeout', '1');
  await runJob(p, /^Trim the sound$/);
  d = (await T.downloads(p))[0];
  w = X.readWav(d.bytes);
  const rms = (a, b) => { let e = 0; for (let i = a; i < b; i++) e += w.planes[0][i] * w.planes[0][i]; return Math.sqrt(e / (b - a)); };
  T.check(rms(0, 2400) < 0.02 && near(rms(48000 * 3, 48000 * 3 + 4800), 0.3 / Math.SQRT2, 0.01) && rms(w.frames - 2400, w.frames) < 0.02, 'fades: ' + rms(0, 2400).toFixed(4) + ' at the start, ' + rms(48000 * 3, 48000 * 3 + 4800).toFixed(4) + ' in the middle, ' + rms(w.frames - 2400, w.frames).toFixed(4) + ' at the end');
  /* M4A out */
  await T.setVal(p, '#at-fadein', '0'); await T.setVal(p, '#at-fadeout', '0');
  await T.setVal(p, '#at-start', '1'); await T.setVal(p, '#at-end', '3');
  await T.setVal(p, '#at-format', 'm4a');
  await runJob(p, /^Trim the sound$/);
  d = (await T.downloads(p))[0];
  const a = await T.readAudio(p, d.bytes);
  T.check(d.name === 'tone-trimmed.m4a' && a.ok && near(a.duration, 2, 0.05) && a.pitches.join() === '600,600,800,800', 'kept 1 s to 3 s as M4A: ' + (a.ok ? a.duration.toFixed(3) + ' s, ' + a.pitches.join(',') : a.why));
  /* keys and buttons */
  await T.setVal(p, '#at-start', '1');
  await p.focus('.sv-trim-h');
  await p.keyboard.press('ArrowRight');
  let v = await p.$eval('#at-start', (e) => e.value);
  T.check(v === '1.100', 'ArrowRight moves the start a tenth of a second: ' + v);
  await p.evaluate(() => [...document.querySelectorAll('.vk-step button')].find((b) => /Start: 10 ms later/.test(b.getAttribute('aria-label'))).click());
  v = await p.$eval('#at-start', (e) => e.value);
  T.check(v === '1.110', 'the ▶ button moves it 10 ms: ' + v);
  const wv = await p.evaluate(() => { const c = document.querySelector('.ak-wave'); const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < x.length; i += 4) if (x[i] > 200 && x[i + 1] > 150) lit++; return { w: c.width, lit }; });
  T.check(wv.w >= 200 && wv.lit > 100, 'the waveform is drawn with the selection lit (' + wv.lit + ' bright pixels)');
  const kb = await T.keyboard(p);
  T.check(kb.n >= 8 && !kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')');
  await p.close();
  /* the sound of a video */
  p = await loaded(U, F['clip.webm']);
  const about = await p.$eval('.vk-about', (e) => e.textContent);
  T.check(/48 kHz, stereo, WEBM/.test(about), 'a WebM video’s sound opens: ' + about);
  await p.close();
}

async function joiner(F) {
  T.section('Audio Joiner');
  const U = '/audio/audio-joiner/';
  const p = await loaded(U, [F['tone44.wav'], F['tone.wav']]);
  await p.waitForFunction(() => [...document.querySelectorAll('.ak-state')].length === 2 && [...document.querySelectorAll('.ak-state')].every((s) => /kHz/.test(s.textContent)), { timeout: 60000 });
  const est = await p.$eval('.vk-est', (e) => e.textContent);
  T.check(/2 files, 0:10\.00 in all at 48 kHz stereo/.test(est) && /resampled to 48 kHz/.test(est), 'two files, matched to 48 kHz stereo: ' + est);
  await T.setVal(p, '#aj-between', 'gap1');
  await T.setVal(p, '#aj-format', 'wav');
  await runJob(p, /^Join the files$/);
  let d = (await T.downloads(p))[0];
  let w = X.readWav(d.bytes);
  const pa = X.pitches(w.planes[0], 48000), pb = X.pitches(w.planes[1], 48000);
  T.check(w.rate === 48000 && w.channels === 2 && Math.abs(w.frames - 11 * 48000) <= 4 && pa.slice(0, 8).join() === '400,400,600,600,800,800,1000,1000' && pa.slice(8, 10).join() === '0,0' && pa.slice(10).join() === STEPS6 && pb.join() === pa.join(),
    'joined with a 1 s gap: ' + w.frames + ' frames (11 s at 48 kHz), ' + pa.join(','));
  /* the order: move the second up */
  await p.evaluate(() => [...document.querySelectorAll('.ak-item button')].find((b) => /Move tone\.wav up/.test(b.getAttribute('aria-label'))).click());
  await T.setVal(p, '#aj-between', 'x1');
  await runJob(p, /^Join the files$/);
  d = (await T.downloads(p))[0];
  w = X.readWav(d.bytes);
  const px = X.pitches(w.planes[0], 48000);
  T.check(Math.abs(w.frames - 9 * 48000) <= 4 && px.slice(0, 10).join() === '400,400,600,600,800,800,1000,1000,1200,1200' && px[px.length - 1] === 1000, 'reordered, with a 1 s crossfade: 9 s, the 6 s file first (' + px.join(',') + ')');
  /* equal power: the middle of the crossfade keeps most of the level */
  const rms = (a, n) => { let e = 0; for (let i = a; i < a + n; i++) e += w.planes[0][i] * w.planes[0][i]; return Math.sqrt(e / n); };
  const mid = rms(Math.round(5.4 * 48000), 4800), side = rms(Math.round(3 * 48000), 4800);
  T.check(mid > side * 0.6, 'the crossfade keeps the level (' + mid.toFixed(3) + ' in the middle against ' + side.toFixed(3) + ')');
  await p.close();
}

async function normaliser(F) {
  T.section('Volume Normaliser');
  const U = '/audio/volume-normaliser/';
  let p = await loaded(U, F['quiet.wav']);
  await p.waitForFunction(() => /LUFS/.test(document.querySelector('.ak-readout').textContent), { timeout: 60000 });
  const read = (await p.$eval('.ak-readout', (e) => e.textContent)).replace(/\s+/g, '');
  T.check(/integratedloudness[−-]30\.0LUFS/.test(read), 'a -30 dBFS 1 kHz sine measures -30.0 LUFS: ' + read);
  await T.setVal(p, '#an-target', '-16');
  await T.setVal(p, '#an-format', 'wav');
  const est = await p.$eval('.vk-est', (e) => e.textContent);
  T.check(/Raise by 14\.0 dB/.test(est), 'the plan: raise by 14.0 dB: ' + est);
  await runJob(p, /^Normalise$/);
  let d = (await T.downloads(p))[0];
  let w = X.readWav(d.bytes);
  let pk = 0; for (const v of w.planes[0]) pk = Math.max(pk, Math.abs(v));
  T.check(Math.abs(20 * Math.log10(pk) - -16) < 0.05 && d.name === 'quiet-normalised.wav', 'its peak is now -16 dBFS (the level LUFS reads for a sine): ' + (20 * Math.log10(pk)).toFixed(3));
  const after = (await p.$eval('.vk-result table', (e) => e.textContent)).replace(/\s+/g, '');
  T.check(/Afterintegratedloudness[−-]16\.0LUFS/.test(after), 'the result is measured again: ' + after.slice(0, 160));
  await p.close();
  p = await loaded(U, F['peaky.wav']);
  await p.waitForFunction(() => /LUFS/.test(document.querySelector('.ak-readout').textContent), { timeout: 60000 });
  await T.setVal(p, '#an-target', '-14');
  const est2 = await p.$eval('.vk-est', (e) => ({ t: e.textContent, c: e.className }));
  await runJob(p, /^Normalise$/);
  d = (await T.downloads(p))[0];
  w = X.readWav(d.bytes);
  pk = 0; for (const v of w.planes[0]) pk = Math.max(pk, Math.abs(v));
  T.check(/stops there/.test(est2.t) && /is-warn/.test(est2.c) && 20 * Math.log10(pk) <= -0.95 && 20 * Math.log10(pk) > -1.2, 'held back by the -1 dBTP ceiling, and said so: peak ' + (20 * Math.log10(pk)).toFixed(2) + ' dBFS; ' + est2.t.slice(0, 160));
  const kb = await T.keyboard(p);
  T.check(!kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')');
  await p.close();
}

async function speed(F) {
  T.section('Speed Changer');
  const U = '/audio/speed-changer/';
  const p = await loaded(U, F['tone.wav']);
  await T.setVal(p, '#as-speed', '1.5');
  await T.setVal(p, '#as-keep', true);
  await T.setVal(p, '#as-format', 'wav');
  const est = await p.$eval('.vk-est', (e) => e.textContent);
  T.check(/0:06\.00 becomes 0:04\.00 at 1\.50×; the pitch stays/.test(est), 'the plan: ' + est);
  await runJob(p, /^Change the speed$/);
  let d = (await T.downloads(p))[0];
  let w = X.readWav(d.bytes);
  let pp = X.pitches(w.planes[0], 48000);
  T.check(Math.abs(w.frames - 192000) <= 1 && pp[0] === 400 && pp[pp.length - 1] === 1400 && d.name === 'tone-1_5x.wav', '1.5x with the pitch kept: ' + w.frames + ' frames (4 s), pitches ' + pp.join(','));
  await T.setVal(p, '#as-keep', false);
  const est2 = await p.$eval('.vk-est', (e) => e.textContent);
  await runJob(p, /^Change the speed$/);
  d = (await T.downloads(p))[0];
  w = X.readWav(d.bytes);
  pp = X.pitches(w.planes[0], 48000);
  T.check(Math.abs(w.frames - 192000) <= 2 && pp[0] === 600 && /up 7\.0 semitones/.test(est2), '1.5x without it: 4 s and the pitch up a fifth (' + pp.slice(0, 3).join(',') + '); ' + est2);
  await p.close();
}

async function silence(F) {
  T.section('Silence Remover');
  const U = '/audio/silence-remover/';
  const p = await loaded(U, F['gaps.wav']);
  await T.setVal(p, '#ar-threshold', '-40'); await T.setVal(p, '#ar-min', '0.7'); await T.setVal(p, '#ar-pad', '0.15'); await T.setVal(p, '#ar-leave', '0');
  await p.waitForFunction(() => /1 silence found/.test(document.querySelector('.vk-est').textContent), { timeout: 30000 });
  const est = await p.$eval('.vk-est', (e) => e.textContent);
  T.check(/1 silence found; 1\.20 s will go, leaving 0:03\.70 of 0:04\.90/.test(est), 'the 1.5 s gap is found, the 0.4 s one left: ' + est);
  await T.setVal(p, '#ar-format', 'wav');
  await runJob(p, /^Remove the silences$/);
  const d = (await T.downloads(p))[0];
  const w = X.readWav(d.bytes);
  T.check(Math.abs(w.frames - Math.round(3.7 * 48000)) <= 2 && d.name === 'gaps-tightened.wav', 'the result is 3.70 s: ' + (w.frames / 48000).toFixed(3) + ' s');
  let quiet = 0; for (let i = Math.round(2.4 * 48000); i < Math.round(2.6 * 48000); i++) quiet = Math.max(quiet, Math.abs(w.planes[0][i]));
  T.check(quiet < 0.001, 'the short pause is kept (max ' + quiet.toFixed(5) + ' between 2.4 and 2.6 s)');
  await T.setVal(p, '#ar-leave', '0.5');
  await p.waitForFunction(() => /0\.70 s will go/.test(document.querySelector('.vk-est').textContent), { timeout: 30000 });
  T.check(true, 'Leave a 0.5 s pause takes 0.70 s instead');
  await p.close();
}

async function recorder() {
  T.section('Voice Recorder');
  const p = await T.open('/audio/voice-recorder/', { wait: '.ak-rec' });
  await T.press(p, /Record/);
  await p.waitForFunction(() => /Recording/.test(document.querySelector('.aiimg-status').textContent), { timeout: 20000 });
  await T.sleep(2200);
  const level = await p.$eval('.ak-meter', (e) => Number(e.getAttribute('aria-valuenow') || 0));
  await T.press(p, /Pause/);
  await T.sleep(800);
  const paused = await p.$eval('.ak-big', (e) => e.textContent);
  await T.sleep(600);
  const still = await p.$eval('.ak-big', (e) => e.textContent);
  await T.press(p, /Resume/);
  await T.sleep(1000);
  await T.press(p, /Stop/);
  await p.waitForFunction(() => document.querySelector('.vk-result'), { timeout: 20000 });
  const rec = await p.evaluate(() => window.VideoKit.lastRecording);
  const blob = await p.evaluate(async () => { const u = document.querySelector('.vk-result').dataset.url; const b = await (await fetch(u)).blob(); const fr = new FileReader(); return await new Promise((r) => { fr.onload = () => r({ type: b.type, b64: String(fr.result).split(',')[1] }); fr.readAsDataURL(b); }); });
  const bytes = Buffer.from(blob.b64, 'base64');
  const a = await T.readAudio(p, bytes);
  T.check(paused === still && near(rec.seconds, 3.2, 0.5), 'pause stops the clock (' + paused + ' = ' + still + '); recorded ' + rec.seconds.toFixed(2) + ' s');
  T.check(level > 0 && a.ok && near(a.duration, rec.seconds, 0.6), 'the meter moved (' + level + ') and the recording decodes: ' + (a.ok ? a.duration.toFixed(2) + ' s ' + blob.type : a.why));
  const kbps = bytes.length * 8 / rec.seconds / 1000;
  T.check(kbps < 90, 'about 64 kbit/s as asked: ' + kbps.toFixed(0) + ' kbit/s');
  await T.setVal(p, '#vr-format', 'wav');
  await T.clearDownloads(p);
  await p.evaluate(() => [...document.querySelectorAll('.vk-result button')].find((b) => /^Save as/.test(b.textContent)).click());
  const d = (await T.waitDownloads(p, 1, 30000))[0];
  const w = X.readWav(d.bytes);
  T.check(w && /^recording-1\.wav$/.test(d.name) && near(w.frames / w.rate, rec.seconds, 0.6), 'saved as WAV: ' + d.name + ', ' + (w ? (w.frames / w.rate).toFixed(2) + ' s at ' + w.rate + ' Hz' : 'unreadable'));
  const st = await p.$eval('.aiimg-status', (e) => e.textContent);
  T.check(/The microphone is off/.test(st), 'the page says the microphone is off: ' + st);
  await p.close();
}

async function waveform(F) {
  T.section('Waveform Video');
  const U = '/audio/waveform-video/';
  const p = await loaded(U, F['gaps.wav']);
  await T.setVal(p, '#aw-size', 'hd');
  await T.setVal(p, '#aw-style', 'bars');
  await T.setVal(p, '#aw-colour', '#f7c948');
  await T.setVal(p, '#aw-title', 'Test');
  await T.setVal(p, '#aw-from', '0'); await T.setVal(p, '#aw-to', '3');
  await runJob(p, /^Make the video$/, 300000);
  const d = (await T.downloads(p))[0];
  const ag = await p.evaluate(() => window.VideoKit.lastAudiogram);
  const v = await T.readVideo(p, d.bytes, []);
  const a = await T.readAudio(p, d.bytes);
  T.check(d.name === 'gaps-waveform.mp4' && ag.frames === 90 && v.ok && v.w === 1280 && v.h === 720 && near(v.duration, 3, 0.1), 'a 3 s 1280 x 720 MP4 of 90 frames: ' + JSON.stringify({ frames: ag.frames, w: v.w, h: v.h, d: v.duration }));
  T.check(a.ok && near(a.duration, 3, 0.1) && a.peak > 0.2, 'with the sound: ' + (a.ok ? a.duration.toFixed(2) + ' s, peak ' + a.peak.toFixed(2) : a.why));
  const gold = await p.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(new Blob([u], { type: 'video/mp4' }));
    await new Promise((r) => { v.onloadeddata = r; });
    const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d', { willReadFrequently: true });
    const at = async (t) => { v.currentTime = t; await new Promise((r) => { v.onseeked = r; }); await new Promise((r) => { if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => r()); setTimeout(r, 800); }); x.drawImage(v, 0, 0, 320, 180); const dd = x.getImageData(0, 60, 320, 70).data; let n = 0; for (let i = 0; i < dd.length; i += 4) if (dd[i] > 200 && dd[i + 1] > 160 && dd[i + 2] < 120) n++; return n; };
    return { loud: await at(0.5), quiet: await at(1.8) };
  }, d.bytes.toString('base64'));
  T.check(gold.loud > gold.quiet * 3, 'the bars follow the sound: ' + gold.loud + ' gold pixels during the tone, ' + gold.quiet + ' in the gap');
  await p.close();
}

(async () => {
  await T.start(['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']);
  const F = await fixtures();
  if (want('converter')) await converter(F);
  if (want('trimmer')) await trimmer(F);
  if (want('joiner')) await joiner(F);
  if (want('normaliser')) await normaliser(F);
  if (want('speed')) await speed(F);
  if (want('silence')) await silence(F);
  if (want('recorder')) await recorder();
  if (want('waveform')) await waveform(F);
  if (want('layout')) {
    T.section('Layouts');
    for (const u of ['/audio/', '/audio/audio-converter/', '/audio/audio-trimmer/', '/audio/audio-joiner/', '/audio/volume-normaliser/', '/audio/speed-changer/', '/audio/silence-remover/', '/audio/waveform-video/']) {
      await T.layouts(u, u === '/audio/' ? null : async (p) => { const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(F['tone.wav']); await p.waitForFunction(() => { const s = document.querySelector('.vk-studio'); return s && !s.hidden; }, { timeout: 30000 }); });
    }
  }
  void path;
  await T.finish();
})().catch(async (e) => { console.error(e); T.fails.push('the run broke: ' + (e && e.message)); await T.finish(); });
