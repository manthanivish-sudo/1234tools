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
window.PDF_TOOLS["invoice-pdf"] = {
"title": "Invoice Generator (PDF)",
"kind": "create",
"multiple": false,
"description": "Create a clean, professional invoice PDF with line items, tax and totals calculated for you.",
"keywords": ["invoice generator","create invoice pdf","free invoice template","make an invoice","invoice maker"],
"controls": [{"key":"from","label":"Your business (name, address)","type":"textarea","default":"MVR IT Services LTD\nReading, United Kingdom\nCompany No. 10251131"},{"key":"to","label":"Bill to","type":"textarea","default":"Client Name Ltd\n1 Example Street\nLondon, EC1A 1AA"},{"key":"number","label":"Invoice number","type":"text","default":"INV-0001"},{"key":"date","label":"Invoice date","type":"date","default":"TODAY"},{"key":"due","label":"Payment terms","type":"select","default":"30","options":[{"value":"0","label":"Due on receipt"},{"value":"7","label":"Net 7"},{"value":"14","label":"Net 14"},{"value":"30","label":"Net 30"},{"value":"60","label":"Net 60"}]},{"key":"items","label":"Line items — description, qty, unit price (one per line)","type":"textarea","default":"Website design and build, 1, 4500\nHosting and support (12 months), 12, 45\nDomain registration, 1, 15"},{"key":"currency","label":"Currency","type":"select","default":"GBP","options":[{"value":"GBP","label":"GBP £"},{"value":"USD","label":"USD $"},{"value":"EUR","label":"EUR €"},{"value":"INR","label":"INR Rs"}]},{"key":"tax","label":"Tax rate %","type":"number","default":20,"min":0,"max":100,"step":0.5},{"key":"taxLabel","label":"Tax label","type":"text","default":"VAT"},{"key":"notes","label":"Notes / payment details","type":"textarea","default":"Payment by bank transfer.\nThank you for your business."},{"key":"accent","label":"Accent colour","type":"color","default":"#f7c948"}],
"run": async ({ opts, core }) => {
      const SYM = { GBP: '\u00a3', USD: '$', EUR: '\u20ac', INR: 'Rs ' };
      const sym = SYM[opts.currency] || '';
      const rows = [];
      for (const line of String(opts.items || '').split('\n')) {
        if (!line.trim()) continue;
        const parts = line.split(',').map(s => s.trim());
        const price = parseFloat(parts[parts.length - 1]);
        const qty = parseFloat(parts[parts.length - 2]);
        if (!isFinite(price) || !isFinite(qty) || parts.length < 3) {
          return { error: `Could not read "${line.slice(0, 40)}". Use: description, quantity, unit price` };
        }
        rows.push({ desc: parts.slice(0, -2).join(', '), qty, price, total: qty * price });
      }
      if (!rows.length) return { error: 'Add at least one line item.' };

      const money = (v) => sym + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const sub = rows.reduce((s, r) => s + r.total, 0);
      const taxRate = Math.max(0, Number(opts.tax) || 0);
      const taxAmt = sub * taxRate / 100;
      const grand = sub + taxAmt;

      const [W, H] = core.PAGE_SIZES.a4;
      const m = 48;
      const ops = [];

      ops.push({ rect: [0, H - 8, W, 8], fill: opts.accent });
      ops.push({ text: 'INVOICE', x: m, y: H - 70, size: 30, font: 'Helvetica-Bold' });
      ops.push({ text: opts.number || '', x: W - m, y: H - 70, size: 13, font: 'Helvetica-Bold', align: 'right' });

      const d0 = new Date(opts.date);
      const due = new Date(d0); due.setDate(due.getDate() + (Number(opts.due) || 0));
      const fmtD = (d) => isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      ops.push({ text: 'Date: ' + fmtD(d0), x: W - m, y: H - 90, size: 10, align: 'right', colour: '#555555' });
      ops.push({ text: 'Due: ' + fmtD(due), x: W - m, y: H - 105, size: 10, align: 'right', colour: '#555555' });

      let y = H - 140;
      ops.push({ text: 'FROM', x: m, y, size: 8, font: 'Helvetica-Bold', colour: '#888888' });
      ops.push({ text: 'BILL TO', x: W / 2, y, size: 8, font: 'Helvetica-Bold', colour: '#888888' });
      y -= 16;
      const fromLines = String(opts.from || '').split('\n');
      const toLines = String(opts.to || '').split('\n');
      const blockLines = Math.max(fromLines.length, toLines.length);
      for (let i = 0; i < blockLines; i++) {
        if (fromLines[i]) ops.push({ text: fromLines[i], x: m, y: y - i * 14, size: 10 });
        if (toLines[i]) ops.push({ text: toLines[i], x: W / 2, y: y - i * 14, size: 10 });
      }
      y -= blockLines * 14 + 26;

      ops.push({ rect: [m, y - 4, W - m * 2, 22], fill: '#f2f2f2' });
      ops.push({ text: 'DESCRIPTION', x: m + 8, y: y + 3, size: 8, font: 'Helvetica-Bold', colour: '#555555' });
      ops.push({ text: 'QTY', x: W - m - 190, y: y + 3, size: 8, font: 'Helvetica-Bold', colour: '#555555', align: 'right' });
      ops.push({ text: 'UNIT', x: W - m - 100, y: y + 3, size: 8, font: 'Helvetica-Bold', colour: '#555555', align: 'right' });
      ops.push({ text: 'AMOUNT', x: W - m - 8, y: y + 3, size: 8, font: 'Helvetica-Bold', colour: '#555555', align: 'right' });
      y -= 26;

      for (const r of rows) {
        const wrapped = core.wrapText(r.desc, 'Helvetica', 10, W - m * 2 - 210);
        wrapped.forEach((ln, k) => ops.push({ text: ln, x: m + 8, y: y - k * 13, size: 10 }));
        ops.push({ text: String(r.qty), x: W - m - 190, y, size: 10, align: 'right' });
        ops.push({ text: money(r.price), x: W - m - 100, y, size: 10, align: 'right' });
        ops.push({ text: money(r.total), x: W - m - 8, y, size: 10, align: 'right', font: 'Helvetica-Bold' });
        y -= Math.max(1, wrapped.length) * 13 + 8;
        ops.push({ line: [m, y + 6, W - m, y + 6], stroke: '#e8e8e8', lineWidth: 0.5 });
        y -= 6;
      }

      y -= 12;
      const totalRow = (label, val, bold, big) => {
        ops.push({ text: label, x: W - m - 110, y, size: big ? 12 : 10, align: 'right',
                   font: bold ? 'Helvetica-Bold' : 'Helvetica' });
        ops.push({ text: val, x: W - m - 8, y, size: big ? 12 : 10, align: 'right',
                   font: bold ? 'Helvetica-Bold' : 'Helvetica' });
        y -= big ? 22 : 16;
      };
      totalRow('Subtotal', money(sub));
      if (taxRate) totalRow(`${opts.taxLabel || 'Tax'} ${taxRate}%`, money(taxAmt));
      ops.push({ rect: [W - m - 220, y - 4, 220, 26], fill: opts.accent });
      totalRow('TOTAL DUE', money(grand), true, true);

      if (opts.notes) {
        y -= 20;
        ops.push({ text: 'NOTES', x: m, y, size: 8, font: 'Helvetica-Bold', colour: '#888888' });
        y -= 14;
        core.wrapText(opts.notes, 'Helvetica', 9, W - m * 2).forEach((ln, k) => {
          ops.push({ text: ln, x: m, y: y - k * 12, size: 9, colour: '#555555' });
        });
      }

      const bytes = core.createPDF([{ size: [W, H], ops }], {
        info: { Title: `Invoice ${opts.number || ''}`.trim(), Author: fromLines[0] || '' }
      });
      return {
        files: [{ name: `${slug(opts.number || 'invoice')}.pdf`, bytes }],
        stats: [
          ['Line items', String(rows.length)],
          ['Subtotal', money(sub)],
          [`${opts.taxLabel || 'Tax'} ${taxRate}%`, money(taxAmt)],
          ['Total due', money(grand)],
          ['Due date', fmtD(due)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Line items take the form \"description, quantity, unit price\". The description may contain commas — only the last two values are read as numbers.","A UK VAT invoice must show your VAT number, the tax point date and the rate applied. Add your VAT number to the business details block.","Invoice numbers should be sequential with no gaps. Tax authorities in most jurisdictions expect to see an unbroken series.","Everything is generated on your device, so client names and amounts never leave it."],
"faq": [{"q":"Is this a legally compliant invoice?","a":"It produces the layout. Whether it is compliant depends on your jurisdiction and what you include — VAT registration number, tax point, reverse charge wording where relevant. Check the requirements for your country, or ask your accountant, before issuing."}]
};
})();