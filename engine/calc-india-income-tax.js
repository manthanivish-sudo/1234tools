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
window.TOOLS["india-income-tax"] = {
"currency": "INR",
"title": "Income Tax Calculator (New vs Old Regime)",
"category": "india",
"description": "Compare tax under both regimes for FY 2026-27, including rebate, surcharge, cess and marginal relief.",
"keywords": ["income tax calculator India","new tax regime","old tax regime","income tax slab","87A rebate","tax calculator FY 2026-27"],
"formula": "tax = slab tax − 87A rebate + surcharge + 4% cess",
"inputs": [{"key":"gross","label":"Gross annual income","type":"number","unit":"₹","default":1500000,"min":0},{"key":"fy","label":"Financial year","type":"select","options":[{"value":"2026-27","label":"FY 2026-27 (AY 2027-28)"},{"value":"2025-26","label":"FY 2025-26 (AY 2026-27)"}],"default":"2026-27"},{"key":"type","label":"Taxpayer","type":"select","options":[{"value":"salaried","label":"Salaried / pensioner"},{"value":"other","label":"Self-employed / other"}],"default":"salaried"},{"key":"age","label":"Age (old regime only)","type":"select","options":[{"value":"below60","label":"Below 60"},{"value":"senior","label":"Senior (60–79)"},{"value":"super","label":"Super senior (80+)"}],"default":"below60"},{"key":"deductions","label":"Old-regime deductions (80C, 80D, HRA…)","type":"number","unit":"₹","default":200000,"min":0}],
"compute": ({ gross, fy, type, age, deductions }) => {
      const T = IN_TAX[fy] || IN_TAX['2026-27'];
      const g = Math.max(0, Number(gross) || 0);
      const salaried = type === 'salaried';

      const compute = (regime) => {
        const R = T[regime];
        const sd = salaried ? R.standardDeduction : 0;
        let taxable = Math.max(0, g - sd - (regime === 'old' ? (Number(deductions) || 0) : 0));

        let slabs = R.slabs;
        if (regime === 'old' && age !== 'below60') {
          const ex = age === 'super' ? R.superSeniorExemption : R.seniorExemption;
          slabs = slabs.map(s => ({ ...s }));
          slabs[0] = { upto: ex, rate: 0 };
          if (slabs[1].upto <= ex) slabs.splice(1, 1);
        }

        let tax = slabTax(taxable, slabs);
        const preRebate = tax;
        const rebate = taxable <= R.rebateLimit ? Math.min(tax, R.rebateMax) : 0;
        tax -= rebate;

        /* Marginal relief: just above the rebate threshold the extra tax
           cannot exceed the extra income, which is what stops a ₹1 raise
           creating a ₹60,000 bill. */
        let relief = 0;
        if (regime === 'new' && taxable > R.rebateLimit) {
          const excess = taxable - R.rebateLimit;
          if (tax > excess) { relief = tax - excess; tax = excess; }
        }

        const sur = surchargeRate(taxable, R.surcharge);
        const surcharge = tax * sur;
        const cess = (tax + surcharge) * T.cess;
        const total = tax + surcharge + cess;

        return { taxable, sd, preRebate, rebate, relief, tax, surcharge, cess, total,
                 net: g - total, effective: g ? (total / g) * 100 : 0 };
      };

      const n = compute('new'), o = compute('old');
      const better = n.total <= o.total ? 'new' : 'old';

      return {
        newTotal: n.total, oldTotal: o.total,
        saving: Math.abs(n.total - o.total),
        better: better === 'new'
          ? `New regime — saves ${fmtR(o.total - n.total)}`
          : `Old regime — saves ${fmtR(n.total - o.total)}`,
        newTaxable: n.taxable, oldTaxable: o.taxable,
        newRebate: n.rebate, newRelief: n.relief,
        newCess: n.cess, newSurcharge: n.surcharge,
        newNet: n.net, newEffective: n.effective, oldEffective: o.effective,
        _table: {
          head: ['', 'New regime', 'Old regime'],
          rows: [
            ['Standard deduction', fmtR(n.sd), fmtR(o.sd)],
            ['Other deductions', fmtR(0), fmtR(Number(deductions) || 0)],
            ['Taxable income', fmtR(n.taxable), fmtR(o.taxable)],
            ['Tax before rebate', fmtR(n.preRebate), fmtR(o.preRebate)],
            ['Section 87A rebate', fmtR(n.rebate), fmtR(o.rebate)],
            ['Marginal relief', fmtR(n.relief), fmtR(o.relief)],
            ['Surcharge', fmtR(n.surcharge), fmtR(o.surcharge)],
            ['Health & education cess (4%)', fmtR(n.cess), fmtR(o.cess)],
            ['Total tax payable', fmtR(n.total), fmtR(o.total)],
            ['Income after tax', fmtR(n.net), fmtR(o.net)]
          ]
        }
      };
    },
"outputs": [{"key":"better","label":"Better regime","format":"text","primary":true},{"key":"newTotal","label":"Tax — new regime","format":"currency"},{"key":"oldTotal","label":"Tax — old regime","format":"currency"},{"key":"saving","label":"Difference","format":"currency"},{"key":"newTaxable","label":"Taxable income (new)","format":"currency"},{"key":"newRebate","label":"87A rebate applied","format":"currency"},{"key":"newRelief","label":"Marginal relief applied","format":"currency"},{"key":"newEffective","label":"Effective rate (new)","format":"percent"},{"key":"oldEffective","label":"Effective rate (old)","format":"percent"},{"key":"newNet","label":"Income after tax (new)","format":"currency"}],
"tips": ["The new regime is the default. You must actively opt for the old one, and salaried taxpayers can switch each year while business income generally cannot.","Under the new regime, taxable income up to ₹12 lakh attracts no tax because of the ₹60,000 rebate under Section 87A. With the ₹75,000 standard deduction, a salary up to ₹12.75 lakh is effectively tax-free.","The rebate does not apply to special-rate income such as capital gains under Sections 111A and 112A, so those remain taxable even below ₹12 lakh.","Marginal relief stops a small rise above ₹12 lakh producing a disproportionate jump in tax. This calculator applies it.","The old regime only wins when your deductions are large — typically above ₹4–5 lakh of 80C, 80D, HRA and home-loan interest combined."],
"faq": [{"q":"Which regime should I choose?","a":"Enter your actual deductions above and compare. As a rough guide, the new regime wins for most people with modest deductions, while the old regime can still win for those with a home loan, substantial HRA and full 80C use. Run your own numbers rather than following a rule of thumb."},{"q":"Is this an official calculation?","a":"No. It applies the published slab structure and common reliefs, but ignores many situation-specific provisions. The Income Tax Department publishes its own calculator, and for anything consequential you should confirm with a chartered accountant."}]
};
})();