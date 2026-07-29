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
window.TOOLS["average-calculator"] = {
"title": "Average Calculator (Mean, Median, Mode)",
"category": "mathematics",
"description": "Calculate mean, median, mode, range and weighted average from a list of numbers.",
"keywords": ["average calculator","mean median mode","weighted average","calculate average","arithmetic mean"],
"formula": "mean = Σx / n  ·  weighted mean = Σ(w·x) / Σw",
"inputs": [{"key":"data","label":"Numbers (comma or space separated)","type":"text","default":"12, 18, 7, 25, 18, 9, 30"},{"key":"weights","label":"Weights (optional, same order)","type":"text","default":""}],
"compute": ({ data, weights }) => {
      const nums = String(data).split(/[\s,;]+/).map(Number).filter(n => isFinite(n));
      if (!nums.length) return { note: 'Enter some numbers.' };
      const n = nums.length;
      const sorted = [...nums].sort((x, y) => x - y);
      const sum = nums.reduce((s, x) => s + x, 0);
      const mean = sum / n;
      const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

      const counts = {};
      nums.forEach(x => counts[x] = (counts[x] || 0) + 1);
      const maxC = Math.max(...Object.values(counts));
      const mode = maxC === 1 ? 'No mode'
        : Object.keys(counts).filter(k => counts[k] === maxC).join(', ');

      const w = String(weights || '').split(/[\s,;]+/).map(Number).filter(x => isFinite(x));
      let weighted = NaN;
      if (w.length === n) {
        const wsum = w.reduce((s, x) => s + x, 0);
        if (wsum) weighted = nums.reduce((s, x, i) => s + x * w[i], 0) / wsum;
      }

      // geometric and harmonic means are only defined for positive values
      const allPos = nums.every(x => x > 0);
      return {
        mean, median, mode, count: n, sum,
        min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0],
        weighted,
        geometric: allPos ? Math.pow(nums.reduce((p, x) => p * x, 1), 1 / n) : NaN,
        harmonic: allPos ? n / nums.reduce((s, x) => s + 1 / x, 0) : NaN,
        note: w.length && w.length !== n ? `You gave ${w.length} weights for ${n} numbers — the weighted average needs one weight per value.` : ''
      };
    },
"outputs": [{"key":"mean","label":"Mean (average)","format":"number","primary":true},{"key":"median","label":"Median","format":"number"},{"key":"mode","label":"Mode","format":"text"},{"key":"weighted","label":"Weighted average","format":"number"},{"key":"count","label":"Count","format":"number"},{"key":"sum","label":"Sum","format":"number"},{"key":"min","label":"Minimum","format":"number"},{"key":"max","label":"Maximum","format":"number"},{"key":"range","label":"Range","format":"number"},{"key":"geometric","label":"Geometric mean","format":"number"},{"key":"harmonic","label":"Harmonic mean","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["The mean is pulled by outliers; the median is not. A large gap between them means the data is skewed.","Use the geometric mean for growth rates and the harmonic mean for averaging rates such as speed.","Weighted averages need one weight per value — module credits, portfolio sizes, or however you are weighting."],
"faq": [{"q":"Which average should I use?","a":"Mean for symmetric data, median when there are outliers or the distribution is skewed, and mode for categories. Reporting the mean of house prices without the median is a classic way to mislead."}]
};
})();