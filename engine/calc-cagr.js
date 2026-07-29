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
window.TOOLS["cagr"] = {
"currency": "GBP",
"title": "CAGR Calculator (Compound Annual Growth Rate)",
"category": "business",
"description": "Calculate the smoothed annual growth rate between two values, and project it forward.",
"keywords": ["CAGR calculator","compound annual growth rate","growth rate","revenue growth","annualised growth"],
"formula": "CAGR = (ending / beginning)^(1/years) − 1",
"inputs": [{"key":"begin","label":"Beginning value","type":"number","unit":"£","default":1000000,"min":0},{"key":"end","label":"Ending value","type":"number","unit":"£","default":1800000,"min":0},{"key":"years","label":"Number of years","type":"number","default":4,"min":0,"step":0.5},{"key":"project","label":"Project forward","type":"number","unit":"years","default":3,"min":0}],
"compute": ({ begin, end, years, project }) => {
      if (!begin || !years) return { note: 'Enter a beginning value and a number of years.' };
      const cagr = Math.pow(end / begin, 1 / years) - 1;
      const table = { head: ['Year', 'Projected value'], rows: [] };
      for (let i = 1; i <= Math.min(20, project); i++) {
        table.rows.push([String(i), fmtC(end * Math.pow(1 + cagr, i))]);
      }
      return {
        cagr: cagr * 100,
        totalGrowth: ((end - begin) / begin) * 100,
        multiple: end / begin,
        doubling: cagr > 0 ? Math.log(2) / Math.log(1 + cagr) : NaN,
        projected: end * Math.pow(1 + cagr, project),
        note: '',
        _table: table.rows.length ? table : null
      };
    },
"outputs": [{"key":"cagr","label":"Compound annual growth rate","format":"percent","primary":true},{"key":"totalGrowth","label":"Total growth over period","format":"percent"},{"key":"multiple","label":"Growth multiple","format":"number","unit":"×"},{"key":"doubling","label":"Years to double at this rate","format":"number"},{"key":"projected","label":"Projected value","format":"currency"},{"key":"note","label":"","format":"text"}],
"tips": ["CAGR smooths away all volatility. Two businesses with identical CAGR can have wildly different year-to-year records, and one may be far riskier.","It is meaningless over very short periods, and easily manipulated by choosing a flattering start year.","The rule of 72 is a decent mental check: 72 ÷ growth rate ≈ years to double."],
"faq": [{"q":"Why not just average the yearly growth rates?","a":"The arithmetic mean overstates growth. Rising 50% then falling 50% averages to zero, but leaves you 25% down. CAGR is the geometric mean and reflects what actually happened."}]
};
})();