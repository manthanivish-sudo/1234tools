(function(){
window.TOOLS = window.TOOLS || {};
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["lumpsum-returns"] = {
"currency": "INR",
"title": "Lumpsum Investment Calculator",
"category": "india",
"description": "Future value of a one-time investment, with its worth in today’s money and the real return after inflation.",
"keywords": ["lumpsum calculator","mutual fund calculator","compound interest India","investment returns","CAGR calculator"],
"formula": "FV = P × (1 + r)ⁿ",
"inputs": [{"key":"principal","label":"Investment amount","type":"number","unit":"₹","default":500000,"min":0},{"key":"rate","label":"Expected annual return","type":"number","unit":"%","default":12,"step":0.1,"slider":[1,30]},{"key":"years","label":"Investment period","type":"number","unit":"years","default":10,"min":0,"max":100,"slider":[1,40]},{"key":"inflation","label":"Assumed inflation","type":"number","unit":"%","default":6,"step":0.1}],
"compute": ({ principal, rate, years, inflation }) => {
      const p = Number(principal) || 0;
      const r = (Number(rate) || 0) / 100;
      const y = Number(years) || 0;
      const fv = p * Math.pow(1 + r, y);
      const real = fv / Math.pow(1 + (Number(inflation) || 0) / 100, y);
      const realRate = ((1 + r) / (1 + (Number(inflation) || 0) / 100) - 1) * 100;

      const rows = [];
      for (let i = 1; i <= Math.min(30, Math.ceil(y)); i++) {
        rows.push([String(i), cell(p * Math.pow(1 + r, i)),
                   cell(p * Math.pow(1 + r, i) / Math.pow(1 + (Number(inflation) || 0) / 100, i))]);
      }

      return {
        fv, gain: fv - p, real, realRate,
        multiple: p ? fv / p : NaN,
        doubling: r > 0 ? Math.log(2) / Math.log(1 + r) : NaN,
        _table: rows.length ? { head: ['Year', 'Nominal value', "Today's money"], cols: ['text', 'currency', 'currency'], rows } : null
      };
    },
"outputs": [{"key":"fv","label":"Maturity value","format":"currency","primary":true},{"key":"gain","label":"Total gain","format":"currency"},{"key":"real","label":"Worth in today’s money","format":"currency"},{"key":"realRate","label":"Real (inflation-adjusted) return","format":"percent"},{"key":"multiple","label":"Growth multiple","format":"number","unit":"×"},{"key":"doubling","label":"Years to double","format":"number"}],
"filled": (v, r, f) => [
      'FV = ' + f.money(Number(v.principal) || 0) + ' × (1 + ' + f.upto(Number(v.rate) / 100, 6) + ')^' + f.upto(Number(v.years), 4) + ' = ' + f.money(r.fv),
      "in today's money: " + f.money(r.fv) + ' ÷ (1 + ' + f.upto(Number(v.inflation) / 100, 6) + ')^' + f.upto(Number(v.years), 4) + ' = ' + f.money(r.real)],
"tips": ["The inflation-adjusted figure is the honest one. At 6% inflation, money loses roughly half its purchasing power every twelve years.","A 12% nominal return with 6% inflation is a real return of about 5.7%, not 6% — the two rates divide rather than subtract.","Nothing here accounts for exit load, expense ratio or tax, all of which reduce what you actually receive."],
"faq": [{"q":"Why is the real return not simply return minus inflation?","a":"Because both compound. The exact relationship is (1 + nominal) ÷ (1 + inflation) − 1. Subtracting is a reasonable approximation at low rates and increasingly wrong as rates rise."}]
};
})();