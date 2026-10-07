(function(){
/* ===================== shared helpers ===================== */

function bytes(s) {
  const n = new (typeof TextEncoder !== 'undefined' ? TextEncoder : Object)();
  const len = typeof TextEncoder !== 'undefined' ? n.encode(String(s)).length : String(s).length;
  if (len < 1024) return len + ' B';
  if (len < 1048576) return (len / 1024).toFixed(1) + ' KB';
  return (len / 1048576).toFixed(2) + ' MB';
}

function describeJsonError(e, text) {
  const msg = String(e.message || e);
  const m = msg.match(/position (\d+)/);
  if (!m) return 'Invalid JSON: ' + msg;
  const pos = Number(m[1]);
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  const snippet = (text.split('\n')[line - 1] || '').trim().slice(0, 60);
  return `Invalid JSON at line ${line}, column ${col}.\n${snippet ? '  ' + snippet + '\n' : ''}${msg.replace(/ in JSON.*/, '')}`;
}

function countNodes(v) {
  if (Array.isArray(v)) return v.length + v.reduce((n, x) => n + countNodes(x), 0);
  if (v && typeof v === 'object') {
    const k = Object.keys(v);
    return k.length + k.reduce((n, key) => n + countNodes(v[key]), 0);
  }
  return 0;
}

function depthOf(v, d = 1) {
  if (Array.isArray(v)) return v.length ? Math.max(...v.map(x => depthOf(x, d + 1))) : d;
  if (v && typeof v === 'object') {
    const k = Object.keys(v);
    return k.length ? Math.max(...k.map(key => depthOf(v[key], d + 1))) : d;
  }
  return d;
}

function checkXmlBalance(xml) {
  const stack = [];
  let depth = 0, maxDepth = 0, elements = 0;
  const re = /<\/?([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>/g;
  let m;
  while ((m = re.exec(xml))) {
    const tag = m[0];
    if (!m[1]) continue;                       // declaration, comment, CDATA, doctype
    if (tag.startsWith('</')) {
      const open = stack.pop();
      if (open !== m[1]) {
        return { error: open === undefined
          ? `Closing tag </${m[1]}> has no matching opening tag.`
          : `Mismatched tags: <${open}> is closed by </${m[1]}>.` };
      }
      depth--;
    } else if (m[3] === '/') {
      elements++;
    } else {
      stack.push(m[1]); elements++; depth++;
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  if (stack.length) return { error: `Unclosed tag: <${stack[stack.length - 1]}> is never closed.` };
  if (!elements) return { error: 'No XML elements found.' };
  return { elements, depth: maxDepth };
}

function minifyXml(xml) {
  return xml.replace(/>\s+</g, '><').replace(/^\s+|\s+$/g, '');
}

function formatXml(xml, pad) {
  const compact = minifyXml(xml);
  const tokens = compact.replace(/></g, '>\n<').split('\n');
  let depth = 0;
  return tokens.map(tok => {
    if (/^<\/[^>]+>$/.test(tok)) depth = Math.max(0, depth - 1);
    const line = pad.repeat(depth) + tok;
    const isOpen = /^<[^!?/][^>]*[^/]>$/.test(tok) || /^<[a-zA-Z][\w.:-]*>$/.test(tok);
    const selfClose = /\/>$/.test(tok) || /^<[?!]/.test(tok);
    const hasInline = /^<[^/][^>]*>.*<\/[^>]+>$/.test(tok);
    if (isOpen && !selfClose && !hasInline) depth++;
    return line;
  }).join('\n');
}

function parseCSV(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function b64encode(str) {
  const bytes = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += T[b0 >> 2];
    out += T[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
    out += b1 === undefined ? '=' : T[((b1 & 15) << 2) | ((b2 || 0) >> 6)];
    out += b2 === undefined ? '=' : T[b2 & 63];
  }
  return out;
}

function b64decode(b64) {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = String(b64).replace(/[\r\n\s]/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('bad base64');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map(k => {
      const ch = clean[i + k];
      return ch === undefined || ch === '=' ? -1 : T.indexOf(ch);
    });
    if (n[0] < 0 || n[1] < 0) break;
    bytes.push((n[0] << 2) | (n[1] >> 4));
    if (n[2] >= 0) bytes.push(((n[1] & 15) << 4) | (n[2] >> 2));
    if (n[3] >= 0) bytes.push(((n[2] & 3) << 6) | n[3]);
  }
  // UTF-8 decode
  let out = '', i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; }
    else if (b < 0xe0) { out += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
    else if (b < 0xf0) { out += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
    else {
      out += String.fromCodePoint(((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63));
      i += 4;
    }
  }
  return out;
}

function uuidV4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function humanDuration(sec) {
  if (sec < 60) return sec + ' s';
  if (sec < 3600) return Math.round(sec / 60) + ' min';
  if (sec < 86400) return Math.round(sec / 3600) + ' h';
  return Math.round(sec / 86400) + ' days';
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  const s = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(String(hex).trim());
  if (s) return { r: parseInt(s[1] + s[1], 16), g: parseInt(s[2] + s[2], 16), b: parseInt(s[3] + s[3], 16) };
  return null;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [Math.round(h), Math.round(mx === 0 ? 0 : (d / mx) * 100), Math.round(mx * 100)];
}

function relLum({ r, g, b }) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}


/* Which delimiter a pasted table uses, worked out from the text: the
   counting rule of parseDelimited in render-dev.js (characters outside
   quotes in the first 20 lines; tab wins ties, then comma over semicolon),
   with the pipe added, chosen only when it outnumbers all three. */
function detectDelimiter(text) {
  const sample = String(text).replace(/\r\n?/g, '\n').split('\n').slice(0, 20).join('\n');
  const counts = { '\t': 0, ',': 0, ';': 0, '|': 0 };
  let quoted = false;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && counts[c] !== undefined) counts[c]++;
  }
  if (counts['|'] > counts['\t'] && counts['|'] > counts[','] && counts['|'] > counts[';']) return '|';
  if (counts['\t'] > 0 && counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}
const DELIM_NAME = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

/* A cell's value when Infer types is on: JSON's own number syntax (so 007,
   1,000 and +5 stay text, and a whole number past 2^53 stays text rather
   than lose digits), true and false in any case, and null. Empty stays "". */
function inferType(s) {
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s);
    if (!isFinite(n)) return s;
    if (/^-?\d+$/.test(s) && !Number.isSafeInteger(n)) return s;
    return n;
  }
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true';
  if (s === 'null') return null;
  return s;
}

/* JSON → CSV: one row object to [column, value] pairs. Nested objects
   flatten to dotted columns (a.b.c); arrays, and an empty object, are
   written as JSON text. */
function flattenRow(o, prefix, into) {
  for (const k of Object.keys(o)) {
    const key = prefix ? prefix + '.' + k : k;
    const v = o[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) flattenRow(v, key, into);
    else into.push([key, v]);
  }
  return into;
}
function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/* CSV → JSON with Nest dotted headers: "a.b.c" becomes { a: { b: { c } } }.
   A header that would clash with another (a and a.b both present) stays a
   flat key, as written. A cell holding a JSON array or object becomes it. */
function nestRow(pairs) {
  const o = {};
  const clash = [];
  for (const [key, v] of pairs) {
    const parts = key.split('.');
    if (parts.length < 2 || parts.some((p) => p === '')) { if (key in o) clash.push(key); o[key] = v; continue; }
    let at = o, ok = true;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!(p in at)) at[p] = {};
      else if (!at[p] || typeof at[p] !== 'object' || Array.isArray(at[p])) { ok = false; break; }
      at = at[p];
    }
    const last = parts[parts.length - 1];
    if (ok && !(last in at)) at[last] = v;
    else { clash.push(key); o[key] = v; }
  }
  return { o, clash };
}
function arrayCell(v) {
  if (typeof v !== 'string' || !/^(\[[\s\S]*\]|\{[\s\S]*\})$/.test(v)) return v;
  try { const a = JSON.parse(v); return a && typeof a === 'object' ? a : v; } catch (e) { return v; }
}

let lastDir = 'c2j';

/* The parser the tool uses: parseCSV's rules (RFC 4180, a quote anywhere opens
   or closes a quoted run), and it says where a quote was left open. */
function csvScan(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false, qRow = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') { inQ = true; qRow = rows.length + 1; }
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return { rows: rows, openAt: inQ ? qRow : 0 };
}
let lastFmt = 'array';
const CSV_PREVIEW_ROWS = 100;

window.DEV_TOOLS = window.DEV_TOOLS || {};
window.DEV_TOOLS["csv-to-json"] = {
"title": "CSV to JSON Converter",
"category": "developer",
"icon": "⇄",
"kind": "code",
"files": {"accept": ".csv,.tsv,.txt,.json,.jsonl,.ndjson,text/csv,application/json", "label": "Open file"},
"highlight": (o) => (o.dir === 'j2c' ? null : 'json'),
"description": "Convert CSV or TSV to JSON or JSON Lines, and JSON back to CSV with Excel-style quoting, CRLF and a BOM, with a table preview and the problems named.",
"keywords": ["csv to json","json to csv","convert csv","tsv converter","spreadsheet to json","json lines","ndjson","excel csv"],
"inputLabel": "CSV / JSON",
"outputLabel": "Converted output",
"placeholder": "name,role,city\nPriya,Engineer,Reading\nSam,Designer,London",
"sample": "name,role,city\nPriya,Engineer,Reading\nSam,Designer,London\n\"Patel, R.\",Manager,Birmingham",
/* Download saves JSON as .json, JSON Lines as .jsonl and CSV as .csv: render-dev.js reads ext and
   type when the button is pressed, after the last conversion set lastDir. */
"download": { get ext() { return lastDir === 'j2c' ? 'csv' : lastFmt === 'lines' ? 'jsonl' : 'json'; }, get type() { return lastDir === 'j2c' ? 'text/csv' : lastFmt === 'lines' ? 'application/x-ndjson' : 'application/json'; }, suffix: '' },
"options": [
  {"key":"dir","label":"Direction","type":"select","default":"c2j","options":[{"value":"c2j","label":"CSV → JSON"},{"value":"j2c","label":"JSON → CSV"}]},
  {"key":"delim","label":"Delimiter","type":"select","default":"auto","options":[{"value":"auto","label":"Detect (comma for JSON → CSV)"},{"value":",","label":"Comma"},{"value":";","label":"Semicolon"},{"value":"\t","label":"Tab"},{"value":"|","label":"Pipe"}]},
  {"key":"header","label":"First row is a header","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No: column1, column2 …"}]},
  {"key":"types","label":"Infer types (CSV → JSON)","type":"select","default":"off","options":[{"value":"off","label":"Off: every value is text"},{"value":"on","label":"On: numbers, true/false, null"}]},
  {"key":"nest","label":"Dotted headers (CSV → JSON)","type":"select","default":"flat","options":[{"value":"flat","label":"Keep a.b as one key"},{"value":"nest","label":"Nest a.b into objects"}]},
  {"key":"fmt","label":"JSON form (CSV → JSON)","type":"select","default":"array","options":[{"value":"array","label":"One array"},{"value":"lines","label":"JSON Lines: one object a line"}]},
  {"key":"quote","label":"Quote fields (JSON → CSV)","type":"select","default":"min","options":[{"value":"min","label":"Only when needed"},{"value":"all","label":"Every field"},{"value":"text","label":"Text fields, not numbers"}]},
  {"key":"eol","label":"Line ends (JSON → CSV)","type":"select","default":"lf","options":[{"value":"lf","label":"LF"},{"value":"crlf","label":"CRLF (Excel, RFC 4180)"}]},
  {"key":"bom","label":"Byte order mark (JSON → CSV)","type":"select","default":"no","options":[{"value":"no","label":"None"},{"value":"yes","label":"Add one, so Excel reads UTF-8"}]}
],
"transform": (text, { dir, delim, header, types, nest, fmt, quote, eol, bom }) => {
      lastDir = dir === 'j2c' ? 'j2c' : 'c2j';
      lastFmt = fmt === 'lines' ? 'lines' : 'array';
      if (!text.trim()) return { output: '', note: 'Paste CSV or JSON above.' };
      text = text.replace(/^\uFEFF/, '');
      const picked = delim === '\\t' ? '\t' : delim;
      const auto = !picked || picked === 'auto';
      const withHeader = header !== 'no';
      if (dir !== 'j2c') {
        const d = auto ? detectDelimiter(text) : picked;
        const scan = csvScan(text, d);
        const rows = scan.rows.filter(r => r.some(c => c !== ''));
        if (rows.length < 1) return { error: 'No rows found.' };
        const width = withHeader ? rows[0].length : Math.max(...rows.map(r => r.length));
        const head = withHeader ? rows[0].map((h, i) => h || `column${i + 1}`) : Array.from({ length: width }, (x, i) => `column${i + 1}`);
        const body = withHeader ? rows.slice(1) : rows;
        const val = (c) => types === 'on' ? inferType(c) : c;
        const clashes = new Set();
        const objs = body.map(r => {
          const pairs = head.map((h, i) => [h, val(r[i] ?? '')]);
          if (nest !== 'nest') return pairs.reduce((o, [h, v]) => (o[h] = v, o), {});
          const n = nestRow(pairs.map(([h, v]) => [h, arrayCell(v)]));
          n.clash.forEach(k => clashes.add(k));
          return n.o;
        });
        const json = lastFmt === 'lines' ? objs.map(o => JSON.stringify(o)).join('\n') : JSON.stringify(objs, null, 2);
        const stats = [['Columns', String(head.length)], ['Data rows', String(objs.length)], ['Delimiter', DELIM_NAME[d] + (auto ? ' (detected)' : '')], ['Output', bytes(lastFmt === 'lines' ? json : JSON.stringify(objs))]];
        const res = { output: json, stats, download: lastFmt === 'lines' ? { ext: 'jsonl', type: 'application/x-ndjson' } : { ext: 'json', type: 'application/json' } };
        const warns = [];
        if (scan.openAt) warns.push('A quote opened in row ' + scan.openAt + ' is never closed, so the rest of the text was read as one field.');
        const longer = body.map((r, i) => [r.length, i]).filter(x => x[0] > head.length), shorter = body.filter(r => r.length < head.length).length;
        if (longer.length) warns.push(longer.length + (longer.length === 1 ? ' row has' : ' rows have') + ' more fields than the ' + head.length + ' column' + (head.length === 1 ? '' : 's') + ' (first: data row ' + (longer[0][1] + 1) + ', with ' + longer[0][0] + '); the extra fields were dropped.');
        if (shorter) warns.push(shorter + (shorter === 1 ? ' row has' : ' rows have') + ' fewer fields than the header; the missing ones are empty.');
        if (clashes.size) warns.push('Kept as flat keys, because another column already uses the name: ' + [...clashes].join(', ') + '.');
        if (warns.length) res.warn = warns.join(' ');
        res.table = { head: head, rows: body.slice(0, CSV_PREVIEW_ROWS).map(r => head.map((h, i) => r[i] ?? '')), total: body.length };
        return res;
      }
      const d = auto ? ',' : picked;
      let data;
      try { data = JSON.parse(text); }
      catch (e) {
        /* JSON Lines: every non-blank line is a JSON value of its own */
        const ls = text.split(/\r?\n/).filter(l => l.trim());
        let lines = null;
        if (ls.length > 1) { try { lines = ls.map(l => JSON.parse(l)); } catch (e2) { lines = null; } }
        if (lines) data = lines; else return { error: describeJsonError(e, text) };
      }
      if (!Array.isArray(data)) return { error: 'JSON → CSV needs an array of objects at the top level, or JSON Lines with one object a line.' };
      if (!data.length) return { output: '', note: 'Empty array.' };
      const flat = data.map(o => (o && typeof o === 'object' && !Array.isArray(o)) ? flattenRow(o, '', []) : []);
      const cols = [...new Set(flat.flatMap(p => p.map(x => x[0])))];
      const dupes = new Set();
      const maps = flat.map(p => { const m = new Map(); p.forEach(([k, v]) => { if (m.has(k)) dupes.add(k); m.set(k, v); }); return m; });
      const wrapQ = (s) => '"' + s.replace(/"/g, '""') + '"';
      const q = (v, isHead) => {
        const s = cellText(v);
        if (quote === 'all') return wrapQ(s);
        if (quote === 'text' && (isHead || typeof v === 'string')) return wrapQ(s);
        return /["\n\r]|^\s|\s$/.test(s) || s.includes(d) ? wrapQ(s) : s;
      };
      const lines = maps.map(m => cols.map(c => q(m.get(c))).join(d));
      if (withHeader) lines.unshift(cols.map(c => q(c, true)).join(d));
      const out = lines.join(eol === 'crlf' ? '\r\n' : '\n');
      const nested = cols.filter(c => c.includes('.')).length;
      const stats = [['Columns', String(cols.length)], ['Rows', String(data.length)]];
      if (nested) stats.push(['Dotted columns', String(nested)]);
      stats.push(['Output', bytes(out)]);
      const res = { output: out, stats, download: { ext: 'csv', type: 'text/csv' } };
      if (bom === 'yes') { res.bytes = new TextEncoder().encode('\uFEFF' + out); res.mime = 'text/csv'; res.download = { ext: 'csv', type: 'text/csv' }; stats.push(['Byte order mark', 'added to the download']); }
      if (dupes.size) res.warn = 'Two fields write to the same column, and the later one is kept: ' + [...dupes].join(', ') + '.';
      const cellOf = (m, c) => cellText(m.get(c));
      res.table = { head: cols, rows: maps.slice(0, CSV_PREVIEW_ROWS).map(m => cols.map(c => cellOf(m, c))), total: maps.length };
      return res;
    },
"tips": ["Fields containing the delimiter, a quote or a line break are wrapped in double quotes, and inner quotes are doubled — the RFC 4180 convention Excel expects.","Excel exports in some European locales use semicolons rather than commas. Detect, the default, counts commas, semicolons, tabs and pipes outside quotes in the first 20 lines and names its choice in the Delimiter row; pick one yourself if it guesses wrong.","Going JSON → CSV, the column set is the union of every object’s keys, so rows with missing fields still line up. Nested objects become dotted columns such as addr.city, and arrays are written as JSON text.","Nest a.b into objects turns dotted columns back into nested objects, and a cell holding JSON such as [\"a\",\"b\"] back into an array.","JSON Lines writes one object per line, ready for a log pipeline or a database import; JSON → CSV reads it as well as an array. For Excel, choose CRLF line ends and the byte order mark so accented text opens correctly. A table below the output previews the first 100 rows."],
"faq": [{"q":"Are numbers preserved as numbers?","a":"Only with Infer types on. CSV has no types, so by default every value stays a string. Infer types turns numbers written as JSON writes them into numbers, true and false into booleans and null into null; 007, 1,000, +5 and whole numbers past 9007199254740991 stay text, so no digit is lost. Empty cells stay empty strings."}],
"mount": (ctx) => {},
"render": function (res, ctx) { csvRender(res, ctx); }
};

function csvRender(res, ctx) {
  const box = ctx.extra;
  box.textContent = '';
  const t = res && res.table;
  if (!t || res.error || !t.head.length) return;
  const wrap = ctx.el('div', 'io-pane csv-table');
  const head = ctx.el('div', 'io-head');
  head.appendChild(ctx.el('span', 'io-label', 'Table preview'));
  head.appendChild(ctx.el('span', 'csv-count', (t.total > t.rows.length ? 'First ' + t.rows.length + ' of ' + t.total.toLocaleString('en-GB') + ' rows' : t.total.toLocaleString('en-GB') + (t.total === 1 ? ' row' : ' rows'))));
  wrap.appendChild(head);
  const scroll = ctx.el('div', 'csv-scroll');
  const tb = ctx.el('table', 'csv-grid');
  const hr = ctx.el('tr');
  hr.appendChild(ctx.el('th', null, '#'));
  t.head.forEach(function (h) { hr.appendChild(ctx.el('th', null, h)); });
  tb.appendChild(hr);
  t.rows.forEach(function (r, i) {
    const tr = ctx.el('tr');
    tr.appendChild(ctx.el('td', 'csv-n', String(i + 1)));
    r.forEach(function (c) { tr.appendChild(ctx.el('td', c === '' ? 'is-empty' : '', c.length > 200 ? c.slice(0, 200) + '…' : c)); });
    tb.appendChild(tr);
  });
  scroll.appendChild(tb);
  wrap.appendChild(scroll);
  box.appendChild(wrap);
}
})();
