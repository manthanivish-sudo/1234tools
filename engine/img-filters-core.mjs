/**
 * Photo filters on the pixels themselves, so every browser gives the same
 * result (Safari's canvas has no ctx.filter). The presets and the
 * brightness, contrast and saturation sliders are the CSS filter functions
 * of the Filter Effects spec (grayscale, sepia, saturate, hue-rotate,
 * brightness, contrast, invert), worked step by step in sRGB with each step
 * clamped, as browsers do. Exposure, highlights, shadows, temperature,
 * vignette, sharpen and blur are this page's own, described where they are
 * worked out. Run in the codec worker at full size, and on the page for the
 * small live view.
 */

export const PRESETS = {
  none: [],
  grayscale: [['grayscale', 1]],
  sepia: [['sepia', 0.85]],
  invert: [['invert', 1]],
  vintage: [['sepia', 0.4], ['contrast', 1.1], ['saturate', 0.8], ['brightness', 1.05]],
  cool: [['hue-rotate', -12], ['saturate', 1.15], ['brightness', 1.02]],
  warm: [['hue-rotate', 12], ['saturate', 1.2], ['brightness', 1.04]],
  dramatic: [['contrast', 1.35], ['saturate', 1.25], ['brightness', 0.95]]
};

/* the 3×3 colour matrices of the Filter Effects spec */
function matrixOf(name, a) {
  if (name === 'grayscale') {
    const s = 1 - Math.min(1, a);
    return [0.2126 + 0.7874 * s, 0.7152 - 0.7152 * s, 0.0722 - 0.0722 * s,
            0.2126 - 0.2126 * s, 0.7152 + 0.2848 * s, 0.0722 - 0.0722 * s,
            0.2126 - 0.2126 * s, 0.7152 - 0.7152 * s, 0.0722 + 0.9278 * s];
  }
  if (name === 'sepia') {
    const s = 1 - Math.min(1, a);
    return [0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s,
            0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s,
            0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s];
  }
  if (name === 'saturate') {
    const s = a;
    return [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
            0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
            0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s];
  }
  if (name === 'hue-rotate') {
    const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
            0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
            0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
  }
  return null;
}

/* one CSS filter function over the whole picture */
function applyStep(d, name, a) {
  const n = d.length;
  const m = matrixOf(name, a);
  if (m) {
    for (let i = 0; i < n; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = m[0] * r + m[1] * g + m[2] * b;
      d[i + 1] = m[3] * r + m[4] * g + m[5] * b;
      d[i + 2] = m[6] * r + m[7] * g + m[8] * b;
    }
    return;
  }
  if (name === 'brightness') { for (let i = 0; i < n; i += 4) { d[i] *= a; d[i + 1] *= a; d[i + 2] *= a; } return; }
  if (name === 'contrast') {
    const o = 127.5 * (1 - a);
    for (let i = 0; i < n; i += 4) { d[i] = d[i] * a + o; d[i + 1] = d[i + 1] * a + o; d[i + 2] = d[i + 2] * a + o; }
    return;
  }
  if (name === 'invert') {
    for (let i = 0; i < n; i += 4) { d[i] = a * (255 - d[i]) + (1 - a) * d[i]; d[i + 1] = a * (255 - d[i + 1]) + (1 - a) * d[i + 1]; d[i + 2] = a * (255 - d[i + 2]) + (1 - a) * d[i + 2]; }
  }
}

/* a box blur three times over (close to a Gaussian of standard deviation
   sigma), with running sums, so its cost does not grow with the radius */
export function blur(data, w, h, sigma) {
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  const tmp = new Float32Array(data.length);
  const src = data instanceof Float32Array ? data : Float32Array.from(data);
  const pass = (a, b, horizontal) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w, step = horizontal ? 4 : w * 4;
    for (let l = 0; l < lines; l++) {
      const base = horizontal ? l * w * 4 : l * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += a[base + Math.max(0, Math.min(len - 1, k)) * step + c];
        for (let i = 0; i < len; i++) {
          b[base + i * step + c] = sum / (2 * r + 1);
          sum += a[base + Math.min(len - 1, i + r + 1) * step + c] - a[base + Math.max(0, i - r) * step + c];
        }
      }
      for (let i = 0; i < len; i++) b[base + i * step + 3] = a[base + i * step + 3];
    }
  };
  for (let k = 0; k < 3; k++) { pass(src, tmp, true); pass(tmp, src, false); }
  return src;
}

const toLin = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; toLin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const toSrgb = (l) => (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255;

/**
 * Apply everything to RGBA bytes (a Uint8ClampedArray, changed in place
 * and returned). p: { preset, intensity (0–100), brightness, contrast,
 * saturate (%, 100 = none), exposure (stops), highlights, shadows,
 * temperature (−100…100), hue (degrees), vignette (0–100), sharpen
 * (0–100), blur (px), and scale: the view's size against the full picture,
 * so a blur or sharpen looks the same in the small view }.
 */
export function applyFilters(rgba, w, h, p) {
  const n = rgba.length;
  const scale = p.scale || 1;
  let d = new Float32Array(rgba);                     // working copy, unclamped between the CSS steps only by clamping each
  const clamp = () => { for (let i = 0; i < n; i++) d[i] = d[i] < 0 ? 0 : d[i] > 255 ? 255 : d[i]; };

  /* the preset, at its intensity: the filtered picture mixed with the original */
  const chain = PRESETS[p.preset] || [];
  if (chain.length) {
    const k = p.intensity === undefined ? 1 : Math.max(0, Math.min(100, Number(p.intensity))) / 100;
    const orig = k < 1 ? d.slice() : null;
    for (const [name, a] of chain) { applyStep(d, name, a); clamp(); }
    if (orig) for (let i = 0; i < n; i++) d[i] = orig[i] + (d[i] - orig[i]) * k;
  }
  /* the CSS sliders, in the order the old page applied them */
  const pct = (v) => (v === undefined || v === '' ? 1 : Number(v) / 100);
  if (pct(p.brightness) !== 1) { applyStep(d, 'brightness', pct(p.brightness)); clamp(); }
  if (pct(p.contrast) !== 1) { applyStep(d, 'contrast', pct(p.contrast)); clamp(); }
  if (pct(p.saturate) !== 1) { applyStep(d, 'saturate', pct(p.saturate)); clamp(); }

  /* exposure: light itself multiplied by 2^stops, in linear light */
  const ev = Number(p.exposure) || 0;
  if (ev) {
    const f = Math.pow(2, ev);
    const lut = new Float32Array(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.min(255, toSrgb(Math.min(1, toLin[i] * f)));
    for (let i = 0; i < n; i += 4) for (let c = 0; c < 3; c++) d[i + c] = lut[Math.round(d[i + c])];
  }
  /* shadows and highlights: a tone curve on the luminance, lifting or
     lowering only the dark half (shadows) or the bright half (highlights),
     most at the ends; colours keep their hue as their luminance changes */
  const S = Math.max(-100, Math.min(100, Number(p.shadows) || 0)) / 100;
  const Hh = Math.max(-100, Math.min(100, Number(p.highlights) || 0)) / 100;
  if (S || Hh) {
    for (let i = 0; i < n; i += 4) {
      const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      const ws = L < 0.5 ? (1 - L / 0.5) ** 2 : 0, wh = L > 0.5 ? ((L - 0.5) / 0.5) ** 2 : 0;
      const L2 = Math.max(0, Math.min(1, L + S * 0.25 * ws + Hh * 0.25 * wh));
      if (L > 0.002) { const k = L2 / L; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
      else { const add = L2 * 255; d[i] += add; d[i + 1] += add; d[i + 2] += add; }
    }
    clamp();
  }
  const hue = Number(p.hue) || 0;
  if (hue) { applyStep(d, 'hue-rotate', hue); clamp(); }
  /* temperature: warmer adds red and takes away blue, cooler the reverse, up to 25 levels */
  const t = Math.max(-100, Math.min(100, Number(p.temperature) || 0)) / 100;
  if (t) { for (let i = 0; i < n; i += 4) { d[i] += 25 * t; d[i + 2] -= 25 * t; } clamp(); }
  /* blur, then sharpen (an unsharp mask: the picture plus its difference from a 1-pixel blur) */
  const bl = (Number(p.blur) || 0) * scale;
  if (bl > 0.25) d = blur(d, w, h, bl);
  const sh = Math.max(0, Math.min(100, Number(p.sharpen) || 0)) / 100;
  if (sh) {
    const soft = blur(d.slice(), w, h, Math.max(0.5, scale));
    const k = sh * 1.5;
    for (let i = 0; i < n; i += 4) for (let c = 0; c < 3; c++) d[i + c] += (d[i + c] - soft[i + c]) * k;
    clamp();
  }
  /* vignette: darkening towards the corners, starting 35% of the way out */
  const v = Math.max(0, Math.min(100, Number(p.vignette) || 0)) / 100;
  if (v) {
    const cx = w / 2, cy = h / 2, rmax = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rmax;
      const s = r <= 0.35 ? 0 : Math.min(1, (r - 0.35) / 0.65);
      const f = 1 - v * 0.8 * s * s * (3 - 2 * s);
      const i = (y * w + x) * 4;
      d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
    }
  }
  for (let i = 0; i < n; i++) rgba[i] = d[i];     // a Uint8ClampedArray rounds and clamps
  return rgba;
}
