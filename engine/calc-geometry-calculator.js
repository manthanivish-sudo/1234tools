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
window.TOOLS["geometry-calculator"] = {
"title": "Area & Volume Calculator",
"category": "mathematics",
"description": "Area, perimeter, surface area and volume for common 2D and 3D shapes.",
"keywords": ["area calculator","volume calculator","circle area","cylinder volume","surface area calculator","geometry calculator"],
"formula": "circle A = πr²  ·  cylinder V = πr²h  ·  sphere V = 4/3 πr³",
"inputs": [{"key":"shape","label":"Shape","type":"select","options":[{"value":"rectangle","label":"Rectangle"},{"value":"triangle","label":"Triangle"},{"value":"circle","label":"Circle"},{"value":"trapezium","label":"Trapezium"},{"value":"cuboid","label":"Cuboid (box)"},{"value":"cylinder","label":"Cylinder"},{"value":"sphere","label":"Sphere"},{"value":"cone","label":"Cone"}],"default":"circle"},{"key":"a","label":"Length / radius / base","type":"number","default":5,"min":0},{"key":"b","label":"Width / height","type":"number","default":3,"min":0},{"key":"c","label":"Depth / second parallel side","type":"number","default":4,"min":0}],
"compute": ({ shape, a, b, c }) => {
      const A = Math.max(0, Number(a) || 0), B = Math.max(0, Number(b) || 0), C = Math.max(0, Number(c) || 0);
      const P = Math.PI;
      let area = NaN, perimeter = NaN, volume = NaN, surface = NaN, desc = '';

      switch (shape) {
        case 'rectangle':
          area = A * B; perimeter = 2 * (A + B); desc = 'Rectangle: length × width'; break;
        case 'triangle':
          area = 0.5 * A * B; desc = 'Triangle: ½ × base × height'; break;
        case 'circle':
          area = P * A * A; perimeter = 2 * P * A; desc = 'Circle: πr², circumference 2πr'; break;
        case 'trapezium':
          area = 0.5 * (A + C) * B; desc = 'Trapezium: ½ × (a + b) × height'; break;
        case 'cuboid':
          volume = A * B * C; surface = 2 * (A * B + B * C + A * C); area = A * B;
          desc = 'Cuboid: l × w × d'; break;
        case 'cylinder':
          volume = P * A * A * B; surface = 2 * P * A * (A + B); area = P * A * A;
          desc = 'Cylinder: πr²h'; break;
        case 'sphere':
          volume = (4 / 3) * P * A * A * A; surface = 4 * P * A * A;
          desc = 'Sphere: 4/3 πr³, surface 4πr²'; break;
        case 'cone':
          volume = (1 / 3) * P * A * A * B;
          surface = P * A * (A + Math.sqrt(A * A + B * B));
          area = P * A * A; desc = 'Cone: ⅓πr²h'; break;
      }
      return { area, perimeter, volume, surface, desc };
    },
"outputs": [{"key":"area","label":"Area (or base area)","format":"number","primary":true},{"key":"perimeter","label":"Perimeter / circumference","format":"number"},{"key":"volume","label":"Volume","format":"number"},{"key":"surface","label":"Surface area","format":"number"},{"key":"desc","label":"Formula used","format":"text"}],
"tips": ["Units are whatever you put in. Enter metres and area comes out in square metres, volume in cubic metres.","Only the inputs relevant to the chosen shape are used — a circle ignores width and depth.","For a triangle the second input is the perpendicular height, not the slanted side length."],
"faq": [{"q":"How do I get litres from a volume?","a":"Work in centimetres and divide the cubic centimetres by 1,000, or work in metres and multiply the cubic metres by 1,000. The volume converter handles it either way."}]
};
})();