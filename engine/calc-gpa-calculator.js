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
window.TOOLS["gpa-calculator"] = {
"title": "GPA Calculator",
"category": "utilities",
"description": "Calculate weighted and unweighted grade point average from course grades and credits.",
"keywords": ["GPA calculator","grade point average","weighted GPA","college GPA","semester GPA","CGPA"],
"formula": "GPA = Σ(grade points × credits) / Σ credits",
"inputs": [{"key":"grades","label":"Grades (comma separated: A, B+, 3.7 …)","type":"text","default":"A, B+, A-, B, C+"},{"key":"credits","label":"Credits (optional, same order)","type":"text","default":"3, 4, 3, 3, 2"},{"key":"scale","label":"Scale","type":"select","options":[{"value":"4","label":"4.0 scale (US)"},{"value":"10","label":"10.0 scale (India CGPA)"},{"value":"5","label":"5.0 scale (weighted)"}],"default":"4"}],
"compute": ({ grades, credits, scale }) => {
      const MAP = {
        'A+': 4.0, 'A': 4.0, 'A-': 3.7,
        'B+': 3.3, 'B': 3.0, 'B-': 2.7,
        'C+': 2.3, 'C': 2.0, 'C-': 1.7,
        'D+': 1.3, 'D': 1.0, 'D-': 0.7, 'F': 0.0
      };
      const list = String(grades || '').split(/[\s,;]+/).filter(Boolean);
      if (!list.length) return { note: 'Enter some grades.' };

      const points = list.map(g => {
        const up = g.toUpperCase();
        if (MAP[up] !== undefined) return MAP[up];
        const n = Number(g);
        return isFinite(n) ? n : null;
      });
      if (points.some(p => p === null)) {
        return { note: 'Use letter grades (A, B+, C-) or numeric grade points. One entry was not recognised.' };
      }

      const cr = String(credits || '').split(/[\s,;]+/).map(Number).filter(n => isFinite(n) && n > 0);
      const weighted = cr.length === list.length;
      const totalCredits = weighted ? cr.reduce((s, c) => s + c, 0) : list.length;
      const totalPoints = weighted
        ? points.reduce((s, p, i) => s + p * cr[i], 0)
        : points.reduce((s, p) => s + p, 0);

      const gpa4 = totalCredits ? totalPoints / totalCredits : 0;
      const factor = Number(scale) / 4;

      return {
        gpa: gpa4 * (Number(scale) === 4 ? 1 : factor),
        gpa4,
        percentage: (gpa4 / 4) * 100,
        courses: list.length,
        totalCredits,
        qualityPoints: totalPoints,
        method: weighted ? 'Weighted by credits' : 'Unweighted — one credit per course',
        note: cr.length && cr.length !== list.length
          ? `You gave ${cr.length} credit values for ${list.length} grades, so the result is unweighted.` : ''
      };
    },
"outputs": [{"key":"gpa","label":"GPA","format":"number","primary":true},{"key":"gpa4","label":"On the 4.0 scale","format":"number"},{"key":"percentage","label":"Approximate percentage","format":"percent"},{"key":"method","label":"Method","format":"text"},{"key":"courses","label":"Courses counted","format":"number"},{"key":"totalCredits","label":"Total credits","format":"number"},{"key":"qualityPoints","label":"Total quality points","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Give credits to weight by course size. Without them every course counts equally, which usually understates a heavy module.","Grade-to-point mappings differ between institutions, particularly for A+ and for pass/fail courses. Check your handbook.","Scale conversion here is proportional. Many institutions publish their own conversion table, which will not always match."],
"faq": [{"q":"Is the percentage conversion official?","a":"No. Percentage-to-GPA mappings vary by country and institution, and some use conversion tables rather than a straight proportion. Use the figure as a rough indication and quote your official transcript for applications."}]
};
})();