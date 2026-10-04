'use strict';
/* Story data for the Business section (/business/). Contract: kit2-schema.md §1–2.
   All browser tools: free, no sign-up, nothing typed or dropped is uploaded.
   Calculators carry `calc` specs with real engine keys (UK £ for the UK payroll
   tools, plain figures for the rest). Spreadsheet and file tools carry `schematic`
   specs that describe their true input and output; their sample lines use only
   figures the tool's own page states, never an invented result. */

const CALC = ['Free', 'No sign-up', 'Runs in your browser'];
const FILES = ['Free, no sign-up', 'Nothing uploaded', 'Runs in your browser'];

module.exports = {
  '/business/currency-converter/': {
    persona: 'Exporters, freelancers and travellers',
    hook: 'Client pays $2,500. What is that in rupees today?',
    pain: 'A foreign invoice needs a local figure for your books, and the rate moves every day.',
    usual: ['Search results with no rate date', 'Bank apps that quote with a margin', 'Converter sites heavy with ads'],
    promise: 'Pick two currencies, type an amount. See the daily reference rate.',
    steps: ['Type the amount', 'Pick from and to currencies', 'Read the converted figure'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'converter', value: 2500, from: 'USD', to: 'INR' },
    howTo: 'How to convert an invoice at today’s rate, free',
    cta: 'Convert it free'
  },

  '/business/profit-margin/': {
    persona: 'Shop owners and resellers',
    hook: 'A 50% markup is only a 33% margin. Still pricing by markup?',
    pain: 'Your supplier talks markup, your accountant talks margin, and your prices are quietly too low.',
    usual: ['Mixing up margin and markup', 'Formulas copied from a forum', 'Guessing a multiplier per product'],
    promise: 'Enter any two of cost, price and margin. Get the rest, both ways.',
    steps: ['Choose what to solve for', 'Enter cost and price', 'Read margin and markup'],
    proof: CALC,
    example: { kind: 'calc', inputs: { solve: 'margin', cost: 60, price: 90, units: 1000 } },
    howTo: 'How to work out margin and markup, free',
    cta: 'Check my margin'
  },

  '/business/break-even/': {
    persona: 'Founders and small-business owners',
    hook: 'Rent is 4,500 a month. How many do you need to sell?',
    pain: 'You know your rent and your price. You do not know the sales figure where the losing stops.',
    usual: ['Back-of-envelope sums that miss costs', 'Models that take an afternoon to build', 'Hoping the month works out'],
    promise: 'Enter fixed costs, price and unit cost. Get your break-even point.',
    steps: ['Enter fixed costs', 'Add price and variable cost', 'Read units to break even'],
    proof: CALC,
    example: { kind: 'calc', inputs: { fixed: 4500, price: 12, variable: 4.5, target: 0, actual: 800 } },
    howTo: 'How to find your break-even point, free',
    cta: 'Find my break-even'
  },

  '/business/roi/': {
    persona: 'Business owners weighing a spend',
    hook: '50% return sounds great. Over 5 years it is 8.45% a year.',
    pain: 'A supplier pitches a 50% return. Spread over five years, is it actually any good?',
    usual: ['Headline ROI with no time attached', 'Payback guessed, not worked out', 'Pitches that pick the flattering figure'],
    promise: 'Enter cost, return and years. Get ROI, annual return and payback.',
    steps: ['Enter the investment', 'Add return and holding period', 'Compare ROI and annual rate'],
    proof: CALC,
    example: { kind: 'calc', inputs: { cost: 20000, gain: 30000, years: 5, annualCash: 6000 } },
    howTo: 'How to compare ROI over different time spans',
    cta: 'Check the return'
  },

  '/business/npv-irr/': {
    persona: 'Finance managers and analysts',
    hook: '72k back on a 50k outlay. Does it beat your cost of capital?',
    pain: 'The project returns more than it costs. Whether it is worth doing depends on when the money arrives.',
    usual: ['Spreadsheet NPV with the wrong period', 'Comparing totals without discounting', 'An IRR quoted with no context'],
    promise: 'Enter the outlay, cash flows and rate. Get NPV, IRR and payback.',
    steps: ['Enter the initial investment', 'List the yearly cash flows', 'Read NPV, IRR and verdict'],
    proof: CALC,
    example: { kind: 'calc', inputs: { initial: 50000, flows: '12000, 15000, 15000, 15000, 15000', rate: 10 } },
    howTo: 'How to work out NPV and IRR for a project',
    cta: 'Value the project'
  },

  '/business/cagr/': {
    persona: 'Founders and investors',
    hook: 'Sales went from 200k to 350k in 3 years. Growth per year?',
    pain: 'Revenue rose 75% in three years. The investor asks for the annual growth rate, and averages mislead.',
    usual: ['Averaging yearly growth rates', 'Fiddly power formulas in a sheet', 'Rounding to whatever sounds good'],
    promise: 'Enter start value, end value and years. Get CAGR and a projection.',
    steps: ['Enter the beginning value', 'Enter ending value and years', 'Read CAGR and projection'],
    proof: CALC,
    example: { kind: 'calc', inputs: { begin: 200000, end: 350000, years: 3, project: 3 } },
    howTo: 'How to calculate compound annual growth rate',
    cta: 'Work out my CAGR'
  },

  '/business/depreciation/': {
    persona: 'Bookkeepers and business owners',
    hook: 'New van for 30,000. What do you write off this year?',
    pain: 'The asset register needs a yearly charge, and you cannot remember how reducing balance works.',
    usual: ['Textbook formulas half remembered', 'Building a schedule row by row', 'Mixing depreciation with tax relief'],
    promise: 'Pick a method, enter cost and life. Get the year-by-year schedule.',
    steps: ['Pick the method', 'Enter cost, residual and life', 'Copy the yearly schedule'],
    proof: CALC,
    example: { kind: 'calc', inputs: { method: 'db', cost: 30000, salvage: 3000, life: 5, dbRate: 25 } },
    howTo: 'How to build a depreciation schedule, free',
    cta: 'Build my schedule'
  },

  '/business/amortization-schedule/': {
    persona: 'Homeowners and borrowers',
    hook: 'Overpay 200 a month. The mortgage ends 6 years early.',
    pain: 'Most of each early payment goes on interest. You want to see the schedule, and how to shorten it.',
    usual: ['Statements with one line a year', 'Amortisation tables built by hand', 'No idea what an overpayment saves'],
    promise: 'Enter loan, rate and term. See every payment, with overpayments.',
    steps: ['Enter loan, rate and term', 'Add a monthly overpayment', 'Read the schedule and savings'],
    proof: CALC,
    example: { kind: 'calc', inputs: { amount: 200000, rate: 5.5, years: 25, overpay: 200, view: 'annual' } },
    howTo: 'How to see what mortgage overpayments save',
    cta: 'See my schedule'
  },

  '/business/business-ratios/': {
    persona: 'Owners, lenders and analysts',
    hook: 'The bank asks for your current ratio. Do you know it?',
    pain: 'The lender, the investor and the board all want ratios. Your accounts give you raw numbers.',
    usual: ['Ratio formulas looked up one by one', 'A spreadsheet tab nobody maintains', 'Paying someone to read your own accounts'],
    promise: 'Enter balance sheet and P&L figures. Get eleven key ratios at once.',
    steps: ['Enter balance sheet figures', 'Add revenue and profits', 'Read every ratio at once'],
    proof: CALC,
    example: { kind: 'calc', inputs: { currentAssets: 250000, inventory: 80000, currentLiabilities: 150000, totalAssets: 600000, totalDebt: 200000, equity: 300000, revenue: 900000, grossProfit: 360000, netProfit: 72000 } },
    howTo: 'How to calculate financial ratios from accounts',
    cta: 'Run my ratios'
  },

  '/business/uk-take-home-pay/': {
    persona: 'UK employees weighing an offer',
    hook: '£48k offer. What actually hits your account each month?',
    pain: 'The offer says £48,000. Your rent is monthly, and tax, NI and pension all come off first.',
    usual: ['Dividing the salary by twelve', 'Tax band tables and a calculator', 'Payslip guesswork before you sign'],
    promise: 'Enter your salary and pension. See tax, NI and take-home pay.',
    steps: ['Enter your gross salary', 'Set pension and student loan', 'Read monthly take-home'],
    proof: CALC,
    example: { kind: 'calc', inputs: { gross: 48000, year: '2026/27', pension: 5, student: 'none' } },
    howTo: 'How to work out UK take-home pay, free',
    cta: 'See my take-home'
  },

  '/business/employer-cost/': {
    persona: 'UK employers hiring their first staff',
    hook: 'Hiring at £30k? With NI, pension and kit: £37,650.',
    pain: 'The job ad says £30,000. Employer NI, pension and kit make the real bill much bigger.',
    usual: ['Budgeting on salary alone', 'Forgetting the 15% employer NI', 'Finding out at the first payroll run'],
    promise: 'Enter salary and extras. See the true yearly, monthly and hourly cost.',
    steps: ['Enter the gross salary', 'Add pension and overheads', 'Read the true annual cost'],
    proof: CALC,
    example: { kind: 'calc', inputs: { salary: 30000, year: '2026/27', pension: 3, allowance: 'no', overheads: 3000, recruitment: 4000 } },
    howTo: 'How to work out the true cost of an employee',
    cta: 'Cost the hire'
  },

  '/business/discount-calculator/': {
    persona: 'Retailers and online sellers',
    hook: '20% off, then another 20% off. That is 36%, not 40%.',
    pain: 'You stack two promotions and think you know the price. Your margin is about to find out otherwise.',
    usual: ['Adding discounts together', 'Forgetting what discounts do to margin', 'Working backwards on a calculator'],
    promise: 'Enter the price and discounts. See the sale price and the margin hit.',
    steps: ['Enter the original price', 'Add one or two discounts', 'Check the margin after'],
    proof: CALC,
    example: { kind: 'calc', inputs: { original: 100, d1: 20, d2: 20, cost: 50 } },
    howTo: 'How to stack discounts and keep your margin',
    cta: 'Check the discount'
  },

  '/business/commission-calculator/': {
    persona: 'Sales managers and payroll',
    hook: '150k in sales on a tiered plan. What is the commission?',
    pain: 'A rep hit 300% of quota. Payroll needs the tiered commission today, and the plan PDF is no help.',
    usual: ['Tier maths done by hand', 'Spreadsheets nobody else can follow', 'Disputes over which rate applied'],
    promise: 'Pick the structure, enter sales. Get commission and effective rate.',
    steps: ['Choose flat, threshold, tiered', 'Enter sales, rate and quota', 'Read the commission earned'],
    proof: CALC,
    example: { kind: 'calc', inputs: { sales: 150000, structure: 'tiered', rate: 5, threshold: 50000, base: 30000 } },
    howTo: 'How to calculate tiered sales commission',
    cta: 'Work out commission'
  },

  '/business/invoice-payment-terms/': {
    persona: 'Finance teams and business owners',
    hook: '2% off for paying early is worth 37% a year.',
    pain: 'A supplier offers 2% off for paying within 10 days. Is it worth parting with the cash now?',
    usual: ['Ignoring settlement discounts', 'Counting due dates on a calendar', 'Not knowing what late interest applies'],
    promise: 'Enter the invoice and terms. Get the due date and discount verdict.',
    steps: ['Enter invoice date and amount', 'Pick terms and discount', 'Read due date and verdict'],
    proof: CALC,
    example: { kind: 'calc', inputs: { invoiceDate: '2026-09-01', terms: '30', amount: 12000, discount: 2, discountDays: 10, daysLate: 0 } },
    howTo: 'How to tell if an early payment discount pays',
    cta: 'Check the terms'
  },

  '/business/tally-converter/': {
    persona: 'Accountants who work in Tally',
    hook: '400 sales rows in Excel. Tally wants XML.',
    pain: 'Your client sends a spreadsheet. Keying every voucher into Tally takes the whole afternoon.',
    usual: ['Typing vouchers in one by one', 'Paid add-ons for a one-off import', 'Macros that break on a new column'],
    promise: 'Drop the sheet, check the columns. Get Tally import XML that balances.',
    steps: ['Drop your Excel or CSV', 'Check the column matches', 'Download the Tally XML'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Excel or CSV of sales, purchases, receipts, payments',
      output: 'Tally import XML: vouchers, party ledgers, stock items',
      sampleIn: 'Date | Vch No | Party | Amount | GST columns — one row per voucher',
      sampleOut: 'Every voucher checked to balance, plus a ledger-masters file to import first'
    },
    howTo: 'How to import an Excel sheet into Tally',
    cta: 'Convert my sheet'
  },

  '/business/accounting-converter/': {
    persona: 'Accountants with clients on two systems',
    hook: 'Books in one package, client on another. Stop retyping.',
    pain: 'Two packages, one set of books. Re-entering journals by hand is where the errors creep in.',
    usual: ['Retyping journals line by line', 'Export formats that never match', 'Unbalanced entries found at year end'],
    promise: 'Drop the export, pick a direction. Get vouchers checked to balance.',
    steps: ['Drop the journal export', 'Choose the direction', 'Download the import file'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'A journal or invoice export (CSV) or a Tally day book',
      output: 'Tally vouchers, or the journal CSV the other side imports',
      sampleIn: 'Journal CSV: Date, Num, Account, Debit, Credit, Memo',
      sampleOut: 'Tally vouchers with date, number, narration — any unbalanced one named'
    },
    howTo: 'How to move journals between accounting packages',
    cta: 'Convert my journals'
  },

  '/business/bank-reconciliation/': {
    persona: 'Bookkeepers closing the month',
    hook: 'Statement says one balance. Books say another. Find why.',
    pain: 'Month end. The bank and the ledger disagree, and you are ticking entries off with a pen.',
    usual: ['Ticking two printouts side by side', 'Lookups that trip on equal amounts', 'Bank charges nobody entered'],
    promise: 'Drop the statement and ledger. Get matched pairs and what is left.',
    steps: ['Drop statement and ledger', 'Map money in and money out', 'Download the reconciliation'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Bank statement + bank ledger, as Excel or CSV',
      output: 'Matched pairs, unmatched on each side, balances explained',
      sampleIn: 'Statement and ledger for September, three-day date window',
      sampleOut: 'Only on statement: bank charges, interest · Only in books: unpresented cheques'
    },
    howTo: 'How to reconcile a bank statement with your books',
    cta: 'Reconcile it free'
  },

  '/business/einvoice-json/': {
    persona: 'GST-registered sellers in India',
    hook: '50 invoices to e-invoice? Make one bulk-upload file.',
    pain: 'Keying each invoice into the portal is slow, and one mistyped GSTIN sends it back.',
    usual: ['Keying invoices in one by one', 'Upload errors from one wrong GSTIN', 'Working out CGST or IGST by hand'],
    promise: 'Drop the invoice sheet. Get schema 1.1 JSON, checked before upload.',
    steps: ['Drop your invoice sheet', 'Fix anything flagged', 'Upload the JSON to the portal'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Invoice spreadsheet, one row per line item',
      output: 'E-invoice JSON (schema 1.1) for bulk upload',
      sampleIn: 'Invoice no., date, buyer GSTIN, HSN, qty, unit price, GST rate',
      sampleOut: 'One JSON file · CGST+SGST or IGST from the state codes · GSTIN checksums checked'
    },
    howTo: 'How to make e-invoice JSON from a spreadsheet',
    cta: 'Build my JSON'
  },

  '/business/gst-reconciler/': {
    persona: 'GST accountants and CAs',
    hook: 'Which ITC is safe to claim before your 3B is due?',
    pain: 'Your purchase register and GSTR-2B never agree. Claim credit a supplier never filed and it comes back.',
    usual: ['Matching 2B to the books by eye', 'Invoice numbers written ten ways', 'Chasing suppliers after 3B is filed'],
    promise: 'Drop your register and 2B. See matched, missing and mismatched ITC.',
    steps: ['Download 2B as JSON or Excel', 'Drop it with your register', 'Chase the suppliers listed'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Purchase register + GSTR-2B (JSON or Excel)',
      output: 'Matched ITC, only in books, only in 2B, tax differences',
      sampleIn: 'INV/2026/0417 in your books · inv-2026-0417 in 2B',
      sampleOut: 'Matched as one invoice · “Only in books” lists suppliers who have not filed'
    },
    howTo: 'How to reconcile purchases with GSTR-2B',
    cta: 'Check my ITC'
  },

  '/business/id-validator/': {
    persona: 'Accounts and onboarding teams',
    hook: 'One swapped character in a GSTIN. Spot it before you invoice.',
    pain: 'A vendor master full of GSTINs, PANs and IFSCs, and nobody has checked a single one.',
    usual: ['Checking IDs one at a time', 'Typos found when a payment bounces', 'Failures with no reason given'],
    promise: 'Paste a column of IDs. See valid or not, with the reason for each.',
    steps: ['Paste a column or drop a sheet', 'Leave the type on Detect', 'Fix every failure listed'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'A column of GSTINs, PANs, IFSCs, UPI IDs or IBANs',
      output: 'Valid or not, row by row, with the reason',
      sampleIn: 'A column of 300 GSTINs, PANs and IFSC codes from the vendor master',
      sampleOut: 'Row 7: GSTIN checksum fails — two characters are usually swapped'
    },
    howTo: 'How to check GSTINs, PANs and IFSCs in bulk',
    cta: 'Validate my list'
  },

  '/business/mail-merge/': {
    persona: 'Offices that send letters in bulk',
    hook: 'One letter, 120 names, 120 PDFs ready to print.',
    pain: 'The same letter to every tenant or member, each with their own name, amount and address.',
    usual: ['Copy, paste, rename, save — repeat', 'Merge wizards that fight you', 'Uploading a contact list to a stranger'],
    promise: 'Write it once with {{Name}} fields. Get a PDF for every row.',
    steps: ['Write the letter with {{fields}}', 'Drop your spreadsheet', 'Download the ZIP or one PDF'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'A letter with {{Name}}-style fields + a spreadsheet',
      output: 'One PDF per row, zipped, plus one combined PDF',
      sampleIn: 'Dear {{Name}}, your balance of {{Amount due}} is due by {{Due date}}.',
      sampleOut: 'A ZIP of letters, one per recipient, and one PDF that prints in a single job'
    },
    howTo: 'How to mail merge letters into PDFs',
    cta: 'Merge my letters'
  },

  '/business/sheet-merge/': {
    persona: 'Sales, admin and ops teams',
    hook: 'Ten exports. One clean sheet. Every duplicate listed.',
    pain: 'Leads from three events, two forms and an old export. The same person, four rows.',
    usual: ['Copy-pasting sheets under each other', 'Remove-duplicates that hides what went', 'Columns that never line up'],
    promise: 'Drop up to ten files. Get one sheet, deduped, every removal listed.',
    steps: ['Drop up to ten files', 'Pick the key columns', 'Download the merged sheet'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Up to ten Excel or CSV files',
      output: 'One sheet, columns matched, duplicates removed and listed',
      sampleIn: '098450 12345 in one file, +91 98450 12345 in another',
      sampleOut: 'Matched as one person · the removed row listed with its file and row number'
    },
    howTo: 'How to merge spreadsheets and remove duplicates',
    cta: 'Merge my sheets'
  },

  '/business/receivables-ageing/': {
    persona: 'Owners chasing unpaid invoices',
    hook: 'Who owes you, and for how long? One report.',
    pain: 'Cash is tight, invoices are overdue, and you are writing the same chaser for the tenth time.',
    usual: ['Ageing reports built by hand', 'Chasers written from scratch each time', 'Part payments aged the wrong way'],
    promise: 'Drop unpaid invoices. Get ageing buckets and a reminder per debtor.',
    steps: ['Drop your unpaid invoice list', 'Set the as-on date and buckets', 'Send the reminder letters'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Unpaid invoices: customer, number, date, amount',
      output: 'Ageing 0–30 / 31–60 / 61–90 / 90+, letter per debtor',
      sampleIn: 'Invoice list exported from your accounts, part payments in a column',
      sampleOut: 'Ageing by customer · a firm letter for 6 weeks late · a note for a fortnight late'
    },
    howTo: 'How to build a debtors ageing report',
    cta: 'Age my debtors'
  },

  '/business/ctc-structure/': {
    persona: 'HR teams and job seekers in India',
    hook: 'Want ₹80,000 in hand? Find the CTC to ask for.',
    pain: 'A candidate asks for in-hand, finance thinks in CTC, and the structure has to add up both ways.',
    usual: ['Structures copied from last year', 'Trial and error to hit a take-home', 'Forgetting state professional tax'],
    promise: 'Enter CTC or a target in-hand. Get the full structure, both regimes.',
    steps: ['Enter CTC or target in-hand', 'Set basic % and state', 'Compare both regimes'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Annual CTC, or the monthly take-home you want',
      output: 'Basic, HRA, PF, gratuity, PT, tax and in-hand',
      sampleIn: 'Target take-home ₹80,000 a month · Basic 40% · Maharashtra',
      sampleOut: 'The CTC that produces it, to the rupee, with every component under both regimes'
    },
    howTo: 'How to find the CTC for the take-home you want',
    cta: 'Build the structure'
  },

  '/business/full-final-settlement/': {
    persona: 'HR and payroll teams in India',
    hook: 'Their last day is Friday. Is the settlement ready?',
    pain: 'An employee is leaving. Gratuity, leave, notice and recoveries must add up, and be signable.',
    usual: ['A spreadsheet rebuilt for every leaver', 'Gratuity rounding rules missed', 'Disputes over which divisor was used'],
    promise: 'Enter dates and pay. Get a settlement statement as PDF and sheet.',
    steps: ['Enter joining and last day', 'Add pay, leave, recoveries', 'Download the signable PDF'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Dates, Basic+DA, leave, notice, advances, recoveries',
      output: 'A signable settlement statement PDF + the working',
      sampleIn: 'Joined 1 April 2019, last day 31 March 2024 — exactly five years',
      sampleOut: 'Gratuity at 15/26 × Basic+DA × 5, leave encashment, notice, net payable'
    },
    howTo: 'How to calculate a full and final settlement',
    cta: 'Settle it properly'
  },

  '/business/payroll-run/': {
    persona: 'Payroll for small firms in India',
    hook: 'Salary sheet in. Payslips, bank file and PF summary out.',
    pain: 'Payday is close. Thirty payslips, a bank upload and the PF and ESI totals are still to do.',
    usual: ['Payslips made one at a time', 'Bank transfer files typed by hand', 'Statutory totals redone in another sheet'],
    promise: 'Drop the salary sheet. Get every payslip, the bank CSV and a register.',
    steps: ['Drop your salary sheet', 'Check the column matches', 'Download the payroll pack'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'A salary sheet, one row per employee',
      output: 'Payslip PDFs, bank CSV, register with PF, ESI, PT, TDS',
      sampleIn: 'Name, Basic, HRA, Paid Days, Arrears, Canteen recovery…',
      sampleOut: 'A ZIP of payslips · bulk-transfer CSV · register — or a stop if net pay is negative'
    },
    howTo: 'How to run monthly payroll from a spreadsheet',
    cta: 'Run my payroll'
  },

  '/business/bookkeeping/': {
    persona: 'Sole traders and their bookkeepers',
    hook: 'Bank statement in. Trial balance and P&L out.',
    pain: 'A pile of statements and journals, and someone wants a P&L and balance sheet by Monday.',
    usual: ['Spreadsheets that never quite balance', 'Paid software you open twice a year', 'Re-keying the bank statement'],
    promise: 'Import bank lines or journals. Get the TB, P&L and balance sheet.',
    steps: ['Start a book, pick the chart', 'Import bank lines or journals', 'Read TB, P&L, balance sheet'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Bank lines, sales or purchase invoices, or journals',
      output: 'Trial balance, P&L, balance sheet, VAT or GST figures',
      sampleIn: 'A bank statement with a ledger name against each row',
      sampleOut: 'Double-entry ledger · unmatched rows to Suspense and listed, never guessed'
    },
    howTo: 'How to get a trial balance from a bank statement',
    cta: 'Start my books'
  },

  '/business/mtd-checker/': {
    persona: 'UK sole traders and landlords',
    hook: '£24k from your trade, £9k in rent. Are you in MTD?',
    pain: 'Making Tax Digital goes by gross income across everything you do, not by profit.',
    usual: ['Checking profit, not gross income', 'Forgetting that rent counts too', 'Guidance written for accountants'],
    promise: 'Enter your income streams. See if MTD applies, from when, and dates.',
    steps: ['Enter each trade and property', 'Add gross income for each', 'Read your start date'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Gross income from each trade and property business',
      output: 'Whether MTD applies, from which April, first deadline',
      sampleIn: 'Plumbing turnover £24,000 + one let flat £9,000',
      sampleOut: 'Qualifying income £33,000 — caught from April 2027'
    },
    howTo: 'How to check if Making Tax Digital applies to you',
    cta: 'Check MTD for me'
  },

  '/business/mtd-quarterly-update/': {
    persona: 'UK sole traders and landlords',
    hook: 'Your own spreadsheet, turned into MTD quarterly figures.',
    pain: 'You keep income and costs your own way. HMRC wants them under its headings, quarter by quarter.',
    usual: ['Re-categorising every row by hand', 'Mixing up quarter and year-to-date', 'Rows that silently drop out'],
    promise: 'Drop your sheet. Get each quarter on HMRC headings, with year to date.',
    steps: ['Drop income and expenses', 'Check the category mapping', 'Copy the quarterly figures'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Your income and expense spreadsheet, your categories',
      output: 'Quarterly figures on standard headings, plus year to date',
      sampleIn: 'Category “Motor expenses - fuel” · amounts from April to June',
      sampleOut: 'Mapped to car, van and travel · Q1 standalone and cumulative side by side'
    },
    howTo: 'How to prepare MTD quarterly update figures',
    cta: 'Build my quarter'
  },

  '/business/vat-return/': {
    persona: 'UK VAT-registered businesses',
    hook: 'Nine VAT boxes, with every figure traced to its rows.',
    pain: 'Quarter end. Your sales and purchases live in a spreadsheet, and the return wants nine boxes.',
    usual: ['Pivot tables rebuilt each quarter', 'Net plus VAT that does not equal gross', 'Duplicate invoices counted twice'],
    promise: 'Drop the sheet. Get the nine boxes, each opened up to its rows.',
    steps: ['Drop sales and purchases', 'Choose the VAT scheme', 'Check the rows behind each box'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'A spreadsheet of sales and purchases for the period',
      output: 'Boxes 1–9, each with the rows behind it, plus checks',
      sampleIn: 'Quarter to 30 June · accrual basis · net, VAT and gross columns',
      sampleOut: 'Box 1 … Box 9 · rows where net + VAT ≠ gross listed by invoice number'
    },
    howTo: 'How to work out the nine VAT return boxes',
    cta: 'Build my VAT return'
  }
};
