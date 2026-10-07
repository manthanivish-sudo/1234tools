(function(){
/* Date difference (/time/date-difference/).
   Whole calendar days in UTC, so the browser's time zone and clock changes
   cannot move either date. Times of day, when given, are clock times in one
   place, worked the same way: a clock change between the two is not
   counted. Holiday calendars for the business-day count come from
   engine/holidays.js, which the page loads first (window.HOLIDAYS). */

const MS = 86400000;
const dayOf = (s) => {
  const str = String(s == null ? '' : s).trim();
  if (str === 'TODAY') { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
  const m = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(str);
  if (m) { const t = new Date(0); t.setUTCFullYear(+m[1], +m[2] - 1, +m[3]); return t; }
  const x = new Date(str);
  return isNaN(x) ? x : new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
};
const utc = (y, mo, da) => { const t = new Date(0); t.setUTCFullYear(y, mo, da); return t; };
const isoOf = (d) => d.toISOString().slice(0, 10);
const shortDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/* "14:30" → minutes after midnight, '' → null, nonsense → NaN */
const minutesOf = (s) => {
  const t = String(s == null ? '' : s).trim();
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : NaN;
};

/* the date moved on by whole months, the day clamped to a short month's end */
function plusMonths(a, n) {
  const t = utc(a.getUTCFullYear(), a.getUTCMonth() + n, 1);
  t.setUTCDate(Math.min(a.getUTCDate(), utc(t.getUTCFullYear(), t.getUTCMonth() + 1, 0).getUTCDate()));
  return t;
}

/* "+3 months −1 day": the same steps as the date add tool's steps box */
const UNIT = [[/^(years?|yrs?|y)$/i, 'y'], [/^(months?|mos?|m)$/i, 'm'], [/^(weeks?|wks?|w)$/i, 'w'], [/^(days?|d)$/i, 'd']];
function applyChain(d0, text) {
  const re = /([+\-−–]?)\s*(\d{1,7})\s*([a-z]+)/gi;
  const src = String(text || '');
  let m, sign = 1, rest = src, d = d0, n = 0;
  while ((m = re.exec(src))) {
    const u = UNIT.find(([r]) => r.test(m[3]));
    if (!u) continue;
    if (m[1]) sign = m[1] === '+' ? 1 : -1;
    const k = sign * +m[2];
    if (u[1] === 'y' || u[1] === 'm') d = plusMonths(d, u[1] === 'y' ? 12 * k : k);
    else { d = new Date(d); d.setUTCDate(d.getUTCDate() + (u[1] === 'w' ? 7 * k : k)); }
    n++;
    rest = rest.replace(m[0], ' ');
  }
  return { date: d, terms: n, left: rest.replace(/[\s,;+\-−–]+/g, ' ').trim() };
}

const WEEKENDS = { 'sat-sun': [6, 0], 'fri-sat': [5, 6], 'sun': [0] };
const CALENDARS = [
  { value: 'none',       label: 'None' },
  { value: 'uk-ew',      label: 'UK: England and Wales bank holidays' },
  { value: 'uk-sco',     label: 'UK: Scotland bank holidays' },
  { value: 'uk-ni',      label: 'UK: Northern Ireland bank holidays' },
  { value: 'in-central', label: 'India: central government holidays (Delhi / New Delhi)' },
  { value: 'us-federal', label: 'US: federal holidays' }
];
const STORE = '1234tools.date-difference';
const KEEP = ['includeEnd', 'calendar', 'weekend'];

window.TOOLS = window.TOOLS || {};
window.TOOLS["date-difference"] = {
"title": "Date Difference Calculator",
"category": "time",
"icon": "📅",
"description": "Calculate the exact time between two dates in years, months, days, and total units.",
"keywords": ["date difference","days between dates","age calculator","date duration","business days between dates","decimal years"],
"formula": "Calendar-aware difference accounting for varying month lengths and leap years",
"inputs": [
  {"key":"start","label":"Start Date","type":"date","default":"2000-01-01"},
  {"key":"end","label":"End Date","type":"date","default":"TODAY"},
  {"key":"startTime","label":"Start time (optional)","type":"text","default":""},
  {"key":"endTime","label":"End time (optional)","type":"text","default":""},
  {"key":"includeEnd","label":"Count the end date too","type":"select","options":[{"value":"no","label":"No: up to the end date"},{"value":"yes","label":"Yes: include the end date (+1 day)"}],"default":"no"},
  {"key":"shift","label":"Or set the end by a period from the start (optional, e.g. +3 months −1 day)","type":"text","default":""},
  {"key":"calendar","label":"Holiday calendar for business days","type":"select","options":CALENDARS,"default":"none"},
  {"key":"weekend","label":"Weekend","type":"select","options":[{"value":"sat-sun","label":"Saturday and Sunday"},{"value":"fri-sat","label":"Friday and Saturday"},{"value":"sun","label":"Sunday only"}],"default":"sat-sun"}
],
"compute": ({ start, end, startTime, endTime, includeEnd, shift, calendar, weekend }) => {
      const s0 = dayOf(start);
      if (isNaN(s0)) return {};
      const notes = [];
      let e0 = dayOf(end), endUsed;
      if (String(shift || '').trim()) {
        const c = applyChain(s0, shift);
        if (c.terms && !isNaN(c.date)) { e0 = c.date; endUsed = shortDate(e0); }
        if (c.left || !c.terms) notes.push('Not understood in the period box: “' + String(c.left || shift).slice(0, 40) + '”. Write terms such as +3 months, −1 day, +2 weeks.');
      }
      if (isNaN(e0)) return {};

      /* times of day: both optional; one given alone counts from midnight */
      let t1 = minutesOf(startTime), t2 = minutesOf(endTime);
      if (Number.isNaN(t1) || Number.isNaN(t2)) { notes.push('Times are read as HH:MM, for example 09:30.'); t1 = Number.isNaN(t1) ? null : t1; t2 = Number.isNaN(t2) ? null : t2; }
      const timed = t1 !== null || t2 !== null;
      const inc = includeEnd === 'yes';
      if (inc && timed) notes.push('Count the end date too is for whole days, so it is ignored while a time is set.');

      /* order by instant, then split into whole days and the minutes left */
      let A = s0.getTime() + (t1 || 0) * 60000, B = e0.getTime() + (t2 || 0) * 60000;
      if (A > B) [A, B] = [B, A];
      if (inc && !timed) B += MS;
      const aDay = new Date(A - ((A % MS) + MS) % MS);
      const aMin = Math.round((A - aDay.getTime()) / 60000);
      let bDay = new Date(B - ((B % MS) + MS) % MS);
      let bMin = Math.round((B - bDay.getTime()) / 60000);
      /* an end clock time earlier than the start's borrows a day */
      if (bMin < aMin) { bDay = new Date(bDay.getTime() - MS); bMin += 1440; }
      const minsLeft = bMin - aMin;
      const a = aDay, b = bDay;

      /* Calendar difference: whole months first, then the days left over.
         When the end day is earlier in its month than the start day, one
         month is given back and the days are counted from the start date
         moved on by the whole months (clamped to the end of a short month,
         as the date add tool does) — so 31 January to 1 March is 1 month
         and 1 day, never "1 month, −2 days", and adding the answer to the
         start date always lands on the end date. */
      const ay = a.getUTCFullYear(), am = a.getUTCMonth(), ad = a.getUTCDate();
      let total = (b.getUTCFullYear() - ay) * 12 + (b.getUTCMonth() - am);
      if (b.getUTCDate() < ad) total--;
      const anchor = plusMonths(a, total);
      const years = Math.floor(total / 12), months = total % 12;
      const days = Math.round((b - anchor) / MS);
      const totalDays = Math.round((b - a) / MS);
      const exactMin = totalDays * 1440 + minsLeft;

      /* decimal years: whole years, plus the share of the year from the last
         anniversary to the next one that has passed (365 or 366 days) */
      const ann = plusMonths(a, 12 * years), ann2 = plusMonths(a, 12 * (years + 1));
      const decimalYears = years + ((b - ann) / MS + minsLeft / 1440) / ((ann2 - ann) / MS);

      /* weekdays and business days: each whole day from the start up to the
         end, start counted, end not (unless the end date is included) */
      const wkd = WEEKENDS[weekend] || WEEKENDS['sat-sun'];
      const H = typeof window !== 'undefined' ? window.HOLIDAYS : null;
      const cal = calendar && calendar !== 'none' ? calendar : '';
      const calOK = !!(cal && H && H.calendars && H.calendars[cal]);
      if (cal && !calOK) notes.push('The holiday calendars did not load, so no holidays were taken off.');
      /* Monday to Friday: five in every whole week, then the days left over */
      let weekdays = Math.floor(totalDays / 7) * 5;
      for (let i = 0, dw = a.getUTCDay(); i < totalDays % 7; i++, dw = (dw + 1) % 7) if (dw !== 0 && dw !== 6) weekdays++;
      const custom = calOK || (weekend && weekend !== 'sat-sun');
      let business = 0, hol = 0;
      if (custom && totalDays <= 40000) {
        const cur = new Date(a);
        for (let i = 0; i < totalDays; i++) {
          if (wkd.indexOf(cur.getUTCDay()) < 0) {
            if (calOK && H.name(cal, isoOf(cur))) hol++; else business++;
          }
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      } else if (custom) { business = undefined; hol = undefined; notes.push('Business days are counted for spans up to about a century.'); }
      if (calOK && totalDays) {
        const c = H.calendars[cal], gaps = [];
        const last = new Date(b.getTime() - MS);
        for (let y = a.getUTCFullYear(); y <= last.getUTCFullYear(); y++) if (y < c.from || y > c.to) gaps.push(y);
        if (gaps.length) notes.push('The ' + c.name + ' calendar covers ' + c.from + ' to ' + c.to + '; ' +
          (gaps.length > 3 ? gaps[0] + '–' + gaps[gaps.length - 1] : gaps.join(', ')) + ' had no holidays taken off.');
      }

      const res = {
        breakdown: `${years} years, ${months} months, ${days} days` + (timed ? `, ${Math.floor(minsLeft / 60)} hours, ${minsLeft % 60} minutes` : ''),
        totalDays,
        totalWeeks: (timed ? exactMin / 1440 : totalDays) / 7,
        totalMonths: years * 12 + months,
        totalHours: timed ? exactMin / 60 : totalDays * 24,
        totalMinutes: timed ? exactMin : totalDays * 1440,
        weekdays,
        decimalYears,
        note: notes.join(' ')
      };
      if (custom) { res.businessDays = business; res.holidaysOff = calOK ? hol : undefined; }
      if (endUsed) res.endUsed = endUsed;
      return res;
    },
"outputs": [{"key":"breakdown","label":"Difference","format":"text","primary":true},{"key":"totalDays","label":"Total Days","format":"number"},{"key":"weekdays","label":"Weekdays (Mon–Fri)","format":"number"},{"key":"totalWeeks","label":"Total Weeks","format":"number"},{"key":"totalMonths","label":"Total Months","format":"number"},{"key":"totalHours","label":"Total Hours","format":"number"},{"key":"totalMinutes","label":"Total Minutes","format":"number"},{"key":"decimalYears","label":"Decimal years","format":"number"},{"key":"businessDays","label":"Business days","format":"number"},{"key":"holidaysOff","label":"Holidays taken off","format":"number"},{"key":"endUsed","label":"End date used","format":"text"},{"key":"note","label":"","format":"text"}],
"tips": ["The years/months/days breakdown is calendar-aware — it accounts for months of different lengths and for leap years.","The weekday count excludes Saturdays and Sundays but not public holidays, which vary by country. Pick a holiday calendar, or another weekend, to get a business-day count as well.","Set Count the end date too to Yes when both dates are part of the span, as for a conference or a leave request: 1 to 5 July becomes 5 days rather than 4.","Add times to measure a shift or a flight: the difference gains hours and minutes, and the totals become exact. Times are clock times in one place, so a clock change in between is not counted.","To measure up to a date set by a period, write it in the period box, such as +3 months −1 day: the end date is then worked out from the start, a step at a time."],
"faq": [{"q":"Why do the months not simply equal days ÷ 30?","a":"Months vary from 28 to 31 days. This tool walks the calendar rather than assuming an average month length, so the breakdown matches how people actually count dates."},{"q":"How are decimal years worked out?","a":"Whole years first, then the days since the last anniversary divided by the length of that year, 365 or 366 days. 1 January 2000 to 4 October 2026 is 26 years and 276 of 365 days, 26.7562."}],

/* ---------- in the browser only ---------- */
"beforeMount": function () {
  try {
    const box = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!box || box.v !== 1 || !box.values) return;
    this.inputs.forEach((inp) => {
      if (KEEP.indexOf(inp.key) < 0) return;
      const v = box.values[inp.key];
      if ((inp.options || []).some((o) => o.value === v)) inp.default = v;
    });
  } catch (e) { /* storage blocked: the defaults stand */ }
},
"enhance": function (root) {
  const form = root.querySelector('.tool-form');
  if (!form) return;
  const field = (k) => form.querySelector('[name="' + k + '"]');
  ['startTime', 'endTime'].forEach((k) => { const f = field(k); if (f) { try { f.type = 'time'; } catch (e) { /* HH:MM text still works */ } } });
  const sh = field('shift');
  if (sh) sh.placeholder = 'e.g. +3 months −1 day';
  form.addEventListener('change', (e) => {
    if (!e.target || KEEP.indexOf(e.target.name) < 0) return;
    try {
      const values = {};
      KEEP.forEach((k) => { const f = field(k); if (f) values[k] = f.value; });
      localStorage.setItem(STORE, JSON.stringify({ v: 1, values }));
    } catch (err) { /* not remembered; still works */ }
  });
}
};
})();
