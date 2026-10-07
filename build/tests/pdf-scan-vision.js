/**
 * Scan to PDF's image engine, proved on synthetic photos.
 *
 *   node build/tests/pdf-scan-vision.js [--quick] [--dump <dir>]
 *
 * Runs engine/pdf-scan-vision.js in Node. Every scene is drawn here, by
 * this file's own code and never by the module: an A4 page (text-like ink
 * blocks, two ruled lines, a checkerboard) is placed in 3-D, tilted and
 * turned, and photographed by a pinhole camera onto a background (wood with
 * planks, a mid-grey table, a light-grey table, a dark carpet), with sensor
 * noise and a soft shadow across part of the frame. Because the scene is
 * drawn from a known camera, the page's true corners are known exactly.
 *
 *   1  helpers: orderCorners, homography, rotate90, downscale, warp of the
 *      full rectangle, suggestSize on the exact corners (A4 found through
 *      the perspective)
 *   2  detection, per scene: every corner within max(6 px, 1.5% of the
 *      diagonal) of the truth; scenes without a page give the fallback
 *   3  warp of the detected quad: checkerboard cells right (> 95%), ruled
 *      lines straight, aspect ratio close to A4
 *   4  enhance on a shadowed page: paper evened out and white, ink dark;
 *      'bw' gives pure black and white, paper white inside the shadow too
 *   5  timing on a 4000 x 3000 photo (skipped with --quick)
 *
 * --dump <dir> writes each scene and its warp as .ppm files for a look.
 * Exit code 2 when an assertion fails, 1 when the run itself breaks.
 */
'use strict';
var path = require('path');
var fs = require('fs');

var V = require(path.join(__dirname, '..', '..', 'engine', 'pdf-scan-vision.js'));

var args = process.argv.slice(2);
var QUICK = args.indexOf('--quick') >= 0;
var DUMP = args.indexOf('--dump') >= 0 ? args[args.indexOf('--dump') + 1] : null;
if (DUMP) fs.mkdirSync(DUMP, { recursive: true });

var total = 0, passed = 0, failed = 0;
function check(ok, what, detail) {
  total++;
  if (ok) { passed++; return true; }
  failed++;
  console.log('  FAIL  ' + what + (detail ? '  (' + detail + ')' : ''));
  return false;
}
function section(t) { console.log('\n' + t); }
function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }

// ---------------------------------------------------------------- drawing

function rng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussFn(r) {
  var spare = null;
  return function () {
    if (spare !== null) { var s = spare; spare = null; return s; }
    var u = r() || 1e-12, v = r(), m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  };
}
function hash2(x, y, seed) {
  var h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, seed) {
  var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
function smoothstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// The page, in millimetres, centred: u across (-105..105), v down (-148.5..148.5).
var PW = 210, PH = 297;
var INK = [32, 32, 40], CHECK_INK = [26, 26, 26];
var CHECK = { u0: -40, v0: 72, cols: 8, rows: 6, cell: 10 };
var HRULE = { v0: 64, v1: 64.8, u0: -90, u1: 90 };
var VRULE = { u0: -96, u1: -95.2, v0: -130, v1: 130 };
var TEXT = { v0: -125, pitch: 7, height: 3.2, lines: 25 };
var WORDS = (function () {
  var r = rng(99), lines = [];
  for (var li = 0; li < TEXT.lines; li++) {
    var u = -85, ws = [];
    var end = li % 6 === 5 ? 20 : 85;          // short last line of a paragraph
    while (u < end - 4) { var wd = 6 + r() * 22, e = Math.min(u + wd, end); ws.push([u, e]); u = e + 3; }
    lines.push(ws);
  }
  return lines;
}());

// Returns 0 paper, 1 text ink, 2 check ink, 3 rule ink; -1 off the page.
function pageKind(u, v) {
  if (u < -PW / 2 || u >= PW / 2 || v < -PH / 2 || v >= PH / 2) return -1;
  if (u >= CHECK.u0 && u < CHECK.u0 + CHECK.cols * CHECK.cell && v >= CHECK.v0 && v < CHECK.v0 + CHECK.rows * CHECK.cell) {
    var ci = Math.floor((u - CHECK.u0) / CHECK.cell), cj = Math.floor((v - CHECK.v0) / CHECK.cell);
    return (ci + cj) % 2 === 0 ? 2 : 0;
  }
  if (v >= HRULE.v0 && v < HRULE.v1 && u >= HRULE.u0 && u < HRULE.u1) return 3;
  if (u >= VRULE.u0 && u < VRULE.u1 && v >= VRULE.v0 && v < VRULE.v1) return 3;
  if (v >= TEXT.v0 && v < TEXT.v0 + TEXT.lines * TEXT.pitch) {
    var li = Math.floor((v - TEXT.v0) / TEXT.pitch);
    if (v - TEXT.v0 - li * TEXT.pitch < TEXT.height) {
      var ws = WORDS[li];
      for (var k = 0; k < ws.length; k++) if (u >= ws[k][0] && u < ws[k][1]) return 1;
    }
  }
  return 0;
}
function wordId(u, v) {
  var li = Math.floor((v - TEXT.v0) / TEXT.pitch), ws = WORDS[li];
  for (var k = 0; k < ws.length; k++) if (u >= ws[k][0] && u < ws[k][1]) return li * 100 + k;
  return -1;
}

function background(kind, x, y, W, H, seed) {
  var X = x * 1200 / Math.max(W, H), Y = y * 1200 / Math.max(W, H);
  if (kind === 'wood') {
    var g = Math.sin(0.05 * (X * 0.95 + Y * 0.31) + 2.2 * Math.sin(0.013 * Y - 0.004 * X) + 1.3 * Math.sin(0.031 * X + 0.6 * valueNoise(X / 40, Y / 40, seed)));
    var plank = Math.floor((X * 0.31 - Y * 0.95 + 4000) / 170);
    var tint = (hash2(plank, 7, seed) - 0.5) * 16 + (valueNoise(X / 25, Y / 90, seed + 3) - 0.5) * 20;
    return [104 + 22 * g + tint, 66 + 15 * g + tint * 0.6, 38 + 8 * g + tint * 0.3];
  }
  if (kind === 'grey') {
    var vg = 128 - 14 * (Math.pow((X - 600) / 700, 2) + Math.pow((Y - 450) / 700, 2));
    return [vg, vg, vg + 3];
  }
  if (kind === 'light') {
    var lg = 204 - 10 * (Math.pow((X - 600) / 800, 2) + Math.pow((Y - 450) / 800, 2)) + 4 * (valueNoise(X / 120, Y / 120, seed) - 0.5);
    return [lg, lg, lg - 3];
  }
  if (kind === 'carpet') {
    var n = 0.6 * valueNoise(X / 6, Y / 6, seed) + 0.4 * valueNoise(X / 30, Y / 30, seed + 1);
    return [40 + 60 * n, 46 + 50 * n, 70 + 45 * n];
  }
  // 'gradient': nothing but a smooth wall-like gradient
  var gg = 90 + 80 * (X / 1200) + 20 * Math.sin(Y / 300);
  return [gg, gg - 4, gg - 10];
}

function rotMat(rollDeg, tiltXDeg, tiltYDeg) {
  var c = Math.cos, s = Math.sin, r = rollDeg * Math.PI / 180, a = tiltXDeg * Math.PI / 180, b = tiltYDeg * Math.PI / 180;
  var Rz = [[c(r), -s(r), 0], [s(r), c(r), 0], [0, 0, 1]];
  var Rx = [[1, 0, 0], [0, c(a), -s(a)], [0, s(a), c(a)]];
  var Ry = [[c(b), 0, s(b)], [0, 1, 0], [-s(b), 0, c(b)]];
  function mul(A, B) { var M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) for (var k = 0; k < 3; k++) M[i][j] += A[i][k] * B[k][j]; return M; }
  return mul(Rz, mul(Rx, Ry));
}
function inv3(m) {
  var a = m[0][0], b = m[0][1], c = m[0][2], d = m[1][0], e = m[1][1], f = m[1][2], g = m[2][0], h = m[2][1], i = m[2][2];
  var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
          [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
          [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
function apply3(M, x, y) { var z = M[2][0] * x + M[2][1] * y + M[2][2]; return [(M[0][0] * x + M[0][1] * y + M[0][2]) / z, (M[1][0] * x + M[1][1] * y + M[1][2]) / z]; }

// Pinhole camera, principal point at the image centre.
function sceneGeometry(sc) {
  var W = sc.W, H = sc.H, f = (sc.focal || 0.78) * Math.max(W, H);   // a 26 mm-equivalent phone lens
  var R = rotMat(sc.roll || 0, sc.tiltX || 0, sc.tiltY || 0);
  var tz = f * PH / ((sc.fill || 0.7) * H);
  var T = [(sc.dx || 0) * W * tz / f, (sc.dy || 0) * H * tz / f, tz];
  var cx = W / 2, cy = H / 2;
  var G = [
    [f * R[0][0] + cx * R[2][0], f * R[0][1] + cx * R[2][1], f * T[0] + cx * T[2]],
    [f * R[1][0] + cy * R[2][0], f * R[1][1] + cy * R[2][1], f * T[1] + cy * T[2]],
    [R[2][0], R[2][1], T[2]]
  ];
  return { G: G, Gi: inv3(G), corners: [[-PW / 2, -PH / 2], [PW / 2, -PH / 2], [PW / 2, PH / 2], [-PW / 2, PH / 2]].map(function (p) { return apply3(G, p[0], p[1]); }) };
}

function shadowFactor(sh, x, y, W, H) {
  if (!sh) return 1;
  var a = sh.angle * Math.PI / 180, t = ((x - W / 2) * Math.cos(a) + (y - H / 2) * Math.sin(a)) / Math.hypot(W, H);
  return 1 - sh.depth * smoothstep(sh.from, sh.to, t);
}

// Objects in the photo: { shape: 'rect' | 'ellipse', x, y (centre, as a
// fraction of width and height), w, h (as a fraction of the shorter side),
// angle (degrees), colour, over (true: on top of the page, like a thumb) }.
function objectAt(objs, over, px, py, W, H) {
  if (!objs) return null;
  var m = Math.min(W, H);
  for (var k = 0; k < objs.length; k++) {
    var o = objs[k];
    if (!!o.over !== over) continue;
    var a = (o.angle || 0) * Math.PI / 180, dx = px - o.x * W, dy = py - o.y * H;
    var u = (dx * Math.cos(a) + dy * Math.sin(a)) / (o.w * m / 2), v = (-dx * Math.sin(a) + dy * Math.cos(a)) / (o.h * m / 2);
    if (o.shape === 'ellipse' ? u * u + v * v <= 1 : (Math.abs(u) <= 1 && Math.abs(v) <= 1)) return o.colour;
  }
  return null;
}

// Separable Gaussian on a float RGB buffer (the camera's softness).
function blurRGB(buf, W, H, sigma) {
  var r = Math.ceil(sigma * 3), k = [], s = 0, i, x, y, c, j;
  for (i = -r; i <= r; i++) { k.push(Math.exp(-i * i / (2 * sigma * sigma))); s += k[i + r]; }
  k = k.map(function (v) { return v / s; });
  var tmp = new Float32Array(buf.length);
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) for (c = 0; c < 3; c++) {
    var a = 0;
    for (j = -r; j <= r; j++) a += k[j + r] * buf[(y * W + Math.min(W - 1, Math.max(0, x + j))) * 3 + c];
    tmp[(y * W + x) * 3 + c] = a;
  }
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) for (c = 0; c < 3; c++) {
    var b = 0;
    for (j = -r; j <= r; j++) b += k[j + r] * tmp[(Math.min(H - 1, Math.max(0, y + j)) * W + x) * 3 + c];
    buf[(y * W + x) * 3 + c] = b;
  }
}

function renderScene(sc) {
  var W = sc.W, H = sc.H, img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  var geo = sc.page === false ? null : sceneGeometry(sc), Gi = geo && geo.Gi;
  var paper = sc.paper || [246, 246, 243];
  var objects = sc.objects || [];
  if (sc.thumbAt && geo) {
    // a thumb holding the page, centred on a point given in page millimetres
    var tp = apply3(geo.G, sc.thumbAt[0], sc.thumbAt[1]);
    objects = objects.concat([{ shape: 'ellipse', x: tp[0] / W, y: tp[1] / H, w: 0.13, h: 0.21, angle: sc.thumbAngle || 20, colour: [212, 158, 128], over: true }]);
  }
  var gauss = gaussFn(rng(sc.seed || 1)), sigma = sc.noise == null ? 5 : sc.noise;
  var ss = sc.ss || 2, offs = [];
  for (var a = 0; a < ss; a++) offs.push((a + 0.5) / ss);
  var buf = new Float32Array(W * H * 3), i = 0;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++, i += 3) {
      var r = 0, g = 0, b = 0;
      for (var sy = 0; sy < ss; sy++) {
        for (var sx = 0; sx < ss; sx++) {
          var px = x + offs[sx], py = y + offs[sy], col = objectAt(objects, true, px, py, W, H);
          if (!col && Gi) {
            var uv = apply3(Gi, px, py), k = pageKind(uv[0], uv[1]);
            if (k === 0) col = paper; else if (k === 1 || k === 3) col = INK; else if (k === 2) col = CHECK_INK;
          }
          if (!col) col = objectAt(objects, false, px, py, W, H) || background(sc.bg, px, py, W, H, sc.seed || 1);
          r += col[0]; g += col[1]; b += col[2];
        }
      }
      var n = ss * ss, sf = shadowFactor(sc.shadow, x + 0.5, y + 0.5, W, H);
      buf[i] = r / n * sf; buf[i + 1] = g / n * sf; buf[i + 2] = b / n * sf;
    }
  }
  var blur = sc.blur == null ? 0.8 : sc.blur;
  if (blur > 0) blurRGB(buf, W, H, blur);
  var d = img.data;
  for (i = 0; i < W * H; i++) {
    var nz = gauss() * sigma;
    d[i * 4] = buf[i * 3] + nz + gauss() * 1.5;
    d[i * 4 + 1] = buf[i * 3 + 1] + nz + gauss() * 1.5;
    d[i * 4 + 2] = buf[i * 3 + 2] + nz + gauss() * 1.5;
    d[i * 4 + 3] = 255;
  }
  return { img: img, geo: geo };
}

function writePPM(file, img) {
  var head = Buffer.from('P6\n' + img.width + ' ' + img.height + '\n255\n'), body = Buffer.alloc(img.width * img.height * 3);
  for (var i = 0, j = 0; i < img.width * img.height * 4; i += 4, j += 3) { body[j] = img.data[i]; body[j + 1] = img.data[i + 1]; body[j + 2] = img.data[i + 2]; }
  fs.writeFileSync(file, Buffer.concat([head, body]));
}

function lumOf(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }

// Polygon clipped to x <= X (Sutherland–Hodgman, one edge).
function clipRight(poly, X) {
  var out = [];
  for (var i = 0; i < poly.length; i++) {
    var P = poly[i], Q = poly[(i + 1) % poly.length], pin = P[0] <= X, qin = Q[0] <= X;
    if (pin) out.push(P);
    if (pin !== qin) { var t = (X - P[0]) / (Q[0] - P[0]); out.push([X, P[1] + t * (Q[1] - P[1])]); }
  }
  return out;
}

// ------------------------------------------------------------------ 1 helpers

section('1  helpers');
(function () {
  var pts = [[310, 40], [20, 30], [300, 400], [30, 380]];
  var o = V.orderCorners(pts);
  check(JSON.stringify(o) === JSON.stringify([[20, 30], [310, 40], [300, 400], [30, 380]]), 'orderCorners puts shuffled points in TL, TR, BR, BL order', JSON.stringify(o));
  var rot = [[200, 0], [400, 200], [200, 400], [0, 200]].map(function (p) { return [p[0] + 0.1 * p[1], p[1]]; });
  var o2 = V.orderCorners([rot[2], rot[0], rot[3], rot[1]]);
  var cyc = o2.map(function (p) { return Math.atan2(p[1] - 200, p[0] - 220); });
  var cw = true;
  for (var k = 0; k < 4; k++) { var dd = cyc[(k + 1) % 4] - cyc[k]; if (dd < 0) dd += 2 * Math.PI; if (dd > Math.PI) cw = false; }
  check(cw, 'orderCorners keeps a near-45-degree diamond clockwise');
  check(V.orderCorners([{ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 5 }])[0].join() === '0,0', 'orderCorners accepts {x, y} points');

  var src = [[0, 0], [100, 0], [100, 50], [0, 50]], dst = [[10, 20], [200, 5], [220, 180], [0, 160]];
  var h = V.homography(src, dst), worst = 0;
  for (var j = 0; j < 4; j++) { var m = V.applyHomography(h, src[j][0], src[j][1]); worst = Math.max(worst, Math.hypot(m[0] - dst[j][0], m[1] - dst[j][1])); }
  check(worst < 1e-6, 'homography maps the four points exactly', worst);

  // rotate90
  var im = { width: 3, height: 2, data: new Uint8ClampedArray(24) };
  for (var p = 0; p < 6; p++) { im.data[p * 4] = p; im.data[p * 4 + 3] = 255; }
  var r1 = V.rotate90(im, 1);
  check(r1.width === 2 && r1.height === 3, 'rotate90 by one turn swaps width and height');
  // source row 0 = 0 1 2, row 1 = 3 4 5; clockwise -> rows: [3 0] [4 1] [5 2]
  var got = []; for (p = 0; p < 6; p++) got.push(r1.data[p * 4]);
  check(got.join() === '3,0,4,1,5,2', 'rotate90 by one turn is clockwise', got.join());
  var r3 = V.rotate90(im, -1), got3 = []; for (p = 0; p < 6; p++) got3.push(r3.data[p * 4]);
  check(got3.join() === '2,5,1,4,0,3', 'rotate90 by -1 turns anticlockwise', got3.join());
  var r4 = V.rotate90(V.rotate90(V.rotate90(V.rotate90(im, 1), 1), 1), 1);
  check(Buffer.compare(Buffer.from(r4.data), Buffer.from(im.data)) === 0, 'four quarter turns give the original back');
  check(V.rotate90(im, 2).data[0] === 5, 'a half turn puts the last pixel first');

  // downscale
  var big = { width: 1000, height: 400, data: new Uint8ClampedArray(1000 * 400 * 4).fill(200) };
  var sm = V.downscale(big, 250);
  check(sm.width === 250 && sm.height === 100 && sm.data[0] === 200, 'downscale keeps the aspect and the level', sm.width + 'x' + sm.height);
  check(V.downscale(big, 2000) === big, 'downscale returns the input when it already fits');

  // warp of the full rectangle at the same size is the identity
  var sc = renderScene({ W: 160, H: 120, bg: 'carpet', page: false, noise: 0, ss: 1, seed: 4 });
  var wi = V.warp(sc.img, [[0, 0], [160, 0], [160, 120], [0, 120]], 160, 120), md = 0;
  for (p = 0; p < 160 * 120 * 4; p++) if ((p & 3) !== 3) md = Math.max(md, Math.abs(wi.data[p] - sc.img.data[p]));
  check(md <= 1, 'warp of the full rectangle is the identity', 'max diff ' + md);

  // suggestSize on exact corners (true perspective) finds A4
  var geos = [
    { W: 1200, H: 900, roll: 0, tiltX: 35, tiltY: 0 }, { W: 1200, H: 900, roll: 20, tiltX: 30, tiltY: -25 },
    { W: 900, H: 1200, roll: -10, tiltX: 0, tiltY: 40 }, { W: 1200, H: 900, roll: 5, tiltX: 2, tiltY: 1 },
    { W: 1200, H: 900, roll: -15, tiltX: 30, tiltY: 25, focal: 1.4 }   // a long lens, measured not assumed
  ];
  geos.forEach(function (g, gi) {
    g.fill = 0.6;
    var c = sceneGeometry(g).corners, s = V.suggestSize(c, { imageWidth: g.W, imageHeight: g.H });
    var s0 = V.suggestSize(c, { imageWidth: g.W, imageHeight: g.H, snap: false });
    check(s.snapped === 'A4' && Math.abs(s0.ratio / (210 / 297) - 1) < 0.01, 'suggestSize recovers A4 through the perspective, geometry ' + (gi + 1),
      'ratio ' + s0.ratio.toFixed(4) + ' ' + s0.method + ' snapped ' + s.snapped);
  });
  var plain = V.suggestSize([[0, 0], [210, 0], [210, 297], [0, 297]]);
  check(plain.snapped === 'A4' && plain.width === 210 && plain.height === 297, 'suggestSize without the photo size uses the side lengths', JSON.stringify(plain));
  var letter = V.suggestSize([[0, 0], [1100, 0], [1100, 850], [0, 850]]);
  check(letter.snapped === 'Letter' && letter.width > letter.height, 'suggestSize snaps a landscape Letter page', JSON.stringify(letter));
  var odd = V.suggestSize([[0, 0], [500, 0], [500, 500], [0, 500]]);
  check(odd.snapped === null && odd.width === 500 && odd.height === 500, 'suggestSize leaves a square alone');
}());

// ---------------------------------------------------------------- 2 detection

var SCENES = [
  { name: 'wood, straight, shadow', W: 1200, H: 900, bg: 'wood', roll: 0, tiltX: 8, fill: 0.8, shadow: { angle: 0, from: 0.05, to: 0.3, depth: 0.35 }, seed: 11 },
  { name: 'wood, turned 15', W: 1200, H: 900, bg: 'wood', roll: 15, tiltX: 10, tiltY: -6, fill: 0.72, seed: 12 },
  { name: 'wood, turned 40', W: 1200, H: 900, bg: 'wood', roll: 40, tiltX: 5, fill: 0.6, seed: 13 },
  { name: 'grey, strong perspective', W: 1200, H: 900, bg: 'grey', roll: 5, tiltX: 40, tiltY: 10, fill: 0.85, seed: 14 },
  { name: 'light grey, low contrast', W: 1200, H: 900, bg: 'light', paper: [238, 237, 233], roll: -10, tiltX: 12, fill: 0.72, noise: 4, seed: 15 },
  { name: 'grey, page runs off the right', W: 1200, H: 900, bg: 'grey', roll: 3, tiltX: 8, fill: 0.8, dx: 0.36, cut: true, seed: 16 },
  { name: 'wood, off-white, deep shadow', W: 1200, H: 900, bg: 'wood', paper: [238, 232, 214], roll: -6, tiltX: 15, fill: 0.78, shadow: { angle: 30, from: -0.1, to: 0.15, depth: 0.5 }, seed: 17 },
  { name: 'light grey, turned 25, perspective', W: 1200, H: 900, bg: 'light', paper: [240, 240, 236], roll: 25, tiltX: 30, tiltY: -20, fill: 0.72, noise: 4, seed: 18 },
  { name: 'carpet, portrait photo', W: 900, H: 1200, bg: 'carpet', roll: -20, tiltX: 18, fill: 0.62, shadow: { angle: 200, from: 0.0, to: 0.3, depth: 0.4 }, seed: 19 },
  { name: 'grey, turned -40, side tilt', W: 1200, H: 900, bg: 'grey', roll: -40, tiltY: 25, fill: 0.6, seed: 20 },
  { name: 'wood, thumb on an edge, phone beside, soft focus', W: 1200, H: 900, bg: 'wood', roll: 8, tiltX: 15, fill: 0.72, dx: 0.08, blur: 1.6, noise: 6, thumbAt: [108, -40],
    objects: [{ shape: 'rect', x: 0.17, y: 0.5, w: 0.24, h: 0.5, angle: -10, colour: [28, 28, 32] }], seed: 24 },
  { name: 'grey, thumb over a corner, a card beside', W: 1200, H: 900, bg: 'grey', roll: -12, tiltX: 20, tiltY: 8, fill: 0.7, dx: -0.1, thumbAt: [100, -146], thumbAngle: -30,
    objects: [{ shape: 'rect', x: 0.85, y: 0.7, w: 0.3, h: 0.19, angle: 15, colour: [236, 236, 230] }], seed: 25 },
  { name: 'light grey, only 10 levels of contrast', W: 1200, H: 900, bg: 'light', paper: [214, 214, 212], roll: 8, tiltX: 12, fill: 0.7, noise: 4, seed: 41 },
  { name: 'grey, small page, heavy noise', W: 1200, H: 900, bg: 'grey', roll: 10, tiltX: 10, fill: 0.32, noise: 12, seed: 44 },
  { name: 'page darker than a white desk', W: 1200, H: 900, bg: 'light', paper: [175, 175, 170], roll: -8, tiltX: 12, fill: 0.7, noise: 4, seed: 42 },
  { name: 'no page: wood', W: 1200, H: 900, bg: 'wood', page: false, seed: 21 },
  { name: 'no page: plain gradient', W: 1200, H: 900, bg: 'gradient', page: false, seed: 22 },
  { name: 'no page: carpet', W: 1200, H: 900, bg: 'carpet', page: false, seed: 23 }
];

section('2  detection (tolerance max(6 px, 1.5% of the diagonal))');
var detected = [];
SCENES.forEach(function (sc) {
  var r = renderScene(sc), W = sc.W, H = sc.H, tol = Math.max(6, 0.015 * Math.hypot(W, H));
  var t0 = Date.now(), det = V.detectQuad(r.img), ms = Date.now() - t0;
  if (DUMP) writePPM(path.join(DUMP, sc.name.replace(/[^a-z0-9]+/gi, '-') + '.ppm'), r.img);
  if (sc.page === false) {
    var full = det.quad.map(function (p) { return p.join(); }).join(' ');
    check(det.method === 'fallback' && det.confidence === 0 && full === '0,0 ' + W + ',0 ' + W + ',' + H + ' 0,' + H,
      sc.name + ': falls back to the whole photo', det.method + ' conf ' + det.confidence + ' ' + JSON.stringify(det.quad.map(function (p) { return p.map(Math.round); })));
    console.log('  ' + sc.name + ': ' + det.method + ', confidence ' + det.confidence + ', ' + ms + ' ms');
    return;
  }
  var truth = r.geo.corners;
  if (!sc.cut) {
    truth.forEach(function (p) { if (p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H) throw new Error('scene ' + sc.name + ' does not fit'); });
  } else {
    truth = clipRight(truth, W);
    if (truth.length !== 4) throw new Error('cut scene does not clip to four corners');
    truth = V.orderCorners(truth);
  }
  var errs = det.quad.map(function (p, k) { return Math.hypot(p[0] - truth[k][0], p[1] - truth[k][1]); });
  var worst = Math.max.apply(null, errs);
  check(det.method !== 'fallback', sc.name + ': a page is found', det.method);
  check(worst <= tol, sc.name + ': every corner within ' + f1(tol) + ' px', 'errors ' + errs.map(f1).join(', '));
  if (sc.cut) check(det.method === 'lines+border', sc.name + ': the photo edge closes the quad', det.method);
  console.log('  ' + sc.name + ': corner errors ' + errs.map(f1).join(' / ') + ' px (worst ' + f1(worst) + ', ' + f1(100 * worst / Math.hypot(W, H)) + '% of diag), confidence ' + det.confidence + ', ' + det.method + ', ' + ms + ' ms');
  detected.push({ sc: sc, r: r, det: det });
});

// ---------------------------------------------------------------- 3 warp

section('3  warp of the detected quad');
detected.forEach(function (o) {
  var sc = o.sc;
  if (sc.cut) return;
  var size = V.suggestSize(o.det.quad, { imageWidth: sc.W, imageHeight: sc.H });
  var sizeFree = V.suggestSize(o.det.quad, { imageWidth: sc.W, imageHeight: sc.H, snap: false });
  var out = V.warp(o.r.img, o.det.quad, size.width, size.height);
  if (DUMP) writePPM(path.join(DUMP, sc.name.replace(/[^a-z0-9]+/gi, '-') + '-warp.ppm'), out);
  var oW = out.width, oH = out.height, d = out.data;
  function toOut(u, v) { return [(u + PW / 2) / PW * oW, (v + PH / 2) / PH * oH]; }
  function meanAt(x, y, r) {
    var s = 0, n = 0;
    for (var yy = Math.round(y) - r; yy <= Math.round(y) + r; yy++) for (var xx = Math.round(x) - r; xx <= Math.round(x) + r; xx++) {
      if (xx < 0 || yy < 0 || xx >= oW || yy >= oH) continue;
      s += lumOf(d, (yy * oW + xx) * 4); n++;
    }
    return s / n;
  }
  // checkerboard
  var samples = [], lo = 255, hi = 0, ci, cj;
  for (cj = 0; cj < CHECK.rows; cj++) for (ci = 0; ci < CHECK.cols; ci++) {
    var c = toOut(CHECK.u0 + (ci + 0.5) * CHECK.cell, CHECK.v0 + (cj + 0.5) * CHECK.cell);
    var m = meanAt(c[0], c[1], Math.max(1, Math.round(oW / PW)));
    samples.push({ m: m, dark: (ci + cj) % 2 === 0 });
    lo = Math.min(lo, m); hi = Math.max(hi, m);
  }
  var thr = (lo + hi) / 2, right = samples.filter(function (s) { return (s.m < thr) === s.dark; }).length;
  check(right / samples.length > 0.95, sc.name + ': checkerboard cells right after the warp', right + '/' + samples.length);
  // ruled lines straight
  var pxmm = oW / PW, win = Math.round(4 * pxmm);
  function straightness(horizontal) {
    var xs = [], ys = [];
    for (var s = 0; s <= 60; s++) {
      var along = horizontal ? HRULE.u0 + 5 + (HRULE.u1 - HRULE.u0 - 10) * s / 60 : VRULE.v0 + 5 + (VRULE.v1 - VRULE.v0 - 10) * s / 60;
      var e = horizontal ? toOut(along, (HRULE.v0 + HRULE.v1) / 2) : toOut((VRULE.u0 + VRULE.u1) / 2, along);
      var sw = 0, sp = 0, base = 0, k, vals = [];
      for (k = -win; k <= win; k++) {
        var px = horizontal ? Math.round(e[0]) : Math.round(e[0]) + k, py = horizontal ? Math.round(e[1]) + k : Math.round(e[1]);
        var val = (px < 0 || py < 0 || px >= oW || py >= oH) ? 255 : lumOf(d, (py * oW + px) * 4);
        vals.push(val); base = Math.max(base, val);
      }
      for (k = 0; k < vals.length; k++) { var wgt = Math.max(0, base - vals[k] - 0.35 * (base - Math.min.apply(null, vals))); sw += wgt; sp += wgt * (k - win); }
      if (sw <= 0) continue;
      xs.push(horizontal ? e[0] : e[1]); ys.push((horizontal ? e[1] : e[0]) + sp / sw);
    }
    var n = xs.length, mx = 0, my = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    for (i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
    var b = sxy / sxx, worst = 0;
    for (i = 0; i < n; i++) worst = Math.max(worst, Math.abs(ys[i] - (my + b * (xs[i] - mx))));
    return { worst: worst, slopeDeg: Math.atan(b) * 180 / Math.PI, n: n };
  }
  var hs = straightness(true), vs = straightness(false);
  check(hs.n > 50 && hs.worst < 1.5 && Math.abs(hs.slopeDeg) < 1, sc.name + ': the horizontal rule stays straight and level', 'max dev ' + f1(hs.worst) + ' px, slope ' + hs.slopeDeg.toFixed(2) + ' deg');
  check(vs.n > 50 && vs.worst < 1.5 && Math.abs(vs.slopeDeg) < 1, sc.name + ': the vertical rule stays straight and upright', 'max dev ' + f1(vs.worst) + ' px, slope ' + vs.slopeDeg.toFixed(2) + ' deg');
  var aerr = Math.abs(sizeFree.ratio / (PW / PH) - 1);
  check(aerr < 0.05, sc.name + ': aspect ratio within 5% of A4', 'estimated ' + sizeFree.ratio.toFixed(4) + ' (' + sizeFree.method + ')');
  console.log('  ' + sc.name + ': ' + out.width + 'x' + out.height + ', cells ' + right + '/48, rules dev ' + f1(hs.worst) + '/' + f1(vs.worst) + ' px, aspect ' + sizeFree.ratio.toFixed(4) + ' (' + f1(100 * aerr) + '% off, ' + sizeFree.method + '), snapped ' + size.snapped);
});

// ---------------------------------------------------------------- 4 enhance

section('4  enhance on a shadowed page');
(function () {
  var W = 840, H = 1188, pxmm = W / PW;   // 4 px per mm, the page filling the frame
  var paper = [240, 235, 222], sh = { angle: 20, from: -0.05, to: 0.25, depth: 0.45 };
  var gauss = gaussFn(rng(5)), img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  var kind = new Int8Array(W * H), paperMask = new Uint8Array(W * H), inkMask = new Int32Array(W * H).fill(-1), shade = new Float32Array(W * H);
  var x, y, i, p;
  function uvOf(px, py) { return [px / pxmm - PW / 2, py / pxmm - PH / 2]; }
  for (y = 0, p = 0; y < H; y++) for (x = 0; x < W; x++, p++) {
    var r = 0, g = 0, b = 0;
    for (var sy = 0; sy < 2; sy++) for (var sx = 0; sx < 2; sx++) {
      var uv = uvOf(x + 0.25 + 0.5 * sx, y + 0.25 + 0.5 * sy), k = pageKind(uv[0], uv[1]);
      var col = k === 0 ? paper : (k === 2 ? CHECK_INK : INK);
      r += col[0]; g += col[1]; b += col[2];
    }
    var c = uvOf(x + 0.5, y + 0.5), kc = pageKind(c[0], c[1]);
    kind[p] = kc;
    var sf = shadowFactor(sh, x + 0.5, y + 0.5, W, H), nz = gauss() * 5;
    shade[p] = sf;
    img.data[p * 4] = r / 4 * sf + nz; img.data[p * 4 + 1] = g / 4 * sf + nz; img.data[p * 4 + 2] = b / 4 * sf + nz; img.data[p * 4 + 3] = 255;
    // paper at least 1 mm from any ink; ink at least 0.6 mm inside a word
    var clear = kc === 0, solid = kc === 1;
    for (var a = -1; a <= 1; a++) for (var bb = -1; bb <= 1; bb++) {
      if (clear && pageKind(c[0] + a, c[1] + bb) !== 0) clear = false;
      if (solid && pageKind(c[0] + 0.6 * a, c[1] + 0.6 * bb) !== 1) solid = false;
    }
    paperMask[p] = clear ? 1 : 0;
    if (solid) inkMask[p] = wordId(c[0], c[1]);
  }
  var before = Buffer.from(img.data);
  function stats(im) {
    var s = 0, q = 0, n = 0, words = {}, maxWord = 0;
    for (p = 0; p < W * H; p++) {
      var l = lumOf(im.data, p * 4);
      if (paperMask[p]) { s += l; q += l * l; n++; }
      if (inkMask[p] >= 0) { var w = words[inkMask[p]] || (words[inkMask[p]] = [0, 0]); w[0] += l; w[1]++; }
    }
    Object.keys(words).forEach(function (k) { maxWord = Math.max(maxWord, words[k][0] / words[k][1]); });
    var m = s / n;
    return { mean: m, sd: Math.sqrt(q / n - m * m), maxWord: maxWord, words: Object.keys(words).length };
  }
  var st0 = stats(img);
  console.log('  input: paper mean ' + f1(st0.mean) + ', sd ' + f1(st0.sd) + '; darkest word mean ' + f1(st0.maxWord) + ' over ' + st0.words + ' words');
  ['colour', 'grey'].forEach(function (mode) {
    var t0 = Date.now(), e = V.enhance(img, mode), ms = Date.now() - t0, st = stats(e);
    check(st.sd <= st0.sd / 2, mode + ': paper sd at least halved', f1(st0.sd) + ' -> ' + f1(st.sd));
    check(st.mean > 235, mode + ': paper mean above 235', f1(st.mean));
    check(st.maxWord < 90, mode + ': every word stays dark (< 90)', 'lightest word mean ' + f1(st.maxWord));
    if (mode === 'grey') {
      var grey = true;
      for (i = 0; i < W * H * 4; i += 4) if (e.data[i] !== e.data[i + 1] || e.data[i] !== e.data[i + 2]) { grey = false; break; }
      check(grey, 'grey: R = G = B everywhere');
    }
    console.log('  ' + mode + ': paper mean ' + f1(st.mean) + ', sd ' + f1(st.sd) + '; lightest word ' + f1(st.maxWord) + '; ' + ms + ' ms');
  });
  var t1 = Date.now(), bw = V.enhance(img, 'bw'), msb = Date.now() - t1;
  var binary = true, inkN = 0, inkBlack = 0, papN = 0, papWhite = 0, shN = 0, shWhite = 0;
  for (p = 0; p < W * H; p++) {
    var v = bw.data[p * 4];
    if ((v !== 0 && v !== 255) || bw.data[p * 4 + 1] !== v || bw.data[p * 4 + 2] !== v || bw.data[p * 4 + 3] !== 255) binary = false;
    if (inkMask[p] >= 0) { inkN++; if (v === 0) inkBlack++; }
    if (paperMask[p]) { papN++; if (v === 255) papWhite++; if (shade[p] < 0.75) { shN++; if (v === 255) shWhite++; } }
  }
  check(binary, 'bw: only 0 and 255');
  check(inkBlack / inkN > 0.98, 'bw: words black', (100 * inkBlack / inkN).toFixed(2) + '%');
  check(papWhite / papN > 0.99, 'bw: paper white', (100 * papWhite / papN).toFixed(2) + '%');
  check(shN > 10000 && shWhite / shN > 0.99, 'bw: paper white inside the shadow too', shN + ' px, ' + (100 * shWhite / shN).toFixed(2) + '%');
  console.log('  bw: words black ' + (100 * inkBlack / inkN).toFixed(2) + '%, paper white ' + (100 * papWhite / papN).toFixed(2) + '%, in shadow ' + (100 * shWhite / shN).toFixed(2) + '% (' + shN + ' px); ' + msb + ' ms');
  var none = V.enhance(img, 'none');
  check(Buffer.compare(Buffer.from(none.data), before) === 0 && none.data !== img.data, "'none' returns an untouched copy");
  check(Buffer.compare(Buffer.from(img.data), before) === 0, 'enhance leaves its input alone');
  if (DUMP) { writePPM(path.join(DUMP, 'enhance-input.ppm'), img); writePPM(path.join(DUMP, 'enhance-bw.ppm'), bw); writePPM(path.join(DUMP, 'enhance-colour.ppm'), V.enhance(img, 'colour')); }
}());

// ---------------------------------------------------------------- 5 timing

if (!QUICK) {
  section('5  timing on a 4000 x 3000 photo');
  var big = { name: '12 MP', W: 4000, H: 3000, bg: 'wood', roll: 12, tiltX: 20, tiltY: -8, fill: 0.75, ss: 1, shadow: { angle: 0, from: 0.05, to: 0.3, depth: 0.3 }, seed: 31 };
  var tr = Date.now(), rb = renderScene(big);
  console.log('  scene drawn in ' + (Date.now() - tr) + ' ms');
  var td = Date.now(), dq = V.detectQuad(rb.img), msd = Date.now() - td;
  var errs = dq.quad.map(function (p, k) { return Math.hypot(p[0] - rb.geo.corners[k][0], p[1] - rb.geo.corners[k][1]); });
  var tolB = 0.015 * 5000;
  check(Math.max.apply(null, errs) <= tolB, '12 MP: every corner within ' + f1(tolB) + ' px', errs.map(f1).join(', '));
  var sz = V.suggestSize(dq.quad, { imageWidth: 4000, imageHeight: 3000 });
  var tw = Date.now(), wout = V.warp(rb.img, dq.quad, sz.width, sz.height), msw = Date.now() - tw;
  var tw12 = Date.now(); V.warp(rb.img, dq.quad, 3000, 4000); var msw12 = Date.now() - tw12;
  var te = Date.now(); V.enhance(wout, 'colour'); var mse = Date.now() - te;
  var tb = Date.now(); V.enhance(wout, 'bw'); var msb2 = Date.now() - tb;
  check(msd < 1500, '12 MP: detection under 1.5 s', msd + ' ms');
  check(msw12 < 3000, '12 MP: a 12-megapixel warp under 3 s (target 1.5 s)', msw12 + ' ms');
  console.log('  corner errors ' + errs.map(f1).join(' / ') + ' px');
  console.log('  detectQuad ' + msd + ' ms; warp to ' + sz.width + 'x' + sz.height + ' (' + (sz.width * sz.height / 1e6).toFixed(1) + ' MP) ' + msw + ' ms; warp to 3000x4000 (12 MP) ' + msw12 + ' ms; enhance colour ' + mse + ' ms, bw ' + msb2 + ' ms');
}

console.log('\n' + total + ' assertions   ' + passed + ' passed   ' + failed + ' failed');
process.exit(failed ? 2 : 0);
