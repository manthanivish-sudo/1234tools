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
window.TOOLS["prime-factorisation"] = {
"title": "Prime Factorisation Calculator",
"category": "mathematics",
"description": "Break a number into prime factors, list all divisors, and test whether it is prime.",
"keywords": ["prime factorisation","prime factors","factor calculator","is it prime","divisors of a number"],
"formula": "trial division up to √n",
"inputs": [{"key":"n","label":"Number","type":"number","default":360,"min":1}],
"compute": ({ n }) => {
      let x = Math.abs(Math.round(Number(n) || 0));
      if (x < 1) return { note: 'Enter a positive whole number.' };
      if (x > 1e12) return { note: 'Numbers above a trillion take too long to factor by trial division here.' };
      const original = x;

      const factors = [];
      for (let d = 2; d * d <= x; d++) {
        while (x % d === 0) { factors.push(d); x /= d; }
      }
      if (x > 1) factors.push(x);

      const grouped = {};
      factors.forEach(f => grouped[f] = (grouped[f] || 0) + 1);
      const expanded = Object.keys(grouped).map(Number).sort((a, b) => a - b)
        .map(f => grouped[f] > 1 ? `${f}^${grouped[f]}` : String(f)).join(' × ');

      // divisors, only for values where the list stays manageable
      let divisors = [];
      if (original <= 1e7) {
        for (let d = 1; d * d <= original; d++) {
          if (original % d === 0) { divisors.push(d); if (d !== original / d) divisors.push(original / d); }
        }
        divisors.sort((a, b) => a - b);
      }
      const divisorCount = Object.values(grouped).reduce((p, e) => p * (e + 1), 1);

      return {
        factorisation: original === 1 ? '1 has no prime factors' : expanded,
        isPrime: factors.length === 1 && original > 1 ? 'Yes — this is a prime number' : 'No',
        factorList: factors.join(' × ') || '—',
        distinctPrimes: Object.keys(grouped).length,
        divisorCount,
        divisorList: divisors.length ? (divisors.length > 40
          ? divisors.slice(0, 40).join(', ') + `, … (${divisors.length} in total)`
          : divisors.join(', ')) : 'too large to list',
        sumOfDivisors: divisors.length ? divisors.reduce((s, d) => s + d, 0) : NaN,
        note: ''
      };
    },
"outputs": [{"key":"factorisation","label":"Prime factorisation","format":"text","primary":true},{"key":"isPrime","label":"Prime?","format":"text"},{"key":"factorList","label":"Factors written out","format":"text"},{"key":"distinctPrimes","label":"Distinct prime factors","format":"number"},{"key":"divisorCount","label":"Number of divisors","format":"number"},{"key":"divisorList","label":"All divisors","format":"text"},{"key":"sumOfDivisors","label":"Sum of divisors","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Every whole number above 1 has exactly one prime factorisation — that is the fundamental theorem of arithmetic.","Trial division only needs to reach √n: any factor above the square root pairs with one below it.","1 is not prime. It has only one divisor, and treating it as prime would break unique factorisation."],
"faq": [{"q":"Why is factoring large numbers slow?","a":"Trial division scales with √n. That difficulty is not an accident of this tool — the presumed hardness of factoring very large semiprimes is what RSA encryption rests on."}]
};
})();