(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["background-remover"] = {
"title": "Background Remover",
"kind": "segment",
"multiple": false,
"description": "Remove a plain background from product photos and logos instantly, with an optional AI mode for complex subjects.",
"keywords": ["background remover","remove background from image","transparent background","remove white background","product photo background"],
"controls": [{"key":"mode","label":"Method","type":"select","default":"auto","options":[{"value":"auto","label":"Automatic — samples the corners"},{"value":"colour","label":"Pick a colour to remove"},{"value":"ai","label":"AI (downloads a model, ~5 MB)"}]},{"key":"key","label":"Colour to remove","type":"color","default":"#ffffff"},{"key":"tolerance","label":"Tolerance","type":"range","default":32,"min":0,"max":120},{"key":"feather","label":"Edge softness","type":"range","default":2,"min":0,"max":10},{"key":"replace","label":"Replace with","type":"select","default":"transparent","options":[{"value":"transparent","label":"Transparency"},{"value":"colour","label":"A solid colour"}]},{"key":"bg","label":"New background","type":"color","default":"#ffffff"}],
"outputFormat": "image/png",
"needsAI": true,
"tips": ["The automatic mode samples the four corners and removes contiguous areas matching them. It works very well on product shots against white and on logos, and poorly on busy scenes.","Raise the tolerance if fringes of background remain; lower it if parts of the subject start disappearing.","Edge softness feathers the cut so it does not look like it was traced with scissors. Two to three pixels suits most images.","Always export as PNG or WebP. JPEG has no alpha channel and will fill the transparency with solid colour.","The AI mode downloads a segmentation model on first use. It handles hair and complex edges far better, but it is a one-off download of several megabytes and only loads on this page."],
"faq": [{"q":"Why is the automatic mode not as good as paid tools?","a":"It is a colour-distance flood fill, not a trained segmentation model. That makes it instant, private and dependency-free, and it genuinely competes on plain backgrounds. For a person photographed in a room, the AI mode or a dedicated service will do better."},{"q":"Does the AI mode upload my image?","a":"No. The model is downloaded to your browser and inference runs on your device. The image never leaves it. The trade-off is the initial download rather than your privacy."}]
};
})();