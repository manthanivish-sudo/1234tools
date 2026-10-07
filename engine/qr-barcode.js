/* ============================================================
   Linear barcodes, read from pixels: EAN-13, EAN-8, UPC-A, Code 128,
   Code 39 and ITF (interleaved 2 of 5).

   For the QR Code Scanner, in browsers that have no BarcodeDetector (or
   one that does not list these formats). Written from the symbologies'
   published tables (ISO/IEC 15420 for EAN/UPC, ISO/IEC 15417 for Code 128,
   ISO/IEC 16388 for Code 39, ISO/IEC 16390 for ITF), not from a library.

   How it reads: many straight scan lines are drawn across the picture,
   across and down, each is cut into dark and light runs at the points
   where it crosses a local threshold (interpolated, so a module two pixels
   wide still measures right), and the run widths are matched against the
   tables in both directions. EAN, UPC, Code 128 and ITF-14 carry a check
   digit, which every read must pass; Code 39 and other ITF lengths carry
   none, so they must be read the same on at least two lines.

   window.QRBarcode.scan(imageData) -> [{ format, text, lines, check }]
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------------- tables ---------------- */

  /* EAN/UPC digit widths, space-bar-space-bar for the L set (R has the
     same widths starting with a bar; G is L reversed). */
  const L_CODES = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112']
    .map((s) => s.split('').map(Number));
  const G_CODES = L_CODES.map((w) => w.slice().reverse());
  /* The first digit of an EAN-13 is the pattern of L and G in its left half. */
  const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

  /* Code 128: values 0-106, bar-space widths (106 is the stop, 7 elements). */
  const C128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
    '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 ' +
    '111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
    '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 ' +
    '141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 ' +
    '124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 ' +
    '311141 411131 211412 211214 211232 2331112').split(' ').map((s) => s.split('').map(Number));

  /* Code 39: which of the nine elements (bar, space, bar ...) are wide. */
  const C39 = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001', '5': '100110000',
    '6': '001110000', '7': '000100101', '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000', 'G': '000001101', 'H': '100001100',
    'I': '001001100', 'J': '000011100', 'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110', 'S': '001000110', 'T': '000010110',
    'U': '110000001', 'V': '011000001', 'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100', '$': '010101000', '/': '010100010',
    '+': '010001010', '%': '000101010'
  };
  const C39_BY = {};
  Object.keys(C39).forEach((k) => { C39_BY[C39[k]] = k; });

  /* ITF: which of a digit's five elements are wide. */
  const ITF = ['00110', '10001', '01001', '11000', '00101', '10100', '01100', '00011', '10010', '01010'];
  const ITF_BY = {};
  ITF.forEach((p, d) => { ITF_BY[p] = d; });

  /* ---------------- check digits ---------------- */

  /** GS1 mod 10: weights 3 and 1 from the right, the check digit excluded. */
  function gs1Check(digits) {
    let sum = 0;
    for (let i = digits.length - 1, w = 3; i >= 0; i--, w = 4 - w) sum += digits[i] * w;
    return (10 - sum % 10) % 10;
  }
  const gs1Ok = (s) => /^\d+$/.test(s) && gs1Check(s.slice(0, -1).split('').map(Number)) === Number(s.slice(-1));

  /* ---------------- scan lines ---------------- */

  function toGray(data, w, h) {
    const g = new Float32Array(w * h);
    for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
    return g;
  }

  /**
   * One line of grey levels as alternating runs, first run dark, with
   * fractional widths. The threshold is the middle of the darkest and
   * lightest values within a window either side, so a shadow across a
   * label does not merge its bars; flat stretches keep the last state.
   */
  function runsOf(line) {
    const n = line.length;
    if (n < 30) return null;
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = (line[Math.max(0, i - 1)] + 2 * line[i] + line[Math.min(n - 1, i + 1)]) / 4;
    const W = Math.max(20, Math.round(n / 14));
    const lo = new Float32Array(n), hi = new Float32Array(n);
    /* sliding min and max with monotonic queues */
    const qa = new Int32Array(n), qb = new Int32Array(n);
    let a0 = 0, a1 = 0, b0 = 0, b1 = 0;
    for (let i = 0; i < n + W; i++) {
      if (i < n) {
        while (a1 > a0 && s[qa[a1 - 1]] >= s[i]) a1--; qa[a1++] = i;
        while (b1 > b0 && s[qb[b1 - 1]] <= s[i]) b1--; qb[b1++] = i;
      }
      const c = i - W;
      if (c >= 0) {
        while (qa[a0] < c - W) a0++;
        while (qb[b0] < c - W) b0++;
        lo[c] = s[qa[a0]]; hi[c] = s[qb[b0]];
      }
    }
    const t = new Float32Array(n);
    const dark = new Uint8Array(n);
    let state = 0;
    for (let i = 0; i < n; i++) {
      if (hi[i] - lo[i] >= 28) { t[i] = (hi[i] + lo[i]) / 2; state = s[i] < t[i] ? 1 : 0; }
      else t[i] = i ? t[i - 1] : 128;
      dark[i] = state;
    }
    /* edges, placed where the smoothed line crosses its threshold */
    const edges = [];
    for (let i = 1; i < n; i++) {
      if (dark[i] !== dark[i - 1]) {
        const d0 = s[i - 1] - t[i - 1], d1 = s[i] - t[i];
        const f = d0 === d1 ? 0.5 : Math.max(0, Math.min(1, d0 / (d0 - d1)));
        edges.push({ x: i - 1 + f, dark: dark[i] });
      }
    }
    if (edges.length < 20) return null;
    const startDark = edges[0].dark === 1 ? 0 : 1;   // the first edge into dark
    const runs = [], pos = [];
    for (let k = startDark; k + 1 < edges.length; k++) {
      runs.push(edges[k + 1].x - edges[k].x);
      pos.push(edges[k].x);
    }
    /* the light before the first bar, for the quiet-zone checks */
    const lead = startDark < edges.length ? edges[startDark].x - (startDark ? edges[startDark - 1].x : 0) : 0;
    return { runs: runs, pos: pos, lead: lead, len: n };
  }

  /* ---------------- matching ---------------- */

  /** Distance between measured widths (scaled to `mods` modules) and a pattern. */
  function dist(runs, at, count, pattern, mods) {
    let sum = 0;
    for (let k = 0; k < count; k++) sum += runs[at + k];
    const u = sum / mods;
    let d = 0;
    for (let k = 0; k < count; k++) d += Math.abs(runs[at + k] / u - pattern[k]);
    return d;
  }

  function bestOf(runs, at, table, count, mods, limit) {
    let best = -1, bd = Infinity, second = Infinity;
    for (let v = 0; v < table.length; v++) {
      if (table[v].length !== count) continue;
      const d = dist(runs, at, count, table[v], mods);
      if (d < bd) { second = bd; bd = d; best = v; }
      else if (d < second) second = d;
    }
    if (bd > limit || second - bd < 0.25) return -1;
    return best;
  }

  /** Space before a symbol, at least `mods` modules of `unit` wide. */
  const quiet = (runs, at, lead, unit, mods) => (at === 0 ? lead : runs[at - 1]) >= unit * mods;

  /* EAN-13 / UPC-A: 59 runs, 95 modules */
  function ean13At(runs, at, lead) {
    if (at + 59 > runs.length) return null;
    let total = 0;
    for (let k = 0; k < 59; k++) total += runs[at + k];
    const u = total / 95;
    if (!quiet(runs, at, lead, u, 5)) return null;
    for (const g of [0, 1, 2, 27, 28, 29, 30, 31, 56, 57, 58]) {
      const r = runs[at + g] / u;
      if (r < 0.4 || r > 1.8) return null;
    }
    const digits = [];
    let parity = '';
    for (let d = 0; d < 6; d++) {
      const p = at + 3 + d * 4;
      const l = bestOf(runs, p, L_CODES, 4, 7, 1.5), g = bestOf(runs, p, G_CODES, 4, 7, 1.5);
      const dl = l >= 0 ? dist(runs, p, 4, L_CODES[l], 7) : Infinity, dg = g >= 0 ? dist(runs, p, 4, G_CODES[g], 7) : Infinity;
      if (dl === Infinity && dg === Infinity) return null;
      if (dl <= dg) { digits.push(l); parity += 'L'; } else { digits.push(g); parity += 'G'; }
    }
    for (let d = 0; d < 6; d++) {
      const r = bestOf(runs, at + 32 + d * 4, L_CODES, 4, 7, 1.5);
      if (r < 0) return null;
      digits.push(r);
    }
    const first = PARITY.indexOf(parity);
    if (first < 0) return null;
    const after = runs[at + 59];
    if (after !== undefined && after < u * 4) return null;
    const text = first + digits.join('');
    if (!gs1Ok(text)) return null;
    return first === 0 ? { format: 'upc_a', text: text.slice(1) } : { format: 'ean_13', text: text };
  }

  /* EAN-8: 43 runs, 67 modules */
  function ean8At(runs, at, lead) {
    if (at + 43 > runs.length) return null;
    let total = 0;
    for (let k = 0; k < 43; k++) total += runs[at + k];
    const u = total / 67;
    if (!quiet(runs, at, lead, u, 5)) return null;
    for (const g of [0, 1, 2, 19, 20, 21, 22, 23, 40, 41, 42]) {
      const r = runs[at + g] / u;
      if (r < 0.4 || r > 1.8) return null;
    }
    const digits = [];
    for (let d = 0; d < 4; d++) { const r = bestOf(runs, at + 3 + d * 4, L_CODES, 4, 7, 1.5); if (r < 0) return null; digits.push(r); }
    for (let d = 0; d < 4; d++) { const r = bestOf(runs, at + 24 + d * 4, L_CODES, 4, 7, 1.5); if (r < 0) return null; digits.push(r); }
    const after = runs[at + 43];
    if (after !== undefined && after < u * 4) return null;
    const text = digits.join('');
    return gs1Ok(text) ? { format: 'ean_8', text: text } : null;
  }

  /* Code 128: start, data, check, stop */
  function c128At(runs, at, lead) {
    if (at + 6 + 6 + 7 > runs.length) return null;
    const start = bestOf(runs, at, C128, 6, 11, 1.6);
    if (start < 103 || start > 105) return null;
    let unit = 0;
    for (let k = 0; k < 6; k++) unit += runs[at + k];
    unit /= 11;
    if (!quiet(runs, at, lead, unit, 5)) return null;
    const vals = [start];
    let p = at + 6;
    for (;;) {
      if (p + 7 <= runs.length && dist(runs, p, 7, C128[106], 13) < 1.8) {
        let stopW = 0; for (let k = 0; k < 7; k++) stopW += runs[p + k];
        if (stopW / 13 < unit * 0.6 || stopW / 13 > unit * 1.6) return null;
        break;
      }
      if (p + 6 > runs.length) return null;
      const v = bestOf(runs, p, C128, 6, 11, 1.6);
      if (v < 0 || v > 102) return null;
      vals.push(v);
      p += 6;
      if (vals.length > 80) return null;
    }
    if (vals.length < 3) return null;
    const check = vals.pop();
    let sum = vals[0];
    for (let i = 1; i < vals.length; i++) sum += vals[i] * i;
    if (sum % 103 !== check) return null;
    /* decode the code sets */
    let set = vals[0] === 103 ? 'A' : vals[0] === 104 ? 'B' : 'C';
    let out = '', gs1 = false, shift = false;
    for (let i = 1; i < vals.length; i++) {
      const v = vals[i];
      const cur = shift ? (set === 'A' ? 'B' : 'A') : set;
      shift = false;
      if (cur === 'C') {
        if (v < 100) out += String(v).padStart(2, '0');
        else if (v === 100) set = 'B';
        else if (v === 101) set = 'A';
        else if (v === 102) { if (i === 1) gs1 = true; else out += '\u001d'; }
        continue;
      }
      if (v < 96) {
        out += cur === 'A' ? String.fromCharCode(v < 64 ? v + 32 : v - 64) : String.fromCharCode(v + 32);
      } else if (v === 98) shift = true;
      else if (v === 99) set = 'C';
      else if (v === 100) { if (cur === 'A') set = 'B'; }     // in B it is FNC4, not supported: ignored
      else if (v === 101) { if (cur === 'B') set = 'A'; }
      else if (v === 102) { if (i === 1) gs1 = true; else out += '\u001d'; }
    }
    return { format: 'code_128', text: out, gs1: gs1 };
  }

  /** Narrow and wide from widths: split at the biggest gap between sorted widths. */
  function narrowWide(ws) {
    const s = ws.slice().sort((a, b) => a - b);
    let gap = 0, at = -1;
    for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > gap) { gap = s[i] - s[i - 1]; at = i; }
    if (at < 1) return null;
    const n = s.slice(0, at), w = s.slice(at);
    const nm = n.reduce((a, b) => a + b, 0) / n.length, wm = w.reduce((a, b) => a + b, 0) / w.length;
    if (wm / nm < 1.8 || wm / nm > 3.8) return null;
    return { cut: (s[at - 1] + s[at]) / 2, narrow: nm };
  }

  /* Code 39: '*' data '*', nine elements a character, a narrow gap between */
  function c39At(runs, at, lead) {
    if (at + 9 * 3 > runs.length) return null;
    const first = runs.slice(at, at + 9);
    const nw = narrowWide(first);
    if (!nw) return null;
    const pat = (k) => runs.slice(k, k + 9).map((r) => (r > nw.cut ? '1' : '0')).join('');
    if (C39_BY[pat(at)] !== '*') return null;
    if (!quiet(runs, at, lead, nw.narrow, 8)) return null;
    let p = at + 10, out = '';
    for (;;) {
      if (p + 9 > runs.length) return null;
      const ch = C39_BY[pat(p)];
      if (ch === undefined) return null;
      if (ch === '*') break;
      out += ch;
      p += 10;
      if (out.length > 60) return null;
    }
    if (!out) return null;
    const after = runs[p + 9];
    if (after !== undefined && after < nw.narrow * 6) return null;
    return { format: 'code_39', text: out };
  }

  /* ITF: start nnnn, digit pairs (bars carry one, spaces the other), end wnn */
  function itfAt(runs, at, lead) {
    if (at + 4 + 10 + 3 > runs.length) return null;
    /* the end pattern decides how long the symbol is; look for it */
    const start = runs.slice(at, at + 4);
    const sm = start.reduce((a, b) => a + b, 0) / 4;
    if (start.some((r) => r > sm * 1.6 || r < sm * 0.5)) return null;
    if (!quiet(runs, at, lead, sm, 8)) return null;
    let p = at + 4, digits = '';
    for (;;) {
      if (p + 3 <= runs.length && runs[p] > sm * 1.8 && runs[p + 1] < sm * 1.6 && runs[p + 2] < sm * 1.6 &&
          (runs[p + 3] === undefined || runs[p + 3] > sm * 6)) break;
      if (p + 10 > runs.length) return null;
      const chunk = runs.slice(p, p + 10);
      const nw = narrowWide(chunk);
      if (!nw) return null;
      const bars = [0, 2, 4, 6, 8].map((k) => (chunk[k] > nw.cut ? '1' : '0')).join('');
      const spaces = [1, 3, 5, 7, 9].map((k) => (chunk[k] > nw.cut ? '1' : '0')).join('');
      if (ITF_BY[bars] === undefined || ITF_BY[spaces] === undefined) return null;
      digits += ITF_BY[bars] + '' + ITF_BY[spaces];
      p += 10;
      if (digits.length > 40) return null;
    }
    if (digits.length < 6) return null;
    if (digits.length === 14 && !gs1Ok(digits)) return null;
    return { format: 'itf', text: digits, check: digits.length === 14 };
  }

  /* ---------------- whole pictures ---------------- */

  const DECODERS = [ean13At, ean8At, c128At, c39At, itfAt];
  /* formats with no check digit of their own need two lines that agree */
  const NEEDS_TWO = { code_39: true, itf: true };

  function readRuns(r, found, key) {
    if (!r) return;
    const tryAll = function (runs, lead) {
      for (let i = 0; i < runs.length - 20; i += 2) {      // a symbol starts on a dark run
        for (const dec of DECODERS) {
          const got = dec(runs, i, lead);
          if (got) {
            if (got.format === 'itf' && !got.check && got.text.length % 2) continue;
            const k = got.format + '\u0000' + got.text;
            const f = found[k] || (found[k] = { format: got.format, text: got.text, lines: {}, hits: 0, gs1: !!got.gs1 });
            if (!f.lines[key]) { f.lines[key] = 1; f.hits++; }
            break;
          }
        }
      }
    };
    tryAll(r.runs, r.lead);
    /* the other way along the line: reverse the runs, keeping a dark first */
    const rev = r.runs.slice().reverse();
    const lastDark = rev.length % 2 === 1;                  // runs alternate dark/light from index 0
    tryAll(lastDark ? rev : rev.slice(1), lastDark ? Math.max(0, r.len - (r.pos[r.pos.length - 1] + r.runs[r.runs.length - 1])) : rev[0]);
  }

  /**
   * Every linear barcode in a picture. `lines` scan lines are drawn each way;
   * a code is reported once, with how many lines read it.
   */
  function scan(image, opts) {
    const o = opts || {};
    const w = image.width, h = image.height;
    if (!w || !h) return [];
    const g = toGray(image.data, w, h);
    const n = o.lines || 36;
    const found = {};
    const line = new Float32Array(Math.max(w, h));
    for (let k = 1; k <= n; k++) {
      const y = Math.min(h - 1, Math.round(h * k / (n + 1)));
      for (let x = 0; x < w; x++) line[x] = g[y * w + x];
      readRuns(runsOf(line.subarray(0, w)), found, 'h' + y);
      if (o.across === false) continue;
      const x = Math.min(w - 1, Math.round(w * k / (n + 1)));
      for (let yy = 0; yy < h; yy++) line[yy] = g[yy * w + x];
      readRuns(runsOf(line.subarray(0, h)), found, 'v' + x);
    }
    return Object.keys(found).map((k) => found[k])
      .filter((f) => !NEEDS_TWO[f.format] || f.hits >= 2)
      .sort((a, b) => b.hits - a.hits)
      .map((f) => ({ format: f.format, text: f.text, lines: f.hits, gs1: f.gs1 }));
  }

  const NAMES = {
    ean_13: 'EAN-13', ean_8: 'EAN-8', upc_a: 'UPC-A', upc_e: 'UPC-E', code_128: 'Code 128', code_39: 'Code 39',
    code_93: 'Code 93', codabar: 'Codabar', itf: 'ITF', data_matrix: 'Data Matrix', pdf417: 'PDF417',
    aztec: 'Aztec', qr_code: 'QR code'
  };

  root.QRBarcode = {
    scan: scan,
    formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'code_39', 'itf'],
    names: NAMES,
    gs1Check: gs1Check,
    _tables: { L: L_CODES, C128: C128, C39: C39, ITF: ITF }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.QRBarcode;
})(typeof window !== 'undefined' ? window : globalThis);
