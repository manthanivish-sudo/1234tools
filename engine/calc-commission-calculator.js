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
window.TOOLS["commission-calculator"] = {
"currency": "GBP",
"title": "Sales Commission Calculator",
"category": "business",
"description": "Flat, tiered and threshold-based commission, with on-target earnings and effective rate.",
"keywords": ["commission calculator","sales commission","tiered commission","OTE calculator","sales compensation"],
"formula": "commission = Σ (sales in tier × tier rate)",
"inputs": [{"key":"sales","label":"Total sales","type":"number","unit":"£","default":120000,"min":0},{"key":"structure","label":"Structure","type":"select","options":[{"value":"flat","label":"Flat rate"},{"value":"threshold","label":"Above a threshold only"},{"value":"tiered","label":"Tiered (accelerating)"}],"default":"tiered"},{"key":"rate","label":"Base commission rate","type":"number","unit":"%","default":5,"step":0.1},{"key":"threshold","label":"Threshold / quota","type":"number","unit":"£","default":50000,"min":0},{"key":"base","label":"Base salary","type":"number","unit":"£","default":30000,"min":0}],
"compute": ({ sales, structure, rate, threshold, base }) => {
      let commission = 0;
      const rows = [];

      if (structure === 'flat') {
        commission = sales * (rate / 100);
        rows.push(['All sales', fmtC(sales), rate.toFixed(2) + '%', fmtC(commission)]);
      } else if (structure === 'threshold') {
        const eligible = Math.max(0, sales - threshold);
        commission = eligible * (rate / 100);
        rows.push(['Below quota', fmtC(Math.min(sales, threshold)), '0.00%', fmtC(0)]);
        rows.push(['Above quota', fmtC(eligible), rate.toFixed(2) + '%', fmtC(commission)]);
      } else {
        // accelerating: base rate to quota, 1.5x to 2x quota, 2x beyond
        const tiers = [
          { from: 0, to: threshold, mult: 1 },
          { from: threshold, to: threshold * 2, mult: 1.5 },
          { from: threshold * 2, to: Infinity, mult: 2 }
        ];
        tiers.forEach((t, i) => {
          const amt = Math.max(0, Math.min(sales, t.to) - t.from);
          if (amt <= 0) return;
          const r = (rate / 100) * t.mult;
          const c = amt * r;
          commission += c;
          rows.push([`Tier ${i + 1} (${(t.mult * rate).toFixed(1)}%)`, fmtC(amt), (r * 100).toFixed(2) + '%', fmtC(c)]);
        });
      }

      return {
        commission,
        total: base + commission,
        effectiveRate: sales ? (commission / sales) * 100 : 0,
        attainment: threshold ? (sales / threshold) * 100 : NaN,
        commissionShare: (base + commission) ? (commission / (base + commission)) * 100 : 0,
        _table: { head: ['Tier', 'Sales', 'Rate', 'Commission'], rows }
      };
    },
"outputs": [{"key":"commission","label":"Commission earned","format":"currency","primary":true},{"key":"total","label":"Total earnings (base + commission)","format":"currency"},{"key":"effectiveRate","label":"Effective commission rate","format":"percent"},{"key":"attainment","label":"Quota attainment","format":"percent"},{"key":"commissionShare","label":"Variable share of pay","format":"percent"}],
"tips": ["Accelerators reward over-performance and are usually cheaper than raising the base rate, because they only pay out on the sales you most want.","A common split is 50/50 base to variable for new business roles, and 70/30 or 80/20 for account management.","Commission on revenue can push a team towards discounting. Paying on gross profit removes that incentive."],
"faq": [{"q":"Should commission be paid on revenue or profit?","a":"Profit aligns the seller with the business, since discounting then costs them directly. Revenue is simpler to administer and easier for sellers to forecast. Many companies compromise by paying on revenue but capping the discount a rep can authorise."}]
};
})();