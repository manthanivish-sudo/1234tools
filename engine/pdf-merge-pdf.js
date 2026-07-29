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
window.PDF_TOOLS["merge-pdf"] = {
"title": "Merge PDF Files",
"kind": "transform",
"multiple": true,
"description": "Combine several PDFs into one, in any order, without uploading anything.",
"keywords": ["merge pdf","combine pdf","join pdf files","pdf merger","concatenate pdf"],
"controls": [{"key":"ranges","label":"Pages to take from each file","type":"text","default":"all","hint":"all, or per-file like: 1-3 | all | 2,5"},{"key":"keepMeta","label":"Metadata","type":"select","default":"strip","options":[{"value":"strip","label":"Strip all metadata"},{"value":"first","label":"Keep metadata from the first file"}]},{"key":"title","label":"Document title (optional)","type":"text","default":""}],
"run": async ({ docs, opts, core }) => {
      if (docs.length < 2) return { error: 'Choose at least two PDFs to merge.' };
      const specs = String(opts.ranges || 'all').split('|').map(s => s.trim());
      const items = [];
      const perFile = [];

      for (let i = 0; i < docs.length; i++) {
        const total = await docs[i].doc.pageCount();
        const spec = specs.length === 1 ? specs[0] : (specs[i] || 'all');
        let idx;
        try { idx = core.parsePageRange(spec, total); }
        catch (e) { return { error: `${docs[i].name}: ${e.message}` }; }
        idx.forEach(p => items.push({ doc: docs[i].doc, pageIndex: p }));
        perFile.push([docs[i].name, `${idx.length} of ${total} page${total === 1 ? '' : 's'}`]);
      }

      const info = {};
      if (opts.keepMeta === 'first') Object.assign(info, await docs[0].doc.getInfo());
      if (opts.title) info.Title = opts.title;

      const bytes = await core.assemble(items, { info });
      return {
        files: [{ name: 'merged.pdf', bytes }],
        stats: [
          ['Files merged', String(docs.length)],
          ['Total pages', String(items.length)],
          ...perFile,
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Files merge in the order listed. Use the arrows in the file list to reorder before merging.","Give one page range to apply to every file, or separate them with | to set each file individually — for example \"1-3 | all | 2,5\".","Metadata is stripped by default, since a merged document inheriting one source file’s author and title is usually wrong.","Bookmarks, form fields and annotations from the source files are not carried across. Page content, images and page geometry are."],
"faq": [{"q":"Are my files uploaded?","a":"No. The PDFs are parsed and rewritten by your own browser. Nothing is transmitted, which is why this works offline and why it is safe for contracts and financial documents."},{"q":"Why are my bookmarks missing?","a":"Merging rebuilds the page tree from scratch, which is what makes the output reliably valid. Carrying outlines across from several documents with conflicting structures is where most mergers produce broken files, so this deliberately drops them."}]
};
})();