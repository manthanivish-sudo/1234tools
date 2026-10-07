/*
 * The two /audio/ tools that run a model on the device, in headless Chrome:
 *
 *   Text to Speech (Kokoro-82M): a sentence becomes a WAV at 24 kHz mono,
 *   checked by the WAV reader in _fixtures.js (header, length, level) and
 *   for the AI label in its LIST/INFO chunk; an M4A carries it in ©cmt (read
 *   from the boxes here) and an Opus file in a COMMENT tag (read from the
 *   OpusTags packet here).
 *   Audio to Text (Whisper tiny): a sentence spoken by Windows' own speech
 *   synthesiser (PowerShell System.Speech, an independent voice) is
 *   transcribed with at least 70% of its words; so is the Kokoro WAV; the
 *   TXT, SRT and VTT downloads are read here.
 *
 *   node build/audio/tests/audio-ai.js [--root <site>] [--port 9036] [--out <dir>] [--wav <speech.wav>]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('../../video/tests/_kit.js')({ name: 'audio-ai', port: 9036 });
const X = require('./_fixtures.js');
const SENTENCE = 'Hello and welcome. This is a test of speech to text in the browser. Nothing is uploaded and everything runs on your device.';

function speechWav() {
  const given = T.flag('wav', null);
  if (given) return path.resolve(given);
  if (process.platform !== 'win32') throw new Error('pass --wav <file>: the built-in speech synthesis needs Windows (PowerShell System.Speech)');
  const out = path.join(T.OUT, 'sapi.wav');
  const ps = ['Add-Type -AssemblyName System.Speech', '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)',
    "$s.SetOutputToWaveFile('" + path.win32.normalize(out) + "', $f)", "$s.Speak('" + SENTENCE.replace(/'/g, "''") + "')", '$s.Dispose()'].join('; ');
  const r = require('child_process').spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error('speech synthesis failed: ' + (r.stderr || r.stdout));
  return out;
}
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
function recall(known, got) { const g = new Set(words(got)); const k = words(known); return k.filter((w) => g.has(w)).length / k.length; }

async function stt(file, label) {
  const p = await T.open('/audio/audio-to-text/', { intercept: false });
  await T.upload(p, file);
  await p.waitForFunction(() => { const s = document.querySelector('.vk-studio'); return s && !s.hidden; }, { timeout: 60000 });
  await T.setVal(p, '#tt-lang', 'en');
  await T.clearDownloads(p);
  await T.press(p, /^Transcribe$/);
  await T.waitDone(p, 600000);
  const st = await T.status(p);
  const text = await p.$eval('.ak-transcript', (e) => e.textContent);
  const rec = recall(SENTENCE, text);
  T.check(/^Done: \d+ words/.test(st) && rec >= 0.7, label + ' transcribed with ' + Math.round(rec * 100) + '% of its words: ' + text.slice(0, 160) + ' — ' + st);
  return { p, text };
}

(async () => {
  await T.start();
  T.section('Text to Speech');
  let p = await T.open('/audio/text-to-speech/', { wait: '.ak-tts', intercept: false });
  await p.evaluate((t) => { const e = document.querySelector('#tts-text'); e.value = t; e.dispatchEvent(new Event('input', { bubbles: true })); }, SENTENCE);
  await T.setVal(p, '#tts-voice', 'bf_emma');
  await T.setVal(p, '#tts-format', 'wav');
  await T.clearDownloads(p);
  await T.press(p, /^Make the speech$/);
  await T.waitDone(p, 900000);
  let st = await T.status(p);
  let d = (await T.downloads(p))[0];
  const w = X.readWav(d.bytes);
  let pk = 0; if (w) for (const v of w.planes[0]) pk = Math.max(pk, Math.abs(v));
  T.check(/^Done/.test(st) && d && /^speech-emma\.wav$/.test(d.name) && w.rate === 24000 && w.channels === 1 && w.frames / w.rate > 4 && pk > 0.05, 'a WAV of the sentence: ' + (d && d.name) + ', ' + (w ? w.rate + ' Hz, ' + (w.frames / w.rate).toFixed(2) + ' s, peak ' + pk.toFixed(2) : 'unreadable') + ' — ' + st);
  T.check(w && /AI-generated speech/.test(w.list || ''), 'the WAV says it is AI-generated speech (LIST/INFO): ' + (w && w.list ? w.list.replace(/[^\x20-\x7e]+/g, ' ').trim().slice(0, 120) : 'no LIST chunk'));
  const note = await p.$eval('.vk-result .vk-note', (e) => e.textContent);
  T.check(/^AI-generated speech/.test(note), 'and the page labels it: ' + note.slice(0, 80));
  const kokoroWav = T.save('kokoro.wav', d.bytes);
  await T.setVal(p, '#tts-format', 'm4a');
  await T.clearDownloads(p);
  await T.press(p, /^Make the speech$/);
  await T.waitDone(p, 300000);
  d = (await T.downloads(p))[0];
  const s = d.bytes.toString('latin1');
  T.check(/\.m4a$/.test(d.name) && s.indexOf('\u00a9cmt') > 0 && s.indexOf('AI-generated speech') > 0, 'an M4A carries the label in ©cmt: ' + d.name);
  await T.setVal(p, '#tts-format', 'opus');
  await T.clearDownloads(p);
  await T.press(p, /^Make the speech$/);
  await T.waitDone(p, 300000);
  d = (await T.downloads(p))[0];
  const tagAt = d.bytes.indexOf(Buffer.from('OpusTags'));
  const tags = tagAt > 0 ? d.bytes.slice(tagAt, tagAt + 400).toString('utf8') : '';
  T.check(/\.ogg$/.test(d.name) && /COMMENT=AI-generated speech/.test(tags), 'an Opus file carries it as a COMMENT tag: ' + d.name);
  const stored = await p.evaluate(() => localStorage.getItem('1234tools-text-to-speech-v1'));
  T.check(stored && /"voice":"bf_emma"/.test(stored) && !/Hello/.test(stored), 'voice remembered, text not: ' + stored);
  const kb = await T.keyboard(p);
  T.check(!kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')');
  await p.close();

  T.section('Audio to Text');
  const r1 = await stt(speechWav(), 'Windows speech synthesis');
  /* downloads */
  await T.clearDownloads(r1.p);
  for (const re of [/^Download TXT$/, /^Download SRT$/, /^Download VTT$/]) await T.press(r1.p, re);
  const files = await T.waitDownloads(r1.p, 3, 30000);
  const txt = files.find((f) => /\.txt$/.test(f.name)), srt = files.find((f) => /\.srt$/.test(f.name)), vtt = files.find((f) => /\.vtt$/.test(f.name));
  T.check(txt && /^\[0:0\d\] /.test(txt.bytes.toString('utf8')), 'TXT with times: ' + (txt ? txt.bytes.toString('utf8').slice(0, 60) : 'missing'));
  T.check(srt && /^1\r?\n\d\d:\d\d:\d\d,\d\d\d --> \d\d:\d\d:\d\d,\d\d\d\r?\n/.test(srt.bytes.toString('utf8')), 'SRT cues: ' + (srt ? srt.bytes.toString('utf8').slice(0, 50).replace(/\n/g, ' | ') : 'missing'));
  T.check(vtt && /^WEBVTT/.test(vtt.bytes.toString('utf8')), 'VTT header: ' + (vtt ? vtt.bytes.toString('utf8').slice(0, 20) : 'missing'));
  await T.setVal(r1.p, '#tt-times', false);
  const plain = await r1.p.$eval('.ak-transcript', (e) => e.textContent);
  T.check(!/\[\d+:\d\d\]/.test(plain), 'unticking the times gives plain text');
  await r1.p.close();
  const r2 = await stt(kokoroWav, 'The Kokoro voice');
  await r2.p.close();
  await T.finish();
})().catch(async (e) => { console.error(e); T.fails.push('the run broke: ' + (e && e.message)); await T.finish(); });
