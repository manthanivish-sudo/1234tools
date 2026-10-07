(function(){
window.TOOLS = window.TOOLS || {};
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["ppf-calculator"] = {
"currencyLocked": true,
"currencyNote": "the PPF scheme’s rules",
"currency": "INR",
"title": "PPF Calculator",
"category": "india",
"description": "Public Provident Fund maturity value over 15 years, with the year-by-year balance.",
"keywords": ["PPF calculator","public provident fund","PPF maturity","PPF interest","PPF 15 years"],
"formula": "interest accrues annually on the lowest balance between the 5th and end of month",
"inputs": [{"key":"annual","label":"Annual deposit","type":"number","unit":"₹","default":150000,"min":500,"max":150000},{"key":"rate","label":"Interest rate","type":"number","unit":"%","default":7.1,"step":0.1,"min":0,"max":50},{"key":"years","label":"Period","type":"number","unit":"years","default":15,"min":1,"max":50,"slider":[15,50]}],
"compute": ({ annual, rate, years }) => {
      const a = Math.min(150000, Math.max(0, Number(annual) || 0));
      const r = (Number(rate) || 0) / 100;
      const n = Math.max(1, Math.min(50, Math.round(Number(years) || 15)));

      let balance = 0, invested = 0;
      const rows = [];
      for (let y = 1; y <= n; y++) {
        balance += a; invested += a;
        const interest = balance * r;
        balance += interest;
        rows.push([String(y), cell(a), cell(interest), cell(balance)]);
      }

      return {
        maturity: balance, invested, interest: balance - invested,
        capped: (Number(annual) || 0) > 150000
          ? 'Deposits above ₹1.5 lakh a year are not permitted — capped for this calculation.' : '',
        _table: { head: ['Year', 'Deposit', 'Interest', 'Balance'], cols: ['text', 'currency', 'currency', 'currency'], rows }
      };
    },
"outputs": [{"key":"maturity","label":"Maturity value","format":"currency","primary":true},{"key":"invested","label":"Total deposited","format":"currency"},{"key":"interest","label":"Interest earned","format":"currency"},{"key":"capped","label":"","format":"text"}],
"filled": (v, r, f) => {
      const a = Math.min(150000, Math.max(0, Number(v.annual) || 0));
      return ['each year: (balance + ' + f.money(a) + ') × (1 + ' + f.upto(Number(v.rate) / 100, 6) + ')', 'after ' + Math.round(Number(v.years) || 15) + ' years: ' + f.money(r.maturity) + ', of which ' + f.money(r.interest) + ' is interest'];
    },
"tips": ["PPF is EEE: the deposit qualifies for the ₹1.5 lakh deduction (section 123 of the Income-tax Act, 2025, formerly 80C), the interest is exempt and the maturity amount is tax-free. Few instruments still offer all three.","The rate is set quarterly by the government and has moved over time, so treat any projection over fifteen years as indicative.","Interest is calculated on the lowest balance between the 5th and the last day of each month, so depositing before the 5th earns an extra month of interest.","The maximum is ₹1.5 lakh per financial year across all PPF accounts you hold. The account runs 15 years and can be extended in blocks of 5."],
"faq": [{"q":"Is PPF worth it under the new tax regime?","a":"The 80C deduction is not available under the new regime, which removes part of the appeal. The tax-free interest and maturity remain, so it still functions as a safe, tax-free long-term instrument — just with a weaker case than before."}]
};
})();