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
window.TOOLS["employer-cost"] = {
"currency": "GBP",
"title": "True Cost of an Employee Calculator",
"category": "business",
"description": "Work out what an employee really costs after employer NI, pension, holiday and overheads.",
"keywords": ["employer NI calculator","cost of employee","true cost of hiring","employment cost calculator","employer national insurance"],
"formula": "employer NI = (salary − secondary threshold) × 15%",
"inputs": [{"key":"salary","label":"Gross annual salary","type":"number","unit":"£","default":40000,"min":0},{"key":"year","label":"Tax year","type":"select","options":[{"value":"2026/27","label":"2026/27"},{"value":"2025/26","label":"2025/26"}],"default":"2026/27"},{"key":"pension","label":"Employer pension","type":"number","unit":"%","default":3,"min":0,"step":0.1},{"key":"allowance","label":"Employment Allowance","type":"select","options":[{"value":"no","label":"Not claimed / already used"},{"value":"yes","label":"Claim against this employee"}],"default":"no"},{"key":"overheads","label":"Other costs (equipment, software, space)","type":"number","unit":"£","default":3000,"min":0},{"key":"recruitment","label":"Recruitment cost (first year)","type":"number","unit":"£","default":4000,"min":0}],
"compute": ({ salary, year, pension, allowance, overheads, recruitment }) => {
      const T = (UK_TAX[year] || UK_TAX['2026/27']).employerNI;
      const s = Math.max(0, Number(salary) || 0);

      let ni = Math.max(0, s - T.secondary) * T.rate;
      const grossNI = ni;
      if (allowance === 'yes') ni = Math.max(0, ni - T.employmentAllowance);

      const pensionAmt = s * (Number(pension) || 0) / 100;
      const annual = s + ni + pensionAmt + overheads;
      const firstYear = annual + recruitment;

      // 5.6 weeks statutory holiday out of 52 -> productive weeks
      const productiveWeeks = 52 - 5.6;
      return {
        annual, firstYear,
        ni, grossNI,
        allowanceSaving: grossNI - ni,
        pensionAmt,
        onCost: s ? ((annual - s) / s) * 100 : 0,
        monthly: annual / 12,
        perProductiveDay: annual / (productiveWeeks * 5),
        perProductiveHour: annual / (productiveWeeks * 37.5)
      };
    },
"outputs": [{"key":"annual","label":"Total annual cost","format":"currency","primary":true},{"key":"firstYear","label":"First-year cost (incl. recruitment)","format":"currency"},{"key":"ni","label":"Employer National Insurance","format":"currency"},{"key":"allowanceSaving","label":"Saved by Employment Allowance","format":"currency"},{"key":"pensionAmt","label":"Employer pension","format":"currency"},{"key":"onCost","label":"On-cost above salary","format":"percent"},{"key":"monthly","label":"Monthly cost","format":"currency"},{"key":"perProductiveDay","label":"Cost per working day","format":"currency"},{"key":"perProductiveHour","label":"Cost per productive hour","format":"currency"}],
"tips": ["Employer NI is 15% above a £5,000 secondary threshold, so it starts biting at low salaries — a change that hit part-time-heavy employers hardest.","The Employment Allowance offsets up to £10,500 of employer NI across the whole payroll, not per employee. Companies whose only employee is also a director cannot claim it.","Cost per productive hour assumes 5.6 weeks of statutory holiday and a 37.5-hour week. It is usually a far more useful number for pricing work than the headline salary.","A realistic on-cost for a UK employee is typically 20–30% above salary before recruitment and equipment."],
"faq": [{"q":"Does the Employment Allowance apply to every employee?","a":"No. It is a single annual allowance of £10,500 set against your total employer NI bill, not a per-employee relief. This tool shows the effect if you allocate it here, which is only realistic if it is not already consumed elsewhere on the payroll."}]
};
})();