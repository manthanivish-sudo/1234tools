(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["color-palette-extractor"] = {
"title": "Colour Palette Extractor",
"kind": "analyse",
"multiple": false,
"description": "Pull the dominant colours out of any image as HEX, RGB and HSL, with contrast checks.",
"keywords": ["color palette generator","extract colors from image","image color picker","dominant color","palette from photo","brand colours from logo"],
"controls": [{"key":"count","label":"Number of colours","type":"range","default":6,"min":2,"max":12}],
"tips": ["Colours are found with median cut, which is deterministic — the same image always produces the same palette.","The share figure shows how much of the image each colour occupies, which is a good guide to how prominently to use it.","Check contrast before using an extracted colour for text. Photographic colours are often mid-tone and fail accessibility thresholds."],
"faq": [{"q":"Why are the colours slightly different from the photo?","a":"Each swatch is the average of a cluster of similar pixels rather than a single sampled pixel, so it represents a region rather than a point. That makes it more useful as a palette and less useful as an eyedropper."}]
};
})();