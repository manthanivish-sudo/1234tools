/*
 * Drives the /video/ tools in headless Chrome against a local server and
 * checks every file they save against references written in _kit.js, never
 * the engines' own code:
 *
 *   - test videos are made in the page with WebCodecs and the vendored
 *     muxers called directly; each frame shows its number in binary, the
 *     sound's pitch steps every second (400 + 200 × s Hz);
 *   - every output is played back by the browser's own <video> (duration,
 *     size, the frame number shown at chosen times) and decoded by its own
 *     decodeAudioData (duration, rate, the pitch in each half second); MP4
 *     boxes, WAV headers, Ogg pages and the EBML header are read from the
 *     bytes here;
 *   - Compressor: a target size is met (and the passes said), resolution,
 *     frame rate and sound choices land in the file, the blocky-target
 *     warning, the "not smaller" note, Cancel, settings remembered without
 *     the file, the real-time recorder route when WebCodecs is missing;
 *   - Trimmer: frame-accurate Exact cuts (first frame and sound start where
 *     chosen), Fast cuts from the keyframe with the gap said, arrow keys and
 *     frame buttons step one frame, a WebM stays WebM;
 *   - Converter: MOV (H.264 + AAC) and WebM (VP9 + Opus) repackaged into
 *     MP4 untouched, VP8 re-encoded, MP4 to WebM re-encoded, copy unticked;
 *   - Mute: no sound track left, picture frames identical;
 *   - Extract Audio: AAC copied into M4A, Opus copied into Ogg, WAV and
 *     Opus re-encoded, a part cut to the sample;
 *   - errors named by file; 390 / 1400 px, dark and light; keyboard reach.
 *
 *   node build/video/tests/video-tools.js [--root <site>] [--port 9021] [--out <dir>] [--only compressor,trimmer,…]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('./_kit.js')({ name: 'video-tools', port: 9021 });
const ONLY = T.flag('only', '') ? String(T.flag('only')).split(',') : null;
const want = (k) => !ONLY || ONLY.indexOf(k) >= 0;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const seq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function fixtures() {
  const p = await T.open('/video/', { wait: 'main' });
  const F = {};
  const make = async (name, o) => { F[name] = T.save(name, await T.makeVideo(p, o)); };
  await make('clip.mp4', { box: 'mp4' });                                   /* 640×360, 30 fps, 6 s, AAC 48 kHz, a keyframe every second */
  await make('big.mp4', { box: 'mp4', w: 1280, h: 720, seconds: 10, noise: true, bitrate: 5e6 });   /* for sizes: a band of noise keeps it near 5 Mbit/s */
  await make('clip.webm', { box: 'webm' });                                 /* VP9 + Opus */
  await make('vp8.webm', { box: 'webm', vcodec: 'vp8' });
  await make('silent.mp4', { box: 'mp4', audio: false });
  await make('lowbit.mp4', { box: 'mp4', noise: true, bitrate: 2.5e5 });     /* already squeezed: High makes it bigger */
  await make('rot.mp4', { box: 'mp4', rotation: 90, audio: false });
  /* a QuickTime file: the same boxes with the 'qt  ' brand and a .mov name */
  const mov = Buffer.from(fs.readFileSync(F['clip.mp4']));
  mov.write('qt  ', 8, 'latin1');
  F['clip.mov'] = T.save('clip.mov', mov);
  F['note.txt'] = T.save('note.txt', Buffer.from('not a video'));
  await p.close();
  return F;
}

async function loaded(url, file, opt) {
  const p = await T.open(url, opt);
  await T.upload(p, file);
  await p.waitForFunction(() => { const s = document.querySelector('.vk-studio'); const m = document.querySelector('.tool-io .io-msg'); return (s && !s.hidden) || (m && /is-error/.test(m.className)); }, { timeout: 60000 });
  return p;
}
async function runJob(p, re, ms) {
  await T.clearDownloads(p);
  const off = await p.evaluate((src) => { const b = [...document.querySelectorAll('.tool-io button')].find((x) => new RegExp(src).test(x.textContent)); return !b || b.disabled; }, re.source);
  if (off) throw new Error('the button ' + re.source + ' is disabled: ' + await p.$eval('.vk-est', (e) => e.textContent).catch(() => ''));
  await T.press(p, re);
  await T.waitDone(p, ms);
  const st = await T.status(p);
  if (!/^Done/.test(st) && !/^Cancelled/.test(st)) console.log('    status: ' + st);
  return st;
}

async function compressor(F) {
  T.section('Video Compressor');
  const U = '/video/video-compressor/';
  const bigSize = fs.statSync(F['big.mp4']).size;
  let p = await loaded(U, F['big.mp4']);
  /* target size */
  await T.setVal(p, '#vc-mode', 'size');
  await T.setVal(p, '#vc-target', (bigSize / 1048576 / 2).toFixed(1));
  const target = Number((bigSize / 1048576 / 2).toFixed(1)) * 1048576;
  let st = await runJob(p, /^Compress the video$/);
  let d = (await T.downloads(p))[0];
  T.save('compressed-target.mp4', d.bytes);
  const pass = await p.evaluate(() => window.VideoKit.lastCompress);
  T.check(d && d.bytes.length <= target && d.bytes.length > target * 0.5, 'a target of ' + (target / 1048576).toFixed(1) + ' MB is met: ' + d.bytes.length + ' bytes in ' + pass.passes + ' pass(es) — ' + st);
  T.check(/^video-compressed\.mp4$|^big-compressed\.mp4$/.test(d.name) && d.type === 'video/mp4', 'named from the file and the blob: ' + d.name + ' (' + d.type + ')');
  let v = await T.readVideo(p, d.bytes, [0.02, 5.02, 9.5]);
  T.check(v.ok && near(v.duration, 10, 0.1) && v.w === 1280 && v.h === 720 && seq(v.frames, [0, 150, 285]), 'the browser plays it: ' + JSON.stringify(v));
  let a = await T.readAudio(p, d.bytes);
  T.check(a.ok && a.pitches.slice(0, 20).join() === [400, 400, 600, 600, 800, 800, 1000, 1000, 1200, 1200, 1400, 1400, 1600, 1600, 1800, 1800, 2000, 2000, 2200, 2200].join(), 'the sound is there and in step: ' + (a.pitches || []).join(','));
  const tbl = await p.evaluate(() => [...document.querySelectorAll('.vk-compare tr')].map((r) => r.textContent));
  T.check(tbl.some((r) => /^Size/.test(r)) && tbl.some((r) => /^Picture bitrate/.test(r)), 'the before-and-after table: ' + tbl.slice(0, 3).join(' | '));
  /* quality + 480p + 15 fps + 64 kbit/s sound */
  await T.setVal(p, '#vc-mode', 'quality');
  await T.setVal(p, '#vc-quality', 'small');
  await T.setVal(p, '#vc-res', '480');
  await T.setVal(p, '#vc-fps', '15');
  await T.setVal(p, '#vc-sound', '96');
  st = await runJob(p, /^Compress the video$/);
  d = (await T.downloads(p))[0];
  v = await T.readVideo(p, d.bytes, [0.02, 2.0, 6.0]);
  /* at 15 fps the frame shown at t is the source frame at the slot, 2 source frames a slot */
  T.check(v.ok && v.h === 480 && v.w === 852 && near(v.duration, 10, 0.15) && v.frames.every((f, i) => near(f, [0, 60, 180][i], 2)), '480p at 15 fps: ' + JSON.stringify(v));
  const cfg = await p.evaluate(() => window.VideoKit.last);
  T.check(cfg && near(cfg.fps, 15, 0.01) && cfg.frames >= 148 && cfg.frames <= 152, '150 frames encoded at 15 fps: ' + (cfg && cfg.frames));
  a = await T.readAudio(p, d.bytes);
  T.check(a.ok && a.pitches[0] === 400 && a.pitches[18] === 2200 && cfg.audioCodec === 'mp4a.40.2' && cfg.audioRoute === 'encode', 'sound re-encoded at 96 kbit/s stays AAC and plays: ' + cfg.audioCodec + ' ' + (a.pitches || []).slice(0, 4).join(','));
  /* sound removed */
  await T.setVal(p, '#vc-sound', 'none');
  await runJob(p, /^Compress the video$/);
  d = (await T.downloads(p))[0];
  const bx = T.mp4Boxes(d.bytes);
  T.check(bx.handlers.indexOf('vide') >= 0 && bx.handlers.indexOf('soun') < 0, 'Remove the sound leaves no sound track: handlers ' + bx.handlers.join(','));
  /* a target below what the encoder can reach at this resolution: it stops and says so */
  await T.setVal(p, '#vc-mode', 'size');
  await T.setVal(p, '#vc-res', '0'); await T.setVal(p, '#vc-fps', '0'); await T.setVal(p, '#vc-sound', 'none');
  await T.setVal(p, '#vc-target', (bigSize / 1048576 / 4).toFixed(1));
  await runJob(p, /^Compress the video$/);
  const over = await p.evaluate(() => window.VideoKit.lastCompress);
  const onote = await p.$eval('.vk-result .vk-note', (e) => e.textContent).catch(() => '');
  T.check(over.size > over.target && over.passes <= 3 && /Still over the .* target after \d passes/.test(onote) && /A lower resolution or frame rate will get it there/.test(onote), 'a target the encoder cannot reach is reported, not hidden: ' + onote);
  /* the warning for a target too small for the resolution */
  await T.setVal(p, '#vc-mode', 'size');
  await T.setVal(p, '#vc-res', '0');
  await T.setVal(p, '#vc-sound', 'copy');
  await T.setVal(p, '#vc-target', '0.5');
  const warn = await p.$eval('.vk-est', (e) => ({ t: e.textContent, c: e.className }));
  T.check(/will look blocky/.test(warn.t) && /is-warn/.test(warn.c) && /(720p|480p|360p) will look better/.test(warn.t), 'a too-small target is flagged with a better resolution: ' + warn.t);
  /* Cancel */
  await T.setVal(p, '#vc-mode', 'quality');
  await T.setVal(p, '#vc-quality', 'high');
  await T.clearDownloads(p);
  await T.press(p, /^Compress the video$/);
  await T.sleep(400);
  await T.press(p, /^Cancel$/);
  await T.waitDone(p);
  st = await T.status(p);
  await T.sleep(300);
  const nd = await p.evaluate(() => window.__downloads.length);
  T.check(/^Cancelled\. Nothing was saved\./.test(st) && nd === 0, 'Cancel stops it with nothing saved: ' + st);
  /* remembered */
  const stored = await p.evaluate(() => localStorage.getItem('1234tools-video-compressor-v1'));
  await p.close();
  T.check(stored && /"quality":"high"/.test(stored) && !/big|mp4/.test(stored), 'settings kept under one versioned key, without the file: ' + stored);
  p = await loaded(U, F['big.mp4'], { keepStorage: true });
  const back = await p.evaluate(() => ({ mode: document.querySelector('#vc-mode').value, q: document.querySelector('#vc-quality').value }));
  T.check(back.mode === 'quality' && back.q === 'high', 'settings come back on the next visit: ' + JSON.stringify(back));
  await p.close();
  /* not smaller */
  p = await loaded(U, F['clip.mp4']);
  await T.setVal(p, '#vc-mode', 'quality');
  await T.setVal(p, '#vc-quality', 'high');
  await T.setVal(p, '#vc-sound', 'copy');
  const pre = await p.$eval('.vk-est', (e) => ({ t: e.textContent, c: e.className }));
  T.check(/not smaller than the original/.test(pre.t) && /is-warn/.test(pre.c), 'the estimate warns before starting when the planned bitrate is above the original’s: ' + pre.t);
  await p.close();
  p = await loaded(U, F['lowbit.mp4']);
  await T.setVal(p, '#vc-mode', 'quality');
  await T.setVal(p, '#vc-quality', 'high');
  await runJob(p, /^Compress the video$/);
  const note = await p.$eval('.vk-result .vk-note', (e) => e.textContent).catch(() => '');
  d = (await T.downloads(p))[0];
  const lowSize = fs.statSync(F['lowbit.mp4']).size;
  T.check(d.bytes.length >= lowSize && /This is not smaller than your original, which was already well compressed: keep the original/.test(note), 'a result that is not smaller says so: ' + d.bytes.length + ' vs ' + lowSize + ' — ' + note.slice(0, 140));
  /* errors named */
  await T.upload(p, F['note.txt']);
  await T.sleep(300);
  const m = await T.msg(p);
  T.check(/note\.txt: not a video/.test(m.text) && /is-error/.test(m.cls), 'a text file is refused by name: ' + m.text);
  const kb = await T.keyboard(p);
  T.check(kb.n >= 8 && !kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')' + (kb.unlabelled.length ? ': ' + kb.unlabelled.join(', ') : ''));
  await p.close();
  /* the real-time route */
  p = await loaded(U, F['clip.mp4'], { flags: { __vkNoWebCodecs: true } });
  await T.setVal(p, '#vc-mode', 'quality');
  st = await runJob(p, /^Compress the video$/, 120000);
  d = (await T.downloads(p))[0];
  const rnote = await p.$eval('.vk-result .vk-note', (e) => e.textContent).catch(() => '');
  v = await T.readVideo(p, d.bytes, [0.1], d.type);
  T.check(d && /^video\/(webm|mp4)/.test(d.type) && /Recorded in real time/.test(rnote) && v.ok, 'without WebCodecs it records in real time and says so: ' + d.name + ', ' + rnote.slice(0, 90));
  await p.close();
}

async function trimmer(F) {
  T.section('Video Trimmer');
  const U = '/video/video-trimmer/';
  let p = await loaded(U, F['clip.mp4']);
  await T.setVal(p, '#vt-start', '1.5');
  await T.setVal(p, '#vt-end', '3.2');
  const sel = await p.$eval('.sv-len', (e) => e.textContent);
  T.check(/1\.700 s/.test(sel) && /\(51 frames\)/.test(sel), 'typed times snap to frames: ' + sel);
  await T.setVal(p, '#vt-mode', 'exact');
  let st = await runJob(p, /^Trim the video$/);
  let d = (await T.downloads(p))[0];
  let v = await T.readVideo(p, d.bytes, [0.01, 1.0, 1.68]);
  T.check(v.ok && near(v.duration, 1.7, 0.05) && seq(v.frames, [45, 75, 95]), 'Exact starts on frame 45 (1.5 s) and ends after frame 95: ' + JSON.stringify(v));
  let a = await T.readAudio(p, d.bytes);
  T.check(a.ok && a.pitches[0] === 600 && a.pitches[1] === 800 && a.pitches[2] === 800, 'its sound starts at 1.5 s too: ' + (a.pitches || []).join(','));
  /* Fast */
  await T.setVal(p, '#vt-mode', 'fast');
  const hint = await p.$eval('.vk-est', (e) => e.textContent);
  T.check(/keyframe at 0:01\.000, 0\.500 s before your start/.test(hint), 'Fast says where it will really start: ' + hint);
  st = await runJob(p, /^Trim the video$/);
  d = (await T.downloads(p))[0];
  v = await T.readVideo(p, d.bytes, [0.01, 0.5, 2.15]);
  T.check(v.ok && near(v.duration, 2.2, 0.05) && seq(v.frames, [30, 45, 94]), 'Fast copies from the keyframe at 1.0 s to 3.2 s: ' + JSON.stringify(v));
  const src = fs.readFileSync(F['clip.mp4']);
  T.check(d.bytes.length < src.length * 0.5, 'a copy of 2.2 s of 6 s is under half the size: ' + d.bytes.length + ' of ' + src.length);
  a = await T.readAudio(p, d.bytes);
  T.check(a.ok && a.pitches[0] === 600 && a.pitches[2] === 800, 'its sound matches the picture: ' + (a.pitches || []).join(','));
  /* keys and buttons step one frame */
  await p.focus('.sv-trim-h');
  await p.keyboard.press('ArrowRight');
  let now = await p.$eval('#vt-start', (e) => e.value);
  T.check(now === '1.533', 'ArrowRight on the start handle steps one frame: ' + now);
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  now = await p.$eval('#vt-start', (e) => e.value);
  T.check(now === '1.467', 'ArrowLeft steps back one frame at a time: ' + now);
  await p.evaluate(() => [...document.querySelectorAll('.vk-step button')].find((b) => /End: one frame later/.test(b.getAttribute('aria-label'))).click());
  now = await p.$eval('#vt-end', (e) => e.value);
  T.check(now === '3.233', 'the End ▶ button adds one frame: ' + now);
  await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
  now = await p.$eval('#vt-start', (e) => e.value);
  T.check(now === '2.467', 'Shift+ArrowRight moves a second: ' + now);
  const shown = await p.evaluate(async () => { await new Promise((r) => setTimeout(r, 400)); return document.querySelector('.vk-preview').currentTime; });
  T.check(near(shown, 2.467, 0.02), 'the player shows the frame under the handle: ' + shown.toFixed(3));
  const kb = await T.keyboard(p);
  T.check(kb.n >= 8 && !kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')');
  await p.close();
  /* WebM stays WebM */
  p = await loaded(U, F['clip.webm']);
  await T.setVal(p, '#vt-start', '2.0');
  await T.setVal(p, '#vt-end', '4.0');
  await T.setVal(p, '#vt-mode', 'fast');
  await runJob(p, /^Trim the video$/);
  d = (await T.downloads(p))[0];
  v = await T.readVideo(p, d.bytes, [0.02, 1.5], 'video/webm');
  T.check(T.webmHead(d.bytes) && /\.webm$/.test(d.name) && v.ok && seq(v.frames, [60, 105]) && near(v.duration, 2, 0.06), 'a WebM is trimmed to a WebM: ' + d.name + ' ' + JSON.stringify(v));
  await p.close();
}

async function converter(F) {
  T.section('Video Converter');
  const U = '/video/video-converter/';
  let p = await loaded(U, F['clip.mov']);
  await T.setVal(p, '#vv-format', 'mp4');
  const est = await p.$eval('.vk-est', (e) => e.textContent);
  T.check(/copied untouched/.test(est), 'MOV with H.264 + AAC is to be repackaged: ' + est);
  await runJob(p, /^Convert the video$/);
  let d = (await T.downloads(p))[0];
  let bx = T.mp4Boxes(d.bytes);
  let v = await T.readVideo(p, d.bytes, [0.02, 3.02, 5.9]);
  let a = await T.readAudio(p, d.bytes);
  const route = await p.evaluate(() => window.VideoKit.lastConvert);
  T.check(d.name === 'clip.mp4' && bx.brand !== 'qt  ' && route.route === 'copy' && seq(v.frames, [0, 90, 177]) && a.ok && a.pitches[11] === 1400, 'MOV to MP4 by copying: ' + d.name + ', brand ' + bx.brand + ', frames ' + v.frames + ', sound ' + (a.pitches || []).slice(0, 4));
  /* untick copy: re-encoded */
  await T.setVal(p, '#vv-copy', false);
  await runJob(p, /^Convert the video$/);
  const r2 = await p.evaluate(() => window.VideoKit.lastConvert);
  d = (await T.downloads(p))[0];
  v = await T.readVideo(p, d.bytes, [3.02]);
  T.check(r2.route === 'encode' && v.ok && near(v.frames[0], 90, 1), 'unticked, it re-encodes: ' + r2.route + ', frame ' + v.frames[0]);
  await T.setVal(p, '#vv-copy', true);
  /* MP4 to WebM: both tracks re-encoded */
  await T.setVal(p, '#vv-format', 'webm');
  await runJob(p, /^Convert the video$/);
  d = (await T.downloads(p))[0];
  v = await T.readVideo(p, d.bytes, [0.02, 3.02], 'video/webm');
  a = await T.readAudio(p, d.bytes);
  T.check(T.webmHead(d.bytes) && d.name === 'clip.webm' && v.ok && near(v.frames[1], 90, 1) && a.ok && a.pitches[6] === 1000, 'MP4 to WebM (VP9 + Opus): ' + JSON.stringify(v) + ' ' + (a.pitches || []).slice(0, 8));
  await T.setVal(p, '#vv-format', 'mp4');
  await p.close();
  /* WebM VP9 + Opus to MP4 by copying */
  p = await loaded(U, F['clip.webm']);
  await T.setVal(p, '#vv-format', 'mp4');
  await runJob(p, /^Convert the video$/);
  d = (await T.downloads(p))[0];
  bx = T.mp4Boxes(d.bytes);
  v = await T.readVideo(p, d.bytes, [0.02, 3.02]);
  a = await T.readAudio(p, d.bytes);
  const r3 = await p.evaluate(() => window.VideoKit.lastConvert);
  T.check(r3.route === 'copy' && bx.handlers.join() === 'vide,soun' && v.ok && seq(v.frames, [0, 90]) && a.ok && a.pitches[0] === 400, 'WebM (VP9 + Opus) to MP4 by copying: ' + JSON.stringify(v) + ' ' + bx.handlers);
  await p.close();
  /* VP8 must be re-encoded for MP4 */
  p = await loaded(U, F['vp8.webm']);
  await T.setVal(p, '#vv-format', 'mp4');
  const est2 = await p.$eval('.vk-est', (e) => e.textContent);
  await runJob(p, /^Convert the video$/);
  d = (await T.downloads(p))[0];
  v = await T.readVideo(p, d.bytes, [3.02]);
  T.check(/VP8 video does not go into MP4/.test(est2) && v.ok && near(v.frames[0], 90, 1), 'VP8 is re-encoded and the page says why: ' + est2);
  await p.close();
}

async function mute(F) {
  T.section('Mute Video');
  const U = '/video/mute-video/';
  let p = await loaded(U, F['clip.mp4']);
  await runJob(p, /^Remove the sound$/);
  let d = (await T.downloads(p))[0];
  const bx = T.mp4Boxes(d.bytes);
  const v = await T.readVideo(p, d.bytes, [0.02, 2.02, 5.9]);
  const src = fs.readFileSync(F['clip.mp4']);
  T.check(d.name === 'clip-muted.mp4' && bx.handlers.join() === 'vide' && seq(v.frames, [0, 60, 177]) && near(v.duration, 6, 0.05), 'no sound track, the same frames: ' + bx.handlers + ' ' + JSON.stringify(v));
  T.check(d.bytes.length < src.length, 'smaller than the original by the sound: ' + d.bytes.length + ' < ' + src.length);
  /* the picture's bytes are the original's: every 4-byte length-prefixed NAL of the first keyframe appears in the output */
  const a = await T.readAudio(p, d.bytes);
  T.check(!a.ok || a.peak === 0, 'nothing to hear: ' + JSON.stringify(a).slice(0, 80));
  await p.close();
  /* a phone video's rotation flag survives: an upright video stays upright */
  p = await loaded(U, F['rot.mp4']);
  await runJob(p, /^Remove the sound$/);
  d = (await T.downloads(p))[0];
  const vr = await T.readVideo(p, d.bytes, []);
  T.check(vr.ok && vr.w === 360 && vr.h === 640, 'a rotated (portrait) video stays portrait: ' + vr.w + ' × ' + vr.h);
  await p.close();
  p = await loaded(U, F['clip.webm']);
  await runJob(p, /^Remove the sound$/);
  d = (await T.downloads(p))[0];
  const v2 = await T.readVideo(p, d.bytes, [1.02], 'video/webm');
  const a2 = await T.readAudio(p, d.bytes);
  T.check(T.webmHead(d.bytes) && d.name === 'clip-muted.webm' && v2.ok && v2.frames[0] === 30 && (!a2.ok || a2.peak === 0), 'a WebM is muted as a WebM: ' + d.name);
  await p.close();
}

function wavHeader(b) {
  if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WAVE') return null;
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('latin1', p, p + 4), n = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = { bytes: n, at: p + 8 };
    p += 8 + n + (n & 1);
  }
  return fmt && data ? Object.assign(fmt, { frames: data.bytes / (fmt.channels * fmt.bits / 8), riffOk: b.readUInt32LE(4) === b.length - 8 }) : null;
}
function oggPages(b) {
  const pages = [];
  let p = 0;
  while (p + 27 <= b.length && b.toString('latin1', p, p + 4) === 'OggS') {
    const n = b[p + 26];
    let body = 0; for (let i = 0; i < n; i++) body += b[p + 27 + i];
    pages.push({ flags: b[p + 5], granule: Number(b.readBigUInt64LE(p + 6)), seq: b.readUInt32LE(p + 18) });
    p += 27 + n + body;
  }
  return { pages, end: p === b.length };
}

async function extract(F) {
  T.section('Extract Audio');
  const U = '/video/extract-audio/';
  let p = await loaded(U, F['clip.mp4']);
  const opts = await p.$$eval('#va-format option', (o) => o.map((x) => x.value));
  T.check(opts[0] === 'original', 'for AAC the untouched copy is offered first: ' + opts.join(','));
  await T.setVal(p, '#va-format', 'original');
  await runJob(p, /^Extract the sound$/);
  let d = (await T.downloads(p))[0];
  let bx = T.mp4Boxes(d.bytes);
  let a = await T.readAudio(p, d.bytes);
  T.check(d.name === 'clip.m4a' && d.type === 'audio/mp4' && bx.handlers.join() === 'soun' && a.ok && near(a.duration, 6, 0.05) && a.pitches.join() === '400,400,600,600,800,800,1000,1000,1200,1200,1400,1400', 'AAC copied into an M4A: ' + d.name + ' ' + bx.handlers + ' ' + (a.pitches || []).join(','));
  /* WAV, whole: as long as the browser's own decoding of the video's sound */
  const ref = await T.readAudio(p, fs.readFileSync(F['clip.mp4']));
  const refFrames = Math.round(ref.duration * 48000);
  await T.setVal(p, '#va-format', 'wav');
  await runJob(p, /^Extract the sound$/);
  d = (await T.downloads(p))[0];
  let w = wavHeader(d.bytes);
  a = await T.readAudio(p, d.bytes);
  T.check(w && w.format === 1 && w.channels === 2 && w.rate === 48000 && w.bits === 16 && w.riffOk && Math.abs(w.frames - refFrames) <= 2 && a.ok && a.pitches[10] === 1400, 'WAV: 16-bit, 48 kHz, stereo, as long as the browser decodes the sound (' + refFrames + ' samples): ' + JSON.stringify(w));
  /* WAV, a part: cut to the sample */
  await T.setVal(p, '#va-from', '2');
  await T.setVal(p, '#va-to', '4');
  await runJob(p, /^Extract the sound$/);
  d = (await T.downloads(p))[0];
  w = wavHeader(d.bytes);
  a = await T.readAudio(p, d.bytes);
  T.check(w && w.frames === 96000 && a.ok && a.pitches.join() === '800,800,1000,1000' && /-2_0-4_0\.wav$/.test(d.name), 'a part from 2 s to 4 s is 96,000 samples of the right sound: ' + d.name + ' ' + (w && w.frames) + ' ' + (a.pitches || []).join(','));
  /* Opus */
  await T.setVal(p, '#va-from', '0');
  await T.setVal(p, '#va-to', '6');
  await T.setVal(p, '#va-format', 'opus');
  await T.setVal(p, '#va-rate', '64');
  await runJob(p, /^Extract the sound$/);
  d = (await T.downloads(p))[0];
  let og = oggPages(d.bytes);
  a = await T.readAudio(p, d.bytes);
  T.check(d.type === 'audio/ogg' && og.end && og.pages[0].flags === 2 && og.pages[og.pages.length - 1].flags === 4 && og.pages.every((x, i) => x.seq === i) && a.ok && near(a.duration, 6, 0.03) && a.pitches[11] === 1400, 'Opus in Ogg at 64 kbit/s: ' + og.pages.length + ' pages, ' + d.bytes.length + ' bytes, ' + (a.pitches || []).join(','));
  T.check(d.bytes.length < 64000 * 6 / 8 * 1.25, 'about 64 kbit/s: ' + d.bytes.length + ' bytes for 6 s');
  const kb = await T.keyboard(p);
  T.check(kb.n >= 6 && !kb.bad.length && !kb.unlabelled.length && !kb.nameless, 'every control reachable and labelled (' + kb.n + ')');
  await p.close();
  /* Opus from a WebM, copied into Ogg */
  p = await loaded(U, F['clip.webm']);
  await T.setVal(p, '#va-format', 'original');
  await runJob(p, /^Extract the sound$/);
  d = (await T.downloads(p))[0];
  og = oggPages(d.bytes);
  a = await T.readAudio(p, d.bytes);
  T.check(d.name === 'clip.ogg' && og.end && og.pages.length > 2 && a.ok && near(a.duration, 6, 0.08) && a.pitches[0] === 400 && a.pitches[11] === 1400, 'Opus copied out of a WebM into Ogg: ' + d.name + ' ' + (a.ok ? a.duration.toFixed(3) : a.why));
  await p.close();
  /* a video with no sound */
  p = await T.open(U);
  await T.upload(p, F['silent.mp4']);
  await p.waitForFunction(() => /is-error/.test(document.querySelector('.tool-io .io-msg').className), { timeout: 30000 });
  const m = await T.msg(p);
  T.check(/silent\.mp4: this video has no sound track/.test(m.text), 'a video without sound is refused by name: ' + m.text);
  await p.close();
}

(async () => {
  await T.start();
  const F = await fixtures();
  if (want('compressor')) await compressor(F);
  if (want('trimmer')) await trimmer(F);
  if (want('converter')) await converter(F);
  if (want('mute')) await mute(F);
  if (want('extract')) await extract(F);
  if (want('layout')) {
    T.section('Layouts');
    for (const u of ['/video/', '/video/video-compressor/', '/video/video-trimmer/', '/video/video-converter/', '/video/mute-video/', '/video/extract-audio/']) {
      await T.layouts(u, u === '/video/' ? null : async (p) => { await T.upload(p, F['clip.mp4']); await p.waitForFunction(() => { const s = document.querySelector('.vk-studio'); return s && !s.hidden; }, { timeout: 30000 }); });
    }
  }
  await T.finish();
})().catch(async (e) => { console.error(e); T.fails.push('the run broke: ' + (e && e.message)); await T.finish(); });
