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
window.TOOLS["discount-calculator"] = {
"currency": "GBP",
"title": "Discount & Sale Price Calculator",
"category": "business",
"description": "Apply single or stacked discounts, work backwards from a sale price, and see the margin impact.",
"keywords": ["discount calculator","sale price calculator","percentage off","stacked discount","markdown calculator"],
"formula": "sale price = original × (1 − d₁) × (1 − d₂) …",
"inputs": [{"key":"original","label":"Original price","type":"number","unit":"£","default":200,"min":0},{"key":"d1","label":"Discount 1","type":"number","unit":"%","default":20,"step":0.01},{"key":"d2","label":"Discount 2 (stacked)","type":"number","unit":"%","default":0,"step":0.01},{"key":"cost","label":"Unit cost (optional)","type":"number","unit":"£","default":100,"min":0}],
"compute": ({ original, d1, d2, cost }) => {
      const after1 = original * (1 - d1 / 100);
      const final = after1 * (1 - d2 / 100);
      const saved = original - final;
      const effective = original ? (saved / original) * 100 : 0;
      return {
        final, saved, effective,
        naiveSum: d1 + d2,
        marginBefore: original && cost ? ((original - cost) / original) * 100 : NaN,
        marginAfter: final && cost ? ((final - cost) / final) * 100 : NaN,
        profitAfter: cost ? final - cost : NaN
      };
    },
"outputs": [{"key":"final","label":"Final price","format":"currency","primary":true},{"key":"saved","label":"Total saved","format":"currency"},{"key":"effective","label":"Effective discount","format":"percent"},{"key":"naiveSum","label":"Sum of the two discounts","format":"percent"},{"key":"marginBefore","label":"Margin before discount","format":"percent"},{"key":"marginAfter","label":"Margin after discount","format":"percent"},{"key":"profitAfter","label":"Profit per unit after discount","format":"currency"}],
"tips": ["Stacked discounts do not add. 20% then 20% is 36% off, not 40%, because the second applies to an already-reduced price.","Discounts hit margin far harder than they hit price. On a 50% margin, a 20% discount removes 40% of your profit per unit.","To hold profit steady after a discount you must sell disproportionately more units. Check the volume required before running the promotion."],
"faq": [{"q":"How much extra volume does a discount need?","a":"Divide the current contribution per unit by the post-discount contribution. On a 50% margin, a 20% discount cuts contribution from 50 to 30 per 100 of price, so you need roughly 67% more unit sales just to stand still."}]
};
})();