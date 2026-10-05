/**
 * The 90-day short-video calendar.
 *
 * One problem → one tool → one result, about nine a week, in five formats
 * that each suit a different kind of tool (the owner's plan, §15):
 *
 *   problem   Problem → solution     any browser tool, the popular ones first
 *   before    Before / after          photo, video and PDF tools with a real example
 *   dev       10-second developer trick  developer and text tools
 *   india     India finance           GST, SIP, EMI, tax, PPF, gratuity…
 *   ai        AI at work              the cloud AI tools (they say what they send)
 *
 * Each day carries the tool, the story's hook and the beats for the Reel
 * (pain → the usual way → the fix → the real example → steps → CTA), and
 * links straight into the Reel Maker, the kit and a caption draft. A tool
 * is not repeated within 21 days.
 *
 * Every slot has TARGETS: one per channel and format it should go to
 * (channels.js holds the channels, their specs and the link rules). For
 * each target the owner records the post's link, or ticks it as posted on a
 * channel that gives a post no permanent link (WhatsApp Status), or skips it
 * with a reason. The desk checks the link's SHAPE locally against the channel
 * and the format; it never opens the link or contacts the platform.
 *
 *   slot state   derived: "posted" when every target is posted or skipped
 *                with a reason; "partly" when some are; otherwise the manual
 *                status (planned → made → posted, or skipped for the whole slot)
 *
 * Kept in calendar.json in the desk's data folder (v2). A v1 file (one status
 * and one postedUrl per slot) loads as it is: the link is assigned to the
 * target whose rules it matches, or kept on the slot as an unassigned link,
 * and a copy of the v1 file is kept as calendar.v1.json. Re-planning keeps
 * every slot that has a status or any target record.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./log');
const T = require('./tools');
const CH = require('./channels');

const FILE = () => path.join(L.home(), 'calendar.json');
const DAYS = 90;
const GAP = 21;
const REEL = 'https://www.1234tools.com/ai-video/reel-maker/?tool=';
const DAY = 86400000;

/* Each format's targets: the channels and formats a slot of that kind goes
   to. The first three of each are the short-video platforms the plan always
   had; the kit's carousel goes to the Instagram feed and to LinkedIn as a
   document where a step-by-step story suits (problem → solution, India
   finance). Add or skip a channel per slot in the Calendar tab. */
const FORMATS = {
  problem: { label: 'Problem → solution', targets: ['instagram-reel', 'youtube-shorts', 'tiktok', 'instagram-carousel', 'linkedin-document'] },
  before: { label: 'Before / after', targets: ['instagram-reel', 'tiktok', 'pinterest-video'] },
  dev: { label: '10-second developer trick', targets: ['youtube-shorts', 'x', 'linkedin-post'] },
  india: { label: 'India finance', targets: ['instagram-reel', 'youtube-shorts', 'whatsapp-status', 'instagram-carousel', 'linkedin-document'] },
  ai: { label: 'AI at work', targets: ['linkedin-post', 'youtube-shorts', 'instagram-reel'] }
};
for (const f of Object.values(FORMATS)) f.platforms = f.targets.map((id) => CH.get(id).name);

/* Which slots each weekday fills (0 = Sunday). Nine a week: one a day,
   and a second on Tuesday and Thursday, the two days short video does best
   for work tools. */
const WEEK = [['problem'], ['problem'], ['before', 'dev'], ['india'], ['ai', 'before'], ['dev'], ['before']];

/* The tools people search for most come first in each format's rotation. */
const LEAD = ['/image/image-compressor/', '/pdf/merge-pdf/', '/ai-image/background-remover/', '/qr/qr-code-generator/',
  '/mathematics/percentage/', '/health/bmi/', '/time/age-calculator/', '/text/word-counter/', '/image/passport-photo/',
  '/ai-video/auto-captions/', '/ai-video/reel-maker/', '/india/gst-calculator/', '/india/emi-calculator/', '/india/sip-calculator/',
  '/developer/json-formatter/', '/developer/csv-to-json/', '/developer/base64/', '/developer/uuid-generator/', '/developer/regex-tester/',
  '/ai/invoice-extractor/', '/ai/bank-statement-categoriser/', '/ai/scanned-invoice-extractor/', '/ai/product-listing-writer/', '/ai/meeting-minutes/'];

function examples() {
  try { const w = {}; new Function('window', fs.readFileSync(path.join(T.ROOT, 'assets/examples.js'), 'utf8'))(w); return w.TOOL_EXAMPLES || {}; } catch (e) { return {}; }
}

function pools() {
  const ex = examples();
  const tools = T.listTools();
  const visual = (t) => { const e = ex[t.path]; return !!(e && (e.before || e.after || e.page)); };
  const by = {
    problem: tools.filter((t) => t.pricing !== 'freemium' && !/^\/(developer|india|ai)\//.test(t.path)),
    before: tools.filter((t) => /^\/(image|ai-image|ai-video|pdf)\//.test(t.path) && visual(t)),
    dev: tools.filter((t) => /^\/(developer|text)\//.test(t.path)),
    india: tools.filter((t) => /^\/india\//.test(t.path) || t.path === '/business/ctc-structure/'),
    ai: tools.filter((t) => t.pricing === 'freemium')
  };
  const rank = (t) => { const i = LEAD.indexOf(t.path); return i < 0 ? 100 : i; };
  for (const k of Object.keys(by)) by[k].sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path));
  return by;
}

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function localDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = localDate(s); return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); }
const todayIso = () => iso(L.now());
const nowIso = () => L.now().toISOString();

/* ------------------------------------------------------------ storage */

function readRaw() {
  try { const j = JSON.parse(fs.readFileSync(FILE(), 'utf8')); if (j && Array.isArray(j.items)) return j; } catch (e) { /* none yet */ }
  return null;
}

function load() {
  const raw = readRaw();
  if (!raw) return null;
  if ((raw.v || 1) < 2) {
    // keep the file exactly as it was, once, then write the migrated v2 in place
    const keep = path.join(L.home(), 'calendar.v1.json');
    try { if (!fs.existsSync(keep)) fs.copyFileSync(FILE(), keep); } catch (e) { /* the migration keeps every field anyway */ }
    const cal = migrate(raw);
    save(cal);
    return cal;
  }
  for (const it of raw.items) normalise(it);
  return raw;
}

function save(cal) {
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  const tmp = FILE() + '.' + process.pid + '.tmp';
  const clean = Object.assign({}, cal, { items: cal.items.map(strip) });
  fs.writeFileSync(tmp, JSON.stringify(clean, null, 1));
  fs.renameSync(tmp, FILE());
}

/* What is stored for a target: the record only. Names, issues and states
   are worked out on every read (decorate), so a change in channels.js
   reaches old records too. */
const TARGET_FIELDS = ['channel', 'state', 'url', 'tick', 'note', 'reason', 'at', 'logAt', 'accepted', 'extra', 'migrated'];
function strip(it) {
  const out = {};
  for (const [k, v] of Object.entries(it)) if (!/^(view|progress|state)$/.test(k)) out[k] = v;
  out.targets = (it.targets || []).map((t) => { const o = {}; for (const k of TARGET_FIELDS) if (t[k] !== undefined && t[k] !== '' && t[k] !== false) o[k] = t[k]; return o; });
  return out;
}

/** Give a slot its targets if it has none (v1 slots, slots of an older plan). */
function normalise(it) {
  if (!Array.isArray(it.targets)) it.targets = [];
  if (!it.targets.length && FORMATS[it.format]) it.targets = FORMATS[it.format].targets.map((channel) => ({ channel }));
  for (const t of it.targets) if (!t.state) t.state = 'due';
  it.targets = it.targets.filter((t) => CH.get(t.channel));
  if (FORMATS[it.format]) it.platforms = it.targets.map((t) => CH.get(t.channel).name);
  if (!it.status) it.status = 'planned';
  return it;
}

/** v1 → v2: every field is kept; a postedUrl goes to the target whose rules it matches. */
function migrate(raw) {
  const cal = Object.assign({}, raw, { v: 2, migratedFrom: raw.v || 1, migratedAt: nowIso() });
  cal.items = raw.items.map((x) => {
    const it = normalise(Object.assign({}, x, { targets: undefined }));
    if (Array.isArray(x.platforms) && x.platforms.join('|') !== it.platforms.join('|')) it.platformsV1 = x.platforms;
    if (x.postedUrl) assignLoose(it, x.postedUrl, x.statusAt || cal.migratedAt, x.note);
    return it;
  });
  return cal;
}

/* A link with no target named (a v1 postedUrl, the slot-level Posted
   button): give it to the first open target whose rules it passes, or keep
   it on the slot as an unassigned link. Never logs: the owner's old records
   did not log either, and the log may already hold the post. */
function assignLoose(it, url, at, note) {
  url = String(url).trim();
  if (!url) return null;
  if (it.targets.some((t) => t.url === url) || (it.unassigned || []).some((u) => u.url === url)) return null;
  const t = it.targets.find((x) => x.state === 'due' && CH.check(x.channel, url).ok);
  if (t) { Object.assign(t, { state: 'posted', url, at, migrated: true }); if (note) t.note = String(note).slice(0, 500); return t; }
  it.unassigned = (it.unassigned || []).concat([{ url, at, note: 'a link recorded for the whole slot; it matched none of its targets' }]);
  return null;
}

/* ----------------------------------------------------------- planning */

function hasRecord(it) {
  return it.status !== 'planned' || (it.targets || []).some((t) => (t.state && t.state !== 'due') || t.extra || t.logAt) || (it.unassigned || []).length > 0;
}

/** A fresh plan from `start` (YYYY-MM-DD), keeping every slot that has a status or a target record. */
function plan(start) {
  const S = require('./stories/index.js');
  const old = load();
  const kept = {};
  if (old) for (const it of old.items) if (hasRecord(it)) kept[it.id] = it;
  const by = pools();
  const cursor = { problem: 0, before: 0, dev: 0, india: 0, ai: 0 };
  const lastUsed = {};
  const items = [];
  const s = localDate(start || todayIso());
  for (let i = 0; i < DAYS; i++) {
    const day = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
    const date = iso(day);
    WEEK[day.getDay()].forEach((fmt, slot) => {
      const id = date + ':' + slot;
      if (kept[id]) { items.push(kept[id]); lastUsed[kept[id].tool] = i; delete kept[id]; return; }
      const pool = by[fmt];
      if (!pool.length) return;
      let pick = null;
      for (let k = 0; k < pool.length; k++) {
        const t = pool[(cursor[fmt] + k) % pool.length];
        if (lastUsed[t.path] === undefined || i - lastUsed[t.path] >= GAP) { pick = t; cursor[fmt] = (cursor[fmt] + k + 1) % pool.length; break; }
      }
      if (!pick) { pick = pool[cursor[fmt] % pool.length]; cursor[fmt]++; }
      lastUsed[pick.path] = i;
      const st = S.storyFor(pick.path) || {};
      items.push({
        id, date, slot, format: fmt, formatLabel: FORMATS[fmt].label, tool: pick.path, title: pick.title,
        hook: st.hook || pick.description, pain: st.pain || '', promise: st.promise || '',
        beats: ['Hook: ' + (st.hook || pick.title), 'Pain: ' + (st.pain || ''), 'The usual way: ' + (st.usual || []).join(' · '),
          'The fix: ' + (st.promise || pick.description), 'Show the real result', 'Steps: ' + (st.steps || []).join(' → '), 'CTA: ' + (st.cta || 'Try it free') + ' — link in bio'],
        platforms: FORMATS[fmt].platforms.slice(), reel: REEL + encodeURIComponent(pick.path),
        status: 'planned', postedUrl: '', note: '',
        targets: FORMATS[fmt].targets.map((channel) => ({ channel, state: 'due' }))
      });
    });
  }
  // a recorded slot outside the new window is kept too, never dropped
  const outside = Object.values(kept);
  items.push(...outside);
  items.sort((a, b) => a.date.localeCompare(b.date) || a.slot - b.slot);
  const cal = { v: 2, start: iso(s), made: nowIso(), items };
  save(cal);
  return cal;
}

function raw() { return load() || plan(); }

function find(cal, id) {
  const it = cal.items.find((x) => x.id === id);
  if (!it) throw new Error('no calendar slot ' + id);
  return it;
}

/* --------------------------------------------------------- decorating */

/** One key per post, so the same link is spotted on two targets however it was copied. */
function linkKey(url) {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, '');
    const keepQuery = /(^|\.)youtube\.com$|(^|\.)facebook\.com$/.test(host) ? ['v', 'story_fbid', 'fbid', 'id'].map((k) => u.searchParams.get(k) ? k + '=' + u.searchParams.get(k) : '').filter(Boolean).join('&') : '';
    return host + u.pathname.replace(/\/+$/, '').toLowerCase() + (keepQuery ? '?' + keepQuery : '');
  } catch (e) { return String(url).trim().toLowerCase(); }
}

function linkIndex(cal) {
  const idx = {};
  for (const it of cal.items) for (const t of it.targets || []) if (t.url) (idx[linkKey(t.url)] = idx[linkKey(t.url)] || []).push(it.id + ' · ' + ((CH.get(t.channel) || {}).name || t.channel));
  return idx;
}

/** A target with its channel, its check and whether it counts as done. */
function viewTarget(it, t, idx) {
  const ch = CH.get(t.channel);
  const issues = [];
  if (t.state === 'posted' && t.url) {
    issues.push(...CH.check(t.channel, t.url).issues);
    const others = (idx[linkKey(t.url)] || []).filter((x) => x !== it.id + ' · ' + ch.name);
    if (others.length) issues.push({ code: 'duplicate', level: 'bad', msg: 'The same link is recorded on ' + others.join(', ') + ': one post cannot be two.' });
    if (t.at && iso(new Date(t.at)) < it.date) issues.push({ code: 'early', level: 'warn', msg: 'Recorded on ' + iso(new Date(t.at)) + ', before the slot\'s date (' + it.date + '). Fine if you posted early; check it is the right post.' });
  }
  if (t.state === 'posted' && !t.url && t.tick && !ch.tick) issues.push({ code: 'no-link', level: 'bad', msg: 'Ticked without a link, but ' + ch.name + ' gives every post a link: record it.' });
  const bad = issues.some((x) => x.level === 'bad');
  const done = t.state === 'skipped' ? !!t.reason : t.state === 'posted' && (!bad || !!t.accepted);
  return Object.assign({}, t, { name: ch.name, short: ch.short, platform: ch.platform, tickOnly: !!ch.tick && !ch.linkShape, tick: t.tick, allowsTick: !!ch.tick, venue: ch.venue || '', issues, flagged: bad && !t.accepted, done });
}

function viewItem(it, idx) {
  const targets = (it.targets || []).map((t) => viewTarget(it, t, idx));
  const total = targets.length;
  const done = targets.filter((t) => t.done).length;
  const posted = targets.filter((t) => t.state === 'posted' && t.done).length;
  const skipped = targets.filter((t) => t.state === 'skipped').length;
  const flagged = targets.filter((t) => t.flagged).length;
  let state = it.status;
  if (it.status !== 'skipped' && total) {
    if (done === total) state = posted ? 'posted' : 'skipped';
    else if (done > 0 || targets.some((t) => t.state === 'posted') || it.status === 'posted') state = 'partly';
  }
  const label = it.status === 'skipped' ? 'slot skipped' : done + ' of ' + total + ' channels';
  return Object.assign({}, it, { targets, state, progress: { done, total, posted, skipped, flagged, label } });
}

/** The calendar as the UI and the CLI see it: every slot with its targets checked. */
function get() {
  const cal = raw();
  const idx = linkIndex(cal);
  return Object.assign({}, cal, { today: todayIso(), items: cal.items.map((it) => viewItem(it, idx)) });
}

/* ------------------------------------------------------------ actions */

/** The slot's manual status, as before; a link given with "posted" goes to the target it matches. */
function setStatus(id, status, postedUrl, note) {
  if (!['planned', 'made', 'posted', 'skipped'].includes(status)) throw new Error('status must be planned, made, posted or skipped');
  const cal = raw();
  const it = find(cal, id);
  it.status = status;
  if (postedUrl !== undefined) {
    it.postedUrl = String(postedUrl).slice(0, 500);
    if (status === 'posted' && it.postedUrl) assignLoose(it, it.postedUrl, nowIso(), note);
  }
  if (note !== undefined) it.note = String(note).slice(0, 500);
  it.statusAt = nowIso();
  save(cal);
  return viewItem(it, linkIndex(cal));
}

/**
 * Record what happened to one target of a slot.
 *   action 'post'    { url } or { tick: true } on a channel with no permanent link; optional note
 *   action 'skip'    { reason } (required)
 *   action 'clear'   back to due (a log entry already written stays in the log)
 *   action 'accept'  the owner confirms a flagged link is right
 *   action 'add'     add a channel the slot did not list; 'remove' takes an added one away again
 * Posting with a link (or a tick) on a channel that has a venue in venues.json
 * also appends a log entry once, so the cadence rules see it.
 * -> { item, target, logged, noVenue, message }
 */
function target(id, channel, action, o) {
  o = o || {};
  const ch = CH.get(channel);
  if (!ch) throw new Error('unknown channel ' + channel + ' (see node build/promo/desk.js guide)');
  const cal = raw();
  const it = find(cal, id);
  let t = it.targets.find((x) => x.channel === channel);
  const out = { logged: null, noVenue: false, message: '' };
  if (action === 'add') {
    if (!t) { t = { channel, state: 'due', extra: true }; it.targets.push(t); out.message = ch.name + ' added to this slot.'; }
    else out.message = ch.name + ' is already a target of this slot.';
  } else if (!t) {
    throw new Error(ch.name + ' is not a target of slot ' + id + ': add it first');
  } else if (action === 'remove') {
    if (!t.extra) throw new Error('Only a channel you added can be removed; skip it with a reason instead.');
    if (t.state !== 'due') throw new Error('Clear the record first.');
    it.targets = it.targets.filter((x) => x !== t);
    out.message = ch.name + ' removed from this slot.';
  } else if (action === 'post') {
    const url = String(o.url || '').trim().slice(0, 500);
    if (!url && !o.tick) throw new Error('Paste the post\'s link' + (ch.tick ? ', or tick it as posted' : ''));
    if (url && !ch.linkShape) throw new Error(ch.name + ' gives a post no public link: tick it as posted instead (add a note if you like).');
    if (!url && !ch.tick) throw new Error(ch.name + ' gives every post its own link: paste it, so the desk can check the format.');
    Object.assign(t, { state: 'posted', url: url || undefined, tick: url ? undefined : true, at: nowIso(), accepted: undefined, reason: undefined });
    if (o.note !== undefined) t.note = String(o.note).slice(0, 500);
    if (ch.venue && !t.logAt) {
      const entry = L.append({ venueId: ch.venue, toolPath: it.tool, template: ch.template, url: url || undefined, kind: 'post', note: 'calendar ' + it.id + ' · ' + ch.name + (url ? '' : ' (ticked, no link)') });
      t.logAt = entry.at;
      out.logged = entry;
    } else if (!ch.venue) {
      out.noVenue = true;
      out.message = ch.name + ' has no venue in venues.json, so this is recorded here without a log entry.';
    }
  } else if (action === 'skip') {
    const reason = String(o.reason || '').trim().slice(0, 300);
    if (!reason) throw new Error('A skip needs a reason (for example: cadence, not right for this tool, account not set up).');
    Object.assign(t, { state: 'skipped', reason, at: nowIso(), url: undefined, tick: undefined, accepted: undefined });
  } else if (action === 'clear') {
    Object.assign(t, { state: 'due', url: undefined, tick: undefined, reason: undefined, at: undefined, accepted: undefined, note: undefined });
  } else if (action === 'accept') {
    if (t.state !== 'posted' || !t.url) throw new Error('Nothing to accept: no link recorded.');
    t.accepted = true;
  } else {
    throw new Error('action must be post, skip, clear, accept, add or remove');
  }
  if (FORMATS[it.format]) it.platforms = it.targets.map((x) => CH.get(x.channel).name);
  save(cal);
  const item = viewItem(it, linkIndex(cal));
  out.item = item;
  out.target = item.targets.find((x) => x.channel === channel) || null;
  return out;
}

/* ----------------------------------------------------------- coverage */

/**
 * What has gone out, what is due and what was missed.
 *   coverage({ days: 14 }) ->
 *   { today, from, slots: [{ id, date, title, missing: [...], flagged: [...], warnings: [...] }],
 *     channels: [{ id, name, week: { posted, flagged, due, missed, skipped }, d30: {...} }],
 *     todaySlots: [{ id, title, missing: [{ channel, name, cadence }] }], noVenue: [...] }
 * Past and today's slots only; slots skipped as a whole are left out.
 */
function coverage(opts) {
  opts = opts || {};
  const days = Math.max(1, Math.min(90, parseInt(opts.days, 10) || 14));
  const cal = get();
  const today = cal.today;
  const from = addDays(today, -(days - 1));
  const in7 = addDays(today, -6);
  const in30 = addDays(today, -29);
  const live = cal.items.filter((it) => it.date <= today && it.status !== 'skipped');
  const slots = [];
  for (const it of live.filter((x) => x.date >= from)) {
    const missing = it.targets.filter((t) => !t.done && !t.flagged && t.state !== 'skipped').map((t) => ({ channel: t.channel, name: t.name, overdue: it.date < today }));
    const skippedNoReason = it.targets.filter((t) => t.state === 'skipped' && !t.reason).map((t) => ({ channel: t.channel, name: t.name }));
    const flagged = it.targets.filter((t) => t.flagged).map((t) => ({ channel: t.channel, name: t.name, url: t.url, issues: t.issues.filter((x) => x.level === 'bad') }));
    const warnings = it.targets.filter((t) => t.issues.some((x) => x.level === 'warn')).map((t) => ({ channel: t.channel, name: t.name, url: t.url, issues: t.issues.filter((x) => x.level === 'warn') }));
    slots.push({ id: it.id, date: it.date, title: it.title, tool: it.tool, formatLabel: it.formatLabel, progress: it.progress, state: it.state, missing: missing.concat(skippedNoReason), flagged, warnings, unassigned: it.unassigned || [] });
  }
  const blank = () => ({ posted: 0, flagged: 0, due: 0, missed: 0, skipped: 0 });
  const per = {};
  for (const c of CH.list()) per[c.id] = { id: c.id, name: c.name, venue: c.venue || '', week: blank(), d30: blank() };
  for (const it of live) {
    for (const t of it.targets) {
      const row = per[t.channel];
      if (!row) continue;
      const bucket = (b) => {
        if (t.state === 'skipped') b.skipped++;
        else if (t.done) b.posted++;
        else if (t.flagged) b.flagged++;
        else if (it.date === today) b.due++;
        else b.missed++;
      };
      if (it.date >= in7) bucket(row.week);
      if (it.date >= in30) bucket(row.d30);
    }
  }
  const channels = Object.values(per).filter((r) => Object.values(r.week).some(Boolean) || Object.values(r.d30).some(Boolean));
  const todaySlots = cal.items.filter((it) => it.date === today && it.status !== 'skipped').map((it) => ({
    id: it.id, title: it.title, tool: it.tool, formatLabel: it.formatLabel, progress: it.progress,
    missing: it.targets.filter((t) => !t.done).map((t) => {
      const ch = CH.get(t.channel);
      let cadence = null;
      if (ch.venue && !t.flagged) { try { const c = L.canPost(ch.venue, { toolPath: it.tool, template: ch.template }); cadence = { ok: c.ok, reasons: c.reasons }; } catch (e) { /* no register: say nothing */ } }
      return { channel: t.channel, name: t.name, flagged: t.flagged, issues: t.issues, cadence };
    })
  }));
  const noVenue = CH.list().filter((c) => !c.venue).map((c) => c.name);
  return { today, from, days, slots, channels, todaySlots, noVenue };
}

/** The calendar as CSV, for a spreadsheet or a shared planner. */
function csv() {
  const cal = get();
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = ['Date', 'Format', 'Tool', 'Path', 'Hook', 'Platforms', 'Reel Maker', 'Status', 'Posted URL', 'Channels', 'Targets'];
  const tgt = (t) => t.name + ': ' + (t.state === 'posted' ? (t.url || 'ticked') + (t.flagged ? ' (check the link)' : '') : t.state === 'skipped' ? 'skipped, ' + (t.reason || 'no reason') : 'due');
  return [head.map(q).join(',')].concat(cal.items.map((it) => [it.date, it.formatLabel, it.title, it.tool, it.hook, it.platforms.join(' / '), it.reel, it.state, it.postedUrl, it.progress.label, it.targets.map(tgt).join(' | ')].map(q).join(','))).join('\r\n') + '\r\n';
}

module.exports = { plan, get, setStatus, target, coverage, csv, migrate, linkKey, FORMATS, WEEK, DAYS, GAP, FILE };
