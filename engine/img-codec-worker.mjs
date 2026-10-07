/**
 * Image codec worker: the WebAssembly encoders the image tools use, run off
 * the main thread so a slider never freezes the page.
 *
 *   MozJPEG (libjpeg-turbo licences: IJG + BSD-3), libwebp (BSD-3), libavif
 *   with libaom (BSD-2), oxipng (MIT) and the Rust "resize" crate's Lanczos3
 *   (MIT), all from the jSquash packages (Apache-2.0), vendored byte for byte
 *   under engine/vendor/jsquash/ with their licences beside them.
 *
 * Each codec is imported the first time a job needs it, so a page that only
 * writes JPEG never fetches the AVIF encoder. Nothing here talks to anything
 * but this site.
 *
 * Messages in:  { id, op, ...args }   ops: ping, encode, resize, target
 * Messages out: { id, ok: true, ...result } or { id, ok: false, error }
 *               { id, progress: { … } } while a target-size search runs
 *
 * The pure parts (quantise, sniff, the search) are exported too, so the
 * tests can import this file in Node and check them against references.
 */

const V = new URL('./vendor/jsquash/', import.meta.url).href;

/* ---------------- feature checks ---------------- */

/* the smallest module that uses a SIMD instruction (v128.const, i8x16.popcnt);
   validate() says whether this engine has SIMD, so libwebp's faster build
   is used where it can run */
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
function hasSimd() {
  try { return WebAssembly.validate(SIMD_PROBE); } catch (e) { return false; }
}

/* ---------------- codec loading ---------------- */

const loaded = {};
function emscripten(file) {
  return import(V + file).then((m) => m.default({ noInitialRun: true }));
}
function codec(name) {
  if (loaded[name]) return loaded[name];
  let p;
  if (name === 'jpeg') p = Promise.all([emscripten('jpeg/codec/enc/mozjpeg_enc.js'), import(V + 'jpeg/meta.js')])
    .then(([mod, meta]) => ({ mod, defaults: meta.defaultOptions }));
  else if (name === 'webp') p = Promise.all([emscripten(hasSimd() ? 'webp/codec/enc/webp_enc_simd.js' : 'webp/codec/enc/webp_enc.js'), import(V + 'webp/meta.js')])
    .then(([mod, meta]) => ({ mod, defaults: meta.defaultOptions }));
  else if (name === 'avif') p = Promise.all([emscripten('avif/codec/enc/avif_enc.js'), import(V + 'avif/meta.js')])
    .then(([mod, meta]) => ({ mod, defaults: meta.defaultOptions }));
  else if (name === 'png') p = import(V + 'oxipng/codec/pkg/squoosh_oxipng.js')
    .then(async (m) => { await m.default(); return { optimiseRaw: m.optimise_raw, optimise: m.optimise }; });
  else if (name === 'gif') p = import(new URL('./vendor/gifenc.esm.js', import.meta.url).href);
  else if (name === 'resize') p = import(V + 'resize/lib/resize/pkg/squoosh_resize.js')
    .then(async (m) => { await m.default(); return { resize: m.resize }; });
  else return Promise.reject(new Error('no codec called ' + name));
  loaded[name] = p;
  p.catch(() => { delete loaded[name]; });           // a failed fetch is tried again next time
  return p;
}

/* ---------------- what bytes are ---------------- */

/** The MIME type the bytes really are, read from their signature. */
export function sniff(b) {
  if (!b || b.length < 12) return '';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return 'image/heic';
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'image/x-icon';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 42 && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 42)) return 'image/tiff';
  return '';
}

/* ---------------- palette reduction ----------------
   libimagequant, which Squoosh uses for this, is GPL-3.0, so it is not
   used here. This is median cut over a 5-bit-per-channel histogram of
   RGBA (colours weighted by how many pixels have them), refined by a few
   rounds of k-means, then each pixel mapped to its nearest palette colour,
   with Floyd–Steinberg error diffusion when dithering is on. The result
   has at most `colours` distinct RGBA values, which oxipng then stores as
   an indexed PNG. */
export function quantise(rgba, width, height, colours, dither) {
  colours = Math.max(2, Math.min(256, colours | 0));
  const n = width * height;
  const px = rgba;
  /* the histogram: 5 bits of R, G, B and 3 of A */
  const hist = new Map();
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const a = px[j + 3];
    const key = a < 8 ? 0x7fffffff : ((px[j] >> 3) << 13) | ((px[j + 1] >> 3) << 8) | ((px[j + 2] >> 3) << 3) | (a >> 5);
    let e = hist.get(key);
    if (!e) { e = { r: 0, g: 0, b: 0, a: 0, n: 0 }; hist.set(key, e); }
    e.r += px[j]; e.g += px[j + 1]; e.b += px[j + 2]; e.a += a; e.n++;
  }
  const cells = [];
  let transparent = null;
  for (const [key, e] of hist) {
    if (key === 0x7fffffff) { transparent = e; continue; }
    cells.push([e.r / e.n, e.g / e.n, e.b / e.n, e.a / e.n, e.n]);
  }
  /* fewer colours than asked for: nothing to reduce */
  const exact = new Set();
  for (let i = 0; i < n && exact.size <= colours; i++) {
    const j = i * 4;
    exact.add(px[j + 3] === 0 ? -1 : ((px[j] << 24) | (px[j + 1] << 16) | (px[j + 2] << 8) | px[j + 3]) >>> 0);
  }
  if (exact.size <= colours) return { data: new Uint8ClampedArray(px), palette: exact.size, reduced: false };

  const slots = colours - (transparent ? 1 : 0);
  let boxes = [cells];
  const rangeOf = (box) => {
    let best = -1, ch = 0;
    for (let c = 0; c < 4; c++) {
      let lo = 1e9, hi = -1e9;
      for (const p of box) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
      let w = 0; for (const p of box) w += p[4];
      const score = (hi - lo) * Math.sqrt(w);
      if (score > best) { best = score; ch = c; }
    }
    return { best, ch };
  };
  while (boxes.length < slots) {
    let pick = -1, score = 0, ch = 0;
    boxes.forEach((b, k) => { if (b.length < 2) return; const r = rangeOf(b); if (r.best > score) { score = r.best; pick = k; ch = r.ch; } });
    if (pick < 0) break;
    const box = boxes[pick].slice().sort((p, q) => p[ch] - q[ch]);
    let total = 0; for (const p of box) total += p[4];
    let acc = 0, cut = 1;
    for (let k = 0; k < box.length; k++) { acc += box[k][4]; if (acc >= total / 2) { cut = Math.max(1, Math.min(box.length - 1, k + 1)); break; } }
    boxes.splice(pick, 1, box.slice(0, cut), box.slice(cut));
  }
  let pal = boxes.map((box) => {
    let r = 0, g = 0, b = 0, a = 0, w = 0;
    for (const p of box) { r += p[0] * p[4]; g += p[1] * p[4]; b += p[2] * p[4]; a += p[3] * p[4]; w += p[4]; }
    return [r / w, g / w, b / w, a / w];
  });
  /* k-means over the histogram cells, weighted */
  for (let round = 0; round < 4; round++) {
    const sum = pal.map(() => [0, 0, 0, 0, 0]);
    for (const p of cells) {
      let bi = 0, bd = Infinity;
      for (let k = 0; k < pal.length; k++) {
        const q = pal[k];
        const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 + (p[3] - q[3]) ** 2;
        if (d < bd) { bd = d; bi = k; }
      }
      const s = sum[bi];
      s[0] += p[0] * p[4]; s[1] += p[1] * p[4]; s[2] += p[2] * p[4]; s[3] += p[3] * p[4]; s[4] += p[4];
    }
    pal = pal.map((q, k) => sum[k][4] ? [sum[k][0] / sum[k][4], sum[k][1] / sum[k][4], sum[k][2] / sum[k][4], sum[k][3] / sum[k][4]] : q);
  }
  const P = pal.map((q) => q.map((v) => Math.max(0, Math.min(255, Math.round(v)))));
  if (transparent) P.push([0, 0, 0, 0]);

  const cache = new Map();
  const nearest = (r, g, b, a) => {
    r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g;
    b = b < 0 ? 0 : b > 255 ? 255 : b; a = a < 0 ? 0 : a > 255 ? 255 : a;
    const key = ((r >> 2) << 18) | ((g >> 2) << 12) | ((b >> 2) << 6) | (a >> 2);
    let k = cache.get(key);
    if (k !== undefined) return k;
    let bd = Infinity; k = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      const d = (r - q[0]) ** 2 + (g - q[1]) ** 2 + (b - q[2]) ** 2 + (a - q[3]) ** 2 * 1.5;
      if (d < bd) { bd = d; k = i; }
    }
    cache.set(key, k);
    return k;
  };
  const out = new Uint8ClampedArray(n * 4);
  if (!dither) {
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      const q = P[px[j + 3] < 8 && transparent ? P.length - 1 : nearest(px[j], px[j + 1], px[j + 2], px[j + 3])];
      out[j] = q[0]; out[j + 1] = q[1]; out[j + 2] = q[2]; out[j + 3] = q[3];
    }
  } else {
    /* error diffusion, two rows of float error at a time */
    let cur = new Float32Array((width + 2) * 4), nxt = new Float32Array((width + 2) * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const j = (y * width + x) * 4, e = (x + 1) * 4;
        if (px[j + 3] < 8 && transparent) { out[j] = 0; out[j + 1] = 0; out[j + 2] = 0; out[j + 3] = 0; continue; }
        const r = px[j] + cur[e], g = px[j + 1] + cur[e + 1], b = px[j + 2] + cur[e + 2], a = px[j + 3] + cur[e + 3];
        const q = P[nearest(Math.round(r), Math.round(g), Math.round(b), Math.round(a))];
        out[j] = q[0]; out[j + 1] = q[1]; out[j + 2] = q[2]; out[j + 3] = q[3];
        const er = [r - q[0], g - q[1], b - q[2], a - q[3]];
        for (let c = 0; c < 4; c++) {
          /* damped to 7/8 so flat areas do not crawl */
          const v = er[c] * 0.875;
          cur[e + 4 + c] += v * 7 / 16;
          nxt[e - 4 + c] += v * 3 / 16;
          nxt[e + c] += v * 5 / 16;
          nxt[e + 4 + c] += v * 1 / 16;
        }
      }
      const t = cur; cur = nxt; nxt = t; nxt.fill(0);
    }
  }
  return { data: out, palette: P.length, reduced: true };
}

/* ---------------- one encode ---------------- */

const asImage = (rgba, width, height) => ({ data: rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba.buffer || rgba), width, height });

/**
 * format: 'jpeg' | 'webp' | 'avif' | 'png'
 * opts:   jpeg { quality, progressive, subsample: 'auto'|'420'|'444' }
 *         webp { quality, lossless, effort 0-6, nearLossless }
 *         avif { quality, speed 0-10, lossless }
 *         png  { level 0-6, colours 0 (keep all) or 2-256, dither }
 */
export async function encodeOne(format, rgba, width, height, opts = {}) {
  const data = rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba);
  if (format === 'jpeg') {
    const c = await codec('jpeg');
    const o = Object.assign({}, c.defaults, {
      quality: clampInt(opts.quality, 1, 100, 75),
      progressive: opts.progressive !== false,
      optimize_coding: true
    });
    if (opts.subsample === '444' || opts.subsample === '420') {
      o.auto_subsample = false;
      o.chroma_subsample = opts.subsample === '444' ? 1 : 2;
    }
    const r = c.mod.encode(data, width, height, o);
    return new Uint8Array(r.buffer ? r.buffer : r).slice();
  }
  if (format === 'webp') {
    const c = await codec('webp');
    const lossless = !!opts.lossless;
    const o = Object.assign({}, c.defaults, {
      quality: clampInt(opts.quality, 0, 100, 75),
      method: clampInt(opts.effort, 0, 6, 4),
      lossless: lossless ? 1 : 0,
      exact: 0
    });
    if (lossless && opts.nearLossless !== undefined) o.near_lossless = clampInt(opts.nearLossless, 0, 100, 100);
    const r = c.mod.encode(data, width, height, o);
    if (!r) throw new Error('the WebP encoder failed');
    return new Uint8Array(r.buffer ? r.buffer : r).slice();
  }
  if (format === 'avif') {
    const c = await codec('avif');
    const lossless = !!opts.lossless;
    const o = Object.assign({}, c.defaults, {
      quality: lossless ? 100 : clampInt(opts.quality, 0, 100, 50),
      speed: clampInt(opts.speed, 0, 10, 6),
      lossless
    });
    if (lossless) { o.qualityAlpha = -1; o.subsample = 3; }
    const r = c.mod.encode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width, height, o);
    if (!r) throw new Error('the AVIF encoder failed');
    return new Uint8Array(r.buffer ? r.buffer : r).slice();
  }
  if (format === 'png') {
    const c = await codec('png');
    let src = data;
    let palette = 0;
    const want = clampInt(opts.colours, 0, 256, 0);
    if (want >= 2) {
      const q = quantise(data, width, height, want, opts.dither !== false);
      src = q.data; palette = q.palette;
    }
    const r = c.optimiseRaw(src, width, height, clampInt(opts.level, 0, 6, 2), false, true);
    return Object.assign(new Uint8Array(r.buffer ? r.buffer : r).slice(), { palette });
  }
  if (format === 'gif') return encodeGif(await codec('gif'), data, width, height);
  throw new Error('no encoder for ' + format);
}

/* GIF: 256 colours at most, with gifenc (MIT, already vendored for the AI
   tools); one transparent colour when the picture has see-through pixels */
export function encodeGif(g, data, width, height) {
  let alpha = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 128) { alpha = true; break; }
  const format = alpha ? 'rgba4444' : 'rgb565';
  const palette = g.quantize(data, 256, { format, oneBitAlpha: alpha });
  const index = g.applyPalette(data, palette, format);
  const enc = g.GIFEncoder();
  const ti = alpha ? palette.findIndex((c) => c[3] === 0) : -1;
  enc.writeFrame(index, width, height, { palette, transparent: ti >= 0, transparentIndex: Math.max(0, ti) });
  enc.finish();
  return enc.bytes();
}
function clampInt(v, lo, hi, d) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
}

/* ---------------- Lanczos3 ---------------- */

export async function resizeOne(rgba, width, height, toW, toH) {
  const c = await codec('resize');
  const src = rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba.buffer || rgba, rgba.byteOffset || 0, rgba.byteLength);
  /* 3 is lanczos3; premultiplied alpha and linear light, as Squoosh does */
  const r = c.resize(src, width, height, toW, toH, 3, true, true);
  return new Uint8ClampedArray(r.buffer ? r.buffer : r).slice();
}

/* ---------------- "make it under N KB" ----------------
   The quality is searched first (a bisection over whole steps, keeping the
   best file that fits); only when even the lowest quality allowed is too
   big are the pixels made smaller, by the square root of how far over the
   limit it is, and the quality searched again. PNG has no quality: its
   colour count is halved instead, then the size. */
export async function targetSize(format, rgba, width, height, opts, maxBytes, onStep) {
  const tries = [];
  const minQ = clampInt(opts.minQuality, 1, 100, format === 'avif' ? 20 : 30);
  const maxQ = clampInt(opts.quality, 1, 100, 90);
  let pix = rgba, w = width, h = height;
  let best = null;
  for (let round = 0; round < 8; round++) {
    if (format === 'png') {
      for (const colours of [0, 256, 128, 64, 32, 16]) {
        const bytes = await encodeOne('png', pix, w, h, Object.assign({}, opts, { colours }));
        tries.push({ width: w, height: h, colours, bytes: bytes.length });
        onStep && onStep({ width: w, height: h, colours, bytes: bytes.length });
        if (bytes.length <= maxBytes) return { bytes, width: w, height: h, colours, tries, rgba: pix };
        if (!best || bytes.length < best.bytes.length) best = { bytes, width: w, height: h, colours };
      }
    } else {
      let lo = minQ, hi = maxQ, fit = null;
      const at = async (q) => {
        const bytes = await encodeOne(format, pix, w, h, Object.assign({}, opts, { quality: q }));
        tries.push({ width: w, height: h, quality: q, bytes: bytes.length });
        onStep && onStep({ width: w, height: h, quality: q, bytes: bytes.length });
        if (!best || bytes.length < best.bytes.length) best = { bytes, width: w, height: h, quality: q };
        return bytes;
      };
      const top = await at(hi);
      if (top.length <= maxBytes) return { bytes: top, width: w, height: h, quality: hi, tries, rgba: pix };
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const bytes = await at(mid);
        if (bytes.length <= maxBytes) { fit = { bytes, quality: mid }; lo = mid + 1; }
        else hi = mid - 1;
      }
      if (fit) return { bytes: fit.bytes, width: w, height: h, quality: fit.quality, tries, rgba: pix };
    }
    /* still too big at the lowest setting: fewer pixels */
    const over = best.bytes.length / maxBytes;
    const f = Math.max(0.3, Math.min(0.92, Math.sqrt(1 / over) * 0.97));
    const nw = Math.max(1, Math.round(w * f)), nh = Math.max(1, Math.round(h * f));
    if (nw === w && nh === h || nw < 16 || nh < 16) break;
    pix = await resizeOne(pix, w, h, nw, nh);
    w = nw; h = nh;
  }
  return { bytes: best.bytes, width: best.width, height: best.height, quality: best.quality, colours: best.colours, tries, missed: true };
}

/* ---------------- the message loop (only inside a worker) ---------------- */

const inWorker = typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
if (inWorker) {
  self.onmessage = async (ev) => {
    const m = ev.data || {};
    const reply = (obj, transfer) => self.postMessage(Object.assign({ id: m.id }, obj), transfer || []);
    try {
      if (m.op === 'ping') {
        /* loads the asked-for codecs, so "ready" means really ready */
        for (const name of m.codecs || []) await codec(name);
        reply({ ok: true, simd: hasSimd() });
      } else if (m.op === 'encode') {
        const bytes = await encodeOne(m.format, new Uint8ClampedArray(m.rgba), m.width, m.height, m.opts || {});
        reply({ ok: true, bytes: bytes.buffer, type: sniff(bytes), palette: bytes.palette || 0 }, [bytes.buffer]);
      } else if (m.op === 'resize') {
        const out = await resizeOne(new Uint8ClampedArray(m.rgba), m.width, m.height, m.toW, m.toH);
        reply({ ok: true, rgba: out.buffer, width: m.toW, height: m.toH }, [out.buffer]);
      } else if (m.op === 'filters') {
        /* photo filters on the pixels (engine/img-filters-core.mjs): plain JavaScript, off the page's thread */
        const { applyFilters } = await import('./img-filters-core.mjs');
        const out = applyFilters(new Uint8ClampedArray(m.rgba), m.width, m.height, m.params || {});
        reply({ ok: true, rgba: out.buffer, width: m.width, height: m.height }, [out.buffer]);
      } else if (m.op === 'target') {
        const r = await targetSize(m.format, new Uint8ClampedArray(m.rgba), m.width, m.height, m.opts || {}, m.maxBytes,
          (s) => self.postMessage({ id: m.id, progress: s }));
        const t = [r.bytes.buffer];
        const msg = { ok: true, bytes: r.bytes.buffer, type: sniff(r.bytes), width: r.width, height: r.height,
          quality: r.quality, colours: r.colours, tries: r.tries, missed: !!r.missed };
        reply(msg, t);
      } else {
        reply({ ok: false, error: 'unknown op ' + m.op });
      }
    } catch (e) {
      reply({ ok: false, error: (e && e.message) || String(e) });
    }
  };
}
