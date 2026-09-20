/**
 * The home page: what this is, why it runs the way it does, and proof.
 *
 *   node build-home.js          apply
 *   node build-home.js --check  report what would change, write nothing
 *
 * The page used to open with "1,251 tools", which is true and almost
 * useless: 1,048 of them turn miles into kilometres. Somebody who came
 * for a VAT return learned nothing, and the one genuinely unusual thing
 * about the site — that the work happens on their own machine — was not
 * stated anywhere above the footer.
 *
 * So three blocks, and only three. A hero that leads with the tools that
 * are not conversions and names the conversions as what they are; a band
 * of the few claims worth making, each one a visitor can check in a
 * minute; and four of the larger tools, described in their own words.
 *
 * Every number here is read out of assets/search-index.js, which is the
 * register of what exists. None of them is typed into this file, because
 * a count typed into a file is a count that goes stale quietly.
 *
 * It owns nothing else on the page. The header, the sidebar, the search,
 * the collections row, "Popular tools", "Browse by category", the
 * conversion families and the footer all belong to other builders, and
 * this one patches strictly between its own markers.
 *
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const outbound = require('./build-outbound.js');
const { PRICING } = require('./build/collections.js');
/* The same reader the collections use, so a tool is described in one
   place — its own page — and the home page cannot drift from it. */
const { toolMeta } = require('./build-collections.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');

/* Six of the larger ones. Not the popular ones — those have their own
   row, and repeating them here would say the site is eight tools deep.
   These are the ones that answer "can it do the thing I actually came
   for": a set of books, a return, a payroll month, a school year. Six
   rather than four because the grid is three wide on a desktop and a
   row of three with one left over looks like something went wrong; the
   last of them is an AI tool, so the one price that is not "free" is on
   the page rather than only in the paragraph about price. */
const PICKS = [
  '/business/bookkeeping/',
  '/business/vat-return/',
  '/business/payroll-run/',
  '/education/timetable/',
  '/business/bank-reconciliation/',
  '/ai/invoice-extractor/'
];

const changes = [];
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (existing === content) return false;
  changes.push((existing === null ? 'create ' : 'update ') + rel);
  if (!CHECK) fs.writeFileSync(abs, content);
  return true;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n) => Number(n).toLocaleString('en-GB');

/* ---------- the numbers ---------- */

/** Read the register, the way the sidebar does, and split it honestly. */
function counts() {
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  const entries = box.SEARCH_INDEX || [];
  const under = (prefix) => entries.filter(e => String(e[1]).indexOf(prefix) === 0).length;
  const total = entries.length;
  const conversions = under('conversions/');
  const freemium = under('ai/');
  return {
    total,
    conversions,
    rest: total - conversions,   /* everything that is not a unit conversion */
    freemium,                    /* the AI tools: an account, an allowance */
    free: total - freemium
  };
}

/**
 * How many pages carry the "sources, and when this was last checked"
 * panel. Counted rather than asserted, because the honest claim is "these
 * ones do", not "every page does" — /india/gst-calculator/ does not have
 * one yet, and a home page that says otherwise is the kind of small lie
 * the rest of the site is built to avoid.
 */
function checkedPages() {
  const skip = new Set(['node_modules', 'assets', 'engine', 'pwa', 'learn', 'conversions', 'for']);
  let n = 0;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name[0] === '.' || skip.has(ent.name)) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name === 'index.html' && fs.readFileSync(p, 'utf8').indexOf('panel panel-sources') >= 0) n++;
    }
  };
  walk(ROOT);
  return n;
}

/* ---------- the blocks ---------- */

function heroBlock(c) {
  const stat = (n, label) => '<div><div class="stat-num">' + esc(n) + '</div><div class="stat-lbl">' + esc(label) + '</div></div>';
  return '<section class="hero">\n' +
    '  <p class="eyebrow">Free, and it runs in your browser</p>\n' +
    /* One span inside the h1: the h1 is a flex row site-wide, so text put
       straight into it becomes a second column instead of wrapping. */
    '  <h1><span><span class="grad">' + num(c.rest) + ' tools</span> for everyday work</span></h1>\n' +
    '  <p class="lede">Bookkeeping, VAT returns, payroll, invoices, PDFs, images and school timetables — and ' +
      num(c.conversions) + ' unit converters as well. It all runs inside this browser tab: the file you open is read on your own device and never uploaded. The ' +
      num(c.freemium) + ' AI tools are the exception, and every one of them says so before you send anything.</p>\n' +
    '  <div class="hero-stats">\n    ' +
    [stat(num(c.rest), 'Everyday tools'),
     stat(num(c.conversions), 'Unit converters'),
     stat(num(c.free), 'Free, no account'),
     stat(num(c.freemium), 'AI, account needed')].join('\n    ') +
    '\n  </div>\n</section>';
}

function whyBlock(c, checked) {
  const point = (lead, body) => '<li><strong>' + esc(lead) + '</strong> ' + esc(body) + '</li>';
  return '<section class="panel home-why">\n' +
    '  <h2>How this works</h2>\n' +
    '  <ul class="tips">\n    ' +
    [point('Nothing you open is uploaded.',
       'A tool is JavaScript running in this tab: it reads the file you pick off your own disk and writes the result back there, so a client’s ledger or a class list never leaves the machine. The ' + num(c.freemium) + ' AI tools are the exception, and each one shows you exactly what will be sent before it goes.'),
     point('No account for the browser tools.',
       num(c.free) + ' of the ' + num(c.total) + ' ask for nothing at all — no sign-up, no email address, no trial with a date on it.'),
     point('It keeps working with the network off, and it installs.',
       'Each tool is one page, and your browser keeps it once you have opened it — so it still runs on a train or a building site, and it can be added to a home screen like an app.'),
     point('Where a rule can change, the page says when it was last checked.',
       checked + ' tools apply a tax rate, a threshold or a statutory formula. Each one prints the date a person last checked it and links to the gov.uk, CBIC or board page that settles it, rather than asking to be trusted indefinitely.')
    ].join('\n    ') +
    '\n  </ul>\n' +
    '</section>\n' +
    /* Price gets its own panel and its own heading, because it is the
       question somebody scans for, and as the tail of a paragraph about
       something else it is fourteen lines of prose on a phone.
       The two badges a tool can carry, in the words the badges use, so
       the home page and the tool pages cannot disagree about the price. */
    '<section class="panel home-price">\n' +
    '  <h2>What it costs</h2>\n' +
    '  <ul class="tips">\n    ' +
    [point(PRICING.free.label + '.',
       PRICING.free.blurb + ' That is ' + num(c.free) + ' of the ' + num(c.total) + ', and it stays that way: they cost us nothing to run.'),
     point(PRICING.freemium.label + '.',
       PRICING.freemium.blurb + ' That is the ' + num(c.freemium) + ' AI tools, which cost us money every time somebody presses the button.'),
     point('Nothing is premium-only.',
       'There is no tool you cannot reach without paying. A paid plan raises the monthly allowance on the AI tools, and that is all it buys.')
    ].join('\n    ') +
    '\n  </ul>\n' +
    '</section>';
}

function picksBlock(metas) {
  const card = (m) => '<a class="card" href="' + m.path + '"><strong>' + esc(m.title) + '</strong>' +
    '<span class="card-desc">' + esc(m.description) + '</span>' +
    '<span class="tag tag-' + m.pricing.key + '" title="' + esc(m.pricing.blurb) + '">' + esc(m.pricing.label) + '</span></a>';
  return '<section class="home-picks">\n' +
    '  <h2 class="section-title">Some of the bigger ones</h2>\n' +
    '  <p class="section-lede">Not three boxes and an answer. These read a file you already keep and hand back a set of books, a return, a month of payslips or a school year.</p>\n' +
    '  <div class="grid">' + metas.map(card).join('') + '</div>\n' +
    '</section>';
}

/* ---------- patching ---------- */

const open = (name) => '<!-- ' + name + ': generated by build-home.js, do not edit -->';
const close = (name) => '<!-- /' + name + ' -->';
const wrap = (name, body) => open(name) + '\n' + body + '\n' + close(name);
const region = (name) => new RegExp('<!-- ' + name + '(?::[^>]*)? -->[\\s\\S]*?<!-- \\/' + name + ' -->');

/**
 * Put a block where it belongs, once, and thereafter replace it in place.
 * `place` is only consulted the first time, so the owner of the page can
 * move a block afterwards and this will not drag it back.
 */
function put(html, name, body, place) {
  const block = wrap(name, body);
  const re = region(name);
  if (re.test(html)) return html.replace(re, () => block);
  return place(html, block);
}

function patchHome() {
  const rel = 'index.html';
  let html = fs.readFileSync(path.join(ROOT, rel), 'utf8');

  const c = counts();
  const checked = checkedPages();
  const metas = PICKS.map(toolMeta);

  /* Two tools described twice would make the page look longer than the
     site is. The popular row is generated elsewhere, so ask it. */
  const popular = (/<!-- POPULAR[\s\S]*?<!-- \/POPULAR -->/.exec(html) || [''])[0];
  for (const m of metas) {
    if (popular.indexOf('href="' + m.path + '"') >= 0) throw new Error(m.path + ' is already in the popular row; pick another');
    if (metas.filter(x => x.path === m.path).length > 1) throw new Error(m.path + ' is listed twice');
  }

  const mainOpen = '<main id="main" class="content">';
  if (html.indexOf(mainOpen) < 0) throw new Error('could not find the main element on the homepage');

  /* The hand-written hero, on its way out. Only ever touched on the first
     run: after that the markers are the hero. */
  if (!region('HOME-HERO').test(html)) html = html.replace(/\n?<section class="hero">[\s\S]*?<\/section>\n?/, '\n');

  html = put(html, 'HOME-HERO', heroBlock(c), (h, block) => {
    const at = h.indexOf(mainOpen) + mainOpen.length;
    return h.slice(0, at) + '\n' + block + h.slice(at);
  });
  html = put(html, 'HOME-WHY', whyBlock(c, checked), (h, block) => {
    const at = h.indexOf(close('HOME-HERO')) + close('HOME-HERO').length;
    return h.slice(0, at) + '\n' + block + h.slice(at);
  });
  html = put(html, 'HOME-PICKS', picksBlock(metas), (h, block) => {
    const at = h.indexOf('<!-- POPULAR');
    if (at < 0) throw new Error('could not find the popular row on the homepage');
    return h.slice(0, at) + block + '\n' + h.slice(at);
  });

  const changed = write(rel, outbound.rewrite(html, 'home').html);
  return { changed, c, checked, metas };
}

function bumpServiceWorker() {
  const rel = 'sw.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return write(rel, src.replace(/var V = '1234tools-v(\d+)';/, (m, n) => "var V = '1234tools-v" + (Number(n) + 1) + "';"));
}

function main() {
  const { changed, c, checked, metas } = patchHome();
  const sw = changed ? bumpServiceWorker() : false;

  console.log('\nbuild-home.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  counts              ' + c.rest + ' beyond conversions, ' + c.conversions + ' conversions, ' + c.total + ' in total');
  console.log('  pricing             ' + c.free + ' free with no account, ' + c.freemium + ' free to try');
  console.log('  checked pages       ' + checked + ' carry a sources panel');
  console.log('  picks               ' + metas.map(m => m.path).join(', '));
  console.log('  homepage            ' + (changed ? 'hero, why and picks written' : 'unchanged'));
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
module.exports = { counts, checkedPages };
