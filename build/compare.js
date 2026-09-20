/**
 * Comparisons: the pages somebody lands on after typing "free alternative
 * to X" into a search box.
 *
 * These pages name other people's products, which makes them the pages on
 * this site with the most ways to go wrong. Three rules hold, and the
 * builder enforces all three rather than trusting the writing:
 *
 *   1. No disparagement. Nothing here calls another product bloated,
 *      clunky, overpriced or outdated. A comparison that has to sneer is a
 *      comparison that has run out of facts. Every page states what a thing
 *      does and lets the reader decide.
 *
 *   2. No unverifiable claims about somebody else's product. We have no way
 *      to check a competitor's current price, plan names or feature list, so
 *      no page states any of them. Where a fact about their product matters,
 *      the page says so and points at their own site. The builder refuses to
 *      write a page containing a currency amount anywhere near a competitor's
 *      name, because that is what an unverifiable price claim looks like.
 *
 *   3. The gap comes first. Every page opens — before the table, before the
 *      list of free tools — with what the paid product does that we do not,
 *      in the page's own voice. The comparison table is ordered the same way:
 *      the rows where they win are printed first, and the builder checks it.
 *
 * Where a page compares against a named product we have not tested, it
 * compares against the *category* and says so out loud. Describing a product
 * we have not used, from memory, is exactly the thing rule 2 forbids.
 *
 * Every tool's title and description are read out of the tool's own page
 * rather than repeated here, so a comparison cannot drift from what it links
 * to. A path that does not resolve stops the build.
 */
'use strict';

/* Only URLs already vetted in build/sources.js are used for guidance links,
   plus the two vendors' own sites — because a page that tells the reader to
   go and check should send them somewhere real. */
const REF = {
  mtdVat: ['gov.uk — Use Making Tax Digital for VAT', 'https://www.gov.uk/guidance/use-making-tax-digital-for-vat'],
  mtdVatSoftware: ['gov.uk — Find software compatible with Making Tax Digital for VAT', 'https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-vat'],
  mtdItsaUse: ['gov.uk — Use Making Tax Digital for Income Tax', 'https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax'],
  mtdItsaSoftware: ['gov.uk — Find software compatible with Making Tax Digital for Income Tax', 'https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax'],
  mtdItsaCheck: ['gov.uk — Check if you are eligible for Making Tax Digital for Income Tax', 'https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax'],
  vatNotice700_12: ['gov.uk — VAT Notice 700/12: how to fill in and submit your VAT Return', 'https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012'],
  vatFlatRate: ['gov.uk — VAT Notice 733: the flat rate scheme', 'https://www.gov.uk/guidance/flat-rate-scheme-for-small-businesses-vat-notice-733'],
  payslips: ['gov.uk — Payslips: what they must show', 'https://www.gov.uk/payslips'],
  epfo: ['EPFO — provident fund rates and the wage ceiling', 'https://www.epfindia.gov.in/'],
  esic: ['ESIC — contribution rates and the wage limit', 'https://www.esic.gov.in/'],
  incomeTaxIn: ['Income Tax Department, India', 'https://www.incometax.gov.in/'],
  gstPortal: ['Goods and Services Tax portal', 'https://www.gst.gov.in/'],
  tally: ['Tally Solutions — the product’s own site', 'https://tallysolutions.com/'],
  capium: ['Capium — the product’s own site', 'https://www.capium.com/']
};

/* Names we compare against. The builder uses this list to police rule 2. */
const COMPETITORS = ['Tally', 'Capium'];

const COMPARISONS = [

  /* ================================================================== */
  {
    slug: 'tally-alternative',
    glyph: 'i-tally',
    name: 'Tally alternative',
    crumb: 'Tally alternative',
    title: 'Tally alternative: what free browser tools can and cannot replace',
    lede: 'We are not a replacement for Tally. Tally is accounting software — a book of record. These are free browser tools that read and write the XML it imports and exports, so the retyping around it stops. If you need a different book of record, you need another accounting package, not us.',
    honest: [
      'You searched for an alternative to Tally, so here is the useful answer before anything else: this site is not one. Tally is accounting software. It holds your ledgers and your balances from one year to the next, and that is precisely the thing nothing on 1234Tools does. Every tool here starts from a blank page and forgets you when you close the tab.',
      'What we are is the arithmetic and the file-shuffling that sits around it, free, in your browser. If your real reason for searching is that somebody in the office spends two days a month retyping a spreadsheet into Tally, or copying the day book back out into Excel for a bank or a CA, then those two days are what these tools remove — and you keep Tally.'
    ],
    gap: {
      heading: 'What Tally does that we do not',
      intro: 'This is the part that decides whether you should be on this page at all, so it comes first.',
      points: [
        { h: 'It is the book of record.', p: 'Ledgers, balances and stock held from one year to the next, opening balances carried forward, an auditable set of books. Nothing here holds anything at all — not for a year, not for a day. There is no account, no server and no store.' },
        { h: 'It keeps the history somebody will ask for.', p: 'Registers, prior periods, who entered what and when. A bank, a buyer, an auditor or a department will eventually ask for last year. We hand you a file at the moment you make it; keeping it is entirely yours.' },
        { h: 'Several people, several companies, year on year.', p: 'More than one person posting into one set of books, with rights, across more than one company. Our tools are one person, one browser tab and one file.' },
        { h: 'It is a commercial product with somebody behind it.', p: 'A vendor, partners, and a support channel with an expectation attached. If a conversion here goes wrong at eleven at night there is a contact form and no promise of an hour.' },
        { h: 'We have not tested their product, and will not describe it.', p: 'What Tally costs, which edition does what, and what shipped in the most recent release are questions only Tally can answer. We have no way to check, so this page does not say. Their own site is linked at the bottom and is the only honest source for it.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'Accounting software you buy',
      rows: [
        { edge: 'them', need: 'Holding your books', us: 'Nothing is kept. Close the tab and it is gone.', them: 'The entire point of it: balances that persist and carry forward.' },
        { edge: 'them', need: 'History, registers and an audit trail', us: 'None. You get the file you just made.', them: 'Kept for you, year after year.' },
        { edge: 'them', need: 'Inventory: valuation, batches, reorder levels', us: 'Not attempted.', them: 'Core to an accounting package.' },
        { edge: 'them', need: 'Several people in the same books', us: 'One person, one tab, one file.', them: 'Users and rights.' },
        { edge: 'them', need: 'Somebody to ring', us: 'A contact form, and pages that admit what they are unsure of.', them: 'A commercial product with a support channel.' },
        { edge: 'level', need: 'Where your data sits', us: 'On your machine, because it never leaves it: the file is read and written by your own browser.', them: 'Depends on the edition and how it is deployed. Worth asking them directly.' },
        { edge: 'us', need: 'Turning a spreadsheet into vouchers', us: 'Drop the sheet in and get import XML with the debits and credits worked out, and every voucher checked to balance before anything is written.', them: 'Import exists; getting the sheet into the shape it wants is the work you are trying to avoid.' },
        { edge: 'us', need: 'Getting the day book back into Excel', us: 'Drop the exported XML in and get a workbook — one row per voucher, or one row per ledger line.', them: 'Exports the XML. Turning it back into a usable sheet is a separate job.' },
        { edge: 'us', need: 'Moving between two different packages', us: 'A QuickBooks or Zoho journal becomes vouchers, and a day-book export becomes the journal CSV either of them imports.', them: 'Not what any single package is for.' },
        { edge: 'us', need: 'Cost of doing it once', us: 'Free. No account, no card, no limit on how many times.', them: 'A licence. Their own site has the current terms; we will not guess at them.' }
      ]
    },
    buy: {
      heading: 'When you should buy Tally, or something like it',
      intro: 'Most businesses reading this page should, and the honest advice is to stop reading and go and do it if any of these is true.',
      points: [
        'You need a book of record. If anyone will one day ask for last year’s ledger, you need software that still has it. We will not.',
        'You carry stock. Valuation, batches, godowns and reorder levels belong in an accounting package, not in a browser tab.',
        'More than one person posts entries. The moment two people are typing into the books you need one copy of the truth, with rights on it.',
        'You are GST registered and filing every month. Those returns come out of the books. We can reconcile a GSTR-2B and build an e-invoice JSON, but we do not hold the ledgers the figures came from.',
        'You would rather ring somebody than read a page like this one. That is a completely reasonable thing to want, and it is not on offer here.'
      ]
    },
    groups: [
      { name: 'Between the spreadsheet and Tally', blurb: 'The retyping, removed. This is the part we are actually good at.', tools: ['/business/tally-converter/', '/business/accounting-converter/', '/business/sheet-merge/'] },
      { name: 'The monthly GST work', blurb: 'Reconciliation and the numbers that decide a claim.', tools: ['/business/gst-reconciler/', '/business/einvoice-json/', '/business/id-validator/', '/india/gst-calculator/'] },
      { name: 'The documents around the books', blurb: 'What goes out to a customer before an entry ever gets made.', tools: ['/pdf/invoice-pdf/', '/pdf/quotation-pdf/', '/pdf/delivery-challan-pdf/', '/pdf/purchase-order-pdf/'] },
      { name: 'Reading what arrives as paper', blurb: 'The AI tools. These need an account and say what they send, on every page.', tools: ['/ai/invoice-extractor/', '/ai/scanned-invoice-extractor/', '/ai/receipt-batch-reader/'] }
    ],
    faq: [
      { q: 'Can I replace Tally with these tools?', a: 'No, and we would rather say so on the first line than sell you an afternoon of disappointment. There is no ledger here that survives the tab closing, no stock, no users and no prior year. What these do is the work on either side of Tally: getting data in without retyping it, and getting it out in a shape a bank, a CA or another package can use.' },
      { q: 'Will the import XML go in cleanly?', a: 'It follows the Import Data envelope that Tally ERP 9 and Tally Prime both read, and every voucher is checked to balance before it is written — a debit is negative, a credit is positive, and the total must be zero. It has been checked for structure and balance rather than imported into every release, so send the first run into a test company. Ledger names must already exist in the company, spelled exactly as Tally has them; tick “create missing party ledgers” to get a masters file for the parties and import that first.' },
      { q: 'Does it calculate GST for me?', a: 'No. Sales and purchase vouchers carry CGST, SGST and IGST as separate ledger lines when you map those columns, so the amounts land on your tax ledgers exactly as you typed them. It does not work the tax out and it does not write the full GST classification a stock item needs for returns beyond HSN and rate. Check those in Tally after the import.' },
      { q: 'Is my client’s data uploaded anywhere?', a: 'No. The workbook is unzipped and read by your own browser, the XML is written by your own browser, and the download comes out of memory. Nothing is transmitted, which is why it works with the network off and why a client’s books can go through it without a processing agreement.' },
      { q: 'What does Tally cost?', a: 'We do not know today’s price and we are not going to guess at it. Their own site is linked below and is the only place that can answer it honestly.' }
    ],
    collections: ['accountants', 'small-business', 'month-end'],
    sources: {
      heading: 'Where to check the things we deliberately did not state',
      refs: [
        ['tally', 'price, editions and what is in the current release — their words, not ours'],
        ['gstPortal', 'the GST rules the reconciliation and the e-invoice JSON are built against']
      ]
    }
  },

  /* ================================================================== */
  {
    slug: 'capium-alternative',
    glyph: 'i-ledger',
    name: 'Capium alternative',
    crumb: 'Capium alternative',
    title: 'Capium alternative: free tools for the arithmetic, not for the practice',
    lede: 'Capium is practice software for accountants. This site is free browser tools for the sums inside the work. We do not file, we do not hold clients, we carry nothing from one year to the next and there is no support desk. Here is the whole gap, before anything else.',
    honest: [
      'We have not used Capium, and we are not going to describe somebody else’s product from memory. So this page does something slightly unusual: it compares free browser tools against what practice software is *for* — the job it does inside a firm — and sends you to their own site for anything specific about theirs. Every claim below about the paid side is a claim about the category, not about their feature list.',
      'A practice suite is bought to run a practice. Clients, authorisations, deadlines, filings, workflow, and a company that is answerable when a submission fails at five to five. Everything here is a single-purpose page that reads a file you already have and gives you numbers back. Those are different products, and pretending otherwise would waste your afternoon.'
    ],
    gap: {
      heading: 'What practice software does that we do not',
      intro: 'Read this list first. If more than one line on it matters to you, buy the software.',
      points: [
        { h: 'It files.', p: 'Returns to HMRC, accounts to Companies House, payroll on or before payday. That is the reason a practice buys it. Nothing on this site submits anything anywhere; there is no connection to HMRC in any tool here.' },
        { h: 'It is recognised software.', p: 'Filing under Making Tax Digital has to go through software HMRC has recognised. Recognition is an approval a vendor applies for and then maintains — it is not a feature that can be written in an afternoon. We are not on that list, and no page here claims to be.' },
        { h: 'It holds your client list.', p: 'Names, references, authorisations, who has signed what, and when each thing is due. We hold nothing. Every tool starts empty and forgets you when the tab closes.' },
        { h: 'It carries figures from one year to the next.', p: 'Last year brought forward, so this year’s comparatives are right without anybody retyping them. Ours cannot, because for us there is no last year.' },
        { h: 'Somebody is accountable.', p: 'A contract, a support desk, and professional indemnity behind the product. Here there is a contact form, and pages that tell you which figures they are least sure about instead of guaranteeing them.' },
        { h: 'Work moves across a team.', p: 'Jobs assigned, reviewed, signed off, with a record of who did what. Our tools are one person and one file, and the only record is the download.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'Practice software you buy',
      rows: [
        { edge: 'them', need: 'Filing to HMRC or Companies House', us: 'No. Nothing here submits anything to anybody.', them: 'The reason it exists.' },
        { edge: 'them', need: 'Recognised for Making Tax Digital', us: 'Not recognised. The VAT tool works out the nine boxes and says on its own page that it cannot file them.', them: 'Recognition is the vendor’s obligation. gov.uk publishes who holds it, and that list is the authority.' },
        { edge: 'them', need: 'Client records, authorisations and deadlines', us: 'None held. Nothing is stored on our side at all.', them: 'Held for you, with the dates attached.' },
        { edge: 'them', need: 'Comparatives brought forward', us: 'No history exists to bring forward.', them: 'Carried from year to year.' },
        { edge: 'them', need: 'Several people on one job', us: 'One person, one browser tab.', them: 'Assigned, reviewed and signed off.' },
        { edge: 'them', need: 'Somebody answerable when it goes wrong', us: 'A contact form, and pages that state their own uncertainty.', them: 'A contract and a support desk.' },
        { edge: 'us', need: 'A client’s books leaving the office', us: 'They do not. The file is read by your own browser, so there is nothing to disclose and no processor to name. The AI tools are the exception and say so on their own pages.', them: 'Hosted software necessarily holds client data — which is normal and usually fine, and is a processing arrangement you have to paper.' },
        { edge: 'us', need: 'Doing one sum, today, for a client you took on this morning', us: 'Open the page and do it.', them: 'It lives inside the client record, which is right once the client is set up.' },
        { edge: 'us', need: 'A bank reconciliation or a debtors ageing on a one-off engagement', us: 'Drop in the statement or the invoice list and get the report, with the unmatched items named and a likely reason against each.', them: 'Available, once the engagement is in the system.' },
        { edge: 'us', need: 'Cost of the arithmetic', us: 'Free. No account, no per-client charge, no seat.', them: 'Priced per practice or per client. Their own site has the current figures; we will not guess.' }
      ]
    },
    buy: {
      heading: 'When you should buy practice software',
      intro: 'If you are running a practice, you are almost certainly in this list. That is not false modesty — it is what the list is.',
      points: [
        'You file. Returns, accounts, payroll. Free browser tools cannot do it, and that is not a gap we can close with better writing.',
        'You have clients rather than a business. A client list with deadlines against it is a system, not a spreadsheet, once it gets past about a dozen.',
        'You need last year. Comparatives, brought forward balances, the prior return. We have no memory at all.',
        'More than one person touches a job. Review and sign-off leave a trail, and a trail is the product.',
        'You want somebody on the other end of a phone in January. Reasonable, and not something a free static page can offer.'
      ]
    },
    groups: [
      { name: 'The books and the reconciliations', blurb: 'Double-entry, bank matching and who owes what.', tools: ['/business/bookkeeping/', '/business/bank-reconciliation/', '/business/receivables-ageing/', '/business/invoice-payment-terms/'] },
      { name: 'VAT and Making Tax Digital figures', blurb: 'The numbers, and the rows behind every one of them. Not the filing.', tools: ['/business/vat-return/', '/business/mtd-checker/', '/business/mtd-quarterly-update/'] },
      { name: 'Between one client’s package and another', blurb: 'The conversions that otherwise become an afternoon of retyping.', tools: ['/business/accounting-converter/', '/business/tally-converter/', '/business/sheet-merge/'] },
      { name: 'What the client sends you', blurb: 'Including the photographs of it. These need an account and say what they send.', tools: ['/ai/invoice-extractor/', '/ai/scanned-invoice-extractor/', '/ai/bank-statement-categoriser/', '/ai/receipt-batch-reader/'] }
    ],
    faq: [
      { q: 'Can a practice run on free tools?', a: 'The arithmetic can. The compliance cannot. Everything that has to be submitted — returns, accounts, payroll — has to go through software that is recognised for the job, and none of ours is. What these replace is the part of the week that is a spreadsheet being wrestled into shape, which in most practices is a surprising amount of it.' },
      { q: 'Can I put client data through these?', a: 'Through the browser tools, yes: the file is read on your own machine and never sent anywhere, so there is nothing to disclose and no processor to name. The AI tools are genuinely different and every one of them says so at the top of its page — the text goes to a model through our gateway, personal identifiers are masked on your device first, and you are shown exactly what will be sent before it goes.' },
      { q: 'Do any of these file anything?', a: 'No. Not a return, not a set of accounts, not an RTI submission. They work out figures and show you the rows behind each one. We would rather be plain about it than have you find out on a deadline.' },
      { q: 'What does Capium cost, and what is in it?', a: 'We do not know and we will not guess. We have not tested their product and it would be dishonest to describe it from memory. Their site is linked below.' },
      { q: 'Will you ever be recognised for filing?', a: 'Bridging for VAT is the intended next step and it is not done. Until it is on HMRC’s list, every page here that touches a return says it cannot file, and will keep saying so.' }
    ],
    collections: ['accountants', 'month-end', 'going-digital'],
    sources: {
      heading: 'Where to check the things we deliberately did not state',
      refs: [
        ['capium', 'price, modules and what is in the current release — their words, not ours'],
        ['mtdVatSoftware', 'who is actually recognised to file a VAT return, from the authority that decides it'],
        ['mtdItsaSoftware', 'the same list for Making Tax Digital for Income Tax']
      ]
    }
  },

  /* ================================================================== */
  {
    slug: 'free-vat-return-software',
    glyph: 'i-vat-boxes',
    name: 'Free VAT return software',
    crumb: 'Free VAT return software',
    title: 'Free VAT return software: the nine boxes free, the filing not',
    lede: 'The nine boxes worked out from the spreadsheet you already keep, with every row behind every box, for nothing. It cannot submit them: under Making Tax Digital a VAT return has to go through software HMRC has recognised, and this is not on that list.',
    honest: [
      'There are two separate jobs hiding inside the phrase “VAT return software”, and most pages about it blur them together. The first is working out the nine boxes from your records. The second is submitting them to HMRC over their API. We do the first, free and in your browser. We do not do the second at all, and nothing on this site ever has.',
      'That distinction is the whole page. Making Tax Digital for VAT has applied to every VAT-registered business since April 2022, which means digital records and submission through compatible software. So if you are VAT registered, the question is not whether to pay for filing software — it is which one, and whether you also want it doing the arithmetic.'
    ],
    gap: {
      heading: 'What filing software does that we do not',
      intro: 'Four of these are things no amount of good arithmetic on our side can make up for.',
      points: [
        { h: 'It submits the return.', p: 'A VAT return under Making Tax Digital is an API call to HMRC made by software HMRC has recognised for the purpose. Ours makes no call to anybody: this is a static page and the work happens inside your browser.' },
        { h: 'It is on HMRC’s list.', p: 'Recognition is an approval a vendor applies for and then keeps — registering, passing HMRC’s tests, and sending the fraud prevention headers HMRC requires on every call so they can see which device a submission came from. gov.uk publishes who holds it. We do not.' },
        { h: 'It keeps the digital link.', p: 'This is the one people miss. Making Tax Digital does not only require the figures to arrive from software; it requires the journey from your records to those figures to be digital too, without anybody retyping in the middle. A tool that hands you nine numbers to copy into something else is, at that moment, the break in the chain — and that tool is us.' },
        { h: 'It can read back what HMRC holds.', p: 'Your open periods, your obligations, what has been submitted and what is owed. Recognised software can fetch all of it. We cannot see any of it; you look it up yourself.' },
        { h: 'It keeps the records.', p: 'Digital record keeping is an obligation with a retention period behind it. We store nothing whatsoever, so whatever you keep, you keep yourself.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'Recognised filing software',
      rows: [
        { edge: 'them', need: 'Submitting the return to HMRC', us: 'No. There is no connection to HMRC anywhere in this site.', them: 'Yes. That is what recognition is for.' },
        { edge: 'them', need: 'Being on gov.uk’s compatible software list', us: 'Not on it.', them: 'Check the list itself before you buy, rather than taking any advert’s word for it.' },
        { edge: 'them', need: 'An unbroken digital link from records to submission', us: 'Breaks at the moment you copy the figures off the screen.', them: 'Held, if you use one product end to end.' },
        { edge: 'them', need: 'Seeing your open periods and what you owe', us: 'No.', them: 'Read back from HMRC.' },
        { edge: 'them', need: 'Keeping the digital records themselves', us: 'Nothing is stored here, ever.', them: 'Stored, with the retention you are required to have.' },
        { edge: 'level', need: 'Where your spreadsheet goes', us: 'Nowhere. It is read, added up and written back out by your own browser.', them: 'Depends entirely on the product. Ask before you upload a sales ledger.' },
        { edge: 'us', need: 'Working the nine boxes out of a sheet you already keep', us: 'Standard accrual, cash accounting or the flat rate scheme, with the first-year discount and the limited cost trader rate as switches.', them: 'Varies: a bridging tool reads a sheet, a full package wants the records inside its own ledger first.' },
        { edge: 'us', need: 'Seeing what a box is made of', us: 'Click “show rows” on any box and you get exactly the rows that made it, and what each one contributed. That is the part an accountant asks for when a box looks wrong.', them: 'A full package will drill into its own ledger; a bridging tool usually shows you a cell reference.' },
        { edge: 'us', need: 'Catching a bad spreadsheet before you trust it', us: 'Rows where net plus VAT does not equal gross, VAT that is not the stated rate of the net, duplicate invoice references and rows dated outside the period — all listed by row number and reference, and nothing is quietly corrected.', them: 'Varies. A package that owns the records has less to check, because the records were never typed.' },
        { edge: 'us', need: 'Cost', us: 'Free. No account, no card, no per-return charge.', them: 'Charged per return or per year. The vendor has the current figure; we do not, and will not guess.' }
      ]
    },
    buy: {
      heading: 'When you should pay for filing software — which, if you are VAT registered, is now',
      intro: 'This is not a page that ends with “so you do not need to buy anything”. If you are VAT registered you need recognised software, and this tool does not change that.',
      points: [
        'You are VAT registered. The return has to be submitted through compatible software, so the choice is between one paid product and another, not between them and us.',
        'Your records already live in an accounting package. File from it. Adding a second tool to work out figures the package already has is work for nothing.',
        'You need the digital link intact from the cell to the submission. Using one product for both ends is the simplest way to be able to say that you did.',
        'You want somebody to ring when a submission is rejected. That is worth money on the seventh of the month, and it is not on offer here.',
        'Where we might still fit: as the working. Produce the boxes here, open every one to check the rows behind it, then file through whatever you already use. The tool says exactly that on its own page.'
      ]
    },
    groups: [
      { name: 'Work out what has to be filed', blurb: 'The figures, and the rows that made them.', tools: ['/business/vat-return/', '/business/mtd-checker/', '/business/mtd-quarterly-update/'] },
      { name: 'Keep the records the figures come from', blurb: 'Because “digital records” has to mean something in practice.', tools: ['/business/bookkeeping/', '/business/bank-reconciliation/', '/business/sheet-merge/', '/ai/bank-statement-categoriser/'] }
    ],
    faq: [
      { q: 'Can I file a VAT return for free?', a: 'Not from here. Whether you can file free anywhere depends on which recognised products offer a free tier, and that changes — gov.uk publishes the list of compatible software and it can be filtered, which is a better answer than anything we could write down today and let go stale.' },
      { q: 'Is a spreadsheet still allowed under Making Tax Digital?', a: 'Keeping records in a spreadsheet is not the problem; the return arriving by hand is. The records have to be digital and the transfers between the pieces of software involved have to be digital links rather than somebody retyping. That is exactly the gap bridging software was invented to fill.' },
      { q: 'How reliable are the rates and thresholds in the tool?', a: 'Every rate, threshold and scheme rule sits in one marked block at the top of the engine file, with the date it was written on it, and the page prints when it was last checked and links to VAT Notice 700/12 and Notice 733. The tool tells you in its own tips to treat the figures as a calculation you still have to verify. We would rather say that than imply a freshness we cannot promise.' },
      { q: 'Does it handle cash accounting and the flat rate scheme?', a: 'Both. Cash accounting insists on a paid date column and refuses to run without one, rather than handing you accrual figures with a cash accounting label on them; map a paid amount as well and a part payment counts in proportion. Under the flat rate scheme you type your own sector percentage, because getting one of those fifty-odd percentages wrong would be worse than asking.' },
      { q: 'Does my sales ledger leave my computer?', a: 'No. It is read, added up and written back out by your own browser. Nothing is uploaded, queued or logged, which is what makes it safe to put a client’s books through.' }
    ],
    collections: ['accountants', 'freelancers', 'going-digital', 'small-business'],
    sources: {
      heading: 'The authorities, rather than us',
      refs: [
        ['mtdVat', 'what Making Tax Digital for VAT actually requires'],
        ['mtdVatSoftware', 'who may file a return — the list is the authority'],
        ['vatNotice700_12', 'what belongs in each of the nine boxes, and the rounding'],
        ['vatFlatRate', 'the flat rate scheme, the sector percentages and the capital goods rule']
      ]
    }
  },

  /* ================================================================== */
  {
    slug: 'free-payroll-software-india',
    glyph: 'i-payroll-run',
    name: 'Free payroll software (India)',
    crumb: 'Free payroll software',
    title: 'Free payroll software for India: the monthly run free, the compliance not',
    lede: 'One salary sheet in, and the whole month out: a payslip per employee, a combined PDF, the bank transfer file and a register workbook. Free, and the sheet never leaves your machine. It does not compute TDS, it does not file a return and it does not watch the compliance calendar.',
    honest: [
      'The payroll run here takes one salary sheet and gives you the month. A payslip PDF for every employee in a zip, a combined PDF to print, the bank bulk-transfer CSV, and a register workbook with the provident fund, ESI, professional tax and TDS summaries whose totals tie back to the slips. It is free, it needs no account, and the sheet is read and written entirely by your own browser.',
      'It is not payroll software in the sense a payroll company means the phrase. It does not compute TDS, it does not file anything, it does not know your compliance calendar and it has no memory of last month. Those four things are most of what you are paying for when you pay, so most of this page is about them.'
    ],
    gap: {
      heading: 'What a payroll package does that we do not',
      intro: 'The first one is deliberate, and we would make the same choice again. The rest are simply gaps.',
      points: [
        { h: 'TDS.', p: 'We do not compute it, on purpose. A month’s deduction depends on an employee’s projected annual income, the regime they have chosen, their declarations and what has already been deducted this year — and none of those four things is in a salary sheet. Put your own figure in a column and it is carried through to the payslip, the register and the TDS summary. A payroll package holds all four and works it out for you, which is the right answer if you have the data.' },
        { h: 'Returns, challans and Form 16.', p: 'Provident fund and ESI returns, professional tax, TDS returns, and the annual certificates. We generate none of the statutory return formats and file none of them, and we do not keep the acknowledgements.' },
        { h: 'The compliance calendar.', p: 'Due dates, rate changes, state-by-state professional tax and every new notification. A payroll company watches those for a living. Ours sit in one clearly-marked constants block in one file with the date they were last checked and a note telling you to check them before you file. That is honest. It is not the same as somebody watching.' },
        { h: 'Last month, and the year to date.', p: 'Arrears, a mid-year revision, a joiner in the middle of a month, a full and final settlement against what has already been paid — every one of those needs history. We have none. Each run is one sheet, with no memory of the one before it.' },
        { h: 'A place employees can go.', p: 'Self-service for payslips and declarations, and somewhere the whole year lives. We hand you files; distributing and keeping them is yours.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'A payroll package you subscribe to',
      rows: [
        { edge: 'them', need: 'TDS computed', us: 'No, by design. Supply your own figure and it is carried through to the slip, the register and the TDS summary.', them: 'Computed from declarations, the chosen regime and the year to date.' },
        { edge: 'them', need: 'Statutory returns and annual certificates', us: 'None generated, none filed.', them: 'This is what the subscription is for.' },
        { edge: 'them', need: 'Keeping up when a rate or a slab moves', us: 'One dated constants block, and a note in the tool telling you to check it before you file.', them: 'The vendor’s job, and they are paid to do it.' },
        { edge: 'them', need: 'History: arrears, revisions, mid-year joiners', us: 'None. Each run is a single sheet.', them: 'Held, and used.' },
        { edge: 'them', need: 'Employee self-service', us: 'No. You distribute the slips yourself.', them: 'Usually included.' },
        { edge: 'them', need: 'Your bank’s exact bulk-transfer format', us: 'A CSV with the five fields every format is built from, and a note in the register so you can reorder it for your bank in a minute.', them: 'Usually the exact layout your bank wants, already configured.' },
        { edge: 'level', need: 'Provident fund, ESI and professional tax', us: 'Computed here — the fund at twelve per cent with the wage ceiling and the pension-scheme split, ESI while gross wages are inside the limit, professional tax from the state you pick — or taken from your sheet untouched when your consultant has already done it.', them: 'Computed.' },
        { edge: 'us', need: 'Starting this month, with no implementation', us: 'Drop in the sheet you already keep. Column names are matched for you and every match is shown in a dropdown you can correct; any numeric column the mapping did not claim is offered back as an extra earning or deduction and prints under its own name.', them: 'Employee masters, components and opening balances. A project, not an install.' },
        { edge: 'us', need: 'Refusing to pay somebody a negative amount', us: 'The run stops, writes nothing at all, and names the people whose deductions exceed their earnings.', them: 'Every product has its own validation; ask to see what it refuses to do.' },
        { edge: 'us', need: 'Where the salary sheet goes', us: 'Nowhere. It is read, computed and written by your own browser — which matters, because a salary sheet is the most sensitive file a small business owns.', them: 'A hosted service holds your employees’ salary data under its own terms.' },
        { edge: 'us', need: 'Cost', us: 'Free, for any number of employees, with no account.', them: 'Usually a monthly charge that scales with headcount. The vendor has the figure.' }
      ]
    },
    buy: {
      heading: 'When you should buy payroll software',
      intro: 'If you employ people in India and you are responsible for their deductions, most of this list applies to you.',
      points: [
        'You are responsible for deducting TDS correctly. That is nearly every employer, and it is the one thing this tool deliberately refuses to guess at.',
        'You have to file provident fund, ESI and TDS returns, and you would like the challans and the certificates to come out of the same place as the payslips.',
        'You are past twenty or thirty people, or you have joiners and leavers most months. History stops being optional at that point.',
        'You want somebody else watching when a rate or a state slab moves. Our figures carry a date and a warning; a vendor carries the responsibility.',
        'You want employees fetching their own payslips and filing their own declarations instead of emailing you.'
      ]
    },
    groups: [
      { name: 'The monthly run', blurb: 'One sheet in, everything the month needs out.', tools: ['/business/payroll-run/', '/pdf/payslip-pdf/', '/business/employer-cost/'] },
      { name: 'Structuring a salary', blurb: 'What the job costs, and what the person actually takes home.', tools: ['/business/ctc-structure/', '/india/ctc-take-home/', '/india/hra-exemption/', '/india/epf-calculator/'] },
      { name: 'Joiners and leavers', blurb: 'The paperwork at both ends.', tools: ['/business/full-final-settlement/', '/india/gratuity-calculator/', '/ai/contract-generator/', '/ai/job-description-writer/'] },
      { name: 'The tax questions employees ask you', blurb: 'So the answer is a page rather than an argument.', tools: ['/india/tds-calculator/', '/india/advance-tax/', '/ai/form16-reader/'] }
    ],
    faq: [
      { q: 'Is it really free, for any number of employees?', a: 'Yes. There is no account, no per-employee charge and nothing to cancel. The practical limit is your own machine: it is arithmetic and PDF drawing in a browser tab, so a few hundred rows is comfortable.' },
      { q: 'Why will it not calculate TDS?', a: 'Because it cannot do it honestly from a salary sheet. A month’s deduction depends on projected annual income, the regime the employee chose, their declarations and what has already been deducted this year. Guessing at any of those and printing the result on a payslip would be worse than leaving the column to you.' },
      { q: 'Does it compute provident fund, ESI and professional tax, or do I supply them?', a: 'Either, and it is a switch. Leave it on compute and the fund is twelve per cent of basic and dearness allowance, with the wage ceiling optional, ESI applies while gross wages are within the limit, and professional tax comes from the state you pick. Switch it to take from the sheet and your own columns are used untouched, which is what you want when a consultant has already computed them.' },
      { q: 'Are the statutory rates current?', a: 'They are as last checked, the date is written in the file beside them, and the tool tells you in its own tips to check them against the current rules before you file. When something moves there is one block in one file to correct, which is the point of keeping them there.' },
      { q: 'Can I use this alongside a payroll consultant?', a: 'That is one of the shapes it works best in. Your consultant gives you the TDS and the statutory figures, you switch the deductions to take from the sheet, and the run produces the slips, the combined PDF, the bank file and the register without anybody retyping a salary.' },
      { q: 'Does my salary sheet get uploaded?', a: 'No. It is read by your own browser, the PDFs and the workbook are written there, and the downloads come out of memory. Nothing is uploaded, queued or logged.' }
    ],
    collections: ['hr-payroll', 'small-business', 'month-end'],
    sources: {
      heading: 'The authorities behind the figures',
      refs: [
        ['epfo', 'provident fund rates and the wage ceiling'],
        ['esic', 'contribution rates and the wage limit'],
        ['incomeTaxIn', 'TDS, the regimes and the annual certificate']
      ]
    }
  },

  /* ================================================================== */
  {
    slug: 'free-timetable-software-schools',
    glyph: 'i-timetable',
    name: 'Free timetable software for schools',
    crumb: 'Free timetable software',
    title: 'Free timetable software for schools: one hard job, done',
    lede: 'The subject allocation your school already writes, turned into a clash-free week in seconds — a grid per class, a grid per teacher, doubles kept together, and a plain list of anything that would not fit. It is not a school management system, and this page is honest about the difference.',
    honest: [
      'The timetable generator takes the allocation a school already keeps — class, subject, teacher, periods a week — and returns a week that does not clash. A grid for every class, a grid for every teacher, double periods in adjacent slots on one day, teachers’ unavailable days left empty, and a plain list naming anything that could not be placed. It is free and nothing about a pupil or a member of staff is uploaded.',
      'A school management system is a different animal entirely. It holds the pupil record, the register, the assessment history, the safeguarding notes and everything that goes to parents, all year, for everybody. We do one job in an afternoon and then forget you. If you are choosing an MIS, this is not a competitor — it is the thing you might use in August while you are still deciding.'
    ],
    gap: {
      heading: 'What a school MIS does that we do not',
      intro: 'A timetable is one module of an MIS, and not usually the reason a school buys one.',
      points: [
        { h: 'It holds the pupil record.', p: 'Names, dates of birth, contacts, additional needs and safeguarding information, attendance and behaviour, year after year. We hold nothing: the allocation is read by your browser and forgotten when the tab closes.' },
        { h: 'It is the register.', p: 'Statutory attendance, taken lesson by lesson against the timetable, with the codes and the reporting that follow. Our timetable is a grid; nothing is taken against it and nothing is reported from it.' },
        { h: 'It is how the school talks to parents.', p: 'Apps, letters, reports and the returns a school has to make to whoever it answers to. None of that exists here.' },
        { h: 'It is contracted and supported.', p: 'A supplier, a contract, a data processing agreement and someone to ring in the first week of September. Here there is a contact form.' },
        { h: 'It can model things ours cannot.', p: 'We do not do room allocation, and we cannot split a class into sets that run at the same time — the generator assumes one class is in one place at a time. If your timetable turns on rooms or option blocks, you need a scheduler that models them, and this is not one.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'A school MIS you license',
      rows: [
        { edge: 'them', need: 'Pupil records, attendance, safeguarding', us: 'None. Nothing is stored at all.', them: 'The reason a school buys one.' },
        { edge: 'them', need: 'Rooms', us: 'Not modelled. Classes and teachers only.', them: 'Ask specifically what its scheduler does with rooms before you buy.' },
        { edge: 'them', need: 'Option blocks and sets running in parallel', us: 'Not supported. Two teachers for one subject can be written as two rows, but a class split into simultaneous sets cannot.', them: 'This is the question that separates timetabling products. Ask it.' },
        { edge: 'them', need: 'Carrying the timetable to next year', us: 'It exists in the file you downloaded, and nowhere else.', them: 'Held and rolled forward.' },
        { edge: 'them', need: 'Support in the first week of September', us: 'A contact form.', them: 'A contract.' },
        { edge: 'them', need: 'Reporting to whoever the school answers to', us: 'Nothing.', them: 'Built in.' },
        { edge: 'us', need: 'Getting a clash-free week out of an allocation sheet', us: 'Seconds. The worked example — four classes, eleven teachers, a hundred and forty periods — settles in well under a second, and changing the seed gives a different arrangement of the same allocation.', them: 'Also its job, once the data is in the system.' },
        { edge: 'us', need: 'Knowing what is guaranteed and what is only attempted', us: 'Stated plainly. Guaranteed: no teacher in two places, no class with two lessons, unavailable days empty, daily maximums respected, doubles adjacent — all re-checked after the grid is built. Attempted: spreading a subject across the week, keeping free periods together, levelling daily loads.', them: 'Varies. Ask to see what it checks after it has built a grid.' },
        { edge: 'us', need: 'What happens when something will not fit', us: 'It names the class, the teacher and the arithmetic — one teacher’s periods against the days times periods available — instead of producing a quiet bad plan.', them: 'Varies.' },
        { edge: 'us', need: 'Trying it before any procurement', us: 'Open the page in August with a spreadsheet and no purchase order.', them: 'A licence, and usually a migration.' },
        { edge: 'us', need: 'Where staff and pupil data goes', us: 'Nowhere. It is read and built by your own browser, which is what lets a school try it without a data processing agreement or a consent form.', them: 'A hosted MIS is a processor of pupil data and needs the paperwork that goes with it, which is normal and right.' }
      ]
    },
    buy: {
      heading: 'When you should buy the real thing',
      intro: 'A school needs an MIS. Nothing on this page changes that, and it is not trying to.',
      points: [
        'You need attendance, pupil records and reporting. They are not optional and no free page replaces them.',
        'Your timetable turns on rooms, option blocks or sets that run at the same time. Ours models none of the three.',
        'More than one person builds the timetable, or it has to be changed all year as staffing changes.',
        'It has to roll forward year on year, with last year as the starting point.',
        'Somebody has to be accountable for pupil data under a contract. A free static page cannot be that somebody.'
      ]
    },
    groups: [
      { name: 'The two jobs that eat a week each', blurb: 'The problems a computer is good at and a person is not.', tools: ['/education/timetable/', '/education/exam-seating/'] },
      { name: 'Marks in, paperwork out', blurb: 'The December fortnight, made shorter.', tools: ['/education/report-card/', '/education/marks-percentage/', '/education/attendance-calculator/', '/education/percentile-rank/'] },
      { name: 'The office work around it', blurb: 'Lists, letters and certificates.', tools: ['/business/sheet-merge/', '/business/mail-merge/', '/pdf/certificate-pdf/', '/education/exam-countdown/'] }
    ],
    faq: [
      { q: 'What does it need from me?', a: 'The subject allocation your school already writes: one row per class, subject, teacher and periods a week. Column names are matched for you. Teachers’ unavailable days and fixed periods like assembly go into two text boxes, and that is the whole input.' },
      { q: 'What does it guarantee?', a: 'No teacher in two places at once, no class with two lessons at once, no teacher booked when you said they were unavailable, no teacher over the daily maximum you set, and every double period in two adjacent slots on one day. All of those are re-checked after the grid is built, and it refuses to call a timetable finished if any of them fails.' },
      { q: 'And what does it only try to do?', a: 'Spreading a subject across the week rather than twice in a day, keeping teachers’ free periods together instead of scattered, keeping the last period off the subjects you name, and levelling daily loads. Those are scored rather than enforced, because a timetable with a few of them imperfect beats no timetable.' },
      { q: 'Can it allocate rooms?', a: 'No. It places classes and teachers into periods and nothing else. If rooms are the binding constraint in your school, this will give you a week that looks right and is not, so use a scheduler that models them.' },
      { q: 'Why did some lessons not fit?', a: 'Almost always arithmetic rather than bad luck. Add up one teacher’s periods a week: if it exceeds days times periods, no arrangement exists. The same goes for a class. The unplaced list names the class, the subject and the teacher, and the summary shows each teacher’s load against the maximum possible, so the cause is usually visible in one line.' },
      { q: 'Is any staff or pupil data uploaded?', a: 'No. The allocation is read by your own browser, the timetable is built there, and the spreadsheet and PDF are written there. Names and teaching loads never leave the device.' }
    ],
    collections: ['schools', 'start-of-term'],
    sources: null
  },

  /* ================================================================== */
  {
    slug: 'free-invoice-generator',
    glyph: 'i-invoice-pdf',
    name: 'Free invoice generator',
    crumb: 'Free invoice generator',
    title: 'Free invoice generator: a proper PDF, and honestly nothing else',
    lede: 'Invoices, quotations, proformas and delivery challans as clean PDFs, with the tax worked out, no watermark, no account and no limit. They are documents, not a system: nothing is stored, nothing is numbered for you and nobody is chasing on your behalf.',
    honest: [
      'The tools here draw a document. Line items, tax, totals, your letterhead and accent colour, an acceptance block on a quotation, the GST split decided from the state codes in the two GSTINs rather than a box you tick. The PDF is yours, there is no watermark, there is no limit and there is nothing to sign up for.',
      'They are not an invoicing service. Nothing is stored, no number is allocated for you, nobody is told when an invoice is opened or paid, and there is no payment link on it. If what you actually want is a system that knows what is outstanding, this page will tell you plainly where that line falls — and the line is not in our favour.'
    ],
    gap: {
      heading: 'What an invoicing service does that we do not',
      intro: 'Six things, and the first two are the ones that cause real trouble.',
      points: [
        { h: 'It remembers.', p: 'Customers, items, every invoice you sent and what was paid against it. We remember nothing at all: each document starts from the defaults, and closing the tab is the end of it.' },
        { h: 'It allocates the number.', p: 'Tax authorities in most places expect an unbroken serial series, and a system that issues the next number cannot skip one. Typing the number yourself is exactly where gaps and duplicates come from, and our page can only remind you of that — it cannot stop you.' },
        { h: 'It knows what is outstanding.', p: 'Paid, part paid, overdue, by customer, without you maintaining anything. Our ageing tool will tell you the same thing, but only from a list of unpaid invoices that you keep and give it.' },
        { h: 'It takes the money.', p: 'A payment link on the invoice, a card page, a bank feed that marks an invoice paid when the money lands. None of that is here, and none of it can be.' },
        { h: 'It chases on its own.', p: 'Reminders on a schedule, without anybody remembering. Our reminder letters are drafted for you — naming the invoices, the days late and the total, with the tone stepping up — and then you send them.' },
        { h: 'It is the record.', p: 'If somebody asks for every invoice you raised over the last six years, a service can produce them. We can produce the one on the screen.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'An online invoicing service',
      rows: [
        { edge: 'them', need: 'Storing your invoices', us: 'Nothing is stored. The PDF is the record and it is yours to keep.', them: 'Held, searchable and exportable.' },
        { edge: 'them', need: 'Allocating the next number', us: 'You type it. The page reminds you the series should have no gaps; it cannot enforce it.', them: 'Issued in sequence, so it cannot skip.' },
        { edge: 'them', need: 'Knowing what has been paid', us: 'Only from a list you keep yourself and feed to the ageing tool.', them: 'Tracked against the invoice.' },
        { edge: 'them', need: 'Taking payment', us: 'No payment link and no card page.', them: 'Often the main reason people subscribe.' },
        { edge: 'them', need: 'Chasing automatically', us: 'Letters are drafted from your ageing list; you send them.', them: 'Sent on a schedule without you.' },
        { edge: 'them', need: 'Recurring invoices', us: 'No. Each document is drawn fresh.', them: 'Scheduled.' },
        { edge: 'them', need: 'Your bookkeeper seeing the same invoices', us: 'Only the files you send them.', them: 'Shared access.' },
        { edge: 'us', need: 'One good-looking document, right now', us: 'Open the page, type, download. No sign-up, no trial, no card.', them: 'Sign-up, then a trial, then a plan.' },
        { edge: 'us', need: 'GST on an Indian document', us: 'Intra-state splits into CGST and SGST at half each and inter-state charges IGST — worked out from the state codes in the two GSTINs, so it cannot disagree with the numbers printed on the face of the document.', them: 'Handled by Indian services too; check the one you are looking at.' },
        { edge: 'us', need: 'Your customer list sitting on somebody’s server', us: 'There is no server. Names, rates and bank details are drawn on your own device.', them: 'A hosted service necessarily holds your customer list.' },
        { edge: 'us', need: 'Cost, and what you may do with the output', us: 'Free and unlimited, no watermark, no branding of ours on the document, commercial use fine.', them: 'A subscription. The vendor has the current figure.' }
      ]
    },
    buy: {
      heading: 'When you should pay for an invoicing service',
      intro: 'The dividing line is roughly “documents” against “a ledger of who owes you what”. If you need the second, buy it.',
      points: [
        'You send more than a handful a month. The numbering alone is worth the fee, because a gap in the series is a conversation with an auditor.',
        'You need to know what is outstanding without maintaining a spreadsheet to tell you.',
        'You want to be paid from the invoice itself, by card or by link.',
        'You are registered for a tax that expects an unbroken series and a retrievable record for years afterwards.',
        'Somebody else — a bookkeeper, an accountant — needs to see the same invoices you do, without you emailing them.'
      ]
    },
    groups: [
      { name: 'The documents themselves', blurb: 'Proper PDFs, laid out as documents rather than printouts of a web page.', tools: ['/pdf/invoice-pdf/', '/pdf/quotation-pdf/', '/pdf/delivery-challan-pdf/', '/pdf/purchase-order-pdf/'] },
      { name: 'The bits around them', blurb: 'Terms, the e-invoice payload, labels and a signature.', tools: ['/business/invoice-payment-terms/', '/business/einvoice-json/', '/pdf/label-pdf/', '/pdf/pdf-signature/'] },
      { name: 'Knowing who owes you, and asking', blurb: 'The part that actually gets you paid.', tools: ['/business/receivables-ageing/', '/business/bank-reconciliation/', '/business/mail-merge/', '/ai/business-writer/'] }
    ],
    faq: [
      { q: 'Can I use these invoices commercially?', a: 'Yes. The documents are yours, there is no watermark, no branding of ours on them and no limit on how many you make.' },
      { q: 'Is it a legally compliant invoice?', a: 'It produces the layout. Whether it is compliant depends on your jurisdiction and what you put on it — a VAT registration number, the tax point date, reverse charge wording where it applies. Check the requirements where you are, or ask your accountant, before you issue one.' },
      { q: 'How do I keep my invoice numbers in sequence without a system?', a: 'Keep the series in one place and never in your head: a single sheet with the number, the date, the customer and the amount, updated as you raise each one. That sheet is also exactly what the ageing tool wants, so it does two jobs. It is not as safe as software issuing the number, and we are not going to pretend it is.' },
      { q: 'What is the difference between a quotation, an estimate and a proforma invoice?', a: 'A quotation is a firm offer to supply at a stated price, open until it expires. An estimate is an indication of the likely price and is not binding. A proforma is invoice-shaped and sent before the supply, usually so the buyer can raise a purchase order or pay in advance — but it is not a tax invoice, no input tax credit arises from it, and the tool prints that on its face so an auditor cannot mistake it.' },
      { q: 'Does anything I type leave my computer?', a: 'No. The document is drawn on your device, so client names, rates and bank details never leave it. That is also why nothing can be stored for you: there is nowhere to store it.' }
    ],
    collections: ['small-business', 'freelancers', 'get-paid'],
    sources: null
  },

  /* ================================================================== */
  {
    slug: 'mtd-bridging-software',
    glyph: 'i-mtd-check',
    name: 'MTD bridging software',
    crumb: 'MTD bridging software',
    title: 'MTD bridging software: what it is, what recognition requires, and what we do not do',
    lede: 'Bridging software is the recognised category for a program whose job is to take figures out of a spreadsheet and submit them to HMRC without being a full accounting package. This explains what that means, what HMRC requires of it, what to ask before you buy one — and exactly where we stop.',
    honest: [
      'This page exists because “bridging software” is a term of art that almost nobody explains properly, and the pages that do explain it are usually selling one. We are not selling one: we cannot file, we are not on HMRC’s list, and we are not going to be by the end of this page.',
      'So take this as the explanation rather than the pitch. What bridging software is, why the category exists, what makes one recognised, what the digital link requirement actually demands of you, and what to ask a vendor before you pay them. Then, at the bottom, the narrow thing we do for free — working out the figures — and the plain statement that it is not filing.'
    ],
    explain: {
      heading: 'What bridging software actually is',
      intro: 'Seven things worth knowing before you choose one.',
      points: [
        { h: 'It exists because spreadsheets did not go away.', p: 'Making Tax Digital requires records to be kept digitally and the return to be submitted from compatible software. It does not require you to abandon the spreadsheet you have kept for fifteen years. Bridging software is the answer to that: a small program whose only job is to take figures out of a spreadsheet and send them to HMRC.' },
        { h: 'It is not a lesser category.', p: '“Bridging” describes what the software does, not how approved it is. A bridging tool that submits your return holds exactly the same recognition as a full accounting package that submits yours. There is one gov.uk list of software compatible with Making Tax Digital for VAT, and a product either is on it or is not.' },
        { h: 'Only nine numbers travel.', p: 'A VAT return submission is nine figures and a period. Your invoices, your customers and your ledger do not go to HMRC. That is worth knowing before you decide how much software you need in order to file nine numbers.' },
        { h: 'The digital link is the real requirement.', p: 'This is the part people get wrong, and it is the part that decides whether a bridging tool is doing its job. It is not enough for the figures to arrive at HMRC from software; the journey from your records to those figures has to be digital too. Reading a number off one screen and typing it into another is not a digital link. Linked cells, a formula, a CSV import, an API call — those are. Holding that chain together from the cell to the submission is where a bridging tool earns its fee.' },
        { h: 'HMRC has to be able to see where a submission came from.', p: 'Every call to HMRC’s API carries fraud prevention headers describing the device and connection it came from. That is one reason recognition is an approval rather than a weekend project: a vendor registers, is issued credentials, passes HMRC’s tests, and then keeps meeting those requirements on every call.' },
        { h: 'It is not only VAT any more.', p: 'Making Tax Digital for Income Tax works the same way for the quarterly updates a sole trader or a landlord has to send, and has its own list of compatible software. The word “bridging” is used more loosely there, but what matters is identical: software HMRC recognises, and a digital link back to the records.' },
        { h: 'What to ask before you buy one.', p: 'Is it on the gov.uk list for the tax you are filing? Does it read your spreadsheet the way you actually keep it, or does it want its own template? Does the link from your records to the submitted figures stay digital the whole way? Can it read your obligations and liabilities back from HMRC, or only submit? And what happens to your spreadsheet — is it read on your machine, or uploaded to theirs?' }
      ]
    },
    gap: {
      heading: 'What recognised bridging software does that we do not',
      intro: 'One of these is the whole distinction and the rest follow from it.',
      points: [
        { h: 'It files. We do not.', p: 'No amount of good arithmetic closes that gap. Our VAT tool produces the nine boxes and the working behind them, and it has no connection to HMRC of any kind. This is a static site; it sends nothing anywhere.' },
        { h: 'It is on HMRC’s list. We are not.', p: 'A return has to be submitted through software HMRC has recognised. We are not recognised, we do not claim to be on any page, and every tool here that touches a return says so in its own words.' },
        { h: 'It holds the digital link. We break it.', p: 'The moment you read nine numbers off our page and type them somewhere else, that is a manual transfer. If you are relying on a digital link, our figures are your working — not your filing route. We would rather be the first to say that than have you discover it in an enquiry.' },
        { h: 'It can read back what HMRC holds.', p: 'Your obligations, your open periods, your liabilities and your payments. We can see none of it, so the deadlines you plan around are the ones you looked up yourself.' },
        { h: 'There is a vendor behind it.', p: 'Somebody to ring when a submission is rejected at five to five on the seventh. Here there is a contact form and an honest page.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'Recognised bridging software',
      rows: [
        { edge: 'them', need: 'Submitting the VAT return', us: 'No. There is no connection to HMRC anywhere in this site.', them: 'Yes — that is the definition of the category.' },
        { edge: 'them', need: 'On the gov.uk compatible software list', us: 'Not on it, and not claiming to be.', them: 'Check the list rather than the advert. It is the only thing that settles it.' },
        { edge: 'them', need: 'Keeping the digital link from cell to submission', us: 'Broken, by us, at the point you copy the figures out.', them: 'Held, if you use it from the spreadsheet all the way to the submission.' },
        { edge: 'them', need: 'Reading your obligations and liabilities from HMRC', us: 'No.', them: 'Commonly included; worth confirming, because not every product does.' },
        { edge: 'them', need: 'Somebody accountable if a submission fails', us: 'A contact form.', them: 'A vendor with an obligation.' },
        { edge: 'level', need: 'Where your spreadsheet goes', us: 'Nowhere. It is read by your own browser and nothing is uploaded.', them: 'Ask. Some read the file on your machine, some upload it to theirs.' },
        { edge: 'us', need: 'Working the nine boxes out of your records', us: 'Standard accrual, cash accounting or the flat rate scheme, from the sheet you already keep, with the checks run over it first.', them: 'Some do the arithmetic; some expect the nine figures to be sitting in nine cells already. This is the first question to ask.' },
        { edge: 'us', need: 'Showing what each box is made of', us: 'Click “show rows” on any box and you get the rows that made it and what each one contributed, with the box 3 and box 5 identities re-checked afterwards rather than assumed.', them: 'Varies from a full drill-down to a cell reference.' },
        { edge: 'us', need: 'Catching a bad sheet before it is filed', us: 'Net plus VAT that does not equal gross, VAT that is not the stated rate, duplicate invoice references and rows outside the period — every one named by row number, and nothing quietly corrected.', them: 'Varies.' },
        { edge: 'us', need: 'Quarterly updates for income tax as well', us: 'The quarterly update builder maps your own category names onto the standard headings and cuts the year into its periods. It cannot file those either.', them: 'Depends on the product and which list it is on.' },
        { edge: 'us', need: 'Cost', us: 'Free. No account, no card, no per-return charge.', them: 'Charged per return or per year. The vendor has the figure; we will not guess at it.' }
      ]
    },
    buy: {
      heading: 'When you should buy bridging software — which is probably now',
      intro: 'If you are VAT registered, this is not a choice between us and them. It is a choice between them and them.',
      points: [
        'You are VAT registered and your records are in a spreadsheet. That is the exact case the category was invented for, and it is the cheap end of the market.',
        'You need the chain from your records to the submitted figures to be digital. Under Making Tax Digital you do, so use one product for the whole of it.',
        'You would rather not be the person who mistyped box 6 into a form at half past four.',
        'You want to see your obligations and what you owe without logging in somewhere else to look them up.',
        'Where we might fit alongside it: as the working. Produce the boxes here, open each one and check the rows behind it, then file through whatever you already use. The VAT tool says exactly that on its own page, and so does this one.'
      ]
    },
    groups: [
      { name: 'Work out what has to be filed', blurb: 'The figures and the working. Not the submission.', tools: ['/business/vat-return/', '/business/mtd-quarterly-update/', '/business/mtd-checker/'] },
      { name: 'Keep the digital records behind it', blurb: 'Because the link has to start somewhere real.', tools: ['/business/bookkeeping/', '/business/bank-reconciliation/', '/ai/bank-statement-categoriser/', '/business/sheet-merge/'] }
    ],
    faq: [
      { q: 'What is bridging software, in one sentence?', a: 'Software recognised by HMRC whose job is to take the figures out of your spreadsheet and submit them as a return, without being a full accounting package.' },
      { q: 'Do I still need it if I keep my books in a spreadsheet?', a: 'Yes, if you are filing under Making Tax Digital. Keeping records in a spreadsheet is allowed; submitting by hand is not. Bridging software is the recognised route from one to the other.' },
      { q: 'Is a spreadsheet still allowed at all?', a: 'The records themselves may be kept in one. What the rules bite on is the transfers: the data moving between the pieces of software involved has to move by digital link rather than by somebody retyping it. gov.uk is the authority on what counts, and on the exceptions.' },
      { q: 'Can I not just type the nine boxes into HMRC’s website?', a: 'Not under Making Tax Digital. The return goes through compatible software rather than being keyed into the VAT online account. Where an exemption has been agreed the position is different, and gov.uk is the place that settles it — not us.' },
      { q: 'Are you going to become recognised?', a: 'It is the intended next step and it is not done. Recognition means registering as a vendor, passing HMRC’s tests and meeting the fraud prevention header requirements on every call — an approval, not a feature we can write in an afternoon. Until we are on the list, every page here that touches a return will keep saying it cannot file.' },
      { q: 'How current is the guidance on this page?', a: 'What is described here is the shape of the regime rather than a set of figures. The tools that do carry figures each print the date they were last checked and link to the gov.uk page that settles them. gov.uk is the authority; this page is an explanation of it.' }
    ],
    collections: ['going-digital', 'accountants', 'freelancers'],
    sources: {
      heading: 'The authorities, rather than us',
      refs: [
        ['mtdVat', 'what Making Tax Digital for VAT requires, in HMRC’s own words'],
        ['mtdVatSoftware', 'the list of compatible software — the only thing that settles whether a product can file'],
        ['mtdItsaUse', 'quarterly updates, periods and the Final Declaration for income tax'],
        ['mtdItsaSoftware', 'the compatible software list for Making Tax Digital for Income Tax'],
        ['mtdItsaCheck', 'whether income tax reporting catches you yet, and from when']
      ]
    }
  }
];

module.exports = { COMPARISONS, REF, COMPETITORS };
