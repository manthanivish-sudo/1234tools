#!/usr/bin/env node
/**
 * After build-pdf-ship.js, put back what only the release's post-processors
 * add to a PDF tool page, on the PDF pages and nowhere else.
 *
 *   node build/pdf-package/refresh-pages.js [--total 1,283] [--pdf-count 22] [--check]
 *
 * build-pdf-ship.js writes a tool page from its spec and moves the site
 * total and the PDF count on every page of the site. On a branch that is
 * reviewed before a release, that is the wrong shape: the totals belong to
 * the release (build/totals.js and build-sidebar.js recount them from the
 * search index), and the "learn more" block belongs to build-depth.js. This
 * puts the depth block on every PDF page from build/content/pdf.js (with
 * build-depth.js's own pure apply(), and the hub through build-hubs.js's), and sets the total and the PDF count
 * on the PDF pages back to the figure the rest of the branch still shows,
 * and the PDF count to the hub card count, until the release recounts.
 * It writes only pdf/<slug>/index.html and pdf/index.html.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const CHECK = argv.includes('--check');

const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const TOTAL = arg('--total') || (/<small>([\d,]+)\+ free tools<\/small>/.exec(home) || [])[1];
/* the PDF count is the hub's own number of cards (test_pdftools holds the
   two equal); only the site total waits for the release to recount it */
const hub = fs.readFileSync(path.join(ROOT, 'pdf', 'index.html'), 'utf8');
const PDFN = arg('--pdf-count') || String((hub.match(/<a class="card" href="\/pdf\/[a-z0-9-]+\/"/g) || []).length || '');
if (!TOTAL || !PDFN) throw new Error('could not read the site total or the PDF count from index.html');

const depth = require(path.join(ROOT, 'build-depth.js'));
/* the hub's intro, starters and card decorations are build-hubs.js's, also a pure apply() */
const hubs = require(path.join(ROOT, 'build-hubs.js'));

const pages = [path.join(ROOT, 'pdf', 'index.html')];
for (const d of fs.readdirSync(path.join(ROOT, 'pdf'), { withFileTypes: true })) {
  if (d.isDirectory() && fs.existsSync(path.join(ROOT, 'pdf', d.name, 'index.html'))) pages.push(path.join(ROOT, 'pdf', d.name, 'index.html'));
}

let changed = 0;
for (const abs of pages) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  const before = fs.readFileSync(abs, 'utf8');
  let html = before
    .replace(/<small>[\d,]+\+ free tools<\/small>/g, '<small>' + TOTAL + '+ free tools</small>')
    .replace(/Search [\d,]+ tools…/g, 'Search ' + TOTAL + ' tools…')
    .replace(/<span>All [\d,]+ tools<\/span>/g, '<span>All ' + TOTAL + ' tools</span>')
    .replace(/[\d,]+\+ free calculators and converters/g, TOTAL + '+ free calculators and converters')
    .replace(/(<span class="side-name">All tools<\/span><span class="side-count">)[\d,]+(<\/span>)/g, '$1' + TOTAL + '$2')
    .replace(/(<span class="side-name">PDF Tools<\/span><span class="side-count">)\d+(<\/span>)/g, '$1' + PDFN + '$2');
  html = depth.apply(html, rel);
  if (rel === 'pdf/index.html') html = hubs.apply(html, rel);
  if (html !== before) {
    changed++;
    if (!CHECK) fs.writeFileSync(abs, html);
    console.log((CHECK ? 'would update ' : 'updated ') + rel);
  }
}
console.log(changed + ' page(s) ' + (CHECK ? 'would change' : 'changed') + '; total ' + TOTAL + ', PDF count ' + PDFN);
