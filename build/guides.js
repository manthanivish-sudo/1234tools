/**
 * Guides: how to finish a job, not how to rank for it.
 *
 * A collection answers "which tool"; a guide answers "how do I do this at
 * all". The difference matters. Somebody who has never done a VAT return
 * does not need a list of VAT tools, they need to be told what goes in box
 * 6 and what does not, and why their spreadsheet disagrees with itself.
 *
 * Three rules hold this file together.
 *
 * 1. Every guide says where it goes wrong. A page that describes only the
 *    happy path is a page written by somebody who has not done the job.
 *    `wrong` is required and is checked for at least three named failure
 *    modes, because "be careful" is not a failure mode — "the credit note
 *    that is not negative" is.
 *
 * 2. No rate, threshold or deadline is stated as current fact in running
 *    prose. Anything of that kind goes in a `fact` block, which must carry
 *    a `checked` date and at least one source on an authority's own domain
 *    (gov.uk, the GST portal, CBIC, EPFO, ESIC, the Income Tax Department,
 *    legislation.gov.uk). The builder refuses to write a fact block without
 *    one. A figure in a worked example is different — it is invented, not
 *    claimed — so an `example` block must say so in its caption, and the
 *    builder checks that too.
 *
 * 3. A tool is described once. `tools` names the paths; the builder reads
 *    each tool's own title and description out of its own page, exactly as
 *    build-collections.js does, so a guide cannot drift from what it links
 *    to. Inside a step a tool is linked by title only, never re-described,
 *    and a path that does not resolve stops the build.
 *
 * Block types inside a step:
 *   { p }        a paragraph
 *   { ul }       bullets
 *   { ol }       a numbered list inside a step
 *   { formula }  one line of arithmetic, in the mono face
 *   { tool, why} link the tool that does this step, and say what it does here
 *   { fact }     a rate, threshold or deadline, with `checked` and `sources`
 *   { example }  invented figures, with a caption that says they are invented
 */
'use strict';

/* Where a figure is allowed to come from. A fact block whose sources are
   all blogs is not a dated figure, it is a rumour with a date on it. */
const AUTHORITIES = [
  'gov.uk', 'www.gov.uk', 'legislation.gov.uk', 'www.legislation.gov.uk',
  'justice.gov.uk', 'www.justice.gov.uk', 'bankofengland.co.uk', 'www.bankofengland.co.uk',
  'gst.gov.in', 'www.gst.gov.in', 'cbic-gst.gov.in', 'www.cbic-gst.gov.in', 'cbic.gov.in',
  'epfindia.gov.in', 'www.epfindia.gov.in', 'esic.gov.in', 'www.esic.gov.in',
  'incometax.gov.in', 'www.incometax.gov.in', 'incometaxindia.gov.in', 'www.incometaxindia.gov.in',
  'labour.gov.in', 'www.labour.gov.in'
];

/* The same URLs the tools themselves cite, written once. These mirror
   build/sources.js; they are repeated rather than imported so that a guide
   keeps working if that table is reorganised. */
const SRC = {
  ukVatRates: ['gov.uk — VAT rates on different goods and services', 'https://www.gov.uk/vat-rates'],
  ukVatThresholds: ['gov.uk — VAT registration thresholds', 'https://www.gov.uk/vat-registration/thresholds'],
  ukVatReturn: ['gov.uk — VAT Notice 700/12: how to fill in and submit your VAT Return', 'https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012'],
  ukVatFlatRate: ['gov.uk — VAT Notice 733: flat rate scheme for small businesses', 'https://www.gov.uk/guidance/flat-rate-scheme-for-small-businesses-vat-notice-733'],
  ukVatCash: ['gov.uk — VAT Notice 731: cash accounting scheme', 'https://www.gov.uk/guidance/vat-cash-accounting-scheme-notice-731'],
  ukMtdVat: ['gov.uk — Use Making Tax Digital for VAT', 'https://www.gov.uk/guidance/use-making-tax-digital-for-vat'],
  ukMtdVatSoftware: ['gov.uk — Find software compatible with Making Tax Digital for VAT', 'https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-vat'],
  ukMtdItsaCheck: ['gov.uk — Check if you are eligible for Making Tax Digital for Income Tax', 'https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax'],
  ukMtdItsaUse: ['gov.uk — Use Making Tax Digital for Income Tax', 'https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax'],
  ukMtdItsaSoftware: ['gov.uk — Find software compatible with Making Tax Digital for Income Tax', 'https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax'],
  ukSaForms: ['gov.uk — Self Assessment forms and helpsheets', 'https://www.gov.uk/self-assessment-forms-and-helpsheets'],
  ukLatePayment: ['gov.uk — Late commercial payments: charging interest and debt recovery', 'https://www.gov.uk/late-commercial-payments-interest-debt-recovery'],
  ukLatePaymentAct: ['legislation.gov.uk — Late Payment of Commercial Debts (Interest) Act 1998', 'https://www.legislation.gov.uk/ukpga/1998/20/contents'],
  ukBaseRate: ['Bank of England — Bank Rate', 'https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate'],
  ukDebtProtocol: ['Ministry of Justice — Pre-Action Protocol for Debt Claims', 'https://www.justice.gov.uk/courts/procedure-rules/civil/protocol/pre-action-protocol-for-debt-claims'],
  ukMakeCourtClaim: ['gov.uk — Make a court claim for money', 'https://www.gov.uk/make-court-claim-for-money'],
  inGstPortal: ['Goods and Services Tax portal', 'https://www.gst.gov.in/'],
  inGstRates: ['CBIC-GST — rates, notifications and the tariff', 'https://cbic-gst.gov.in/'],
  inEpfo: ['EPFO — contribution rates, the wage ceiling and the ECR', 'https://www.epfindia.gov.in/'],
  inEsic: ['ESIC — contribution rates, the wage limit and the contribution periods', 'https://www.esic.gov.in/'],
  inIncomeTax: ['Income Tax Department, India', 'https://www.incometax.gov.in/'],
  inIncomeTaxActs: ['Income Tax India — Acts, rules and the Finance Act', 'https://incometaxindia.gov.in/'],
  inLabour: ['Ministry of Labour and Employment', 'https://labour.gov.in/']
};

const src = (key, note) => { const s = SRC[key]; return note ? [s[0], s[1], note] : [s[0], s[1]]; };

/* Every fact block on the site was compared against its source on this
   date. One date, in one place, so that a review is one pass. */
const CHECKED = '2026-09-20';

const GUIDES = [

  /* ================================================================== */
  {
    slug: 'reconcile-gstr-2b',
    glyph: 'i-gst-recon',
    name: 'How to reconcile GSTR-2B against your purchase register',
    title: 'How to reconcile GSTR-2B against your purchase register',
    description: 'Match your purchase register to GSTR-2B invoice by invoice, decide what to do about the four piles that are left, and keep the working behind the input tax credit you claim.',
    answer: 'Match every purchase invoice in your books to a line in GSTR-2B on supplier GSTIN and invoice number, claim the credit that matches, and work through what is left — because the statement, not the invoice in your file, is what decides the claim.',
    minutes: { first: 'the better part of a morning', again: 'under an hour' },
    howLong: 'The first month is slow, because the first month is when you find out that three suppliers have your old GSTIN and that your register calls an invoice number something the portal does not. Budget the better part of a morning for it. After that a month is under an hour: download, map, run, and work through a mismatch list that gets shorter as the suppliers who cause it get chased.',
    before: [
      'The GSTR-2B for the month you are claiming, downloaded from the GST portal. Take the JSON if you can — it carries the credit and debit note sections that a hand-made Excel summary usually loses. Do not use 2A for this: 2A keeps moving as suppliers file, 2B is generated once and then stands still, and only a statement that stands still can be reconciled.',
      'Your purchase register for the same period: one row per invoice, with supplier GSTIN, invoice number, invoice date, taxable value, and IGST, CGST, SGST and cess as separate amounts. If your package exports a single "tax" column you will have to split it, because that is the column the differences show up in.',
      'Last month’s unmatched list. You will need it. An invoice a supplier files late appears in a later month’s 2B, and if you start fresh every month it never gets matched at all.',
      'Somewhere to record what you decided about every mismatch. The reconciliation is the working behind the claim. It is also the first thing anybody asks for if the claim is questioned, and it is very hard to reconstruct a year later.'
    ],
    steps: [
      {
        name: 'Download the right statement for the right period',
        body: [
          { p: 'On the portal, GSTR-2B sits under Returns for the period you are claiming. Download it as JSON if the option is there. The JSON is structured, not formatted: the supplier’s GSTIN is a field called ctin, the invoice number is inum, the date is idt in day-month-year, and the amounts are txval, igst, cgst, sgst and cess.' },
          { p: 'What matters is which sections it holds. B2B is the ordinary invoice section. B2BA holds amendments — a supplier correcting an invoice they filed wrongly last month. CDNR holds credit and debit notes, and each note carries a type: a credit note reduces your credit, a debit note increases it. CDNRA amends those. Anything that reads only the B2B section will silently ignore every credit note your suppliers raised, and overstate the credit you think you can claim.' },
          { p: 'Excel works too, and the same reconciliation runs on it, but a downloaded Excel summary is a flatter document — check before you start that the credit notes are in it and that they are signed.' }
        ]
      },
      {
        name: 'Get your purchase register into a shape that can be matched',
        body: [
          { p: 'One row per invoice, with these columns. The names do not have to be exact — Bill No, Supplier Invoice No, Party GSTIN and Taxable Amount are all recognised and every mapping is shown for you to correct — but the columns have to exist.' },
          { ul: [
            'Supplier GSTIN. This and the invoice number are the key the whole reconciliation turns on.',
            'Invoice number, as the supplier wrote it on the tax invoice.',
            'Invoice date.',
            'Taxable value, before tax.',
            'IGST, CGST, SGST and cess, each in its own column. A single combined tax figure hides the most common error there is, which is an invoice taxed as intra-state by one side and inter-state by the other.'
          ] },
          { p: 'If the register lives in twelve files — one per branch, one per person who types — stack them into one sheet first. Columns are matched by heading, so the branches can have them in different orders.' },
          { tool: '/business/sheet-merge/', why: 'stacks up to ten workbooks into one sheet, matching columns by heading, and lists every duplicate row it removes with the file and row it came from' }
        ]
      },
      {
        name: 'Check the GSTINs before you match anything',
        body: [
          { p: 'The match is keyed on GSTIN plus invoice number. A GSTIN that is wrong cannot match anything, ever — and the row will not look wrong. It will look like a supplier who has not filed, which is a different problem with a different remedy, and you will spend an afternoon chasing a supplier who filed on time.' },
          { p: 'A GSTIN carries a checksum in its last character, so most typing errors are catchable without going anywhere near the portal. Two characters swapped by a tired hand almost always fails the check. Run the whole column through the validator and fix the failures before you reconcile; it is thirty seconds against an afternoon.' },
          { tool: '/business/id-validator/', why: 'checks a whole column of GSTINs for format and checksum and gives the reason for each failure, without looking anything up' },
          { p: 'What a checksum cannot tell you is whether a GSTIN is real, active, or the right one for that supplier. Only the portal knows that. What it tells you is that this string could not be anybody’s GSTIN, which is enough to catch the transpositions.' }
        ]
      },
      {
        name: 'Run the match',
        body: [
          { p: 'Drop the 2B on one side and the register on the other, check the column mapping the tool proposes, and run it.' },
          { tool: '/business/gst-reconciler/', why: 'reads the portal’s JSON or an Excel export, matches it against your register, and returns the matched, the differing, the unclaimed and the unfiled as four separate lists' },
          { p: 'It matches twice. The first pass is on supplier GSTIN plus a normalised invoice number: capitals, spaces, slashes and dashes are ignored, and a leading zero before a digit is dropped, so INV/2026/0042 and inv-2026-42 are the same invoice. The second pass takes what is left and looks for the same supplier, the same trailing number, a date within a few days and a taxable value that is close — which is how an invoice booked on the day it arrived rather than the day it was raised still finds its partner.' },
          { p: 'Everything else falls into one of four piles, and the piles are the point of the exercise.' }
        ]
      },
      {
        name: 'Read the four piles',
        body: [
          { ul: [
            'Matched. Same supplier, same invoice, and the tax agrees within a rupee. This is the credit you can claim without doing anything else.',
            'Tax differs, or the taxable value differs. Matched to the right invoice, but the numbers disagree by more than rounding. Almost always a rate applied differently by the two sides, or freight and insurance included in one taxable value and not the other.',
            'In 2B, not in your books. The supplier has reported an invoice you have not recorded. Either you have missed a purchase, or the invoice is not yours.',
            'In your books, not in 2B. You hold an invoice the supplier has not reported. This is the pile that costs money.'
          ] },
          { p: 'The sizes tell you something before you read a single row. A large "in books, not in 2B" pile in month one is usually a column mapping problem or a GSTIN problem, not two hundred delinquent suppliers. A large "in 2B, not in books" pile is usually a branch whose purchases have not been entered yet.' }
        ]
      },
      {
        name: 'Decide what to do with each row, and write the decision down',
        body: [
          { ol: [
            'Tax differs by a rupee or two: leave it. Rounding at the line level against rounding at the invoice level does this, and chasing it costs more than it is worth.',
            'Tax differs by a real amount: find out which side is wrong before you claim. If the supplier has charged CGST and SGST where the place of supply makes it IGST, the credit is not simply available and a corrected invoice is the remedy, not a journal.',
            'In 2B, not in books, and it is genuinely your purchase: book it. This is free money you were about to leave on the table.',
            'In 2B, not in books, and it is not yours: tell the supplier. Somebody has typed your GSTIN onto another customer’s invoice, and the credit sitting in your statement is not yours to claim.',
            'In books, not in 2B, and the supplier is one you buy from every month: it will very likely appear next month, because they filed late. Carry it forward and match it then.',
            'In books, not in 2B, and it has been carried forward for months: this is now a commercial conversation, not an accounting one. You have paid tax to somebody who has not passed it on.'
          ] },
          { p: 'Write the decision against the row, not in your head. The four lists download as a workbook with a column for exactly this, and next month you will want to know why you left a difference alone.' }
        ]
      },
      {
        name: 'Claim what the statement supports, and keep the working',
        body: [
          { fact: {
            text: 'Input tax credit is available only where the supplier has actually reported the supply, which is what makes GSTR-2B the document that decides the claim rather than the invoice in your file. There are further conditions — you must hold the invoice, have received the goods or services, and the tax must have been paid — and there is a cut-off after which credit for an old invoice can no longer be taken. The conditions and the cut-off are set by the Act and moved by notification.',
            checked: CHECKED,
            sources: [src('inGstPortal', 'GSTR-2B, and the conditions for claiming input tax credit'), src('inGstRates', 'notifications, circulars and the tariff')]
          } },
          { p: 'The claim you file is a figure; the reconciliation is the evidence for it. Keep the workbook with the return for that period, with the decisions in it. If you claim less than 2B allows because you have not booked an invoice yet, note that too — the difference between your claim and the statement is a question somebody may ask.' }
        ]
      },
      {
        name: 'Carry the unmatched forward and chase the suppliers who caused them',
        body: [
          { p: 'Take the "in books, not in 2B" list, add it to last month’s carry-forward, and drop the combined list into next month’s reconciliation. An invoice that has been sitting there for three months with a supplier you still buy from is worth a phone call from somebody senior, with the invoice numbers and the amount in front of them.' },
          { p: 'Sort the carry-forward by supplier rather than by invoice before you make that call. One supplier with eleven unfiled invoices is one conversation; eleven suppliers with one each is a different problem, and usually means the fault is at your end.' }
        ]
      }
    ],
    wrong: [
      { name: 'The credit note that is not negative',
        text: 'In the portal’s JSON a credit note carries a type, and a credit note reduces the credit available to you. Most purchase registers do not hold it that way: the note comes out of the accounting package as a positive amount in a separate document type, or on a separate sheet, or as a row that looks exactly like an invoice. Stack it in as a positive taxable value and your register is overstated by twice the note — once because the credit was not removed, once because it was added. It shows up as a large unexplained difference on the supplier’s total while every individual invoice matches, which is a maddening thing to look for if you do not know it is there.' },
      { name: 'Imports and ISD credit are not in the part of the statement that gets matched',
        text: 'A bill of entry is not a B2B invoice. Import credit sits in its own section of 2B, as does credit distributed by an input service distributor, and a reconciliation that reads the invoice and credit note sections — which is what this one does — will not find them. Every bill of entry in your register lands in "in books, not in 2B" and looks like an unfiled supplier. Take the imports out of the register before you reconcile and check them against the portal’s import section separately, or you will chase a customs house for a GSTR-1.' },
      { name: 'A GSTIN with two characters swapped',
        text: 'The whole match is keyed on GSTIN plus invoice number, so a GSTIN that is one transposition away from correct matches nothing. It does not announce itself: the row appears in "in books, not in 2B", which is the pile that means "the supplier has not filed". The check is a checksum, it takes seconds on a whole column, and it is the single highest-value thing to do before the first run. The same applies to a supplier who has changed state and therefore changed GSTIN mid-year while your master data still holds the old one.' },
      { name: 'Starting fresh every month',
        text: 'Suppliers file late. An invoice dated in one month, filed two months afterwards, appears in the later month’s 2B. If each month is reconciled from a clean slate, that invoice is unmatched in its own month and unmatched again in the month it finally appears, because the register has moved on. The carry-forward list is not administrative neatness; without it a normal amount of supplier lateness looks like a permanent hole in the credit.' },
      { name: 'The invoice number your purchase clerk typed',
        text: 'Punctuation, capitals and leading zeros are normalised away, so those cost you nothing. What does not normalise is the wrong number entirely: the delivery note number, the purchase order number, or the supplier’s internal reference copied off the top of the page instead of the tax invoice number underneath it. The second matching pass catches some of these by supplier, amount and date, but only if the taxable value is close and the dates are within a few days. Where a supplier’s document numbering is genuinely strange, fix the register rather than the reconciliation.' },
      { name: 'Treating every difference as an error',
        text: 'A difference of a rupee is rounding, and the tool leaves it alone on purpose. A difference of a few hundred on a large invoice is usually freight or insurance in the taxable value on one side only. A difference that is exactly the tax is the intra-state and inter-state split disagreeing — you have booked CGST and SGST, the supplier has reported IGST, or the reverse — and that one is not a rounding question, it is a question about where the supply took place, and it changes what you may claim.' }
    ],
    faq: [
      { q: 'Does this claim the credit for me?', a: 'No. It works out which invoices are supported by the statement and which are not, and gives you the four lists and the totals. You still take the figure into your return through whatever you file with. Nothing here connects to the portal and nothing is sent anywhere.' },
      { q: 'JSON or Excel — does it matter?', a: 'Take the JSON when you can. It carries the invoice section, the amendment section and the credit and debit note sections separately and signs the notes correctly. An Excel summary is flatter and, depending where it came from, may not carry the notes at all, which is the most expensive thing to lose.' },
      { q: 'What about invoices in 2B that belong to a different period?', a: 'They are matched on supplier and invoice number, not on the month, so an invoice dated in March that a supplier files in June still matches the March entry in your register if you reconcile the carried-forward list alongside the current month. That is the whole reason for keeping the carry-forward.' },
      { q: 'Is the register uploaded anywhere?', a: 'No. Both files are read and compared by your own browser and the workbook is written there. A client’s purchase register does not leave the machine it is opened on, which is what makes it reasonable to put one through a free tool at all.' }
    ],
    tools: ['/business/gst-reconciler/', '/business/id-validator/', '/business/sheet-merge/', '/business/tally-converter/'],
    collections: ['accountants', 'month-end'],
    related: ['excel-to-tally', 'bank-reconciliation']
  },

  /* ================================================================== */
  {
    slug: 'vat-return-from-spreadsheet',
    glyph: 'i-vat-boxes',
    name: 'How to work out a VAT return from a spreadsheet',
    title: 'How to work out a VAT return from a spreadsheet, box by box',
    description: 'What goes in each of the nine boxes of a UK VAT return when your records are a spreadsheet — including what belongs in box 6 and what does not — and what you still need in order to file it.',
    answer: 'Total the period’s sales and purchases by VAT rate: the VAT goes in boxes 1 and 4, the net values in boxes 6 and 7, boxes 3 and 5 fall out of the arithmetic — and then the nine figures have to be submitted through software HMRC has recognised, because a spreadsheet cannot send them.',
    minutes: { first: 'an hour', again: 'twenty minutes' },
    howLong: 'An hour the first time, most of it spent deciding what your own columns mean and finding the four rows where net plus VAT does not equal gross. Twenty minutes a quarter after that, assuming the spreadsheet keeps its shape. If it takes you a whole day every quarter, the problem is the record-keeping rather than the return, and the fix is a rate or code column on every row as it is entered.',
    before: [
      'A list of sales for the period: date, reference, customer, net, VAT, gross, and either a rate or a VAT code on every row. The rate column is the one people leave out and the one that decides four of the nine boxes.',
      'The same for purchases, and only for purchases you hold a VAT invoice for. A purchase you cannot evidence is not a purchase you can reclaim on, however certain you are about it.',
      'Which scheme you are on: ordinary accrual accounting, cash accounting, or the flat rate scheme. The three put different things in the boxes and there is no way to work out which you are on from the spreadsheet.',
      'Your VAT period start and end dates, and a decision about what to do with rows dated outside them.',
      'Software HMRC has recognised, to actually submit through. Working the figures out and filing them are two different jobs.'
    ],
    steps: [
      {
        name: 'Fix the period, and decide what a row belongs to',
        body: [
          { p: 'Under ordinary accrual accounting a sale belongs to the period its tax point falls in — normally the invoice date — whether or not anybody has paid. Under cash accounting it belongs to the period the money moved in, so an invoice raised in one quarter and paid in the next is on the later return, and an unpaid invoice is on no return at all yet.' },
          { p: 'This is the single decision that most changes the answer, and it is not visible in the numbers. Get it wrong and every box is wrong by the same consistent, plausible-looking amount.' },
          { fact: {
            text: 'Cash accounting has a turnover limit to join and a higher one at which you must leave. The flat rate scheme has its own, lower, pair. Both are set by HMRC and both have moved; Notice 731 and Notice 733 carry the current figures and the conditions that go with them.',
            checked: CHECKED,
            sources: [src('ukVatCash', 'the cash accounting scheme and its turnover limits'), src('ukVatFlatRate', 'the flat rate scheme, the sector percentages and the limits')]
          } }
        ]
      },
      {
        name: 'Get the two lists into one shape',
        body: [
          { p: 'Sales on one sheet, purchases on another, or one sheet with a direction column. Each row needs a date, a reference, a net amount, a VAT amount, and a rate or VAT code. Gross is useful because it lets the sheet be checked against itself.' },
          { p: 'If your rows carry a package’s VAT codes rather than rates — T0, T1, T9, S, Z, E and their neighbours — they are recognised. The one to look at is the code your package uses for "no VAT", because there are two entirely different meanings hiding under it: a zero-rated supply, which is taxable at nothing and belongs in the turnover, and a supply outside the scope of UK VAT, which does not belong in the turnover at all.' },
          { tool: '/business/vat-return/', why: 'turns the two lists into the nine boxes, opens every box up to show the rows behind it, and checks the sheet against itself before it totals anything' }
        ]
      },
      {
        name: 'Work out boxes 1 and 4 — the VAT itself',
        body: [
          { p: 'Box 1 is the VAT you charged on sales and other outputs in the period. Box 4 is the VAT you are reclaiming on purchases and other inputs. Under ordinary accounting both are simply the VAT columns added up, with credit notes in as negatives.' },
          { p: 'Box 2 is VAT due on goods acquired in Northern Ireland from an EU member state. If your business does not move goods that way it is nil, and nil is the right answer for most businesses — it is not a box you fill in because it looks empty.' },
          { formula: 'Box 3 = Box 1 + Box 2      Box 5 = the difference between Box 3 and Box 4' },
          { p: 'Boxes 3 and 5 are arithmetic, not judgement. If your software lets you type into them independently, do not: the two identities are the first thing anybody checks.' }
        ]
      },
      {
        name: 'Work out box 6 — and know what does not belong in it',
        body: [
          { p: 'Box 6 is the total value of sales and all other outputs excluding VAT. It is the box that is most often wrong, and there are four separate ways to get it wrong.' },
          { ul: [
            'It is net, not gross. Putting the VAT-inclusive total in box 6 overstates turnover by the VAT — under ordinary accounting, that is. Under the flat rate scheme it is the other way round and box 6 is the VAT-inclusive figure, which is one of the reasons the two schemes should never be worked out in the same spreadsheet.',
            'Zero-rated sales belong in it. A zero-rated supply is a taxable supply taxed at nothing, and its net value is part of box 6 even though it contributed nothing to box 1.',
            'Exempt supplies belong in it too. They carry no VAT and they are still outputs.',
            'Supplies outside the scope of UK VAT do not belong in it. Neither does anything that is not a supply at all: a bank transfer between your own accounts, a loan drawn down, money you paid in as capital, a grant with nothing given in return.'
          ] },
          { example: {
            caption: 'Made-up figures, to show the shape of box 6 rather than any real business.',
            head: ['What it is', 'Net', 'VAT', 'In box 6?'],
            rows: [
              ['Standard-rated sales', '40,000', '8,000', 'Yes — 40,000'],
              ['Zero-rated sales (food)', '12,000', '0', 'Yes — 12,000'],
              ['Exempt supplies (rent of a flat)', '6,000', '0', 'Yes — 6,000'],
              ['Services to a business customer outside the UK', '9,000', '0', 'No — outside the scope'],
              ['Transfer from the deposit account', '5,000', '0', 'No — not a supply'],
              ['Box 6', '58,000', '', 'Whole pounds']
            ]
          } },
          { p: 'Box 7 is the same idea on the purchase side: the total net value of purchases and other inputs. Wages are not a purchase for VAT. Neither is a payment to HMRC, a drawing, or a transfer between accounts.' }
        ]
      },
      {
        name: 'If you are on the flat rate scheme, stop and do it differently',
        body: [
          { p: 'The flat rate scheme is not an adjustment to the ordinary calculation, it is a different calculation. Box 1 is a percentage of your VAT-inclusive turnover — the percentage for your sector, which you must get from the notice rather than from anybody’s memory. Box 6 is that VAT-inclusive turnover. Box 4 is normally nil, because the point of the scheme is that you do not reclaim input VAT.' },
          { fact: {
            text: 'The exception to box 4 being nil is a single purchase of capital expenditure goods at or above a set VAT-inclusive value, on which VAT may be reclaimed despite the scheme. There is also a higher percentage that applies to a business which spends very little on goods — a limited cost trader — and a discount in the first year of registration. All four of those numbers are in Notice 733, and the sector percentage table is there as well.',
            checked: CHECKED,
            sources: [src('ukVatFlatRate', 'the capital goods figure, the limited cost trader percentage, the first-year discount and the sector table')]
          } },
          { p: 'The sector percentage is not guessed for you anywhere on this site, on purpose. A wrong sector percentage is a wrong box 1 and a wrong payment, and the table is long and full of near-neighbours.' }
        ]
      },
      {
        name: 'Check the spreadsheet against itself before you believe any total',
        body: [
          { p: 'These are the checks worth running on every row, every quarter, and they take a computer no time at all.' },
          { ul: [
            'Net plus VAT does not equal the gross that was typed. Usually a discount applied to one column and not the others.',
            'The VAT is not the stated rate of the net — with a penny of rounding told apart from a real mismatch, because a penny is not a problem and a percentage point is.',
            'The same invoice reference twice. A credit note reissued under the original number does this, and so does a copy-paste.',
            'Rows dated outside the period. They should be excluded and counted, not silently dropped, because a large count means the period is set wrongly.',
            'Rows with no rate and no VAT code at all, which otherwise land wherever the default sends them.',
            'Negative rows. Usually credit notes, perfectly legitimate, and worth seeing as a list once a quarter.'
          ] },
          { p: 'Every one of those should name the row number and the reference so you can go and look at it. A check that says "3 problems found" and not where is not a check.' }
        ]
      },
      {
        name: 'Round the boxes the way the return expects',
        body: [
          { p: 'Boxes 1 to 5 are pounds and pence. Boxes 6 to 9 are whole pounds. Getting that wrong will not usually change what you pay, but it will make your return disagree with itself in a way that is easy to avoid.' },
          { fact: {
            text: 'Which VAT rate applies to a given supply, what the standard and reduced rates currently are, and how each box should be completed and rounded are all set out by HMRC. The standard rate has been at its present level since January 2011, which is long enough for people to stop checking; the list of what is reduced-rated or zero-rated changes far more often than the headline rate does.',
            checked: CHECKED,
            sources: [src('ukVatRates', 'which rate applies to which goods and services'), src('ukVatReturn', 'what belongs in each of the nine boxes, and the rounding'), src('ukVatThresholds', 'the registration and deregistration thresholds')]
          } }
        ]
      },
      {
        name: 'File it — which is a separate job from working it out',
        body: [
          { p: 'Under Making Tax Digital a VAT return has to be submitted through software HMRC has recognised, using their interface. A spreadsheet cannot do it and neither can this site. What you need is bridging software: something recognised whose only job is to read nine figures out of a spreadsheet and submit them.' },
          { p: 'There is a second rule that catches people out. The link between your records and the figures you submit has to be digital — a formula, a link, an import — rather than a person reading a total off one screen and typing it into another. Working the figures out in a spreadsheet is fine. Retyping them into the submission by hand is the part that is not.' },
          { fact: {
            text: 'Making Tax Digital for VAT applies to VAT-registered businesses, and HMRC publishes the list of software that can actually submit a return. The digital links requirement, and the narrow circumstances in which a manual transfer is allowed, are set out in the same guidance.',
            checked: CHECKED,
            sources: [src('ukMtdVat', 'what Making Tax Digital for VAT requires, including digital links'), src('ukMtdVatSoftware', 'who may actually file a return')]
          } },
          { p: 'Keep the working. A box with a figure and no rows behind it is the hardest kind of return to defend, and the easiest kind to produce by accident.' }
        ]
      }
    ],
    wrong: [
      { name: 'Box 6 filled with the gross',
        text: 'Under ordinary accrual or cash accounting box 6 is the net value of outputs — the VAT comes out. Under the flat rate scheme box 6 is the VAT-inclusive turnover — the VAT stays in. Both are correct in their own scheme and both are badly wrong in the other. The mistake survives quarter after quarter because the return still balances internally and the payment still looks plausible; it only surfaces when turnover is compared against the accounts and is out by something suspiciously close to the standard rate.' },
      { name: 'Zero-rated sales left out, and out-of-scope income put in',
        text: 'These are two opposite errors made by the same instinct, which is that box 6 is "the sales I charged VAT on". It is not. A zero-rated supply is taxable at a rate of nothing and its net value belongs in box 6. A supply outside the scope of UK VAT does not belong in box 6 at all, and neither does a transfer between your own bank accounts, a loan, a capital introduction or a grant given for nothing in return. The package code that says "no VAT" covers both cases and will not tell you which one you meant.' },
      { name: 'The cash accounting quarter that is really an invoice quarter',
        text: 'On cash accounting the return follows the money, not the invoice. A spreadsheet built around invoice dates will quietly produce an accrual return while you believe you are on the scheme — which overstates box 1 in a good quarter and understates it in a bad one, and gets progressively harder to unpick the longer it runs. The tell is an unpaid sales invoice appearing in box 1 in the quarter it was raised. If you are on the scheme, the sheet needs a paid date and a received date, and rows without them are on no return yet.' },
      { name: 'The same invoice twice, under two references',
        text: 'A credit note issued under the original invoice number, an invoice reissued after a change of address, a row pasted in twice when two people were maintaining the sheet — all three produce a duplicate that no amount of staring at a total will reveal. Checking for a repeated reference on each side takes a second and finds them. It also finds the opposite case, where a genuine second invoice happens to share a reference with the first, which is worth knowing about for different reasons.' },
      { name: 'Reclaiming VAT you cannot evidence',
        text: 'Box 4 is VAT on purchases you hold a valid VAT invoice for. A card receipt with no VAT number, a pro-forma, a supplier statement, a screenshot of an order confirmation — none of those is a VAT invoice, and a spreadsheet will add up their VAT column as happily as any other. Purchases from a supplier who is not registered have no VAT to reclaim at all, no matter what the column says. The place to catch this is at entry, with a column that says whether the invoice is on file.' },
      { name: 'A rate column that is empty on some rows',
        text: 'Rows with no rate and no code do not announce themselves: they fall to whatever default the sheet or the tool applies, and a default is a guess. A handful of blank rate cells in a thousand-row sheet can move box 1 by a noticeable amount and leave every internal check passing, because the arithmetic is consistent with the guess. Count the blanks before you total anything, and be suspicious of any period where that count is not zero.' }
    ],
    faq: [
      { q: 'Can I file my VAT return from a spreadsheet?', a: 'Not directly. The figures can come from a spreadsheet, and for most small businesses they do, but the submission has to be made by software HMRC has recognised. Bridging software is exactly that category — software whose job is to read the nine boxes from a sheet and submit them — and it is what a spreadsheet-based business needs alongside the spreadsheet.' },
      { q: 'What are boxes 2, 8 and 9 about now?', a: 'Goods moving between Northern Ireland and EU member states, rather than between Great Britain and the EU. Box 2 is the VAT due on goods acquired in Northern Ireland from an EU member state, box 8 the value of goods despatched from Northern Ireland to them, box 9 the value of those acquisitions. If your business does not move goods that way, all three are nil and that is the correct answer.' },
      { q: 'Do I have to include exempt income in box 6?', a: 'Yes. Exempt supplies carry no VAT and are still outputs, so their net value is part of box 6. The thing to keep out of box 6 is income that is outside the scope of VAT altogether, and receipts that are not supplies at all.' },
      { q: 'What if a row is dated just outside the period?', a: 'Exclude it and count it. One or two either side of a quarter end is normal and they belong to the neighbouring return. Dozens of them means the period dates are wrong, which is worth knowing before rather than after you file.' }
    ],
    tools: ['/business/vat-return/', '/business/bookkeeping/', '/business/mtd-checker/', '/business/sheet-merge/'],
    collections: ['accountants', 'going-digital', 'month-end'],
    related: ['first-mtd-quarterly-update', 'bank-reconciliation']
  },

  /* ================================================================== */
  {
    slug: 'bank-reconciliation',
    glyph: 'i-bank-recon',
    name: 'How to reconcile a bank statement against your books',
    title: 'How to reconcile a bank statement against your books',
    description: 'Match a bank statement to the bank account in your ledger, and read what is left over: what the bank knew and you did not, and what you have entered that has not cleared.',
    answer: 'Match every line on the statement to a line in your bank ledger on amount, direction and date — then read the two leftover piles, because what is left on the statement is what you never entered, and what is left in the books is what has not cleared yet.',
    minutes: { first: 'half an hour', again: 'ten minutes' },
    howLong: 'Half an hour for a first month on a small account, most of it spent working out which of your columns is money in. Ten minutes a month afterwards. If a reconciliation is taking hours, the usual cause is that the opening balance was never agreed, in which case you are not reconciling this month — you are reconciling every month since the last one that was right, and it is quicker to admit that and go back.',
    before: [
      'The bank statement for the period, as Excel or CSV rather than a PDF. Almost every bank offers it; a PDF has to be converted first and conversions of bank PDFs are where stray characters come from.',
      'The bank account’s ledger from your books for the same period, exported with dates, particulars and amounts. In Tally it is the ledger for that bank account; in most other packages it is the account transaction report.',
      'The closing balance on both sides, written down before you start. They will not agree, and the gap is the thing you are about to explain.',
      'Last month’s reconciliation, or at least the knowledge that last month’s closing balance was agreed. Reconciling onto an opening balance nobody ever checked is the commonest way to spend a day on a ten-minute job.'
    ],
    steps: [
      {
        name: 'Take both sides for the same window, with a margin',
        body: [
          { p: 'Pull the statement for the month and the ledger for the month plus a few days either side. A cheque written on the twenty-eighth and presented on the third of the following month exists in both sets of records, in two different months, and a ledger cut exactly on the month end will not have it when the statement does.' },
          { p: 'Write down the two closing balances now, before anything is matched. The whole exercise ends by explaining the difference between those two numbers, and it is much less satisfying to work out what they were afterwards.' }
        ]
      },
      {
        name: 'Get the direction right, because the two sides are mirrors',
        body: [
          { p: 'This trips up people who have done it for years, because the words are the same and the meaning is opposite. On the bank’s statement a credit is money arriving in your account. In your books, money arriving in the bank account is a debit to that account. The bank is describing its liability to you; your ledger is describing your asset.' },
          { formula: 'money in on the statement (credit)  =  money in in the books (debit to bank)' },
          { p: 'So map "money in" and "money out" on each side by what actually happened to the cash, not by the column heading, and everything downstream follows. A ledger with a single signed amount column is fine too: map it as money in, leave money out empty, and negatives are taken as money out.' },
          { tool: '/business/bank-reconciliation/', why: 'matches the two sides on amount, direction and date, and returns the matched pairs, the unmatched on each side, and the closing balances side by side' }
        ]
      },
      {
        name: 'Match on amount and direction first, date second',
        body: [
          { p: 'A match needs the same amount to the penny, the same direction, and dates within a window — three days covers cheques and weekend clearing on most accounts. Where several entries have the same amount, a reference that appears in both descriptions decides which pairs with which: an invoice number, a transaction reference, a cheque number. Otherwise the nearest date wins, and each entry can match only once.' },
          { p: 'Widen the window for an account with slow-clearing instruments; narrow it if you start seeing pairs that are obviously not each other. A window that is too wide is worse than one that is too narrow, because a false match hides two real problems instead of showing them.' }
        ]
      },
      {
        name: 'Read the leftovers on the statement side',
        body: [
          { p: 'These are things the bank knows about and your books do not. There are only a few kinds, and after one month you will recognise them by shape.' },
          { ul: [
            'Bank charges, account fees, card fees and the tax on them. Nobody enters these because nobody is told about them.',
            'Interest received or paid.',
            'Direct debits and standing orders that were set up once and never entered again.',
            'Receipts from customers who paid without telling you, which is the useful half of this list — that is cash you have and did not know about, often against an invoice you are busy chasing.',
            'A payment taken twice, or a payment you do not recognise at all. Rare, and the reason this is worth doing monthly rather than annually.'
          ] },
          { p: 'Everything in this pile needs an entry in the books. That is the point of the pile: it is your list of journals to post.' }
        ]
      },
      {
        name: 'Read the leftovers on the books side',
        body: [
          { p: 'These are things you have recorded that the bank has not seen.' },
          { ul: [
            'Cheques issued but not yet presented. Perfectly normal, and they clear next month.',
            'Deposits in transit — cash or cheques banked near the period end that had not credited by the cut-off.',
            'An entry posted to the wrong bank account, which will sit here every month until somebody notices.',
            'An entry with the wrong date or the wrong amount. A transposition — two digits swapped — produces a difference divisible by nine, which is a genuinely useful thing to test for when a single stubborn entry will not match.',
            'An old cheque that has been here for months. It was never presented, and at some point it needs to be written back rather than carried forever.'
          ] }
        ]
      },
      {
        name: 'Prove the balance, and write the proof down',
        body: [
          { p: 'The reconciliation is not the list of unmatched entries. It is the statement that the two balances differ by exactly those entries and nothing else.' },
          { formula: 'balance per books  +  unpresented cheques  −  deposits in transit  =  balance per statement' },
          { example: {
            caption: 'Made-up figures, to show the shape of the proof rather than any real account.',
            head: ['', 'Amount'],
            rows: [
              ['Closing balance per books', '84,200'],
              ['Add: cheques issued, not yet presented', '6,500'],
              ['Less: deposit banked on the last day, not yet credited', '(2,700)'],
              ['Less: bank charges not entered', '(320)'],
              ['Closing balance per statement', '87,680']
            ]
          } },
          { p: 'If the two sides do not meet, do not adjust anything to make them. An unexplained difference that has been plugged is an unexplained difference that will never be found. Leave it visible, name it, and go looking.' }
        ]
      },
      {
        name: 'Post what you found, and do it again next month',
        body: [
          { p: 'The charges, the interest and the direct debits become journals. The customer receipt you did not know about becomes a receipt allocated against an invoice — and probably comes off a chasing list somewhere. The entry in the wrong account gets moved.' },
          { tool: '/business/bookkeeping/', why: 'takes a bank statement or a set of journals into a real double-entry ledger, so the entries you find here have somewhere to go and the trial balance follows from them' },
          { p: 'Then agree the closing balance, and keep the reconciliation. Next month starts from it. A bank account that has been reconciled every month is an account where a difference can only have arisen this month, which is why the job stays ten minutes long.' }
        ]
      }
    ],
    wrong: [
      { name: 'A signed amount column mapped as two columns',
        text: 'Many bank exports have one Amount column with negatives for money out, while your ledger has separate Debit and Credit columns. Map that single column as money in and also map something as money out, and every payment is counted twice — once as a negative in, once as a positive out — so the totals are wrong in a way that still looks orderly. The rule is one or the other: a signed column goes in the money-in slot with money out left empty, and the negatives take care of themselves.' },
      { name: 'The cheque that clears outside the window, counted as two problems',
        text: 'A date window of a few days is right for almost everything, and completely wrong for a cheque presented a fortnight later. That one transaction then appears on both leftover lists: as "payment not entered" on the statement side and as "cheque issued, not yet presented" on the books side. It looks like two unexplained items of equal and opposite amount, which is exactly what a real error looks like. Before widening the window, check whether the amounts on your two leftover lists cancel out in pairs.' },
      { name: 'Reconciling onto an opening balance that was never agreed',
        text: 'If last month was not reconciled, this month’s difference contains last month’s difference, and possibly the one before that. You can spend hours looking for a transaction in this month’s data that is not in this month’s data. The tell is a difference that is not divisible by anything sensible and matches no combination of the unmatched entries. Go back to the last month that was agreed and work forward; it is faster, even when it is three months.' },
      { name: 'Two identical amounts on the same day',
        text: 'Two payments of exactly the same amount to the same supplier on the same day are matched by whichever rule fires first, and the pairing may be backwards. Usually this does not matter, because the effect on the totals is nil. It matters when one of them was entered against the wrong invoice, or when one is a duplicate payment — in which case the pairing decides which entry is reported as unmatched, and you go looking at the wrong one. A reference in the narration, on either side, fixes it permanently.' },
      { name: 'Rows the import quietly dropped',
        text: 'A reconciliation only sees the rows it could read. Balance-only rows, opening and closing balance lines, a row with no date, a row whose amount is zero, and headers repeated in the middle of the file because the statement was downloaded page by page — all are dropped or skipped, and the totals of what was read can be smaller than the file. Check the row count that was read against the row count in the file. If a statement of 240 lines came in as 231, find the nine before you start matching.' },
      { name: 'Bank charges with tax on them, entered as one figure',
        text: 'Bank charges frequently arrive with GST or VAT applied to them, and the statement shows one combined debit or, worse, two debits a day apart. Entered as a single expense, the tax is never reclaimed and the expense is overstated; entered by guesswork, the tax account stops agreeing with the return. The bank’s own charge statement or the monthly charge advice has the split, and it is worth getting once and setting up as a recurring entry rather than deciding again every month.' }
    ],
    faq: [
      { q: 'What actually counts as a match?', a: 'The same amount to the penny, the same direction, dates within the window you set, and — where more than one candidate qualifies — the entry that shares a reference with the description, then the nearest date. Every entry matches at most once, on either side.' },
      { q: 'My books have one column with negatives. Is that a problem?', a: 'No. Map it as money in and leave money out unmapped; negative values are read as money out. The same applies to a statement that comes that way. What does not work is mapping a signed column and a separate money-out column at the same time.' },
      { q: 'How wide should the date window be?', a: 'Three days suits most current accounts. Widen it for an account that still sees cheques or that clears slowly, and narrow it if you notice pairs being matched that are plainly not each other. Before widening it, check whether the unmatched amounts on the two sides cancel in pairs — that is the same transaction seen twice, not a missing one.' },
      { q: 'Is the statement uploaded anywhere?', a: 'No. Both files are read and compared by your browser and the report is written there. Nothing leaves the device, which matters more for a bank statement than for almost any other file a business has.' }
    ],
    tools: ['/business/bank-reconciliation/', '/business/bookkeeping/', '/ai/bank-statement-categoriser/', '/business/accounting-converter/'],
    collections: ['accountants', 'month-end', 'small-business'],
    related: ['reconcile-gstr-2b', 'chase-unpaid-invoices']
  },

  /* ================================================================== */
  {
    slug: 'first-mtd-quarterly-update',
    glyph: 'i-mtd-quarter',
    name: 'Your first Making Tax Digital quarterly update',
    title: 'Your first Making Tax Digital quarterly update: what it is and when it is due',
    description: 'What a Making Tax Digital for Income Tax quarterly update actually contains, which businesses need their own, when the periods end and what you still have to do at the end of the year.',
    answer: 'A quarterly update is a cumulative year-to-date total of one business’s income and expenses, grouped into standard categories and sent from software HMRC has recognised about a month after the quarter ends — it is not a tax return, it does not work out what you owe, and a sole trader who also lets a flat sends two of them.',
    minutes: { first: 'an afternoon', again: 'half an hour' },
    howLong: 'The first one is an afternoon, and almost none of that is the update itself — it is deciding whether you are in, which businesses you have, and what your own category names should map onto. After that each quarter is half an hour if the records are kept as you go, and a fortnight of misery if they are kept in a carrier bag. The whole design of Making Tax Digital is a bet that people will keep records as they go once there are four deadlines instead of one.',
    before: [
      'A view on whether Making Tax Digital for Income Tax applies to you at all, and from which April. This turns on qualifying income, which is not what most people assume it is.',
      'A list of your businesses, not your bank accounts. Each trade is a business; all your UK property together is one property business; overseas property is another.',
      'Digital records of income and expenses for the period, with a date, an amount and a category on every row. A spreadsheet is a digital record.',
      'Software HMRC has recognised, connected to your HMRC account. Nothing on this site can send an update, and neither can a spreadsheet on its own.'
    ],
    steps: [
      {
        name: 'Work out whether it applies to you, and from which April',
        body: [
          { p: 'It turns on qualifying income: gross income before expenses, from self-employment and from property, added together. Not profit. Not taxable income. It does not include employment income, pensions, dividends or savings interest.' },
          { p: 'A landlord whose rent is thirty-one thousand a year and whose mortgage interest, agent fees and repairs come to fourteen thousand has qualifying income of thirty-one thousand, not seventeen. That single misunderstanding is what puts people on the wrong side of a threshold, and it is the reason to check rather than assume.' },
          { p: 'It is also added across everything. A plumber with a modest trade who also lets a flat adds the two gross figures together, and the total can cross a threshold neither figure is near on its own.' },
          { fact: {
            text: 'Making Tax Digital for Income Tax is being brought in in stages, with a different qualifying income threshold at each stage and a start date for each. Whether you are caught for a given start date is judged on the tax return for the year two years before it, which means the figure that decides it is usually one you have already filed rather than one you are forecasting. Thresholds, start dates and the exemptions are all published by HMRC and have moved more than once.',
            checked: CHECKED,
            sources: [src('ukMtdItsaCheck', 'the thresholds, the start dates and what qualifying income means'), src('ukMtdItsaUse', 'what being in it actually requires')]
          } },
          { tool: '/business/mtd-checker/', why: 'adds up qualifying income the way HMRC defines it, names the threshold that catches you and gives the first period and its deadline' }
        ]
      },
      {
        name: 'Count your businesses, because each one updates separately',
        body: [
          { p: 'This is the part that surprises people. A quarterly update covers one business. If you have two trades, that is two sets of updates. If you have a trade and a property business, that is two. All your UK lettings together count as one property business; overseas property is separate again.' },
          { p: 'So the question "how many updates a year do I send" has an answer of four times the number of businesses, and for a great many people that number is not four.' }
        ]
      },
      {
        name: 'Choose standard or calendar quarters, once',
        body: [
          { p: 'The default periods follow the tax year and end on the fifth of the month. You can elect in your software for calendar quarters instead, which end on the last day of the month and are much easier to reconcile against a bank statement or a bookkeeping system that thinks in calendar months.' },
          { fact: {
            text: 'The tax year itself runs from 6 April to 5 April. Standard quarterly periods follow it and end on 5 July, 5 October, 5 January and 5 April. Calendar quarterly periods, which you elect for in your software, end on 30 June, 30 September, 31 December and 31 March — which is why a calendar election leaves the days from 1 to 5 April outside the fourth quarter but still inside the tax year. The filing deadlines are the same either way: 7 August, 7 November, 7 February and 7 May. After the tax year there is a Final Declaration, due by 31 January following the end of the tax year, which replaces the Self Assessment return.',
            checked: CHECKED,
            sources: [src('ukMtdItsaUse', 'quarterly periods, the deadlines and the Final Declaration'), src('ukMtdItsaSoftware', 'what may actually submit an update')]
          } },
          { p: 'Note what the calendar election does not change: the fourth calendar quarter closes at the end of March, while the tax year runs on for a few more days into April. Rows dated in that short gap still belong to the tax year that is ending, and they have to be counted somewhere. Whatever you use should tell you which of those rows it has picked up and where it put them.' }
        ]
      },
      {
        name: 'Keep the records in a shape that can be totalled',
        body: [
          { p: 'What an update needs from your records is a date, an amount, and a category for every row. That is all. A spreadsheet with those three columns is a digital record and is enough.' },
          { p: 'The categories are the standard headings for a trade or for property — turnover, cost of goods, car and van, wages, premises, repairs, office costs, advertising, interest, bank charges, bad debts, professional fees, depreciation, other, for a trade; rents, premiums, rates and insurance, repairs, loan interest, management fees, services, other, for property. Your own names do not have to match: "Diesel" maps onto car and van, "Xero subscription" onto office costs. What matters is that every row maps onto something, and that you decide where the odd ones go rather than letting them fall into a bucket.' },
          { tool: '/business/mtd-quarterly-update/', why: 'maps your own category names onto the standard headings, cuts the year into its four periods, and gives the cumulative year-to-date figure beside the standalone quarter with every unmatched row listed by name' }
        ]
      },
      {
        name: 'Total the period — cumulatively',
        body: [
          { p: 'An update carries the year to date, not the quarter standing alone. The second quarter’s update is the first quarter plus the second. The fourth quarter’s update is the whole year.' },
          { p: 'This is a better design than it first appears, because it means a mistake in an earlier quarter is corrected simply by the later update being right. You are not amending anything; you are restating the running total.' },
          { p: 'Produce both figures anyway. The standalone quarter is the one that tells you anything about the business — whether the summer was better than the spring — and the cumulative one is the one that gets sent.' }
        ]
      },
      {
        name: 'Send it through recognised software',
        body: [
          { p: 'The update goes to HMRC through software that has been recognised for the purpose and is connected to your HMRC account. A spreadsheet cannot send it. Nothing on this site can send it. What you can do here is produce the figures the software asks for, as a workbook, and put them in.' },
          { p: 'Check the wording of the categories in whatever you file with against the headings you have used. HMRC’s own specification, the paper pages and every package word them slightly differently, and a category that does not exist in your software has to go somewhere.' }
        ]
      },
      {
        name: 'Remember that the year still has to be finished off',
        body: [
          { p: 'Four updates do not make a tax return. After the tax year ends there is a Final Declaration, in which the accounting adjustments are made — capital allowances, private use, the accruals and prepayments — other income is added, reliefs are claimed, and the tax is actually calculated.' },
          { p: 'The updates are raw. They are not expected to be the final figures, and nothing in them calculates what you owe. That is worth telling anybody who panics at the first update showing a profit they do not recognise.' }
        ]
      }
    ],
    wrong: [
      { name: 'Qualifying income read as profit',
        text: 'Qualifying income is gross, before a single cost comes off, and it is added across every trade and every property business. A landlord looking at their net rental profit, or a trader looking at the bottom of their profit and loss, will decide they are comfortably under a threshold when the gross figure is well over it. There is no penalty for checking and a substantial one for being in the regime without knowing it, and the figure is on a return you have already filed.' },
      { name: 'One set of updates for two businesses',
        text: 'A sole trader who also lets a flat has two businesses and sends two sets of quarterly updates, with two sets of categories — the trade headings for one, the property headings for the other. Combining them into a single update is not a rounding error, it is the wrong return: property income and trading income are taxed differently and reported separately. If you are running one bookkeeping file for both, the very first thing to do is add a column that says which business a row belongs to.' },
      { name: 'Sending the quarter when the software wanted the year to date',
        text: 'The update carries the cumulative figure. Send the standalone quarter into a field expecting year-to-date and the year is understated by everything before it; send year-to-date into a field expecting the quarter and Q4 reports the whole year as a single quarter. Both are silent errors — the figures are plausible and the submission is accepted. Produce both columns, look at which one your software’s field name is asking for, and check that Q2 cumulative is visibly larger than Q1.' },
      { name: 'The gap at the start of April, under a calendar election',
        text: 'Electing for calendar quarters moves the period ends to the last day of the month. It does not move the tax year, which closes a few days later — the exact dates are in the dated box in step three. That leaves a short gap between the close of the fourth calendar quarter at the end of March and the end of the tax year, and rows dated in it have to be counted somewhere. Different software treats them differently. Whatever you use should flag them rather than absorbing them silently, and it is worth checking once, in the first year, exactly where they went.' },
      { name: 'Category names that only exist in your head',
        text: 'A row categorised as "Stuff", "Misc" or "Amazon" maps onto nothing, and something has to happen to it. The dangerous outcome is not an error message, it is a default: the row lands in "other expenses" and stays there. Other expenses is a real heading, so nothing looks wrong, but it is also the heading most likely to attract a question. Every unmatched row should be listed by name and decided on, and the ones you decide on this quarter should become rules for the next.' },
      { name: 'Treating the update as a tax bill',
        text: 'An update is income and expenses as recorded — no capital allowances, no private use adjustment, no accruals, no other income, no reliefs. The profit it appears to show is not your taxable profit and no tax is calculated from it. People see a large number in the first update and either panic or start setting money aside against an entirely fictional liability. The tax is worked out at the Final Declaration, which is also where the adjustments belong.' }
    ],
    faq: [
      { q: 'How many updates will I actually send?', a: 'Four for each business, each year. A trade is a business; all your UK property together is one; overseas property is another. Two businesses means eight updates a year, plus one Final Declaration covering everything.' },
      { q: 'Can I file an update from a spreadsheet?', a: 'Not on its own. The figures can come from a spreadsheet, and this site will produce them as a workbook, but the submission has to be made by software HMRC has recognised and connected to your HMRC account.' },
      { q: 'What happens if I get a quarter wrong?', a: 'Because the figures are cumulative, the ordinary way to fix an earlier quarter is for the next update to carry the corrected running total. Check how your own software words this before you rely on it — packages differ in what they call an amendment and in what they let you resubmit.' },
      { q: 'Does this replace my Self Assessment return?', a: 'The Final Declaration after the tax year replaces it, not the quarterly updates. The updates are the raw income and expenses through the year; the Final Declaration is where the adjustments, the other income, the reliefs and the actual tax calculation happen.' }
    ],
    tools: ['/business/mtd-checker/', '/business/mtd-quarterly-update/', '/business/bookkeeping/', '/business/vat-return/'],
    collections: ['going-digital', 'accountants', 'freelancers'],
    related: ['vat-return-from-spreadsheet', 'bank-reconciliation']
  },

  /* ================================================================== */
  {
    slug: 'run-payroll-india',
    glyph: 'i-payroll-run',
    name: 'Running a monthly payroll in India',
    title: 'Running a monthly payroll in India: components, deductions and filings',
    description: 'The month-by-month sequence for an Indian payroll: freezing attendance, pro-rating, the statutory deductions, what the payslip must show, and which filings follow the payment.',
    answer: 'Freeze attendance, pro-rate the salary by paid days, split gross into the components the payslip has to show, deduct provident fund, ESI, professional tax and the income tax you computed separately, then pay, issue the slips and make the statutory filings that follow the month.',
    minutes: { first: 'a day', again: 'an hour or two' },
    howLong: 'The first month is a day, because the first month is when the master data gets built: identifiers, bank details, which state each person is taxed in, who is in the provident fund and who is not. After that a run is an hour or two, of which the attendance freeze is most of it. The filings are a separate half hour each, and they are on someone else’s calendar rather than yours.',
    before: [
      'Attendance for the month, frozen. Paid days and loss-of-pay days per employee, agreed by whoever runs the shift roster, and not changing after you start.',
      'The salary master: one row per employee, with basic, house rent allowance and every other fixed component, plus the variable ones for this month.',
      'Statutory identifiers: provident fund number or UAN, ESI number, PAN. Missing ones do not stop a payslip, and they do stop a filing.',
      'Bank details for the transfer file: account number, IFSC and beneficiary name, spelled as the bank holds them.',
      'Your computed income tax deduction per employee. It cannot be worked out from a month’s salary sheet, and anything that offers to do so from a salary sheet alone is guessing.'
    ],
    steps: [
      {
        name: 'Freeze the attendance before you touch a number',
        body: [
          { p: 'Every figure below is pro-rated off paid days, so a late attendance correction re-runs the whole month. Agree the cut-off, publish it, and hold it.' },
          { p: 'Check the arithmetic on the way in: paid days plus loss-of-pay days should equal the number of days in the month, on the convention your organisation uses. Where it does not, somebody has counted a holiday twice or missed a joiner. That check is worth running before anything else, because it is the cheapest error to fix at this point and the most expensive to fix after the bank file has gone.' }
        ]
      },
      {
        name: 'Lay the sheet out as one row per employee',
        body: [
          { p: 'One row, with the components across. Earnings first — basic, house rent allowance, conveyance, special allowance, any statutory bonus, overtime, incentive, arrears — then deductions.' },
          { p: 'Column names are recognised in the ordinary variants people use, and every mapping is shown for you to correct, so Emp Code, Employee ID and Staff No all work. What matters more is that a component means the same thing in every row: an allowance that is part of gross for one person and a reimbursement for another will quietly produce two different answers for provident fund.' }
        ]
      },
      {
        name: 'Pro-rate for the days actually paid',
        body: [
          { formula: 'component for the month  =  full component  ×  paid days ÷ days in the month' },
          { p: 'Decide once whether your denominator is calendar days or standard working days, write it down, and never mix the two. Both conventions are in use; a payroll that uses one for joiners and the other for leavers produces differences nobody can explain a year later.' },
          { p: 'Reimbursements are not pro-rated — a person who was present for half the month and spent the whole travel allowance spent the whole travel allowance. Keep them out of the pro-rated block.' }
        ]
      },
      {
        name: 'Work out the provident fund',
        body: [
          { p: 'The employee contributes a percentage of provident fund wages; the employer matches it, but the employer’s share is split — part goes to the pension scheme and the rest to the provident fund proper — and there are additional employer-only charges on top for insurance and administration. The employer’s cost is therefore more than the employee’s deduction, which is the figure people forget when budgeting a hire.' },
          { fact: {
            text: 'The employee and employer contribution rates, the wage ceiling on which the contribution is calculated, the split of the employer’s share between the pension scheme and the provident fund, and the additional insurance and administration charges are all set by EPFO and have been revised. Membership rules for a new joiner already above the ceiling are set there too. The monthly return is filed as an electronic challan cum return.',
            checked: CHECKED,
            sources: [src('inEpfo', 'contribution rates, the wage ceiling, the pension split and the ECR'), src('inLabour', 'the Act behind the scheme')]
          } },
          { p: 'The decision that has to be made per employer, not per month, is whether contributions for somebody earning above the ceiling are restricted to the ceiling or calculated on their actual wages. Both are done. What cannot happen is one answer in the payroll and another in the return.' }
        ]
      },
      {
        name: 'Work out ESI, if it applies',
        body: [
          { p: 'Employees’ state insurance applies to employees earning up to a wage limit, with a small contribution from the employee and a larger one from the employer, both calculated on gross wages rather than on basic.' },
          { fact: {
            text: 'The wage limit, the employee and employer contribution rates, and the two fixed contribution periods in the year are set by ESIC. The rule that matters in practice is what happens when somebody crosses the wage limit mid-period: an employee who is covered at the start of a contribution period continues to contribute until that period ends, rather than dropping out in the month the raise takes effect.',
            checked: CHECKED,
            sources: [src('inEsic', 'the wage limit, the contribution rates and the contribution periods')]
          } },
          { p: 'That mid-period rule is the single most common ESI mistake, and it appears in the month after an appraisal cycle, on exactly the employees who just got a rise.' }
        ]
      },
      {
        name: 'Work out professional tax, by state',
        body: [
          { p: 'Professional tax is a state tax, not a national one. The slabs differ by state, some states do not levy it at all, and at least one levies it on half-yearly wages rather than monthly — so the monthly deduction there is a sixth of a half-yearly band rather than a band of its own.' },
          { fact: {
            text: 'Each state sets its own professional tax slabs, its own exemptions and its own payment dates, and revises them independently. There is no single national schedule to check; the authority is the commercial taxes department of the state the employee works in.',
            checked: CHECKED,
            sources: [src('inLabour', 'professional tax is levied by the states — check the schedule of the state the employee works in'), src('inIncomeTax', 'professional tax paid is a deduction against salary income')]
          } },
          { p: 'The state that matters is the one the employee works in, which for anybody remote or recently transferred is not necessarily the one the registered office is in.' }
        ]
      },
      {
        name: 'Take income tax from your own computation, not from the month',
        body: [
          { p: 'Monthly tax deducted at source depends on the employee’s projected income for the whole year, the tax regime they have chosen, the declarations and proofs they have submitted, and what has already been deducted since April. None of that is in a salary sheet.' },
          { p: 'So the figure comes from your tax computation and is carried into the payroll as a column. A tool that offers to compute it from one month of salary is either ignoring the year or inventing the declarations.' },
          { tool: '/business/ctc-structure/', why: 'estimates a year of tax under both regimes from a full cost to company, which is the right starting point for a projection even though it is not the month’s deduction' }
        ]
      },
      {
        name: 'Run the month and produce the paperwork',
        body: [
          { tool: '/business/payroll-run/', why: 'takes the sheet and produces a payslip for every employee, a combined PDF for printing, the bank bulk transfer file and a register with the statutory summaries that tie back to the slips' },
          { p: 'What a run should produce, at minimum: one payslip per employee showing earnings, deductions and net pay with the components named; a register listing every component for every employee; the statutory summaries; and the bank transfer file.' },
          { p: 'It should also refuse to proceed if anybody’s net pay is negative. A loan recovery or an advance larger than the month’s earnings is a conversation to have before the file goes to the bank, not after.' },
          { tool: '/pdf/payslip-pdf/', why: 'produces a single payslip on its own, for a leaver, a correction or somebody who was missed' }
        ]
      },
      {
        name: 'Pay, then file — and note that the filings are not all yours',
        body: [
          { p: 'The bank file goes first, then the slips, then the filings. Keep the register: every filing below has to tie back to it, and a register produced after the fact from memory never quite does.' },
          { fact: {
            text: 'Provident fund and ESI contributions are payable monthly, by the fifteenth of the following month. Tax deducted at source is payable by the seventh of the following month, with a different date for the deduction made in March. A quarterly statement of the tax deducted from salaries follows each quarter, with the quarter ending in March allowed longer than the others, and the annual certificate for employees comes after the last of those. Professional tax dates are set by each state separately. Every one of those dates is set by the authority and each has been changed at some point.',
            checked: CHECKED,
            sources: [src('inEpfo', 'the monthly ECR and its due date'), src('inEsic', 'monthly contribution and its due date'), src('inIncomeTaxActs', 'deposit dates for tax deducted at source and the quarterly statements'), src('inIncomeTax', 'the filing portal, the challans and the annual certificate')]
          } },
          { p: 'Who does them is worth settling in writing. In a small company the person who runs payroll files the provident fund and ESI returns; the tax deducted at source is very often filed by the accountant or a consultant from their own credentials. Both parties assuming the other is doing it is a remarkably common way to miss a deadline, and it is discovered a quarter late.' }
        ]
      }
    ],
    wrong: [
      { name: 'Paid days and loss of pay that do not add up to the month',
        text: 'Paid days plus loss-of-pay days should equal the days in the month, on whatever convention you use. When they do not, the arithmetic still runs and every component is pro-rated against a denominator that is wrong, so the payslip looks entirely normal and the net pay is out by a few per cent. It surfaces as an employee query — "my salary is short this month" — and then as a correction in the following month’s slip, which is where it becomes visible to everybody. Check the sum before the run, not after.' },
      { name: 'The provident fund ceiling applied inconsistently',
        text: 'For an employee earning above the wage ceiling, an employer may contribute on the ceiling or on actual wages. Either is defensible. What is not is one answer in the payroll sheet and the other in the monthly return, or a change of answer halfway through a year, or one answer for employees who joined before a certain date and another for those who joined after with nobody able to say why. The mismatch is caught by the return rather than by the payslip, which means it is found later and corrected for everybody at once.' },
      { name: 'ESI dropped in the month of the appraisal',
        text: 'An employee who is covered at the start of a contribution period keeps contributing until that period ends, even after a raise takes them over the wage limit. Payroll systems and spreadsheets that test the limit month by month drop them the moment the new salary lands, which is exactly the month the appraisal cycle produces a batch of them. The contribution is then short for several months across a whole cohort of employees, and it is found at the end of the contribution period.' },
      { name: 'Professional tax at the company’s state instead of the employee’s',
        text: 'Professional tax follows where the employee works, and the slabs are genuinely different from state to state — one state levies on half-yearly wages, some do not levy at all. A payroll that applies head-office rules to everybody is wrong for every remote employee and every branch, and it is wrong in both directions: deducting where nothing is due is as much a problem as not deducting where it is, because the employee has had money taken that you have no registration to pay over.' },
      { name: 'Bank account numbers mangled by the spreadsheet',
        text: 'This one costs real money. A bank account number is a string of digits, and a spreadsheet treats it as a number: leading zeros disappear, long numbers turn into scientific notation, and the transfer file is generated from whatever is left. The salary goes nowhere, or occasionally to somebody else, and the reversal takes days. Format the column as text before anything is typed into it, check the IFSC codes for format, and reconcile the total of the transfer file against the net pay total on the register before it is uploaded.' },
      { name: 'Tax deducted at source guessed from the month',
        text: 'A month’s deduction is a twelfth of a projection that takes account of the regime the employee chose, their declarations, the proofs actually submitted and what has already been deducted since April. It cannot come out of a salary sheet. What happens when it is guessed is that it is roughly right for eight months and then a very large correction lands in February and March, on an employee who was not expecting it, immediately before the year ends. Run the projection at the start of the year, revise it when a declaration changes, and carry the result into the payroll as a column.' }
    ],
    faq: [
      { q: 'Does the payroll tool compute income tax?', a: 'No, deliberately. It takes the figure from your sheet and carries it through to the payslip, the register and the tax summary. The monthly deduction depends on a year-long projection, the chosen regime and each employee’s declarations, none of which is present in a month’s salary data.' },
      { q: 'What comes out of one run?', a: 'A payslip for every employee, a combined PDF of all of them for printing, the bank bulk transfer file, and a register workbook that lists every component for every employee alongside the statutory summaries — and the summaries tie back to the slips rather than being calculated separately.' },
      { q: 'Are the statutory rates built in?', a: 'The contribution rates, wage ceilings and state slabs sit in one clearly marked block with the date they were last checked, and the page says so. They move at budgets and notifications, so check anything you are about to file against the authority rather than against a tool.' },
      { q: 'Is salary data uploaded anywhere?', a: 'No. The sheet is read in your browser, the PDFs and the workbook are written there. Salary is the most sensitive figure most people have, which is why none of it leaves the machine.' }
    ],
    tools: ['/business/payroll-run/', '/pdf/payslip-pdf/', '/business/ctc-structure/', '/business/full-final-settlement/', '/business/id-validator/'],
    collections: ['hr-payroll', 'month-end', 'small-business'],
    related: ['chase-unpaid-invoices', 'excel-to-tally']
  },

  /* ================================================================== */
  {
    slug: 'build-a-school-timetable',
    glyph: 'i-timetable',
    name: 'How to build a school timetable that does not clash',
    title: 'How to build a school timetable that does not clash',
    description: 'Write the allocation, check the arithmetic that decides whether a timetable can exist at all, place the hard constraints first, and read the list of what would not fit.',
    answer: 'Write the allocation down as class, subject, teacher and periods a week; check that no teacher and no class is asked for more periods than the week actually has; then place the fixed lessons and let the rest be arranged — and when something will not fit, the arithmetic almost always said so before the solver did.',
    minutes: { first: 'two days', again: 'an afternoon' },
    howLong: 'Two days in August for a school doing it properly for the first time, and almost all of that is the allocation — deciding who teaches what, and negotiating the three subjects that want the same specialist. The arranging itself is minutes. In following years it is an afternoon, because last year’s allocation is the starting point and only the changes need arguing about.',
    before: [
      'The shape of the week: which days, how many periods a day, where the breaks fall, and whether any day is short.',
      'The allocation: for every class, every subject it takes, who teaches it and how many periods a week it gets. This is the real work and no tool can do it for you.',
      'Which of those periods have to be doubles, and whether a double may straddle a break.',
      'The genuine constraints: teachers who are not in on particular days, lessons pinned to a fixed slot such as assembly or games, and rooms that only one class can use at a time.',
      'One person with the authority to change the allocation. Almost every timetable that will not fit is fixed by changing the allocation, and if nobody can do that the exercise stalls.'
    ],
    steps: [
      {
        name: 'Fix the shape of the week first',
        body: [
          { p: 'Days, periods per day, and where the breaks sit. Count the total slots available to a class: days multiplied by periods. That number is the budget every class spends and it does not change because somebody wants an extra history lesson.' },
          { p: 'If Saturday is a half day, or one day has an extra period, say so now. A week that is not uniform is perfectly manageable, and a week that is described as uniform when it is not produces a timetable that cannot be printed.' }
        ]
      },
      {
        name: 'Write the allocation as a plain table',
        body: [
          { p: 'One row per class, subject and teacher, with the periods a week and the number of those that must be doubles. Nothing else.' },
          { ul: [
            'Class — exactly as it will be printed, and spelled the same way every time.',
            'Subject.',
            'Teacher — one name per person, spelled identically in every row. This matters more than anything else on the sheet.',
            'Periods a week.',
            'Doubles, if any.',
            'Room, if you want it on the grid.'
          ] },
          { tool: '/education/timetable/', why: 'takes that allocation and produces a clash-free grid for every class and every teacher, keeps doubles adjacent, honours unavailable days and lists anything that would not fit' }
        ]
      },
      {
        name: 'Do the arithmetic before you run anything',
        body: [
          { p: 'Two sums decide whether a timetable can exist at all, and both can be done in a spreadsheet in a minute. They are worth doing first because a solver that fails tells you it failed, while these tell you why.' },
          { formula: 'for each class:   total periods allocated  ≤  days × periods per day' },
          { formula: 'for each teacher: total periods taught  ≤  available slots, after days off and daily maximums' },
          { p: 'If a teacher is allocated forty-two periods in a forty-period week, no arrangement exists. Not a difficult one — none. The same is true of a class allocated forty-one periods of a forty-period week. This is the commonest reason a timetable "cannot be built", and it is arithmetic rather than bad luck.' },
          { p: 'Take days off out of the teacher’s side before you compare. A teacher who is not in on Wednesdays has lost a fifth of their slots, and a daily maximum of five in a six-period day removes a sixth more.' }
        ]
      },
      {
        name: 'Understand the impossibilities the two sums do not catch',
        body: [
          { p: 'Both totals can pass and the timetable can still be impossible, because the constraint is not on the totals but on the overlap.' },
          { ul: [
            'Two classes that need the same specialist, where the only periods either class has free are the same periods. Each is individually fine; together they need one person in two rooms.',
            'A double period that cannot straddle a break. In a six-period day with a break after the third period, a double can only start in four places, not five — and if the lesson also has to avoid the last period, in three.',
            'A subject that must not appear twice on the same day, allocated more periods a week than there are days.',
            'A part-time teacher whose two days carry more periods than two days hold.',
            'Fixed lessons that overlap. Assembly pinned for every class at the same time is fine; a games period pinned for two classes with one field is not.'
          ] },
          { p: 'These are all pigeonhole problems: more things than places to put them, once you look at the right set of places rather than at the week as a whole.' }
        ]
      },
      {
        name: 'Add the constraints that are actually hard, and only those',
        body: [
          { p: 'Separate the rules from the preferences, in writing, before anybody starts arranging. A hard rule is one that makes a timetable invalid: a teacher who is genuinely not in, a lesson that is genuinely pinned. A preference is everything else — spreading a subject through the week, keeping a teacher’s free periods together, no double mathematics on a Friday afternoon.' },
          { p: 'Preferences submitted as rules are the second commonest reason a timetable will not fit, and the hardest to argue about afterwards, because by then they are written down as constraints and look official.' }
        ]
      },
      {
        name: 'Arrange it, then read what did not fit',
        body: [
          { p: 'Arranging is a search, not a formula: it places the most constrained lessons first, backtracks when it gets stuck, and tries again from a different starting point. Expect a handful of attempts, and expect two runs to produce two different but equally valid timetables.' },
          { p: 'What matters is the list of anything unplaced. A good unplaced list names the class, the subject, the teacher, how many periods did not fit, and the most likely reason — which is usually one of the capacity sums from the step above, already worked out for you. "No free slot where both the class and the teacher are free" means the overlap problem rather than the total.' },
          { p: 'Nothing should be silently dropped. A timetable with one lesson quietly missing is worse than one that failed loudly, because it will be printed, distributed, and discovered in week two.' }
        ]
      },
      {
        name: 'Fix an impossible allocation at the allocation',
        body: [
          { ol: [
            'Split the subject between two teachers. One class, two teachers, three periods each — this is what to do when one specialist is over capacity.',
            'Move a period to another subject or drop it. If the class budget is over, something has to go.',
            'Relax a daily maximum, or buy back a day off. Both have a cost outside the timetable and both are decisions for somebody senior.',
            'Unpin a fixed lesson. A games period pinned on Tuesday because it has always been on Tuesday is often the single constraint making everything else impossible.',
            'Change the shape of the week. A last resort, and occasionally the right answer.'
          ] },
          { p: 'What does not work is running the arranger again and hoping. If the arithmetic says no arrangement exists, no number of attempts will find one.' }
        ]
      },
      {
        name: 'Check it from the other end before you print it',
        body: [
          { p: 'Produce the teacher grids as well as the class grids and read them. A class grid can look perfect while a teacher grid shows somebody teaching a double on both sides of lunch every day of the week.' },
          { ul: [
            'No teacher in two places at once, and no class with two lessons at once.',
            'Every allocated period actually appears, the right number of times.',
            'Doubles are adjacent and on the same side of a break.',
            'Unavailable days are empty.',
            'Every teacher’s day is humane: the arranger optimises for validity, and a valid timetable can still be exhausting.'
          ] },
          { p: 'Then print the class grids for the noticeboard and the teacher grids for the staffroom, and keep the allocation file — next year starts from it.' }
        ]
      }
    ],
    wrong: [
      { name: 'One teacher, spelled two ways',
        text: 'Write "R. Sharma" in nine rows and "Sharma R" in three and there are now two teachers, each with a manageable load, and the clash you were trying to prevent appears on the printed grid in week one. Nothing in the arithmetic will catch it, because both of the imaginary teachers pass every capacity check comfortably. Before anything else, list the distinct teacher names from the allocation and count them. If the count is higher than the staff room, you have found it. The same applies to class names, where "6 A" and "6A" are two different classes.' },
      { name: 'Preferences written down as rules',
        text: 'A teacher who would rather not teach last period on Friday, entered as an unavailability, is indistinguishable from a teacher who is not in the building. Collect twenty of those and the timetable becomes genuinely impossible, and the impossibility is reported as a capacity failure on a teacher who is, in fact, available. Keep two lists — cannot and would rather not — and only the first goes in as a constraint. The second is what you satisfy with whatever freedom is left, and it is what a good arrangement gives you for nothing.' },
      { name: 'Counting the week without the things that are not lessons',
        text: 'Assembly, games, library, club period and the house meeting all occupy slots, and none of them normally appears in a subject allocation. A class budget worked out against the full week is therefore too generous by exactly those periods, and everything fits on paper and not in reality. Either pin them as fixed lessons so they consume their slots honestly, or subtract them from the week before you allocate. Pinning them is better, because then they appear on the printed grid where the pupils can see them.' },
      { name: 'The room nobody modelled',
        text: 'A timetable that has no notion of rooms will happily give two classes science at the same time when there is one laboratory, or three classes games with one field. The room column on an allocation is usually a label printed on the grid rather than a constraint that is enforced, and it is easy to assume otherwise because the room is right there on the sheet. Where a room is genuinely scarce, model it as a teacher: a single imaginary member of staff called "Lab" who cannot be in two places at once will not let two classes use it, and the capacity sums then apply to it like anybody else.' },
      { name: 'Doubles that do not fit where doubles can go',
        text: 'A double period needs two adjacent slots on the same side of a break, which is a much smaller set of positions than "any two periods". In a day split by a break, a double cannot start in the slot before it. Ask for more doubles in a subject than the week has weekly periods and the request is simply contradictory; ask for four doubles across five days in a week whose breaks leave three legal starting positions a day and it is merely very hard. The unplaced list will name the subject, and the fix is nearly always to convert one double back into two singles.' },
      { name: 'Expecting the same timetable twice',
        text: 'Arranging a timetable is a randomised search that keeps the best result it finds within the time it has. Run it twice on the same allocation and you will get two different timetables, both valid. That is fine until somebody prints Tuesday from one run and Wednesday from another, or checks a printed copy against a re-run and reports a fault that is not there. Generate once, export everything from that one run — class grids, teacher grids, the unplaced list — and treat those files as the timetable rather than treating the tool as the timetable.' }
    ],
    faq: [
      { q: 'Why did some lessons not fit?',  a: 'Almost always arithmetic rather than bad luck. Add up one teacher’s periods a week and compare them against the slots available after days off and daily maximums; do the same for the class against the size of the week. The unplaced list names the class, subject and teacher, and the capacity summary usually shows the cause in one line.' },
      { q: 'Can it handle part-time teachers and days off?', a: 'Yes — an unavailable day is a hard constraint and is left empty. What it cannot do is invent capacity: a part-time teacher whose available days do not hold the periods allocated to them will produce an unplaced list, correctly.' },
      { q: 'Does it schedule rooms?', a: 'A room can be shown on the grid, but a scarce room is not enforced as a constraint. Where one laboratory has to be shared, model it as a teacher who cannot be in two places at once; the same capacity arithmetic then applies to it.' },
      { q: 'Is any of this uploaded?', a: 'No. The allocation is read and arranged in your browser and the workbook is written there, so no staff or pupil names leave the machine.' }
    ],
    tools: ['/education/timetable/', '/education/exam-seating/', '/business/sheet-merge/'],
    collections: ['schools', 'start-of-term'],
    related: ['run-payroll-india']
  },

  /* ================================================================== */
  {
    slug: 'chase-unpaid-invoices',
    glyph: 'i-ageing',
    name: 'How to chase an unpaid invoice',
    title: 'How to chase an unpaid invoice: ageing, escalation and what the law gives you',
    description: 'Age the debt properly, chase in the right order, escalate on a schedule rather than on mood, and know what a UK business is entitled to claim on a late commercial payment.',
    answer: 'Age the ledger from the due date so you chase in the right order, send a short factual reminder that names the invoices and the total, escalate on a written schedule rather than on how annoyed you are — and know that a late commercial debt in the UK carries statutory interest and a fixed recovery cost where the contract gives no substantial remedy of its own.',
    minutes: { first: 'an hour', again: 'twenty minutes a week' },
    howLong: 'An hour to set up: produce the ageing, clean the ledger, agree the escalation steps and draft the three letters. Twenty minutes a week afterwards, which is the right rhythm — chasing monthly is too slow to change anybody’s behaviour, and chasing daily makes you the supplier everybody screens. Put it in the calendar on the same day each week and it stops being an emotional decision.',
    before: [
      'A list of unpaid invoices with customer, invoice number, invoice date, due date, amount and anything received against it. The due date is the one that matters and the one most often missing.',
      'Your payment terms, as they appear on the invoice and in the contract. Whether you can charge interest, and at what rate, is decided there first.',
      'Credit notes and payments on account, allocated. An unallocated receipt makes a customer look like a debtor when they have already paid.',
      'A list of anything actually in dispute, with what the dispute is. A disputed invoice is not a late one and chasing it as though it were destroys the relationship and the argument at the same time.',
      'A decision about who sends what, and who is allowed to stop supply.'
    ],
    steps: [
      {
        name: 'Clean the ledger before you age it',
        body: [
          { p: 'Everything below is only as good as the list it starts from, and sales ledgers are usually dirtier than anybody expects.' },
          { ul: [
            'Allocate the payments on account. A customer with an unallocated receipt shows as owing the full invoice.',
            'Allocate the credit notes, and check that each one is recorded as a reduction rather than as a second positive document.',
            'Take out anything in dispute and put it on its own list.',
            'Check for invoices sent to the wrong entity, or to the wrong address, which have never been seen by anybody who could pay them.'
          ] },
          { tool: '/business/bookkeeping/', why: 'gives a real sales ledger with receipts allocated against invoices, so the outstanding balance is the balance rather than a total of documents' }
        ]
      },
      {
        name: 'Age it from the due date, not the invoice date',
        body: [
          { p: 'Days overdue is today minus the due date. Ageing from the invoice date makes everything on thirty-day terms look a month worse than it is, which sounds harmless until it drives the order you chase in and the tone you chase with.' },
          { p: 'Keep what is not yet due entirely separate. It is not late, it should never appear in a bucket, and it must never be chased — a reminder about an invoice that is not due yet tells a customer that your reminders can be ignored.' },
          { tool: '/business/receivables-ageing/', why: 'turns the list into buckets by days overdue with a total per customer, keeps the not-yet-due apart, and drafts a letter per debtor that names their invoices' }
        ]
      },
      {
        name: 'Read the report before you send anything',
        body: [
          { p: 'The ageing is a diagnosis, not just a chasing list.' },
          { ul: [
            'Concentration. If most of the overdue total is one customer, you do not have a collections problem, you have a customer problem, and it needs a different conversation at a different level.',
            'The oldest bucket. Anything that has been there for months is usually not a payment problem at all — it is a dispute nobody logged, an invoice never received, or a purchase order number missing from your invoice.',
            'The pattern. A customer who always pays two weeks late, every time, is telling you their terms rather than yours. That is a renegotiation, not a chase.',
            'Part payments. A customer paying round numbers against a balance is usually managing their own cash by instalments, and a payment plan you agree is better than a series of chases you do not.'
          ] }
        ]
      },
      {
        name: 'Chase in an order, and make it the same order every week',
        body: [
          { p: 'Biggest and oldest first. The purpose is not fairness, it is cash: the hour you have goes where it recovers the most money. Within that, chase the ones you have a working relationship with first, because they are the ones most likely to pay on being asked.' },
          { p: 'One contact per customer per step, naming every invoice and the total. Nothing annoys an accounts payable department more than four separate emails about four invoices, and nothing gets ignored faster.' }
        ]
      },
      {
        name: 'Escalate on a schedule, not on a mood',
        body: [
          { ol: [
            'Before it is due: a statement, not a chase. Many invoices are late because they never reached the person who pays them.',
            'A few days after the due date: a short, friendly, factual reminder. Invoice numbers, dates, amounts, total, how to pay. No adjectives.',
            'Two weeks: a phone call to the person who actually processes payments, followed by an email confirming what was agreed. The call is the step that works; the email is what makes it real.',
            'A month: a firmer letter from somebody more senior, with a payment date requested in writing, and — if your terms allow it — notice that interest and recovery costs will be applied.',
            'Beyond that: a formal letter before action, then stopping supply, then recovery. Each of those is a decision, not a reflex, and each should be taken by somebody who can live with the consequence.'
          ] },
          { p: 'Whatever the steps are, write them down and follow them for everybody. An escalation ladder that is applied to the customers you find annoying and not to the ones you like is not a policy, and it is the reason the awkward debts are always the oldest.' },
          { tool: '/business/mail-merge/', why: 'writes one letter with placeholders and produces a PDF per customer from a spreadsheet, for the steps where a letter has to go out on paper' }
        ]
      },
      {
        name: 'Know what you can actually claim — the UK position',
        body: [
          { p: 'For a commercial debt between businesses, statute supplies a remedy where the contract does not provide a substantial one of its own. It gives a right to interest at a rate set by reference to the Bank of England base rate, a fixed sum per invoice as compensation for the cost of recovery, and reasonable additional recovery costs above that fixed sum.' },
          { fact: {
            text: 'Statutory interest on a late commercial debt runs at the Bank of England base rate plus a fixed number of percentage points, and each overdue invoice also carries a fixed compensation sum which steps up in bands according to the size of the debt, with reasonable additional recovery costs claimable on top. The entitlement applies to business-to-business debts and can be displaced by a contract that provides a substantial remedy of its own. The rate, the bands and the conditions are set by the Act and summarised by gov.uk; the base rate the interest is calculated from is published by the Bank of England and changes.',
            checked: CHECKED,
            sources: [
              src('ukLatePayment', 'the entitlement, the fixed sums and how to claim them'),
              src('ukLatePaymentAct', 'the Act itself, including what counts as a substantial contractual remedy'),
              src('ukBaseRate', 'the base rate the statutory interest is calculated from')
            ]
          } },
          { p: 'Two practical points. First, you may claim it and you are not obliged to — many businesses reserve it and waive it as part of getting paid. Second, raising it for the first time in a letter before action, having never mentioned it in an invoice or a reminder, invites an argument you did not need. Put the entitlement on the invoice.' },
          { tool: '/business/invoice-payment-terms/', why: 'works out the due date from the terms and the interest accruing on a late payment, and whether an early settlement discount is worth taking' }
        ]
      },
      {
        name: 'The formal step, and what it commits you to',
        body: [
          { p: 'A letter before action states the debt, the invoices, what you want and by when, and says what you will do if it is not paid. It has to be a step you are willing to take, because the next one is a claim.' },
          { fact: {
            text: 'Where the creditor is a business and the debtor is an individual — which includes a sole trader — a pre-action protocol applies before a debt claim is issued. It sets out what the letter of claim must contain, the documents that go with it, and the period the debtor has to respond before proceedings are started. Following it is not optional and a court will look at whether it was followed.',
            checked: CHECKED,
            sources: [
              src('ukDebtProtocol', 'what the letter of claim must contain and how long the debtor has to reply'),
              src('ukMakeCourtClaim', 'the claim itself, the fees and the small claims track')
            ]
          } },
          { p: 'Before sending it, check three things: that the invoice is not disputed, that you are claiming against the right legal entity, and that you have the evidence — the order, the delivery, the invoice, the terms. A claim against the trading name rather than the company is a claim against nobody.' }
        ]
      },
      {
        name: 'Decide when to stop, and stop the same way every time',
        body: [
          { p: 'Not every debt is worth chasing. Below some amount, the cost of the chase exceeds the debt, and past some age the probability of recovery is low enough that the time is better spent on the next sale. Pick both thresholds in advance so that the decision is a policy rather than a mood.' },
          { p: 'Write off what you have decided not to pursue, properly, in the ledger. A sales ledger carrying five years of uncollectable debt gives a debtor figure nobody believes, ages badly, and quietly overstates both the assets and the profit that were recognised when the sale was made.' }
        ]
      }
    ],
    wrong: [
      { name: 'Ageing from the invoice date',
        text: 'Days overdue means days past the due date. Aged from the invoice date, every invoice on thirty-day terms is a whole month further along than it really is, so a customer who is three days late sits in the same bucket as one who is a month late, and the tone of the letter that goes out is wrong for both. Worse, invoices that are not due at all appear in the ageing, and chasing an invoice that is not due teaches a customer that your reminders do not mean anything.' },
      { name: 'Unallocated credits and receipts',
        text: 'A payment received on account but not matched to an invoice leaves the invoice showing as fully outstanding; a credit note recorded as a positive document does the same thing twice over. Both produce a chasing letter to a customer who has already paid, which is the single fastest way to lose the argument and the relationship in one message. The defence is to allocate before you age, and to check that any customer with both a large debt and a large unallocated credit is looked at by a person before anything is sent.' },
      { name: 'The dispute nobody logged',
        text: 'An invoice sitting in the oldest bucket for six months is usually not a payment problem. It is a short delivery, a missing purchase order number, a price nobody agreed, or an invoice addressed to a company that no longer exists — raised once by somebody at the customer, mentioned to somebody at your end, and never written down. Every chase sent after that point is answered by silence, because as far as they are concerned the ball is with you. Anything over about sixty days deserves a phone call whose only purpose is to find out what is actually wrong.' },
      { name: 'Interest that appears for the first time in the letter before action',
        text: 'The entitlement to statutory interest and recovery costs does not depend on having mentioned it, but the commercial reality is that a charge nobody has ever seen before, arriving with a legal threat, turns a collection into a negotiation about the charge. Put the entitlement on the invoice and in the terms, mention it in the second reminder, and then applying it is a consequence somebody was warned about rather than an escalation they can dispute.' },
      { name: 'A statement that does not agree with their purchase ledger',
        text: 'Sending a statement is the most effective single step in collections, and it only works if the two ledgers can be compared. If your statement omits credit notes, uses your own reference rather than their purchase order number, or lists invoices they never received, their accounts payable team cannot match it and will do nothing. Before escalating anything, send a statement that shows every document, in their reference where you have it, and ask them to tell you which lines they do not have.' },
      { name: 'Stopping supply without reading the contract',
        text: 'Stopping supply is the most powerful lever there is and the one most likely to be used badly. A contract may require notice, may not permit suspension for an unrelated invoice, and may carry penalties for non-delivery that are larger than the debt. Where the customer is dependent on you, cutting them off may also destroy their ability to pay at all. Decide before the ladder is written who is allowed to pull it, on what terms, and with what notice.' }
    ],
    faq: [
      { q: 'What should the first reminder say?', a: 'The invoice numbers, the dates, the amounts, the total, and how to pay. No adjectives, no apology, no threat. Most first reminders work because the invoice never reached the right person, not because anybody decided not to pay.' },
      { q: 'Can I charge interest on a late invoice?', a: 'For a commercial debt in the UK there is a statutory entitlement to interest and a fixed recovery sum where the contract does not give a substantial remedy of its own. Whether you exercise it is a commercial decision. The rate is tied to the Bank of England base rate and moves with it, so any figure has to be worked out at the time.' },
      { q: 'Are the reminder letters safe to send?', a: 'Letters that state facts — the invoices, the amounts, the dates, and what you would like to happen — and that make no threat are ordinary business correspondence. A statement that an account will be put on hold is a statement of intent. A statutory demand, or a notice under your own contract terms, is a different kind of document and is a job for a solicitor.' },
      { q: 'When should I write a debt off?', a: 'When the expected recovery is less than the cost of pursuing it, on thresholds you set in advance rather than in the moment. Write it off in the ledger when you do, because a debtors figure carrying years of uncollectable invoices overstates both the asset and the profit.' }
    ],
    tools: ['/business/receivables-ageing/', '/business/invoice-payment-terms/', '/business/bookkeeping/', '/business/mail-merge/', '/pdf/invoice-pdf/'],
    collections: ['get-paid', 'small-business', 'freelancers'],
    related: ['bank-reconciliation', 'run-payroll-india']
  },

  /* ================================================================== */
  {
    slug: 'excel-to-tally',
    glyph: 'i-tally',
    name: 'How to get a spreadsheet of vouchers into Tally',
    title: 'How to get a spreadsheet of vouchers into Tally',
    description: 'Lay a voucher spreadsheet out so it can be imported, create the ledgers first, and get the sign convention right — because in Tally XML a debit is negative and every voucher must sum to zero.',
    answer: 'Lay the spreadsheet out as one row per voucher or one row per ledger line, create the ledgers before the vouchers, convert to Tally import XML, and import into a test company first — and the thing that trips everybody up is the sign convention, because in that XML a debit is a negative amount, a credit is positive, and every voucher must sum to zero.',
    minutes: { first: 'an hour', again: 'ten minutes' },
    howLong: 'An hour for a first batch, nearly all of it spent on ledger names and on the test import that fails for one reason you then fix everywhere. Ten minutes for each batch after that. If you are doing this monthly it is worth saving the column mapping, because the sheet will have the same shape next month and remapping it is the only part that is boring.',
    before: [
      'The vouchers in a spreadsheet — sales, purchases, receipts, payments, journals or contras — with a date, a voucher type, a number, a party and an amount on every row.',
      'The exact ledger names as they exist in the Tally company: the party ledgers, the sales and purchase ledgers, the tax ledgers, the bank and cash ledgers. Exact, including capitals and the spaces.',
      'A test company in Tally with the same masters as the live one. Not optional. An import that goes wrong in a live company is undone one voucher at a time.',
      'A backup of the live company, taken before the real import.'
    ],
    steps: [
      {
        name: 'Choose one of the two layouts',
        body: [
          { p: 'One row per voucher is the simpler and covers most of what a small business imports: date, voucher type, voucher number, party, amount, and the tax columns you use. The debits and credits for a sales, purchase, receipt, payment, journal or contra voucher follow from the type, and they can be worked out for you.' },
          { p: 'One row per ledger line suits an export from another package: a voucher number that groups the lines, a date, a ledger and separate debit and credit columns. It is more work to prepare and it can express anything, including a journal with six lines.' },
          { p: 'Do not mix them in one file. A sheet that is mostly one row per voucher with three multi-line journals in the middle is the hardest kind of file to import, and splitting it into two sheets takes a minute.' },
          { tool: '/business/tally-converter/', why: 'turns either layout into Tally import XML, builds the debits and credits from the voucher type, checks every voucher balances, and reads Tally’s own exported XML back into a spreadsheet' }
        ]
      },
      {
        name: 'Create the ledgers before you import a single voucher',
        body: [
          { p: 'Tally will not create a ledger because a voucher mentions one. Every ledger named in a voucher has to exist in the company already, spelled exactly as the voucher spells it, or the import stops.' },
          { p: 'So the order is: masters first, vouchers second. Generate a ledger masters file for the parties that do not exist yet, import that, check the names in Tally, and only then import the vouchers.' },
          { p: 'Pay particular attention to the ledgers that are not parties — the sales and purchase accounts, the tax ledgers, the round-off ledger, the bank. Those are typed once in a default box and then used on every row, so one wrong spelling is a whole batch.' }
        ]
      },
      {
        name: 'Get the dates into a form that means one thing',
        body: [
          { p: 'A date is the second most common reason an import produces plausible nonsense. A spreadsheet stores a date as a serial number. Indian sheets are typed day-month-year. Exports from other systems write year-month-day. Tally wants eight digits with no separators.' },
          { p: 'All of those can be read, but a date typed as two numbers and a year is genuinely ambiguous whenever both of those numbers are twelve or less, and no amount of cleverness will resolve it — the same characters are the third of April to one person and the fourth of March to another. Check the preview of what each row was taken to mean, and look specifically at rows whose day number is twelve or less, because those are the only ones that can be wrong.' }
        ]
      },
      {
        name: 'Understand the sign convention — this is the one',
        body: [
          { p: 'In Tally’s import XML a debit is a negative amount and a credit is positive. Each ledger line also carries a flag which says whether the amount is deemed positive, and a debit carries that flag as yes while the amount itself is negative. It reads backwards the first time and it is entirely consistent once you accept it.' },
          { formula: 'debit  →  negative amount        credit  →  positive amount        every voucher sums to zero' },
          { p: 'A sales invoice debits the party — the customer owes you — and credits the sales account and each tax ledger. A purchase does the reverse: the supplier is credited and the purchase account and taxes are debited. A receipt debits the bank and credits the party. A payment credits the bank and debits the party.' },
          { example: {
            caption: 'Made-up figures for one sales voucher, to show the signs rather than any real invoice.',
            head: ['Ledger', 'Dr or Cr', 'Amount in the XML'],
            rows: [
              ['Acme Traders (the party)', 'Debit', '−118,000'],
              ['Sales — Goods', 'Credit', '+100,000'],
              ['Output CGST', 'Credit', '+9,000'],
              ['Output SGST', 'Credit', '+9,000'],
              ['Total', '', '0']
            ]
          } },
          { p: 'The check is that the lines add to zero. Anything that does not balance should refuse to be written, naming the row — an import file that contains one unbalanced voucher is worse than one that was never produced, because the other four hundred will go in first.' }
        ]
      },
      {
        name: 'Convert, and read the issues list properly',
        body: [
          { p: 'What comes out is an XML envelope holding one message per voucher. What matters more at this stage is the list of rows that did not convert.' },
          { ul: [
            'A row with no party ledger.',
            'An amount that is not a number — usually a currency symbol, a stray space, or a value typed as text.',
            'A tax column that is not a number, which is the same problem one column over.',
            'No sales, purchase or bank ledger named, and no default set.',
            'A voucher whose lines do not balance, in the one-row-per-line layout: a missing line, a typo in a voucher number that split one voucher into two, or a rounding difference that needs a round-off line.'
          ] },
          { p: 'Fix these in the spreadsheet rather than in the XML. The spreadsheet is the source; an XML file edited by hand will be regenerated next month and the fix will be gone.' }
        ]
      },
      {
        name: 'Import into a test company and count things',
        body: [
          { p: 'Import the masters, then the vouchers, into a copy of the company. Then check, in this order:' },
          { ol: [
            'The count. Day Book for the period should hold exactly as many vouchers as the sheet had. One short means one was rejected and the import log will say which.',
            'The totals. The sales account for the period should equal the sum of the amount column. If it does not, look at the tax columns first.',
            'One voucher, opened. Check the party, the ledgers, the narration and the sign — is the customer a debtor or a creditor?',
            'The party balances. A handful of parties against your own statement, which is what would have found a reversed sign before anybody else saw it.',
            'The import log itself. Tally reports what it created, altered and ignored, and "ignored" is a word that deserves to be read.'
          ] },
          { p: 'Only when all five are right does the same file go into the live company, on top of a backup.' }
        ]
      },
      {
        name: 'Bringing data back out of Tally',
        body: [
          { p: 'The reverse trip is often the more useful one: the day book or a ledger exported as XML from Tally, read back into a spreadsheet, one row per voucher or one per ledger line. That is how you get a purchase register out for a tax reconciliation, or a bank ledger out to reconcile against a statement.' },
          { p: 'From Tally: Display, then Day Book (or the ledger you want), then export, with the format set to XML. Drop the file into the converter and take it as a workbook.' },
          { tool: '/business/accounting-converter/', why: 'moves journals and invoices between QuickBooks, Zoho Books and Tally in both directions, checking every voucher balances on the way' }
        ]
      }
    ],
    wrong: [
      { name: 'The sign convention, flipped',
        text: 'This is the one the guide is named for. Debit is negative in Tally XML, credit is positive, and it is the opposite of what almost every other system does and of what most people assume. Get it backwards on a sales voucher and the customer is credited instead of debited: the import succeeds, nothing complains, and the customer appears as a creditor. Every total in the profit and loss looks plausible, the voucher still sums to zero, and the error is found weeks later when somebody wonders why a customer has a credit balance. Open one imported voucher and look at it before importing four hundred.' },
      { name: 'A ledger name that is one character different',
        text: 'Tally matches ledgers by name. "Sundry Debtors" is not "Sundry debtors", "ABC Traders Pvt Ltd" is not "ABC Traders Pvt. Ltd.", and a trailing space typed into a spreadsheet cell is invisible in every view of that spreadsheet. The import will either stop on the unknown ledger, which is the good outcome, or — if the create-missing option is on — create a second, nearly identical ledger and post to that, which is the bad one. Export the ledger list out of Tally first and match against it rather than typing names from memory.' },
      { name: 'The third of April and the fourth of March',
        text: 'A date typed as two numbers and a year is ambiguous whenever both of those numbers are twelve or less, and any converter has to pick a convention. Pick the wrong one and a good share of the vouchers in a batch land in the wrong month, which puts them in the wrong tax period, the wrong return and the wrong reconciliation, all of which are found much later. The only rows that can be wrong are those where both the day and the month are twelve or less, so that is where to look. Better still, format the date column as an unambiguous text with the year first before exporting from wherever the sheet came from.' },
      { name: 'A voucher that balances to the paisa but not to the invoice',
        text: 'Base plus the tax lines, each rounded at its own line, frequently comes to a paisa or two away from the invoice total. In a one-row-per-line layout that voucher will not balance and will be rejected, which is correct. The fix is a round-off ledger line carrying the difference, not widening the tolerance — a tolerance that swallows a paisa will swallow a rupee, and eventually swallows a missing line in a six-line journal, which is the error it was supposed to catch.' },
      { name: 'Invoice numbers that the spreadsheet turned into numbers',
        text: 'An invoice number like 0042 is a string, and a spreadsheet stores it as forty-two. A number like 2026041501 becomes scientific notation. Either way the voucher number that reaches Tally is not the number on the document, and it will not match anything afterwards — not the customer’s statement, not the tax reconciliation, not a search. Format the column as text before anything is typed or pasted into it, and check a couple of values after every export.' },
      { name: 'Importing into the live company first',
        text: 'There is no undo. Rolling back a bad import means deleting vouchers one at a time, or restoring a backup and losing everything entered since it was taken. The test company exists precisely because the first import always fails for a reason nobody predicted — a ledger under the wrong group, a voucher type that is named differently in this company, a GST classification the vouchers do not carry. Import into the copy, fix the spreadsheet, and regenerate. The whole loop is a few minutes and it is the difference between a mistake and an incident.' },
      { name: 'Assuming the tax details came across with the amounts',
        text: 'Tax amounts posted to tax ledgers are not the same thing as the GST details a return needs. A voucher can carry the right rupees on the right ledgers and still be incomplete for the statutory reports, because those want classifications and stock item details the spreadsheet never had. The trial balance will be right and a return generated from Tally may not be. Check one imported voucher against what your returns actually need before you rely on the data downstream.' }
    ],
    faq: [
      { q: 'Why does a voucher fail the balance check?', a: 'In Tally every voucher’s debits equal its credits. In the one-row-per-voucher layout that is worked out from the amount and the taxes. In the one-row-per-line layout the debit and credit columns are added up per voucher number and a difference stops it — usually a missing line, a typo in a voucher number that split one voucher in two, or a rounding difference that needs a round-off line.' },
      { q: 'Tally says a ledger does not exist. What now?', a: 'Every ledger named in a voucher must already exist, spelled exactly as the voucher spells it. Generate a masters file for the parties, import that first, and check the sales, purchase, tax and bank ledger names against the company’s own ledger list rather than against memory.' },
      { q: 'Does it calculate GST?', a: 'No. Tax columns you map are carried onto the tax ledgers exactly as you typed them. It does not work out a rate, and it does not write the full GST classification details that Tally’s statutory reports use, so check those in Tally after the import.' },
      { q: 'Can I get data back out of Tally the same way?', a: 'Yes. Export the day book or a ledger from Tally as XML and read it back as a workbook, one row per voucher or one per ledger line. That is the usual way to get a purchase register or a bank ledger out for a reconciliation.' }
    ],
    tools: ['/business/tally-converter/', '/business/accounting-converter/', '/business/sheet-merge/', '/business/id-validator/'],
    collections: ['accountants', 'month-end'],
    related: ['reconcile-gstr-2b', 'bank-reconciliation']
  }
];

module.exports = { GUIDES, AUTHORITIES, SRC, CHECKED };
