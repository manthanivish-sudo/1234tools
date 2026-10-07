(function(){
window.TOOLS = window.TOOLS || {};
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["depreciation"] = {
"currency": "GBP",
"title": "Depreciation Calculator with Schedule",
"category": "business",
"description": "Straight-line, reducing balance, double declining and sum-of-years digits, with a full year-by-year schedule.",
"keywords": ["depreciation calculator","straight line depreciation","reducing balance","declining balance","asset depreciation","depreciation schedule"],
"formula": "straight line = (cost − salvage) / life",
"inputs": [{"key":"method","label":"Method","type":"select","options":[{"value":"sl","label":"Straight line"},{"value":"db","label":"Reducing (declining) balance"},{"value":"ddb","label":"Double declining balance"},{"value":"syd","label":"Sum of years digits"}],"default":"sl"},{"key":"cost","label":"Asset cost","type":"number","unit":"£","default":50000,"min":0},{"key":"salvage","label":"Residual / salvage value","type":"number","unit":"£","default":5000,"min":0},{"key":"life","label":"Useful life","type":"number","unit":"years","default":5,"min":1,"max":200},{"key":"dbRate","label":"Reducing balance rate","type":"number","unit":"%","default":25,"min":0}],
"compute": ({ method, cost, salvage, life, dbRate }) => {
      // hard cap: a user typing a huge life would otherwise loop that many times
      const n = Math.max(1, Math.min(200, Math.round(Number(life) || 1)));
      if (cost <= 0) return { note: 'Enter the asset cost.' };
      if (salvage > cost) return { note: 'Residual value cannot exceed the asset cost.' };

      const depreciable = cost - salvage;
      const rows = [];
      let book = cost, accumulated = 0, switchYear = 0;

      for (let y = 1; y <= n; y++) {
        let charge;
        if (method === 'sl') charge = depreciable / n;
        else if (method === 'db') charge = book * (dbRate / 100);
        else if (method === 'ddb') {
          /* Double declining balance switches to straight line once spreading
             what is left above the residual value over the remaining years
             gives the larger charge — the standard rule (as in Excel's VDB),
             without which the asset never reaches its residual value. */
          const ddb = book * (2 / n);
          const sl = (book - salvage) / (n - y + 1);
          if (sl > ddb) { charge = sl; if (!switchYear) switchYear = y; }
          else charge = ddb;
        }
        else charge = depreciable * ((n - y + 1) / (n * (n + 1) / 2));

        // never depreciate below the residual value
        if (book - charge < salvage) charge = book - salvage;
        if (charge < 0) charge = 0;

        accumulated += charge;
        book -= charge;
        rows.push([String(y), cell(charge), cell(accumulated), cell(book)]);
      }

      return {
        firstYear: rows[0][1],
        totalDepreciation: accumulated,
        finalBook: book,
        annualAverage: accumulated / n,
        note: switchYear ? `Switches to straight line from year ${switchYear}, when that gives the larger charge.` : '',
        _table: { head: ['Year', 'Charge', 'Accumulated', 'Closing book value'], cols: ['text', 'currency', 'currency', 'currency'], rows, foot: ['Total', accumulated, accumulated, book] },
        _chart: [
          { type: 'bar', title: 'Charge each year', format: 'currency', xLabel: 'Year', labels: rows.map((x) => Number(x[0])), series: [{ name: 'Charge', values: rows.map((x) => x[1]) }] },
          { type: 'line', title: 'Book value at the year end', format: 'currency', xLabel: 'Year', labels: [0].concat(rows.map((x) => Number(x[0]))), series: [{ name: 'Book value', values: [cost].concat(rows.map((x) => x[3])), area: true }] }
        ]
      };
    },
"outputs": [{"key":"firstYear","label":"First-year charge","format":"currency","primary":true},{"key":"totalDepreciation","label":"Total depreciation","format":"currency"},{"key":"finalBook","label":"Final book value","format":"currency"},{"key":"annualAverage","label":"Average annual charge","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      const n = Math.max(1, Math.min(200, Math.round(Number(v.life) || 1)));
      const C = Number(v.cost) || 0, S = Number(v.salvage) || 0;
      if (r.firstYear === undefined) return [];
      if (v.method === 'sl') return ['charge = (' + f.money(C) + ' − ' + f.money(S) + ') ÷ ' + n + ' = ' + f.money(r.firstYear) + ' a year'];
      if (v.method === 'db') return ['year 1 = ' + f.money(C) + ' × ' + f.upto(Number(v.dbRate) || 0, 4) + '% = ' + f.money(r.firstYear), 'each later year = the book value left × ' + f.upto(Number(v.dbRate) || 0, 4) + '%, never below ' + f.money(S)];
      if (v.method === 'ddb') return ['rate = 2 ÷ ' + n + ' = ' + f.upto(2 / n, 6), 'year 1 = ' + f.money(C) + ' × ' + f.upto(2 / n, 6) + ' = ' + f.money(r.firstYear)];
      return ['sum of the years = ' + n + ' × ' + (n + 1) + ' ÷ 2 = ' + (n * (n + 1) / 2), 'year 1 = (' + f.money(C) + ' − ' + f.money(S) + ') × ' + n + ' ÷ ' + (n * (n + 1) / 2) + ' = ' + f.money(r.firstYear)];
    },
"tips": ["Straight line spreads the cost evenly and suits assets that wear out steadily, such as fixtures or buildings.","Reducing balance front-loads the charge and better matches assets that lose value fastest when new, such as vehicles and IT equipment.","Accounting depreciation and tax relief are different things. In the UK, capital allowances — not your depreciation policy — determine the tax deduction.","No method may take the book value below the residual value, which is why the final year is often a smaller charge."],
"faq": [{"q":"Does this give me my tax deduction?","a":"No. Depreciation is added back for UK corporation tax and replaced by capital allowances, such as the Annual Investment Allowance or writing-down allowances. Ask your accountant which applies to the asset."}]
};
})();