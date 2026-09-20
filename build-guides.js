/**
 * Generate /guides/ — the how-to guides.
 *
 *   node build-guides.js          apply
 *   node build-guides.js --check  report what would change, write nothing
 *
 * A guide is not a tool and does not hold one, so nothing here moves the
 * tool total. A collection answers "which tool"; a guide answers "how do I
 * do this at all", end to end, and names the tool that does step four
 * rather than every tool on the site.
 *
 * What this file refuses to write, and why:
 *
 * - A tool path that does not resolve. Every tool's title and description
 *   are read out of the tool's own page, exactly as build-collections.js
 *   does, so a guide cannot drift from what it links to and cannot
 *   describe the same tool twice.
 * - A fact block without a `checked` date and a source on an authority's
 *   own domain. A rate, a threshold or a deadline stated as current fact
 *   with no date on it is the thing that makes most how-to pages worse
 *   than useless a year after they are written.
 * - An example block whose caption does not say the figures are invented.
 *   A number in a worked example is not a claim about the world, but only
 *   if the page says so where the number is.
 * - A guide with fewer than three named failure modes. "Be careful" is not
 *   a failure mode.
 *
 * The breadcrumb comes from build-crumbs.js and the trail from
 * build/sections.js, which has no /guides/ entry yet. That is handled
 * rather than worked around: the trail comes back empty, the crumb reads
 * Home then the guide, every guide carries a link to the hub above its
 * heading so the hub is never orphaned, and the run says plainly that the
 * registry entry is missing. Add
 *
 *   '/guides/':  { name: 'Guides', crumb: 'Guides', meta: true },
 *
 * to build/sections.js and the trail picks itself up with no other change,
 * because the markup here is produced by the same function build-crumbs.js
 * would use to rewrite it.
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
const { GUIDES, AUTHORITIES } = require('./build/guides.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SECTION = 'guides';
const SHELL_PAGE = 'business/index.html';
const WPM = 200;

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
const strip = (html) => String(html).replace(/<[^>]*>/g, ' ');
const words = (html) => (unesc(strip(html)).match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu) || []).length;

/** "2026-09-20" -> "20 September 2026". Same shape the tools print. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}

/* ---------- what a guide may not get away with ---------- */

const authorities = new Set(AUTHORITIES.map(h => h.toLowerCase()));
function authoritative(url) {
  const m = /^https?:\/\/([^/:?#]+)/i.exec(String(url || ''));
  return !!m && authorities.has(m[1].toLowerCase());
}

/** Every rule that would make a guide worse than nothing, in one place. */
function validate(g, iconIds) {
  const where = (s) => 'guide "' + g.slug + '": ' + s;
  if (!/^[a-z0-9-]+$/.test(g.slug)) throw new Error(where('the slug is not a slug'));
  if (!g.answer || !g.name || !g.description) throw new Error(where('needs a name, a one-sentence answer and a description'));
  if (!iconIds.has(g.glyph)) throw new Error(where('the glyph ' + g.glyph + ' is not in assets/icons.svg'));
  if (!g.steps || g.steps.length < 3) throw new Error(where('a guide with fewer than three steps is a paragraph'));
  if (!g.wrong || g.wrong.length < 3) throw new Error(where('needs at least three named failure modes; it has ' + (g.wrong ? g.wrong.length : 0)));
  for (const w of g.wrong) if (!w.name || !w.text) throw new Error(where('a failure mode needs a name and an explanation'));
  if (!g.faq || g.faq.length < 3) throw new Error(where('needs at least three questions'));
  if (!g.before || !g.before.length) throw new Error(where('needs a "what you need before you start"'));
  if (!g.howLong) throw new Error(where('needs a "how long this should take"'));

  for (const s of g.steps) {
    if (!s.name || !s.body || !s.body.length) throw new Error(where('a step needs a name and a body'));
    for (const b of s.body) {
      if (b.fact) {
        const f = b.fact;
        if (!longDate(f.checked)) throw new Error(where('a fact block has no checked date in YYYY-MM-DD'));
        if (!f.sources || !f.sources.length) throw new Error(where('a fact block has no source'));
        if (!f.sources.some(x => authoritative(x[1]))) {
          throw new Error(where('a fact block cites nothing on an authority\'s own domain: ' + f.sources.map(x => x[1]).join(', ')));
        }
      }
      if (b.example) {
        const cap = String(b.example.caption || '');
        if (!/made[\s-]?up|invented|illustrative|not real/i.test(cap)) {
          throw new Error(where('an example block must say in its caption that the figures are invented — "' + cap + '"'));
        }
        if (!b.example.head || !b.example.rows || !b.example.rows.length) throw new Error(where('an example block needs a head and rows'));
      }
      if (b.tool && !b.why) throw new Error(where('a tool named inside a step must say what it does at that step'));
    }
  }
  for (const c of g.collections || []) {
    if (!fs.existsSync(path.join(ROOT, 'for', c, 'index.html'))) throw new Error(where('points at /for/' + c + '/, which does not exist'));
  }
  for (const r of g.related || []) {
    if (!GUIDES.some(x => x.slug === r)) throw new Error(where('points at the guide "' + r + '", which is not one'));
  }
  if (!g.tools || !g.tools.length) throw new Error(where('names no tools at all, which makes it an article rather than a guide'));
}

/** The icon ids the site actually has, so a dead <use> stops the build. */
function iconIds() {
  const src = fs.readFileSync(path.join(ROOT, 'assets/icons.svg'), 'utf8');
  const out = new Set();
  for (const m of src.matchAll(/id="([^"]+)"/g)) out.add(m[1]);
  return out;
}

/* ---------- a tool's own words, read from its own page ---------- */

const metaCache = {};
function toolMeta(p) {
  if (metaCache[p]) return metaCache[p];
  const abs = path.join(ROOT, p.replace(/^\/+/, ''), 'index.html');
  if (!fs.existsSync(abs)) throw new Error('a guide points at ' + p + ', which does not exist');
  const src = fs.readFileSync(abs, 'utf8');
  const t = /<title>([^<]*)<\/title>/.exec(src);
  const d = /<meta name="description" content="([^"]*)">/.exec(src);
  if (!t || !d) throw new Error(p + ' has no title or description to read');
  const title = unesc(t[1]).replace(/\s*[—|]\s*(Free Online|AI for Business).*$/, '').trim();
  metaCache[p] = { path: p, title, description: unesc(d[1]), pricing: pricingFor(p) };
  return metaCache[p];
}

/* ---------- the shell every generated page borrows ---------- */

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

/* ---------- blocks ---------- */

const badge = (p) => '<span class="tag tag-' + p.key + '" title="' + esc(p.blurb) + '">' + esc(p.label) + '</span>';

function toolCard(m) {
  return '<a class="card" href="' + m.path + '"><strong>' + esc(m.title) + '</strong>' +
    '<span class="card-desc">' + esc(m.description) + '</span>' + badge(m.pricing) + '</a>';
}

/** A rate, threshold or deadline: never in running prose, always dated. */
function factBlock(f) {
  const when = longDate(f.checked);
  const items = f.sources.map(x => {
    const [label, url, note] = x;
    return '<li><a href="' + esc(url) + '">' + esc(label) + '</a>' + (note ? ' <span class="source-note">— ' + esc(note) + '</span>' : '') + '</li>';
  }).join('');
  return '<aside class="panel panel-sources" data-checked="' + esc(f.checked) + '">' +
    '<h2>The figures here, and when they were last checked</h2>' +
    '<p class="collection-intro">' + esc(f.text) + '</p>' +
    '<p class="checked-on">Checked against the sources below on <time datetime="' + esc(f.checked) + '">' + esc(when) + '</time>. Rates, thresholds and deadlines move — at a Budget, at a notification, sometimes between one. Anything you are going to act on, check at the source.</p>' +
    '<ul class="source-list">' + items + '</ul></aside>';
}

/** Invented figures, said to be invented in the same box as the figures. */
function exampleBlock(e) {
  const head = '<thead><tr>' + e.head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead>';
  const body = '<tbody>' + e.rows.map(r => '<tr>' + r.map((c, i) => i === 0
    ? '<th scope="row">' + esc(c) + '</th>'
    : '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody>';
  return '<div class="tool-table" data-example="invented">' +
    '<p class="group-blurb">' + esc(e.caption) + '</p>' +
    '<div class="table-scroll"><table class="biz-table trust-table">' + head + body + '</table></div></div>';
}

function block(b) {
  if (b.p) return '<p class="collection-intro">' + esc(b.p) + '</p>';
  if (b.ul) return '<ul class="tips">' + b.ul.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  if (b.ol) return '<ol class="tips">' + b.ol.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>';
  if (b.formula) return '<p class="formula">' + esc(b.formula) + '</p>';
  if (b.fact) return factBlock(b.fact);
  if (b.example) return exampleBlock(b.example);
  if (b.tool) {
    const m = toolMeta(b.tool);
    /* Linked by its own title and nothing else: the description belongs to
       the tools section at the foot of the page, and belongs there once. */
    return '<p class="group-blurb">The tool for this step: <a href="' + m.path + '">' + esc(m.title) + '</a> — ' + esc(b.why) + '.</p>';
  }
  throw new Error('a step block of an unknown kind: ' + JSON.stringify(b).slice(0, 80));
}

/* ---------- the page ---------- */

function guidePage(g, parts) {
  const pathOnly = '/' + SECTION + '/' + g.slug + '/';
  const url = SITE + pathOnly;
  const trail = trailFor(pathOnly);

  const steps = g.steps.map((s, i) =>
    '<section class="collection-group" data-step="' + (i + 1) + '" id="step-' + (i + 1) + '">' +
    '<h2><span aria-hidden="true">' + (i + 1) + '. </span>' + esc(s.name) + '</h2>' +
    s.body.map(block).join('') + '</section>').join('\n');

  const wrong =
    '<section class="collection-group" id="where-this-goes-wrong">' +
    '<h2>Where this usually goes wrong</h2>' +
    '<p class="group-blurb">' + g.wrong.length + ' things that actually happen, rather than a note asking you to be careful.</p>' +
    '<div class="panel"><ul class="tips">' +
    g.wrong.map(w => '<li><strong>' + esc(w.name) + '.</strong> ' + esc(w.text) + '</li>').join('') +
    '</ul></div></section>';

  const tools = g.tools.map(toolMeta);
  const toolSection =
    '<section class="collection-group" id="tools"><h2>The tools this uses</h2>' +
    '<p class="group-blurb">Each one described in its own words, read from its own page. Everything here runs in your browser unless it says otherwise.</p>' +
    '<div class="grid">' + tools.map(toolCard).join('') + '</div></section>';

  const collections = (g.collections || []).map(c => {
    const src = fs.readFileSync(path.join(ROOT, 'for', c, 'index.html'), 'utf8');
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(src);
    const label = h1 ? unesc(strip(h1[1])).trim() : c;
    return '<li><a href="/for/' + c + '/">' + esc(label) + '</a></li>';
  }).join('');
  const related = (g.related || []).map(r => {
    const x = GUIDES.find(y => y.slug === r);
    return '<li><a href="/' + SECTION + '/' + x.slug + '/">' + esc(x.name) + '</a></li>';
  }).join('');

  const body =
    crumbs.render(trail, g.name) + '\n' +
    '<article class="collection">\n' +
    '  <p class="eyebrow"><a href="/' + SECTION + '/">Guides</a></p>\n' +
    '  <h1>' + icon(g.glyph).replace('class="ico"', 'class="ico ico-title"') + esc(g.name) + '</h1>\n' +
    '  <p class="lede">' + esc(g.answer) + '</p>\n' +
    '  <p class="collection-count" id="meta">READING_TIME · ' + g.steps.length + ' steps · ' + g.wrong.length + ' ways it goes wrong</p>\n' +
    '  <section class="panel" id="before"><h2>What you need before you start</h2><ul class="tips">' +
      g.before.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></section>\n' +
    steps + '\n' +
    wrong + '\n' +
    '  <section class="panel" id="how-long"><h2>How long this should take</h2><p class="collection-intro">' + esc(g.howLong) + '</p></section>\n' +
    '  <section class="panel" id="faq"><h2>Frequently asked questions</h2>' +
      g.faq.map(f => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n' +
    toolSection + '\n' +
    (collections ? '  <section class="panel" id="collections"><h2>Short lists of tools for this kind of work</h2><ul class="related">' + collections + '</ul></section>\n' : '') +
    (related ? '  <section class="panel" id="related"><h2>Other guides</h2><ul class="related">' + related + '</ul></section>\n' : '') +
    '</article>\n';

  /* Reading time from the words that are actually on the page, rounded up,
     and never less than a minute. */
  const minutes = Math.max(1, Math.round(words(body) / WPM));
  const withTime = body.replace('READING_TIME', minutes + ' min read');

  /* The HowTo steps are the steps on the page. They are generated from the
     same array, so markup describing a page that was not written is not a
     mistake that can be made here. */
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HowTo',
        name: g.name,
        description: g.answer,
        url,
        totalTime: 'PT' + minutes + 'M',
        step: g.steps.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.name,
          url: url + '#step-' + (i + 1),
          text: s.body.filter(b => b.p).map(b => b.p).join(' ') || s.name
        })),
        supply: g.before.map(x => ({ '@type': 'HowToSupply', name: x })),
        tool: tools.map(m => ({ '@type': 'HowTool', name: m.title, url: SITE + m.path }))
      },
      crumbs.breadcrumbList(trail, g.name, pathOnly),
      { '@type': 'FAQPage', mainEntity: g.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  }) + '</script>\n';

  const html = sidebarFor(headFor(parts, pathOnly, g.title, g.description) + ld + parts.mid + '\n' + withTime + parts.tail, SECTION + '/' + g.slug + '/index.html');
  return outbound.rewrite(html, SECTION).html;
}

function hubPage(parts) {
  const pathOnly = '/' + SECTION + '/';
  const trail = trailFor(pathOnly);
  const title = 'Guides: how to actually finish the job';
  const description = 'How-to guides for the jobs this site has tools for — reconciling GSTR-2B, a VAT return from a spreadsheet, a bank reconciliation, a first MTD quarterly update, an Indian payroll run, a school timetable, chasing an invoice and getting a spreadsheet into Tally.';

  const card = (g) => '<a class="card" href="/' + SECTION + '/' + g.slug + '/"><span class="card-icon">' + icon(g.glyph) + '</span>' +
    '<strong>' + esc(g.name) + '</strong><span class="card-desc">' + esc(g.description) + '</span></a>';

  const body =
    crumbs.render(trail, 'Guides') + '\n' +
    '<article class="collection">\n' +
    '  <p class="eyebrow">Guides</p>\n' +
    '  <h1>' + icon('i-learn').replace('class="ico"', 'class="ico ico-title"') + 'Guides</h1>\n' +
    '  <p class="lede">' + esc('How to do the job, from the first file to the thing you file — written by somebody who has watched it go wrong.') + '</p>\n' +
    '  <p class="collection-count">' + GUIDES.length + ' guides · ' + GUIDES.reduce((n, g) => n + g.steps.length, 0) + ' steps · ' +
      GUIDES.reduce((n, g) => n + g.wrong.length, 0) + ' named ways to get it wrong</p>\n' +
    '  <p class="collection-intro">' + esc(description) + '</p>\n' +
    '  <p class="collection-intro">A tool page tells you what a tool does. These tell you what the job is: what you need before you start, what order to do it in, what the numbers mean when they come out, and where it usually goes wrong. Each one names the tool that does a particular step and says nothing about the tools that do not help.</p>\n' +
    '  <section class="collection-group"><h2>Every guide</h2><div class="grid">' + GUIDES.map(card).join('') + '</div></section>\n' +
    '  <section class="panel"><h2>How these are written</h2><ul class="tips">' +
      '<li><strong>Every guide says where it goes wrong.</strong> Named, specific failures — the credit note that is not negative, the bank account number a spreadsheet turned into a number — because the happy path is the part nobody needs help with.</li>' +
      '<li><strong>No undated figures.</strong> A rate, a threshold or a deadline is never stated in running prose. It sits in a box with the date it was last checked and a link to the authority that sets it, so you can tell at a glance whether it is still worth trusting.</li>' +
      '<li><strong>Worked examples say they are invented.</strong> Figures in an example are there to show the shape of the arithmetic, and the caption says so next to them.</li>' +
      '<li><strong>Tools are named where they help.</strong> A guide that links every tool on the site is an advertisement. These link the one that does step four.</li>' +
      '</ul></section>\n' +
    '  <section class="panel"><h2>Looking for a tool rather than a guide?</h2><ul class="related">' +
      '<li><a href="/for/">All collections — tools by trade and by job</a></li>' +
      '<li><a href="/tools/">The full directory of tools</a></li>' +
      '<li><a href="/learn/">Learning resources</a></li>' +
      '</ul></section>\n' +
    '</article>\n';

  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', name: title, description, url: SITE + pathOnly,
        mainEntity: {
          '@type': 'ItemList', numberOfItems: GUIDES.length,
          itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + '/' + SECTION + '/' + g.slug + '/', name: g.name }))
        }
      },
      crumbs.breadcrumbList(trail, 'Guides', pathOnly)
    ]
  }) + '</script>\n';

  const html = sidebarFor(headFor(parts, pathOnly, title, description) + ld + parts.mid + '\n' + body + parts.tail, SECTION + '/index.html');
  return outbound.rewrite(html, SECTION).html;
}

/* ---------- wiring ---------- */

function patchSitemap() {
  const rel = 'sitemap-1.xml';
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return 0;
  const src = fs.readFileSync(abs, 'utf8');
  const urls = ['/' + SECTION + '/'].concat(GUIDES.map(g => '/' + SECTION + '/' + g.slug + '/'));
  const add = urls.filter(u => src.indexOf('<loc>' + SITE + u + '</loc>') < 0)
    .map(u => '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>');
  if (!add.length) return 0;
  write(rel, src.replace('</urlset>', add.join('\n') + '\n</urlset>'));
  return add.length;
}

function bumpServiceWorker() {
  const rel = 'sw.js';
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return false;
  const src = fs.readFileSync(abs, 'utf8');
  return write(rel, src.replace(/var V = '1234tools-v(\d+)';/, (m, n) => "var V = '1234tools-v" + (Number(n) + 1) + "';"));
}

function main() {
  const ids = iconIds();
  const slugs = new Set();
  for (const g of GUIDES) {
    if (slugs.has(g.slug)) throw new Error('two guides share the slug ' + g.slug);
    slugs.add(g.slug);
    validate(g, ids);
  }

  const parts = shell();
  let built = 0;
  for (const g of GUIDES) if (write(SECTION + '/' + g.slug + '/index.html', guidePage(g, parts))) built++;
  if (write(SECTION + '/index.html', hubPage(parts))) built++;
  const mapped = patchSitemap();
  const sw = changes.length ? bumpServiceWorker() : false;

  const facts = GUIDES.reduce((n, g) => n + g.steps.reduce((k, s) => k + s.body.filter(b => b.fact).length, 0), 0);
  const registered = !!SECTIONS['/' + SECTION + '/'];

  console.log('\nbuild-guides.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  guides              ' + GUIDES.length + ', ' + GUIDES.reduce((n, g) => n + g.steps.length, 0) + ' steps');
  console.log('  failure modes       ' + GUIDES.reduce((n, g) => n + g.wrong.length, 0) + ' named');
  console.log('  dated figures       ' + facts + ' fact block(s), each with a checked date and a source on an authority');
  console.log('  tools referenced    ' + Object.keys(metaCache).length + ' distinct, described once each');
  console.log('  pages written       ' + built);
  console.log('  sitemap             ' + (mapped ? mapped + ' added' : 'unchanged'));
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  if (!registered) {
    console.log('  ! build/sections.js has no /' + SECTION + '/ entry, so the breadcrumb runs Home to the guide');
    console.log('    and skips the hub. Add:  \'/' + SECTION + '/\':  { name: \'Guides\', crumb: \'Guides\', meta: true },');
  }
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
module.exports = { toolMeta, longDate, authoritative };
