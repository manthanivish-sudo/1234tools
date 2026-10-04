/**
 * What the desk remembers between runs, beside the posting log in
 * PROMO_HOME (default %USERPROFILE%/.1234tools-promo):
 *
 *   opportunities.json  every question the finder has found, keyed by its
 *                       URL, with when it was first and last seen, the
 *                       search that found it, and where you are with it:
 *                       new → drafted → answered, or dismissed
 *   drafts.json         drafts you edited, keyed by tool + venue + template
 *                       + variant, so closing the desk or restarting the
 *                       server does not lose a half-written reply
 *
 * The finder's raw responses are cached separately (find.js, 30 minutes);
 * this is the part that is yours and is never thrown away by a timer.
 * Writes go to a temporary file first and are then renamed into place, so
 * a crash mid-write leaves the previous file intact. Nothing here leaves
 * the machine.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./log');

const STATUSES = ['new', 'drafted', 'answered', 'dismissed'];
const MAX_OPPS = 5000;
const MAX_DRAFTS = 500;

function file(name) { return path.join(L.home(), name); }

function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); }
  catch (e) { return fallback; }
}

function writeJson(name, data) {
  const target = file(name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, target);
}

const now = () => (process.env.PROMO_NOW ? new Date(process.env.PROMO_NOW) : new Date()).toISOString();

/* ---------- opportunities ---------- */

function loadOpps() {
  const j = readJson('opportunities.json', null);
  return j && j.items && typeof j.items === 'object' ? j : { v: 1, items: {} };
}

/**
 * Merge a finder run into the store. Items already known keep their status
 * and first-seen date; their score, reply count and match are refreshed.
 * Returns the merged items in the order given, each with its saved state.
 */
function mergeOpps(items, query) {
  const db = loadOpps();
  const at = now();
  const out = [];
  for (const it of items || []) {
    if (!it || !it.url) continue;
    const was = db.items[it.url];
    const rec = Object.assign({}, was || {}, it, {
      firstSeen: was ? was.firstSeen : at,
      lastSeen: at,
      status: was ? was.status : 'new',
      statusAt: was ? was.statusAt : at,
      query: Object.assign({}, (was && was.query) || {}, query || {})
    });
    db.items[it.url] = rec;
    out.push(rec);
  }
  prune(db);
  writeJson('opportunities.json', db);
  return out;
}

/** Keep the store bounded: drop the oldest dismissed, then the oldest answered. */
function prune(db) {
  const keys = Object.keys(db.items);
  if (keys.length <= MAX_OPPS) return;
  const rank = { dismissed: 0, answered: 1, drafted: 2, new: 3 };
  keys.sort((a, b) => (rank[db.items[a].status] - rank[db.items[b].status]) || String(db.items[a].lastSeen).localeCompare(String(db.items[b].lastSeen)));
  for (const k of keys.slice(0, keys.length - MAX_OPPS)) delete db.items[k];
}

/** Saved opportunities, newest first; filter by status, tool or audience. */
function listOpps(f) {
  f = f || {};
  const all = Object.values(loadOpps().items);
  const counts = { all: all.length };
  for (const s of STATUSES) counts[s] = all.filter((x) => x.status === s).length;
  let list = all;
  if (f.status && f.status !== 'all') list = list.filter((x) => x.status === f.status);
  if (f.tool) list = list.filter((x) => x.query && x.query.tool === f.tool);
  if (f.audience) list = list.filter((x) => x.query && x.query.audience === f.audience);
  list.sort((a, b) => String(b.created || b.firstSeen).localeCompare(String(a.created || a.firstSeen)));
  return { items: list, counts };
}

function setOppStatus(url, status, note) {
  if (STATUSES.indexOf(status) < 0) throw new Error('status must be one of ' + STATUSES.join(', '));
  const db = loadOpps();
  const it = db.items[url];
  if (!it) throw new Error('no saved opportunity with that URL');
  it.status = status;
  it.statusAt = now();
  if (note !== undefined) it.note = String(note).slice(0, 500);
  writeJson('opportunities.json', db);
  return it;
}

/* ---------- drafts ---------- */

function draftKey(d) {
  return [d.tool || '', d.venue || '', d.template || '', d.variant == null ? 0 : d.variant, d.qurl || ''].join('|');
}

function loadDrafts() {
  const j = readJson('drafts.json', null);
  return j && j.items && typeof j.items === 'object' ? j : { v: 1, items: {} };
}

function getDraft(d) { return loadDrafts().items[draftKey(d)] || null; }

/** Save the edited parts of a draft ({ key: text }); an empty parts object deletes it. */
function saveDraft(d, parts) {
  const db = loadDrafts();
  const key = draftKey(d);
  if (!parts || !Object.keys(parts).length) delete db.items[key];
  else {
    const clean = {};
    for (const [k, v] of Object.entries(parts)) clean[String(k).slice(0, 40)] = String(v).slice(0, 20000);
    db.items[key] = { tool: d.tool || '', venue: d.venue || '', template: d.template || '', variant: d.variant == null ? 0 : Number(d.variant), qurl: d.qurl || '', question: d.question || '', parts: clean, updatedAt: now() };
  }
  const keys = Object.keys(db.items);
  if (keys.length > MAX_DRAFTS) {
    keys.sort((a, b) => String(db.items[a].updatedAt).localeCompare(String(db.items[b].updatedAt)));
    for (const k of keys.slice(0, keys.length - MAX_DRAFTS)) delete db.items[k];
  }
  writeJson('drafts.json', db);
  return db.items[key] || null;
}

function listDrafts() {
  return Object.values(loadDrafts().items).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

module.exports = { STATUSES, mergeOpps, listOpps, setOppStatus, getDraft, saveDraft, listDrafts, draftKey, file };
