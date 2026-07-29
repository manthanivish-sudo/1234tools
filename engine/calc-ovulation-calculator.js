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
window.TOOLS["ovulation-calculator"] = {
"title": "Ovulation & Fertile Window Calculator",
"category": "health",
"description": "Estimate ovulation and the fertile window from cycle length and last period date.",
"keywords": ["ovulation calculator","fertile window","ovulation date","fertility calculator","period tracker"],
"formula": "ovulation ≈ next period − 14 days; fertile window is the five days before through the day after",
"inputs": [{"key":"lastPeriod","label":"First day of last period","type":"date","default":"TODAY"},{"key":"cycle","label":"Average cycle length","type":"number","unit":"days","default":28,"min":20,"max":45},{"key":"luteal","label":"Luteal phase length","type":"number","unit":"days","default":14,"min":9,"max":17},{"key":"cycles","label":"Show this many cycles","type":"number","default":3,"min":1,"max":12}],
"compute": ({ lastPeriod, cycle, luteal, cycles }) => {
      const d = new Date(lastPeriod);
      if (isNaN(d)) return { note: 'Enter a valid date.' };
      const cyc = Math.max(20, Math.min(45, Math.round(Number(cycle) || 28)));
      const lut = Math.max(9, Math.min(17, Math.round(Number(luteal) || 14)));
      const n = Math.max(1, Math.min(12, Math.round(Number(cycles) || 3)));

      const add = (base, days) => { const x = new Date(base); x.setDate(x.getDate() + days); return x; };
      const fmt = (x) => x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const shortF = (x) => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      const rows = [];
      for (let i = 0; i < n; i++) {
        const start = add(d, cyc * i);
        const ov = add(start, cyc - lut);
        rows.push([
          fmt(start).replace(/,.*?(\d)/, ' $1'),
          `${shortF(add(ov, -5))} – ${shortF(add(ov, 1))}`,
          fmt(ov).replace(/,.*?(\d)/, ' $1'),
          shortF(add(start, cyc))
        ]);
      }

      const ov1 = add(d, cyc - lut);
      return {
        ovulation: fmt(ov1),
        fertileWindow: `${fmt(add(ov1, -5))} to ${fmt(add(ov1, 1))}`,
        nextPeriod: fmt(add(d, cyc)),
        cycleDay: Math.floor((Date.now() - d) / 86400000) + 1,
        note: '',
        _table: { head: ['Period starts', 'Fertile window', 'Ovulation (est.)', 'Next period'], rows }
      };
    },
"outputs": [{"key":"fertileWindow","label":"Estimated fertile window","format":"text","primary":true},{"key":"ovulation","label":"Estimated ovulation","format":"text"},{"key":"nextPeriod","label":"Next period expected","format":"text"},{"key":"cycleDay","label":"Current cycle day","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["The fertile window runs from about five days before ovulation to the day after, because sperm can survive several days while an egg is viable for roughly 24 hours.","Ovulation timing varies between cycles even for people with regular periods. Calendar prediction alone is a rough guide, not a reliable signal.","Ovulation predictor kits, basal body temperature tracking and cervical mucus observation all give better information than dates alone.","**This is not a contraceptive method.** Calendar-based prediction has a high failure rate for avoiding pregnancy — pregnancies occur outside the predicted window regularly. Use proper contraception if that is the goal.","If you have been trying to conceive for a year without success, or six months if over 35, that is the usual point to speak to a GP."],
"faq": [{"q":"Can I use this to avoid pregnancy?","a":"No. Calendar-based prediction is among the least reliable approaches to avoiding pregnancy, because ovulation shifts unpredictably between cycles. If avoiding pregnancy matters, use a method with a proper effectiveness rate and speak to a healthcare provider about the options."},{"q":"Why is the luteal phase adjustable?","a":"Because the phase after ovulation is more consistent in length than the phase before it, typically 12–16 days. If you know yours from tracking, entering it gives a better estimate than assuming 14."}]
};
})();