/**
 * PDF tool renderer.
 *
 * One pipeline for every PDF tool: files in -> parse -> run the spec -> offer
 * downloads. Files never leave the device; parsing and writing both happen in
 * the page.
 *
 * The 'render' kind is the only one that pulls in pdf.js, and it does so
 * lazily on first use, because rasterising a page needs a full rendering
 * engine and the other fourteen tools do not.
 */
(function () {
  'use strict';
  window.MVRTool = window.MVRTool || {};

  /* Where pdf.js is vendored, resolved from this script's own URL rather than
     the document's. Tool pages sit one level down (/pdf/x.html) and the site
     has been served from a subpath before, so neither a relative specifier nor
     a root-absolute one is safe here. currentScript is set while a deferred
     classic script runs, which is how this file is loaded. */
  const PDFJS_BASE = (function () {
    const s = document.currentScript ||
      document.querySelector('script[src$="render-pdf.js"]');
    return new URL('vendor/pdfjs/', s ? s.src : location.href).href;
  })();

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const fmtBytes = (n) => n < 1024 ? n + ' B'
    : n < 1048576 ? (n / 1024).toFixed(1) + ' KB'
    : (n / 1048576).toFixed(2) + ' MB';

  function download(bytes, name, type) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: type || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------- controls ---------- */
  function buildControl(c) {
    const wrap = el('div', 'field');
    const id = 'pc-' + c.key;
    const label = el('label', null, c.label);
    label.setAttribute('for', id);
    wrap.appendChild(label);

    let read, primary = null;
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
      primary = s;
      read = () => s.value;
    } else if (c.type === 'textarea') {
      const t = el('textarea', 'control');
      t.id = id; t.name = c.key; t.rows = 4; t.value = c.default || '';
      wrap.appendChild(t);
      primary = t;
      read = () => t.value;
    } else if (c.type === 'color') {
      const row = el('div', 'colour-field');
      const sw = el('input', 'colour-swatch');
      sw.type = 'color'; sw.value = c.default;
      const hex = el('input', 'control colour-hex');
      hex.type = 'text'; hex.value = c.default; hex.spellcheck = false;
      sw.addEventListener('input', () => { hex.value = sw.value; });
      hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) sw.value = hex.value; });
      row.appendChild(sw); row.appendChild(hex);
      wrap.appendChild(row);
      primary = hex;
      read = () => hex.value;
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
    } else {
      const i = el('input', 'control');
      i.type = 'text'; i.id = id; i.name = c.key; i.value = c.default || '';
      if (c.hint) i.placeholder = c.hint;
      wrap.appendChild(i);
      primary = i;
      read = () => i.value;
    }
    if (c.hint) wrap.appendChild(el('span', 'field-hint', c.hint));
    return {
      wrap, read, key: c.key, input: primary,
      set: (v) => {
        if (!primary) return;
        primary.value = v;
        primary.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
  }

  /* ---------- mount ---------- */
  window.MVRTool.mountPDF = function (spec, root) {
    const io = root.querySelector('.tool-io');
    const core = window.MVRPdfCore;
    const needsFiles = spec.kind !== 'create';

    let drop = null, fileInput = null;
    const fileList = el('div', 'file-list');
    const opts = el('div', 'opt-bar');
    const textPane = el('div', 'io-pane');
    const msg = el('div', 'io-msg');
    const results = el('div', 'pdf-results');
    const actions = el('div', 'io-actions pdf-actions');
    const stats = el('div', 'stat-grid');
    const report = el('pre', 'code-out');
    report.hidden = true;

    /* file input, for everything except pure creators */
    if (needsFiles) {
      drop = el('div', 'dropzone');
      drop.tabIndex = 0;
      drop.setAttribute('role', 'button');
      drop.innerHTML = '<strong>' + (spec.multiple ? 'Choose PDF files' : 'Choose a PDF') +
        '</strong><span>or drag ' + (spec.multiple ? 'them' : 'it') + ' here — nothing is uploaded</span>';
      fileInput = el('input', 'visually-hidden');
      fileInput.type = 'file';
      fileInput.accept = 'application/pdf,.pdf';
      if (spec.multiple) fileInput.multiple = true;
      drop.appendChild(fileInput);
      io.appendChild(drop);
      io.appendChild(fileList);
    }

    /* free-text input, for text-to-pdf */
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

    /* Click-to-place. Sits above the controls it fills in, because the
       order of operations is: see the page, click the spot, adjust. */
    const place = el('div', 'place-preview');
    place.hidden = true;
    if (spec.placePreview) io.appendChild(place);

    const readers = (spec.controls || []).map(c => {
      const b = buildControl(c);
      opts.appendChild(b.wrap);
      return b;
    });
    if (readers.length) io.appendChild(opts);
    const reader = (key) => readers.find(r => r.key === key);

    const runBar = el('div', 'io-actions pdf-run');
    const runBtn = el('button', 'btn-primary',
      spec.kind === 'inspect' ? 'Inspect' : spec.kind === 'create' ? 'Create PDF' : 'Process');
    runBtn.type = 'button';
    runBar.appendChild(runBtn);
    io.appendChild(runBar);

    io.appendChild(msg);
    io.appendChild(report);
    io.appendChild(results);
    io.appendChild(actions);
    io.appendChild(stats);

    const say = (text, kind) => {
      msg.textContent = text || '';
      msg.className = 'io-msg' + (kind ? ' is-' + kind : '');
    };
    const readOpts = () => {
      const o = {};
      readers.forEach(r => { o[r.key] = r.read(); });
      return o;
    };

    /* ---------- loading ---------- */
    let docs = [];

    async function loadFiles(list) {
      const files = [...list].filter(f => /pdf$/i.test(f.name) || f.type === 'application/pdf');
      if (!files.length) { say('Those are not PDF files.', 'error'); return; }

      say('Reading…', 'note');
      const take = spec.multiple ? files : files.slice(0, 1);
      const next = spec.multiple ? docs.slice() : [];

      for (const f of take) {
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const doc = await core.PDFDocument.load(bytes);
          next.push({ doc, name: f.name, size: f.size, pages: await doc.pageCount() });
        } catch (e) {
          say(`${f.name}: ${e.message}`, 'error');
          renderFileList();
          return;
        }
      }
      docs = next;
      say('');
      if (drop) {
        drop.innerHTML = '<strong>' + (docs.length === 1 ? docs[0].name : docs.length + ' PDFs')
          + '</strong><span>click to ' + (spec.multiple ? 'add more' : 'choose another') + '</span>';
        drop.appendChild(fileInput);
      }
      renderFileList();
      if (spec.placePreview) paintPlace();
      if (spec.kind === 'inspect') run();
    }

    function renderFileList() {
      fileList.innerHTML = '';
      if (!docs.length) return;
      docs.forEach((d, i) => {
        const row = el('div', 'file-row');
        row.appendChild(el('span', 'file-idx', String(i + 1)));
        row.appendChild(el('span', 'file-name', d.name));
        row.appendChild(el('span', 'file-meta', `${d.pages} page${d.pages === 1 ? '' : 's'} · ${fmtBytes(d.size)}`));
        if (spec.multiple && docs.length > 1) {
          const up = el('button', 'btn-ghost', '↑'); up.type = 'button'; up.title = 'Move up';
          up.addEventListener('click', () => {
            if (i === 0) return;
            [docs[i - 1], docs[i]] = [docs[i], docs[i - 1]];
            renderFileList();
          });
          const dn = el('button', 'btn-ghost', '↓'); dn.type = 'button'; dn.title = 'Move down';
          dn.addEventListener('click', () => {
            if (i === docs.length - 1) return;
            [docs[i + 1], docs[i]] = [docs[i], docs[i + 1]];
            renderFileList();
          });
          row.appendChild(up); row.appendChild(dn);
        }
        const rm = el('button', 'btn-ghost', '×'); rm.type = 'button'; rm.title = 'Remove';
        rm.addEventListener('click', () => {
          docs.splice(i, 1);
          renderFileList();
          if (!docs.length && drop) {
            drop.innerHTML = '<strong>' + (spec.multiple ? 'Choose PDF files' : 'Choose a PDF') +
              '</strong><span>or drag ' + (spec.multiple ? 'them' : 'it') + ' here — nothing is uploaded</span>';
            drop.appendChild(fileInput);
            results.innerHTML = ''; actions.innerHTML = ''; stats.innerHTML = '';
            report.hidden = true;
            if (spec.placePreview) { place.hidden = true; place.innerHTML = ''; }
          }
        });
        row.appendChild(rm);
        fileList.appendChild(row);
      });
    }

    /* ---------- run ---------- */
    async function run() {
      results.innerHTML = '';
      actions.innerHTML = '';
      stats.innerHTML = '';
      report.hidden = true;

      if (needsFiles && !docs.length) { say('Choose a PDF first.', 'note'); return; }

      runBtn.disabled = true;
      const was = runBtn.textContent;
      runBtn.textContent = 'Working…';
      say('');

      try {
        if (spec.kind === 'render') {
          await runRender();
          return;
        }
        const res = await spec.run({
          docs, opts: readOpts(), core,
          text: textArea ? textArea.value : ''
        });
        if (!res) { say('That produced no result.', 'error'); return; }
        if (res.error) { say(res.error, 'error'); return; }
        if (res.warn) say(res.warn, 'warn');

        if (res.report) { report.textContent = res.report; report.hidden = false; }
        renderStats(res.stats);

        const files = res.files || [];
        if (files.length === 1) {
          const f = files[0];
          const b = el('button', 'btn-primary', `Download ${f.name} (${fmtBytes(f.bytes.length)})`);
          b.type = 'button';
          b.addEventListener('click', () => download(f.bytes, f.name));
          actions.appendChild(b);
        } else if (files.length > 1) {
          const zip = el('button', 'btn-primary', `Download all ${files.length} as ZIP`);
          zip.type = 'button';
          zip.addEventListener('click', async () => {
            if (!window.MVRZip) { say('The ZIP writer did not load.', 'error'); return; }
            zip.disabled = true; zip.textContent = 'Packing…';
            try {
              const blob = await window.MVRZip(files.map(f => ({
                name: f.name, blob: new Blob([f.bytes], { type: 'application/pdf' })
              })));
              download(blob, (spec.id || 'output') + '.zip');
            } finally { zip.disabled = false; zip.textContent = `Download all ${files.length} as ZIP`; }
          });
          actions.appendChild(zip);

          const list = el('div', 'pdf-file-grid');
          files.slice(0, 60).forEach(f => {
            const card = el('div', 'pdf-file-card');
            card.appendChild(el('span', 'pdf-file-name', f.name));
            card.appendChild(el('span', 'file-size', fmtBytes(f.bytes.length)));
            const b = el('button', 'btn-ghost', 'Save'); b.type = 'button';
            b.addEventListener('click', () => download(f.bytes, f.name));
            card.appendChild(b);
            list.appendChild(card);
          });
          if (files.length > 60) list.appendChild(el('p', 'io-msg is-note',
            `${files.length - 60} more files are in the ZIP.`));
          results.appendChild(list);
        }
      } catch (e) {
        say('Something went wrong: ' + (e && e.message ? e.message : 'unknown error'), 'error');
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = was;
      }
    }

    /* ---------- pdf.js path ---------- */
    let pdfjs = null;
    async function ensurePdfJs() {
      if (pdfjs) return pdfjs;
      say('Loading the PDF rendering engine (about 1.7 MB). This happens once, then it is cached.', 'note');
      const mod = await import(`${PDFJS_BASE}pdf.min.mjs`);
      mod.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}pdf.worker.min.mjs`;
      pdfjs = mod;
      say('');
      return mod;
    }

    /* ---------- click to place ---------- */
    /* Rasterise the shown page once into an offscreen canvas, then blit and
       draw the marker on every change. Re-rendering per keystroke would be
       visible, and re-opening the document per page would be worse. */
    let placeState = null;
    let placeDoc = null;      // { pdf, name } for the file currently loaded
    let placePage = 0;        // which page the preview is showing

    /** Which page the Pages control points at, for the opening view. */
    function firstSelectedPage(total) {
      const cfg = spec.placePreview;
      const r = cfg && cfg.page && reader(cfg.page);
      if (!r) return 0;
      const v = String(r.read() || '').trim();
      if (/^last$/i.test(v)) return total - 1;
      try {
        const idx = core.parsePageRange(v, total);
        if (idx.length) return idx[0];
      } catch (e) { /* half-typed ranges are normal while typing */ }
      return 0;
    }

    async function paintPlace() {
      const cfg = spec.placePreview;
      if (!cfg || !docs.length) return;

      place.hidden = false;
      place.innerHTML = '';
      place.appendChild(el('p', 'place-note', 'Rendering the page\u2026'));

      let lib;
      try { lib = await ensurePdfJs(); }
      catch (e) {
        /* The tool still works; only the aiming aid is gone. */
        place.innerHTML = '';
        place.appendChild(el('p', 'place-note',
          'The page preview could not load. The X and Y boxes still work \u2014 they are ' +
          'measured in points from the bottom-left corner, 72 to the inch.'));
        return;
      }

      const src = docs[0];
      if (!placeDoc || placeDoc.name !== src.name) {
        try {
          const raw = new Uint8Array(await new Blob([src.doc.bytes]).arrayBuffer());
          placeDoc = {
            name: src.name,
            pdf: await lib.getDocument({
              data: raw,
              cMapUrl: `${PDFJS_BASE}cmaps/`,
              cMapPacked: true,
              standardFontDataUrl: `${PDFJS_BASE}standard_fonts/`
            }).promise
          };
        } catch (e) {
          placeDoc = null;
          place.innerHTML = '';
          place.appendChild(el('p', 'place-note',
            'This PDF could not be rendered for preview, but it can still be processed.'));
          return;
        }
        placePage = firstSelectedPage(placeDoc.pdf.numPages);
      }

      const total = placeDoc.pdf.numPages;
      placePage = Math.max(0, Math.min(total - 1, placePage));

      /* ---- the frame, built once per file ---- */
      place.innerHTML = '';

      const head = el('div', 'place-head');
      head.appendChild(el('span', 'place-title', 'Click the page to place it'));

      let pager = null, pageLabel = null, prev = null, next = null;
      if (total > 1) {
        pager = el('div', 'place-pager');
        prev = el('button', 'btn-ghost', '\u2039');
        prev.type = 'button';
        prev.title = 'Previous page';
        prev.setAttribute('aria-label', 'Previous page');
        pageLabel = el('span', 'place-page-num');
        next = el('button', 'btn-ghost', '\u203a');
        next.type = 'button';
        next.title = 'Next page';
        next.setAttribute('aria-label', 'Next page');
        pager.appendChild(prev);
        pager.appendChild(pageLabel);
        pager.appendChild(next);
        head.appendChild(pager);
      }

      const reset = el('button', 'btn-ghost', 'Centre');
      reset.type = 'button';
      reset.title = 'Put it in the middle of the page';
      head.appendChild(reset);
      place.appendChild(head);

      const canvas = el('canvas', 'place-canvas');
      canvas.setAttribute('role', 'application');
      canvas.tabIndex = 0;
      canvas.setAttribute('aria-label',
        'Page preview. Click to set the position, or use the arrow keys. ' +
        'The X and Y boxes below hold the same value.');
      place.appendChild(canvas);

      const readout = el('p', 'place-readout');
      place.appendChild(readout);

      const hint = el('p', 'place-hint');
      place.appendChild(hint);

      /* ---- rasterise whichever page is showing ---- */
      const showPage = async (index) => {
        placePage = Math.max(0, Math.min(total - 1, index));
        const page = await placeDoc.pdf.getPage(placePage + 1);
        const base = page.getViewport({ scale: 1 });
        /* Fit the column, and never rasterise more than is useful. */
        const wide = Math.min(560, Math.max(280, place.clientWidth || 520));
        const scale = Math.min(1.6, wide / base.width);
        const vp = page.getViewport({ scale });

        const sheet = document.createElement('canvas');
        sheet.width = Math.round(vp.width);
        sheet.height = Math.round(vp.height);
        const sctx = sheet.getContext('2d');
        sctx.fillStyle = '#fff';
        sctx.fillRect(0, 0, sheet.width, sheet.height);
        await page.render({ canvasContext: sctx, viewport: vp }).promise;

        canvas.width = sheet.width;
        canvas.height = sheet.height;
        placeState = { cfg, sheet, canvas, readout, hint, scale, wPt: base.width, hPt: base.height };

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
        const rx = reader(cfg.x), ry = reader(cfg.y);
        if (rx) rx.set(Math.round(Math.max(0, Math.min(placeState.wPt, xPt))));
        if (ry) ry.set(Math.round(Math.max(0, Math.min(placeState.hPt, yPt))));
        drawPlace();
      };

      canvas.addEventListener('click', (ev) => {
        if (!placeState) return;
        const r = canvas.getBoundingClientRect();
        const xPt = (ev.clientX - r.left) * (placeState.wPt / r.width);
        /* PDF counts up from the bottom; the canvas counts down from the top. */
        const yPt = placeState.hPt - (ev.clientY - r.top) * (placeState.hPt / r.height);
        setPoint(xPt, yPt);
        canvas.focus();
      });

      canvas.addEventListener('keydown', (ev) => {
        /* Page Up and Page Down turn the page; the arrows move the marker. */
        if (total > 1 && (ev.key === 'PageUp' || ev.key === 'PageDown')) {
          showPage(placePage + (ev.key === 'PageDown' ? 1 : -1));
          ev.preventDefault();
          return;
        }
        const step = ev.shiftKey ? 20 : 2;
        const rx = reader(cfg.x), ry = reader(cfg.y);
        const cx = Number(rx && rx.read()) || 0, cy = Number(ry && ry.read()) || 0;
        if (ev.key === 'ArrowLeft') setPoint(cx - step, cy);
        else if (ev.key === 'ArrowRight') setPoint(cx + step, cy);
        else if (ev.key === 'ArrowUp') setPoint(cx, cy + step);
        else if (ev.key === 'ArrowDown') setPoint(cx, cy - step);
        else return;
        ev.preventDefault();
      });

      reset.addEventListener('click', () => {
        if (placeState) setPoint(placeState.wPt / 2, placeState.hPt / 2);
      });

      /* Any control that feeds the marker redraws it. */
      [cfg.x, cfg.y, cfg.text, cfg.size, cfg.colour].forEach(k => {
        const r = typeof k === 'string' && reader(k);
        if (r && r.input) r.input.addEventListener('input', drawPlace);
      });
      /* Changing which pages get the text moves the view to the first of
         them, which is almost always where you want to look next. */
      const pageReader = cfg.page && reader(cfg.page);
      if (pageReader && pageReader.input) {
        pageReader.input.addEventListener('change', () => showPage(firstSelectedPage(total)));
      }

      await showPage(placePage);
    }

    /* Draw what the output will look like, not a generic pin. */
    function drawPlace() {
      if (!placeState) return;
      const { cfg, sheet, canvas, readout, hint, scale, wPt, hPt } = placeState;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sheet, 0, 0);

      const val = (k, fallback) => {
        if (typeof k !== 'string') return k === undefined ? fallback : k;
        const r = reader(k);
        return r ? r.read() : fallback;
      };
      const xPt = Number(val(cfg.x, 0)) || 0;
      const yPt = Number(val(cfg.y, 0)) || 0;
      const text = String(val(cfg.text, '') || '').split('\n')[0].slice(0, 80);
      const size = Math.max(6, Number(val(cfg.size, 12)) || 12);
      const colour = /^#[0-9a-f]{6}$/i.test(String(val(cfg.colour, '#000000'))) ? val(cfg.colour, '#000000') : '#000000';

      const cx = xPt * scale;
      const cy = (hPt - yPt) * scale;

      if (text) {
        ctx.font = (size * scale).toFixed(1) + 'px Helvetica, Arial, sans-serif';
        const w = ctx.measureText(text).width;
        const h = size * scale;
        ctx.fillStyle = 'rgba(247,201,72,.22)';
        ctx.fillRect(cx - 2, cy - h, w + 4, h + 4);
        ctx.strokeStyle = '#f7c948';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(cx - 2, cy - h, w + 4, h + 4);
        ctx.setLineDash([]);
        ctx.fillStyle = colour;
        ctx.fillText(text, cx, cy);
      }

      /* The anchor, always, even with no text yet. */
      ctx.strokeStyle = '#f7c948';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
      ctx.stroke();

      const off = xPt < 0 || yPt < 0 || xPt > wPt || yPt > hPt;
      readout.textContent = 'X ' + Math.round(xPt) + ' \u00b7 Y ' + Math.round(yPt) +
        ' points from the bottom-left of a ' + Math.round(wPt) + ' \u00d7 ' + Math.round(hPt) + ' page' +
        (off ? ' \u2014 that is off the page' : '');
      readout.className = 'place-readout' + (off ? ' is-off' : '');

      /* You can page through the whole document, but only the pages the Pages
         box names will actually be written to. Saying so here is cheaper than
         letting someone aim carefully at a page that will not change. */
      if (hint && placeDoc) {
        const total = placeDoc.pdf.numPages;
        let selected = null;
        const r = cfg.page && reader(cfg.page);
        if (r) {
          const v = String(r.read() || '').trim();
          if (/^last$/i.test(v)) selected = [total - 1];
          else { try { selected = core.parsePageRange(v, total); } catch (e) { selected = null; } }
        }
        if (selected && selected.indexOf(placePage) < 0) {
          hint.textContent = 'You are looking at page ' + (placePage + 1) +
            ', which the Pages box does not include \u2014 nothing will be added here.';
          hint.className = 'place-hint is-warn';
        } else {
          hint.textContent = '';
          hint.className = 'place-hint';
        }
      }
    }

    async function runRender() {
      let lib;
      try { lib = await ensurePdfJs(); }
      catch (e) {
        say('The rendering engine could not be loaded. Reload the page and try again — ' +
            'the other PDF tools all work without it.', 'error');
        return;
      }
      const o = readOpts();
      const src = docs[0];
      const raw = new Uint8Array(await new Blob([src.doc.bytes]).arrayBuffer());
      /* Both data sets are vendored alongside the engine and fetched only for
         documents that actually reference them. standardFontDataUrl covers the
         base-14 fonts when a PDF declares but does not embed them — common, and
         the difference between correct glyphs and a fallback face. cMapUrl
         covers the predefined CJK encodings. */
      const pdf = await lib.getDocument({
        data: raw,
        cMapUrl: `${PDFJS_BASE}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${PDFJS_BASE}standard_fonts/`
      }).promise;

      if (spec.id === 'pdf-to-images') {
        let idx;
        try { idx = core.parsePageRange(o.pages, pdf.numPages); }
        catch (e) { say(e.message, 'error'); return; }

        const dpi = Number(o.dpi) || 150;
        const fmt = o.format || 'image/png';
        const q = Math.max(0.4, Math.min(1, (Number(o.quality) || 90) / 100));
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[fmt] || 'png';
        const files = [];
        const base = src.name.replace(/\.pdf$/i, '');

        for (const i of idx) {
          const page = await pdf.getPage(i + 1);
          const vp = page.getViewport({ scale: dpi / 72 });
          const canvas = el('canvas');
          canvas.width = Math.round(vp.width);
          canvas.height = Math.round(vp.height);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          const blob = await new Promise(r => canvas.toBlob(r, fmt, q));
          files.push({ name: `${base}-p${i + 1}.${ext}`, blob, w: canvas.width, h: canvas.height });

          const card = el('div', 'pdf-file-card');
          const img = el('img', 'image-preview');
          img.src = URL.createObjectURL(blob);
          img.alt = `Page ${i + 1}`;
          card.appendChild(img);
          card.appendChild(el('span', 'pdf-file-name', `Page ${i + 1}`));
          card.appendChild(el('span', 'file-size', `${canvas.width}×${canvas.height} · ${fmtBytes(blob.size)}`));
          const b = el('button', 'btn-ghost', 'Save'); b.type = 'button';
          b.addEventListener('click', () => download(blob, files[files.length - 1].name));
          card.appendChild(b);
          results.appendChild(card);
        }

        if (files.length > 1) {
          const zip = el('button', 'btn-primary', `Download all ${files.length} as ZIP`);
          zip.type = 'button';
          zip.addEventListener('click', async () => {
            if (!window.MVRZip) return;
            download(await window.MVRZip(files.map(f => ({ name: f.name, blob: f.blob }))), `${base}-images.zip`);
          });
          actions.appendChild(zip);
        }
        renderStats([
          ['Source pages', String(pdf.numPages)],
          ['Images produced', String(files.length)],
          ['Resolution', dpi + ' DPI'],
          ['Total size', fmtBytes(files.reduce((s, f) => s + f.blob.size, 0))]
        ]);
        return;
      }

      /* pdf-organise: thumbnails with per-page rotate and delete */
      const state = [];
      const grid = el('div', 'page-grid');
      for (let i = 0; i < pdf.numPages; i++) state.push({ index: i, rotate: 0, keep: true });

      const paint = async () => {
        grid.innerHTML = '';
        for (const s of state) {
          const card = el('div', 'page-card' + (s.keep ? '' : ' is-dropped'));
          const page = await pdf.getPage(s.index + 1);
          const vp = page.getViewport({ scale: 0.28, rotation: s.rotate });
          const canvas = el('canvas');
          canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          card.appendChild(canvas);
          card.appendChild(el('span', 'page-num', String(s.index + 1)));

          const bar = el('div', 'page-tools');
          const mk = (label, title, fn) => {
            const b = el('button', 'btn-ghost', label);
            b.type = 'button'; b.title = title;
            b.addEventListener('click', async () => { fn(); await paint(); });
            bar.appendChild(b);
          };
          mk('←', 'Move earlier', () => {
            const i = state.indexOf(s);
            if (i > 0) { state.splice(i, 1); state.splice(i - 1, 0, s); }
          });
          mk('↻', 'Rotate 90°', () => { s.rotate = (s.rotate + 90) % 360; });
          mk(s.keep ? '×' : '↺', s.keep ? 'Remove this page' : 'Restore', () => { s.keep = !s.keep; });
          mk('→', 'Move later', () => {
            const i = state.indexOf(s);
            if (i < state.length - 1) { state.splice(i, 1); state.splice(i + 1, 0, s); }
          });
          card.appendChild(bar);
          grid.appendChild(card);
        }
        const kept = state.filter(s => s.keep).length;
        renderStats([
          ['Source pages', String(pdf.numPages)],
          ['Pages kept', String(kept)],
          ['Pages removed', String(pdf.numPages - kept)],
          ['Rotated', String(state.filter(s => s.rotate).length)]
        ]);
      };

      results.appendChild(grid);
      await paint();

      const save = el('button', 'btn-primary', 'Save reorganised PDF');
      save.type = 'button';
      save.addEventListener('click', async () => {
        const items = state.filter(s => s.keep).map(s => ({
          doc: src.doc, pageIndex: s.index, rotate: s.rotate
        }));
        if (!items.length) { say('Every page is marked for removal.', 'error'); return; }
        save.disabled = true;
        try {
          const bytes = await core.assemble(items, {});
          download(bytes, src.name.replace(/\.pdf$/i, '') + '-organised.pdf');
        } catch (e) { say('Could not build the PDF: ' + e.message, 'error'); }
        finally { save.disabled = false; }
      });
      actions.appendChild(save);
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

    /* ---------- wiring ---------- */
    if (drop) {
      drop.addEventListener('click', () => fileInput.click());
      drop.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
      });
      ['dragenter', 'dragover'].forEach(ev =>
        drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev =>
        drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
      fileInput.addEventListener('change', () => { if (fileInput.files.length) loadFiles(fileInput.files); });
    }
    runBtn.addEventListener('click', run);
  };
})();
