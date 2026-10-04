'use strict';
/**
 * Opportunity finder: live questions a tool answers, from read-only public search APIs.
 *
 *   Reddit          https://www.reddit.com/r/<sub>/search.json?q=…&restrict_sr=1&sort=new&t=month
 *                   (Reddit answers 403 to many networks; the same search as RSS is the fallback)
 *   Hacker News     https://hn.algolia.com/api/v1/search_by_date?query=…&tags=story
 *   Stack Exchange  https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&q=…&site=<site>&accepted=False
 *
 * Polite: one request per second, a descriptive User-Agent, every response cached
 * for 30 minutes in <PROMO_HOME>/cache. Nothing is ever posted; results are links
 * the owner opens and answers by hand.
 *
 *   find({ tool: '/pdf/merge-pdf/' })  or  find({ audience: 'accountants' })
 *     -> { items: [{venueId, title, url, created, score, comments, matchScore, suggestedTemplate, ...}], queries, errors }
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const T = require('./tools');
const V = require('./venues');
const L = require('./log');

const UA = process.env.PROMO_UA || '1234Tools-promo-desk/1.0 (contact@xleshop.com)';
const TTL = 30 * 60 * 1000;
const GAP = 1000;
const DAY = 86400000;
/* Off-limits communities (venues.json excluded): never surface threads from them. */
const BLOCKED_SUBS = ['privacy', 'privacyguides', 'degoogle'];
const STOP = new Set('a an and are as at be by for from how i in is it of on or the to with what which my your can do does any free online tool tools calculator generator converter app best way'.split(' '));

/* ------------------------------------------------------------- fetching */

/* At most one request a second overall; Reddit's anonymous limit is about ten a
   minute, so its requests are spaced further apart. */
const HOST_GAP = { 'www.reddit.com': 6500 };
const lastByHost = {};
let lastAt = 0;
let chain = Promise.resolve();
function throttle(url) {
  const host = (() => { try { return new URL(url).host; } catch (e) { return ''; } })();
  const p = chain.then(async () => {
    const wait = Math.max(lastAt + GAP, (lastByHost[host] || 0) + (HOST_GAP[host] || GAP)) - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    lastByHost[host] = lastAt;
  });
  chain = p.catch(() => {});
  return p;
}
let redditBackoffUntil = 0;
let redditNextAt = 0;

function cacheDir() { return path.join(L.home(), 'cache'); }
function cacheGet(url) {
  try {
    const f = path.join(cacheDir(), crypto.createHash('sha1').update(url).digest('hex') + '.json');
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (Date.now() - j.at < TTL) return j;
  } catch (e) { /* miss */ }
  return null;
}
function cachePut(url, rec) {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    const f = path.join(cacheDir(), crypto.createHash('sha1').update(url).digest('hex') + '.json');
    fs.writeFileSync(f, JSON.stringify(Object.assign({ at: Date.now(), url }, rec)));
  } catch (e) { /* cache is best-effort */ }
}

/** GET with cache + throttle. Returns { status, type, body, cached }. */
async function get(url, opts) {
  opts = opts || {};
  if (!opts.fresh) { const c = cacheGet(url); if (c) return Object.assign({ cached: true }, c); }
  await throttle(url);
  if (/reddit\.com/.test(url) && Date.now() < redditNextAt) await new Promise((r) => setTimeout(r, redditNextAt - Date.now()));
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: opts.accept || 'application/json' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  const body = await res.text();
  const rec = { status: res.status, type: res.headers.get('content-type') || '', body };
  // Reddit says how much quota is left and when it resets: honour it
  const left = parseFloat(res.headers.get('x-ratelimit-remaining'));
  const reset = parseFloat(res.headers.get('x-ratelimit-reset'));
  if (/reddit\.com/.test(url) && !isNaN(reset)) {
    rec.reset = reset;
    if (res.status === 429 || (!isNaN(left) && left < 1)) redditNextAt = Date.now() + (reset + 1) * 1000;
  }
  if (res.status === 200) cachePut(url, rec);
  return Object.assign({ cached: false }, rec);
}

/* -------------------------------------------------------------- parsers */

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
/* Feed content is HTML escaped inside XML: unescape, drop tags and comments, unescape again. */
function stripTags(s) {
  return decodeEntities(decodeEntities(String(s || '')).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function isQuestion(title, body) {
  const t = String(title || '').trim();
  if (/\?/.test(t)) return true;
  if (/^(ask hn|how|what|which|why|where|when|is there|are there|any |anyone|can |could |should |does |do |need|looking for|recommend|help|best way|alternative|tool for|free tool|is it possible|struggling|advice)/i.test(t)) return true;
  if (body && /\?\s*$/.test(String(body).trim().split('\n')[0] || '')) return true;
  return false;
}

/** Reddit listing JSON (search.json). */
function parseRedditJson(json, venue) {
  const j = typeof json === 'string' ? JSON.parse(json) : json;
  const kids = (j && j.data && j.data.children) || [];
  return kids.map((k) => k.data || {}).filter((d) => d.title).map((d) => ({
    venueId: venue.id, source: 'reddit',
    title: decodeEntities(d.title), url: 'https://www.reddit.com' + (d.permalink || ''),
    created: new Date((d.created_utc || 0) * 1000).toISOString(),
    score: d.score != null ? d.score : null, comments: d.num_comments != null ? d.num_comments : null,
    author: d.author || '', sub: d.subreddit || '', body: String(d.selftext || '').slice(0, 600),
    archived: !!d.archived, locked: !!d.locked, closed: false, stickied: !!d.stickied,
  }));
}

/** Reddit search RSS (Atom). No score or comment count in the feed. */
function parseRedditRss(xml, venue) {
  const out = [];
  for (const m of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const pick = (re) => { const x = e.match(re); return x ? x[1] : ''; };
    const title = decodeEntities(pick(/<title>([\s\S]*?)<\/title>/));
    const url = decodeEntities(pick(/<link[^>]*href="([^"]+)"/));
    const created = pick(/<published>([^<]+)<\/published>/) || pick(/<updated>([^<]+)<\/updated>/);
    const author = stripTags(pick(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/)).replace(/^\/?u\//, '');
    const sub = pick(/<category[^>]*term="([^"]+)"/);
    const body = stripTags(pick(/<content[^>]*>([\s\S]*?)<\/content>/)).replace(/submitted by \/u\/\S+.*$/i, '').slice(0, 600);
    if (!title || !url) continue;
    out.push({
      venueId: venue.id, source: 'reddit-rss', title, url, created: created ? new Date(created).toISOString() : '',
      score: null, comments: null, author, sub, body, archived: false, locked: false, closed: false, stickied: false,
    });
  }
  return out;
}

/** Algolia HN search(_by_date). */
function parseHn(json, venue) {
  const j = typeof json === 'string' ? JSON.parse(json) : json;
  return ((j && j.hits) || []).filter((h) => h.title || h.story_title).map((h) => ({
    venueId: venue.id, source: 'hn',
    title: decodeEntities(h.title || h.story_title), url: 'https://news.ycombinator.com/item?id=' + h.objectID,
    link: h.url || '', created: h.created_at || new Date((h.created_at_i || 0) * 1000).toISOString(),
    score: h.points != null ? h.points : null, comments: h.num_comments != null ? h.num_comments : null,
    author: h.author || '', body: stripTags(h.story_text || '').slice(0, 600),
    archived: false, locked: false, closed: false, stickied: false,
  }));
}

/** Stack Exchange /search/advanced. */
function parseSe(json, venue) {
  const j = typeof json === 'string' ? JSON.parse(json) : json;
  return ((j && j.items) || []).map((q) => ({
    venueId: venue.id, source: 'stackexchange',
    title: decodeEntities(q.title), url: q.link, created: new Date((q.creation_date || 0) * 1000).toISOString(),
    score: q.score != null ? q.score : null, comments: q.answer_count != null ? q.answer_count : null,
    author: (q.owner && q.owner.display_name) ? decodeEntities(q.owner.display_name) : '', tags: q.tags || [],
    body: '', archived: false, locked: !!q.locked_date, closed: !!q.closed_date, stickied: false, answered: !!q.is_answered,
  }));
}

/* -------------------------------------------------------------- queries */

function apiKind(v) {
  const a = v.apiSearch || '';
  if (/reddit\.com\/r\/[^/]+\/search\.json/.test(a)) return 'reddit';
  if (/hn\.algolia\.com/.test(a)) return 'hn';
  if (/api\.stackexchange\.com/.test(a)) return 'se';
  return '';
}

function apiUrl(v, q) {
  const k = apiKind(v);
  const e = encodeURIComponent(q);
  if (k === 'reddit') {
    const sub = v.apiSearch.match(/reddit\.com\/r\/([^/]+)\//)[1];
    return `https://www.reddit.com/r/${sub}/search.json?q=${e}&restrict_sr=1&sort=new&t=month`;
  }
  if (k === 'hn') return `https://hn.algolia.com/api/v1/search_by_date?query=${e}&tags=story`;
  if (k === 'se') {
    const site = (v.apiSearch.match(/[?&]site=([^&]+)/) || [])[1] || 'superuser';
    return `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&q=${e}&site=${site}&accepted=False`;
  }
  return '';
}

function tokens(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9₹£%+.-]+/g, ' ').split(' ').filter((w) => w.length > 1 && !STOP.has(w));
}

/** Search phrases for a tool: its keywords, then a title phrase. */
function queriesFor(rec, max) {
  const out = [];
  const add = (q) => { q = String(q || '').trim().toLowerCase(); if (q && !out.includes(q)) out.push(q); };
  for (const k of rec.keywords.slice(0, 3)) add(k);
  add(rec.title.replace(/\(.*?\)/g, '').replace(/\b(calculator|generator|converter|tool|maker|online)\b/gi, '').replace(/\s+/g, ' '));
  return out.slice(0, max || 2);
}

function matchScore(item, qs, rec) {
  const title = item.title.toLowerCase();
  const body = (item.body || '').toLowerCase();
  let best = 0;
  for (const q of qs) {
    const tk = tokens(q);
    if (!tk.length) continue;
    const inT = tk.filter((w) => title.includes(w)).length / tk.length;
    const inB = tk.filter((w) => body.includes(w)).length / tk.length;
    let s = inT * 0.6 + inB * 0.2;
    if (title.includes(q)) s += 0.25;
    best = Math.max(best, s);
  }
  if (rec) {
    const io = tokens(rec.io + ' ' + rec.title);
    if (io.length) best += 0.1 * io.filter((w) => title.includes(w)).length / io.length;
  }
  if (item.isQuestion) best += 0.1;
  const ageDays = (Date.now() - new Date(item.created)) / DAY;
  if (ageDays < 7) best += 0.05;
  return Math.round(Math.min(1, best) * 100);
}

function windowDays(kind) { return kind === 'hn' ? 2 : 30; }

function ownAccounts() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(L.home(), 'config.json'), 'utf8'));
    return Object.values(j.accounts || {}).map((x) => String(x).toLowerCase());
  } catch (e) { return []; }
}

/** Filter, score and shape raw items from one venue. */
function shape(items, v, qs, rec, kind, opts) {
  const own = ownAccounts();
  const now = opts && opts.now ? new Date(opts.now) : new Date();
  const win = windowDays(kind) * DAY;
  const tmpl = kind === 'hn' ? 'hn-comment' : kind === 'se' ? 'stackexchange-answer' : (v.kind === 'reddit' ? 'reddit-comment' : v.template);
  const out = [];
  for (const it of items) {
    if (it.archived || it.locked || it.closed || it.stickied) continue;
    if (it.sub && BLOCKED_SUBS.includes(it.sub.toLowerCase())) continue;
    if (it.author && own.includes(it.author.toLowerCase())) continue;
    if (!opts.keepOld && now - new Date(it.created) > win) continue;
    it.isQuestion = isQuestion(it.title, it.body);
    if (!it.isQuestion && !(opts && opts.all)) continue;
    it.matchScore = matchScore(it, qs, rec);
    it.suggestedTemplate = tmpl;
    it.venueName = v.name;
    out.push(it);
  }
  return out;
}

/* Once Reddit has refused JSON from this network, go straight to RSS for six hours. */
function jsonBlockedFile() { return path.join(cacheDir(), 'reddit-json-blocked'); }
function redditJsonBlocked() {
  try { return Date.now() - fs.statSync(jsonBlockedFile()).mtimeMs < 6 * 3600 * 1000; } catch (e) { return false; }
}
function markRedditJsonBlocked() {
  try { fs.mkdirSync(cacheDir(), { recursive: true }); fs.writeFileSync(jsonBlockedFile(), new Date().toISOString()); } catch (e) { /* best-effort */ }
}

async function searchVenue(v, q, rec, opts) {
  const kind = apiKind(v);
  const url = apiUrl(v, q);
  if (!url) return { items: [], error: null };
  try {
    if (kind === 'reddit') {
      if (Date.now() < redditBackoffUntil) return { items: [], error: v.id + ': Reddit asked us to slow down; try again in a minute' };
      let r = redditJsonBlocked() ? null : await get(url, opts);
      if (r && r.status === 200 && /json/.test(r.type)) return { items: parseRedditJson(r.body, v), url };
      if (r && r.status === 403) markRedditJsonBlocked();
      if (r && r.status === 429) { redditBackoffUntil = Date.now() + 60000; return { items: [], error: v.id + ': Reddit 429 (rate limited)' }; }
      const rss = url.replace('/search.json?', '/search.rss?');
      r = await get(rss, Object.assign({ accept: 'application/atom+xml' }, opts));
      if (r.status === 429 && r.reset != null && r.reset <= 65) {
        // wait out the window once (get() already scheduled the wait), then try again
        r = await get(rss, Object.assign({ accept: 'application/atom+xml', fresh: true }, opts));
      }
      if (r.status === 429) { redditBackoffUntil = Date.now() + 60000; return { items: [], error: v.id + ': Reddit 429 (rate limited)' }; }
      if (r.status !== 200) return { items: [], error: v.id + ': Reddit ' + r.status };
      return { items: parseRedditRss(r.body, v), via: 'rss', url: rss };
    }
    const r = await get(url, opts);
    if (r.status !== 200) return { items: [], error: v.id + ': HTTP ' + r.status };
    const items = kind === 'reddit' ? parseRedditJson(r.body, v) : kind === 'hn' ? parseHn(r.body, v) : parseSe(r.body, v);
    return { items, url };
  } catch (e) {
    return { items: [], error: v.id + ': ' + (e.message || e) };
  }
}

/**
 * opts: { tool, audience, maxVenues (default 6), maxQueries (default 2), fresh, all, keepOld }
 */
async function find(opts) {
  opts = opts || {};
  let rec = null;
  let qs = [];
  let ranked = [];
  if (opts.tool) {
    rec = T.record(opts.tool);
    qs = queriesFor(rec, opts.maxQueries || 2);
    ranked = V.fit(rec.path, { noLog: true });
  } else if (opts.audience) {
    const tags = V.audienceTags(opts.audience);
    ranked = V.fitAudience(opts.audience, { noLog: true });
    const tools = T.listTools().filter((r) => r.audiences.includes(opts.audience) || r.audienceTags.some((a) => tags.includes(a)));
    for (const r of tools.slice(0, 3)) { const k = r.keywords[0]; if (k && !qs.includes(k.toLowerCase())) qs.push(k.toLowerCase()); }
    qs = qs.slice(0, opts.maxQueries || 3);
  } else {
    throw new Error('find needs a tool or an audience');
  }
  // Reddit's anonymous quota is small: at most maxReddit subreddits per search (default 3)
  const maxReddit = opts.maxReddit || 3;
  let nReddit = 0;
  const venues = ranked.map((x) => V.get(x.id)).filter((v) => apiKind(v)).filter((v) => apiKind(v) !== 'reddit' || ++nReddit <= maxReddit).slice(0, opts.maxVenues || 6);
  const items = [];
  const errors = [];
  const seen = new Set();
  const via = {};
  for (const v of venues) {
    // Reddit takes OR, so one request per subreddit; the others get one per phrase.
    const perVenue = apiKind(v) === 'reddit' ? [qs.map((q) => (/\s/.test(q) ? '"' + q + '"' : q)).join(' OR ')] : qs;
    for (const q of perVenue) {
      const r = await searchVenue(v, q, rec, opts);
      if (r.error) errors.push(r.error);
      if (r.via) via[v.id] = r.via;
      for (const it of shape(r.items, v, qs, rec, apiKind(v), opts)) {
        if (seen.has(it.url)) continue;
        seen.add(it.url);
        items.push(it);
      }
    }
  }
  items.sort((a, b) => Math.round(b.matchScore / 10) - Math.round(a.matchScore / 10) || new Date(b.created) - new Date(a.created));
  return { tool: rec ? rec.path : null, audience: opts.audience || null, queries: qs, venues: venues.map((v) => v.id), via, items, errors };
}

module.exports = { find, parseRedditJson, parseRedditRss, parseHn, parseSe, isQuestion, queriesFor, apiUrl, apiKind, matchScore, shape, UA };

/* `node build/promo/find.js fixtures` saves one real response per API to fixtures/. */
if (require.main === module && process.argv[2] === 'fixtures') {
  (async () => {
    const dir = path.join(__dirname, 'fixtures');
    fs.mkdirSync(dir, { recursive: true });
    const jobs = [
      ['reddit-search.json', 'https://www.reddit.com/r/smallbusiness/search.json?q=invoice&restrict_sr=1&sort=new&t=month'],
      ['reddit-search.rss', 'https://www.reddit.com/r/smallbusiness/search.rss?q=invoice&restrict_sr=1&sort=new&t=month'],
      ['hn-search-by-date.json', 'https://hn.algolia.com/api/v1/search_by_date?query=pdf&tags=story'],
      ['se-search-advanced.json', 'https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&q=merge%20pdf&site=superuser&accepted=False'],
    ];
    for (const [name, url] of jobs) {
      const r = await get(url, { fresh: true, accept: name.endsWith('.rss') ? 'application/atom+xml' : 'application/json' });
      const ok = r.status === 200;
      // a refusal page is kept only as a short sample (it is not data)
      fs.writeFileSync(path.join(dir, ok ? name : name + '.' + r.status + '.txt'), ok ? r.body : r.body.slice(0, 1500));
      console.log(name, r.status, r.type, r.body.length, 'bytes');
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
