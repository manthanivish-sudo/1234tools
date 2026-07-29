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
window.TOOLS["ratio-calculator"] = {
"title": "Ratio Calculator",
"category": "mathematics",
"description": "Simplify ratios, solve for a missing term, and scale a ratio to a total.",
"keywords": ["ratio calculator","simplify ratio","ratio to fraction","proportion calculator","scale ratio"],
"formula": "a : b = c : d  →  d = bc / a",
"inputs": [{"key":"a","label":"A","type":"number","default":3},{"key":"b","label":"B","type":"number","default":4},{"key":"c","label":"C (for A:B = C:D)","type":"number","default":9},{"key":"total","label":"Share a total of","type":"number","default":700,"min":0}],
"compute": ({ a, b, c, total }) => {
      const A = Number(a) || 0, B = Number(b) || 0, C = Number(c) || 0;
      if (!A || !B) return { note: 'A and B must both be non-zero.' };

      const gcd = (x, y) => { x = Math.abs(x); y = Math.abs(y); while (y) [x, y] = [y, x % y]; return x || 1; };
      const g = gcd(Math.round(A), Math.round(B));
      const sum = A + B;

      return {
        simplified: `${Math.round(A / g)} : ${Math.round(B / g)}`,
        decimal: A / B,
        missingD: A ? (B * C) / A : NaN,
        shareA: total * (A / sum),
        shareB: total * (B / sum),
        percentA: (A / sum) * 100,
        percentB: (B / sum) * 100,
        asFraction: `${Math.round(A / g)}/${Math.round(B / g)}`,
        note: ''
      };
    },
"outputs": [{"key":"simplified","label":"Simplified ratio","format":"text","primary":true},{"key":"decimal","label":"A ÷ B","format":"number"},{"key":"missingD","label":"D, where A:B = C:D","format":"number"},{"key":"shareA","label":"A’s share of the total","format":"number"},{"key":"shareB","label":"B’s share of the total","format":"number"},{"key":"percentA","label":"A as a percentage","format":"percent"},{"key":"percentB","label":"B as a percentage","format":"percent"},{"key":"asFraction","label":"As a fraction","format":"text"},{"key":"note","label":"","format":"text"}],
"tips": ["A ratio compares parts to each other; a fraction compares a part to the whole. In 3:4, A is 3/7 of the total, not 3/4.","Scaling a recipe or a mix is a proportion problem: keep A:B fixed and solve for the new quantity.","Aspect ratios are just ratios in their simplest form — 1920:1080 reduces to 16:9."],
"faq": [{"q":"What is the difference between a ratio and a rate?","a":"A ratio compares two quantities of the same kind and has no units. A rate compares different kinds — miles per hour, cost per unit — and carries units."}]
};
})();