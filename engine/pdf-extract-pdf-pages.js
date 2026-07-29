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
window.PDF_TOOLS["extract-pdf-pages"] = {
"title": "Extract PDF Pages",
"kind": "transform",
"multiple": false,
"description": "Pull specific pages out of a PDF into a new document, keeping the order you specify.",
"keywords": ["extract pdf pages","select pdf pages","pdf page extractor","get pages from pdf","copy pdf pages"],
"controls": [{"key":"pages","label":"Pages to keep","type":"text","default":"1-3","hint":"e.g. 1-3, 7, 10-"},{"key":"order","label":"Order","type":"select","default":"asis","options":[{"value":"asis","label":"As listed"},{"value":"sorted","label":"Sorted by page number"},{"value":"reverse","label":"Reversed"}]}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let idx;
      try { idx = core.parsePageRange(opts.pages, total); }
      catch (e) { return { error: e.message }; }

      if (opts.order === 'sorted') idx = idx.slice().sort((a, b) => a - b);
      if (opts.order === 'reverse') idx = idx.slice().reverse();

      const bytes = await core.assemble(idx.map(p => ({ doc, pageIndex: p })), {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-extract.pdf`, bytes }],
        stats: [
          ['Source pages', String(total)],
          ['Pages extracted', String(idx.length)],
          ['Page order', idx.map(i => i + 1).slice(0, 30).join(', ') + (idx.length > 30 ? ' …' : '')],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Page selections accept ranges, single pages and open-ended forms: \"1-3, 7, 10-\" takes pages 1 to 3, page 7, and everything from 10 onward.","Order \"as listed\" respects what you typed, so \"5, 1, 3\" produces those pages in that order — useful for reordering as you extract.","A page can appear twice. \"1, 1, 2\" duplicates the first page, which is occasionally what you want for a cover sheet."],
"faq": [{"q":"What happens to pages I do not select?","a":"They are simply not copied. The original file on your device is untouched — this always produces a new document."}]
};
})();