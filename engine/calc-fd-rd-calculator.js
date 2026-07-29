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
window.TOOLS["fd-rd-calculator"] = {
"currency": "INR",
"title": "FD & RD Calculator",
"category": "india",
"description": "Fixed and recurring deposit maturity with quarterly compounding, plus the effect of TDS.",
"keywords": ["FD calculator","fixed deposit calculator","RD calculator","recurring deposit","FD interest","FD maturity"],
"formula": "FD: A = P(1 + r/4)^(4t)   ·   RD compounds each instalment quarterly",
"inputs": [{"key":"type","label":"Deposit type","type":"select","options":[{"value":"fd","label":"Fixed deposit (lump sum)"},{"value":"rd","label":"Recurring deposit (monthly)"}],"default":"fd"},{"key":"amount","label":"Deposit amount","type":"number","unit":"₹","default":500000,"min":0},{"key":"rate","label":"Interest rate","type":"number","unit":"%","default":7,"step":0.05},{"key":"years","label":"Tenure","type":"number","unit":"years","default":5,"min":0,"max":50,"step":0.25},{"key":"slabRate","label":"Your income tax slab rate","type":"number","unit":"%","default":30,"min":0}],
"compute": ({ type, amount, rate, years, slabRate }) => {
      const p = Number(amount) || 0;
      const r = (Number(rate) || 0) / 100;
      const t = Number(years) || 0;

      let maturity, invested;
      if (type === 'fd') {
        invested = p;
        maturity = p * Math.pow(1 + r / 4, 4 * t);
      } else {
        const n = Math.max(0, Math.min(600, Math.round(t * 12)));
        invested = p * n;
        maturity = 0;
        for (let m = 0; m < n; m++) {
          const remaining = (n - m) / 12;
          maturity += p * Math.pow(1 + r / 4, 4 * remaining);
        }
      }

      const interest = maturity - invested;
      const tax = interest * ((Number(slabRate) || 0) / 100);

      return {
        maturity, invested, interest,
        tax, afterTax: maturity - tax,
        effectiveRate: t > 0 && invested > 0
          ? (Math.pow((maturity - tax) / invested, 1 / t) - 1) * 100 : NaN
      };
    },
"outputs": [{"key":"maturity","label":"Maturity amount","format":"currency","primary":true},{"key":"invested","label":"Total deposited","format":"currency"},{"key":"interest","label":"Interest earned","format":"currency"},{"key":"tax","label":"Tax on interest","format":"currency"},{"key":"afterTax","label":"Maturity after tax","format":"currency"},{"key":"effectiveRate","label":"Post-tax annualised return","format":"percent"}],
"tips": ["FD interest is fully taxable at your slab rate, which is why a 7% FD returns under 5% after tax for someone in the 30% bracket.","Banks deduct TDS once interest exceeds the annual threshold, but TDS is not the final tax — the balance is still due at your slab rate.","Most banks compound quarterly, which is what this uses. Some products pay simple interest or pay out monthly; check before comparing.","Breaking an FD early usually costs a penalty of 0.5% to 1% on the applicable rate."],
"faq": [{"q":"Why is my RD maturity lower than an FD of the same total?","a":"Because each RD instalment is invested for a shorter period. The first earns interest for the full term, the last for barely a month, so the average holding period is roughly half the tenure."}]
};
})();