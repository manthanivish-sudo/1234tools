(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["photo-filters"] = {
"title": "Photo Filters & Adjustments",
"kind": "canvas",
"multiple": true,
"description": "Adjust brightness, contrast, saturation and blur, or apply grayscale, sepia and invert.",
"keywords": ["photo filter","image effects","grayscale image","sepia filter","brightness contrast","black and white photo"],
"controls": [{"key":"preset","label":"Preset","type":"select","default":"none","options":[{"value":"none","label":"None"},{"value":"grayscale","label":"Black & white"},{"value":"sepia","label":"Sepia"},{"value":"invert","label":"Invert"},{"value":"vintage","label":"Vintage"},{"value":"cool","label":"Cool"},{"value":"warm","label":"Warm"},{"value":"dramatic","label":"Dramatic"}]},{"key":"brightness","label":"Brightness %","type":"range","default":100,"min":0,"max":200},{"key":"contrast","label":"Contrast %","type":"range","default":100,"min":0,"max":200},{"key":"saturate","label":"Saturation %","type":"range","default":100,"min":0,"max":300},{"key":"blur","label":"Blur (px)","type":"range","default":0,"min":0,"max":20}],
"paint": (ctx, img, o, h) => {
      h.size(img.naturalWidth, img.naturalHeight);
      const P = {
        grayscale: 'grayscale(1)', sepia: 'sepia(0.85)', invert: 'invert(1)',
        vintage: 'sepia(0.4) contrast(1.1) saturate(0.8) brightness(1.05)',
        cool: 'hue-rotate(-12deg) saturate(1.15) brightness(1.02)',
        warm: 'hue-rotate(12deg) saturate(1.2) brightness(1.04)',
        dramatic: 'contrast(1.35) saturate(1.25) brightness(0.95)'
      };
      const parts = [];
      if (P[o.preset]) parts.push(P[o.preset]);
      if (Number(o.brightness) !== 100) parts.push(`brightness(${Number(o.brightness) / 100})`);
      if (Number(o.contrast) !== 100) parts.push(`contrast(${Number(o.contrast) / 100})`);
      if (Number(o.saturate) !== 100) parts.push(`saturate(${Number(o.saturate) / 100})`);
      if (Number(o.blur) > 0) parts.push(`blur(${Number(o.blur)}px)`);
      ctx.filter = parts.length ? parts.join(' ') : 'none';
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
    },
"tips": ["Adjustments stack on top of the preset, so you can pick a look and then fine-tune it.","Contrast above about 130% starts clipping highlights and shadows, and clipped detail cannot be recovered later.","Converting to black and white removes the colour information permanently. Keep the original."],
"faq": [{"q":"Are these the same as Instagram filters?","a":"They use the same underlying operations — hue, saturation, contrast and tone curves — but not the same recipes. The presets here are a starting point rather than a match to any particular app."}]
};
})();