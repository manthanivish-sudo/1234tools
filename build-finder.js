/**
 * The Tool Finder: /utilities/tool-finder/, and the index it reads.
 *
 *   node build-finder.js            apply
 *   node build-finder.js --check    report what would change, write nothing
 *   node build-finder.js --verbose  list every file
 *
 * The site has 1,268 tools and a search box that matches titles by prefix.
 * Somebody who knows the name of the thing finds it; somebody who knows the
 * job — "turn the PDF statement my bank gives me into a CSV" — does not. The
 * finder takes the job in plain words, matches it on the device against the
 * register plus every tool's own description and keywords, and when nothing
 * fits it offers the same request form the home page has.
 *
 * This script writes assets/finder-index.js — title, path, glyph, section,
 * description and keywords for every tool that is not a unit conversion
 * (conversions are matched from their slugs at run time), plus a seventh
 * column, what goes in and what comes out, when build/jobs.js is there to
 * say, and an eighth on the calculators that declare which input a typed
 * number fills ("bill|tip", see PREFILL in build/jobs.js) — then the page,
 * cut from an existing utilities page so the shell is today's shell, its
 * row in the search index, its sitemap line, its glyph and its card on the
 * Utilities hub. Counts, crumbs and manifests are left to the pipeline.
 *
 * The same engine also runs in short form in the home page hero (written by
 * build-home.js) and on the section hubs; this script owns only the full page.
 *
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crumbs = require('./build-crumbs.js');
const outbound = require('./build-outbound.js');
const share = require('./build-share.js'); /* the share bar and og:image, as build-share.js writes them */
const proof = require('./build-proof.js'); /* the example, the story and the card thumbnails, as build-proof.js writes them */
const sidebar = require('./build-sidebar.js');
const { footerApply } = require('./build-site.js'); /* the footer note, as build-site.js words it */
const { SECTIONS, trailFor } = require('./build/sections.js');
const { indexTotal, patchTotal } = require('./build/totals.js');

const ROOT = __dirname;
/* What goes in and what comes out of each tool ("PDF → PDF"), shown on the
   finder's cards. Another builder owns the module; without it the rows keep
   their six columns and the cards simply carry no io line. */
const JOBS = fs.existsSync(path.join(ROOT, 'build/jobs.js')) ? require('./build/jobs.js') : null;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SECTION = 'utilities';
const SLUG = 'tool-finder';
const SHELL_PAGE = 'utilities/fuel-efficiency/index.html';
const GLYPH = 'i-tool-finder';

const SPEC = {
  title: 'Tool Finder',
  pageTitle: 'Tool Finder — Describe the Job, Find the Right Free Tool | 1234Tools',
  description: 'Say what you need in plain words — "merge two PDFs", "km to miles", "payslip for one employee" — and it finds the right tool among 1,268, on your device. If it does not exist yet, ask for it in the same place.',
  keywords: ['find a tool', 'which tool do I need', 'tool finder', 'search tools by description', 'what tool converts', 'ai tool finder', 'tool recommendation'],
  privacy: 'The matching happens on your device: the list of tools and their descriptions is downloaded with the page and searched by your browser. Nothing you type is sent anywhere — unless you choose to send a request for a tool that does not exist, which goes to our server and nowhere else.',
  how: [
    'Type the job, not the feature: "remove the background from a product photo", "how many days until the exam", "pounds to kilograms".',
    'The finder reads every tool’s name, description and keywords, understands unit names and their short forms, forgives a typo, and ranks what fits. It answers in a sentence with the tool to open, or the few that could be it.',
    'Follow up in the same conversation to narrow it: "the PDF one", "for India", "as a GIF".',
    'If nothing fits, say so in one line and send it. Requests decide what gets built next; you need no account.'
  ],
  tips: [
    'A quantity and a unit is enough for conversions: "5 miles in km", "psi to bar", "kcal to kJ".',
    'Name the file type when there is one — PDF, image, Excel, CSV — and the finder narrows to that family.',
    'Press / on any page to jump to the search box; the box offers the finder when a name does not match.',
    'The chips under the composer are good starting points if you are not sure what the site has.',
    'The box at the top of the home page is this finder in short form: ask there and the answer appears under it, with a link here for the longer conversation.'
  ],
  faq: [
    { q: 'Is this an AI chat? Where does my question go?', a: 'Nowhere. It is a conversation in shape, but the matching is done by your browser against a list of the site’s tools, their descriptions and a vocabulary of synonyms and unit names that ships with the page. There is no model on a server reading what you type, which is why it answers instantly and works offline once loaded.' },
    { q: 'What happens when I send a request?', a: 'Your description, the optional “what you do” line and the optional email go to our server and are kept until the request is dealt with. That is the only part of the page that leaves your device, and only when you press the button. The email is used to reply and for nothing else.' },
    { q: 'Why does it sometimes offer several tools?', a: 'Because several fit. "Convert a document" could be PDF to Word, image to PDF or CSV to JSON. It shows the closest few and a row of chips to narrow by family, and you can simply type the detail that settles it.' },
    { q: 'Can it find unit conversions?', a: 'Yes — all 1,048 of them. It understands the common names and short forms: km, mi, kg, lb, °C, °F, mph, psi, kWh, GB, and the rest. "km to miles" opens the exact page; "length" opens the family.' },
    { q: 'It did not understand me. What helps?', a: 'Use the noun for the thing and the verb for the job: "resize photo", "merge PDF", "GST on invoice". Avoid brand names unless the tool is an alternative to one — those are on the Comparisons page. If it still draws a blank, that is useful information for us: send it as a request.' },
    { q: 'What is the box on the section pages?', a: 'The same finder, kept to that section’s tools: ask the PDF page for "merge two files" and it answers from the PDF tools. When the section has nothing for the job it says so and shows what the rest of the site has, so you are never left at a dead end.' }
  ],
  related: ['/tools/', '/for/', '/guides/', '/compare/', '/contact/']
};

const GLYPHS = {
  [GLYPH]: '<symbol id="' + GLYPH + '" viewBox="0 0 24 24">\n  <path d="M4 5.5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9.5L5.5 20v-3.5H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"/>\n  <path d="M6.5 9.5h6M6.5 12.5h4" class="thin"/>\n  <path d="M19.5 2.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" class="fill"/>\n</symbol>'
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
const unesc = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const icon = (id, cls) => '<svg class="' + (cls || 'ico') + '" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + id + '"></use></svg>';

/* ------------------------------------------------------------------ */
/* the finder's index                                                 */
/* ------------------------------------------------------------------ */

function searchIndex() {
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  return box.SEARCH_INDEX || [];
}

/**
 * Keywords, where a spec carries them. Every engine file is run against a
 * stub window; the ones that define a registry are harvested, the ones that
 * need a real browser are skipped. Keywords are a bonus, not a requirement,
 * so a file that fails to run costs nothing but its keywords.
 */
function keywordsBySlug() {
  const out = {};
  const stubDoc = {
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; }, createElement() { return { style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }; },
    documentElement: { setAttribute() {}, getAttribute() { return null; }, style: {} }, body: { appendChild() {} }, head: { appendChild() {} }, fonts: { load() { return Promise.resolve(); } }
  };
  const REGISTRIES = ['TOOLS', 'PDF_TOOLS', 'DEV_TOOLS', 'AI_TOOLS', 'IMAGE_TOOLS', 'BIZ_TOOLS', 'TEXT_TOOLS', 'EDU_TOOLS', 'AI_IMAGE_TOOLS'];
  const dir = path.join(ROOT, 'engine');
  for (const name of fs.readdirSync(dir)) {
    if (!/\.js$/.test(name) || /bundle|render-|vendor|^aiimg-|^finder|^qr/.test(name)) continue;
    const abs = path.join(dir, name);
    if (fs.statSync(abs).size > 400000) continue;
    const w = { addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {} }, location: { pathname: '/', search: '' }, navigator: {}, matchMedia() { return { matches: false, addEventListener() {} }; } };
    try { new Function('window', 'document', 'self', 'globalThis', 'navigator', fs.readFileSync(abs, 'utf8'))(w, stubDoc, w, w, w.navigator); }
    catch (e) { continue; }
    for (const r of REGISTRIES) {
      const reg = w[r];
      if (!reg || typeof reg !== 'object') continue;
      for (const [slug, spec] of Object.entries(reg)) {
        if (!spec || typeof spec !== 'object') continue;
        const kw = spec.keywords || spec.tags;
        if (Array.isArray(kw) && kw.length) out[slug] = Array.from(new Set((out[slug] || []).concat(kw.map(String))));
      }
    }
  }
  return out;
}

function finderIndex() {
  const kws = keywordsBySlug();
  const rows = [];
  let withKeywords = 0, prefilled = 0;
  for (const [title, p, id] of searchIndex()) {
    /* conversions are matched from their slugs at run time; the finder does not list itself */
    if (p.indexOf('conversions/') === 0 || p === SECTION + '/' + SLUG + '/') continue;
    const abs = path.join(ROOT, p, 'index.html');
    if (!fs.existsSync(abs)) throw new Error('the index lists ' + p + ', which has no page');
    const src = fs.readFileSync(abs, 'utf8');
    const d = /<meta name="description" content="([^"]*)">/.exec(src);
    const g = /<h1><svg class="ico ico-title"[^>]*><use href="[^#"]*#(i-[a-z0-9-]+)"/.exec(src);
    const section = SECTIONS['/' + p.split('/')[0] + '/'];
    const slug = p.replace(/\/+$/, '').split('/').pop();
    const kw = kws[slug] || kws[id] || [];
    if (kw.length) withKeywords++;
    const row = [String(title), p, g ? g[1] : ('i-' + id), section ? section.name : p.split('/')[0], d ? unesc(d[1]) : '', kw.join(' | ')];
    if (JOBS) { row.push(ioOf(p)); const pf = prefillCol(p); if (pf) { row.push(pf); prefilled++; } }
    rows.push(row);
  }
  /* the landing pages (build-landing.js): not tools, so not in the search
     index, but each answers one job ("png to jpg", "compress pdf to 200kb")
     and the finder should open it for that job */
  if (fs.existsSync(path.join(ROOT, 'build-landing.js'))) {
    for (const row of require('./build-landing.js').finderRows()) { rows.push(row); if (row[5]) withKeywords++; }
  }
  return { rows, withKeywords, prefilled };
}
/** The eighth column, only on the rows that have one. */
function prefillCol(p) {
  if (!JOBS || typeof JOBS.prefillOf !== 'function') return '';
  try { return String(JOBS.prefillOf('/' + p) || ''); } catch (e) { return ''; }
}
/** The seventh column: '' when the module has nothing to say about a page. */
function ioOf(p) {
  if (!JOBS || typeof JOBS.jobOf !== 'function') return '';
  try { const j = JOBS.jobOf('/' + p); return j && j.io ? String(j.io) : ''; } catch (e) { return ''; }
}

/* ------------------------------------------------------------------ */
/* the page                                                           */
/* ------------------------------------------------------------------ */

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
    .replace(/(<script src="\/engine\/[^"]*"[^>]*><\/script>\n?)+/, scripts.map((s) => '<script src="' + s + '" defer></script>\n').join(''));
}
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

/* The callable the home page's request form posts to, from the same config
   the account pages use. While it says REPLACE_ME the form is left out. */
function endpoint() {
  const src = fs.readFileSync(path.join(ROOT, 'assets/firebase-config.js'), 'utf8');
  const get = (k) => (new RegExp(k + ": '([^']+)'").exec(src) || [])[1] || '';
  const project = get('projectId'), region = get('region') || 'asia-south1';
  if (!project || /REPLACE_ME/.test(project)) return '';
  return 'https://' + region + '-' + project + '.cloudfunctions.net/submitToolRequest';
}

function titleOf(p) {
  const abs = path.join(ROOT, p.replace(/^\/+/, ''), 'index.html');
  if (!fs.existsSync(abs)) throw new Error('related page missing: ' + p);
  const m = /<title>([^<|—]*)/.exec(fs.readFileSync(abs, 'utf8'));
  return m ? m[1].trim() : p;
}

function page(parts, total) {
  const pathOnly = '/' + SECTION + '/' + SLUG + '/';
  const url = SITE + pathOnly;
  const trail = trailFor(pathOnly);
  const s = SPEC;
  const sec = SECTIONS['/' + SECTION + '/'];
  /* the one number in the copy comes from the register, in the meta tags as well as on the page */
  const described = s.description.replace(/1,268/, Number(total).toLocaleString('en-GB'));
  const body =
    crumbs.render(trail, s.title) + '\n' +
    '<article class="tool finder-tool" data-tool="' + SLUG + '">\n' +
    '  <p class="eyebrow">' + esc(sec.name) + '</p>\n' +
    '  <h1>' + icon(GLYPH, 'ico ico-title') + esc(s.title) + '</h1>\n' +
    '  <p class="lede">' + esc(described) + '</p>\n' +
    '  <div class="tool-io" data-endpoint="' + esc(endpoint()) + '"></div>\n' +
    '  <section class="panel"><h2>Privacy</h2><p class="privacy-line">' + esc(s.privacy) + '</p></section>\n' +
    '  <section class="panel"><h2>How to ask</h2><ol class="tips">' + s.how.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol></section>\n' +
    '  <section class="panel"><h2>Tips</h2><ul class="tips">' + s.tips.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></section>\n' +
    '  <section class="panel"><h2>Frequently asked questions</h2>' + s.faq.map((f) => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n' +
    '  <section class="panel"><h2>Related tools</h2><ul class="related">' + s.related.map((p) => '<li><a href="' + p + '">' + esc(titleOf(p)) + '</a></li>').join('') + '</ul></section>\n' +
    '</article>\n' +
    '<script>\n' +
    'document.addEventListener(\'DOMContentLoaded\',function(){\n' +
    '  var root = document.querySelector(\'.tool\');\n' +
    '  try { ToolFinder.mount(root); }\n' +
    '  catch (e) {\n' +
    '    root.querySelector(\'.tool-io\').innerHTML =\n' +
    '      \'<div class="io-msg is-error">The finder needs a current browser. The <a href="/tools/">full directory</a> lists every tool.</div>\';\n' +
    '  }\n' +
    '});\n' +
    '</script>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebApplication', name: s.title, description: described, url, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, keywords: s.keywords.join(', ') },
      crumbs.breadcrumbList(trail, s.title, pathOnly),
      { '@type': 'FAQPage', mainEntity: s.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  }) + '</script>\n';
  const rel = SECTION + '/' + SLUG + '/index.html';
  const html = headFor(parts, pathOnly, s.pageTitle, described, ['/engine/finder.js']) + ld + parts.mid + '\n' + body + parts.tail;
  return footerApply(proof.apply(share.apply(outbound.rewrite(keepRelated(rel, keepPwa(rel, sidebar.apply(html, rel))), SECTION).html, rel), rel), rel);
}

/* ------------------------------------------------------------------ */
/* wiring                                                             */
/* ------------------------------------------------------------------ */

function patchSearchIndex() {
  const rel = 'assets/search-index.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (src.indexOf('"' + SECTION + '/' + SLUG + '/"') >= 0) return 0;
  write(rel, src.replace(/\];\s*$/, ',["' + SPEC.title + '","' + SECTION + '/' + SLUG + '/","' + SLUG + '"]];\n'));
  return 1;
}
function patchSitemap() {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const u = '/' + SECTION + '/' + SLUG + '/';
  if (src.indexOf('<loc>' + SITE + u + '</loc>') >= 0) return 0;
  write(rel, src.replace('</urlset>', '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>'));
  return 1;
}
function patchIcons() {
  const rel = 'assets/icons.svg';
  let svg = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (svg.indexOf('id="' + GLYPH + '"') >= 0) return 0;
  svg = svg.replace('</svg>', GLYPHS[GLYPH] + '\n</svg>');
  write(rel, svg);
  return 1;
}
/** The card on the Utilities hub, first in the grid: it is the way in to the other eight. */
function patchHub() {
  const rel = SECTION + '/index.html';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (src.indexOf('href="/' + SECTION + '/' + SLUG + '/"') >= 0) return false;
  const at = src.indexOf('<div class="grid">');
  if (at < 0) throw new Error('the utilities hub has no card grid');
  const card = '<a class="card" href="/' + SECTION + '/' + SLUG + '/"><span class="card-icon">' + icon(GLYPH) + '</span><strong>' + esc(SPEC.title) + '</strong><span class="card-desc">' + esc('Describe the job in plain words and it finds the right tool among all of them — or takes your request for one that does not exist.') + '</span></a>';
  const cut = at + '<div class="grid">'.length;
  return write(rel, src.slice(0, cut) + card + src.slice(cut));
}
function bumpServiceWorker() {
  const rel = 'sw.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return write(rel, src.replace(/var V = '1234tools-v(\d+)';/, (m, n) => "var V = '1234tools-v" + (Number(n) + 1) + "';"));
}

function main() {
  if (!fs.existsSync(path.join(ROOT, 'engine/finder.js'))) throw new Error('engine/finder.js does not exist');
  const glyphs = patchIcons();
  const indexed = patchSearchIndex();
  const total = indexTotal() + (CHECK ? indexed : 0);
  const { rows, withKeywords, prefilled } = finderIndex();
  /* v2 is the seven-column shape, v3 adds the eighth (prefill) where a
     calculator declares one; the engine reads any of them */
  const fi = write('assets/finder-index.js', 'window.FINDER_INDEX=' + JSON.stringify({ v: JOBS ? (typeof JOBS.prefillOf === 'function' ? 3 : 2) : 1, built: new Date().toISOString().slice(0, 10), tools: rows }) + ';\n');
  const parts = shell();
  const rel = SECTION + '/' + SLUG + '/index.html';
  const fresh = !fs.existsSync(path.join(ROOT, rel));
  const built = write(rel, page(parts, total));
  const hub = patchHub();
  const mapped = patchSitemap();
  const totals = patchTotal(total, changes, CHECK);
  const sw = changes.length ? bumpServiceWorker() : false;

  console.log('\nbuild-finder.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  finder index        ' + rows.length + ' tools with descriptions, ' + withKeywords + ' with keywords' + (fi ? ' (written)' : ' (unchanged)'));
  console.log('  io column           ' + (JOBS ? 'from build/jobs.js' : 'build/jobs.js absent: six columns (index v1)'));
  console.log('  prefill column      ' + prefilled + ' calculators');
  console.log('  page                ' + (built ? (fresh ? 'created' : 'updated') : 'unchanged'));
  console.log('  utilities hub card  ' + (hub ? 'added' : 'unchanged'));
  console.log('  search index        ' + (indexed ? 'row added' : 'unchanged'));
  console.log('  sitemap             ' + (mapped ? 'line added' : 'unchanged'));
  console.log('  icons               ' + (glyphs ? 'glyph added' : 'unchanged'));
  console.log('  site total          ' + Number(total).toLocaleString('en-GB') + (totals ? ' written on ' + totals + ' pages' : ''));
  console.log('  request endpoint    ' + (endpoint() || 'none configured — the form is left out'));
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
  if (process.argv.includes('--verbose')) changes.forEach((c) => console.log('    ' + c));
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('\nbuild-finder.js failed: ' + (e && e.message || e) + '\n'); process.exit(1); }
}
module.exports = { SPEC, finderIndex };
