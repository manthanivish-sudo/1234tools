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
window.TOOLS["business-days"] = {
"title": "Business Days Calculator",
"category": "time",
"description": "Count working days between two dates, or add working days to a date, excluding weekends and holidays.",
"keywords": ["business days calculator","working days between dates","add business days","workdays calculator"],
"formula": "weekdays only, minus any dates you list as holidays",
"inputs": [{"key":"start","label":"Start date","type":"date","default":"TODAY"},{"key":"mode","label":"Mode","type":"select","options":[{"value":"between","label":"Count business days until an end date"},{"value":"add","label":"Add business days to the start date"}],"default":"between"},{"key":"end","label":"End date (count mode)","type":"date","default":"TODAY"},{"key":"add","label":"Business days to add","type":"number","default":10},{"key":"holidays","label":"Holidays (YYYY-MM-DD, comma separated)","type":"text","default":""}],
"compute": ({ start, mode, end, add, holidays }) => {
      const d0 = new Date(start);
      if (isNaN(d0)) return { note: 'Enter a valid start date.' };
      const hol = new Set(String(holidays || '').split(/[\s,;]+/).filter(Boolean));
      const isWork = (d) => {
        const day = d.getDay();
        if (day === 0 || day === 6) return false;
        return !hol.has(d.toISOString().slice(0, 10));
      };
      const MS = 86400000;

      if (mode === 'add') {
        const n = Math.max(0, Math.min(10000, Math.round(Number(add) || 0)));
        const cur = new Date(d0);
        let counted = 0, guard = 0;
        while (counted < n && guard < 100000) {
          cur.setDate(cur.getDate() + 1);
          guard++;
          if (isWork(cur)) counted++;
        }
        return {
          result: cur.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          iso: cur.toISOString().slice(0, 10),
          businessDays: n,
          calendarDays: Math.round((cur - d0) / MS),
          holidaysUsed: hol.size,
          note: ''
        };
      }

      const d1 = new Date(end);
      if (isNaN(d1)) return { note: 'Enter a valid end date.' };
      const [a, b] = d0 <= d1 ? [d0, d1] : [d1, d0];
      const total = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
                                Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / MS);
      if (total > 40000) return { note: 'That range is over a century — narrow it down.' };

      let work = 0, weekend = 0, holidayHits = 0;
      const cur = new Date(a);
      for (let i = 0; i < total; i++) {
        const day = cur.getDay();
        if (day === 0 || day === 6) weekend++;
        else if (hol.has(cur.toISOString().slice(0, 10))) holidayHits++;
        else work++;
        cur.setDate(cur.getDate() + 1);
      }
      return {
        result: `${work} business days`,
        businessDays: work,
        calendarDays: total,
        weekendDays: weekend,
        holidaysUsed: holidayHits,
        weeks: total / 7,
        note: ''
      };
    },
"outputs": [{"key":"result","label":"Result","format":"text","primary":true},{"key":"iso","label":"Resulting date","format":"text"},{"key":"businessDays","label":"Business days","format":"number"},{"key":"calendarDays","label":"Calendar days","format":"number"},{"key":"weekendDays","label":"Weekend days","format":"number"},{"key":"holidaysUsed","label":"Holidays excluded","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Public holidays vary by country and often by region, so they are yours to supply rather than assumed.","Counting is exclusive of the end date, matching how notice periods and payment terms are usually written.","When adding business days, the start date itself is not counted — day one is the next working day."],
"faq": [{"q":"Should the start date count?","a":"Conventions differ, which is exactly why disputes happen. This tool excludes it. Contracts saying \"within 10 business days of receipt\" usually mean the same, but check the wording rather than assuming."}]
};
})();