(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

/* The filters are worked on the pixels themselves (engine/img-filters-core.mjs),
   in the codec worker, so Safari, whose canvas has no ctx.filter, gives the
   same picture as Chrome and Firefox. */
const NUM = ['intensity', 'exposure', 'brightness', 'contrast', 'saturate', 'highlights', 'shadows', 'hue', 'temperature', 'vignette', 'sharpen', 'blur'];
window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["photo-filters"] = {
"title": "Photo Filters & Adjustments",
"kind": "canvas",
"multiple": true,
"codecs": "wasm",
"description": "Adjust exposure, highlights, shadows, colour temperature, hue, sharpness and vignette, or apply a preset at the strength you choose, with a before-and-after view.",
"keywords": ["photo filter","image effects","grayscale image","sepia filter","brightness contrast","black and white photo","photo exposure","vignette","sharpen image","warm photo filter"],
"controls": [{"key":"preset","label":"Preset","type":"select","default":"none","options":[{"value":"none","label":"None"},{"value":"grayscale","label":"Black & white"},{"value":"sepia","label":"Sepia"},{"value":"invert","label":"Invert"},{"value":"vintage","label":"Vintage"},{"value":"cool","label":"Cool"},{"value":"warm","label":"Warm"},{"value":"dramatic","label":"Dramatic"}]},
  {"key":"intensity","label":"Preset strength %","type":"range","default":100,"min":0,"max":100,"when":{"preset":["grayscale","sepia","invert","vintage","cool","warm","dramatic"]}},
  {"key":"exposure","label":"Exposure (stops)","type":"range","default":0,"min":-2,"max":2,"step":0.1},
  {"key":"brightness","label":"Brightness %","type":"range","default":100,"min":0,"max":200},
  {"key":"contrast","label":"Contrast %","type":"range","default":100,"min":0,"max":200},
  {"key":"highlights","label":"Highlights","type":"range","default":0,"min":-100,"max":100},
  {"key":"shadows","label":"Shadows","type":"range","default":0,"min":-100,"max":100},
  {"key":"saturate","label":"Saturation %","type":"range","default":100,"min":0,"max":300},
  {"key":"temperature","label":"Temperature (cool ↔ warm)","type":"range","default":0,"min":-100,"max":100},
  {"key":"hue","label":"Hue (degrees)","type":"range","default":0,"min":-180,"max":180},
  {"key":"sharpen","label":"Sharpen","type":"range","default":0,"min":0,"max":100},
  {"key":"blur","label":"Blur (px)","type":"range","default":0,"min":0,"max":20},
  {"key":"vignette","label":"Vignette","type":"range","default":0,"min":0,"max":100},
  {"key":"format","label":"Save as","type":"select","default":"image/png","options":[{"value":"image/png","label":"PNG — lossless"},{"value":"image/jpeg","label":"JPEG — much smaller for photos"},{"value":"image/webp","label":"WebP — small"}]},
  {"key":"quality","label":"Quality (JPEG / WebP)","type":"range","default":92,"min":10,"max":100,"when":{"format":["image/jpeg","image/webp"]}}],
"paint": async (ctx, img, o, h) => {
      h.size(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, 0, 0);
      const p = { preset: o.preset || 'none' };
      NUM.forEach((k) => { if (o[k] !== undefined && o[k] !== '') p[k] = Number(o[k]); });
      const neutral = p.preset === 'none' && !p.exposure && (p.brightness === undefined || p.brightness === 100) &&
        (p.contrast === undefined || p.contrast === 100) && (p.saturate === undefined || p.saturate === 100) &&
        !p.highlights && !p.shadows && !p.hue && !p.temperature && !p.sharpen && !p.blur && !p.vignette;
      if (!neutral) await h.filters(p);
    },
"tips": ["Drag the line across the before-and-after view to compare, or switch to side by side; zoom to 100% or 200% to judge sharpening and grain.","Adjustments stack on top of the preset, and Preset strength mixes the preset with the original, so 40% Vintage is a hint of it rather than the full look.","Exposure works in linear light, in stops, as a camera does: +1 doubles the light. Highlights and Shadows move only the bright or the dark half of the picture, so you can rescue a sky or open up a face without flattening the rest.","Temperature warms (more red, less blue) or cools the whole picture; Hue turns every colour round the colour wheel.","Contrast above about 130% starts clipping highlights and shadows, and clipped detail cannot be recovered later.","Every filter is worked out on the pixels themselves, so Safari, Chrome and Firefox give the same file."],
"faq": [{"q":"Are these the same as Instagram filters?","a":"They use the same underlying operations — hue, saturation, contrast and tone curves — but not the same recipes. The presets here are a starting point rather than a match to any particular app."},{"q":"Will the result look the same in every browser?","a":"Yes. The filters are calculated pixel by pixel by this page’s own code rather than by the browser’s canvas filters, which Safari does not have, so the same settings give the same file everywhere."}]
};
})();
