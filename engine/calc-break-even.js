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
window.TOOLS["break-even"] = {
"currency": "GBP",
"title": "Break-Even Analysis Calculator",
"category": "business",
"description": "Find the sales volume and revenue where a product or business stops losing money.",
"keywords": ["break even calculator","break even analysis","break even point","contribution margin","fixed costs"],
"formula": "break-even units = fixed costs / (price − variable cost per unit)",
"inputs": [{"key":"fixed","label":"Fixed costs per period","type":"number","unit":"£","default":50000,"min":0},{"key":"price","label":"Selling price per unit","type":"number","unit":"£","default":100,"min":0},{"key":"variable","label":"Variable cost per unit","type":"number","unit":"£","default":60,"min":0},{"key":"target","label":"Target profit","type":"number","unit":"£","default":0,"min":0},{"key":"actual","label":"Expected unit sales","type":"number","default":2000,"min":0}],
"compute": ({ fixed, price, variable, target, actual }) => {
      const contribution = price - variable;
      if (contribution <= 0) {
        return { note: 'Each unit sells for no more than it costs to make, so there is no break-even point. Raise the price or cut the variable cost.' };
      }
      const beUnits = fixed / contribution;
      const beRevenue = beUnits * price;
      const targetUnits = (fixed + target) / contribution;
      const profitAtActual = contribution * actual - fixed;
      const marginOfSafety = actual > 0 ? ((actual - beUnits) / actual) * 100 : NaN;

      return {
        beUnits: Math.ceil(beUnits),
        beRevenue,
        contribution,
        contributionRatio: (contribution / price) * 100,
        targetUnits: Math.ceil(targetUnits),
        profitAtActual,
        marginOfSafety,
        operatingLeverage: profitAtActual > 0 ? (contribution * actual) / profitAtActual : NaN,
        note: ''
      };
    },
"outputs": [{"key":"beUnits","label":"Break-even volume","format":"number","unit":"units","primary":true},{"key":"beRevenue","label":"Break-even revenue","format":"currency"},{"key":"contribution","label":"Contribution per unit","format":"currency"},{"key":"contributionRatio","label":"Contribution margin ratio","format":"percent"},{"key":"targetUnits","label":"Units for target profit","format":"number","unit":"units"},{"key":"profitAtActual","label":"Profit at expected sales","format":"currency"},{"key":"marginOfSafety","label":"Margin of safety","format":"percent"},{"key":"operatingLeverage","label":"Operating leverage","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Contribution per unit is what each sale adds towards covering fixed costs. Until fixed costs are covered, every sale reduces the loss rather than creating profit.","Margin of safety is how far sales can fall before you hit break-even. Below about 20% the business is fragile to a bad quarter.","High operating leverage — large fixed costs, small variable costs — magnifies both profit and loss when volume moves."],
"faq": [{"q":"Which costs count as fixed?","a":"Costs that do not change with output over the period: rent, salaries, insurance, software subscriptions. Materials, shipping and per-unit commission are variable. Costs that step up at intervals, such as an extra shift, are semi-fixed and need modelling at each step."}]
};
})();