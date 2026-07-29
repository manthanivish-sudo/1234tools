(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["circle-crop"] = {
"title": "Circle Crop / Avatar Maker",
"kind": "canvas",
"multiple": true,
"description": "Crop an image into a circle or rounded square with a transparent background — ready for profile pictures.",
"keywords": ["circle crop","round image","avatar maker","profile picture maker","rounded corners image"],
"controls": [{"key":"shape","label":"Shape","type":"select","default":"circle","options":[{"value":"circle","label":"Circle"},{"value":"rounded","label":"Rounded square"},{"value":"squircle","label":"Squircle (iOS style)"}]},{"key":"size","label":"Output size (px)","type":"number","default":512,"min":16,"max":4096},{"key":"radius","label":"Corner radius %","type":"range","default":25,"min":0,"max":50},{"key":"border","label":"Border width (px)","type":"number","default":0,"min":0},{"key":"borderColor","label":"Border colour","type":"color","default":"#f7c948"}],
"paint": (ctx, img, o, h) => {
      const s = Math.max(16, Number(o.size) || 512);
      h.size(s, s);
      const b = Math.max(0, Number(o.border) || 0);
      const inner = s - b * 2;

      ctx.save();
      ctx.beginPath();
      if (o.shape === 'circle') {
        ctx.arc(s / 2, s / 2, inner / 2, 0, Math.PI * 2);
      } else {
        const r = o.shape === 'squircle' ? inner * 0.225 : inner * ((Number(o.radius) || 25) / 100);
        h.roundRect(ctx, b, b, inner, inner, r);
      }
      ctx.clip();

      // cover-fit the source into the shape
      const scale = Math.max(inner / img.naturalWidth, inner / img.naturalHeight);
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      ctx.drawImage(img, b + (inner - dw) / 2, b + (inner - dh) / 2, dw, dh);
      ctx.restore();

      if (b > 0) {
        ctx.strokeStyle = o.borderColor || '#f7c948';
        ctx.lineWidth = b;
        ctx.beginPath();
        if (o.shape === 'circle') ctx.arc(s / 2, s / 2, (s - b) / 2, 0, Math.PI * 2);
        else h.roundRect(ctx, b / 2, b / 2, s - b, s - b,
          (o.shape === 'squircle' ? inner * 0.225 : inner * ((Number(o.radius) || 25) / 100)) + b / 2);
        ctx.stroke();
      }
    },
"outputFormat": "image/png",
"tips": ["Always export as PNG. JPEG has no transparency, so the area outside the circle would fill with a solid colour.","The image is centre-cropped to a square first, so anything important should already be near the middle.","512×512 covers almost every platform. Most display avatars far smaller and downscale server-side."],
"faq": [{"q":"Why does my avatar still look square on some sites?","a":"Many platforms apply their own circular mask in CSS and ignore transparency in the file. The circular PNG is still the safer upload, since it looks right in both cases."}]
};
})();