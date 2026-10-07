/*
 * The second set of /video/ tools in headless Chrome, checked against
 * references that are not the engines': the numbered test videos of
 * _kit.js (each frame shows its own number in binary), the browser's own
 * player and decoder, a PNG reader written here from the PNG specification
 * (chunks, zlib, the five filters) to read the frame number out of each
 * extracted still, and Chrome's fake camera, microphone and screen
 * (--use-fake-device-for-media-stream) for the recorders.
 *
 *   node build/video/tests/video-more.js [--root <site>] [--port 9037] [--out <dir>] [--only resizer,frames,screen,webcam,layout]
 */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const T = require('./_kit.js')({ name: 'video-more', port: 9037 });
const ONLY = T.flag('only', '') ? String(T.flag('only')).split(',') : null;
const want = (k) => !ONLY || ONLY.indexOf(k) >= 0;
const near = (a, b, t) => Math.abs(a - b) <= t;

/** PNG → { w, h, px(x, y) → [r, g, b] } for 8-bit RGB or RGBA, non-interlaced. */
function png(b) {
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, type = 0;
  const idat = [];
  while (p < b.length) {
    const n = b.readUInt32BE(p), t = b.toString('latin1', p + 4, p + 8);
    if (t === 'IHDR') { w = b.readUInt32BE(p + 8); h = b.readUInt32BE(p + 12); type = b[p + 17]; if (b[p + 16] !== 8 || b[p + 20] !== 0) throw new Error('unsupported PNG'); }
    if (t === 'IDAT') idat.push(b.slice(p + 8, p + 8 + n));
    if (t === 'IEND') break;
    p += 12 + n;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp) throw new Error('PNG colour type ' + type);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, px: (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}
/** the frame number the _kit fixture drew in a W-wide picture */
function frameNo(img) {
  const sq = Math.floor(img.w / 12);
  let n = 0;
  for (let b = 0; b < 10; b++) { const [r, g, bl] = img.px(Math.round(sq * 0.5 + b * sq * 1.1 + sq / 2), Math.round(4 + sq * 0.4)); n = (n << 1) | ((r + g + bl) / 3 > 128 ? 1 : 0); }
  return n;
}
function unzip(b) {
  let e = -1; for (let i = b.length - 22; i >= 0; i--) if (b.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  const count = b.readUInt16LE(e + 10); let q = b.readUInt32LE(e + 16); const out = [];
  for (let k = 0; k < count; k++) {
    const cs = b.readUInt32LE(q + 20), nl = b.readUInt16LE(q + 28), xl = b.readUInt16LE(q + 30), cl = b.readUInt16LE(q + 32), lo = b.readUInt32LE(q + 42);
    const name = b.toString('utf8', q + 46, q + 46 + nl), lnl = b.readUInt16LE(lo + 26), lxl = b.readUInt16LE(lo + 28);
    out.push({ name, data: b.slice(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + cs) });
    q += 46 + nl + xl + cl;
  }
  return out;
}
async function loaded(url, file, opt) {
  const p = await T.open(url, opt);
  await T.upload(p, file);
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
/** pixels of a frame of the output, at time t, via the browser's player: [r, g, b] at fractions (fx, fy) */
const pixels = (p, bytes, t, pts) => p.evaluate(async (b64, t, pts) => {
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(new Blob([u], { type: 'video/mp4' }));
  await new Promise((r) => { v.onloadeddata = r; });
  v.currentTime = t; await new Promise((r) => { v.onseeked = r; }); await new Promise((r) => { if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => r()); setTimeout(r, 800); });
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const x = c.getContext('2d'); x.drawImage(v, 0, 0);
  return pts.map(([fx, fy]) => Array.from(x.getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data.slice(0, 3)));
}, Buffer.from(bytes).toString('base64'), t, pts);

async function resizer(F) {
  T.section('Video Resizer');
  const U = '/video/video-resizer/';
  let p = await loaded(U, F['clip.mp4']);
  /* 9:16 over a blurred copy, short side 360 */
  await T.setVal(p, '#vr-shape', '9:16'); await T.setVal(p, '#vr-size', '360'); await T.setVal(p, '#vr-mode', 'blur');
  let est = await p.$eval('.vk-est', (e) => e.textContent);
  await runJob(p, /^Resize the video$/);
  let d = (await T.downloads(p))[0];
  let v = await T.readVideo(p, d.bytes, []);
  let a = await T.readAudio(p, d.bytes);
  let px = await pixels(p, d.bytes, 1.0, [[0.5, 0.05], [0.5, 0.5]]);
  const notBlack = (c) => c[0] + c[1] + c[2] > 40;
  T.check(/640 × 360 becomes 360 × 640/.test(est) && d.name === 'clip-360x640.mp4' && v.ok && v.w === 360 && v.h === 640 && near(v.duration, 6, 0.1), '9:16 at 360 px: ' + d.name + ' ' + v.w + ' × ' + v.h + ' — ' + est);
  T.check(notBlack(px[0]), 'the bars are a blurred copy, not black (top ' + px[0] + ')');
  T.check(a.ok && a.pitches[0] === 400 && a.pitches[11] === 1400, 'the sound is kept: ' + (a.pitches || []).join(','));
  /* a colour behind */
  await T.setVal(p, '#vr-mode', 'colour'); await T.setVal(p, '#vr-bg', '#ff0000');
  await runJob(p, /^Resize the video$/);
  d = (await T.downloads(p))[0];
  px = await pixels(p, d.bytes, 1.0, [[0.5, 0.05]]);
  T.check(px[0][0] > 200 && px[0][1] < 60 && px[0][2] < 60, 'a solid colour behind: top ' + px[0]);
  /* crop to fill, square, from the left */
  await T.setVal(p, '#vr-shape', '1:1'); await T.setVal(p, '#vr-mode', 'fill'); await T.setVal(p, '#vr-pos', '0');
  await runJob(p, /^Resize the video$/);
  d = (await T.downloads(p))[0];
  v = await T.readVideo(p, d.bytes, []);
  px = await pixels(p, d.bytes, 1.0, [[0.05, 0.95], [0.95, 0.95]]);
  T.check(v.w === 360 && v.h === 360 && px[0][0] > 150 && px[0][2] < 100 && px[1][2] > 120, 'square crop kept the left (red at the bottom left ' + px[0] + ', blue on the right ' + px[1] + ')');
  /* never larger than the original unless asked */
  await T.setVal(p, '#vr-shape', 'keep'); await T.setVal(p, '#vr-size', '1080'); await T.setVal(p, '#vr-up', false);
  est = await p.$eval('.vk-est', (e) => e.textContent);
  await T.setVal(p, '#vr-up', true);
  const est2 = await p.$eval('.vk-est', (e) => e.textContent);
  T.check(/becomes 640 × 360/.test(est) && /becomes 1920 × 1080/.test(est2), 'no upscaling unless ticked: ' + est.slice(0, 40) + ' / ' + est2.slice(0, 40));
  const kb = await T.keyboard(p);
  T.check(!kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')');
  await p.close();
  /* a rotated phone video is turned upright first */
  p = await loaded(U, F['rot.mp4']);
  await T.setVal(p, '#vr-shape', 'keep'); await T.setVal(p, '#vr-size', '0'); await T.setVal(p, '#vr-up', false);
  await runJob(p, /^Resize the video$/);
  d = (await T.downloads(p))[0];
  v = await T.readVideo(p, d.bytes, [1.02]);
  T.check(v.w === 360 && v.h === 640, 'a rotated video comes out upright at 360 × 640: ' + v.w + ' × ' + v.h);
  await p.close();
}

async function frames(F) {
  T.section('Video to Frames');
  const U = '/video/video-to-frames/';
  const p = await loaded(U, F['clip.mp4']);
  await T.setVal(p, '#vf-what', 'every'); await T.setVal(p, '#vf-from', '1'); await T.setVal(p, '#vf-to', '1.5'); await T.setVal(p, '#vf-format', 'image/png');
  let est = await p.$eval('.vk-est', (e) => e.textContent);
  await runJob(p, /^Take the frames$/);
  let d = (await T.downloads(p))[0];
  let ents = unzip(d.bytes);
  let nums = ents.map((e) => frameNo(png(e.data)));
  const want = []; for (let i = 30; i < 45; i++) want.push(i);
  T.check(/^15 frames/.test(est) && d.name === 'clip-frames.zip' && ents.length === 15 && nums.join() === want.join(), 'every frame from 1.0 s to 1.5 s: 15 PNGs showing frames ' + nums.join(','));
  T.check(/^clip-frame-030-1_000s\.png$/.test(ents[0].name) && /^clip-frame-044-1_467s\.png$/.test(ents[14].name), 'named by frame number and time: ' + ents[0].name + ' … ' + ents[14].name);
  const im = png(ents[0].data);
  T.check(im.w === 640 && im.h === 360, 'at the video’s own size: ' + im.w + ' × ' + im.h);
  await T.setVal(p, '#vf-what', 'interval'); await T.setVal(p, '#vf-interval', '2'); await T.setVal(p, '#vf-from', '0'); await T.setVal(p, '#vf-to', '6');
  await runJob(p, /^Take the frames$/);
  d = (await T.downloads(p))[0];
  nums = unzip(d.bytes).map((e) => frameNo(png(e.data)));
  T.check(nums.join() === '0,60,120', 'one every 2 s: frames ' + nums.join(','));
  await T.setVal(p, '#vf-what', 'count'); await T.setVal(p, '#vf-count', '4'); await T.setVal(p, '#vf-format', 'image/jpeg');
  await runJob(p, /^Take the frames$/);
  d = (await T.downloads(p))[0];
  ents = unzip(d.bytes);
  T.check(ents.length === 4 && ents.every((e) => e.data[0] === 0xff && e.data[1] === 0xd8 && /\.jpg$/.test(e.name)) && /^clip-frame-179-/.test(ents[3].name), 'four spread evenly from the first frame to the last, as JPEG: ' + ents.map((e) => e.name.replace(/^clip-frame-/, '')).join(', '));
  await T.setVal(p, '#vf-what', 'current'); await T.setVal(p, '#vf-format', 'image/png');
  await p.evaluate(async () => { const v = document.querySelector('.vk-preview'); v.currentTime = 3.51; await new Promise((r) => { v.onseeked = r; }); });
  await runJob(p, /^Take the frames$/);
  d = (await T.downloads(p))[0];
  T.check(/\.png$/.test(d.name) && frameNo(png(d.bytes)) === 105, 'the frame in the player (3.51 s): ' + d.name + ', frame ' + frameNo(png(d.bytes)));
  const kb = await T.keyboard(p);
  T.check(!kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')');
  await p.close();
}

async function screen() {
  T.section('Screen Recorder');
  const p = await T.open('/video/screen-recorder/', { wait: '.vk-rec' });
  await T.setVal(p, '#sr-sound', true); await T.setVal(p, '#sr-mic', true);
  await T.press(p, /Start recording/);
  await p.waitForFunction(() => /Recording/.test(document.querySelector('.aiimg-status').textContent), { timeout: 20000 });
  const share = await p.evaluate(() => window.VideoKit.lastShare);
  await T.sleep(2500);
  await T.press(p, /Stop/);
  await p.waitForFunction(() => document.querySelector('.vk-result'), { timeout: 20000 });
  const rec = await p.evaluate(() => window.VideoKit.lastRecording);
  T.check(share && share.video === 1 && share.audio === 1 && share.mixed === true, 'the screen’s sound and the microphone go into one track: ' + JSON.stringify(share));
  T.check(rec && /^video\/webm/.test(rec.type) && near(rec.seconds, 2.5, 0.8) && rec.size > 1000, 'a WebM recording of about 2.5 s: ' + JSON.stringify(rec));
  await T.clearDownloads(p);
  await T.press(p, /^Make an MP4$/);
  await p.waitForFunction(() => document.querySelectorAll('.vk-result').length >= 2, { timeout: 120000 });
  const d = (await T.downloads(p))[0];
  const v = await T.readVideo(p, d.bytes, []);
  const mp = await p.evaluate(() => window.VideoKit.lastRecordingMp4);
  T.check(d && /^screen-recording-1\.mp4$/.test(d.name) && v.ok && v.w > 0 && mp.audio === 'mp4a.40.2', 'Make an MP4: ' + (d && d.name) + ' ' + v.w + ' × ' + v.h + ', sound ' + (mp && mp.audio));
  const st = await p.$eval('.aiimg-status', (e) => e.textContent);
  T.check(/Sharing and the microphone are off/.test(st), 'the page says sharing has stopped: ' + st);
  await p.close();
}

async function webcam() {
  T.section('Webcam Recorder');
  const p = await T.open('/video/webcam-recorder/', { wait: '.vk-rec' });
  await T.setVal(p, '#wc-res', '480'); await T.setVal(p, '#wc-mic', true); await T.setVal(p, '#wc-mirror', true);
  await T.press(p, /Show the camera/);
  await p.waitForFunction(() => /The camera is on/.test(document.querySelector('.aiimg-status').textContent), { timeout: 20000 });
  const mirrored = await p.$eval('.vk-preview', (e) => getComputedStyle(e).transform);
  const cams = await p.$$eval('#wc-camera option', (o) => o.length);
  const said = await p.$eval('.aiimg-status', (e) => e.textContent);
  await T.press(p, /Start recording/);
  await T.sleep(2000);
  await T.press(p, /Pause/); await T.sleep(500); await T.press(p, /Resume/); await T.sleep(500);
  await T.press(p, /Stop/);
  await p.waitForFunction(() => document.querySelector('.vk-result'), { timeout: 20000 });
  const cam = await p.evaluate(() => window.VideoKit.lastCamera);
  const rec = await p.evaluate(() => window.VideoKit.lastRecording);
  T.check(/matrix\(-1/.test(mirrored) && cams >= 2, 'the preview is mirrored and the camera list filled (' + mirrored + ', ' + cams + ' options)');
  T.check(cam && cam.audio === 1 && rec && near(rec.seconds, 2.5, 0.8) && said.indexOf(cam.width + ' × ' + cam.height) > 0 && /\d+ × \d+/.test(rec.dims), 'recorded with sound; the preview size and the recorded size are both shown: ' + JSON.stringify(cam) + ' recorded ' + rec.dims);
  await T.clearDownloads(p);
  await T.press(p, /^Make an MP4$/);
  await p.waitForFunction(() => document.querySelectorAll('.vk-result').length >= 2, { timeout: 120000 });
  const d = (await T.downloads(p))[0];
  const v = await T.readVideo(p, d.bytes, []);
  const a = await T.readAudio(p, d.bytes);
  T.check(d && /^webcam-recording-1\.mp4$/.test(d.name) && v.ok && rec.dims === v.w + ' × ' + v.h && a.ok, 'Make an MP4 at the recorded size: ' + (d && d.name) + ' ' + v.w + ' × ' + v.h + ', ' + (a.ok ? a.duration.toFixed(2) + ' s of sound' : 'no sound'));
  const kb = await T.keyboard(p);
  T.check(!kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')');
  await p.close();
}

(async () => {
  await T.start(['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-select-desktop-capture-source=Entire screen']);
  const fx = await T.open('/video/', { wait: 'main' });
  const F = {};
  F['clip.mp4'] = T.save('clip.mp4', await T.makeVideo(fx, { box: 'mp4' }));
  F['rot.mp4'] = T.save('rot.mp4', await T.makeVideo(fx, { box: 'mp4', rotation: 90, audio: false }));
  await fx.close();
  if (want('resizer')) await resizer(F);
  if (want('frames')) await frames(F);
  if (want('screen')) await screen();
  if (want('webcam')) await webcam();
  if (want('layout')) {
    T.section('Layouts');
    for (const u of ['/video/video-resizer/', '/video/video-to-frames/']) await T.layouts(u, async (p) => { await T.upload(p, F['clip.mp4']); await p.waitForFunction(() => { const s = document.querySelector('.vk-studio'); return s && !s.hidden; }, { timeout: 30000 }); });
    for (const u of ['/video/screen-recorder/', '/video/webcam-recorder/']) await T.layouts(u);
  }
  void fs;
  await T.finish();
})().catch(async (e) => { console.error(e); T.fails.push('the run broke: ' + (e && e.message)); await T.finish(); });
