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
 * is not repeated within 21 days. Status (planned → made → posted, with
 * the post's URL) is kept in calendar.json in the desk's data folder, so
 * re-planning keeps what you have done.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./log');
const T = require('./tools');

const FILE = () => path.join(L.home(), 'calendar.json');
const DAYS = 90;
const GAP = 21;
const REEL = 'https://www.1234tools.com/ai-video/reel-maker/?tool=';

const FORMATS = {
  problem: { label: 'Problem → solution', platforms: ['Instagram Reels', 'YouTube Shorts', 'TikTok'] },
  before: { label: 'Before / after', platforms: ['Instagram Reels', 'TikTok', 'Pinterest idea pin'] },
  dev: { label: '10-second developer trick', platforms: ['YouTube Shorts', 'X', 'LinkedIn'] },
  india: { label: 'India finance', platforms: ['Instagram Reels', 'YouTube Shorts', 'WhatsApp status'] },
  ai: { label: 'AI at work', platforms: ['LinkedIn', 'YouTube Shorts', 'Instagram Reels'] }
};

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

function load() {
  try { const j = JSON.parse(fs.readFileSync(FILE(), 'utf8')); if (j && Array.isArray(j.items)) return j; } catch (e) { /* none yet */ }
  return null;
}
function save(cal) {
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  const tmp = FILE() + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cal, null, 1));
  fs.renameSync(tmp, FILE());
}

/** A fresh plan from `start` (YYYY-MM-DD), keeping the status of any slot already done. */
function plan(start) {
  const S = require('./stories/index.js');
  const old = load();
  const kept = {};
  if (old) for (const it of old.items) if (it.status !== 'planned') kept[it.id] = it;
  const by = pools();
  const cursor = { problem: 0, before: 0, dev: 0, india: 0, ai: 0 };
  const lastUsed = {};
  const items = [];
  const s = localDate(start || iso(new Date()));
  for (let i = 0; i < DAYS; i++) {
    const day = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
    const date = iso(day);
    WEEK[day.getDay()].forEach((fmt, slot) => {
      const id = date + ':' + slot;
      if (kept[id]) { items.push(kept[id]); lastUsed[kept[id].tool] = i; return; }
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
        platforms: FORMATS[fmt].platforms, reel: REEL + encodeURIComponent(pick.path),
        status: 'planned', postedUrl: '', note: ''
      });
    });
  }
  const cal = { v: 1, start: iso(s), made: new Date().toISOString(), items };
  save(cal);
  return cal;
}

function get() { return load() || plan(); }

function setStatus(id, status, postedUrl, note) {
  if (!['planned', 'made', 'posted', 'skipped'].includes(status)) throw new Error('status must be planned, made, posted or skipped');
  const cal = get();
  const it = cal.items.find((x) => x.id === id);
  if (!it) throw new Error('no calendar slot ' + id);
  it.status = status;
  if (postedUrl !== undefined) it.postedUrl = String(postedUrl).slice(0, 500);
  if (note !== undefined) it.note = String(note).slice(0, 500);
  it.statusAt = new Date().toISOString();
  save(cal);
  return it;
}

/** The calendar as CSV, for a spreadsheet or a shared planner. */
function csv() {
  const cal = get();
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = ['Date', 'Format', 'Tool', 'Path', 'Hook', 'Platforms', 'Reel Maker', 'Status', 'Posted URL'];
  return [head.map(q).join(',')].concat(cal.items.map((it) => [it.date, it.formatLabel, it.title, it.tool, it.hook, it.platforms.join(' / '), it.reel, it.status, it.postedUrl].map(q).join(','))).join('\r\n') + '\r\n';
}

module.exports = { plan, get, setStatus, csv, FORMATS, WEEK, DAYS, GAP };
