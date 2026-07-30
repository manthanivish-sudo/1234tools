#!/usr/bin/env node
/**
 * Generator for the PDF tools section.
 *
 *   node build-pdf.js          build
 *   node build-pdf.js --check  report what would change, write nothing
 *
 * Emits pdf/<id>.html for each of the 16 tools plus pdf/index.html, installs
 * the engine files and per-tool bundles into engine/, merges the icon symbols
 * into assets/icons.svg, appends the PDF rules to assets/app.css, and adds the
 * new pages to the search index and the sitemap.
 *
 * Every step is idempotent — running twice produces the same tree — because
 * this has to be safe to re-run after editing a tool spec.
 *
 * The page shell (header, sidebar, footer) is lifted from an existing hand-made
 * page rather than re-typed, so the 17 new pages cannot drift from the other
 * 1,169. TEMPLATE_PAGE below is the single source of that markup.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PKG = path.join(ROOT, 'build', 'pdf-package');
const CHECK = process.argv.includes('--check');

const SITE = 'https://www.1234tools.com';
const BRAND = '1234Tools';
const CATEGORY = { slug: 'pdf', name: 'PDF Tools', icon: 'i-pdf' };

/* the page whose shell we copy; any tool page one directory deep will do */
const TEMPLATE_PAGE = path.join(ROOT, 'image', 'image-compressor.html');

const { PDF_TOOLS } = require(path.join(PKG, 'engine', 'pdftools.js'));

/* ------------------------------------------------------------------ */
/* reporting                                                          */
/* ------------------------------------------------------------------ */

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
function copy(from, rel) {
  return write(rel, fs.readFileSync(from, 'utf8'));
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** First candidate that fits a search result, else the shortest. */
function fitTitle(candidates, limit) {
  const max = limit || 60;
  for (const c of candidates) if (c.length <= max) return c;
  return candidates[candidates.length - 1];
}

const icon = (id, base, cls) =>
  `<svg class="ico${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false">` +
  `<use href="${base}assets/icons.svg#i-${id}"></use></svg>`;

/** Tips and FAQ panels, matching the existing tool pages exactly. */
function contentBlocks(spec) {
  let out = '';
  if (spec.tips && spec.tips.length) {
    out += '<section class="panel"><h2>Tips</h2><ul class="tips">' +
      spec.tips.map(t => `<li>${esc(t)}</li>`).join('') + '</ul></section>';
  }
  if (spec.faq && spec.faq.length) {
    out += '<section class="panel"><h2>Frequently asked questions</h2>' +
      spec.faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('') +
      '</section>';
  }
  return out;
}

function relatedList(related) {
  if (!related.length) return '';
  return '<section class="panel"><h2>Related tools</h2><ul class="related">' +
    related.map(r => `<li><a href="${r.url}">${esc(r.title)}</a></li>`).join('') +
    '</ul></section>';
}

/* ------------------------------------------------------------------ */
/* the shell, lifted from a real page                                 */
/* ------------------------------------------------------------------ */

function loadShell() {
  if (!fs.existsSync(TEMPLATE_PAGE)) {
    throw new Error(`Template page missing: ${TEMPLATE_PAGE}`);
  }
  const src = fs.readFileSync(TEMPLATE_PAGE, 'utf8');

  const bodyStart = src.indexOf('<body>');
  const mainOpen = src.indexOf('<main id="main" class="content">');
  const mainClose = src.indexOf('</main>');
  if (bodyStart < 0 || mainOpen < 0 || mainClose < 0) {
    throw new Error('Could not locate <body>/<main> in the template page.');
  }

  /* everything from <body> up to and including the <main> opening tag */
  let head = src.slice(bodyStart + '<body>'.length, mainOpen + '<main id="main" class="content">'.length);
  /* everything from </main> to the end of the document */
  let tail = src.slice(mainClose);

  /* the template's own category must not stay highlighted */
  head = head.replace(/ class="side-link is-active"/g, ' class="side-link"');

  return { head, tail };
}

/**
 * Insert the PDF category into a sidebar. Placed after "image" and before
 * "india", which is where its 16 tools fall in the existing count ordering.
 * Only the header fragment has a sidebar; the footer fragment does not.
 */
function insertSidebarLink(html) {
  if (html.includes(`../${CATEGORY.slug}/index.html`)) return html;

  const anchor = /\n(\s*)<a class="side-link[^"]*" href="\.\.\/india\/index\.html">[\s\S]*?<\/a>/;
  const m = anchor.exec(html);
  if (!m) throw new Error('Could not find the sidebar insertion point (the india category link).');

  const pad = m[1];
  const link =
    `\n${pad}<a class="side-link" href="../${CATEGORY.slug}/index.html">\n` +
    `${pad}  ${icon('pdf', '../')}<span class="side-name">${CATEGORY.name}</span>` +
    `<span class="side-count">${Object.keys(PDF_TOOLS).length}</span>\n` +
    `${pad}</a>\n`;
  return html.replace(anchor, link.replace(/\n$/, '') + m[0]);
}

/**
 * Refresh the running tool total.
 *
 * It appears in a dozen phrasings — the brand strapline, the search
 * placeholder, the "All N tools" button, the sidebar row, the footer blurb,
 * and on the homepage also the <title>, the meta and OG descriptions, the h1
 * and a stat tile. Enumerating those patterns missed several, so this replaces
 * the number itself. Verified safe: "1,169" occurs nowhere in the site as data,
 * only ever as this total, which also makes the result checkable — no
 * occurrence of the old figure may survive.
 */
const OLD_TOTAL = '1,169';

function updateTotals(html, total) {
  return html.split(OLD_TOTAL).join(total.toLocaleString('en-GB'));
}

function shell({ title, description, canonical, jsonld, extraHead, body, shellParts, total }) {
  const head = updateTotals(insertSidebarLink(shellParts.head), total)
    .replace(new RegExp(`(<a class="side-link)(" href="\\.\\./${CATEGORY.slug}/index\\.html")`),
             '$1 is-active$2');
  const tail = updateTotals(shellParts.tail, total);

  return `<!DOCTYPE html>
<html lang="en-GB" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#06080f" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/assets/img/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<link rel="icon" href="../assets/favicon.ico" sizes="any">
<link rel="icon" href="../assets/img/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="../assets/app.css">
${extraHead ? extraHead + '\n' : ''}<script>/* set theme before first paint so there is no flash */
(function(){try{var t=localStorage.getItem('1234tools-theme');document.documentElement.setAttribute('data-theme',t==='light'||t==='system'?t:'dark');}catch(e){}})();</script>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>${head}
${body}
  ${tail}`;
}

/* ------------------------------------------------------------------ */
/* pages                                                              */
/* ------------------------------------------------------------------ */

function buildPdfToolPage(id, spec, shellParts, total) {
  const url = `${CATEGORY.slug}/${id}.html`;
  const canonical = `${SITE}/${url}`;
  const title = fitTitle([
    `${spec.title} — Free & Private | ${BRAND}`,
    `${spec.title} | ${BRAND}`,
    spec.title
  ]);

  /* related: the rest of the section, nearest kind first so the suggestions
     are actually adjacent tasks rather than an arbitrary slice */
  const related = Object.entries(PDF_TOOLS)
    .filter(([k]) => k !== id)
    .sort((a, b) => (a[1].kind === spec.kind ? -1 : 1) - (b[1].kind === spec.kind ? -1 : 1))
    .slice(0, 8)
    .map(([k, s2]) => ({ title: s2.title, url: `${k}.html` }));

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'SoftwareApplication', name: spec.title, description: spec.description,
        url: canonical, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: CATEGORY.name, item: `${SITE}/${CATEGORY.slug}/index.html` },
        { '@type': 'ListItem', position: 3, name: spec.title, item: canonical }
      ]},
      ...(spec.faq && spec.faq.length ? [{ '@type': 'FAQPage', mainEntity: spec.faq.map(f => ({
        '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [])
    ]
  };

  const privacy = 'Your files never leave your device. PDFs are parsed and rewritten by ' +
    'your own browser, so nothing is uploaded, queued or logged.' +
    (spec.needsRenderer
      ? ' This tool downloads a rendering engine on first use; your file still never leaves the device.'
      : '');

  const body = `<nav class="crumbs"><a href="../index.html">Home</a> › <a href="index.html">${esc(CATEGORY.name)}</a> › <span>${esc(spec.title)}</span></nav>
<article class="tool" data-tool="${id}">
  <p class="eyebrow">${esc(CATEGORY.name)}</p>
  <h1>${icon(id, '../', 'ico-title')}${esc(spec.title)}</h1>
  <p class="lede">${esc(spec.description)}</p>
  <div class="tool-io"></div>
  <section class="panel"><h2>Privacy</h2><p class="privacy-line">${esc(privacy)}</p></section>
  ${contentBlocks(spec)}
  ${relatedList(related)}
</article>
<script>
document.addEventListener('DOMContentLoaded',function(){
  var spec = window.PDF_TOOLS['${id}'];
  spec.id = '${id}';
  var root = document.querySelector('.tool');
  try { MVRTool.mountPDF(spec, root); }
  catch (e) {
    root.querySelector('.tool-io').innerHTML =
      '<div class="io-msg is-error">This tool needs browser features yours does not support. Try a current version of Chrome, Firefox, Edge or Safari.</div>';
  }
});
</script>`;

  const extraHead = [
    '<script src="../engine/pdfcore.bundle.js" defer></script>',
    '<script src="../engine/zip.js" defer></script>',
    '<script src="../engine/render-pdf.js" defer></script>',
    `<script src="../engine/pdf-${id}.js" defer></script>`
  ].join('\n');

  write(url, shell({ title, description: spec.description, canonical, jsonld,
                     extraHead, body, shellParts, total }));

  return { id, title: spec.title, description: spec.description,
           category: CATEGORY.slug, keywords: spec.keywords || [], url };
}

function buildPdfIndexPage(index, shellParts, total) {
  const url = `${CATEGORY.slug}/index.html`;
  const canonical = `${SITE}/${url}`;
  const n = index.length;
  const title = fitTitle([
    `${n} Free PDF Tools — Merge, Split, Compress & Convert | ${BRAND}`,
    `Free PDF Tools — Merge, Split, Rotate & Convert | ${BRAND}`,
    `Free PDF Tools | ${BRAND}`
  ]);
  const description = `${n} free PDF tools that run entirely in your browser — merge, ` +
    'split, rotate, watermark, number, inspect and create PDFs. No upload, no sign-up.';

  const GROUPS = [
    { kind: 'transform', heading: 'Work with an existing PDF',
      blurb: 'These read a PDF you already have and write a new one. No dependencies, nothing to download.' },
    { kind: 'create', heading: 'Create a PDF from scratch',
      blurb: 'Generate a finished document from text or a few fields, using only the standard PDF fonts.' },
    { kind: 'inspect', heading: 'Look inside a PDF',
      blurb: 'Report on structure, page geometry, fonts and metadata without changing anything.' },
    { kind: 'render', heading: 'Needs a rendering engine',
      blurb: 'Turning pages into pictures means interpreting fonts and vector paths, so these two download a renderer on first use — once, cached afterwards.' }
  ];

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: CATEGORY.name, description, url: canonical },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: CATEGORY.name, item: canonical }
      ]},
      { '@type': 'ItemList', name: CATEGORY.name, numberOfItems: n,
        itemListElement: index.map((t, i) => ({
          '@type': 'ListItem', position: i + 1, name: t.title,
          url: `${SITE}/${t.url}` })) }
    ]
  };

  let sections = '';
  for (const g of GROUPS) {
    const items = index.filter(t => PDF_TOOLS[t.id].kind === g.kind);
    if (!items.length) continue;
    sections += `<h2>${esc(g.heading)}</h2>\n<p class="lede">${esc(g.blurb)}</p>\n<div class="grid">` +
      items.map(t =>
        `<a class="card" href="../${t.url}"><span class="card-icon">${icon(t.id, '../')}</span>` +
        `<strong>${esc(t.title)}</strong>` +
        `<span class="card-desc">${esc(t.description)}</span></a>`).join('') +
      '</div>\n';
  }

  const body = `<nav class="crumbs"><a href="../index.html">Home</a> › <span>${esc(CATEGORY.name)}</span></nav>
<p class="eyebrow">${esc(CATEGORY.name)}</p>
<h1>${icon('pdf', '../', 'ico-title')}Free PDF tools</h1>
<p class="lede">${n} tools for merging, splitting, rotating, watermarking, numbering, inspecting and creating PDFs — all running inside your browser.</p>
<section class="panel"><h2>Why these run in your browser</h2><p class="privacy-line">A PDF is often the most sensitive file someone owns: a contract, a payslip, a medical letter, a passport scan. Every tool here parses and rewrites the file on your own device, so nothing is uploaded, queued on a server or logged. That is also why they keep working with the network off — and why there is no file size limit beyond your own memory.</p></section>
${sections}<section class="panel"><h2>What these tools deliberately will not do</h2><ul class="tips"><li><strong>Encrypted PDFs are refused</strong> rather than half-parsed. If a file needs a password, remove it in the application that created it first.</li><li><strong>Bookmarks, form fields and annotations are not carried through a merge.</strong> Rebuilding the page tree from scratch is what makes the output reliably valid; reconciling outline trees from several documents is where most mergers produce broken files.</li><li><strong>There is no text editing, and there cannot be.</strong> PDF text is positioned glyphs in subset fonts with no concept of reflow. Anything advertising "edit PDF text" either runs OCR or renders the page and overlays a box. The watermark and page-number tools do the honest version of that: they append a content layer.</li><li><strong>Only the standard PDF fonts are used when creating documents</strong> — Helvetica, Times and Courier — so nothing is embedded and output stays small. Scripts outside Western European ranges cannot be represented without embedding a font, and the tools say so.</li></ul></section>
<section class="panel"><h2>Frequently asked questions</h2><details><summary>Are my PDFs uploaded anywhere?</summary><p>No. The file is read, parsed and rewritten by your own browser. Nothing is transmitted, which is why these tools work offline once the page has loaded and why they are safe for contracts and financial documents.</p></details><details><summary>Is there a file size limit?</summary><p>No fixed limit. Because the work happens on your device, the practical ceiling is your available memory rather than an upload cap. Very large documents are slower but they are not rejected.</p></details><details><summary>Does merging or splitting reduce quality?</summary><p>No. Page content streams and embedded images are copied byte for byte — nothing is re-encoded or recompressed, so a merged or split page is bit-identical to the original.</p></details><details><summary>Why do two of these need a download?</summary><p>Merging, splitting and rotating only rearrange the file's structure, which needs no rendering. Turning a page into an image means interpreting fonts, vector paths and colour spaces — that is a full rendering engine, and it cannot be written small. Only the two tools that need it fetch it, and only on first use.</p></details></section>`;

  write(url, shell({ title, description, canonical, jsonld, extraHead: '',
                     body, shellParts, total }));
}

/* ------------------------------------------------------------------ */
/* engine bundles (INTEGRATION.md step 5)                             */
/* ------------------------------------------------------------------ */

function buildBundles() {
  /* Only render-pdf.js ships as-is. pdfcore.js and pdftools.js stay in the
     package: they are build-time sources, and nothing on the site loads them —
     pages load pdfcore.bundle.js and one pdf-<id>.js each. Copying the raw
     files into engine/ would deploy ~108 KB that no page ever requests. */
  copy(path.join(PKG, 'engine', 'render-pdf.js'), 'engine/render-pdf.js');

  const pdfCoreSrc = fs.readFileSync(path.join(PKG, 'engine', 'pdfcore.js'), 'utf8')
    .replace(/if \(typeof module[\s\S]*$/, '');
  write('engine/pdfcore.bundle.js',
    '(function(){\n' + pdfCoreSrc +
    '\nwindow.MVRPdfCore={PDFDocument:PDFDocument,assemble:assemble,' +
    'parsePageRange:parsePageRange,createPDF:createPDF,textWidth:textWidth,' +
    'wrapText:wrapText,contentEscape:contentEscape,PAGE_SIZES:PAGE_SIZES,' +
    'FONTS:FONTS,latin1:latin1,isDict:isDict,isName:isName};\n})();');

  const pdfRaw = fs.readFileSync(path.join(PKG, 'engine', 'pdftools.js'), 'utf8');
  const from = pdfRaw.indexOf('/* ---------- shared helpers');
  const to = pdfRaw.indexOf('if (typeof module');
  if (from < 0 || to < 0) throw new Error('Could not slice the shared helpers out of pdftools.js.');
  const HELPERS = pdfRaw.slice(from, to);

  for (const [id, spec] of Object.entries(PDF_TOOLS)) {
    const parts = [];
    for (const [k, v] of Object.entries(spec)) {
      parts.push(typeof v === 'function'
        ? `${JSON.stringify(k)}: ${v.toString()}`
        : `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    }
    write(`engine/pdf-${id}.js`,
      '(function(){\n' + HELPERS + '\nwindow.PDF_TOOLS = window.PDF_TOOLS || {};\n' +
      `window.PDF_TOOLS[${JSON.stringify(id)}] = {\n${parts.join(',\n')}\n};\n})();`);
  }
}

/**
 * pdf.js is vendored, not generated, so it is checked rather than written.
 * It lives only at its deployed path — keeping a second copy in the package
 * would put 3.8 MB in the repository twice for no gain.
 */
const PDFJS_DIR = 'engine/vendor/pdfjs';
const PDFJS_VERSION = '4.6.82';
function checkVendoredPdfJs() {
  const need = ['pdf.min.mjs', 'pdf.worker.min.mjs', 'cmaps', 'standard_fonts'];
  const missing = need.filter(f => !fs.existsSync(path.join(ROOT, PDFJS_DIR, f)));
  if (!missing.length) return `pdfjs-dist ${PDFJS_VERSION}, present`;
  console.log(`  ! ${PDFJS_DIR} is missing: ${missing.join(', ')}`);
  console.log('    The two rendering tools will not work. Restore it with:');
  console.log(`      curl -sL https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${PDFJS_VERSION}.tgz | tar -xz`);
  console.log(`      mkdir -p ${PDFJS_DIR}`);
  console.log(`      cp package/build/pdf.min.mjs package/build/pdf.worker.min.mjs package/LICENSE ${PDFJS_DIR}/`);
  console.log(`      cp -r package/cmaps package/standard_fonts ${PDFJS_DIR}/`);
  return `MISSING (${missing.length} of ${need.length})`;
}

/* ------------------------------------------------------------------ */
/* shared assets (steps 2 and 3)                                      */
/* ------------------------------------------------------------------ */

const ICON_START = '<!-- PDF TOOL ICONS: generated by build-pdf.js, do not edit -->';
const ICON_END = '<!-- /PDF TOOL ICONS -->';
const CSS_MARK = '/* === PDF tools (build-pdf.js) === */';

function mergeIcons() {
  const target = path.join(ROOT, 'assets', 'icons.svg');
  let svg = fs.readFileSync(target, 'utf8');
  let src = fs.readFileSync(path.join(PKG, 'assets', 'pdf-icons.svg'), 'utf8');

  /* Drop comments before extracting. The source file's own header contains the
     words "<symbol> blocks" and a literal </svg>, and a naive scan for
     <symbol>…</symbol> starts matching inside that prose. */
  src = src.replace(/<!--[\s\S]*?-->/g, '');

  const symbols = src.match(/<symbol\b[\s\S]*?<\/symbol>/g) || [];
  if (!symbols.length) throw new Error('No <symbol> blocks found in pdf-icons.svg.');
  for (const s of symbols) {
    if (!/^<symbol\b[^>]*\bid="i-[a-z0-9-]+"/.test(s)) {
      throw new Error('A symbol block has no usable id: ' + s.slice(0, 60));
    }
    if (s.includes('</svg>')) throw new Error('A symbol block contains </svg>; extraction is wrong.');
  }

  /* replace our own previous block, delimited explicitly, so re-runs pick up
     edits to the source instead of appending a second copy */
  const from = svg.indexOf(ICON_START);
  if (from >= 0) {
    const to = svg.indexOf(ICON_END, from);
    if (to < 0) throw new Error('assets/icons.svg has a start marker but no end marker.');
    /* consume the newline the block ends with too, or the file gains one
       character on every run and never settles */
    let after = to + ICON_END.length;
    while (after < svg.length && (svg[after] === '\n' || svg[after] === '\r')) after++;
    svg = svg.slice(0, from) + svg.slice(after);
  }

  const close = svg.lastIndexOf('</svg>');
  if (close < 0) throw new Error('assets/icons.svg has no closing </svg>.');

  const block = ICON_START + '\n' + symbols.join('\n') + '\n' + ICON_END + '\n';
  svg = svg.slice(0, close) + block + svg.slice(close);

  /* an id clash would make one icon silently mask another */
  const ids = [...svg.matchAll(/<symbol\b[^>]*id="([^"]+)"/g)].map(m => m[1]);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length) throw new Error('Duplicate icon ids after merge: ' + [...new Set(dupes)].join(', '));

  /* every tool needs its own icon, plus the category icon */
  const missing = [...Object.keys(PDF_TOOLS), 'pdf'].filter(id => !ids.includes('i-' + id));
  if (missing.length) throw new Error('No icon symbol for: ' + missing.join(', '));

  write('assets/icons.svg', svg);
  return symbols.length;
}

function appendCss() {
  const target = path.join(ROOT, 'assets', 'app.css');
  let css = fs.readFileSync(target, 'utf8');
  const add = fs.readFileSync(path.join(PKG, 'assets', 'pdf-styles.css'), 'utf8').trim();

  const block = `\n\n${CSS_MARK}\n${add}\n`;
  if (css.includes(CSS_MARK)) {
    css = css.slice(0, css.indexOf(CSS_MARK)).replace(/\s+$/, '') + block;
  } else {
    css = css.replace(/\s+$/, '') + block;
  }
  write('assets/app.css', css);
}

/* ------------------------------------------------------------------ */
/* search index and sitemap                                           */
/* ------------------------------------------------------------------ */

function updateSearchIndex(index) {
  const rel = 'assets/search-index.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const m = /^window\.SEARCH_INDEX=(\[[\s\S]*\]);?\s*$/.exec(src.trim());
  if (!m) throw new Error('Unrecognised format in assets/search-index.js.');

  const entries = JSON.parse(m[1]).filter(e => !String(e[1]).startsWith(CATEGORY.slug + '/'));
  for (const t of index) entries.push([t.title, t.url, t.id]);

  write(rel, 'window.SEARCH_INDEX=' + JSON.stringify(entries) + ';\n');
  return entries.length;
}

function updateSitemap(index) {
  const rel = 'sitemap-1.xml';
  const xml = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const urls = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)].map(x => x[0])
    .filter(u => !u.includes(`${SITE}/${CATEGORY.slug}/`));

  const today = new Date().toISOString().slice(0, 10);
  const add = [`${CATEGORY.slug}/index.html`, ...index.map(t => t.url)].map(u =>
    `<url><loc>${SITE}/${u}</loc><lastmod>${today}</lastmod>` +
    `<changefreq>monthly</changefreq><priority>${u.endsWith('index.html') ? '0.8' : '0.7'}</priority></url>`);

  write(rel,
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.concat(add).join('\n') + '\n</urlset>\n');
  return urls.length + add.length;
}

/**
 * Bump the cache version so returning visitors do not keep a stale shell.
 * Only when something else actually changed — otherwise a no-op re-run would
 * invalidate every visitor's cache for nothing, and the build would never be
 * idempotent.
 */
function bumpServiceWorker(somethingChanged) {
  if (!somethingChanged) return 'unchanged (nothing else changed)';
  const rel = 'sw.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const m = /(\bV\s*=\s*['"])([^'"]+)(['"])/.exec(src);
  if (!m) { console.log('  ! could not find the version string in sw.js — bump it by hand'); return null; }
  const next = /^(.*?)(\d+)$/.exec(m[2]);
  const bumped = next ? next[1] + (Number(next[2]) + 1) : m[2] + '-pdf';
  write(rel, src.replace(m[0], m[1] + bumped + m[3]));
  return `${m[2]} → ${bumped}`;
}

/* ------------------------------------------------------------------ */
/* nav patch across the existing pages                                */
/* ------------------------------------------------------------------ */

/**
 * The other 1,169 pages were written before this section existed, so their
 * sidebars have no PDF entry and their totals still say 1,169. Both edits are
 * mechanical and the markup is byte-identical across pages, which is what
 * makes patching safe. Idempotent: a page already carrying the link is skipped.
 *
 * Pages sit at two depths — index.html and the legal pages use "./", tool pages
 * use "../" — so the prefix is detected per file rather than assumed.
 */
function patchExistingPages(total) {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['build', 'node_modules', '.git', 'engine', 'assets', CATEGORY.slug].includes(e.name)) continue;
        walk(p);
      } else if (e.name.endsWith('.html')) files.push(p);
    }
  })(ROOT);

  let patched = 0, already = 0, skipped = [];
  const n = Object.keys(PDF_TOOLS).length;

  for (const abs of files) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const before = fs.readFileSync(abs, 'utf8');

    /* no sidebar (404.html has none) → nothing to do beyond totals */
    const hasSidebar = before.includes('class="side-nav"') || before.includes('side-link');
    if (!hasSidebar) { skipped.push(rel); continue; }

    /* Depth varies: "./" at the root, "../" for category pages, "../../" for
       the conversion families. Read it off the page rather than assuming. */
    const pm = /href="((?:\.\.\/)+|\.\/)assets\/icons\.svg/.exec(before);
    if (!pm) { skipped.push(rel + ' (no asset prefix found)'); continue; }
    const prefix = pm[1];
    let out = before;

    if (!out.includes(`href="${prefix}${CATEGORY.slug}/index.html"`)) {
      const anchor = new RegExp(
        `\\n(\\s*)<a class="side-link[^"]*" href="${prefix.replace(/\./g, '\\.')}india/index\\.html">[\\s\\S]*?</a>`);
      const m = anchor.exec(out);
      if (!m) { skipped.push(rel + ' (no insertion point)'); continue; }
      const pad = m[1];
      const link =
        `\n${pad}<a class="side-link" href="${prefix}${CATEGORY.slug}/index.html">\n` +
        `${pad}  ${icon('pdf', prefix)}<span class="side-name">${CATEGORY.name}</span>` +
        `<span class="side-count">${n}</span>\n${pad}</a>`;
      out = out.replace(anchor, link + m[0]);
    } else already++;

    out = updateTotals(out, total);

    /* the homepage also carries a "Browse by category" grid */
    if (rel === 'index.html' && !out.includes(`class="card card-lg" href="${CATEGORY.slug}/index.html"`)) {
      const cardAnchor = /<a class="card card-lg" href="india\/index\.html">[\s\S]*?<\/a>/;
      const cm = cardAnchor.exec(out);
      if (cm) {
        const card = `<a class="card card-lg" href="${CATEGORY.slug}/index.html">` +
          `<span class="card-icon">${icon('pdf', './')}</span>` +
          `<strong>${CATEGORY.name}</strong><span class="card-desc">${n} tools</span></a>`;
        out = out.replace(cardAnchor, card + cm[0]);
      } else skipped.push('index.html (no category card anchor)');
    }

    if (out !== before) { patched++; if (!CHECK) fs.writeFileSync(abs, out); }
  }

  return { scanned: files.length, patched, already, skipped };
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */

function main() {
  const ids = Object.keys(PDF_TOOLS);
  const existingTotal = 1169;
  const total = existingTotal + ids.length;

  console.log(`\nbuild-pdf.js${CHECK ? '  (--check: nothing will be written)' : ''}`);
  console.log(`  ${ids.length} tools → /${CATEGORY.slug}/   site total ${existingTotal} → ${total}\n`);

  const shellParts = loadShell();

  buildBundles();
  const symbols = mergeIcons();
  appendCss();

  const index = ids.map(id => buildPdfToolPage(id, PDF_TOOLS[id], shellParts, total));
  buildPdfIndexPage(index, shellParts, total);

  const indexed = updateSearchIndex(index);
  const sitemapUrls = updateSitemap(index);
  const nav = patchExistingPages(total);
  const vendored = checkVendoredPdfJs();
  const sw = bumpServiceWorker(changes.length > 0 || nav.patched > 0);

  console.log(`  icons merged        ${symbols} symbols`);
  console.log(`  vendored pdf.js     ${vendored}`);
  console.log(`  search index        ${indexed} entries`);
  console.log(`  sitemap             ${sitemapUrls} URLs`);
  console.log(`  nav patch           ${nav.patched} of ${nav.scanned} existing pages ` +
              `${CHECK ? 'would be' : ''} updated`);
  if (nav.skipped.length) {
    console.log(`                      ${nav.skipped.length} skipped: ` +
                nav.skipped.slice(0, 4).join(', ') +
                (nav.skipped.length > 4 ? ` … +${nav.skipped.length - 4}` : ''));
  }
  if (sw) console.log(`  service worker      ${sw}`);
  console.log(`\n  ${changes.length} generated file(s) ${CHECK ? 'would change' : 'written'}`);
  if (CHECK && changes.length) {
    const show = changes.slice(0, 12);
    show.forEach(c => console.log('    ' + c));
    if (changes.length > show.length) console.log(`    … and ${changes.length - show.length} more`);
  }
  console.log();
}

try { main(); }
catch (e) { console.error('\nbuild-pdf.js failed: ' + (e && e.message || e) + '\n'); process.exit(1); }
