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
window.TOOLS["heart-rate-zones"] = {
"title": "Heart Rate Zone Calculator",
"category": "health",
"description": "Training heart rate zones from maximum or reserve heart rate, with what each zone is for.",
"keywords": ["heart rate zones","target heart rate","max heart rate calculator","fat burning zone","training zones"],
"formula": "Tanaka: HRmax = 208 − 0.7 × age  ·  Karvonen uses heart rate reserve",
"inputs": [{"key":"age","label":"Age","type":"number","unit":"years","default":35,"min":10,"max":100},{"key":"resting","label":"Resting heart rate (optional)","type":"number","unit":"bpm","default":60,"min":0,"max":120},{"key":"method","label":"Method","type":"select","options":[{"value":"tanaka","label":"Tanaka — 208 − 0.7 × age (more accurate)"},{"value":"classic","label":"Classic — 220 − age"}],"default":"tanaka"}],
"compute": ({ age, resting, method }) => {
      const a = Number(age) || 0;
      if (a < 10 || a > 100) return { note: 'Enter an age between 10 and 100.' };
      const hrMax = method === 'classic' ? 220 - a : 208 - 0.7 * a;
      const rest = Math.max(0, Math.min(120, Number(resting) || 0));
      const reserve = rest ? hrMax - rest : 0;

      // Karvonen when a resting rate is given, otherwise a plain percentage of max
      const zone = (lo, hi) => rest
        ? `${Math.round(reserve * lo + rest)} – ${Math.round(reserve * hi + rest)} bpm`
        : `${Math.round(hrMax * lo)} – ${Math.round(hrMax * hi)} bpm`;

      return {
        hrMax: Math.round(hrMax),
        zone1: zone(0.50, 0.60),
        zone2: zone(0.60, 0.70),
        zone3: zone(0.70, 0.80),
        zone4: zone(0.80, 0.90),
        zone5: zone(0.90, 1.00),
        reserve: rest ? Math.round(reserve) : NaN,
        basis: rest ? 'Karvonen, using heart rate reserve' : 'Percentage of maximum heart rate',
        note: ''
      };
    },
"outputs": [{"key":"hrMax","label":"Estimated maximum heart rate","format":"number","unit":"bpm","primary":true},{"key":"basis","label":"Method used","format":"text"},{"key":"zone1","label":"Zone 1 — very light, recovery","format":"text"},{"key":"zone2","label":"Zone 2 — light, endurance base","format":"text"},{"key":"zone3","label":"Zone 3 — moderate, aerobic","format":"text"},{"key":"zone4","label":"Zone 4 — hard, threshold","format":"text"},{"key":"zone5","label":"Zone 5 — maximum, short intervals","format":"text"},{"key":"reserve","label":"Heart rate reserve","format":"number","unit":"bpm"},{"key":"note","label":"","format":"text"}],
"tips": ["Age-based maximum heart rate is a population average with a standard deviation of about 10–12 bpm. Your true maximum could reasonably be twenty beats either side of this estimate.","Giving a resting heart rate switches to the Karvonen method, which accounts for fitness and gives more useful zones than a flat percentage of maximum.","The \"fat burning zone\" is a persistent misunderstanding. Lower intensities use a higher proportion of fat but fewer total calories; for most goals, total work done matters more.","Measure resting heart rate first thing in the morning, before getting up, averaged over several days.","If you have a heart condition, take medication affecting heart rate such as beta blockers, or are returning to exercise after a long break, discuss target zones with a clinician — these formulas will not apply to you."],
"faq": [{"q":"Why 208 − 0.7 × age rather than 220 − age?","a":"The 220 − age rule was never derived from careful research and systematically underestimates maximum heart rate in older adults. The Tanaka equation comes from a meta-analysis and fits observed data better across the age range."}]
};
})();