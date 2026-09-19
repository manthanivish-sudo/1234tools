/**
 * The AI tools for scanned documents: a photo or a scan goes to the model as
 * a picture and the fields come back typed. Same shape as ai-tools.js and
 * loaded after it; the renderer's 'image' input resizes photos and renders
 * PDF pages on the device, and the resized picture itself is what is sent.
 * That is the honest difference from the text tools, and every page here
 * says so.
 *
 * Every prompt says "return only JSON" and names the shape, as the text
 * tools do; the renderer pulls the first JSON value out of the reply.
 */
(function () {
  'use strict';
  window.AI_TOOLS = window.AI_TOOLS || {};
  const SCRIPTS = ['/engine/zip.js', '/engine/sheet.js', '/engine/pdf-text.js', '/engine/pii.js', '/engine/render-ai.js', '/engine/ai-tools.js', '/engine/ai-tools-vision.js'];
  const JSON_ONLY = 'Return only JSON, with no explanation before or after it and no markdown fences. Inside JSON strings write line breaks as \\n, never as a raw newline. Use null for anything not present; never invent a value.';
  const READ_PICTURE = 'The document arrives as a picture — a photo or a scan — not as text. Read it directly from the pixels, including stamps, handwriting and faint print. Where a value cannot be read with confidence return null and name the field in unreadable_fields rather than guessing.';
  const CURRENCY = { key: 'currency', label: 'Currency if not printed', type: 'select', default: 'INR', options: [{ value: 'INR', label: 'INR ₹' }, { value: 'GBP', label: 'GBP £' }, { value: 'USD', label: 'USD $' }, { value: 'EUR', label: 'EUR €' }, { value: 'AED', label: 'AED' }] };
  const withNotes = (i) => (i && i.notes && i.notes.trim() ? '\n\nNOTES FROM THE USER:\n' + i.notes.trim() : '');
  const cell = (v) => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
  const csvDownload = (name) => (data, ctx) => {
    const list = Array.isArray(data) ? data : (data.rows || data.items || [data]);
    const rows = ctx.sheet.objectsToRows(list);
    return [
      { name: name + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
      { name: name + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, name) }
    ];
  };
  /* one field per row, nested objects flattened as parent.child, lists joined */
  const fieldsDownload = (name, sheetName) => (data, ctx) => {
    const rows = [['field', 'value']];
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.entries(v).forEach(([k2, v2]) => rows.push([k + '.' + k2, cell(v2)]));
      else rows.push([k, Array.isArray(v) ? v.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' | ') : cell(v)]);
    });
    return [
      { name: name + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
      { name: name + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, sheetName || name) }
    ];
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['scanned-invoice-extractor'] = {
    title: 'Scanned Invoice & Receipt Reader',
    short: 'Scanned Invoice Reader',
    description: 'Photograph or scan an invoice or receipt and get the vendor, numbers, dates, taxes and every line item back as a table you can download — the picture is read directly, so a scan with no text layer works.',
    keywords: ['scanned invoice to excel', 'invoice ocr', 'photo of invoice to spreadsheet', 'receipt scanner ai', 'read scanned invoice', 'gst invoice ocr', 'invoice image data extraction'],
    glyph: 'i-ai-scan',
    glyphSvg: '<symbol id="i-ai-scan" viewBox="0 0 24 24">\n  <path d="M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16"/>\n  <path d="M8 8h8M8 15.5h8M8 18h4.5" class="thin"/>\n  <path d="M3.5 11.75h17"/>\n</symbol>',
    scripts: SCRIPTS, action: 'Read', resultTitle: 'Invoice read',
    privacy: 'The picture of the invoice is sent to the model, resized on your device first; anything printed on it goes with it.',
    inputs: [{ key: 'notes', label: 'Invoice or receipt — photo, scan or PDF', type: 'image', rows: 3, placeholder: 'Optional notes for the model: the vendor’s name if the print is faint, the currency, which pictures are pages of the same invoice…' }],
    options: [CURRENCY],
    system: () => 'You extract structured data from photographed or scanned invoices and receipts for bookkeeping. ' + READ_PICTURE + ' Amounts must be numbers without currency symbols or thousands separators; dates must be YYYY-MM-DD. ' + JSON_ONLY,
    prompt: (i, o) => 'Extract the invoice or receipt in the attached picture — if there are several pictures, they are pages of one document, in order — into JSON with exactly these keys: vendor_name, vendor_gstin_or_vat, vendor_address, invoice_number, invoice_date, due_date, buyer_name, buyer_gstin_or_vat, currency (ISO code; default ' + o.currency + ' if not printed), subtotal, discount, cgst, sgst, igst, vat, other_tax, tax_total, shipping, round_off, grand_total, amount_in_words, payment_terms, bank_details, line_items (array of {description, hsn_or_sac, quantity, unit, unit_price, tax_rate_percent, amount}), notes, legibility (high|medium|low: how clearly the picture reads), unreadable_fields (array of key names you could not read with confidence).' + withNotes(i),
    output: 'fields', maxTokens: 3000,
    downloads: (data, ctx) => {
      const items = Array.isArray(data.line_items) ? data.line_items : [];
      const header = Object.entries(data).filter(([k]) => k !== 'line_items').map(([k, v]) => [k, Array.isArray(v) ? v.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' | ') : cell(v)]);
      const rows = [['field', 'value']].concat(header).concat([[], ['line items']]).concat(items.length ? ctx.sheet.objectsToRows(items) : []);
      const base = (data.invoice_number ? String(data.invoice_number).replace(/[^\w-]+/g, '_') : 'invoice');
      return [
        { name: base + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
        { name: base + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, 'Invoice') }
      ];
    },
    sample: { inputs: { notes: 'A GST tax invoice from an Indian supplier, one page, photographed on a desk. Amounts are in rupees.' }, opts: { currency: 'INR' } },
    tips: [
      'Try a sample fills the notes only — a sample cannot attach a picture. Add a photo or scan of any invoice, then press Read.',
      'Photograph the page straight on, in good light, with all of it in frame. A crooked or shadowed photo still reads; faint print and small totals are where mistakes creep in.',
      'The picture is resized on your device so its longer side is 1,600 pixels — enough for a full A4 page — and sent as a JPEG. A PDF is rendered here, first four pages.',
      'Check the totals and the GSTIN against the paper. legibility and unreadable_fields say where the model was unsure; a null is a field it could not read, not a zero.',
      'A typed or exported PDF is better served by the Invoice & Receipt Data Extractor, which reads the text layer and sends no picture at all.'
    ],
    faq: [
      { q: 'What is sent, and where?', a: 'The resized picture itself and a short instruction, through our gateway to the model — which is different from the text tools, where only text ever leaves your device. The personal-data shield masks numbers in the notes you type, but it cannot mask pixels; if the invoice shows something that should not travel, cover it before you photograph it. We store neither the picture nor the answer; only the fact of a call is counted.' },
      { q: 'How accurate is it on a photo?', a: 'Good on a clean, well-lit page: the number, the dates, the GSTIN and the line items come back correctly most of the time. Handwritten invoices, faded thermal receipts and blurred or crumpled photos read worse, and the model is told to return null rather than guess. Treat it as a first draft of data entry that you check against the paper.' },
      { q: 'Is this OCR?', a: 'Not in the classic sense: no text layer is produced. The model looks at the picture and writes the fields, which is why it copes with stamps, handwriting and odd layouts that OCR trips on — and why the numbers still need your eye.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['receipt-batch-reader'] = {
    title: 'Expense Receipts to Spreadsheet',
    short: 'Receipts to Spreadsheet',
    description: 'Photograph up to four expense receipts at a time and get one row per receipt — date, merchant, category, amount, tax, currency and how it was paid — as a CSV or Excel file for the expense claim or the books.',
    keywords: ['receipts to excel', 'expense receipt scanner', 'receipt ocr to spreadsheet', 'expense claim receipts', 'photo receipts to csv', 'receipt data extraction ai'],
    glyph: 'i-ai-receipts',
    glyphSvg: '<symbol id="i-ai-receipts" viewBox="0 0 24 24">\n  <path d="M6.5 3.5h11v17l-1.85-1.4-1.8 1.4-1.85-1.4-1.8 1.4-1.85-1.4L6.5 20.5z"/>\n  <path d="M9.5 8h5M9.5 11h5M9.5 14h3" class="thin"/>\n  <path d="M14.5 13.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" class="fill"/>\n</symbol>',
    scripts: SCRIPTS, action: 'Read receipts', resultTitle: 'Receipts read',
    privacy: 'The pictures of the receipts are sent to the model, resized on your device first. Whatever is printed on them goes with them — card numbers on a till slip are usually masked by the printer, but look.',
    inputs: [{ key: 'notes', label: 'Receipts — up to four photos, or a PDF', type: 'image', rows: 3, placeholder: 'Optional notes: the trip or project these belong to, the currency if it is not printed, a merchant the print does not name…' }],
    options: [
      CURRENCY,
      { key: 'categories', label: 'Your expense categories (optional)', type: 'text', placeholder: 'Travel, Meals, Fuel, Accommodation, Office supplies, Telephone…', hint: 'Comma-separated; the model prefers these names' }
    ],
    system: (o) => 'You read expense receipts for an expense claim or the books. Each attached picture is one receipt. Give every receipt a category' + (o.categories ? ', preferring these: ' + o.categories : ', such as Travel, Meals, Fuel, Accommodation, Office supplies, Telephone, Software or Other') + '. ' + READ_PICTURE + ' Amounts are numbers without currency symbols or thousands separators; dates are YYYY-MM-DD; tax is the total tax printed (GST or VAT, all components added together), or null if none is shown. ' + JSON_ONLY,
    prompt: (i, o) => 'Read every attached receipt. Return a JSON array with one object per picture, in the order attached, with keys: receipt (1-based picture number), date, merchant, category, description (what was bought, briefly), amount (the total paid), tax, currency (ISO code; default ' + o.currency + ' if not printed), payment_method (cash|card|upi|other|null), receipt_number, confidence (high|medium|low), unreadable_fields (array of key names you could not read). If a picture is not a receipt, say what it is in description and leave the other fields null.' + withNotes(i),
    output: 'table', maxTokens: 2500,
    downloads: csvDownload('expense-receipts'),
    sample: { inputs: { notes: 'Receipts from a two-day client visit to Pune, 12–13 April. Amounts are in rupees.' }, opts: { currency: 'INR' } },
    tips: [
      'Try a sample fills the notes only — a sample cannot attach a picture. Add photos of a few receipts, then press Read receipts.',
      'One receipt per photo, flat and in frame, reads best. Four receipts in one photo will come back as one row; if you have many, four photos a run keeps every row clean.',
      'Give it your own category names and the spreadsheet drops straight into your claim form or your ledger without renaming.',
      'Thermal till slips fade; photograph them the day you get them. A faded total comes back as null with the field named in unreadable_fields, not as a guess.',
      'Confidence is honest: check the low ones against the paper before you claim them.'
    ],
    faq: [
      { q: 'What is sent?', a: 'The resized pictures and a short instruction. The shield masks personal data in the notes you type, but it cannot mask what is printed on a receipt. We store neither the pictures nor the rows that come back.' },
      { q: 'Can it read a whole month of receipts?', a: 'Four pictures a run, or the first four pages of a PDF. A month is a few runs, each one giving you a CSV you can paste together — or tell us if you need more; batch runs are on the Pro list.' },
      { q: 'Does it add the receipts up?', a: 'No. Each row carries its own total; the spreadsheet is where you add them, which is also where you check them.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['kyc-document-reader'] = {
    title: 'ID & KYC Document Reader',
    short: 'KYC Document Reader',
    description: 'Photograph a PAN card, Aadhaar (front), passport, driving licence, GST certificate or cheque and get the typed fields back — document type, name, number, dates, address — with a checklist of what to verify before you accept it.',
    keywords: ['kyc document reader', 'pan card ocr', 'aadhaar card reader', 'passport data extraction', 'driving licence ocr', 'gst certificate reader', 'cheque details extraction', 'kyc data entry'],
    glyph: 'i-ai-idcard',
    glyphSvg: '<symbol id="i-ai-idcard" viewBox="0 0 24 24">\n  <rect x="3" y="5" width="18" height="14" rx="1.5"/>\n  <circle cx="8.5" cy="10.5" r="2" class="thin"/>\n  <path d="M5.5 15.5c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 9.5h4M14 12.5h4M14 15.5h2.5" class="thin"/>\n</symbol>',
    scripts: SCRIPTS, action: 'Read document', resultTitle: 'Document read',
    privacy: 'The picture of the identity document is sent to the model as an image, resized on your device first; the shield cannot mask what is printed on it. Use it for your own documents, or for someone else’s only with their consent and for the purpose they gave it.',
    inputs: [{ key: 'notes', label: 'The document — photo, scan or PDF', type: 'image', rows: 3, placeholder: 'Optional notes: which document it is if the photo shows only part of it, what you are checking it for…' }],
    options: [],
    system: () => 'You read identity and KYC documents for data entry and onboarding checks: Indian PAN cards, Aadhaar (front), passports, driving licences, GST registration certificates and bank cheques. ' + READ_PICTURE + ' Copy names and numbers exactly as printed, character for character; dates as YYYY-MM-DD. You read; you do not verify. The checklist you return is what a person must verify by other means — format and check-digit rules, the issuer’s portal, expiry, a match against other documents. Never say a document is genuine. ' + JSON_ONLY,
    prompt: (i) => 'Read the attached picture — if there are several, they are sides or pages of one document. Return JSON with exactly these keys: document_type (one of: PAN card, Aadhaar, Passport, Driving licence, GST certificate, Cheque, Other identity document, Not an identity document), what_it_is (one short sentence describing the document as seen), issuing_country, holder_name, id_number (the principal number: PAN, Aadhaar number, passport number, licence number, GSTIN, or the cheque number), date_of_birth, gender, father_or_spouse_name, address, issue_date, expiry_date, issuing_authority, extra_fields (object of other printed fields that matter for this type — bank, account_number, ifsc, micr for a cheque; legal_name, trade_name, constitution, registration_date for a GST certificate; vehicle_classes for a licence; nationality, place_of_birth for a passport), legibility (high|medium|low), unreadable_fields (array of key names you could not read), verify_checklist (array of 4–8 short strings: the checks a person should make for this document type before accepting it — format and check-digit rules, the issuer’s verification portal, expiry, whether the photo and name match other documents, signs of tampering to look for). If the picture is not an identity or KYC document — an invoice, a letter, a photo of something else — set document_type to "Not an identity document", say what it is in what_it_is, leave the other fields null, and make verify_checklist one item saying that no KYC fields were read.' + withNotes(i),
    output: 'fields', maxTokens: 2500,
    downloads: fieldsDownload('kyc-document', 'Document'),
    sample: { inputs: { notes: 'A PAN card photographed front-on, for a new supplier’s onboarding file.' } },
    tips: [
      'Try a sample fills the notes only — a sample cannot attach a picture. Add a photo of a document, then press Read document.',
      'Photograph the front, flat, in good light, with all four corners in frame. The checklist depends on the number being read exactly, and a blurred digit is the usual failure.',
      'The tool reads; it does not verify. A PAN that reads cleanly may be inactive and a passport may be expired or altered. verify_checklist says what to check and where — the Income Tax e-filing portal for PAN, UIDAI for Aadhaar, the GST portal for a GSTIN — and that check is yours to make.',
      'Aadhaar: the front is enough for the name, number and date of birth. A masked Aadhaar (only the last four digits printed) reads as masked; the tool will not guess the rest.',
      'A cheque gives the account holder, bank, account number, IFSC and MICR — enough to set up a payee. Cross-check the IFSC on the bank’s own site before the first payment.'
    ],
    faq: [
      { q: 'Am I allowed to run someone’s ID through this?', a: 'Only when you may lawfully hold and process that document: your own, or one given to you for a stated purpose such as onboarding, with the holder’s consent, under the rules that apply to you (the DPDP Act in India, UK GDPR in the UK). The tool stores neither the picture nor the answer — the picture is sent to the model to be read and comes back as fields. Collect no more than you need and delete what you do not.' },
      { q: 'Does it verify the document?', a: 'No. It reads what is printed and tells you what to verify. A correct-looking PAN can be cancelled, a GSTIN suspended, a licence expired, and a picture edited. Verification happens on the issuer’s portal or through a KYC provider; the checklist points you there.' },
      { q: 'Why can it not mask the number before sending?', a: 'Because the number is what you asked it to read. The shield masks personal data in text you type; it cannot mask pixels. If you need the name and not the number, cover the number before you photograph the document.' }
    ]
  };
})();
