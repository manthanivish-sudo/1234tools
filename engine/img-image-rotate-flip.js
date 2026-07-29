(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-rotate-flip"] = {
"title": "Rotate & Flip Image",
"kind": "canvas",
"multiple": true,
"description": "Rotate by any angle and mirror horizontally or vertically, with the canvas resized to fit.",
"keywords": ["rotate image","flip image","mirror image","rotate photo online","straighten image"],
"controls": [{"key":"angle","label":"Rotation (degrees)","type":"range","default":0,"min":-180,"max":180,"step":1},{"key":"flipH","label":"Mirror horizontally","type":"select","default":"no","options":[{"value":"no","label":"No"},{"value":"yes","label":"Yes"}]},{"key":"flipV","label":"Mirror vertically","type":"select","default":"no","options":[{"value":"no","label":"No"},{"value":"yes","label":"Yes"}]},{"key":"bg","label":"Fill colour","type":"color","default":"#ffffff"}],
"paint": (ctx, img, o, h) => {
      const rad = (Number(o.angle) || 0) * Math.PI / 180;
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
      const W = Math.round(nw * c + nh * s), H = Math.round(nw * s + nh * c);
      h.size(W, H);
      if (Math.abs(rad) > 1e-6) h.fill(o.bg || '#ffffff');

      ctx.translate(W / 2, H / 2);
      ctx.rotate(rad);
      ctx.scale(o.flipH === 'yes' ? -1 : 1, o.flipV === 'yes' ? -1 : 1);
      ctx.drawImage(img, -nw / 2, -nh / 2);
    },
"tips": ["The canvas is enlarged to fit the rotated image, so nothing is clipped. The corners fill with the chosen colour.","Rotating by 90, 180 or 270 degrees is lossless in shape — no interpolation is needed. Other angles resample the pixels.","Phone photos often appear sideways because the sensor orientation lives in EXIF rather than the pixels. Re-saving here bakes the correct orientation into the file."],
"faq": [{"q":"Why did my photo appear rotated after upload elsewhere?","a":"Some software honours the EXIF orientation flag and some ignores it. Saving a rotated copy here writes the pixels in the right order, so every viewer agrees."}]
};
})();