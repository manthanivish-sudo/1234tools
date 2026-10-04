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
"controls": [{"key":"preset","label":"Document","type":"select","default":"0","options":[{"value":"0","label":"India passport / visa — 51×51 mm"},{"value":"1","label":"UK passport — 35×45 mm"},{"value":"2","label":"US passport — 51×51 mm"},{"value":"3","label":"Schengen visa — 35×45 mm"},{"value":"4","label":"India PAN card — 25×35 mm"},{"value":"5","label":"Stamp size — 20×25 mm"}]},{"key":"bgmode","label":"Background","type":"select","default":"keep","options":[{"value":"keep","label":"Keep the photo’s background"},{"value":"replace","label":"Replace with the colour below (cut out on this device)"}]},{"key":"bg","label":"New background colour","type":"color","default":"#ffffff"},{"key":"sheet","label":"Output","type":"select","default":"both","options":[{"value":"both","label":"Single photo + print sheet"},{"value":"single","label":"Single photo only"},{"value":"sheet","label":"4×6 print sheet only"}]},{"key":"format","label":"Save as","type":"select","default":"image/jpeg","options":[{"value":"image/jpeg","label":"JPEG — what portals and kiosks ask for"},{"value":"image/png","label":"PNG — lossless"}]},{"key":"quality","label":"JPEG quality","type":"range","default":95,"min":60,"max":100}],
"tips": ["This crops and sizes the photograph to the right dimensions. It does not check the compositional rules — head size, expression, background uniformity — which are where most applications are rejected.","Check the issuing authority’s own specification before printing. Requirements differ by country and change.","Every file is 300 DPI and says so inside it (the JPEG’s JFIF header, the PNG’s pHYs chunk), so it prints at its size when printed at 100%. Pixels are whole, so sizes are rounded to the nearest pixel: 51 mm is 602.36 px at 300 DPI and comes out as 602 px, 50.97 mm.","The print sheet lays out multiple copies on a standard 4×6 inch photo print at 300 DPI, which is what most print shops and kiosks expect.","“Replace with the colour below” cuts the person out with MODNet, the portrait model the AI Background Remover uses, on your device: a 25 MB model and the runtime are fetched from this site the first time, then kept by your browser. Check the hair edge before you print; a plain, evenly lit wall still gives the cleanest result."],
"faq": [{"q":"Will this photo definitely be accepted?","a":"No tool can promise that. Correct dimensions are necessary but not sufficient: head position and size, lighting, shadows, expression and background uniformity all matter, and they are judged by a human or an automated checker at submission."}]
};
})();