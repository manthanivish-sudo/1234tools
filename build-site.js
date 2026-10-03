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
 * number of links is filled.
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
    const items = relBlock(t.url, gen.get(t.url), byUrl);
    const src = html.get(t.url);
    const m = REL_SECTION.exec(src);
    let next;

    if (m) {
      const inner = m[1].split(REL_MARK)[0] + (items ? REL_MARK + items : '');
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

function patchPages() {
  const list = pages();
  let fonts = 0, analytics = 0, skipped = [];

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

module.exports = { searchIndexTools, SECTIONS, META_PAGES };
