/**
 * The AI tools for business: what each one is, what it asks the model, and
 * how the answer is shown. One file, because the prompts are the product
 * and reading them side by side keeps them honest with each other.
 *
 * Every prompt that expects structure says "return only JSON" and names
 * the shape; the renderer pulls the first JSON value out of whatever comes
 * back and falls back to showing the text if it is not there.
 */
(function () {
  'use strict';
  window.AI_TOOLS = window.AI_TOOLS || {};
  const COMMON = ['/engine/zip.js', '/engine/sheet.js', '/engine/pdf-text.js', '/engine/pii.js', '/engine/render-ai.js', '/engine/ai-tools.js'];
  const JSON_ONLY = 'Return only JSON, with no explanation before or after it and no markdown fences. Inside JSON strings write line breaks as \\n, never as a raw newline. Use null for anything not present; never invent a value.';
  const csvDownload = (name) => (data, ctx) => {
    const list = Array.isArray(data) ? data : (data.rows || data.items || [data]);
    const rows = ctx.sheet.objectsToRows(list);
    return [
      { name: name + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
      { name: name + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, name) }
    ];
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['invoice-extractor'] = {
    title: 'Invoice & Receipt Data Extractor',
    short: 'Invoice Extractor',
    description: 'Drop an invoice or receipt — PDF or pasted text — and get the vendor, numbers, dates, taxes and every line item back as a table you can download for your accounts.',
    keywords: ['invoice data extraction', 'invoice to excel', 'receipt to csv', 'extract line items from invoice', 'invoice ocr alternative', 'gst invoice extractor', 'ai invoice reader'],
    glyph: 'i-ai-invoice', scripts: COMMON, action: 'Extract', resultTitle: 'Invoice read',
    privacy: 'The text of the invoice is sent to the model. The PDF file itself is read here and never leaves your device.',
    inputs: [{ key: 'doc', label: 'Invoice or receipt', type: 'text+file', accept: '.pdf,.txt,.md', rows: 12, placeholder: 'Paste the invoice text, or choose the PDF above. Scanned PDFs have no text layer and cannot be read here.' }],
    options: [{ key: 'currency', label: 'Currency if not stated', type: 'select', default: 'INR', options: [{ value: 'INR', label: 'INR ₹' }, { value: 'GBP', label: 'GBP £' }, { value: 'USD', label: 'USD $' }, { value: 'EUR', label: 'EUR €' }, { value: 'AED', label: 'AED' }] }],
    system: () => 'You extract structured data from invoices and receipts for bookkeeping. Read carefully; amounts must be numbers without currency symbols or thousands separators; dates must be YYYY-MM-DD. ' + JSON_ONLY,
    prompt: (i, o) => 'Extract this invoice into JSON with exactly these keys: vendor_name, vendor_gstin_or_vat, vendor_address, invoice_number, invoice_date, due_date, buyer_name, buyer_gstin_or_vat, currency (ISO code; default ' + o.currency + ' if not stated), subtotal, discount, cgst, sgst, igst, vat, other_tax, tax_total, shipping, round_off, grand_total, amount_in_words, payment_terms, bank_details, line_items (array of {description, hsn_or_sac, quantity, unit, unit_price, tax_rate_percent, amount}), notes.\n\nINVOICE TEXT:\n' + i.doc,
    output: 'fields', maxTokens: 3000,
    downloads: (data, ctx) => {
      const items = Array.isArray(data.line_items) ? data.line_items : [];
      const header = Object.entries(data).filter(([k]) => k !== 'line_items').map(([k, v]) => [k, v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v]);
      const rows = [['field', 'value']].concat(header).concat([[], ['line items']]).concat(items.length ? ctx.sheet.objectsToRows(items) : []);
      const base = (data.invoice_number ? String(data.invoice_number).replace(/[^\w-]+/g, '_') : 'invoice');
      return [
        { name: base + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
        { name: base + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, 'Invoice') }
      ];
    },
    sample: { inputs: { doc: 'TAX INVOICE\nSharma Traders Pvt Ltd\n12 MG Road, Pune 411001\nGSTIN 27AABCS1234A1Z5\n\nInvoice No: INV-2026-0417    Date: 03/04/2026    Due: 03/05/2026\nBill to: Patel & Sons, Ahmedabad  GSTIN 24AABCP9876B1Z2\n\nSl  Description                 HSN     Qty   Rate      Amount\n1   Industrial gloves (pair)    6116    200   85.00     17,000.00\n2   Safety goggles              9004    50    240.00    12,000.00\n3   Delivery charges            9965    1     1,500.00  1,500.00\n\nSubtotal                                            30,500.00\nCGST 9%                                              2,745.00\nSGST 9%                                              2,745.00\nRound off                                                0.00\nGrand Total                                         35,990.00\nRupees Thirty Five Thousand Nine Hundred Ninety Only\nPayment: 30 days. HDFC Bank A/c 50200012345678 IFSC HDFC0000123' } },
    tips: ['A typed or exported PDF has a text layer and reads cleanly. A scanned image does not — the page tells you, and nothing is sent.', 'Check the totals against the paper before you post them. The model reads well, but it is reading, not calculating; the line items are there so you can add them up.', 'Download the .xlsx and the line items come as a proper table under the header fields, ready for a purchase register or a Tally import.', 'Multi-page invoices work; the first 40 pages are read. Statements with dozens of invoices are better fed one invoice at a time.'],
    faq: [{ q: 'What is sent, and where?', a: 'The text of the invoice — what you pasted, or what the page read out of the PDF — is sent to the model through our gateway to be structured. The PDF file never leaves your device, and we do not store the text or the answer; only the fact that a call was made is counted against your monthly allowance.' }, { q: 'How accurate is it?', a: 'On typed invoices, very: vendor, numbers, dates and line items come back correctly in the great majority of cases. Where a value is ambiguous the model is told to return null rather than guess. Treat it as a fast first draft of data entry that you check, not as an auditor.' }, { q: 'Does it do OCR on scanned invoices?', a: 'Not yet. A scan has no text layer, and reading pixels is a different job. If you have many scans, tell us — it is on the list.' }]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['bank-statement-categoriser'] = {
    title: 'Bank Statement Categoriser',
    short: 'Statement Categoriser',
    description: 'Paste or upload a bank statement and get every transaction categorised to a ledger head — rent, salaries, GST paid, a named customer — as a spreadsheet, or as Tally receipt and payment vouchers ready to import.',
    keywords: ['bank statement categorisation', 'bank statement to excel', 'bank statement to tally', 'categorise transactions ai', 'bookkeeping automation', 'bank reconciliation helper'],
    glyph: 'i-ai-bank', scripts: COMMON.concat(['/engine/biz-tally-converter.js']), action: 'Categorise', resultTitle: 'Transactions categorised',
    privacy: 'The transaction lines are sent to the model. Account numbers you paste go with them — remove them first if you would rather they did not.',
    inputs: [{ key: 'statement', label: 'Statement', type: 'text+file', accept: '.csv,.xlsx,.pdf,.txt', rows: 12, maxRows: 250, placeholder: 'Paste the transactions (date, description, debit, credit) or choose the CSV, Excel or PDF your bank gave you.' }],
    options: [
      { key: 'business', label: 'What the business does', type: 'text', placeholder: 'e.g. hardware wholesaler in Pune', hint: 'Helps the model pick sensible heads' },
      { key: 'bank', label: 'Bank ledger name in your books', type: 'text', default: 'HDFC Bank', hint: 'Used in the Tally vouchers' },
      { key: 'heads', label: 'Your ledger heads (optional)', type: 'text', placeholder: 'Rent, Salaries, Electricity, GST Payable, Sales, Purchases…', hint: 'Comma-separated; the model prefers these names' }
    ],
    system: (o) => 'You are a bookkeeper categorising bank transactions for ' + (o.business || 'a small business') + '. Every transaction gets a category (a short head such as Rent, Salaries, Utilities, Purchases, Sales receipt, Bank charges, GST payment, Loan EMI, Owner drawings, Transfer, Unknown) and a ledger name suitable for accounting software' + (o.heads ? ', preferring these ledger heads where they fit: ' + o.heads : '') + '. Recognise counterparties from descriptions (UPI/NEFT/IMPS references contain names). Amounts are numbers; dates are YYYY-MM-DD. ' + JSON_ONLY,
    prompt: (i) => 'Categorise every transaction in this statement. Return a JSON array of objects with keys: date, description, debit, credit, category, ledger, counterparty, confidence (high|medium|low), note. Keep every row; do not merge or drop any.\n\nSTATEMENT:\n' + i.statement,
    output: 'table', maxTokens: 4000,
    downloads: (data, ctx) => {
      const rows = Array.isArray(data) ? data : (data.rows || []);
      const out = csvDownload('categorised-statement')(rows, ctx);
      if (window.MVRTally && window.MVRTally.envelope) {
        out.push({ name: 'bank-vouchers-tally.xml', blob: () => {
          const T = window.MVRTally;
          const bank = ctx.opts.bank || 'Bank';
          const vouchers = rows.map((r, idx) => {
            const dr = Number(r.debit) || 0, cr = Number(r.credit) || 0;
            const amt = Math.round((dr || cr) * 100) / 100; if (!amt) return null;
            const date = T.toTallyDate(r.date, true); if (!date) return null;
            const ledger = r.ledger || r.category || 'Suspense';
            /* money out: Payment (ledger Dr, bank Cr); money in: Receipt (bank Dr, ledger Cr) */
            const lines = dr ? [{ ledger, amount: -amt }, { ledger: bank, amount: amt }] : [{ ledger: bank, amount: -amt }, { ledger, amount: amt }];
            return { date, type: dr ? 'Payment' : 'Receipt', vno: String(idx + 1), party: ledger, narration: [r.description, r.counterparty].filter(Boolean).join(' — ').slice(0, 250), ref: '', lines, total: amt };
          }).filter(Boolean);
          return new Blob([T.envelope('Vouchers', '', vouchers.map(T.voucherXml).join(''))], { type: 'application/xml' });
        } });
      }
      return out;
    },
    sample: { inputs: { statement: 'Date\tDescription\tDebit\tCredit\n01/04/2026\tUPI/SHARMA TRADERS/INV-2026-0417\t\t35990.00\n02/04/2026\tNEFT ABC PROPERTIES RENT APR\t45000.00\t\n03/04/2026\tMSEDCL ELECTRICITY BILL\t8420.00\t\n05/04/2026\tSALARY MAR - R KUMAR\t32000.00\t\n05/04/2026\tSALARY MAR - S IYER\t28000.00\t\n07/04/2026\tGST PMT CHALLAN 27AAB\t61200.00\t\n10/04/2026\tIMPS/PATEL AND SONS/ADV\t\t50000.00\n12/04/2026\tSMS CHARGES\t23.60\t\n15/04/2026\tHDFC LOAN EMI 4471\t18450.00\t' }, opts: { business: 'hardware wholesaler in Pune', bank: 'HDFC Bank' } },
    tips: ['Give it your own ledger heads and it will use your names, which is what makes the Tally file importable without renaming.', 'Money out becomes a Payment voucher (expense ledger debited, bank credited); money in becomes a Receipt (bank debited, the customer or income ledger credited). Every voucher balances by construction.', 'Low-confidence rows are marked so you can check those first. Unknowns land on a Suspense ledger rather than being guessed.', 'Up to 250 rows per run reads reliably. A year of statements is better fed a quarter at a time.'],
    faq: [{ q: 'Is my bank data stored?', a: 'No. The lines you paste are sent to the model to be categorised and the answer comes back to your browser; we keep neither. Remove account numbers before pasting if you prefer they never travel at all — categorisation does not need them.' }, { q: 'How does the Tally file work?', a: 'Each debit becomes a Payment voucher and each credit a Receipt, between your bank ledger and the ledger the model chose. The ledgers named must exist in your Tally company — the Excel to Tally converter on this site can create missing party ledgers from a list.' }]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['data-cleaner'] = {
    title: 'Customer & Product Data Cleaner',
    short: 'Data Cleaner',
    description: 'Upload a messy customer, supplier or product list and get it back normalised — consistent names, valid phones and emails, GSTINs checked, addresses tidied — with duplicates flagged and the reason given.',
    keywords: ['clean customer data', 'deduplicate contacts', 'normalise phone numbers', 'clean excel list ai', 'gstin validation', 'crm data cleanup'],
    glyph: 'i-ai-clean', scripts: COMMON, action: 'Clean', resultTitle: 'List cleaned',
    privacy: 'The rows are sent to the model. Names, phones and emails travel with them; that is what is being cleaned.',
    inputs: [{ key: 'rows', label: 'The list', type: 'text+file', accept: '.csv,.xlsx,.txt', rows: 12, maxRows: 200, placeholder: 'Paste rows with a header line, or choose the CSV or Excel file. Up to 200 rows a run.' }],
    options: [
      { key: 'country', label: 'Phone numbers are mostly', type: 'select', default: 'IN', options: [{ value: 'IN', label: 'Indian (+91)' }, { value: 'GB', label: 'UK (+44)' }, { value: 'US', label: 'US / Canada (+1)' }, { value: 'AE', label: 'UAE (+971)' }, { value: 'MIXED', label: 'Mixed — keep as given' }] },
      { key: 'names', label: 'Names', type: 'select', default: 'title', options: [{ value: 'title', label: 'Title Case' }, { value: 'upper', label: 'UPPER CASE' }, { value: 'keep', label: 'Leave as typed' }] }
    ],
    system: (o) => 'You clean business contact and product lists. Rules: trim whitespace; names in ' + (o.names === 'upper' ? 'upper case' : o.names === 'keep' ? 'their original case' : 'Title Case (keep company suffixes like Pvt Ltd, LLP, Ltd correct)') + '; emails lower case and only if valid, else null with a note; phone numbers as digits in E.164 for ' + (o.country === 'MIXED' ? 'their evident country' : o.country) + ' when unambiguous, else null with a note; Indian GSTIN must match the 15-character pattern (2 digits, 5 letters, 4 digits, 1 letter, 1 alphanumeric, Z, 1 alphanumeric) else flag it; PIN/post codes as given but trimmed; split trailing city/state into their own fields when clearly present. Flag likely duplicates (same phone, same email, or the same name with a near-identical address) with the row number they duplicate. Never invent data. ' + JSON_ONLY,
    prompt: (i) => 'Clean this list. Return a JSON array with one object per input row, in the same order, containing every original column (cleaned) plus: row (1-based input row number), issues (array of short strings, empty if none), duplicate_of (row number or null).\n\nLIST:\n' + i.rows,
    output: 'table', maxTokens: 4000,
    downloads: csvDownload('cleaned-list'),
    sample: { inputs: { rows: 'Name\tPhone\tEmail\tGSTIN\tAddress\n sharma traders pvt ltd\t98765 43210\tAcc@Sharma.Example\t27AABCS1234A1Z5\t12 mg road, pune 411001\nPATEL & SONS\t+91-9123456780\tpatel@example\t24AABCP9876B1Z\tPlot 4 GIDC Vapi 396195\nSharma Traders Pvt. Ltd.\t9876543210\tacc@sharma.example\t27AABCS1234A1Z5\t12, M G Road Pune\nmehta suppliers\t\tmehta@example.com\t\tAhmedabad' }, opts: { country: 'IN' } },
    tips: ['Every change is visible: the cleaned value sits in the column, and the issues column says what was wrong — an invalid GSTIN, an email that could not be, a phone with the wrong number of digits.', 'Duplicates are flagged, not deleted. Row 3 saying "duplicate_of: 1" is a decision for you, not the tool.', 'Product lists work the same way: consistent casing, units and codes, with near-duplicate SKUs flagged.'],
    faq: [{ q: 'Will it change my data silently?', a: 'No. Nothing is removed, rows stay in order, and every normalisation that is more than trimming is named in the issues column so you can see what moved. Anything the model cannot make valid becomes null with the reason, rather than a plausible-looking fabrication.' }, { q: 'How many rows can I clean?', a: 'Two hundred a run reads reliably. For a bigger file, split it — or ask us about batch runs, which are on the Pro roadmap.' }]
  };

  /* ------------------------------------------------------------------ */

  const LETTER_TYPES = [
    { value: 'reminder', label: 'Payment reminder (overdue invoice)' }, { value: 'quote-followup', label: 'Follow-up on a quotation' }, { value: 'complaint-reply', label: 'Reply to a customer complaint' },
    { value: 'apology', label: 'Apology for a delay or mistake' }, { value: 'intro', label: 'Introduction to a prospect' }, { value: 'price-increase', label: 'Notice of a price increase' },
    { value: 'thank-you', label: 'Thank-you after an order' }, { value: 'refund', label: 'Refund or return decision' }, { value: 'supplier', label: 'Request to a supplier' },
    { value: 'offer-letter', label: 'Job offer letter' }, { value: 'reference', label: 'Employment reference' }, { value: 'custom', label: 'Something else (describe below)' }
  ];
  window.AI_TOOLS['business-writer'] = {
    title: 'Business Email & Letter Writer',
    short: 'Business Writer',
    description: 'The emails and letters a business sends every week — payment reminders, quotation follow-ups, complaint replies, offer letters — written properly from a few facts, in the tone you choose.',
    keywords: ['payment reminder email generator', 'business letter writer ai', 'professional email generator', 'complaint response letter', 'quotation follow up email', 'job offer letter generator'],
    glyph: 'i-ai-letter', scripts: COMMON, action: 'Write', resultTitle: 'Draft ready',
    privacy: 'The facts you type are sent to the model. Do not include anything you would not put in the letter itself.',
    inputs: [{ key: 'facts', label: 'The facts', type: 'text', rows: 8, placeholder: 'Who it is to, what happened, amounts, dates, what you want them to do, anything to avoid saying…' }],
    options: [
      { key: 'kind', label: 'What to write', type: 'select', default: 'reminder', options: LETTER_TYPES },
      { key: 'tone', label: 'Tone', type: 'select', default: 'firm-polite', options: [{ value: 'warm', label: 'Warm' }, { value: 'neutral', label: 'Neutral, professional' }, { value: 'firm-polite', label: 'Firm but polite' }, { value: 'formal', label: 'Formal / legal register' }] },
      { key: 'length', label: 'Length', type: 'select', default: 'short', options: [{ value: 'short', label: 'Short — under 120 words' }, { value: 'medium', label: 'Medium — about 200 words' }, { value: 'long', label: 'Full letter' }] },
      { key: 'english', label: 'English', type: 'select', default: 'IN', options: [{ value: 'IN', label: 'Indian business English' }, { value: 'GB', label: 'British' }, { value: 'US', label: 'American' }] },
      { key: 'from', label: 'Sign off as', type: 'text', placeholder: 'Name, role, company' }
    ],
    system: (o) => 'You write business correspondence for small and medium companies. Write in ' + (o.english === 'US' ? 'American' : o.english === 'GB' ? 'British' : 'Indian business') + ' English, ' + ({ warm: 'warm and personal', neutral: 'neutral and professional', 'firm-polite': 'firm but courteous, with no threats and no apology for asking', formal: 'formal, precise, suitable for a legal or HR record' }[o.tone] || 'professional') + '. Use only the facts given; where a needed fact is missing, put a clearly marked placeholder in square brackets rather than inventing it. No preamble, no explanation, no options: output the finished text only, with a subject line first if it is an email.',
    prompt: (i, o) => 'Write a ' + ({ short: 'short (under 120 words)', medium: 'medium-length (about 200 words)', long: 'full-length' }[o.length] || '') + ' ' + (LETTER_TYPES.find(t => t.value === o.kind) || {}).label + '.' + (o.from ? ' Sign off as: ' + o.from + '.' : '') + '\n\nFACTS:\n' + i.facts,
    output: 'text', maxTokens: 1500,
    sample: { inputs: { facts: 'To: Mr Desai, accounts, Patel & Sons. Invoice INV-2026-0417 for Rs 35,990, dated 3 April 2026, was due 3 May and is now 18 days overdue. This is the second reminder. We value the relationship; ask for payment within 7 days or a call to agree a date. Bank details are on the invoice.' }, opts: { kind: 'reminder', tone: 'firm-polite', from: 'Vishal, Accounts, Sharma Traders' } },
    tips: ['Give it the facts as a list, not a draft — amounts, dates, names, what you want to happen. It writes better from facts than from a half-written letter.', 'Anything it does not know appears in [square brackets] rather than being made up. Search for "[" before you send.', 'Firm but polite is the right default for money. Formal is for letters that may be read by a lawyer or a tribunal.'],
    faq: [{ q: 'Is this legal advice?', a: 'No. It is a well-written letter from your facts. For a notice with legal consequences — termination, a demand before proceedings — have a professional read it first.' }, { q: 'Can it write in Hindi or another language?', a: 'Ask for it in the facts ("write this in Hindi") and it will. The options are tuned for English; the model handles the rest.' }]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['product-listing-writer'] = {
    title: 'Product Listing Writer',
    short: 'Listing Writer',
    description: 'Turn a bare product list into store-ready listings — title, description, bullet points, SEO title and meta, search tags — for one product or a whole spreadsheet of them.',
    keywords: ['product description generator', 'ecommerce listing writer', 'seo product title generator', 'bulk product descriptions from excel', 'amazon flipkart listing writer', 'shopify description ai'],
    glyph: 'i-ai-listing', scripts: COMMON, action: 'Write listings', resultTitle: 'Listings written',
    privacy: 'The product facts are sent to the model. Prices and stock levels are not needed — leave them out.',
    inputs: [{ key: 'products', label: 'Products', type: 'text+file', accept: '.csv,.xlsx,.txt', rows: 10, maxRows: 40, placeholder: 'One product per line (name, key facts, materials, sizes, what it is for), or a CSV/Excel with a header row. Up to 40 products a run.' }],
    options: [
      { key: 'channel', label: 'Written for', type: 'select', default: 'own-store', options: [{ value: 'own-store', label: 'Your own online store' }, { value: 'amazon', label: 'Amazon / Flipkart style (bullets, keywords)' }, { value: 'catalogue', label: 'B2B catalogue — specs first' }, { value: 'social', label: 'Social commerce — short and lively' }] },
      { key: 'tone', label: 'Voice', type: 'select', default: 'clear', options: [{ value: 'clear', label: 'Clear and confident' }, { value: 'premium', label: 'Premium, understated' }, { value: 'friendly', label: 'Friendly, everyday' }, { value: 'technical', label: 'Technical, precise' }] },
      { key: 'brand', label: 'Brand or store name', type: 'text', placeholder: 'optional' }
    ],
    system: (o) => 'You write e-commerce product copy in ' + ({ premium: 'a premium, understated', friendly: 'a friendly, everyday', technical: 'a technical, precise' }[o.tone] || 'a clear, confident') + ' voice for ' + ({ amazon: 'a marketplace listing: benefit-led bullets and searchable keywords', catalogue: 'a B2B catalogue: specifications first, plain claims', social: 'social commerce: short, vivid, one idea per line' }[o.channel] || 'a brand’s own store') + (o.brand ? ', for the brand ' + o.brand : '') + '. Use only the facts given about each product; never invent specifications, certifications or origins. British spelling. Titles under 70 characters; meta descriptions under 155 characters. ' + JSON_ONLY,
    prompt: (i) => 'Write a listing for each product below. Return a JSON array with one object per product, in order, with keys: input_name, title, description (2–4 sentences), bullets (array of 4–6 short benefit statements), seo_title, meta_description, tags (array of 6–10 search terms), missing_facts (array of things a buyer would want that were not given).\n\nPRODUCTS:\n' + i.products,
    output: 'table', maxTokens: 4000,
    downloads: csvDownload('product-listings'),
    sample: { inputs: { products: 'Name\tFacts\nCopper bottom pressure cooker 5L\tHard-anodised aluminium body, copper bottom for even heating, induction and gas compatible, ISI marked, 5 year warranty, 5 litre\nCotton kurta set men\t100% handloom cotton, straight cut, mandarin collar, sizes S-XXL, machine washable, made in Jaipur' }, opts: { channel: 'own-store', brand: 'KBK Mart' } },
    tips: ['Facts in, copy out: the more you give (material, size, what it is for, what makes it different), the less generic the result. The missing_facts column tells you what a buyer would still ask.', 'The marketplace style front-loads keywords and benefits in bullets, which is what those search engines reward. Your own store can afford a voice.', 'Nothing is invented: a certification or origin you did not state will not appear. That is the point.'],
    faq: [{ q: 'Will the descriptions be unique?', a: 'Each is written from that product’s facts, so two products with different facts get different copy. Two products with identical facts will read alike — give them their differences.' }, { q: 'Can it write in Hindi or regional languages?', a: 'Add "write in Hindi" (or Tamil, Marathi…) to the brand box and it will, though SEO fields stay in English unless you say otherwise.' }]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['document-summariser'] = {
    title: 'Contract & Document Summariser',
    short: 'Document Summariser',
    description: 'A contract, a tender, a policy, a long email thread — PDF or text — summarised into what it says, who owes what to whom, the dates that matter, the money, and the questions you should ask before signing.',
    keywords: ['contract summary ai', 'summarise pdf', 'legal document summariser', 'tender document summary', 'agreement key terms extractor', 'ai document review'],
    glyph: 'i-ai-summary', scripts: COMMON, action: 'Summarise', resultTitle: 'Summary',
    privacy: 'The document’s text is sent to the model. A confidential contract is confidential to the model provider too; read the FAQ before sending one.',
    inputs: [{ key: 'doc', label: 'Document', type: 'text+file', accept: '.pdf,.txt,.md', rows: 12, placeholder: 'Paste the text or choose the PDF. Up to about 40 pages.' }],
    options: [{ key: 'for', label: 'Read it as', type: 'select', default: 'signer', options: [{ value: 'signer', label: 'The party about to sign it' }, { value: 'owner', label: 'A business owner deciding whether to proceed' }, { value: 'accountant', label: 'An accountant — money, dates, tax' }, { value: 'neutral', label: 'A neutral reader' }] }],
    system: (o) => 'You summarise business and legal documents for ' + ({ owner: 'a business owner who must decide whether to proceed', accountant: 'an accountant who needs the money, dates and tax implications', neutral: 'a neutral reader' }[o.for] || 'the party about to sign') + '. Be concrete: name parties, amounts, dates and clause references. Distinguish what the document says from what it omits. Do not give legal advice; raise questions instead. ' + JSON_ONLY,
    prompt: (i) => 'Summarise this document. Return JSON with keys: document_type, parties (array of {name, role}), summary (3–6 sentences), key_dates (array of {date, what}), money (array of {amount, currency, what, when}), obligations (array of {who, must, by_when, clause}), termination_and_exit, penalties_and_liabilities, unusual_or_onesided_terms (array), missing_or_unclear (array), questions_to_ask (array of 3–8), plain_english_verdict (2 sentences).\n\nDOCUMENT:\n' + i.doc,
    output: 'fields', maxTokens: 3500,
    downloads: (data, ctx) => [{ name: 'summary.json', blob: () => new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }],
    sample: { inputs: { doc: 'SERVICE AGREEMENT between Sharma Traders Pvt Ltd ("Client") and Nimbus IT Solutions LLP ("Provider"), dated 1 April 2026.\n1. Services. Provider will host and maintain the Client\'s inventory system, with 99.5% monthly uptime.\n2. Fees. Rs 45,000 per month plus GST, payable within 15 days of invoice. Late payment attracts 2% per month.\n3. Term. 24 months from the Effective Date, renewing automatically for 12-month periods unless either party gives 90 days\' written notice before the end of the then-current term.\n4. Termination. Client may terminate for convenience on 180 days\' notice and payment of the fees for the remainder of the current term. Provider may terminate on 30 days\' notice for non-payment.\n5. Liability. Provider\'s total liability is capped at one month\'s fees. Client indemnifies Provider against all third-party claims arising from Client data.\n6. Data. Provider may use anonymised Client data to improve its services.\n7. Governing law: Maharashtra, India. Disputes to arbitration in Mumbai.' } },
    tips: ['Read it as the party about to sign: that view surfaces the terms that bind you and the ones that are missing.', 'The questions_to_ask list is the useful output. Take them to the other side, or to a lawyer, before signing.', 'A 40-page PDF is fine; a 200-page tender is better summarised section by section.'],
    faq: [{ q: 'Should I send a confidential contract to an AI?', a: 'Your text goes to the model provider (Anthropic) through our gateway to produce the summary; we do not store it, and Anthropic’s API terms do not use it to train models. Whether that is acceptable for a given document is your call and sometimes your NDA’s. When in doubt, redact names and amounts first — the structure still summarises.' }, { q: 'Is this legal advice?', a: 'No. It reads and organises; it does not advise. The verdict is plain-English orientation, and the questions are for you to put to a professional.' }]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['meeting-minutes'] = {
    title: 'Meeting Notes to Minutes & Actions',
    short: 'Minutes Writer',
    description: 'Rough notes or a transcript in; proper minutes out — decisions, action items with owners and dates, open questions — ready to send while everyone still remembers the meeting.',
    keywords: ['meeting minutes generator', 'notes to minutes ai', 'action items from meeting notes', 'transcript to minutes', 'meeting summary tool'],
    glyph: 'i-ai-minutes', scripts: COMMON, action: 'Write minutes', resultTitle: 'Minutes',
    privacy: 'Your notes are sent to the model, names included.',
    inputs: [{ key: 'notes', label: 'Notes or transcript', type: 'text+file', accept: '.txt,.md,.pdf', rows: 12, placeholder: 'Paste rough notes, a chat log or a transcript. Include who was there if the notes do not say.' }],
    options: [{ key: 'style', label: 'Style', type: 'select', default: 'business', options: [{ value: 'business', label: 'Business meeting' }, { value: 'board', label: 'Board / formal, with resolutions' }, { value: 'standup', label: 'Team stand-up — terse' }, { value: 'client', label: 'Client call — to send to the client' }] }],
    system: (o) => 'You write meeting minutes from notes, in a ' + ({ board: 'formal board style with numbered resolutions', standup: 'terse stand-up style', client: 'client-facing style suitable to send to the client' }[o.style] || 'clear business') + ' register. Record what was decided and who must do what by when; do not add opinions or content that is not in the notes. Where an owner or date is missing say so. ' + JSON_ONLY,
    prompt: (i) => 'Turn these notes into minutes. Return JSON with keys: title, date, attendees (array), apologies (array), summary (2–4 sentences), discussion (array of {topic, points (array)}), decisions (array of strings), actions (array of {action, owner, due, status}), open_questions (array), next_meeting.\n\nNOTES:\n' + i.notes,
    output: 'fields', maxTokens: 3000,
    downloads: (data, ctx) => {
      const acts = Array.isArray(data.actions) ? data.actions : [];
      return [{ name: 'actions.csv', blob: () => new Blob([ctx.sheet.toCSV(ctx.sheet.objectsToRows(acts))], { type: 'text/csv' }) }, { name: 'minutes.json', blob: () => new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }];
    },
    sample: { inputs: { notes: 'Weekly ops call 15 Apr 2026. Vishal, Priya, Rahul; Sam away.\n- Q1 sales up 12%, Pune warehouse stock-outs on gloves twice in March. Rahul to raise reorder level to 400 pairs by Friday.\n- New Tally import tool saved accounts ~6 hrs/week. Priya wants the bank categoriser trialled next month.\n- Patel & Sons overdue 35,990 - second reminder sent, Vishal to call Desai Thursday.\n- Decided: move to monthly GST review with CA, first one 28 Apr.\n- Website: pricing page live in test mode; Stripe UK account being set up (Vishal, no date).\n- Question: do we need cyber insurance now that customer data is in the cloud? Nobody knows. Park for next week.' } },
    tips: ['Names and dates in the notes become owners and due dates in the actions table. Where the notes do not say, the minutes say "not assigned" rather than guessing.', 'Download actions.csv and it drops straight into a task tracker.', 'Board style numbers the resolutions and separates them from discussion, which is what a company secretary wants.'],
    faq: [{ q: 'Can I paste a recording transcript?', a: 'Yes — an auto-transcript from a meeting app works well, speaker labels and all. Up to 60,000 characters, roughly a 45-minute meeting.' }]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['social-post-writer'] = {
    title: 'Social Media Post Writer',
    short: 'Social Posts',
    description: 'One offer, announcement or tip — written as ready-to-post copy for LinkedIn, Instagram, Facebook, X and WhatsApp, each in that platform’s length and manner, with hashtags that fit.',
    keywords: ['social media post generator', 'linkedin post writer ai', 'instagram caption generator business', 'whatsapp business message writer', 'marketing copy generator small business'],
    glyph: 'i-ai-social', scripts: COMMON, action: 'Write posts', resultTitle: 'Posts written',
    privacy: 'What you type is sent to the model. It is marketing copy; there is rarely anything sensitive in it.',
    inputs: [{ key: 'brief', label: 'What to announce', type: 'text', rows: 6, placeholder: 'The offer, product, event or tip; who it is for; any dates, prices or links; what you want people to do.' }],
    options: [
      { key: 'platforms', label: 'Platforms', type: 'select', default: 'all', options: [{ value: 'all', label: 'LinkedIn, Instagram, Facebook, X, WhatsApp' }, { value: 'b2b', label: 'LinkedIn and X' }, { value: 'b2c', label: 'Instagram, Facebook, WhatsApp' }] },
      { key: 'voice', label: 'Voice', type: 'select', default: 'confident', options: [{ value: 'confident', label: 'Confident, plain' }, { value: 'playful', label: 'Playful' }, { value: 'expert', label: 'Expert, educational' }, { value: 'urgent', label: 'Offer-led, time-limited' }] },
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'name, and a handle if you use one' }
    ],
    system: (o) => 'You write social media copy for small businesses in a ' + ({ playful: 'playful', expert: 'expert, educational', urgent: 'offer-led, time-limited' }[o.voice] || 'confident, plain') + ' voice' + (o.brand ? ' for ' + o.brand : '') + '. Respect each platform: LinkedIn 80–150 words with a hook line and no hashtag soup (3 at most); Instagram a caption with line breaks and 8–12 hashtags at the end; Facebook conversational, 40–80 words; X under 260 characters; WhatsApp a short broadcast message with one clear call to action and no hashtags. Use only the facts given; mark anything missing in square brackets. British spelling. ' + JSON_ONLY,
    prompt: (i, o) => 'Write posts for ' + ({ b2b: 'LinkedIn and X', b2c: 'Instagram, Facebook and WhatsApp' }[o.platforms] || 'LinkedIn, Instagram, Facebook, X and WhatsApp') + '. Return a JSON array of objects with keys: platform, post, hashtags (array), best_time_to_post (short suggestion), image_idea.\n\nBRIEF:\n' + i.brief,
    output: 'table', maxTokens: 2500,
    downloads: csvDownload('social-posts'),
    sample: { inputs: { brief: 'Sharma Traders now stocks ISI-marked industrial gloves at Rs 85 a pair for orders over 100 pairs, delivery across Maharashtra in 48 hours. Aimed at factory purchase managers. Offer valid until 30 April. Call 98765 43210 or order on our website.' }, opts: { platforms: 'all', voice: 'confident', brand: 'Sharma Traders' } },
    tips: ['Give the facts and the audience; the tool does the platform-fitting. The same offer reads differently to a purchase manager on LinkedIn and a customer on WhatsApp, and it should.', 'Hashtags come sized to the platform — a handful on LinkedIn, a block on Instagram, none on WhatsApp.', 'The image_idea column is a brief for whoever makes the graphic, or for an image tool.'],
    faq: [{ q: 'Can it post for me?', a: 'No, and it is not going to: copy each post and paste it where it goes. Scheduling tools exist; this writes what they schedule.' }]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['hsn-gst-finder'] = {
    title: 'HSN / SAC Code & GST Rate Finder',
    short: 'HSN Finder',
    description: 'Describe a product or service in plain words and get the likely HSN or SAC codes with the GST rate for each, the reasoning, and the things that could move it to a different code.',
    keywords: ['hsn code finder', 'sac code finder', 'gst rate finder', 'hsn code for product', 'gst classification help', 'find hsn code ai'],
    glyph: 'i-ai-hsn', scripts: COMMON, action: 'Find codes', resultTitle: 'Candidate codes',
    privacy: 'The product description is sent to the model.',
    inputs: [{ key: 'items', label: 'Products or services', type: 'text+file', accept: '.csv,.xlsx,.txt', rows: 8, maxRows: 40, placeholder: 'One per line: what it is, what it is made of, what it is used for. Up to 40 a run.' }],
    options: [],
    system: () => 'You are an Indian GST classification assistant. For each item, give the most likely HSN (goods) or SAC (services) code at 4–8 digits with the GST rate as commonly notified, plus alternatives where classification genuinely turns on a fact. Be explicit that rates change and that the final classification is the taxpayer’s responsibility. Never state a rate with false certainty; give confidence honestly. ' + JSON_ONLY,
    prompt: (i) => 'Classify each item. Return a JSON array with one object per item, in order: item, type (goods|service), best_code, best_rate_percent, confidence (high|medium|low), reasoning (1–2 sentences), alternatives (array of {code, rate_percent, when}), facts_that_change_it (array), check_before_filing (short string).\n\nITEMS:\n' + i.items,
    output: 'table', maxTokens: 3500,
    downloads: csvDownload('hsn-gst-codes'),
    sample: { inputs: { items: 'Industrial rubber-coated work gloves\nLED bulb 9W for household use\nWebsite design and hosting service\nPackaged basmati rice 5kg branded\nRestaurant meal served on premises' } },
    tips: ['The alternatives column is the important one: many products sit on a boundary (branded or unbranded, packaged or loose, under or over a price point) and the code depends on which side you are on.', 'Confidence is honest: "low" means look it up in the tariff or ask your CA before you invoice.', 'Rates change at GST Council meetings. Treat the rate as a pointer to check against the current notification, not as the notification.'],
    faq: [{ q: 'Can I rely on this for filing?', a: 'No. It is a fast way to get to the right neighbourhood of the tariff with the reasoning laid out. The classification you file is your responsibility — confirm against the current CBIC schedule or with your chartered accountant, especially where confidence is medium or low.' }]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['form16-reader'] = {
    title: 'Form 16 Reader (Salary, Deductions & TDS)',
    short: 'Form 16 Reader',
    description: 'Drop a Form 16 — the PDF your employer or TRACES gives — and get the salary, exempt allowances, Chapter VI-A deductions, quarterly TDS and the tax computed back as fields you can check against your return, with a list of what to verify before you file.',
    keywords: ['form 16 reader', 'form 16 to excel', 'extract form 16 data', 'form 16 part b explained', 'tds from form 16', 'itr from form 16', 'form 16 summary ai', 'salary tds certificate reader'],
    glyph: 'i-ai-form16',
    glyphSvg: '<symbol id="i-ai-form16" viewBox="0 0 24 24">\n  <path d="M6 3h8l4 4v14H6z"/>\n  <path d="M14 3v4h4" class="thin"/>\n  <path d="M9 17l6-6" class="thin"/>\n  <circle cx="9.8" cy="11.8" r="1.3" class="thin"/>\n  <circle cx="14.2" cy="16.2" r="1.3" class="thin"/>\n</symbol>',
    scripts: COMMON, action: 'Read Form 16', resultTitle: 'Form 16 read',
    privacy: 'The text of the Form 16 is sent to the model. It carries a PAN, a salary and the employer’s TAN; the PII shield masks the PANs on your device before anything leaves it, and the preview below shows exactly what goes.',
    inputs: [{ key: 'doc', label: 'Form 16 (Part A, Part B or both)', type: 'text+file', accept: '.pdf,.txt', rows: 12, placeholder: 'Choose the PDF above, or paste the text. A scanned Form 16 has no text layer and cannot be read here.' }],
    options: [{ key: 'regime', label: 'Tax regime', type: 'select', default: 'auto', options: [{ value: 'auto', label: 'Read it from the form' }, { value: 'new', label: 'New regime (115BAC)' }, { value: 'old', label: 'Old regime' }] }],
    system: (o) => 'You read Indian Form 16 TDS certificates (Part A: tax deducted and deposited by quarter; Part B: the salary annexure) for a salaried taxpayer preparing an income-tax return. Amounts are numbers in rupees without commas or symbols; dates are YYYY-MM-DD; quarters are Q1 to Q4. Where a figure appears in both parts, report both and say if they differ. Do not recompute the tax; report what the form states, and put any arithmetic that does not add up under checks. ' + (o.regime === 'new' ? 'The employer applied the new regime under section 115BAC. ' : o.regime === 'old' ? 'The employer applied the old regime. ' : 'Read which regime applies from the form: "Yes" to opting out of section 115BAC means the old regime. ') + JSON_ONLY,
    prompt: (i) => 'Extract this Form 16 into JSON with exactly these keys: employer_name, employer_tan, employer_pan, employee_name, employee_pan, assessment_year, financial_year, period_from, period_to, regime (new|old|null), tds_by_quarter (array of {quarter, amount_paid_credited, tax_deducted, tax_deposited, receipt_numbers}), total_tds_part_a, salary_17_1, perquisites_17_2, profits_in_lieu_17_3, gross_salary_total, exempt_allowances_section_10 (array of {allowance, amount}), total_exempt_allowances, standard_deduction, entertainment_allowance, professional_tax, income_chargeable_under_salaries, house_property_income, other_sources_income, gross_total_income, deductions_chapter_via (array of {section, description, gross_amount, deductible_amount}), total_deductions_chapter_via, total_taxable_income, tax_on_total_income, rebate_87a, surcharge, health_and_education_cess, tax_payable, relief_89, net_tax_payable, checks (array of short strings: what to verify against Form 26AS, AIS and the payslips before filing, including any arithmetic on the form that does not add up), notes.\n\nFORM 16 TEXT:\n' + i.doc,
    output: 'fields', maxTokens: 4000,
    downloads: (data, ctx) => {
      const scalar = Object.entries(data).filter(([, v]) => !Array.isArray(v)).map(([k, v]) => [k, v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v]);
      const rows = [['field', 'value']].concat(scalar);
      for (const key of ['tds_by_quarter', 'exempt_allowances_section_10', 'deductions_chapter_via']) {
        const list = Array.isArray(data[key]) ? data[key].filter(x => x && typeof x === 'object') : [];
        if (list.length) rows.push([], [key.replace(/_/g, ' ')], ...ctx.sheet.objectsToRows(list));
      }
      if (Array.isArray(data.checks) && data.checks.length) rows.push([], ['checks'], ...data.checks.map(c => [String(c)]));
      const base = 'form16-' + (data.assessment_year ? String(data.assessment_year).replace(/[^\w-]+/g, '_') : 'extract');
      return [
        { name: base + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
        { name: base + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, 'Form 16') }
      ];
    },
    sample: { inputs: { doc: 'FORM NO. 16\n[See rule 31(1)(a)]\nPART A\nCertificate under Section 203 of the Income-tax Act, 1961 for tax deducted at source on salary\nCertificate No. ABCDEFG    Last updated on 15-Jun-2026\nName and address of the Employer: Sharma Traders Pvt Ltd, 12 MG Road, Pune 411001\nName and address of the Employee: Ramesh Kumar, Flat 4, Kothrud, Pune 411038\nPAN of the Deductor: AABCS1234A   TAN of the Deductor: PNES12345A   PAN of the Employee: ABCPK1234D\nAssessment Year: 2026-27   Period with the Employer: From 01-Apr-2025 To 31-Mar-2026\n\nSummary of amount paid/credited and tax deducted at source thereon in respect of the employee\nQuarter  Receipt Numbers  Amount paid/credited  Amount of tax deducted  Amount of tax deposited/remitted\nQ1  QRSTUVWX  240000.00  10348.00  10348.00\nQ2  QRSTUVWY  240000.00  10348.00  10348.00\nQ3  QRSTUVWZ  240000.00  10348.00  10348.00\nQ4  QRSTUVXA  240000.00  10348.00  10348.00\nTotal  960000.00  41392.00  41392.00\n\nPART B (Annexure)\nDetails of Salary Paid and any other income and tax deducted\nWhether opting out of taxation u/s 115BAC(1A)? Yes\n1. Gross Salary\n (a) Salary as per provisions contained in section 17(1)  960000.00\n (b) Value of perquisites u/s 17(2)  0.00\n (c) Profits in lieu of salary u/s 17(3)  0.00\n (d) Total  960000.00\n2. Less: Allowances to the extent exempt u/s 10\n (a) House rent allowance u/s 10(13A)  96000.00\n (h) Total amount of exemption claimed u/s 10  96000.00\n3. Total amount of salary received from current employer  864000.00\n4. Less: Deductions u/s 16\n (a) Standard deduction u/s 16(ia)  50000.00\n (b) Entertainment allowance u/s 16(ii)  0.00\n (c) Tax on employment u/s 16(iii)  2500.00\n5. Total amount of deductions u/s 16  52500.00\n6. Income chargeable under the head "Salaries"  811500.00\n7. Add: Any other income reported by the employee\n (a) Income from house property  0.00\n (b) Income under the head Other Sources  8000.00\n8. Total amount of other income reported by the employee  8000.00\n9. Gross total income  819500.00\n10. Deductions under Chapter VI-A\n (a) Deduction u/s 80C (PPF, life insurance premium)  Gross 150000.00  Deductible 150000.00\n (b) Deduction u/s 80D (health insurance premium)  Gross 25000.00  Deductible 25000.00\n (c) Deduction u/s 80TTA (interest on savings account)  Gross 8000.00  Deductible 8000.00\n11. Aggregate of deductible amount under Chapter VI-A  183000.00\n12. Total taxable income  636500.00\n13. Tax on total income  39800.00\n14. Rebate u/s 87A  0.00\n15. Surcharge  0.00\n16. Health and education cess @ 4%  1592.00\n17. Tax payable  41392.00\n18. Less: Relief u/s 89  0.00\n19. Net tax payable  41392.00\n\nVerification\nI, Priya Sharma, working in the capacity of Director, do hereby certify that a sum of Rs. 41392.00 [Rupees Forty One Thousand Three Hundred Ninety Two only] has been deducted and deposited to the credit of the Central Government.\nPlace: Pune   Date: 15-Jun-2026' } },
    tips: [
      'Employers issue Form 16 by 15 June; Part A comes from TRACES and Part B from payroll. Feed both parts — one PDF or two — and the quarterly TDS is set beside the annual figure.',
      'The PANs on the form are masked by the shield before the text is sent and put back when the answer returns, so the result still shows them. The salary figures travel as they are: that is what is being read.',
      'The checks list is the point. Total TDS in Part A should equal the tax payable in Part B and the credits in your Form 26AS; where they do not, the difference is what you chase before filing.',
      'Two employers in the year means two Forms 16. Read each on its own; the return needs both sets of figures added together, which the second employer’s form usually has not done.',
      'It reads, it does not compute. Whether a deduction was allowable, or whether the other regime would have cost less, is a question for the return, not the certificate.'
    ],
    faq: [
      { q: 'What is sent, and is my PAN stored?', a: 'The text of the form goes to the model through our gateway, with the PANs masked on your device before it leaves. Nothing about the call is kept except the count against your allowance; the form, the text and the answer are not stored.' },
      { q: 'Does it work with a password-protected Form 16?', a: 'Not while the password is on. Open it with the password TRACES set (usually your PAN in capitals followed by your date of birth) and save an unlocked copy, then choose that.' },
      { q: 'Can it file my return?', a: 'No. It puts the certificate’s figures into fields you can copy into the income-tax portal or hand to whoever files for you, and lists what to check first.' },
      { q: 'What if Part A and Part B disagree?', a: 'It reports both figures and names the difference under checks. Part A is what the department has received; Part B is what payroll says was deducted. The return is filed on the credit that actually reached the department, which Form 26AS confirms.' }
    ]
  };

  /* mount */
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.querySelector('[data-tool]');
      if (!root) return;
      const spec = window.AI_TOOLS[root.getAttribute('data-tool')];
      if (!spec || !window.MVRTool || !window.MVRTool.mountAI) return;
      spec.id = root.getAttribute('data-tool');
      try { window.MVRTool.mountAI(spec, root); }
      catch (e) { root.querySelector('.tool-io').innerHTML = '<div class="io-msg is-error">This tool needs browser features yours does not support. Try a current version of Chrome, Firefox, Edge or Safari.</div>'; }
    });
  }
})();
