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
window.TOOLS["profit-margin"] = {
"currency": "GBP",
"title": "Profit Margin & Markup Calculator",
"category": "business",
"description": "Work out margin, markup, cost or selling price from any two of them. Margin and markup are not the same thing.",
"keywords": ["profit margin calculator","markup calculator","gross margin","margin vs markup","selling price calculator"],
"formula": "margin = (price − cost) / price   ·   markup = (price − cost) / cost",
"inputs": [{"key":"solve","label":"Solve for","type":"select","options":[{"value":"price","label":"Selling price (from cost + margin)"},{"value":"margin","label":"Margin & markup (from cost + price)"},{"value":"cost","label":"Cost (from price + margin)"}],"default":"price"},{"key":"cost","label":"Unit cost","type":"number","unit":"£","default":60,"min":0},{"key":"price","label":"Selling price","type":"number","unit":"£","default":100,"min":0},{"key":"margin","label":"Target margin","type":"number","unit":"%","default":40,"step":0.01},{"key":"units","label":"Units sold","type":"number","default":1000,"min":0}],
"compute": ({ solve, cost, price, margin, units }) => {
      let c = Number(cost) || 0, p = Number(price) || 0, m = Number(margin) || 0;

      if (solve === 'price') {
        if (m >= 100) return { note: 'A margin of 100% or more is impossible — margin is a share of the selling price.' };
        p = c / (1 - m / 100);
      } else if (solve === 'cost') {
        if (m >= 100) return { note: 'A margin of 100% or more is impossible — margin is a share of the selling price.' };
        c = p * (1 - m / 100);
      }

      const profit = p - c;
      const marginPct = p === 0 ? NaN : (profit / p) * 100;
      const markupPct = c === 0 ? NaN : (profit / c) * 100;

      return {
        price: p, cost: c, profit,
        marginPct, markupPct,
        multiplier: c === 0 ? NaN : p / c,
        totalRevenue: p * units,
        totalProfit: profit * units,
        note: ''
      };
    },
"outputs": [{"key":"price","label":"Selling price","format":"currency","primary":true},{"key":"cost","label":"Unit cost","format":"currency"},{"key":"profit","label":"Profit per unit","format":"currency"},{"key":"marginPct","label":"Margin (% of price)","format":"percent"},{"key":"markupPct","label":"Markup (% of cost)","format":"percent"},{"key":"multiplier","label":"Price multiplier","format":"number"},{"key":"totalRevenue","label":"Total revenue","format":"currency"},{"key":"totalProfit","label":"Total profit","format":"currency"},{"key":"note","label":"","format":"text"}],
"tips": ["Margin and markup are routinely confused, and the gap widens fast: a 50% markup is only a 33.3% margin, and a 100% markup is a 50% margin.","Margin is a share of the selling price; markup is a share of the cost. Retail and finance talk in margin, trade suppliers usually quote markup.","Margin can never reach 100% — that would mean the goods cost nothing. Markup has no upper limit."],
"faq": [{"q":"I want a 30% margin. What markup is that?","a":"About 42.9%. Divide the margin by (1 − margin): 0.30 ÷ 0.70 = 0.4286. Applying a 30% markup instead would leave you with only a 23% margin, well short of the target."}]
};
})();