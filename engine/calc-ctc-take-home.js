(function(){
/* ---------- UK tax tables ----------
   England, Wales and Northern Ireland only — Scotland operates its own
   income tax bands and is handled separately in the tool.
   Checked 2026-10-04 against https://www.gov.uk/income-tax-rates and
   https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027
   (and ...-2025-to-2026): personal allowance £12,570, reduced by £1 for
   every £2 of adjusted net income over £100,000; on taxable income (after
   the allowance) basic 20% up to £37,700, higher 40% from £37,701 to
   £125,140, additional 45% above £125,140; NI primary threshold £12,570,
   upper earnings limit £50,270, 8% / 2%; employer 15% above £5,000;
   Employment Allowance £10,500. Same figures in both years. */
const UK_TAX = {
  '2026/27': {
    personalAllowance: 12570,
    taperStart: 100000,          // PA reduces £1 for every £2 above this
    bands: [                     // rate on taxable income (after PA) above `from`
      { from: 0,      rate: 0.20 },
      { from: 37700,  rate: 0.40 },
      { from: 125140, rate: 0.45 }  // the additional rate threshold is £125,140 of taxable income, not 112,570
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
      { from: 125140, rate: 0.45 }
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
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["ctc-take-home"] = {
"currencyLocked": true,
"currencyNote": "Indian payroll and income-tax rules",
"currency": "INR",
"title": "CTC to In-Hand Salary Calculator",
"category": "india",
"description": "Break a cost-to-company figure into gross, deductions and monthly in-hand pay.",
"keywords": ["CTC calculator","in hand salary","take home salary India","salary breakup","CTC to take home"],
"formula": "in-hand = gross − PF − professional tax − income tax",
"inputs": [{"key":"ctc","label":"Annual CTC","type":"number","unit":"₹","default":1200000,"min":0},{"key":"basicPct","label":"Basic as % of CTC","type":"number","unit":"%","default":40,"min":10,"max":100},{"key":"regime","label":"Tax regime","type":"select","options":[{"value":"new","label":"New regime"},{"value":"old","label":"Old regime"}],"default":"new"},{"key":"deductions","label":"Old-regime deductions","type":"number","unit":"₹","default":150000,"min":0},{"key":"ptax","label":"Professional tax (annual)","type":"number","unit":"₹","default":2400,"min":0}],
"compute": ({ ctc, basicPct, regime, deductions, ptax }) => {
      const T = IN_TAX['2026-27'];
      const c = Number(ctc) || 0;
      const basic = c * ((Number(basicPct) || 40) / 100);

      // Employer PF is part of CTC but never reaches the employee.
      const pfWage = Math.min(basic, 180000);
      const employerPF = pfWage * 0.12;
      const employeePF = pfWage * 0.12;
      const gratuityAccrual = basic * (15 / 26) / 12;

      const gross = c - employerPF - gratuityAccrual;

      const R = T[regime];
      const taxable = Math.max(0, gross - R.standardDeduction -
        (regime === 'old' ? (Number(deductions) || 0) : 0));
      let tax = slabTax(taxable, R.slabs);
      if (taxable <= R.rebateLimit) tax = Math.max(0, tax - R.rebateMax);
      if (regime === 'new' && taxable > R.rebateLimit) {
        const excess = taxable - R.rebateLimit;
        if (tax > excess) tax = excess;
      }
      tax *= (1 + T.cess);

      const annualInHand = gross - employeePF - (Number(ptax) || 0) - tax;

      return {
        monthly: annualInHand / 12,
        annualInHand, gross, basic,
        employerPF, employeePF, gratuityAccrual,
        tax, ptax: Number(ptax) || 0,
        _table: {
          head: ['Component', 'Annual', 'Monthly'],
          cols: ['text', 'currency', 'currency'],
          rows: [
            ['Cost to company', cell(c), cell(c / 12)],
            ['Less: employer PF', cell(-employerPF), cell(-employerPF / 12)],
            ['Less: gratuity accrual', cell(-gratuityAccrual), cell(-gratuityAccrual / 12)],
            ['Gross salary', cell(gross), cell(gross / 12)],
            ['Less: employee PF', cell(-employeePF), cell(-employeePF / 12)],
            /* "|| 0": a nil line reads ₹0, not -₹0 */
            ['Less: professional tax', cell(-(Number(ptax) || 0) || 0), cell(-(Number(ptax) || 0) / 12 || 0)],
            ['Less: income tax', cell(-tax || 0), cell(-tax / 12 || 0)],
            ['In-hand salary', cell(annualInHand), cell(annualInHand / 12)]
          ]
        }
      };
    },
"outputs": [{"key":"monthly","label":"Monthly in-hand","format":"currency","primary":true},{"key":"annualInHand","label":"Annual in-hand","format":"currency"},{"key":"gross","label":"Gross salary","format":"currency"},{"key":"basic","label":"Basic pay","format":"currency"},{"key":"employerPF","label":"Employer PF (in CTC, not paid to you)","format":"currency"},{"key":"employeePF","label":"Your PF deduction","format":"currency"},{"key":"tax","label":"Income tax + cess","format":"currency"},{"key":"ptax","label":"Professional tax","format":"currency"}],
"filled": (v, r, f) => [
      'gross = ' + f.money(Number(v.ctc)) + ' − employer PF ' + f.money(r.employerPF) + ' − gratuity ' + f.money(r.gratuityAccrual) + ' = ' + f.money(r.gross),
      'in hand = ' + f.money(r.gross) + ' − PF ' + f.money(r.employeePF) + ' − professional tax ' + f.money(r.ptax) + ' − income tax ' + f.money(r.tax) + ' = ' + f.money(r.annualInHand) + ' a year',
      'a month: ' + f.money(r.annualInHand) + ' ÷ 12 = ' + f.money(r.monthly)],
"tips": ["CTC is what you cost the employer, not what you receive. Employer PF, gratuity accrual and insurance premiums sit inside CTC but never reach your account.","A higher basic increases PF and gratuity — better long-term savings, lower monthly cash.","Professional tax is levied by state and capped at ₹2,500 a year. Some states, including Delhi and Haryana, do not levy it at all.","Variable pay and joining bonuses are usually included in CTC but paid conditionally, which is the most common reason in-hand differs from expectation."],
"faq": [{"q":"Why is my in-hand so much lower than CTC ÷ 12?","a":"Typically 15–25% of CTC never reaches you: employer PF, gratuity accrual, insurance and any variable component, before income tax and your own PF are deducted."}]
};
})();