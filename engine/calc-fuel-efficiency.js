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
window.TOOLS["fuel-efficiency"] = {
"currency": "GBP",
"title": "Fuel Efficiency & Trip Cost Calculator",
"category": "utilities",
"icon": "⛽",
"description": "Convert between MPG and L/100km, and calculate the fuel cost of a journey.",
"keywords": ["mpg to l/100km","fuel economy","trip cost calculator","fuel consumption"],
"formula": "L/100km = 235.214583 / MPG(US)",
"inputs": [{"key":"efficiency","label":"Fuel Efficiency","type":"number","default":30,"min":0},{"key":"unit","label":"Efficiency Unit","type":"select","options":[{"value":"mpgus","label":"MPG (US)"},{"value":"mpguk","label":"MPG (Imperial)"},{"value":"l100","label":"L/100 km"},{"value":"kml","label":"km per Litre"}],"default":"mpgus"},{"key":"distance","label":"Trip Distance","type":"number","default":300,"min":0},{"key":"distUnit","label":"Distance Unit","type":"select","options":[{"value":"mi","label":"Miles"},{"value":"km","label":"Kilometres"}],"default":"mi"},{"key":"price","label":"Fuel Price per Unit","type":"number","unit":"£","default":3.5,"min":0,"step":0.01},{"key":"priceUnit","label":"Price Per","type":"select","options":[{"value":"gal","label":"US Gallon"},{"value":"l","label":"Litre"}],"default":"gal"}],
"compute": ({ efficiency, unit, distance, distUnit, price, priceUnit }) => {
      // Normalise everything to litres per 100 km.
      let l100;
      if (unit === 'mpgus') l100 = efficiency ? 235.214583 / efficiency : Infinity;
      else if (unit === 'mpguk') l100 = efficiency ? 282.481 / efficiency : Infinity;
      else if (unit === 'kml') l100 = efficiency ? 100 / efficiency : Infinity;
      else l100 = efficiency;

      const km = distUnit === 'mi' ? distance * 1.609344 : distance;
      const litres = (l100 / 100) * km;
      const pricePerLitre = priceUnit === 'gal' ? price / 3.785411784 : price;

      return {
        l100,
        mpgus: l100 ? 235.214583 / l100 : Infinity,
        mpguk: l100 ? 282.481 / l100 : Infinity,
        kml: l100 ? 100 / l100 : Infinity,
        litres,
        gallons: litres / 3.785411784,
        cost: litres * pricePerLitre,
        costPerDistance: distance ? (litres * pricePerLitre) / distance : 0
      };
    },
"outputs": [{"key":"cost","label":"Total Fuel Cost","format":"currency","primary":true},{"key":"litres","label":"Fuel Needed","format":"number","unit":"L"},{"key":"gallons","label":"Fuel Needed","format":"number","unit":"US gal"},{"key":"l100","label":"Consumption","format":"number","unit":"L/100km"},{"key":"mpgus","label":"Efficiency","format":"number","unit":"MPG (US)"},{"key":"mpguk","label":"Efficiency","format":"number","unit":"MPG (UK)"},{"key":"kml","label":"Efficiency","format":"number","unit":"km/L"},{"key":"costPerDistance","label":"Cost per Unit Distance","format":"currency"}],
"tips": ["MPG and L/100km are inverse measures: higher MPG is better, lower L/100km is better.","A US gallon is about 3.785 L; an Imperial gallon is about 4.546 L, so UK MPG figures look ~20% better than US figures for the same car.","Improving from 15 to 20 MPG saves more fuel per mile than improving from 40 to 50 MPG — the inverse relationship is counterintuitive."],
"faq": [{"q":"Where does the constant 235.214583 come from?","a":"It is 100 × 3.785411784 (litres per US gallon) ÷ 1.609344 (km per mile), the factor that converts miles-per-gallon into litres-per-100-kilometres."}]
};
})();