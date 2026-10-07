(function(){
/* A systematic investment plan: a fixed sum at the start of every month,
   growing at a steady monthly return of (annual return ÷ 12).

   Step-up: after every twelfth instalment the next one rises by a
   percentage, by a fixed amount, or both (new = old × (1 + s) + a).
   Lump sum: invested at the start and compounded for the whole period.
   Inflation: the maturity value in today's money is value ÷ (1 + inflation)^years.

   Goal mode turns the question round: what monthly SIP reaches a target?
   The maturity value is a straight line in the first instalment (every
   later instalment is a fixed multiple of it, plus the fixed step-ups,
   which do not depend on it), so the answer is exact, not searched for:
     SIP = (goal − lump sum's value − fixed step-ups' value) ÷ value of a ₹1 SIP.
   With inflation, the goal is taken in today's money and grown to the
   future first, which is how a target such as "a ₹20 lakh down payment"
   is meant. */
function grow(o) {
  const i = o.rate / 100 / 12;
  const n = Math.max(0, Math.min(1200, Math.round(o.years * 12)));  // cap at 100 years
  let value = o.lump, invested = o.lump, c = o.monthly, lastPaid = c;
  const rows = [], vals = [o.lump], paid = [o.lump], labels = [0];
  for (let m = 1; m <= n; m++) {
    value = (value + c) * (1 + i);
    invested += c;
    lastPaid = c;
    if (m % 12 === 0 || m === n) {
      rows.push([Math.ceil(m / 12), invested, value, value - invested]);
      labels.push(Math.ceil(m / 12)); vals.push(value); paid.push(invested);
    }
    if (m % 12 === 0) c = c * (1 + o.step) + o.stepAmt;
  }
  return { value, invested, lastPaid, rows, vals, paid, labels, n };
}

window.TOOLS = window.TOOLS || {};
window.TOOLS["sip-calculator"] = {
"currency": "INR",
"title": "SIP Calculator",
"category": "india",
"description": "Project the future value of a systematic investment plan, with optional annual step-up.",
"keywords": ["SIP calculator","systematic investment plan","mutual fund SIP","SIP returns","step up SIP"],
"formula": "FV = P × [((1+i)ⁿ − 1) / i] × (1+i)",
"inputs": [{"key":"mode","label":"Work out","type":"select","options":[{"value":"grow","label":"What my SIP grows to"},{"value":"goal","label":"The SIP I need for a goal"}],"default":"grow"},{"key":"monthly","label":"Monthly investment","type":"number","unit":"₹","default":10000,"min":0,"showIf":{"key":"mode","is":"grow"}},{"key":"goal","label":"Target amount","type":"number","unit":"₹","default":5000000,"min":0,"showIf":{"key":"mode","is":"goal"},"hint":"With an inflation rate, this is in today’s money."},{"key":"rate","label":"Expected annual return","type":"number","unit":"%","default":12,"step":0.1,"min":-50,"max":100,"slider":[1,30]},{"key":"years","label":"Investment period","type":"number","unit":"years","default":15,"min":0,"max":100,"slider":{"min":1,"max":40,"step":1}},{"key":"stepup","label":"Annual step-up","type":"number","unit":"%","default":0,"min":0,"step":0.5},{"key":"stepAmt","label":"or step up by a fixed amount","type":"number","unit":"₹ a year","default":0,"min":0,"hint":"Added to the monthly instalment once a year, on top of any percentage."},{"key":"lump","label":"Lump sum invested at the start","type":"number","unit":"₹","default":0,"min":0},{"key":"inflation","label":"Inflation","type":"number","unit":"%","default":0,"min":0,"max":30,"step":0.1,"hint":"Shows the maturity value in today’s money."}],
"compute": ({ mode, monthly, goal, rate, years, stepup, stepAmt, lump, inflation }) => {
      const base = { rate: Number(rate) || 0, years: Number(years) || 0, step: (Number(stepup) || 0) / 100 };
      const infl = (Number(inflation) || 0) / 100;
      const L = Number(lump) || 0, A = Number(stepAmt) || 0;
      let P = Number(monthly) || 0;
      const out = {};
      if (mode === 'goal') {
        const target = (Number(goal) || 0) * Math.pow(1 + infl, base.years);
        const unit = grow(Object.assign({}, base, { monthly: 1, lump: 0, stepAmt: 0 })).value;
        const fixed = grow(Object.assign({}, base, { monthly: 0, lump: L, stepAmt: A })).value;
        if (!(unit > 0)) return { _invalid: { years: 'Give a period of at least one month.' } };
        P = (target - fixed) / unit;
        if (P < 0) P = 0;
        out.required = P;
        out.target = target;
      }
      const r = grow(Object.assign({}, base, { monthly: P, lump: L, stepAmt: A }));
      Object.assign(out, {
        value: r.value, invested: r.invested, returns: r.value - r.invested,
        multiple: r.invested ? r.value / r.invested : NaN,
        finalMonthly: r.lastPaid,
        _table: r.rows.length ? { title: 'Value by year', head: ['Year', 'Invested', 'Value', 'Gain'], cols: ['int', 'currency', 'currency', 'currency'], rows: r.rows } : null
      });
      if (mode === 'goal' && P === 0 && out.target > 0) out.note = 'The lump sum and fixed step-ups reach the goal on their own.';
      if (infl > 0) out.realValue = r.value / Math.pow(1 + infl, base.years);
      if (r.rows.length) {
        const real = r.vals.map((v, k) => v / Math.pow(1 + infl, r.labels[k]));
        out._chart = [
          { type: 'line', title: 'Growth of the plan', format: 'currency', xLabel: 'Year', labels: r.labels,
            series: [{ name: 'Value', values: r.vals, area: true }, { name: 'Invested', values: r.paid, c: 1 }].concat(infl > 0 ? [{ name: 'Value in today’s money', values: real, c: 2, dashed: true }] : []) },
          { type: 'donut', title: 'Maturity value', format: 'currency', center: { label: 'Value', value: r.value },
            slices: [{ name: 'Invested', value: r.invested, c: 1 }, { name: 'Gain', value: Math.max(0, r.value - r.invested) }] }
        ];
      }
      return out;
    },
"outputs": [{"key":"required","label":"Monthly SIP needed","format":"currency","primary":true},{"key":"value","label":"Maturity value","format":"currency","primary":true},{"key":"target","label":"Goal in future money","format":"currency"},{"key":"invested","label":"Total invested","format":"currency"},{"key":"returns","label":"Wealth gained","format":"currency"},{"key":"multiple","label":"Growth multiple","format":"number","unit":"×"},{"key":"finalMonthly","label":"Final monthly instalment","format":"currency"},{"key":"realValue","label":"Maturity value in today’s money","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      const i = (Number(v.rate) || 0) / 1200, n = Math.round((Number(v.years) || 0) * 12);
      const P = v.mode === 'goal' ? r.required : Number(v.monthly) || 0;
      if (!n) return [];
      const L = ['i = ' + f.upto(Number(v.rate) || 0, 4) + '% ÷ 12 = ' + f.upto(i, 8) + '      n = ' + n + ' months'];
      const flat = !(Number(v.stepup) > 0) && !(Number(v.stepAmt) > 0);
      if (flat) {
        const fv = i === 0 ? P * n : P * (Math.pow(1 + i, n) - 1) / i * (1 + i);
        L.push('FV = ' + f.money(P) + ' × ((1 + ' + f.upto(i, 8) + ')^' + n + ' − 1) ÷ ' + f.upto(i, 8) + ' × (1 + ' + f.upto(i, 8) + ') = ' + f.money(fv));
        if (Number(v.lump) > 0) L.push('lump sum: ' + f.money(Number(v.lump)) + ' × (1 + ' + f.upto(i, 8) + ')^' + n + ' = ' + f.money(Number(v.lump) * Math.pow(1 + i, n)));
      } else L.push('with a step-up each year’s instalments are grown month by month: see the table below');
      L.push('maturity value = ' + f.money(r.value));
      if (v.mode === 'goal') L.push('SIP = (' + f.money(r.target) + ' − what the lump sum and fixed step-ups reach) ÷ what ₹1 a month reaches = ' + f.money(r.required));
      if (r.realValue !== undefined) L.push('in today’s money: ' + f.money(r.value) + ' ÷ (1 + ' + f.upto(Number(v.inflation), 4) + '%)^' + f.upto(Number(v.years), 4) + ' = ' + f.money(r.realValue));
      return L;
    },
"tips": ["The expected return is an assumption, not a promise. Equity funds have historically averaged around 11–13% over long periods, but with years of double-digit losses along the way.","A step-up of even 10% a year makes a dramatic difference over fifteen years — usually more than chasing a slightly better fund.","Returns here are before tax. Equity fund gains above ₹1.25 lakh a year are taxed at 12.5% long term.","This assumes contributions at the start of each month and a constant return. Real returns arrive unevenly, which matters most in the years just before you need the money.","Switch to “The SIP I need for a goal” to work backwards from a target; with an inflation rate the target is read in today’s money."],
"faq": [{"q":"Is a SIP safer than investing a lump sum?","a":"It spreads entry price across time, which reduces the risk of investing everything at a peak. Over long horizons in a rising market, lump-sum investing has often produced more. The real benefit of a SIP is behavioural: it is far easier to keep doing."},{"q":"How much SIP do I need for ₹1 crore?","a":"At a 12% expected return, about ₹19,819 a month for 15 years, or about ₹10,009 a month for 20 years. Choose “The SIP I need for a goal” and enter your own target, period and return."}]
};
})();
