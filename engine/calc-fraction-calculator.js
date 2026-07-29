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
window.TOOLS["fraction-calculator"] = {
"title": "Fraction Calculator",
"category": "mathematics",
"description": "Add, subtract, multiply and divide fractions, simplify them, and convert to and from decimals.",
"keywords": ["fraction calculator","add fractions","simplify fraction","fraction to decimal","decimal to fraction"],
"formula": "a/b + c/d = (ad + cb) / bd, then divide by the greatest common divisor",
"inputs": [{"key":"n1","label":"First numerator","type":"number","default":3},{"key":"d1","label":"First denominator","type":"number","default":4},{"key":"op","label":"Operation","type":"select","options":[{"value":"+","label":"Add"},{"value":"-","label":"Subtract"},{"value":"*","label":"Multiply"},{"value":"/","label":"Divide"}],"default":"+"},{"key":"n2","label":"Second numerator","type":"number","default":5},{"key":"d2","label":"Second denominator","type":"number","default":6}],
"compute": ({ n1, d1, op, n2, d2 }) => {
      const a = Math.round(Number(n1) || 0), b = Math.round(Number(d1) || 0);
      const c = Math.round(Number(n2) || 0), d = Math.round(Number(d2) || 0);
      if (!b || !d) return { note: 'A denominator cannot be zero.' };
      if (op === '/' && c === 0) return { note: 'Cannot divide by a fraction equal to zero.' };

      let num2, den;
      if (op === '+') { num2 = a * d + c * b; den = b * d; }
      else if (op === '-') { num2 = a * d - c * b; den = b * d; }
      else if (op === '*') { num2 = a * c; den = b * d; }
      else { num2 = a * d; den = b * c; }

      const gcd = (x, y) => { x = Math.abs(x); y = Math.abs(y); while (y) [x, y] = [y, x % y]; return x || 1; };
      const g = gcd(num2, den);
      let sn = num2 / g, sd = den / g;
      if (sd < 0) { sn = -sn; sd = -sd; }

      const whole = Math.trunc(sn / sd);
      const rem = Math.abs(sn % sd);
      const mixed = rem === 0 ? String(whole)
        : whole === 0 ? `${sn < 0 ? '-' : ''}${rem}/${sd}`
        : `${whole} ${rem}/${sd}`;

      return {
        simplified: `${sn}/${sd}`,
        mixed,
        decimal: sn / sd,
        percent: (sn / sd) * 100,
        unsimplified: `${num2}/${den}`,
        gcdUsed: g,
        note: ''
      };
    },
"outputs": [{"key":"simplified","label":"Result (simplified)","format":"text","primary":true},{"key":"mixed","label":"As a mixed number","format":"text"},{"key":"decimal","label":"As a decimal","format":"number"},{"key":"percent","label":"As a percentage","format":"percent"},{"key":"unsimplified","label":"Before simplifying","format":"text"},{"key":"gcdUsed","label":"Divided by (GCD)","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["To add or subtract, the denominators must match — multiplying them together always works, though it may not give the smallest common denominator.","Dividing by a fraction is the same as multiplying by its reciprocal: ÷ 2/3 is × 3/2.","A fraction is fully simplified when the numerator and denominator share no common factor other than 1."],
"faq": [{"q":"Why is my answer not the smallest denominator?","a":"It should be — the result is divided by the greatest common divisor. If it looks large, check the inputs: 1/3 + 1/7 genuinely needs 21 as the denominator."}]
};
})();