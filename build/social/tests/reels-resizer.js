/*
 * Drives /social/reels-resizer/ in headless Chrome against a local server
 * and checks each video against references written here:
 *
 *   - the test video is made in the page (WebCodecs + the site's muxer,
 *     with a 440 Hz tone as its sound): 640 × 360, 3 s at 30 fps, a 16 px
 *     green border round a magenta picture, so where the picture lands in
 *     the output — and what is around it — can be read off any frame;
 *   - each MP4 is parsed here box by box (ftyp, moov, every trak's tkhd
 *     size, mdhd duration, hdlr type, stsd codec and stsz sample count);
 *   - a frame is decoded in the page by a <video> and its pixels compared
 *     with the arithmetic: fitted 640 × 360 in 1080 × 1920 is 1080 × 608 at
 *     y 656 (y 464 when "higher"); the band above is the blurred copy (not
 *     the solid colour, not black), or exactly the chosen colour; cropped
 *     to fill, the focus decides whether the green edge is in frame;
 *   - a title puts white pixels above the picture; the sound is kept (a
 *     second trak, AAC or Opus); a silent video gives one trak;
 *   - Cancel, the MediaRecorder fallback (forced), the 3-minute limit,
 *     errors named by file, settings under one versioned key, keyboard and
 *     pointer control of the focus, 390 / 1400 px in both themes.
 *
 *   node build/social/tests/reels-resizer.js [--root <site>] [--port 8891] [--out <dir>]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const ROOT = path.resolve(flag('root', path.join(__dirname, '..', '..', '..')));
const PORT = Number(flag('port', 8891));
const OUT = path.resolve(flag('out', 'E:/tmp/wsoc-social2/reels-resizer'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:' + PORT;
const URL_ = '/social/reels-resizer/';
const KEY = '1234tools-social-reels-resizer-v1';
fs.mkdirSync(OUT, { recursive: true });
let puppeteer;
for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) { try { puppeteer = require(p); break; } catch (e) { /* next */ } }

let passes = 0; const fails = [], outside = [], errors = [];
const check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (ok) passes++; else fails.push(what); return !!ok; };
const section = (s) => console.log('\n' + s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser, server;

async function open(url, opt) {
  opt = opt || {};
  const p = await browser.newPage();
  await p.setViewport({ width: opt.width || 1400, height: opt.height || 1000 });
  /* past the site's service worker, so every request the page makes is seen here */
  await p.setBypassServiceWorker(true);
  await p.setRequestInterception(true);
  p.on('request', (r) => { const u = r.url(); if (/^(data|blob):/.test(u) || u.startsWith(BASE)) return r.continue(); outside.push(url + ' -> ' + u); return r.abort(); });
  p.on('pageerror', (e) => errors.push(url + ': ' + String(e && e.message || e)));
  await p.evaluateOnNewDocument((theme, keep, key) => {
    try { localStorage.setItem('1234tools-consent', 'denied'); if (theme) localStorage.setItem('1234tools-theme', theme); } catch (e) { /* */ }
    if (!keep) { try { localStorage.removeItem(key); } catch (e) { /* */ } }
    window.__downloads = [];
    HTMLAnchorElement.prototype.click = function () {
      const a = this;
      if (a.download) window.__downloads.push(fetch(a.href).then((r) => r.blob()).then(async (b) => ({ name: a.download, type: b.type, bytes: Array.from(new Uint8Array(await b.arrayBuffer())) })));
    };
  }, opt.theme || null, !!opt.keep, KEY);
  await p.goto(BASE + url, { waitUntil: 'load', timeout: 120000 });
  await p.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  await p.waitForSelector('.tool-io .dropzone', { timeout: 30000 });
  return p;
}
const downloads = async (p) => (await p.evaluate(() => Promise.all(window.__downloads))).map((d) => ({ name: d.name, type: d.type, bytes: Buffer.from(d.bytes) }));
const msg = (p) => p.$eval('.tool-io .sv-reel > .io-msg', (e) => ({ text: e.textContent, cls: e.className }));
const setVal = (p, sel, v) => p.evaluate((sel, v) => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
async function load(p, file, re) {
  await (await p.$('#sv-reel-file')).uploadFile(file);
  await p.waitForFunction((src) => { const t = document.querySelector('.sv-reel > .io-msg').textContent; return new RegExp(src).test(t) && !/^(Reading|Decoding)/.test(t); }, { timeout: 60000 }, re.source);
  return msg(p);
}
async function makeMp4(p) {
  const n0 = await p.evaluate(() => window.__downloads.length);
  await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => /^Make the MP4$/.test(b.textContent)).click());
  await p.waitForFunction((n) => window.__downloads.length > n || /could not be made/.test(document.querySelector('.sv-status').textContent), { timeout: 240000 }, n0);
  const d = await downloads(p);
  if (d.length <= n0) throw new Error('no video: ' + (await msg(p)).text);
  return { file: d[d.length - 1], status: await p.$eval('.sv-status', (e) => e.textContent) };
}

/* ---------- MP4 boxes, read here from ISO/IEC 14496-12 ---------- */
function boxes(b, start, end) {
  const out = [];
  let i = start;
  while (i + 8 <= end) {
    let size = b.readUInt32BE(i); const type = b.slice(i + 4, i + 8).toString('latin1'); let hdr = 8;
    if (size === 1) { size = Number(b.readBigUInt64BE(i + 8)); hdr = 16; } else if (size === 0) size = end - i;
    if (size < hdr || i + size > end) break;
    out.push({ type, start: i, body: i + hdr, end: i + size });
    i += size;
  }
  return out;
}
const child = (b, box, type) => boxes(b, box.body, box.end).find((x) => x.type === type);
function parseMp4(b) {
  const top = boxes(b, 0, b.length);
  const r = { ftyp: top[0] && top[0].type === 'ftyp', order: top.map((x) => x.type), tracks: [] };
  const moov = top.find((x) => x.type === 'moov');
  if (!moov) return r;
  for (const trak of boxes(b, moov.body, moov.end).filter((x) => x.type === 'trak')) {
    const t = {};
    const tkhd = child(b, trak, 'tkhd');
    const v = b[tkhd.body];
    const wAt = tkhd.body + (v === 1 ? 88 : 76);
    t.width = b.readUInt32BE(wAt) / 65536; t.height = b.readUInt32BE(wAt + 4) / 65536;
    const mdia = child(b, trak, 'mdia');
    const mdhd = child(b, mdia, 'mdhd');
    const mv = b[mdhd.body];
    t.timescale = mv === 1 ? b.readUInt32BE(mdhd.body + 20) : b.readUInt32BE(mdhd.body + 12);
    t.duration = (mv === 1 ? Number(b.readBigUInt64BE(mdhd.body + 24)) : b.readUInt32BE(mdhd.body + 16)) / t.timescale;
    const hdlr = child(b, mdia, 'hdlr');
    t.handler = b.slice(hdlr.body + 8, hdlr.body + 12).toString('latin1');
    const stbl = child(b, child(b, mdia, 'minf'), 'stbl');
    const stsd = child(b, stbl, 'stsd');
    t.codec = b.slice(stsd.body + 8 + 4, stsd.body + 8 + 8).toString('latin1');
    const stsz = child(b, stbl, 'stsz');
    t.samples = b.readUInt32BE(stsz.body + 8);
    r.tracks.push(t);
  }
  return r;
}

/* ---------- in the page ---------- */
async function makeVideo(p, o) {
  const b64 = await p.evaluate(async (o) => {
    const c = document.createElement('canvas'); c.width = o.w; c.height = o.h;
    const x = c.getContext('2d');
    const n = Math.round(o.seconds * o.fps);
    const bw = Math.round(o.w / 40);
    function* frames() {
      for (let i = 0; i < n; i++) {
        x.fillStyle = '#00e000'; x.fillRect(0, 0, o.w, o.h);
        x.fillStyle = '#e000e0'; x.fillRect(bw, bw, o.w - 2 * bw, o.h - 2 * bw);
        /* the frame number in binary: 8 squares, white for 1, black for 0, in the top of the picture */
        if (o.bits) for (let k = 0; k < 8; k++) { x.fillStyle = (i >> (7 - k)) & 1 ? '#ffffff' : '#000000'; x.fillRect(Math.round(o.w * 0.05) + k * Math.round(o.w * 0.1125), Math.round(o.h * 0.09), Math.round(o.w * 0.1125), Math.round(o.h * 0.13)); }
        yield { canvas: c, timestampUs: Math.round(i * 1e6 / o.fps), durationUs: Math.round(1e6 / o.fps) };
      }
    }
    let audio = null;
    if (o.tone) {
      const rate = 48000, len = Math.round(o.seconds * rate);
      const ab = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: rate });
      for (let ch = 0; ch < 2; ch++) { const d = ab.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = 0.3 * Math.sin(2 * Math.PI * 440 * k / rate); }
      audio = { buffer: ab };
    }
    const r = await window.AIImg.encodeVideoFrames(frames(), { fps: o.fps, width: o.w, height: o.h, bitrate: 2e6, audio });
    const buf = new Uint8Array(await r.blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
    return btoa(s);
  }, o);
  return Buffer.from(b64, 'base64');
}
/** A frame of a video file, decoded by a <video> in the page: pixels at points, and white pixels in a band. */
const frameOf = (p, bytes, type, t, probe) => p.evaluate(async (b64, type, t, probe) => {
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.src = URL.createObjectURL(new Blob([u], { type }));
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('the video would not load')); setTimeout(res, 10000); });
  if (!isFinite(v.duration)) { v.currentTime = 1e7; await new Promise((r) => { v.ondurationchange = r; setTimeout(r, 4000); }); }
  await new Promise((res) => { v.onseeked = res; v.currentTime = t; setTimeout(res, 5000); });
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  const x = c.getContext('2d'); x.drawImage(v, 0, 0);
  const out = { w: v.videoWidth, h: v.videoHeight, duration: v.duration, points: (probe.points || []).map(([a, b]) => Array.from(x.getImageData(a, b, 1, 1).data).slice(0, 3)) };
  if (probe.band) { const d = x.getImageData(0, probe.band[0], c.width, probe.band[1] - probe.band[0]).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] > 200 && d[k + 1] > 200 && d[k + 2] > 200) n++; out.white = n; }
  URL.revokeObjectURL(v.src);
  return out;
}, Buffer.from(bytes).toString('base64'), type, t, probe || {});
const near = (px, rgb, tol) => px.every((v, i) => Math.abs(v - rgb[i]) <= tol);
const isGreen = (px) => px[1] > 160 && px[0] < 90 && px[2] < 90;
const isMagenta = (px) => px[0] > 160 && px[2] > 160 && px[1] < 90;

(async () => {
  if (!puppeteer) throw new Error('puppeteer-core not found');
  const { serve } = require(path.join(ROOT, 'build/tests/serve.js'));
  server = await serve(ROOT, PORT);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'], protocolTimeout: 300000 });
  console.log('reels-resizer: ' + ROOT + ' on ' + BASE);

  const p = await open(URL_);
  section('test videos, made in the page');
  const mp4 = await makeVideo(p, { w: 640, h: 360, fps: 30, seconds: 3, tone: true, bits: true });
  const vid = path.join(OUT, 'landscape.mp4'); fs.writeFileSync(vid, mp4);
  const IN = parseMp4(mp4);
  check(IN.tracks.length === 2 && IN.tracks[0].samples === 90, 'a 3 s 640 × 360 test MP4 with a 440 Hz tone: ' + IN.tracks.map((t) => t.handler + ' ' + t.codec + ' ' + t.samples).join(', '));
  const silent = path.join(OUT, 'silent.mp4'); fs.writeFileSync(silent, await makeVideo(p, { w: 640, h: 360, fps: 30, seconds: 2, tone: false }));
  const long = path.join(OUT, 'long.mp4'); fs.writeFileSync(long, await makeVideo(p, { w: 64, h: 36, fps: 1, seconds: 185, tone: false }));
  const notes = path.join(OUT, 'notes.txt'); fs.writeFileSync(notes, 'not a video');
  const broken = path.join(OUT, 'broken.mov'); fs.writeFileSync(broken, Buffer.from('not really a movie '.repeat(80)));
  const route = await p.$eval('.sv-route', (e) => e.textContent);
  check(/^Encoded on your device: H\.264 MP4 with the original sound/.test(route), 'this Chrome encodes on the device, and the page says so: ' + route);

  section('loading');
  let m = await load(p, notes, /notes\.txt/);
  check(/^notes\.txt: not a video/.test(m.text) && /is-error/.test(m.cls), 'a text file is refused by name: ' + m.text);
  m = await load(p, broken, /broken\.mov/);
  check(/^broken\.mov: this browser could not read a picture from it/.test(m.text), 'a broken MOV is refused by name: ' + m.text.slice(0, 80));
  m = await load(p, long, /long\.mp4/);
  check(/^long\.mp4: it is 3:05 long; this tool takes up to 3 minutes/.test(m.text), 'a 3 min 5 s video is refused, with the reason: ' + m.text.slice(0, 120));
  m = await load(p, vid, /landscape\.mp4: 640/);
  check(/^landscape\.mp4: 640 × 360, 3\.0 s, with sound\./.test(m.text), 'the test video loads: ' + m.text);
  const pv = await p.$eval('.sv-reel-canvas', (c) => [c.width, c.height]);
  check(pv[0] === 360 && pv[1] === 640, 'the preview is a third of 1080 × 1920 (' + pv.join(' × ') + ')');

  section('9:16, fitted over a blurred copy');
  await p.evaluate(() => { window.__long = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (e) { window.__long = null; } });
  await p.evaluate(() => { window.__svRrTrace = []; });
  const r1 = await makeMp4(p);
  fs.writeFileSync(path.join(OUT, 'a-9x16.mp4'), r1.file.bytes);
  const longs = await p.evaluate(() => window.__long);
  check(r1.file.name === 'landscape-9x16.mp4' && r1.file.type === 'video/mp4', 'saved as ' + r1.file.name + ' (' + r1.file.type + '), ' + r1.file.bytes.length + ' bytes');
  const M1 = parseMp4(r1.file.bytes);
  const v1 = M1.tracks.find((t) => t.handler === 'vide'), a1 = M1.tracks.find((t) => t.handler === 'soun');
  check(M1.ftyp && M1.order.indexOf('moov') < M1.order.indexOf('mdat'), 'an MP4 with ftyp first and moov before mdat (' + M1.order.join(', ') + ')');
  check(v1 && v1.width === 1080 && v1.height === 1920 && v1.codec === 'avc1', 'the video track is H.264 (avc1) at 1080 × 1920 (' + (v1 && v1.codec + ' ' + v1.width + ' × ' + v1.height) + ')');
  check(v1 && v1.samples >= 86 && v1.samples <= 91 && Math.abs(v1.duration - 3) <= 0.15, 'every frame is there: ' + (v1 && v1.samples) + ' samples over ' + (v1 && v1.duration.toFixed(3)) + ' s (the input had 90 over 3 s)');
  check(a1 && /^(mp4a|Opus)$/.test(a1.codec) && Math.abs(a1.duration - 3) <= 0.15, 'the sound is kept: a second track, ' + (a1 && a1.codec + ', ' + a1.duration.toFixed(3) + ' s'));
  check(/H\.264 MP4 with (AAC|Opus) audio/.test(r1.status), 'the status names the route: ' + r1.status.slice(0, 120));
  const cfg1 = await p.evaluate(() => window.AIImg.lastVideoConfig);
  check(cfg1 && cfg1.bitrate === 8e6 && cfg1.width === 1080 && /^avc1\./.test(cfg1.codec), 'at 1080 px wide the encoder was given 8 Mbps, ' + (cfg1 && cfg1.codec));
  check(longs !== null && Math.max(0, ...longs) < 250, 'no main-thread task over 250 ms during the export (longest ' + Math.max(0, ...(longs || [0])) + ' ms)');
  /* 640 × 360 → 1080 × 608 at y 656; the 16 px border is 27 px */
  const F1 = await frameOf(p, r1.file.bytes, 'video/mp4', 1.5, { points: [[13, 960], [540, 960], [540, 668], [540, 1250], [540, 300], [540, 1700], [540, 640], [540, 1280]] });
  check(isGreen(F1.points[0]) && isGreen(F1.points[2]) && isGreen(F1.points[3]), 'the green border lands where the arithmetic says: x 0–27 and y 656–683, 1237–1264 (' + JSON.stringify([F1.points[0], F1.points[2], F1.points[3]]) + ')');
  check(isMagenta(F1.points[1]), 'the picture fills x 0–1080 between them (' + JSON.stringify(F1.points[1]) + ')');
  /* every frame, in order: decode frame k of the output at (k + ½)/30 s and read its number; the squares sit at source x 32 + 72k + 36, y 56 → output (x × 1.6875, 656 + 56 × 1.6875) */
  const seq = await p.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(new Blob([u], { type: 'video/mp4' }));
    await new Promise((r) => { v.onloadeddata = r; });
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const x = c.getContext('2d', { willReadFrequently: true });
    const out = [];
    for (let k = 0; k < 90; k++) {
      await new Promise((r) => { v.onseeked = r; v.currentTime = (k + 0.5) / 30; });
      x.drawImage(v, 0, 0);
      let n = 0;
      for (let b = 0; b < 8; b++) { const d = x.getImageData(Math.round((68 + 72 * b) * 1.6875), Math.round(656 + 56 * 1.6875), 1, 1).data; n = n * 2 + (d[0] + d[1] + d[2] > 384 ? 1 : 0); }
      out.push(n);
    }
    return out;
  }, r1.file.bytes.toString('base64'));
  const seqOk = seq.every((n, k) => n === k);
  check(seqOk, 'frame k of the output is frame k of the video, for all 90: ' + (seqOk ? '0, 1, 2 … 89' : seq.join(',')));
  if (!seqOk) console.log('    frame callbacks (media time, presented, dropped, previous presented, last taken, frame length, missed, rate): ' + JSON.stringify(await p.evaluate(() => window.__svRrTrace)));
  check(/H\.264 MP4/.test(r1.status), 'the status explains any slow-down: ' + (/fell behind (\d+ times?)/.exec(r1.status) ? 'fell behind ' + /fell behind (\d+ times?)/.exec(r1.status)[1] + ', nothing skipped' : 'no slow-down was needed'));
  const band = [F1.points[4], F1.points[5]];
  check(band.every((px) => !near(px, [16, 22, 39], 12) && px[0] + px[1] + px[2] > 60 && !isMagenta(px) && !isGreen(px)), 'above and below is the blurred, darkened copy: not the solid colour, not black, not the picture itself (' + JSON.stringify(band) + ')');
  check(!isGreen(F1.points[6]) && !isMagenta(F1.points[6]) && !isGreen(F1.points[7]), 'just outside the picture is still the band (y 640 and 1280: ' + JSON.stringify([F1.points[6], F1.points[7]]) + ')');

  section('higher, with a title');
  await setVal(p, '#sv-reel-pos', 'high');
  await setVal(p, '#sv-reel-title', 'HELLO WORLD');
  await setVal(p, '#sv-reel-tsize', 'l');
  const r2 = await makeMp4(p);
  /* higher: middle at 40% of 1920 = 768, so y 464–1072 */
  const F2 = await frameOf(p, r2.file.bytes, 'video/mp4', 1.5, { points: [[540, 768], [540, 478], [540, 1150]], band: [120, 440] });
  const F1band = await frameOf(p, r1.file.bytes, 'video/mp4', 1.5, { band: [120, 440] });
  check(isMagenta(F2.points[0]) && isGreen(F2.points[1]) && !isMagenta(F2.points[2]) && !isGreen(F2.points[2]), '“Higher” puts the picture at y 464–1072, leaving the bottom 848 px clear (' + JSON.stringify(F2.points) + ')');
  check(F2.white > 2000 && F1band.white < 200, 'the title is drawn above the picture: ' + F2.white + ' white pixels in y 120–440, ' + F1band.white + ' without a title');
  await setVal(p, '#sv-reel-title', ''); await setVal(p, '#sv-reel-pos', 'centre');

  section('720 × 1280: a solid colour, then cropped to fill');
  await setVal(p, '#sv-reel-size', '9x16-720');
  await setVal(p, '#sv-reel-mode', 'colour');
  await setVal(p, '#sv-reel-bg', '#2050a0');
  const r3 = await makeMp4(p);
  const M3 = parseMp4(r3.file.bytes);
  /* 640 × 360 → 720 × 405 at y 438 (1280 − 405 = 875, halved and rounded) */
  const F3 = await frameOf(p, r3.file.bytes, 'video/mp4', 1.5, { points: [[360, 200], [360, 1100], [360, 640]] });
  check(M3.tracks[0].width === 720 && M3.tracks[0].height === 1280 && r3.file.name === 'landscape-9x16.mp4', '720 × 1280 (' + M3.tracks[0].width + ' × ' + M3.tracks[0].height + ')');
  check(near(F3.points[0], [32, 80, 160], 14) && near(F3.points[1], [32, 80, 160], 14) && isMagenta(F3.points[2]), 'the band is the chosen #2050a0, within the encoder’s rounding (' + JSON.stringify(F3.points) + ')');
  await setVal(p, '#sv-reel-mode', 'fill');
  const r4 = await makeMp4(p);
  /* fill: scale 3.556, a 202.5 × 360 window from x 218.75: all magenta */
  const F4 = await frameOf(p, r4.file.bytes, 'video/mp4', 1.5, { points: [[13, 640], [706, 640], [360, 1270]] });
  check(isMagenta(F4.points[0]) && isMagenta(F4.points[1]) && isGreen(F4.points[2]), 'cropped to fill around the middle, the full height stays (green at the bottom edge) and the green sides are cut away (' + JSON.stringify(F4.points) + ')');
  /* the focus by keyboard on the preview: four presses of ← is 0.30 */
  await p.focus('.sv-reel-canvas');
  for (let k = 0; k < 4; k++) await p.keyboard.press('ArrowLeft');
  await sleep(200);
  const fxKey = await p.$eval('#sv-reel-fx', (e) => e.value);
  check(fxKey === '30', 'four presses of ← on the preview move the focus to 30% (' + fxKey + ')');
  /* by pointer: dragging the picture to the right shows more of its left */
  const cb = await p.$eval('.sv-reel-canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(cb.x, cb.y); await p.mouse.down(); await p.mouse.move(cb.x + 60, cb.y, { steps: 5 }); await p.mouse.up();
  await sleep(200);
  const fxDrag = Number(await p.$eval('#sv-reel-fx', (e) => e.value));
  check(fxDrag < 30, 'dragging the picture 60 px right moves the focus left, to ' + fxDrag + '%');
  await setVal(p, '#sv-reel-fx', 0);
  const r5 = await makeMp4(p);
  const F5 = await frameOf(p, r5.file.bytes, 'video/mp4', 1.5, { points: [[13, 640], [600, 640]] });
  check(isGreen(F5.points[0]) && isMagenta(F5.points[1]), 'focus at 0%: the left edge of the video, green border and all, is in frame (' + JSON.stringify(F5.points) + ')');
  await setVal(p, '#sv-reel-fx', 50);

  section('4:5 and 1:1');
  await setVal(p, '#sv-reel-mode', 'blur');
  for (const [size, w, h] of [['4x5', 1080, 1350], ['1x1', 1080, 1080]]) {
    await setVal(p, '#sv-reel-size', size);
    const r = await makeMp4(p);
    const M = parseMp4(r.file.bytes);
    check(M.tracks[0].width === w && M.tracks[0].height === h && r.file.name === 'landscape-' + size + '.mp4' && M.tracks.length === 2, size + ': ' + r.file.name + ', ' + M.tracks[0].width + ' × ' + M.tracks[0].height + ', ' + M.tracks.length + ' tracks');
  }

  /* 60 fps asked of a 30 fps clip: the frames it has, none made up */
  await setVal(p, '#sv-reel-size', '9x16-720'); await setVal(p, '#sv-reel-fps', 60);
  const r60 = await makeMp4(p);
  const M60 = parseMp4(r60.file.bytes).tracks.find((t) => t.handler === 'vide');
  const cfg60 = await p.evaluate(() => window.AIImg.lastVideoConfig);
  check(M60.samples >= 86 && M60.samples <= 91 && Math.abs(M60.duration - 3) <= 0.15, '60 fps from a 30 fps clip still has ' + M60.samples + ' frames over ' + M60.duration.toFixed(2) + ' s: none are invented');
  check(cfg60 && cfg60.bitrate === 5e6 && cfg60.width === 720, 'at 720 px wide the encoder was given 5 Mbps (' + (cfg60 && cfg60.bitrate) + ')');
  await setVal(p, '#sv-reel-fps', 30);

  section('a silent video');
  m = await load(p, silent, /silent\.mp4: 640/);
  check(/no sound track found/.test(m.text), 'a video without sound is said to have none: ' + m.text);
  await setVal(p, '#sv-reel-size', '9x16-720');
  const r6 = await makeMp4(p);
  const M6 = parseMp4(r6.file.bytes);
  check(M6.tracks.length === 1 && M6.tracks[0].handler === 'vide' && /has no sound track/.test(r6.status), 'it comes out with one (video) track, and the status says why: ' + r6.status.slice(-60));

  section('cancel');
  m = await load(p, vid, /landscape\.mp4: 640/);
  await setVal(p, '#sv-reel-size', '9x16');
  const n0 = await p.evaluate(() => window.__downloads.length);
  await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => /^Make the MP4$/.test(b.textContent)).click());
  await p.waitForFunction(() => /^Encoding — (\d+)%/.test(document.querySelector('.sv-status').textContent) && Number(/(\d+)%/.exec(document.querySelector('.sv-status').textContent)[1]) >= 20, { timeout: 60000 });
  const pg = await p.evaluate(() => document.querySelector('.sv-reel .aiimg-progress').getAttribute('aria-valuenow'));
  await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => b.textContent === 'Cancel').click());
  await p.waitForFunction(() => /Cancelled/.test(document.querySelector('.sv-status').textContent), { timeout: 30000 });
  await sleep(1500);
  const ac = await p.evaluate(() => ({ n: window.__downloads.length, s: document.querySelector('.sv-status').textContent, b: [...document.querySelectorAll('.tool-io button')].find((b) => /^Make the MP4$/.test(b.textContent)).disabled }));
  check(Number(pg) >= 20 && ac.n === n0 && /^Cancelled\. Nothing was saved\./.test(ac.s) && !ac.b, 'Cancel at ' + pg + '% stops it, saves nothing, and the button is ready again');
  const r7 = await makeMp4(p);
  check(parseMp4(r7.file.bytes).tracks[0].samples >= 86, 'the next export after a cancel is whole (' + parseMp4(r7.file.bytes).tracks[0].samples + ' frames)');

  section('the real-time fallback (as in Firefox, forced)');
  await p.evaluate(() => { window.__svForceRecorder = true; });
  await setVal(p, '#sv-reel-size', '9x16-720');
  const t0 = Date.now();
  const r8 = await makeMp4(p);
  const took = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(OUT, 'recorded.' + r8.file.name.split('.').pop()), r8.file.bytes);
  const ebml = r8.file.bytes.readUInt32BE(0) === 0x1A45DFA3;
  check((r8.file.type === 'video/webm' && /\.webm$/.test(r8.file.name) && ebml) || (r8.file.type === 'video/mp4' && /\.mp4$/.test(r8.file.name)), 'recorded as ' + r8.file.name + ' (' + r8.file.type + (ebml ? ', EBML header' : '') + '), ' + r8.file.bytes.length + ' bytes');
  check(/recorded in real time with sound/.test(r8.status) && took >= 2.8, 'in real time (' + took.toFixed(1) + ' s for a 3 s video), with the sound, and the page says so');
  const F8 = await frameOf(p, r8.file.bytes, r8.file.type, 1.5, { points: [[360, 640], [8, 640], [360, 200]] });
  check(F8.w === 720 && F8.h === 1280 && isMagenta(F8.points[0]) && isGreen(F8.points[1]) && !isMagenta(F8.points[2]), 'the recording has the same layout: 720 × 1280, picture in the middle, band above (' + JSON.stringify(F8.points) + ')');
  await p.evaluate(() => { window.__svForceRecorder = false; });
  const stored = await p.evaluate((k) => localStorage.getItem(k), KEY);
  check(stored && /"v":1/.test(stored) && /"size":"9x16-720"/.test(stored) && !/HELLO|landscape/.test(stored), 'settings are kept under one versioned key, without the title or the file name: ' + stored);
  await p.close();

  section('a new visit');
  const p2 = await open(URL_, { keep: true });
  const kept = await p2.evaluate(() => ({ size: document.getElementById('sv-reel-size').value, mode: document.getElementById('sv-reel-mode').value, title: document.getElementById('sv-reel-title').value }));
  check(kept.size === '9x16-720' && kept.mode === 'blur' && kept.title === '', 'it opens with the last size and background, and no title (' + JSON.stringify(kept) + ')');
  const kb = await p2.evaluate(() => {
    const io = document.querySelector('.tool-io');
    const ctl = [...io.querySelectorAll('button, input, select, textarea, [role=button], canvas[tabindex]')].filter((e) => e.type !== 'file');
    return { n: ctl.length, bad: ctl.filter((e) => e.tabIndex < 0).length, unl: ctl.filter((e) => /INPUT|SELECT|TEXTAREA/.test(e.tagName) && !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map((e) => e.id) };
  });
  check(kb.n > 15 && !kb.bad && !kb.unl.length, 'all ' + kb.n + ' controls reachable by Tab and labelled' + (kb.unl.length ? ': unlabelled ' + kb.unl.join(', ') : ''));
  await p2.close();

  section('layout');
  for (const [w, theme] of [[390, 'dark'], [1400, 'dark'], [390, 'light'], [1400, 'light']]) {
    const l = await open(URL_, { width: w, height: 900, theme });
    await l.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await load(l, vid, /landscape\.mp4: 640/);
    await sleep(500);
    const mm = await l.evaluate(() => {
      const io = document.querySelector('.tool-io');
      const wide = [...io.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1); }).slice(0, 3).map((e) => e.tagName + '.' + e.className);
      return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, wide };
    });
    check(mm.sw <= mm.iw && !mm.wide.length, w + ' px, ' + theme + ': no sideways scroll (' + mm.sw + ' of ' + mm.iw + (mm.wide.length ? '; too wide: ' + mm.wide.join(', ') : '') + ')');
    await l.screenshot({ path: path.join(OUT, 'layout-' + w + '-' + theme + '.png') });
    await l.close();
  }

  await browser.close(); if (server) server.close();
  section('requests outside 127.0.0.1: ' + (outside.length ? outside.join(' | ') : 'none'));
  if (errors.length) console.log('page errors: ' + errors.join(' | '));
  check(!outside.length, 'no request left 127.0.0.1');
  check(!errors.length, 'no page error');
  console.log('\nreels-resizer: ' + passes + ' passed, ' + fails.length + ' failed');
  fails.forEach((f) => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
})().catch(async (e) => { console.error(e); try { await browser.close(); } catch (x) { /* */ } if (server) server.close(); process.exit(2); });
