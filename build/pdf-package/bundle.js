#!/usr/bin/env node
/**
 * engine/pdfcore.bundle.js from its sources.
 *
 *   node build/pdf-package/bundle.js           write it
 *   node build/pdf-package/bundle.js --check   exit 1 if it is out of date
 *
 * The bundle is what every PDF page and the PDF worker load. It used to be
 * written by build-pdf.js, which now refuses to run (it predates the
 * /pdf/<slug>/ URLs), so it was kept in step with engine/pdfcore.js by hand.
 * This writes it from the module sources instead: pdfcore.js, then the
 * security handler (pdfcrypt.js) and the TrueType embedder (pdffont.js)
 * when they are present. Each source ends in a CommonJS export block that
 * begins `if (typeof module`; everything from there on is dropped, and the
 * whole lot is wrapped in one function so nothing leaks into the page.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ENGINE = path.join(__dirname, 'engine');
const OUT = path.join(__dirname, '..', '..', 'engine', 'pdfcore.bundle.js');

/* what the pages and the worker may call, in the order they are listed */
const EXPORTS = [
  'PDFDocument', 'assemble', 'pageFrame', 'parsePageRange', 'createPDF', 'textWidth',
  'wrapText', 'contentEscape', 'PAGE_SIZES', 'FONTS', 'latin1', 'isDict', 'isName',
  /* added for the worker, compression, protection, images and Unicode text */
  'setProgress', 'setPreview', 'PDFWriter', 'PDFStream', 'Name', 'Ref', 'pdfString',
  'decodePdfString', 'bytesOf', 'isRef', 'inflate', 'deflate', 'copyObject',
  'prepareImage', 'compressDocument', 'protectDocument', 'flattenDocument',
  'cropDocument', 'unicodeFonts', 'textRun', 'createDocument', 'TextFonts', 'compactBuild'
];

function strip(src) {
  const at = src.search(/^if \(typeof module !== 'undefined'/m);
  return at < 0 ? src : src.slice(0, at);
}

function build() {
  /* an explicit list: a module joins the bundle when the engine uses it */
  const parts = ['pdfcore.js', 'pdfcrypt.js', 'pdffont.js'];
  /* the font and crypto modules sit before pdfcore, which refers to them */
  const order = parts.filter((f) => f !== 'pdfcore.js').concat(['pdfcore.js']);
  let body = '';
  for (const f of order) body += strip(fs.readFileSync(path.join(ENGINE, f), 'utf8')) + '\n';
  const names = EXPORTS.filter((n) => new RegExp('(?:^|\\n)(?:async\\s+)?(?:function|class|const|let)\\s+' + n + '\\b').test(body));
  return '(function(){\n' + body +
    '\nwindow.MVRPdfCore={' + names.map((n) => n + ':' + n).join(',') + '};\n})();';
}

/** The bundle must load as the pages load it, or nothing on /pdf/ works: a
    syntax error in one module (a regex the browser rejects) would otherwise
    ship silently. */
function verify(src) {
  const w = {};
  new Function('window', src)(w);
  const missing = ['PDFDocument', 'assemble', 'createPDF'].filter((n) => !w.MVRPdfCore || typeof w.MVRPdfCore[n] !== 'function');
  if (missing.length) throw new Error('the bundle loads but lacks ' + missing.join(', '));
}

if (require.main === module) {
  const next = build();
  try { verify(next); }
  catch (e) { console.error('engine/pdfcore.bundle.js NOT written: ' + e.message); process.exit(1); }
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (process.argv.includes('--check')) {
    if (now !== next) { console.log('engine/pdfcore.bundle.js is out of date: run node build/pdf-package/bundle.js'); process.exit(1); }
    console.log('engine/pdfcore.bundle.js is up to date');
  } else if (now === next) console.log('engine/pdfcore.bundle.js unchanged');
  else { fs.writeFileSync(OUT, next); console.log('engine/pdfcore.bundle.js written (' + next.length + ' bytes)'); }
}
module.exports = { build };
