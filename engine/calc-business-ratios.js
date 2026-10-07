(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["business-ratios"] = {
"currency": "GBP",
"title": "Financial Ratio Calculator",
"category": "business",
"description": "Liquidity, profitability, efficiency and leverage ratios from balance sheet and P&L figures.",
"keywords": ["financial ratios","current ratio","quick ratio","gearing ratio","return on equity","working capital"],
"formula": "current ratio = current assets / current liabilities",
"inputs": [{"key":"currentAssets","label":"Current assets","type":"number","unit":"£","default":250000,"min":0},{"key":"inventory","label":"Inventory (stock)","type":"number","unit":"£","default":80000,"min":0},{"key":"currentLiabilities","label":"Current liabilities","type":"number","unit":"£","default":150000,"min":0},{"key":"totalAssets","label":"Total assets","type":"number","unit":"£","default":600000,"min":0},{"key":"totalDebt","label":"Total debt","type":"number","unit":"£","default":200000,"min":0},{"key":"equity","label":"Shareholders’ equity","type":"number","unit":"£","default":300000,"min":0},{"key":"revenue","label":"Revenue","type":"number","unit":"£","default":900000,"min":0},{"key":"grossProfit","label":"Gross profit","type":"number","unit":"£","default":360000},{"key":"netProfit","label":"Net profit","type":"number","unit":"£","default":72000}],
"compute": (v) => {
      const d = (a, b) => (b === 0 ? NaN : a / b);
      return {
        current: d(v.currentAssets, v.currentLiabilities),
        quick: d(v.currentAssets - v.inventory, v.currentLiabilities),
        workingCapital: v.currentAssets - v.currentLiabilities,
        grossMargin: d(v.grossProfit, v.revenue) * 100,
        netMargin: d(v.netProfit, v.revenue) * 100,
        roa: d(v.netProfit, v.totalAssets) * 100,
        roe: d(v.netProfit, v.equity) * 100,
        assetTurnover: d(v.revenue, v.totalAssets),
        gearing: d(v.totalDebt, v.equity) * 100,
        debtRatio: d(v.totalDebt, v.totalAssets) * 100,
        equityRatio: d(v.equity, v.totalAssets) * 100
      };
    },
"outputs": [{"key":"current","label":"Current ratio","format":"number","primary":true},{"key":"quick","label":"Quick (acid test) ratio","format":"number"},{"key":"workingCapital","label":"Working capital","format":"currency"},{"key":"grossMargin","label":"Gross margin","format":"percent"},{"key":"netMargin","label":"Net margin","format":"percent"},{"key":"roa","label":"Return on assets","format":"percent"},{"key":"roe","label":"Return on equity","format":"percent"},{"key":"assetTurnover","label":"Asset turnover","format":"number","unit":"×"},{"key":"gearing","label":"Gearing (debt / equity)","format":"percent"},{"key":"debtRatio","label":"Debt ratio","format":"percent"},{"key":"equityRatio","label":"Equity ratio","format":"percent"}],
"filled": (v, r, f) => [
      'current ratio = ' + f.money(Number(v.currentAssets)) + ' ÷ ' + f.money(Number(v.currentLiabilities)) + ' = ' + f.num(r.current, 2),
      'quick ratio = (' + f.money(Number(v.currentAssets)) + ' − ' + f.money(Number(v.inventory)) + ') ÷ ' + f.money(Number(v.currentLiabilities)) + ' = ' + f.num(r.quick, 2),
      'net margin = ' + f.money(Number(v.netProfit)) + ' ÷ ' + f.money(Number(v.revenue)) + ' = ' + f.pct(r.netMargin),
      'gearing = ' + f.money(Number(v.totalDebt)) + ' ÷ ' + f.money(Number(v.equity)) + ' = ' + f.pct(r.gearing)],
"tips": ["A current ratio near 1.5–2 is often comfortable, but the sensible range varies enormously by sector. Supermarkets run well below 1 quite safely because stock turns into cash within days.","The quick ratio strips out inventory, which is the hardest current asset to convert quickly. If quick is far below current, a lot of value is tied up in stock.","Ratios only mean something in comparison — against your own history, or against sector peers. A single period in isolation says very little."],
"faq": [{"q":"Is high gearing bad?","a":"Not inherently. Debt is cheaper than equity and magnifies returns when the business earns more than the interest costs. It becomes dangerous when earnings are volatile or interest rates rise, because the obligation does not flex with trading."}]
};
})();