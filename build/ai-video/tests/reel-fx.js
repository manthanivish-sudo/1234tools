/*
 * The Reel Maker's editing tools (engine/aivid-reel-fx.js and the parts of
 * engine/aivid-reel-maker.js that use it), checked against independent
 * references:
 *
 *   A. in Node, on engine/aivid-reel-fx.js alone:
 *      1. the transitions and grades the page promises are there;
 *      2. beats found in synthetic click tracks (five tempos, two sample
 *         rates) and in drum patterns land within 30–35 ms of where the
 *         generator put them, at the generator's tempo (not half or double);
 *      3. snapToBeats on a hand-worked example; lengths stay in 1–15 s;
 *      4. each colour grade has the property its name promises (black and
 *         white is grey, warm is redder, faded lifts black …), measured on
 *         fixed colours;
 *      5. the destinations carry the published figures typed below.
 *   B. in headless Chrome against a local server:
 *      1. the new templates' plans (transition and animation per scene);
 *      2. slide, fade, dip and cut frames equal the outgoing and incoming
 *         frames put together by this test's own arithmetic; the whip pan is
 *         smoother horizontally than a slide at the same moment;
 *      3. the six new text animations, measured in pixels over time;
 *      4. grades on a picture (grey stays grey in black and white, warm is
 *         redder, a scene's own grade wins);
 *      5. a clip at 2× shows the frame from twice as far in, and the trim
 *         handles move the in point and the length as worked out by hand;
 *      6. beats in an uploaded drum track, shown on the timeline, and Cut to
 *         the beat puts every cut within 40 ms of a beat; Undo restores;
 *      7. the timeline: keys and drags change lengths and order;
 *      8. stickers: emoji from the vendored Noto subset, badges, dragging
 *         and resizing on the preview;
 *      9. destinations: size, safe area, frame rate; a 60 fps export has
 *         60 frames a second in its MP4 (read from the file's own boxes);
 *     10. one scene as a GIF: GIF89a, 540×960, looping, 15 frames a second;
 *     11. the draft keeps transitions, the grade, the destination and stickers;
 *     12. 390 px wide with the Effects pane open: no sideways scroll;
 *     13. nothing requested from anywhere but 127.0.0.1, no page error.
 *
 *   node build/ai-video/tests/reel-fx.js [--root <site>] [--port 8873] [--out <dir>] [--node-only]
 *
 * --root defaults to the site this file sits in. Exits non-zero on failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8873));
const ROOT = path.resolve(flag('root', path.join(__dirname, '..', '..', '..')));
const OUT = path.resolve(flag('out', path.join(os.tmpdir(), '1234tools-reel-fx')));
const NODE_ONLY = flag('node-only', false) === true;
const CHROME = process.env.CHROME || process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:' + PORT;
fs.mkdirSync(OUT, { recursive: true });

let passes = 0;
const fails = [];
const check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (ok) passes++; else fails.push(what); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* fixtures                                                           */
/* ------------------------------------------------------------------ */
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 - 0.5; }; }
/** A click track: a short low thump on every beat, over quiet noise. Returns { samples, beats }. */
function clickTrack(bpm, sr, secs, t0) {
  const s = new Float32Array(Math.round(sr * secs)), rnd = lcg(bpm * 7 + sr);
  for (let i = 0; i < s.length; i++) s[i] = rnd() * 0.02;
  const beats = [];
  for (let t = t0; t < secs - 0.1; t += 60 / bpm) {
    beats.push(t);
    const o = Math.round(t * sr);
    for (let k = 0; k < sr * 0.09 && o + k < s.length; k++) { const e = Math.exp(-k / (sr * 0.014)); s[o + k] += e * (Math.sin(2 * Math.PI * 60 * k / sr) * 0.8 + rnd() * 0.6); }
  }
  return { samples: s, beats };
}
/** A drum pattern: kick on beats 1 and 3, snare on 2 and 4, closed hi-hat on every eighth, and a held bass note. */
function drumTrack(bpm, sr, secs, t0) {
  const s = new Float32Array(Math.round(sr * secs)), rnd = lcg(bpm * 13 + sr);
  const beat = 60 / bpm, beats = [];
  for (let i = 0; i < s.length; i++) s[i] = 0.12 * Math.sin(2 * Math.PI * 55 * i / sr) + rnd() * 0.01;
  const hit = (t, fn, len) => { const o = Math.round(t * sr); for (let k = 0; k < len * sr && o + k < s.length; k++) s[o + k] += fn(k / sr); };
  for (let n = 0, t = t0; t < secs - 0.2; n++, t += beat) {
    beats.push(t);
    if (n % 2 === 0) hit(t, (x) => Math.exp(-x / 0.05) * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-x / 0.02)) * x) * 0.9, 0.25);
    else hit(t, (x) => Math.exp(-x / 0.04) * (rnd() * 1.2 + 0.4 * Math.sin(2 * Math.PI * 190 * x)), 0.2);
    for (const off of [0, beat / 2]) hit(t + off, (x) => Math.exp(-x / 0.008) * rnd() * 0.35, 0.05);
  }
  return { samples: s, beats };
}
function writeWav(file, samples, sr) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}
const nearest = (list, x) => list.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), Infinity);
/* the transitions' easing, written out here from its definition (cubic in-out) rather than taken from the engine */
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** MP4: the first video track's sample count and its media duration in seconds, read from stsz and mdhd. */
function mp4Video(buf) {
  const u32 = (o) => buf.readUInt32BE(o);
  const boxes = (start, end, out) => {
    let o = start;
    while (o + 8 <= end) {
      let size = u32(o); const type = buf.toString('latin1', o + 4, o + 8);
      let head = 8;
      if (size === 1) { size = Number(buf.readBigUInt64BE(o + 8)); head = 16; }
      if (size < 8) break;
      out.push({ type, o, size, head });
      if (/^(moov|trak|mdia|minf|stbl)$/.test(type)) boxes(o + head, o + size, out);
      o += size;
    }
    return out;
  };
  const all = boxes(0, buf.length, []);
  const traks = all.filter((b) => b.type === 'trak');
  for (const t of traks) {
    const inside = all.filter((b) => b.o > t.o && b.o < t.o + t.size);
    const hdlr = inside.find((b) => b.type === 'hdlr');
    if (!hdlr || buf.toString('latin1', hdlr.o + 16, hdlr.o + 20) !== 'vide') continue;
    const mdhd = inside.find((b) => b.type === 'mdhd');
    const v = buf[mdhd.o + 8];
    const ts = v === 1 ? u32(mdhd.o + 28) : u32(mdhd.o + 20);
    const dur = v === 1 ? Number(buf.readBigUInt64BE(mdhd.o + 32)) : u32(mdhd.o + 24);
    const stsz = inside.find((b) => b.type === 'stsz');
    return { samples: u32(stsz.o + 16), seconds: dur / ts };
  }
  return null;
}
/** GIF: size, whether it loops, and how many frames it has (image descriptors), walking the blocks. */
function gifInfo(b) {
  const out = { sig: b.toString('latin1', 0, 6), w: b.readUInt16LE(6), h: b.readUInt16LE(8), loop: b.indexOf('NETSCAPE2.0') > 0, frames: 0, delays: [] };
  let o = 13;
  if (b[10] & 0x80) o += 3 * (1 << ((b[10] & 7) + 1));
  const skipSub = () => { while (o < b.length && b[o] !== 0) o += b[o] + 1; o++; };
  while (o < b.length) {
    const k = b[o];
    if (k === 0x3b) break;
    if (k === 0x21) { const label = b[o + 1]; if (label === 0xf9) out.delays.push(b.readUInt16LE(o + 4)); o += 2; skipSub(); }
    else if (k === 0x2c) {
      out.frames++;
      const flags = b[o + 9]; o += 10;
      if (flags & 0x80) o += 3 * (1 << ((flags & 7) + 1));
      o++; skipSub();
    } else break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* A. Node                                                            */
/* ------------------------------------------------------------------ */
function nodePart() {
  console.log('\nA. engine/aivid-reel-fx.js in Node');
  const FX = require(path.join(ROOT, 'engine', 'aivid-reel-fx.js'));
  const ids = FX.TRANSITIONS.map((t) => t[0]);
  const want = ['cut', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out', 'whip', 'dip-black', 'dip-white'];
  check(want.every((k) => ids.indexOf(k) >= 0) && ids.indexOf('auto') >= 0, 'transitions: auto plus ' + want.length + ' kinds (' + ids.join(', ') + ')');
  const gids = FX.GRADES.map((g) => g[0]);
  const gwant = ['warm', 'cool', 'vintage', 'bw', 'contrast', 'faded', 'tealorange', 'vivid'];
  check(gwant.every((k) => gids.indexOf(k) >= 0), 'grades: ' + gwant.length + ' presets plus none (' + gids.join(', ') + ')');

  /* beats */
  for (const [bpm, sr, t0] of [[70, 44100, 0.31], [90, 48000, 0.2], [124, 44100, 0.37], [150, 44100, 0.11], [175, 48000, 0.25]]) {
    const tr = clickTrack(bpm, sr, 12, t0);
    const r = FX.detectBeats(tr.samples, sr);
    const far = r.beats.map((b) => Math.abs(nearest(tr.beats, b) - b));
    const missed = tr.beats.filter((t) => Math.abs(nearest(r.beats, t) - t) > 0.03).length;
    check(Math.abs(r.bpm - bpm) / bpm < 0.01 && missed === 0 && Math.max(...far) <= 0.03,
      'click track at ' + bpm + ' BPM, ' + sr + ' Hz: ' + r.bpm.toFixed(2) + ' BPM, ' + r.beats.length + '/' + tr.beats.length + ' beats, worst ' + (Math.max(...far) * 1000).toFixed(1) + ' ms off, ' + missed + ' missed');
  }
  for (const [bpm, sr] of [[100, 44100], [128, 48000]]) {
    const tr = drumTrack(bpm, sr, 16, 0.4);
    const r = FX.detectBeats(tr.samples, sr);
    const hit = tr.beats.filter((t) => Math.abs(nearest(r.beats, t) - t) <= 0.035).length;
    check(Math.abs(r.bpm - bpm) / bpm < 0.02 && hit / tr.beats.length >= 0.9,
      'drum pattern at ' + bpm + ' BPM (kick, snare, eighth hats, bass): ' + r.bpm.toFixed(2) + ' BPM, ' + hit + '/' + tr.beats.length + ' beats within 35 ms');
  }
  const quiet = FX.detectBeats(new Float32Array(44100 * 3), 44100);
  check(Array.isArray(quiet.beats) && quiet.beats.length === 0, 'silence: no beats, no error');

  /* snap: beats every 0.5 s; cuts at 2.3, 5.4, 7.1, 9.6 → 2.5, 5.5, 7.0, 9.5 (worked by hand) */
  const grid = []; for (let t = 0.5; t < 20; t += 0.5) grid.push(Math.round(t * 10) / 10);
  const snapped = FX.snapToBeats([2.3, 3.1, 1.7, 2.5], grid);
  check(JSON.stringify(snapped) === JSON.stringify([2.5, 3, 1.5, 2.5]), 'snapToBeats([2.3, 3.1, 1.7, 2.5], every 0.5 s) = [2.5, 3, 1.5, 2.5]: ' + JSON.stringify(snapped));
  const dense = []; for (let t = 0.3; t < 40; t += 0.3) dense.push(t);
  const s2 = FX.snapToBeats([1, 1.1, 0.9, 16, 2], dense, { min: 1, max: 15 });
  check(s2.every((x) => x >= 0.999 && x <= 15.001), 'snapped lengths stay within 1–15 s: ' + JSON.stringify(s2));
  check(JSON.stringify(FX.snapToBeats([2, 3], [])) === '[2,3]', 'with no beats the lengths are unchanged');

  /* grades, on fixed colours */
  const px = (rgb) => new Uint8ClampedArray([rgb[0], rgb[1], rgb[2], 255]);
  const g = (id, rgb) => Array.from(FX.gradePixels(px(rgb), id).slice(0, 3));
  const sat = (c) => Math.max(...c) - Math.min(...c);
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const grey = [128, 128, 128], orange = [220, 120, 40], dark = [30, 30, 30], light = [220, 220, 220], black = [0, 0, 0];
  const bw = g('bw', orange);
  check(bw[0] === bw[1] && bw[1] === bw[2], 'black and white: orange becomes grey ' + JSON.stringify(bw));
  const w = g('warm', grey), c = g('cool', grey);
  check(w[0] - w[2] >= 15 && c[2] - c[0] >= 15, 'warm makes grey redder (' + w + '), cool makes it bluer (' + c + ')');
  const hd = g('contrast', dark), hl = g('contrast', light);
  check(lum(hd) < 30 && lum(hl) > 220, 'high contrast: dark darker (' + hd + '), light lighter (' + hl + ')');
  const fb = g('faded', black);
  check(lum(fb) >= 25 && sat(g('faded', orange)) < sat(orange), 'faded lifts black to ' + fb + ' and mutes colour');
  check(sat(g('vivid', orange)) > sat(orange) + 10, 'vivid: more saturated ' + JSON.stringify(g('vivid', orange)));
  const vb = g('vintage', black), vo = g('vintage', orange);
  check(lum(vb) >= 15 && sat(vo) < sat(orange), 'vintage lifts black (' + vb + ') and mutes colour (' + vo + ')');
  const ts = g('tealorange', [40, 40, 40]), th = g('tealorange', [210, 210, 210]);
  check(ts[2] > ts[0] && th[0] > th[2], 'teal and orange: shadows lean blue (' + ts + '), highlights lean orange (' + th + ')');
  check(JSON.stringify(g('none', orange)) === JSON.stringify(orange), 'none leaves a colour alone');
  const sig = gwant.map((k) => g(k, orange).join(',') + '|' + g(k, grey).join(','));
  check(new Set(sig).size === gwant.length, 'the eight grades all differ');

  /* destinations, against the published figures */
  const D = (id) => FX.DESTINATIONS.find((d) => d.id === id);
  const meta = (d) => d && d.safe && d.safe.top === 0.14 && d.safe.bottom === 0.35 && d.safe.side === 0.06;
  check(['reels', 'tiktok', 'shorts', 'stories', 'linkedin', 'x'].every((k) => D(k) && D(k).source), 'six destinations, each with a source');
  check(meta(D('reels')) && meta(D('stories')), 'Reels and Stories keep 14% top, 35% bottom, 6% sides clear (Meta’s ad guides)');
  check(D('shorts').rates[30] === 8e6 && D('shorts').rates[60] === 12e6 && D('shorts').size === '1080x1920', 'Shorts: 1080×1920, 8 Mbps at 30 fps, 12 Mbps at 60 (YouTube’s recommended upload settings)');
  check(D('x').size === '1280x720' && D('x').rates[30] >= 5e6 && D('x').rates[60] >= 5e6, 'X: 1280×720 at 5 Mbps or more (X’s media best practices)');
  check(JSON.stringify(D('linkedin').fps) === '[30]', 'LinkedIn: no 60 fps option (its specification caps the frame rate at 30)');
  return FX;
}

/* ------------------------------------------------------------------ */
/* B. Chrome                                                          */
/* ------------------------------------------------------------------ */
async function browserPart() {
  console.log('\nB. /ai-video/reel-maker/ in Chrome');
  let puppeteer;
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) { try { puppeteer = require(p); break; } catch (e) { /* next */ } }
  const { serve } = require(path.join(ROOT, 'build', 'tests', 'serve.js'));
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=WebGPU'], protocolTimeout: 900000 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  const errors = [], net = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.log('  [pageerror]', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('  [console]', m.text().slice(0, 200)); } });
  page.on('request', (r) => { const u = r.url(); if (!/^(https?:\/\/127\.0\.0\.1[:/]|blob:|data:)/.test(u)) net.push(u.slice(0, 120)); });
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const goto = async () => { await page.goto(BASE + '/ai-video/reel-maker/', { waitUntil: 'networkidle0', timeout: 120000 }); await page.evaluate(() => { const c = document.querySelector('.cc'); if (c) c.remove(); }); };
  const clickText = (scope, re) => page.evaluate((scope, src) => { const re = new RegExp(src); for (const b of document.querySelectorAll(scope + ' button')) if (re.test(b.textContent.trim()) && !b.disabled && b.offsetParent !== null) { b.click(); return true; } return false; }, scope, re.source);
  const pane = async (k) => { await page.evaluate((k) => { const b = document.querySelector('.aiimg-side .aiimg-tabs [data-pane=' + k + ']'); b.scrollIntoView({ block: 'center' }); b.click(); }, k); await sleep(200); };
  const makeFrom = async (tpl, script) => {
    await page.evaluate(() => { const d = document.getElementById('reel-draft-fresh'); if (d) d.click(); });
    if (tpl) await page.select('#reel-template', tpl);
    if (script) await page.evaluate((s) => { const b = document.getElementById('reel-script'); b.value = s; }, script);
    await clickText('.reel-start', /^Make my reel$/);
    await page.waitForFunction(() => { const s = document.querySelector('.aiimg-studio'); return s && !s.hidden; }, { timeout: 30000 });
    await page.evaluate(async () => { await AIImg.tools['reel-maker'].current.prepare(); });
  };
  const startOver = async () => { await clickText('.aiimg-transport', /^Start over$/); await sleep(150); };

  try {
    await goto();
    check(await page.$('.aiimg-tabs [data-pane=fx]') !== null, 'the studio has an Effects pane');

    /* ---- 1. the new templates' plans ---- */
    await makeFrom('hottake');
    const plan = await page.evaluate(() => {
      const S = AIImg.tools['reel-maker'].state();
      return { types: S.scenes.map((s) => s.type), trans: S.scenes.map((s) => s.tplTrans || ''), anim: S.scenes.map((s) => s.anim || ''),
        selects: document.querySelectorAll('select.reel-trans').length, label: (document.querySelector('select.reel-trans') || { options: [{}] }).options[0].textContent };
    });
    check(plan.trans[1] === 'cut' && plan.trans[2] === 'whip' && plan.anim[0] === 'glitch' && plan.anim[1] === 'words',
      'Hot take arrives cut, then whip; its hook glitches and "Hear me out." comes word by word (' + plan.trans.join(',') + ' / ' + plan.anim.join(',') + ')');
    check(plan.selects === plan.types.length - 1 && /^Auto \(cut\)$/.test(plan.label), 'a transition select on every scene after the first; Auto names the template’s choice ("' + plan.label + '")');
    await startOver();

    /* ---- 2. transitions against frames put together here ---- */
    await makeFrom('', 'First scene words here\nSecond scene other words');
    const tr = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      S.brand.progress = false; S.brand.madeWith = false;
      const W = 360, H = 640;
      const s1 = S.scenes[0].seconds;
      const grab = (fn) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); fn(x, c); return x.getImageData(0, 0, W, H).data; };
      const frameAt = (kind, local) => { S.scenes[1].trans = kind; return grab((x) => { x.scale(W / 1080, H / 1920); T.renderFrame(x, 1080, 1920, s1 + local, S); }); };
      /* the two halves: the outgoing scene at its last instant, the incoming scene at `local` with no transition */
      const A = (local) => { S.scenes[1].trans = 'cut'; return grab((x) => { x.scale(W / 1080, H / 1920); T.renderFrame(x, 1080, 1920, s1 - 0.0005, S); }); };
      const B = (local) => { S.scenes[1].trans = 'cut'; return grab((x) => { x.scale(W / 1080, H / 1920); T.renderFrame(x, 1080, 1920, s1 + local, S); }); };
      const durs = { 'slide-left': 0.4, 'slide-up': 0.4, fade: 0.35, 'dip-black': 0.6, 'dip-white': 0.6, whip: 0.32 };
      const out = {};
      const band = [Math.round(H * 0.3), Math.round(H * 0.62)];
      const mae = (got, exp) => { let s = 0, n = 0; for (let y = band[0]; y < band[1]; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; s += Math.abs(got[i] - exp[i]) + Math.abs(got[i + 1] - exp[i + 1]) + Math.abs(got[i + 2] - exp[i + 2]); n += 3; } return s / n; };
      const at = (d, x, y) => { x = Math.round(x); if (x < 0 || x >= W) return null; const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
      for (const kind of Object.keys(durs)) {
        const p = 0.5, local = durs[kind] * p;
        out[kind] = { got: frameAt(kind, local), A: A(), B: B(local), p };
      }
      out.cutGot = frameAt('cut', 0.01); out.cutB = B(0.01);
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const res = {};
      /* slide left: A moves left by W·e, B comes in from the right */
      { const o = out['slide-left'], e = ease(o.p); const exp = new Uint8ClampedArray(o.got.length);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const src = x + W * e < W ? at(o.A, x + W * e, y) : at(o.B, x - W * (1 - e), y); const i = (y * W + x) * 4; if (src) { exp[i] = src[0]; exp[i + 1] = src[1]; exp[i + 2] = src[2]; } }
        res.slideLeft = mae(o.got, exp); }
      { const o = out['slide-up'], e = ease(o.p); const exp = new Uint8ClampedArray(o.got.length);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ya = Math.round(y + H * e), yb = Math.round(y - H * (1 - e)); const src = ya < H ? at(o.A, x, ya) : at(o.B, x, yb); const i = (y * W + x) * 4; if (src) { exp[i] = src[0]; exp[i + 1] = src[1]; exp[i + 2] = src[2]; } }
        res.slideUp = mae(o.got, exp); }
      { const o = out.fade, e = ease(o.p); const exp = new Uint8ClampedArray(o.got.length);
        for (let i = 0; i < exp.length; i++) exp[i] = o.A[i] * (1 - e) + o.B[i] * e;
        res.fade = mae(o.got, exp); }
      const meanL = (d) => { let s = 0; for (let y = band[0]; y < band[1]; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; s += (d[i] + d[i + 1] + d[i + 2]) / 3; } return s / ((band[1] - band[0]) * W); };
      res.dipBlack = meanL(out['dip-black'].got); res.dipWhite = meanL(out['dip-white'].got);
      res.cut = mae(out.cutGot, out.cutB);
      /* horizontal detail: the whip's smear leaves less of it than a slide at the same moment */
      const hdetail = (d) => { let s = 0; for (let y = band[0]; y < band[1]; y++) for (let x = 1; x < W; x++) { const i = (y * W + x) * 4; s += Math.abs(d[i] - d[i - 4]) + Math.abs(d[i + 1] - d[i - 3]); } return s; };
      res.whip = hdetail(out.whip.got); res.slideRef = hdetail(out['slide-left'].got);
      S.scenes[1].trans = 'auto';
      return res;
    });
    check(tr.slideLeft < 6, 'slide left at the midpoint matches the two frames shifted by this test (mean error ' + tr.slideLeft.toFixed(2) + ' of 255)');
    check(tr.slideUp < 6, 'slide up at the midpoint matches (mean error ' + tr.slideUp.toFixed(2) + ')');
    check(tr.fade < 3, 'crossfade at the midpoint is the eased mix of the two frames (mean error ' + tr.fade.toFixed(2) + ')');
    check(tr.dipBlack < 4 && tr.dipWhite > 250, 'dip to black is black and dip to white is white at their midpoints (' + tr.dipBlack.toFixed(1) + ', ' + tr.dipWhite.toFixed(1) + ')');
    check(tr.cut < 0.5, 'a cut shows the incoming scene at once (mean error ' + tr.cut.toFixed(2) + ')');
    check(tr.whip < tr.slideRef * 0.8, 'the whip pan is smeared sideways: ' + Math.round(tr.whip) + ' horizontal detail against ' + Math.round(tr.slideRef) + ' for a slide');

    /* ---- 3. the six new text animations ---- */
    const an = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const sc = S.scenes[0]; sc.seconds = 3; sc.trans = 'cut';
      T.current.setLook({ palette: 'midnight', type: 'gradient', motion: 'pop', bg: 'glow', layout: 'classic' }); await T.current.prepare();
      const W = 540, H = 960;
      const grab = (t) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.scale(W / 1080, H / 1920); T.renderFrame(x, 1080, 1920, t, S); return x.getImageData(0, 0, W, H).data; };
      const bg = (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.scale(W / 1080, H / 1920); T.background(x, 1080, 1920, 0.5, S); return x.getImageData(0, 0, W, H).data; })();
      const L = S.look;
      const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const near = (d, i, c, tol) => Math.abs(d[i] - c[0]) < tol && Math.abs(d[i + 1] - c[1]) < tol && Math.abs(d[i + 2] - c[2]) < tol;
      const y0 = Math.round(H * 0.2), y1 = Math.round(H * 0.7);
      const stat = (d) => {
        let ink = 0, acc = 0, chip = 0, mag = 0, sy = 0;
        const A = hex(L.accentInk), C = hex(L.chip[1]);
        for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const diff = Math.abs(d[i] - bg[i]) + Math.abs(d[i + 1] - bg[i + 1]) + Math.abs(d[i + 2] - bg[i + 2]);
          if (diff > 90) { ink++; sy += y; }
          if (near(d, i, A, 30)) acc++;
          if (near(d, i, C, 30)) chip++;
          if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] > 70 && d[i + 2] < 160) mag++;
        }
        return { ink, acc, chip, mag, cy: ink ? sy / ink : 0 };
      };
      const out = {};
      T.clearOverflow();
      for (const a of ['words', 'bounce', 'sweep', 'glitch', 'scale', 'karaoke']) {
        sc.anim = a; sc._plan = null;
        out[a] = { early: stat(grab(0.3)), mid: stat(grab(0.85)), late: stat(grab(2.9)) };
      }
      out.over = T.overflow();
      return out;
    });
    check(an.words.early.ink < an.words.late.ink * 0.6 && an.words.mid.ink <= an.words.late.ink * 1.02, 'word by word: ' + an.words.early.ink + ' → ' + an.words.mid.ink + ' → ' + an.words.late.ink + ' text pixels as the words arrive');
    check(an.scale.early.ink < an.scale.late.ink * 0.6, 'scale punch per word: ' + an.scale.early.ink + ' → ' + an.scale.late.ink + ' text pixels');
    check(an.karaoke.early.acc < an.karaoke.late.acc * 0.3 && an.karaoke.late.acc > 500, 'karaoke fill: accent pixels ' + an.karaoke.early.acc + ' → ' + an.karaoke.mid.acc + ' → ' + an.karaoke.late.acc);
    check(an.sweep.early.chip < an.sweep.late.chip * 0.3 && an.sweep.late.chip > 2000, 'highlight sweep: band pixels ' + an.sweep.early.chip + ' → ' + an.sweep.late.chip);
    check(an.glitch.early.mag > 50 && an.glitch.mid.mag < 10, 'glitch: magenta split ' + an.glitch.early.mag + ' px while glitching, ' + an.glitch.mid.mag + ' between blips');
    check(an.bounce.early.cy < an.bounce.late.cy - 3 && an.bounce.late.ink > 1000, 'line bounce: the text drops into place (centre ' + an.bounce.early.cy.toFixed(0) + ' → ' + an.bounce.late.cy.toFixed(0) + ' px)');
    check(an.over.length === 0, 'none of the six overflows its box' + (an.over.length ? ': ' + an.over.join(' | ') : ''));
    await startOver();

    /* ---- 4. grades on a picture; 5. speed and trim on a clip ---- */
    const fixtures = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 400; const x = c.getContext('2d');
      x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, 200, 400); x.fillStyle = 'rgb(220,120,40)'; x.fillRect(200, 0, 200, 400);
      const png = c.toDataURL('image/png');
      /* a 3 s clip whose colour says the time: hue = 120° × t */
      const v = document.createElement('canvas'); v.width = 320; v.height = 320; const vx = v.getContext('2d');
      const stream = v.captureStream(30);
      const mime = ['video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4e6 });
      const chunks = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise((r) => { rec.onstop = r; });
      rec.start(100);
      const t0 = performance.now();
      while (performance.now() - t0 < 3100) { const t = (performance.now() - t0) / 1000; vx.fillStyle = 'hsl(' + (120 * t) + ',90%,50%)'; vx.fillRect(0, 0, 320, 320); await new Promise((r) => requestAnimationFrame(r)); }
      rec.stop(); await done;
      const b = new Blob(chunks, { type: 'video/webm' });
      const buf = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { png, webm: btoa(bin) };
    });
    const pngFile = path.join(OUT, 'grade-test.png'), clipFile = path.join(OUT, 'hue-clock.webm');
    fs.writeFileSync(pngFile, Buffer.from(fixtures.png.split(',')[1], 'base64'));
    fs.writeFileSync(clipFile, Buffer.from(fixtures.webm, 'base64'));
    await makeFrom('', 'Pictures next');
    await pane('media');
    const mediaIn = await page.$('#reel-media-file');
    await mediaIn.uploadFile(pngFile);
    await page.waitForFunction(() => AIImg.tools['reel-maker'].state().scenes.some((s) => s.type === 'media' && s.media), { timeout: 30000 });
    const gr = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const i = S.scenes.findIndex((s) => s.type === 'media'); const sc = S.scenes[i]; sc.fit = 'cover'; sc.motion = false; sc.trans = 'cut';
      let st = 0; for (let k = 0; k < i; k++) st += S.scenes[k].seconds;
      const sample = () => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d'); T.renderFrame(x, 1080, 1920, st + 1, S); const g = x.getImageData(200, 900, 1, 1).data, o = x.getImageData(880, 900, 1, 1).data; return { g: [g[0], g[1], g[2]], o: [o[0], o[1], o[2]] }; };
      const out = {};
      for (const k of ['none', 'bw', 'warm', 'cool']) { S.grade = k; out[k] = sample(); }
      S.grade = 'bw'; sc.grade = 'vivid'; out.own = sample(); sc.grade = 'reel'; S.grade = 'none';
      return out;
    });
    const satOf = (c) => Math.max(...c) - Math.min(...c);
    check(Math.abs(gr.none.g[0] - gr.none.g[2]) <= 3, 'no grade: the grey half stays grey ' + JSON.stringify(gr.none.g));
    check(satOf(gr.bw.o) <= 2 && satOf(gr.bw.g) <= 2, 'black and white on the picture: both halves grey ' + JSON.stringify(gr.bw));
    check(gr.warm.g[0] - gr.warm.g[2] >= 12 && gr.cool.g[2] - gr.cool.g[0] >= 12, 'warm reddens the grey (' + gr.warm.g + '), cool blues it (' + gr.cool.g + ')');
    check(satOf(gr.own.o) > satOf(gr.none.o), 'a scene’s own grade (vivid) wins over the reel’s (black and white): ' + JSON.stringify(gr.own.o));

    await mediaIn.uploadFile(clipFile);
    await page.waitForFunction(() => AIImg.tools['reel-maker'].state().scenes.some((s) => s.type === 'media' && s.media && s.media.kind === 'video'), { timeout: 30000 });
    await sleep(500);
    const clip = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const S = T.state();
      const i = S.scenes.findIndex((s) => s.media && s.media.kind === 'video'); const sc = S.scenes[i];
      sc.fit = 'cover'; sc.motion = false; sc.trans = 'cut'; sc.start = 0; sc.seconds = 1.2; sc.speed = 2;
      let st = 0; for (let k = 0; k < i; k++) st += S.scenes[k].seconds;
      /* the frame the export draws at 0.5 s into the scene: from the clip at 2 × 0.5 = 1.0 s, hue 120° */
      const v = sc.media.video;
      /* park the preview on the same moment, so its own seeking agrees, then let the clip settle */
      S.t = st + 0.5; T.current.invalidate();
      const t1 = performance.now();
      while (performance.now() - t1 < 6000 && (v.seeking || Math.abs(v.currentTime - 1.0) > 0.04 || v.readyState < 2)) await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 200));
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d'); T.renderFrame(x, 1080, 1920, st + 0.5, S);
      const p = x.getImageData(540, 900, 1, 1).data;
      return { i, at: v.currentTime, rgb: [p[0], p[1], p[2]], dur: sc.media.duration };
    });
    const hue = (([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; })(clip.rgb);
    check(Math.abs(clip.at - 1.0) < 0.06 && Math.abs(hue - 120) < 18, 'at 2× the clip is read 1.0 s in at 0.5 s into the scene (video at ' + clip.at.toFixed(2) + ' s, hue ' + hue.toFixed(0) + '°, 120° expected)');
    /* trim: the in point by keyboard; at 2× the scene loses 0.05 s for every 0.1 s the in point moves */
    await page.evaluate((i) => AIImg.tools['reel-maker'].state().scenes[i] && (AIImg.tools['reel-maker'].state().live = -9), clip.i);
    await page.evaluate(async (i) => { const T = AIImg.tools['reel-maker']; const S = T.state(); let st = 0; for (let k = 0; k < i; k++) st += S.scenes[k].seconds; document.querySelector('.reel-tl-block[data-i="' + i + '"]').click(); }, clip.i);
    await sleep(400);
    const trimShown = await page.evaluate(() => !document.getElementById('reel-trim').hidden && !!document.getElementById('reel-trim-in'));
    check(trimShown, 'selecting the clip shows the trimmer with in and out handles');
    const before = await page.evaluate((i) => { const sc = AIImg.tools['reel-maker'].state().scenes[i]; return { start: sc.start, seconds: sc.seconds }; }, clip.i);
    await page.focus('#reel-trim-in'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    const after = await page.evaluate((i) => { const sc = AIImg.tools['reel-maker'].state().scenes[i]; return { start: sc.start, seconds: sc.seconds }; }, clip.i);
    check(Math.abs(after.start - (before.start + 0.2)) < 0.011 && Math.abs(after.seconds - (before.seconds - 0.1)) < 0.011, 'two presses on the in handle: in ' + before.start + ' → ' + after.start + ' s, length ' + before.seconds + ' → ' + after.seconds + ' s');
    await page.focus('#reel-trim-out'); await page.keyboard.press('ArrowLeft');
    const after2 = await page.evaluate((i) => { const sc = AIImg.tools['reel-maker'].state().scenes[i]; return { start: sc.start, seconds: sc.seconds }; }, clip.i);
    check(Math.abs(after2.start - after.start) < 0.001 && Math.abs(after2.seconds - (after.seconds - 0.05)) < 0.011, 'one press back on the out handle: in stays, length ' + after.seconds + ' → ' + after2.seconds + ' s');
    await startOver();

    /* ---- 6. beats, the timeline and Cut to the beat ---- */
    const BPM = 120, OFF = 0.25;
    const drum = drumTrack(BPM, 44100, 30, OFF);
    const wavFile = path.join(OUT, 'drums-120.wav');
    writeWav(wavFile, drum.samples, 44100);
    await makeFrom('', 'One\nTwo words here\nThree\nFour words now\nFive');
    await page.evaluate(() => { const S = AIImg.tools['reel-maker'].state(); const sec = [2.3, 1.7, 2.9, 2.2, 1.6]; S.scenes.forEach((s, i) => { if (sec[i]) { s.seconds = sec[i]; s.base = sec[i]; } }); AIImg.tools['reel-maker'].current.renderTimeline(); });
    await pane('sound');
    const musicIn = await page.$('#reel-music-file');
    await musicIn.uploadFile(wavFile);
    await page.waitForFunction(() => /beats a minute|No steady beat|could not/.test(document.getElementById('reel-beat-status').textContent), { timeout: 60000 });
    const bs = await page.evaluate(() => ({ text: document.getElementById('reel-beat-status').textContent, marks: document.querySelectorAll('.reel-tl-beat').length, beats: AIImg.tools['reel-maker'].current.reelBeats(), D: AIImg.tools['reel-maker'].state().scenes.reduce((s, x) => s + (x._skip ? 0 : x.seconds), 0), btn: !document.getElementById('reel-beat-cut').disabled }));
    const shownBpm = Number((/About (\d+) beats a minute/.exec(bs.text) || [])[1]);
    const trueIn = drum.beats.filter((b) => b <= bs.D).length;
    check(Math.abs(shownBpm - BPM) <= 1, 'the Sound pane reports about ' + shownBpm + ' beats a minute (the track is ' + BPM + ')');
    check(Math.abs(bs.marks - trueIn) <= 1 && bs.btn, bs.marks + ' beat marks on the timeline for the ' + trueIn + ' beats in the reel’s ' + bs.D.toFixed(1) + ' s; Cut to the beat is on');
    const beforeLens = await page.evaluate(() => AIImg.tools['reel-maker'].state().scenes.map((s) => s.seconds));
    await page.click('#reel-beat-cut');
    await sleep(300);
    const cut = await page.evaluate(() => { const S = AIImg.tools['reel-maker'].state(); return S.scenes.filter((s) => !s._skip).map((s) => s.seconds); });
    let acc = 0; const offs = cut.map((s) => { acc += s; return Math.abs(nearest(drum.beats, acc) - acc); });
    check(offs.every((o) => o <= 0.04) && cut.every((s) => s >= 1 && s <= 15), 'after Cut to the beat every cut is within 40 ms of a beat of the track (worst ' + (Math.max(...offs) * 1000).toFixed(0) + ' ms): ' + cut.join(', '));
    await page.click('#reel-beat-undo');
    const undone = await page.evaluate(() => AIImg.tools['reel-maker'].state().scenes.map((s) => s.seconds));
    check(JSON.stringify(undone) === JSON.stringify(beforeLens), 'Undo puts the lengths back exactly');

    /* ---- 7. the timeline ---- */
    const tl0 = await page.evaluate(() => ({ blocks: document.querySelectorAll('.reel-tl-block').length, n: AIImg.tools['reel-maker'].state().scenes.filter((s) => !s._skip).length, ids: AIImg.tools['reel-maker'].state().scenes.map((s) => s.id), s0: AIImg.tools['reel-maker'].state().scenes[0].seconds }));
    check(tl0.blocks === tl0.n, 'one timeline block per scene (' + tl0.blocks + ')');
    await page.focus('.reel-tl-block[data-i="0"] .reel-tl-edge'); await page.keyboard.press('ArrowRight'); await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
    const s0b = await page.evaluate(() => AIImg.tools['reel-maker'].state().scenes[0].seconds);
    check(Math.abs(s0b - (tl0.s0 + 0.6)) < 0.011, 'the length handle takes the arrow keys: ' + tl0.s0 + ' + 0.1 + 0.5 = ' + s0b + ' s');
    await page.focus('.reel-tl-block[data-i="0"]'); await page.keyboard.down('Alt'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Alt');
    const ids1 = await page.evaluate(() => AIImg.tools['reel-maker'].state().scenes.map((s) => s.id));
    check(ids1[1] === tl0.ids[0] && ids1[0] === tl0.ids[1], 'Alt + Right moves the first scene one place later');
    const geo = await page.evaluate(() => { const tr = document.getElementById('reel-tl-track').getBoundingClientRect(); const e = document.querySelector('.reel-tl-block[data-i="2"] .reel-tl-edge').getBoundingClientRect(); const S = AIImg.tools['reel-maker'].state(); return { w: tr.width, D: S.scenes.reduce((s, x) => s + (x._skip ? 0 : x.seconds), 0), x: e.left + e.width / 2, y: e.top + e.height / 2, s: S.scenes[2].seconds, beats: AIImg.tools['reel-maker'].current.reelBeats() }; });
    await page.mouse.move(geo.x, geo.y); await page.mouse.down(); await page.keyboard.down('Shift'); await page.mouse.move(geo.x + 40, geo.y, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Shift');
    const s2b = await page.evaluate(() => AIImg.tools['reel-maker'].state().scenes[2].seconds);
    const wantS = Math.min(15, geo.s + 40 / (geo.w / geo.D));
    check(Math.abs(s2b - wantS) < 0.12, 'dragging an edge 40 px lengthens the scene by 40 px of timeline: ' + geo.s + ' → ' + s2b + ' s (' + wantS.toFixed(2) + ' expected)');
    const blk = await page.evaluate(() => { const b = document.querySelector('.reel-tl-block[data-i="0"]').getBoundingClientRect(); const t = document.getElementById('reel-tl-track').getBoundingClientRect(); return { x: b.left + 8, y: b.top + b.height / 2, end: t.right - 3 }; });
    const idsBefore = await page.evaluate(() => AIImg.tools['reel-maker'].state().scenes.map((s) => s.id));
    await page.mouse.move(blk.x, blk.y); await page.mouse.down(); await page.mouse.move(blk.end, blk.y, { steps: 8 }); await page.mouse.up();
    await sleep(200);
    const idsAfter = await page.evaluate(() => AIImg.tools['reel-maker'].state().scenes.filter((s) => s.type !== 'endcard').map((s) => s.id));
    check(idsAfter[idsAfter.length - 1] === idsBefore[0], 'dragging the first block to the end of the timeline makes it the last scene');
    await startOver();

    /* ---- 8. stickers ---- */
    await makeFrom('', 'Sticker scene here');
    await pane('fx');
    await page.waitForFunction(() => document.querySelectorAll('.reel-stk-emoji').length > 0 || /could not/.test(document.getElementById('reel-stk-status').textContent), { timeout: 30000 });
    const nEmoji = await page.evaluate(() => document.querySelectorAll('.reel-stk-emoji').length);
    check(nEmoji >= 250, nEmoji + ' emoji in the picker, from the vendored Noto Emoji subset');
    await page.type('#reel-stk-find', 'fire'); await sleep(500);
    const fireN = await page.evaluate(() => [...document.querySelectorAll('.reel-stk-emoji')].map((b) => b.title));
    check(fireN.length >= 1 && fireN.every((t) => /fire/i.test(t)), 'searching "fire" finds ' + fireN.join(', '));
    await page.click('.reel-stk-emoji');
    await page.waitForFunction(() => { const S = AIImg.tools['reel-maker'].state(); return (S.scenes[0].stickers || []).length === 1; }, { timeout: 5000 });
    const stk = await page.evaluate(async () => {
      const T = AIImg.tools['reel-maker']; const S = T.state(); const sc = S.scenes[0]; const st = sc.stickers[0];
      await T.current.prepare();
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d');
      const draw = () => { x.clearRect(0, 0, 1080, 1920); T.renderFrame(x, 1080, 1920, 1.5, S); return x.getImageData(0, 0, 1080, 1920).data; };
      const withS = draw(); const keep = sc.stickers; sc.stickers = []; const without = draw(); sc.stickers = keep;
      const b = { x0: Math.round(st.x * 1080 - st.size * 540), y0: Math.round(st.y * 1920 - st.size * 540), s: Math.round(st.size * 1080) };
      let changed = 0; for (let y = b.y0; y < b.y0 + b.s; y++) for (let xx = b.x0; xx < b.x0 + b.s; xx++) { const i = (y * 1080 + xx) * 4; if (Math.abs(withS[i] - without[i]) + Math.abs(withS[i + 1] - without[i + 1]) + Math.abs(withS[i + 2] - without[i + 2]) > 60) changed++; }
      return { kind: st.kind, key: st.key, changed, area: b.s * b.s };
    });
    check(stk.kind === 'emoji' && stk.changed > stk.area * 0.15, 'the emoji sticker (' + stk.key + ') is drawn: ' + stk.changed + ' of ' + stk.area + ' pixels in its box change');
    await page.click('.reel-stk-kinds [data-kind=badge]'); await sleep(150);
    await clickText('.reel-stk-grid', /^SALE$/);
    const badge = await page.evaluate(() => { const S = AIImg.tools['reel-maker'].state(); const l = S.scenes[0].stickers; return l[l.length - 1]; });
    check(badge && badge.kind === 'badge' && badge.key === 'SALE', 'a SALE badge is added');
    /* drag it on the preview by 40 px across and 20 down */
    await page.evaluate(() => { AIImg.tools['reel-maker'].state().t = 1.5; AIImg.tools['reel-maker'].current.invalidate(); });
    await sleep(200);
    const cv = await page.evaluate((id) => { const S = AIImg.tools['reel-maker'].state(); const st = S.scenes[0].stickers.find((x) => x.id === id); const r = document.querySelector('.reel-canvas').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height, x: st.x, y: st.y, size: st.size }; }, badge.id);
    const px0 = cv.left + cv.x * cv.w, py0 = cv.top + cv.y * cv.h;
    await page.mouse.move(px0, py0); await page.mouse.down(); await page.mouse.move(px0 + 40, py0 + 20, { steps: 6 }); await page.mouse.up();
    const moved = await page.evaluate((id) => { const st = AIImg.tools['reel-maker'].state().scenes[0].stickers.find((x) => x.id === id); return { x: st.x, y: st.y, size: st.size }; }, badge.id);
    check(Math.abs(moved.x - (cv.x + 40 / cv.w)) < 0.01 && Math.abs(moved.y - (cv.y + 20 / cv.h)) < 0.01, 'dragging the badge 40 px right and 20 px down moves it by 40/' + Math.round(cv.w) + ' and 20/' + Math.round(cv.h) + ' of the frame (' + cv.x.toFixed(3) + ' → ' + moved.x.toFixed(3) + ')');
    /* its corner: the resize handle */
    const U = Math.min(cv.w, cv.h);
    const cx = cv.left + moved.x * cv.w + moved.size * U / 2 * (cv.w / cv.w), cy = cv.top + moved.y * cv.h + moved.size * (cv.w) / 2;
    await page.mouse.move(cx - 2, cy - 2); await page.mouse.down(); await page.mouse.move(cx + 30, cy + 30, { steps: 5 }); await page.mouse.up();
    const sized = await page.evaluate((id) => AIImg.tools['reel-maker'].state().scenes[0].stickers.find((x) => x.id === id).size, badge.id);
    check(sized > moved.size + 0.03, 'dragging its corner makes it bigger: ' + moved.size.toFixed(3) + ' → ' + sized.toFixed(3));
    const sliders = await page.evaluate((id) => !!document.getElementById('reel-stk-x-' + id) && !!document.getElementById('reel-stk-size-' + id), badge.id);
    check(sliders, 'each sticker has sliders for place, size and turn (keyboard)');

    /* ---- 9. destinations ---- */
    await pane('export');
    await page.select('#reel-dest', 'reels');
    const reels = await page.evaluate(() => { const S = AIImg.tools['reel-maker'].state(); const m = AIImg.tools['reel-maker'].marks(1080, 1920, S); const side = document.querySelector('.reel-safe-band.is-left'); return { size: S.sizeKey, safe: S.destSafe, box: m.box, side: !!side && !side.hidden, hint: document.getElementById('reel-dest-hint').textContent }; });
    check(reels.size === '1080x1920' && reels.safe && reels.safe.bottom === 0.35 && reels.box.y + reels.box.h <= 1920 * 0.65 + 0.5 && reels.box.y >= 1920 * 0.14 && reels.side,
      'Reels: 1080×1920, the content stays between 14% and 65% of the height (box ' + Math.round(reels.box.y) + '–' + Math.round(reels.box.y + reels.box.h) + ' px), side bands shown');
    check(/facebook\.com\/business\/ads-guide/.test(reels.hint), 'the destination names its source: ' + reels.hint.slice(0, 90) + '…');
    await page.select('#reel-dest', 'linkedin');
    const li = await page.evaluate(() => ({ size: AIImg.tools['reel-maker'].state().sizeKey, sixty: document.querySelector('#reel-fps option[value="60"]').disabled }));
    check(li.size === '1080x1080' && li.sixty, 'LinkedIn: 1080×1080 and 60 fps cannot be picked');
    await page.select('#reel-dest', 'x');
    check(await page.evaluate(() => AIImg.tools['reel-maker'].state().sizeKey) === '1280x720', 'X: 1280×720');
    await page.select('#reel-dest', 'shorts');
    await page.select('#reel-fps', '60');
    await page.evaluate(() => { const S = AIImg.tools['reel-maker'].state(); S.scenes.forEach((s) => { s.seconds = 1.5; s.base = 1.5; }); AIImg.tools['reel-maker'].current.invalidate(); });
    const D60 = await page.evaluate(() => AIImg.tools['reel-maker'].state().scenes.reduce((s, x) => s + (x._skip ? 0 : x.seconds), 0));
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
    await page.click('#reel-export');
    await page.waitForFunction(() => /Done in|failed|Cancelled/.test((document.querySelector('.reel-exstatus') || {}).textContent || ''), { timeout: 300000 });
    const mp4 = await page.evaluate(async () => {
      const a = [...document.querySelectorAll('.aiimg-result a.btn-download')].find((x) => /\.mp4$/.test(x.download));
      if (!a) return null;
      const b = await (await fetch(a.href)).blob(); const buf = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { b64: btoa(bin), cfg: AIImg.lastVideoConfig, name: a.download, type: b.type };
    });
    if (mp4) {
      const buf = Buffer.from(mp4.b64, 'base64'); fs.writeFileSync(path.join(OUT, mp4.name), buf);
      const v = mp4Video(buf);
      check(mp4.cfg && mp4.cfg.framerate === 60 && mp4.cfg.bitrate === 12e6, 'Shorts at 60 fps: the encoder was given 60 fps and 12 Mbps');
      check(v && Math.abs(v.samples - Math.round(D60 * 60)) <= 2 && Math.abs(v.samples / v.seconds - 60) < 1, 'the MP4 itself holds ' + (v && v.samples) + ' frames over ' + (v && v.seconds.toFixed(2)) + ' s = ' + (v && (v.samples / v.seconds).toFixed(1)) + ' fps (' + Math.round(D60 * 60) + ' frames expected)');
      check(/\.mp4$/.test(mp4.name) && mp4.type === 'video/mp4', 'named ' + mp4.name + ' from its type ' + mp4.type);
    } else check(false, 'the 60 fps export produced an MP4');

    /* ---- 10. one scene as a GIF ---- */
    await page.select('#reel-dest', 'custom'); await page.select('#reel-size', '1080x1920');
    await page.evaluate(() => { const T = AIImg.tools['reel-maker']; const S = T.state(); S.t = 0.5; T.current.invalidate(); });
    await page.click('#reel-gif');
    await page.waitForFunction(() => /GIF done|failed|Cancelled/.test((document.querySelector('.reel-exstatus') || {}).textContent || ''), { timeout: 180000 });
    const gif = await page.evaluate(async () => {
      const a = [...document.querySelectorAll('.aiimg-result a.btn-download')].find((x) => /\.gif$/.test(x.download));
      if (!a) return null;
      const b = await (await fetch(a.href)).blob(); const buf = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { b64: btoa(bin), name: a.download, secs: AIImg.tools['reel-maker'].state().scenes[0].seconds };
    });
    if (gif) {
      const g = gifInfo(Buffer.from(gif.b64, 'base64'));
      fs.writeFileSync(path.join(OUT, gif.name), Buffer.from(gif.b64, 'base64'));
      check(g.sig === 'GIF89a' && g.w === 540 && g.h === 960 && g.loop, 'the scene GIF is GIF89a, 540×960, looping (' + gif.name + ')');
      check(Math.abs(g.frames - Math.round(gif.secs * 15)) <= 1 && g.delays.every((d) => d >= 6 && d <= 7), g.frames + ' frames for a ' + gif.secs + ' s scene at 15 fps, ' + (g.delays[0] * 10) + ' ms each');
    } else check(false, 'the GIF export produced a GIF');

    /* ---- 11. the draft keeps the new settings ---- */
    await pane('fx');
    await page.select('#reel-trans-all', 'whip');
    await page.select('#reel-grade', 'warm');
    await pane('export');
    await page.select('#reel-dest', 'reels');
    await sleep(1200);
    await goto();
    await page.waitForSelector('#reel-draft-restore', { timeout: 10000 });
    await page.click('#reel-draft-restore');
    await sleep(1500);
    const draft = await page.evaluate(() => { const S = AIImg.tools['reel-maker'].state(); return { transAll: S.transAll, grade: S.grade, dest: S.dest, stickers: (S.scenes[0].stickers || []).length, safe: S.destSafe && S.destSafe.bottom }; });
    check(draft.transAll === 'whip' && draft.grade === 'warm' && draft.dest === 'reels' && draft.safe === 0.35 && draft.stickers === 2, 'a restored draft keeps the transitions, the grade, the destination and both stickers: ' + JSON.stringify(draft));

    /* ---- 12. a phone ---- */
    /* a mobile viewport reloads the page: the draft is offered again */
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.waitForSelector('#reel-draft-restore', { timeout: 15000 });
    await page.evaluate(() => { const c = document.querySelector('.cc'); if (c) c.remove(); document.getElementById('reel-draft-restore').click(); });
    await page.waitForFunction(() => { const s = document.querySelector('.aiimg-studio'); return s && !s.hidden; }, { timeout: 15000 });
    await sleep(500);
    await pane('fx');
    const phone = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, tl: document.getElementById('reel-timeline').getBoundingClientRect().width }));
    check(phone.sw <= 390 && phone.tl > 200, 'at 390 px the page does not scroll sideways (' + phone.sw + ' px) and the timeline is ' + Math.round(phone.tl) + ' px wide');
    await page.screenshot({ path: path.join(OUT, 'phone-effects.png'), fullPage: false });
    await page.setViewport({ width: 1400, height: 1000, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await page.waitForSelector('#reel-draft-restore', { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { const c = document.querySelector('.cc'); if (c) c.remove(); const r = document.getElementById('reel-draft-restore'); if (r) r.click(); });
    await sleep(800);
    await pane('fx');
    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); document.querySelector('.aiimg-studio').scrollIntoView(); });
    await page.screenshot({ path: path.join(OUT, 'desktop-light.png'), fullPage: false });

    check(net.length === 0, 'no request left 127.0.0.1' + (net.length ? ': ' + net.slice(0, 3).join(' | ') : ''));
    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

(async () => {
  const t0 = Date.now();
  try {
    nodePart();
    if (!NODE_ONLY) await browserPart();
  } catch (e) { console.error(e); fails.push('the run broke: ' + (e && e.message)); }
  console.log('\n' + ((Date.now() - t0) / 1000).toFixed(1) + 's ' + passes + ' passed, ' + fails.length + ' failed' + (fails.length ? '' : ' — all checks passed'));
  process.exit(fails.length ? 1 : 0);
})();
