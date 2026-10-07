(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["break-even"] = {
"currency": "GBP",
"title": "Break-Even Analysis Calculator",
"category": "business",
"description": "Find the sales volume and revenue where a product or business stops losing money.",
"keywords": ["break even calculator","break even analysis","break even point","contribution margin","fixed costs"],
"formula": "break-even units = fixed costs / (price − variable cost per unit)",
"inputs": [{"key":"fixed","label":"Fixed costs per period","type":"number","unit":"£","default":50000,"min":0},{"key":"price","label":"Selling price per unit","type":"number","unit":"£","default":100,"min":0},{"key":"variable","label":"Variable cost per unit","type":"number","unit":"£","default":60,"min":0},{"key":"target","label":"Target profit","type":"number","unit":"£","default":0,"min":0},{"key":"actual","label":"Expected unit sales","type":"number","default":2000,"min":0}],
"compute": ({ fixed, price, variable, target, actual }) => {
      const contribution = price - variable;
      if (contribution <= 0) {
        return { note: 'Each unit sells for no more than it costs to make, so there is no break-even point. Raise the price or cut the variable cost.' };
      }
      const beUnits = fixed / contribution;
      const beRevenue = beUnits * price;
      const targetUnits = (fixed + target) / contribution;
      const profitAtActual = contribution * actual - fixed;
      const marginOfSafety = actual > 0 ? ((actual - beUnits) / actual) * 100 : NaN;

      return {
        beUnits: Math.ceil(beUnits),
        beRevenue,
        contribution,
        contributionRatio: (contribution / price) * 100,
        targetUnits: Math.ceil(targetUnits),
        profitAtActual,
        marginOfSafety,
        operatingLeverage: profitAtActual > 0 ? (contribution * actual) / profitAtActual : NaN,
        note: ''
      };
    },
"outputs": [{"key":"beUnits","label":"Break-even volume","format":"number","unit":"units","primary":true},{"key":"beRevenue","label":"Break-even revenue","format":"currency"},{"key":"contribution","label":"Contribution per unit","format":"currency"},{"key":"contributionRatio","label":"Contribution margin ratio","format":"percent"},{"key":"targetUnits","label":"Units for target profit","format":"number","unit":"units"},{"key":"profitAtActual","label":"Profit at expected sales","format":"currency"},{"key":"marginOfSafety","label":"Margin of safety","format":"percent"},{"key":"operatingLeverage","label":"Operating leverage","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      if (r.contribution === undefined) return [];
      return ['contribution = ' + f.money(Number(v.price)) + ' − ' + f.money(Number(v.variable)) + ' = ' + f.money(r.contribution) + ' a unit',
        'break-even = ' + f.money(Number(v.fixed)) + ' ÷ ' + f.money(r.contribution) + ' = ' + f.upto(Number(v.fixed) / r.contribution, 2) + ', so ' + f.int(r.beUnits) + ' units',
        'break-even revenue = ' + f.upto(Number(v.fixed) / r.contribution, 2) + ' × ' + f.money(Number(v.price)) + ' = ' + f.money(r.beRevenue)];
    },
"tips": ["Contribution per unit is what each sale adds towards covering fixed costs. Until fixed costs are covered, every sale reduces the loss rather than creating profit.","Margin of safety is how far sales can fall before you hit break-even. Below about 20% the business is fragile to a bad quarter.","High operating leverage — large fixed costs, small variable costs — magnifies both profit and loss when volume moves."],
"faq": [{"q":"Which costs count as fixed?","a":"Costs that do not change with output over the period: rent, salaries, insurance, software subscriptions. Materials, shipping and per-unit commission are variable. Costs that step up at intervals, such as an extra shift, are semi-fixed and need modelling at each step."}]
};
})();