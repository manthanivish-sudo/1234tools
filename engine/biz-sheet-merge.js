/**
 * Merge spreadsheets and remove the duplicates, on the device.
 *
 * Two to ten CSV or Excel files whose columns almost match — "Email" here,
 * "E-mail" there, a "Mobile" column only in the third — are lined up by
 * heading, stacked, and deduplicated on the columns you choose. Every row
 * that goes carries the file and row it came from, so the cull can be
 * checked. The workbook that comes back has the merged sheet, the
 * duplicates removed and a sheet of sources. Nothing is uploaded.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['sheet-merge'] = {
    title: 'Merge & Dedupe Spreadsheets',
    short: 'Merge Sheets',
    description: 'Combine up to ten Excel or CSV files into one sheet — columns matched by heading, rows stacked — then remove duplicates on the columns you choose, with every removed row listed by source file and row. Runs in your browser; nothing is uploaded.',
    keywords: ['merge excel files', 'combine csv files', 'remove duplicates excel', 'dedupe contact list', 'merge spreadsheets online', 'combine multiple xlsx into one', 'deduplicate email list', 'merge csv files free'],
    glyph: 'i-sheet-merge',
    glyphSvg: '<symbol id="i-sheet-merge" viewBox="0 0 24 24">\n  <rect x="2.5" y="3" width="7.5" height="8" rx="1"/>\n  <rect x="14" y="3" width="7.5" height="8" rx="1"/>\n  <path d="M4.5 6h3.5M4.5 8.5h3.5M16 6h3.5M16 8.5h3.5" class="thin"/>\n  <path d="M6.25 11v2a2 2 0 0 0 2 2h7.5a2 2 0 0 0 2-2v-2" class="thin"/>\n  <path d="M12 15v6M9.5 18.5L12 21l2.5-2.5" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/biz-sheet-merge.js'],
    tips: ['Headings are matched ignoring case, spaces and punctuation, so "E-mail" and "email" are one column, and so are "Phone No." and "phone no" — but "Email Address" and "Mobile" are not. Use the alignment panel to merge the ones that should be one column.', 'Choose the key columns carefully. Email alone finds the same person under two spellings of their name; name plus phone finds them under two email addresses. No key at all means only rows identical in every column are duplicates.', 'With normalisation on, emails are compared lower-case and phones as digits only, with a leading +91 or 0 dropped — so 098450 12345 and +91 98450 12345 match. Off, the comparison is exact after trimming and case-folding.', 'Keep first keeps the row from the earlier file, in the order you added them; keep last keeps the later one. Add the file you trust most first, or last, accordingly.', 'Only the first sheet of a workbook is read. If the data is on another tab, move it or save that tab as its own file.', 'The Duplicates removed sheet says which kept row each one matched. Check a few before you delete the originals.'],
    faq: [{ q: 'What counts as a duplicate?', a: 'Two rows whose values in the key columns are equal after trimming and case-folding — and, with normalisation on, after emails are lower-cased and phones reduced to digits. Rows whose key columns are all empty are never treated as duplicates of each other; they are kept and counted.' }, { q: 'What if the files have different columns?', a: 'The output has every column from every file, in the order they were first seen. A row from a file without a column has that cell empty. Columns that mean the same thing under different headings can be merged into one in the alignment panel before the rows are stacked.' }, { q: 'How large a file can it take?', a: 'It is limited by the browser’s memory, not by any upload. A few hundred thousand rows across ten files is fine on a laptop; the preview shows the first 25 rows and the download has them all.' }]
  };
  if (typeof document === 'undefined') return;
  const K = () => window.MVRBizKit;

  /* ---------- normalising ---------- */

  const isPhoneCol = (h) => /phone|mobile|\btel\b|telephone|contact|whatsapp|cell/i.test(h);
  const isEmailCol = (h) => /mail/i.test(h);
  function keyValue(v, header, normalise) {
    let s = String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalise || !s) return s;
    if (isEmailCol(header)) return s.replace(/\s/g, '');
    if (isPhoneCol(header)) {
      let d = s.replace(/\D/g, '');
      if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
      else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
      return d || s;
    }
    return s;
  }

  /** Header row plus data rows that remember their original row number. */
  function splitKeepIdx(rows) {
    const hi = rows.findIndex(r => r.filter(v => v !== '' && v != null).length >= 2);
    if (hi < 0) return { headers: [], rows: [] };
    const headers = rows[hi].map(h => String(h == null ? '' : h).trim());
    const out = [];
    for (let i = hi + 1; i < rows.length; i++) { const r = rows[i]; if (r.some(v => v !== '' && v != null)) out.push({ n: i + 1, cells: r }); }
    return { headers, rows: out };
  }

  /**
   * The merge itself, pure so it can be tested: files [{ name, headers, rows:[{n,cells}] }],
   * columns [{ key, name, target, drop }], rename { name: newName }, options { keys:[outKey], keepLast, normalise, source }.
   */
  function mergeFiles(files, columns, rename, options) {
    const norm = K().norm;
    const outCols = columns.filter(c => !c.drop && c.target === c.key).map(c => ({ key: c.key, name: rename[c.name] || c.name }));
    const outIdx = {}; outCols.forEach((c, i) => { outIdx[c.key] = i; });
    const targetOf = {}; columns.forEach(c => { targetOf[c.key] = c.drop ? null : c.target; });
    const stacked = [];
    for (const f of files) {
      const map = f.headers.map(h => { const t = targetOf[norm(h)]; return t == null || outIdx[t] === undefined ? -1 : outIdx[t]; });
      for (const r of f.rows) {
        const out = new Array(outCols.length).fill('');
        map.forEach((oi, si) => { if (oi >= 0 && (out[oi] === '' || out[oi] == null)) { const v = r.cells[si]; out[oi] = v == null ? '' : v; } });
        stacked.push({ file: f.name, n: r.n, cells: out });
      }
    }
    const keyIdx = (options.keys.length ? options.keys : outCols.map(c => c.key)).map(k => outIdx[k]).filter(i => i !== undefined);
    const keyOf = (row) => keyIdx.map(i => keyValue(row.cells[i], outCols[i].name, options.normalise));
    const kept = [], dups = [];
    const seen = new Map();
    let emptyKey = 0;
    const order = options.keepLast ? stacked.slice().reverse() : stacked;
    for (const row of order) {
      const kv = keyOf(row);
      if (kv.every(v => v === '')) { emptyKey++; kept.push(row); continue; }
      const key = kv.join('');
      const prev = seen.get(key);
      if (prev) { dups.push({ row, of: prev, key: kv.filter(Boolean).join(' | ') }); continue; }
      seen.set(key, row); kept.push(row);
    }
    if (options.keepLast) { kept.reverse(); dups.reverse(); }
    const headers = outCols.map(c => c.name).concat(options.source ? ['Source'] : []);
    const src = (r) => r.file + ' row ' + r.n;
    const merged = [headers].concat(kept.map(r => r.cells.concat(options.source ? [src(r)] : [])));
    const removed = [['Source file', 'Row', 'Duplicate of', 'Key'].concat(outCols.map(c => c.name))]
      .concat(dups.map(d => [d.row.file, d.row.n, src(d.of), d.key].concat(d.row.cells)));
    const sources = [['File', 'Rows read', 'Rows kept', 'Duplicates removed', 'Columns']]
      .concat(files.map(f => [f.name, f.rows.length, kept.filter(r => r.file === f.name).length, dups.filter(d => d.row.file === f.name).length, f.headers.filter(Boolean).join(', ')]));
    return { merged, removed, sources, kept: kept.length, dups: dups.length, read: stacked.length, emptyKey, keyNames: keyIdx.map(i => outCols[i].name), columns: outCols.length };
  }

  /* ---------- UI ---------- */

  function multiDropzone(k, label, accept, onFiles) {
    const drop = k.el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    const input = k.el('input', 'visually-hidden'); input.type = 'file'; input.accept = accept; input.multiple = true;
    const say = (strong, small) => { drop.innerHTML = '<strong>' + strong + '</strong><span>' + small + '</span>'; drop.appendChild(input); };
    say(label, 'or drag them here — nothing is uploaded');
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); });
    input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); input.value = ''; });
    drop.say = say;
    return drop;
  }

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { files: [], columns: [], choice: {} };
    const msg = k.msgBox();
    const MAX = 10;

    const drop = multiDropzone(k, 'Choose 2 to 10 spreadsheets (Excel or CSV)', '.xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', async (list) => {
      try {
        msg.say('Reading…', 'note');
        for (const f of list) {
          if (st.files.length >= MAX) { msg.say('Up to ' + MAX + ' files at a time. ' + f.name + ' was not added.', 'warn'); break; }
          const t = await k.readTable(f);
          const sheet = t.sheets[0];
          const h = splitKeepIdx(sheet.rows);
          if (!h.headers.length) { msg.say(f.name + ' has no table in it (no row with two or more filled cells).', 'error'); continue; }
          st.files.push({ name: f.name, sheet: t.sheets.length > 1 ? sheet.name + ' (first of ' + t.sheets.length + ' sheets)' : '', headers: h.headers, rows: h.rows });
        }
        renderFiles(); buildColumns(); renderColumns(); renderKeys();
        if (msg.textContent === 'Reading…') msg.say('');
      } catch (e) { msg.say(e.message || String(e), 'error'); }
    });
    io.appendChild(drop);
    const fileList = k.el('div', 'file-list'); io.appendChild(fileList);

    /* column alignment */
    const colBox = k.el('div', 'biz-map'); colBox.hidden = true; io.appendChild(colBox);
    const renameTa = k.textarea('sm-rename', '', 'Old heading = New heading\nMobile = Phone', 3);
    const renameField = k.field('Rename output columns (optional)', renameTa, 'One per line: Old heading = New heading'); renameField.hidden = true; io.appendChild(renameField);

    /* dedupe options */
    const keyBox = k.el('div', 'biz-map'); keyBox.hidden = true; io.appendChild(keyBox);
    const bar = k.el('div', 'opt-bar biz-opts'); bar.hidden = true;
    const keep = k.select('sm-keep', [{ value: 'first', label: 'First (earlier file, earlier row)' }, { value: 'last', label: 'Last (later file, later row)' }], 'first');
    const normalise = k.select('sm-normalise', [{ value: 'yes', label: 'Yes — lower-case emails, digits-only phones' }, { value: 'no', label: 'No — exact after trimming and case-folding' }], 'yes');
    const source = k.select('sm-source', [{ value: 'yes', label: 'Yes — "file.xlsx row 12"' }, { value: 'no', label: 'No' }], 'yes');
    bar.appendChild(k.field('Which duplicate to keep', keep));
    bar.appendChild(k.field('Normalise emails and phones', normalise));
    bar.appendChild(k.field('Add a Source column', source));
    io.appendChild(bar);

    const run = k.el('div', 'io-actions pdf-run'); run.appendChild(k.button('Merge & dedupe', 'btn-primary', go)); io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function renderFiles() {
      fileList.innerHTML = '';
      st.files.forEach((f, i) => {
        const row = k.el('div', 'file-row');
        row.appendChild(k.el('span', 'file-idx', String(i + 1)));
        row.appendChild(k.el('span', 'file-name', f.name));
        row.appendChild(k.el('span', 'file-meta', f.rows.length.toLocaleString('en-GB') + ' rows · ' + f.headers.filter(Boolean).length + ' columns' + (f.sheet ? ' · ' + f.sheet : '')));
        const rm = k.el('button', 'btn-ghost', '×'); rm.type = 'button'; rm.title = 'Remove'; rm.setAttribute('aria-label', 'Remove ' + f.name);
        rm.addEventListener('click', () => { st.files.splice(i, 1); renderFiles(); buildColumns(); renderColumns(); renderKeys(); result.innerHTML = ''; });
        row.appendChild(rm); fileList.appendChild(row);
      });
      const n = st.files.length;
      drop.say(n ? n + ' file' + (n === 1 ? '' : 's') + ' added' : 'Choose 2 to 10 spreadsheets (Excel or CSV)', n ? 'click to add more' : 'or drag them here — nothing is uploaded');
    }
    function buildColumns() {
      const norm = k.norm; const cols = []; const byKey = {};
      st.files.forEach((f, fi) => f.headers.forEach(h => {
        const key = norm(h); if (!key) return;
        if (!byKey[key]) { byKey[key] = { key, name: h, files: new Set() }; cols.push(byKey[key]); }
        byKey[key].files.add(fi);
      }));
      cols.forEach(c => { const ch = st.choice[c.key]; c.target = ch && ch !== 'drop' && byKey[ch] ? ch : c.key; c.drop = ch === 'drop'; });
      st.columns = cols;
    }
    function renderColumns() {
      colBox.innerHTML = ''; colBox.hidden = renameField.hidden = !st.columns.length;
      if (!st.columns.length) return;
      colBox.appendChild(k.el('p', 'biz-map-title', st.columns.length + ' columns across ' + st.files.length + ' file' + (st.files.length === 1 ? '' : 's') + ' — align the ones that mean the same thing'));
      const grid = k.el('div', 'biz-map-grid');
      st.columns.forEach((c, i) => {
        const opts = [{ value: c.key, label: 'Keep as its own column' }]
          .concat(st.columns.filter(o => o !== c).map(o => ({ value: o.key, label: 'Merge into ' + o.name })))
          .concat([{ value: 'drop', label: 'Drop this column' }]);
        const s = k.select('sm-col-' + i, opts, c.drop ? 'drop' : c.target);
        s.addEventListener('change', () => { st.choice[c.key] = s.value; buildColumns(); renderColumns(); renderKeys(); });
        const inAll = c.files.size === st.files.length;
        grid.appendChild(k.field(c.name + (inAll ? '' : ' · in ' + c.files.size + ' of ' + st.files.length), s));
      });
      colBox.appendChild(grid);
    }
    function outputColumns() {
      const rename = {};
      renameTa.value.split('\n').forEach(l => { const m = /^(.+?)\s*=\s*(.+?)\s*$/.exec(l.trim()); if (m) rename[m[1]] = m[2]; });
      return { rename, cols: st.columns.filter(c => !c.drop && c.target === c.key).map(c => ({ key: c.key, name: rename[c.name] || c.name })) };
    }
    function renderKeys() {
      keyBox.innerHTML = ''; keyBox.hidden = bar.hidden = !st.columns.length;
      if (!st.columns.length) return;
      keyBox.appendChild(k.el('p', 'biz-map-title', 'Duplicate when these columns match'));
      const grid = k.el('div', 'biz-map-grid');
      const cols = outputColumns().cols;
      const guess = cols.filter(c => /e-?mail/i.test(c.name)).length ? (c) => /e-?mail/i.test(c.name)
        : cols.filter(c => isPhoneCol(c.name)).length ? (c) => isPhoneCol(c.name)
        : cols.filter(c => /gstin|\bpan\b|\bid\b|^id|_id$|code|customer no|account/i.test(c.name)).length ? (c) => /gstin|\bpan\b|\bid\b|^id|_id$|code|customer no|account/i.test(c.name) : () => false;
      cols.forEach((c, i) => {
        const w = k.el('div', 'field-check');
        const cb = k.el('input'); cb.type = 'checkbox'; cb.id = 'sm-key-' + i; cb.value = c.key;
        cb.checked = st.keyChoice ? st.keyChoice.has(c.key) : guess(c);
        cb.addEventListener('change', () => { st.keyChoice = new Set([...grid.querySelectorAll('input:checked')].map(x => x.value)); });
        const l = k.el('label', null, c.name); l.setAttribute('for', cb.id);
        w.appendChild(cb); w.appendChild(l); grid.appendChild(w);
      });
      keyBox.appendChild(grid);
      keyBox.appendChild(k.el('span', 'field-hint', 'Tick none and only rows identical in every column are duplicates.'));
    }
    renameTa.addEventListener('change', renderKeys);

    function go() {
      result.innerHTML = '';
      if (!st.files.length) { msg.say('Choose two or more spreadsheets first.', 'note'); return; }
      const { rename } = outputColumns();
      const keys = [...keyBox.querySelectorAll('input:checked')].map(x => x.value);
      let r;
      try {
        r = mergeFiles(st.files, st.columns, rename, { keys, keepLast: keep.value === 'last', normalise: normalise.value === 'yes', source: source.value === 'yes' });
      } catch (e) { msg.say(e.message || String(e), 'error'); return; }
      const S = k.S();
      result.appendChild(k.summaryCard(r.kept.toLocaleString('en-GB') + ' rows merged from ' + st.files.length + ' file' + (st.files.length === 1 ? '' : 's'),
        r.dups.toLocaleString('en-GB') + ' duplicate' + (r.dups === 1 ? '' : 's') + ' removed · ' + r.columns + ' columns · key: ' + (r.keyNames.length && keys.length ? r.keyNames.join(' + ') : 'every column'), [
          k.downloadButton('merged.xlsx', () => S.writeXlsx([{ name: 'Merged', rows: r.merged }, { name: 'Duplicates removed', rows: r.removed }, { name: 'Sources', rows: r.sources }])),
          k.downloadButton('merged.csv', () => new Blob([S.toCSV(r.merged)], { type: 'text/csv' }), false)
        ]));
      result.appendChild(k.statGrid([['Files', st.files.length], ['Rows read', r.read.toLocaleString('en-GB')], ['Rows kept', r.kept.toLocaleString('en-GB')], ['Duplicates removed', r.dups.toLocaleString('en-GB')], ['Key columns', keys.length ? r.keyNames.join(', ') : 'every column (exact rows)'], ['Kept', keep.value === 'last' ? 'last occurrence' : 'first occurrence'], ['Rows with an empty key', r.emptyKey.toLocaleString('en-GB')]]));
      if (r.dups) { result.appendChild(k.h3('Duplicates removed (' + r.dups.toLocaleString('en-GB') + ')')); result.appendChild(k.previewTable(r.removed, 25)); }
      result.appendChild(k.h3('Merged')); result.appendChild(k.previewTable(r.merged, 25));
      result.appendChild(k.h3('Sources')); result.appendChild(k.previewTable(r.sources, 10));
      msg.say(''); result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="sheet-merge"]'); if (r) mount(r); });
  window.MVRSheetMerge = { mergeFiles, keyValue, splitKeepIdx };
})();
