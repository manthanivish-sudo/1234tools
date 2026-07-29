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
window.TOOLS["number-base-converter"] = {
"title": "Number Base Converter",
"category": "mathematics",
"description": "Convert between binary, octal, decimal, hexadecimal and any base from 2 to 36.",
"keywords": ["binary to decimal","decimal to binary","hex converter","number base converter","binary converter","octal to hex"],
"formula": "positional notation: Σ digitᵢ × baseⁱ",
"inputs": [{"key":"value","label":"Value","type":"text","default":"255"},{"key":"from","label":"From base","type":"select","options":[{"value":"2","label":"Binary (2)"},{"value":"8","label":"Octal (8)"},{"value":"10","label":"Decimal (10)"},{"value":"16","label":"Hexadecimal (16)"},{"value":"32","label":"Base 32"},{"value":"36","label":"Base 36"}],"default":"10"}],
"compute": ({ value, from }) => {
      const base = Number(from) || 10;
      const raw = String(value || '').trim().replace(/^0[bxo]/i, '').replace(/[\s_]/g, '');
      if (!raw) return { note: 'Enter a value.' };

      const n = parseInt(raw, base);
      if (!isFinite(n) || isNaN(n)) return { note: `"${raw}" is not a valid base-${base} number.` };
      // parseInt stops at the first invalid digit rather than complaining
      if (n.toString(base).toLowerCase() !== raw.toLowerCase().replace(/^0+(?=.)/, '')) {
        return { note: `"${raw}" contains digits that do not exist in base ${base}.` };
      }
      if (n > Number.MAX_SAFE_INTEGER) return { note: 'That value exceeds the range JavaScript can represent exactly.' };

      const bin = n.toString(2);
      return {
        decimal: n,
        binary: bin,
        octal: n.toString(8),
        hex: n.toString(16).toUpperCase(),
        base32: n.toString(32).toUpperCase(),
        base36: n.toString(36).toUpperCase(),
        bits: bin.length,
        bytes: Math.ceil(bin.length / 8),
        grouped: bin.replace(/\B(?=(\d{4})+(?!\d))/g, ' '),
        note: ''
      };
    },
"outputs": [{"key":"decimal","label":"Decimal","format":"number","primary":true},{"key":"binary","label":"Binary","format":"text"},{"key":"grouped","label":"Binary (grouped in 4s)","format":"text"},{"key":"octal","label":"Octal","format":"text"},{"key":"hex","label":"Hexadecimal","format":"text"},{"key":"base32","label":"Base 32","format":"text"},{"key":"base36","label":"Base 36","format":"text"},{"key":"bits","label":"Bits required","format":"number"},{"key":"bytes","label":"Bytes required","format":"number"},{"key":"note","label":"","format":"text"}],
"tips": ["Prefixes are stripped automatically: 0b1010, 0xFF and 0o777 all work.","Each hex digit is exactly four binary digits, which is why hex is the convention for reading raw bytes.","Bases above 16 use letters up to Z. Base 36 is the highest that fits in digits plus the Latin alphabet."],
"faq": [{"q":"Why does my long binary string lose precision?","a":"JavaScript numbers are exact only up to 2⁵³. Beyond about 53 bits the value cannot be represented precisely, so the tool refuses rather than returning a quietly wrong answer."}]
};
})();