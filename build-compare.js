/**
 * Generate /compare/ — the honest comparisons.
 *
 *   node build-compare.js          apply
 *   node build-compare.js --check  report what would change, write nothing
 *
 * These are the pages somebody reaches by typing "free alternative to X".
 * They are not a section and they hold no tool of their own, so nothing
 * here moves the tool total; they are a route into tools that already
 * exist, for a person who arrived with a product name in their head.
 *
 * A comparison page names somebody else's product, which is the one thing
 * on this site that can be unfair as well as wrong. So three rules are
 * enforced here, in code, rather than trusted to the writing:
 *
 *   1. Nothing disparages. A fixed list of words — bloated, clunky,
 *      overpriced, outdated, scam and their neighbours — stops the build if
 *      it appears anywhere in the copy.
 *
 *   2. Nothing states a price we cannot verify. No currency amount may
 *      appear in the data at all, and any currency amount found near a
 *      competitor's name is reported by name and line. We have no network
 *      and cannot check what anything costs today, so no page says.
 *
 *   3. The gap comes first. Every page prints what the paid product does
 *      that we do not *before* the comparison table and before the list of
 *      free tools, and the table's first row must be one the paid product
 *      wins. A table that opened with our own strengths would be an advert
 *      wearing a table's clothes.
 *
 * Every tool's title and description are read out of the tool's own page
 * rather than repeated here, so a comparison cannot drift from what it
 * links to. A path that does not resolve stops the build.
 *
 * There is no '/compare/' entry in build/sections.js yet, so trailFor
 * returns an empty trail and the breadcrumb falls back to Home › this page.
 * Adding the entry upgrades every page here to Home › Comparisons › page
 * with no change to this file.
 *
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crumbs = require('./build-crumbs.js');
const outbound = require('./build-outbound.js');
const { trailFor } = require('./build/sections.js');
const { COMPARISONS, REF, COMPETITORS } = require('./build/compare.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SECTION = 'compare';
const SHELL_PAGE = 'business/index.html';
const HUB_LABEL = 'Comparisons';

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

/* ---------- rule 1 and rule 2, enforced before anything is written ---- */

/* Words that describe a competitor rather than a capability. A page that
   needs one of these has run out of facts. */
const DISPARAGING = /\b(bloated|bloatware|clunky|rip[\s-]?offs?|overpriced|outdated|obsolete|scams?|worst|useless|garbage|rubbish|terrible|awful|crappy|shoddy|inferior|dinosaur|antiquated|ripping you off)\b/i;

/* What an unverifiable price claim looks like: a currency amount. */
const MONEY = /(?:[£$€₹]\s?\d|\b(?:Rs|INR|GBP|USD|EUR|USD)\.?\s?\d|\b\d+(?:[.,]\d+)?\s?(?:pounds|dollars|euros|rupees)\b)/i;

/** Every string in the data, with a path saying where it came from. */
function strings(node, where, out) {
  out = out || [];
  if (typeof node === 'string') { out.push([where, node]); return out; }
  if (Array.isArray(node)) { node.forEach((x, i) => strings(x, where + '[' + i + ']', out)); return out; }
  if (node && typeof node === 'object') { for (const k of Object.keys(node)) strings(node[k], where + '.' + k, out); return out; }
  return out;
}

/* Every occurrence, not the first: somebody putting a page right should
   see the whole list rather than discovering the second word on the next
   run. */
function every(re, s) {
  const g = new RegExp(re.source, 'gi');
  const out = [];
  let m;
  while ((m = g.exec(s))) { out.push(m[0]); if (m.index === g.lastIndex) g.lastIndex++; }
  return out;
}

function honestyCheck() {
  const found = { disparaging: [], money: [], moneyNearName: [] };
  for (const c of COMPARISONS) {
    for (const [where, s] of strings(c, c.slug)) {
      every(DISPARAGING, s).forEach(w => found.disparaging.push(where + ': "' + w + '" in ' + s.slice(0, 90)));
      const amounts = every(MONEY, s);
      amounts.forEach(a => found.money.push(where + ': "' + a + '" in ' + s.slice(0, 90)));
      if (amounts.length && COMPETITORS.some(n => s.indexOf(n) >= 0)) {
        found.moneyNearName.push(where + ': ' + s.slice(0, 120));
      }
    }
  }
  return found;
}

/* ---------- rule 3, and the other things a page must actually have ---- */

function shapeCheck(c) {
  const bad = [];
  const need = ['slug', 'glyph', 'name', 'title', 'lede', 'honest', 'gap', 'table', 'buy', 'groups', 'faq', 'collections'];
  need.forEach(k => { if (!c[k]) bad.push('missing ' + k); });
  if (!c.gap || !c.gap.points || c.gap.points.length < 3) bad.push('the gap section needs at least three points; it is the point of the page');
  const rows = (c.table && c.table.rows) || [];
  const them = rows.filter(r => r.edge === 'them').length;
  const us = rows.filter(r => r.edge === 'us').length;
  if (rows.length < 6) bad.push('a comparison table with ' + rows.length + ' rows is not a comparison');
  if (them < 2) bad.push('only ' + them + ' row(s) go the paid product’s way — that is not an honest table');
  if (us < 2) bad.push('only ' + us + ' row(s) go our way — then why is this page here');
  if (rows.length && rows[0].edge !== 'them') bad.push('the first table row must be one they win: where we are worse is said first');
  if (!c.buy || !c.buy.points || c.buy.points.length < 3) bad.push('the "when you should buy it" section has to mean something');
  if (!c.faq || c.faq.length < 4) bad.push('fewer than four FAQ entries');
  return bad;
}

/* ---------- a tool's own words, read from the tool's own page --------- */

const metaCache = {};
function toolMeta(p) {
  if (metaCache[p]) return metaCache[p];
  const abs = path.join(ROOT, p.replace(/^\/+/, ''), 'index.html');
  if (!fs.existsSync(abs)) throw new Error('a comparison points at ' + p + ', which does not exist');
  const src = fs.readFileSync(abs, 'utf8');
  const t = /<title>([^<]*)<\/title>/.exec(src);
  const d = /<meta name="description" content="([^"]*)">/.exec(src);
  if (!t || !d) throw new Error(p + ' has no title or description to read');
  /* The site suffix first, then whatever marketing tail the title carries:
     "Invoice Generator (PDF) — Free & Private | 1234Tools" is the name of a
     tool plus two things the card already says for itself. */
  const title = unesc(t[1])
    .replace(/\s*\|\s*1234Tools\s*$/i, '')
    .replace(/\s*[—–|-]\s*(Free\b|AI for Business\b).*$/i, '')
    .trim();
  if (!title) throw new Error(p + ' has a title that cleans away to nothing');
  metaCache[p] = { path: p, title, description: unesc(d[1]), ai: p.indexOf('/ai/') === 0 };
  return metaCache[p];
}

/* ---------- the shell, borrowed from a real page ---------------------- */

function shell() {
  const src = fs.readFileSync(path.join(ROOT, SHELL_PAGE), 'utf8');
  const headEnd = src.indexOf('</head>');
  const open = '<main id="main" class="content">';
  const mainStart = src.indexOf(open);
  const mainEnd = src.indexOf('</main>');
  if (headEnd < 0 || mainStart < 0 || mainEnd < 0) throw new Error('could not read the shell from ' + SHELL_PAGE);
  return { head: src.slice(0, headEnd), mid: src.slice(headEnd, mainStart + open.length), tail: src.slice(mainEnd) };
}

function headFor(parts, pathOnly, title, description) {
  const url = SITE + pathOnly;
  const full = title + ' | 1234Tools';
  return parts.head
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(full) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(full) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">')
    .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(full) + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(description) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '')
    .replace(/<!-- PWA: generated by build-pwa\.js, do not edit -->[\s\S]*?<!-- \/PWA -->\n?/, '')
    .replace(/(<script src="\/engine\/[^"]*"[^>]*><\/script>\n?)+/, '');
}

/* The sidebar has one owner. A generator that strips is-active here and a
   build-sidebar that puts it back is a pipeline that never settles — which
   is exactly what happened the moment this section got a sidebar row. */
const { apply: sidebarFor } = require('./build-sidebar.js');

/* ---------- the pieces of a page -------------------------------------- */

const tagFor = (m) => m.ai
  ? '<span class="tag tag-freemium" title="Needs an account. Ten AI calls a month free, more on a paid plan.">Free to try</span>'
  : '<span class="tag tag-free" title="Runs in your browser. No account, no upload, no limit.">Free</span>';

const toolCard = (m) => '<a class="card" href="' + m.path + '"><strong>' + esc(m.title) + '</strong>' +
  '<span class="card-desc">' + esc(m.description) + '</span>' + tagFor(m) + '</a>';

/** A headed section with a list of points: the gap, the explainer, the buy. */
function pointList(id, s) {
  return '<section class="collection-group compare-' + id + '">\n' +
    '  <h2>' + esc(s.heading) + '</h2>\n' +
    (s.intro ? '  <p class="group-blurb">' + esc(s.intro) + '</p>\n' : '') +
    '  <div class="panel"><ul class="tips">' +
    s.points.map(p => typeof p === 'string'
      ? '<li>' + esc(p) + '</li>'
      : '<li><strong>' + esc(p.h) + '</strong> ' + esc(p.p) + '</li>').join('') +
    '</ul></div>\n</section>\n';
}

/**
 * The table. Three columns, because a two-column table forces every row to
 * be a tick or a cross and the truth is usually a sentence. The row carries
 * which way it goes as data so a check can read it, and the rows they win
 * are printed first.
 */
function comparisonTable(c) {
  /* Each cell names its own column. Three columns of sentences do not fit a
     phone, and a table that has to be swiped sideways loses its row header
     on the way — so the markup carries the label with the cell, and a small
     media query can stack the rows without anything becoming anonymous. */
  const short = (s) => String(s).split(',')[0].trim();
  const rows = c.table.rows.map(r =>
    '<tr data-edge="' + r.edge + '"><th scope="row">' + esc(r.need) + '</th>' +
    '<td data-col="' + esc(short(c.table.us)) + '">' + esc(r.us) + '</td>' +
    '<td data-col="' + esc(short(c.table.them)) + '">' + esc(r.them) + '</td></tr>').join('');
  const them = c.table.rows.filter(r => r.edge === 'them').length;
  const us = c.table.rows.filter(r => r.edge === 'us').length;
  return '<section class="collection-group compare-table">\n' +
    '  <h2>Side by side</h2>\n' +
    '  <p class="group-blurb">' + them + ' rows go their way and ' + us + ' go ours, and the ones they win are printed first. ' +
    'Nothing in the right-hand column is a claim about any particular product’s price or features — we have no way to check those, so we do not state them.</p>\n' +
    '  <div class="table-scroll"><table class="biz-table trust-table">' +
    '<thead><tr><th>What you need</th><th>' + esc(c.table.us) + '</th><th>' + esc(c.table.them) + '</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>\n' +
    '</section>\n';
}

function sourcesPanel(s) {
  if (!s) return '';
  const items = s.refs.map(([key, note]) => {
    const r = REF[key];
    if (!r) throw new Error('a comparison names the reference "' + key + '", which is not in build/compare.js');
    return '<li><a href="' + esc(r[1]) + '">' + esc(r[0]) + '</a> — ' + esc(note) + '</li>';
  }).join('');
  return '  <section class="panel"><h2>' + esc(s.heading) + '</h2><ul class="tips">' + items + '</ul></section>\n';
}

function comparePage(c, parts) {
  const bad = shapeCheck(c);
  if (bad.length) throw new Error('/' + SECTION + '/' + c.slug + '/ is not a fair comparison:\n    - ' + bad.join('\n    - '));

  const pathOnly = '/' + SECTION + '/' + c.slug + '/';
  const url = SITE + pathOnly;
  const trail = trailFor(pathOnly);
  const label = c.crumb || c.name;

  const all = [];
  const groups = c.groups.map(g => {
    const cards = g.tools.map(t => { const m = toolMeta(t); all.push(m); return toolCard(m); }).join('');
    return '<section class="collection-group"><h2>' + esc(g.name) + '</h2>' +
      (g.blurb ? '<p class="group-blurb">' + esc(g.blurb) + '</p>' : '') +
      '<div class="grid">' + cards + '</div></section>';
  }).join('\n');

  const { COLLECTIONS } = require('./build/collections.js');
  const related = c.collections.map(s => {
    const r = COLLECTIONS.find(x => x.slug === s);
    if (!r) throw new Error(c.slug + ' points at the collection "' + s + '", which does not exist');
    return '<li><a href="/for/' + r.slug + '/">' + esc(r.title) + '</a></li>';
  }).join('');

  const ai = all.filter(m => m.ai).length;

  /* Order matters more than usual here: the honest opening, then what they
     do that we do not, then the table, then when to buy theirs — and only
     after all of that, what is free. */
  const body =
    crumbs.render(trail, label) + '\n' +
    '<article class="collection compare">\n' +
    '  <p class="eyebrow">Honest comparison</p>\n' +
    '  <h1>' + icon(c.glyph).replace('class="ico"', 'class="ico ico-title"') + esc(c.name) + '</h1>\n' +
    '  <p class="lede">' + esc(c.lede) + '</p>\n' +
    '  <p class="collection-count">' + all.length + ' free tools linked from this page' +
      (ai ? ' · ' + (all.length - ai) + ' with no account at all · ' + ai + ' AI tools that need one' : ' · none of them need an account') + '</p>\n' +
    c.honest.map(x => '  <p class="collection-intro">' + esc(x) + '</p>').join('\n') + '\n' +
    (c.explain ? pointList('explain', c.explain) : '') +
    pointList('gap', c.gap) +
    comparisonTable(c) +
    pointList('buy', c.buy) +
    '<section class="collection-group compare-free">\n  <h2>What you can do here for nothing</h2>\n' +
    '  <p class="group-blurb">Everything below runs in your browser unless it is marked “free to try”, which means an AI tool with an account and a monthly allowance. None of it files anything.</p>\n</section>\n' +
    groups + '\n' +
    '  <section class="panel"><h2>Frequently asked questions</h2>' +
      c.faq.map(f => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n' +
    sourcesPanel(c.sources) +
    '  <section class="panel"><h2>Related collections</h2><ul class="related">' + related + '</ul></section>\n' +
    '</article>\n';

  /* FAQPage and BreadcrumbList, and deliberately nothing else. Product,
     Review and AggregateRating markup about somebody else's product would
     be us asserting facts about it that we have not checked. */
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'FAQPage', name: c.title, url,
        mainEntity: c.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      crumbs.breadcrumbList(trail, label, pathOnly)
    ]
  }) + '</script>\n';

  const html = sidebarFor(headFor(parts, pathOnly, c.title, c.lede) + ld + parts.mid + '\n' + body + parts.tail, SECTION + '/' + c.slug + '/index.html');
  return outbound.rewrite(html, SECTION).html;
}

function hubPage(parts) {
  const pathOnly = '/' + SECTION + '/';
  const trail = trailFor(pathOnly);
  const title = 'Honest comparisons: what these free tools do, and what they do not';
  const description = 'Free browser tools compared against the paid products people search for — what the paid product does that we do not, first and plainly, then what you can do here for nothing.';
  const cards = COMPARISONS.map(c => '<a class="card" href="/' + SECTION + '/' + c.slug + '/"><span class="card-icon">' + icon(c.glyph) + '</span>' +
    '<strong>' + esc(c.name) + '</strong><span class="card-desc">' + esc(c.lede) + '</span></a>').join('');

  const body =
    crumbs.render(trail, HUB_LABEL) + '\n' +
    '<article class="collection compare">\n' +
    '  <p class="eyebrow">Honest comparison</p>\n' +
    '  <h1>' + esc(HUB_LABEL) + '</h1>\n' +
    '  <p class="lede">' + esc(description) + '</p>\n' +
    '  <p class="collection-count">' + COMPARISONS.length + ' comparisons · every one opens with what we cannot do</p>\n' +
    '  <p class="collection-intro">A comparison page written by the people selling one of the two things is worth what you paid for it. So these are written to a rule we can be held to: the paid product’s advantages come first, in our own voice, before the table and before a single link to anything free.</p>\n' +
    '  <p class="collection-intro">The other rule is that we do not state anything about somebody else’s product that we cannot check. We have no way to see what a competitor charges today, which plans exist or what shipped last month, so no page here says. Where that matters, the page points at the vendor’s own site or at the authority — gov.uk, EPFO, the GST portal — rather than at us.</p>\n' +
    '  <section class="collection-group"><h2>The comparisons</h2><div class="grid">' + cards + '</div></section>\n' +
    '  <section class="panel"><h2>What we are, in one paragraph</h2><ul class="tips">' +
      '<li><strong>Free browser tools that do specific jobs.</strong> A file is read, some arithmetic happens and a file comes back, all on your own machine. Nothing is uploaded and nothing is stored.</li>' +
      '<li><strong>Not a system of record.</strong> There is no ledger that survives the tab closing, no client list, no history and no prior year.</li>' +
      '<li><strong>Not able to file anything.</strong> Not a VAT return, not a set of accounts, not a payroll return. Filing needs software a tax authority has recognised, and none of ours is.</li>' +
      '<li><strong>Not somebody you can ring.</strong> If you are running a limited company with a bookkeeper, or a school with a safeguarding duty, you should probably buy the real thing — and these pages say which one of us is right for which job.</li>' +
      '</ul></section>\n' +
    '</article>\n';

  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description, url: SITE + pathOnly,
        mainEntity: { '@type': 'ItemList', numberOfItems: COMPARISONS.length,
          itemListElement: COMPARISONS.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + '/' + SECTION + '/' + c.slug + '/', name: c.name })) } },
      crumbs.breadcrumbList(trail, HUB_LABEL, pathOnly)
    ]
  }) + '</script>\n';

  const html = sidebarFor(headFor(parts, pathOnly, title, description) + ld + parts.mid + '\n' + body + parts.tail, SECTION + '/index.html');
  return outbound.rewrite(html, SECTION).html;
}

/* ---------- wiring ---------------------------------------------------- */

function patchSitemap() {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const urls = ['/' + SECTION + '/'].concat(COMPARISONS.map(c => '/' + SECTION + '/' + c.slug + '/'));
  const add = urls.filter(u => src.indexOf('<loc>' + SITE + u + '</loc>') < 0)
    .map(u => '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>');
  if (!add.length) return 0;
  write(rel, src.replace('</urlset>', add.join('\n') + '\n</urlset>'));
  return add.length;
}

function bumpServiceWorker() {
  const rel = 'sw.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return write(rel, src.replace(/var V = '1234tools-v(\d+)';/, (m, n) => "var V = '1234tools-v" + (Number(n) + 1) + "';"));
}

function main() {
  const found = honestyCheck();
  if (found.disparaging.length || found.money.length) {
    console.error('\nbuild-compare.js refuses to write. These pages name other people’s products.\n');
    found.disparaging.forEach(x => console.error('    disparaging   ' + x));
    found.money.forEach(x => console.error('    price claim   ' + x));
    console.error('\n  State what a product does and let the reader judge; link to their own site for anything priced.\n');
    process.exit(1);
  }

  const parts = shell();
  let built = 0;
  for (const c of COMPARISONS) if (write(SECTION + '/' + c.slug + '/index.html', comparePage(c, parts))) built++;
  if (write(SECTION + '/index.html', hubPage(parts))) built++;
  const mapped = patchSitemap();
  const sw = changes.length ? bumpServiceWorker() : false;

  const rows = COMPARISONS.reduce((n, c) => n + c.table.rows.length, 0);
  const theirs = COMPARISONS.reduce((n, c) => n + c.table.rows.filter(r => r.edge === 'them').length, 0);

  console.log('\nbuild-compare.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  comparisons         ' + COMPARISONS.length);
  console.log('  table rows          ' + rows + ' (' + theirs + ' go the paid product’s way, and are printed first)');
  console.log('  tools referenced    ' + Object.keys(metaCache).length + ' distinct');
  console.log('  honesty check       no disparaging words, no price claims, no Product/Review markup');
  console.log('  breadcrumb          ' + (trailFor('/' + SECTION + '/x/').length
    ? 'Home › ' + trailFor('/' + SECTION + '/x/').map(s => s.crumb).join(' › ') + ' › page'
    : 'Home › page (no /compare/ entry in build/sections.js yet)'));
  console.log('  pages written       ' + built);
  console.log('  sitemap             ' + (mapped ? mapped + ' added' : 'unchanged'));
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
module.exports = { toolMeta, honestyCheck, shapeCheck, DISPARAGING, MONEY };
