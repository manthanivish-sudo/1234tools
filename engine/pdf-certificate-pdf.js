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
window.PDF_TOOLS["certificate-pdf"] = {
"title": "Certificate Generator",
"kind": "create",
"multiple": false,
"description": "Create certificates of completion, achievement or attendance — one, or a batch from a name list.",
"keywords": ["certificate generator","certificate of completion","award certificate pdf","diploma maker","certificate template"],
"controls": [{"key":"heading","label":"Heading","type":"text","default":"Certificate of Completion"},{"key":"names","label":"Recipient names (one per line)","type":"textarea","default":"Priya Sharma\nJames Okafor\nAnna Kowalski"},{"key":"body","label":"Body text","type":"textarea","default":"has successfully completed the course\nAdvanced Web Development"},{"key":"date","label":"Date","type":"date","default":"TODAY"},{"key":"signatory","label":"Signatory name and title","type":"text","default":"A. Director\nManaging Director"},{"key":"org","label":"Organisation","type":"text","default":"MVR IT Services LTD"},{"key":"accent","label":"Accent colour","type":"color","default":"#f7c948"},{"key":"orientation","label":"Orientation","type":"select","default":"landscape","options":[{"value":"landscape","label":"Landscape"},{"value":"portrait","label":"Portrait"}]}],
"run": async ({ opts, core }) => {
      const names = String(opts.names || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (!names.length) return { error: 'Enter at least one recipient name.' };
      if (names.length > 500) return { error: 'That is over 500 certificates. Split the list.' };

      let [W, H] = core.PAGE_SIZES.a4;
      if (opts.orientation === 'landscape') [W, H] = [H, W];
      const accent = opts.accent || '#f7c948';
      const d = new Date(opts.date);
      const dateStr = isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const sig = String(opts.signatory || '').split('\n');

      const pages = names.map(name => {
        const ops = [];
        // border
        ops.push({ rect: [24, 24, W - 48, H - 48], stroke: accent, lineWidth: 3 });
        ops.push({ rect: [34, 34, W - 68, H - 68], stroke: accent, lineWidth: 0.8 });

        let y = H - 110;
        if (opts.org) {
          ops.push({ text: opts.org.toUpperCase(), x: W / 2, y, size: 10, align: 'center',
                     font: 'Helvetica-Bold', colour: '#888888' });
          y -= 40;
        }
        core.wrapText(opts.heading || '', 'Times-Roman', 30, W - 160).forEach((ln, k) => {
          ops.push({ text: ln, x: W / 2, y: y - k * 36, size: 30, align: 'center', font: 'Times-Roman' });
        });
        y -= 60;
        ops.push({ line: [W / 2 - 60, y, W / 2 + 60, y], stroke: accent, lineWidth: 2 });
        y -= 44;

        ops.push({ text: 'This certifies that', x: W / 2, y, size: 11, align: 'center', colour: '#666666' });
        y -= 44;
        ops.push({ text: name, x: W / 2, y, size: 26, align: 'center', font: 'Helvetica-Bold' });
        y -= 12;
        const nw = core.textWidth(name, 'Helvetica-Bold', 26);
        ops.push({ line: [W / 2 - nw / 2 - 20, y, W / 2 + nw / 2 + 20, y], stroke: '#cccccc', lineWidth: 0.6 });
        y -= 36;

        core.wrapText(opts.body || '', 'Helvetica', 13, W - 200).forEach((ln, k) => {
          ops.push({ text: ln, x: W / 2, y: y - k * 20, size: 13, align: 'center' });
        });

        const baseY = 96;
        if (dateStr) {
          ops.push({ line: [90, baseY + 16, 250, baseY + 16], stroke: '#999999', lineWidth: 0.6 });
          ops.push({ text: dateStr, x: 170, y: baseY, size: 10, align: 'center', colour: '#555555' });
          ops.push({ text: 'DATE', x: 170, y: baseY - 14, size: 7, align: 'center', colour: '#999999' });
        }
        if (sig[0]) {
          ops.push({ line: [W - 250, baseY + 16, W - 90, baseY + 16], stroke: '#999999', lineWidth: 0.6 });
          ops.push({ text: sig[0], x: W - 170, y: baseY, size: 10, align: 'center', colour: '#555555' });
          ops.push({ text: (sig[1] || 'SIGNATURE').toUpperCase(), x: W - 170, y: baseY - 14, size: 7,
                     align: 'center', colour: '#999999' });
        }
        return { size: [W, H], ops };
      });

      const bytes = core.createPDF(pages, { info: { Title: opts.heading || 'Certificate' } });
      return {
        files: [{ name: names.length === 1 ? `certificate-${slug(names[0])}.pdf` : 'certificates.pdf', bytes }],
        stats: [
          ['Certificates', String(names.length)],
          ['Orientation', opts.orientation],
          ['Date shown', dateStr || 'none'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Enter one name per line to generate a batch — each becomes its own page in a single PDF, ready to print or split.","Landscape is conventional for certificates and gives long names room to breathe.","Very long names reduce automatically only if you lower the font size; check the longest name in your list before printing a batch.","The signature line is left blank deliberately, for a real signature. A printed signature image offers no assurance to anyone."],
"faq": [{"q":"Can I add a logo?","a":"Not in this tool — it uses only vector drawing and standard fonts, which is what keeps it dependency-free. To add a logo, generate the certificate here and overlay the image in a PDF editor, or print onto pre-printed letterhead."}]
};
})();