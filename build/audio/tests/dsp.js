/*
 * engine/audio-dsp.js in Node, against references that do not come from it:
 *
 *   - loudness: the EBU Tech 3341 (v4) minimum-requirement cases 1–5,
 *     stereo 1 kHz sines and their gated sequences, whose expected
 *     integrated loudness the specification gives (−23.0 / −33.0 LUFS
 *     within ±0.1 LU); a sine on one channel only reads 3.01 LU lower; a
 *     44.1 kHz copy of case 1 reads the same as at 48 kHz;
 *   - true peak: a sine at a quarter of the sample rate with a 45° phase
 *     has every sample at ±0.707 of its amplitude, so the sample peak is
 *     −3.01 dB below the true peak; the true peak must come within 0.3 dB;
 *   - stretch: sines and a two-tone chord at speed 0.5, 0.75, 1.5 and 2 keep
 *     their pitch (Goertzel over the candidates) and come out at length ÷
 *     speed;
 *   - silences: tone, a second of silence, tone — found to within 10 ms;
 *     cutRanges joins with the fade asked for;
 *   - sniffRate: WAV, FLAC STREAMINFO, MP3 frame headers (MPEG-1, -2, -2.5,
 *     behind an ID3v2 tag), Ogg Opus and Ogg Vorbis headers built here
 *     from the formats' specifications.
 *
 *   node build/audio/tests/dsp.js [--root <site>]
 */
'use strict';
const path = require('path');
const args = process.argv.slice(2);
const ri = args.indexOf('--root');
const ROOT = path.resolve(ri >= 0 ? args[ri + 1] : path.join(__dirname, '..', '..', '..'));
const D = require(path.join(ROOT, 'engine', 'audio-dsp.js'));

let passes = 0; const fails = [];
const check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (ok) passes++; else fails.push(what); };
const sine = (rate, secs, f, dBFS, phase) => { const a = Math.pow(10, dBFS / 20), n = Math.round(rate * secs), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = a * Math.sin(2 * Math.PI * f * i / rate + (phase || 0)); return x; };
const cat = (...xs) => { const n = xs.reduce((s, x) => s + x.length, 0), o = new Float32Array(n); let k = 0; for (const x of xs) { o.set(x, k); k += x.length; } return o; };
const stereo = (x) => [x, x.slice()];
function goertzel(x, rate, f, from, len) {
  const w = 2 * Math.PI * f / rate, cw = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = from; i < from + len && i < x.length; i++) { const s = x[i] + cw * s1 - s2; s2 = s1; s1 = s; }
  return s1 * s1 + s2 * s2 - cw * s1 * s2;
}
function pitch(x, rate, cands) {
  let best = 0, bp = -1;
  const from = Math.floor(x.length * 0.25), len = Math.floor(x.length * 0.5);
  for (const f of cands) { const p = goertzel(x, rate, f, from, len); if (p > bp) { bp = p; best = f; } }
  return best;
}

console.log('loudness (EBU Tech 3341 cases)');
{
  const r = 48000;
  const c1 = D.loudness(stereo(sine(r, 20, 1000, -23)), r).integrated;
  check(Math.abs(c1 - -23) <= 0.1, 'case 1, stereo 1 kHz at −23 dBFS for 20 s: ' + c1.toFixed(2) + ' LUFS (−23.0 ± 0.1)');
  const c2 = D.loudness(stereo(sine(r, 20, 1000, -33)), r).integrated;
  check(Math.abs(c2 - -33) <= 0.1, 'case 2, at −33 dBFS: ' + c2.toFixed(2) + ' LUFS (−33.0 ± 0.1)');
  const c3 = D.loudness(stereo(cat(sine(r, 10, 1000, -36), sine(r, 60, 1000, -23), sine(r, 10, 1000, -36))), r).integrated;
  check(Math.abs(c3 - -23) <= 0.1, 'case 3, −36 / −23 / −36 dBFS for 10 / 60 / 10 s (relative gate): ' + c3.toFixed(2) + ' LUFS');
  const c4 = D.loudness(stereo(cat(sine(r, 10, 1000, -72), sine(r, 10, 1000, -36), sine(r, 60, 1000, -23), sine(r, 10, 1000, -36), sine(r, 10, 1000, -72))), r).integrated;
  check(Math.abs(c4 - -23) <= 0.1, 'case 4, with −72 dBFS stretches (absolute gate): ' + c4.toFixed(2) + ' LUFS');
  const c5 = D.loudness(stereo(cat(sine(r, 20, 1000, -26), sine(r, 20.1, 1000, -20), sine(r, 20, 1000, -26))), r).integrated;
  check(Math.abs(c5 - -23) <= 0.1, 'case 5, −26 / −20 / −26 dBFS for 20 / 20.1 / 20 s: ' + c5.toFixed(2) + ' LUFS');
  const one = D.loudness([sine(r, 20, 1000, -23), new Float32Array(r * 20)], r).integrated;
  check(Math.abs((c1 - one) - 3.01) <= 0.05, 'one channel silent reads 3.01 LU lower: ' + (c1 - one).toFixed(3));
  const c44 = D.loudness(stereo(sine(44100, 20, 1000, -23)), 44100).integrated;
  check(Math.abs(c44 - -23) <= 0.1, 'case 1 at 44.1 kHz: ' + c44.toFixed(2) + ' LUFS');
  const sil = D.loudness(stereo(new Float32Array(r * 2)), r).integrated;
  check(sil === -Infinity, 'silence has no loudness (−∞)');
}

console.log('true peak');
{
  const r = 48000;
  const x = sine(r, 1, r / 4, 0, Math.PI / 4);
  const L = D.loudness([x], r);
  check(Math.abs(L.peak - -3.01) < 0.05, 'sample peak of a fs/4 sine at 45°: ' + L.peak.toFixed(2) + ' dBFS');
  check(Math.abs(L.truePeak - 0) <= 0.3, 'its true peak: ' + L.truePeak.toFixed(2) + ' dBTP (0 ± 0.3)');
  const y = sine(r, 1, 997, -6);
  const M = D.loudness([y], r);
  check(Math.abs(M.truePeak - -6) <= 0.05 && Math.abs(M.peak - -6) <= 0.05, 'a 997 Hz sine at −6 dBFS: peak ' + M.peak.toFixed(2) + ', true peak ' + M.truePeak.toFixed(2));
}

console.log('stretch (WSOLA)');
{
  const cands = []; for (let f = 200; f <= 1200; f += 10) cands.push(f);
  for (const [rate, f, speed] of [[48000, 440, 1.5], [48000, 440, 0.75], [44100, 660, 2], [44100, 330, 0.5]]) {
    const x = sine(rate, 2, f, -6);
    const out = D.stretch(stereo(x), rate, speed);
    const want = Math.round(x.length / speed);
    check(out.length === 2 && Math.abs(out[0].length - want) <= 1 && pitch(out[0], rate, cands) === f && pitch(out[1], rate, cands) === f,
      'a ' + f + ' Hz sine at ' + rate + ' Hz, speed ' + speed + ': ' + out[0].length + ' samples (want ' + want + '), pitch ' + pitch(out[0], rate, cands) + ' Hz');
  }
  /* a chord keeps both notes */
  const r = 48000, a = sine(r, 2, 300, -12), b = sine(r, 2, 500, -12);
  const ch = new Float32Array(a.length); for (let i = 0; i < a.length; i++) ch[i] = a[i] + b[i];
  const o = D.stretch([ch], r, 1.25)[0];
  const p3 = goertzel(o, r, 300, 10000, 40000), p5 = goertzel(o, r, 500, 10000, 40000), p4 = goertzel(o, r, 400, 10000, 40000);
  check(p3 > 50 * p4 && p5 > 50 * p4, 'a 300 + 500 Hz chord at 1.25×: both notes stay, nothing at 400 Hz (' + (p3 / p4).toFixed(0) + '×, ' + (p5 / p4).toFixed(0) + '×)');
  /* smooth: no sample-to-sample jump larger than the sine's own largest step, plus a margin */
  const x = sine(r, 2, 440, -6), s = D.stretch([x], r, 1.5)[0];
  let jump = 0; for (let i = 2000; i < s.length - 2000; i++) jump = Math.max(jump, Math.abs(s[i] - s[i - 1]));
  const own = 0.5 * 2 * Math.PI * 440 / r;
  check(jump < own * 1.6, 'no clicks: the largest step ' + jump.toFixed(4) + ' against the sine’s own ' + own.toFixed(4));
  const same = D.stretch([x], r, 1)[0];
  check(same.length === x.length && same.every((v, i) => v === x[i]), 'speed 1 is an exact copy');
}

console.log('silences and cuts');
{
  const r = 48000;
  const x = cat(sine(r, 1, 440, -12), new Float32Array(r), sine(r, 1, 440, -12));
  const s = D.silences([x], r, { threshold: -40, min: 0.5 });
  check(s.length === 1 && Math.abs(s[0].start - 1) <= 0.01 && Math.abs(s[0].end - 2) <= 0.01, 'one silence from 1 s to 2 s: ' + JSON.stringify(s.map((q) => [q.start.toFixed(3), q.end.toFixed(3)])));
  const short = D.silences([x], r, { threshold: -40, min: 1.5 });
  check(short.length === 0, 'none when the minimum is longer than the gap');
  const quiet = cat(sine(r, 1, 440, -12), sine(r, 1, 440, -50), sine(r, 1, 440, -12));
  const q = D.silences([quiet], r, { threshold: -40, min: 0.5 });
  check(q.length === 1 && Math.abs(q[0].start - 1) <= 0.01, 'a −50 dB passage counts as silence under −40 dB');
  const cut = D.cutRanges([x], r, [[0, 1.1], [1.9, 3]], 0.01);
  check(Math.abs(cut[0].length - Math.round(2.2 * r)) <= 1, 'cutRanges keeps 2.2 s: ' + cut[0].length + ' samples');
  check(Math.abs(cut[0][Math.round(1.1 * r) - 1]) < 0.01, 'the join fades to nothing (' + Math.abs(cut[0][Math.round(1.1 * r) - 1]).toFixed(5) + ')');
}

console.log('sniffRate (headers built from the specifications)');
{
  const u8 = (a) => Uint8Array.from(a);
  const le32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const le16 = (v) => [v & 255, (v >> 8) & 255];
  const ascii = (s) => Array.from(s).map((c) => c.charCodeAt(0));
  const wav = u8([...ascii('RIFF'), ...le32(36), ...ascii('WAVE'), ...ascii('fmt '), ...le32(16), ...le16(1), ...le16(2), ...le32(44100), ...le32(176400), ...le16(4), ...le16(16), ...ascii('data'), ...le32(0)]);
  let r = D.sniffRate(wav); check(r && r.format === 'wav' && r.rate === 44100 && r.channels === 2, 'WAV 44.1 kHz stereo: ' + JSON.stringify(r));
  /* FLAC: 'fLaC', metadata block header (last=1, type 0, length 34), STREAMINFO: min/max block 4096, frame sizes 0, then 20 bits rate, 3 bits channels-1, 5 bits bps-1, 36 bits samples */
  const rate = 96000, chans = 2, bps = 24;
  const si = [0x10, 0x00, 0x10, 0x00, 0, 0, 0, 0, 0, 0, (rate >> 12) & 255, (rate >> 4) & 255, ((rate & 15) << 4) | ((chans - 1) << 1) | (((bps - 1) >> 4) & 1), (((bps - 1) & 15) << 4), 0, 0, 0, 0];
  const flac = u8([...ascii('fLaC'), 0x80, 0, 0, 34, ...si, ...new Array(16).fill(0)]);
  r = D.sniffRate(flac); check(r && r.format === 'flac' && r.rate === 96000 && r.channels === 2, 'FLAC 96 kHz stereo: ' + JSON.stringify(r));
  /* MP3 frame header: 11 sync bits, version (11 = MPEG-1, 10 = MPEG-2, 00 = 2.5), layer 01 (III), no CRC; bitrate index 9, sample-rate index, padding 0, private 0, mode */
  const hdr = (ver, sri, mode) => [0xFF, 0xE0 | (ver << 3) | (1 << 1) | 1, (9 << 4) | (sri << 2), (mode << 6)];
  for (const [ver, sri, want, mode, wc] of [[3, 0, 44100, 0, 2], [3, 1, 48000, 3, 1], [2, 0, 22050, 1, 2], [0, 2, 8000, 3, 1]]) {
    const id3 = [...ascii('ID3'), 4, 0, 0, 0, 0, 0, 10, ...new Array(10).fill(0)];
    r = D.sniffRate(u8([...id3, ...hdr(ver, sri, mode), ...new Array(64).fill(0)]));
    check(r && r.format === 'mp3' && r.rate === want && r.channels === wc, 'MP3 version bits ' + ver + ', rate index ' + sri + ' behind ID3: ' + JSON.stringify(r) + ' (want ' + want + ')');
  }
  const page = (body) => u8([...ascii('OggS'), 0, 2, ...new Array(8).fill(0), ...le32(1), ...le32(0), ...le32(0), 1, body.length, ...body]);
  r = D.sniffRate(page([...ascii('OpusHead'), 1, 2, ...le16(312), ...le32(44100), ...le16(0), 0]));
  check(r && r.format === 'opus' && r.rate === 48000 && r.channels === 2, 'Ogg Opus decodes at 48 kHz whatever the input rate: ' + JSON.stringify(r));
  r = D.sniffRate(page([1, ...ascii('vorbis'), ...le32(0), 1, ...le32(22050), ...le32(0), ...le32(0), ...le32(0), 0xB8, 1]));
  check(r && r.format === 'vorbis' && r.rate === 22050 && r.channels === 1, 'Ogg Vorbis 22.05 kHz mono: ' + JSON.stringify(r));
  check(D.sniffRate(u8(new Array(64).fill(7))) === null, 'anything else: null');
}

console.log('\ndsp: ' + passes + ' passed, ' + fails.length + ' failed');
if (fails.length) { fails.forEach((f) => console.log('  FAIL ' + f)); process.exit(1); }
