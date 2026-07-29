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
window.TOOLS["india-capital-gains"] = {
"currency": "INR",
"title": "Capital Gains Tax Calculator (India)",
"category": "india",
"description": "Short and long-term capital gains on equity, mutual funds, property and other assets under current rules.",
"keywords": ["capital gains calculator India","LTCG calculator","STCG","section 112A","capital gains tax property","equity capital gains"],
"formula": "LTCG on listed equity = 12.5% on gains above ₹1.25 lakh",
"inputs": [{"key":"asset","label":"Asset type","type":"select","options":[{"value":"equity","label":"Listed equity / equity mutual fund"},{"value":"debt","label":"Debt mutual fund (bought after Apr 2023)"},{"value":"property","label":"Property / land / building"},{"value":"other","label":"Gold, unlisted shares, other"}],"default":"equity"},{"key":"sale","label":"Sale value","type":"number","unit":"₹","default":1000000,"min":0},{"key":"cost","label":"Purchase cost","type":"number","unit":"₹","default":600000,"min":0},{"key":"expenses","label":"Transfer expenses","type":"number","unit":"₹","default":0,"min":0},{"key":"months","label":"Holding period","type":"number","unit":"months","default":30,"min":0},{"key":"slabRate","label":"Your marginal slab rate","type":"number","unit":"%","default":30,"min":0}],
"compute": ({ asset, sale, cost, expenses, months, slabRate }) => {
      const gain = Math.max(0, (Number(sale) || 0) - (Number(cost) || 0) - (Number(expenses) || 0));
      const m = Number(months) || 0;

      const threshold = asset === 'equity' ? 12 : asset === 'property' ? 24 : 24;
      const isLong = asset === 'debt' ? false : m > threshold;

      let rate, exemption = 0, basis;
      if (asset === 'equity') {
        if (isLong) { rate = 0.125; exemption = 125000; basis = 'LTCG u/s 112A — 12.5% above ₹1.25 lakh'; }
        else { rate = 0.20; basis = 'STCG u/s 111A — 20%'; }
      } else if (asset === 'debt') {
        rate = (Number(slabRate) || 0) / 100;
        basis = 'Taxed at your slab rate (no LTCG benefit after April 2023)';
      } else if (isLong) {
        rate = 0.125; basis = 'LTCG — 12.5% without indexation';
      } else {
        rate = (Number(slabRate) || 0) / 100; basis = 'STCG — taxed at your slab rate';
      }

      const taxable = Math.max(0, gain - exemption);
      const tax = taxable * rate;
      const cess = tax * 0.04;

      return {
        gain, taxable, exemption,
        tax: tax + cess, cess,
        rate: rate * 100,
        basis,
        term: isLong ? `Long term (held ${m} months)` : `Short term (held ${m} months)`,
        netProceeds: (Number(sale) || 0) - (Number(expenses) || 0) - (tax + cess)
      };
    },
"outputs": [{"key":"tax","label":"Capital gains tax (incl. cess)","format":"currency","primary":true},{"key":"gain","label":"Capital gain","format":"currency"},{"key":"term","label":"Classification","format":"text"},{"key":"basis","label":"Basis of charge","format":"text"},{"key":"exemption","label":"Exemption applied","format":"currency"},{"key":"taxable","label":"Taxable gain","format":"currency"},{"key":"rate","label":"Applicable rate","format":"percent"},{"key":"netProceeds","label":"Net proceeds after tax","format":"currency"}],
"tips": ["The July 2024 changes reset these rates: listed equity STCG moved to 20%, and long-term gains across most assets to 12.5% without indexation.","The ₹1.25 lakh annual exemption applies to long-term gains on listed equity and equity mutual funds, aggregated across all such holdings for the year.","Property acquired before 23 July 2024 may still be eligible for the older 20%-with-indexation route where that produces a lower tax. This calculator uses the 12.5% basis, so check both with your CA.","Debt mutual funds bought on or after 1 April 2023 are taxed at slab rates regardless of holding period."],
"faq": [{"q":"Can I reduce property capital gains tax?","a":"Sections 54, 54F and 54EC allow relief where proceeds are reinvested in residential property or specified bonds within set time limits. The conditions are strict and unforgiving of missed deadlines — take advice before selling, not after."}]
};
})();