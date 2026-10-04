'use strict';
/* Story data for the AI for Business section (/ai/). Contract: kit2-schema.md §1–2.
   These are cloud tools: an account, 10 runs a month free, and the text (or photo)
   goes to an AI model — the page says so before anything is sent. Nothing here may
   claim on-device, offline, no-upload or no-account. Examples are schematic: the
   tools cost money per call, so nothing is run and sample text is an illustration. */

const TEXT = ['Free account: 10 runs a month', 'Your text goes to an AI model', 'The page says what is sent'];
const PHOTO = ['Free account: 10 runs a month', 'Your photo goes to an AI model', 'The page says what is sent'];
const CTA = 'Try 10 free runs';

module.exports = {
  '/ai/invoice-extractor/': {
    persona: 'Bookkeepers and small-business owners',
    hook: 'Forty line items on one invoice. Type them all again?',
    pain: 'The supplier invoice is a PDF. Your purchase register needs every line, tax and date typed in.',
    usual: ['Retyping every line item by hand', 'Copy-paste that scrambles the columns', 'Templates that break on a new layout'],
    promise: 'Paste the text or drop the PDF. Get every line back as a table.',
    steps: ['Paste text or choose the PDF', 'Press Extract', 'Download the .xlsx'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Invoice text, pasted or read from a typed PDF',
      output: 'Vendor, GSTIN, dates, taxes and every line as a table',
      sampleIn: 'Tax invoice INV-0417 · 12 × steel brackets @ 85 · CGST 9% · SGST 9%',
      sampleOut: 'INV-0417 | Steel brackets | qty 12 | rate 85 | CGST 9% | SGST 9%'
    },
    howTo: 'How to turn an invoice PDF into a spreadsheet',
    cta: CTA
  },

  '/ai/bank-statement-categoriser/': {
    persona: 'Accountants and business owners',
    hook: '300 bank lines to code before the books close.',
    pain: 'Every month the statement lands and someone codes each line to a ledger before anything can close.',
    usual: ['Coding transactions line by line', 'Bank rules that miss half the lines', 'Renaming ledgers so the import works'],
    promise: 'Paste the statement. Get every line coded to your own ledger heads.',
    steps: ['Paste or upload the statement', 'Add your own ledger heads', 'Download sheet or Tally file'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Bank statement lines, plus your own ledger heads',
      output: 'Each line coded to a ledger, as a sheet or Tally vouchers',
      sampleIn: 'NEFT-ACME TRADERS-INV 2231 · 48,000 Cr',
      sampleOut: 'Receipt · Ledger: Acme Traders (customer) · 48,000'
    },
    howTo: 'How to categorise bank transactions to ledgers',
    cta: CTA
  },

  '/ai/data-cleaner/': {
    persona: 'Sales and operations teams',
    hook: 'Same customer. Three spellings. Two phone formats.',
    pain: 'Your customer list has typos, dead emails, bad GSTINs and the same shop entered three times.',
    usual: ['Find-and-replace for a whole afternoon', 'Dedupe that deletes the wrong row', 'Phone numbers in five formats'],
    promise: 'Upload the list. Get it normalised, with duplicates flagged and why.',
    steps: ['Paste or upload the list', 'Pick phone country and casing', 'Download the cleaned list'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A messy customer, supplier or product list',
      output: 'A normalised list, issues named, duplicates flagged',
      sampleIn: 'sharma traders · 098450 12345 · sharma@@gmail.com · row 3 = row 1',
      sampleOut: 'Sharma Traders · +91 98450 12345 · email invalid · row 3: duplicate_of 1'
    },
    howTo: 'How to clean and dedupe a customer list',
    cta: CTA
  },

  '/ai/business-writer/': {
    persona: 'Small-business owners',
    hook: 'Invoice 45 days overdue. The reminder you keep putting off.',
    pain: 'You need to chase a payment without losing the customer, and the blank email has been open for an hour.',
    usual: ['Staring at a blank email', 'Templates that sound like a robot', 'First drafts that come out too harsh'],
    promise: 'Give the facts and pick a tone. Get a letter that is ready to send.',
    steps: ['Pick the letter type', 'List the facts, choose a tone', 'Fill any [brackets], then send'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A few facts: who, what, amount, dates and the tone',
      output: 'A finished email or letter, any gaps in [brackets]',
      sampleIn: 'Payment reminder · INV-2231 · ₹48,000 · due 15 August · firm but polite',
      sampleOut: 'Dear Mr Rao, our invoice INV-2231 for ₹48,000 fell due on 15 August…'
    },
    howTo: 'How to write a payment reminder that gets paid',
    cta: CTA
  },

  '/ai/product-listing-writer/': {
    persona: 'Online sellers',
    hook: '200 products in a sheet. Not one description written.',
    pain: 'Your catalogue is a list of names and sizes. Every listing still needs a title, bullets and tags.',
    usual: ['Copying the manufacturer’s blurb', 'Writing listings one by one at night', 'Copy that claims features you lack'],
    promise: 'Paste the product facts. Get titles, bullets, SEO fields and tags.',
    steps: ['Paste one product or a sheet', 'Pick the channel and tone', 'Download the listings'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Product facts: name, material, size, what it is for',
      output: 'Title, description, bullets, SEO title, meta and tags',
      sampleIn: 'Cotton kurta · men · indigo · sizes S–XXL · hand block print',
      sampleOut: 'Men’s Indigo Hand Block-Print Cotton Kurta, S–XXL — bullets, tags, meta…'
    },
    howTo: 'How to write product listings from a spreadsheet',
    cta: CTA
  },

  '/ai/document-summariser/': {
    persona: 'Business owners about to sign',
    hook: '38-page contract. Signing today? Read this first.',
    pain: 'The contract is long, the deadline is close, and you need to know who owes what before you sign.',
    usual: ['Skimming and hoping for the best', 'Waiting days for a first read', 'Missing the date buried on page 31'],
    promise: 'Paste or drop the document. Get duties, dates, money and questions.',
    steps: ['Paste text or drop the PDF', 'Choose whose view to take', 'Take the questions to ask'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A contract, tender, policy or long email thread',
      output: 'Who owes what, the key dates, the money, questions to ask',
      sampleIn: 'Supply agreement, 38 pages, auto-renews yearly, 90-day notice to end it',
      sampleOut: 'Ask before signing: can the 90-day notice be shortened? Who pays freight?'
    },
    howTo: 'How to summarise a contract before you sign',
    cta: CTA
  },

  '/ai/meeting-minutes/': {
    persona: 'Managers and company secretaries',
    hook: 'The meeting ended an hour ago. Where are the minutes?',
    pain: 'You have rough notes, half-names and arrows. Everyone expects tidy minutes and owners by tonight.',
    usual: ['Minutes written from memory days later', 'Actions with no owner or date', 'Transcripts that nobody reads'],
    promise: 'Paste notes or a transcript. Get decisions, actions, owners and dates.',
    steps: ['Paste notes or a transcript', 'Pick the meeting style', 'Send minutes, export actions'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Rough notes or a meeting transcript',
      output: 'Minutes, decisions, and actions with owners and dates',
      sampleIn: 'priya to chase vendor by fri, budget ok’d 2L, launch moved to nov?',
      sampleOut: 'Action: Priya — chase vendor — Friday · Decision: ₹2 lakh budget approved'
    },
    howTo: 'How to turn meeting notes into minutes and actions',
    cta: CTA
  },

  '/ai/social-post-writer/': {
    persona: 'Shop owners and marketers',
    hook: 'One offer. Five platforms. Five different lengths.',
    pain: 'You have one announcement. LinkedIn, Instagram, X and WhatsApp each want it written their own way.',
    usual: ['Posting the same text everywhere', 'Guessing at hashtags', 'A whole evening lost to captions'],
    promise: 'Type one message. Get a post for each platform, sized and tagged.',
    steps: ['Say what to announce', 'Pick platforms and voice', 'Copy each post'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'One offer, announcement or tip',
      output: 'Posts for LinkedIn, Instagram, Facebook, X and WhatsApp',
      sampleIn: 'Diwali offer: 15% off all gift hampers until 30 October, local delivery included',
      sampleOut: 'LinkedIn: a short paragraph · Instagram: caption + tag block · WhatsApp: no tags'
    },
    howTo: 'How to write one post for every platform',
    cta: CTA
  },

  '/ai/hsn-gst-finder/': {
    persona: 'Traders and accountants in India',
    hook: 'Is it 5% or 18%? That depends on the HSN code.',
    pain: 'A new product goes on today’s invoice and you are not sure which HSN code, or which rate, applies.',
    usual: ['Scrolling the tariff for an hour', 'Copying the code from an old invoice', 'Asking around and getting three answers'],
    promise: 'Describe it in plain words. Get likely codes, rates and the reasoning.',
    steps: ['Describe the product or service', 'Press Find codes', 'Confirm low-confidence codes'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A plain-words description of a product or service',
      output: 'Likely HSN or SAC codes, the GST rate and the reasoning',
      sampleIn: 'Roasted peanuts, unbranded, sold loose by weight',
      sampleOut: 'Candidate codes with rates, and what would move it: branded or pre-packed'
    },
    howTo: 'How to find the HSN code and GST rate for a product',
    cta: CTA
  },

  '/ai/form16-reader/': {
    persona: 'Salaried taxpayers in India',
    hook: 'Form 16 in hand. Do its numbers match your return?',
    pain: 'Filing season. Form 16 is pages of tables, and the TDS has to match Part B and your 26AS.',
    usual: ['Copying figures across by hand', 'Missing a deduction in Part B', 'Finding a TDS gap after you file'],
    promise: 'Drop the Form 16. Get salary, deductions and TDS as fields to check.',
    steps: ['Drop Part A, Part B or both', 'Press Read Form 16', 'Work through the checks list'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Form 16 PDF: Part A, Part B or both',
      output: 'Salary, exemptions, VI-A deductions, quarterly TDS, checks',
      sampleIn: 'Form 16 for FY 2025-26, both parts, PANs masked before sending',
      sampleOut: 'Check: Part A TDS total against Part B tax payable — the gap to chase'
    },
    howTo: 'How to read your Form 16 before filing',
    cta: CTA
  },

  '/ai/seo-writer/': {
    persona: 'Website owners and marketers',
    hook: 'Your title gets cut off at 60 characters. Fix it.',
    pain: 'You wrote the page. Now it needs a title, meta and headings that fit the search result and the searcher.',
    usual: ['Titles cut off in search results', 'Meta written last, in a rush', 'Outlines that miss what searchers want'],
    promise: 'Give a topic and keyword. Get title, meta, H1, outline and FAQs.',
    steps: ['Enter the topic and keyword', 'Pick page type and audience', 'Copy title, meta and outline'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Page topic, audience and target keyword',
      output: 'Title, meta, H1, H2 outline, FAQs and search intent',
      sampleIn: 'Topic: GST on rent · Keyword: gst on commercial rent · For shop owners',
      sampleOut: 'Title (counted, under 60) · Meta (under 155) · H2 outline · questions asked'
    },
    howTo: 'How to write an SEO title and meta that fit',
    cta: CTA
  },

  '/ai/blog-writer/': {
    persona: 'Small businesses that blog',
    hook: 'Blog post due Friday. A brief is all you have.',
    pain: 'You know what the post should say. Turning it into 900 good words eats the whole afternoon.',
    usual: ['A blank page and a deadline', 'Drafts padded with made-up figures', 'American spellings to fix by hand'],
    promise: 'Give the brief. Get a post with headings, gaps marked [source needed].',
    steps: ['Write the point and the reader', 'Pick length and tone', 'Fill every [source needed]'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A brief: the point, who it is for, why it matters',
      output: 'A post with headings, intro, summary; claims flagged',
      sampleIn: 'Why small shops should send invoices the same day — for owners, cash flow',
      sampleOut: 'H2: What waiting costs you · … late payers average [source needed] …'
    },
    howTo: 'How to turn a brief into a blog post',
    cta: CTA
  },

  '/ai/ad-copy-writer/': {
    persona: 'Advertisers and agencies',
    hook: '15 headlines, 30 characters each, before lunch?',
    pain: 'The campaign launches tomorrow. Google wants 15 headlines, Meta wants primary text, all under limits.',
    usual: ['Counting characters by hand', 'Headlines that only work in pairs', 'Rewriting when one line runs over'],
    promise: 'Describe the offer. Get Google and Meta ad copy, every line counted.',
    steps: ['Describe the offer and audience', 'Pick the goal and platforms', 'Paste the table into ads'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'One offer, its audience and the landing URL',
      output: '15 headlines, 4 descriptions, 3 Meta texts, 5 headlines',
      sampleIn: 'Same-day boiler repair in Reading, fixed call-out fee, 7 days a week',
      sampleOut: 'Same-Day Boiler Repair (22) · Fixed Call-Out Fee (19) · Open 7 Days (11)'
    },
    howTo: 'How to write Google and Meta ads within limits',
    cta: CTA
  },

  '/ai/email-campaign-writer/': {
    persona: 'Marketers and shop owners',
    hook: 'Launch email: five subject lines, one send.',
    pain: 'The offer is ready. The email, the subject line and the follow-ups are not.',
    usual: ['One subject line and a guess', 'Forgetting the plain-text version', 'Follow-ups written at the last minute'],
    promise: 'Give the facts. Get subjects, the email, plain text and a sequence.',
    steps: ['List the facts of the offer', 'Pick purpose and tone', 'Fill [brackets], then send'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'The facts of a launch, offer, win-back or onboarding',
      output: 'Five subjects with preview text, the email, plain text',
      sampleIn: 'Winter range launch · 20% off for subscribers · ends 30 November',
      sampleOut: 'Subject: The winter range is here — 20% off for you · Preview: until 30 Nov…'
    },
    howTo: 'How to write a launch email and follow-ups',
    cta: CTA
  },

  '/ai/brand-voice-guide/': {
    persona: 'Founders and marketing leads',
    hook: 'Three writers. Three voices. Which one is the brand?',
    pain: 'Freelancers, staff and you all write for the brand, and every piece sounds like someone else.',
    usual: ['Adjectives on a slide nobody uses', 'Rewriting every freelancer’s draft', 'Long brand books nobody reads'],
    promise: 'Paste copy you like. Get a voice guide with do and don’t rules.',
    steps: ['Paste two or three samples', 'Say what the brand is', 'Share the do/don’t table'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Two or three pieces of copy you like, plus the brand',
      output: 'Three words, a do/don’t table, words to use and avoid',
      sampleIn: 'Our homepage, one customer email, one Instagram caption · a family bakery',
      sampleOut: 'Warm · Plain · Proud — Do: name the bake. Don’t: “artisanal”.'
    },
    howTo: 'How to write a brand voice guide from your copy',
    cta: CTA
  },

  '/ai/landing-page-writer/': {
    persona: 'Founders launching a product',
    hook: 'Good product. Empty landing page. Now what?',
    pain: 'You know why people should buy. Turning that into a headline, benefits and FAQs is the hard part.',
    usual: ['Headlines full of adjectives, no facts', 'Placeholder quotes that sound invented', 'Objections nobody answered'],
    promise: 'Give product, offer and proof. Get the whole landing page in copy.',
    steps: ['Describe the product and offer', 'Add the proof points you have', 'Fill each [quote needed]'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Product, audience, offer and the proof you have',
      output: 'Hero, benefits, how it works, objections, FAQ, CTAs',
      sampleIn: 'Bookkeeping for cafés · fixed monthly fee · books closed by the 5th',
      sampleOut: 'Hero: Your café’s books, closed by the 5th · Objection: “I use a spreadsheet”…'
    },
    howTo: 'How to write landing page copy from your facts',
    cta: CTA
  },

  '/ai/scanned-invoice-extractor/': {
    persona: 'Bookkeepers with paper invoices',
    hook: 'A crumpled receipt photo, read into a clean table.',
    pain: 'The receipt is paper and the invoice is a scan, so there is no text you can copy out of either.',
    usual: ['Typing figures off a photo', 'Scans that give a blob of text', 'Faded totals misread at month end'],
    promise: 'Photograph the invoice. Get vendor, taxes and lines as a table.',
    steps: ['Photograph the invoice flat', 'Press Read', 'Check totals, download table'],
    proof: PHOTO,
    example: {
      kind: 'schematic',
      input: 'A photo or scan of an invoice or receipt',
      output: 'Vendor, dates, taxes and every line as a table',
      sampleIn: 'Phone photo of a hardware-shop bill, slightly crooked, GST printed',
      sampleOut: 'Vendor | Date | 3 lines | CGST | SGST | Total — unreadable fields named'
    },
    howTo: 'How to turn a receipt photo into a spreadsheet',
    cta: CTA
  },

  '/ai/receipt-batch-reader/': {
    persona: 'Anyone filing expense claims',
    hook: 'Expense claim due. The receipts are still in your wallet.',
    pain: 'A month of receipts, one expense form, and every date, merchant and amount to type out.',
    usual: ['Typing each receipt into a form', 'Faded till slips you cannot read', 'Categories renamed to fit the claim'],
    promise: 'Photograph four receipts at a time. Get one row each as CSV or Excel.',
    steps: ['Photograph up to four receipts', 'Add your category names', 'Download CSV or Excel'],
    proof: PHOTO,
    example: {
      kind: 'schematic',
      input: 'Up to four receipt photos per run',
      output: 'One row each: date, merchant, category, amount, tax',
      sampleIn: 'Four photos: a taxi, a lunch, a parking ticket, a train fare',
      sampleOut: '4 rows · Travel / Meals / Parking / Travel · amount, tax, currency, paid by'
    },
    howTo: 'How to turn expense receipts into a spreadsheet',
    cta: CTA
  },

  '/ai/kyc-document-reader/': {
    persona: 'Onboarding and KYC teams',
    hook: 'Typing PAN numbers and IFSCs off photos all day?',
    pain: 'Every new customer sends photos of ID and a cheque, and someone types every field into the system.',
    usual: ['Retyping names and numbers by hand', 'One blurred digit that fails later', 'No checklist of what to verify'],
    promise: 'Photograph the document. Get typed fields and a checklist to verify.',
    steps: ['Photograph the document flat', 'Press Read document', 'Verify using the checklist'],
    proof: PHOTO,
    example: {
      kind: 'schematic',
      input: 'A photo of a PAN, Aadhaar front, passport or cheque',
      output: 'Document type, name, number, dates, and what to verify',
      sampleIn: 'Photo of a cancelled cheque, all four corners in frame',
      sampleOut: 'Holder · Bank · Account no. · IFSC · MICR — verify IFSC on the bank’s site'
    },
    howTo: 'How to read ID documents into typed fields',
    cta: CTA
  },

  '/ai/quotation-writer/': {
    persona: 'Suppliers and service businesses',
    hook: 'Client wants a quote today. Facts in, quotation out.',
    pain: 'You know the items and prices. Laying them out with tax, validity and terms takes longer than the deal.',
    usual: ['Last quote edited, old client name left', 'Totals and tax worked out separately', 'Terms forgotten until a dispute'],
    promise: 'List the deal facts. Get a quotation with line items, tax and terms.',
    steps: ['List items, prices and terms', 'Pick quotation or proposal', 'Check totals, add letterhead'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Who it is for, what you supply, prices and terms',
      output: 'Numbered line items, totals with tax, validity, terms',
      sampleIn: 'Office fit-out · 12 desks @ 8,500 · 12 chairs @ 4,200 · GST 18% extra',
      sampleOut: '1 | Desks | 12 | 8,500 | 1,02,000 · 2 | Chairs | 12 | 4,200 | 50,400 · GST…'
    },
    howTo: 'How to write a quotation with tax and terms',
    cta: CTA
  },

  '/ai/whatsapp-template-writer/': {
    persona: 'Businesses on WhatsApp Business',
    hook: 'Template rejected again? Get the format right first.',
    pain: 'Your order-update template came back rejected, and the reason given does not tell you what to fix.',
    usual: ['Guessing the category, then rejection', 'Placeholders in the wrong format', 'Offers slipped into utility messages'],
    promise: 'Say what the message is for. Get 3–5 templates in Meta’s format.',
    steps: ['Describe what it must do', 'Pick category and language', 'Submit through your provider'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'What the message is for and what changes per customer',
      output: '3–5 templates with {{1}} fields, samples, buttons',
      sampleIn: 'Order shipped notice · changes: customer name, order number, tracking link',
      sampleOut: 'Hi {{1}}, your order {{2}} has shipped. Track it here: {{3}} · UTILITY'
    },
    howTo: 'How to write WhatsApp Business templates',
    cta: CTA
  },

  '/ai/review-responder/': {
    persona: 'Restaurants, shops and clinics',
    hook: 'Twelve unanswered reviews. Two of them angry.',
    pain: 'Reviews keep arriving. Replying well to each one, without sounding defensive, takes hours.',
    usual: ['Copy-paste replies that read as fake', 'Angry replies sent too fast', 'Complaints never passed to the team'],
    promise: 'Paste your reviews. Get a reply for each, plus what to fix inside.',
    steps: ['Paste reviews or a CSV', 'Add your name and a contact', 'Read, edit, then post'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Reviews, one per line or as a CSV export',
      output: 'Sentiment, the issue, a reply, and what to fix',
      sampleIn: '★★ “Parcel came four days late and nobody answered the phone.”',
      sampleOut: 'Reply: sorry, with a way to reach you · Fix: check the courier and phone cover'
    },
    howTo: 'How to reply to customer reviews well',
    cta: CTA
  },

  '/ai/contract-generator/': {
    persona: 'Founders and small-business owners',
    hook: 'NDA needed before tomorrow’s meeting?',
    pain: 'A partner wants an NDA signed before you talk. You have no template and no lawyer on call tonight.',
    usual: ['Templates from random websites', 'Clauses written for another country', 'A lawyer starting from a blank page'],
    promise: 'Name the parties and terms. Get a full first draft for your lawyer.',
    steps: ['Pick the document type', 'Enter parties and terms', 'Decide every [bracket]'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Parties, terms and the law (India or England and Wales)',
      output: 'A first draft with numbered clauses and [brackets]',
      sampleIn: 'Mutual NDA · two Pune firms · 2 years · Indian law · arbitration',
      sampleOut: '1. Definitions · 2. Confidential Information · … [term of survival to decide]'
    },
    howTo: 'How to draft an NDA for your lawyer to review',
    cta: CTA
  },

  '/ai/job-description-writer/': {
    persona: 'Hiring managers and HR teams',
    hook: 'Must-have or nice-to-have? Your job ad cannot tell.',
    pain: 'You know the role. Writing an ad that draws the right people, and does not put them off, is harder.',
    usual: ['Copying another company’s ad', 'Ten must-haves for a junior role', '“Competitive salary” and nothing else'],
    promise: 'Give the role facts. Get a job ad, checked for off-putting words.',
    steps: ['List the role facts and pay', 'Pick market and length', 'Fix any flagged wording'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Role title, duties, must-haves, pay, place and hours',
      output: 'Duties, requirements, nice-to-haves, salary, checks',
      sampleIn: 'Accounts assistant · bookkeeping, GST returns · ₹3.6–4.2 LPA · Nashik, on site',
      sampleOut: 'Requirements vs nice-to-haves split · flagged: “young, energetic” — why, and instead'
    },
    howTo: 'How to write a job description that gets applicants',
    cta: CTA
  },

  '/ai/cv-screener/': {
    persona: 'Hiring managers',
    hook: 'Five CVs, one job description, interviews at two.',
    pain: 'The shortlist meeting is soon. You need a consistent read of each CV against the same job.',
    usual: ['Skimming CVs between meetings', 'Keyword filters that miss good people', 'Questions made up in the interview'],
    promise: 'Paste the JD and CVs. Get fit, gaps and interview questions.',
    steps: ['Paste the job description', 'Add up to five CVs', 'Read the gaps and questions'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A job description and up to five CVs',
      output: 'Per candidate: fit score, reasoning, gaps, questions',
      sampleIn: 'JD: payroll executive · CVs: five candidates, emails and phones masked',
      sampleOut: 'Candidate C · 72 · meets PF/ESI, gap: no TDS work · ask: last Form 24Q filed?'
    },
    howTo: 'How to screen CVs against a job description',
    cta: CTA
  },

  '/ai/excel-formula-helper/': {
    persona: 'Anyone who lives in spreadsheets',
    hook: 'You know what the cell should do. Just not the formula.',
    pain: 'You need a total by month and region. The function help page reads like a riddle.',
    usual: ['Forum threads from years ago', 'Nested IFs that break on row 200', 'Formulas that work in one app only'],
    promise: 'Describe it in words with your headers. Get the formula, explained.',
    steps: ['Say what the cell should do', 'Paste headers and a sample row', 'Copy the formula, test it'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'What the cell should do, plus your header row',
      output: 'Excel and Sheets formulas, each part explained',
      sampleIn: 'Total of Amount for the month in G1 and the region in G2 · A: Date, B: Region',
      sampleOut: '=SUMIFS(C:C, B:B, G2, A:A, ">="&G1, A:A, "<"&EDATE(G1,1)) — and why'
    },
    howTo: 'How to get an Excel formula from plain words',
    cta: CTA
  },

  '/ai/business-translator/': {
    persona: 'Businesses with customers in India',
    hook: 'Price list in English. Your customers read Marathi.',
    pain: 'A notice or price list has to reach customers in their own language, with codes and amounts unchanged.',
    usual: ['Word-by-word web translations', 'Names and GST terms mangled', 'Waiting a week for a translator'],
    promise: 'Paste the document, pick a language. Key terms stay in English.',
    steps: ['Paste text or drop the PDF', 'Pick language and formality', 'Check numbers with the original'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A letter, notice, price list or policy',
      output: 'The text in one of 13 languages, plus a glossary',
      sampleIn: 'Notice: GST invoices will be sent by email from 1 November',
      sampleOut: 'The notice in Marathi, “GST” kept in English and glossed at the end'
    },
    howTo: 'How to translate a business notice properly',
    cta: CTA
  },

  '/ai/question-paper-writer/': {
    persona: 'Teachers and exam coordinators',
    hook: 'Unit test on Monday. Paper and marking scheme?',
    pain: 'Setting a fair paper with the right marks per section takes an evening, and then the marking scheme.',
    usual: ['Last year’s paper, lightly changed', 'Blueprints that do not add up', 'Marking schemes written after the test'],
    promise: 'Give topics and a blueprint. Get the paper and its marking scheme.',
    steps: ['Enter topics and exclusions', 'Set board, marks, blueprint', 'Check it against your syllabus'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Topics, what to leave out, board, marks and blueprint',
      output: 'A sectioned paper plus a marking scheme',
      sampleIn: 'Class 8 science · Force and Pressure, Friction · 40 marks · 90 minutes',
      sampleOut: 'Section A (10 × 1) · B (5 × 2) · … marking scheme: where each mark is earned'
    },
    howTo: 'How to set a question paper with a marking scheme',
    cta: CTA
  },

  '/ai/lesson-plan-writer/': {
    persona: 'Teachers and cover supervisors',
    hook: 'Off sick tomorrow. Cover needs a lesson plan.',
    pain: 'A cover teacher needs a plan they can actually follow, with a worksheet and the answers.',
    usual: ['Plans that only make sense to you', 'Worksheets with no answer key', 'Timings that never add up'],
    promise: 'Describe the lesson and class. Get a timed plan, worksheet and key.',
    steps: ['Describe the lesson and class', 'Set minutes and support', 'Print the worksheet and key'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'The lesson, the class, the minutes and the resources',
      output: 'Objectives, a timed sequence, misconceptions, worksheet',
      sampleIn: 'Year 7 · solving one-step equations · 50 minutes · a third lost the sign',
      sampleOut: 'Starter 8 min · Teach 12 · Practice 20 · Plenary 10 · worksheet + answer key'
    },
    howTo: 'How to write a lesson plan a cover teacher can use',
    cta: CTA
  },

  '/ai/student-comment-writer/': {
    persona: 'Class teachers',
    hook: 'Thirty-two report comments, all due on Friday.',
    pain: 'Report season. Every pupil needs a comment that sounds like you wrote it about them.',
    usual: ['Comment banks that all sound alike', 'Late nights copying and editing', 'Names and pronouns mixed up'],
    promise: 'Paste the class list with notes. Get a comment for every pupil.',
    steps: ['Paste the class with notes', 'Pick tone and length', 'Read and edit each comment'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Class list with marks, attendance and a few words each',
      output: 'One comment per pupil, with a next step',
      sampleIn: 'Aarav · 68% · 94% attendance · rushes written answers, strong practicals',
      sampleOut: 'Aarav shines in practical work… Next step: plan written answers before starting.'
    },
    howTo: 'How to write report card comments for a class',
    cta: CTA
  },

  '/ai/rubric-writer/': {
    persona: 'Teachers and heads of department',
    hook: 'What separates a 7 from a 5? Write it down.',
    pain: 'Three teachers mark one essay and give three marks, because the rubric says “good” and “very good”.',
    usual: ['Bands that only add the word “some”', 'Criteria marks that do not add up', 'Moderation arguments after marking'],
    promise: 'Describe the task. Get criteria, bands, descriptors and marks.',
    steps: ['Paste the task as set', 'Set the bands and total', 'Agree the borderline calls'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'The task exactly as the pupils saw it',
      output: 'Criteria against bands, descriptors and marks',
      sampleIn: 'Essay: causes of the 1857 uprising · 20 marks · four bands',
      sampleOut: 'Use of evidence · Band 4: weighs two sources… Band 3: cites one, unweighed…'
    },
    howTo: 'How to write a marking rubric that differentiates',
    cta: CTA
  },

  '/ai/parent-message-writer/': {
    persona: 'School offices and teachers',
    hook: 'Fee reminder to parents. Firm, never threatening.',
    pain: 'A message home about fees or behaviour has to be clear, kind and impossible to misread.',
    usual: ['Messages written at 9pm, tired', 'An SMS that splits into three', 'Translations nobody checked'],
    promise: 'List the facts. Get the message for letter, email, SMS or WhatsApp.',
    steps: ['List facts, and what not to say', 'Pick channel, tone, language', 'Read it, then send'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'The facts, the purpose, the channel and the language',
      output: 'A message in the channel’s shape, optionally translated',
      sampleIn: 'Term 2 fees due 15 November · SMS · warm but formal · Hindi too',
      sampleOut: 'SMS (counted, under 160): Dear parent, Term 2 fees are due on 15 Nov… + Hindi'
    },
    howTo: 'How to write a fee reminder to parents',
    cta: CTA
  },

  '/ai/ncert-solution-writer/': {
    persona: 'Students and parents',
    hook: 'Stuck on question 7 at ten at night?',
    pain: 'Homework is due tomorrow, the method makes no sense, and the answer at the back skips every step.',
    usual: ['Answers with no method shown', 'Copying a solution you do not follow', 'Waiting until class to ask'],
    promise: 'Paste the question. Get the method step by step, plus one to practise.',
    steps: ['Paste the question exactly', 'Name the book and chapter', 'Try the practice question'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A textbook question, or a whole exercise',
      output: 'Worked method, the idea behind it, a practice question',
      sampleIn: 'Find two numbers whose sum is 27 and product is 182.',
      sampleOut: 'Let one be x… x² − 27x + 182 = 0 · Common mistake: … · Try: sum 20, product 96'
    },
    howTo: 'How to understand a textbook question step by step',
    cta: CTA
  },

  '/ai/video-script-writer/': {
    persona: 'YouTubers and vloggers',
    hook: 'Camera ready. The script is still in your head.',
    pain: 'You know the topic. Turning it into words you can say to camera, at the right length, is the slog.',
    usual: ['Rambling takes you cut later', 'Outlines that run ten minutes over', 'No shot list on filming day'],
    promise: 'Give the topic and length. Get a timed script and a B-roll list.',
    steps: ['Say what the video covers', 'Pick length, format, tone', 'Add your own examples'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A topic, audience, length and format',
      output: 'Hook, timed beats, full script, CTA, B-roll list',
      sampleIn: 'How I file GST returns for my shop in one evening · 8 minutes · tutorial',
      sampleOut: '0:00 Hook (35 words) · 0:15 Why it matters · … total 8:00 · B-roll at 2:10…'
    },
    howTo: 'How to write a YouTube script that fits the time',
    cta: CTA
  },

  '/ai/youtube-metadata-writer/': {
    persona: 'YouTube creators',
    hook: 'Great video. Title cut off on every phone.',
    pain: 'The video is edited. Title, description, chapters and tags still need doing before it goes up.',
    usual: ['Titles that run past 60 characters', 'Nothing useful above the fold', 'Chapters typed out by hand'],
    promise: 'Describe the video. Get titles, description, chapters and tags.',
    steps: ['Describe the video', 'Paste your outline with times', 'Pick a title, copy the rest'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'What the video is, plus your outline with timings',
      output: 'Five titles, description, chapters, tags, hashtags',
      sampleIn: 'Budget home office setup · outline: 0:00 intro, 1:20 desk, 4:05 lighting',
      sampleOut: 'Title (54 chars) · first two lines · 0:00 Intro / 1:20 Desk / 4:05 Lighting'
    },
    howTo: 'How to write YouTube titles, chapters and tags',
    cta: CTA
  },

  '/ai/video-hook-writer/': {
    persona: 'Short-form video creators',
    hook: 'Viewers decide in seconds. Here are ten ways to open.',
    pain: 'Your idea is good, but the first line decides whether anyone stays, and you have one version of it.',
    usual: ['Ten rewordings of one hook', 'Opening with “Hi guys, welcome back”', 'Filming one take and hoping'],
    promise: 'Describe the idea. Get ten openings, each on a different angle.',
    steps: ['Describe the video idea', 'Pick the platform and tone', 'Film the best two'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'One video idea, the platform and the tone',
      output: 'Ten openings: question, claim, story, number and more',
      sampleIn: 'I tracked every rupee my café spent for 30 days',
      sampleOut: 'Number: “₹[x] went on one thing I never noticed.” · Why it might fail: …'
    },
    howTo: 'How to write ten different video hooks',
    cta: CTA
  },

  '/ai/podcast-show-notes/': {
    persona: 'Podcasters',
    hook: 'Chapters, quotes and links, straight from the transcript.',
    pain: 'The episode is ready. Show notes, chapters and quotes mean scrubbing through the audio all over again.',
    usual: ['Scrubbing audio for timestamps', 'Quotes tidied into words never said', 'Links promised but never added'],
    promise: 'Paste the transcript. Get summary, chapters, quotes and a blurb.',
    steps: ['Paste or upload the transcript', 'Add show and guest names', 'Fill each [link needed]'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A transcript, ideally the .srt or .vtt with timings',
      output: 'Summary, chapters, timed quotes, links, a blurb',
      sampleIn: '00:12:41 GUEST: The first year, we priced everything wrong.',
      sampleOut: 'Chapter 12:41 Pricing the first year · Quote (12:41): “we priced everything wrong”'
    },
    howTo: 'How to write podcast show notes from a transcript',
    cta: CTA
  },

  '/ai/article-writer/': {
    persona: 'Writers and content teams',
    hook: 'A 1,800-word article from your brief, gaps marked.',
    pain: 'The brief is solid. The long draft is the part that keeps sliding down the list.',
    usual: ['Drafts with invented statistics', 'Endings that repeat the introduction', 'Starting from nothing every time'],
    promise: 'Paste the brief. Get a full article, unsupported claims marked.',
    steps: ['Paste the brief and the facts', 'Pick length and structure', 'Fill every [source needed]'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'A brief: the point, the reader, the facts you have',
      output: 'Standfirst, sections, an ending; claims marked',
      sampleIn: 'Why late invoices hurt small suppliers more · explainer · 1,800 words',
      sampleOut: 'Standfirst… · The 60-day gap · … one in three [source needed] …'
    },
    howTo: 'How to turn a brief into a long-form article',
    cta: CTA
  },

  '/ai/story-editor/': {
    persona: 'Writers and novelists',
    hook: 'Want an edit, not a rewrite of your voice?',
    pain: 'You want honest notes on your draft, but most tools hand back someone else’s prose instead.',
    usual: ['Rewrites that flatten your voice', 'Readers who only say they liked it', 'Notes with no order of priority'],
    promise: 'Paste your draft. Get an editor’s notes and the three fixes first.',
    steps: ['Paste your draft', 'Pick the stage and focus', 'Fix the top three first'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Your own draft, its kind and its stage',
      output: 'What works, what does not, line notes, top three fixes',
      sampleIn: 'Short story, first draft, 3,000 words · the ending is meant to be flat',
      sampleOut: 'Leave alone: the repeated “still”. Fix first: the middle scene drags…'
    },
    howTo: 'How to get editor’s notes on your own draft',
    cta: CTA
  },

  '/ai/newsletter-writer/': {
    persona: 'Newsletter writers',
    hook: 'Notes in a doc. The issue goes out tomorrow.',
    pain: 'You have this week’s notes. Shaping them into an issue people open takes hours you do not have.',
    usual: ['Opening with “hope you’re well”', 'Subject lines cut off on phones', 'Issues that bury the one link'],
    promise: 'Paste your notes. Get a finished issue and five subject lines.',
    steps: ['Paste this week’s notes', 'Pick voice and length', 'Fill [brackets], then send'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Rough notes: what happened, what broke, what to say',
      output: 'Five subjects with previews, the issue, one link',
      sampleIn: 'shipped the new menu, supplier let us down tues, tasting night 14th',
      sampleOut: 'Subject: The supplier let us down. The menu did not. (45) · Preview (82)…'
    },
    howTo: 'How to write a newsletter issue from rough notes',
    cta: CTA
  },

  '/ai/content-repurposer/': {
    persona: 'Creators and marketing teams',
    hook: 'One video. Six formats. Nothing made up.',
    pain: 'You made one good piece. A thread, Shorts, captions and a newsletter would take another full day.',
    usual: ['Posting the same file everywhere', 'Shorts that try to be the whole video', 'Captions adding facts you never said'],
    promise: 'Paste what you made. Get an outline, thread, scripts and captions.',
    steps: ['Paste the piece or transcript', 'Pick its kind and audience', 'Read what does not travel'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'One piece you made: a transcript, post or talk',
      output: 'Blog outline, thread, 3 short scripts, blurb, captions',
      sampleIn: '12-minute video transcript with timestamps: pricing a small bakery',
      sampleOut: 'Short 1 starts 03:12 · Short 2 at 07:40 · thread in 6 posts · 5 captions'
    },
    howTo: 'How to turn one video into six formats',
    cta: CTA
  },

  '/ai/contract-reviewer/': {
    persona: 'Solicitors and in-house lawyers',
    hook: 'A missing clause leaves no trace. Find it first.',
    pain: 'A 40-page agreement lands at five. You need the caps, indemnities and gaps before the call.',
    usual: ['A first read that eats the evening', 'Absent clauses nobody spots', 'Notes with no clause numbers'],
    promise: 'Paste the contract. Get a structured first read, clause by clause.',
    steps: ['Paste text or drop the file', 'Pick the type and your side', 'Check each note at its clause'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Contract text, its type and the side you act for',
      output: 'Key terms, unusual clauses, absent clauses, questions',
      sampleIn: 'Services agreement, 40 pages, English law, acting for the customer',
      sampleOut: 'Cl. 14.2 liability cap excludes data loss · Absent: change of control · Ask: …'
    },
    howTo: 'How to get a structured first read of a contract',
    cta: CTA
  },

  '/ai/legal-letter-writer/': {
    persona: 'Fee-earners and paralegals',
    hook: 'Letter before action, from your facts to a draft.',
    pain: 'You know the facts and the ask. The letter still has to be structured properly before anyone signs.',
    usual: ['Precedents with the last client in them', 'Time limits guessed, not checked', 'Drafts started from a blank page'],
    promise: 'Give the facts. Get a structured draft, gaps left as [placeholders].',
    steps: ['Pick the letter type', 'List facts, dates and sums', 'Fee-earner checks and signs'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'The facts, the letter type, jurisdiction and tone',
      output: 'A structured draft letter with [placeholders]',
      sampleIn: 'Unpaid invoice £8,400 · due 30 June · two chasers ignored · England and Wales',
      sampleOut: 'DRAFT — not advice · Letter before action… [protocol period to confirm]'
    },
    howTo: 'How to draft a letter before action from facts',
    cta: CTA
  },

  '/ai/case-summariser/': {
    persona: 'Litigators and paralegals',
    hook: 'Bundle in. A dated chronology and issues list out.',
    pain: 'The bundle runs to hundreds of pages. You need a chronology, the issues and the gaps before conference.',
    usual: ['Chronologies built in a late-night table', 'Conflicting figures spotted too late', 'Missing documents nobody noticed'],
    promise: 'Paste the papers. Get a chronology, issues, figures and gaps.',
    steps: ['Paste the passages needed', 'Pick matter type and depth', 'Check inferred dates first'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Passages from the bundle, matter type and parties',
      output: 'Chronology with sources, issues, figures, gaps',
      sampleIn: 'Employment dispute · letters, emails and minutes, March to September',
      sampleOut: '14 Mar — warning letter (C2, p.4) · Gap: grievance outcome referred to, not provided'
    },
    howTo: 'How to build a case chronology from a bundle',
    cta: CTA
  },

  '/ai/property-listing-writer/': {
    persona: 'Estate and letting agents',
    hook: 'A listing draft, plus every claim you must evidence.',
    pain: 'A new instruction needs a listing today, and one line you cannot prove can land you in trouble.',
    usual: ['“Sought after” and other empty lines', 'Claims nobody kept evidence for', 'Facts buyers ask that you left out'],
    promise: 'Give the property facts. Get a draft listing and an evidence list.',
    steps: ['Enter the property facts', 'Pick market, type and tone', 'Evidence every claim listed'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'The facts about the property, the market and purpose',
      output: 'Headline, description, features, claims to evidence',
      sampleIn: '3-bed semi · new boiler 2024 · vendor says 10 min walk to station',
      sampleOut: 'Features… · Evidence needed: boiler certificate · Attributed: “vendor advises…”'
    },
    howTo: 'How to write a property listing you can evidence',
    cta: CTA
  },

  '/ai/tenancy-agreement-drafter/': {
    persona: 'Landlords and letting agents',
    hook: 'New tenant, no agreement yet. Start the draft.',
    pain: 'A tenant is ready to move in. The agreement must reflect your terms and still go to a solicitor.',
    usual: ['Templates from the wrong jurisdiction', 'Clauses that do not fit your terms', 'Deposit and notice left out'],
    promise: 'Enter the terms. Get a first draft for England and Wales or India.',
    steps: ['Pick the agreement type', 'Enter the parties and terms', 'Have a solicitor settle it'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'Parties and terms: rent, deposit, term, notice',
      output: 'A draft tenancy or leave and licence, with [placeholders]',
      sampleIn: 'Leave and licence · Pune flat · 11 months · rent ₹28,000 · deposit ₹1 lakh',
      sampleOut: 'DRAFT banner · 1. Licence period… · [registration and stamp duty to arrange]'
    },
    howTo: 'How to draft a tenancy agreement for review',
    cta: CTA
  },

  '/ai/property-document-reader/': {
    persona: 'Conveyancers and estate agents',
    hook: 'Sale deed photo in. Names, dates and terms typed out.',
    pain: 'Clients send photos of deeds and certificates, and every name, date and number has to be retyped.',
    usual: ['Retyping fields off a phone photo', 'A date missed under a stamp', 'No list of what to verify'],
    promise: 'Photograph the document. Get typed fields and a checklist to verify.',
    steps: ['Photograph the page flat', 'Pick document type and market', 'Verify against the original'],
    proof: PHOTO,
    example: {
      kind: 'schematic',
      input: 'A photo, scan or PDF of a property document',
      output: 'Names, dates, numbers and terms, plus checks to make',
      sampleIn: 'Photo of page 1 of a registered sale deed',
      sampleOut: 'Seller · Buyer · Registration no. · Date · Area — verify at the sub-registrar'
    },
    howTo: 'How to read a property document into fields',
    cta: CTA
  },

  '/ai/clinic-letter-writer/': {
    persona: 'Practice managers and clinicians',
    hook: 'Did-not-attend letters, drafted from your own words.',
    pain: 'Recall, DNA and referral letters pile up, and each one must say exactly what was dictated.',
    usual: ['Letters retyped from dictation', 'Templates that drift from what was said', 'An admin backlog after every clinic'],
    promise: 'Dictate the facts. Get an admin letter with nothing clinical added.',
    steps: ['Pick the letter type', 'Type facts, quote clinical words', 'Clinician checks and signs'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'What the letter must say, with clinical words in quotes',
      output: 'An administrative letter, a [placeholder] for gaps',
      sampleIn: 'DNA follow-up · patient J.S. · missed 14 October · please rebook within 4 weeks',
      sampleOut: 'Dear J.S., we were sorry to miss you on 14 October… [practice phone number]'
    },
    howTo: 'How to draft clinic admin letters from dictation',
    cta: CTA
  },

  '/ai/patient-info-writer/': {
    persona: 'GPs, nurses and clinicians',
    hook: 'Your words, at a reading age patients can manage.',
    pain: 'You explained it well in clinic. The leaflet must say the same thing, plainly, for reading at home.',
    usual: ['Leaflets written in jargon', 'Rewrites that add advice never given', 'No time to simplify between patients'],
    promise: 'Type your explanation. Get a plain draft, each line matched to yours.',
    steps: ['Type what you told the patient', 'Pick audience and level', 'Check it against your words'],
    proof: TEXT,
    example: {
      kind: 'schematic',
      input: 'What you told the patient, in your own words',
      output: 'A plain-language draft, each sentence traced to yours',
      sampleIn: 'Mild hypertension, recheck in 6 weeks, cut salt, home BP readings twice daily',
      sampleOut: 'Your blood pressure is a little high. We will check it again in 6 weeks…'
    },
    howTo: 'How to turn your explanation into a patient leaflet',
    cta: CTA
  }
};
