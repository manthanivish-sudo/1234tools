/**
 * Generate /for/ — the collections.
 *
 *   node build-collections.js          apply
 *   node build-collections.js --check  report what would change, write nothing
 *
 * A collection is not a section and does not hold a tool of its own, so
 * nothing here moves the tool total. It is a route: a page for a person
 * ("I am an accountant") or a job ("it is month end") that gathers the
 * tools already living elsewhere and says why each is on the list.
 *
 * Every tool's title and description are read out of the tool's own page
 * rather than repeated here, so a collection cannot drift from what it
 * links to. A path that does not resolve stops the build.
 *
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const hubs = require('./build-hubs.js');
const crumbs = require('./build-crumbs.js');
const outbound = require('./build-outbound.js');
/* the share row and the per-page link-preview card: build-share.js owns
   both, and a page written here must already carry what it would write */
const share = require('./build-share.js');
const proof = require('./build-proof.js'); /* the example, the story and the card thumbnails, as build-proof.js writes them */
const { trailFor } = require('./build/sections.js');
const { COLLECTIONS, PRICING, pricingFor, TILES, HI_HUB } = require('./build/collections.js');
/* Approved showcase entries, when the showcase builder is present. */
let showcase = null;
try { showcase = require('./build-showcase.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
/* the sidebar has one owner; ours must match what it would write */
const { apply: sidebarFor } = require('./build-sidebar.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SECTION = 'for';
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

/** A tool's own words, read from its own page. */
const metaCache = {};
function toolMeta(p) {
  if (metaCache[p]) return metaCache[p];
  const abs = path.join(ROOT, p.replace(/^\/+/, ''), 'index.html');
  if (!fs.existsSync(abs)) throw new Error('a collection points at ' + p + ', which does not exist');
  const src = fs.readFileSync(abs, 'utf8');
  const t = /<title>([^<]*)<\/title>/.exec(src);
  const d = /<meta name="description" content="([^"]*)">/.exec(src);
  if (!t || !d) throw new Error(p + ' has no title or description to read');
  /* The tail of a page title is for search results, not for a card. Two
     passes because the shapes differ: some end "| 1234Tools", some carry a
     selling phrase after a dash. A bare hyphen is deliberately NOT a
     separator here — it would cut "Sugar-Free" down to "Sugar". */
  const fromPage = unesc(t[1])
    .replace(/\s*\|\s*1234Tools\s*$/i, '')
    .replace(/\s*[—–|]\s*(Free\b|AI for Business\b).*$/i, '')
    .trim();
  /* The page title is written for a search result ("Background Remover —
     Free, Private, In Your Browser") and the cut above cannot catch every
     selling tail. The register's title is the tool's own short name, the
     one the search box and the hubs show, so it wins where it exists. */
  const title = registerTitles()[p] || fromPage;
  metaCache[p] = { path: p, title, description: unesc(d[1]), pricing: pricingFor(p) };
  return metaCache[p];
}
let _titles = null;
function registerTitles() {
  if (_titles) return _titles;
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  _titles = {};
  for (const e of box.SEARCH_INDEX || []) _titles['/' + String(e[1]).replace(/^\/+/, '')] = String(e[0]);
  return _titles;
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



/* An English collection and its Hindi twin point at each other, and both
   name the English page as the default for everyone else. */
function alternates(head, slug) {
  const en = SITE + '/' + SECTION + '/' + slug + '/', hi = SITE + '/hi/' + SECTION + '/' + slug + '/';
  const links = '<link rel="alternate" hreflang="en" href="' + en + '">\n<link rel="alternate" hreflang="hi" href="' + hi + '">\n<link rel="alternate" hreflang="x-default" href="' + en + '">';
  return head.replace(/(<link rel="canonical" href="[^"]*">)/, (m) => m + '\n' + links);
}

/* What this audience would want that does not exist yet. Said plainly,
   with the request form one click away: the requests decide the order. */
function nextPanel(c, hi) {
  const list = hi ? (hi.next || []) : (c.next || []);
  if (!list.length) return '';
  const items = list.map((n) => '<li><strong>' + esc(n.name) + '</strong> — ' + esc(n.what) + '</li>').join('');
  return '  <section class="panel collection-next"><h2>' + (hi ? esc(hi.nextHead) : 'Coming next for ' + esc(c.name.toLowerCase())) + '</h2>' +
    '<ul class="tips">' + items + '</ul>' +
    '<p>' + (hi ? esc(hi.nextAsk) + ' <a href="/#ask">' + esc(hi.nextLink) + '</a>'
      : 'Want one of these first, or something else? <a href="/#ask">Ask for it</a> — no account needed, and the requests decide what gets built next.') + '</p></section>\n';
}

/* People who made something with these tools, when any are approved. */
function showcaseStrip(c, hi) {
  if (!showcase || typeof showcase.entriesForAudience !== 'function') return '';
  const list = showcase.entriesForAudience(c.slug) || [];
  if (!list.length) return '';
  return '  <section class="panel collection-made"><h2>' + (hi ? esc(hi.madeHead) : 'Made by people like you') + '</h2><ul class="related">' +
    list.slice(0, 6).map((e) => '<li><a href="' + esc(e.url) + '" rel="noopener ugc" target="_blank">' + esc(e.name) + (e.handle ? ' (@' + esc(e.handle) + ')' : '') + '</a>' + (e.note ? ' — ' + esc(e.note) : '') + '</li>').join('') +
    '</ul><p><a href="/showcase/">' + (hi ? esc(hi.madeAll) : 'See everything people have made') + '</a> · <a href="/showcase/#submit">' + (hi ? esc(hi.madeJoin) : 'Get featured') + '</a></p></section>\n';
}

/* The showcase is linked to only once its page has been built: its form
   posts to a function that has to be deployed first. */
const showcaseLive = () => fs.existsSync(path.join(ROOT, 'showcase', 'index.html'));

const badge = (p) => '<span class="tag tag-' + p.key + '" title="' + esc(p.blurb) + '">' + esc(p.label) + '</span>';

function toolCard(m) {
  return '<a class="card" href="' + m.path + '"><strong>' + esc(m.title) + '</strong>' +
    '<span class="card-desc">' + esc(m.description) + '</span>' + badge(m.pricing) + '</a>';
}

function collectionPage(c, parts) {
  const pathOnly = '/' + SECTION + '/' + c.slug + '/';
  const url = SITE + pathOnly;
  const trail = trailFor(pathOnly);
  const all = [];
  const groups = c.groups.map(g => {
    const cards = g.tools.map(t => { const m = toolMeta(t); all.push(m); return toolCard(m); }).join('');
    return '<section class="collection-group"><h2>' + esc(g.name) + '</h2>' +
      (g.blurb ? '<p class="group-blurb">' + esc(g.blurb) + '</p>' : '') +
      '<div class="grid">' + cards + '</div></section>';
  }).join('\n');
  const freemium = all.filter(m => m.pricing.key === 'freemium').length;
  const related = c.related.map(s => {
    const r = COLLECTIONS.find(x => x.slug === s);
    return r ? '<li><a href="/' + SECTION + '/' + r.slug + '/">' + esc(r.title) + '</a></li>' : '';
  }).join('');

  const body =
    crumbs.render(trail, c.name) + '\n' +
    '<article class="collection">\n' +
    '  <p class="eyebrow">' + (c.kind === 'role' ? 'Tools for' : 'Tools to') + '</p>\n' +
    '  <h1>' + icon(c.glyph).replace('class="ico"', 'class="ico ico-title"') + esc(c.name) + '</h1>\n' +
    '  <p class="lede">' + esc(c.lede) + '</p>\n' +
    '  <p class="collection-count">' + all.length + ' tools' +
      (freemium ? ' · ' + (all.length - freemium) + ' free with no account · ' + freemium + ' free to try with one' : ' · all free, no account needed') + '</p>\n' +
    c.intro.map(x => '  <p class="collection-intro">' + esc(x) + '</p>').join('\n') + '\n' +
    groups + '\n' +
    nextPanel(c) + showcaseStrip(c) +
    (c.hi ? '  <p class="collection-lang"><a href="/hi/' + SECTION + '/' + c.slug + '/" hreflang="hi" lang="hi">यह पेज हिन्दी में पढ़ें</a></p>\n' : '') +
    '  <section class="panel"><h2>Frequently asked questions</h2>' +
      c.faq.map(f => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n' +
    (related ? '  <section class="panel"><h2>Related collections</h2><ul class="related">' + related + '</ul></section>\n' : '') +
    '</article>\n';

  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: c.title, description: c.lede, url,
        mainEntity: { '@type': 'ItemList', numberOfItems: all.length,
          itemListElement: all.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + m.path, name: m.title })) } },
      crumbs.breadcrumbList(trail, c.name, pathOnly),
      { '@type': 'FAQPage', mainEntity: c.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  }) + '</script>\n';

  const head = headFor(parts, pathOnly, c.title, c.lede);
  const html = sidebarFor((c.hi ? alternates(head, c.slug) : head) + ld + parts.mid + '\n' + body + parts.tail, SECTION + '/' + c.slug + '/index.html');
  return proof.apply(share.apply(outbound.rewrite(hubs.apply(html, SECTION + '/index.html'), SECTION).html, SECTION + '/' + c.slug + '/index.html'), SECTION + '/' + c.slug + '/index.html');
}

function hubPage(parts, counts) {
  const pathOnly = '/' + SECTION + '/';
  const trail = trailFor(pathOnly);
  const card = (c) => '<a class="card" href="/' + SECTION + '/' + c.slug + '/"><span class="card-icon">' + icon(c.glyph) + '</span>' +
    '<strong>' + esc(c.name) + '</strong><span class="card-desc">' + esc(c.lede) + '</span></a>';
  /* People in the order the home page's tiles meet them, then the rest. */
  const rank = (c) => { const i = TILES.findIndex((t) => t.slug === c.slug); return i < 0 ? 99 : i; };
  const roles = COLLECTIONS.filter(c => c.kind === 'role').sort((a, b) => rank(a) - rank(b)).map(card).join('');
  const tasks = COLLECTIONS.filter(c => c.kind === 'task').map(card).join('');
  const title = 'Find the right tool: collections by job and by trade';
  const description = 'Every tool on 1234Tools, gathered by who you are and what you are doing — creators, online sellers, students, job seekers, teachers, photographers, designers, accountants and small businesses, and the jobs they all have to get through.';
  const body =
    crumbs.render(trail, 'Collections') + '\n' +
    '<article class="collection">\n' +
    '  <p class="eyebrow">Collections</p>\n' +
    '  <h1>Find the right tool</h1>\n' +
    '  <p class="lede">' + esc(description) + '</p>\n' +
    '  <p class="collection-count">' + counts.total.toLocaleString('en-GB') + ' tools in ' + counts.categories + ' categories · ' +
      counts.free.toLocaleString('en-GB') + ' free with no account at all · ' + counts.freemium + ' free to try with one</p>\n' +
    '  <p class="collection-intro">The sidebar sorts tools by what they are, which is how a librarian would do it. Nobody arrives thinking “I need a Business tool”. These pages sort them the other way — by the person holding the problem, and by the job in front of them.</p>\n' +
    '  <section class="collection-group"><h2>By what you do</h2><p class="group-blurb">The page to bookmark.</p><div class="grid">' + roles + '</div></section>\n' +
    '  <section class="collection-group"><h2>By the job in hand</h2><p class="group-blurb">The page to send somebody.</p><div class="grid">' + tasks + '</div></section>\n' +
    (showcaseLive() ? '  <section class="panel"><h2>Made with these tools</h2><p>People share what they make — a Reel with captions, a thumbnail, a class’s certificates, a shop’s product photos. The best are in the <a href="/showcase/">showcase</a>, with the maker’s name and a link to them. <a href="/showcase/#submit">Send yours</a>: it is checked by a person before anything is shown.</p></section>\n' : '') +
    '  <section class="panel"><h2>What “free” means here</h2><ul class="tips">' +
      '<li><strong>Free, no account.</strong> ' + esc(PRICING.free.blurb) + ' That is ' + counts.free.toLocaleString('en-GB') + ' of them, and it stays that way because they cost us nothing to run — the work happens in your browser, not on our server.</li>' +
      '<li><strong>Free to try, then paid.</strong> ' + esc(PRICING.freemium.blurb) + ' That is the ' + counts.freemium + ' AI tools, which cost us money every time somebody presses the button.</li>' +
      '<li><strong>Nothing is premium-only.</strong> There is no tool you cannot reach without paying. A paid plan raises the monthly allowance on the AI tools; it does not unlock anything that was hidden.</li>' +
      '</ul></section>\n' +
    '</article>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description, url: SITE + pathOnly,
        mainEntity: { '@type': 'ItemList', numberOfItems: COLLECTIONS.length,
          itemListElement: COLLECTIONS.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + '/' + SECTION + '/' + c.slug + '/', name: c.title })) } },
      crumbs.breadcrumbList(trail, 'Collections', pathOnly)
    ]
  }) + '</script>\n';
  const html = sidebarFor(headFor(parts, pathOnly, title, description) + ld + parts.mid + '\n' + body + parts.tail, SECTION + '/index.html');
  return proof.apply(share.apply(outbound.rewrite(hubs.apply(html, SECTION + '/index.html'), SECTION).html, SECTION + '/index.html'), SECTION + '/index.html');
}

/* ---------- Hindi twins ----------
   /hi/for/<slug>/ for every collection with a `hi` entry, and a small hub
   at /hi/for/. The page is the English page's structure with the words
   in Hindi; tool names stay as they appear on the tools themselves, with
   a Hindi line under each, because the tool page the card opens is in
   English and the name is what the reader will see there. */
const HI_BASE = '/hi/' + SECTION + '/';
const hiPricing = { free: 'मुफ़्त', freemium: 'आज़माने के लिए मुफ़्त' };

function hiShell(html) {
  return html
    .replace('<html lang="en-GB"', '<html lang="hi"')
    .replace('<meta property="og:locale" content="en_GB">', '<meta property="og:locale" content="hi_IN">\n<meta property="og:locale:alternate" content="en_GB">');
}

function collectionPageHi(c, parts) {
  const hi = c.hi;
  const pathOnly = HI_BASE + c.slug + '/';
  const url = SITE + pathOnly;
  const trail = trailFor(pathOnly);
  if (hi.groups.length !== c.groups.length) throw new Error('the Hindi ' + c.slug + ' page has ' + hi.groups.length + ' groups, the English one ' + c.groups.length);
  const all = [];
  const groups = c.groups.map((g, gi) => {
    const cards = g.tools.map((t) => {
      const m = toolMeta(t); all.push(m);
      const line = (hi.cards && hi.cards[t]) || m.description;
      return '<a class="card" href="' + m.path + '"><strong>' + esc(m.title) + '</strong>' +
        '<span class="card-desc">' + esc(line) + '</span>' +
        '<span class="tag tag-' + m.pricing.key + '">' + esc(hiPricing[m.pricing.key]) + '</span></a>';
    }).join('');
    const h = hi.groups[gi];
    return '<section class="collection-group"><h2>' + esc(h.name) + '</h2>' +
      (h.blurb ? '<p class="group-blurb">' + esc(h.blurb) + '</p>' : '') + '<div class="grid">' + cards + '</div></section>';
  }).join('\n');
  const freemium = all.filter((m) => m.pricing.key === 'freemium').length;
  const body =
    crumbs.render(trail, hi.name) + '\n' +
    '<article class="collection" lang="hi">\n' +
    '  <p class="eyebrow">' + esc(hi.eyebrow) + '</p>\n' +
    '  <h1>' + icon(c.glyph).replace('class="ico"', 'class="ico ico-title"') + esc(hi.name) + '</h1>\n' +
    '  <p class="lede">' + esc(hi.lede) + '</p>\n' +
    '  <p class="collection-count">' + all.length + ' टूल' +
      (freemium ? ' · ' + (all.length - freemium) + ' बिना अकाउंट के मुफ़्त · ' + freemium + ' अकाउंट के साथ आज़माने के लिए मुफ़्त' : ' · सब मुफ़्त, कोई अकाउंट नहीं') + '</p>\n' +
    hi.intro.map((x) => '  <p class="collection-intro">' + esc(x) + '</p>').join('\n') + '\n' +
    groups + '\n' +
    nextPanel(c, hi) + showcaseStrip(c, hi) +
    '  <p class="collection-lang"><a href="/' + SECTION + '/' + c.slug + '/" hreflang="en" lang="en">Read this page in English</a></p>\n' +
    '  <section class="panel"><h2>' + esc(hi.faqHead) + '</h2>' +
      hi.faq.map((f) => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n' +
    '</article>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: hi.title, description: hi.lede, url, inLanguage: 'hi',
        mainEntity: { '@type': 'ItemList', numberOfItems: all.length,
          itemListElement: all.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + m.path, name: m.title })) } },
      crumbs.breadcrumbList(trail, hi.name, pathOnly),
      { '@type': 'FAQPage', inLanguage: 'hi', mainEntity: hi.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  }) + '</script>\n';
  const rel = 'hi/' + SECTION + '/' + c.slug + '/index.html';
  const head = alternates(headFor(parts, pathOnly, hi.title, hi.lede), c.slug)
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">');
  const html = hiShell(sidebarFor(head + ld + parts.mid + '\n' + body + parts.tail, rel));
  return proof.apply(share.apply(outbound.rewrite(hubs.apply(html, SECTION + '/index.html'), SECTION).html, rel), rel);
}

function hubPageHi(parts, list) {
  const h = HI_HUB;
  const pathOnly = HI_BASE;
  const trail = trailFor(pathOnly);
  const cards = list.map((c) => '<a class="card" href="' + HI_BASE + c.slug + '/"><span class="card-icon">' + icon(c.glyph) + '</span>' +
    '<strong>' + esc(c.hi.name) + '</strong><span class="card-desc">' + esc(c.hi.lede) + '</span></a>').join('');
  const body =
    crumbs.render(trail, h.name) + '\n' +
    '<article class="collection" lang="hi">\n' +
    '  <p class="eyebrow">' + esc(h.eyebrow) + '</p>\n' +
    '  <h1>' + esc(h.h1) + '</h1>\n' +
    '  <p class="lede">' + esc(h.lede) + '</p>\n' +
    (h.intro || []).map((x) => '  <p class="collection-intro">' + esc(x) + '</p>').join('\n') + '\n' +
    '  <section class="collection-group"><h2>' + esc(h.groupHead) + '</h2><div class="grid">' + cards + '</div></section>\n' +
    '  <p class="collection-lang"><a href="/' + SECTION + '/" hreflang="en" lang="en">All collections, in English</a></p>\n' +
    '</article>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: h.title, description: h.lede, url: SITE + pathOnly, inLanguage: 'hi',
        mainEntity: { '@type': 'ItemList', numberOfItems: list.length,
          itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + HI_BASE + c.slug + '/', name: c.hi.title })) } },
      crumbs.breadcrumbList(trail, h.name, pathOnly)
    ]
  }) + '</script>\n';
  const html = hiShell(sidebarFor(headFor(parts, pathOnly, h.title, h.lede) + ld + parts.mid + '\n' + body + parts.tail, 'hi/' + SECTION + '/index.html'));
  return proof.apply(share.apply(outbound.rewrite(hubs.apply(html, SECTION + '/index.html'), SECTION).html, 'hi/' + SECTION + '/index.html'), 'hi/' + SECTION + '/index.html');
}

/* ---------- wiring ---------- */

function counts() {
  /* The index is the register of what exists, so read it rather than
     counting brackets: one wrong pattern here becomes a wrong number on
     every page that prints a total. */
  const src = fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8');
  const box = {};
  new Function('window', src)(box);
  const entries = box.SEARCH_INDEX || [];
  const total = entries.length;
  const freemium = entries.filter(e => String(e[1]).indexOf('ai/') === 0).length;
  /* A category is a top-level section that holds tools: not a meta page,
     not the home page, and not one of the conversion families, which are
     shown underneath their parent rather than beside it. */
  const { SECTIONS } = require('./build/sections.js');
  const categories = Object.keys(SECTIONS).filter(k => {
    const parts = k.split('/').filter(Boolean);
    return parts.length === 1 && !SECTIONS[k].meta;
  }).length;
  return { total, freemium, free: total - freemium, categories };
}

function patchSitemap() {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const hiList = COLLECTIONS.filter((c) => c.hi);
  const urls = ['/' + SECTION + '/'].concat(COLLECTIONS.map(c => '/' + SECTION + '/' + c.slug + '/'),
    HI_HUB && hiList.length ? [HI_BASE].concat(hiList.map((c) => HI_BASE + c.slug + '/')) : []);
  const add = urls.filter(u => src.indexOf('<loc>' + SITE + u + '</loc>') < 0)
    .map(u => '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>');
  if (!add.length) return 0;
  write(rel, src.replace('</urlset>', add.join('\n') + '\n</urlset>'));
  return add.length;
}

/** A way in from the homepage, above the category grid. */
function patchHome(counts) {
  const rel = 'index.html';
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const marker = '<!-- COLLECTIONS -->';
  /* The people have tiles of their own now (audienceBlock); this row is
     the jobs, plus every trade that has no tile, so nothing drops off. */
  const chips = COLLECTIONS.filter((c) => c.kind === 'task' || !TILES.some((t) => t.slug === c.slug));
  const block = marker + '\n<section class="home-collections">\n' +
    '  <h2 class="section-title">Or start from the job in hand</h2>\n' +
    '  <p class="section-lede">' + counts.total.toLocaleString('en-GB') + ' tools is a lot to browse. These are the short lists for the jobs everybody has to get through.</p>\n' +
    '  <div class="chip-row">' +
    chips.map(c => '<a class="chip" href="/' + SECTION + '/' + c.slug + '/">' + esc(c.name) + '</a>').join('') +
    '<a class="chip chip-more" href="/' + SECTION + '/">All collections</a>' +
    '</div>\n</section>\n<!-- /COLLECTIONS -->';
  let out;
  if (html.indexOf(marker) >= 0) {
    out = html.replace(/<!-- COLLECTIONS -->[\s\S]*?<!-- \/COLLECTIONS -->/, block);
  } else {
    const at = html.indexOf('<h2 class="section-title">Browse by category</h2>');
    if (at < 0) throw new Error('could not find the category heading on the homepage');
    const before = html.lastIndexOf('<section', at);
    out = html.slice(0, before) + block + '\n' + html.slice(before);
  }
  /* The "I am a…" tiles. Placed after the hero the first time; from then
     on build-home.js decides where the block sits (ORDER) and this only
     rewrites what is inside the markers. */
  const aud = audienceBlock();
  if (/<!-- AUDIENCES -->[\s\S]*?<!-- \/AUDIENCES -->/.test(out)) out = out.replace(/<!-- AUDIENCES -->[\s\S]*?<!-- \/AUDIENCES -->/, () => aud);
  else {
    const hero = out.indexOf('<!-- /HOME-HERO -->');
    const at = hero >= 0 ? hero + '<!-- /HOME-HERO -->'.length : out.indexOf(marker);
    out = out.slice(0, at) + '\n' + aud + '\n' + out.slice(at);
  }
  return write(rel, proof.apply(share.apply(outbound.rewrite(out, 'home').html, rel), rel));
}

/* One tile per audience: who, how many tools, and the three that sell the
   page — named as each tool names itself, less any bracketed aside. */
function audienceBlock() {
  const tiles = TILES.map((t) => {
    const c = COLLECTIONS.find((x) => x.slug === t.slug);
    const n = new Set(c.groups.flatMap((g) => g.tools)).size;
    const picks = t.picks.map((p) => esc(toolMeta(p).title.replace(/\s*\([^)]*\)\s*$/, ''))).join(' · ');
    return '<a class="aud-tile" href="/' + SECTION + '/' + t.slug + '/" style="--aud-h:' + Number(t.hue) + '">' +
      '<span class="aud-ico">' + icon(c.glyph) + '</span>' +
      '<strong class="aud-name">' + esc(t.label) + '</strong>' +
      '<span class="aud-n">' + n + ' tools</span>' +
      '<span class="aud-picks">' + picks + '</span></a>';
  }).join('');
  const hi = HI_HUB && COLLECTIONS.some((c) => c.hi)
    ? '<p class="aud-lang"><a href="' + HI_BASE + '" hreflang="hi" lang="hi">' + esc(HI_HUB.homeLink) + '</a></p>' : '';
  return '<!-- AUDIENCES -->\n<section class="home-aud" aria-labelledby="aud-head">\n' +
    '  <h2 class="section-title" id="aud-head">I am a…</h2>\n' +
    '  <p class="section-lede">Pick what you do and get the short list made for it: the tools, why each is there, and what is coming next.</p>\n' +
    '  <div class="aud-grid">' + tiles + '</div>\n' + (hi ? '  ' + hi + '\n' : '') +
    (showcaseLive() ? '  <p class="aud-made">Made something with one of these tools? <a href="/showcase/">See what people have made</a>, and <a href="/showcase/#submit">send yours to be featured</a>, with your name and a link to you.</p>\n' : '') +
    '</section>\n<!-- /AUDIENCES -->';
}

function bumpServiceWorker() {
  const rel = 'sw.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return write(rel, src.replace(/var V = '1234tools-v(\d+)';/, (m, n) => "var V = '1234tools-v" + (Number(n) + 1) + "';"));
}

function main() {
  const parts = shell();
  const c = counts();
  let built = 0;
  for (const col of COLLECTIONS) if (write(SECTION + '/' + col.slug + '/index.html', collectionPage(col, parts))) built++;
  if (write(SECTION + '/index.html', hubPage(parts, c))) built++;
  const hiList = COLLECTIONS.filter((x) => x.hi);
  let hiBuilt = 0;
  if (hiList.length) {
    if (!HI_HUB) throw new Error('build/collections-hi.js has Hindi pages but no _hub entry');
    for (const col of hiList) if (write('hi/' + SECTION + '/' + col.slug + '/index.html', collectionPageHi(col, parts))) hiBuilt++;
    if (write('hi/' + SECTION + '/index.html', hubPageHi(parts, hiList))) hiBuilt++;
  }
  const mapped = patchSitemap();
  const home = patchHome(c);
  const sw = changes.length ? bumpServiceWorker() : false;

  console.log('\nbuild-collections.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  collections         ' + COLLECTIONS.filter(x => x.kind === 'role').length + ' by trade, ' + COLLECTIONS.filter(x => x.kind === 'task').length + ' by job');
  console.log('  tools referenced    ' + Object.keys(metaCache).length + ' distinct');
  console.log('  counts              ' + c.total + ' tools, ' + c.categories + ' categories, ' + c.free + ' free, ' + c.freemium + ' freemium');
  console.log('  pages written       ' + built + (hiList.length ? ' + ' + hiBuilt + ' Hindi (' + hiList.map((x) => x.slug).join(', ') + ')' : ''));
  console.log('  home tiles          ' + TILES.length);
  console.log('  sitemap             ' + (mapped ? mapped + ' added' : 'unchanged'));
  console.log('  homepage            ' + (home ? 'collections row updated' : 'unchanged'));
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
module.exports = { counts, toolMeta };
