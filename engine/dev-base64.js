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

/* ---- Base64 over bytes (RFC 4648), written here: no btoa() or atob() ---- */
const B64_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_REV = (function () {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < 64; i++) t[B64_STD.charCodeAt(i)] = i;
  t[45] = 62; t[95] = 63;      // - and _ are the URL-safe forms of + and /
  return t;
})();

/* bytes -> standard Base64 with padding, in slices so a big file stays cheap */
function b64Bytes(u8) {
  const parts = [];
  const full = u8.length - (u8.length % 3);
  for (let s = 0; s < full; s += 3 * 6000) {
    const end = Math.min(full, s + 3 * 6000);
    const codes = new Array(((end - s) / 3) * 4);
    let k = 0;
    for (let i = s; i < end; i += 3) {
      const n = (u8[i] << 16) | (u8[i + 1] << 8) | u8[i + 2];
      codes[k++] = B64_STD.charCodeAt(n >> 18);
      codes[k++] = B64_STD.charCodeAt((n >> 12) & 63);
      codes[k++] = B64_STD.charCodeAt((n >> 6) & 63);
      codes[k++] = B64_STD.charCodeAt(n & 63);
    }
    parts.push(String.fromCharCode.apply(null, codes));
  }
  const rest = u8.length - full;
  if (rest === 1) {
    const n = u8[full] << 16;
    parts.push(B64_STD[n >> 18] + B64_STD[(n >> 12) & 63] + '==');
  } else if (rest === 2) {
    const n = (u8[full] << 16) | (u8[full + 1] << 8);
    parts.push(B64_STD[n >> 18] + B64_STD[(n >> 12) & 63] + B64_STD[(n >> 6) & 63] + '=');
  }
  return parts.join('');
}
function b64Url(s) { return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64Wrap(s, w) {
  if (!w) return s;
  const lines = [];
  for (let i = 0; i < s.length; i += w) lines.push(s.slice(i, i + w));
  return lines.join('\n');
}
function b64LineCol(text, at) {
  const before = text.slice(0, at);
  const line = before.split('\n').length;
  return { line: line, col: at - before.lastIndexOf('\n') };
}

/* Base64 text (or a data: URI) -> bytes. Throws { message, at } with `at` an
   index into the text, so the page can mark the line and column. */
function b64Parse(text) {
  let body = text, start = 0, mime = '', fromUri = false;
  const lead = /^\s*/.exec(text)[0].length;
  const m = /^data:([^,]*),/i.exec(text.slice(lead));
  if (m) {
    fromUri = true;
    start = lead + m[0].length;
    body = text.slice(start);
    const meta = m[1].split(';');
    mime = (meta[0] || 'text/plain').toLowerCase();
    if (!/;base64$/i.test(m[1])) {
      // a percent-encoded data URI: the bytes are the text after the comma
      let s;
      try { s = decodeURIComponent(body.trim()); } catch (e) { throw { message: 'That data URI is not valid percent-encoding.', at: start }; }
      return { bytes: new TextEncoder().encode(s), mime: mime, uri: true, plain: true };
    }
  }
  const cleaned = new Array();
  let pad = 0, seenPad = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 11) continue;
    if (c === 61) { pad++; if (seenPad < 0) seenPad = start + i; continue; }
    if (pad) throw { message: 'The = padding can only come at the very end, but more Base64 follows it.', at: seenPad };
    if (c > 255 || B64_REV[c] < 0) {
      const ch = body[i];
      throw { message: 'That is not valid Base64: "' + ch + '" is not a Base64 character (A–Z, a–z, 0–9, + / or - _).', at: start + i };
    }
    cleaned.push(B64_REV[c]);
  }
  if (pad > 2) throw { message: 'That is not valid Base64: ' + pad + ' = signs at the end; at most two are allowed.', at: seenPad };
  const n = cleaned.length;
  if (n % 4 === 1) throw { message: 'That is not valid Base64: ' + n + ' characters cannot be it (the length leaves one stray character). The text may be cut off.', at: Math.max(0, text.length - 1) };
  if (pad && (n + pad) % 4 !== 0) throw { message: 'That is not valid Base64: the = padding does not match the length.', at: seenPad };
  const out = new Uint8Array(Math.floor(n * 3 / 4));
  let k = 0;
  for (let i = 0; i < n; i += 4) {
    const a = cleaned[i], b = cleaned[i + 1], c = i + 2 < n ? cleaned[i + 2] : -1, d = i + 3 < n ? cleaned[i + 3] : -1;
    out[k++] = (a << 2) | (b >> 4);
    if (c >= 0) out[k++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[k++] = ((c & 3) << 6) | d;
  }
  return { bytes: out, mime: mime, uri: fromUri };
}

function b64Sniff(u8) {
  const h = function (i) { return u8[i]; };
  if (u8.length >= 8 && h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47) return { kind: 'PNG image', ext: 'png', mime: 'image/png', image: true };
  if (u8.length >= 3 && h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return { kind: 'JPEG image', ext: 'jpg', mime: 'image/jpeg', image: true };
  if (u8.length >= 6 && h(0) === 0x47 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x38) return { kind: 'GIF image', ext: 'gif', mime: 'image/gif', image: true };
  if (u8.length >= 12 && h(0) === 0x52 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x46 && h(8) === 0x57 && h(9) === 0x45 && h(10) === 0x42 && h(11) === 0x50) return { kind: 'WebP image', ext: 'webp', mime: 'image/webp', image: true };
  if (u8.length >= 4 && h(0) === 0 && h(1) === 0 && h(2) === 1 && h(3) === 0) return { kind: 'Windows icon', ext: 'ico', mime: 'image/x-icon', image: true };
  if (u8.length >= 4 && h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46) return { kind: 'PDF document', ext: 'pdf', mime: 'application/pdf' };
  if (u8.length >= 4 && h(0) === 0x50 && h(1) === 0x4b && h(2) === 0x03 && h(3) === 0x04) return { kind: 'ZIP archive', ext: 'zip', mime: 'application/zip' };
  if (u8.length >= 2 && h(0) === 0x1f && h(1) === 0x8b) return { kind: 'gzip data', ext: 'gz', mime: 'application/gzip' };
  return null;
}
function b64Text(u8) {
  let s;
  try { s = new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { return null; }
  if (/[\x00-\x08\x0b\x0e-\x1f]/.test(s)) return null;
  return s;
}
function b64Hex(u8, max) {
  const n = Math.min(u8.length, max);
  const rows = [];
  for (let o = 0; o < n; o += 16) {
    let hex = '', asc = '';
    for (let i = 0; i < 16; i++) {
      if (o + i < n) {
        const b = u8[o + i];
        hex += (b < 16 ? '0' : '') + b.toString(16) + ' ';
        asc += b >= 32 && b < 127 ? String.fromCharCode(b) : '.';
      } else hex += '   ';
      if (i === 7) hex += ' ';
    }
    rows.push(('0000000' + o.toString(16)).slice(-8) + '  ' + hex + ' |' + asc + '|');
  }
  return rows.join('\n');
}
/* Base64 output for bytes under the options: variant, line length, data URI */
function b64Format(std, o, mime) {
  const uri = o.form === 'uri';
  let s = std;
  if (!uri && o.safe === 'url') s = b64Url(s);
  if (!uri) s = b64Wrap(s, Number(o.wrap) || 0);
  if (uri) s = 'data:' + (mime || 'application/octet-stream') + ';base64,' + s;
  const notes = [];
  if (uri && o.safe === 'url') notes.push('A data URI always uses the standard alphabet, so URL-safe was not applied.');
  if (uri && Number(o.wrap)) notes.push('A data URI is kept on one line, so the line length was not applied.');
  return { text: s, notes: notes };
}
function b64Size(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

window.DEV_TOOLS["base64"] = {
"title": "Base64 Encoder & Decoder",
"category": "developer",
"icon": "⇋",
"kind": "code",
"files": {"accept": "", "label": "Open file"},
"description": "Encode text or any file to Base64 and decode it back, with data URIs, URL-safe output, 64 and 76 character lines, an image preview and a hex view for binary.",
"keywords": ["base64 encode","base64 decode","base64 converter","url safe base64","file to base64","base64 to file","base64 image","data uri"],
"inputLabel": "Text or Base64",
"outputLabel": "Result",
"placeholder": "MVR IT Services",
"sample": "MVR IT Services — Technology · Delivered",
"download": {"ext": "txt", "type": "text/plain", "suffix": ".base64"},
"options": [
  {"key":"dir","label":"Direction","type":"select","default":"enc","options":[{"value":"enc","label":"Encode →"},{"value":"dec","label":"← Decode"}]},
  {"key":"safe","label":"Variant","type":"select","default":"std","options":[{"value":"std","label":"Standard"},{"value":"url","label":"URL-safe (-_ , no padding)"}]},
  {"key":"wrap","label":"Line length","type":"select","default":"0","options":[{"value":"0","label":"One line"},{"value":"76","label":"76 (MIME)"},{"value":"64","label":"64 (PEM)"}]},
  {"key":"form","label":"Output","type":"select","default":"plain","options":[{"value":"plain","label":"Base64 only"},{"value":"uri","label":"Data URI"}]}
],
"transform": (text, o) => {
      const dir = o.dir, mime = 'text/plain;charset=utf-8';
      if (!text.trim()) return { output: '', note: 'Type or paste something above, or open a file.' };
      if (dir === 'enc') {
        const raw = new TextEncoder().encode(text);
        const std = b64Bytes(raw);
        const f = b64Format(std, o, mime);
        /* Growth is bytes out over bytes in: the Base64 itself, over the UTF-8
           bytes the Input figure counts. Characters undercounted accented text,
           so Café Zoë — ₹1,499 paid ✓ (24 characters, 32 bytes) read +83%, not +38%. */
        const growth = '+' + Math.round((std.length / Math.max(1, raw.length) - 1) * 100) + '%';
        const res = { output: f.text, stats: [['Input', bytes(text)], ['Output', bytes(f.text)], ['Growth', growth]], download: { ext: 'txt', type: 'text/plain' } };
        if (f.notes.length) res.note = f.notes.join(' ');
        return res;
      }
      let p;
      try { p = b64Parse(text); }
      catch (e) {
        if (e && e.message) {
          const lc = b64LineCol(text, Math.min(text.length - 1, Math.max(0, e.at || 0)));
          return { error: e.message + ' (line ' + lc.line + ', column ' + lc.col + ')', errorAt: lc };
        }
        return { error: 'That is not valid Base64. Check for stray characters or truncation.' };
      }
      const u8 = p.bytes;
      const sniff = b64Sniff(u8);
      const asText = b64Text(u8);
      const stats = [['Input', bytes(text)], ['Output', b64Size(u8.length)]];
      const svg = asText !== null && /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(asText);
      if (asText !== null && !sniff) {
        stats.push(['Content', svg ? 'SVG image' : 'Text (UTF-8)']);
        const res = { output: asText, stats: stats, bytes: u8, mime: svg ? 'image/svg+xml' : (p.mime && !/^text\/plain/.test(p.mime) ? p.mime.split(';')[0] : 'text/plain'), download: { ext: svg ? 'svg' : 'txt', type: svg ? 'image/svg+xml' : 'text/plain', filename: 'decoded.' + (svg ? 'svg' : 'txt') } };
        if (svg) res.image = { mime: 'image/svg+xml' };
        return res;
      }
      const info = sniff || { kind: 'Binary data', ext: 'bin', mime: p.mime && p.mime !== 'text/plain' ? p.mime : 'application/octet-stream' };
      stats.push(['Content', info.kind]);
      const shown = Math.min(u8.length, 4096);
      const res = {
        output: b64Hex(u8, 4096),
        note: info.kind + ', ' + u8.length.toLocaleString('en-GB') + ' bytes, not text. The hex view shows the ' + (shown < u8.length ? 'first ' + shown.toLocaleString('en-GB') + ' bytes' : 'whole file') + '; Download saves it all as decoded.' + info.ext + '.',
        stats: stats, bytes: u8, mime: info.mime,
        download: { ext: info.ext, type: info.mime, filename: 'decoded.' + info.ext }
      };
      if (info.image) res.image = { mime: info.mime };
      return res;
    },
"tips": ["Base64 is encoding, not encryption. Anyone can decode it, so never use it to hide a password or key.","It inflates data by roughly 33%, which is why inlining large images as data URIs often makes pages slower.","The URL-safe variant swaps + and / for - and _ so the result survives being placed in a URL or filename.","Open or drop any file to encode it; choose Decode and paste a data URI or Base64 to get the file back, with a preview for images."],
"faq": [{"q":"Why does my non-English text break in other Base64 tools?","a":"Many tools call btoa() directly, which only handles Latin-1. This one converts to UTF-8 first, so accents, CJK characters and emoji round-trip correctly."},{"q":"Is a file I open uploaded?","a":"No. It is read in your browser and encoded there. Nothing is sent anywhere."}],
"mount": (ctx) => { ctx.b64 = { file: null, bytes: null, std: null, painting: false, url: '' }; },
"openFile": function (file, ctx) { return b64Open(file, ctx); },
"render": function (res, ctx) { b64Render(res, ctx); }
};

const B64_MAX_FILE = 200 * 1024 * 1024;

function b64FileResult(ctx) {
  const st = ctx.b64, o = ctx.opts(), file = st.file;
  const mime = file.type || (b64Sniff(st.bytes) || {}).mime || 'application/octet-stream';
  const f = b64Format(st.std, o, mime);
  const res = {
    output: f.text,
    stats: [['File', file.name], ['Input', b64Size(st.bytes.length)], ['Output', b64Size(f.text.length)], ['Growth', '+' + Math.round((st.std.length / Math.max(1, st.bytes.length) - 1) * 100) + '%']],
    download: { ext: 'txt', type: 'text/plain', filename: file.name.replace(/\.[^.]+$/, '') + '.base64.txt' },
    fromFile: true
  };
  if (f.notes.length) res.note = f.notes.join(' ');
  const sn = b64Sniff(st.bytes);
  if ((file.type && /^image\//.test(file.type)) || (sn && sn.image)) res.image = { mime: file.type || sn.mime, source: file };
  return res;
}

function b64Open(file, ctx) {
  const st = ctx.b64;
  const o = ctx.opts();
  if (o.dir === 'dec') {
    st.file = null;
    return file.text().then(function (t) {
      ctx.openedName = file.name;
      if (t.length > 2 * 1024 * 1024) ctx.bigText(t, file.name); else ctx.setText(t);
    });
  }
  if (file.size > B64_MAX_FILE) {
    ctx.show({ error: file.name + ' is ' + ctx.fmtSize(file.size) + '. Files over ' + ctx.fmtSize(B64_MAX_FILE) + ' are too big to encode in a browser tab.' });
    return Promise.resolve();
  }
  if (ctx.input.value) ctx.setText('');
  st.file = file;
  st.std = null;
  ctx.openedName = file.name;
  let cancelled = false;
  const bar = ctx.busy('Reading ' + file.name + ' (' + ctx.fmtSize(file.size) + ')…', function () {
    cancelled = true; bar.done(); st.file = null; ctx.openedName = null;
    ctx.message('warn', 'Stopped. Open the file again to start over.');
  });
  return file.arrayBuffer().then(function (buf) {
    if (cancelled) return;
    const u8 = new Uint8Array(buf);
    st.bytes = u8;
    /* encode in slices of 12 MB with a pause between, so Cancel can land */
    const parts = [];
    const step = 3 * 4 * 1024 * 1024;
    return new Promise(function (resolve) {
      let at = 0;
      (function next() {
        if (cancelled) { resolve(); return; }
        if (at >= u8.length) { st.std = parts.join(''); resolve(); return; }
        bar.update('Encoding ' + file.name + ': ' + Math.floor(at / u8.length * 100) + '%');
        parts.push(b64Bytes(u8.subarray(at, Math.min(u8.length, at + step))));
        at += step;
        setTimeout(next, 0);
      })();
    });
  }).then(function () {
    if (cancelled) return;
    bar.done();
    if (st.std === null) return;
    if (!st.bytes.length) st.std = '';
    st.painting = true;
    try { ctx.show(b64FileResult(ctx)); } finally { st.painting = false; }
  }, function (e) {
    bar.done(); st.file = null;
    ctx.show({ error: file.name + ' could not be read: ' + ((e && e.message) || 'unknown error') + '.' });
  });
}

function b64Render(res, ctx) {
  const st = ctx.b64;
  if (!st) return;
  const o = ctx.opts();
  if (st.file && !res.fromFile && !st.painting) {
    if (ctx.input.value || o.dir === 'dec') { st.file = null; }
    else if (st.std !== null) { st.painting = true; try { ctx.show(b64FileResult(ctx)); } finally { st.painting = false; } return; }
  }
  /* a picture of the decoded bytes, or of the opened file */
  const key = res.image && !res.error ? (res.image.source || res.bytes) : null;
  if (key && key === st.key && st.url) return;   // the same picture: leave it be
  st.key = key;
  if (st.url) { URL.revokeObjectURL(st.url); st.url = ''; }
  ctx.extra.textContent = '';
  if (!res.image || res.error) return;
  let blob = null;
  if (res.image.source) blob = res.image.source;
  else if (res.bytes) blob = new Blob([res.bytes], { type: res.image.mime });
  if (!blob) return;
  st.url = URL.createObjectURL(blob);
  const box = ctx.el('div', 'io-pane b64-image');
  const head = ctx.el('div', 'io-head');
  head.appendChild(ctx.el('span', 'io-label', 'Image preview'));
  const info = ctx.el('span', 'b64-dims', '');
  head.appendChild(info);
  const body = ctx.el('div', 'b64-image-body');
  const img = ctx.el('img');
  img.alt = 'Preview of the image';
  img.onload = function () { info.textContent = img.naturalWidth + ' × ' + img.naturalHeight + ' px'; };
  img.onerror = function () { info.textContent = 'This browser could not draw it'; };
  img.src = st.url;
  body.appendChild(img);
  box.appendChild(head);
  box.appendChild(body);
  ctx.extra.appendChild(box);
}
})();
