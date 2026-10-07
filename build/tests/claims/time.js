/**
 * Claims on the time calculators and the live time tools (/time/).
 * Moved out of calc-everyday.js by wave 4, which owns these pages; the
 * live tools (time zone converter, countdown, stopwatch) are checked in
 * time-live.js, loaded at the end of this file.
 *
 * Every calculator check runs the page's own engine in Node (K.calc), with
 * the clock held at 2026-10-04 12:00 unless the claim is about the clock.
 * The date oracles in four time zones live in build/tests/engines.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node';
  const NOW = '2026-10-04T12:00:00';
  const run = (url, inputs, now) => K.calc(url, inputs, { now: now || NOW });
  const specOf = (url) => K.calcSpec(url, { now: NOW });
  const close = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol) * Math.max(1, Math.abs(b));
  const input = (url, key) => (specOf(url).inputs || []).find((i) => i.key === key) || {};
  const output = (url, key) => (specOf(url).outputs || []).find((o) => o.key === key) || {};
  const optVals = (url, key) => (input(url, key).options || []).map((o) => String(o.value));
  const optLabels = (url, key) => (input(url, key).options || []).map((o) => String(o.label));
  /* the first case that fails, or a pass naming how many were tried */
  const every = (cases, fn) => { for (const c of cases) { const r = fn(c); if (!r[0]) return r; } return [true, cases.length + ' cases hold']; };
  /* calendar dates as plain UTC days */
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const dow = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
  const shortD = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const longD = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  /* a seeded generator, so a failing case reproduces */
  let seed = 0x5eed;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const randISO = (y0, y1) => addDays(y0 + '-01-01', int(0, daysBetween(y0 + '-01-01', y1 + '-12-31')));


  /* ================================================================ */
  /* /time/                                                            */
  /* ================================================================ */

  const DA = '/time/date-add-subtract/';
  const da = (i) => run(DA, Object.assign({ years: 0, months: 0, weeks: 0, days: 0 }, i));

  const AGE = '/time/age-calculator/';
  const age = (dob, on) => run(AGE, { dob, on });
  {
    claim(AGE, 'lede', 'Work out an exact age in years, months and days, plus total days lived and time to the next birthday.', 'the default birth date on a held day', N, async () => {
      const r = age('1990-06-15', '2026-10-04'); return [r.exact === '36 years, 3 months, 19 days' && r.totalDays === daysBetween('1990-06-15', '2026-10-04') && r.nextBirthday === 'Tuesday, 15 June 2027' && r.daysToNext === 254, K.j(r)];
    });
    claim(AGE, 'card', 'Work out an exact age in years, months and days, plus total days lived and time to the next birthday.', 'total days and days to the next birthday', N, async () => {
      const r = age('2000-02-29', '2026-10-04'); return [r.totalDays === daysBetween('2000-02-29', '2026-10-04') && r.daysToNext === daysBetween('2026-10-04', '2027-03-01'), r.totalDays + ', ' + r.daysToNext];
    });
    claim(AGE, 'why', 'Enter a birth date. Get exact age, days lived and next birthday, for one person or a list of them.', 'all three come back; two more people make a table', N, async () => {
      const r = age('1985-11-30', '2026-10-04'), g = run(AGE, { dob: '1985-11-30', on: '2026-10-04', others: 'Asha 1988-03-02; Tom 2015-11-30' });
      const names = ((g._table || {}).rows || []).map((x) => x[0]);
      return [/^\d+ years, \d+ months, \d+ days$/.test(r.exact) && r.totalDays > 0 && /2026/.test(r.nextBirthday) && names.indexOf('Asha') >= 0 && names.indexOf('Tom') >= 0, K.j(names)];
    });
    claim(AGE, 'what', 'counted in whole years, then whole months, then the days left over', 'months never 12, days never a whole month', N, async () => every([...Array(300)].map(() => [randISO(1930, 2025), randISO(2026, 2030)]), ([a, b]) => {
      const r = age(a, b); const m = r.exact.match(/^(\d+) years, (\d+) months, (\d+) days$/); return [m && +m[2] < 12 && +m[3] < 31 && r.totalMonths === 12 * +m[1] + +m[2], a + ' → ' + b + ': ' + r.exact];
    }));
    claim(AGE, 'what', 'two children born a day apart can sit on opposite sides of a cut-off for a whole year', '31 Aug vs 1 Sep 2012, on 31 Aug 2026', N, async () => { const a = age('2012-08-31', '2026-08-31').years, b = age('2012-09-01', '2026-08-31').years; return [a === 14 && b === 13, a + ' / ' + b]; });
    claim(AGE, 'works', 'Adding the answer to the date of birth with the date add calculator lands on the “age at” date.', 'age, then date add, on 400 pairs incl. month ends and 29 February', N, async () => {
      const pairs = [['1990-01-31', '2026-03-01'], ['2020-03-31', '2020-05-01'], ['2008-02-29', '2027-02-28'], ['2008-02-29', '2027-03-01'], ['1999-12-31', '2000-02-29']];
      for (let k = 0; k < 400; k++) pairs.push([randISO(1920, 2025), randISO(2025, 2035)].sort());
      return every(pairs, ([a, b]) => {
        const r = age(a, b); const m = r.exact.match(/^(\d+) years, (\d+) months, (\d+) days$/);
        const x = da({ start: a, years: +m[1], months: +m[2], days: +m[3] }); return [x.iso === b, a + ' + ' + r.exact + ' = ' + x.iso + ', not ' + b];
      });
    });
    claim(AGE, 'works', 'a birth day missing from a shorter month, such as the 31st, becomes that month’s last day', '31 March to 1 May is 1 month and 1 day', N, async () => { const r = age('2020-03-31', '2020-05-01').exact; return [r === '0 years, 1 months, 1 days', r]; });
    claim(AGE, 'works', 'Total days is the plain count between the dates.', 'across leap days and clock changes', N, async () => every([['1990-06-15', '2026-10-04'], ['2027-03-27', '2027-03-29'], ['2027-10-30', '2027-11-01'], ['1900-02-28', '1900-03-01']], ([a, b]) => {
      const r = age(a, b).totalDays; return [r === daysBetween(a, b), a + ' → ' + b + ': ' + r];
    }));
    claim(AGE, 'works', 'total weeks = ⌊total days ÷ 7⌋ total hours = total days × 24', 'weeks rounded down, hours', N, async () => every([['2012-09-01', '2026-08-31'], ['2026-10-01', '2026-10-07'], ['2026-10-01', '2026-10-08']], ([a, b]) => {
      const r = age(a, b); return [r.totalWeeks === Math.floor(r.totalDays / 7) && r.totalHours === r.totalDays * 24, a + ' → ' + b + ': ' + r.totalWeeks + ' wk, ' + r.totalHours + ' h'];
    }));
    claim(AGE, 'worked', 'Move the “age at” date on by a single day and the age in years becomes 14.', 'on the birthday', N, async () => { const a = age('2012-09-01', '2026-08-31').years, b = age('2012-09-01', '2026-09-01').years; return [a === 13 && b === 14, a + ' → ' + b]; });
    claim(AGE, 'mistake', 'Leap days push that upwards: the player above is not yet 14, yet 5,112 ÷ 365 is just over 14.', 'years vs days ÷ 365', N, async () => { const r = age('2012-09-01', '2026-08-31'); return [r.years === 13 && r.totalDays / 365 > 14, r.years + ' vs ' + (r.totalDays / 365).toFixed(3)]; });
    claim(AGE, 'dfaq', 'Still a year short here.', '29 Feb 2008 on 28 Feb 2027 and on 1 Mar 2027', N, async () => {
      const a = age('2008-02-29', '2027-02-28'), b = age('2008-02-29', '2027-03-01'); return [a.years === 18 && b.years === 19 && a.nextBirthday === 'Monday, 1 March 2027', a.years + ' → ' + b.years + ', next ' + a.nextBirthday];
    });
    claim(AGE, 'tip', 'Most jurisdictions treat 1 March as the legal date in other years.', 'the tool uses 1 March: next birthday and the year turning', N, async () => {
      const a = age('2004-02-29', '2026-10-04'), b = age('2004-02-29', '2027-02-28'), c = age('2004-02-29', '2027-03-01'), d = age('2004-02-29', '2028-01-01');
      return [a.nextBirthday === 'Monday, 1 March 2027' && b.years === 22 && c.years === 23 && d.nextBirthday === 'Tuesday, 29 February 2028', a.nextBirthday + '; ' + b.years + ' → ' + c.years + '; ' + d.nextBirthday];
    });
    claim(AGE, 'dfaq', 'Enter both dates and read Total days, which includes every leap day between them.', '28 Feb → 1 Mar 2028 is 2 days', N, async () => { const a = age('2028-02-28', '2028-03-01').totalDays, b = age('2027-02-28', '2027-03-01').totalDays; return [a === 2 && b === 1, a + ' / ' + b]; });
    claim(AGE, 'dfaq', '6 completed months, with the seventh reached on 20 October', 'total months on 19 and 20 October', N, async () => { const a = age('2026-03-20', '2026-10-19').totalMonths, b = age('2026-03-20', '2026-10-20').totalMonths; return [a === 6 && b === 7, a + ' → ' + b]; });
    claim(AGE, 'tip', 'The years/months/days breakdown walks the calendar rather than assuming an average month', '1 Feb → 1 Mar is a month of 28 days', N, async () => { const a = age('2027-02-01', '2027-03-01').exact, b = age('2027-03-01', '2027-03-29').exact; return [a === '0 years, 1 months, 0 days' && b === '0 years, 0 months, 28 days', a + ' / ' + b]; });
    claim(AGE, 'faq', 'Going from 31 January to 28 February is one day short of a full month, so it counts as 0 months and 28 days rather than 1 month.', '31 Jan → 28 Feb', N, async () => { const r = age('2027-01-31', '2027-02-28').exact; return [r === '0 years, 0 months, 28 days', r]; });
    claim(AGE, 'tip', 'Set the second date to something other than today to work out an age at a past or future point', 'a future date works; a date before birth is refused', N, async () => {
      const a = age('1990-06-15', '2040-01-01'), b = age('1990-06-15', '1980-01-01'); return [a.years === 49 && !!b.note && b.years === undefined, a.exact + ' / ' + b.note];
    });
    claim(AGE, 'formula', 'calendar-aware difference between date of birth and a reference date', 'a leap-day birth on the next leap day', N, async () => { const r = age('2024-02-29', '2028-02-29').exact; return [r === '4 years, 0 months, 0 days', r]; });
    claim(AGE, 'mistake', 'an age “on 31 August” must be measured on 31 August', 'the "age at" box sets the day', N, async () => { const a = age('2012-09-01', '2026-08-31').years, b = age('2012-09-01', '2026-10-04').years; return [a === 13 && b === 14, a + ' / ' + b]; });
    manual(AGE, 'use', 'Nursery applications and child development reviews often record a young child’s age in months.', 'practice outside the tool');
  }

  const BD = '/time/business-days/';
  const bd = (i) => run(BD, Object.assign({ mode: 'between', holidays: '' }, i));
  const bdAdd = (start, n, holidays) => bd({ start, mode: 'add', add: n, holidays: holidays || '' });
  {
    claim(BD, 'lede', 'Count working days between two dates, or add working days to a date, excluding weekends and holidays.', 'both modes, with a holiday', N, async () => {
      const a = bd({ start: '2026-12-21', end: '2027-01-04', holidays: '2026-12-25, 2026-12-28, 2027-01-01' }), b = bdAdd('2026-12-24', 1, '2026-12-25, 2026-12-28');
      return [a.businessDays === 7 && b.iso === '2026-12-29', a.businessDays + ' / ' + b.iso];
    });
    claim(BD, 'card', 'Count working days between two dates, or add working days to a date, excluding weekends and holidays.', 'both modes', N, async () => {
      const a = bd({ start: '2026-10-05', end: '2026-10-19' }), b = bdAdd('2026-10-09', 1); return [a.businessDays === 10 && b.iso === '2026-10-12', a.businessDays + ' / ' + b.iso];
    });
    claim(BD, 'why', 'Pick the dates and a UK, India or US holiday calendar, or list your own. Get working days or the end date.', 'a count under each calendar (worked by hand), a typed list, or a date', N, async () => {
      /* by hand: Dec 2026 has 23 weekdays, less 25 Dec and the 28 Dec substitute; Oct 2026 has 22, less 2 and 20 Oct
         (Gandhi Jayanti, Dussehra); Nov 2026 has 21, less 11 Nov and 26 Nov (Veterans Day, Thanksgiving) */
      const uk = bd({ start: '2026-12-01', end: '2027-01-01', calendar: 'uk-ew' }).businessDays, ind = bd({ start: '2026-10-01', end: '2026-11-01', calendar: 'in-central' }).businessDays;
      const us = bd({ start: '2026-11-01', end: '2026-12-01', calendar: 'us-federal' }).businessDays;
      const a = bd({ start: '2027-05-01', end: '2027-06-01', holidays: '2027-05-03, 2027-05-31' }), b = bdAdd('2026-12-18', 10, '2026-12-25, 2026-12-28, 2027-01-01');
      return [uk === 21 && ind === 20 && us === 19 && a.result === '19 business days' && b.result === 'Wednesday, 6 January 2027', [uk, ind, us, a.result, b.result].join(' / ')];
    });
    claim(BD, 'what', 'A business day is a weekday that is not a public holiday.', 'a listed weekday holiday is not counted', N, async () => {
      const a = bd({ start: '2026-12-21', end: '2026-12-26' }).businessDays, b = bd({ start: '2026-12-21', end: '2026-12-26', holidays: '2026-12-25' }).businessDays; return [a === 5 && b === 4, a + ' → ' + b];
    });
    claim(BD, 'what', 'so a “10 day” period can stretch past two calendar weeks', '10 business days over Christmas', N, async () => { const r = bdAdd('2026-12-18', 10, '2026-12-25, 2026-12-28, 2027-01-01'); return [r.calendarDays > 14, r.calendarDays + ' calendar days']; });
    claim(BD, 'works', 'In count mode the tool walks from the start date to the day before the end date, sorting each day into weekend, holiday or business day.', 'start counted, end not; the three heaps add up', N, async () => {
      const fri = bd({ start: '2026-10-02', end: '2026-10-03' }), sat = bd({ start: '2026-10-03', end: '2026-10-05' }), r = bd({ start: '2026-12-01', end: '2027-01-15', holidays: '2026-12-25, 2026-12-26, 2027-01-01' });
      return [fri.businessDays === 1 && sat.businessDays === 0 && r.businessDays + r.weekendDays + r.holidaysUsed === r.calendarDays, 'Fri→Sat ' + fri.businessDays + ', Sat→Mon ' + sat.businessDays + '; ' + [r.businessDays, r.weekendDays, r.holidaysUsed, r.calendarDays].join('+')];
    });
    claim(BD, 'works', 'In add mode it steps forward from the day after the start and stops on the business day that reaches your number.', 'add 1 from Fri, Sat and Mon', N, async () => {
      const a = bdAdd('2026-10-02', 1).iso, b = bdAdd('2026-10-03', 1).iso, c = bdAdd('2026-10-05', 1).iso, z = bdAdd('2026-10-03', 0).iso; return [a === '2026-10-05' && b === '2026-10-05' && c === '2026-10-06' && z === '2026-10-03', [a, b, c, z].join(', ')];
    });
    claim(BD, 'works', 'business days = calendar days − weekend days − holidays on working days', 'a year with holidays', N, async () => {
      const r = bd({ start: '2027-01-01', end: '2028-01-01', holidays: '2027-01-01, 2027-03-26, 2027-03-29, 2027-05-03, 2027-05-31, 2027-08-30, 2027-12-27, 2027-12-28' });
      return [r.businessDays === r.calendarDays - r.weekendDays - r.holidaysUsed && r.holidaysUsed === 8, [r.calendarDays, r.weekendDays, r.holidaysUsed, r.businessDays].join(', ')];
    });
    claim(BD, 'works', 'calendar days = end date − start date', 'a month', N, async () => { const r = bd({ start: '2027-05-01', end: '2027-06-01' }); return [r.calendarDays === 31, r.calendarDays]; });
    claim(BD, 'works', 'dates from the chosen calendar or the box that fall outside the weekend', 'a Saturday holiday changes nothing', N, async () => {
      const a = bd({ start: '2027-12-20', end: '2028-01-03' }), b = bd({ start: '2027-12-20', end: '2028-01-03', holidays: '2027-12-25' }); return [a.businessDays === b.businessDays && b.holidaysUsed === 0, a.businessDays + ' / ' + b.businessDays + ', ' + b.holidaysUsed + ' excluded'];
    });
    claim(BD, 'mistake', 'When Christmas Day is a Saturday it is already excluded; enter the substitute weekday the bank holiday moves to instead.', 'Sat 25 Dec 2027 vs Mon 27 Dec', N, async () => {
      const a = bd({ start: '2027-12-20', end: '2028-01-03', holidays: '2027-12-25' }).businessDays, b = bd({ start: '2027-12-20', end: '2028-01-03', holidays: '2027-12-27' }).businessDays; return [dow('2027-12-25') === 6 && a === 10 && b === 9, a + ' / ' + b];
    });
    claim(BD, 'mistake', 'The box reads YYYY-MM-DD only: entered as 31/05/2027, the spring bank holiday is not recognised and May shows 21 business days instead of 19.', 'day-first holidays', N, async () => {
      const a = bd({ start: '2027-05-01', end: '2027-06-01', holidays: '03/05/2027, 31/05/2027' }).businessDays, b = bd({ start: '2027-05-01', end: '2027-06-01', holidays: '2027-05-03, 2027-05-31' }).businessDays, c = bd({ start: '2027-05-01', end: '2027-06-01', holidays: '2027-05-03, 31/05/2027' }).businessDays;
      return [a === 21 && b === 19 && c === 20, a + ' / ' + b + ' / ' + c];
    });
    claim(BD, 'dfaq', 'any 14 consecutive days contain exactly two of each weekday, so 10 of them fall Monday to Friday. A bank holiday inside the fortnight takes it to 9.', 'fortnights from every weekday', N, async () => every([0, 1, 2, 3, 4, 5, 6].map((k) => addDays('2027-03-01', k)), (s) => {
      const a = bd({ start: s, end: addDays(s, 14) }).businessDays, b = bd({ start: s, end: addDays(s, 14), holidays: '2027-03-10' }).businessDays; return [a === 10 && b === 9, s + ': ' + a + ' / ' + b];
    }));
    claim(BD, 'dfaq', 'The following Friday, if no holiday intervenes.', '5 business days after a Friday', N, async () => every(['2027-06-04', '2026-10-02', '2027-03-26'], (s) => { const r = bdAdd(s, 5); return [r.iso === addDays(s, 7) && /^Friday/.test(r.result), s + ' → ' + r.result]; }));
    claim(BD, 'formula', 'weekdays only, minus any dates you list as holidays', 'a month with and without holidays', N, async () => {
      const a = bd({ start: '2027-05-01', end: '2027-06-01' }).businessDays, b = bd({ start: '2027-05-01', end: '2027-06-01', holidays: '2027-05-03, 2027-05-31' }).businessDays; return [a === 21 && b === 19, a + ' / ' + b];
    });
    claim(BD, 'tip', 'then type any extra dates (a regional or company holiday) into the box: both are taken off', 'England and Wales plus a company day', N, async () => {
      const a = bd({ start: '2026-12-21', end: '2027-01-04', calendar: 'uk-ew' }), b = bd({ start: '2026-12-21', end: '2027-01-04', calendar: 'uk-ew', holidays: '2026-12-29' }), c = bd({ start: '2026-12-25', end: '2026-12-26' });
      return [a.businessDays === 7 && a.holidaysUsed === 3 && b.businessDays === 6 && b.holidaysUsed === 4 && c.businessDays === 1, [a.businessDays, b.businessDays, c.businessDays].join(' / ')];
    });
    claim(BD, 'tip', 'Counting is exclusive of the end date, matching how notice periods and payment terms are usually written.', 'Mon → Tue is 1; Mon → Mon is 0', N, async () => { const a = bd({ start: '2026-10-05', end: '2026-10-06' }).businessDays, b = bd({ start: '2026-10-05', end: '2026-10-05' }).businessDays; return [a === 1 && b === 0, a + ' / ' + b]; });
    claim(BD, 'tip', 'When adding or subtracting business days, the start date itself is not counted — day one is the next working day in that direction.', 'add 1 from a Monday is Tuesday; subtract 1 is the Friday before', N, async () => { const a = bdAdd('2026-10-05', 1).iso, b = bd({ start: '2026-10-05', mode: 'sub', add: 1 }).iso, z = bd({ start: '2026-10-05', mode: 'sub', add: 0 }).iso; return [a === '2026-10-06' && b === '2026-10-02' && z === '2026-10-05', [a, b, z].join(', ')]; });
    claim(BD, 'faq', 'When adding, this tool leaves the start date out: day one is the next working day. When counting between two dates it counts the start date but not the end date', 'add from a Friday; count Fri→Sat and Sat→Mon', N, async () => {
      const a = bdAdd('2026-10-02', 1).iso, b = bd({ start: '2026-10-02', end: '2026-10-03' }).businessDays, c = bd({ start: '2026-10-03', end: '2026-10-05' }).businessDays;
      return [a === '2026-10-05' && b === 1 && c === 0, a + ', ' + b + ', ' + c];
    });
    claim(BD, 'faq', 'which gives the same total as leaving the start out and counting the end whenever both are working days', 'random weekday pairs', N, async () => every([...Array(200)].map(() => { let a, b; do { a = randISO(2026, 2028); } while (dow(a) === 0 || dow(a) === 6); do { b = addDays(a, int(1, 120)); } while (dow(b) === 0 || dow(b) === 6); return [a, b]; }), ([a, b]) => {
      const got = bd({ start: a, end: b }).businessDays; let alt = 0; for (let d = addDays(a, 1); d <= b; d = addDays(d, 1)) if (dow(d) !== 0 && dow(d) !== 6) alt++; return [got === alt, a + ' → ' + b + ': ' + got + ' vs ' + alt];
    }));
    claim(BD, 'what', 'Which days are holidays depends on the country, and within the UK on the nation', 'no country is assumed: an empty box excludes no holiday', N, async () => {
      const r = bd({ start: '2027-01-01', end: '2028-01-01' }); return [r.businessDays === 261 && r.holidaysUsed === 0 && input(BD, 'holidays').default === '', r.businessDays];
    });
    claim(BD, 'mistake', 'Easter Monday is a bank holiday in England, Wales and Northern Ireland but not in Scotland.', 'Easter Monday 2027 in each UK calendar', N, async () => {
      const r = ['uk-ew', 'uk-ni', 'uk-sco'].map((c) => bd({ start: '2027-03-29', end: '2027-03-30', calendar: c }).businessDays); return [r.join() === '0,0,1', r.join()];
    });
  }

  {
    claim(DA, 'lede', 'Add or subtract years, months, weeks and days from any date, with correct end-of-month handling.', 'each unit, both directions, a month end', N, async () => {
      const r = [da({ start: '2027-01-31', months: 1 }).iso, da({ start: '2027-01-31', months: 1, dir: 'sub' }).iso, da({ start: '2026-10-04', years: 2, weeks: 1, days: 3 }).iso];
      return [r.join() === '2027-02-28,2026-12-31,2028-10-14', r.join()];
    });
    claim(DA, 'card', 'Add or subtract years, months, weeks and days from any date, with correct end-of-month handling.', '31 Jan + 1 month', N, async () => { const r = da({ start: '2027-01-31', months: 1 }).iso; return [r === '2027-02-28', r]; });
    claim(DA, 'why', 'Pick a date, then add or take away days, weeks, months or years.', '90 days on and back', N, async () => {
      const a = da({ start: '2026-10-04', days: 90 }).iso, b = da({ start: a, days: 90, dir: 'sub' }).iso; return [a === '2027-01-02' && b === '2026-10-04', a + ' / ' + b];
    });
    claim(DA, 'what', 'A month after 15 March is 15 April, 31 days on, while a month after 15 April is 15 May, only 30.', 'days moved', N, async () => {
      const a = da({ start: '2027-03-15', months: 1 }), b = da({ start: '2027-04-15', months: 1 }); return [a.iso === '2027-04-15' && a.totalDays === 31 && b.iso === '2027-05-15' && b.totalDays === 30, a.iso + ' ' + a.totalDays + ' / ' + b.iso + ' ' + b.totalDays];
    });
    claim(DA, 'what', 'When that day does not exist in the target month, the tool settles on the month’s last day and adds a note saying it did.', 'a note only when clamped', N, async () => {
      const a = da({ start: '2027-05-31', months: 1 }), b = da({ start: '2027-05-30', months: 1 }); return [a.iso === '2027-06-30' && /clamped/.test(a.note) && b.note === '', a.iso + ' ' + K.j(a.note) + ' / ' + K.j(b.note)];
    });
    claim(DA, 'works', 'Years and months move first, on the month and year numbers alone; a day past the end of the new month becomes that month’s last day. Weeks are then turned into days and counted on the calendar. Subtract runs the same steps backwards.', '31 Jan + 1 month + 1 day; 31 Mar − 1 month − 1 day', N, async () => {
      const a = da({ start: '2027-01-31', months: 1, days: 1 }).iso, b = da({ start: '2027-03-31', months: 1, days: 1, dir: 'sub' }).iso, c = da({ start: '2027-01-31', months: 1, weeks: 1 }).iso;
      return [a === '2027-03-01' && b === '2027-02-27' && c === '2027-03-07', [a, b, c].join(', ')];
    });
    claim(DA, 'works', 'target month = start month ± (years × 12 + months) day = min(start day, last day of the target month) result = that date ± (weeks × 7 + days)', 'years and months as one count of months', N, async () => {
      const a = da({ start: '2027-11-30', years: 1, months: 3 }).iso, b = da({ start: '2027-11-30', months: 15 }).iso, c = da({ start: '2027-11-30', months: 15, dir: 'sub' }).iso;
      return [a === '2029-02-28' && b === a && c === '2026-08-30', [a, b, c].join(', ')];
    });
    claim(DA, 'worked', 'Counting days would not get there: six 30-day months make 180, and 26 weeks make 182.', '6 months vs 180 days vs 26 weeks', N, async () => {
      const m = da({ start: '2026-08-31', months: 6 }), d = da({ start: '2026-08-31', days: 180 }), w = da({ start: '2026-08-31', weeks: 26 });
      return [m.iso === '2027-02-28' && m.totalDays === 181 && d.iso !== m.iso && w.iso !== m.iso, m.iso + ' / ' + d.iso + ' / ' + w.iso];
    });
    claim(DA, 'use', 'Find when a 12-month plan renews, including one that began on the 29th, 30th or 31st.', '12 months from the 29th, 30th and 31st', N, async () => {
      const a = da({ start: '2028-02-29', months: 12 }).iso, b = da({ start: '2027-01-30', months: 12 }).iso, c = da({ start: '2027-08-31', months: 12 }).iso; return [a === '2029-02-28' && b === '2028-01-30' && c === '2028-08-31', [a, b, c].join(', ')];
    });
    claim(DA, 'mistake', 'Forgetting that Months starts at 1.', 'the Months default', N, async () => {
      const d = input(DA, 'months').default, r = run(DA, { start: '2027-01-04', weeks: 6 }); return [d === 1 && r.iso === '2027-03-18', d + '; 6 weeks with Months untouched → ' + r.iso];
    });
    claim(DA, 'mistake', 'Expecting add and subtract to cancel out.', '+6 then −6 months from 31 Aug', N, async () => {
      const a = da({ start: '2026-08-31', months: 6 }).iso, b = da({ start: a, months: 6, dir: 'sub' }).iso; return [a === '2027-02-28' && b === '2026-08-28', a + ' → ' + b];
    });
    claim(DA, 'mistake', 'Three months before 31 May 2027 is Sunday, 28 February 2027, which is 92 days earlier, not 90.', 'subtract months, days moved', N, async () => { const r = da({ start: '2027-05-31', months: 3, dir: 'sub' }); return [r.iso === '2027-02-28' && r.totalDays === 92 && r.direction === 'earlier', r.iso + ' ' + r.totalDays + ' ' + r.direction]; });
    claim(DA, 'dfaq', 'The year before has no 29 February, so the day becomes the 28th.', '29 Feb 2028 − 1 year; + 1 year', N, async () => {
      const a = da({ start: '2028-02-29', years: 1, dir: 'sub' }), b = da({ start: '2028-02-29', years: 1 }); return [a.iso === '2027-02-28' && a.totalDays === 366 && b.iso === '2029-02-28', a.iso + ' (' + a.totalDays + ') / ' + b.iso];
    });
    claim(DA, 'dfaq', 'the year and months take it to 20 January, then the 10 days are counted', 'years, months and days together', N, async () => { const r = da({ start: '2026-11-20', years: 1, months: 2, days: 10 }).iso; return [r === '2028-01-30', r]; });
    claim(DA, 'dfaq', '42, always.', '6 weeks from dates across both clock changes and a leap day', N, async () => every(['2027-01-04', '2027-03-20', '2027-10-20', '2028-02-10', '2026-12-28'], (s) => {
      const r = da({ start: s, weeks: 6 }); return [r.totalDays === 42 && r.iso === addDays(s, 42), s + ' → ' + r.iso + ' (' + r.totalDays + ')'];
    }));
    claim(DA, 'formula', 'calendar-aware, clamping to the end of month rather than rolling over', 'every month end of 2027 + 1 month', N, async () => every([...Array(12)].map((_, i) => new Date(Date.UTC(2027, i + 1, 0)).toISOString().slice(0, 10)), (s) => {
      const r = da({ start: s, months: 1 }).iso; const want = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7), Math.min(+s.slice(8), new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) + 1, 0)).getUTCDate()))).toISOString().slice(0, 10);
      return [r === want, s + ' → ' + r + ' (want ' + want + ')'];
    }));
    claim(DA, 'tip', 'Years and months are applied before days, which is the convention contracts and statutes assume.', '30 Jan + 1 month + 1 day', N, async () => { const r = da({ start: '2027-01-30', months: 1, days: 1 }).iso; return [r === '2027-03-01', r + ' (days first would give 2027-02-28)']; });
    claim(DA, 'tip', 'End-of-month is clamped, not rolled: 31 January plus one month is 28 or 29 February, not 3 March.', '2027 and 2028', N, async () => { const a = da({ start: '2027-01-31', months: 1 }).iso, b = da({ start: '2028-01-31', months: 1 }).iso; return [a === '2027-02-28' && b === '2028-02-29', a + ' / ' + b]; });
    claim(DA, 'tip', 'For deadlines counted in working days rather than calendar days, use the business days calculator instead.', 'this tool counts weekends: 5 days from a Friday is a Wednesday', N, async () => { const r = da({ start: '2027-06-04', days: 5 }); return [r.iso === '2027-06-09' && r.dayOfWeek === 'Wednesday', r.iso + ' ' + r.dayOfWeek]; });
    claim(DA, 'faq', '"one month after 31 January" almost always means the end of February in practice', '31 Jan + 1 month is the end of February', N, async () => { const r = da({ start: '2026-01-31', months: 1 }); return [r.iso === '2026-02-28' && /clamped to the 28th/.test(r.note), r.iso + ' ' + r.note]; });
    manual(DA, 'faq', 'Rolling into March surprises people and is rarely what a contract intends.', 'contract interpretation');
  }

  const DD = '/time/date-difference/';
  const dd = (start, end) => run(DD, { start, end });
  {
    claim(DD, 'lede', 'Calculate the exact time between two dates in years, months, days, and total units.', 'breakdown and totals', N, async () => {
      const r = dd('2025-11-17', '2026-08-14'); return [r.breakdown === '0 years, 8 months, 28 days' && r.totalDays === 270 && r.totalHours === 6480 && r.totalMinutes === 388800 && close(r.totalWeeks, 270 / 7), K.j(r)];
    });
    claim(DD, 'card', 'Calculate the exact time between two dates in years, months, days, and total units.', 'a leap-year span', N, async () => { const r = dd('2027-02-28', '2028-02-29'); return [r.breakdown === '1 years, 0 months, 1 days' && r.totalDays === 366, K.j(r)]; });
    claim(DD, 'why', 'Pick two dates. Get years, months, days, weekdays and totals, and the business days under a UK, India or US holiday calendar.', 'weekdays come back too; business days under each calendar, worked by hand', N, async () => {
      const r = dd('2027-06-01', '2027-07-01');
      const uk = run(DD, { start: '2026-12-01', end: '2027-01-01', calendar: 'uk-ew' }).businessDays, ind = run(DD, { start: '2026-10-01', end: '2026-11-01', calendar: 'in-central' }).businessDays;
      const us = run(DD, { start: '2026-11-01', end: '2026-12-01', calendar: 'us-federal' }).businessDays;
      return [r.weekdays === 22 && r.totalDays === 30 && uk === 21 && ind === 20 && us === 19, [r.weekdays, r.totalDays, uk, ind, us].join(' / ')];
    });
    claim(DD, 'what', '1 June to 1 July 2027 is one month, or 30 days; 1 July to 1 August is also one month, but 31 days.', 'June and July', N, async () => {
      const a = dd('2027-06-01', '2027-07-01'), b = dd('2027-07-01', '2027-08-01'); return [a.breakdown === '0 years, 1 months, 0 days' && a.totalDays === 30 && b.breakdown === a.breakdown && b.totalDays === 31, a.breakdown + ' ' + a.totalDays + ' / ' + b.totalDays];
    });
    claim(DD, 'works', 'Total days is the end date minus the start date, so the start day is counted and the end day is not.', 'totals on spans across clock changes', N, async () => every([['2027-03-27', '2027-03-29'], ['2027-10-30', '2027-11-01'], ['2000-01-01', '2026-10-04']], ([a, b]) => {
      const r = dd(a, b); const n = daysBetween(a, b); return [r.totalDays === n && close(r.totalWeeks, n / 7) && r.totalHours === n * 24 && r.totalMinutes === n * 1440, a + ' → ' + b + ': ' + r.totalDays];
    }));
    claim(DD, 'works', 'so adding the answer back with the date add calculator gives the end date', 'difference, then date add, on 400 pairs incl. month ends and 29 February', N, async () => {
      const pairs = [['2027-01-31', '2027-03-01'], ['2027-03-31', '2027-05-01'], ['2028-02-29', '2029-02-28'], ['2027-08-31', '2028-02-29']];
      for (let k = 0; k < 400; k++) { const a = randISO(1950, 2040); pairs.push([a, addDays(a, int(0, 4000))]); }
      return every(pairs, ([a, b]) => {
        const r = dd(a, b); const m = r.breakdown.match(/^(\d+) years, (\d+) months, (\d+) days$/);
        const x = da({ start: a, years: +m[1], months: +m[2], days: +m[3] }); return [x.iso === b, a + ' + ' + r.breakdown + ' = ' + x.iso + ', not ' + b];
      });
    });
    claim(DD, 'works', 'weeks = total days ÷ 7 hours = total days × 24 minutes = total days × 1,440', 'weeks unrounded, hours, minutes', N, async () => every([['2026-10-04', '2026-10-14'], ['2025-11-17', '2026-08-14']], ([a, b]) => {
      const r = dd(a, b); const n = daysBetween(a, b); return [r.totalWeeks === n / 7 && r.totalHours === n * 24 && r.totalMinutes === n * 1440, a + ' → ' + b + ': ' + r.totalWeeks + ' wk, ' + r.totalHours + ' h, ' + r.totalMinutes + ' min'];
    }));
    claim(DD, 'works', 'a start day missing from a shorter month becomes its last day', '31 Mar → 1 May', N, async () => { const r = dd('2027-03-31', '2027-05-01').breakdown; return [r === '0 years, 1 months, 1 days', r]; });
    claim(DD, 'works', 'weekdays = days from the start up to the end that fall Monday to Friday', 'start counted, end not', N, async () => {
      const a = dd('2026-10-02', '2026-10-03').weekdays, b = dd('2026-10-03', '2026-10-05').weekdays, c = dd('2026-10-05', '2026-10-12').weekdays; return [a === 1 && b === 0 && c === 5, [a, b, c].join(', ')];
    });
    claim(DD, 'works', 'the first date, counted', 'a span of one day from a Friday', N, async () => { const r = dd('2026-10-02', '2026-10-03'); return [r.totalDays === 1 && r.weekdays === 1, K.j(r)]; });
    claim(DD, 'works', 'the last date, not counted', 'the same date twice is 0', N, async () => { const r = dd('2026-10-05', '2026-10-05'); return [r.totalDays === 0 && r.weekdays === 0, K.j(r)]; });
    claim(DD, 'worked', 'If the contract counts 14 August as a working day too, add one.', '14 Aug 2026 is a weekday not yet counted', N, async () => {
      const a = dd('2025-11-17', '2026-08-14').weekdays, b = dd('2025-11-17', '2026-08-15').weekdays; return [b === a + 1, a + ' → ' + b];
    });
    claim(DD, 'mistake', 'A hotel stay from 1 to 5 July 2027 is 4 nights, which is what the tool gives', '1 → 5 July', N, async () => { const r = dd('2027-07-01', '2027-07-05').totalDays; return [r === 4, r]; });
    claim(DD, 'mistake', 'It counts complete months only, so 8 months and 28 days shows as 8, not 9.', 'total months', N, async () => { const r = dd('2025-11-17', '2026-08-14').totalMonths; return [r === 8, r]; });
    claim(DD, 'dfaq', 'Set Count the end date too to Yes', 'Total Days leaves one end out; Yes counts it', N, async () => { const a = dd('2026-10-04', '2026-10-06').totalDays, b = run(DD, { start: '2026-10-04', end: '2026-10-06', includeEnd: 'yes' }).totalDays; return [a === 2 && b === 3, a + ' / ' + b + ' (4, 5 and 6 October are 3 days)']; });
    claim(DD, 'dfaq', 'Yes, because it counts real calendar days.', '28 Feb → 1 Mar in a leap year and not', N, async () => { const a = dd('2028-02-28', '2028-03-01').totalDays, b = dd('2027-02-28', '2027-03-01').totalDays, c = dd('2100-02-28', '2100-03-01').totalDays; return [a === 2 && b === 1 && c === 1, [a, b, c].join(', ')]; });
    claim(DD, 'dfaq', 'Set the first of the month and the first of the next.', 'February 2027 has 20 weekdays', N, async () => { const r = dd('2027-02-01', '2027-03-01'); return [r.weekdays === 20 && r.totalDays === 28, r.weekdays + ' of ' + r.totalDays]; });
    claim(DD, 'formula', 'Calendar-aware difference accounting for varying month lengths and leap years', 'month ends and a leap day', N, async () => {
      const a = dd('2028-01-31', '2028-02-29').breakdown, b = dd('2027-01-31', '2027-02-28').breakdown, c = dd('2024-02-29', '2028-02-29').breakdown;
      return [a === '0 years, 0 months, 29 days' && b === '0 years, 0 months, 28 days' && c === '4 years, 0 months, 0 days', [a, b, c].join(' | ')];
    });
    claim(DD, 'tip', 'The years/months/days breakdown is calendar-aware — it accounts for months of different lengths and for leap years.', 'a leap year counts 366 days', N, async () => { const a = dd('2028-01-01', '2029-01-01'), b = dd('2027-01-01', '2028-01-01'); return [a.breakdown === '1 years, 0 months, 0 days' && a.totalDays === 366 && b.totalDays === 365, a.totalDays + ' / ' + b.totalDays]; });
    claim(DD, 'tip', 'The weekday count excludes Saturdays and Sundays but not public holidays, which vary by country.', 'Christmas week', N, async () => { const r = dd('2026-12-21', '2026-12-28').weekdays; return [r === 5, r + ' (25 December still counted)']; });
    claim(DD, 'faq', 'This tool walks the calendar rather than assuming an average month length', '1 Feb → 1 Mar is a month; 1 Mar → 30 Mar is not', N, async () => { const a = dd('2027-02-01', '2027-03-01').breakdown, b = dd('2027-03-01', '2027-03-30').breakdown; return [a === '0 years, 1 months, 0 days' && b === '0 years, 0 months, 29 days', a + ' / ' + b]; });
    manual(DD, 'use', 'Count how many days an invoice is overdue before a reminder or a late-payment claim.', 'a use, not a behaviour');
  }

  const WK = '/time/week-number/';
  const wk = (date) => run(WK, { date });
  const has53 = (y) => wk(y + '-12-28').week === 53;
  /* the Monday-to-Sunday week of a date, in the engine's date style */
  const wkFmt = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const wkRange = (iso) => { const mon = addDays(iso, -((dow(iso) + 6) % 7)); return wkFmt(mon) + ' to ' + wkFmt(addDays(mon, 6)); };
  {
    claim(WK, 'lede', 'Find the ISO-8601 week number for any date, and the Monday-to-Sunday dates of its week.', 'the week and its range', N, async () => { const r = wk('2026-10-04'); return [r.label === 'Week 40 of 2026' && /^28 Sept? 2026 to 4 Oct 2026$/.test(r.range), r.label + ', ' + r.range]; });
    claim(WK, 'card', 'Find the ISO-8601 week number for any date, and the Monday-to-Sunday dates of its week.', 'Monday to Sunday of the date\'s week', N, async () => every(['2026-10-04', '2027-01-01', '2024-12-30', '2028-02-29', '2027-03-28'], (d) => {
      const r = wk(d); return [r.range === wkRange(d), d + ': ' + r.range + ' (want ' + wkRange(d) + ')'];
    }));
    claim(WK, 'why', 'Pick a date. Get its ISO or US week, the week’s dates, the quarter and the whole year’s weeks.', 'week, range and quarter; the US week; 53 rows for ISO 2026', N, async () => {
      const r = wk('2027-03-31'), us = run(WK, { date: '2026-10-04', system: 'us' }), year = run(WK, { date: '2026-06-15', system: 'iso' });
      return [r.week === 13 && /29 Mar 2027 to 4 Apr 2027/.test(r.range) && r.quarter === 'Q1' && us.weekOf === 'Week 41 of 2026' && ((year._table || {}).rows || []).length === 53, [r.week, r.range, r.quarter, us.weekOf, ((year._table || {}).rows || []).length].join(' / ')];
    });
    claim(WK, 'what', 'labels each Monday-to-Sunday week of the year from 1 to 52, or to 53 in some years', 'weeks 1–53 across 2000–2040, a new week each Monday', N, async () => {
      let max = 0, min = 99; let bad = '';
      for (let d = '2000-01-03'; d < '2041-01-01'; d = addDays(d, 1)) { const r = wk(d); max = Math.max(max, r.week); min = Math.min(min, r.week); const p = wk(addDays(d, -1)).week; if ((dow(d) === 1) === (p === r.week) && !bad) bad = d; }
      return [max === 53 && min === 1 && !bad, 'weeks ' + min + '–' + max + (bad ? '; week did not turn on Monday at ' + bad : '')];
    });
    claim(WK, 'what', 'so an ISO year can begin a few days before 1 January or end a few days after 31 December', '30 Dec 2024 and 1 Jan 2027', N, async () => { const a = wk('2024-12-30'), b = wk('2027-01-01'); return [a.isoYear === 2025 && b.isoYear === 2026, a.label + ' / ' + b.label]; });
    claim(WK, 'works', 'Every week belongs to the year that contains its Thursday.', 'ISO year = year of that week\'s Thursday, 2020–2032', N, async () => {
      for (let d = '2020-01-01'; d < '2033-01-01'; d = addDays(d, 1)) { const thu = addDays(d, 3 - (dow(d) + 6) % 7); const r = wk(d); if (r.isoYear !== +thu.slice(0, 4)) return [false, d + ': ISO year ' + r.isoYear + ', Thursday ' + thu]; }
      return [true, '13 years of days'];
    });
    claim(WK, 'works', 'week = 1 + (that Thursday − Thursday of week 1) ÷ 7', 'the week of each Thursday counted from the first', N, async () => every([2026, 2027, 2032], (y) => {
      let thu = y + '-01-01'; while (dow(thu) !== 4) thu = addDays(thu, 1);
      for (let k = 0; k < 53; k++) { const t = addDays(thu, 7 * k); if (+t.slice(0, 4) !== y) break; const r = wk(t); if (r.week !== k + 1 || r.isoYear !== y) return [false, t + ' → ' + r.label]; }
      return [true, y];
    }));
    claim(WK, 'works', 'the week containing 4 January, which is always the week with the year’s first Thursday', '4 January is week 1, 1900–2100', N, async () => every([...Array(201)].map((_, i) => 1900 + i), (y) => { const r = wk(y + '-01-04'); return [r.week === 1 && r.isoYear === y, y + ': ' + r.label]; }));
    claim(WK, 'formula', 'ISO-8601: week 1 contains the first Thursday of the year', 'the first Thursday is in week 1, 1900–2100', N, async () => every([...Array(201)].map((_, i) => 1900 + i), (y) => {
      let t = y + '-01-01'; while (dow(t) !== 4) t = addDays(t, 1); const r = wk(t); return [r.week === 1 && r.isoYear === y, t + ': ' + r.label];
    }));
    claim(WK, 'worked', 'week 1 of 2027 starts on Monday 4 January', '3 and 4 January 2027', N, async () => { const a = wk('2027-01-03'), b = wk('2027-01-04'); return [a.label === 'Week 53 of 2026' && b.label === 'Week 1 of 2027', a.label + ' / ' + b.label]; });
    claim(WK, 'mistake', 'Sales from 1 to 3 January 2027 belong to week 53 of 2026', '1–3 January 2027', N, async () => every(['2027-01-01', '2027-01-02', '2027-01-03'], (d) => { const r = wk(d); return [r.label === 'Week 53 of 2026', d + ': ' + r.label]; }));
    claim(WK, 'mistake', 'Assuming every year has 52 weeks. 2026 has 53', '28 Dec 2026', N, async () => [has53(2026) && !has53(2025), wk('2026-12-28').label]);
    claim(WK, 'dfaq', 'Those that start on a Thursday, plus leap years that start on a Wednesday.', 'the rule against the tool, 1900–2200', N, async () => every([...Array(301)].map((_, i) => 1900 + i), (y) => {
      const j = dow(y + '-01-01'), leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; const rule = j === 4 || (leap && j === 3); return [rule === has53(y), y + ': rule ' + rule + ', tool ' + has53(y)];
    }));
    claim(WK, 'dfaq', '2026 is one; the next is 2032, whose last day falls in Week 53 of 2032.', '2027–2031 have 52', N, async () => { const r = [2026, 2027, 2028, 2029, 2030, 2031, 2032].map(has53); return [r.join() === 'true,false,false,false,false,false,true' && wk('2032-12-31').label === 'Week 53 of 2032', r.join()]; });
    claim(WK, 'dfaq', 'Yes. Monday 30 December 2024 shares its week with Thursday 2 January 2025, so it is Week 1 of 2025.', 'a December date in week 1', N, async () => { const a = wk('2024-12-30'), b = wk('2025-01-02'); return [a.label === 'Week 1 of 2025' && b.label === a.label && a.range === b.range, a.label + ' / ' + b.label]; });
    claim(WK, 'dfaq', 'No, Quarter follows the calendar month of the date.', 'quarters on either side of a week', N, async () => {
      const a = wk('2027-03-31'), b = wk('2027-04-01'), c = wk('2027-01-01'); return [a.quarter === 'Q1' && b.quarter === 'Q2' && a.week === 13 && b.week === 13 && c.quarter === 'Q1' && c.isoYear === 2026, [a.quarter, b.quarter, c.quarter + ' in ' + c.label].join(', ')];
    });
    claim(WK, 'tip', 'ISO-8601 weeks start on Monday, and week 1 is the one containing the first Thursday of January.', 'Sunday and Monday fall in different weeks', N, async () => { const a = wk('2026-10-04'), b = wk('2026-10-05'); return [a.week === 40 && b.week === 41, a.week + ' / ' + b.week]; });
    claim(WK, 'tip', 'Early January can therefore fall in week 52 or 53 of the previous ISO year — which is why the ISO year is shown separately.', '1 Jan 2028 and 1 Jan 2027', N, async () => {
      const a = wk('2028-01-01'), b = wk('2027-01-01'); return [a.week === 52 && a.isoYear === 2027 && b.week === 53 && b.isoYear === 2026 && output(WK, 'isoYear').label === 'ISO year', a.label + ' / ' + b.label];
    });
    claim(WK, 'faq', 'If 1 January falls on a Friday, Saturday or Sunday, it belongs to the last week of the previous ISO year under ISO-8601.', '1 January, 1900–2100', N, async () => every([...Array(201)].map((_, i) => 1900 + i), (y) => {
      const j = dow(y + '-01-01'), r = wk(y + '-01-01'); const prev = j === 5 || j === 6 || j === 0;
      return [prev ? (r.isoYear === y - 1 && r.week === (has53(y - 1) ? 53 : 52)) : (r.isoYear === y && r.week === 1), y + ': ' + r.label];
    }));
    claim(WK, 'faq', 'it keeps every week exactly seven days long', 'every range spans Monday to Sunday', N, async () => every([...Array(60)].map(() => randISO(1990, 2060)), (d) => {
      const r = wk(d); return [r.range === wkRange(d), d + ': ' + r.range + ' (want ' + wkRange(d) + ')'];
    }));
    claim(WK, 'what', 'It is day 365 of the year, with 0 days left, in Q4.', 'day of year and days left in a leap year too', N, async () => { const a = wk('2026-12-31'), b = wk('2028-12-31'), c = wk('2028-03-01'); return [a.dayOfYear === 365 && a.daysLeft === 0 && b.dayOfYear === 366 && b.daysLeft === 0 && c.dayOfYear === 61, [a.dayOfYear, b.dayOfYear, c.dayOfYear].join(', ')]; });
    claim(WK, 'use', 'Teams that plan in weeks can check exactly which dates a week covers, from any day in it.', 'every day of a week gives the same range', N, async () => {
      const r = [0, 1, 2, 3, 4, 5, 6].map((k) => wk(addDays('2027-03-15', k)).range); return [new Set(r).size === 1 && wk('2027-03-14').range !== r[0], r[0]];
    });
    manual(WK, 'mistake', 'In Excel it starts weeks on Sunday by default; ISOWEEKNUM, or WEEKNUM with return type 21, gives the ISO number.', 'about other software');
  }

  /* ================================================================ */
  /* Wave 4: holiday calendars, weekends, subtract, times, chains,    */
  /* zodiacs, several people, week systems — each against a reference */
  /* that does not come from the engine                                */
  /* ================================================================ */
  const B = 'browser';
  const FIX = path.join(K.ROOT, 'build', 'tests', 'fixtures');
  const fixture = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));
  const DAYNAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  /* the holidays a calendar takes off in one year, as the engine's own table lists them */
  const takenOff = (cal, y, weekend) => {
    const r = bd({ start: y + '-01-01', end: (y + 1) + '-01-01', calendar: cal, weekend: weekend || 'sat-sun' });
    return { dates: ((r._table || {}).rows || []).map((row) => row[0]), r };
  };
  const sameList = (a, b) => K.j(a.slice().sort()) === K.j(b.slice().sort());

  {
    const Q = 'Each calendar holds only the years its official source has published, copied date by date';
    /* UK: the saved GOV.UK feed, a fetch independent of engine/holidays.js */
    for (const [cal, div] of [['uk-ew', 'england-and-wales'], ['uk-sco', 'scotland'], ['uk-ni', 'northern-ireland']]) {
      claim(BD, 'ui', Q, cal + ': every year matches the GOV.UK feed saved 2026-10-06', N, async () => {
        const feed = fixture('gov-uk-bank-holidays-2026-10-06.json')[div].events.map((e) => e.date);
        const years = [...new Set(feed.map((d) => +d.slice(0, 4)))];
        for (const y of years) {
          const want = feed.filter((d) => +d.slice(0, 4) === y && dow(d) !== 0 && dow(d) !== 6);
          const got = takenOff(cal, y).dates;
          if (!sameList(got, want)) return [false, cal + ' ' + y + ': got ' + got.join(',') + ' want ' + want.join(',')];
        }
        return [years[0] === 2019 && years[years.length - 1] === 2028, years.length + ' years, ' + feed.length + ' dates'];
      });
    }
    /* US: the statutory rules, worked here on Date.UTC (the engine holds dates, not rules) */
    const usRule = (y) => {
      const D = (m, d) => new Date(Date.UTC(y, m - 1, d));
      const nth = (m, wd, n) => { const d = D(m, 1); while (d.getUTCDay() !== wd) d.setUTCDate(d.getUTCDate() + 1); d.setUTCDate(d.getUTCDate() + 7 * (n - 1)); return d; };
      const last = (m, wd) => { const d = D(m + 1, 0); while (d.getUTCDay() !== wd) d.setUTCDate(d.getUTCDate() - 1); return d; };
      const obs = (d) => { const w = d.getUTCDay(); if (w === 6) d.setUTCDate(d.getUTCDate() - 1); if (w === 0) d.setUTCDate(d.getUTCDate() + 1); return d; };
      return [obs(D(1, 1)), nth(1, 1, 3), nth(2, 1, 3), last(5, 1)].concat(y >= 2021 ? [obs(D(6, 19))] : [],
        [obs(D(7, 4)), nth(9, 1, 1), nth(10, 1, 2), obs(D(11, 11)), nth(11, 4, 4), obs(D(12, 25))]).map((d) => d.toISOString().slice(0, 10));
    };
    claim(BD, 'ui', 'The observed dates: a holiday on a Saturday is taken on the Friday before, one on a Sunday on the Monday after.', 'US 2012–2030 against 5 U.S.C. 6103 worked here', N, async () => {
      let all = [];
      for (let y = 2012; y <= 2030; y++) all = all.concat(usRule(y));
      for (let y = 2011; y <= 2031; y++) {
        const want = all.filter((d) => +d.slice(0, 4) === y);
        const got = takenOff('us-federal', y).dates;
        if (!sameList(got, want)) return [false, y + ': got ' + got.join(',') + ' want ' + want.join(',')];
      }
      return [true, all.length + ' dates; 31 Dec 2027 for New Year 2028, 3 Jul 2026, 5 Jul 2027'];
    });
    claim(BD, 'ui', 'Inauguration Day, a holiday only around Washington DC, is not included.', '20 January 2025 counts as a working day', N, async () => { const r = bd({ start: '2025-01-21', end: '2025-01-22', calendar: 'us-federal' }), m = bd({ start: '2025-01-20', end: '2025-01-21', calendar: 'us-federal' }); return [r.businessDays === 1 && m.holidaysUsed === 1 && /King/.test(m._table.rows[0][2]), K.j(m._table.rows)]; });
    /* India: the DoPT lists, checked against the weekday each OM prints and the count it gives */
    claim(BD, 'ui', 'the 14 compulsory holidays plus the 3 DoPT chooses for Delhi', 'every year 2021–2027: 17 rows, 14 + 3, printed weekdays right, engine takes off the rest', N, async () => {
      const years = fixture('dopt-central-holidays.json').years;
      for (const y of Object.keys(years)) {
        const H = years[y].holidays;
        const comp = H.filter((h) => h.kind === 'compulsory').length, extra = H.filter((h) => h.kind === 'delhi-extra').length;
        if (H.length !== 17 || comp !== 14 || extra !== 3) return [false, y + ': ' + H.length + ' rows, ' + comp + ' + ' + extra];
        for (const h of H) {
          if (DAYNAME[dow(h.date)] !== h.weekday) return [false, y + ' ' + h.name + ' ' + h.date + ' is a ' + DAYNAME[dow(h.date)] + ', the OM says ' + h.weekday];
          if (h.printed && DAYNAME[dow(h.printed.date)] !== h.printed.weekday) return [false, y + ' printed ' + h.printed.date];
        }
        /* a Sunday weekend, so Saturday holidays are visible; Sunday ones are weekend anyway */
        const want = [...new Set(H.map((h) => h.date))].filter((d) => dow(d) !== 0);
        const got = takenOff('in-central', +y, 'sun').dates;
        if (!sameList(got, want)) return [false, y + ': got ' + got.join(',') + ' want ' + want.join(',')];
      }
      return [true, Object.keys(years).join(', ')];
    });
    claim(BD, 'ui', 'Later date changes are applied (Muharram 2021 moved to 20 August, Id-ul-Zuha 2026 to 28 May)', 'the moved dates count, the printed ones do not', N, async () => {
      const a = bd({ start: '2021-08-19', end: '2021-08-21', calendar: 'in-central' }), b = bd({ start: '2026-05-27', end: '2026-05-29', calendar: 'in-central' });
      return [a.businessDays === 1 && a._table.rows[0][0] === '2021-08-20' && b.businessDays === 1 && b._table.rows[0][0] === '2026-05-28', K.j([a._table.rows, b._table.rows])];
    });
    claim(BD, 'ui', 'A count that runs outside a calendar’s years says which years had no holidays taken off.', 'England and Wales into 2029', N, async () => {
      const r = bd({ start: '2028-12-01', end: '2029-02-01', calendar: 'uk-ew' }); return [/covers 2019 to 2028; 2029 had no holidays/.test(r.note) && r.holidaysUsed === 2, r.note];
    });
    claim(BD, 'faq', 'Only the years their official sources have published', 'each calendar stops at its last published year', N, async () => {
      const r = [['uk-ew', 2028], ['uk-sco', 2028], ['uk-ni', 2028], ['in-central', 2027], ['us-federal', 2030]].map(([c, y]) => [takenOff(c, y).dates.length > 0, takenOff(c, y + 1).dates.length === 0]);
      return [r.every((x) => x[0] && x[1]), K.j(r)];
    });
    claim(BD, 'tip', 'Set the weekend to Friday and Saturday for the working week used in much of the Gulf, or to Sunday only for a six-day week.', 'a Sunday-to-Sunday week under each weekend', N, async () => {
      const w = (k) => bd({ start: '2026-10-04', end: '2026-10-11', weekend: k });
      const a = w('sat-sun'), b = w('fri-sat'), c = w('sun');
      const f = bdAdd('2026-10-08', 1); const g = bd({ start: '2026-10-08', mode: 'add', add: 1, weekend: 'fri-sat' });
      return [a.businessDays === 5 && b.businessDays === 5 && b.weekendDays === 2 && c.businessDays === 6 && c.weekendDays === 1 && f.iso === '2026-10-09' && g.iso === '2026-10-11', [a.businessDays, b.businessDays, c.businessDays, f.iso, g.iso].join(', ')];
    });
    claim(BD, 'works', 'Subtract mode steps backwards the same way.', 'subtracting n walks back over weekends and holidays, 200 random cases', N, async () => every([...Array(200)].map(() => [randISO(2019, 2028), int(0, 30), pick(['none', 'uk-ew', 'uk-sco', 'uk-ni'])]), ([s, n, cal]) => {
      const feed = fixture('gov-uk-bank-holidays-2026-10-06.json');
      const hol = new Set(cal === 'none' ? [] : feed[{ 'uk-ew': 'england-and-wales', 'uk-sco': 'scotland', 'uk-ni': 'northern-ireland' }[cal]].events.map((e) => e.date));
      let d = s, c = 0; while (c < n) { d = addDays(d, -1); if (dow(d) === 0 || dow(d) === 6 || hol.has(d)) continue; c++; }
      const r = bd({ start: s, mode: 'sub', add: n, calendar: cal });
      return [r.iso === d && r.calendarDays === daysBetween(d, s), s + ' − ' + n + ' (' + cal + ') = ' + r.iso + ', want ' + d];
    }));
    claim(BD, 'worked', 'and pick the England and Wales calendar', 'May 2027 with the calendar and with the two dates typed', N, async () => {
      const a = bd({ start: '2027-05-01', end: '2027-06-01', calendar: 'uk-ew' }), b = bd({ start: '2027-05-01', end: '2027-06-01', holidays: '2027-05-03, 2027-05-31' });
      return [a.businessDays === 19 && b.businessDays === 19 && K.j(a._table.rows.map((x) => x[0])) === '["2027-05-03","2027-05-31"]', a.result + ' / ' + b.result];
    });
  }
  function pick(arr) { return arr[int(0, arr.length - 1)]; }

  /* ---------- date difference ---------- */
  {
    const ddx = (o) => run(DD, Object.assign({ start: '2026-10-04', end: '2026-10-04' }, o));
    claim(DD, 'tip', 'Set Count the end date too to Yes when both dates are part of the span', '1 to 5 July 2027 is 5 days, 3 of them weekdays; January in full is a month', N, async () => {
      const a = ddx({ start: '2027-07-01', end: '2027-07-05', includeEnd: 'yes' }), b = ddx({ start: '2027-01-01', end: '2027-01-31', includeEnd: 'yes' });
      return [a.totalDays === 5 && a.weekdays === 3 && b.breakdown === '0 years, 1 months, 0 days', a.totalDays + ' days, ' + a.weekdays + ' weekdays; ' + b.breakdown];
    });
    claim(DD, 'tip', 'the difference gains hours and minutes, and the totals become exact', 'a night shift and a flight, against Date.UTC arithmetic', N, async () => every([['2026-10-04', '22:00', '2026-10-06', '06:30'], ['2027-01-31', '09:15', '2027-03-01', '08:00'], ['2026-12-31', '23:59', '2027-01-01', '00:01']], ([a, ta, b, tb]) => {
      const ms = Date.parse(b + 'T' + tb + ':00Z') - Date.parse(a + 'T' + ta + ':00Z'); const min = ms / 60000;
      const r = ddx({ start: a, startTime: ta, end: b, endTime: tb });
      const hm = r.breakdown.match(/, (\d+) hours, (\d+) minutes$/);
      return [r.totalMinutes === min && close(r.totalHours, min / 60) && r.totalDays === Math.floor(min / 1440) && hm && +hm[1] * 60 + +hm[2] === min % 1440, a + ' ' + ta + ' → ' + b + ' ' + tb + ': ' + r.breakdown + ', ' + r.totalMinutes + ' min'];
    }));
    claim(DD, 'tip', 'Times are clock times in one place, so a clock change in between is not counted.', 'noon to noon across the spring change is 24 hours', N, async () => { const r = ddx({ start: '2027-03-27', startTime: '12:00', end: '2027-03-28', endTime: '12:00' }); return [r.totalHours === 24, r.totalHours]; });
    claim(DD, 'faq', '1 January 2000 to 4 October 2026 is 26 years and 276 of 365 days, 26.7562.', 'decimal years by anniversaries, 300 random pairs', N, async () => {
      const r0 = dd('2000-01-01', '2026-10-04').decimalYears; if (!close(r0, 26 + 276 / 365)) return [false, r0];
      return every([...Array(300)].map(() => [randISO(1950, 2030), randISO(2030, 2060)]), ([a, b]) => {
        let y = +b.slice(0, 4) - +a.slice(0, 4); const ann = (k) => { const t = new Date(Date.UTC(+a.slice(0, 4) + k, +a.slice(5, 7) - 1, 1)); t.setUTCDate(Math.min(+a.slice(8), new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate())); return t.toISOString().slice(0, 10); };
        while (ann(y) > b) y--;
        const want = y + daysBetween(ann(y), b) / daysBetween(ann(y), ann(y + 1));
        const got = dd(a, b).decimalYears; return [close(got, want, 1e-12), a + ' → ' + b + ': ' + got + ' vs ' + want];
      });
    });
    claim(DD, 'dfaq', 'Pick the England and Wales calendar: the same contract has 194 weekdays and 187 business days.', 'against the GOV.UK feed', N, async () => {
      const feed = new Set(fixture('gov-uk-bank-holidays-2026-10-06.json')['england-and-wales'].events.map((e) => e.date));
      let want = 0; for (let d = '2025-11-17'; d < '2026-08-14'; d = addDays(d, 1)) if (dow(d) !== 0 && dow(d) !== 6 && !feed.has(d)) want++;
      const r = ddx({ start: '2025-11-17', end: '2026-08-14', calendar: 'uk-ew' }); return [r.businessDays === want && want === 187 && r.weekdays === 194, r.businessDays + ' / ' + want];
    });
    claim(DD, 'works', 'the last date, not counted, unless Count the end date too is Yes', 'business days follow the same rule', N, async () => {
      const a = ddx({ start: '2026-10-05', end: '2026-10-09', calendar: 'uk-ew' }), b = ddx({ start: '2026-10-05', end: '2026-10-09', calendar: 'uk-ew', includeEnd: 'yes' });
      return [a.businessDays === 4 && b.businessDays === 5, a.businessDays + ' / ' + b.businessDays];
    });
    claim(DD, 'tip', 'write it in the period box, such as +3 months −1 day: the end date is then worked out from the start, a step at a time', 'the period box sets the end date, step by step', N, async () => every([['2026-10-05', '+3 months -1 day', '2027-01-04'], ['2027-01-31', '+1 month +1 month', '2027-03-28'], ['2027-01-31', '+2 months', '2027-03-31'], ['2027-03-31', '−1 month 2 days', '2027-02-26']], ([a, p, want]) => {
      const r = ddx({ start: a, end: '2000-01-01', shift: p }); return [r.totalDays === Math.abs(daysBetween(a, want)) &&/\d{4}$/.test(r.endUsed) && r.endUsed.indexOf(String(+want.slice(8))) >= 0, a + ' ' + p + ' → ' + r.endUsed + ' (' + r.totalDays + ' days)'];
    }));
  }

  /* ---------- date add: the steps box ---------- */
  {
    claim(DA, 'tip', 'The steps box applies each term in order, so “+1 month +1 month” from 31 January lands on 28 March, while 2 months in the Months box lands on 31 March.', 'chain vs one step', N, async () => {
      const a = da({ start: '2027-01-31', chain: '+1 month +1 month' }), b = da({ start: '2027-01-31', months: 2 });
      return [a.iso === '2027-03-28' && b.iso === '2027-03-31' && /28 Feb 2027/.test(a.steps), a.iso + ' (' + a.steps + ') / ' + b.iso];
    });
    claim(DA, 'tip', 'The steps box applies each term in order', 'random chains against UTC arithmetic', N, async () => {
      const step = (iso, u, n) => { let [y, m, d] = iso.split('-').map(Number); if (u === 'd') return addDays(iso, n); if (u === 'w') return addDays(iso, 7 * n); const t = (y * 12 + m - 1) + (u === 'y' ? 12 * n : n); y = Math.floor(t / 12); m = t % 12 + 1; const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(d, last)).padStart(2, '0'); };
      const words = { y: 'years', m: 'months', w: 'weeks', d: 'days' };
      return every([...Array(150)].map(() => { const terms = [...Array(int(1, 4))].map(() => [pick(['y', 'm', 'w', 'd']), int(0, 40) * pick([1, -1])]); return [randISO(1980, 2040), terms]; }), ([s, terms]) => {
        let want = s; for (const [u, n] of terms) want = step(want, u, n);
        const text = terms.map(([u, n]) => (n < 0 ? '−' : '+') + Math.abs(n) + ' ' + words[u]).join(' ');
        const r = da({ start: s, chain: text }); return [r.iso === want, s + ' ' + text + ' → ' + r.iso + ', want ' + want];
      });
    });
    claim(DA, 'tip', 'The steps box applies each term in order', 'a sign carries on to the next term; nonsense is reported', N, async () => {
      const a = da({ start: '2027-03-31', chain: '−1 month 2 days' }), b = da({ start: '2027-03-31', chain: '+1 fortnight' });
      return [a.iso === '2027-02-26' && /Not understood/.test(b.note) && b.iso === '2027-03-31', a.iso + '; ' + b.note];
    });
  }

  /* ---------- age: zodiacs, people, time of birth, preferences ---------- */
  {
    const ag = (o) => run(AGE, Object.assign({ on: '2026-10-04' }, o));
    const hko = fs.readFileSync(path.join(FIX, 'hko-chinese-new-year-1901-2100.txt'), 'utf8').split(/\r?\n/).filter((l) => /^\d{4}\//.test(l))
      .map((l) => { const [y, m, d] = l.split(/\s+/)[0].split('/').map(Number); return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10); });
    const ANIMAL = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
    claim(AGE, 'faq', 'Those in the Hong Kong Observatory’s Gregorian–Lunar calendar conversion tables, which cover 1901 to 2100.', 'the animal turns on each HKO New Year, 1901–2100, and not the day before', N, async () => {
      if (hko.length !== 200) return [false, hko.length + ' years in the fixture'];
      for (const ny of hko) {
        const y = +ny.slice(0, 4);
        const on = ag({ dob: ny, on: '2101-01-01' }).chineseZodiac, before = ag({ dob: addDays(ny, -1), on: '2101-01-01' }).chineseZodiac;
        const want = ANIMAL[(y - 4) % 12], prev = ANIMAL[(y - 5) % 12];
        if (on.indexOf(want) !== 0 || (y > 1901 && before.indexOf(prev) !== 0)) return [false, ny + ': ' + on + ' / day before ' + before];
      }
      return [/^Not available/.test(ag({ dob: '1900-12-31', on: '2101-01-01' }).chineseZodiac), '200 New Years; 1900 has none'];
    });
    claim(AGE, 'faq', 'The animal and its element change on that day', 'the HKO dates agree with an independent lunar calendar (ICU) except 3 years where the new moon is within minutes of midnight', N, async () => {
      const f = new Intl.DateTimeFormat('en-u-ca-chinese', { timeZone: 'UTC', month: 'numeric', day: 'numeric' });
      const off = [];
      for (const ny of hko) { const p = f.formatToParts(Date.parse(ny + 'T00:00:00Z')); if (!(p.find((x) => x.type === 'month').value === '1' && p.find((x) => x.type === 'day').value === '1')) off.push(ny); }
      /* 1954-02-03, 2027-02-06 and 2030-02-03: ICU puts the new moon on the other side of midnight;
         the tool keeps the published table (HKO), which the claim above checks */
      return [K.j(off) === K.j(['1954-02-03', '2027-02-06', '2030-02-03']), off.length + ' differ: ' + off.join(', ')];
    });
    claim(AGE, 'tip', 'someone born on 20 January 1990 is a Snake, not a Horse', 'before and after 27 January 1990', N, async () => {
      const a = ag({ dob: '1990-01-20' }).chineseZodiac, b = ag({ dob: '1990-01-27' }).chineseZodiac; return [a === 'Snake (Earth Snake)' && b === 'Horse (Metal Horse)', a + ' / ' + b];
    });
    claim(AGE, 'faq', 'Aquarius from 20 January, Pisces 19 February, Aries 21 March, Taurus 20 April, Gemini 21 May, Cancer 21 June, Leo 23 July, Virgo 23 August, Libra 23 September, Scorpio 23 October, Sagittarius 22 November and Capricorn 22 December', 'every day of a leap year', N, async () => {
      const starts = [[1, 20, 'Aquarius'], [2, 19, 'Pisces'], [3, 21, 'Aries'], [4, 20, 'Taurus'], [5, 21, 'Gemini'], [6, 21, 'Cancer'], [7, 23, 'Leo'], [8, 23, 'Virgo'], [9, 23, 'Libra'], [10, 23, 'Scorpio'], [11, 22, 'Sagittarius'], [12, 22, 'Capricorn']];
      for (let d = '2000-01-01'; d <= '2000-12-31'; d = addDays(d, 1)) {
        const md = +d.slice(5, 7) * 100 + +d.slice(8); let want = 'Capricorn'; starts.forEach(([m, dd, s]) => { if (md >= m * 100 + dd) want = s; });
        const got = ag({ dob: d }).starSign; if (got !== want) return [false, d + ': ' + got + ', want ' + want];
      }
      return [true, '366 days'];
    });
    claim(AGE, 'tip', 'Add more people as “Asha 1988-03-02; Tom 2015-11-30” to get a table of everyone’s ages, sorted by whose birthday comes next', 'the table, its order and its ages', N, async () => {
      const r = ag({ dob: '1990-06-15', others: 'Asha 1988-03-02; Tom 2015-11-30; Baby 2027-01-01; nonsense' });
      const rows = r._table.rows; const names = rows.map((x) => x[0]);
      const asha = age('1988-03-02', '2026-10-04'), tom = age('2015-11-30', '2026-10-04');
      const ok = K.j(names) === K.j(['Tom', 'Asha', 'Date of birth above', 'Baby']) && rows[0][4] === String(tom.daysToNext) && rows[1][4] === String(asha.daysToNext)
        && rows[1][2] === asha.years + ' y, ' + (asha.totalMonths % 12) + ' m, ' + asha.exact.match(/(\d+) days$/)[1] + ' d' && rows[3][2] === 'not yet born' && /nonsense/.test(r.note);
      return [ok, K.j(rows.map((x) => x.slice(0, 5)))];
    });
    claim(AGE, 'faq', 'With a time of birth, and its time zone', 'the moment of birth in three zones, against fixed offsets', N, async () => {
      const a = ag({ dob: '1990-06-15', birthTime: '14:30', birthZone: 'Europe/London' }), b = ag({ dob: '1990-01-15', birthTime: '14:30', birthZone: 'Europe/London' }), c = ag({ dob: '2000-03-01', birthTime: '06:45', birthZone: 'Asia/Kolkata' }), z = ag({ dob: '2000-03-01', birthTime: '06:45', birthZone: 'Mars/Base' });
      const okA = a._birth.ms === Date.UTC(1990, 5, 15, 13, 30) && /\(13:30 UTC\)/.test(a.bornAt), okB = b._birth.ms === Date.UTC(1990, 0, 15, 14, 30), okC = c._birth.ms === Date.UTC(2000, 2, 1, 1, 15);
      return [okA && okB && okC && /not a time zone/.test(z.note) && z._birth.ms === null, [a.bornAt, b.bornAt, c.bornAt].join(' | ')];
    });
    /* the reader's date preference: an engine run with a stand-in Prefs */
    claim(AGE, 'tip', 'Dates follow the date format you pick in Settings; until you pick one they are written out in full.', 'dates follow a chosen date preference, and the long form otherwise', N, async () => {
      const vm = require('vm');
      const runWith = (fmtPref) => {
        const window = { TOOLS: {}, Prefs: fmtPref ? { chosen: (k) => k === 'dateFormat', date: (d) => fmtPref === 'iso' ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() } : { chosen: () => false, date: () => 'WRONG' } };
        const ctx = vm.createContext({ window, console, Intl, Math, Date, Number, String, Array, Object, JSON, isFinite, isNaN, parseFloat, parseInt });
        vm.runInContext(fs.readFileSync(path.join(K.ROOT, 'engine', 'calc-age-calculator.js'), 'utf8'), ctx);
        return window.TOOLS['age-calculator'].compute({ dob: '1990-06-15', on: '2026-10-04', birthTime: '', birthZone: '', others: '' }).nextBirthday;
      };
      const a = runWith('iso'), b = runWith('dmy'), c = runWith(null);
      return [a === 'Tuesday, 2027-06-15' && b === 'Tuesday, 15/06/2027' && c === 'Tuesday, 15 June 2027', [a, b, c].join(' | ')];
    });
  }

  /* ---------- week number: other systems and the year table ---------- */
  {
    const wks = (date, system) => run(WK, { date, system });
    /* week numbers by walking the year day by day: a new week starts on each `first` weekday after 1 January */
    const walk = (y, first) => { const out = {}; let w = 1; for (let d = y + '-01-01'; d <= y + '-12-31'; d = addDays(d, 1)) { if (d !== y + '-01-01' && dow(d) === first) w++; out[d] = w; } return out; };
    claim(WK, 'tip', 'Choose US under Numbering to get that number, the same as a spreadsheet’s WEEKNUM with its default return type.', 'US, Monday-start and Saturday-start numbers for every day of 1990–2040', N, async () => {
      for (const [sys, first] of [['us', 0], ['mon', 1], ['sat', 6]]) for (let y = 1990; y <= 2040; y++) {
        const want = walk(y, first);
        for (const d of Object.keys(want)) if (dow(d) === first || d.endsWith('-01-01') || d.endsWith('-12-31')) { const r = wks(d, sys); if (r.week !== want[d] || r.weekOf !== 'Week ' + want[d] + ' of ' + y) return [false, sys + ' ' + d + ': ' + r.weekOf + ', want ' + want[d]]; }
      }
      const r = wks('2026-10-04', 'us'); return [r.weekOf === 'Week 41 of 2026' && r.isoCompare === 'Week 40 of 2026' && r.label === undefined, r.weekOf + ' / ISO ' + r.isoCompare];
    });
    claim(WK, 'faq', 'a leap year that starts on a Saturday has a one-day week 1 and a one-day week 54: 2028 is one', '2028 under US numbering', N, async () => {
      const a = wks('2028-01-01', 'us'), b = wks('2028-12-31', 'us'), c = wks('2027-12-31', 'us');
      return [a.week === 1 && /1 Jan 2028 to 1 Jan 2028/.test(a.range) && b.weekOf === 'Week 54 of 2028' && b.weeksInYear === 54 && c.weeksInYear === 53, [a.range, b.weekOf, c.weeksInYear].join(' | ')];
    });
    claim(WK, 'tip', 'Every week of the year is listed under the results, with a CSV download', 'ISO and US tables: every day of the year in exactly one row', N, async () => every([2026, 2027, 2028, 2032], (y) => {
      const iso = wks(y + '-06-15', 'iso')._table.rows, us = wks(y + '-06-15', 'us')._table.rows;
      const isoDays = iso.reduce((n, r) => n + +r[3], 0), usDays = us.reduce((n, r) => n + +r[3], 0), yearDays = daysBetween(y + '-01-01', (y + 1) + '-01-01');
      const firstMon = (() => { let t = y + '-01-04'; while (dow(t) !== 1) t = addDays(t, -1); return t; })();
      return [iso.length === (has53(y) ? 53 : 52) && isoDays === iso.length * 7 && usDays === yearDays && iso[0][1].indexOf('Mon ' + +firstMon.slice(8) + ' ') === 0 && us[0][1].indexOf(' 1 Jan ' + y) > 0, y + ': ' + iso.length + ' ISO rows, ' + us.length + ' US rows, ' + usDays + ' days'];
    }));
  }

  /* ---------- in the browser ---------- */
  const TIME_PAGES = [AGE, BD, DA, DD, WK];
  claim(BD, 'lede', 'Count working days between two dates, or add working days to a date, excluding weekends and holidays.', 'the five date pages load at 390 px and 1400 px with no errors and no sideways scroll', B, async () => {
    const out = [];
    for (const url of TIME_PAGES) for (const width of [390, 1400]) {
      const p = await K.open(url, { wait: '.tool-results .result' });
      try {
        await p.setViewport({ width, height: 900 });
        await K.sleep(300);
        const w = await p.evaluate(() => document.documentElement.scrollWidth);
        if (p.__errors.length || w > width) out.push(url + ' @' + width + ': ' + (p.__errors.join('; ') || 'scrollWidth ' + w));
      } finally { await p.close(); }
    }
    return [out.length === 0, out.join(' | ') || '10 loads clean'];
  });
  claim(BD, 'ui', 'Holiday calendars and where they come from', 'a calendar choice draws the holiday table, survives a reload, and the link carries it', B, async () => {
    const p = await K.open(BD + '#start=2026-12-21&end=2027-01-05&mode=between', { wait: '.tool-results .result' });
    try {
      await p.select('#in-calendar', 'uk-sco');
      await K.sleep(200);
      const rows = await p.$$eval('.tool-table tbody tr', (t) => t.map((r) => r.textContent));
      const share = await p.evaluate(() => (window.MVRTool.shareState() || {}).params || {});
      await p.goto(K.BASE + BD, { waitUntil: 'load' });
      await p.waitForSelector('.tool-results .result');
      const kept = await p.$eval('#in-calendar', (e) => e.value);
      const links = await p.$$eval('#holiday-calendars a', (a) => a.length);
      return [rows.length === 4 && share.calendar === 'uk-sco' && kept === 'uk-sco' && links >= 9 && !p.__errors.length, rows.length + ' holidays, link ' + share.calendar + ', kept ' + kept + ', ' + links + ' source links'];
    } finally { await p.close(); }
  });
  claim(AGE, 'faq', 'the live line under the results counts the seconds from that exact moment', 'the line ticks, is a timer, and counts from the time of birth', B, async () => {
    const p = await K.open(AGE + '#dob=2000-01-01&birthTime=12:00&birthZone=UTC', { wait: '.age-live' });
    try {
      const a = await p.$eval('.age-live', (e) => [e.textContent, e.getAttribute('role'), e.hidden]);
      await K.sleep(2100);
      const b = await p.$eval('.age-live', (e) => e.textContent);
      const sec = +(a[0].match(/— ([\d,]+) seconds/) || [, ''])[1].replace(/,/g, '');
      const want = Math.floor((Date.now() - Date.UTC(2000, 0, 1, 12)) / 1000);
      const type = await p.$eval('#in-birthTime', (e) => e.type);
      return [a[1] === 'timer' && !a[2] && a[0] !== b && Math.abs(sec - want) < 10 && type === 'time' && !p.__errors.length, a[0] + ' → ' + b];
    } finally { await p.close(); }
  });
  claim(WK, 'tip', 'Every week of the year is listed under the results, with a CSV download', 'the table and its CSV in the browser', B, async () => {
    const p = await K.open(WK + '#date=2027-03-31&system=us', { wait: '.tool-table tbody tr' });
    try {
      const n = await p.$$eval('.tool-table tbody tr', (t) => t.length);
      await K.clickText(p, '.tool-table button', /Download CSV/);
      await K.sleep(300);
      const d = await K.downloads(p);
      const csv = d[0] ? d[0].bytes.toString('utf8') : '';
      return [n === 53 && /^US week of 2027,Starts,Ends,Days\nWeek 1,Fri 1 Jan 2027,Sat 2 Jan 2027,2/.test(csv), n + ' rows; ' + csv.slice(0, 80)];
    } finally { await p.close(); }
  });

  if (fs.existsSync(path.join(__dirname, 'time-live.js'))) require('./time-live.js')({ claim, manual, kit: K });
};
