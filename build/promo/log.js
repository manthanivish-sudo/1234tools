'use strict';
/**
 * The owner's posting log and the cadence rules that read it.
 *
 * Lives OUTSIDE the repo (everything committed is published):
 *   %USERPROFILE%/.1234tools-promo/log.json      (override the folder with PROMO_HOME)
 *
 * Entry: { at, venueId, toolPath, template, url?, note?, kind, linked, hash?, thread?, override? }
 *   kind  'post'    a published piece that links to the site (counts toward every cap)
 *         'help'    a contribution with no link (counts toward the 9:1 ratio)
 *         'skip'    the owner skipped a Today task (counts toward nothing)
 *         'removed' a moderator removed a post: the venue cools down for 90 days
 *   linked: false with profileLink: true marks a calendar post whose link lives in the
 *         profile (Instagram, TikTok, Shorts, a native Facebook Reel): it is kept in the
 *         history but counts toward no linked-post cap and not the day's routine cap.
 *
 * canPost(venueId, {toolPath, template, text, thread, now}) -> { ok, reasons[], warnings[], nextAt }
 * The desk never posts; this only tells the human whether it is a good idea today.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const DAY = 86400000;

/* PROMO_HOME is the desk's folder. 1234Tools keeps its data there as it always has;
   every other site (site.js) has its own folder, PROMO_HOME/sites/<id>/. */
function baseHome() { return process.env.PROMO_HOME || path.join(os.homedir(), '.1234tools-promo'); }
function siteMod() { try { return require('./site'); } catch (e) { return null; } }
function home() { const S = siteMod(); return S ? S.dataDir(baseHome()) : baseHome(); }
function logFile() { return path.join(home(), 'log.json'); }
function ensureHome() { fs.mkdirSync(home(), { recursive: true }); return home(); }

/** PROMO_NOW pins the clock (tests, and planning a day ahead). */
function now() { return process.env.PROMO_NOW ? new Date(process.env.PROMO_NOW) : new Date(); }

/* Spec Part B section 5: the day's routine and its linked-post cap. */
const ROUTINE = [
  { day: 0, name: 'Sunday', classes: [], cap: 0, work: 'Off, or read removals and criticism and reply once. No links.' },
  { day: 1, name: 'Monday', classes: ['answers'], cap: 1, work: 'Search-intent answers: Reddit, Quora, Stack Exchange. 2 help-only replies, at most 1 linked reply.' },
  { day: 2, name: 'Tuesday', classes: ['owner-social'], cap: 4, work: 'Owner channels: X, Mastodon, Bluesky, Threads. One tool, one angle, four different templates. Post by hand.' },
  { day: 3, name: 'Wednesday', classes: ['communities'], cap: 1, work: 'Communities: 1 forum reply or Facebook group (on its allowed day), 1 Discord help. Link only if the ratio allows.' },
  { day: 4, name: 'Thursday', classes: ['professional'], cap: 1, work: 'LinkedIn post with the link in the first comment, plus 2 comments on other people\'s posts.' },
  { day: 5, name: 'Friday', classes: ['visual'], cap: 2, work: 'Video/visual: one Short or Pin from a tool recorded on the phone; YouTube description + Pinterest pin.' },
  { day: 6, name: 'Saturday', classes: ['broadcast'], cap: 4, work: 'Newsletter blurb and WhatsApp/Telegram broadcast (fortnightly) + 2 directory submissions.' },
];

/* Template-level caps from the spec (section 5), applied on top of the venue's own. */
const TEMPLATE_CAPS = {
  'hn-show': { days: 30 }, 'hn-comment': { days: 14 }, 'linkedin-post': { perWeek: 2 }, 'x-post': { days: 1 }, 'x-thread': { days: 1 },
  'facebook-group': { days: 30 }, 'quora-answer': { perWeek: 2 }, 'stackexchange-answer': { perWeek: 2 }, 'forum-post': { days: 30 },
  'forum-reply': { days: 30 }, 'ph-launch': { days: 90 }, 'newsletter-blurb': { days: 14 }, 'whatsapp-broadcast': { days: 14 },
  'telegram-post': { days: 14 }, 'email-outreach': { perWeek: 5 }, 'reddit-comment': { days: 14 }, 'reddit-post': { days: 14 },
};
/* Venue kinds where the 9:1 contribution ratio applies (other people's spaces). */
const RATIO_KINDS = ['reddit', 'community', 'forum', 'qa'];
const PER_TOOL_VENUE_DAYS = 30;
const PER_TOOL_WEEK = 4;
const DUP_DAYS = 90;
const COOLDOWN_DAYS = 90;

function readFile(f) {
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(j) ? { version: 1, entries: j } : Object.assign({ version: 1, entries: [] }, j);
  } catch (e) {
    return { version: 1, entries: [] };
  }
}
function read() { return readFile(logFile()); }

/* Other people's spaces (Reddit, forums, Q&A, communities) are posted to from the
   owner's one personal account whichever site it is for, so their rules read every
   site's log; owned channels (each site's own accounts) read only the site's. */
function readAllSites() {
  const out = readFile(path.join(baseHome(), 'log.json')).entries.map((e) => Object.assign({ site: '1234tools' }, e));
  let ids = [];
  try { ids = fs.readdirSync(path.join(baseHome(), 'sites')); } catch (e) { ids = []; }
  for (const id of ids) for (const e of readFile(path.join(baseHome(), 'sites', id, 'log.json')).entries) out.push(Object.assign({ site: id }, e));
  return out;
}

/** The site's config.json (optional): { accounts: {...}, facebook: { linkPostsPerMonth: 2 } }. */
function config() { try { return JSON.parse(fs.readFileSync(path.join(home(), 'config.json'), 'utf8')) || {}; } catch (e) { return {}; } }

/* Facebook Page link posts: Meta has been testing a cap on link posts for Pages and
   professional-mode profiles without Meta Verified (reported as 2 a calendar month;
   over it the post goes out but the link shows as plain text). The desk keeps a
   budget so the few link posts go where they matter. config.json facebook.linkPostsPerMonth. */
const FB_VENUE = 'social-facebook';
function fbBudget(at) {
  const t = at ? new Date(at) : now();
  const cfg = config().facebook || {};
  const limit = Number.isFinite(+cfg.linkPostsPerMonth) && cfg.linkPostsPerMonth !== '' && cfg.linkPostsPerMonth != null ? Math.max(0, Math.floor(+cfg.linkPostsPerMonth)) : 2;
  const start = new Date(t.getFullYear(), t.getMonth(), 1);
  const next = new Date(t.getFullYear(), t.getMonth() + 1, 1);
  const used = read().entries.filter((e) => e.venueId === FB_VENUE && isLinkedPost(e) && new Date(e.at) >= start && new Date(e.at) < next).length;
  return { venueId: FB_VENUE, used, limit, left: Math.max(0, limit - used), month: start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0'), nextAt: next.toISOString(), label: used + ' of ' + limit + ' used this month' };
}
function write(data) {
  ensureHome();
  const tmp = logFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, logFile());
}

function entries(filter) {
  filter = filter || {};
  return read().entries.filter((e) => {
    if (filter.venue && e.venueId !== filter.venue) return false;
    if (filter.tool && e.toolPath !== filter.tool) return false;
    if (filter.kind && e.kind !== filter.kind) return false;
    if (filter.since && new Date(e.at) < filter.since) return false;
    return true;
  });
}

function hash32(s) {
  let h = 2166136261;
  s = String(s || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

/** Append one entry. Logging always succeeds: the human already posted. */
function append(e) {
  if (!e || !e.venueId) throw new Error('venueId required');
  const kind = e.kind || 'post';
  const entry = {
    at: e.at || now().toISOString(),
    venueId: String(e.venueId),
    toolPath: e.toolPath || '',
    template: e.template || '',
    kind,
    linked: e.linked != null ? !!e.linked : kind === 'post',
  };
  if (e.url) entry.url = String(e.url);
  if (e.note) entry.note = String(e.note);
  if (e.thread) entry.thread = String(e.thread);
  if (e.text) entry.hash = hash32(e.text);
  else if (e.hash) entry.hash = String(e.hash);
  if (e.override) entry.override = true;
  // calendar posts: which channel, and whether the post itself carried no link (counted toward no linked-post cap)
  if (e.channel) entry.channel = String(e.channel);
  if (e.profileLink) entry.profileLink = true;
  const data = read();
  data.entries.push(entry);
  write(data);
  return entry;
}

function venueById(id) {
  try { return require('./venues').get(id); } catch (e) { return null; }
}

function isLinkedPost(e) { return e.kind === 'post' && e.linked !== false; }

/** Local calendar day key, so "today" matches the owner's wall clock. */
function dayKey(d) { const x = new Date(d); return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); }

function routineFor(d) { return ROUTINE[new Date(d || now()).getDay()]; }

/**
 * Whether a linked post on this venue is within the rules today.
 * opts: { toolPath, template, text, thread, now, venue }
 */
function canPost(venueId, opts) {
  opts = opts || {};
  const t = opts.now ? new Date(opts.now) : now();
  const venue = opts.venue || venueById(venueId) || { id: venueId, cadenceDays: 0, maxPerWeek: 999, kind: 'social' };
  // opts.before: judge from a snapshot (Today picks its tasks from the log as it stood at midnight)
  const shared = RATIO_KINDS.includes(venue.kind);
  const site = (siteMod() && siteMod().currentId()) || '1234tools';
  const source = shared ? readAllSites().filter((e) => e.venueId === venueId || e.site === site) : read().entries;
  const all = source.filter((e) => !opts.before || new Date(e.at) < new Date(opts.before));
  const reasons = [];
  const warnings = [];
  let nextAt = 0;
  const block = (msg, until) => { reasons.push(msg); if (until && until > nextAt) nextAt = until; };
  const shareOnly = (venue.roles && !venue.roles.includes('post')) || venue.kind === 'share';

  const onVenue = all.filter((e) => e.venueId === venueId);
  const posts = onVenue.filter(isLinkedPost).sort((a, b) => new Date(a.at) - new Date(b.at));
  const last = posts[posts.length - 1];

  // moderator removal -> 90-day cooldown
  const removed = onVenue.filter((e) => e.kind === 'removed').sort((a, b) => new Date(a.at) - new Date(b.at)).pop();
  if (removed && t - new Date(removed.at) < COOLDOWN_DAYS * DAY) {
    block('Cooling down after a removal on ' + removed.at.slice(0, 10) + ' (90 days).', new Date(removed.at).getTime() + COOLDOWN_DAYS * DAY);
  }

  if (!shareOnly) {
    // cadence: the venue's and the template's, whichever is longer
    const tc = TEMPLATE_CAPS[opts.template] || {};
    const cadence = Math.max(venue.cadenceDays || 0, tc.days || 0);
    if (cadence && last && t - new Date(last.at) < cadence * DAY) {
      const until = new Date(last.at).getTime() + cadence * DAY;
      block('Cadence: last linked post here was ' + last.at.slice(0, 10) + '; this venue allows one every ' + cadence + ' days.', until);
    }
    const perWeek = Math.min(venue.maxPerWeek > 0 ? venue.maxPerWeek : 999, tc.perWeek || 999);
    const week = posts.filter((e) => t - new Date(e.at) < 7 * DAY);
    if (week.length >= perWeek) {
      block('Weekly cap: ' + week.length + ' of ' + perWeek + ' linked posts here in the last 7 days.', new Date(week[0].at).getTime() + 7 * DAY);
    }
    if (venue.selfPromo === 'launch-once' && opts.toolPath && posts.some((e) => e.toolPath === opts.toolPath)) {
      block('Launch-once venue: this tool has already been launched here.');
    }
    // 9:1 ratio in other people's spaces
    if (RATIO_KINDS.includes(venue.kind)) {
      if (last) {
        const helps = onVenue.filter((e) => e.kind === 'help' && new Date(e.at) > new Date(last.at)).length;
        if (helps < 9) block('9:1 ratio: ' + helps + ' of 9 help-only contributions logged here since the last linked post.');
      } else {
        warnings.push('First linked post on this venue: make sure the account already has nine helpful, link-free contributions here.');
      }
    }
  }

  if (opts.toolPath) {
    const sameTool = all.filter((e) => isLinkedPost(e) && e.toolPath === opts.toolPath);
    const here = sameTool.filter((e) => e.venueId === venueId).sort((a, b) => new Date(a.at) - new Date(b.at)).pop();
    if (here && !shareOnly && t - new Date(here.at) < PER_TOOL_VENUE_DAYS * DAY) {
      block('Same tool on this venue within ' + PER_TOOL_VENUE_DAYS + ' days (last ' + here.at.slice(0, 10) + ').', new Date(here.at).getTime() + PER_TOOL_VENUE_DAYS * DAY);
    }
    const weekVenues = new Set(sameTool.filter((e) => t - new Date(e.at) < 7 * DAY).map((e) => e.venueId));
    if (!weekVenues.has(venueId) && weekVenues.size >= PER_TOOL_WEEK) block('This tool is already on ' + weekVenues.size + ' venues this week (cap ' + PER_TOOL_WEEK + ').');
    if (RATIO_KINDS.includes(venue.kind)) {
      const todayCommunity = sameTool.filter((e) => dayKey(e.at) === dayKey(t) && e.venueId !== venueId && RATIO_KINDS.includes((venueById(e.venueId) || {}).kind));
      if (todayCommunity.length) block('This tool already went to another community today (' + todayCommunity[0].venueId + ').');
    }
  }

  if (opts.thread && all.some((e) => e.thread === opts.thread && isLinkedPost(e))) block('You already left a linked reply in this thread.');

  // Facebook Page link-post budget (only for a post that carries a link)
  if (venueId === FB_VENUE && opts.linked !== false) {
    const b = fbBudget(t);
    if (b.used >= b.limit) block('Facebook link budget: ' + b.label + '. Over it the link shows as plain text: post natively (a Reel or image, no link) or wait for next month.', new Date(b.nextAt).getTime());
    else warnings.push('Facebook link budget: ' + b.label + '. Spend link posts on the tools that do best; native posts without a link do not use it.');
  }

  if (opts.text) {
    const h = hash32(opts.text);
    const dup = all.find((e) => e.hash === h && t - new Date(e.at) < DUP_DAYS * DAY);
    if (dup) block('Identical text was posted on ' + dup.venueId + ' on ' + dup.at.slice(0, 10) + ': change the template or variant.');
  }

  if (!shareOnly && opts.linked !== false) {
    const r = routineFor(t);
    const today = all.filter((e) => isLinkedPost(e) && dayKey(e.at) === dayKey(t));
    if (today.length >= r.cap) {
      const tomorrow = new Date(t); tomorrow.setHours(24, 0, 0, 0);
      block(r.name + ' cap: ' + today.length + ' of ' + r.cap + ' linked posts today (' + r.work.split(':')[0] + ').', tomorrow.getTime());
    }
  }

  return { ok: reasons.length === 0, reasons, warnings, nextAt: nextAt ? new Date(nextAt).toISOString() : null };
}

/** Per-venue status for the Log tab. */
function status(venue, opts) {
  const t = (opts && opts.now) ? new Date(opts.now) : now();
  const onVenue = read().entries.filter((e) => e.venueId === venue.id);
  const posts = onVenue.filter(isLinkedPost);
  const last = posts.sort((a, b) => new Date(a.at) - new Date(b.at))[posts.length - 1];
  const c = canPost(venue.id, { venue, now: t });
  return {
    venueId: venue.id,
    lastPost: last ? last.at : null,
    postsThisWeek: posts.filter((e) => t - new Date(e.at) < 7 * DAY).length,
    helpsSinceLast: onVenue.filter((e) => e.kind === 'help' && (!last || new Date(e.at) > new Date(last.at))).length,
    ok: c.ok, reasons: c.reasons, nextAt: c.nextAt,
  };
}

module.exports = {
  ROUTINE, TEMPLATE_CAPS, RATIO_KINDS, FB_VENUE, home, baseHome, logFile, ensureHome, now, read, readAllSites, entries, append, canPost, status, routineFor, dayKey, hash32,
  config, fbBudget, isLinkedPost,
};
