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
window.TOOLS["statistics"] = {
"title": "Statistics Calculator (Mean, Median, Mode, SD)",
"category": "mathematics",
"icon": "📊",
"description": "Compute mean, median, mode, standard deviation, variance, and quartiles from a dataset.",
"keywords": ["mean median mode","standard deviation calculator","variance","quartiles"],
"formula": "σ = √( Σ(xᵢ − μ)² / N )   ·   s = √( Σ(xᵢ − x̄)² / (N−1) )",
"inputs": [{"key":"data","label":"Data Set (comma or space separated)","type":"text","default":"12, 15, 11, 18, 15, 20, 13, 15"}],
"compute": ({ data }) => {
      const nums = String(data).split(/[\s,;]+/).map(Number).filter(n => isFinite(n));
      const N = nums.length;
      if (N === 0) return {};

      const sorted = [...nums].sort((a, b) => a - b);
      const sum = nums.reduce((s, n) => s + n, 0);
      const mean = sum / N;

      const median = N % 2 ? sorted[(N - 1) / 2] : (sorted[N / 2 - 1] + sorted[N / 2]) / 2;

      const counts = {};
      nums.forEach(n => counts[n] = (counts[n] || 0) + 1);
      const maxCount = Math.max(...Object.values(counts));
      const modes = Object.keys(counts).filter(k => counts[k] === maxCount);
      const mode = maxCount === 1 ? 'No mode' : modes.join(', ');

      const sqDiff = nums.reduce((s, n) => s + (n - mean) ** 2, 0);
      const popVar = sqDiff / N;
      const sampVar = N > 1 ? sqDiff / (N - 1) : NaN;

      const quantile = p => {
        const idx = (N - 1) * p;
        const lo = Math.floor(idx), hi = Math.ceil(idx);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
      };
      const q1 = quantile(0.25), q3 = quantile(0.75);

      return {
        count: N, sum, mean, median, mode,
        min: sorted[0], max: sorted[N - 1], range: sorted[N - 1] - sorted[0],
        popSD: Math.sqrt(popVar), sampSD: Math.sqrt(sampVar),
        popVar, sampVar, q1, q3, iqr: q3 - q1
      };
    },
"outputs": [{"key":"mean","label":"Mean (average)","format":"number","primary":true},{"key":"median","label":"Median","format":"number"},{"key":"mode","label":"Mode","format":"text"},{"key":"sampSD","label":"Standard Deviation (sample, n−1)","format":"number"},{"key":"popSD","label":"Standard Deviation (population, N)","format":"number"},{"key":"sampVar","label":"Variance (sample)","format":"number"},{"key":"count","label":"Count","format":"number"},{"key":"sum","label":"Sum","format":"number"},{"key":"min","label":"Minimum","format":"number"},{"key":"max","label":"Maximum","format":"number"},{"key":"range","label":"Range","format":"number"},{"key":"q1","label":"Q1 (25th percentile)","format":"number"},{"key":"q3","label":"Q3 (75th percentile)","format":"number"},{"key":"iqr","label":"Interquartile Range","format":"number"}],
"tips": ["Use the sample standard deviation (n−1) when your data is a sample drawn from a larger population — this is the usual case.","The median resists outliers; the mean does not. A large gap between them signals a skewed distribution.","The IQR is a robust spread measure. Points beyond Q1 − 1.5·IQR or Q3 + 1.5·IQR are conventional outliers."],
"faq": [{"q":"Why are there two standard deviations?","a":"Dividing by N gives the population standard deviation, correct when your data is the entire population. Dividing by N−1 (Bessel’s correction) gives an unbiased estimate when your data is a sample."}]
};
})();