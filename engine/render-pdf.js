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
    } else if (c.type === 'textarea') {
      const t = el('textarea', 'control');
      t.id = id; t.name = c.key; t.rows = 4; t.value = c.default || '';
      wrap.appendChild(t);
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
      read = () => hex.value;
    } else if (c.type === 'date') {
      const i = el('input', 'control');
      i.type = 'date'; i.id = id; i.name = c.key;
      i.value = c.default === 'TODAY' ? new Date().toISOString().slice(0, 10) : (c.default || '');
      wrap.appendChild(i);
      read = () => i.value;
    } else if (c.type === 'number') {
      const i = el('input', 'control');
      i.type = 'number'; i.id = id; i.name = c.key; i.inputMode = 'decimal';
      if (c.min !== undefined) i.min = c.min;
      if (c.max !== undefined) i.max = c.max;
      if (c.step !== undefined) i.step = c.step;
      i.value = c.default;
      wrap.appendChild(i);
      read = () => i.value;
    } else {
      const i = el('input', 'control');
      i.type = 'text'; i.id = id; i.name = c.key; i.value = c.default || '';
      if (c.hint) i.placeholder = c.hint;
      wrap.appendChild(i);
      read = () => i.value;
    }
    if (c.hint) wrap.appendChild(el('span', 'field-hint', c.hint));
    return { wrap, read, key: c.key };
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

    const readers = (spec.controls || []).map(c => {
      const b = buildControl(c);
      opts.appendChild(b.wrap);
      return b;
    });
    if (readers.length) io.appendChild(opts);

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
      say('Downloading the PDF rendering engine (about 1 MB). This happens once, then it is cached.', 'note');
      const base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82';
      const mod = await import(`${base}/build/pdf.min.mjs`);
      mod.GlobalWorkerOptions.workerSrc = `${base}/build/pdf.worker.min.mjs`;
      pdfjs = mod;
      say('');
      return mod;
    }

    async function runRender() {
      let lib;
      try { lib = await ensurePdfJs(); }
      catch (e) {
        say('The rendering engine could not be downloaded — you may be offline, or the CDN may be blocked. ' +
            'The other PDF tools all work without it.', 'error');
        return;
      }
      const o = readOpts();
      const src = docs[0];
      const raw = new Uint8Array(await new Blob([src.doc.bytes]).arrayBuffer());
      const pdf = await lib.getDocument({ data: raw }).promise;

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
