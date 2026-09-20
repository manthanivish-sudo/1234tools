/**
 * Collections, second batch.
 *
 * Same shape as build/collections.js, kept in its own file so it can be
 * written and reviewed without touching the ten already shipped. The
 * loader in build/collections.js concatenates this array onto its own;
 * everything downstream — the hub, the home-page chip row, the sitemap
 * and the counts — follows from that.
 *
 * Four more people and two more jobs. The people are the ones who write
 * in: a shop in India doing its own GST, a landlord who has just found
 * out that Making Tax Digital measures gross rent, a student in results
 * season, and whoever ends up doing the marketing. The jobs are the two
 * that are nobody's speciality and everybody's fortnight.
 *
 * Every path below is a real page. A path that does not resolve stops
 * the build rather than shipping a dead link.
 */
'use strict';

const COLLECTIONS = [
  /* ---------------------------------------------------------------- */
  /* by role                                                           */
  /* ---------------------------------------------------------------- */
  {
    slug: 'shopkeepers', kind: 'role', glyph: 'i-label-pdf',
    name: 'Shops, traders and distributors',
    title: 'Free tools for shops, traders and distributors',
    lede: 'Estimates, challans, e-invoices and the GST behind them — built from the sheet you already keep, and without a per-user licence.',
    intro: [
      'A counter has no accounts department and all of the paperwork of one. An estimate becomes a challan, the challan becomes an invoice, the invoice becomes a line in the day book, and the same twelve rows are typed out four times by four people. Most of what looks like bookkeeping in a shop is retyping, and every retype is a chance for a rate or an HSN code to quietly change between one document and the next.',
      'These tools take the sheet once. The CGST and SGST against IGST split is worked out from the state codes inside the two GSTINs rather than from a box somebody ticks, so a document cannot claim an intra-state split while the buyer sits in another state. Everything except the AI tools runs in your browser: a price list, a customer ledger or a year of day books is read on your own machine and goes nowhere. Rates sit in one marked place per tool with the date they were last checked against the CBIC, because they move.'
    ],
    groups: [
      { name: 'Over the counter', blurb: 'The documents a single sale actually produces.', tools: ['/pdf/quotation-pdf/', '/pdf/delivery-challan-pdf/', '/pdf/invoice-pdf/', '/pdf/purchase-order-pdf/'] },
      { name: 'GST, and the parts of it that bite', blurb: 'The rate, the code, the JSON and the monthly match.', tools: ['/india/gst-calculator/', '/ai/hsn-gst-finder/', '/business/einvoice-json/', '/business/gst-reconciler/', '/business/id-validator/', '/india/tds-calculator/'] },
      { name: 'Stock, price and the margin on it', blurb: 'What a line earns, and what the shop has to sell to cover its costs.', tools: ['/business/profit-margin/', '/business/discount-calculator/', '/business/commission-calculator/', '/business/break-even/', '/pdf/label-pdf/', '/qr/qr-bulk-generator/'] },
      { name: 'The books and the money owed', blurb: 'Who has paid, who has not, and what Tally is going to want back.', tools: ['/business/bookkeeping/', '/business/receivables-ageing/', '/business/bank-reconciliation/', '/ai/scanned-invoice-extractor/', '/business/tally-converter/', '/business/sheet-merge/'] },
      { name: 'What the customer sees', blurb: 'Listings, replies and the message that goes out on WhatsApp.', tools: ['/ai/product-listing-writer/', '/ai/whatsapp-template-writer/', '/ai/review-responder/', '/ai/business-translator/'] }
    ],
    faq: [
      { q: 'Do I have to move off Tally?', a: 'No, and nothing here asks you to. The converter goes both ways: a spreadsheet of sales, purchases, receipts and payments becomes Tally import XML with its vouchers, party ledgers and stock items, and Tally’s own exported XML comes back out as something Excel will open. Everything else works from an ordinary spreadsheet. These are meant to sit beside whatever you already run.' },
      { q: 'Does the e-invoice tool upload the invoice for me?', a: 'No. It builds the JSON in the IRP’s schema 1.1 and checks it first — GSTIN format, PIN codes, HSN lengths, and whether the CGST and SGST or IGST split agrees with the state codes — so the portal has nothing to reject. Uploading the file and getting the IRN back is still done on the portal or through your GSP.' },
      { q: 'Where does my customer list end up?', a: 'Nowhere, for anything that runs in the browser. The file is opened by your own browser, the result is written there, and closing the tab loses both unless you saved them. The AI tools are the exception: they send the text you give them to a model, say so at the top of the page, and show you exactly what is going before it goes.' }
    ],
    related: ['small-business', 'accountants', 'going-paperless']
  },
  {
    slug: 'landlords', kind: 'role', glyph: 'i-home',
    name: 'Landlords and property',
    title: 'Free tools for landlords',
    lede: 'Work out whether Making Tax Digital catches you, then turn the bank statement and the receipts into figures a quarterly update will take.',
    intro: [
      'Letting is the trade where the tax threshold is measured on the money passing through rather than the money you keep. Making Tax Digital for Income Tax counts gross rent — before the mortgage interest, before the agent’s commission, before the boiler — and adds it to the turnover of any self-employment you also have. Two flats and a bit of freelance work can put somebody inside a band while they are certain they are nowhere near one.',
      'So the first job is arithmetic on that single number, and the second is keeping records that can answer it four times a year instead of once. The tools here do both: work out where you stand and from which April, then map your own expense headings onto the standard property headings and cut the year into its quarters. Thresholds and dates sit in one marked block with the date they were last checked and a link to the gov.uk page that settles it, and nothing about a tenant is sent anywhere by the tools that run in your browser.'
    ],
    groups: [
      { name: 'Are you in, and from when?', blurb: 'The gross-income question, before anything else is worth doing.', tools: ['/business/mtd-checker/', '/business/mtd-quarterly-update/'] },
      { name: 'Rent in, costs out', blurb: 'A statement and a pile of receipts, turned into rows you can total by property.', tools: ['/ai/bank-statement-categoriser/', '/ai/receipt-batch-reader/', '/ai/scanned-invoice-extractor/', '/business/bookkeeping/', '/business/bank-reconciliation/', '/business/sheet-merge/'] },
      { name: 'The tenancy itself', blurb: 'The documents, the arrears and the letter you would rather not write.', tools: ['/ai/contract-generator/', '/pdf/pdf-signature/', '/pdf/invoice-pdf/', '/business/receivables-ageing/', '/ai/business-writer/'] },
      { name: 'The borrowing, and whether it is worth it', blurb: 'What the mortgage costs over its life, and what the property has actually returned.', tools: ['/finance/loan-payment/', '/business/amortization-schedule/', '/business/roi/', '/business/cagr/', '/finance/compound-interest/'] },
      { name: 'Paperwork you have to keep', blurb: 'Certificates, inventories and photographs, filed as documents rather than as a camera roll.', tools: ['/image/image-to-pdf/', '/pdf/merge-pdf/', '/pdf/pdf-page-numbers/', '/ai/document-summariser/', '/time/date-difference/'] }
    ],
    faq: [
      { q: 'I have flats and a job. Does the salary count?', a: 'No. Employment income, pensions, dividends, savings interest and capital gains are all outside qualifying income. What counts is gross rent from every property business plus turnover from every trade, added together before a single expense is taken off. That is the definition people get wrong, and it is why the checker asks for gross figures and says so on every field.' },
      { q: 'Which expense headings does the quarterly update use?', a: 'The standard property headings — the wording you would recognise from the paper pages — and your own category names are mapped onto them, so you do not have to rename anything in the spreadsheet you already keep. Overseas property uses the same headings as UK property here, which is a simplification the page states rather than hides.' },
      { q: 'Can I file the update from here?', a: 'Not yet, and we will not pretend otherwise. These work out the figures and show you every row behind each one, which is the part that takes the evening. Filing has to go through software HMRC has recognised — a vendor registration, their tests, and fraud prevention headers on every call. That is an approval, not a feature, and we are working through it.' }
    ],
    related: ['going-digital', 'freelancers', 'going-paperless']
  },
  {
    slug: 'students', kind: 'role', glyph: 'i-learn',
    name: 'Students and exam candidates',
    title: 'Free tools for students and exam candidates',
    lede: 'Marks into percentages, CGPA into whatever your university actually uses, attendance kept above the line, and the assignment handed in as one file.',
    intro: [
      'Two numbers cause most of the confusion in a results season, and neither is the marks. A percentile is not a percentage: it is where you came against everyone else who sat the paper, which is how a score in the eighties turns into a ninety-nine point something. And there is no universal formula for turning a CGPA into a percentage — CBSE multiplies by 9.5, VTU and GTU publish their own, some universities use a conversion table that no calculator can reproduce, and a figure worked out with somebody else’s rule is one an admissions office will not accept.',
      'Every converter here prints the rule it applied next to the answer, so you can check it against your own handbook before the number goes on a form. The rest is the ordinary machinery of a term: an attendance percentage that has to stay above a threshold, a deadline that is closer than it feels, a calculator, and a folder of photographs that the submission portal will only take as one PDF, under a size limit it does not negotiate.'
    ],
    groups: [
      { name: 'Marks, grades and what they convert to', blurb: 'With the formula printed beside the answer, because there is more than one.', tools: ['/education/marks-percentage/', '/education/cgpa-to-percentage/', '/education/sgpa-to-cgpa/', '/utilities/gpa-calculator/', '/education/percentile-rank/'] },
      { name: 'Staying on the right side of the rules', blurb: 'Attendance, deadlines, and how many days are actually left.', tools: ['/education/attendance-calculator/', '/education/exam-countdown/', '/time/countdown-timer/', '/time/date-difference/', '/time/stopwatch-timer/'] },
      { name: 'The sums themselves', blurb: 'The calculator work a course throws at you, with the working shown.', tools: ['/mathematics/scientific-calculator/', '/mathematics/quadratic-solver/', '/mathematics/statistics/', '/mathematics/fraction-calculator/', '/mathematics/percentage/', '/mathematics/ratio-calculator/'] },
      { name: 'Handing it in', blurb: 'One file, the right way up, under the size limit the portal enforces.', tools: ['/image/image-to-pdf/', '/pdf/merge-pdf/', '/pdf/rotate-pdf/', '/pdf/split-pdf/', '/image/image-compressor/', '/text/word-counter/'] },
      { name: 'Reading, writing and the forms', blurb: 'Help with the text, and the photograph every application asks for.', tools: ['/ai/ncert-solution-writer/', '/ai/document-summariser/', '/ai/business-translator/', '/text/readability-score/', '/image/passport-photo/'] }
    ],
    faq: [
      { q: 'Which CGPA formula does it use?', a: 'Whichever you choose. The ten-point multiplication is the most common default in India and CBSE’s × 9.5 applies to school board results, but VTU, GTU and a plain ten-point scale are all there and you can type in your own. Where a university publishes a conversion table rather than a formula, no calculator can reproduce it and the page tells you to use the table.' },
      { q: 'Is a percentile the same as a percentage?', a: 'No, and the difference shows up in an admissions letter. A percentage is your marks out of the total and depends only on you. A percentile is the share of candidates who scored below you, so it depends entirely on who else sat the paper — the same marks give a different percentile in a different year.' },
      { q: 'Does any of this need an account?', a: 'Only the AI tools, which are the ones that send what you type to a model; every page says which kind it is in the first line. The converters, the calculators and the PDF tools run in your browser, so there is nothing to sign up for and they keep working once the page has loaded even if the hostel wifi does not.' }
    ],
    related: ['schools', 'start-of-term', 'going-paperless']
  },
  {
    slug: 'marketers', kind: 'role', glyph: 'i-target',
    name: 'Marketing and content',
    title: 'Free tools for marketing and content work',
    lede: 'A draft to edit rather than a blank page, images at the size each place actually wants, and the tags, slugs and codes that go out with a campaign.',
    intro: [
      'The writing is rarely what eats the day. The day goes on the same photograph at seven sizes, a QR code for the print run, a slug nobody agreed on, a title tag that has to fit, and exporting the lot again because somebody wanted it lighter. That work is mechanical, it is most of what is gathered here, and none of it needs a subscription.',
      'The writing tools are the exception and they are plain about what they are: a structured first draft from the brief you gave them, to be cut and corrected, not copy to publish unread. They send what you type to a model and say so on the page. The image, markup and QR tools send nothing at all — they are canvas and text operations in your own browser, which is why an unreleased product shot or an embargoed announcement can go through them without a conversation about where it went.'
    ],
    groups: [
      { name: 'The first draft', blurb: 'A page with something on it, in the words of your own brief.', tools: ['/ai/blog-writer/', '/ai/seo-writer/', '/ai/ad-copy-writer/', '/ai/landing-page-writer/', '/ai/email-campaign-writer/', '/ai/social-post-writer/'] },
      { name: 'Saying it the same way every time', blurb: 'Tone held steady across people, channels and languages.', tools: ['/ai/brand-voice-guide/', '/ai/business-translator/', '/ai/review-responder/', '/ai/whatsapp-template-writer/', '/ai/product-listing-writer/'] },
      { name: 'Images, at the sizes each place wants', blurb: 'Crop, resize and compress forty at a time, without uploading one of them.', tools: ['/image/social-media-resizer/', '/image/bulk-image-resizer/', '/image/image-compressor/', '/image/image-converter/', '/image/image-cropper/', '/image/background-remover/', '/image/color-palette-extractor/'] },
      { name: 'What a crawler reads', blurb: 'The markup, the slug, the icon and the length of the thing.', tools: ['/developer/meta-tag-generator/', '/developer/slug-generator/', '/developer/favicon-generator/', '/text/readability-score/', '/text/word-counter/', '/image/svg-optimizer/'] },
      { name: 'Campaigns that leave the screen', blurb: 'Codes for print, checked before the print run rather than after it.', tools: ['/qr/qr-code-generator/', '/qr/qr-bulk-generator/', '/qr/qr-code-scanner/', '/business/mail-merge/', '/image/meme-generator/'] }
    ],
    faq: [
      { q: 'Will the AI tools write something I can publish?', a: 'Not unread. They turn a brief into a structured draft — the sections, the angle, the claims you supplied — and what is left is the part that needs a person: cutting it, checking anything that looks like a fact, and making it sound like you rather than like a draft. Treat the output as the thing you edit.' },
      { q: 'Do the image tools upload my photographs?', a: 'No. They are canvas operations in your own browser, so a batch resize runs as fast as your laptop rather than as fast as your upload, and there is no queue and no limit on how many. It also means the shot that has not been announced yet can go through them.' },
      { q: 'Can I put a logo in the middle of a QR code?', a: 'Yes, and the generator checks it rather than trusting it. Higher error correction survives a covered centre but makes the code denser — level M suits screens, Q or H is what you want for anything printed or stickered — and the page decodes its own output back to the text you typed, logo and colours included, before you download it. Scan the printed proof at its real size too.' }
    ],
    related: ['small-business', 'developers', 'freelancers']
  },

  /* ---------------------------------------------------------------- */
  /* by task                                                           */
  /* ---------------------------------------------------------------- */
  {
    slug: 'year-end', kind: 'task', glyph: 'i-business-days',
    name: 'Get through the year end',
    title: 'Year end: agreeing the balances, closing the books and the paperwork after',
    lede: 'Reconcile what can be reconciled, post the adjustments nobody does monthly, produce the statements, and file the pack somebody will ask for in two years.',
    intro: [
      'Almost nothing that takes time at a year end is in the profit and loss. The profit and loss is a consequence — get the postings right and it falls out. The time goes on the balance sheet: the balances that have to be agreed against something outside the books, the invoice that belongs to the year just ended rather than the one that has started, and the machine bought in October that has had nothing charged against it yet.',
      'Which is why the order matters more than the tools do. Agree the cash and the debtors first, because every later mistake is cheaper to find once those are fixed; then the adjustments; then the statements; then the figures the returns want. Each step here hands the next an ordinary spreadsheet you can open and read. That is deliberate: nothing passes between these tools that you cannot see and change.'
    ],
    groups: [
      { name: '1 · Agree what can be agreed', blurb: 'The balances that have to match something outside the ledger.', tools: ['/business/bank-reconciliation/', '/business/receivables-ageing/', '/business/gst-reconciler/', '/business/sheet-merge/'] },
      { name: '2 · The adjustments nobody posts monthly', blurb: 'Wear, timing, and the people who left during the year.', tools: ['/business/depreciation/', '/business/amortization-schedule/', '/business/full-final-settlement/', '/business/employer-cost/'] },
      { name: '3 · Close the books and read them', blurb: 'Trial balance, statements, and what the year actually looks like.', tools: ['/business/bookkeeping/', '/business/business-ratios/', '/business/profit-margin/', '/business/cagr/', '/business/npv-irr/'] },
      { name: '4 · The returns and the tax', blurb: 'The figures each form wants, with every row behind them showing.', tools: ['/business/vat-return/', '/business/mtd-quarterly-update/', '/india/advance-tax/', '/india/india-income-tax/', '/ai/form16-reader/'] },
      { name: '5 · File the evidence', blurb: 'The pack you will be asked for long after you have forgotten the year.', tools: ['/business/accounting-converter/', '/business/tally-converter/', '/pdf/merge-pdf/', '/pdf/pdf-page-numbers/', '/pdf/pdf-signature/'] }
    ],
    faq: [
      { q: 'Where does the trial balance come from?', a: 'From the bookkeeping tool, which is a real double-entry ledger rather than a spreadsheet with subtotals: every posting has two sides, so the trial balance agrees by construction and a difference means a posting is wrong rather than a sum. The profit and loss and the balance sheet come out of the same book, and any figure on them can be followed back to the entries that made it.' },
      { q: 'Which depreciation method does it use?', a: 'Straight line, reducing balance, sum of years’ digits or units of production, on the cost, life and residual you give it, with the schedule laid out year by year. It is the accounting charge and nothing more: for UK corporation tax depreciation is added back and replaced by capital allowances, which is a separate computation the page points you at rather than guesses.' },
      { q: 'Can I hand this to an accountant?', a: 'That is what the converters are for. The bookkeeping tool writes the whole book to a file you keep, the statements come out as spreadsheets, and the Tally and package converters move a day book between the shapes different software expects. Nothing ends up in a format only this site can read.' }
    ],
    related: ['accountants', 'month-end', 'small-business']
  },
  {
    slug: 'going-paperless', kind: 'task', glyph: 'i-image-to-pdf',
    name: 'Get the paper off the desk',
    title: 'Going paperless: reading the pile, filing it, and taking out what should not travel',
    lede: 'Photographs of receipts read into rows, loose scans merged into one document, and the details you did not mean to share taken out before it goes.',
    intro: [
      'A photograph of a receipt is not a record. It is a picture of one, and it stays a picture until something reads the figures off it and puts them in a row with a date, a supplier and an amount. This is where most paperless projects stall: the paper is off the desk and in a folder of forty thousand images, and nobody can answer a question with it. The scanning was the easy half.',
      'So the order is read it, file it, then check that what you filed is not carrying more than you meant. Reading is the part a person should not do by hand and the only part that uses a model. The merging, rotating, page numbering, redacting and metadata stripping all happen in your browser and send nothing, which matters more than usual here, because a pile of paper generally contains a bank statement, somebody’s ID and at least one thing you would not email.'
    ],
    groups: [
      { name: '1 · Read the paper', blurb: 'Photographs and scans turned into rows with figures in them.', tools: ['/ai/receipt-batch-reader/', '/ai/scanned-invoice-extractor/', '/ai/invoice-extractor/', '/ai/bank-statement-categoriser/', '/ai/kyc-document-reader/', '/ai/form16-reader/'] },
      { name: '2 · Make it one document', blurb: 'From a folder of photographs to something you would send somebody.', tools: ['/image/image-to-pdf/', '/pdf/merge-pdf/', '/pdf/rotate-pdf/', '/pdf/pdf-organise/', '/pdf/split-pdf/', '/pdf/extract-pdf-pages/', '/pdf/pdf-page-numbers/'] },
      { name: '3 · Take out what should not travel', blurb: 'Before it goes to an accountant, a client or a portal.', tools: ['/image/blur-redact/', '/image/exif-remover/', '/image/exif-viewer/', '/pdf/pdf-metadata/', '/pdf/delete-pdf-pages/', '/pdf/watermark-pdf/'] },
      { name: '4 · Keep it findable and small', blurb: 'What the folder will look like to somebody opening it in two years.', tools: ['/image/image-compressor/', '/pdf/pdf-inspector/', '/pdf/text-to-pdf/', '/ai/data-cleaner/', '/business/sheet-merge/'] },
      { name: '5 · Into the books', blurb: 'Where the rows were always meant to end up.', tools: ['/business/bookkeeping/', '/business/bank-reconciliation/', '/business/mtd-checker/', '/pdf/pdf-signature/'] }
    ],
    faq: [
      { q: 'Can it read a photograph taken on a phone?', a: 'That is what the scanned-invoice and receipt readers are for: a crooked, shadowed photograph of a faded thermal receipt, handled as an image rather than as text. They are slower and cost more per document than reading a file that is already digital, so use the plain extractor where you have a proper PDF and keep these for the paper.' },
      { q: 'What actually leaves my machine?', a: 'Only what the reading tools send, and each shows you exactly that before it goes: the page image or the text, with personal identifiers masked on your device first. Merging, splitting, rotating, redacting and stripping metadata send nothing at all, which is why they carry on working with the network off.' },
      { q: 'Is blurring the same as deleting?', a: 'Not always, and the difference has embarrassed people. Pixelated text has been recovered by researchers — the process is deterministic and there are not many possible characters — so use a solid block for anything that matters. A black box drawn over a PDF page in most editors is worse still, because the text is untouched underneath and can be copied straight out from under it. If a page has to be safe, remove the page or flatten it to an image, and check what the file is carrying besides: the author, the software and often an earlier filename.' }
    ],
    related: ['accountants', 'going-digital', 'landlords']
  }
];

module.exports = { COLLECTIONS };
