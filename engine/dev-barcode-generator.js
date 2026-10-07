(function () {
'use strict';
/* Barcode generator: EAN-13, EAN-8, UPC-A, ITF-14, Code 128 and Code 39,
   written from the symbology specifications (ISO/IEC 15420, 15417, 16388,
   16390 and the GS1 General Specifications). Own code: the encoder, the
   SVG and PDF writers and the PNG resolution chunk. One barcode per line;
   SVG, PNG, a ZIP of both, or a PDF sheet of labels at true size. */

window.DEV_TOOLS = window.DEV_TOOLS || {};

/* ---------------- tables ---------------- */
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_R = EAN_L.map((p) => p.replace(/./g, (c) => (c === '0' ? '1' : '0')));
const EAN_G = EAN_R.map((p) => p.split('').reverse().join(''));
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const C128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112').split(' ');
const C39_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
const C39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn'
};
const ITF = ['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn'];
const WIDE = 3;   /* wide:narrow 3:1, inside the 2:1–3:1 the Code 39 and ITF specifications allow */

/* ---------------- check digits ---------------- */
/** the GS1 check digit (EAN, UPC, ITF-14): weights 3 and 1 from the right */
function gs1Check(digits) {
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = 4 - w) sum += Number(digits[i]) * w;
  return String((10 - (sum % 10)) % 10);
}
function isbn10to13(s) {
  const core = '978' + s.slice(0, 9);
  return core + gs1Check(core);
}

/* ---------------- encoders: value → { bits, text, guards, quiet } ---------------- */
function cleanDigits(v) { return v.replace(/[\s-]/g, ''); }
function needDigits(v, sym, lens) {
  if (!/^\d+$/.test(v)) throw new Error(sym + ' takes digits only' + (/[a-z]/i.test(v) ? '; for letters choose Code 128' : ''));
  if (lens.indexOf(v.length) < 0) throw new Error(sym + ' needs ' + lens[0] + ' digits (the check digit is then added) or ' + lens[1] + ' with it; this has ' + v.length);
}
function withCheck(v, sym, full) {
  if (v.length === full) {
    const want = gs1Check(v.slice(0, -1));
    if (want !== v.slice(-1)) throw new Error('the check digit should be ' + want + ', not ' + v.slice(-1) + ' (' + v.slice(0, -1) + want + ')');
    return { digits: v, added: false };
  }
  return { digits: v + gs1Check(v), added: true };
}

function encEan13(raw, notes) {
  let v = cleanDigits(raw);
  if (/^\d{9}[\dXx]$/.test(v)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (10 - i) * (/[Xx]/.test(v[i]) ? 10 : Number(v[i]));
    if (sum % 11) throw new Error(raw + ' looks like an ISBN-10, but its check digit is wrong');
    const isbn = isbn10to13(v.toUpperCase());
    notes.push(raw + ' looks like an ISBN-10; encoded as the ISBN-13 ' + isbn);
    v = isbn;
  }
  needDigits(v, 'EAN-13', [12, 13]);
  const c = withCheck(v, 'EAN-13', 13);
  const d = c.digits;
  let bits = '101';
  const par = EAN_PARITY[Number(d[0])];
  for (let i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? EAN_L : EAN_G)[Number(d[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(d[i])];
  bits += '101';
  return { bits: bits, data: d, check: d[12], added: c.added, guards: [[0, 3], [45, 50], [92, 95]], quiet: [11, 7], ean: 'ean13',
    text: [{ x: -6, s: d[0], a: 'start' }, { x: 3 + 21, s: d.slice(1, 7), a: 'middle' }, { x: 50 + 21, s: d.slice(7), a: 'middle' }] };
}
function encEan8(raw) {
  const v = cleanDigits(raw);
  needDigits(v, 'EAN-8', [7, 8]);
  const c = withCheck(v, 'EAN-8', 8);
  const d = c.digits;
  let bits = '101';
  for (let i = 0; i < 4; i++) bits += EAN_L[Number(d[i])];
  bits += '01010';
  for (let i = 4; i < 8; i++) bits += EAN_R[Number(d[i])];
  bits += '101';
  return { bits: bits, data: d, check: d[7], added: c.added, guards: [[0, 3], [31, 36], [64, 67]], quiet: [7, 7], ean: 'ean8',
    text: [{ x: 3 + 14, s: d.slice(0, 4), a: 'middle' }, { x: 36 + 14, s: d.slice(4), a: 'middle' }] };
}
function encUpcA(raw) {
  const v = cleanDigits(raw);
  needDigits(v, 'UPC-A', [11, 12]);
  const c = withCheck(v, 'UPC-A', 12);
  const d = c.digits;
  const e = encEan13('0' + d, []);
  /* the first and last digit's bars are guard length in UPC-A */
  return { bits: e.bits, data: d, check: d[11], added: c.added, guards: [[0, 10], [45, 50], [85, 95]], quiet: [9, 9], ean: 'upca',
    text: [{ x: -2, s: d[0], a: 'end', small: true }, { x: 10 + 17.5, s: d.slice(1, 6), a: 'middle' }, { x: 50 + 17.5, s: d.slice(6, 11), a: 'middle' }, { x: 97, s: d[11], a: 'start', small: true }] };
}
function widths(pattern, narrow, wide) { return pattern.split('').map((c) => (c === 'w' ? wide : narrow)); }
function runsToBits(runs) { let b = ''; runs.forEach((w, i) => { b += (i % 2 ? '0' : '1').repeat(w); }); return b; }
function encItf14(raw) {
  const v = cleanDigits(raw);
  needDigits(v, 'ITF-14', [13, 14]);
  const c = withCheck(v, 'ITF-14', 14);
  const d = c.digits;
  let bits = '1010';
  for (let i = 0; i < 14; i += 2) {
    const a = widths(ITF[Number(d[i])], 1, WIDE), b = widths(ITF[Number(d[i + 1])], 1, WIDE);
    const runs = [];
    for (let k = 0; k < 5; k++) runs.push(a[k], b[k]);
    bits += runsToBits(runs);
  }
  bits += '1'.repeat(WIDE) + '01';
  return { bits: bits, data: d, check: d[13], added: c.added, guards: [], quiet: [10, 10], itf: true,
    text: [{ x: null, s: d.slice(0, 1) + ' ' + d.slice(1, 3) + ' ' + d.slice(3, 8) + ' ' + d.slice(8, 13) + ' ' + d.slice(13), a: 'middle' }] };
}
function encCode39(raw, o) {
  const v = raw;
  if (!v.length) throw new Error('empty');
  for (const ch of v) if (C39_CHARS.indexOf(ch) < 0) throw new Error('Code 39 has no "' + ch + '"' + (/[a-z]/.test(ch) ? ' (it has capital letters only; choose Code 128 for lower case)' : '') + '; it takes 0–9, A–Z, space and - . $ / + %');
  let data = v, check = '';
  if (o.c39check === 'yes') {
    let sum = 0;
    for (const ch of v) sum += C39_CHARS.indexOf(ch);
    check = C39_CHARS[sum % 43];
    data = v + check;
  }
  const runs = [];
  ('*' + data + '*').split('').forEach((ch, i, all) => {
    widths(C39[ch], 1, WIDE).forEach((w) => runs.push(w));
    if (i < all.length - 1) runs.push(1);   /* the gap between characters, one narrow space */
  });
  return { bits: runsToBits(runs), data: data, check: check, added: !!check, guards: [], quiet: [10, 10], text: [{ x: null, s: data === ' ' ? '' : data, a: 'middle' }] };
}

/** Code 128 values for a string: Start C for leading digit runs, A for control characters, B otherwise. */
function code128Values(s) {
  for (const ch of s) { const c = ch.codePointAt(0); if (c > 127) throw new Error('Code 128 here takes ASCII only; "' + ch + '" is not ASCII'); }
  const digitsAt = (i) => { let n = 0; while (i + n < s.length && /\d/.test(s[i + n])) n++; return n; };
  const needA = (ch) => ch.charCodeAt(0) < 32;
  const needB = (ch) => ch.charCodeAt(0) >= 96;
  const vals = [];
  let set;
  const lead = digitsAt(0);
  if (lead === s.length && lead >= 2 && lead % 2 === 0 || lead >= 4) { set = 'C'; vals.push(105); }
  else {
    let firstA = -1, firstB = -1;
    for (let i = 0; i < s.length; i++) { if (firstA < 0 && needA(s[i])) firstA = i; if (firstB < 0 && needB(s[i])) firstB = i; }
    set = firstA >= 0 && (firstB < 0 || firstA < firstB) ? 'A' : 'B';
    vals.push(set === 'A' ? 103 : 104);
  }
  let i = 0;
  while (i < s.length) {
    if (set === 'C') {
      if (digitsAt(i) >= 2) { vals.push(Number(s.substr(i, 2))); i += 2; continue; }
      set = needA(s[i]) ? 'A' : 'B';
      vals.push(set === 'A' ? 101 : 100);
      continue;
    }
    const run = digitsAt(i);
    const atEnd = i + run === s.length;
    if (run >= 4 && (atEnd || run >= 6)) {
      if (run % 2) { vals.push(s.charCodeAt(i) - 32); i++; }
      set = 'C'; vals.push(99); continue;
    }
    const ch = s[i], c = ch.charCodeAt(0);
    if (set === 'B' && needA(ch)) { set = 'A'; vals.push(101); continue; }
    if (set === 'A' && needB(ch)) { set = 'B'; vals.push(100); continue; }
    vals.push(set === 'A' ? (c < 32 ? c + 64 : c - 32) : c - 32);
    i++;
  }
  let sum = vals[0];
  for (let k = 1; k < vals.length; k++) sum += k * vals[k];
  const check = sum % 103;
  vals.push(check, 106);
  return vals;
}
function encCode128(raw) {
  if (!raw.length) throw new Error('empty');
  const vals = code128Values(raw);
  let bits = '';
  vals.forEach((v) => { bits += runsToBits(C128[v].split('').map(Number)); });
  const shown = raw.replace(/[\x00-\x1f\x7f]/g, '·');
  return { bits: bits, data: raw, values: vals, check: String(vals[vals.length - 2]), added: true, guards: [], quiet: [10, 10], text: [{ x: null, s: shown, a: 'middle' }] };
}

const SYMS = {
  ean13: { name: 'EAN-13', enc: encEan13, x: 0.33, h: 22.85 },
  upca: { name: 'UPC-A', enc: encUpcA, x: 0.33, h: 22.85 },
  ean8: { name: 'EAN-8', enc: encEan8, x: 0.33, h: 18.23 },
  itf14: { name: 'ITF-14', enc: encItf14, x: 0.635, h: 32 },
  code128: { name: 'Code 128', enc: encCode128, x: 0.33, h: 15 },
  code39: { name: 'Code 39', enc: encCode39, x: 0.33, h: 15 }
};

/* ---------------- layout in modules ---------------- */
function layout(code, o) {
  const X = Number(o.x) || SYMS[o.sym].x;
  const hMM = o.height === 'auto' ? SYMS[o.sym].h * X / (o.sym === 'itf14' ? 0.635 : 0.33) : Number(o.height);
  const barH = hMM / X;                                     /* in modules */
  const text = o.text !== 'no';
  const font = code.ean ? 8.2 : code.itf ? 11 : 7.5;        /* digit height in modules */
  const bearer = code.itf && o.bearer !== 'none' ? 2.4 : 0;  /* GS1: at least twice a narrow bar */
  const qL = code.quiet[0], qR = code.quiet[1];
  const w = qL + code.bits.length + qR + (bearer && o.bearer === 'frame' ? 2 * bearer : 0);
  const off = bearer && o.bearer === 'frame' ? bearer : 0;
  const guardExtra = code.ean ? 5 : 0;
  /* digits start one module under the bars (under the bottom bearer bar for ITF-14);
     EAN and UPC guard bars reach down beside them */
  const textTop = bearer * 2 + barH + 1;
  const h = text ? Math.max(textTop + font * 0.95, bearer * 2 + barH + guardExtra) : bearer * 2 + barH + guardExtra;
  const bars = [];
  let i = 0;
  const bits = code.bits;
  while (i < bits.length) {
    if (bits[i] === '1') {
      let j = i; while (j < bits.length && bits[j] === '1') j++;
      const guard = code.guards.some((g) => i >= g[0] && i < g[1]);
      bars.push({ x: off + qL + i, w: j - i, h: barH + (guard ? guardExtra : 0) });
      i = j;
    } else i++;
  }
  const labels = text ? code.text.map((t) => ({
    x: t.x === null ? off + qL + bits.length / 2 : off + qL + t.x,
    y: textTop,
    s: t.s, a: t.a, size: t.small ? font * 0.75 : font
  })) : [];
  return { X: X, w: w, h: h, bars: bars, top: bearer, labels: labels, bearer: bearer, frame: o.bearer === 'frame', mmW: w * X, mmH: h * X };
}

/* ---------------- writers ---------------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r3 = (n) => Math.round(n * 1000) / 1000;
function toSvg(L, o) {
  const fg = o.fg || '#000000', bg = o.bg || '#ffffff';
  const parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + r3(L.mmW) + 'mm" height="' + r3(L.mmH) + 'mm" viewBox="0 0 ' + r3(L.w) + ' ' + r3(L.h) + '" shape-rendering="crispEdges">'];
  if (o.bgTransparent !== 'yes') parts.push('<rect width="100%" height="100%" fill="' + esc(bg) + '"/>');
  parts.push('<g fill="' + esc(fg) + '">');
  if (L.bearer) {
    parts.push('<rect x="0" y="0" width="' + r3(L.w) + '" height="' + L.bearer + '"/>');
    parts.push('<rect x="0" y="' + r3(L.top + L.bars.reduce((m, b) => Math.max(m, b.h), 0)) + '" width="' + r3(L.w) + '" height="' + L.bearer + '"/>');
    if (L.frame) {
      const hh = L.top * 2 + L.bars.reduce((m, b) => Math.max(m, b.h), 0);
      parts.push('<rect x="0" y="0" width="' + L.bearer + '" height="' + r3(hh) + '"/>');
      parts.push('<rect x="' + r3(L.w - L.bearer) + '" y="0" width="' + L.bearer + '" height="' + r3(hh) + '"/>');
    }
  }
  L.bars.forEach((b) => parts.push('<rect x="' + b.x + '" y="' + L.top + '" width="' + b.w + '" height="' + r3(b.h) + '"/>'));
  L.labels.forEach((t) => parts.push('<text x="' + r3(t.x) + '" y="' + r3(t.y + t.size * 0.78) + '" font-family="OCR-B, \'OCR B\', Consolas, \'Courier New\', monospace" font-size="' + r3(t.size) + '" text-anchor="' + t.a + '"' + (t.s.length > 1 && t.a === 'middle' && t.x !== null ? '' : '') + '>' + esc(t.s) + '</text>'));
  parts.push('</g></svg>');
  return parts.join('');
}

/* PDF: a sheet of labels at true size, bars as filled rectangles, text in Helvetica */
function toPdf(items, o) {
  const mm = 72 / 25.4;
  const paper = o.paper === 'letter' ? [215.9, 279.4] : [210, 297];
  const margin = 10, gap = 4;
  const cellW = Math.max.apply(null, items.map((it) => it.L.mmW));
  const capH = 4;
  const cellH = Math.max.apply(null, items.map((it) => it.L.mmH)) + capH;
  const cols = Math.floor((paper[0] - 2 * margin + gap) / (cellW + gap));
  const rows = Math.floor((paper[1] - 2 * margin + gap) / (cellH + gap));
  if (cols < 1 || rows < 1) throw new Error('A barcode at this size (' + cellW.toFixed(1) + ' × ' + cellH.toFixed(1) + ' mm) does not fit on the page; choose a smaller bar width');
  const perPage = cols * rows;
  const pages = [];
  for (let p = 0; p * perPage < items.length; p++) pages.push(items.slice(p * perPage, (p + 1) * perPage));
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const v = m ? m[1] : '000000'; return [0, 2, 4].map((k) => (parseInt(v.substr(k, 2), 16) / 255).toFixed(3)).join(' '); };
  const pdfStr = (s) => '(' + String(s).replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?') + ')';
  const streams = pages.map((list) => {
    const ops = [];
    list.forEach((it, k) => {
      const col = k % cols, row = Math.floor(k / cols);
      const L = it.L, X = L.X;
      const ox = margin + col * (cellW + gap) + (cellW - L.mmW) / 2;
      const oy = paper[1] - margin - row * (cellH + gap) - L.mmH;   /* bottom of the barcode, mm from the bottom */
      const yOf = (yMod, hMod) => (oy + L.mmH - (yMod + hMod) * X) * mm;
      if (o.bgTransparent !== 'yes' && (o.bg || '#ffffff').toLowerCase() !== '#ffffff') ops.push(hex(o.bg) + ' rg ' + [ox * mm, oy * mm, L.mmW * mm, L.mmH * mm].map((n) => n.toFixed(3)).join(' ') + ' re f');
      ops.push(hex(o.fg) + ' rg');
      const rect = (x, y, w, h) => ops.push([(ox + x * X) * mm, yOf(y, h), w * X * mm, h * X * mm].map((n) => n.toFixed(3)).join(' ') + ' re');
      L.bars.forEach((b) => rect(b.x, L.top, b.w, b.h));
      if (L.bearer) {
        const bh = L.bars.reduce((m, b) => Math.max(m, b.h), 0);
        rect(0, 0, L.w, L.bearer); rect(0, L.top + bh, L.w, L.bearer);
        if (L.frame) { rect(0, 0, L.bearer, L.top * 2 + bh); rect(L.w - L.bearer, 0, L.bearer, L.top * 2 + bh); }
      }
      ops.push('f');
      L.labels.forEach((t) => {
        const size = t.size * X * mm;
        const width = t.s.length * size * 0.556;   /* Helvetica digits are 556/1000 em wide */
        const x = (ox + t.x * X) * mm - (t.a === 'middle' ? width / 2 : t.a === 'end' ? width : 0);
        const y = yOf(t.y + t.size * 0.78, 0);
        ops.push('BT /F1 ' + size.toFixed(2) + ' Tf ' + x.toFixed(3) + ' ' + y.toFixed(3) + ' Td ' + pdfStr(t.s) + ' Tj ET');
      });
      if (o.caption === 'yes') ops.push('0 0 0 rg BT /F1 7 Tf ' + ((ox) * mm).toFixed(3) + ' ' + ((oy - 3) * mm).toFixed(3) + ' Td ' + pdfStr(it.value) + ' Tj ET');
    });
    return ops.join('\n');
  });
  /* objects: 1 catalog, 2 pages, 3 font, then a page and a content stream per page */
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  const kids = [];
  streams.forEach((st, p) => {
    const pageNo = 4 + p * 2, contNo = pageNo + 1;
    kids.push(pageNo + ' 0 R');
    objs[pageNo] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + (paper[0] * mm).toFixed(2) + ' ' + (paper[1] * mm).toFixed(2) + '] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + contNo + ' 0 R >>';
    objs[contNo] = '<< /Length ' + st.length + ' >>\nstream\n' + st + '\nendstream';
  });
  objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offs = [];
  for (let k = 1; k < objs.length; k++) { offs[k] = out.length; out += k + ' 0 obj\n' + objs[k] + '\nendobj\n'; }
  const xref = out.length;
  out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (let k = 1; k < objs.length; k++) out += String(offs[k]).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  const bytes = new Uint8Array(out.length);
  for (let k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 255;
  return { bytes: bytes, pages: pages.length, perPage: perPage, cols: cols, rows: rows };
}

/* a pHYs chunk, so a PNG prints at its true size */
const CRC_T = (function () { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function pngWithDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const at = 8 + 25;   /* after the signature and IHDR */
  const out = new Uint8Array(png.length + 21);
  out.set(png.subarray(0, at)); out.set(chunk, at); out.set(png.subarray(at), at + 21);
  return out;
}

/* ---------------- the batch ---------------- */
function build(text, o) {
  const sym = SYMS[o.sym] ? o.sym : 'ean13';
  const items = [], bad = [], notes = [];
  String(text).split(/\r?\n/).forEach((line, n) => {
    const v = sym === 'code128' ? line.replace(/\r$/, '') : line.trim();
    if (!v.trim()) return;
    try {
      const code = SYMS[sym].enc(v, sym === 'code39' ? o : notes);
      const L = layout(code, Object.assign({}, o, { sym: sym }));
      const copies = Math.max(1, Math.min(500, Number(o.copies) || 1));
      for (let c = 0; c < copies; c++) items.push({ line: n + 1, value: v, code: code, L: L });
    } catch (e) { bad.push({ line: n + 1, value: v, why: e.message }); }
  });
  return { sym: sym, items: items, bad: bad, notes: notes };
}

window.DEV_TOOLS['barcode-generator'] = {
  title: 'Barcode Generator',
  category: 'developer',
  icon: '▥',
  kind: 'code',
  description: 'Make EAN-13, UPC-A, EAN-8, ITF-14, Code 128 and Code 39 barcodes, one or hundreds at once, checked digit by digit. Download SVG or PNG at a true print size, or a PDF sheet of labels.',
  keywords: ['barcode generator', 'ean 13 barcode generator', 'upc barcode generator', 'code 128 generator', 'code 39 barcode', 'itf 14', 'barcode labels pdf', 'bulk barcode generator'],
  inputLabel: 'Values, one barcode per line',
  outputLabel: 'SVG of the first barcode',
  placeholder: '5012345678900',
  sample: '501234567890\n4006381333931\n9781234567897',
  worker: false,
  highlight: 'xml',
  download: { ext: 'svg', type: 'image/svg+xml' },
  filename: function (o, res) { return res && res.name ? res.name + '.svg' : 'barcode.svg'; },
  options: [
    { key: 'sym', label: 'Barcode type', type: 'select', default: 'ean13', options: [{ value: 'ean13', label: 'EAN-13 (retail, worldwide)' }, { value: 'upca', label: 'UPC-A (retail, North America)' }, { value: 'ean8', label: 'EAN-8 (small packs)' }, { value: 'itf14', label: 'ITF-14 (outer cartons)' }, { value: 'code128', label: 'Code 128 (any text, ASCII)' }, { value: 'code39', label: 'Code 39 (A–Z, 0–9)' }] },
    { key: 'x', label: 'Bar width (X)', type: 'select', default: '0.33', options: [{ value: '0.264', label: '0.264 mm (EAN 80%)' }, { value: '0.33', label: '0.33 mm (EAN 100%)' }, { value: '0.4', label: '0.40 mm' }, { value: '0.495', label: '0.495 mm (ITF-14 smallest)' }, { value: '0.635', label: '0.635 mm' }, { value: '1.016', label: '1.016 mm (ITF-14 largest)' }, { value: '0.19', label: '0.19 mm (small labels)' }, { value: '0.25', label: '0.25 mm' }] },
    { key: 'height', label: 'Bar height', type: 'select', default: 'auto', options: [{ value: 'auto', label: 'Standard for the type' }, { value: '8', label: '8 mm' }, { value: '10', label: '10 mm' }, { value: '15', label: '15 mm' }, { value: '20', label: '20 mm' }, { value: '25', label: '25 mm' }, { value: '30', label: '30 mm' }] },
    { key: 'text', label: 'Digits under the bars', type: 'check', default: 'yes' },
    { key: 'c39check', label: 'Code 39: add a mod 43 check character', type: 'check', default: 'no' },
    { key: 'bearer', label: 'ITF-14 bearer bars', type: 'select', default: 'frame', options: [{ value: 'frame', label: 'Full frame' }, { value: 'bars', label: 'Top and bottom' }, { value: 'none', label: 'None' }] },
    { key: 'fg', label: 'Bar colour', type: 'color', default: '#000000' },
    { key: 'bg', label: 'Background', type: 'color', default: '#ffffff' },
    { key: 'dpi', label: 'PNG resolution', type: 'select', default: '300', options: [{ value: '150', label: '150 dpi' }, { value: '300', label: '300 dpi (print)' }, { value: '600', label: '600 dpi' }, { value: '96', label: '96 dpi (screen)' }] },
    { key: 'paper', label: 'PDF sheet', type: 'select', default: 'a4', options: [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }] },
    { key: 'copies', label: 'Copies of each on the sheet', type: 'number', default: 1, min: 1, max: 500 }
  ],
  transform: function (text, o) {
    const b = build(text, o);
    if (!b.items.length && !b.bad.length) return { output: '', note: 'Type a value, or paste a list with one value per line.' };
    const res = { items: b.items, bad: b.bad, sym: b.sym };
    const warns = b.bad.map((x) => 'Line ' + x.line + ' (' + x.value.slice(0, 30) + '): ' + x.why + '.');
    if (b.bad.length) res.errorAt = { line: b.bad[0].line, col: 1 };
    const lum = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return 0; return [0, 2, 4].map((k) => parseInt(m[1].substr(k, 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))).reduce((s, c, k) => s + c * [0.2126, 0.7152, 0.0722][k], 0); };
    if (lum(o.fg) > lum(o.bg)) warns.push('The bars are lighter than the background. Most scanners need dark bars on a light background.');
    else if (lum(o.bg) - lum(o.fg) < 0.45) warns.push('The bars and background are close in lightness; scanners may fail. Dark bars on white read best, and red bars are invisible to red-light scanners.');
    if (b.notes.length) warns.unshift(b.notes.join('. ') + '.');
    if (!b.items.length) return { error: warns.join(' '), errorAt: res.errorAt };
    const first = b.items[0];
    const svg = toSvg(first.L, o);
    res.output = svg;
    res.name = (b.sym + '-' + first.code.data).replace(/[^\w.-]+/g, '_').slice(0, 60);
    const unique = new Set(b.items.map((x) => x.value)).size;
    res.stats = [
      ['Type', SYMS[b.sym].name], ['Barcodes', String(unique) + (b.items.length > unique ? ' (' + b.items.length + ' with copies)' : '')], ['Not made', String(b.bad.length)],
      ['First encodes', first.code.data + (first.code.added && b.sym !== 'code128' ? ' (check ' + first.code.check + ' added)' : '')],
      ['Size', first.L.mmW.toFixed(1) + ' × ' + first.L.mmH.toFixed(1) + ' mm, quiet zones included'],
      ['Modules', String(first.code.bits.length) + ' wide, X = ' + first.L.X + ' mm']
    ];
    if (warns.length) res.warn = warns.join(' ');
    return res;
  },
  tips: [
    'Type 12 digits for EAN-13 (11 for UPC-A, 7 for EAN-8, 13 for ITF-14) and the check digit is worked out. Type the full number and it is checked: a wrong last digit is reported, never quietly fixed.',
    'Paste a list, one value per line, for a whole range at once: download every barcode as a ZIP of SVG and PNG files, or a PDF sheet of labels.',
    'Sizes are real: at 0.33 mm bar width an EAN-13 is 37.3 mm wide with its quiet zones, which is GS1’s 100% size. The SVG and PDF carry millimetres and the PNG a resolution, so they print at that size.',
    'Keep the light margins at each side (the quiet zones): a scanner needs them to find where the code starts.',
    'An ISBN-10 such as 0-306-40615-2 typed as EAN-13 becomes the ISBN-13 978-0-306-40615-7 barcode.',
    'For a link or a text a phone should open, a QR code is the better choice: see the QR Code Generator.'
  ],
  faq: [
    { q: 'Can I make up my own EAN or UPC numbers?', a: 'You can encode any number, but a product sold in shops needs a number from GS1, the body that issues company prefixes. A made-up EAN may already belong to someone else’s product.' },
    { q: 'Which type should I choose?', a: 'EAN-13 for retail products outside North America, UPC-A inside it, EAN-8 for very small packs, ITF-14 for cartons, Code 128 for warehouse labels, serial numbers and any text, and Code 39 where an older system asks for it.' },
    { q: 'Why does my Code 128 have a different pattern from another generator’s?', a: 'Code 128 can encode the same text in more than one way, switching between its three code sets. Every valid version scans to the same text; this tool picks the shortest common pattern, with digit pairs in code set C.' }
  ],
  mount: function (ctx) { bcMount(ctx); },
  render: function (res, ctx) { bcRender(res, ctx); }
};

/* ---------------- the page: previews and downloads ---------------- */
function bcName(it) { return (SYMS[it.sym || 'ean13'] ? '' : '') + String(it.code.data).replace(/[^\w.-]+/g, '_').slice(0, 60) || 'barcode'; }
function bcPng(it, o) {
  const dpi = Number(o.dpi) || 300;
  const px = Math.max(1, Math.round(it.L.X / 25.4 * dpi));
  const W = Math.round(it.L.w * px), H = Math.round(it.L.h * px);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (o.bgTransparent !== 'yes') { g.fillStyle = o.bg || '#fff'; g.fillRect(0, 0, W, H); }
  g.fillStyle = o.fg || '#000';
  const L = it.L;
  L.bars.forEach((b) => g.fillRect(Math.round(b.x * px), Math.round(L.top * px), b.w * px, Math.round(b.h * px)));
  if (L.bearer) {
    const bh = L.bars.reduce((m, b) => Math.max(m, b.h), 0);
    g.fillRect(0, 0, W, Math.round(L.bearer * px)); g.fillRect(0, Math.round((L.top + bh) * px), W, Math.round(L.bearer * px));
    if (L.frame) { g.fillRect(0, 0, Math.round(L.bearer * px), Math.round((L.top * 2 + bh) * px)); g.fillRect(W - Math.round(L.bearer * px), 0, Math.round(L.bearer * px), Math.round((L.top * 2 + bh) * px)); }
  }
  L.labels.forEach((t) => {
    g.font = Math.round(t.size * px) + 'px Consolas, "Courier New", monospace';
    g.textAlign = t.a === 'middle' ? 'center' : t.a === 'end' ? 'right' : 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(t.s, t.x * px, (t.y + t.size * 0.78) * px);
  });
  return new Promise((resolve, reject) => c.toBlob((b) => {
    if (!b) { reject(new Error('the browser could not make a PNG')); return; }
    b.arrayBuffer().then((buf) => resolve({ blob: new Blob([pngWithDpi(new Uint8Array(buf), dpi)], { type: 'image/png' }), px: px, W: W, H: H }), reject);
  }, 'image/png'));
}

function bcMount(ctx) {
  const el = ctx.el;
  const mk = (label, fn) => { const b = el('button', 'btn-ghost', label); b.type = 'button'; b.addEventListener('click', fn); ctx.outputTools.insertBefore(b, ctx.outputTools.lastChild); return b; };
  const busyRun = async (label, fn) => {
    const job = ctx.busy(label);
    try { await fn(job); } catch (e) { ctx.message('error', (e && e.message) || 'That did not work.'); } finally { job.done(); }
  };
  ctx.bc = {};
  ctx.bc.png = mk('PNG', () => busyRun('Drawing the PNG…', async () => {
    const r = ctx.result; if (!r || !r.items || !r.items.length) return;
    const p = await bcPng(r.items[0], ctx.opts());
    ctx.saveBlob(p.blob, bcName(r.items[0]) + '.png');
  }));
  ctx.bc.zip = mk('ZIP of all', () => busyRun('Making the ZIP…', async (job) => {
    const r = ctx.result; if (!r || !r.items || !r.items.length) return;
    const o = ctx.opts(), files = [], seen = new Set();
    const list = r.items.filter((it) => { if (seen.has(it.value)) return false; seen.add(it.value); return true; });
    for (let k = 0; k < list.length; k++) {
      job.update('Drawing ' + (k + 1) + ' of ' + list.length + '…');
      const it = list[k], name = String(k + 1).padStart(String(list.length).length, '0') + '-' + bcName(it);
      files.push({ name: name + '.svg', blob: new Blob([toSvg(it.L, o)], { type: 'image/svg+xml' }) });
      files.push({ name: name + '.png', blob: (await bcPng(it, o)).blob });
    }
    const zip = await window.MVRTool._zipStore(files);
    ctx.saveBlob(zip, 'barcodes-' + r.sym + '.zip');
  }));
  ctx.bc.pdf = mk('PDF sheet', () => busyRun('Laying out the sheet…', async () => {
    const r = ctx.result; if (!r || !r.items || !r.items.length) return;
    const pdf = toPdf(r.items, Object.assign({ caption: 'no' }, ctx.opts()));
    ctx.saveBlob(new Blob([pdf.bytes], { type: 'application/pdf' }), 'barcodes-' + r.sym + '.pdf');
    ctx.message('note', 'PDF: ' + r.items.length + ' barcode' + (r.items.length === 1 ? '' : 's') + ' on ' + pdf.pages + ' page' + (pdf.pages === 1 ? '' : 's') + ', ' + pdf.cols + ' × ' + pdf.rows + ' to a page. Print at 100% (actual size), not "fit to page".');
  }));
  /* only the options the chosen type uses; print settings folded away */
  const wrapOf = (k) => { const f = ctx.optBar.querySelector('#f-' + k) || ctx.optBar.querySelector('[data-name="' + k + '"]'); return f && f.closest('.field'); };
  const fold = el('details', 'bc-more-opts');
  fold.appendChild(el('summary', null, 'Colours, print and download settings'));
  const foldBody = el('div', 'bc-more-body');
  fold.appendChild(foldBody);
  ['fg', 'bg', 'dpi', 'paper', 'copies'].forEach((k) => { const w = wrapOf(k); if (w) foldBody.appendChild(w); });
  ctx.optBar.appendChild(fold);
  const showFor = () => {
    const sym = ctx.opts().sym;
    const c39 = wrapOf('c39check'), itf = wrapOf('bearer');
    if (c39) c39.hidden = sym !== 'code39';
    if (itf) itf.hidden = sym !== 'itf14';
  };
  ctx.optBar.addEventListener('change', showFor);
  showFor();
  ctx.bc_showFor = showFor;
  const gal = el('div', 'bc-gallery');
  gal.setAttribute('aria-label', 'Barcodes');
  ctx.outputPane.insertBefore(gal, ctx.output);
  ctx.bc.gallery = gal;
  ctx.output.classList.add('bc-svg-code');
}

function bcRender(res, ctx) {
  const gal = ctx.bc && ctx.bc.gallery;
  if (!gal) return;
  gal.textContent = '';
  const has = res && res.items && res.items.length;
  ['png', 'zip', 'pdf'].forEach((k) => { ctx.bc[k].disabled = !has; });
  if (!has) return;
  const o = ctx.opts();
  const seen = new Set();
  let shown = 0;
  for (const it of res.items) {
    if (seen.has(it.value)) continue;
    seen.add(it.value);
    if (++shown > 60) { gal.appendChild(ctx.el('p', 'bc-more', (res.items.length - 60) + ' more are in the ZIP and the PDF; the first 60 are shown here.')); break; }
    const fig = ctx.el('figure', 'bc-item');
    const img = ctx.el('img');
    img.alt = SYMS[res.sym].name + ' barcode for ' + it.code.data;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(toSvg(it.L, o));
    img.width = Math.round(it.L.w * 2);
    img.height = Math.round(it.L.h * 2);
    fig.appendChild(img);
    const cap = ctx.el('figcaption', null, 'Line ' + it.line + ': ' + it.code.data);
    const dl = ctx.el('button', 'btn-ghost bc-dl', 'SVG');
    dl.type = 'button';
    dl.setAttribute('aria-label', 'Download the SVG for ' + it.code.data);
    dl.addEventListener('click', () => ctx.saveBlob(new Blob([toSvg(it.L, ctx.opts())], { type: 'image/svg+xml' }), bcName(it) + '.svg'));
    cap.appendChild(dl);
    fig.appendChild(cap);
    gal.appendChild(fig);
  }
}

window.DEV_TOOLS['barcode-generator']._lib = { SYMS: SYMS, build: build, layout: layout, toSvg: toSvg, toPdf: toPdf, gs1Check: gs1Check, code128Values: code128Values, pngWithDpi: pngWithDpi, crc32: crc32 };
})();
