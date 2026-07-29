(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["exif-remover"] = {
"title": "Remove Image Metadata",
"kind": "canvas",
"multiple": true,
"description": "Strip EXIF, GPS location and all other metadata from photos before you share them.",
"keywords": ["remove exif","strip metadata","remove gps from photo","clean image metadata","anonymise photo","remove photo location"],
"controls": [{"key":"format","label":"Save as","type":"select","default":"image/jpeg","options":[{"value":"image/jpeg","label":"JPEG"},{"value":"image/png","label":"PNG"},{"value":"image/webp","label":"WebP"}]},{"key":"quality","label":"Quality","type":"range","default":92,"min":50,"max":100}],
"paint": (ctx, img, o, h) => {
      h.size(img.naturalWidth, img.naturalHeight);
      if (o.format === 'image/jpeg') h.fill('#ffffff');
      ctx.drawImage(img, 0, 0);
    },
"showsMetadataDiff": true,
"tips": ["Metadata is removed by redrawing the pixels onto a fresh canvas and re-encoding. Nothing from the original file header survives, which is why this is thorough rather than selective.","The trade-off is that the image is re-compressed. At quality 92 the visual difference is negligible, but it is not byte-identical to the original.","Keep your original file. Once metadata is gone it cannot be recovered from the cleaned copy.","The tool shows which metadata segments were present before stripping, so you can see what was actually removed."],
"faq": [{"q":"Does this remove the copyright information too?","a":"Yes. Everything goes, including any authorship and copyright fields you may want to keep. If attribution matters, re-add it after stripping, or edit the specific fields with dedicated software instead."}]
};
})();