/*
 * Drives /social/video-to-gif/ in headless Chrome against a local server and
 * checks every GIF against references written here, not the engine's code:
 *
 *   - the test video is made in the page (WebCodecs + the site's muxer):
 *     640 × 360 at 30 fps for 6 s; the top row holds 8 black-or-white
 *     squares spelling the frame number in binary, the lower left third is
 *     red and the rest blue, so any frame of a GIF says which moment of the
 *     video it shows;
 *   - each GIF is parsed here byte by byte (header, logical screen, every
 *     graphic control extension's delay, image descriptors, the NETSCAPE2.0
 *     loop count, the trailer), and decoded frame by frame in the page by
 *     the browser's own ImageDecoder, whose frame count and repetition
 *     count must agree with the parse;
 *   - the frame number read from frame i must be the one at
 *     start + i / fps × speed (±1 source frame), at 1× and at 2×;
 *   - square crop, caption, loops (for ever, once, 3 times), 15 fps delays
 *     that add up, dither on vs off, half width vs full width, the size
 *     estimate against the real file (within 25%);
 *   - trim handles by keyboard and by typed seconds; the 600-frame limit;
 *   - Cancel stops a long export with nothing saved; the main thread has no
 *     task over 200 ms while a GIF is encoded in the worker; the page-side
 *     fallback (no worker) makes the same GIF;
 *   - errors named by file (a text file, a broken MP4, two files dropped at
 *     once); settings kept under one versioned key without the caption;
 *   - 390 / 1400 px, dark and light; every control reachable by keyboard.
 *
 *   node build/social/tests/video-to-gif.js [--root <site>] [--port 8890] [--out <dir>]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const ROOT = path.resolve(flag('root', path.join(__dirname, '..', '..', '..')));
const PORT = Number(flag('port', 8890));
const OUT = path.resolve(flag('out', 'E:/tmp/wsoc-social2/video-to-gif'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:' + PORT;
const URL_ = '/social/video-to-gif/';
const KEY = '1234tools-social-video-to-gif-v1';
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
const msg = (p) => p.$eval('.tool-io .sv-gif > .io-msg', (e) => ({ text: e.textContent, cls: e.className }));
const setVal = (p, sel, v) => p.evaluate((sel, v) => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); if (e.type === 'checkbox') e.checked = !!v; else e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const estimate = async (p) => {
  await sleep(100);
  await p.waitForFunction(() => /^Estimated size/.test(document.querySelector('.sv-est').textContent), { timeout: 60000 });
  return p.$eval('.sv-est', (e) => ({ bytes: Number(e.dataset.bytes), text: e.textContent }));
};
async function makeGif(p) {
  const n0 = await p.evaluate(() => window.__downloads.length);
  await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => /^Make the GIF$/.test(b.textContent)).click());
  await p.waitForFunction((n) => window.__downloads.length > n || /could not be made/.test(document.querySelector('.sv-status').textContent), { timeout: 240000 }, n0);
  const d = await downloads(p);
  if (d.length <= n0) throw new Error('no GIF: ' + (await p.$eval('.sv-status', (e) => e.textContent)) + ' ' + (await msg(p)).text);
  return d[d.length - 1];
}

/* ---------- the GIF, parsed here from the GIF89a specification ---------- */
function parseGif(b) {
  const r = { ok: false, frames: 0, delays: [], loop: null, w: 0, h: 0, frameSizes: [] };
  if (b.slice(0, 6).toString('latin1') !== 'GIF89a') { r.why = 'no GIF89a header'; return r; }
  r.w = b.readUInt16LE(6); r.h = b.readUInt16LE(8);
  const packed = b[10];
  let i = 13;
  if (packed & 0x80) { r.globalColours = 2 << (packed & 7); i += 3 * r.globalColours; }
  const skipSub = () => { while (b[i] !== 0) { i += b[i] + 1; if (i >= b.length) throw new Error('ran off the end'); } i++; };
  try {
    for (;;) {
      const t = b[i++];
      if (t === 0x3B) { r.ok = true; r.trailerAt = i - 1; break; }
      if (t === 0x21) {
        const label = b[i++];
        if (label === 0xF9) { const size = b[i]; r.delays.push(b.readUInt16LE(i + 2)); i += size + 1; skipSub(); }
        else if (label === 0xFF) {
          const size = b[i]; const id = b.slice(i + 1, i + 1 + size).toString('latin1'); i += size + 1;
          if (id === 'NETSCAPE2.0' && b[i] === 3 && b[i + 1] === 1) r.loop = b.readUInt16LE(i + 2);
          skipSub();
        } else { i += b[i] + 1; skipSub(); }
      } else if (t === 0x2C) {
        const start = i - 1;
        const fw = b.readUInt16LE(i + 4), fh = b.readUInt16LE(i + 6), fp = b[i + 8];
        i += 9;
        if (fp & 0x80) i += 3 * (2 << (fp & 7));
        i++;                       /* LZW minimum code size */
        skipSub();
        r.frames++; r.frameSizes.push(i - start);
        if (fw !== r.w || fh !== r.h) r.partial = true;
      } else { r.why = 'unknown block 0x' + t.toString(16) + ' at ' + (i - 1); return r; }
    }
  } catch (e) { r.why = e.message; }
  return r;
}

/* ---------- in the page: a test video, and GIF frames decoded by the browser ---------- */
async function makeVideo(p, o) {
  const b64 = await p.evaluate(async (o) => {
    const c = document.createElement('canvas'); c.width = o.w; c.height = o.h;
    const x = c.getContext('2d');
    const n = Math.round(o.seconds * o.fps);
    const sq = o.w / 8, sh = Math.round(o.h / 4.5);
    function* frames() {
      for (let i = 0; i < n; i++) {
        x.fillStyle = '#204080'; x.fillRect(0, 0, o.w, o.h);
        x.fillStyle = '#e01010'; x.fillRect(0, sh, Math.round(o.w / 3), o.h - sh);
        for (let k = 0; k < 8; k++) { x.fillStyle = (i >> (7 - k)) & 1 ? '#ffffff' : '#000000'; x.fillRect(k * sq, 0, sq, sh); }
        yield { canvas: c, timestampUs: Math.round(i * 1e6 / o.fps), durationUs: Math.round(1e6 / o.fps) };
      }
    }
    const r = await window.AIImg.encodeVideoFrames(frames(), { fps: o.fps, width: o.w, height: o.h, bitrate: 3e6 });
    const buf = new Uint8Array(await r.blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
    return btoa(s);
  }, o);
  return Buffer.from(b64, 'base64');
}
/** ImageDecoder on the GIF: frame count, repetition count, and per frame the bit row and a few pixels. */
const decodeGif = (p, bytes, probe) => p.evaluate(async (b64, probe) => {
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const dec = new ImageDecoder({ data: u, type: 'image/gif' });
  await dec.completed; await dec.tracks.ready;
  const tr = dec.tracks.selectedTrack;
  const out = { frameCount: tr.frameCount, repetitionCount: tr.repetitionCount === Infinity ? 'Infinity' : tr.repetitionCount, frames: [] };
  for (let i = 0; i < tr.frameCount; i++) {
    const { image } = await dec.decode({ frameIndex: i });
    const w = image.displayWidth, h = image.displayHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(image, 0, 0); image.close();
    const px = (a, b) => Array.from(x.getImageData(Math.round(a), Math.round(b), 1, 1).data).slice(0, 3);
    const f = { w, h, points: (probe.points || []).map(([a, b]) => px(a < 0 ? w + a : a, b < 0 ? h + b : b)) };
    if (probe.bits) {
      const sq = w / 8, y = probe.bitsY;
      let n = 0; for (let k = 0; k < 8; k++) { const v = px(k * sq + sq / 2, y); n = n * 2 + (v[0] + v[1] + v[2] > 384 ? 1 : 0); }
      f.n = n;
    }
    if (probe.band) {
      const [y0, y1] = probe.band; const d = x.getImageData(0, y0, w, y1 - y0).data;
      let white = 0; for (let k = 0; k < d.length; k += 4) if (d[k] > 220 && d[k + 1] > 220 && d[k + 2] > 220) white++;
      f.white = white;
    }
    out.frames.push(f);
  }
  dec.close();
  return out;
}, Buffer.from(bytes).toString('base64'), probe || {});

(async () => {
  if (!puppeteer) throw new Error('puppeteer-core not found');
  const { serve } = require(path.join(ROOT, 'build/tests/serve.js'));
  server = await serve(ROOT, PORT);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'], protocolTimeout: 300000 });
  console.log('video-to-gif: ' + ROOT + ' on ' + BASE);

  const p = await open(URL_);
  section('test videos, made in the page');
  const mp4 = await makeVideo(p, { w: 640, h: 360, fps: 30, seconds: 6 });
  const vid = path.join(OUT, 'frames.mp4'); fs.writeFileSync(vid, mp4);
  check(mp4.length > 10000 && mp4.slice(4, 8).toString() === 'ftyp', 'a 6 s, 640 × 360 test MP4 with the frame number on every frame: ' + mp4.length + ' bytes');
  const longMp4 = await makeVideo(p, { w: 160, h: 90, fps: 2, seconds: 32 });
  const longVid = path.join(OUT, 'long.mp4'); fs.writeFileSync(longVid, longMp4);
  const notes = path.join(OUT, 'notes.txt'); fs.writeFileSync(notes, 'not a video');
  const broken = path.join(OUT, 'broken.mp4'); fs.writeFileSync(broken, Buffer.from('this is not really an mp4 file at all, just some bytes'.repeat(40)));

  section('loading');
  await (await p.$('#sv-gif-file')).uploadFile(notes); await sleep(300);
  let m = await msg(p);
  check(/^notes\.txt: not a video/.test(m.text) && /is-error/.test(m.cls), 'a text file is refused by name: ' + m.text);
  await (await p.$('#sv-gif-file')).uploadFile(broken);
  await p.waitForFunction(() => /broken\.mp4/.test(document.querySelector('.sv-gif > .io-msg').textContent) && !/Reading/.test(document.querySelector('.sv-gif > .io-msg').textContent), { timeout: 30000 });
  m = await msg(p);
  check(/^broken\.mp4: this browser could not read a picture from it/.test(m.text), 'a broken MP4 is refused by name: ' + m.text.slice(0, 90));
  /* two files dropped together: the video is used, the other named */
  const vidB64 = mp4.toString('base64');
  await p.evaluate((b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([u], 'frames.mp4', { type: 'video/mp4' }));
    dt.items.add(new File(['x'], 'shopping-list.txt', { type: 'text/plain' }));
    document.querySelector('.sv-gif').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, vidB64);
  await p.waitForFunction(() => !document.querySelector('.sv-studio').hidden, { timeout: 30000 });
  m = await msg(p);
  check(/^frames\.mp4: 640 × 360, 6\.0 s\./.test(m.text) && /shopping-list\.txt: not a video/.test(m.text), 'dropped with a text file, the video loads and the other file is named: ' + m.text);
  const startup = await p.evaluate(() => ({ s: document.getElementById('sv-gif-start').value, e: document.getElementById('sv-gif-end').value, len: document.querySelector('.sv-len').textContent, cw: document.querySelector('.sv-canvas').width, ch: document.querySelector('.sv-canvas').height }));
  check(startup.s === '0.0' && startup.e === '5.0' && startup.cw === 480 && startup.ch === 270, 'it starts with the first 5 s selected, preview 480 × 270 (' + JSON.stringify(startup) + ')');

  section('trim bar');
  const handle = (i) => p.evaluateHandle((i) => document.querySelectorAll('.sv-trim-h')[i], i);
  await (await handle(0)).focus();
  for (let k = 0; k < 5; k++) await p.keyboard.press('ArrowRight');
  await sleep(200);
  let st = await p.evaluate(() => [document.getElementById('sv-gif-start').value, document.querySelectorAll('.sv-trim-h')[0].getAttribute('aria-valuenow')]);
  check(st[0] === '0.5' && st[1] === '0.5', 'five presses of → move the start to 0.5 s (input ' + st[0] + ', aria-valuenow ' + st[1] + ')');
  await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
  await sleep(200);
  st = await p.evaluate(() => document.getElementById('sv-gif-start').value);
  check(st === '1.5', 'Shift + → moves it a whole second, to 1.5 s (' + st + ')');
  await (await handle(1)).focus();
  await p.keyboard.press('End'); await sleep(200);
  st = await p.evaluate(() => document.getElementById('sv-gif-end').value);
  check(st === '6.0', 'End moves the end handle to the end of the video (' + st + ')');
  await (await handle(0)).focus();
  await p.keyboard.press('End'); await sleep(200);
  st = await p.evaluate(() => [document.getElementById('sv-gif-start').value, document.getElementById('sv-gif-end').value]);
  check(st[0] === '5.9' && st[1] === '6.0', 'the start cannot pass the end: End on the start handle stops 0.1 s short (' + st.join(' – ') + ')');

  /* the pointer: drag the end handle to the middle of the track */
  {
    const tb = await p.$eval('.sv-trim-track', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
    await setVal(p, '#sv-gif-start', '0.5');
    const hs = await p.evaluate(() => { const r = document.querySelectorAll('.sv-trim-h')[1].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(hs.x, hs.y); await p.mouse.down();
    await p.mouse.move(tb.x + tb.w * 0.25, hs.y, { steps: 6 }); await p.mouse.move(tb.x + tb.w * 0.5, hs.y, { steps: 6 }); await p.mouse.up();
    await sleep(300);
    const e = Number(await p.evaluate(() => document.getElementById('sv-gif-end').value));
    const s0 = Number(await p.evaluate(() => document.getElementById('sv-gif-start').value));
    check(Math.abs(e - 3) <= 0.15 && s0 === 0.5, 'dragging the end handle from 6 s to the middle of the track sets the end to ' + e + ' s; the start stays at ' + s0 + ' s');
  }
  /* play the selection: the preview runs inside it and Pause stops it */
  await setVal(p, '#sv-gif-start', '1'); await setVal(p, '#sv-gif-end', '2');
  await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => /Play the selection/.test(b.textContent)).click());
  await sleep(1600);
  const pl = await p.evaluate(() => { const v = document.querySelector('.sv-stage video'); const b = [...document.querySelectorAll('.tool-io button')].find((x) => /Pause|Play the selection/.test(x.textContent)); return { t: v.currentTime, paused: v.paused, label: b.textContent }; });
  await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => /Pause/.test(b.textContent)).click());
  await sleep(200);
  const pl2 = await p.evaluate(() => ({ paused: document.querySelector('.sv-stage video').paused, label: [...document.querySelectorAll('.tool-io button')].find((x) => /Pause|Play the selection/.test(x.textContent)).textContent }));
  check(!pl.paused && pl.t >= 0.95 && pl.t <= 2.1 && /Pause/.test(pl.label) && pl2.paused && /Play the selection/.test(pl2.label), 'Play the selection loops inside 1–2 s (at ' + pl.t.toFixed(2) + ' s after 1.6 s) and Pause stops it');

  section('a GIF at 1×: frames, delays, loops, against the source');
  await setVal(p, '#sv-gif-start', '1'); await setVal(p, '#sv-gif-end', '3');
  await setVal(p, '#sv-gif-width', 480); await setVal(p, '#sv-gif-fps', 10); await setVal(p, '#sv-gif-speed', 1); await setVal(p, '#sv-gif-loop', '3'); await setVal(p, '#sv-gif-crop', 'original');
  const est1 = await estimate(p);
  await p.evaluate(() => { window.__long = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (e) { window.__long = null; } });
  const g1 = await makeGif(p);
  fs.writeFileSync(path.join(OUT, 'a-1x.gif'), g1.bytes);
  const longs = await p.evaluate(() => window.__long);
  const status1 = await p.$eval('.sv-status', (e) => e.textContent);
  check(g1.name === 'frames.gif' && g1.type === 'image/gif', 'saved as ' + g1.name + ' (' + g1.type + '), ' + g1.bytes.length + ' bytes');
  const P1 = parseGif(g1.bytes);
  check(P1.ok && P1.w === 480 && P1.h === 270 && P1.frames === 20, 'parsed here: GIF89a, 480 × 270, 20 frames, trailer at the end (' + JSON.stringify({ ok: P1.ok, w: P1.w, h: P1.h, frames: P1.frames, why: P1.why }) + ')');
  check(P1.delays.length === 20 && P1.delays.every((d) => d === 10) && P1.delays.reduce((a, b) => a + b, 0) === 200, 'every delay is 10 hundredths, 200 in all: 2.0 s');
  check(P1.loop === 2, '“Play 3 times” writes a NETSCAPE2.0 repeat count of 2 (' + P1.loop + ')');
  check(Math.abs(est1.bytes - g1.bytes.length) / g1.bytes.length <= 0.25, 'the estimate (' + est1.bytes + ' bytes) was within 25% of the file (' + g1.bytes.length + ' bytes): ' + ((est1.bytes / g1.bytes.length - 1) * 100).toFixed(1) + '%');
  check(/Done in [\d.]+ s: frames\.gif/.test(status1) && !/encoded on the page/.test(status1), 'encoded in the worker: ' + status1);
  check(longs !== null && Math.max(0, ...longs) < 200, 'no main-thread task over 200 ms while it ran (longest ' + Math.max(0, ...(longs || [0])) + ' ms, ' + (longs || []).length + ' over 50 ms)');
  const D1 = await decodeGif(p, g1.bytes, { bits: true, bitsY: 30, points: [[60, 200], [400, 200]] });
  check(D1.frameCount === 20 && D1.repetitionCount === 2, 'Chrome’s own decoder reads 20 frames and 2 repeats (' + D1.frameCount + ', ' + D1.repetitionCount + ')');
  const want1 = D1.frames.map((f, i) => Math.round((1 + i / 10) * 30));
  const got1 = D1.frames.map((f) => f.n);
  check(got1.every((n, i) => Math.abs(n - want1[i]) <= 1), 'frame i shows source frame 30 + 3i (1 s + i/10 s): ' + got1.join(','));
  const red = D1.frames.every((f) => f.points[0][0] > 170 && f.points[0][1] < 80 && f.points[0][2] < 80), blue = D1.frames.every((f) => f.points[1][2] > 90 && f.points[1][0] < 80);
  check(red && blue, 'colours survive 256 colours: red stays red, blue stays blue (' + JSON.stringify(D1.frames[0].points) + ')');

  section('2× speed, 15 fps, square crop, caption, loops');
  await setVal(p, '#sv-gif-speed', 2); await setVal(p, '#sv-gif-loop', '0');
  await estimate(p);
  const g2 = await makeGif(p);
  const P2 = parseGif(g2.bytes);
  const D2 = await decodeGif(p, g2.bytes, { bits: true, bitsY: 30 });
  const got2 = D2.frames.map((f) => f.n);
  check(P2.frames === 10 && got2.every((n, i) => Math.abs(n - (30 + 6 * i)) <= 1), 'at 2× the 2 s selection is 10 frames, frame i showing source frame 30 + 6i: ' + got2.join(','));
  check(P2.loop === 0 && D2.repetitionCount === 'Infinity', '“Loop for ever” writes a repeat count of 0, which Chrome reads as for ever (' + P2.loop + ', ' + D2.repetitionCount + ')');
  await setVal(p, '#sv-gif-speed', 1); await setVal(p, '#sv-gif-fps', 15); await setVal(p, '#sv-gif-loop', '1');
  await estimate(p);
  const g3 = await makeGif(p);
  const P3 = parseGif(g3.bytes);
  const D3 = await decodeGif(p, g3.bytes, {});
  check(P3.frames === 30 && P3.delays.every((d) => d === 6 || d === 7) && P3.delays.reduce((a, b) => a + b, 0) === 200, 'at 15 fps the delays are 7, 7, 6 … hundredths adding up to exactly 200 (' + P3.delays.slice(0, 6).join(',') + '…)');
  check(P3.loop === null && D3.repetitionCount === 0, '“Play once” writes no NETSCAPE2.0 block; Chrome reads 0 repeats (' + P3.loop + ', ' + D3.repetitionCount + ')');
  await setVal(p, '#sv-gif-fps', 10); await setVal(p, '#sv-gif-loop', '0');
  await setVal(p, '#sv-gif-crop', 'square'); await setVal(p, '#sv-gif-width', 320);
  await estimate(p);
  const g4 = await makeGif(p);
  const P4 = parseGif(g4.bytes);
  /* source crop: 360 × 360 from x = 140 (pos 50%); red ends at source x 213 → output x 65 */
  const D4 = await decodeGif(p, g4.bytes, { points: [[20, 200], [200, 200]] });
  check(P4.w === 320 && P4.h === 320 && D4.frames.every((f) => f.points[0][0] > 170 && f.points[1][2] > 90 && f.points[1][0] < 80), 'square at 320 px: 320 × 320, cut from the middle (red at x 20, blue at x 200)');
  await setVal(p, '#sv-gif-pos', 0); await estimate(p);
  const g4b = await makeGif(p);
  /* from x = 0: red ends at source x 213 → output x 189 */
  const D4b = await decodeGif(p, g4b.bytes, { points: [[20, 200], [150, 200], [230, 200]] });
  check(D4b.frames.every((f) => f.points[0][0] > 170 && f.points[1][0] > 170 && f.points[2][2] > 90 && f.points[2][0] < 80), 'crop position 0%: the left of the video, so red at x 20 and x 150, blue at x 230 (' + JSON.stringify(D4b.frames[0].points) + ')');
  await setVal(p, '#sv-gif-pos', 50);
  await setVal(p, '#sv-gif-crop', 'original'); await setVal(p, '#sv-gif-width', 480);
  const plainBand = (await decodeGif(p, g1.bytes, { band: [200, 270] })).frames[0].white;
  await setVal(p, '#sv-gif-caption', 'HELLO GIF'); await setVal(p, '#sv-gif-cappos', 'bottom');
  await estimate(p);
  const g5 = await makeGif(p);
  const D5 = await decodeGif(p, g5.bytes, { band: [200, 270] });
  check(D5.frames.every((f) => f.white > plainBand + 300), 'a caption puts white letters in the bottom band of every frame (' + plainBand + ' white pixels without, ' + D5.frames[0].white + ' with)');
  const capStored = await p.evaluate((k) => localStorage.getItem(k), KEY);
  check(capStored && !/HELLO|frames/.test(capStored) && /"width":480/.test(capStored) && /"v":1/.test(capStored), 'settings are kept under one versioned key without the caption or the file name: ' + capStored);
  await setVal(p, '#sv-gif-caption', '');

  section('sizes');
  await setVal(p, '#sv-gif-dither', false); await estimate(p);
  const g6 = await makeGif(p);
  check(g6.bytes.length < g1.bytes.length, 'dither off makes this flat test clip smaller: ' + g6.bytes.length + ' vs ' + g1.bytes.length + ' bytes with dither');
  await setVal(p, '#sv-gif-dither', true);
  await setVal(p, '#sv-gif-width', 240); await estimate(p);
  const g7 = await makeGif(p);
  const P7 = parseGif(g7.bytes);
  check(P7.w === 240 && P7.h === 135 && g7.bytes.length <= g1.bytes.length * 0.55, 'half the width (240 × 135): ' + g7.bytes.length + ' bytes, ' + (g7.bytes.length / g1.bytes.length * 100).toFixed(0) + '% of the 480 px file');
  await setVal(p, '#sv-gif-width', 480);

  section('the page-side fallback');
  await p.evaluate(() => { window.__svGifNoWorker = true; });
  await setVal(p, '#sv-gif-fps', 11); await estimate(p); await setVal(p, '#sv-gif-fps', 10); await estimate(p);
  const g8 = await makeGif(p);
  const st8 = await p.$eval('.sv-status', (e) => e.textContent);
  const P8 = parseGif(g8.bytes);
  check(/encoded on the page/.test(st8) && P8.ok && P8.frames === 20, 'with no worker the same GIF is made on the page and the status says so: ' + st8);
  check(Math.abs(g8.bytes.length - g1.bytes.length) <= 16, 'byte for byte the size of the worker’s GIF (' + g8.bytes.length + ' vs ' + g1.bytes.length + ')');
  await p.evaluate(() => { window.__svGifNoWorker = false; });

  section('cancel and the frame limit');
  await setVal(p, '#sv-gif-start', '0'); await setVal(p, '#sv-gif-end', '6'); await setVal(p, '#sv-gif-fps', 20); await setVal(p, '#sv-gif-speed', 0.5); await setVal(p, '#sv-gif-width', 640);
  await estimate(p);
  const nBefore = await p.evaluate(() => window.__downloads.length);
  await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => /^Make the GIF$/.test(b.textContent)).click());
  await p.waitForFunction(() => /^Frame (\d+) of 240/.test(document.querySelector('.sv-status').textContent) && Number(/^Frame (\d+)/.exec(document.querySelector('.sv-status').textContent)[1]) >= 20, { timeout: 120000 });
  const progVisible = await p.evaluate(() => !document.querySelector('.sv-job .aiimg-progress').hidden && document.querySelector('.sv-job .aiimg-progress').getAttribute('aria-valuenow'));
  await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => b.textContent === 'Cancel').click());
  await p.waitForFunction(() => /Cancelled/.test(document.querySelector('.sv-status').textContent), { timeout: 30000 });
  await sleep(800);
  const afterCancel = await p.evaluate(() => ({ n: window.__downloads.length, status: document.querySelector('.sv-status').textContent, btn: [...document.querySelectorAll('.tool-io button')].find((b) => /^Make the GIF$/.test(b.textContent)).disabled }));
  check(progVisible && afterCancel.n === nBefore && /^Cancelled\. Nothing was saved\./.test(afterCancel.status) && !afterCancel.btn, 'a 240-frame export shows progress (' + progVisible + '%), Cancel stops it, nothing is saved, and the button is ready again');
  await setVal(p, '#sv-gif-speed', 1); await setVal(p, '#sv-gif-fps', 10); await estimate(p);
  const g9 = await makeGif(p);
  check(parseGif(g9.bytes).frames === 60, 'after a cancel the next GIF is whole (60 frames)');
  await (await p.$('#sv-gif-file')).uploadFile(longVid);
  await p.waitForFunction(() => /^long\.mp4: 160 × 90/.test(document.querySelector('.sv-gif > .io-msg').textContent), { timeout: 30000 });
  await setVal(p, '#sv-gif-start', '0'); await setVal(p, '#sv-gif-end', '32'); await setVal(p, '#sv-gif-fps', 20);
  await sleep(300);
  const lim = await p.evaluate(() => ({ est: document.querySelector('.sv-est').textContent, dis: [...document.querySelectorAll('.tool-io button')].find((b) => /^Make the GIF$/.test(b.textContent)).disabled }));
  check(/^640 frames is over this tool’s 600-frame limit/.test(lim.est) && lim.dis, '32 s at 20 fps is refused before it starts: ' + lim.est.slice(0, 60));
  await setVal(p, '#sv-gif-end', '30'); await sleep(300);
  const ok600 = await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => /^Make the GIF$/.test(b.textContent)).disabled);
  check(!ok600, '30 s at 20 fps — 600 frames — is allowed');
  await p.close();

  section('settings remembered');
  const p2 = await open(URL_, { keep: true });
  const kept = await p2.evaluate(() => ({ w: document.getElementById('sv-gif-width').value, fps: document.getElementById('sv-gif-fps').value, crop: document.getElementById('sv-gif-crop').value, cap: document.getElementById('sv-gif-caption').value }));
  check(kept.w === '640' && kept.fps === '20' && kept.crop === 'original' && kept.cap === '', 'a new visit opens with the last width (640), fps (20) and crop, and no caption (' + JSON.stringify(kept) + ')');
  const kb = await p2.evaluate(async () => {
    const io = document.querySelector('.tool-io');
    const ctl = [...io.querySelectorAll('button, input, select, textarea, [role=button], [role=slider]')].filter((e) => e.type !== 'file');
    return { n: ctl.length, bad: ctl.filter((e) => e.tabIndex < 0).length, unl: ctl.filter((e) => /INPUT|SELECT|TEXTAREA/.test(e.tagName) && e.type !== 'checkbox' && !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map((e) => e.id) };
  });
  check(kb.n > 15 && !kb.bad && !kb.unl.length, 'all ' + kb.n + ' controls (the trim handles too) are reachable by Tab and labelled' + (kb.unl.length ? ': unlabelled ' + kb.unl.join(', ') : ''));
  await p2.close();

  section('layout');
  for (const [w, theme] of [[390, 'dark'], [1400, 'dark'], [390, 'light'], [1400, 'light']]) {
    const l = await open(URL_, { width: w, height: 900, theme });
    await l.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await (await l.$('#sv-gif-file')).uploadFile(vid);
    await l.waitForFunction(() => !document.querySelector('.sv-studio').hidden, { timeout: 30000 });
    await sleep(600);
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
  console.log('\nvideo-to-gif: ' + passes + ' passed, ' + fails.length + ' failed');
  fails.forEach((f) => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
})().catch(async (e) => { console.error(e); try { await browser.close(); } catch (x) { /* */ } if (server) server.close(); process.exit(2); });
