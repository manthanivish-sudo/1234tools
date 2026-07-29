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
window.TOOLS["gratuity-calculator"] = {
"currency": "INR",
"title": "Gratuity Calculator",
"category": "india",
"description": "Gratuity payable under the Payment of Gratuity Act, with the tax-exempt portion.",
"keywords": ["gratuity calculator","gratuity formula","payment of gratuity act","gratuity exemption","gratuity 5 years"],
"formula": "gratuity = last drawn salary × 15/26 × years of service",
"inputs": [{"key":"salary","label":"Last drawn monthly basic + DA","type":"number","unit":"₹","default":60000,"min":0},{"key":"years","label":"Years of service","type":"number","default":10,"min":0,"step":0.5},{"key":"covered","label":"Employer covered by the Act?","type":"select","options":[{"value":"yes","label":"Yes (10+ employees)"},{"value":"no","label":"No"}],"default":"yes"}],
"compute": ({ salary, years, covered }) => {
      const s = Number(salary) || 0;
      const y = Number(years) || 0;
      // Under the Act, service beyond 6 months in the final year rounds up.
      const roundedYears = covered === 'yes' ? Math.round(y) : Math.floor(y);
      const gratuity = covered === 'yes'
        ? s * (15 / 26) * roundedYears
        : s * (15 / 30) * roundedYears;

      const CAP = 2000000;
      const eligible = y >= 5;
      const exempt = Math.min(gratuity, CAP);

      return {
        gratuity: eligible ? gratuity : 0,
        exempt: eligible ? exempt : 0,
        taxable: eligible ? Math.max(0, gratuity - CAP) : 0,
        yearsCounted: roundedYears,
        eligibility: eligible
          ? 'Eligible — five or more years of continuous service'
          : 'Not yet eligible. Five years of continuous service is normally required, except on death or disablement.'
      };
    },
"outputs": [{"key":"gratuity","label":"Gratuity payable","format":"currency","primary":true},{"key":"eligibility","label":"Eligibility","format":"text"},{"key":"exempt","label":"Tax-exempt portion","format":"currency"},{"key":"taxable","label":"Taxable portion","format":"currency"},{"key":"yearsCounted","label":"Years counted","format":"number"}],
"tips": ["The 15/26 factor treats a month as 26 working days and pays 15 days’ wages for each completed year of service.","Service beyond six months in the final year rounds up to a full year. Six months or less is ignored.","The lifetime tax exemption is ₹20 lakh, aggregated across all employers, not per job.","The five-year condition is waived where service ends because of death or disablement."],
"faq": [{"q":"Does gratuity use my full salary?","a":"No. It uses last drawn basic pay plus dearness allowance, not CTC and not including bonuses or allowances such as HRA. This is why the figure is usually smaller than people expect."}]
};
})();