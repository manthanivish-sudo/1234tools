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
window.PDF_TOOLS["rotate-pdf"] = {
"title": "Rotate PDF Pages",
"kind": "transform",
"multiple": false,
"description": "Rotate every page or selected pages by 90, 180 or 270 degrees, permanently.",
"keywords": ["rotate pdf","turn pdf pages","pdf orientation","fix sideways pdf","rotate pdf permanently"],
"controls": [{"key":"angle","label":"Rotate by","type":"select","default":"90","options":[{"value":"90","label":"90° clockwise"},{"value":"180","label":"180°"},{"value":"270","label":"90° anticlockwise"}]},{"key":"pages","label":"Pages","type":"text","default":"all","hint":"all, or 1-3, 7"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      const angle = Number(opts.angle) || 90;
      const items = Array.from({ length: total }, (_, i) => ({
        doc, pageIndex: i, rotate: sel.has(i) ? angle : 0
      }));
      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-rotated.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages rotated', String(sel.size)],
          ['Rotation applied', angle + '°'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Rotation is written into the page itself, so every viewer shows it the same way. Rotating in a reader without saving only changes your own view.","Rotation is additive: a page already at 90° rotated by another 90° ends at 180°.","A scanned page that looks sideways but reports no rotation was scanned that way — rotating fixes it properly here."],
"faq": [{"q":"Does rotating reduce quality?","a":"No. The page content is untouched; only a rotation flag changes. There is no re-rendering and no loss."}]
};
})();