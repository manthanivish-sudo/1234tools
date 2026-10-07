/**
 * Generate the Hindi twins of the top tools: /hi/<section>/<slug>/.
 *
 *   node build-tools-hi.js          apply
 *   node build-tools-hi.js --check  report what would change, write nothing
 *
 * A twin is the English tool page with the words in Hindi. It is rebuilt
 * from the English page every run, so it cannot drift from it:
 *
 *   - the head is the English head (fonts, styles, analytics, the tool's own
 *     engine scripts) with the title, description, canonical, og/twitter
 *     tags and structured data in Hindi, lang="hi", and hreflang pairs;
 *   - the tool itself is the English page's own markup and mount script,
 *     run by the same shell; its words come from a strings map
 *     (build/tools-hi/strings.js for each shell, build/tools-hi/pages.js for
 *     the tool) that the page carries inline and engine/i18n.js applies
 *     through the shell's i18n hook;
 *   - the page copy around it (lede, steps, privacy, tips, questions) is
 *     written in Hindi in build/tools-hi/pages.js, shorter than the English
 *     page and linking to it for the full detail.
 *
 * The English page gets the same hreflang pairs and one small language link
 * under its heading; nothing else on it changes. The twins are not tools in
 * their own right: they are not in the search index, the sidebar counts, the
 * hubs or the home page, so no total moves.
 *
 * Every string is machine-drafted and needs a native Hindi speaker's review
 * before the pages are promoted (see build/tools-hi/pages.js).
 *
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crumbs = require('./build-crumbs.js');
const outbound = require('./build-outbound.js');
const share = require('./build-share.js');
const proof = require('./build-proof.js');
const depth = require('./build-depth.js');
const hubs = require('./build-hubs.js');
const { apply: sidebarFor } = require('./build-sidebar.js');
const { footerApply } = require('./build-site.js');
const SHELLS = require('./build/tools-hi/strings.js');
const { TOOLS, PAGE } = require('./build/tools-hi/pages.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';

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
const hiPath = (p) => '/hi' + p;
const relOf = (p) => p.replace(/^\/+/, '') + 'index.html';

/* ---------- the strings map a page carries ---------- */

/** common + the shell's + the tool's own; the tool wins on a clash. */
function stringsFor(t) {
  const parts = [SHELLS.common].concat((t.shells || []).map((s) => {
    if (!SHELLS[s]) throw new Error(t.slug + ' names a shell with no strings: ' + s);
    return SHELLS[s];
  })).concat([(SHELLS.tools && SHELLS.tools[t.slug]) || {}, { s: t.s || {}, p: t.p || [], k: t.k || [] }]);
  const out = { lang: 'hi', s: {}, p: [], k: [] };
  for (const part of parts) {
    Object.assign(out.s, part.s || {});
    out.p = (part.p || []).concat(out.p); /* later (more specific) patterns first */
    out.k = out.k.concat(part.k || []);
  }
  for (const [re] of out.p) new RegExp(re); /* a broken pattern stops the build, not the page */
  out.k = Array.from(new Set(out.k));
  return out;
}
/* JSON inside <script>: no "</script" and no U+2028/9 surprises */
const inlineJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));

/* ---------- the English page, read ---------- */

function readEnglish(t) {
  const rel = relOf(t.path);
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error('no English page for ' + t.slug + ' at ' + rel);
  const src = fs.readFileSync(abs, 'utf8');
  const headEnd = src.indexOf('</head>');
  const mainOpen = '<main id="main" class="content">';
  const mainAt = src.indexOf(mainOpen), mainEnd = src.indexOf('</main>');
  const artAt = src.indexOf('<article class="tool', mainAt), artEnd = src.indexOf('</article>', artAt);
  if (headEnd < 0 || mainAt < 0 || mainEnd < 0 || artAt < 0 || artEnd < 0) throw new Error(rel + ' is not the tool page shape this builder reads');
  const art = src.slice(artAt, artEnd);
  const open = /^<article[^>]*>/.exec(art)[0];
  const icon = (/<h1>(<svg[\s\S]*?<\/svg>)/.exec(art) || [])[1] || '';
  /* the tool's own markup: the calculator form, or the empty mount point */
  const calc = /<div class="calc">[\s\S]*?<div class="tool-results"[^>]*><\/div>\s*<\/div>/.exec(art);
  const io = /<div class="tool-io"(?: [^>]*)?><\/div>/.exec(art);
  const toolMarkup = calc ? calc[0] : io ? io[0] : null;
  if (!toolMarkup) throw new Error(rel + ': no tool markup found');
  const shareRow = (/[ \t]*<!-- SHARE: generated by build-share\.js, do not edit -->[\s\S]*?<!-- \/SHARE -->/.exec(art) || [''])[0];
  return {
    rel, src, open, icon, toolMarkup, shareRow,
    head: src.slice(0, headEnd),
    mid: src.slice(headEnd, mainAt + mainOpen.length),
    after: src.slice(artEnd + '</article>'.length, mainEnd), /* the mount script(s) */
    tail: src.slice(mainEnd),
    ld: (/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(src) || [])[1]
  };
}

/* ---------- the head ---------- */

function alternates(enPath) {
  const en = SITE + enPath, hi = SITE + hiPath(enPath);
  return '<link rel="alternate" hreflang="en" href="' + en + '">\n' +
    '<link rel="alternate" hreflang="hi" href="' + hi + '">\n' +
    '<link rel="alternate" hreflang="x-default" href="' + en + '">';
}
const ALT_RE = /\n<link rel="alternate" hreflang="(?:en|hi|x-default)" href="[^"]*">/g;
const withAlternates = (head, enPath) => head.replace(ALT_RE, '')
  .replace(/(<link rel="canonical" href="[^"]*">)/, (m) => m + '\n' + alternates(enPath));

function hiHead(t, en, strings) {
  const url = SITE + hiPath(t.path);
  const full = t.title + ' | 1234Tools';
  let head = en.head
    .replace('<html lang="en-GB"', '<html lang="hi"')
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(full) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(t.description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">')
    .replace('<meta property="og:locale" content="en_GB">', '<meta property="og:locale" content="hi_IN">\n<meta property="og:locale:alternate" content="en_GB">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(full) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(t.description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">')
    .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(full) + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(t.description) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '')
    /* the install-as-an-app block names the English tool; the twin is not an app of its own */
    .replace(/<!-- PWA: generated by build-pwa\.js, do not edit -->[\s\S]*?<!-- \/PWA -->\n?/, '');
  head = withAlternates(head, t.path);
  /* the map and the runtime, ahead of the first engine script so the shell finds them at mount */
  const first = head.search(/<script src="\/engine\//);
  const i18n = '<script>window.MVR_I18N_STRINGS=' + inlineJson(strings) + ';</script>\n<script src="/engine/i18n.js" defer></script>\n';
  head = first >= 0 ? head.slice(0, first) + i18n + head.slice(first) : head + i18n;
  return head + ldFor(t, en) + '\n';
}

function ldFor(t, en) {
  let app = {};
  try { app = (JSON.parse(en.ld)['@graph'] || []).find((x) => x['@type'] === 'SoftwareApplication') || {}; } catch (e) { /* none */ }
  const url = SITE + hiPath(t.path);
  const graph = [
    { '@type': 'SoftwareApplication', name: t.h1, description: t.lede, url, inLanguage: 'hi',
      applicationCategory: app.applicationCategory || 'UtilitiesApplication', operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    crumbs.breadcrumbList([], t.h1, hiPath(t.path))
  ];
  if (t.faq && t.faq.length) graph.push({ '@type': 'FAQPage', inLanguage: 'hi', mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  return '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }) + '</script>';
}

/* ---------- the body ---------- */

function body(t, en) {
  const others = TOOLS.filter((o) => o !== t && (o.group === t.group)).concat(TOOLS.filter((o) => o !== t && o.group !== t.group)).slice(0, 8);
  const panel = (h, inner) => '  <section class="panel"><h2>' + esc(h) + '</h2>' + inner + '</section>\n';
  const steps = (t.steps || []).length ? panel(PAGE.stepsHead, '<ol class="tips">' + t.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>') : '';
  return crumbs.render([], t.h1) + '\n' +
    en.open + '\n' +
    (t.eyebrow ? '  <p class="eyebrow">' + esc(t.eyebrow) + '</p>\n' : '') +
    '  <h1>' + en.icon + esc(t.h1) + '</h1>\n' +
    '  <p class="lede">' + esc(t.lede) + '</p>\n' +
    (t.pills && t.pills.length ? '  <ul class="proof-pills" aria-label="' + esc(PAGE.pillsLabel) + '">' + t.pills.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul>\n' : '') +
    '  <p class="tool-lang"><a href="' + t.path + '" hreflang="en" lang="en">' + esc(PAGE.toEnglish) + '</a></p>\n' +
    '  ' + en.toolMarkup + '\n' +
    (en.shareRow ? en.shareRow + '\n' : '') +
    steps +
    panel(PAGE.privacyHead, '<p class="privacy-line">' + esc(t.privacy) + '</p>') +
    ((t.tips || []).length ? panel(PAGE.tipsHead, '<ul class="tips">' + t.tips.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul>') : '') +
    ((t.faq || []).length ? panel(PAGE.faqHead, t.faq.map((f) => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('')) : '') +
    panel(PAGE.moreHead, '<p>' + esc(PAGE.moreText) + ' <a href="' + t.path + '#learn-more" hreflang="en" lang="en">' + esc(PAGE.moreLink) + '</a></p>' +
      '<ul class="related">' + others.map((o) => '<li><a href="' + hiPath(o.path) + '">' + esc(o.h1) + '</a></li>').join('') + '</ul>') +
    '</article>';
}

/** The mount script, with its fallback message in Hindi too. */
function afterArticle(en) {
  let out = en.after;
  for (const [a, b] of Object.entries(PAGE.fallback)) out = out.split(a).join(b);
  return out;
}

/* ---------- one twin, and the English page's side ---------- */

function twin(t) {
  const en = readEnglish(t);
  const rel = relOf(hiPath(t.path));
  const strings = stringsFor(t);
  let html = hiHead(t, en, strings) + en.mid + '\n' + body(t, en) + afterArticle(en) + en.tail;
  /* what the post-processors would do to it, done here so they find nothing left */
  html = sidebarFor(html, rel);
  html = hubs.apply(html, rel);
  html = outbound.rewrite(html, outbound.sectionOf(rel)).html;
  html = share.apply(html, rel);
  html = proof.apply(html, rel);
  html = depth.apply(html, rel);
  html = footerApply(html, rel);
  return { rel, html };
}

const LANG_RE = /\n[ \t]*<!-- HI-LINK: generated by build-tools-hi\.js, do not edit -->[\s\S]*?<!-- \/HI-LINK -->/g;
function patchEnglish(t) {
  const rel = relOf(t.path);
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const [headPart, rest] = [src.slice(0, src.indexOf('</head>')), src.slice(src.indexOf('</head>'))];
  let html = withAlternates(headPart, t.path) + rest.replace(LANG_RE, '');
  const link = '\n  <!-- HI-LINK: generated by build-tools-hi.js, do not edit -->\n  <p class="tool-lang"><a href="' + hiPath(t.path) + '" hreflang="hi" lang="hi">' + esc(PAGE.toHindi) + '</a></p>\n  <!-- /HI-LINK -->';
  const h1End = html.indexOf('</h1>', html.indexOf('<article class="tool'));
  if (h1End < 0) throw new Error(rel + ': no heading to put the language link under');
  html = html.slice(0, h1End + 5) + link + html.slice(h1End + 5);
  return { rel, html };
}

function patchSitemap() {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const add = TOOLS.map((t) => hiPath(t.path)).filter((u) => src.indexOf('<loc>' + SITE + u + '</loc>') < 0)
    .map((u) => '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>');
  if (!add.length) return 0;
  write(rel, src.replace('</urlset>', add.join('\n') + '\n</urlset>'));
  return add.length;
}

function main() {
  let twins = 0, english = 0;
  for (const t of TOOLS) {
    const tw = twin(t);
    if (write(tw.rel, tw.html)) twins++;
    const en = patchEnglish(t);
    if (write(en.rel, en.html)) english++;
  }
  const mapped = patchSitemap();
  console.log('\nbuild-tools-hi.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  Hindi twins         ' + TOOLS.length + ' (' + twins + ' written)');
  console.log('  English pages       ' + english + ' given hreflang + language link');
  console.log('  sitemap             ' + (mapped ? mapped + ' added' : 'unchanged'));
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
module.exports = { stringsFor, twin, patchEnglish };
