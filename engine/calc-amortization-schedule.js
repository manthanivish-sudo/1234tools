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
window.TOOLS["amortization-schedule"] = {
"currency": "GBP",
"title": "Loan Amortisation Schedule",
"category": "business",
"description": "Full payment-by-payment breakdown of principal, interest and remaining balance, with optional overpayments.",
"keywords": ["amortization schedule","amortisation calculator","loan schedule","mortgage schedule","principal and interest breakdown"],
"formula": "M = P · [r(1+r)ⁿ] / [(1+r)ⁿ − 1]",
"inputs": [{"key":"amount","label":"Loan amount","type":"number","unit":"£","default":200000,"min":0},{"key":"rate","label":"Annual interest rate","type":"number","unit":"%","default":5.5,"step":0.01},{"key":"years","label":"Term","type":"number","unit":"years","default":25,"min":0,"max":100},{"key":"overpay","label":"Extra payment each month","type":"number","unit":"£","default":0,"min":0},{"key":"view","label":"Schedule detail","type":"select","options":[{"value":"annual","label":"Annual summary"},{"value":"monthly","label":"Monthly (first 5 years)"}],"default":"annual"}],
"compute": ({ amount, rate, years, overpay, view }) => {
      if (!amount || !years) return { note: 'Enter a loan amount and a term.' };
      const r = rate / 100 / 12;
      const n = Math.round(years * 12);
      const base = r === 0 ? amount / n : amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      const pay = base + (Number(overpay) || 0);

      let balance = amount, totalInterest = 0, months = 0;
      const rows = [];
      let yInt = 0, yPrin = 0;

      while (balance > 0.005 && months < 1200) {
        const interest = balance * r;
        let principal = pay - interest;
        if (principal <= 0) return { note: 'The payment does not cover the interest, so the balance would never reduce.' };
        if (principal > balance) principal = balance;

        balance -= principal;
        totalInterest += interest;
        yInt += interest; yPrin += principal;
        months++;

        if (view === 'monthly' && months <= 60) {
          rows.push([String(months), fmtC(interest + principal), fmtC(principal), fmtC(interest), fmtC(balance)]);
        }
        if (view === 'annual' && (months % 12 === 0 || balance <= 0.005)) {
          rows.push([String(Math.ceil(months / 12)), fmtC(yPrin + yInt), fmtC(yPrin), fmtC(yInt), fmtC(balance)]);
          yInt = 0; yPrin = 0;
        }
      }

      const baseTotal = base * n;
      return {
        monthly: base,
        withOverpay: pay,
        totalInterest,
        totalPaid: amount + totalInterest,
        months,
        payoffYears: months / 12,
        interestSaved: overpay > 0 ? (baseTotal - amount) - totalInterest : 0,
        monthsSaved: overpay > 0 ? n - months : 0,
        note: '',
        _table: {
          head: view === 'monthly'
            ? ['Month', 'Payment', 'Principal', 'Interest', 'Balance']
            : ['Year', 'Paid', 'Principal', 'Interest', 'Balance'],
          rows
        }
      };
    },
"outputs": [{"key":"monthly","label":"Contractual monthly payment","format":"currency","primary":true},{"key":"withOverpay","label":"Payment including overpayment","format":"currency"},{"key":"totalInterest","label":"Total interest","format":"currency"},{"key":"totalPaid","label":"Total repaid","format":"currency"},{"key":"payoffYears","label":"Paid off in","format":"number","unit":"years"},{"key":"interestSaved","label":"Interest saved by overpaying","format":"currency"},{"key":"monthsSaved","label":"Months saved","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Early payments are mostly interest because interest is charged on the outstanding balance, which is highest at the start.","An overpayment goes entirely to principal, so it removes all the future interest that principal would have accrued. Small, early overpayments do the most work.","Check for early repayment charges before overpaying. Many fixed-rate deals cap annual overpayments at 10%."],
"faq": [{"q":"Should I shorten the term or reduce the payment?","a":"Shortening the term saves far more interest, because the balance falls faster. Reducing the payment improves monthly cash flow instead. Which is right depends on whether your constraint is total cost or monthly affordability."}]
};
})();