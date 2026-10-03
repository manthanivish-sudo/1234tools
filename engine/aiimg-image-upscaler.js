/**
 * AI Image Upscaler.
 *
 * Real-ESRGAN general-x4v3 (SRVGGNetCompact, 1.2M parameters, BSD-3-Clause)
 * run on the device through ONNX Runtime's WebAssembly build. The picture
 * is cut into overlapping tiles; each is run through the network and
 * blended into one output canvas across the overlap, so memory stays flat
 * whatever the size of the result. 4× is the network's own output; 2× and
 * Unblur are that output reduced with a high-quality resample; Denoise
 * blends in the output of the "wdn" weights, trained on noisy input.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, button, sleep, fmtBytes } = A;

  const ORT_DIR = '/engine/vendor/ort/';
  const MODELS = {
    general: { url: '/engine/models/realesr-general-x4v3.onnx', bytes: 4868039 },
    wdn: { url: '/engine/models/realesr-general-x4v3-wdn.onnx', bytes: 4868039 }
  };
  const TILE = 160;      /* input pixels on a tile's side; four times that comes out */
  const OVERLAP = 16;    /* input pixels shared by neighbouring tiles, blended with a ramp */
  const OUT_MAX = 4000;  /* long edge of the output */
  const IN_MAX = 2000;   /* long edge the network is asked to look at */
  const SCALE = { x4: 4, x2: 2, unblur: 1 };
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const pct = (v) => Math.round(v) + '%';
  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };
  const fmtTime = (s) => s >= 90 ? Math.round(s / 60) + ' min' : s >= 60 ? '1 min ' + (s - 60) + ' s' : s + ' s';
  const thousands = (n) => Number(n).toLocaleString('en-GB');

  /* ------------------------------------------------------------------ */
  /* the runtime and the sessions                                       */
  /* ------------------------------------------------------------------ */
  let ortLib = null;
  function runtime() {
    if (A.runtime) return A.runtime();
    if (!ortLib) {
      ortLib = import(ORT_DIR + 'ort.wasm.min.mjs').then((m) => {
        const ort = m.default && m.default.InferenceSession ? m.default : m;
        ort.env.wasm.wasmPaths = ORT_DIR;
        ort.env.wasm.numThreads = 1;
        return ort;
      }).catch(() => {
        ortLib = null;
        throw new Error('The AI runtime could not be loaded. You may be offline — the first run needs the 14 MB runtime and the 4.7 MB model, after which both are cached.');
      });
    }
    return ortLib;
  }
  async function fetchBytes(url, expected, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('The model could not be downloaded (HTTP ' + res.status + ').');
    const total = Number(res.headers.get('content-length')) || expected;
    if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (onProgress) onProgress({ stage: 'download', fraction: Math.min(1, got / Math.max(total, got)), loaded: got, total: Math.max(total, got) });
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  const sessions = {};
  /** The loaded network, once per page — through the core's loader when it has one. */
  function session(key, onProgress) {
    if (sessions[key]) return sessions[key];
    const m = MODELS[key];
    sessions[key] = (async () => {
      if (A.loadSession) {
        const r = await A.loadSession(m.url, { bytes: m.bytes, onProgress });
        const s = r && r.session ? r.session : r;
        const ort = (r && r.ort) || await runtime();
        return { ort, session: s };
      }
      const ort = await runtime();
      const bytes = await fetchBytes(m.url, m.bytes, onProgress);
      const s = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      return { ort, session: s };
    })().catch((e) => { delete sessions[key]; throw e; });
    return sessions[key];
  }

  /* ------------------------------------------------------------------ */
  /* tiling                                                             */
  /* ------------------------------------------------------------------ */
  /* Tiles of one size per axis, spread evenly so every pair of neighbours
     shares at least OVERLAP pixels. One shape per run keeps the runtime's
     memory plan stable from tile to tile. */
  function axis(n, tile, overlap) {
    if (n <= tile) return { size: n, starts: [0] };
    const count = Math.ceil((n - overlap) / (tile - overlap));
    const size = Math.min(n, Math.ceil((n + (count - 1) * overlap) / count));
    const starts = [];
    for (let i = 0; i < count; i++) starts.push(Math.round(i * (n - size) / (count - 1)));
    return { size, starts };
  }
  function plan(w, h, tile, overlap) {
    const X = axis(w, tile, overlap), Y = axis(h, tile, overlap);
    const tiles = [];
    for (let j = 0; j < Y.starts.length; j++) {
      for (let i = 0; i < X.starts.length; i++) {
        tiles.push({ x: X.starts[i], y: Y.starts[j], w: X.size, h: Y.size, left: i > 0, top: j > 0 });
      }
    }
    return tiles;
  }

  /**
   * One tile: pixels in, the network, pixels out, blended into the output
   * canvas. Only this tile is ever held as floats; the result lives in the
   * canvas as bytes. Where the tile overlaps one already written, a linear
   * ramp across the overlap hands over from the old pixels to the new, so
   * each tile's border — the part the network saw with least context — is
   * the part that counts least.
   */
  async function upscaleTile(T, sctx, octx, f, ort, SA, SB, d) {
    const id = sctx.getImageData(T.x, T.y, T.w, T.h);
    const n = T.w * T.h, px = id.data;
    const inp = new Float32Array(3 * n);
    for (let i = 0, j = 0; i < n; i++, j += 4) { inp[i] = px[j] / 255; inp[n + i] = px[j + 1] / 255; inp[2 * n + i] = px[j + 2] / 255; }
    const tensor = new ort.Tensor('float32', inp, [1, 3, T.h, T.w]);
    let data = null;
    if (SA) data = (await SA.session.run({ image: tensor })).upscaled.data;
    if (SB) {
      const b = (await SB.session.run({ image: tensor })).upscaled.data;
      if (!data) data = b;
      else for (let i = 0; i < data.length; i++) data[i] += (b[i] - data[i]) * d;
    }
    const ow = T.w * 4, oh = T.h * 4, on = ow * oh;
    let img = new ImageData(ow, oh);
    const q = img.data;
    for (let i = 0, j = 0; i < on; i++, j += 4) { q[j] = data[i] * 255; q[j + 1] = data[on + i] * 255; q[j + 2] = data[2 * on + i] * 255; q[j + 3] = 255; }
    if (f !== 4) {
      const tmp = el('canvas'); tmp.width = ow; tmp.height = oh;
      tmp.getContext('2d').putImageData(img, 0, 0);
      img = A.scaled(tmp, T.w * f, T.h * f).getContext('2d').getImageData(0, 0, T.w * f, T.h * f);
    }
    const ox = T.x * f, oy = T.y * f, tw = T.w * f, th = T.h * f, ramp = OVERLAP * f;
    if (!T.left && !T.top) { octx.putImageData(img, ox, oy); return; }
    const old = octx.getImageData(ox, oy, tw, th);
    const od = old.data, nd = img.data;
    for (let y = 0; y < th; y++) {
      const wy = T.top && y < ramp ? (y + 0.5) / ramp : 1;
      for (let x = 0; x < tw; x++) {
        const wx = T.left && x < ramp ? (x + 0.5) / ramp : 1;
        const w = wx * wy;
        const o = (y * tw + x) * 4;
        if (w >= 1) { od[o] = nd[o]; od[o + 1] = nd[o + 1]; od[o + 2] = nd[o + 2]; }
        else { od[o] += (nd[o] - od[o]) * w; od[o + 1] += (nd[o + 1] - od[o + 1]) * w; od[o + 2] += (nd[o + 2] - od[o + 2]) * w; }
        od[o + 3] = 255;
      }
    }
    octx.putImageData(old, ox, oy);
  }

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = { image: null, mode: 'x4', denoise: 0, result: null, job: null, split: 0.5, zoom: 'fit' };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aiimg-up');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage aiimg-up-stage');
    const compare = el('div', 'aiimg-up-compare');
    const frame = el('div', 'aiimg-up-frame');
    const out = el('canvas', 'aiimg-up-after');
    out.setAttribute('aria-label', 'The result');
    const beforeWrap = el('div', 'aiimg-up-before'); beforeWrap.hidden = true;
    const tagB = el('span', 'aiimg-up-tag is-before', 'Before'); tagB.hidden = true;
    const tagA = el('span', 'aiimg-up-tag is-after', 'After'); tagA.hidden = true;
    const divider = el('div', 'aiimg-up-divider'); divider.hidden = true;
    const handle = el('button', 'aiimg-up-handle');
    handle.type = 'button'; handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', 'Before and after divider — drag, or use the arrow keys');
    handle.setAttribute('aria-valuemin', '0'); handle.setAttribute('aria-valuemax', '100');
    divider.appendChild(handle);
    frame.append(out, beforeWrap, tagB, tagA, divider);
    compare.appendChild(frame);
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(compare, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const zoomFit = button('Fit', 'chip is-on', () => setZoom('fit')); zoomFit.id = 'aiimg-up-zoom-fit'; zoomFit.setAttribute('aria-pressed', 'true');
    const zoomOne = button('1:1', 'chip', () => setZoom('one')); zoomOne.id = 'aiimg-up-zoom-one'; zoomOne.setAttribute('aria-pressed', 'false');
    const dims = el('span', 'aiimg-up-dims', '');
    const change = button('Change photo', 'btn-ghost', () => file.click());
    transport.append(zoomFit, zoomOne, dims, change);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['upscale', 'Upscale'], ['export', 'Export']]) {
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

    /* ---------------- the compare view ---------------- */
    function setSplit(v) {
      S.split = clamp(v, 0, 1);
      beforeWrap.style.clipPath = 'inset(0 ' + ((1 - S.split) * 100).toFixed(2) + '% 0 0)';
      divider.style.left = (S.split * 100).toFixed(2) + '%';
      handle.setAttribute('aria-valuenow', String(Math.round(S.split * 100)));
    }
    function fitWidth() {
      const ow = out.width, oh = out.height;
      if (!ow || !oh) return;
      if (S.zoom === 'one') { frame.style.width = ow + 'px'; return; }
      const cw = compare.clientWidth || ow;
      const maxH = Math.max(200, window.innerHeight * 0.78);
      frame.style.width = Math.max(1, Math.floor(Math.min(cw, ow, ow * maxH / oh))) + 'px';
    }
    function setZoom(z) {
      S.zoom = z;
      zoomFit.classList.toggle('is-on', z === 'fit'); zoomFit.setAttribute('aria-pressed', z === 'fit' ? 'true' : 'false');
      zoomOne.classList.toggle('is-on', z === 'one'); zoomOne.setAttribute('aria-pressed', z === 'one' ? 'true' : 'false');
      fitWidth();
      if (z === 'one') { compare.scrollLeft = Math.max(0, (frame.offsetWidth - compare.clientWidth) / 2); compare.scrollTop = Math.max(0, (frame.offsetHeight - compare.clientHeight) / 2); }
    }
    if (window.ResizeObserver) new ResizeObserver(() => fitWidth()).observe(compare);
    else window.addEventListener('resize', fitWidth);
    function showResult(onIt) {
      beforeWrap.hidden = !onIt; divider.hidden = !onIt; tagA.hidden = !onIt; tagB.hidden = !onIt;
      if (onIt) setSplit(S.split);
    }
    let drag = null;
    const splitAt = (clientX) => { const r = frame.getBoundingClientRect(); return r.width ? (clientX - r.left) / r.width : 0.5; };
    handle.addEventListener('pointerdown', (e) => { drag = true; handle.setPointerCapture(e.pointerId); e.preventDefault(); });
    handle.addEventListener('pointermove', (e) => { if (drag) setSplit(splitAt(e.clientX)); });
    const endDrag = () => { drag = null; };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.1 : 0.02;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setSplit(S.split - step);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setSplit(S.split + step);
      else if (e.key === 'Home') setSplit(0);
      else if (e.key === 'End') setSplit(1);
      else return;
      e.preventDefault();
    });
    frame.addEventListener('click', (e) => { if (!divider.hidden && e.target !== handle) setSplit(splitAt(e.clientX)); });

    /* ---------------- the upscale pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const modeSel = on(select('aiimg-up-mode', [['x4', '4× — four times the width and height'], ['x2', '2× — twice the size, cleaner'], ['unblur', 'Unblur — same size, sharper']], S.mode), () => { S.mode = modeSel.value; describe(); });
    const denoise = on(range('aiimg-up-denoise', 0, 100, 10, 0, pct), () => { S.denoise = Number(denoise.input.value) / 100; describe(); });
    const planLine = el('p', 'aiimg-up-plan', '');
    const runBtn = button('Upscale', 'btn-primary', run); runBtn.id = 'aiimg-up-run';
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.id = 'aiimg-up-cancel'; cancelBtn.hidden = true;
    const runRow = el('div', 'aiimg-row'); runRow.append(runBtn, cancelBtn);
    const info = el('p', 'field-hint aiimg-up-info', ''); info.hidden = true;
    panes.upscale.append(status, progress,
      field('What to do', modeSel, '4× is the network’s own output. 2× and Unblur run the same network and reduce the result, which is why they are cleaner than a plain resize.'),
      field('Denoise', denoise, '0 keeps every bit of texture. Raise it for a grainy or heavily compressed original: a second set of weights trained on noisy input is blended in, which doubles the time while both run.'),
      planLine, runRow, info);

    /** What a run would do with the current photo and settings. */
    function geometry() {
      const img = S.image; if (!img) return null;
      const f = SCALE[S.mode] || 4;
      const capIn = Math.min(IN_MAX, Math.floor(OUT_MAX / f));
      const long = Math.max(img.width, img.height);
      const s = Math.min(1, capIn / long);
      const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
      const tiles = plan(w, h, TILE, OVERLAP);
      return { f, w, h, ow: w * f, oh: h * f, reduced: s < 1, capIn, tiles };
    }
    function describe() {
      const G = geometry(); if (!G) return;
      const both = S.denoise > 0 && S.denoise < 1;
      planLine.textContent = thousands(S.image.width) + ' × ' + thousands(S.image.height) + ' → ' + thousands(G.ow) + ' × ' + thousands(G.oh) + ' px · ' +
        G.tiles.length + ' tile' + (G.tiles.length === 1 ? '' : 's') + (both ? ' × 2 models' : '') +
        (G.reduced ? '. The photo is reduced to ' + thousands(G.capIn) + ' px on the long edge first' + (G.f === 4 ? ', so the output stays within 4,000 px.' : ': the network’s work grows with the square of the size.') : '.');
    }

    async function run() {
      if (!S.image || S.job) return;
      const G = geometry();
      S.job = new AbortController();
      const signal = S.job.signal;
      runBtn.disabled = true; cancelBtn.hidden = false; progress.hidden = false; bar.style.width = '0%'; info.hidden = true;
      modeSel.disabled = true; denoise.input.disabled = true;
      say('');
      const started = performance.now();
      const d = S.denoise;
      try {
        const onDl = (p) => {
          if (p.stage !== 'download') return;
          status.textContent = 'Downloading the model once — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) + '. Your browser keeps it for next time.';
          bar.style.width = Math.round(p.fraction * 8) + '%';
        };
        status.textContent = 'Preparing the AI model…'; note('Preparing the model…');
        const SA = d < 1 ? await session('general', onDl) : null;
        const SB = d > 0 ? await session('wdn', onDl) : null;
        if (signal.aborted) throw abortError();
        const ort = (SA || SB).ort;
        const src = G.reduced ? A.scaled(S.image.canvas, G.w, G.h) : S.image.canvas;
        const sctx = src.getContext('2d', { willReadFrequently: true });
        showResult(false);
        S.result = null;
        out.width = G.ow; out.height = G.oh;
        fitWidth();
        const octx = out.getContext('2d', { willReadFrequently: true });
        const times = [];
        let avg = 0;
        for (let k = 0; k < G.tiles.length; k++) {
          if (signal.aborted) throw abortError();
          const t0 = performance.now();
          await upscaleTile(G.tiles[k], sctx, octx, G.f, ort, SA, SB, d);
          times.push(performance.now() - t0);
          avg = times.reduce((a, b) => a + b, 0) / times.length;
          const left = Math.round(avg * (G.tiles.length - k - 1) / 1000);
          const txt = 'Tile ' + (k + 1) + ' of ' + G.tiles.length + (left > 0 ? ' — about ' + fmtTime(left) + ' left' : '');
          status.textContent = txt + '.'; note(txt);
          bar.style.width = Math.round(8 + 92 * (k + 1) / G.tiles.length) + '%';
          await sleep(0);
        }
        const seconds = (performance.now() - started) / 1000;
        S.result = { f: G.f, width: G.ow, height: G.oh, reduced: G.reduced, seconds, tiles: G.tiles.length, tileMs: times, denoise: d, mode: S.mode };
        console.log('[upscaler] ' + G.tiles.length + ' tiles of ' + G.tiles[0].w + '×' + G.tiles[0].h + ' in ' + seconds.toFixed(1) + ' s (first ' + Math.round(times[0]) + ' ms, average ' + Math.round(avg) + ' ms) → ' + G.ow + '×' + G.oh + (d ? ', denoise ' + Math.round(d * 100) + '%' : ''));
        status.textContent = (S.mode === 'unblur' ? 'Unblurred' : 'Upscaled ' + G.f + '×') + ' — ready';
        info.textContent = thousands(G.ow) + ' × ' + thousands(G.oh) + ' px in ' + (seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)) + ' s' +
          (G.reduced ? ', from the photo reduced to ' + thousands(G.capIn) + ' px' : '') + '. Drag the divider to compare; 1:1 shows the real pixels. Download it from the Export tab.';
        info.hidden = false;
        dims.textContent = thousands(G.ow) + ' × ' + thousands(G.oh) + ' px';
        showResult(true);
      } catch (e) {
        if (e && e.name === 'AbortError') status.textContent = 'Cancelled.';
        else { status.textContent = 'The upscale failed.'; say((e && e.message) || String(e), 'error'); }
        showOriginal();
      } finally {
        S.job = null;
        runBtn.disabled = false; cancelBtn.hidden = true; progress.hidden = true; note('');
        modeSel.disabled = false; denoise.input.disabled = false;
      }
    }

    /** The photo alone on the stage, before a run or after a cancelled one. */
    function showOriginal() {
      const img = S.image; if (!img) return;
      showResult(false);
      S.result = null;
      out.width = img.width; out.height = img.height;
      out.getContext('2d', { willReadFrequently: true }).drawImage(img.canvas, 0, 0);
      dims.textContent = thousands(img.width) + ' × ' + thousands(img.height) + ' px';
      fitWidth();
    }

    /* ---------------- loading ---------------- */
    async function loadFiles(files) {
      const f = files && files[0]; if (!f) return;
      if (S.job) S.job.abort();
      try {
        say(''); note('Reading the photo…');
        const img = await A.loadImageFile(f);
        S.image = img;
        beforeWrap.innerHTML = '';
        img.canvas.className = 'aiimg-up-src';
        img.canvas.setAttribute('aria-label', 'The original');
        beforeWrap.appendChild(img.canvas);
        studio.hidden = false; drop.hidden = true;
        results.innerHTML = '';
        info.hidden = true;
        setZoom('fit');
        showOriginal();
        status.textContent = 'Photo loaded. Choose 4×, 2× or Unblur and press Upscale.';
        if (img.sourceWidth > A.MAX_WORK || img.sourceHeight > A.MAX_WORK) say('The photo was reduced to ' + thousands(A.MAX_WORK) + ' px on its long edge to fit in memory.', 'note');
        describe();
        showPane('upscale');
        note('');
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

    /* ---------------- the export pane ---------------- */
    const fmt = on(select('aiimg-up-fmt', [['image/png', 'PNG — lossless'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP']], 'image/png'), () => { qualityField.hidden = fmt.value === 'image/png'; });
    const quality = range('aiimg-up-quality', 50, 100, 1, 92, pct);
    const qualityField = field('Quality', quality); qualityField.hidden = true;
    const dlBtn = button('Download the image', 'btn-primary', exportImage); dlBtn.id = 'aiimg-up-download';
    const dlRow = el('div', 'aiimg-row'); dlRow.append(dlBtn);
    const results = el('div', 'aiimg-results');
    const h = (t) => el('p', 'aiimg-h', t);
    panes.export.append(h('The result'), field('Format', fmt, 'PNG keeps every pixel the network produced; JPEG at 90 or above is a fifth of the size and fine for a listing or a message.'), qualityField, dlRow, results);

    function addResult(blob, name, label, dimsText) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, name);
      const meta = el('span', null, fmtBytes(blob.size) + ' · ' + dimsText + (label ? ' · ' + label : ''));
      const dl = button('Download', 'btn-download', () => A.download(blob, name));
      head.append(strong, meta, dl);
      row.appendChild(head);
      const img = el('img'); img.alt = 'Result preview'; img.src = URL.createObjectURL(blob);
      row.appendChild(img);
      results.insertBefore(row, results.firstChild);
      return row;
    }
    async function exportImage() {
      if (!S.image) return;
      if (!S.result) { say('Upscale the photo first — the Export tab saves the result.', 'warn'); showPane('upscale'); return; }
      try {
        dlBtn.disabled = true;
        const type = fmt.value;
        const blob = await new Promise((r) => out.toBlob(r, type, Number(quality.input.value) / 100));
        if (!blob) throw new Error('This browser could not encode that format. Try PNG.');
        const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
        const name = S.image.name + (S.result.mode === 'unblur' ? '-unblurred' : '-x' + S.result.f) + '.' + ext;
        addResult(blob, name, S.result.mode === 'unblur' ? 'unblurred' : S.result.f + '× upscaled', thousands(S.result.width) + '×' + thousands(S.result.height));
        A.download(blob, name);
        say('');
      } catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { dlBtn.disabled = false; }
    }

    /* ---------------- go ---------------- */
    setSplit(0.5);
    showPane('upscale');
    return { state: S, loadFiles, run, geometry };
  }

  A.tools['image-upscaler'] = { mount };
})();
