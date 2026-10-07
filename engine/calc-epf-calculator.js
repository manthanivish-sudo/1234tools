(function(){
window.TOOLS = window.TOOLS || {};
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["epf-calculator"] = {
"currencyLocked": true,
"currencyNote": "the EPF scheme’s rules",
"currency": "INR",
"title": "EPF Calculator",
"category": "india",
"description": "Employees’ Provident Fund corpus at retirement, including the employer’s split into EPF and EPS.",
"keywords": ["EPF calculator","provident fund calculator","PF maturity","EPF interest","employee provident fund"],
"formula": "employee 12% of basic; employer 12% split 8.33% to EPS (capped) and the rest to EPF",
"inputs": [{"key":"basic","label":"Monthly basic + DA","type":"number","unit":"₹","default":50000,"min":0},{"key":"age","label":"Current age","type":"number","default":30,"min":15,"max":60},{"key":"retire","label":"Retirement age","type":"number","default":58,"min":40,"max":70,"slider":[50,65]},{"key":"rate","label":"EPF interest rate","type":"number","unit":"%","default":8.25,"step":0.05,"min":0,"max":30},{"key":"growth","label":"Annual salary growth","type":"number","unit":"%","default":7,"step":0.5,"min":0,"max":50},{"key":"existing","label":"Existing EPF balance","type":"number","unit":"₹","default":0,"min":0}],
"compute": ({ basic, age, retire, rate, growth, existing }) => {
      const years = Math.max(0, Math.min(60, (Number(retire) || 58) - (Number(age) || 30)));
      const r = (Number(rate) || 0) / 100 / 12;
      const g = (Number(growth) || 0) / 100;

      let salary = Number(basic) || 0;
      let balance = Number(existing) || 0;
      let employeeTotal = 0, employerEPF = 0, epsTotal = 0;
      const rows = [];

      for (let y = 1; y <= years; y++) {
        for (let m = 1; m <= 12; m++) {
          const emp = salary * 0.12;
          // EPS is 8.33% of basic capped at a ₹15,000 pensionable salary
          const eps = Math.min(salary, 15000) * 0.0833;
          const empr = salary * 0.12 - eps;
          balance = (balance + emp + empr) * (1 + r);
          employeeTotal += emp; employerEPF += empr; epsTotal += eps;
        }
        rows.push([String(y), cell(salary), cell(employeeTotal + employerEPF), cell(balance)]);
        salary *= (1 + g);
      }

      return {
        corpus: balance,
        employeeTotal, employerEPF, epsTotal,
        interest: balance - employeeTotal - employerEPF - (Number(existing) || 0),
        years,
        _table: rows.length ? { head: ['Year', 'Monthly basic', 'Contributions to date', 'EPF balance'], cols: ['text', 'currency', 'currency', 'currency'], rows } : null
      };
    },
"outputs": [{"key":"corpus","label":"EPF corpus at retirement","format":"currency","primary":true},{"key":"employeeTotal","label":"Your contributions","format":"currency"},{"key":"employerEPF","label":"Employer contribution to EPF","format":"currency"},{"key":"epsTotal","label":"Diverted to EPS (pension)","format":"currency"},{"key":"interest","label":"Interest earned","format":"currency"},{"key":"years","label":"Years to retirement","format":"number"}],
"filled": (v, r, f) => {
      const b = Number(v.basic) || 0;
      return ['each month: you 12% = ' + f.money(b * 0.12) + '; employer 12% = ' + f.money(b * 0.12) + ', of which ' + f.money(Math.min(b, 15000) * 0.0833) + ' (8.33% of up to ' + f.money(15000) + ') goes to EPS',
        'interest ' + f.upto(Number(v.rate), 4) + '% ÷ 12 a month on the balance, for ' + r.years + ' years: corpus ' + f.money(r.corpus)];
    },
"tips": ["Of the employer’s 12%, a share equal to 8.33% of pensionable salary goes to the Employees’ Pension Scheme rather than your EPF balance. EPS is capped at a ₹15,000 pensionable salary, so above that the whole excess flows to EPF.","The EPF rate is declared annually by EPFO and has drifted down over the years. A projection to retirement is indicative, not a quotation.","Withdrawal is tax-free after five years of continuous service. Withdrawing earlier makes it taxable and may attract TDS.","Voluntary Provident Fund lets you contribute more than 12% at the same rate, though interest on contributions above ₹2.5 lakh a year is taxable."],
"faq": [{"q":"What happens to EPS?","a":"It funds a monthly pension after 58, subject to at least ten years of eligible service. The pension is calculated on pensionable salary and service, not on the balance accumulated, so it is not simply your money back."}]
};
})();