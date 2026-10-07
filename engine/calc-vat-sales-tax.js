(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["vat-sales-tax"] = {
"currency": "GBP",
"title": "VAT & Sales Tax Calculator",
"category": "finance",
"icon": "🧾",
"description": "Add tax to a net price or extract tax from a gross price — works in both directions.",
"keywords": ["VAT calculator","sales tax","GST calculator","tax inclusive"],
"formula": "gross = net × (1 + rate)  ·  net = gross / (1 + rate)",
"inputs": [{"key":"amount","label":"Amount","type":"number","unit":"£","default":100,"min":0},{"key":"rate","label":"Tax Rate","type":"number","unit":"%","default":20,"step":0.01,"min":0,"max":100},{"key":"mode","label":"Amount is","type":"select","options":[{"value":"net","label":"Net (tax not yet added)"},{"value":"gross","label":"Gross (tax already included)"}],"default":"net"}],
"compute": ({ amount, rate, mode }) => {
      const r = rate / 100;
      const net = mode === 'net' ? amount : amount / (1 + r);
      const gross = mode === 'net' ? amount * (1 + r) : amount;
      return { net, tax: gross - net, gross };
    },
"outputs": [{"key":"gross","label":"Gross (incl. tax)","format":"currency","primary":true},{"key":"net","label":"Net (excl. tax)","format":"currency"},{"key":"tax","label":"Tax Amount","format":"currency"}],
"filled": (v, r, f) => v.mode === 'gross'
      ? ['net = ' + f.money(Number(v.amount)) + ' ÷ (1 + ' + f.upto(Number(v.rate) / 100, 6) + ') = ' + f.money(r.net), 'tax = ' + f.money(Number(v.amount)) + ' − ' + f.money(r.net) + ' = ' + f.money(r.tax)]
      : ['tax = ' + f.money(Number(v.amount)) + ' × ' + f.upto(Number(v.rate), 4) + '% = ' + f.money(r.tax), 'gross = ' + f.money(Number(v.amount)) + ' + ' + f.money(r.tax) + ' = ' + f.money(r.gross)],
"tips": ["To remove 20% tax you divide by 1.2 — you do not subtract 20%. Subtracting gives the wrong answer.","Switch the mode selector to work backwards from a receipt total."],
"faq": [{"q":"Why can I not just subtract the tax percentage?","a":"The tax was calculated on the net amount, not the gross. Subtracting 20% of the gross removes too much. Dividing by 1.20 reverses the original operation correctly."}]
};
})();