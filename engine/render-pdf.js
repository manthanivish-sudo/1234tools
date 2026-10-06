/**
 * PDF tool renderer.
 *
 * One pipeline for every PDF tool: files in -> parse -> run the spec -> offer
 * downloads. Files never leave the device; parsing and writing both happen in
 * the browser.
 *
 * Since wave 2 the parsing and writing run in a Web Worker (pdf-worker.js),
 * behind the same spec.run() the specs always had: the page stays responsive,
 * a progress bar shows how far a long job has got, and Cancel terminates the
 * worker, which is the only way to stop a synchronous parse part-way. Where a
 * worker cannot start (an old browser, a file:// copy) the same code runs on
 * the page instead.
 *
 * pdf.js is loaded lazily, the first time something has to be drawn: page
 * thumbnails, the click-to-place preview, the live preview of a stamp, the
 * viewer of the output, or a conversion to images.
 *
 * What a spec can declare, beyond controls and run():
 *   pageGrid      { key, mode: 'select' | 'organise' | 'split', marks: 'keep' |
 *                   'remove' | 'mark', rotate, angleKey }  — thumbnails that pick pages
 *   perFilePages  the control holding "1-3 | all | 2,5" (merge): a grid per file
 *   placePreview  click, drag and resize items on the page (text, signature, image)
 *   livePreview   { page } — the real output of one page, re-rendered as you type
 *   mainRun(api)  a run that needs the page itself (pdf.js, a camera, OCR)
 *   mountExtras(api)  a tool's own panel above the controls
 *   workerScripts the spec files the worker needs (default: its own)
 */
(function () {
  'use strict';
  window.MVRTool = window.MVRTool || {};

  /* Where the engine files are, from this script's own URL rather than the
     document's: tool pages sit at /pdf/<slug>/ and the site has been served
     from a subpath before. currentScript is set while a deferred classic
     script runs, which is how this file is loaded. */
  const SELF = document.currentScript || document.querySelector('script[src$="render-pdf.js"]');
  const ENGINE_BASE = new URL('./', SELF ? SELF.src : location.href).href;
  const PDFJS_BASE = ENGINE_BASE + 'vendor/pdfjs/';

  /* Size guards. A browser tab holds a file several times over while it is
     parsed, copied and written, so the ceiling follows the device's memory
     where the browser reports it (Chrome does; Safari and Firefox do not, and
     get the 4 GB assumption). */
  const MEM_GB = Math.max(1, Number(navigator.deviceMemory) || 4);
  const MAX_FILE = Math.min(1024, MEM_GB * 256) * 1048576;
  const MAX_TOTAL = Math.round(MAX_FILE * 1.5);
  const MAX_PAGES = 10000;
  const MAX_CANVAS = 16777216;   /* Safari's canvas ceiling, in pixels */

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const btn = (label, cls, title) => {
    const b = el('button', cls || 'btn-ghost', label);
    b.type = 'button';
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    return b;
  };

  const fmtBytes = (n) => n < 1024 ? n + ' B'
    : n < 1048576 ? (n / 1024).toFixed(1) + ' KB'
    : n < 1073741824 ? (n / 1048576).toFixed(2) + ' MB'
    : (n / 1073741824).toFixed(2) + ' GB';

  /* ---------- names and types ---------- */

  const EXT = {
    'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
    'text/plain': 'txt', 'application/zip': 'zip', 'application/json': 'json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
  };
  const TYPE_OF = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain', zip: 'application/zip', json: 'application/json', docx: EXT_DOCX() };
  function EXT_DOCX() { return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; }
  const typeFromName = (name) => { const m = /\.([a-z0-9]+)$/i.exec(String(name || '')); return m ? TYPE_OF[m[1].toLowerCase()] || '' : ''; };
  /** The name a file is saved under follows what it is, not what was asked for. */
  function nameFor(name, type) {
    const ext = EXT[type];
    if (!ext) return name;
    const m = /\.([a-z0-9]+)$/i.exec(name);
    const have = m ? m[1].toLowerCase() : '';
    if (have === ext || (ext === 'jpg' && have === 'jpeg')) return name;
    return (m ? name.slice(0, -m[0].length) : name) + '.' + ext;
  }
  const stem = (name) => String(name || 'document').replace(/\.pdf$/i, '');

  function download(data, name, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || typeFromName(name) || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url; a.download = nameFor(name, blob.type);
    /* a tool that numbers its documents (the invoice) moves on when one is saved */
    try { document.dispatchEvent(new CustomEvent('pdf:downloaded', { detail: { name: a.download, type: blob.type, size: blob.size } })); } catch (e) { /* old browsers */ }
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------- page ranges ---------- */

  /** "1-3, 7, 5" -> [0, 1, 2, 6, 4]: the order typed, each page once. */
  function orderedPages(core, text, total) {
    const seen = new Set();
    return core.parsePageRange(text, total).filter((i) => !seen.has(i) && seen.add(i));
  }
  /** The inverse: consecutive rising runs collapse, the order is kept. */
  function rangeText(list, total) {
    if (!list.length) return '';
    if (total && list.length === total && list.every((v, i) => v === i)) return 'all';
    const out = [];
    for (let i = 0; i < list.length;) {
      let j = i;
      while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
      out.push(j > i ? (list[i] + 1) + '-' + (list[j] + 1) : String(list[i] + 1));
      i = j + 1;
    }
    return out.join(', ');
  }

  /* ---------- settings kept on this device ---------- */

  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v === null ? null : JSON.parse(v); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };
  /* What is remembered: choices (selects, numbers, colours) and text a spec
     marks as a setting. Never page ranges, never what someone typed as
     content, never a signature: those are about one document, or personal. */
  const remembers = (c) => c.remember === true ||
    (c.remember !== false && (c.type === 'select' || c.type === 'number' || c.type === 'color'));

  /* ---------- pdf.js ---------- */

  let pdfjsMod = null;
  async function loadPdfJs() {
    if (pdfjsMod) return pdfjsMod;
    const mod = await import(PDFJS_BASE + 'pdf.min.mjs');
    mod.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.mjs';
    pdfjsMod = mod;
    return mod;
  }
  async function openWithPdfJs(bytes, password) {
    const lib = await loadPdfJs();
    /* pdf.js hands the buffer to its worker, which detaches it: always a copy */
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return lib.getDocument({
      data: copy, password: password || undefined,
      cMapUrl: PDFJS_BASE + 'cmaps/', cMapPacked: true,
      standardFontDataUrl: PDFJS_BASE + 'standard_fonts/',
      isEvalSupported: false
    }).promise;
  }

  /** A classic script from engine/, once, on demand. */
  const scripts = new Map();
  function loadScript(file) {
    if (!scripts.has(file)) {
      scripts.set(file, new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = new URL(file, ENGINE_BASE).href;
        s.onload = () => resolve();
        s.onerror = () => { scripts.delete(file); reject(new Error(file + ' could not be loaded. Check the connection and try again.')); };
        document.head.appendChild(s);
      }));
    }
    return scripts.get(file);
  }

  /* ---------- the engine: a worker, or the page when there is none ---------- */

  function abortError() {
    const e = new Error('Cancelled');
    e.name = 'AbortError';
    return e;
  }

  function createEngine(spec) {
    const core = window.MVRPdfCore;
    const coreScript = document.querySelector('script[src*="pdfcore.bundle.js"]');
    const coreUrl = coreScript ? coreScript.src : ENGINE_BASE + 'pdfcore.bundle.js';
    const scripts = (spec.workerScripts || ['pdf-' + spec.id + '.js'])
      .map((s) => new URL(s, ENGINE_BASE).href);

    let worker = null, ready = null, seq = 0;
    let onPage = !(typeof Worker === 'function') || location.protocol === 'file:';
    const pending = new Map();      /* id -> { resolve, reject, progress } */
    const inWorker = new Set();     /* fileIds the current worker holds */
    const local = new Map();        /* fileId -> parsed doc, when running on the page */

    function start() {
      if (ready) return ready;
      ready = new Promise((resolve) => {
        let w;
        try { w = new Worker(ENGINE_BASE + 'pdf-worker.js'); }
        catch (e) { onPage = true; resolve(false); return; }
        const t = setTimeout(() => { try { w.terminate(); } catch (e) { /* */ } onPage = true; resolve(false); }, 15000);
        w.onmessage = (ev) => {
          const m = ev.data || {};
          if (m.type === 'ready') { clearTimeout(t); worker = w; resolve(true); return; }
          if (m.type === 'fatal') { clearTimeout(t); try { w.terminate(); } catch (e) { /* */ } onPage = true; resolve(false); return; }
          const p = pending.get(m.id);
          if (m.type === 'progress') { if (p && p.progress) p.progress(m.done, m.total, m.label); return; }
          if (m.type === 'error' && (m.id === null || m.id === undefined)) {
            /* a crash outside any one job: everything waiting on it fails */
            for (const [k, q] of pending) { pending.delete(k); const e = new Error(m.message); e.code = m.code; q.reject(e); }
            return;
          }
          if (!p) return;
          pending.delete(m.id);
          if (m.type === 'error') { const e = new Error(m.message); e.code = m.code; p.reject(e); }
          else p.resolve(m);
        };
        w.onerror = (ev) => {
          if (!worker) { clearTimeout(t); onPage = true; resolve(false); return; }
          for (const [k, q] of pending) { pending.delete(k); q.reject(new Error(ev.message || 'The PDF engine stopped.')); }
        };
        w.postMessage({ type: 'init', core: coreUrl, scripts });
      });
      return ready;
    }

    function send(msg, transfer, progress) {
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, progress });
        worker.postMessage(Object.assign({ id }, msg), transfer || []);
      });
    }

    async function load(entry) {
      if (!onPage) await start();
      if (onPage) {
        const doc = await core.PDFDocument.load(entry.bytes, { password: entry.password || '' });
        local.set(entry.id, doc);
        return { pages: await doc.pageCount(), security: doc.security || null };
      }
      const copy = entry.bytes.slice();
      const m = await send({ type: 'load', fileId: entry.id, name: entry.name, bytes: copy.buffer, password: entry.password || '' }, [copy.buffer]);
      inWorker.add(entry.id);
      return { pages: m.pages, security: m.security };
    }

    function drop(entry) {
      local.delete(entry.id);
      if (worker && inWorker.has(entry.id)) { worker.postMessage({ type: 'drop', fileId: entry.id }); inWorker.delete(entry.id); }
    }

    async function run({ entries, opts, text, preview, progress, specId }) {
      if (!onPage) await start();
      if (onPage) {
        core.setProgress && core.setProgress(progress || null);
        core.setPreview && core.setPreview(preview || null);
        try {
          const docs = [];
          for (const e of entries || []) {
            if (!local.has(e.id)) await load(e);
            docs.push({ doc: local.get(e.id), name: e.name, size: e.size, pages: e.pages, fileId: e.id });
          }
          const s = (window.PDF_TOOLS || {})[specId || spec.id] || spec;
          return await s.run({ docs, opts, core, text: text || '', preview: preview || null, progress: progress || (() => {}) });
        } finally {
          core.setProgress && core.setProgress(null);
          core.setPreview && core.setPreview(null);
        }
      }
      /* a worker restarted by a Cancel has forgotten the files: send them again */
      for (const e of entries || []) if (!inWorker.has(e.id)) await load(e);
      const m = await send({
        type: 'run', specId: specId || spec.id, opts,
        files: (entries || []).map((e) => ({ fileId: e.id, name: e.name })),
        text: text || '', preview: preview || null
      }, [], progress);
      return m.result;
    }

    /** One core function in the worker (compression, protection …). */
    async function call(fn, args, progress) {
      if (!onPage) await start();
      if (onPage) {
        core.setProgress && core.setProgress(progress || null);
        try { return await core[fn].apply(null, args || []); }
        finally { core.setProgress && core.setProgress(null); }
      }
      return (await send({ type: 'call', fn, args }, [], progress)).result.data;
    }

    /** Stop whatever is running, now. */
    function cancel() {
      const was = worker;
      worker = null; ready = null;
      inWorker.clear();
      if (was) { try { was.terminate(); } catch (e) { /* */ } }
      for (const [k, q] of pending) { pending.delete(k); q.reject(abortError()); }
    }

    return { load, drop, run, call, cancel, get onPage() { return onPage; } };
  }

  /* ---------- controls ---------- */

  function buildControl(c) {
    const wrap = el('div', 'field' + (c.wide ? ' field-wide' : ''));
    const id = 'pc-' + c.key;
    const label = el('label', null, c.label);
    label.setAttribute('for', id);
    wrap.appendChild(label);

    let read, primary = null, setter = null;
    if (c.type === 'select') {
      const s = el('select', 'control');
      s.id = id; s.name = c.key;
      (c.options || []).forEach((o) => {
        const opt = el('option', null, o.label);
        opt.value = o.value;
        if (String(o.value) === String(c.default)) opt.selected = true;
        s.appendChild(opt);
      });
      wrap.appendChild(s);
      primary = s;
      read = () => s.value;
    } else if (c.type === 'textarea') {
      const t = el('textarea', 'control');
      t.id = id; t.name = c.key; t.rows = c.rows || 4; t.value = c.default || '';
      if (c.placeholder) t.placeholder = c.placeholder;
      wrap.appendChild(t);
      primary = t;
      read = () => t.value;
    } else if (c.type === 'color') {
      const row = el('div', 'colour-field');
      const sw = el('input', 'colour-swatch');
      sw.type = 'color'; sw.value = c.default;
      sw.setAttribute('aria-label', c.label + ' picker');
      const hex = el('input', 'control colour-hex');
      hex.type = 'text'; hex.id = id; hex.name = c.key; hex.value = c.default; hex.spellcheck = false;
      sw.addEventListener('input', () => { hex.value = sw.value; hex.dispatchEvent(new Event('input', { bubbles: true })); });
      hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) sw.value = hex.value; });
      row.appendChild(sw); row.appendChild(hex);
      wrap.appendChild(row);
      primary = hex;
      read = () => hex.value;
    } else if (c.type === 'draw') {
      /* A drawing pad. Strokes are kept as points in the pad's own 360 x 120
         units (y down) whatever size it is shown at, and handed to the spec
         as { w, h, strokes }, which turns them into vector paths. Pointer
         events cover mouse, pen and touch alike; touch-action none keeps a
         finger from scrolling the page instead of drawing. */
      const PW = 360, PH = 120;
      const box = el('div', 'draw-pad');
      const cv = el('canvas', 'draw-canvas');
      cv.id = id;
      cv.width = PW * 2; cv.height = PH * 2;
      cv.style.touchAction = 'none';
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', c.label + ': draw with a mouse, a pen or a finger. The typed signature box is the keyboard alternative.');
      const clear = btn('Clear', 'btn-ghost draw-clear');
      clear.title = 'Clear the drawing';
      box.appendChild(cv);
      box.appendChild(clear);
      wrap.appendChild(box);
      const strokes = [];
      let cur = null;
      const ctx = cv.getContext('2d');
      const paint = () => {
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = '#d0d4dc';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(20, PH * 2 - 30); ctx.lineTo(PW * 2 - 20, PH * 2 - 30); ctx.stroke();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        strokes.forEach((s) => {
          ctx.beginPath();
          ctx.moveTo(s[0][0] * 2, s[0][1] * 2);
          (s.length === 1 ? s : s.slice(1)).forEach((p) => ctx.lineTo(p[0] * 2 + (s.length === 1 ? 0.01 : 0), p[1] * 2));
          ctx.stroke();
        });
      };
      const at = (ev) => {
        const r = cv.getBoundingClientRect();
        const x = (ev.clientX - r.left) * PW / (r.width || PW);
        const y = (ev.clientY - r.top) * PH / (r.height || PH);
        return [Math.round(Math.max(0, Math.min(PW, x)) * 10) / 10, Math.round(Math.max(0, Math.min(PH, y)) * 10) / 10];
      };
      const changed = () => cv.dispatchEvent(new Event('input', { bubbles: true }));
      cv.addEventListener('pointerdown', (ev) => {
        if (ev.button !== undefined && ev.button > 0) return;
        ev.preventDefault();
        try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic events */ }
        cur = [at(ev)];
        strokes.push(cur);
        paint();
      });
      cv.addEventListener('pointermove', (ev) => {
        if (!cur) return;
        const p = at(ev), last = cur[cur.length - 1];
        if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 1) return;
        cur.push(p);
        paint();
      });
      const end = () => { if (!cur) return; cur = null; changed(); };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      clear.addEventListener('click', () => { strokes.length = 0; cur = null; paint(); changed(); });
      paint();
      primary = cv;
      read = () => strokes.length ? { w: PW, h: PH, strokes: strokes.map((s) => s.map((p) => p.slice())) } : null;
      setter = (v) => {
        strokes.length = 0;
        if (v && Array.isArray(v.strokes)) v.strokes.forEach((s) => strokes.push(s.map((p) => p.slice())));
        paint(); changed();
      };
    } else if (c.type === 'image') {
      /* A picture, read on the device: a JPEG goes in as its own bytes (the
         PDF's DCTDecode filter) unless it has to be turned or is CMYK; any
         other picture becomes raw pixels with its transparency kept, which
         the spec compresses into the PDF. */
      const box = el('div', 'image-pick');
      const input = el('input', 'visually-hidden');
      input.type = 'file'; input.accept = c.accept || 'image/png,image/jpeg,image/webp,image/gif';
      input.id = id;
      const pick = btn(c.button || 'Choose an image', 'btn-ghost image-pick-btn');
      const thumb = el('img', 'image-pick-thumb'); thumb.alt = ''; thumb.hidden = true;
      const note = el('span', 'field-hint image-pick-note', c.hint || 'PNG, JPEG, WebP or GIF; nothing is uploaded');
      const rm = btn('×', 'btn-ghost', 'Remove the image'); rm.hidden = true;
      box.appendChild(pick); box.appendChild(thumb); box.appendChild(rm); box.appendChild(input);
      wrap.appendChild(box); wrap.appendChild(note);
      let value = null;
      const changed = () => input.dispatchEvent(new Event('input', { bubbles: true }));
      const show = () => {
        thumb.hidden = !value; rm.hidden = !value;
        if (value) { thumb.src = value.preview; note.textContent = value.name + ' · ' + value.width + ' × ' + value.height + ' px'; }
        else note.textContent = c.hint || 'PNG, JPEG, WebP or GIF; nothing is uploaded';
      };
      pick.addEventListener('click', () => input.click());
      input.addEventListener('change', async () => {
        const f = input.files && input.files[0];
        if (!f) return;
        try { value = await readImage(f, c.maxSide || 2400); }
        catch (e) { value = null; note.textContent = f.name + ': ' + (e.message || 'could not be read as an image'); return; }
        input.value = '';
        show(); changed();
      });
      rm.addEventListener('click', () => { value = null; show(); changed(); });
      primary = input;
      read = () => value;
      setter = (v) => { value = v || null; show(); changed(); };
      if (c.hint) { /* the hint is the note */ }
      return { wrap, read, key: c.key, input: primary, set: setter, control: c };
    } else if (c.type === 'date') {
      const i = el('input', 'control');
      i.type = 'date'; i.id = id; i.name = c.key;
      i.value = c.default === 'TODAY' ? new Date().toISOString().slice(0, 10) : (c.default || '');
      wrap.appendChild(i);
      primary = i;
      read = () => i.value;
    } else if (c.type === 'number') {
      const i = el('input', 'control');
      i.type = 'number'; i.id = id; i.name = c.key; i.inputMode = 'decimal';
      if (c.min !== undefined) i.min = c.min;
      if (c.max !== undefined) i.max = c.max;
      if (c.step !== undefined) i.step = c.step;
      i.value = c.default;
      wrap.appendChild(i);
      primary = i;
      read = () => i.value;
    } else if (c.type === 'password') {
      const i = el('input', 'control');
      i.type = 'password'; i.id = id; i.name = c.key; i.autocomplete = 'new-password'; i.value = '';
      wrap.appendChild(i);
      primary = i;
      read = () => i.value;
    } else if (c.type === 'checkbox') {
      wrap.className += ' field-check';
      const i = el('input', 'control-check');
      i.type = 'checkbox'; i.id = id; i.name = c.key; i.checked = !!c.default;
      wrap.insertBefore(i, label);
      primary = i;
      read = () => i.checked;
      setter = (v) => { i.checked = v === true || v === 'true'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); };
    } else {
      const i = el('input', 'control');
      i.type = 'text'; i.id = id; i.name = c.key; i.value = c.default || '';
      if (c.hint) i.placeholder = c.hint;
      wrap.appendChild(i);
      primary = i;
      read = () => i.value;
    }
    if (c.hint && c.type !== 'image') wrap.appendChild(el('span', 'field-hint', c.hint));
    return {
      wrap, read, key: c.key, input: primary, control: c,
      set: setter || ((v) => {
        if (!primary) return;
        primary.value = v;
        primary.dispatchEvent(new Event('input', { bubbles: true }));
      })
    };
  }

  /** Decode a picture on the device into something a PDF can hold. */
  async function readImage(file, maxSide) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    let bmp;
    try { bmp = await createImageBitmap(new Blob([bytes], { type: file.type || 'image/*' })); }
    catch (e) { throw new Error('this browser could not read it as a picture'); }
    const W = bmp.width, H = bmp.height;
    const preview = await thumbUrl(bmp);
    if (isJpeg) {
      const sof = jpegInfo(bytes);
      /* the JPEG's own bytes, untouched, when nothing has to change: the
         stored size is the shown size (no EXIF turn) and it is grey or RGB */
      if (sof && sof.width === W && sof.height === H && (sof.components === 1 || sof.components === 3) && Math.max(W, H) <= Math.max(maxSide, 6000)) {
        bmp.close && bmp.close();
        return { kind: 'jpeg', name: file.name, bytes, width: W, height: H, components: sof.components, preview };
      }
    }
    const s = Math.min(1, maxSide / Math.max(W, H));
    const w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
    const cv = el('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    const d = ctx.getImageData(0, 0, w, h).data;
    const rgb = new Uint8Array(w * h * 3);
    let alpha = null;
    for (let i = 0, j = 0, k = 0; i < d.length; i += 4, j += 3, k++) {
      rgb[j] = d[i]; rgb[j + 1] = d[i + 1]; rgb[j + 2] = d[i + 2];
      if (d[i + 3] !== 255) {
        if (!alpha) { alpha = new Uint8Array(w * h); alpha.fill(255, 0, k); }
      }
      if (alpha) alpha[k] = d[i + 3];
    }
    return { kind: 'raw', name: file.name, width: w, height: h, rgb, alpha, preview };
  }
  /** Width, height and component count from a JPEG's frame header. */
  function jpegInfo(b) {
    let p = 2;
    while (p + 9 < b.length) {
      if (b[p] !== 0xff) { p++; continue; }
      const m = b[p + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; }
      const len = (b[p + 2] << 8) | b[p + 3];
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { height: (b[p + 5] << 8) | b[p + 6], width: (b[p + 7] << 8) | b[p + 8], components: b[p + 9] };
      }
      p += 2 + len;
    }
    return null;
  }
  async function thumbUrl(bmp) {
    const s = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
    const cv = el('canvas'); cv.width = Math.max(1, Math.round(bmp.width * s)); cv.height = Math.max(1, Math.round(bmp.height * s));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/png');
  }

  /* ================================================================== */
  /* mount                                                               */
  /* ================================================================== */

  window.MVRTool.mountPDF = function (spec, root) {
    const io = root.querySelector('.tool-io');
    const core = window.MVRPdfCore;
    const needsFiles = spec.files === true || (spec.kind !== 'create' && spec.files !== false);
    const engine = createEngine(spec);
    if (core && core.unicodeFonts) core.unicodeFonts.setFontBase(ENGINE_BASE);
    const KEY = '1234tools-pdf-' + spec.id + '-v1';

    let drop = null, fileInput = null;
    const fileList = el('div', 'file-list');
    const extras = el('div', 'pdf-extras');
    const opts = el('div', 'opt-bar');
    const gridHost = el('div', 'pdf-grid-host');
    const textPane = el('div', 'io-pane');
    const msg = el('div', 'io-msg');
    const results = el('div', 'pdf-results');
    const actions = el('div', 'io-actions pdf-actions');
    const stats = el('div', 'stat-grid');
    const report = el('pre', 'code-out');
    report.hidden = true;
    msg.setAttribute('role', 'status');

    const accepts = spec.accept || 'application/pdf,.pdf';
    const isAccepted = (f) => spec.acceptTest ? spec.acceptTest(f) : (/\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    const noun = spec.fileNoun || (spec.multiple ? 'PDF files' : 'a PDF');
    const dropIdle = () => '<strong>Choose ' + noun + '</strong><span>or drag ' + (spec.multiple ? 'them' : 'it') + ' here — nothing is uploaded</span>';

    if (needsFiles) {
      drop = el('div', 'dropzone');
      drop.tabIndex = 0;
      drop.setAttribute('role', 'button');
      drop.innerHTML = dropIdle();
      fileInput = el('input', 'visually-hidden');
      fileInput.type = 'file';
      fileInput.accept = accepts;
      if (spec.multiple) fileInput.multiple = true;
      if (spec.capture) fileInput.setAttribute('capture', spec.capture);
      drop.appendChild(fileInput);
      io.appendChild(drop);
      io.appendChild(fileList);
    }

    let textArea = null;
    if (spec.kind === 'create' && spec.inputLabel) {
      const head = el('div', 'io-head');
      head.appendChild(el('span', 'io-label', spec.inputLabel));
      textArea = el('textarea', 'code-area');
      textArea.rows = 10;
      textArea.spellcheck = false;
      textArea.placeholder = 'Type or paste your text here…';
      textPane.appendChild(head);
      textPane.appendChild(textArea);
      io.appendChild(textPane);
    }

    io.appendChild(extras);
    extras.hidden = true;

    const place = el('div', 'place-preview');
    place.hidden = true;
    if (spec.placePreview) io.appendChild(place);
    const live = el('div', 'place-preview live-preview');
    live.hidden = true;
    if (spec.livePreview) io.appendChild(live);
    const crop = el('div', 'place-preview crop-preview');
    crop.hidden = true;
    if (spec.cropEditor) io.appendChild(crop);

    const readers = (spec.controls || []).map((c) => {
      const b = buildControl(c);
      opts.appendChild(b.wrap);
      return b;
    });
    if (readers.length) io.appendChild(opts);
    const reader = (key) => readers.find((r) => r.key === key);
    io.appendChild(gridHost);

    /* ---------- settings kept on this device ---------- */
    const remembered = readers.filter((r) => remembers(r.control));
    (function restore() {
      const saved = store.get(KEY);
      if (!saved || typeof saved !== 'object' || !remembered.length) return;
      let n = 0;
      remembered.forEach((r) => {
        if (saved[r.key] === undefined) return;
        const c = r.control;
        if (c.type === 'select' && !(c.options || []).some((o) => String(o.value) === String(saved[r.key]))) return;
        r.set(saved[r.key]); n++;
      });
      if (!n) return;
      const note = el('p', 'pdf-remembered');
      note.appendChild(document.createTextNode('Your settings from last time are back. '));
      const reset = btn('Reset to the defaults', 'btn-link');
      reset.addEventListener('click', () => {
        store.del(KEY);
        remembered.forEach((r) => r.set(r.control.default === 'TODAY' ? new Date().toISOString().slice(0, 10) : r.control.default));
        note.remove();
      });
      note.appendChild(reset);
      opts.appendChild(note);
    })();
    let saveTimer = null;
    opts.addEventListener('input', () => {
      if (!remembered.length) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const o = {};
        remembered.forEach((r) => { o[r.key] = r.read(); });
        store.set(KEY, o);
      }, 300);
    });
    opts.addEventListener('change', () => opts.dispatchEvent(new Event('input')));

    /* ---------- banked items ---------- */
    const P = spec.placePreview || null;
    const itemised = !!(P && P.items);
    const saved = [];
    const itemsPanel = el('div', 'place-items');
    if (itemised) {
      const bank = btn(P.bankLabel || 'Add as another item', 'btn-ghost place-items-add');
      bank.title = 'Keep this one where it is and start another';
      bank.addEventListener('click', () => {
        const cur = currentItem();
        if (!hasContent(cur)) { say(P.emptyMessage || 'Type the text first, then add it as an item.', 'note'); reveal(msg); return; }
        saved.push(cur);
        clearCurrent();
        say('');
        renderItems();
        drawPlace();
        const t2 = P.text && reader(P.text);
        if (t2 && t2.input) t2.input.focus();
      });
      const bar = el('div', 'place-items-bar');
      bar.appendChild(bank);
      bar.appendChild(el('span', 'place-items-hint', P.bankHint ||
        'The text above is one item. Bank it to place another somewhere else, on any page.'));
      itemsPanel.appendChild(bar);
      itemsPanel.appendChild(el('ol', 'place-items-list'));
      io.appendChild(itemsPanel);
    }

    const val = (k, d) => {
      if (k === undefined || k === null) return d;
      if (typeof k !== 'string') return k;
      const r = reader(k);
      return r ? r.read() : d;
    };
    /** The controls as one item, in the roles the placement editor knows. */
    function currentItem() {
      if (!P) return null;
      const it = {
        text: String(val(P.text, '') || ''),
        size: Math.max(4, Number(val(P.size, 12)) || 12),
        colour: /^#[0-9a-f]{6}$/i.test(String(val(P.colour, '#000000'))) ? val(P.colour, '#000000') : '#000000',
        x: Number(val(P.x, 0)) || 0,
        y: Number(val(P.y, 0)) || 0,
        width: Math.max(0, Number(val(P.width, 0)) || 0),
        pages: String(val(P.page, '1') || '1')
      };
      if (P.drawing) { it.drawn = val(P.drawing, null); it.drawWidth = Number(val(P.drawingWidth, 150)) || 150; }
      if (P.date) it.date = val(P.date, 'no');
      if (P.image) { it.image = val(P.image, null); it.imageWidth = Math.max(4, Number(val(P.imageWidth, 150)) || 150); }
      if (P.opacity) it.opacity = Number(val(P.opacity, 100));
      return it;
    }
    const hasContent = (it) => !!(it && ((it.text && it.text.trim()) || (it.drawn && it.drawn.strokes && it.drawn.strokes.length) || it.image));
    function setRole(role, v) { const k = P && P[role]; const r = typeof k === 'string' && reader(k); if (r) r.set(v); }
    function clearCurrent() {
      setRole('text', '');
      if (P.drawing) setRole('drawing', null);
      if (P.image) setRole('image', null);
    }
    function loadItem(it) {
      setRole('text', it.text); setRole('size', it.size); setRole('colour', it.colour);
      setRole('x', it.x); setRole('y', it.y); setRole('width', it.width); setRole('page', it.pages);
      if (P.drawing) { setRole('drawing', it.drawn || null); setRole('drawingWidth', it.drawWidth); }
      if (P.date) setRole('date', it.date);
      if (P.image) { setRole('image', it.image || null); setRole('imageWidth', it.imageWidth); }
      if (P.opacity) setRole('opacity', it.opacity);
    }
    function itemLabel(it) {
      const first = String(it.text || '').split('\n')[0];
      if (first.trim()) return first.length > 40 ? first.slice(0, 40) + '…' : first;
      if (it.image) return 'Image: ' + (it.image.name || 'picture');
      if (it.drawn) return 'Drawn signature';
      return '(empty)';
    }

    function renderItems() {
      if (!itemised) return;
      const list = itemsPanel.querySelector('.place-items-list');
      list.innerHTML = '';
      if (!saved.length) { list.appendChild(el('li', 'place-items-empty', 'Nothing banked yet.')); return; }
      saved.forEach((it, i) => {
        const li = el('li', 'place-item');
        const swatch = el('span', 'place-item-swatch');
        swatch.style.background = it.colour;
        li.appendChild(swatch);
        const label = el('span', 'place-item-label');
        label.appendChild(el('strong', null, itemLabel(it)));
        label.appendChild(el('span', 'place-item-meta',
          'page ' + it.pages + ' · ' + Math.round(it.x) + ', ' + Math.round(it.y) +
          (it.image ? ' · ' + Math.round(it.imageWidth) + ' pt wide' : ' · ' + Math.round(it.size * 10) / 10 + ' pt') +
          (it.width ? ' · wrap ' + Math.round(it.width) : '')));
        li.appendChild(label);
        const edit = btn('Edit', 'btn-ghost'); edit.title = 'Put this item back in the controls';
        edit.addEventListener('click', () => editItem(i));
        const rm = btn('×', 'btn-ghost', 'Remove this item');
        rm.addEventListener('click', () => { saved.splice(i, 1); renderItems(); drawPlace(); });
        li.appendChild(edit);
        li.appendChild(rm);
        list.appendChild(li);
      });
    }
    /** Make a banked item the one being edited; the one being edited is banked, so nothing is lost. */
    function editItem(i) {
      const it = saved.splice(i, 1)[0];
      const cur = currentItem();
      if (hasContent(cur)) saved.push(cur);
      loadItem(it);
      renderItems();
      const r = P.page && reader(P.page);
      if (r && r.input) r.input.dispatchEvent(new Event('change', { bubbles: true }));
      drawPlace();
    }
    renderItems();

    /* ---------- run bar, progress, results ---------- */
    const runBar = el('div', 'io-actions pdf-run');
    const runBtn = btn(spec.action || (spec.kind === 'inspect' ? 'Inspect' : spec.kind === 'create' ? 'Create PDF' : 'Process'), 'btn-primary');
    runBar.appendChild(runBtn);
    io.appendChild(runBar);

    const prog = el('div', 'pdf-progress');
    prog.hidden = true;
    prog.setAttribute('role', 'status');
    const progBar = el('div', 'pdf-progress-bar');
    const progFill = el('span');
    progBar.appendChild(progFill);
    const progLabel = el('span', 'pdf-progress-label');
    const progCancel = btn('Cancel', 'btn-ghost pdf-progress-cancel');
    prog.appendChild(progBar); prog.appendChild(progLabel); prog.appendChild(progCancel);
    io.appendChild(prog);

    const summary = el('div', 'pdf-summary');
    const viewer = el('div', 'pdf-view');
    summary.hidden = true;
    viewer.hidden = true;

    io.appendChild(msg);
    io.appendChild(report);
    io.appendChild(summary);
    io.appendChild(viewer);
    io.appendChild(results);
    io.appendChild(actions);
    io.appendChild(stats);

    const say = (text, kind) => {
      msg.textContent = text || '';
      msg.className = 'io-msg' + (kind ? ' is-' + kind : '');
    };

    /* ---------- the files ---------- */
    let entries = [];
    let nextId = 1;
    const ready = () => entries.filter((e) => e.state === 'ready');

    /** Every option the spec reads, including what the grids and the placement editor hold. */
    const readOpts = () => {
      const o = {};
      readers.forEach((r) => { o[r.key] = r.read(); });
      if (itemised) o[P.items] = saved.map((it) => Object.assign({}, it));
      if (grid && grid.turns && Object.keys(grid.turns).length) o.turns = Object.assign({}, grid.turns);
      if (grid && spec.pageGrid && spec.pageGrid.mode === 'organise') o.layout = grid.layout();
      return o;
    };

    async function loadFiles(list) {
      const files = [...list];
      if (!files.length) return;
      const bad = files.filter((f) => !isAccepted(f));
      const good = files.filter((f) => isAccepted(f));
      if (!good.length) { say(spec.wrongType || ('Those are not PDF files: ' + bad.map((f) => f.name).join(', ') + '.'), 'error'); return; }
      const take = spec.multiple ? good : good.slice(0, 1);
      if (!spec.multiple) { entries.forEach((e) => engine.drop(e)); entries = []; resetGrid(); }

      /* the guard comes first, so a 3 GB file is turned away in a moment
         rather than freezing the tab while it is read */
      const notes = [];
      if (bad.length) notes.push('Left out, not ' + (spec.fileKind || 'PDF') + ': ' + bad.map((f) => f.name).join(', ') + '.');
      let total = entries.reduce((n, e) => n + e.size, 0);
      const fresh = [];
      for (const f of take) {
        const e = { id: nextId++, name: f.name, size: f.size, file: f, bytes: null, pages: 0, state: 'loading', password: '', security: null, error: '', range: null };
        if (f.size > MAX_FILE) {
          e.state = 'error';
          e.error = 'At ' + fmtBytes(f.size) + ' this is more than a browser tab can safely work on here (the limit on this device is ' + fmtBytes(MAX_FILE) + '). Split it in the program it came from, or use a computer with more memory.';
        } else if (total + f.size > MAX_TOTAL) {
          e.state = 'error';
          e.error = 'Together with the files above this comes to ' + fmtBytes(total + f.size) + ', more than this device can hold at once (' + fmtBytes(MAX_TOTAL) + '). Merge in two rounds.';
        } else total += f.size;
        entries.push(e);
        fresh.push(e);
      }
      renderFileList();
      say(notes.join(' '), notes.length ? 'warn' : '');

      for (const e of fresh) {
        if (e.state !== 'loading') continue;
        await openEntry(e);
      }
      renderFileList();
      afterFilesChanged();
    }

    async function openEntry(e) {
      e.state = 'loading';
      renderFileList();
      try {
        if (!e.bytes) e.bytes = new Uint8Array(await e.file.arrayBuffer());
        if (spec.loadAs === 'image') { e.state = 'ready'; return; }
        const info = await engine.load(e);
        if (info.pages > MAX_PAGES && !spec.manyPages) {
          e.state = 'error';
          e.error = info.pages.toLocaleString('en-GB') + ' pages is more than these tools work on in one go (' + MAX_PAGES.toLocaleString('en-GB') + '). Split it first with Split PDF.';
          engine.drop(e);
          return;
        }
        e.pages = info.pages;
        e.security = info.security;
        e.state = 'ready';
        e.error = '';
      } catch (err) {
        if (err && err.code === 'password') {
          e.state = 'locked';
          e.error = e.password ? 'That password did not open it. Check the capitals and try again.' : '';
        } else {
          e.state = 'error';
          e.error = (err && err.message) || 'This file could not be read.';
        }
      }
    }

    function afterFilesChanged() {
      const r = ready();
      if (drop) {
        if (!entries.length) drop.innerHTML = dropIdle();
        else drop.innerHTML = '<strong>' + (entries.length === 1 ? escapeHtml(entries[0].name) : entries.length + ' files') +
          '</strong><span>click to ' + (spec.multiple ? 'add more' : 'choose another') + '</span>';
        drop.appendChild(fileInput);
      }
      if (!r.length) {
        clearOutputs();
        if (P) { place.hidden = true; place.innerHTML = ''; placeDoc = null; }
        if (spec.livePreview) { live.hidden = true; live.innerHTML = ''; }
        if (spec.cropEditor) { crop.hidden = true; crop.innerHTML = ''; }
        resetGrid();
        updateSticky();
        return;
      }
      if (spec.pageGrid) mountGrid();
      if (P) paintPlace();
      if (spec.livePreview) paintLive();
      if (spec.cropEditor) paintCrop();
      if (spec.onFiles) { try { spec.onFiles(api()); } catch (e) { /* a spec hook must not stop the page */ } }
      if (spec.kind === 'inspect') run();
      updateSticky();
    }

    const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    function clearOutputs() {
      results.innerHTML = ''; actions.innerHTML = ''; stats.innerHTML = '';
      report.hidden = true;
      clearResult();
    }

    /* ----- the file list: per-file state, a password box, reordering ----- */
    let rowDrag = null;
    function renderFileList() {
      fileList.innerHTML = '';
      if (!entries.length) return;
      entries.forEach((d, i) => {
        const row = el('div', 'file-row' + (d.state !== 'ready' ? ' is-' + d.state : ''));
        row.dataset.pos = String(i);
        if (spec.multiple && entries.length > 1) {
          const grip = el('span', 'file-grip', '⠿');
          grip.title = 'Drag to change the order';
          grip.setAttribute('aria-hidden', 'true');
          row.appendChild(grip);
        }
        row.appendChild(el('span', 'file-idx', String(i + 1)));
        row.appendChild(el('span', 'file-name', d.name));
        const meta = d.state === 'ready'
          ? (d.pages ? d.pages + ' page' + (d.pages === 1 ? '' : 's') + ' · ' : '') + fmtBytes(d.size) + (d.security ? (d.security.openedWith === 'empty' ? ' · restricted, opened without a password' : ' · opened with its password') : '')
          : d.state === 'loading' ? 'Reading…'
          : d.state === 'locked' ? 'Password-protected'
          : 'Not opened';
        row.appendChild(el('span', 'file-meta', meta));
        if (spec.multiple && entries.length > 1) {
          const up = btn('↑', 'btn-ghost'); up.title = 'Move up';
          up.setAttribute('aria-label', 'Move up, ' + d.name);
          up.addEventListener('click', () => moveEntry(i, i - 1, 'up'));
          const dn = btn('↓', 'btn-ghost'); dn.title = 'Move down';
          dn.setAttribute('aria-label', 'Move down, ' + d.name);
          dn.addEventListener('click', () => moveEntry(i, i + 1, 'down'));
          if (i === 0) up.disabled = true;
          if (i === entries.length - 1) dn.disabled = true;
          row.appendChild(up); row.appendChild(dn);
        }
        if (spec.perFilePages && d.state === 'ready') {
          const pick = btn('Pages: ' + (d.range || 'all'), 'btn-ghost file-pages-btn');
          pick.title = 'Choose which pages of this file to take';
          pick.setAttribute('aria-expanded', d.open ? 'true' : 'false');
          pick.addEventListener('click', () => { d.open = !d.open; renderFileList(); });
          row.appendChild(pick);
        }
        const rm = btn('×', 'btn-ghost'); rm.title = 'Remove';
        rm.setAttribute('aria-label', 'Remove ' + d.name);
        rm.addEventListener('click', () => {
          engine.drop(d);
          if (d.pdfjs) d.pdfjs.then((x) => x.destroy && x.destroy()).catch(() => {});
          entries.splice(i, 1);
          syncRangesFromEntries();
          renderFileList();
          afterFilesChanged();
        });
        row.appendChild(rm);
        fileList.appendChild(row);

        if (d.state === 'locked') fileList.appendChild(passwordRow(d));
        if (d.state === 'error' && d.error) {
          const er = el('div', 'file-error io-msg is-error', d.name + ': ' + d.error);
          fileList.appendChild(er);
        }
        if (spec.perFilePages && d.open && d.state === 'ready') fileList.appendChild(fileGrid(d));
      });
    }

    function passwordRow(d) {
      const box = el('form', 'file-pass');
      box.noValidate = true;
      const id = 'pw-' + d.id;
      const lab = el('label', null, d.name + ' needs its password to open. It is used here, on this device, and not kept.');
      lab.setAttribute('for', id);
      const inp = el('input', 'control');
      inp.type = 'password'; inp.id = id; inp.autocomplete = 'off';
      const go = btn('Open', 'btn-primary');
      go.type = 'submit';
      box.appendChild(lab);
      const row = el('div', 'file-pass-row');
      row.appendChild(inp); row.appendChild(go);
      box.appendChild(row);
      if (d.error) box.appendChild(el('p', 'io-msg is-error', d.error));
      box.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!inp.value) { inp.focus(); return; }
        d.password = inp.value;
        go.disabled = true;
        await openEntry(d);
        renderFileList();
        if (d.state === 'locked') {
          const again = fileList.querySelector('#pw-' + d.id);
          if (again) again.focus();
        }
        afterFilesChanged();
      });
      setTimeout(() => { if (document.activeElement === document.body || !document.activeElement) inp.focus(); }, 0);
      return box;
    }

    function moveEntry(from, to, focusDir) {
      if (to < 0 || to >= entries.length || from === to) return;
      const [e] = entries.splice(from, 1);
      entries.splice(to, 0, e);
      syncRangesFromEntries();
      renderFileList();
      /* the focus follows the file, so the arrows can be pressed again */
      if (focusDir) {
        const rowEl = fileList.querySelectorAll('.file-row')[to];
        const b = rowEl && rowEl.querySelector('button[title="Move ' + focusDir + '"]');
        if (b && !b.disabled) b.focus();
        else if (rowEl) { const o = rowEl.querySelector('button[title^="Move"]:not([disabled])'); if (o) o.focus(); }
      }
      if (P) paintPlace();
    }

    /* Drag a file row to a new place, with a mouse, a pen or a finger (a
       finger by the grip, so a swipe elsewhere still scrolls the page). */
    fileList.addEventListener('pointerdown', (ev) => {
      const row = ev.target.closest && ev.target.closest('.file-row');
      if (!row || !spec.multiple || entries.length < 2) return;
      if (ev.target.closest('button, input, select, a, label')) return;
      if (ev.button !== undefined && ev.button > 0) return;
      if (ev.pointerType === 'touch' && !ev.target.closest('.file-grip')) return;
      ev.preventDefault();
      rowDrag = { id: ev.pointerId, row, from: Number(row.dataset.pos), y: ev.clientY, moved: false, to: null };
      try { row.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic */ }
    });
    fileList.addEventListener('pointermove', (ev) => {
      if (!rowDrag || ev.pointerId !== rowDrag.id) return;
      if (!rowDrag.moved && Math.abs(ev.clientY - rowDrag.y) < 6) return;
      rowDrag.moved = true;
      rowDrag.row.classList.add('is-dragging');
      fileList.querySelectorAll('.is-drop-before, .is-drop-after').forEach((c) => c.classList.remove('is-drop-before', 'is-drop-after'));
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const over = hit && hit.closest ? hit.closest('.file-row') : null;
      if (!over || !fileList.contains(over) || over === rowDrag.row) { rowDrag.to = null; return; }
      const r = over.getBoundingClientRect();
      const after = ev.clientY > r.top + r.height / 2;
      over.classList.add(after ? 'is-drop-after' : 'is-drop-before');
      let to = Number(over.dataset.pos) + (after ? 1 : 0);
      if (rowDrag.from < to) to--;
      rowDrag.to = to;
    });
    const rowDrop = (ev, cancelled) => {
      if (!rowDrag || ev.pointerId !== rowDrag.id) return;
      const d = rowDrag;
      rowDrag = null;
      fileList.querySelectorAll('.is-drop-before, .is-drop-after, .is-dragging').forEach((c) => c.classList.remove('is-drop-before', 'is-drop-after', 'is-dragging'));
      if (cancelled || !d.moved || d.to === null || d.to === d.from) return;
      moveEntry(d.from, d.to, null);
    };
    fileList.addEventListener('pointerup', (ev) => rowDrop(ev, false));
    fileList.addEventListener('pointercancel', (ev) => rowDrop(ev, true));

    /* ----- merge: one range per file, kept with the file when it moves ----- */
    const rangesReader = spec.perFilePages ? reader(spec.perFilePages) : null;
    let rangesSyncing = false;
    function syncRangesFromEntries() {
      if (!rangesReader) return;
      const live2 = entries.filter((e) => e.state === 'ready');
      const segs = live2.map((e) => e.range || 'all');
      const text = segs.every((s) => s === 'all') ? 'all' : segs.join(' | ');
      rangesSyncing = true;
      rangesReader.set(text);
      rangesSyncing = false;
    }
    if (rangesReader) {
      rangesReader.input.addEventListener('input', () => {
        if (rangesSyncing) return;
        const parts = String(rangesReader.read() || 'all').split('|').map((s) => s.trim());
        const live2 = entries.filter((e) => e.state === 'ready');
        live2.forEach((e, i) => { const s = parts.length === 1 ? parts[0] : (parts[i] || 'all'); e.range = !s || /^all$/i.test(s) ? null : s; });
        renderFileList();
      });
    }
    function fileGrid(d) {
      const wrap = el('div', 'file-pages');
      let initial = [];
      try { initial = orderedPages(core, d.range || 'all', d.pages); } catch (e) { initial = []; }
      const g = makeGrid({
        entry: d, mode: 'select', marks: 'keep', rotate: false,
        label: 'Pages of ' + d.name + ' to take',
        selection: initial,
        onChange: (sel) => {
          d.range = sel.length === d.pages && sel.every((v, i) => v === i) ? null : (rangeText(sel, d.pages) || null);
          syncRangesFromEntries();
          const b = fileList.querySelector('.file-row[data-pos="' + entries.indexOf(d) + '"] .file-pages-btn');
          if (b) b.textContent = 'Pages: ' + (d.range || 'all');
        }
      });
      const bar = el('div', 'file-pages-bar');
      const all = btn('All', 'btn-ghost'); all.addEventListener('click', () => g.setSelection(Array.from({ length: d.pages }, (_, i) => i), true));
      const none = btn('None', 'btn-ghost'); none.addEventListener('click', () => g.setSelection([], true));
      bar.appendChild(el('span', 'file-pages-hint', 'Click, shift-click or drag across pages to choose; the order you click is the order they go in.'));
      bar.appendChild(all); bar.appendChild(none);
      wrap.appendChild(bar);
      wrap.appendChild(g.el);
      return wrap;
    }

    /* ---------- pdf.js documents for the files ---------- */
    function pdfFor(entry) {
      if (!entry.pdfjs) entry.pdfjs = openWithPdfJs(entry.bytes, entry.password);
      return entry.pdfjs;
    }

    /* ================================================================ */
    /* the page grid                                                     */
    /* ================================================================ */

    /* Thumbnails are drawn when their card scrolls near the screen, two at a
       time, and kept per rotation. A 600-page file costs 600 empty cards and
       a dozen renders, not 600 renders. */
    const thumbQueue = [];
    let thumbBusy = 0;
    function queueThumb(job) { thumbQueue.push(job); pumpThumbs(); }
    function pumpThumbs() {
      while (thumbBusy < 2 && thumbQueue.length) {
        const job = thumbQueue.shift();
        if (job.cancelled()) continue;
        thumbBusy++;
        job.run().catch(() => { /* a page that will not render keeps its placeholder */ })
          .finally(() => { thumbBusy--; pumpThumbs(); });
      }
    }

    function makeGrid(cfg) {
      const entry = cfg.entry;
      const n = entry.pages;
      const mode = cfg.mode || 'select';
      const g = {
        el: el('div', 'page-grid page-grid-' + mode + (cfg.marks ? ' marks-' + cfg.marks : '')),
        selection: (cfg.selection || []).slice(),
        turns: Object.assign({}, cfg.turns || {}),
        order: Array.from({ length: n }, (_, i) => ({ index: i, rotate: 0, keep: true })),
        splits: new Set(cfg.splits || []),
        cards: [],
        angleFor: cfg.angleFor || (() => 0)
      };
      const box = g.el;
      box.setAttribute('role', mode === 'organise' ? 'list' : 'listbox');
      if (mode !== 'organise') box.setAttribute('aria-multiselectable', 'true');
      box.setAttribute('aria-label', cfg.label || 'Pages');
      let focusPos = 0;
      let anchor = null;

      const io2 = 'IntersectionObserver' in window ? new IntersectionObserver((list) => {
        list.forEach((x) => {
          const card = x.target;
          card.__visible = x.isIntersecting;
          if (x.isIntersecting) drawThumb(card);
        });
      }, { rootMargin: '400px 0px' }) : null;

      function rotationOf(index, pos) {
        let r = (g.turns[index] || 0) + g.angleFor(index, g.selection.indexOf(index) >= 0);
        if (mode === 'organise') r = g.order[pos].rotate;
        return ((r % 360) + 360) % 360;
      }
      function drawThumb(card) {
        const index = Number(card.dataset.index);
        const pos = Number(card.dataset.pos);
        const rot = rotationOf(index, pos);
        if (card.__rot === rot && card.querySelector('canvas')) return;
        const want = rot;
        card.__want = want;
        queueThumb({
          cancelled: () => !card.isConnected || card.__want !== want || card.__visible === false,
          run: async () => {
            const pdf = await pdfFor(entry);
            const page = await pdf.getPage(index + 1);
            const base = page.getViewport({ scale: 1, rotation: (page.rotate + want) % 360 });
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const scale = Math.min(118 / base.width, 150 / base.height) * dpr;
            const vp = page.getViewport({ scale, rotation: (page.rotate + want) % 360 });
            const cv = el('canvas');
            cv.width = Math.max(1, Math.round(vp.width)); cv.height = Math.max(1, Math.round(vp.height));
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            if (!card.isConnected || card.__want !== want) return;
            const holder = card.querySelector('.page-thumb');
            holder.innerHTML = '';
            holder.appendChild(cv);
            card.__rot = want;
          }
        });
      }

      function cardFor(pos) {
        const st = mode === 'organise' ? g.order[pos] : { index: pos, keep: true };
        const index = st.index;
        const card = el('div', 'page-card');
        card.dataset.pos = String(pos);
        card.dataset.index = String(index);
        card.setAttribute('role', mode === 'organise' ? 'listitem' : 'option');
        card.tabIndex = -1;
        const holder = el('div', 'page-thumb');
        holder.appendChild(el('span', 'page-thumb-wait', String(index + 1)));
        card.appendChild(holder);
        card.appendChild(el('span', 'page-num', String(index + 1)));
        if (mode !== 'organise') card.appendChild(el('span', 'page-check', '✓'));
        if (mode === 'organise') {
          const grip = el('span', 'page-grip', '⠿');
          grip.title = 'Drag to move this page';
          grip.setAttribute('aria-hidden', 'true');
          card.appendChild(grip);
          const bar = el('div', 'page-tools');
          const mk = (label, title, fn) => {
            const b = btn(label, 'btn-ghost');
            b.title = title;
            b.setAttribute('aria-label', title + ', page ' + (index + 1));
            const at = bar.children.length;
            b.addEventListener('click', () => { fn(); paint({ index, at }); emit(); });
            bar.appendChild(b);
          };
          mk('←', 'Move earlier', () => { const i = g.order.indexOf(st); if (i > 0) { g.order.splice(i, 1); g.order.splice(i - 1, 0, st); } });
          mk('↻', 'Rotate 90°', () => { st.rotate = (st.rotate + 90) % 360; });
          mk(st.keep ? '×' : '↺', st.keep ? 'Remove this page' : 'Restore', () => { st.keep = !st.keep; });
          mk('→', 'Move later', () => { const i = g.order.indexOf(st); if (i < g.order.length - 1) { g.order.splice(i, 1); g.order.splice(i + 1, 0, st); } });
          card.appendChild(bar);
          if (!st.keep) card.classList.add('is-dropped');
          card.setAttribute('aria-label', 'Page ' + (index + 1) + (st.keep ? '' : ', removed') + (st.rotate ? ', turned ' + st.rotate + '°' : ''));
        } else {
          const tools = el('div', 'page-tools');
          if (cfg.rotate) {
            const r = btn('↻', 'btn-ghost page-rot', 'Turn page ' + (index + 1) + ' a quarter clockwise');
            r.tabIndex = -1;
            r.addEventListener('click', (ev) => { ev.stopPropagation(); turn(index); });
            tools.appendChild(r);
          }
          if (mode === 'split' && index < n - 1) {
            const s = btn('✂', 'btn-ghost page-cut', 'Split after page ' + (index + 1));
            s.tabIndex = -1;
            s.setAttribute('aria-pressed', g.splits.has(index) ? 'true' : 'false');
            s.addEventListener('click', (ev) => { ev.stopPropagation(); toggleSplit(index); });
            tools.appendChild(s);
          }
          if (tools.children.length) card.appendChild(tools);
        }
        return card;
      }

      function decorate() {
        const seq = g.selection;
        g.cards.forEach((card) => {
          const index = Number(card.dataset.index);
          if (mode === 'organise') return;
          const k = seq.indexOf(index);
          const on = k >= 0;
          card.classList.toggle('is-selected', on);
          card.setAttribute('aria-selected', on ? 'true' : 'false');
          const turned = rotationOf(index, index);
          card.setAttribute('aria-label', 'Page ' + (index + 1) +
            (cfg.marks === 'remove' ? (on ? ', will be removed' : '') : on ? ', chosen' + (seq.length > 1 ? ' (' + (k + 1) + ' of ' + seq.length + ')' : '') : '') +
            (turned ? ', turned ' + turned + '°' : ''));
          if (mode === 'split') {
            const grp = groupOf(index);
            card.dataset.group = String(grp);
            card.classList.toggle('grp-odd', grp % 2 === 1);
            card.classList.toggle('is-cut', g.splits.has(index));
            const s = card.querySelector('.page-cut');
            if (s) s.setAttribute('aria-pressed', g.splits.has(index) ? 'true' : 'false');
          }
          if (card.__visible !== false) drawThumb(card);
        });
      }
      function groupOf(index) { let k = 0; for (const s of g.splits) if (s < index) k++; return k; }

      function paint(refocus) {
        if (io2) g.cards.forEach((c) => io2.unobserve(c));
        box.innerHTML = '';
        g.cards = [];
        const count = mode === 'organise' ? g.order.length : n;
        for (let pos = 0; pos < count; pos++) {
          const card = cardFor(pos);
          g.cards.push(card);
          box.appendChild(card);
          if (io2) io2.observe(card); else drawThumb(card);
        }
        decorate();
        const f = g.cards[Math.min(focusPos, g.cards.length - 1)];
        if (f) f.tabIndex = 0;
        if (refocus && mode === 'organise') {
          const pos = g.order.findIndex((s) => s.index === refocus.index);
          const card = g.cards[pos];
          const b = card && card.querySelector('.page-tools').children[refocus.at];
          if (b) b.focus();
        }
        if (mode === 'organise' && cfg.onStats) cfg.onStats(g.order);
      }

      function emit() {
        if (mode === 'organise') { if (cfg.onStats) cfg.onStats(g.order); if (cfg.onChange) cfg.onChange(g.layout()); return; }
        if (cfg.onChange) cfg.onChange(g.selection.slice(), g);
      }
      function setSel(list, notify) {
        g.selection = list.slice();
        decorate();
        if (notify) emit();
      }
      function toggle(index, on) {
        const k = g.selection.indexOf(index);
        const want = on === undefined ? k < 0 : on;
        if (want && k < 0) g.selection.push(index);
        if (!want && k >= 0) g.selection.splice(k, 1);
      }
      function turn(index) {
        g.turns[index] = ((g.turns[index] || 0) + 90) % 360;
        if (!g.turns[index]) delete g.turns[index];
        decorate();
        if (cfg.onTurn) cfg.onTurn(Object.assign({}, g.turns));
      }
      function toggleSplit(index) {
        if (g.splits.has(index)) g.splits.delete(index); else g.splits.add(index);
        decorate();
        if (cfg.onSplit) cfg.onSplit([...g.splits].sort((a, b) => a - b));
      }
      function focusCard(pos) {
        pos = Math.max(0, Math.min(g.cards.length - 1, pos));
        g.cards.forEach((c) => { c.tabIndex = -1; });
        const c = g.cards[pos];
        if (!c) return;
        c.tabIndex = 0;
        c.focus();
        focusPos = pos;
      }
      const columns = () => {
        if (g.cards.length < 2) return 1;
        const top = g.cards[0].offsetTop;
        let k = 0;
        while (k < g.cards.length && g.cards[k].offsetTop === top) k++;
        return Math.max(1, k);
      };

      /* choosing pages: click, shift-click for a run, drag across to paint */
      let paintDrag = null;
      box.addEventListener('pointerdown', (ev) => {
        if (mode === 'organise') return;
        const card = ev.target.closest && ev.target.closest('.page-card');
        if (!card || ev.target.closest('button') || (ev.button !== undefined && ev.button > 0)) return;
        const index = Number(card.dataset.index);
        focusPos = Number(card.dataset.pos);
        g.cards.forEach((c) => { c.tabIndex = -1; });
        card.tabIndex = 0;
        if (mode === 'split') { if (index < n - 1) toggleSplit(index); return; }
        if (ev.shiftKey && anchor !== null) {
          const a = anchor, b = index;
          const step = a <= b ? 1 : -1;
          const on = g.selection.indexOf(a) >= 0;
          for (let i = a; i !== b + step; i += step) toggle(i, on);
          setSel(g.selection, true);
          ev.preventDefault();
          return;
        }
        anchor = index;
        const on = g.selection.indexOf(index) < 0;
        toggle(index, on);
        setSel(g.selection, true);
        if (ev.pointerType !== 'touch') {
          paintDrag = { id: ev.pointerId, on, last: index };
          ev.preventDefault();
          try { box.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic */ }
        }
      });
      box.addEventListener('pointermove', (ev) => {
        if (!paintDrag || ev.pointerId !== paintDrag.id) return;
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        const card = hit && hit.closest ? hit.closest('.page-card') : null;
        if (!card || !box.contains(card)) return;
        const index = Number(card.dataset.index);
        if (index === paintDrag.last) return;
        const step = paintDrag.last <= index ? 1 : -1;
        for (let i = paintDrag.last + step; i !== index + step; i += step) toggle(i, paintDrag.on);
        paintDrag.last = index;
        setSel(g.selection, true);
      });
      const endPaint = (ev) => { if (paintDrag && ev.pointerId === paintDrag.id) paintDrag = null; };
      box.addEventListener('pointerup', endPaint);
      box.addEventListener('pointercancel', endPaint);

      /* organise: drag a card to a new place (the same rules as before) */
      let drag = null;
      const unmark = () => box.querySelectorAll('.is-drop-before, .is-drop-after').forEach((c) => c.classList.remove('is-drop-before', 'is-drop-after'));
      if (mode === 'organise') {
        box.addEventListener('pointerdown', (ev) => {
          const card = ev.target.closest && ev.target.closest('.page-card');
          if (!card || ev.target.closest('button') || (ev.button !== undefined && ev.button > 0)) return;
          if (ev.pointerType === 'touch' && !ev.target.closest('.page-grip')) return;
          ev.preventDefault();
          drag = { id: ev.pointerId, card, from: Number(card.dataset.pos), x: ev.clientX, y: ev.clientY, moved: false, to: null };
          try { card.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic events */ }
        });
        box.addEventListener('pointermove', (ev) => {
          if (!drag || ev.pointerId !== drag.id) return;
          if (!drag.moved && Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 6) return;
          drag.moved = true;
          drag.card.classList.add('is-dragging');
          unmark();
          const hit = document.elementFromPoint(ev.clientX, ev.clientY);
          const over = hit && hit.closest ? hit.closest('.page-card') : null;
          if (!over || !box.contains(over) || over === drag.card) { drag.to = null; return; }
          const r = over.getBoundingClientRect();
          const after = ev.clientY > r.bottom - r.height / 4 ||
            (ev.clientY >= r.top + r.height / 4 && ev.clientX > r.left + r.width / 2);
          over.classList.add(after ? 'is-drop-after' : 'is-drop-before');
          let to = Number(over.dataset.pos) + (after ? 1 : 0);
          if (drag.from < to) to--;
          drag.to = to;
        });
        const dropCard = (ev, cancelled) => {
          if (!drag || ev.pointerId !== drag.id) return;
          const d = drag;
          drag = null;
          unmark();
          d.card.classList.remove('is-dragging');
          if (cancelled || !d.moved || d.to === null || d.to === d.from) return;
          const [s] = g.order.splice(d.from, 1);
          g.order.splice(d.to, 0, s);
          focusPos = d.to;
          paint();
          emit();
        };
        box.addEventListener('pointerup', (ev) => dropCard(ev, false));
        box.addEventListener('pointercancel', (ev) => dropCard(ev, true));
      }

      /* the keyboard: arrows move, Space chooses, Shift extends, R turns,
         Ctrl+A chooses all; in the organiser Alt+arrows move the page and
         Delete removes or restores it */
      box.addEventListener('keydown', (ev) => {
        const card = ev.target.closest && ev.target.closest('.page-card');
        if (!card || ev.target.tagName === 'BUTTON') return;
        const pos = Number(card.dataset.pos);
        const index = Number(card.dataset.index);
        const cols = columns();
        const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols, Home: -1e9, End: 1e9 };
        if (moves[ev.key] !== undefined) {
          ev.preventDefault();
          let to = Math.max(0, Math.min(g.cards.length - 1, pos + moves[ev.key]));
          if (mode === 'organise' && ev.altKey && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
            to = pos + (ev.key === 'ArrowLeft' ? -1 : 1);
            if (to < 0 || to >= g.order.length) return;
            const [s] = g.order.splice(pos, 1);
            g.order.splice(to, 0, s);
            focusPos = to; paint(); emit(); focusCard(to);
            return;
          }
          focusCard(to);
          if (ev.shiftKey && mode === 'select') {
            const target = Number(g.cards[to].dataset.index);
            toggle(target, true);
            setSel(g.selection, true);
          }
          return;
        }
        if ((ev.key === ' ' || ev.key === 'Enter') && mode !== 'organise') {
          ev.preventDefault();
          if (mode === 'split') { if (index < n - 1) toggleSplit(index); return; }
          anchor = index; toggle(index); setSel(g.selection, true);
          return;
        }
        if ((ev.key === 'r' || ev.key === 'R') && !ev.ctrlKey && !ev.metaKey) {
          ev.preventDefault();
          if (mode === 'organise') { g.order[pos].rotate = (g.order[pos].rotate + 90) % 360; paint(); emit(); focusCard(pos); }
          else if (cfg.rotate) turn(index);
          return;
        }
        if ((ev.key === 'Delete' || ev.key === 'Backspace') && mode === 'organise') {
          ev.preventDefault();
          g.order[pos].keep = !g.order[pos].keep; paint(); emit(); focusCard(pos);
          return;
        }
        if ((ev.key === 'a' || ev.key === 'A') && (ev.ctrlKey || ev.metaKey) && mode === 'select') {
          ev.preventDefault();
          setSel(Array.from({ length: n }, (_, i) => i), true);
        }
      });

      g.setSelection = (list, notify) => setSel(list, notify);
      g.setSplits = (list) => { g.splits = new Set(list); decorate(); };
      g.refresh = () => decorate();
      g.layout = () => g.order.filter((s) => s.keep).map((s) => ({ p: s.index, r: s.rotate }));
      g.destroy = () => { if (io2) io2.disconnect(); };
      paint();
      return g;
    }

    /* the one grid of a single-file tool, tied to its page-range control */
    let grid = null;
    let gridSyncing = false;
    function resetGrid() {
      if (grid) grid.destroy();
      grid = null;
      gridHost.innerHTML = '';
    }
    function mountGrid() {
      const cfg = spec.pageGrid;
      const e = ready()[0];
      if (!e || !e.pages) return;
      if (grid && grid.entryId === e.id) return;
      resetGrid();
      const r = cfg.key ? reader(cfg.key) : null;
      const angle = cfg.angleKey ? reader(cfg.angleKey) : null;
      const sel = () => { try { return r ? orderedPages(core, r.read(), e.pages) : []; } catch (x) { return null; } };
      const head = el('div', 'pdf-grid-head');
      head.appendChild(el('span', 'pdf-grid-title', cfg.title || (cfg.mode === 'organise'
        ? 'Drag pages to reorder; turn or remove them with the buttons'
        : cfg.mode === 'split' ? 'Click a page to split after it; each colour is one file'
        : 'Click pages to choose them; shift-click for a run, or drag across')));
      const count = el('span', 'pdf-grid-count');
      count.setAttribute('aria-live', 'polite');
      head.appendChild(count);
      if (cfg.mode === 'select') {
        const all = btn('All', 'btn-ghost'); const none = btn('None', 'btn-ghost');
        all.addEventListener('click', () => grid.setSelection(Array.from({ length: e.pages }, (_, i) => i), true));
        none.addEventListener('click', () => grid.setSelection([], true));
        head.appendChild(all); head.appendChild(none);
      }
      gridHost.appendChild(head);
      const counter = (list) => {
        if (cfg.mode === 'organise') {
          const kept = list.filter((s) => s.keep).length;
          count.textContent = kept + ' of ' + e.pages + ' pages kept';
          renderStats([
            ['Source pages', String(e.pages)], ['Pages kept', String(kept)],
            ['Pages removed', String(e.pages - kept)], ['Rotated', String(list.filter((s) => s.rotate).length)]
          ]);
          return;
        }
        if (cfg.mode === 'split') { count.textContent = ''; return; }
        const k = list.length;
        count.textContent = cfg.marks === 'remove' ? k + ' of ' + e.pages + ' marked for removal' : k + ' of ' + e.pages + ' chosen';
      };
      const initial = sel() || [];
      grid = makeGrid({
        entry: e, mode: cfg.mode || 'select', marks: cfg.marks || 'keep', rotate: !!cfg.rotate,
        label: cfg.label || 'Pages of ' + e.name,
        selection: initial,
        splits: cfg.mode === 'split' ? splitPoints(e.pages) : [],
        angleFor: (index, on) => (angle && on ? Number(angle.read()) || 0 : 0),
        onChange: (list) => {
          counter(list);
          if (!r || cfg.mode === 'organise') return;
          gridSyncing = true;
          r.set(rangeText(list, e.pages));
          gridSyncing = false;
        },
        onStats: (order) => counter(order),
        onTurn: () => {},
        onSplit: (points) => {
          const groups = [];
          let start = 0;
          points.concat([e.pages - 1]).forEach((p) => { if (p >= start) { groups.push(start === p ? String(start + 1) : (start + 1) + '-' + (p + 1)); start = p + 1; } });
          const mode = reader('mode');
          if (mode) mode.set('ranges');
          const rr = reader(cfg.rangesKey || 'ranges');
          gridSyncing = true;
          if (rr) rr.set(groups.join(' | '));
          gridSyncing = false;
        }
      });
      grid.entryId = e.id;
      gridHost.appendChild(grid.el);
      counter(cfg.mode === 'organise' ? grid.order : grid.selection);
      if (r && !r.__gridBound) {
        r.__gridBound = true;
        r.input.addEventListener('input', () => {
          if (gridSyncing || !grid) return;
          const s = sel();
          if (s) { grid.setSelection(s, false); counter(s); }
        });
      }
      if (angle && !angle.__gridBound) {
        angle.__gridBound = true;
        angle.input.addEventListener('input', () => { if (grid) grid.refresh(); });
        angle.input.addEventListener('change', () => { if (grid) grid.refresh(); });
      }
      if (cfg.mode === 'split') {
        const refresh = () => { if (!gridSyncing && grid) grid.setSplits(splitPoints(e.pages)); };
        ['mode', 'n', cfg.rangesKey || 'ranges'].forEach((k) => {
          const rr = reader(k);
          if (rr && !rr.__gridBound) { rr.__gridBound = true; rr.input.addEventListener('input', refresh); rr.input.addEventListener('change', refresh); }
        });
      }
    }
    /** Where the split tool's current settings cut the file, as "after page i" points. */
    function splitPoints(total) {
      const mode = String(val('mode', 'each'));
      const pts = [];
      if (mode === 'each') for (let i = 0; i < total - 1; i++) pts.push(i);
      else if (mode === 'every') { const k = Math.max(1, Number(val('n', 2)) || 1); for (let i = k - 1; i < total - 1; i += k) pts.push(i); }
      else if (mode === 'half') { const mid = Math.ceil(total / 2); if (mid < total) pts.push(mid - 1); }
      else {
        const parts = String(val(spec.pageGrid.rangesKey || 'ranges', '')).split('|').map((s) => s.trim()).filter(Boolean);
        try {
          const groups = parts.map((p) => orderedPages(core, p, total));
          /* only a clean run of consecutive groups can be shown as cuts */
          let next = 0, ok = true;
          for (const gr of groups) { for (const i of gr) { if (i !== next) ok = false; next++; } }
          if (ok) { let at = -1; groups.slice(0, -1).forEach((gr) => { at += gr.length; pts.push(at); }); }
        } catch (e) { /* half-typed */ }
      }
      return pts;
    }

    /* ================================================================ */
    /* placing things on a page: click, drag, resize, nudge              */
    /* ================================================================ */
    let placeState = null;
    let placeDoc = null;      // { pdf, entryId }
    let placePage = 0;

    function firstSelectedPage(total) {
      const r = P && P.page && reader(P.page);
      if (!r) return 0;
      const v = String(r.read() || '').trim();
      if (/^last$/i.test(v)) return total - 1;
      try { const idx = core.parsePageRange(v, total); if (idx.length) return idx[0]; }
      catch (e) { /* half-typed ranges are normal while typing */ }
      return 0;
    }
    const pagesOf = (it, total) => {
      const v = String(it.pages || '').trim();
      if (/^last$/i.test(v)) return [total - 1];
      try { return core.parsePageRange(v, total); } catch (e) { return []; }
    };

    async function paintPlace() {
      const src = ready()[0];
      if (!P || !src) return;
      place.hidden = false;
      if (!placeDoc || placeDoc.entryId !== src.id) {
        place.innerHTML = '';
        place.appendChild(el('p', 'place-note', 'Rendering the page…'));
        try { placeDoc = { entryId: src.id, pdf: await pdfFor(src) }; }
        catch (e) {
          placeDoc = null;
          place.innerHTML = '';
          place.appendChild(el('p', 'place-note', /load|import|fetch/i.test(String(e && e.message))
            ? 'The page preview could not load. The X and Y boxes still work — they are measured in points from the bottom-left corner, 72 to the inch.'
            : 'This PDF could not be rendered for preview, but it can still be processed.'));
          return;
        }
        placePage = firstSelectedPage(placeDoc.pdf.numPages);
      } else if (placeState && placeState.frameFor === src.id) { drawPlace(); return; }

      const total = placeDoc.pdf.numPages;
      placePage = Math.max(0, Math.min(total - 1, placePage));
      place.innerHTML = '';

      const head = el('div', 'place-head');
      head.appendChild(el('span', 'place-title', P.title || 'Click the page to place it, or drag it'));
      let pager = null, pageLabel = null, prev = null, next = null;
      if (total > 1) {
        pager = el('div', 'place-pager');
        prev = btn('‹', 'btn-ghost', 'Previous page');
        pageLabel = el('span', 'place-page-num');
        next = btn('›', 'btn-ghost', 'Next page');
        pager.appendChild(prev); pager.appendChild(pageLabel); pager.appendChild(next);
        head.appendChild(pager);
      }
      const reset = btn('Centre', 'btn-ghost'); reset.title = 'Put it in the middle of the page';
      head.appendChild(reset);
      place.appendChild(head);

      const where = el('div', 'place-where');
      if (total > 1 && P.page) {
        where.appendChild(el('span', 'place-where-label', 'Put this one on'));
        const only = btn('this page', 'btn-ghost'); only.title = 'Only the page in view';
        const allP = btn('every page', 'btn-ghost'); allP.title = 'Every page of the document';
        const lastP = btn('the last page', 'btn-ghost'); lastP.title = 'The last page only';
        only.addEventListener('click', () => { setRole('page', String(placePage + 1)); drawPlace(); });
        allP.addEventListener('click', () => { setRole('page', 'all'); drawPlace(); });
        lastP.addEventListener('click', () => { setRole('page', P.lastWord ? 'last' : String(total)); drawPlace(); });
        where.appendChild(only); where.appendChild(allP); where.appendChild(lastP);
        where.appendChild(el('span', 'place-where-hint', 'or type pages in the Pages box: 1, 2-5, all'));
        place.appendChild(where);
      }

      const stage = el('div', 'place-stage');
      const canvas = el('canvas', 'place-canvas');
      canvas.setAttribute('role', 'application');
      canvas.tabIndex = 0;
      canvas.setAttribute('aria-label',
        'Page preview. Click to set the position, or use the arrow keys (Shift for bigger steps). ' +
        'Page Up and Page Down turn the page. The X and Y boxes below hold the same value.');
      const layer = el('div', 'place-layer');
      stage.appendChild(canvas);
      stage.appendChild(layer);
      place.appendChild(stage);
      const readout = el('p', 'place-readout');
      place.appendChild(readout);
      const hint = el('p', 'place-hint');
      place.appendChild(hint);

      const showPage = async (index) => {
        placePage = Math.max(0, Math.min(total - 1, index));
        const page = await placeDoc.pdf.getPage(placePage + 1);
        const base = page.getViewport({ scale: 1 });
        const wide = Math.min(620, Math.max(260, (place.clientWidth || 560) - 30));
        const scale = Math.min(1.6, wide / base.width);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale: scale * dpr });
        const sheet = document.createElement('canvas');
        sheet.width = Math.round(vp.width);
        sheet.height = Math.round(vp.height);
        const sctx = sheet.getContext('2d');
        sctx.fillStyle = '#fff';
        sctx.fillRect(0, 0, sheet.width, sheet.height);
        await page.render({ canvasContext: sctx, viewport: vp }).promise;
        canvas.width = sheet.width;
        canvas.height = sheet.height;
        canvas.style.width = Math.round(vp.width / dpr) + 'px';
        canvas.style.height = Math.round(vp.height / dpr) + 'px';
        placeState = { sheet, canvas, layer, readout, hint, scale, dpr, wPt: base.width, hPt: base.height, total, frameFor: src.id };
        if (pageLabel) {
          pageLabel.textContent = 'Page ' + (placePage + 1) + ' of ' + total;
          prev.disabled = placePage === 0;
          next.disabled = placePage === total - 1;
        }
        drawPlace();
      };
      if (pager) {
        prev.addEventListener('click', () => showPage(placePage - 1));
        next.addEventListener('click', () => showPage(placePage + 1));
      }
      const setPoint = (xPt, yPt) => {
        if (!placeState) return;
        setRole('x', Math.round(Math.max(0, Math.min(placeState.wPt, xPt))));
        setRole('y', Math.round(Math.max(0, Math.min(placeState.hPt, yPt))));
        drawPlace();
      };
      canvas.addEventListener('click', (ev) => {
        if (!placeState) return;
        const r = canvas.getBoundingClientRect();
        const xPt = (ev.clientX - r.left) * (placeState.wPt / r.width);
        const yPt = placeState.hPt - (ev.clientY - r.top) * (placeState.hPt / r.height);
        setPoint(xPt, yPt);
        canvas.focus();
      });
      canvas.addEventListener('keydown', (ev) => {
        if (total > 1 && (ev.key === 'PageUp' || ev.key === 'PageDown')) {
          showPage(placePage + (ev.key === 'PageDown' ? 1 : -1));
          ev.preventDefault();
          return;
        }
        const step = ev.shiftKey ? 20 : 2;
        const cx = Number(val(P.x, 0)) || 0, cy = Number(val(P.y, 0)) || 0;
        if (ev.key === 'ArrowLeft') setPoint(cx - step, cy);
        else if (ev.key === 'ArrowRight') setPoint(cx + step, cy);
        else if (ev.key === 'ArrowUp') setPoint(cx, cy + step);
        else if (ev.key === 'ArrowDown') setPoint(cx, cy - step);
        else return;
        ev.preventDefault();
      });
      reset.addEventListener('click', () => {
        if (!placeState) return;
        const b = boxOf(currentItem());
        const w = b ? b.x1 - b.x0 : 0, h = b ? b.y1 - b.y0 : 0;
        const cur = currentItem();
        setPoint(placeState.wPt / 2 - w / 2, placeState.hPt / 2 + (b ? cur.y - b.y0 : 0) - h / 2);
      });
      [P.x, P.y, P.text, P.size, P.colour, P.width, P.drawing, P.drawingWidth, P.date, P.image, P.imageWidth, P.opacity].forEach((k) => {
        const r = typeof k === 'string' && reader(k);
        if (r && r.input) r.input.addEventListener('input', drawPlace);
      });
      const pageReader = P.page && reader(P.page);
      if (pageReader && pageReader.input) {
        pageReader.input.addEventListener('change', () => showPage(firstSelectedPage(total)));
        pageReader.input.addEventListener('input', drawPlace);
      }
      await showPage(placePage);
    }

    /* Geometry of an item in PDF points (bottom-up): what is drawn, so the
       box you drag is the thing that will be written. */
    function linesOf(it) {
      if (!it.text || !it.text.trim()) return [];
      if (it.width > 0 && uniNeeded(it.text)) {
        /* the same word-by-word wrap the engine uses for these fonts */
        const out = [];
        const space = textW(' ', P.font || 'Helvetica', it.size);
        for (const para of String(it.text).split('\n')) {
          if (!para.trim()) { out.push(''); continue; }
          let line = '', lw = 0;
          for (const word of para.split(/\s+/)) {
            const ww = textW(word, P.font || 'Helvetica', it.size);
            if (line && lw + space + ww > it.width) { out.push(line); line = word; lw = ww; }
            else { lw = line ? lw + space + ww : ww; line = line ? line + ' ' + word : word; }
          }
          if (line) out.push(line);
        }
        return out;
      }
      if (it.width > 0 && core.wrapText) return core.wrapText(it.text, P.font || 'Helvetica', it.size, it.width);
      return String(it.text).split('\n');
    }
    function inkOf(it) {
      if (!it.drawn || !it.drawn.strokes || !it.drawn.strokes.length || typeof spec.inkPlacement !== 'function') return null;
      return spec.inkPlacement(it.drawn, { x: it.x, y: it.y, drawWidth: it.drawWidth, signatureText: it.text });
    }
    /* Text WinAnsi cannot hold is drawn in the PDF with a Noto subset; the
       preview measures and draws it with the same fonts, loaded into the
       page from the site's copy the first time such text is typed. */
    const UNI_FACES = '"MVR Noto", "MVR Noto Devanagari", sans-serif';
    let uniFaces = null;
    const uniNeeded = (t) => !!(core.unicodeFonts && core.unicodeFonts.needs(t));
    function loadUniFaces() {
      if (uniFaces || typeof FontFace !== 'function') return;
      uniFaces = Promise.all([['MVR Noto', 'NotoSans-Regular.ttf'], ['MVR Noto Devanagari', 'NotoSansDevanagari-Regular.ttf']].map(([fam, file]) => {
        const f = new FontFace(fam, 'url(' + ENGINE_BASE + 'vendor/fonts/' + file + ')');
        return f.load().then((x) => { document.fonts.add(x); }).catch(() => {});
      })).then(() => drawPlace());
    }
    const measurer = document.createElement('canvas').getContext('2d');
    function textW(text, font, size) {
      if (!uniNeeded(text)) return core.textWidth(text, font, size);
      loadUniFaces();
      measurer.font = '100px ' + UNI_FACES;
      return measurer.measureText(text).width * size / 100;
    }
    function boxOf(it) {
      if (!it) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const add = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
      const lines = linesOf(it);
      const font = P.font || 'Helvetica';
      if (lines.length) {
        const w = Math.max.apply(null, lines.map((l) => textW(l, font, it.size)));
        const lead = it.size * 1.25;
        add(it.x, it.y - lead * (lines.length - 1) - it.size * 0.22, it.x + Math.max(w, it.width || 0), it.y + it.size * 0.78);
      }
      if (it.date === 'yes') { const dy = it.size * 14 / 11; add(it.x, it.y - dy - it.size * 0.22, it.x + core.textWidth('Date: 31 December 2026', font, it.size), it.y - dy + it.size * 0.78); }
      const ink = inkOf(it);
      if (ink) add(ink.x0, ink.y0, ink.x0 + ink.w, ink.y0 + ink.h);
      if (it.image) {
        const w = it.imageWidth, h = w * it.image.height / it.image.width;
        add(it.x, it.y, it.x + w, it.y + h);
      }
      return isFinite(x0) ? { x0, y0, x1, y1 } : null;
    }

    function drawPlace() {
      if (!placeState) return;
      const { sheet, canvas, layer, readout, hint, scale, dpr, wPt, hPt, total } = placeState;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sheet, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const S = scale;
      const cur = currentItem();

      const onThisPage = (it) => pagesOf(it, total).indexOf(placePage) >= 0;
      const drawItem = (it, active) => {
        const b = boxOf(it);
        if (!b) return;
        ctx.save();
        if (it.opacity !== undefined && it.opacity < 100) ctx.globalAlpha = Math.max(0.05, it.opacity / 100);
        if (it.image && it.image.preview) {
          const img = imageCache(it.image);
          if (img.complete) ctx.drawImage(img, it.x * S, (hPt - it.y - (b.y1 - it.y)) * S, it.imageWidth * S, (it.imageWidth * it.image.height / it.image.width) * S);
          else img.onload = () => drawPlace();
        }
        const lines = linesOf(it);
        if (lines.length || it.date === 'yes') {
          const px = it.size * S;
          ctx.font = px.toFixed(2) + 'px ' + (lines.some((l) => uniNeeded(l)) ? UNI_FACES : 'Helvetica, Arial, sans-serif');
          ctx.fillStyle = it.colour || '#000';
          lines.forEach((l, k) => ctx.fillText(l, it.x * S, (hPt - it.y) * S + k * px * 1.25));
          if (it.date === 'yes') {
            const ds = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            ctx.fillText('Date: ' + ds, it.x * S, (hPt - it.y + it.size * 14 / 11) * S);
          }
        }
        const ink = inkOf(it);
        if (ink) {
          const X = (p) => (ink.x0 + (p[0] - ink.minX) * ink.s) * S;
          const Y = (p) => (hPt - (ink.y0 + (ink.maxY - p[1]) * ink.s)) * S;
          ctx.strokeStyle = '#000';
          ctx.lineWidth = Math.max(1, 1.4 * S);
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          it.drawn.strokes.forEach((s) => {
            if (!s.length) return;
            ctx.beginPath();
            ctx.moveTo(X(s[0]), Y(s[0]));
            (s.length === 1 ? s : s.slice(1)).forEach((p) => ctx.lineTo(X(p) + (s.length === 1 ? 0.01 : 0), Y(p)));
            ctx.stroke();
          });
        }
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = active ? '#f7c948' : 'rgba(120,130,150,.75)';
        ctx.fillStyle = active ? 'rgba(247,201,72,.14)' : 'rgba(120,130,150,.10)';
        ctx.lineWidth = 1;
        ctx.setLineDash(active ? [4, 3] : [2, 3]);
        ctx.fillRect(b.x0 * S - 2, (hPt - b.y1) * S - 2, (b.x1 - b.x0) * S + 4, (b.y1 - b.y0) * S + 4);
        ctx.strokeRect(b.x0 * S - 2, (hPt - b.y1) * S - 2, (b.x1 - b.x0) * S + 4, (b.y1 - b.y0) * S + 4);
        ctx.restore();
      };
      saved.forEach((it) => { if (onThisPage(it)) drawItem(it, false); });
      if (hasContent(cur)) drawItem(cur, true);

      /* the anchor, always, even with nothing typed yet */
      const cx = cur.x * S, cy = (hPt - cur.y) * S;
      ctx.strokeStyle = '#f7c948';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
      ctx.stroke();

      layoutHandles();

      const off = cur.x < 0 || cur.y < 0 || cur.x > wPt || cur.y > hPt;
      readout.textContent = 'X ' + Math.round(cur.x) + ' · Y ' + Math.round(cur.y) +
        ' points from the bottom-left of a ' + Math.round(wPt) + ' × ' + Math.round(hPt) + ' page' +
        (off ? ' — that is off the page' : '');
      readout.className = 'place-readout' + (off ? ' is-off' : '');
      if (hint) {
        const sel = pagesOf(cur, total);
        if (P.page && sel.indexOf(placePage) < 0) {
          hint.textContent = 'You are looking at page ' + (placePage + 1) + ', which the Pages box does not include — nothing will be added here.';
          hint.className = 'place-hint is-warn';
        } else { hint.textContent = ''; hint.className = 'place-hint'; }
      }
    }
    const imgCache = new WeakMap();
    function imageCache(image) {
      let im = imgCache.get(image);
      if (!im) { im = new Image(); im.src = image.preview; imgCache.set(image, im); }
      return im;
    }

    /* The boxes you can grab, laid over the canvas: one per item on the page
       in view. Dragging moves it; the corner handle resizes it (text by its
       size, a drawing or a picture by its width); the side handle sets a
       text's wrap width. Focused, the arrows nudge it and + and - resize it. */
    let handleDrag = null;
    function layoutHandles() {
      const st = placeState;
      if (!st) return;
      const { layer, hPt, total } = st;
      const S = st.scale;
      if (handleDrag) {
        /* keep the boxes in step while a drag is under way, without rebuilding them */
        const list = layer.querySelectorAll('.place-box');
        list.forEach((node) => {
          const it = node.__item();
          const b = it && boxOf(it);
          if (b) positionBox(node, b, S, hPt);
        });
        return;
      }
      layer.innerHTML = '';
      const all = saved.map((it, i) => ({ it, i })).filter((x) => pagesOf(x.it, total).indexOf(placePage) >= 0);
      const cur = currentItem();
      if (hasContent(cur)) all.push({ it: cur, i: -1 });
      all.forEach(({ it, i }) => {
        const b = boxOf(it);
        if (!b) return;
        const node = el('div', 'place-box' + (i < 0 ? ' is-current' : ''));
        node.tabIndex = 0;
        node.setAttribute('role', 'button');
        node.setAttribute('aria-label', (i < 0 ? 'Item being edited: ' : 'Placed item: ') + itemLabel(it) +
          '. Drag to move, or use the arrow keys; plus and minus resize' + (i >= 0 ? '; Enter edits it' : '') + '; Delete removes it.');
        node.__item = () => (i < 0 ? currentItem() : saved[i]);
        node.__index = i;
        positionBox(node, b, S, hPt);
        const corner = el('span', 'place-handle place-handle-se');
        corner.setAttribute('aria-hidden', 'true');
        node.appendChild(corner);
        if (it.text && it.text.trim() && P.width && !it.image) {
          const side = el('span', 'place-handle place-handle-e');
          side.setAttribute('aria-hidden', 'true');
          side.title = 'Drag to set the wrap width';
          node.appendChild(side);
        }
        layer.appendChild(node);
      });
    }
    function positionBox(node, b, S, hPt) {
      node.style.left = (b.x0 * S - 3) + 'px';
      node.style.top = ((hPt - b.y1) * S - 3) + 'px';
      node.style.width = Math.max(14, (b.x1 - b.x0) * S + 6) + 'px';
      node.style.height = Math.max(14, (b.y1 - b.y0) * S + 6) + 'px';
    }
    /** Change an item, wherever it lives: the controls or the bank. */
    function updateItem(i, patch) {
      if (i < 0) {
        Object.keys(patch).forEach((k) => {
          const role = { x: 'x', y: 'y', size: 'size', width: 'width', drawWidth: 'drawingWidth', imageWidth: 'imageWidth' }[k];
          if (role) setRole(role, Math.round(patch[k] * 10) / 10);
        });
      } else Object.assign(saved[i], patch);
      drawPlace();
      if (i >= 0) renderItems();
    }
    place.addEventListener('pointerdown', (ev) => {
      const node = ev.target.closest && ev.target.closest('.place-box');
      if (!node || !placeState || (ev.button !== undefined && ev.button > 0)) return;
      ev.preventDefault();
      const it = node.__item();
      const handle = ev.target.classList.contains('place-handle') ? (ev.target.classList.contains('place-handle-e') ? 'e' : 'se') : null;
      handleDrag = {
        id: ev.pointerId, node, i: node.__index, handle, x: ev.clientX, y: ev.clientY, moved: false,
        start: Object.assign({}, it, { box: boxOf(it) })
      };
      try { node.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic */ }
      node.focus({ preventScroll: true });
    });
    place.addEventListener('pointermove', (ev) => {
      const d = handleDrag;
      if (!d || ev.pointerId !== d.id) return;
      const S = placeState.scale;
      const dx = (ev.clientX - d.x) / S, dy = (ev.clientY - d.y) / S;
      if (!d.moved && Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y) < 3) return;
      d.moved = true;
      const s = d.start;
      if (!d.handle) {
        updateItem(d.i, { x: Math.max(0, s.x + dx), y: Math.max(0, s.y - dy) });
      } else if (d.handle === 'e') {
        const w = Math.max(20, (s.box.x1 - s.box.x0) + dx);
        updateItem(d.i, { width: w });
      } else {
        const h0 = Math.max(1, s.box.y1 - s.box.y0), w0 = Math.max(1, s.box.x1 - s.box.x0);
        const k = Math.max(0.15, Math.max((w0 + dx) / w0, (h0 + dy) / h0));
        const patch = {};
        if (s.image) patch.imageWidth = Math.max(8, s.imageWidth * k);
        if (s.drawn && s.drawn.strokes && s.drawn.strokes.length) patch.drawWidth = Math.max(20, Math.min(600, s.drawWidth * k));
        if (s.text && s.text.trim()) patch.size = Math.max(4, Math.min(144, s.size * k));
        /* the top-left corner stays put: the anchor is the first baseline
           (text) or the bottom-left (a picture), so it moves down as the
           item grows */
        const grown = Object.assign({}, s, patch);
        const nb = boxOf(grown);
        if (nb) patch.y = s.y + (s.box.y1 - nb.y1);
        updateItem(d.i, patch);
      }
    });
    const endHandle = (ev) => {
      const d = handleDrag;
      if (!d || ev.pointerId !== d.id) return;
      handleDrag = null;
      if (!d.moved && d.i >= 0) { editItem(d.i); return; }
      drawPlace();
      const again = placeState && placeState.layer.querySelector(d.i < 0 ? '.place-box.is-current' : '.place-box');
      if (again && d.i < 0) again.focus({ preventScroll: true });
    };
    place.addEventListener('pointerup', endHandle);
    place.addEventListener('pointercancel', endHandle);
    place.addEventListener('keydown', (ev) => {
      const node = ev.target.closest && ev.target.closest('.place-box');
      if (!node) return;
      const i = node.__index;
      const it = node.__item();
      const step = ev.shiftKey ? 20 : 2;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      const refocus = () => {
        const list = placeState.layer.querySelectorAll('.place-box');
        const hit = [...list].find((n) => n.__index === i);
        if (hit) hit.focus({ preventScroll: true });
      };
      if (moves[ev.key]) {
        ev.preventDefault();
        updateItem(i, { x: Math.max(0, it.x + moves[ev.key][0]), y: Math.max(0, it.y + moves[ev.key][1]) });
        refocus();
        return;
      }
      if (ev.key === '+' || ev.key === '=' || ev.key === '-' || ev.key === '_') {
        ev.preventDefault();
        const k = (ev.key === '+' || ev.key === '=') ? 1.1 : 1 / 1.1;
        const patch = {};
        if (it.image) patch.imageWidth = Math.max(8, it.imageWidth * k);
        if (it.drawn && it.drawn.strokes && it.drawn.strokes.length) patch.drawWidth = Math.max(20, Math.min(600, it.drawWidth * k));
        if (it.text && it.text.trim()) patch.size = Math.max(4, Math.min(144, it.size * k));
        updateItem(i, patch);
        refocus();
        return;
      }
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        if (i < 0) clearCurrent(); else { saved.splice(i, 1); renderItems(); }
        drawPlace();
        placeState.canvas.focus();
        return;
      }
      if (ev.key === 'Enter' && i >= 0) { ev.preventDefault(); editItem(i); }
    });

    /* ================================================================ */
    /* the crop box: drag it, its edges or its corners on the page       */
    /* ================================================================ */
    const CROP = spec.cropEditor || null;
    const MMPT = 72 / 25.4;
    let cropState = null, cropPage = 0;
    async function paintCrop() {
      const src = ready()[0];
      if (!CROP || !src) return;
      crop.hidden = false;
      let pdf;
      try { pdf = await pdfFor(src); }
      catch (e) { crop.innerHTML = ''; crop.appendChild(el('p', 'place-note', 'The page could not be drawn here, but the margins boxes still work: they are in millimetres, measured on the page as it is shown.')); return; }
      const total = pdf.numPages;
      cropPage = Math.max(0, Math.min(total - 1, cropPage));
      crop.innerHTML = '';
      const head = el('div', 'place-head');
      head.appendChild(el('span', 'place-title', 'Drag the box, its edges or its corners: the shaded part is cropped away'));
      const pager = el('div', 'place-pager');
      const prev = btn('‹', 'btn-ghost', 'Previous page');
      const lab = el('span', 'place-page-num');
      const next = btn('›', 'btn-ghost', 'Next page');
      pager.appendChild(prev); pager.appendChild(lab); pager.appendChild(next);
      if (total > 1) head.appendChild(pager);
      const fit = btn('Fit to the content', 'btn-ghost crop-fit');
      fit.title = 'Put the box just around what is drawn on this page';
      head.appendChild(fit);
      crop.appendChild(head);
      const stage = el('div', 'place-stage crop-stage');
      const cv = el('canvas', 'place-canvas crop-canvas');
      cv.setAttribute('role', 'img');
      const box = el('div', 'crop-box');
      box.tabIndex = 0;
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Crop box. Arrow keys move it by 1 mm, Shift by 5 mm; focus an edge or a corner to move only that.');
      const HANDLES = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];
      const NAMES = { n: 'top edge', e: 'right edge', s: 'bottom edge', w: 'left edge', ne: 'top right corner', se: 'bottom right corner', sw: 'bottom left corner', nw: 'top left corner' };
      HANDLES.forEach((h) => {
        const d = el('span', 'crop-handle crop-' + h);
        d.dataset.h = h;
        d.tabIndex = 0;
        d.setAttribute('role', 'slider');
        d.setAttribute('aria-label', 'Crop ' + NAMES[h] + ': arrow keys move it by 1 mm, Shift by 5 mm');
        box.appendChild(d);
      });
      stage.appendChild(cv); stage.appendChild(box);
      crop.appendChild(stage);
      const readout = el('p', 'place-readout');
      crop.appendChild(readout);

      const m = () => ['top', 'right', 'bottom', 'left'].map((k) => Math.max(0, Number(val(CROP[k], 0)) || 0) * MMPT);
      const setM = (t, r, b, l) => {
        const mm = (v) => Math.round(Math.max(0, v) / MMPT * 2) / 2;
        const vals = { top: mm(t), right: mm(r), bottom: mm(b), left: mm(l) };
        Object.keys(vals).forEach((k) => { const rd = reader(CROP[k]); if (rd) rd.set(vals[k]); });
        place2();
      };
      const show = async (i) => {
        cropPage = Math.max(0, Math.min(total - 1, i));
        const page = await pdf.getPage(cropPage + 1);
        const base = page.getViewport({ scale: 1 });
        const wide = Math.min(620, Math.max(260, (crop.clientWidth || 560) - 30));
        const scale = Math.min(1.6, wide / base.width);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale: scale * dpr });
        cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        cv.style.width = Math.round(vp.width / dpr) + 'px';
        cv.style.height = Math.round(vp.height / dpr) + 'px';
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        cropState = { scale, dpr, w: base.width, h: base.height };
        lab.textContent = 'Page ' + (cropPage + 1) + ' of ' + total;
        prev.disabled = cropPage === 0; next.disabled = cropPage >= total - 1;
        cv.setAttribute('aria-label', 'Page ' + (cropPage + 1) + ' with the crop box');
        place2();
      };
      function place2() {
        if (!cropState) return;
        const [t, r, b, l] = m();
        const S = cropState.scale;
        box.style.left = (l * S) + 'px';
        box.style.top = (t * S) + 'px';
        box.style.width = Math.max(4, (cropState.w - l - r) * S) + 'px';
        box.style.height = Math.max(4, (cropState.h - t - b) * S) + 'px';
        const mm = (v) => (Math.round(v / MMPT * 10) / 10).toLocaleString('en-GB');
        const left = cropState.w - l - r, tall = cropState.h - t - b;
        readout.textContent = 'Keeps ' + mm(left) + ' × ' + mm(tall) + ' mm of a ' + mm(cropState.w) + ' × ' + mm(cropState.h) + ' mm page' + (left <= 0 || tall <= 0 ? ' — that leaves nothing' : '');
        readout.className = 'place-readout' + (left <= 0 || tall <= 0 ? ' is-off' : '');
      }
      let drag = null;
      box.addEventListener('pointerdown', (ev) => {
        if (!cropState || (ev.button !== undefined && ev.button > 0)) return;
        ev.preventDefault();
        const h = ev.target.dataset && ev.target.dataset.h ? ev.target.dataset.h : 'move';
        drag = { id: ev.pointerId, h, x: ev.clientX, y: ev.clientY, m0: m() };
        try { box.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic */ }
        (ev.target.dataset && ev.target.dataset.h ? ev.target : box).focus({ preventScroll: true });
      });
      box.addEventListener('pointermove', (ev) => {
        if (!drag || ev.pointerId !== drag.id) return;
        const S = cropState.scale;
        const dx = (ev.clientX - drag.x) / S, dy = (ev.clientY - drag.y) / S;
        let [t, r, b, l] = drag.m0;
        const W = cropState.w, H = cropState.h;
        if (drag.h === 'move') {
          const ddx = Math.max(-l, Math.min(r, dx)), ddy = Math.max(-t, Math.min(b, dy));
          l += ddx; r -= ddx; t += ddy; b -= ddy;
        } else {
          if (/w/.test(drag.h)) l = Math.max(0, Math.min(W - r - 6, l + dx));
          if (/e/.test(drag.h)) r = Math.max(0, Math.min(W - l - 6, r - dx));
          if (/n/.test(drag.h)) t = Math.max(0, Math.min(H - b - 6, t + dy));
          if (/s/.test(drag.h)) b = Math.max(0, Math.min(H - t - 6, b - dy));
        }
        setM(t, r, b, l);
      });
      const end = (ev) => { if (drag && ev.pointerId === drag.id) drag = null; };
      box.addEventListener('pointerup', end);
      box.addEventListener('pointercancel', end);
      box.addEventListener('keydown', (ev) => {
        const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!moves[ev.key] || !cropState) return;
        ev.preventDefault();
        const step = (ev.shiftKey ? 5 : 1) * MMPT;
        const [mx, my] = moves[ev.key].map((v) => v * step);
        let [t, r, b, l] = m();
        const h = ev.target.dataset && ev.target.dataset.h ? ev.target.dataset.h : 'move';
        if (h === 'move') {
          const ddx = Math.max(-l, Math.min(r, mx)), ddy = Math.max(-t, Math.min(b, my));
          l += ddx; r -= ddx; t += ddy; b -= ddy;
        } else {
          if (/w/.test(h)) l = Math.max(0, l + mx);
          if (/e/.test(h)) r = Math.max(0, r - mx);
          if (/n/.test(h)) t = Math.max(0, t + my);
          if (/s/.test(h)) b = Math.max(0, b - my);
        }
        setM(t, r, b, l);
      });
      fit.addEventListener('click', () => {
        if (!cropState) return;
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
        for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
          const i = (y * cv.width + x) * 4;
          if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 < 0) { say('Nothing is drawn on this page, so there is nothing to fit to.', 'note'); return; }
        const k = cropState.scale * cropState.dpr, pad = 2 * MMPT;
        setM(y0 / k - pad, cropState.w - (x1 + 1) / k - pad, cropState.h - (y1 + 1) / k - pad, x0 / k - pad);
      });
      prev.addEventListener('click', () => show(cropPage - 1));
      next.addEventListener('click', () => show(cropPage + 1));
      ['top', 'right', 'bottom', 'left'].forEach((k) => { const rd = reader(CROP[k]); if (rd && !rd.__crop) { rd.__crop = true; rd.input.addEventListener('input', () => place2()); } });
      await show(cropPage);
    }

    /* ================================================================ */
    /* live preview: the real output of one page, before you commit      */
    /* ================================================================ */
    let livePage = 0, liveSeq = 0, liveTimer = null, liveBound = false;
    function paintLive() {
      const src = ready()[0];
      if (!src) return;
      live.hidden = false;
      if (!live.__built || live.__entry !== src.id) {
        live.innerHTML = '';
        live.__built = true; live.__entry = src.id;
        livePage = 0;
        const total = src.pages;
        const head = el('div', 'place-head');
        head.appendChild(el('span', 'place-title', 'Preview: the page as it will be saved'));
        const pager = el('div', 'place-pager');
        const prev = btn('‹', 'btn-ghost', 'Previous page');
        const lab = el('span', 'place-page-num');
        const next = btn('›', 'btn-ghost', 'Next page');
        pager.appendChild(prev); pager.appendChild(lab); pager.appendChild(next);
        if (total > 1) head.appendChild(pager);
        live.appendChild(head);
        const stage = el('div', 'place-stage');
        const cv = el('canvas', 'place-canvas live-canvas');
        cv.setAttribute('role', 'img');
        stage.appendChild(cv);
        live.appendChild(stage);
        const note = el('p', 'place-readout live-note');
        note.setAttribute('aria-live', 'polite');
        live.appendChild(note);
        live.__ui = { cv, lab, prev, next, note, total };
        prev.addEventListener('click', () => { livePage = Math.max(0, livePage - 1); renderLive(); });
        next.addEventListener('click', () => { livePage = Math.min(total - 1, livePage + 1); renderLive(); });
      }
      if (!liveBound) {
        liveBound = true;
        const again = () => { clearTimeout(liveTimer); liveTimer = setTimeout(renderLive, 280); };
        opts.addEventListener('input', again);
        opts.addEventListener('change', again);
      }
      renderLive();
    }
    async function renderLive() {
      const src = ready()[0];
      const ui = live.__ui;
      if (!src || !ui) return;
      const my = ++liveSeq;
      ui.lab.textContent = 'Page ' + (livePage + 1) + ' of ' + ui.total;
      ui.prev.disabled = livePage === 0;
      ui.next.disabled = livePage >= ui.total - 1;
      let res;
      try { res = await engine.run({ entries: [src], opts: readOpts(), preview: { pageIndex: livePage } }); }
      catch (e) { if (my === liveSeq) ui.note.textContent = e && e.name === 'AbortError' ? '' : 'The preview could not be made: ' + ((e && e.message) || 'unknown error'); return; }
      if (my !== liveSeq) return;
      if (!res || res.error) { ui.note.textContent = res && res.error ? res.error : ''; ui.note.className = 'place-readout live-note is-off'; return; }
      const f = (res.files || [])[0];
      if (!f) return;
      try {
        const pdf = await openWithPdfJs(f.bytes);
        if (my !== liveSeq) return;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const wide = Math.min(620, Math.max(260, (live.clientWidth || 560) - 30));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const scale = Math.min(1.6, wide / base.width);
        const vp = page.getViewport({ scale: scale * dpr });
        const tmp = el('canvas'); tmp.width = Math.round(vp.width); tmp.height = Math.round(vp.height);
        const tctx = tmp.getContext('2d');
        tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, tmp.width, tmp.height);
        await page.render({ canvasContext: tctx, viewport: vp }).promise;
        if (my !== liveSeq) return;
        ui.cv.width = tmp.width; ui.cv.height = tmp.height;
        ui.cv.style.width = Math.round(vp.width / dpr) + 'px';
        ui.cv.style.height = Math.round(vp.height / dpr) + 'px';
        ui.cv.getContext('2d').drawImage(tmp, 0, 0);
        ui.cv.setAttribute('aria-label', 'Page ' + (livePage + 1) + ' as it will be saved with these settings');
        ui.note.className = 'place-readout live-note';
        ui.note.textContent = 'Drawn from the real output for this page — what you see is what the file will hold.';
        pdf.destroy && pdf.destroy();
      } catch (e) { if (my === liveSeq) ui.note.textContent = 'The preview could not be drawn; the tool still works.'; }
    }

    /* ================================================================ */
    /* running                                                           */
    /* ================================================================ */
    let busy = false;
    let job = null;

    function startJob(label) {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : { signal: { aborted: false }, abort() { this.signal.aborted = true; } };
      const j = { ctrl, cancelled: false, shown: false, t0: Date.now() };
      progLabel.textContent = label || 'Working…';
      progFill.style.width = '0%';
      prog.classList.add('is-indeterminate');
      /* only a job that takes a while gets a bar: a flash of one for a
         50 ms run is noise */
      j.timer = setTimeout(() => { prog.hidden = false; j.shown = true; }, 300);
      j.progress = (done, total, what) => {
        if (j.cancelled) return;
        if (total > 0) {
          prog.classList.remove('is-indeterminate');
          progFill.style.width = Math.min(100, Math.round(done / total * 100)) + '%';
          progLabel.textContent = (what === 'page' ? 'Writing page ' + done + ' of ' + total
            : what ? what + (total > 1 ? ' — ' + done + ' of ' + total : '') : Math.round(done / total * 100) + '%');
        } else if (what) progLabel.textContent = what;
      };
      j.done = () => { clearTimeout(j.timer); prog.hidden = true; prog.classList.remove('is-indeterminate'); if (job === j) job = null; };
      job = j;
      return j;
    }
    progCancel.addEventListener('click', () => {
      if (!job) return;
      job.cancelled = true;
      try { job.ctrl.abort(); } catch (e) { /* */ }
      engine.cancel();
      progLabel.textContent = 'Cancelling…';
    });

    /** What a spec's mainRun and mountExtras get to work with. */
    function api(j) {
      return {
        spec, core, engine,
        entries: ready(),
        opts: readOpts(),
        text: textArea ? textArea.value : '',
        pdfjs: loadPdfJs,
        openPdf: (entry) => pdfFor(entry),
        openBytes: (bytes, password) => openWithPdfJs(bytes, password),
        progress: j ? j.progress : () => {},
        signal: j ? j.ctrl.signal : null,
        cancelled: () => !!(j && j.cancelled),
        say, reveal,
        get: readOpts,
        set: (o) => Object.keys(o || {}).forEach((k) => { const r = reader(k); if (r) r.set(o[k]); }),
        reader, el, btn, store, download, fmtBytes,
        results, actions, renderStats,
        storageKey: (suffix) => KEY + (suffix ? '-' + suffix : ''),
        loadScript,
        addFiles: (list) => loadFiles(list),
        removeEntry: (entry) => { const i = entries.indexOf(entry); if (i >= 0) { engine.drop(entry); entries.splice(i, 1); renderFileList(); afterFilesChanged(); } },
        allEntries: () => entries.slice(),
        refreshFiles: () => { renderFileList(); updateSticky(); },
        ENGINE_BASE
      };
    }

    async function run() {
      if (busy) return;
      clearOutputs();
      if (needsFiles && !ready().length && entries.some((e) => e.state === 'loading')) {
        say('Wait a moment: ' + entries.filter((e) => e.state === 'loading').map((e) => e.name).join(', ') + ' is still being read.', 'note');
        return;
      }
      if (needsFiles && !ready().length) {
        const locked = entries.find((e) => e.state === 'locked');
        say(locked ? 'Enter the password for ' + locked.name + ' first, or remove it.' : (spec.needFile || 'Choose a PDF first.'), 'note');
        if (locked) { const i = fileList.querySelector('#pw-' + locked.id); if (i) i.focus(); }
        return;
      }
      const waiting = entries.filter((e) => e.state === 'locked' || e.state === 'loading');
      if (waiting.length && spec.multiple) {
        say('Open or remove ' + waiting.map((e) => e.name).join(', ') + ' first: ' + (waiting[0].state === 'locked' ? 'it needs its password.' : 'it is still being read.'), 'note');
        return;
      }
      busy = true;
      runBtn.disabled = true;
      const was = runBtn.textContent;
      runBtn.textContent = 'Working…';
      say('');
      const j = startJob(spec.progressLabel || 'Working…');
      try {
        let res;
        if (typeof spec.mainRun === 'function') res = await spec.mainRun(api(j));
        else if (spec.kind === 'render') res = await runRender(j);
        else res = await engine.run({ entries: ready(), opts: readOpts(), text: textArea ? textArea.value : '', progress: j.progress });
        if (j.cancelled) throw abortError();
        if (res === undefined && spec.kind === 'render') return;
        if (!res) { say('That produced no result.', 'error'); reveal(msg); return; }
        if (res.error) { say(res.error, 'error'); reveal(msg); return; }
        if (res.warn) say(res.warn, 'warn');
        if (res.note) say(res.note, 'note');
        if (res.report) {
          report.textContent = res.report; report.hidden = false;
          if (spec.copyReport) {
            const cp = btn('Copy the text', 'btn-ghost');
            cp.addEventListener('click', async () => {
              try { await navigator.clipboard.writeText(res.fullText || res.report); cp.textContent = 'Copied'; }
              catch (e) { const r = document.createRange(); r.selectNodeContents(report); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); cp.textContent = 'Selected: press Ctrl+C'; }
              setTimeout(() => { cp.textContent = 'Copy the text'; }, 2500);
            });
            actions.appendChild(cp);
          }
        }
        renderStats(res.stats);
        const files = res.files || [];
        if (files.length) await showResult(files);
        if (files.length > 1) {
          const list = el('div', 'pdf-file-grid');
          files.slice(0, 60).forEach((f) => {
            const card = el('div', 'pdf-file-card');
            card.appendChild(el('span', 'pdf-file-name', f.name));
            card.appendChild(el('span', 'file-size', fmtBytes(f.bytes.length)));
            const b = btn('Save', 'btn-ghost');
            b.setAttribute('aria-label', 'Save ' + f.name);
            b.addEventListener('click', () => download(f.bytes, f.name, f.type));
            card.appendChild(b);
            list.appendChild(card);
          });
          if (files.length > 60) list.appendChild(el('p', 'io-msg is-note', (files.length - 60) + ' more files are in the ZIP.'));
          results.appendChild(list);
        }
      } catch (e) {
        if (e && e.name === 'AbortError') say('Cancelled. Nothing was saved, and your files are still here to try again.', 'note');
        else if (e && (e instanceof RangeError || /memory|allocation/i.test(e.message || '')))
          say('This device ran out of memory on that file. Try fewer pages at a time, or a computer with more memory.', 'error');
        else say('Something went wrong: ' + (e && e.message ? e.message : 'unknown error'), 'error');
        reveal(msg);
      } finally {
        j.done();
        busy = false;
        runBtn.disabled = false;
        runBtn.textContent = was;
        updateSticky();
      }
    }

    /* ---------- pdf.js tools: pages to pictures ---------- */
    async function runRender(j) {
      const o = readOpts();
      const src = ready()[0];
      let pdf;
      try {
        j.progress(0, 0, 'Loading the PDF rendering engine');
        pdf = await pdfFor(src);
      } catch (e) {
        say('The rendering engine could not be loaded. Reload the page and try again — the other PDF tools all work without it.', 'error');
        return;
      }
      let idx;
      try { idx = orderedPages(core, o.pages, pdf.numPages); }
      catch (e) { say(e.message, 'error'); return; }

      let dpi = Number(o.dpi) || 150;
      const fmt = o.format || 'image/png';
      const q = Math.max(0.4, Math.min(1, (Number(o.quality) || 90) / 100));
      const base = stem(src.name);
      const files = [];
      const turns = o.turns || {};
      let clamped = 0;

      for (let n = 0; n < idx.length; n++) {
        if (j.cancelled) throw abortError();
        const i = idx[n];
        j.progress(n, idx.length, 'Drawing page ' + (i + 1));
        const page = await pdf.getPage(i + 1);
        const rotation = (page.rotate + (turns[i] || 0)) % 360;
        let vp = page.getViewport({ scale: dpi / 72, rotation });
        /* a canvas larger than the browser allows comes back blank; draw at
           the largest size that fits and say so, rather than hand over an
           empty picture */
        let pageDpi = dpi;
        if (vp.width * vp.height > MAX_CANVAS) {
          pageDpi = Math.floor(dpi * Math.sqrt(MAX_CANVAS / (vp.width * vp.height)));
          vp = page.getViewport({ scale: pageDpi / 72, rotation });
          clamped++;
        }
        const canvas = el('canvas');
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const blob = await new Promise((r) => canvas.toBlob(r, fmt, q));
        if (!blob) throw new Error('Page ' + (i + 1) + ' could not be encoded. Try a lower resolution.');
        /* the extension is the format the browser actually wrote: Safari
           without WebP hands back a PNG when asked for WebP */
        const ext = EXT[blob.type] || 'png';
        const file = { name: base + '-p' + (i + 1) + '.' + ext, blob, w: canvas.width, h: canvas.height };
        files.push(file);
        canvas.width = canvas.height = 0;

        const card = el('div', 'pdf-file-card');
        const img = el('img', 'image-preview');
        img.src = URL.createObjectURL(blob);
        img.alt = 'Page ' + (i + 1);
        card.appendChild(img);
        card.appendChild(el('span', 'pdf-file-name', 'Page ' + (i + 1)));
        card.appendChild(el('span', 'file-size', file.w + '×' + file.h + ' · ' + fmtBytes(blob.size) + ' · ' + ext.toUpperCase()));
        const b = btn('Save', 'btn-ghost');
        b.setAttribute('aria-label', 'Save ' + file.name);
        /* each card saves its own picture under its own name */
        b.addEventListener('click', () => download(file.blob, file.name));
        card.appendChild(b);
        results.appendChild(card);
      }
      j.progress(idx.length, idx.length, 'Done');

      if (files.length > 1) {
        const zip = btn('Download all ' + files.length + ' as ZIP', 'btn-primary');
        zip.addEventListener('click', async () => {
          if (!window.MVRZip) { say('The ZIP writer did not load.', 'error'); return; }
          download(await window.MVRZip(files.map((f) => ({ name: f.name, blob: f.blob }))), base + '-images.zip', 'application/zip');
        });
        actions.appendChild(zip);
      }
      const types = [...new Set(files.map((f) => f.blob.type))];
      if (types.length && types[0] !== fmt) say('This browser cannot write ' + (EXT[fmt] || fmt).toUpperCase() + ', so the pictures are ' + types.map((t) => (EXT[t] || t).toUpperCase()).join(', ') + ' instead.', 'warn');
      if (clamped) say(clamped + ' page' + (clamped === 1 ? ' was' : 's were') + ' too large for this browser at ' + dpi + ' DPI and ' + (clamped === 1 ? 'was' : 'were') + ' drawn at the largest size it allows instead.', 'warn');
      renderStats([
        ['Source pages', String(pdf.numPages)],
        ['Images produced', String(files.length)],
        ['Resolution', dpi + ' DPI'],
        ['Total size', fmtBytes(files.reduce((s, f) => s + f.blob.size, 0))]
      ]);
      reveal(results);
      return undefined;
    }

    /* A spec tends to echo the raw option back - "Position: bc" - because
       that is what it was given. The control knows what "bc" was called on
       the way in, so say that. Numbers are left alone. */
    function optionLabel(value) {
      const v = String(value);
      if (/^-?[\d.,]+$/.test(v)) return null;
      for (const c of spec.controls || []) {
        if (c.type !== 'select') continue;
        for (const o of c.options || []) if (String(o.value) === v) return o.label;
      }
      return null;
    }
    function renderStats(rows) {
      stats.innerHTML = '';
      (rows || []).forEach((r) => {
        const row = el('div', 'stat-row');
        row.appendChild(el('span', 'stat-key', r[0]));
        row.appendChild(el('span', 'stat-val', optionLabel(r[1]) || r[1]));
        stats.appendChild(row);
      });
    }

    /* ---------- the result, before it is downloaded ---------- */
    function reveal(node) {
      const h = document.querySelector('.site-header');
      const sticky = (h && getComputedStyle(h).position === 'sticky') ? h.getBoundingClientRect().height : 0;
      const top = node.getBoundingClientRect().top;
      if (top < sticky + 12 || top > window.innerHeight * 0.6) {
        window.scrollTo({ top: window.scrollY + top - sticky - 12, behavior: 'smooth' });
      }
    }

    let viewState = null;
    function clearResult() {
      summary.hidden = true; summary.innerHTML = '';
      viewer.hidden = true; viewer.innerHTML = '';
      viewState = null;
    }
    const isPdf = (f) => !f.type || f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

    async function showResult(files) {
      const pagesOf2 = (f) => f.pages ? f.pages + (f.pages === 1 ? ' page' : ' pages') : null;
      /* page counts come from pdf.js, which parses in its own worker */
      for (const f of files.slice(0, 60)) {
        if (f.pages || !isPdf(f) || f.bytes.length > 50 * 1048576) continue;
        try { const d = await openWithPdfJs(f.bytes); f.pages = d.numPages; d.destroy && d.destroy(); }
        catch (e) { f.pages = null; }
      }
      summary.innerHTML = '';
      const head = el('div', 'pdf-summary-head');
      head.appendChild(el('span', 'pdf-summary-tick', '✓'));
      const what = el('div', 'pdf-summary-what');
      if (files.length === 1) {
        const nm = nameFor(files[0].name, files[0].type || typeFromName(files[0].name) || 'application/pdf');
        files[0].name = nm;
        what.appendChild(el('strong', 'pdf-summary-name', nm));
        what.appendChild(el('span', 'pdf-summary-meta', [pagesOf2(files[0]), fmtBytes(files[0].bytes.length)].filter(Boolean).join(' · ')));
      } else {
        const pages = files.reduce((n, f) => n + (f.pages || 0), 0);
        what.appendChild(el('strong', 'pdf-summary-name', files.length + ' files'));
        what.appendChild(el('span', 'pdf-summary-meta', (pages ? pages + ' pages · ' : '') + fmtBytes(files.reduce((n, f) => n + f.bytes.length, 0))));
      }
      head.appendChild(what);
      summary.appendChild(head);

      const acts = el('div', 'pdf-summary-actions');
      if (files.length === 1) {
        const f = files[0];
        const b = btn('Download ' + f.name, 'btn-primary');
        b.addEventListener('click', () => download(f.bytes, f.name, f.type));
        acts.appendChild(b);
      } else {
        const zipName = stem((ready()[0] || {}).name || spec.id || 'output') + '-' + (spec.zipSuffix || 'files') + '.zip';
        const zip = btn('Download all ' + files.length + ' as ZIP', 'btn-primary');
        zip.addEventListener('click', async () => {
          if (!window.MVRZip) { say('The ZIP writer did not load.', 'error'); return; }
          zip.disabled = true; zip.textContent = 'Packing…';
          try {
            const blob = await window.MVRZip(files.map((f) => ({ name: f.name, blob: new Blob([f.bytes], { type: f.type || 'application/pdf' }) })));
            download(blob, zipName, 'application/zip');
          } finally { zip.disabled = false; zip.textContent = 'Download all ' + files.length + ' as ZIP'; }
        });
        acts.appendChild(zip);
      }
      summary.appendChild(acts);
      summary.hidden = false;
      reveal(summary);
      const pdfs = files.filter(isPdf);
      if (!spec.noPreview && pdfs.length) openViewer(pdfs);
    }

    const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    async function openViewer(files) {
      viewer.innerHTML = '';
      viewer.hidden = false;
      viewer.appendChild(el('p', 'place-note', 'Preparing the preview…'));
      let lib;
      try { lib = await loadPdfJs(); }
      catch (e) {
        viewer.innerHTML = '';
        viewer.appendChild(el('p', 'place-note', 'The preview could not load. The download above is not affected.'));
        return;
      }
      if (viewer.hidden) return;
      viewState = { files, fileIndex: 0, page: 0, zoom: 'fit', pdf: null, scale: 1 };
      viewer.innerHTML = '';
      const bar = el('div', 'pdf-view-bar');
      let fileSel = null;
      if (files.length > 1) {
        fileSel = el('select', 'control pdf-view-file');
        fileSel.setAttribute('aria-label', 'Which file to preview');
        files.forEach((f, i) => {
          const o = el('option', null, f.name + (f.pages ? ' · ' + f.pages + (f.pages === 1 ? ' page' : ' pages') : ''));
          o.value = String(i);
          fileSel.appendChild(o);
        });
        bar.appendChild(fileSel);
      }
      const pager = el('div', 'place-pager');
      const prev = btn('‹', 'btn-ghost', 'Previous page');
      const num = el('span', 'place-page-num');
      const next = btn('›', 'btn-ghost', 'Next page');
      pager.appendChild(prev); pager.appendChild(num); pager.appendChild(next);
      bar.appendChild(pager);
      const zoom = el('div', 'pdf-view-zoom');
      const zOut = btn('−', 'btn-ghost', 'Zoom out');
      const zFit = btn('Fit', 'btn-ghost'); zFit.title = 'Fit the page to the width';
      const zIn = btn('+', 'btn-ghost', 'Zoom in');
      const zPct = el('span', 'pdf-view-pct');
      zPct.setAttribute('aria-live', 'polite');
      zoom.appendChild(zOut); zoom.appendChild(zFit); zoom.appendChild(zIn); zoom.appendChild(zPct);
      bar.appendChild(zoom);
      viewer.appendChild(bar);
      const stage = el('div', 'pdf-view-stage');
      stage.tabIndex = 0;
      stage.setAttribute('role', 'region');
      stage.setAttribute('aria-label', 'Preview of the output. Plus and minus zoom; Page Up and Page Down turn the page.');
      const canvas = el('canvas', 'pdf-view-canvas');
      stage.appendChild(canvas);
      viewer.appendChild(stage);
      const note = el('p', 'place-readout');
      viewer.appendChild(note);

      const open = async (i) => {
        const f = files[i];
        viewState.fileIndex = i;
        viewState.page = 0;
        const copy = new Uint8Array(f.bytes.length);
        copy.set(f.bytes);
        viewState.pdf = await lib.getDocument({ data: copy, cMapUrl: PDFJS_BASE + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS_BASE + 'standard_fonts/', isEvalSupported: false }).promise;
        await paint();
      };
      const paint = async () => {
        const st = viewState;
        if (!st || !st.pdf) return;
        const page = await st.pdf.getPage(st.page + 1);
        const base = page.getViewport({ scale: 1 });
        const avail = Math.max(240, stage.clientWidth - 2);
        const fit = avail / base.width;
        const scale = st.zoom === 'fit' ? fit : st.zoom;
        st.scale = scale;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale: scale * dpr });
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        canvas.style.width = Math.round(vp.width / dpr) + 'px';
        canvas.style.height = Math.round(vp.height / dpr) + 'px';
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        num.textContent = 'Page ' + (st.page + 1) + ' of ' + st.pdf.numPages;
        prev.disabled = st.page === 0;
        next.disabled = st.page >= st.pdf.numPages - 1;
        zPct.textContent = Math.round(scale * 100) + '%';
        zOut.disabled = scale <= ZOOMS[0] + 0.01;
        zIn.disabled = scale >= ZOOMS[ZOOMS.length - 1] - 0.01;
        note.textContent = Math.round(base.width) + ' × ' + Math.round(base.height) + ' pt' + (st.zoom === 'fit' ? ' · fitted to width' : '');
      };
      const step = (dir) => {
        const st = viewState;
        const cur = st.scale;
        const nx = dir > 0 ? ZOOMS.find((z) => z > cur + 0.01) : [...ZOOMS].reverse().find((z) => z < cur - 0.01);
        if (nx === undefined) return;
        st.zoom = nx;
        paint();
      };
      prev.addEventListener('click', () => { viewState.page--; paint(); });
      next.addEventListener('click', () => { viewState.page++; paint(); });
      zIn.addEventListener('click', () => step(1));
      zOut.addEventListener('click', () => step(-1));
      zFit.addEventListener('click', () => { viewState.zoom = 'fit'; paint(); });
      if (fileSel) fileSel.addEventListener('change', () => open(Number(fileSel.value)));
      stage.addEventListener('keydown', (ev) => {
        if (ev.key === '+' || ev.key === '=') step(1);
        else if (ev.key === '-' || ev.key === '_') step(-1);
        else if (ev.key === '0') { viewState.zoom = 'fit'; paint(); }
        else if (ev.key === 'PageDown' && !next.disabled) { viewState.page++; paint(); }
        else if (ev.key === 'PageUp' && !prev.disabled) { viewState.page--; paint(); }
        else return;
        ev.preventDefault();
      });
      stage.addEventListener('dblclick', () => { viewState.zoom = viewState.zoom === 'fit' ? 2 : 'fit'; paint(); });
      let resizeTimer = null;
      window.addEventListener('resize', () => {
        if (!viewState || viewState.zoom !== 'fit') return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(paint, 150);
      });
      try { await open(0); }
      catch (e) {
        viewer.innerHTML = '';
        viewer.appendChild(el('p', 'place-note', 'This output could not be previewed, but it can still be downloaded.'));
      }
    }

    /* ---------- wiring ---------- */
    if (drop) {
      drop.addEventListener('click', (ev) => { if (ev.target !== fileInput) fileInput.click(); });
      drop.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
      });
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
      fileInput.addEventListener('change', () => { if (fileInput.files.length) { const l = [...fileInput.files]; fileInput.value = ''; loadFiles(l); } });
    }
    runBtn.addEventListener('click', run);

    if (typeof spec.mountExtras === 'function') {
      extras.hidden = false;
      try { spec.mountExtras(Object.assign(api(null), { root: extras })); }
      catch (e) { extras.hidden = true; }
    }

    /* On a phone the button lands a screen or two below the page you are
       aiming at. While it is off screen and there is something to run, a
       copy of it sits at the bottom of the viewport; it goes the moment a
       result appears, because the result scrolls into view on its own. */
    let updateSticky = () => {};
    (function stickyRun() {
      if (!('IntersectionObserver' in window) || !window.matchMedia) return;
      const narrow = window.matchMedia('(max-width: 640px)');
      const bar = el('div', 'pdf-run-sticky');
      bar.hidden = true;
      const copy = btn(runBtn.textContent, 'btn-primary');
      copy.addEventListener('click', () => { bar.hidden = true; run(); });
      bar.appendChild(copy);
      document.body.appendChild(bar);
      let runVisible = true;
      const update = () => {
        const isReady = needsFiles ? ready().length > 0 : true;
        const consentUp = !!document.querySelector('.cc');
        const show = narrow.matches && isReady && !runVisible && summary.hidden && !runBtn.disabled && !consentUp;
        bar.hidden = !show;
        copy.textContent = runBtn.textContent;
        io.classList.toggle('has-sticky-run', show);
      };
      updateSticky = () => setTimeout(update, 60);
      new IntersectionObserver((list) => { runVisible = list[0].isIntersecting; update(); }, { threshold: 0 }).observe(runBar);
      if (narrow.addEventListener) narrow.addEventListener('change', update);
      else if (narrow.addListener) narrow.addListener(update);
      const later = () => setTimeout(update, 60);
      if (fileInput) fileInput.addEventListener('change', later);
      io.addEventListener('click', later);
      io.addEventListener('drop', later);
      new MutationObserver(later).observe(summary, { attributes: true, attributeFilter: ['hidden'] });
      new MutationObserver((muts) => {
        if (muts.some((m) => [...m.removedNodes, ...m.addedNodes].some((n) => n.classList && n.classList.contains('cc')))) later();
      }).observe(document.body, { childList: true });
    })();

    /* for tests and for specs that need to reach the shell */
    root.__pdfShell = { engine, entries: () => entries, run, readOpts, grid: () => grid };
  };

  /* shared with specs and tests */
  window.MVRTool.pdfShell = { rangeText, orderedPages, nameFor, readImage, jpegInfo, loadPdfJs, openWithPdfJs, ENGINE_BASE, PDFJS_BASE, MAX_FILE, MAX_PAGES };
})();
