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
window.TOOLS["random-number-generator"] = {
"title": "Random Number Generator",
"category": "utilities",
"description": "Generate random numbers in any range, with or without duplicates, using a cryptographic source.",
"keywords": ["random number generator","random picker","lottery numbers","random integer","pick a number"],
"formula": "crypto.getRandomValues with rejection sampling to avoid modulo bias",
"regenerate": true,
"inputs": [{"key":"min","label":"Minimum","type":"number","default":1},{"key":"max","label":"Maximum","type":"number","default":100},{"key":"count","label":"How many","type":"number","default":6,"min":1,"max":1000},{"key":"unique","label":"Duplicates","type":"select","options":[{"value":"yes","label":"Allow duplicates"},{"value":"no","label":"No duplicates"}],"default":"no"},{"key":"sort","label":"Order","type":"select","options":[{"value":"draw","label":"Draw order"},{"value":"asc","label":"Lowest first"}],"default":"draw"}],
"compute": ({ min, max, count, unique, sort }) => {
      let lo = Math.round(Number(min) || 0), hi = Math.round(Number(max) || 0);
      if (lo > hi) [lo, hi] = [hi, lo];
      const span = hi - lo + 1;
      if (!isFinite(span) || span < 1 || span > Number.MAX_SAFE_INTEGER) {
        return { note: 'That range is too large. Keep the minimum and maximum within a sensible span.' };
      }
      let n = Math.max(1, Math.min(1000, Math.round(Number(count) || 1)));
      if (unique === 'no' && n > span) {
        return { note: `You asked for ${n} unique numbers but the range only holds ${span}.` };
      }

      /* Rejection sampling: taking a random value modulo the span skews the
         result towards the low end whenever the span does not divide evenly. */
      const rand = (limit) => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const max32 = 4294967296;
          const bound = max32 - (max32 % limit);
          const buf = new Uint32Array(1);
          let v;
          do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= bound);
          return v % limit;
        }
        return Math.floor(Math.random() * limit);
      };

      let out = [];
      if (unique === 'no') {
        /* Building a pool array is clean for small ranges but catastrophic
           for large ones — a range of a billion would try to allocate a
           billion-element array and kill the tab. Above a modest threshold,
           draw and reject instead: with n far smaller than the span,
           collisions are vanishingly rare. */
        if (span <= 100000) {
          const pool = Array.from({ length: span }, (_, i) => lo + i);
          for (let i = 0; i < n; i++) out.push(pool.splice(rand(pool.length), 1)[0]);
        } else {
          const seen = new Set();
          let guard = 0;
          while (out.length < n && guard < n * 100) {
            guard++;
            const v = lo + rand(span);
            if (!seen.has(v)) { seen.add(v); out.push(v); }
          }
        }
      } else {
        for (let i = 0; i < n; i++) out.push(lo + rand(span));
      }
      if (sort === 'asc') out = out.slice().sort((a, b) => a - b);

      return {
        numbers: out.join(', '),
        first: out[0],
        count: out.length,
        range: `${lo} to ${hi}`,
        sum: out.reduce((s, x) => s + x, 0),
        source: (typeof crypto !== 'undefined' && crypto.getRandomValues) ? 'crypto.getRandomValues' : 'Math.random fallback',
        note: ''
      };
    },
"outputs": [{"key":"numbers","label":"Numbers","format":"text","primary":true},{"key":"count","label":"Generated","format":"number"},{"key":"range","label":"Range","format":"text"},{"key":"sum","label":"Sum","format":"number"},{"key":"source","label":"Random source","format":"text"},{"key":"note","label":"","format":"text"}],
"tips": ["Numbers come from the browser’s cryptographic random source, not Math.random, and use rejection sampling so every value in the range is equally likely.","Naive generators take a random number modulo the range, which quietly favours the lower values. This one does not.","Turn duplicates off for lottery-style draws or picking winners; leave them on for dice-style rolls."],
"faq": [{"q":"Is this random enough for a prize draw?","a":"The randomness is sound. Whether a draw is *fair* is a separate question about process — who ran it, whether it can be re-run, and whether anyone can verify it. For anything with legal weight, use a documented procedure with witnesses."}]
};
})();