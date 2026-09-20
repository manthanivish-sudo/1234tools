/**
 * Collections: the way people actually look for a tool.
 *
 * The sidebar sorts tools by what they are — PDF, Business, Conversions.
 * Nobody arrives thinking "I need a Business tool". They arrive thinking
 * "I am an accountant and it is month end", or "I have to do a VAT return
 * and I do not know where to start". A category answers the first question
 * a librarian would ask; a collection answers the one the visitor is
 * actually asking.
 *
 * Two kinds, because there are two ways of asking:
 *   role — who you are. The page somebody bookmarks and comes back to.
 *   task — what you are doing today. The page somebody links to.
 *
 * Each collection names real pages by path. The builder resolves the title
 * and the description by reading the page itself, so a tool is described in
 * one place and a collection can never drift from it. A path that does not
 * exist stops the build rather than shipping a dead link.
 */
'use strict';

/* Free unless the path says otherwise: the AI tools need an account and
   have a monthly allowance, everything else runs in the browser and always
   will. Kept here because it is a fact about the product, not the page. */
const PRICING = {
  free: { key: 'free', label: 'Free', blurb: 'Runs in your browser. No account, no upload, no limit.' },
  freemium: { key: 'freemium', label: 'Free to try', blurb: 'Needs an account. Ten AI calls a month free, more on a paid plan.' }
};
const pricingFor = (path) => path.indexOf('/ai/') === 0 ? PRICING.freemium : PRICING.free;

const COLLECTIONS = [
  /* ---------------------------------------------------------------- */
  /* by role                                                           */
  /* ---------------------------------------------------------------- */
  {
    slug: 'accountants', kind: 'role', glyph: 'i-ledger',
    name: 'Accountants and bookkeepers',
    title: 'Free tools for accountants and bookkeepers',
    lede: 'The reconciliations, the conversions between packages, the returns and the chasing — without a subscription, and without a client’s books leaving your machine.',
    intro: [
      'Practice software is priced per client and billed per year, and most of what it does on a given Tuesday is arithmetic you could do yourself if the file were in the right shape. These tools do that part. They read the exports you already have — a bank statement, a GSTR-2B, a Tally day book, a sales ledger — and give back the reconciliation, the journal, the ageing or the return figures.',
      'Everything here runs inside your browser. A client’s ledger is not uploaded, queued or logged, which is what lets you put one through a free tool without a data processing agreement or an awkward conversation. The AI tools are the exception and say so on every page: they send the text you give them to a model, and they tell you exactly what is going before it goes.'
    ],
    groups: [
      { name: 'The books themselves', blurb: 'A double-entry ledger, and the statements that come out of it.', tools: ['/business/bookkeeping/', '/business/bank-reconciliation/', '/business/receivables-ageing/', '/business/invoice-payment-terms/'] },
      { name: 'VAT and Making Tax Digital', blurb: 'Figures you can check, from records you already keep.', tools: ['/business/vat-return/', '/business/mtd-checker/', '/business/mtd-quarterly-update/'] },
      { name: 'GST and Indian compliance', blurb: 'The monthly work, and the numbers that decide a claim.', tools: ['/business/gst-reconciler/', '/business/einvoice-json/', '/business/id-validator/', '/india/gst-calculator/', '/india/tds-calculator/'] },
      { name: 'Between packages', blurb: 'Getting data out of one system and into another without retyping it.', tools: ['/business/tally-converter/', '/business/accounting-converter/', '/business/sheet-merge/'] },
      { name: 'What the client sends you', blurb: 'Reading the paperwork, including the photographs of it.', tools: ['/ai/invoice-extractor/', '/ai/scanned-invoice-extractor/', '/ai/bank-statement-categoriser/', '/ai/receipt-batch-reader/', '/ai/form16-reader/'] }
    ],
    faq: [
      { q: 'Can I put a client’s data through these?', a: 'Through the browser tools, yes — the file is read by your own browser and never sent anywhere, so there is nothing to disclose and no processor to name. The AI tools are different and every one of them says so at the top of the page: the text goes to a model through our gateway. Personal identifiers are masked on your device first, and the page shows you exactly what will be sent before you send it.' },
      { q: 'Do these file anything?', a: 'No. They work out figures — the nine VAT boxes, a quarterly update, a GST reconciliation — and show you the rows behind each one. Filing under Making Tax Digital has to go through software HMRC has recognised, which is a separate approval we are working through.' },
      { q: 'What happens to my work when I close the tab?', a: 'It goes, unless you saved it. The bookkeeping tool writes the whole book to a file you keep; everything else hands you a spreadsheet or a PDF. That is the trade for nothing being stored on our side.' }
    ],
    related: ['month-end', 'going-digital', 'small-business']
  },
  {
    slug: 'small-business', kind: 'role', glyph: 'i-business',
    name: 'Small businesses and shops',
    title: 'Free tools for a small business',
    lede: 'Quotes, invoices, delivery notes, payroll, chasing money and working out whether any of it made a profit.',
    intro: [
      'A business with no finance department still has all the paperwork of one. These are the documents you have to produce and the sums you have to do, in tools that want nothing from you first — no trial, no card, no account for the ones that run in your browser.',
      'The documents come out as proper PDFs you would be happy to send a customer, and the calculations come out as spreadsheets you can keep. Where a tool applies a tax rate or a statutory rule, it says when those were last checked and links to the source, because they change and we would rather you knew.'
    ],
    groups: [
      { name: 'Before the sale', blurb: 'The paperwork that goes out before the money comes in.', tools: ['/pdf/quotation-pdf/', '/ai/quotation-writer/', '/pdf/purchase-order-pdf/'] },
      { name: 'The sale and the delivery', blurb: 'Invoices, challans and packing lists.', tools: ['/pdf/invoice-pdf/', '/pdf/delivery-challan-pdf/', '/business/einvoice-json/', '/pdf/label-pdf/'] },
      { name: 'Getting paid', blurb: 'Who owes you, for how long, and the letter that asks.', tools: ['/business/receivables-ageing/', '/business/invoice-payment-terms/', '/business/bank-reconciliation/'] },
      { name: 'Money in and money out', blurb: 'Whether the business is working, in numbers.', tools: ['/business/bookkeeping/', '/business/profit-margin/', '/business/break-even/', '/business/business-ratios/', '/business/discount-calculator/'] },
      { name: 'Words you have to write anyway', blurb: 'Drafts you edit, rather than a blank page.', tools: ['/ai/business-writer/', '/ai/review-responder/', '/ai/whatsapp-template-writer/', '/ai/product-listing-writer/'] }
    ],
    faq: [
      { q: 'Is any of this really free?', a: 'Every tool that runs in your browser is free and always will be — there is no server cost to us, which is the whole reason the site works this way. The AI tools cost us money per use, so an account gets ten calls a month free and a paid plan gets more. Every page tells you which kind it is before you start.' },
      { q: 'Do the documents look professional?', a: 'They are laid out as documents, not as printouts of a web page: your letterhead, your accent colour, the right blocks in the right places, and a signature area where one belongs. Have a look at the quotation or the delivery challan with the defaults in and judge for yourself before you type anything.' },
      { q: 'I am in India — does the GST work properly?', a: 'Yes, and the intra-state and inter-state split is worked out from the state codes in the GSTINs rather than being a box you tick, so it cannot disagree with the numbers on the document. Rates are in one place per tool with the date they were last checked against the CBIC.' }
    ],
    related: ['get-paid', 'accountants', 'freelancers']
  },
  {
    slug: 'schools', kind: 'role', glyph: 'i-timetable',
    name: 'Schools, teachers and tutors',
    title: 'Free tools for schools and teachers',
    lede: 'The timetable, the seating plan, the report cards, the letters home — the August and December work, done in an afternoon.',
    intro: [
      'School administration is a small number of genuinely hard problems surrounded by a large amount of copying. Building a clash-free timetable is hard. Producing thirty-five report cards from a marks sheet is not hard, it is just long. These tools take both off the pile.',
      'Nothing about a pupil is uploaded. Names, marks and attendance are read by your own browser and the results are written there too, which is what lets a school use these without a data processing agreement or a parent’s consent form. The AI tools that help with wording do send text to a model, and each says so plainly on its page.'
    ],
    groups: [
      { name: 'Running the school year', blurb: 'The two jobs that eat a week each.', tools: ['/education/timetable/', '/education/exam-seating/'] },
      { name: 'Assessment and reporting', blurb: 'Marks in, paperwork out.', tools: ['/education/report-card/', '/education/marks-percentage/', '/education/attendance-calculator/', '/education/percentile-rank/', '/education/cgpa-to-percentage/'] },
      { name: 'Teaching', blurb: 'Papers, plans and the marking scheme to go with them.', tools: ['/ai/question-paper-writer/', '/ai/lesson-plan-writer/', '/ai/rubric-writer/', '/ai/ncert-solution-writer/'] },
      { name: 'Talking to parents', blurb: 'Comments and letters that say something specific.', tools: ['/ai/student-comment-writer/', '/ai/parent-message-writer/'] },
      { name: 'Certificates and admin', blurb: 'The rest of the office work.', tools: ['/pdf/certificate-pdf/', '/business/mail-merge/', '/business/sheet-merge/', '/education/exam-countdown/'] }
    ],
    faq: [
      { q: 'Can the timetable really handle our school?', a: 'It holds the hard rules absolutely — no teacher in two rooms, no class with two lessons, unavailable days left empty, daily maximums respected, double periods adjacent and never across a break — and then tries for the soft ones, like spreading a subject across the week and keeping teachers’ free periods together. When something genuinely cannot fit it names the class, the teacher and the arithmetic instead of producing a quiet bad plan.' },
      { q: 'Is pupil data safe?', a: 'The file never leaves the device for any of the school tools. That is not a policy, it is how they are built — there is no upload in the code. The three AI tools for teaching do send what you type to a model, and their pages say so in the first line and again before you press the button.' },
      { q: 'Which grading scale does the report card use?', a: 'Whichever you pick — CBSE A1 to E, percentage bands, a ten-point GPA, GCSE 9 to 1, or your own. The scale is printed on the card so a parent can see how a grade was arrived at. Boards change their bands, so the page says when those were last checked and links to the board.' }
    ],
    related: ['start-of-term', 'accountants']
  },
  {
    slug: 'hr-payroll', kind: 'role', glyph: 'i-payslip',
    name: 'HR and payroll',
    title: 'Free tools for HR and payroll',
    lede: 'Offer to payslip to final settlement, with the arithmetic shown and nothing about an employee uploaded.',
    intro: [
      'Payroll is a monthly deadline that does not move, and most of the work is the same every month with different numbers. These tools take the salary sheet you already keep and produce what the month needs: payslips, the bank transfer file, the statutory summaries.',
      'Salary is the most sensitive figure most people have, which is why none of it is sent anywhere. Where a statutory rate is applied it sits in one clearly marked place in the tool, with the date it was last checked and a link to EPFO, ESIC or the Income Tax Department, because those move and a number that quietly went stale is worse than no number.'
    ],
    groups: [
      { name: 'Hiring and the offer', blurb: 'What the job pays, and what the offer says.', tools: ['/business/ctc-structure/', '/ai/job-description-writer/', '/ai/cv-screener/', '/ai/contract-generator/'] },
      { name: 'The monthly run', blurb: 'One sheet in, everything the month needs out.', tools: ['/business/payroll-run/', '/pdf/payslip-pdf/', '/business/employer-cost/'] },
      { name: 'When somebody leaves', blurb: 'What they are owed, itemised so nobody argues.', tools: ['/business/full-final-settlement/', '/india/gratuity-calculator/'] },
      { name: 'What people ask you', blurb: 'The calculators an employee sends you a message about.', tools: ['/india/ctc-take-home/', '/india/hra-exemption/', '/india/epf-calculator/', '/business/uk-take-home-pay/', '/ai/form16-reader/'] }
    ],
    faq: [
      { q: 'Does the payroll run compute TDS?', a: 'No, and that is deliberate. A month’s deduction depends on the projected annual income, the regime the employee chose, their declarations and the year to date — none of which is in a salary sheet. TDS is taken from your sheet as you have worked it out. Everything else, including the PF split between EPS and EPF, is computed and shown.' },
      { q: 'What if somebody’s net pay comes out negative?', a: 'Nothing is written at all, and the person is named. A payroll run that quietly pays somebody a negative amount is worse than one that stops, so it stops.' },
      { q: 'Are the tax slabs current?', a: 'They are as last checked, and the page says when that was and links to the source. They sit in one marked block in the tool so that when a Budget moves them there is a single place to correct. Check them before you rely on a rupee figure — the page says that too.' }
    ],
    related: ['month-end', 'small-business']
  },
  {
    slug: 'freelancers', kind: 'role', glyph: 'i-quotation',
    name: 'Freelancers and contractors',
    title: 'Free tools for freelancers and contractors',
    lede: 'Quote, invoice, chase, and work out what you actually owe — without a monthly subscription for four documents a month.',
    intro: [
      'Working for yourself means being the sales department, the accounts department and the person who does the work. The accounts part is a handful of documents and a handful of sums, and paying a monthly fee for them stings when you send six invoices a quarter.',
      'These are the ones that come up. They run in your browser, so there is nothing to sign up for and nothing to cancel, and your client list is not sitting on somebody’s server.'
    ],
    groups: [
      { name: 'Winning the work', blurb: 'The quote, and the words around it.', tools: ['/pdf/quotation-pdf/', '/ai/quotation-writer/', '/ai/business-writer/'] },
      { name: 'Billing and being paid', blurb: 'Out, and then chased.', tools: ['/pdf/invoice-pdf/', '/business/invoice-payment-terms/', '/business/receivables-ageing/'] },
      { name: 'Tax and what you keep', blurb: 'Before the money feels like yours.', tools: ['/business/mtd-checker/', '/business/mtd-quarterly-update/', '/business/vat-return/', '/business/uk-take-home-pay/', '/india/advance-tax/'] },
      { name: 'The rest of it', blurb: 'Paperwork, files and the occasional awkward email.', tools: ['/pdf/merge-pdf/', '/pdf/pdf-signature/', '/pdf/watermark-pdf/', '/ai/document-summariser/'] }
    ],
    faq: [
      { q: 'Am I caught by Making Tax Digital?', a: 'If you are self-employed or a landlord it depends on your qualifying income — which is gross, before a single expense, added up across everything you do. That is the part people get wrong. The checker works it out and tells you which band you are in and from when.' },
      { q: 'Do I need an account for any of this?', a: 'Only for the AI tools. Everything that runs in the browser — the documents, the calculators, the reconciliations — needs nothing at all.' },
      { q: 'Can I use the invoice generator commercially?', a: 'Yes. The documents are yours; there is no watermark, no branding of ours on them and no limit on how many you make.' }
    ],
    related: ['get-paid', 'going-digital', 'small-business']
  },
  {
    slug: 'developers', kind: 'role', glyph: 'i-code',
    name: 'Developers and web teams',
    title: 'Free tools for developers',
    lede: 'Format, convert, encode, inspect — in a page that does it on the clipboard rather than on a server.',
    intro: [
      'Most developer utilities on the web are a text box that posts your input to somebody’s backend. That is fine for a lorem ipsum generator and not fine for a JWT, a config file or a customer export. These run entirely in the page.',
      'No sign-up, no rate limit, and they keep working with the network off — the site installs as an app if you want it on a laptop that is sometimes on a train.'
    ],
    groups: [
      { name: 'Data and formats', blurb: 'Between the shapes things arrive in.', tools: ['/developer/json-formatter/', '/developer/csv-to-json/', '/developer/base64/', '/developer/url-encoder/'] },
      { name: 'Text', blurb: 'The everyday ones.', tools: ['/developer/case-converter/', '/text/word-counter/', '/text/text-diff/', '/developer/lorem-ipsum/'] },
      { name: 'Files and images', blurb: 'Quick jobs that do not deserve an upload.', tools: ['/image/image-compressor/', '/image/image-to-pdf/', '/pdf/pdf-inspector/', '/qr/qr-code-generator/'] },
      { name: 'Writing about the work', blurb: 'For when the ticket has to become English.', tools: ['/ai/document-summariser/', '/ai/meeting-minutes/', '/ai/excel-formula-helper/'] }
    ],
    faq: [
      { q: 'Does anything I paste get sent anywhere?', a: 'Not from the browser tools — open the network tab and watch. That is the point of them. The AI tools do send what you give them, and say so on the page.' },
      { q: 'Do these work offline?', a: 'Yes. The site is a progressive web app and each tool can be installed on its own; once a page has loaded it keeps working with no connection at all.' }
    ],
    related: ['small-business']
  },

  /* ---------------------------------------------------------------- */
  /* by task                                                           */
  /* ---------------------------------------------------------------- */
  {
    slug: 'month-end', kind: 'task', glyph: 'i-bank-recon',
    name: 'Close the month',
    title: 'Month-end close: free tools for the whole routine',
    lede: 'Reconcile the bank, match the GST, run the payroll, age the debtors and produce the statements — in the order you actually do them.',
    intro: [
      'Month end is the same list every month, and the reason it takes three days is not difficulty but shuffling: exports that do not line up, names spelled differently in two systems, a figure that has to be recomputed because somebody changed an invoice. These are the tools for each step, roughly in the order the step comes.',
      'Each one takes what the previous one produced. The bank statement categoriser writes a sheet the bookkeeping tool imports without being touched; the bookkeeping tool produces the trial balance the statements come from.'
    ],
    groups: [
      { name: '1 · Get the transactions in', blurb: 'Statements and paperwork into something structured.', tools: ['/ai/bank-statement-categoriser/', '/ai/invoice-extractor/', '/ai/receipt-batch-reader/', '/business/sheet-merge/'] },
      { name: '2 · Reconcile', blurb: 'Make two systems agree, and see where they do not.', tools: ['/business/bank-reconciliation/', '/business/gst-reconciler/', '/business/receivables-ageing/'] },
      { name: '3 · Post and report', blurb: 'The books, and what comes out of them.', tools: ['/business/bookkeeping/', '/business/vat-return/', '/business/mtd-quarterly-update/'] },
      { name: '4 · Pay people', blurb: 'The deadline inside the deadline.', tools: ['/business/payroll-run/', '/pdf/payslip-pdf/'] }
    ],
    faq: [
      { q: 'Do these hand off to each other?', a: 'Where it is useful, yes. The categoriser’s sheet imports into the bookkeeping tool with its ledger names matched to accounts, and anything it cannot match goes to Suspense and is listed rather than guessed. The rest exchange ordinary spreadsheets, which is deliberate — you can always see and edit what passes between them.' },
      { q: 'What if the reconciliation will not balance?', a: 'You are told by how much and shown what is on each side that did not match, with a likely reason against each — a bank charge nobody entered, a cheque not yet presented. Nothing is forced to agree.' }
    ],
    related: ['accountants', 'get-paid', 'going-digital']
  },
  {
    slug: 'get-paid', kind: 'task', glyph: 'i-ageing',
    name: 'Get paid faster',
    title: 'Get paid faster: free invoicing and chasing tools',
    lede: 'Invoice properly, know exactly who owes what and for how long, and send a reminder that names the invoices.',
    intro: [
      'Most unpaid invoices are not disputes. They are invoices that were never chased, or chased with an email saying "your account is overdue" that the recipient could not act on because it did not say which invoice. The fix is unglamorous: an ageing report and a letter with numbers in it.',
      'Start with the document being right, then know the position, then ask — with the tone stepping up only as far as it needs to.'
    ],
    groups: [
      { name: 'Invoice properly in the first place', blurb: 'Clear terms and a due date beat a chase.', tools: ['/pdf/invoice-pdf/', '/business/invoice-payment-terms/', '/pdf/quotation-pdf/'] },
      { name: 'Know the position', blurb: 'By customer, by age, oldest first.', tools: ['/business/receivables-ageing/', '/business/bank-reconciliation/', '/business/bookkeeping/'] },
      { name: 'Ask, then ask again', blurb: 'Reminders that name the invoices and the total.', tools: ['/business/receivables-ageing/', '/ai/business-writer/', '/business/mail-merge/'] }
    ],
    faq: [
      { q: 'What do the reminder letters say?', a: 'They list the customer’s overdue invoices with dates, amounts and how many days late each is, then a total, then what you would like to happen. The tone steps up on its own — a note at a fortnight, a firmer letter at six weeks, a final one after that — and none of them threatens legal action. They are drafts with your name on them; read them before sending.' },
      { q: 'Can I charge interest on a late payment?', a: 'In the UK there is a statutory right to interest and a fixed sum on a late commercial payment, and the page links to the gov.uk guidance. The tool does not calculate it, because whether you are entitled and at what rate depends on your contract — but whatever terms line you type is printed under every letter.' }
    ],
    related: ['small-business', 'freelancers', 'month-end']
  },
  {
    slug: 'going-digital', kind: 'task', glyph: 'i-mtd-check',
    name: 'Going digital for MTD',
    title: 'Making Tax Digital: work out where you stand and what to send',
    lede: 'Whether it applies to you, from when, and the figures each quarterly update and VAT return needs.',
    intro: [
      'Making Tax Digital for VAT has applied to every VAT-registered business since April 2022. Making Tax Digital for Income Tax reached its first band in April 2026, and it is catching people who have never used accounting software and have an accountant only once a year, if that.',
      'The first question is whether you are in, and the answer turns on qualifying income — which is gross, before expenses, added across every trade and every property. That single definition is why so many people believe they are out. Work that out first, then worry about the rest.'
    ],
    groups: [
      { name: 'Where do I stand?', blurb: 'The question to answer before anything else.', tools: ['/business/mtd-checker/'] },
      { name: 'What do I send, and when?', blurb: 'The figures, the periods and the deadlines.', tools: ['/business/mtd-quarterly-update/', '/business/vat-return/'] },
      { name: 'Keeping records digitally', blurb: 'What "digital records" has to mean in practice.', tools: ['/business/bookkeeping/', '/business/bank-reconciliation/', '/ai/bank-statement-categoriser/', '/business/sheet-merge/'] }
    ],
    faq: [
      { q: 'Can I file my return from here?', a: 'Not yet, and we will not pretend otherwise. These tools work out the figures and show you every row behind each one. Filing has to go through software HMRC has recognised, which involves registering as a vendor, passing their tests and sending fraud prevention headers with every call — an approval, not a feature. We are working through it.' },
      { q: 'What counts as qualifying income?', a: 'Gross income before any expense: turnover from self-employment plus gross rents from UK and overseas property, added together. Not profit, and not one business on its own. Employment income, pensions, dividends, savings interest and capital gains are not counted.' },
      { q: 'How current is the guidance here?', a: 'Every threshold and date sits in one marked block in each tool, with the date it was last checked printed on the page and a link to the gov.uk page that settles it. The pages also list the specific points we are least sure of, rather than presenting everything as equally certain.' }
    ],
    related: ['accountants', 'freelancers', 'month-end']
  },
  {
    slug: 'start-of-term', kind: 'task', glyph: 'i-exam-seating',
    name: 'Start of the school year',
    title: 'Start of term: timetables, seating plans and the admin behind them',
    lede: 'The August week: build the timetable, seat the exams, set up the registers and get the letters out.',
    intro: [
      'The school year starts with a fortnight of work that is entirely front-loaded and mostly done by one or two people with a spreadsheet. Two jobs dominate — the timetable and, once exams come round, the seating — and both are the kind of problem a computer is good at and a person is not.',
      'Everything here reads the sheets a school already keeps: the subject allocation, the class list, the room list. Nothing about a pupil or a member of staff is uploaded.'
    ],
    groups: [
      { name: 'The timetable', blurb: 'Allocation in, clash-free week out.', tools: ['/education/timetable/'] },
      { name: 'Exams', blurb: 'Seating that no invigilator can argue with.', tools: ['/education/exam-seating/', '/education/exam-countdown/'] },
      { name: 'Setting up', blurb: 'Lists, registers and the first letters home.', tools: ['/business/sheet-merge/', '/business/mail-merge/', '/ai/parent-message-writer/', '/pdf/certificate-pdf/'] },
      { name: 'Ready for the first assessment', blurb: 'So December is not another fortnight.', tools: ['/education/report-card/', '/ai/question-paper-writer/', '/ai/rubric-writer/'] }
    ],
    faq: [
      { q: 'What does the timetable need from me?', a: 'The subject allocation your school already writes: one row per class, subject, teacher and periods a week. Column names are matched for you. Teachers’ unavailable days and fixed periods like assembly go in two text boxes.' },
      { q: 'How long does it take?', a: 'Seconds. The worked example — four classes, eleven teachers, a hundred and forty periods — settles in well under a second, and you can change the seed to get a different arrangement of the same allocation.' }
    ],
    related: ['schools']
  }
];

/* A second batch may live in build/collections-extra.js, exporting an
   array in exactly this shape. Kept separate so it can be written and
   reviewed without touching the ones already shipped. */
let EXTRA = [];
try { EXTRA = require('./collections-extra.js').COLLECTIONS || []; } catch (e) { /* none yet */ }
const ALL = COLLECTIONS.concat(EXTRA);

module.exports = { COLLECTIONS: ALL, PRICING, pricingFor };
