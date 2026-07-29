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
window.TOOLS["roman-numerals"] = {
"title": "Roman Numeral Converter",
"category": "mathematics",
"description": "Convert numbers to Roman numerals and back, with the rules explained.",
"keywords": ["roman numeral converter","roman numerals","number to roman","roman to number","XIV meaning"],
"formula": "I=1, V=5, X=10, L=50, C=100, D=500, M=1000",
"inputs": [{"key":"value","label":"Number or Roman numeral","type":"text","default":"2026"}],
"compute": ({ value }) => {
      const raw = String(value || '').trim().toUpperCase();
      if (!raw) return { note: 'Enter a number or a Roman numeral.' };

      const MAP = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
                   [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
      const VAL = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };

      if (/^\d+$/.test(raw)) {
        let n = parseInt(raw, 10);
        if (n < 1 || n > 3999) {
          return { note: 'Standard Roman numerals cover 1 to 3999. Larger values needed an overbar, which has no single agreed notation.' };
        }
        let out = '';
        for (const [v, s] of MAP) while (n >= v) { out += s; n -= v; }
        const breakdown = out.replace(/(CM|CD|XC|XL|IX|IV|[MDCLXVI])/g, '$1 ').trim();
        return { result: out, breakdown, decimal: parseInt(raw, 10), direction: 'Number → Roman', note: '' };
      }

      if (!/^[MDCLXVI]+$/.test(raw)) return { note: 'Roman numerals use only M, D, C, L, X, V and I.' };
      let total = 0;
      for (let i = 0; i < raw.length; i++) {
        const v = VAL[raw[i]], nxt = VAL[raw[i + 1]] || 0;
        total += v < nxt ? -v : v;
      }
      // reject non-canonical spellings such as IIII or IC
      let check = '', n2 = total;
      for (const [v, s] of MAP) while (n2 >= v) { check += s; n2 -= v; }
      if (check !== raw) {
        return { result: String(total), decimal: total, direction: 'Roman → Number',
                 breakdown: `That reads as ${total}, but the standard spelling is ${check}.`,
                 note: `"${raw}" is not a canonical numeral. The usual form for ${total} is ${check}.` };
      }
      return { result: String(total), decimal: total, direction: 'Roman → Number',
               breakdown: raw.replace(/(CM|CD|XC|XL|IX|IV|[MDCLXVI])/g, '$1 ').trim(), note: '' };
    },
"outputs": [{"key":"result","label":"Result","format":"text","primary":true},{"key":"direction","label":"Conversion","format":"text"},{"key":"breakdown","label":"Broken down","format":"text"},{"key":"decimal","label":"Decimal value","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Subtractive pairs are limited to IV, IX, XL, XC, CD and CM. IC for 99 is not valid — it is XCIX.","A symbol repeats at most three times: 4 is IV, not IIII. Clock faces using IIII are a decorative exception.","There is no zero and no way to write a fraction, which is a large part of why the system was displaced."],
"faq": [{"q":"Why stop at 3999?","a":"Beyond that you need a vinculum — an overbar meaning \"multiply by a thousand\" — which has no single agreed digital representation. Most converters stop where the unambiguous notation does."}]
};
})();