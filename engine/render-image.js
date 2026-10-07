/**
 * Image tool renderer.
 *
 * One pipeline for every image tool: files in -> decode -> canvas -> encode
 * -> download. Each spec contributes only its controls and a paint function,
 * so behaviour that matters everywhere — drag and drop, paste, folders,
 * previews, the before/after view, batch ZIP or folder saving, settings that
 * are remembered and shareable, error handling, memory cleanup — is written
 * once and fixed once.
 *
 * Encoding: the WebAssembly codecs Squoosh uses (MozJPEG, libwebp, libavif,
 * oxipng, and Lanczos3 resampling), vendored under engine/vendor/jsquash/
 * and run in a module worker (engine/img-codec-worker.mjs), each fetched from
 * this site the first time a job needs it. Where WebAssembly or module
 * workers are missing, the browser's own canvas encoder is used, and the
 * page says so. Names, extensions and figures always follow the bytes that
 * were produced, never the format that was asked for.
 *
 * Nothing is uploaded. Every operation runs on this device.
 */
(function () {
  'use strict';
  window.MVRTool = window.MVRTool || {};

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const fmtBytes = (n) => n < 1024 ? n + ' B'
    : n < 1048576 ? (n / 1024).toFixed(1) + ' KB'
    : (n / 1048576).toFixed(2) + ' MB';

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------- the WebAssembly codecs: one module worker per page ---------- */
  const WORKER_URL = '/engine/img-codec-worker.mjs';
  const Codecs = (function () {
    let w = null, seq = 0, failed = '';
    const pending = new Map();
    const usable = () => !failed && typeof WebAssembly === 'object' && typeof Worker === 'function';
    function fail(reason) {
      failed = failed || reason;
      for (const [, p] of pending) p.reject(Object.assign(new Error(reason), { codecFailure: true }));
      pending.clear();
      if (w) { try { w.terminate(); } catch (e) { /* gone */ } w = null; }
    }
    function worker() {
      if (w) return w;
      w = new Worker(WORKER_URL, { type: 'module' });
      w.onmessage = (ev) => {
        const d = ev.data || {};
        const p = pending.get(d.id);
        if (!p) return;
        if (d.progress) { if (p.onProgress) p.onProgress(d.progress); return; }
        pending.delete(d.id);
        if (d.ok) p.resolve(d);
        else {
          /* a codec that could not be fetched or compiled is a failure of the
             WebAssembly path as a whole; anything else is this one image's */
          const load = /import|fetch|load|compile|instantiate|WebAssembly|wasm/i.test(d.error || '');
          p.reject(Object.assign(new Error(d.error || 'the encoder failed'), { codecFailure: load }));
          if (load) fail(d.error);
        }
      };
      w.onerror = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        fail((e && e.message) || 'the encoder worker could not start');
      };
      return w;
    }
    function call(msg, transfer, onProgress) {
      if (!usable()) return Promise.reject(Object.assign(new Error(failed || 'WebAssembly is not available'), { codecFailure: true }));
      return new Promise((resolve, reject) => {
        const id = ++seq;
        msg.id = id;
        pending.set(id, { resolve, reject, onProgress });
        try { worker().postMessage(msg, transfer || []); }
        catch (e) { pending.delete(id); reject(Object.assign(e, { codecFailure: true })); }
      });
    }
    /* stop whatever is running: the next call starts a fresh worker */
    function cancel() {
      if (!w) return;
      for (const [, p] of pending) p.reject(Object.assign(new Error('cancelled'), { cancelled: true }));
      pending.clear();
      try { w.terminate(); } catch (e) { /* gone */ }
      w = null;
    }
    return { call, cancel, usable, failure: () => failed };
  })();
  window.MVRImageCodecs = Codecs;

  /* Whether this browser's canvas writes a format itself (Safari's does not
     write WebP; few write AVIF), asked once per format. */
  const writesCache = {};
  function canvasWrites(type) {
    if (!writesCache[type]) writesCache[type] = new Promise((res) => {
      try {
        const c = el('canvas'); c.width = 1; c.height = 1;
        c.toBlob((b) => res(!!b && b.type === type), type);
      } catch (e) { res(false); }
    });
    return writesCache[type];
  }

  /* ---------- colour management ----------
     Drawn the usual way, a photo with a colour profile (a phone's Display P3)
     is converted to sRGB as it is read: right for a file that will carry no
     profile. To keep the profile, the pixels must be read as they are stored
     instead, which createImageBitmap's colorSpaceConversion: 'none' does in
     the browsers that honour it. Whether this one does is tested once, on a
     1×1 PNG whose profile has a linear tone curve: read as stored, its grey
     is 128; converted, it is about 188. */
  function linearProfile() {
    const s15 = (v) => Math.round(v * 65536);
    const tags = [['wtpt', [0.9642, 1, 0.8249]], ['rXYZ', [0.4361, 0.2225, 0.0139]], ['gXYZ', [0.3851, 0.7169, 0.0971]],
      ['bXYZ', [0.1431, 0.0606, 0.7141]], ['rTRC', null], ['gTRC', null], ['bTRC', null]];
    const tableEnd = 128 + 4 + tags.length * 12;
    const xyzAt = (k) => tableEnd + k * 20;
    const curvAt = tableEnd + 4 * 20;
    const size = curvAt + 12;
    const b = new Uint8Array(size);
    const dv = new DataView(b.buffer);
    const put = (at, s) => { for (let i = 0; i < 4; i++) b[at + i] = s.charCodeAt(i); };
    dv.setUint32(0, size); dv.setUint32(8, 0x02100000);
    put(12, 'mntr'); put(16, 'RGB '); put(20, 'XYZ '); put(36, 'acsp');
    dv.setInt32(68, s15(0.9642)); dv.setInt32(72, s15(1)); dv.setInt32(76, s15(0.8249));
    dv.setUint32(128, tags.length);
    tags.forEach(([sig, xyz], k) => {
      const at = 132 + k * 12;
      put(at, sig);
      dv.setUint32(at + 4, xyz ? xyzAt(k) : curvAt);
      dv.setUint32(at + 8, xyz ? 20 : 12);
      if (xyz) { put(xyzAt(k), 'XYZ '); xyz.forEach((v, i) => dv.setInt32(xyzAt(k) + 8 + i * 4, s15(v))); }
    });
    put(curvAt, 'curv');                                    // no points: the identity curve, gamma 1.0
    return b;
  }
  let rawProbe = null;
  function readsRawPixels() {
    if (rawProbe) return rawProbe;
    rawProbe = (async () => {
      const CORE = window.MVRImage;
      if (!CORE || !CORE.zlibStored || typeof createImageBitmap !== 'function') return false;
      const chunk = (type, data) => {
        const c = new Uint8Array(12 + data.length);
        const dv = new DataView(c.buffer);
        dv.setUint32(0, data.length);
        for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
        c.set(data, 8);
        dv.setUint32(8 + data.length, CORE.crc32(c, 4, 8 + data.length));
        return c;
      };
      const ihdr = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
      const name = new TextEncoder().encode('linear\0\0');
      const iccp = new Uint8Array(name.length + 0);
      iccp.set(name);
      const prof = CORE.zlibStored(linearProfile());
      const iccChunk = new Uint8Array(iccp.length + prof.length); iccChunk.set(iccp); iccChunk.set(prof, iccp.length);
      const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('iCCP', iccChunk),
        chunk('IDAT', CORE.zlibStored(new Uint8Array([0, 128, 128, 128]))), chunk('IEND', new Uint8Array(0))];
      const blob = new Blob(parts, { type: 'image/png' });
      const read = async (conv) => {
        const bm = await createImageBitmap(blob, { colorSpaceConversion: conv });
        const c = el('canvas'); c.width = 1; c.height = 1;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(bm, 0, 0);
        if (bm.close) bm.close();
        return x.getImageData(0, 0, 1, 1).data[1];
      };
      try { return Math.abs((await read('none')) - 128) <= 3; } catch (e) { return false; }
    })();
    return rawProbe;
  }

  /* ---------- helpers handed to each spec's paint() ---------- */
  function makeHelpers(canvas, ctx, notes) {
    const h = {
      size(w, hh) {
        canvas.width = Math.max(1, Math.round(w));
        canvas.height = Math.max(1, Math.round(hh));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      },
      fill(colour) {
        ctx.save();
        ctx.fillStyle = colour;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      },
      fillOn(c, colour, w, hh) {
        c.save(); c.fillStyle = colour; c.fillRect(0, 0, w, hh); c.restore();
      },
      fit(img, maxW, maxH) {
        let w = img.naturalWidth, hh = img.naturalHeight;
        if (maxW && w > maxW) { hh = Math.round(hh * (maxW / w)); w = maxW; }
        if (maxH && hh > maxH) { w = Math.round(w * (maxH / hh)); hh = maxH; }
        return { w, h: hh };
      },
      roundRect(c, x, y, w, hh, r) {
        r = Math.min(r, w / 2, hh / 2);
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + hh, r);
        c.arcTo(x + w, y + hh, x, y + hh, r);
        c.arcTo(x, y + hh, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
      },
      scratch(w, hh) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w));
        c.height = Math.max(1, Math.round(hh));
        return { canvas: c, ctx: c.getContext('2d') };
      },
      /* The picture at exactly w×h, resampled with Lanczos3 (the worker) or,
         without WebAssembly, by halving steps on canvases, which keeps detail
         a single big drawImage step would alias away. Enlarging is noted, so
         the page can say so: nothing is ever scaled up silently. */
      resample: (img, w, hh, label) => resampleTo(img, w, hh, notes, label),
      /* the photo filters (engine/img-filters-core.mjs) over this canvas's pixels, in place */
      filters: (p) => filterCanvas(canvas, ctx, p),
      notes
    };
    return h;
  }

  /* Photo filters worked on the pixels, the same in every browser: in the
     codec worker where there is one, otherwise here on the page (the module
     is plain JavaScript, so it needs no WebAssembly). */
  async function filterCanvas(canvas, ctx, p) {
    const w = canvas.width, hh = canvas.height;
    const data = ctx.getImageData(0, 0, w, hh);
    let out = null;
    if (Codecs.usable()) {
      try {
        const r = await Codecs.call({ op: 'filters', rgba: data.data.buffer, width: w, height: hh, params: p }, [data.data.buffer]);
        out = new Uint8ClampedArray(r.rgba);
      } catch (e) {
        if (e && e.cancelled) throw e;
        out = null;
      }
    }
    if (!out) {
      const fresh = ctx.getImageData(0, 0, w, hh);
      const core = await import('/engine/img-filters-core.mjs');
      out = core.applyFilters(fresh.data, w, hh, p);
    }
    ctx.putImageData(new ImageData(out, w, hh), 0, 0);
  }

  const sizeOf = (img) => ({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
  function asSource(c) { c.naturalWidth = c.width; c.naturalHeight = c.height; return c; }
  function toCanvas(img) {
    const { w, h } = sizeOf(img);
    const c = el('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  }
  async function resampleTo(img, w, h, notes, label) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const from = sizeOf(img);
    if (w === from.w && h === from.h) return img;
    if ((w > from.w || h > from.h) && notes) notes.push({ enlarged: true, label: label || '', from: [from.w, from.h], to: [w, h] });
    if (Codecs.usable()) {
      try {
        const c = toCanvas(img);
        const data = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
        const r = await Codecs.call({ op: 'resize', rgba: data.buffer, width: c.width, height: c.height, toW: w, toH: h }, [data.buffer]);
        const out = el('canvas'); out.width = w; out.height = h;
        out.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(r.rgba), w, h), 0, 0);
        if (notes) notes.lanczos = true;
        return asSource(out);
      } catch (e) {
        if (e && e.cancelled) throw e;
        /* fall through to the canvas steps */
      }
    }
    if (notes) notes.steps = true;
    let cur = img, cw = from.w, ch = from.h;
    while (cw / 2 >= w && ch / 2 >= h) {
      const nw = Math.max(w, Math.round(cw / 2)), nh = Math.max(h, Math.round(ch / 2));
      const c = el('canvas'); c.width = nw; c.height = nh;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(cur, 0, 0, nw, nh);
      cur = c; cw = nw; ch = nh;
    }
    const out = el('canvas'); out.width = w; out.height = h;
    const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, w, h);
    return asSource(out);
  }

  /* ---------- control builder ---------- */
  function buildControl(c, idSuffix) {
    const wrap = el('div', 'field');
    const id = 'ic-' + c.key + (idSuffix || '');
    const label = el('label', null, c.label);
    label.setAttribute('for', id);
    wrap.appendChild(label);
    if (c.wide) wrap.classList.add('field-wide');

    let read, write;
    if (c.type === 'select') {
      const s = el('select', 'control');
      s.id = id; s.name = c.key;
      (c.options || []).forEach(o => {
        const opt = el('option', null, o.label);
        opt.value = o.value;
        if (String(o.value) === String(c.default)) opt.selected = true;
        s.appendChild(opt);
      });
      wrap.appendChild(s);
      read = () => s.value;
      write = (v) => { if ([...s.options].some(o => o.value === String(v))) { s.value = String(v); return true; } return false; };
    } else if (c.type === 'range') {
      const row = el('div', 'range-row');
      const r = el('input', 'control range');
      r.type = 'range'; r.id = id; r.name = c.key;
      r.min = c.min; r.max = c.max; r.step = c.step || 1; r.value = c.default;
      const out = el('span', 'range-val', String(c.default));
      r.addEventListener('input', () => { out.textContent = r.value; });
      row.appendChild(r); row.appendChild(out);
      wrap.appendChild(row);
      read = () => r.value;
      write = (v) => { const n = Number(v); if (!Number.isFinite(n)) return false; r.value = String(Math.max(c.min, Math.min(c.max, n))); out.textContent = r.value; return true; };
    } else if (c.type === 'color') {
      const row = el('div', 'colour-field');
      const sw = el('input', 'colour-swatch');
      sw.type = 'color'; sw.value = c.default;
      const hex = el('input', 'control colour-hex');
      hex.type = 'text'; hex.value = c.default; hex.spellcheck = false;
      hex.id = id; hex.name = c.key;                  // the label's for= points here
      sw.setAttribute('aria-label', c.label + ' (picker)');
      sw.addEventListener('input', () => {
        hex.value = sw.value;
        row.dispatchEvent(new Event('input', { bubbles: true }));
      });
      hex.addEventListener('input', () => {
        if (/^#[0-9a-f]{6}$/i.test(hex.value)) sw.value = hex.value;
      });
      row.appendChild(sw); row.appendChild(hex);
      wrap.appendChild(row);
      read = () => hex.value;
      write = (v) => { const s = String(v); const m = /^#?([0-9a-f]{6})$/i.exec(s); if (!m) return false; hex.value = '#' + m[1].toLowerCase(); sw.value = hex.value; return true; };
    } else if (c.type === 'presets') {
      const box = el('div', 'preset-list');
      const list = c.list || (window.MVRImage.SOCIAL_PRESETS || []);
      list.forEach((p, i) => {
        const lab = el('label', 'preset-item');
        const cb = el('input');
        cb.type = 'checkbox'; cb.value = String(i); cb.checked = c.default === 'all' || (Array.isArray(c.default) && c.default.indexOf(i) >= 0);
        lab.appendChild(cb);
        lab.appendChild(el('span', 'preset-name', `${p.group} · ${p.name}`));
        lab.appendChild(el('span', 'preset-dim', `${p.w}×${p.h}`));
        box.appendChild(lab);
      });
      wrap.appendChild(box);
      read = () => [...box.querySelectorAll('input:checked')].map(i => Number(i.value));
      write = (v) => {
        const want = Array.isArray(v) ? v.map(Number) : String(v).split('.').filter(Boolean).map(Number);
        box.querySelectorAll('input').forEach(i => { i.checked = want.indexOf(Number(i.value)) >= 0; });
        return true;
      };
    } else if (c.type === 'text') {
      const t = el('input', 'control');
      t.type = 'text'; t.id = id; t.name = c.key; t.value = c.default || '';
      if (c.placeholder) t.placeholder = c.placeholder;
      wrap.appendChild(t);
      read = () => t.value;
      write = (v) => { t.value = String(v); return true; };
    } else if (c.type === 'check') {
      wrap.className = 'field field-check';
      wrap.innerHTML = '';
      const cb = el('input');
      cb.type = 'checkbox'; cb.id = id; cb.name = c.key; cb.checked = c.default === true || c.default === 'yes';
      wrap.appendChild(cb);
      const l2 = el('label', null, c.label); l2.setAttribute('for', id);
      wrap.appendChild(l2);
      read = () => cb.checked ? 'yes' : 'no';
      write = (v) => { cb.checked = v === true || v === 'yes' || v === '1'; return true; };
    } else {
      const n = el('input', 'control');
      n.type = 'number'; n.id = id; n.name = c.key;
      n.inputMode = 'numeric';
      if (c.min !== undefined) n.min = c.min;
      if (c.max !== undefined) n.max = c.max;
      if (c.step !== undefined) n.step = c.step;
      n.value = c.default;
      wrap.appendChild(n);
      /* a number outside the control's own range is held to it, whether typed, remembered or sent in a link */
      const lo = c.min !== undefined ? Number(c.min) : -Infinity, hi = c.max !== undefined ? Number(c.max) : Infinity;
      read = () => { const x = Number(n.value); return n.value === '' || !Number.isFinite(x) ? n.value : String(Math.max(lo, Math.min(hi, x))); };
      write = (v) => { const x = Number(v); if (v === '' || !Number.isFinite(x)) return false; n.value = String(Math.max(lo, Math.min(hi, x))); return true; };
    }
    if (c.hint) wrap.appendChild(el('span', 'field-hint', c.hint));
    return { wrap, read, write, key: c.key, spec: c };
  }

  /* ---------- the before/after view ----------
     The slider pattern of the AI upscaler (aiimg-image-upscaler.js): the
     result fills the frame, the original sits over it clipped to the left
     of the divider. A side-by-side mode, zoom (fit, 100%, 200%) and pan by
     dragging or with the arrow keys. Sizes and the saving shown under it. */
  function makeCompare(opts) {
    const box = el('div', 'img-compare');
    const bar = el('div', 'img-compare-bar');
    const modeBtns = el('div', 'img-seg');
    modeBtns.setAttribute('role', 'group'); modeBtns.setAttribute('aria-label', 'View');
    const zoomBtns = el('div', 'img-seg');
    zoomBtns.setAttribute('role', 'group'); zoomBtns.setAttribute('aria-label', 'Zoom');
    const btn = (label, group, on) => {
      const b = el('button', 'img-seg-btn', label);
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', on);
      group.appendChild(b);
      return b;
    };
    const S = { mode: opts.sameShape ? 'slider' : 'side', zoom: 'fit', split: 0.5 };
    const bSlider = btn('Slider', modeBtns, () => setMode('slider'));
    const bSide = btn('Side by side', modeBtns, () => setMode('side'));
    const bFit = btn('Fit', zoomBtns, () => setZoom('fit'));
    const b100 = btn('100%', zoomBtns, () => setZoom(1));
    const b200 = btn('200%', zoomBtns, () => setZoom(2));
    if (!opts.sameShape) { bSlider.disabled = true; bSlider.title = 'The result is a different shape from the original, so they are shown side by side'; }
    bar.appendChild(modeBtns); bar.appendChild(zoomBtns);
    box.appendChild(bar);

    const view = el('div', 'img-compare-view');
    view.tabIndex = 0;
    view.setAttribute('aria-label', 'Before and after. When zoomed, drag or use the arrow keys to look around.');
    const frame = el('div', 'img-compare-frame');
    const after = el('img', 'image-preview img-compare-after');
    after.src = opts.afterUrl; after.alt = 'After: ' + (opts.afterLabel || 'the result');
    after.draggable = false;
    const beforeWrap = el('div', 'img-compare-before');
    const before = el('img', 'img-compare-img');
    before.src = opts.beforeUrl; before.alt = 'Before: the original'; before.draggable = false;
    beforeWrap.appendChild(before);
    const divider = el('div', 'img-compare-divider');
    const handle = el('div', 'img-compare-handle');
    handle.tabIndex = 0;
    handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-label', 'Before and after divider');
    handle.setAttribute('aria-valuemin', '0'); handle.setAttribute('aria-valuemax', '100');
    divider.appendChild(handle);
    const tagA = el('span', 'img-compare-tag is-before', 'Before');
    const tagB = el('span', 'img-compare-tag is-after', 'After');
    frame.appendChild(after); frame.appendChild(beforeWrap); frame.appendChild(divider);
    frame.appendChild(tagA); frame.appendChild(tagB);
    view.appendChild(frame);

    /* side by side: two panes that scroll together */
    const side = el('div', 'img-compare-side');
    const paneA = el('div', 'img-compare-pane'), paneB = el('div', 'img-compare-pane');
    const sideA = el('img', 'img-compare-img'); sideA.src = opts.beforeUrl; sideA.alt = 'Before: the original'; sideA.draggable = false;
    const sideB = el('img', 'img-compare-img'); sideB.src = opts.afterUrl; sideB.alt = 'After'; sideB.draggable = false;
    paneA.appendChild(sideA); paneA.appendChild(el('span', 'img-compare-tag is-before', 'Before'));
    paneB.appendChild(sideB); paneB.appendChild(el('span', 'img-compare-tag is-after', 'After'));
    paneA.tabIndex = 0; paneB.tabIndex = 0;
    side.appendChild(paneA); side.appendChild(paneB);
    box.appendChild(view); box.appendChild(side);

    const readout = el('div', 'img-compare-readout');
    box.appendChild(readout);
    const setReadout = (r) => {
      readout.innerHTML = '';
      const add = (k, v, cls) => { const s = el('span', cls || ''); s.appendChild(el('span', 'img-compare-k', k + ' ')); s.appendChild(el('strong', null, v)); readout.appendChild(s); };
      add('Original', r.before);
      add('Result', r.after);
      if (r.change) add(r.saved ? 'Saved' : 'Grew', r.change, r.saved ? 'is-saved' : 'is-grew');
      if (r.extra) add(r.extra[0], r.extra[1]);
    };
    if (opts.readout) setReadout(opts.readout);

    function setSplit(v) {
      S.split = Math.max(0, Math.min(1, v));
      beforeWrap.style.clipPath = 'inset(0 ' + ((1 - S.split) * 100).toFixed(2) + '% 0 0)';
      divider.style.left = (S.split * 100).toFixed(2) + '%';
      handle.setAttribute('aria-valuenow', String(Math.round(S.split * 100)));
    }
    function size() {
      const W = opts.width, H = opts.height;
      const z = S.zoom === 'fit' ? 0 : S.zoom;
      const dpr = 1;
      if (S.mode === 'slider') {
        if (!z) {
          const cw = view.clientWidth || W;
          const maxH = Math.max(220, Math.min(window.innerHeight * 0.7, 720));
          frame.style.width = Math.max(1, Math.floor(Math.min(cw, W, W * maxH / H))) + 'px';
        } else frame.style.width = Math.round(W * z / dpr) + 'px';
        view.classList.toggle('is-zoomed', !!z);
      } else {
        [sideA, sideB].forEach((im, k) => {
          const w = k ? W : (opts.beforeWidth || W);
          im.style.width = z ? Math.round(w * z) + 'px' : '';
        });
        side.classList.toggle('is-zoomed', !!z);
      }
    }
    function setMode(m) {
      if (m === 'slider' && !opts.sameShape) m = 'side';
      S.mode = m;
      view.hidden = m !== 'slider'; side.hidden = m !== 'side';
      bSlider.setAttribute('aria-pressed', m === 'slider' ? 'true' : 'false');
      bSide.setAttribute('aria-pressed', m === 'side' ? 'true' : 'false');
      size();
    }
    function setZoom(z) {
      S.zoom = z;
      [[bFit, 'fit'], [b100, 1], [b200, 2]].forEach(([b, v]) => b.setAttribute('aria-pressed', v === z ? 'true' : 'false'));
      size();
      if (z !== 'fit') {
        const sc = S.mode === 'slider' ? [view] : [paneA, paneB];
        sc.forEach(v => { v.scrollLeft = Math.max(0, (v.scrollWidth - v.clientWidth) / 2); v.scrollTop = Math.max(0, (v.scrollHeight - v.clientHeight) / 2); });
      }
    }
    const splitAt = (clientX) => { const r = frame.getBoundingClientRect(); return r.width ? (clientX - r.left) / r.width : 0.5; };
    let drag = null;
    handle.addEventListener('pointerdown', (e) => { drag = 'split'; handle.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); });
    handle.addEventListener('pointermove', (e) => { if (drag === 'split') setSplit(splitAt(e.clientX)); });
    const endDrag = () => { drag = null; view.classList.remove('is-panning'); };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.1 : 0.02;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setSplit(S.split - step);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setSplit(S.split + step);
      else if (e.key === 'Home') setSplit(0);
      else if (e.key === 'End') setSplit(1);
      else return;
      e.preventDefault(); e.stopPropagation();
    });
    /* pan: drag the picture when zoomed; a click without a drag moves the divider */
    let pan = null;
    view.addEventListener('pointerdown', (e) => {
      if (e.target === handle) return;
      pan = { x: e.clientX, y: e.clientY, l: view.scrollLeft, t: view.scrollTop, moved: false };
      view.setPointerCapture(e.pointerId);
    });
    view.addEventListener('pointermove', (e) => {
      if (!pan) return;
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { pan.moved = true; view.classList.add('is-panning'); }
      if (pan.moved && S.zoom !== 'fit') { view.scrollLeft = pan.l - dx; view.scrollTop = pan.t - dy; }
      else if (pan.moved && S.zoom === 'fit') setSplit(splitAt(e.clientX));
    });
    view.addEventListener('pointerup', (e) => { if (pan && !pan.moved) setSplit(splitAt(e.clientX)); pan = null; endDrag(); });
    view.addEventListener('pointercancel', () => { pan = null; endDrag(); });
    const keyPan = (v) => (e) => {
      if (e.target === handle) return;
      const step = e.shiftKey ? 200 : 40;
      if (e.key === 'ArrowLeft') v.scrollLeft -= step;
      else if (e.key === 'ArrowRight') v.scrollLeft += step;
      else if (e.key === 'ArrowUp') v.scrollTop -= step;
      else if (e.key === 'ArrowDown') v.scrollTop += step;
      else if (e.key === '+' || e.key === '=') setZoom(S.zoom === 'fit' ? 1 : 2);
      else if (e.key === '-') setZoom(S.zoom === 2 ? 1 : 'fit');
      else return;
      e.preventDefault();
    };
    view.addEventListener('keydown', keyPan(view));
    /* side by side: both panes scroll together */
    let syncing = false;
    const sync = (from, to) => from.addEventListener('scroll', () => { if (syncing) return; syncing = true; to.scrollLeft = from.scrollLeft; to.scrollTop = from.scrollTop; syncing = false; });
    sync(paneA, paneB); sync(paneB, paneA);
    paneA.addEventListener('keydown', keyPan(paneA)); paneB.addEventListener('keydown', keyPan(paneB));
    [paneA, paneB].forEach((pn) => {
      let pp = null;
      pn.addEventListener('pointerdown', (e) => { pp = { x: e.clientX, y: e.clientY, l: pn.scrollLeft, t: pn.scrollTop }; pn.setPointerCapture(e.pointerId); });
      pn.addEventListener('pointermove', (e) => { if (pp && S.zoom !== 'fit') { pn.scrollLeft = pp.l - (e.clientX - pp.x); pn.scrollTop = pp.t - (e.clientY - pp.y); } });
      pn.addEventListener('pointerup', () => { pp = null; });
      pn.addEventListener('pointercancel', () => { pp = null; });
    });

    if (window.ResizeObserver) { const ro = new ResizeObserver(() => size()); ro.observe(view); box._ro = ro; }
    setSplit(0.5);
    setMode(S.mode);
    setZoom('fit');
    box.setReadout = setReadout;
    box.state = S;
    return box;
  }

  /* ---------- settings: remembered on the device, shareable by link ---------- */
  const SHORT_FORMAT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/gif': 'gif', same: 'same' };
  const LONG_FORMAT = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon', gif: 'image/gif', same: 'same' };
  const ALIASES = { q: 'quality', f: 'format', to: 'format' };

  /* ---------- main mount ---------- */
  window.MVRTool.mountImage = function (spec, root) {
    /* i18n hook: a translated twin of this page (build-tools-hi.js) loads engine/i18n.js; English pages do not, so this is a no-op there */
    if (window.MVR_I18N) window.MVR_I18N.watch(root);
    const io = root.querySelector('.tool-io');
    const CORE = window.MVRImage;
    const STORE_KEY = '1234tools-img-' + (spec.id || 'tool') + '-v1';

    /* file input */
    const acceptsAny = !!spec.readsUndecodable;
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0;
    drop.setAttribute('role', 'button');
    const dropText = () => '<strong>' + (spec.multiple ? 'Choose images' : 'Choose an image') +
      '</strong><span>or drag ' + (spec.multiple ? 'them (or a folder)' : 'it') + ' here, or paste with Ctrl+V — nothing is uploaded</span>';
    drop.innerHTML = dropText();
    const file = el('input', 'visually-hidden');
    file.type = 'file';
    file.accept = spec.accept || (spec.kind === 'text' ? '.svg,image/svg+xml' : 'image/*');
    if (spec.multiple) file.multiple = true;
    drop.appendChild(file);

    const fileList = el('div', 'file-list');
    const presetBar = el('div', 'img-presets');
    const opts = el('div', 'opt-bar');
    const readers = (spec.controls || []).map(c => {
      const b = buildControl(c);
      opts.appendChild(b.wrap);
      return b;
    });
    const settingsBar = el('div', 'img-settings-bar');

    const msg = el('div', 'io-msg');
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');
    const progressRow = el('div', 'img-progress');
    progressRow.hidden = true;
    const progressBar = el('progress', 'img-progress-bar');
    progressBar.max = 1; progressBar.value = 0;
    const progressText = el('span', 'img-progress-text');
    const cancelBtn = el('button', 'btn-ghost img-cancel', 'Cancel');
    cancelBtn.type = 'button';
    progressRow.appendChild(progressBar); progressRow.appendChild(progressText); progressRow.appendChild(cancelBtn);
    const stage = el('div', 'image-stage');
    const actions = el('div', 'io-actions image-actions');
    const stats = el('div', 'stat-grid');

    io.appendChild(drop);
    if (spec.presets && spec.presets.length) io.appendChild(presetBar);
    if (spec.controls && spec.controls.length) { io.appendChild(opts); io.appendChild(settingsBar); }
    io.appendChild(fileList);
    io.appendChild(msg);
    io.appendChild(progressRow);
    io.appendChild(stage);
    io.appendChild(actions);
    io.appendChild(stats);

    let sources = [];       // {file, img, bytes, url, over}
    let selection = null;   // {x,y,w,h} in source pixels
    let outputs = [];       // {name, blob}

    /* The message line: what the run says, then a sentence for each file
       left out (by name) and for a format the browser could not write.
       Files that could not be read stay listed until new files are chosen;
       the rest are worked out again on every run. */
    let said = { text: '', kind: '' };
    let loadNotes = [], runNotes = [];
    const paintMsg = () => {
      const notes = loadNotes.concat(runNotes);
      const kind = said.kind === 'error' ? 'error' : notes.length ? 'warn' : said.kind;
      msg.innerHTML = '';
      if (said.text) msg.appendChild(document.createTextNode(said.text));
      if (notes.length) {
        if (said.text) msg.appendChild(document.createTextNode(' '));
        const ul = el('ul', 'io-msg-list');
        notes.forEach((n, i) => { const li = el('li', null, n); ul.appendChild(li); if (i < notes.length - 1) ul.appendChild(document.createTextNode(' ')); });
        msg.appendChild(ul);
      }
      msg.className = 'io-msg' + (kind ? ' is-' + kind : '');
    };
    const say = (text, kind) => { said = { text: text || '', kind: kind || '' }; paintMsg(); };
    const problem = (text) => { if (runNotes.indexOf(text) < 0) runNotes.push(text); paintMsg(); };

    /* conditional controls: shown only when another control has one of the given values */
    const readOpts = () => {
      const o = {};
      readers.forEach(r => { o[r.key] = r.read(); });
      return o;
    };
    const showWhen = () => {
      const o = readOpts();
      readers.forEach(r => {
        const w = r.spec.when;
        if (!w) return;
        const ok = Object.keys(w).every(k => {
          const v = k === 'format' ? resolvedFormat(o) : o[k];
          return [].concat(w[k]).map(String).indexOf(String(v)) >= 0;
        });
        r.wrap.hidden = !ok;
      });
    };
    /* the format a run will ask for, before any file is chosen ("same" is
       the first file's own) */
    const resolvedFormat = (o) => {
      const f = o.format || spec.outputFormat || 'image/png';
      if (f !== 'same') return f;
      return sources[0] ? sameFormat(sources[0]) : 'image/jpeg';
    };

    /* ---- settings: device memory, link, reset ---- */
    const defaults = {};
    readers.forEach(r => { defaults[r.key] = r.read(); });
    function applyValues(vals, from) {
      let n = 0;
      readers.forEach(r => {
        if (!(r.key in vals)) return;
        let v = vals[r.key];
        if (r.key === 'format' || r.spec.formatLike) v = LONG_FORMAT[String(v).toLowerCase()] || v;
        if (r.write(v)) n++;
      });
      return n;
    }
    function storedValues() {
      try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; }
    }
    let saveTimer = 0;
    function remember() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const o = readOpts(), keep = {};
        Object.keys(o).forEach(k => { if (JSON.stringify(o[k]) !== JSON.stringify(defaults[k]) && !(spec.controls.find(c => c.key === k) || {}).noRemember) keep[k] = o[k]; });
        try {
          if (Object.keys(keep).length) localStorage.setItem(STORE_KEY, JSON.stringify(keep));
          else localStorage.removeItem(STORE_KEY);
        } catch (e) { /* storage off: settings last for this visit only */ }
      }, 250);
    }
    const urlValues = () => {
      const out = {};
      const q = new URLSearchParams(location.search);
      q.forEach((v, k) => {
        const key = ALIASES[k] || k;
        if (!readers.some(r => r.key === key)) return;
        out[key] = key === 'presets' ? v.split('.').filter(Boolean).map(Number) : v;
      });
      return out;
    };
    function settingsLink() {
      const o = readOpts();
      const q = new URLSearchParams();
      Object.keys(o).forEach(k => {
        if (JSON.stringify(o[k]) === JSON.stringify(defaults[k])) return;
        const c = spec.controls.find(x => x.key === k) || {};
        if (c.noShare) return;
        const name = k === 'quality' ? 'q' : k === 'format' ? 'f' : k;
        const v = k === 'format' ? (SHORT_FORMAT[o[k]] || o[k]) : Array.isArray(o[k]) ? o[k].join('.') : o[k];
        q.set(name, v);
      });
      const s = q.toString();
      return location.origin + location.pathname + (s ? '?' + s : '');
    }
    if (readers.length) {
      const fromStore = storedValues();
      applyValues(fromStore, 'store');
      const fromUrl = urlValues();
      if (spec.fromUrl) spec.fromUrl(new URLSearchParams(location.search), fromUrl);
      applyValues(fromUrl, 'url');
      const link = el('button', 'btn-ghost img-link', 'Copy settings link');
      link.type = 'button';
      link.title = 'A link to this page with these settings. It never carries your image.';
      link.addEventListener('click', async () => {
        const url = settingsLink();
        try { await navigator.clipboard.writeText(url); link.textContent = 'Link copied'; }
        catch (e) { window.prompt(window.MVR_I18N ? window.MVR_I18N.t('Copy this link:') : 'Copy this link:', url); }
        setTimeout(() => { link.textContent = 'Copy settings link'; }, 1600);
      });
      const reset = el('button', 'btn-ghost img-reset', 'Reset settings');
      reset.type = 'button';
      reset.addEventListener('click', () => {
        applyValues(defaults);
        try { localStorage.removeItem(STORE_KEY); } catch (e) { /* none */ }
        showWhen();
        if (sources.length) run();
      });
      const note = el('span', 'img-settings-note', 'Settings are remembered on this device.');
      settingsBar.appendChild(note); settingsBar.appendChild(link); settingsBar.appendChild(reset);
      showWhen();
    }

    /* presets: buttons that set several controls at once */
    (spec.presets || []).forEach(p => {
      const b = el('button', 'btn-ghost img-preset', p.label);
      b.type = 'button';
      if (p.note) b.title = p.note;
      b.addEventListener('click', () => {
        applyValues(Object.assign({}, defaults, p.values));
        presetBar.querySelectorAll('.img-preset').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
        showWhen(); remember();
        say(p.note ? p.label + ': ' + p.note : '', 'note');
        if (sources.length) run();
      });
      b.setAttribute('aria-pressed', 'false');
      presetBar.appendChild(b);
    });
    if (spec.presets && spec.presets.length) presetBar.insertBefore(el('span', 'img-presets-label', 'Presets'), presetBar.firstChild);

    /* ---- loading ---- */
    const isImage = (f) => /^image\//.test(f.type) || /\.(svg|heic|heif|tiff?|avif|jxl|bmp|ico)$/i.test(f.name);
    function loadFiles(list, append) {
      const all = [...list];
      const files = all.filter(isImage);
      if (!files.length) { say('Those files are not images. Choose PNG, JPEG, WebP, GIF or SVG.', 'error'); return; }

      const adding = !!(append && spec.multiple && sources.length);
      if (!adding) {
        sources.forEach(s => { if (s.url) URL.revokeObjectURL(s.url); });
        sources = [];
        loadNotes = [];
      }
      selection = null;
      crop.rot = 0; crop.straighten = 0; crop.key = '';
      runNotes = [];
      const take = spec.multiple ? files : files.slice(0, 1);
      if (spec.multiple) all.filter(f => !isImage(f)).forEach(f => loadNotes.push(`${f.name} is not an image, so it was left out.`));
      say('Reading…', 'note');

      let pending = take.length;
      const got = [], failed = [];
      const done = () => {
        if (--pending) return;
        /* in the order they were chosen */
        take.forEach((f, i) => {
          if (failed[i]) loadNotes.push(failed[i] === 'heic'
            ? `${f.name} is a HEIC photo, which this browser cannot open. On an iPhone, Settings › Camera › Formats › Most Compatible saves JPEG; Safari on a Mac or iPhone opens HEIC, so this page can read it there.`
            : `${f.name} could not be read as an image, so it was left out.`);
          else if (got[i]) sources.push(got[i]);
        });
        afterLoad(adding);
      };

      take.forEach((f, idx) => {
        const reader = new FileReader();
        reader.onload = () => {
          const bytes = new Uint8Array(reader.result);
          const url = URL.createObjectURL(f);
          const img = new Image();
          img.onload = () => {
            got[idx] = { file: f, img, bytes, url, over: null };
            done();
          };
          img.onerror = () => {
            const kind = CORE && CORE.containerOf ? CORE.containerOf(bytes) : '';
            if (acceptsAny && kind) {                     // read for its metadata, though it cannot be shown
              got[idx] = { file: f, img: null, bytes, url, over: null, undecodable: kind };
            } else {
              URL.revokeObjectURL(url);
              failed[idx] = kind === 'heic' ? 'heic' : true;
            }
            done();
          };
          img.src = url;
        };
        reader.onerror = () => { failed[idx] = true; done(); };
        reader.readAsArrayBuffer(f);
      });
    }

    function afterLoad(adding) {
      /* when nothing could be read, "none of those" names them all */
      if (!sources.length) { loadNotes = loadNotes.map(n => n.replace(/, so it was left out\./, '.')); say('None of those files could be decoded.', 'error'); return; }
      say('');
      drop.innerHTML = '<strong>' + (sources.length === 1 ? sources[0].file.name : sources.length + ' images')
        + '</strong><span>click to choose ' + (spec.multiple ? 'different files' : 'another image') + '</span>';
      drop.appendChild(file);
      showWhen();
      renderFileList();
      run();
    }

    /* the folder a dropped directory holds, every image in it and below */
    async function filesFromDrop(dt) {
      const items = dt.items ? [...dt.items] : [];
      const entries = items.map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
      if (!entries.length || !entries.some(e => e.isDirectory)) return [...dt.files];
      const out = [];
      const walk = (entry) => new Promise((res) => {
        if (entry.isFile) entry.file((f) => { out.push(f); res(); }, () => res());
        else if (entry.isDirectory) {
          const rd = entry.createReader();
          const batch = () => rd.readEntries(async (list) => {
            if (!list.length) return res();
            for (const e of list) await walk(e);
            batch();
          }, () => res());
          batch();
        } else res();
      });
      for (const e of entries) await walk(e);
      out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      return out;
    }

    function renderFileList() {
      fileList.innerHTML = '';
      if (!sources.length || (!spec.multiple && sources.length < 2)) return;
      const head = el('div', 'file-list-head');
      head.appendChild(el('span', null, sources.length === 1 ? '1 image' : sources.length + ' images in the queue'));
      const clear = el('button', 'btn-ghost', 'Clear all');
      clear.type = 'button';
      clear.addEventListener('click', () => {
        sources.forEach(s => { if (s.url) URL.revokeObjectURL(s.url); });
        sources = []; loadNotes = []; runNotes = [];
        stage.innerHTML = ''; actions.innerHTML = ''; stats.innerHTML = ''; outputs = [];
        drop.innerHTML = dropText(); drop.appendChild(file);
        say(''); renderFileList();
      });
      /* the queue grows with "Add more" (or a paste); the drop area above starts again */
      const more = el('button', 'btn-ghost img-add', 'Add more');
      more.type = 'button';
      const moreIn = el('input', 'visually-hidden');
      moreIn.type = 'file'; moreIn.accept = file.accept; moreIn.multiple = true;
      moreIn.tabIndex = -1;
      moreIn.addEventListener('change', () => { if (moreIn.files.length) loadFiles(moreIn.files, true); });
      more.addEventListener('click', () => moreIn.click());
      head.appendChild(more); head.appendChild(moreIn);
      head.appendChild(clear);
      fileList.appendChild(head);
      if (sources.length < 2) return;
      sources.forEach((s, i) => {
        const row = el('div', 'file-row');
        row.appendChild(el('span', 'file-idx', String(i + 1)));
        row.appendChild(el('span', 'file-name', s.file.name));
        row.appendChild(el('span', 'file-meta',
          `${s.img.naturalWidth}×${s.img.naturalHeight} · ${fmtBytes(s.file.size)}`));
        if (spec.kind === 'binary' && !spec.orderUI) {
          const up = el('button', 'btn-ghost', '↑');
          up.type = 'button'; up.title = 'Move up';
          up.addEventListener('click', () => {
            if (i === 0) return;
            [sources[i - 1], sources[i]] = [sources[i], sources[i - 1]];
            renderFileList(); run();
          });
          row.appendChild(up);
        }
        if (spec.perFile && spec.perFile.length) {
          const own = el('button', 'btn-ghost img-own', s.over ? 'Own settings ✓' : 'Own settings');
          own.type = 'button';
          own.setAttribute('aria-expanded', 'false');
          own.title = 'Settings for this file only';
          const panel = el('div', 'opt-bar img-own-panel');
          panel.hidden = true;
          const subs = spec.perFile.map(k => {
            const c = spec.controls.find(x => x.key === k);
            if (!c) return null;
            const b = buildControl(Object.assign({}, c, { when: null }), '-f' + i);
            const cur = Object.assign({}, readOpts(), s.over || {});
            b.write(cur[k]);
            panel.appendChild(b.wrap);
            return b;
          }).filter(Boolean);
          const useAll = el('button', 'btn-ghost', 'Use the main settings');
          useAll.type = 'button';
          useAll.addEventListener('click', () => { s.over = null; renderFileList(); run(); });
          panel.appendChild(useAll);
          panel.addEventListener('input', (e) => { e.stopPropagation(); s.over = {}; subs.forEach(b => { s.over[b.key] = b.read(); }); own.textContent = 'Own settings ✓'; run(); });
          panel.addEventListener('change', (e) => e.stopPropagation());
          own.addEventListener('click', () => { panel.hidden = !panel.hidden; own.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true'); });
          row.appendChild(own);
          const rm = removeButton(i);
          row.appendChild(rm);
          fileList.appendChild(row);
          fileList.appendChild(panel);
          return;
        }
        row.appendChild(removeButton(i));
        fileList.appendChild(row);
      });
    }
    function removeButton(i) {
      const rm = el('button', 'btn-ghost', '×');
      rm.type = 'button'; rm.title = 'Remove';
      rm.setAttribute('aria-label', 'Remove ' + sources[i].file.name);
      rm.addEventListener('click', () => {
        if (sources[i].url) URL.revokeObjectURL(sources[i].url);
        sources.splice(i, 1);
        if (!sources.length) { stage.innerHTML = ''; actions.innerHTML = ''; }
        renderFileList(); if (sources.length) run();
      });
      return rm;
    }
    const optsFor = (s, o) => s && s.over ? Object.assign({}, o, s.over) : o;

    /* ---- encoding ---- */
    const FORMAT_NAMES = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/gif': 'GIF',
      'image/svg+xml': 'SVG', 'image/bmp': 'BMP', 'image/avif': 'AVIF', 'image/heic': 'HEIC', 'image/x-icon': 'ICO', 'image/tiff': 'TIFF' };
    const fmtName = (mime) => FORMAT_NAMES[mime] || String(mime || 'image').replace(/^image\//, '').toUpperCase();
    const typeOfBytes = (b, fallback) => (CORE && CORE.mimeOf ? CORE.mimeOf(b) : '') || fallback || 'application/octet-stream';
    const extOfType = (mime) => (CORE && CORE.extOf ? CORE.extOf(mime) : ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[mime] || 'png');
    /* "Keep original format": what each input is saved as. A GIF, BMP, ICO or
       SVG is saved as PNG (no browser writes GIF, and BMP would not shrink). */
    function sameFormat(s) {
      const t = (CORE && CORE.mimeOf && s.bytes ? CORE.mimeOf(s.bytes) : '') || s.file.type;
      if (t === 'image/jpeg' || t === 'image/webp' || t === 'image/avif' || t === 'image/png') return t;
      return 'image/png';
    }

    /* Safari and most phones stop a canvas at 16,777,216 pixels (4096×4096):
       past that, drawing does nothing and toBlob gives null. A result over
       that size is made only where this browser shows it can hold one that
       big (desktop browsers can), by drawing the far corner pixel of a canvas
       that size and reading it back. */
    const MAX_PIXELS = 16777216;
    let provenArea = MAX_PIXELS;
    function fitsCanvas(w, h) {
      if (w * h <= provenArea) return true;
      try {
        const c = el('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        let ok = false;
        if (x && c.width === w && c.height === h) {
          x.fillStyle = '#000000'; x.fillRect(w - 1, h - 1, 1, 1);
          ok = x.getImageData(w - 1, h - 1, 1, 1).data[3] === 255;
        }
        c.width = 1; c.height = 1;                    // let the memory go at once
        if (ok) provenArea = w * h;
        return ok;
      } catch (e) { return false; }
    }
    const LIMIT_WORDS = '16,777,216 pixels (4096×4096)';
    const dims = (w, h) => `${w}×${h}`;

    /* JPEG has no alpha channel, and canvas.toBlob turns transparent pixels
       black. Anything saved as JPEG is laid on white first, so a rounded
       border's corners or a transparent PNG come out white, not black. */
    function flattenFor(canvas, fmt, bg) {
      if (fmt !== 'image/jpeg') return canvas;
      const c = el('canvas');
      c.width = canvas.width; c.height = canvas.height;
      const x = c.getContext('2d');
      x.fillStyle = bg || '#ffffff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(canvas, 0, 0);
      return c;
    }
    const qualityOf = (o, dflt) => Math.max(0.1, Math.min(1, (Number(o.quality) || dflt) / 100));
    const keys = new Set((spec.controls || []).map(c => c.key));
    const WASM_FORMATS = { 'image/jpeg': 'jpeg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/png': 'png', 'image/gif': 'gif' };

    /* the options a codec gets, from whichever of these controls the tool has */
    function codecOpts(fmt, o, dfltQ) {
      const q = Math.round(Number(o.quality) || dfltQ);
      if (fmt === 'image/jpeg') return { quality: q, progressive: o.jpegProgressive !== 'no', subsample: o.jpegSubsample || 'auto' };
      if (fmt === 'image/webp') return { quality: q, lossless: o.webpMode === 'lossless', effort: o.webpEffort !== undefined ? Number(o.webpEffort) : 4 };
      if (fmt === 'image/avif') return { quality: o.avifQuality !== undefined ? Number(o.avifQuality) : Math.max(0, Math.min(100, q - 25)), speed: o.avifSpeed !== undefined ? Number(o.avifSpeed) : 7, lossless: o.avifLossless === 'yes' };
      if (fmt === 'image/png') return { level: o.pngLevel !== undefined ? Number(o.pngLevel) : 2, colours: o.pngColours && o.pngColours !== 'all' ? Number(o.pngColours) : 0, dither: o.pngDither !== 'no' };
      return {};
    }
    /* which encoder: the tool's choice where it has WebAssembly codecs; else
       the browser's, except for a format the browser cannot write */
    async function wantsWasm(fmt) {
      if (!WASM_FORMATS[fmt] || !Codecs.usable()) return false;
      if (spec.codecs === 'wasm' || fmt === 'image/gif') return true;
      if (fmt === 'image/avif') return true;
      if (fmt === 'image/webp') return !(await canvasWrites('image/webp'));
      return false;
    }
    let toldFallback = false;
    function fallbackNote(fmt) {
      if (toldFallback) return;
      toldFallback = true;
      const why = Codecs.failure();
      problem('The WebAssembly encoders ' + (why ? 'could not run here (' + why + ')' : 'are not available in this browser') + ', so its own encoder was used' + (fmt === 'image/avif' ? '' : '; files may be larger than with them') + '.');
    }

    /* Encode a finished canvas as fmt. The bytes that come back say what was
       really written: asked for WebP without the WebAssembly encoder, Safari
       writes PNG. Every name, extension and figure follows the bytes, and a
       swap is said on screen. A file that cannot be encoded is named in the
       message and skipped; the rest carry on. Returns { blob, type, info }. */
    async function encodeOut(canvas, fmt, o, name, extra) {
      extra = extra || {};
      const w = canvas.width, h = canvas.height;
      if (w * h > MAX_PIXELS && !fitsCanvas(w, h)) {
        problem(`${name}: the ${dims(w, h)} result is ${(w * h).toLocaleString('en-GB')} pixels, over the ${LIMIT_WORDS} this browser can draw, so it was skipped. Choose a smaller size.`);
        return null;
      }
      const flat = extra.opaque ? canvas : flattenFor(canvas, fmt, o.bg && fmt === 'image/jpeg' && spec.jpegBackground ? o.bg : null);
      let bytes = null, info = {};
      if (fmt === 'image/bmp') {
        const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
        bytes = CORE.encodeBMP(d, w, h, Number(o.dpi) || 96);
      } else if (fmt === 'image/x-icon') {
        bytes = await icoFrom(canvas);
        info.icoSizes = bytes.sizes;
        /* the icon is as big as its biggest frame, not as big as the picture it came from */
        info.width = info.height = Math.max.apply(null, bytes.sizes);
      } else if (fmt === 'image/gif' && !Codecs.usable()) {
        /* no worker: gifenc on this thread */
        const g = await import('/engine/vendor/gifenc.esm.js');
        const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
        let alpha = false;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 128) { alpha = true; break; }
        const pf = alpha ? 'rgba4444' : 'rgb565';
        const palette = g.quantize(d, 256, { format: pf, oneBitAlpha: alpha });
        const enc = g.GIFEncoder();
        const ti = alpha ? palette.findIndex(c => c[3] === 0) : -1;
        enc.writeFrame(g.applyPalette(d, palette, pf), w, h, { palette, transparent: ti >= 0, transparentIndex: Math.max(0, ti) });
        enc.finish();
        bytes = enc.bytes();
      } else {
        const target = extra.targetBytes || 0;
        if (await wantsWasm(fmt)) {
          try {
            const d = flat.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
            if (target) {
              const r = await Codecs.call({ op: 'target', format: WASM_FORMATS[fmt], rgba: d.buffer, width: w, height: h, opts: codecOpts(fmt, o, 90), maxBytes: target },
                [d.buffer], (s) => { if (extra.onStep) extra.onStep(s); });
              bytes = new Uint8Array(r.bytes);
              info = { quality: r.quality, colours: r.colours, width: r.width, height: r.height, tries: r.tries.length, missed: r.missed, wasm: true };
            } else {
              const r = await Codecs.call({ op: 'encode', format: WASM_FORMATS[fmt], rgba: d.buffer, width: w, height: h, opts: codecOpts(fmt, o, extra.defaultQuality || 92) }, [d.buffer]);
              bytes = new Uint8Array(r.bytes);
              info = { wasm: true, palette: r.palette };
            }
          } catch (e) {
            if (e && e.cancelled) throw e;
            if (!(e && e.codecFailure)) { problem(`${name}: the ${fmtName(fmt)} encoder failed (${e && e.message ? e.message : 'unknown error'}), so it was skipped.`); return null; }
            fallbackNote(fmt);
            bytes = null;
          }
        } else if (WASM_FORMATS[fmt] && (spec.codecs === 'wasm' || fmt === 'image/avif') && !Codecs.usable()) fallbackNote(fmt);
        if (!bytes) {
          const q = qualityOf(o, extra.defaultQuality || 92);
          let blob = null;
          if (target && (fmt === 'image/jpeg' || fmt === 'image/webp')) {
            const r = await canvasTarget(flat, fmt, target, extra);
            if (r) { blob = r.blob; info = { quality: r.quality, width: r.width, height: r.height, missed: r.missed, canvas: true }; }
          } else {
            try { blob = await new Promise(r => flat.toBlob(r, fmt, q)); } catch (e) { blob = null; }
          }
          if (!blob) {
            problem(`${name}: this browser could not encode the ${dims(w, h)} result, so it was skipped. Browsers have a size limit — ${LIMIT_WORDS} in Safari and on most phones — so choose a smaller size.`);
            return null;
          }
          bytes = new Uint8Array(await blob.arrayBuffer());
          info.canvas = true;
        }
      }
      let made = typeOfBytes(bytes, fmt);
      if (made !== fmt) {
        if (fmt === 'image/webp') noWebP = true;
        problem(`This browser cannot write ${fmtName(fmt)}, so ${fmtName(made)} was produced.`);
      }
      /* metadata the visitor chose to keep */
      if (extra.meta && (extra.meta.exif || extra.meta.icc || extra.meta.xmp)) {
        const r = CORE.embedMetadata(bytes, extra.meta);
        bytes = r.bytes;
        info.metaWritten = r.written;
        if (r.skipped.length) problem(`${name}: ${fmtName(made)} files are saved here without ${r.skipped.map(k => k === 'icc' ? 'a colour profile' : k.toUpperCase()).join(' or ')}.`);
      }
      if (extra.dpi && CORE.setDPI && (made === 'image/jpeg' || made === 'image/png')) bytes = CORE.setDPI(bytes, extra.dpi);
      else if (extra.dpi && made !== 'image/bmp') problem(`${fmtName(made)} files have no DPI field, so no DPI was written to them.`);
      return { blob: new Blob([bytes], { type: made }), type: made, info };
    }
    let noWebP = false;                                // this browser was asked for WebP and wrote something else

    /* "make it under N KB" with only the browser's encoder: the quality is
       bisected, then the size is cut and the quality searched again */
    async function canvasTarget(canvas, fmt, maxBytes, extra) {
      let src = canvas, best = null;
      for (let round = 0; round < 8; round++) {
        let lo = 10, hi = 95, fit = null;
        const at = async (q) => {
          const b = await new Promise(r => src.toBlob(r, fmt, q / 100));
          if (!b) return null;
          if (extra.onStep) extra.onStep({ width: src.width, height: src.height, quality: q, bytes: b.size });
          if (!best || b.size < best.blob.size) best = { blob: b, quality: q, width: src.width, height: src.height };
          return b;
        };
        const top = await at(hi);
        if (!top) return null;
        if (top.size <= maxBytes) return { blob: top, quality: hi, width: src.width, height: src.height };
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const b = await at(mid);
          if (b && b.size <= maxBytes) { fit = { blob: b, quality: mid }; lo = mid + 1; } else hi = mid - 1;
        }
        if (fit) return { blob: fit.blob, quality: fit.quality, width: src.width, height: src.height };
        const f = Math.max(0.3, Math.min(0.92, Math.sqrt(maxBytes / best.blob.size) * 0.97));
        const nw = Math.round(src.width * f), nh = Math.round(src.height * f);
        if (nw < 16 || nh < 16) break;
        src = await resampleTo(src, nw, nh, null);
        src = toCanvas(src);
      }
      return best ? Object.assign(best, { missed: true }) : null;
    }

    /* an ICO of every standard size up to the picture's own, each a PNG */
    async function icoFrom(canvas) {
      const side = Math.max(canvas.width, canvas.height);
      const sizes = [16, 24, 32, 48, 64, 128, 256].filter(s => s <= Math.max(16, Math.min(256, side)));
      const images = [];
      for (const s of sizes) {
        const c = el('canvas'); c.width = s; c.height = s;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        const k = Math.min(s / canvas.width, s / canvas.height);
        const src = await resampleTo(canvas, Math.max(1, Math.round(canvas.width * k)), Math.max(1, Math.round(canvas.height * k)), null);
        x.drawImage(src, Math.round((s - src.width) / 2), Math.round((s - src.height) / 2));
        const b = await new Promise(r => c.toBlob(r, 'image/png'));
        images.push({ width: s, height: s, bytes: new Uint8Array(await b.arrayBuffer()) });
      }
      const out = CORE.encodeICO(images);
      out.sizes = sizes;
      return out;
    }

    /* Object URLs of the result previews: let go when a new run starts or
       the page is left, so a session of changes does not pile up blobs. */
    let previewUrls = [];
    const previewUrl = (blob) => { const u = URL.createObjectURL(blob); previewUrls.push(u); return u; };
    const revokePreviews = () => { previewUrls.forEach(u => URL.revokeObjectURL(u)); previewUrls = []; };
    window.addEventListener('pagehide', revokePreviews);

    /* Said when a result is bigger than its source, naming only controls
       this tool really has. */
    function largerNote(fmt) {
      const canFormat = keys.has('format') && !spec.outputFormat;
      if (canFormat && fmt === 'image/png') return 'The result is larger than the original: PNG keeps every pixel exactly. For a smaller file, choose JPEG' + (noWebP ? '' : ' or WebP') + ' under “' + labelOf('format') + '”.';
      if (keys.has('quality') && fmt !== 'image/png') return 'The result is larger than the original. Lower the quality' + (canFormat ? ', or choose another format under “' + labelOf('format') + '”.' : '.');
      return 'The result is larger than the original: it is saved as ' + (fmt === 'image/png' ? 'PNG, which keeps every pixel exactly' : fmt.replace('image/', '').toUpperCase()) + '.';
    }
    const labelOf = (k) => ((spec.controls || []).find(c => c.key === k) || {}).label || k;

    const baseName = (s) => (s.file.name.replace(/\.[^.]+$/, '') || 'image');

    /* ---- metadata to keep, per the "metadata" control ----
       none: nothing (pixels converted to sRGB as they are read)
       icc:  the colour profile (pixels read as stored, so they match it)
       exif: the colour profile and EXIF without GPS
       all:  the colour profile, EXIF with GPS, and XMP
       Kept EXIF says Orientation 1, since the pixels are drawn upright, and
       loses its thumbnail, which would show the picture before the change. */
    const metaMode = (o) => keys.has('metadata') ? (o.metadata || 'none') : 'none';
    async function sourceMeta(s) {
      if (s.metaCache) return s.metaCache;
      const m = CORE.extractMetadata ? CORE.extractMetadata(s.bytes) : {};
      if (!m.icc && m.iccDeflated && typeof DecompressionStream === 'function') {
        try {
          const ds = new Blob([m.iccDeflated]).stream().pipeThrough(new DecompressionStream('deflate'));
          m.icc = new Uint8Array(await new Response(ds).arrayBuffer());
        } catch (e) { m.icc = null; }
      }
      s.metaCache = m;
      return m;
    }
    let iccHonoured = null;
    async function metaPlan(s, o, outW, outH) {
      const mode = metaMode(o);
      if (mode === 'none') return { mode, meta: null, raw: false };
      const m = await sourceMeta(s);
      const meta = {};
      let raw = false, srgb = false;
      /* an sRGB profile changes nothing (sRGB is what every viewer assumes), so it is left out */
      if (m.icc && CORE.iccIsSRGB && CORE.iccIsSRGB(m.icc)) srgb = true;
      else if (m.icc) {
        if (iccHonoured === null) iccHonoured = await readsRawPixels();
        if (iccHonoured) { meta.icc = m.icc; raw = true; }
        else problem('This browser converts colours to sRGB as it reads a file, so the colour profile was converted rather than kept.');
      }
      if ((mode === 'exif' || mode === 'all') && m.exif) meta.exif = CORE.exifForRedraw(m.exif, { dropGps: mode !== 'all', width: outW, height: outH });
      if (mode === 'all' && m.xmp) meta.xmp = m.xmp;
      return { mode, meta, raw, found: m, srgb };
    }
    /* the first frame of an animation (drawing an <img> takes whichever frame is showing) */
    async function firstFrame(s) {
      try {
        const bm = await createImageBitmap(s.file);
        const c = el('canvas'); c.width = bm.width; c.height = bm.height;
        c.getContext('2d').drawImage(bm, 0, 0);
        if (bm.close) bm.close();
        return asSource(c);
      } catch (e) { return null; }
    }
    /* the pixels as stored, upright, for a file whose profile is kept */
    async function rawPixels(s) {
      if (s.rawCanvas) return s.rawCanvas;
      try {
        const bm = await createImageBitmap(s.file, { imageOrientation: 'from-image', colorSpaceConversion: 'none' });
        const c = el('canvas'); c.width = bm.width; c.height = bm.height;
        c.getContext('2d').drawImage(bm, 0, 0);
        if (bm.close) bm.close();
        s.rawCanvas = asSource(c);
        return s.rawCanvas;
      } catch (e) { return null; }
    }

    /* ---- the run loop, one branch per kind ----
       Runs never overlap. A <select> fires both input and change, and a
       slider fires input many times; two runs interleaving at their awaits
       would each clear the stage and then both append, duplicating every
       result. A change that arrives mid-run stops it at the next file and
       queues one more run, which is skipped when the files and settings are
       what the last run used. */
    let running = null, rerun = false, doneKey = null, runToken = 0;
    let detachSelect = null;                           // the window listeners of the cropper's last run
    const runKey = () => JSON.stringify(readOpts()) + '|' + sources.map(s => s.url + (s.over ? JSON.stringify(s.over) : '')).join('|') + '|' + (spec.stateKey ? spec.stateKey() : '');
    function run() {
      if (running) { rerun = true; runToken++; return running; }
      io.setAttribute('aria-busy', 'true');
      running = (async () => {
        do {
          rerun = false;
          const key = runKey();
          if (key === doneKey) continue;
          const ok = await runOnce();
          /* a failed run is tried again next time, and so is one that was overtaken
             (a newer change arrived while it ran, so it may have stopped part-way) */
          doneKey = ok === false || rerun ? null : key;
        } while (rerun);
      })().finally(() => { running = null; io.removeAttribute('aria-busy'); });
      return running;
    }
    const stale = (token) => token !== runToken;

    /* progress for anything that takes a while; Cancel stops the batch and
       the encoder in the middle of a file */
    let cancelled = false;
    const progress = {
      timer: 0,
      start(total, label) {
        cancelled = false;
        progressBar.max = Math.max(1, total); progressBar.value = 0;
        progressText.textContent = label || '';
        clearTimeout(this.timer);
        /* shown only when the work outlasts a quick run */
        this.timer = setTimeout(() => { progressRow.hidden = false; }, total > 1 ? 0 : 300);
      },
      step(done, label) { progressBar.value = done; if (label) progressText.textContent = label; },
      end() { clearTimeout(this.timer); progressRow.hidden = true; progressText.textContent = ''; }
    };
    cancelBtn.addEventListener('click', () => {
      cancelled = true;
      runToken++;
      Codecs.cancel();
      progress.end();
      say('Stopped. The files finished before Cancel are below.', 'note');
    });

    async function runOnce() {
      if (!sources.length) return;
      const token = ++runToken;
      const o = readOpts();
      if (detachSelect) { detachSelect(); detachSelect = null; }
      revokePreviews();
      stage.innerHTML = '';
      actions.innerHTML = '';
      stats.innerHTML = '';
      outputs = [];
      runNotes = [];
      /* what the last run said belongs to that run (a "larger than the original" note must not outlive it) */
      said = { text: '', kind: '' };
      paintMsg();

      try {
        if (spec.kind === 'analyse') return await runAnalyse(o);
        if (spec.kind === 'binary') return await runBinary(o, token);
        if (spec.kind === 'select') return await runSelect(o);
        if (spec.kind === 'editor') return await spec.runEditor(api, o, token);
        if (spec.kind === 'multi' || spec.kind === 'preset-multi') return await runMulti(o, token);
        return await runCanvas(o, token);
      } catch (e) {
        if (e && e.cancelled) { progress.end(); return false; }
        say('Something went wrong processing that image. ' + (e && e.message ? e.message : ''), 'error');
        return false;
      } finally {
        if (token === runToken) progress.end();
      }
    }

    /* the target size the controls ask for, in bytes: a KB here is 1,000
       bytes, so "under 50 KB" fits a form whichever kilobyte it counts */
    function targetOf(o) {
      if (!keys.has('target')) return 0;
      const t = o.target === 'custom' ? Number(o.targetKB) : Number(o.target);
      return Number.isFinite(t) && t > 0 ? Math.round(t * 1000) : 0;
    }

    /* a size limit in the units it was asked in: 1,000 bytes to the KB */
    const limitWords = (t) => (t >= 1000000 ? +(t / 1000000).toFixed(2) + ' MB' : +(t / 1000).toFixed(1) + ' KB') + ` (${t.toLocaleString('en-GB')} bytes)`;
    function enlargedNotes(notes, who) {
      /* enlarging the visitor asked for ("Allow enlarging: Yes") is not silent */
      if (keys.has('enlarge') && readOpts().enlarge === 'yes') return;
      (notes || []).filter(n => n.enlarged).forEach(n => {
        const f = Math.max(n.to[0] / n.from[0], n.to[1] / n.from[1]);
        problem(`${who}${n.label ? ' (' + n.label + ')' : ''}: the ${dims(n.from[0], n.from[1])} picture was enlarged ${f.toFixed(2)}× to fill ${dims(n.to[0], n.to[1])}, which adds softness, not detail.`);
      });
    }

    /* one in, one out */
    async function runCanvas(o0, token) {
      const total = { before: 0, after: 0 };
      let fmtUsed = 'image/png';
      const many = sources.length > 1;
      const target = targetOf(o0);
      const facts = [];
      let compareHost = null;
      if (spec.compare !== false) { compareHost = el('div', 'image-card image-card-wide img-compare-card'); stage.appendChild(compareHost); }
      progress.start(sources.length, many ? 'Starting…' : 'Working…');
      for (let i = 0; i < sources.length; i++) {
        if (stale(token)) return false;
        if (cancelled) break;
        const s = sources[i];
        const o = optsFor(s, o0);
        if (many) progress.step(i, `${i + 1} of ${sources.length}: ${s.file.name}`);
        const notes = [];
        const canvas = el('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: spec.kind === 'segment' });
        const h = makeHelpers(canvas, ctx, notes);

        const fmt = spec.outputFormat || (o.format === 'same' ? sameFormat(s) : o.format) || 'image/png';
        /* an animated GIF, WebP or PNG: kept as it is when the format stays
           the same and nothing else changes; otherwise its first frame */
        const anim = CORE.animationInfo ? CORE.animationInfo(s.bytes) : { animated: false };
        if (anim.animated && spec.passthroughAnimated) {
          const own = CORE.mimeOf(s.bytes);
          const side = Number(o.maxSide) || 0;
          if (own === fmt && !(side > 0 && Math.max(s.img.naturalWidth, s.img.naturalHeight) > side)) {
            const blob = new Blob([s.bytes], { type: own });
            problem(`${s.file.name} is animated (${anim.frames} frames), so it was kept exactly as it is, every frame.`);
            const name = `${baseName(s)}-${spec.id || 'out'}.${extOfType(own)}`;
            outputs.push({ name, blob });
            total.before += s.file.size; total.after += blob.size;
            facts.push({ s, res: { blob, type: own, info: { passthrough: true } }, w: s.img.naturalWidth, h: s.img.naturalHeight, plan: null });
            const card = el('div', 'image-card');
            const prev = el('img', 'image-preview'); prev.src = previewUrl(blob); prev.alt = 'Result preview';
            card.appendChild(prev);
            const cap = el('div', 'image-cap');
            cap.appendChild(el('span', null, `${s.img.naturalWidth}×${s.img.naturalHeight}, ${anim.frames} frames`));
            cap.appendChild(el('span', 'file-size', fmtBytes(blob.size)));
            card.appendChild(cap);
            const dl = el('button', 'btn-ghost', 'Download'); dl.type = 'button';
            dl.addEventListener('click', () => downloadBlob(blob, name));
            card.appendChild(dl);
            stage.appendChild(card);
            continue;
          }
          problem(`${s.file.name} is animated (${anim.frames} frames); only its first frame was converted${own === fmt ? ', because it was also resized' : ''}.`);
        }
        /* a result made from the file's own bytes, without redrawing (the
           metadata remover's lossless mode): its pixels are the original's */
        if (spec.passthrough) {
          const pt = await spec.passthrough(s, o, api);
          if (stale(token)) return false;
          if (pt) {
            const blob = new Blob([pt.bytes], { type: pt.type });
            const name = `${baseName(s)}-${spec.id || 'out'}.${extOfType(pt.type)}`;
            outputs.push({ name, blob });
            total.before += s.file.size; total.after += blob.size;
            facts.push({ s, res: { blob, type: pt.type, info: { passthrough: true } }, w: s.img.naturalWidth, h: s.img.naturalHeight, plan: null });
            const card = el('div', 'image-card');
            const prev = el('img', 'image-preview'); prev.src = previewUrl(blob); prev.alt = 'Result preview';
            card.appendChild(prev);
            const cap = el('div', 'image-cap');
            cap.appendChild(el('span', null, `${s.img.naturalWidth}×${s.img.naturalHeight}${pt.label ? ' · ' + pt.label : ''}`));
            cap.appendChild(el('span', 'file-size', fmtBytes(blob.size) + (s.file.size ? ` (${blob.size <= s.file.size ? '−' : '+'}${Math.abs(Math.round((1 - blob.size / s.file.size) * 100))}%)` : '')));
            card.appendChild(cap);
            const dl = el('button', 'btn-ghost', 'Download'); dl.type = 'button';
            dl.addEventListener('click', () => downloadBlob(blob, name));
            card.appendChild(dl);
            stage.appendChild(card);
            if (pt.note) problem(pt.note);
            if (many) progress.step(i + 1);
            continue;
          }
        }
        const plan = await metaPlan(s, o);
        if (spec.redrawMeta) { const m = spec.redrawMeta(s, o); if (m) plan.meta = Object.assign({}, plan.meta || {}, m); }
        const src = anim.animated ? (await firstFrame(s)) || s.img : plan.raw ? (await rawPixels(s)) || s.img : s.img;
        if (spec.kind === 'segment') applyBackgroundRemoval(canvas, ctx, src, o, h);
        else await spec.paint(ctx, src, o, h, s);
        if (stale(token)) return false;
        if (cancelled) break;
        enlargedNotes(notes, s.file.name);
        if (plan.meta && plan.meta.exif) plan.meta.exif = CORE.exifForRedraw(plan.meta.exif, { width: canvas.width, height: canvas.height });

        const steps = [];
        const res = await encodeOut(canvas, fmt, o, s.file.name, {
          meta: plan.meta, targetBytes: target, defaultQuality: spec.defaultQuality || 92,
          onStep: (st) => { steps.push(st); if (!many) progress.step(0, `Trying ${st.quality !== undefined ? 'quality ' + st.quality : st.colours ? st.colours + ' colours' : 'all colours'} at ${dims(st.width, st.height)}: ${fmtBytes(st.bytes)}`); }
        });
        if (stale(token)) return false;
        if (cancelled) break;
        if (!res) continue;                              // said by name; the rest carry on
        const blob = res.blob, made = res.type;
        fmtUsed = made;
        if (target && res.info.missed) problem(`${s.file.name}: even at the lowest quality and ${dims(res.info.width, res.info.height)} it is ${blob.size.toLocaleString('en-GB')} bytes, so it is not under ${limitWords(target)}; this is the smallest it got.`);
        facts.push({ s, res, w: canvas.width, h: canvas.height, plan });

        const name = `${baseName(s)}-${spec.id || 'out'}.${extOfType(made)}`;
        outputs.push({ name, blob });
        total.before += s.file.size;
        total.after += blob.size;

        const card = el('div', 'image-card');
        const prev = el('img', 'image-preview');
        const url = previewUrl(blob);
        prev.src = url;
        prev.alt = 'Result preview';
        card.appendChild(prev);
        const cap = el('div', 'image-cap');
        const outW = res.info.width || canvas.width, outH = res.info.height || canvas.height;
        cap.appendChild(el('span', null, `${outW}×${outH}`));
        cap.appendChild(el('span', 'file-size', fmtBytes(blob.size) + (target && res.info.quality !== undefined ? ` · quality ${res.info.quality}` : '') + (s.file.size ? ` (${blob.size <= s.file.size ? '−' : '+'}${Math.abs(Math.round((1 - blob.size / s.file.size) * 100))}%)` : '')));
        card.appendChild(cap);
        const btns = el('div', 'img-card-btns');
        const dl = el('button', 'btn-ghost', 'Download');
        dl.type = 'button';
        dl.addEventListener('click', () => downloadBlob(blob, name));
        btns.appendChild(dl);
        if (compareHost && many) {
          const cmp = el('button', 'btn-ghost img-cmp-btn', 'Compare');
          cmp.type = 'button';
          cmp.addEventListener('click', () => { showCompare(compareHost, s, url, outW, outH, blob); compareHost.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
          btns.appendChild(cmp);
        }
        card.appendChild(btns);
        if (compareHost && !many) {
          /* one file: the before/after view is the result; its After image is the preview */
          showCompare(compareHost, s, url, outW, outH, blob, prev);
        } else stage.appendChild(card);
        if (compareHost && many && facts.length === 1) showCompare(compareHost, s, url, outW, outH, blob);
        if (many) progress.step(i + 1);
      }
      if (compareHost && !compareHost.childNodes.length) compareHost.remove();

      addBatchActions();
      if (cancelled) return false;                       // what was finished stays, with its ZIP
      const delta = total.before - total.after;
      const rows = [
        ['Images processed', outputs.length === sources.length ? String(sources.length) : outputs.length + ' of ' + sources.length],
        ['Original total', fmtBytes(total.before)],
        ['Result total', fmtBytes(total.after)],
        ['Change', (delta >= 0 ? '−' : '+') + fmtBytes(Math.abs(delta)) +
          (total.before ? ` (${delta >= 0 ? '−' : '+'}${Math.abs(Math.round(delta / total.before * 100))}%)` : '')]
      ];
      if (facts.length === 1) {
        const f = facts[0];
        if (f.res.info.quality !== undefined && target) rows.push(['Quality found', `${f.res.info.quality} (${f.res.info.tries || 'several'} tries)`]);
        if (f.res.info.wasm && spec.codecs === 'wasm') rows.push(['Encoder', encoderName(f.res.type, o0)]);
        else if (f.res.info.canvas && spec.codecs === 'wasm') rows.push(['Encoder', 'this browser’s own']);
        if (f.res.info.palette) rows.push(['Colours', `${f.res.info.palette} (an indexed PNG)`]);
      }
      if (target) rows.push(['Size limit', limitWords(target)]);
      if (keys.has('metadata')) rows.push(['Metadata kept', metaWords(metaMode(o0), facts)]);
      let leftover = false;
      if (spec.showsMetadataDiff && CORE) {
        const segs = CORE.metadataSegments(sources[0].bytes);
        rows.push(['Metadata found in original', segs.length ? segs.map(s => s.name).join(', ') : 'none']);
        const ex = CORE.readExif(sources[0].bytes);
        if (ex.gps && ex.gps.latitude !== undefined) {
          rows.push(['GPS removed', `${ex.gps.latitude.toFixed(5)}, ${ex.gps.longitude.toFixed(5)}`]);
        }
        /* What the result holds is read from the result's own bytes, every
           file of a batch, rather than assumed. */
        const rep = { personal: [], technical: [] };
        /* EXIF fields kept on purpose (the remover's copyright and orientation
           options) do not count as left over, but only when nothing else is in that EXIF */
        const allowed = spec.keptTags ? spec.keptTags(o0) : [];
        const kept = new Set();
        for (const out of outputs) {
          const ob = new Uint8Array(await out.blob.arrayBuffer());
          const r = CORE.metadataReport(ob);
          if (allowed.length && r.personal.length === 1 && r.personal[0] === 'EXIF') {
            const ex = CORE.readExif(ob);
            const tags = Object.keys(ex.tags).filter((t) => t !== 'OrientationLabel');
            if (!ex.gps && tags.every((t) => allowed.indexOf(t) >= 0)) { tags.forEach((t) => kept.add(t)); r.personal = []; }
          }
          ['personal', 'technical'].forEach(k => r[k].forEach(n => { if (rep[k].indexOf(n) < 0) rep[k].push(n); }));
        }
        leftover = rep.personal.length > 0;
        rows.push(['Metadata in result', kept.size && !rep.personal.length
          ? 'EXIF with only ' + [...kept].join(' and ') + ', kept as you chose; no GPS or camera data' + (rep.technical.length ? '; ' + rep.technical.join(', ') + ' kept' : '')
          : CORE.metadataSummary(rep)]);
      }
      renderStats(rows);
      if (leftover) say('Some metadata is still in the result — see the list below. Try another format.', 'error');
      else if (delta < 0 && !spec.noLargerNote) say(largerNote(fmtUsed), 'warn');
    }
    function encoderName(type, o) {
      if (type === 'image/jpeg') return 'MozJPEG (WebAssembly)';
      if (type === 'image/webp') return 'libwebp (WebAssembly)';
      if (type === 'image/avif') return 'libavif with libaom (WebAssembly)';
      if (type === 'image/png') return 'oxipng (WebAssembly)';
      return fmtName(type);
    }
    function metaWords(mode, facts) {
      const written = new Set();
      facts.forEach(f => (f.res.info.metaWritten || []).forEach(k => written.add(k)));
      if (mode === 'none') return 'none (colours converted to sRGB)';
      const parts = [];
      if (written.has('icc')) parts.push('colour profile');
      if (written.has('exif')) parts.push(mode === 'all' ? 'EXIF with GPS' : 'EXIF without GPS');
      if (written.has('xmp')) parts.push('XMP');
      const srgb = facts.some(f => f.plan && f.plan.srgb);
      if (srgb && !written.has('icc')) parts.push(parts.length ? 'no profile (sRGB, which viewers assume)' : '');
      const list = parts.filter(Boolean);
      if (list.length) return list.join(', ');
      return srgb ? 'none: the original’s profile is sRGB, which every viewer assumes' : 'none (the original had none of those)';
    }
    function showCompare(host, s, afterUrl, w, h, blob, previewImg) {
      host.innerHTML = '';
      if (host._ro) host._ro.disconnect();
      const ow = s.img ? s.img.naturalWidth : w, oh = s.img ? s.img.naturalHeight : h;
      const sameShape = Math.abs(ow / oh - w / h) < 0.01;
      const delta = s.file.size - blob.size;
      const box = makeCompare({
        beforeUrl: s.url, afterUrl, width: w, height: h, beforeWidth: sameShape ? w : ow, sameShape,
        afterLabel: `${w}×${h}, ${fmtBytes(blob.size)}`,
        readout: { before: `${fmtBytes(s.file.size)} · ${ow}×${oh}`, after: `${fmtBytes(blob.size)} · ${w}×${h}`,
          change: s.file.size ? `${fmtBytes(Math.abs(delta))} (${Math.abs(Math.round(delta / s.file.size * 100))}%)` : '', saved: delta >= 0 }
      });
      if (!previewImg) {
        /* only the stage's cards count as results; this After image is a view */
        box.querySelector('.img-compare-after').className = 'img-compare-img img-compare-after';
      }
      host.appendChild(box);
      host._ro = box._ro;
      host.appendChild(el('p', 'img-compare-name', s.file.name));
      if (previewImg) {
        const dl = el('button', 'btn-ghost', 'Download');
        dl.type = 'button';
        dl.addEventListener('click', () => downloadBlob(blob, outputs[0] ? outputs[0].name : 'image'));
        host.appendChild(dl);
      }
    }

    /* one in, many out */
    async function runMulti(o0, token) {
      const src = sources[0];
      let jobs;
      let passport = null;
      say('');
      const notes = [];
      const helpers = () => makeHelpers(el('canvas'), el('canvas').getContext('2d'), notes);
      if (spec.id === 'passport-photo' && !spec.produce) {
        let subject = src.img;
        if (o0.bgmode === 'replace') {
          const token2 = ++cutToken;
          subject = await subjectOnColour(src, o0.bg || '#ffffff');
          if (token2 !== cutToken) return false;        // a newer run took over while the model worked
          if (!subject) return false;                    // the reason is already on screen; try again next time
        }
        passport = CORE.PHOTO_PRESETS[Number(o0.preset) || 0];
        jobs = passportJobs(subject, o0);
      } else if (spec.multiple) {
        jobs = [];
        for (const s of sources) {
          const made = await spec.produce(s.img, optsFor(s, o0), helpers(), s, api);
          made.forEach(j => jobs.push(Object.assign({ src: s }, j)));
        }
      } else jobs = await spec.produce(src.img, o0, helpers(), src, api);
      if (stale(token)) return false;
      if (spec.nameJobs) spec.nameJobs(jobs, o0);
      let lanczos = false, steps = false;

      let totalOut = 0;
      const many = jobs.length > 1;
      progress.start(jobs.length, 'Working…');
      for (let k = 0; k < jobs.length; k++) {
        if (stale(token)) return false;
        if (cancelled) break;
        const job = jobs[k];
        const s = job.src || sources[0];
        const o = optsFor(job.src, o0);
        if (many) progress.step(k, `${k + 1} of ${jobs.length}: ${job.src ? job.src.file.name : job.label || job.suffix}`);
        const canvas = el('canvas');
        canvas.width = Math.max(1, Math.round(job.width));
        canvas.height = Math.max(1, Math.round(job.height));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        const jn = [];
        await job.paint(ctx, makeHelpers(canvas, ctx, jn));
        if (jn.lanczos) lanczos = true;
        if (jn.steps) steps = true;
        enlargedNotes(jn, job.src ? job.src.file.name : sources[0].file.name);

        const fmt = spec.outputFormat || job.format || (o.format === 'same' ? sameFormat(s) : o.format) || 'image/png';
        const who = job.src ? job.src.file.name : sources[0].file.name + ' (' + (job.label || job.suffix) + ')';
        const plan = await metaPlan(s, o, canvas.width, canvas.height);
        const dpi = passport ? passport.dpi : job.dpi || (keys.has('dpi') && Number(o.dpi) > 0 ? Number(o.dpi) : 0);
        const res = await encodeOut(canvas, fmt, o, who, { meta: plan.meta, targetBytes: job.targetBytes || targetOf(o), defaultQuality: spec.defaultQuality || 90, dpi });
        if (stale(token)) return false;
        if (cancelled) break;
        if (!res) continue;                              // said by name; the rest carry on
        const blob = res.blob, made = res.type;
        if (res.info.missed) problem(`${who}: even at the lowest quality and ${dims(res.info.width, res.info.height)} it is ${blob.size.toLocaleString('en-GB')} bytes, so it is not under ${limitWords(job.targetBytes || targetOf(o))}; this is the smallest it got.`);
        const outW = res.info.width || canvas.width, outH = res.info.height || canvas.height;

        const base = job.src ? baseName(job.src) : baseName(sources[0]);
        const name = job.name ? `${job.name}.${extOfType(made)}` : `${base}-${job.suffix}.${extOfType(made)}`;
        outputs.push({ name, blob });
        totalOut += blob.size;

        const card = el('div', 'image-card');
        const prev = el('img', 'image-preview');
        prev.src = previewUrl(blob);
        prev.alt = job.suffix;
        card.appendChild(prev);
        const cap = el('div', 'image-cap');
        cap.appendChild(el('span', null, job.label || job.suffix));
        cap.appendChild(el('span', 'file-size', `${outW}×${outH} · ${fmtBytes(blob.size)}` + (res.info.quality !== undefined && (job.targetBytes || targetOf(o)) ? ` · quality ${res.info.quality}` : res.info.colours ? ` · ${res.info.colours} colours` : '')));
        card.appendChild(cap);
        const dl = el('button', 'btn-ghost', 'Save');
        dl.type = 'button';
        dl.addEventListener('click', () => downloadBlob(blob, name));
        card.appendChild(dl);
        stage.appendChild(card);
        if (many) progress.step(k + 1);
      }
      enlargedNotes(notes, sources[0].file.name);

      addBatchActions();
      if (cancelled) return false;                       // what was finished stays, with its ZIP
      const rows = [
        ['Files produced', String(outputs.length)],
        ['Total size', fmtBytes(totalOut)],
        ['Source', `${sources[0].img.naturalWidth}×${sources[0].img.naturalHeight}`]
      ];
      if (passport) {
        const pw = CORE.mmToPx(passport.w, passport.dpi), ph = CORE.mmToPx(passport.h, passport.dpi);
        const mm = (px) => CORE.pxToMm(px, passport.dpi).toFixed(2);
        rows.push(['Print size', `${pw}×${ph} px at ${passport.dpi} DPI = ${mm(pw)} × ${mm(ph)} mm`]);
        rows.push(['Rounding', `${passport.w}×${passport.h} mm is ${(passport.w / 25.4 * passport.dpi).toFixed(2)} × ${(passport.h / 25.4 * passport.dpi).toFixed(2)} px; pixels are whole, so each side is rounded to the nearest one`]);
        rows.push(['Resolution in the file', `${passport.dpi} DPI`]);
        rows.push(['Background', o0.bgmode === 'replace' ? 'replaced with ' + String(o0.bg || '#ffffff').toUpperCase() + ' — cut out on this device' : 'as photographed']);
      }
      if (lanczos || steps) rows.push(['Resampling', lanczos ? 'Lanczos3 (WebAssembly)' : 'halving steps on canvases (WebAssembly unavailable)']);
      if (keys.has('dpi') && Number(o0.dpi) > 0) rows.push(['DPI in the file', String(Number(o0.dpi))]);
      if (targetOf(o0)) rows.push(['Size limit', limitWords(targetOf(o0))]);
      if (keys.has('metadata')) rows.push(['Metadata kept', metaMode(o0) === 'none' ? 'none (colours converted to sRGB)' : metaMode(o0) === 'icc' ? 'colour profile, unless sRGB' : metaMode(o0) === 'exif' ? 'colour profile and EXIF without GPS' : 'everything']);
      if (spec.statRows) spec.statRows(rows, o0, jobs, outputs);
      renderStats(rows);
      const kept = jobs.filter(j => j.kept).length;
      if (kept) {
        say(`${kept} of ${jobs.length} image${jobs.length > 1 ? 's were' : ' was'} smaller than that and ${kept > 1 ? 'were' : 'was'} left at ${kept > 1 ? 'their' : 'its'} own size: enlarging only adds blur. Set “Allow enlarging” to Yes to scale ${kept > 1 ? 'them' : 'it'} up anyway.`, 'note');
      } else if (!outputs.length) say('Nothing to produce — check the settings above.', 'note');
      else if (spec.afterMulti) spec.afterMulti(api, o0, jobs);
    }

    /* The photo, or (when the background is to be replaced) a canvas of the
       person cut out and laid on the chosen colour. */
    function passportJobs(img, o) {
      const p = CORE.PHOTO_PRESETS[Number(o.preset) || 0];
      const pw = CORE.mmToPx(p.w, p.dpi), ph = CORE.mmToPx(p.h, p.dpi);
      const jobs = [];
      const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;

      const drawOne = (ctx, w, h, dx, dy) => {
        const scale = Math.max(w / nw, h / nh);
        const iw = nw * scale, ih = nh * scale;
        ctx.save();
        ctx.beginPath(); ctx.rect(dx, dy, w, h); ctx.clip();
        ctx.drawImage(img, dx + (w - iw) / 2, dy + (h - ih) / 2, iw, ih);
        ctx.restore();
      };

      if (o.sheet !== 'sheet') {
        jobs.push({
          suffix: `${p.w}x${p.h}mm`, label: p.name,
          width: pw, height: ph,
          paint: (ctx) => drawOne(ctx, pw, ph, 0, 0)
        });
      }
      if (o.sheet !== 'single') {
        const SW = CORE.mmToPx(152.4, p.dpi), SH = CORE.mmToPx(101.6, p.dpi);  // 6x4 inch
        const gap = Math.round(p.dpi * 0.04);
        const cols = Math.max(1, Math.floor((SW + gap) / (pw + gap)));
        const rows = Math.max(1, Math.floor((SH + gap) / (ph + gap)));
        jobs.push({
          suffix: 'print-sheet-6x4', label: `Print sheet — ${cols * rows} copies on 6×4in`,
          width: SW, height: SH,
          paint: (ctx) => {
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, SW, SH);
            const offX = Math.round((SW - (cols * pw + (cols - 1) * gap)) / 2);
            const offY = Math.round((SH - (rows * ph + (rows - 1) * gap)) / 2);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
              const x = offX + c * (pw + gap), y = offY + r * (ph + gap);
              drawOne(ctx, pw, ph, x, y);
              ctx.strokeStyle = '#d0d0d0'; ctx.lineWidth = 1;
              ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
            }
          }
        });
      }
      return jobs;
    }

    /* ---- the cropper ----
       A box on the picture: drag outside it to draw a new one (anchored where
       the drag began), drag inside it to move it, drag a handle to resize it;
       the arrow keys move it (with Ctrl or ⌘ they resize it) and four number
       boxes set it exactly. The picture can be turned in 90° steps and
       straightened by up to 45°, with a grid; the crop comes from the turned
       picture at full resolution. Zoom (Fit, 100%, 200%) is for the view
       only. State lives here, outside the run, so a settings change keeps it;
       a new file resets it. */
    const crop = { rot: 0, straighten: 0, zoom: 'fit', key: '' };
    function rotatedRectWithMaxArea(w, h, angle) {
      const longW = w >= h;
      const L = longW ? w : h, S = longW ? h : w;
      const sa = Math.abs(Math.sin(angle)), ca = Math.abs(Math.cos(angle));
      if (sa < 1e-9) return { w, h };
      let wr, hr;
      if (S <= 2 * sa * ca * L || Math.abs(sa - ca) < 1e-10) {
        const x = 0.5 * S;
        if (longW) { wr = x / sa; hr = x / ca; } else { wr = x / ca; hr = x / sa; }
      } else {
        const c2 = ca * ca - sa * sa;
        wr = (w * ca - h * sa) / c2; hr = (h * ca - w * sa) / c2;
      }
      return { w: Math.max(1, Math.floor(wr)), h: Math.max(1, Math.floor(hr)) };
    }
    /* the picture turned by the 90° steps and the straightening angle, on a
       canvas just big enough; what the box and the crop are measured on */
    function workingImage(img) {
      const deg = crop.rot * 90 + crop.straighten;
      if (!deg) return img;
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const rad = deg * Math.PI / 180;
      const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
      const W = Math.round(nw * c + nh * s), H = Math.round(nw * s + nh * c);
      const cv = el('canvas'); cv.width = W; cv.height = H;
      const x = cv.getContext('2d');
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.translate(W / 2, H / 2); x.rotate(rad); x.drawImage(img, -nw / 2, -nh / 2);
      return asSource(cv);
    }

    async function runSelect(o) {
      const src = sources[0];
      const key = src.url + '|' + crop.rot + '|' + crop.straighten;
      if (!src.work || crop.key !== key) { src.work = workingImage(src.img); crop.key = key; }
      const img = src.work;
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const platform = o.platform && o.platform !== 'none' ? CORE.SOCIAL_PRESETS[Number(o.platform)] : null;
      const ratio = () => {
        const oo = readOpts();
        const pf = oo.platform && oo.platform !== 'none' ? CORE.SOCIAL_PRESETS[Number(oo.platform)] : null;
        if (pf) return pf.w / pf.h;
        const r = oo.ratio;
        if (!r || r === 'free') return null;
        const [a, b] = r.split(':').map(Number);
        return a / b;
      };
      const fitRatio = (sel, ar) => {
        /* trim the longer side, keeping the centre, whole pixels */
        let w = sel.w, h = sel.h;
        if (w / h > ar) w = h * ar; else h = w / ar;
        if (ar >= 1) { w = Math.max(1, Math.floor(w + 1e-9)); h = Math.max(1, Math.round(w / ar)); }
        else { h = Math.max(1, Math.floor(h + 1e-9)); w = Math.max(1, Math.round(h * ar)); }
        const x = Math.round(Math.max(0, Math.min(nw - w, sel.x + (sel.w - w) / 2)));
        const y = Math.round(Math.max(0, Math.min(nh - h, sel.y + (sel.h - h) / 2)));
        return { x, y, w, h };
      };
      if (!selection) selection = { x: Math.round(nw * 0.15), y: Math.round(nh * 0.15),
                                    w: Math.round(nw * 0.7), h: Math.round(nh * 0.7) };
      selection = clampSel(selection);
      /* a locked shape applies at once, not only on the next drag */
      const ar0 = ratio();
      if (ar0 && Math.abs(selection.w / selection.h - ar0) * Math.min(selection.w, selection.h) > 1) selection = fitRatio(selection, ar0);
      function clampSel(s) {
        const w = Math.max(1, Math.min(nw, Math.round(s.w))), h = Math.max(1, Math.min(nh, Math.round(s.h)));
        return { x: Math.max(0, Math.min(nw - w, Math.round(s.x))), y: Math.max(0, Math.min(nh - h, Math.round(s.y))), w, h };
      }

      const wrap = el('div', 'select-wrap');
      const hint = el('p', 'select-hint', 'Drag on the image to set the area. Drag inside the box to move it, or its handles to resize it; arrow keys move it, with Ctrl or ⌘ they resize it.');
      const tools = el('div', 'crop-tools');
      const tbtn = (label, title, on) => { const b = el('button', 'btn-ghost crop-btn', label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', on); tools.appendChild(b); return b; };
      tbtn('⟲ 90°', 'Turn left 90°', () => { crop.rot = (crop.rot + 3) % 4; selection = null; rerunNow(); });
      tbtn('⟳ 90°', 'Turn right 90°', () => { crop.rot = (crop.rot + 1) % 4; selection = null; rerunNow(); });
      const stLab = el('label', 'crop-straighten');
      stLab.appendChild(el('span', null, 'Straighten'));
      const st = el('input', 'range'); st.type = 'range'; st.min = -45; st.max = 45; st.step = 0.5; st.value = crop.straighten;
      st.setAttribute('aria-label', 'Straighten, in degrees');
      const stOut = el('span', 'range-val', crop.straighten + '°');
      stLab.appendChild(st); stLab.appendChild(stOut);
      tools.appendChild(stLab);
      let stTimer = 0, gridOn = false;
      st.addEventListener('input', () => {
        stOut.textContent = st.value + '°'; gridOn = true; paintView();
        clearTimeout(stTimer);
        stTimer = setTimeout(() => {
          crop.straighten = Number(st.value);
          /* the largest upright box inside the turned picture, so no corner wedge is cropped in */
          const base = sources[0].img, rad = (crop.rot * 90 + crop.straighten) * Math.PI / 180;
          const turnedW = crop.rot % 2 ? base.naturalHeight : base.naturalWidth, turnedH = crop.rot % 2 ? base.naturalWidth : base.naturalHeight;
          const inner = rotatedRectWithMaxArea(turnedW, turnedH, crop.straighten * Math.PI / 180);
          const W2 = Math.round(base.naturalWidth * Math.abs(Math.cos(rad)) + base.naturalHeight * Math.abs(Math.sin(rad)));
          const H2 = Math.round(base.naturalWidth * Math.abs(Math.sin(rad)) + base.naturalHeight * Math.abs(Math.cos(rad)));
          selection = { x: Math.floor((W2 - inner.w) / 2), y: Math.floor((H2 - inner.h) / 2), w: inner.w, h: inner.h };
          rerunNow();
        }, 250);
      });
      const zoomBox = el('div', 'img-seg');
      zoomBox.setAttribute('role', 'group'); zoomBox.setAttribute('aria-label', 'Zoom');
      [['fit', 'Fit'], [1, '100%'], [2, '200%']].forEach(([z, label]) => {
        const b = el('button', 'img-seg-btn', label); b.type = 'button';
        b.setAttribute('aria-pressed', crop.zoom === z ? 'true' : 'false');
        b.addEventListener('click', () => { crop.zoom = z; zoomBox.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); sizeView(); paintView(); });
        zoomBox.appendChild(b);
      });
      tools.appendChild(zoomBox);
      const gridBox = el('label', 'crop-grid-toggle');
      const gridCb = el('input'); gridCb.type = 'checkbox'; gridCb.checked = true;
      gridBox.appendChild(gridCb); gridBox.appendChild(el('span', null, 'Thirds'));
      gridCb.addEventListener('change', () => paintView());
      tools.appendChild(gridBox);

      const port = el('div', 'crop-port');
      const view = el('canvas', 'select-canvas');
      view.tabIndex = 0;
      view.setAttribute('role', 'application');
      view.setAttribute('aria-label', 'Crop area. Arrow keys move the box; with Ctrl or ⌘ they resize it.');
      port.appendChild(view);
      const maxW = 720;
      let scale = 1;
      function sizeView() {
        const z = crop.zoom === 'fit' ? 0 : crop.zoom;
        scale = z ? Math.min(z, 4000 / Math.max(nw, nh)) : Math.min(1, maxW / nw);
        view.width = Math.max(1, Math.round(nw * scale));
        view.height = Math.max(1, Math.round(nh * scale));
        view.style.width = z ? view.width + 'px' : '';
        view.style.maxWidth = z ? 'none' : '';
        port.classList.toggle('is-zoomed', !!z);
      }
      sizeView();
      const vctx = view.getContext('2d');

      const readout = el('div', 'select-readout');
      const nums = el('div', 'crop-nums');
      const numIn = {};
      [['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height']].forEach(([k, label]) => {
        const f = el('label', 'crop-num');
        f.appendChild(el('span', null, label));
        const i = el('input', 'control'); i.type = 'number'; i.min = k === 'w' || k === 'h' ? 1 : 0; i.step = 1; i.id = 'crop-' + k; i.inputMode = 'numeric';
        f.appendChild(i); nums.appendChild(f); numIn[k] = i;
        i.addEventListener('change', () => {
          const v = Math.round(Number(i.value));
          if (!Number.isFinite(v)) return;
          const s = Object.assign({}, selection);
          s[k] = v;
          const ar = ratio();
          if (ar && k === 'w') s.h = Math.max(1, Math.round(v / ar));
          if (ar && k === 'h') s.w = Math.max(1, Math.round(v * ar));
          selection = clampSel(s);
          if (ar) selection = fitRatio(selection, ar);
          paintView(); queueRender();
        });
      });
      const circleWrap = el('div', 'crop-circle');
      circleWrap.hidden = o.circle !== 'yes';

      const paintView = () => {
        vctx.clearRect(0, 0, view.width, view.height);
        vctx.drawImage(img, 0, 0, view.width, view.height);
        vctx.fillStyle = 'rgba(6,8,15,.55)';
        vctx.fillRect(0, 0, view.width, view.height);
        const s = { x: selection.x * scale, y: selection.y * scale, w: selection.w * scale, h: selection.h * scale };
        vctx.save();
        vctx.beginPath(); vctx.rect(s.x, s.y, s.w, s.h); vctx.clip();
        vctx.drawImage(img, 0, 0, view.width, view.height);
        if (gridCb.checked) {
          vctx.strokeStyle = 'rgba(255,255,255,.55)'; vctx.lineWidth = 1;
          for (let k = 1; k < 3; k++) {
            vctx.beginPath(); vctx.moveTo(s.x + s.w * k / 3, s.y); vctx.lineTo(s.x + s.w * k / 3, s.y + s.h); vctx.stroke();
            vctx.beginPath(); vctx.moveTo(s.x, s.y + s.h * k / 3); vctx.lineTo(s.x + s.w, s.y + s.h * k / 3); vctx.stroke();
          }
        }
        vctx.restore();
        if (gridOn) {
          /* a fine grid over everything while straightening, to line a horizon up against */
          vctx.strokeStyle = 'rgba(255,255,255,.35)'; vctx.lineWidth = 1;
          const step = Math.max(16, Math.round(view.width / 12));
          for (let gx = step; gx < view.width; gx += step) { vctx.beginPath(); vctx.moveTo(gx + 0.5, 0); vctx.lineTo(gx + 0.5, view.height); vctx.stroke(); }
          for (let gy = step; gy < view.height; gy += step) { vctx.beginPath(); vctx.moveTo(0, gy + 0.5); vctx.lineTo(view.width, gy + 0.5); vctx.stroke(); }
        }
        vctx.strokeStyle = '#f7c948'; vctx.lineWidth = 2;
        vctx.setLineDash([6, 4]);
        vctx.strokeRect(s.x, s.y, s.w, s.h);
        vctx.setLineDash([]);
        vctx.fillStyle = '#f7c948';
        handlePoints(s).forEach(([hx, hy]) => vctx.fillRect(hx - 4, hy - 4, 8, 8));
        const out = outSize();
        readout.textContent = `${Math.round(selection.w)} × ${Math.round(selection.h)} px  ` +
                              `at ${Math.round(selection.x)}, ${Math.round(selection.y)}` +
                              ` · saved as ${out.w} × ${out.h} px`;
        numIn.x.value = selection.x; numIn.y.value = selection.y; numIn.w.value = selection.w; numIn.h.value = selection.h;
        numIn.x.max = nw - 1; numIn.y.max = nh - 1; numIn.w.max = nw; numIn.h.max = nh;
      };
      /* a platform preset saves at its own pixel size, never enlarging */
      const outSize = () => {
        const oo = readOpts();
        const pf = oo.platform && oo.platform !== 'none' ? CORE.SOCIAL_PRESETS[Number(oo.platform)] : null;
        if (pf && selection.w >= pf.w && selection.h >= pf.h) return { w: pf.w, h: pf.h, scaled: true };
        return { w: selection.w, h: selection.h, scaled: false };
      };
      const handlePoints = (s) => [[s.x, s.y], [s.x + s.w / 2, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h / 2],
        [s.x + s.w, s.y + s.h], [s.x + s.w / 2, s.y + s.h], [s.x, s.y + s.h], [s.x, s.y + s.h / 2]];
      const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

      let drag = null;
      const pos = (e) => {
        const rect = view.getBoundingClientRect();
        const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        return { x: cx / rect.width * nw, y: cy / rect.height * nh, cx, cy, k: rect.width / nw };
      };
      const onDown = (e) => {
        e.preventDefault();
        view.focus({ preventScroll: true });
        const p = pos(e);
        /* a handle (within 10 screen pixels), the inside of the box, or anywhere else */
        const s = { x: selection.x * p.k, y: selection.y * p.k, w: selection.w * p.k, h: selection.h * p.k };
        const hit = handlePoints(s).findIndex(([hx, hy]) => Math.abs(hx - p.cx) <= 10 && Math.abs(hy - p.cy) <= 10);
        if (hit >= 0) drag = { kind: 'resize', h: HANDLES[hit], start: Object.assign({}, selection) };
        else if (p.cx > s.x && p.cx < s.x + s.w && p.cy > s.y && p.cy < s.y + s.h) drag = { kind: 'move', px: p.x, py: p.y, start: Object.assign({}, selection) };
        else drag = { kind: 'draw', sx: p.x, sy: p.y };
      };
      /* draw from an anchor towards the pointer: the pointer is held inside
         the picture FIRST, and the room left between the anchor and the edge
         it heads for caps each side; only then is a locked ratio applied, by
         trimming the longer side. Trimming only shrinks, so the box stays
         inside the picture and keeps its shape when the drag runs past any
         edge. */
      const fromAnchor = (ax, ay, p) => {
        const sx = Math.min(nw, Math.max(0, Math.round(ax)));
        const sy = Math.min(nh, Math.max(0, Math.round(ay)));
        const px = Math.min(nw, Math.max(0, p.x)), py = Math.min(nh, Math.max(0, p.y));
        const left = px < sx, up = py < sy;
        let w = Math.min(Math.abs(px - sx), left ? sx : nw - sx);
        let h = Math.min(Math.abs(py - sy), up ? sy : nh - sy);
        const ar = ratio();
        if (ar) {
          if (w / h > ar) w = h * ar; else h = w / ar;
          /* whole pixels: the longer side rounds down (so it still fits), the
             other follows from it, at most half a pixel off the exact ratio */
          if (ar >= 1) { w = Math.max(1, Math.floor(w + 1e-9)); h = Math.max(1, Math.round(w / ar)); }
          else { h = Math.max(1, Math.floor(h + 1e-9)); w = Math.max(1, Math.round(h * ar)); }
        } else { w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); }
        let x = left ? sx - w : sx, y = up ? sy - h : sy;
        x = Math.max(0, Math.min(x, nw - w)); y = Math.max(0, Math.min(y, nh - h));
        return { x, y, w, h };
      };
      const onMove = (e) => {
        if (!drag) return;
        e.preventDefault();
        const p = pos(e);
        if (drag.kind === 'draw') selection = fromAnchor(drag.sx, drag.sy, p);
        else if (drag.kind === 'move') {
          const s = drag.start;
          selection = { x: Math.max(0, Math.min(nw - s.w, Math.round(s.x + p.x - drag.px))), y: Math.max(0, Math.min(nh - s.h, Math.round(s.y + p.y - drag.py))), w: s.w, h: s.h };
        } else {
          const s = drag.start, hh = drag.h;
          if (hh.length === 2) {
            /* a corner: drawn from the opposite corner */
            const ax = hh[1] === 'w' ? s.x + s.w : s.x, ay = hh[0] === 'n' ? s.y + s.h : s.y;
            selection = fromAnchor(ax, ay, p);
          } else {
            /* an edge: that side moves; with a locked ratio the other side follows, about the middle */
            let { x, y, w, h } = s;
            if (hh === 'e') w = Math.max(1, Math.min(nw - x, Math.round(p.x - x)));
            if (hh === 'w') { const r = x + w; x = Math.max(0, Math.min(r - 1, Math.round(p.x))); w = r - x; }
            if (hh === 's') h = Math.max(1, Math.min(nh - y, Math.round(p.y - y)));
            if (hh === 'n') { const b = y + h; y = Math.max(0, Math.min(b - 1, Math.round(p.y))); h = b - y; }
            const ar = ratio();
            if (ar) {
              if (hh === 'e' || hh === 'w') { const nh2 = Math.min(nh, Math.round(w / ar)); y = Math.round(s.y + (s.h - nh2) / 2); h = nh2; }
              else { const nw2 = Math.min(nw, Math.round(h * ar)); x = Math.round(s.x + (s.w - nw2) / 2); w = nw2; }
              selection = fitRatio(clampSel({ x, y, w, h }), ar);
            } else selection = clampSel({ x, y, w, h });
          }
        }
        paintView();
      };
      const onUp = () => { if (drag) { drag = null; queueRender(); } };

      view.addEventListener('mousedown', onDown);
      view.addEventListener('touchstart', onDown, { passive: false });
      /* the drag is followed on window, so it keeps going past the picture's
         edge; the next run (or a new file) takes these off again */
      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
      detachSelect = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onMove, { passive: false });
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchend', onUp);
      };
      let keyTimer = 0;
      view.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 10 : 1;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault();
        const s = Object.assign({}, selection);
        if (e.ctrlKey || e.metaKey) {
          s.w += d[0]; s.h += d[1];
          const ar = ratio();
          if (ar) { if (d[0]) s.h = Math.round(s.w / ar); else s.w = Math.round(s.h * ar); }
        } else { s.x += d[0]; s.y += d[1]; }
        selection = clampSel(s);
        paintView();
        clearTimeout(keyTimer);
        keyTimer = setTimeout(queueRender, 250);
      });
      function rerunNow() { doneKey = null; run(); }

      wrap.appendChild(hint);
      wrap.appendChild(tools);
      wrap.appendChild(port);
      wrap.appendChild(readout);
      wrap.appendChild(nums);
      stage.appendChild(wrap);

      const resultHost = el('div', 'image-card');
      stage.appendChild(resultHost);
      stage.appendChild(circleWrap);

      /* one render at a time, in order, so a quick run of edits cannot finish out of order */
      let chain = Promise.resolve(), asked = 0;
      /* only the latest request runs, and never in the middle of a drag (its release asks again) */
      const queueRender = () => {
        const mine = ++asked;
        const go = () => (mine === asked && !drag ? render() : null);
        chain = chain.then(go, go);
        return chain;
      };
      async function render() {
        const oo = readOpts();
        const canvas = el('canvas');
        const ctx = canvas.getContext('2d');
        const notes = [];
        const h = makeHelpers(canvas, ctx, notes);
        spec.paintSelection(ctx, img, selection, oo, h);
        const out = outSize();
        let final = canvas;
        if (out.scaled) {
          const r = await resampleTo(asSource(canvas), out.w, out.h, notes);
          final = toCanvas(r);
        }
        const fmt = spec.outputFormat || oo.format || 'image/png';
        runNotes = [];
        const pf = oo.platform && oo.platform !== 'none' ? CORE.SOCIAL_PRESETS[Number(oo.platform)] : null;
        if (pf && !out.scaled) problem(`The box is ${selection.w}×${selection.h}, smaller than ${pf.group} ${pf.name}’s ${pf.w}×${pf.h}, so it is saved at its own size rather than enlarged.`);
        paintMsg();
        const plan = keys.has('metadata') ? await metaPlan(src, oo, final.width, final.height) : { meta: null };
        const res = await encodeOut(final, fmt, oo, src.file.name, { meta: plan.meta });
        revokePreviews();                                // the last result's preview, if any
        if (!res) {                                      // said by name: no stale result is left to download
          outputs = [];
          resultHost.innerHTML = ''; actions.innerHTML = ''; stats.innerHTML = ''; circleWrap.innerHTML = '';
          return;
        }
        const blob = res.blob;
        outputs = [{ name: `${baseName(src)}-${spec.id}.${extOfType(res.type)}`, blob }];

        resultHost.innerHTML = '';
        const prev = el('img', 'image-preview');
        const u = previewUrl(blob);
        prev.src = u;
        prev.alt = 'Result';
        resultHost.appendChild(prev);
        const cap = el('div', 'image-cap');
        cap.appendChild(el('span', null, `${final.width}×${final.height}`));
        cap.appendChild(el('span', 'file-size', fmtBytes(blob.size)));
        resultHost.appendChild(cap);
        circleWrap.innerHTML = '';
        if (oo.circle === 'yes') {
          circleWrap.hidden = false;
          const c = el('img', 'crop-circle-img'); c.src = u; c.alt = 'Circle preview: how a round profile picture would show this crop';
          circleWrap.appendChild(c);
          circleWrap.appendChild(el('span', 'image-cap', 'As a round profile picture'));
        } else circleWrap.hidden = true;

        actions.innerHTML = '';
        const dl = el('button', 'btn-primary', 'Download result');
        dl.type = 'button';
        dl.addEventListener('click', () => downloadBlob(blob, outputs[0].name));
        actions.appendChild(dl);
        const rows = [
          ['Source', `${src.img.naturalWidth}×${src.img.naturalHeight}`],
          ['Selection', `${selection.w}×${selection.h}`],
          ['Output', `${final.width}×${final.height} px, ${fmtBytes(blob.size)}`],
          ['Output size', fmtBytes(blob.size)]
        ];
        if (crop.rot || crop.straighten) rows.splice(1, 0, ['Turned', `${(crop.rot * 90 + crop.straighten).toFixed(1).replace(/\.0$/, '')}°`]);
        renderStats(rows);
      }

      paintView();
      await render();
    }

    /* metadata / palette / base64 */
    async function runAnalyse(o) {
      const src = sources[0];
      if (spec.analyse) return spec.analyse(api, src, o);

      /* the colour palette and the EXIF viewer bring their own (spec.analyse) */
      if (spec.id === 'image-to-base64') {
        let bin = '';
        for (let i = 0; i < src.bytes.length; i++) bin += String.fromCharCode(src.bytes[i]);
        const b64 = btoa(bin);
        const mime = src.file.type || 'image/png';
        const uri = `data:${mime};base64,${b64}`;
        const text = o.wrap === 'css' ? `background-image: url("${uri}");`
                   : o.wrap === 'html' ? `<img src="${uri}" alt="">`
                   : o.wrap === 'raw' ? b64 : uri;

        const card = el('div', 'image-card image-card-wide');
        const prev = el('img', 'image-preview');
        prev.src = src.url; prev.alt = src.file.name;
        card.appendChild(prev);
        stage.appendChild(card);

        const pane = el('div', 'io-pane');
        const head = el('div', 'io-head');
        head.appendChild(el('span', 'io-label', 'Output'));
        const copy = el('button', 'btn-copy', 'Copy');
        copy.type = 'button';
        copy.addEventListener('click', () => {
          navigator.clipboard?.writeText(text);
          copy.textContent = 'Copied';
          setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
        });
        const acts = el('div', 'io-actions'); acts.appendChild(copy);
        head.appendChild(acts);
        pane.appendChild(head);
        const pre = el('pre', 'code-out');
        pre.textContent = text.length > 40000 ? text.slice(0, 40000) + '\n\n… truncated for display; use Copy for the full value' : text;
        pane.appendChild(pre);
        stage.appendChild(pane);

        renderStats([
          ['Original file', fmtBytes(src.file.size)],
          ['Base64 length', b64.length.toLocaleString('en-GB') + ' characters'],
          ['Encoded size', fmtBytes(b64.length)],
          ['Overhead', '+' + Math.round((b64.length / src.file.size - 1) * 100) + '%'],
          ['MIME type', mime]
        ]);
        if (src.file.size > 20000) {
          say('This file is large for inlining. Above roughly 2 KB a normal file reference with caching usually loads faster.', 'warn');
        }
        return;
      }
    }

    /* PDF */
    /* A JPEG goes into the PDF as it is: its own compressed bytes become the
       page image (DCTDecode), so nothing is decoded and compressed again.
       Only the segments that can identify a person or a camera are left out
       (EXIF, GPS, XMP, comments); the image data is byte for byte the file's.
       Everything else — PNG, WebP, GIF, a JPEG turned by its EXIF orientation
       tag, CMYK or 12-bit JPEGs, or any JPEG when "Re-encode" is chosen — is
       drawn on white and encoded as JPEG at the quality slider's setting. */
    async function runBinary(o, token) {
      if (spec.runBinary) return spec.runBinary(api, o, token);
      say('Building PDF…', 'note');
      const pages = [];
      let asIs = 0, again = 0, metaOut = 0;
      const reasons = [];
      for (const s of sources) {
        const info = CORE.jpegInfo(s.bytes);
        let page = null;
        if (info && info.passthrough && o.jpeg !== 'reencode') {
          const bytes = CORE.stripJpegMetadata(s.bytes);
          if (bytes !== s.bytes) metaOut++;
          page = { bytes, width: info.width, height: info.height,
                   colorSpace: info.components === 1 ? 'DeviceGray' : 'DeviceRGB', icc: CORE.jpegICC(s.bytes) };
          asIs++;
        } else {
          if (info && !info.passthrough && o.jpeg !== 'reencode') reasons.push(s.file.name + ': ' + info.why);
          const c = el('canvas');
          c.width = s.img.naturalWidth; c.height = s.img.naturalHeight;
          const cx = c.getContext('2d');
          cx.fillStyle = '#ffffff';
          cx.fillRect(0, 0, c.width, c.height);
          cx.drawImage(s.img, 0, 0);
          const res = await encodeOut(c, 'image/jpeg', { quality: Math.max(40, Math.min(100, Number(o.quality) || 88)) }, s.file.name, { opaque: true, defaultQuality: 88 });
          if (!res) continue;                           // said by name; the other pages carry on
          page = { bytes: new Uint8Array(await res.blob.arrayBuffer()), width: c.width, height: c.height };
          again++;
        }
        pages.push(page);

        const card = el('div', 'image-card');
        const prev = el('img', 'image-preview');
        prev.src = s.url; prev.alt = s.file.name;
        card.appendChild(prev);
        card.appendChild(el('div', 'image-cap', `Page ${pages.length} · ` +
          (page.colorSpace ? 'JPEG as it is' : 're-encoded at quality ' + (Number(o.quality) || 88))));
        stage.appendChild(card);
      }

      if (!pages.length) { say('No page could be made.', 'error'); return; }
      const pdf = CORE.buildPDF(pages, {
        pageSize: o.pageSize, orientation: o.orientation, margin: Number(o.margin)
      });
      const blob = new Blob([pdf], { type: 'application/pdf' });
      outputs = [{ name: 'images.pdf', blob }];

      const dl = el('button', 'btn-primary', `Download PDF (${pages.length} page${pages.length > 1 ? 's' : ''})`);
      dl.type = 'button';
      dl.addEventListener('click', () => downloadBlob(blob, 'images.pdf'));
      actions.appendChild(dl);

      say(reasons.length ? 'Re-encoded instead of embedded as they are — ' + reasons.join('; ') + '.' : '', reasons.length ? 'note' : undefined);
      const q = Number(o.quality) || 88;
      const how = [];
      if (asIs) how.push(`${asIs} JPEG${asIs > 1 ? 's' : ''} embedded as ${asIs > 1 ? 'they are' : 'it is'}, not re-encoded` +
        (metaOut ? ` (EXIF, GPS and other metadata left out of ${metaOut})` : ''));
      if (again) how.push(`${again} image${again > 1 ? 's' : ''} re-encoded as JPEG at quality ${q}`);
      renderStats([
        ['Pages', String(pages.length)],
        ['PDF size', fmtBytes(blob.size)],
        ['Page size', (o.pageSize || 'a4').toUpperCase()],
        ['Embedding', how.join('; ')]
      ]);
    }

    function addBatchActions() {
      if (outputs.length > 1) {
        const zip = el('button', 'btn-primary', `Download all ${outputs.length} as ZIP`);
        zip.type = 'button';
        zip.addEventListener('click', async () => {
          if (!window.MVRZip) { say('The ZIP writer did not load.', 'error'); return; }
          zip.disabled = true; zip.textContent = 'Packing…';
          try {
            const blob = await window.MVRZip(outputs.map(o2 => ({ name: o2.name, blob: o2.blob })));
            downloadBlob(blob, (spec.id || 'images') + '.zip');
          } finally {
            zip.disabled = false; zip.textContent = `Download all ${outputs.length} as ZIP`;
          }
        });
        actions.appendChild(zip);
        if (typeof window.showDirectoryPicker === 'function') {
          const folder = el('button', 'btn-ghost img-folder', 'Save all to a folder…');
          folder.type = 'button';
          folder.addEventListener('click', () => saveToFolder(outputs.slice()));
          actions.appendChild(folder);
        }
      } else if (outputs.length === 1) {
        const dl = el('button', 'btn-primary', 'Download');
        dl.type = 'button';
        dl.addEventListener('click', () => downloadBlob(outputs[0].blob, outputs[0].name));
        actions.appendChild(dl);
      }
    }
    /* the File System Access API: every result written into a folder the
       visitor picks; a name already there gets " (2)", never overwritten */
    async function saveToFolder(list) {
      let dir;
      try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'mvr-images' }); }
      catch (e) { return; }                              // the picker was closed
      let n = 0;
      try {
        for (const o of list) {
          let name = o.name, k = 1;
          const dot = name.lastIndexOf('.');
          for (;;) {
            try { await dir.getFileHandle(name); k++; name = name.slice(0, dot) + ` (${k})` + name.slice(dot); }
            catch (e) { break; }
          }
          const fh = await dir.getFileHandle(name, { create: true });
          const ws = await fh.createWritable();
          await ws.write(o.blob); await ws.close();
          n++;
        }
        say(`Saved ${n} file${n === 1 ? '' : 's'} to the folder “${dir.name}”.`, 'note');
      } catch (e) {
        say(`Saved ${n} of ${list.length} files to “${dir.name}”, then the browser refused: ${e && e.message ? e.message : e}.`, 'error');
      }
    }

    function renderStats(rows) {
      stats.innerHTML = '';
      (rows || []).forEach(r => {
        const row = el('div', 'stat-row');
        row.appendChild(el('span', 'stat-key', r[0]));
        row.appendChild(el('span', 'stat-val', r[1]));
        stats.appendChild(row);
      });
    }

    /* ---- background removal ----
       Colour keying with a flood fill from the edges, all in this file: no
       model and no other server. Hair, people and busy scenes are the AI
       Background Remover's job (/ai-image/background-remover/), which runs a
       model served from this site on the device. */
    function applyBackgroundRemoval(canvas, ctx, img, o, h) {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      h.size(nw, nh);

      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, nw, nh);
      const px = data.data;

      // reference colours: either a chosen key, or the four corners
      const refs = [];
      if (o.mode === 'colour') {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(o.key || '#ffffff');
        if (m) refs.push([parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]);
      } else {
        [[0, 0], [nw - 1, 0], [0, nh - 1], [nw - 1, nh - 1]].forEach(([x, y]) => {
          const i = (y * nw + x) * 4;
          refs.push([px[i], px[i + 1], px[i + 2]]);
        });
      }
      if (!refs.length) refs.push([255, 255, 255]);

      /* 0 is a real setting (only the exact colour goes), so the default
         applies only when no value was given at all */
      const tv = o.tolerance === undefined || o.tolerance === null || o.tolerance === '' ? NaN : Number(o.tolerance);
      const tol = Number.isFinite(tv) ? Math.max(0, tv) : 32;
      const tol2 = tol * tol * 3;
      const near = (i) => refs.some(r => {
        const dr = px[i] - r[0], dg = px[i + 1] - r[1], db = px[i + 2] - r[2];
        return dr * dr + dg * dg + db * db <= tol2;
      });

      /* Flood fill inward from the edges. Only background connected to the
         border is removed, so a white shirt in the middle of the subject
         survives — which a naive colour-match would delete. */
      const W = nw, H = nh;
      const mask = new Uint8Array(W * H);
      const stack = [];
      for (let x = 0; x < W; x++) { stack.push(x, 0); stack.push(x, H - 1); }
      for (let y = 0; y < H; y++) { stack.push(0, y); stack.push(W - 1, y); }

      while (stack.length) {
        const y = stack.pop(), x = stack.pop();
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const p = y * W + x;
        if (mask[p]) continue;
        if (!near(p * 4)) continue;
        mask[p] = 1;
        stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
      }

      // feather the boundary so the cut does not look traced
      const feather = Math.max(0, Number(o.feather) || 0);
      const alphaOf = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) alphaOf[i] = mask[i] ? 0 : 1;
      for (let pass = 0; pass < feather; pass++) {
        const copy = alphaOf.slice();
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const p = y * W + x;
            alphaOf[p] = (copy[p] * 4 + copy[p - 1] + copy[p + 1] + copy[p - W] + copy[p + W]) / 8;
          }
        }
      }

      const replaceColour = o.replace === 'colour'
        ? (/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(o.bg || '#ffffff') || []).slice(1)
            .map(v => parseInt(v, 16))
        : null;

      let removed = 0;
      for (let i = 0; i < W * H; i++) {
        const a = alphaOf[i];
        if (a >= 0.999) continue;
        removed++;
        const j = i * 4;
        if (replaceColour && replaceColour.length === 3) {
          px[j]     = px[j] * a + replaceColour[0] * (1 - a);
          px[j + 1] = px[j + 1] * a + replaceColour[1] * (1 - a);
          px[j + 2] = px[j + 2] * a + replaceColour[2] * (1 - a);
        } else {
          px[j + 3] = Math.round(px[j + 3] * a);
        }
      }
      ctx.putImageData(data, 0, 0);

      const pct = Math.round(removed / (W * H) * 100);
      if (pct === 0) say('Nothing was removed. Raise the tolerance, or pick the background colour manually.', 'warn');
      else if (pct > 92) say('Almost the whole image was removed. Lower the tolerance.', 'warn');
    }

    /* ---- passport photo: a new background ----
       The person is cut out with MODNet, the portrait-matting model the AI
       Background Remover uses (Apache-2.0, 25 MB), run on this device by the
       shared AI image runtime. Model, runtime and scripts are all served from
       this site and only fetched when "Replace" is chosen; the browser keeps
       them. The matte is worked out once per photo; changing the colour only
       re-composites. */
    let cutToken = 0;
    const matteCache = new WeakMap();                  // source → { alpha, w, h }
    function loadScriptOnce(src) {
      if (document.querySelector('script[data-src="' + src + '"][data-loaded]')) return Promise.resolve();
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.dataset.src = src;
        s.onload = () => { s.dataset.loaded = '1'; res(); };
        s.onerror = () => { s.remove(); rej(new Error('could not load ' + src)); };
        document.head.appendChild(s);
      });
    }
    function matteOf(src) {
      let p = matteCache.get(src);
      if (p) return p;
      const nw = src.img.naturalWidth, nh = src.img.naturalHeight;
      p = (async () => {
        say('Loading the on-device cut-out model (25 MB, from this site, once)…', 'note');
        if (!window.AIImg || !window.AIImg.loadSession) await loadScriptOnce('/engine/aiimg-core.js');
        if (!window.AIImg.matte) await loadScriptOnce('/engine/aiimg-matte.js');
        const work = el('canvas');
        work.width = nw; work.height = nh;
        work.getContext('2d').drawImage(src.img, 0, 0);
        const r = await window.AIImg.matte.run({ canvas: work, width: nw, height: nh }, {
          onProgress: (q) => {
            if (q.stage === 'download') say(`Downloading the cut-out model: ${Math.round((q.fraction || 0) * 100)}% (25 MB, from this site, once)`, 'note');
            else if (q.stage === 'compile') say('Preparing the model…', 'note');
            else if (q.stage === 'run') say('Cutting you out of the background, on this device…', 'note');
          }
        });
        return { alpha: r.alpha, w: nw, h: nh };
      })();
      matteCache.set(src, p);
      p.catch(() => matteCache.delete(src));          // a failure is tried again next time
      return p;
    }
    async function subjectOnColour(src, colour) {
      const nw = src.img.naturalWidth, nh = src.img.naturalHeight;
      let m;
      try { m = await matteOf(src); }
      catch (e) {
        say('The cut-out model could not be loaded' + (e && e.message ? ' (' + e.message + ')' : '') + '. Choose “Keep the photo’s background”, or try again when you are online.', 'error');
        return null;
      }
      const rgb = (/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colour) || [0, 'ff', 'ff', 'ff']).slice(1).map(v => parseInt(v, 16));
      const c = el('canvas');
      c.width = nw; c.height = nh;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(src.img, 0, 0);
      const d = x.getImageData(0, 0, nw, nh);
      const px = d.data, a = m.alpha;
      for (let i = 0, j = 0; i < a.length; i++, j += 4) {
        const k = a[i];
        px[j] = px[j] * k + rgb[0] * (1 - k);
        px[j + 1] = px[j + 1] * k + rgb[1] * (1 - k);
        px[j + 2] = px[j + 2] * k + rgb[2] * (1 - k);
        px[j + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      say('');
      return c;
    }

    /* ---- what a spec's own editor (cropper, meme, redaction…) may use ---- */
    const api = {
      el, fmtBytes, downloadBlob, makeCompare, makeHelpers, buildControl, resample: resampleTo, toCanvas, asSource,
      get sources() { return sources; }, get stage() { return stage; }, get actions() { return actions; },
      get root() { return root; }, get io() { return io; }, get spec() { return spec; },
      readOpts, say, problem, paintMsg, renderStats, run, rerun: () => { doneKey = null; return run(); },
      encodeOut, previewUrl, revokePreviews, addBatchActions, baseName, extOfType, metaPlan, rawPixels,
      setOutputs: (o) => { outputs = o; }, get outputs() { return outputs; },
      setDetach: (f) => { if (detachSelect) detachSelect(); detachSelect = f; },
      stale, progress, subjectOnColour, loadScriptOnce, codecs: Codecs, targetOf, sameFormat, fmtName,
      setLoadNotes: (l) => { loadNotes = l; paintMsg(); }
    };
    if (spec.setup) spec.setup(api);

    /* ---- wiring ---- */
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); }
    });
    ['dragenter', 'dragover'].forEach(ev =>
      drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev =>
      drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', async e => {
      const dt = e.dataTransfer;
      if (!dt) return;
      const list = spec.multiple ? await filesFromDrop(dt) : [...dt.files];
      if (list.length) loadFiles(list, false);
    });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files, false); });
    /* paste from the clipboard anywhere on the page (not into a text box) */
    document.addEventListener('paste', (e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      const files = [...(cd.files || [])].filter(isImage);
      if (!files.length) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type === 'text')) && !files.length) return;
      e.preventDefault();
      const named = files.map((f, k) => f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}${k ? '-' + (k + 1) : ''}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }));
      loadFiles(named, true);
    });
    let debounce = 0;
    const onChange = (e) => {
      showWhen(); remember();
      if (!sources.length) return;
      clearTimeout(debounce);
      /* a slider fires many times a second: wait until it pauses */
      const t = e && e.target && e.target.type;
      if (e && e.type === 'input' && (t === 'range' || t === 'text' || t === 'number')) debounce = setTimeout(run, t === 'range' ? 180 : 350);
      else run();
    };
    opts.addEventListener('input', onChange);
    opts.addEventListener('change', onChange);
  };
})();
