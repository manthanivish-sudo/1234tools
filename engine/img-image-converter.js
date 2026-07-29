(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-converter"] = {
"title": "Image Format Converter",
"kind": "canvas",
"multiple": true,
"description": "Convert between PNG, JPEG and WebP in your browser. No upload, no queue, no watermark.",
"keywords": ["image converter","png to jpg","jpg to png","webp converter","convert image format","png to webp"],
"controls": [{"key":"format","label":"Convert to","type":"select","default":"image/png","options":[{"value":"image/png","label":"PNG — lossless, supports transparency"},{"value":"image/jpeg","label":"JPEG — small, no transparency"},{"value":"image/webp","label":"WebP — small, supports transparency"}]},{"key":"quality","label":"Quality (JPEG / WebP)","type":"range","default":92,"min":10,"max":100},{"key":"bg","label":"Background for transparency","type":"color","default":"#ffffff"}],
"paint": (ctx, img, o, h) => {
      h.size(img.naturalWidth, img.naturalHeight);
      if (o.format === 'image/jpeg') h.fill(o.bg || '#ffffff');
      ctx.drawImage(img, 0, 0);
    },
"tips": ["JPEG has no alpha channel. Converting a transparent PNG to JPEG fills the transparency with the background colour chosen above.","PNG is lossless, so the quality slider has no effect on it — the setting applies to JPEG and WebP only.","Converting JPEG to PNG will not restore detail already lost. It usually just produces a much larger file."],
"faq": [{"q":"Can you convert HEIC from my iPhone?","a":"Not here. HEIC needs a decoder that browsers do not ship, and adding one would mean loading roughly a megabyte of extra code. On an iPhone you can set Camera to \"Most Compatible\" to capture JPEG directly."}]
};
})();