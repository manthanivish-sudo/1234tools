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
window.TOOLS["square-footage"] = {
"title": "Square Footage Calculator",
"category": "utilities",
"description": "Calculate floor area for rooms, including L-shaped spaces, plus material quantities and cost.",
"keywords": ["square footage calculator","square feet calculator","room area calculator","flooring calculator","sq ft"],
"formula": "area = length × width, summed across sections",
"inputs": [{"key":"unit","label":"Measurements in","type":"select","options":[{"value":"ft","label":"Feet"},{"value":"m","label":"Metres"},{"value":"in","label":"Inches"}],"default":"ft"},{"key":"l1","label":"Section 1 length","type":"number","default":12,"min":0},{"key":"w1","label":"Section 1 width","type":"number","default":10,"min":0},{"key":"l2","label":"Section 2 length (L-shape)","type":"number","default":0,"min":0},{"key":"w2","label":"Section 2 width","type":"number","default":0,"min":0},{"key":"waste","label":"Waste allowance","type":"number","unit":"%","default":10,"min":0},{"key":"price","label":"Price per square unit","type":"number","unit":"£","default":0,"min":0}],
"compute": ({ unit, l1, w1, l2, w2, waste, price }) => {
      const f = unit === 'm' ? 3.280839895013123 : unit === 'in' ? 1 / 12 : 1;
      const areaFt = (Number(l1) || 0) * f * (Number(w1) || 0) * f
                   + (Number(l2) || 0) * f * (Number(w2) || 0) * f;
      const withWaste = areaFt * (1 + (Number(waste) || 0) / 100);
      return {
        sqft: areaFt,
        sqm: areaFt / 10.763910416709722,
        sqyd: areaFt / 9,
        withWaste,
        withWasteM: withWaste / 10.763910416709722,
        cost: withWaste * (Number(price) || 0),
        boxes: Math.ceil(withWaste / 20)
      };
    },
"outputs": [{"key":"sqft","label":"Area","format":"number","unit":"sq ft","primary":true},{"key":"sqm","label":"Area","format":"number","unit":"m²"},{"key":"sqyd","label":"Area","format":"number","unit":"sq yd"},{"key":"withWaste","label":"Order with waste allowance","format":"number","unit":"sq ft"},{"key":"withWasteM","label":"Order with waste allowance","format":"number","unit":"m²"},{"key":"cost","label":"Estimated material cost","format":"currency"},{"key":"boxes","label":"Boxes at 20 sq ft each","format":"number"}],
"currency": "GBP",
"tips": ["A 10% waste allowance is typical for straight-laid flooring. Allow 15% for diagonal or herringbone patterns, and more for a room with many angles.","Break irregular rooms into rectangles and add them. Two sections cover most L-shaped spaces.","Measure at the widest points and check both ends — rooms are rarely perfectly square."],
"faq": [{"q":"Should I subtract for kitchen units or a fireplace?","a":"Usually not. The offcuts rarely tile back together usefully, and having slightly too much is far cheaper than a second delivery in a different dye lot."}]
};
})();