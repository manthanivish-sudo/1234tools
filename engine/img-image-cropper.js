(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

const SOCIAL = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.SOCIAL_PRESETS) || [];
window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-cropper"] = {
"title": "Image Cropper",
"kind": "select",
"multiple": false,
"description": "Crop an image with a box you can move, resize and type in, locked ratios and platform sizes, rotation and straightening.",
"keywords": ["image cropper","crop image online","crop photo","crop to square","free crop tool","crop image to 1080x1080","straighten photo"],
"controls": [{"key":"ratio","label":"Aspect ratio","type":"select","default":"free","when":{"platform":["none"]},"options":[{"value":"free","label":"Free"},{"value":"1:1","label":"Square 1:1"},{"value":"4:3","label":"4:3"},{"value":"3:2","label":"3:2"},{"value":"16:9","label":"16:9"},{"value":"9:16","label":"9:16 vertical"},{"value":"3:4","label":"3:4 portrait"},{"value":"2:3","label":"2:3 portrait"}]},
  {"key":"platform","label":"Platform size","type":"select","default":"none","options":[{"value":"none","label":"None — crop at the box’s own size"}].concat(SOCIAL.map((p, i) => ({ value: String(i), label: `${p.group} · ${p.name} — ${p.w}×${p.h}` })))},
  {"key":"format","label":"Output format","type":"select","default":"image/png","options":[{"value":"image/png","label":"PNG"},{"value":"image/jpeg","label":"JPEG"},{"value":"image/webp","label":"WebP"}]},
  {"key":"quality","label":"Quality","type":"range","default":92,"min":10,"max":100},
  {"key":"circle","label":"Circle preview","type":"select","default":"no","options":[{"value":"no","label":"Off"},{"value":"yes","label":"On — see it as a round profile picture"}]},
  {"key":"metadata","label":"Metadata","type":"select","default":"none","options":[{"value":"none","label":"Remove all (colours converted to sRGB)"},{"value":"icc","label":"Keep the colour profile only"},{"value":"exif","label":"Keep colour profile and EXIF, without GPS"},{"value":"all","label":"Keep everything: EXIF with GPS, XMP, colour profile"}]}],
"paintSelection": (ctx, img, sel, o, h) => {
      h.size(sel.w, sel.h);
      if (o.format === 'image/jpeg') h.fill('#ffffff');
      ctx.drawImage(img, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
    },
"tips": ["Drag on the preview to draw a crop, inside the box to move it, or on its handles to resize it. With a ratio locked, the selection keeps that shape as you drag.","Type exact numbers in X, Y, Width and Height, or nudge the box with the arrow keys (Shift for 10 pixels, Ctrl or ⌘ to resize).","A platform size locks its shape and saves at its exact pixels, scaled down with Lanczos3; a box smaller than that is saved at its own size, never enlarged.","Straighten turns the picture by up to 45° with a grid to line the horizon up against, then sets the box to the largest upright area that has no empty corners.","Cropping is lossless in the sense that remaining pixels are untouched — but re-encoding as JPEG will recompress them. Choose PNG to avoid that.","Crop before resizing. Cropping a downscaled image throws away detail you could have kept."],
"faq": [{"q":"Can I enter exact pixel coordinates?","a":"Yes. The X, Y, Width and Height boxes under the picture set the crop in the original’s pixels, and they follow the box as you drag. With a ratio locked, typing a width sets the height to match."},{"q":"Does cropping keep my photo’s location data?","a":"Not by default: the crop is a new file with none of the original’s metadata. Under Metadata you can keep the colour profile, or EXIF without GPS, or everything."}]
};
})();
