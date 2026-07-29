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
window.TOOLS["age-calculator"] = {
"title": "Age Calculator",
"category": "time",
"description": "Work out an exact age in years, months and days, plus total days lived and time to the next birthday.",
"keywords": ["age calculator","how old am I","date of birth calculator","exact age","age in days"],
"formula": "calendar-aware difference between date of birth and a reference date",
"inputs": [{"key":"dob","label":"Date of birth","type":"date","default":"1990-06-15"},{"key":"on","label":"Age at date","type":"date","default":"TODAY"}],
"compute": ({ dob, on }) => {
      const a = new Date(dob), b = new Date(on);
      if (isNaN(a) || isNaN(b)) return { note: 'Enter two valid dates.' };
      if (a > b) return { note: 'The date of birth is after the reference date.' };

      let years = b.getFullYear() - a.getFullYear();
      let months = b.getMonth() - a.getMonth();
      let days = b.getDate() - a.getDate();
      if (days < 0) { months--; days += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
      if (months < 0) { years--; months += 12; }

      const MS = 86400000;
      const totalDays = Math.floor((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
                                    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / MS);

      // next birthday, allowing for 29 February
      let next = new Date(b.getFullYear(), a.getMonth(), a.getDate());
      if (next < b) next = new Date(b.getFullYear() + 1, a.getMonth(), a.getDate());
      const toNext = Math.ceil((next - b) / MS);

      const DAYNAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return {
        exact: `${years} years, ${months} months, ${days} days`,
        years, totalDays,
        totalWeeks: Math.floor(totalDays / 7),
        totalMonths: years * 12 + months,
        totalHours: totalDays * 24,
        bornOn: DAYNAMES[a.getDay()],
        nextBirthday: next.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        daysToNext: toNext,
        note: toNext === 0 ? 'That reference date is the birthday itself.' : ''
      };
    },
"outputs": [{"key":"exact","label":"Age","format":"text","primary":true},{"key":"years","label":"Age in years","format":"number"},{"key":"totalMonths","label":"Total months","format":"number"},{"key":"totalWeeks","label":"Total weeks","format":"number"},{"key":"totalDays","label":"Total days","format":"number"},{"key":"totalHours","label":"Total hours","format":"number"},{"key":"bornOn","label":"Day of the week born","format":"text"},{"key":"nextBirthday","label":"Next birthday","format":"text"},{"key":"daysToNext","label":"Days until then","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["The years/months/days breakdown walks the calendar rather than assuming an average month, so it matches how people actually count.","Someone born on 29 February has a birthday only in leap years. Most jurisdictions treat 1 March as the legal date in other years.","Set the second date to something other than today to work out an age at a past or future point — useful for eligibility cut-offs."],
"faq": [{"q":"Why does the month count sometimes look off by one?","a":"Months have different lengths. Going from 31 January to 28 February is one day short of a full month, so it counts as 0 months and 28 days rather than 1 month."}]
};
})();