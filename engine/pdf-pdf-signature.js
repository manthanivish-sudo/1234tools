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

/* A number from a control, or the default when the box is empty or not a
   number. 0 is a number: "X 0" is the left edge, not "use the default". */
function numOr(v, d) {
  if (v === '' || v === null || v === undefined) return d;
  const x = Number(v);
  return isFinite(x) ? x : d;
}

/**
 * Where a drawn signature goes, shared by the run and the page preview so
 * the two cannot disagree. The pad hands over { w, h, strokes: [[[x, y], …], …] }
 * in its own pixels, y down; the ink is cropped to its bounds and scaled to
 * the chosen width (no taller than a third of it), with its bottom-left at
 * X, Y — lifted 12 points when there is typed text, so the drawing sits on
 * the line above it.
 */
function inkPlacement(d, opts) {
  if (!d || !Array.isArray(d.strokes) || !d.strokes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  d.strokes.forEach(s => s.forEach(p => {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }));
  if (!isFinite(minX)) return null;
  const inkW = Math.max(1, maxX - minX), inkH = Math.max(1, maxY - minY);
  const width = Math.max(40, Math.min(400, numOr(opts.drawWidth, 150)));
  const s = Math.min(width / inkW, (width / 3) / inkH);
  const x = Math.max(0, numOr(opts.x, 400)), y = Math.max(0, numOr(opts.y, 100));
  const lift = String(opts.signatureText == null ? '' : opts.signatureText).trim() ? 12 : 0;
  return { s, minX, maxY, x0: x, y0: y + lift, w: inkW * s, h: inkH * s };
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["pdf-signature"] = {
"title": "Add a Signature to a PDF",
"kind": "transform",
"action": "Add signature",
"multiple": false,
"description": "Draw or type a signature onto a PDF and place it where you want. A visible signature, not a cryptographic one — the difference is explained below.",
"keywords": ["sign pdf","add signature to pdf","pdf signature image","signature on pdf","place signature pdf","pdf sign online free"],
"controls": [{"key":"drawn","label":"Draw your signature (optional)","type":"draw","hint":"Mouse, pen or finger. It sits just above the typed line."},{"key":"drawWidth","label":"Drawn signature width","type":"number","default":150,"min":40,"max":400,"hint":"Points; the height follows the drawing"},{"key":"signatureText","label":"Signature text","type":"text","default":"Signed by: ","hint":"Your name, or whatever should appear on the line"},{"key":"size","label":"Text size","type":"number","default":11,"min":6,"max":48,"hint":"Points, for the typed line and the date"},{"key":"date","label":"Include date","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]},{"key":"x","label":"X","type":"number","default":400,"min":0,"hint":"Points from the left edge"},{"key":"y","label":"Y","type":"number","default":100,"min":0,"hint":"Points up from the bottom edge"},{"key":"pages","label":"Pages","type":"text","default":"last","hint":"last, 1, 2-5, or all"}],
"placePreview": { "x": "x", "y": "y", "page": "pages", "text": "signatureText", "size": "size", "colour": "#000000", "drawing": "drawn", "drawingWidth": "drawWidth", "date": "date", "items": "items", "lastWord": true, "title": "Click the page to place the signature, or drag it; drag its corner to resize it", "bankLabel": "Add as another signature", "bankHint": "Keep this signature where it is and place another — initials on every page and a full signature on the last, for example.", "emptyMessage": "Type or draw a signature first, then add it as another one." },
"inkPlacement": inkPlacement,
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      const col = rgbTriplet('#000000');
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      /* Every banked signature, then whatever is in the controls now. */
      const list = (opts.items || []).map((it) => ({
        text: it.text, drawn: it.drawn || null, drawWidth: it.drawWidth, date: it.date,
        size: it.size, x: it.x, y: it.y, pages: it.pages
      }));
      const cur = { text: opts.signatureText, drawn: opts.drawn, drawWidth: opts.drawWidth, date: opts.date, size: opts.size, x: opts.x, y: opts.y, pages: opts.pages };
      const curText = String(cur.text == null ? '' : cur.text);
      if (curText.trim() || inkPlacement(cur.drawn, cur) || !list.length) list.push(cur);

      const placed = [];
      for (const it of list) {
        const text = String(it.text == null ? '' : it.text);
        const ink = inkPlacement(it.drawn, { x: it.x, y: it.y, drawWidth: it.drawWidth, signatureText: text });
        if (!text.trim() && !ink) {
          if (list.length === 1) return { error: 'Type a signature or draw one first.' };
          continue;
        }
        const v = String(it.pages == null ? 'last' : it.pages).trim();
        let sel;
        if (/^last$/i.test(v)) sel = new Set([total - 1]);
        else {
          try { sel = new Set(core.parsePageRange(v, total)); }
          catch (e) { return { error: (list.length > 1 ? '"' + (text.trim() || 'Drawn signature').slice(0, 30) + '": ' : '') + e.message }; }
        }
        const x = Math.max(0, numOr(it.x, 400));
        const y = Math.max(0, numOr(it.y, 100));
        const size = Math.max(6, Math.min(48, numOr(it.size, 11)));

        /* The drawing as vector strokes: as sharp as the text beside it at
           any zoom, and a few hundred bytes rather than an embedded picture. */
        let ops = '';
        if (ink) {
          const X = (q) => nf(ink.x0 + (q[0] - ink.minX) * ink.s);
          const Y = (q) => nf(ink.y0 + (ink.maxY - q[1]) * ink.s);
          ops += `q\n${col} RG\n1.4 w\n1 J\n1 j\n`;
          for (const st of it.drawn.strokes) {
            if (!st.length) continue;
            ops += `${X(st[0])} ${Y(st[0])} m\n`;
            (st.length === 1 ? [st[0]] : st.slice(1)).forEach((q) => { ops += `${X(q)} ${Y(q)} l\n`; });
            ops += 'S\n';
          }
          ops += 'Q\n';
        }
        ops += `q\n${col} rg\nBT\n/MVRsig ${nf(size)} Tf\n`;
        if (text.trim()) ops += `1 0 0 1 ${nf(x)} ${nf(y)} Tm\n(${core.contentEscape(text)}) Tj\n`;
        if (it.date === 'yes') {
          ops += `\n1 0 0 1 ${nf(x)} ${nf(y - size * 14 / 11)} Tm\n(${core.contentEscape('Date: ' + dateStr)}) Tj`;
        }
        ops += '\nET\nQ\n';
        placed.push({ sel, ops, ink, text });
      }

      const items = [];
      let signedPages = 0;
      for (let i = 0; i < total; i++) {
        const here = placed.filter((pl) => pl.sel.has(i));
        if (!here.length) { items.push({ doc, pageIndex: i }); continue; }
        signedPages++;
        /* X and Y are measured on the page as it is shown — cropped and
           turned by its /Rotate — which is also what the preview shows. */
        items.push({ doc, pageIndex: i, overlay: {
          content: here.map((pl) => pl.ops).join(''), fontKey: 'MVRsig', fontName: 'Helvetica', needsGS: false, opacity: 1, upright: true
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      const one = placed.length === 1 ? placed[0] : null;
      return {
        files: [{ name: `${base}-signed.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages signed', String(signedPages)],
          ...(one ? [['Signature', one.ink ? (one.text.trim() ? 'Drawn, with typed text' : 'Drawn') : 'Typed']] : [['Signatures placed', String(placed.length)]]),
          ...(one && one.text.trim() ? [['Signature text', one.text]] : []),
          ...(one && one.ink ? [['Drawn size', Math.round(one.ink.w) + ' × ' + Math.round(one.ink.h) + ' points']] : []),
          ['Date included', list.some((it) => it.date === 'yes') ? 'yes' : 'no'],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: 'This adds visual signature elements. For legally binding digital signatures, you need certificate-based cryptographic signing.'
      };
    },
"tips": ["Draw in the box with a mouse, a pen or a finger, or leave it empty and type. A drawing is placed just above the typed line, at the width you choose, as vector strokes rather than a picture, so it stays sharp when zoomed and adds only a few hundred bytes.","Click the page preview to place the signature. The dashed box is where the line will sit on the finished file, and a drawing is shown above it where it will land.","The arrows beside the page number page through the document. That changes only what you are looking at; the Pages box decides which pages are signed.","Leave the pages box on \"last\" to sign only the final page, which is where most contracts want it.","The date, if you include it, is drawn on a second line just under the signature.","X and Y are PDF points from the bottom-left corner of the page as it is shown, 72 to the inch — a rotated or cropped page is measured the way you see it. A4 is 595 × 842, US Letter 612 × 792. 0 is a real position: the very edge.","This is a visible signature and can be removed by anyone with an editor. A cryptographic signature cannot — see the question below."],
"faq": [{"q":"Is this a legally binding digital signature?","a":"No, and the distinction matters. This adds visual elements only: your typed or drawn signature is drawn onto the page, the same as signing a printout and scanning it. A digital signature in the legal sense is a cryptographic operation that binds a certificate to the document so any later change is detectable, and it needs a certificate from a certifying authority or trust service provider. This tool writes no signature field, certificate or /ByteRange, so a signature validator finds nothing to check. If a contract, a court or a regulator asks for a digital signature, this is not it — use a certificate-based signing service. For a form, an invoice or an internal approval that only has to look signed, a visible signature is what is wanted."}]
};
})();
