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
window.TOOLS["bmr-tdee"] = {
"title": "BMR & Daily Energy Calculator",
"category": "health",
"description": "Estimate resting metabolic rate and total daily energy expenditure using the Mifflin-St Jeor equation.",
"keywords": ["BMR calculator","TDEE calculator","daily calorie needs","metabolic rate","maintenance calories"],
"formula": "Mifflin-St Jeor: BMR = 10w + 6.25h − 5a + s, then × activity factor",
"inputs": [{"key":"system","label":"Units","type":"select","options":[{"value":"metric","label":"Metric (kg, cm)"},{"value":"imperial","label":"Imperial (lb, in)"}],"default":"metric"},{"key":"weight","label":"Weight","type":"number","default":70,"min":0},{"key":"height","label":"Height","type":"number","default":175,"min":0},{"key":"age","label":"Age","type":"number","unit":"years","default":30,"min":15,"max":100},{"key":"sex","label":"Sex assigned at birth","type":"select","options":[{"value":"male","label":"Male"},{"value":"female","label":"Female"}],"default":"male"},{"key":"activity","label":"Activity level","type":"select","options":[{"value":"1.2","label":"Sedentary — desk job, little exercise"},{"value":"1.375","label":"Lightly active — 1–3 sessions a week"},{"value":"1.55","label":"Moderately active — 3–5 sessions a week"},{"value":"1.725","label":"Very active — 6–7 sessions a week"},{"value":"1.9","label":"Extremely active — physical job or twice daily"}],"default":"1.375"}],
"compute": ({ system, weight, height, age, sex, activity }) => {
      let kg = Number(weight) || 0, cm = Number(height) || 0;
      if (system === 'imperial') { kg = kg * 0.45359237; cm = cm * 2.54; }
      const a = Number(age) || 0;
      if (!kg || !cm || !a) return { note: 'Fill in weight, height and age.' };

      const bmr = 10 * kg + 6.25 * cm - 5 * a + (sex === 'male' ? 5 : -161);
      const tdee = bmr * Number(activity);

      /* Widely cited minimum intakes below which nutritional adequacy is
         difficult and medical supervision is normally advised. Stated as a
         floor, not as a target. */
      const floor = sex === 'male' ? 1500 : 1200;

      return {
        tdee,
        bmr,
        perKgBmr: kg ? bmr / kg : NaN,
        activityBurn: tdee - bmr,
        floor,
        range: `${Math.round(tdee * 0.9)} – ${Math.round(tdee * 1.1)} kcal`,
        note: ''
      };
    },
"outputs": [{"key":"tdee","label":"Estimated daily energy use","format":"number","unit":"kcal","primary":true},{"key":"range","label":"Realistic range (±10%)","format":"text"},{"key":"bmr","label":"Basal metabolic rate (at rest)","format":"number","unit":"kcal"},{"key":"activityBurn","label":"Attributed to activity","format":"number","unit":"kcal"},{"key":"floor","label":"Intake below which supervision is advised","format":"number","unit":"kcal"},{"key":"note","label":"","format":"text"}],
"tips": ["This is an estimate from a population equation. Individual metabolic rates vary by roughly 10% in either direction even between people with identical measurements, which is why a range is shown alongside the figure.","Activity multipliers are the least reliable part. Most people overestimate their activity level — if in doubt, choose the category below the one you were about to pick.","The equation was derived from adults without medical conditions. Pregnancy, thyroid disorders, some medications and a history of significant weight change all shift the result, sometimes substantially.","Sustained intake below roughly 1,500 kcal for men or 1,200 for women makes nutritional adequacy difficult and is normally something to do under medical supervision rather than alone.","If food, weight or eating feels distressing or preoccupying, a number from a calculator is unlikely to help. Speaking to a GP or a registered dietitian is a better next step."],
"faq": [{"q":"Should I eat this many calories?","a":"This tool estimates what your body uses; it does not tell you what to eat. Appropriate intake depends on your health, goals, medical history and a great deal this calculator has no knowledge of. A registered dietitian can advise on that properly, and will account for things a formula cannot."},{"q":"Why does my figure differ from another calculator?","a":"Different equations. Mifflin-St Jeor is used here because it is the most accurate for the general adult population, but Harris-Benedict, Katch-McArdle and others exist and give different results. None is exact for an individual."},{"q":"Is a lower number better?","a":"No. A lower basal rate simply means a smaller or older body, not a worse one. It is a description, not a score."}]
};
})();