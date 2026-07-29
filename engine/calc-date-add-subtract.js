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
window.TOOLS["date-add-subtract"] = {
"title": "Date Add & Subtract Calculator",
"category": "time",
"description": "Add or subtract years, months, weeks and days from any date, with correct end-of-month handling.",
"keywords": ["date calculator","add days to date","subtract days from date","date add subtract","days from today"],
"formula": "calendar-aware, clamping to the end of month rather than rolling over",
"inputs": [{"key":"start","label":"Start date","type":"date","default":"TODAY"},{"key":"dir","label":"Direction","type":"select","options":[{"value":"add","label":"Add"},{"value":"sub","label":"Subtract"}],"default":"add"},{"key":"years","label":"Years","type":"number","default":0},{"key":"months","label":"Months","type":"number","default":1},{"key":"weeks","label":"Weeks","type":"number","default":0},{"key":"days","label":"Days","type":"number","default":0}],
"compute": ({ start, dir, years, months, weeks, days }) => {
      const d0 = new Date(start);
      if (isNaN(d0)) return { note: 'Enter a valid start date.' };
      const sign = dir === 'sub' ? -1 : 1;

      /* JavaScript dates span roughly ±273,790 years from 1970. Beyond that
         the Date is invalid and toISOString() throws, so the offsets are
         clamped to a range that stays representable. */
      const clamp = (v, lim) => Math.max(-lim, Math.min(lim, Math.round(Number(v) || 0)));
      const y = sign * clamp(years, 200000);
      const m = sign * clamp(months, 2400000);
      const dd = sign * (clamp(weeks, 10000000) * 7 + clamp(days, 70000000));

      /* Add years and months first, clamping the day of month. JavaScript's
         Date rolls 31 Jan + 1 month over to 3 March; almost nobody means
         that, so it is clamped to 28/29 February instead. */
      const targetY = d0.getFullYear() + y;
      const targetM = d0.getMonth() + m;
      const lastDay = new Date(targetY, targetM + 1, 0).getDate();
      const result = new Date(targetY, targetM, Math.min(d0.getDate(), lastDay));
      result.setDate(result.getDate() + dd);
      if (isNaN(result.getTime())) {
        return { note: 'That offset lands outside the range of dates a browser can represent (roughly the years −271821 to 275760).' };
      }

      const MS = 86400000;
      const diff = Math.round((Date.UTC(result.getFullYear(), result.getMonth(), result.getDate()) -
                               Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate())) / MS);
      const DAYNAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const clamped = d0.getDate() > lastDay;

      return {
        result: result.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        iso: result.toISOString().slice(0, 10),
        dayOfWeek: DAYNAMES[result.getDay()],
        totalDays: Math.abs(diff),
        direction: diff >= 0 ? 'later' : 'earlier',
        note: clamped ? `The start day does not exist in the target month, so it was clamped to the ${lastDay}th rather than rolling into the next month.` : ''
      };
    },
"outputs": [{"key":"result","label":"Resulting date","format":"text","primary":true},{"key":"iso","label":"ISO format","format":"text"},{"key":"dayOfWeek","label":"Day of the week","format":"text"},{"key":"totalDays","label":"Days moved","format":"number"},{"key":"direction","label":"Direction","format":"text"},{"key":"note","label":"","format":"text"}],
"tips": ["Years and months are applied before days, which is the convention contracts and statutes assume.","End-of-month is clamped, not rolled: 31 January plus one month is 28 or 29 February, not 3 March.","For deadlines counted in working days rather than calendar days, use the business days calculator instead."],
"faq": [{"q":"Why clamp rather than roll over?","a":"Because \"one month after 31 January\" almost always means the end of February in practice — rent dates, notice periods, subscription renewals. Rolling into March surprises people and is rarely what a contract intends."}]
};
})();