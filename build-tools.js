/**
 * /tools/ — the directory.
 *
 *   node build-tools.js          apply
 *   node build-tools.js --check  report what would change, write nothing
 *
 * Every tool the site has that is not a unit conversion, on one page,
 * grouped by section, with what it does and what it costs, and a filter
 * that narrows by words, by category and by price without a request.
 *
 * The unit conversions are listed as their twelve families rather than as
 * 1,048 rows. Each family already has a hub that lists its own, and a
 * directory where eighty-four per cent of the entries are "miles to
 * kilometres" and its neighbours is not a directory, it is a phone book.
 * The page says as much, and links to them.
 *
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crumbs = require('./build-crumbs.js');
const outbound = require('./build-outbound.js');
const { trailFor, SECTIONS } = require('./build/sections.js');
const { PRICING, pricingFor } = require('./build/collections.js');
const { ORDER, FAMILIES, apply: sidebarFor } = require('./build-sidebar.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SHELL_PAGE = 'business/index.html';

const changes = [];
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (existing === content) return false;
  changes.push((existing === null ? 'create ' : 'update ') + rel);
  if (!CHECK) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, content); }
  return true;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const icon = (id) => '<svg class="ico" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + id + '"></use></svg>';

/** Every tool in the index, grouped by the section it lives in. */
function inventory() {
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  const entries = box.SEARCH_INDEX || [];
  const bySection = {};
  let conversions = 0;
  for (const [title, p] of entries) {
    const full = '/' + p;
    if (full.indexOf('/conversions/') === 0) { conversions++; continue; }
    const url = ORDER.map(x => x[0]).find(u => full.indexOf(u) === 0);
    if (!url) continue;
    (bySection[url] = bySection[url] || []).push({ title, path: full });
  }
  /* the tool's own description, read from the tool's own page */
  for (const url of Object.keys(bySection)) {
    for (const t of bySection[url]) {
      const abs = path.join(ROOT, t.path.replace(/^\/+/, ''), 'index.html');
      if (!fs.existsSync(abs)) throw new Error('the index lists ' + t.path + ', which has no page');
      const src = fs.readFileSync(abs, 'utf8');
      const d = /<meta name="description" content="([^"]*)">/.exec(src);
      t.description = d ? unesc(d[1]) : '';
      t.pricing = pricingFor(t.path);
    }
    bySection[url].sort((a, b) => a.title.localeCompare(b.title));
  }
  return { bySection, conversions, total: entries.length };
}

function shell() {
  const src = fs.readFileSync(path.join(ROOT, SHELL_PAGE), 'utf8');
  const headEnd = src.indexOf('</head>');
  const open = '<main id="main" class="content">';
  const mainStart = src.indexOf(open);
  const mainEnd = src.indexOf('</main>');
  if (headEnd < 0 || mainStart < 0 || mainEnd < 0) throw new Error('could not read the shell from ' + SHELL_PAGE);
  return { head: src.slice(0, headEnd), mid: src.slice(headEnd, mainStart + open.length), tail: src.slice(mainEnd) };
}

const TITLE = 'All tools — the full directory';
const DESC = 'Every tool on 1234Tools in one list, with what each one does and what it costs. Filter by words, by category or by price. Most run entirely in your browser with no account at all.';

function page(parts, inv) {
  const pathOnly = '/tools/';
  const trail = trailFor(pathOnly);
  const sections = ORDER.filter(([url]) => (inv.bySection[url] || []).length);
  const listed = sections.reduce((n, [url]) => n + inv.bySection[url].length, 0);
  const freemium = sections.reduce((n, [url]) => n + inv.bySection[url].filter(t => t.pricing.key === 'freemium').length, 0);
  const name = (url) => (SECTIONS[url] && SECTIONS[url].name) || url;

  const chips = '<div class="chip-row filter-chips">' +
    '<button type="button" class="chip is-on" data-cat="all">Everything</button>' +
    sections.map(([url]) => '<button type="button" class="chip" data-cat="' + esc(url) + '">' + esc(name(url)) + '</button>').join('') +
    '</div>';

  const groups = sections.map(([url, glyph]) => {
    const rows = inv.bySection[url].map(t =>
      '<a class="dir-row" href="' + t.path + '" data-cat="' + esc(url) + '" data-price="' + t.pricing.key + '">' +
      '<span class="dir-name">' + esc(t.title) + '</span>' +
      '<span class="dir-desc">' + esc(t.description) + '</span>' +
      '<span class="tag tag-' + t.pricing.key + '">' + esc(t.pricing.label) + '</span></a>').join('');
    return '<section class="dir-section" data-cat="' + esc(url) + '">' +
      '<h2>' + icon(glyph) + esc(name(url)) + ' <span class="dir-count">' + inv.bySection[url].length + '</span></h2>' +
      '<div class="dir-list">' + rows + '</div></section>';
  }).join('\n');

  const families = '<section class="dir-section dir-families"><h2>' + icon('i-conversions') + 'Unit conversions <span class="dir-count">' + inv.conversions.toLocaleString('en-GB') + '</span></h2>' +
    '<p class="group-blurb">Listed as families rather than one by one — there are ' + inv.conversions.toLocaleString('en-GB') + ' of them and each family hub lists its own.</p>' +
    '<div class="chip-row">' + FAMILIES.map(([url]) => '<a class="chip" href="' + url + '">' + esc(name(url)) + '</a>').join('') + '</div></section>';

  const body =
    crumbs.render(trail, 'All tools') + '\n' +
    '<article class="directory">\n' +
    '  <p class="eyebrow">Directory</p>\n' +
    '  <h1>All tools</h1>\n' +
    '  <p class="lede">' + esc(DESC) + '</p>\n' +
    '  <p class="collection-count">' + inv.total.toLocaleString('en-GB') + ' tools in all · ' + listed + ' listed here by name · ' +
      inv.conversions.toLocaleString('en-GB') + ' unit conversions in ' + FAMILIES.length + ' families · ' +
      (inv.total - freemium).toLocaleString('en-GB') + ' free with no account · ' + freemium + ' free to try with one</p>\n' +
    '  <div class="dir-filter">\n' +
    '    <label class="visually-hidden" for="dirSearch">Search the directory</label>\n' +
    '    <input id="dirSearch" class="control dir-search" type="search" placeholder="Search ' + listed + ' tools by name or by what they do…" autocomplete="off">\n' +
    '    ' + chips + '\n' +
    '    <div class="chip-row filter-price">' +
      '<button type="button" class="chip is-on" data-price="all">Any price</button>' +
      '<button type="button" class="chip" data-price="free">Free, no account</button>' +
      '<button type="button" class="chip" data-price="freemium">Free to try</button></div>\n' +
    '    <p class="dir-empty" hidden>Nothing matches that. Try fewer words, or <button type="button" class="linkish" id="dirReset">clear the filters</button>.</p>\n' +
    '  </div>\n' +
    groups + '\n' + families + '\n' +
    '  <section class="panel"><h2>What the prices mean</h2><ul class="tips">' +
      '<li><strong>Free, no account.</strong> ' + esc(PRICING.free.blurb) + ' The work happens in your browser, so it costs us nothing to run and there is nothing to sign up to.</li>' +
      '<li><strong>Free to try.</strong> ' + esc(PRICING.freemium.blurb) + ' These call a model on a server, which costs money every time.</li>' +
      '<li><strong>Nothing is hidden behind a plan.</strong> Paying raises the monthly allowance on the AI tools. It does not unlock a tool you could not otherwise reach.</li>' +
      '</ul></section>\n' +
    '  <section class="panel"><h2>Another way in</h2><p>If you would rather not read a list, the <a href="/for/">collections</a> gather these by trade — accountants, small businesses, schools, HR, freelancers, developers — and by the job in front of you.</p></section>\n' +
    '</article>\n';

  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: TITLE, description: DESC, url: SITE + pathOnly,
        mainEntity: { '@type': 'ItemList', numberOfItems: listed } },
      crumbs.breadcrumbList(trail, 'All tools', pathOnly)
    ]
  }) + '</script>\n';

  const head = parts.head
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(TITLE + ' | 1234Tools') + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(DESC) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + SITE + pathOnly + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(TITLE) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(DESC) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + SITE + pathOnly + '">')
    .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(TITLE) + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(DESC) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '')
    .replace(/<!-- PWA: generated by build-pwa\.js, do not edit -->[\s\S]*?<!-- \/PWA -->\n?/, '')
    .replace(/(<script src="\/engine\/[^"]*"[^>]*><\/script>\n?)+/, '')
    /* the filter is deferred, so the head is a fine home for it. app.js
       lives in the body, and a replace aimed at it inside the head
       string matched nothing and silently dropped the script. */
    + '  <script src="/assets/directory.js" defer></script>';

  const html = sidebarFor(head + ld + parts.mid + '\n' + body + parts.tail, 'tools/index.html');
  return outbound.rewrite(html, 'tools').html;
}

function patchSitemap() {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (src.indexOf('<loc>' + SITE + '/tools/</loc>') >= 0) return 0;
  write(rel, src.replace('</urlset>', '<url><loc>' + SITE + '/tools/</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n</urlset>'));
  return 1;
}

function main() {
  const inv = inventory();
  const built = write('tools/index.html', page(shell(), inv));
  const mapped = patchSitemap();
  if (changes.length && !CHECK) {
    const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const out = src.replace(/var V = '1234tools-v(\d+)';/, (m, n) => "var V = '1234tools-v" + (Number(n) + 1) + "';");
    if (out !== src) { fs.writeFileSync(path.join(ROOT, 'sw.js'), out); changes.push('update sw.js'); }
  }
  const listed = Object.values(inv.bySection).reduce((n, l) => n + l.length, 0);
  console.log('\nbuild-tools.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  listed by name      ' + listed + ' across ' + Object.keys(inv.bySection).length + ' categories');
  console.log('  conversions         ' + inv.conversions + ' shown as ' + FAMILIES.length + ' families');
  console.log('  page                ' + (built ? 'written' : 'unchanged'));
  console.log('  sitemap             ' + (mapped ? 'added' : 'unchanged'));
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
module.exports = { inventory };
