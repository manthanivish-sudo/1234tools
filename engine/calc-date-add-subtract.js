(function(){
/* Date add & subtract (/time/date-add-subtract/).
   Whole calendar days, worked in UTC: a YYYY-MM-DD field is read as that
   calendar day wherever the browser is, and no clock change can move the
   answer a day (local midnight in British Summer Time is 23:00 the day
   before in UTC, which used to leak into the ISO date). */

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
const utcDate = (y, mo, da) => { const t = new Date(0); t.setUTCFullYear(y, mo, da); return t; };

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
const shortDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/* One step: years and months first on the month and year numbers, the day
   clamped to the end of a short month, then days counted on the calendar.
   Returns the new date and whether the day had to be clamped. */
function step(d0, y, m, dd) {
  const targetY = d0.getUTCFullYear() + y;
  const targetM = d0.getUTCMonth() + m;
  const lastDay = utcDate(targetY, targetM + 1, 0).getUTCDate();
  const result = utcDate(targetY, targetM, Math.min(d0.getUTCDate(), lastDay));
  result.setUTCDate(result.getUTCDate() + dd);
  return { date: result, clamped: d0.getUTCDate() > lastDay ? lastDay : 0 };
}

/* "+1 month −2 days, +1 week" → [{ n, unit, text }]. A sign carries on to
   the terms after it until another sign appears; the first term is "+"
   unless it says otherwise. Anything else left over is reported. */
const UNIT = [[/^(years?|yrs?|y)$/i, 'y'], [/^(months?|mos?|m)$/i, 'm'], [/^(weeks?|wks?|w)$/i, 'w'], [/^(days?|d)$/i, 'd']];
function parseChain(text) {
  const terms = [], re = /([+\-−–]?)\s*(\d{1,7})\s*([a-z]+)/gi;
  const src = String(text || '');
  let m, sign = 1, rest = src;
  while ((m = re.exec(src))) {
    const u = UNIT.find(([r]) => r.test(m[3]));
    if (!u) continue;
    if (m[1]) sign = m[1] === '+' ? 1 : -1;
    terms.push({ n: sign * +m[2], unit: u[1], text: m[0].trim() });
    rest = rest.replace(m[0], ' ');
  }
  const left = rest.replace(/[\s,;+\-−–]+/g, ' ').trim();
  return { terms, left };
}
const UNIT_WORD = { y: ['year', 'years'], m: ['month', 'months'], w: ['week', 'weeks'], d: ['day', 'days'] };

window.TOOLS = window.TOOLS || {};
window.TOOLS["date-add-subtract"] = {
"title": "Date Add & Subtract Calculator",
"category": "time",
"description": "Add or subtract years, months, weeks and days from any date, with correct end-of-month handling.",
"keywords": ["date calculator","add days to date","subtract days from date","date add subtract","days from today","add months to date"],
"formula": "calendar-aware, clamping to the end of month rather than rolling over",
"inputs": [{"key":"start","label":"Start date","type":"date","default":"TODAY"},{"key":"dir","label":"Direction","type":"select","options":[{"value":"add","label":"Add"},{"value":"sub","label":"Subtract"}],"default":"add"},{"key":"years","label":"Years","type":"number","default":0},{"key":"months","label":"Months","type":"number","default":1},{"key":"weeks","label":"Weeks","type":"number","default":0},{"key":"days","label":"Days","type":"number","default":0},
  {"key":"chain","label":"Then, step by step (optional, e.g. +1 month −2 days)","type":"text","default":""}],
"compute": ({ start, dir, years, months, weeks, days, chain }) => {
      const d0 = dayOf(start);
      if (isNaN(d0)) return { note: 'Enter a valid start date.' };
      const sign = dir === 'sub' ? -1 : 1;

      /* JavaScript dates span roughly ±273,790 years from 1970. Beyond that
         the Date is invalid and toISOString() throws, so the offsets are
         clamped to a range that stays representable. */
      const clamp = (v, lim) => Math.max(-lim, Math.min(lim, Math.round(Number(v) || 0)));
      const y = sign * clamp(years, 200000);
      const m = sign * clamp(months, 2400000);
      const dd = sign * (clamp(weeks, 10000000) * 7 + clamp(days, 70000000));
      const OUT = 'That offset lands outside the range of dates a browser can represent (roughly the years −271821 to 275760).';

      /* Add years and months first, clamping the day of month. JavaScript's
         Date rolls 31 Jan + 1 month over to 3 March; almost nobody means
         that, so it is clamped to 28/29 February instead. */
      const first = step(d0, y, m, dd);
      let result = first.date;
      if (isNaN(result.getTime())) return { note: OUT };
      const notes = [];
      if (first.clamped) notes.push(`The start day does not exist in the target month, so it was clamped to the ${first.clamped}th rather than rolling into the next month.`);

      /* the optional chain: each term applied in turn to the date so far */
      const parsed = parseChain(chain);
      const trail = [];
      for (const t of parsed.terms) {
        const s = step(result, t.unit === 'y' ? t.n : 0, t.unit === 'm' ? t.n : 0, t.unit === 'w' ? t.n * 7 : t.unit === 'd' ? t.n : 0);
        if (isNaN(s.date.getTime())) return { note: OUT };
        const w = UNIT_WORD[t.unit][Math.abs(t.n) === 1 ? 0 : 1];
        trail.push(`${t.n < 0 ? '−' : '+'}${Math.abs(t.n)} ${w} → ${shortDate(s.date)}${s.clamped ? ' (clamped)' : ''}`);
        result = s.date;
      }
      if (parsed.left) notes.push(`Not understood in the steps box: “${parsed.left.slice(0, 40)}”. Write terms such as +1 month, −2 days, +3 weeks.`);

      const diff = Math.round((result - d0) / MS);
      const res = {
        result: showDate(result),
        iso: result.toISOString().slice(0, 10),
        dayOfWeek: DAYS[result.getUTCDay()],
        totalDays: Math.abs(diff),
        direction: diff >= 0 ? 'later' : 'earlier',
        note: notes.join(' ')
      };
      if (trail.length) res.steps = shortDate(first.date) + ', then ' + trail.join('; ');
      return res;
    },
"outputs": [{"key":"result","label":"Resulting date","format":"text","primary":true},{"key":"iso","label":"ISO format","format":"text"},{"key":"dayOfWeek","label":"Day of the week","format":"text"},{"key":"totalDays","label":"Days moved","format":"number"},{"key":"direction","label":"Direction","format":"text"},{"key":"steps","label":"Step by step","format":"text"},{"key":"note","label":"","format":"text"}],
"tips": ["Years and months are applied before days, which is the convention contracts and statutes assume.","End-of-month is clamped, not rolled: 31 January plus one month is 28 or 29 February, not 3 March.","For deadlines counted in working days rather than calendar days, use the business days calculator instead.","The steps box applies each term in order, so “+1 month +1 month” from 31 January lands on 28 March, while 2 months in the Months box lands on 31 March."],
"faq": [{"q":"Why clamp rather than roll over?","a":"Because \"one month after 31 January\" almost always means the end of February in practice — rent dates, notice periods, subscription renewals. Rolling into March surprises people and is rarely what a contract intends."}]
};
})();
