(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["square-footage"] = {
"title": "Square Footage Calculator",
"category": "utilities",
"description": "Calculate floor area for rooms, including L-shaped spaces, plus material quantities and cost.",
"keywords": ["square footage calculator","square feet calculator","room area calculator","flooring calculator","sq ft"],
"formula": "area = length × width, summed across sections",
"inputs": [{"key":"unit","label":"Measurements in","type":"select","options":[{"value":"ft","label":"Feet"},{"value":"m","label":"Metres"},{"value":"in","label":"Inches"}],"default":"ft"},{"key":"l1","label":"Section 1 length","type":"number","default":12,"min":0},{"key":"w1","label":"Section 1 width","type":"number","default":10,"min":0},{"key":"l2","label":"Section 2 length (L-shape)","type":"number","default":0,"min":0},{"key":"w2","label":"Section 2 width","type":"number","default":0,"min":0},{"key":"waste","label":"Waste allowance","type":"number","unit":"%","default":10,"min":0},{"key":"price","label":"Price per sq ft — or per m² when measuring in metres","type":"number","unit":"£","default":0,"min":0}],
"compute": ({ unit, l1, w1, l2, w2, waste, price }) => {
      const f = unit === 'm' ? 3.280839895013123 : unit === 'in' ? 1 / 12 : 1;
      const areaFt = (Number(l1) || 0) * f * (Number(w1) || 0) * f
                   + (Number(l2) || 0) * f * (Number(w2) || 0) * f;
      const withWaste = areaFt * (1 + (Number(waste) || 0) / 100);
      const withWasteM = withWaste / 10.763910416709722;
      /* The price is per unit of the area being measured: per m² when the
         room is measured in metres, per sq ft otherwise (inches included —
         nobody prices flooring per square inch). */
      const p = Number(price) || 0;
      const metric = unit === 'm';
      return {
        sqft: areaFt,
        sqm: areaFt / 10.763910416709722,
        sqyd: areaFt / 9,
        withWaste,
        withWasteM,
        cost: (metric ? withWasteM : withWaste) * p,
        priceBasis: p ? (metric ? 'Price per m² × m² to order' : 'Price per sq ft × sq ft to order') : '',
        boxes: Math.ceil(withWaste / 20)
      };
    },
"outputs": [{"key":"sqft","label":"Area","format":"number","unit":"sq ft","primary":true},{"key":"sqm","label":"Area","format":"number","unit":"m²"},{"key":"sqyd","label":"Area","format":"number","unit":"sq yd"},{"key":"withWaste","label":"Order with waste allowance","format":"number","unit":"sq ft"},{"key":"withWasteM","label":"Order with waste allowance","format":"number","unit":"m²"},{"key":"cost","label":"Estimated material cost","format":"currency"},{"key":"priceBasis","label":"Cost worked out as","format":"text"},{"key":"boxes","label":"Boxes at 20 sq ft each","format":"number"}],
"currency": "GBP",
"filled": (v, r, f) => [
      'area = ' + f.upto(Number(v.l1) || 0, 4) + ' × ' + f.upto(Number(v.w1) || 0, 4) + (Number(v.l2) && Number(v.w2) ? ' + ' + f.upto(Number(v.l2), 4) + ' × ' + f.upto(Number(v.w2), 4) : '') + ' ' + v.unit + '² = ' + f.upto(r.sqft, 3) + ' sq ft = ' + f.upto(r.sqm, 3) + ' m²',
      'with ' + f.upto(Number(v.waste) || 0, 2) + '% extra: ' + f.upto(r.withWaste, 3) + ' sq ft'],
"tips": ["A 10% waste allowance is typical for straight-laid flooring. Allow 15% for diagonal or herringbone patterns, and more for a room with many angles.","Break irregular rooms into rectangles and add them. Two sections cover most L-shaped spaces.","Measure at the widest points and check both ends — rooms are rarely perfectly square."],
"faq": [{"q":"Should I subtract for kitchen units or a fireplace?","a":"Usually not. The offcuts rarely tile back together usefully, and having slightly too much is far cheaper than a second delivery in a different dye lot."}]
};
})();