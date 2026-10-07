(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["fd-rd-calculator"] = {
"currencyLocked": true,
"currencyNote": "Indian deposit and TDS rules",
"currency": "INR",
"title": "FD & RD Calculator",
"category": "india",
"description": "Fixed and recurring deposit maturity with quarterly compounding, and what is left after tax at your slab rate.",
"keywords": ["FD calculator","fixed deposit calculator","RD calculator","recurring deposit","FD interest","FD maturity"],
"formula": "FD: A = P(1 + r/4)^(4t)   ·   RD compounds each instalment quarterly",
"inputs": [{"key":"type","label":"Deposit type","type":"select","options":[{"value":"fd","label":"Fixed deposit (lump sum)"},{"value":"rd","label":"Recurring deposit (monthly)"}],"default":"fd"},{"key":"amount","label":"Deposit amount","type":"number","unit":"₹","default":500000,"min":0},{"key":"rate","label":"Interest rate","type":"number","unit":"%","default":7,"step":0.05,"min":0,"max":50,"slider":[3,10]},{"key":"years","label":"Tenure","type":"number","unit":"years","default":5,"min":0,"max":50,"step":0.25,"slider":[1,10]},{"key":"slabRate","label":"Your income tax slab rate","type":"number","unit":"%","default":30,"min":0}],
"compute": ({ type, amount, rate, years, slabRate }) => {
      const p = Number(amount) || 0;
      const r = (Number(rate) || 0) / 100;
      const t = Number(years) || 0;

      let maturity, invested;
      if (type === 'fd') {
        invested = p;
        maturity = p * Math.pow(1 + r / 4, 4 * t);
      } else {
        const n = Math.max(0, Math.min(600, Math.round(t * 12)));
        invested = p * n;
        maturity = 0;
        for (let m = 0; m < n; m++) {
          const remaining = (n - m) / 12;
          maturity += p * Math.pow(1 + r / 4, 4 * remaining);
        }
      }

      const interest = maturity - invested;
      const tax = interest * ((Number(slabRate) || 0) / 100);

      return {
        maturity, invested, interest,
        tax, afterTax: maturity - tax,
        effectiveRate: t > 0 && invested > 0
          ? (Math.pow((maturity - tax) / invested, 1 / t) - 1) * 100 : NaN
      };
    },
"outputs": [{"key":"maturity","label":"Maturity amount","format":"currency","primary":true},{"key":"invested","label":"Total deposited","format":"currency"},{"key":"interest","label":"Interest earned","format":"currency"},{"key":"tax","label":"Tax on interest","format":"currency"},{"key":"afterTax","label":"Maturity after tax","format":"currency"},{"key":"effectiveRate","label":"Post-tax annualised return","format":"percent"}],
"filled": (v, r, f) => {
      const p = Number(v.amount) || 0, q = (Number(v.rate) || 0) / 400, t = Number(v.years) || 0;
      const L = v.type === 'rd'
        ? ['each monthly ' + f.money(p) + ' grows at (1 + ' + f.upto(q, 6) + ')^(4 × years left); the ' + Math.round(t * 12) + ' instalments add up to ' + f.money(r.maturity)]
        : ['A = ' + f.money(p) + ' × (1 + ' + f.upto(Number(v.rate), 4) + '% ÷ 4)^(4 × ' + f.upto(t, 4) + ') = ' + f.money(r.maturity)];
      L.push('tax at ' + f.upto(Number(v.slabRate), 2) + '% on ' + f.money(r.interest) + ' = ' + f.money(r.tax) + ', leaving ' + f.money(r.afterTax));
      return L;
    },
"tips": ["FD interest is fully taxable at your slab rate, which is why a 7% FD returns only about 5% a year after tax for someone in the 30% bracket.","Banks deduct TDS once interest exceeds the annual threshold, but TDS is not the final tax — the balance is still due at your slab rate.","Most banks compound quarterly, which is what this uses. Some products pay simple interest or pay out monthly; check before comparing.","Breaking an FD early usually costs a penalty of 0.5% to 1% on the applicable rate."],
"faq": [{"q":"Why is my RD maturity lower than an FD of the same total?","a":"Because each RD instalment is invested for a shorter period. The first earns interest for the full term, the last for barely a month, so the average holding period is roughly half the tenure."}]
};
})();