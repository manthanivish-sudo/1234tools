(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["passport-photo"] = {
"title": "Passport & ID Photo Maker",
"kind": "preset-multi",
"multiple": false,
"description": "Create correctly sized passport and visa photos, laid out on a printable 4×6 sheet.",
"keywords": ["passport photo maker","passport size photo","visa photo","id photo maker","passport photo online","35x45 photo"],
"controls": [{"key":"preset","label":"Document","type":"select","default":"0","options":[{"value":"0","label":"India passport / visa — 51×51 mm"},{"value":"1","label":"UK passport — 35×45 mm"},{"value":"2","label":"US passport — 51×51 mm"},{"value":"3","label":"Schengen visa — 35×45 mm"},{"value":"4","label":"India PAN card — 25×35 mm"},{"value":"5","label":"Stamp size — 20×25 mm"}]},{"key":"bg","label":"Background colour","type":"color","default":"#ffffff"},{"key":"sheet","label":"Output","type":"select","default":"both","options":[{"value":"both","label":"Single photo + print sheet"},{"value":"single","label":"Single photo only"},{"value":"sheet","label":"4×6 print sheet only"}]}],
"tips": ["This crops and sizes the photograph to the right dimensions. It does not check the compositional rules — head size, expression, background uniformity — which are where most applications are rejected.","Check the issuing authority’s own specification before printing. Requirements differ by country and change.","The print sheet lays out multiple copies on a standard 4×6 inch photo print at 300 DPI, which is what most print shops and kiosks expect.","Use a plain, evenly lit background and a neutral expression. Removing a busy background convincingly is beyond what a browser tool can do reliably."],
"faq": [{"q":"Will this photo definitely be accepted?","a":"No tool can promise that. Correct dimensions are necessary but not sufficient: head position and size, lighting, shadows, expression and background uniformity all matter, and they are judged by a human or an automated checker at submission."}]
};
})();