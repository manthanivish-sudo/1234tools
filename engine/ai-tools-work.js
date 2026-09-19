/**
 * Batch 4 of the AI tools for business: the documents a company writes to
 * win work, hire, sell and be understood — quotations, WhatsApp templates,
 * review replies, contracts, job descriptions, CV screening, spreadsheet
 * formulas and translation.
 *
 * Same shape as engine/ai-tools.js, which also holds the mount code; this
 * file only adds specs to window.AI_TOOLS and never touches the DOM, so the
 * builder can run it in Node. Every prompt that expects structure says
 * "return only JSON" and names the keys.
 */
(function () {
  'use strict';
  window.AI_TOOLS = window.AI_TOOLS || {};
  const COMMON = ['/engine/zip.js', '/engine/sheet.js', '/engine/pdf-text.js', '/engine/pii.js', '/engine/render-ai.js', '/engine/ai-tools.js', '/engine/ai-tools-work.js'];
  const JSON_ONLY = 'Return only JSON, with no explanation before or after it and no markdown fences. Inside JSON strings write line breaks as \\n, never as a raw newline. Use null for anything not present; never invent a value.';
  const csvDownload = (name) => (data, ctx) => {
    const list = Array.isArray(data) ? data : (data.rows || data.items || [data]);
    const rows = ctx.sheet.objectsToRows(list);
    return [
      { name: name + '.csv', blob: () => new Blob([ctx.sheet.toCSV(rows)], { type: 'text/csv' }) },
      { name: name + '.xlsx', blob: () => ctx.sheet.writeXlsx(rows, name) }
    ];
  };
  const CURRENCIES = [{ value: 'INR', label: 'INR ₹' }, { value: 'GBP', label: 'GBP £' }, { value: 'USD', label: 'USD $' }, { value: 'EUR', label: 'EUR €' }, { value: 'AED', label: 'AED' }];
  const SYMBOL = { INR: '₹', GBP: '£', USD: '$', EUR: '€', AED: 'AED ' };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['quotation-writer'] = {
    title: 'Quotation & Proposal Writer',
    short: 'Quotation Writer',
    description: 'The facts of a deal — who it is for, what you will supply, the prices, the terms — written up as a quotation or a short proposal: a numbered line-item table, totals with tax, validity and the terms spelt out, ready to paste onto your letterhead.',
    keywords: ['quotation generator', 'business proposal writer ai', 'quotation format', 'price quote letter', 'proposal writer for small business', 'estimate writer', 'quotation with gst'],
    glyph: 'i-ai-quote', scripts: COMMON, action: 'Write', resultTitle: 'Quotation drafted',
    glyphSvg: '<symbol id="i-ai-quote" viewBox="0 0 24 24">\n  <path d="M6 2.8h7.6L18.6 8v13.2H6z"/>\n  <path d="M13.6 2.8V8h5" class="thin"/>\n  <path d="M8.5 11.5h7.5M8.5 14.5h4" class="thin"/>\n  <circle cx="15.3" cy="17.3" r="2.3" class="thin"/>\n  <path d="M14.2 17.3l.8.8 1.5-1.6" class="thin"/>\n</symbol>',
    privacy: 'The facts you type — client, items, prices, terms — are sent to the model. Leave out anything you would not put on the quotation itself.',
    inputs: [{ key: 'facts', label: 'The facts', type: 'text', rows: 10, placeholder: 'Who it is for; what you are supplying, each item with a quantity and a unit price; delivery, payment and warranty terms; anything the client asked for; what you want them to do next.' }],
    options: [
      { key: 'kind', label: 'Document', type: 'select', default: 'quotation', options: [{ value: 'quotation', label: 'Quotation — prices and terms' }, { value: 'proposal', label: 'Proposal — need, approach, scope, then prices' }, { value: 'estimate', label: 'Estimate — indicative, not binding' }] },
      { key: 'currency', label: 'Currency', type: 'select', default: 'INR', options: CURRENCIES },
      { key: 'tax', label: 'Tax', type: 'select', default: 'gst-extra', options: [{ value: 'gst-extra', label: 'GST extra, at the rate given' }, { value: 'gst-incl', label: 'Prices include GST' }, { value: 'vat-extra', label: 'VAT extra, at the rate given' }, { value: 'none', label: 'No tax line' }] },
      { key: 'validity', label: 'Valid for', type: 'text', default: '30 days' },
      { key: 'from', label: 'From', type: 'text', placeholder: 'Your name, role, company' }
    ],
    system: (o) => 'You write quotations and proposals for small and medium businesses in plain British English. Use only the facts given: prices, quantities, names and terms come from the facts, and anything missing is a placeholder in square brackets, never an invention. The arithmetic must be right: line amount = quantity × unit price; subtotal = the sum of the line amounts; tax ' + ({ 'gst-incl': 'is already inside the prices — show the GST content as a separate line but do not add it to the total', 'vat-extra': 'is VAT on the subtotal, at the rate given or [VAT rate] if none', none: 'is not shown; there is no tax line' }[o.tax] || 'is GST on the subtotal, at the rate given or [GST rate] if none') + '. Write every amount with the symbol ' + (SYMBOL[o.currency] || o.currency + ' ') + ', thousands separators' + (o.currency === 'INR' ? ' in the Indian lakh grouping' : '') + ' and two decimals. ' + (o.kind === 'estimate' ? 'It is an estimate: say plainly that the figures are indicative and that a firm quotation follows once [what must be confirmed] is confirmed. ' : '') + 'No preamble and no commentary: output the finished document only, with # headings for its sections.',
    prompt: (i, o) => 'Write a ' + ({ proposal: 'proposal', estimate: 'cost estimate' }[o.kind] || 'quotation') + '. Its parts, in order: a title line with a reference number and the date, as [Ref] and [Date] if not given; the client block; ' + (o.kind === 'proposal' ? 'a short section on the client’s need as you understand it, then the approach (what will be done and how), then the scope and deliverables, then the prices' : 'a one-line scope, then the prices') + ' as a numbered list, one line per item, columns separated by " | ": description | quantity and unit | unit price | line amount, with a bullet line before the list giving the column names; then the totals as bullets — Subtotal, the tax line, Total; a line "Valid for: ' + (o.validity || '30 days') + '"; the terms (delivery, payment, warranty, and anything else in the facts), each as a bullet; one closing sentence saying what to do next; ' + (o.from ? 'and a sign-off as: ' + o.from + '.' : 'and a sign-off with [Name], [Role], [Company].') + ' Currency: ' + o.currency + '.\n\nFACTS:\n' + i.facts,
    output: 'text', maxTokens: 2500,
    sample: { inputs: { facts: 'To: Mr Desai, Purchase Manager, Patel & Sons, Plot 4 GIDC, Vapi 396195.\nThey asked on 15 September 2026 for a quote for their new packing line.\nItems: Industrial rubber-coated gloves (ISI marked), 500 pairs at Rs 85 per pair; Safety goggles, anti-fog, 120 pieces at Rs 240 each; Delivery to Vapi by our transport, one lot, Rs 2,500.\nGST 18% extra on everything.\nDelivery within 7 working days of the purchase order. Payment 50% advance with the order, balance within 30 days of delivery. Gloves carry a 6-month replacement warranty against manufacturing defects. Prices firm for orders placed by 15 October.\nWe want a purchase order by email.' }, opts: { kind: 'quotation', currency: 'INR', tax: 'gst-extra', validity: '30 days', from: 'Vishal Sharma, Director, Sharma Traders Pvt Ltd, Pune' } },
    tips: [
      'Give every item with a quantity and a unit price and the arithmetic comes out right. The table is a numbered list with columns separated by |, which pastes cleanly into a document and splits into columns in a sheet.',
      'Anything the facts do not say — a reference number, a rate, a delivery address — appears as a [placeholder] rather than a guess. Search for "[" before it goes out.',
      'A proposal leads with the client’s need and your approach and puts prices last; a quotation puts prices first. Choose by how the client asked.',
      'Check the totals before sending. The model is told the arithmetic rules and gets them right in the ordinary case, but it is writing, not calculating.'
    ],
    faq: [
      { q: 'Can it put the quotation on my letterhead as a PDF?', a: 'It produces the text. Paste it into your letterhead template, or into the text to PDF tool on this site, which puts it on a page you can send.' },
      { q: 'Does it know my GST rate or my standard terms?', a: 'Only what you tell it. Keep your standard terms in a note and paste them into the facts each time; the tool writes from the facts in front of it, not from memory of you.' },
      { q: 'Is a quotation binding?', a: 'A quotation is an offer the client can accept; an estimate is indicative, and the wording says so when you choose that type. Whether either binds you depends on what it says and where you are — read it as the client will before sending.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  const WA_PURPOSES = [
    { value: 'order-update', label: 'Order update — confirmed, packed, shipped' }, { value: 'payment-reminder', label: 'Payment reminder' }, { value: 'offer', label: 'Offer or promotion' },
    { value: 'appointment', label: 'Appointment confirmation or reminder' }, { value: 'delivery', label: 'Delivery notice — out for delivery, delivered' }, { value: 'feedback', label: 'Feedback or review request' },
    { value: 'custom', label: 'Something else (describe it)' }
  ];
  const WA_LANGS = { en: 'English', hi: 'Hindi, in Devanagari', hinglish: 'Hindi written in Latin script (Hinglish), as customers type it', mr: 'Marathi', gu: 'Gujarati', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', kn: 'Kannada' };
  window.AI_TOOLS['whatsapp-template-writer'] = {
    title: 'WhatsApp Business Template Writer',
    short: 'WhatsApp Templates',
    description: 'Say what the message is for and what changes per customer, and get three to five WhatsApp Business message templates in Meta’s format — {{1}} placeholders, a category, sample values, buttons — with a note on what gets each one rejected at review.',
    keywords: ['whatsapp business template generator', 'whatsapp message template format', 'meta template approval', 'whatsapp utility template examples', 'whatsapp marketing template', 'order update whatsapp template'],
    glyph: 'i-ai-whatsapp', scripts: COMMON, action: 'Write templates', resultTitle: 'Templates written',
    glyphSvg: '<symbol id="i-ai-whatsapp" viewBox="0 0 24 24">\n  <path d="M4 4.5h16v11H10.5L6 19.5v-4H4z"/>\n  <path d="M9.3 7.5c-1.1 0-1.3.5-1.3 1.3v.6c0 .6-.4.9-1 .9.6 0 1 .3 1 .9v.6c0 .8.2 1.3 1.3 1.3M14.7 7.5c1.1 0 1.3.5 1.3 1.3v.6c0 .6.4.9 1 .9-.6 0-1 .3-1 .9v.6c0 .8-.2 1.3-1.3 1.3" class="thin"/>\n  <circle cx="12" cy="10.3" r=".9" class="fill"/>\n</symbol>',
    privacy: 'The brief is sent to the model. Describe the variables — customer name, order number — rather than pasting real customers’ details.',
    inputs: [{ key: 'brief', label: 'What the message must do', type: 'text', rows: 6, placeholder: 'What it tells the customer; what changes per message (name, order number, amount, date, link…); any wording you must use or avoid; what you want them to do next.' }],
    options: [
      { key: 'purpose', label: 'Purpose', type: 'select', default: 'order-update', options: WA_PURPOSES },
      { key: 'category', label: 'Category', type: 'select', default: 'auto', options: [{ value: 'auto', label: 'Let the tool choose' }, { value: 'UTILITY', label: 'UTILITY — about a transaction they already have' }, { value: 'MARKETING', label: 'MARKETING — promotions; needs opt-in' }] },
      { key: 'language', label: 'Language', type: 'select', default: 'en', options: Object.entries(WA_LANGS).map(([value, label]) => ({ value, label: label.split(',')[0].replace(/ written.*| in Devanagari/, '') })) },
      { key: 'count', label: 'How many', type: 'select', default: '4', options: [{ value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }] },
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'The business name as customers know it' }
    ],
    system: (o) => 'You write WhatsApp Business message templates for submission to Meta' + (o.brand ? ' on behalf of ' + o.brand : '') + '. The format: variables are {{1}}, {{2}}… numbered in order of first use with no gaps; every variable sits inside a sentence with fixed words around it — Meta and most providers reject a body that begins or ends with a variable, or that is mostly variables; the body is at most 1024 characters, with no newline or tab inside a variable and never more than four consecutive spaces; an optional header is one line of at most 60 characters with at most one variable; an optional footer is at most 60 characters with no variables; buttons are quick replies of at most 25 characters (three is the safe number), or one URL button, or one phone button; a template name is lower-case letters, numbers and underscores only. Category: UTILITY is for a specific transaction or account the customer already has — an order, a booking, a payment due — and must promote nothing; MARKETING is anything promotional or unprompted and needs the customer’s opt-in and an easy opt-out; a utility body with an offer inside is reclassified as marketing at review. Rejections come from vague bodies, placeholders that could mean anything, promotions without opt-out, and text in a language other than the one declared. Write the body in ' + (WA_LANGS[o.language] || 'English') + '. Use only what the brief gives; never invent a business detail. ' + JSON_ONLY,
    prompt: (i, o) => 'Write ' + (Number(o.count) || 4) + ' distinct templates for: ' + ((WA_PURPOSES.find(p => p.value === o.purpose) || {}).label || 'the purpose in the brief') + '.' + (o.category && o.category !== 'auto' ? ' The category must be ' + o.category + '; if the brief cannot honestly fit it, say so in approval_notes.' : ' Choose the category honestly for each.') + ' Vary them — short and plain, warmer, with a header, with buttons — so the business can pick one. Return a JSON array of objects with keys: name, category (MARKETING|UTILITY), language_code (Meta’s code, e.g. en, en_GB, hi, mr, gu, ta, te, bn, kn), header (string or null), body (with the {{n}} placeholders), footer (string or null), buttons (string; each button as TYPE: text, separated by "; ", or null), variables (string; "{{1}} = what it stands for", separated by "; "), sample_values (string; one plausible made-up value per variable, separated by "; "), approval_notes (one or two sentences: what could get this one rejected and how it is avoided).\n\nBRIEF:\n' + i.brief,
    output: 'table', maxTokens: 3000,
    downloads: csvDownload('whatsapp-templates'),
    sample: { inputs: { brief: 'Tell the customer their order is confirmed and when it will reach them. Changes per message: customer first name, order number, expected delivery date, a tracking link. We are KBK Mart, a grocery and household store in Gwalior. Friendly and short. Ask them to keep the phone reachable on the day. This is not an offer.' }, opts: { purpose: 'order-update', category: 'auto', language: 'en', count: '4', brand: 'KBK Mart' } },
    tips: [
      'Every variable gets an entry in the variables column saying what it stands for, and a sample value. Meta asks for both at submission.',
      'UTILITY is cheaper to send and reviewed more kindly, but only for a transaction the customer already has. Put an offer in a delivery notice and the reviewer reclassifies it as MARKETING.',
      'The approval notes name the usual rejection reasons for each template — a body that is mostly variables, a promotion without opt-out, a language that does not match the declared one.',
      'Meta’s rules move. What they were when this tool was written is built in; the Business Help Centre has the current list. Check before submitting.'
    ],
    faq: [
      { q: 'Will these be approved?', a: 'Usually, when the category is right and the body is specific. Review is done by Meta, partly by machine, for reasons the tool anticipates but cannot guarantee against. Read the approval notes, adjust, and submit through your provider.' },
      { q: 'Can it write in Hindi or Marathi?', a: 'Yes. Pick the language and the body comes in it, with the same {{n}} placeholders; the language_code column says what to declare. Hinglish is Hindi in Latin script, usually declared as en — check what your provider expects.' },
      { q: 'What about headers and buttons?', a: 'They are optional parts of a template. Where one helps — a tracking link as a URL button, Yes / No quick replies for an appointment — the template has it; where it would not, the field is empty.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['review-responder'] = {
    title: 'Customer Review Responder',
    short: 'Review Responder',
    description: 'Paste the reviews — one per line, or a CSV export — and get, for each one, the sentiment, the issue in a few words, a reply in your voice ready to post, and what to fix inside the business, as a table you can download.',
    keywords: ['reply to google reviews ai', 'customer review response generator', 'respond to negative review', 'review reply template', 'bulk review responses', 'amazon review reply writer'],
    glyph: 'i-ai-review', scripts: COMMON, action: 'Write replies', resultTitle: 'Replies written',
    glyphSvg: '<symbol id="i-ai-review" viewBox="0 0 24 24">\n  <path d="M4 4.5h16v11H10.5L6 19.5v-4H4z"/>\n  <path d="M12 6.6l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" class="thin"/>\n</symbol>',
    privacy: 'The reviews are sent to the model, reviewers’ names included where they are in the text. They are public already; your replies will be too.',
    inputs: [{ key: 'reviews', label: 'The reviews', type: 'text+file', accept: '.csv,.xlsx,.txt', rows: 10, maxRows: 40, placeholder: 'One review per line, with the rating and name first if you have them ("2 stars — Rahul: …"), or a CSV or Excel export with a header row. Up to 40 a run.' }],
    options: [
      { key: 'business', label: 'The business', type: 'text', placeholder: 'e.g. family restaurant in Pune; mobile repair shop in Leeds', hint: 'So the replies know what they are about' },
      { key: 'voice', label: 'Voice', type: 'select', default: 'warm', options: [{ value: 'warm', label: 'Warm and personal' }, { value: 'professional', label: 'Professional, measured' }, { value: 'brief', label: 'Brief — two sentences' }, { value: 'playful', label: 'Light, a little playful' }] },
      { key: 'contact', label: 'Take it offline via', type: 'text', placeholder: 'e.g. care@example.com or a phone number', hint: 'Used when a complaint needs a private conversation; sent as typed, since it must appear in the reply' },
      { key: 'signoff', label: 'Sign replies as', type: 'text', placeholder: 'e.g. Priya, Owner' }
    ],
    system: (o) => 'You reply to customer reviews on behalf of ' + (o.business || 'a small business') + ' in a ' + ({ professional: 'professional, measured', brief: 'brief — two sentences at most', playful: 'light, a little playful but never flippant about a complaint' }[o.voice] || 'warm, personal') + ' voice, British spelling. For every review: thank them, by name if a name is given; answer the specific thing they said, not a generic thing; never argue, never blame the customer, never dispute facts in public; never admit legal fault and never promise compensation the business has not offered; for a serious complaint, apologise for the experience and take it offline via ' + (o.contact || '[contact details]') + '; for praise, say what you will pass on and invite them back without a sales pitch; for a review that looks fake, abusive or about a different business, keep the reply short and neutral and say so in the internal action. Replies under 90 words. Use only facts in the review or the brief; anything else goes in square brackets. ' + (o.signoff ? 'Sign each reply: ' + o.signoff + '. ' : '') + JSON_ONLY,
    prompt: (i) => 'Reply to every review below, in order, keeping every one. Return a JSON array of objects with keys: review_no (1-based), reviewer (name as given, or null), rating (number, or null), sentiment (positive|neutral|negative|mixed), issue (up to 8 words; "none" for praise), reply, internal_action (what to fix or check inside the business, or "none"), priority (high|medium|low).\n\nREVIEWS:\n' + i.reviews,
    output: 'table', maxTokens: 4000,
    downloads: csvDownload('review-replies'),
    sample: { inputs: { reviews: '5 stars — Anjali M: Ordered a pressure cooker on Monday, it came Wednesday, well packed. The delivery boy even called ahead. Will order again.\n1 star — Rohit: Paid for express delivery and the parcel came 6 days late. Customer care number rang and rang. Never again.\n3 stars — Sunita Deshpande: Kurta quality is nice but the size chart is wrong, L fits like M. Exchange was easy though.\n4 stars — Farhan: Good prices on cleaning supplies, wish there was cash on delivery for orders over 2000.\n1 star — user4471: Worst shop in Indore, they cheated my cousin.' }, opts: { business: 'KBK Mart, an online grocery and household store in Gwalior', voice: 'warm', contact: 'care@kbkmart.example or 0751 2345678', signoff: 'Priya, KBK Mart' } },
    tips: [
      'The reply column is for the public; the internal action column is for you. A one-star review about a late parcel gets an apology and a way to reach you, and an action to check the courier — both from the same line.',
      'Give the business a sentence and a contact for taking complaints offline. Without the contact, the reply carries a [placeholder] you must fill before posting.',
      'A review that looks fake, or is about someone else, gets a short neutral reply and a note to flag it on the platform rather than argue with it.',
      'Rating and name are read from the line when they are there in any obvious form; a CSV export from Google or Amazon works as it comes.'
    ],
    faq: [
      { q: 'Should I post these as they are?', a: 'Read each one first. They are written from the review and your brief, not from what actually happened: where the model does not know (was the order really late?) it apologises for the experience rather than admitting a fact. If you know more, add it.' },
      { q: 'Can it reply in Hindi or Marathi?', a: 'Add "reply in the language of each review" to the business box and it will match each one, which is usually the right thing on Google.' },
      { q: 'Does it post the replies?', a: 'No. Copy each into the platform, or download the table and work through it.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  const DOC_TYPES = [
    { value: 'nda-mutual', label: 'NDA — mutual (both sides disclose)' }, { value: 'nda-oneway', label: 'NDA — one-way (you disclose)' }, { value: 'service', label: 'Service agreement' },
    { value: 'consultancy', label: 'Consultancy agreement (independent contractor)' }, { value: 'offer-letter', label: 'Offer letter (employment)' }, { value: 'leave-licence', label: 'Leave and licence / rental summary' }
  ];
  const DOC_CLAUSES = {
    'nda-mutual': 'the definition of Confidential Information and its exclusions; the purpose; each receiving party’s obligations; permitted disclosures, including where required by law; return or destruction; the term of the agreement and how long confidentiality survives it; no licence, warranty or obligation to proceed; remedies including injunctive relief',
    'nda-oneway': 'the definition of Confidential Information and its exclusions; the purpose; the Receiving Party’s obligations; permitted disclosures, including where required by law; return or destruction; the term and how long confidentiality survives it; no licence, warranty or obligation to proceed; remedies including injunctive relief',
    service: 'the services and service levels; term; fees, invoicing and payment, including late payment; the client’s obligations; intellectual property in the deliverables; confidentiality; data protection; warranties; limitation of liability; termination and its consequences; non-solicitation',
    consultancy: 'the services and deliverables; term; fees, expenses and invoicing; independent-contractor status (no employment; the consultant bears their own taxes and insurance); substitution and control; assignment of intellectual property; confidentiality; conflicts of interest; termination; non-solicitation',
    'offer-letter': 'position, reporting line and place of work; start date; probation; salary structure and pay dates; working hours and leave; benefits and statutory contributions; confidentiality and intellectual property; notice period; the conditions of the offer (documents, references, checks); how and by when to accept',
    'leave-licence': 'the premises and the permitted use; the licence period and any lock-in; the licence fee, the deposit and its refund; outgoings and maintenance; the licensor’s right of entry; restrictions on the licensee (no sub-letting, no structural change); termination and notice; the condition on handover; who bears registration and stamp duty; and a plain statement that it creates a licence, not a tenancy'
  };
  window.AI_TOOLS['contract-generator'] = {
    title: 'Contract, NDA & Offer Letter Generator',
    short: 'Contract Drafter',
    description: 'Name the parties and the terms and get a full first draft — a mutual or one-way NDA, a service or consultancy agreement, an offer letter, a leave-and-licence summary — with numbered clauses, defined terms and [brackets] where you still have to decide. A draft for your lawyer, not a substitute for one.',
    keywords: ['nda generator india', 'mutual nda template', 'service agreement generator', 'offer letter generator india', 'consultancy agreement template', 'leave and licence agreement draft', 'contract drafting ai'],
    glyph: 'i-ai-contract', scripts: COMMON, action: 'Draft', resultTitle: 'Draft ready — for a lawyer to review',
    glyphSvg: '<symbol id="i-ai-contract" viewBox="0 0 24 24">\n  <path d="M6 2.8h7.6L18.6 8v13.2H6z"/>\n  <path d="M13.6 2.8V8h5" class="thin"/>\n  <path d="M8.5 11.5h7.5M8.5 14.5h7.5" class="thin"/>\n  <path d="M8.5 18.6c.9-1.8 1.7-1.8 2.3 0s1.4 1.8 2.3 0M14.5 18.6h1.8" class="thin"/>\n</symbol>',
    privacy: 'The party names and terms you type are sent to the model. Nothing else is needed — leave out addresses and ID numbers until the draft is back.',
    inputs: [{ key: 'facts', label: 'Parties and terms', type: 'text', rows: 10, placeholder: 'Who the parties are (names, what kind of entity, where); what the deal is; money, dates, term and notice; anything either side insisted on; anything you want left out.' }],
    options: [
      { key: 'type', label: 'Document', type: 'select', default: 'nda-mutual', options: DOC_TYPES },
      { key: 'law', label: 'Governing law', type: 'select', default: 'IN', options: [{ value: 'IN', label: 'India' }, { value: 'UK', label: 'England and Wales' }] },
      { key: 'disputes', label: 'Disputes', type: 'select', default: 'courts', options: [{ value: 'courts', label: 'Courts of the place named' }, { value: 'arbitration', label: 'Arbitration — sole arbitrator' }, { value: 'mediation-courts', label: 'Mediation first, then courts' }] },
      { key: 'length', label: 'Length', type: 'select', default: 'full', options: [{ value: 'full', label: 'Full draft' }, { value: 'short', label: 'Short form — the essential clauses' }] }
    ],
    system: (o) => 'You draft commercial and employment documents for small businesses, as a first draft for a qualified lawyer to review. Governing law: ' + (o.law === 'UK'
      ? 'England and Wales. Where the document type calls for it, reflect: the written particulars an employee must receive under section 1 of the Employment Rights Act 1996 (an offer letter lists them or says they follow); that a confidentiality clause cannot prevent a protected disclosure under the Public Interest Disclosure Act 1998 or a report to a regulator; that a consultancy agreement must treat status (IR35 / off-payroll working), substitution and control honestly; UK GDPR for personal data; and that a restrictive covenant must go no wider than a legitimate interest needs.'
      : 'India. Where the document type calls for it, reflect: the Indian Contract Act 1872 (section 27 makes a post-termination non-compete on an employee void, so rely on confidentiality and non-solicitation instead); that the document may need stamp duty under the state Stamp Act and that a leave and licence in Maharashtra must be registered; the Arbitration and Conciliation Act 1996 for any arbitration clause, with a seat; the Digital Personal Data Protection Act 2023 for personal data; and, for an offer letter, the applicable Shops and Establishments Act, PF and ESI where they apply, gratuity, and a probation period stated plainly.')
      + ' Disputes: ' + ({ arbitration: 'arbitration by a sole arbitrator, with the seat, language and appointing procedure named', 'mediation-courts': 'good-faith mediation for a fixed period, then the courts of the place named' }[o.disputes] || 'the exclusive jurisdiction of the courts of the place named') + '. Conventions: British spelling; defined terms with initial capitals, each defined once; every clause numbered; parties described by role (Disclosing Party, Service Provider, Licensor) after they are first named; plain language, no Latin; each clause and sub-clause on its own line with a blank line between them; a signature block at the end. Use only the facts given: every fact not given is a square-bracketed placeholder saying what goes there, such as [registered office address] — never an invented figure, date or address. Begin with a line reading exactly: DRAFT — prepared by an AI tool from the facts supplied. Not legal advice. To be reviewed by a qualified lawyer before use. No commentary before or after the document.',
    prompt: (i, o) => 'Draft a ' + (o.length === 'short' ? 'short-form ' : '') + ((DOC_TYPES.find(t => t.value === o.type) || {}).label || 'agreement') + ' under the law of ' + (o.law === 'UK' ? 'England and Wales' : 'India') + '. Structure: the title; the date and the parties, with recitals; numbered clauses covering ' + (DOC_CLAUSES[o.type] || DOC_CLAUSES['nda-mutual']) + '; the general clauses (entire agreement, amendment, notices, assignment, severability, counterparts, governing law and disputes); the signature block. Use # for the title and ## for each clause heading.\n\nFACTS:\n' + i.facts,
    output: 'text', maxTokens: 6000,
    sample: { inputs: { facts: 'Mutual NDA between Sharma Traders Pvt Ltd, a private limited company in Pune, Maharashtra, and Nimbus IT Solutions LLP, an LLP in Mumbai.\nPurpose: evaluating whether Nimbus will build a warehouse and inventory system for Sharma Traders. Sharma will share stock data, supplier prices and customer lists; Nimbus will share its system design and pricing.\nEffective 1 October 2026. Discussions expected to last 6 months; confidentiality to survive for 3 years after the agreement ends.\nEach side names one contact for exchanges: Vishal Sharma (Director) for Sharma Traders and Meera Nair (Partner) for Nimbus.\nCourts at Pune.' }, opts: { type: 'nda-mutual', law: 'IN', disputes: 'courts', length: 'full' } },
    tips: [
      'This is a first draft, and its first line says so. A lawyer who starts from a draft with the deal already in it works faster and costs less than one who starts from nothing; that is the use of it.',
      'Everything you did not say is in [square brackets]. Search for "[" and decide each one; a placeholder must never survive into a signed document.',
      'Indian and English law differ where it matters — a post-employment non-compete is void in India; an English offer letter must give the statutory particulars — and the draft follows the law you pick. It does not know other jurisdictions.',
      'Writing a document does not stamp or register it. In India an agreement generally needs stamp paper of the state’s value, and a leave and licence in Maharashtra must be registered; the draft says who bears that, not that it is done.'
    ],
    faq: [
      { q: 'Is this legal advice?', a: 'No. It is a draft produced by a language model from what you typed, using the usual clauses for that kind of document. It can be wrong, incomplete or unsuitable for your situation, and it owes you no duty of care. Have a qualified lawyer in the relevant jurisdiction review it before anyone signs.' },
      { q: 'Why is the offer letter numbered like a contract?', a: 'Because once accepted it is one, in both countries. Numbered paragraphs make the notice period or the probation clause easy to point to later. If you would rather have prose, say so in the facts.' },
      { q: 'Can it draft a full rental agreement?', a: 'It drafts a leave and licence in the form used in Maharashtra, and a plain short rental agreement elsewhere. Tenancy law is local and detailed — deposits, notice, registration — and the draft flags what to check rather than pretending to know it all.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['job-description-writer'] = {
    title: 'Job Description Writer',
    short: 'JD Writer',
    description: 'The facts of a role — title, what they will do, what they must have, pay, where and when — written into a job description with responsibilities, requirements, nice-to-haves and a salary line, then checked for wording that puts good candidates off.',
    keywords: ['job description generator', 'jd writer ai', 'write a job description', 'inclusive job description checker', 'job advert writer india', 'job posting template'],
    glyph: 'i-ai-jd', scripts: COMMON, action: 'Write', resultTitle: 'Job description',
    glyphSvg: '<symbol id="i-ai-jd" viewBox="0 0 24 24">\n  <rect x="5" y="4" width="14" height="17" rx="1.5"/>\n  <path d="M9.5 4V2.8h5V4" class="thin"/>\n  <circle cx="12" cy="10.3" r="2.1" class="thin"/>\n  <path d="M8.2 17.5c0-2.3 1.7-3.6 3.8-3.6s3.8 1.3 3.8 3.6" class="thin"/>\n</symbol>',
    privacy: 'The role facts are sent to the model. There is rarely anything personal in them.',
    inputs: [{ key: 'facts', label: 'The role', type: 'text', rows: 8, placeholder: 'Title; what the company does; where the job is and whether remote; what they will do day to day; what they must have (experience, skills, licences, languages); what would be nice; pay and benefits; hours, reporting line, start date; how to apply.' }],
    options: [
      { key: 'market', label: 'Market', type: 'select', default: 'IN', options: [{ value: 'IN', label: 'India — CTC, LPA, notice period' }, { value: 'UK', label: 'UK — salary p.a., right to work' }] },
      { key: 'tone', label: 'Tone', type: 'select', default: 'plain', options: [{ value: 'plain', label: 'Plain and direct' }, { value: 'warm', label: 'Warm — a small team’s voice' }, { value: 'formal', label: 'Formal — a larger company’s' }] },
      { key: 'length', label: 'Length', type: 'select', default: 'standard', options: [{ value: 'standard', label: 'Standard — for a job board' }, { value: 'short', label: 'Short — for a WhatsApp or LinkedIn post' }] }
    ],
    system: (o) => 'You write job descriptions for ' + (o.market === 'UK' ? 'the UK market: salary as £ per annum or per hour, hours per week, holiday entitlement, right to work as a condition, and no requirement that cannot lawfully be asked (age, health, protected characteristics)' : 'the Indian market: pay as CTC in ₹ per annum or per month (LPA where the facts use it), notice period, and no requirement that has no bearing on the job (age, gender, marital status, religion, caste)') + ', in a ' + ({ warm: 'warm voice, as a small team would speak', formal: 'formal voice, as a larger company would' }[o.tone] || 'plain, direct voice') + ', British spelling. Use only the facts given; put anything missing in square brackets rather than inventing pay, benefits or claims about the company. Requirements are things the job genuinely needs; move preferences to nice-to-haves. Then check the wording — both what the facts said and what you wrote — for language that narrows the field without reason: gendered words (salesman, he), age proxies (young, digital native, fresh graduate where experience is what matters), ableist phrasing where not essential (must stand all day), superlatives and jargon (rockstar, ninja), and requirements stacked beyond what the role needs; say what to use instead. ' + JSON_ONLY,
    prompt: (i, o) => 'Write a ' + (o.length === 'short' ? 'short (under 150 words in the body) ' : '') + 'job description from these facts. Return JSON with keys: title, company_line (one sentence on the company), location_and_type (place; on-site, hybrid or remote; full-time, part-time or contract), summary (2–3 sentences), responsibilities (array of 5–8), requirements (array — must-haves only), nice_to_have (array), salary_and_benefits (string; "[salary]" if not given), hours_and_reporting (string), how_to_apply (string), inclusive_language_check (array of {phrase, why, use_instead}; empty if nothing was found), inclusive_verdict (one sentence), missing_facts (array of things a candidate would ask that the facts do not say).\n\nFACTS:\n' + i.facts,
    output: 'fields', maxTokens: 3000,
    downloads: (data) => {
      const line = (x) => x == null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x);
      const list = (a) => Array.isArray(a) ? a.map(x => '- ' + line(x)).join('\n') : line(a);
      const txt = [line(data.title), '', line(data.company_line), line(data.location_and_type), '', line(data.summary), '', 'Responsibilities', list(data.responsibilities), '', 'Requirements', list(data.requirements), '', 'Nice to have', list(data.nice_to_have), '', 'Salary and benefits', line(data.salary_and_benefits), '', 'Hours and reporting', line(data.hours_and_reporting), '', 'How to apply', line(data.how_to_apply), ''].join('\n');
      return [
        { name: 'job-description.txt', blob: () => new Blob([txt], { type: 'text/plain' }) },
        { name: 'job-description.json', blob: () => new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }
      ];
    },
    sample: { inputs: { facts: 'Sales Executive for Sharma Traders Pvt Ltd, Pune — we sell industrial safety gear and consumables to factories across Maharashtra. On-site at our MG Road office, with 3–4 days a week visiting customers in Pune and PCMC. We want a young, energetic salesman with 2–4 years of B2B sales, own two-wheeler, fluent Marathi and Hindi, comfortable with Excel and a CRM. Nice: experience selling to manufacturing plants; knowledge of PPE norms. Will manage 40 existing accounts, find new ones, prepare quotations, chase payments. Reports to the Sales Manager. CTC 4 to 5.5 LPA plus quarterly incentives, fuel allowance, PF. Six-day week, 9.30 to 6.30. Notice period 30 days. Apply by email to jobs@sharmatraders.example with a CV.' }, opts: { market: 'IN', tone: 'plain', length: 'standard' } },
    tips: [
      'Give the must-haves and the nice-to-haves separately, and say which is which. Every requirement that is really a preference costs you candidates who would have applied.',
      'The inclusive language check reads both what you wrote and what it wrote. "Young, energetic salesman" comes back with why and what to say instead; so does a list of ten requirements for a junior role.',
      'Pay stated plainly gets more and better applications than "competitive". If you truly cannot state it, the line stays as a [placeholder] for you to decide.',
      'The short version is for a post; the standard one for a job board. Download the .txt to paste anywhere.'
    ],
    faq: [
      { q: 'Is the inclusive language check a legal check?', a: 'No. It catches wording that narrows the field for no good reason and, in the UK, wording that could fall foul of the Equality Act 2010 — but it is a language check, not legal advice. Your HR adviser or lawyer decides what is lawful to ask.' },
      { q: 'Can it write in Hindi?', a: 'Ask for it in the facts. Most job boards take English; a Hindi or Marathi version for WhatsApp often gets more applicants for field roles.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['cv-screener'] = {
    title: 'CV Screener against a Job Description',
    short: 'CV Screener',
    description: 'Paste the job description and up to five CVs and get, for each candidate, a fit score with the reasoning, the requirements they meet, the gaps, and the questions to ask at interview. Decision support for a hiring manager: it must not be the only reason a candidate is rejected.',
    keywords: ['cv screening ai', 'resume screening tool', 'match cv to job description', 'candidate shortlisting ai', 'resume fit score', 'ats alternative small business'],
    glyph: 'i-ai-cv', scripts: COMMON, action: 'Screen', resultTitle: 'Screening notes — decision support, not a decision',
    glyphSvg: '<symbol id="i-ai-cv" viewBox="0 0 24 24">\n  <path d="M4 2.8h7.6L16.6 8v4.5M4 2.8v18.4h9"/>\n  <path d="M11.6 2.8V8h5" class="thin"/>\n  <circle cx="9.5" cy="11.5" r="1.8" class="thin"/>\n  <path d="M6.3 17c0-1.9 1.4-2.9 3.2-2.9s3.2 1 3.2 2.9" class="thin"/>\n  <circle cx="17.5" cy="16.5" r="2.8"/>\n  <path d="M19.6 18.6l2.2 2.2"/>\n</symbol>',
    privacy: 'The job description and the CVs are sent to the model. Candidates’ emails and phone numbers are masked on your device first; names, addresses and dates of birth are not, so remove those if you can.',
    inputs: [
      { key: 'jd', label: 'Job description', type: 'text', rows: 6, placeholder: 'Paste the JD, or the must-haves and nice-to-haves as a list.' },
      { key: 'cvs', label: 'CVs', type: 'text+file', accept: '.pdf,.txt,.md', rows: 12, placeholder: 'Paste 1 to 5 CVs, each separated by a line with only --- on it, or choose one CV as a PDF.' }
    ],
    options: [
      { key: 'weight', label: 'Weight most', type: 'select', default: 'balanced', options: [{ value: 'balanced', label: 'Balanced — as the JD reads' }, { value: 'skills', label: 'Skills and tools' }, { value: 'experience', label: 'Relevant experience' }, { value: 'potential', label: 'Potential — trajectory over years' }] }
    ],
    system: (o) => 'You screen CVs against a job description as decision support for a hiring manager. You do not make the decision, and your notes must be evidence a person can check. Score fit from 0 to 100 on the requirements in the job description only' + ({ skills: ', weighting skills and tools most heavily', experience: ', weighting directly relevant experience most heavily', potential: ', weighting trajectory and growth over years served' }[o.weight] || '') + '. Cite what in the CV supports each judgement. Ignore, and never infer or mention, age, gender, marital status, religion, caste, nationality, ethnicity, disability, appearance, photograph, home address, or the name of a school as a proxy for background; if a CV states them, do not use them. A career break is a question to ask, not a mark against. A claim you cannot verify from the CV (a percentage, a title) is a question to ask. Where a CV is thin rather than unsuitable, say so. ' + JSON_ONLY,
    prompt: (i) => 'Screen each CV below against the job description. CVs are separated by a line containing only ---. Return a JSON array with one object per candidate, in order, with keys: candidate (name as written, or "Candidate n"), fit_score (integer 0–100), reasoning (2–3 sentences citing the CV), matched_requirements (string; the requirements met, separated by "; "), gaps (string; requirements not evidenced, separated by "; "), strengths_beyond_jd (string or null), questions_to_ask (string; 3–5 interview questions separated by "; "), verify_before_offer (string; claims to check, or null), suggested_next_step (one of: interview, phone screen, hold, not a fit for this role — followed by a short reason).\n\nJOB DESCRIPTION:\n' + i.jd + '\n\nCVS:\n' + i.cvs,
    output: 'table', maxTokens: 4000,
    downloads: csvDownload('cv-screening'),
    sample: { inputs: { jd: 'Sales Executive, Sharma Traders, Pune. B2B sales of industrial safety gear to factories. Must have: 2–4 years of B2B field sales; own two-wheeler; fluent Marathi and Hindi; Excel and a CRM. Nice: selling to manufacturing plants; PPE knowledge. Manage 40 accounts, find new ones, prepare quotations, chase payments.', cvs: 'RAHUL PAWAR\nPune | rahul.pawar@example.com | 98220 11223\nSales Executive, Kirloskar Distributors, Pune (2023–present): field sales of bearings and lubricants to 60 factory accounts in Chakan and Bhosari; grew the territory 18% in FY25; quotations and follow-up in Zoho CRM; collections.\nSales Trainee, Bharat Hardware (2022–2023).\nB.Com, Pune University, 2022. Marathi, Hindi, English. Own two-wheeler.\n---\nSNEHA KULKARNI\nMumbai | sneha.k@example.com | 91670 44556\nInside Sales Associate, an ed-tech company (2021–2024): outbound calls, LeadSquared CRM, monthly targets met in 8 of 12 quarters. Career break 2024–2025 (family).\nMBA Marketing, 2021. Marathi, Hindi, English. Advanced Excel.\n---\nAMIT VERMA\nNagpur | amit.verma@example.com | 70200 99887\nTerritory Manager, PPE division of a multinational (2018–2025): sold safety gloves, respirators and eyewear to manufacturing plants across Vidarbha; managed a distributor network; 7 years of B2B. Hindi and English; basic Marathi. Owns a car. Salesforce.\nB.E. Mechanical, 2017.' }, opts: { weight: 'balanced' } },
    tips: [
      'The score is a starting point for a person, not a sort order for rejection. Read the reasoning and the gaps; a 55 with a career break and the right skills may be the best candidate in the pile.',
      'Emails and phone numbers are masked on your device before the CVs are sent and restored in the table. Names are not — the model needs them to label candidates — so paste no more than you need.',
      'The questions to ask column is the interview plan. Verify before offer is the list of claims to check against a reference or a certificate.',
      'Five CVs a run keeps the notes specific. For a larger pile, run in batches and compare scores across batches with some scepticism: they are relative to the JD, not to each other.'
    ],
    faq: [
      { q: 'Can I reject candidates on the strength of this?', a: 'Not on this alone, and every result says so in its title. It is decision support: a fast, consistent first read of a CV against the requirements, with its reasoning shown so you can disagree. A person should read every CV that is rejected and be able to say why in terms of the job. Automated rejection without human review may also be unlawful where you are — UK GDPR Article 22 and India’s DPDP Act both bear on it.' },
      { q: 'Is it biased?', a: 'Language models can carry biases from their training. The instructions tell it to score on the requirements only and to ignore protected characteristics, career breaks and proxies such as school names; the reasoning column lets you see whether it did. If a judgement looks wrong, it probably is — override it.' },
      { q: 'What happens to the CVs?', a: 'They are sent to the model through our gateway to be read and come back as the table; we store neither. Emails and phone numbers are masked on your device first. If your jurisdiction requires it — the UK does — tell candidates in your privacy notice that an AI tool assists screening.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  window.AI_TOOLS['excel-formula-helper'] = {
    title: 'Excel & Google Sheets Formula Helper',
    short: 'Formula Helper',
    description: 'Say what you want a cell to do — in words, with your column headers — and get the formula for Excel and for Google Sheets, an explanation of each part, the ways it can go wrong, and an alternative.',
    keywords: ['excel formula generator', 'google sheets formula help', 'write excel formula from description', 'sumifs xlookup help', 'excel formula explained', 'ai formula helper'],
    glyph: 'i-ai-formula', scripts: COMMON, action: 'Write formula', resultTitle: 'Formula',
    glyphSvg: '<symbol id="i-ai-formula" viewBox="0 0 24 24">\n  <rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/>\n  <path d="M3.5 9.5h17M9 9.5v10" class="thin"/>\n  <path d="M12.3 12.3h5.2l-3.3 2.6 3.3 2.6h-5.2" class="thin"/>\n</symbol>',
    privacy: 'Your description and the header cells you paste are sent to the model. Headers and one example row are enough; the data itself is not needed.',
    inputs: [
      { key: 'ask', label: 'What the cell should do', type: 'text', rows: 5, placeholder: 'e.g. Total of column F for the customer in H2, for the month in H3. Or: flag rows where the due date is past and the status is not Paid.' },
      { key: 'headers', label: 'Your headers and a sample row', type: 'text', rows: 4, required: false, placeholder: 'Paste the header row and one or two rows of data; tab-separated is fine. Say which sheet if there are several.' }
    ],
    options: [
      { key: 'app', label: 'For', type: 'select', default: 'both', options: [{ value: 'both', label: 'Excel and Google Sheets' }, { value: 'excel', label: 'Excel only' }, { value: 'sheets', label: 'Google Sheets only' }] },
      { key: 'excel', label: 'Excel version', type: 'select', default: '365', options: [{ value: '365', label: 'Microsoft 365 / 2021 or later (XLOOKUP, FILTER, LET)' }, { value: '2016', label: 'Excel 2016 / 2019 — no dynamic arrays' }] },
      { key: 'sep', label: 'Argument separator', type: 'select', default: ',', options: [{ value: ',', label: 'Comma — =SUM(A1, B1)' }, { value: ';', label: 'Semicolon — =SUM(A1; B1)' }] }
    ],
    system: (o) => 'You write spreadsheet formulas from a description, for ' + ({ excel: 'Microsoft Excel', sheets: 'Google Sheets' }[o.app] || 'both Microsoft Excel and Google Sheets') + '. Use "' + (o.sep === ';' ? ';' : ',') + '" as the argument separator. Prefer the simplest formula that is correct; use the modern functions (XLOOKUP, FILTER, LET, SUMIFS, TEXTJOIN) ' + (o.excel === '2016' ? 'only in the Google Sheets formula — the Excel formula must work in Excel 2016 without dynamic arrays (INDEX/MATCH, SUMPRODUCT, array-safe constructs)' : 'where they make the formula clearer') + '. Refer to the user’s actual columns and headers; where the layout is not given, state the assumption you made and use a range that is obviously a placeholder. Explain each part in plain words. Name the ways it can go wrong: numbers stored as text, dates stored as text, whole-column references that are slow, absolute against relative references when filled down, blanks, duplicates, case. British spelling. ' + JSON_ONLY,
    prompt: (i, o) => 'Write the formula. Return JSON with keys: understanding (one sentence restating what the formula does), excel_formula (string starting with =' + (o.app === 'sheets' ? ', or null since Excel was not asked for' : '') + '), sheets_formula (string starting with =' + (o.app === 'excel' ? ', or null since Google Sheets was not asked for' : '') + '), same_in_both (true if the two are identical), how_it_works (array of short steps, one per part of the formula), assumptions (array), pitfalls (array), alternative (string: another way to do it, with its formula and when to prefer it), example (string: with the sample rows, what the cell would show), fill_down_note (string or null).\n\nWHAT IT SHOULD DO:\n' + i.ask + (i.headers && String(i.headers).trim() ? '\n\nHEADERS AND SAMPLE ROWS:\n' + i.headers : ''),
    output: 'fields', maxTokens: 2000,
    sample: { inputs: { ask: 'In cell H4 I want the total Amount for the customer named in H2 during the month whose first day is in H3 (H3 holds a date such as 01/04/2026). The data is on the same sheet from row 2 down to row 500.', headers: 'Date\tCustomer\tProduct\tQty\tRate\tAmount\n03/04/2026\tPatel & Sons\tGloves\t200\t85\t17000\n05/04/2026\tMehta Suppliers\tGoggles\t50\t240\t12000\n02/05/2026\tPatel & Sons\tGloves\t100\t85\t8500' }, opts: { app: 'both', excel: '365', sep: ',' } },
    tips: [
      'Paste the header row and a couple of real-looking rows. The formula then refers to your columns by letter, and the example field shows what it would return on those rows — a quick way to see whether it understood you.',
      'Say which Excel you have. XLOOKUP and FILTER do not exist in Excel 2016, and the older formulas that stand in for them are different enough to matter.',
      'If your Excel expects semicolons between arguments — common on European settings — pick that and every formula comes out that way.',
      'The pitfalls list is worth reading once per formula: dates stored as text and numbers stored as text are behind most "it returns 0" questions.'
    ],
    faq: [
      { q: 'Will the formula be correct?', a: 'Usually, for the ordinary cases — lookups, conditional sums and counts, date arithmetic, splitting and joining text. The model reasons about your description and cannot see your sheet, so the assumptions list says what it took for granted; check those against reality, and test anything that feeds a decision on a row where you know the answer.' },
      { q: 'Can it write a macro or an Apps Script?', a: 'Formulas are its job, and the answer is formula-shaped. For VBA or Apps Script a general assistant is the better tool.' }
    ]
  };

  /* ------------------------------------------------------------------ */

  const LANGS = [
    { value: 'Hindi', label: 'Hindi — हिन्दी' }, { value: 'Marathi', label: 'Marathi — मराठी' }, { value: 'Gujarati', label: 'Gujarati — ગુજરાતી' }, { value: 'Tamil', label: 'Tamil — தமிழ்' },
    { value: 'Telugu', label: 'Telugu — తెలుగు' }, { value: 'Kannada', label: 'Kannada — ಕನ್ನಡ' }, { value: 'Bengali', label: 'Bengali — বাংলা' }, { value: 'Punjabi', label: 'Punjabi — ਪੰਜਾਬੀ' },
    { value: 'Malayalam', label: 'Malayalam — മലയാളം' }, { value: 'Arabic', label: 'Arabic — العربية' }, { value: 'French', label: 'French' }, { value: 'Spanish', label: 'Spanish' }, { value: 'German', label: 'German' }, { value: 'English', label: 'English' }
  ];
  window.AI_TOOLS['business-translator'] = {
    title: 'Business Document Translator',
    short: 'Translator',
    description: 'A letter, a notice, a price list, a policy — translated into Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Bengali, Punjabi, Malayalam, Arabic, French, Spanish or German at the formality you choose, with the names, codes and terms that should stay in English kept, and listed in a glossary.',
    keywords: ['translate business document', 'english to hindi business translation', 'english to marathi translator', 'translate letter to gujarati', 'formal translation ai', 'document translator with glossary', 'english to arabic business'],
    glyph: 'i-ai-translate', scripts: COMMON, action: 'Translate', resultTitle: 'Translation',
    glyphSvg: '<symbol id="i-ai-translate" viewBox="0 0 24 24">\n  <path d="M3.5 16.5l3.2-8.5 3.2 8.5M4.7 13.3h4"/>\n  <path d="M13 8.5h8M17 6.5v2M14.2 11.3c1 2.6 2.6 4.4 5.8 5.6M19.8 11.3c-1 2.6-2.6 4.4-5.8 5.6" class="thin"/>\n</symbol>',
    privacy: 'The document’s text is sent to the model. A PDF is read here and only its text goes.',
    inputs: [{ key: 'doc', label: 'Document', type: 'text+file', accept: '.pdf,.txt,.md', rows: 12, placeholder: 'Paste the text or choose a PDF. Any language in; the tool detects it.' }],
    options: [
      { key: 'to', label: 'Into', type: 'select', default: 'Hindi', options: LANGS },
      { key: 'formality', label: 'Register', type: 'select', default: 'formal', options: [{ value: 'formal', label: 'Formal — official letters, notices' }, { value: 'neutral', label: 'Neutral — everyday business' }, { value: 'informal', label: 'Informal — messages to known customers' }] },
      { key: 'keep', label: 'Keep in English', type: 'text', placeholder: 'brand names, product names, technical terms…', hint: 'Company names, codes, amounts and dates are kept anyway' },
      { key: 'script', label: 'Script', type: 'select', default: 'native', options: [{ value: 'native', label: 'The language’s own script' }, { value: 'latin', label: 'Latin script, as typed on a phone (Hinglish-style)' }] }
    ],
    system: (o) => 'You translate business documents into ' + o.to + (o.script === 'latin' ? ', written in Latin script the way speakers of ' + o.to + ' type it on a phone' : ', in its own script') + ', in a ' + ({ neutral: 'neutral register: polite, not stiff — everyday business', informal: 'informal register: the familiar forms of address where the language has them, as a shop messages a regular customer' }[o.formality] || 'formal register: the respectful forms of address (आप, vous, usted, Sie) and the vocabulary of official correspondence') + '. Translate meaning, not words: a payment reminder must read as one a native speaker would send. Keep the document’s structure — headings, paragraphs, lists, tables as lines — and keep exactly as they are: company, brand and product names, product codes and invoice numbers, amounts and currency symbols, dates, email addresses and URLs, and legal or technical terms of art that have no standard equivalent in ' + o.to + (o.keep ? ', and these: ' + o.keep : '') + '. A person’s name may be written the way ' + o.to + ' writes names (श्री देसाई for Mr Desai) where that is the convention. Placeholders such as [[EMAIL_1]] are values; copy them unchanged. Do not add, omit or soften content. Output the translation only, then a line "# Glossary" and a bulleted list of every English term you kept, each as: the term — a short gloss in ' + o.to + '. No other commentary.',
    prompt: (i, o) => 'Translate this into ' + o.to + '. Detect the source language.\n\nDOCUMENT:\n' + i.doc,
    output: 'text', maxTokens: 4000,
    sample: { inputs: { doc: 'Subject: Reminder — Invoice INV-2026-0417\n\nDear Mr Desai,\n\nOur invoice INV-2026-0417 for Rs 35,990, dated 3 April 2026, was due on 3 May and remains unpaid. We value our relationship with Patel & Sons and would be grateful for payment within 7 days, or a call to agree a date.\n\nBank details are on the invoice. GST at 18% is included in the amount.\n\nYours sincerely,\nVishal Sharma\nSharma Traders Pvt Ltd' }, opts: { to: 'Hindi', formality: 'formal', keep: 'GST', script: 'native' } },
    tips: [
      'Formal is right for anything with a letterhead; informal for a WhatsApp message to a customer you know. The register changes the forms of address, not just the tone.',
      'Company names, codes, amounts and dates stay as they are; a person’s name is written the way the language writes it. The glossary at the end lists each English term that was kept, with a gloss — so the reader knows what "GST" means without you translating it badly.',
      'Latin script matters for Indian languages on phones: many customers read Hinglish faster than Devanagari. Pick it for messages, not for documents.',
      'A long PDF is fine up to about 40 pages of text. Check numbers and dates in the translation against the original; they are copied, not translated, but check anyway.'
    ],
    faq: [
      { q: 'How good is the translation?', a: 'Good for business prose in the major languages, and readable in all of them; not a certified translation. For a contract, a notice with legal effect, or anything a court or a government office will read, have a professional translator check it.' },
      { q: 'Can it translate from Hindi into English?', a: 'Yes — choose English as the target. The source language is detected, whatever it is.' },
      { q: 'Is the document stored?', a: 'No. The text goes to the model through our gateway, the translation comes back, and we keep neither. A PDF is read on your device and never uploaded.' }
    ]
  };
})();
