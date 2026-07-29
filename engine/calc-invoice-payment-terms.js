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
window.TOOLS["invoice-payment-terms"] = {
"currency": "GBP",
"title": "Invoice Due Date & Settlement Discount Calculator",
"category": "business",
"description": "Work out payment due dates, late payment interest, and whether an early settlement discount is worth taking.",
"keywords": ["invoice due date calculator","payment terms","net 30","late payment interest","early settlement discount","2/10 net 30"],
"formula": "effective annual cost = (d / (1 − d)) × (365 / (net − discount days))",
"inputs": [{"key":"invoiceDate","label":"Invoice date","type":"date","default":"TODAY"},{"key":"terms","label":"Payment terms","type":"select","options":[{"value":"7","label":"Net 7"},{"value":"14","label":"Net 14"},{"value":"30","label":"Net 30"},{"value":"45","label":"Net 45"},{"value":"60","label":"Net 60"},{"value":"90","label":"Net 90"}],"default":"30"},{"key":"amount","label":"Invoice amount","type":"number","unit":"£","default":10000,"min":0},{"key":"discount","label":"Early settlement discount","type":"number","unit":"%","default":2,"min":0,"step":0.1},{"key":"discountDays","label":"Discount if paid within","type":"number","unit":"days","default":10,"min":0},{"key":"daysLate","label":"Days overdue (for interest)","type":"number","default":0,"min":0}],
"compute": ({ invoiceDate, terms, amount, discount, discountDays, daysLate }) => {
      const d0 = new Date(invoiceDate);
      if (isNaN(d0)) return { note: 'Enter a valid invoice date.' };
      const net = Number(terms);

      const due = new Date(d0); due.setDate(due.getDate() + net);
      const discDue = new Date(d0); discDue.setDate(discDue.getDate() + Number(discountDays));

      const dFrac = discount / 100;
      const window = net - discountDays;
      // Cost of NOT taking the discount, annualised.
      const effAnnual = (dFrac > 0 && window > 0)
        ? (dFrac / (1 - dFrac)) * (365 / window) * 100 : NaN;

      // UK statutory late payment interest: BoE base + 8%.
      const statutory = 0.08 + 0.0475;
      const interest = amount * statutory * (Number(daysLate) || 0) / 365;
      const fee = amount < 1000 ? 40 : amount < 10000 ? 70 : 100;

      const fmtD = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

      return {
        dueDate: fmtD(due),
        discountDate: dFrac > 0 ? fmtD(discDue) : '—',
        discountAmount: amount * dFrac,
        payIfEarly: amount * (1 - dFrac),
        effAnnual,
        worthTaking: !isFinite(effAnnual) ? '—'
          : effAnnual > 12 ? `Yes — refusing it costs ${effAnnual.toFixed(1)}% a year`
          : `Marginal — only ${effAnnual.toFixed(1)}% a year`,
        interest,
        compensation: daysLate > 0 ? fee : 0,
        totalIfLate: amount + interest + (daysLate > 0 ? fee : 0),
        note: ''
      };
    },
"outputs": [{"key":"dueDate","label":"Payment due","format":"text","primary":true},{"key":"discountDate","label":"Discount deadline","format":"text"},{"key":"payIfEarly","label":"Pay if settled early","format":"currency"},{"key":"discountAmount","label":"Discount value","format":"currency"},{"key":"effAnnual","label":"Annualised cost of not taking it","format":"percent"},{"key":"worthTaking","label":"Verdict","format":"text"},{"key":"interest","label":"Statutory late interest","format":"currency"},{"key":"compensation","label":"Late payment compensation","format":"currency"},{"key":"totalIfLate","label":"Total owed if late","format":"currency"},{"key":"note","label":"","format":"text"}],
"tips": ["A 2% discount for paying 20 days early is worth about 37% a year. Almost any business should take it rather than hold the cash.","UK businesses can charge statutory interest at 8% above the Bank of England base rate on late commercial payments, plus fixed compensation of £40, £70 or £100 depending on invoice size.","The base rate used here is an assumption. Check the current Bank of England rate before issuing a formal demand.","Terms run from the invoice date unless the contract says otherwise. \"Net 30 from end of month\" is a materially different arrangement."],
"faq": [{"q":"Can I really charge late payment interest?","a":"In the UK, the Late Payment of Commercial Debts (Interest) Act 1998 gives businesses a statutory right to interest and fixed compensation on overdue commercial invoices, unless the contract provides a substantial alternative remedy. Many suppliers never invoke it, but the right exists."}]
};
})();