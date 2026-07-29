#!/usr/bin/env node
/**
 * Self-check for the PDF package.
 *
 * Confirms every file the tools reference is actually present, then exercises
 * the engine end to end without needing any fixtures. Run this first — it
 * fails loudly if something did not make it into the package.
 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

let problems = 0;
const need = (rel, why) => {
  const ok = fs.existsSync(path.join(ROOT, rel));
  console.log(`  ${ok ? 'OK ' : 'MISSING'}  ${rel.padEnd(30)} ${why}`);
  if (!ok) problems++;
};

console.log('\nFiles\n');
need('engine/pdfcore.js',      'parser, writer, page operations');
need('engine/pdftools.js',     '16 tool specs');
need('engine/render-pdf.js',   'browser UI');
need('engine/zip.js',          'multi-file downloads (window.MVRZip)');
need('assets/pdf-icons.svg',   '18 icon symbols to merge');
need('assets/pdf-styles.css',  'CSS to append to app.css');
need('tests/test_pdfcore.js',  'engine suite, 304 assertions');
need('tests/test_pdftools.js', 'tool suite, 664 assertions');
need('tests/make-fixtures.py', 'generates the test fixtures');
need('INTEGRATION.md',         'drop-in guide');

console.log('\nEngine\n');
const core = require(path.join(ROOT, 'engine/pdfcore.js'));
const { PDF_TOOLS } = require(path.join(ROOT, 'engine/pdftools.js'));

const check = (label, fn) => {
  try {
    const r = fn();
    console.log(`  OK      ${label.padEnd(42)} ${r === undefined ? '' : r}`);
  } catch (e) {
    console.log(`  FAILED  ${label.padEnd(42)} ${e.message}`);
    problems++;
  }
};

check('16 tool specs exported', () => {
  const n = Object.keys(PDF_TOOLS).length;
  if (n !== 16) throw new Error(`found ${n}`);
  return `${n} tools`;
});

check('every spec has a run() or needs the renderer', () => {
  for (const [id, s] of Object.entries(PDF_TOOLS)) {
    if (s.kind === 'render') { if (!s.needsRenderer) throw new Error(`${id} missing needsRenderer`); }
    else if (typeof s.run !== 'function') throw new Error(`${id} has no run()`);
  }
});

check('every core.* the specs call is exported', () => {
  const src = fs.readFileSync(path.join(ROOT, 'engine/pdftools.js'), 'utf8');
  const used = [...new Set([...src.matchAll(/core\.([A-Za-z_]+)/g)].map(m => m[1]))];
  const missing = used.filter(k => core[k] === undefined);
  if (missing.length) throw new Error('not exported: ' + missing.join(', '));
  return used.length + ' used, all present';
});

check('writer produces a valid PDF', () => {
  const pdf = core.createPDF([{ ops: [
    { text: 'Package verification', x: 72, y: 720, size: 22, font: 'Helvetica-Bold' },
    { rect: [72, 690, 220, 5], fill: '#f7c948' },
    { text: 'Centred line', x: 297, y: 640, size: 12, align: 'center' }
  ]}], { info: { Title: 'Verify' } });
  const s = core.latin1(pdf);
  if (!s.startsWith('%PDF-')) throw new Error('no PDF header');
  if (!s.trimEnd().endsWith('%%EOF')) throw new Error('no EOF marker');
  const m = s.match(/startxref\s+(\d+)/);
  if (!m || s.slice(Number(m[1]), Number(m[1]) + 4) !== 'xref') throw new Error('startxref does not point at the xref table');
  return pdf.length + ' bytes';
});

(async () => {
  try {
    const pdf = core.createPDF([{ ops: [{ text: 'A', x: 72, y: 700, size: 12 }] },
                               { ops: [{ text: 'B', x: 72, y: 700, size: 12 }] }], {});
    const doc = await core.PDFDocument.load(pdf);
    const n = await doc.pageCount();
    if (n !== 2) throw new Error(`parsed ${n} pages, expected 2`);
    console.log(`  OK      ${'round trip: write then parse'.padEnd(42)} 2 pages`);

    const merged = await core.assemble([{ doc, pageIndex: 1 }, { doc, pageIndex: 0 }], {});
    const re = await core.PDFDocument.load(merged);
    if (await re.pageCount() !== 2) throw new Error('reorder lost a page');
    console.log(`  OK      ${'reorder pages'.padEnd(42)} reversed cleanly`);

    // WinAnsi: the bug that made every smart quote a question mark
    const esc = core.contentEscape('\u2018q\u2019 \u2014 \u2026 \u20ac');
    if (esc.includes('?')) throw new Error('WinAnsi mapping lost characters: ' + esc);
    console.log(`  OK      ${'WinAnsi typographic characters'.padEnd(42)} ${JSON.stringify(esc)}`);

    console.log(`\n${problems ? problems + ' PROBLEM(S) FOUND' : 'Package is complete and the engine works.'}\n`);
    if (!fs.existsSync(path.join(ROOT, 'tests/fixtures'))) {
      console.log('Next: python3 tests/make-fixtures.py   then   node tests/test_pdfcore.js\n');
    }
    process.exit(problems ? 1 : 0);
  } catch (e) {
    console.log(`  FAILED  round trip: ${e.message}`);
    process.exit(1);
  }
})();
