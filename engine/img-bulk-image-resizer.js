(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["bulk-image-resizer"] = {
"title": "Bulk Image Resizer",
"kind": "multi",
"multiple": true,
"description": "Resize dozens of images at once to a fixed width, height or percentage, and download them as a ZIP.",
"keywords": ["bulk image resizer","batch resize","resize multiple images","mass image resize","batch photo resize"],
"controls": [{"key":"mode","label":"Resize by","type":"select","default":"width","options":[{"value":"width","label":"Fixed width (keep ratio)"},{"value":"height","label":"Fixed height (keep ratio)"},{"value":"longest","label":"Longest edge"},{"value":"percent","label":"Percentage"},{"value":"exact","label":"Exact size (may distort)"}]},{"key":"value","label":"Value (px or %)","type":"number","default":1200,"min":1},{"key":"height","label":"Height (exact mode)","type":"number","default":800,"min":1},{"key":"format","label":"Output format","type":"select","default":"image/webp","options":[{"value":"image/webp","label":"WebP"},{"value":"image/jpeg","label":"JPEG"},{"value":"image/png","label":"PNG"}]},{"key":"quality","label":"Quality","type":"range","default":85,"min":10,"max":100}],
"produce": (img, o, h) => {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      let w, hh;
      const v = Number(o.value) || 1;
      if (o.mode === 'width')        { w = v; hh = Math.round(nh * (v / nw)); }
      else if (o.mode === 'height')  { hh = v; w = Math.round(nw * (v / nh)); }
      else if (o.mode === 'longest') { const s = v / Math.max(nw, nh); w = Math.round(nw * s); hh = Math.round(nh * s); }
      else if (o.mode === 'percent') { w = Math.round(nw * v / 100); hh = Math.round(nh * v / 100); }
      else                           { w = v; hh = Number(o.height) || nh; }
      return [{ suffix: `${w}x${hh}`, width: Math.max(1, w), height: Math.max(1, hh),
                paint: (ctx) => { if (o.format === 'image/jpeg') h.fillOn(ctx, '#fff', w, hh); ctx.drawImage(img, 0, 0, w, hh); } }];
    },
"tips": ["Resizing by longest edge is the safest bulk setting: portrait and landscape shots both end up within the same bounding box.","Never upscale in bulk. Enlarging past the original resolution adds file size and softness without adding detail.","Everything is processed on your device, so a large batch is limited by your machine’s memory rather than an upload queue."],
"faq": [{"q":"How many images can it handle?","a":"There is no artificial limit, but each image is decoded in memory. A few dozen photographs is comfortable on a phone; a few hundred is better done on a desktop."}]
};
})();