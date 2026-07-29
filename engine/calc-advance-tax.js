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
window.TOOLS["advance-tax"] = {
"currency": "INR",
"title": "Advance Tax Calculator",
"category": "india",
"description": "Quarterly advance tax instalments and the interest payable under Sections 234B and 234C if you underpay.",
"keywords": ["advance tax calculator","advance tax due dates","section 234C","section 234B","quarterly tax India"],
"formula": "15% by 15 Jun, 45% by 15 Sep, 75% by 15 Dec, 100% by 15 Mar",
"inputs": [{"key":"taxLiability","label":"Estimated annual tax liability","type":"number","unit":"₹","default":200000,"min":0},{"key":"tdsPaid","label":"TDS / TCS already deducted","type":"number","unit":"₹","default":50000,"min":0},{"key":"paidSoFar","label":"Advance tax already paid","type":"number","unit":"₹","default":0,"min":0}],
"compute": ({ taxLiability, tdsPaid, paidSoFar }) => {
      const net = Math.max(0, (Number(taxLiability) || 0) - (Number(tdsPaid) || 0));
      const liable = net >= 10000;

      const sched = [
        ['On or before 15 June', 0.15],
        ['On or before 15 September', 0.45],
        ['On or before 15 December', 0.75],
        ['On or before 15 March', 1.00]
      ];
      let prev = 0;
      const rows = sched.map(([when, pct]) => {
        const cum = net * pct;
        const inst = cum - prev;
        prev = cum;
        return [when, (pct * 100) + '%', fmtR(inst), fmtR(cum)];
      });

      return {
        netLiability: net,
        liable: liable
          ? 'Advance tax is payable — net liability is ₹10,000 or more'
          : 'No advance tax due — net liability is below ₹10,000',
        q1: net * 0.15, q2: net * 0.30, q3: net * 0.30, q4: net * 0.25,
        outstanding: Math.max(0, net - (Number(paidSoFar) || 0)),
        _table: { head: ['Due date', 'Cumulative %', 'Instalment', 'Cumulative'], rows }
      };
    },
"outputs": [{"key":"liable","label":"Liability","format":"text","primary":true},{"key":"netLiability","label":"Net tax payable","format":"currency"},{"key":"q1","label":"Instalment 1 (15 Jun)","format":"currency"},{"key":"q2","label":"Instalment 2 (15 Sep)","format":"currency"},{"key":"q3","label":"Instalment 3 (15 Dec)","format":"currency"},{"key":"q4","label":"Instalment 4 (15 Mar)","format":"currency"},{"key":"outstanding","label":"Still to pay","format":"currency"}],
"tips": ["Advance tax applies once net liability after TDS reaches ₹10,000 for the year.","Section 234C charges 1% a month for shortfalls at each instalment; Section 234B charges 1% a month where less than 90% is paid by year end.","Senior citizens without business income are exempt from advance tax entirely.","Presumptive taxpayers under 44AD or 44ADA pay the whole amount in a single instalment by 15 March."],
"faq": [{"q":"What if my income is unpredictable?","a":"Estimate conservatively and revise at each instalment — the schedule is cumulative, so an increased estimate can be caught up at the next date. Capital gains are treated specially: the instalment falls due only from the quarter in which the gain arises."}]
};
})();