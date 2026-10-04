'use strict';
/**
 * Small shared pieces of the kit visual system: escaping, the logo, inline
 * icons, the tool glyph from assets/icons.svg, the two-tone highlight split
 * and a tiny syntax colourer for the code-editor frame.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* The four-square mark, as in build/make-og.js. Gradient ids are per-instance
   so five slides in one document never share a broken reference. */
let logoN = 0;
function logo() {
  const n = 'lg' + (++logoN);
  return `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><defs>
  <linearGradient id="${n}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe29a"/><stop offset="100%" stop-color="#f7c948"/></linearGradient>
  <linearGradient id="${n}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f7c948"/><stop offset="100%" stop-color="#e8a020"/></linearGradient>
  <linearGradient id="${n}c" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#e8a020"/><stop offset="100%" stop-color="#ff9d2e"/></linearGradient>
  <linearGradient id="${n}d" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff9d2e"/><stop offset="100%" stop-color="#f7c948"/></linearGradient>
</defs>
  <rect x="74" y="74" width="170" height="170" rx="38" fill="url(#${n}a)"/>
  <rect x="268" y="74" width="170" height="170" rx="38" fill="url(#${n}b)"/>
  <rect x="74" y="268" width="170" height="170" rx="38" fill="url(#${n}c)"/>
  <rect x="268" y="268" width="170" height="170" rx="38" fill="url(#${n}d)"/>
  <circle cx="438" cy="74" r="17" fill="#2dd4ff"/>
  <circle cx="74" cy="438" r="17" fill="#7c5cff"/>
</svg>`;
}

/* Stroke icons (24-unit grid), drawn in currentColor. */
const I = {
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  arrowDown: '<path d="M12 4v15M6 13l6 6 6-6"/>',
  bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.6-6.5 4.6v-16a1 1 0 0 1 1-1z"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.9-3.8 3.7-5.6 7.2-5.6s6.3 1.8 7.2 5.6"/>',
  spark: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  lr: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  doc: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12.5h7M9 16h7"/>',
  table: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 10h17M3.5 14.5h17M10 5v14"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/>',
  film: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
  text: '<path d="M5 6h14M5 10h14M5 14h10M5 18h7"/>',
  wave: '<path d="M4 12h1.5M7.5 8v8M10.5 5v14M13.5 9v6M16.5 7v10M19.5 11v2"/>',
  chart: '<path d="M4 20h16M7 17v-5M11 17V8M15 17v-7M19 17V5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
  cc: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M10.5 10.3a2.2 2.2 0 1 0 0 3.4M16.5 10.3a2.2 2.2 0 1 0 0 3.4"/>',
};
function icon(name, cls) {
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || I.spark) + '</svg>';
}

let iconSrc = null;
/** The tool's own glyph from assets/icons.svg (falls back to the section glyph, then a grid). */
function glyph(id, fallback, cls) {
  if (!iconSrc) iconSrc = fs.readFileSync(path.join(ROOT, 'assets', 'icons.svg'), 'utf8');
  const find = (g) => {
    if (!g) return null;
    const re = new RegExp('<symbol id="' + String(g).replace(/[^a-z0-9-]/gi, '') + '"([^>]*)>([\\s\\S]*?)</symbol>');
    return iconSrc.match(re);
  };
  const m = find(id) || find(fallback) || find('i-grid');
  if (!m) return icon('spark', cls);
  const vb = (m[1].match(/viewBox="([^"]+)"/) || [, '0 0 24 24'])[1];
  return '<svg class="glyph' + (cls ? ' ' + cls : '') + '" viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + m[2] + '</svg>';
}

/**
 * Split a headline into { before, hl, after } for the two-tone treatment.
 * Order: an explicit phrase; the last sentence when there are two; the part
 * after a dash or colon; the last figure; else the last two words.
 */
function splitHighlight(text, phrase) {
  const t = String(text || '').trim();
  if (!t) return { before: '', hl: '', after: '' };
  if (phrase && t.includes(phrase)) {
    const i = t.lastIndexOf(phrase);
    return { before: t.slice(0, i), hl: phrase, after: t.slice(i + phrase.length) };
  }
  const sentences = t.match(/[^.?!]+[.?!]+["')\]]*|[^.?!]+$/g) || [t];
  if (sentences.length >= 2) {
    const last = sentences[sentences.length - 1];
    const i = t.lastIndexOf(last.trim());
    if (i > 0 && last.trim().length >= 3) return { before: t.slice(0, i), hl: last.trim().replace(/[.]$/, ''), after: /[.]$/.test(last.trim()) ? '.' : '' };
  }
  const dash = Math.max(t.lastIndexOf(' — '), t.lastIndexOf(' – '), t.lastIndexOf(': '));
  if (dash > 4 && t.length - dash > 4) {
    const sepLen = t[dash] === ':' ? 2 : 3;
    return { before: t.slice(0, dash + sepLen), hl: t.slice(dash + sepLen).replace(/[.!?]$/, ''), after: (t.match(/[.!?]$/) || [''])[0] };
  }
  const nums = [...t.matchAll(/[₹£$€]?\d[\d,.:]*\s?%?(?:\s+[A-Za-z]+)?/g)];
  if (nums.length) {
    const m = nums[nums.length - 1];
    const hl = m[0].replace(/[.,]$/, '').trim();
    const i = m.index;
    return { before: t.slice(0, i), hl, after: t.slice(i + hl.length) };
  }
  const words = t.replace(/[.!?]+$/, '').split(/\s+/);
  const end = (t.match(/[.!?]+$/) || [''])[0];
  const n = words.length > 3 ? 2 : 1;
  const hl = words.slice(-n).join(' ');
  return { before: words.slice(0, -n).join(' ') + (words.length > n ? ' ' : ''), hl, after: end };
}

/** The highlight as HTML: .hlw carries the Daylight marker, .hl the gradient ink. */
function hlHtml(text, phrase, cls) {
  const s = splitHighlight(text, phrase);
  return esc(s.before) + '<span class="hlw"><span class="hl' + (cls ? ' ' + cls : '') + '">' + esc(s.hl) + '</span></span>' + esc(s.after);
}

/* ---- syntax colouring for the editor frame ---- */
const KW = /^(const|let|var|function|return|if|else|for|while|class|import|from|export|def|async|await|new|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|ON|AND|OR|ORDER|BY|GROUP|AS|INTO|VALUES|CREATE|TABLE|true|false|null|undefined|None|True|False)$/;
function colourLine(line) {
  const out = [];
  const re = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*"?)|('(?:[^'\\]|\\.)*'?)|(\/\/.*$|#.*$|--.*$)|(-?\b\d[\d_.,]*(?:e[+-]?\d+)?\b)|(<\/?[A-Za-z][\w-]*|\/?>)|([A-Za-z_$][\w$]*)|([{}[\](),;:=<>+*\/.-])|(\s+)|(.)/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[1]) out.push('<span class="tk-k">' + esc(m[1].replace(/\s*:$/, '')) + '</span><span class="tk-p">' + esc(m[1].match(/\s*:$/)[0]) + '</span>');
    else if (m[2] || m[3]) out.push('<span class="tk-s">' + esc(m[2] || m[3]) + '</span>');
    else if (m[4]) out.push('<span class="tk-c">' + esc(m[4]) + '</span>');
    else if (m[5]) out.push('<span class="tk-n">' + esc(m[5]) + '</span>');
    else if (m[6]) out.push('<span class="tk-t">' + esc(m[6]) + '</span>');
    else if (m[7]) out.push(KW.test(m[7]) ? '<span class="' + (/^(true|false|null|undefined|None|True|False)$/.test(m[7]) ? 'tk-b' : 'tk-w') + '">' + esc(m[7]) + '</span>' : esc(m[7]));
    else if (m[8]) out.push('<span class="tk-p">' + esc(m[8]) + '</span>');
    else out.push(esc(m[0]));
  }
  return out.join('');
}
/** Code as gutter + coloured lines (CSS grid of two columns). plain = no colour. */
function codeHtml(src, opts) {
  opts = opts || {};
  const lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n');
  while (lines.length > 1 && !lines[lines.length - 1].trim()) lines.pop();
  return lines.map((l, i) => '<span class="ln">' + (i + 1) + '</span><span class="lc">' + (opts.plain ? esc(l) : colourLine(l)) + (l ? '' : ' ') + '</span>').join('');
}
/** Prose (word counts, rewritten text) reads better without colour. */
function looksLikeCode(s) {
  const t = String(s || '').trim();
  return /^[[{<]/.test(t) || /[;{}]\s*$/m.test(t) || /^\s*(const|let|var|function|def|SELECT|import)\b/m.test(t) || /=>|\b\w+\(\)/.test(t);
}

/** "1234tools.com/india/gst-calculator/" */
function cleanHost(p) { return '1234tools.com' + p; }

module.exports = { ROOT, esc, logo, icon, glyph, splitHighlight, hlHtml, codeHtml, colourLine, looksLikeCode, cleanHost };
