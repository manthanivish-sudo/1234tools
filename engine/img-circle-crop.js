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
"description": "Crop an image into a circle or rounded square, move and zoom it, add a ring or a background colour — ready for profile pictures, as PNG or WebP.",
"keywords": ["circle crop","round image","avatar maker","profile picture maker","rounded corners image","profile picture ring","circle crop webp"],
"controls": [{"key":"shape","label":"Shape","type":"select","default":"circle","options":[{"value":"circle","label":"Circle"},{"value":"rounded","label":"Rounded square"},{"value":"squircle","label":"Squircle (iOS style)"}]},
  {"key":"size","label":"Output size (px)","type":"number","default":512,"min":16,"max":4096},
  {"key":"radius","label":"Corner radius %","type":"range","default":25,"min":0,"max":50,"when":{"shape":["rounded"]}},
  {"key":"zoom","label":"Zoom %","type":"range","default":100,"min":100,"max":400},
  {"key":"posX","label":"Move left ↔ right","type":"range","default":0,"min":-100,"max":100},
  {"key":"posY","label":"Move up ↕ down","type":"range","default":0,"min":-100,"max":100},
  {"key":"bgmode","label":"Outside the shape","type":"select","default":"clear","options":[{"value":"clear","label":"Transparent"},{"value":"colour","label":"A colour"}]},
  {"key":"bg","label":"Background colour","type":"color","default":"#ffffff","when":{"bgmode":["colour"]}},
  {"key":"ring","label":"Ring style","type":"select","default":"solid","options":[{"value":"solid","label":"Solid"},{"value":"gap","label":"Solid, with a gap (story style)"},{"value":"double","label":"Double"},{"value":"gradient","label":"Gradient"}]},
  {"key":"border","label":"Border width (px)","type":"number","default":0,"min":0},
  {"key":"borderColor","label":"Border colour","type":"color","default":"#f7c948"},
  {"key":"borderColor2","label":"Second colour (gradient)","type":"color","default":"#7c5cff","when":{"ring":["gradient"]}},
  {"key":"format","label":"Save as","type":"select","default":"image/png","options":[{"value":"image/png","label":"PNG — lossless, transparent corners"},{"value":"image/webp","label":"WebP — small, transparent corners"},{"value":"image/jpeg","label":"JPEG — smallest; corners take the background colour"}]},
  {"key":"quality","label":"Quality (WebP / JPEG)","type":"range","default":90,"min":10,"max":100,"when":{"format":["image/webp","image/jpeg"]}}],
"jpegBackground": true,
"paint": async (ctx, img, o, h) => {
      const s = Math.max(16, Number(o.size) || 512);
      h.size(s, s);
      const b = Math.max(0, Number(o.border) || 0);
      const gap = b > 0 && o.ring === 'gap' ? Math.max(2, Math.round(b * 0.6)) : 0;
      const inset = b + gap;
      const inner = Math.max(1, s - inset * 2);
      const radiusOf = (side) => o.shape === 'squircle' ? side * 0.225 : side * ((Number(o.radius) || 25) / 100);
      const shape = (c, at, side, extra) => {
        c.beginPath();
        if (o.shape === 'circle') c.arc(s / 2, s / 2, side / 2, 0, Math.PI * 2);
        else h.roundRect(c, at, at, side, side, radiusOf(side - 2 * (extra || 0)) + (extra || 0));
      };
      if (o.bgmode === 'colour' || o.format === 'image/jpeg') { ctx.fillStyle = o.bg || '#ffffff'; ctx.fillRect(0, 0, s, s); }

      /* cover-fit the source into the shape, then zoom and move it */
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const z = Math.max(1, (Number(o.zoom) || 100) / 100);
      const scale = Math.max(inner / nw, inner / nh) * z;
      const dw = Math.max(1, Math.round(nw * scale)), dh = Math.max(1, Math.round(nh * scale));
      const px = Math.max(-1, Math.min(1, (Number(o.posX) || 0) / 100)), py = Math.max(-1, Math.min(1, (Number(o.posY) || 0) / 100));
      const x = inset + (inner - dw) / 2 - px * (dw - inner) / 2;
      const y = inset + (inner - dh) / 2 - py * (dh - inner) / 2;
      const src = h.resample ? await h.resample(img, dw, dh) : img;
      ctx.save();
      shape(ctx, inset, inner);
      ctx.clip();
      ctx.drawImage(src, x, y, dw, dh);
      ctx.restore();

      if (b > 0) {
        const colour = o.borderColor || '#f7c948';
        if (o.ring === 'gradient') {
          const g = ctx.createLinearGradient(0, s, s, 0);
          g.addColorStop(0, colour); g.addColorStop(1, o.borderColor2 || '#7c5cff');
          ctx.strokeStyle = g;
        } else ctx.strokeStyle = colour;
        if (o.ring === 'double') {
          const t = Math.max(1, b * 0.35);
          ctx.lineWidth = t;
          shape(ctx, t / 2, s - t, b - t / 2); ctx.stroke();
          shape(ctx, b - t / 2, s - 2 * b + t, t / 2); ctx.stroke();
        } else {
          ctx.lineWidth = b;
          shape(ctx, b / 2, s - b, b / 2);
          ctx.stroke();
        }
      }
    },
"outputFormat": null,
"tips": ["PNG and WebP keep the area outside the circle transparent. JPEG has no transparency, so it fills that area with the background colour.","The image is centre-cropped to a square first, so anything important should already be near the middle — or use Zoom and the two Move sliders to bring a face into the circle.","Ring styles: solid, solid with a gap between it and the photo like a story ring, double, or a gradient between two colours. The ring sits just outside the picture, so it never covers the photo.","512×512 covers almost every platform. Most display avatars far smaller and downscale server-side."],
"faq": [{"q":"Why does my avatar still look square on some sites?","a":"Many platforms apply their own circular mask in CSS and ignore transparency in the file. The circular PNG is still the safer upload, since it looks right in both cases."},{"q":"Can I save it as WebP?","a":"Yes. WebP keeps the transparent corners like PNG and is usually much smaller; every current browser shows it, though some upload forms still accept only PNG or JPEG."}]
};
})();
