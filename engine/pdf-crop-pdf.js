(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

const MM = 72 / 25.4;


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["crop-pdf"] = {
"title": "Crop PDF",
"kind": "transform",
"action": "Crop PDF",
"multiple": false,
"description": "Trim the margins of PDF pages: drag the crop box on the page, or type the margins, then apply it to every page or the ones you choose. What is outside is hidden, not deleted.",
"keywords": ["crop pdf","trim pdf margins","cut pdf page","pdf crop tool","remove pdf margins"],
"glyph": "i-crop-pdf",
"glyphSvg": "<symbol id=\"i-crop-pdf\" viewBox=\"0 0 24 24\">\n  <path d=\"M6.6 2.6v14.8h14.8\"/>\n  <path d=\"M2.6 6.6h14.8v14.8\"/>\n</symbol>",
"needsRenderer": true,
"cropEditor": { "top": "top", "right": "right", "bottom": "bottom", "left": "left", "page": "pages" },
"controls": [{"key":"top","label":"Top margin to remove","type":"number","default":15,"min":0,"max":500,"step":0.5,"hint":"mm"},{"key":"right","label":"Right","type":"number","default":15,"min":0,"max":500,"step":0.5,"hint":"mm"},{"key":"bottom","label":"Bottom","type":"number","default":15,"min":0,"max":500,"step":0.5,"hint":"mm"},{"key":"left","label":"Left","type":"number","default":15,"min":0,"max":500,"step":0.5,"hint":"mm"},{"key":"pages","label":"Pages","type":"text","default":"all","hint":"all, or 1-3, 7"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }
      const m = ['top', 'right', 'bottom', 'left'].map((k) => Math.max(0, Number(opts[k]) || 0) * MM);
      const items = [];
      let cropped = 0;
      for (let i = 0; i < total; i++) {
        if (!sel.has(i)) { items.push({ doc, pageIndex: i }); continue; }
        /* the margins are measured on the page as it is shown (turned by its
           /Rotate, already cropped); the new box is mapped back into the
           page's own coordinates */
        const f = await core.pageFrame(doc, i);
        const [t, r, b, l] = m;
        if (l + r >= f.width - 1 || t + b >= f.height - 1) {
          return { error: 'Those margins leave nothing of page ' + (i + 1) + ', which is ' + Math.round(f.width / MM) + ' × ' + Math.round(f.height / MM) + ' mm as shown. Make them smaller.' };
        }
        const M = f.matrix;
        const pts = [[l, b], [f.width - r, b], [l, f.height - t], [f.width - r, f.height - t]]
          .map(([x, y]) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]);
        const box = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
        items.push({ doc, pageIndex: i, cropBox: box });
        cropped++;
      }
      const bytes = await core.assemble(items, {});
      const r2 = (v) => Math.round(v / MM * 10) / 10;
      const f0 = await core.pageFrame(doc, [...sel][0]);
      return {
        files: [{ name: docs[0].name.replace(/\.pdf$/i, '') + '-cropped.pdf', bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages cropped', String(cropped)],
          ['Margins removed', 'top ' + r2(m[0]) + ', right ' + r2(m[1]) + ', bottom ' + r2(m[2]) + ', left ' + r2(m[3]) + ' mm'],
          ['First cropped page, as shown', r2(f0.width - m[1] - m[3]) + ' × ' + r2(f0.height - m[0] - m[2]) + ' mm'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Drag the box on the page, or its edges and corners, to choose what stays; the margins boxes fill in to match, and typing a margin moves the box. With an edge or corner focused, the arrow keys move it by 1 mm, Shift by 5 mm.","Fit to the content finds the drawn part of the page in view, the text and pictures, and sets the box just around it, with a 2 mm border.","Margins are measured on the page as you see it, so a page stored sideways is cropped the way it is shown. The same margins are applied to every page in the Pages box.","Cropping hides what is outside the box; it does not delete it. The content is still in the file and comes back if the crop box is removed, so do not crop to hide something private."],
"faq": [{"q":"Does cropping make the file smaller?","a":"Hardly. A crop sets the visible area of each page (its CropBox); everything outside is still stored, just not shown or printed. That is also why the change is instant and lossless, and can be undone by anyone with a PDF editor."},{"q":"Can I crop each page differently?","a":"Run the tool once per set of pages: crop pages 1-3 with one box, then open the result and crop page 4 with another. The Pages box decides which pages each run touches; the others are left exactly as they were."},{"q":"Is my file uploaded?","a":"No. The page is drawn and the file rewritten by your own browser. Nothing you add is uploaded."}]
};
})();
