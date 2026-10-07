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

/* Favicon generator: an uploaded image, or text or an emoji drawn on the page.
   The shell (render-dev.js mountFile) makes the PNGs, favicon.ico, the
   manifest, the ZIP and the <head> snippet; this spec adds the sources, the
   SVG favicon with its dark-mode variant, the path prefix and the tab preview.
   Fonts are the five OFL faces in /engine/vendor/favicon-fonts/, fetched only
   when the visitor picks Text. */
const FAV_FONTS = [
  { id: 'inter', label: 'Inter ExtraBold', file: 'inter-latin-800-normal.woff', family: 'FavInter', weight: 800 },
  { id: 'playfair', label: 'Playfair Display Bold', file: 'playfair-display-latin-700-normal.woff', family: 'FavPlayfair', weight: 700 },
  { id: 'bebas', label: 'Bebas Neue', file: 'bebas-neue-latin-400-normal.woff', family: 'FavBebas', weight: 400 },
  { id: 'pacifico', label: 'Pacifico', file: 'pacifico-latin-400-normal.woff', family: 'FavPacifico', weight: 400 },
  { id: 'mono', label: 'JetBrains Mono Bold', file: 'jetbrains-mono-latin-700-normal.woff', family: 'FavMono', weight: 700 }
];
const FAV_EMOJI_STACK = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const FAV_DEFAULTS = {
  mode: 'image', text: 'A', emoji: '🚀', font: 'inter', color: '#ffffff', fill: '#1d4ed8', shape: 'rounded',
  dark: 'no', dcolor: '#ffffff', dfill: '#0f172a', prefix: '/'
};
const FAV_SHAPES = [['rounded', 'Rounded square'], ['square', 'Square'], ['circle', 'Circle'], ['none', 'No tile']];

const favFontBuf = {};
function favFontBase() { return (window.__BASE__ || '/') + 'engine/vendor/favicon-fonts/'; }
function favLoadFont(f) {
  if (!favFontBuf[f.id]) {
    favFontBuf[f.id] = fetch(favFontBase() + f.file).then(function (r) {
      if (!r.ok) throw new Error('font');
      return r.arrayBuffer();
    }).then(function (buf) {
      const face = new FontFace(f.family, buf.slice(0), { weight: String(f.weight) });
      return face.load().then(function () { document.fonts.add(face); return buf; });
    });
    favFontBuf[f.id].catch(function () { delete favFontBuf[f.id]; });
  }
  return favFontBuf[f.id];
}
function favFirstGraphemes(s, n) {
  s = String(s || '');
  if (window.Intl && Intl.Segmenter) return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), function (x) { return x.segment; }).slice(0, n).join('');
  return Array.from(s).slice(0, n).join('');
}
function favNormPrefix(v) {
  let p = String(v || '').replace(/["'<>\s\\]/g, '');
  if (!p) return '/';
  if (!/\/$/.test(p)) p += '/';
  return p;
}
function favXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function favB64(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function favFace(S) {
  if (S.mode === 'emoji') return { css: FAV_EMOJI_STACK, weight: 400, font: null, text: favFirstGraphemes(S.emoji, 1) };
  const f = FAV_FONTS.filter(function (x) { return x.id === S.font; })[0] || FAV_FONTS[0];
  return { css: '"' + f.family + '"', weight: f.weight, font: f, text: favFirstGraphemes(S.text, 3) };
}
/* Where the text goes in a tile of size 1: font size, left edge of the ink's
   centre and the baseline, all as fractions of the tile. The ink box is
   measured on a canvas at 1000 px so a glyph is centred by what is drawn, not
   by its advance width. */
function favGeom(face, content) {
  const c = document.createElement('canvas').getContext('2d');
  c.font = face.weight + ' 1000px ' + face.css;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  const m = c.measureText(face.text);
  let asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent, abl = m.actualBoundingBoxLeft, abr = m.actualBoundingBoxRight;
  if (!(asc + desc > 0) || !(abl + abr > 0)) { asc = 800; desc = 200; abl = 0; abr = m.width || 600; }
  const fs = Math.min(content * 1000 / (abl + abr), content * 1000 / (asc + desc), 0.95);
  const k = fs / 1000;   // ink figures are per 1000 px
  return { fs: fs, x: 0.5 - ((abr - abl) / 2) * k, y: 0.5 + ((asc - desc) / 2) * k };
}
function favContent(face, kind) {
  const n = Array.from(face.text).length;
  const base = face.font ? (n <= 1 ? 0.7 : n === 2 ? 0.74 : 0.82) : 0.78;
  return kind === 'maskable' ? base * 0.72 : base;
}
function favTile(ctx, size, shape, colour) {
  if (shape === 'none') return;
  ctx.fillStyle = colour;
  const r = shape === 'circle' ? size / 2 : shape === 'rounded' ? size * 0.22 : 0;
  ctx.beginPath();
  if (r && ctx.roundRect) ctx.roundRect(0, 0, size, size, r); else ctx.rect(0, 0, size, size);
  ctx.fill();
}
/* kind: 'plain' (the tile's own shape), 'full' (apple-touch: opaque square),
   'maskable' (opaque square, text inside the safe zone) */
function favDraw(S, size, kind, dark) {
  const face = favFace(S);
  if (!face.text) return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const fill = dark ? S.dfill : S.fill, ink = dark ? S.dcolor : S.color;
  if (kind === 'plain') favTile(ctx, size, S.shape, fill);
  else { ctx.fillStyle = fill; ctx.fillRect(0, 0, size, size); }
  const g = favGeom(face, favContent(face, kind));
  ctx.font = face.weight + ' ' + (g.fs * size) + 'px ' + face.css;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink;
  ctx.fillText(face.text, g.x * size, g.y * size);
  return c;
}
/* The SVG favicon. dark: draw the dark colours with no media query (for the
   preview); 'query': the file itself, with the light colours and a
   prefers-color-scheme: dark block when dark colours are switched on. */
function favSvg(S, buf, mode) {
  const face = favFace(S);
  if (!face.text) return '';
  const g = favGeom(face, favContent(face, 'plain'));
  const dk = mode === 'dark';
  const fill = dk ? S.dfill : S.fill, ink = dk ? S.dcolor : S.color;
  let css = '';
  if (face.font && buf) css += '@font-face{font-family:"' + face.font.family + '";font-weight:' + face.weight + ';src:url(data:font/woff;base64,' + favB64(buf) + ') format("woff")}';
  css += '.t{font-family:' + face.css.replace(/"/g, "'") + ';font-weight:' + face.weight + ';font-size:' + (g.fs * 64).toFixed(2) + 'px;fill:' + ink + '}';
  if (S.shape !== 'none') css += '.b{fill:' + fill + '}';
  if (mode === 'query' && S.dark === 'yes') css += '@media (prefers-color-scheme:dark){.t{fill:' + S.dcolor + '}' + (S.shape !== 'none' ? '.b{fill:' + S.dfill + '}' : '') + '}';
  const rx = S.shape === 'circle' ? 32 : S.shape === 'rounded' ? 14 : 0;
  let tile = '';
  if (S.shape === 'circle') tile = '<circle class="b" cx="32" cy="32" r="32"/>';
  else if (S.shape !== 'none') tile = '<rect class="b" width="64" height="64"' + (rx ? ' rx="' + rx + '"' : '') + '/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>' + css + '</style>' + tile +
    '<text class="t" x="' + (g.x * 64).toFixed(2) + '" y="' + (g.y * 64).toFixed(2) + '">' + favXml(face.text) + '</text></svg>\n';
}

window.DEV_TOOLS["favicon-generator"] = {
"title": "Favicon Generator",
"category": "developer",
"icon": "🖼️",
"kind": "favicon",
"description": "Make a favicon from an image, a letter or an emoji: PNG sizes, favicon.ico, an SVG with a dark-mode variant, and the HTML to install them.",
"keywords": ["favicon generator","favicon maker","app icon generator","apple touch icon","website icon","pwa icons","svg favicon","emoji favicon","text favicon","dark mode favicon"],
"tips": ["Start from a square image of at least 512×512. A smaller image is scaled up to fill the larger icons, and those will look soft; the tool names every size it had to enlarge. Text and Emoji are drawn afresh at every size, so even the 16×16 icon is crisp.","Detailed logos turn to mush at 16×16. A single letter or symbol on a solid tile holds up at the smallest sizes.","Maskable icons get cropped to a circle or squircle by Android. The maskable icon keeps your text or image inside the middle 80%.","Dark-mode colours go into the SVG favicon only. PNG and ICO files cannot change with the theme, and browsers that ignore SVG favicons show the light colours.","Browsers cache favicons aggressively. Add ?v=2 to the path when you change one."],
"faq": [{"q":"Is my image uploaded anywhere?","a":"No. The icons are drawn on a canvas in your browser. An uploaded file never leaves your device, and the five fonts for the Text source are served from this site, only once you choose Text."},{"q":"Do I still need favicon.ico?","a":"Only for older browsers and some feed readers. Current browsers take an SVG or PNG favicon, which is why the snippet pins the ICO to 32×32 when an SVG is present."},{"q":"Why is the SVG favicon only offered for Text, Emoji and SVG uploads?","a":"Those can be written as vector shapes. A photo or PNG would have to be embedded as a bitmap inside the SVG, which is larger than the PNGs and no sharper, so the tool does not pretend otherwise."},{"q":"What does the path prefix do?","a":"It sets where the files will live on your site. The links in the snippet and the icon paths in site.webmanifest start with it, for example /assets/icons/ or https://cdn.example.com/icons/."}],
"prefix": function (f) { return favNormPrefix(f.S && f.S.prefix); },
"background": function (f) { return f.S && f.S.mode !== 'image' ? f.S.fill : ''; },
"isVector": function (f) { return !!(f.S && f.S.mode !== 'image'); },
"sourceLabel": function (f) { return f.S && f.S.mode !== 'image' ? (f.S.mode === 'emoji' ? 'Emoji ' + favFirstGraphemes(f.S.emoji, 1) : 'Text “' + favFirstGraphemes(f.S.text, 3) + '”') : ''; },
"drawIcon": function (f, size, name) {
  const S = f.S;
  if (!S || S.mode === 'image') return null;
  const kind = name.indexOf('maskable') > -1 ? 'maskable' : name.indexOf('apple') > -1 ? 'full' : 'plain';
  return favDraw(S, size, kind, false);
},
"mount": function (f) {
  const el = f.el;
  const saved = f.store.get('s') || {};
  const S = Object.assign({}, FAV_DEFAULTS);
  Object.keys(FAV_DEFAULTS).forEach(function (k) { if (typeof saved[k] === 'string') S[k] = saved[k]; });
  if (!/^#[0-9a-f]{6}$/i.test(S.color)) S.color = FAV_DEFAULTS.color;
  ['fill', 'dcolor', 'dfill'].forEach(function (k) { if (!/^#[0-9a-f]{6}$/i.test(S[k])) S[k] = FAV_DEFAULTS[k]; });
  if (['image', 'text', 'emoji'].indexOf(S.mode) < 0) S.mode = 'image';
  if (!FAV_FONTS.some(function (x) { return x.id === S.font; })) S.font = 'inter';
  if (!FAV_SHAPES.some(function (x) { return x[0] === S.shape; })) S.shape = 'rounded';
  S.text = favFirstGraphemes(S.text, 3);
  S.emoji = favFirstGraphemes(S.emoji, 1);
  S.prefix = String(S.prefix).slice(0, 200);
  f.S = S;

  /* source switch */
  const bar = el('div', 'fav-modes');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Icon source');
  const modeBtns = {};
  [['image', 'Image'], ['text', 'Text'], ['emoji', 'Emoji']].forEach(function (m) {
    const b = el('button', 'btn-ghost', m[1]);
    b.type = 'button';
    b.addEventListener('click', function () { setMode(m[0]); });
    modeBtns[m[0]] = b;
    bar.appendChild(b);
  });
  f.io.insertBefore(bar, f.drop);

  /* text / emoji controls */
  const panel = el('div', 'opt-bar fav-src');
  function field(label, node, cls) {
    const w = el('div', 'field' + (cls ? ' ' + cls : ''));
    const l = el('label', null, label);
    const id = 'fav-' + Math.random().toString(36).slice(2, 8);
    node.id = id;
    l.setAttribute('for', id);
    w.appendChild(l);
    w.appendChild(node);
    panel.appendChild(w);
    return w;
  }
  function colour(key) {
    const wrap = el('div', 'colour-field');
    const sw = el('input'); sw.type = 'color'; sw.className = 'colour-swatch'; sw.value = S[key];
    const hex = el('input', 'control colour-hex'); hex.type = 'text'; hex.value = S[key]; hex.spellcheck = false;
    sw.addEventListener('input', function () { hex.value = sw.value; S[key] = sw.value; changed(); });
    hex.addEventListener('input', function () { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { sw.value = hex.value; S[key] = hex.value; changed(); } });
    wrap.appendChild(sw); wrap.appendChild(hex);
    wrap.write = function (v) { sw.value = v; hex.value = v; };
    return wrap;
  }
  const tIn = el('input', 'control'); tIn.type = 'text'; tIn.value = S.text; tIn.maxLength = 12; tIn.autocomplete = 'off';
  tIn.addEventListener('input', function () { S.text = favFirstGraphemes(tIn.value, 3); changed(); });
  const textField = field('Text (up to 3 characters)', tIn);
  const eIn = el('input', 'control'); eIn.type = 'text'; eIn.value = S.emoji; eIn.maxLength = 16; eIn.autocomplete = 'off';
  eIn.addEventListener('input', function () { S.emoji = favFirstGraphemes(eIn.value, 1); changed(); });
  const emojiField = field('Emoji (one)', eIn);
  const fSel = el('select', 'control');
  FAV_FONTS.forEach(function (x) { const o = el('option', null, x.label); o.value = x.id; if (x.id === S.font) o.selected = true; fSel.appendChild(o); });
  fSel.addEventListener('change', function () { S.font = fSel.value; changed(); });
  const fontField = field('Font', fSel);
  const cInk = colour('color');
  const inkField = field('Text colour', cInk);
  const cFill = colour('fill');
  const fillField = field('Tile colour', cFill);
  const shSel = el('select', 'control');
  FAV_SHAPES.forEach(function (x) { const o = el('option', null, x[1]); o.value = x[0]; if (x[0] === S.shape) o.selected = true; shSel.appendChild(o); });
  shSel.addEventListener('change', function () { S.shape = shSel.value; changed(); });
  field('Tile shape', shSel);
  const dWrap = el('label', 'check-label');
  const dBox = el('input'); dBox.type = 'checkbox'; dBox.checked = S.dark === 'yes';
  dBox.addEventListener('change', function () { S.dark = dBox.checked ? 'yes' : 'no'; changed(); });
  dWrap.appendChild(dBox); dWrap.appendChild(el('span', null, 'Different colours when the browser is in dark mode (SVG favicon)'));
  const dField = el('div', 'field field-check fav-dark'); dField.appendChild(dWrap); panel.appendChild(dField);
  const cdInk = colour('dcolor');
  const dInkField = field('Dark-mode text colour', cdInk);
  const cdFill = colour('dfill');
  const dFillField = field('Dark-mode tile colour', cdFill);
  f.io.insertBefore(panel, f.drop);

  /* path prefix, beside the site name */
  const pIn = el('input', 'control'); pIn.type = 'text'; pIn.value = S.prefix; pIn.spellcheck = false; pIn.placeholder = '/';
  const pw = el('div', 'field');
  const pl = el('label', null, 'Path prefix (where the files will live)');
  pIn.id = 'fav-prefix'; pl.setAttribute('for', pIn.id);
  pw.appendChild(pl); pw.appendChild(pIn);
  f.opts.appendChild(pw);
  pIn.addEventListener('input', function () { S.prefix = pIn.value; save(); if (f.source) f.render(); });

  const dropHTML = null;
  let stash = null, timer = 0, seq = 0;
  function save() { f.store.set('s', S); }
  function syncUi() {
    ['image', 'text', 'emoji'].forEach(function (m) { modeBtns[m].setAttribute('aria-pressed', S.mode === m ? 'true' : 'false'); });
    const vec = S.mode !== 'image';
    panel.style.display = vec ? '' : 'none';
    f.drop.style.display = vec ? 'none' : '';
    f.bgField.style.display = vec ? 'none' : '';
    textField.style.display = S.mode === 'text' ? '' : 'none';
    fontField.style.display = S.mode === 'text' ? '' : 'none';
    emojiField.style.display = S.mode === 'emoji' ? '' : 'none';
    inkField.style.display = S.mode === 'text' ? '' : 'none';
    const dk = S.dark === 'yes';
    dInkField.style.display = S.mode === 'text' && dk ? '' : 'none';
    dFillField.style.display = dk && S.shape !== 'none' ? '' : 'none';
  }
  function setMode(m) {
    if (S.mode === m) return;
    if (S.mode === 'image') stash = { img: f.source, file: f.file };
    S.mode = m;
    save();
    syncUi();
    if (m === 'image') {
      if (stash && stash.img) f.setSource(stash.img, null, stash.file); else f.setSource(null);
    } else refresh();
  }
  function changed() { save(); syncUi(); clearTimeout(timer); timer = setTimeout(refresh, 120); }
  async function refresh() {
    if (S.mode === 'image') return;
    const my = ++seq;
    const face = favFace(S);
    if (!face.text) { f.setSource(null); f.msg.textContent = S.mode === 'emoji' ? 'Type one emoji above.' : 'Type one to three characters above.'; f.msg.className = 'io-msg'; return; }
    if (face.font) {
      try { await favLoadFont(face.font); }
      catch (e) { f.msg.textContent = 'The font “' + face.font.label + '” could not be loaded. Check your connection and try again.'; f.msg.className = 'io-msg is-error'; return; }
      if (my !== seq) return;
    }
    const c = favDraw(S, 512, 'plain', false);
    f.setSource(c, null);
  }
  f._refresh = refresh;
  syncUi();
  if (S.mode !== 'image') refresh();
},
"extraFiles": async function (f, ctx) {
  const S = f.S;
  const out = { files: [], links: [] };
  const prefix = ctx.prefix;
  if (S && S.mode !== 'image') {
    const face = favFace(S);
    const buf = face.font ? await favLoadFont(face.font) : null;
    const svg = favSvg(S, buf, 'query');
    if (svg) {
      out.files.push({ name: 'favicon.svg', blob: new Blob([svg], { type: 'image/svg+xml' }), tag: 'SVG', use: S.dark === 'yes' ? 'Vector, with dark-mode colours' : 'Vector, any size' });
      out.links.push('<link rel="icon" href="' + prefix + 'favicon.svg" type="image/svg+xml">');
      out.svgFirst = true;
      out.svgText = svg;
      out.svgLight = favSvg(S, buf, 'light');
      out.svgDark = favSvg(S, buf, 'dark');
    }
  } else if (f.file && /^image\/svg\+xml$/.test(f.file.type)) {
    const text = await f.file.text();
    out.files.push({ name: 'favicon.svg', blob: new Blob([text], { type: 'image/svg+xml' }), tag: 'SVG', use: 'Your SVG, unchanged' });
    out.links.push('<link rel="icon" href="' + prefix + 'favicon.svg" type="image/svg+xml">');
    out.svgFirst = true;
    out.svgText = text;
  }
  f._more = out;
  return out;
},
"render": function (f, info) {
  if (f._prev) { f._prev.node.remove(); f._prev.urls.forEach(function (u) { URL.revokeObjectURL(u); }); f._prev = null; }
  const el = f.el, S = f.S || {};
  const more = info.more || {};
  const urls = [];
  const png = info.files.filter(function (x) { return x.name === 'favicon-32x32.png'; })[0];
  const pngUrl = png ? URL.createObjectURL(png.blob) : '';
  if (pngUrl) urls.push(pngUrl);
  function srcFor(dark) {
    const text = dark && more.svgDark ? more.svgDark : more.svgLight || more.svgText;
    if (text) { const u = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })); urls.push(u); return u; }
    return pngUrl;
  }
  const title = info.appName || 'Your site';
  const wrap = el('div', 'fav-prev');
  wrap.appendChild(el('h3', 'fav-prev-h', 'In a browser tab'));
  const row = el('div', 'fav-prev-row');
  [['Light browser', false], ['Dark browser', true]].forEach(function (x) {
    const strip = el('div', 'fav-strip ' + (x[1] ? 'is-dark' : 'is-light'));
    const tab = el('div', 'fav-tab');
    const img = el('img', 'fav-ico');
    img.src = srcFor(x[1]);
    img.alt = '';
    img.width = 16; img.height = 16;
    tab.appendChild(img);
    tab.appendChild(el('span', 'fav-tab-title', title));
    strip.appendChild(tab);
    strip.appendChild(el('span', 'fav-strip-label', x[0]));
    row.appendChild(strip);
  });
  wrap.appendChild(row);
  const note = (S.mode !== 'image' || more.svgText)
    ? (S.dark === 'yes' && S.mode !== 'image' ? 'The dark tab shows your dark-mode colours, as the SVG favicon will in a browser that is in dark mode.' : 'Shown from the SVG favicon.')
    : 'Shown from favicon-32x32.png, scaled to 16 px.';
  wrap.appendChild(el('p', 'fav-prev-note', note));
  f.io.insertBefore(wrap, f.results);
  f._prev = { node: wrap, urls: urls };
}
};
})();
