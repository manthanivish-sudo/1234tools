/**
 * Generate /education/ — the exam and student calculators.
 *
 *   node build-education.js          apply
 *   node build-education.js --check  report what would change, write nothing
 *
 * One page per tool plus a section hub, wrapped in the same shell as the rest
 * of the site and mounted through render-core.js like every other calculator.
 *
 * Unlike /learn/, these are tools: they go into the search index, they get
 * their own manifest from build-pwa.js, and they count towards the site total.
 * The distinction is whether the page does the work or points at someone who
 * does.
 *
 * Adding a section also means a sidebar entry on every page and a new total,
 * which is what patchSidebar below is for. That part is mechanical and
 * idempotent: it can be run twice without inserting the link twice.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const VERBOSE = process.argv.includes('--verbose');
const SITE = 'https://www.1234tools.com';

const SECTION = {
  slug: 'education',
  name: 'Education & Exams',
  icon: 'i-education',
  lede: 'Grades, attendance, percentiles and the days you have left. Every one runs in your browser.'
};

/* Order matters: it is the order on the hub, in the sidebar count and in the
   sitemap, and keeping it stable keeps regenerated diffs readable. */
const TOOLS = [
  ['cgpa-to-percentage',    'i-cgpa'],
  ['sgpa-to-cgpa',          'i-sgpa'],
  ['marks-percentage',      'i-marks'],
  ['attendance-calculator', 'i-attendance'],
  ['percentile-rank',       'i-percentile'],
  ['exam-countdown',        'i-exam-countdown']
];

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

/** Load a tool spec the same way the browser does. */
function spec(slug) {
  const w = { window: {} };
  new Function('window', fs.readFileSync(path.join(ROOT, 'engine/calc-' + slug + '.js'), 'utf8'))(w.window);
  const t = w.window.TOOLS[slug];
  if (!t) throw new Error('engine/calc-' + slug + '.js did not define TOOLS["' + slug + '"]');
  return t;
}

/* ------------------------------------------------------------------ */
/* the shell                                                          */
/* ------------------------------------------------------------------ */

function shell() {
  const src = fs.readFileSync(path.join(ROOT, 'utilities/index.html'), 'utf8');
  const headEnd = src.indexOf('</head>');
  const mainOpen = '<main id="main" class="content">';
  const mainStart = src.indexOf(mainOpen);
  const mainEnd = src.indexOf('</main>');
  if (headEnd < 0 || mainStart < 0 || mainEnd < 0) throw new Error('could not read the shell');
  return {
    head: src.slice(0, headEnd),
    mid: src.slice(headEnd, mainStart + mainOpen.length),
    tail: src.slice(mainEnd)
  };
}

function head(parts, title, description, canonical, extraScripts) {
  let h = parts.head
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + canonical + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(title) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + canonical + '">')
    .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(title) + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(description) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '');
  /* A tool page needs the renderer; the hub does not. Inserted before the
     stylesheet so it matches where every other page carries it. */
  if (extraScripts) {
    h = h.replace('<link rel="stylesheet" href="/assets/app.css">',
      '<link rel="stylesheet" href="/assets/app.css">\n' + extraScripts);
  }
  return h;
}

/** The section's own sidebar entry is the active one on these pages. */
function markActive(html) {
  return html
    .replace(/ class="side-link is-active"/g, ' class="side-link"')
    .replace(new RegExp('<a class="side-link" href="/' + SECTION.slug + '/">'),
      '<a class="side-link is-active" href="/' + SECTION.slug + '/">');
}

const jsonLd = (o) => '<script type="application/ld+json">' + JSON.stringify(o) + '</script>\n';
const icon = (id) => '<svg class="ico" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + id + '"></use></svg>';

/* ------------------------------------------------------------------ */
/* pages                                                              */
/* ------------------------------------------------------------------ */

function toolPage(slug, glyph, parts) {
  const t = spec(slug);
  const url = SITE + '/' + SECTION.slug + '/' + slug + '/';
  const title = t.title + ' — Free Online | 1234Tools';

  const related = TOOLS.filter(function (x) { return x[0] !== slug; })
    .map(function (x) {
      return '<li><a href="/' + SECTION.slug + '/' + x[0] + '/">' + esc(spec(x[0]).title) + '</a></li>';
    }).join('');

  const body =
    '<nav class="crumbs"><a href="/">Home</a> › <a href="/' + SECTION.slug + '/">' + esc(SECTION.name) + '</a> › <span>' + esc(t.title) + '</span></nav>\n' +
    '<article class="tool" data-tool="' + slug + '">\n' +
    '  <h1>' + '<svg class="ico ico-title" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + glyph + '"></use></svg>' + esc(t.title) + '</h1>\n' +
    '  <p class="lede">' + esc(t.description) + '</p>\n' +
    '  <div class="calc">\n' +
    '    <form class="tool-form" autocomplete="off" onsubmit="return false"></form>\n' +
    '    <div class="tool-results" aria-live="polite"></div>\n' +
    '  </div>\n' +
    '  <div class="tool-table" hidden></div>\n' +
    (t.formula ? '  <section class="panel"><h2>Formula</h2><pre class="formula">' + esc(t.formula) + '</pre></section>\n' : '') +
    '  <section class="panel"><h2>Privacy</h2><p class="privacy-line">Every figure you type stays in this page. Nothing is uploaded, stored or logged — your marks and attendance are nobody else’s business.</p></section>\n' +
    '  <section class="panel"><h2>Tips</h2><ul class="tips">' +
      t.tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>\n' +
    '  <section class="panel"><h2>Frequently asked questions</h2>' +
      t.faq.map(function (f) { return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>'; }).join('') +
      '</section>\n' +
    '  <section class="panel"><h2>Related tools</h2><ul class="related">' + related +
      '<li><a href="/utilities/gpa-calculator/">GPA Calculator</a></li>' +
      '<li><a href="/mathematics/percentage/">Percentage Calculator</a></li>' +
      '</ul></section>\n' +
    '</article>\n' +
    '<script src="/engine/calc-' + slug + '.js" defer></script>\n' +
    '<script>\n' +
    'document.addEventListener(\'DOMContentLoaded\',function(){\n' +
    '  MVRTool.mount(window.TOOLS[\'' + slug + '\'], document.querySelector(\'.tool\'));\n' +
    '});\n' +
    '</script>\n';

  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication', name: t.title, description: t.description, url: url,
        applicationCategory: 'EducationalApplication', operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: SECTION.name, item: SITE + '/' + SECTION.slug + '/' },
          { '@type': 'ListItem', position: 3, name: t.title, item: url }
        ]
      },
      {
        '@type': 'FAQPage',
        mainEntity: t.faq.map(function (f) {
          return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } };
        })
      }
    ]
  });

  const scripts = '<script src="/engine/render-core.js" defer></script>';
  return markActive(head(parts, title, t.description, url, scripts) + ld + parts.mid + '\n' + body + parts.tail);
}

function hubPage(parts) {
  const url = SITE + '/' + SECTION.slug + '/';
  const title = SECTION.name + ' — ' + TOOLS.length + ' Free Calculators | 1234Tools';
  const description = TOOLS.length + ' free calculators for students and exam candidates: CGPA to percentage, SGPA to CGPA, marks and grades, attendance, percentile and rank, and an exam countdown. Nothing is uploaded.';

  const cards = TOOLS.map(function (x) {
    const t = spec(x[0]);
    return '<a class="card" href="/' + SECTION.slug + '/' + x[0] + '/">' +
      '<span class="card-icon">' + icon(x[1]) + '</span>' +
      '<strong>' + esc(t.title) + '</strong>' +
      '<span class="card-desc">' + esc(t.description) + '</span></a>';
  }).join('');

  const body =
    '<nav class="crumbs"><a href="/">Home</a> › <span>' + esc(SECTION.name) + '</span></nav>\n' +
    '<p class="eyebrow">' + esc(SECTION.name) + '</p>\n' +
    '<h1><svg class="ico ico-title" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + SECTION.icon + '"></use></svg>' + esc(SECTION.name) + '</h1>\n' +
    '<p class="lede">' + TOOLS.length + ' free tools. ' + esc(SECTION.lede) + '</p>\n' +
    '<div class="grid">' + cards + '</div>\n' +
    '<section class="panel"><h2>A note on grading rules</h2>' +
      '<p>Boards and universities do not agree with each other about any of this. The same CGPA converts to a different ' +
      'percentage at two universities in the same city, attendance is counted per subject at one institution and overall ' +
      'at the next, and grade bands move between boards.</p>' +
      '<p>So these tools let you choose the rule rather than assuming one, and each says which rule it used. Where your ' +
      'institution publishes its own formula, that one wins — and where it publishes a conversion table rather than a ' +
      'formula, no calculator can reproduce it and you should use the table.</p>' +
    '</section>\n' +
    '<section class="panel"><h2>Learning material</h2>' +
      '<p>For courses, practice sets and mock interviews rather than arithmetic, the ' +
      '<a href="/learn/">learning directory</a> collects 103 of them — including ' +
      '<a href="/learn/practice/">practice and mock interviews</a> and ' +
      '<a href="/learn/certifications/">certifications</a>.</p>' +
    '</section>\n';

  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', name: SECTION.name, description: description, url: url,
        mainEntity: {
          '@type': 'ItemList', numberOfItems: TOOLS.length,
          itemListElement: TOOLS.map(function (x, i) {
            return { '@type': 'ListItem', position: i + 1, name: spec(x[0]).title, url: SITE + '/' + SECTION.slug + '/' + x[0] + '/' };
          })
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: SECTION.name, item: url }
        ]
      }
    ]
  });

  return markActive(head(parts, title, description, url, null) + ld + parts.mid + '\n' + body + parts.tail);
}

/* ------------------------------------------------------------------ */
/* wiring the section into the site                                   */
/* ------------------------------------------------------------------ */

function updateSearchIndex() {
  const rel = 'assets/search-index.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const entries = TOOLS
    .filter(function (x) { return src.indexOf('"' + SECTION.slug + '/' + x[0] + '/"') < 0; })
    .map(function (x) {
      return '["' + spec(x[0]).title.replace(/"/g, '\\"') + '","' + SECTION.slug + '/' + x[0] + '/","' + x[0] + '"]';
    });
  if (!entries.length) return 0;
  /* Appended, because the index is also the sitemap's order and the tool
     order on the homepage; inserting in the middle would reshuffle both. */
  const out = src.replace(/\];\s*$/, ',' + entries.join(',') + '];\n');
  write(rel, out);
  return entries.length;
}

/** Every page in the tree, so the sidebar and the totals reach all of them. */
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

const isRedirect = (html) =>
  /name="robots" content="noindex,follow"/.test(html) && /http-equiv="refresh"/.test(html);

/**
 * Pages that exist but have never shipped.
 *
 * The working tree can carry a half-finished section. Editing those would be
 * rewriting somebody's draft underneath them, and they will pick the new
 * sidebar entry up from the shell when they land.
 */
function unpublished() {
  const out = new Set();
  try {
    const listed = require('child_process')
      .execFileSync('git', ['ls-files', '--others', '--exclude-standard'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    listed.split(String.fromCharCode(10)).forEach(function (f) {
      var t = f.trim();
      if (t.endsWith('.html')) out.add(t);
    });
  } catch (e) { /* no git here: assume everything has shipped */ }
  return out;
}
const DRAFTS = unpublished();

/**
 * Put the section in the sidebar of every page, and move the totals.
 *
 * Inserted after Design & Media, which is the last of the tool categories, so
 * the list stays in descending size order with the newcomer at the end.
 * Skipped on redirect stubs, which carry no shell at all.
 */
function patchSidebar(oldTotal, newTotal) {
  /* The section's own pages get the entry already marked current. Generation
     happens before this patch, so those pages cannot mark it themselves —
     the link does not exist in the shell they were built from yet. */
  const linkFor = (active) =>
    '\n      <a class="side-link' + (active ? ' is-active' : '') + '" href="/' + SECTION.slug + '/">\n' +
    '        ' + icon(SECTION.icon) + '<span class="side-name">' + esc(SECTION.name) + '</span>' +
    '<span class="side-count">' + TOOLS.length + '</span>\n' +
    '      </a>';
  const anchor = /\n(\s*)<a class="side-link[^"]*" href="\/design\/">[\s\S]*?<\/a>/;

  let sidebars = 0, totals = 0, skipped = 0;
  for (const abs of pages()) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (DRAFTS.has(rel)) { skipped++; continue; }
    const before = fs.readFileSync(abs, 'utf8');
    if (isRedirect(before)) { skipped++; continue; }
    let html = before;

    /* Matched on the sidebar link specifically. A plain href test also finds
       the breadcrumb on the section's own pages, which made this skip exactly
       the pages that most needed the entry. */
    const hasEntry = new RegExp('class="side-link[^"]*" href="/' + SECTION.slug + '/"').test(html);
    if (!hasEntry) {
      const m = anchor.exec(html);
      if (m) {
        const own = rel === SECTION.slug + '/index.html' ||
          rel.indexOf(SECTION.slug + '/') === 0;
        html = html.replace(anchor, m[0] + linkFor(own));
        sidebars++;
      }
    }
    if (html.indexOf(oldTotal) >= 0) { html = html.split(oldTotal).join(newTotal); totals++; }

    if (html !== before) {
      changes.push('update ' + rel);
      if (!CHECK) fs.writeFileSync(abs, html);
    }
  }
  return { sidebars, totals, skipped };
}

/** One card on the homepage's category grid, after the last existing one. */
function patchHomeCard() {
  const rel = 'index.html';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (src.indexOf('card card-lg" href="/' + SECTION.slug + '/"') >= 0) return false;
  const anchor = /<a class="card card-lg" href="\/design\/">[\s\S]*?<\/a>/;
  const m = anchor.exec(src);
  if (!m) return false;
  const card = '<a class="card card-lg" href="/' + SECTION.slug + '/"><span class="card-icon">' +
    icon(SECTION.icon) + '</span><strong>' + esc(SECTION.name) + '</strong>' +
    '<span class="card-desc">' + TOOLS.length + ' tools</span></a>';
  return write(rel, src.slice(0, m.index + m[0].length) + card + src.slice(m.index + m[0].length));
}

function patchSitemap() {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const urls = ['/' + SECTION.slug + '/']
    .concat(TOOLS.map(function (x) { return '/' + SECTION.slug + '/' + x[0] + '/'; }));
  const entries = urls
    .filter(function (u) { return src.indexOf('<loc>' + SITE + u + '</loc>') < 0; })
    .map(function (u) {
      return '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>';
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

  /* The totals live in the page text, so they are read from it rather than
     hardcoded twice. */
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /<small>([\d,]+)\+ free tools<\/small>/.exec(home);
  if (!m) throw new Error('could not read the current tool total from index.html');
  const oldTotal = m[1];
  const newTotal = (Number(oldTotal.replace(/,/g, '')) + TOOLS.length).toLocaleString('en-GB');
  const already = fs.existsSync(path.join(ROOT, SECTION.slug, TOOLS[0][0], 'index.html'));

  let built = 0;
  if (write(SECTION.slug + '/index.html', hubPage(parts))) built++;
  for (const [slug, glyph] of TOOLS) {
    if (write(SECTION.slug + '/' + slug + '/index.html', toolPage(slug, glyph, parts))) built++;
  }

  const indexed = updateSearchIndex();
  const nav = patchSidebar(already ? newTotal : oldTotal, newTotal);
  const card = patchHomeCard();
  const mapped = patchSitemap();
  const sw = changes.length ? bumpServiceWorker() : false;

  console.log('\nbuild-education.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  tools               ' + TOOLS.length);
  console.log('  pages built         ' + built);
  console.log('  search index        ' + (indexed ? indexed + ' added' : 'unchanged'));
  console.log('  site total          ' + oldTotal + ' → ' + newTotal);
  console.log('  sidebar             ' + nav.sidebars + ' page(s), ' + nav.totals + ' total(s), ' + nav.skipped + ' stub(s) skipped');
  console.log('  homepage card       ' + (card ? 'added' : 'unchanged'));
  console.log('  sitemap             ' + (mapped ? mapped + ' added' : 'unchanged'));
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  if (VERBOSE) changes.forEach(function (c) { console.log('    ' + c); });
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

main();
