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
window.TOOLS["hra-exemption"] = {
"currency": "INR",
"title": "HRA Exemption Calculator",
"category": "india",
"description": "Work out the house rent allowance exemption under Section 10(13A) — the lowest of three tests.",
"keywords": ["HRA calculator","HRA exemption","house rent allowance","section 10 13A","HRA tax exemption"],
"formula": "exempt = least of (actual HRA, rent − 10% salary, 50%/40% of salary)",
"inputs": [{"key":"basic","label":"Basic salary + DA (annual)","type":"number","unit":"₹","default":600000,"min":0},{"key":"hra","label":"HRA received (annual)","type":"number","unit":"₹","default":240000,"min":0},{"key":"rent","label":"Rent paid (annual)","type":"number","unit":"₹","default":300000,"min":0},{"key":"metro","label":"City","type":"select","options":[{"value":"metro","label":"Metro (Delhi, Mumbai, Kolkata, Chennai)"},{"value":"non","label":"Non-metro"}],"default":"metro"}],
"compute": ({ basic, hra, rent, metro }) => {
      const pct = metro === 'metro' ? 0.5 : 0.4;
      const t1 = Number(hra) || 0;
      const t2 = Math.max(0, (Number(rent) || 0) - 0.10 * (Number(basic) || 0));
      const t3 = (Number(basic) || 0) * pct;
      const exempt = Math.min(t1, t2, t3);
      const which = exempt === t1 ? 'Actual HRA received'
                  : exempt === t2 ? 'Rent paid minus 10% of salary'
                  : `${pct * 100}% of salary`;
      return {
        exempt, taxable: t1 - exempt, t1, t2, t3, which,
        _table: {
          head: ['Test', 'Amount'],
          rows: [
            ['1. Actual HRA received', fmtR(t1)],
            ['2. Rent paid − 10% of salary', fmtR(t2)],
            [`3. ${pct * 100}% of salary (${metro === 'metro' ? 'metro' : 'non-metro'})`, fmtR(t3)],
            ['Exempt (lowest of the three)', fmtR(exempt)],
            ['Taxable portion of HRA', fmtR(t1 - exempt)]
          ]
        }
      };
    },
"outputs": [{"key":"exempt","label":"HRA exempt from tax","format":"currency","primary":true},{"key":"taxable","label":"Taxable HRA","format":"currency"},{"key":"which","label":"Limiting test","format":"text"},{"key":"t1","label":"Test 1 — actual HRA","format":"currency"},{"key":"t2","label":"Test 2 — rent − 10% salary","format":"currency"},{"key":"t3","label":"Test 3 — % of salary","format":"currency"}],
"tips": ["HRA exemption is only available under the old regime. The new regime removes it entirely, which is often what decides between the two.","\"Salary\" here means basic pay plus dearness allowance that forms part of retirement benefits, not your full CTC.","If annual rent exceeds ₹1,00,000 you must report the landlord’s PAN to your employer.","Paying rent to a parent is allowed if the arrangement is genuine, the parent owns the property and declares the rental income. Keep receipts and bank transfers."],
"faq": [{"q":"Can I claim HRA and a home loan together?","a":"Yes, if the circumstances are genuine — for example you own a property in one city and rent in another for work. Claiming both for the same city and property invites scrutiny."}]
};
})();