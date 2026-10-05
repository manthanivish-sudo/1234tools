/**
 * Portrait matting and the cut-out pipeline shared by the AI image tools
 * that cut things out: Background Remover and Sticker Maker.
 *
 * EfficientViT (aiimg-core.js) says what is where — people, cars, sky —
 * as a class map. It is right about the body and wrong about the hair:
 * a segmentation network draws a blob, not strands. MODNet (Ke et al.,
 * AAAI 2022, Apache-2.0; 25 MB, served from this site) was trained to draw
 * exactly that: a soft alpha matte of a person, hair included. Here the
 * class map chooses where MODNet is trusted — near people — and the
 * guided-filter refinement of the class map does the rest of the frame.
 *
 * Nothing is uploaded. Both models and the runtime come from this site,
 * once, and the browser keeps them.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { clamp, scaled, sleep, el } = A;

  const ORT_DIR = '/engine/vendor/ort/';
  /* in two parts of at most 20 MiB (build/split-models.js); MODEL_BYTES is the whole file */
  const MODEL_URL = ['/engine/models/modnet-photographic-portrait-matting.onnx.part0', '/engine/models/modnet-photographic-portrait-matting.onnx.part1'];
  const MODEL_BYTES = 25888640;
  /* MODNet was trained with the short edge at 512 (onnx/inference_onnx.py
     in the MODNet repo and Xenova's preprocessor_config.json both say so).
     The long edge is capped so a panorama does not take ten seconds. */
  const SHORT = 512, LONG_MAX = 1024;

  /* ------------------------------------------------------------------ */
  /* runtime and sessions                                               */
  /* ------------------------------------------------------------------ */
  let ortLocal = null;
  function localRuntime() {
    if (!ortLocal) {
      ortLocal = import(ORT_DIR + 'ort.wasm.min.mjs').then((m) => {
        const ort = m.default && m.default.InferenceSession ? m.default : m;
        ort.env.wasm.wasmPaths = ORT_DIR;
        ort.env.wasm.numThreads = 1;
        return ort;
      }).catch(() => {
        ortLocal = null;
        throw new Error('The AI runtime could not be loaded. You may be offline — the first run needs the runtime and the models, after which all of them are cached.');
      });
    }
    return ortLocal;
  }
  const runtime = () => (typeof A.runtime === 'function' ? A.runtime() : localRuntime());

  async function fetchBytes(url, onProgress, expected) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('The model could not be downloaded (HTTP ' + res.status + ').');
    const total = Number(res.headers.get('content-length')) || expected || 0;
    if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (onProgress) onProgress({ stage: 'download', fraction: Math.min(1, got / Math.max(total, got, 1)), loaded: got, total: Math.max(total, got) });
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  const sessions = {};
  /**
   * The loaded network for a model URL, once per page: { ort, session }.
   * Uses the core's A.loadSession when a later core provides it, and does
   * the same thing here when it does not.
   */
  function session(url, bytes, onProgress) {
    if (sessions[url]) return sessions[url];
    sessions[url] = (async () => {
      const ort = await runtime();
      let s;
      if (typeof A.loadSession === 'function') {
        s = await A.loadSession(url, { bytes, onProgress });
        if (s && s.session && typeof s.run !== 'function') s = s.session;
      } else {
        const list = Array.isArray(url) ? url : [url];
        const got = [];
        for (const u of list) got.push(await fetchBytes(u, onProgress, bytes));
        const n = got.reduce((a, b) => a + b.length, 0);
        if (list.length > 1 && bytes && n !== bytes) throw new Error('The model download was incomplete. Reload the page to try again.');
        const data = new Uint8Array(n);
        let o = 0;
        for (const b of got) { data.set(b, o); o += b.length; }
        s = await ort.InferenceSession.create(data, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      }
      return { ort, session: s };
    })().catch((e) => { delete sessions[url]; throw e; });
    return sessions[url];
  }

  /* ------------------------------------------------------------------ */
  /* small image maths on Float32 planes                                */
  /* ------------------------------------------------------------------ */
  /** Bilinear resample of a plane. */
  function resample(src, sw, sh, dw, dh) {
    if (sw === dw && sh === dh) return new Float32Array(src);
    const out = new Float32Array(dw * dh);
    for (let y = 0; y < dh; y++) {
      const sy = clamp((y + 0.5) * sh / dh - 0.5, 0, sh - 1);
      const y0 = Math.floor(sy), y1 = Math.min(sh - 1, y0 + 1), fy = sy - y0;
      const r0 = y0 * sw, r1 = y1 * sw;
      for (let x = 0; x < dw; x++) {
        const sx = clamp((x + 0.5) * sw / dw - 0.5, 0, sw - 1);
        const x0 = Math.floor(sx), x1 = Math.min(sw - 1, x0 + 1), fx = sx - x0;
        out[y * dw + x] = (src[r0 + x0] * (1 - fx) + src[r0 + x1] * fx) * (1 - fy) + (src[r1 + x0] * (1 - fx) + src[r1 + x1] * fx) * fy;
      }
    }
    return out;
  }
  /** A rectangle [x, y, w, h] of a plane, resampled to dw×dh. */
  function resampleRect(src, sw, sh, rect, dw, dh) {
    const [rx, ry, rw, rh] = rect;
    const out = new Float32Array(dw * dh);
    for (let y = 0; y < dh; y++) {
      const sy = clamp(ry + (y + 0.5) * rh / dh - 0.5, 0, sh - 1);
      const y0 = Math.floor(sy), y1 = Math.min(sh - 1, y0 + 1), fy = sy - y0;
      const r0 = y0 * sw, r1 = y1 * sw;
      for (let x = 0; x < dw; x++) {
        const sx = clamp(rx + (x + 0.5) * rw / dw - 0.5, 0, sw - 1);
        const x0 = Math.floor(sx), x1 = Math.min(sw - 1, x0 + 1), fx = sx - x0;
        out[y * dw + x] = (src[r0 + x0] * (1 - fx) + src[r0 + x1] * fx) * (1 - fy) + (src[r1 + x0] * (1 - fx) + src[r1 + x1] * fx) * fy;
      }
    }
    return out;
  }

  /** Mean over a (2r+1)² window, clipped at the borders; separable running sums. */
  function boxBlur(src, w, h, r) {
    if (r < 1) return new Float32Array(src);
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let sum = 0, cnt = 0;
      for (let x = 0; x < Math.min(w, r); x++) { sum += src[o + x]; cnt++; }
      for (let x = 0; x < w; x++) {
        const xin = x + r, xout = x - r - 1;
        if (xin < w) { sum += src[o + xin]; cnt++; }
        if (xout >= 0) { sum -= src[o + xout]; cnt--; }
        tmp[o + x] = sum / cnt;
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0, cnt = 0;
      for (let y = 0; y < Math.min(h, r); y++) { sum += tmp[y * w + x]; cnt++; }
      for (let y = 0; y < h; y++) {
        const yin = y + r, yout = y - r - 1;
        if (yin < h) { sum += tmp[yin * w + x]; cnt++; }
        if (yout >= 0) { sum -= tmp[yout * w + x]; cnt--; }
        out[y * w + x] = sum / cnt;
      }
    }
    return out;
  }
  /** Three box blurs approximate a Gaussian well enough for a glow. */
  const smoothBlur = (src, w, h, r) => (r < 1 ? new Float32Array(src) : boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r));

  /* Felzenszwalb & Huttenlocher's exact Euclidean distance transform:
     a lower envelope of parabolas per row, then per column, O(n). */
  const INF = 1e20;
  function edt1d(f, d, v, z, n) {
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  }
  /** Distance, in pixels, from every pixel to the nearest pixel where `inside` is non-zero (0 there). */
  function distance(inside, w, h) {
    const n = w * h;
    const g = new Float64Array(n);
    for (let i = 0; i < n; i++) g[i] = inside[i] ? 0 : INF;
    const m = Math.max(w, h);
    const f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = g[y * w + x];
      edt1d(f, d, v, z, h);
      for (let y = 0; y < h; y++) g[y * w + x] = d[y];
    }
    const out = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) f[x] = g[o + x];
      edt1d(f, d, v, z, w);
      for (let x = 0; x < w; x++) out[o + x] = d[x] >= INF / 2 ? 1e9 : Math.sqrt(d[x]);
    }
    return out;
  }

  /** Connected components (4-neighbour) of a binary mask: labels 1..n, 0 outside. */
  function components(mask, w, h) {
    const labels = new Int32Array(w * h);
    const stack = new Int32Array(w * h);
    let n = 0;
    for (let s = 0; s < labels.length; s++) {
      if (!mask[s] || labels[s]) continue;
      n++;
      let top = 0;
      stack[top++] = s; labels[s] = n;
      while (top) {
        const i = stack[--top];
        const x = i % w, y = (i - x) / w;
        if (x > 0 && mask[i - 1] && !labels[i - 1]) { labels[i - 1] = n; stack[top++] = i - 1; }
        if (x < w - 1 && mask[i + 1] && !labels[i + 1]) { labels[i + 1] = n; stack[top++] = i + 1; }
        if (y > 0 && mask[i - w] && !labels[i - w]) { labels[i - w] = n; stack[top++] = i - w; }
        if (y < h - 1 && mask[i + w] && !labels[i + w]) { labels[i + w] = n; stack[top++] = i + w; }
      }
    }
    return { labels, count: n };
  }

  /** Bounding box [x0, y0, x1, y1] (inclusive) of the pixels above `thr`, or null. */
  function bbox(alpha, w, h, thr) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    const t = thr === undefined ? 0.02 : thr;
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        if (alpha[i] <= t) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }

  /* ------------------------------------------------------------------ */
  /* MODNet                                                             */
  /* ------------------------------------------------------------------ */
  /**
   * MODNet's alpha for the whole picture, resampled to mw×mh.
   * Input 1×3×H×W RGB in [−1, 1], H and W multiples of 32; output
   * 1×1×H×W in 0..1.
   */
  async function matte(image, opts) {
    opts = opts || {};
    const report = opts.onProgress || (() => {});
    const S = await session(MODEL_URL, MODEL_BYTES, report);
    report({ stage: 'run', fraction: 0 });
    const W = image.width, H = image.height;
    let sc = SHORT / Math.min(W, H);
    if (Math.max(W, H) * sc > LONG_MAX) sc = LONG_MAX / Math.max(W, H);
    const r32 = (v) => Math.max(32, Math.round(v / 32) * 32);
    const iw = r32(W * sc), ih = r32(H * sc);
    const px = scaled(image.canvas, iw, ih).getContext('2d').getImageData(0, 0, iw, ih).data;
    const n = iw * ih;
    const input = new Float32Array(3 * n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      input[i] = px[j] / 127.5 - 1;
      input[n + i] = px[j + 1] / 127.5 - 1;
      input[2 * n + i] = px[j + 2] / 127.5 - 1;
    }
    await sleep(0);
    const feeds = {};
    const inName = (S.session.inputNames && S.session.inputNames[0]) || 'input';
    const outName = (S.session.outputNames && S.session.outputNames[0]) || 'output';
    feeds[inName] = new S.ort.Tensor('float32', input, [1, 3, ih, iw]);
    const t0 = performance.now();
    const out = await S.session.run(feeds);
    const o = out[outName];
    const oh = o.dims[2], ow = o.dims[3];
    const src = o.data instanceof Float32Array ? o.data : Float32Array.from(o.data);
    const mw = opts.mw || W, mh = opts.mh || H;
    const alpha = resample(src, ow, oh, mw, mh);
    for (let i = 0; i < alpha.length; i++) alpha[i] = clamp(alpha[i], 0, 1);
    report({ stage: 'done', fraction: 1 });
    return { alpha, mw, mh, input: [iw, ih], ms: Math.round(performance.now() - t0) };
  }

  /**
   * Where the class map says a person is, trust the matte; elsewhere the
   * refined layer alpha. `people` is the person class mask (Uint8, mw×mh),
   * `others` the class mask of the other kept layers. Hair may extend
   * `reach` pixels outside the person mask; beyond twice that the matte
   * is ignored, so a portrait model is never asked about a lamp post.
   *
   * MODNet was trained on one person filling the frame. Where it plainly
   * did not find a person the class map found — a small figure at the
   * back of a street — that region keeps the layer alpha instead of
   * vanishing. Regions are the connected pieces of the person mask.
   */
  function blend(layerAlpha, matteAlpha, people, others, w, h, reach, exclude) {
    const n = w * h;
    const { labels, count } = components(people, w, h);
    const sumM = new Float64Array(count + 1), sumP = new Float64Array(count + 1);
    for (let i = 0; i < n; i++) { const l = labels[i]; if (l) { sumP[l]++; sumM[l] += matteAlpha[i]; } }
    const trust = new Uint8Array(count + 1);
    let used = 0, skipped = 0;
    for (let l = 1; l <= count; l++) {
      if (sumP[l] < 16) continue;
      if (sumM[l] / sumP[l] >= 0.4) { trust[l] = 1; used++; } else skipped++;
    }
    if (!used) return { alpha: layerAlpha, used: 0, skipped, regions: count };
    const zone = new Uint8Array(n);
    let zoneArea = 0;
    for (let i = 0; i < n; i++) if (trust[labels[i]]) { zone[i] = 1; zoneArea++; }

    /* The class map is often wrong about the body — a chin labelled as
       furniture, a shoulder as wall — where the matte is plainly right.
       So the zone grows to the matte's own blobs that touch a trusted
       person, unless they are so much bigger that the matte has clearly
       lost the plot (a street it painted white), in which case the class
       map keeps the say. */
    const mBin = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (matteAlpha[i] > 0.5) mBin[i] = 1;
    const mc = components(mBin, w, h);
    const hit = new Uint8Array(mc.count + 1);
    for (let i = 0; i < n; i++) if (zone[i] && mc.labels[i]) hit[mc.labels[i]] = 1;
    let mArea = 0;
    for (let i = 0; i < n; i++) if (mc.labels[i] && hit[mc.labels[i]]) mArea++;
    let grown = false;
    if (mArea <= 3 * zoneArea) {
      for (let i = 0; i < n; i++) if (mc.labels[i] && hit[mc.labels[i]] && !zone[i]) { zone[i] = 1; grown = true; }
    }

    const dist = distance(zone, w, h);
    const r = Math.max(2, reach);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const wgt = clamp(2 - dist[i] / r, 0, 1);
      if (wgt <= 0) { out[i] = layerAlpha[i]; continue; }
      /* a kept layer under the matte survives; an unticked person-sized
         object (a bag, a chair) stays unticked; anything else — wall,
         floor, furniture the class map misread — defers to the matte */
      const target = others[i] ? Math.max(layerAlpha[i], matteAlpha[i]) : (exclude && exclude[i]) ? layerAlpha[i] : matteAlpha[i];
      out[i] = layerAlpha[i] + (target - layerAlpha[i]) * wgt;
    }
    return { alpha: out, used, skipped, regions: count, grown };
  }

  /* ------------------------------------------------------------------ */
  /* the pipeline both tools share                                      */
  /* ------------------------------------------------------------------ */
  /**
   * Find the layers, and the matte when there are people and it is
   * wanted. Returns an item: { image, seg, matte, guide, timings }.
   * Progress: { stage: 'download'|'run'|'matte'|'done', ... , model }.
   */
  async function analyse(image, opts) {
    opts = opts || {};
    const report = opts.onProgress || (() => {});
    const t0 = performance.now();
    const seg = await A.segment(image, { detail: opts.detail, onProgress: (p) => report(Object.assign({ model: 'segment' }, p)) });
    const t1 = performance.now();
    const item = { image, seg, matte: null, matteInfo: null, guide: null, timings: { segment: Math.round(t1 - t0), matte: 0 } };
    const hasPeople = seg.layers.some((l) => l.label === 'person');
    if (hasPeople && opts.hair !== false) {
      report({ model: 'matte', stage: 'run', fraction: 0 });
      try {
        const m = await matte(image, { mw: seg.mw, mh: seg.mh, onProgress: (p) => report(Object.assign({ model: 'matte' }, p)) });
        item.matte = m.alpha;
        item.matteInfo = { input: m.input, ms: m.ms };
        item.timings.matte = Math.round(performance.now() - t1);
      } catch (e) {
        /* the cut-out still works without it; the tool says so */
        item.matteError = (e && e.message) || String(e);
      }
    }
    report({ model: 'done', stage: 'done', fraction: 1 });
    return item;
  }

  /** The person layer's key in a segmentation, or -1. */
  const personKey = (seg) => { const l = seg.layers.find((x) => x.label === 'person'); return l ? l.key : -1; };

  /**
   * The alpha of the kept layers at mask resolution, refined against the
   * picture and, for people, replaced by the matte.
   * Returns { alphaLayer, alphaFull, matteUsed, box } where box is the
   * union bounding box of the kept layers in mask pixels, or null.
   */
  function cut(item, opts) {
    const { seg } = item;
    const { mw, mh, classMap } = seg;
    const kept = opts.kept;
    const inKeep = new Uint8Array(256);
    for (const k of kept) inKeep[k] = 1;
    const pk = personKey(seg);
    const n = mw * mh;
    const isSubject = new Uint8Array(256);
    for (const L of seg.layers) if (L.subject && !kept.has(L.key)) isSubject[L.key] = 1;
    const bin = new Float32Array(n), people = new Uint8Array(n), others = new Uint8Array(n), exclude = new Uint8Array(n);
    let any = false, anyPeople = false;
    for (let i = 0; i < n; i++) {
      const k = classMap[i];
      if (!inKeep[k]) { if (isSubject[k]) exclude[i] = 1; continue; }
      bin[i] = 1; any = true;
      if (k === pk) { people[i] = 1; anyPeople = true; } else others[i] = 1;
    }
    let box = null;
    for (const L of seg.layers) {
      if (!kept.has(L.key)) continue;
      const b = L.bbox;
      if (!b || b[2] < 0) continue;
      box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b.slice();
    }
    if (!any) return { alphaLayer: bin, alphaFull: bin, matteUsed: 0, matteSkipped: 0, box: null };
    if (!item.guide) item.guide = A.guideOf(item.image, mw, mh);
    const alphaLayer = A.refine(bin, item.guide, { softness: opts.softness, shift: opts.shift });
    let alphaFull = alphaLayer, matteUsed = 0, matteSkipped = 0;
    if (anyPeople && opts.hair !== false && item.matte) {
      const reach = opts.reach || Math.round(0.03 * Math.max(mw, mh));
      const r = blend(alphaLayer, item.matte, people, others, mw, mh, reach, exclude);
      alphaFull = r.alpha; matteUsed = r.used; matteSkipped = r.skipped;
      /* the matte may have recovered a body the class map lost: the box follows the alpha */
      const ab = bbox(alphaFull, mw, mh, 0.1);
      if (ab) box = box ? [Math.min(box[0], ab[0]), Math.min(box[1], ab[1]), Math.max(box[2], ab[2]), Math.max(box[3], ab[3])] : ab;
    }
    return { alphaLayer, alphaFull, matteUsed, matteSkipped, box };
  }

  /** The rows of the Layers pane, in the markup the section shares. */
  function layerRows(container, seg, kept, onChange) {
    container.innerHTML = '';
    if (!seg) return;
    for (const L of seg.layers) {
      const row = el('label', 'aiimg-layer');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = kept.has(L.key);
      cb.addEventListener('change', () => { if (cb.checked) kept.add(L.key); else kept.delete(L.key); onChange(L, cb.checked); });
      const sw = el('span', 'aiimg-swatch'); sw.style.background = L.colour;
      const name = el('span', 'aiimg-lname', L.name);
      const area = el('span', 'aiimg-area', (L.area * 100).toFixed(L.area < 0.1 ? 1 : 0) + '%');
      row.append(cb, sw, name, area);
      container.appendChild(row);
    }
  }

  /** Which layers to keep in a photo, by the labels kept in another, else its subjects. */
  function keepLike(seg, labels) {
    const byLabel = seg.layers.filter((l) => labels && labels.has(l.label)).map((l) => l.key);
    if (byLabel.length) return new Set(byLabel);
    return new Set(seg.layers.filter((l) => l.subject).map((l) => l.key));
  }

  /** Download many files: one zip when the site's zip writer is on the page, else one by one. */
  async function downloadAll(files, zipName) {
    if (!files.length) return null;
    if (typeof window.MVRZip === 'function') {
      const seen = new Map();
      const uniq = files.map((f) => {
        const k = f.name.toLowerCase();
        const c = (seen.get(k) || 0) + 1; seen.set(k, c);
        return { name: c > 1 ? f.name.replace(/(\.[^.]+)$/, '-' + c + '$1') : f.name, blob: f.blob };
      });
      const zip = await window.MVRZip(uniq);
      A.download(zip, zipName || 'images.zip');
      return zip;
    }
    for (let i = 0; i < files.length; i++) {
      A.download(files[i].blob, files[i].name);
      if (i < files.length - 1) await sleep(300);
    }
    return null;
  }

  /** Magic-byte check of an encoded image, for the formats the tools write. */
  const isPNG = (u8) => u8.length > 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47;
  const isWebP = (u8) => u8.length > 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50;

  A.matte = {
    MODEL_URL, MODEL_BYTES, session, run: matte, analyse, cut, blend, personKey,
    resample, resampleRect, boxBlur, smoothBlur, distance, components, bbox,
    layerRows, keepLike, downloadAll, isPNG, isWebP
  };
})();
