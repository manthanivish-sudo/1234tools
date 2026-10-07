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

/* ===== identifiers: RFC 9562 UUIDs (v1, v4, v7), ULID and nanoid ===== */
function uuRandom(n) {
  const b = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
  return b;
}
const uuHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const uuDash = (h) => h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
function uuMs(b, ms) {
  // 48-bit big-endian millisecond count into b[0..5]
  for (let i = 5, v = ms; i >= 0; i--) { b[i] = v % 256; v = Math.floor(v / 256); }
}
/* version 7: 48-bit Unix milliseconds, a 12-bit counter that makes IDs made in one millisecond sort in the order
   they were made (RFC 9562 6.2, method 1), then random bits. The counter starts below 0x800 so there is room to
   count; if it still overflows, the millisecond moves on by one. */
function uuV7(n, now) {
  const out = [];
  let ms = now;
  const r0 = uuRandom(2);
  let ctr = ((r0[0] << 8) | r0[1]) & 0x7FF;
  for (let i = 0; i < n; i++) {
    if (i > 0) ctr++;
    if (ctr > 0xFFF) { ms++; ctr = uuRandom(2)[0] & 0x7FF; }
    const b = uuRandom(16);
    uuMs(b, ms);
    b[6] = 0x70 | (ctr >> 8);
    b[7] = ctr & 0xFF;
    b[8] = 0x80 | (b[8] & 0x3F);
    out.push(uuDash(uuHex(b)));
  }
  return out;
}
/* version 1: 100-nanosecond ticks since 15 October 1582, a random 14-bit clock sequence and a random node with
   the multicast bit set (RFC 9562 6.10): no hardware address is read. Ticks go up by one for each ID of a batch. */
function uuV1(n, now) {
  const out = [];
  const node = uuRandom(8);
  const base = (BigInt(now) + 12219292800000n) * 10000n;
  for (let i = 0; i < n; i++) {
    const t = base + BigInt(i);
    const low = Number(t & 0xFFFFFFFFn), mid = Number((t >> 32n) & 0xFFFFn), hi = Number((t >> 48n) & 0x0FFFn) | 0x1000;
    const h = low.toString(16).padStart(8, '0') + mid.toString(16).padStart(4, '0') + hi.toString(16).padStart(4, '0') +
      (0x80 | (node[6] & 0x3F)).toString(16).padStart(2, '0') + node[7].toString(16).padStart(2, '0') +
      ((node[0] | 1).toString(16).padStart(2, '0')) + uuHex(node.slice(1, 6));
    out.push(uuDash(h));
  }
  return out;
}
function uuV4(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) { out.push(crypto.randomUUID()); continue; }
    const b = uuRandom(16);
    b[6] = 0x40 | (b[6] & 0x0F);
    b[8] = 0x80 | (b[8] & 0x3F);
    out.push(uuDash(uuHex(b)));
  }
  return out;
}
const UU_B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function uuB32(v, len) {
  let s = '';
  for (let i = 0; i < len; i++) { s = UU_B32[Number(v & 31n)] + s; v >>= 5n; }
  return s;
}
/* ULID: 48-bit milliseconds then 80 random bits, 26 Crockford base 32 characters. Within a millisecond each ID
   is the previous one plus one in the random part, as the specification's monotonic mode says. */
function uuUlid(n, now) {
  const out = [];
  let rnd = 0n;
  uuRandom(10).forEach((x) => { rnd = (rnd << 8n) | BigInt(x); });
  for (let i = 0; i < n; i++) {
    if (i > 0) rnd = (rnd + 1n) & ((1n << 80n) - 1n);
    out.push(uuB32(BigInt(now), 10) + uuB32(rnd, 16));
  }
  return out;
}
/* nanoid's method: a bit mask over random bytes, keeping the bytes that index the alphabet, so no character is
   likelier than another whatever the alphabet's length */
function uuNano(n, size, alphabet) {
  const a = Array.from(alphabet);
  const mask = (2 << Math.floor(Math.log2(a.length - 1))) - 1;
  const step = Math.ceil(1.6 * mask * size / a.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    let id = '';
    while (id.length < size) {
      const bytes = uuRandom(step);
      for (let k = 0; k < bytes.length && id.length < size; k++) { const c = a[bytes[k] & mask]; if (c !== undefined) id += c; }
    }
    out.push(id);
  }
  return out;
}

/* ===== the checker ===== */
function uuTicksToMs(ticks) { return Number(ticks / 10000n - 12219292800000n); }
function uuCheck(line) {
  let s = line.trim();
  if (!s) return null;
  s = s.replace(/^urn:uuid:/i, '').replace(/^\{(.*)\}$/, '$1');
  let hex = null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) hex = s.replace(/-/g, '').toLowerCase();
  else if (/^[0-9a-f]{32}$/i.test(s)) hex = s.toLowerCase();
  if (hex) {
    if (hex === '0'.repeat(32)) return { ok: true, what: 'the nil UUID (all zeros)' };
    if (hex === 'f'.repeat(32)) return { ok: true, what: 'the max UUID (all ones)' };
    const v = parseInt(hex[12], 16), vr = parseInt(hex[16], 16);
    const variant = vr < 8 ? 'NCS (reserved)' : vr < 12 ? 'RFC 9562' : vr < 14 ? 'Microsoft (reserved)' : 'reserved for the future';
    let what = 'UUID version ' + v + ', ' + variant + ' variant';
    if (vr >= 8 && vr < 12) {
      const names = { 1: 'time-based', 2: 'DCE security', 3: 'name-based (MD5)', 4: 'random', 5: 'name-based (SHA-1)', 6: 'reordered time-based', 7: 'Unix-time ordered', 8: 'custom' };
      if (names[v]) what += ' (' + names[v] + ')';
      else return { ok: false, what: 'the version digit is ' + v + ', which RFC 9562 does not define' };
      if (v === 7) what += ', made ' + new Date(parseInt(hex.slice(0, 12), 16)).toISOString();
      if (v === 1) { const t = (BigInt('0x' + hex.slice(12, 16).replace(/^./, '0')) << 48n) | (BigInt('0x' + hex.slice(8, 12)) << 32n) | BigInt('0x' + hex.slice(0, 8)); what += ', made ' + new Date(uuTicksToMs(t)).toISOString(); }
      if (v === 6) { const t = (BigInt('0x' + hex.slice(0, 8)) << 28n) | (BigInt('0x' + hex.slice(8, 12)) << 12n) | BigInt('0x' + hex.slice(13, 16)); what += ', made ' + new Date(uuTicksToMs(t)).toISOString(); }
      return { ok: true, what: what };
    }
    return { ok: false, what: 'well-shaped, but its variant digit ' + hex[16] + ' is not 8, 9, a or b, so it is not an RFC 9562 UUID (' + variant + ')' };
  }
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) {
    const up = s.toUpperCase();
    if (up[0] > '7') return { ok: false, what: 'looks like a ULID but the first character is above 7, which would overflow 48 bits of time' };
    let ts = 0;
    for (let i = 0; i < 10; i++) ts = ts * 32 + UU_B32.indexOf(up[i]);
    return { ok: true, what: 'ULID, made ' + new Date(ts).toISOString() };
  }
  if (/^[A-Za-z0-9_-]{21}$/.test(s)) return { ok: true, what: 'has the shape of a default nanoid (21 URL-safe characters); nothing more can be checked' };
  const hexish = s.replace(/-/g, '');
  let why;
  if (/[^0-9a-fA-F-]/.test(s) && s.length >= 30 && s.length <= 40) why = 'it has a character that is not a hex digit: "' + (s.match(/[^0-9a-fA-F-]/) || [''])[0] + '"';
  else if (hexish.length === 32) why = 'the hyphens are in the wrong places (the layout is 8-4-4-4-12)';
  else if (/^[0-9a-fA-F-]+$/.test(s)) why = 'it has ' + hexish.length + ' hex digits; a UUID has 32';
  else why = 'it is neither a UUID (36 characters with hyphens, or 32 without) nor a 26-character ULID';
  return { ok: false, what: why };
}

window.DEV_TOOLS["uuid-generator"] = {
"title": "UUID Generator",
"category": "developer",
"icon": "🆔",
"kind": "generate",
"filename": "uuids.txt",
"download": {"ext": "txt", "type": "text/plain"},
"description": "Generate UUID v4, v7 and v1, ULID and nanoid with a secure random source, in bulk, and check any UUID or ULID to see its version and when it was made.",
"keywords": ["uuid generator","guid generator","uuid v4","uuid v7","ulid generator","nanoid generator","uuid validator","random id","unique identifier"],
"inputLabel": null,
"outputLabel": "Generated IDs",
"regenerate": true,
"fields": [
  {"key":"mode","label":"What to do","type":"select","default":"gen","options":[{"value":"gen","label":"Generate"},{"value":"check","label":"Check IDs"}]},
  {"key":"kind","label":"Type","type":"select","default":"v4","options":[{"value":"v4","label":"UUID v4 (random)"},{"value":"v7","label":"UUID v7 (time-ordered)"},{"value":"v1","label":"UUID v1 (time and node)"},{"value":"ulid","label":"ULID"},{"value":"nano","label":"nanoid"}]},
  {"key":"count","label":"How many","type":"number","default":10,"min":1,"max":500},
  {"key":"case","label":"Case (UUIDs)","type":"select","default":"lower","options":[{"value":"lower","label":"Lowercase"},{"value":"upper","label":"Uppercase"}]},
  {"key":"braces","label":"Format (UUIDs)","type":"select","default":"plain","options":[{"value":"plain","label":"Plain"},{"value":"braces","label":"Braces {…}"},{"value":"nodash","label":"No hyphens"}]},
  {"key":"size","label":"nanoid length","type":"number","default":21,"min":2,"max":128},
  {"key":"alphabet","label":"nanoid characters","type":"text","default":"A-Za-z0-9_-"},
  {"key":"ids","label":"IDs to check (one per line)","type":"textarea","default":""}
],
"generate": (f) => {
      if (f.mode === 'check') {
        const lines = String(f.ids || '').split(/\r?\n/);
        const rows = [];
        let ok = 0, bad = 0;
        lines.forEach((l) => { const r = uuCheck(l); if (!r) return; (r.ok ? ok++ : bad++); rows.push(l.trim() + '\n    ' + (r.ok ? '✓ ' : '✗ ') + r.what); });
        if (!rows.length) return { output: '', warn: 'Paste one or more UUIDs or ULIDs, one per line.' };
        return { output: rows.join('\n'), stats: [['Checked', String(ok + bad)], ['Valid', String(ok)], ['Not valid', String(bad)]] };
      }
      const n = Math.max(1, Math.min(500, Math.floor(Number(f.count)) || 1));
      const now = Date.now();
      const kind = f.kind;
      let ids, label, bits;
      if (kind === 'v7') { ids = uuV7(n, now); label = '7 (Unix time, then random)'; bits = 62 + 12; }
      else if (kind === 'v1') { ids = uuV1(n, now); label = '1 (time and a random node)'; bits = 14 + 47; }
      else if (kind === 'ulid') { ids = uuUlid(n, now); label = 'ULID (48-bit time, 80 random bits)'; bits = 80; }
      else if (kind === 'nano') {
        const size = Math.max(2, Math.min(128, Math.floor(Number(f.size)) || 21));
        let alpha = String(f.alphabet || '').trim();
        /* ranges such as A-Za-z0-9 expand; a leading or trailing - is a hyphen */
        let chars = '';
        for (let i = 0; i < alpha.length; i++) {
          if (i + 2 < alpha.length && alpha[i + 1] === '-') { const a = alpha.codePointAt(i), b = alpha.codePointAt(i + 2); if (b >= a && b - a < 256) { for (let c = a; c <= b; c++) chars += String.fromCodePoint(c); i += 2; continue; } }
          chars += alpha[i];
        }
        chars = Array.from(new Set(chars)).join('');
        if (Array.from(chars).length < 2) return { error: 'The nanoid characters need at least two different characters, for example A-Za-z0-9_-' };
        if (Array.from(chars).length > 256) return { error: 'The nanoid characters can hold at most 256 different characters.' };
        ids = uuNano(n, size, chars);
        label = 'nanoid, ' + size + ' characters from ' + Array.from(chars).length;
        bits = Math.floor(size * Math.log2(Array.from(chars).length));
      } else { ids = uuV4(n); label = '4 (random)'; bits = 122; }
      const isUuid = kind === 'v4' || kind === 'v7' || kind === 'v1';
      ids = ids.map((u) => {
        if (isUuid) { if (f.braces === 'nodash') u = u.replace(/-/g, ''); if (f.case === 'upper') u = u.toUpperCase(); if (f.braces === 'braces') u = '{' + u + '}'; }
        return u;
      });
      return {
        output: ids.join('\n'),
        stats: [['Generated', String(n)], ['Version', isUuid ? label : kind === 'ulid' ? 'ULID' : 'nanoid'], ['Random bits', String(bits)], ['Source', typeof crypto !== 'undefined' && crypto.getRandomValues ? 'crypto.getRandomValues' : 'Math.random fallback']]
      };
    },
"tips": ["Version 4 UUIDs carry 122 random bits. You would need to generate about 2.7 × 10¹⁸ of them before a collision became likely.","Random IDs make poor primary keys in large tables because the index fragments. UUID v7 and ULID start with the time, so new rows land together and a batch sorts in the order it was made.","The version 4 marker is fixed: the 13th hex digit is always 4, and the 17th is 8, 9, a or b.","Check IDs reads any UUID version, with or without hyphens or braces, and a ULID, and for v1, v6, v7 and ULID says when it was made.","A nanoid is shorter (21 characters by default) and URL-safe; a custom alphabet is allowed, with ranges such as a-z0-9."],
"faq": [{"q":"Are these safe to use as security tokens?","a":"They are generated with the browser’s cryptographic random source, so the entropy is sound. Even so, use a purpose-built token with an expiry and server-side validation for sessions or password resets."},{"q":"Which should I use: v4, v7 or ULID?","a":"v4 when you want pure randomness and no clock in the ID. v7 or ULID when the IDs are database keys: they sort by creation time, v7 in the standard 36-character UUID form."},{"q":"Does a version 1 UUID reveal my computer?","a":"Not here. The node part is random with the multicast bit set, as RFC 9562 allows, so no network address is read. The time in it is the time you generated it."}],
"render": function (res, ctx) { uuShow(ctx); }
};

/* only the fields the chosen mode and type use are shown */
function uuShow(ctx) {
  const f = ctx.fields();
  const keys = ['mode', 'kind', 'count', 'case', 'braces', 'size', 'alphabet', 'ids'];
  const wraps = ctx.form.querySelectorAll('.field');
  const chk = f.mode === 'check', uuid = f.kind === 'v4' || f.kind === 'v7' || f.kind === 'v1', nano = f.kind === 'nano';
  const show = { mode: true, kind: !chk, count: !chk, case: !chk && uuid, braces: !chk && uuid, size: !chk && nano, alphabet: !chk && nano, ids: chk };
  keys.forEach(function (k, i) { if (wraps[i]) wraps[i].hidden = !show[k]; });
}
})();
