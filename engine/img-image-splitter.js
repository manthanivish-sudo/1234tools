(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-splitter"] = {
"title": "Image Splitter (Grid & Carousel)",
"kind": "multi",
"multiple": false,
"description": "Cut an image into a grid of tiles — for Instagram carousels, photo mosaics or sprite sheets.",
"keywords": ["image splitter","split image grid","instagram carousel maker","cut image into pieces","image tiles"],
"controls": [{"key":"preset","label":"Layout","type":"select","default":"custom","options":[{"value":"custom","label":"Custom grid"},{"value":"carousel3","label":"Instagram carousel — 3 panels"},{"value":"carousel2","label":"Instagram carousel — 2 panels"},{"value":"grid3x3","label":"Instagram 3×3 mosaic"},{"value":"half-h","label":"Split in half — horizontally"},{"value":"half-v","label":"Split in half — vertically"}]},{"key":"cols","label":"Columns","type":"number","default":3,"min":1,"max":12},{"key":"rows","label":"Rows","type":"number","default":3,"min":1,"max":12},{"key":"format","label":"Format","type":"select","default":"image/jpeg","options":[{"value":"image/jpeg","label":"JPEG"},{"value":"image/png","label":"PNG"}]}],
"produce": (img, o) => {
      const P = {
        carousel3: [3, 1], carousel2: [2, 1], grid3x3: [3, 3],
        'half-h': [2, 1], 'half-v': [1, 2]
      };
      const [cols, rows] = P[o.preset] ||
        [Math.max(1, Number(o.cols) || 1), Math.max(1, Number(o.rows) || 1)];

      const tw = Math.floor(img.naturalWidth / cols);
      const th = Math.floor(img.naturalHeight / rows);
      const out = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const sx = c * tw, sy = r * th;
          out.push({
            suffix: `r${r + 1}c${c + 1}`, width: tw, height: th,
            paint: (ctx) => ctx.drawImage(img, sx, sy, tw, th, 0, 0, tw, th)
          });
        }
      }
      return out;
    },
"tips": ["For an Instagram carousel, use 3 panels and post them in order — the app stitches them into one panorama as the viewer swipes.","For a 3×3 profile mosaic, upload the tiles in reverse order. The grid fills right to left, bottom to top.","Dimensions that do not divide evenly leave a few pixels unused at the right and bottom edges. Crop to an exact multiple first if that matters."],
"faq": [{"q":"Why do my carousel panels show seams?","a":"Instagram compresses each panel separately, so gradients can band slightly at the joins. Using PNG and avoiding smooth gradients across the seam reduces it."}]
};
})();