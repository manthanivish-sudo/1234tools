(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["india-capital-gains"] = {
"currencyLocked": true,
"currencyNote": "Indian capital-gains rules",
"currency": "INR",
"title": "Capital Gains Tax Calculator (India)",
"category": "india",
"description": "Short and long-term capital gains on equity, mutual funds, property and other assets under current rules.",
"keywords": ["capital gains calculator India","LTCG calculator","STCG","section 112A","capital gains tax property","equity capital gains"],
"formula": "LTCG on listed equity = 12.5% on gains above ₹1.25 lakh",
"inputs": [{"key":"asset","label":"Asset type","type":"select","options":[{"value":"equity","label":"Listed equity / equity mutual fund"},{"value":"debt","label":"Debt mutual fund (bought after Apr 2023)"},{"value":"property","label":"Property / land / building"},{"value":"other","label":"Gold, unlisted shares, other"}],"default":"equity"},{"key":"sale","label":"Sale value","type":"number","unit":"₹","default":1000000,"min":0},{"key":"cost","label":"Purchase cost","type":"number","unit":"₹","default":600000,"min":0},{"key":"expenses","label":"Transfer expenses","type":"number","unit":"₹","default":0,"min":0},{"key":"months","label":"Holding period","type":"number","unit":"months","default":30,"min":0},{"key":"slabRate","label":"Your marginal slab rate","type":"number","unit":"%","default":30,"min":0}],
"compute": ({ asset, sale, cost, expenses, months, slabRate }) => {
      const gain = Math.max(0, (Number(sale) || 0) - (Number(cost) || 0) - (Number(expenses) || 0));
      const m = Number(months) || 0;

      const threshold = asset === 'equity' ? 12 : asset === 'property' ? 24 : 24;
      const isLong = asset === 'debt' ? false : m > threshold;

      let rate, exemption = 0, basis;
      if (asset === 'equity') {
        if (isLong) { rate = 0.125; exemption = 125000; basis = 'LTCG u/s 198 of the 2025 Act (was 112A) — 12.5% above ₹1.25 lakh'; }
        else { rate = 0.20; basis = 'STCG u/s 196 of the 2025 Act (was 111A) — 20%'; }
      } else if (asset === 'debt') {
        rate = (Number(slabRate) || 0) / 100;
        basis = 'Taxed at your slab rate (no LTCG benefit after April 2023)';
      } else if (isLong) {
        rate = 0.125; basis = 'LTCG — 12.5% without indexation';
      } else {
        rate = (Number(slabRate) || 0) / 100; basis = 'STCG — taxed at your slab rate';
      }

      const taxable = Math.max(0, gain - exemption);
      const tax = taxable * rate;
      const cess = tax * 0.04;

      return {
        gain, taxable, exemption,
        tax: tax + cess, cess,
        rate: rate * 100,
        basis,
        term: isLong ? `Long term (held ${m} months)` : `Short term (held ${m} months)`,
        netProceeds: (Number(sale) || 0) - (Number(expenses) || 0) - (tax + cess)
      };
    },
"outputs": [{"key":"tax","label":"Capital gains tax (incl. cess)","format":"currency","primary":true},{"key":"gain","label":"Capital gain","format":"currency"},{"key":"term","label":"Classification","format":"text"},{"key":"basis","label":"Basis of charge","format":"text"},{"key":"exemption","label":"Exemption applied","format":"currency"},{"key":"taxable","label":"Taxable gain","format":"currency"},{"key":"rate","label":"Applicable rate","format":"percent"},{"key":"netProceeds","label":"Net proceeds after tax","format":"currency"}],
"filled": (v, r, f) => r.gain === undefined ? [] : [
      'gain = ' + f.money(Number(v.sale) || 0) + ' − ' + f.money(Number(v.cost) || 0) + ' − ' + f.money(Number(v.expenses) || 0) + ' = ' + f.money(r.gain),
      'taxable = ' + f.money(r.gain) + ' − ' + f.money(r.exemption) + ' = ' + f.money(r.taxable),
      'tax = ' + f.money(r.taxable) + ' × ' + f.pct(r.rate, 2) + ' + 4% cess = ' + f.money(r.tax)],
"tips": ["The July 2024 changes reset these rates: listed equity STCG moved to 20%, and long-term gains across most assets to 12.5% without indexation.","The ₹1.25 lakh annual exemption applies to long-term gains on listed equity and equity mutual funds, aggregated across all such holdings for the year.","Property acquired before 23 July 2024 may still be eligible for the older 20%-with-indexation route where that produces a lower tax. This calculator uses the 12.5% basis, so check both with your CA.","Debt mutual funds bought on or after 1 April 2023 are taxed at slab rates regardless of holding period."],
"faq": [{"q":"Can I reduce property capital gains tax?","a":"Sections 82, 86 and 85 of the Income-tax Act, 2025 (formerly 54, 54F and 54EC) allow relief where proceeds are reinvested in residential property or specified bonds within set time limits. The conditions are strict and unforgiving of missed deadlines — take advice before selling, not after."}]
};
})();