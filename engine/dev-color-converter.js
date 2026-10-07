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

/* ================= colour maths, written from the CSS Color 4 and WCAG 2 texts ================= */
const CC_NAMES = {
  aliceblue: 'f0f8ff', antiquewhite: 'faebd7', aqua: '00ffff', aquamarine: '7fffd4', azure: 'f0ffff', beige: 'f5f5dc', bisque: 'ffe4c4', black: '000000', blanchedalmond: 'ffebcd', blue: '0000ff', blueviolet: '8a2be2', brown: 'a52a2a', burlywood: 'deb887', cadetblue: '5f9ea0', chartreuse: '7fff00', chocolate: 'd2691e', coral: 'ff7f50', cornflowerblue: '6495ed', cornsilk: 'fff8dc', crimson: 'dc143c', cyan: '00ffff', darkblue: '00008b', darkcyan: '008b8b', darkgoldenrod: 'b8860b', darkgray: 'a9a9a9', darkgreen: '006400', darkgrey: 'a9a9a9', darkkhaki: 'bdb76b', darkmagenta: '8b008b', darkolivegreen: '556b2f', darkorange: 'ff8c00', darkorchid: '9932cc', darkred: '8b0000', darksalmon: 'e9967a', darkseagreen: '8fbc8f', darkslateblue: '483d8b', darkslategray: '2f4f4f', darkslategrey: '2f4f4f', darkturquoise: '00ced1', darkviolet: '9400d3', deeppink: 'ff1493', deepskyblue: '00bfff', dimgray: '696969', dimgrey: '696969', dodgerblue: '1e90ff', firebrick: 'b22222', floralwhite: 'fffaf0', forestgreen: '228b22', fuchsia: 'ff00ff', gainsboro: 'dcdcdc', ghostwhite: 'f8f8ff', gold: 'ffd700', goldenrod: 'daa520', gray: '808080', green: '008000', greenyellow: 'adff2f', grey: '808080', honeydew: 'f0fff0', hotpink: 'ff69b4', indianred: 'cd5c5c', indigo: '4b0082', ivory: 'fffff0', khaki: 'f0e68c', lavender: 'e6e6fa', lavenderblush: 'fff0f5', lawngreen: '7cfc00', lemonchiffon: 'fffacd', lightblue: 'add8e6', lightcoral: 'f08080', lightcyan: 'e0ffff', lightgoldenrodyellow: 'fafad2', lightgray: 'd3d3d3', lightgreen: '90ee90', lightgrey: 'd3d3d3', lightpink: 'ffb6c1', lightsalmon: 'ffa07a', lightseagreen: '20b2aa', lightskyblue: '87cefa', lightslategray: '778899', lightslategrey: '778899', lightsteelblue: 'b0c4de', lightyellow: 'ffffe0', lime: '00ff00', limegreen: '32cd32', linen: 'faf0e6', magenta: 'ff00ff', maroon: '800000', mediumaquamarine: '66cdaa', mediumblue: '0000cd', mediumorchid: 'ba55d3', mediumpurple: '9370db', mediumseagreen: '3cb371', mediumslateblue: '7b68ee', mediumspringgreen: '00fa9a', mediumturquoise: '48d1cc', mediumvioletred: 'c71585', midnightblue: '191970', mintcream: 'f5fffa', mistyrose: 'ffe4e1', moccasin: 'ffe4b5', navajowhite: 'ffdead', navy: '000080', oldlace: 'fdf5e6', olive: '808000', olivedrab: '6b8e23', orange: 'ffa500', orangered: 'ff4500', orchid: 'da70d6', palegoldenrod: 'eee8aa', palegreen: '98fb98', paleturquoise: 'afeeee', palevioletred: 'db7093', papayawhip: 'ffefd5', peachpuff: 'ffdab9', peru: 'cd853f', pink: 'ffc0cb', plum: 'dda0dd', powderblue: 'b0e0e6', purple: '800080', rebeccapurple: '663399', red: 'ff0000', rosybrown: 'bc8f8f', royalblue: '4169e1', saddlebrown: '8b4513', salmon: 'fa8072', sandybrown: 'f4a460', seagreen: '2e8b57', seashell: 'fff5ee', sienna: 'a0522d', silver: 'c0c0c0', skyblue: '87ceeb', slateblue: '6a5acd', slategray: '708090', slategrey: '708090', snow: 'fffafa', springgreen: '00ff7f', steelblue: '4682b4', tan: 'd2b48c', teal: '008080', thistle: 'd8bfd8', tomato: 'ff6347', turquoise: '40e0d0', violet: 'ee82ee', wheat: 'f5deb3', white: 'ffffff', whitesmoke: 'f5f5f5', yellow: 'ffff00', yellowgreen: '9acd32'
};
const ccClamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ccToLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const ccFromLin = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const ccMul = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const CC_RGB2XYZ = [[0.41239079926595934, 0.357584339383878, 0.1804807884018343], [0.21263900587151027, 0.715168678767756, 0.07219231536073371], [0.01933081871559182, 0.11919477979462598, 0.9505321522496607]];
const CC_XYZ2RGB = [[3.2409699419045226, -1.537383177570094, -0.4986107602930034], [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559], [0.05563007969699366, -0.20397695888897652, 1.0569715142428786]];
const CC_D65_D50 = [[1.0479298208405488, 0.022946793341019088, -0.05019222954313557], [0.029627815688159344, 0.990434484573249, -0.01707382502938514], [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008]];
const CC_D50_D65 = [[0.9554734527042182, -0.023098536874261423, 0.0632593086610217], [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008], [0.012314001688319899, -0.020507696433477912, 1.3303659366080753]];
const CC_D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const CC_EPS = 216 / 24389, CC_KAPPA = 24389 / 27;
function ccToLab(r, g, b) {   // sRGB 0-255 -> CSS lab() (D50)
  const xyz = ccMul(CC_D65_D50, ccMul(CC_RGB2XYZ, [ccToLin(r), ccToLin(g), ccToLin(b)]));
  const f = xyz.map((v, i) => { const t = v / CC_D50[i]; return t > CC_EPS ? Math.cbrt(t) : (CC_KAPPA * t + 16) / 116; });
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}
function ccFromLab(L, a, b) { // -> unclipped sRGB 0-255
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const xyz = [fx, fy, fz].map((f, i) => { const f3 = f * f * f; return (f3 > CC_EPS ? f3 : (116 * f - 16) / CC_KAPPA) * CC_D50[i]; });
  return ccMul(CC_XYZ2RGB, ccMul(CC_D50_D65, xyz)).map(ccFromLin);
}
const CC_M1 = [[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]];
const CC_M2 = [[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]];
const CC_M1I = [[4.0767416621, -3.3077115913, 0.2309699292], [-1.2684380046, 2.6097574011, -0.3413193965], [-0.0041960863, -0.7034186147, 1.7076147010]];
const CC_M2I = [[1, 0.3963377774, 0.2158037573], [1, -0.1055613458, -0.0638541728], [1, -0.0894841775, -1.2914855480]];
function ccToOklab(r, g, b) {
  const lms = ccMul(CC_M1, [ccToLin(r), ccToLin(g), ccToLin(b)]).map(Math.cbrt);
  return ccMul(CC_M2, lms);
}
function ccFromOklab(L, a, b) {
  const lms = ccMul(CC_M2I, [L, a, b]).map((v) => v * v * v);
  return ccMul(CC_M1I, lms).map(ccFromLin);
}
const ccLch = (L, a, b) => { const C = Math.hypot(a, b); let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360; return [L, C, C < 1e-4 ? 0 : h]; };
const ccLab = (C, h) => [C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)];
const ccIn = (rgb) => rgb.every((v) => v >= -0.0005 * 255 && v <= 255.0005);
const ccHex = (rgb) => '#' + rgb.map((v) => Math.round(ccClamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function ccHsl(r, g, b) { return rgbToHsl(Math.round(r), Math.round(g), Math.round(b)); }
function ccFromHsl(h, s, l) { // h degrees, s and l 0-1 -> 0-255
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const ccLum = (rgb) => 0.2126 * ccToLin(rgb[0]) + 0.7152 * ccToLin(rgb[1]) + 0.0722 * ccToLin(rgb[2]);
const ccRatio = (a, b) => { const l1 = ccLum(a), l2 = ccLum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

/* ---------- reading a colour in any CSS syntax ---------- */
function ccNum(tok, pctScale, name) {   // a number or a percentage
  const t = String(tok).trim();
  if (t === 'none') return 0;
  if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%$/i.test(t)) return parseFloat(t) / 100 * pctScale;
  if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return parseFloat(t);
  throw new Error('"' + t + '" is not a number or percentage (in ' + name + ')');
}
function ccAngle(tok) {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/i.exec(String(tok).trim());
  if (!m) { if (String(tok).trim() === 'none') return 0; throw new Error('"' + tok + '" is not an angle'); }
  const v = parseFloat(m[1]), u = (m[2] || 'deg').toLowerCase();
  return u === 'deg' ? v : u === 'grad' ? v * 0.9 : u === 'rad' ? v * 180 / Math.PI : v * 360;
}
function ccParse(str) {
  let s = String(str === undefined || str === null ? '' : str).trim();
  if (!s) throw new Error('Type a colour: a hex code, rgb(), hsl(), a name such as tomato, or oklch().');
  const low = s.toLowerCase();
  let m;
  if (low === 'transparent') return { rgb: [0, 0, 0], a: 0, kind: 'name', clipped: false };
  if (CC_NAMES[low]) { const h = CC_NAMES[low]; return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)), a: 1, kind: 'name', clipped: false, name: low }; }
  if ((m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(low))) {
    let h = m[1];
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return { rgb: rgb, a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1, kind: 'hex', clipped: false };
  }
  if ((m = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|cmyk|device-cmyk)\(\s*([^)]*)\)$/i.exec(s))) {
    const fn = m[1].toLowerCase();
    let body = m[2].trim(), alpha = 1;
    const sl = body.split('/');
    if (sl.length > 2) throw new Error('more than one / in ' + fn + '()');
    if (sl.length === 2) { alpha = ccClamp(ccNum(sl[1], 1, 'alpha'), 0, 1); body = sl[0].trim(); }
    let parts = body.split(/\s*,\s*|\s+/).filter(Boolean);
    if (sl.length === 1 && /^(rgba|hsla)$/.test(fn) && parts.length === 4 || sl.length === 1 && /^(rgb|hsl)$/.test(fn) && parts.length === 4) alpha = ccClamp(ccNum(parts.pop(), 1, 'alpha'), 0, 1);
    const need = (n) => { if (parts.length !== n) throw new Error(fn + '() needs ' + n + ' values' + (n === 3 ? ' (and an optional alpha)' : '') + ', this has ' + parts.length); };
    if (fn === 'rgb' || fn === 'rgba') { need(3); const rgb = parts.map((p) => ccClamp(ccNum(p, 255, fn), 0, 255)); return { rgb: rgb, a: alpha, kind: 'rgb', clipped: false }; }
    if (fn === 'hsl' || fn === 'hsla') { need(3); const rgb = ccFromHsl(ccAngle(parts[0]), ccClamp(ccNum(parts[1], 1, fn), 0, 1), ccClamp(ccNum(parts[2], 1, fn), 0, 1)); return { rgb: rgb, a: alpha, kind: 'hsl', clipped: false }; }
    if (fn === 'hwb') {
      need(3);
      const h = ccAngle(parts[0]); let w = ccClamp(ccNum(parts[1], 1, fn), 0, 1), bl = ccClamp(ccNum(parts[2], 1, fn), 0, 1);
      if (w + bl >= 1) { const g = w / (w + bl) * 255; return { rgb: [g, g, g], a: alpha, kind: 'hwb', clipped: false }; }
      const base = ccFromHsl(h, 1, 0.5).map((v) => v / 255 * (1 - w - bl) + w);
      return { rgb: base.map((v) => v * 255), a: alpha, kind: 'hwb', clipped: false };
    }
    if (fn === 'lab' || fn === 'lch' || fn === 'oklab' || fn === 'oklch') {
      need(3);
      const ok = fn.indexOf('ok') === 0;
      const L = ccClamp(ccNum(parts[0], ok ? 1 : 100, fn), 0, ok ? 1 : 100);
      let rgb;
      if (fn === 'lab' || fn === 'oklab') { const a = ccNum(parts[1], ok ? 0.4 : 125, fn), b = ccNum(parts[2], ok ? 0.4 : 125, fn); rgb = ok ? ccFromOklab(L, a, b) : ccFromLab(L, a, b); }
      else { const C = Math.max(0, ccNum(parts[1], ok ? 0.4 : 150, fn)), h = ccAngle(parts[2]); const ab = ccLab(C, h); rgb = ok ? ccFromOklab(L, ab[0], ab[1]) : ccFromLab(L, ab[0], ab[1]); }
      return { rgb: rgb.map((v) => ccClamp(v, 0, 255)), a: alpha, kind: fn, clipped: !ccIn(rgb) };
    }
    if (fn === 'color') {
      const space = (parts.shift() || '').toLowerCase();
      need(3);
      const v = parts.map((p) => ccNum(p, 1, 'color()'));
      if (space === 'srgb') return { rgb: v.map((x) => ccClamp(x * 255, 0, 255)), a: alpha, kind: 'color', clipped: v.some((x) => x < 0 || x > 1) };
      if (space === 'srgb-linear') { const rgb = v.map((x) => ccFromLin(x)); return { rgb: rgb.map((x) => ccClamp(x, 0, 255)), a: alpha, kind: 'color', clipped: !ccIn(rgb) }; }
      throw new Error('color(' + space + ' …) is not supported here; srgb and srgb-linear are');
    }
    if (fn === 'cmyk' || fn === 'device-cmyk') {
      need(4);
      const [c, mm, y, k] = parts.map((p) => ccClamp(ccNum(p, 1, fn), 0, 1));
      return { rgb: [255 * (1 - c) * (1 - k), 255 * (1 - mm) * (1 - k), 255 * (1 - y) * (1 - k)], a: alpha, kind: 'cmyk', clipped: false };
    }
  }
  if ((m = /^(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})$/.exec(s))) {
    const rgb = [m[1], m[2], m[3]].map(Number);
    if (rgb.some((v) => v > 255)) throw new Error('RGB values go from 0 to 255');
    return { rgb: rgb, a: 1, kind: 'rgb', clipped: false };
  }
  throw new Error('Could not read "' + s.slice(0, 40) + '" as a colour. Try #f7c948, rgb(247 201 72), hsl(45 92% 63%), oklch(85% 0.15 90) or a name such as tomato.');
}

/* ---------- colour-blindness (Machado, Oliveira and Fernandes 2009, full severity, in linear RGB) ---------- */
const CC_CVD = [
  ['Protanopia (no red cones)', [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]],
  ['Deuteranopia (no green cones)', [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]]],
  ['Tritanopia (no blue cones)', [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]]
];
function ccSimulate(rgb) {
  const lin = rgb.map(ccToLin);
  const out = CC_CVD.map((p) => ccMul(p[1], lin).map((v) => ccClamp(ccFromLin(ccClamp(v, 0, 1)), 0, 255)));
  const y = ccLum(rgb);
  out.push([0, 1, 2].map(() => ccFromLin(y)));   // achromatopsia: the luminance as a grey
  return out;
}

/* ---------- the nearest colour that passes: lightness moves in OKLCH, hue and chroma kept (chroma eased into gamut) ---------- */
function ccFix(fg, bg, target) {
  const lab = ccToOklab(fg[0], fg[1], fg[2]);
  const [L0, C0, H] = ccLch(lab[0], lab[1], lab[2]);
  const at = (L) => {
    let C = C0;
    for (let i = 0; i < 40; i++) {
      const ab = ccLab(C, H);
      const rgb = ccFromOklab(L, ab[0], ab[1]);
      if (ccIn(rgb)) return rgb.map((v) => ccClamp(Math.round(v), 0, 255));
      C *= 0.92;
    }
    return ccFromOklab(L, 0, 0).map((v) => ccClamp(Math.round(v), 0, 255));
  };
  const pass = (rgb) => ccRatio(rgb, bg) >= target;
  const side = (dir) => {   // dir -1 darker, +1 lighter: the smallest step in lightness that passes
    const end = dir < 0 ? 0 : 1;
    if (!pass(at(end))) return null;
    let lo = 0, hi = 1;     // fraction of the way from L0 to the end
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (pass(at(L0 + (end - L0) * mid))) hi = mid; else lo = mid; }
    return at(L0 + (end - L0) * hi);
  };
  if (pass(fg.map(Math.round))) return { same: true, rgb: fg.map(Math.round) };
  const a = side(-1), b = side(1);
  const d = (rgb) => { if (!rgb) return Infinity; const l = ccToOklab(rgb[0], rgb[1], rgb[2]); return Math.hypot(l[0] - lab[0], l[1] - lab[1], l[2] - lab[2]); };
  const best = d(a) <= d(b) ? a : b;
  return best ? { same: false, rgb: best } : null;
}

window.DEV_TOOLS["color-converter"] = {
"title": "Colour Converter & Contrast Checker",
"category": "developer",
"icon": "🎨",
"kind": "generate",
"filename": "colour.txt",
"download": {"ext": "txt", "type": "text/plain"},
"description": "Read any CSS colour, convert it to HEX, RGB, HSL, HWB, CMYK, Lab, LCH, OKLab and OKLCH, check WCAG contrast, fix a failing pair, and see tints, shades, harmonies and colour-blind views.",
"keywords": ["color converter","hex to rgb","rgb to hex","hsl converter","oklch converter","cmyk converter","lab color","contrast checker","wcag contrast","color blindness simulator","color harmony","tints and shades"],
"inputLabel": null,
"outputLabel": "Colour values",
"fields": [
  {"key":"colour","label":"Foreground colour (any CSS colour)","type":"text","default":"#f7c948"},
  {"key":"bg","label":"Background colour","type":"text","default":"#06080f"},
  {"key":"harmony","label":"Harmony","type":"select","default":"complementary","options":[{"value":"complementary","label":"Complementary"},{"value":"analogous","label":"Analogous"},{"value":"triadic","label":"Triadic"},{"value":"tetradic","label":"Tetradic (square)"},{"value":"split","label":"Split complementary"},{"value":"mono","label":"Monochromatic"}]}
],
"generate": (f) => {
      let fgc, bgc;
      try { fgc = ccParse(f.colour); } catch (e) { return { error: e.message }; }
      try { bgc = ccParse(f.bg); } catch (e) { return { error: 'Background: ' + e.message }; }
      const r8 = fgc.rgb.map((v) => Math.round(ccClamp(v, 0, 255)));
      const fg = { r: r8[0], g: r8[1], b: r8[2] };
      const bgr = bgc.rgb.map((v) => Math.round(ccClamp(v, 0, 255)));
      /* a see-through colour is blended onto the background before contrast is measured */
      const eff = fgc.a < 1 ? r8.map((v, i) => Math.round(v * fgc.a + bgr[i] * (1 - fgc.a))) : r8;
      const [h, s, l] = rgbToHsl(fg.r, fg.g, fg.b);
      const [bh, bs, bv] = rgbToHsb(fg.r, fg.g, fg.b);
      const ratio = ccRatio(eff, bgr);
      const grade = (r, large) => r >= (large ? 4.5 : 7) ? 'AAA' : r >= (large ? 3 : 4.5) ? 'AA' : 'Fail';
      const hex = ccHex(r8);
      const pct = (x) => Math.round(x * 100);
      const mx = Math.max(...r8) / 255, mn = Math.min(...r8) / 255;
      const k = 1 - mx;
      const cm = k >= 1 ? [0, 0, 0] : r8.map((v) => (1 - v / 255 - k) / (1 - k));
      const wh = mn, bl = 1 - mx;
      const lab = ccToLab(...fgc.rgb), lch = ccLch(...lab);
      const ok = ccToOklab(...fgc.rgb), okc = ccLch(...ok);
      const r1 = (x) => (Math.round(x * 10) / 10);
      const r2 = (x) => (Math.round(x * 100) / 100);
      const r4 = (x) => (Math.round(x * 10000) / 10000);
      const nearest = (() => {
        let best = null, bd = Infinity;
        Object.keys(CC_NAMES).forEach((n) => {
          const hx = CC_NAMES[n];
          const o = ccToOklab(parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16));
          const d = Math.hypot(o[0] - ok[0], o[1] - ok[1], o[2] - ok[2]);
          if (d < bd - 1e-9) { bd = d; best = n; }
        });
        return { name: best, d: bd };
      })();
      const alphaTxt = fgc.a < 1 ? String(Math.round(fgc.a * 1000) / 1000) : '1';
      const lines = [
        `HEX   ${hex.toUpperCase()}`
      ];
      if (fgc.a < 1) lines.push(`HEXA  ${hex.toUpperCase()}${Math.round(fgc.a * 255).toString(16).padStart(2, '0').toUpperCase()}`);
      lines.push(
        `RGB   rgb(${fg.r}, ${fg.g}, ${fg.b})`,
        `RGBA  rgba(${fg.r}, ${fg.g}, ${fg.b}, ${alphaTxt})`,
        `HSL   hsl(${h}, ${s}%, ${l}%)`,
        `HSB   hsb(${bh}, ${bs}%, ${bv}%)`,
        `HWB   hwb(${h} ${pct(wh)}% ${pct(bl)}%)`,
        `CMYK  cmyk(${pct(cm[0])}%, ${pct(cm[1])}%, ${pct(cm[2])}%, ${pct(k)}%)`,
        `LAB   lab(${r1(lab[0])}% ${r1(lab[1])} ${r1(lab[2])})`,
        `LCH   lch(${r1(lch[0])}% ${r1(lch[1])} ${r1(lch[2])})`,
        `OKLAB oklab(${r4(ok[0])} ${r4(ok[1])} ${r4(ok[2])})`,
        `OKLCH oklch(${r2(okc[0] * 100)}% ${r4(okc[1])} ${r2(okc[2])})`,
        `NAME  ${nearest.d < 1e-6 ? nearest.name : 'nearest ' + nearest.name + ' (' + hex.toLowerCase() + ' is not a CSS name)'}`,
        `CSS   color: ${hex.toLowerCase()};`
      );
      /* the nearest passing colours, when this pair does not already pass */
      const fixes = [];
      [['AA, body text', 4.5], ['AAA, body text', 7], ['AA, large text and interface parts', 3]].forEach((t) => {
        const r = ccFix(eff, bgr, t[1]);
        fixes.push({ label: t[0], target: t[1], rgb: r && r.rgb, same: r && r.same, ratio: r ? ccRatio(r.rgb, bgr) : 0 });
      });
      const fixLines = [];
      fixes.forEach((x) => {
        if (!x.rgb) fixLines.push(`To pass ${x.label} (${x.target}:1): no colour of this hue and chroma can, on this background`);
        else if (x.same) fixLines.push(`${x.label} (${x.target}:1): already passes`);
        else fixLines.push(`To pass ${x.label} (${x.target}:1): ${ccHex(x.rgb)} (${x.ratio.toFixed(2)}:1)`);
      });
      lines.push('', ...fixLines);
      const tints = [0.2, 0.4, 0.6, 0.8, 0.9].map((t) => ({ label: Math.round(t * 100) + '% white', hex: ccHex(r8.map((v) => v + (255 - v) * t)) }));
      const shades = [0.2, 0.4, 0.6, 0.8, 0.9].map((t) => ({ label: Math.round(t * 100) + '% black', hex: ccHex(r8.map((v) => v * (1 - t))) }));
      const rot = (d) => ccHex(ccFromHsl(h + d, s / 100, l / 100));
      const HARM = {
        complementary: [0, 180], analogous: [-30, 0, 30], triadic: [0, 120, 240], tetradic: [0, 90, 180, 270], split: [0, 150, 210]
      };
      const harmony = f.harmony === 'mono'
        ? [0.2, 0.35, 0.5, 0.65, 0.8].map((L) => ccHex(ccFromHsl(h, s / 100, L)))
        : (HARM[f.harmony] || HARM.complementary).map(rot);
      const sim = ccSimulate(r8).map((rgb, i) => ({ label: i < 3 ? CC_CVD[i][0] : 'Achromatopsia (no colour)', hex: ccHex(rgb) }));
      const warn = [];
      if (fgc.clipped) warn.push('That colour is outside the sRGB screen range, so it was moved to the nearest colour inside it.');
      if (ratio < 4.5) warn.push(`At ${ratio.toFixed(2)}:1 this fails WCAG AA for body text. It needs 4.5:1.`);
      return {
        output: lines.join('\n'),
        swatch: { fg: hex, bg: ccHex(bgr) },
        stats: [
          ['Contrast ratio', ratio.toFixed(2) + ':1'],
          ['Body text (AA needs 4.5)', grade(ratio, false) === 'Fail' ? 'Fail' : grade(ratio, false)],
          ['Large text (AA needs 3.0)', grade(ratio, true)],
          ['UI components (needs 3.0)', ratio >= 3 ? 'Pass' : 'Fail'],
          ['Relative luminance', ccLum(r8).toFixed(4)]
        ].concat(fgc.a < 1 ? [['Opacity', Math.round(fgc.a * 100) + '% (blended onto the background)']] : []),
        warn: warn.join(' '),
        sets: { tints: tints, shades: shades, harmony: harmony, sim: sim, hex: hex, bg: ccHex(bgr), fixes: fixes.filter((x) => x.rgb && !x.same).map((x) => ({ label: x.label, hex: ccHex(x.rgb), ratio: x.ratio })) }
      };
    },
"tips": ["WCAG AA needs 4.5:1 for body text and 3:1 for large text (18pt, or 14pt bold). AAA raises these to 7:1 and 4.5:1.","Contrast depends on relative luminance, not on how bright a colour looks. Saturated yellows and cyans score far lower than they appear.","The 3:1 threshold also applies to icons, form borders and focus rings — not only to text.","Type any CSS colour: #f7c948, #f7c94880, rgb(247 201 72 / 50%), hsl(45 92% 63%), hwb(), lab(), lch(), oklab(), oklch(), cmyk(), color(srgb …) or a name. A see-through colour is blended onto the background before its contrast is measured.","The fix keeps the hue and chroma and moves only the lightness in OKLCH, to the nearest colour that passes, darker or lighter.","Colour-blind views are an approximation of how the colour reads with one kind of cone missing; test anything important with real users.","Where your browser has an eyedropper (Chrome and Edge), Pick from the screen reads a colour anywhere on your screen."],
"faq": [{"q":"My brand colour fails. What now?","a":"Keep it for large headings, fills, borders and decoration, and use a darkened version of the same hue for body text. That preserves the brand while staying legible — exactly the approach used for the light theme of this site."},{"q":"Why do my Lab values differ from another tool's?","a":"CSS lab() and lch() use the D50 white point; many tools use D65. The values here are the ones a browser reads from lab() and lch()."}],
"mount": (ctx) => { ccMount(ctx); },
"render": function (res, ctx) { ccRender(res, ctx); }
};

function ccMount(ctx) {
  const el = ctx.el;
  const row = el('div', 'cc-tools');
  const mk = (key, label) => {
    const w = el('div', 'cc-pick');
    const inp = el('input'); inp.type = 'color'; inp.setAttribute('aria-label', 'Pick the ' + label + ' with a colour chooser'); inp.value = '#000000';
    inp.addEventListener('input', function () { ctx.setField(key, inp.value); ctx.run(); });
    w.appendChild(el('span', null, label + ':')); w.appendChild(inp);
    row.appendChild(w);
    return inp;
  };
  ctx.cc = { fgPick: mk('colour', 'Foreground'), bgPick: mk('bg', 'Background') };
  if (typeof window !== 'undefined' && window.EyeDropper) {
    const b = el('button', 'btn-ghost', 'Pick from the screen');
    b.type = 'button';
    b.addEventListener('click', function () {
      new window.EyeDropper().open().then(function (r) { ctx.setField('colour', r.sRGBHex); ctx.run(); }, function () { /* cancelled */ });
    });
    row.appendChild(b);
  }
  ctx.form.appendChild(row);
}

function ccSw(ctx, hex, label, textOn) {
  const b = ctx.el('button', 'cc-sw');
  b.type = 'button';
  b.style.background = hex;
  b.title = 'Copy ' + hex;
  b.setAttribute('aria-label', (label ? label + ' ' : '') + hex + ', click to copy');
  const t = ctx.el('span', 'cc-sw-hex', hex);
  t.style.color = ccRatio(ccParse(hex).rgb, [255, 255, 255]) >= 3 ? '#fff' : '#000';
  b.appendChild(t);
  b.addEventListener('click', function () { ctx.copyText(hex, b); });
  return b;
}
function ccRender(res, ctx) {
  const box = ctx.extra;
  box.textContent = '';
  try {
    const f = ctx.fields();
    const a = ccParse(f.colour), b = ccParse(f.bg);
    if (ctx.cc) { ctx.cc.fgPick.value = ccHex(a.rgb); ctx.cc.bgPick.value = ccHex(b.rgb); }
  } catch (e) { /* the message shows the problem */ }
  if (!res || res.error || !res.sets) return;
  const S = res.sets, el = ctx.el;
  const group = (title, items, note) => {
    const pane = el('div', 'io-pane cc-group');
    const head = el('div', 'io-head');
    head.appendChild(el('span', 'io-label', title));
    pane.appendChild(head);
    const row = el('div', 'cc-row');
    items.forEach(function (x) { const c = el('div', 'cc-cell'); c.appendChild(ccSw(ctx, x.hex, x.label)); if (x.label) c.appendChild(el('span', 'cc-cap', x.label)); row.appendChild(c); });
    pane.appendChild(row);
    if (note) pane.appendChild(el('p', 'cc-note', note));
    box.appendChild(pane);
  };
  if (S.fixes.length) {
    const pane = el('div', 'io-pane cc-group');
    const head = el('div', 'io-head');
    head.appendChild(el('span', 'io-label', 'Nearest colours that pass on this background'));
    pane.appendChild(head);
    const row = el('div', 'cc-row');
    S.fixes.forEach(function (x) {
      const c = el('div', 'cc-fix');
      const sample = el('div', 'cc-fix-sample', 'Sample text');
      sample.style.color = x.hex; sample.style.background = S.bg;
      c.appendChild(sample);
      c.appendChild(ccSw(ctx, x.hex, x.label));
      c.appendChild(el('span', 'cc-cap', x.label + ' · ' + x.ratio.toFixed(2) + ':1'));
      row.appendChild(c);
    });
    pane.appendChild(row);
    box.appendChild(pane);
  }
  group('Tints (mixed with white) and shades (mixed with black)', S.tints.slice().reverse().concat([{ hex: S.hex, label: 'this colour' }], S.shades), 'Mixed in sRGB, channel by channel.');
  group('Harmony', S.harmony.map(function (x) { return { hex: x, label: '' }; }), 'Hues turned round the HSL colour wheel from this colour.');
  group('How it looks with colour blindness', [{ hex: S.hex, label: 'Normal' }].concat(S.sim), 'Machado, Oliveira and Fernandes (2009), full severity. An approximation.');
}
/* the same colour maths for the Colour Contrast Checker page, which loads this file */
window.MVR_COLOUR = { parse: ccParse, ratio: ccRatio, lum: ccLum, fix: ccFix, hex: ccHex, simulate: ccSimulate, cvdNames: CC_CVD.map((x) => x[0]).concat(['Achromatopsia (no colour)']) };
})();
