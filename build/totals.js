/**
 * The site total, printed on every page, and the one way to rewrite it.
 *
 * The header, the search box, the sidebar button and the footer each carry
 * the number of tools. The number is the length of the search index — the
 * register the sidebar and the hubs already count from — and the phrases
 * that print it are rewritten wherever they hold any other number. Anchoring
 * on the phrase rather than on the old digits is what repairs a page that
 * was reverted to an older total by hand. Used by build-ai-image.js and
 * build-finder.js; a generator that adds a tool calls patchTotal() after it
 * has added its row to the index.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function indexTotal() {
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  return (box.SEARCH_INDEX || []).length;
}

const isStub = (html) => /name="robots" content="noindex,follow"/.test(html) && /http-equiv="refresh"/.test(html);

function pages() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git' || name === 'build') continue;
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith('.html')) out.push(abs);
    }
  })(ROOT);
  return out;
}

/**
 * Rewrite the phrases on every page that is not a redirect stub. `changes`
 * receives 'update <rel>' per page; nothing is written when `check` is true.
 * Returns the number of pages touched.
 */
function patchTotal(total, changes, check) {
  const t = Number(total).toLocaleString('en-GB');
  const swaps = [
    [/<small>[\d,]+\+ free tools<\/small>/g, '<small>' + t + '+ free tools</small>'],
    [/Search [\d,]+ tools…/g, 'Search ' + t + ' tools…'],
    [/<span>All [\d,]+ tools<\/span>/g, '<span>All ' + t + ' tools</span>'],
    [/[\d,]+\+ free calculators and converters/g, t + '+ free calculators and converters']
  ];
  let n = 0;
  for (const abs of pages()) {
    const before = fs.readFileSync(abs, 'utf8');
    if (isStub(before)) continue;
    let after = before;
    for (const [re, b] of swaps) after = after.replace(re, b);
    if (after === before) continue;
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    changes.push('update ' + rel);
    if (!check) fs.writeFileSync(abs, after);
    n++;
  }
  return n;
}

module.exports = { indexTotal, patchTotal, pages, isStub };
