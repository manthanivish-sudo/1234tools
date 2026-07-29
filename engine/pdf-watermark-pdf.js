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
window.PDF_TOOLS["watermark-pdf"] = {
"title": "Add Watermark to PDF",
"kind": "transform",
"multiple": false,
"description": "Stamp text across every page — DRAFT, CONFIDENTIAL, a name or a date — at any angle and opacity.",
"keywords": ["watermark pdf","add text to pdf","stamp pdf","draft watermark","confidential pdf"],
"controls": [{"key":"text","label":"Watermark text","type":"text","default":"DRAFT"},{"key":"size","label":"Font size","type":"number","default":60,"min":6,"max":300},{"key":"angle","label":"Angle","type":"select","default":"45","options":[{"value":"0","label":"Horizontal"},{"value":"45","label":"45° diagonal"},{"value":"90","label":"Vertical"},{"value":"315","label":"−45° diagonal"}]},{"key":"colour","label":"Colour","type":"color","default":"#ff0000"},{"key":"opacity","label":"Opacity %","type":"number","default":20,"min":5,"max":100},{"key":"position","label":"Position","type":"select","default":"center","options":[{"value":"center","label":"Centre"},{"value":"tile","label":"Tiled across the page"},{"value":"bottom","label":"Bottom of the page"}]},{"key":"pages","label":"Pages","type":"text","default":"all"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }
      const text = String(opts.text || '').trim();
      if (!text) return { error: 'Enter some watermark text.' };

      const size = Math.max(6, Math.min(300, Number(opts.size) || 60));
      const opacity = Math.max(0.05, Math.min(1, (Number(opts.opacity) || 20) / 100));
      const angle = Number(opts.angle) || 0;
      const rad = angle * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const col = rgbTriplet(opts.colour);
      const esc = core.contentEscape(text);
      const pages = await doc.getPages();

      const items = [];
      for (let i = 0; i < total; i++) {
        if (!sel.has(i)) { items.push({ doc, pageIndex: i }); continue; }
        const box = (await doc.resolve(pages[i].dict.MediaBox || pages[i].inherited.MediaBox)) || [0, 0, 595.28, 841.89];
        const W = Math.abs(Number(box[2]) - Number(box[0]));
        const H = Math.abs(Number(box[3]) - Number(box[1]));
        const tw = core.textWidth(text, 'Helvetica-Bold', size);

        let ops = '';
        const place = (x, y) => {
          ops += `q\n/MVRgs gs\n${col} rg\nBT\n/MVRwm ${size} Tf\n` +
                 `${nf(cos)} ${nf(sin)} ${nf(-sin)} ${nf(cos)} ${nf(x)} ${nf(y)} Tm\n(${esc}) Tj\nET\nQ\n`;
        };

        if (opts.position === 'tile') {
          const stepX = Math.max(tw * 1.4, 120), stepY = Math.max(size * 4, 120);
          for (let y = -H; y < H * 2; y += stepY) {
            for (let x = -W; x < W * 2; x += stepX) place(x, y);
          }
        } else if (opts.position === 'bottom') {
          place(W / 2 - tw / 2, size * 0.8);
        } else {
          place(W / 2 - (tw / 2) * cos + (size / 3) * sin, H / 2 - (tw / 2) * sin - (size / 3) * cos);
        }

        items.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: 'MVRwm', fontName: 'Helvetica-Bold', needsGS: true, opacity
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-watermarked.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages watermarked', String(sel.size)],
          ['Text', text],
          ['Layout', opts.position],
          ['Opacity', Math.round(opacity * 100) + '%'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["A watermark added this way sits on top of the page content and can be removed by anyone with a PDF editor. It signals status; it does not protect anything.","Tiled watermarks are much harder to crop out than a single central one, which matters for documents that might be screenshotted.","Keep opacity around 15–25%. Higher and it fights the text; lower and it vanishes when printed.","The text is drawn with a standard font, so no font file is embedded and the file barely grows."],
"faq": [{"q":"Can the watermark be removed?","a":"Yes, by anyone reasonably determined — it is a content layer, not a security feature. If a document genuinely must not be redistributed, watermarking is a deterrent and an audit aid, not a control."}]
};
})();