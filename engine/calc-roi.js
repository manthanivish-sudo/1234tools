(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["roi"] = {
"currency": "GBP",
"title": "ROI & Payback Period Calculator",
"category": "business",
"description": "Calculate return on investment, annualised return and how long an investment takes to pay for itself.",
"keywords": ["ROI calculator","return on investment","payback period","annualised return","investment return"],
"formula": "ROI = (gain − cost) / cost   ·   annualised = (1 + ROI)^(1/years) − 1",
"inputs": [{"key":"cost","label":"Total investment","type":"number","unit":"£","default":25000,"min":0},{"key":"gain","label":"Total return (gross)","type":"number","unit":"£","default":40000,"min":0},{"key":"years","label":"Holding period","type":"number","unit":"years","default":3,"min":0,"step":0.25},{"key":"annualCash","label":"Annual cash inflow","type":"number","unit":"£","default":12000,"min":0}],
"compute": ({ cost, gain, years, annualCash }) => {
      if (!cost) return { note: 'Enter the amount invested.' };
      const netGain = gain - cost;
      const roi = (netGain / cost) * 100;
      const annualised = years > 0 ? (Math.pow(gain / cost, 1 / years) - 1) * 100 : NaN;
      return {
        roi, netGain, annualised,
        payback: annualCash > 0 ? cost / annualCash : NaN,
        multiple: gain / cost,
        note: ''
      };
    },
"outputs": [{"key":"roi","label":"Return on investment","format":"percent","primary":true},{"key":"netGain","label":"Net gain","format":"currency"},{"key":"annualised","label":"Annualised return (CAGR)","format":"percent"},{"key":"multiple","label":"Return multiple","format":"number","unit":"×"},{"key":"payback","label":"Payback period","format":"number","unit":"years"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.roi === undefined ? [] : [
      'ROI = (' + f.money(Number(v.gain)) + ' − ' + f.money(Number(v.cost)) + ') ÷ ' + f.money(Number(v.cost)) + ' = ' + f.pct(r.roi),
      isFinite(r.annualised) ? 'a year = (' + f.money(Number(v.gain)) + ' ÷ ' + f.money(Number(v.cost)) + ')^(1 ÷ ' + f.upto(Number(v.years), 4) + ') − 1 = ' + f.pct(r.annualised) : ''].filter(Boolean),
"tips": ["Always compare the annualised figure, not the headline ROI. A 60% return over five years is worse than 30% over two.","Simple ROI ignores the timing of cash flows. For anything longer than a year, NPV and IRR give a more honest picture.","Payback period says nothing about what happens after payback, so it favours short projects over more valuable long ones."],
"faq": [{"q":"Should ROI include my own time?","a":"For a business case, yes. Excluding founder or staff time makes projects look far better than they are, and it is the most common way an internal ROI figure ends up misleading."}]
};
})();