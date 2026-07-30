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
  return searchIndexTools().map((t) => t.url);
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
  'image/image-compressor.html',
  'pdf/merge-pdf.html',
  'developer/json-formatter.html',
  'image/passport-photo.html',
  'developer/qr-code-generator.html',
  'business/currency-converter.html',
  'india/gst-calculator.html',
  'text/word-counter.html'
];

function buildPopular() {
  const rel = 'index.html';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const byUrl = new Map(searchIndexTools().map((t) => [t.url, t]));

  const card = (u) => {
    const t = byUrl.get(u);
    if (!t) throw new Error(`POPULAR lists a tool that is not in the search index: ${u}`);
    const page = fs.readFileSync(path.join(ROOT, u), 'utf8');
    const d = /<meta name="description" content="([^"]*)"/.exec(page);
    return `<a class="card" href="${u}">` +
      '<span class="card-icon"><svg class="ico" aria-hidden="true" focusable="false">' +
      `<use href="./assets/icons.svg#i-${t.id}"></use></svg></span>` +
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
    const seg = url.split('/');
    const slug = seg[seg.length - 1].replace(/\.html$/, '');
    return {
      title: String(e[0]),
      url,
      id: String(e[2] || ''),
      category: seg[0],
      /* conversions/<family>/<pair>.html — the family is a far stronger signal
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
  image:       ['design'],
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

/** Site-relative targets of the hand-written links, or null if there is no list. */
function curatedOf(html, pageUrl) {
  const m = REL_SECTION.exec(html);
  if (!m) return null;
  const dir = path.posix.dirname(pageUrl);
  return [...m[1].split(REL_MARK)[0].matchAll(/href="([^"]+)"/g)]
    .map((x) => path.posix.normalize(path.posix.join(dir, x[1])));
}

function relBlock(pageUrl, targets, byUrl) {
  const dir = path.posix.dirname(pageUrl);
  return targets.map((u) => {
    const href = path.posix.relative(dir, u);
    return `<li><a href="${href}">${esc(byUrl.get(u).title)}</a></li>`;
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
    const src = fs.readFileSync(path.join(ROOT, t.url), 'utf8');
    html.set(t.url, src);
    const c = curatedOf(src, t.url);
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
          const lead = u.split('/').pop().replace(/\.html$/, '').split('-to-')[0];
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
      changes.push('update ' + t.url);
      if (!CHECK) fs.writeFileSync(path.join(ROOT, t.url), next);
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
