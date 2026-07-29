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
window.TOOLS["uk-take-home-pay"] = {
"currency": "GBP",
"title": "UK Take-Home Pay Calculator",
"category": "business",
"description": "Estimate income tax, National Insurance and net pay from a gross salary. England, Wales and Northern Ireland.",
"keywords": ["take home pay calculator","salary calculator UK","net pay","income tax calculator","PAYE calculator","after tax salary"],
"formula": "net = gross − income tax − National Insurance − pension",
"inputs": [{"key":"gross","label":"Gross annual salary","type":"number","unit":"£","default":45000,"min":0},{"key":"year","label":"Tax year","type":"select","options":[{"value":"2026/27","label":"2026/27"},{"value":"2025/26","label":"2025/26"}],"default":"2026/27"},{"key":"pension","label":"Pension contribution","type":"number","unit":"%","default":5,"min":0,"step":0.1},{"key":"student","label":"Student loan","type":"select","options":[{"value":"none","label":"None"},{"value":"plan1","label":"Plan 1"},{"value":"plan2","label":"Plan 2"},{"value":"plan4","label":"Plan 4 (Scotland)"},{"value":"pgl","label":"Postgraduate loan"}],"default":"none"}],
"compute": ({ gross, year, pension, student }) => {
      const T = UK_TAX[year] || UK_TAX['2026/27'];
      const g = Math.max(0, Number(gross) || 0);

      // salary-sacrifice style: pension comes off before tax
      const pensionAmt = g * (Number(pension) || 0) / 100;
      const taxable0 = g - pensionAmt;

      // personal allowance taper above £100k
      let pa = T.personalAllowance;
      if (taxable0 > T.taperStart) pa = Math.max(0, pa - (taxable0 - T.taperStart) / 2);

      const above = Math.max(0, taxable0 - pa);
      let tax = 0;
      for (let i = 0; i < T.bands.length; i++) {
        const from = T.bands[i].from;
        const to = i + 1 < T.bands.length ? T.bands[i + 1].from : Infinity;
        if (above > from) tax += (Math.min(above, to) - from) * T.bands[i].rate;
      }

      // NI is charged on gross earnings, not after pension relief in most schemes
      const niBase = g;
      let ni = 0;
      if (niBase > T.ni.primary) {
        ni += (Math.min(niBase, T.ni.upper) - T.ni.primary) * T.ni.main;
        if (niBase > T.ni.upper) ni += (niBase - T.ni.upper) * T.ni.upper_rate;
      }

      const SL = { plan1: [26065, 0.09], plan2: [28470, 0.09], plan4: [32745, 0.09], pgl: [21000, 0.06] };
      let loan = 0;
      if (SL[student]) {
        const [thr, rate] = SL[student];
        loan = Math.max(0, g - thr) * rate;
      }

      const net = g - tax - ni - pensionAmt - loan;
      return {
        net, monthly: net / 12, weekly: net / 52,
        tax, ni, pensionAmt, loan,
        personalAllowance: pa,
        effectiveRate: g ? ((tax + ni + loan) / g) * 100 : 0,
        marginalRate: (taxable0 - pa) > T.bands[2].from ? 45
                    : (taxable0 - pa) > T.bands[1].from ? 40
                    : (taxable0 > pa) ? 20 : 0
      };
    },
"outputs": [{"key":"monthly","label":"Take-home per month","format":"currency","primary":true},{"key":"net","label":"Take-home per year","format":"currency"},{"key":"weekly","label":"Take-home per week","format":"currency"},{"key":"tax","label":"Income tax","format":"currency"},{"key":"ni","label":"National Insurance","format":"currency"},{"key":"pensionAmt","label":"Pension contribution","format":"currency"},{"key":"loan","label":"Student loan","format":"currency"},{"key":"personalAllowance","label":"Personal allowance applied","format":"currency"},{"key":"effectiveRate","label":"Effective tax + NI rate","format":"percent"},{"key":"marginalRate","label":"Marginal income tax rate","format":"percent"}],
"tips": ["This is an estimate for England, Wales and Northern Ireland. Scotland has its own income tax bands and will produce a different figure.","Between £100,000 and £125,140 the personal allowance is withdrawn at £1 for every £2 earned, creating an effective marginal rate of about 60%.","It assumes the standard tax code and no benefits in kind, salary sacrifice beyond pension, or other adjustments. Your payslip is the authority.","Tax rates and thresholds change. Check the current figures on GOV.UK before relying on this for a decision."],
"faq": [{"q":"Why does this differ from my payslip?","a":"Common causes are a non-standard tax code, benefits in kind such as a company car or private medical cover, salary sacrifice arrangements, a mid-year pay change, or the fact that PAYE spreads allowances across the year and can be catching up. For anything that matters, ask your payroll team or an accountant."},{"q":"Is this suitable for Scotland?","a":"No. Scotland sets its own income tax bands with additional rates, so the income tax figure would be wrong. National Insurance is the same UK-wide."}]
};
})();