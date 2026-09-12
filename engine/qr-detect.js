/**
 * QR detector — finds a QR code inside a photo or video frame and hands the
 * module grid to the decoder in qr.bundle.js.
 *
 * Pipeline: luminance -> adaptive threshold -> locate the three finder
 * patterns -> work out the version and orientation -> find the alignment
 * pattern -> build a perspective transform -> sample one bit per module.
 *
 * Written from scratch so nothing leaves the device: no library fetch, no
 * upload, no camera frame ever sent anywhere.
 */
(function (root) {
'use strict';

/* ---------- binarising ---------- */

const BLOCK = 8;                 // threshold is computed per 8x8 block
const MIN_RANGE = 24;            // below this a block is treated as flat

/** Luminance, 0 (black) to 255 (white). */
function toGray(data, width, height) {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = (data[p] * 306 + data[p + 1] * 601 + data[p + 2] * 117) >> 10;
  }
  return gray;
}

/**
 * Local thresholding. A single global threshold fails the moment a phone
 * casts a shadow over half the code, so each block gets its own level,
 * smoothed across its neighbours to avoid banding.
 */
function binarize(gray, width, height) {
  const bw = Math.max(1, Math.ceil(width / BLOCK));
  const bh = Math.max(1, Math.ceil(height / BLOCK));
  const levels = new Int32Array(bw * bh);

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const x0 = Math.min(bx * BLOCK, width - 1);
      const y0 = Math.min(by * BLOCK, height - 1);
      const x1 = Math.min(x0 + BLOCK, width);
      const y1 = Math.min(y0 + BLOCK, height);
      let sum = 0, min = 255, max = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = gray[y * width + x];
          sum += v; n++;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      let level = n ? sum / n : 128;
      if (max - min <= MIN_RANGE) {
        // Flat block: most likely all background. Bias to light, unless the
        // neighbours say we are inside a large dark area.
        level = min / 2;
        if (by > 0 && bx > 0) {
          const near = (levels[(by - 1) * bw + bx] + 2 * levels[by * bw + bx - 1] +
                        levels[(by - 1) * bw + bx - 1]) / 4;
          if (min < near) level = near;
        }
      }
      levels[by * bw + bx] = level;
    }
  }

  const bits = new Uint8Array(width * height);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const lx = Math.max(0, Math.min(bx, bw - 3));
      const ly = Math.max(0, Math.min(by, bh - 3));
      let sum = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const yy = ly + dy, xx = lx + dx;
          if (yy >= 0 && yy < bh && xx >= 0 && xx < bw) { sum += levels[yy * bw + xx]; n++; }
        }
      }
      const threshold = sum / n;
      const x0 = Math.min(bx * BLOCK, width - 1);
      const y0 = Math.min(by * BLOCK, height - 1);
      const x1 = Math.min(x0 + BLOCK, width);
      const y1 = Math.min(y0 + BLOCK, height);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) bits[y * width + x] = gray[y * width + x] <= threshold ? 1 : 0;
      }
    }
  }
  return bits;
}

/* ---------- finder patterns ---------- */

/** Does a run of five alternating lengths look like 1:1:3:1:1? */
function isFinderRatio(runs) {
  let total = 0;
  for (let i = 0; i < 5; i++) {
    if (runs[i] === 0) return false;
    total += runs[i];
  }
  if (total < 7) return false;
  const unit = total / 7;
  const slack = unit / 2;
  return Math.abs(unit - runs[0]) < slack &&
         Math.abs(unit - runs[1]) < slack &&
         Math.abs(unit * 3 - runs[2]) < slack * 3 &&
         Math.abs(unit - runs[3]) < slack &&
         Math.abs(unit - runs[4]) < slack;
}

const runCentre = (end, runs) => end - runs[4] - runs[3] - runs[2] / 2;

/**
 * Scan the image for the three big squares in the corners of every QR code.
 * Rows are scanned for the 1:1:3:1:1 signature, then each hit is confirmed
 * down its column and along both diagonals before it counts.
 *
 * Runs alternate dark, light, dark, light, dark — index 0 is always dark, so
 * counting only starts once the first dark pixel of a row appears.
 */
function findFinders(bits, width, height) {
  const found = [];
  const step = Math.max(1, Math.floor(height / 360));

  const darkAt = (x, y) =>
    (x >= 0 && x < width && y >= 0 && y < height) ? bits[y * width + x] : 0;

  /** The five run lengths along one axis through a dark pixel. */
  function measure(x, y, dx, dy) {
    if (!darkAt(x, y)) return null;
    const runs = [0, 0, 0, 0, 0];

    let sx = x, sy = y;
    while (darkAt(sx - dx, sy - dy)) { sx -= dx; sy -= dy; }
    let ex = x, ey = y;
    while (darkAt(ex + dx, ey + dy)) { ex += dx; ey += dy; }
    runs[2] = (dx ? Math.abs(ex - sx) : Math.abs(ey - sy)) + 1;
    const cap = runs[2] * 4 + 8;

    let px = sx - dx, py = sy - dy, n = 0;
    while (!darkAt(px, py) && n < cap) { px -= dx; py -= dy; n++; }
    if (n === 0 || n >= cap) return null;
    runs[1] = n;
    n = 0;
    while (darkAt(px, py) && n < cap) { px -= dx; py -= dy; n++; }
    runs[0] = n;

    let qx = ex + dx, qy = ey + dy;
    n = 0;
    while (!darkAt(qx, qy) && n < cap) { qx += dx; qy += dy; n++; }
    if (n === 0 || n >= cap) return null;
    runs[3] = n;
    n = 0;
    while (darkAt(qx, qy) && n < cap) { qx += dx; qy += dy; n++; }
    runs[4] = n;

    if (!isFinderRatio(runs)) return null;
    return {
      cx: (sx + ex) / 2,
      cy: (sy + ey) / 2,
      size: (runs[0] + runs[1] + runs[2] + runs[3] + runs[4]) / 7
    };
  }

  /** Confirm a row hit in the other three directions, then remember it. */
  function tryCandidate(endX, y, runs) {
    const cx = Math.round(runCentre(endX, runs));
    const unit = (runs[0] + runs[1] + runs[2] + runs[3] + runs[4]) / 7;

    const vert = measure(cx, y, 0, 1);
    if (!vert) return;
    const cy = Math.round(vert.cy);
    const horiz = measure(cx, cy, 1, 0);
    if (!horiz) return;
    const x = Math.round(horiz.cx);
    if (!measure(x, cy, 1, 1) || !measure(x, cy, 1, -1)) return;

    const px = horiz.cx, py = vert.cy;
    const size = (vert.size + horiz.size + unit) / 3;

    for (const f of found) {
      if (Math.abs(f.x - px) < f.size && Math.abs(f.y - py) < f.size) {
        f.x = (f.x * f.n + px) / (f.n + 1);
        f.y = (f.y * f.n + py) / (f.n + 1);
        f.size = (f.size * f.n + size) / (f.n + 1);
        f.n++;
        return;
      }
    }
    found.push({ x: px, y: py, size: size, n: 1 });
  }

  for (let y = step; y < height; y += step) {
    const runs = [0, 0, 0, 0, 0];
    let state = 0;
    const row = y * width;

    for (let x = 0; x < width; x++) {
      if (bits[row + x]) {
        if (state & 1) state++;                    // light run ended
        runs[state]++;
      } else if ((state & 1) === 0) {              // dark run ended
        if (state === 4) {
          if (isFinderRatio(runs)) tryCandidate(x, y, runs);
          runs[0] = runs[2]; runs[1] = runs[3]; runs[2] = runs[4];
          runs[3] = 1; runs[4] = 0;
          state = 3;
        } else {
          runs[++state]++;
        }
      } else {
        runs[state]++;
      }
    }
    if (state === 4 && isFinderRatio(runs)) tryCandidate(width, y, runs);
  }

  return found.filter((f) => f.n >= 2).sort((a, b) => b.n - a.n);
}

/* ---------- geometry ---------- */

const dist = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

/**
 * Work out which finder is which. The corner between the two furthest-apart
 * patterns is the top left; the sign of the cross product says which of the
 * other two is the top right.
 */
function orderFinders(a, b, c) {
  const ab = dist(a, b), bc = dist(b, c), ac = dist(a, c);
  let topLeft, p, q;
  if (bc >= ab && bc >= ac) { topLeft = a; p = b; q = c; }
  else if (ac >= ab && ac >= bc) { topLeft = b; p = a; q = c; }
  else { topLeft = c; p = a; q = b; }

  const cross = (p.x - topLeft.x) * (q.y - topLeft.y) - (p.y - topLeft.y) * (q.x - topLeft.x);
  return cross < 0 ? { topLeft: topLeft, topRight: q, bottomLeft: p }
                   : { topLeft: topLeft, topRight: p, bottomLeft: q };
}

/* 3x3 projective transforms, row major. */

function squareToQuad(x0, y0, x1, y1, x2, y2, x3, y3) {
  const dx3 = x0 - x1 + x2 - x3;
  const dy3 = y0 - y1 + y2 - y3;
  if (dx3 === 0 && dy3 === 0) {
    return [x1 - x0, x3 - x0, x0,
            y1 - y0, y3 - y0, y0,
            0, 0, 1];
  }
  const dx1 = x1 - x2, dx2 = x3 - x2;
  const dy1 = y1 - y2, dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
          y1 - y0 + g * y1, y3 - y0 + h * y3, y0,
          g, h, 1];
}

function adjugate(m) {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]
  ];
}

function multiply(a, b) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
}

function apply(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}

/** Map the module grid onto wherever the code sits in the image. */
function gridTransform(src, dst) {
  return multiply(squareToQuad.apply(null, dst), adjugate(squareToQuad.apply(null, src)));
}

/* ---------- alignment pattern ---------- */

/** Look for the small 1:1:1 square near where the fourth corner should be. */
function findAlignment(bits, width, height, cx, cy, moduleSize, radius) {
  const at = (x, y) => (x >= 0 && x < width && y >= 0 && y < height) ? bits[y * width + x] : 0;

  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = Math.round(cx + dx * moduleSize / 2);
        const y = Math.round(cy + dy * moduleSize / 2);
        if (!at(x, y)) continue;

        // centre run horizontally, then check the ratio both ways
        let x0 = x; while (at(x0 - 1, y)) x0--;
        let x1 = x; while (at(x1 + 1, y)) x1++;
        const w = x1 - x0 + 1;
        if (w < moduleSize * 0.5 || w > moduleSize * 2) continue;
        const mx = (x0 + x1) / 2;

        let y0 = Math.round(y); while (at(Math.round(mx), y0 - 1)) y0--;
        let y1 = Math.round(y); while (at(Math.round(mx), y1 + 1)) y1++;
        const h = y1 - y0 + 1;
        if (h < moduleSize * 0.5 || h > moduleSize * 2) continue;
        const my = (y0 + y1) / 2;

        // a light ring must surround the dark centre
        const ring = Math.round(moduleSize);
        if (at(Math.round(mx - ring), Math.round(my)) || at(Math.round(mx + ring), Math.round(my)) ||
            at(Math.round(mx), Math.round(my - ring)) || at(Math.round(mx), Math.round(my + ring))) continue;

        return { x: mx, y: my };
      }
    }
  }
  return null;
}

/* ---------- sampling ---------- */

/** Read one bit per module through the perspective transform. */
function sample(bits, width, height, transform, dimension) {
  const matrix = [];
  for (let r = 0; r < dimension; r++) {
    const row = new Uint8Array(dimension);
    for (let c = 0; c < dimension; c++) {
      const p = apply(transform, c + 0.5, r + 0.5);
      const x = Math.round(p.x), y = Math.round(p.y);
      if (x < 0 || x >= width || y < 0 || y >= height) return null;
      // a 3-point vote steadies the reading when a module lands on a seam
      let dark = 0, n = 0;
      for (const [ox, oy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
        dark += bits[yy * width + xx];
        n++;
      }
      row[c] = dark * 2 > n ? 1 : 0;
    }
    matrix.push(row);
  }
  return matrix;
}

const transpose = (m) => m.map((_, r) => m.map((row) => row[r]));

/**
 * Find and read a QR code in an ImageData.
 * @returns {{text,version,ecLevel,corrected,corners}|null}
 */
function scanImageData(image) {
  const width = image.width, height = image.height;
  if (!width || !height) return null;

  const gray = toGray(image.data, width, height);
  const bits = binarize(gray, width, height);
  const finders = findFinders(bits, width, height);
  if (finders.length < 3) return null;

  // try the most confident triples first
  const limit = Math.min(finders.length, 5);
  for (let a = 0; a < limit - 2; a++) {
    for (let b = a + 1; b < limit - 1; b++) {
      for (let c = b + 1; c < limit; c++) {
        const got = readTriple(bits, width, height, finders[a], finders[b], finders[c]);
        if (got) return got;
      }
    }
  }
  return null;
}

function readTriple(bits, width, height, f1, f2, f3) {
  // the three patterns should be about the same size
  const sizes = [f1.size, f2.size, f3.size];
  const avg = (sizes[0] + sizes[1] + sizes[2]) / 3;
  if (sizes.some((s) => Math.abs(s - avg) > avg * 0.6)) return null;

  const ord = orderFinders(f1, f2, f3);

  /* Finder width is measured along image rows and columns, so a code held at
     an angle measures wider than it is — a horizontal cut through a square
     turned by 33 degrees is a fifth longer than its side. Fold that back out
     using the angle of the top edge, or the module count comes out short and
     nothing decodes. */
  const angle = Math.atan2(ord.topRight.y - ord.topLeft.y, ord.topRight.x - ord.topLeft.x);
  const phi = Math.abs(angle % (Math.PI / 2));
  const moduleSize = avg * Math.max(Math.abs(Math.cos(phi)), Math.abs(Math.sin(phi)));
  if (moduleSize < 1) return null;

  const across = dist(ord.topLeft, ord.topRight) / moduleSize;
  const down = dist(ord.topLeft, ord.bottomLeft) / moduleSize;
  if (Math.abs(across - down) > Math.max(across, down) * 0.5) return null;

  let dimension = Math.round((across + down) / 2) + 7;
  dimension += (17 - dimension) % 4;                     // snap to 4n + 17
  if (dimension < 21) dimension = 21;

  /* The estimate can still land one version out on a blurred or steeply
     angled frame. Trying the neighbours costs one sampling pass each, and a
     wrong guess cannot produce wrong text: the format bits and every
     Reed-Solomon block would have to agree by accident. */
  for (const d of [dimension, dimension - 4, dimension + 4, dimension - 8, dimension + 8]) {
    if (d < 21 || d > 177) continue;
    const got = readAtDimension(bits, width, height, ord, d, moduleSize);
    if (got) return got;
  }
  return null;
}

function readAtDimension(bits, width, height, ord, dimension, moduleSize) {
  const version = (dimension - 17) / 4;

  // the fourth corner: the alignment pattern when there is one, otherwise the
  // parallelogram estimate, which is all version 1 needs
  const brX = ord.topRight.x - ord.topLeft.x + ord.bottomLeft.x;
  const brY = ord.topRight.y - ord.topLeft.y + ord.bottomLeft.y;

  let alignment = null;
  if (version >= 2) {
    const correction = 1 - 3 / (dimension - 7);
    const ex = ord.topLeft.x + correction * (brX - ord.topLeft.x);
    const ey = ord.topLeft.y + correction * (brY - ord.topLeft.y);
    alignment = findAlignment(bits, width, height, ex, ey, moduleSize, 5);
  }

  const attempts = [];
  if (alignment) {
    attempts.push({
      src: [3.5, 3.5, dimension - 3.5, 3.5, dimension - 6.5, dimension - 6.5, 3.5, dimension - 3.5],
      dst: [ord.topLeft.x, ord.topLeft.y, ord.topRight.x, ord.topRight.y,
            alignment.x, alignment.y, ord.bottomLeft.x, ord.bottomLeft.y]
    });
  }
  attempts.push({
    src: [3.5, 3.5, dimension - 3.5, 3.5, dimension - 3.5, dimension - 3.5, 3.5, dimension - 3.5],
    dst: [ord.topLeft.x, ord.topLeft.y, ord.topRight.x, ord.topRight.y,
          brX, brY, ord.bottomLeft.x, ord.bottomLeft.y]
  });

  for (const a of attempts) {
    const transform = gridTransform(a.src, a.dst);
    const matrix = sample(bits, width, height, transform, dimension);
    if (!matrix) continue;

    const corners = [
      apply(transform, 0, 0), apply(transform, dimension, 0),
      apply(transform, dimension, dimension), apply(transform, 0, dimension)
    ];

    // a code photographed in a mirror or through a shop window reads transposed
    for (const m of [matrix, transpose(matrix)]) {
      const got = root.QR.decode(m);
      if (got.ok) {
        return {
          text: got.text, version: got.version, ecLevel: got.ecLevel,
          mask: got.mask, corrected: got.corrected, corners: corners,
          mirrored: m !== matrix
        };
      }
    }
  }
  return null;
}

root.QRDetect = { scan: scanImageData, binarize: binarize, toGray: toGray, findFinders: findFinders };
if (typeof module !== 'undefined' && module.exports) module.exports = root.QRDetect;

})(typeof window !== 'undefined' ? window : globalThis);
