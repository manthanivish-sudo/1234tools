'use strict';
/**
 * Site profiles: the desk promotes several of the owner's sites, one at a time.
 *
 *   1234tools    the default: tools.js, templates.js, stories/ and kits work as before,
 *                and its data stays where it always was (PROMO_HOME itself)
 *   <other id>   a profile in sites/<id>.js: name, base URL, UTM defaults, brand words,
 *                brand colours and logo, audiences, honest-claim rules, and the items it
 *                promotes (products, services or app features) with their stories.
 *                Its calendar, log, drafts, opportunities, kits and config live in
 *                PROMO_HOME/sites/<id>/, never mixed with another site's.
 *
 * Which site a call is for: run(id, fn) sets it for everything fn does, through
 * awaits (AsyncLocalStorage), so two browser tabs on two sites never cross. The
 * server runs each request in its site (?site= or the X-Promo-Site header); the
 * CLI takes --site <id>. With neither, PROMO_SITE or 1234tools.
 *
 *   list()            [{ id, name, baseUrl, kind, promotes, items, todo }]
 *   get(id)           the profile (1234tools is built in) or null
 *   currentId()       the site of the call in progress
 *   current()         its profile
 *   run(id, fn)       fn's result, with the site set
 *   isDefault(id?)    true for 1234tools
 *   record(path)      an item as a tool-shaped record (the shape tools.js returns), for other sites
 *   listItems()       every item of the current site as records
 *   utmUrl(path, venueId, medium)   the site's own UTM link
 *   lintCtx()         { site } for lint.js: the current site's claim rules
 */
const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const DEFAULT = '1234tools';
const DIR = path.join(__dirname, 'sites');
const als = new AsyncLocalStorage();

/* 1234Tools: its catalogue, stories and rules are the original desk's (tools.js, stories/, lint.js). */
const BUILTIN = {
  id: DEFAULT, name: '1234Tools', baseUrl: 'https://www.1234tools.com', domainSource: 'build/promo/tools.js ORIGIN',
  kind: 'tools', promotes: 'tools', utm: { medium: 'social' }, brandWords: ['1234Tools'],
  colours: { primary: '#f7c948', accent: '#ff9d2e', background: '#06080f', ink: '#f4f6fb' }, logo: null,
  audiences: [], rules: { free: true, freePhrases: [], browserClaims: true, forbid: [], notes: ['The 1234Tools rules in lint.js: browser tools may say "nothing you type is uploaded"; AI for Business tools state the 10-runs-a-month allowance.'] },
  items: null, builtin: true, checked: ''
};

/* The site picker's headings: a profile's pickerGroup ("XLeShop shops" for the shops
   on XLeShop, sites/_shop.js), else "Sites". The list keeps 1234Tools first, then the
   groups in the order they first appear. */
const GROUP = 'Sites';

let cache = { sig: '', map: null };

function files() {
  try { return fs.readdirSync(DIR).filter((n) => /^[a-z0-9-]+\.js$/.test(n)).sort(); } catch (e) { return []; }
}

function loadAll() {
  const names = files();
  const sig = names.map((n) => { try { return n + ':' + fs.statSync(path.join(DIR, n)).mtimeMs; } catch (e) { return n; } }).join('|');
  if (cache.map && sig === cache.sig) return cache.map;
  const map = new Map([[DEFAULT, BUILTIN]]);
  for (const n of names) {
    const f = path.join(DIR, n);
    try {
      delete require.cache[require.resolve(f)];
      const p = require(f);
      if (!p || !p.id || p.id === DEFAULT) continue;
      map.set(p.id, normalise(p));
    } catch (e) {
      map.set(n.replace(/\.js$/, ''), { id: n.replace(/\.js$/, ''), name: n, baseUrl: '', items: [], rules: {}, error: String(e.message || e), todo: ['the profile did not load: ' + (e.message || e)] });
    }
  }
  cache = { sig, map };
  return map;
}

function normalise(p) {
  const out = Object.assign({ kind: 'services', promotes: 'services', utm: { medium: 'social' }, brandWords: [p.name], colours: null, logo: null, audiences: [], regions: [], items: [], notConfirmed: [], todo: [] }, p);
  out.rules = Object.assign({ free: false, freePhrases: [], browserClaims: false, forbid: [], notes: [] }, p.rules || {});
  out.baseUrl = String(out.baseUrl || '').replace(/\/+$/, '');
  out.items = (out.items || []).map((it) => Object.assign({ usual: [], steps: [], facts: [], audiences: [], group: 'main' }, it, { path: normPath(it.path || '/' + it.id + '/') }));
  /* The desk keys an item by its page path; several items on one page (Attend Now's
     home page shows ten features) get "#<id>" on the key. Links always use the real path. */
  const seen = {};
  for (const it of out.items) seen[it.path] = (seen[it.path] || 0) + 1;
  for (const it of out.items) it.key = seen[it.path] > 1 ? (it.path.includes('#') ? it.path + '-' + it.id : it.path + '#' + it.id) : it.path;
  return out;
}

function normPath(p) {
  let s = String(p || '/').trim();
  // Git Bash turns "/about.html" into "C:/Program Files/Git/about.html": drop the install prefix
  const gitBash = s.replace(/\\/g, '/').match(/^[A-Za-z]:\/(?:Program Files(?: \(x86\))?\/)?Git(\/.*)$/i);
  if (gitBash) s = gitBash[1];
  /* Git Bash also turns a shop's "/c/sweets" (a category page) into "C:/sweets": the
     drive letter was the first path segment, so put it back */
  else { const drive = s.replace(/\\/g, '/').match(/^([A-Za-z]):\/(.*)$/); if (drive) s = '/' + drive[1].toLowerCase() + '/' + drive[2]; }
  if (/^https?:\/\//i.test(s)) { try { const u = new URL(s); s = u.pathname + u.search + u.hash; } catch (e) { /* keep */ } }
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

function list() {
  const all = Array.from(loadAll().values());
  const order = [GROUP];
  for (const p of all) if (p.pickerGroup && !order.includes(p.pickerGroup)) order.push(p.pickerGroup);
  const rank = (p) => (p.builtin ? -1 : order.indexOf(p.pickerGroup || GROUP));
  return all.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map(({ p }) => p).map((p) => ({ id: p.id, name: p.name, baseUrl: p.baseUrl, kind: p.kind, promotes: p.promotes, items: p.builtin ? null : (p.items || []).length, todo: (p.todo || []).length, error: p.error || '', colours: p.colours || null, group: p.pickerGroup || GROUP }));
}
function get(id) { return loadAll().get(id || DEFAULT) || null; }
function exists(id) { return loadAll().has(id); }

function currentId() {
  const s = als.getStore();
  const id = (s && s.site) || process.env.PROMO_SITE || DEFAULT;
  return id;
}
function current() { return get(currentId()) || BUILTIN; }
function isDefault(id) { return (id || currentId()) === DEFAULT; }

/** Run fn with the site set (unknown ids are refused, so data never lands in a stray folder). */
function run(id, fn) {
  const site = id || DEFAULT;
  if (!exists(site)) throw new Error('Unknown site: ' + site + '. Sites: ' + Array.from(loadAll().keys()).join(', '));
  return als.run({ site }, fn);
}

/* ------------------------------------------------------- items as records */

const AUD = ['accountants', 'creators', 'designers', 'developers', 'engineering', 'freelancers', 'general', 'health-fitness', 'hr-payroll', 'india', 'landlords', 'marketers', 'maths-education', 'personal-finance', 'productivity', 'smallbiz', 'students', 'teachers', 'uk'];

function toRecord(p, it) {
  const url = p.baseUrl + it.path;
  const aud = (it.audiences && it.audiences.length ? it.audiences : p.audiences || []).filter((a) => AUD.includes(a));
  return {
    title: it.title, path: it.key || it.path, page: it.path, url, cleanUrl: url, slug: it.id, section: it.group, sectionName: it.group.replace(/-/g, ' '),
    glyph: 'i-' + (p.kind === 'shop' ? 'business' : 'utilities'), verb: '', io: p.promotes === 'products' ? 'product' : p.promotes === 'app features' ? 'app feature' : 'service',
    description: it.promise || it.hook || '', keywords: [it.title.toLowerCase()].concat((it.keywords || []).map(String)), prefill: [],
    pricing: 'site', audiences: [], audienceTags: aud.length ? aud : ['general'], relatedGuides: [], relatedCompare: [], inFinder: true, media: false,
    site: p.id, siteName: p.name, story: storyOf(p, it), facts: it.facts || []
  };
}

/** The item's story in the shape stories/index.js gives kits. */
function storyOf(p, it) {
  return {
    persona: '', hook: it.hook || it.title, pain: it.pain || '', usual: (it.usual || []).slice(0, 3), promise: it.promise || '',
    // proof pills are short badges: only facts short enough to fit one ("0% commission"), never cut
    steps: (it.steps || []).slice(0, 3), proof: (it.facts || []).filter((f) => String(f).length <= 28).slice(0, 3), example: null, howTo: '', cta: it.cta || ('See it on ' + p.name),
    source: 'site-profile', shard: 'sites/' + p.id + '.js'
  };
}

function record(itemPath) {
  const p = current();
  const want = normPath(itemPath);
  const it = (p.items || []).find((x) => x.key === want || x.id === String(itemPath).replace(/^\/|\/$/g, '')) || (p.items || []).find((x) => x.path === want);
  if (!it) throw new Error('Unknown ' + (p.promotes || 'item') + ' for ' + p.name + ': ' + itemPath);
  return toRecord(p, it);
}
function listItems() { const p = current(); return (p.items || []).map((it) => toRecord(p, it)); }

function utmUrl(itemPath, venueId, medium) {
  const p = current();
  const r = record(itemPath);
  const u = new URL(r.url);
  u.searchParams.set('utm_source', venueId || 'promo');
  u.searchParams.set('utm_medium', medium || (p.utm && p.utm.medium) || 'social');
  u.searchParams.set('utm_campaign', r.section);
  u.searchParams.set('utm_content', r.slug);
  return u.toString();
}

function lintCtx() { return isDefault() ? {} : { site: current() }; }

/** Where this site's data lives, relative to PROMO_HOME. */
function dataDir(base, id) { id = id || currentId(); return id === DEFAULT ? base : path.join(base, 'sites', id); }

module.exports = { DEFAULT, DIR, list, get, exists, current, currentId, isDefault, run, record, listItems, utmUrl, lintCtx, dataDir, storyOf, normPath, AUD };
