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
window.TOOLS["emi-calculator"] = {
"currency": "INR",
"title": "EMI Calculator with Amortisation",
"category": "india",
"description": "Equated monthly instalment for home, car or personal loans, with the full repayment schedule.",
"keywords": ["EMI calculator","home loan EMI","car loan EMI","personal loan calculator","loan EMI India","amortisation schedule"],
"formula": "EMI = P × r × (1+r)ⁿ / ((1+r)ⁿ − 1)",
"inputs": [{"key":"amount","label":"Loan amount","type":"number","unit":"₹","default":5000000,"min":0},{"key":"rate","label":"Annual interest rate","type":"number","unit":"%","default":8.5,"step":0.05},{"key":"years","label":"Tenure","type":"number","unit":"years","default":20,"min":0,"max":50},{"key":"prepay","label":"Extra payment each month","type":"number","unit":"₹","default":0,"min":0}],
"compute": ({ amount, rate, years, prepay }) => {
      const p = Number(amount) || 0;
      const r = (Number(rate) || 0) / 100 / 12;
      const n = Math.max(0, Math.min(600, Math.round((Number(years) || 0) * 12)));  // cap at 50 years
      if (!p || !n) return { note: 'Enter a loan amount and tenure.' };

      const emi = r === 0 ? p / n : p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      const pay = emi + (Number(prepay) || 0);

      let balance = p, totalInterest = 0, months = 0;
      const rows = [];
      let yInt = 0, yPrin = 0;

      while (balance > 0.5 && months < 600) {
        const interest = balance * r;
        let principal = pay - interest;
        if (principal <= 0) return { note: 'The instalment does not cover the interest.' };
        if (principal > balance) principal = balance;
        balance -= principal; totalInterest += interest;
        yInt += interest; yPrin += principal; months++;
        if (months % 12 === 0 || balance <= 0.5) {
          rows.push([String(Math.ceil(months / 12)), fmtR(yPrin), fmtR(yInt), fmtR(balance)]);
          yInt = 0; yPrin = 0;
        }
      }

      const baseInterest = emi * n - p;
      return {
        emi, totalInterest, totalPaid: p + totalInterest,
        months, tenureYears: months / 12,
        interestSaved: prepay > 0 ? baseInterest - totalInterest : 0,
        monthsSaved: prepay > 0 ? n - months : 0,
        interestRatio: p ? (totalInterest / p) * 100 : 0,
        note: '',
        _table: { head: ['Year', 'Principal paid', 'Interest paid', 'Balance'], rows }
      };
    },
"outputs": [{"key":"emi","label":"Monthly EMI","format":"currency","primary":true},{"key":"totalInterest","label":"Total interest","format":"currency"},{"key":"totalPaid","label":"Total repayment","format":"currency"},{"key":"interestRatio","label":"Interest as % of principal","format":"percent"},{"key":"tenureYears","label":"Paid off in","format":"number","unit":"years"},{"key":"interestSaved","label":"Interest saved by prepaying","format":"currency"},{"key":"monthsSaved","label":"Months saved","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["On a 20-year home loan at 8.5%, total interest is close to the principal itself. Tenure matters far more than a small rate difference.","Prepayments made in the early years remove the most interest, because the outstanding balance is highest then.","Floating-rate home loans to individuals cannot carry a prepayment penalty in India. Fixed-rate loans can.","Under the old regime, home loan interest up to ₹2 lakh a year is deductible under Section 24(b) on a self-occupied property. The new regime does not allow it."],
"faq": [{"q":"Should I reduce the EMI or the tenure when prepaying?","a":"Reducing the tenure saves considerably more interest. Reducing the EMI improves monthly cash flow. Most banks default to keeping the EMI and cutting the tenure, which is usually the better outcome — but confirm, because some do the opposite."}]
};
})();