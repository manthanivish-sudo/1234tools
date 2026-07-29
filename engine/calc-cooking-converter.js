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
window.TOOLS["cooking-converter"] = {
"title": "Cooking Measurement Converter",
"category": "utilities",
"description": "Convert between cups, tablespoons, millilitres, grams and ounces for common ingredients.",
"keywords": ["cooking conversion","cups to grams","tablespoon to ml","recipe converter","baking conversion","cups to ml"],
"formula": "volume converts exactly; volume to weight depends on ingredient density",
"inputs": [{"key":"amount","label":"Amount","type":"number","default":1,"min":0,"step":0.25},{"key":"unit","label":"Unit","type":"select","options":[{"value":"cup","label":"Cup (US, 240 ml)"},{"value":"tbsp","label":"Tablespoon (15 ml)"},{"value":"tsp","label":"Teaspoon (5 ml)"},{"value":"ml","label":"Millilitres"},{"value":"floz","label":"Fluid ounces (US)"}],"default":"cup"},{"key":"ingredient","label":"Ingredient (for weight)","type":"select","options":[{"value":"1000","label":"Water / milk"},{"value":"529","label":"Flour, plain (sifted)"},{"value":"600","label":"Flour, plain (spooned)"},{"value":"845","label":"Sugar, granulated"},{"value":"800","label":"Sugar, brown (packed)"},{"value":"460","label":"Sugar, icing"},{"value":"911","label":"Butter / oil"},{"value":"1030","label":"Honey / syrup"},{"value":"400","label":"Oats, rolled"},{"value":"780","label":"Rice, uncooked"},{"value":"340","label":"Cocoa powder"}],"default":"1000"},{"key":"scale","label":"Scale recipe by","type":"number","unit":"×","default":1,"min":0,"step":0.25}],
"compute": ({ amount, unit, ingredient, scale }) => {
      const ML = { cup: 240, tbsp: 15, tsp: 5, ml: 1, floz: 29.5735295625 };
      const ml = (Number(amount) || 0) * (ML[unit] || 1) * (Number(scale) || 1);
      const density = Number(ingredient) || 1000;   // grams per litre
      const grams = ml * density / 1000;

      return {
        ml,
        grams,
        ounces: grams / 28.349523125,
        cups: ml / 240,
        tbsp: ml / 15,
        tsp: ml / 5,
        floz: ml / 29.5735295625,
        litres: ml / 1000
      };
    },
"outputs": [{"key":"grams","label":"Weight","format":"number","unit":"g","primary":true},{"key":"ml","label":"Volume","format":"number","unit":"ml"},{"key":"cups","label":"Cups (US)","format":"number"},{"key":"tbsp","label":"Tablespoons","format":"number"},{"key":"tsp","label":"Teaspoons","format":"number"},{"key":"ounces","label":"Ounces","format":"number","unit":"oz"},{"key":"floz","label":"Fluid ounces","format":"number","unit":"fl oz"},{"key":"litres","label":"Litres","format":"number","unit":"L"}],
"tips": ["A cup is a volume, not a weight, so a cup of flour and a cup of sugar weigh very differently. That is why the ingredient matters.","How you fill the cup changes the result by up to 20%: sifted flour weighs far less than flour scooped straight from the bag.","For baking, weigh rather than measure by volume. It is the single biggest improvement most home bakers can make to consistency.","Cup sizes differ by country: 240 ml in the US, 250 ml in Australia, 284 ml for an old UK breakfast cup."],
"faq": [{"q":"Why do different charts disagree on cups of flour?","a":"Because they assume different filling methods. Published values range from about 120 g to 145 g per cup for plain flour. Any chart is an approximation of something a scale measures exactly."}]
};
})();