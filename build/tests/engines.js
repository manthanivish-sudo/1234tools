#!/usr/bin/env node
/**
 * Calculator engine arithmetic — no browser.
 *
 *   node build/tests/engines.js [--root DIR]
 *
 * Each engine (engine/calc-*.js) is run in a fresh vm context with a stub
 * window, exactly as build/content/_engine.js does, and its compute() is
 * called directly. Three kinds of check:
 *
 *   1. The corrected figures, worked by hand or taken from the official
 *      source cited next to the constant in the engine.
 *   2. Oracles: the date tools are checked on random dates against pure
 *      year-month-day arithmetic (no Date object at all), in four time
 *      zones — London (with British Summer Time), New York, Kolkata and
 *      Auckland — each run in its own child process.
 *   3. Regression: for inputs outside each bug's reach, the engine must give
 *      exactly what it gave before the fixes. "Before" is the engine as it
 *      stood at BASE, read with `git show` (read-only); if git or that
 *      commit is not available the regression checks are skipped, loudly.
 *
 * Random inputs come from a seeded generator, so a failure reproduces.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync, spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const TZ = arg('--tz') || 'Europe/London';
process.env.TZ = TZ;                      // before any Date is made
const DATES_ONLY = argv.includes('--dates-only');
const ROOT = path.resolve(arg('--root') || path.join(__dirname, '..', '..'));
const REPO = path.join(__dirname, '..', '..');
const BASE = 'e1fa0b279';                 // engines before the October 2026 fixes

/* ---------- loading ---------- */
function run(src, filename) {
  const window = { TOOLS: {} };
  const ctx = vm.createContext({ window, console, Intl, Math, Date, Number, String, Array, Object, JSON, isFinite, isNaN, parseFloat, parseInt });
  vm.runInContext(src, ctx, { filename });
  return window.TOOLS;
}
const cache = new Map();
function engine(slug) {
  const key = 'new:' + slug;
  if (!cache.has(key)) {
    const file = path.join(ROOT, 'engine', 'calc-' + slug + '.js');
    cache.set(key, run(fs.readFileSync(file, 'utf8'), file)[slug]);
  }
  return cache.get(key);
}
/* Date with the clock pinned to `ms`: new Date() and Date.now() return that
   instant, everything else (parsing, Date.UTC, getters) is the real Date. */
function pinnedDate(ms) {
  class Pinned extends Date {
    constructor(...a) { if (a.length === 0) super(ms); else super(...a); }
    static now() { return ms; }
  }
  return Pinned;
}
/* An engine loaded with the clock pinned, for outputs that depend on today. */
function engineAt(slug, ms) {
  const file = path.join(ROOT, 'engine', 'calc-' + slug + '.js');
  const window = { TOOLS: {} };
  const ctx = vm.createContext({ window, console, Intl, Math, Date: pinnedDate(ms), Number, String, Array, Object, JSON, isFinite, isNaN, parseFloat, parseInt });
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return window.TOOLS[slug];
}
/* The value render-core.js gives a date input whose default is "TODAY", at
   instant `ms`: its own statements, cut out of the file and run. */
let todayCode = null;
function todayAt(ms) {
  if (todayCode === null) {
    const src = fs.readFileSync(path.join(ROOT, 'engine', 'render-core.js'), 'utf8');
    const m = /if \(def === 'TODAY'\) \{([\s\S]*?)\n\s*\}\n/.exec(src);
    if (!m) throw new Error('render-core.js: the TODAY block was not found');
    todayCode = m[1];
  }
  return vm.runInNewContext('var def = "TODAY";' + todayCode + '; def', { Date: pinnedDate(ms), String });
}
let baseOK = true;
function baseline(slug) {
  const key = 'old:' + slug;
  if (!cache.has(key)) {
    let t = null;
    try {
      const src = execFileSync('git', ['-C', REPO, 'show', BASE + ':engine/calc-' + slug + '.js'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      t = run(src, BASE + ':calc-' + slug + '.js')[slug];
    } catch (e) { baseOK = false; }
    cache.set(key, t);
  }
  return cache.get(key);
}
/* compute() with the spec's defaults under the given inputs; TODAY is pinned. */
function calc(tool, inputs) {
  const vals = {};
  (tool.inputs || []).forEach((i) => {
    let d = i.default;
    if (d === 'TODAY') d = '2026-10-04';
    if (i.type === 'number') d = d === null || d === undefined || d === '' ? null : Number(d);
    vals[i.key] = d;
  });
  return tool.compute(Object.assign(vals, inputs || {}));
}
const now = (slug, inputs) => calc(engine(slug), inputs);
const was = (slug, inputs) => { const t = baseline(slug); return t ? calc(t, inputs) : null; };

/* ---------- reporting ---------- */
let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) { pass++; return true; }
  fail++;
  if (failures.length < 60) failures.push(label + (detail === undefined ? '' : '  →  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))));
  return false;
}
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.005 : tol);
function eq(actual, expected, label) {
  const good = typeof expected === 'number' ? near(actual, expected) : actual === expected;
  return ok(good, label, { expected, actual });
}
/* Every output the old engine gave must come back identical, apart from
   keys named in `skip` (outputs that are new, or deliberately changed). */
function same(slug, inputs, label, skip) {
  const before = was(slug, inputs);
  if (!before) return;
  const after = now(slug, inputs);
  const drop = new Set(skip || []);
  const pick = (o) => JSON.stringify(Object.keys(o).filter((k) => !drop.has(k)).sort().map((k) => [k, o[k]]));
  ok(pick(before) === pick(after), 'regression ' + slug + ' ' + label, { inputs, before: pick(before).slice(0, 300), after: pick(after).slice(0, 300) });
}

/* ---------- seeded randomness ---------- */
let seed = 0x1234;
function rnd() { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (arr) => arr[int(0, arr.length - 1)];
const N = 40;                              // random cases per engine

/* ---------- pure calendar arithmetic (no Date) ---------- */
function dfc(y, m, d) {                    // days from 1970-01-01; m is 1..12
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
}
function cfd(z) {
  z += 719468;
  const era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9;
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}
const dim = (y, m) => cfd(dfc(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1)[2];
const isoOf = ([y, m, d]) => String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
const parseISO = (s) => s.split('-').map(Number);
const dow = (z) => (((z + 4) % 7) + 7) % 7;      // 0 = Sunday; 1970-01-01 was a Thursday
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (z) => { const [y, m, d] = cfd(z); return `${DAYS[dow(z)]}, ${d} ${MONTHS[m - 1]} ${y}`; };
function addYMD([y, m, d], Y, M, D) {        // clamp to the end of a short month, then add days
  let tm = m - 1 + M + 12 * Y;
  const ty = y + Math.floor(tm / 12); tm = ((tm % 12) + 12) % 12;
  return dfc(ty, tm + 1, Math.min(d, dim(ty, tm + 1))) + D;
}
function diffYMD(a, b) {                     // a <= b; months then days, clamp convention
  let total = (b[0] - a[0]) * 12 + (b[1] - a[1]);
  if (b[2] < a[2]) total--;
  return [Math.floor(total / 12), total % 12, dfc(...b) - addYMD(a, 0, total, 0)];
}
const randDay = (y0, y1) => cfd(int(dfc(y0, 1, 1), dfc(y1, 12, 31)));

/* =====================================================================
   Date tools — run in every time zone
   ===================================================================== */
function dateTests() {
  const Z = ' [' + TZ + ']';

  /* 1. Pregnancy due date: due = LMP + 280 + (cycle − 28) */
  const preg = (date, cycle, today) => now('pregnancy-due-date', { basis: 'lmp', date, cycle, ivfDay: '5', today: today || '2026-03-01' });
  eq(preg('2026-01-01', 28).dueDate, 'Thursday, 8 October 2026', '1 pregnancy 28-day cycle' + Z);
  eq(preg('2026-01-01', 35).dueDate, 'Thursday, 15 October 2026', '1 pregnancy 35-day cycle is 7 days later' + Z);
  eq(preg('2026-01-01', 21).dueDate, 'Thursday, 1 October 2026', '1 pregnancy 21-day cycle is 7 days earlier' + Z);
  eq(preg('2026-01-01', 35).conception, 'Thursday, 22 January 2026', '1 pregnancy 35-day cycle ovulates on day 21' + Z);
  eq(preg('2026-01-01', 28).gestational, '8 weeks and 3 days', '1 pregnancy gestational age' + Z);
  eq(preg('2026-01-01', 28, '2026-10-01').daysRemaining, 7, '1 pregnancy days remaining' + Z);
  eq(now('pregnancy-due-date', { basis: 'conception', date: '2026-04-15', cycle: 28, ivfDay: '5', today: '2026-05-01' }).dueDate,
     'Wednesday, 6 January 2027', '1 pregnancy from conception (+266 days)' + Z);
  eq(now('pregnancy-due-date', { basis: 'ivf', date: '2026-04-15', cycle: 28, ivfDay: '5', today: '2026-05-01' }).dueDate,
     'Friday, 1 January 2027', '1 pregnancy from day-5 IVF transfer (+261 days)' + Z);
  for (let k = 0; k < N; k++) {
    const lmp = randDay(1990, 2060), cyc = int(20, 45);
    const r = preg(isoOf(lmp), cyc, isoOf(lmp));
    ok(r.dueDate === longDate(dfc(...lmp) + 280 + cyc - 28), '1 pregnancy oracle' + Z, { lmp: isoOf(lmp), cyc, got: r.dueDate });
  }

  /* 3. Date add / subtract: ISO and long date agree with pure arithmetic */
  const add = (start, o) => now('date-add-subtract', Object.assign({ start, dir: 'add', years: 0, months: 0, weeks: 0, days: 0 }, o));
  eq(add('2026-07-01', { days: 1 }).iso, '2026-07-02', '3 date add in BST: ISO date' + Z);
  eq(add('2026-07-01', { days: 1 }).result, 'Thursday, 2 July 2026', '3 date add in BST: long date' + Z);
  eq(add('2026-03-28', { days: 1 }).iso, '2026-03-29', '3 date add onto the spring clock change' + Z);
  eq(add('2026-10-24', { days: 2 }).iso, '2026-10-26', '3 date add across the autumn clock change' + Z);
  eq(add('2026-01-31', { months: 1 }).iso, '2026-02-28', '3 date add clamps 31 Jan + 1 month' + Z);
  eq(add('2024-02-29', { years: 1 }).iso, '2025-02-28', '3 date add clamps 29 Feb + 1 year' + Z);
  eq(add('2026-07-15', { days: 10, dir: 'sub' }).iso, '2026-07-05', '3 date subtract in BST' + Z);
  for (let k = 0; k < N; k++) {
    const s = randDay(1950, 2080), Y = int(-5, 5), M = int(-30, 30), W = int(-10, 10), D = int(-400, 400);
    const sub = rnd() < 0.5;
    const sg = sub ? -1 : 1;
    const want = addYMD(s, sg * Y, sg * M, sg * (W * 7 + D));
    const r = add(isoOf(s), { years: Y, months: M, weeks: W, days: D, dir: sub ? 'sub' : 'add' });
    ok(r.iso === isoOf(cfd(want)) && r.result === longDate(want) && r.dayOfWeek === DAYS[dow(want)],
       '3 date add oracle' + Z, { s: isoOf(s), Y, M, W, D, sub, want: isoOf(cfd(want)), got: r.iso, long: r.result });
  }

  /* 3. Business days */
  const bd = (o) => now('business-days', Object.assign({ start: '2026-03-27', mode: 'between', end: '2026-03-31', add: 0, holidays: '' }, o));
  eq(bd({ holidays: '2026-03-30' }).businessDays, 1, '3 business days: holiday after the clock change is excluded' + Z);
  eq(bd({ holidays: '2026-03-30' }).holidaysUsed, 1, '3 business days: holiday counted' + Z);
  eq(bd({ mode: 'add', add: 1, holidays: '2026-03-30' }).iso, '2026-03-31', '3 business days: add 1 skips the holiday' + Z);
  eq(bd({ mode: 'add', add: 1, holidays: '2026-03-30' }).result, 'Tuesday, 31 March 2026', '3 business days: add 1, long date' + Z);
  eq(bd({ start: '2026-07-01', mode: 'add', add: 1 }).result, 'Thursday, 2 July 2026', '3 business days: add in BST' + Z);
  eq(bd({ start: '2026-12-21', end: '2027-01-04', holidays: '2026-12-25, 2026-12-28, 2027-01-01' }).businessDays, 7, '3 business days over Christmas' + Z);
  for (let k = 0; k < N; k++) {
    const a = randDay(2000, 2040), z0 = dfc(...a), len = int(0, 200), z1 = z0 + len;
    const hols = []; for (let h = 0; h < 4; h++) hols.push(isoOf(cfd(z0 + int(0, Math.max(0, len)))));
    const hs = new Set(hols);
    let work = 0; for (let z = z0; z < z1; z++) if (dow(z) !== 0 && dow(z) !== 6 && !hs.has(isoOf(cfd(z)))) work++;
    const r = bd({ start: isoOf(a), end: isoOf(cfd(z1)), holidays: hols.join(', ') });
    ok(r.businessDays === work && r.calendarDays === len, '3 business days oracle (count)' + Z, { a: isoOf(a), len, hols, want: work, got: r.businessDays });
    const n = int(0, 60);
    let z = z0, c = 0; while (c < n) { z++; if (dow(z) !== 0 && dow(z) !== 6 && !hs.has(isoOf(cfd(z)))) c++; }
    const r2 = bd({ start: isoOf(a), mode: 'add', add: n, holidays: hols.join(', ') });
    ok(r2.iso === isoOf(cfd(z)) && r2.result === longDate(z), '3 business days oracle (add)' + Z, { a: isoOf(a), n, hols, want: isoOf(cfd(z)), got: r2.iso });
  }

  /* 4. Date difference and age: never negative, and adding the answer back
     (as the date add tool does) lands on the end date. */
  const dd = (start, end) => now('date-difference', { start, end });
  eq(dd('2026-01-31', '2026-03-01').breakdown, '0 years, 1 months, 1 days', '4 date difference 31 Jan → 1 Mar' + Z);
  eq(dd('2026-01-30', '2026-03-01').breakdown, '0 years, 1 months, 1 days', '4 date difference 30 Jan → 1 Mar' + Z);
  eq(dd('2026-01-31', '2026-02-28').breakdown, '0 years, 0 months, 28 days', '4 date difference 31 Jan → 28 Feb' + Z);
  eq(dd('2000-01-01', '2026-10-04').breakdown, '26 years, 9 months, 3 days', '4 date difference default-style case' + Z);
  eq(dd('2026-03-01', '2026-01-31').breakdown, '0 years, 1 months, 1 days', '4 date difference reversed order' + Z);
  eq(dd('2026-03-27', '2026-04-03').weekdays, 5, '4 date difference weekdays across the clock change' + Z);
  const age = (dob, on) => now('age-calculator', { dob, on });
  eq(age('1990-06-15', '2026-06-15').daysToNext, 0, '4 age: birthday in BST is today' + Z);
  eq(age('1990-06-15', '2026-06-15').nextBirthday, 'Monday, 15 June 2026', '4 age: next birthday is today, not next year' + Z);
  eq(age('1990-06-15', '2026-06-15').note, 'That reference date is the birthday itself.', '4 age: birthday note' + Z);
  eq(age('1990-06-15', '2026-06-15').bornOn, 'Friday', '4 age: day of the week born' + Z);
  eq(age('1990-06-15', '2026-06-14').daysToNext, 1, '4 age: one day to go' + Z);
  eq(age('1990-01-31', '2026-03-01').exact, '36 years, 1 months, 1 days', '4 age never negative' + Z);
  for (let k = 0; k < N; k++) {
    let a = randDay(1920, 2030), b = randDay(1920, 2030);
    if (dfc(...a) > dfc(...b)) [a, b] = [b, a];
    if (k < 10) { b = [b[0], b[1], int(1, 3)]; a = [a[0], a[1], int(28, dim(a[0], a[1]))]; if (dfc(...a) > dfc(...b)) [a, b] = [b, a]; }
    const [Y, M, D] = diffYMD(a, b);
    const r = dd(isoOf(a), isoOf(b));
    ok(r.breakdown === `${Y} years, ${M} months, ${D} days` && D >= 0 && r.totalDays === dfc(...b) - dfc(...a),
       '4 date difference oracle' + Z, { a: isoOf(a), b: isoOf(b), want: [Y, M, D], got: r.breakdown });
    const back = add(isoOf(a), { years: Y, months: M, days: D });
    ok(back.iso === isoOf(b), '4 date difference round trip through date add' + Z, { a: isoOf(a), b: isoOf(b), got: back.iso });
    const g = age(isoOf(a), isoOf(b));
    let nb = addYMD([b[0], a[1], 1], 0, 0, a[2] - 1);             // 29 Feb falls on 1 Mar in other years
    if (nb < dfc(...b)) nb = addYMD([b[0] + 1, a[1], 1], 0, 0, a[2] - 1);
    ok(g.exact === `${Y} years, ${M} months, ${D} days` && g.daysToNext === nb - dfc(...b) && g.bornOn === DAYS[dow(dfc(...a))],
       '4 age oracle' + Z, { a: isoOf(a), b: isoOf(b), want: [Y, M, D, nb - dfc(...b)], got: [g.exact, g.daysToNext, g.bornOn] });
  }

  /* F. Invoice due dates are calendar days too */
  const inv = now('invoice-payment-terms', { invoiceDate: '2026-03-20', terms: '14', amount: 10000, discount: 2, discountDays: 10, daysLate: 0 });
  eq(inv.dueDate, 'Fri, 3 Apr 2026', 'F invoice due date across the clock change' + Z);
  eq(inv.discountDate, 'Mon, 30 Mar 2026', 'F invoice discount date' + Z);

  /* G. "Today" is the local calendar date. Engines that read the clock are
     loaded with Date pinned to an instant; the expected local date comes
     from Intl in this time zone, not from the engine's own arithmetic. */
  const localISO = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
  const shortLong = (z) => { const [y, m, d] = cfd(z); return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d)); };
  const INSTANTS = [
    '2026-07-04T23:30:00Z',   // 00:30 BST on 5 July: UTC is still the 4th
    '2026-07-05T00:30:00Z',   // 01:30 BST
    '2026-03-29T00:30:00Z',   // 00:30 GMT on the spring clock change day
    '2026-03-29T01:30:00Z',   // 02:30 BST, just after the change
    '2026-10-24T23:30:00Z',   // 00:30 BST on the autumn clock change day
    '2026-10-25T01:30:00Z',   // 01:30 GMT, the repeated hour
    '2026-12-31T23:30:00Z',   // New Year's Eve in London, New Year's Day east of it
    '2026-01-01T04:30:00Z'    // still 31 December in New York
  ];
  for (let k = 0; k < N; k++) INSTANTS.push(new Date(Date.UTC(2026, 0, 1) + int(0, 3 * 365 * 24 * 4) * 900000).toISOString());
  for (const at of INSTANTS) {
    const ms = Date.parse(at);
    const today = parseISO(localISO(ms));
    /* render-core: the TODAY default of a date input */
    eq(todayAt(ms), isoOf(today), 'G render-core TODAY is the local date at ' + at + Z);
    /* ovulation: the current cycle day counts local calendar days */
    const lp = cfd(dfc(...today) - int(0, 40));
    const ov = engineAt('ovulation-calculator', ms).compute({ lastPeriod: isoOf(lp), cycle: 28, luteal: 14, cycles: 1 });
    eq(ov.cycleDay, dfc(...today) - dfc(...lp) + 1, 'G ovulation cycle day at ' + at + ' from ' + isoOf(lp) + Z);
    /* exam countdown: days left from the local date */
    const examDay = cfd(dfc(...today) + int(1, 60));
    const ex = engineAt('exam-countdown', ms).compute({ date: isoOf(examDay), topics: 10, hoursPer: 1, daysPerWeek: 7, revision: 0 });
    eq(ex.daysLeft, dfc(...examDay) - dfc(...today), 'G exam countdown days left at ' + at + ' to ' + isoOf(examDay) + Z);
  }

  /* G. A date typed in is that calendar date in every zone: new Date("YYYY-MM-DD")
     is UTC midnight, the previous evening west of Greenwich. */
  const ovu = (lastPeriod, cycle, luteal) => now('ovulation-calculator', { lastPeriod, cycle, luteal, cycles: 2 });
  eq(ovu('2026-07-01', 28, 14).ovulation, 'Wed, 15 Jul 2026', 'G ovulation date' + Z);
  eq(ovu('2026-07-01', 28, 14).nextPeriod, 'Wed, 29 Jul 2026', 'G ovulation next period' + Z);
  eq(ovu('2026-10-10', 30, 14).nextPeriod, 'Mon, 9 Nov 2026', 'G ovulation next period across the autumn clock change' + Z);
  const wk = (date) => now('week-number', { date });
  eq(wk('2026-07-06').label, 'Week 28 of 2026', 'G week number of a Monday in BST' + Z);
  eq(wk('2026-07-06').range, '6 Jul 2026 to 12 Jul 2026', 'G week runs Monday to Sunday' + Z);
  eq(wk('2026-01-01').dayOfYear, 1, 'G 1 January is day 1' + Z);
  eq(wk('2026-01-01').quarter, 'Q1', 'G 1 January is Q1' + Z);
  eq(wk('2027-01-01').label, 'Week 53 of 2026', 'G 1 January 2027 is in week 53 of 2026' + Z);
  for (let k = 0; k < N; k++) {
    const d = randDay(1990, 2060), z = dfc(...d);
    const thu = z - ((dow(z) + 6) % 7) + 3, isoYear = cfd(thu)[0];
    const week = Math.floor((thu - dfc(isoYear, 1, 1)) / 7) + 1;
    const r = wk(isoOf(d));
    ok(r.week === week && r.isoYear === isoYear && r.dayOfYear === z - dfc(d[0], 1, 1) + 1 && r.quarter === 'Q' + (Math.floor((d[1] - 1) / 3) + 1),
       'G week number oracle' + Z, { d: isoOf(d), want: [week, isoYear], got: [r.week, r.isoYear, r.dayOfYear, r.quarter] });
    const cyc = int(20, 45), lut = int(9, 17);
    const o = ovu(isoOf(d), cyc, lut);
    ok(o.ovulation === shortLong(z + cyc - lut) && o.nextPeriod === shortLong(z + cyc),
       'G ovulation oracle' + Z, { d: isoOf(d), cyc, lut, want: [shortLong(z + cyc - lut), shortLong(z + cyc)], got: [o.ovulation, o.nextPeriod] });
  }
}

/* =====================================================================
   Everything else — run once (London)
   ===================================================================== */
function otherTests() {
  /* 1. Pregnancy: unchanged for 28-day cycles and the other bases */
  for (let k = 0; k < N; k++) {
    const d = randDay(1995, 2050), basis = pick(['lmp', 'conception', 'ivf']);
    const t = cfd(dfc(...d) + int(-30, 300));
    if (d[1] >= 3 && d[1] <= 10) continue;        // winter dates only: the old engine was right there
    same('pregnancy-due-date', { basis, date: isoOf(d), cycle: 28, ivfDay: pick(['3', '5', '6']), today: isoOf(t) }, 'basis ' + basis);
  }

  /* G. Ovulation and week number: in London the typed date was already read
     correctly, so every output but the clock-dependent cycle day is unchanged */
  for (let k = 0; k < N; k++) {
    const d = isoOf(randDay(1995, 2050));
    same('ovulation-calculator', { lastPeriod: d, cycle: int(20, 45), luteal: int(9, 17), cycles: int(1, 12) }, d, ['cycleDay']);
    same('week-number', { date: d }, d);
  }

  /* 2. Square footage: the price follows the unit being measured */
  const sq = (o) => now('square-footage', Object.assign({ unit: 'm', l1: 4, w1: 5, l2: 0, w2: 0, waste: 0, price: 10 }, o));
  eq(sq({}).cost, 200, '2 square metres: 20 m² at £10/m²');
  eq(sq({ waste: 10 }).cost, 220, '2 square metres: 22 m² with 10% waste at £10/m²');
  eq(sq({ l2: 2, w2: 1.5 }).cost, 230, '2 square metres: L-shape 23 m² at £10/m²');
  eq(sq({ unit: 'ft', l1: 12, w1: 10, waste: 10 }).cost, 1320, '2 square feet: 132 sq ft at £10/sq ft');
  eq(sq({ unit: 'in', l1: 144, w1: 120, waste: 0 }).cost, 1200, '2 inches: priced per sq ft (120 sq ft)');
  eq(sq({}).priceBasis, 'Price per m² × m² to order', '2 square metres: the basis is stated');
  for (let k = 0; k < N; k++) {
    const unit = k < 30 ? pick(['ft', 'in']) : 'm';
    const v = { unit, l1: int(0, 400) / 4, w1: int(0, 400) / 4, l2: int(0, 40), w2: int(0, 40), waste: int(0, 20), price: unit === 'm' ? 0 : int(0, 80) };
    same('square-footage', v, unit, ['priceBasis']);
  }

  /* 5. Average and statistics: blanks are not zeros */
  eq(now('average-calculator', { data: '10, 20,', weights: '' }).mean, 15, '5 average: trailing comma ignored');
  eq(now('average-calculator', { data: ' 10 20 ', weights: '' }).count, 2, '5 average: leading/trailing space ignored');
  eq(now('average-calculator', { data: '10, 20, 0', weights: '' }).mean, 10, '5 average: a real 0 still counts');
  eq(now('average-calculator', { data: '10, 20', weights: '1, 3,' }).weighted, 17.5, '5 average: trailing comma in weights');
  eq(now('statistics', { data: '12, 15, 11, 18, 15, 20, 13, 15,' }).mean, 14.875, '5 statistics: trailing comma ignored');
  eq(now('statistics', { data: ',2,4,4,4,5,5,7,9' }).popSD, 2, '5 statistics: leading comma ignored (σ = 2)');
  eq(now('npv-irr', { initial: 100, flows: ' 110', rate: 10 }).npv, 0, '5 NPV: leading space is not a zero flow');
  /* An empty weights field was read as one weight of 0, so every average
     carried "You gave 1 weights for N numbers". */
  eq(now('average-calculator', { data: '12, 18, 7, 25, 18, 9, 30', weights: '' }).note, '', '5 average: no phantom weights note');
  for (let k = 0; k < N; k++) {
    const list = Array.from({ length: int(1, 12) }, () => int(-500, 500) / pick([1, 2, 4, 10]));
    const sep = pick([', ', ',', ' ', '; ', ' , ']);
    const w = rnd() < 0.5 ? list.map(() => int(1, 5)).join(sep) : '';
    same('average-calculator', { data: list.join(sep), weights: w }, 'list', w ? [] : ['note']);
    same('statistics', { data: list.join(sep) }, 'list');
    same('npv-irr', { initial: int(100, 10000), flows: list.map(Math.abs).join(sep), rate: int(0, 20) }, 'list');
  }

  /* 6. Ratio: scale decimals to integers, then simplify */
  const ratio = (a, b) => now('ratio-calculator', { a, b, c: 9, total: 700 });
  eq(ratio(1.5, 2).simplified, '3 : 4', '6 ratio 1.5 : 2');
  eq(ratio(1.5, 2).asFraction, '3/4', '6 ratio 1.5 : 2 as a fraction');
  eq(ratio(0.25, 0.5).simplified, '1 : 2', '6 ratio 0.25 : 0.5');
  eq(ratio(2.5, 7.5).simplified, '1 : 3', '6 ratio 2.5 : 7.5');
  eq(ratio(0.1, 0.3).simplified, '1 : 3', '6 ratio 0.1 : 0.3 (float noise)');
  eq(ratio(1.2, 3).simplified, '2 : 5', '6 ratio 1.2 : 3');
  eq(ratio(1920, 1080).simplified, '16 : 9', '6 ratio 1920 : 1080');
  for (let k = 0; k < N; k++) same('ratio-calculator', { a: int(1, 5000) * pick([1, -1, 1, 1]), b: int(1, 5000), c: int(0, 100), total: int(0, 10000) }, 'integers');

  /* 7. SIP: the final instalment is the one actually paid */
  const sip = (o) => now('sip-calculator', Object.assign({ monthly: 10000, rate: 12, years: 2, stepup: 10 }, o));
  eq(sip({}).finalMonthly, 11000, '7 SIP: 2 years at 10% step-up, last instalment ₹11,000');
  eq(sip({ years: 1 }).finalMonthly, 10000, '7 SIP: 1 year, no step-up paid yet');
  eq(sip({ years: 15 }).finalMonthly, 10000 * Math.pow(1.1, 14), '7 SIP: 15 years, 14 step-ups');
  eq(sip({ stepup: 0, years: 15 }).finalMonthly, 10000, '7 SIP: no step-up');
  for (let k = 0; k < N; k++) {
    const v = { monthly: int(500, 100000), rate: int(0, 200) / 10, years: int(0, 40), stepup: rnd() < 0.5 ? 0 : int(1, 20) };
    same('sip-calculator', v, 'stepup ' + v.stepup, v.stepup ? ['finalMonthly'] : []);
  }

  /* 8. GST: the half rate keeps its third decimal */
  const gst = (rate, supply) => now('gst-calculator', { amount: 1000, mode: 'exclusive', rate, supply: supply || 'intra', qty: 1 });
  eq(gst(0.25).splitLabel, 'CGST 0.125% + SGST 0.125%', '8 GST 0.25% splits into 0.125% + 0.125%');
  eq(gst(0.25).cgst, 1.25, '8 GST 0.25% CGST amount on ₹1,000');
  eq(gst(18).splitLabel, 'CGST 9.00% + SGST 9.00%', '8 GST 18% label unchanged');
  eq(gst(3).splitLabel, 'CGST 1.50% + SGST 1.50%', '8 GST 3% label unchanged');
  eq(gst(0.25, 'inter').splitLabel, 'IGST 0.25%', '8 GST 0.25% IGST');
  for (let k = 0; k < N; k++) {
    same('gst-calculator', { amount: int(0, 1e6) / pick([1, 100]), mode: pick(['exclusive', 'inclusive']), rate: pick([0, 3, 5, 18, 40]), supply: pick(['intra', 'inter']), qty: int(1, 20) }, 'slab');
  }

  /* 9. Depreciation: DDB switches to straight line */
  const dep = (o) => now('depreciation', Object.assign({ method: 'ddb', cost: 10000, salvage: 0, life: 5, dbRate: 25 }, o));
  const charges = (r) => r._table.rows.map((x) => x[1]);
  eq(charges(dep({})).join(' | '), '£4,000.00 | £2,400.00 | £1,440.00 | £1,080.00 | £1,080.00', '9 DDB 10,000 / 0 / 5 years switches in year 4');
  eq(dep({}).finalBook, 0, '9 DDB reaches the residual value');
  eq(dep({}).note, 'Switches to straight line from year 4, when that gives the larger charge.', '9 DDB says when it switched');
  /* 20% a year: book 167.77 after year 8; DDB 33.55 < (167.77 − 100) / 2 = 33.89 */
  eq(charges(dep({ cost: 1000, salvage: 100, life: 10 })).slice(-3).join(' | '), '£41.94 | £33.89 | £33.89', '9 DDB 1,000 / 100 / 10 years: straight line for the last 2 years');
  eq(dep({ cost: 1000, salvage: 100, life: 10 }).finalBook, 100, '9 DDB never below salvage');
  eq(charges(dep({ cost: 50000, salvage: 5000 })).join(' | '), '£20,000.00 | £12,000.00 | £7,200.00 | £4,320.00 | £1,480.00', '9 DDB default case unchanged');
  for (let k = 0; k < N; k++) {
    const method = pick(['sl', 'db', 'syd', 'ddb']);
    const cost = int(1000, 200000), v = { method, cost, salvage: int(0, Math.floor(cost / 2)), life: int(1, 30), dbRate: int(5, 50) };
    if (method === 'ddb' && now('depreciation', v).note) continue;   // the bug's domain
    same('depreciation', v, method);
  }

  /* A. UK income tax: 45% on taxable income above £125,140 (gov.uk) */
  const uk = (gross, o) => now('uk-take-home-pay', Object.assign({ gross, year: '2026/27', pension: 0, student: 'none' }, o));
  eq(uk(150000).tax, 53703, 'A UK £150,000: 37,700@20 + 87,440@40 + 24,860@45');
  eq(uk(150000, { year: '2025/26' }).tax, 53703, 'A UK £150,000 in 2025/26');
  eq(uk(150000).ni, 5010.6, 'A UK £150,000 NI');
  eq(uk(125140).tax, 42516, 'A UK £125,140: allowance fully withdrawn');
  eq(uk(125140).personalAllowance, 0, 'A UK £125,140: allowance zero (gov.uk)');
  eq(uk(120000).tax, 39432, 'A UK £120,000: allowance £2,570, no 45%');
  eq(uk(110000).tax, 33432, 'A UK £110,000: allowance £7,570');
  eq(uk(105000).personalAllowance, 10070, 'A UK £105,000: allowance £10,070');
  eq(uk(200000).tax, 76203, 'A UK £200,000');
  eq(uk(110000).marginalRate, 60, 'A UK marginal 60% in the taper');
  eq(uk(150000).marginalRate, 45, 'A UK marginal 45% above £125,140');
  eq(uk(60000).marginalRate, 40, 'A UK marginal 40%');
  eq(uk(130000, { pension: 10 }).tax, 37632, 'A UK £130,000 less 10% pension: £117,000, allowance £4,070');
  /* B. Student loans per year (gov.uk rates and thresholds for employers) */
  eq(uk(40000, { student: 'plan2' }).loan, (40000 - 29385) * 0.09, 'B Plan 2 2026/27 threshold £29,385');
  eq(uk(40000, { student: 'plan2', year: '2025/26' }).loan, (40000 - 28470) * 0.09, 'B Plan 2 2025/26 threshold £28,470');
  eq(uk(40000, { student: 'plan1' }).loan, (40000 - 26900) * 0.09, 'B Plan 1 2026/27 threshold £26,900');
  eq(uk(40000, { student: 'plan4' }).loan, (40000 - 33795) * 0.09, 'B Plan 4 2026/27 threshold £33,795');
  eq(uk(40000, { student: 'plan5' }).loan, (40000 - 25000) * 0.09, 'B Plan 5 2026/27 threshold £25,000');
  eq(uk(40000, { student: 'plan5', year: '2025/26' }).loan, 0, 'B Plan 5 nothing due in 2025/26');
  eq(uk(40000, { student: 'pgl' }).loan, (40000 - 21000) * 0.06, 'B Postgraduate £21,000 at 6%');
  for (let k = 0; k < N; k++) {
    const year = pick(['2026/27', '2025/26']);
    const v = { gross: int(0, 99000), year, pension: int(0, 10), student: year === '2025/26' ? pick(['none', 'plan1', 'plan2', 'plan4', 'pgl']) : 'none' };
    same('uk-take-home-pay', v, 'below £100k ' + year + ' ' + v.student, ['note']);
    same('employer-cost', { salary: int(0, 300000), year, pension: int(0, 10), allowance: pick(['yes', 'no']), overheads: int(0, 9000), recruitment: int(0, 9000) }, 'employer cost');
    same('percentage', { mode: 'of', value: int(0, 100), total: int(0, 1e5) }, 'shares the UK table');
  }

  /* F. Late payment interest: reference rate + 8% */
  const inv = (o) => now('invoice-payment-terms', Object.assign({ invoiceDate: '2026-01-15', terms: '30', amount: 10000, discount: 2, discountDays: 10, daysLate: 30 }, o));
  eq(inv({}).statutoryRate, 11.75, 'F statutory rate at the 3.75% default');
  eq(inv({}).interest, 10000 * 0.1175 * 30 / 365, 'F £10,000 thirty days late');
  eq(inv({ amount: 1000, baseRate: 0.5, daysLate: 50 }).statutoryRate, 8.5, 'F gov.uk example: 0.5% base → 8.5% (£85 a year on £1,000)');
  eq(Math.round(inv({ amount: 1000, baseRate: 0.5, daysLate: 1 }).interest * 100) / 100, 0.23, 'F gov.uk example: about 23p a day');
  for (let k = 0; k < N; k++) {
    const d = randDay(2020, 2030);
    same('invoice-payment-terms', { invoiceDate: isoOf(d), terms: pick(['7', '14', '30', '45', '60', '90']), amount: int(0, 50000), discount: int(0, 50) / 10, discountDays: int(0, 20), daysLate: int(0, 90), baseRate: 4.75 }, 'at the old 4.75%', ['statutoryRate']);
  }

  /* Gratuity: a part year counts only when MORE than six months */
  const gr = (years, covered) => now('gratuity-calculator', { salary: 60000, years, covered: covered || 'yes' });
  eq(gr(10.5).yearsCounted, 10, 'gratuity: exactly six months over is not counted');
  eq(gr(10.75).yearsCounted, 11, 'gratuity: more than six months rounds up');
  eq(gr(10.5).gratuity, 60000 * 15 / 26 * 10, 'gratuity: 10.5 years');
  for (let k = 0; k < N; k++) {
    const y = int(0, 40) + pick([0, 0.25, 0.75]);
    same('gratuity-calculator', { salary: int(10000, 300000), years: y, covered: pick(['yes', 'no']) }, 'years ' + y, ['note', 'eligibility']);
  }

  indiaTests();
}

/* India statutory checks — sources are cited next to each constant. */
function indiaTests() {
  /* C. TDS: 194H and 194-IB at 2% from 1 Oct 2024; no PAN = higher of the
     rate or 20% (5% for purchase of goods), never "twice the rate"; the
     rent-by-individual deduction capped at one month's rent. */
  const tds = (section, pan, o) => now('tds-calculator', Object.assign({ section, amount: 100000, pan: pan || 'yes', lastRent: 0 }, o));
  eq(tds('194H').tds, 2000, 'C TDS commission 2% (Finance (No. 2) Act 2024 s.57)');
  eq(tds('194IB').tds, 2000, 'C TDS rent by individual 2% (Finance (No. 2) Act 2024 s.59)');
  eq(tds('194H', 'no').tds, 20000, 'C TDS commission without PAN 20%');
  eq(tds('194Q', 'no').tds, 5000, 'C TDS purchase of goods without PAN 5%, not 20%');
  eq(tds('194Q', 'no').rate, 5, 'C TDS purchase of goods without PAN: rate 5%');
  eq(tds('194J_prof', 'no').tds, 20000, 'C TDS professional fees without PAN 20%');
  eq(tds('194C_ind', 'no').tds, 20000, 'C TDS contractor without PAN 20%, not 2%');
  eq(tds('194IB', 'no', { amount: 720000 }).tds, 60000, 'C TDS rent by individual, no PAN: capped at one month (12 × ₹60,000)');
  eq(tds('194IB', 'no', { amount: 720000, lastRent: 50000 }).tds, 50000, 'C TDS rent by individual, no PAN: capped at the stated last month');
  eq(tds('194IB', 'no', { amount: 200000, lastRent: 50000 }).tds, 40000, 'C TDS rent by individual, no PAN: 20% when below the cap');
  eq(tds('194H').section, 'Income-tax Act, 2025 s.393(1) Table Sl. 1(ii) (was 194H of the 1961 Act)', 'D TDS provision named under the 2025 Act');
  for (let k = 0; k < N; k++) {
    const section = pick(['194C_ind', '194C_oth', '194J_tech', '194J_prof', '194I_pm', '194I_land', '194A']);
    same('tds-calculator', { section, amount: int(0, 5e6), pan: pick(['yes', 'no']), lastRent: 0 }, section, ['section', 'note']);
  }

  /* E. NPS: at least 20% annuity (non-government) or 40% (government) */
  const nps = (o) => now('nps-calculator', Object.assign({ monthly: 10000, age: 30, rate: 10, sector: 'private', annuityPct: 20, annuityRate: 6 }, o));
  const c = nps({}).corpus;
  eq(nps({}).annuity, c * 0.2, 'E NPS non-government: 20% annuity allowed');
  eq(nps({}).lumpsum, c * 0.8, 'E NPS non-government: 80% lump sum');
  eq(nps({}).exemptLumpsum, c * 0.6, 'E NPS only 60% of the corpus is tax-exempt');
  eq(nps({ annuityPct: 10 }).annuity, c * 0.2, 'E NPS non-government: below 20% is raised to 20%');
  eq(nps({ sector: 'govt' }).annuity, c * 0.4, 'E NPS government: 40% minimum kept');
  eq(nps({ annuityPct: 40 }).exemptLumpsum, c * 0.6, 'E NPS 40% annuity: whole lump sum exempt');
  ok(/₹8 lakh/.test(nps({ monthly: 1000, age: 50, rate: 8 }).note), 'E NPS small corpus (≤ ₹8 lakh) note');
  for (let k = 0; k < N; k++) {
    same('nps-calculator', { monthly: int(500, 100000), age: int(18, 59), rate: int(0, 140) / 10, sector: pick(['private', 'govt']), annuityPct: int(40, 100), annuityRate: int(0, 32) / 4 }, '40%+', ['note', 'exemptLumpsum']);
  }

  /* D. HRA: 50% for eight cities from tax year 2026-27 (rule 279, 2026 Rules) */
  const hra = (metro, year) => now('hra-exemption', { basic: 600000, hra: 400000, rent: 500000, metro, year });
  eq(hra('metro8', '2026-27').exempt, 300000, 'D HRA Bengaluru 2026-27: 50% of salary');
  eq(hra('metro8', '2025-26').exempt, 240000, 'D HRA Bengaluru FY 2025-26: 40% of salary');
  ok(hra('metro8', '2025-26').note !== '', 'D HRA Bengaluru FY 2025-26: says why');
  eq(hra('metro', '2026-27').exempt, 300000, 'D HRA Mumbai: 50%');
  eq(hra('non', '2026-27').exempt, 240000, 'D HRA elsewhere: 40%');
  for (let k = 0; k < N; k++) {
    same('hra-exemption', { basic: int(0, 3e6), hra: int(0, 1.5e6), rent: int(0, 2e6), metro: pick(['metro', 'non']), year: pick(['2026-27', '2025-26']) }, 'metro/non', ['note']);
  }

  /* D. Wording only: these engines' figures must not move */
  for (let k = 0; k < N; k++) {
    same('advance-tax', { taxLiability: int(0, 2e6), tdsPaid: int(0, 5e5), paidSoFar: int(0, 5e5) }, 'figures');
    const fy = pick(['2026-27', '2025-26']);
    same('india-income-tax', { fy, gross: int(0, 6e6), type: pick(['salaried', 'other']), age: pick(['below60', 'senior', 'super']), deductions: int(0, 5e5) }, 'figures', fy === '2025-26' ? [] : ['_table']);
    same('india-capital-gains', { asset: pick(['equity', 'debt', 'property', 'other']), sale: int(0, 5e6), cost: int(0, 5e6), expenses: int(0, 1e5), months: int(0, 120), slabRate: pick([0, 5, 20, 30]) }, 'figures', ['basis']);
  }
}

/* ---------- run ---------- */
dateTests();
if (!DATES_ONLY) {
  otherTests();
  for (const tz of ['America/New_York', 'Asia/Kolkata', 'Pacific/Auckland']) {
    const extra = ['--tz', tz, '--dates-only', '--json'];
    if (arg('--root')) extra.push('--root', ROOT);
    const r = spawnSync(process.execPath, [__filename, ...extra], { encoding: 'utf8' });
    let res;
    try { res = JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { res = { pass: 0, fail: 1, failures: ['child ' + tz + ' failed: ' + (r.stderr || r.stdout).slice(0, 500)] }; }
    pass += res.pass; fail += res.fail; failures.push(...res.failures);
  }
}

if (argv.includes('--json')) {
  console.log(JSON.stringify({ pass, fail, failures }));
} else {
  if (!baseOK) console.log('WARNING: baseline ' + BASE + ' not readable with git — regression checks were skipped.');
  failures.forEach((f) => console.log('FAIL ' + f));
  console.log(`engines: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
