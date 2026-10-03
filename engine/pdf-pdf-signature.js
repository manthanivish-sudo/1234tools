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
window.PDF_TOOLS["pdf-signature"] = {
"title": "Add a Signature to a PDF",
"kind": "transform",
"action": "Add signature",
"multiple": false,
"description": "Draw or type a signature onto a PDF and place it where you want. A visible signature, not a cryptographic one \u2014 the difference is explained below.",
"keywords": ["sign pdf","add signature to pdf","pdf signature image","signature on pdf","place signature pdf","pdf sign online free"],
"controls": [{"key":"signatureText","label":"Signature text","type":"text","default":"Signed by: ","hint":"Your name, or whatever should appear on the line"},{"key":"date","label":"Include date","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]},{"key":"x","label":"X","type":"number","default":400,"min":0,"hint":"Points from the left edge"},{"key":"y","label":"Y","type":"number","default":100,"min":0,"hint":"Points up from the bottom edge"},{"key":"pages","label":"Pages","type":"text","default":"last","hint":"last, 1, 2-5, or all"}],
"placePreview": { "x": "x", "y": "y", "page": "pages", "text": "signatureText", "size": 11, "colour": "#000000" },
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      
      let sel;
      if (opts.pages === 'last') {
        sel = new Set([total - 1]);
      } else {
        try { sel = new Set(core.parsePageRange(opts.pages, total)); }
        catch (e) { return { error: e.message }; }
      }

      const sigText = String(opts.signatureText || 'Signed by: ');
      const x = Math.max(0, Number(opts.x) || 400);
      const y = Math.max(0, Number(opts.y) || 100);
      const col = rgbTriplet('#000000');
      const pages = await doc.getPages();

      const items = [];
      for (let i = 0; i < total; i++) {
        if (!sel.has(i)) { items.push({ doc, pageIndex: i }); continue; }

        let ops = `q\n${col} rg\nBT\n/MVRsig 11 Tf\n1 0 0 1 ${nf(x)} ${nf(y)} Tm\n(${core.contentEscape(sigText)}) Tj\n`;
        
        if (opts.date === 'yes') {
          const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          ops += `\n1 0 0 1 ${nf(x)} ${nf(y - 14)} Tm\n(${core.contentEscape('Date: ' + dateStr)}) Tj`;
        }
        
        ops += '\nET\nQ\n';

        items.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: 'MVRsig', fontName: 'Helvetica', needsGS: false, opacity: 1
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-signed.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages signed', String(sel.size)],
          ['Signature text', sigText],
          ['Date included', opts.date],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: 'This adds visual signature elements. For legally binding digital signatures, you need certificate-based cryptographic signing.'
      };
    },
"tips": ["Click the page preview to place the signature. The dashed box is where the line will sit on the finished file.","The arrows beside the page number page through the document. That changes only what you are looking at; the Pages box decides which pages are signed.","Leave the pages box on \"last\" to sign only the final page, which is where most contracts want it.","The date, if you include it, is drawn on a second line just under the signature.","X and Y are PDF points from the bottom-left corner, 72 to the inch. A4 is 595 \u00d7 842, US Letter 612 \u00d7 792.","This is a visible signature and can be removed by anyone with an editor. A cryptographic signature cannot \u2014 see the question below."],
"faq": [{"q":"Is this a legally binding digital signature?","a":"No, and the distinction matters. This draws a signature onto the page, the same as signing a printout and scanning it. A digital signature in the legal sense is a cryptographic operation that binds a certificate to the document so any later change is detectable, and it needs a certificate from a trust service provider. If a contract, a court or a regulator asks for a digital signature, this is not it \u2014 use a qualified provider. For a form, an invoice or an internal approval that just needs to look signed, this is exactly right."},{"q":"Is this legally binding?","a":"No. This adds visual elements only. Legally binding digital signatures require PKI certificates and cryptographic signing, which needs additional libraries."}]
};
})();