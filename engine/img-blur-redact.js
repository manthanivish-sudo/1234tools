(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["blur-redact"] = {
"title": "Blur & Redact Image",
"kind": "select",
"multiple": false,
"description": "Blur, pixelate or black out part of an image to hide faces, addresses or account details before sharing.",
"keywords": ["blur image","pixelate image","redact screenshot","hide face in photo","censor image","blur part of image"],
"controls": [{"key":"method","label":"Method","type":"select","default":"pixelate","options":[{"value":"pixelate","label":"Pixelate — irreversible"},{"value":"blur","label":"Blur"},{"value":"block","label":"Solid block — safest"}]},{"key":"strength","label":"Strength","type":"range","default":16,"min":2,"max":60},{"key":"color","label":"Block colour","type":"color","default":"#000000"},{"key":"scope","label":"Apply to","type":"select","default":"selection","options":[{"value":"selection","label":"Selected area only"},{"value":"whole","label":"Whole image"}]}],
"paintSelection": (ctx, img, sel, o, h) => {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      h.size(nw, nh);
      ctx.drawImage(img, 0, 0);

      const r = o.scope === 'whole' ? { x: 0, y: 0, w: nw, h: nh } : sel;
      if (!r || r.w < 1 || r.h < 1) return;

      const s = Math.max(2, Number(o.strength) || 16);
      if (o.method === 'block') {
        ctx.fillStyle = o.color || '#000000';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      } else if (o.method === 'blur') {
        ctx.save();
        ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
        ctx.filter = `blur(${s}px)`;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';
        ctx.restore();
      } else {
        // downscale then draw back with smoothing off — genuinely destroys detail
        const cols = Math.max(1, Math.round(r.w / s)), rows = Math.max(1, Math.round(r.h / s));
        const tmp = h.scratch(cols, rows);
        tmp.ctx.imageSmoothingEnabled = true;
        tmp.ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, cols, rows);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp.canvas, 0, 0, cols, rows, r.x, r.y, r.w, r.h);
        ctx.imageSmoothingEnabled = true;
      }
    },
"tips": ["A solid block is the only method that is provably irreversible. Both blur and pixelation have been reversed in published research, particularly on short strings like numbers.","Never redact by drawing a shape in a document editor and exporting — the original pixels often survive underneath. Re-exporting the flattened image, as this tool does, is what actually removes them.","For screenshots containing account numbers or addresses, use the solid block and check the result before sharing."],
"faq": [{"q":"Is pixelation safe for hiding text?","a":"No. Pixelated text has been recovered by researchers, because the process is deterministic and the space of possible characters is small. Use a solid block for anything sensitive."}]
};
})();