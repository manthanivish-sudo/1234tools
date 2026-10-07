(function(){
/* Week number (/time/week-number/): ISO 8601 by default, plus the three
   "week 1 contains 1 January" systems (US Sunday start, Monday start, and
   the Saturday start used in parts of the Middle East), and a table of
   every week of the year (render-core draws _table, with a CSV download). */

const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS = 86400000;
const utc = (y, mo, da) => { const t = new Date(0); t.setUTCFullYear(y, mo, da); return t; };
const addD = (d, n) => { const t = new Date(d); t.setUTCDate(t.getUTCDate() + n); return t; };
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/* The reader's date preference once chosen at /settings/, else "28 Sept 2026". */
function fmt(x) {
  const P = typeof window !== 'undefined' ? window.Prefs : null;
  if (P && typeof P.chosen === 'function' && typeof P.date === 'function' && P.chosen('dateFormat')) {
    const local = new Date(2000, 0, 1); local.setFullYear(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
    const s = P.date(local);
    if (s) return s;
  }
  return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
/* table cells: one fixed spelling, the same in every browser */
const cell = (x) => `${DAY3[x.getUTCDay()]} ${x.getUTCDate()} ${MON3[x.getUTCMonth()]} ${x.getUTCFullYear()}`;

/* ISO 8601: the Thursday of a date's week decides its year */
function isoWeek(t) {
  const dayNum = (t.getUTCDay() + 6) % 7;            // Monday = 0
  const thu = addD(t, 3 - dayNum);                   // Thursday of this week
  const isoYear = thu.getUTCFullYear();
  const firstThu = utc(isoYear, 0, 4);
  firstThu.setUTCDate(firstThu.getUTCDate() + 3 - (firstThu.getUTCDay() + 6) % 7);
  return { week: 1 + Math.round((thu - firstThu) / (7 * MS)), isoYear, monday: addD(t, -dayNum), firstMonday: addD(firstThu, -3) };
}
const isoWeeksIn = (y) => isoWeek(utc(y, 11, 28)).week;   // 28 December is always in the last week

/* "week 1 contains 1 January" systems: first = the weekday a week starts on */
const SYSTEMS = {
  us:  { first: 0, name: 'US', says: 'weeks start on Sunday and week 1 contains 1 January' },
  mon: { first: 1, name: 'Monday start', says: 'weeks start on Monday and week 1 contains 1 January' },
  sat: { first: 6, name: 'Saturday start', says: 'weeks start on Saturday and week 1 contains 1 January' }
};
function simpleWeek(t, first) {
  const y = t.getUTCFullYear();
  const jan1 = utc(y, 0, 1), dec31 = utc(y, 11, 31);
  const lead = (jan1.getUTCDay() - first + 7) % 7;  // days of week 1 that fall in the old year
  const doy = Math.round((t - jan1) / MS);           // 0-based
  const start = addD(t, -((t.getUTCDay() - first + 7) % 7));
  const end = addD(start, 6);
  return {
    week: Math.floor((doy + lead) / 7) + 1,
    weeks: Math.floor(((isLeap(y) ? 365 : 364) + lead) / 7) + 1,
    from: start < jan1 ? jan1 : start, to: end > dec31 ? dec31 : end,
    jan1, dec31, lead
  };
}

const STORE = '1234tools.week-number';

window.TOOLS = window.TOOLS || {};
window.TOOLS["week-number"] = {
"title": "Week Number Calculator",
"category": "time",
"description": "Find the ISO-8601 week number for any date, and the Monday-to-Sunday dates of its week.",
"keywords": ["week number","ISO week","what week is it","calendar week","week number calculator","US week number","weeks of the year"],
"formula": "ISO-8601: week 1 contains the first Thursday of the year",
"inputs": [
  {"key":"date","label":"Date","type":"date","default":"TODAY"},
  {"key":"system","label":"Numbering","type":"select","options":[
    {"value":"iso","label":"ISO 8601: Monday start, week 1 has the first Thursday"},
    {"value":"us","label":"US: Sunday start, week 1 contains 1 January"},
    {"value":"mon","label":"Monday start, week 1 contains 1 January"},
    {"value":"sat","label":"Saturday start, week 1 contains 1 January"}],"default":"iso"}
],
"compute": ({ date, system }) => {
      /* "YYYY-MM-DD" from the date input is read as that calendar date:
         new Date() takes it as UTC midnight, which west of Greenwich is the
         previous evening, so local getters gave the day before. */
      const str = String(date || '');
      const ymd = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(str);
      let t;
      if (str === 'TODAY') { const n = new Date(); t = utc(n.getFullYear(), n.getMonth(), n.getDate()); }
      else if (ymd) t = utc(+ymd[1], +ymd[2] - 1, +ymd[3]);
      else { const d = new Date(date); t = isNaN(d) ? d : utc(d.getFullYear(), d.getMonth(), d.getDate()); }
      if (isNaN(t)) return { note: 'Enter a valid date.' };

      const y = t.getUTCFullYear();
      const iso = isoWeek(t);
      const dayOfYear = Math.round((t - utc(y, 0, 1)) / MS) + 1;
      const common = {
        isoYear: iso.isoYear,
        dayOfYear,
        daysLeft: (isLeap(y) ? 366 : 365) - dayOfYear,
        quarter: 'Q' + (Math.floor(t.getUTCMonth() / 3) + 1),
        note: ''
      };

      const sys = SYSTEMS[system];
      if (!sys) {
        const n = isoWeeksIn(iso.isoYear);
        const rows = [];
        for (let k = 0; k < n; k++) { const mo = addD(iso.firstMonday, 7 * k); rows.push(['Week ' + (k + 1), cell(mo), cell(addD(mo, 6)), '7']); }
        return Object.assign({
          week: iso.week, isoYear: iso.isoYear,
          label: `Week ${iso.week} of ${iso.isoYear}`,
          range: `${fmt(iso.monday)} to ${fmt(addD(iso.monday, 6))}`,
          weeksInYear: n,
          _table: { head: ['ISO week of ' + iso.isoYear, 'Monday', 'Sunday', 'Days'], rows }
        }, common, { isoYear: iso.isoYear });
      }

      const s = simpleWeek(t, sys.first);
      const rows = [];
      for (let k = 0; k < s.weeks; k++) {
        const a = k === 0 ? s.jan1 : addD(s.jan1, 7 * k - s.lead);
        const b0 = addD(s.jan1, 7 * k - s.lead + 6), b = b0 > s.dec31 ? s.dec31 : b0;
        rows.push(['Week ' + (k + 1), cell(a), cell(b), String(Math.round((b - a) / MS) + 1)]);
      }
      const part = Math.round((s.to - s.from) / MS) + 1;
      return Object.assign({
        week: s.week,
        weekOf: `Week ${s.week} of ${y}`,
        range: `${fmt(s.from)} to ${fmt(s.to)}`,
        isoCompare: `Week ${iso.week} of ${iso.isoYear}`,
        weeksInYear: s.weeks,
        _table: { head: [sys.name + ' week of ' + y, 'Starts', 'Ends', 'Days'], rows }
      }, common, {
        note: `${sys.name} numbering: ${sys.says}.` + (part < 7 ? ` This week is cut at the turn of the year, so it has ${part} day${part === 1 ? '' : 's'} in ${y}.` : '')
      });
    },
"outputs": [{"key":"label","label":"ISO week","format":"text","primary":true},{"key":"weekOf","label":"Week","format":"text","primary":true},{"key":"range","label":"Week runs","format":"text"},{"key":"week","label":"Week number","format":"number"},{"key":"isoYear","label":"ISO year","format":"number"},{"key":"isoCompare","label":"ISO week, for comparison","format":"text"},{"key":"dayOfYear","label":"Day of year","format":"number"},{"key":"daysLeft","label":"Days left in the year","format":"number"},{"key":"quarter","label":"Quarter","format":"text"},{"key":"weeksInYear","label":"Weeks in the year","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["ISO-8601 weeks start on Monday, and week 1 is the one containing the first Thursday of January.","Early January can therefore fall in week 52 or 53 of the previous ISO year — which is why the ISO year is shown separately.","The US convention differs: weeks start on Sunday and week 1 contains 1 January. Choose US under Numbering to get that number, the same as a spreadsheet’s WEEKNUM with its default return type.","Every week of the year is listed under the results, with a CSV download for a planner or a spreadsheet."],
"faq": [{"q":"Why does 1 January sometimes show as week 52?","a":"If 1 January falls on a Friday, Saturday or Sunday, it belongs to the last week of the previous ISO year under ISO-8601. That is intentional — it keeps every week exactly seven days long."},{"q":"Why can the US system have 54 weeks?","a":"Because week 1 always contains 1 January, a leap year that starts on a Saturday has a one-day week 1 and a one-day week 54: 2028 is one, ending on Sunday 31 December in week 54."}],

/* ---------- in the browser only ---------- */
"beforeMount": function () {
  try {
    const box = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!box || box.v !== 1 || !box.values) return;
    const inp = this.inputs.find((i) => i.key === 'system');
    if (inp && inp.options.some((o) => o.value === box.values.system)) inp.default = box.values.system;
  } catch (e) { /* storage blocked: ISO stands */ }
},
"enhance": function (root) {
  const form = root.querySelector('.tool-form');
  if (!form) return;
  /* the table (people, holidays, weeks) belongs under the results, not below the example panels */
  const calcBox = root.querySelector('.calc'), tt = root.querySelector('.tool-table');
  if (calcBox && tt && calcBox.nextElementSibling !== tt) calcBox.parentNode.insertBefore(tt, calcBox.nextSibling);
  form.addEventListener('change', (e) => {
    if (!e.target || e.target.name !== 'system') return;
    try { localStorage.setItem(STORE, JSON.stringify({ v: 1, values: { system: e.target.value } })); } catch (err) { /* not remembered */ }
  });
}
};
})();
