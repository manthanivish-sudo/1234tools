(function(){
/* Age calculator (/time/age-calculator/).
   Whole calendar days are worked in UTC so the browser's time zone and clock
   changes can never move a date. The page calls spec.enhance(root) after
   MVRTool.mount for what render-core cannot draw: the live seconds line,
   a time input for the time of birth and a time-zone list. */

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MS = 86400000;
const utc = (y, mo, da) => { const t = new Date(0); t.setUTCFullYear(y, mo, da); return t; };
/* A YYYY-MM-DD field as that calendar day; "TODAY" as the local date now. */
const dayOf = (s) => {
  const str = String(s == null ? '' : s).trim();
  if (str === 'TODAY') { const n = new Date(); return utc(n.getFullYear(), n.getMonth(), n.getDate()); }
  const m = /^(-?\d{1,6})-(\d{1,2})-(\d{1,2})$/.exec(str);
  if (m) {
    const t = utc(+m[1], +m[2] - 1, +m[3]);
    /* 2026-02-30 is not a date: refuse it rather than roll into March */
    return t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3] ? t : new Date(NaN);
  }
  const x = new Date(str);
  return isNaN(x) ? x : utc(x.getFullYear(), x.getMonth(), x.getDate());
};

/* Dates follow the reader's date preference (assets/prefs.js) once they
   have chosen one at /settings/; until then, and wherever window.Prefs is
   absent (an old cached page, the Node checks), the long form. */
function showDate(d, weekday) {
  const P = typeof window !== 'undefined' ? window.Prefs : null;
  if (P && typeof P.chosen === 'function' && typeof P.date === 'function' && P.chosen('dateFormat')) {
    const local = new Date(2000, 0, 1); local.setFullYear(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const s = P.date(local);
    if (s) return (weekday ? DAYS[d.getUTCDay()] + ', ' : '') + s;
  }
  return d.toLocaleDateString('en-GB', weekday
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/* ---------- star sign ----------
   Tropical (Western) signs on the fixed dates most horoscopes print. The
   sun's real entry into a sign drifts by a day from year to year, so a
   birthday on a boundary date can belong to either sign. */
const SIGNS = [ // [month (1-12), first day, sign]
  [1, 20, 'Aquarius'], [2, 19, 'Pisces'], [3, 21, 'Aries'], [4, 20, 'Taurus'],
  [5, 21, 'Gemini'], [6, 21, 'Cancer'], [7, 23, 'Leo'], [8, 23, 'Virgo'],
  [9, 23, 'Libra'], [10, 23, 'Scorpio'], [11, 22, 'Sagittarius'], [12, 22, 'Capricorn']
];
function starSign(d) {
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  let sign = 'Capricorn';                       // 1–19 January
  for (const [m, day, s] of SIGNS) if (md >= m * 100 + day) sign = s;
  return sign;
}

/* ---------- Chinese zodiac ----------
   The animal changes at Chinese New Year (the first day of the first lunar
   month), not on 1 January, so a birth in January or early February can
   belong to the previous year's animal. New Year dates for 1901–2100 from
   the Hong Kong Observatory's Gregorian–Lunar Calendar Conversion Tables,
   https://www.hko.gov.hk/en/gts/time/conversion1_text.htm (one file per
   year, e.g. .../calendar/text/files/T1990e.txt: "1990/01/27  1st Lunar
   month"), fetched 2026-10-06. MMDD per year, 1901 first. The tables are
   in Hong Kong time; the date of birth is taken as written. */
const CNY_FROM = 1901, CNY_TO = 2100;
const CNY = (
    '0219 0208 0129 0216 0204 0125 0213 0202 0122 0210 ' +  // 1901–1910
    '0130 0218 0206 0126 0214 0203 0123 0211 0201 0220 ' +  // 1911–1920
    '0208 0128 0216 0205 0124 0213 0202 0123 0210 0130 ' +  // 1921–1930
    '0217 0206 0126 0214 0204 0124 0211 0131 0219 0208 ' +  // 1931–1940
    '0127 0215 0205 0125 0213 0202 0122 0210 0129 0217 ' +  // 1941–1950
    '0206 0127 0214 0203 0124 0212 0131 0218 0208 0128 ' +  // 1951–1960
    '0215 0205 0125 0213 0202 0121 0209 0130 0217 0206 ' +  // 1961–1970
    '0127 0215 0203 0123 0211 0131 0218 0207 0128 0216 ' +  // 1971–1980
    '0205 0125 0213 0202 0220 0209 0129 0217 0206 0127 ' +  // 1981–1990
    '0215 0204 0123 0210 0131 0219 0207 0128 0216 0205 ' +  // 1991–2000
    '0124 0212 0201 0122 0209 0129 0218 0207 0126 0214 ' +  // 2001–2010
    '0203 0123 0210 0131 0219 0208 0128 0216 0205 0125 ' +  // 2011–2020
    '0212 0201 0122 0210 0129 0217 0206 0126 0213 0203 ' +  // 2021–2030
    '0123 0211 0131 0219 0208 0128 0215 0204 0124 0212 ' +  // 2031–2040
    '0201 0122 0210 0130 0217 0206 0126 0214 0202 0123 ' +  // 2041–2050
    '0211 0201 0219 0208 0128 0215 0204 0124 0212 0202 ' +  // 2051–2060
    '0121 0209 0129 0217 0205 0126 0214 0203 0123 0211 ' +  // 2061–2070
    '0131 0219 0207 0127 0215 0205 0124 0212 0202 0122 ' +  // 2071–2080
    '0209 0129 0217 0206 0126 0214 0203 0124 0210 0130 ' +  // 2081–2090
    '0218 0207 0127 0215 0205 0125 0212 0201 0121 0209'     // 2091–2100
  ).match(/\d{4}/g);
const ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
const ELEMENTS = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water'];
const newYearOf = (y) => {
  if (y < CNY_FROM || y > CNY_TO) return null;
  const s = CNY[y - CNY_FROM];
  return utc(y, +s.slice(0, 2) - 1, +s.slice(2));
};
/* { animal, element, year, from } or null outside 1901–2100 */
function chinese(d) {
  const y = d.getUTCFullYear();
  const ny = newYearOf(y);
  if (!ny) return null;
  const ly = d < ny ? y - 1 : y;                // the lunar year the date falls in
  const from = ly === y ? ny : newYearOf(ly);
  const mod = (n, k) => ((n % k) + k) % k;
  return { animal: ANIMALS[mod(ly - 4, 12)], element: ELEMENTS[mod(ly - 4, 10)], year: ly, from };
}

/* ---------- time of birth ---------- */
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const deviceZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } };
const zoneOK = (z) => { try { new Intl.DateTimeFormat('en-GB', { timeZone: z }); return true; } catch (e) { return false; } };
/* minutes east of UTC that `zone` is at instant `ms` */
function zoneOffset(zone, ms) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const p = {};
  f.formatToParts(ms).forEach((x) => { p[x.type] = x.value; });
  const wall = utc(+p.year, +p.month - 1, +p.day).getTime() + ((+p.hour % 24) * 3600 + (+p.minute) * 60 + (+p.second)) * 1000;
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}
/* The instant a wall-clock time in `zone` names: guess with the offset at
   the naive instant, then once more with the offset at the answer, which
   settles every case but a time skipped by a spring clock change. */
function wallToInstant(day, h, mi, s, zone) {
  const naive = day.getTime() + ((h * 60 + mi) * 60 + s) * 1000;
  const o1 = zoneOffset(zone, naive);
  let t = naive - o1 * 60000;
  const o2 = zoneOffset(zone, t);
  if (o2 !== o1) t = naive - o2 * 60000;
  return t;
}
const hhmm = (ms, zone) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);

/* ---------- one person ---------- */
function ageOf(a, b) {
  /* Calendar difference: whole months, then the days counted on from the
     birth date moved by those months (clamped to a short month's end),
     so the day count is never negative. */
  const ay = a.getUTCFullYear(), am = a.getUTCMonth(), ad = a.getUTCDate();
  let total = (b.getUTCFullYear() - ay) * 12 + (b.getUTCMonth() - am);
  if (b.getUTCDate() < ad) total--;
  const anchor = utc(ay, am + total, 1);
  anchor.setUTCDate(Math.min(ad, utc(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0).getUTCDate()));
  const years = Math.floor(total / 12), months = total % 12;
  const days = Math.round((b - anchor) / MS);
  const totalDays = Math.round((b - a) / MS);
  // next birthday; 29 February falls on 1 March in other years
  let next = utc(b.getUTCFullYear(), am, ad);
  if (next < b) next = utc(b.getUTCFullYear() + 1, am, ad);
  const toNext = Math.round((next - b) / MS);
  return { years, months, days, totalDays, next, toNext, turns: toNext === 0 ? years : years + 1 };
}

/* "Asha 1988-03-02; Tom 2015-11-30" → [{ name, date }], plus what could not be read */
function people(text) {
  const out = [], bad = [];
  String(text || '').split(/[;\n]+/).map((s) => s.trim()).filter(Boolean).forEach((item, i) => {
    const m = /(-?\d{1,6}-\d{1,2}-\d{1,2})/.exec(item);
    const d = m ? dayOf(m[1]) : new Date(NaN);
    if (!m || isNaN(d)) { bad.push(item); return; }
    const name = (item.slice(0, m.index) + ' ' + item.slice(m.index + m[1].length)).replace(/[,:\-–—\s]+/g, ' ').trim();
    out.push({ name: name || 'Person ' + (i + 2), date: d });
  });
  return { list: out, bad };
}

const zodiacText = (c) => c ? `${c.animal} (${c.element} ${c.animal})` : '';

window.TOOLS = window.TOOLS || {};
window.TOOLS["age-calculator"] = {
"title": "Age Calculator",
"category": "time",
"description": "Work out an exact age in years, months and days, plus total days lived and time to the next birthday.",
"keywords": ["age calculator","how old am I","date of birth calculator","exact age","age in days","next birthday","chinese zodiac","star sign"],
"formula": "calendar-aware difference between date of birth and a reference date",
"inputs": [
  {"key":"dob","label":"Date of birth","type":"date","default":"1990-06-15"},
  {"key":"on","label":"Age at date","type":"date","default":"TODAY"},
  {"key":"birthTime","label":"Time of birth (optional)","type":"text","default":""},
  {"key":"birthZone","label":"Time zone of birth (optional, e.g. Europe/London)","type":"text","default":""},
  {"key":"others","label":"More people (optional): a name and a YYYY-MM-DD date each, separated by semicolons","type":"text","default":""}
],
"compute": ({ dob, on, birthTime, birthZone, others }) => {
      const a = dayOf(dob), b = dayOf(on);
      if (isNaN(a) || isNaN(b)) return { note: 'Enter two valid dates.' };
      if (a > b) return { note: 'The date of birth is after the reference date.' };

      const r = ageOf(a, b);
      const notes = [];
      if (r.toNext === 0) notes.push('That reference date is the birthday itself.');

      /* the moment of birth, for the live line and the "born at" row */
      let bornAt = '', birthMs = null, zone = '';
      const tm = TIME.exec(String(birthTime || '').trim());
      if (String(birthTime || '').trim() && !tm) notes.push('Time of birth is read as HH:MM, for example 14:30.');
      if (tm && +tm[1] < 24 && +tm[2] < 60) {
        zone = String(birthZone || '').trim() || deviceZone();
        if (!zone || !zoneOK(zone)) {
          notes.push('“' + String(birthZone).trim() + '” is not a time zone this browser knows; use a name from the list, such as Europe/London or Asia/Kolkata.');
        } else {
          try {
            birthMs = wallToInstant(a, +tm[1], +tm[2], +(tm[3] || 0), zone);
            bornAt = `${hhmm(birthMs, zone)} in ${zone} (${hhmm(birthMs, 'UTC')} UTC)`;
          } catch (e) { birthMs = null; }
        }
      }

      const cz = chinese(a);
      const res = {
        exact: `${r.years} years, ${r.months} months, ${r.days} days`,
        years: r.years, totalDays: r.totalDays,
        totalWeeks: Math.floor(r.totalDays / 7),
        totalMonths: r.years * 12 + r.months,
        totalHours: r.totalDays * 24,
        bornOn: DAYS[a.getUTCDay()],
        nextBirthday: showDate(r.next, true),
        daysToNext: r.toNext,
        turns: r.turns + (r.toNext === 0 ? ' (today)' : ''),
        starSign: starSign(a),
        chineseZodiac: zodiacText(cz),
        bornAt,
        note: notes.join(' '),
        /* for the live line: the birth instant if a time was given, else
           the start of the birth date where the reader is */
        _birth: { y: a.getUTCFullYear(), m: a.getUTCMonth(), d: a.getUTCDate(), ms: birthMs }
      };
      if (!cz) res.chineseZodiac = 'Not available: the New Year table covers ' + CNY_FROM + ' to ' + CNY_TO;

      /* several people: one row each, sorted by the next birthday */
      const more = people(others);
      if (more.bad.length) res.note = (res.note ? res.note + ' ' : '') + 'Could not read: ' + more.bad.map((s) => '“' + s.slice(0, 40) + '”').join(', ') + ' — write a name and a YYYY-MM-DD date.';
      if (more.list.length) {
        const all = [{ name: 'Date of birth above', date: a }].concat(more.list);
        const rows = all.map((p) => {
          if (p.date > b) return { p, r: null };
          return { p, r: ageOf(p.date, b) };
        }).sort((x, y) => (x.r ? x.r.toNext : 1e9) - (y.r ? y.r.toNext : 1e9));
        res._table = {
          head: ['Name', 'Born', 'Age', 'Next birthday', 'Days to go', 'Turns', 'Star sign', 'Chinese zodiac'],
          rows: rows.map(({ p, r: q }) => {
            const c = chinese(p.date);
            if (!q) return [p.name, showDate(p.date, false), 'not yet born', '', '', '', starSign(p.date), c ? c.animal : ''];
            return [p.name, showDate(p.date, false), `${q.years} y, ${q.months} m, ${q.days} d`, showDate(q.next, true),
              String(q.toNext), String(q.turns), starSign(p.date), c ? c.animal : ''];
          })
        };
      }
      return res;
    },
"outputs": [{"key":"exact","label":"Age","format":"text","primary":true},{"key":"years","label":"Age in years","format":"number"},{"key":"totalMonths","label":"Total months","format":"number"},{"key":"totalWeeks","label":"Total weeks","format":"number"},{"key":"totalDays","label":"Total days","format":"number"},{"key":"totalHours","label":"Total hours","format":"number"},{"key":"bornOn","label":"Day of the week born","format":"text"},{"key":"nextBirthday","label":"Next birthday","format":"text"},{"key":"daysToNext","label":"Days until then","format":"number"},{"key":"turns","label":"Age on the next birthday","format":"text"},{"key":"starSign","label":"Star sign","format":"text"},{"key":"chineseZodiac","label":"Chinese zodiac","format":"text"},{"key":"bornAt","label":"Born at","format":"text"},{"key":"note","label":"","format":"text"}],
"tips": ["The years/months/days breakdown walks the calendar rather than assuming an average month, so it matches how people actually count.","Someone born on 29 February has a birthday only in leap years. Most jurisdictions treat 1 March as the legal date in other years.","Set the second date to something other than today to work out an age at a past or future point — useful for eligibility cut-offs.","Add more people as “Asha 1988-03-02; Tom 2015-11-30” to get a table of everyone’s ages, sorted by whose birthday comes next, with a CSV download.","The Chinese zodiac animal changes at Chinese New Year, not on 1 January: someone born on 20 January 1990 is a Snake, not a Horse.","Dates follow the date format you pick in Settings; until you pick one they are written out in full."],
"faq": [{"q":"Why does the month count sometimes look off by one?","a":"Months have different lengths. Going from 31 January to 28 February is one day short of a full month, so it counts as 0 months and 28 days rather than 1 month."},{"q":"What does the time of birth change?","a":"The totals above count whole calendar days. With a time of birth, and its time zone, the live line under the results counts the seconds from that exact moment instead of from midnight."},{"q":"Which star sign dates does it use?","a":"The fixed dates most horoscopes print: Aquarius from 20 January, Pisces 19 February, Aries 21 March, Taurus 20 April, Gemini 21 May, Cancer 21 June, Leo 23 July, Virgo 23 August, Libra 23 September, Scorpio 23 October, Sagittarius 22 November and Capricorn 22 December. The sun’s real entry into a sign can shift by a day from year to year, so a birthday on a boundary may be read either way."},{"q":"Which Chinese New Year dates does it use?","a":"Those in the Hong Kong Observatory’s Gregorian–Lunar calendar conversion tables, which cover 1901 to 2100. The animal and its element change on that day; a date of birth outside those years gets no Chinese zodiac."}],

/* ---------- in the browser only ---------- */
"enhance": function (root) {
  const form = root.querySelector('.tool-form');
  const results = root.querySelector('.tool-results');
  if (!form || !results) return;
  /* the table (people, holidays, weeks) belongs under the results, not below the example panels */
  const calcBox = root.querySelector('.calc'), tt = root.querySelector('.tool-table');
  if (calcBox && tt && calcBox.nextElementSibling !== tt) calcBox.parentNode.insertBefore(tt, calcBox.nextSibling);
  const field = (k) => form.querySelector('[name="' + k + '"]');
  const t = field('birthTime');
  if (t) { try { t.type = 'time'; } catch (e) { /* stays a text box: HH:MM still works */ } }
  const z = field('birthZone');
  if (z) {
    z.placeholder = deviceZone() ? 'This device: ' + deviceZone() : 'e.g. Europe/London';
    z.setAttribute('autocomplete', 'off');
    z.spellcheck = false;
    let zones = [];
    try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) { zones = []; }
    if (zones.length) {
      const dl = document.createElement('datalist');
      dl.id = 'age-zones';
      zones.forEach((name) => { const o = document.createElement('option'); o.value = name; dl.appendChild(o); });
      z.parentNode.appendChild(dl);
      z.setAttribute('list', 'age-zones');
    }
  }
  const o = field('others');
  if (o) o.placeholder = 'e.g. Asha 1988-03-02; Tom 2015-11-30';

  /* The live line: how long since birth, to the second, right now. As a
     timer it is not announced every second to a screen reader, although
     it sits in the polite live region of the results. */
  const live = document.createElement('p');
  live.className = 'age-live';
  live.setAttribute('role', 'timer');
  live.setAttribute('aria-live', 'off');
  /* render-core empties the results on every recalculation, after which
     it announces the result: put the line back at the end each time */
  results.appendChild(live);
  document.addEventListener('mvr:result', () => { if (live.parentNode !== results || results.lastChild !== live) results.appendChild(live); });
  const spec = this;
  const grp = (n) => n.toLocaleString('en-GB');
  const tick = () => {
    let res;
    try {
      const v = {};
      ['dob', 'on', 'birthTime', 'birthZone', 'others'].forEach((k) => { const e = field(k); v[k] = e ? e.value : ''; });
      v.on = (() => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); })();
      v.others = '';
      res = spec.compute(v);
    } catch (e) { res = null; }
    if (!res || !res._birth) { live.hidden = true; return; }
    const B = res._birth;
    let from = B.ms;
    if (from === null) { const s = new Date(2000, 0, 1); s.setFullYear(B.y, B.m, B.d); from = s.getTime(); }
    const sec = Math.floor((Date.now() - from) / 1000);
    if (!(sec >= 0)) { live.hidden = true; return; }
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    live.hidden = false;
    live.textContent = 'Right now: ' + grp(d) + ' days, ' + h + ' h ' + String(m).padStart(2, '0') + ' min ' + String(s).padStart(2, '0') + ' s since birth — ' + grp(sec) + ' seconds'
      + (B.ms === null ? ' (from midnight; add a time of birth to be exact)' : '') + '.';
  };
  tick();
  let timer = setInterval(tick, 1000);
  form.addEventListener('input', tick);
  document.addEventListener('visibilitychange', () => {
    clearInterval(timer);
    if (!document.hidden) { tick(); timer = setInterval(tick, 1000); }
  });
}
};
})();
