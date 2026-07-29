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
window.TOOLS["dice-roller"] = {
"title": "Dice Roller",
"category": "utilities",
"description": "Roll any number of dice with any number of sides, with modifiers and standard RPG notation.",
"keywords": ["dice roller","roll dice online","d20 roller","virtual dice","random dice","D&D dice"],
"formula": "standard notation: 2d6+3 means two six-sided dice plus three",
"regenerate": true,
"inputs": [{"key":"count","label":"Number of dice","type":"number","default":2,"min":1,"max":200},{"key":"sides","label":"Sides","type":"select","options":[{"value":"4","label":"d4"},{"value":"6","label":"d6"},{"value":"8","label":"d8"},{"value":"10","label":"d10"},{"value":"12","label":"d12"},{"value":"20","label":"d20"},{"value":"100","label":"d100"}],"default":"6"},{"key":"modifier","label":"Modifier","type":"number","default":0},{"key":"drop","label":"Drop","type":"select","options":[{"value":"none","label":"Keep all"},{"value":"low","label":"Drop the lowest"},{"value":"high","label":"Drop the highest"}],"default":"none"}],
"compute": ({ count, sides, modifier, drop }) => {
      const n = Math.max(1, Math.min(200, Math.round(Number(count) || 1)));
      const s = Math.max(2, Math.round(Number(sides) || 6));
      const mod = Math.round(Number(modifier) || 0);

      const rand = (limit) => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const max32 = 4294967296, bound = max32 - (max32 % limit);
          const buf = new Uint32Array(1);
          let v; do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= bound);
          return v % limit;
        }
        return Math.floor(Math.random() * limit);
      };

      const rolls = Array.from({ length: n }, () => 1 + rand(s));
      let kept = rolls.slice();
      let dropped = null;
      if (drop !== 'none' && n > 1) {
        const sorted = rolls.slice().sort((a, b) => a - b);
        dropped = drop === 'low' ? sorted[0] : sorted[sorted.length - 1];
        const idx = kept.indexOf(dropped);
        kept.splice(idx, 1);
      }
      const sum = kept.reduce((a, b) => a + b, 0);

      return {
        total: sum + mod,
        notation: `${n}d${s}${mod ? (mod > 0 ? '+' + mod : mod) : ''}`,
        rolls: rolls.join(', '),
        droppedValue: dropped === null ? '—' : String(dropped),
        sum,
        modifier: mod,
        highest: Math.max(...rolls),
        lowest: Math.min(...rolls),
        average: sum / kept.length
      };
    },
"outputs": [{"key":"total","label":"Total","format":"number","primary":true},{"key":"notation","label":"Notation","format":"text"},{"key":"rolls","label":"Individual rolls","format":"text"},{"key":"droppedValue","label":"Dropped","format":"text"},{"key":"sum","label":"Sum of kept dice","format":"number"},{"key":"highest","label":"Highest roll","format":"number"},{"key":"lowest","label":"Lowest roll","format":"number"},{"key":"average","label":"Average per die","format":"number"}],
"tips": ["Standard notation is NdS+M: 3d6+2 rolls three six-sided dice and adds two.","Dropping the lowest die is the usual method for rolling character statistics — it shifts the distribution upward.","Rolls use the cryptographic random source, so they are not predictable from previous results."],
"faq": [{"q":"Why do multiple dice cluster around the middle?","a":"Because sums of dice follow a bell-shaped distribution. On 2d6 there is one way to make 2 but six ways to make 7, so 7 comes up six times as often."}]
};
})();