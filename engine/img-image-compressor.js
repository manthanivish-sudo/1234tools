(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-compressor"] = {
"title": "Image Compressor",
"kind": "canvas",
"multiple": true,
"description": "Shrink JPEG, PNG and WebP files with a live quality preview and a before/after size comparison.",
"keywords": ["image compressor","compress image","reduce image size","optimise images","compress jpeg","shrink photo"],
"controls": [{"key":"format","label":"Output format","type":"select","default":"image/webp","options":[{"value":"image/webp","label":"WebP — smallest"},{"value":"image/jpeg","label":"JPEG — universal"},{"value":"image/png","label":"PNG — lossless"},{"value":"same","label":"Keep original format"}]},{"key":"quality","label":"Quality","type":"range","default":80,"min":10,"max":100,"step":1},{"key":"maxWidth","label":"Max width (0 = keep)","type":"number","default":0,"min":0}],
"paint": (ctx, img, o, h) => {
      let { w, h: hh } = h.fit(img, Number(o.maxWidth) || 0, 0);
      h.size(w, hh);
      if (o.format === 'image/jpeg') h.fill('#ffffff');
      ctx.drawImage(img, 0, 0, w, hh);
    },
"tips": ["WebP is typically 25–35% smaller than JPEG at the same visual quality, and every current browser supports it.","Quality 80 is the usual sweet spot for photographs. Above 90 the file grows quickly for a difference almost nobody can see.","The largest saving is usually resizing, not compressing. A 4000px photo shown in an 800px column wastes most of what the visitor downloads.","Compressing an already-compressed JPEG loses more quality each time. Always start from the original."],
"faq": [{"q":"Are my images uploaded?","a":"No. The file is read by your browser, drawn to a canvas and re-encoded locally. Nothing is transmitted, which is why this works with the network off."},{"q":"Why did my PNG get bigger as a JPEG?","a":"JPEG handles photographs well and flat colour badly. Screenshots, logos and diagrams belong in PNG or WebP; converting them to JPEG usually adds size and visible artefacts."}]
};
})();