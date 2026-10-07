(function(){
/* ============================================================
   CSS Gradient Generator: the engine.
   generate(fields) turns the form into CSS; rasterise() paints the same
   gradient into RGBA pixels for the PNG export, by the geometry of CSS
   Images 3/4, so the PNG is the gradient the CSS draws. Pure functions,
   no DOM at load time; the editor (stops, angle wheel, centre handle,
   presets, PNG and Tailwind) is built in mount(ctx), in the page only.
   ============================================================ */

/* ---------- colour ---------- */

/** #rgb, #rgba, #rrggbb or #rrggbbaa → { r, g, b, a } with r,g,b 0–255 and a 0–1, or null */
function parseHex(s) {
  const m = /^#([0-9a-f]{3,8})$/i.exec(String(s || '').trim());
  if (!m || [3, 4, 6, 8].indexOf(m[1].length) < 0) return null;
  let h = m[1];
  if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}
const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
function toHex(c) {
  return '#' + hex2(c.r) + hex2(c.g) + hex2(c.b) + (c.a < 0.9995 ? hex2(c.a * 255) : '');
}
const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const fromLin = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/* OKLab, Björn Ottosson 2020 (the matrices are published as public domain / MIT) */
function rgbToOklab(c) {
  const r = toLin(c.r), g = toLin(c.g), b = toLin(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklabToRgb(L, A, B) {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
  return {
    r: fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
  };
}
const clamp255 = (c) => ({ r: Math.max(0, Math.min(255, c.r)), g: Math.max(0, Math.min(255, c.g)), b: Math.max(0, Math.min(255, c.b)), a: c.a });

/** The colour a fraction t of the way from a to b, in a CSS colour space, with premultiplied alpha as CSS does. */
function mix(a, b, t, space) {
  const alpha = a.a + (b.a - a.a) * t;
  if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  if (space === 'oklab' || space === 'oklch') {
    let p = rgbToOklab(a), q = rgbToOklab(b);
    if (space === 'oklch') {
      const lch = (v) => [v[0], Math.hypot(v[1], v[2]), (Math.atan2(v[2], v[1]) * 180 / Math.PI + 360) % 360];
      const P = lch(p), Q = lch(q);
      /* a hue with (almost) no chroma is powerless: it takes the other one's */
      if (P[1] < 1e-4) P[2] = Q[2];
      if (Q[1] < 1e-4) Q[2] = P[2];
      let dh = Q[2] - P[2];
      if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;       // the shorter hue
      const L = (P[0] * a.a + (Q[0] * b.a - P[0] * a.a) * t) / alpha;
      const C = (P[1] * a.a + (Q[1] * b.a - P[1] * a.a) * t) / alpha;
      const H = (P[2] + dh * t) * Math.PI / 180;
      return Object.assign(clamp255(oklabToRgb(L, C * Math.cos(H), C * Math.sin(H))), { a: alpha });
    }
    const v = [0, 1, 2].map((i) => (p[i] * a.a + (q[i] * b.a - p[i] * a.a) * t) / alpha);
    return Object.assign(clamp255(oklabToRgb(v[0], v[1], v[2])), { a: alpha });
  }
  const ch = (k) => (a[k] * a.a + (b[k] * b.a - a[k] * a.a) * t) / alpha;
  return { r: ch('r'), g: ch('g'), b: ch('b'), a: alpha };
}

/* ---------- the stop list ---------- */

const MAX_STOPS = 12;
const fmtNum = (n) => String(Math.round(n * 10) / 10);

/**
 * "#ffe29a 0%, #f7c948, #ff9d2e 100%" → { stops: [{ colour, c, pos }], error }
 * Positions are optional and filled in as CSS does: the first is 0, the last
 * 100, gaps are spaced evenly, and one below an earlier position is raised
 * to it (which makes a hard edge).
 */
function parseStops(text) {
  const parts = String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return { error: 'A gradient needs at least two colour stops, such as #ffe29a 0%, #ff9d2e 100%.' };
  if (parts.length > MAX_STOPS) return { error: 'Up to ' + MAX_STOPS + ' colour stops; this list has ' + parts.length + '.' };
  const stops = [];
  for (let i = 0; i < parts.length; i++) {
    const m = /^(#[0-9a-f]+)(?:\s+(-?\d+(?:\.\d+)?)\s*%?)?$/i.exec(parts[i]);
    const c = m && parseHex(m[1]);
    if (!c) return { error: 'Stop ' + (i + 1) + ': “' + parts[i].slice(0, 30) + '” is not a hex colour with an optional position, such as #f7c948 50%.' };
    stops.push({ colour: m[1].toLowerCase(), c: c, pos: m[2] === undefined ? null : Math.max(-100, Math.min(200, Number(m[2]))) });
  }
  if (stops[0].pos === null) stops[0].pos = 0;
  if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 100;
  let maxSoFar = stops[0].pos;
  for (let i = 1; i < stops.length; i++) if (stops[i].pos !== null) { if (stops[i].pos < maxSoFar) stops[i].pos = maxSoFar; maxSoFar = stops[i].pos; }
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].pos !== null) continue;
    let j = i; while (stops[j].pos === null) j++;
    const a = stops[i - 1].pos, b = stops[j].pos, n = j - i + 1;
    for (let k = i; k < j; k++) stops[k].pos = a + (b - a) * (k - i + 1) / n;
  }
  stops.forEach((s) => { s.pos = Math.round(s.pos * 10) / 10; });
  return { stops: stops };
}
const stopList = (stops, sep) => stops.map((s) => s.colour + ' ' + fmtNum(s.pos) + '%').join(sep || ', ');

/** The colour at position p (0–100) of a stop list. */
function colourAt(stops, p, space) {
  if (p <= stops[0].pos) return stops[0].c;
  const last = stops[stops.length - 1];
  if (p >= last.pos) return last.c;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (p < b.pos) return b.pos === a.pos ? b.c : mix(a.c, b.c, (p - a.pos) / (b.pos - a.pos), space);
  }
  return last.c;
}

/* ---------- the CSS ---------- */

const SPACE_TEXT = { srgb: '', oklab: ' in oklab', oklch: ' in oklch' };

function build(f) {
  const parsed = parseStops(f.stops);
  if (parsed.error) return parsed;
  const stops = parsed.stops;
  const type = ['linear', 'radial', 'conic'].indexOf(f.type) >= 0 ? f.type : 'linear';
  const angle = ((Number(f.angle) || 0) % 360 + 360) % 360;
  const cx = Math.max(0, Math.min(100, Number(f.cx === undefined || f.cx === '' ? 50 : f.cx)));
  const cy = Math.max(0, Math.min(100, Number(f.cy === undefined || f.cy === '' ? 50 : f.cy)));
  const space = SPACE_TEXT[f.space] !== undefined ? f.space : 'srgb';
  const shape = f.shape === 'ellipse' ? 'ellipse' : 'circle';
  const at = 'at ' + fmtNum(cx) + '% ' + fmtNum(cy) + '%';
  const list = stopList(stops);
  const value = type === 'linear' ? 'linear-gradient(' + fmtNum(angle) + 'deg' + SPACE_TEXT[space] + ', ' + list + ')'
    : type === 'radial' ? 'radial-gradient(' + shape + ' ' + at + SPACE_TEXT[space] + ', ' + list + ')'
    : 'conic-gradient(from ' + fmtNum(angle) + 'deg ' + at + SPACE_TEXT[space] + ', ' + list + ')';
  const hard = stops.some((x, i) => i && x.pos === stops[i - 1].pos);
  return { stops, type, angle, cx, cy, space, shape, value, hard };
}

/** Tailwind (v3.3 and v4): an arbitrary background-image value, spaces as underscores; the fallback as an arbitrary background colour. */
function tailwind(value, fallback) {
  return (fallback ? 'bg-[' + fallback + '] ' : '') + 'bg-[' + value.replace(/,\s+/g, ',').replace(/\s+/g, '_') + ']';
}

/* ---------- the pixels: CSS gradient geometry ---------- */

/**
 * The gradient painted into a w × h box as RGBA bytes (row by row, 4 per
 * pixel), sampled at pixel centres:
 *  linear  the gradient line runs through the centre at the angle (0deg up,
 *          clockwise) and is |w sin a| + |h cos a| long, so the corners
 *          take the end colours;
 *  radial  the ending shape is farthest-corner: a circle through the
 *          farthest corner, or an ellipse with the farthest-side ratio
 *          scaled by √2 to pass through it;
 *  conic   the angle round the centre, from the start angle, clockwise.
 */
function rasterise(f, w, h, rows) {
  const g = build(f);
  if (g.error) return null;
  w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
  /* rows { from, to, into } paints only those rows into an existing array, so the page can work in slices */
  const px = rows && rows.into ? rows.into : new Uint8ClampedArray(w * h * 4);
  const yFrom = rows ? Math.max(0, rows.from | 0) : 0, yTo = rows ? Math.min(h, rows.to | 0) : h;
  /* a lookup of 1024 colours along the gradient keeps it fast */
  const N = 1024, lo = Math.min(0, g.stops[0].pos), hi = Math.max(100, g.stops[g.stops.length - 1].pos);
  const lut = new Float64Array((N + 1) * 4);
  for (let i = 0; i <= N; i++) {
    const c = colourAt(g.stops, lo + (hi - lo) * i / N, g.space);
    lut[i * 4] = c.r; lut[i * 4 + 1] = c.g; lut[i * 4 + 2] = c.b; lut[i * 4 + 3] = c.a;
  }
  const exact = (p) => colourAt(g.stops, p, g.space);
  const rad = g.angle * Math.PI / 180, sn = Math.sin(rad), cs = Math.cos(rad);
  const len = Math.abs(w * sn) + Math.abs(h * cs);
  const ox = g.cx / 100 * w, oy = g.cy / 100 * h;
  const fx = Math.max(ox, w - ox), fy = Math.max(oy, h - oy);
  const rC = Math.hypot(fx, fy), rX = fx * Math.SQRT2, rY = fy * Math.SQRT2;
  for (let y = yFrom; y < yTo; y++) {
    for (let x = 0; x < w; x++) {
      const X = x + 0.5, Y = y + 0.5;
      let t;
      if (g.type === 'linear') t = ((X - w / 2) * sn - (Y - h / 2) * cs) / (len || 1) + 0.5;
      else if (g.type === 'radial') {
        const dx = X - ox, dy = Y - oy;
        const ex2 = dx / (rX || 1), ey2 = dy / (rY || 1);
        t = g.shape === 'circle' ? Math.sqrt(dx * dx + dy * dy) / (rC || 1) : Math.sqrt(ex2 * ex2 + ey2 * ey2);
      } else {
        const a = (Math.atan2(X - ox, -(Y - oy)) * 180 / Math.PI + 360) % 360;
        t = (((a - g.angle) % 360) + 360) % 360 / 360;
      }
      const p = t * 100;
      const o = (y * w + x) * 4;
      if (g.hard) {
        /* hard edges (two stops at one place) are sampled exactly, never blurred by the table */
        const c = exact(p);
        px[o] = c.r; px[o + 1] = c.g; px[o + 2] = c.b; px[o + 3] = c.a * 255;
        continue;
      }
      let k = (p - lo) / (hi - lo) * N;
      k = k < 0 ? 0 : k > N ? N : k;
      const i0 = k | 0, i1 = i0 < N ? i0 + 1 : N, fr = k - i0, q0 = i0 * 4, q1 = i1 * 4;
      px[o] = lut[q0] + (lut[q1] - lut[q0]) * fr;
      px[o + 1] = lut[q0 + 1] + (lut[q1 + 1] - lut[q0 + 1]) * fr;
      px[o + 2] = lut[q0 + 2] + (lut[q1 + 2] - lut[q0 + 2]) * fr;
      px[o + 3] = (lut[q0 + 3] + (lut[q1 + 3] - lut[q0 + 3]) * fr) * 255;
    }
  }
  return px;
}

/* ---------- presets and a random gradient ---------- */

const PRESETS = [
  { name: 'Sunrise', type: 'linear', angle: '120', stops: '#ffe29a 0%, #f7c948 50%, #ff9d2e 100%' },
  { name: 'Ocean', type: 'linear', angle: '135', stops: '#0f2027 0%, #2c5364 55%, #4ecdc4 100%' },
  { name: 'Berry', type: 'linear', angle: '90', stops: '#8e2de2 0%, #ff4e8a 100%', space: 'oklab' },
  { name: 'Mint', type: 'linear', angle: '160', stops: '#d4fc79 0%, #96e6a1 100%' },
  { name: 'Dusk', type: 'linear', angle: '180', stops: '#141e30 0%, #243b55 60%, #ff7e5f 100%' },
  { name: 'Glow', type: 'radial', angle: '0', stops: '#fff6d5 0%, #f7c948 35%, #1d3557 100%', cx: '50', cy: '40' },
  { name: 'Colour wheel', type: 'conic', angle: '0', stops: '#ff0000 0%, #ffff00 16.7%, #00ff00 33.3%, #00ffff 50%, #0000ff 66.7%, #ff00ff 83.3%, #ff0000 100%' },
  { name: 'Pie 25%', type: 'conic', angle: '0', stops: '#e63946 0%, #e63946 25%, #e9ecef 25%, #e9ecef 100%' }
];

/** A random but tidy gradient: 2 or 3 stops whose hues sit within 120 degrees, light to mid. rnd() → [0,1). */
function randomGradient(rnd) {
  rnd = rnd || Math.random;
  const h0 = rnd() * 360, spread = 40 + rnd() * 80, n = rnd() < 0.5 ? 2 : 3;
  const hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const k = (n2) => (n2 + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n2) => l - a * Math.max(-1, Math.min(k(n2) - 3, 9 - k(n2), 1));
    return '#' + hex2(f(0) * 255) + hex2(f(8) * 255) + hex2(f(4) * 255);
  };
  const stops = [];
  for (let i = 0; i < n; i++) stops.push(hsl(h0 + spread * i / (n - 1), 70 + rnd() * 25, 72 - i * (30 / (n - 1)) * (0.6 + rnd() * 0.4)) + ' ' + fmtNum(100 * i / (n - 1)) + '%');
  return { type: 'linear', angle: String(Math.round(rnd() * 8) * 45), stops: stops.join(', '), space: 'oklab' };
}

/* ============================================================ the editor (page only) */

const PNG_SIZES = [[1200, 630, 'Share image'], [1920, 1080, 'Full HD'], [1080, 1080, 'Square post'], [512, 512, 'Icon'], [64, 64, 'Swatch']];

function mountEditor(ctx) {
  const d = document, el = ctx.el;
  const field = (k) => d.getElementById('f-' + k);
  const wrapOf = (k) => { const i = field(k); return i ? i.closest('.field') : null; };
  const fire = (k) => { const i = field(k); if (i) i.dispatchEvent(new Event('input', { bubbles: true })); };
  const btn = (cls, text, label) => { const b = el('button', cls, text); b.type = 'button'; if (label) b.setAttribute('aria-label', label); return b; };

  let stops = [], sel = 0, written = null, lastRes = {};

  /* ---- presets and Random ---- */
  const box = el('div', 'cg-editor');
  const presets = el('div', 'cg-presets');
  presets.setAttribute('role', 'group');
  presets.setAttribute('aria-label', 'Presets');
  PRESETS.forEach(function (p) {
    const b = btn('cg-preset', '', 'Preset: ' + p.name);
    const sw = el('span', 'cg-preset-sw');
    sw.setAttribute('aria-hidden', 'true');
    const g = build({ type: p.type, angle: p.angle, stops: p.stops, space: p.space || 'srgb', cx: p.cx || 50, cy: p.cy || 50 });
    sw.style.background = g.value;
    b.appendChild(sw);
    b.appendChild(el('span', 'cg-preset-name', p.name));
    b.addEventListener('click', function () { apply(p); });
    presets.appendChild(b);
  });
  const rnd = btn('btn-ghost cg-random', 'Random');
  rnd.addEventListener('click', function () { apply(randomGradient()); });
  presets.appendChild(rnd);
  box.appendChild(presets);

  function apply(p) {
    const set = { type: p.type, angle: p.angle, stops: p.stops, space: p.space || 'srgb', cx: p.cx || '50', cy: p.cy || '50' };
    Object.keys(set).forEach(function (k) { const i = field(k); if (i) i.value = set[k]; });
    sel = 0;
    fire('stops');
  }

  /* ---- the stop bar ---- */
  const barWrap = el('div', 'cg-barwrap');
  const barLabel = el('p', 'cg-bar-label', 'Colour stops: drag a marker, or click the bar to add one');
  barLabel.id = 'cg-bar-label';
  const bar = el('div', 'cg-bar');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-labelledby', 'cg-bar-label');
  const barFill = el('div', 'cg-bar-fill');
  bar.appendChild(barFill);
  barWrap.appendChild(barLabel);
  barWrap.appendChild(bar);
  box.appendChild(barWrap);
  const rows = el('div', 'cg-rows');
  box.appendChild(rows);
  const addBtn = btn('btn-ghost cg-add', 'Add stop');
  box.appendChild(addBtn);

  const form = ctx.form;
  form.insertBefore(box, form.firstChild);
  if (wrapOf('stops')) wrapOf('stops').classList.add('field-wide');

  const spaceOf = () => (field('space') || {}).value || 'srgb';
  const listOf = (arr) => arr.map((s) => s.colour + ' ' + fmtNum(s.pos) + '%').join(', ');
  const colourOf = (s) => parseHex(s.colour) || { r: 0, g: 0, b: 0, a: 1 };
  const sortedFull = () => stops.slice().sort((a, b) => a.pos - b.pos).map((s) => ({ colour: s.colour, c: colourOf(s), pos: s.pos }));

  function commit(keepFocus) {
    const selected = stops[sel];
    stops = stops.slice().sort((a, b) => a.pos - b.pos);
    sel = Math.max(0, stops.indexOf(selected));
    written = listOf(stops);
    const i = field('stops');
    if (i) { i.value = written; fire('stops'); }
    paint(keepFocus);
  }

  function paint(keepFocus) {
    barFill.style.background = 'linear-gradient(90deg' + (SPACE_TEXT[spaceOf()] || '') + ', ' + listOf(stops) + ')';
    /* the markers are reused, so focus and a pointer capture survive a repaint */
    const handles = Array.prototype.slice.call(bar.querySelectorAll('.cg-handle'));
    while (handles.length > stops.length) handles.pop().remove();
    stops.forEach(function (s, i) {
      let h = handles[i];
      if (!h) { h = makeHandle(); bar.appendChild(h); handles.push(h); }
      h.dataset.i = String(i);
      h.style.left = Math.max(0, Math.min(100, s.pos)) + '%';
      h.style.setProperty('--cg-c', s.colour);
      h.classList.toggle('is-sel', i === sel);
      h.setAttribute('aria-label', 'Stop ' + (i + 1) + ', ' + s.colour);
      h.setAttribute('aria-valuenow', String(s.pos));
      h.setAttribute('aria-valuetext', s.colour + ' at ' + fmtNum(s.pos) + '%');
    });
    if (keepFocus === 'handle' && handles[sel]) handles[sel].focus();
    paintRows(keepFocus);
  }

  function makeHandle() {
    const h = btn('cg-handle', '');
    h.setAttribute('role', 'slider');
    h.setAttribute('aria-valuemin', '0');
    h.setAttribute('aria-valuemax', '100');
    h.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      sel = Number(h.dataset.i);
      h.focus();
      if (h.setPointerCapture) { try { h.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ } }
      const s = stops[sel];
      let moved = false;
      const move = function (ev) {
        const r = bar.getBoundingClientRect();
        if (!r.width) return;
        s.pos = Math.round(Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * 100)));
        moved = true;
        paintLive();
      };
      const up = function () {
        d.removeEventListener('pointermove', move);
        d.removeEventListener('pointerup', up);
        d.removeEventListener('pointercancel', up);
        sel = stops.indexOf(s);
        if (moved) commit('handle'); else paintSel();
      };
      d.addEventListener('pointermove', move);
      d.addEventListener('pointerup', up);
      d.addEventListener('pointercancel', up);
      paintSel();
    });
    h.addEventListener('keydown', function (e) {
      const i = Number(h.dataset.i), s = stops[i];
      if (!s) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') s.pos = Math.max(0, s.pos - step);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') s.pos = Math.min(100, s.pos + step);
      else if (e.key === 'Home') s.pos = 0;
      else if (e.key === 'End') s.pos = 100;
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (stops.length > 2) { stops.splice(i, 1); sel = Math.max(0, i - 1); commit('handle'); }
        return;
      } else return;
      e.preventDefault();
      sel = i;
      commit('handle');
    });
    h.addEventListener('focus', function () { const i = Number(h.dataset.i); if (i !== sel) { sel = i; paintSel(); } });
    return h;
  }

  /* while dragging: move the markers and the preview, and run on release */
  function paintLive() {
    const list = listOf(stops.slice().sort((a, b) => a.pos - b.pos));
    barFill.style.background = 'linear-gradient(90deg' + (SPACE_TEXT[spaceOf()] || '') + ', ' + list + ')';
    bar.querySelectorAll('.cg-handle').forEach(function (h, i) { if (stops[i]) h.style.left = stops[i].pos + '%'; });
    const f = ctx.fields(); f.stops = list;
    const g = build(f);
    if (!g.error) ctx.gradient.style.background = g.value;
  }

  function paintSel() {
    bar.querySelectorAll('.cg-handle').forEach(function (h, i) { h.classList.toggle('is-sel', i === sel); });
    rows.querySelectorAll('.cg-row').forEach(function (r, i) { r.classList.toggle('is-sel', i === sel); });
  }

  bar.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.target.closest('.cg-handle') || stops.length >= MAX_STOPS) return;
    e.preventDefault();
    const r = bar.getBoundingClientRect();
    const pos = Math.round(Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)));
    stops.push({ colour: toHex(colourAt(sortedFull(), pos, spaceOf())), pos: pos });
    sel = stops.length - 1;
    commit('handle');
  });

  addBtn.addEventListener('click', function () {
    if (stops.length >= MAX_STOPS) return;
    /* in the middle of the widest gap */
    const sorted = sortedFull();
    let best = -1, at = 50;
    for (let i = 1; i < sorted.length; i++) { const gap = sorted[i].pos - sorted[i - 1].pos; if (gap > best) { best = gap; at = sorted[i - 1].pos + gap / 2; } }
    stops.push({ colour: toHex(colourAt(sorted, at, spaceOf())), pos: Math.round(at * 10) / 10 });
    sel = stops.length - 1;
    commit();
  });

  function paintRows(keepFocus) {
    const active = d.activeElement;
    addBtn.disabled = stops.length >= MAX_STOPS;
    if (keepFocus === 'row' && rows.children.length === stops.length) {
      /* typing in a row: refresh the other values, never the box being typed in */
      stops.forEach(function (s, i) {
        const r = rows.children[i];
        r.dataset.i = String(i);
        r.classList.toggle('is-sel', i === sel);
        r.querySelectorAll('[data-k]').forEach(function (inp) {
          if (inp === active) return;
          if (inp.dataset.k === 'pick') inp.value = toHex(Object.assign({}, colourOf(s), { a: 1 }));
          if (inp.dataset.k === 'hex') inp.value = s.colour;
          if (inp.dataset.k === 'pos') inp.value = fmtNum(s.pos);
        });
        const rm = r.querySelector('.cg-remove'); if (rm) rm.disabled = stops.length <= 2;
      });
      return;
    }
    const focusKey = active && rows.contains(active) && active.dataset.k ? active.dataset.k + ':' + active.closest('.cg-row').dataset.i : null;
    rows.textContent = '';
    stops.forEach(function (s, i) {
      const r = el('div', 'cg-row' + (i === sel ? ' is-sel' : ''));
      r.dataset.i = String(i);
      const n = el('span', 'cg-row-n', String(i + 1));
      n.setAttribute('aria-hidden', 'true');
      const pick = el('input', 'cg-pick');
      pick.type = 'color';
      pick.dataset.k = 'pick';
      pick.value = toHex(Object.assign({}, colourOf(s), { a: 1 }));
      pick.setAttribute('aria-label', 'Stop ' + (i + 1) + ' colour picker');
      const hx = el('input', 'control cg-hex');
      hx.type = 'text';
      hx.spellcheck = false;
      hx.autocomplete = 'off';
      hx.dataset.k = 'hex';
      hx.value = s.colour;
      hx.setAttribute('aria-label', 'Stop ' + (i + 1) + ' colour (hex, with optional alpha)');
      const pos = el('input', 'control cg-pos');
      pos.type = 'number';
      pos.min = '0'; pos.max = '100'; pos.step = 'any';
      pos.inputMode = 'decimal';
      pos.dataset.k = 'pos';
      pos.value = fmtNum(s.pos);
      pos.setAttribute('aria-label', 'Stop ' + (i + 1) + ' position (%)');
      const pct = el('span', 'cg-pct', '%');
      pct.setAttribute('aria-hidden', 'true');
      const rm = btn('btn-ghost cg-remove', '×', 'Remove stop ' + (i + 1));
      rm.disabled = stops.length <= 2;
      [pick, hx, pos].forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          e.stopPropagation();
          const st = stops[Number(r.dataset.i)];
          if (!st) return;
          if (inp === pick) { const a = colourOf(st).a; st.colour = a < 0.9995 ? pick.value + hex2(a * 255) : pick.value; }
          else if (inp === hx) {
            if (!parseHex(hx.value)) { hx.setAttribute('aria-invalid', 'true'); return; }
            hx.removeAttribute('aria-invalid');
            st.colour = hx.value.trim().toLowerCase();
          } else { const v = Number(pos.value); if (pos.value === '' || !isFinite(v)) return; st.pos = Math.max(0, Math.min(100, v)); }
          sel = Number(r.dataset.i);
          commit('row');
        });
        inp.addEventListener('change', function (e) { e.stopPropagation(); });
        inp.addEventListener('focus', function () { const i2 = Number(r.dataset.i); if (i2 !== sel) { sel = i2; paintSel(); } });
      });
      rm.addEventListener('click', function () {
        if (stops.length <= 2) return;
        stops.splice(Number(r.dataset.i), 1);
        sel = Math.max(0, Math.min(sel, stops.length - 1));
        commit();
      });
      [n, pick, hx, pos, pct, rm].forEach(function (x) { r.appendChild(x); });
      rows.appendChild(r);
    });
    if (focusKey) {
      const parts = focusKey.split(':');
      const r = rows.children[Number(parts[1])];
      const t = r && r.querySelector('[data-k="' + parts[0] + '"]');
      if (t) t.focus();
    }
  }

  /* ---- the angle wheel ---- */
  const aw = wrapOf('angle');
  const wheel = el('div', 'cg-wheel');
  wheel.tabIndex = 0;
  wheel.setAttribute('role', 'slider');
  wheel.setAttribute('aria-label', 'Angle wheel');
  wheel.setAttribute('aria-valuemin', '0');
  wheel.setAttribute('aria-valuemax', '359');
  const needle = el('span', 'cg-needle');
  wheel.appendChild(needle);
  if (aw) {
    aw.classList.add('cg-anglefield');
    const inp = field('angle');
    const row = el('div', 'cg-anglerow');
    inp.parentNode.insertBefore(row, inp);
    row.appendChild(inp);
    row.appendChild(wheel);
  }
  const setAngle = function (v) { v = ((Math.round(v) % 360) + 360) % 360; const i = field('angle'); if (i) { i.value = String(v); fire('angle'); } };
  const showAngle = function () {
    const v = Number((field('angle') || {}).value) || 0;
    needle.style.transform = 'rotate(' + v + 'deg)';
    wheel.setAttribute('aria-valuenow', String(v));
    wheel.setAttribute('aria-valuetext', v + ' degrees');
  };
  wheel.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    wheel.focus();
    if (wheel.setPointerCapture) { try { wheel.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ } }
    const at = function (ev) {
      const r = wheel.getBoundingClientRect();
      let a = Math.atan2(ev.clientX - (r.left + r.width / 2), -(ev.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      setAngle(a);
    };
    at(e);
    const up = function () { d.removeEventListener('pointermove', at); d.removeEventListener('pointerup', up); d.removeEventListener('pointercancel', up); };
    d.addEventListener('pointermove', at);
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
  });
  wheel.addEventListener('keydown', function (e) {
    const v = Number((field('angle') || {}).value) || 0, step = e.shiftKey ? 15 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setAngle(v + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setAngle(v - step);
    else if (e.key === 'Home') setAngle(0);
    else return;
    e.preventDefault();
  });

  /* ---- the centre handle on the preview ---- */
  const centre = btn('cg-centre', '', 'Gradient centre: drag it, or use the arrow keys');
  centre.setAttribute('role', 'slider');
  ctx.gradient.appendChild(centre);
  ctx.gradient.classList.add('cg-preview');
  const setCentre = function (x, y) {
    const fx = field('cx'), fy = field('cy');
    if (fx) fx.value = String(Math.round(Math.max(0, Math.min(100, x))));
    if (fy) fy.value = String(Math.round(Math.max(0, Math.min(100, y))));
    fire('cx');
  };
  centre.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    centre.focus();
    if (centre.setPointerCapture) { try { centre.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ } }
    const move = function (ev) {
      const r = ctx.gradient.getBoundingClientRect();
      if (r.width && r.height) setCentre((ev.clientX - r.left) / r.width * 100, (ev.clientY - r.top) / r.height * 100);
    };
    /* on the document, so the drag follows the pointer whether or not capture took */
    const up = function () { d.removeEventListener('pointermove', move); d.removeEventListener('pointerup', up); d.removeEventListener('pointercancel', up); };
    d.addEventListener('pointermove', move);
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
  });
  centre.addEventListener('keydown', function (e) {
    const x = Number((field('cx') || {}).value) || 0, y = Number((field('cy') || {}).value) || 0, s = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') setCentre(x - s, y);
    else if (e.key === 'ArrowRight') setCentre(x + s, y);
    else if (e.key === 'ArrowUp') setCentre(x, y - s);
    else if (e.key === 'ArrowDown') setCentre(x, y + s);
    else if (e.key === 'Home') setCentre(50, 50);
    else return;
    e.preventDefault();
  });

  /* ---- Tailwind and PNG ---- */
  const tw = btn('btn-ghost cg-tw-btn', 'Copy for Tailwind');
  tw.addEventListener('click', function () { if (lastRes.tailwind) ctx.copyText(lastRes.tailwind, tw); });
  ctx.outputTools.insertBefore(tw, ctx.outputTools.firstChild);

  const ex = el('div', 'cg-extra');
  const twRow = el('div', 'cg-tw');
  twRow.appendChild(el('span', 'cg-tw-label', 'Tailwind'));
  const twCode = el('code', 'cg-tw-code');
  twRow.appendChild(twCode);
  ex.appendChild(twRow);
  const pngRow = el('div', 'cg-png');
  const sizeLab = el('label', 'cg-png-label', 'PNG size');
  sizeLab.setAttribute('for', 'cg-png-size');
  const size = el('select', 'control cg-png-size');
  size.id = 'cg-png-size';
  PNG_SIZES.forEach(function (s, i) { const o = el('option', null, s[0] + ' × ' + s[1] + ' · ' + s[2]); o.value = String(i); size.appendChild(o); });
  const savedSize = ctx.store.get('cgPng');
  if (savedSize !== undefined && PNG_SIZES[Number(savedSize)]) size.value = String(savedSize);
  size.addEventListener('change', function () { ctx.store.set('cgPng', size.value); });
  const png = btn('btn-download cg-png-btn', 'Download PNG');
  const pngMsg = el('span', 'cg-png-msg');
  pngMsg.setAttribute('aria-live', 'polite');
  /* painted in slices of rows, so a Full HD PNG never freezes the page; the button is Cancel meanwhile */
  let job = null;
  png.addEventListener('click', async function () {
    if (job) { job.cancelled = true; return; }
    const s = PNG_SIZES[Number(size.value)] || PNG_SIZES[0];
    const f = ctx.fields(), w = s[0], h = s[1];
    if (build(f).error) { pngMsg.textContent = 'Fix the colour stops first.'; return; }
    const px = new Uint8ClampedArray(w * h * 4);
    const me = job = { cancelled: false };
    png.textContent = 'Cancel';
    const step = Math.max(8, Math.floor(120000 / w));
    try {
      for (let y = 0; y < h; y += step) {
        if (me.cancelled) { pngMsg.textContent = 'Stopped; no PNG was saved.'; return; }
        rasterise(f, w, h, { from: y, to: y + step, into: px });
        pngMsg.textContent = 'Making the PNG… ' + Math.round(Math.min(h, y + step) / h * 100) + '%';
        await new Promise(function (r) { setTimeout(r, 0); });
      }
      const c = d.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0);
      const blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
      if (!blob) { pngMsg.textContent = 'This browser could not make a PNG.'; return; }
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      ctx.saveBlob(blob, 'gradient-' + w + 'x' + h + '.' + ext);
      pngMsg.textContent = 'Saved gradient-' + w + 'x' + h + '.' + ext + ' (' + ctx.fmtSize(blob.size) + ').';
    } finally {
      job = null;
      png.textContent = 'Download PNG';
    }
  });
  [sizeLab, size, png, pngMsg].forEach(function (x) { pngRow.appendChild(x); });
  ex.appendChild(pngRow);
  ctx.extra.appendChild(ex);

  /* ---- after every run ---- */
  ctx.cg = {
    render: function (res) {
      lastRes = res || {};
      const type = (field('type') || {}).value;
      const show = function (k, on) { const w = wrapOf(k); if (w) w.hidden = !on; };
      show('angle', type !== 'radial');
      show('shape', type === 'radial');
      show('cx', type !== 'linear');
      show('cy', type !== 'linear');
      centre.hidden = type === 'linear' || !!lastRes.error;
      if (!centre.hidden) {
        const x = Number((field('cx') || {}).value), y = Number((field('cy') || {}).value);
        centre.style.left = (isFinite(x) ? x : 50) + '%';
        centre.style.top = (isFinite(y) ? y : 50) + '%';
        centre.setAttribute('aria-valuetext', 'across ' + x + '%, down ' + y + '%');
      }
      showAngle();
      twCode.textContent = lastRes.tailwind || '';
      tw.disabled = !lastRes.tailwind;
      png.disabled = !!lastRes.error;
      const v = (field('stops') || {}).value;
      if (v !== written && !lastRes.error) {
        const p = parseStops(v);
        if (p.stops) { stops = p.stops.map((s) => ({ colour: s.colour, pos: s.pos })); sel = Math.min(sel, stops.length - 1); written = v; paint(); }
      } else paint(d.activeElement && rows.contains(d.activeElement) ? 'row' : null);
    }
  };
}

/* ============================================================ the spec */

window.DEV_TOOLS = window.DEV_TOOLS || {};
window.DEV_TOOLS["css-gradient"] = {
"title": "CSS Gradient Generator",
"category": "developer",
"icon": "🌈",
"kind": "generate",
"filename": "gradient.css",
"download": {"ext": "css", "type": "text/css"},
"highlight": "css",
"description": "Build linear, radial and conic CSS gradients with a stop editor, an angle wheel and a live preview; copy the CSS or a Tailwind class, or save a PNG.",
"keywords": ["css gradient generator","linear gradient","radial gradient","conic gradient","gradient css","tailwind gradient","background gradient"],
"inputLabel": null,
"outputLabel": "CSS",
"fields": [
  {"key":"type","label":"Type","type":"select","default":"linear","options":[{"value":"linear","label":"Linear"},{"value":"radial","label":"Radial"},{"value":"conic","label":"Conic"}]},
  {"key":"angle","label":"Angle (degrees)","type":"number","default":120,"min":0,"max":360},
  {"key":"stops","label":"Colour stops (colour and position, comma-separated)","type":"text","default":"#ffe29a 0%, #f7c948 50%, #ff9d2e 100%"},
  {"key":"space","label":"Blend colours in","type":"select","default":"srgb","options":[{"value":"srgb","label":"sRGB (the classic blend)"},{"value":"oklab","label":"OKLab (no grey middle)"},{"value":"oklch","label":"OKLCH (keeps colours vivid)"}]},
  {"key":"shape","label":"Shape (radial)","type":"select","default":"circle","options":[{"value":"circle","label":"Circle"},{"value":"ellipse","label":"Ellipse"}]},
  {"key":"cx","label":"Centre across (%)","type":"number","default":50,"min":0,"max":100},
  {"key":"cy","label":"Centre down (%)","type":"number","default":50,"min":0,"max":100},
  {"key":"fallback","label":"Solid fallback colour first","type":"check","default":"yes"}
],
"generate": (f) => {
      const g = build(f);
      if (g.error) return { error: g.error };
      const mid = colourAt(g.stops, 50, g.space);
      const fb = f.fallback === 'no' ? '' : toHex(mid);
      const output = (fb ? 'background: ' + fb + ';\n' : '') + 'background: ' + g.value + ';';
            return {
        output: output,
        preview: g.value,
        tailwind: tailwind(g.value, fb),
        fallback: fb,
        stopsNorm: stopList(g.stops),
        kind: g.type,
        stats: [['Colour stops', String(g.stops.length)], ['Type', g.type], ['Blended in', g.space === 'srgb' ? 'sRGB' : g.space === 'oklab' ? 'OKLab' : 'OKLCH']]
          .concat(fb ? [['Fallback colour', fb]] : []).concat(g.hard ? [['Hard edges', String(g.stops.filter((s, i) => i && s.pos === g.stops[i - 1].pos).length)]] : []),
        note: g.space !== 'srgb' ? 'Blending in ' + (g.space === 'oklab' ? 'OKLab' : 'OKLCH') + ' needs Chrome 111, Safari 16.2 or Firefox 127 and later; older browsers show the fallback colour.' : ''
      };
    },
"tips": ["Drag a stop along the bar, or focus it and use the arrow keys (Shift for steps of 10%); click the bar to add a stop there, and Delete removes the focused one.","Two stops at the same position make a hard edge, as in #e63946 25%, #e9ecef 25%; the Pie 25% preset draws a quarter segment that way.","Between complementary colours the classic sRGB blend dips through grey. Switch Blend colours in to OKLab and the middle stays clean.","The fallback line paints a solid colour, the gradient's midpoint, in any browser that cannot read the gradient after it."],
"faq": [{"q":"Why does 0deg point upward?","a":"In CSS gradients the angle names the direction the gradient travels towards, measured clockwise from up. So 0deg runs bottom to top, and 90deg runs left to right."},{"q":"How do I use the Tailwind version?","a":"Copy for Tailwind gives two arbitrary-value classes, such as bg-[#f7c948] bg-[linear-gradient(120deg,#ffe29a_0%,#f7c948_50%,#ff9d2e_100%)]. Spaces become underscores, which Tailwind turns back into spaces; it works in Tailwind 3.3 and 4."}],
"mount": function (ctx) { mountEditor(ctx); },
"render": function (res, ctx) { if (ctx.cg) ctx.cg.render(res); }
};

/* what the page's editor and the tests use */
const CG = { parseHex, toHex, parseStops, stopList, colourAt, mix, rasterise, build, tailwind, PRESETS, randomGradient, rgbToOklab, oklabToRgb, MAX_STOPS };
window.DEV_TOOLS["css-gradient"].lib = CG;
})();
