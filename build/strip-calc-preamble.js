#!/usr/bin/env node
/**
 * Strip the unused shared preamble from the calculator engines.
 *
 *   node build/strip-calc-preamble.js            apply
 *   node build/strip-calc-preamble.js --check    report what would change, write nothing
 *   node build/strip-calc-preamble.js --root DIR the site to work on (default: this one)
 *
 * Most engine/calc-*.js files were generated from one template and begin
 * with the same block, about 133 lines: the UK tax tables (UK_TAX), a GBP
 * formatter (fmtC), the Indian income tax tables (IN_TAX), the GST slabs
 * (GST_SLABS), an INR formatter (fmtR), slabTax, surchargeRate and
 * countWeekdays. Most calculators use none of it, and every visitor
 * downloads and parses it anyway.
 *
 * For each file that opens with that block (it starts at "UK tax tables"
 * right after the "(function(){" line and ends with the countWeekdays
 * function), the top-level names the block declares are listed, and the
 * rest of the file is searched for each of them as a whole word. If none
 * is found, the block is removed, with the blank lines after it. If any one
 * is found, the whole block is kept: it is never trimmed in part, because
 * its pieces lean on each other (IN_TAX['2025-26'] copies IN_TAX['2026-27']).
 * A name that only appears in a comment or a string still counts as used,
 * which can only ever keep a block that could have gone, never remove one
 * that is needed.
 *
 * build/tests/calc-preamble.js proves the result: every engine before and
 * after, run in a vm as build/content/_engine.js runs it, gives the same
 * compute() results on the inputs build/tests/engines.js uses and on each
 * page's example and worked-example values.
 *
 * Inert on require: require('./build/strip-calc-preamble.js') returns
 * { findPreamble, analyse, strip, run } and touches nothing.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OPEN = '(function(){\n';
const START = '/* ---------- UK tax tables ----------';
const LAST_FN = '\nfunction countWeekdays(';

/** The preamble's [start, end) in src, or null when the file does not open with it. */
function findPreamble(src) {
  if (!src.startsWith(OPEN + START)) return null;
  const start = OPEN.length;
  const fn = src.indexOf(LAST_FN, start);
  if (fn < 0) return null;
  const close = src.indexOf('\n}\n', fn);              // the end of countWeekdays, at column 0
  if (close < 0) return null;
  let end = close + 3;
  while (src[end] === '\n') end++;                     // and the blank lines after it
  return { start, end };
}

/** The names a block declares at its top level: const/let/var X and function X. */
function declaredNames(block) {
  const names = new Set();
  const re = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)|^function\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(block))) names.add(m[1] || m[2]);
  return [...names];
}

const escapeRe = (s) => s.replace(/[$]/g, '\\$');

/** What would happen to one file: { has, names, used, remove }. */
function analyse(src) {
  const p = findPreamble(src);
  if (!p) return { has: false, names: [], used: [], remove: false };
  const block = src.slice(p.start, p.end);
  const rest = src.slice(0, p.start) + src.slice(p.end);
  const names = declaredNames(block);
  const used = names.filter((n) => new RegExp('(^|[^\\w$])' + escapeRe(n) + '(?![\\w$])').test(rest));
  return { has: true, names, used, remove: used.length === 0, start: p.start, end: p.end, lines: block.split('\n').length - 1 };
}

/** The file without its preamble, when it can go; otherwise the file unchanged. */
function strip(src) {
  const a = analyse(src);
  return a.remove ? src.slice(0, a.start) + src.slice(a.end) : src;
}

/** Every engine/calc-*.js under root: what changed (or would). */
function run(root, write) {
  const dir = path.join(root, 'engine');
  const files = fs.readdirSync(dir).filter((f) => /^calc-.*\.js$/.test(f)).sort();
  const report = { files: files.length, withPreamble: 0, removed: [], kept: [], without: [], bytesSaved: 0, linesSaved: 0 };
  for (const f of files) {
    const abs = path.join(dir, f);
    const src = fs.readFileSync(abs, 'utf8');
    const a = analyse(src);
    if (!a.has) { report.without.push(f); continue; }
    report.withPreamble++;
    if (!a.remove) { report.kept.push({ file: f, used: a.used }); continue; }
    const out = strip(src);
    report.removed.push(f);
    report.bytesSaved += Buffer.byteLength(src) - Buffer.byteLength(out);
    report.linesSaved += a.lines;
    if (write) fs.writeFileSync(abs, out);
  }
  return report;
}

module.exports = { findPreamble, declaredNames, analyse, strip, run };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--root');
  const root = path.resolve(i >= 0 && argv[i + 1] ? argv[i + 1] : path.join(__dirname, '..'));
  const CHECK = argv.includes('--check');
  const r = run(root, !CHECK);
  console.log('strip-calc-preamble.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  calculator engines   ' + r.files);
  console.log('  with the preamble    ' + r.withPreamble);
  console.log('  ' + (CHECK ? 'would remove' : 'removed') + '         ' + r.removed.length + ' (' + r.linesSaved + ' lines, ' + r.bytesSaved + ' bytes)');
  r.kept.forEach((k) => console.log('  kept                 ' + k.file + ': uses ' + k.used.join(', ')));
  if (r.without.length) console.log('  without it           ' + r.without.join(', '));
}
