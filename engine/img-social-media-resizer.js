(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["social-media-resizer"] = {
"title": "Social Media Image Resizer",
"kind": "preset-multi",
"multiple": false,
"description": "Produce correctly sized images for Instagram, Facebook, X, LinkedIn, YouTube and more in one pass.",
"keywords": ["social media image sizes","instagram image size","youtube thumbnail size","social media resizer","facebook cover size","linkedin banner size"],
"controls": [{"key":"presets","label":"Platforms","type":"presets","default":"all"},{"key":"mode","label":"Fitting","type":"select","default":"cover","options":[{"value":"cover","label":"Fill and crop (no bars)"},{"value":"contain","label":"Fit whole image (adds bars)"}]},{"key":"bg","label":"Bar colour","type":"color","default":"#0a0e1a"},{"key":"format","label":"Format","type":"select","default":"image/jpeg","options":[{"value":"image/jpeg","label":"JPEG"},{"value":"image/png","label":"PNG"},{"value":"image/webp","label":"WebP"}]}],
"tips": ["Fill-and-crop keeps the frame full but can cut off edges. Fit-whole-image never crops but adds bars, which some platforms then crop anyway.","Keep important content — faces, logos, text — inside the middle 80%. Platforms crop previews unpredictably across devices.","Sizes change. These are current at the time of writing; check the platform’s own guidance for anything mission-critical."],
"faq": [{"q":"Which size should I use for a link preview?","a":"The Open Graph preset at 1200×630 is the safe default. Facebook, LinkedIn, WhatsApp and most chat apps read the same og:image tag."}]
};
})();