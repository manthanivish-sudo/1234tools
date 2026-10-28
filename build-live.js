/**
 * The live audience section: a hub at /live/, a page per live tool (poll,
 * word cloud, Q&A, rating scale, presentation), their landing pages, and their place in
 * the search index, the sitemap, the homepage and the sidebar. Also puts
 * the phone page /join/ in the sitemap.
 *
 *   node build-live.js          apply
 *   node build-live.js --check  report what would change, write nothing
 *   node build-live.js --verbose  list the files
 *
 * Tools come from every engine/room-<slug>.js that adds a spec to
 * window.ROOM_TOOLS. The shared files engine/room-client.js (the relay
 * client), room-kit.js (the presenter's kit), room-words.js (the rude-word
 * list) and room-join.js / room-join-hi.js / room-join-quiz.js /
 * room-join-deck.js (the phone page and its lazy cards) add none and are
 * skipped. A copy of build-games.js with the section, the glyph, the hub copy,
 * the homepage placement, the "Live" badge and the step-by-step manual
 * changed; the two should keep moving together. Requiring this file does
 * nothing.
 *
 * These are the first free tools whose answers leave the device: they pass
 * through the relay at live.1234tools.com to reach the presenter's screen.
 * Every page says so in the badge under its title and in the approved
 * privacy text (spec.privacy, checked word for word below), and its footer
 * note is worded by build-site.js footKind('live').
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
const depth = require('./build-depth.js'); /* the reading part from build/content/live.js (none yet), as build-depth.js writes it */
const { SECTIONS, trailFor } = require('./build/sections.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SECTION = 'live';
/* the text the owner approved, shown word for word on every live page and on /join/ */
const PRIVACY = 'Answers pass through our server only to reach the presenter\u2019s screen. They are held in memory for the room\u2019s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
const BADGE = 'Live — answers pass through our server';
const SHARED = new Set(['room-client.js', 'room-kit.js', 'room-words.js', 'room-join.js', 'room-join-hi.js', 'room-join-quiz.js', 'room-join-deck.js']);
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

/* One spec per tool: every engine/room-<slug>.js except the shared ones
   may add one. `order` fixes its place on the hub. */
function tools() {
  const w = {};
  const dir = path.join(ROOT, 'engine');
  const files = fs.readdirSync(dir).filter((f) => /^room-[a-z0-9-]+\.js$/.test(f) && !SHARED.has(f)).sort();
  for (const f of files) new Function('window', 'document', fs.readFileSync(path.join(dir, f), 'utf8'))(w, undefined);
  const list = Object.entries(w.ROOM_TOOLS || {}).map(([slug, spec]) => ({ slug, spec }));
  const ord = (t) => (typeof t.spec.order === 'number' ? t.spec.order : 999);
  return list.sort((a, b) => ord(a) - ord(b) || a.slug.localeCompare(b.slug));
}
/** Every landing page, with the tool it mounts. */
function landings(list) {
  const out = [];
  for (const t of list) for (const L of t.spec.landings || []) out.push({ t, L });
  return out;
}
/** For build-site.js and the tests: the landing pages' addresses. */
function landingPaths() { return landings(tools()).map((x) => '/' + SECTION + '/' + x.L.slug + '/'); }
/** For build-finder.js: one Tool Finder row per landing page that exists, in
    build-games.js's shape, so "live quiz for the classroom" opens its page
    (and the promotion desk lists it). `io` is the tool's own in->out line. */
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
const appLd = (name, description, url, keywords) => ({ '@type': 'SoftwareApplication', name, description, url, applicationCategory: 'BusinessApplication', operatingSystem: 'Any', browserRequirements: 'Requires a current browser. Participants join from any phone browser; answers pass through our relay to the presenter.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, keywords: (keywords || []).join(', ') });

const badge = () => '  <p class="live-badge"><span class="live-dot" aria-hidden="true"></span>' + esc(BADGE) + '</p>\n';
const NOSCRIPT = '<noscript><p class="game-msg">This live tool runs in your browser and needs JavaScript switched on.</p></noscript>';
/* the step-by-step manual (spec.manual), as plain lists the reader can follow */
function manualHtml(m) {
  if (!m) return '';
  const part = (h, list) => (list && list.length ? '<h3>' + esc(h) + '</h3><ol class="tips">' + list.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '');
  return '  <section class="panel live-manual"><h2>Step by step</h2>' + part('Before people arrive', m.setup) + part('Running it', m.play) + part('On the projector or TV', m.tv) +
    (m.troubleshooting && m.troubleshooting.length ? '<h3>If something goes wrong</h3>' + m.troubleshooting.map((t) => '<details><summary>' + esc(t.q) + '</summary><p>' + esc(t.a) + '</p></details>').join('') : '') + '</section>\n';
}

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
    '<article class="tool game-tool live-tool" data-tool="' + t.slug + '">\n' +
    '  <p class="eyebrow">' + esc(sec.name) + '</p>\n' +
    '  <h1>' + icon(s.glyph, 'ico ico-title') + esc(s.title) + '</h1>\n' +
    badge() +
    '  <p class="lede">' + esc(s.description) + '</p>\n' +
    '  <div class="tool-io">' + NOSCRIPT + '</div>\n' +
    '  <section class="panel"><h2>Privacy</h2><p class="privacy-line">' + esc(s.privacy) + '</p></section>\n' +
    '  <section class="panel"><h2>How it works</h2><ol class="tips">' + (s.how || []).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol></section>\n' +
    manualHtml(s.manual) +
    (s.uses && s.uses.length ? '  <section class="panel"><h2>Where people use it</h2><ul class="tips">' + s.uses.map((u) => '<li><strong>' + esc(u[0]) + '</strong> — ' + esc(u[1]) + '</li>').join('') + '</ul></section>\n' : '') +
    '  <section class="panel"><h2>Tips</h2><ul class="tips">' + (s.tips || []).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></section>\n' +
    (ready.length ? '  <section class="panel"><h2>Ready-made for</h2><ul class="related">' + ready.join('') + '</ul></section>\n' : '') +
    faqHtml(s.faq || []) +
    '  <section class="panel"><h2>Related tools</h2><ul class="related">' + siblings.concat(relatedItems(t)).join('') + '</ul></section>\n' +
    '</article>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [appLd(s.title, s.description, SITE + pathOnly, s.keywords), crumbs.breadcrumbList(trail, s.title, pathOnly), faqLd(((s.manual && s.manual.troubleshooting) || []).concat(s.faq || []))]
  }) + '</script>\n';
  const rel = SECTION + '/' + t.slug + '/index.html';
  const html = headFor(parts, pathOnly, s.pageTitle || (s.title + ' — Free, No Sign-up | 1234Tools'), s.description, s.scripts) + ld + parts.mid + '\n' + body + parts.tail;
  return footerApply(depth.apply(proof.apply(share.apply(outbound.rewrite(keepRelated(rel, keepPwa(rel, hubs.apply(sidebar.apply(html, rel), rel))), SECTION).html, rel), rel), rel), rel);
}

/* A landing page: the same tool, preset for one job, in that job's words. */
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
    '<article class="tool game-tool live-tool game-landing" data-tool="' + t.slug + '" data-preset="' + esc(JSON.stringify(L.preset || {})) + '">\n' +
    '  <p class="eyebrow">' + esc(sec.name) + '</p>\n' +
    '  <h1>' + icon(s.glyph, 'ico ico-title') + esc(L.title) + '</h1>\n' +
    badge() +
    '  <p class="lede">' + esc(L.lede || L.description) + '</p>\n' +
    '  <div class="tool-io">' + NOSCRIPT + '</div>\n' +
    '  <section class="panel"><h2>Set up for this</h2>' + (L.about || []).map((p) => '<p>' + esc(p) + '</p>').join('') +
    '<p>The full tool, with every setting, is the <a href="/' + SECTION + '/' + t.slug + '/">' + esc(s.title) + '</a>.</p></section>\n' +
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
  const title = 'Live Polls & Q&A — Free, Phones Join With a Code | 1234Tools';
  const description = 'Free live polls, word clouds, audience Q&A, rating scales and interactive presentations: the audience join at 1234tools.com/join with a 6-digit code and answer from their phones. No app, no sign-up.';
  const cards = all.map((t) => '<a class="card" href="/' + SECTION + '/' + t.slug + '/"><span class="card-icon">' + icon(t.spec.glyph) + '</span><strong>' + esc(t.spec.title) + '</strong><span class="card-desc">' + esc(t.spec.description) + '</span></a>').join('');
  const ready = landings(all).map((x) => '<li><a href="/' + SECTION + '/' + x.L.slug + '/">' + esc(x.L.title) + '</a></li>').join('');
  const body =
    crumbs.render([], sec.hub || sec.name) + '\n' +
    '<p class="eyebrow">' + esc(sec.name) + '</p>\n' +
    '<h1>' + icon('i-live', 'ico ico-title') + esc(sec.name) + '</h1>\n' +
    badge() +
    '<p class="lede">Ask the room a question and see the answers arrive live: a poll, a word cloud, questions for the speaker, a rating, or a whole presentation of questions and quizzes with a leaderboard. You show the question on the projector; the audience open <strong>1234tools.com/join</strong> on their phones, type the 6-digit code and answer. No app, no account, no sign-up. ' + n + ' live tool' + (n === 1 ? '' : 's') + ' so far.</p>\n' +
    '<div class="grid">' + cards + '</div>\n' +
    (ready ? '<section class="panel"><h2>Ready-made for</h2><ul class="related">' + ready + '</ul></section>\n' : '') +
    '<section class="panel"><h2>How a live session works</h2><ol class="tips">' +
    '<li>Open a live tool on the computer connected to the projector and type your question.</li>' +
    '<li>Press <strong>Start a live session</strong>. A 6-digit code and a QR code appear; press <strong>Show on TV</strong> to put them on the big screen.</li>' +
    '<li>The audience open 1234tools.com/join on their phones (or scan the QR code), type the code and choose a nickname.</li>' +
    '<li>Ask the question. Answers arrive on your screen in about a second and the results build up live.</li>' +
    '<li>Export the results as a CSV, then press <strong>End session</strong>: every phone is told and the room is gone.</li></ol></section>\n' +
    '<section class="panel"><h2>What our server sees and keeps</h2>' +
    '<p class="privacy-line">' + esc(PRIVACY) + '</p>' +
    '<p>These are the only free tools on 1234Tools whose answers leave the device, so here is exactly what happens. A small relay at live.1234tools.com connects the presenter’s browser with the phones. It passes each answer to the presenter and the presenter’s question to the phones, and keeps the current question in memory so that someone who joins late sees it. It writes nothing to disk. When the presenter ends the session — or after 24 hours, or 30 minutes after the presenter’s page goes away — the room and everything in it is deleted.</p>' +
    '<p>All the counting is done in the presenter’s browser, one answer per phone. Phones receive the question and, only if the presenter shows them, the totals — never another person’s answer. Participants choose a nickname, not their real name; there are no accounts, no cookies and no analytics on the join page. During the launch trial a free session takes up to 1,000 phones.</p></section>\n' +
    '<section class="panel"><h2>Frequently asked questions</h2>' +
    '<details><summary>Do participants need an app?</summary><p>No. Any phone browser works: open 1234tools.com/join, type the code (or scan the QR code on the screen) and pick a nickname.</p></details>' +
    '<details><summary>Do I need an account to run a session?</summary><p>No. Open a live tool and press Start a live session. Nothing is sent anywhere until you press it.</p></details>' +
    '<details><summary>How many people can join?</summary><p>Up to 1,000 phones in a free session during the launch trial. The next phone after that is told the session is full.</p></details>' +
    '<details><summary>What happens to the answers afterwards?</summary><p>They stay on the presenter’s page until it is closed, and can be exported as a CSV from there. The relay deletes the room when the session ends; nothing is kept by us.</p></details>' +
    '<details><summary>Can I use it in a video call?</summary><p>Yes. Share the big-screen window in the call; people answer from their phones or from another browser tab.</p></details></section>\n' +
    '<p>Missing a live tool? Describe it in the finder at the top of this page; when it is not here the finder offers a request form. <a href="/contact/">The contact page</a> works too.</p>\n';
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
  const urls = ['/' + SECTION + '/', '/join/'].concat(list.map((t) => '/' + SECTION + '/' + t.slug + '/'), landings(list).map((x) => '/' + SECTION + '/' + x.L.slug + '/'));
  const add = urls.filter((u) => src.indexOf('<loc>' + SITE + u + '</loc>') < 0)
    .map((u) => '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>' + (u === '/join/' ? '0.5' : u === '/' + SECTION + '/' ? '0.8' : '0.7') + '</priority></url>');
  if (!add.length) return 0;
  write(rel, src.replace('</urlset>', add.join('\n') + '\n</urlset>'));
  return add.length;
}
/** A section card on the homepage, beside the quiz and party games (or the social media tools). */
function patchHome(count) {
  const rel = 'index.html';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const sec = SECTIONS['/' + SECTION + '/'];
  const card = '<a class="card card-lg" href="/' + SECTION + '/"><span class="card-icon">' + icon('i-live') + '</span><strong>' + esc(sec.name) + '</strong><span class="card-desc">' + count + (count === 1 ? ' tool' : ' tools') + '</span></a>';
  const have = /<a class="card card-lg" href="\/live\/">[\s\S]*?<\/a>/.exec(src);
  if (have) return have[0] === card ? false : write(rel, src.replace(have[0], card));
  const beside = /<a class="card card-lg" href="\/games\/">[\s\S]*?<\/a>/.exec(src) || /<a class="card card-lg" href="\/social\/">[\s\S]*?<\/a>/.exec(src);
  if (!beside) throw new Error('the homepage has no Games or Social card to sit beside');
  return write(rel, src.replace(beside[0], beside[0] + card));
}

const GLYPHS = {
  /* a phone sending to a screen: the section's mark */
  'i-live': '<symbol id="i-live" viewBox="0 0 24 24">\n  <rect x="2.8" y="3.6" width="12.4" height="8.8" rx="1.4"/>\n  <rect x="15.4" y="10.2" width="5.8" height="10.2" rx="1.2"/>\n  <path d="M6.2 16.4a5.6 5.6 0 0 0 6.4 2.8M7.4 14.6a3.2 3.2 0 0 0 3.6 1.7" class="thin"/>\n  <circle cx="18.3" cy="18.4" r=".7" class="fill"/>\n</symbol>'
};
function patchIcons(list) {
  const rel = 'assets/icons.svg';
  let svg = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let added = 0;
  const own = {};
  list.forEach((t) => { if (t.spec.glyphSvg) own[t.spec.glyph] = t.spec.glyphSvg; });
  for (const g of ['i-live'].concat(list.map((t) => t.spec.glyph))) {
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
    for (const need of ['/engine/room-client.js', '/engine/room-kit.js']) if ((t.spec.scripts || []).indexOf(need) < 0) throw new Error(t.slug + ' must load ' + need);
    if (t.spec.privacy !== PRIVACY) throw new Error(t.slug + ': spec.privacy must be the approved text, word for word');
    const m = t.spec.manual;
    if (!m || ['setup', 'play', 'tv', 'troubleshooting'].some((k) => !Array.isArray(m[k]) || m[k].length < 3 || m[k].length > 6)) throw new Error(t.slug + ': spec.manual needs setup, play, tv and troubleshooting, 3-6 items each');
    if (!t.spec.faq || t.spec.faq.length < 6) throw new Error(t.slug + ' needs at least six FAQ entries');
    if (!t.spec.privacy) throw new Error(t.slug + ' has no privacy line');
    if (!t.spec.description || t.spec.description.length > 300) throw new Error(t.slug + ': the description must be 1-300 characters');
    const title = t.spec.pageTitle || (t.spec.title + ' — Free, No Sign-up | 1234Tools');
    if (title.length > 70) throw new Error(t.slug + ': the page title is ' + title.length + ' characters, over 70');
    if (slugs.has(t.slug)) throw new Error('two live tools use the slug ' + t.slug);
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

  console.log('\nbuild-live.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  live tools          ' + list.length + ': ' + list.map((t) => t.slug).join(', '));
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
  catch (e) { console.error('\nbuild-live.js failed: ' + (e && e.message || e) + '\n'); process.exit(1); }
}
module.exports = { tools, landingPaths, finderRows };
