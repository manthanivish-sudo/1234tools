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
 * Every page in it is claimed by a named group — the search index, SECTIONS,
 * META_PAGES, the conversion hubs, READING — and whatever is left over is
 * still emitted but reported, so a new kind of page shows up as a warning
 * rather than as a silent tail. Pages that say noindex are left out, by
 * content rather than by name.
 *
 * Every edit is marker-delimited and idempotent. Running it twice writes
 * nothing the second time, which is what makes it safe to re-run.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

/**
 * A tool has two addresses and they are not the same string.
 *
 * The search index carries the one it is served at, `qr/qr-code-scanner/`,
 * which ends in a slash. `fileOf` is the markup behind it; `hrefOf` is what a
 * link on another page should say. Conflating the two is what broke this
 * script the first time the URLs moved, so they are named apart.
 */
const fileOf = (url) => (url.endsWith('/') ? url + 'index.html' : url);
const hrefOf = (url) => '/' + url;

/** The address a file on disk is served at. */
function publicUrl(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel;
}

/** Links are root-absolute now, so depth no longer changes what a page says. */
const prefixOf = () => '/';

/* ------------------------------------------------------------------ */
/* sitemap                                                            */
/* ------------------------------------------------------------------ */

const SITE = 'https://www.1234tools.com';

/** A soft-404 shell. It is reachable, but Google must never be told to index it. */
const NOT_INDEXED = new Set(['404.html']);

/**
 * Pages that deliberately carry no shell. When a tool moves, one of these is
 * left at the old URL so existing links and printed codes keep working. They
 * must stay out of the sitemap, and patching a font or analytics block into
 * one would defeat the point of a page whose whole job is to redirect.
 *
 * Recognised by what they are rather than listed by name: there are now one
 * per tool, and a list of twelve hundred would go stale the first time a tool
 * was added.
 */
const isRedirect = (html) =>
  /name="robots" content="noindex,follow"/.test(html) && /http-equiv="refresh"/.test(html);

/**
 * Any page that tells crawlers not to index it. A sitemap that lists a noindex
 * page contradicts itself — Search Console reports each one as "submitted URL
 * marked noindex" — so these are kept out by what they say, not by name, and
 * a page that gains the meta tomorrow drops out on the next run.
 *
 * Today that is /practice/* (a product that is built but not deployed; the
 * pages stay on disk and return the day the meta is removed), /account/ and
 * /pricing/ (build-account.js keeps them dark until --live), the legal pages
 * cookies/, privacy/ and terms/, which carry "noindex, follow" with a space,
 * and the 404 shell. Every redirect stub is noindex too, so for the sitemap
 * this subsumes isRedirect; the two are kept apart because patchPages() must
 * still skip a stub and must still patch the shell of a noindex page.
 */
const isNoIndex = (html) =>
  [...html.matchAll(/<meta\b[^>]*\bname=["']robots["'][^>]*>/gi)]
    .some((m) => {
      const c = /\bcontent=["']([^"']*)["']/i.exec(m[0]);
      return !!c && /\bnoindex\b/i.test(c[1]);
    });

/** One pass over every page, each classified once and remembered. */
const classified = (function () {
  let cache = null;
  return function () {
    if (cache) return cache;
    cache = { redirect: new Set(), noindex: new Set() };
    for (const abs of pages()) {
      const html = fs.readFileSync(abs, 'utf8');
      const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
      if (isRedirect(html)) cache.redirect.add(rel);
      if (isNoIndex(html)) cache.noindex.add(rel);
    }
    return cache;
  };
})();
const redirectPages = () => classified().redirect;
const noIndexPages = () => classified().noindex;

/**
 * Section hubs, in the order the sitemap has always listed them. This is the
 * one list to extend when a section is added — and forgetting to is survivable,
 * because an unlisted page still ships in the tail below and gets reported.
 * (education and ai did exactly that until 2026-10-03.) The order is cosmetic
 * to a crawler; keeping it stable is what keeps the diff readable.
 */
const SECTIONS = ['finance', 'mathematics', 'engineering', 'health', 'design',
  'utilities', 'time', 'developer', 'business', 'education', 'india', 'image',
  'text', 'conversions', 'pdf', 'qr', 'ai-image', 'ai-video', 'ai'];

/**
 * The single pages that are not tools. Most change on the order of never, and
 * a crawler's budget is better spent on the 1,200 pages people actually search
 * for, so they carry a lower priority and a yearly changefreq.
 */
const META_PAGES = {
  'about/index.html':    { freq: 'yearly',  pri: '0.5' },
  'contact/index.html':  { freq: 'yearly',  pri: '0.5' },
  /* These three carry "noindex, follow" today, so they are filtered out before
     this table is consulted. They stay listed so that lifting the meta puts
     them back at these values rather than in the unclaimed tail. */
  'privacy/index.html':  { freq: 'yearly',  pri: '0.3' },
  'terms/index.html':    { freq: 'yearly',  pri: '0.3' },
  'cookies/index.html':  { freq: 'yearly',  pri: '0.3' },
  /* Written by build-account.js, which appends them at these values when they
     are missing; the same values here keep the two writers in agreement. */
  'settings/index.html': { freq: 'monthly', pri: '0.5' },
  'trust/index.html':    { freq: 'monthly', pri: '0.5' },
  /* The every-tool directory. build-tools.js appends it as weekly/0.9: it
     changes whenever a tool ships, and it links to all of them. */
  'tools/index.html':    { freq: 'weekly',  pri: '0.9' }
};

/**
 * The reading sections: pages about the tools rather than tools. Keyed by
 * prefix, so a new guide or collection is claimed the day it is built with no
 * list to extend. Each section's own builder appends its pages at these same
 * values when they are new (build-collections.js, build-guides.js,
 * build-compare.js, build-learn.js), and this table is what keeps them there
 * when the whole file is regenerated — change one and change the other.
 *
 *   for/      0.8  collections are landing pages written to be found — "tools
 *                  for accountants" — and each sends a reader on to a dozen
 *                  tools, so a crawl there pays for itself
 *   guides/   0.8  a how-to that ends in one of our tools; same reasoning
 *   compare/  0.7  landing pages too, but the queries are narrow and the pages
 *                  compete with review sites, so no higher than a tool page
 *   learn/    0.6  curated lists of links that lead off-site: useful, thin on
 *                  content of their own; the hub is the page worth finding, 0.7
 *
 * All monthly: they are edited when the tools they point at change, which is
 * about that often.
 */
const READING = {
  'compare/': { freq: 'monthly', pri: '0.7' },
  'guides/':  { freq: 'monthly', pri: '0.8' },
  'for/':     { freq: 'monthly', pri: '0.8' },
  /* the Hindi twins of the collections, written by build-collections.js */
  'hi/for/':  { freq: 'monthly', pri: '0.7' },
  /* people who made something with a tool, written by build-showcase.js */
  'showcase/': { freq: 'weekly', pri: '0.6' },
  /* "Embed our calculators", written by build-embed.js: one page for the
     people who would put a tool on their own site */
  'embed/':   { freq: 'monthly', pri: '0.6' },
  'learn/':   { freq: 'monthly', pri: '0.6', hubPri: '0.7' }
};

const readingGroupOf = (rel) => Object.keys(READING).find((p) => rel.startsWith(p));

function sitemapMeta(rel) {
  if (rel === 'index.html') return { freq: 'monthly', pri: '1.0' };
  if (META_PAGES[rel]) return META_PAGES[rel];
  const group = readingGroupOf(rel);
  if (group) {
    const g = READING[group];
    const hub = rel === group + 'index.html';
    return { freq: g.freq, pri: hub && g.hubPri ? g.hubPri : g.pri };
  }
  return { freq: 'monthly', pri: '0.7' };
}

/**
 * The tool order the site already maintains for its own search box. Reusing it
 * is what keeps the sitemap and the search index from disagreeing about which
 * tools exist: adding a tool to one now adds it to the other.
 */
function searchIndexPaths() {
  return searchIndexTools().map((t) => t.url);
}

/**
 * Every indexable page, in the order the sitemap has carried them. The order is
 * cosmetic to a crawler, but keeping it stable keeps the diff readable, which is
 * what makes a regenerated file reviewable at all.
 */
function sitemapPages() {
  /* Three reasons a page on disk is not an entry: it is the 404 shell, it is
     a redirect stub, or it asks not to be indexed. */
  const onDisk = new Set(
    pages().map((abs) => path.relative(ROOT, abs).replace(/\\/g, '/'))
           .filter((rel) => !NOT_INDEXED.has(rel) &&
                            !redirectPages().has(rel) &&
                            !noIndexPages().has(rel))
  );

  const out = [], seen = new Set();
  const take = (rel) => {
    if (!onDisk.has(rel) || seen.has(rel)) return;
    seen.add(rel);
    out.push(rel);
  };

  take('index.html');
  searchIndexPaths().map(fileOf).forEach(take);
  SECTIONS.forEach((s) => take(s + '/index.html'));
  Object.keys(META_PAGES).forEach(take);
  [...onDisk].filter((r) => /^conversions\/[^/]+\/index\.html$/.test(r))
             .sort().forEach(take);
  /* The reading sections: each hub, then its pages in name order. */
  for (const prefix of Object.keys(READING)) {
    take(prefix + 'index.html');
    [...onDisk].filter((r) => r.startsWith(prefix)).sort().forEach(take);
  }

  /* Whatever none of the lists above claimed. It is still emitted — a page
     missing from the sitemap is the exact bug this function exists to prevent —
     but it is reported, because landing here means a list needs extending. */
  const unclaimed = [...onDisk].filter((r) => !seen.has(r)).sort();
  unclaimed.forEach(take);

  /* The deliberate absences, for the summary. Stubs are too many to list and
     too obviously right; these are the pages someone chose to keep dark. */
  const noindex = [...noIndexPages()]
    .filter((r) => !redirectPages().has(r) && !NOT_INDEXED.has(r)).sort();

  return { out, unclaimed, noindex };
}

function buildSitemap() {
  const { out, unclaimed, noindex } = sitemapPages();
  const body = out.map((rel) => {
    const { freq, pri } = sitemapMeta(rel);
    const loc = SITE + publicUrl(rel);
    return `<url><loc>${loc}</loc><changefreq>${freq}</changefreq>` +
           `<priority>${pri}</priority></url>`;
  });

  const changed = write('sitemap-1.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body.join('\n') + '\n</urlset>\n');

  return { count: out.length, changed, unclaimed, noindex };
}

/* ------------------------------------------------------------------ */
/* popular tools (homepage)                                           */
/* ------------------------------------------------------------------ */

const POPULAR_START = '<!-- POPULAR: generated by build-site.js, do not edit -->';
const POPULAR_END = '<!-- /POPULAR -->';

/**
 * Hand-picked, and headed "Popular tools" rather than "Popular today", because
 * nothing on this page measures what is popular today. GA4 holds that figure,
 * but reading it needs API credentials and a server, and this site is static
 * files on Pages. A freshness claim the page cannot back is the one kind of
 * trust signal that is worth less than nothing.
 *
 * The companion strip below it — "Pick up where you left off" — is real, and is
 * built in assets/app.js from the visitor's own last few tools. That never
 * leaves the device, which is why it can be honest about being personal.
 */
const POPULAR = [
  'image/image-compressor/',
  'pdf/merge-pdf/',
  'developer/json-formatter/',
  'image/passport-photo/',
  'qr/qr-code-generator/',
  'business/currency-converter/',
  'india/gst-calculator/',
  'text/word-counter/'
];

function buildPopular() {
  const rel = 'index.html';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const byUrl = new Map(searchIndexTools().map((t) => [t.url, t]));

  const card = (u) => {
    const t = byUrl.get(u);
    if (!t) throw new Error(`POPULAR lists a tool that is not in the search index: ${u}`);
    const page = fs.readFileSync(path.join(ROOT, fileOf(u)), 'utf8');
    const d = /<meta name="description" content="([^"]*)"/.exec(page);
    return `<a class="card" href="${hrefOf(u)}">` +
      '<span class="card-icon"><svg class="ico" aria-hidden="true" focusable="false">' +
      `<use href="/assets/icons.svg#i-${t.id}"></use></svg></span>` +
      `<strong>${esc(t.title)}</strong>` +
      (d ? `<span class="card-desc">${d[1]}</span>` : '') +
      '</a>';
  };

  const block = [
    POPULAR_START,
    '<h2 class="section-title">Popular tools</h2>',
    '<div class="grid grid-feature">' + POPULAR.map(card).join('') + '</div>',
    '<div id="recent-tools" hidden></div>',
    POPULAR_END,
    ''
  ].join('\n');

  const anchor = '<h2 class="section-title">Browse by category</h2>';
  const from = src.indexOf(POPULAR_START);
  let next;
  if (from !== -1) {
    const to = src.indexOf(POPULAR_END, from);
    if (to === -1) throw new Error('unterminated ' + POPULAR_START);
    next = src.slice(0, from) + block.replace(/\n$/, '') + src.slice(to + POPULAR_END.length);
  } else {
    const at = src.indexOf(anchor);
    if (at === -1) throw new Error('no "Browse by category" heading on the homepage');
    next = src.slice(0, at) + block + src.slice(at);
  }
  return write(rel, next) ? 'updated' : 'unchanged';
}

/* ------------------------------------------------------------------ */
/* related tools                                                      */
/* ------------------------------------------------------------------ */

/**
 * Every tool page carries a "Related tools" list. Most were written by hand and
 * are better than anything computable, so they are kept: everything above the
 * marker is left exactly as found, and only the gap between that and a useful
 * number of links is filled. The one exception is order on the conversion
 * pair pages, whose lists were written by machine, not by hand: there the
 * items above the marker are re-ordered popular first (see convKey), never
 * added to or removed.
 *
 * The measured problem this closes, before the first run: 33 pages had no list
 * at all, 36 more had three links or fewer, and 241 pages had no inbound link
 * from any other tool page — reachable only from a hub or the sitemap, which is
 * a poor way to be found by a person and a poor way to be crawled.
 *
 * pdf/ is excluded because build-pdf.js writes those pages. They are still
 * linked TO, just never edited here; two generators editing one file is the
 * mistake the sitemap already taught.
 */
const REL_MARK = '<!--related: generated by build-site.js, edit above this line-->';
const REL_TARGET = 6;        // fill a page up to this many links
const REL_MAX = 10;          // never exceed this, curated included
const REL_MIN_INBOUND = 2;   // every tool reachable from at least this many others

/* Words that say "this is a tool on this site" rather than what it does, so
   they would make everything look related to everything. */
const REL_STOP = new Set(['to', 'and', 'of', 'the', 'in', 'for', 'with', 'from',
  'by', 'your', 'calculator', 'calculators', 'converter', 'convert', 'conversion',
  'tool', 'tools', 'online', 'free', 'generator', 'maker', 'checker']);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function searchIndexTools() {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'search-index.js'), 'utf8');
  const m = /^window\.SEARCH_INDEX=(\[[\s\S]*\]);?\s*$/.exec(src.trim());
  if (!m) throw new Error('Unrecognised format in assets/search-index.js.');

  return JSON.parse(m[1]).map((e) => {
    const url = String(e[1]);
    const seg = url.replace(/\/+$/, '').split('/');
    const slug = seg[seg.length - 1].replace(/\.html$/, '');
    return {
      title: String(e[0]),
      url,
      id: String(e[2] || ''),
      category: seg[0],
      /* conversions/<family>/<pair>/ — the family is a far stronger signal
         than the category, which covers a thousand pages on its own. */
      family: seg.length > 2 ? seg[1] : null,
      editable: seg[0] !== 'pdf',
      tokens: new Set((slug + ' ' + e[0]).toLowerCase().split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1 && !REL_STOP.has(w)))
    };
  });
}

/**
 * Which categories are worth linking across, as an editorial judgement — there
 * is no signal in the page text that connects Ohm's law to a watt conversion.
 * Needed because several categories hold one or three tools: without this,
 * engineering, design and finance pages score nothing at all and end up either
 * empty or padded with something irrelevant, which is worse than empty. Entries
 * may name a category or a conversions family.
 */
const REL_AFFINITY = {
  engineering: ['conversions/power', 'conversions/energy', 'conversions/pressure', 'mathematics'],
  design:      ['image', 'conversions/length'],
  image:       ['design', 'ai-image', 'ai-video'],
  'ai-image':  ['image', 'design', 'ai-video'],
  'ai-video':  ['ai-image', 'image'],
  finance:     ['business', 'india'],
  business:    ['finance', 'india'],
  india:       ['finance', 'business'],
  mathematics: ['engineering', 'conversions/area'],
  health:      ['conversions/mass', 'conversions/length'],
  time:        ['conversions/time'],
  text:        ['developer'],
  developer:   ['text'],
  utilities:   ['conversions/length', 'conversions/volume']
};

/** Higher is more related. Shared words dominate, which is what puts the
    reciprocal of a unit conversion at the top of its own list. */
function relScore(a, b) {
  let s = 0;
  if (a.category === b.category) s += 4;
  if (a.family && a.family === b.family) s += 6;

  /* Weaker than a shared category on purpose: a real neighbour should always
     outrank an editorially adjacent one. */
  const near = REL_AFFINITY[a.category];
  if (near && (near.includes(b.category) ||
               (b.family && near.includes(b.category + '/' + b.family)))) s += 3;

  let shared = 0;
  for (const w of a.tokens) if (b.tokens.has(w)) shared++;
  return s + 3 * shared;
}

const REL_SECTION =
  /<section class="panel"><h2>Related tools<\/h2><ul class="related">([\s\S]*?)<\/ul><\/section>/;

/**
 * The tools a hand-written list points at, named the way the search index names
 * them, or null if the page has no list. Links are root-absolute on the page
 * and slash-terminated in the index, so both forms are accepted on the way in.
 */
function curatedOf(html) {
  const m = REL_SECTION.exec(html);
  if (!m) return null;
  return [...m[1].split(REL_MARK)[0].matchAll(/href="([^"]+)"/g)]
    .map((x) => x[1].replace(/^\//, '').replace(/#.*$/, ''))
    .map((u) => (u.endsWith('.html') ? u.replace(/\.html$/, '/') : u));
}

/**
 * The 1,048 unit-conversion pair pages are the one place where a tie in
 * relScore is the rule rather than the exception: every sibling in a family
 * scores the same, so the url tie-break handed "Metre to Foot" a list that
 * opened on Angstrom and Astronomical Unit. Their lists (the part written once
 * with the pages as well as the part generated here) are ordered instead by
 * what build/conversions/data.js says people look for: its POPULAR pairs in
 * their declared order, then every other pair by how common its rarer unit is
 * (UNIT_ORDER, then the bundle's own order — the order build-conversions.js
 * uses), then its commoner unit. Which links a list holds, and how many, is
 * decided exactly as for every other page.
 */
const PAIR_URL_RE = /^conversions\/([a-z0-9-]+)\/([a-z0-9-]+)-to-([a-z0-9-]+)\/$/;
const slugify = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

let convRanks = null;
/** url -> [popular index, rarer unit's rank, commoner unit's rank], or null
    for anything that is not a known conversion pair. Loaded on first use, so
    a require() of this file for a helper reads nothing. */
function convKey(url) {
  if (!convRanks) {
    const DATA = require('./build/conversions/data.js');
    const box = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'engine', 'units.bundle.js'), 'utf8'), box, { filename: 'units.bundle.js' });
    const UNITS = box.window.UNITS;
    if (!UNITS) throw new Error('build-site.js: engine/units.bundle.js did not define UNITS');
    convRanks = new Map();
    for (const fam of Object.keys(UNITS)) {
      const keys = Object.keys(UNITS[fam].units);
      const order = (DATA.UNIT_ORDER[fam] || []).filter((k) => keys.includes(k));
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const slug = (k) => slugify(UNITS[fam].units[k].name);
      const pop = new Map((DATA.POPULAR[fam] || []).map(([a, b], i) => [slug(a) + '-to-' + slug(b), i]));
      convRanks.set(fam, { unit: new Map(order.map((k, i) => [slug(k), i])), pop });
    }
  }
  const m = PAIR_URL_RE.exec(url);
  const f = m && convRanks.get(m[1]);
  if (!f || !f.unit.has(m[2]) || !f.unit.has(m[3])) return null;
  const ra = f.unit.get(m[2]), rb = f.unit.get(m[3]);
  const p = f.pop.get(m[2] + '-to-' + m[3]);
  return [p === undefined ? Infinity : p, Math.max(ra, rb), Math.min(ra, rb)];
}

/** Popular first; 0 on a tie, so a stable sort keeps the order it was given. */
function convCmp(a, b) {
  const ka = convKey(a), kb = convKey(b);
  if (!ka || !kb) return ka ? -1 : kb ? 1 : 0;
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
  return 0;
}

const isPairPage = (url) => PAIR_URL_RE.test(url) && convKey(url) !== null;

/** A pair page's hand-written items, popular first. Left exactly as found
    unless it is nothing but <li><a href> items. */
function sortCurated(part) {
  const items = part.match(/<li><a href="[^"]*">[\s\S]*?<\/a><\/li>/g) || [];
  if (items.join('') !== part) return part;
  const url = (li) => /href="\/?([^"#]*)/.exec(li)[1];
  return items.slice().sort((x, y) => convCmp(url(x), url(y))).join('');
}

function relBlock(pageUrl, targets, byUrl) {
  return targets.map((u) => {
    return `<li><a href="${hrefOf(u)}">${esc(byUrl.get(u).title)}</a></li>`;
  }).join('');
}

function patchRelated() {
  const tools = searchIndexTools();
  const byUrl = new Map(tools.map((t) => [t.url, t]));

  /* Read every page, pdf/ included: those links count towards reachability even
     though the pages are not ours to edit. */
  const curated = new Map();
  const html = new Map();
  let created = 0;
  for (const t of tools) {
    const src = fs.readFileSync(path.join(ROOT, fileOf(t.url)), 'utf8');
    html.set(t.url, src);
    const c = curatedOf(src);
    if (c === null) { created++; curated.set(t.url, []); }
    else curated.set(t.url, c.filter((u) => byUrl.has(u)));
  }

  /* Ranked once per tool and capped: the full matrix is 1.4M pairs and only the
     head of each list is ever consulted. Ties break on url so a rebuild on
     another machine produces the same file. */
  const ranked = new Map();
  for (const t of tools) {
    const list = [];
    for (const o of tools) {
      if (o.url === t.url) continue;
      const s = relScore(t, o);
      if (s > 0) list.push([s, o.url]);
    }
    list.sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1));
    ranked.set(t.url, list.slice(0, 40).map((x) => x[1]));
  }

  const gen = new Map(tools.map((t) => [t.url, []]));

  /* Pass 1 — top thin lists up to REL_TARGET.
     Links reached through REL_AFFINITY all score identically, so ties break on
     url and a page would otherwise be handed six alphabetical neighbours: Ohm's
     law offered six ways to convert a British Thermal Unit. Capping how many
     come from one family, and refusing to repeat a leading unit, spreads them
     out. Only cross-category picks are rationed — a length conversion listing
     its siblings is exactly right, and must not be thinned. */
  /* The capped list can be filled entirely by one family, leaving nothing to
     fall back on once the diversity rules start rejecting it. Rescoring the
     whole set is only needed for the handful of pages that get that far. */
  const fullRanked = (t) => tools
    .map((o) => [o.url === t.url ? 0 : relScore(t, o), o.url])
    .filter((x) => x[0] > 0)
    .sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1))
    .map((x) => x[1]);

  for (const t of tools) {
    if (!t.editable) continue;
    const have = new Set(curated.get(t.url));
    const need = REL_TARGET - have.size;
    if (need <= 0) continue;

    const perFamily = new Map();
    const leadSeen = new Set();

    const take = (candidates) => {
      for (const u of candidates) {
        if (gen.get(t.url).length >= need) return;
        if (have.has(u)) continue;

        const o = byUrl.get(u);
        if (o.category !== t.category) {
          const fam = o.category + '/' + (o.family || '');
          if ((perFamily.get(fam) || 0) >= 3) continue;
          const lead = u.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '').split('-to-')[0];
          if (leadSeen.has(lead)) continue;
          perFamily.set(fam, (perFamily.get(fam) || 0) + 1);
          leadSeen.add(lead);
        }

        gen.get(t.url).push(u);
        have.add(u);
      }
    };

    /* A pair page breaks ties on popularity before url, over the whole set
       so a popular sibling is never cut off by the cap of forty. */
    if (isPairPage(t.url)) {
      take(tools
        .map((o) => [o.url === t.url ? 0 : relScore(t, o), o.url])
        .filter((x) => x[0] > 0)
        .sort((a, b) => b[0] - a[0] || convCmp(a[1], b[1]) || (a[1] < b[1] ? -1 : 1))
        .map((x) => x[1]));
      continue;
    }
    take(ranked.get(t.url));
    if (gen.get(t.url).length < need) take(fullRanked(t));
  }

  /* Pass 2 — nothing may be unreachable. Similarity is near enough symmetric
     that a page's own best matches are also the best places to be listed. */
  const inbound = new Map(tools.map((t) => [t.url, 0]));
  for (const t of tools) {
    for (const u of curated.get(t.url).concat(gen.get(t.url))) {
      if (inbound.has(u)) inbound.set(u, inbound.get(u) + 1);
    }
  }
  let injected = 0;
  for (const t of tools) {
    let need = REL_MIN_INBOUND - inbound.get(t.url);
    for (const host of ranked.get(t.url)) {
      if (need <= 0) break;
      if (!byUrl.get(host).editable) continue;
      if (curated.get(host).length + gen.get(host).length >= REL_MAX) continue;
      if (curated.get(host).includes(t.url) || gen.get(host).includes(t.url)) continue;
      gen.get(host).push(t.url);
      inbound.set(t.url, inbound.get(t.url) + 1);
      injected++;
      need--;
    }
  }

  /* A few tools sit in small categories where all forty of their best hosts are
     already full. Rather than leave those unreachable, widen the search to every
     page — still best-scoring first, so the link lands somewhere defensible. */
  for (const t of tools) {
    let need = REL_MIN_INBOUND - inbound.get(t.url);
    if (need <= 0) continue;
    const wide = tools
      .filter((o) => o.url !== t.url && o.editable)
      .map((o) => [relScore(t, o), o.url])
      .sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1));
    for (const [, host] of wide) {
      if (need <= 0) break;
      if (curated.get(host).length + gen.get(host).length >= REL_MAX) continue;
      if (curated.get(host).includes(t.url) || gen.get(host).includes(t.url)) continue;
      gen.get(host).push(t.url);
      inbound.set(t.url, inbound.get(t.url) + 1);
      injected++;
      need--;
    }
  }

  let touched = 0;
  for (const t of tools) {
    if (!t.editable) continue;
    const pair = isPairPage(t.url);
    const items = relBlock(t.url, pair ? gen.get(t.url).slice().sort(convCmp) : gen.get(t.url), byUrl);
    const src = html.get(t.url);
    const m = REL_SECTION.exec(src);
    let next;

    if (m) {
      const above = m[1].split(REL_MARK)[0];
      const inner = (pair ? sortCurated(above) : above) + (items ? REL_MARK + items : '');
      next = src.slice(0, m.index) +
        `<section class="panel"><h2>Related tools</h2><ul class="related">${inner}</ul></section>` +
        src.slice(m.index + m[0].length);
    } else {
      if (!items) continue;
      const at = src.indexOf('</article>');
      if (at === -1) throw new Error('no </article> to insert before in ' + t.url);
      next = src.slice(0, at) +
        `<section class="panel"><h2>Related tools</h2><ul class="related">${REL_MARK}${items}</ul></section>\n` +
        src.slice(at);
    }

    if (next !== src) {
      touched++;
      changes.push('update ' + fileOf(t.url));
      if (!CHECK) fs.writeFileSync(path.join(ROOT, fileOf(t.url)), next);
    }
  }

  const stranded = tools.filter((t) => inbound.get(t.url) < REL_MIN_INBOUND);
  const thin = tools.filter((t) => t.editable &&
    curated.get(t.url).length + gen.get(t.url).length < REL_TARGET);
  return { touched, created, injected, stranded, thin, tools: tools.length };
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

/* ------------------------------------------------------------------ */
/* footer note                                                        */
/* ------------------------------------------------------------------ */

/**
 * Every page's footer says, under "About these tools.", the sentence below.
 * It is true of the calculators, converters and file tools, and it is false
 * wherever a page sends what is typed into it: the AI tools, the forms, the
 * account pages. Those pages say what they actually do instead, and this is
 * the one place that decides what each says.
 *
 * The sentence is hand-copied into every page and into the shells that a
 * dozen generators clone (business/index.html is the shell of the tools,
 * guides, compare, collections and showcase pages), so the default stays
 * exactly as it is and a page's own wording sits in a marked block:
 *
 *   replace   <!--foot:KIND-->wording<!--/foot-->       instead of the sentence
 *   append    sentence<!--foot:KIND--> wording<!--/foot-->   after it
 *
 * The hubs with a tool request form append rather than replace, so the
 * sentence build-showcase.js looks for (its FOOT_FROM) is still there in a
 * cloned tail and its own qualification still lands. footerApply() undoes
 * any block first and then writes the one the page calls for, so its output
 * depends only on the page: a block cloned onto a page without that form
 * (a guide, the showcase) is taken off again, and a second run writes
 * nothing. /showcase/ is never given a block — its wording is
 * build-showcase.js's.
 *
 * What each page says is read from the code that does it: the AI pages from
 * engine/ai-tools*.js (which tools send a picture) and the page's own
 * AI_LIMITS (the free allowance); the backend that stores only a monthly
 * count of calls and the tools used, never the text or the answer, is
 * 1234tools-backend/functions/index.js (aiComplete, submitToolRequest).
 */
const FOOT_DEFAULT = 'Every calculation runs inside your browser — no figures are sent to a server, and nothing you type is stored or logged.';
const FOOT_RE = /<!--foot:([a-z-]+)-->[\s\S]*?<!--\/foot-->/g;
const FOOT_PRIVACY = 'as the <a href="/privacy/">privacy policy</a> explains';
const FOOT_LOCAL = 'The calculators, converters and file tools on 1234Tools run inside your browser.';
/* kinds written after the sentence rather than in its place */
const FOOT_APPEND = new Set(['request']);

/* The line under the logo ("… built by MVR IT Services and running entirely
   in your browser.") is true everywhere except the AI pages, so there it is
   qualified the same way, in its own marked block:
     <!--about:KIND-->qualified ending<!--/about-->   instead of ABOUT_DEFAULT */
const ABOUT_DEFAULT = 'and running entirely in your browser.';
const ABOUT_RE = /<!--about:([a-z-]+)-->[\s\S]*?<!--\/about-->/g;
const ABOUT = {
  'ai': 'and running in your browser — except this AI tool, which sends what you give it to Anthropic’s API when you press its button, as the note below explains.',
  'ai-hub': 'and running in your browser — except the AI tools in this section, which send what you give them to Anthropic’s API when you press their buttons, as the note below explains.'
};

/** The about line qualified for `kind`, on a page with no about block left. */
function aboutApply(html, kind) {
  const text = ABOUT[kind];
  if (!text) return html;
  const about = html.indexOf('<div class="footer-about">');
  const at = about === -1 ? -1 : html.indexOf(ABOUT_DEFAULT, about);
  if (at === -1 || at > html.indexOf('</div>', about)) return html;
  return html.slice(0, at) + '<!--about:' + kind + '-->' + text + '<!--/about-->' + html.slice(at + ABOUT_DEFAULT.length);
}

let aiTools = null;
/** window.AI_TOOLS from engine/ai-tools*.js, read once, only if an AI page is seen. */
function aiToolSpecs() {
  if (aiTools) return aiTools;
  const box = { window: {} };
  box.window.window = box.window;
  const dir = path.join(ROOT, 'engine');
  for (const f of fs.readdirSync(dir).filter((n) => /^ai-tools.*\.js$/.test(n)).sort()) {
    vm.runInNewContext(fs.readFileSync(path.join(dir, f), 'utf8'), box, { filename: f });
  }
  aiTools = box.window.AI_TOOLS || {};
  return aiTools;
}

/** The free monthly allowance the page itself enforces (render-ai.js reads
    window.AI_LIMITS, and falls back to its own default). */
function aiFreeCalls(html) {
  const m = /window\.AI_LIMITS=(\{[^}]*\})/.exec(html);
  if (m) { try { const n = JSON.parse(m[1]).free; if (n > 0) return n; } catch (e) { /* fall through */ } }
  const d = /free:\s*(\d+)/.exec(fs.readFileSync(path.join(ROOT, 'engine', 'render-ai.js'), 'utf8'));
  if (!d) throw new Error('build-site.js: no free AI allowance on the page or in engine/render-ai.js');
  return Number(d[1]);
}

/** { kind, text } for a page that must not carry the default sentence alone, or null. */
function footKind(html, rel) {
  if (rel.startsWith('showcase/')) return null;   /* build-showcase.js words its own */

  if (rel === 'ai/index.html') {
    const free = aiFreeCalls(html);
    return { kind: 'ai-hub', text: FOOT_LOCAL + ' The AI tools in this section are the exception: when you press a tool’s button, the text you give it — on the scan readers, the photo or scan, resized on your device — is sent through our server to Anthropic’s API, which writes the answer, and each page shows exactly what will be sent before anything goes. They need a free account, which includes ' + free + ' AI calls a month; we keep a monthly count of your calls and which tools made them, not what you sent or what came back. The tool request form on this page sends what you type in it to us when you press “Send the request”, ' + FOOT_PRIVACY + '.' };
  }

  const ai = /^ai\/([^/]+)\/index\.html$/.exec(rel);
  if (ai && html.includes('/engine/render-ai.js')) {
    const t = /data-tool="([^"]+)"/.exec(html);
    const spec = aiToolSpecs()[t ? t[1] : ai[1]];
    if (!spec) throw new Error('build-site.js: ' + rel + ' mounts an AI tool that engine/ai-tools*.js does not define');
    const inputs = spec.inputs || [];
    const what = inputs.some((i) => i.type === 'image')
      ? 'the photo or scan you give it, resized on your device, and any notes you add are sent through our server to Anthropic’s API, which writes the answer'
      : 'the text you give it is sent through our server to Anthropic’s API, which writes the answer' +
        (inputs.some((i) => i.type === 'text+file') ? '; a file you add is read on your device and only its text goes' : '');
    return { kind: 'ai', text: FOOT_LOCAL + ' This AI tool is the exception: when you press its button, ' + what + '. The page shows exactly what will be sent before anything goes. It needs a free account, which includes ' + aiFreeCalls(html) + ' AI calls a month. We keep a monthly count of your calls and which tools made them, not what you sent or what came back, ' + FOOT_PRIVACY + '.' };
  }

  if (/<form\b[^>]*\baction="https:\/\/formsubmit\.co\//.test(html)) {
    return { kind: 'contact', text: FOOT_LOCAL + ' This page is the exception: the form above sends your name, email address and message to our inbox through FormSubmit.co when you press Send message, ' + FOOT_PRIVACY + '.' };
  }
  if (rel === 'account/index.html') {
    return { kind: 'account', text: 'The calculators, converters and file tools on 1234Tools run inside your browser and need no account. This page is different: creating an account or signing in goes through Firebase Authentication, Google’s sign-in service, and the account keeps your email address, your plan, a monthly count of AI calls and any settings you choose to keep with it, ' + FOOT_PRIVACY + '.' };
  }
  if (rel === 'settings/index.html') {
    return { kind: 'settings', text: FOOT_LOCAL + ' The preferences on this page are saved in this browser; if you press “Keep them with my account”, they are also stored with your account so they follow you to your other devices, ' + FOOT_PRIVACY + '.' };
  }
  if (rel === 'pricing/index.html') {
    return { kind: 'pricing', text: 'The calculators, converters and file tools on 1234Tools run inside your browser and stay free without an account. Buying a plan or credits on this page needs an account, and the payment is taken by Razorpay or Stripe: we receive confirmation that it was paid, never your card details, ' + FOOT_PRIVACY + '.' };
  }
  if (html.includes('src="/assets/practice.js"')) {
    return { kind: 'practice', text: 'This is the practice workspace, not one of the browser tools: the client details you enter and the documents you upload are stored in our Firebase project in London (europe-west2), so that your practice and your clients can see them. ' + FOOT_LOCAL };
  }
  if (/data-endpoint="[^"]*\/submitToolRequest"/.test(html)) {
    return { kind: 'request', text: 'The one exception on this page is the tool request form: what you type into it is sent to us when you press “Send the request”, and kept until the request is dealt with, ' + FOOT_PRIVACY + '.' };
  }
  return null;
}

/**
 * The page with its footer note worded for what the page does. Pure, and a
 * fixed point: footerApply(footerApply(h, r), r) === footerApply(h, r).
 * A page whose note no longer carries the default sentence (the showcase,
 * or one edited by hand) is left as it is, apart from removing any block
 * (an AI page still has its about line qualified).
 */
function footerApply(html, rel) {
  const bare = html.replace(FOOT_RE, (m, kind) => (FOOT_APPEND.has(kind) ? '' : FOOT_DEFAULT))
    .replace(ABOUT_RE, ABOUT_DEFAULT);
  const want = footKind(bare, rel);
  if (!want) return bare;
  const note = bare.indexOf('<div class="footer-note">');
  const at = note === -1 ? -1 : bare.indexOf(FOOT_DEFAULT, note);
  if (at === -1) return aboutApply(bare, want.kind);
  const block = '<!--foot:' + want.kind + '-->' + (FOOT_APPEND.has(want.kind) ? ' ' : '') + want.text + '<!--/foot-->';
  const end = at + FOOT_DEFAULT.length;
  return aboutApply(FOOT_APPEND.has(want.kind)
    ? bare.slice(0, end) + block + bare.slice(end)
    : bare.slice(0, at) + block + bare.slice(end), want.kind);
}

function patchPages() {
  const list = pages();
  let fonts = 0, analytics = 0, footers = 0, skipped = [], unworded = [];

  for (const abs of list) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const before = fs.readFileSync(abs, 'utf8');
    if (isRedirect(before)) continue;
    let html = before;
    const p = prefixOf();

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

    const withFooter = footerApply(html, rel);
    if (withFooter !== html) { html = withFooter; footers++; }
    if (!/<!--foot:[a-z-]+-->/.test(html) && footKind(html, rel)) unworded.push(rel);

    if (html !== before) {
      changes.push('update ' + rel);
      if (!CHECK) fs.writeFileSync(abs, html);
    }
  }
  return { total: list.length, fonts, analytics, footers, skipped, unworded };
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

/**
 * Refuse to run over somebody else's unfinished work.
 *
 * This script patches every page on the site, and eight unpublished PDF tool
 * drafts currently sit in the working tree as untracked HTML alongside edits
 * to twenty tracked pages. Running here puts generated blocks back into files
 * whose author had taken them out and rewrites their related-tool lists —
 * changes git cannot undo, because the work was never committed.
 *
 * It found this out the hard way: a require() of this file for one helper
 * executed main() as a side effect and rewrote 42 files. Hence both halves
 * of the guard — the check below, and main() no longer running on import.
 *
 * To run it anyway, commit or stash the drafts first, or pass --force if you
 * are certain. Preferably neither: export HEAD and run it there.
 */
function refuseIfDraftsPresent() {
  if (process.argv.includes('--force')) return;
  let drafts = [];
  try {
    drafts = require('child_process')
      .execFileSync('git', ['ls-files', '--others', '--exclude-standard'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n').map((f) => f.trim())
      .filter((f) => f.endsWith('.html'));
  } catch (e) { return; }   /* no git: nothing to protect */
  if (!drafts.length) return;

  console.error([
    '',
    'build-site.js refuses to run: the working tree has unpublished pages.',
    '',
    '  ' + drafts.length + ' untracked HTML file(s), starting with:',
    ...drafts.slice(0, 6).map((f) => '      ' + f),
    drafts.length > 6 ? '      … and ' + (drafts.length - 6) + ' more' : '',
    '',
    '  This script rewrites every page on the site, including those, and the',
    '  changes are not recoverable because the files are not committed.',
    '',
    '  Do this instead:',
    '      git archive HEAD | tar -x -C /tmp/site && cd /tmp/site && node build-site.js',
    '',
    '  Or commit the drafts first. --force overrides, and means it.',
    ''
  ].filter((l) => l !== '').join('\n'));
  process.exit(1);
}

function main() {
  refuseIfDraftsPresent();
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
  /* Both of these run after the service worker deliberately. The sitemap is for
     crawlers, and related links are page content, which sw.js serves
     network-first — neither is part of the cached shell, so neither should
     invalidate it for every returning visitor. */
  const map = buildSitemap();
  const rel = patchRelated();
  const pop = buildPopular();

  console.log(`  pages scanned       ${page.total}`);
  console.log(`  font block          ${page.fonts} ${CHECK ? 'would be' : ''} patched`);
  console.log(`  analytics block     ${page.analytics} ${CHECK ? 'would be' : ''} patched`);
  console.log(`  footer note         ${page.footers} ${CHECK ? 'would be' : ''} reworded`);
  if (page.unworded.length) {
    console.log(`  ! ${page.unworded.length} page(s) send what is typed but their footer note has no default sentence to reword:`);
    page.unworded.slice(0, 5).forEach((s) => console.log('      ' + s));
  }
  console.log(`  app.css             ${css}`);
  if (sw) console.log(`  service worker      ${sw}`);
  console.log(`  sitemap             ${map.count} URLs, ` +
              (map.changed ? (CHECK ? 'would be rewritten' : 'rewritten') : 'unchanged'));
  if (map.noindex.length) {
    console.log(`  noindex             ${map.noindex.length} page(s) left out on purpose: ` +
                map.noindex.map(publicUrl).join(' '));
  }
  console.log(`  popular block       ${pop}`);
  console.log(`  related tools       ${rel.touched} of ${rel.tools} page(s) ` +
              `${CHECK ? 'would be' : ''} updated, ${rel.created} list(s) created, ` +
              `${rel.injected} link(s) added for reachability`);
  if (rel.stranded.length) {
    console.log(`  ! ${rel.stranded.length} tool(s) still under ${REL_MIN_INBOUND} inbound link(s):`);
    rel.stranded.slice(0, 5).forEach((t) => console.log('      ' + t.url));
    if (rel.stranded.length > 5) console.log(`      … +${rel.stranded.length - 5}`);
  }
  if (rel.thin.length) {
    console.log(`  ! ${rel.thin.length} page(s) still under ${REL_TARGET} link(s) — ` +
                `too few similar tools exist`);
  }
  if (map.unclaimed.length) {
    console.log(`  ! ${map.unclaimed.length} page(s) matched no known group — ` +
                `listed at the end of the sitemap, but SECTIONS, META_PAGES or READING wants extending:`);
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

/* Only when run, never when required. `node build-site.js` still works;
   require('./build-site.js') for a helper no longer rebuilds the site. */
if (require.main === module) {
  try { main(); }
  catch (e) { console.error('\nbuild-site.js failed: ' + (e && e.message || e) + '\n'); process.exit(1); }
}

module.exports = { searchIndexTools, SECTIONS, META_PAGES, footerApply, footKind, FOOT_DEFAULT };
