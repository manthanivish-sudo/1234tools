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
window.PDF_TOOLS["delete-pdf-pages"] = {
"title": "Delete PDF Pages",
"kind": "transform",
"multiple": false,
"description": "Remove unwanted pages from a PDF — blank scans, cover sheets, or anything else.",
"keywords": ["delete pdf pages","remove pages from pdf","pdf page remover","erase pdf page"],
"controls": [{"key":"pages","label":"Pages to remove","type":"text","default":"1","hint":"e.g. 1, 4-6, 10-"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let drop;
      try { drop = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      const keep = Array.from({ length: total }, (_, i) => i).filter(i => !drop.has(i));
      if (!keep.length) return { error: 'That would remove every page. Leave at least one.' };

      const bytes = await core.assemble(keep.map(p => ({ doc, pageIndex: p })), {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-trimmed.pdf`, bytes }],
        stats: [
          ['Source pages', String(total)],
          ['Pages removed', String(drop.size)],
          ['Pages remaining', String(keep.length)],
          ['Removed', [...drop].map(i => i + 1).slice(0, 30).join(', ')],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Check the page numbers against the PDF’s own numbering, not any printed numbers on the page — a document with a cover often has them offset by one.","The inspector tool lists page count and sizes if you are unsure which page is which.","Nothing is destroyed. A new file is produced and your original stays as it is."],
"faq": [{"q":"Can I get a deleted page back?","a":"From the output, no. Keep the original file until you have checked the result — which is why this never overwrites anything."}]
};
})();