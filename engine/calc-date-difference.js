(function(){
/* ---------- UK tax tables ----------
   England, Wales and Northern Ireland only — Scotland operates its own
   income tax bands and is handled separately in the tool.
   Checked 2026-10-04 against https://www.gov.uk/income-tax-rates and
   https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027
   (and ...-2025-to-2026): personal allowance £12,570, reduced by £1 for
   every £2 of adjusted net income over £100,000; on taxable income (after
   the allowance) basic 20% up to £37,700, higher 40% from £37,701 to
   £125,140, additional 45% above £125,140; NI primary threshold £12,570,
   upper earnings limit £50,270, 8% / 2%; employer 15% above £5,000;
   Employment Allowance £10,500. Same figures in both years. */
const UK_TAX = {
  '2026/27': {
    personalAllowance: 12570,
    taperStart: 100000,          // PA reduces £1 for every £2 above this
    bands: [                     // rate on taxable income (after PA) above `from`
      { from: 0,      rate: 0.20 },
      { from: 37700,  rate: 0.40 },
      { from: 125140, rate: 0.45 }  // the additional rate threshold is £125,140 of taxable income, not 112,570
    ],
    ni: { primary: 12570, upper: 50270, main: 0.08, upper_rate: 0.02 },
    employerNI: { secondary: 5000, rate: 0.15, employmentAllowance: 10500 }
  },
  '2025/26': {
    personalAllowance: 12570,
    taperStart: 100000,
    bands: [
      { from: 0,      rate: 0.20 },
      { from: 37700,  rate: 0.40 },
      { from: 125140, rate: 0.45 }
    ],
    ni: { primary: 12570, upper: 50270, main: 0.08, upper_rate: 0.02 },
    employerNI: { secondary: 5000, rate: 0.15, employmentAllowance: 10500 }
  }
};


/* currency formatter used inside schedule tables */
function fmtC(v) {
  if (!isFinite(v)) return '—';
  return v.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });
}


/* ---------- Income tax, verified against the Income Tax Department position
   for AY 2027-28. Budget 2026 announced no change to slabs, so FY 2026-27
   carries forward the Budget 2025 reset. ---------- */
const IN_TAX = {
  '2026-27': {
    label: 'FY 2026-27 (AY 2027-28)',
    new: {
      slabs: [
        { upto: 400000,  rate: 0 },
        { upto: 800000,  rate: 0.05 },
        { upto: 1200000, rate: 0.10 },
        { upto: 1600000, rate: 0.15 },
        { upto: 2000000, rate: 0.20 },
        { upto: 2400000, rate: 0.25 },
        { upto: Infinity, rate: 0.30 }
      ],
      standardDeduction: 75000,
      rebateLimit: 1200000,
      rebateMax: 60000,
      surcharge: [[5000000, 0], [10000000, 0.10], [20000000, 0.15], [Infinity, 0.25]]
    },
    old: {
      slabs: [
        { upto: 250000,  rate: 0 },
        { upto: 500000,  rate: 0.05 },
        { upto: 1000000, rate: 0.20 },
        { upto: Infinity, rate: 0.30 }
      ],
      seniorExemption: 300000,
      superSeniorExemption: 500000,
      standardDeduction: 50000,
      rebateLimit: 500000,
      rebateMax: 12500,
      surcharge: [[5000000, 0], [10000000, 0.10], [20000000, 0.15], [50000000, 0.25], [Infinity, 0.37]]
    },
    cess: 0.04
  }
};
IN_TAX['2025-26'] = Object.assign({}, IN_TAX['2026-27'], { label: 'FY 2025-26 (AY 2026-27)' });

/* GST 2.0 — effective 22 September 2025. The 12% and 28% slabs were removed. */
const GST_SLABS = [
  { value: 0,    label: '0% — nil rated (essentials)' },
  { value: 0.25, label: '0.25% — rough diamonds' },
  { value: 3,    label: '3% — gold, silver, jewellery' },
  { value: 5,    label: '5% — everyday & essential goods' },
  { value: 18,   label: '18% — standard rate (most goods & services)' },
  { value: 40,   label: '40% — luxury & sin goods' }
];

const fmtR = (v) => isFinite(v)
  ? v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
  : '—';

/* Progressive slab tax on an amount. */
function slabTax(amount, slabs) {
  let tax = 0, lower = 0;
  for (const s of slabs) {
    if (amount <= lower) break;
    tax += (Math.min(amount, s.upto) - lower) * s.rate;
    lower = s.upto;
  }
  return tax;
}

function surchargeRate(income, table) {
  for (const [upto, rate] of table) if (income <= upto) return rate;
  return table[table.length - 1][1];
}


function countWeekdays(a, b) {
  const MS = 86400000;
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  const days = Math.max(0, Math.round((end - start) / MS));

  const whole = Math.floor(days / 7);
  let count = whole * 5;

  let dow = new Date(start).getUTCDay();
  for (let i = 0; i < days % 7; i++) {
    if (dow !== 0 && dow !== 6) count++;
    dow = (dow + 1) % 7;
  }
  return count;
}


window.TOOLS = window.TOOLS || {};
window.TOOLS["date-difference"] = {
"title": "Date Difference Calculator",
"category": "time",
"icon": "📅",
"description": "Calculate the exact time between two dates in years, months, days, and total units.",
"keywords": ["date difference","days between dates","age calculator","date duration"],
"formula": "Calendar-aware difference accounting for varying month lengths and leap years",
"inputs": [{"key":"start","label":"Start Date","type":"date","default":"2000-01-01"},{"key":"end","label":"End Date","type":"date","default":"TODAY"}],
"compute": ({ start, end }) => {
      /* Whole calendar days in UTC, so the browser's time zone and clock
         changes cannot move either date. */
      const dayOf = (s) => {
        const m = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s).trim());
        if (m) { const t = new Date(0); t.setUTCFullYear(+m[1], +m[2] - 1, +m[3]); return t; }
        const x = new Date(s);
        return isNaN(x) ? x : new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
      };
      const d1 = dayOf(start), d2 = dayOf(end);
      if (isNaN(d1) || isNaN(d2)) return {};
      const [a, b] = d1 <= d2 ? [d1, d2] : [d2, d1];

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
      const anchor = new Date(0);
      anchor.setUTCFullYear(ay, am + total, 1);
      const lastDay = new Date(0);
      lastDay.setUTCFullYear(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0);
      anchor.setUTCDate(Math.min(ad, lastDay.getUTCDate()));
      const msPerDay = 86400000;
      const years = Math.floor(total / 12), months = total % 12;
      const days = Math.round((b - anchor) / msPerDay);
      const totalDays = Math.round((b - a) / msPerDay);
      const local = (x) => new Date(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());

      return {
        breakdown: `${years} years, ${months} months, ${days} days`,
        totalDays,
        totalWeeks: totalDays / 7,
        totalMonths: years * 12 + months,
        totalHours: totalDays * 24,
        totalMinutes: totalDays * 1440,
        weekdays: countWeekdays(local(a), local(b))
      };
    },
"outputs": [{"key":"breakdown","label":"Difference","format":"text","primary":true},{"key":"totalDays","label":"Total Days","format":"number"},{"key":"weekdays","label":"Weekdays (Mon–Fri)","format":"number"},{"key":"totalWeeks","label":"Total Weeks","format":"number"},{"key":"totalMonths","label":"Total Months","format":"number"},{"key":"totalHours","label":"Total Hours","format":"number"},{"key":"totalMinutes","label":"Total Minutes","format":"number"}],
"tips": ["The years/months/days breakdown is calendar-aware — it accounts for months of different lengths and for leap years.","The weekday count excludes Saturdays and Sundays but not public holidays, which vary by country."],
"faq": [{"q":"Why do the months not simply equal days ÷ 30?","a":"Months vary from 28 to 31 days. This tool walks the calendar rather than assuming an average month length, so the breakdown matches how people actually count dates."}]
};
})();