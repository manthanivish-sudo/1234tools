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
window.TOOLS["tds-calculator"] = {
"currency": "INR",
"title": "TDS Calculator",
"category": "india",
"description": "Tax deducted at source across common sections, with the higher rate where PAN is not furnished.",
"keywords": ["TDS calculator","tax deducted at source","TDS rate chart","194C","194J","194I","TDS on rent"],
"formula": "TDS = payment × section rate (doubled if PAN not furnished)",
"inputs": [{"key":"section","label":"Nature of payment","type":"select","options":[{"value":"194C_ind","label":"194C — Contractor (individual/HUF) 1%"},{"value":"194C_oth","label":"194C — Contractor (others) 2%"},{"value":"194J_tech","label":"194J — Technical services 2%"},{"value":"194J_prof","label":"194J — Professional fees 10%"},{"value":"194I_pm","label":"194I — Rent: plant & machinery 2%"},{"value":"194I_land","label":"194I — Rent: land & building 10%"},{"value":"194H","label":"194H — Commission / brokerage 5%"},{"value":"194A","label":"194A — Interest (other than securities) 10%"},{"value":"194Q","label":"194Q — Purchase of goods 0.1%"},{"value":"194IB","label":"194IB — Rent by individual 5%"}],"default":"194J_prof"},{"key":"amount","label":"Payment amount","type":"number","unit":"₹","default":100000,"min":0},{"key":"pan","label":"PAN furnished?","type":"select","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No — Section 206AA applies"}],"default":"yes"}],
"compute": ({ section, amount, pan }) => {
      const RATES = {
        '194C_ind': 1, '194C_oth': 2, '194J_tech': 2, '194J_prof': 10,
        '194I_pm': 2, '194I_land': 10, '194H': 5, '194A': 10,
        '194Q': 0.1, '194IB': 5
      };
      let rate = RATES[section] || 10;
      const base = rate;
      // Section 206AA: no PAN means the higher of the section rate or 20%.
      if (pan === 'no') rate = Math.max(rate * 2, 20);

      const amt = Number(amount) || 0;
      const tds = amt * rate / 100;
      return {
        tds, netPayable: amt - tds, rate, baseRate: base,
        uplift: pan === 'no' ? tds - (amt * base / 100) : 0,
        section: section.split('_')[0]
      };
    },
"outputs": [{"key":"tds","label":"TDS to deduct","format":"currency","primary":true},{"key":"netPayable","label":"Net amount payable","format":"currency"},{"key":"rate","label":"Rate applied","format":"percent"},{"key":"baseRate","label":"Standard section rate","format":"percent"},{"key":"uplift","label":"Extra deducted for missing PAN","format":"currency"},{"key":"section","label":"Section","format":"text"}],
"tips": ["Each section carries its own threshold below which no TDS is required. This tool applies the rate; check the current threshold for the section before deciding not to deduct.","Section 206AA requires deduction at the higher of the section rate or 20% where the payee has not furnished a PAN.","TDS is generally deducted at payment or credit, whichever is earlier, and must be deposited by the 7th of the following month.","Failure to deduct can mean the expense is disallowed, not merely a penalty — often the larger cost."],
"faq": [{"q":"Do these rates change?","a":"Yes, most commonly at each Union Budget, and thresholds change more often than rates. Verify against the current TDS rate chart on the Income Tax Department site before running a payment cycle."}]
};
})();