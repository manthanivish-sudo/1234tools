(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["discount-calculator"] = {
"currency": "GBP",
"title": "Discount & Sale Price Calculator",
"category": "business",
"description": "Apply single or stacked discounts and see the effective discount and the margin impact.",
"keywords": ["discount calculator","sale price calculator","percentage off","stacked discount","markdown calculator"],
"formula": "sale price = original × (1 − d₁) × (1 − d₂) …",
"inputs": [{"key":"original","label":"Original price","type":"number","unit":"£","default":200,"min":0},{"key":"d1","label":"Discount 1","type":"number","unit":"%","default":20,"step":0.01,"min":0,"max":100},{"key":"d2","label":"Discount 2 (stacked)","type":"number","unit":"%","default":0,"step":0.01,"min":0,"max":100},{"key":"cost","label":"Unit cost (optional)","type":"number","unit":"£","default":100,"min":0}],
"compute": ({ original, d1, d2, cost }) => {
      const after1 = original * (1 - d1 / 100);
      const final = after1 * (1 - d2 / 100);
      const saved = original - final;
      const effective = original ? (saved / original) * 100 : 0;
      return {
        final, saved, effective,
        naiveSum: d1 + d2,
        marginBefore: original && cost ? ((original - cost) / original) * 100 : NaN,
        marginAfter: final && cost ? ((final - cost) / final) * 100 : NaN,
        profitAfter: cost ? final - cost : NaN
      };
    },
"outputs": [{"key":"final","label":"Final price","format":"currency","primary":true},{"key":"saved","label":"Total saved","format":"currency"},{"key":"effective","label":"Effective discount","format":"percent"},{"key":"naiveSum","label":"Sum of the two discounts","format":"percent"},{"key":"marginBefore","label":"Margin before discount","format":"percent"},{"key":"marginAfter","label":"Margin after discount","format":"percent"},{"key":"profitAfter","label":"Profit per unit after discount","format":"currency"}],
"filled": (v, r, f) => {
      const L = ['after ' + f.upto(Number(v.d1), 4) + '% off: ' + f.money(Number(v.original)) + ' × (1 − ' + f.upto(Number(v.d1) / 100, 6) + ') = ' + f.money(Number(v.original) * (1 - Number(v.d1) / 100))];
      if (Number(v.d2)) L.push('then ' + f.upto(Number(v.d2), 4) + '% off that: × (1 − ' + f.upto(Number(v.d2) / 100, 6) + ') = ' + f.money(r.final));
      L.push('saved ' + f.money(r.saved) + ', ' + f.pct(r.effective) + ' of the original');
      return L;
    },
"tips": ["Stacked discounts do not add. 20% then 20% is 36% off, not 40%, because the second applies to an already-reduced price.","Discounts hit margin far harder than they hit price. On a 50% margin, a 20% discount removes 40% of your profit per unit.","To hold profit steady after a discount you must sell disproportionately more units. Check the volume required before running the promotion."],
"faq": [{"q":"How much extra volume does a discount need?","a":"Divide the current contribution per unit by the post-discount contribution. On a 50% margin, a 20% discount cuts contribution from 50 to 30 per 100 of price, so you need roughly 67% more unit sales just to stand still."}]
};
})();