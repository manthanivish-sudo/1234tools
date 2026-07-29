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
window.TOOLS["sip-calculator"] = {
"currency": "INR",
"title": "SIP Calculator",
"category": "india",
"description": "Project the future value of a systematic investment plan, with optional annual step-up.",
"keywords": ["SIP calculator","systematic investment plan","mutual fund SIP","SIP returns","step up SIP"],
"formula": "FV = P × [((1+i)ⁿ − 1) / i] × (1+i)",
"inputs": [{"key":"monthly","label":"Monthly investment","type":"number","unit":"₹","default":10000,"min":0},{"key":"rate","label":"Expected annual return","type":"number","unit":"%","default":12,"step":0.1},{"key":"years","label":"Investment period","type":"number","unit":"years","default":15,"min":0,"max":100},{"key":"stepup","label":"Annual step-up","type":"number","unit":"%","default":0,"min":0,"step":0.5}],
"compute": ({ monthly, rate, years, stepup }) => {
      const i = (Number(rate) || 0) / 100 / 12;
      const n = Math.max(0, Math.min(1200, Math.round((Number(years) || 0) * 12)));  // cap at 100 years
      const step = (Number(stepup) || 0) / 100;

      let value = 0, invested = 0, contribution = Number(monthly) || 0;
      const rows = [];
      for (let m = 1; m <= n; m++) {
        value = (value + contribution) * (1 + i);
        invested += contribution;
        if (m % 12 === 0) {
          rows.push([String(m / 12), fmtR(invested), fmtR(value), fmtR(value - invested)]);
          if (step) contribution *= (1 + step);
        }
      }

      return {
        value, invested, returns: value - invested,
        multiple: invested ? value / invested : NaN,
        finalMonthly: contribution,
        _table: rows.length ? { head: ['Year', 'Invested', 'Value', 'Gain'], rows } : null
      };
    },
"outputs": [{"key":"value","label":"Maturity value","format":"currency","primary":true},{"key":"invested","label":"Total invested","format":"currency"},{"key":"returns","label":"Wealth gained","format":"currency"},{"key":"multiple","label":"Growth multiple","format":"number","unit":"×"},{"key":"finalMonthly","label":"Final monthly instalment","format":"currency"}],
"tips": ["The expected return is an assumption, not a promise. Equity funds have historically averaged around 11–13% over long periods, but with years of double-digit losses along the way.","A step-up of even 10% a year makes a dramatic difference over fifteen years — usually more than chasing a slightly better fund.","Returns here are before tax. Equity fund gains above ₹1.25 lakh a year are taxed at 12.5% long term.","This assumes contributions at the start of each month and a constant return. Real returns arrive unevenly, which matters most in the years just before you need the money."],
"faq": [{"q":"Is a SIP safer than investing a lump sum?","a":"It spreads entry price across time, which reduces the risk of investing everything at a peak. Over long horizons in a rising market, lump-sum investing has often produced more. The real benefit of a SIP is behavioural: it is far easier to keep doing."}]
};
})();