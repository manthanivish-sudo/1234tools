(function(){
/* ---------- UK tax tables ----------
   England, Wales and Northern Ireland only — Scotland operates its own
   income tax bands and is handled separately in the tool.
   Checked 2026-10-04 against https://www.gov.uk/income-tax-rates and
   https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027
   (and ...-2025-to-2026): personal allowance £12,570, reduced by £1 for
   every £2 of adjusted net income over £100,000; on taxable income (after
   the allowance) basic 20% up to £37,700, higher 40% from £37,701 to
   £125,140, additional 45% above £125,140; NI primary threshold £12,570,
   upper earnings limit £50,270, 8% / 2%; employer 15% above £5,000;
   Employment Allowance £10,500. Same figures in both years. */
const UK_TAX = {
  '2026/27': {
    personalAllowance: 12570,
    taperStart: 100000,          // PA reduces £1 for every £2 above this
    bands: [                     // rate on taxable income (after PA) above `from`
      { from: 0,      rate: 0.20 },
      { from: 37700,  rate: 0.40 },
      { from: 125140, rate: 0.45 }  // the additional rate threshold is £125,140 of taxable income, not 112,570
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
      { from: 125140, rate: 0.45 }
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
window.TOOLS["nps-calculator"] = {
"currencyLocked": true,
"currencyNote": "the NPS scheme’s rules",
"currency": "INR",
"title": "NPS Calculator",
"category": "india",
"description": "National Pension System corpus at 60, with the mandatory annuity split and estimated pension.",
"keywords": ["NPS calculator","national pension system","NPS maturity","NPS pension","retirement calculator India"],
"formula": "corpus compounds monthly; at least 20% (non-government) or 40% (government) must buy an annuity",
"inputs": [{"key":"monthly","label":"Monthly contribution","type":"number","unit":"₹","default":10000,"min":0},{"key":"age","label":"Current age","type":"number","default":30,"min":18,"max":65},{"key":"rate","label":"Expected annual return","type":"number","unit":"%","default":10,"step":0.5},{"key":"sector","label":"Subscriber","type":"select","options":[{"value":"private","label":"All Citizen or corporate (at least 20% annuity)"},{"value":"govt","label":"Government sector (at least 40% annuity)"}],"default":"private"},{"key":"annuityPct","label":"Share used to buy annuity","type":"number","unit":"%","default":40,"min":20,"max":100},{"key":"annuityRate","label":"Expected annuity rate","type":"number","unit":"%","default":6,"step":0.25}],
"compute": ({ monthly, age, rate, sector, annuityPct, annuityRate }) => {
      const years = Math.max(0, Math.min(60, 60 - (Number(age) || 30)));
      const i = (Number(rate) || 0) / 100 / 12;
      const n = years * 12;
      const p = Number(monthly) || 0;

      const corpus = i === 0 ? p * n : p * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
      const invested = p * n;
      /* Minimum annuity at exit at 60. PFRDA (Exits and Withdrawals under the
         National Pension System) (Amendment) Regulations, 2025, in force
         16 December 2025: non-government subscribers (All Citizen and
         corporate) "at least twenty percent of the accumulated pension
         wealth ... shall be mandatorily utilized for purchase of annuity";
         government sector unchanged at 40%. A corpus up to ₹8 lakh may be
         taken in full; over ₹8 lakh and up to ₹12 lakh, up to ₹6 lakh as a
         lump sum and the rest as an annuity or systematic unit redemption
         over at least six years. Checked 2026-10-04 in the consolidated
         regulations "[Last amended on 16th December, 2025]" at
         https://www.pfrda.org.in/documents/33652/184762/PFRDA+(Exits+and+Withdrawals+under+the+NPS)+Regulations,+2015+%5BLast+amended+on+16+December+2025%5D.pdf
         and PFRDA's press release of 19 December 2025. */
      const minPct = sector === 'govt' ? 40 : 20;
      const given = annuityPct !== null && annuityPct !== undefined && annuityPct !== '' && isFinite(Number(annuityPct));
      const asked = given ? Number(annuityPct) : 40;
      const pctNum = Math.max(minPct, Math.min(100, asked));
      const pct = pctNum / 100;
      const annuity = corpus * pct;
      const lumpsum = corpus - annuity;
      const pension = annuity * ((Number(annuityRate) || 0) / 100) / 12;
      /* Only 60% of the corpus is exempt when taken at closure: Income-tax
         Act, 2025, Schedule II, Table Sl. No. 6 ("does not exceed 60% of the
         total amount payable"), as section 10(12A) of the 1961 Act did. A
         lump sum above 60% — possible since the 20% minimum — is not
         covered by that exemption. Checked 2026-10-04 in the Act as
         published, https://egazette.gov.in/WriteReadData/2025/265620.pdf */
      const exemptLumpsum = Math.min(lumpsum, corpus * 0.6);

      const notes = [];
      if (asked < minPct) notes.push(`The ${sector === 'govt' ? 'government-sector' : 'non-government'} minimum is ${minPct}%, so ${minPct}% is used.`);
      if (corpus > 0 && corpus <= 800000) notes.push('A corpus of ₹8 lakh or less may be withdrawn in full, without buying an annuity.');
      else if (corpus > 800000 && corpus <= 1200000) notes.push('With a corpus over ₹8 lakh and up to ₹12 lakh, up to ₹6 lakh can be taken as a lump sum and the rest as an annuity or as systematic unit redemption over at least six years.');
      if (lumpsum > exemptLumpsum + 0.5) notes.push('Only 60% of the corpus is tax-exempt; the lump sum above that is not covered by the exemption.');

      return {
        corpus, invested, gain: corpus - invested,
        lumpsum, exemptLumpsum, annuity, pension, years,
        note: notes.join(' ')
      };
    },
"outputs": [{"key":"corpus","label":"Corpus at 60","format":"currency","primary":true},{"key":"invested","label":"Total contributed","format":"currency"},{"key":"gain","label":"Growth","format":"currency"},{"key":"lumpsum","label":"Lump sum","format":"currency"},{"key":"exemptLumpsum","label":"Tax-exempt part of the lump sum (up to 60% of corpus)","format":"currency"},{"key":"annuity","label":"Used to buy annuity","format":"currency"},{"key":"pension","label":"Estimated monthly pension","format":"currency"},{"key":"years","label":"Years to 60","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Since 16 December 2025, All Citizen and corporate subscribers must use at least 20% of the corpus to buy an annuity and can take up to 80% as a lump sum; government-sector subscribers still need 40%. Only 60% of the corpus is tax-exempt when withdrawn.","The annuity rate is quoted by the insurer at the time of purchase and is outside your control. Small differences compound into a materially different pension.","NPS offers an extra ₹50,000 deduction over and above the ₹1.5 lakh limit — section 124(3) of the Income-tax Act, 2025, formerly 80CCD(1B), on top of section 123, formerly 80C — but only under the old regime.","Returns depend on your chosen asset allocation. Equity exposure is capped, and the cap reduces automatically with age under the auto choice."],
"faq": [{"q":"Is the pension from NPS taxable?","a":"Yes. The lump sum withdrawn at 60 is tax-free up to 60% of the corpus; anything taken above that is not covered by the exemption. The monthly annuity is taxed as income at your slab rate in the year received."}]
};
})();