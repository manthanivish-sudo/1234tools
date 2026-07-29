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
window.TOOLS["lcm-gcd"] = {
"title": "LCM & GCD Calculator",
"category": "mathematics",
"description": "Find the least common multiple and greatest common divisor of any list of numbers.",
"keywords": ["LCM calculator","GCD calculator","least common multiple","greatest common factor","HCF calculator"],
"formula": "gcd via the Euclidean algorithm  ·  lcm(a,b) = |ab| / gcd(a,b)",
"inputs": [{"key":"nums","label":"Numbers (comma separated)","type":"text","default":"12, 18, 24"}],
"compute": ({ nums }) => {
      const list = String(nums).split(/[\s,;]+/).map(Number)
        .filter(n => isFinite(n) && n !== 0).map(n => Math.abs(Math.round(n)));
      if (list.length < 2) return { note: 'Enter at least two non-zero whole numbers.' };
      if (list.some(n => n > 1e12)) return { note: 'Keep the numbers below a trillion.' };

      const gcd2 = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
      const g = list.reduce(gcd2);
      let l = list[0];
      for (const n of list.slice(1)) {
        l = (l / gcd2(l, n)) * n;
        if (!isFinite(l) || l > 1e15) return { note: 'The least common multiple is too large to compute reliably.' };
      }

      return {
        gcd: g, lcm: l,
        coprime: g === 1 ? 'Yes — these numbers share no common factor' : 'No',
        product: list.reduce((p, n) => p * n, 1),
        count: list.length,
        simplified: list.map(n => n / g).join(' : '),
        note: ''
      };
    },
"outputs": [{"key":"gcd","label":"Greatest common divisor (HCF)","format":"number","primary":true},{"key":"lcm","label":"Least common multiple","format":"number"},{"key":"coprime","label":"Coprime?","format":"text"},{"key":"simplified","label":"Ratio in simplest form","format":"text"},{"key":"count","label":"Numbers given","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["GCD and HCF are the same thing under different names — highest common factor is the more common term in UK schools.","Use the GCD to simplify fractions and ratios, and the LCM to find a common denominator or to work out when repeating events coincide.","For two numbers, gcd × lcm always equals their product. That identity does not extend to three or more."],
"faq": [{"q":"What does coprime mean?","a":"Two numbers are coprime when their only common divisor is 1. They need not be prime themselves — 8 and 9 are coprime despite both being composite."}]
};
})();