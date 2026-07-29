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
window.PDF_TOOLS["pdf-inspector"] = {
"title": "PDF Inspector",
"kind": "inspect",
"multiple": false,
"description": "Examine a PDF: page count, sizes, rotation, fonts, images, metadata and structure.",
"keywords": ["pdf inspector","pdf info","pdf properties","analyse pdf","pdf page size checker"],
"controls": [],
"run": async ({ docs, core }) => {
      const doc = docs[0].doc;
      const pages = await doc.getPages();
      const info = await doc.getInfo();

      const sizes = new Map();
      const rotations = new Map();
      const fonts = new Set();
      let images = 0, annots = 0;

      for (const p of pages) {
        const box = (await doc.resolve(p.dict.MediaBox || p.inherited.MediaBox)) || [0, 0, 595, 842];
        const w = Math.round(Math.abs(Number(box[2]) - Number(box[0])));
        const h = Math.round(Math.abs(Number(box[3]) - Number(box[1])));
        const key = `${w} × ${h} pt  (${(w / 72 * 25.4).toFixed(0)} × ${(h / 72 * 25.4).toFixed(0)} mm)`;
        sizes.set(key, (sizes.get(key) || 0) + 1);

        const r = Number(p.dict.Rotate !== undefined ? p.dict.Rotate : p.inherited.Rotate) || 0;
        rotations.set(r, (rotations.get(r) || 0) + 1);

        const res = await doc.resolve(p.dict.Resources || p.inherited.Resources);
        if (core.isDict(res)) {
          const f = await doc.resolve(res.Font);
          if (core.isDict(f)) {
            for (const k of Object.keys(f)) {
              const fd = await doc.resolve(f[k]);
              if (core.isDict(fd) && fd.BaseFont) fonts.add(String(await doc.resolve(fd.BaseFont)).replace(/^\//, ''));
            }
          }
          const xo = await doc.resolve(res.XObject);
          if (core.isDict(xo)) {
            for (const k of Object.keys(xo)) {
              const x = await doc.resolve(xo[k]);
              if (x && x.dict && core.isName(x.dict.Subtype, 'Image')) images++;
            }
          }
        }
        const an = await doc.resolve(p.dict.Annots);
        if (Array.isArray(an)) annots += an.length;
      }

      const rows = [
        ['File', docs[0].name],
        ['File size', fmtBytes(docs[0].size)],
        ['PDF version', doc.version],
        ['Pages', String(pages.length)],
        ['Objects', String(doc.objects.size)],
        ['Page sizes', [...sizes].map(([k, n]) => `${k} × ${n}`).join('; ')],
        ['Rotations', [...rotations].map(([r, n]) => `${r}° × ${n}`).join('; ')],
        ['Distinct fonts', fonts.size ? `${fonts.size} — ${[...fonts].slice(0, 8).join(', ')}${fonts.size > 8 ? ' …' : ''}` : 'none found'],
        ['Embedded images', String(images)],
        ['Annotations', String(annots)]
      ];
      Object.entries(info).forEach(([k, v]) => { if (v) rows.push(['Metadata: ' + k, String(v).slice(0, 100)]); });
      if (!Object.keys(info).length) rows.push(['Metadata', 'none']);
      if (doc.warnings.length) rows.push(['Parser notes', doc.warnings.join('; ')]);

      const report = rows.map(([k, v]) => `${k.padEnd(22)} ${v}`).join('\n');
      return { files: [], report, stats: rows };
    },
"tips": ["Page sizes are given in points and millimetres. A4 is 595 × 842 pt; US Letter is 612 × 792.","Mixed page sizes in one document are a common cause of printing problems — this shows them grouped so a stray page stands out.","Fonts listed with a prefix like ABCDEF+Arial are subsetted, meaning only the glyphs actually used are embedded.","The metadata section is worth checking before sending a document externally. Author names and software versions are disclosed more often than people expect."],
"faq": [{"q":"Why does the object count differ from other tools?","a":"Counting depends on whether objects inside compressed object streams are expanded and whether unreferenced objects are included. This expands object streams and counts everything it can reach."}]
};
})();