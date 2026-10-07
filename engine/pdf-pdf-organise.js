(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';
}

function rgbTriplet(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '#000000'));
  if (!m) return '0 0 0';
  return [1, 2, 3].map(i => nf(parseInt(m[i], 16) / 255)).join(' ');
}

function nf(v) {
  return Number.isInteger(v) ? String(v) : String(Number(Number(v).toFixed(4)));
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["pdf-organise"] = {
"title": "Organise PDF Pages",
"kind": "transform",
"action": "Save the new order",
"multiple": false,
"description": "See page thumbnails and reorder, rotate or delete pages visually before saving.",
"keywords": ["organise pdf","reorder pdf pages","rearrange pdf","pdf page organizer","move pdf pages"],
"needsRenderer": true,
"pageGrid": { "mode": "organise", "label": "Pages, in their new order" },
"controls": [],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      /* the grid hands over the kept pages in their new order, each with the
         quarter turns added to it; with no grid (a test, an old browser) the
         file is saved as it is */
      const layout = Array.isArray(opts.layout)
        ? opts.layout.filter((x) => x && x.p >= 0 && x.p < total)
        : Array.from({ length: total }, (_, i) => ({ p: i, r: 0 }));
      if (!layout.length) return { error: 'Every page is marked for removal.' };
      const bytes = await core.assemble(layout.map((x) => ({ doc, pageIndex: x.p, rotate: Number(x.r) || 0 })), {});
      const moved = layout.filter((x, i) => x.p !== i).length;
      return {
        files: [{ name: docs[0].name.replace(/\.pdf$/i, '') + '-organised.pdf', bytes }],
        stats: [
          ['Source pages', String(total)],
          ['Pages kept', String(layout.length)],
          ['Pages removed', String(total - layout.length)],
          ['Pages moved', String(moved)],
          ['Rotated', String(layout.filter((x) => Number(x.r)).length)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["The thumbnails appear as soon as the file is open, drawn as they scroll into view; the rendering engine behind them is downloaded once and cached afterwards.","Drag thumbnails to reorder, use the rotate button on each, and the cross to mark a page for removal. On a touch screen, drag by the grip in a card’s corner; from the keyboard, the ← and → buttons move a page one place and keep the focus, so you can press them again.","Nothing is changed until you save. The original file on your device is never modified.","If you already know the page numbers you want, the extract, delete and rotate tools do the same job without any download."],
"faq": [{"q":"Is there a page limit?","a":"Up to 10,000 pages. Only the thumbnails near the part of the grid on screen are drawn, so a long document opens quickly and memory stays modest; the pages further down are drawn as you scroll to them."}]
};
})();