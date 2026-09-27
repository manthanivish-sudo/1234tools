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
window.PDF_TOOLS["pdf-redaction"] = {
"title": "PDF Redaction Tool",
"kind": "transform",
"multiple": false,
"description": "Securely remove sensitive information from PDFs by permanently covering content.",
"keywords": ["pdf redaction","redact pdf","remove sensitive info pdf","secure pdf cleanup","pdf sanitization"],
"controls": [{"key":"mode","label":"Redaction mode","type":"select","default":"area","options":[{"value":"area","label":"Rectangular areas"},{"value":"text","label":"Text patterns (prototype)"}]},{"key":"areas","label":"Areas to redact (x,y,width,height per line)","type":"textarea","default":"100,700,200,20"},{"key":"colour","label":"Redaction colour","type":"color","default":"#000000"},{"key":"pages","label":"Pages to redact","type":"text","default":"all"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      const areas = [];
      for (const line of String(opts.areas || '').split('\n')) {
        const parts = line.split(',').map(s => parseFloat(s.trim()));
        if (parts.length === 4 && parts.every(p => !isNaN(p))) {
          areas.push({ x: parts[0], y: parts[1], w: parts[2], h: parts[3] });
        }
      }

      if (!areas.length) return { error: 'Enter at least one redaction area (x,y,width,height)' };

      const col = rgbTriplet(opts.colour);
      const pages = await doc.getPages();
      const items = [];

      for (let i = 0; i < total; i++) {
        if (!sel.has(i)) { items.push({ doc, pageIndex: i }); continue; }

        let ops = '';
        for (const area of areas) {
          ops += `q\n${col} rg\n${nf(area.x)} ${nf(area.y)} ${nf(area.w)} ${nf(area.h)} re f\nQ\n`;
        }

        items.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: null, fontName: null, needsGS: false, opacity: 1
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-redacted.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages redacted', String(sel.size)],
          ['Redaction areas', String(areas.length)],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: 'This overlay method is for prototypes. True secure redaction requires removing the underlying content streams.'
      };
    },
"tips": ["Coordinates are in points from bottom-left. Test areas on a copy first.","This prototype overlays black boxes. True redaction removes the underlying content.","For sensitive documents, verify redaction by opening in multiple PDF viewers.","Consider using professional redaction tools for highly sensitive material."],
"faq": [{"q":"Is this redaction secure?","a":"This prototype overlays content. True secure redaction requires removing the actual content and images from the PDF structure, which needs more complex processing."}]
};
})();