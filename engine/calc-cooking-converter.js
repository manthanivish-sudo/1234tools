(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["cooking-converter"] = {
"title": "Cooking Measurement Converter",
"category": "utilities",
"description": "Convert between cups, tablespoons, millilitres, grams and ounces for common ingredients.",
"keywords": ["cooking conversion","cups to grams","tablespoon to ml","recipe converter","baking conversion","cups to ml"],
"formula": "volume converts exactly; volume to weight depends on ingredient density",
"inputs": [{"key":"amount","label":"Amount","type":"number","default":1,"min":0,"step":0.25},{"key":"unit","label":"Unit","type":"select","options":[{"value":"cup","label":"Cup (US, 240 ml)"},{"value":"tbsp","label":"Tablespoon (15 ml)"},{"value":"tsp","label":"Teaspoon (5 ml)"},{"value":"ml","label":"Millilitres"},{"value":"floz","label":"Fluid ounces (US)"}],"default":"cup"},{"key":"ingredient","label":"Ingredient (for weight)","type":"select","options":[{"value":"1000","label":"Water / milk"},{"value":"529","label":"Flour, plain (sifted)"},{"value":"600","label":"Flour, plain (spooned)"},{"value":"845","label":"Sugar, granulated"},{"value":"800","label":"Sugar, brown (packed)"},{"value":"460","label":"Sugar, icing"},{"value":"911","label":"Butter / oil"},{"value":"1030","label":"Honey / syrup"},{"value":"400","label":"Oats, rolled"},{"value":"780","label":"Rice, uncooked"},{"value":"340","label":"Cocoa powder"}],"default":"1000"},{"key":"scale","label":"Scale recipe by","type":"number","unit":"×","default":1,"min":0,"step":0.25}],
"compute": ({ amount, unit, ingredient, scale }) => {
      const ML = { cup: 240, tbsp: 15, tsp: 5, ml: 1, floz: 29.5735295625 };
      const ml = (Number(amount) || 0) * (ML[unit] || 1) * (Number(scale) || 1);
      const density = Number(ingredient) || 1000;   // grams per litre
      const grams = ml * density / 1000;

      return {
        ml,
        grams,
        ounces: grams / 28.349523125,
        cups: ml / 240,
        tbsp: ml / 15,
        tsp: ml / 5,
        floz: ml / 29.5735295625,
        litres: ml / 1000
      };
    },
"outputs": [{"key":"grams","label":"Weight","format":"number","unit":"g","primary":true},{"key":"ml","label":"Volume","format":"number","unit":"ml"},{"key":"cups","label":"Cups (US)","format":"number"},{"key":"tbsp","label":"Tablespoons","format":"number"},{"key":"tsp","label":"Teaspoons","format":"number"},{"key":"ounces","label":"Ounces","format":"number","unit":"oz"},{"key":"floz","label":"Fluid ounces","format":"number","unit":"fl oz"},{"key":"litres","label":"Litres","format":"number","unit":"L"}],
"filled": (v, r, f) => [
      'volume = ' + f.upto(Number(v.amount), 4) + ' ' + v.unit + ' × ' + f.upto({ cup: 240, tbsp: 15, tsp: 5, ml: 1, floz: 29.5735295625 }[v.unit] || 1, 4) + ' ml' + (Number(v.scale) !== 1 ? ' × ' + f.upto(Number(v.scale), 4) : '') + ' = ' + f.upto(r.ml, 2) + ' ml',
      'weight = ' + f.upto(r.ml, 2) + ' ml × ' + f.upto(Number(v.ingredient) / 1000, 4) + ' g per ml = ' + f.upto(r.grams, 1) + ' g'],
"tips": ["A cup is a volume, not a weight, so a cup of flour and a cup of sugar weigh very differently. That is why the ingredient matters.","How you fill the cup changes the result by up to 20%: sifted flour weighs far less than flour scooped straight from the bag.","For baking, weigh rather than measure by volume. It is the single biggest improvement most home bakers can make to consistency.","Cup sizes differ by country: 240 ml in the US, 250 ml in Australia, 284 ml for an old UK breakfast cup."],
"faq": [{"q":"Why do different charts disagree on cups of flour?","a":"Because they assume different filling methods. Published values range from about 120 g to 145 g per cup for plain flour. Any chart is an approximation of something a scale measures exactly."}]
};
})();