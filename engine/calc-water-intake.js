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
window.TOOLS["water-intake"] = {
"title": "Daily Water Intake Estimator",
"category": "health",
"description": "A rough guide to daily fluid needs based on body weight, activity and climate.",
"keywords": ["water intake calculator","how much water should I drink","daily hydration","fluid intake calculator"],
"formula": "roughly 30–35 ml per kg of body weight, adjusted for activity and heat",
"inputs": [{"key":"system","label":"Units","type":"select","options":[{"value":"metric","label":"Metric (kg)"},{"value":"imperial","label":"Imperial (lb)"}],"default":"metric"},{"key":"weight","label":"Weight","type":"number","default":70,"min":0},{"key":"exercise","label":"Exercise per day","type":"number","unit":"minutes","default":30,"min":0,"max":600},{"key":"climate","label":"Climate","type":"select","options":[{"value":"1","label":"Temperate"},{"value":"1.15","label":"Warm"},{"value":"1.3","label":"Hot or humid"}],"default":"1"}],
"compute": ({ system, weight, exercise, climate }) => {
      const kg = (Number(weight) || 0) * (system === 'imperial' ? 0.45359237 : 1);
      if (!kg) return { note: 'Enter a weight.' };
      const mins = Math.max(0, Math.min(600, Number(exercise) || 0));

      const base = kg * 33;                       // ml
      const fromExercise = (mins / 30) * 350;
      const total = (base + fromExercise) * Number(climate);

      return {
        litres: total / 1000,
        low: (total * 0.85) / 1000,
        high: (total * 1.15) / 1000,
        glasses: total / 250,
        fromFood: (total * 0.2) / 1000,
        fromDrinks: (total * 0.8) / 1000,
        pints: total / 568.26,
        note: ''
      };
    },
"outputs": [{"key":"litres","label":"Rough daily total","format":"number","unit":"L","primary":true},{"key":"low","label":"Lower end of the range","format":"number","unit":"L"},{"key":"high","label":"Upper end of the range","format":"number","unit":"L"},{"key":"fromDrinks","label":"Typically from drinks (~80%)","format":"number","unit":"L"},{"key":"fromFood","label":"Typically from food (~20%)","format":"number","unit":"L"},{"key":"glasses","label":"Roughly, 250 ml glasses","format":"number"},{"key":"pints","label":"Pints","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Thirst is a good guide for most healthy adults. Pale straw-coloured urine is a more useful signal than hitting a numeric target.","Around a fifth of typical fluid intake comes from food. Tea, coffee and juice all count towards the total — the idea that caffeine dehydrates at normal intakes is not supported by the evidence.","Needs rise with exercise, heat, altitude, fever, pregnancy and breastfeeding, and fall in cold weather.","Drinking far beyond thirst is not benign. Consuming several litres in a short period can dilute blood sodium dangerously, which is a genuine medical emergency.","Kidney disease, heart failure and some medications change fluid requirements substantially. If any apply, follow your clinician’s advice rather than a general formula."],
"faq": [{"q":"Is eight glasses a day correct?","a":"It is a memorable rule with no strong evidence behind it. Actual needs vary with body size, activity, climate and diet, which is why this shows a range rather than a single figure. For most healthy people, drinking to thirst works."}]
};
})();