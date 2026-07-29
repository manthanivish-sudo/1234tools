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
window.TOOLS["epf-calculator"] = {
"currency": "INR",
"title": "EPF Calculator",
"category": "india",
"description": "Employees’ Provident Fund corpus at retirement, including the employer’s split into EPF and EPS.",
"keywords": ["EPF calculator","provident fund calculator","PF maturity","EPF interest","employee provident fund"],
"formula": "employee 12% of basic; employer 12% split 8.33% to EPS (capped) and the rest to EPF",
"inputs": [{"key":"basic","label":"Monthly basic + DA","type":"number","unit":"₹","default":50000,"min":0},{"key":"age","label":"Current age","type":"number","default":30,"min":15,"max":60},{"key":"retire","label":"Retirement age","type":"number","default":58,"min":40,"max":70},{"key":"rate","label":"EPF interest rate","type":"number","unit":"%","default":8.25,"step":0.05},{"key":"growth","label":"Annual salary growth","type":"number","unit":"%","default":7,"step":0.5},{"key":"existing","label":"Existing EPF balance","type":"number","unit":"₹","default":0,"min":0}],
"compute": ({ basic, age, retire, rate, growth, existing }) => {
      const years = Math.max(0, Math.min(60, (Number(retire) || 58) - (Number(age) || 30)));
      const r = (Number(rate) || 0) / 100 / 12;
      const g = (Number(growth) || 0) / 100;

      let salary = Number(basic) || 0;
      let balance = Number(existing) || 0;
      let employeeTotal = 0, employerEPF = 0, epsTotal = 0;
      const rows = [];

      for (let y = 1; y <= years; y++) {
        for (let m = 1; m <= 12; m++) {
          const emp = salary * 0.12;
          // EPS is 8.33% of basic capped at a ₹15,000 pensionable salary
          const eps = Math.min(salary, 15000) * 0.0833;
          const empr = salary * 0.12 - eps;
          balance = (balance + emp + empr) * (1 + r);
          employeeTotal += emp; employerEPF += empr; epsTotal += eps;
        }
        rows.push([String(y), fmtR(salary), fmtR(employeeTotal + employerEPF), fmtR(balance)]);
        salary *= (1 + g);
      }

      return {
        corpus: balance,
        employeeTotal, employerEPF, epsTotal,
        interest: balance - employeeTotal - employerEPF - (Number(existing) || 0),
        years,
        _table: rows.length ? { head: ['Year', 'Monthly basic', 'Contributions to date', 'EPF balance'], rows } : null
      };
    },
"outputs": [{"key":"corpus","label":"EPF corpus at retirement","format":"currency","primary":true},{"key":"employeeTotal","label":"Your contributions","format":"currency"},{"key":"employerEPF","label":"Employer contribution to EPF","format":"currency"},{"key":"epsTotal","label":"Diverted to EPS (pension)","format":"currency"},{"key":"interest","label":"Interest earned","format":"currency"},{"key":"years","label":"Years to retirement","format":"number"}],
"tips": ["Of the employer’s 12%, a share equal to 8.33% of pensionable salary goes to the Employees’ Pension Scheme rather than your EPF balance. EPS is capped at a ₹15,000 pensionable salary, so above that the whole excess flows to EPF.","The EPF rate is declared annually by EPFO and has drifted down over the years. A projection to retirement is indicative, not a quotation.","Withdrawal is tax-free after five years of continuous service. Withdrawing earlier makes it taxable and may attract TDS.","Voluntary Provident Fund lets you contribute more than 12% at the same rate, though interest on contributions above ₹2.5 lakh a year is taxable."],
"faq": [{"q":"What happens to EPS?","a":"It funds a monthly pension after 58, subject to at least ten years of eligible service. The pension is calculated on pensionable salary and service, not on the balance accumulated, so it is not simply your money back."}]
};
})();