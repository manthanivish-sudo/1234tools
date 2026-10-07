(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["profit-margin"] = {
"currency": "GBP",
"title": "Profit Margin & Markup Calculator",
"category": "business",
"description": "Work out selling price, cost, margin and markup from any two of cost, price and margin. Margin and markup are not the same thing.",
"keywords": ["profit margin calculator","markup calculator","gross margin","margin vs markup","selling price calculator"],
"formula": "margin = (price − cost) / price   ·   markup = (price − cost) / cost",
"inputs": [{"key":"solve","label":"Solve for","type":"select","options":[{"value":"price","label":"Selling price (from cost + margin)"},{"value":"margin","label":"Margin & markup (from cost + price)"},{"value":"cost","label":"Cost (from price + margin)"}],"default":"price"},{"key":"cost","label":"Unit cost","type":"number","unit":"£","default":60,"min":0},{"key":"price","label":"Selling price","type":"number","unit":"£","default":100,"min":0},{"key":"margin","label":"Target margin","type":"number","unit":"%","default":40,"step":0.01,"max":99.99},{"key":"units","label":"Units sold","type":"number","default":1000,"min":0}],
"compute": ({ solve, cost, price, margin, units }) => {
      let c = Number(cost) || 0, p = Number(price) || 0, m = Number(margin) || 0;

      if (solve === 'price') {
        if (m >= 100) return { note: 'A margin of 100% or more is impossible — margin is a share of the selling price.' };
        p = c / (1 - m / 100);
      } else if (solve === 'cost') {
        if (m >= 100) return { note: 'A margin of 100% or more is impossible — margin is a share of the selling price.' };
        c = p * (1 - m / 100);
      }

      const profit = p - c;
      const marginPct = p === 0 ? NaN : (profit / p) * 100;
      const markupPct = c === 0 ? NaN : (profit / c) * 100;

      return {
        price: p, cost: c, profit,
        marginPct, markupPct,
        multiplier: c === 0 ? NaN : p / c,
        totalRevenue: p * units,
        totalProfit: profit * units,
        note: ''
      };
    },
"outputs": [{"key":"price","label":"Selling price","format":"currency","primary":true},{"key":"cost","label":"Unit cost","format":"currency"},{"key":"profit","label":"Profit per unit","format":"currency"},{"key":"marginPct","label":"Margin (% of price)","format":"percent"},{"key":"markupPct","label":"Markup (% of cost)","format":"percent"},{"key":"multiplier","label":"Price multiplier","format":"number"},{"key":"totalRevenue","label":"Total revenue","format":"currency"},{"key":"totalProfit","label":"Total profit","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.profit === undefined ? [] : [
      v.solve === 'price' ? 'price = ' + f.money(r.cost) + ' ÷ (1 − ' + f.upto(Number(v.margin) / 100, 6) + ') = ' + f.money(r.price)
        : v.solve === 'cost' ? 'cost = ' + f.money(r.price) + ' × (1 − ' + f.upto(Number(v.margin) / 100, 6) + ') = ' + f.money(r.cost) : 'profit = ' + f.money(r.price) + ' − ' + f.money(r.cost) + ' = ' + f.money(r.profit),
      'margin = ' + f.money(r.profit) + ' ÷ ' + f.money(r.price) + ' = ' + f.pct(r.marginPct) + '; markup = ' + f.money(r.profit) + ' ÷ ' + f.money(r.cost) + ' = ' + f.pct(r.markupPct)],
"tips": ["Margin and markup are routinely confused, and the gap widens fast: a 50% markup is only a 33.3% margin, and a 100% markup is a 50% margin.","Margin is a share of the selling price; markup is a share of the cost. Retail and finance talk in margin, trade suppliers usually quote markup.","Margin can never reach 100% — that would mean the goods cost nothing. Markup has no upper limit."],
"faq": [{"q":"I want a 30% margin. What markup is that?","a":"About 42.9%. Divide the margin by (1 − margin): 0.30 ÷ 0.70 = 0.4286. Applying a 30% markup instead would leave you with only a 23% margin, well short of the target."}]
};
})();