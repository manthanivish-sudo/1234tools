/**
 * Scan to PDF (/pdf/scan-to-pdf/), proved on its page in headless Chrome.
 *
 *   node build/tests/pdf-scan-to-pdf.js [--port 8860] [--out <dir>] [--only a,b] [--verbose]
 *
 * The photos are drawn by this file, in the browser, never by the tool: an
 * A4 page with a black header bar at the top left, fifteen lines of word
 * blocks, an 8 x 6 checkerboard of 10 mm cells and 1 to 3 "ID" blocks at the
 * bottom left that say which photo it is, placed in 3-D and photographed by
 * a pinhole camera onto wood, a grey table or carpet, with a soft shadow
 * and sensor noise, then saved as JPEG at quality 92 and uploaded through
 * the page's own file input. One photo is stored on its side with an EXIF
 * Orientation 6 tag, as phones save them.
 *
 * The PDF the page writes is read back with pdf.js (the site's copy, in the
 * page: page count, size, and a render that is sampled at the page's known
 * places in millimetres) and with MuPDF (PyMuPDF) where python has it.
 *
 * Groups (for --only):
 *   page      the drop zone, three photos in, one page each, upright and
 *             rectified (checkerboard cells right > 95%), the paper white
 *             (mean > 235) where the photo had it in shadow, the main thread
 *             free while it works (long tasks), MuPDF's view
 *   edit      dragging a corner, the keyboard, Use the whole photo (the
 *             background comes back), Reset, rotate and reorder, Cancel
 *   flags     a photo with no page in it: fallback and "Check the corners";
 *             a file that is not a photo
 *   camera    the fake camera: not started on load, Take the photo adds a
 *             page, Space works, Done stops the tracks; refused and missing
 *             camera: the fallback with capture="environment"
 *   big       a 4032 x 3024 photo: detection and straightening times
 *   narrow    390 px: no horizontal scroll, with cards and with the camera
 *   noworker  no Worker and no OffscreenCanvas: the page runs the same jobs
 *
 * Every request host is recorded; anything but 127.0.0.1 fails the run.
 * Exit code 2 when an assertion fails, 1 when the run itself breaks.
 *
 * require()d (it only runs when started directly), it hands its scene
 * drawing, layout and pdf.js sampler to build/tests/claims/pdf.js, so the
 * claims check the page on the same photos. CSS below is the tool's rules
 * for assets/app.css, injected only while the stylesheet lacks them.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8860));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-scan-to-pdf')));
const ONLY = arg('--only', '') ? arg('--only', '').split(',') : null;
const VERBOSE = process.argv.includes('--verbose');
const want = (g) => !ONLY || ONLY.includes(g);
const BASE = 'http://127.0.0.1:' + PORT;
const TOOL = '/pdf/scan-to-pdf/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
function check(ok, what, detail) {
  if (ok) { pass++; console.log('  ok    ' + what + (detail && VERBOSE ? '  (' + detail + ')' : '')); }
  else { fail++; failures.push(what + (detail ? '  (' + detail + ')' : '')); console.log('  FAIL  ' + what + (detail ? '  -> ' + detail : '')); }
  return ok;
}
const group = (t) => console.log('\n' + t);
const note = (t) => console.log('        ' + t);

/* The rules this tool needs, handed back for assets/app.css. Injected here
   only while the site's stylesheet does not have them yet. */
const CSS = `
/* ---------- Scan to PDF (/pdf/scan-to-pdf/) ---------- */
.docscan-io > .file-list { display: none; }
.docscan-tool { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; min-width: 0; }
.docscan-camera { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.docscan-camera-bar, .docscan-camera-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.docscan-camera-bar .btn-ghost[hidden] { display: none; }
.docscan-camera-note { font-size: .82rem; color: var(--text-3); }
.docscan-camera-live { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.docscan-camera-live[hidden], .docscan-camera-fallback[hidden], .docscan-pages[hidden] { display: none; }
.docscan-camera-view { position: relative; min-width: 0; display: flex; justify-content: center; background: #000; border-radius: var(--radius-sm); overflow: hidden; }
.docscan-camera-view:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.docscan-camera-video { display: block; width: 100%; max-width: 100%; min-width: 0; max-height: 70vh; object-fit: contain; }
.docscan-camera-view.is-flash::after { content: ""; position: absolute; inset: 0; background: #fff; opacity: .55; }
.docscan-camera-count { flex: 1; min-width: 10em; font-size: .85rem; color: var(--text-2); }
.docscan-camera-fallback { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.docscan-camera-fallback .io-msg { margin: 0; }
.docscan-pages-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-bottom: 8px; }
.docscan-pages-hint { font-size: .82rem; color: var(--text-3); }
.docscan-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 12px; }
.docscan-card { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 14px; overflow: hidden; background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.docscan-card.is-error { border-color: rgba(229, 72, 77, .6); }
.docscan-card-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.docscan-num { flex: none; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); font-family: var(--font-mono); font-size: .7rem; font-weight: 700; }
.docscan-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); font-size: .78rem; color: var(--text-1); }
.docscan-flag { flex: none; padding: 1px 8px; border-radius: 999px; font-size: .72rem; font-weight: 600; color: var(--text-1); background: color-mix(in srgb, var(--amber) 24%, transparent); border: 1px solid color-mix(in srgb, var(--amber) 55%, transparent); }
.docscan-flag[hidden] { display: none; }
.docscan-card-body { display: grid; grid-template-columns: minmax(0, 1fr) 92px; gap: 12px; align-items: start; }
.docscan-stage { position: relative; width: 100%; aspect-ratio: 4 / 3; background: var(--recess); border-radius: 6px; touch-action: none; user-select: none; -webkit-user-select: none; }
.docscan-photo { display: block; width: 100%; height: 100%; border-radius: 6px; }
.docscan-quad { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.docscan-quad-shade { fill: rgba(0, 0, 0, .45); }
.docscan-quad-line { fill: none; stroke: var(--gold-2); stroke-width: 2; }
.docscan-handle { position: absolute; width: 24px; height: 24px; margin: -12px 0 0 -12px; padding: 0; border-radius: 50%; border: 2px solid #fff; background: rgba(247, 201, 72, .9); box-shadow: 0 0 0 1px rgba(0, 0, 0, .6), 0 2px 6px rgba(0, 0, 0, .45); cursor: grab; touch-action: none; }
.docscan-handle::after { content: ""; position: absolute; inset: -9px; border-radius: 50%; }
.docscan-handle:focus-visible { outline: 3px solid var(--cyan); outline-offset: 2px; }
.docscan-handle.is-dragging { cursor: grabbing; transform: scale(1.2); }
.docscan-handle[hidden] { display: none; }
.docscan-busy { position: absolute; inset: 0; display: grid; place-items: center; padding: 8px; text-align: center; font-size: .85rem; color: #fff; background: rgba(0, 0, 0, .5); border-radius: 6px; }
.docscan-busy[hidden] { display: none; }
.docscan-side { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.docscan-result { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.docscan-preview { display: block; max-width: 100%; max-height: 130px; width: auto; height: auto; background: #fff; border: 1px solid var(--border); box-shadow: var(--shadow-card); }
.docscan-result figcaption { font-size: .72rem; color: var(--text-3); }
.docscan-status { margin: 0; font-size: .78rem; line-height: 1.45; color: var(--text-2); overflow-wrap: anywhere; }
.docscan-tools { display: flex; flex-wrap: wrap; gap: 6px; }
.docscan-tools .btn-ghost { padding: 3px 10px; font-size: .8rem; line-height: 1.4; }
@media (max-width: 480px) {
  .docscan-card { padding: 12px; }
  .docscan-card-body { grid-template-columns: minmax(0, 1fr); }
  .docscan-side { flex-direction: row; align-items: center; }
  .docscan-result { flex: none; }
  .docscan-preview { max-height: 96px; max-width: 80px; }
}
`;

/* ================================================================== */
/* the photos, drawn in the page                                       */
/* ================================================================== */

/* Runs in the browser (serialised by puppeteer). Page layout in mm from the
   page's top-left corner; the camera model is the one in pdf-scan-vision's
   own test. Returns a JPEG as base64 and the page's corners in the photo. */
function drawScene(sc) {
  const W = sc.W, H = sc.H, PW = 210, PH = 297;
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash2(x, y, seed) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function background(kind, x, y, seed) {
    const X = x * 1200 / Math.max(W, H), Y = y * 1200 / Math.max(W, H);
    if (kind === 'wood') {
      const g = Math.sin(0.05 * (X * 0.95 + Y * 0.31) + 2.2 * Math.sin(0.013 * Y - 0.004 * X) + 1.3 * Math.sin(0.031 * X + 0.6 * valueNoise(X / 40, Y / 40, seed)));
      const plank = Math.floor((X * 0.31 - Y * 0.95 + 4000) / 170);
      const tint = (hash2(plank, 7, seed) - 0.5) * 16 + (valueNoise(X / 25, Y / 90, seed + 3) - 0.5) * 20;
      return [104 + 22 * g + tint, 66 + 15 * g + tint * 0.6, 38 + 8 * g + tint * 0.3];
    }
    if (kind === 'grey') { const v = 128 - 14 * (Math.pow((X - 600) / 700, 2) + Math.pow((Y - 450) / 700, 2)); return [v, v, v + 3]; }
    const n = 0.6 * valueNoise(X / 6, Y / 6, seed) + 0.4 * valueNoise(X / 30, Y / 30, seed + 1);
    return [40 + 60 * n, 46 + 50 * n, 70 + 45 * n];   // carpet
  }
  const r99 = rng(99), WORDS = [];
  for (let li = 0; li < 15; li++) {
    let u = 15; const ws = [], end = li % 5 === 4 ? 110 : 195;
    while (u < end - 4) { const wd = 6 + r99() * 22, e = Math.min(u + wd, end); ws.push([u, e]); u = e + 3; }
    WORDS.push(ws);
  }
  const id = sc.id || 1;
  function ink(u, v) {
    if (u >= 15 && u < 95 && v >= 15 && v < 30) return true;
    if (v >= 45 && v < 45 + 15 * 7) {
      const li = Math.floor((v - 45) / 7);
      if (v - 45 - li * 7 < 3.2) for (const w of WORDS[li]) if (u >= w[0] && u < w[1]) return true;
    }
    if (u >= 65 && u < 145 && v >= 170 && v < 230) return (Math.floor((u - 65) / 10) + Math.floor((v - 170) / 10)) % 2 === 0;
    if (v >= 272 && v < 282) for (let j = 0; j < id; j++) if (u >= 20 + 14 * j && u < 30 + 14 * j) return true;
    return false;
  }
  function rotMat(rollDeg, ax, by) {
    const c = Math.cos, s = Math.sin, r = rollDeg * Math.PI / 180, a = ax * Math.PI / 180, b = by * Math.PI / 180;
    const Rz = [[c(r), -s(r), 0], [s(r), c(r), 0], [0, 0, 1]], Rx = [[1, 0, 0], [0, c(a), -s(a)], [0, s(a), c(a)]], Ry = [[c(b), 0, s(b)], [0, 1, 0], [-s(b), 0, c(b)]];
    const mul = (A, B) => { const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) M[i][j] += A[i][k] * B[k][j]; return M; };
    return mul(Rz, mul(Rx, Ry));
  }
  function inv3(m) {
    const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }
  const apply3 = (M, x, y) => { const z = M[2][0] * x + M[2][1] * y + M[2][2]; return [(M[0][0] * x + M[0][1] * y + M[0][2]) / z, (M[1][0] * x + M[1][1] * y + M[1][2]) / z]; };
  let G = null, Gi = null, corners = null;
  if (sc.page !== false) {
    const f = (sc.focal || 0.78) * Math.max(W, H), R = rotMat(sc.roll || 0, sc.tiltX || 0, sc.tiltY || 0);
    const tz = f * PH / ((sc.fill || 0.7) * H), T = [(sc.dx || 0) * W * tz / f, (sc.dy || 0) * H * tz / f, tz], cx = W / 2, cy = H / 2;
    G = [[f * R[0][0] + cx * R[2][0], f * R[0][1] + cx * R[2][1], f * T[0] + cx * T[2]], [f * R[1][0] + cy * R[2][0], f * R[1][1] + cy * R[2][1], f * T[1] + cy * T[2]], [R[2][0], R[2][1], T[2]]];
    Gi = inv3(G);
    corners = [[-PW / 2, -PH / 2], [PW / 2, -PH / 2], [PW / 2, PH / 2], [-PW / 2, PH / 2]].map((p) => apply3(G, p[0], p[1]));
  }
  const paper = sc.paper || [240, 236, 226], INK = [30, 30, 38];
  const ss = sc.ss || 2, sh = sc.shadow, seed = sc.seed || 1, g = rng(seed + 17);
  let spare = null;
  const gauss = () => { if (spare !== null) { const s = spare; spare = null; return s; } const u = g() || 1e-12, v = g(), m = Math.sqrt(-2 * Math.log(u)); spare = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v); };
  const img = new ImageData(W, H), d = img.data, sigma = sc.noise == null ? 4 : sc.noise;
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i += 4) {
      let r = 0, gg = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const px = x + (sx + 0.5) / ss, py = y + (sy + 0.5) / ss;
        let col = null;
        if (Gi) {
          const uv = apply3(Gi, px, py), u = uv[0] + PW / 2, v = uv[1] + PH / 2;
          if (u >= 0 && u < PW && v >= 0 && v < PH) col = ink(u, v) ? INK : paper;
        }
        if (!col) col = background(sc.bg, px, py, seed);
        r += col[0]; gg += col[1]; b += col[2];
      }
      const n = ss * ss;
      let sf = 1;
      if (sh) { const a = sh.angle * Math.PI / 180, t = ((x + 0.5 - W / 2) * Math.cos(a) + (y + 0.5 - H / 2) * Math.sin(a)) / Math.hypot(W, H); sf = 1 - sh.depth * smoothstep(sh.from, sh.to, t); }
      const nz = gauss() * sigma;
      d[i] = r / n * sf + nz; d[i + 1] = gg / n * sf + nz; d[i + 2] = b / n * sf + nz; d[i + 3] = 255;
    }
  }
  let c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d').putImageData(img, 0, 0);
  if (sc.storeSideways) {
    /* stored turned a quarter anticlockwise, to be shown with EXIF Orientation 6 */
    const s = document.createElement('canvas');
    s.width = H; s.height = W;
    const x = s.getContext('2d');
    x.translate(0, W); x.rotate(-Math.PI / 2); x.drawImage(c, 0, 0);
    c = s;
  }
  return { b64: c.toDataURL('image/jpeg', 0.92).split(',')[1], corners, storedW: c.width, storedH: c.height };
}

/** EXIF APP1 with only Orientation, put straight after the JPEG's SOI. */
function withOrientation(jpeg, o) {
  const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const len = body.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, len >> 8, len & 255]), body]);
  return Buffer.concat([jpeg.slice(0, 2), app1, jpeg.slice(2)]);
}

const SCENES = {
  wood: { name: 'scan-wood.jpg', W: 1600, H: 1200, bg: 'wood', roll: 6, tiltX: 18, tiltY: -6, fill: 0.84, id: 1, seed: 11, shadow: { angle: 0, from: 0.0, to: 0.3, depth: 0.42 } },
  grey: { name: 'scan-grey.jpg', W: 1600, H: 1200, bg: 'grey', roll: -18, tiltX: 12, tiltY: 8, fill: 0.78, id: 2, seed: 12, shadow: { angle: 200, from: -0.05, to: 0.25, depth: 0.3 } },
  carpet: { name: 'scan-carpet-exif6.jpg', W: 1200, H: 1600, bg: 'carpet', roll: 12, tiltX: 10, tiltY: 16, fill: 0.72, id: 3, seed: 13, storeSideways: true },
  empty: { name: 'no-page.jpg', W: 1600, H: 1200, bg: 'wood', page: false, seed: 21 },
  cut: { name: 'page-off-the-edge.jpg', W: 1600, H: 1200, bg: 'grey', roll: 3, tiltX: 8, fill: 0.8, dx: 0.36, id: 1, seed: 16 },
  big: { name: 'scan-12mp.jpg', W: 4032, H: 3024, bg: 'wood', roll: 9, tiltX: 20, tiltY: -8, fill: 0.8, id: 1, seed: 31, ss: 1, shadow: { angle: 0, from: 0.05, to: 0.3, depth: 0.3 } }
};

async function makePhoto(page, key) {
  const sc = SCENES[key];
  const file = path.join(OUT, sc.name);
  const r = await page.evaluate(drawScene, sc);
  let buf = Buffer.from(r.b64, 'base64');
  if (sc.storeSideways) buf = withOrientation(buf, 6);
  fs.writeFileSync(file, buf);
  return { file, corners: r.corners, stored: r.storedW + 'x' + r.storedH, bytes: buf.length };
}

/* ================================================================== */
/* reading the output                                                  */
/* ================================================================== */

/* Places on the page, in mm on the upright A4 page; turned with the page
   when it was turned clockwise (turns 1: (u, v) -> (297 - v, u)). */
function layout(turns) {
  const R = (u0, v0, u1, v1) => turns === 1
    ? { x0: (297 - v1) / 297, x1: (297 - v0) / 297, y0: u0 / 210, y1: u1 / 210 }
    : { x0: u0 / 210, x1: u1 / 210, y0: v0 / 297, y1: v1 / 297 };
  const out = [];
  for (let cj = 0; cj < 6; cj++) for (let ci = 0; ci < 8; ci++) {
    const u = 65 + 10 * ci + 5, v = 170 + 10 * cj + 5;
    out.push(Object.assign(R(u - 2.5, v - 2.5, u + 2.5, v + 2.5), { name: 'cell', dark: (ci + cj) % 2 === 0 }));
  }
  out.push(Object.assign(R(25, 18, 85, 27), { name: 'header' }));
  out.push(Object.assign(R(125, 18, 185, 27), { name: 'mirror' }));       // where the header would be if the page were flipped
  out.push(Object.assign(R(105, 14, 195, 32), { name: 'paper1' }));       // right of the header: in the shadow on the wood photo
  out.push(Object.assign(R(152, 165, 195, 235), { name: 'paper2' }));     // right of the checkerboard
  out.push(Object.assign(R(15, 240, 60, 265), { name: 'paper3' }));
  for (let j = 0; j < 3; j++) out.push(Object.assign(R(21 + 14 * j, 274, 29 + 14 * j, 280), { name: 'id' + j }));
  return out;
}

/* pdf.js in the page: every page's size, and the mean of each rectangle (fractions of the page) in a render at 2x */
async function measure(page, bytes, rectsPerPage) {
  return page.evaluate(async (b64, rpp) => {
    const lib = await import('/engine/vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = '/engine/vendor/pdfjs/pdf.worker.min.mjs';
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const pdf = await lib.getDocument({ data: u8 }).promise;
    const out = { n: pdf.numPages, pages: [] };
    for (let p = 1; p <= pdf.numPages; p++) {
      const pg = await pdf.getPage(p), vp = pg.getViewport({ scale: 2 });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const rects = (rpp && (rpp[p - 1] || rpp[0])) || [];
      const vals = rects.map((r) => {
        const X0 = Math.round(r.x0 * c.width), X1 = Math.round(r.x1 * c.width), Y0 = Math.round(r.y0 * c.height), Y1 = Math.round(r.y1 * c.height);
        let R = 0, G = 0, B = 0, n = 0;
        for (let yy = Math.max(0, Y0); yy < Math.min(c.height, Y1); yy++) for (let xx = Math.max(0, X0); xx < Math.min(c.width, X1); xx++) {
          const k = (yy * c.width + xx) * 4; R += d[k]; G += d[k + 1]; B += d[k + 2]; n++;
        }
        n = n || 1;
        return { r: R / n, g: G / n, b: B / n, lum: (0.299 * R + 0.587 * G + 0.114 * B) / n };
      });
      const v1 = pg.getViewport({ scale: 1 });
      out.pages.push({ w: v1.width, h: v1.height, vals });
      c.width = c.height = 1;
    }
    return out;
  }, Buffer.from(bytes).toString('base64'), rectsPerPage);
}

/** Read one measured page against the layout: cells right, header where it belongs, paper means, the ID. */
function judge(m, rects) {
  const cells = rects.map((r, i) => ({ r, v: m.vals[i] })).filter((x) => x.r.name === 'cell');
  const lo = Math.min(...cells.map((c) => c.v.lum)), hi = Math.max(...cells.map((c) => c.v.lum)), thr = (lo + hi) / 2;
  const right = cells.filter((c) => (c.v.lum < thr) === c.r.dark).length;
  const by = (n) => m.vals[rects.findIndex((r) => r.name === n)];
  const id = [0, 1, 2].filter((j) => by('id' + j).lum < 110).length;
  return {
    cells: right, of: cells.length, header: by('header').lum, mirror: by('mirror').lum,
    paper: [by('paper1').lum, by('paper2').lum, by('paper3').lum], id,
    upright: by('header').lum < 110 && by('mirror').lum > 150
  };
}

function mupdf(file) {
  const py = [
    'import json, sys, pymupdf',
    'd = pymupdf.open(sys.argv[1])',
    'print(json.dumps({"pages": d.page_count, "sizes": [[round(p.rect.width, 2), round(p.rect.height, 2)] for p in d], "images": [[(i[2], i[3]) for i in p.get_images(full=True)] for p in d]}))'
  ].join('\n');
  const r = spawnSync('python', ['-c', py, file], { encoding: 'utf8' });
  if (r.status !== 0) return { error: (r.stderr || r.error || '').toString().slice(-300) };
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { return { error: r.stdout }; }
}

/* ================================================================== */
/* driving the page                                                    */
/* ================================================================== */

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found');
}

function hook(cam) {
  try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* */ }
  const blobs = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = function (o) { const u = orig.call(URL, o); try { if (o && typeof o.size === 'number') blobs.push(o); } catch (e) { /* */ } return u; };
  window.__h = { blobs, b64: (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(b); }) };
  window.__streams = [];
  window.__gumCalls = 0;
  window.__long = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push({ t: e.startTime, d: e.duration }))).observe({ type: 'longtask', buffered: true }); } catch (e) { /* */ }
  if (cam === 'noworker') { window.Worker = undefined; delete window.OffscreenCanvas; }
  const md = navigator.mediaDevices;
  if (cam === 'deny' && md) md.getUserMedia = () => { window.__gumCalls++; return Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); };
  else if (cam === 'missing' && md) { try { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); } catch (e) { /* */ } }
  else if (md && md.getUserMedia) {
    const g = md.getUserMedia.bind(md);
    md.getUserMedia = (c) => { window.__gumCalls++; window.__lastConstraints = c; return g(c).then((s) => { window.__streams.push(s); return s; }); };
  }
}

let browser = null, server = null;
const hosts = new Set();
async function open(cam, viewport) {
  const page = await browser.newPage();
  page.on('request', (r) => { try { const u = new URL(r.url()); if (/^(https?|wss?):$/.test(u.protocol)) hosts.add(u.host); } catch (e) { /* */ } });
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(String(e && e.message || e)));
  page.__requests = [];
  page.on('request', (r) => page.__requests.push(r.url()));
  await page.setViewport(viewport || { width: 1280, height: 1000 });
  await page.evaluateOnNewDocument(hook, cam || '');
  await page.goto(BASE + TOOL, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  await page.waitForSelector('.pdf-run .btn-primary', { timeout: 30000 });
  await page.waitForSelector('.docscan-camera', { timeout: 10000 });
  await page.evaluate((css) => {
    const has = [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.selectorText && r.selectorText.indexOf('.docscan-card') >= 0); } catch (e) { return false; } });
    if (!has) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
  }, CSS);
  return page;
}
async function setControls(page, c) {
  const missing = await page.evaluate((c) => Object.keys(c).filter((k) => {
    const el = document.getElementById('pc-' + k);
    if (!el) return true;
    el.value = String(c[k]);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return false;
  }), c);
  if (missing.length) throw new Error('controls not found: ' + missing.join(', '));
}
async function upload(page, files, total) {
  const input = await page.$('.tool-io .dropzone input[type=file]');
  await input.uploadFile(...files);
  await settle(page, total);
}
async function settle(page, total) {
  await page.waitForFunction((n) => {
    const cards = [...document.querySelectorAll('.docscan-card')];
    return cards.length === n && cards.every((c) => c.querySelector('.docscan-busy').hidden || c.classList.contains('is-error'));
  }, { timeout: 120000, polling: 100 }, total);
}
async function press(page) {
  await page.evaluate(() => { window.__runT0 = performance.now(); });
  await page.$eval('.pdf-run .btn-primary', (b) => b.click());
  await page.waitForFunction(() => {
    const s = document.querySelector('.pdf-summary'); const m = document.querySelector('.tool-io > .io-msg');
    return (s && !s.hidden) || (m && /is-(error|note)/.test(m.className) && !document.querySelector('.pdf-run .btn-primary').disabled);
  }, { timeout: 240000, polling: 100 });
  return page.evaluate(() => { const m = document.querySelector('.tool-io > .io-msg'); return { cls: m.className, msg: m.textContent, summary: !document.querySelector('.pdf-summary').hidden, t1: performance.now() }; });
}
async function download(page) {
  const n0 = await page.evaluate(() => window.__h.blobs.length);
  await page.$eval('.pdf-summary-actions .btn-primary', (b) => b.click());
  await page.waitForFunction((n) => window.__h.blobs.length > n, { timeout: 30000 }, n0);
  const r = await page.evaluate(async (n) => { const b = window.__h.blobs[n]; return { type: b.type, b64: await window.__h.b64(b) }; }, n0);
  const name = await page.$eval('.pdf-summary .pdf-summary-name, .pdf-summary strong', (e) => e.textContent).catch(() => '');
  return { bytes: new Uint8Array(Buffer.from(r.b64, 'base64')), type: r.type, name };
}
const stats = (page) => page.$$eval('.stat-row', (l) => Object.fromEntries(l.map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent])));
const cardInfo = (page) => page.$$eval('.docscan-card', (l) => l.map((c) => ({
  name: c.querySelector('.docscan-name').textContent, num: c.querySelector('.docscan-num').textContent,
  status: c.querySelector('.docscan-status').textContent, flag: !c.querySelector('.docscan-flag').hidden, error: c.classList.contains('is-error'),
  handles: [...c.querySelectorAll('.docscan-handle')].map((h) => [parseFloat(h.style.left), parseFloat(h.style.top)])
})));
async function clickIn(page, cardIndex, sel) {
  const ok = await page.evaluate((i, s) => { const c = document.querySelectorAll('.docscan-card')[i]; const b = c && c.querySelector(s); if (!b || b.disabled) return false; b.click(); return true; }, cardIndex, sel);
  if (!ok) throw new Error('could not press ' + sel + ' on card ' + (cardIndex + 1));
  await new Promise((r) => setTimeout(r, 150));
}
const savePdf = (name, bytes) => { const f = path.join(OUT, name); fs.writeFileSync(f, bytes); return f; };
const r1 = (v) => Math.round(v * 10) / 10;

/* ================================================================== */

const shared = {};
async function photos(page) {
  if (shared.wood) return shared;
  for (const k of ['wood', 'grey', 'carpet', 'empty']) {
    const t = Date.now();
    shared[k] = await makePhoto(page, k);
    note('drew ' + SCENES[k].name + ' (' + shared[k].stored + ' stored, ' + shared[k].bytes + ' bytes) in ' + (Date.now() - t) + ' ms');
  }
  return shared;
}

async function pagePart() {
  group('page  three photos in, one straightened page each');
  const p = await open();
  const ph = await photos(p);
  const dz = await p.$eval('.tool-io .dropzone input[type=file]', (i) => ({ accept: i.accept, multiple: i.multiple, capture: i.getAttribute('capture') }));
  check(dz.accept === 'image/*' && dz.multiple && dz.capture === null, 'the drop zone takes several images and has no capture attribute (a desktop can pick files)', JSON.stringify(dz));
  const gumLoad = await p.evaluate(() => window.__gumCalls);
  check(gumLoad === 0, 'the camera is not asked for on load', gumLoad + ' calls');

  await setControls(p, { pageSize: 'a4', enhance: 'colour', quality: '0.85' });
  await upload(p, [ph.wood.file, ph.grey.file, ph.carpet.file], 3);
  const cards = await cardInfo(p);
  check(cards.length === 3 && cards.map((c) => c.name).join() === 'scan-wood.jpg,scan-grey.jpg,scan-carpet-exif6.jpg', 'a card per photo, in the order chosen', cards.map((c) => c.name).join());
  check(cards.every((c) => /^Edges found \(confidence/.test(c.status) && !c.flag), 'every page\'s edges are found with confidence, none flagged', cards.map((c) => c.status).join(' | '));
  const sawWorker = p.__requests.some((u) => /pdf-scan-worker\.js$/.test(u)) && p.__requests.some((u) => /pdf-scan-vision\.js$/.test(u));
  check(sawWorker, 'the work is done by engine/pdf-scan-worker.js, which loads pdf-scan-vision.js');
  const quadsOk = await p.evaluate(() => [...document.querySelectorAll('.docscan-card')].every((c) => c.querySelector('.docscan-quad-line').getAttribute('points').split(' ').length === 4));
  check(quadsOk, 'each card draws the page outline with four corners');

  const lt0 = await p.evaluate(() => performance.now());
  const res = await press(p);
  check(res.summary && !/is-error/.test(res.cls), 'Make the PDF finishes', res.msg);
  const longs = await p.evaluate((t0, t1) => window.__long.filter((e) => e.t >= t0 && e.t <= t1).map((e) => Math.round(e.d)), lt0, res.t1);
  const st = await stats(p);
  note('stats: ' + JSON.stringify(st));
  const out = await download(p);
  const f = savePdf('scan-three.pdf', out.bytes);
  check(/^scan-\d{4}-\d{2}-\d{2}\.pdf$/.test(out.name) || /^scan-\d{4}-\d{2}-\d{2}\.pdf$/.test(await p.evaluate(() => (document.querySelector('.pdf-summary') || {}).textContent || '').then((t) => (t.match(/scan-\d{4}-\d{2}-\d{2}\.pdf/) || [''])[0])), 'the file is called scan-YYYY-MM-DD.pdf', out.name);
  check(out.type === 'application/pdf', 'it is saved as application/pdf', out.type);
  const L = layout(0);
  const m = await measure(p, out.bytes, [L]);
  check(m.n === 3, 'pdf.js: one page per photo', m.n + ' pages');
  m.pages.forEach((pg, i) => {
    const j = judge(pg, L);
    note('page ' + (i + 1) + ': ' + r1(pg.w) + ' x ' + r1(pg.h) + ' pt, cells ' + j.cells + '/48, header ' + r1(j.header) + ', mirror ' + r1(j.mirror) + ', paper ' + j.paper.map(r1).join('/') + ', id ' + j.id);
    check(Math.abs(pg.w - 595.28) < 0.5 && Math.abs(pg.h - 841.89) < 0.5, 'page ' + (i + 1) + ' is A4 portrait', pg.w + ' x ' + pg.h);
    check(j.cells / j.of > 0.95, 'page ' + (i + 1) + ': rectified, checkerboard cells right in the render (> 95%)', j.cells + '/' + j.of);
    check(j.upright, 'page ' + (i + 1) + ': upright (the header bar at the top left, not the top right)', 'header ' + r1(j.header) + ', other side ' + r1(j.mirror));
    check(j.id === i + 1, 'page ' + (i + 1) + ' is photo ' + (i + 1), 'ID blocks ' + j.id);
    check(Math.min(...j.paper) > 235, 'page ' + (i + 1) + ': the paper is white (every paper area\'s mean > 235)', j.paper.map(r1).join(', '));
  });
  check(/^3$/.test(st.Pages || '') && /^3 of 3 \(confidence/.test(st['Edges found'] || ''), 'the summary: 3 pages, edges found on 3 of 3 with a confidence range', JSON.stringify(st));
  check(longs.length === 0 || Math.max(...longs) < 300, 'the page stays responsive while it works: no main-thread task of 300 ms or more', 'long tasks ' + (longs.join(', ') || 'none'));
  const mu = mupdf(f);
  if (mu.error) note('MuPDF not available: ' + mu.error.split('\n').pop());
  else {
    check(mu.pages === 3 && mu.images.every((l) => l.length === 1), 'MuPDF: 3 pages, one picture each', JSON.stringify(mu));
    check(mu.images.every((l) => Math.max(l[0][0], l[0][1]) <= 2500), 'MuPDF: no picture longer than 2500 px', JSON.stringify(mu.images));
  }
  shared.three = { stats: st, size: out.bytes.length, pdfjs: m.pages.map((pg) => judge(pg, L)), longs, mupdf: mu };

  /* the same photos with no enhancement: the shadowed paper is grey, so the white above is the enhancement's doing */
  await setControls(p, { enhance: 'none' });
  await press(p);
  const raw = await download(p);
  const mr = await measure(p, raw.bytes, [L]);
  const pj = judge(mr.pages[0], L);
  check(pj.paper[0] < 225, 'with Enhancement "None" the same paper in shadow stays grey (so the white comes from the enhancement)', 'paper1 ' + r1(pj.paper[0]));
  note('none: ' + raw.bytes.length + ' bytes, page 1 paper ' + pj.paper.map(r1).join('/'));
  shared.three.none = { size: raw.bytes.length, paper: pj.paper };

  for (const mode of ['grey', 'bw']) {
    await setControls(p, { enhance: mode });
    await press(p);
    const o = await download(p);
    const mm = await measure(p, o.bytes, [L]);
    const jj = mm.pages.map((pg) => judge(pg, L));
    const s2 = await stats(p);
    check(mm.n === 3 && jj.every((x) => x.cells / x.of > 0.95 && x.upright && Math.min(...x.paper) > 235), mode + ': three upright pages, cells right, paper white', jj.map((x) => x.cells + ' ' + x.paper.map(r1).join('/')).join(' | '));
    if (mode === 'bw') {
      const a = Buffer.from(o.bytes).toString('latin1');
      check(/\/FlateDecode/.test(a) && !/\/DCTDecode/.test(a) && /\/DeviceGray/.test(a), 'black and white pages are stored lossless (Flate, DeviceGray), not as JPEG', s2.Pictures);
    }
    note(mode + ': ' + o.bytes.length + ' bytes; ' + s2.Pictures);
    shared.three[mode] = { size: o.bytes.length, pictures: s2.Pictures };
  }
  await setControls(p, { enhance: 'colour', pageSize: 'fit' });
  await press(p);
  const fit = await download(p);
  const mf = await measure(p, fit.bytes, [L]);
  const sf = await stats(p);
  check(mf.pages.every((pg) => Math.abs(pg.w - 595.28) < 0.5 && Math.abs(pg.h - 841.89) < 0.5) && /A4 \(matched\)/.test(sf['Page size'] || ''), 'Fit to the photo: an A4 page photographed at an angle is measured as A4 and given an A4 page', sf['Page size'] + ' ' + mf.pages.map((x) => r1(x.w) + 'x' + r1(x.h)).join(','));
  check(p.__errors.length === 0, 'no script errors on the page', p.__errors.join(' | '));
  await setControls(p, { pageSize: 'a4' });
  await p.close();
}

async function editPart() {
  group('edit  corners, keyboard, whole photo, reset, rotate, reorder, cancel');
  const p = await open();
  const ph = await photos(p);
  await setControls(p, { pageSize: 'fit', enhance: 'none', quality: '0.85' });
  await upload(p, [ph.wood.file, ph.grey.file], 2);
  const before = await cardInfo(p);
  const corner = [{ x0: 0.005, x1: 0.04, y0: 0.005, y1: 0.04 }];
  const isWood = (v) => v.r - v.b > 25;

  await press(p);
  let o = await download(p);
  let m = await measure(p, o.bytes, [corner]);
  const c0 = m.pages[0].vals[0];
  check(!isWood(c0), 'before any change, the top-left corner of page 1 is paper', 'rgb ' + [c0.r, c0.g, c0.b].map(Math.round).join(','));

  /* drag the top-left handle with the mouse to the photo's own corner */
  /* the shell scrolls the result into view, smoothly: let it finish before aiming */
  await new Promise((r) => setTimeout(r, 1200));
  await p.evaluate(() => document.querySelector('.docscan-card .docscan-stage').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 200));
  const hb = await p.evaluate(() => { const c = document.querySelector('.docscan-card'); const h = c.querySelector('.docscan-handle[data-corner="0"]').getBoundingClientRect(); const s = c.querySelector('.docscan-stage').getBoundingClientRect(); return { hx: h.x + h.width / 2, hy: h.y + h.height / 2, sx: s.x, sy: s.y }; });
  await p.mouse.move(hb.hx, hb.hy);
  await p.mouse.down();
  for (let k = 1; k <= 8; k++) await p.mouse.move(hb.hx + (hb.sx - 5 - hb.hx) * k / 8, hb.hy + (hb.sy - 5 - hb.hy) * k / 8);
  await p.mouse.up();
  await new Promise((r) => setTimeout(r, 200));
  let after = await cardInfo(p);
  check(after[0].handles[0][0] === 0 && after[0].handles[0][1] === 0 && /set by hand/.test(after[0].status), 'dragging the top-left handle past the photo\'s corner pins it there, and the card says the corners were set by hand', JSON.stringify(after[0].handles[0]) + ' ' + after[0].status);
  await press(p);
  o = await download(p);
  m = await measure(p, o.bytes, [corner]);
  const c1 = m.pages[0].vals[0];
  check(isWood(c1), 'after the drag the top-left corner of page 1 shows the wood the page lay on', 'rgb ' + [c1.r, c1.g, c1.b].map(Math.round).join(','));
  const sd = await stats(p);
  check(/^page 1$/.test(sd['Corners set by hand'] || ''), 'the summary lists page 1 under Corners set by hand', JSON.stringify(sd));

  /* touch: drag the same handle back a little with a finger, if this puppeteer can */
  if (p.touchscreen && p.touchscreen.touchStart) {
    const t0 = (await cardInfo(p))[0].handles[0];
    const tb = await p.evaluate(() => { const h = document.querySelector('.docscan-card .docscan-handle[data-corner="0"]').getBoundingClientRect(); return { x: h.x + h.width / 2, y: h.y + h.height / 2 }; });
    await p.touchscreen.touchStart(tb.x, tb.y);
    for (let k = 1; k <= 5; k++) await p.touchscreen.touchMove(tb.x + 6 * k, tb.y + 6 * k);
    await p.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 200));
    const t1 = (await cardInfo(p))[0].handles[0];
    check(t1[0] > t0[0] + 0.5 && t1[1] > t0[1] + 0.5, 'a touch drag moves the handle too', JSON.stringify(t0) + ' -> ' + JSON.stringify(t1));
  }

  /* keyboard: the bottom-right corner of page 2, Shift+ArrowLeft five times */
  await p.evaluate(() => document.querySelectorAll('.docscan-card')[1].querySelector('.docscan-handle[data-corner="2"]').focus());
  const k0 = (await cardInfo(p))[1].handles[2];
  for (let k = 0; k < 5; k++) { await p.keyboard.down('Shift'); await p.keyboard.press('ArrowLeft'); await p.keyboard.up('Shift'); }
  await p.keyboard.press('ArrowUp');
  const k1 = (await cardInfo(p))[1].handles[2];
  const focusOk = await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('docscan-handle'));
  check(Math.abs((k0[0] - k1[0]) - 10) < 0.01 && Math.abs((k0[1] - k1[1]) - 0.4) < 0.01 && focusOk, 'keyboard: a focused corner moves 2% a press with Shift and 0.4% without, and keeps the focus', JSON.stringify(k0) + ' -> ' + JSON.stringify(k1));

  /* reset to detected puts both back */
  await clickIn(p, 1, '.docscan-reset');
  const back = (await cardInfo(p))[1];
  check(JSON.stringify(back.handles) === JSON.stringify(before[1].handles) && /^Edges found/.test(back.status), 'Reset to detected puts the corners back where they were found', back.status);

  /* use the whole photo on page 1: the output is the photo, background and all */
  await clickIn(p, 0, '.docscan-whole');
  await press(p);
  o = await download(p);
  const corners4 = [{ x0: 0.005, x1: 0.04, y0: 0.005, y1: 0.04 }, { x0: 0.96, x1: 0.995, y0: 0.005, y1: 0.04 }, { x0: 0.96, x1: 0.995, y0: 0.96, y1: 0.995 }, { x0: 0.005, x1: 0.04, y0: 0.96, y1: 0.995 }];
  m = await measure(p, o.bytes, [corners4, [{ x0: 0, x1: 1, y0: 0, y1: 1 }]]);
  const wholeWood = m.pages[0].vals.filter(isWood).length;
  const sw = await stats(p);
  check(wholeWood === 4 && Math.abs(m.pages[0].w / m.pages[0].h - 1600 / 1200) < 0.01, 'Use the whole photo: all four corners of page 1 are the wood again, and with Fit to the photo the page has the photo\'s 4:3 shape', wholeWood + ' wood corners, ' + r1(m.pages[0].w) + ' x ' + r1(m.pages[0].h));
  check(/^page 1$/.test(sw['Whole photo used'] || ''), 'the summary lists page 1 under Whole photo used', JSON.stringify(sw));
  await clickIn(p, 0, '.docscan-reset');

  /* rotate page 1 right, then move it below page 2 */
  await setControls(p, { pageSize: 'a4', enhance: 'colour' });
  await clickIn(p, 0, '.docscan-right');
  const turned = (await cardInfo(p))[0].status;
  check(/Turned right/.test(turned), 'the card says the page is turned right', turned);
  await press(p);
  o = await download(p);
  m = await measure(p, o.bytes, [layout(1), layout(0)]);
  const jr = judge(m.pages[0], layout(1));
  check(m.pages[0].w > m.pages[0].h && Math.abs(m.pages[0].w - 841.89) < 0.5, 'Turn right: page 1 comes out landscape A4', r1(m.pages[0].w) + ' x ' + r1(m.pages[0].h));
  check(jr.cells / jr.of > 0.95 && jr.upright && jr.id === 1, 'Turn right: the page is turned a quarter clockwise (header now at the top right, every cell where the turn puts it)', JSON.stringify(jr));
  await clickIn(p, 0, '.docscan-left');
  await clickIn(p, 0, '.docscan-down');
  const order = (await cardInfo(p)).map((c) => c.num + ':' + c.name).join(' ');
  const focusAfter = await p.evaluate(() => document.activeElement && document.activeElement.className);
  check(order === '1:scan-grey.jpg 2:scan-wood.jpg', 'Move down puts the first photo second', order);
  check(/docscan-up/.test(focusAfter || ''), 'the focus follows the moved page (its Move up button)', focusAfter);
  const shellOrder = await p.$$eval('.file-list .file-name', (l) => l.map((x) => x.textContent).join());
  check(shellOrder === 'scan-grey.jpg,scan-wood.jpg', 'the shell\'s own file list has the same order', shellOrder);
  await press(p);
  o = await download(p);
  m = await measure(p, o.bytes, [layout(0)]);
  const ids = m.pages.map((pg) => judge(pg, layout(0)).id).join();
  check(ids === '2,1', 'reordered: the PDF has photo 2 first, then photo 1, both upright again', ids);

  /* remove */
  await clickIn(p, 0, '.docscan-remove');
  await p.waitForFunction(() => document.querySelectorAll('.docscan-card').length === 1);
  check((await cardInfo(p))[0].name === 'scan-wood.jpg', 'Remove takes that photo out');

  /* cancel part-way, then run again */
  await upload(p, [ph.grey.file, ph.carpet.file], 3);
  await p.click('.pdf-run .btn-primary');
  await p.waitForFunction(() => /Straightening page/.test((document.querySelector('.pdf-progress-label') || {}).textContent || ''), { timeout: 30000, polling: 20 });
  await p.evaluate(() => document.querySelector('.pdf-progress-cancel').click());
  await p.waitForFunction(() => /Cancelled/.test(document.querySelector('.tool-io > .io-msg').textContent) && !document.querySelector('.pdf-run .btn-primary').disabled, { timeout: 30000 });
  check(true, 'Cancel stops it part-way and says Cancelled');
  await press(p);
  o = await download(p);
  m = await measure(p, o.bytes, [layout(0)]);
  check(m.n === 3, 'after a cancel the next run works (a fresh worker): 3 pages', m.n + ' pages');
  check(p.__errors.length === 0, 'no script errors on the page', p.__errors.join(' | '));
  await p.close();
}

async function flagsPart() {
  group('flags  a photo with no page, a file that is not a photo');
  const p = await open();
  const ph = await photos(p);
  await upload(p, [ph.empty.file], 1);
  const c = (await cardInfo(p))[0];
  check(c.flag && /No page edge found/.test(c.status), 'a photo of a bare table: the whole photo is used and the card says Check the corners', c.status);
  check(JSON.stringify(c.handles) === JSON.stringify([[0, 0], [100, 0], [100, 100], [0, 100]]), 'its corners sit at the photo\'s own corners', JSON.stringify(c.handles));
  await press(p);
  const st = await stats(p);
  check(/^0 of 1/.test(st['Edges found'] || '') && /^page 1$/.test(st['Whole photo used'] || ''), 'the summary says no edges were found on it and the whole photo was used', JSON.stringify(st));
  const cut = await makePhoto(p, 'cut');
  await (await p.$('.tool-io .dropzone input[type=file]')).uploadFile(cut.file);
  await settle(p, 2);
  const cc = (await cardInfo(p))[1];
  check(cc.flag && /runs off the photo/.test(cc.status) && cc.handles.some((h) => h[0] === 100 || h[0] > 99.5), 'a page running off the right of the photo: closed with the photo\'s edge, flagged Check the corners', cc.status + ' ' + JSON.stringify(cc.handles));
  await clickIn(p, 1, '.docscan-remove');
  await p.waitForFunction(() => document.querySelectorAll('.docscan-card').length === 1);
  const txt = path.join(OUT, 'notes.txt');
  fs.writeFileSync(txt, 'not a photo');
  const input = await p.$('.tool-io .dropzone input[type=file]');
  await input.uploadFile(txt);
  await p.waitForFunction(() => /not photos/.test(document.querySelector('.tool-io > .io-msg').textContent), { timeout: 10000 });
  check(true, 'a text file is turned away: "Those are not photos"');
  const broken = path.join(OUT, 'broken.jpg');
  fs.writeFileSync(broken, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]));
  await input.uploadFile(broken);
  await settle(p, 2);
  const cb = (await cardInfo(p))[1];
  check(cb.error && /^broken\.jpg: could not be opened/.test(cb.status), 'a damaged JPEG gets an error on its own card, by name', cb.status);
  const r = await press(p);
  check(r.summary && /Left out: broken\.jpg/.test(r.msg), 'the PDF is still made from the good photo and the damaged one is named as left out', r.msg);
  check(p.__errors.length === 0, 'no script errors on the page', p.__errors.join(' | '));
  await p.close();
}

async function cameraPart() {
  group('camera  the fake camera, and the fallback when there is none');
  const p = await open();
  check(await p.evaluate(() => window.__gumCalls) === 0, 'loading the page does not touch the camera');
  await p.click('.docscan-cam-start');
  await p.waitForFunction(() => { const v = document.querySelector('.docscan-camera-video'); return v && v.videoWidth > 0 && !document.querySelector('.docscan-camera-live').hidden; }, { timeout: 20000 });
  const cam = await p.evaluate(() => ({ calls: window.__gumCalls, c: window.__lastConstraints, w: document.querySelector('.docscan-camera-video').videoWidth, h: document.querySelector('.docscan-camera-video').videoHeight, focus: document.activeElement && document.activeElement.className, ic: typeof window.ImageCapture }));
  check(cam.calls === 1 && cam.c && cam.c.audio === false && cam.c.video.facingMode.ideal === 'environment', 'Use the camera asks once, for video only, preferring the rear camera', JSON.stringify(cam.c));
  check(/docscan-cam-shoot/.test(cam.focus || ''), 'the focus moves to Take the photo', cam.focus);
  note('fake camera ' + cam.w + ' x ' + cam.h + ', ImageCapture ' + cam.ic);
  await p.click('.docscan-cam-shoot');
  await settle(p, 1);
  let cards = await cardInfo(p);
  const kind = await p.evaluate(async () => {
    let n = document.querySelector('.tool-io'); while (n && !n.__pdfShell) n = n.parentElement;
    const e = n.__pdfShell.entries()[0], bm = await createImageBitmap(e.file);
    return { type: e.file.type, size: e.size, w: bm.width, h: bm.height, magic: Array.from(e.bytes.slice(0, 3)).join() };
  });
  check(cards.length === 1 && cards[0].name === 'page-1.jpg' && kind.type === 'image/jpeg' && kind.magic === '255,216,255' && !cards[0].error, 'Take the photo adds a JPEG page called page-1.jpg, which opens', cards.map((c) => c.name + ' ' + c.status).join() + ' ' + JSON.stringify(kind));
  check(kind.w * kind.h >= cam.w * cam.h, 'the photo is at least the camera view\'s full resolution', kind.w + ' x ' + kind.h + ' vs view ' + cam.w + ' x ' + cam.h);
  note('captured ' + cards[0].name + ', ' + kind.type + ', ' + kind.w + ' x ' + kind.h + ', ' + kind.size + ' bytes');
  /* Space on the focused view takes another */
  await p.focus('.docscan-camera-view');
  await p.keyboard.press('Space');
  await settle(p, 2);
  cards = await cardInfo(p);
  check(cards.length === 2 && cards[1].name === 'page-2.jpg', 'Space on the camera view takes the next page (page-2)', cards.map((c) => c.name).join());
  const count = await p.$eval('.docscan-camera-count', (e) => e.textContent);
  check(/2 pages taken/.test(count), 'the counter says 2 pages taken', count);
  const live = await p.evaluate(() => window.__streams.map((s) => s.getTracks().map((t) => t.readyState).join()).join('|'));
  check(live === 'live', 'while in use the one stream is live', live);
  await p.click('.docscan-cam-done');
  const ended = await p.evaluate(() => ({ tracks: window.__streams.map((s) => s.getTracks().map((t) => t.readyState).join()).join('|'), src: document.querySelector('.docscan-camera-video').srcObject, hidden: document.querySelector('.docscan-camera-live').hidden }));
  check(ended.tracks === 'ended' && ended.src === null && ended.hidden, 'Done stops every camera track and closes the view', JSON.stringify(ended));
  const r = await press(p);
  check(r.summary && !/is-error/.test(r.cls), 'the camera pages make a PDF', r.msg);
  const o = await download(p);
  const m = await measure(p, o.bytes, []);
  check(m.n === 2, 'pdf.js: 2 pages from 2 camera shots', m.n + ' pages');
  check(p.__errors.length === 0, 'no script errors on the page', p.__errors.join(' | '));
  shared.camera = { w: cam.w, h: cam.h, type: kind.type, size: kind.size, ic: cam.ic };
  await p.close();

  const d = await open('deny');
  await d.click('.docscan-cam-start');
  await d.waitForFunction(() => !document.querySelector('.docscan-camera-fallback').hidden, { timeout: 10000 });
  const fb = await d.evaluate(() => ({ msg: document.querySelector('.docscan-camera-msg').textContent, cap: document.querySelector('.docscan-camera-fallback input[type=file]').getAttribute('capture'), live: document.querySelector('.docscan-camera-live').hidden, focus: document.activeElement && document.activeElement.className }));
  check(/not allowed/.test(fb.msg) && fb.cap === 'environment' && fb.live && /docscan-cam-native/.test(fb.focus || ''), 'a refused camera: the page says so and offers the phone\'s camera (an input with capture="environment"), focused', JSON.stringify(fb));
  const fbIn = await d.$('.docscan-camera-fallback input[type=file]');
  await fbIn.uploadFile(SCENES.wood && shared.wood ? shared.wood.file : path.join(OUT, 'scan-wood.jpg'));
  await settle(d, 1);
  check((await cardInfo(d)).length === 1, 'a photo from that input becomes a page like any other');
  await d.close();

  const n = await open('missing');
  await n.click('.docscan-cam-start');
  await n.waitForFunction(() => !document.querySelector('.docscan-camera-fallback').hidden, { timeout: 10000 });
  const nm = await n.$eval('.docscan-camera-msg', (e) => e.textContent);
  check(/does not let pages use the camera|secure connection/.test(nm), 'no camera API at all: the same fallback, with its own reason', nm);
  await n.close();
}

async function bigPart() {
  group('big  a 4032 x 3024 photo');
  const p = await open();
  const t = Date.now();
  const big = await makePhoto(p, 'big');
  note('drew ' + SCENES.big.name + ' (' + big.bytes + ' bytes) in ' + (Date.now() - t) + ' ms');
  const t0 = Date.now();
  await upload(p, [big.file], 1);
  const tDetect = Date.now() - t0;
  const c = (await cardInfo(p))[0];
  check(/^Edges found/.test(c.status), '12 MP: the edges are found', c.status);
  await setControls(p, { pageSize: 'a4', enhance: 'colour', quality: '0.85' });
  const lt0 = await p.evaluate(() => performance.now());
  const r = await press(p);
  const longs = await p.evaluate((a, b) => window.__long.filter((e) => e.t >= a && e.t <= b).map((e) => Math.round(e.d)), lt0, r.t1);
  const st = await stats(p);
  const o = await download(p);
  const L = layout(0);
  const m = await measure(p, o.bytes, [L]);
  const j = judge(m.pages[0], L);
  check(j.cells / j.of > 0.95 && j.upright && Math.min(...j.paper) > 235, '12 MP: one upright, rectified page with white paper', JSON.stringify(j));
  check(longs.length === 0 || Math.max(...longs) < 300, '12 MP: no main-thread task of 300 ms or more while it works', 'long tasks ' + (longs.join(', ') || 'none'));
  note('upload to edges shown ' + tDetect + ' ms; ' + JSON.stringify(st) + '; ' + o.bytes.length + ' bytes');
  const mu = mupdf(savePdf('scan-12mp.pdf', o.bytes));
  if (!mu.error) check(mu.images[0] && Math.max(mu.images[0][0][0], mu.images[0][0][1]) === 2500, '12 MP: the page picture is capped at 2500 px on its long side', JSON.stringify(mu.images));
  shared.big = { detectMs: tDetect, stats: st, size: o.bytes.length, longs, mupdf: mu };
  await p.close();
}

async function noWorkerPart() {
  group('noworker  a browser with no Web Worker and no OffscreenCanvas: the same jobs on the page');
  const p = await open('noworker');
  const ph = await photos(p);
  await setControls(p, { pageSize: 'a4', enhance: 'colour', quality: '0.85' });
  await upload(p, [ph.wood.file, ph.carpet.file], 2);
  const cards = await cardInfo(p);
  check(cards.every((c) => /^Edges found/.test(c.status)), 'the edges are found on the page itself', cards.map((c) => c.status).join(' | '));
  const r = await press(p);
  const o = await download(p);
  const L = layout(0);
  const m = await measure(p, o.bytes, [L]);
  const j = m.pages.map((pg) => judge(pg, L));
  const where = await p.evaluate(() => ({ jobs: typeof window.MVRScanJobs, worker: typeof window.Worker }));
  check(r.summary && where.jobs === 'object' && where.worker === 'undefined' && m.n === 2 && j.every((x) => x.cells === 48 && x.upright && Math.min(...x.paper) > 235),
    'without a worker the page runs the jobs itself and the PDF is the same: 2 upright pages, cells right, paper white', JSON.stringify(where) + ' ' + j.map((x) => x.cells + '/' + x.upright).join(', '));
  check(p.__errors.length === 0, 'no script errors on the page', p.__errors.join(' | '));
  await p.close();
}

async function narrowPart() {
  group('narrow  390 px');
  const p = await open('', { width: 390, height: 844, isMobile: true, hasTouch: true });
  const ph = await photos(p);
  await upload(p, [ph.wood.file, ph.carpet.file], 2);
  await press(p);
  const w1 = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(w1.sw <= w1.cw, '390 px with two page cards and a result: no horizontal scroll', JSON.stringify(w1));
  await p.$eval('.docscan-cam-start', (b) => b.click());
  await p.waitForFunction(() => !document.querySelector('.docscan-camera-live').hidden, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 300));
  const w2 = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(w2.sw <= w2.cw, '390 px with the camera open: no horizontal scroll', JSON.stringify(w2));
  await p.$eval('.docscan-cam-done', (b) => b.click());
  await p.setViewport({ width: 1400, height: 1000 });
  const w3 = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(w3.sw <= w3.cw, '1400 px: no horizontal scroll', JSON.stringify(w3));
  await p.close();
}

if (require.main === module) (async () => {
  console.log('pdf-scan-to-pdf: ' + ROOT + ' on ' + BASE);
  try {
    const puppeteer = loadPuppeteer();
    const { serve } = require('./serve.js');
    server = await serve(ROOT, PORT);
    browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
      args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
    if (want('page')) await pagePart();
    if (want('edit')) await editPart();
    if (want('flags')) await flagsPart();
    if (want('camera')) await cameraPart();
    if (want('big')) await bigPart();
    if (want('narrow')) await narrowPart();
    if (want('noworker')) await noWorkerPart();
    const foreign = [...hosts].filter((h) => !/^127\.0\.0\.1(:\d+)?$/.test(h));
    check(!foreign.length, 'no request left 127.0.0.1', foreign.join(', ') || [...hosts].join(', '));
    fs.writeFileSync(path.join(OUT, 'figures.json'), JSON.stringify(shared, (k, v) => (k === 'file' ? undefined : v), 2));
    note('figures: ' + path.join(OUT, 'figures.json'));
  } catch (e) {
    console.error('\nthe run broke: ' + (e && e.stack || e));
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
  if (browser) await browser.close();
  if (server) server.close();
  console.log('\n' + (pass + fail) + ' assertions   ' + pass + ' passed   ' + fail + ' failed');
  if (fail) { console.log('\nFailures:\n  ' + failures.join('\n  ')); process.exit(2); }
})();

module.exports = { drawScene, withOrientation, SCENES, layout, judge, measure, CSS };
