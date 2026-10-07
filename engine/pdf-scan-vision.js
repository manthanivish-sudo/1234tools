/**
 * engine/pdf-scan-vision.js: the image half of Scan to PDF.
 *
 * Plain JavaScript, no libraries, no DOM. Every function takes and returns
 * ImageData-like objects { width, height, data: Uint8ClampedArray (RGBA) },
 * so it runs the same in a page, in a Web Worker and in Node. To show a
 * result on a canvas: new ImageData(out.data, out.width, out.height).
 *
 *   downscale(img, maxSide)          -> img (the input itself if it already fits)
 *   detectQuad(img, opts)            -> { quad, confidence, method }
 *   warp(img, quad, outW, outH)      -> img (perspective correction, bilinear)
 *   suggestSize(quad, opts)          -> { width, height, ratio, snapped, method }
 *   enhance(img, mode)               -> img ('colour' | 'grey' | 'bw' | 'none')
 *   rotate90(img, quarterTurns)      -> img (positive turns are clockwise)
 *   orderCorners(points)             -> [TL, TR, BR, BL]
 *   homography(src4, dst4), applyHomography(h, x, y)   helpers
 *
 * Coordinates are continuous: pixel (i, j) covers [i, i+1) x [j, j+1), so
 * the full image rectangle is (0,0)-(width,height) and a pixel's centre is
 * (i + 0.5, j + 0.5). Quads are [[x, y] x 4] in that system.
 *
 * How the page is found (detectQuad). The photo is shrunk to about 640 px
 * on its longest side, turned grey, blurred and run through a Canny edge
 * detector (Sobel gradients, non-maximum suppression, hysteresis with
 * thresholds taken from the image's own gradient statistics). The edge
 * pixels vote in a Hough transform, each one only for angles close to its
 * own gradient direction, which keeps texture from flooding the
 * accumulator; every peak is then re-fitted by least squares to the edge
 * pixels lying along it. The four image borders join the candidate lines,
 * so a page that runs off one side of the photo still closes into a
 * quadrilateral. Every way of choosing two roughly opposite pairs of lines
 * is tried; each quadrilateral is checked for convexity, sensible corner
 * angles and size, and scored by how much of each side is backed by edge
 * pixels running the same way (read in O(1) from prefix sums along each
 * line), by whether the inside is consistently lighter (or darker) than
 * the outside on every side, and by area. The best one is mapped back to
 * the full-size photo and each side is re-measured there along its normal
 * (sub-pixel, robust line fit), so the corners are accurate at full
 * resolution even though the search ran on the small copy.
 *
 * Why lines rather than contours: contour following needs an unbroken
 * outline, and real page outlines are broken all the time, by shadows, a
 * thumb, a low-contrast stretch, or the photo's edge. A Hough line keeps
 * its votes across the gaps, and scoring whole sides against the edge map
 * rejects the many lines that texture, text and table edges produce.
 * Thresholding the page as a bright blob fails on light tables and under
 * shadows, which are exactly the hard cases.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.MVRScanVision = api;
}(typeof self !== 'undefined' ? self : null, function () {
  'use strict';

  var PI = Math.PI;
  var DEG = PI / 180;

  // ------------------------------------------------------------------ basics

  function makeImage(w, h) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }

  function checkImage(img) {
    if (!img || !(img.width > 0) || !(img.height > 0) || !img.data ||
        img.data.length < img.width * img.height * 4) {
      throw new TypeError('MVRScanVision: expected { width, height, data: RGBA }');
    }
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // Smallest angle between two undirected line angles, both in radians.
  function angDiff(a, b) {
    var d = Math.abs(a - b) % PI;
    return d > PI / 2 ? PI - d : d;
  }

  // Area-averaging shrink. Returns the input itself when it already fits.
  function downscale(img, maxSide) {
    checkImage(img);
    var W = img.width, H = img.height, m = Math.max(W, H);
    if (!(maxSide >= 1) || m <= maxSide) return img;
    var s = maxSide / m;
    var w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
    var xm = new Int32Array(W), cx = new Uint32Array(w), cy = new Uint32Array(h);
    var x, y;
    for (x = 0; x < W; x++) { var ox = Math.min(w - 1, Math.floor(x * w / W)); xm[x] = ox * 4; cx[ox]++; }
    var acc = new Uint32Array(w * h * 4), d = img.data;
    for (y = 0; y < H; y++) {
      var oy = Math.min(h - 1, Math.floor(y * h / H)), ob = oy * w * 4, i = y * W * 4;
      cy[oy]++;
      for (x = 0; x < W; x++, i += 4) {
        var o = ob + xm[x];
        acc[o] += d[i]; acc[o + 1] += d[i + 1]; acc[o + 2] += d[i + 2]; acc[o + 3] += d[i + 3];
      }
    }
    var out = makeImage(w, h), od = out.data;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var k = (y * w + x) * 4, n = cx[x] * cy[y];
        od[k] = acc[k] / n; od[k + 1] = acc[k + 1] / n; od[k + 2] = acc[k + 2] / n; od[k + 3] = acc[k + 3] / n;
      }
    }
    return out;
  }

  function toGrey(img) {
    var n = img.width * img.height, d = img.data, g = new Float32Array(n);
    for (var i = 0, j = 0; i < n; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return g;
  }

  function blurGauss(src, w, h, sigma) {
    var r = Math.max(1, Math.ceil(sigma * 3)), k = new Float32Array(2 * r + 1), s = 0, i, x, y, j;
    for (i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); s += k[i + r]; }
    for (i = 0; i < k.length; i++) k[i] /= s;
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (y = 0; y < h; y++) {
      var row = y * w;
      for (x = 0; x < w; x++) {
        var a = 0;
        for (j = -r; j <= r; j++) { var xx = x + j; if (xx < 0) xx = 0; else if (xx >= w) xx = w - 1; a += k[j + r] * src[row + xx]; }
        tmp[row + x] = a;
      }
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var b = 0;
        for (j = -r; j <= r; j++) { var yy = y + j; if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1; b += k[j + r] * tmp[yy * w + x]; }
        out[y * w + x] = b;
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ edges

  // Canny: Sobel, non-maximum suppression, hysteresis. Thresholds come from
  // the gradient histogram, so a textured table raises them and a clean,
  // low-contrast scene lowers them.
  function canny(g, w, h) {
    var n = w * h, gx = new Float32Array(n), gy = new Float32Array(n), mag = new Float32Array(n);
    var x, y, i, maxM = 0;
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        i = y * w + x;
        var a = g[i - w - 1], b = g[i - w], c = g[i - w + 1], d = g[i - 1], f = g[i + 1];
        var p = g[i + w - 1], q = g[i + w], r = g[i + w + 1];
        var sx = (c + 2 * f + r) - (a + 2 * d + p), sy = (p + 2 * q + r) - (a + 2 * b + c);
        gx[i] = sx; gy[i] = sy;
        var m = Math.sqrt(sx * sx + sy * sy); mag[i] = m;
        if (m > maxM) maxM = m;
      }
    }
    var NB = 1024, hist = new Uint32Array(NB), scale = maxM > 0 ? (NB - 1) / maxM : 0, tot = 0;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { hist[(mag[y * w + x] * scale) | 0]++; tot++; }
    function pct(p) {
      var target = p * tot, acc = 0;
      for (var k = 0; k < NB; k++) { acc += hist[k]; if (acc >= target) return (k + 0.5) / (scale || 1); }
      return maxM;
    }
    var med = pct(0.5), hi = Math.max(3.5 * med, 4), lo = Math.max(0.4 * hi, 1.8 * med);

    var nms = new Float32Array(n);
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        i = y * w + x;
        var mm = mag[i];
        if (mm < lo) continue;
        var ax = Math.abs(gx[i]), ay = Math.abs(gy[i]), n1, n2;
        if (ay <= ax * 0.41421356) { n1 = mag[i - 1]; n2 = mag[i + 1]; }
        else if (ay >= ax * 2.41421356) { n1 = mag[i - w]; n2 = mag[i + w]; }
        else if (gx[i] * gy[i] > 0) { n1 = mag[i - w - 1]; n2 = mag[i + w + 1]; }
        else { n1 = mag[i - w + 1]; n2 = mag[i + w - 1]; }
        if (mm >= n1 && mm > n2) nms[i] = mm;
      }
    }
    var edge = new Uint8Array(n), stack = new Int32Array(n), sp = 0;
    var nb = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
    for (i = 0; i < n; i++) {
      if (edge[i] || nms[i] < hi) continue;
      edge[i] = 1; stack[sp++] = i;
      while (sp) {
        var j = stack[--sp];
        for (var t = 0; t < 8; t++) {
          var kk = j + nb[t];
          if (kk >= 0 && kk < n && !edge[kk] && nms[kk] > 0) { edge[kk] = 1; stack[sp++] = kk; }
        }
      }
    }
    // Undirected normal angle in [0, pi) for each edge pixel, -1 elsewhere.
    var ang = new Float32Array(n), count = 0;
    for (i = 0; i < n; i++) {
      if (!edge[i]) { ang[i] = -1; continue; }
      var th = Math.atan2(gy[i], gx[i]);
      if (th < 0) th += PI;
      if (th >= PI) th -= PI;
      ang[i] = th; count++;
    }
    return { edge: edge, ang: ang, count: count };
  }

  // ------------------------------------------------------------------ lines

  // A line is n . p = rho in coordinates centred on the image centre, with
  // the normal angle theta in [0, pi).
  function normLine(nx, ny, rho) {
    var th = Math.atan2(ny, nx);
    if (th < 0) { th += PI; nx = -nx; ny = -ny; rho = -rho; }
    if (th >= PI) { th -= PI; nx = -nx; ny = -ny; rho = -rho; }
    return { nx: nx, ny: ny, rho: rho, theta: th };
  }

  // Total least squares through the edge pixels close to a line.
  function fitEdges(E, line, distTol, angTol) {
    var sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, c = 0;
    for (var e = 0; e < E.n; e++) {
      var x = E.x[e], y = E.y[e];
      var d = x * line.nx + y * line.ny - line.rho;
      if (d > distTol || d < -distTol) continue;
      if (angDiff(E.a[e], line.theta) > angTol) continue;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; c++;
    }
    if (c < 3) return null;
    var mx = sx / c, my = sy / c;
    var cxx = sxx / c - mx * mx, cyy = syy / c - my * my, cxy = sxy / c - mx * my;
    var phi = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    var L = normLine(-Math.sin(phi), Math.cos(phi), 0);
    L.rho = L.nx * mx + L.ny * my;
    L.count = c;
    return L;
  }

  function houghLines(cn, w, h) {
    var hw = w / 2, hh = h / 2, nT = 180;
    var R = Math.ceil(Math.hypot(w, h) / 2) + 2, nR = 2 * R + 1;
    var acc = new Int32Array(nT * nR), cosT = new Float64Array(nT), sinT = new Float64Array(nT), t, i;
    for (t = 0; t < nT; t++) { cosT[t] = Math.cos(t * DEG); sinT[t] = Math.sin(t * DEG); }
    var E = { n: cn.count, x: new Float32Array(cn.count), y: new Float32Array(cn.count), a: new Float32Array(cn.count) };
    var k = 0;
    for (i = 0; i < w * h; i++) {
      if (cn.ang[i] < 0) continue;
      var xc = (i % w) + 0.5 - hw, yc = ((i / w) | 0) + 0.5 - hh;
      E.x[k] = xc; E.y[k] = yc; E.a[k] = cn.ang[i]; k++;
      var tb = Math.round(cn.ang[i] / DEG);
      for (var dt = -2; dt <= 2; dt++) {
        var tt = (tb + dt + 360) % 180;
        acc[tt * nR + Math.round(xc * cosT[tt] + yc * sinT[tt]) + R]++;
      }
    }
    var minVotes = Math.max(16, Math.round(0.06 * Math.min(w, h)));
    var peaks = [];
    for (t = 0; t < nT; t++) {
      for (var r = 0; r < nR; r++) {
        var idx = t * nR + r, v = acc[idx];
        if (v < minVotes) continue;
        var isPeak = true;
        for (var a = -2; a <= 2 && isPeak; a++) {
          var ta = t + a;
          if (ta < 0 || ta >= nT) continue;
          for (var b = -3; b <= 3; b++) {
            var rb = r + b;
            if (rb < 0 || rb >= nR || (a === 0 && b === 0)) continue;
            var j = ta * nR + rb, u = acc[j];
            if (u > v || (u === v && j < idx)) { isPeak = false; break; }
          }
        }
        if (isPeak) peaks.push([v, t, r - R]);
      }
    }
    peaks.sort(function (p, q) { return q[0] - p[0]; });
    if (peaks.length > 150) peaks.length = 150;

    var lines = [];
    for (i = 0; i < peaks.length; i++) {
      var th = peaks[i][1] * DEG;
      var L = { nx: Math.cos(th), ny: Math.sin(th), rho: peaks[i][2], theta: th };
      var L1 = fitEdges(E, L, 2.5, 10 * DEG);
      if (!L1) continue;
      var L2 = fitEdges(E, L1, 1.5, 8 * DEG) || L1;
      if (L2.count < minVotes * 0.6) continue;
      lines.push(L2);
    }
    lines.sort(function (p, q) { return q.count - p.count; });
    var uniq = [];
    for (i = 0; i < lines.length; i++) {
      var A = lines[i], dup = false;
      for (var m = 0; m < uniq.length; m++) {
        var B = uniq[m];
        if (angDiff(A.theta, B.theta) > 3 * DEG) continue;
        var s = (A.nx * B.nx + A.ny * B.ny) < 0 ? -1 : 1;
        if (Math.abs(A.rho - s * B.rho) < 6) { dup = true; break; }
      }
      if (!dup) uniq.push(A);
    }
    // Lines of text give many strong parallel lines that would crowd the
    // page's own edges out. So keep, for each direction, the strongest few
    // and the two outermost, which is where a page's edges usually are.
    var groups = [];
    for (i = 0; i < uniq.length; i++) {
      var Lg = uniq[i], gi = -1;
      for (var q = 0; q < groups.length; q++) if (angDiff(groups[q].theta, Lg.theta) < 6 * DEG) { gi = q; break; }
      if (gi < 0) { groups.push({ theta: Lg.theta, nx: Lg.nx, ny: Lg.ny, members: [] }); gi = groups.length - 1; }
      groups[gi].members.push(Lg);
    }
    var kept = [];
    groups.forEach(function (g) {
      var ms = g.members, lo = null, hi = null, loV = Infinity, hiV = -Infinity;
      ms.forEach(function (Lm, k) {
        var off = ((Lm.nx * g.nx + Lm.ny * g.ny) < 0 ? -1 : 1) * Lm.rho;
        if (off < loV) { loV = off; lo = Lm; }
        if (off > hiV) { hiV = off; hi = Lm; }
        if (k < 5) kept.push(Lm);
      });
      if (kept.indexOf(lo) < 0) kept.push(lo);
      if (kept.indexOf(hi) < 0) kept.push(hi);
    });
    kept.sort(function (p, q2) { return q2.count - p.count; });
    if (kept.length > 36) kept.length = 36;
    return kept;
  }

  function addBorderLines(lines, w, h) {
    lines.push({ nx: 1, ny: 0, rho: -w / 2, theta: 0, border: 'left', inx: 1, iny: 0 });
    lines.push({ nx: 1, ny: 0, rho: w / 2, theta: 0, border: 'right', inx: -1, iny: 0 });
    lines.push({ nx: 0, ny: 1, rho: -h / 2, theta: PI / 2, border: 'top', inx: 0, iny: 1 });
    lines.push({ nx: 0, ny: 1, rho: h / 2, theta: PI / 2, border: 'bottom', inx: 0, iny: -1 });
  }

  function sampleClamp(g, w, h, x, y) {
    var ix = Math.round(x), iy = Math.round(y);
    if (ix < 0) ix = 0; else if (ix >= w) ix = w - 1;
    if (iy < 0) iy = 0; else if (iy >= h) iy = h - 1;
    return g[iy * w + ix];
  }

  // Prefix sums along a line: edge support, and the grey level a few pixels
  // either side of it (or just inside the image, for a border line).
  function buildProfile(L, cn, g, w, h) {
    var hw = w / 2, hh = h / 2, T = Math.ceil(Math.hypot(w, h) / 2) + 2, n = 2 * T + 1;
    var nx = L.nx, ny = L.ny, dx = -ny, dy = nx, tol = 15 * DEG, ang = cn.ang;
    var sup = new Float64Array(n + 1), pl = new Float64Array(n + 1), mi = new Float64Array(n + 1);
    for (var k = 0; k < n; k++) {
      var t = k - T;
      var px = L.rho * nx + t * dx + hw - 0.5, py = L.rho * ny + t * dy + hh - 0.5;
      var s = 0, a = 0, b = 0;
      if (!L.border) {
        for (var o = -2; o <= 2; o++) {
          var qx = Math.round(px + o * nx), qy = Math.round(py + o * ny);
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          var an = ang[qy * w + qx];
          if (an >= 0 && angDiff(an, L.theta) < tol) { s = 1; break; }
        }
        a = sampleClamp(g, w, h, px + 4 * nx, py + 4 * ny);
        b = sampleClamp(g, w, h, px - 4 * nx, py - 4 * ny);
      } else {
        a = sampleClamp(g, w, h, px + 2.5 * L.inx, py + 2.5 * L.iny);
      }
      sup[k + 1] = sup[k] + s; pl[k + 1] = pl[k] + a; mi[k + 1] = mi[k] + b;
    }
    L.T = T; L.sup = sup; L.pl = pl; L.mi = mi;
  }

  function sideStat(L, P, Q) {
    var dx = -L.ny, dy = L.nx;
    var t1 = P[0] * dx + P[1] * dy, t2 = Q[0] * dx + Q[1] * dy;
    var lo = Math.min(t1, t2), hi = Math.max(t1, t2), tr = 0.06 * (hi - lo);
    var ka = Math.max(0, Math.round(lo + tr) + L.T), kb = Math.min(2 * L.T + 1, Math.round(hi - tr) + L.T);
    if (kb - ka < 3) return null;
    var m = kb - ka;
    return { sup: (L.sup[kb] - L.sup[ka]) / m, pl: (L.pl[kb] - L.pl[ka]) / m, mi: (L.mi[kb] - L.mi[ka]) / m };
  }

  function intersectN(A, B) {
    var det = A.nx * B.ny - A.ny * B.nx;
    if (Math.abs(det) < 0.17) return null; // lines closer than ~10 degrees
    return [(A.rho * B.ny - B.rho * A.ny) / det, (A.nx * B.rho - B.nx * A.rho) / det];
  }

  function searchQuads(lines, w, h) {
    var n = lines.length, hw = w / 2, hh = h / 2;
    var mx = 0.02 * w + 2, my = 0.02 * h + 2, minDim = Math.min(w, h);
    var minSep = 0.06 * minDim, minArea = 0.04 * w * h, minSideLen = 0.06 * minDim;
    var cosMax = Math.cos(30 * DEG);
    var pairs = [], i, j;
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var A = lines[i], B = lines[j];
        if (A.border && B.border) continue;
        if (angDiff(A.theta, B.theta) > 35 * DEG) continue;
        var s = (A.nx * B.nx + A.ny * B.ny) < 0 ? -1 : 1;
        if (Math.abs(A.rho - s * B.rho) < minSep) continue;
        pairs.push(i, j);
      }
    }
    var best = null, C = [null, null, null, null], st = [null, null, null, null];
    for (var p = 0; p < pairs.length; p += 2) {
      for (var q = p + 2; q < pairs.length; q += 2) {
        var a1 = pairs[p], a2 = pairs[p + 1], b1 = pairs[q], b2 = pairs[q + 1];
        if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;
        var l1 = lines[a1], l2 = lines[a2], m1 = lines[b1], m2 = lines[b2];
        if (angDiff(l1.theta, m1.theta) < 25 * DEG) continue;
        var nb = (l1.border ? 1 : 0) + (l2.border ? 1 : 0) + (m1.border ? 1 : 0) + (m2.border ? 1 : 0);
        if (nb > 2) continue;
        C[0] = intersectN(l1, m1); C[1] = intersectN(l1, m2); C[2] = intersectN(l2, m2); C[3] = intersectN(l2, m1);
        if (!C[0] || !C[1] || !C[2] || !C[3]) continue;
        var ok = true, k;
        for (k = 0; k < 4 && ok; k++) {
          if (C[k][0] < -hw - mx || C[k][0] > hw + mx || C[k][1] < -hh - my || C[k][1] > hh + my) ok = false;
        }
        if (!ok) continue;
        // convexity, corner angles, side lengths, area
        var sign = 0, area = 0;
        for (k = 0; k < 4 && ok; k++) {
          var P0 = C[k], P1 = C[(k + 1) & 3], P2 = C[(k + 2) & 3];
          var ex = P1[0] - P0[0], ey = P1[1] - P0[1], fx = P2[0] - P1[0], fy = P2[1] - P1[1];
          var le = Math.hypot(ex, ey), lf = Math.hypot(fx, fy);
          if (le < minSideLen) { ok = false; break; }
          var cr = ex * fy - ey * fx;
          var sg = cr > 0 ? 1 : -1;
          if (!sign) sign = sg; else if (sg !== sign) { ok = false; break; }
          var cs = -(ex * fx + ey * fy) / (le * lf);
          if (cs > cosMax || cs < -cosMax) { ok = false; break; }
          area += P0[0] * P1[1] - P1[0] * P0[1];
        }
        if (!ok) continue;
        area = Math.abs(area) / 2;
        if (area < minArea) continue;
        var cxm = (C[0][0] + C[1][0] + C[2][0] + C[3][0]) / 4, cym = (C[0][1] + C[1][1] + C[2][1] + C[3][1]) / 4;
        var sideLines = [l1, m2, l2, m1];
        var inSum = 0, outSum = 0, nReal = 0, maxC = 0, posC = 0, negC = 0;
        for (k = 0; k < 4 && ok; k++) {
          var Ls = sideLines[k];
          var S = sideStat(Ls, C[k], C[(k + 1) & 3]);
          if (!S) { ok = false; break; }
          st[k] = S;
          if (Ls.border) continue;
          var sIn = (cxm * Ls.nx + cym * Ls.ny - Ls.rho) > 0;
          S.inM = sIn ? S.pl : S.mi; S.outM = sIn ? S.mi : S.pl;
          S.con = S.inM - S.outM;
          inSum += S.inM; outSum += S.outM; nReal++;
          if (S.con > 0) posC++; else negC++;
          if (Math.abs(S.con) > maxC) maxC = Math.abs(S.con);
        }
        if (!ok || nReal < 2 || (posC && negC)) continue;
        var pol = posC ? 1 : -1, inM = inSum / nReal, outM = outSum / nReal;
        var minS = 1, sumS = 0;
        for (k = 0; k < 4; k++) {
          var sv;
          if (sideLines[k].border) {
            sv = clamp((st[k].pl - outM) / (inM - outM), 0, 1);
          } else {
            var ac = Math.abs(st[k].con);
            if (ac < 5 || ac < 0.25 * maxC) { ok = false; break; }
            sv = st[k].sup;
          }
          if (sv < minS) minS = sv;
          sumS += sv;
        }
        if (!ok) continue;
        var meanS = sumS / 4;
        if (minS < 0.45 || meanS < 0.6) continue;
        // Paper is nearly always lighter than what it lies on; a darker
        // quadrilateral (a phone, a book) is still allowed but ranks lower.
        var conf = meanS * Math.sqrt(minS) * (pol > 0 ? 1 : 0.85);
        var score = conf * Math.sqrt(area / (w * h)) * Math.pow(0.95, nb);
        if (!best || score > best.score) {
          best = {
            score: score, confidence: conf, borders: nb,
            corners: [C[0].slice(), C[1].slice(), C[2].slice(), C[3].slice()],
            sides: sideLines.map(function (Ls) { return { border: Ls.border || null, pol: pol }; })
          };
        }
      }
    }
    return best;
  }

  // ------------------------------------------------------- full-size refine

  function lumAt(img, x, y) {
    var W = img.width, H = img.height, ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0) ix = 0; else if (ix >= W) ix = W - 1;
    if (iy < 0) iy = 0; else if (iy >= H) iy = H - 1;
    var i = (iy * W + ix) * 4, d = img.data;
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }

  // Line n . p = c through points, with outliers dropped.
  function fitPoints(xs, ys) {
    var n = xs.length, use = new Uint8Array(n).fill(1), L = null;
    for (var round = 0; round < 3; round++) {
      var sx = 0, sy = 0, c = 0, i;
      for (i = 0; i < n; i++) if (use[i]) { sx += xs[i]; sy += ys[i]; c++; }
      if (c < 4) return null;
      var mx = sx / c, my = sy / c, cxx = 0, cyy = 0, cxy = 0;
      for (i = 0; i < n; i++) if (use[i]) { var ax = xs[i] - mx, ay = ys[i] - my; cxx += ax * ax; cyy += ay * ay; cxy += ax * ay; }
      var phi = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
      L = { nx: -Math.sin(phi), ny: Math.cos(phi) };
      L.c = L.nx * mx + L.ny * my; L.inliers = c;
      var res = [];
      for (i = 0; i < n; i++) res.push(Math.abs(xs[i] * L.nx + ys[i] * L.ny - L.c));
      var sorted = res.slice().sort(function (a, b) { return a - b; });
      var thr = Math.max(0.75, 3 * 1.4826 * sorted[n >> 1]);
      for (i = 0; i < n; i++) use[i] = res[i] <= thr ? 1 : 0;
    }
    return L;
  }

  function lineThrough(P, Q, cx, cy) {
    var dx = Q[0] - P[0], dy = Q[1] - P[1], l = Math.hypot(dx, dy) || 1;
    var nx = -dy / l, ny = dx / l, c = nx * P[0] + ny * P[1];
    if (nx * cx + ny * cy - c < 0) { nx = -nx; ny = -ny; c = -c; }
    return { nx: nx, ny: ny, c: c };
  }

  function borderLineFull(name, W, H) {
    if (name === 'left') return { nx: 1, ny: 0, c: 0 };
    if (name === 'right') return { nx: -1, ny: 0, c: -W };
    if (name === 'top') return { nx: 0, ny: 1, c: 0 };
    return { nx: 0, ny: -1, c: -H };
  }

  function intersectC(A, B) {
    var det = A.nx * B.ny - A.ny * B.nx;
    if (Math.abs(det) < 1e-9) return null;
    return [(A.c * B.ny - B.c * A.ny) / det, (A.nx * B.c - B.nx * A.c) / det];
  }

  function refineSide(img, P, Q, ln, pol, R, scale) {
    var dxv = Q[0] - P[0], dyv = Q[1] - P[1], len = Math.hypot(dxv, dyv);
    if (len < 8) return null;
    var tx = dxv / len, ty = dyv / len, nx = ln.nx, ny = ln.ny;
    var K = Math.max(16, Math.min(160, Math.round(len / Math.max(2, scale))));
    var spread = Math.max(1, scale * 0.6), prof = new Float64Array(2 * R + 1), xs = [], ys = [];
    for (var k = 0; k < K; k++) {
      var f = 0.08 + 0.84 * k / (K - 1), bx = P[0] + dxv * f, by = P[1] + dyv * f, o;
      for (o = -R; o <= R; o++) {
        var s = 0;
        for (var j = -1; j <= 1; j++) s += lumAt(img, bx + o * nx + j * spread * tx, by + o * ny + j * spread * ty);
        prof[o + R] = s / 3;
      }
      var best = -1, bi = -1;
      for (o = 1; o < 2 * R; o++) {
        var dv = pol * (prof[o + 1] - prof[o - 1]);
        if (dv > best) { best = dv; bi = o; }
      }
      if (best < 6 || bi < 2 || bi > 2 * R - 2) continue;
      var dm = pol * (prof[bi] - prof[bi - 2]), dp = pol * (prof[bi + 2] - prof[bi]);
      var den = dm - 2 * best + dp, off = den < 0 ? clamp(0.5 * (dm - dp) / den, -0.5, 0.5) : 0;
      var pos = bi - R + off;
      xs.push(bx + pos * nx); ys.push(by + pos * ny);
    }
    if (xs.length < 0.4 * K) return null;
    var L = fitPoints(xs, ys);
    if (!L || L.inliers < 0.35 * K) return null;
    if (L.nx * nx + L.ny * ny < 0) { L.nx = -L.nx; L.ny = -L.ny; L.c = -L.c; }
    if (Math.acos(clamp(L.nx * nx + L.ny * ny, -1, 1)) > 4 * DEG) return null;
    var mxp = (P[0] + Q[0]) / 2, myp = (P[1] + Q[1]) / 2;
    if (Math.abs(L.nx * mxp + L.ny * myp - L.c) > R) return null;
    return L;
  }

  function refineQuad(img, C, best, scale) {
    var W = img.width, H = img.height, R = Math.max(4, Math.ceil(2 * scale + 2)), i;
    var cx = (C[0][0] + C[1][0] + C[2][0] + C[3][0]) / 4, cy = (C[0][1] + C[1][1] + C[2][1] + C[3][1]) / 4;
    var sides = [];
    for (i = 0; i < 4; i++) {
      var sd = best.sides[i], P = C[i], Q = C[(i + 1) & 3];
      if (sd.border) { sides.push(borderLineFull(sd.border, W, H)); continue; }
      var ln = lineThrough(P, Q, cx, cy);
      sides.push(refineSide(img, P, Q, ln, sd.pol, R, scale) || ln);
    }
    var out = [];
    for (i = 0; i < 4; i++) {
      var p = intersectC(sides[(i + 3) & 3], sides[i]);
      if (!p || Math.hypot(p[0] - C[i][0], p[1] - C[i][1]) > R * 1.5 + 2) p = C[i].slice();
      out.push(p);
    }
    return out;
  }

  // -------------------------------------------------------------- detection

  function detectQuad(img, opts) {
    checkImage(img);
    opts = opts || {};
    var W = img.width, H = img.height;
    var fallback = { quad: [[0, 0], [W, 0], [W, H], [0, H]], confidence: 0, method: 'fallback' };
    var small = downscale(img, opts.maxSide || 640);
    var w = small.width, h = small.height;
    if (w < 24 || h < 24) return fallback;
    var grey = blurGauss(toGrey(small), w, h, opts.sigma || 1.4);
    var cn = canny(grey, w, h);
    var lines = houghLines(cn, w, h);
    addBorderLines(lines, w, h);
    for (var i = 0; i < lines.length; i++) buildProfile(lines[i], cn, grey, w, h);
    var best = searchQuads(lines, w, h);
    if (!best) return fallback;
    var sx = W / w, sy = H / h, hw = w / 2, hh = h / 2;
    var quad = best.corners.map(function (c) { return [(c[0] + hw) * sx, (c[1] + hh) * sy]; });
    if (opts.refine !== false) quad = refineQuad(img, quad, best, Math.max(sx, sy));
    // Corners may sit a little outside the photo; keep them within 2%.
    var mx = 0.02 * W, my = 0.02 * H;
    quad = quad.map(function (c) { return [clamp(c[0], -mx, W + mx), clamp(c[1], -my, H + my)]; });
    return {
      quad: orderCorners(quad),
      confidence: Math.round(clamp(best.confidence, 0, 1) * 1000) / 1000,
      method: best.borders ? 'lines+border' : 'lines'
    };
  }

  function orderCorners(points) {
    if (!points || points.length !== 4) throw new TypeError('MVRScanVision.orderCorners: expected four points');
    var p = points.map(function (q) { return Array.isArray(q) ? [+q[0], +q[1]] : [+q.x, +q.y]; });
    var cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4, cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
    p.sort(function (a, b) { return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx); });
    // p is now clockwise on screen (y down). Start at the point that best
    // matches the top-left of the bounding box.
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    p.forEach(function (q) { minx = Math.min(minx, q[0]); maxx = Math.max(maxx, q[0]); miny = Math.min(miny, q[1]); maxy = Math.max(maxy, q[1]); });
    var B = [[minx, miny], [maxx, miny], [maxx, maxy], [minx, maxy]], bestS = 0, bestD = Infinity;
    for (var s = 0; s < 4; s++) {
      var d = 0;
      for (var i = 0; i < 4; i++) {
        var q = p[(i + s) & 3];
        d += (q[0] - B[i][0]) * (q[0] - B[i][0]) + (q[1] - B[i][1]) * (q[1] - B[i][1]);
      }
      if (d < bestD) { bestD = d; bestS = s; }
    }
    return [p[bestS], p[(bestS + 1) & 3], p[(bestS + 2) & 3], p[(bestS + 3) & 3]];
  }

  // ------------------------------------------------------------------- warp

  // Homography taking the four src points to the four dst points, as nine
  // numbers (h8 = 1). Null when the points are degenerate.
  function homography(src, dst) {
    var A = [], i, j, k;
    for (i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], X = dst[i][0], Y = dst[i][1];
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
    }
    for (i = 0; i < 8; i++) {
      var piv = i;
      for (j = i + 1; j < 8; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      if (Math.abs(A[piv][i]) < 1e-12) return null;
      var tmp = A[i]; A[i] = A[piv]; A[piv] = tmp;
      for (j = 0; j < 8; j++) {
        if (j === i) continue;
        var f = A[j][i] / A[i][i];
        if (!f) continue;
        for (k = i; k < 9; k++) A[j][k] -= f * A[i][k];
      }
    }
    var h = [];
    for (i = 0; i < 8; i++) h.push(A[i][8] / A[i][i]);
    h.push(1);
    return h;
  }

  function applyHomography(h, x, y) {
    var z = h[6] * x + h[7] * y + h[8];
    return [(h[0] * x + h[1] * y + h[2]) / z, (h[3] * x + h[4] * y + h[5]) / z];
  }

  // quad is [TL, TR, BR, BL] in the input's coordinates; it is used as given.
  function warp(img, quad, outW, outH) {
    checkImage(img);
    outW = Math.max(1, Math.round(outW)); outH = Math.max(1, Math.round(outH));
    var h = homography([[0, 0], [outW, 0], [outW, outH], [0, outH]], quad);
    if (!h) throw new Error('MVRScanVision.warp: degenerate quad');
    var W = img.width, H = img.height, d = img.data, out = makeImage(outW, outH), od = out.data;
    var h0 = h[0], h1 = h[1], h2 = h[2], h3 = h[3], h4 = h[4], h5 = h[5], h6 = h[6], h7 = h[7], h8 = h[8];
    var maxX = W - 1, maxY = H - 1, stride = W * 4, o = 0;
    for (var v = 0; v < outH; v++) {
      var yv = v + 0.5;
      var X = h0 * 0.5 + h1 * yv + h2, Y = h3 * 0.5 + h4 * yv + h5, Z = h6 * 0.5 + h7 * yv + h8;
      for (var u = 0; u < outW; u++) {
        var iz = 1 / Z, fx = X * iz - 0.5, fy = Y * iz - 0.5;
        X += h0; Y += h3; Z += h6;
        if (fx < 0) fx = 0; else if (fx > maxX) fx = maxX;
        if (fy < 0) fy = 0; else if (fy > maxY) fy = maxY;
        var x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
        var i00 = y0 * stride + x0 * 4;
        var i10 = x0 < maxX ? i00 + 4 : i00;
        var i01 = y0 < maxY ? i00 + stride : i00;
        var i11 = x0 < maxX ? i01 + 4 : i01;
        var w11 = ax * ay, w10 = ax - w11, w01 = ay - w11, w00 = 1 - ax - ay + w11;
        od[o] = d[i00] * w00 + d[i10] * w10 + d[i01] * w01 + d[i11] * w11;
        od[o + 1] = d[i00 + 1] * w00 + d[i10 + 1] * w10 + d[i01 + 1] * w01 + d[i11 + 1] * w11;
        od[o + 2] = d[i00 + 2] * w00 + d[i10 + 2] * w10 + d[i01 + 2] * w01 + d[i11 + 2] * w11;
        od[o + 3] = 255;
        o += 4;
      }
    }
    return out;
  }

  // ---------------------------------------------------------- suggestSize

  var PAPER = [
    { name: 'A4', ratio: 210 / 297 }, { name: 'A4', ratio: 297 / 210 },
    { name: 'Letter', ratio: 8.5 / 11 }, { name: 'Letter', ratio: 11 / 8.5 }
  ];

  // Width / height of the rectangle seen as quad (TL, TR, BR, BL). With the
  // photo's size known, the camera's focal length is recovered from the
  // perspective (Zhang & He, "Whiteboard scanning and image enhancement",
  // 2007), principal point at the photo's centre; that gives the true
  // aspect ratio rather than the foreshortened one.
  // When the page is tilted about one axis only, its other pair of sides
  // stays parallel in the photo and the focal length cannot be measured;
  // then focalPx is used if given (from EXIF, say), else a typical phone's
  // 26 mm-equivalent lens, 0.78 x the photo's longest side.
  function aspectFromQuad(q, W, H, focalPx) {
    var u0 = W / 2, v0 = H / 2;
    function hp(p) { return [p[0] - u0, p[1] - v0, 1]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    var m1 = hp(q[0]), m2 = hp(q[1]), m3 = hp(q[3]), m4 = hp(q[2]);
    var c14 = cross(m1, m4);
    var den2 = dot(cross(m2, m4), m3), den3 = dot(cross(m3, m4), m2);
    if (Math.abs(den2) < 1e-9 || Math.abs(den3) < 1e-9) return null;
    var k2 = dot(c14, m3) / den2, k3 = dot(c14, m2) / den3;
    var n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
    var n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
    var diag = Math.hypot(W, H), f2 = NaN, method = 'perspective';
    // Both pairs of opposite sides must converge clearly (two vanishing
    // points) for the focal length to be measurable.
    function sideAng(a, b, c, d) {
      var u = Math.atan2(b[1] - a[1], b[0] - a[0]), v = Math.atan2(c[1] - d[1], c[0] - d[0]);
      return angDiff(u, v);
    }
    var conv = Math.min(sideAng(q[0], q[1], q[2], q[3]), sideAng(q[0], q[3], q[2], q[1]));
    if (conv > 2.5 * DEG && Math.abs(n2[2] * n3[2]) > 1e-12) f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
    if (!(f2 > 0) || Math.sqrt(f2) < 0.3 * diag || Math.sqrt(f2) > 4 * diag) {
      // Too little perspective to measure the lens.
      f2 = Math.pow(focalPx > 0 ? focalPx : 0.78 * Math.max(W, H), 2); method = 'perspective-assumed-lens';
    }
    var a = (n2[0] * n2[0] + n2[1] * n2[1]) / f2 + n2[2] * n2[2];
    var b = (n3[0] * n3[0] + n3[1] * n3[1]) / f2 + n3[2] * n3[2];
    if (!(a > 0) || !(b > 0)) return null;
    return { ratio: Math.sqrt(a / b), method: method };
  }

  function suggestSize(quad, opts) {
    opts = opts || {};
    var q = quad.map(function (p) { return Array.isArray(p) ? [+p[0], +p[1]] : [+p.x, +p.y]; });
    function len(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
    var top = len(q[0], q[1]), bottom = len(q[3], q[2]), left = len(q[0], q[3]), right = len(q[1], q[2]);
    var ratio = (top + bottom) / Math.max(1e-9, left + right), method = 'sides';
    if (opts.imageWidth > 0 && opts.imageHeight > 0) {
      var est = aspectFromQuad(q, opts.imageWidth, opts.imageHeight, opts.focalPx);
      // Trust it unless it disagrees wildly with the plain side lengths.
      if (est && est.ratio / ratio < 1.8 && ratio / est.ratio < 1.8) { ratio = est.ratio; method = est.method; }
    }
    var snapped = null;
    if (opts.snap !== false) {
      var bestE = 0.03, bestI = -1;
      for (var i = 0; i < PAPER.length; i++) {
        var e = Math.abs(ratio / PAPER[i].ratio - 1);
        if (e <= bestE) { bestE = e; bestI = i; }
      }
      if (bestI >= 0) { snapped = PAPER[bestI].name; ratio = PAPER[bestI].ratio; }
    }
    var hPx = Math.max(left, right), wPx = Math.max(top, bottom);
    var height = Math.max(hPx, wPx / ratio), width = height * ratio;
    if (opts.maxSide > 0 && Math.max(width, height) > opts.maxSide) {
      var s = opts.maxSide / Math.max(width, height); width *= s; height *= s;
    }
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), ratio: ratio, snapped: snapped, method: method };
  }

  // --------------------------------------------------------------- enhance

  function maxFilter(a, gw, gh, r) {
    var t = new Float32Array(a.length), o = new Float32Array(a.length), x, y, k;
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
      var m = 0;
      for (k = Math.max(0, x - r); k <= Math.min(gw - 1, x + r); k++) if (a[y * gw + k] > m) m = a[y * gw + k];
      t[y * gw + x] = m;
    }
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
      var mm = 0;
      for (k = Math.max(0, y - r); k <= Math.min(gh - 1, y + r); k++) if (t[k * gw + x] > mm) mm = t[k * gw + x];
      o[y * gw + x] = mm;
    }
    return o;
  }

  function boxFilter(a, gw, gh, r) {
    var t = new Float32Array(a.length), o = new Float32Array(a.length), x, y, k;
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
      var s = 0, c = 0;
      for (k = Math.max(0, x - r); k <= Math.min(gw - 1, x + r); k++) { s += a[y * gw + k]; c++; }
      t[y * gw + x] = s / c;
    }
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
      var s2 = 0, c2 = 0;
      for (k = Math.max(0, y - r); k <= Math.min(gh - 1, y + r); k++) { s2 += t[k * gw + x]; c2++; }
      o[y * gw + x] = s2 / c2;
    }
    return o;
  }

  // Background (paper) estimate on a coarse grid: block means, a max filter
  // to step over the ink, then two box blurs to smooth it. Never darker than
  // 40% of the brightest paper, so a large dark figure is not bleached.
  function backgroundGrid(a, gw, gh) {
    var bg = boxFilter(boxFilter(maxFilter(a, gw, gh, 3), gw, gh, 3), gw, gh, 3);
    var sorted = Array.prototype.slice.call(bg).sort(function (p, q) { return p - q; });
    var floor = Math.max(8, 0.4 * sorted[Math.floor(0.95 * (sorted.length - 1))]);
    for (var i = 0; i < bg.length; i++) if (bg[i] < floor) bg[i] = floor;
    return bg;
  }

  function sauvola(L, W, H, r, k, Rr) {
    var out = new Uint8Array(W * H), colS = new Float64Array(W), colQ = new Float64Array(W);
    var P = new Float64Array(W + 1), Q = new Float64Array(W + 1), x, y, v;
    function addRow(yy, sgn) {
      var b = yy * W;
      for (var xx = 0; xx < W; xx++) { var t = L[b + xx]; colS[xx] += sgn * t; colQ[xx] += sgn * t * t; }
    }
    for (y = 0; y <= Math.min(r, H - 1); y++) addRow(y, 1);
    for (y = 0; y < H; y++) {
      if (y > 0) {
        if (y + r < H) addRow(y + r, 1);
        if (y - r - 1 >= 0) addRow(y - r - 1, -1);
      }
      var rows = Math.min(H - 1, y + r) - Math.max(0, y - r) + 1;
      for (x = 0; x < W; x++) { P[x + 1] = P[x] + colS[x]; Q[x + 1] = Q[x] + colQ[x]; }
      var b = y * W;
      for (x = 0; x < W; x++) {
        var x0 = x - r < 0 ? 0 : x - r, x1 = x + r >= W ? W - 1 : x + r;
        var n = (x1 - x0 + 1) * rows, s = P[x1 + 1] - P[x0], q = Q[x1 + 1] - Q[x0];
        var m = s / n, sd = Math.sqrt(Math.max(0, q / n - m * m));
        var T = m * (1 + k * (sd / Rr - 1));
        v = L[b + x];
        out[b + x] = (v >= 230 || (v > T && v >= 90)) ? 255 : 0;
      }
    }
    return out;
  }

  function enhance(img, mode) {
    checkImage(img);
    mode = mode === 'color' ? 'colour' : mode === 'gray' ? 'grey' : (mode || 'colour');
    if (mode !== 'colour' && mode !== 'grey' && mode !== 'bw' && mode !== 'none') {
      throw new TypeError('MVRScanVision.enhance: unknown mode ' + mode);
    }
    var W = img.width, H = img.height, N = W * H, d = img.data, out = makeImage(W, H), od = out.data, x, y, i, p;
    if (mode === 'none') { od.set(d.subarray(0, N * 4)); return out; }
    var colour = mode === 'colour', nc = colour ? 3 : 1;
    var cs = Math.max(4, Math.round(Math.max(W, H) / 140));
    var gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    var grids = [], c;
    for (c = 0; c < nc; c++) grids.push(new Float32Array(G));
    var gxOf = new Int32Array(W), cntX = new Float32Array(gw), cntY = new Float32Array(gh);
    for (x = 0; x < W; x++) { gxOf[x] = Math.min(gw - 1, (x / cs) | 0); cntX[gxOf[x]]++; }
    var lum = colour ? null : new Uint8Array(N);
    for (y = 0, i = 0, p = 0; y < H; y++) {
      var gyy = Math.min(gh - 1, (y / cs) | 0), gb = gyy * gw;
      cntY[gyy]++;
      for (x = 0; x < W; x++, i += 4, p++) {
        var g = gb + gxOf[x];
        if (colour) { grids[0][g] += d[i]; grids[1][g] += d[i + 1]; grids[2][g] += d[i + 2]; }
        else { var l = (77 * d[i] + 150 * d[i + 1] + 29 * d[i + 2] + 128) >> 8; lum[p] = l; grids[0][g] += l; }
      }
    }
    for (c = 0; c < nc; c++) {
      for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) grids[c][y * gw + x] /= cntX[x] * cntY[y];
      grids[c] = backgroundGrid(grids[c], gw, gh);
    }
    // Bilinear interpolation of the grid, one row at a time.
    var x0a = new Int32Array(W), x1a = new Int32Array(W), wxa = new Float32Array(W);
    for (x = 0; x < W; x++) {
      var fx = (x + 0.5) / cs - 0.5, xi = Math.floor(fx);
      wxa[x] = clamp(fx - xi, 0, 1);
      x0a[x] = clamp(xi, 0, gw - 1); x1a[x] = clamp(xi + 1, 0, gw - 1);
      if (xi < 0) wxa[x] = 0;
    }
    var colRow = [], rowBg = [];
    for (c = 0; c < nc; c++) { colRow.push(new Float32Array(gw)); rowBg.push(new Float32Array(W)); }
    var hist = new Uint32Array(256);
    for (y = 0, i = 0, p = 0; y < H; y++) {
      var fy = (y + 0.5) / cs - 0.5, yi = Math.floor(fy), wy = clamp(fy - yi, 0, 1);
      if (yi < 0) wy = 0;
      var y0 = clamp(yi, 0, gh - 1) * gw, y1 = clamp(yi + 1, 0, gh - 1) * gw;
      for (c = 0; c < nc; c++) {
        var gr = grids[c], cr = colRow[c], rb = rowBg[c];
        for (x = 0; x < gw; x++) cr[x] = gr[y0 + x] * (1 - wy) + gr[y1 + x] * wy;
        for (x = 0; x < W; x++) rb[x] = 255 / (cr[x0a[x]] * (1 - wxa[x]) + cr[x1a[x]] * wxa[x]);
      }
      if (colour) {
        var rR = rowBg[0], rG = rowBg[1], rB = rowBg[2];
        for (x = 0; x < W; x++, i += 4) {
          var R = d[i] * rR[x], Gc = d[i + 1] * rG[x], Bc = d[i + 2] * rB[x];
          if (R > 255) R = 255; if (Gc > 255) Gc = 255; if (Bc > 255) Bc = 255;
          od[i] = R; od[i + 1] = Gc; od[i + 2] = Bc;
          hist[(0.299 * R + 0.587 * Gc + 0.114 * Bc) | 0]++;
        }
      } else {
        var rL = rowBg[0];
        for (x = 0; x < W; x++, i += 4, p++) {
          var v = lum[p] * rL[x];
          if (v > 255) v = 255;
          od[i] = v;
          hist[od[i]]++;
        }
      }
    }
    // Gentle levels: the darkest ink towards black, the paper to white.
    function pct(q) { var t = q * N, a = 0; for (var k = 0; k < 256; k++) { a += hist[k]; if (a >= t) return k; } return 255; }
    var bp = Math.min(pct(0.005), 70), wp = clamp(pct(0.6) * 0.97, 160, 255);
    if (wp - bp < 64) bp = Math.max(0, wp - 64);
    var lut = new Uint8ClampedArray(256);
    for (var v2 = 0; v2 < 256; v2++) lut[v2] = (v2 - bp) * 255 / (wp - bp);
    if (colour) {
      for (i = 0; i < N * 4; i += 4) { od[i] = lut[od[i]]; od[i + 1] = lut[od[i + 1]]; od[i + 2] = lut[od[i + 2]]; od[i + 3] = 255; }
      return out;
    }
    var L2 = new Uint8Array(N);
    for (p = 0, i = 0; p < N; p++, i += 4) L2[p] = lut[od[i]];
    if (mode === 'bw') {
      var r = Math.max(8, Math.round(Math.max(W, H) / 50));
      L2 = sauvola(L2, W, H, r, 0.2, 128);
    }
    for (p = 0, i = 0; p < N; p++, i += 4) { var t = L2[p]; od[i] = t; od[i + 1] = t; od[i + 2] = t; od[i + 3] = 255; }
    return out;
  }

  // ---------------------------------------------------------------- rotate

  function rotate90(img, quarterTurns) {
    checkImage(img);
    var q = (((quarterTurns | 0) % 4) + 4) % 4, W = img.width, H = img.height, N = W * H;
    var src = img.data;
    if (src.byteOffset % 4) src = new Uint8ClampedArray(src);
    var s32 = new Uint32Array(src.buffer, src.byteOffset, N);
    var out = q % 2 ? makeImage(H, W) : makeImage(W, H);
    var o32 = new Uint32Array(out.data.buffer), x, y, i = 0;
    if (q === 0) { o32.set(s32); return out; }
    if (q === 2) { for (i = 0; i < N; i++) o32[N - 1 - i] = s32[i]; return out; }
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++, i++) {
        // clockwise: (x, y) -> (H-1-y, x); anticlockwise: (x, y) -> (y, W-1-x)
        if (q === 1) o32[x * H + (H - 1 - y)] = s32[i];
        else o32[(W - 1 - x) * H + y] = s32[i];
      }
    }
    return out;
  }

  return {
    version: '1.0.0',
    downscale: downscale,
    detectQuad: detectQuad,
    warp: warp,
    suggestSize: suggestSize,
    enhance: enhance,
    rotate90: rotate90,
    orderCorners: orderCorners,
    homography: homography,
    applyHomography: applyHomography
  };
}));
