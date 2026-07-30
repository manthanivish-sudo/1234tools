/**
 * Site-wide shell patcher.
 *
 *   node build-site.js          apply
 *   node build-site.js --check  report what would change, write nothing
 *
 * build-pdf.js generates one section. This one owns the parts of the shell that
 * are identical on all 1,218 pages — the font loading, the analytics tag, the
 * search-console token — so a change to any of them is one edit here instead of
 * 1,218 edits by hand. That was the "no general build system" gap: every
 * site-wide change previously meant touching every file.
 *
 * It also owns sitemap-1.xml, and is now the only thing that writes it. Most of
 * that file used to be hand-maintained, so it drifted whenever a section was
 * added and nobody remembered — all 12 conversion hubs were missing until
 * d5fd82c, large indexable pages Google could only reach by crawling.
 * build-pdf.js appended its own 17 URLs in a slightly different format, which
 * is why the file carried two. Generating the whole thing from the same walk
 * that patches the pages makes "the page exists but Google was never told"
 * unrepresentable, and makes the format uniform by construction.
 *
 * Every edit is marker-delimited and idempotent. Running it twice writes
 * nothing the second time, which is what makes it safe to re-run.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');

/* ------------------------------------------------------------------ */
/* configuration                                                      */
/* ------------------------------------------------------------------ */

/**
 * Leave an id blank and its tag is simply not emitted, so the site is safe to
 * deploy before the accounts exist. Fill one in and re-run.
 */
const CONFIG = {
  /* Google Analytics 4, looks like G-XXXXXXXXXX */
  ga4: 'G-BJWYN6QS86',
  /* Microsoft Clarity project id, looks like abcdefghij */
  clarity: 'xunompl96y',
  /* Search Console: the content="..." value of the meta tag Google offers
     under "HTML tag" verification. DNS verification needs nothing here. */
  gsc: ''
};

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

/* ------------------------------------------------------------------ */
/* page discovery                                                     */
/* ------------------------------------------------------------------ */

/** Every deployed page. build/ is package source, not site output. */
function pages(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'build' || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) pages(abs, out);
    else if (e.name.endsWith('.html')) out.push(abs);
  }
  return out;
}

/** '', '../' or '../../' — how this page reaches the site root. */
const prefixOf = (abs) => {
  const depth = path.relative(ROOT, abs).split(path.sep).length - 1;
  return '../'.repeat(depth);
};

/* ------------------------------------------------------------------ */
/* sitemap                                                            */
/* ------------------------------------------------------------------ */

const SITE = 'https://www.1234tools.com';

/** A soft-404 shell. It is reachable, but Google must never be told to index it. */
const NOT_INDEXED = new Set(['404.html']);

/**
 * Section hubs, in the order the sitemap has always listed them. This is the
 * one list to extend when a section is added — and forgetting to is survivable,
 * because an unlisted page still ships in the tail below and gets reported.
 */
const SECTIONS = ['finance', 'mathematics', 'engineering', 'health', 'design',
  'utilities', 'time', 'developer', 'business', 'india', 'image', 'text',
  'conversions', 'pdf'];

/**
 * The pages that are not tools. They change on the order of never, and a
 * crawler's budget is better spent on the 1,200 pages people actually search
 * for, so they carry a lower priority and a yearly changefreq.
 */
const META_PAGES = {
  'about/index.html':   { freq: 'yearly', pri: '0.5' },
  'contact/index.html': { freq: 'yearly', pri: '0.5' },
  'privacy/index.html': { freq: 'yearly', pri: '0.3' },
  'terms/index.html':   { freq: 'yearly', pri: '0.3' },
  'cookies/index.html': { freq: 'yearly', pri: '0.3' }
};

function sitemapMeta(rel) {
  if (rel === 'index.html') return { freq: 'monthly', pri: '1.0' };
  return META_PAGES[rel] || { freq: 'monthly', pri: '0.7' };
}

/**
 * The tool order the site already maintains for its own search box. Reusing it
 * is what keeps the sitemap and the search index from disagreeing about which
 * tools exist: adding a tool to one now adds it to the other.
 */
function searchIndexPaths() {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'search-index.js'), 'utf8');
  const m = /^window\.SEARCH_INDEX=(\[[\s\S]*\]);?\s*$/.exec(src.trim());
  if (!m) throw new Error('Unrecognised format in assets/search-index.js.');
  return JSON.parse(m[1]).map((e) => String(e[1]));
}

/**
 * Every indexable page, in the order the sitemap has carried them. The order is
 * cosmetic to a crawler, but keeping it stable keeps the diff readable, which is
 * what makes a regenerated file reviewable at all.
 */
function sitemapPages() {
  const onDisk = new Set(
    pages().map((abs) => path.relative(ROOT, abs).replace(/\\/g, '/'))
           .filter((rel) => !NOT_INDEXED.has(rel))
  );

  const out = [], seen = new Set();
  const take = (rel) => {
    if (!onDisk.has(rel) || seen.has(rel)) return;
    seen.add(rel);
    out.push(rel);
  };

  take('index.html');
  searchIndexPaths().forEach(take);
  SECTIONS.forEach((s) => take(s + '/index.html'));
  Object.keys(META_PAGES).forEach(take);
  [...onDisk].filter((r) => /^conversions\/[^/]+\/index\.html$/.test(r))
             .sort().forEach(take);

  /* Whatever none of the lists above claimed. It is still emitted — a page
     missing from the sitemap is the exact bug this function exists to prevent —
     but it is reported, because landing here means a list needs extending. */
  const unclaimed = [...onDisk].filter((r) => !seen.has(r)).sort();
  unclaimed.forEach(take);

  return { out, unclaimed };
}

function buildSitemap() {
  const { out, unclaimed } = sitemapPages();
  const body = out.map((rel) => {
    const { freq, pri } = sitemapMeta(rel);
    const loc = rel === 'index.html' ? SITE + '/' : `${SITE}/${rel}`;
    return `<url><loc>${loc}</loc><changefreq>${freq}</changefreq>` +
           `<priority>${pri}</priority></url>`;
  });

  const changed = write('sitemap-1.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body.join('\n') + '\n</urlset>\n');

  return { count: out.length, changed, unclaimed };
}

/* ------------------------------------------------------------------ */
/* head edits                                                         */
/* ------------------------------------------------------------------ */

const FONT_START = '<!-- FONTS: generated by build-site.js, do not edit -->';
const FONT_END = '<!-- /FONTS -->';
const ANALYTICS_START = '<!-- ANALYTICS: generated by build-site.js, do not edit -->';
const ANALYTICS_END = '<!-- /ANALYTICS -->';

/* The exact block every page carries today, so the first run knows what to
   replace. Matched loosely on whitespace but anchored on the two hosts. */
const GOOGLE_FONTS = new RegExp(
  '[ \\t]*<link rel="preconnect" href="https://fonts\\.googleapis\\.com">\\r?\\n' +
  '[ \\t]*<link rel="preconnect" href="https://fonts\\.gstatic\\.com" crossorigin>\\r?\\n' +
  '[ \\t]*<link rel="stylesheet" href="https://fonts\\.googleapis\\.com/css2\\?[^"]*">\\r?\\n'
);

function fontBlock(p) {
  /* Only the latin faces are preloaded. They are on the critical path for
     every page; latin-ext is selected by unicode-range and is rare here, and
     preloading a font the page never uses is a wasted round trip. */
  return `${FONT_START}
<link rel="preload" href="${p}assets/fonts/sora-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${p}assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
${FONT_END}
`;
}

function analyticsBlock(p) {
  if (!CONFIG.ga4 && !CONFIG.clarity && !CONFIG.gsc) return '';
  const lines = [ANALYTICS_START];
  if (CONFIG.gsc) {
    lines.push(`<meta name="google-site-verification" content="${CONFIG.gsc}">`);
  }
  if (CONFIG.ga4 || CONFIG.clarity) {
    lines.push(`<script src="${p}assets/analytics.js" ` +
      `data-ga4="${CONFIG.ga4}" data-clarity="${CONFIG.clarity}" defer></script>`);
  }
  lines.push(ANALYTICS_END, '');
  return lines.join('\n');
}

/** Replace a marked block, or insert it if this page has none yet. */
function upsert(html, start, end, block, insertBefore) {
  const from = html.indexOf(start);
  if (from !== -1) {
    const to = html.indexOf(end, from);
    if (to === -1) throw new Error('unterminated ' + start);
    return html.slice(0, from) + block.replace(/\n$/, '') + html.slice(to + end.length);
  }
  if (!block) return html;
  const at = html.indexOf(insertBefore);
  if (at === -1) throw new Error('no ' + insertBefore + ' to insert before');
  return html.slice(0, at) + block + html.slice(at);
}

function patchPages() {
  const list = pages();
  let fonts = 0, analytics = 0, skipped = [];

  for (const abs of list) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const before = fs.readFileSync(abs, 'utf8');
    let html = before;
    const p = prefixOf(abs);

    /* fonts: first run swaps the Google block out, later runs update in place */
    if (GOOGLE_FONTS.test(html)) {
      html = html.replace(GOOGLE_FONTS, fontBlock(p));
      fonts++;
    } else if (html.includes(FONT_START)) {
      const next = upsert(html, FONT_START, FONT_END, fontBlock(p), '</head>');
      if (next !== html) { html = next; fonts++; }
    } else {
      skipped.push(rel);
    }

    const withAnalytics = upsert(html, ANALYTICS_START, ANALYTICS_END,
                                 analyticsBlock(p), '</head>');
    if (withAnalytics !== html) { html = withAnalytics; analytics++; }

    if (html !== before) {
      changes.push('update ' + rel);
      if (!CHECK) fs.writeFileSync(abs, html);
    }
  }
  return { total: list.length, fonts, analytics, skipped };
}

/* ------------------------------------------------------------------ */
/* stylesheet                                                         */
/* ------------------------------------------------------------------ */

const CSS_START = '/* === Self-hosted fonts and consent banner (build-site.js) === */';
const CSS_END = '/* === /build-site.js === */';

function patchCss() {
  const rel = 'assets/app.css';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const block = CSS_START + '\n' +
    fs.readFileSync(path.join(ROOT, 'build', 'site', 'shell.css'), 'utf8').trimEnd() +
    '\n' + CSS_END;

  const from = src.indexOf(CSS_START);
  let next;
  if (from === -1) {
    next = src.trimEnd() + '\n\n' + block + '\n';
  } else {
    const to = src.indexOf(CSS_END, from);
    if (to === -1) throw new Error('unterminated ' + CSS_START);
    next = src.slice(0, from) + block + src.slice(to + CSS_END.length);
  }
  return write(rel, next) ? 'updated' : 'unchanged';
}

/* ------------------------------------------------------------------ */
/* service worker                                                     */
/* ------------------------------------------------------------------ */

/**
 * The two latin faces are on every page, so precaching them is the difference
 * between a styled and an unstyled first offline paint. Everything else stays
 * cached on demand.
 */
function patchServiceWorker(somethingChanged) {
  const rel = 'sw.js';
  let src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const want = [
    "  './assets/fonts/sora-latin.woff2', './assets/fonts/inter-latin.woff2',"
  ].join('\n');

  if (!src.includes('assets/fonts/sora-latin.woff2')) {
    src = src.replace(/(\s*)('\.\/manifest\.webmanifest')/, `\n${want}$1$2`);
  }

  if (somethingChanged || src !== fs.readFileSync(path.join(ROOT, rel), 'utf8')) {
    const m = /(\bV\s*=\s*['"])([^'"]+)(['"])/.exec(src);
    if (!m) { console.log('  ! no version string in sw.js — bump it by hand'); return null; }
    const n = /^(.*?)(\d+)$/.exec(m[2]);
    const bumped = n ? n[1] + (Number(n[2]) + 1) : m[2] + '-site';
    src = src.replace(m[0], m[1] + bumped + m[3]);
    write(rel, src);
    return `${m[2]} → ${bumped}`;
  }
  return 'unchanged';
}

/* ------------------------------------------------------------------ */

function main() {
  console.log(`\nbuild-site.js${CHECK ? '  (--check: nothing will be written)' : ''}`);
  const on = [
    CONFIG.ga4 ? 'GA4 ' + CONFIG.ga4 : null,
    CONFIG.clarity ? 'Clarity ' + CONFIG.clarity : null,
    CONFIG.gsc ? 'Search Console' : null
  ].filter(Boolean);
  console.log(`  analytics: ${on.length ? on.join(', ') : 'no ids configured — no tags will be emitted'}\n`);

  const css = patchCss();
  const page = patchPages();
  const sw = patchServiceWorker(changes.length > 0);
  /* After the service worker deliberately: the sitemap is for crawlers, not
     part of the app shell, so adding a page must not invalidate the cached
     shell of every returning visitor. */
  const map = buildSitemap();

  console.log(`  pages scanned       ${page.total}`);
  console.log(`  font block          ${page.fonts} ${CHECK ? 'would be' : ''} patched`);
  console.log(`  analytics block     ${page.analytics} ${CHECK ? 'would be' : ''} patched`);
  console.log(`  app.css             ${css}`);
  if (sw) console.log(`  service worker      ${sw}`);
  console.log(`  sitemap             ${map.count} URLs, ` +
              (map.changed ? (CHECK ? 'would be rewritten' : 'rewritten') : 'unchanged'));
  if (map.unclaimed.length) {
    console.log(`  ! ${map.unclaimed.length} page(s) matched no known group — ` +
                `listed at the end of the sitemap, but SECTIONS or META_PAGES wants extending:`);
    map.unclaimed.slice(0, 5).forEach((s) => console.log('      ' + s));
    if (map.unclaimed.length > 5) console.log(`      … +${map.unclaimed.length - 5}`);
  }
  if (page.skipped.length) {
    console.log(`  ! ${page.skipped.length} page(s) had no recognisable font block:`);
    page.skipped.slice(0, 5).forEach(s => console.log('      ' + s));
    if (page.skipped.length > 5) console.log(`      … +${page.skipped.length - 5}`);
  }
  console.log(`\n  ${changes.length} file(s) ${CHECK ? 'would change' : 'written'}\n`);
}

try { main(); }
catch (e) { console.error('\nbuild-site.js failed: ' + (e && e.message || e) + '\n'); process.exit(1); }
