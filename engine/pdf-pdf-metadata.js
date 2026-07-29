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
window.PDF_TOOLS["pdf-metadata"] = {
"title": "PDF Metadata Editor & Remover",
"kind": "transform",
"multiple": false,
"description": "View, change or completely strip the hidden metadata in a PDF — author, title, software.",
"keywords": ["pdf metadata","remove pdf metadata","edit pdf properties","pdf author remove","anonymise pdf"],
"controls": [{"key":"action","label":"Action","type":"select","default":"strip","options":[{"value":"strip","label":"Remove all metadata"},{"value":"edit","label":"Set the fields below"}]},{"key":"Title","label":"Title","type":"text","default":""},{"key":"Author","label":"Author","type":"text","default":""},{"key":"Subject","label":"Subject","type":"text","default":""},{"key":"Keywords","label":"Keywords","type":"text","default":""}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const before = await doc.getInfo();
      const total = await doc.pageCount();

      const info = opts.action === 'edit'
        ? { Title: opts.Title, Author: opts.Author, Subject: opts.Subject, Keywords: opts.Keywords }
        : {};

      const items = Array.from({ length: total }, (_, i) => ({ doc, pageIndex: i }));
      const bytes = await core.assemble(items, { info });
      const base = docs[0].name.replace(/\.pdf$/i, '');

      const found = Object.entries(before).filter(([, v]) => v);
      return {
        files: [{ name: `${base}-${opts.action === 'strip' ? 'clean' : 'updated'}.pdf`, bytes }],
        stats: [
          ['Metadata found', found.length ? String(found.length) + ' field' + (found.length === 1 ? '' : 's') : 'none'],
          ...found.map(([k, v]) => [k, String(v).slice(0, 80)]),
          ['Action', opts.action === 'strip' ? 'All fields removed' : 'Fields replaced'],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: found.length && opts.action === 'strip'
          ? `Removed: ${found.map(([k]) => k).join(', ')}. The original file on your device still contains them.` : ''
      };
    },
"tips": ["PDFs routinely carry the author’s name, their organisation, the software used and creation timestamps. It is a common and unintended disclosure when sending documents externally.","This rewrites the document without the metadata dictionary rather than blanking fields, so nothing survives in the file.","Some PDFs also carry an XMP metadata stream. Rebuilding the document drops that too.","Text inside the page content is not metadata and is left alone. Redacting visible text needs a different approach."],
"faq": [{"q":"Is stripping metadata the same as redacting?","a":"No, and the difference matters. This removes document properties. It does not remove text or images from the page, and it does not remove content hidden under a black box. For genuine redaction, the content itself must be deleted before the file is produced."}]
};
})();