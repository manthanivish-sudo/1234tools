#!/usr/bin/env node
/**
 * Keep build/pdf-package/engine/pdftools.js's copies of the shipped specs in
 * step with engine/pdf-<id>.js.
 *
 *   node build/pdf-package/sync-pdftools.js           rewrite the copies
 *   node build/pdf-package/sync-pdftools.js --check   exit 1 if any copy differs
 *
 * pdftools.js is the package's own copy of most specs (the disabled
 * build-pdf.js read it, and it still holds the drafts that never shipped).
 * test_pdftools.js fails when a copy drifts from what ships, which is right,
 * but the shipped file is the one people edit. This copies each shipped
 * spec's object literal over its entry, text for text, so the two compare
 * equal key by key. A spec that uses a helper pdftools.js does not define
 * is reported rather than copied.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PKG = path.join(__dirname, 'engine', 'pdftools.js');
const CHECK = process.argv.includes('--check');

function literalOf(id) {
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'pdf-' + id + '.js'), 'utf8');
  const head = 'window.PDF_TOOLS[' + JSON.stringify(id) + '] = ';
  const a = src.indexOf(head);
  const b = src.lastIndexOf('\n};');
  if (a < 0 || b < a) return null;
  return src.slice(a + head.length, b + 2);
}

let text = fs.readFileSync(PKG, 'utf8');
const entry = /\n {2}'([a-z0-9-]+)': \{/g;
const starts = [];
let m;
while ((m = entry.exec(text))) starts.push({ id: m[1], at: m.index + 1 });
const close = text.indexOf('\n};', starts.length ? starts[starts.length - 1].at : 0);

const changed = [], missing = [];
for (let i = starts.length - 1; i >= 0; i--) {
  const { id, at } = starts[i];
  if (!fs.existsSync(path.join(ROOT, 'engine', 'pdf-' + id + '.js'))) continue;
  const lit = literalOf(id);
  if (!lit) { missing.push(id); continue; }
  const end = i + 1 < starts.length ? starts[i + 1].at : close + 1;
  const now = text.slice(at, end);
  const next = '  ' + JSON.stringify(id).replace(/"/g, "'") + ': ' + lit + ',\n\n';
  if (now.replace(/\s+/g, ' ').trim() === next.replace(/\s+/g, ' ').trim()) continue;
  changed.push(id);
  text = text.slice(0, at) + next + text.slice(end);
}
/* the object's last entry must not leave ",\n\n};" behind */
text = text.replace(/,\n\n(\};\n)/, '\n$1');

if (CHECK) {
  console.log(changed.length ? 'out of step: ' + changed.join(', ') : 'pdftools.js copies match the shipped specs');
  process.exit(changed.length ? 1 : 0);
}
if (changed.length) fs.writeFileSync(PKG, text);
console.log((changed.length ? 'copied ' + changed.reverse().join(', ') : 'nothing to copy') + (missing.length ? '; could not read ' + missing.join(', ') : ''));
/* a copy must still load */
const box = require(PKG);
if (!box.PDF_TOOLS) throw new Error('pdftools.js no longer loads');
