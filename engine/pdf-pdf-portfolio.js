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
window.PDF_TOOLS["pdf-portfolio"] = {
"title": "PDF Portfolio Creator",
"kind": "transform",
"multiple": true,
"description": "Combine multiple file types into a single PDF portfolio or unified document.",
"keywords": ["pdf portfolio","combine files to pdf","multi-file pdf","pdf binder","document assembler"],
"controls": [{"key":"mode","label":"Portfolio mode","type":"select","default":"merge","options":[{"value":"merge","label":"Merge all PDFs"},{"value":"portfolio","label":"Create PDF portfolio (prototype)"}]},{"key":"title","label":"Portfolio title","type":"text","default":"Document Portfolio"}],
"run": async ({ docs, opts, core }) => {
      const pdfDocs = docs.filter(d => d.name.toLowerCase().endsWith('.pdf'));
      
      if (pdfDocs.length < 2 && opts.mode === 'merge') {
        return { error: 'Need at least 2 PDFs for merge mode.' };
      }

      if (opts.mode === 'merge') {
        // Use existing merge logic
        const items = [];
        for (const d of pdfDocs) {
          const total = await d.doc.pageCount();
          for (let i = 0; i < total; i++) {
            items.push({ doc: d.doc, pageIndex: i });
          }
        }

        const bytes = await core.assemble(items, { info: { Title: opts.title } });
        return {
          files: [{ name: 'portfolio-merged.pdf', bytes }],
          stats: [
            ['PDFs merged', String(pdfDocs.length)],
            ['Total pages', String(items.length)],
            ['Output size', fmtBytes(bytes.length)]
          ]
        };
      } else {
        // Portfolio mode prototype
        return {
          files: [],
          stats: [
            ['Total files', String(docs.length)],
            ['PDFs', String(pdfDocs.length)],
            ['Other files', String(docs.length - pdfDocs.length)]
          ],
          warn: 'Full PDF portfolio creation requires embedding non-PDF files as attachments, which needs additional PDF library features.'
        };
      }
    },
"tips": ["Merge mode combines all PDFs into one continuous document.","Portfolio mode (prototype) would create a PDF with embedded files.","Arrange files in the desired order before processing.","Non-PDF files are noted but not processed in this prototype."],
"faq": [{"q":"Can I include Word or Excel files?","a":"The merge mode only handles PDFs. Full portfolio creation can embed other files as attachments, which requires additional PDF library capabilities."}]
};
})();