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
window.TOOLS["lumpsum-returns"] = {
"currency": "INR",
"title": "Lumpsum Investment Calculator",
"category": "india",
"description": "Future value and annualised return on a one-time investment, with inflation-adjusted worth.",
"keywords": ["lumpsum calculator","mutual fund calculator","compound interest India","investment returns","CAGR calculator"],
"formula": "FV = P × (1 + r)ⁿ",
"inputs": [{"key":"principal","label":"Investment amount","type":"number","unit":"₹","default":500000,"min":0},{"key":"rate","label":"Expected annual return","type":"number","unit":"%","default":12,"step":0.1},{"key":"years","label":"Investment period","type":"number","unit":"years","default":10,"min":0,"max":100},{"key":"inflation","label":"Assumed inflation","type":"number","unit":"%","default":6,"step":0.1}],
"compute": ({ principal, rate, years, inflation }) => {
      const p = Number(principal) || 0;
      const r = (Number(rate) || 0) / 100;
      const y = Number(years) || 0;
      const fv = p * Math.pow(1 + r, y);
      const real = fv / Math.pow(1 + (Number(inflation) || 0) / 100, y);
      const realRate = ((1 + r) / (1 + (Number(inflation) || 0) / 100) - 1) * 100;

      const rows = [];
      for (let i = 1; i <= Math.min(30, Math.ceil(y)); i++) {
        rows.push([String(i), fmtR(p * Math.pow(1 + r, i)),
                   fmtR(p * Math.pow(1 + r, i) / Math.pow(1 + (Number(inflation) || 0) / 100, i))]);
      }

      return {
        fv, gain: fv - p, real, realRate,
        multiple: p ? fv / p : NaN,
        doubling: r > 0 ? Math.log(2) / Math.log(1 + r) : NaN,
        _table: rows.length ? { head: ['Year', 'Nominal value', "Today's money"], rows } : null
      };
    },
"outputs": [{"key":"fv","label":"Maturity value","format":"currency","primary":true},{"key":"gain","label":"Total gain","format":"currency"},{"key":"real","label":"Worth in today’s money","format":"currency"},{"key":"realRate","label":"Real (inflation-adjusted) return","format":"percent"},{"key":"multiple","label":"Growth multiple","format":"number","unit":"×"},{"key":"doubling","label":"Years to double","format":"number"}],
"tips": ["The inflation-adjusted figure is the honest one. At 6% inflation, money loses roughly half its purchasing power every twelve years.","A 12% nominal return with 6% inflation is a real return of about 5.7%, not 6% — the two rates divide rather than subtract.","Nothing here accounts for exit load, expense ratio or tax, all of which reduce what you actually receive."],
"faq": [{"q":"Why is the real return not simply return minus inflation?","a":"Because both compound. The exact relationship is (1 + nominal) ÷ (1 + inflation) − 1. Subtracting is a reasonable approximation at low rates and increasingly wrong as rates rise."}]
};
})();