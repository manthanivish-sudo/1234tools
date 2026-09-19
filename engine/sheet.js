/**
 * Spreadsheets, in the page.
 *
 * CSV in and out, .xlsx in and out, with no library and no upload: the
 * workbook is a ZIP of XML, so it is unzipped here with DecompressionStream
 * and read with DOMParser, and written back as STORE-method ZIP entries
 * through the site's own ZIP writer. Shared by the Tally converter and the
 * AI tools, so a fix to date handling or shared strings lands everywhere.
 *
 *   MVRSheet.parseCSV(text, delim)      -> rows
 *   MVRSheet.sniffDelim(text)           -> ',' | ';' | '\t'
 *   MVRSheet.toCSV(rows)                -> text (CRLF, quoted where needed)
 *   MVRSheet.readXlsx(arrayBuffer)      -> [{ name, rows }]
 *   MVRSheet.writeXlsx(rows, sheetName) -> Blob
 *   MVRSheet.fromFile(file)             -> { name, kind, sheets } | { name, kind, text }
 *   MVRSheet.rowsToText(rows, maxRows)  -> tab-separated text, for a prompt
 *   MVRSheet.download(blob, name)
 */
(function () {
  'use strict';

  const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const fmtBytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';

  /* ---------- CSV ---------- */

  function parseCSV(text, delim) {
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"') inQ = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function sniffDelim(text) {
    const head = text.slice(0, 4000).split('\n')[0] || '';
    const counts = [[',', (head.match(/,/g) || []).length], [';', (head.match(/;/g) || []).length], ['\t', (head.match(/\t/g) || []).length]];
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] ? counts[0][0] : ',';
  }

  function toCSV(rows) {
    const cell = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  /* ---------- ZIP (read) ---------- */

  async function unzip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('This is not a ZIP-based file. An .xlsx is; an old .xls is not — save it as .xlsx or .csv first.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const entries = {};
    const dec = new TextDecoder();
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('The ZIP directory is damaged.');
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      if (csize === 0xffffffff || off === 0xffffffff) throw new Error('ZIP64 workbooks are not supported.');
      entries[dec.decode(u8.subarray(p + 46, p + 46 + nlen))] = { method, csize, usize, off };
      p += 46 + nlen + elen + clen;
    }
    async function read(name) {
      const e = entries[name];
      if (!e) return null;
      const lh = e.off;
      if (dv.getUint32(lh, true) !== 0x04034b50) throw new Error('A ZIP entry header is damaged.');
      const nlen = dv.getUint16(lh + 26, true), elen = dv.getUint16(lh + 28, true);
      const start = lh + 30 + nlen + elen;
      const data = u8.subarray(start, start + e.csize);
      if (e.method === 0) return data;
      if (e.method !== 8) throw new Error('Unsupported ZIP compression method ' + e.method + '.');
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot inflate ZIP data. Use a current Chrome, Edge, Firefox or Safari, or save the sheet as CSV.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return { names: Object.keys(entries), read };
  }

  /* ---------- XLSX ---------- */

  const colIndex = (letters) => { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const colName = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  async function readXlsx(buf) {
    const z = await unzip(buf);
    const dec = new TextDecoder();
    const text = async (n) => { const b = await z.read(n); return b ? dec.decode(b) : null; };
    const parse = (s) => {
      const doc = new DOMParser().parseFromString(s, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('The workbook contains XML this browser could not parse.');
      return doc;
    };
    const wbx = await text('xl/workbook.xml');
    if (!wbx) throw new Error('No workbook inside — this ZIP is not an .xlsx.');
    const wb = parse(wbx);
    const rels = parse(await text('xl/_rels/workbook.xml.rels') || '<Relationships/>');
    const relMap = {};
    for (const r of rels.getElementsByTagName('Relationship')) relMap[r.getAttribute('Id')] = r.getAttribute('Target');
    const shared = [];
    const ssx = await text('xl/sharedStrings.xml');
    if (ssx) {
      for (const si of parse(ssx).getElementsByTagName('si')) {
        let s = '';
        for (const t of si.getElementsByTagName('t')) if (!t.closest || !t.closest('rPh')) s += t.textContent;
        shared.push(s);
      }
    }
    const sheets = [];
    for (const s of wb.getElementsByTagName('sheet')) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let target = relMap[rid] || '';
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
      const x = await text(target);
      if (!x) continue;
      const doc = parse(x);
      const rows = [];
      for (const r of doc.getElementsByTagName('row')) {
        const arr = [];
        for (const c of r.getElementsByTagName('c')) {
          const ref = c.getAttribute('r') || '';
          const col = ref ? colIndex(ref.replace(/[0-9]/g, '')) : arr.length;
          const t = c.getAttribute('t');
          const v = c.getElementsByTagName('v')[0];
          let val = '';
          if (t === 's') val = shared[Number(v ? v.textContent : -1)] ?? '';
          else if (t === 'inlineStr') { val = ''; for (const tt of c.getElementsByTagName('t')) val += tt.textContent; }
          else if (t === 'b') val = v && v.textContent === '1' ? 'TRUE' : 'FALSE';
          else if (t === 'str' || t === 'e') val = v ? v.textContent : '';
          else if (v) { const n = Number(v.textContent); val = Number.isFinite(n) ? n : v.textContent; }
          arr[col] = val;
        }
        rows.push(Array.from(arr, (x) => (x === undefined ? '' : x)));
      }
      while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop();
      sheets.push({ name: s.getAttribute('name') || ('Sheet' + (sheets.length + 1)), rows });
    }
    if (!sheets.length) throw new Error('The workbook has no sheets.');
    return sheets;
  }

  /**
   * rows -> one sheet; [{ name, rows }] -> several. A reconciliation report
   * is three sheets, and a person expects them as tabs, not as three files.
   */
  async function writeXlsx(rowsOrSheets, sheetName) {
    if (!window.MVRZip) throw new Error('The ZIP writer did not load.');
    const sheets = (Array.isArray(rowsOrSheets) && rowsOrSheets.length && rowsOrSheets[0] && Array.isArray(rowsOrSheets[0].rows))
      ? rowsOrSheets : [{ name: sheetName || 'Sheet1', rows: rowsOrSheets }];
    const sheetXml = (rows) => {
      let sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
      rows.forEach((r, ri) => {
        sheet += '<row r="' + (ri + 1) + '">';
        r.forEach((v, ci) => {
          if (v === '' || v == null) return;
          const ref = colName(ci) + (ri + 1);
          if (typeof v === 'number' && Number.isFinite(v)) sheet += '<c r="' + ref + '"><v>' + v + '</v></c>';
          else sheet += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(String(v)) + '</t></is></c>';
        });
        sheet += '</row>';
      });
      return sheet + '</sheetData></worksheet>';
    };
    const safe = (s, i) => xmlEsc(String(s || ('Sheet' + (i + 1))).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    const files = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map((s, i) => '<sheet name="' + safe(s.name, i) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']
    ].concat(sheets.map((s, i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s.rows)]));
    return window.MVRZip(files.map(([n, t]) => ({ name: n, blob: new Blob([t], { type: 'application/xml' }) })));
  }

  /* ---------- convenience ---------- */

  /** A File -> what it holds. Spreadsheets give sheets; anything else gives text. */
  async function fromFile(file) {
    if (/\.xlsx$/i.test(file.name)) return { name: file.name, kind: 'xlsx', sheets: await readXlsx(await file.arrayBuffer()) };
    const text = await file.text();
    if (/\.(csv|tsv)$/i.test(file.name) || /text\/csv/.test(file.type)) return { name: file.name, kind: 'csv', sheets: [{ name: file.name, rows: parseCSV(text, sniffDelim(text)) }] };
    return { name: file.name, kind: 'text', text };
  }

  /** Rows as tab-separated text, the shape a model reads most reliably. */
  function rowsToText(rows, maxRows) {
    const take = maxRows ? rows.slice(0, maxRows) : rows;
    return take.map(r => r.map(v => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  }

  /** Objects -> rows with a header of every key seen, in first-seen order. */
  function objectsToRows(list) {
    const keys = [];
    for (const o of list) for (const k of Object.keys(o || {})) if (!keys.includes(k)) keys.push(k);
    const cell = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v);
    return [keys].concat(list.map(o => keys.map(k => cell(o[k]))));
  }

  window.MVRSheet = { parseCSV, sniffDelim, toCSV, readXlsx, writeXlsx, fromFile, rowsToText, objectsToRows, download, fmtBytes, colName };
})();
