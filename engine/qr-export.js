/* ============================================================
   QR export: vector PDF and EPS, a PNG's DPI, and PDF label sheets.

   Written for the three /qr/ tools (engine/render-qr.js), from the
   specifications rather than a library:
     - PDF 1.4 (ISO 32000-1): pages, content streams, Flate streams,
       axial/radial shadings, RGB images with a soft mask, the standard
       Helvetica fonts in WinAnsiEncoding;
     - PostScript Level 3 EPS (Adobe EPSF 3.0): the same paths, shfill for
       gradients, an RGB image for a logo;
     - PNG (ISO 15948): the pHYs chunk that carries pixels per metre.

   The input is the SVG the page already shows and has already read back,
   parsed here into paths, gradients, images and text. Drawing the PDF from
   that one SVG, rather than from a second renderer, is what keeps the PDF
   the same artwork as the code that was verified: every module, rounded
   corner and eye is the same path data, turned into PDF path operators
   (SVG arcs become cubic Bezier curves, as the SVG spec's appendix on arc
   implementation describes).

   Loaded on demand by render-qr.js the first time something is exported.
   Runs in a browser and in Node (the tests load it in a vm).
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------------- numbers and colours ---------------- */

  const nf = (v) => {
    const s = (Math.round(v * 10000) / 10000).toString();
    return s === '-0' ? '0' : s;
  };

  /** '#rrggbb' or '#rgb' as [r, g, b] in 0..1, or null for none/transparent. */
  function colour(c) {
    if (!c || c === 'none' || c === 'transparent') return null;
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) {
      const n = parseInt(m[1], 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return m[1].split('').map((h) => parseInt(h + h, 16) / 255);
    m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(c);
    if (m) return [m[1] / 255, m[2] / 255, m[3] / 255];
    if (/^black$/i.test(c)) return [0, 0, 0];
    if (/^white$/i.test(c)) return [1, 1, 1];
    return [0, 0, 0];
  }

  /* ---------------- the SVG subset ---------------- */

  function decodeEntities(s) {
    return String(s)
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  function attrs(s) {
    const out = {};
    const re = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(s))) out[m[1]] = decodeEntities(m[3] !== undefined ? m[3] : m[4]);
    return out;
  }

  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]
  ];

  /** translate(), scale() and matrix() — what the QR tools write. */
  function parseTransform(t) {
    let m = [1, 0, 0, 1, 0, 0];
    const re = /(translate|scale|matrix)\s*\(([^)]*)\)/g;
    let x;
    while ((x = re.exec(t || ''))) {
      const n = x[2].split(/[\s,]+/).filter(Boolean).map(Number);
      if (x[1] === 'translate') m = mul(m, [1, 0, 0, 1, n[0] || 0, n[1] || 0]);
      else if (x[1] === 'scale') m = mul(m, [n[0], 0, 0, n.length > 1 ? n[1] : n[0], 0, 0]);
      else if (n.length === 6) m = mul(m, n);
    }
    return m;
  }

  /**
   * The SVG as a list of things to paint, in order. Only the elements the
   * QR tools write are understood: svg, g, defs, linearGradient,
   * radialGradient, stop, rect, path, image and text.
   */
  function parseSVG(svg) {
    const s = String(svg);
    const head = /<svg\b([^>]*)>/.exec(s);
    if (!head) throw new Error('Not an SVG');
    const ra = attrs(head[1]);
    const vb = (ra.viewBox || ('0 0 ' + (parseFloat(ra.width) || 100) + ' ' + (parseFloat(ra.height) || 100)))
      .split(/[\s,]+/).map(Number);
    const out = {
      width: parseFloat(ra.width) || vb[2], height: parseFloat(ra.height) || vb[3],
      vb: vb, items: [], grads: {}
    };
    const stack = [[1, 0, 0, 1, 0, 0]];
    let grad = null;
    const re = /<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>|([^<]+)/g;
    let m, textNode = null;
    re.lastIndex = head.index + head[0].length;
    while ((m = re.exec(s))) {
      if (m[5] !== undefined) {
        if (textNode) textNode.text += decodeEntities(m[5]);
        continue;
      }
      const close = m[1] === '/', tag = m[2], a = close ? {} : attrs(m[3]), self = m[4] === '/';
      const top = stack[stack.length - 1];
      if (close) {
        if (tag === 'g' || tag === 'svg') stack.pop();
        else if (tag === 'text') textNode = null;
        else if (/Gradient$/.test(tag)) grad = null;
        continue;
      }
      if (tag === 'g' || tag === 'svg') {
        let t = parseTransform(a.transform);
        if (tag === 'svg') {
          /* a nested svg: x, y and a viewBox scaled into width x height */
          const x = parseFloat(a.x) || 0, y = parseFloat(a.y) || 0;
          const v = (a.viewBox || '').split(/[\s,]+/).map(Number);
          if (v.length === 4 && a.width && a.height) {
            t = [parseFloat(a.width) / v[2], 0, 0, parseFloat(a.height) / v[3], x - v[0] * parseFloat(a.width) / v[2], y - v[1] * parseFloat(a.height) / v[3]];
          } else t = [1, 0, 0, 1, x, y];
        }
        if (!self) stack.push(mul(top, t));
        continue;
      }
      if (tag === 'linearGradient' || tag === 'radialGradient') {
        grad = { type: tag === 'radialGradient' ? 'radial' : 'linear', a: a, stops: [] };
        if (a.id) out.grads[a.id] = grad;
        if (self) grad = null;
        continue;
      }
      if (tag === 'stop' && grad) {
        grad.stops.push({ offset: parseFloat(a.offset) / (/%/.test(a.offset || '') ? 100 : 1) || 0, colour: a['stop-color'] || '#000000' });
        continue;
      }
      const mtx = mul(top, parseTransform(a.transform));
      if (tag === 'rect') {
        const x = parseFloat(a.x) || 0, y = parseFloat(a.y) || 0, w = parseFloat(a.width) || 0, h = parseFloat(a.height) || 0;
        if (w > 0 && h > 0) out.items.push({ kind: 'path', segs: [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']], fill: a.fill || '#000000', rule: 'nonzero', m: mtx });
      } else if (tag === 'path') {
        if (a.d) out.items.push({ kind: 'path', segs: pathSegments(a.d), fill: a.fill === undefined ? '#000000' : a.fill, rule: a['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero', m: mtx });
      } else if (tag === 'image') {
        out.items.push({ kind: 'image', href: a.href || a['xlink:href'] || '', x: parseFloat(a.x) || 0, y: parseFloat(a.y) || 0, w: parseFloat(a.width) || 0, h: parseFloat(a.height) || 0, m: mtx });
      } else if (tag === 'text') {
        textNode = {
          kind: 'text', text: '', x: parseFloat(a.x) || 0, y: parseFloat(a.y) || 0,
          size: parseFloat(a['font-size']) || 1, bold: /bold|[6-9]00/.test(a['font-weight'] || ''),
          anchor: a['text-anchor'] || 'start', fill: a.fill || '#000000', m: mtx
        };
        out.items.push(textNode);
        if (self) textNode = null;
      }
    }
    return out;
  }

  /* ---------------- path data ---------------- */

  /** SVG path data as absolute M, L, C and Z segments. */
  function pathSegments(d) {
    const src = String(d);
    let i = 0;
    const isNum = /[-+0-9.]/;
    const ws = () => { while (i < src.length && /[\s,]/.test(src[i])) i++; };
    const num = () => {
      ws();
      const m = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(src.slice(i));
      if (!m) throw new Error('Bad path data near ' + src.slice(i, i + 12));
      i += m[0].length;
      return parseFloat(m[0]);
    };
    const flag = () => { ws(); const c = src[i++]; if (c !== '0' && c !== '1') throw new Error('Bad arc flag'); return c === '1'; };
    const out = [];
    let cx = 0, cy = 0, sx = 0, sy = 0, cmd = '';
    while (true) {
      ws();
      if (i >= src.length) break;
      if (/[A-Za-z]/.test(src[i])) cmd = src[i++];
      else if (!isNum.test(src[i])) throw new Error('Bad path data');
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (C === 'Z') { out.push(['Z']); cx = sx; cy = sy; continue; }
      if (C === 'M') {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        out.push(['M', x, y]); cx = sx = x; cy = sy = y;
        cmd = rel ? 'l' : 'L';                 // further pairs are lines
      } else if (C === 'L') {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        out.push(['L', x, y]); cx = x; cy = y;
      } else if (C === 'H') {
        let x = num(); if (rel) x += cx;
        out.push(['L', x, cy]); cx = x;
      } else if (C === 'V') {
        let y = num(); if (rel) y += cy;
        out.push(['L', cx, y]); cy = y;
      } else if (C === 'C') {
        const v = [num(), num(), num(), num(), num(), num()];
        if (rel) for (let k = 0; k < 6; k += 2) { v[k] += cx; v[k + 1] += cy; }
        out.push(['C'].concat(v)); cx = v[4]; cy = v[5];
      } else if (C === 'Q') {
        const v = [num(), num(), num(), num()];
        if (rel) { v[0] += cx; v[1] += cy; v[2] += cx; v[3] += cy; }
        out.push(['C', cx + 2 / 3 * (v[0] - cx), cy + 2 / 3 * (v[1] - cy), v[2] + 2 / 3 * (v[0] - v[2]), v[3] + 2 / 3 * (v[1] - v[3]), v[2], v[3]]);
        cx = v[2]; cy = v[3];
      } else if (C === 'A') {
        const rx = num(), ry = num(), rot = num(), fa = flag(), fs = flag();
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        arcToCubics(cx, cy, rx, ry, rot, fa, fs, x, y).forEach((s) => out.push(s));
        cx = x; cy = y;
      } else throw new Error('Path command ' + cmd + ' is not supported');
    }
    return out;
  }

  /** An elliptical arc as cubic Beziers (SVG 1.1 appendix F.6.5 and F.6.6). */
  function arcToCubics(x1, y1, rx, ry, rotDeg, fa, fs, x2, y2) {
    if (x1 === x2 && y1 === y2) return [];
    rx = Math.abs(rx); ry = Math.abs(ry);
    if (!rx || !ry) return [['L', x2, y2]];
    const phi = rotDeg * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
    const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lam > 1) { const k = Math.sqrt(lam); rx *= k; ry *= k; }
    const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
    const den = rx * rx * yp * yp + ry * ry * xp * xp;
    const co = (fa !== fs ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
    const cxp = co * rx * yp / ry, cyp = -co * ry * xp / rx;
    const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => {
      const d = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))));
      return (ux * vy - uy * vx < 0 ? -1 : 1) * Math.acos(d);
    };
    const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI;
    else if (fs && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
    const step = dt / n, t = 4 / 3 * Math.tan(step / 4);
    const pt = (a) => [cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin, cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos];
    const dv = (a) => [-rx * Math.sin(a) * cos - ry * Math.cos(a) * sin, -rx * Math.sin(a) * sin + ry * Math.cos(a) * cos];
    const out = [];
    for (let k = 0; k < n; k++) {
      const a1 = t1 + k * step, a2 = a1 + step;
      const p1 = pt(a1), p2 = k === n - 1 ? [x2, y2] : pt(a2), d1 = dv(a1), d2 = dv(a2);
      out.push(['C', p1[0] + t * d1[0], p1[1] + t * d1[1], p2[0] - t * d2[0], p2[1] - t * d2[1], p2[0], p2[1]]);
    }
    return out;
  }

  /** Path operators, with axis-aligned four-sided subpaths written as `re`. */
  function pathOps(segs, rectOp) {
    let out = '';
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s[0] === 'M' && rectOp) {
        const a = segs[i + 1], b = segs[i + 2], c = segs[i + 3], z = segs[i + 4];
        if (a && b && c && z && a[0] === 'L' && b[0] === 'L' && c[0] === 'L' && z[0] === 'Z') {
          const xs = [s[1], a[1], b[1], c[1]], ys = [s[2], a[2], b[2], c[2]];
          const axis = (s[1] === a[1] || s[2] === a[2]) && (a[1] === b[1] || a[2] === b[2]) &&
                       (b[1] === c[1] || b[2] === c[2]) && (c[1] === s[1] || c[2] === s[2]);
          if (axis && new Set(xs).size === 2 && new Set(ys).size === 2) {
            const x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
            out += nf(x0) + ' ' + nf(y0) + ' ' + nf(Math.max.apply(null, xs) - x0) + ' ' + nf(Math.max.apply(null, ys) - y0) + ' ' + rectOp + '\n';
            i += 4;
            continue;
          }
        }
      }
      if (s[0] === 'M') out += nf(s[1]) + ' ' + nf(s[2]) + ' m\n';
      else if (s[0] === 'L') out += nf(s[1]) + ' ' + nf(s[2]) + ' l\n';
      else if (s[0] === 'C') out += nf(s[1]) + ' ' + nf(s[2]) + ' ' + nf(s[3]) + ' ' + nf(s[4]) + ' ' + nf(s[5]) + ' ' + nf(s[6]) + ' c\n';
      else out += 'h\n';
    }
    return out;
  }

  function bbox(segs) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    segs.forEach((s) => {
      for (let k = 1; k + 1 < s.length; k += 2) {
        x0 = Math.min(x0, s[k]); x1 = Math.max(x1, s[k]);
        y0 = Math.min(y0, s[k + 1]); y1 = Math.max(y1, s[k + 1]);
      }
    });
    return isFinite(x0) ? [x0, y0, x1 - x0 || 1e-6, y1 - y0 || 1e-6] : null;
  }

  /** objectBoundingBox gradient geometry, in the unit square. */
  function gradGeometry(g) {
    const pc = (v, d) => {
      if (v === undefined) return d;
      return /%$/.test(v) ? parseFloat(v) / 100 : parseFloat(v);
    };
    const stops = g.stops.length ? g.stops : [{ offset: 0, colour: '#000000' }, { offset: 1, colour: '#000000' }];
    const c0 = colour(stops[0].colour) || [0, 0, 0], c1 = colour(stops[stops.length - 1].colour) || [0, 0, 0];
    if (g.type === 'radial') {
      const cx = pc(g.a.cx, 0.5), cy = pc(g.a.cy, 0.5), r = pc(g.a.r, 0.5);
      return { type: 3, coords: [cx, cy, 0, cx, cy, r], c0: c0, c1: c1 };
    }
    return { type: 2, coords: [pc(g.a.x1, 0), pc(g.a.y1, 0), pc(g.a.x2, 1), pc(g.a.y2, 0)], c0: c0, c1: c1 };
  }

  /* ---------------- text ---------------- */

  /* Adobe's AFM widths for Helvetica and Helvetica-Bold, characters 32 to
     126 (the same tables engine/pdfcore.bundle.js uses). Arial was drawn to
     the same widths, so the SVG and the PDF centre a label alike. */
  const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const HELVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

  /* WinAnsiEncoding: Latin-1 plus the characters Windows-1252 puts in 128-159. */
  const CP1252 = { 0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017D: 142, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156, 0x017E: 158, 0x0178: 159 };
  function winAnsi(ch) {
    const c = ch.codePointAt(0);
    if (c >= 32 && c <= 126) return c;
    if (c >= 160 && c <= 255) return c;
    return CP1252[c] || null;
  }
  /** Whether every character of a label can be set in the built-in fonts. */
  function fitsWinAnsi(text) {
    for (const ch of String(text)) if (winAnsi(ch) === null) return false;
    return true;
  }
  function textWidth(text, bold, size) {
    const t = bold ? HELVB : HELV;
    let u = 0;
    for (const ch of String(text)) {
      const c = ch.codePointAt(0);
      u += c >= 32 && c <= 126 ? t[c - 32] : c === 0x2026 ? 1000 : 556;
    }
    return u * size / 1000;
  }
  function fitText(text, bold, size, maxW) {
    let s = String(text);
    if (textWidth(s, bold, size) <= maxW) return s;
    while (s.length > 1 && textWidth(s + '…', bold, size) > maxW) s = s.slice(0, -1);
    return s.replace(/\s+$/, '') + '…';
  }
  /** A PDF or PostScript string literal in WinAnsi codes. */
  function strLit(text) {
    let o = '(';
    for (const ch of String(text)) {
      const c = winAnsi(ch);
      if (c === null) { o += '?'; continue; }
      if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c);
      else if (c >= 32 && c <= 126) o += String.fromCharCode(c);
      else o += '\\' + c.toString(8).padStart(3, '0');
    }
    return o + ')';
  }

  /* ---------------- images ---------------- */

  /** preserveAspectRatio="xMidYMid meet": the box an image really fills. */
  function meet(it, img) {
    if (!img || !img.w || !img.h) return { x: it.x, y: it.y, w: it.w, h: it.h };
    const k = Math.min(it.w / img.w, it.h / img.h);
    const w = img.w * k, h = img.h * k;
    return { x: it.x + (it.w - w) / 2, y: it.y + (it.h - h) / 2, w: w, h: h };
  }

  /* ---------------- painting, shared by PDF and EPS ---------------- */

  /**
   * Paint one parsed SVG into a box on the page. `box` is in the output's
   * own units with y up: [x, y, w, h]. `be` is the back end (PDF or PS),
   * which knows how to set a colour, fill with a gradient, draw an image and
   * set a line of text; everything else is the same path operators.
   */
  function paint(svg, box, be) {
    const vb = svg.vb;
    const kx = box[2] / vb[2], ky = box[3] / vb[3];
    let o = be.save();
    o += be.cm([kx, 0, 0, -ky, box[0] - vb[0] * kx, box[1] + box[3] + vb[1] * ky]);
    svg.items.forEach(function (it) {
      if (it.kind === 'path') {
        const fill = it.fill;
        if (!fill || fill === 'none' || fill === 'transparent') return;
        const grad = /^url\(#([^)]+)\)$/.exec(fill);
        o += be.save() + be.cm(it.m);
        if (grad && svg.grads[grad[1]]) {
          const bb = bbox(it.segs);
          if (bb) o += be.gradient(pathOps(it.segs, be.rect), it.rule === 'evenodd', bb, gradGeometry(svg.grads[grad[1]]));
        } else {
          o += be.colour(colour(grad ? '#000000' : fill)) + pathOps(it.segs, be.rect) + (it.rule === 'evenodd' ? be.eofill : be.fill);
        }
        o += be.restore();
      } else if (it.kind === 'image') {
        const img = be.image(it.href);
        if (!img) return;
        const r = meet(it, img);
        o += be.save() + be.cm(it.m) + be.cm([r.w, 0, 0, -r.h, r.x, r.y + r.h]) + img.ops + be.restore();
      } else if (it.kind === 'text') {
        const fill = colour(it.fill);
        if (!fill || !it.text) return;
        const w = textWidth(it.text, it.bold, it.size);
        const x = it.anchor === 'middle' ? it.x - w / 2 : it.anchor === 'end' ? it.x - w : it.x;
        o += be.save() + be.cm(it.m) + be.colour(fill) + be.text(it.text, it.bold, it.size, x, it.y) + be.restore();
      }
    });
    return o + be.restore();
  }

  /* ---------------- PDF ---------------- */

  async function deflate(bytes) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const cs = new CompressionStream('deflate');
      const w = cs.writable.getWriter();
      w.write(bytes); w.close();
      const parts = [];
      const r = cs.readable.getReader();
      for (;;) { const x = await r.read(); if (x.done) break; parts.push(x.value); }
      let n = 0; parts.forEach((p) => { n += p.length; });
      const out = new Uint8Array(n);
      let at = 0; parts.forEach((p) => { out.set(p, at); at += p.length; });
      return out;
    } catch (e) { return null; }
  }

  const enc = (s) => {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
    return out;
  };

  /** A PDF under construction: numbered objects, written out with an xref. */
  function PdfDoc(meta) {
    const objs = [null];
    this.meta = meta || {};
    this.reserve = function () { objs.push(null); return objs.length - 1; };
    this.set = function (id, body) { objs[id] = body; return id; };
    this.add = function (body) { objs.push(body); return objs.length - 1; };
    this.stream = async function (dict, bytes, compress) {
      const z = compress === false ? null : await deflate(bytes);
      const data = z && z.length < bytes.length ? z : bytes;
      const d = dict + (data === z ? ' /Filter /FlateDecode' : '');
      return this.add({ dict: d, data: data });
    };
    this.bytes = function (rootId, infoId) {
      const parts = [];
      let len = 0;
      const push = (u8) => { parts.push(u8); len += u8.length; };
      push(enc('%PDF-1.4\n%âãÏÓ\n'));
      const offs = [];
      for (let i = 1; i < objs.length; i++) {
        offs[i] = len;
        const o = objs[i];
        if (o && typeof o === 'object') {
          push(enc(i + ' 0 obj\n<< ' + o.dict + ' /Length ' + o.data.length + ' >>\nstream\n'));
          push(o.data);
          push(enc('\nendstream\nendobj\n'));
        } else push(enc(i + ' 0 obj\n' + (o == null ? 'null' : o) + '\nendobj\n'));
      }
      const xref = len;
      let x = 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
      for (let i = 1; i < objs.length; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
      x += 'trailer\n<< /Size ' + objs.length + ' /Root ' + rootId + ' 0 R' + (infoId ? ' /Info ' + infoId + ' 0 R' : '') + ' >>\nstartxref\n' + xref + '\n%%EOF\n';
      push(enc(x));
      const out = new Uint8Array(len);
      let at = 0; parts.forEach((p) => { out.set(p, at); at += p.length; });
      return out;
    };
  }

  const pdfText = (s) => strLit(s);
  const pdfDate = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return 'D:' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
  };

  /**
   * The PDF back end for paint(): per page it collects the shadings, images
   * and fonts it used, so each page's /Resources names exactly those.
   */
  function pdfBackend(doc, images, shared) {
    const page = { shadings: [], xobjects: {}, fonts: {} };
    const be = {
      rect: 're', fill: 'f\n', eofill: 'f*\n',
      save: () => 'q\n', restore: () => 'Q\n',
      cm: (m) => m.map(nf).join(' ') + ' cm\n',
      colour: (c) => c.map(nf).join(' ') + ' rg\n',
      gradient: function (ops, eo, bb, g) {
        const name = 'Sh' + page.shadings.length;
        page.shadings.push({ name: name, g: g });
        return ops + (eo ? 'W* n\n' : 'W n\n') + nf(bb[2]) + ' 0 0 ' + nf(bb[3]) + ' ' + nf(bb[0]) + ' ' + nf(bb[1]) + ' cm\n/' + name + ' sh\n';
      },
      image: function (href) {
        const im = images && images[href];
        if (!im) return null;
        if (!shared.images[href]) shared.images[href] = { name: 'Im' + Object.keys(shared.images).length, im: im, id: null };
        const s = shared.images[href];
        page.xobjects[s.name] = s;
        return { w: im.w, h: im.h, ops: '/' + s.name + ' Do\n' };
      },
      text: function (t, bold, size, x, y) {
        const f = bold ? 'F2' : 'F1';
        page.fonts[f] = bold ? 'Helvetica-Bold' : 'Helvetica';
        /* the page is flipped to SVG's y-down, so the text matrix flips back */
        return 'BT\n/' + f + ' ' + nf(size) + ' Tf\n1 0 0 -1 ' + nf(x) + ' ' + nf(y) + ' Tm\n' + pdfText(t) + ' Tj\nET\n';
      }
    };
    return { be: be, page: page };
  }

  async function pdfImageObject(doc, im) {
    /* im: { w, h, rgb: Uint8Array (w*h*3), alpha: Uint8Array|null (w*h) } */
    let smask = '';
    if (im.alpha) {
      const sid = await doc.stream('/Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceGray /BitsPerComponent 8', im.alpha);
      smask = ' /SMask ' + sid + ' 0 R';
    }
    return doc.stream('/Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8' + smask, im.rgb);
  }

  async function pdfResources(doc, page, shared) {
    let r = '<< /ProcSet [/PDF /Text /ImageC /ImageB]';
    const fonts = Object.keys(page.fonts);
    if (fonts.length) {
      r += ' /Font <<';
      for (const f of fonts) {
        if (!shared.fonts[f]) shared.fonts[f] = doc.add('<< /Type /Font /Subtype /Type1 /BaseFont /' + page.fonts[f] + ' /Encoding /WinAnsiEncoding >>');
        r += ' /' + f + ' ' + shared.fonts[f] + ' 0 R';
      }
      r += ' >>';
    }
    if (page.shadings.length) {
      r += ' /Shading <<';
      for (const s of page.shadings) {
        const g = s.g;
        const id = doc.add('<< /ShadingType ' + g.type + ' /ColorSpace /DeviceRGB /Coords [' + g.coords.map(nf).join(' ') +
          '] /Function << /FunctionType 2 /Domain [0 1] /C0 [' + g.c0.map(nf).join(' ') + '] /C1 [' + g.c1.map(nf).join(' ') + '] /N 1 >> /Extend [true true] >>');
        r += ' /' + s.name + ' ' + id + ' 0 R';
      }
      r += ' >>';
    }
    const xs = Object.keys(page.xobjects);
    if (xs.length) {
      r += ' /XObject <<';
      for (const n of xs) {
        const s = page.xobjects[n];
        if (!s.id) s.id = await pdfImageObject(doc, s.im);
        r += ' /' + n + ' ' + s.id + ' 0 R';
      }
      r += ' >>';
    }
    return r + ' >>';
  }

  /**
   * One SVG as a one-page vector PDF.
   *   opts.widthPt / heightPt  page size in points (default: the SVG's px at 72 dpi)
   *   opts.images              { href: { w, h, rgb, alpha } } rasters for <image> elements
   *   opts.title               document title
   */
  async function svgToPdf(svgText, opts) {
    const o = opts || {};
    const svg = parseSVG(svgText);
    const W = o.widthPt || svg.width, H = o.heightPt || svg.height;
    const doc = new PdfDoc();
    const shared = { images: {}, fonts: {} };
    const catalog = doc.reserve(), pages = doc.reserve();
    const pb = pdfBackend(doc, o.images, shared);
    const ops = paint(svg, [0, 0, W, H], pb.be);
    const content = await doc.stream('', enc(ops));
    const res = await pdfResources(doc, pb.page, shared);
    const pageId = doc.add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 ' + nf(W) + ' ' + nf(H) + '] /Resources ' + res + ' /Contents ' + content + ' 0 R >>');
    doc.set(pages, '<< /Type /Pages /Kids [' + pageId + ' 0 R] /Count 1 >>');
    doc.set(catalog, '<< /Type /Catalog /Pages ' + pages + ' 0 R >>');
    const info = doc.add('<< /Title ' + pdfText(o.title || 'QR code') + ' /Producer (1234Tools QR export) /CreationDate (' + pdfDate() + ') >>');
    return doc.bytes(catalog, info);
  }

  /* ---------------- label sheets ---------------- */

  const MM = 72 / 25.4;

  /** Ready-made grids, in millimetres, measured from the sheets' published templates. */
  const LABEL_PRESETS = {
    'a4-21': { name: 'A4, 21 per sheet, 63.5 x 38.1 mm (as L7160)', page: 'a4', cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.21, gapX: 2.54, gapY: 0 },
    'a4-24': { name: 'A4, 24 per sheet, 63.5 x 33.9 mm (as L7159)', page: 'a4', cols: 3, rows: 8, w: 63.5, h: 33.9, top: 12.9, left: 7.21, gapX: 2.54, gapY: 0 },
    'a4-14': { name: 'A4, 14 per sheet, 99.1 x 38.1 mm (as L7163)', page: 'a4', cols: 2, rows: 7, w: 99.1, h: 38.1, top: 15.15, left: 4.65, gapX: 2.5, gapY: 0 },
    'a4-10': { name: 'A4, 10 per sheet, 99.1 x 57 mm (as L7173)', page: 'a4', cols: 2, rows: 5, w: 99.1, h: 57, top: 6, left: 4.65, gapX: 2.5, gapY: 0 },
    'a4-65': { name: 'A4, 65 per sheet, 38.1 x 21.2 mm (as L7651)', page: 'a4', cols: 5, rows: 13, w: 38.1, h: 21.2, top: 10.7, left: 4.67, gapX: 2.54, gapY: 0 },
    'letter-30': { name: 'US Letter, 30 per sheet, 2.625 x 1 in (as 5160)', page: 'letter', cols: 3, rows: 10, w: 66.675, h: 25.4, top: 12.7, left: 4.7625, gapX: 3.175, gapY: 0 },
    'letter-10': { name: 'US Letter, 10 per sheet, 4 x 2 in (as 5163)', page: 'letter', cols: 2, rows: 5, w: 101.6, h: 50.8, top: 12.7, left: 3.96875, gapX: 4.7625, gapY: 0 }
  };
  const PAGES = { a4: [210, 297], letter: [215.9, 279.4] };

  /** Whether a grid fits its page; the message names what overflows. */
  function checkLayout(L) {
    const pw = L.pageW, ph = L.pageH;
    const needW = L.left + L.cols * L.w + (L.cols - 1) * L.gapX;
    const needH = L.top + L.rows * L.h + (L.rows - 1) * L.gapY;
    if (!(L.cols >= 1 && L.rows >= 1 && L.w > 0 && L.h > 0)) return 'Columns, rows and the label size must all be above zero.';
    if (needW > pw + 0.01) return 'The labels run ' + nf(needW - pw) + ' mm off the right of the page.';
    if (needH > ph + 0.01) return 'The labels run ' + nf(needH - ph) + ' mm off the bottom of the page.';
    return '';
  }

  /** Where each label's code and text go, in mm from the top left of the page. */
  function labelCells(L) {
    const pad = L.pad === undefined ? 1.5 : L.pad;
    const textH = L.text ? L.fontPt / MM * 1.3 : 0;
    const cells = [];
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const x = L.left + c * (L.w + L.gapX), y = L.top + r * (L.h + L.gapY);
        const innerW = L.w - pad * 2, innerH = L.h - pad * 2 - textH;
        const s = Math.max(0, Math.min(innerW, innerH));
        cells.push({
          x: x, y: y, w: L.w, h: L.h,
          code: { x: x + (L.w - s) / 2, y: y + pad + (innerH - s) / 2, s: s },
          textY: y + pad + innerH + textH * 0.78, textW: innerW
        });
      }
    }
    return cells;
  }

  /**
   * A sheet of labels as a vector PDF.
   *   items   [{ svg, text }]
   *   L       { pageW, pageH, cols, rows, w, h, top, left, gapX, gapY (mm), text, fontPt, outlines, pad }
   *   images  rasters for any <image> in the SVGs
   *   onPage  (done, total) after each page, awaited (so the caller can yield and cancel)
   */
  async function labelSheetPdf(items, L, images, onPage, title) {
    const bad = checkLayout(L);
    if (bad) throw new Error(bad);
    const per = L.cols * L.rows;
    const cells = labelCells(L);
    const doc = new PdfDoc();
    const shared = { images: {}, fonts: {} };
    const catalog = doc.reserve(), pagesId = doc.reserve();
    const W = L.pageW * MM, H = L.pageH * MM;
    const kids = [];
    const total = Math.ceil(items.length / per);
    for (let p = 0; p < total; p++) {
      const pb = pdfBackend(doc, images, shared);
      let ops = '';
      const slice = items.slice(p * per, p * per + per);
      slice.forEach(function (it, i) {
        const cell = cells[i];
        if (L.outlines) {
          ops += 'q 0.75 0.75 0.75 RG 0.3 w ' + nf(cell.x * MM) + ' ' + nf(H - (cell.y + cell.h) * MM) + ' ' + nf(cell.w * MM) + ' ' + nf(cell.h * MM) + ' re S Q\n';
        }
        if (cell.code.s > 0) {
          const svg = parseSVG(it.svg);
          const s = cell.code.s * MM;
          /* a framed code is taller than wide: fit it, centred, in the square */
          const k = Math.min(s / svg.vb[2], s / svg.vb[3]);
          const w = svg.vb[2] * k, h = svg.vb[3] * k;
          ops += paint(svg, [cell.code.x * MM + (s - w) / 2, H - cell.code.y * MM - s + (s - h) / 2, w, h], pb.be);
        }
        if (L.text && it.text) {
          const t = fitText(it.text, false, L.fontPt, cell.textW * MM);
          const tw = textWidth(t, false, L.fontPt);
          pb.page.fonts.F1 = 'Helvetica';
          ops += 'BT /F1 ' + nf(L.fontPt) + ' Tf 0 0 0 rg ' + nf((cell.x + cell.w / 2) * MM - tw / 2) + ' ' + nf(H - cell.textY * MM) + ' Td ' + pdfText(t) + ' Tj ET\n';
        }
      });
      const content = await doc.stream('', enc(ops));
      const res = await pdfResources(doc, pb.page, shared);
      kids.push(doc.add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + nf(W) + ' ' + nf(H) + '] /Resources ' + res + ' /Contents ' + content + ' 0 R >>'));
      if (onPage) await onPage(p + 1, total);
    }
    doc.set(pagesId, '<< /Type /Pages /Kids [' + kids.map((k) => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>');
    doc.set(catalog, '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>');
    const info = doc.add('<< /Title ' + pdfText(title || 'QR code labels') + ' /Producer (1234Tools QR export) /CreationDate (' + pdfDate() + ') >>');
    return doc.bytes(catalog, info);
  }

  /* ---------------- EPS ---------------- */

  function hex(bytes) {
    const H = '0123456789abcdef';
    let o = '';
    for (let i = 0; i < bytes.length; i++) {
      o += H[bytes[i] >> 4] + H[bytes[i] & 15];
      if (i % 40 === 39) o += '\n';
    }
    return o;
  }

  /**
   * One SVG as an Encapsulated PostScript file (Level 3 when it has a
   * gradient, for shfill; Level 2 otherwise). EPS has no transparency, so a
   * logo is flattened onto `opts.flatten` (its knock-out colour) first; the
   * rest is the same vector paths as the PDF.
   */
  function svgToEps(svgText, opts) {
    const o = opts || {};
    const svg = parseSVG(svgText);
    const W = o.widthPt || svg.width, H = o.heightPt || svg.height;
    let level3 = false, fonts = {};
    const be = {
      rect: null, fill: 'f\n', eofill: 'f*\n',
      save: () => 'q\n', restore: () => 'Q\n',
      cm: (m) => m.map(nf).join(' ') + ' cm\n',
      colour: (c) => c.map(nf).join(' ') + ' rg\n',
      gradient: function (ops, eo, bb, g) {
        level3 = true;
        return ops + (eo ? 'eoclip' : 'clip') + ' newpath\n' + nf(bb[2]) + ' 0 0 ' + nf(bb[3]) + ' ' + nf(bb[0]) + ' ' + nf(bb[1]) + ' cm\n' +
          '<< /ShadingType ' + g.type + ' /ColorSpace /DeviceRGB /Coords [' + g.coords.map(nf).join(' ') + '] /Extend [true true]\n' +
          '   /Function << /FunctionType 2 /Domain [0 1] /C0 [' + g.c0.map(nf).join(' ') + '] /C1 [' + g.c1.map(nf).join(' ') + '] /N 1 >> >> shfill\n';
      },
      image: function (href) {
        const im = o.images && o.images[href];
        if (!im) return null;
        const bg = colour(o.flatten || '#ffffff') || [1, 1, 1];
        const flat = new Uint8Array(im.w * im.h * 3);
        for (let i = 0; i < im.w * im.h; i++) {
          const a = im.alpha ? im.alpha[i] / 255 : 1;
          for (let k = 0; k < 3; k++) flat[i * 3 + k] = Math.round(im.rgb[i * 3 + k] * a + bg[k] * 255 * (1 - a));
        }
        /* the unit square is already mapped onto the image's box, top row first */
        const ops = '/DeviceRGB setcolorspace\n<< /ImageType 1 /Width ' + im.w + ' /Height ' + im.h + ' /BitsPerComponent 8 /Decode [0 1 0 1 0 1] /ImageMatrix [' +
          im.w + ' 0 0 ' + (-im.h) + ' 0 ' + im.h + '] /DataSource currentfile /ASCIIHexDecode filter >> image\n' + hex(flat) + '>\n';
        return { w: im.w, h: im.h, ops: ops };
      },
      text: function (t, bold, size, x, y) {
        const f = bold ? 'HB' : 'HR';
        fonts[f] = 1;
        return x === null ? '' : nf(x) + ' ' + nf(y) + ' moveto 1 -1 scale /' + f + ' findfont ' + nf(size) + ' scalefont setfont ' + strLit(t) + ' show\n';
      }
    };
    const body = paint(svg, [0, 0, W, H], be);
    const font = (name, base) => '/' + base + ' findfont dup length dict begin { 1 index /FID ne { def } { pop pop } ifelse } forall\n' +
      '  /Encoding WinAnsi def currentdict end /' + name + ' exch definefont pop\n';
    let prolog = '/q /gsave load def /Q /grestore load def\n' +
      '/m /moveto load def /l /lineto load def /c /curveto load def /h /closepath load def\n' +
      '/f /fill load def /f* /eofill load def /rg /setrgbcolor load def\n' +
      '/cm { 6 array astore concat } bind def\n';
    if (fonts.HR || fonts.HB) {
      /* WinAnsiEncoding: ISO Latin-1 with Windows-1252's 128-159 filled in */
      prolog += '/WinAnsi ISOLatin1Encoding 256 array copy def\n' +
        '[128 /Euro 130 /quotesinglbase 131 /florin 132 /quotedblbase 133 /ellipsis 134 /dagger 135 /daggerdbl 136 /circumflex 137 /perthousand 138 /Scaron 139 /guilsinglleft 140 /OE 142 /Zcaron 145 /quoteleft 146 /quoteright 147 /quotedblleft 148 /quotedblright 149 /bullet 150 /endash 151 /emdash 152 /tilde 153 /trademark 154 /scaron 155 /guilsinglright 156 /oe 158 /zcaron 159 /Ydieresis]\n' +
        'aload length 2 idiv { WinAnsi 3 1 roll put } repeat\n';
      if (fonts.HR) prolog += font('HR', 'Helvetica');
      if (fonts.HB) prolog += font('HB', 'Helvetica-Bold');
    }
    const bb = '0 0 ' + Math.ceil(W) + ' ' + Math.ceil(H);
    return '%!PS-Adobe-3.0 EPSF-3.0\n' +
      '%%BoundingBox: ' + bb + '\n' +
      '%%HiResBoundingBox: 0 0 ' + nf(W) + ' ' + nf(H) + '\n' +
      '%%Title: ' + String(o.title || 'QR code').replace(/[\r\n]/g, ' ') + '\n' +
      '%%Creator: 1234Tools QR export\n' +
      '%%LanguageLevel: ' + (level3 ? 3 : 2) + '\n' +
      (fonts.HR || fonts.HB ? '%%DocumentNeededResources: font' + (fonts.HR ? ' Helvetica' : '') + (fonts.HB ? ' Helvetica-Bold' : '') + '\n' : '') +
      '%%Pages: 1\n%%EndComments\n%%BeginProlog\n' +
      'save\n' + prolog + '%%EndProlog\n%%Page: 1 1\n' +
      body + 'restore\nshowpage\n%%EOF\n';
  }

  /* ---------------- PNG resolution ---------------- */

  const CRC = (function () {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes, from, to) {
    let c = 0xFFFFFFFF;
    for (let i = from; i < to; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * A PNG with its resolution set: a pHYs chunk (pixels per metre, unit 1)
   * straight after IHDR, replacing any there was. This is what makes a
   * 1200-pixel code open in a layout program as 101.6 mm at 300 dpi rather
   * than at the program's guess.
   */
  function pngSetDpi(bytes, dpi) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length < 33 || b[1] !== 0x50 || b[2] !== 0x4E || b[3] !== 0x47) throw new Error('Not a PNG');
    const ppm = Math.round(dpi / 0.0254);
    const chunks = [];
    let at = 8;
    while (at + 8 <= b.length) {
      const len = ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
      const type = String.fromCharCode(b[at + 4], b[at + 5], b[at + 6], b[at + 7]);
      const end = at + 12 + len;
      if (type !== 'pHYs') chunks.push(b.subarray(at, end));
      if (type === 'IHDR') {
        const p = new Uint8Array(21);
        p.set([0, 0, 0, 9, 0x70, 0x48, 0x59, 0x73]);
        for (let k = 0; k < 2; k++) {
          p[8 + k * 4] = (ppm >>> 24) & 255; p[9 + k * 4] = (ppm >>> 16) & 255; p[10 + k * 4] = (ppm >>> 8) & 255; p[11 + k * 4] = ppm & 255;
        }
        p[16] = 1;
        const c = crc32(p, 4, 17);
        p[17] = c >>> 24; p[18] = (c >>> 16) & 255; p[19] = (c >>> 8) & 255; p[20] = c & 255;
        chunks.push(p);
      }
      at = end;
      if (type === 'IEND') break;
    }
    let n = 8; chunks.forEach((c) => { n += c.length; });
    const out = new Uint8Array(n);
    out.set(b.subarray(0, 8), 0);
    let o = 8; chunks.forEach((c) => { out.set(c, o); o += c.length; });
    return out;
  }

  root.QRExport = {
    parseSVG: parseSVG, pathSegments: pathSegments,
    svgToPdf: svgToPdf, svgToEps: svgToEps,
    labelSheetPdf: labelSheetPdf, labelCells: labelCells, checkLayout: checkLayout,
    LABEL_PRESETS: LABEL_PRESETS, PAGES: PAGES,
    pngSetDpi: pngSetDpi,
    textWidth: textWidth, fitText: fitText, fitsWinAnsi: fitsWinAnsi
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.QRExport;
})(typeof window !== 'undefined' ? window : globalThis);
