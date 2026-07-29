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
window.TOOLS["ideal-weight"] = {
"title": "Reference Weight Range Calculator",
"category": "health",
"description": "Weight ranges from the standard clinical formulas, with a clear account of what they can and cannot tell you.",
"keywords": ["ideal weight calculator","healthy weight range","weight for height","devine formula","BMI weight range"],
"formula": "Devine, Robinson, Miller and Hamwi formulas, plus the BMI 18.5–25 range",
"inputs": [{"key":"sex","label":"Sex assigned at birth","type":"select","options":[{"value":"male","label":"Male"},{"value":"female","label":"Female"}],"default":"male"},{"key":"system","label":"Units","type":"select","options":[{"value":"metric","label":"Metric (cm)"},{"value":"imperial","label":"Imperial (in)"}],"default":"metric"},{"key":"height","label":"Height","type":"number","default":175,"min":100,"max":250}],
"compute": ({ sex, system, height }) => {
      const cm = (Number(height) || 0) * (system === 'imperial' ? 2.54 : 1);
      if (cm < 120 || cm > 230) return { note: 'Enter a height between about 120 cm and 230 cm.' };
      const inchesOver5ft = Math.max(0, (cm - 152.4) / 2.54);
      const male = sex === 'male';

      const devine   = (male ? 50   : 45.5) + 2.3   * inchesOver5ft;
      const robinson = (male ? 52   : 49)   + 1.9   * inchesOver5ft;
      const miller   = (male ? 56.2 : 53.1) + 1.41  * inchesOver5ft;
      const hamwi    = (male ? 48   : 45.5) + 2.7   * inchesOver5ft;

      const m = cm / 100;
      const bmiLow = 18.5 * m * m, bmiHigh = 24.9 * m * m;
      const avg = (devine + robinson + miller + hamwi) / 4;

      return {
        bmiRange: `${bmiLow.toFixed(1)} – ${bmiHigh.toFixed(1)} kg`,
        formulaAverage: avg,
        devine, robinson, miller, hamwi,
        spread: Math.max(devine, robinson, miller, hamwi) - Math.min(devine, robinson, miller, hamwi),
        note: ''
      };
    },
"outputs": [{"key":"bmiRange","label":"Range for BMI 18.5–24.9","format":"text","primary":true},{"key":"formulaAverage","label":"Average of the four formulas","format":"number","unit":"kg"},{"key":"devine","label":"Devine (1974)","format":"number","unit":"kg"},{"key":"robinson","label":"Robinson (1983)","format":"number","unit":"kg"},{"key":"miller","label":"Miller (1983)","format":"number","unit":"kg"},{"key":"hamwi","label":"Hamwi (1964)","format":"number","unit":"kg"},{"key":"spread","label":"Disagreement between formulas","format":"number","unit":"kg"},{"key":"note","label":"","format":"text"}],
"tips": ["The four formulas are shown side by side deliberately: they routinely disagree by five kilograms or more for the same height, which is the clearest evidence that none of them is authoritative.","Devine and Hamwi were written to calculate drug dosages, not to advise anyone on their weight. They were never intended for this use.","None of these formulas accounts for build, muscle mass, age or ethnicity. A muscular person will read as \"over\" every one of them while being perfectly healthy.","The BMI range is broad on purpose. Health outcomes vary far more within it than the range boundaries suggest, and the edges are not cliffs.","There is no single correct weight for a given height. If you are trying to decide what weight is right for you, that is a conversation with a clinician who knows your history, not an output of a formula."],
"faq": [{"q":"Which formula should I trust?","a":"None of them, individually. They are shown together to make the disagreement visible. If you need a clinically meaningful assessment, a GP will consider blood pressure, blood markers, fitness, family history and how you actually feel — none of which a height-based formula can see."},{"q":"I am outside every range. Is that a problem?","a":"Not necessarily, and not something a calculator can determine. Athletes, older adults and people with different builds sit outside these ranges routinely while being healthy. If you are concerned, that is worth raising with a GP rather than resolving with arithmetic."}]
};
})();