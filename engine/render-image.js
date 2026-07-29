/**
 * Image tool renderer.
 *
 * One pipeline for every image tool: files in -> decode -> canvas -> encode
 * -> download. Each spec contributes only its controls and a paint function,
 * so behaviour that matters everywhere — drag and drop, previews, batch ZIP,
 * error handling, memory cleanup — is written once and fixed once.
 *
 * Nothing is uploaded. Every operation runs against a local canvas.
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

  /* ---------- helpers handed to each spec's paint() ---------- */
  function makeHelpers(canvas, ctx) {
    return {
      size(w, h) {
        canvas.width = Math.max(1, Math.round(w));
        canvas.height = Math.max(1, Math.round(h));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      },
      fill(colour) {
        ctx.save();
        ctx.fillStyle = colour;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      },
      fillOn(c, colour, w, h) {
        c.save(); c.fillStyle = colour; c.fillRect(0, 0, w, h); c.restore();
      },
      fit(img, maxW, maxH) {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (maxW && w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
        if (maxH && h > maxH) { w = Math.round(w * (maxH / h)); h = maxH; }
        return { w, h };
      },
      roundRect(c, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
      },
      scratch(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w));
        c.height = Math.max(1, Math.round(h));
        return { canvas: c, ctx: c.getContext('2d') };
      }
    };
  }

  /* ---------- control builder ---------- */
  function buildControl(c) {
    const wrap = el('div', 'field');
    const id = 'ic-' + c.key;
    const label = el('label', null, c.label);
    label.setAttribute('for', id);
    wrap.appendChild(label);

    let read;
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
    } else if (c.type === 'color') {
      const row = el('div', 'colour-field');
      const sw = el('input', 'colour-swatch');
      sw.type = 'color'; sw.value = c.default;
      const hex = el('input', 'control colour-hex');
      hex.type = 'text'; hex.value = c.default; hex.spellcheck = false;
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
    } else if (c.type === 'presets') {
      const box = el('div', 'preset-list');
      (window.MVRImage.SOCIAL_PRESETS || []).forEach((p, i) => {
        const lab = el('label', 'preset-item');
        const cb = el('input');
        cb.type = 'checkbox'; cb.value = String(i); cb.checked = true;
        lab.appendChild(cb);
        lab.appendChild(el('span', 'preset-name', `${p.group} · ${p.name}`));
        lab.appendChild(el('span', 'preset-dim', `${p.w}×${p.h}`));
        box.appendChild(lab);
      });
      wrap.appendChild(box);
      read = () => [...box.querySelectorAll('input:checked')].map(i => Number(i.value));
    } else if (c.type === 'text') {
      const t = el('input', 'control');
      t.type = 'text'; t.id = id; t.name = c.key; t.value = c.default || '';
      wrap.appendChild(t);
      read = () => t.value;
    } else {
      const n = el('input', 'control');
      n.type = 'number'; n.id = id; n.name = c.key;
      n.inputMode = 'numeric';
      if (c.min !== undefined) n.min = c.min;
      if (c.max !== undefined) n.max = c.max;
      n.value = c.default;
      wrap.appendChild(n);
      read = () => n.value;
    }
    return { wrap, read, key: c.key };
  }

  /* ---------- main mount ---------- */
  window.MVRTool.mountImage = function (spec, root) {
    const io = root.querySelector('.tool-io');
    const CORE = window.MVRImage;

    /* file input */
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0;
    drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>' + (spec.multiple ? 'Choose images' : 'Choose an image') +
      '</strong><span>or drag ' + (spec.multiple ? 'them' : 'it') + ' here — nothing is uploaded</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file';
    file.accept = spec.kind === 'text' ? '.svg,image/svg+xml' : 'image/*';
    if (spec.multiple) file.multiple = true;
    drop.appendChild(file);

    const fileList = el('div', 'file-list');
    const opts = el('div', 'opt-bar');
    const readers = (spec.controls || []).map(c => {
      const b = buildControl(c);
      opts.appendChild(b.wrap);
      return b;
    });

    const msg = el('div', 'io-msg');
    const stage = el('div', 'image-stage');
    const actions = el('div', 'io-actions image-actions');
    const stats = el('div', 'stat-grid');

    io.appendChild(drop);
    if (spec.controls && spec.controls.length) io.appendChild(opts);
    io.appendChild(fileList);
    io.appendChild(msg);
    io.appendChild(stage);
    io.appendChild(actions);
    io.appendChild(stats);

    let sources = [];       // {file, img, bytes}
    let selection = null;   // {x,y,w,h} in source pixels
    let outputs = [];       // {name, blob}

    const say = (text, kind) => {
      msg.textContent = text || '';
      msg.className = 'io-msg' + (kind ? ' is-' + kind : '');
    };

    const readOpts = () => {
      const o = {};
      readers.forEach(r => { o[r.key] = r.read(); });
      return o;
    };

    /* ---- loading ---- */
    function loadFiles(list) {
      const files = [...list].filter(f => /^image\//.test(f.type) || /\.svg$/i.test(f.name));
      if (!files.length) { say('Those files are not images. Choose PNG, JPEG, WebP, GIF or SVG.', 'error'); return; }

      sources.forEach(s => { if (s.url) URL.revokeObjectURL(s.url); });
      sources = [];
      selection = null;
      say('Reading…', 'note');

      const take = spec.multiple ? files : files.slice(0, 1);
      let pending = take.length;

      take.forEach((f, idx) => {
        const reader = new FileReader();
        reader.onload = () => {
          const bytes = new Uint8Array(reader.result);
          const url = URL.createObjectURL(f);
          const img = new Image();
          img.onload = () => {
            sources[idx] = { file: f, img, bytes, url };
            if (--pending === 0) { sources = sources.filter(Boolean); afterLoad(); }
          };
          img.onerror = () => {
            if (--pending === 0) { sources = sources.filter(Boolean); afterLoad(); }
          };
          img.src = url;
        };
        reader.onerror = () => { if (--pending === 0) { sources = sources.filter(Boolean); afterLoad(); } };
        reader.readAsArrayBuffer(f);
      });
    }

    function afterLoad() {
      if (!sources.length) { say('None of those files could be decoded.', 'error'); return; }
      say('');
      drop.innerHTML = '<strong>' + (sources.length === 1 ? sources[0].file.name : sources.length + ' images')
        + '</strong><span>click to choose ' + (spec.multiple ? 'different files' : 'another image') + '</span>';
      drop.appendChild(file);
      renderFileList();
      run();
    }

    function renderFileList() {
      fileList.innerHTML = '';
      if (sources.length < 2) return;
      sources.forEach((s, i) => {
        const row = el('div', 'file-row');
        row.appendChild(el('span', 'file-idx', String(i + 1)));
        row.appendChild(el('span', 'file-name', s.file.name));
        row.appendChild(el('span', 'file-meta',
          `${s.img.naturalWidth}×${s.img.naturalHeight} · ${fmtBytes(s.file.size)}`));
        if (spec.kind === 'binary') {
          const up = el('button', 'btn-ghost', '↑');
          up.type = 'button'; up.title = 'Move up';
          up.addEventListener('click', () => {
            if (i === 0) return;
            [sources[i - 1], sources[i]] = [sources[i], sources[i - 1]];
            renderFileList(); run();
          });
          row.appendChild(up);
        }
        const rm = el('button', 'btn-ghost', '×');
        rm.type = 'button'; rm.title = 'Remove';
        rm.addEventListener('click', () => {
          if (sources[i].url) URL.revokeObjectURL(sources[i].url);
          sources.splice(i, 1);
          if (!sources.length) { stage.innerHTML = ''; actions.innerHTML = ''; }
          renderFileList(); if (sources.length) run();
        });
        row.appendChild(rm);
        fileList.appendChild(row);
      });
    }

    /* ---- encoding ---- */
    function encode(canvas, o) {
      const fmt = spec.outputFormat || (o.format === 'same' ? null : o.format) || 'image/png';
      const q = Math.max(0.1, Math.min(1, (Number(o.quality) || 92) / 100));
      return new Promise(res => canvas.toBlob(res, fmt, q));
    }

    const extFor = (mime) => ({
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'
    })[mime] || 'png';

    const baseName = (s) => (s.file.name.replace(/\.[^.]+$/, '') || 'image');

    /* ---- the run loop, one branch per kind ---- */
    async function run() {
      if (!sources.length) return;
      const o = readOpts();
      stage.innerHTML = '';
      actions.innerHTML = '';
      stats.innerHTML = '';
      outputs = [];

      try {
        if (spec.kind === 'analyse') return await runAnalyse(o);
        if (spec.kind === 'binary') return await runBinary(o);
        if (spec.kind === 'select') return await runSelect(o);
        if (spec.kind === 'multi' || spec.kind === 'preset-multi') return await runMulti(o);
        return await runCanvas(o);
      } catch (e) {
        say('Something went wrong processing that image. ' + (e && e.message ? e.message : ''), 'error');
      }
    }

    /* one in, one out */
    async function runCanvas(o) {
      const total = { before: 0, after: 0 };
      for (const s of sources) {
        const canvas = el('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: spec.kind === 'segment' });
        const h = makeHelpers(canvas, ctx);

        if (spec.kind === 'segment') await applyBackgroundRemoval(canvas, ctx, s.img, o, h);
        else spec.paint(ctx, s.img, o, h);

        const fmt = spec.outputFormat || (o.format === 'same' ? s.file.type : o.format) || 'image/png';
        const blob = await new Promise(r => canvas.toBlob(r, fmt,
          Math.max(0.1, Math.min(1, (Number(o.quality) || 92) / 100))));
        if (!blob) { say('This browser could not encode that format. Try PNG or JPEG.', 'error'); return; }

        const name = `${baseName(s)}-${spec.id || 'out'}.${extFor(fmt)}`;
        outputs.push({ name, blob });
        total.before += s.file.size;
        total.after += blob.size;

        const card = el('div', 'image-card');
        const prev = el('img', 'image-preview');
        prev.src = URL.createObjectURL(blob);
        prev.alt = 'Result preview';
        prev.addEventListener('load', () => setTimeout(() => URL.revokeObjectURL(prev.src), 60000));
        card.appendChild(prev);
        const cap = el('div', 'image-cap');
        cap.appendChild(el('span', null, `${canvas.width}×${canvas.height}`));
        cap.appendChild(el('span', 'file-size', fmtBytes(blob.size)));
        card.appendChild(cap);
        const dl = el('button', 'btn-ghost', 'Download');
        dl.type = 'button';
        dl.addEventListener('click', () => downloadBlob(blob, name));
        card.appendChild(dl);
        stage.appendChild(card);
      }

      addBatchActions();
      const delta = total.before - total.after;
      const rows = [
        ['Images processed', String(sources.length)],
        ['Original total', fmtBytes(total.before)],
        ['Result total', fmtBytes(total.after)],
        ['Change', (delta >= 0 ? '−' : '+') + fmtBytes(Math.abs(delta)) +
          (total.before ? ` (${delta >= 0 ? '−' : '+'}${Math.abs(Math.round(delta / total.before * 100))}%)` : '')]
      ];
      if (spec.showsMetadataDiff && CORE) {
        const segs = CORE.metadataSegments(sources[0].bytes);
        rows.push(['Metadata found in original', segs.length ? segs.map(s => s.name).join(', ') : 'none']);
        rows.push(['Metadata in result', 'none — all segments removed']);
        const ex = CORE.readExif(sources[0].bytes);
        if (ex.gps && ex.gps.latitude !== undefined) {
          rows.push(['GPS removed', `${ex.gps.latitude.toFixed(5)}, ${ex.gps.longitude.toFixed(5)}`]);
        }
      }
      renderStats(rows);
      if (delta < 0) say('The result is larger than the original. Lower the quality or keep the original format.', 'warn');
    }

    /* one in, many out */
    async function runMulti(o) {
      const src = sources[0];
      let jobs;
      if (spec.id === 'social-media-resizer') jobs = socialJobs(src.img, o);
      else if (spec.id === 'passport-photo') jobs = passportJobs(src.img, o);
      else jobs = spec.produce(src.img, o, makeHelpers(el('canvas'), el('canvas').getContext('2d')));

      if (spec.multiple && spec.id === 'bulk-image-resizer') {
        jobs = [];
        for (const s of sources) {
          spec.produce(s.img, o, makeHelpers(el('canvas'), el('canvas').getContext('2d')))
            .forEach(j => jobs.push(Object.assign({ src: s }, j)));
        }
      }

      let totalOut = 0;
      for (const job of jobs) {
        const canvas = el('canvas');
        canvas.width = Math.max(1, Math.round(job.width));
        canvas.height = Math.max(1, Math.round(job.height));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        job.paint(ctx, makeHelpers(canvas, ctx));

        const fmt = spec.outputFormat || o.format || 'image/png';
        const blob = await new Promise(r => canvas.toBlob(r, fmt,
          Math.max(0.1, Math.min(1, (Number(o.quality) || 90) / 100))));
        if (!blob) continue;

        const base = job.src ? baseName(job.src) : baseName(sources[0]);
        const name = `${base}-${job.suffix}.${extFor(fmt)}`;
        outputs.push({ name, blob });
        totalOut += blob.size;

        const card = el('div', 'image-card');
        const prev = el('img', 'image-preview');
        prev.src = URL.createObjectURL(blob);
        prev.alt = job.suffix;
        card.appendChild(prev);
        const cap = el('div', 'image-cap');
        cap.appendChild(el('span', null, job.label || job.suffix));
        cap.appendChild(el('span', 'file-size', `${canvas.width}×${canvas.height} · ${fmtBytes(blob.size)}`));
        card.appendChild(cap);
        const dl = el('button', 'btn-ghost', 'Save');
        dl.type = 'button';
        dl.addEventListener('click', () => downloadBlob(blob, name));
        card.appendChild(dl);
        stage.appendChild(card);
      }

      addBatchActions();
      renderStats([
        ['Files produced', String(outputs.length)],
        ['Total size', fmtBytes(totalOut)],
        ['Source', `${sources[0].img.naturalWidth}×${sources[0].img.naturalHeight}`]
      ]);
      if (!outputs.length) say('Nothing to produce — check the settings above.', 'note');
    }

    function socialJobs(img, o) {
      const chosen = Array.isArray(o.presets) ? o.presets : [];
      return chosen.map(i => {
        const p = CORE.SOCIAL_PRESETS[i];
        if (!p) return null;
        return {
          suffix: `${p.group}-${p.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          label: `${p.group} · ${p.name}`,
          width: p.w, height: p.h,
          paint: (ctx, h) => {
            if (o.mode === 'contain') { ctx.fillStyle = o.bg || '#000'; ctx.fillRect(0, 0, p.w, p.h); }
            const scale = o.mode === 'contain'
              ? Math.min(p.w / img.naturalWidth, p.h / img.naturalHeight)
              : Math.max(p.w / img.naturalWidth, p.h / img.naturalHeight);
            const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
            ctx.drawImage(img, (p.w - dw) / 2, (p.h - dh) / 2, dw, dh);
          }
        };
      }).filter(Boolean);
    }

    function passportJobs(img, o) {
      const p = CORE.PHOTO_PRESETS[Number(o.preset) || 0];
      const pw = CORE.mmToPx(p.w, p.dpi), ph = CORE.mmToPx(p.h, p.dpi);
      const jobs = [];

      const drawOne = (ctx, w, h, dx, dy) => {
        ctx.fillStyle = o.bg || '#ffffff';
        ctx.fillRect(dx, dy, w, h);
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
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

    /* drag-to-select tools */
    async function runSelect(o) {
      const src = sources[0];
      const nw = src.img.naturalWidth, nh = src.img.naturalHeight;
      if (!selection) selection = { x: Math.round(nw * 0.15), y: Math.round(nh * 0.15),
                                    w: Math.round(nw * 0.7), h: Math.round(nh * 0.7) };

      const wrap = el('div', 'select-wrap');
      const view = el('canvas', 'select-canvas');
      const maxW = 720;
      const scale = Math.min(1, maxW / nw);
      view.width = Math.round(nw * scale);
      view.height = Math.round(nh * scale);
      const vctx = view.getContext('2d');

      const paintView = () => {
        vctx.clearRect(0, 0, view.width, view.height);
        vctx.drawImage(src.img, 0, 0, view.width, view.height);
        vctx.fillStyle = 'rgba(6,8,15,.55)';
        vctx.fillRect(0, 0, view.width, view.height);
        const s = { x: selection.x * scale, y: selection.y * scale,
                    w: selection.w * scale, h: selection.h * scale };
        vctx.save();
        vctx.beginPath(); vctx.rect(s.x, s.y, s.w, s.h); vctx.clip();
        vctx.drawImage(src.img, 0, 0, view.width, view.height);
        vctx.restore();
        vctx.strokeStyle = '#f7c948'; vctx.lineWidth = 2;
        vctx.setLineDash([6, 4]);
        vctx.strokeRect(s.x, s.y, s.w, s.h);
        vctx.setLineDash([]);
        readout.textContent = `${Math.round(selection.w)} × ${Math.round(selection.h)} px  ` +
                              `at ${Math.round(selection.x)}, ${Math.round(selection.y)}`;
      };

      const ratio = () => {
        const r = readOpts().ratio;
        if (!r || r === 'free') return null;
        const [a, b] = r.split(':').map(Number);
        return a / b;
      };

      let dragging = false, startX = 0, startY = 0;
      const pos = (e) => {
        const rect = view.getBoundingClientRect();
        const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        return { x: cx / rect.width * nw, y: cy / rect.height * nh };
      };
      const onDown = (e) => {
        e.preventDefault();
        dragging = true;
        const p = pos(e); startX = p.x; startY = p.y;
      };
      const onMove = (e) => {
        if (!dragging) return;
        e.preventDefault();
        const p = pos(e);
        let x = Math.min(startX, p.x), y = Math.min(startY, p.y);
        let w = Math.abs(p.x - startX), h = Math.abs(p.y - startY);
        const ar = ratio();
        if (ar) { if (w / h > ar) w = h * ar; else h = w / ar; }
        selection = {
          x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)),
          w: Math.max(1, Math.round(Math.min(w, nw - x))),
          h: Math.max(1, Math.round(Math.min(h, nh - y)))
        };
        paintView();
      };
      const onUp = () => { if (dragging) { dragging = false; render(); } };

      view.addEventListener('mousedown', onDown);
      view.addEventListener('touchstart', onDown, { passive: false });
      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);

      const readout = el('div', 'select-readout');
      const hint = el('p', 'select-hint', 'Drag on the image to set the area.');
      wrap.appendChild(hint);
      wrap.appendChild(view);
      wrap.appendChild(readout);
      stage.appendChild(wrap);

      const resultHost = el('div', 'image-card');
      stage.appendChild(resultHost);

      async function render() {
        const oo = readOpts();
        const canvas = el('canvas');
        const ctx = canvas.getContext('2d');
        const h = makeHelpers(canvas, ctx);
        spec.paintSelection(ctx, src.img, selection, oo, h);
        const fmt = spec.outputFormat || oo.format || 'image/png';
        const blob = await new Promise(r => canvas.toBlob(r, fmt,
          Math.max(0.1, Math.min(1, (Number(oo.quality) || 92) / 100))));
        if (!blob) return;
        outputs = [{ name: `${baseName(src)}-${spec.id}.${extFor(fmt)}`, blob }];

        resultHost.innerHTML = '';
        const prev = el('img', 'image-preview');
        prev.src = URL.createObjectURL(blob);
        prev.alt = 'Result';
        resultHost.appendChild(prev);
        const cap = el('div', 'image-cap');
        cap.appendChild(el('span', null, `${canvas.width}×${canvas.height}`));
        cap.appendChild(el('span', 'file-size', fmtBytes(blob.size)));
        resultHost.appendChild(cap);

        actions.innerHTML = '';
        const dl = el('button', 'btn-primary', 'Download result');
        dl.type = 'button';
        dl.addEventListener('click', () => downloadBlob(blob, outputs[0].name));
        actions.appendChild(dl);
        renderStats([
          ['Source', `${nw}×${nh}`],
          ['Selection', `${selection.w}×${selection.h}`],
          ['Output size', fmtBytes(blob.size)]
        ]);
      }

      paintView();
      await render();
    }

    /* metadata / palette / base64 */
    async function runAnalyse(o) {
      const src = sources[0];

      if (spec.id === 'exif-viewer') {
        const ex = CORE.readExif(src.bytes);
        const segs = CORE.metadataSegments(src.bytes);

        const card = el('div', 'image-card image-card-wide');
        const prev = el('img', 'image-preview');
        prev.src = src.url; prev.alt = src.file.name;
        card.appendChild(prev);
        stage.appendChild(card);

        if (!ex.found) {
          say(ex.warnings[0] || 'No EXIF metadata found in this file. It may already have been stripped, or the format may not carry any.', 'note');
        } else if (ex.gps && ex.gps.latitude !== undefined) {
          say(`This photo contains GPS coordinates: ${ex.gps.latitude.toFixed(5)}, ${ex.gps.longitude.toFixed(5)}. Anyone you send the original file to can read them.`, 'warn');
        } else {
          say('Metadata found. Review it below before sharing this file.', 'note');
        }

        const rows = [['File', src.file.name], ['Size', fmtBytes(src.file.size)],
                      ['Dimensions', `${src.img.naturalWidth}×${src.img.naturalHeight}`]];
        if (segs.length) rows.push(['Metadata segments', segs.map(s => `${s.name} (${fmtBytes(s.bytes)})`).join(', ')]);
        Object.keys(ex.tags).forEach(k => {
          if (k === 'OrientationLabel') return;
          const v = ex.tags[k];
          rows.push([k, k === 'Orientation' ? ex.tags.OrientationLabel : String(v)]);
        });
        if (ex.gps) {
          if (ex.gps.latitude !== undefined) {
            rows.push(['GPS latitude', ex.gps.latitude.toFixed(6)]);
            rows.push(['GPS longitude', ex.gps.longitude.toFixed(6)]);
          }
          Object.keys(ex.gps).forEach(k => {
            if (k === 'latitude' || k === 'longitude') return;
            rows.push(['GPS ' + k.replace(/^GPS/, ''), String(ex.gps[k])]);
          });
        }
        renderStats(rows);

        if (ex.gps && ex.gps.latitude !== undefined) {
          const link = el('a', 'btn-ghost', 'Open these coordinates in a map');
          link.href = `https://www.openstreetmap.org/?mlat=${ex.gps.latitude}&mlon=${ex.gps.longitude}#map=15/${ex.gps.latitude}/${ex.gps.longitude}`;
          link.target = '_blank'; link.rel = 'noopener noreferrer';
          actions.appendChild(link);
        }
        return;
      }

      if (spec.id === 'color-palette-extractor') {
        const n = Math.max(2, Math.min(12, Number(o.count) || 6));
        const SAMPLE = 160;
        const scale = Math.min(1, SAMPLE / Math.max(src.img.naturalWidth, src.img.naturalHeight));
        const c = el('canvas');
        c.width = Math.max(1, Math.round(src.img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(src.img.naturalHeight * scale));
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(src.img, 0, 0, c.width, c.height);
        const data = cx.getImageData(0, 0, c.width, c.height).data;

        const pal = CORE.medianCut(data, n);
        const grid = el('div', 'palette-grid');
        pal.forEach(col => {
          const hex = CORE.toHex(col);
          const lum = CORE.relLuminance(col);
          const sw = el('div', 'palette-swatch');
          sw.style.background = hex;
          sw.style.color = lum > 0.4 ? '#06080f' : '#f4f6fb';
          sw.appendChild(el('span', 'palette-hex', hex.toUpperCase()));
          sw.appendChild(el('span', 'palette-share', Math.round(col.share * 100) + '%'));
          sw.title = 'Click to copy ' + hex;
          sw.addEventListener('click', () => {
            navigator.clipboard?.writeText(hex);
            const was = sw.querySelector('.palette-hex').textContent;
            sw.querySelector('.palette-hex').textContent = 'Copied';
            setTimeout(() => { sw.querySelector('.palette-hex').textContent = was; }, 1200);
          });
          grid.appendChild(sw);
        });
        stage.appendChild(grid);

        const css = ':root {\n' + pal.map((c2, i) =>
          `  --colour-${i + 1}: ${CORE.toHex(c2)};`).join('\n') + '\n}';
        const pane = el('div', 'io-pane');
        const head = el('div', 'io-head');
        head.appendChild(el('span', 'io-label', 'CSS custom properties'));
        const copy = el('button', 'btn-copy', 'Copy');
        copy.type = 'button';
        copy.addEventListener('click', () => {
          navigator.clipboard?.writeText(css);
          copy.textContent = 'Copied';
          setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
        });
        const acts = el('div', 'io-actions'); acts.appendChild(copy);
        head.appendChild(acts);
        pane.appendChild(head);
        pane.appendChild(el('pre', 'code-out', css));
        stage.appendChild(pane);

        renderStats(pal.map((c2, i) => {
          const hex = CORE.toHex(c2);
          return [`Colour ${i + 1}  ${hex.toUpperCase()}`,
                  `rgb(${c2.r}, ${c2.g}, ${c2.b}) · ${Math.round(c2.share * 100)}% of image`];
        }));
        return;
      }

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
    async function runBinary(o) {
      say('Building PDF…', 'note');
      const pages = [];
      for (const s of sources) {
        const c = el('canvas');
        c.width = s.img.naturalWidth; c.height = s.img.naturalHeight;
        const cx = c.getContext('2d');
        cx.fillStyle = '#ffffff';
        cx.fillRect(0, 0, c.width, c.height);
        cx.drawImage(s.img, 0, 0);
        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg',
          Math.max(0.4, Math.min(1, (Number(o.quality) || 88) / 100))));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        pages.push({ bytes, width: c.width, height: c.height });

        const card = el('div', 'image-card');
        const prev = el('img', 'image-preview');
        prev.src = s.url; prev.alt = s.file.name;
        card.appendChild(prev);
        card.appendChild(el('div', 'image-cap', `Page ${pages.length}`));
        stage.appendChild(card);
      }

      const pdf = CORE.buildPDF(pages, {
        pageSize: o.pageSize, orientation: o.orientation, margin: Number(o.margin)
      });
      const blob = new Blob([pdf], { type: 'application/pdf' });
      outputs = [{ name: 'images.pdf', blob }];

      const dl = el('button', 'btn-primary', `Download PDF (${pages.length} page${pages.length > 1 ? 's' : ''})`);
      dl.type = 'button';
      dl.addEventListener('click', () => downloadBlob(blob, 'images.pdf'));
      actions.appendChild(dl);

      say('');
      renderStats([
        ['Pages', String(pages.length)],
        ['PDF size', fmtBytes(blob.size)],
        ['Page size', (o.pageSize || 'a4').toUpperCase()],
        ['Embedding', 'JPEG, DCTDecode — no re-compression by the PDF layer']
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
      } else if (outputs.length === 1) {
        const dl = el('button', 'btn-primary', 'Download');
        dl.type = 'button';
        dl.addEventListener('click', () => downloadBlob(outputs[0].blob, outputs[0].name));
        actions.appendChild(dl);
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

    /* ---- background removal ---- */
    async function applyBackgroundRemoval(canvas, ctx, img, o, h) {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      h.size(nw, nh);

      if (o.mode === 'ai') {
        const ok = await ensureAIModel();
        if (ok) {
          try { await window.MVRBgAI(canvas, ctx, img); return; }
          catch (e) { say('The AI model could not process this image; falling back to the automatic method.', 'warn'); }
        }
      }

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

      const tol = Math.max(1, Number(o.tolerance) || 32);
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

    /* The model is several megabytes, so it is fetched only when this mode
       is actually selected, and only on this page. */
    let aiState = 'idle';
    async function ensureAIModel() {
      if (aiState === 'ready') return true;
      if (aiState === 'failed') return false;
      aiState = 'loading';
      say('Downloading the background-removal model (about 5 MB). This happens once, then it is cached.', 'note');
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
        window.MVRBgAI = async (canvas, ctx, img) => {
          const src = document.createElement('canvas');
          src.width = img.naturalWidth; src.height = img.naturalHeight;
          src.getContext('2d').drawImage(img, 0, 0);
          const blob = await new Promise(r => src.toBlob(r, 'image/png'));
          const cut = await mod.removeBackground(blob);
          const out = await createImageBitmap(cut);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(out, 0, 0, canvas.width, canvas.height);
        };
        aiState = 'ready';
        say('');
        return true;
      } catch (e) {
        aiState = 'failed';
        say('The AI model could not be downloaded — you may be offline, or the CDN may be blocked. The automatic method below still works entirely on your device.', 'warn');
        return false;
      }
    }

    /* ---- wiring ---- */
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); }
    });
    ['dragenter', 'dragover'].forEach(ev =>
      drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev =>
      drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); });
    opts.addEventListener('input', () => { if (sources.length) run(); });
    opts.addEventListener('change', () => { if (sources.length) run(); });
  };
})();
