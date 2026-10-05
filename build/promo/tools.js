'use strict';
/**
 * Tool records for the Promotion Desk.
 *
 * Reads the site's own data (assets/finder-index.js, assets/search-index.js,
 * build/jobs.js, build/collections.js, build/sections.js, guides/ and compare/)
 * and builds one record per tool. Inert on require: nothing is read until a
 * function is called, and everything read is cached for the process.
 *
 *   record('/pdf/merge-pdf/')        -> { title, path, url, cleanUrl, section, ... }
 *   utmUrl('/pdf/merge-pdf/', 'x', 'social')
 *   listTools()                      -> the 232 finder tools as records
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ORIGIN = 'https://www.1234tools.com';
const HOST = '1234tools.com';

/* Collection slug -> venue audience tags (venues.json uses a coarser vocabulary). */
const AUDIENCE_TAGS = {
  'accountants': ['accountants'],
  'small-business': ['smallbiz'],
  'schools': ['teachers'],
  'hr-payroll': ['hr-payroll'],
  'freelancers': ['freelancers'],
  'developers': ['developers'],
  'month-end': ['accountants', 'smallbiz'],
  'get-paid': ['smallbiz', 'freelancers'],
  'going-digital': ['smallbiz', 'accountants', 'uk'],
  'start-of-term': ['teachers'],
  'shopkeepers': ['smallbiz', 'india'],
  'landlords': ['landlords'],
  'students': ['students'],
  'marketers': ['marketers'],
  'year-end': ['accountants', 'smallbiz'],
  'going-paperless': ['productivity', 'smallbiz'],
  'creators': ['creators'],
  'online-sellers': ['smallbiz', 'creators'],
  'job-seekers': ['general', 'students'],
  'teachers': ['teachers'],
  'photographers': ['creators'],
  'designers': ['designers'],
};

/* Section -> venue audience tags, so a tool in no collection still matches. */
const SECTION_TAGS = {
  business: ['smallbiz'], ai: ['smallbiz', 'productivity'], pdf: ['productivity', 'smallbiz'],
  education: ['teachers', 'students'], india: ['india'], developer: ['developers'],
  image: ['creators', 'designers'], 'ai-image': ['creators', 'designers'], 'ai-video': ['creators'],
  text: ['productivity', 'students'], mathematics: ['students', 'maths-education'],
  finance: ['personal-finance'], time: ['productivity'], health: ['health-fitness'],
  qr: ['smallbiz'], utilities: ['general', 'productivity'], engineering: ['engineering'],
  design: ['designers'], conversions: ['general', 'students'],
};

const MEDIA_SECTIONS = ['pdf', 'image', 'ai-image', 'ai-video'];

let cache = null;

/** Evaluate one of the site's window.X = ... index files. */
function readWindowFile(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const w = {};
  // eslint-disable-next-line no-new-func
  new Function('window', src)(w);
  return w;
}

function safeRequire(rel) {
  try { return require(path.join(ROOT, rel)); } catch (e) { return null; }
}

/** '/pdf/merge-pdf/' whatever form it came in. */
function normPath(p) {
  let s = String(p || '').trim();
  if (!s) return '';
  // Git Bash turns "/pdf/merge-pdf/" into "C:/Program Files/Git/pdf/merge-pdf/": cut back to the section.
  if (/^[A-Za-z]:[\\/]/.test(s)) {
    const parts = s.replace(/\\/g, '/').split('/');
    const i = parts.findIndex((x, k) => k > 0 && Object.prototype.hasOwnProperty.call(SECTION_TAGS, x));
    if (i > 0) s = '/' + parts.slice(i).join('/');
  }
  s = s.replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '');
  if (s[0] !== '/') s = '/' + s;
  if (s[s.length - 1] !== '/') s += '/';
  return s.replace(/\/{2,}/g, '/');
}

function slugOf(p) {
  const parts = normPath(p).split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function sectionSlugOf(p) {
  return normPath(p).split('/').filter(Boolean)[0] || '';
}

function load() {
  if (cache) return cache;
  const finder = readWindowFile('assets/finder-index.js').FINDER_INDEX;
  const search = readWindowFile('assets/search-index.js').SEARCH_INDEX;
  const jobs = safeRequire('build/jobs.js');
  const coll = safeRequire('build/collections.js');
  const secs = safeRequire('build/sections.js');

  const finderRows = new Map();
  for (const row of finder.tools) finderRows.set(normPath(row[1]), row);
  const searchRows = new Map();
  for (const row of search) searchRows.set(normPath(row[1]), row);

  // path -> [collection slug]
  const audiences = new Map();
  const collections = [];
  if (coll && Array.isArray(coll.COLLECTIONS)) {
    for (const c of coll.COLLECTIONS) {
      const tools = [];
      for (const g of c.groups || []) for (const t of g.tools || []) tools.push(normPath(t));
      collections.push({ slug: c.slug, name: c.name, kind: c.kind, tools });
      for (const t of tools) {
        if (!audiences.has(t)) audiences.set(t, []);
        if (!audiences.get(t).includes(c.slug)) audiences.get(t).push(c.slug);
      }
    }
  }

  // Guides and comparisons that link to a tool from their <main>.
  const related = { guides: new Map(), compare: new Map() };
  for (const kind of ['guides', 'compare']) {
    const dir = path.join(ROOT, kind);
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch (e) { names = []; }
    for (const name of names) {
      let html = '';
      try { html = fs.readFileSync(path.join(dir, name, 'index.html'), 'utf8'); } catch (e) { continue; }
      const m = html.match(/<main[\s\S]*?<\/main>/);
      const body = m ? m[0] : '';
      const page = '/' + kind + '/' + name + '/';
      for (const h of body.matchAll(/href="(\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)+)"/g)) {
        const t = normPath(h[1]);
        if (t === page) continue;
        if (!related[kind].has(t)) related[kind].set(t, []);
        if (!related[kind].get(t).includes(page)) related[kind].get(t).push(page);
      }
    }
  }

  const sectionNames = {};
  if (secs && secs.SECTIONS) {
    for (const [url, v] of Object.entries(secs.SECTIONS)) {
      if (url.split('/').filter(Boolean).length === 1) sectionNames[v.slug] = v.name;
    }
  }

  cache = {
    finder, search, jobs, coll, finderRows, searchRows, audiences, collections, related, sectionNames,
    count: search.length, records: new Map(),
  };
  return cache;
}

function toolCount() { return load().count; }

/** e.g. "1,281". */
function toolCountText() { return toolCount().toLocaleString('en-US'); }

function pricingOf(p) { return normPath(p).indexOf('/ai/') === 0 ? 'freemium' : 'free'; }

function cleanUrl(p) { return ORIGIN + normPath(p); }

/**
 * https://www.1234tools.com<path>?utm_source=<venueId>&utm_medium=<medium>
 *   &utm_campaign=<section slug>&utm_content=<tool slug>
 * extra: optional object of query params placed before the UTM ones (prefill).
 */
function utmUrl(toolPath, venueId, medium, extra) {
  const p = normPath(toolPath);
  const q = [];
  if (extra) for (const [k, v] of Object.entries(extra)) if (v != null && v !== '') q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
  q.push('utm_source=' + encodeURIComponent(venueId || 'promo'));
  q.push('utm_medium=' + encodeURIComponent(medium || 'social'));
  q.push('utm_campaign=' + encodeURIComponent(sectionSlugOf(p) || 'home'));
  q.push('utm_content=' + encodeURIComponent(slugOf(p) || 'home'));
  return ORIGIN + p + '?' + q.join('&');
}

function audienceTagsFor(rec) {
  const tags = new Set();
  for (const a of rec.audiences) for (const t of AUDIENCE_TAGS[a] || []) tags.add(t);
  for (const t of SECTION_TAGS[rec.section] || []) tags.add(t);
  const hay = (rec.title + ' ' + rec.description + ' ' + rec.keywords.join(' ')).toLowerCase();
  if (/\b(uk|hmrc|mtd|england|scotland|wales|national insurance|paye|£)/.test(hay)) tags.add('uk');
  if (/\b(india|gst|gstin|tally|₹|rupee|itr|epf|ctc|tds|hsn|pan card)\b/.test(hay)) tags.add('india');
  if (/\b(landlord|tenant|rent|property)\b/.test(hay)) tags.add('landlords');
  if (/\b(payroll|payslip|salary|employee|hr)\b/.test(hay)) tags.add('hr-payroll');
  return [...tags];
}

/** Build (and cache) the record for one tool path. Throws for an unknown path. */
function record(toolPath) {
  const d = load();
  const p = normPath(toolPath);
  if (d.records.has(p)) return d.records.get(p);
  const f = d.finderRows.get(p);
  const s = d.searchRows.get(p);
  if (!f && !s) throw new Error('Unknown tool path: ' + toolPath);
  const section = sectionSlugOf(p);
  const job = d.jobs && d.jobs.jobOf ? d.jobs.jobOf(p.slice(1)) : null;
  const desc = f ? f[4] : ((d.jobs && d.jobs.descOf && d.jobs.descOf(p.slice(1))) || '');
  const rec = {
    title: f ? f[0] : s[0],
    path: p,
    url: cleanUrl(p),
    cleanUrl: cleanUrl(p),
    slug: slugOf(p),
    section,
    sectionName: (f && f[3]) || d.sectionNames[section] || section,
    glyph: f ? f[2] : ('i-' + section),
    verb: (job && job.verb) || 'Make',
    io: (f && f[6]) || (job && job.io) || '',
    description: String(desc || '').trim(),
    keywords: f && f[5] ? f[5].split('|').map((k) => k.trim()).filter(Boolean) : [],
    prefill: f && f[7] ? f[7].split('|') : [],
    pricing: pricingOf(p),
    audiences: (d.audiences.get(p) || []).slice(),
    relatedGuides: (d.related.guides.get(p) || []).slice(),
    relatedCompare: (d.related.compare.get(p) || []).slice(),
    inFinder: !!f,
  };
  if (!rec.keywords.length) rec.keywords = [rec.title.toLowerCase()];
  rec.audienceTags = audienceTagsFor(rec);
  rec.media = MEDIA_SECTIONS.includes(section);
  d.records.set(p, rec);
  return rec;
}

/** The finder's tools (the curated 232), as records, in finder order. */
function listTools() {
  const d = load();
  return d.finder.tools.map((row) => record(row[1]));
}

/** Every page in the search index (1,281), as light rows. */
function listAll() {
  return load().search.map((row) => ({ title: row[0], path: normPath(row[1]) }));
}

function collections() { return load().collections.slice(); }

function sectionNames() { return Object.assign({}, load().sectionNames); }

/* Another site (site.js) answers with its own items: products, services or app
   features from build/promo/sites/<id>.js, shaped like tool records. 1234Tools,
   the default, is untouched. */
function other() { const S = require('./site'); return S.isDefault() ? null : S; }
const forSite = {
  record: (p) => { const S = other(); return S ? S.record(p) : record(p); },
  listTools: () => { const S = other(); return S ? S.listItems() : listTools(); },
  listAll: () => { const S = other(); return S ? S.listItems().map((r) => ({ title: r.title, path: r.path })) : listAll(); },
  collections: () => (other() ? [] : collections()),
  toolCount: () => { const S = other(); return S ? S.listItems().length : toolCount(); },
  toolCountText: () => { const S = other(); return S ? String(S.listItems().length) : toolCountText(); },
  cleanUrl: (p) => { const S = other(); return S ? S.current().baseUrl + S.normPath(p) : cleanUrl(p); },
  utmUrl: (p, venueId, medium, extra) => { const S = other(); return S ? S.utmUrl(p, venueId, medium) : utmUrl(p, venueId, medium, extra); },
  normPath: (p) => { const S = other(); return S ? S.normPath(p) : normPath(p); },
};

module.exports = {
  ROOT, ORIGIN, HOST, AUDIENCE_TAGS, SECTION_TAGS, MEDIA_SECTIONS,
  slugOf, sectionSlugOf, pricingOf, sectionNames,
  normPath: forSite.normPath, cleanUrl: forSite.cleanUrl, utmUrl: forSite.utmUrl,
  record: forSite.record, listTools: forSite.listTools, listAll: forSite.listAll, collections: forSite.collections,
  toolCount: forSite.toolCount, toolCountText: forSite.toolCountText,
};
