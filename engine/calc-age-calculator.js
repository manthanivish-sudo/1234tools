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
window.TOOLS["age-calculator"] = {
"title": "Age Calculator",
"category": "time",
"description": "Work out an exact age in years, months and days, plus total days lived and time to the next birthday.",
"keywords": ["age calculator","how old am I","date of birth calculator","exact age","age in days"],
"formula": "calendar-aware difference between date of birth and a reference date",
"inputs": [{"key":"dob","label":"Date of birth","type":"date","default":"1990-06-15"},{"key":"on","label":"Age at date","type":"date","default":"TODAY"}],
"compute": ({ dob, on }) => {
      /* Whole calendar days in UTC. A birthday falling in British Summer
         Time used to compare local midnight (23:00 UTC the day before)
         against the reference date read as UTC midnight, so on the birthday
         itself the next one was reported as a year away. */
      const utc = (y, mo, da) => { const t = new Date(0); t.setUTCFullYear(y, mo, da); return t; };
      const dayOf = (s) => {
        const m = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s).trim());
        if (m) return utc(+m[1], +m[2] - 1, +m[3]);
        const x = new Date(s);
        return isNaN(x) ? x : utc(x.getFullYear(), x.getMonth(), x.getDate());
      };
      const a = dayOf(dob), b = dayOf(on);
      if (isNaN(a) || isNaN(b)) return { note: 'Enter two valid dates.' };
      if (a > b) return { note: 'The date of birth is after the reference date.' };

      /* Calendar difference: whole months, then the days counted on from the
         birth date moved by those months (clamped to a short month's end),
         so the day count is never negative. */
      const ay = a.getUTCFullYear(), am = a.getUTCMonth(), ad = a.getUTCDate();
      let total = (b.getUTCFullYear() - ay) * 12 + (b.getUTCMonth() - am);
      if (b.getUTCDate() < ad) total--;
      const anchor = utc(ay, am + total, 1);
      anchor.setUTCDate(Math.min(ad, utc(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0).getUTCDate()));
      const years = Math.floor(total / 12), months = total % 12;

      const MS = 86400000;
      const days = Math.round((b - anchor) / MS);
      const totalDays = Math.round((b - a) / MS);

      // next birthday; 29 February falls on 1 March in other years
      let next = utc(b.getUTCFullYear(), am, ad);
      if (next < b) next = utc(b.getUTCFullYear() + 1, am, ad);
      const toNext = Math.round((next - b) / MS);

      const DAYNAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return {
        exact: `${years} years, ${months} months, ${days} days`,
        years, totalDays,
        totalWeeks: Math.floor(totalDays / 7),
        totalMonths: years * 12 + months,
        totalHours: totalDays * 24,
        bornOn: DAYNAMES[a.getUTCDay()],
        nextBirthday: next.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
        daysToNext: toNext,
        note: toNext === 0 ? 'That reference date is the birthday itself.' : ''
      };
    },
"outputs": [{"key":"exact","label":"Age","format":"text","primary":true},{"key":"years","label":"Age in years","format":"number"},{"key":"totalMonths","label":"Total months","format":"number"},{"key":"totalWeeks","label":"Total weeks","format":"number"},{"key":"totalDays","label":"Total days","format":"number"},{"key":"totalHours","label":"Total hours","format":"number"},{"key":"bornOn","label":"Day of the week born","format":"text"},{"key":"nextBirthday","label":"Next birthday","format":"text"},{"key":"daysToNext","label":"Days until then","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["The years/months/days breakdown walks the calendar rather than assuming an average month, so it matches how people actually count.","Someone born on 29 February has a birthday only in leap years. Most jurisdictions treat 1 March as the legal date in other years.","Set the second date to something other than today to work out an age at a past or future point — useful for eligibility cut-offs."],
"faq": [{"q":"Why does the month count sometimes look off by one?","a":"Months have different lengths. Going from 31 January to 28 February is one day short of a full month, so it counts as 0 months and 28 days rather than 1 month."}]
};
})();