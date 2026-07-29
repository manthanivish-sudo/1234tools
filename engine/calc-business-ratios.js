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
window.TOOLS["business-ratios"] = {
"currency": "GBP",
"title": "Financial Ratio Calculator",
"category": "business",
"description": "Liquidity, profitability, efficiency and leverage ratios from balance sheet and P&L figures.",
"keywords": ["financial ratios","current ratio","quick ratio","gearing ratio","return on equity","working capital"],
"formula": "current ratio = current assets / current liabilities",
"inputs": [{"key":"currentAssets","label":"Current assets","type":"number","unit":"£","default":250000,"min":0},{"key":"inventory","label":"Inventory (stock)","type":"number","unit":"£","default":80000,"min":0},{"key":"currentLiabilities","label":"Current liabilities","type":"number","unit":"£","default":150000,"min":0},{"key":"totalAssets","label":"Total assets","type":"number","unit":"£","default":600000,"min":0},{"key":"totalDebt","label":"Total debt","type":"number","unit":"£","default":200000,"min":0},{"key":"equity","label":"Shareholders’ equity","type":"number","unit":"£","default":300000,"min":0},{"key":"revenue","label":"Revenue","type":"number","unit":"£","default":900000,"min":0},{"key":"grossProfit","label":"Gross profit","type":"number","unit":"£","default":360000},{"key":"netProfit","label":"Net profit","type":"number","unit":"£","default":72000}],
"compute": (v) => {
      const d = (a, b) => (b === 0 ? NaN : a / b);
      return {
        current: d(v.currentAssets, v.currentLiabilities),
        quick: d(v.currentAssets - v.inventory, v.currentLiabilities),
        workingCapital: v.currentAssets - v.currentLiabilities,
        grossMargin: d(v.grossProfit, v.revenue) * 100,
        netMargin: d(v.netProfit, v.revenue) * 100,
        roa: d(v.netProfit, v.totalAssets) * 100,
        roe: d(v.netProfit, v.equity) * 100,
        assetTurnover: d(v.revenue, v.totalAssets),
        gearing: d(v.totalDebt, v.equity) * 100,
        debtRatio: d(v.totalDebt, v.totalAssets) * 100,
        equityRatio: d(v.equity, v.totalAssets) * 100
      };
    },
"outputs": [{"key":"current","label":"Current ratio","format":"number","primary":true},{"key":"quick","label":"Quick (acid test) ratio","format":"number"},{"key":"workingCapital","label":"Working capital","format":"currency"},{"key":"grossMargin","label":"Gross margin","format":"percent"},{"key":"netMargin","label":"Net margin","format":"percent"},{"key":"roa","label":"Return on assets","format":"percent"},{"key":"roe","label":"Return on equity","format":"percent"},{"key":"assetTurnover","label":"Asset turnover","format":"number","unit":"×"},{"key":"gearing","label":"Gearing (debt / equity)","format":"percent"},{"key":"debtRatio","label":"Debt ratio","format":"percent"},{"key":"equityRatio","label":"Equity ratio","format":"percent"}],
"tips": ["A current ratio near 1.5–2 is often comfortable, but the sensible range varies enormously by sector. Supermarkets run well below 1 quite safely because stock turns into cash within days.","The quick ratio strips out inventory, which is the hardest current asset to convert quickly. If quick is far below current, a lot of value is tied up in stock.","Ratios only mean something in comparison — against your own history, or against sector peers. A single period in isolation says very little."],
"faq": [{"q":"Is high gearing bad?","a":"Not inherently. Debt is cheaper than equity and magnifies returns when the business earns more than the interest costs. It becomes dangerous when earnings are volatile or interest rates rise, because the obligation does not flex with trading."}]
};
})();