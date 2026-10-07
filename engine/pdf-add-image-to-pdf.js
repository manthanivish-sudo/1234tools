(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

function nf(v) {
  return Number.isInteger(v) ? String(v) : String(Number(Number(v).toFixed(4)));
}

/* A picture repeated across items (a logo on every page) is one object in
   the file: items arrive as structured clones, so they are matched by what
   they hold, not by identity. */
function imageKey(img) {
  const b = img.kind === 'jpeg' ? img.bytes : img.rgb;
  let h = 2166136261;
  for (let i = 0; i < b.length; i += Math.max(1, Math.floor(b.length / 4096))) { h ^= b[i]; h = Math.imul(h, 16777619); }
  return img.kind + ':' + img.width + 'x' + img.height + ':' + b.length + ':' + (h >>> 0).toString(36) + ':' + (img.alpha ? img.alpha.length : 0);
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["add-image-to-pdf"] = {
"title": "Add an Image to a PDF",
"kind": "transform",
"action": "Add the image",
"multiple": false,
"description": "Place a logo, a stamp or a photo on a PDF: drag it where you want it, resize it, and put it on one page or many. Transparency is kept. Nothing you add is uploaded.",
"keywords": ["add image to pdf","insert image in pdf","add logo to pdf","stamp on pdf","put picture on pdf"],
"glyph": "i-add-image-to-pdf",
"glyphSvg": "<symbol id=\"i-add-image-to-pdf\" viewBox=\"0 0 24 24\">\n  <path d=\"M6 2.8h7.6L18.6 8v13.2H6z\"/>\n  <path d=\"M13.6 2.8V8h5\" class=\"thin\"/>\n  <rect x=\"8.4\" y=\"11.4\" width=\"7.4\" height=\"6.4\" rx=\"1\" class=\"thin\"/>\n  <circle cx=\"10.6\" cy=\"13.6\" r=\"0.9\" class=\"fill\"/>\n</symbol>",
"needsRenderer": true,
"controls": [{"key":"image","label":"Image","type":"image","button":"Choose an image","hint":"PNG, JPEG, WebP or GIF; transparency is kept"},{"key":"width","label":"Width","type":"number","default":150,"min":4,"max":2000,"hint":"Points; the height follows the picture"},{"key":"opacity","label":"Opacity %","type":"number","default":100,"min":5,"max":100},{"key":"x","label":"X","type":"number","default":60,"min":0,"max":2000,"hint":"Points from the left edge to the picture's left"},{"key":"y","label":"Y","type":"number","default":600,"min":0,"max":2000,"hint":"Points up from the bottom edge to the picture's bottom"},{"key":"pages","label":"Pages","type":"text","default":"1","hint":"1, 2-5, all or last"}],
"placePreview": { "x": "x", "y": "y", "page": "pages", "image": "image", "imageWidth": "width", "opacity": "opacity", "items": "items", "lastWord": true, "title": "Drag the picture where you want it; pull its corner to resize it", "bankLabel": "Add as another image", "bankHint": "Keep this picture where it is and place another, or the same one somewhere else.", "emptyMessage": "Choose an image first, then add it as another one." },
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      const list = (opts.items || []).slice();
      if (opts.image) list.push({ image: opts.image, imageWidth: opts.width, opacity: opts.opacity, x: opts.x, y: opts.y, pages: opts.pages });
      if (!list.length) return { error: 'Choose an image to place first.' };

      const prepared = new Map();
      const placed = [];
      for (const it of list) {
        if (!it.image) continue;
        const key = imageKey(it.image);
        if (!prepared.has(key)) prepared.set(key, { name: 'MVRim' + prepared.size, prep: await core.prepareImage(it.image) });
        const v = String(it.pages == null ? '1' : it.pages).trim();
        let sel;
        if (/^last$/i.test(v)) sel = new Set([total - 1]);
        else {
          try { sel = new Set(core.parsePageRange(v, total)); }
          catch (e) { return { error: (it.image.name || 'Image') + ': ' + e.message }; }
        }
        const w = Math.max(4, Number(it.imageWidth) || 150);
        const h = w * it.image.height / it.image.width;
        const op = Math.max(0.05, Math.min(1, (Number(it.opacity) || 100) / 100));
        placed.push({ sel, x: Math.max(0, Number(it.x) || 0), y: Math.max(0, Number(it.y) || 0), w, h, op, img: prepared.get(key) });
      }

      const items = [];
      let pagesTouched = 0;
      for (let i = 0; i < total; i++) {
        const here = placed.filter((p) => p.sel.has(i));
        if (!here.length) { items.push({ doc, pageIndex: i }); continue; }
        pagesTouched++;
        let ops = '';
        const images = {}, gs = {};
        here.forEach((p, k) => {
          images[p.img.name] = p.img.prep;
          let g = '';
          if (p.op < 1) { const n = 'MVRimgs' + k; gs[n] = Math.round(p.op * 1000) / 1000; g = '/' + n + ' gs '; }
          ops += 'q ' + g + nf(p.w) + ' 0 0 ' + nf(p.h) + ' ' + nf(p.x) + ' ' + nf(p.y) + ' cm /' + p.img.name + ' Do Q\n';
        });
        /* X and Y are measured on the page as it is shown, like the preview */
        items.push({ doc, pageIndex: i, overlay: { content: ops, fontKey: null, images, gs, upright: true } });
      }
      const bytes = await core.assemble(items, {});
      return {
        files: [{ name: docs[0].name.replace(/\.pdf$/i, '') + '-with-image.pdf', bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages with a picture', String(pagesTouched)],
          ['Pictures placed', String(placed.length)],
          ['Picture files embedded', String(prepared.size) + ' (each stored once, however often it is drawn)'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Choose the picture, then drag it on the page preview to where it should go and pull its corner to make it larger or smaller; it keeps its proportions. With it focused, the arrow keys nudge it and + and − resize it.","To put a logo on every page, set Pages to all, or press every page above the preview. To place it differently on some pages, place one, press \"Add as another image\", and place the next.","A JPEG goes into the PDF as it is, untouched. Any other picture is stored losslessly, with its transparency, so a PNG logo on a white background stays crisp and a transparent one shows the page through it.","Opacity below 100% suits a faint stamp or a background picture; the text underneath stays readable and selectable."],
"faq": [{"q":"Will the picture be blurry?","a":"Not because of this tool: a JPEG is embedded byte for byte and any other format losslessly, at up to 2,400 pixels on its longer side. How sharp it looks depends on how many pixels it has for the size you draw it: a 600-pixel logo drawn 150 points (about 5 cm) wide is printed at 288 pixels to the inch, which is plenty."},{"q":"Can I put the picture behind the text?","a":"No, it is always drawn on top of the page's existing content. For a picture under text, lower its opacity: the text then shows through it."},{"q":"Is my file uploaded?","a":"No. The picture and the PDF are read and the result written by your own browser. Nothing you add is uploaded."}]
};
})();
