(function(){
window.TOOLS = window.TOOLS || {};
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["amortization-schedule"] = {
"currency": "GBP",
"title": "Loan Amortisation Schedule",
"category": "business",
"description": "Principal, interest and balance month by month for five years or year by year to the end, with overpayments.",
"keywords": ["amortization schedule","amortisation calculator","loan schedule","mortgage schedule","principal and interest breakdown"],
"formula": "M = P · [r(1+r)ⁿ] / [(1+r)ⁿ − 1]",
"inputs": [{"key":"amount","label":"Loan amount","type":"number","unit":"£","default":200000,"min":0},{"key":"rate","label":"Annual interest rate","type":"number","unit":"%","default":5.5,"step":0.01,"min":0,"max":100,"slider":[1,15]},{"key":"years","label":"Term","type":"number","unit":"years","default":25,"min":0,"max":100,"slider":[1,40]},{"key":"overpay","label":"Extra payment each month","type":"number","unit":"£","default":0,"min":0},{"key":"view","label":"Schedule detail","type":"select","options":[{"value":"annual","label":"Annual summary"},{"value":"monthly","label":"Monthly (first 5 years)"}],"default":"annual"}],
"compute": ({ amount, rate, years, overpay, view }) => {
      if (!amount || !years) return { note: 'Enter a loan amount and a term.' };
      const r = rate / 100 / 12;
      const n = Math.round(years * 12);
      const base = r === 0 ? amount / n : amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      const pay = base + (Number(overpay) || 0);

      let balance = amount, totalInterest = 0, months = 0;
      const rows = [], yearly = [], monthly = [];
      let yInt = 0, yPrin = 0;

      while (balance > 0.005 && months < 1200) {
        const interest = balance * r;
        let principal = pay - interest;
        if (principal <= 0) return { note: 'The payment does not cover the interest, so the balance would never reduce.' };
        if (principal > balance) principal = balance;

        balance -= principal;
        totalInterest += interest;
        yInt += interest; yPrin += principal;
        months++;

        /* every month for the page's monthly view; the first five years, as
           before, when the Schedule detail asks for months */
        monthly.push([String(months), cell(interest + principal), cell(principal), cell(interest), cell(balance)]);
        if (view === 'monthly' && months <= 60) rows.push(monthly[monthly.length - 1]);
        if (months % 12 === 0 || balance <= 0.005) {
          const y = [String(Math.ceil(months / 12)), cell(yPrin + yInt), cell(yPrin), cell(yInt), cell(balance)];
          yearly.push(y);
          if (view === 'annual') rows.push(y);
          yInt = 0; yPrin = 0;
        }
      }

      const baseTotal = base * n;
      return {
        monthly: base,
        withOverpay: pay,
        totalInterest,
        totalPaid: amount + totalInterest,
        months,
        payoffYears: months / 12,
        interestSaved: overpay > 0 ? (baseTotal - amount) - totalInterest : 0,
        monthsSaved: overpay > 0 ? n - months : 0,
        note: '',
        _table: {
          head: view === 'monthly'
            ? ['Month', 'Payment', 'Principal', 'Interest', 'Balance']
            : ['Year', 'Paid', 'Principal', 'Interest', 'Balance'],
          cols: ['text', 'currency', 'currency', 'currency', 'currency'],
          rows,
          foot: ['Total', amount + totalInterest, amount, totalInterest, 0],
          views: (function () {
            const cols = ['text', 'currency', 'currency', 'currency', 'currency'], foot = ['Total', amount + totalInterest, amount, totalInterest, 0];
            const y = { id: 'yearly', label: 'Yearly', head: ['Year', 'Paid', 'Principal', 'Interest', 'Balance'], cols, rows: yearly, foot };
            const m = { id: 'monthly', label: 'Monthly', head: ['Month', 'Payment', 'Principal', 'Interest', 'Balance'], cols, rows: monthly, foot };
            return view === 'monthly' ? [m, y] : [y, m];
          })()
        },
        _chart: [
          { type: 'bar', title: 'Principal and interest each year', format: 'currency', xLabel: 'Year', labels: yearly.map((x) => Number(x[0])), totalLabel: 'Paid that year',
            series: [{ name: 'Principal', values: yearly.map((x) => x[2]) }, { name: 'Interest', values: yearly.map((x) => x[3]), c: 3 }] },
          { type: 'line', title: 'Balance left', format: 'currency', xLabel: 'End of year', labels: yearly.map((x) => Number(x[0])), series: [{ name: 'Balance', values: yearly.map((x) => x[4]), area: true }] }
        ]
      };
    },
"outputs": [{"key":"monthly","label":"Contractual monthly payment","format":"currency","primary":true},{"key":"withOverpay","label":"Payment including overpayment","format":"currency"},{"key":"totalInterest","label":"Total interest","format":"currency"},{"key":"totalPaid","label":"Total repaid","format":"currency"},{"key":"payoffYears","label":"Paid off in","format":"number","unit":"years"},{"key":"interestSaved","label":"Interest saved by overpaying","format":"currency"},{"key":"monthsSaved","label":"Months saved","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      const P = Number(v.amount) || 0, i = (Number(v.rate) || 0) / 1200, n = Math.round((Number(v.years) || 0) * 12);
      if (!P || !n || r.monthly === undefined) return [];
      const L = ['r = ' + f.upto(Number(v.rate) || 0, 4) + '% ÷ 12 = ' + f.upto(i, 8) + '      n = ' + n];
      L.push(i === 0 ? 'M = ' + f.money(P) + ' ÷ ' + n + ' = ' + f.money(r.monthly) : 'M = ' + f.money(P) + ' × ' + f.upto(i, 8) + ' × (1 + ' + f.upto(i, 8) + ')^' + n + ' ÷ ((1 + ' + f.upto(i, 8) + ')^' + n + ' − 1) = ' + f.money(r.monthly));
      if (Number(v.overpay) > 0) L.push('with the overpayment: ' + f.money(r.monthly) + ' + ' + f.money(Number(v.overpay)) + ' = ' + f.money(r.withOverpay) + ' a month, paid off in ' + r.months + ' months');
      return L;
    },
"tips": ["Early payments are mostly interest because interest is charged on the outstanding balance, which is highest at the start.","An overpayment goes entirely to principal, so it removes all the future interest that principal would have accrued. Small, early overpayments do the most work.","Check for early repayment charges before overpaying. Many fixed-rate deals cap annual overpayments at 10%."],
"faq": [{"q":"Should I shorten the term or reduce the payment?","a":"Shortening the term saves far more interest, because the balance falls faster. Reducing the payment improves monthly cash flow instead. Which is right depends on whether your constraint is total cost or monthly affordability."}]
};
})();