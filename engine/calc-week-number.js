(function(){
/* ---------- UK tax tables ----------
   Verified against HMRC guidance and the House of Commons Library briefing
   for 2026/27. England, Wales and Northern Ireland only — Scotland operates
   its own income tax bands and is handled separately in the tool. */
const UK_TAX = {
  '2026/27': {
    personalAllowance: 12570,
    taperStart: 100000,          // PA reduces £1 for every £2 above this
    bands: [                     // rate applied to income above `from`, after PA
      { from: 0,      rate: 0.20 },
      { from: 37700,  rate: 0.40 },
      { from: 112570, rate: 0.45 }
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
      { from: 112570, rate: 0.45 }
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
window.TOOLS["week-number"] = {
"title": "Week Number Calculator",
"category": "time",
"description": "Find the ISO-8601 week number for any date, and the dates covered by any week number.",
"keywords": ["week number","ISO week","what week is it","calendar week","week number calculator"],
"formula": "ISO-8601: week 1 contains the first Thursday of the year",
"inputs": [{"key":"date","label":"Date","type":"date","default":"TODAY"}],
"compute": ({ date }) => {
      const d = new Date(date);
      if (isNaN(d)) return { note: 'Enter a valid date.' };

      // ISO week: shift to the Thursday of the same week, then count
      const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = (t.getUTCDay() + 6) % 7;            // Monday = 0
      t.setUTCDate(t.getUTCDate() - dayNum + 3);         // Thursday of this week
      const isoYear = t.getUTCFullYear();
      const firstThu = new Date(Date.UTC(isoYear, 0, 4));
      const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
      firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
      const week = 1 + Math.round((t - firstThu) / (7 * 86400000));

      const monday = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      monday.setUTCDate(monday.getUTCDate() - dayNum);
      const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);
      const fmt = (x) => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

      const startOfYear = Date.UTC(d.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - startOfYear) / 86400000) + 1;
      const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

      return {
        week, isoYear,
        label: `Week ${week} of ${isoYear}`,
        range: `${fmt(monday)} to ${fmt(sunday)}`,
        dayOfYear,
        daysLeft: (isLeap(d.getFullYear()) ? 366 : 365) - dayOfYear,
        quarter: 'Q' + (Math.floor(d.getMonth() / 3) + 1),
        note: ''
      };
    },
"outputs": [{"key":"label","label":"ISO week","format":"text","primary":true},{"key":"range","label":"Week runs","format":"text"},{"key":"week","label":"Week number","format":"number"},{"key":"isoYear","label":"ISO year","format":"number"},{"key":"dayOfYear","label":"Day of year","format":"number"},{"key":"daysLeft","label":"Days left in the year","format":"number"},{"key":"quarter","label":"Quarter","format":"text"},{"key":"note","label":"","format":"text"}],
"tips": ["ISO-8601 weeks start on Monday, and week 1 is the one containing the first Thursday of January.","Early January can therefore fall in week 52 or 53 of the previous ISO year — which is why the ISO year is shown separately.","The US convention differs: weeks start on Sunday and week 1 contains 1 January. Spreadsheets often default to that, so check before reconciling."],
"faq": [{"q":"Why does 1 January sometimes show as week 52?","a":"If 1 January falls on a Friday, Saturday or Sunday, it belongs to the last week of the previous ISO year under ISO-8601. That is intentional — it keeps every week exactly seven days long."}]
};
})();