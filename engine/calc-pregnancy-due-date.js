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
window.TOOLS["pregnancy-due-date"] = {
"title": "Pregnancy Due Date Calculator",
"category": "health",
"description": "Estimate a due date from the last menstrual period or conception date, with current gestational age.",
"keywords": ["due date calculator","pregnancy calculator","EDD calculator","gestational age","how many weeks pregnant"],
"formula": "Naegele's rule: LMP + 280 days, adjusted for cycle length",
"inputs": [{"key":"basis","label":"Calculate from","type":"select","options":[{"value":"lmp","label":"First day of last menstrual period"},{"value":"conception","label":"Conception or ovulation date"},{"value":"ivf","label":"IVF transfer date"}],"default":"lmp"},{"key":"date","label":"Date","type":"date","default":"TODAY"},{"key":"cycle","label":"Average cycle length","type":"number","unit":"days","default":28,"min":20,"max":45},{"key":"ivfDay","label":"IVF embryo age at transfer","type":"select","options":[{"value":"3","label":"Day 3"},{"value":"5","label":"Day 5"},{"value":"6","label":"Day 6"}],"default":"5"},{"key":"today","label":"Today’s date","type":"date","default":"TODAY"}],
"compute": ({ basis, date, cycle, ivfDay, today }) => {
      const d = new Date(date), now = new Date(today);
      if (isNaN(d) || isNaN(now)) return { note: 'Enter valid dates.' };
      const MS = 86400000;
      const add = (base, days) => { const x = new Date(base); x.setDate(x.getDate() + days); return x; };

      let lmp;
      if (basis === 'lmp') {
        // Naegele's rule assumes a 28-day cycle; ovulation shifts with cycle length
        lmp = add(d, 28 - Math.max(20, Math.min(45, Number(cycle) || 28)));
      } else if (basis === 'conception') {
        lmp = add(d, -14);
      } else {
        lmp = add(d, -(14 + Number(ivfDay || 5)));
      }

      const due = add(lmp, 280);
      const daysPreg = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
                                   Date.UTC(lmp.getFullYear(), lmp.getMonth(), lmp.getDate())) / MS);
      const weeks = Math.floor(daysPreg / 7), days = daysPreg % 7;
      const fmt = (x) => x.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      let stage = '';
      if (daysPreg < 0) stage = 'That date is in the future.';
      else if (weeks < 13) stage = 'First trimester';
      else if (weeks < 27) stage = 'Second trimester';
      else if (weeks < 42) stage = 'Third trimester';
      else stage = 'Past 42 weeks — this is beyond the usual range';

      return {
        dueDate: fmt(due),
        gestational: daysPreg < 0 ? '—' : `${weeks} weeks and ${days} days`,
        trimester: stage,
        daysRemaining: Math.max(0, Math.round((due - now) / MS)),
        conception: fmt(add(lmp, 14)),
        fullTermFrom: fmt(add(lmp, 273)),
        fullTermTo: fmt(add(lmp, 287)),
        note: ''
      };
    },
"outputs": [{"key":"dueDate","label":"Estimated due date","format":"text","primary":true},{"key":"gestational","label":"Gestational age today","format":"text"},{"key":"trimester","label":"Stage","format":"text"},{"key":"daysRemaining","label":"Days to the estimated date","format":"number"},{"key":"conception","label":"Estimated conception date","format":"text"},{"key":"fullTermFrom","label":"Full term from","format":"text"},{"key":"fullTermTo","label":"Full term to","format":"text"},{"key":"note","label":"","format":"text"}],
"tips": ["Only about 4% of babies arrive on the estimated due date. Around 80% arrive within the two weeks either side of it, which is why the full-term window matters more than the single date.","Naegele’s rule assumes a 28-day cycle with ovulation on day 14. Adjusting the cycle length above corrects for that, but ovulation timing varies between cycles even for regular ones.","A dating ultrasound in the first trimester is more accurate than any calculation from dates, and is what your maternity team will use.","Gestational age is counted from the first day of the last period, not from conception — which is why you are considered \"two weeks pregnant\" at conception."],
"faq": [{"q":"How accurate is this?","a":"It is arithmetic on the dates you supply, and inherits any uncertainty in them. First-trimester ultrasound dating is accurate to within about five days and supersedes calculated dates. Use this for orientation, not for decisions — your midwife or doctor will confirm dating."},{"q":"My cycle is irregular. Does this still work?","a":"Less well. Naegele’s rule depends on predictable ovulation. With irregular cycles the estimate can be out by a week or more, and early ultrasound dating becomes considerably more important."}]
};
})();