(function(){
/* Business days calculator (/time/business-days/).
   Whole calendar days, worked in UTC so that a clock change can never shift
   a day: in local time, midnight after the spring change is 23:00 the
   previous day in UTC, so holidays after it were matched against the
   wrong date. Built-in holiday calendars come from engine/holidays.js,
   which the page loads first (window.HOLIDAYS); without it the tool still
   counts, with only the dates typed into the box. */

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MS = 86400000;
const dayOf = (s) => {
  const str = String(s == null ? '' : s).trim();
  if (str === 'TODAY') { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
  const m = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(str);
  if (m) { const t = new Date(0); t.setUTCFullYear(+m[1], +m[2] - 1, +m[3]); return t; }
  const x = new Date(str);
  return isNaN(x) ? x : new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
};
const isoOf = (d) => d.toISOString().slice(0, 10);

/* The reader's date preference once chosen at /settings/, else the long form. */
function showDate(d) {
  const P = typeof window !== 'undefined' ? window.Prefs : null;
  if (P && typeof P.chosen === 'function' && typeof P.date === 'function' && P.chosen('dateFormat')) {
    const local = new Date(2000, 0, 1); local.setFullYear(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const s = P.date(local);
    if (s) return DAYS[d.getUTCDay()] + ', ' + s;
  }
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/* Weekends, as days of the week (0 = Sunday). */
const WEEKENDS = {
  'sat-sun': { days: [6, 0], label: 'Saturday and Sunday' },
  'fri-sat': { days: [5, 6], label: 'Friday and Saturday' },
  'sun':     { days: [0],    label: 'Sunday only' }
};
const CALENDARS = [
  { value: 'none',       label: 'None: only the dates in the box below' },
  { value: 'uk-ew',      label: 'UK: England and Wales bank holidays' },
  { value: 'uk-sco',     label: 'UK: Scotland bank holidays' },
  { value: 'uk-ni',      label: 'UK: Northern Ireland bank holidays' },
  { value: 'in-central', label: 'India: central government holidays (Delhi / New Delhi)' },
  { value: 'us-federal', label: 'US: federal holidays' }
];

/* A choice that is worth keeping between visits: the calendar and the
   weekend, under one versioned key. Dates are not kept. */
const STORE = '1234tools.business-days';
const KEEP = ['calendar', 'weekend'];

window.TOOLS = window.TOOLS || {};
window.TOOLS["business-days"] = {
"title": "Business Days Calculator",
"category": "time",
"description": "Count working days between two dates, or add working days to a date, excluding weekends and holidays.",
"keywords": ["business days calculator","working days between dates","add business days","subtract business days","workdays calculator","bank holidays"],
"formula": "weekdays only, minus any dates you list as holidays",
"inputs": [
  {"key":"start","label":"Start date","type":"date","default":"TODAY"},
  {"key":"mode","label":"Mode","type":"select","options":[{"value":"between","label":"Count business days until an end date"},{"value":"add","label":"Add business days to the start date"},{"value":"sub","label":"Subtract business days from the start date"}],"default":"between"},
  {"key":"end","label":"End date (count mode)","type":"date","default":"TODAY"},
  {"key":"add","label":"Business days to add","type":"number","default":10,"min":0},
  {"key":"calendar","label":"Holiday calendar","type":"select","options":CALENDARS,"default":"none"},
  {"key":"weekend","label":"Weekend","type":"select","options":[{"value":"sat-sun","label":"Saturday and Sunday"},{"value":"fri-sat","label":"Friday and Saturday"},{"value":"sun","label":"Sunday only"}],"default":"sat-sun"},
  {"key":"holidays","label":"Holidays (YYYY-MM-DD, comma separated)","type":"text","default":""}
],
"compute": ({ start, mode, end, add, holidays, calendar, weekend }) => {
      const d0 = dayOf(start);
      if (isNaN(d0)) return { note: 'Enter a valid start date.' };
      const wk = WEEKENDS[weekend] || WEEKENDS['sat-sun'];
      const isWeekend = (d) => wk.days.indexOf(d.getUTCDay()) >= 0;

      /* Holidays are matched by calendar day; a typed 2026-4-3 counts as 2026-04-03. */
      const typed = new Set(String(holidays || '').split(/[\s,;]+/).filter(Boolean).map((h) => {
        const t = dayOf(h);
        return isNaN(t) ? h : isoOf(t);
      }));
      const H = typeof window !== 'undefined' ? window.HOLIDAYS : null;
      const cal = calendar && calendar !== 'none' ? calendar : '';
      const calOK = !!(cal && H && H.calendars && H.calendars[cal]);
      const holidayName = (iso) => {
        const n = calOK ? H.name(cal, iso) : '';
        if (n) return n;
        return typed.has(iso) ? 'Your list' : '';
      };
      const notes = [];
      if (cal && !calOK) notes.push('The holiday calendars did not load, so only the dates in the box were taken off.');
      /* years the calendar has no list for are counted without its holidays, and said so */
      const coverage = (a, b) => {
        if (!calOK) return;
        const c = H.calendars[cal], gaps = [];
        for (let y = a.getUTCFullYear(); y <= b.getUTCFullYear(); y++) if (y < c.from || y > c.to) gaps.push(y);
        if (gaps.length) notes.push('The ' + c.name + ' calendar covers ' + c.from + ' to ' + c.to + '; ' +
          (gaps.length > 3 ? gaps[0] + '–' + gaps[gaps.length - 1] : gaps.join(', ')) + ' had no holidays taken off. Add them in the box if you need them.');
      };
      const used = [];                       // [date, holiday] actually skipped
      const take = (d, name) => used.push([d, name]);
      const table = () => used.length ? {
        head: ['Date', 'Day', 'Holiday'],
        rows: used.slice().sort((x, y) => x[0] - y[0]).map(([d, n]) => [isoOf(d), DAYS[d.getUTCDay()], n])
      } : undefined;

      if (mode === 'add' || mode === 'sub') {
        const n = Math.max(0, Math.min(10000, Math.round(Number(add) || 0)));
        const step = mode === 'sub' ? -1 : 1;
        const cur = new Date(d0);
        /* skipped: holidays stepped over on working weekdays, which is what
           "Holidays excluded" reports (not every date typed in the box) */
        let counted = 0, guard = 0, skipped = 0;
        while (counted < n && guard < 100000) {
          cur.setUTCDate(cur.getUTCDate() + step);
          guard++;
          if (isWeekend(cur)) continue;
          const h = holidayName(isoOf(cur));
          if (h) { skipped++; take(new Date(cur), h); } else counted++;
        }
        const [lo, hi] = step > 0 ? [d0, cur] : [cur, d0];
        coverage(lo, hi);
        return {
          result: showDate(cur),
          iso: isoOf(cur),
          businessDays: n,
          calendarDays: Math.round((hi - lo) / MS),
          holidaysUsed: skipped,
          note: notes.join(' '),
          _table: table()
        };
      }

      const d1 = dayOf(end);
      if (isNaN(d1)) return { note: 'Enter a valid end date.' };
      const [a, b] = d0 <= d1 ? [d0, d1] : [d1, d0];
      const total = Math.round((b - a) / MS);
      if (total > 40000) return { note: 'That range is over a century — narrow it down.' };

      let work = 0, weekendDays = 0, holidayHits = 0;
      const cur = new Date(a);
      for (let i = 0; i < total; i++) {
        if (isWeekend(cur)) weekendDays++;
        else {
          const h = holidayName(isoOf(cur));
          if (h) { holidayHits++; take(new Date(cur), h); } else work++;
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      if (total) coverage(a, new Date(b.getTime() - MS));
      return {
        result: `${work} business day${work === 1 ? '' : 's'}`,
        businessDays: work,
        calendarDays: total,
        weekendDays,
        holidaysUsed: holidayHits,
        weeks: total / 7,
        note: notes.join(' '),
        _table: table()
      };
    },
"outputs": [{"key":"result","label":"Result","format":"text","primary":true},{"key":"iso","label":"Resulting date","format":"text"},{"key":"businessDays","label":"Business days","format":"number"},{"key":"calendarDays","label":"Calendar days","format":"number"},{"key":"weekendDays","label":"Weekend days","format":"number"},{"key":"holidaysUsed","label":"Holidays excluded","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Pick a built-in calendar for the UK nations, India’s central government or the US federal list, then type any extra dates (a regional or company holiday) into the box: both are taken off.","Counting is exclusive of the end date, matching how notice periods and payment terms are usually written.","When adding or subtracting business days, the start date itself is not counted — day one is the next working day in that direction.","Set the weekend to Friday and Saturday for the working week used in much of the Gulf, or to Sunday only for a six-day week."],
"faq": [{"q":"Should the start date count?","a":"Conventions differ, which is exactly why disputes happen. When adding, this tool leaves the start date out: day one is the next working day. When counting between two dates it counts the start date but not the end date, which gives the same total as leaving the start out and counting the end whenever both are working days. Contracts saying \"within 10 business days of receipt\" usually mean the adding reading, but check the wording rather than assuming."},{"q":"Which years do the holiday calendars cover?","a":"Only the years their official sources have published: the table under the calculator gives the range for each, and a count that runs outside it says which years had no holidays taken off."}],

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
  /* the table (people, holidays, weeks) belongs under the results, not below the example panels */
  const calcBox = root.querySelector('.calc'), tt = root.querySelector('.tool-table');
  if (calcBox && tt && calcBox.nextElementSibling !== tt) calcBox.parentNode.insertBefore(tt, calcBox.nextSibling);
  const field = (k) => form.querySelector('[name="' + k + '"]');
  /* the number box names the direction the mode has chosen */
  const label = form.querySelector('label[for="in-add"]');
  const mode = field('mode');
  const sync = () => {
    if (label && mode) label.textContent = mode.value === 'sub' ? 'Business days to subtract' : 'Business days to add';
    const endF = field('end'), addF = field('add');
    if (endF && mode) endF.closest('.field').classList.toggle('is-idle', mode.value !== 'between');
    if (addF && mode) addF.closest('.field').classList.toggle('is-idle', mode.value === 'between');
  };
  sync();
  form.addEventListener('change', (e) => {
    sync();
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
