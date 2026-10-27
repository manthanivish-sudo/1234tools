/**
 * The quiz and party games section: a hub at /games/, a page per game, the
 * landing pages for the jobs people search for ("tambola for diwali",
 * "random groups for a class"), and their place in the search index, the
 * sitemap, the homepage and the sidebar.
 *
 *   node build-games.js          apply
 *   node build-games.js --check  report what would change, write nothing
 *   node build-games.js --verbose  list the files
 *
 * Games come from every engine/game-<slug>.js that adds a spec to
 * window.GAME_TOOLS (one per file, so several people can add games at once;
 * shared files such as engine/game-kit.js add none). This script runs those
 * files in Node to read the specs and writes each page in the site's current
 * shape, cut from an existing tool page so the shell is whatever the shell
 * is today. A game mounts itself on DOMContentLoaded into
 * [data-tool=<slug>] .tool-io; nothing a visitor types is uploaded.
 *
 * A spec's `landings` are pages of their own at /games/<landing-slug>/: the
 * same game, already set for that job through `data-preset` (JSON the game
 * reads with GameKit.preset), with the job's own words and questions. They
 * are pages to be found, not tools: they go in the sitemap, not the search
 * index (build-site.js keeps every indexable page in the sitemap).
 *
 * A copy of build-social.js with the section, the glyph, the hub copy, the
 * homepage placement and the landing pages changed; the two should keep
 * moving together. Requiring this file does nothing.
 *
 * Counts, breadcrumbs and PWA manifests are left to build-sidebar,
 * build-sections, build-crumbs and build-pwa, which run after this.
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const hubs = require('./build-hubs.js');
const crumbs = require('./build-crumbs.js');
const outbound = require('./build-outbound.js');
const sidebar = require('./build-sidebar.js');
const share = require('./build-share.js'); /* the share bar and og:image, as build-share.js writes them */
const { footerApply } = require('./build-site.js'); /* the footer note, as build-site.js words it */
const proof = require('./build-proof.js'); /* the example, the story and the card thumbnails, as build-proof.js writes them */
const depth = require('./build-depth.js'); /* the reading part from build/content/games.js, as build-depth.js writes it */
const { SECTIONS, trailFor } = require('./build/sections.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SECTION = 'games';
const SHELL_PAGE = 'image/background-remover/index.html';

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
const icon = (id, cls) => '<svg class="' + (cls || 'ico') + '" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + id + '"></use></svg>';

/* One spec per game: every engine/game-<slug>.js may add one. `order` in a
   spec fixes its place on the hub; a spec without one sorts after those
   that have it. */
function tools() {
  const w = {};
  const dir = path.join(ROOT, 'engine');
  const files = fs.readdirSync(dir).filter((f) => /^game-[a-z0-9-]+\.js$/.test(f)).sort();
  for (const f of files) new Function('window', 'document', fs.readFileSync(path.join(dir, f), 'utf8'))(w, undefined);
  const list = Object.entries(w.GAME_TOOLS || {}).map(([slug, spec]) => ({ slug, spec }));
  const ord = (t) => (typeof t.spec.order === 'number' ? t.spec.order : 999);
  return list.sort((a, b) => ord(a) - ord(b) || a.slug.localeCompare(b.slug));
}
/** Every landing page, with the game it mounts. */
function landings(list) {
  const out = [];
  for (const t of list) for (const L of t.spec.landings || []) out.push({ t, L });
  return out;
}
/** For build-site.js and the tests: the landing pages' addresses. */
function landingPaths() { return landings(tools()).map((x) => '/' + SECTION + '/' + x.L.slug + '/'); }
/** For build-finder.js: one Tool Finder row per landing page that exists, in
    build-landing.js's shape, so "random name picker" opens the wheel's page
    for that job. `io` is the game's own in->out line. */
function finderRows(ioOf) {
  const name = SECTIONS['/' + SECTION + '/'].name;
  return landings(tools())
    .filter((x) => fs.existsSync(path.join(ROOT, SECTION, x.L.slug, 'index.html')))
    .map(({ t, L }) => [L.title, SECTION + '/' + L.slug + '/', t.spec.glyph || ('i-' + t.slug), name, L.description,
      (L.keywords || t.spec.keywords || []).join(' | '), ioOf ? ioOf(SECTION + '/' + t.slug + '/') : '', '', 'landing']);
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

function headFor(parts, urlPath, title, description, scripts) {
  const url = SITE + urlPath;
  return parts.head
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(title) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">')
    .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(title) + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(description) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '')
    .replace(/<!-- PWA: generated by build-pwa\.js, do not edit -->[\s\S]*?<!-- \/PWA -->\n?/, '')
    .replace(/(<script src="\/engine\/[^"]*"[^>]*><\/script>\n?)+/, (scripts || []).map((s) => '<script src="' + s + '" defer></script>\n').join(''));
}

/* build-pwa.js owns the block; keep what it wrote last time so this script
   and that one are not rewriting each other */
function keepPwa(rel, html) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return html;
  const pwa = /<!-- PWA: generated by build-pwa\.js, do not edit -->[\s\S]*?<!-- \/PWA -->\n?/.exec(fs.readFileSync(abs, 'utf8'));
  return pwa ? html.replace('<link rel="stylesheet" href="/assets/app.css">', pwa[0] + '<link rel="stylesheet" href="/assets/app.css">') : html;
}

/* build-site.js owns the generated half of the related list — everything
   after its marker. Carry it over when the page is regenerated, or the two
   scripts rewrite each other for ever. */
const REL_MARK = '<!--related: generated by build-site.js, edit above this line-->';
function keepRelated(rel, html) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return html;
  const was = fs.readFileSync(abs, 'utf8');
  const at = was.indexOf(REL_MARK);
  if (at < 0) return html;
  const end = was.indexOf('</ul>', at);
  if (end < 0) return html;
  const tail = was.slice(at, end);
  return html.replace(/(<section class="panel"><h2>Related tools<\/h2><ul class="related">[\s\S]*?)(<\/ul><\/section>)/,
    (all, head, close) => (head.indexOf(REL_MARK) >= 0 ? all : head + tail + close));
}

function relatedItems(t) {
  return (t.spec.related || []).map((p) => {
    const abs = path.join(ROOT, p.replace(/^\/+/, ''), 'index.html');
    if (!fs.existsSync(abs)) throw new Error(t.slug + ' relates to ' + p + ', which does not exist');
    const m = /<title>([^<|—]*)/.exec(fs.readFileSync(abs, 'utf8'));
    return '<li><a href="' + p + '">' + esc(m ? m[1].trim() : p) + '</a></li>';
  });
}
const faqHtml = (faq) => '  <section class="panel"><h2>Frequently asked questions</h2>' + faq.map((f) => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n';
const faqLd = (faq) => ({ '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
const appLd = (name, description, url, keywords) => ({ '@type': 'SoftwareApplication', name, description, url, applicationCategory: 'GameApplication', operatingSystem: 'Any', browserRequirements: 'Requires a current browser; nothing is uploaded.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, keywords: (keywords || []).join(', ') });

/* ------------------------------------------------------------------ */

function toolPage(t, parts, all) {
  const pathOnly = '/' + SECTION + '/' + t.slug + '/';
  const trail = trailFor(pathOnly);
  const s = t.spec;
  const sec = SECTIONS['/' + SECTION + '/'];
  const siblings = all.filter((x) => x.slug !== t.slug).map((x) => '<li><a href="/' + SECTION + '/' + x.slug + '/">' + esc(x.spec.title) + '</a></li>');
  const ready = (s.landings || []).map((L) => '<li><a href="/' + SECTION + '/' + L.slug + '/">' + esc(L.title) + '</a></li>');
  const body =
    crumbs.render(trail, s.title) + '\n' +
    '<article class="tool game-tool" data-tool="' + t.slug + '">\n' +
    '  <p class="eyebrow">' + esc(sec.name) + '</p>\n' +
    '  <h1>' + icon(s.glyph, 'ico ico-title') + esc(s.title) + '</h1>\n' +
    '  <p class="lede">' + esc(s.description) + '</p>\n' +
    '  <div class="tool-io"><noscript><p class="game-msg">This game runs in your browser and needs JavaScript switched on.</p></noscript></div>\n' +
    '  <section class="panel"><h2>Privacy</h2><p class="privacy-line">' + esc(s.privacy) + '</p></section>\n' +
    '  <section class="panel"><h2>How it works</h2><ol class="tips">' + (s.how || []).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol></section>\n' +
    (s.uses && s.uses.length ? '  <section class="panel"><h2>Where people use it</h2><ul class="tips">' + s.uses.map((u) => '<li><strong>' + esc(u[0]) + '</strong> — ' + esc(u[1]) + '</li>').join('') + '</ul></section>\n' : '') +
    '  <section class="panel"><h2>Tips</h2><ul class="tips">' + (s.tips || []).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></section>\n' +
    (ready.length ? '  <section class="panel"><h2>Ready-made for</h2><ul class="related">' + ready.join('') + '</ul></section>\n' : '') +
    faqHtml(s.faq || []) +
    '  <section class="panel"><h2>Related tools</h2><ul class="related">' + siblings.concat(relatedItems(t)).join('') + '</ul></section>\n' +
    '</article>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [appLd(s.title, s.description, SITE + pathOnly, s.keywords), crumbs.breadcrumbList(trail, s.title, pathOnly), faqLd(s.faq || [])]
  }) + '</script>\n';
  const rel = SECTION + '/' + t.slug + '/index.html';
  const html = headFor(parts, pathOnly, s.pageTitle || (s.title + ' — Free, No Sign-up | 1234Tools'), s.description, s.scripts) + ld + parts.mid + '\n' + body + parts.tail;
  return footerApply(depth.apply(proof.apply(share.apply(outbound.rewrite(keepRelated(rel, keepPwa(rel, hubs.apply(sidebar.apply(html, rel), rel))), SECTION).html, rel), rel), rel), rel);
}

/* A landing page: the same game, preset for one job, in that job's words. */
function landingPage(x, parts, all) {
  const { t, L } = x;
  const pathOnly = '/' + SECTION + '/' + L.slug + '/';
  const trail = trailFor(pathOnly);
  const s = t.spec;
  const sec = SECTIONS['/' + SECTION + '/'];
  const faq = (L.faq || []).concat((s.faq || []).slice(0, 4));
  const others = landings(all).filter((y) => y.L.slug !== L.slug).slice(0, 6)
    .map((y) => '<li><a href="/' + SECTION + '/' + y.L.slug + '/">' + esc(y.L.title) + '</a></li>');
  const body =
    crumbs.render(trail, L.title) + '\n' +
    '<article class="tool game-tool game-landing" data-tool="' + t.slug + '" data-preset="' + esc(JSON.stringify(L.preset || {})) + '">\n' +
    '  <p class="eyebrow">' + esc(sec.name) + '</p>\n' +
    '  <h1>' + icon(s.glyph, 'ico ico-title') + esc(L.title) + '</h1>\n' +
    '  <p class="lede">' + esc(L.lede || L.description) + '</p>\n' +
    '  <div class="tool-io"><noscript><p class="game-msg">This game runs in your browser and needs JavaScript switched on.</p></noscript></div>\n' +
    '  <section class="panel"><h2>Set up for this</h2>' + (L.about || []).map((p) => '<p>' + esc(p) + '</p>').join('') +
    '<p>The full game, with every setting, is the <a href="/' + SECTION + '/' + t.slug + '/">' + esc(s.title) + '</a>.</p></section>\n' +
    '  <section class="panel"><h2>How it works</h2><ol class="tips">' + (s.how || []).map((y) => '<li>' + esc(y) + '</li>').join('') + '</ol></section>\n' +
    '  <section class="panel"><h2>Privacy</h2><p class="privacy-line">' + esc(s.privacy) + '</p></section>\n' +
    faqHtml(faq) +
    '  <section class="panel"><h2>Related tools</h2><ul class="related"><li><a href="/' + SECTION + '/' + t.slug + '/">' + esc(s.title) + '</a></li>' + others.join('') + '</ul></section>\n' +
    '</article>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [appLd(L.title, L.description, SITE + pathOnly, s.keywords), crumbs.breadcrumbList(trail, L.title, pathOnly), faqLd(faq)]
  }) + '</script>\n';
  const rel = SECTION + '/' + L.slug + '/index.html';
  const title = L.pageTitle || (L.title + ' — Free | 1234Tools');
  const html = headFor(parts, pathOnly, title, L.description, s.scripts) + ld + parts.mid + '\n' + body + parts.tail;
  return footerApply(proof.apply(share.apply(outbound.rewrite(keepPwa(rel, hubs.apply(sidebar.apply(html, rel), rel)), SECTION).html, rel), rel), rel);
}

function hubPage(parts, all) {
  const sec = SECTIONS['/' + SECTION + '/'];
  const n = all.length;
  const title = 'Quiz & Party Games — Free for Family Nights | 1234Tools';
  const description = 'Free games for a family quiz night or a party: spin the wheel, random teams, a scoreboard, a buzzer, a Tambola caller and printable tickets. No sign-up.';
  const cards = all.map((t) => '<a class="card" href="/' + SECTION + '/' + t.slug + '/"><span class="card-icon">' + icon(t.spec.glyph) + '</span><strong>' + esc(t.spec.title) + '</strong><span class="card-desc">' + esc(t.spec.description) + '</span></a>').join('');
  const ready = landings(all).map((x) => '<li><a href="/' + SECTION + '/' + x.L.slug + '/">' + esc(x.L.title) + '</a></li>').join('');
  const body =
    crumbs.render([], sec.hub || sec.name) + '\n' +
    '<p class="eyebrow">' + esc(sec.name) + '</p>\n' +
    '<h1>' + icon('i-games', 'ico ico-title') + esc(sec.name) + '</h1>\n' +
    '<p class="lede">Everything a quiz night or a party needs, run from one laptop or phone with the TV as the big screen: pick names, make teams, keep score, find who buzzed first, call Tambola and print the tickets. No sign-up, no adverts in the game, and nothing anyone types leaves the device. ' + n + ' game' + (n === 1 ? '' : 's') + ' so far.</p>\n' +
    '<div class="grid">' + cards + '</div>\n' +
    (ready ? '<section class="panel"><h2>Ready-made for</h2><ul class="related">' + ready + '</ul></section>\n' : '') +
    '<section class="panel"><h2>Made for the big screen</h2>' +
    '<p>Every game has a big-screen view. Press <strong>Show on TV</strong> and the game opens in a second window: drag it to the TV or projector, or cast that browser tab, and press Full screen. The page you started on stays your remote. With one screen, <strong>Full screen here</strong> does the same on the device in your hand.</p>' +
    '<p>The controls are large enough for small fingers and older eyes, every button works from the keyboard, and the games work offline once they have opened once — useful at a party where the signal is poor. Each game can be installed as its own app from the browser’s menu.</p></section>\n' +
    '<section class="panel"><h2>Frequently asked questions</h2>' +
    '<details><summary>Is anything uploaded?</summary><p>No. Names, scores and settings are handled by the page in your browser. The TV window talks to the page on the same device, not through us.</p></details>' +
    '<details><summary>Do I need an account or an app?</summary><p>No. Open the page and play. Installing a game from the browser’s menu is optional and makes it open like an app.</p></details>' +
    '<details><summary>Are the random picks fair?</summary><p>Yes. Wheels, teams and the Tambola caller draw from your browser’s cryptographic random number generator with rejection sampling, so every outcome is equally likely.</p></details>' +
    '<details><summary>Can I use them in a school or at work?</summary><p>Yes, for free, as often as you like.</p></details></section>\n' +
    '<p>Missing a game? Describe it in the finder at the top of this page; when it is not here the finder offers a request form. <a href="/contact/">The contact page</a> works too.</p>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: sec.name, description, url: SITE + '/' + SECTION + '/', mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: all.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.spec.title, url: SITE + '/' + SECTION + '/' + t.slug + '/' })) } },
      crumbs.breadcrumbList([], sec.hub || sec.name, '/' + SECTION + '/')
    ]
  }) + '</script>\n';
  const rel = SECTION + '/index.html';
  const html = headFor(parts, '/' + SECTION + '/', title, description, []) + ld + parts.mid + '\n' + body + parts.tail;
  return footerApply(proof.apply(share.apply(outbound.rewrite(keepPwa(rel, hubs.apply(sidebar.apply(html, rel), rel)), SECTION).html, rel), rel), rel);
}

/* ---------- wiring ---------- */

function patchSearchIndex(list) {
  const rel = 'assets/search-index.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const add = list.filter((t) => src.indexOf('"' + SECTION + '/' + t.slug + '/"') < 0)
    .map((t) => '["' + t.spec.title.replace(/"/g, '\\"') + '","' + SECTION + '/' + t.slug + '/","' + String(t.spec.glyph || ('i-' + t.slug)).replace(/^i-/, '') + '"]');
  if (!add.length) return 0;
  write(rel, src.replace(/\];\s*$/, ',' + add.join(',') + '];\n'));
  return add.length;
}
function patchSitemap(list) {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const urls = ['/' + SECTION + '/'].concat(list.map((t) => '/' + SECTION + '/' + t.slug + '/'), landings(list).map((x) => '/' + SECTION + '/' + x.L.slug + '/'));
  const add = urls.filter((u) => src.indexOf('<loc>' + SITE + u + '</loc>') < 0)
    .map((u) => '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>' + (u === '/' + SECTION + '/' ? '0.8' : '0.7') + '</priority></url>');
  if (!add.length) return 0;
  write(rel, src.replace('</urlset>', add.join('\n') + '\n</urlset>'));
  return add.length;
}
/** A section card on the homepage, beside the social media tools (or the AI video tools). */
function patchHome(count) {
  const rel = 'index.html';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const sec = SECTIONS['/' + SECTION + '/'];
  const card = '<a class="card card-lg" href="/' + SECTION + '/"><span class="card-icon">' + icon('i-games') + '</span><strong>' + esc(sec.name) + '</strong><span class="card-desc">' + count + (count === 1 ? ' tool' : ' tools') + '</span></a>';
  const have = /<a class="card card-lg" href="\/games\/">[\s\S]*?<\/a>/.exec(src);
  if (have) return have[0] === card ? false : write(rel, src.replace(have[0], card));
  const beside = /<a class="card card-lg" href="\/social\/">[\s\S]*?<\/a>/.exec(src) || /<a class="card card-lg" href="\/ai-video\/">[\s\S]*?<\/a>/.exec(src);
  if (!beside) throw new Error('the homepage has no Social or AI Video card to sit beside');
  return write(rel, src.replace(beside[0], beside[0] + card));
}

const GLYPHS = {
  /* a trophy: the section's mark */
  'i-games': '<symbol id="i-games" viewBox="0 0 24 24">\n  <path d="M7 3.5h10v5.2a5 5 0 0 1-10 0z"/>\n  <path d="M7 5.5H4.2v1.3A3.2 3.2 0 0 0 7.4 10"/>\n  <path d="M17 5.5h2.8v1.3A3.2 3.2 0 0 1 16.6 10"/>\n  <path d="M12 13.7v3.6"/>\n  <path d="M8 20.5h8M9.2 17.3h5.6v3.2H9.2z"/>\n</symbol>'
};
function patchIcons(list) {
  const rel = 'assets/icons.svg';
  let svg = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let added = 0;
  const own = {};
  list.forEach((t) => { if (t.spec.glyphSvg) own[t.spec.glyph] = t.spec.glyphSvg; });
  for (const g of ['i-games'].concat(list.map((t) => t.spec.glyph))) {
    if (svg.indexOf('id="' + g + '"') >= 0) continue;
    const sym = own[g] || GLYPHS[g];
    if (!sym) throw new Error('no glyph drawn for ' + g);
    svg = svg.replace('</svg>', sym + '\n</svg>');
    added++;
  }
  if (added) write(rel, svg);
  return added;
}

/* The site total on every page is owned by build/totals.js, which reads the
   length of the search index and rewrites the phrases that print it. */
const { indexTotal, patchTotal: patchTotalPages } = require('./build/totals.js');
const patchTotal = (total) => patchTotalPages(total, changes, CHECK);
function bumpServiceWorker() {
  const rel = 'sw.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return write(rel, src.replace(/var V = '1234tools-v(\d+)';/, (m, n) => "var V = '1234tools-v" + (Number(n) + 1) + "';"));
}

function check(list) {
  const slugs = new Set();
  for (const t of list) {
    for (const s of t.spec.scripts || []) {
      if (!fs.existsSync(path.join(ROOT, s.replace(/^\/+/, '')))) throw new Error(t.slug + ' loads ' + s + ', which does not exist');
    }
    if ((t.spec.scripts || [])[0] !== '/engine/game-kit.js') throw new Error(t.slug + ' must load /engine/game-kit.js first');
    if (!t.spec.faq || t.spec.faq.length < 6) throw new Error(t.slug + ' needs at least six FAQ entries');
    if (!t.spec.privacy) throw new Error(t.slug + ' has no privacy line');
    if (!t.spec.description || t.spec.description.length > 300) throw new Error(t.slug + ': the description must be 1-300 characters');
    const title = t.spec.pageTitle || (t.spec.title + ' — Free, No Sign-up | 1234Tools');
    if (title.length > 70) throw new Error(t.slug + ': the page title is ' + title.length + ' characters, over 70');
    if (slugs.has(t.slug)) throw new Error('two games use the slug ' + t.slug);
    slugs.add(t.slug);
  }
  for (const { t, L } of landings(list)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(L.slug || '')) throw new Error(t.slug + ' has a landing page with a bad slug: ' + L.slug);
    if (slugs.has(L.slug)) throw new Error('the landing page ' + L.slug + ' collides with another page');
    slugs.add(L.slug);
    if (!L.title || !L.description || L.description.length > 300) throw new Error(L.slug + ': a landing page needs a title and a 1-300 character description');
    const title = L.pageTitle || (L.title + ' — Free | 1234Tools');
    if (title.length > 70) throw new Error(L.slug + ': the page title is ' + title.length + ' characters, over 70');
    if (!L.faq || L.faq.length < 2) throw new Error(L.slug + ' needs at least two questions of its own');
  }
}

function main() {
  if (!SECTIONS['/' + SECTION + '/']) throw new Error('build/sections.js has no entry for /' + SECTION + '/');
  if (!sidebar.ORDER.some((x) => x[0] === '/' + SECTION + '/')) throw new Error('build-sidebar.js ORDER has no row for /' + SECTION + '/');
  const list = tools();
  check(list);
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /<small>([\d,]+)\+ free tools<\/small>/.exec(home);
  if (!m) throw new Error('could not read the tool total from index.html');
  const oldTotal = m[1];

  /* glyphs and the index first: the sidebar every page is cut with reads
     its counts from the index, and the title icon must exist */
  const glyphs = patchIcons(list);
  const indexed = patchSearchIndex(list);
  const total = indexTotal() + (CHECK ? list.filter((t) => !fs.existsSync(path.join(ROOT, SECTION, t.slug, 'index.html'))).length : 0);
  const newTotal = Number(total).toLocaleString('en-GB');
  const parts = shell();
  let built = 0, fresh = 0, lands = 0;
  for (const t of list) {
    const rel = SECTION + '/' + t.slug + '/index.html';
    if (!fs.existsSync(path.join(ROOT, rel))) fresh++;
    if (write(rel, toolPage(t, parts, list))) built++;
  }
  for (const x of landings(list)) if (write(SECTION + '/' + x.L.slug + '/index.html', landingPage(x, parts, list))) lands++;
  const hub = write(SECTION + '/index.html', hubPage(parts, list));
  const mapped = patchSitemap(list);
  const homeCard = patchHome(list.length);
  const totals = patchTotal(total);
  const sw = changes.length ? bumpServiceWorker() : false;

  console.log('\nbuild-games.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  games               ' + list.length + ': ' + list.map((t) => t.slug).join(', '));
  console.log('  pages written       ' + built + ' (' + fresh + ' new)' + (hub ? ' + hub' : ''));
  console.log('  landing pages       ' + landings(list).length + (lands ? ' (' + lands + ' written)' : ' (unchanged)'));
  console.log('  homepage card       ' + (homeCard ? 'written' : 'unchanged'));
  console.log('  search index        ' + (indexed ? indexed + ' added' : 'unchanged'));
  console.log('  sitemap             ' + (mapped ? mapped + ' added' : 'unchanged'));
  console.log('  icons               ' + (glyphs ? glyphs + ' glyph(s) added' : 'unchanged'));
  console.log('  site total          ' + oldTotal + ' → ' + newTotal + (totals ? ' on ' + totals + ' pages' : ''));
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
  if (process.argv.includes('--verbose')) changes.forEach((c) => console.log('    ' + c));
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('\nbuild-games.js failed: ' + (e && e.message || e) + '\n'); process.exit(1); }
}
module.exports = { tools, landingPaths, finderRows };
