'use strict';
/**
 * Today: the day's routine (copy spec Part B section 5) turned into tasks.
 *
 *   plan({ now }) -> { date, routine, cap, used, tasks: [...] }
 *
 * A task is { id, kind: 'linked'|'help'|'info', cls, venueId, toolPath, template, variant,
 * draft, composerUrl, status, done, skipped }. Tools rotate deterministically by date,
 * skipping any tool promoted in the last 7 days; each linked task is only offered
 * where the log's caps allow it today. The owner posts every one by hand.
 */
const T = require('./tools');
const V = require('./venues');
const L = require('./log');
const TPL = require('./templates');

const OWNER_SOCIAL = [
  ['social-x', 'x-post'], ['social-mastodon', 'mastodon-post'], ['social-bluesky', 'bluesky-post'], ['social-threads', 'threads-post'],
];
const ANGLES = ['privacy', 'speed', 'cost', 'no-signup', 'offline'];

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function midnightOf(d) { const m = new Date(d); m.setHours(0, 0, 0, 0); return m; }
function dayIndex(d) { return Math.floor(new Date(d).getTime() / 86400000); }

/** Finder tools in a date-seeded order, minus those promoted in the last 7 days. */
function toolOrder(now) {
  const key = L.dayKey(now);
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const recent = new Set(L.entries({ kind: 'post', since: new Date(now.getTime() - 7 * 86400000) }).filter((e) => new Date(e.at) < midnight).map((e) => e.toolPath));
  return T.listTools().filter((r) => !recent.has(r.path)).sort((a, b) => hash(key + a.path) - hash(key + b.path));
}

function draftFor(rec, venue, template, variant, angle) {
  const d = TPL.render(template, rec, { venue, variant, angle });
  const title = d.title || rec.title;
  const c = TPL.META[template].answer ? { url: '', note: 'Replies are written in the thread itself.' } : V.composerForDraft(venue, d, title);
  return { draft: d, composerUrl: c.url, composerNote: c.note };
}

function linkedTask(cls, rec, venue, template, variant, now, angle) {
  const { draft, composerUrl, composerNote } = draftFor(rec, venue, template, variant, angle);
  const status = L.canPost(venue.id, { venue, toolPath: rec.path, template, text: draft.text, now });
  return {
    kind: 'linked', cls, venueId: venue.id, venueName: venue.name, toolPath: rec.path, toolTitle: rec.title, verifyFirst: V.verifyFirst(venue), risk: venue.risk,
    template, variant, angle: angle || null, draft, composerUrl, composerNote, status, rulesUrl: venue.rulesUrl,
    redLines: V.redLinesFor(venue), searchUrl: venue.searchUrl ? venue.searchUrl.replace('{q}', encodeURIComponent(rec.keywords[0] || rec.title)) : '',
  };
}

function helpTask(cls, rec, venue, what) {
  return {
    kind: 'help', cls, venueId: venue.id, venueName: venue.name, toolPath: rec ? rec.path : '', toolTitle: rec ? rec.title : '', verifyFirst: V.verifyFirst(venue), risk: venue.risk,
    template: '', variant: 0, what, rulesUrl: venue.rulesUrl, redLines: V.redLinesFor(venue),
    searchUrl: venue.searchUrl && rec ? venue.searchUrl.replace('{q}', encodeURIComponent(rec.keywords[0] || rec.title)) : (venue.url || ''),
    hasApi: !!venue.apiSearch,
  };
}

/** First (tool, venue) pair, in tool order, where the venue covers the tool's section and the log allows a post. */
function pickPair(tools, venues, templateOf, now, used) {
  for (const rec of tools.slice(0, 80)) {
    if (used.has(rec.path)) continue;
    for (const v of venues) {
      if (used.has('venue:' + v.id)) continue;
      if (!v.sections.includes(rec.section)) continue;
      const tmpl = templateOf(v);
      const st = L.canPost(v.id, { venue: v, toolPath: rec.path, template: tmpl, now, before: midnightOf(now) });
      if (st.ok) return { rec, venue: v, template: tmpl };
    }
  }
  return null;
}

/* Today only ever suggests venues that are not high risk (those stay manual, in Draft). */
function byIds(ids) { return ids.map((id) => V.get(id)).filter((v) => v && V.autoSuggest(v)); }
function getAuto(id) { const v = V.get(id); return v && V.autoSuggest(v) ? v : null; }

function plan(opts) {
  opts = opts || {};
  const now = opts.now ? new Date(opts.now) : L.now();
  const routine = L.routineFor(now);
  const di = dayIndex(now);
  const tools = toolOrder(now);
  const used = new Set();
  const tasks = [];
  const post = V.postVenues().filter(V.autoSuggest);
  const cls = routine.classes[0] || 'off';

  const addLinked = (venues, templateOf, label) => {
    const p = pickPair(tools, venues, templateOf, now, used);
    if (!p) {
      tasks.push({ kind: 'info', cls, what: 'No ' + label + ' venue is open for a linked post today (cadence, ratio or caps). Do help-only work instead.' });
      return null;
    }
    used.add(p.rec.path);
    used.add('venue:' + p.venue.id);
    const t = linkedTask(cls, p.rec, p.venue, p.template, (di + tasks.length) % 3, now);
    tasks.push(t);
    return t;
  };

  if (cls === 'answers') {
    // per-community search only (a sitewide search is not a place to answer)
    const venues = post.filter((v) => (v.kind === 'reddit' && /reddit\.com\/r\//.test(v.apiSearch)) || v.kind === 'qa');
    const first = tools[0];
    const ranked = V.fit(first.path, { noLog: true }).map((f) => V.get(f.id)).filter((v) => venues.includes(v));
    for (const v of ranked.slice(0, 2)) tasks.push(helpTask(cls, first, v, 'Answer one question here with no link at all (counts toward 9:1). Opportunities lists live ones.'));
    addLinked(venues.filter((v) => v.kind === 'reddit' || /stackexchange|quora/.test(v.id)), (v) => (v.kind === 'reddit' ? 'reddit-comment' : v.template), 'answer');
  } else if (cls === 'owner-social') {
    const venues = byIds(OWNER_SOCIAL.map((x) => x[0]));
    let chosen = null;
    for (const rec of tools.slice(0, 80)) {
      const ok = OWNER_SOCIAL.filter(([id, tmpl]) => {
        const v = getAuto(id);
        return v && v.sections.includes(rec.section) && L.canPost(id, { venue: v, toolPath: rec.path, template: tmpl, now, before: midnightOf(now) }).ok;
      });
      if (ok.length >= 3) { chosen = { rec, ok }; break; }
    }
    if (!chosen) tasks.push({ kind: 'info', cls, what: 'No tool fits three owner channels today; the caps say rest.' });
    else {
      const angle = ANGLES[di % ANGLES.length];
      chosen.ok.forEach(([id, tmpl], i) => tasks.push(linkedTask(cls, chosen.rec, getAuto(id), tmpl, (di + i) % 3, now, angle)));
      used.add(chosen.rec.path);
    }
    if (!venues.length) tasks.push({ kind: 'info', cls, what: 'Owner social venues are missing from venues.json.' });
  } else if (cls === 'communities') {
    const venues = post.filter((v) => v.kind === 'forum' || /facebook-groups/.test(v.id));
    addLinked(venues, (v) => v.template, 'forum or group');
    const discord = post.filter((v) => /discord/.test(v.id));
    if (discord.length) {
      const subject = tasks[0] && tasks[0].toolPath ? T.record(tasks[0].toolPath) : tools[0];
      const ranked = V.fit(subject.path, { noLog: true }).map((f) => f.id);
      const pick = discord.slice().sort((a, b) => (ranked.indexOf(a.id) + 1 || 999) - (ranked.indexOf(b.id) + 1 || 999))[0];
      tasks.push(helpTask(cls, subject, pick, 'Help one person in a help channel, no link (9:1 upkeep).'));
    }
  } else if (cls === 'professional') {
    const li = getAuto('social-linkedin');
    if (li) {
      addLinked([li], () => 'linkedin-post', 'LinkedIn');
      tasks.push(helpTask(cls, null, li, 'Leave two thoughtful comments on other people\'s posts (no links).'));
    }
  } else if (cls === 'visual') {
    const pin = getAuto('social-pinterest');
    const yt = getAuto('video-youtube-channel');
    if (pin) addLinked([pin], () => 'pinterest-pin', 'Pinterest');
    if (yt) addLinked([yt], () => 'youtube-description', 'YouTube');
    tasks.push({ kind: 'info', cls, what: 'Generate the kit for these tools (Kits tab) for the pin image; record the Short on your phone.' });
  } else if (cls === 'broadcast') {
    const nl = post.filter((v) => v.kind === 'newsletter');
    if (nl.length) addLinked(nl, (v) => v.template || 'newsletter-blurb', 'newsletter');
    const bc = byIds(['social-whatsapp', 'social-telegram']);
    if (bc.length) addLinked(bc, (v) => (/whatsapp/.test(v.id) ? 'whatsapp-broadcast' : 'telegram-post'), 'broadcast (fortnightly)');
    const dirs = post.filter((v) => v.kind === 'directory');
    for (let i = 0; i < 2; i++) {
      if (!dirs.length) break;
      const t = addLinked(dirs, () => 'directory-listing', 'directory');
      if (!t) break;
    }
  } else {
    tasks.push({ kind: 'info', cls: 'off', what: routine.work });
  }

  // done / skipped state from today's log
  const today = L.entries().filter((e) => L.dayKey(e.at) === L.dayKey(now));
  const helpSeen = {};
  tasks.forEach((t, i) => {
    t.id = L.dayKey(now) + '#' + i;
    t.skipped = today.some((e) => e.kind === 'skip' && e.note === t.id);
    if (t.kind === 'linked') t.done = today.some((e) => e.kind === 'post' && e.venueId === t.venueId && e.toolPath === t.toolPath);
    else if (t.kind === 'help') {
      helpSeen[t.venueId] = (helpSeen[t.venueId] || 0) + 1;
      t.done = today.filter((e) => e.kind === 'help' && e.venueId === t.venueId).length >= helpSeen[t.venueId];
    }
  });
  const usedToday = today.filter((e) => e.kind === 'post' && e.linked !== false).length;
  return { date: L.dayKey(now), weekday: routine.name, routine, cap: routine.cap, used: usedToday, tasks };
}

module.exports = { plan, toolOrder };
