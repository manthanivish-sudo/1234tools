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
window.PDF_TOOLS["split-pdf"] = {
"title": "Split PDF",
"kind": "transform",
"multiple": false,
"description": "Split one PDF into several files — by page count, by ranges, or one file per page.",
"keywords": ["split pdf","separate pdf pages","divide pdf","pdf splitter","break up pdf"],
"controls": [{"key":"mode","label":"Split","type":"select","default":"each","options":[{"value":"each","label":"One file per page"},{"value":"every","label":"Every N pages"},{"value":"ranges","label":"By explicit ranges"},{"value":"half","label":"In half"}]},{"key":"n","label":"Pages per file","type":"number","default":2,"min":1,"max":500},{"key":"ranges","label":"Ranges, one output per group","type":"text","default":"1-3 | 4-6 | 7-"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      const base = docs[0].name.replace(/\.pdf$/i, '');
      const groups = [];

      if (opts.mode === 'each') {
        for (let i = 0; i < total; i++) groups.push([i]);
      } else if (opts.mode === 'every') {
        const n = Math.max(1, Math.min(500, Number(opts.n) || 1));
        for (let i = 0; i < total; i += n) {
          groups.push(Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k));
        }
      } else if (opts.mode === 'half') {
        const mid = Math.ceil(total / 2);
        groups.push(Array.from({ length: mid }, (_, i) => i));
        if (mid < total) groups.push(Array.from({ length: total - mid }, (_, i) => mid + i));
      } else {
        for (const spec of String(opts.ranges || '').split('|').map(s => s.trim()).filter(Boolean)) {
          try { groups.push(core.parsePageRange(spec, total)); }
          catch (e) { return { error: e.message }; }
        }
        if (!groups.length) return { error: 'Enter at least one range, separated by |' };
      }

      if (groups.length > 500) return { error: `That would produce ${groups.length} files. Narrow the split.` };

      const files = [];
      for (let g = 0; g < groups.length; g++) {
        const bytes = await core.assemble(groups[g].map(p => ({ doc, pageIndex: p })), {});
        const label = groups[g].length === 1
          ? `p${groups[g][0] + 1}`
          : `p${groups[g][0] + 1}-${groups[g][groups[g].length - 1] + 1}`;
        files.push({ name: `${base}-${label}.pdf`, bytes });
      }

      return {
        files,
        stats: [
          ['Source pages', String(total)],
          ['Files produced', String(files.length)],
          ['Total output', fmtBytes(files.reduce((s, f) => s + f.bytes.length, 0))]
        ]
      };
    },
"tips": ["One file per page is the right choice for scanned batches where each page is a separate document.","Explicit ranges give you full control: \"1-3 | 4-6 | 7-\" produces three files, with the last taking everything from page 7 onward.","Several output files are offered as a ZIP so you get them in one download."],
"faq": [{"q":"Do the split files keep the original quality?","a":"Yes. Page content streams and embedded images are copied byte for byte — nothing is re-encoded or recompressed."}]
};
})();