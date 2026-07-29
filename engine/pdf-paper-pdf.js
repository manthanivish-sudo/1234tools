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
window.PDF_TOOLS["paper-pdf"] = {
"title": "Printable Paper Generator",
"kind": "create",
"multiple": false,
"description": "Generate graph, lined, dotted, isometric or music paper as a print-ready PDF.",
"keywords": ["graph paper pdf","printable lined paper","dot grid paper","isometric paper","music manuscript paper","squared paper"],
"controls": [{"key":"type","label":"Paper type","type":"select","default":"grid","options":[{"value":"grid","label":"Graph / squared"},{"value":"lined","label":"Lined (ruled)"},{"value":"dot","label":"Dot grid"},{"value":"iso","label":"Isometric"},{"value":"music","label":"Music manuscript"},{"value":"cornell","label":"Cornell notes"},{"value":"blank","label":"Blank with margin"}]},{"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[{"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"a5","label":"A5"},{"value":"a3","label":"A3"}]},{"key":"orientation","label":"Orientation","type":"select","default":"portrait","options":[{"value":"portrait","label":"Portrait"},{"value":"landscape","label":"Landscape"}]},{"key":"spacing","label":"Spacing (mm)","type":"number","default":5,"min":2,"max":30,"step":0.5},{"key":"colour","label":"Line colour","type":"color","default":"#9db4d0"},{"key":"weight","label":"Line weight","type":"number","default":0.4,"min":0.1,"max":2,"step":0.1},{"key":"margin","label":"Margin (mm)","type":"number","default":10,"min":0,"max":40},{"key":"pages","label":"Number of pages","type":"number","default":1,"min":1,"max":100}],
"run": async ({ opts, core }) => {
      let [W, H] = core.PAGE_SIZES[opts.pageSize] || core.PAGE_SIZES.a4;
      if (opts.orientation === 'landscape') [W, H] = [H, W];
      const MM = 72 / 25.4;
      const gap = Math.max(2, Math.min(30, Number(opts.spacing) || 5)) * MM;
      const m = Math.max(0, Number(opts.margin) || 0) * MM;
      const lw = Math.max(0.1, Math.min(2, Number(opts.weight) || 0.4));
      const col = opts.colour || '#9db4d0';
      const n = Math.max(1, Math.min(100, Number(opts.pages) || 1));

      const buildOps = () => {
        const ops = [];
        const x0 = m, x1 = W - m, y0 = m, y1 = H - m;

        if (opts.type === 'grid') {
          for (let x = x0; x <= x1 + 0.01; x += gap) ops.push({ line: [x, y0, x, y1], stroke: col, lineWidth: lw });
          for (let y = y0; y <= y1 + 0.01; y += gap) ops.push({ line: [x0, y, x1, y], stroke: col, lineWidth: lw });
        } else if (opts.type === 'lined') {
          for (let y = y0; y <= y1 + 0.01; y += gap) ops.push({ line: [x0, y, x1, y], stroke: col, lineWidth: lw });
          ops.push({ line: [x0 + 25 * MM, y0, x0 + 25 * MM, y1], stroke: '#e08a8a', lineWidth: lw });
        } else if (opts.type === 'dot') {
          for (let x = x0; x <= x1 + 0.01; x += gap) {
            for (let y = y0; y <= y1 + 0.01; y += gap) {
              ops.push({ rect: [x - lw, y - lw, lw * 2, lw * 2], fill: col });
            }
          }
        } else if (opts.type === 'iso') {
          const h = gap * Math.sqrt(3) / 2;
          for (let y = y0; y <= y1 + h; y += h) {
            ops.push({ line: [x0, y, x1, y], stroke: col, lineWidth: lw * 0.6 });
          }
          const span = (y1 - y0) / Math.tan(Math.PI / 3);
          for (let x = x0 - span; x <= x1 + span; x += gap) {
            ops.push({ line: [x, y0, x + span, y1], stroke: col, lineWidth: lw });
            ops.push({ line: [x, y0, x - span, y1], stroke: col, lineWidth: lw });
          }
        } else if (opts.type === 'music') {
          const staffGap = gap;
          const staffH = staffGap * 4;
          const between = staffH + gap * 3;
          for (let top = y1 - staffH; top > y0; top -= between) {
            for (let k = 0; k < 5; k++) {
              ops.push({ line: [x0, top + k * staffGap, x1, top + k * staffGap], stroke: col, lineWidth: lw });
            }
          }
        } else if (opts.type === 'cornell') {
          const cueX = x0 + (x1 - x0) * 0.3;
          const sumY = y0 + (y1 - y0) * 0.18;
          ops.push({ line: [cueX, sumY, cueX, y1], stroke: col, lineWidth: lw * 2 });
          ops.push({ line: [x0, sumY, x1, sumY], stroke: col, lineWidth: lw * 2 });
          for (let y = sumY + gap; y <= y1 - gap; y += gap) {
            ops.push({ line: [cueX + 4, y, x1, y], stroke: col, lineWidth: lw * 0.7 });
          }
        } else {
          ops.push({ rect: [x0, y0, x1 - x0, y1 - y0], stroke: col, lineWidth: lw });
        }
        return ops;
      };

      const ops = buildOps();
      const pages = Array.from({ length: n }, () => ({ size: [W, H], ops }));
      const bytes = core.createPDF(pages, { info: { Title: `${opts.type} paper` } });

      return {
        files: [{ name: `${opts.type}-paper-${opts.spacing}mm.pdf`, bytes }],
        stats: [
          ['Paper type', opts.type],
          ['Page size', `${opts.pageSize.toUpperCase()} ${opts.orientation}`],
          ['Spacing', opts.spacing + ' mm'],
          ['Pages', String(n)],
          ['Drawing operations per page', String(ops.length)],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: ops.length > 8000 ? 'That spacing produces a very dense grid, which will make a large file and may print slowly.' : ''
      };
    },
"tips": ["Print at 100% scale with no \"fit to page\", or the spacing will not measure what it says. 5 mm graph paper printed at 96% is no longer 5 mm.","A pale blue-grey grid photocopies and scans far better than black, and is easier to draw over.","Isometric paper uses a 60-degree triangular grid, which is the standard for technical and orthographic sketching.","Cornell layout gives a narrow cue column on the left, a wide notes area, and a summary strip at the bottom."],
"faq": [{"q":"Why does my printed grid measure slightly wrong?","a":"Almost always print scaling. Check the print dialogue for \"Actual size\" or 100%, and turn off any margin fitting. Printers also have a small non-printable border, which is what the margin setting accounts for."}]
};
})();