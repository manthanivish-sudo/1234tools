/**
 * The sidebar, generated rather than hand-kept.
 *
 *   node build-sidebar.js          apply
 *   node build-sidebar.js --check  report what would change, write nothing
 *
 * It was the same eight kilobytes of HTML repeated on 1,315 pages, which
 * is fine until the order is wrong — and the order was wrong. Conversions
 * came first and largest, so the first thing a visitor learned was that
 * this is a unit-conversion site; the twelve conversion families sat flat
 * at the bottom adding a dozen rows of noise to every page; and the two
 * sections the site is actually differentiated by, Business and AI, were
 * eleventh and eighteenth.
 *
 * So: one canonical sidebar, built from the section registry with the
 * counts read out of the search index, written to every page. The order
 * is declared here, once. The conversion families fold into a disclosure
 * under their parent — still in the HTML, still crawlable, no longer
 * twelve rows of furniture on a page about payroll.
 *
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { SECTIONS } = require('./build/sections.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (id) => '<svg class="ico" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + id + '"></use></svg>';

const changes = [];

/* The order a visitor should meet them in: what the site is for first,
   the general-purpose sections next, the long tail last. A section with
   one tool still earns a row — it is a promise about what is coming — but
   it earns it near the bottom. */
const ORDER = [
  ['/business/', 'i-business'],
  ['/ai/', 'i-ai'],
  ['/pdf/', 'i-pdf'],
  ['/education/', 'i-education'],
  ['/india/', 'i-india'],
  ['/developer/', 'i-developer'],
  ['/image/', 'i-image'],
  ['/text/', 'i-text'],
  ['/mathematics/', 'i-mathematics'],
  ['/finance/', 'i-finance'],
  ['/time/', 'i-time'],
  ['/health/', 'i-health'],
  ['/qr/', 'i-qr'],
  ['/utilities/', 'i-utilities'],
  ['/engineering/', 'i-engineering'],
  ['/design/', 'i-design']
];
const FAMILIES = [
  ['/conversions/length/', 'i-length'], ['/conversions/mass/', 'i-mass'], ['/conversions/temperature/', 'i-temperature'],
  ['/conversions/volume/', 'i-volume'], ['/conversions/area/', 'i-area'], ['/conversions/time/', 'i-time'],
  ['/conversions/speed/', 'i-speed'], ['/conversions/pressure/', 'i-pressure'], ['/conversions/energy/', 'i-energy'],
  ['/conversions/power/', 'i-power'], ['/conversions/data/', 'i-data'], ['/conversions/angle/', 'i-angle']
];

/** url -> how many tools live under it, from the register of what exists. */
function counts() {
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  const entries = box.SEARCH_INDEX || [];
  const n = { total: entries.length };
  for (const e of entries) {
    const p = '/' + String(e[1]);
    for (const url of Object.keys(SECTIONS)) {
      if (url === '/' || SECTIONS[url].meta) continue;
      if (p.indexOf(url) === 0) n[url] = (n[url] || 0) + 1;
    }
  }
  /* /learn/ holds guides, not tools, and is not in the search index */
  n['/learn/'] = fs.readdirSync(path.join(ROOT, 'learn')).filter(d => fs.existsSync(path.join(ROOT, 'learn', d, 'index.html'))).length;
  return n;
}

const row = (url, glyph, name, count, sub) =>
  '      <a class="side-link' + (sub ? ' side-sub' : '') + '" href="' + url + '">\n' +
  '        ' + icon(glyph) + '<span class="side-name">' + esc(name) + '</span>' +
  (count === null ? '' : '<span class="side-count">' + count + '</span>') + '\n' +
  '      </a>\n';

const nameOf = (url) => (SECTIONS[url] && SECTIONS[url].name) || url;

function sidebar(n) {
  const num = (x) => (x || 0).toLocaleString('en-GB');
  let out =
    '<aside class="sidebar" id="sidebar" aria-label="Tool categories">\n' +
    '    <div class="sidebar-head">\n' +
    '      <span class="sidebar-title">Browse tools</span>\n' +
    '      <button class="sidebar-close" id="sidebarClose" aria-label="Close categories">' + icon('i-close') + '</button>\n' +
    '    </div>\n\n' +
    '    <nav class="side-nav">\n' +
    row('/', 'i-home', 'Home', null) +
    row('/tools/', 'i-grid', 'All tools', num(n.total)) +
    row('/for/', 'i-collections', 'Collections', null) +
    row('/settings/', 'i-settings', 'Settings', null) +
    '\n      <p class="side-group">Categories</p>\n';
  for (const [url, glyph] of ORDER) out += row(url, glyph, nameOf(url), num(n[url]));
  out +=
    '\n      <p class="side-group">Unit conversions</p>\n' +
    row('/conversions/', 'i-conversions', nameOf('/conversions/'), num(n['/conversions/'])) +
    '      <details class="side-fold">\n' +
    '        <summary>All ' + FAMILIES.length + ' families</summary>\n' +
    FAMILIES.map(([url, glyph]) => row(url, glyph, nameOf(url), num(n[url]), true)).join('') +
    '      </details>\n' +
    '\n      <p class="side-group">Reading</p>\n' +
    row('/compare/', 'i-compare', 'Comparisons', null) +
    row('/guides/', 'i-feed', 'Guides', null) +
    row('/learn/', 'i-learn', nameOf('/learn/'), num(n['/learn/'])) +
    '    </nav>\n' +
    '  </aside>';
  return out;
}

/** The link for the page's own section carries is-active, as before. */
function active(html, rel) {
  const p = '/' + rel.replace(/index\.html$/, '');
  let best = '';
  for (const [url] of ORDER.concat(FAMILIES).concat([['/guides/'], ['/compare/'], ['/conversions/'], ['/learn/'], ['/tools/'], ['/for/'], ['/settings/']])) {
    if (p.indexOf(url) === 0 && url.length > best.length) best = url;
  }
  if (!best) return html;
  return html.replace('<a class="side-link" href="' + best + '">', '<a class="side-link is-active" href="' + best + '">')
    .replace('<a class="side-link side-sub" href="' + best + '">', '<a class="side-link side-sub is-active" href="' + best + '">');
}

const BLOCK = /<aside class="sidebar"[\s\S]*?<\/aside>/;

/* Glyphs this file asks for that the sprite may not have. A generator
   that references an id it does not ship draws an empty box, silently,
   on every page — which is exactly what happened to i-collections. */
const OWN_GLYPHS = {
  'i-collections': '<symbol id="i-collections" viewBox="0 0 24 24">\n  <rect x="3" y="9" width="13" height="12" rx="2"/>\n  <path d="M6.5 6h11a2 2 0 0 1 2 2v9" class="thin"/>\n  <path d="M9.5 3h8a3 3 0 0 1 3 3v8" class="thin"/>\n  <path d="M6.5 13h6M6.5 16.5h4" class="thin"/>\n</symbol>',
  'i-compare': '<symbol id="i-compare" viewBox="0 0 24 24">\n  <path d="M12 4.2v15.6"/>\n  <path d="M8.2 19.8h7.6" class="thin"/>\n  <path d="M4.6 7.4h14.8" class="thin"/>\n  <path d="M4.6 7.4 2 13.2h5.2z" class="thin"/>\n  <path d="M19.4 7.4 16.8 13.2H22z" class="thin"/>\n</symbol>',
  'i-settings': '<symbol id="i-settings" viewBox="0 0 24 24">\n  <circle cx="12" cy="12" r="3.2"/>\n  <path d="M4.2 9.5h2.1M17.7 9.5h2.1M4.2 14.5h2.1M17.7 14.5h2.1" class="thin"/>\n  <path d="M9.5 4.2v2.1M14.5 4.2v2.1M9.5 17.7v2.1M14.5 17.7v2.1" class="thin"/>\n  <circle cx="12" cy="12" r="8.2" class="thin"/>\n</symbol>'
};
function patchIcons() {
  const rel = 'assets/icons.svg';
  let svg = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let added = 0;
  for (const id of Object.keys(OWN_GLYPHS)) {
    if (svg.indexOf('id="' + id + '"') >= 0) continue;
    svg = svg.replace('</svg>', OWN_GLYPHS[id] + '\n</svg>');
    added++;
  }
  if (added) {
    changes.push('update ' + rel);
    if (!CHECK) fs.writeFileSync(path.join(ROOT, rel), svg);
  }
  return added;
}

/* every id the sidebar names must exist, or a row shows an empty box */
function checkGlyphs() {
  const svg = fs.readFileSync(path.join(ROOT, 'assets/icons.svg'), 'utf8');
  const want = ['i-home', 'i-grid', 'i-collections', 'i-compare', 'i-settings', 'i-feed', 'i-close', 'i-conversions', 'i-learn']
    .concat(ORDER.map(x => x[1])).concat(FAMILIES.map(x => x[1]));
  const missing = [...new Set(want)].filter(id => svg.indexOf('id="' + id + '"') < 0);
  if (missing.length) throw new Error('the sidebar names glyphs the sprite does not have: ' + missing.join(', '));
  return want.length;
}
function main() {
  const glyphs = patchIcons();
  checkGlyphs();
  const n = counts();
  const canonical = sidebar(n);
  let scanned = 0, written = 0, missing = 0;
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git' || name === 'build' || name === 'engine' || name === 'assets') continue;
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) { walk(abs); continue; }
      if (name !== 'index.html' && !name.endsWith('.html')) continue;
      const before = fs.readFileSync(abs, 'utf8');
      if (!BLOCK.test(before)) { missing++; continue; }
      scanned++;
      const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
      const after = active(before.replace(BLOCK, canonical), rel);
      if (after === before) continue;
      changes.push('update ' + rel);
      if (!CHECK) fs.writeFileSync(abs, after);
      written++;
    }
  })(ROOT);

  if (changes.length && !CHECK) {
    const rel = 'sw.js';
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const out = src.replace(/var V = '1234tools-v(\d+)';/, (m, x) => "var V = '1234tools-v" + (Number(x) + 1) + "';");
    if (out !== src) { fs.writeFileSync(path.join(ROOT, rel), out); changes.push('update sw.js'); }
  }

  console.log('\nbuild-sidebar.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  order               ' + ORDER.map(x => nameOf(x[0])).slice(0, 5).join(', ') + ', …');
  console.log('  counts              ' + n.total + ' tools across ' + ORDER.length + ' categories, ' + FAMILIES.length + ' conversion families folded');
  console.log('  pages with sidebar  ' + scanned + (missing ? ' (' + missing + ' without one, left alone)' : ''));
  console.log('  icons               ' + (glyphs ? glyphs + ' glyph(s) added to the sprite' : 'all present'));
  console.log('  pages rewritten     ' + written);
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

/* The one way a page gets a sidebar. Generators call this instead of
   stripping is-active themselves, so what they write is already what
   this script would write and neither has anything left to change. */
let _cached = null;
function apply(html, rel) {
  if (!_cached) _cached = sidebar(counts());
  if (!BLOCK.test(html)) return html;
  return active(html.replace(BLOCK, _cached), rel);
}

if (require.main === module) main();
module.exports = { counts, sidebar, apply, ORDER, FAMILIES };
