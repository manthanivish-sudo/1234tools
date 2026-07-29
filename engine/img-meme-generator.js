(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["meme-generator"] = {
"title": "Meme Generator",
"kind": "canvas",
"multiple": false,
"description": "Add classic top and bottom caption text to an image, with the traditional outlined Impact styling.",
"keywords": ["meme generator","meme maker","add text to image","caption image","impact font meme"],
"controls": [{"key":"top","label":"Top text","type":"text","default":"ONE DOES NOT SIMPLY"},{"key":"bottom","label":"Bottom text","type":"text","default":"SHIP WITHOUT TESTS"},{"key":"size","label":"Text size %","type":"range","default":10,"min":4,"max":20},{"key":"color","label":"Text colour","type":"color","default":"#ffffff"},{"key":"outline","label":"Outline colour","type":"color","default":"#000000"},{"key":"caps","label":"Force uppercase","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]}],
"paint": (ctx, img, o, h) => {
      const W = img.naturalWidth, H = img.naturalHeight;
      h.size(W, H);
      ctx.drawImage(img, 0, 0);

      const fs = H * ((Number(o.size) || 10) / 100);
      ctx.font = `bold ${fs}px Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, fs * 0.12);
      ctx.strokeStyle = o.outline || '#000000';
      ctx.fillStyle = o.color || '#ffffff';

      const wrap = (text) => {
        const words = String(text || '').split(/\s+/).filter(Boolean);
        const lines = []; let line = '';
        for (const word of words) {
          const test = line ? line + ' ' + word : word;
          if (ctx.measureText(test).width > W * 0.94 && line) { lines.push(line); line = word; }
          else line = test;
        }
        if (line) lines.push(line);
        return lines;
      };

      const draw = (text, atTop) => {
        if (!text) return;
        const t = o.caps === 'yes' ? String(text).toUpperCase() : String(text);
        const lines = wrap(t);
        lines.forEach((ln, i) => {
          const y = atTop
            ? fs * 1.05 + i * fs * 1.1
            : H - fs * 0.35 - (lines.length - 1 - i) * fs * 1.1;
          ctx.strokeText(ln, W / 2, y);
          ctx.fillText(ln, W / 2, y);
        });
      };
      ctx.textBaseline = 'alphabetic';
      draw(o.top, true);
      draw(o.bottom, false);
    },
"tips": ["Impact is the traditional meme typeface. If it is not installed the browser falls back to a similar condensed bold face.","Long captions wrap automatically. Reduce the text size if a caption covers too much of the picture.","The heavy outline exists so white text stays readable on light backgrounds. Keep it."],
"faq": [{"q":"Can I put text in the middle?","a":"Not in this tool — it follows the classic top-and-bottom format deliberately. For free placement, use a general image editor."}]
};
})();