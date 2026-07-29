(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-border"] = {
"title": "Add Border & Frame to Image",
"kind": "canvas",
"multiple": true,
"description": "Add a solid border, padding or polaroid-style frame around a photo.",
"keywords": ["add border to image","image frame","photo border","add padding to image","polaroid frame"],
"controls": [{"key":"style","label":"Style","type":"select","default":"solid","options":[{"value":"solid","label":"Even border"},{"value":"polaroid","label":"Polaroid (deep bottom edge)"},{"value":"double","label":"Double border"}]},{"key":"width","label":"Border width (px)","type":"number","default":40,"min":0,"max":500},{"key":"color","label":"Border colour","type":"color","default":"#ffffff"},{"key":"accent","label":"Inner line colour","type":"color","default":"#f7c948"},{"key":"radius","label":"Corner radius (px)","type":"number","default":0,"min":0}],
"paint": (ctx, img, o, h) => {
      const b = Math.max(0, Number(o.width) || 0);
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const bottom = o.style === 'polaroid' ? b * 3 : b;
      const W = nw + b * 2, H = nh + b + bottom;
      h.size(W, H);

      ctx.fillStyle = o.color || '#ffffff';
      const r = Number(o.radius) || 0;
      if (r > 0) { h.roundRect(ctx, 0, 0, W, H, r); ctx.fill(); }
      else ctx.fillRect(0, 0, W, H);

      if (o.style === 'double' && b > 8) {
        ctx.strokeStyle = o.accent || '#f7c948';
        ctx.lineWidth = Math.max(1, b * 0.12);
        ctx.strokeRect(b * 0.45, b * 0.45, W - b * 0.9, H - b * 0.9);
      }
      ctx.drawImage(img, b, b, nw, nh);
    },
"tips": ["A white border makes photographs read as prints and helps them stand out against a dark feed.","The polaroid style leaves a deep bottom edge, which is the traditional place for a caption.","Borders increase the image dimensions. Add the border last, after resizing to the size you actually need."],
"faq": [{"q":"Does the border change the aspect ratio?","a":"Yes. An even border keeps it close, but the polaroid style deliberately does not. If a platform needs an exact ratio, run the result through the social media resizer afterwards."}]
};
})();