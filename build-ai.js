/**
 * The AI section: a hub at /ai/, a page per tool, and its place in the
 * sidebar, the search index, the sitemap and the counts.
 *
 *   node build-ai.js          apply
 *   node build-ai.js --check  report what would change, write nothing
 *
 * Tools come from engine/ai-tools.js (window.AI_TOOLS). This script runs
 * that file in Node to read the specs — it stops before touching the DOM —
 * and writes each page in the site's current shape. These are the cloud
 * tools: every page loads the account layer, says what it sends, and shows
 * the month's allowance. Counts and breadcrumbs are left to build-sections
 * and build-crumbs, which run after this; build-outbound and build-pwa
 * after those.
 *
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crumbs = require('./build-crumbs.js');
const sources = require('./build/sources.js');
/* this builder writes outbound links of its own now (the sources panel),
   so it tags them here, at write time — a pass that tagged them afterwards
   would be undone by the next run of this one, and the two would rewrite
   each other for ever */
const outbound = require('./build-outbound.js');
const { SECTIONS, trailFor } = require('./build/sections.js');
const PLANS = require('./build/plans.json');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SECTION = 'ai';
const SHELL_PAGE = 'business/currency-converter/index.html';
const LIMITS = { free: 10, pro: (PLANS.plans.find(p => p.id === 'pro') || {}).credits || 300, business: (PLANS.plans.find(p => p.id === 'business') || {}).credits || 2000 };
/* the pricing page is the source for the numbers people see */
(function () {
  const pro = PLANS.plans.find(p => p.id === 'pro'), biz = PLANS.plans.find(p => p.id === 'business'), free = PLANS.plans.find(p => p.id === 'free');
  const n = (p) => { const f = (p && p.features || []).join(' '); const m = /(\d[\d,]*) AI calls/.exec(f); return m ? Number(m[1].replace(/,/g, '')) : null; };
  LIMITS.free = n(free) || LIMITS.free; LIMITS.pro = n(pro) || LIMITS.pro; LIMITS.business = n(biz) || LIMITS.business;
})();

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

/* Every engine/ai-tools*.js: the first file holds the original nine, and each
   later batch adds its own file so parallel work never edits the same one.
   A spec may carry `glyphSvg` (its <symbol>), so a batch is self-contained. */
function tools() {
  const w = { window: {} };
  for (const f of fs.readdirSync(path.join(ROOT, 'engine')).filter(n => /^ai-tools.*\.js$/.test(n)).sort()) {
    new Function('window', 'document', fs.readFileSync(path.join(ROOT, 'engine', f), 'utf8'))(w.window, undefined);
  }
  return Object.entries(w.window.AI_TOOLS).map(([slug, spec]) => ({ slug, spec }));
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
  let h = parts.head
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
    .replace(/(<script src="\/engine\/[^"]*"[^>]*><\/script>\n?)+/, (scripts || []).map(s => '<script src="' + s + '" defer></script>\n').join(''));
  return h;
}

const markActive = (html) => html
  .replace(/ class="side-link is-active"/g, ' class="side-link"')
  .replace('<a class="side-link" href="/' + SECTION + '/">', '<a class="side-link is-active" href="/' + SECTION + '/">');

function keepPwa(rel, html) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return html;
  const pwa = /<!-- PWA: generated by build-pwa\.js, do not edit -->[\s\S]*?<!-- \/PWA -->\n?/.exec(fs.readFileSync(abs, 'utf8'));
  return pwa ? html.replace('<link rel="stylesheet" href="/assets/app.css">', pwa[0] + '<link rel="stylesheet" href="/assets/app.css">') : html;
}

const accountScripts = '<script src="/assets/firebase-config.js"></script>\n<script>window.AI_LIMITS=' + JSON.stringify(LIMITS) + ';</script>\n<script src="/assets/account.js" defer></script>\n';

/* ------------------------------------------------------------------ */

function toolPage(t, parts, all) {
  const pathOnly = '/' + SECTION + '/' + t.slug + '/';
  const url = SITE + pathOnly;
  const trail = trailFor(pathOnly);
  const s = t.spec;
  /* the tools that shipped together sit first: a school tool lists school
     tools, a marketing tool lists marketing tools, and the section stops
     pointing all 33 of its pages at the same five */
  const sibling = (x) => x.spec.scripts[x.spec.scripts.length - 1] === s.scripts[s.scripts.length - 1];
  const related = all.filter(x => x.slug !== t.slug).sort((p, q) => (sibling(q) ? 1 : 0) - (sibling(p) ? 1 : 0)).slice(0, 5).map(x => '<li><a href="/' + SECTION + '/' + x.slug + '/">' + esc(x.spec.title) + '</a></li>')
    .concat(['<li><a href="/business/tally-converter/">Excel / CSV to Tally Converter</a></li>', '<li><a href="/pricing/">Plans and pricing</a></li>']).join('');
  const body =
    crumbs.render(trail, s.title) + '\n' +
    '<article class="tool ai-tool" data-tool="' + t.slug + '">\n' +
    '  <p class="eyebrow">AI for Business</p>\n' +
    '  <h1>' + icon(s.glyph, 'ico ico-title') + esc(s.title) + '</h1>\n' +
    '  <p class="lede">' + esc(s.description) + '</p>\n' +
    '  <p class="ai-privacy-line">' + icon('i-cloud', 'ico ico-inline') + ' <strong>This is a cloud tool.</strong> ' + esc(s.privacy) + ' Nothing is stored by us; the call is counted against your month’s allowance — ' + LIMITS.free + ' free, ' + LIMITS.pro + ' on Pro. <a href="/privacy/#ai">How the AI tools handle data</a>.</p>\n' +
    '  <div class="tool-io"></div>\n' +
    '  <section class="panel"><h2>Tips</h2><ul class="tips">' + (s.tips || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></section>\n' +
    '  <section class="panel"><h2>Frequently asked questions</h2>' + (s.faq || []).map(f => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n' +
    sources.panel(t.slug, s) +
    '  <section class="panel"><h2>Related tools</h2><ul class="related">' + related + '</ul></section>\n' +
    '</article>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'SoftwareApplication', name: s.title, description: s.description, url, applicationCategory: 'BusinessApplication', operatingSystem: 'Any', dateModified: sources.dateModified(t.slug, s) || undefined, offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR', description: LIMITS.free + ' calls a month free; more on Pro' } },
      crumbs.breadcrumbList(trail, s.title, pathOnly),
      { '@type': 'FAQPage', mainEntity: (s.faq || []).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  }) + '</script>\n';
  const rel = SECTION + '/' + t.slug + '/index.html';
  return outbound.rewrite(keepPwa(rel, markActive(headFor(parts, pathOnly, s.title + ' — AI for Business | 1234Tools', s.description, s.scripts) + accountScripts + ld + parts.mid + '\n' + body + parts.tail)), SECTION).html;
}

function hubPage(parts, all) {
  const sec = SECTIONS['/' + SECTION + '/'];
  const title = 'AI for Business — ' + all.length + ' tools that read, sort and write for you | 1234Tools';
  const description = all.length + ' AI tools for the work every business does by hand: read invoices into spreadsheets, categorise bank statements, clean customer lists, write the letters and listings, summarise contracts. ' + LIMITS.free + ' calls a month free, no card.';
  const cards = all.map(t => '<a class="card" href="/' + SECTION + '/' + t.slug + '/"><span class="card-icon">' + icon(t.spec.glyph) + '</span><strong>' + esc(t.spec.title) + '</strong><span class="card-desc">' + esc(t.spec.description) + '</span></a>').join('');
  const body =
    crumbs.render([], sec.hub || sec.name) + '\n' +
    '<p class="eyebrow">AI for Business</p>\n' +
    '<h1>' + icon('i-ai', 'ico ico-title') + 'AI for Business</h1>\n' +
    '<p class="lede">' + all.length + ' tools for the work every business does by hand. Read an invoice into a spreadsheet. Sort a bank statement into ledgers. Clean a customer list. Write the letter, the listing, the post, the ad, the landing page. Summarise the contract before you sign it.</p>\n' +
    '<section class="panel ai-how"><h2>How these are different from the rest of the site</h2>' +
    '<p>Everything else on 1234Tools runs on your device and never sends anything anywhere. These cannot: they need a language model, and that runs on a server. So each of these pages says exactly what it will send before you press the button — the text of the invoice, the rows of the statement — and the file itself is read on your device and never leaves it.</p>' +
    '<p>You need an account, because calls are counted: <strong>' + LIMITS.free + ' a month free</strong>, with no card, and <strong>' + LIMITS.pro + ' a month on Pro</strong>. We store the count, not what you sent or what came back. The model is Anthropic’s Claude, through our own gateway; your text is not used to train it. <a href="/privacy/#ai">The details, in the privacy policy</a>.</p></section>\n' +
    '<div class="grid">' + cards + '</div>\n' +
    '<section class="panel"><h2>What they are good at, and what they are not</h2><ul class="tips">' +
    '<li><strong>Reading and structuring</strong> — invoices, statements, contracts, notes — is where they save hours. The output is a first draft of data entry or of a document that you check, not a replacement for checking.</li>' +
    '<li><strong>Writing from facts</strong> works well when you give the facts. Anything missing comes back as a bracketed placeholder rather than an invention; that is deliberate.</li>' +
    '<li><strong>Tax and legal questions</strong> get honest confidence levels and a list of what to check. They are a fast route to the right neighbourhood, not a filing or a legal opinion.</li>' +
    '<li><strong>Scanned documents</strong> are read as pictures by the Scanned Invoice &amp; Receipt Reader, the Expense Receipts tool, the KYC Document Reader and the Property Document Reader: the resized picture itself is sent, so cover what should not travel before you photograph it. A typed or exported PDF is still better fed to the text tools, which send no picture.</li></ul></section>\n' +
    '<section class="panel"><h2>Frequently asked questions</h2>' +
    '<details><summary>Why do I need an account for these and nothing else?</summary><p>Because these cost money each time they run and the free allowance has to belong to someone. The account does nothing else: it is an email address, a plan, and a count. Every tool that runs in your browser stays free and anonymous.</p></details>' +
    '<details><summary>Is my data used to train the model?</summary><p>No. Calls go through our gateway to Anthropic’s API, whose terms exclude API data from training. We do not store your inputs or the outputs.</p></details>' +
    '<details><summary>What happens when the free calls run out?</summary><p>The tool tells you, with the date they reset, and points to the plans. Nothing is charged without you choosing a plan.</p></details>' +
    '<details><summary>Which tools are coming next?</summary><p>A GST return reconciler, batch runs over whole folders for Pro, and Tally-direct import for the categoriser. The order depends on what people ask for — the contact page works.</p></details></section>\n';
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'AI for Business', description, url: SITE + '/' + SECTION + '/', mainEntity: { '@type': 'ItemList', numberOfItems: all.length, itemListElement: all.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.spec.title, url: SITE + '/' + SECTION + '/' + t.slug + '/' })) } },
      crumbs.breadcrumbList([], sec.hub || sec.name, '/' + SECTION + '/')
    ]
  }) + '</script>\n';
  const rel = SECTION + '/index.html';
  return keepPwa(rel, markActive(headFor(parts, '/' + SECTION + '/', title, description, []) + ld + parts.mid + '\n' + body + parts.tail));
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
function unpublished() {
  const out = new Set();
  try {
    require('child_process').execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n').forEach(f => { const t = f.trim(); if (t.endsWith('.html')) out.add(t); });
  } catch (e) { /* no git */ }
  return out;
}

/** The sidebar group, on every page, before Learning. */
function patchSidebar(count) {
  const group = '\n      <p class="side-group">AI for business</p>\n      <a class="side-link" href="/ai/">\n        ' + icon('i-ai') + '<span class="side-name">AI for Business</span><span class="side-count">' + count + '</span>\n      </a>\n';
  const anchor = '\n      <p class="side-group">Learning</p>';
  const drafts = unpublished();
  let touched = 0;
  for (const abs of pages()) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (drafts.has(rel)) continue;
    const before = fs.readFileSync(abs, 'utf8');
    if (isStub(before) || before.indexOf(anchor) < 0) continue;
    let html = before;
    if (!/class="side-link[^"]*" href="\/ai\/"/.test(html)) html = html.replace(anchor, group + anchor);
    html = html.replace(/(<a class="side-link[^"]*" href="\/ai\/">[\s\S]{0,300}?<span class="side-count">)\d+(<\/span>)/, '$1' + count + '$2');
    if (html !== before) { changes.push('update ' + rel); if (!CHECK) fs.writeFileSync(abs, html); touched++; }
  }
  return touched;
}

/** A section card on the homepage, cloned from the Learning card. */
function patchHome(count) {
  const rel = 'index.html';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (/<a class="card card-lg" href="\/ai\/">/.test(src)) return false;
  const learn = /<a class="card card-lg" href="\/learn\/">[\s\S]*?<\/a>/.exec(src);
  if (!learn) throw new Error('the homepage has no Learning card to sit beside');
  const card = learn[0].replace('href="/learn/"', 'href="/ai/"').replace(/#i-learn"/, '#i-ai"')
    .replace(/<strong>[^<]*<\/strong>/, '<strong>AI for Business</strong>')
    .replace(/<span class="card-desc">[^<]*<\/span>/, '<span class="card-desc">' + count + ' tools · ' + LIMITS.free + ' calls a month free</span>');
  return write(rel, src.replace(learn[0], card + learn[0]));
}

function patchSearchIndex(list) {
  const rel = 'assets/search-index.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const add = list.filter(t => src.indexOf('"' + SECTION + '/' + t.slug + '/"') < 0).map(t => '["' + t.spec.title.replace(/"/g, '\\"') + '","' + SECTION + '/' + t.slug + '/","' + t.slug + '"]');
  if (!add.length) return 0;
  write(rel, src.replace(/\];\s*$/, ',' + add.join(',') + '];\n'));
  return add.length;
}
function patchSitemap(list) {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const urls = ['/' + SECTION + '/'].concat(list.map(t => '/' + SECTION + '/' + t.slug + '/'));
  const add = urls.filter(u => src.indexOf('<loc>' + SITE + u + '</loc>') < 0).map(u => '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>' + (u === '/' + SECTION + '/' ? '0.8' : '0.7') + '</priority></url>');
  if (!add.length) return 0;
  write(rel, src.replace('</urlset>', add.join('\n') + '\n</urlset>'));
  return add.length;
}

const GLYPHS = {
  'i-ai': '<symbol id="i-ai" viewBox="0 0 24 24">\n  <path d="M12 3l1.8 4.6L18.5 9.4l-4.7 1.8L12 15.8l-1.8-4.6L5.5 9.4l4.7-1.8z"/>\n  <path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" class="thin"/>\n  <path d="M5 16.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" class="thin"/>\n</symbol>',
  'i-cloud': '<symbol id="i-cloud" viewBox="0 0 24 24">\n  <path d="M7 18.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.2a3.8 3.8 0 0 1 .6 7.55z"/>\n  <path d="M12 11.5v6M9.5 14l2.5-2.5 2.5 2.5" class="thin"/>\n</symbol>',
  'i-ai-invoice': '<symbol id="i-ai-invoice" viewBox="0 0 24 24">\n  <path d="M6 2.8h7.6L18.6 8v13.2H6z"/>\n  <path d="M13.6 2.8V8h5" class="thin"/>\n  <path d="M8.5 12h7.5M8.5 15h7.5M8.5 18h4.5" class="thin"/>\n  <path d="M17.2 16.6l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" class="fill"/>\n</symbol>',
  'i-ai-bank': '<symbol id="i-ai-bank" viewBox="0 0 24 24">\n  <path d="M3.5 9.5L12 4.5l8.5 5z"/>\n  <path d="M5.5 10v7M9.8 10v7M14.2 10v7M18.5 10v7M4 19.5h16" class="thin"/>\n  <path d="M12 12.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" class="fill"/>\n</symbol>',
  'i-ai-clean': '<symbol id="i-ai-clean" viewBox="0 0 24 24">\n  <rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/>\n  <path d="M3.5 9.5h17M9 9.5v10M15 9.5v10" class="thin"/>\n  <path d="M5.5 14.5l1.2 1.2 2.3-2.4" class="thin"/>\n  <path d="M16.2 13.2l1.6 1.6M17.8 13.2l-1.6 1.6" class="thin"/>\n</symbol>',
  'i-ai-letter': '<symbol id="i-ai-letter" viewBox="0 0 24 24">\n  <rect x="3" y="5.5" width="18" height="13" rx="1.5"/>\n  <path d="M3.5 6.5L12 13l8.5-6.5" class="thin"/>\n  <path d="M17 15.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" class="fill"/>\n</symbol>',
  'i-ai-listing': '<symbol id="i-ai-listing" viewBox="0 0 24 24">\n  <path d="M4 7.5l2-4h12l2 4v12.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>\n  <path d="M4 7.5h16M9.5 11a2.5 2.5 0 0 0 5 0" class="thin"/>\n</symbol>',
  'i-ai-summary': '<symbol id="i-ai-summary" viewBox="0 0 24 24">\n  <path d="M6 2.8h7.6L18.6 8v13.2H6z"/>\n  <path d="M13.6 2.8V8h5" class="thin"/>\n  <path d="M8.5 12h7.5M8.5 15h5" class="thin"/>\n  <path d="M8.5 18h3" class="thin"/>\n</symbol>',
  'i-ai-minutes': '<symbol id="i-ai-minutes" viewBox="0 0 24 24">\n  <rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/>\n  <path d="M8.5 3.5v2M15.5 3.5v2M4.5 8.5h15" class="thin"/>\n  <path d="M7.5 12.5l1.2 1.2 2.3-2.4M12.5 12.5h4M7.5 16.5l1.2 1.2 2.3-2.4M12.5 16.5h4" class="thin"/>\n</symbol>',
  'i-ai-social': '<symbol id="i-ai-social" viewBox="0 0 24 24">\n  <path d="M4 5.5h16v10H10l-4 3.5v-3.5H4z"/>\n  <path d="M8 9h8M8 12h5" class="thin"/>\n</symbol>',
  'i-ai-hsn': '<symbol id="i-ai-hsn" viewBox="0 0 24 24">\n  <path d="M4 4.5h7l9 9-7 7-9-9z"/>\n  <circle cx="8" cy="8.5" r="1.3" class="fill"/>\n  <path d="M12 12.5l3 3M15 12.5l-3 3" class="thin"/>\n</symbol>'
};
function patchIcons(list) {
  const rel = 'assets/icons.svg';
  let svg = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let added = 0;
  const own = {};
  list.forEach(t => { if (t.spec.glyphSvg) own[t.spec.glyph] = t.spec.glyphSvg; });
  for (const g of ['i-ai', 'i-cloud'].concat(list.map(t => t.spec.glyph))) {
    if (svg.indexOf('id="' + g + '"') >= 0) continue;
    const sym = own[g] || GLYPHS[g];
    if (!sym) throw new Error('no glyph drawn for ' + g);
    svg = svg.replace('</svg>', sym + '\n</svg>');
    added++;
  }
  if (added) write(rel, svg);
  return added;
}

function patchTotal(oldTotal, newTotal) {
  if (oldTotal === newTotal) return 0;
  let n = 0;
  for (const abs of pages()) {
    const before = fs.readFileSync(abs, 'utf8');
    if (isStub(before) || before.indexOf(oldTotal) < 0) continue;
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    changes.push('update ' + rel);
    if (!CHECK) fs.writeFileSync(abs, before.split(oldTotal).join(newTotal));
    n++;
  }
  return n;
}
function bumpServiceWorker() {
  const rel = 'sw.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return write(rel, src.replace(/var V = '1234tools-v(\d+)';/, (m, n) => "var V = '1234tools-v" + (Number(n) + 1) + "';"));
}

function main() {
  if (!SECTIONS['/' + SECTION + '/']) throw new Error('build/sections.js has no entry for /' + SECTION + '/');
  const list = tools();
  /* The sidebar group goes in first, so the shell the pages are cut from
     already carries it and the active mark lands on the first run. Generate
     first and the second run would differ from the first. */
  const side = patchSidebar(list.length);
  const glyphs = patchIcons(list);
  const parts = shell();
  let built = 0, fresh = 0;
  for (const t of list) {
    const rel = SECTION + '/' + t.slug + '/index.html';
    if (!fs.existsSync(path.join(ROOT, rel))) fresh++;
    if (write(rel, toolPage(t, parts, list))) built++;
  }
  const hub = write(SECTION + '/index.html', hubPage(parts, list));
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /<small>([\d,]+)\+ free tools<\/small>/.exec(home);
  if (!m) throw new Error('could not read the tool total from index.html');
  const oldTotal = m[1];
  const newTotal = fresh ? (Number(oldTotal.replace(/,/g, '')) + fresh).toLocaleString('en-GB') : oldTotal;

  const indexed = patchSearchIndex(list);
  const mapped = patchSitemap(list);
  const homeCard = patchHome(list.length);
  const totals = patchTotal(oldTotal, newTotal);
  const sw = changes.length ? bumpServiceWorker() : false;

  console.log('\nbuild-ai.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  tools               ' + list.length + ': ' + list.map(t => t.slug).join(', '));
  console.log('  pages written       ' + built + ' (' + fresh + ' new)' + (hub ? ' + hub' : ''));
  console.log('  allowances          free ' + LIMITS.free + ', pro ' + LIMITS.pro + ', business ' + LIMITS.business);
  console.log('  sidebar group       ' + (side ? 'on ' + side + ' pages' : 'unchanged'));
  console.log('  homepage card       ' + (homeCard ? 'added' : 'unchanged'));
  console.log('  search index        ' + (indexed ? indexed + ' added' : 'unchanged'));
  console.log('  sitemap             ' + (mapped ? mapped + ' added' : 'unchanged'));
  console.log('  icons               ' + (glyphs ? glyphs + ' glyph(s) added' : 'unchanged'));
  console.log('  site total          ' + oldTotal + ' → ' + newTotal + (totals ? ' on ' + totals + ' pages' : ''));
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
module.exports = { tools };
