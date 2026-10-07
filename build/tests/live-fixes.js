#!/usr/bin/env node
/**
 * The live time tools — stopwatch, timers and Pomodoro, the countdown and
 * the time zone converter — proved in Node and in headless Chrome against a
 * static server of the site:
 *
 *   node build/tests/live-fixes.js [--port 8670] [--root <site>] [--repo <git checkout>] [--w0a <file>] [--only n,m]
 *
 * --root defaults to the site this file sits in, served on --port by
 * build/tests/serve.js (ports 8670-8679 are this test's). --repo is the git
 * checkout the "before" engine is read from (default: the one this file sits
 * in; read-only, `git show`; skipped loudly when git or the commit is not
 * there). --w0a is the engine as wave 0-A left it (an alarm on a timeout,
 * the tone made at the deadline), default E:/tmp/w0a/engine/render-live.js,
 * skipped loudly when absent. --only runs those numbered cases (N for the
 * Node part). Exit code 2 when a case fails, 1 when the run itself breaks.
 *
 * When a countdown ends is taken three ways, none of them the engine's own
 * bookkeeping: the sound itself, heard by an AudioWorklet put between the
 * page's audio and the speaker (the moment the first loud sample reaches the
 * output, on the wall clock); each oscillator the page starts, with the
 * moment it was told to play and whether it was taken back before playing;
 * and the "is-done" class arriving. The deadline is the Start click's time
 * plus the duration typed in. Beside it, the page arms its own plain timeout
 * for the same deadline at the same moment: when a loaded machine runs even
 * that one more than 250 ms late, a timeout-driven end is held to within
 * 250 ms of it instead, and the line says so. The page is put behind a
 * second tab, so the browser itself reports it hidden and stops its
 * animation frames (both are checked, not assumed).
 *
 *  N  Node: the pure functions in engine/live.bundle.js against references
 *     written here — clock changes from the EU and US rules, wall times in
 *     a gap and an overlap, the planner on fixed-offset zones, repeating
 *     dates by plain counting, the .ics file by RFC 5545's rules, the zone
 *     search over engine/live-zones.js
 *  1  timer, 6 s, the tab hidden 0.4 s after Start: the tone is heard within
 *     250 ms of the deadline, while hidden, and the panel is marked done
 *  2  pomodoro, phases of 6 s, hidden: the end of Work and the end of Break
 *     are each heard within 250 ms of their deadlines (the second 6 s after
 *     the first), and the phases move on to Break, then Work, cycle 2
 *  3  timers held back (as Chrome does in a tab hidden for over five
 *     minutes; stood in for, harder than Chrome, by never running a timeout
 *     or frame that comes due while hidden): the tone is still heard on time
 *     (it is on the audio clock), and the panel is marked done within 250 ms
 *     of the tab being shown again, from the visibilitychange re-check
 *  4  Pause takes the tone back: a paused 2 s timer, hidden, makes no sound
 *  5  BEFORE (the engine at 364240974, served in place of the current one):
 *     the hidden 6 s timer does not end until the tab is shown again
 *  6  background wake-ups late by 0.9 s (real Chrome wakes a hidden tab's
 *     timeouts about once a second, which headless Chrome does not; stood in
 *     for by holding each timeout that comes due while hidden 900 ms more):
 *     the panel is marked late, and the tone is still heard on time
 *  7  BEFORE (wave 0-A's engine) under the same wake-ups: the tone comes
 *     with the late timeout, about 0.9 s after the deadline
 *  8  a running timer survives a reload: same deadline, and after one click
 *     its tone is back on the clock for it
 *  9  two timers at once, 6 s and 8 s, hidden: two tones, each on time
 * 10  keys: Space starts and stops the stopwatch, L laps, R resets; the
 *     laps CSV adds up (each split is the difference of the totals)
 * 11  a running stopwatch survives a reload and keeps counting
 * 12  countdown from a share link: the fields read the link, the tone is
 *     heard within 250 ms of zero in a hidden tab, a notification is shown
 *     (permission granted), the tab title counts down
 * 13  time zone converter from a share link: 01:30 on the morning the UK
 *     clocks go forward is called out and taken as 02:30, the planner has 23
 *     hours that day, the .ics file starts at 01:30Z, a searched city is
 *     added and goes into the share state, and the share bar offers
 *     "Include my settings"
 * 14  the planner's shared working hours, London and Paris: 09:00–16:00
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8670));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const REPO = path.resolve(arg('--repo', path.join(__dirname, '..', '..')));
const W0A = arg('--w0a', 'E:/tmp/w0a/engine/render-live.js');
const ONLY = arg('--only', '') ? arg('--only', '').split(',') : null;
const want = (n) => !ONLY || ONLY.indexOf(String(n)) >= 0;
const BEFORE = '364240974';
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE = '/time/stopwatch-timer/';
const TOLERANCE = 250;
const EARLY_OK = 30;          // the engine counts a deadline 25 ms away as due (a timeout can wake a hair early)
const SPAN = 6000;            // each countdown: long enough to hide the page first, even on a loaded machine
const KEYS = ['1234tools.stopwatch.v1', '1234tools.countdown.v1', '1234tools.timezone.v1'];

let pass = 0, fail = 0, skipped = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (detail !== undefined && !ok ? '   (' + String(detail).slice(0, 600) + ')' : ''));
}
function skip(what) { skipped++; console.log('SKIP  ' + what); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ================================================================== */
/* N  the pure functions, in Node                                      */
/* ================================================================== */

function nodePart() {
  console.log('\nN. engine/live.bundle.js and engine/live-zones.js in Node');
  const window = {};
  const ctx = vm.createContext({ window, Intl, Math, Date, Number, String, Array, Object, JSON, Set, Map, TextEncoder, console, isFinite, isNaN, parseFloat, parseInt });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine', 'live-zones.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine', 'live.bundle.js'), 'utf8'), ctx);
  const L = window.MVRLive, Z = window.MVRZones;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 16) + 'Z';
  /* the n-th weekday of a month, and the last one, by counting (UTC dates) */
  const nth = (y, m, dow, n) => { const d = new Date(Date.UTC(y, m - 1, 1)); while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1); d.setUTCDate(d.getUTCDate() + 7 * (n - 1)); return d.getUTCDate(); };
  const last = (y, m, dow) => { const d = new Date(Date.UTC(y, m, 0)); while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() - 1); return d.getUTCDate(); };

  /* clock changes: the EU rule (since 1996: last Sunday of March and of
     October at 01:00 UTC) and the US rule (since 2007: second Sunday of
     March at 02:00 EST = 07:00 UTC, first Sunday of November at 02:00 EDT
     = 06:00 UTC) */
  let bad = [];
  for (let y = 2000; y <= 2040; y++) {
    const got = L.zoneTransitions('Europe/London', Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1)).map(t => iso(t.at) + ' ' + t.from + '>' + t.to);
    const exp = [iso(Date.UTC(y, 2, last(y, 3, 0), 1)) + ' 0>60', iso(Date.UTC(y, 9, last(y, 10, 0), 1)) + ' 60>0'];
    if (got.join() !== exp.join()) bad.push(y + ' London: ' + got.join(', ') + ' (want ' + exp.join(', ') + ')');
    const paris = L.zoneTransitions('Europe/Paris', Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1)).map(t => iso(t.at));
    if (paris.join() !== [exp[0].slice(0, 17), exp[1].slice(0, 17)].join()) bad.push(y + ' Paris: ' + paris.join(', '));
    if (y >= 2007) {
      const ny = L.zoneTransitions('America/New_York', Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1)).map(t => iso(t.at) + ' ' + t.from + '>' + t.to);
      const ex = [iso(Date.UTC(y, 2, nth(y, 3, 0, 2), 7)) + ' -300>-240', iso(Date.UTC(y, 10, nth(y, 11, 0, 1), 6)) + ' -240>-300'];
      if (ny.join() !== ex.join()) bad.push(y + ' New York: ' + ny.join(', ') + ' (want ' + ex.join(', ') + ')');
    }
  }
  check(!bad.length, 'N  clock changes 2000–2040: London and Paris by the EU rule, New York by the US rule (2007 on), to the minute', bad.slice(0, 4).join(' | '));
  const kol = L.zoneTransitions('Asia/Kolkata', Date.UTC(2000, 0, 1), Date.UTC(2040, 0, 1)), tok = L.zoneTransitions('Asia/Tokyo', Date.UTC(2000, 0, 1), Date.UTC(2040, 0, 1));
  check(!kol.length && !tok.length, 'N  Kolkata and Tokyo: no clock change in 40 years', kol.length + ' ' + tok.length);

  /* wall times: the hour skipped and the hour repeated */
  bad = [];
  for (let y = 2010; y <= 2035; y++) {
    const sp = last(y, 3, 0), au = last(y, 10, 0);
    const g = L.resolveWallTime(y, 3, sp, 1, 30, 'Europe/London');
    if (g.status !== 'gap' || iso(g.at) !== iso(Date.UTC(y, 2, sp, 1, 30)) || g.wall.h !== 2 || g.wall.mi !== 30) bad.push(y + ' gap ' + JSON.stringify(g));
    const o = L.resolveWallTime(y, 10, au, 1, 30, 'Europe/London');
    if (o.status !== 'overlap' || iso(o.at) !== iso(Date.UTC(y, 9, au, 0, 30)) || iso(o.later) !== iso(Date.UTC(y, 9, au, 1, 30))) bad.push(y + ' overlap ' + JSON.stringify(o));
    const k = L.resolveWallTime(y, 6, 15, 9, 0, 'Asia/Kolkata');
    if (k.status !== 'ok' || iso(k.at) !== iso(Date.UTC(y, 5, 15, 3, 30))) bad.push(y + ' Kolkata ' + JSON.stringify(k));
    const n = L.resolveWallTime(y, 3, nth(y, 3, 0, 2), 2, 30, 'America/New_York');
    if (y >= 2007 && (n.status !== 'gap' || n.wall.h !== 3)) bad.push(y + ' New York gap ' + JSON.stringify(n));
  }
  check(!bad.length, 'N  01:30 on the UK spring-forward morning is a gap taken as 02:30 (01:30Z); on the autumn morning it is the first of two, 00:30Z then 01:30Z; New York 02:30 is a gap; 2010–2035', bad.slice(0, 3).join(' | '));

  /* the planner on zones with one fixed offset all year: plain arithmetic */
  const day = Date.UTC(2026, 6, 1, 0, 0) - 330 * 60000;          // 1 July 2026, 00:00 in Kolkata
  const rows = L.plannerRows(day, 24, ['Asia/Kolkata', 'Asia/Tokyo', 'UTC'], 'Asia/Kolkata', { start: 9, end: 17 });
  bad = [];
  const cls = (t, dow) => (dow === 0 || dow === 6) ? 'off' : (t >= 9 && t < 17) ? 'work' : ((t >= 7 && t < 9) || (t >= 17 && t < 21)) ? 'edge' : 'night';
  [['Asia/Kolkata', 330], ['Asia/Tokyo', 540], ['UTC', 0]].forEach(([z, off], r) => {
    for (let i = 0; i < 24; i++) {
      const at = day + i * 3600000, local = at + off * 60000;
      const lt = new Date(local), t = lt.getUTCHours() + lt.getUTCMinutes() / 60;
      const c = rows[r].cells[i];
      const shift = Math.round((Date.UTC(lt.getUTCFullYear(), lt.getUTCMonth(), lt.getUTCDate()) - Date.UTC(2026, 6, 1)) / 86400000);
      if (c.h !== lt.getUTCHours() || c.mi !== lt.getUTCMinutes() || c.cls !== cls(t, lt.getUTCDay()) || c.shift !== shift) bad.push(z + ' col ' + i + ': ' + JSON.stringify(c) + ' want ' + lt.toISOString() + ' ' + cls(t, lt.getUTCDay()) + ' shift ' + shift);
    }
  });
  check(!bad.length, 'N  planner, 1 July 2026 from Kolkata: every cell of Kolkata (+5:30), Tokyo (+9) and UTC has the local hour, minute, day shift and class arithmetic gives', bad.slice(0, 3).join(' | '));
  const sh = L.sharedWorkHours(rows.slice(0, 2));
  check(sh.length === 1 && sh[0].from === 9 && sh[0].to === 14, 'N  the planner columns that start inside working hours in both Kolkata and Tokyo: 09:00 to 13:00 (five columns)', JSON.stringify(sh));
  /* Tokyo's 09:00–17:00 is 05:30–13:30 in Kolkata */
  const ex = L.sharedWorkTimes(day, day + 86400000, ['Asia/Kolkata', 'Asia/Tokyo'], { start: 9, end: 17 }).map(x => iso(x.from) + '/' + iso(x.to));
  check(ex.join() === iso(day + 9 * 3600000) + '/' + iso(day + 13.5 * 3600000), 'N  the time shared, to the minute: 09:00–13:30 Kolkata (Tokyo 12:30–17:00)', ex.join());
  const sat = L.plannerRows(Date.UTC(2026, 6, 4) - 330 * 60000, 24, ['Asia/Kolkata'], 'Asia/Kolkata', {});
  check(sat[0].cells.every(c => c.cls === 'off'), 'N  a Saturday is all weekend', sat[0].cells.map(c => c.cls).join(''));

  /* repeating dates, by counting forward one step at a time from the first */
  bad = [];
  let seed = 0x7e57;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let k = 0; k < 400; k++) {
    const rep = ['daily', 'weekly', 'monthly', 'yearly'][k % 4];
    const zone = k % 3 ? 'UTC' : 'Asia/Kolkata';
    const off = zone === 'UTC' ? 0 : 330;
    const y = 1990 + Math.floor(rnd() * 40), mo = 1 + Math.floor(rnd() * 12), d = k % 7 === 0 ? 31 : k % 11 === 0 && mo === 2 ? 29 : 1 + Math.floor(rnd() * 28), h = Math.floor(rnd() * 24), mi = Math.floor(rnd() * 60);
    const dd = Math.min(d, dim(y, mo));
    const now = Date.UTC(2000 + Math.floor(rnd() * 40), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28), Math.floor(rnd() * 24));
    let n = 0, cy = y, cm = mo, cd = dd, t;
    for (;;) {
      if (rep === 'daily' || rep === 'weekly') { const x = new Date(Date.UTC(y, mo - 1, dd + n * (rep === 'daily' ? 1 : 7))); cy = x.getUTCFullYear(); cm = x.getUTCMonth() + 1; cd = x.getUTCDate(); }
      else { const months = (mo - 1) + n * (rep === 'monthly' ? 1 : 12); cy = y + Math.floor(months / 12); cm = months % 12 + 1; cd = Math.min(d, dim(cy, cm)); }
      t = Date.UTC(cy, cm - 1, cd, h, mi) - off * 60000;
      if (t >= now) break;
      n++;
    }
    const got = L.nextOccurrence({ y, mo, d: dd, h, mi, zone, repeat: rep }, now);
    const gotM = L.nextOccurrence({ y, mo, d, h, mi, zone, repeat: rep }, now);
    if (got.at !== t && !(rep === 'monthly' || rep === 'yearly')) bad.push(rep + ' ' + [y, mo, dd, h, mi, zone].join('/') + ' now ' + iso(now) + ': ' + iso(got.at) + ' want ' + iso(t));
    if ((rep === 'monthly' || rep === 'yearly') && gotM.at !== t) bad.push(rep + ' ' + [y, mo, d, h, mi, zone].join('/') + ' now ' + iso(now) + ': ' + iso(gotM.at) + ' want ' + iso(t));
  }
  check(!bad.length, 'N  400 repeating events (daily, weekly, monthly, yearly; the 31st and 29 February kept to month ends): the next one matches counting forward step by step', bad.slice(0, 3).join(' | '));
  const lon = L.nextOccurrence({ y: 2026, mo: 3, d: 1, h: 9, mi: 0, zone: 'Europe/London', repeat: 'monthly' }, Date.UTC(2026, 3, 2));
  check(iso(lon.at) === '2026-05-01T08:00Z', 'N  a monthly 09:00 London event stays at 09:00 on the wall across the clock change (1 May = 08:00Z)', iso(lon.at));

  /* the calendar file, by RFC 5545's rules */
  const ics = L.buildICS({ title: 'Planning; Q4, “budget” review \\ room 2\nsecond line — and a long title that has to be folded because it runs well past seventy-five octets', start: Date.UTC(2026, 6, 1, 8, 0), minutes: 45, description: 'London: Wed 01 Jul 2026, 09:00\nNew York: Wed 01 Jul 2026, 04:00', uid: 'test@1234tools', now: Date.UTC(2026, 5, 1) });
  const raw = ics.split('\r\n');
  const octets = raw.map(l => Buffer.byteLength(l, 'utf8'));
  const unfolded = ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
  const prop = (k) => (unfolded.find(l => l.startsWith(k + ':')) || '').slice(k.length + 1);
  const unesc = (s) => s.replace(/\\n/g, '\n').replace(/\\([;,\\])/g, '$1');
  check(!/[^\r]\n/.test(ics) && ics.endsWith('\r\n') && Math.max(...octets) <= 75 && raw.slice(0, -1).every(l => l.length > 0),
    'N  .ics: CRLF line ends, no line over 75 octets (longest ' + Math.max(...octets) + '), folded lines continue with a space', JSON.stringify(octets));
  check(prop('DTSTART') === '20260701T080000Z' && prop('DTEND') === '20260701T084500Z' && prop('DTSTAMP') === '20260601T000000Z' && prop('UID') === 'test@1234tools',
    'N  .ics: DTSTART 20260701T080000Z, DTEND 45 minutes later, in UTC', unfolded.join(' | '));
  check(unesc(prop('SUMMARY')) === 'Planning; Q4, “budget” review \\ room 2\nsecond line — and a long title that has to be folded because it runs well past seventy-five octets' && unfolded[0] === 'BEGIN:VCALENDAR' && unfolded.includes('BEGIN:VEVENT') && unfolded.includes('END:VEVENT') && unfolded[unfolded.length - 1] === 'END:VCALENDAR' && unfolded.includes('VERSION:2.0'),
    'N  .ics: the title comes back exactly after unfolding and unescaping (; , \\ and a new line), inside VCALENDAR/VEVENT', prop('SUMMARY'));

  /* the zone list and the search */
  const valid = (id) => { try { new Intl.DateTimeFormat('en-GB', { timeZone: id }); return true; } catch (e) { return false; } };
  const ids = new Set(Z.zones.map(z => z.id));
  const invalid = Z.zones.filter(z => !valid(z.id)).map(z => z.id);
  check(Z.zones.length === 418 && invalid.every(id => id === 'America/Coyhaique'), 'N  live-zones.js: the 418 zones of tzdb 2026e; all but America/Coyhaique (new in 2025) are known to this Node\'s Intl, and that one is dropped at run time', invalid.join(','));
  const badLinks = Object.keys(Z.links).filter(k => !ids.has(Z.links[k]) || ids.has(k));
  check(!badLinks.length && Z.links['Asia/Calcutta'] === 'Asia/Kolkata' && Z.links['Europe/Kiev'] === 'Europe/Kyiv', 'N  every old name points at a current zone (Asia/Calcutta → Asia/Kolkata, Europe/Kiev → Europe/Kyiv)', badLinks.join(','));
  const idx = L.buildZoneIndex(Z, { valid, country: (cc) => new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(cc) });
  const icu = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [];
  const lost = icu.filter(z => !L.canonicalZone(idx, z));
  check(icu.length > 300 && !lost.length, 'N  every one of the ' + icu.length + ' zone names Node\'s Intl reports resolves to a zone in the list', lost.join(','));
  bad = [];
  Z.aliases.forEach(a => a.names.forEach(n => {
    const r = L.searchZones(idx, n, 5);
    if (!r.length || r[0].id !== a.id) bad.push(n + ' → ' + (r[0] ? r[0].id : 'nothing') + ' (want ' + a.id + ')');
  }));
  check(!bad.length, 'N  every place name in the alias list (' + Z.aliases.reduce((s, a) => s + a.names.length, 0) + ') finds its own zone first', bad.slice(0, 6).join(' | '));
  const top = (q) => (L.searchZones(idx, q, 5, { offsetOf: (z) => L.offsetAt(Date.UTC(2026, 0, 15), z) })[0] || {}).id;
  const cases = [['tokyo', 'Asia/Tokyo'], ['new york', 'America/New_York'], ['São Paulo', 'America/Sao_Paulo'], ['IST', 'Asia/Kolkata'], ['india', 'Asia/Kolkata'], ['japan', 'Asia/Tokyo'], ['utc', 'UTC'], ['+5:45', 'Asia/Kathmandu'], ['buenos', 'America/Argentina/Buenos_Aires']];
  bad = cases.filter(([q, z]) => top(q) !== z).map(([q, z]) => q + ' → ' + top(q) + ' (want ' + z + ')');
  check(!bad.length, 'N  searches by city, accented name, abbreviation, country, UTC and offset (+5:45 → Kathmandu) find the zone first', bad.join(' | '));
}

/* ================================================================== */
/* the browser                                                         */
/* ================================================================== */

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}
const sleepUntil = (t) => sleep(Math.max(0, t - Date.now()));

/* In the page before its scripts. Each oscillator the page starts: when it
   is told to play (on the wall clock) and whether it is stopped before that
   moment (taken back). The sound itself: an AudioWorklet between the page's
   audio and the speaker posts the audio time of each start of sound after
   silence, turned into wall-clock time with getOutputTimestamp. When Start is
   clicked (capture phase, before the engine reads the clock), a plain
   timeout for the deadline armed at that moment (window.__startMs), when a
   panel turns is-done, when the page is hidden or shown, how many animation
   frames have run, notifications shown, and files made for download. The
   tools' own storage starts empty unless sessionStorage.__keep says not. */
function INSTRUMENT(keys) {
  window.__tones = []; window.__sound = []; window.__done = []; window.__starts = []; window.__vis = [];
  window.__frames = 0; window.__control = []; window.__startMs = 0; window.__notes = []; window.__blobs = [];
  try { if (!sessionStorage.getItem('__keep')) keys.forEach((k) => localStorage.removeItem(k)); } catch (e) { /* none */ }
  const st = window.setTimeout;
  const control = (ms) => st.call(window, () => window.__control.push(Date.now()), ms);
  const AC = window.AudioContext;
  const TAP = 'class Tap extends AudioWorkletProcessor{constructor(){super();this.on=false}process(i){const c=i[0]&&i[0][0];let l=false;if(c)for(let k=0;k<c.length;k++)if(Math.abs(c[k])>0.01){l=true;break}if(l&&!this.on)this.port.postMessage(currentTime);this.on=l;return true}}registerProcessor("tap",Tap);';
  if (AC) {
    const realDest = AC.prototype.__lookupGetter__('destination');
    window.AudioContext = class extends AC {
      constructor(...a) {
        super(...a);
        const real = realDest.call(this), self = this;
        (window.__ctxs = window.__ctxs || []).push(this);
        const bus = this.createGain(); bus.connect(real);
        Object.defineProperty(this, 'destination', { value: bus, configurable: true });
        this.audioWorklet.addModule(URL.createObjectURL(new Blob([TAP], { type: 'application/javascript' }))).then(() => {
          const n = new AudioWorkletNode(self, 'tap'); bus.connect(n); n.connect(real);
          /* the audio clock against the wall clock from here on: a starved audio thread shows as lag */
          self.__mark = { wall: Date.now(), audio: self.currentTime };
          n.port.onmessage = (e) => {
            const ts = self.getOutputTimestamp();
            window.__sound.push(Math.round(Date.now() + (ts.performanceTime + (e.data - ts.contextTime) * 1000 - performance.now())));
          };
        }).catch(() => { window.__tapFailed = true; });
      }
    };
  }
  const start = OscillatorNode.prototype.start, stop = OscillatorNode.prototype.stop;
  OscillatorNode.prototype.start = function (when) {
    const lead = Math.max(0, ((when || 0) - this.context.currentTime) * 1000);
    this.__rec = { at: Math.round(Date.now() + lead), called: Date.now(), when: when || 0, cancelled: false };
    window.__tones.push(this.__rec);
    return start.apply(this, arguments);
  };
  OscillatorNode.prototype.stop = function (when) {
    const r = this.__rec;
    if (r && !r.cancelled && (when || 0) < r.when - 0.0005 && this.context.currentTime < r.when) r.cancelled = true;
    return stop.apply(this, arguments);
  };
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (f) { return raf.call(window, (t) => { window.__frames++; f(t); }); };
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.sw-buttons .btn-primary')) { window.__starts.push({ at: Date.now(), label: e.target.textContent }); if (window.__startMs) control(window.__startMs); }
  }, true);
  document.addEventListener('visibilitychange', () => window.__vis.push([document.visibilityState, Date.now()]));
  const add = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function () { if ([].indexOf.call(arguments, 'is-done') >= 0 && !this.contains('is-done')) window.__done.push(Date.now()); return add.apply(this, arguments); };
  if (window.Notification) {
    const N = window.Notification;
    const F = function (title, o) { window.__notes.push({ title, body: o && o.body, at: Date.now() }); return { close() {} }; };
    F.requestPermission = (cb) => N.requestPermission(cb);
    Object.defineProperty(F, 'permission', { get: () => N.permission });
    window.Notification = F;
  }
  const cou = URL.createObjectURL;
  URL.createObjectURL = function (b) { if (b && b.text && !/javascript/.test(b.type)) b.text().then((t) => window.__blobs.push({ type: b.type, text: t })); return cou.apply(URL, arguments); };
  HTMLAnchorElement.prototype.click = function () { window.__blobs.push({ name: this.download }); };
}
/* Chrome's intensive throttling, stood in for, harder than the real thing:
   a timeout that comes due while the page is hidden never runs, and once the
   page has been hidden no animation frame runs again, so only the
   visibilitychange re-check can end the countdown when the tab comes back. */
function HOLD_BACK() {
  const st = window.setTimeout, raf = window.requestAnimationFrame;
  const held = [];
  let wasHidden = false;
  document.addEventListener('visibilitychange', () => { if (document.hidden) wasHidden = true; }, true);
  window.setTimeout = function (f, ms) {
    const args = [].slice.call(arguments, 2);
    return st.call(window, function () { if (document.hidden) { held.push(f); return; } f.apply(this, args); }, ms);
  };
  window.requestAnimationFrame = function (f) { return raf.call(window, function (t) { if (wasHidden) { held.push(f); return; } f(t); }); };
  window.__held = held;
}
/* Real Chrome's background wake-ups, stood in for at their late end: a
   timeout that comes due while the page is hidden runs 900 ms later. */
function ALIGN() {
  const st = window.setTimeout;
  window.__aligned = 0;
  window.setTimeout = function (f, ms) {
    const args = [].slice.call(arguments, 2);
    return st.call(window, function () {
      if (document.hidden && typeof f === 'function') { window.__aligned++; st.call(window, () => f.apply(this, args), 900); return; }
      if (typeof f === 'function') f.apply(this, args);
    }, ms);
  };
}
/* the page's clock moved by `ms` (Date and Date.now; Intl formats what it is given) */
function SHIFT(ms) {
  const RD = Date, now = RD.now.bind(RD);
  function D(...a) { if (!new.target) return RD(); return a.length ? new RD(...a) : new RD(now() + ms); }
  D.prototype = RD.prototype; D.now = () => now() + ms; D.UTC = RD.UTC; D.parse = RD.parse;
  window.Date = D;
}

let puppeteer = null;
async function open(browser, opts) {
  opts = opts || {};
  const p = await browser.newPage();
  await p.setViewport({ width: opts.width || 1280, height: 900 });
  p.__errors = [];
  p.on('pageerror', (e) => p.__errors.push(String(e && e.message || e)));
  /* the site's service worker would serve its cached engine past the swap below */
  await p.setBypassServiceWorker(true);
  p.__swapped = 0;
  if (opts.engine) {
    await p.setRequestInterception(true);
    p.on('request', (r) => {
      if (/\/engine\/render-live\.js(\?|$)/.test(r.url())) { p.__swapped++; return r.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body: opts.engine }); }
      r.continue();
    });
  }
  if (opts.shift) await p.evaluateOnNewDocument(SHIFT, opts.shift);
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* none */ } });
  await p.evaluateOnNewDocument(INSTRUMENT, KEYS);
  if (opts.holdBack) await p.evaluateOnNewDocument(HOLD_BACK);
  if (opts.align) await p.evaluateOnNewDocument(ALIGN);
  await p.goto(BASE + (opts.page || PAGE), { waitUntil: 'load' });
  if (!opts.page || opts.page === PAGE) await p.waitForSelector('.sw-tab[data-tab=timer]', { timeout: 20000 });
  return p;
}
/* the panels in the order the engine adds them: stopwatch, timer(s), pomodoro;
   the first three number inputs of a panel (its first timer's h, m, s) */
async function setInputs(p, i, values, timer) {
  await p.evaluate((i, values, timer) => {
    const panel = document.querySelectorAll('.tool-io .sw-panel')[i];
    const scope = timer !== undefined ? panel.querySelectorAll('.sw-timer')[timer] : panel;
    const inputs = scope.querySelectorAll('.sw-inputs input');
    values.forEach((v, k) => { inputs[k].value = String(v); inputs[k].dispatchEvent(new Event('input', { bubbles: true })); });
  }, i, values, timer);
}
const clickStart = async (p, i, timer) => {
  const h = await p.evaluateHandle((i, timer) => { const panel = document.querySelectorAll('.tool-io .sw-panel')[i]; return (timer !== undefined ? panel.querySelectorAll('.sw-timer')[timer] : panel).querySelector('.btn-primary'); }, i, timer);
  await h.click();
};
const text = (p, i, sel) => p.evaluate((i, sel) => [...document.querySelectorAll('.tool-io .sw-panel')[i].querySelectorAll(sel)].map((e) => e.textContent).join(', '), i, sel);
const state = (p) => p.evaluate(() => ({
  vis: document.visibilityState, frames: window.__frames, done: window.__done.slice(), starts: window.__starts.slice(), control: window.__control.slice(), changes: window.__vis.slice(),
  lag: (window.__ctxs || []).filter((c) => c.__mark).map((c) => Math.round((Date.now() - c.__mark.wall) - (c.currentTime - c.__mark.audio) * 1000)).reduce((a, b) => Math.max(a, b), 0),
  sound: window.__sound.slice(), tones: window.__tones.filter((t) => !t.cancelled).map((t) => t.at), taken: window.__tones.filter((t) => t.cancelled).length, tap: !window.__tapFailed, notes: window.__notes.slice()
}));
const firstChange = (s, to) => (s.changes.find((c) => c[0] === to) || [])[1];

/** Put the page behind a new tab, or, if the browser has not hidden it within
 *  6 s (seen on a loaded machine), minimise its window as well. Returns
 *  { close() } that brings the page back. */
async function hide(browser, p) {
  const other = await browser.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  const hidden = (ms) => p.waitForFunction(() => document.visibilityState === 'hidden', { timeout: ms }).then(() => true, () => false);
  let cdp = null, windowId = null;
  if (!(await hidden(6000))) {
    cdp = await p.target().createCDPSession();
    ({ windowId } = await cdp.send('Browser.getWindowForTarget'));
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
    if (!(await hidden(6000))) throw new Error('the page could not be hidden: neither another tab nor a minimised window hid it');
  }
  return {
    close: async () => {
      if (cdp) { await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } }); await cdp.detach(); }
      await other.close();
      await p.bringToFront();
      await p.waitForFunction(() => document.visibilityState === 'visible', { timeout: 10000 });
    }
  };
}
const lateness = (at, deadline) => at === undefined ? 'none' : (at - deadline) + ' ms';
/** On time, for an end driven by a timeout: within TOLERANCE of the
 *  deadline, and of the browser's own timeout for it. When that reference
 *  was itself held back past TOLERANCE (a loaded machine: other browsers
 *  running), the engine is judged against the reference alone, and the line
 *  says so. */
function timely(at, deadline, ref) {
  if (at === undefined) return { ok: false, say: 'none' };
  const late = at - deadline;
  if (ref === undefined || ref - deadline <= TOLERANCE) return { ok: late >= -EARLY_OK && late <= TOLERANCE, say: late + ' ms after the deadline' };
  const refLate = ref - deadline, behind = at - ref;
  return { ok: behind >= -EARLY_OK && behind <= TOLERANCE, say: late + ' ms after the deadline, ' + behind + ' ms after the browser\'s own timeout for it, which this loaded machine ran ' + refLate + ' ms late' };
}
/** On time, for a sound on the audio clock: within TOLERANCE of the deadline
 *  (timers play no part). On a loaded machine the audio thread itself can be
 *  starved, so its clock falls behind the wall clock (`lag`, measured over
 *  the case from the page's own AudioContext): a sound is then allowed that
 *  lag on top, and the line says so. */
function heard(at, deadline, lag) {
  if (at === undefined) return { ok: false, say: 'not heard' + (lag > 100 ? ' (the audio clock ran ' + lag + ' ms behind the wall clock on this loaded machine)' : '') };
  const late = at - deadline;
  if (!(lag > 100)) return { ok: late >= -EARLY_OK && late <= TOLERANCE, say: late + ' ms after the deadline' };
  return { ok: late >= -EARLY_OK && late <= TOLERANCE + lag, say: late + ' ms after the deadline, on a loaded machine whose audio clock ran ' + lag + ' ms behind the wall clock' };
}

/** A 6 s timer started, then hidden; what happened by 1.5 s past the deadline, still hidden. */
async function hiddenTimer(browser, opts) {
  const p = await open(browser, opts);
  await p.click('.sw-tab[data-tab=timer]');
  await setInputs(p, 1, [0, 0, SPAN / 1000]);
  await p.evaluate((ms) => { window.__startMs = ms; }, SPAN);
  await clickStart(p, 1);
  await sleep(400);
  const shade = await hide(browser, p);
  const s0 = await state(p);
  const deadline = s0.starts[0].at + SPAN;
  await sleepUntil(deadline - 300);
  const f1 = (await state(p)).frames;
  await sleepUntil(deadline + 1500 + (opts && opts.align ? 1000 : 0));
  const s = await state(p);
  const disp = await text(p, 1, '.sw-display');
  await shade.close();
  await sleep(400);
  const after = await state(p);
  const aligned = await p.evaluate(() => window.__aligned || 0);
  const errors = p.__errors.slice(), swapped = p.__swapped;
  await p.close();
  return { s, after, disp, swapped, aligned, framesHidden: f1 - s0.frames, hiddenAt: firstChange(s, 'hidden'), deadline, errors };
}

(async () => {
  const t0 = Date.now();
  if (want('N')) {
    try { nodePart(); } catch (e) { console.error(e && e.stack || e); process.exit(1); }
  }
  const browserCases = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].filter(want);
  if (!browserCases.length) return finish(t0);
  puppeteer = loadPuppeteer();
  const { serve } = require('./serve.js');
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  try {
    /* 1  timer */
    if (want(1)) {
      console.log('\n1. timer, hidden');
      const r = await hiddenTimer(browser);
      check(r.s.vis === 'hidden' && r.hiddenAt < r.deadline - 1000 && r.framesHidden === 0,
        '1  the page behind another tab is hidden ' + (r.deadline - r.hiddenAt) + ' ms before the deadline and gets no animation frames from then on', r.s.vis + ', ' + r.framesHidden + ' frames, hidden at ' + lateness(r.hiddenAt, r.deadline));
      const h = heard(r.s.sound[0], r.deadline, r.s.lag);
      check(r.s.tap && r.s.sound.length === 1 && h.ok && r.s.sound[0] > r.hiddenAt, '1  timer, 6 s, hidden: the tone is heard ' + h.say + ' (within ' + TOLERANCE + ' ms), while hidden', JSON.stringify(r.s));
      check(r.s.tones.length === 1 && Math.abs(r.s.tones[0] - r.deadline) <= TOLERANCE, '1  …one oscillator left on the clock, set for ' + lateness(r.s.tones[0], r.deadline) + ' after the deadline', JSON.stringify(r.s.tones));
      const d = timely(r.s.done[0], r.deadline, r.s.control[0]);
      check(r.s.done.length === 1 && d.ok, '1  …and the timer is marked done ' + d.say, JSON.stringify(r.s.done));
      check(r.disp === '00:00.00', '1  …and the display reads 00:00.00', r.disp);
      check(r.after.sound.length === 1 && r.after.tones.length === 1, '1  showing the tab again makes no second sound', JSON.stringify(r.after.sound));
      check(!r.errors.length, '1  no page errors', r.errors.join(' | '));
    }

    /* 2  pomodoro */
    if (want(2)) {
      console.log('\n2. pomodoro, hidden');
      const p = await open(browser);
      await p.click('.sw-tab[data-tab=pomodoro]');
      await setInputs(p, 2, [SPAN / 60000, SPAN / 60000, SPAN / 60000]);
      await clickStart(p, 2);
      const shade = await hide(browser, p);
      const d1 = (await state(p)).starts[0].at + SPAN;
      const d2 = d1 + SPAN;
      await sleepUntil(d1 + 1500);
      const mid = await state(p);
      const phase1 = await text(p, 2, '.sw-phase');
      await sleepUntil(d2 + 1500);
      const s = await state(p);
      const phase2 = await text(p, 2, '.sw-phase, .sw-count');
      const hiddenAt = firstChange(s, 'hidden');
      const t1 = heard(mid.sound[0], d1, mid.lag);
      check(mid.vis === 'hidden' && hiddenAt < d1 - 1000 && mid.sound.length === 1 && t1.ok && phase1 === 'Break',
        '2  pomodoro, 6 s phases, hidden: the end of Work is heard ' + t1.say + ', and it is Break', JSON.stringify(mid) + ' ' + phase1);
      const t2 = heard(s.sound[1], d2, s.lag);
      check(s.vis === 'hidden' && s.sound.length === 2 && t2.ok && phase2 === 'Work, Cycle 2 of 4',
        '2  …the end of Break is heard ' + t2.say + ' (its own deadline, 6 s after the first), and it is Work, cycle 2', JSON.stringify(s.sound) + ' ' + phase2);
      await shade.close();
      check(!p.__errors.length, '2  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 3  timers held back while hidden */
    if (want(3)) {
      console.log('\n3. timers held back while hidden');
      const p = await open(browser, { holdBack: true });
      await p.click('.sw-tab[data-tab=timer]');
      await setInputs(p, 1, [0, 0, SPAN / 1000]);
      await clickStart(p, 1);
      const shade = await hide(browser, p);
      const deadline = (await state(p)).starts[0].at + SPAN;
      await sleepUntil(deadline + 1500);
      const hidden = await state(p);
      const held = await p.evaluate(() => window.__held.length);
      await shade.close();
      await sleep(600);
      const s = await state(p);
      const shownAt = s.changes.filter((c) => c[0] === 'visible').map((c) => c[1]).pop();
      const h = heard(hidden.sound[0], deadline, hidden.lag);
      check(hidden.vis === 'hidden' && held > 0 && hidden.done.length === 0 && hidden.sound.length === 1 && h.ok,
        '3  with every timeout and frame held back while hidden (' + held + ' callbacks held), the tone is still heard ' + h.say + ', from the audio clock; the panel is not yet done', JSON.stringify(hidden));
      check(s.done.length === 1 && s.done[0] - shownAt >= 0 && s.done[0] - shownAt <= TOLERANCE, '3  …and it is marked done ' + (s.done[0] - shownAt) + ' ms after the tab is shown again', JSON.stringify(s.done) + ' shown ' + shownAt);
      check(s.sound.length === 1 && s.tones.length === 1, '3  …with no second tone', JSON.stringify(s.sound));
      check(!p.__errors.length, '3  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 4  a paused timer stays silent */
    if (want(4)) {
      console.log('\n4. pause');
      const p = await open(browser);
      await p.click('.sw-tab[data-tab=timer]');
      await setInputs(p, 1, [0, 0, 2]);
      await clickStart(p, 1);
      await sleep(500);
      await clickStart(p, 1);
      const label = await text(p, 1, '.btn-primary');
      const shade = await hide(browser, p);
      await sleep(2500);
      const s = await state(p);
      await shade.close();
      check(label === 'Resume' && s.sound.length === 0 && s.tones.length === 0 && s.taken >= 1 && s.done.length === 0, '4  a 2 s timer paused at 0.5 s and hidden makes no sound: its tone was taken back (' + s.taken + ')', label + ' ' + JSON.stringify(s));
      check(!p.__errors.length, '4  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 5  the engine before wave 0-A */
    if (want(5)) {
      console.log('\n5. before: the engine at ' + BEFORE);
      let old = null;
      try { old = execFileSync('git', ['-C', REPO, 'show', BEFORE + ':engine/render-live.js'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { old = null; }
      if (old === null) skip('5  BEFORE: git show ' + BEFORE + ':engine/render-live.js is not available in ' + REPO);
      else {
        const r = await hiddenTimer(browser, { engine: old });
        check(r.swapped > 0 && r.s.vis === 'hidden' && r.s.tones.length === 0 && r.s.sound.length === 0 && r.after.tones.length === 1 && r.after.tones[0] - r.deadline > 1200,
          '5  BEFORE: reproduced — the old engine\'s hidden 6 s timer stayed silent and beeped only when the tab was shown, ' + lateness(r.after.tones[0], r.deadline) + ' late', JSON.stringify(r.s) + ' frames while hidden: ' + r.framesHidden + ' | after: ' + JSON.stringify(r.after));
      }
    }

    /* 6  real Chrome's late background wake-ups: the tone is still on time */
    if (want(6)) {
      console.log('\n6. background wake-ups 0.9 s late');
      const r = await hiddenTimer(browser, { align: true });
      const h = heard(r.s.sound[0], r.deadline, r.s.lag);
      check(r.aligned > 0 && r.s.done.length === 1 && r.s.done[0] - r.deadline >= 700,
        '6  the wake-ups were late (' + r.aligned + ' held 900 ms): the panel was marked done ' + lateness(r.s.done[0], r.deadline) + ' after the deadline', JSON.stringify(r.s));
      check(r.s.sound.length === 1 && h.ok, '6  …and the tone was heard ' + h.say + ', from the audio clock', JSON.stringify(r.s.sound));
      check(!r.errors.length, '6  no page errors', r.errors.join(' | '));
    }

    /* 7  wave 0-A's engine under the same wake-ups */
    if (want(7)) {
      console.log('\n7. before: wave 0-A\'s engine, wake-ups 0.9 s late');
      if (!fs.existsSync(W0A)) skip('7  BEFORE: wave 0-A\'s engine is not at ' + W0A);
      else {
        const r = await hiddenTimer(browser, { engine: fs.readFileSync(W0A, 'utf8'), align: true });
        check(r.swapped > 0 && r.s.sound.length === 1 && r.s.sound[0] - r.deadline >= 700,
          '7  BEFORE: reproduced — wave 0-A\'s tone, made at the late wake-up, was heard ' + lateness(r.s.sound[0], r.deadline) + ' after the deadline', JSON.stringify(r.s));
      }
    }

    /* 8  a running timer survives a reload */
    if (want(8)) {
      console.log('\n8. a running timer across a reload');
      const p = await open(browser);
      await p.click('.sw-tab[data-tab=timer]');
      await setInputs(p, 1, [0, 0, 40]);
      await clickStart(p, 1);
      const deadline = (await state(p)).starts[0].at + 40000;
      await sleep(1500);
      await p.evaluate(() => sessionStorage.setItem('__keep', '1'));
      await p.reload({ waitUntil: 'load' });
      await p.waitForSelector('.sw-timer .btn-primary');
      await sleep(300);
      const after = await p.evaluate(() => ({ label: document.querySelector('.sw-timer .btn-primary').textContent, tab: document.querySelector('.sw-tab[aria-pressed=true]').dataset.tab, disp: document.querySelector('.sw-timer .sw-display').textContent, msg: document.querySelector('.sw-restore').textContent, now: Date.now() }));
      const [mm, ss] = after.disp.split(':');
      const left = (Number(mm) * 60 + Number(ss)) * 1000;
      check(after.label === 'Pause' && after.tab === 'timer' && Math.abs(after.now + left - deadline) <= 1200 && /Click or press a key/.test(after.msg),
        '8  after a reload the timer is still running (Pause), on the Timer tab, ' + after.disp + ' left, the same deadline (±1.2 s), and the page asks for a click to turn the sound on', JSON.stringify(after) + ' deadline in ' + (deadline - after.now));
      await p.mouse.click(5, 5);
      await sleep(900);
      const s = await state(p);
      check(s.tones.length === 1 && Math.abs(s.tones[0] - deadline) <= TOLERANCE, '8  …one click later its tone is on the clock for the same deadline (' + lateness(s.tones[0], deadline) + ')', JSON.stringify(s.tones));
      await p.evaluate(() => { sessionStorage.removeItem('__keep'); document.querySelector('.sw-timer .btn-ghost').click(); });
      check(!p.__errors.length, '8  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 9  two timers */
    if (want(9)) {
      console.log('\n9. two timers at once');
      const p = await open(browser);
      await p.click('.sw-tab[data-tab=timer]');
      await p.click('.sw-add');
      await setInputs(p, 1, [0, 0, 6], 0);
      await setInputs(p, 1, [0, 0, 8], 1);
      await clickStart(p, 1, 0);
      await clickStart(p, 1, 1);
      const st0 = await state(p);
      const da = st0.starts[0].at + 6000, db = st0.starts[1].at + 8000;
      const shade = await hide(browser, p);
      await sleepUntil(db + 1500);
      const s = await state(p);
      const names = await p.evaluate(() => [...document.querySelectorAll('.sw-ended')].map((e) => e.textContent).join(' | '));
      await shade.close();
      const a = heard(s.sound[0], da, s.lag), b = heard(s.sound[1], db, s.lag);
      check(s.sound.length === 2 && a.ok && b.ok && s.done.length === 2, '9  timers of 6 s and 8 s, both hidden: heard ' + a.say + ' and ' + b.say + ', both marked done', JSON.stringify(s));
      check(/^Timer 1 ended at \d\d:\d\d:\d\d\. \| Timer 2 ended at \d\d:\d\d:\d\d\.$/.test(names), '9  …each says when it ended', names);
      check(!p.__errors.length, '9  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 10  keys and the laps CSV */
    if (want(10)) {
      console.log('\n10. keys and the laps file');
      const p = await open(browser);
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      await p.keyboard.press('Space');
      await sleep(400); await p.keyboard.press('KeyL');
      await sleep(600); await p.keyboard.press('KeyL');
      await sleep(300); await p.keyboard.press('KeyL');
      await sleep(200); await p.keyboard.press('Space');
      const shown = await p.evaluate(() => ({ disp: document.querySelector('.sw-panel .sw-display').textContent, laps: document.querySelectorAll('.sw-lap').length, label: document.querySelector('.sw-panel .btn-primary').textContent, fast: !!document.querySelector('.sw-lap.is-fast'), slow: !!document.querySelector('.sw-lap.is-slow') }));
      check(shown.laps === 3 && shown.label === 'Resume' && shown.fast && shown.slow, '10  Space started and stopped the stopwatch, L added 3 laps, fastest and slowest marked', JSON.stringify(shown));
      await p.click('.sw-lap-acts .btn-ghost');
      await sleep(400);
      const blobs = await p.evaluate(() => window.__blobs.slice());
      const csv = (blobs.find((b) => b.text !== undefined && /csv/.test(b.type)) || {}).text || '';
      const name = (blobs.find((b) => b.name) || {}).name || '';
      const rows = csv.trim().split(/\r\n/).map((r) => r.split(','));
      const toMs = (s) => { const m = /^(?:(\d+):)?(\d\d):(\d\d)\.(\d\d)$/.exec(s); return m ? ((Number(m[1] || 0) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]) * 10 : NaN; };
      const okRows = rows.length === 4 && rows[0].join() === 'Lap,Split,Total,Split (s),Total (s)' && rows.slice(1).every((r, i) => {
        const prev = i ? Number(rows[i][4]) : 0;
        return Number(r[0]) === i + 1 && Math.abs(Number(r[3]) - (Number(r[4]) - prev)) < 0.0015 && Math.abs(toMs(r[2]) - Number(r[4]) * 1000) < 10 && Math.abs(toMs(r[1]) - Number(r[3]) * 1000) < 20;
      });
      const total = toMs(shown.disp);
      check(okRows && Number(rows[3][4]) * 1000 <= total && /^stopwatch-laps-\d{4}-\d\d-\d\d-\d{4}\.csv$/.test(name),
        '10  the CSV (' + name + ') has a header and 3 laps; each split is its total less the one before, the m:ss.cc columns match the seconds, the last total is within the time shown', csv.replace(/\r\n/g, ' / '));
      await p.keyboard.press('KeyR');
      const after = await p.evaluate(() => ({ disp: document.querySelector('.sw-panel .sw-display').textContent, laps: document.querySelectorAll('.sw-lap').length }));
      check(after.disp === '00:00.00' && after.laps === 0, '10  R reset it', JSON.stringify(after));
      /* keys typed into a field are the field's */
      await p.click('.sw-tab[data-tab=timer]');
      await p.focus('.sw-timer .sw-label');
      await p.keyboard.press('Space');
      const lab = await p.evaluate(() => ({ v: document.querySelector('.sw-timer .sw-label').value, b: document.querySelector('.sw-timer .btn-primary').textContent }));
      check(lab.b === 'Start' && / $/.test(lab.v), '10  a space typed in the timer\'s name stays in the name and starts nothing', JSON.stringify(lab));
      check(!p.__errors.length, '10  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 11  a running stopwatch survives a reload */
    if (want(11)) {
      console.log('\n11. a running stopwatch across a reload');
      const p = await open(browser);
      await p.click('.sw-panel .btn-primary');
      await sleep(1300);
      await p.evaluate(() => sessionStorage.setItem('__keep', '1'));
      await p.reload({ waitUntil: 'load' });
      await p.waitForSelector('.sw-panel .btn-primary');
      await sleep(500);
      const a = await p.evaluate(() => ({ disp: document.querySelector('.sw-panel .sw-display').textContent, label: document.querySelector('.sw-panel .btn-primary').textContent }));
      await sleep(700);
      const b = await p.evaluate(() => document.querySelector('.sw-panel .sw-display').textContent);
      const ms = (s) => { const m = /^(\d\d):(\d\d)\.(\d\d)$/.exec(s); return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 + Number(m[3]) * 10 : NaN; };
      check(a.label === 'Stop' && ms(a.disp) >= 1700 && ms(b) - ms(a.disp) >= 500, '11  after a reload the stopwatch still runs: ' + a.disp + ', then ' + b, JSON.stringify(a) + ' ' + b);
      await p.evaluate(() => { sessionStorage.removeItem('__keep'); });
      check(!p.__errors.length, '11  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 12  the countdown from a share link */
    if (want(12)) {
      console.log('\n12. countdown from a share link');
      /* the page's clock is moved so the next whole minute (UTC) is 9 s away */
      const real = Date.now();
      const targetReal = Math.ceil((real + 30000) / 60000) * 60000;
      const shift = (targetReal - 9000) - (real + 2000);       // page now ≈ target − 9 s about 2 s from here
      const target = targetReal;                                // in page time
      const d = new Date(target);
      const day = d.toISOString().slice(0, 10), hm = d.toISOString().slice(11, 16);
      const ctxB = browser.defaultBrowserContext();
      await ctxB.overridePermissions(BASE, ['notifications']);
      const page = '/time/countdown-timer/#name=Launch%20day&date=' + day + '&time=' + hm + '&tz=UTC&theme=night';
      const p = await open(browser, { page, shift });
      await p.waitForSelector('#cd-label');
      const f = await p.evaluate(() => ({ name: document.getElementById('cd-label').value, date: document.getElementById('cd-date').value, time: document.getElementById('cd-time').value, tz: document.querySelector('.zp-input').value, night: document.querySelector('.countdown-stage').classList.contains('cd-theme-night'), share: window.MVRTool.shareState(), title: document.title }));
      check(f.name === 'Launch day' && f.date === day && f.time === hm && f.tz === 'UTC' && f.night && f.share.kind === 'live' && f.share.params.tz === 'UTC' && f.share.params.name === 'Launch day' && f.share.changed === true,
        '12  the link fills the name, date, time, zone (UTC) and theme, and the share state carries them back', JSON.stringify(f));
      check(/^\d\d:\d\d:\d\d Launch day – /.test(f.title) || /^00:00:0\d Launch day/.test(f.title), '12  the tab title counts down: "' + f.title.slice(0, 40) + '…"', f.title);
      await p.click('.cd-alerts input[type=checkbox]');
      await sleep(300);
      const ticked = await p.evaluate(() => document.querySelector('.cd-alerts input[type=checkbox]').checked);
      const shade = await hide(browser, p);
      const now = await p.evaluate(() => Date.now());
      await sleep(Math.max(0, target - now) + 1500);
      const s = await state(p);
      await shade.close();
      const after = await p.evaluate(() => ({ title: document.querySelector('.countdown-title').textContent, past: document.querySelector('.countdown-stage').classList.contains('is-past') }));
      const h = heard(s.sound[0], target, s.lag);
      check(ticked && s.sound.length === 1 && h.ok, '12  with the tab hidden, zero is heard ' + h.say, JSON.stringify(s));
      check(s.notes.length === 1 && s.notes[0].title === 'Launch day' && Math.abs(s.notes[0].at - target) <= 1500, '12  …a notification "Launch day" is shown (' + lateness(s.notes[0] && s.notes[0].at, target) + ')', JSON.stringify(s.notes));
      check(after.past && after.title === 'Since Launch day', '12  …and it counts up: "' + after.title + '"', JSON.stringify(after));
      check(!p.__errors.length, '12  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 13  the time zone converter from a share link */
    if (want(13)) {
      console.log('\n13. time zone converter from a share link');
      const p = await open(browser, { page: '/time/timezone-converter/#from=Europe/London&to=America/New_York,Asia/Kolkata&at=2026-03-29T01:30', width: 390 });
      await p.waitForSelector('.tz-grid');
      const r = await p.evaluate(() => ({
        notes: [...document.querySelectorAll('.tz-notes li')].map((e) => e.textContent),
        cols: document.querySelectorAll('.tz-grid thead .tz-hour').length,
        hours: [...document.querySelectorAll('.tz-grid thead .tz-hour')].map((b) => b.textContent).join(' '),
        cities: [...document.querySelectorAll('.tz-city strong')].map((e) => e.textContent),
        primary: document.querySelector('.result-primary .result-value').textContent,
        share: window.MVRTool.shareState(), sw: document.documentElement.scrollWidth
      }));
      check(r.notes.some((n) => /^01:30 does not exist in London on Sunday, 29 March 2026: the clocks go forward then, so it is taken as 02:30\.$/.test(n)),
        '13  "01:30 does not exist in London on Sunday, 29 March 2026 … taken as 02:30"', r.notes.join(' | '));
      check(r.cols === 23 && /^00 02 03 /.test(r.hours), '13  the planner has 23 hours that day, 00 then 02', r.cols + ': ' + r.hours);
      check(r.cities.join() === 'New York,Kolkata' && r.primary === 'Sat, 28 Mar 2026, 21:30', '13  New York first: 01:30Z is Sat 28 Mar 2026, 21:30 there (UTC−4: New York moved its clocks on 8 March)', r.primary);
      check(r.share.kind === 'live' && r.share.params.at === '2026-03-29T01:30' && r.share.params.from === 'Europe/London' && r.share.params.to === 'America/New_York,Asia/Kolkata' && r.sw <= 390,
        '13  the share state carries the link back, and the page fits 390 px', JSON.stringify(r.share) + ' width ' + r.sw);
      await p.$eval('#tz-title', (i) => { i.value = 'Stand-up'; });
      await p.click('.tz-out .btn-primary');
      await sleep(400);
      const blobs = await p.evaluate(() => window.__blobs.slice());
      const ics = (blobs.find((b) => b.type === 'text/calendar') || {}).text || '';
      const name = (blobs.find((b) => b.name) || {}).name || '';
      check(/\r\nDTSTART:20260329T013000Z\r\n/.test(ics) && /\r\nDTEND:20260329T023000Z\r\n/.test(ics) && /\r\nSUMMARY:Stand-up\r\n/.test(ics) && name === 'stand-up-2026-03-29-0230.ics',
        '13  the .ics (' + name + ') starts at 20260329T013000Z (02:30 BST) and lasts an hour', ics.replace(/\r\n/g, ' / ').slice(0, 400));
      const add = await p.$('.tz-cities .zp-input');
      await add.click();
      await add.type('Mumb');
      await sleep(150);
      const opts = await p.evaluate(() => [...document.querySelectorAll('.tz-cities .zp-opt')].map((o) => o.textContent));
      await add.type('ai');
      await p.keyboard.press('Enter');
      await sleep(200);
      await add.type('tokyo');
      await p.keyboard.press('Enter');
      await sleep(200);
      const r2 = await p.evaluate(() => ({ cities: [...document.querySelectorAll('.tz-city strong')].map((e) => e.textContent), to: window.MVRTool.shareState().params.to }));
      check(/^Mumbai/.test(opts[0] || '') && /Asia\/Kolkata/.test(opts[0] || ''), '13  typing "Mumb" offers Mumbai (Asia/Kolkata) first', opts.join(' | '));
      const bar = await p.evaluate(() => { const w = document.querySelector('.share-toggle'); return { shown: !!w && !w.hidden, label: w ? w.textContent.trim() : '', kind: document.querySelector('[data-share]').getAttribute('data-share-kind') }; });
      check(bar.kind === 'live' && bar.shown && bar.label === 'Include my settings', '13  the share bar (kind "live") offers "Include my settings" once something is changed', JSON.stringify(bar));
      check(r2.cities.join() === 'New York,Kolkata,Tokyo' && r2.to === 'America/New_York,Asia/Kolkata,Asia/Tokyo', '13  Mumbai (already there as Kolkata) adds nothing; Tokyo is added and goes into the share state', JSON.stringify(r2));
      check(!p.__errors.length, '13  no page errors', p.__errors.join(' | '));
      await p.close();
    }

    /* 14  the shared working hours */
    if (want(14)) {
      console.log('\n14. the planner\'s shared hours');
      const p = await open(browser, { page: '/time/timezone-converter/#from=Europe/London&to=Europe/Paris&at=2026-10-06T12:00' });
      await p.waitForSelector('.tz-grid');
      const t = await p.evaluate(() => document.querySelector('.tz-overlap').textContent);
      /* London 09:00–17:00 is Paris 10:00–18:00; Paris's own 09:00–17:00 is London 08:00–16:00: both, 09:00–16:00 London */
      check(t === 'Inside working hours everywhere: 09:00–16:00 London time.', '14  London and Paris: "' + t + '"', t);
      check(!p.__errors.length, '14  no page errors', p.__errors.join(' | '));
      await p.close();
    }
  } catch (e) {
    console.error(e && e.stack || e);
    await browser.close();
    if (server) server.close();
    process.exit(1);
  }
  await browser.close();
  if (server) server.close();
  finish(t0);
})();

function finish(t0) {
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (skipped ? ', ' + skipped + ' skipped' : '') + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  process.exit(fail ? 2 : 0);
}
