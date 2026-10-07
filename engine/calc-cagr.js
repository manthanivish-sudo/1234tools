(function(){
window.TOOLS = window.TOOLS || {};
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["cagr"] = {
"currency": "GBP",
"title": "CAGR Calculator (Compound Annual Growth Rate)",
"category": "business",
"description": "Calculate the smoothed annual growth rate between two values, and project it forward.",
"keywords": ["CAGR calculator","compound annual growth rate","growth rate","revenue growth","annualised growth"],
"formula": "CAGR = (ending / beginning)^(1/years) − 1",
"inputs": [{"key":"begin","label":"Beginning value","type":"number","unit":"£","default":1000000,"min":0},{"key":"end","label":"Ending value","type":"number","unit":"£","default":1800000,"min":0},{"key":"years","label":"Number of years","type":"number","default":4,"min":0,"step":0.5,"slider":[1,30]},{"key":"project","label":"Project forward","type":"number","unit":"years","default":3,"min":0}],
"compute": ({ begin, end, years, project }) => {
      if (!begin || !years) return { note: 'Enter a beginning value and a number of years.' };
      const cagr = Math.pow(end / begin, 1 / years) - 1;
      const table = { head: ['Year', 'Projected value'], cols: ['text', 'currency'], rows: [] };
      for (let i = 1; i <= Math.min(20, project); i++) {
        table.rows.push([String(i), cell(end * Math.pow(1 + cagr, i))]);
      }
      return {
        cagr: cagr * 100,
        totalGrowth: ((end - begin) / begin) * 100,
        multiple: end / begin,
        doubling: cagr > 0 ? Math.log(2) / Math.log(1 + cagr) : NaN,
        projected: end * Math.pow(1 + cagr, project),
        note: '',
        _table: table.rows.length ? table : null
      };
    },
"outputs": [{"key":"cagr","label":"Compound annual growth rate","format":"percent","primary":true},{"key":"totalGrowth","label":"Total growth over period","format":"percent"},{"key":"multiple","label":"Growth multiple","format":"number","unit":"×"},{"key":"doubling","label":"Years to double at this rate","format":"number"},{"key":"projected","label":"Projected value","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      if (r.cagr === undefined) return [];
      return ['CAGR = (' + f.money(Number(v.end)) + ' ÷ ' + f.money(Number(v.begin)) + ')^(1 ÷ ' + f.upto(Number(v.years), 4) + ') − 1 = ' + f.upto(r.multiple, 6) + '^' + f.upto(1 / Number(v.years), 6) + ' − 1 = ' + f.pct(r.cagr, 3),
        'in ' + f.upto(Number(v.project), 2) + ' more years at that rate: ' + f.money(Number(v.end)) + ' × (1 + ' + f.upto(r.cagr / 100, 6) + ')^' + f.upto(Number(v.project), 2) + ' = ' + f.money(r.projected)];
    },
"tips": ["CAGR smooths away all volatility. Two businesses with identical CAGR can have wildly different year-to-year records, and one may be far riskier.","It is meaningless over very short periods, and easily manipulated by choosing a flattering start year.","The rule of 72 is a decent mental check: 72 ÷ growth rate ≈ years to double."],
"faq": [{"q":"Why not just average the yearly growth rates?","a":"The arithmetic mean overstates growth. Rising 50% then falling 50% averages to zero, but leaves you 25% down. CAGR is the geometric mean and reflects what actually happened."}]
};
})();