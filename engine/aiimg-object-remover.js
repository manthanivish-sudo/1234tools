/**
 * Object & People Remover.
 *
 * Brush over what should go, or take every person the segmentation model
 * found with one tap, and MI-GAN paints the gap on the device. A small
 * selection is one run of the network over a square window around it; a
 * large one is filled coarsely over the whole area first and then refined
 * tile by tile at full resolution, each tile seeing the coarse fill as its
 * context, so a big hole in a big photo is coherent and sharp rather than a
 * smeared blob. The result becomes the working picture, so the next object
 * is one more brush stroke away. Nothing is uploaded.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, check, button, sleep, fmtBytes } = A;

  /* MI-GAN 512 (Places2), Picsart AI Research, MIT. Exported from the official
     checkpoint by build/ai-image/export-migan.py at a fixed 512×512: inputs
     `image` 1×3×512×512 in [-1, 1] and `mask` 1×1×512×512 with 1 = keep and
     0 = hole; output 1×3×512×512 in [-1, 1]. See engine/models/README-migan.txt. */
  const MODEL_URL = '/engine/models/migan-512-places2.onnx';
  const MODEL_BYTES = 28037335;
  const RES = 512;
  const WORK_MAX = 2048;          /* the working resolution: the mask and the fill live here */
  const PREVIEW_MAX = 1280;
  const SINGLE_MAX = Math.round(RES * 1.5);   /* a window up to this many source px is one run */
  const MARGIN = 48, BLEND = 48;  /* a tile's context margin, and how far neighbouring cores overlap */
  const HOLE_MIN = 6;             /* mask values above this (of 255) are hole */
  const CLIP_SECONDS = 4;
  const TINT = [255, 64, 64];

  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };
  const pct = (v) => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function copyCanvas(src) {
    const c = el('canvas'); c.width = src.width; c.height = src.height;
    c.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0);
    return c;
  }

  /* ------------------------------------------------------------------ */
  /* the network                                                        */
  /* ------------------------------------------------------------------ */
  /* The core is growing A.runtime / A.fetchModel / A.loadSession; until a
     page has them, the same is done here. Nothing is fetched before the
     first removal, and the bytes are read with progress. */
  let ortLib = null;
  function runtime() {
    if (A.runtime) return A.runtime();
    if (!ortLib) {
      ortLib = import('/engine/vendor/ort/ort.wasm.min.mjs').then((m) => {
        const ort = m.default && m.default.InferenceSession ? m.default : m;
        ort.env.wasm.wasmPaths = '/engine/vendor/ort/';
        ort.env.wasm.numThreads = 1;
        return ort;
      }).catch(() => {
        ortLib = null;
        throw new Error('The AI runtime could not be loaded. You may be offline — the first run needs the 14 MB runtime and the 28 MB model, after which both are cached.');
      });
    }
    return ortLib;
  }
  async function fetchBytes(url, onProgress, expect, base, grand) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('The model could not be downloaded (HTTP ' + res.status + ').');
    const total = Number(res.headers.get('content-length')) || expect || 0;
    if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (onProgress) {
        const all = grand || Math.max(total, got), loaded = (base || 0) + got;
        onProgress({ stage: 'download', fraction: Math.min(1, loaded / Math.max(all, loaded)), loaded, total: Math.max(all, loaded) });
      }
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  async function fetchModel(parts, onProgress, expect) {
    if (!Array.isArray(parts)) {
      if (A.fetchModel && A.fetchModel.length >= 2) return A.fetchModel(parts, onProgress, expect);
      return fetchBytes(parts, onProgress, expect);
    }
    const got = [];
    let loaded = 0;
    for (const p of parts) { const b = await fetchBytes(p, onProgress, 0, loaded, expect); got.push(b); loaded += b.length; }
    const out = new Uint8Array(loaded);
    let o = 0;
    for (const c of got) { out.set(c, o); o += c.length; }
    return out;
  }
  let sessionPromise = null;
  function session(onProgress) {
    if (sessionPromise) return sessionPromise;
    sessionPromise = (async () => {
      const ort = await runtime();
      if (A.loadSession) {
        const s = await A.loadSession(MODEL_URL, { bytes: MODEL_BYTES, onProgress });
        return { ort: (s && s.ort) || ort, session: s && s.session ? s.session : s };
      }
      const bytes = await fetchModel(MODEL_URL, onProgress, MODEL_BYTES);
      const run = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      return { ort, session: run };
    })().catch((e) => { sessionPromise = null; throw e; });
    return sessionPromise;
  }

  /* ------------------------------------------------------------------ */
  /* geometry                                                           */
  /* ------------------------------------------------------------------ */
  function holeBox(mask, W, H) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
    for (let y = 0, i = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i++) {
        if (mask[i] <= HOLE_MIN) continue;
        n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return n ? { x0, y0, x1, y1, n } : null;
  }
  /* A square around the hole with half as much again of context, at least
     the network's own size, clamped to the picture (so not square when the
     picture is not big enough). */
  function windowFor(box, W, H) {
    const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
    const side = Math.max(Math.ceil(Math.max(bw, bh) * 1.5), RES);
    const w = Math.min(side, W), h = Math.min(side, H);
    const x = clamp(Math.round((box.x0 + box.x1 + 1) / 2 - w / 2), 0, W - w);
    const y = clamp(Math.round((box.y0 + box.y1 + 1) / 2 - h / 2), 0, H - h);
    return { x, y, w, h };
  }
  /* Tiles of T along one axis over a span of L starting at o. A tile's core
     is the tile less a context margin on each side that has a neighbour,
     and neighbouring cores overlap by BLEND for the ramp between them. */
  function axis(o, L, T) {
    if (L <= T) return [{ p: o, size: L, c0: o, c1: o + L, first: true, last: true }];
    const stride = T - 2 * MARGIN - BLEND;
    const n = Math.ceil((L - T) / stride) + 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = Math.min(o + i * stride, o + L - T);
      const first = i === 0, last = i === n - 1;
      out.push({ p, size: T, c0: p + (first ? 0 : MARGIN), c1: p + T - (last ? 0 : MARGIN), first, last });
    }
    return out;
  }
  const ramp = (v, c0, c1, first, last) => {
    let w = 1;
    if (!first) w = Math.min(w, clamp((v - c0 + 0.5) / BLEND, 0, 1));
    if (!last) w = Math.min(w, clamp((c1 - v - 0.5) / BLEND, 0, 1));
    return w;
  };

  /* ------------------------------------------------------------------ */
  /* one run of the network                                             */
  /* ------------------------------------------------------------------ */
  /**
   * Region r of `src` goes through the network at 512×512; the hole is
   * marked only inside `rect` (the whole region, or a tile's core), so
   * what lies outside it — including a coarse fill — is context. Returns
   * the network's picture scaled back to r's size.
   */
  async function runModel(src, hole, W, r, rect, sess, ms) {
    const c = el('canvas'); c.width = RES; c.height = RES;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    cx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, RES, RES);
    const px = cx.getImageData(0, 0, RES, RES).data;
    const n = RES * RES;
    const img = new Float32Array(3 * n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      img[i] = px[j] / 127.5 - 1; img[n + i] = px[j + 1] / 127.5 - 1; img[2 * n + i] = px[j + 2] / 127.5 - 1;
    }
    /* A network pixel is hole if any source pixel under it is: the object
       must be covered completely, whatever the scale. */
    const hx0 = rect.x0 - r.x, hx1 = rect.x1 - r.x, hy0 = rect.y0 - r.y, hy1 = rect.y1 - r.y;
    const isHole = new Uint8Array(n);
    for (let my = 0; my < RES; my++) {
      const sy0 = Math.floor(my * r.h / RES), sy1 = Math.max(sy0 + 1, Math.ceil((my + 1) * r.h / RES));
      if (sy1 <= hy0 || sy0 >= hy1) continue;
      const ya = Math.max(sy0, hy0), yb = Math.min(sy1, hy1);
      for (let mx = 0; mx < RES; mx++) {
        const sx0 = Math.floor(mx * r.w / RES), sx1 = Math.max(sx0 + 1, Math.ceil((mx + 1) * r.w / RES));
        if (sx1 <= hx0 || sx0 >= hx1) continue;
        const xa = Math.max(sx0, hx0), xb = Math.min(sx1, hx1);
        let h = 0;
        for (let sy = ya; sy < yb && !h; sy++) {
          const o = (r.y + sy) * W + r.x;
          for (let sx = xa; sx < xb; sx++) if (hole[o + sx]) { h = 1; break; }
        }
        if (h) isHole[my * RES + mx] = 1;
      }
    }
    /* grown by one network pixel, so the object's own edge colour, blurred
       into its neighbours by the downscale, is never used as context */
    const keep = new Float32Array(n).fill(1);
    for (let y = 0; y < RES; y++) {
      for (let x = 0; x < RES; x++) {
        const i = y * RES + x;
        if (isHole[i] || (x > 0 && isHole[i - 1]) || (x < RES - 1 && isHole[i + 1]) || (y > 0 && isHole[i - RES]) || (y < RES - 1 && isHole[i + RES])) keep[i] = 0;
      }
    }
    const t0 = performance.now();
    const out = await sess.session.run({
      image: new sess.ort.Tensor('float32', img, [1, 3, RES, RES]),
      mask: new sess.ort.Tensor('float32', keep, [1, 1, RES, RES])
    });
    ms.push(performance.now() - t0);
    const d = (out.output || out[Object.keys(out)[0]]).data;
    const id = new ImageData(RES, RES);
    const q = id.data;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      q[j] = clamp((d[i] + 1) * 127.5, 0, 255);
      q[j + 1] = clamp((d[n + i] + 1) * 127.5, 0, 255);
      q[j + 2] = clamp((d[2 * n + i] + 1) * 127.5, 0, 255);
      q[j + 3] = 255;
    }
    cx.putImageData(id, 0, 0);
    if (r.w === RES && r.h === RES) return c;
    const f = el('canvas'); f.width = r.w; f.height = r.h;
    const fx = f.getContext('2d', { willReadFrequently: true });
    fx.imageSmoothingEnabled = true; fx.imageSmoothingQuality = 'high';
    fx.drawImage(c, 0, 0, RES, RES, 0, 0, r.w, r.h);
    return f;
  }

  /** dst = dst·(1−a) + fill·a within region r, a being the soft mask. */
  function paste(dst, fill, r, mask, W) {
    const dx = dst.getContext('2d');
    const od = dx.getImageData(r.x, r.y, r.w, r.h);
    const o = od.data;
    const f = fill.getContext('2d').getImageData(0, 0, r.w, r.h).data;
    for (let y = 0, k = 0; y < r.h; y++) {
      let i = (r.y + y) * W + r.x;
      for (let x = 0; x < r.w; x++, i++, k += 4) {
        const a = mask[i];
        if (!a) continue;
        const t = a / 255;
        o[k] += (f[k] - o[k]) * t; o[k + 1] += (f[k + 1] - o[k + 1]) * t; o[k + 2] += (f[k + 2] - o[k + 2]) * t;
      }
    }
    dx.putImageData(od, r.x, r.y);
  }

  /** A tile's fill, weighted by the ramp over its core, into the window's accumulators. */
  function accumulate(fill, t, win, acc, wsum, mask, W) {
    const f = fill.getContext('2d').getImageData(0, 0, t.w, t.h).data;
    for (let y = t.cy0; y < t.cy1; y++) {
      const wy = ramp(y, t.cy0, t.cy1, t.firstY, t.lastY);
      if (wy <= 0) continue;
      for (let x = t.cx0; x < t.cx1; x++) {
        if (!mask[y * W + x]) continue;
        const w = wy * ramp(x, t.cx0, t.cx1, t.firstX, t.lastX);
        if (w <= 0) continue;
        const k = ((y - t.y) * t.w + (x - t.x)) * 4;
        const a = (y - win.y) * win.w + (x - win.x);
        acc[a * 3] += f[k] * w; acc[a * 3 + 1] += f[k + 1] * w; acc[a * 3 + 2] += f[k + 2] * w; wsum[a] += w;
      }
    }
  }
  /** Where tiles reached: out = src·(1−a) + (acc/wsum)·a. Elsewhere out keeps the coarse fill. */
  function composeTiles(out, src, win, acc, wsum, mask, W) {
    const ox = out.getContext('2d');
    const od = ox.getImageData(win.x, win.y, win.w, win.h);
    const o = od.data;
    const s = src.getContext('2d').getImageData(win.x, win.y, win.w, win.h).data;
    for (let y = 0, a = 0; y < win.h; y++) {
      for (let x = 0; x < win.w; x++, a++) {
        if (wsum[a] <= 0) continue;
        const m = mask[(win.y + y) * W + win.x + x];
        if (!m) continue;
        const t = m / 255, inv = 1 / wsum[a], k = a * 4;
        o[k] = s[k] + (acc[a * 3] * inv - s[k]) * t;
        o[k + 1] = s[k + 1] + (acc[a * 3 + 1] * inv - s[k + 1]) * t;
        o[k + 2] = s[k + 2] + (acc[a * 3 + 2] * inv - s[k + 2]) * t;
      }
    }
    ox.putImageData(od, win.x, win.y);
  }

  /**
   * Fill the mask on `src`. One run when the window around the hole is
   * small enough; otherwise a coarse run over the whole window and then a
   * run per tile at native scale, each tile marking only its own core as
   * hole so the coarse fill around it is context. Progress and an
   * AbortSignal are honoured between runs.
   */
  async function inpaint(src, mask, W, H, sess, o) {
    const report = o.onProgress || (() => {});
    const box = holeBox(mask, W, H);
    if (!box) throw new Error('Nothing is selected.');
    const hole = new Uint8Array(W * H);
    for (let i = 0; i < hole.length; i++) hole[i] = mask[i] > HOLE_MIN ? 1 : 0;
    const win = windowFor(box, W, H);
    const ms = [];
    const whole = { x0: win.x, y0: win.y, x1: win.x + win.w, y1: win.y + win.h };
    const checkAbort = () => { if (o.signal && o.signal.aborted) throw abortError(); };

    checkAbort();
    if (Math.max(win.w, win.h) <= SINGLE_MAX || o.refine === false) {
      report({ fraction: 0.05, text: 'Painting the gap…' });
      await sleep(0);
      const fill = await runModel(src, hole, W, win, whole, sess, ms);
      const out = copyCanvas(src);
      paste(out, fill, win, mask, W);
      report({ fraction: 1 });
      return { canvas: out, tiles: 1, ms, box, win, mode: 'single' };
    }

    report({ fraction: 0.03, text: 'Coarse pass over the whole area…' });
    await sleep(0);
    const coarseFill = await runModel(src, hole, W, win, whole, sess, ms);
    const coarse = copyCanvas(src);
    paste(coarse, coarseFill, win, mask, W);
    checkAbort();
    await sleep(0);

    const xs = axis(win.x, win.w, RES), ys = axis(win.y, win.h, RES);
    const tiles = [];
    for (const ty of ys) {
      for (const tx of xs) {
        let inCore = 0;
        for (let y = ty.c0; y < ty.c1; y++) {
          const base = y * W;
          for (let x = tx.c0; x < tx.c1; x++) if (hole[base + x]) inCore++;
        }
        if (!inCore) continue;
        /* a core that is nearly all hole has nothing to see from; the coarse fill stands there */
        if (inCore > 0.85 * tx.size * ty.size) continue;
        tiles.push({ x: tx.p, y: ty.p, w: tx.size, h: ty.size, cx0: tx.c0, cx1: tx.c1, cy0: ty.c0, cy1: ty.c1, firstX: tx.first, lastX: tx.last, firstY: ty.first, lastY: ty.last });
      }
    }
    if (!tiles.length) { report({ fraction: 1 }); return { canvas: coarse, tiles: 1, ms, box, win, mode: 'coarse' }; }

    const acc = new Float32Array(3 * win.w * win.h), wsum = new Float32Array(win.w * win.h);
    for (let k = 0; k < tiles.length; k++) {
      checkAbort();
      const t = tiles[k];
      report({ fraction: 0.1 + 0.88 * k / tiles.length, text: 'Refining at full resolution — tile ' + (k + 1) + ' of ' + tiles.length + '…' });
      await sleep(0);
      const fill = await runModel(coarse, hole, W, t, { x0: t.cx0, y0: t.cy0, x1: t.cx1, y1: t.cy1 }, sess, ms);
      accumulate(fill, t, win, acc, wsum, mask, W);
      if (o.onTile) o.onTile(k, tiles.length);
    }
    composeTiles(coarse, src, win, acc, wsum, mask, W);
    report({ fraction: 1 });
    return { canvas: coarse, tiles: tiles.length + 1, ms, box, win, mode: 'tiled' };
  }

  /* ------------------------------------------------------------------ */
  /* masks from layers                                                  */
  /* ------------------------------------------------------------------ */
  /** Grow a 0/1 map by lx to the left, rx to the right, uy up and dy down (separable max). */
  function dilate(src, w, h, lx, rx, uy, dy) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        let m = 0;
        const a = Math.max(0, x - rx), b = Math.min(w - 1, x + lx);
        for (let k = a; k <= b; k++) { const v = src[o + k]; if (v > m) { m = v; if (m >= 1) break; } }
        tmp[o + x] = m;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let m = 0;
        const a = Math.max(0, y - dy), b = Math.min(h - 1, y + uy);
        for (let k = a; k <= b; k++) { const v = tmp[k * w + x]; if (v > m) { m = v; if (m >= 1) break; } }
        out[y * w + x] = m;
      }
    }
    return out;
  }
  /** 3×3 mean, for a soft edge after the hard operations. */
  function soften(src, w, h) {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0, c = 0;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) { s += src[yy * w + xx]; c++; }
        out[y * w + x] = s / c;
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      name: 'image', original: null, image: null, W: 0, H: 0,
      mask: null, overlay: null, ovCanvas: null, undo: [], redo: [], history: [], lastMask: null,
      seg: null, guide: null, segStale: false, segBusy: false,
      brush: { mode: 'add', size: 40 }, grow: 2, shadows: false, shadowReach: 60, refine: true,
      compare: false, split: 0.5, hover: null, job: null, exporting: false,
      stats: { runs: [], heapPeak: 0, last: null }
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aiimg-era');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas is-brush');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Preview. Paint over what should go. Ctrl+Z undoes a stroke; [ and ] change the brush size.');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const compareChk = on(check('aiimg-era-compare', 'Compare before and after — drag the divider', false), () => { S.compare = compareChk.input.checked; canvas.classList.toggle('is-compare', S.compare); invalidate(); });
    const change = button('Change photo', 'btn-ghost', () => file.click());
    transport.append(compareChk, change);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['remove', 'Remove'], ['export', 'Export']]) {
      const b = button(label, 'chip', () => showPane(k));
      b.dataset.pane = k; b.setAttribute('role', 'tab');
      tabs.appendChild(b);
      const p = el('div', 'aiimg-pane'); p.dataset.pane = k; p.hidden = true; p.setAttribute('role', 'tabpanel');
      panes[k] = p;
    }
    side.appendChild(tabs);
    for (const k in panes) side.appendChild(panes[k]);
    studio.append(stageCol, side);
    const msg = el('div', 'io-msg');
    wrap.append(drop, file, studio, msg);
    io.appendChild(wrap);

    function showPane(k) {
      for (const b of tabs.children) { const onIt = b.dataset.pane === k; b.classList.toggle('is-on', onIt); b.setAttribute('aria-selected', onIt ? 'true' : 'false'); }
      for (const p in panes) panes[p].hidden = p !== k;
    }
    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function note(text) { stageMsg.textContent = text || ''; stageMsg.hidden = !text; }

    /* ---------------- drawing ---------------- */
    const pctx = canvas.getContext('2d');
    let dirty = true;
    const invalidate = () => { dirty = true; };
    function sizePreview() {
      const s = Math.min(1, PREVIEW_MAX / Math.max(S.W, S.H));
      canvas.width = Math.max(1, Math.round(S.W * s));
      canvas.height = Math.max(1, Math.round(S.H * s));
    }
    const scaleToWork = () => S.W / canvas.width;
    function draw() {
      if (!S.image) return;
      const W = canvas.width, H = canvas.height;
      pctx.save();
      pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high';
      pctx.clearRect(0, 0, W, H);
      pctx.drawImage(S.image, 0, 0, W, H);
      if (S.compare && S.original) {
        const sx = Math.round(S.split * W);
        pctx.save(); pctx.beginPath(); pctx.rect(0, 0, sx, H); pctx.clip();
        pctx.drawImage(S.original, 0, 0, W, H);
        pctx.restore();
        pctx.fillStyle = 'rgba(0,0,0,.45)'; pctx.fillRect(sx - 2, 0, 4, H);
        pctx.fillStyle = '#fff'; pctx.fillRect(sx - 1, 0, 2, H);
        pctx.beginPath(); pctx.arc(sx, H / 2, 14, 0, Math.PI * 2); pctx.fillStyle = '#fff'; pctx.fill();
        pctx.fillStyle = '#111'; pctx.font = '700 12px Inter, system-ui, sans-serif'; pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
        pctx.fillText('◂▸', sx, H / 2 + 1);
        pctx.font = '600 11px Inter, system-ui, sans-serif';
        pctx.fillStyle = 'rgba(0,0,0,.55)'; pctx.fillRect(8, 8, 52, 18); pctx.fillRect(W - 50, 8, 42, 18);
        pctx.fillStyle = '#fff'; pctx.textAlign = 'left'; pctx.fillText('BEFORE', 13, 17); pctx.textAlign = 'right'; pctx.fillText('AFTER', W - 13, 17);
      }
      if (S.ovCanvas && !S.exporting) pctx.drawImage(S.ovCanvas, 0, 0, W, H);
      if (S.hover && !S.exporting && !S.job) {
        const r = S.brush.size / 2 / scaleToWork();
        pctx.beginPath(); pctx.arc(S.hover.x, S.hover.y, r, 0, Math.PI * 2);
        pctx.lineWidth = 1.5; pctx.strokeStyle = S.brush.mode === 'add' ? 'rgba(255,255,255,.95)' : 'rgba(255,220,80,.95)'; pctx.stroke();
        pctx.beginPath(); pctx.arc(S.hover.x, S.hover.y, r + 1.5, 0, Math.PI * 2);
        pctx.lineWidth = 1; pctx.strokeStyle = 'rgba(0,0,0,.6)'; pctx.stroke();
      }
      pctx.restore();
      dirty = false;
    }
    let mounted = true;
    (function loop() { if (!mounted) return; if (dirty) draw(); requestAnimationFrame(loop); })();

    /* ---------------- the mask and its overlay ---------------- */
    function resetMask() {
      S.mask = new Uint8Array(S.W * S.H);
      S.overlay = new ImageData(S.W, S.H);
      S.ovCanvas = el('canvas'); S.ovCanvas.width = S.W; S.ovCanvas.height = S.H;
      S.undo = []; S.redo = [];
    }
    /** Repaint the overlay from the mask, whole or within a rect. */
    function syncOverlay(x0, y0, x1, y1) {
      if (!S.overlay) return;
      const W = S.W, d = S.overlay.data, M = S.mask;
      if (x0 === undefined) { x0 = 0; y0 = 0; x1 = W - 1; y1 = S.H - 1; }
      for (let y = y0; y <= y1; y++) {
        for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
          const j = i * 4;
          d[j] = TINT[0]; d[j + 1] = TINT[1]; d[j + 2] = TINT[2]; d[j + 3] = (M[i] * 0.55) | 0;
        }
      }
      S.ovCanvas.getContext('2d').putImageData(S.overlay, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      invalidate();
    }
    function clearMask() { if (!S.mask) return; S.mask.fill(0); syncOverlay(); }
    function pushUndo() {
      S.undo.push(new Uint8Array(S.mask));
      if (S.undo.length > 12) S.undo.shift();
      S.redo = [];
      syncButtons();
    }
    function selectionArea() { let n = 0; const M = S.mask; for (let i = 0; i < M.length; i++) if (M[i] > HOLE_MIN) n++; return n / M.length; }

    /* ---------------- brush ---------------- */
    let stroke = null;
    const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * canvas.width, y: (e.clientY - r.top) / r.height * canvas.height }; };
    function paintDisc(px, py) {
      const s = scaleToWork();
      const cx = px * s, cy = py * s, r = Math.max(1.5, S.brush.size / 2);
      const W = S.W, H = S.H, M = S.mask, add = S.brush.mode === 'add';
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - cx, y - cy) / r;
          if (d >= 1) continue;
          const v = Math.round((d < 0.72 ? 1 : (1 - d) / 0.28) * 255);
          const i = y * W + x;
          M[i] = add ? Math.max(M[i], v) : Math.min(M[i], 255 - v);
        }
      }
      if (!stroke.rect) stroke.rect = [x0, y0, x1, y1];
      else { const q = stroke.rect; q[0] = Math.min(q[0], x0); q[1] = Math.min(q[1], y0); q[2] = Math.max(q[2], x1); q[3] = Math.max(q[3], y1); }
    }
    function paintLine(a, b) {
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const step = Math.max(1.5, S.brush.size / scaleToWork() / 5);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i <= n; i++) paintDisc(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n);
    }
    function flushStroke() {
      if (!stroke || !stroke.rect) return;
      const q = stroke.rect;
      syncOverlay(q[0], q[1], q[2], q[3]);
      stroke.rect = null;
    }
    const nearDivider = (p) => S.compare && Math.abs(p.x - S.split * canvas.width) <= 14;
    canvas.addEventListener('pointerdown', (e) => {
      if (!S.image || S.job || S.exporting) return;
      const p = toCanvas(e);
      if (nearDivider(p)) { stroke = { divider: true }; canvas.setPointerCapture(e.pointerId); e.preventDefault(); return; }
      pushUndo();
      stroke = { last: p, rect: null };
      paintDisc(p.x, p.y);
      flushStroke();
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = toCanvas(e);
      S.hover = p;
      if (stroke && stroke.divider) { S.split = clamp(p.x / canvas.width, 0, 1); invalidate(); return; }
      if (stroke) { paintLine(stroke.last, p); stroke.last = p; flushStroke(); return; }
      canvas.style.cursor = nearDivider(p) ? 'ew-resize' : '';
      invalidate();
    });
    const endStroke = () => { if (!stroke) return; flushStroke(); stroke = null; syncButtons(); };
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);
    canvas.addEventListener('pointerleave', () => { S.hover = null; invalidate(); });
    canvas.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (e.key === '[') { e.preventDefault(); brushSize.set(clamp(S.brush.size - 6, 6, 160)); S.brush.size = Number(brushSize.input.value); invalidate(); }
      else if (e.key === ']') { e.preventDefault(); brushSize.set(clamp(S.brush.size + 6, 6, 160)); S.brush.size = Number(brushSize.input.value); invalidate(); }
      else if (e.key.toLowerCase() === 'x') { e.preventDefault(); setMode(S.brush.mode === 'add' ? 'erase' : 'add'); }
    });
    function undo() { if (!S.undo.length) return; S.redo.push(new Uint8Array(S.mask)); S.mask = S.undo.pop(); syncOverlay(); syncButtons(); }
    function redo() { if (!S.redo.length) return; S.undo.push(new Uint8Array(S.mask)); S.mask = S.redo.pop(); syncOverlay(); syncButtons(); }

    /* ---------------- remove pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const stat = el('p', 'aiimg-era-stat', ''); stat.hidden = true;
    const h = (t) => el('p', 'aiimg-h', t);

    const taps = el('div', 'aiimg-era-taps');
    const peopleBtn = button('Remove all people', 'btn-primary aiimg-era-people', () => removeLayers((l) => l.label === 'person', 'people'));
    peopleBtn.disabled = true;
    const chips = el('div', 'aiimg-era-taps');
    taps.append(peopleBtn);
    const growCtl = on(range('aiimg-era-grow', 0, 8, 0.5, S.grow, (v) => v.toFixed(1) + '%'), () => { S.grow = Number(growCtl.input.value); });
    const shadowChk = on(check('aiimg-era-shadows', 'Include shadows (extend each selection downwards)', false), () => { S.shadows = shadowChk.input.checked; reachField.hidden = !S.shadows; });
    const reachCtl = on(range('aiimg-era-reach', 10, 200, 5, S.shadowReach, (v) => v + ' px'), () => { S.shadowReach = Number(reachCtl.input.value); });
    const reachField = field('Shadow reach', reachCtl, 'How far below each person or object the selection extends, at the working resolution.'); reachField.hidden = true;

    const legend = el('p', 'aiimg-era-legend'); legend.innerHTML = '<i></i> The red area is what will be filled.';
    const modeRow = el('div', 'aiimg-era-tools');
    const paintBtn = button('Paint', 'chip is-on', () => setMode('add'));
    const eraseBtn = button('Erase', 'chip', () => setMode('erase'));
    modeRow.append(paintBtn, eraseBtn);
    function setMode(m) { S.brush.mode = m; paintBtn.classList.toggle('is-on', m === 'add'); eraseBtn.classList.toggle('is-on', m === 'erase'); invalidate(); }
    const brushSize = on(range('aiimg-era-size', 6, 160, 2, S.brush.size, (v) => v + ' px'), () => { S.brush.size = Number(brushSize.input.value); invalidate(); });
    const undoBtn = button('Undo stroke', 'btn-ghost', undo);
    const redoBtn = button('Redo', 'btn-ghost', redo);
    const clearBtn = button('Clear selection', 'btn-ghost', () => { if (!S.mask) return; pushUndo(); clearMask(); syncButtons(); });
    const brushRow = el('div', 'aiimg-row'); brushRow.append(undoBtn, redoBtn, clearBtn);
    const refineChk = on(check('aiimg-era-refine', 'Refine large areas at full resolution (slower, sharper)', true), () => { S.refine = refineChk.input.checked; });
    const removeBtn = button('Remove the selection', 'btn-primary', () => remove());
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.hidden = true;
    const goRow = el('div', 'aiimg-row'); goRow.append(removeBtn, cancelBtn);

    const undoRemoveBtn = button('Undo last removal', 'btn-ghost', () => {
      if (!S.history.length) return;
      S.image = S.history.pop(); S.segStale = true; S.lastMask = null;
      status.textContent = 'Back one step — ready';
      syncButtons(); invalidate();
    });
    const resetBtn = button('Back to the original', 'btn-ghost', () => {
      if (!S.original) return;
      S.image = copyCanvas(S.original); S.history = []; S.segStale = true; S.lastMask = null;
      clearMask(); S.undo = []; S.redo = [];
      status.textContent = 'Back to the original photo — ready';
      syncButtons(); invalidate();
    });
    const afterRow = el('div', 'aiimg-row'); afterRow.append(undoRemoveBtn, resetBtn);

    panes.remove.append(status, progress, stat,
      h('One tap'), taps, chips,
      field('Grow each selection', growCtl, 'As a share of the picture’s long edge. A little beyond the edge covers hair, straps and the fringe the model missed.'),
      shadowChk, reachField,
      h('Brush'), legend, modeRow,
      field('Brush size', brushSize, 'In pixels of the working picture. Shortcuts: [ and ] change the size, X swaps paint and erase, Ctrl+Z undoes a stroke.'),
      brushRow, refineChk, goRow,
      h('After a removal'), afterRow);

    function syncButtons() {
      undoBtn.disabled = !S.undo.length; redoBtn.disabled = !S.redo.length;
      const has = !!(S.mask && S.mask.some((v) => v > HOLE_MIN));
      clearBtn.disabled = !has; removeBtn.disabled = !has || !!S.job;
      undoRemoveBtn.disabled = !S.history.length; resetBtn.disabled = !S.history.length && !(S.mask && has);
      resetBtn.disabled = !S.history.length;
      compareChk.input.disabled = !S.history.length;
      peopleBtn.disabled = !!S.job || !S.image;
      for (const b of chips.children) b.disabled = !!S.job;
    }
    function busy(v, label) {
      removeBtn.disabled = v; cancelBtn.hidden = !v; progress.hidden = !v; bar.style.width = '0%';
      change.disabled = v;
      if (v) note(label || 'Working…'); else note('');
      syncButtons();
    }
    const showProgress = (p) => {
      if (p.stage === 'download') {
        status.textContent = 'Downloading the inpainting model once' + (p.total ? ' — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) : '') + '. Your browser keeps it for next time.';
        bar.style.width = Math.round(p.fraction * 50) + '%';
      } else {
        if (p.text) { status.textContent = p.text; note(p.text); }
        bar.style.width = Math.round(50 + p.fraction * 50) + '%';
      }
    };

    /* ---------------- segmentation and one-tap selections ---------------- */
    const imgObj = () => ({ canvas: S.image, width: S.W, height: S.H });
    let segToken = 0;
    async function runSegmentation(quiet) {
      if (!S.image) return;
      const token = ++segToken;
      S.segBusy = true;
      if (!quiet) { progress.hidden = false; bar.style.width = '0%'; }
      try {
        const seg = await A.segment(imgObj(), { detail: 'standard', onProgress: (p) => {
          if (token !== segToken) return;
          if (p.stage === 'download') { status.textContent = 'Downloading the layer model once — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) + '. Your browser keeps it for next time.'; bar.style.width = Math.round(p.fraction * 60) + '%'; }
          else if (p.stage === 'run') { status.textContent = 'Finding people and objects on your device…'; bar.style.width = Math.round(60 + p.fraction * 40) + '%'; }
        } });
        if (token !== segToken) return;
        S.seg = seg; S.guide = null; S.segStale = false;
        renderChips();
        const subjects = seg.layers.filter((l) => l.subject && l.area >= 0.002);
        status.textContent = (S.openNote || '') + (subjects.length
          ? 'Found ' + subjects.slice(0, 5).map((l) => l.name + ' ' + pct(l.area)).join(', ') + (subjects.length > 5 ? '…' : '') + ' — ready'
          : 'No people or objects recognised; brush over what should go — ready');
      } catch (e) {
        if (token !== segToken) return;
        S.seg = null; renderChips();
        status.textContent = (S.openNote || '') + 'The one-tap buttons are unavailable (' + ((e && e.message) || e) + ') — the brush still works — ready';
      } finally {
        if (token === segToken) { S.segBusy = false; if (!S.job) progress.hidden = true; syncButtons(); }
      }
    }
    function renderChips() {
      chips.innerHTML = '';
      const people = S.seg ? S.seg.layers.find((l) => l.label === 'person') : null;
      peopleBtn.textContent = people ? 'Remove all people (' + pct(people.area) + ' of the frame)' : 'Remove all people' + (S.seg ? ' — none found' : '');
      peopleBtn.disabled = !S.image || !!S.job;
      if (!S.seg) return;
      for (const L of S.seg.layers) {
        if (!L.subject || L.label === 'person' || L.area < 0.002) continue;
        const b = button('Remove ' + L.name.toLowerCase() + ' · ' + pct(L.area), 'chip', () => removeLayers((x) => x.label === L.label, L.name.toLowerCase()));
        b.title = 'Select every ' + L.name.toLowerCase() + ' the model found and fill the gap';
        chips.appendChild(b);
      }
    }
    /** The soft, grown selection for every layer the test accepts, at working resolution. */
    function selectionFor(accept) {
      const { mw, mh, classMap, layers } = S.seg;
      const keys = new Set(layers.filter(accept).map((l) => l.key));
      if (!keys.size) return null;
      const bin = new Float32Array(mw * mh);
      let any = false;
      for (let i = 0; i < bin.length; i++) if (keys.has(classMap[i])) { bin[i] = 1; any = true; }
      if (!any) return null;
      if (!S.guide) S.guide = A.guideOf(imgObj(), mw, mh);
      const alpha = A.refine(bin, S.guide, { softness: 2, shift: 1 });
      let m = new Float32Array(alpha.length);
      for (let i = 0; i < m.length; i++) m[i] = alpha[i] > 0.35 ? 1 : 0;
      const scale = Math.max(mw, mh) / Math.max(S.W, S.H);
      const r = Math.round(S.grow / 100 * Math.max(mw, mh));
      if (r > 0) m = dilate(m, mw, mh, r, r, r, r);
      if (S.shadows) {
        const reach = Math.max(1, Math.round(S.shadowReach * scale));
        const side = Math.max(1, Math.round(reach / 3));
        m = dilate(m, mw, mh, side, side, 0, reach);
      }
      m = soften(m, mw, mh);
      const small = A.maskCanvas(m, mw, mh);
      const big = el('canvas'); big.width = S.W; big.height = S.H;
      const bx = big.getContext('2d', { willReadFrequently: true });
      bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
      bx.drawImage(small, 0, 0, S.W, S.H);
      const d = bx.getImageData(0, 0, S.W, S.H).data;
      const out = new Uint8Array(S.W * S.H);
      for (let i = 0, j = 3; i < out.length; i++, j += 4) out[i] = d[j];
      return out;
    }
    async function removeLayers(accept, what) {
      if (!S.image || S.job) return;
      if (!S.seg || S.segStale) {
        status.textContent = 'Looking at the picture again…';
        await runSegmentation();
        if (!S.seg) return;
      }
      const sel = selectionFor(accept);
      if (!sel) { say('No ' + what + ' were found in the picture. Brush over what should go instead.', 'warn'); return; }
      pushUndo();
      const M = S.mask;
      for (let i = 0; i < M.length; i++) if (sel[i] > M[i]) M[i] = sel[i];
      syncOverlay();
      await remove(what);
    }

    /* ---------------- the removal ---------------- */
    async function remove(what) {
      if (!S.image || S.job) return;
      const area = selectionArea();
      if (!area) { say('Nothing is selected yet. Brush over what should go, or use a one-tap button.', 'warn'); return; }
      say('');
      S.job = new AbortController();
      busy(true, 'Preparing…');
      status.textContent = 'Preparing the inpainting model…';
      const started = performance.now();
      const heap = () => { if (performance.memory) S.stats.heapPeak = Math.max(S.stats.heapPeak, performance.memory.usedJSHeapSize); };
      try {
        const sess = await session(showProgress);
        if (S.job.signal.aborted) throw abortError();
        if (area > 0.35) say('That is a large area — more than a third of the picture. Expect a soft result; two or three smaller removals usually look better.', 'note');
        heap();
        const r = await inpaint(S.image, S.mask, S.W, S.H, sess, { signal: S.job.signal, refine: S.refine, onProgress: showProgress, onTile: heap });
        heap();
        S.history.push(S.image);
        if (S.history.length > 4) S.history.shift();
        S.image = r.canvas;
        S.lastMask = S.mask;
        S.lastBox = r.box;
        resetMask();
        S.segStale = true;
        const secs = ((performance.now() - started) / 1000).toFixed(1);
        S.stats.runs.push(...r.ms);
        S.stats.last = { tiles: r.tiles, ms: r.ms.map(Math.round), mode: r.mode, seconds: Number(secs), area, window: r.win, heapPeak: S.stats.heapPeak };
        console.info('[object-remover] ' + r.mode + ': ' + r.tiles + ' run(s) of the network, ' + r.ms.map((v) => Math.round(v) + ' ms').join(', ') + '; ' + secs + ' s in all' + (performance.memory ? '; JS heap peak ' + fmtBytes(S.stats.heapPeak) : ''));
        stat.hidden = false;
        stat.textContent = (r.mode === 'single' ? 'One pass' : r.mode === 'coarse' ? 'Coarse pass only' : 'Coarse pass + ' + (r.tiles - 1) + ' tile' + (r.tiles === 2 ? '' : 's') + ' at full resolution') + ' · ' + secs + ' s · ' + Math.round(r.ms.reduce((a, b) => a + b, 0) / r.ms.length) + ' ms per run';
        status.textContent = 'Removed' + (what ? ' the ' + what : '') + ' in ' + secs + ' s — ready';
        if (!S.compare && S.history.length === 1) { /* first result: offer the comparison */ compareChk.input.disabled = false; }
      } catch (e) {
        if (e && e.name === 'AbortError') status.textContent = 'Cancelled — ready';
        else { status.textContent = 'The removal failed.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        S.job = null;
        busy(false);
        syncButtons();
        invalidate();
      }
    }

    /* ---------------- loading ---------------- */
    async function loadFiles(files) {
      const f = files && files[0]; if (!f) return;
      try {
        say(''); note('Reading the photo…');
        status.textContent = 'Reading the photo…';
        const img = await A.loadImageFile(f);
        const s = Math.min(1, WORK_MAX / Math.max(img.width, img.height));
        const work = s < 1 ? A.scaled(img.canvas, img.width * s, img.height * s) : img.canvas;
        segToken++;
        S.name = img.name; S.original = work; S.image = copyCanvas(work); S.W = work.width; S.H = work.height;
        S.history = []; S.seg = null; S.guide = null; S.segStale = false; S.lastMask = null; S.split = 0.5;
        S.compare = false; compareChk.input.checked = false; canvas.classList.remove('is-compare');
        resetMask();
        sizePreview();
        studio.hidden = false; drop.hidden = true;
        results.innerHTML = ''; chips.innerHTML = ''; stat.hidden = true;
        note('');
        const shrunk = img.sourceWidth > S.W || img.sourceHeight > S.H;
        S.openNote = shrunk ? 'Scaled down from ' + img.sourceWidth + '×' + img.sourceHeight + ' to work at ' + S.W + '×' + S.H + '. ' : '';
        status.textContent = (shrunk ? S.openNote : 'Photo opened at ' + S.W + '×' + S.H + '. ') + 'Finding people and objects…';
        syncButtons(); invalidate();
        showPane('remove');
        runSegmentation();
      } catch (e) {
        note('');
        say((e && e.message) || String(e), 'error');
      }
    }
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });

    /* ---------------- export pane ---------------- */
    const stillFmt = on(select('aiimg-era-still-fmt', [['image/png', 'PNG'], ['image/jpeg', 'JPEG']], 'image/png'), () => { qualityField.hidden = stillFmt.value === 'image/png'; });
    const quality = range('aiimg-era-quality', 50, 100, 1, 92, (v) => v + '%');
    const qualityField = field('Quality', quality); qualityField.hidden = true;
    const stillBtn = button('Download the picture', 'btn-primary', exportStill);
    const clipFmt = on(select('aiimg-era-clip-fmt', [['mp4', 'MP4 video (H.264)'], ['gif', 'Animated GIF']], 'mp4'), () => syncClipOptions());
    const clipSize = select('aiimg-era-clip-size', [], '1080');
    const clipBtn = button('Export the before-and-after clip', 'btn-primary', exportClip);
    const clipCancel = button('Cancel', 'btn-ghost', () => { if (S.clipJob) S.clipJob.abort(); }); clipCancel.hidden = true;
    const clipProgress = el('div', 'aiimg-progress'); const clipBar = el('i'); clipProgress.appendChild(clipBar); clipProgress.hidden = true;
    const clipStatus = el('p', 'aiimg-status aiimg-era-clipstatus', ''); clipStatus.hidden = true;
    const results = el('div', 'aiimg-results');
    const clipRow = el('div', 'aiimg-row'); clipRow.append(clipBtn, clipCancel);
    function fillSelect(sel, options, value) { sel.innerHTML = ''; for (const [v, l] of options) { const op = el('option', null, l); op.value = v; sel.appendChild(op); } sel.value = options.some((o) => String(o[0]) === String(value)) ? value : options[0][0]; }
    function syncClipOptions() {
      const gif = clipFmt.value === 'gif';
      fillSelect(clipSize, gif ? [['480', '480 px'], ['640', '640 px']] : [['720', '720 px'], ['1080', '1080 px (Full HD)']], gif ? '480' : '1080');
    }
    syncClipOptions();
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    panes.export.append(
      h('Still image'),
      grid(field('Format', stillFmt), qualityField),
      el('p', 'field-hint', 'Saved at the working resolution, with every removal so far.'),
      (() => { const r = el('div', 'aiimg-row'); r.append(stillBtn); return r; })(),
      h('Before-and-after clip'),
      grid(field('Format', clipFmt), field('Long edge', clipSize)),
      el('p', 'field-hint', 'A ' + CLIP_SECONDS + '-second wipe from the original to the result, encoded on your device. MP4 needs a browser with on-device video encoding (Chrome, Edge, Safari 16.4+); elsewhere the clip is recorded as WebM.'),
      clipRow, clipProgress, clipStatus, results
    );

    function addResult(blob, name, label, dims) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, name);
      const meta = el('span', null, fmtBytes(blob.size) + ' · ' + dims + (label ? ' · ' + label : ''));
      const dl = button('Download', 'btn-download', () => A.download(blob, name));
      head.append(strong, meta, dl);
      row.appendChild(head);
      const url = URL.createObjectURL(blob);
      if (/^image\//.test(blob.type)) { const img = el('img'); img.alt = 'Result preview'; img.src = url; row.appendChild(img); }
      else { const v = el('video'); v.controls = true; v.muted = true; v.loop = true; v.playsInline = true; v.src = url; row.appendChild(v); }
      results.insertBefore(row, results.firstChild);
      return row;
    }
    async function exportStill() {
      if (!S.image) return;
      try {
        S.exporting = true;
        const fmt = stillFmt.value;
        const blob = await A.exportStill((ctx, W, H) => { ctx.drawImage(S.image, 0, 0, W, H); }, { width: S.W, height: S.H, format: fmt, quality: Number(quality.input.value) / 100 });
        if (!blob) throw new Error('This browser could not encode that format. Try PNG.');
        const ext = fmt === 'image/png' ? 'png' : 'jpg';
        const name = S.name + '-removed.' + ext;
        addResult(blob, name, null, S.W + '×' + S.H);
        A.download(blob, name);
        say('');
      } catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { S.exporting = false; invalidate(); }
    }
    /** The wipe: the original, then the divider sweeps from right to left revealing the result. */
    function wipeFrame(ctx, W, H, t) {
      const p = t < 0.5 ? 0 : t > CLIP_SECONDS - 0.7 ? 1 : easeInOut((t - 0.5) / (CLIP_SECONDS - 1.2));
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(S.image, 0, 0, W, H);
      if (p < 1) {
        const sx = Math.round((1 - p) * W);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, H); ctx.clip();
        ctx.drawImage(S.original, 0, 0, W, H);
        ctx.restore();
        if (p > 0) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(sx - 2, 0, 4, H); ctx.fillStyle = '#fff'; ctx.fillRect(sx - 1, 0, 2, H); }
      }
    }
    async function exportClip() {
      if (!S.image || S.clipJob) return;
      if (!S.history.length) { say('Remove something first — the clip wipes from the original to the result.', 'warn'); return; }
      const gif = clipFmt.value === 'gif';
      const cap = Number(clipSize.value);
      const s = Math.min(1, cap / Math.max(S.W, S.H));
      const width = Math.max(2, Math.round(S.W * s)), height = Math.max(2, Math.round(S.H * s));
      const fps = gif ? 12 : 30;
      S.clipJob = new AbortController();
      S.exporting = true;
      clipBtn.disabled = true; clipCancel.hidden = false; clipProgress.hidden = false; clipStatus.hidden = false; clipBar.style.width = '0%';
      clipStatus.textContent = gif ? 'Encoding the GIF…' : 'Encoding the video…';
      const started = performance.now();
      const onProgress = (f) => {
        clipBar.style.width = Math.round(f * 100) + '%';
        const spent = (performance.now() - started) / 1000;
        clipStatus.textContent = (gif ? 'Encoding the GIF' : 'Encoding the video') + ' — ' + Math.round(f * 100) + '%' + (f > 0.05 && f < 1 ? ', about ' + Math.max(1, Math.round(spent / f - spent)) + ' s left' : '') + '.';
      };
      try {
        const o = { width, height, fps, duration: CLIP_SECONDS, onProgress, signal: S.clipJob.signal };
        let blob, ext, noteText;
        if (gif) { blob = await A.encodeGIF(wipeFrame, o); ext = 'gif'; }
        else { const r = await A.encodeVideo(wipeFrame, o); blob = r.blob; ext = r.ext; noteText = r.note; }
        const name = S.name + '-before-after.' + ext;
        addResult(blob, name, (gif ? 'GIF' : (ext === 'mp4' ? 'MP4' : 'WebM')) + ' · ' + CLIP_SECONDS + ' s · ' + fps + ' fps', width + '×' + height);
        A.download(blob, name);
        clipStatus.textContent = 'Done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s.';
        if (noteText && /WebM/.test(noteText)) say(noteText, 'warn'); else say('');
      } catch (e) {
        if (e && e.name === 'AbortError') clipStatus.textContent = 'Cancelled.';
        else { clipStatus.textContent = 'The export failed.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        S.clipJob = null; S.exporting = false;
        clipBtn.disabled = false; clipCancel.hidden = true; clipProgress.hidden = true;
        invalidate();
      }
    }

    /* ---------------- go ---------------- */
    showPane('remove');
    syncButtons();
    const api = { state: S, loadFiles, remove, removeLayers, inpaint, destroy: () => { mounted = false; } };
    root.aiimgEraser = api;
    return api;
  }

  A.tools['object-remover'] = { mount, inpaint, windowFor, axis };
})();
