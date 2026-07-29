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
window.TOOLS["shoe-size-converter"] = {
"title": "Shoe Size Converter",
"category": "utilities",
"description": "Convert shoe sizes between UK, US, EU, Japan and foot length in centimetres.",
"keywords": ["shoe size converter","UK to US shoe size","EU shoe size","shoe size chart","foot length to shoe size"],
"formula": "derived from foot length; each system uses a different origin and increment",
"inputs": [{"key":"size","label":"Size","type":"number","default":9,"min":0,"step":0.5},{"key":"system","label":"From system","type":"select","options":[{"value":"uk","label":"UK"},{"value":"usm","label":"US Men"},{"value":"usw","label":"US Women"},{"value":"eu","label":"EU"},{"value":"cm","label":"Foot length (cm)"}],"default":"uk"}],
"compute": ({ size, system }) => {
      const s = Number(size) || 0;
      if (s <= 0) return { note: 'Enter a size above zero.' };

      /* Everything is normalised to foot length first.
         UK uses barleycorns — three sizes per inch — measured on the last,
         which runs about two-thirds of an inch longer than the foot:
             foot inches = (UK + 23) / 3
         EU uses Paris points of two-thirds of a centimetre, also on the last:
             EU = 1.5 x (foot cm + 1.5) */
      let cm;
      if (system === 'cm')       cm = s;
      else if (system === 'uk')  cm = ((s + 23) / 3) * 2.54;
      else if (system === 'usm') cm = ((s - 1 + 23) / 3) * 2.54;
      else if (system === 'usw') cm = ((s - 2.5 + 23) / 3) * 2.54;
      else                       cm = (s / 1.5) - 1.5;          // from EU

      const uk = ((cm / 2.54) * 3) - 23;
      const half = (x) => Math.round(x * 2) / 2;

      return {
        uk: half(uk),
        usMen: half(uk + 1),
        usWomen: half(uk + 2.5),
        eu: half(1.5 * (cm + 1.5)),
        japan: half(cm),
        cm: Math.round(cm * 10) / 10,
        inches: Math.round((cm / 2.54) * 100) / 100,
        note: ''
      };
    },
"outputs": [{"key":"uk","label":"UK","format":"number","primary":true},{"key":"usMen","label":"US Men","format":"number"},{"key":"usWomen","label":"US Women","format":"number"},{"key":"eu","label":"EU","format":"number"},{"key":"japan","label":"Japan / cm","format":"number"},{"key":"cm","label":"Foot length","format":"number","unit":"cm"},{"key":"inches","label":"Foot length","format":"number","unit":"in"},{"key":"note","label":"","format":"text"}],
"tips": ["Shoe sizing is not standardised. Two pairs marked the same size from different brands can differ by a full size.","Measure your foot in the evening, when it is at its largest, standing with weight on it.","EU sizing uses Paris points of two-thirds of a centimetre; UK and US use barleycorns of a third of an inch. They do not align cleanly, which is why conversions are approximate.","Treat any conversion as a starting point, not a guarantee. Check the specific brand’s own chart where one exists."],
"faq": [{"q":"Why is the EU size sometimes half a size off?","a":"Because the two systems increment by different amounts and do not share an origin. Converting between them almost never lands exactly, so charts round — and different charts round differently."}]
};
})();