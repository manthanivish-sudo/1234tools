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
window.PDF_TOOLS["label-pdf"] = {
"title": "Label Sheet Generator",
"kind": "create",
"multiple": false,
"description": "Print address or product labels on standard sheet layouts, with data from a list.",
"keywords": ["label template pdf","address label generator","avery labels pdf","print labels","label sheet maker"],
"controls": [{"key":"layout","label":"Label layout","type":"select","default":"3x7","options":[{"value":"3x7","label":"A4 — 3 × 7 (63.5 × 38.1 mm, 21 per sheet)"},{"value":"2x8","label":"A4 — 2 × 8 (99.1 × 33.9 mm, 16 per sheet)"},{"value":"2x7","label":"A4 — 2 × 7 (99.1 × 38.1 mm, 14 per sheet)"},{"value":"1x10","label":"A4 — 1 × 10 (200 × 27 mm, 10 per sheet)"},{"value":"4x10","label":"A4 — 4 × 10 (45.7 × 25.4 mm, 40 per sheet)"}]},{"key":"items","label":"Label text — blank line between labels","type":"textarea","default":"MVR IT Services LTD\nReading\nUnited Kingdom\n\nSecond Label\nAnother Address\nSomewhere"},{"key":"repeat","label":"If fewer labels than the sheet holds","type":"select","default":"repeat","options":[{"value":"repeat","label":"Repeat to fill the sheet"},{"value":"once","label":"Leave the rest blank"}]},{"key":"size","label":"Font size","type":"number","default":9,"min":5,"max":18},{"key":"align","label":"Alignment","type":"select","default":"left","options":[{"value":"left","label":"Left"},{"value":"center","label":"Centred"}]},{"key":"guides","label":"Cutting guides","type":"select","default":"no","options":[{"value":"no","label":"No"},{"value":"yes","label":"Show outlines"}]}],
"run": async ({ opts, core }) => {
      const LAYOUTS = {
        '3x7':  { cols: 3, rows: 7,  w: 63.5, h: 38.1, left: 7.2,  top: 15.1, gapX: 2.5, gapY: 0 },
        '2x8':  { cols: 2, rows: 8,  w: 99.1, h: 33.9, left: 4.6,  top: 13.1, gapX: 2.5, gapY: 0 },
        '2x7':  { cols: 2, rows: 7,  w: 99.1, h: 38.1, left: 4.6,  top: 15.1, gapX: 2.5, gapY: 0 },
        '1x10': { cols: 1, rows: 10, w: 200,  h: 27,   left: 5,    top: 13,   gapX: 0,   gapY: 0 },
        '4x10': { cols: 4, rows: 10, w: 45.7, h: 25.4, left: 9.8,  top: 21.5, gapX: 2.5, gapY: 0 }
      };
      const L = LAYOUTS[opts.layout] || LAYOUTS['3x7'];
      const MM = 72 / 25.4;
      const [W, H] = core.PAGE_SIZES.a4;

      const blocks = String(opts.items || '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
      if (!blocks.length) return { error: 'Enter at least one label. Separate labels with a blank line.' };

      const perSheet = L.cols * L.rows;
      const wanted = opts.repeat === 'repeat'
        ? Array.from({ length: perSheet }, (_, i) => blocks[i % blocks.length])
        : blocks;
      const sheets = Math.ceil(wanted.length / perSheet);
      const size = Math.max(5, Math.min(18, Number(opts.size) || 9));
      const pages = [];

      for (let s = 0; s < sheets; s++) {
        const ops = [];
        for (let i = 0; i < perSheet; i++) {
          const item = wanted[s * perSheet + i];
          const c = i % L.cols, r = Math.floor(i / L.cols);
          const x = (L.left + c * (L.w + L.gapX)) * MM;
          const yTop = H - (L.top + r * (L.h + L.gapY)) * MM;

          if (opts.guides === 'yes') {
            ops.push({ rect: [x, yTop - L.h * MM, L.w * MM, L.h * MM], stroke: '#cccccc', lineWidth: 0.3 });
          }
          if (!item) continue;

          const padX = 4, padY = 8;
          const maxW = L.w * MM - padX * 2;
          const lines = core.wrapText(item, 'Helvetica', size, maxW);
          const lead = size * 1.25;
          const startY = yTop - padY - lead;
          lines.slice(0, Math.floor((L.h * MM - padY) / lead)).forEach((ln, k) => {
            ops.push({
              text: ln, size,
              x: opts.align === 'center' ? x + L.w * MM / 2 : x + padX,
              y: startY - k * lead,
              align: opts.align === 'center' ? 'center' : undefined
            });
          });
        }
        pages.push({ size: [W, H], ops });
      }

      const bytes = core.createPDF(pages, { info: { Title: 'Labels' } });
      return {
        files: [{ name: `labels-${opts.layout}.pdf`, bytes }],
        stats: [
          ['Layout', `${L.cols} × ${L.rows} on A4`],
          ['Label size', `${L.w} × ${L.h} mm`],
          ['Distinct labels', String(blocks.length)],
          ['Labels placed', String(Math.min(wanted.length, sheets * perSheet))],
          ['Sheets', String(sheets)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Print at exactly 100% scale. Label sheets are unforgiving — even 2% scaling shifts text off the labels by the bottom of the page.","Run one sheet on plain paper first and hold it against a real label sheet up to a window to check alignment.","These dimensions match the common A4 label formats. Manufacturers vary slightly, so verify against your own sheets before printing a batch.","Turn on cutting guides for plain paper, and off for real label stock where the outlines would print onto the labels."],
"faq": [{"q":"My labels are consistently a few millimetres off. What now?","a":"That is almost always printer margin offset rather than the template. Most print drivers have a calibration or offset setting; alternatively adjust the margin in your printer dialogue by the amount you measured."}]
};
})();