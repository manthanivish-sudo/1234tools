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
window.DEV_TOOLS["base64"] = {
"title": "Base64 Encoder & Decoder",
"category": "developer",
"icon": "⇋",
"kind": "code",
"description": "Encode text to Base64 or decode it back. Full Unicode support, plus URL-safe output.",
"keywords": ["base64 encode","base64 decode","base64 converter","url safe base64"],
"inputLabel": "Text or Base64",
"outputLabel": "Result",
"placeholder": "MVR IT Services",
"sample": "MVR IT Services — Technology · Delivered",
"options": [{"key":"dir","label":"Direction","type":"select","default":"enc","options":[{"value":"enc","label":"Encode →"},{"value":"dec","label":"← Decode"}]},{"key":"safe","label":"Variant","type":"select","default":"std","options":[{"value":"std","label":"Standard"},{"value":"url","label":"URL-safe (-_ , no padding)"}]}],
"transform": (text, { dir, safe }) => {
      if (!text.trim()) return { output: '', note: 'Type or paste something above.' };
      try {
        if (dir === 'enc') {
          let out = b64encode(text);
          if (safe === 'url') out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          return { output: out, stats: [['Input', bytes(text)], ['Output', bytes(out)], ['Growth', `+${Math.round((out.length / Math.max(1, text.length) - 1) * 100)}%`]] };
        }
        let src = text.trim().replace(/-/g, '+').replace(/_/g, '/');
        while (src.length % 4) src += '=';
        const out = b64decode(src);
        return { output: out, stats: [['Input', bytes(text)], ['Output', bytes(out)]] };
      } catch (e) {
        return { error: dir === 'dec' ? 'That is not valid Base64. Check for stray characters or truncation.' : 'Could not encode that input.' };
      }
    },
"tips": ["Base64 is encoding, not encryption. Anyone can decode it — never use it to hide a password or key.","It inflates data by roughly 33%, which is why inlining large images as data URIs often makes pages slower.","The URL-safe variant swaps + and / for - and _ so the result survives being placed in a URL or filename."],
"faq": [{"q":"Why does my non-English text break in other Base64 tools?","a":"Many tools call btoa() directly, which only handles Latin-1. This one converts to UTF-8 first, so accents, CJK characters and emoji round-trip correctly."}]
};
})();