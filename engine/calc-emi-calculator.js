(function(){
/* EMI on a reducing-balance loan, with what borrowers in India actually do
   to one: prepay a fixed sum every month, make a part-prepayment once,
   raise the EMI every year (a step-up), ride out a change in a floating
   rate, and pay a processing fee.

   EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1), r = annual rate ÷ 12 ÷ 100.
   Interest each month is on the balance still owed; whatever is paid over
   it reduces the loan, and the loan closes early when more is paid.

   A floating-rate reset: the RBI's circular of 18 August 2023 ("Reset of
   Floating Interest Rate on Equated Monthly Instalments (EMI) based
   Personal Loans", DoR.MCS.REC.32/01.01.003/2023-24) has lenders offer the
   borrower the choice of a new EMI or a new tenure. Both are offered here:
   keep the EMI and let the tenure move, or keep the tenure and work the EMI
   out again on the balance left.

   The fee: the effective annual cost is the yearly rate X at which the
   EMIs, each discounted by (1 + X)^(month ÷ 12), add up to the loan less
   the fee (what reaches the borrower). */
function emiOf(P, annual, n) {
  const r = annual / 1200;
  if (n <= 0) return 0;
  return r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}
function run(o) {
  const r0 = o.rate / 1200;
  let balance = o.p, emi = o.emi, months = 0, totalInterest = 0, after = null;
  const rows = [], flows = [];
  const eps = 0.5;
  while (balance > eps && months < 600) {
    const k = months + 1;
    let r = r0;
    if (o.changeAt && k > o.changeAt) {
      r = o.newRate / 1200;
      if (k === o.changeAt + 1 && o.keep === 'tenure') { emi = emiOf(balance, o.newRate, Math.max(1, o.n - o.changeAt)); after = emi; }
      if (k === o.changeAt + 1 && o.keep !== 'tenure') after = emi;
    }
    const interest = balance * r;
    const step = o.step ? Math.pow(1 + o.step, Math.floor((k - 1) / 12)) : 1;
    let pay = emi * step + o.prepay + (k === o.lumpMonth ? o.lump : 0);
    let principal = pay - interest;
    if (principal <= 0) return { stuck: true, month: k };
    if (principal > balance) { principal = balance; pay = principal + interest; }
    balance -= principal; totalInterest += interest; months = k;
    rows.push([k, pay, interest, principal, balance]);
    flows.push(pay);
  }
  return { months, totalInterest, rows, flows, after };
}
function irr(flows, net) {
  const pv = (j) => flows.reduce((s, c, t) => s + c / Math.pow(1 + j, t + 1), 0);
  if (pv(0) <= net) return 0;
  let lo = 0, hi = 1;
  for (let it = 0; it < 200; it++) { const mid = (lo + hi) / 2; if (pv(mid) > net) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
const blank = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v));

window.TOOLS = window.TOOLS || {};
window.TOOLS["emi-calculator"] = {
"currency": "INR",
"title": "EMI Calculator with Amortisation",
"category": "india",
"description": "Equated monthly instalment for home, car or personal loans, with the full repayment schedule.",
"keywords": ["EMI calculator","home loan EMI","car loan EMI","personal loan calculator","loan EMI India","amortisation schedule"],
"formula": "EMI = P × r × (1+r)ⁿ / ((1+r)ⁿ − 1)",
"inputs": [{"key":"amount","label":"Loan amount","type":"number","unit":"₹","default":5000000,"min":0},{"key":"rate","label":"Annual interest rate","type":"number","unit":"%","default":8.5,"step":0.05,"min":0,"max":60,"slider":[5,20]},{"key":"years","label":"Tenure","type":"number","unit":"years","default":20,"min":0,"max":50,"slider":{"min":1,"max":30,"step":1}},{"key":"prepay","label":"Extra payment each month","type":"number","unit":"₹","default":0,"min":0},
  {"key":"lump","label":"Part-prepayment","type":"number","unit":"₹","default":0,"min":0,"group":"Part-prepayment and step-up"},{"key":"lumpMonth","label":"Paid in month","type":"number","default":12,"min":1,"max":600,"integer":true,"group":"Part-prepayment and step-up"},{"key":"stepUp","label":"Raise the EMI each year by","type":"number","unit":"%","default":0,"min":0,"max":50,"step":0.5,"group":"Part-prepayment and step-up","hint":"A step-up EMI: the higher instalment closes the loan early."},
  {"key":"changeYear","label":"Rate changes after","type":"number","unit":"years","default":0,"min":0,"max":50,"group":"Floating rate change","hint":"0 keeps one rate for the whole tenure."},{"key":"newRate","label":"New rate","type":"number","unit":"%","default":null,"optional":true,"placeholder":"Same rate throughout","min":0,"max":60,"step":0.05,"group":"Floating rate change"},{"key":"keep","label":"When the rate changes, keep","type":"select","options":[{"value":"emi","label":"The EMI (the tenure changes)"},{"value":"tenure","label":"The tenure (the EMI changes)"}],"default":"emi","group":"Floating rate change"},
  {"key":"feePct","label":"Processing fee","type":"number","unit":"% of the loan","default":0,"min":0,"max":10,"step":0.05,"group":"Processing fee","hint":"Include the 18% GST on the fee."},
  {"key":"rateB","label":"Compare at a rate of","type":"number","unit":"%","default":null,"optional":true,"placeholder":"Leave blank to skip","min":0,"max":60,"step":0.05,"group":"Compare with another offer"},{"key":"yearsB","label":"Over a tenure of","type":"number","unit":"years","default":null,"optional":true,"placeholder":"Same tenure","min":0,"max":50,"group":"Compare with another offer"}],
"compute": ({ amount, rate, years, prepay, lump, lumpMonth, stepUp, changeYear, newRate, keep, feePct, rateB, yearsB }) => {
      const p = Number(amount) || 0;
      const n = Math.max(0, Math.min(600, Math.round((Number(years) || 0) * 12)));  // cap at 50 years
      if (!p || !n) return { note: 'Enter a loan amount and tenure.' };

      const emi = emiOf(p, Number(rate) || 0, n);
      const changeAt = Math.round((Number(changeYear) || 0) * 12);
      const floating = changeAt > 0 && changeAt < n && !blank(newRate);
      const opts = { p, n, emi, rate: Number(rate) || 0, prepay: Number(prepay) || 0, lump: Number(lump) || 0, lumpMonth: Math.round(Number(lumpMonth) || 0),
        step: (Number(stepUp) || 0) / 100, changeAt: floating ? changeAt : 0, newRate: Number(newRate), keep };
      const plan = run(opts);
      if (plan.stuck) {
        return floating && plan.month > changeAt
          ? { _invalid: { newRate: 'At this rate the EMI no longer covers the interest: keep the tenure instead, or pay more.' } }
          : { note: 'The instalment does not cover the interest.' };
      }
      const base = run(Object.assign({}, opts, { prepay: 0, lump: 0, step: 0 }));
      const extraPaid = opts.prepay > 0 || opts.lump > 0 || opts.step > 0;

      /* the schedule a year to a row, as before, and every month */
      const rows = [], labels = [], pr = [], it = [], bl = [];
      let yInt = 0, yPrin = 0, yPaid = 0;
      plan.rows.forEach((x, idx) => {
        yInt += x[2]; yPrin += x[3]; yPaid += x[1];
        if (x[0] % 12 === 0 || idx === plan.rows.length - 1) {
          const y = Math.ceil(x[0] / 12);
          rows.push([y, yPrin, yInt, x[4]]);
          labels.push(y); pr.push(yPrin); it.push(yInt); bl.push(x[4]);
          yInt = 0; yPrin = 0; yPaid = 0;
        }
      });
      const totalInterest = plan.totalInterest;
      const out = {
        emi, totalInterest, totalPaid: p + totalInterest,
        months: plan.months, tenureYears: plan.months / 12,
        interestSaved: extraPaid ? (floating ? base.totalInterest : emi * n - p) - totalInterest : 0,
        monthsSaved: extraPaid ? (floating ? base.months : n) - plan.months : 0,
        interestRatio: p ? (totalInterest / p) * 100 : 0,
        note: '',
        _table: { title: 'Repayment schedule', head: ['Year', 'Principal paid', 'Interest paid', 'Balance'], cols: ['int', 'currency', 'currency', 'currency'], rows,
          foot: ['Total', p, totalInterest, 0],
          views: [{ id: 'yearly', label: 'Yearly', head: ['Year', 'Principal paid', 'Interest paid', 'Balance'], cols: ['int', 'currency', 'currency', 'currency'], rows, foot: ['Total', p, totalInterest, 0] },
            { id: 'monthly', label: 'Monthly', head: ['Month', 'EMI paid', 'Interest', 'Principal', 'Balance'], cols: ['int', 'currency', 'currency', 'currency', 'currency'], rows: plan.rows, foot: ['Total', p + totalInterest, totalInterest, p, 0] }] },
        _chart: [
          { type: 'bar', title: 'Principal and interest each year', format: 'currency', xLabel: 'Year', labels, totalLabel: 'Paid that year', series: [{ name: 'Principal', values: pr }, { name: 'Interest', values: it, c: 3 }] },
          { type: 'line', title: 'Loan outstanding', format: 'currency', xLabel: 'End of year', labels, series: [{ name: 'Balance', values: bl, area: true }] },
          { type: 'donut', title: 'Total repayment', format: 'currency', center: { label: 'Total paid', value: p + totalInterest }, slices: [{ name: 'Principal', value: p }, { name: 'Interest', value: totalInterest, c: 3 }] }
        ]
      };
      if (opts.step > 0) out.finalEmi = plan.rows.length ? emi * Math.pow(1 + opts.step, Math.floor((plan.months - 1) / 12)) : emi;
      if (floating) { out.emiAfter = plan.after; out.monthsAfterChange = plan.months - changeAt; }
      const fee = p * (Number(feePct) || 0) / 100;
      if (fee > 0) {
        out.fee = fee;
        out.apr = (Math.pow(1 + irr(plan.flows, p - fee), 12) - 1) * 100;
      }
      if (!blank(rateB) || !blank(yearsB)) {
        const rb = blank(rateB) ? Number(rate) : Number(rateB);
        const nb = Math.max(1, Math.min(600, Math.round((blank(yearsB) ? Number(years) : Number(yearsB)) * 12)));
        out.emiB = emiOf(p, rb, nb);
        out.interestB = out.emiB * nb - p;
        out.interestDiff = out.interestB - (emi * n - p);
      }
      return out;
    },
"outputs": [{"key":"emi","label":"Monthly EMI","format":"currency","primary":true},{"key":"totalInterest","label":"Total interest","format":"currency"},{"key":"totalPaid","label":"Total repayment","format":"currency"},{"key":"interestRatio","label":"Interest as % of principal","format":"percent"},{"key":"tenureYears","label":"Paid off in","format":"number","unit":"years"},{"key":"interestSaved","label":"Interest saved by prepaying","format":"currency"},{"key":"monthsSaved","label":"Months saved","format":"number"},{"key":"finalEmi","label":"EMI in the last year","format":"currency"},{"key":"emiAfter","label":"EMI after the rate change","format":"currency"},{"key":"monthsAfterChange","label":"Months left after the change","format":"int"},{"key":"fee","label":"Processing fee","format":"currency"},{"key":"apr","label":"Effective annual cost with the fee","format":"percent"},{"key":"emiB","label":"Other offer: EMI","format":"currency"},{"key":"interestB","label":"Other offer: total interest","format":"currency"},{"key":"interestDiff","label":"Other offer’s interest minus this one’s","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      const P = Number(v.amount) || 0, n = Math.round((Number(v.years) || 0) * 12), i = (Number(v.rate) || 0) / 1200;
      if (!P || !n || r.emi === undefined) return [];
      const L = ['r = ' + f.upto(Number(v.rate) || 0, 4) + '% ÷ 12 ÷ 100 = ' + f.upto(i, 8) + '      n = ' + f.upto(Number(v.years) || 0, 4) + ' × 12 = ' + n];
      L.push(i === 0 ? 'EMI = ' + f.money(P) + ' ÷ ' + n + ' = ' + f.money(r.emi)
        : 'EMI = ' + f.money(P) + ' × ' + f.upto(i, 8) + ' × (1 + ' + f.upto(i, 8) + ')^' + n + ' ÷ ((1 + ' + f.upto(i, 8) + ')^' + n + ' − 1) = ' + f.money(r.emi));
      L.push('total interest = ' + f.money(r.totalPaid) + ' − ' + f.money(P) + ' = ' + f.money(r.totalInterest));
      return L;
    },
"steps": (v, r, f) => {
      const m = r._table && r._table.views ? r._table.views[1].rows : [];
      if (!m.length) return [];
      const a = m[0];
      const S = ['Month 1: interest on ' + f.money(Number(v.amount)) + ' at ' + f.upto(Number(v.rate), 4) + '% ÷ 12 is ' + f.money(a[2]) + '; the rest of the ' + f.money(a[1]) + ' paid, ' + f.money(a[3]) + ', reduces the loan to ' + f.money(a[4]) + '.'];
      if (m[1]) S.push('Month 2: interest is worked out on ' + f.money(a[4]) + ', so it is ' + f.money(m[1][2]) + ' and ' + f.money(m[1][3]) + ' goes to the loan.');
      const y = r._table.rows[0];
      if (y) S.push('Year 1 in all: ' + f.money(y[1]) + ' of principal and ' + f.money(y[2]) + ' of interest.');
      const z = m[m.length - 1];
      S.push('Month ' + z[0] + ': the last payment, ' + f.money(z[1]) + ', closes the loan.');
      return S;
    },
"tips": ["On a 20-year home loan at 8.5%, total interest is close to the principal itself. Tenure matters far more than a small rate difference.","Prepayments made in the early years remove the most interest, because the outstanding balance is highest then.","Floating-rate home loans to individuals cannot carry a prepayment penalty in India. Fixed-rate loans can.","Under the old regime, home loan interest up to ₹2 lakh a year is deductible on a self-occupied property — section 22 of the Income-tax Act, 2025, formerly section 24(b). The new regime does not allow it.","A step-up EMI raises the instalment by a fixed percentage every year, in line with a salary, and closes the loan years early.","When a floating rate is reset, lenders must let you choose between a new EMI and a new tenure (RBI circular of 18 August 2023). Compare both here."],
"faq": [{"q":"Should I reduce the EMI or the tenure when prepaying?","a":"Reducing the tenure saves considerably more interest. Reducing the EMI improves monthly cash flow. Most banks default to keeping the EMI and cutting the tenure, which is usually the better outcome — but confirm, because some do the opposite."},{"q":"How does a processing fee change the cost of the loan?","a":"You repay the whole loan but receive the loan less the fee, so the real yearly cost is higher than the interest rate. Enter the fee as a percentage of the loan, GST included, to see the effective annual cost alongside the EMI."}]
};
})();
