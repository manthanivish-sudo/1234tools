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
window.PDF_TOOLS["pdf-editor"] = {
"title": "Add Text to a PDF",
"kind": "transform",
"multiple": false,
"description": "Put a line of text anywhere on a PDF \u2014 click the page to choose the spot and see it land before you commit.",
"keywords": ["add text to pdf","write on pdf","type on pdf","insert text in pdf","annotate pdf free","pdf text overlay"],
"controls": [{"key":"text","label":"Text to add","type":"textarea","default":""},{"key":"size","label":"Font size","type":"number","default":16,"min":8,"max":72},{"key":"colour","label":"Colour","type":"color","default":"#000000"},{"key":"x","label":"X","type":"number","default":297,"min":0,"max":2000,"hint":"Points from the left edge"},{"key":"y","label":"Y","type":"number","default":421,"min":0,"max":2000,"hint":"Points up from the bottom edge"},{"key":"pages","label":"Pages","type":"text","default":"1","hint":"1, 2-5, or all"}],
"placePreview": { "x": "x", "y": "y", "page": "pages", "text": "text", "size": "size", "colour": "colour" },
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      const text = String(opts.text || '').trim();
      if (!text) return { error: 'Type the text you want to add first.' };

      const size = Math.max(6, Math.min(72, Number(opts.size) || 16));
      const x = Math.max(0, Number(opts.x) || 297);
      const y = Math.max(0, Number(opts.y) || 421);
      const col = rgbTriplet(opts.colour);
      const esc = core.contentEscape(text);
      const pages = await doc.getPages();

      const items = [];
      for (let i = 0; i < total; i++) {
        if (!sel.has(i)) { items.push({ doc, pageIndex: i }); continue; }
        
        const ops = `q\n${col} rg\nBT\n/MVRedit ${size} Tf\n1 0 0 1 ${nf(x)} ${nf(y)} Tm\n(${esc}) Tj\nET\nQ\n`;
        
        items.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: 'MVRedit', fontName: 'Helvetica', needsGS: false, opacity: 1
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-edited.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages modified', String(sel.size)],
          ['Text added', text.slice(0, 50) + (text.length > 50 ? '...' : '')],
          ['Position', `X: ${x}, Y: ${y}`],
          ['Text size', size + 'px'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Click the page preview to set the position. The dashed box shows where the text will sit, at the size and colour it will be.","X and Y are PDF points from the bottom-left corner, 72 to the inch. A4 is 595 \u00d7 842, US Letter 612 \u00d7 792.","With the preview focused, the arrow keys nudge by 2 points and shift-arrow by 20 \u2014 easier than typing for small corrections.","Use \"all\" in the pages box to put the same line on every page, which is how you add a reference or a case number to a whole document.","The text is drawn in Helvetica. Characters outside Latin-1 \u2014 Greek, Cyrillic, CJK, most emoji \u2014 will not render, because that font has no glyphs for them.","To add several pieces of text, process the file once, then feed the result back in for the next one."],
"faq": [{"q":"Can I change the text that is already in my PDF?","a":"No. This draws new text on top of the page; it does not touch what is already there. Editing existing words means re-flowing the original text, which needs the fonts and the layout the PDF was made from, and most PDFs do not carry enough of either. If you need to change existing wording, edit the source document and export it again."},{"q":"How do I position the text?","a":"Click the page preview. The X and Y boxes fill in, and the dashed box shows exactly where the line will sit. You can also type coordinates directly, or focus the preview and nudge with the arrow keys."},{"q":"Can I add more than one piece of text?","a":"One at a time. Add the first line, download the result, then put that file back in for the next one. Each pass is lossless, so you can stack as many as you need."},{"q":"Are my files uploaded?","a":"No. The PDF is parsed and rewritten by your own browser. Nothing is transmitted, which is why this works offline and why it is safe for contracts and financial documents."}]
};
})();