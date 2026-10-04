/**
 * The AI image section: a hub at /ai-image/, a page per tool, and its place
 * in the search index, the sitemap, the homepage and the sidebar counts.
 *
 *   node build-ai-image.js          apply
 *   node build-ai-image.js --check  report what would change, write nothing
 *
 * Tools come from engine/ai-image-tools.js (window.AI_IMAGE_TOOLS). This
 * script runs that file in Node to read the specs and writes each page in
 * the site's current shape, cut from an existing image-tool page so the
 * shell is whatever the shell is today. These tools run on the device — a
 * segmentation model is downloaded once, the picture never leaves the
 * browser — so they are free and need no account layer.
 *
 * The first tool here replaced /image/ai-text-behind-anything/, a page
 * that was added by hand outside the shell and so was in no sidebar, no
 * index and no sitemap. MOVED below keeps that address answering.
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
const share = require('./build-share.js'); /* the share bar and og:image, as build-share.js writes them */
const proof = require('./build-proof.js'); /* the example, the story and the card thumbnails, as build-proof.js writes them */
const sidebar = require('./build-sidebar.js');
const { SECTIONS, trailFor } = require('./build/sections.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SECTION = 'ai-image';
const SHELL_PAGE = 'image/background-remover/index.html';

/* Old addresses that must keep answering, and where they go now. */
const MOVED = {
  '/image/ai-text-behind-anything/': '/' + SECTION + '/text-behind-image/'
};

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

/* One spec file per tool: engine/ai-image-tools.js carries the first, and
   every engine/ai-image-tools-<slug>.js adds one more. Separate files let
   several people build tools at once without editing the same file; the
   builder reads them all, so the page, the hub card and the directory row
   still cannot disagree. `order` in a spec fixes its place on the hub (the
   roadmap number); a spec without one sorts after those that have it. */
function tools() {
  const w = {};
  const dir = path.join(ROOT, 'engine');
  const files = ['ai-image-tools.js'].concat(fs.readdirSync(dir).filter((f) => /^ai-image-tools-[a-z0-9-]+\.js$/.test(f)).sort());
  for (const f of files) new Function('window', fs.readFileSync(path.join(dir, f), 'utf8'))(w);
  const list = Object.entries(w.AI_IMAGE_TOOLS).map(([slug, spec]) => ({ slug, spec }));
  const ord = (t) => (typeof t.spec.order === 'number' ? t.spec.order : 999);
  return list.sort((a, b) => ord(a) - ord(b) || a.slug.localeCompare(b.slug));
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

/* ------------------------------------------------------------------ */

function toolPage(t, parts, all) {
  const pathOnly = '/' + SECTION + '/' + t.slug + '/';
  const url = SITE + pathOnly;
  const trail = trailFor(pathOnly);
  const s = t.spec;
  const sec = SECTIONS['/' + SECTION + '/'];
  const siblings = all.filter((x) => x.slug !== t.slug).map((x) => '<li><a href="/' + SECTION + '/' + x.slug + '/">' + esc(x.spec.title) + '</a></li>');
  const related = (s.related || []).map((p) => {
    const abs = path.join(ROOT, p.replace(/^\/+/, ''), 'index.html');
    if (!fs.existsSync(abs)) throw new Error(t.slug + ' relates to ' + p + ', which does not exist');
    const m = /<title>([^<|—]*)/.exec(fs.readFileSync(abs, 'utf8'));
    return '<li><a href="' + p + '">' + (m ? m[1].trim() : p) + '</a></li>';
  });
  const body =
    crumbs.render(trail, s.title) + '\n' +
    '<article class="tool aiimg-tool" data-tool="' + t.slug + '">\n' +
    '  <p class="eyebrow">' + esc(sec.name) + '</p>\n' +
    '  <h1>' + icon(s.glyph, 'ico ico-title') + esc(s.title) + '</h1>\n' +
    '  <p class="lede">' + esc(s.description) + '</p>\n' +
    '  <div class="tool-io"></div>\n' +
    '  <section class="panel"><h2>Privacy</h2><p class="privacy-line">' + esc(s.privacy) + '</p></section>\n' +
    '  <section class="panel"><h2>How it works</h2><ol class="tips">' + (s.how || []).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol></section>\n' +
    (s.uses && s.uses.length ? '  <section class="panel"><h2>What people make with it</h2><ul class="tips">' + s.uses.map((u) => '<li><strong>' + esc(u[0]) + '</strong> — ' + esc(u[1]) + '</li>').join('') + '</ul></section>\n' : '') +
    '  <section class="panel"><h2>Tips</h2><ul class="tips">' + (s.tips || []).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></section>\n' +
    '  <section class="panel"><h2>Frequently asked questions</h2>' + (s.faq || []).map((f) => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n' +
    '  <section class="panel"><h2>Related tools</h2><ul class="related">' + siblings.concat(related).join('') + '</ul></section>\n' +
    '</article>\n' +
    '<script>\n' +
    'document.addEventListener(\'DOMContentLoaded\',function(){\n' +
    '  var root = document.querySelector(\'.tool\');\n' +
    '  try { AIImg.mount(\'' + t.slug + '\', root); }\n' +
    '  catch (e) {\n' +
    '    root.querySelector(\'.tool-io\').innerHTML =\n' +
    '      \'<div class="io-msg is-error">This tool needs browser features yours does not support. Try a current version of Chrome, Edge, Safari or Firefox.</div>\';\n' +
    '  }\n' +
    '});\n' +
    '</script>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'SoftwareApplication', name: s.title, description: s.description, url, applicationCategory: 'MultimediaApplication', operatingSystem: 'Any', browserRequirements: 'Requires a current browser; nothing is uploaded.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, keywords: (s.keywords || []).join(', ') },
      crumbs.breadcrumbList(trail, s.title, pathOnly),
      { '@type': 'FAQPage', mainEntity: (s.faq || []).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  }) + '</script>\n';
  const rel = SECTION + '/' + t.slug + '/index.html';
  const html = headFor(parts, pathOnly, s.pageTitle || (s.title + ' — Free & Private | 1234Tools'), s.description, s.scripts) + ld + parts.mid + '\n' + body + parts.tail;
  return proof.apply(share.apply(outbound.rewrite(keepRelated(rel, keepPwa(rel, hubs.apply(sidebar.apply(html, rel), rel))), SECTION).html, rel), rel);
}

function hubPage(parts, all) {
  const sec = SECTIONS['/' + SECTION + '/'];
  const n = all.length;
  const title = 'AI Image Tools — Free, Private, Run in Your Browser | 1234Tools';
  const description = 'Free AI photo tools that run on your own device: put text behind a person or object, cut out layers, animate and export to PNG, GIF or MP4. No upload, no account, no watermark.';
  const cards = all.map((t) => '<a class="card" href="/' + SECTION + '/' + t.slug + '/"><span class="card-icon">' + icon(t.spec.glyph) + '</span><strong>' + esc(t.spec.title) + '</strong><span class="card-desc">' + esc(t.spec.description) + '</span></a>').join('');
  const body =
    crumbs.render([], sec.hub || sec.name) + '\n' +
    '<p class="eyebrow">' + esc(sec.name) + '</p>\n' +
    '<h1>' + icon('i-ai-image', 'ico ico-title') + esc(sec.name) + '</h1>\n' +
    '<p class="lede">AI photo editing that happens on your own device. A small model is downloaded into your browser once; the picture itself never leaves it. ' + n + ' tool' + (n === 1 ? '' : 's') + ' so far, free, with no account and no watermark.</p>\n' +
    '<div class="grid">' + cards + '</div>\n' +
    '<section class="panel ai-how"><h2>How these differ from the AI for Business tools</h2>' +
    '<p>The <a href="/ai/">AI for Business</a> tools send your text to a language model on a server, say so on every page, and count calls against a monthly allowance. These do not. The models here are small enough to run inside a browser — between 1.5 MB and 28 MB each, and several tools share one download — so they are served from this site, kept by your browser after the first visit, and run on your own processor through WebAssembly. No third-party server is contacted.</p>' +
    '<p>That is why there is no sign-in and no limit: there is no server bill to cover. It is also why the first run on a device takes a moment longer than the rest.</p></section>\n' +
    '<section class="panel"><h2>What is coming to this section</h2><ul class="tips">' +
    '<li><strong>Layer cut-outs and stickers</strong> — export any layer the model finds, not only the main subject, as a transparent PNG.</li>' +
    '<li><strong>Selective colour</strong> — keep the subject in colour and turn the rest to black and white, or recolour one layer.</li>' +
    '<li><strong>Sky and background swaps</strong> — the same layers, a different backdrop.</li>' +
    '<li><strong>Depth effects</strong> — blur behind the subject, or a parallax clip from one photo.</li></ul>' +
    '<p>The order depends on what people ask for. <a href="/contact/">The contact page</a> works, and so does the tool-request form in your <a href="/account/">account</a>.</p></section>\n' +
    '<section class="panel"><h2>Frequently asked questions</h2>' +
    '<details><summary>Is anything uploaded?</summary><p>No. Two downloads happen on first use — the model and the runtime, both from this site — and your browser keeps both. Your photos are opened, processed and saved on your device. We never receive them and could not look at them if we wanted to.</p></details>' +
    '<details><summary>Why is the first run slow?</summary><p>The model has to be downloaded once and the runtime warmed up. After that both come from your browser’s cache and a photo is split into layers in about a second.</p></details>' +
    '<details><summary>Which browsers work?</summary><p>Current Chrome, Edge, Safari and Firefox, on desktop and on phones. MP4 export uses on-device video encoding, which Firefox does not yet provide; there a clip is saved as WebM instead, and GIF export works everywhere.</p></details>' +
    '<details><summary>Can I use the results commercially?</summary><p>Yes. The output is yours. The models are published under permissive licences — EfficientViT-Seg from the MIT HAN Lab (Apache-2.0), MODNet (Apache-2.0), Depth Anything V2 Small (Apache-2.0), MI-GAN (MIT), Real-ESRGAN (BSD-3-Clause) and UltraFace (MIT) — and nothing we make adds a watermark or a credit.</p></details></section>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: sec.name, description, url: SITE + '/' + SECTION + '/', mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: all.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.spec.title, url: SITE + '/' + SECTION + '/' + t.slug + '/' })) } },
      crumbs.breadcrumbList([], sec.hub || sec.name, '/' + SECTION + '/')
    ]
  }) + '</script>\n';
  const rel = SECTION + '/index.html';
  const html = headFor(parts, '/' + SECTION + '/', title, description, []) + ld + parts.mid + '\n' + body + parts.tail;
  return proof.apply(share.apply(outbound.rewrite(keepPwa(rel, hubs.apply(sidebar.apply(html, rel), rel)), SECTION).html, rel), rel);
}

/* The redirect stub, in the shape the rest of the site uses, so every
   builder recognises it as one and leaves it out of the sitemap. */
function stub(title, to, isIndex) {
  return '<!DOCTYPE html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' + esc(title) + ' has moved | 1234Tools</title>\n' +
    '<link rel="canonical" href="' + SITE + to + '">\n' +
    '<meta name="robots" content="noindex,follow">\n' +
    '<meta http-equiv="refresh" content="0; url=' + to + '">\n' +
    '<script>location.replace(\'' + to + '\' + location.search + location.hash);</script>\n' +
    '<style>\n  body { margin: 0; display: grid; place-items: center; min-height: 100vh;\n         font-family: system-ui, -apple-system, "Segoe UI", sans-serif;\n         background: #06080f; color: #f4f6fb; text-align: center; padding: 24px; }\n  a { color: #f7c948; }\n</style>\n' +
    /* build-prefs puts its tag on every index.html, stubs included, before
       </head> when there is no stylesheet; written here so the two scripts
       do not rewrite each other. The .html stub is not an index and is left
       alone by it, so it carries none. */
    (isIndex ? '<script src="/assets/prefs.js" defer></script>\n' : '') +
    '</head>\n<body>\n<main>\n  <h1>' + esc(title) + ' has moved</h1>\n  <p>It now lives at <a href="' + to + '">' + to + '</a>.</p>\n  <p>You should arrive there automatically.</p>\n</main>\n</body>\n</html>\n';
}
function writeMoved(list) {
  let n = 0;
  for (const [from, to] of Object.entries(MOVED)) {
    const t = list.find((x) => '/' + SECTION + '/' + x.slug + '/' === to);
    const title = t ? t.spec.title : 'This tool';
    const dir = from.replace(/^\/+|\/+$/g, '');
    if (write(dir + '/index.html', stub(title, to, true))) n++;
    if (write(dir + '.html', stub(title, to, false))) n++;
  }
  return n;
}

/* ---------- wiring ---------- */

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
const isStub = (html) => /name="robots" content="noindex,follow"/.test(html) && /http-equiv="refresh"/.test(html);

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
  const urls = ['/' + SECTION + '/'].concat(list.map((t) => '/' + SECTION + '/' + t.slug + '/'));
  const add = urls.filter((u) => src.indexOf('<loc>' + SITE + u + '</loc>') < 0)
    .map((u) => '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>' + (u === '/' + SECTION + '/' ? '0.8' : '0.7') + '</priority></url>');
  if (!add.length) return 0;
  write(rel, src.replace('</urlset>', add.join('\n') + '\n</urlset>'));
  return add.length;
}
/** A section card on the homepage, beside the image tools it belongs with. */
function patchHome(count) {
  const rel = 'index.html';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (/<a class="card card-lg" href="\/ai-image\/">/.test(src)) return false;
  const image = /<a class="card card-lg" href="\/image\/">[\s\S]*?<\/a>/.exec(src);
  if (!image) throw new Error('the homepage has no Image & Photo card to sit beside');
  const sec = SECTIONS['/' + SECTION + '/'];
  const card = '<a class="card card-lg" href="/' + SECTION + '/"><span class="card-icon">' + icon('i-ai-image') + '</span><strong>' + esc(sec.name) + '</strong><span class="card-desc">' + count + (count === 1 ? ' tool' : ' tools') + '</span></a>';
  return write(rel, src.replace(image[0], image[0] + card));
}

const GLYPHS = {
  'i-ai-image': '<symbol id="i-ai-image" viewBox="0 0 24 24">\n  <rect x="3" y="4.5" width="18" height="15" rx="2"/>\n  <path d="M3.5 16.5l5-5 4 4 2.5-2.5 5.5 5.5" class="thin"/>\n  <path d="M16.3 7.1l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" class="fill"/>\n</symbol>'
};
function patchIcons(list) {
  const rel = 'assets/icons.svg';
  let svg = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let added = 0;
  const own = {};
  list.forEach((t) => { if (t.spec.glyphSvg) own[t.spec.glyph] = t.spec.glyphSvg; });
  for (const g of ['i-ai-image'].concat(list.map((t) => t.spec.glyph))) {
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

function main() {
  if (!SECTIONS['/' + SECTION + '/']) throw new Error('build/sections.js has no entry for /' + SECTION + '/');
  if (!sidebar.ORDER.some((x) => x[0] === '/' + SECTION + '/')) throw new Error('build-sidebar.js ORDER has no row for /' + SECTION + '/');
  const list = tools();
  for (const t of list) {
    for (const s of t.spec.scripts || []) {
      if (!fs.existsSync(path.join(ROOT, s.replace(/^\/+/, '')))) throw new Error(t.slug + ' loads ' + s + ', which does not exist');
    }
  }
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
  let built = 0, fresh = 0;
  for (const t of list) {
    const rel = SECTION + '/' + t.slug + '/index.html';
    if (!fs.existsSync(path.join(ROOT, rel))) fresh++;
    if (write(rel, toolPage(t, parts, list))) built++;
  }
  const hub = write(SECTION + '/index.html', hubPage(parts, list));
  const moved = writeMoved(list);
  const mapped = patchSitemap(list);
  const homeCard = patchHome(list.length);
  const totals = patchTotal(total);
  const sw = changes.length ? bumpServiceWorker() : false;

  console.log('\nbuild-ai-image.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  tools               ' + list.length + ': ' + list.map((t) => t.slug).join(', '));
  console.log('  pages written       ' + built + ' (' + fresh + ' new)' + (hub ? ' + hub' : ''));
  console.log('  moved addresses     ' + (moved ? moved + ' stub(s) written' : 'unchanged'));
  console.log('  homepage card       ' + (homeCard ? 'added' : 'unchanged'));
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
  catch (e) { console.error('\nbuild-ai-image.js failed: ' + (e && e.message || e) + '\n'); process.exit(1); }
}
module.exports = { tools, MOVED };
