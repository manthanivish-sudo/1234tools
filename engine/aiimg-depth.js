/**
 * AI Image tools — monocular depth, shared by Blur Background and the
 * 3D Photo Parallax tool.
 *
 * Depth Anything V2 Small (Apache-2.0, 26 MB, 8-bit), served from this site
 * and run by the same ONNX Runtime WebAssembly build that runs the
 * segmentation model. One session is kept per page; estimate() caches its
 * answer per picture, so changing a slider never re-runs the network.
 *
 *   AIImg.depth.estimate(image, { size, onProgress, mw, mh })
 *     -> { w, h, data: Float32Array 0..1 (1 = nearest), raw, rawW, rawH, ms }
 *   AIImg.depth.release()
 *
 * Nothing is uploaded: the weights and the runtime come from this origin,
 * once, and the browser keeps them.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;

  const ORT_DIR = '/engine/vendor/ort/';
  const MODEL = {
    name: 'Depth Anything V2 Small',
    /* in two parts of at most 20 MiB (build/split-models.js); bytes is the whole file */
    url: ['/engine/models/depth-anything-v2-small-uint8.onnx.part0', '/engine/models/depth-anything-v2-small-uint8.onnx.part1'],
    bytes: 27258801,
    licence: 'Apache-2.0',
    input: 'pixel_values',
    output: 'predicted_depth'
  };
  const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
  const clamp = A.clamp || ((v, a, b) => v < a ? a : v > b ? b : v);
  const sleep = A.sleep || ((ms) => new Promise((r) => setTimeout(r, ms || 0)));

  /* ---------------- the runtime ---------------- */
  let ortLib = null;
  function runtime() {
    if (typeof A.runtime === 'function') return A.runtime();
    if (!ortLib) {
      ortLib = import(ORT_DIR + 'ort.wasm.min.mjs').then((m) => {
        const ort = m.default && m.default.InferenceSession ? m.default : m;
        ort.env.wasm.wasmPaths = ORT_DIR;
        ort.env.wasm.numThreads = 1;
        return ort;
      }).catch(() => {
        ortLib = null;
        throw new Error('The AI runtime could not be loaded. You may be offline — the first run needs the 14 MB runtime and the 26 MB depth model, after which both are cached.');
      });
    }
    return ortLib;
  }

  /* Read one or more files with progress; parts are concatenated in order,
     for a model that had to be shipped in pieces. */
  async function fetchParts(parts, expected, onProgress) {
    const chunks = [];
    let got = 0;
    let total = Number(expected) || 0;
    for (const url of parts) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('The depth model could not be downloaded (HTTP ' + res.status + ').');
      const len = Number(res.headers.get('content-length')) || 0;
      if (!total && len && parts.length === 1) total = len;
      if (!res.body || !res.body.getReader) {
        const buf = new Uint8Array(await res.arrayBuffer());
        chunks.push(buf); got += buf.length;
        if (onProgress) onProgress({ stage: 'download', fraction: Math.min(1, got / Math.max(total, got)), loaded: got, total: Math.max(total, got) });
        continue;
      }
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        if (onProgress) onProgress({ stage: 'download', fraction: Math.min(1, got / Math.max(total, got)), loaded: got, total: Math.max(total, got) });
      }
    }
    if (parts.length > 1 && expected && got !== Number(expected)) throw new Error('The depth model download was incomplete. Reload the page to try again.');
    if (chunks.length === 1) return chunks[0];
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  /* ---------------- sessions, one per model file ---------------- */
  const sessions = {};
  /**
   * A loaded network: { ort, session }. Uses the shared loader in
   * aiimg-core.js when one exists, otherwise does the same thing here.
   */
  function session(urlOrParts, bytes, onProgress) {
    const parts = Array.isArray(urlOrParts) ? urlOrParts : [urlOrParts];
    const key = parts.join('|');
    if (sessions[key]) return sessions[key];
    sessions[key] = (async () => {
      if (typeof A.loadSession === 'function') {
        const r = await A.loadSession(urlOrParts, { bytes, onProgress });
        if (r && r.session && r.ort) return r;
        const ort = await runtime();
        return { ort, session: r && r.session ? r.session : r };
      }
      const ort = await runtime();
      const data = await fetchParts(parts, bytes, onProgress);
      const sess = await ort.InferenceSession.create(data, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      return { ort, session: sess };
    })().catch((e) => { delete sessions[key]; throw e; });
    return sessions[key];
  }

  /** Drop every loaded network, so a page can give the memory back. */
  function release() {
    for (const k of Object.keys(sessions)) {
      const p = sessions[k];
      delete sessions[k];
      p.then((S) => { try { if (S.session && S.session.release) S.session.release(); } catch (e) { /* gone */ } }).catch(() => {});
    }
    cache = new WeakMap();
  }

  /* ---------------- the estimate ---------------- */
  let cache = new WeakMap();
  const r14 = (v) => Math.max(14, Math.round(v / 14) * 14);

  /**
   * Relative depth of a picture, at the mask resolution the segmentation
   * uses (768 on the long edge unless mw/mh are given), normalised per
   * picture between its 2nd and 98th percentiles: 0 = farthest, 1 = nearest.
   * `size` is the long edge the network sees (518, a multiple of 14).
   */
  async function estimate(image, opts) {
    opts = opts || {};
    const size = r14(clamp(Math.round(Number(opts.size) || 518), 196, 1036));
    const report = opts.onProgress || (() => {});
    const long = Math.max(image.width, image.height);
    const ms = Math.min(1, (opts.maskLongEdge || 768) / long);
    const mw = opts.mw || Math.max(1, Math.round(image.width * ms));
    const mh = opts.mh || Math.max(1, Math.round(image.height * ms));
    const hit = cache.get(image);
    if (hit && hit.size === size && hit.mw === mw && hit.mh === mh) return hit.result;

    const S = await session(MODEL.url, MODEL.bytes, report);
    report({ stage: 'run', fraction: 0 });

    /* the long edge goes to `size`, the short edge follows, both multiples of 14 */
    const sc = size / long;
    const iw = r14(image.width * sc), ih = r14(image.height * sc);
    const px = A.scaled(image.canvas, iw, ih).getContext('2d').getImageData(0, 0, iw, ih).data;
    const n = iw * ih;
    const input = new Float32Array(3 * n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      input[i] = (px[j] / 255 - MEAN[0]) / STD[0];
      input[n + i] = (px[j + 1] / 255 - MEAN[1]) / STD[1];
      input[2 * n + i] = (px[j + 2] / 255 - MEAN[2]) / STD[2];
    }
    await sleep(0);
    const t0 = performance.now();
    const feeds = {}; feeds[MODEL.input] = new S.ort.Tensor('float32', input, [1, 3, ih, iw]);
    const out = await S.session.run(feeds);
    const o = out[MODEL.output] || out[Object.keys(out)[0]];
    const dims = o.dims;
    const rh = dims[dims.length - 2], rw = dims[dims.length - 1];
    const raw = o.data instanceof Float32Array ? o.data : Float32Array.from(o.data);
    const took = performance.now() - t0;
    report({ stage: 'run', fraction: 0.8 });

    /* percentiles through a histogram: one pass, no sort */
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < raw.length; i++) { const v = raw[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!(hi > lo)) hi = lo + 1;
    const B = 2048;
    const hist = new Uint32Array(B);
    const scaleB = (B - 1) / (hi - lo);
    for (let i = 0; i < raw.length; i++) hist[((raw[i] - lo) * scaleB) | 0]++;
    const pct = (f) => {
      const target = f * raw.length;
      let acc = 0;
      for (let b = 0; b < B; b++) { acc += hist[b]; if (acc >= target) return lo + b / scaleB; }
      return hi;
    };
    const p2 = pct(0.02), p98 = pct(0.98);
    const span = Math.max(p98 - p2, 1e-6);

    /* bilinear to the mask resolution, normalised on the way */
    const data = new Float32Array(mw * mh);
    for (let y = 0; y < mh; y++) {
      const sy = clamp((y + 0.5) / mh * rh - 0.5, 0, rh - 1);
      const y0 = Math.floor(sy), y1 = Math.min(rh - 1, y0 + 1), fy = sy - y0;
      const r0 = y0 * rw, r1 = y1 * rw;
      for (let x = 0; x < mw; x++) {
        const sx = clamp((x + 0.5) / mw * rw - 0.5, 0, rw - 1);
        const x0 = Math.floor(sx), x1 = Math.min(rw - 1, x0 + 1), fx = sx - x0;
        const v = (raw[r0 + x0] * (1 - fx) + raw[r0 + x1] * fx) * (1 - fy) + (raw[r1 + x0] * (1 - fx) + raw[r1 + x1] * fx) * fy;
        data[y * mw + x] = clamp((v - p2) / span, 0, 1);
      }
      if ((y & 127) === 127) { report({ stage: 'run', fraction: 0.8 + 0.2 * y / mh }); await sleep(0); }
    }
    const result = { w: mw, h: mh, data, raw, rawW: rw, rawH: rh, lo: p2, hi: p98, ms: took, input: [iw, ih], size };
    cache.set(image, { size, mw, mh, result });
    report({ stage: 'done', fraction: 1 });
    return result;
  }

  /** Depth at a point given in 0..1 picture coordinates, averaged over a small disc. */
  function at(depth, u, v, radius) {
    const r = Math.max(0, Math.round(radius || 0));
    const cx = clamp(Math.round(u * (depth.w - 1)), 0, depth.w - 1), cy = clamp(Math.round(v * (depth.h - 1)), 0, depth.h - 1);
    let sum = 0, n = 0;
    for (let y = Math.max(0, cy - r); y <= Math.min(depth.h - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(depth.w - 1, cx + r); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;
        sum += depth.data[y * depth.w + x]; n++;
      }
    }
    return n ? sum / n : 0;
  }

  /** A grey canvas of the map (white = near), for a preview or a texture. */
  function toCanvas(depth, invert) {
    const c = document.createElement('canvas');
    c.width = depth.w; c.height = depth.h;
    const id = new ImageData(depth.w, depth.h);
    const d = id.data;
    for (let i = 0, j = 0; i < depth.data.length; i++, j += 4) {
      const g = Math.round((invert ? 1 - depth.data[i] : depth.data[i]) * 255);
      d[j] = g; d[j + 1] = g; d[j + 2] = g; d[j + 3] = 255;
    }
    c.getContext('2d').putImageData(id, 0, 0);
    return c;
  }

  A.depth = { estimate, release, session, at, toCanvas, MODEL };
})();
