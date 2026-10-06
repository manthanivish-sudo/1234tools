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
"action": "Add text",
"multiple": false,
"description": "Put text anywhere on a PDF \u2014 as many pieces as you like, on any pages, wrapped to a width. Click the page to place each one and see it land before you commit.",
"keywords": ["add text to pdf","write on pdf","type on pdf","insert text in pdf","annotate pdf free","pdf text overlay"],
"controls": [{"key":"text","label":"Text to add","type":"textarea","default":""},{"key":"size","label":"Font size","type":"number","default":16,"min":8,"max":72},{"key":"colour","label":"Colour","type":"color","default":"#000000"},{"key":"x","label":"X","type":"number","default":297,"min":0,"max":2000,"hint":"Points from the left edge"},{"key":"y","label":"Y","type":"number","default":421,"min":0,"max":2000,"hint":"Points up from the bottom edge"},{"key":"pages","label":"Pages","type":"text","default":"1","hint":"1, 2-5, or all"},{"key":"width","label":"Wrap width","type":"number","default":0,"min":0,"max":2000,"hint":"Points. 0 keeps each line as typed"}],
"placePreview": { "x": "x", "y": "y", "page": "pages", "text": "text", "size": "size", "colour": "colour", "width": "width", "items": "items" },
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      /* Every banked item plus whatever is in the controls now. */
      const items = (opts.items || []).map(it => Object.assign({}, it));
      const cur = String(opts.text || '');
      if (cur.trim()) {
        items.push({
          text: cur, size: Number(opts.size) || 16, colour: opts.colour, x: Number(opts.x) || 0,
          y: Number(opts.y) || 0, width: Number(opts.width) || 0, pages: String(opts.pages || '1')
        });
      }
      if (!items.length) return { error: 'Type the text you want to add first.' };

      /* Resolve each item's pages once; a bad range names the item. */
      /* text WinAnsi cannot hold (Polish, Greek, Cyrillic, ₹, Hindi …) is
         drawn in an embedded Noto subset; the rest stays in Helvetica */
      const tf = core.textRun ? core.textRun() : null;
      const placed = [];
      for (const it of items) {
        const v = String(it.pages || '1').trim();
        let sel;
        try { sel = new Set(/^last$/i.test(v) ? [total - 1] : core.parsePageRange(v, total)); }
        catch (e) { return { error: `"${it.text.split('\n')[0].slice(0, 30)}": ${e.message}` }; }
        const size = Math.max(6, Math.min(72, Number(it.size) || 16));
        const uni = tf && core.unicodeFonts.needs(it.text);
        const lines = it.width > 0
          ? (uni ? await tf.wrap(it.text, size, false, it.width) : core.wrapText(it.text, 'Helvetica', size, it.width))
          : String(it.text).split('\n');
        if (uni) for (const l of lines) await tf.prepare(l, false);
        placed.push({
          sel, size, lines, x: Math.max(0, Number(it.x) || 0), y: Math.max(0, Number(it.y) || 0),
          col: rgbTriplet(it.colour), lead: size * 1.25
        });
      }

      const assembled = [];
      let pagesTouched = 0, linesWritten = 0;
      for (let i = 0; i < total; i++) {
        const here = placed.filter(p => p.sel.has(i));
        if (!here.length) { assembled.push({ doc, pageIndex: i }); continue; }
        pagesTouched++;
        let ops = 'q\n';
        for (const p of here) {
          ops += `${p.col} rg\nBT\n/MVRedit ${p.size} Tf\n`;
          p.lines.forEach((line, k) => {
            if (!line) return;
            if (tf && tf.has(line, false)) {
              ops += `1 0 0 1 ${nf(p.x)} ${nf(p.y - k * p.lead)} Tm\n${tf.show(line, p.size, false).ops}\n/MVRedit ${p.size} Tf\n`;
            } else ops += `1 0 0 1 ${nf(p.x)} ${nf(p.y - k * p.lead)} Tm\n(${core.contentEscape(line)}) Tj\n`;
            linesWritten++;
          });
          ops += 'ET\n';
        }
        ops += 'Q\n';
        assembled.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: 'MVRedit', fontName: 'Helvetica', needsGS: false, opacity: 1, upright: true
        }});
      }

      const fonts = tf ? tf.overlayFonts() : {};
      if (Object.keys(fonts).length) assembled.forEach((a) => { if (a.overlay) a.overlay.fonts = fonts; });
      const miss = tf && tf.missing ? tf.missing() : [];
      const missWarn = miss.length ? 'These characters are not in the fonts this tool embeds and show as empty boxes: ' + miss.slice(0, 12).join(' ') + (miss.length > 12 ? ' …' : '') + '. Noto Sans covers Latin, Greek, Cyrillic and Devanagari.' : undefined;

      const bytes = await core.assemble(assembled, tf ? { finish: (w) => tf.finish(w) } : {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-edited.pdf`, bytes }],
        warn: missWarn,
        stats: [
          ['Pages', String(total)],
          ['Pages written to', String(pagesTouched)],
          ['Items placed', String(items.length)],
          ['Lines written', String(linesWritten)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Click the page preview to place the text. The dashed box shows where it will sit, at the size and colour it will be; if it wraps, every line is shown.","Drag the dashed box to move the text, pull its corner handle to make it larger or smaller, or its side handle to set the wrap width. With the box focused, the arrow keys nudge it (Shift for 20 points) and + and − resize it.","Several pieces of text: place the first, press “Add as another item”, and the controls clear for the next one. Banked items stay drawn on the preview in grey; drag one to move it, click it to edit it, or remove it from the list.","Put an item on this page, every page or the last page with the buttons above the preview, or type pages such as 2-5 in its Pages box.","Wrap width is in points, measured with the real font metrics — A4 is 595 wide, so 450 leaves comfortable margins. 0 means each line stays exactly as typed, and a blank line in the box is a blank line on the page.","Use the arrows beside “Page 1 of N” to look through the document. The Pages box on each item decides where it goes: 1, 2-5, all, or last.","With the preview focused, the arrow keys nudge by 2 points and shift-arrow by 20, and Page Up and Page Down turn the page.","X and Y are PDF points from the bottom-left corner of the page as it is shown, 72 to the inch — a rotated or cropped page is measured the way you see it. A4 is 595 × 842, US Letter 612 × 792.","Text the standard fonts can hold is drawn in Helvetica, with nothing embedded. Anything else (Hindi, Greek, Cyrillic, Polish letters, the rupee sign) is drawn in Noto Sans or Noto Sans Devanagari, embedded as a subset of only the characters used, so it stays searchable and can be copied. Chinese, Japanese, Arabic and emoji are not covered and the tool says so."],
"faq": [{"q":"Can I change the text that is already in my PDF?","a":"No. This draws new text on top of the page; it does not touch what is already there. Editing existing words means re-flowing the original text, which needs the fonts and the layout the PDF was made from, and most PDFs do not carry enough of either. If you need to change existing wording, edit the source document and export it again."},{"q":"How do I add more than one piece of text?","a":"Type the first, click where it goes, then press “Add as another item”. It moves into the list below and stays drawn on the preview; the controls clear for the next one. Each item keeps its own page, position, size, colour and wrap width. Edit puts an item back in the controls; the cross removes it. Whatever is in the controls when you press Add text is included too."},{"q":"Why does my text run off the page in one line?","a":"Set a wrap width. With it at 0 the tool draws each line exactly as you typed it, which is right for a label or a reference number and wrong for a paragraph. A width of 450 points on an A4 page wraps like a normal document; the preview shows the wrapped lines before you commit."},{"q":"How do I see a page other than the first one?","a":"Use the arrows beside the page number above the preview, or Page Up and Page Down with the preview focused. Paging through changes nothing on its own: each item’s Pages box decides where it is written, and the preview greys out items that are not on the page in view."},{"q":"Can I add a picture or a logo?","a":"Not with this tool, which writes text. Add an Image to a PDF places a logo, a stamp or a photo the same way: drag it, resize it, and put it on one page or many."},{"q":"Can I write in Hindi?","a":"Yes. Hindi is shaped the way it is printed, conjuncts and the i-matra included, and embedded in Noto Sans Devanagari, so the words can be searched and copied back out correctly. The first time you use it the font and the shaping engine are downloaded from this site, about 0.65 MB, and kept afterwards."},{"q":"Are my files uploaded?","a":"No. The PDF is parsed and rewritten by your own browser. Nothing is transmitted, which is why this works offline and why it is safe for contracts and financial documents."}]
};
})();