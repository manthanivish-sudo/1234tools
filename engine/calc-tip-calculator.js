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
window.TOOLS["tip-calculator"] = {
"title": "Tip Calculator & Bill Splitter",
"category": "utilities",
"currency": "GBP",
"description": "Work out a tip and split a bill between any number of people, with optional rounding.",
"keywords": ["tip calculator","split bill","gratuity calculator","bill splitter","how much to tip"],
"formula": "tip = bill × rate  ·  each = (bill + tip) / people",
"inputs": [{"key":"bill","label":"Bill amount","type":"number","unit":"£","default":85,"min":0},{"key":"tip","label":"Tip","type":"number","unit":"%","default":12.5,"min":0,"step":0.5},{"key":"people","label":"Split between","type":"number","default":4,"min":1,"max":500},{"key":"round","label":"Rounding","type":"select","options":[{"value":"none","label":"Exact"},{"value":"up","label":"Round each share up"},{"value":"total","label":"Round the total up"}],"default":"none"}],
"compute": ({ bill, tip, people, round }) => {
      const b = Number(bill) || 0;
      const n = Math.max(1, Math.min(500, Math.round(Number(people) || 1)));
      let tipAmt = b * ((Number(tip) || 0) / 100);
      let total = b + tipAmt;

      if (round === 'total') { total = Math.ceil(total); tipAmt = total - b; }
      let each = total / n;
      if (round === 'up') { each = Math.ceil(each); total = each * n; tipAmt = total - b; }

      return {
        each, total, tipAmt,
        tipEach: tipAmt / n,
        billEach: b / n,
        effectiveTip: b ? (tipAmt / b) * 100 : 0
      };
    },
"outputs": [{"key":"each","label":"Each person pays","format":"currency","primary":true},{"key":"total","label":"Total including tip","format":"currency"},{"key":"tipAmt","label":"Tip amount","format":"currency"},{"key":"billEach","label":"Bill share each","format":"currency"},{"key":"tipEach","label":"Tip share each","format":"currency"},{"key":"effectiveTip","label":"Effective tip rate","format":"percent"}],
"tips": ["Tipping norms vary enormously: around 15–20% is customary in the US, 10–15% in the UK, and tipping is unusual or even unwelcome in Japan.","Check whether service is already included before adding a tip — many restaurants add 12.5% automatically for larger tables.","Rounding each share up is the practical option when people are paying cash and nobody wants to hunt for change."],
"faq": [{"q":"Should I tip on the pre-tax or post-tax amount?","a":"Either is accepted. Tipping on the pre-tax subtotal is the stricter reading, since tax is not part of the service. The difference is small, and nobody will comment on it."}]
};
})();