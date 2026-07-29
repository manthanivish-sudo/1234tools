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
window.TOOLS["body-fat"] = {
"title": "Body Fat Percentage Estimator",
"category": "health",
"description": "Estimate body fat percentage from tape measurements using the US Navy circumference method.",
"keywords": ["body fat calculator","body fat percentage","navy method body fat","lean mass calculator"],
"formula": "US Navy circumference method — a logarithmic fit to tape measurements",
"inputs": [{"key":"sex","label":"Sex assigned at birth","type":"select","options":[{"value":"male","label":"Male"},{"value":"female","label":"Female"}],"default":"male"},{"key":"system","label":"Units","type":"select","options":[{"value":"metric","label":"Metric (cm, kg)"},{"value":"imperial","label":"Imperial (in, lb)"}],"default":"metric"},{"key":"height","label":"Height","type":"number","default":175,"min":0},{"key":"neck","label":"Neck circumference","type":"number","default":38,"min":0},{"key":"waist","label":"Waist circumference (at the navel)","type":"number","default":85,"min":0},{"key":"hip","label":"Hip circumference (widest point, female only)","type":"number","default":95,"min":0},{"key":"weight","label":"Weight (optional, for lean mass)","type":"number","default":70,"min":0}],
"compute": ({ sex, system, height, neck, waist, hip, weight }) => {
      const f = system === 'imperial' ? 2.54 : 1;
      const h = (Number(height) || 0) * f;
      const n = (Number(neck) || 0) * f;
      const w = (Number(waist) || 0) * f;
      const hp = (Number(hip) || 0) * f;
      const kg = (Number(weight) || 0) * (system === 'imperial' ? 0.45359237 : 1);

      if (!h || !n || !w) return { note: 'Height, neck and waist are all needed.' };
      if (sex === 'female' && !hp) return { note: 'The female formula also needs a hip measurement.' };
      if (w <= n) return { note: 'The waist measurement should be larger than the neck. Check both.' };

      let bf;
      if (sex === 'male') {
        bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
      } else {
        bf = 495 / (1.29579 - 0.35004 * Math.log10(w + hp - n) + 0.22100 * Math.log10(h)) - 450;
      }
      if (!isFinite(bf) || bf <= 0 || bf > 70) {
        return { note: 'Those measurements produce an implausible result. Check that each was taken in the stated units and at the stated point.' };
      }

      const fatMass = kg ? kg * (bf / 100) : NaN;
      return {
        bodyFat: bf,
        range: `${(bf - 3.5).toFixed(1)}% – ${(bf + 3.5).toFixed(1)}%`,
        fatMass,
        leanMass: kg ? kg - fatMass : NaN,
        waistHeight: h ? w / h : NaN,
        note: ''
      };
    },
"outputs": [{"key":"bodyFat","label":"Estimated body fat","format":"percent","primary":true},{"key":"range","label":"Likely range (±3.5 points)","format":"text"},{"key":"fatMass","label":"Estimated fat mass","format":"number","unit":"kg"},{"key":"leanMass","label":"Estimated lean mass","format":"number","unit":"kg"},{"key":"waistHeight","label":"Waist-to-height ratio","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["The Navy method is accurate to roughly ±3.5 percentage points against a DEXA scan, and can be further out for very lean or very heavy people. Treat the range as the real answer, not the single figure.","Measure at the same time of day, unclothed at the measurement point, with the tape snug but not compressing. Small differences in tape placement move the result more than most real change does.","Waist-to-height ratio is a simpler measure with better evidence behind it for health risk. Below 0.5 is the usual guidance, and it needs only two measurements.","Body fat percentage is one descriptive number among many. It says nothing about fitness, strength, blood markers or how you feel, and a single reading says nothing at all about a trend."],
"faq": [{"q":"What is a healthy body fat percentage?","a":"Ranges published by fitness organisations vary widely and are not clinical thresholds. Essential fat is roughly 3% for men and 12% for women, below which health is compromised. Beyond that, there is no single healthy figure — it depends on age, sex, genetics and context. A clinician can interpret it alongside things that matter more."},{"q":"Why does my result differ from a smart scale?","a":"Bioelectrical impedance scales estimate from body water, which swings with hydration, food, exercise and time of day. Neither method is a direct measurement. Both are more useful for tracking a direction over months than for a single number today."}]
};
})();