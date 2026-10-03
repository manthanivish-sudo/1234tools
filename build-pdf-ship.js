/**
 * Ship the PDF tools that are finished, and only those.
 *
 *   node build-pdf-ship.js          apply
 *   node build-pdf-ship.js --check  report what would change, write nothing
 *
 * Eight PDF tools were drafted. Each one was run against a real two-page PDF
 * before anything here was written, and the results decided the list:
 *
 *   pdf-editor      produced a correct file          -> ships
 *   pdf-signature   produced a correct file          -> ships, renamed
 *   pdf-compare     threw: core.extractTextFromPage is not a function
 *   pdf-to-excel    threw: doc.getPage is not a function
 *   pdf-ocr         has no run() at all, and no OCR engine is vendored
 *   pdf-redaction   runs, but draws a box over text that stays extractable
 *   pdf-form-filler cannot manipulate real form fields
 *   pdf-portfolio   a worse duplicate of Merge, and its other mode returns
 *                   no files
 *
 * The two that throw are not prototypes in the sense the others are: the
 * core has no text extraction of any kind, so both call a function that has
 * never existed. Giving them one is a feature, not a fix.
 *
 * Redaction is the one that must not ship on a promise. It draws a filled
 * rectangle over the words and names the output "-redacted.pdf", while the
 * text underneath stays in the content stream and comes out with a copy and
 * paste. That is the mechanism behind every "redacted" court filing that has
 * ever leaked. On a site whose whole pitch is that your files are safe here,
 * shipping it would cost more than all eight tools add.
 *
 * The pages are generated rather than migrated, so they arrive with the
 * current URL shape, root-absolute links, and the font and analytics blocks
 * already correct — the drafts have none of those.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const VERBOSE = process.argv.includes('--verbose');
const SITE = 'https://www.1234tools.com';

/* The breadcrumb is a shared component: same markup and same structured data
   as every other page, from the same function, so a page generated here can
   never disagree with the pass that maintains the rest. */
const crumbs = require('./build-crumbs.js');
const sources = require('./build/sources.js');
/* this builder writes outbound links of its own now (the sources panel),
   so it tags them here, at write time — a pass that tagged them afterwards
   would be undone by the next run of this one, and the two would rewrite
   each other for ever */
const outbound = require('./build-outbound.js');
const { trailFor } = require('./build/sections.js');

/* slug -> icon glyph. Only what has been verified to work. A spec may carry
   its own `glyphSvg`, which is added to the sprite if the id is not there. */
const SHIPPING = [
  ['pdf-editor', 'i-pdf-editor'],
  ['pdf-signature', 'i-pdf-signature'],
  ['payslip-pdf', 'i-payslip'],
  ['mail-merge-pdf', 'i-mail-merge'],
  ['quotation-pdf', 'i-quotation'],
  ['purchase-order-pdf', 'i-purchase-order'],
  ['delivery-challan-pdf', 'i-challan']
].filter(([slug]) => fs.existsSync(path.join(__dirname, 'engine', 'pdf-' + slug + '.js')));

function patchIcons() {
  const rel = 'assets/icons.svg';
  let svg = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let added = 0;
  for (const [slug, glyph] of SHIPPING) {
    if (svg.indexOf('id="' + glyph + '"') >= 0) continue;
    const s = spec(slug);
    if (!s.glyphSvg) continue;
    svg = svg.replace('</svg>', s.glyphSvg + '\n</svg>');
    added++;
  }
  if (added) write(rel, svg);
  return added;
}

const changes = [];
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (existing === content) return false;
  changes.push((existing === null ? 'create ' : 'update ') + rel);
  if (!CHECK) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return true;
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const icon = (id) =>
  '<svg class="ico" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + id + '"></use></svg>';

/** Load a draft spec the way the browser would. */
function spec(slug) {
  const w = { window: {} };
  new Function('window', fs.readFileSync(path.join(ROOT, 'engine/pdf-' + slug + '.js'), 'utf8'))(w.window);
  const t = w.window.PDF_TOOLS[slug];
  if (!t) throw new Error('engine/pdf-' + slug + '.js did not define PDF_TOOLS["' + slug + '"]');
  return t;
}

/* ------------------------------------------------------------------ */

function shell() {
  const src = fs.readFileSync(path.join(ROOT, 'pdf/merge-pdf/index.html'), 'utf8');
  const headEnd = src.indexOf('</head>');
  const open = '<main id="main" class="content">';
  const mainStart = src.indexOf(open);
  const mainEnd = src.indexOf('</main>');
  if (headEnd < 0 || mainStart < 0 || mainEnd < 0) throw new Error('could not read the shell');
  return {
    head: src.slice(0, headEnd),
    mid: src.slice(headEnd, mainStart + open.length),
    tail: src.slice(mainEnd)
  };
}

function head(parts, slug, title, description, canonical) {
  let h = parts.head
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + canonical + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(title) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + canonical + '">')
    .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(title) + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(description) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '')
    /* the shell's own manifest and engine script belong to merge-pdf */
    .replace(/<link rel="manifest" href="[^"]*">/, '<link rel="manifest" href="/pwa/pdf/' + slug + '.webmanifest">')
    .replace(/<link rel="apple-touch-icon" href="[^"]*">/, '<link rel="apple-touch-icon" href="/assets/pwa/' + glyphFor(slug) + '-192.png">')
    .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*">/, '<meta name="apple-mobile-web-app-title" content="' + esc(shortName(spec(slug).title)) + '">')
    .replace('<script src="/engine/pdf-merge-pdf.js" defer></script>', '<script src="/engine/pdf-' + slug + '.js" defer></script>');
  return h;
}

/* build-pwa.js names the icon after the glyph the h1 uses, so this must too;
   "i-" + slug only matched while every shipped glyph happened to be that. */
const glyphFor = (slug) => (SHIPPING.find(function (x) { return x[0] === slug; }) || ['', 'i-' + slug])[1];

/* The home-screen label is build-pwa.js's to decide. A second copy of the
   rule here drifted from the first and the two scripts spent a while
   correcting each other's output on every run. */
const { shortName } = require('./build-pwa.js');

const markActive = (html) => html
  .replace(/ class="side-link is-active"/g, ' class="side-link"')
  .replace('<a class="side-link" href="/pdf/">', '<a class="side-link is-active" href="/pdf/">');

function toolPage(slug, glyph, parts) {
  const t = spec(slug);
  const url = SITE + '/pdf/' + slug + '/';
  const title = t.title + ' — Free Online | 1234Tools';

  const related = SHIPPING.filter(function (x) { return x[0] !== slug; })
    .map(function (x) { return '<li><a href="/pdf/' + x[0] + '/">' + esc(spec(x[0]).title) + '</a></li>'; })
    .concat([
      '<li><a href="/pdf/watermark-pdf/">Add Watermark to PDF</a></li>',
      '<li><a href="/pdf/pdf-page-numbers/">Add Page Numbers to PDF</a></li>',
      '<li><a href="/pdf/merge-pdf/">Merge PDF Files</a></li>',
      '<li><a href="/pdf/pdf-organise/">Organise PDF Pages</a></li>'
    ]).join('');

  const pathOnly = '/pdf/' + slug + '/';
  const trail = trailFor(pathOnly);
  const body =
    crumbs.render(trail, t.title) + '\n' +
    '<article class="tool" data-tool="' + slug + '">\n' +
    '  <p class="eyebrow">PDF Tools</p>\n' +
    '  <h1><svg class="ico ico-title" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + glyph + '"></use></svg>' + esc(t.title) + '</h1>\n' +
    '  <p class="lede">' + esc(t.description) + '</p>\n' +
    '  <div class="tool-io"></div>\n' +
    '  <section class="panel"><h2>Privacy</h2><p class="privacy-line">Your file never leaves your device. It is parsed and rewritten by your own browser, so nothing is uploaded, queued or logged.</p></section>\n' +
    (t.tips && t.tips.length
      ? '  <section class="panel"><h2>Tips</h2><ul class="tips">' +
        t.tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>\n' : '') +
    (t.faq && t.faq.length
      ? '  <section class="panel"><h2>Frequently asked questions</h2>' +
        t.faq.map(function (f) { return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>'; }).join('') +
        '</section>\n' : '') +
    sources.panel(slug, t) +
    '  <section class="panel"><h2>Related tools</h2><ul class="related">' + related + '</ul></section>\n' +
    '</article>\n' +
    '<script>\n' +
    'document.addEventListener(\'DOMContentLoaded\',function(){\n' +
    '  var spec = window.PDF_TOOLS[\'' + slug + '\'];\n' +
    '  spec.id = \'' + slug + '\';\n' +
    '  var root = document.querySelector(\'.tool\');\n' +
    '  try { MVRTool.mountPDF(spec, root); }\n' +
    '  catch (e) {\n' +
    '    root.querySelector(\'.tool-io\').innerHTML =\n' +
    '      \'<div class="io-msg is-error">This tool needs browser features yours does not support. Try a current version of Chrome, Firefox, Edge or Safari.</div>\';\n' +
    '  }\n' +
    '});\n' +
    '</script>\n';

  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication', name: t.title, description: t.description, url: url,
        applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', dateModified: sources.dateModified(slug, t) || undefined,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
      },
      crumbs.breadcrumbList(trail, t.title, pathOnly)
    ].concat(t.faq && t.faq.length ? [{
      '@type': 'FAQPage',
      mainEntity: t.faq.map(function (f) {
        return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } };
      })
    }] : [])
  }) + '</script>\n';

  return outbound.rewrite(markActive(head(parts, slug, title, t.description, url) + ld + parts.mid + '\n' + body + parts.tail), 'pdf').html;
}

/* ------------------------------------------------------------------ */
/* wiring                                                             */
/* ------------------------------------------------------------------ */

function updateSearchIndex() {
  const rel = 'assets/search-index.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const entries = SHIPPING
    .filter(function (x) { return src.indexOf('"pdf/' + x[0] + '/"') < 0; })
    .map(function (x) {
      return '["' + spec(x[0]).title.replace(/"/g, '\\"') + '","pdf/' + x[0] + '/","' + x[0] + '"]';
    });
  if (!entries.length) return 0;
  write(rel, src.replace(/\];\s*$/, ',' + entries.join(',') + '];\n'));
  return entries.length;
}

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

const isStub = (html) =>
  /name="robots" content="noindex,follow"/.test(html) && /http-equiv="refresh"/.test(html);

function unpublished() {
  const out = new Set();
  try {
    const listed = require('child_process')
      .execFileSync('git', ['ls-files', '--others', '--exclude-standard'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    listed.split(String.fromCharCode(10)).forEach(function (f) {
      const t = f.trim();
      if (t.endsWith('.html')) out.add(t);
    });
  } catch (e) { /* no git: assume everything has shipped */ }
  return out;
}

/** Move the site total and the PDF section count everywhere they appear. */
function patchCounts(oldTotal, newTotal, oldPdf, newPdf) {
  const drafts = unpublished();
  const sidebar = new RegExp(
    '(<a class="side-link[^"]*" href="/pdf/">[\\s\\S]{0,400}?<span class="side-count">)' + oldPdf + '(</span>)');
  const homeCard = new RegExp(
    '(<a class="card card-lg" href="/pdf/">[\\s\\S]{0,400}?<span class="card-desc">)' + oldPdf + '( tools</span>)');
  let totals = 0, counts = 0, skipped = 0;

  for (const abs of pages()) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (drafts.has(rel)) { skipped++; continue; }
    const before = fs.readFileSync(abs, 'utf8');
    if (isStub(before)) { skipped++; continue; }
    let html = before;
    if (oldTotal !== newTotal && html.indexOf(oldTotal) >= 0) {
      html = html.split(oldTotal).join(newTotal);
      totals++;
    }
    const next = html.replace(sidebar, '$1' + newPdf + '$2').replace(homeCard, '$1' + newPdf + '$2');
    if (next !== html) { html = next; counts++; }
    if (html !== before) {
      changes.push('update ' + rel);
      if (!CHECK) fs.writeFileSync(abs, html);
    }
  }
  return { totals, counts, skipped };
}

const unesc = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

/** The cards on the hub, in document order across its grids. */
function hubCards(html) {
  const out = [];
  for (const grid of html.matchAll(/<div class="grid(?: [^"]*)?">([\s\S]*?)<\/div>/g)) {
    for (const card of grid[1].matchAll(/<a class="card" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const s = /<strong>([^<]*)<\/strong>/.exec(card[2]);
      if (!s) throw new Error('a card on the PDF hub has no <strong> title: ' + card[1]);
      out.push({ href: card[1], name: unesc(s[1]) });
    }
  }
  return out;
}

/** "1…17,23" — a list of positions as a reader would write it. */
function runs(nums) {
  const n = nums.map(Number).sort(function (a, b) { return a - b; });
  const out = [];
  for (let i = 0; i < n.length;) {
    let j = i;
    while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
    out.push(j > i + 1 ? n[i] + '…' + n[j] : n.slice(i, j + 1).join(','));
    i = j + 1;
  }
  return out.join(',') || 'none';
}

const slugOf = (u) => String(u).replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '');

/**
 * The PDF hub: its card grids, the counts it quotes, and its structured data.
 *
 * The cards are the truth. Everything else on the page that counts or lists
 * the tools — the lede, the "N free PDF tools" in the three descriptions, and
 * the ItemList in the JSON-LD — is rebuilt from them on every run, so a card
 * added by hand counts too, and a tool that moves takes its structured data
 * with it. Before this ran the ItemList had drifted: 18 entries numbered 1…17
 * and 23 (the drafts in between were deleted), two pointing at .html pages
 * that had become redirect stubs, under a numberOfItems of 24 on a hub that
 * showed 22 cards.
 *
 * CollectionPage and BreadcrumbList are left exactly as found, and the JSON is
 * written back as compactly as build-crumbs.js writes it, so the two never
 * rewrite each other.
 */
function patchHub(oldPdf, newPdf) {
  const rel = 'pdf/index.html';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const report = { hrefs: [], urls: [], added: [], dropped: [] };
  let out = src.replace('<p class="lede">' + oldPdf + ' tools for ',
                        '<p class="lede">' + newPdf + ' tools for ');

  /* The hub groups its cards by what the tool does to a file. Everything in
     SHIPPING takes a PDF, or a few fields, and writes a new one, so a card that
     is missing goes into the first grid. */
  const head = out.indexOf('<h2>Work with an existing PDF</h2>');
  if (head < 0) throw new Error('the PDF hub no longer has a "Work with an existing PDF" section');
  const close = out.indexOf('</a></div>', head);
  if (close < 0) throw new Error('could not find the end of that section’s card grid');

  const cards = SHIPPING
    .filter(function (x) { return out.indexOf('href="/pdf/' + x[0] + '/"') < 0; })
    .map(function (x) {
      const t = spec(x[0]);
      return '<a class="card" href="/pdf/' + x[0] + '/"><span class="card-icon">' + icon(x[1]) + '</span>' +
        '<strong>' + esc(t.title) + '</strong><span class="card-desc">' + esc(t.description) + '</span></a>';
    }).join('');
  if (cards) out = out.slice(0, close + 4) + cards + out.slice(close + 4);

  /* A tool lives at /pdf/<slug>/; the flat .html address is a redirect stub.
     A card that still says .html is pointed at the directory once it exists. */
  out = out.replace(/(<a class="card" href=")\/pdf\/([a-z0-9-]+)\.html(")/g, function (m, a, slug, z) {
    if (!fs.existsSync(path.join(ROOT, 'pdf', slug, 'index.html'))) return m;
    report.hrefs.push('/pdf/' + slug + '.html → /pdf/' + slug + '/');
    return a + '/pdf/' + slug + '/' + z;
  });

  const list = hubCards(out);
  if (!list.length) throw new Error('the PDF hub has no cards');
  const n = list.length;
  report.cards = n;

  /* the lede and the three descriptions count the cards */
  out = out.replace(/(<p class="lede">)\d+( tools for )/, '$1' + n + '$2');
  out = out.replace(/(<meta (?:name|property)="[^"]*description" content="[^"]*?)\d+( free PDF tools)/g,
    function (m, a, z) { return a + n + z; });

  /* the JSON-LD: a new ItemList, the same CollectionPage and BreadcrumbList */
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(out);
  if (!ld) throw new Error('the PDF hub has no JSON-LD');
  const data = JSON.parse(ld[1]);
  const graph = Array.isArray(data['@graph']) ? data['@graph'] : null;
  if (!graph) throw new Error('the PDF hub’s JSON-LD has no @graph');
  const page = graph.find(function (x) { return x && x['@type'] === 'CollectionPage'; });
  if (page && typeof page.description === 'string') {
    page.description = page.description.replace(/\d+( free PDF tools)/, n + '$1');
  }
  const at = graph.findIndex(function (x) { return x && x['@type'] === 'ItemList'; });
  const was = at >= 0 ? graph[at] : null;
  const items = list.map(function (c, i) {
    return { '@type': 'ListItem', position: i + 1, name: c.name, url: SITE + c.href };
  });
  const next = {
    '@type': 'ItemList',
    name: (was && was.name) || 'PDF Tools',
    numberOfItems: n,
    itemListElement: items
  };
  if (at >= 0) graph[at] = next; else graph.push(next);
  out = out.slice(0, ld.index) +
        '<script type="application/ld+json">' + JSON.stringify(data) + '</script>' +
        out.slice(ld.index + ld[0].length);

  /* what moved, for the summary */
  const before = (was && Array.isArray(was.itemListElement)) ? was.itemListElement : [];
  const bySlug = new Map(before.map(function (e) { return [slugOf(e.url), e]; }));
  items.forEach(function (e) {
    const old = bySlug.get(slugOf(e.url));
    if (!old) report.added.push(e.name);
    else if (old.url !== e.url) report.urls.push(old.url + ' → ' + e.url);
  });
  before.forEach(function (e) {
    if (!items.some(function (x) { return slugOf(x.url) === slugOf(e.url); })) report.dropped.push(e.name);
  });
  report.list = {
    was: before.length,
    wasPositions: runs(before.map(function (e) { return e.position; })),
    wasCount: was ? was.numberOfItems : null,
    now: n
  };
  report.counts = (src.match(/\b\d+ free PDF tools\b/g) || [])
    .filter(function (s) { return s !== n + ' free PDF tools'; }).length;
  const lede = /<p class="lede">(\d+) tools for /.exec(src);
  report.lede = lede && Number(lede[1]) !== n ? lede[1] + ' → ' + n : null;

  report.changed = write(rel, out);
  return report;
}

function patchSitemap() {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const entries = SHIPPING
    .filter(function (x) { return src.indexOf('<loc>' + SITE + '/pdf/' + x[0] + '/</loc>') < 0; })
    .map(function (x) {
      return '<url><loc>' + SITE + '/pdf/' + x[0] + '/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>';
    });
  if (!entries.length) return 0;
  write(rel, src.replace('</urlset>', entries.join('\n') + '\n</urlset>'));
  return entries.length;
}

function bumpServiceWorker() {
  const rel = 'sw.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return write(rel, src.replace(/var V = '1234tools-v(\d+)';/, function (m, n) {
    return "var V = '1234tools-v" + (Number(n) + 1) + "';";
  }));
}

/* ------------------------------------------------------------------ */

function main() {
  const parts = shell();
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /<small>([\d,]+)\+ free tools<\/small>/.exec(home);
  if (!m) throw new Error('could not read the tool total from index.html');
  const oldTotal = m[1];
  /* Only the pages that do not exist yet are new: a tool added to SHIPPING
     after the first one shipped must still move the counts, once. */
  const fresh = SHIPPING.filter(function (x) { return !fs.existsSync(path.join(ROOT, 'pdf', x[0], 'index.html')); }).length;
  const newTotal = fresh ? (Number(oldTotal.replace(/,/g, '')) + fresh).toLocaleString('en-GB') : oldTotal;

  const pm = /<span class="side-name">PDF Tools<\/span><span class="side-count">(\d+)<\/span>/.exec(home);
  if (!pm) throw new Error('could not read the PDF section count');
  const oldPdf = Number(pm[1]);
  const newPdf = oldPdf + fresh;

  const glyphs = patchIcons();
  let built = 0;
  for (const [slug, glyph] of SHIPPING) {
    if (write('pdf/' + slug + '/index.html', toolPage(slug, glyph, parts))) built++;
  }

  const indexed = updateSearchIndex();
  const nav = patchCounts(oldTotal, newTotal, oldPdf, newPdf);
  const hub = patchHub(oldPdf, newPdf);
  const mapped = patchSitemap();
  const sw = changes.length ? bumpServiceWorker() : false;

  console.log('\nbuild-pdf-ship.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  shipping            ' + SHIPPING.map(function (x) { return x[0]; }).join(', '));
  console.log('  pages built         ' + built + (glyphs ? ' (' + glyphs + ' glyph(s) added)' : ''));
  console.log('  search index        ' + (indexed ? indexed + ' added' : 'unchanged'));
  console.log('  site total          ' + oldTotal + ' → ' + newTotal);
  console.log('  pdf section         ' + oldPdf + ' → ' + newPdf);
  console.log('  counts patched      ' + nav.totals + ' total(s), ' + nav.counts + ' section count(s), ' + nav.skipped + ' skipped');
  console.log('  pdf hub             ' + (hub.changed ? (CHECK ? 'would be updated' : 'updated') : 'unchanged') +
              ', ' + hub.cards + ' cards');
  if (hub.changed) {
    const l = hub.list;
    console.log('      ItemList          ' + l.was + ' entr' + (l.was === 1 ? 'y' : 'ies') + ' at ' + l.wasPositions +
                ', numberOfItems ' + l.wasCount + '  →  ' + l.now + ' at ' + runs(Array.from({ length: l.now }, function (_, i) { return i + 1; })) +
                ', numberOfItems ' + l.now);
    if (hub.lede) console.log('      lede              ' + hub.lede + ' tools');
    if (hub.counts) console.log('      "N free PDF tools" ' + hub.counts + ' place(s) → ' + hub.cards);
    hub.urls.forEach(function (u) { console.log('      url               ' + u); });
    hub.hrefs.forEach(function (h) { console.log('      card href         ' + h); });
    if (hub.added.length) console.log('      listed now        ' + hub.added.join(', '));
    if (hub.dropped.length) console.log('      no longer listed  ' + hub.dropped.join(', '));
  }
  console.log('  sitemap             ' + (mapped ? mapped + ' added' : 'unchanged'));
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  if (VERBOSE) changes.forEach(function (c) { console.log('    ' + c); });
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

main();
