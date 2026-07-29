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
window.PDF_TOOLS["pdf-page-numbers"] = {
"title": "Add Page Numbers to PDF",
"kind": "transform",
"multiple": false,
"description": "Stamp page numbers, headers or footers onto an existing PDF.",
"keywords": ["add page numbers to pdf","pdf page numbering","pdf header footer","number pdf pages"],
"controls": [{"key":"format","label":"Format","type":"select","default":"n","options":[{"value":"n","label":"1"},{"value":"n-of-t","label":"1 of 10"},{"value":"page-n","label":"Page 1"},{"value":"page-n-of-t","label":"Page 1 of 10"},{"value":"dash","label":"– 1 –"}]},{"key":"position","label":"Position","type":"select","default":"bc","options":[{"value":"bl","label":"Bottom left"},{"value":"bc","label":"Bottom centre"},{"value":"br","label":"Bottom right"},{"value":"tl","label":"Top left"},{"value":"tc","label":"Top centre"},{"value":"tr","label":"Top right"}]},{"key":"start","label":"Start numbering at","type":"number","default":1,"min":0},{"key":"skip","label":"Skip first N pages","type":"number","default":0,"min":0},{"key":"size","label":"Font size","type":"number","default":10,"min":5,"max":48},{"key":"colour","label":"Colour","type":"color","default":"#333333"},{"key":"extra","label":"Header or footer text (optional)","type":"text","default":""}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      const pages = await doc.getPages();
      const size = Math.max(5, Math.min(48, Number(opts.size) || 10));
      const skip = Math.max(0, Number(opts.skip) || 0);
      const start = Number(opts.start);
      const col = rgbTriplet(opts.colour);
      const margin = 32;

      const items = [];
      for (let i = 0; i < total; i++) {
        if (i < skip) { items.push({ doc, pageIndex: i }); continue; }
        const num = (isFinite(start) ? start : 1) + (i - skip);
        const numbered = total - skip;
        const label = {
          'n': String(num),
          'n-of-t': `${num} of ${numbered}`,
          'page-n': `Page ${num}`,
          'page-n-of-t': `Page ${num} of ${numbered}`,
          'dash': `\u2013 ${num} \u2013`
        }[opts.format] || String(num);

        const box = (await doc.resolve(pages[i].dict.MediaBox || pages[i].inherited.MediaBox)) || [0, 0, 595.28, 841.89];
        const W = Math.abs(Number(box[2]) - Number(box[0]));
        const H = Math.abs(Number(box[3]) - Number(box[1]));
        const tw = core.textWidth(label, 'Helvetica', size);

        const top = /^t/.test(opts.position);
        const y = top ? H - margin : margin;
        const x = /l$/.test(opts.position) ? margin
                : /r$/.test(opts.position) ? W - margin - tw
                : W / 2 - tw / 2;

        let ops = `q\n${col} rg\nBT\n/MVRpn ${size} Tf\n1 0 0 1 ${nf(x)} ${nf(y)} Tm\n(${core.contentEscape(label)}) Tj\nET\nQ\n`;
        if (opts.extra) {
          const ew = core.textWidth(opts.extra, 'Helvetica', size);
          const ey = top ? margin : H - margin;
          ops += `q\n${col} rg\nBT\n/MVRpn ${size} Tf\n1 0 0 1 ${nf(W / 2 - ew / 2)} ${nf(ey)} Tm\n(${core.contentEscape(opts.extra)}) Tj\nET\nQ\n`;
        }

        items.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: 'MVRpn', fontName: 'Helvetica', needsGS: false, opacity: 1
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-numbered.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages numbered', String(total - skip)],
          ['First number', String(isFinite(start) ? start : 1)],
          ['Position', opts.position],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Skip the first page when the document has a cover, and start numbering at 1 on the page after it.","Numbers are placed 32 points — about 11 mm — from the page edge, inside the printable area of virtually every printer.","If the document already has printed page numbers, these will sit alongside them. Check a page before committing to a long document.","Mixed page sizes are handled: the position is computed per page from that page’s own dimensions."],
"faq": [{"q":"Can I use Roman numerals for a preface?","a":"Not in one pass. Split the document, number the preface separately with a different format, then merge — which is exactly what the split and merge tools are for."}]
};
})();