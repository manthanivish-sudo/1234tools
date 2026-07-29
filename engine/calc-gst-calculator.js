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
window.TOOLS["gst-calculator"] = {
"currency": "INR",
"title": "GST Calculator (India)",
"category": "india",
"description": "Add or remove GST at current 2026 slabs, with the CGST, SGST and IGST split for your invoice.",
"keywords": ["GST calculator","GST India","CGST SGST IGST","GST inclusive exclusive","GST 18 percent","reverse GST"],
"formula": "GST = base × rate   ·   base = inclusive ÷ (1 + rate)",
"inputs": [{"key":"amount","label":"Amount","type":"number","unit":"₹","default":10000,"min":0},{"key":"mode","label":"Amount is","type":"select","options":[{"value":"exclusive","label":"Exclusive of GST (add GST)"},{"value":"inclusive","label":"Inclusive of GST (extract GST)"}],"default":"exclusive"},{"key":"rate","label":"GST rate","type":"select","options":[{"value":0,"label":"0% — nil rated (essentials)"},{"value":0.25,"label":"0.25% — rough diamonds"},{"value":3,"label":"3% — gold, silver, jewellery"},{"value":5,"label":"5% — everyday & essential goods"},{"value":18,"label":"18% — standard rate (most goods & services)"},{"value":40,"label":"40% — luxury & sin goods"}],"default":18},{"key":"supply","label":"Type of supply","type":"select","options":[{"value":"intra","label":"Intra-state (CGST + SGST)"},{"value":"inter","label":"Inter-state (IGST)"}],"default":"intra"},{"key":"qty","label":"Quantity","type":"number","default":1,"min":0}],
"compute": ({ amount, mode, rate, supply, qty }) => {
      const r = Number(rate) / 100;
      const line = Number(amount) * (Number(qty) || 1);
      const base = mode === 'inclusive' ? line / (1 + r) : line;
      const gst = base * r;
      const total = base + gst;

      return {
        total, base, gst,
        cgst: supply === 'intra' ? gst / 2 : 0,
        sgst: supply === 'intra' ? gst / 2 : 0,
        igst: supply === 'inter' ? gst : 0,
        splitLabel: supply === 'intra'
          ? `CGST ${(Number(rate) / 2).toFixed(2)}% + SGST ${(Number(rate) / 2).toFixed(2)}%`
          : `IGST ${Number(rate).toFixed(2)}%`,
        effectiveRate: base ? (gst / base) * 100 : 0
      };
    },
"outputs": [{"key":"total","label":"Invoice total","format":"currency","primary":true},{"key":"base","label":"Taxable value","format":"currency"},{"key":"gst","label":"Total GST","format":"currency"},{"key":"splitLabel","label":"Tax split","format":"text"},{"key":"cgst","label":"CGST","format":"currency"},{"key":"sgst","label":"SGST","format":"currency"},{"key":"igst","label":"IGST","format":"currency"}],
"tips": ["GST 2.0 took effect on 22 September 2025: the 12% and 28% slabs were removed, most 12% items moved to 5% and most 28% items to 18%, and a 40% demerit rate was introduced for luxury and sin goods.","Intra-state supply splits the tax equally into CGST and SGST. Inter-state supply is a single IGST charge at the full rate.","To remove 18% GST you divide by 1.18 — subtracting 18% takes off too much and understates the taxable value.","Place of supply, not where you are sitting, determines whether CGST+SGST or IGST applies. Getting it wrong means an amended return."],
"faq": [{"q":"Which GST rate applies to my product?","a":"It depends on the HSN or SAC code, not on a general category. The GST Council publishes rate notifications against specific codes, and misclassification is a common cause of demand notices. Check the current notification or ask your CA rather than assuming."},{"q":"Why do CGST and SGST each show half the rate?","a":"For supplies within one state the tax is shared between the Centre and the state. An 18% rate is therefore 9% CGST plus 9% SGST. The customer still pays 18% in total."}]
};
})();