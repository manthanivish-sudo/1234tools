(function(){
/* A fixed-rate loan repaid monthly, with what people actually do to one:
   overpay every month, pay a lump sum once, come off a fixed rate onto a
   different one, pay an arrangement fee (or add it to the loan).

   The payment is the annuity M = P·i·(1+i)ⁿ / ((1+i)ⁿ − 1), i = rate ÷ 12.
   Overpayments keep the payment and shorten the term, which is what UK
   lenders do by default. When the rate changes, the payment is worked out
   again on the balance left over the months left, as a mortgage does when
   a fixed deal ends.

   APR: the annual percentage rate of charge as the FCA defines it (CONC
   App 1.2.6R): the yearly rate X at which the money received equals the
   payments made, each discounted by (1 + X)^t with t in years and a month
   counted as 1/12 of one (CONC App 1.2.7R). With monthly payments that is
   X = (1 + j)¹² − 1, j the monthly rate that discounts the payments to
   the amount actually received (the loan less any fee paid up front). */
function payment(P, annual, n) {
  const i = annual / 1200;
  if (n <= 0) return 0;
  return i === 0 ? P / n : P * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1);
}
/* the month-by-month run of a loan */
function amortise(o) {
  let bal = o.principal, M = payment(o.principal, o.rate, o.months);
  const first = M;
  let after = null, interest = 0, paid = 0, k = 0;
  const eps = Math.max(1e-7, o.principal * 1e-10);
  const flows = [], rows = [];
  while (bal > eps && k < 1200) {
    k++;
    if (o.changeAt && k === o.changeAt + 1 && o.rateAfter !== null) {
      M = payment(bal, o.rateAfter, Math.max(1, o.months - o.changeAt));
      after = M;
    }
    const r = o.changeAt && k > o.changeAt && o.rateAfter !== null ? o.rateAfter : o.rate;
    const int = bal * r / 1200;
    if (k > o.months && !(o.extra > 0 || o.lump > 0)) break;
    let pay = M + (o.extra || 0) + (k === o.lumpMonth ? (o.lump || 0) : 0);
    if (pay > bal + int) pay = bal + int;
    bal = bal + int - pay;
    if (Math.abs(bal) < eps) bal = 0;
    interest += int; paid += pay;
    flows.push(pay);
    rows.push([k, pay, int, pay - int, bal]);
    if (pay <= int && k > 1) return { stuck: true };
  }
  return { first, after, interest, paid, months: k, flows, rows };
}
/* the monthly rate j at which the payments are worth `net` today */
function irr(flows, net) {
  let lo = 0, hi = 1;
  const pv = (j) => flows.reduce((s, c, t) => s + c / Math.pow(1 + j, t + 1), 0);
  if (pv(0) <= net) return 0;
  for (let it = 0; it < 200; it++) { const mid = (lo + hi) / 2; if (pv(mid) > net) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
const blank = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v));
const ym = (m) => { const y = Math.floor(m / 12), r = m % 12; return (y ? y + (y === 1 ? ' year' : ' years') : '') + (y && r ? ' ' : '') + (r || !y ? r + (r === 1 ? ' month' : ' months') : ''); };

window.TOOLS = window.TOOLS || {};
window.TOOLS["loan-payment"] = {
"currency": "GBP",
"title": "Loan Payment Calculator",
"category": "finance",
"icon": "🏦",
"description": "Calculate monthly loan payments, total interest paid, and the full cost of borrowing.",
"keywords": ["loan calculator","monthly payment","mortgage payment","amortization"],
"formula": "M = P · [r(1+r)^n] / [(1+r)^n − 1]",
"inputs": [{"key":"amount","label":"Loan Amount","type":"number","unit":"£","default":250000,"min":0},{"key":"rate","label":"Annual Interest Rate","type":"number","unit":"%","default":6.5,"step":0.01,"min":0,"max":100,"slider":[0,25]},{"key":"years","label":"Loan Term","type":"number","unit":"years","default":30,"min":0,"max":100,"slider":{"min":1,"max":40,"step":1}},
  {"key":"extra","label":"Overpay every month","type":"number","unit":"£","default":0,"min":0,"group":"Overpayments"},{"key":"lump","label":"One-off overpayment","type":"number","unit":"£","default":0,"min":0,"group":"Overpayments"},{"key":"lumpMonth","label":"Paid in month","type":"number","default":12,"min":1,"max":1200,"integer":true,"group":"Overpayments"},
  {"key":"fixedYears","label":"Rate changes after","type":"number","unit":"years","default":0,"min":0,"max":100,"group":"Rate change","hint":"0 keeps one rate for the whole term."},{"key":"rateAfter","label":"New rate","type":"number","unit":"%","default":null,"optional":true,"placeholder":"Same rate throughout","min":0,"max":100,"step":0.01,"group":"Rate change"},
  {"key":"fees","label":"Arrangement fees","type":"number","unit":"£","default":0,"min":0,"group":"Fees and APR"},{"key":"feeHow","label":"Fees are","type":"select","options":[{"value":"upfront","label":"Paid up front"},{"value":"added","label":"Added to the loan"}],"default":"upfront","group":"Fees and APR"},
  {"key":"rateB","label":"Second loan’s rate","type":"number","unit":"%","default":null,"optional":true,"placeholder":"Leave blank to skip","min":0,"max":100,"step":0.01,"group":"Compare with a second loan"},{"key":"yearsB","label":"Second loan’s term","type":"number","unit":"years","default":null,"optional":true,"placeholder":"Same term","min":0,"max":100,"group":"Compare with a second loan"},{"key":"amountB","label":"Second loan’s amount","type":"number","unit":"£","default":null,"optional":true,"placeholder":"Same amount","min":0,"group":"Compare with a second loan"}],
"compute": ({ amount, rate, years, extra, lump, lumpMonth, fixedYears, rateAfter, fees, feeHow, rateB, yearsB, amountB }) => {
      const monthlyRate = rate / 100 / 12;
      const n = years * 12;
      const monthly = monthlyRate === 0
        ? amount / n
        : amount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
      const totalPaid = monthly * n;
      const out = {
        monthly,
        totalPaid,
        totalInterest: totalPaid - amount,
        interestRatio: ((totalPaid - amount) / amount) * 100
      };

      const X = Number(extra) || 0, L = Number(lump) || 0, Fee = Number(fees) || 0;
      const changeAt = Math.round((Number(fixedYears) || 0) * 12);
      const after = changeAt > 0 && changeAt < n && !blank(rateAfter) ? Number(rateAfter) : null;
      const added = feeHow === 'added' && Fee > 0;
      const months = Math.round(n);
      if (!(amount > 0) || !(months > 0)) return out;

      const plan = amortise({ principal: amount + (added ? Fee : 0), rate: Number(rate) || 0, months, extra: X, lump: L, lumpMonth: Math.round(Number(lumpMonth) || 0), changeAt, rateAfter: after });
      if (plan.stuck) return { _invalid: { rateAfter: 'At this rate the payment does not cover the interest.' } };
      const plain = X === 0 && L === 0 && after === null && !added;
      if (!plain) {
        out.monthly = plan.first;
        out.totalPaid = plan.paid;
        out.totalInterest = plan.interest;
        out.interestRatio = plan.interest / amount * 100;
      }
      if (after !== null) out.monthlyAfter = plan.after;
      if (X > 0 || L > 0) {
        const base = amortise({ principal: amount + (added ? Fee : 0), rate: Number(rate) || 0, months, extra: 0, lump: 0, lumpMonth: 0, changeAt, rateAfter: after });
        out.payoff = ym(plan.months);
        out.monthsSaved = months - plan.months;
        out.interestSaved = base.interest - plan.interest;
      }
      if (Fee > 0) {
        const net = amount - (added ? 0 : Fee);
        const j = irr(plan.flows, added ? amount : net);
        out.apr = (Math.pow(1 + j, 12) - 1) * 100;
        out.costOfCredit = plan.paid + (added ? 0 : Fee) - amount;
      }
      if (!blank(rateB) || !blank(yearsB) || !blank(amountB)) {
        const rb = blank(rateB) ? Number(rate) : Number(rateB);
        const yb = blank(yearsB) ? Number(years) : Number(yearsB);
        const ab = blank(amountB) ? Number(amount) : Number(amountB);
        const mb = payment(ab, rb, Math.round(yb * 12));
        out.monthlyB = mb;
        out.totalInterestB = mb * Math.round(yb * 12) - ab;
        out.interestDiff = out.totalInterestB - out.totalInterest;
      }

      /* the schedule, yearly and monthly, and the charts */
      const yr = [], labels = [], prin = [], ints = [], bals = [];
      let py = 0, pi = 0, pp = 0;
      plan.rows.forEach((row, idx) => {
        py += row[1]; pi += row[2]; pp += row[3];
        if (row[0] % 12 === 0 || idx === plan.rows.length - 1) {
          const y = Math.ceil(row[0] / 12);
          yr.push([y, py, pi, pp, row[4]]);
          labels.push(y); prin.push(pp); ints.push(pi); bals.push(row[4]);
          py = 0; pi = 0; pp = 0;
        }
      });
      const head = ['Payment', 'Interest', 'Principal', 'Balance'];
      const cols = ['int', 'currency', 'currency', 'currency', 'currency'];
      const foot = ['Total', plan.paid, plan.interest, plan.paid - plan.interest, 0];
      out._table = { title: 'Repayment schedule', head: ['Year', 'Paid'].concat(head.slice(1)), cols, rows: yr, foot,
        views: [{ id: 'yearly', label: 'Yearly', head: ['Year', 'Paid'].concat(head.slice(1)), cols, rows: yr, foot },
          { id: 'monthly', label: 'Monthly', head: ['Month'].concat(head), cols, rows: plan.rows, foot }] };
      out._chart = [
        { type: 'bar', title: 'Each year’s payments', format: 'currency', xLabel: 'Year', labels, totalLabel: 'Paid that year',
          series: [{ name: 'Principal', values: prin }, { name: 'Interest', values: ints, c: 3 }] },
        { type: 'line', title: 'Balance left', format: 'currency', xLabel: 'End of year', labels, series: [{ name: 'Balance', values: bals, area: true }] },
        { type: 'donut', title: 'Where the money goes', format: 'currency', center: { label: 'Total paid', value: plan.paid + (added ? 0 : Fee) },
          slices: [{ name: 'Amount borrowed', value: amount }, { name: 'Interest', value: plan.interest, c: 3 }].concat(Fee > 0 ? [{ name: 'Fees', value: Fee, c: 1 }] : []) }
      ];
      return out;
    },
"outputs": [{"key":"monthly","label":"Monthly Payment","format":"currency","primary":true},{"key":"totalPaid","label":"Total Paid Over Term","format":"currency"},{"key":"totalInterest","label":"Total Interest","format":"currency"},{"key":"interestRatio","label":"Interest as % of Principal","format":"percent"},{"key":"monthlyAfter","label":"Monthly payment after the rate change","format":"currency"},{"key":"payoff","label":"Paid off in","format":"text"},{"key":"interestSaved","label":"Interest saved by overpaying","format":"currency"},{"key":"apr","label":"APR including fees","format":"percent"},{"key":"costOfCredit","label":"Total cost of credit (interest and fees)","format":"currency"},{"key":"monthlyB","label":"Second loan: monthly payment","format":"currency"},{"key":"totalInterestB","label":"Second loan: total interest","format":"currency"},{"key":"interestDiff","label":"Second loan’s interest minus the first’s","format":"currency"}],
"filled": (v, r, f) => {
      const P = Number(v.amount) || 0, i = (Number(v.rate) || 0) / 1200, n = Math.round((Number(v.years) || 0) * 12);
      const added = v.feeHow === 'added' && Number(v.fees) > 0;
      const PP = P + (added ? Number(v.fees) : 0);
      const L = [];
      L.push('r = ' + f.upto(Number(v.rate) || 0, 4) + '% ÷ 12 = ' + f.upto(i, 8) + '      n = ' + f.upto(Number(v.years) || 0, 4) + ' × 12 = ' + n);
      if (i === 0) L.push('M = ' + f.money(PP) + ' ÷ ' + n + ' = ' + f.money(r.monthly));
      else L.push('M = ' + f.money(PP) + ' × ' + f.upto(i, 8) + ' × (1 + ' + f.upto(i, 8) + ')^' + n + ' ÷ ((1 + ' + f.upto(i, 8) + ')^' + n + ' − 1) = ' + f.money(r.monthly));
      L.push('total interest = ' + f.money(r.totalPaid) + ' − ' + f.money(PP) + ' = ' + f.money(r.totalInterest));
      return L;
    },
"steps": (v, r, f) => {
      const rows = r._table && r._table.views ? r._table.views[1].rows : [];
      if (!rows.length) return [];
      const a = rows[0];
      const S = ['Month 1: interest is ' + f.money(Number(v.amount) + (v.feeHow === 'added' ? Number(v.fees) || 0 : 0)) + ' × ' + f.upto(Number(v.rate) || 0, 4) + '% ÷ 12 = ' + f.money(a[2]) + ', so ' + f.money(a[1]) + ' − ' + f.money(a[2]) + ' = ' + f.money(a[3]) + ' repays the loan, leaving ' + f.money(a[4]) + '.'];
      if (rows[1]) S.push('Month 2: interest is charged on ' + f.money(a[4]) + ', so it falls to ' + f.money(rows[1][2]) + ' and ' + f.money(rows[1][3]) + ' repays the loan.');
      const z = rows[rows.length - 1];
      S.push('Month ' + z[0] + ': the last payment, ' + f.money(z[1]) + ', clears the balance.');
      if (r.apr !== undefined) S.push('APR: the yearly rate X at which the payments, each divided by (1 + X)^(month ÷ 12), add up to the ' + f.money(Number(v.amount) - (v.feeHow === 'added' ? 0 : Number(v.fees))) + ' you actually receive: ' + f.pct(r.apr, 2) + '.');
      return S;
    },
"tips": ["Shortening the term raises the monthly payment but usually cuts total interest dramatically.","This covers principal, interest and any arrangement fee you enter. Property tax and insurance are additional.","Extra payments applied to principal reduce total interest more the earlier they are made.","Overpayments here keep the monthly payment and shorten the term. Many fixed-rate deals cap overpayments at 10% of the balance a year before a charge applies.","When a fixed rate ends, the payment is worked out again on the balance left, over the years left, at the new rate."],
"faq": [{"q":"Why is so much of an early payment interest?","a":"Interest is charged on the outstanding balance, which is highest at the start. As the balance falls, a growing share of each fixed payment goes to principal."},{"q":"What is the APR, and why is it higher than the rate?","a":"The APR folds the fees into the rate: it is the yearly rate at which everything you repay is worth exactly what you received. A £999 fee on a £250,000, 30-year loan at 6.5% lifts the APR above the 6.5% interest rate even though the payment is the same."}]
};
})();
