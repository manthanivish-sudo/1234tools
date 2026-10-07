(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["fuel-efficiency"] = {
"currency": "GBP",
"title": "Fuel Efficiency & Trip Cost Calculator",
"category": "utilities",
"icon": "⛽",
"description": "Convert between MPG and L/100km, and calculate the fuel cost of a journey.",
"keywords": ["mpg to l/100km","fuel economy","trip cost calculator","fuel consumption"],
"formula": "L/100km = 235.214583 / MPG(US)",
"inputs": [{"key":"efficiency","label":"Fuel Efficiency","type":"number","default":30,"min":0},{"key":"unit","label":"Efficiency Unit","type":"select","options":[{"value":"mpgus","label":"MPG (US)"},{"value":"mpguk","label":"MPG (Imperial)"},{"value":"l100","label":"L/100 km"},{"value":"kml","label":"km per Litre"}],"default":"mpgus"},{"key":"distance","label":"Trip Distance","type":"number","default":300,"min":0},{"key":"distUnit","label":"Distance Unit","type":"select","options":[{"value":"mi","label":"Miles"},{"value":"km","label":"Kilometres"}],"default":"mi"},{"key":"price","label":"Fuel Price per Unit","type":"number","unit":"£","default":3.5,"min":0,"step":0.01},{"key":"priceUnit","label":"Price Per","type":"select","options":[{"value":"gal","label":"US Gallon"},{"value":"l","label":"Litre"}],"default":"gal"}],
"compute": ({ efficiency, unit, distance, distUnit, price, priceUnit }) => {
      // Normalise everything to litres per 100 km.
      let l100;
      if (unit === 'mpgus') l100 = efficiency ? 235.214583 / efficiency : Infinity;
      else if (unit === 'mpguk') l100 = efficiency ? 282.481 / efficiency : Infinity;
      else if (unit === 'kml') l100 = efficiency ? 100 / efficiency : Infinity;
      else l100 = efficiency;

      const km = distUnit === 'mi' ? distance * 1.609344 : distance;
      const litres = (l100 / 100) * km;
      const pricePerLitre = priceUnit === 'gal' ? price / 3.785411784 : price;

      return {
        l100,
        mpgus: l100 ? 235.214583 / l100 : Infinity,
        mpguk: l100 ? 282.481 / l100 : Infinity,
        kml: l100 ? 100 / l100 : Infinity,
        litres,
        gallons: litres / 3.785411784,
        cost: litres * pricePerLitre,
        costPerDistance: distance ? (litres * pricePerLitre) / distance : 0
      };
    },
"outputs": [{"key":"cost","label":"Total Fuel Cost","format":"currency","primary":true},{"key":"litres","label":"Fuel Needed","format":"number","unit":"L"},{"key":"gallons","label":"Fuel Needed","format":"number","unit":"US gal"},{"key":"l100","label":"Consumption","format":"number","unit":"L/100km"},{"key":"mpgus","label":"Efficiency","format":"number","unit":"MPG (US)"},{"key":"mpguk","label":"Efficiency","format":"number","unit":"MPG (UK)"},{"key":"kml","label":"Efficiency","format":"number","unit":"km/L"},{"key":"costPerDistance","label":"Cost per Unit Distance","format":"currency"}],
"filled": (v, r, f) => isFinite(r.l100) ? ['L/100 km = ' + f.upto(r.l100, 4),
      'fuel = ' + f.upto(r.l100, 4) + ' ÷ 100 × ' + f.upto(Number(v.distance) * (v.distUnit === 'mi' ? 1.609344 : 1), 4) + ' km = ' + f.upto(r.litres, 3) + ' litres',
      'cost = ' + f.upto(r.litres, 3) + ' l × ' + f.money(v.priceUnit === 'gal' ? Number(v.price) / 3.785411784 : Number(v.price)) + ' a litre = ' + f.money(r.cost)] : [],
"tips": ["MPG and L/100km are inverse measures: higher MPG is better, lower L/100km is better.","A US gallon is about 3.785 L; an Imperial gallon is about 4.546 L, so UK MPG figures look ~20% better than US figures for the same car.","Improving from 15 to 20 MPG saves more fuel per mile than improving from 40 to 50 MPG — the inverse relationship is counterintuitive."],
"faq": [{"q":"Where does the constant 235.214583 come from?","a":"It is 100 × 3.785411784 (litres per US gallon) ÷ 1.609344 (km per mile), the factor that converts miles-per-gallon into litres-per-100-kilometres."}]
};
})();