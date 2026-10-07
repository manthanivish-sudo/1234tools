/*
 * Sound fixtures for the /audio/ tests, written here from the formats'
 * specifications (never by the site's own encoders):
 *
 *   tones(rate, channels, seconds)  planes of a sine whose pitch steps every
 *                                   whole second: 400 + 200 × s Hz, 0.3 peak
 *   wav(planes, rate)               RIFF/WAVE, 16-bit PCM (Microsoft WAVE spec)
 *   flac(planes, rate)              FLAC with STREAMINFO and VERBATIM subframes,
 *                                   4,096-sample blocks, CRC-8 headers and
 *                                   CRC-16 frames (xiph.org format spec, RFC 9639)
 *   readWav(bytes)                  { rate, channels, bits, frames, planes }
 *   pitches(plane, rate)            the strongest candidate pitch in each half
 *                                   second (Goertzel), 0 where it is quiet
 *   unzip(bytes)                    ZIP entries via the central directory
 */
'use strict';
const zlib = require('zlib');

function tones(rate, channels, seconds, level) {
  const n = Math.round(rate * seconds), a = level || 0.3;
  const p = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { const f = 400 + 200 * Math.floor(i / rate); ph += 2 * Math.PI * f / rate; p[i] = a * Math.sin(ph); }
  const out = [p];
  for (let c = 1; c < channels; c++) out.push(p.slice());
  return out;
}
const q16 = (v) => { const s = Math.max(-1, Math.min(1, v)); return s < 0 ? Math.round(s * 32768) : Math.round(s * 32767); };

function wav(planes, rate) {
  const ch = planes.length, n = planes[0].length;
  const b = Buffer.alloc(44 + n * ch * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) b.writeInt16LE(q16(planes[c][i]), 44 + (i * ch + c) * 2);
  return b;
}
function readWav(b) {
  if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WAVE') return null;
  let p = 12, fmt = null, data = null, list = null;
  while (p + 8 <= b.length) {
    const id = b.toString('latin1', p, p + 4), n = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = { at: p + 8, bytes: n };
    if (id === 'LIST') list = b.toString('latin1', p + 8, p + 8 + n);
    p += 8 + n + (n & 1);
  }
  if (!fmt || !data) return null;
  const frames = data.bytes / (fmt.channels * 2);
  const planes = [];
  for (let c = 0; c < fmt.channels; c++) { const x = new Float32Array(frames); for (let i = 0; i < frames; i++) x[i] = b.readInt16LE(data.at + (i * fmt.channels + c) * 2) / 32768; planes.push(x); }
  return Object.assign(fmt, { frames, planes, list, riffOk: b.readUInt32LE(4) === b.length - 8 });
}

/* FLAC CRCs: CRC-8 poly 0x07 over the frame header; CRC-16 poly 0x8005 over the whole frame */
function crc8(u) { let c = 0; for (const x of u) { c ^= x; for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 255 : (c << 1) & 255; } return c; }
function crc16(u) { let c = 0; for (const x of u) { c ^= x << 8; for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x8005) & 0xffff : (c << 1) & 0xffff; } return c; }
const RATE_CODE = { 88200: 1, 176400: 2, 192000: 3, 8000: 4, 16000: 5, 22050: 6, 24000: 7, 32000: 8, 44100: 9, 48000: 10, 96000: 11 };
function flac(planes, rate) {
  const ch = planes.length, n = planes[0].length, B = 4096;
  const parts = [Buffer.from('fLaC')];
  const si = Buffer.alloc(4 + 34);
  si[0] = 0x80; si[3] = 34;                              /* last metadata block, STREAMINFO, length 34 */
  si.writeUInt16BE(B, 4); si.writeUInt16BE(B, 6);        /* min and max block size */
  /* rate (20) | channels-1 (3) | bps-1 (5) | total samples (36): packed into bytes 14..21 */
  const bits = BigInt(rate) << 44n | BigInt(ch - 1) << 41n | BigInt(15) << 36n | BigInt(n);
  for (let k = 0; k < 8; k++) si[4 + 10 + k] = Number((bits >> BigInt(8 * (7 - k))) & 255n);
  parts.push(si);
  let fn = 0;
  for (let s = 0; s < n; s += B, fn++) {
    const len = Math.min(B, n - s);
    if (fn > 127) throw new Error('fixture too long for one-byte frame numbers');
    const hdr = Buffer.from([0xFF, 0xF8, (0x7 << 4) | RATE_CODE[rate], ((ch - 1) << 4) | (0x4 << 1), fn, ((len - 1) >> 8) & 255, (len - 1) & 255]);
    const head = Buffer.concat([hdr, Buffer.from([crc8(hdr)])]);
    const body = Buffer.alloc(ch * (1 + len * 2));
    let o = 0;
    for (let c = 0; c < ch; c++) { body[o++] = 0x02; for (let i = 0; i < len; i++) { body.writeInt16BE(q16(planes[c][s + i]), o); o += 2; } }
    const frame = Buffer.concat([head, body]);
    const foot = Buffer.alloc(2); foot.writeUInt16BE(crc16(frame), 0);
    parts.push(frame, foot);
  }
  return Buffer.concat(parts);
}

function goertzel(x, rate, f, from, len) {
  const w = 2 * Math.PI * f / rate, cw = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = from; i < Math.min(x.length, from + len); i++) { const s = x[i] + cw * s1 - s2; s2 = s1; s1 = s; }
  return s1 * s1 + s2 * s2 - cw * s1 * s2;
}
/** the pitch heard in each half second (measured over its middle 0.2 s), 0 when quiet */
function pitches(x, rate) {
  const out = [];
  const cands = []; for (let f = 200; f <= 3000; f += 200) cands.push(f);
  for (let s = 0; s + rate * 0.35 <= x.length; s += Math.round(rate * 0.5)) {
    const a = s + Math.round(rate * 0.15), n = Math.round(rate * 0.2);
    let e = 0; for (let i = a; i < a + n && i < x.length; i++) e += x[i] * x[i];
    if (e / n < 1e-4) { out.push(0); continue; }
    let best = 0, bp = -1;
    for (const f of cands) { const p = goertzel(x, rate, f, a, n); if (p > bp) { bp = p; best = f; } }
    out.push(best);
  }
  return out;
}

function unzip(b) {
  let e = -1;
  for (let i = b.length - 22; i >= 0; i--) if (b.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) return null;
  const count = b.readUInt16LE(e + 10), off = b.readUInt32LE(e + 16);
  const out = []; let q = off;
  for (let k = 0; k < count; k++) {
    const method = b.readUInt16LE(q + 10), csize = b.readUInt32LE(q + 20), nlen = b.readUInt16LE(q + 28), xlen = b.readUInt16LE(q + 30), clen = b.readUInt16LE(q + 32), loff = b.readUInt32LE(q + 42);
    const name = b.toString('utf8', q + 46, q + 46 + nlen);
    const lnl = b.readUInt16LE(loff + 26), lxl = b.readUInt16LE(loff + 28);
    const raw = b.slice(loff + 30 + lnl + lxl, loff + 30 + lnl + lxl + csize);
    out.push({ name, data: method === 0 ? raw : zlib.inflateRawSync(raw) });
    q += 46 + nlen + xlen + clen;
  }
  return out;
}

module.exports = { tones, wav, readWav, flac, pitches, goertzel, unzip, q16 };
