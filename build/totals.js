/**
 * The site total, printed on every page, and the one way to rewrite it.
 *
 * The header, the search box, the sidebar button and the footer each carry
 * the number of tools. The number is the length of the search index — the
 * register the sidebar and the hubs already count from — and the phrases
 * that print it are rewritten wherever they hold any other number. Anchoring
 * on the phrase rather than on the old digits is what repairs a page that
 * was reverted to an older total by hand. Used by build-ai-image.js,
 * build-finder.js and build-home.js (which reads indexTotal() for the home
 * page title and descriptions); a generator that adds a tool calls
 * patchTotal() after it has added its row to the index.
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

/** The tools that run in the browser: every one but the cloud AI tools under ai/. */
function freeTotal() {
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  return (box.SEARCH_INDEX || []).filter((e) => String(e[1]).indexOf('ai/') !== 0).length;
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
    [/[\d,]+\+ free calculators and converters/g, t + '+ free calculators and converters'],
    /* the collections row on the home page: build-collections.js writes it
       from its own count, and this keeps it honest between its runs */
    [/[\d,]+ tools is a lot to browse/g, t + ' tools is a lot to browse'],
    /* hand-written pages that print the total and had drifted: the 404
       page (1,185), About (1,185+) and the Learning hub (1,187) */
    [/to search all [\d,]+ tools/g, 'to search all ' + t + ' tools'],
    [/[\d,]+\+ calculators and converters covering/g, t + '+ calculators and converters covering'],
    [/[\d,]+ calculators and converters on the rest of the site/g, t + ' calculators and converters on the rest of the site']
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

module.exports = { indexTotal, freeTotal, patchTotal, pages, isStub };
