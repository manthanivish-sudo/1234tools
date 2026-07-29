(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-cropper"] = {
"title": "Image Cropper",
"kind": "select",
"multiple": false,
"description": "Crop an image by dragging a selection, with optional locked aspect ratios.",
"keywords": ["image cropper","crop image online","crop photo","crop to square","free crop tool"],
"controls": [{"key":"ratio","label":"Aspect ratio","type":"select","default":"free","options":[{"value":"free","label":"Free"},{"value":"1:1","label":"Square 1:1"},{"value":"4:3","label":"4:3"},{"value":"3:2","label":"3:2"},{"value":"16:9","label":"16:9"},{"value":"9:16","label":"9:16 vertical"},{"value":"3:4","label":"3:4 portrait"},{"value":"2:3","label":"2:3 portrait"}]},{"key":"format","label":"Output format","type":"select","default":"image/png","options":[{"value":"image/png","label":"PNG"},{"value":"image/jpeg","label":"JPEG"},{"value":"image/webp","label":"WebP"}]},{"key":"quality","label":"Quality","type":"range","default":92,"min":10,"max":100}],
"paintSelection": (ctx, img, sel, o, h) => {
      h.size(sel.w, sel.h);
      if (o.format === 'image/jpeg') h.fill('#ffffff');
      ctx.drawImage(img, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
    },
"tips": ["Drag on the preview to set the crop. With a ratio locked, the selection keeps that shape as you drag.","Cropping is lossless in the sense that remaining pixels are untouched — but re-encoding as JPEG will recompress them. Choose PNG to avoid that.","Crop before resizing. Cropping a downscaled image throws away detail you could have kept."],
"faq": [{"q":"Can I enter exact pixel coordinates?","a":"The selection box reports its position and size live as you drag, so you can nudge until the numbers match what you need. For a fixed output size, the social media resizer is usually the better tool."}]
};
})();