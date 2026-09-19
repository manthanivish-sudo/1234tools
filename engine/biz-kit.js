/**
 * The pieces a local business tool is built from: a dropzone that reads a
 * spreadsheet or a text file on the device, form fields in the site's
 * shape, a result card with downloads, a preview table, and the two-file
 * matching helpers a reconciliation needs. Shared so that every tool under
 * /business/ looks and behaves the same, and a fix lands in all of them.
 */
(function () {
  'use strict';

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const S = () => { if (!window.MVRSheet) throw new Error('The spreadsheet reader did not load.'); return window.MVRSheet; };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const inr = (n) => '₹ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Numbers as spreadsheets and people write them. */
  function toNumber(v) {
    if (typeof v === 'number') return v;
    let s = String(v == null ? '' : v).trim();
    if (s === '' || s === '-') return 0;
    const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /\bdr\b/i.test(s) && !/\bcr\b/i.test(s) ? -1 : 1;
    s = s.replace(/[()\s,]|[₹$£€]|rs\.?|inr|dr|cr/gi, '').replace(/^-/, '');
    const n = Number(s);
    return Number.isFinite(n) ? n * neg : NaN;
  }

  /** Any date -> YYYY-MM-DD, or null. Serials, DD/MM/YYYY, ISO, "1 Apr 2026". */
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, '0');
  function toISODate(v, dayFirst) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
      if (/^\d{8}$/.test(String(v))) return String(v).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
      return null;
    }
    const s = String(v).trim(); let m;
    if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
    if ((m = /^(\d{8})$/.exec(s))) return m[1].replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s))) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3]; const a = Number(m[1]), b = Number(m[2]);
      const df = a > 12 ? true : b > 12 ? false : (dayFirst !== false);
      return df ? y + '-' + pad(b) + '-' + pad(a) : y + '-' + pad(a) + '-' + pad(b);
    }
    if ((m = /^(\d{1,2})[-\s]([A-Za-z]{3,4})[-\s,]*(\d{2,4})/.exec(s))) { const mo = MONTHS[m[2].toLowerCase()]; if (!mo) return null; const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + pad(mo) + '-' + pad(m[1]); }
    if ((m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/.exec(s))) { const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; if (!mo) return null; return m[3] + '-' + pad(mo) + '-' + pad(m[2]); }
    const d = new Date(s); if (!isNaN(d)) return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    return null;
  }
  const dayDiff = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);

  /* ---------- UI ---------- */

  function dropzone(label, accept, onFile) {
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    const input = el('input', 'visually-hidden'); input.type = 'file'; input.accept = accept;
    const say = (strong, small) => { drop.innerHTML = '<strong>' + strong + '</strong><span>' + small + '</span>'; drop.appendChild(input); };
    say(label, 'or drag it here — nothing is uploaded');
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) onFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files.length) onFile(input.files[0]); });
    drop.say = say;
    return drop;
  }
  function field(label, control, hint) {
    const w = el('div', 'field'); const l = el('label', null, label);
    if (control.id) l.setAttribute('for', control.id);
    w.appendChild(l); w.appendChild(control);
    if (hint) w.appendChild(el('span', 'field-hint', hint));
    return w;
  }
  function select(id, options, value) {
    const s = el('select', 'control'); s.id = id;
    for (const o of options) { const op = el('option', null, o.label); op.value = o.value; if (String(o.value) === String(value)) op.selected = true; s.appendChild(op); }
    return s;
  }
  function textInput(id, value, placeholder, type) {
    const i = el('input', 'control'); i.type = type || 'text'; i.id = id; i.value = value == null ? '' : value; if (placeholder) i.placeholder = placeholder;
    return i;
  }
  function textarea(id, value, placeholder, rows) {
    const t = el('textarea', 'control'); t.id = id; t.value = value || ''; t.rows = rows || 6; if (placeholder) t.placeholder = placeholder; t.spellcheck = false;
    return t;
  }
  function msgBox() { const m = el('div', 'io-msg'); m.say = (t, k) => { m.textContent = t || ''; m.className = 'io-msg' + (k ? ' is-' + k : ''); }; return m; }
  function button(label, cls, fn) { const b = el('button', cls || 'btn-primary', label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function summaryCard(title, meta, buttons) {
    const s = el('div', 'result-summary');
    const head = el('div', 'result-summary-head');
    head.appendChild(el('span', 'result-summary-tick', '✓'));
    const what = el('div', 'result-summary-what');
    what.appendChild(el('strong', 'result-summary-name', title));
    what.appendChild(el('span', 'result-summary-meta', meta));
    head.appendChild(what); s.appendChild(head);
    const acts = el('div', 'result-summary-actions'); (buttons || []).forEach(b => acts.appendChild(b)); s.appendChild(acts);
    return s;
  }
  function downloadButton(name, make, primary) {
    const b = button('Download ' + name, primary === false ? 'btn-ghost' : 'btn-primary', async () => { b.disabled = true; try { S().download(await make(), name); } catch (e) { alert(e.message); } finally { b.disabled = false; } });
    return b;
  }
  function previewTable(rows, max) {
    const wrap = el('div', 'table-scroll biz-preview');
    const t = el('table', 'biz-table');
    const head = rows[0] || [];
    const thead = el('thead'), tr = el('tr');
    head.forEach(h => tr.appendChild(el('th', null, String(h))));
    thead.appendChild(tr); t.appendChild(thead);
    const tb = el('tbody');
    rows.slice(1, 1 + (max || 25)).forEach(r => { const tr2 = el('tr'); head.forEach((h, i) => tr2.appendChild(el('td', null, r[i] == null ? '' : String(r[i])))); tb.appendChild(tr2); });
    t.appendChild(tb); wrap.appendChild(t);
    if (rows.length - 1 > (max || 25)) wrap.appendChild(el('p', 'biz-more', (rows.length - 1 - (max || 25)).toLocaleString('en-GB') + ' more rows not shown'));
    return wrap;
  }
  function statGrid(pairs) {
    const g = el('div', 'stat-grid');
    pairs.forEach(([k, v]) => { const r = el('div', 'stat-row'); r.appendChild(el('span', 'stat-key', k)); r.appendChild(el('span', 'stat-val', String(v))); g.appendChild(r); });
    return g;
  }
  function h3(text) { return el('h3', 'biz-h3', text); }
  function issues(list, label) {
    const box = el('div', 'biz-issues');
    box.appendChild(el('strong', null, list.length + ' ' + (label || 'issue') + (list.length === 1 ? '' : 's')));
    const ul = el('ul'); list.slice(0, 40).forEach(i => ul.appendChild(el('li', null, i)));
    if (list.length > 40) ul.appendChild(el('li', null, '… and ' + (list.length - 40) + ' more'));
    box.appendChild(ul);
    return box;
  }

  /* ---------- reading a spreadsheet into { headers, rows } ---------- */

  async function readTable(file) {
    const s = await S().fromFile(file);
    if (s.kind === 'text') {
      const rows = S().parseCSV(s.text, S().sniffDelim(s.text));
      return { name: file.name, sheets: [{ name: file.name, rows }] };
    }
    return { name: file.name, sheets: s.sheets };
  }
  /** The first row with at least two filled cells is the header. */
  function splitHeader(rows) {
    const hi = rows.findIndex(r => r.filter(v => v !== '' && v != null).length >= 2);
    if (hi < 0) return { headers: [], rows: [] };
    return { headers: rows[hi].map(h => String(h).trim()), rows: rows.slice(hi + 1).filter(r => r.some(v => v !== '' && v != null)) };
  }
  /** Column guess by header aliases; returns { key: index }. */
  function autoMap(fields, headers) {
    const map = {}, used = new Set(), n = headers.map(norm);
    for (const f of fields) {
      let hit = -1;
      for (const a of f.aliases) { const i = n.findIndex((h, idx) => h === a && !used.has(idx)); if (i >= 0) { hit = i; break; } }
      if (hit < 0) for (const a of f.aliases) { const i = n.findIndex((h, idx) => a.length >= 3 && h.startsWith(a) && !used.has(idx)); if (i >= 0) { hit = i; break; } }
      if (hit >= 0) { map[f.key] = hit; used.add(hit); }
    }
    return map;
  }
  /** A mapping panel: one select per field, writes into `map`. */
  function mapPanel(title, fields, headers, map, onChange) {
    const box = el('div', 'biz-map');
    box.appendChild(el('p', 'biz-map-title', title));
    const grid = el('div', 'biz-map-grid');
    for (const f of fields) {
      const s = select('map-' + title.replace(/\W+/g, '-').toLowerCase() + '-' + f.key,
        [{ value: '', label: f.need ? '— required —' : '— not in this sheet —' }].concat(headers.map((h, i) => ({ value: i, label: h || ('Column ' + S().colName(i)) }))),
        map[f.key] === undefined ? '' : map[f.key]);
      s.addEventListener('change', () => { if (s.value === '') delete map[f.key]; else map[f.key] = Number(s.value); if (onChange) onChange(); });
      const w = field(f.label + (f.need ? ' *' : ''), s);
      if (f.need && map[f.key] === undefined) w.classList.add('is-missing');
      grid.appendChild(w);
    }
    box.appendChild(grid);
    return box;
  }
  const missing = (fields, map) => fields.filter(f => f.need && map[f.key] === undefined).map(f => f.label);

  /* ---------- matching ---------- */

  /** Invoice numbers as people type them: INV/2026/0417, inv-2026-0417, 0417 -> comparable. */
  const invKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=\d)/, '');
  const invTail = (s) => { const k = invKey(s); const m = /(\d+)$/.exec(k); return m ? String(Number(m[1])) : k; };

  window.MVRBizKit = { el, S, norm, money, inr, toNumber, toISODate, dayDiff, dropzone, field, select, textInput, textarea, msgBox, button, summaryCard, downloadButton, previewTable, statGrid, h3, issues, readTable, splitHeader, autoMap, mapPanel, missing, invKey, invTail };
})();
