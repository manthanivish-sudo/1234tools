#!/usr/bin/env node
/**
 * The three QR tools after wave 4 (October 2026), proved in Node and in
 * headless Chrome against a static server of the site:
 *
 *   node build/tests/qr-fixes.js [--root <site>] [--port 8948] [--out <dir>] [--node-only] [--only n,m]
 *
 * --root defaults to the site this file sits in, served on --port by
 * build/tests/serve.js (ports 8946-8952 are this test's). --out defaults to a
 * folder in the OS temp dir; screenshots go there. --only runs those
 * numbered sections. Exit code 2 when a case fails, 1 when the run breaks.
 *
 * Nothing is checked against the engine's own output. The references:
 *   - PDFs: an xref/object walk written here, zlib from Node, and pdf.js
 *     (the copy the site vendors, a separate implementation) rendering the
 *     page, then the code decoded from those pixels;
 *   - EPS: a small PostScript interpreter written here (paths, colours,
 *     clips, images; shadings filled flat), drawn on a canvas and decoded;
 *   - PNG: the chunks walked here, CRCs by zlib.crc32, pHYs read as bytes;
 *   - ZIP: listed by the system's own `tar -tf` (bsdtar);
 *   - barcodes: drawn here from the symbologies' published tables, typed
 *     out again in this file, with check digits computed here;
 *   - the QR codes read by QRDetect from pixels Chrome or pdf.js drew.
 *
 * Sections:
 *   1  Node: the engines load in a vm with a stub window; render-qr.js
 *      registers its three mounts; the worker loads with a stub importScripts
 *   2  Node: SVG path data to PDF curves — arcs land on the circle
 *   3  Node: a vector PDF of each module shape: xref offsets, objects,
 *      Flate streams, page size; no raster image without a logo
 *   4  Node: PNG resolution (pHYs) on a PNG made here
 *   5  Node: linear barcodes drawn from the standards' tables (EAN-13, EAN-8,
 *      UPC-A, Code 128 sets A/B/C, Code 39, ITF-14), turned and reversed,
 *      blurred; wrong check digits refused; no false reads on QR art or noise
 *   6  Node: several QR codes in one picture (QRDetect.scanAll)
 *   7  Node: label grids fit their paper, bad grids are refused, and the
 *      page's copy of the presets matches qr-export.js's
 *   8  Generator: new content types build the strings their apps expect
 *   9  Generator: every frame style, read back; a logo too big says so
 *   10 Generator: PDF rendered by pdf.js decodes; EPS through the
 *      interpreter decodes; the logo in the EPS is flattened; PNG pHYs
 *   11 Generator: All formats (ZIP) listed by tar; names from blob types
 *   12 Generator: settings remembered, a shared link wins, designs kept
 *      without content, Clear designs and Reset
 *   13 Bulk: label sheet PDF via pdf.js, every cell decoded in order;
 *      type, colour and caption columns; the column editor; a bad grid
 *   14 Bulk: 2,000 codes with a progress bar and no long task over 100 ms;
 *      Cancel stops a run and shuts the downloads
 *   15 Scanner: barcodes and QR codes in one picture; a batch with a CSV
 *      and per-file reasons; the history on the device; screen share
 *   17 Bulk: a frame and label round every code, a frame text column per
 *      row, read back, on the label sheet, remembered; No frame wins
 *   16 All three pages at 390 and 1400 px, both themes: no sideways
 *      scroll, every control reachable by Tab, no script errors
 *   and, through all of it, not one request to anything but 127.0.0.1.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const PORT = Number(arg('--port', 8948));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-qr-fixes')));
const NODE_ONLY = argv.includes('--node-only');
const ONLY = arg('--only', '') ? arg('--only', '').split(',').map(Number) : null;
const BASE_URL = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0, skipped = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (!ok && detail !== undefined ? '   (' + String(detail).slice(0, 600) + ')' : (ok && detail !== undefined && process.env.VERBOSE ? '   [' + detail + ']' : '')));
}
function skip(what) { skipped++; console.log('SKIP  ' + what); }
const want = (n) => !ONLY || ONLY.indexOf(n) >= 0;
const section = (t) => console.log('\n--- ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- engines in Node ---------- */

function context(extra) {
  const sb = Object.assign({ console, TextEncoder, TextDecoder, URL, URLSearchParams, setTimeout, clearTimeout, CompressionStream: globalThis.CompressionStream }, extra || {});
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  return vm.createContext(sb);
}
function load(ctx, rel) { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel }); return ctx; }
const engines = () => { const c = context(); ['engine/qr.bundle.js', 'engine/qr-detect.js', 'engine/qr-barcode.js', 'engine/qr-export.js'].forEach((f) => load(c, f)); return c; };

/* A raster of a QR matrix: dark 0, light 255, `px` pixels a module. */
function raster(matrix, px, quiet) {
  const n = matrix.length, w = (n + quiet * 2) * px;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (matrix[y][x]) {
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) { const p = (((y + quiet) * px + dy) * w + (x + quiet) * px + dx) * 4; data[p] = data[p + 1] = data[p + 2] = 0; }
  }
  return { width: w, height: w, data };
}

/* ---------- a PDF walked here ---------- */

function pdfWalk(buf) {
  const s = buf.toString('latin1');
  const out = { errors: [], objects: {}, streams: {} };
  if (!/^%PDF-1\.\d/.test(s)) out.errors.push('no %PDF header');
  const sx = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(s);
  if (!sx) { out.errors.push('no startxref'); return out; }
  const xref = Number(sx[1]);
  if (s.slice(xref, xref + 4) !== 'xref') { out.errors.push('startxref does not point at xref'); return out; }
  const head = /^xref\s+0 (\d+)\s+/.exec(s.slice(xref));
  const count = Number(head[1]);
  let at = xref + head[0].length;
  for (let i = 0; i < count; i++) {
    const line = s.slice(at, at + 20);
    at += 20;
    if (i === 0) continue;
    const off = Number(line.slice(0, 10));
    const m = new RegExp('^' + i + ' 0 obj\\s').exec(s.slice(off, off + 20));
    if (!m) { out.errors.push('object ' + i + ' is not at its xref offset ' + off); continue; }
    const end = s.indexOf('endobj', off);
    const body = s.slice(off + m[0].length, end);
    out.objects[i] = body;
    const st = /stream\n/.exec(body);
    if (st) {
      const len = Number((/\/Length (\d+)/.exec(body) || [])[1]);
      const from = off + m[0].length + st.index + st[0].length;
      let data = buf.slice(from, from + len);
      if (s.slice(from + len, from + len + 10).indexOf('endstream') < 0) out.errors.push('object ' + i + ' /Length does not end at endstream');
      if (/\/FlateDecode/.test(body)) { try { data = zlib.inflateSync(data); } catch (e) { out.errors.push('object ' + i + ' does not inflate'); } }
      out.streams[i] = data;
    }
  }
  const trailer = /trailer\s*<<([\s\S]*?)>>/.exec(s.slice(xref));
  out.root = trailer && Number((/\/Root (\d+) 0 R/.exec(trailer[1]) || [])[1]);
  out.pages = Object.keys(out.objects).filter((k) => /\/Type \/Page\b/.test(out.objects[k])).map(Number);
  return out;
}

/* ---------- a PNG made here ---------- */

function pngOf(w, h, rgbAt) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) { const c = rgbAt(x, y); raw.set(c, y * (w * 3 + 1) + 1 + x * 3); }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function pngChunks(buf) {
  const out = [];
  let at = 8;
  while (at + 8 <= buf.length) {
    const len = buf.readUInt32BE(at), type = buf.toString('latin1', at + 4, at + 8);
    const data = buf.slice(at + 8, at + 8 + len);
    const crcOk = (zlib.crc32(buf.slice(at + 4, at + 8 + len)) >>> 0) === buf.readUInt32BE(at + 8 + len);
    out.push({ type, data, crcOk });
    at += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}
const physOf = (buf) => { const c = pngChunks(buf).find((x) => x.type === 'pHYs'); return c ? { x: c.data.readUInt32BE(0), y: c.data.readUInt32BE(4), unit: c.data[8] } : null; };

/* ---------- barcodes, from the standards' tables (typed here) ---------- */

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = EAN_L.map((c) => c.split('').map((b) => (b === '1' ? '0' : '1')).reverse().join(''));
const EAN_R = EAN_L.map((c) => c.split('').map((b) => (b === '1' ? '0' : '1')).join(''));
const EAN_PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
/** GS1 check digit: weights 3,1,3… from the right of the data digits. */
function gs1(data) { let s = 0; data.split('').reverse().forEach((d, i) => { s += Number(d) * (i % 2 === 0 ? 3 : 1); }); return String((10 - s % 10) % 10); }
function ean13Bits(d12) {
  const d = (d12 + gs1(d12)).split('').map(Number);
  let b = '101';
  for (let i = 1; i <= 6; i++) b += (EAN_PAR[d[0]][i - 1] === 'L' ? EAN_L : EAN_G)[d[i]];
  b += '01010';
  for (let i = 7; i <= 12; i++) b += EAN_R[d[i]];
  return b + '101';
}
function ean8Bits(d7) {
  const d = (d7 + gs1(d7)).split('').map(Number);
  let b = '101';
  for (let i = 0; i < 4; i++) b += EAN_L[d[i]];
  b += '01010';
  for (let i = 4; i < 8; i++) b += EAN_R[d[i]];
  return b + '101';
}
/* Code 128 bar/space widths, ISO/IEC 15417 table 1 (values 0-106) */
const C128W = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112').split(' ');
const widthsToBits = (w) => w.split('').map((n, i) => (i % 2 === 0 ? '1' : '0').repeat(Number(n))).join('');
function c128Bits(values) {
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  return values.concat([sum % 103, 106]).map((v) => widthsToBits(C128W[v])).join('');
}
/* Code 128 set B for printable ASCII, set C for digit pairs */
const c128B = (t) => [104].concat(t.split('').map((ch) => ch.charCodeAt(0) - 32));
const c128C = (digits) => [105].concat(digits.match(/../g).map(Number));
/* Code 39, ISO/IEC 16388: bars and spaces, wide = 1 */
const C39T = { '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn' };
function c39Bits(t) {
  return ('*' + t + '*').split('').map((ch) => C39T[ch].split('').map((e, i) => (i % 2 === 0 ? '1' : '0').repeat(e === 'w' ? 3 : 1)).join('')).join('0');
}
/* ITF, ISO/IEC 16390: five elements a digit, two wide */
const ITFT = ['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn'];
function itfBits(digits) {
  let b = '1010';
  for (let i = 0; i < digits.length; i += 2) {
    const a = ITFT[digits[i]], c = ITFT[digits[i + 1]];
    for (let k = 0; k < 5; k++) b += '1'.repeat(a[k] === 'w' ? 3 : 1) + '0'.repeat(c[k] === 'w' ? 3 : 1);
  }
  return b + '11101';
}
/** A barcode picture: `mod` pixels a module, a quiet zone, optionally turned and blurred. */
function barImage(bits, mod, opts) {
  const o = opts || {};
  const q = o.quiet || 12, bw = (bits.length + 2 * q) * mod, bh = o.height || 70;
  let w = bw, h = bh;
  const g = new Float32Array(w * h).fill(255);
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') for (let y = 8; y < bh - 8; y++) for (let x = 0; x < mod; x++) g[y * w + (q + i) * mod + x] = 0;
  let px = g;
  if (o.blur) {
    const b = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let d = -1; d <= 1; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += g[y * w + xx]; n++; } } b[y * w + x] = s / n; }
    px = b;
  }
  if (o.turn === 90 || o.turn === 180) {
    const t = new Float32Array(w * h);
    if (o.turn === 90) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t[x * h + (h - 1 - y)] = px[y * w + x]; const k = w; w = h; h = k; }
    else for (let i = 0; i < w * h; i++) t[w * h - 1 - i] = px[i];
    px = t;
  }
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const v = Math.max(0, Math.min(255, px[i] + (o.noise ? (((i * 7919) % 61) - 30) : 0))); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
  return { width: w, height: h, data };
}

/* ====================================================================== */

function nodePart() {
  if (want(1)) {
    section('1  Engines load in a vm with a stub window');
    let ok = true, err = '';
    try { engines(); } catch (e) { ok = false; err = e.message; }
    check(ok, 'qr.bundle.js, qr-detect.js, qr-barcode.js and qr-export.js load together and register QR, QRDetect, QRBarcode and QRExport', err);
    const c = engines();
    check(typeof c.QRExport.svgToPdf === 'function' && typeof c.QRExport.svgToEps === 'function' && typeof c.QRExport.pngSetDpi === 'function' && typeof c.QRExport.labelSheetPdf === 'function', 'QRExport offers svgToPdf, svgToEps, pngSetDpi and labelSheetPdf');
    check(typeof c.QRDetect.scanAll === 'function' && typeof c.QRBarcode.scan === 'function', 'QRDetect.scanAll and QRBarcode.scan are there');
    const ctx = context({ MVRTool: undefined, document: { addEventListener() {} } });
    ctx.MVRTool = undefined;
    try { load(ctx, 'engine/render-qr.js'); } catch (e) { check(false, 'render-qr.js loads', e.message); }
    check(Object.keys(ctx.MVRTool || {}).sort().join() === 'mountQR,mountQRBulk,mountQRScanner', 'render-qr.js registers mountQR, mountQRBulk and mountQRScanner', Object.keys(ctx.MVRTool || {}).join());
    const wctx = context();
    const loaded = [];
    wctx.importScripts = function () { for (const f of arguments) { loaded.push(f); load(wctx, 'engine/' + f); } };
    wctx.postMessage = (m) => { wctx.__out = m; };
    try { load(wctx, 'engine/qr-scan-worker.js'); } catch (e) { check(false, 'the scan worker loads', e.message); }
    const q = wctx.QR.encode('WORKER 1', 'M');
    wctx.onmessage({ data: { id: 7, views: [{ data: raster(q.matrix, 5, 4), view: { sx: 0 } }], bars: barImage(ean13Bits('590123412345'), 3) } });
    const got = wctx.__out || {};
    check(loaded.join() === 'qr.bundle.js,qr-detect.js,qr-barcode.js' && got.id === 7 && (got.codes || []).map((x) => x.format + ':' + x.text).sort().join() === 'ean_13:5901234123457,qr_code:WORKER 1',
      'the scan worker imports its three readers and answers with the QR code and the EAN-13 in the pixels it is sent', JSON.stringify(got).slice(0, 300));
  }

  if (want(2)) {
    section('2  SVG path data to PDF curves');
    const X = engines().QRExport;
    const segs = X.pathSegments('M10 5a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z');     // a circle of radius 5 about (15, 5)
    let worst = 0;
    segs.filter((s) => s[0] === 'C').forEach((s) => {
      const p0 = s.__from;
      for (const t of [0.25, 0.5, 0.75]) {
        // the curve point needs the segment's start: rebuild from the previous end
      }
    });
    let cur = null;
    segs.forEach((s) => {
      if (s[0] === 'M') cur = [s[1], s[2]];
      else if (s[0] === 'C') {
        for (const t of [0, 0.2, 0.5, 0.8, 1]) {
          const u = 1 - t;
          const x = u * u * u * cur[0] + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5];
          const y = u * u * u * cur[1] + 3 * u * u * t * s[2] + 3 * u * t * t * s[4] + t * t * t * s[6];
          worst = Math.max(worst, Math.abs(Math.hypot(x - 15, y - 5) - 5));
        }
        cur = [s[5], s[6]];
      }
    });
    check(segs.filter((s) => s[0] === 'C').length >= 4 && worst < 0.01, 'a circle drawn as two SVG arcs becomes at least four cubic curves, every sampled point within 0.01 of the true circle', 'worst ' + worst);
    const r = X.pathSegments('M1 0H3A1 1 0 0 1 4 1V3A1 1 0 0 1 3 4H1A1 1 0 0 1 0 3V1A1 1 0 0 1 1 0Z');
    const ends = r.filter((s) => s[0] === 'C').map((s) => s[5].toFixed(3) + ',' + s[6].toFixed(3));
    check(ends.join(' ') === '4.000,1.000 3.000,4.000 0.000,3.000 1.000,0.000', 'a rounded square\'s four corner arcs end exactly where the SVG says', ends.join(' '));
    let threw = false; try { X.pathSegments('M0 0T5 5'); } catch (e) { threw = /not supported/.test(e.message); }
    check(threw, 'a path command the writer does not draw is refused by name, not dropped');
  }

  if (want(3)) {
    section('3  Vector PDF and EPS, walked here');
    const c = engines();
    const q = c.QR.encode('https://www.1234tools.com/', 'M');
    return (async () => {
      for (const shape of c.QR.shapes.module) {
        const svg = c.QR.toSVG(q, { scale: 8, shape: shape, eyeFrame: 'rounded', eyeBall: 'leaf', gradient: shape === 'dots' ? { type: 'linear', from: '#000000', to: '#1a237e', angle: 30 } : null });
        const pdf = Buffer.from(await c.QRExport.svgToPdf(svg, { widthPt: 144, heightPt: 144 }));
        const w = pdfWalk(pdf);
        const page = w.objects[w.pages[0]] || '';
        const content = Object.keys(w.streams).map((k) => w.streams[k].toString('latin1')).join('\n');
        const fills = (content.match(/^f\*?$/gm) || []).length + (content.match(/ sh$/gm) || []).length, curves = (content.match(/ c$/gm) || []).length, rects = (content.match(/ re$/gm) || []).length;
        check(!w.errors.length && w.pages.length === 1 && /\/MediaBox \[0 0 144 144\]/.test(page) && !/\/Subtype \/Image/.test(Object.values(w.objects).join('')) &&
          fills >= 3 && (shape === 'square' ? rects > 100 : curves > 50) && (shape !== 'dots' || /\/ShadingType 2/.test(Object.values(w.objects).join(''))),
          shape + ': one 144 x 144 pt page, xref and every stream sound, ' + (shape === 'square' ? rects + ' rectangles' : curves + ' curves') + ', no raster image' + (shape === 'dots' ? ', an axial shading for the gradient' : ''), w.errors.join('; ') + ' | ' + page.slice(0, 120));
        const eps = c.QRExport.svgToEps(svg, { widthPt: 144, heightPt: 144 });
        const opens = (eps.match(/(^|\s)q(?=\s)/g) || []).length, closes = (eps.match(/(^|\s)Q(?=\s)/g) || []).length;
        check(/^%!PS-Adobe-3\.0 EPSF-3\.0\n%%BoundingBox: 0 0 144 144\n/.test(eps) && opens === closes && /\nshowpage\n%%EOF\n$/.test(eps) && (shape !== 'dots' || /%%LanguageLevel: 3/.test(eps) && /shfill/.test(eps)),
          shape + ': EPS header and bounding box, every q matched by a Q' + (shape === 'dots' ? ', Level 3 with a shfill for the gradient' : ''), opens + '/' + closes);
      }
    })();
  }
  return Promise.resolve();
}

function nodePart2() {
  if (want(4)) {
    section('4  PNG resolution');
    const X = engines().QRExport;
    const png = pngOf(20, 10, (x, y) => [x * 10, y * 20, 128]);
    for (const dpi of [72, 300, 600]) {
      const out = Buffer.from(X.pngSetDpi(new Uint8Array(png), dpi));
      const ch = pngChunks(out);
      const ph = physOf(out);
      check(ch.every((c) => c.crcOk) && ch.map((c) => c.type).join() === 'IHDR,pHYs,IDAT,IEND' && ph.x === Math.round(dpi / 0.0254) && ph.y === ph.x && ph.unit === 1 &&
        zlib.inflateSync(ch.find((c) => c.type === 'IDAT').data).equals(zlib.inflateSync(pngChunks(png).find((c) => c.type === 'IDAT').data)),
        dpi + ' dpi: pHYs right after IHDR says ' + Math.round(dpi / 0.0254) + ' px/m, every CRC holds, the pixels are untouched', JSON.stringify(ph));
    }
    const twice = Buffer.from(X.pngSetDpi(X.pngSetDpi(new Uint8Array(png), 300), 150));
    check(pngChunks(twice).filter((c) => c.type === 'pHYs').length === 1 && physOf(twice).x === 5906, 'setting it again replaces the chunk rather than adding a second');
  }

  if (want(5)) {
    section('5  Linear barcodes drawn from the standards');
    const B = engines().QRBarcode;
    const read = (img) => B.scan(img).map((r) => r.format + ':' + r.text).join(' ');
    const cases = [
      ['EAN-13', ean13Bits('400638133393'), 'ean_13:4006381333931'],
      ['EAN-13 (ISBN)', ean13Bits('978030640615'), 'ean_13:9780306406157'],
      ['UPC-A (an EAN-13 starting 0)', ean13Bits('003600029145'), 'upc_a:036000291452'],
      ['EAN-8', ean8Bits('9638507'), 'ean_8:96385074'],
      ['Code 128 set B', c128Bits(c128B('Hello, Shop 42!')), 'code_128:Hello, Shop 42!'],
      ['Code 128 set C', c128Bits(c128C('00123456789012')), 'code_128:00123456789012'],
      ['Code 39', c39Bits('PART-77 A'), 'code_39:PART-77 A'],
      ['ITF-14', itfBits('1540014128876' + gs1('1540014128876')), 'itf:15400141288763']
    ];
    for (const [name, bits, wantText] of cases) {
      const got = [2, 3].map((mod) => read(barImage(bits, mod)));
      const turned = read(barImage(bits, 3, { turn: 90 })), flipped = read(barImage(bits, 3, { turn: 180 })), soft = read(barImage(bits, 3, { blur: true, noise: true }));
      check(got.every((g) => g === wantText) && turned === wantText && flipped === wantText && soft === wantText,
        name + ': read at 2 and 3 px a module, turned 90°, upside down, and blurred with noise', [got.join('|'), turned, flipped, soft].join(' / '));
    }
    /* a second, separate reference: module patterns JsBarcode 3.11.6 made
       (build/tests/fixtures/barcodes-jsbarcode-3.11.6.json; the library is
       not part of the site). Each must read, and where this file draws the
       same text its tables must give the very same modules. */
    const jsb = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barcodes-jsbarcode-3.11.6.json'), 'utf8')).codes;
    const jsbMiss = jsb.filter((k) => read(barImage(k.modules, 3)) !== k.format + ':' + k.text).map((k) => k.jsbarcode + ' ' + k.text + ' -> ' + read(barImage(k.modules, 3)));
    check(!jsbMiss.length, 'all ' + jsb.length + ' barcodes JsBarcode drew (EAN-13, EAN-8, UPC-A, Code 128 sets B and C, Code 39, ITF-14, ITF) are read with the right text and format', jsbMiss.join('; '));
    const mine = { '5901234123457': ean13Bits('590123412345'), '4006381333931': ean13Bits('400638133393'), '96385074': ean8Bits('9638507'), '036000291452': ean13Bits('003600029145'), '15400141288763': itfBits('15400141288763') };
    const tableMiss = jsb.filter((k) => mine[k.text] && mine[k.text] !== k.modules).map((k) => k.text);
    check(!tableMiss.length, 'this file\'s EAN-13, EAN-8, UPC-A and ITF-14 tables draw the same modules as JsBarcode', tableMiss.join(', '));
    const wrong = ean13Bits('400638133393').slice(0, -10) + EAN_R[(Number(gs1('400638133393')) + 1) % 10] + '101';
    check(read(barImage(wrong, 3)) === '', 'an EAN-13 whose check digit does not add up is not read', read(barImage(wrong, 3)));
    const vals = c128B('ABC');
    const bad128 = vals.concat([(vals[0] + vals.slice(1).reduce((s, v, i) => s + v * (i + 1), 0) + 1) % 103, 106]).map((v) => widthsToBits(C128W[v])).join('');
    check(read(barImage(bad128, 3)) === '', 'a Code 128 whose checksum is off by one is not read', read(barImage(bad128, 3)));
    const QR = engines().QR;
    let falses = 0, seed = 11;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let t = 0; t < 30; t++) {
      const q = QR.encode('art ' + t + ' https://example.com/' + Math.round(rnd() * 1e6), 'M');
      if (B.scan(raster(q.matrix, 3 + (t % 4), 4)).length) falses++;
      const n = 300, d = new Uint8ClampedArray(n * n * 4);
      for (let i = 0; i < n * n; i++) { const v = rnd() < 0.5 ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
      if (B.scan({ width: n, height: n, data: d }).length) falses++;
    }
    check(falses === 0, 'no barcode is read from 30 QR codes or 30 pictures of random noise', falses + ' false reads');
  }

  if (want(6)) {
    section('6  Several QR codes in one picture');
    const c = engines();
    const texts = ['FIRST 1', 'https://second.example.com/2', 'THIRD THREE 3'];
    const tiles = texts.map((t) => raster(c.QR.encode(t, 'M').matrix, 5, 4));
    const W = tiles.reduce((s, t) => s + t.width, 0) + 40, H = Math.max.apply(null, tiles.map((t) => t.height)) + 20;
    const data = new Uint8ClampedArray(W * H * 4).fill(255);
    let x0 = 10;
    tiles.forEach((t) => { for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) { const s = (y * t.width + x) * 4, d = ((y + 10) * W + x0 + x) * 4; data[d] = data[d + 1] = data[d + 2] = t.data[s]; } x0 += t.width + 10; });
    const all = c.QRDetect.scanAll({ width: W, height: H, data }).map((g) => g.text).sort();
    check(all.join('|') === texts.slice().sort().join('|'), 'scanAll reads all three codes side by side, each once', all.join(' | '));
    const one = c.QRDetect.scan({ width: W, height: H, data });
    check(!!one && texts.indexOf(one.text) >= 0, 'scan alone still reads one of them, as before', one && one.text);
  }

  if (want(7)) {
    section('7  Label grids');
    const X = engines().QRExport;
    const P = X.LABEL_PRESETS;
    const bad = Object.keys(P).filter((k) => { const p = P[k], pg = X.PAGES[p.page]; return X.checkLayout({ pageW: pg[0], pageH: pg[1], cols: p.cols, rows: p.rows, w: p.w, h: p.h, top: p.top, left: p.left, gapX: p.gapX, gapY: p.gapY }) !== ''; });
    check(Object.keys(P).length === 7 && !bad.length, 'all 7 ready-made grids fit their paper', bad.join(', '));
    /* the published sheets are symmetric: margins left and right agree to 0.1 mm */
    const off = Object.keys(P).filter((k) => { const p = P[k], pg = X.PAGES[p.page]; const right = pg[0] - p.left - p.cols * p.w - (p.cols - 1) * p.gapX; const bottom = pg[1] - p.top - p.rows * p.h - (p.rows - 1) * p.gapY; return Math.abs(right - p.left) > 0.1 || Math.abs(bottom - p.top) > 0.1; });
    check(!off.length, 'each grid is centred on its paper, as the sheets it copies are', off.join(', '));
    check(/off the right/.test(X.checkLayout({ pageW: 210, pageH: 297, cols: 4, rows: 7, w: 63.5, h: 38.1, top: 15, left: 7, gapX: 2, gapY: 0 })) &&
      /off the bottom/.test(X.checkLayout({ pageW: 210, pageH: 297, cols: 3, rows: 8, w: 63.5, h: 38.1, top: 15, left: 7, gapX: 2, gapY: 0 })),
      'a grid that runs off the page is refused, saying which edge');
    const src = fs.readFileSync(path.join(ROOT, 'engine/render-qr.js'), 'utf8');
    const m = /const LABEL_PRESETS_UI = (\{[\s\S]*?\n  \});/.exec(src);
    let ui = null; try { ui = m && vm.runInNewContext('(' + m[1] + ')'); } catch (e) { ui = null; }
    check(ui && JSON.stringify(ui) === JSON.stringify(P), 'the page\'s copy of the presets (render-qr.js) matches qr-export.js\'s');
    const L = { pageW: 210, pageH: 297, cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.21, gapX: 2.54, gapY: 0, text: true, fontPt: 8 };
    const cells = X.labelCells(L);
    const inside = cells.every((c) => c.code.x >= c.x && c.code.x + c.code.s <= c.x + c.w + 1e-9 && c.code.y >= c.y && c.textY <= c.y + c.h);
    check(cells.length === 21 && inside, '21 cells, each code and its text inside its own label');
  }
}

/* ====================================================================== */
/* the browser part */

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  return null;
}

let offsite = [];
async function newPage(browser, opts) {
  const o = opts || {};
  const page = await browser.newPage();
  await page.setViewport({ width: o.width || 1400, height: 1000 });
  await page.setBypassServiceWorker(true);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setRequestInterception(true);
  const requests = [];
  page.on('request', (r) => {
    const u = r.url();
    requests.push(u);
    if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(u)) { offsite.push(u); r.abort(); return; }
    r.continue();
  });
  await page.evaluateOnNewDocument((noDetector) => {
    try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* */ }
    if (noDetector) { try { delete window.BarcodeDetector; } catch (e) { /* */ } }
    window.__dl = [];
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__dl.push(fetch(this.href).then((r) => r.blob()).then(async (b) => ({ name: this.download, type: b.type, bytes: Array.from(new Uint8Array(await b.arrayBuffer())) })));
    };
  }, !!o.noDetector);
  return { page, errors, requests };
}
async function open(browser, url, opts) {
  const t = await newPage(browser, opts);
  await t.page.goto(BASE_URL + url, { waitUntil: 'load' });
  await t.page.evaluate(() => { Object.keys(localStorage).filter((k) => /^1234tools-qr-/.test(k)).forEach((k) => localStorage.removeItem(k)); const b = document.querySelector('.cc'); if (b) b.remove(); });
  if (!(opts && opts.keepStorage)) await t.page.reload({ waitUntil: 'load' });
  await t.page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  await t.page.waitForSelector('.tool-io > *', { timeout: 20000 });
  return t;
}
const setField = (p, sel, v) => p.evaluate((sel, v) => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const verdict = async (p) => {
  await p.waitForFunction(() => { const v = document.querySelector('.qr-verdict'); return v && v.textContent && !/Reading the code back/.test(v.textContent); }, { timeout: 30000 });
  await sleep(250);
  return p.$eval('.qr-verdict .qr-verdict-head', (e) => e.textContent).catch(() => '');
};
const clickText = (p, sel, re) => p.evaluate((sel, src) => { const b = [...document.querySelectorAll(sel)].find((x) => new RegExp(src).test(x.textContent)); if (!b) return false; b.click(); return true; }, sel, re.source);
async function downloads(p, n, timeout) {
  await p.waitForFunction((n) => window.__dl.length >= n, { timeout: timeout || 60000 }, n || 1);
  const got = await p.evaluate(() => Promise.all(window.__dl.splice(0)));
  return got.map((d) => ({ name: d.name, type: d.type, bytes: Buffer.from(d.bytes) }));
}

/* pdf.js, the copy the site vendors: render a page and read its pixels */
const PDFJS_RENDER = async (bytes, pageNo, scale) => {
  const pdfjs = await import('/engine/vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/engine/vendor/pdfjs/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const pg = await doc.getPage(pageNo);
  const vp = pg.getViewport({ scale });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: g, viewport: vp }).promise;
  const ops = await pg.getOperatorList();
  const text = (await pg.getTextContent()).items.map((i) => i.str).join('|');
  window.__pdfCanvas = c;
  return { pages: doc.numPages, view: pg.view, w: c.width, h: c.height, images: ops.fnArray.filter((f) => f === pdfjs.OPS.paintImageXObject).length, text };
};

/*
 * A small PostScript interpreter, enough for the EPS files the generator
 * writes: numbers, names, strings, hex data, arrays, dictionaries and
 * procedures; def/load/bind; gsave/grestore; concat; the path operators;
 * fill, eofill, clip, eoclip; setrgbcolor; shfill (filled with the middle
 * of its two colours, which is all a decoder needs); image (the dictionary
 * form, ASCIIHex data); fonts and show are skipped. Draws on a canvas at
 * `scale` pixels a point.
 */
const EPS_RENDER = (eps, scale) => {
  const bb = /%%BoundingBox: 0 0 (\d+) (\d+)/.exec(eps);
  const W = Number(bb[1]), H = Number(bb[2]);
  const c = document.createElement('canvas'); c.width = Math.ceil(W * scale); c.height = Math.ceil(H * scale);
  const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  const src = eps.slice(eps.indexOf('%%BeginProlog'));
  let i = 0;
  const next = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === '%') { while (i < src.length && src[i] !== '\n') i++; continue; }
      break;
    }
    if (i >= src.length) return null;
    const ch = src[i];
    if (ch === '(') { let d = 1, s = ''; i++; while (d) { const x = src[i++]; if (x === '\\') { s += src[i++]; continue; } if (x === '(') d++; if (x === ')') d--; if (d) s += x; } return { str: s }; }
    if (ch === '<' && src[i + 1] === '<') { i += 2; return { op: '<<' }; }
    if (ch === '>' && src[i + 1] === '>') { i += 2; return { op: '>>' }; }
    if ('[]{}'.indexOf(ch) >= 0) { i++; return { op: ch }; }
    let j = i; while (j < src.length && !/[\s\[\]{}()<>\/%]/.test(src[j])) j++;
    if (ch === '/') { j = i + 1; while (j < src.length && !/[\s\[\]{}()<>\/%]/.test(src[j])) j++; const n = src.slice(i + 1, j); i = j; return { name: n }; }
    const t = src.slice(i, j); i = j;
    return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? { num: Number(t) } : { op: t };
  };
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  let ctm = [scale, 0, 0, -scale, 0, H * scale];
  const gstack = [];
  let path = new Path2D(), colour = [0, 0, 0], cur = null, start = null;
  const dev = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  const stack = [], dict = {}, marks = [];
  const fillCol = (col) => 'rgb(' + col.map((v) => Math.round(v * 255)).join(',') + ')';
  const run = (tok) => {
    if (tok.num !== undefined || tok.str !== undefined || tok.name !== undefined) { stack.push(tok.num !== undefined ? tok.num : tok.str !== undefined ? tok.str : { name: tok.name }); return; }
    const op = tok.op;
    if (op === '[' || op === '<<') { marks.push(stack.length); return; }
    if (op === ']') { const m = marks.pop(); stack.push(stack.splice(m)); return; }
    if (op === '>>') { const m = marks.pop(); const a = stack.splice(m); const d = {}; for (let k = 0; k < a.length; k += 2) d[a[k].name] = a[k + 1]; stack.push(d); return; }
    if (op === '{') { let depth = 1; const body = []; for (;;) { const t = next(); if (t.op === '{') depth++; if (t.op === '}') { depth--; if (!depth) break; } body.push(t); } stack.push({ proc: body }); return; }
    if (dict[op] !== undefined) {
      const v = dict[op];
      if (v && v.proc) v.proc.forEach(run); else if (v && v.alias) run({ op: v.alias }); else stack.push(v);
      return;
    }
    switch (op) {
      case 'def': { const v = stack.pop(), k = stack.pop(); dict[k.name] = v; return; }
      case 'load': { const k = stack.pop(); stack.push(dict[k.name] !== undefined ? dict[k.name] : { alias: k.name }); return; }
      case 'bind': return;
      case 'save': stack.push({ save: 1 }); return;
      case 'restore': stack.pop(); return;
      case 'gsave': gstack.push({ ctm: ctm.slice(), colour: colour.slice() }); g.save(); return;
      case 'grestore': { const s = gstack.pop(); ctm = s.ctm; colour = s.colour; g.restore(); return; }
      case 'array': stack.push(new Array(stack.pop()).fill(0)); return;
      case 'astore': { const a = stack.pop(); const v = stack.splice(stack.length - a.length); stack.push(v); return; }
      case 'concat': ctm = mul(ctm, stack.pop()); return;
      case 'translate': { const y = stack.pop(), x = stack.pop(); ctm = mul(ctm, [1, 0, 0, 1, x, y]); return; }
      case 'scale': { const y = stack.pop(), x = stack.pop(); ctm = mul(ctm, [x, 0, 0, y, 0, 0]); return; }
      case 'moveto': { const y = stack.pop(), x = stack.pop(); const d = dev(x, y); path.moveTo(d[0], d[1]); cur = start = d; return; }
      case 'lineto': { const y = stack.pop(), x = stack.pop(); const d = dev(x, y); path.lineTo(d[0], d[1]); cur = d; return; }
      case 'curveto': { const v = stack.splice(stack.length - 6); const a = dev(v[0], v[1]), b = dev(v[2], v[3]), e = dev(v[4], v[5]); path.bezierCurveTo(a[0], a[1], b[0], b[1], e[0], e[1]); cur = e; return; }
      case 'closepath': path.closePath(); cur = start; return;
      case 'newpath': path = new Path2D(); return;
      case 'setrgbcolor': colour = stack.splice(stack.length - 3); return;
      case 'fill': case 'eofill': g.fillStyle = fillCol(colour); g.fill(path, op === 'eofill' ? 'evenodd' : 'nonzero'); path = new Path2D(); return;
      case 'clip': case 'eoclip': g.clip(path, op === 'eoclip' ? 'evenodd' : 'nonzero'); return;
      case 'shfill': { const d = stack.pop(); const f = d.Function; const mid = f.C0.map((v, k) => (v + f.C1[k]) / 2); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = fillCol(mid); g.fillRect(0, 0, c.width, c.height); g.restore(); window.__epsShading = (window.__epsShading || 0) + 1; return; }
      case 'setcolorspace': stack.pop(); return;
      case 'currentfile': stack.push({ file: 1 }); return;
      case 'filter': stack.pop(); return;
      case 'image': {
        const d = stack.pop();
        let hex = '';
        while (src[i] !== '>') { if (/[0-9a-f]/i.test(src[i])) hex += src[i]; i++; }
        i++;
        const iw = d.Width, ih = d.Height, im = g.createImageData(iw, ih);
        for (let k = 0; k < iw * ih; k++) { for (let ch = 0; ch < 3; ch++) im.data[k * 4 + ch] = parseInt(hex.substr((k * 3 + ch) * 2, 2), 16); im.data[k * 4 + 3] = 255; }
        window.__epsImage = { w: iw, h: ih, first: [im.data[0], im.data[1], im.data[2]], hexLength: hex.length };
        const tmp = document.createElement('canvas'); tmp.width = iw; tmp.height = ih; tmp.getContext('2d').putImageData(im, 0, 0);
        /* ImageMatrix [w 0 0 -h 0 h]: row 0 at the top of the unit square */
        const m = mul(ctm, [1 / iw, 0, 0, -1 / ih, 0, 1]);
        g.save(); g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); g.drawImage(tmp, 0, 0); g.restore();
        return;
      }
      case 'findfont': case 'scalefont': case 'definefont': stack.pop(); if (op !== 'definefont') stack.push({ font: 1 }); return;
      case 'setfont': stack.pop(); return;
      case 'show': stack.pop(); window.__epsText = (window.__epsText || 0) + 1; return;
      case 'showpage': return;
      /* the WinAnsi re-encoding in the prolog */
      case 'true': case 'false': stack.push(op === 'true'); return;
      case 'ISOLatin1Encoding':stack.push(new Array(256).fill({ name: '.notdef' })); return;
      case 'copy': { const n = stack.pop(); const a = stack.pop(); stack.push(Array.isArray(a) ? a.slice() : a); return; }
      case 'aload': { const a = stack.pop(); a.forEach((x) => stack.push(x)); stack.push(a); return; }
      case 'length': { const a = stack.pop(); stack.push(Array.isArray(a) ? a.length : Object.keys(a || {}).length); return; }
      case 'idiv': { const b = stack.pop(), a = stack.pop(); stack.push(Math.trunc(a / b)); return; }
      case 'repeat': { const pr = stack.pop(), n = stack.pop(); for (let k = 0; k < n; k++) pr.proc.forEach(run); return; }
      case '3': return;
      case 'roll': { const j = stack.pop(), n = stack.pop(); const part = stack.splice(stack.length - n); for (let k = 0; k < n; k++) stack.push(part[((k - j) % n + n) % n]); return; }
      case 'put': { const v = stack.pop(), k = stack.pop(), a = stack.pop(); if (Array.isArray(a)) a[k] = v; return; }
      case 'dup': stack.push(stack[stack.length - 1]); return;
      case 'dict': stack.pop(); stack.push({}); return;
      case 'begin': case 'end': case 'pop': if (op === 'pop') stack.pop(); else if (op === 'begin') stack.pop(); return;
      case 'forall': stack.pop(); stack.pop(); return;
      case 'currentdict': stack.push({}); return;
      case 'exch': { const b = stack.pop(), a = stack.pop(); stack.push(b, a); return; }
      default: throw new Error('EPS operator not handled by the test: ' + op);
    }
  };
  for (;;) { const t = next(); if (!t) break; if (t.op === '%%EOF') break; run(t); }
  window.__epsCanvas = c;
  return { w: c.width, h: c.height };
};

async function browserPart() {
  const puppeteer = loadPuppeteer();
  if (!puppeteer) { skip('puppeteer-core not found: the browser cases are skipped'); return; }
  if (!fs.existsSync(CHROME)) { skip('Chrome not found at ' + CHROME); return; }
  const { serve } = require('./serve.js');
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 300000, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  try {
    if (want(8)) await testTypes(browser);
    if (want(9)) await testFrames(browser);
    if (want(10)) await testVector(browser);
    if (want(11)) await testZip(browser);
    if (want(12)) await testMemory(browser);
    if (want(13)) await testSheet(browser);
    if (want(14)) await testTwoThousand(browser);
    if (want(15)) await testScanner(browser);
    if (want(16)) await testLayout(browser);
    if (want(17)) await testBulkFrames(browser);
    check(offsite.length === 0, 'browser: not one request to anything but 127.0.0.1', offsite.slice(0, 5).join(' '));
  } finally {
    await browser.close();
    server.close();
  }
}

const G = '/qr/qr-code-generator/', BU = '/qr/qr-bulk-generator/', SC = '/qr/qr-code-scanner/';

async function testTypes(browser) {
  section('8  Generator: the new content types');
  const { page, errors } = await open(browser, G);
  const content = async (type, fields) => {
    await setField(page, '#qr-type', type);
    await page.waitForSelector('#f-' + Object.keys(fields)[0]);
    for (const k of Object.keys(fields)) await setField(page, '#f-' + k, fields[k]);
    await verdict(page);
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } }); });
    await clickText(page, '.qr-actions button', /Copy content/);
    return page.evaluate(() => window.__copied);
  };
  const cases = [
    ['paypal', { user: 'riocafe', am: '4,50', cur: 'gbp' }, 'https://paypal.me/riocafe/4.50GBP'],
    ['paypal', { user: 'https://paypal.me/riocafe', am: '', cur: '' }, 'https://paypal.me/riocafe'],
    ['social', { net: 'tiktok', handle: '@rio.cafe' }, 'https://www.tiktok.com/@rio.cafe'],
    ['social', { net: 'linkedin', handle: 'priya-nair' }, 'https://www.linkedin.com/in/priya-nair'],
    ['appstore', { store: 'apple', app: 'id284882215' }, 'https://apps.apple.com/app/id284882215'],
    ['appstore', { store: 'google', app: 'com.example.app' }, 'https://play.google.com/store/apps/details?id=com.example.app'],
    ['file', { url: 'example.com/tour/stop-1.mp3' }, 'https://example.com/tour/stop-1.mp3']
  ];
  for (const [type, fields, expect] of cases) {
    const got = await content(type, fields);
    check(got === expect, type + ' ' + JSON.stringify(fields) + ' encodes ' + expect, got);
  }
  const card = await content('vcard4', { first: 'Priya', last: 'Nair', org: 'MVR; IT', phone: '+44 118 900 0111', email: 'priya@example.com' });
  const lines = String(card).split('\r\n');
  check(lines[0] === 'BEGIN:VCARD' && lines[1] === 'VERSION:4.0' && lines.indexOf('FN:Priya Nair') > 0 && lines.indexOf('N:Nair;Priya;;;') > 0 && lines.indexOf('ORG:MVR\\; IT') > 0 &&
    lines.indexOf('TEL;VALUE=uri;TYPE=cell:tel:+441189000111') > 0 && lines[lines.length - 1] === 'END:VCARD' && !/[^\r]\n/.test(card),
    'vCard 4.0 (RFC 6350): CRLF line ends, FN and N, the semicolon escaped, the phone as a tel: URI', JSON.stringify(card));
  const note = await page.evaluate(async () => { const s = document.querySelector('#qr-type'); s.value = 'appstore'; s.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 100)); return document.querySelector('.qr-type-note').textContent; });
  check(/one store/.test(note) && /server/.test(note), 'the app store type says plainly that one code opens one store', note);
  check(errors.length === 0, 'generator: no script errors', errors.join(' | '));
  await page.close();
}

async function testFrames(browser) {
  section('9  Generator: frames and labels, read back');
  const { page, errors } = await open(browser, G);
  const styles = await page.$$eval('#qr-frame option', (l) => l.map((o) => o.value));
  await setField(page, '#qr-label', 'Scan for the menu');
  const rows = [];
  for (const st of styles) {
    for (const shape of ['square', 'dots']) {
      await page.evaluate((s) => document.querySelector('.shape-btn[data-value="' + s + '"]').click(), shape);
      await setField(page, '#qr-frame', st);
      const v = await verdict(page);
      /* the preview, rasterised here and decoded independently of the page's own check */
      const read = await page.evaluate(async () => {
        const svg = document.querySelector('.qr-box svg').outerHTML;
        const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
        const got = window.QRDetect.scan(g.getImageData(0, 0, c.width, c.height), { invert: false });
        return { text: got && got.text, label: (document.querySelector('.qr-box svg text') || {}).textContent || '', w: img.width, h: img.height };
      });
      rows.push(st + '/' + shape + ': ' + (/^Verified/.test(v) && read.text === 'https://www.1234tools.com' && (st === 'none' || read.label === 'Scan for the menu') ? 'ok' : v.slice(0, 40) + ' ' + JSON.stringify(read)));
    }
  }
  check(styles.length === 6 && rows.every((r) => / ok$|: ok$/.test(r)), 'every frame style (' + (styles.length - 1) + ' and none) in square and dot modules is Verified, decodes from Chrome\'s own raster, and carries its label', rows.filter((r) => !/: ok$/.test(r)).join(' | '));

  /* a logo at the slider's top end on level M will not read: the page must say so */
  await setField(page, '#qr-frame', 'banner');
  const logo = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#c2452c'; g.fillRect(0, 0, 64, 64);
    return c.toDataURL('image/png').split(',')[1];
  });
  const f = path.join(OUT, 'logo.png'); fs.writeFileSync(f, Buffer.from(logo, 'base64'));
  const input = await page.$('#qr-logo');
  await input.uploadFile(f);
  await page.waitForFunction(() => !document.querySelector('#qr-logosize').closest('.field').hidden, { timeout: 10000 });
  await setField(page, '#qr-ec', 'M');
  await setField(page, '#qr-logosize', '0.35');
  const v = await verdict(page);
  await page.waitForSelector('.qr-fix', { timeout: 20000 }).catch(() => {});
  const fix = await page.$eval('.qr-fix', (b) => b.textContent).catch(() => '');
  check(/will not scan/.test(v) && /^Fix it:/.test(fix), 'a 35% logo on level M inside a frame is reported as not scanning, with a fix offered', v + ' | ' + fix);
  if (fix) {
    await page.click('.qr-fix');
    const v2 = await verdict(page);
    check(/^(Verified|Scanned and read back)/.test(v2), 'pressing the fix gives a code that reads back', v2);
  }
  const range = await page.$eval('#qr-logosize', (r) => [r.min, r.max, r.closest('.field').querySelector('output').textContent]);
  check(range[0] === '0.1' && range[1] === '0.35' && /% of the width/.test(range[2]), 'the logo size is a slider from 10% to 35%, its value written beside it', range.join(' '));
  await setField(page, '#qr-fill', 'linear');
  await setField(page, '#qr-angle', '127');
  await verdict(page);
  const grad = await page.$eval('.qr-box svg', (s) => (s.querySelector('linearGradient') || {}).outerHTML || '');
  const m = /x1="([-\d.]+)%" y1="([-\d.]+)%" x2="([-\d.]+)%" y2="([-\d.]+)%"/.exec(grad);
  const ang = m ? Math.atan2(Number(m[4]) - Number(m[2]), Number(m[3]) - Number(m[1])) * 180 / Math.PI : null;
  check(m && Math.abs(ang - 127) < 0.5, 'a gradient angle of 127° (any whole degree, not four presets) runs at 127° in the SVG', ang);
  check(errors.length === 0, 'frames: no script errors', errors.join(' | '));
  await page.close();
}

async function testVector(browser) {
  section('10  Generator: PDF by pdf.js, EPS by the interpreter here, PNG pHYs');
  const { page, errors } = await open(browser, G);
  const combos = [
    { name: 'square, no frame', shape: 'square', frame: 'none' },
    { name: 'dots, linear gradient at 30°, banner frame', shape: 'dots', frame: 'banner', fill: 'linear', angle: '30' },
    { name: 'fluid, radial gradient, bubble frame', shape: 'fluid', frame: 'bubble', fill: 'radial' },
    { name: 'rounded, outline frame, 900 px at 150 dpi', shape: 'rounded', frame: 'outline', px: '900', dpi: '150' }
  ];
  for (const k of combos) {
    await page.evaluate((s) => document.querySelector('.shape-btn[data-value="' + s + '"]').click(), k.shape);
    await setField(page, '#qr-frame', k.frame);
    await setField(page, '#qr-fill', k.fill || 'solid');
    if (k.angle) await setField(page, '#qr-angle', k.angle);
    await setField(page, '#qr-size', k.px || '600'); await setField(page, '#qr-dpi', k.dpi || '300');
    await verdict(page);
    await clickText(page, '.qr-actions button', /Download PDF/);
    const [pdf] = await downloads(page);
    await clickText(page, '.qr-actions button', /Download EPS/);
    const [eps] = await downloads(page);
    await clickText(page, '.qr-actions button', /Download PNG/);
    const [png] = await downloads(page);
    const box = await page.$eval('.qr-box svg', (s) => s.getAttribute('viewBox').split(' ').map(Number));
    const wantW = Number(k.px || 600) / Number(k.dpi || 300) * 72, wantH = wantW * box[3] / box[2];
    const walked = pdfWalk(pdf.bytes);
    const r = await page.evaluate(PDFJS_RENDER, Array.from(pdf.bytes), 1, 4);
    const dec = await page.evaluate(() => { const c = window.__pdfCanvas; const got = window.QRDetect.scan(c.getContext('2d').getImageData(0, 0, c.width, c.height)); return got && got.text; });
    check(!walked.errors.length && pdf.type === 'application/pdf' && /\.pdf$/.test(pdf.name) && Math.abs(r.view[2] - wantW) < 0.05 && Math.abs(r.view[3] - wantH) < 0.05 && r.images === 0 && dec === 'https://www.1234tools.com' &&
      (k.frame === 'none' || /SCAN ME/.test(r.text)),
      k.name + ': the PDF is ' + wantW.toFixed(1) + ' x ' + wantH.toFixed(1) + ' pt, all vector, pdf.js draws it and the code decodes' + (k.frame !== 'none' ? ', label in Helvetica' : ''), JSON.stringify(r) + ' decoded ' + dec + ' ' + walked.errors.join(';'));
    await page.evaluate(() => { window.__epsShading = 0; window.__epsText = 0; });
    const er = await page.evaluate(EPS_RENDER, eps.bytes.toString('latin1'), 4);
    const edec = await page.evaluate(() => { const c = window.__epsCanvas; const got = window.QRDetect.scan(c.getContext('2d').getImageData(0, 0, c.width, c.height)); return { text: got && got.text, shadings: window.__epsShading, texts: window.__epsText }; });
    check(eps.type === 'application/postscript' && /\.eps$/.test(eps.name) && edec.text === 'https://www.1234tools.com' && (!k.fill || edec.shadings > 0) && (k.frame === 'none' || edec.texts === 1),
      k.name + ': the EPS, run through the interpreter here, decodes' + (k.fill ? ' (gradient as shfill)' : '') + (k.frame !== 'none' ? ', one label shown' : ''), JSON.stringify(edec) + ' ' + JSON.stringify(er));
    const ph = physOf(png.bytes);
    const w = png.bytes.readUInt32BE(16), h = png.bytes.readUInt32BE(20);
    check(png.type === 'image/png' && ph && ph.x === Math.round(Number(k.dpi || 300) / 0.0254) && w === Number(k.px || 600) && Math.abs(h - Math.round(w * box[3] / box[2])) <= 1 && pngChunks(png.bytes).every((c) => c.crcOk),
      k.name + ': the PNG is ' + w + ' x ' + h + ' px with pHYs ' + (ph && ph.x) + ' px/m (' + (k.dpi || 300) + ' dpi) and sound CRCs', JSON.stringify(ph) + ' ' + w + 'x' + h);
  }
  /* a logo: an image in the PDF with a soft mask; in the EPS flattened onto its knock-out */
  const logo = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 40; const g = c.getContext('2d');
    g.fillStyle = 'rgba(26, 35, 126, 1)'; g.fillRect(10, 10, 20, 20);                // transparent corners, opaque middle
    return c.toDataURL('image/png').split(',')[1];
  });
  const f = path.join(OUT, 'logo-alpha.png'); fs.writeFileSync(f, Buffer.from(logo, 'base64'));
  await setField(page, '#qr-frame', 'none'); await setField(page, '#qr-fill', 'solid');
  await (await page.$('#qr-logo')).uploadFile(f);
  await page.waitForFunction(() => !document.querySelector('#qr-logosize').closest('.field').hidden, { timeout: 10000 });
  await setField(page, '#qr-logosize', '0.2');
  const v = await verdict(page);
  await clickText(page, '.qr-actions button', /Download PDF/);
  const [pdf] = await downloads(page);
  await clickText(page, '.qr-actions button', /Download EPS/);
  const [eps] = await downloads(page);
  const w = pdfWalk(pdf.bytes);
  const objs = Object.values(w.objects).join('\n');
  const r = await page.evaluate(PDFJS_RENDER, Array.from(pdf.bytes), 1, 4);
  const dec = await page.evaluate(() => { const c = window.__pdfCanvas; const got = window.QRDetect.scan(c.getContext('2d').getImageData(0, 0, c.width, c.height)); return got && got.text; });
  check(/^Verified|^Scanned/.test(v) && /\/Subtype \/Image[^>]*\/SMask \d+ 0 R/.test(objs) && /\/ColorSpace \/DeviceGray/.test(objs) && r.images === 1 && dec === 'https://www.1234tools.com',
    'with a logo the PDF holds one RGB image with a soft mask (its transparency), pdf.js draws it and the code still decodes', v + ' ' + JSON.stringify(r) + ' ' + dec);
  await page.evaluate(() => { window.__epsImage = null; });
  await page.evaluate(EPS_RENDER, eps.bytes.toString('latin1'), 4);
  const im = await page.evaluate(() => window.__epsImage);
  const edec = await page.evaluate(() => { const c = window.__epsCanvas; const got = window.QRDetect.scan(c.getContext('2d').getImageData(0, 0, c.width, c.height)); return got && got.text; });
  /* the logo's top-left pixel is fully transparent, so it must arrive as the knock-out colour, white */
  check(im && im.first.join() === '255,255,255' && im.hexLength === im.w * im.h * 6 && edec === 'https://www.1234tools.com',
    'in the EPS the logo is an RGB image flattened onto the white knock-out (a clear pixel arrives white), and the code decodes', JSON.stringify(im) + ' ' + edec);
  check(errors.length === 0, 'vector files: no script errors', errors.join(' | '));
  await page.close();
}

async function testZip(browser) {
  section('11  Generator: All formats (ZIP)');
  const { page, errors } = await open(browser, G);
  await verdict(page);
  await clickText(page, '.qr-actions button', /All formats/);
  const [z] = await downloads(page, 1, 90000);
  const f = path.join(OUT, z.name); fs.writeFileSync(f, z.bytes);
  let listing = '';
  /* the system's bsdtar: on Windows Git Bash puts GNU tar first on PATH, which reads "E:" as a host */
  const tarBin = process.platform === 'win32' && fs.existsSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe')) ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar';
  try { listing = execFileSync(tarBin, ['-tf', f], { encoding: 'utf8' }); } catch (e) { listing = 'tar failed: ' + e.message; }
  const names = listing.trim().split(/\r?\n/).sort();
  check(z.type === 'application/zip' && z.name === 'qr-code.zip' && names.join() === 'qr-code.eps,qr-code.pdf,qr-code.png,qr-code.svg', 'tar -tf lists qr-code.svg, .png, .pdf and .eps in qr-code.zip', z.name + ' ' + z.type + ': ' + names.join(', '));
  check(errors.length === 0, 'ZIP: no script errors', errors.join(' | '));
  await page.close();
}

async function testMemory(browser) {
  section('12  Generator: remembered settings, shared links, designs');
  const t = await open(browser, G);
  const page = t.page;
  await page.evaluate(() => document.querySelector('.shape-btn[data-value="dots"]').click());
  await setField(page, '#qr-frame', 'bubble');
  await setField(page, '#qr-dpi', '600');
  await setField(page, '#f-url', 'https://private.example.net/token-998');
  await verdict(page);
  await sleep(600);
  const stored = await page.evaluate(() => localStorage.getItem('1234tools-qr-generator-v1') || '');
  check(/"shape":"dots"/.test(stored) && /"frame":"bubble"/.test(stored) && /"dpi":"600"/.test(stored) && !/private\.example|token-998/.test(stored),
    'the look is remembered under one versioned key, and what the code says is not', stored.slice(0, 200));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#qr-frame');
  await verdict(page);
  const back = await page.evaluate(() => ({ frame: document.querySelector('#qr-frame').value, dpi: document.querySelector('#qr-dpi').value, dots: document.querySelector('.shape-btn[data-value="dots"]').classList.contains('is-active'), url: document.querySelector('#f-url').value }));
  check(back.frame === 'bubble' && back.dpi === '600' && back.dots && back.url === 'https://www.1234tools.com', 'after a reload the look comes back and the content is the default again', JSON.stringify(back));
  await page.goto(BASE_URL + G + '?t=url&url=https://shared.example.com/&style=shape:square,frame:none&v=1', { waitUntil: 'load' });
  await page.waitForSelector('#qr-frame');
  await verdict(page);
  const shared = await page.evaluate(() => ({ frame: document.querySelector('#qr-frame').value, square: document.querySelector('.shape-btn[data-value="square"]').classList.contains('is-active'), url: document.querySelector('#f-url').value, dpi: document.querySelector('#qr-dpi').value }));
  check(shared.frame === 'none' && shared.square && shared.url === 'https://shared.example.com/' && shared.dpi === '300', 'a shared link shows its own look, not the one remembered on this device', JSON.stringify(shared));
  const after = await page.evaluate(() => localStorage.getItem('1234tools-qr-generator-v1') || '');
  check(/"frame":"bubble"/.test(after), 'opening a shared link does not overwrite what this device remembered');
  await page.goto(BASE_URL + G, { waitUntil: 'load' });
  await page.waitForSelector('#qr-frame');
  await setField(page, '#f-url', 'https://private.example.net/token-998');
  await verdict(page);
  await clickText(page, '.qr-actions button', /Download SVG/);
  await downloads(page);
  await clickText(page, 'button', /^Save this design$/);
  const designs = await page.evaluate(() => JSON.parse(localStorage.getItem('1234tools-qr-designs-v1') || '[]'));
  const tiles = await page.$$eval('.qr-design', (l) => l.length);
  check(designs.length === 1 && tiles === 1 && !/private\.example|token-998/.test(JSON.stringify(designs)) && /<svg/.test(designs[0].thumb),
    'a download keeps the design once (saving the same look again does not repeat it), drawn from a sample address, never the code\'s content', designs.length + ' kept, ' + tiles + ' shown');
  await page.evaluate(() => document.querySelector('.shape-btn[data-value="square"]').click());
  await setField(page, '#qr-frame', 'none');
  await verdict(page);
  /* the saved designs sit in a folded panel, as a visitor finds them: open it first */
  await page.evaluate(() => { const d = document.querySelector('.qr-design').closest('details'); if (d && !d.open) d.querySelector('summary').click(); });
  await page.click('.qr-design');
  await verdict(page);
  const applied = await page.evaluate(() => ({ frame: document.querySelector('#qr-frame').value, dots: document.querySelector('.shape-btn[data-value="dots"]').classList.contains('is-active') }));
  check(applied.frame === 'bubble' && applied.dots, 'pressing a saved design puts its look back', JSON.stringify(applied));
  await clickText(page, 'button', /^Clear designs$/);
  await clickText(page, 'button', /^Reset to defaults$/);
  await verdict(page);
  const reset = await page.evaluate(() => ({ d: localStorage.getItem('1234tools-qr-designs-v1'), g: localStorage.getItem('1234tools-qr-generator-v1'), frame: document.querySelector('#qr-frame').value, dpi: document.querySelector('#qr-dpi').value }));
  check(reset.d === null && reset.g === null && reset.frame === 'none' && reset.dpi === '300', 'Clear designs empties the designs key; Reset to defaults puts the controls back and forgets the remembered look', JSON.stringify(reset));
  /* storage refused: the page still works */
  const t2 = await newPage(browser);
  await t2.page.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await t2.page.goto(BASE_URL + G, { waitUntil: 'load' });
  await t2.page.waitForSelector('#qr-frame');
  const v = await verdict(t2.page);
  check(/^Verified/.test(v) && t2.errors.length === 0, 'with storage blocked the generator still draws and verifies, with no script error', v + ' ' + t2.errors.join(' | '));
  await t2.page.close();
  check(t.errors.length === 0, 'memory: no script errors', t.errors.join(' | '));
  await page.close();
}

async function bulkRun(page, list, type) {
  if (type) await setField(page, '#qr-type', type);
  await setField(page, '#qr-values', list);
  await clickText(page, '.tool-io button', /^Generate codes$/);
  await page.waitForFunction(() => { const v = document.querySelector('.qr-stage .qr-verdict'); return v && /Verified|will not|could not/.test(v.textContent); }, { timeout: 300000 });
  await sleep(300);
}

async function testSheet(browser) {
  section('13  Bulk: label sheets, mixed types, colours, the column editor');
  const { page, errors } = await open(browser, BU);
  const rows = Array.from({ length: 25 }, (_, i) => 'Table ' + (i + 1) + ',https://cafe.example/menu?t=' + (i + 1) + ',' + (i === 3 ? '#1a237e' : '') + ',' + (i === 0 ? 'Window seat' : ''));
  await bulkRun(page, 'name,url,colour,caption\n' + rows.join('\n'), 'url');
  await clickText(page, '.qr-actions button', /Label sheet/);
  const [pdf] = await downloads(page, 1, 120000);
  const walked = pdfWalk(pdf.bytes);
  const r1 = await page.evaluate(PDFJS_RENDER, Array.from(pdf.bytes), 1, 4);
  /* every cell of the A4 21-up grid, cut out and decoded: content in row order */
  const cells = await page.evaluate(() => {
    const c = window.__pdfCanvas, g = c.getContext('2d'), k = 4 * 72 / 25.4, out = [];
    for (let i = 0; i < 21; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const d = g.getImageData(Math.round((7.21 + col * (63.5 + 2.54)) * k), Math.round((15.15 + row * 38.1) * k), Math.round(63.5 * k), Math.round(38.1 * k));
      const got = window.QRDetect.scan(d); out.push(got ? got.text : null);
    }
    return out;
  });
  const want = Array.from({ length: 21 }, (_, i) => 'https://cafe.example/menu?t=' + (i + 1));
  check(!walked.errors.length && pdf.name === 'qr-labels.pdf' && r1.pages === 2 && Math.abs(r1.view[2] - 595.276) < 0.01 && Math.abs(r1.view[3] - 841.89) < 0.01 && JSON.stringify(cells) === JSON.stringify(want) && r1.images === 0,
    '25 codes on A4 21-up: 2 pages of 595.3 x 841.9 pt, every one of the 21 cells on page 1 decodes by pdf.js to its own row, in order, all vector', JSON.stringify(r1) + ' ' + JSON.stringify(cells.map((x, i) => x === want[i] ? 'ok' : x)));
  check(/Window seat/.test(r1.text) && /Table 2\b/.test(r1.text), 'the caption column is printed under its code, and the name under the others', r1.text.slice(0, 160));
  const r2 = await page.evaluate(PDFJS_RENDER, Array.from(pdf.bytes), 2, 4);
  const p2 = await page.evaluate(() => { const c = window.__pdfCanvas, g = c.getContext('2d'), k = 4 * 72 / 25.4; const got = window.QRDetect.scan(g.getImageData(Math.round((7.21 + 66.04 * 3) * 0), Math.round(15.15 * k), Math.round(63.5 * k), Math.round(38.1 * k))); return got && got.text; });
  check(r2.pages === 2 && /t=22$/.test(p2 || ''), 'page 2 starts with row 22', p2);
  const blue = await page.$$eval('.bulk-card .bulk-art svg', (l) => l.map((s) => /#1a237e/.test(s.outerHTML)));
  check(blue[3] === true && blue.filter(Boolean).length === 1, 'the colour column colours its own row only');
  /* a custom grid that does not fit is refused before anything is written */
  await page.evaluate(() => { document.querySelectorAll('.qr-panel').forEach((d) => { d.open = true; }); });
  await setField(page, '#qr-cols', '4');
  const sheetNote = await page.$eval('.qr-sheet-note', (e) => e.textContent);
  await clickText(page, '.qr-actions button', /Label sheet/);
  await sleep(500);
  const msg = await page.$eval('.qr-stage .io-msg', (e) => e.textContent);
  const n = await page.evaluate(() => window.__dl.length);
  check(/off the right of the page/.test(sheetNote) && /off the right/.test(msg) && n === 0 && await page.$eval('#qr-sheet', (s) => s.value) === 'custom', 'four 63.5 mm columns on A4 are refused with the reason, nothing is downloaded, the preset reads Custom', sheetNote + ' | ' + msg);
  await setField(page, '#qr-sheet', 'a4-65');
  const note65 = await page.$eval('.qr-sheet-note', (e) => e.textContent);
  check(/65 labels a sheet/.test(note65) && await page.$eval('#qr-cols', (e) => e.value) === '5', 'choosing a preset fills the grid fields', note65);
  /* a type column mixes content types */
  await bulkRun(page, 'type,url,ssid,pass,first,last,phone\nurl,https://example.com/a,,,,,\nwifi,,Rio Guest,flatwhite22,,,\nvcard,,,,Priya,Nair,+441189000111\nfax,,,,,,', 'url');
  const contents = await page.$$eval('.bulk-card .bulk-content', (l) => l.map((x) => x.textContent));
  const skipped = await page.$eval('.bulk-skipped', (e) => e.textContent).catch(() => '');
  const types = await page.evaluate(() => { const r = [...document.querySelectorAll('.qr-stage .stat-row')].find((x) => x.querySelector('.stat-key').textContent === 'Content types'); return r ? r.querySelector('.stat-val').textContent : ''; });
  check(contents.length === 3 && contents[0] === 'https://example.com/a' && /^WIFI:T:WPA;S:Rio Guest;P:flatwhite22;;$/.test(contents[1]) && /^BEGIN:VCARD/.test(contents[2]) && /unknown content type "fax"/.test(skipped) && /1 Website/.test(types),
    'one list with a type column gives a link, a Wi-Fi code and a contact card; the unknown type is listed with its reason', contents.join(' | ') + ' || ' + skipped + ' || ' + types);
  /* the column editor: a column changed by hand is used. A one-field type
     with no header reads each whole line (links can hold commas), so this
     list has a header row whose second name the tool does not know. */
  await bulkRun(page, 'url,shelf\nhttps://example.com/x,Shelf A\nhttps://example.com/y,Shelf B', 'url');
  const before = await page.$$eval('.bulk-card .bulk-name', (l) => l.map((x) => x.textContent));
  await page.evaluate(() => { document.querySelector('.bulk-columns').open = true; });
  await setField(page, '#qr-col-1', 'name');
  await page.waitForFunction(() => /Columns as you set them/.test(document.querySelector('.bulk-map').textContent), { timeout: 20000 });
  await page.waitForFunction(() => { const v = document.querySelector('.qr-stage .qr-verdict'); return v && /Verified/.test(v.textContent); }, { timeout: 60000 });
  const afterNames = await page.$$eval('.bulk-card .bulk-name', (l) => l.map((x) => x.textContent));
  check(afterNames.join() === 'shelf-a,shelf-b' && before.join() !== afterNames.join(), 'setting column 2 to File name in the editor renames the codes shelf-a and shelf-b', before.join() + ' -> ' + afterNames.join());
  check(errors.length === 0, 'bulk: no script errors', errors.join(' | '));
  await page.close();
}

async function testBulkFrames(browser) {
  section('17  Bulk: frame and label, per-row frame text');
  const { page, errors } = await open(browser, BU);
  await page.evaluate(() => { document.querySelectorAll('.qr-panel').forEach((d) => { d.open = true; }); });
  await setField(page, '#qr-frame', 'banner');
  await setField(page, '#qr-label', 'ACME CAFE');
  const list = 'name,url,frame text\nT1,https://cafe.example/menu?t=1,Table 1\nT2,https://cafe.example/menu?t=2,\nT3,https://cafe.example/menu?t=3,テーブル 3';
  await bulkRun(page, list, 'url');
  const verdict = await page.$eval('.qr-stage .qr-verdict', (e) => e.textContent);
  const arts = await page.$$eval('.bulk-card .bulk-art svg', (l) => l.map((s) => {
    const vb = s.getAttribute('viewBox').split(' ').map(Number);
    const t = s.querySelector(':scope > text');
    return { tall: vb[3] > vb[2], label: t ? t.textContent : null };
  }));
  check(/Verified: all 3 codes/.test(verdict) && arts.length === 3 && arts.every((a) => a.tall) &&
    arts[0].label === 'Table 1' && arts[1].label === 'ACME CAFE' && arts[2].label === 'テーブル 3',
    'every code is framed and read back; the frame text column labels its row and an empty cell falls back to the panel label', verdict.slice(0, 80) + ' ' + JSON.stringify(arts));
  check(/Helvetica/.test(verdict), 'a row label Helvetica cannot set is warned about for the PDF', verdict.slice(0, 200));
  await clickText(page, '.qr-actions button', /Label sheet/);
  const [pdf] = await downloads(page, 1, 120000);
  const r1 = await page.evaluate(PDFJS_RENDER, Array.from(pdf.bytes), 1, 4);
  const cells = await page.evaluate(() => {
    const c = window.__pdfCanvas, g = c.getContext('2d'), k = 4 * 72 / 25.4, out = [];
    for (let i = 0; i < 3; i++) {
      const d = g.getImageData(Math.round((7.21 + i * (63.5 + 2.54)) * k), Math.round(15.15 * k), Math.round(63.5 * k), Math.round(38.1 * k));
      const got = window.QRDetect.scan(d); out.push(got ? got.text : null);
    }
    return out;
  });
  check(JSON.stringify(cells) === JSON.stringify([1, 2, 3].map((n) => 'https://cafe.example/menu?t=' + n)) && /ACME CAFE/.test(r1.text) && /Table 1/.test(r1.text) && r1.images === 0,
    'the label sheet carries the framed codes as vector art: each cell decodes by pdf.js and the labels are text', JSON.stringify(cells) + ' ' + r1.text.slice(0, 120));
  await sleep(600);
  const stored = await page.evaluate(() => localStorage.getItem('1234tools-qr-bulk-v1') || '');
  check(/"qr-frame":"banner"/.test(stored) && /ACME CAFE/.test(stored) && !/cafe\.example/.test(stored), 'the frame and label are remembered; the list is not', stored.slice(0, 160));
  await setField(page, '#qr-frame', 'none');
  await page.waitForFunction(() => { const s = document.querySelector('.bulk-card .bulk-art svg'); return s && !s.querySelector(':scope > text'); }, { timeout: 30000 }).catch(() => {});
  const plain = await page.$$eval('.bulk-card .bulk-art svg', (l) => l.map((s) => !!s.querySelector(':scope > text')));
  check(plain.length === 3 && plain.every((x) => !x), 'with No frame chosen the frame text column adds nothing', JSON.stringify(plain));
  check(errors.length === 0, 'bulk frames: no script errors', errors.join(' | '));
  await page.close();
}

async function testTwoThousand(browser) {
  section('14  Bulk: 2,000 codes, the main thread, Cancel');
  const { page, errors } = await open(browser, BU);
  await page.evaluate(() => { window.__long = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask' }); });
  const t0 = Date.now();
  await page.evaluate(() => { window.__barSeen = false; const iv = setInterval(() => { const b = document.querySelector('.qr-stage .qr-progress'); if (b && !b.hidden) { window.__barSeen = true; } }, 50); window.__iv = iv; });
  await bulkRun(page, Array.from({ length: 2000 }, (_, i) => 'ASSET-' + String(i + 1).padStart(4, '0')).join('\n'), 'text');
  const secs = (Date.now() - t0) / 1000;
  const r = await page.evaluate(() => ({ long: window.__long.slice(), bar: window.__barSeen, v: document.querySelector('.qr-stage .qr-verdict-head').textContent }));
  const max = Math.max(0, ...r.long);
  check(/^Verified: all 2000 codes/.test(r.v), '2,000 codes are encoded and every one read back (' + secs.toFixed(0) + ' s here)', r.v);
  check(r.bar, 'a progress bar shows while they run');
  check(max <= 100, 'no main-thread task over 100 ms during the run (' + r.long.length + ' long tasks, longest ' + Math.round(max) + ' ms)', r.long.map(Math.round).join(','));
  await page.evaluate(() => { window.__long = []; });
  await clickText(page, '.qr-actions button', /Label sheet/);
  const [pdf] = await downloads(page, 1, 120000);
  const lp = await page.evaluate(() => Math.max(0, ...window.__long));
  const walked = pdfWalk(pdf.bytes);
  check(walked.pages.length === 96 && !walked.errors.length && lp <= 100, 'the 2,000-code label sheet is 96 pages, every object sound, no task over 100 ms while writing it (' + Math.round(pdf.bytes.length / 1024) + ' KB)', walked.pages.length + ' pages, longest task ' + Math.round(lp) + ' ms ' + walked.errors.slice(0, 3).join(';'));
  /* Cancel */
  await setField(page, '#qr-values', Array.from({ length: 1500 }, (_, i) => 'CANCEL-' + i).join('\n'));
  await clickText(page, '.tool-io button', /^Generate codes$/);
  await page.waitForFunction(() => { const b = document.querySelector('.qr-stage .qr-progress'); return b && !b.hidden && /Checking/.test(b.textContent); }, { timeout: 60000 });
  await page.click('.qr-stage .qr-progress-cancel');
  await sleep(800);
  const c = await page.evaluate(() => ({ sum: document.querySelector('.bulk-summary').textContent, btn: [...document.querySelectorAll('.qr-actions button')].filter((b) => /ZIP|Label/.test(b.textContent) || /checked/.test(b.textContent)).map((b) => b.disabled + ':' + b.textContent), unchecked: document.querySelectorAll('.bulk-card.is-unchecked').length }));
  check(/^Cancelled: \d+ of 1500 checked/.test(c.sum) && c.btn.length >= 3 && c.btn.every((b) => /^true:/.test(b)), 'Cancel stops the check where it is, says how far it got, and the downloads stay shut', JSON.stringify(c));
  check(errors.length === 0, '2,000: no script errors', errors.join(' | '));
  await page.close();
}

async function testScanner(browser) {
  section('15  Scanner: barcodes, several codes, batches, history, screen share');
  const { page, errors, requests } = await open(browser, SC, { noDetector: true });
  const native = await page.evaluate(() => 'BarcodeDetector' in window);
  check(!native, 'BarcodeDetector is taken away, so every read here is the site\'s own');
  /* one picture: two QR codes and four linear barcodes, drawn in the page from the bits made here */
  const symbols = { ean: ean13Bits('590123412345'), upc: ean13Bits('003600029145'), c128: c128Bits(c128B('BOX-0042')), c39: c39Bits('BIN 7') };
  const png = Buffer.from(await page.evaluate(async (S) => {
    const c = document.createElement('canvas'); c.width = 1300; c.height = 980;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    for (const [t, x] of [['https://one.example.com/', 40], ['SECOND CODE 2', 380]]) {
      const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.QR.toSVG(window.QR.encode(t, 'M'), { scale: 8, quiet: 4 })); await im.decode();
      g.drawImage(im, x, 30, 280, 280);
    }
    g.fillStyle = '#000';
    let y = 360;
    for (const k of ['ean', 'upc', 'c128', 'c39']) { const b = S[k]; for (let i = 0; i < b.length; i++) if (b[i] === '1') g.fillRect(60 + i * 3, y, 3, 120); y += 150; }
    return c.toDataURL('image/png').split(',')[1];
  }, symbols), 'base64');
  const f1 = path.join(OUT, 'six-codes.png'); fs.writeFileSync(f1, png);
  const input = async () => { const l = await page.$$('.tool-io input[type=file]'); return l[l.length - 1]; };
  await (await input()).uploadFile(f1);
  await page.waitForSelector('.scan-card', { timeout: 30000 });
  await sleep(500);
  const cards = await page.$$eval('.scan-card', (l) => l.map((k) => ({ kind: k.querySelector('.scan-kind').textContent, head: k.querySelector('.scan-headline').textContent, text: k.querySelector('.scan-text').textContent, meta: (k.querySelector('.scan-meta') || {}).textContent || '' })));
  const texts = cards.map((x) => x.text).sort();
  check(texts.join('|') === ['036000291452', '5901234123457', 'BIN 7', 'BOX-0042', 'SECOND CODE 2', 'https://one.example.com/'].sort().join('|'),
    'one picture with two QR codes, an EAN-13, a UPC-A, a Code 128 and a Code 39 gives six results', texts.join(' | '));
  const ean = cards.find((x) => x.text === '5901234123457') || {};
  check(/Product barcode · EAN-13/.test(ean.kind) && /EAN-13 · read with this site’s own reader/.test(ean.meta), 'an EAN-13 is named as a product barcode, read by the site\'s own reader', JSON.stringify(ean));
  const checkDigit = await page.evaluate(() => { const k = [...document.querySelectorAll('.scan-card')].find((x) => x.querySelector('.scan-text').textContent === '5901234123457'); return k ? k.querySelector('.scan-facts').textContent : ''; });
  check(/Check digit\s*Correct/.test(checkDigit), 'its check digit is reported as correct', checkDigit);
  /* a book: the ISBN-10 printed in Penguin's 2008 Nineteen Eighty-Four is 0141036141 */
  const isbnPic = path.join(OUT, 'isbn.png');
  fs.writeFileSync(isbnPic, pngOf(360, 100, (x, y) => { const b = ean13Bits('978014103614'), i = Math.floor((x - 30) / 3); return y > 10 && y < 90 && i >= 0 && i < b.length && b[i] === '1' ? [0, 0, 0] : [255, 255, 255]; }));
  await (await input()).uploadFile(isbnPic);
  await page.waitForFunction(() => [...document.querySelectorAll('.scan-card .scan-text')].some((e) => e.textContent === '9780141036144'), { timeout: 30000 }).catch(() => {});
  const isbnFacts = await page.evaluate(() => { const k = [...document.querySelectorAll('.scan-card')].find((x) => x.querySelector('.scan-text').textContent === '9780141036144'); return k ? k.querySelector('.scan-kind').textContent + ' | ' + k.querySelector('.scan-facts').textContent : ''; });
  check(/^Book number \(ISBN\)/.test(isbnFacts) && /ISBN-13\s*9780141036144/.test(isbnFacts) && /ISBN-10\s*0141036141/.test(isbnFacts), 'a 978 EAN-13 is named a book number, with its ISBN-13 and the ten-digit ISBN printed in the book', isbnFacts);
  check(requests.some((u) => /\/engine\/qr-scan-worker\.js$/.test(u)), 'the picture was searched in the worker (engine/qr-scan-worker.js was fetched)');
  /* a batch */
  const blank = path.join(OUT, 'blank.png'); fs.writeFileSync(blank, pngOf(30, 30, () => [255, 255, 255]));
  const txt = path.join(OUT, 'notes.txt'); fs.writeFileSync(txt, 'not a picture');
  const ean8 = path.join(OUT, 'ean8.png');
  fs.writeFileSync(ean8, pngOf(260, 90, (x, y) => { const b = ean8Bits('9638507'), i = Math.floor((x - 30) / 3); return y > 10 && y < 80 && i >= 0 && i < b.length && b[i] === '1' ? [0, 0, 0] : [255, 255, 255]; }));
  await (await input()).uploadFile(f1, txt, blank, ean8);
  await page.waitForFunction(() => { const s = document.querySelector('.scan-batch-sum'); return s && s.textContent; }, { timeout: 60000 });
  const sum = await page.$eval('.scan-batch-sum', (e) => e.textContent);
  await page.evaluate(() => { window.__dl = []; });
  await clickText(page, '.scan-batch button', /CSV/);
  const [csv] = await downloads(page);
  const lines = csv.bytes.toString('utf8').replace(/^\ufeff/, '').trim().split('\r\n');
  check(/^7 codes read from 2 of 4 pictures; 2 gave nothing/.test(sum) && lines.length === 1 + 6 + 1 + 2 && lines.some((l) => l === 'notes.txt,,,,not an image') && lines.some((l) => l === 'blank.png,,,,no code found') &&
    lines.some((l) => /^ean8\.png,EAN-8,.*,96385074,$/.test(l)) && csv.name === 'scanned-codes.csv' && /csv/.test(csv.type),
    'four files: six codes from one, one from another, a text file and a blank picture each named with the reason; the CSV has a row for each', sum + ' || ' + lines.join(' / '));
  /* the history, on the device */
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('1234tools-qr-scan-history-v1') || '[]').length);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.scan-history-list', { timeout: 15000 });
  const listed = await page.$$eval('.scan-history-list li', (l) => l.length);
  check(stored >= 7 && listed === stored, 'the scans are kept on the device and listed again after a reload (' + listed + ')', stored + ' / ' + listed);
  await page.click('#scan-keep');
  await sleep(200);
  const off = await page.evaluate(() => ({ scans: localStorage.getItem('1234tools-qr-scan-history-v1'), prefs: localStorage.getItem('1234tools-qr-scanner-v1') }));
  check(off.scans === null && /"keep":false/.test(off.prefs || ''), 'turning the history off empties it and remembers the choice', JSON.stringify(off));
  await page.click('#scan-keep');
  await (await input()).uploadFile(ean8);
  await page.waitForSelector('.scan-card', { timeout: 20000 });
  await sleep(300);
  await clickText(page, '.scan-history button', /^Clear history$/);
  const cleared = await page.evaluate(() => ({ s: localStorage.getItem('1234tools-qr-scan-history-v1'), n: document.querySelectorAll('.scan-history-list li').length }));
  check(cleared.s === null && cleared.n === 0, 'Clear history empties the list and the stored copy', JSON.stringify(cleared));
  /* the formats line, with no detector */
  const fm = await page.$eval('.scan-formats', (e) => e.textContent);
  check(/QR code, EAN-13, EAN-8, UPC-A, Code 128, Code 39 and ITF with this site’s own readers/.test(fm) && /Data Matrix/.test(fm) && /this browser has none/.test(fm), 'the page says which formats it reads itself and which need a built-in detector', fm);
  check(errors.length === 0, 'scanner: no script errors', errors.join(' | '));
  await page.close();

  /* screen share: getDisplayMedia answered with a canvas stream showing a code */
  const t = await newPage(browser, { noDetector: true });
  await t.page.evaluateOnNewDocument(() => {
    navigator.mediaDevices.getDisplayMedia = async function () {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1280, 720);
      const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.QR.toSVG(window.QR.encode('FROM THE SCREEN 9', 'M'), { scale: 8, quiet: 4 })); await im.decode();
      g.drawImage(im, 900, 400, 220, 220);
      const s = c.captureStream(10);
      window.__screenTrack = s.getVideoTracks()[0];
      setInterval(() => { g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); }, 100);       // keep frames coming
      return s;
    };
  });
  await t.page.goto(BASE_URL + SC, { waitUntil: 'load' });
  await t.page.waitForSelector('button[data-act=screen]');
  const visible = await t.page.$eval('button[data-act=screen]', (b) => !b.hidden);
  await t.page.click('button[data-act=screen]');
  await t.page.waitForSelector('.scan-card', { timeout: 20000 }).catch(() => {});
  const sr = await t.page.evaluate(() => ({ kind: (document.querySelector('.scan-kind') || {}).textContent, text: (document.querySelector('.scan-text') || {}).textContent, ended: window.__screenTrack && window.__screenTrack.readyState }));
  check(visible && sr.text === 'FROM THE SCREEN 9' && /from your screen/.test(sr.kind || '') && sr.ended === 'ended', 'Scan from screen reads the code in the shared screen, says so, and stops sharing once it has read', JSON.stringify(sr));
  check(t.errors.length === 0, 'screen share: no script errors', t.errors.join(' | '));
  await t.page.close();
}

async function testLayout(browser) {
  section('16  Layout: 390 and 1400 px, both themes, keyboard');
  for (const url of [G, BU, SC]) {
    for (const width of [390, 1400]) {
      for (const theme of ['dark', 'light']) {
        const t = await newPage(browser, { width });
        await t.page.evaluateOnNewDocument((th) => { try { localStorage.setItem('1234tools-theme', th); } catch (e) { /* */ } }, theme);
        await t.page.goto(BASE_URL + url, { waitUntil: 'load' });
        await t.page.evaluate((th) => { document.documentElement.dataset.theme = th; const b = document.querySelector('.cc'); if (b) b.remove(); document.querySelectorAll('.qr-panel').forEach((d) => { d.open = true; }); }, theme);
        await sleep(1200);
        const r = await t.page.evaluate(() => {
          const wide = document.documentElement.scrollWidth - window.innerWidth;
          const io = document.querySelector('.tool-io');
          const controls = [...io.querySelectorAll('button, input, select, textarea, summary, label[for]')].filter((e) => e.offsetParent !== null && !(e.type === 'file') && !e.closest('[hidden]'));
          const unreachable = controls.filter((e) => e.tabIndex < 0 && !/^LABEL$/.test(e.tagName)).map((e) => e.tagName + '.' + e.className);
          return { wide, n: controls.length, unreachable };
        });
        check(r.wide <= 0 && r.unreachable.length === 0 && t.errors.length === 0, url + ' ' + width + ' px ' + theme + ': no sideways scroll, all ' + r.n + ' visible controls in the Tab order, no errors', JSON.stringify(r) + ' ' + t.errors.join(' | '));
        if (width === 390) await t.page.screenshot({ path: path.join(OUT, url.split('/')[2] + '-' + width + '-' + theme + '.png'), fullPage: true });
        await t.page.close();
      }
    }
  }
  /* Tab really lands on the new controls */
  const t = await newPage(browser, { width: 1400 });
  await t.page.goto(BASE_URL + G, { waitUntil: 'load' });
  /* the angle shows for a linear gradient, the label for a frame and the
     logo size once there is a logo, so those are chosen first */
  await setField(t.page, '#qr-fill', 'linear');
  await setField(t.page, '#qr-frame', 'bubble');
  const tabLogo = path.join(OUT, 'tab-logo.png'); fs.writeFileSync(tabLogo, pngOf(40, 40, (x, y) => (x > 10 && x < 30 && y > 10 && y < 30 ? [26, 35, 126] : [255, 255, 255])));
  await (await t.page.$('#qr-logo')).uploadFile(tabLogo);
  await t.page.waitForFunction(() => !document.querySelector('#qr-logosize').closest('.field').hidden, { timeout: 10000 });
  await t.page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); document.querySelectorAll('.qr-panel').forEach((d) => { d.open = true; }); document.querySelector('#qr-type').focus(); });
  const seen = new Set();
  for (let k = 0; k < 160; k++) { await t.page.keyboard.press('Tab'); const id = await t.page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.textContent.trim().slice(0, 30))); seen.add(id); }
  const need = ['qr-angle', 'qr-logosize', 'qr-size', 'qr-dpi', 'qr-frame', 'qr-label', 'Save this design', 'Download PDF', 'Download EPS'];
  const missed = need.filter((n) => !seen.has(n));
  check(!missed.length, 'Tab reaches the angle and logo sliders, PNG width, resolution, frame, label, Save this design and the PDF and EPS downloads', missed.join(', '));
  await t.page.close();
}

(async () => {
  try {
    await nodePart();
    nodePart2();
    if (!NODE_ONLY) await browserPart();
  } catch (e) {
    console.error('\nthe run broke: ' + (e && e.stack || e));
    process.exit(1);
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (skipped ? ', ' + skipped + ' skipped' : ''));
  process.exit(fail ? 2 : 0);
})();
