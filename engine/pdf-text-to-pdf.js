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
window.PDF_TOOLS["text-to-pdf"] = {
"title": "Text to PDF Converter",
"kind": "create",
"multiple": false,
"description": "Turn plain text into a properly paginated PDF with margins, wrapping and page numbers.",
"keywords": ["text to pdf","txt to pdf","create pdf from text","convert text to pdf","make a pdf"],
"inputLabel": "Your text",
"controls": [{"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[{"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"a5","label":"A5"},{"value":"legal","label":"Legal"}]},{"key":"font","label":"Font","type":"select","default":"Helvetica","options":[{"value":"Helvetica","label":"Helvetica (sans)"},{"value":"Times-Roman","label":"Times (serif)"},{"value":"Courier","label":"Courier (monospace)"}]},{"key":"size","label":"Font size","type":"number","default":11,"min":6,"max":36},{"key":"leading","label":"Line spacing","type":"number","default":1.4,"min":1,"max":3,"step":0.1},{"key":"margin","label":"Margin (mm)","type":"number","default":20,"min":5,"max":60},{"key":"numbers","label":"Page numbers","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]},{"key":"title","label":"Document title","type":"text","default":""}],
"run": async ({ text, opts, core }) => {
      const body = String(text || '');
      if (!body.trim()) return { error: 'Enter or paste some text to convert.' };

      const [W, H] = core.PAGE_SIZES[opts.pageSize] || core.PAGE_SIZES.a4;
      const m = (Number(opts.margin) || 20) * 72 / 25.4;
      const size = Math.max(6, Math.min(36, Number(opts.size) || 11));
      const lead = size * Math.max(1, Math.min(3, Number(opts.leading) || 1.4));
      const font = core.FONTS[opts.font] ? opts.font : 'Helvetica';
      const maxW = W - m * 2;

      /* Text WinAnsi cannot hold is set in Noto Sans (embedded, only the
         characters used), and then so is the rest, so the page reads as
         one typeface; Courier keeps its WinAnsi lines in Courier. */
      const uni = !!(core.unicodeFonts && core.unicodeFonts.needs(body));
      const tf = uni ? new core.TextFonts({ force: font !== 'Courier' }) : null;
      const lines = uni ? await tf.wrap(body, size, false, maxW, font) : core.wrapText(body, font, size, maxW);
      const perPage = Math.max(1, Math.floor((H - m * 2) / lead));
      const pages = [];

      for (let i = 0; i < lines.length; i += perPage) {
        const ops = [];
        lines.slice(i, i + perPage).forEach((ln, k) => {
          if (ln) ops.push({ text: ln, x: m, y: H - m - lead * (k + 1), size, font });
        });
        if (opts.numbers === 'yes') {
          const pn = String(Math.floor(i / perPage) + 1);
          ops.push({ text: pn, x: W / 2, y: m / 2, size: 9, font: 'Helvetica', align: 'center', colour: '#666666' });
        }
        pages.push({ size: [W, H], ops });
      }

      const make = uni ? (pg, o) => core.createDocument(pg, Object.assign({ text: tf }, o)) : async (pg, o) => core.createPDF(pg, o);
      const miss = tf && tf.missing ? tf.missing() : [];
      const missWarn = miss.length ? 'These characters are not in the fonts this tool embeds and show as empty boxes: ' + miss.slice(0, 12).join(' ') + (miss.length > 12 ? ' …' : '') + '. Noto Sans covers Latin, Greek, Cyrillic and Devanagari.' : undefined;
      const bytes = await make(pages, {
        pageSize: opts.pageSize,
        info: opts.title ? { Title: opts.title } : null
      });
      return {
        warn: missWarn,
        files: [{ name: (opts.title ? slug(opts.title) : 'document') + '.pdf', bytes }],
        stats: [
          ['Characters', body.length.toLocaleString('en-GB')],
          ['Words', body.trim().split(/\s+/).filter(Boolean).length.toLocaleString('en-GB')],
          ['Lines after wrapping', String(lines.length)],
          ['Pages', String(pages.length)],
          ['Lines per page', String(perPage)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Text is wrapped using the real font metrics, so lines break where they actually would rather than at a guessed character count.","Text the standard fonts can hold stays in Helvetica, Times or Courier, with nothing embedded, so the file stays tiny.","Any other script (Hindi, Greek, Cyrillic, Polish, the rupee sign) is set in Noto Sans, and then the whole document is, so it reads as one typeface; only the characters used are embedded. Courier keeps its plain lines in Courier.","Blank lines in your text are preserved as blank lines in the output."],
"faq": [{"q":"Which languages can I convert?","a":"Anything in the Latin, Greek, Cyrillic and Devanagari scripts, so English, French, Polish, Russian and Hindi among many others. Hindi is shaped properly, conjuncts included. Chinese, Japanese, Korean and Arabic are not covered: the fonts this tool embeds have no characters for them, and the page lists any that would come out as empty boxes."},{"q":"How big is the PDF?","a":"Plain English text makes a very small file, because the standard fonts need nothing embedded. With another script, a subset of the font is embedded, only the characters you used, which usually adds a few tens of kilobytes rather than the whole font."}]
};
})();