(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["shoe-size-converter"] = {
"title": "Shoe Size Converter",
"category": "utilities",
"description": "Convert shoe sizes between UK, US, EU, Japan and foot length in centimetres.",
"keywords": ["shoe size converter","UK to US shoe size","EU shoe size","shoe size chart","foot length to shoe size"],
"formula": "derived from foot length; each system uses a different origin and increment",
"inputs": [{"key":"size","label":"Size","type":"number","default":9,"min":0,"step":0.5},{"key":"system","label":"From system","type":"select","options":[{"value":"uk","label":"UK"},{"value":"usm","label":"US Men"},{"value":"usw","label":"US Women"},{"value":"eu","label":"EU"},{"value":"cm","label":"Foot length (cm)"}],"default":"uk"}],
"compute": ({ size, system }) => {
      const s = Number(size) || 0;
      if (s <= 0) return { note: 'Enter a size above zero.' };

      /* Everything is normalised to foot length first.
         UK uses barleycorns — three sizes per inch — measured on the last,
         which runs about two-thirds of an inch longer than the foot:
             foot inches = (UK + 23) / 3
         EU uses Paris points of two-thirds of a centimetre, also on the last:
             EU = 1.5 x (foot cm + 1.5) */
      let cm;
      if (system === 'cm')       cm = s;
      else if (system === 'uk')  cm = ((s + 23) / 3) * 2.54;
      else if (system === 'usm') cm = ((s - 1 + 23) / 3) * 2.54;
      else if (system === 'usw') cm = ((s - 2.5 + 23) / 3) * 2.54;
      else                       cm = (s / 1.5) - 1.5;          // from EU

      const uk = ((cm / 2.54) * 3) - 23;
      const half = (x) => Math.round(x * 2) / 2;

      return {
        uk: half(uk),
        usMen: half(uk + 1),
        usWomen: half(uk + 2.5),
        eu: half(1.5 * (cm + 1.5)),
        japan: half(cm),
        cm: Math.round(cm * 10) / 10,
        inches: Math.round((cm / 2.54) * 100) / 100,
        note: ''
      };
    },
"outputs": [{"key":"uk","label":"UK","format":"number","primary":true},{"key":"usMen","label":"US Men","format":"number"},{"key":"usWomen","label":"US Women","format":"number"},{"key":"eu","label":"EU","format":"number"},{"key":"japan","label":"Japan / cm","format":"number"},{"key":"cm","label":"Foot length","format":"number","unit":"cm"},{"key":"inches","label":"Foot length","format":"number","unit":"in"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => isFinite(r.cm) ? ['foot length ≈ ' + f.upto(r.cm, 1) + ' cm; UK ' + f.upto(r.uk, 1) + ', US men ' + f.upto(r.usMen, 1) + ', US women ' + f.upto(r.usWomen, 1) + ', EU ' + f.upto(r.eu, 1)] : [],
"tips": ["Shoe sizing is not standardised. Two pairs marked the same size from different brands can differ by a full size.","Measure your foot in the evening, when it is at its largest, standing with weight on it.","EU sizing uses Paris points of two-thirds of a centimetre; UK and US use barleycorns of a third of an inch. They do not align cleanly, which is why conversions are approximate.","Treat any conversion as a starting point, not a guarantee. Check the specific brand’s own chart where one exists."],
"faq": [{"q":"Why is the EU size sometimes half a size off?","a":"Because the two systems increment by different amounts and do not share an origin. Converting between them almost never lands exactly, so charts round — and different charts round differently."}]
};
})();