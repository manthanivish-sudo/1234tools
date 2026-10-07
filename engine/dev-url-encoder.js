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


window.DEV_TOOLS = window.DEV_TOOLS || {};

/* ---- percent-encoding, by the RFC 3986 and WHATWG rules ---- */
function ueHex(c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'); }
/* application/x-www-form-urlencoded: only A–Z a–z 0–9 * - . _ stay; a space is + */
function ueFormEncode(s) {
  return encodeURIComponent(s).replace(/%20/g, '+').replace(/[!'()~]/g, ueHex);
}
function ueFormDecode(s) { return decodeURIComponent(s.replace(/\+/g, ' ')); }
function ueEncodeOne(s, scope) {
  if (scope === 'full') return encodeURI(s);
  if (scope === 'form') return ueFormEncode(s);
  return encodeURIComponent(s);
}
function ueDecodeOne(s, scope, plusSpace) {
  const t = plusSpace ? s.replace(/\+/g, ' ') : s;
  return scope === 'full' ? decodeURI(t) : decodeURIComponent(t);
}
function ueParseQuery(text) {
  let s = String(text).trim(), base = '', hash = '';
  const h = s.indexOf('#');
  if (h >= 0) { hash = s.slice(h + 1); s = s.slice(0, h); }
  const q = s.indexOf('?');
  if (q >= 0) { base = s.slice(0, q); s = s.slice(q + 1); }
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || s.charAt(0) === '/') { base = s; s = ''; }
  const rows = [], seen = {};
  s.split('&').forEach(function (part) {
    if (part === '') return;
    const i = part.indexOf('=');
    const rawName = i < 0 ? part : part.slice(0, i), rawValue = i < 0 ? '' : part.slice(i + 1);
    let name = rawName, value = rawValue, bad = false;
    try { name = ueFormDecode(rawName); } catch (e) { bad = true; name = rawName.replace(/\+/g, ' '); }
    try { value = ueFormDecode(rawValue); } catch (e) { bad = true; value = rawValue.replace(/\+/g, ' '); }
    seen[name] = (seen[name] || 0) + 1;
    rows.push({ name: name, value: value, noEquals: i < 0, bad: bad });
  });
  rows.forEach(function (r) { r.dup = seen[r.name] > 1; });
  return { base: base, hash: hash, rows: rows, unique: Object.keys(seen).length };
}
function ueBuildQuery(text, scope) {
  const lines = String(text).split(/\r?\n/);
  let base = '';
  const pairs = [];
  lines.forEach(function (ln, i) {
    if (!ln.trim()) return;
    if (!pairs.length && !base && ln.indexOf('\t') < 0 && (/^[a-z][a-z0-9+.-]*:\/\//i.test(ln.trim()) || ln.trim().charAt(0) === '/')) { base = ln.trim(); return; }
    let name, value, t = ln.indexOf('\t');
    if (t >= 0) { name = ln.slice(0, t); value = ln.slice(t + 1); }
    else { const e = ln.indexOf('='); if (e >= 0) { name = ln.slice(0, e).trim(); value = ln.slice(e + 1); } else { name = ln.trim(); value = ''; } }
    pairs.push([name, value]);
  });
  const enc = function (x) { return ueEncodeOne(x, scope === 'form' ? 'form' : 'component'); };
  const q = pairs.map(function (p) { return enc(p[0]) + '=' + enc(p[1]); }).join('&');
  return { base: base, query: q, count: pairs.length, text: base ? (q ? base + '?' + q : base) : q };
}

window.DEV_TOOLS["url-encoder"] = {
"title": "URL Encoder & Decoder",
"category": "developer",
"icon": "🔗",
"kind": "code",
"files": {"accept": ".txt,text/plain", "label": "Open text file"},
"description": "Percent-encode and decode text for URLs, form data and query strings, one line at a time if you like, and turn a query string into a table and back.",
"keywords": ["url encode","url decode","percent encoding","uri encode","query string encode","query string parser","form urlencoded","batch url encode"],
"inputLabel": "Text, encoded URL or query string",
"outputLabel": "Result",
"placeholder": "https://example.com/search?q=hello world&lang=en-GB",
"sample": "https://www.1234tools.com/utilities/tool-finder/?q=merge two PDFs&lang=en-GB",
"options": [
  {"key":"dir","label":"Direction","type":"select","default":"enc","options":[{"value":"enc","label":"Encode →"},{"value":"dec","label":"← Decode"},{"value":"table","label":"Query string → table"},{"value":"build","label":"Table → query string"}]},
  {"key":"scope","label":"Scope","type":"select","default":"component","options":[{"value":"component","label":"Component (a single value)"},{"value":"full","label":"Full URL (keeps :/?#&= intact)"},{"value":"form","label":"Form (space as +)"}]},
  {"key":"plus","label":"Treat + as space (decoding)","type":"select","default":"auto","options":[{"value":"auto","label":"Auto (no in Full URL)"},{"value":"yes","label":"Yes: + is a space"},{"value":"no","label":"No: + stays +"}]},
  {"key":"lines","label":"Lines","type":"select","default":"whole","options":[{"value":"whole","label":"Whole text as one"},{"value":"each","label":"Each line separately"}]}
],
"transform": (text, { dir, scope, plus, lines }) => {
      if (!text.trim()) return { output: '', note: 'Type or paste something above.' };
      if (dir === 'table') {
        const q = ueParseQuery(text);
        if (!q.rows.length) return { output: '', note: q.base ? 'That address has no query string, so there is nothing to put in a table.' : 'No name=value pairs found.', table: q };
        const out = q.rows.map((r) => r.name + '\t' + r.value).join('\n');
        const dups = q.rows.filter((r) => r.dup).length;
        const res = { output: out, table: q, stats: [['Parameters', String(q.rows.length)], ['Distinct names', String(q.unique)], ['Repeated', String(dups)]], download: { ext: 'tsv', type: 'text/tab-separated-values' } };
        if (q.rows.some((r) => r.bad)) res.warn = 'A % that is not followed by two hex digits was left as typed in ' + q.rows.filter((r) => r.bad).length + ' name or value.';
        return res;
      }
      if (dir === 'build') {
        const b = ueBuildQuery(text, scope);
        if (!b.count) return { output: b.base, note: 'Write one name and value per line, separated by a tab or =.' };
        return { output: b.text, stats: [['Parameters', String(b.count)], ['Output', bytes(b.text)]] };
      }
      /* A + is a space only in form-encoded text (a query string sent by an
         HTML form); RFC 3986 and decodeURIComponent leave it alone. So when
         decoding, + is read as a space first if the option says so (Auto:
         yes for a single value or a form, no for a whole address), which also
         keeps %2B as a real plus sign. Encoding writes + only in Form scope. */
      const plusSpace = dir !== 'enc' && (plus === 'yes' || (plus !== 'no' && scope !== 'full'));
      const plusCount = dir !== 'enc' ? (text.match(/\+/g) || []).length : 0;
      const one = (s) => dir === 'enc' ? ueEncodeOne(s, scope) : ueDecodeOne(s, scope, plusSpace);
      const malformed = dir === 'enc'
        ? 'That text holds half of a surrogate pair (a broken emoji), which cannot be written as UTF-8.'
        : 'Malformed percent-encoding — check for a stray % not followed by two hex digits.';
      if (lines === 'each') {
        const src = text.split(/\r?\n/), outL = [], bad = [];
        src.forEach((ln, i) => {
          if (!ln) { outL.push(''); return; }
          try { outL.push(one(ln)); } catch (e) { outL.push(ln); bad.push(i + 1); }
        });
        const output = outL.join('\n');
        const res = { output, stats: [['Lines', String(src.filter((x) => x).length)], ['Input', bytes(text)], ['Output', bytes(output)]] };
        if (plusCount) res.stats.push(['Plus signs', plusCount + (plusSpace ? (plusCount === 1 ? ' read as a space' : ' read as spaces') : ' kept as +')]);
        if (bad.length) res.warn = (bad.length === 1 ? 'Line ' + bad[0] + ' is' : 'Lines ' + bad.slice(0, 8).join(', ') + (bad.length > 8 ? ' and ' + (bad.length - 8) + ' more are' : ' are')) + ' not valid ' + (dir === 'enc' ? 'text to encode' : 'percent-encoding') + ' and ' + (bad.length === 1 ? 'was' : 'were') + ' left as typed.';
        return res;
      }
      try {
        const output = one(text);
        const stats = [['Input', bytes(text)], ['Output', bytes(output)]];
        if (plusCount) stats.push(['Plus signs', plusCount + (plusSpace ? (plusCount === 1 ? ' read as a space' : ' read as spaces') : ' kept as +')]);
        return { output, stats };
      } catch (e) {
        return { error: malformed };
      }
    },
"tips": ["Use Component scope for a single query value. Full URL scope leaves :/?#&= alone so the address stays usable.","A space is %20 in a path but + in a query string sent by a form. Form scope writes the +; decoding, Treat + as space reads each + as a space (Auto: yes in Component and Form scope, no in Full URL scope). An encoded plus, %2B, never becomes a space.","Encoding an already-encoded string double-encodes it: % becomes %25. Decode first if in doubt.","Each line separately encodes or decodes a list, one result per line; a line that cannot be decoded is left as typed and named.","Query string → table splits a pasted address into names and values, marks repeated names, and Table → query string builds one back from lines of name, a tab or =, and value."],
"faq": [{"q":"Which characters actually need encoding?","a":"Anything outside A–Z, a–z, 0–9 and - _ . ~ is unsafe in a URL component. Reserved characters such as & = ? # / must be encoded when they appear inside a value rather than as separators."},{"q":"What is the difference between Component and Form?","a":"Component is encodeURIComponent: a space becomes %20. Form is what an HTML form sends, application/x-www-form-urlencoded: a space becomes + and ! ' ( ) ~ are escaped too."}],
"render": function (res, ctx) { ueRender(res, ctx); }
};

function ueRender(res, ctx) {
  const box = ctx.extra;
  box.textContent = '';
  const q = res && res.table;
  if (!q || !q.rows.length) return;
  const wrap = ctx.el('div', 'io-pane ue-table');
  const head = ctx.el('div', 'io-head');
  head.appendChild(ctx.el('span', 'io-label', 'Query string as a table'));
  wrap.appendChild(head);
  if (q.base || q.hash) {
    const meta = ctx.el('div', 'ue-meta');
    if (q.base) { meta.appendChild(ctx.el('span', 'ue-k', 'Address')); meta.appendChild(ctx.el('code', null, q.base)); }
    if (q.hash) { meta.appendChild(ctx.el('span', 'ue-k', 'Fragment')); meta.appendChild(ctx.el('code', null, '#' + q.hash)); }
    wrap.appendChild(meta);
  }
  const scroll = ctx.el('div', 'ue-scroll');
  const t = ctx.el('table', 'ue-grid');
  const h = ctx.el('tr');
  ['#', 'Name', 'Value', ''].forEach(function (x) { h.appendChild(ctx.el('th', null, x)); });
  t.appendChild(h);
  q.rows.forEach(function (r, i) {
    const tr = ctx.el('tr', r.dup ? 'is-dup' : '');
    tr.appendChild(ctx.el('td', null, String(i + 1)));
    tr.appendChild(ctx.el('td', 'ue-name', r.name));
    tr.appendChild(ctx.el('td', 'ue-val', r.value === '' ? (r.noEquals ? '(no =)' : '(empty)') : r.value));
    tr.appendChild(ctx.el('td', 'ue-flag', r.dup ? 'repeated' : ''));
    t.appendChild(tr);
  });
  scroll.appendChild(t);
  wrap.appendChild(scroll);
  box.appendChild(wrap);
}
})();
