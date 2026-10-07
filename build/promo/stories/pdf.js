'use strict';
/* Kit v2 story data: PDF Tools. Contract: kit2-schema.md, sections 1 and 2.
   Every claim is checked against the tool's own page; examples are specs the
   capture engine runs against the live tool, never figures typed in by hand. */
module.exports = {
  '/pdf/merge-pdf/': {
    persona: 'Anyone sending a pile of paperwork',
    hook: 'The portal takes one file. You have six.',
    pain: 'The visa portal wants a single PDF. You have a passport scan, two payslips and a bank statement.',
    usual: ['Sites that make you upload every page', 'A page limit on the free version', 'Printing it all just to scan it back'],
    promise: 'Drop the files in, set the order, get one clean PDF.',
    steps: ['Add your PDFs', 'Arrow them into order', 'Merge and download'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'report' },
    howTo: 'How to merge PDF files without uploading them',
    cta: 'Merge your PDFs'
  },
  '/pdf/split-pdf/': {
    persona: 'Office staff with scanned batches',
    hook: 'One 40-page scan. Forty separate letters inside.',
    pain: 'The scanner swallowed the whole pile as one file. Each page belongs in a different client folder.',
    usual: ['Uploading a client file to split it', 'Daily limits on how many files you split', 'Print, separate, rescan, repeat'],
    promise: 'Split by page, by count or by your own ranges. Get one ZIP.',
    steps: ['Open the PDF', 'Choose how to split', 'Download the ZIP'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'report' },
    howTo: 'How to split a PDF into separate files',
    cta: 'Split a PDF'
  },
  '/pdf/extract-pdf-pages/': {
    persona: 'People who need three pages, not ninety',
    hook: 'They asked for pages 3 to 5. Not the 90-page contract.',
    pain: 'You only need to send the signed schedule. The rest of the agreement is none of their business.',
    usual: ['Screenshotting pages and pasting them', 'Uploading the whole contract to cut it', 'A sign-up wall before the download'],
    promise: 'Type the pages you want. Get a new PDF with only those.',
    steps: ['Open the PDF', 'Type pages like 3-5, 9', 'Download the new file'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'report' },
    howTo: 'How to extract pages from a PDF',
    cta: 'Extract pages'
  },
  '/pdf/delete-pdf-pages/': {
    persona: 'Anyone tidying scanned documents',
    hook: 'Page 2 is blank. Page 9 is the fax cover sheet.',
    pain: 'The scan picked up blank backs and a cover sheet. You cannot send it to the client like that.',
    usual: ['Editors that hide delete behind a paywall', 'Uploading the file to remove one page', 'Rescanning the whole stack'],
    promise: 'List the pages to drop. Get a clean copy; the original stays.',
    steps: ['Open the PDF', 'Type the pages to remove', 'Download the clean copy'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'report' },
    howTo: 'How to delete pages from a PDF',
    cta: 'Delete pages'
  },
  '/pdf/rotate-pdf/': {
    persona: 'Anyone who scans on a phone or copier',
    hook: 'Every other page is sideways. Your reader tilts their head.',
    pain: 'You rotated it in the viewer, saved, and sent it. It still arrived sideways.',
    usual: ['Viewers that only turn your own view', 'Upload sites that queue your file', 'Turning the laptop round in meetings'],
    promise: 'Pick the pages and the angle. The turn is saved into the file.',
    steps: ['Open the PDF', 'Pick pages and 90, 180 or 270°', 'Download the fixed file'],
    proof: ['Free', 'Nothing uploaded', 'No quality loss'],
    example: { kind: 'pdf-edit', sample: 'letter' },
    howTo: 'How to rotate PDF pages permanently',
    cta: 'Rotate pages'
  },
  '/pdf/pdf-metadata/': {
    persona: 'Anyone sending documents outside',
    hook: 'Your PDF still says who wrote it, and with what.',
    pain: 'The tender PDF carries your name, your company and your software in its properties. The client can read them.',
    usual: ['Never opening the file properties', 'Uploading the file to clean it', 'Re-exporting and hoping it is gone'],
    promise: 'See the hidden fields, then edit them or strip them all.',
    steps: ['Open the PDF', 'Choose strip or edit', 'Download the clean copy'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'letter' },
    howTo: 'How to remove hidden metadata from a PDF',
    cta: 'Clean a PDF'
  },
  '/pdf/pdf-inspector/': {
    persona: 'Print shops and document checkers',
    hook: 'Why did page 14 print on the wrong paper size?',
    pain: 'One page in the file is US Letter among the A4 pages. The printer finds it before you do.',
    usual: ['Five menus deep to find a page size', 'Uploading the file to an online checker', 'Finding out at the printer'],
    promise: 'Drop in a PDF. See pages, sizes, fonts, images and metadata.',
    steps: ['Open the PDF', 'Read the page and font report', 'Check metadata before sending'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'pdf-edit', sample: 'report' },
    howTo: 'How to check a PDF’s page sizes and fonts',
    cta: 'Inspect a PDF'
  },
  '/pdf/watermark-pdf/': {
    persona: 'Freelancers sending drafts',
    hook: 'The draft got forwarded as if it were final.',
    pain: 'You sent a draft proposal for comments. Two days later it is in a board pack as the agreed version.',
    usual: ['Free tools that add their own watermark too', 'Uploading confidential drafts to stamp them', 'Typing DRAFT into every page header'],
    promise: 'Type DRAFT or CONFIDENTIAL. Every page gets it, at your angle.',
    steps: ['Open the PDF', 'Type the watermark text', 'Set opacity and download'],
    proof: ['Free', 'Nothing uploaded', 'Only your mark on it'],
    example: { kind: 'pdf-edit', sample: 'report', options: { text: 'CONFIDENTIAL' } },
    howTo: 'How to add a watermark to a PDF',
    cta: 'Stamp your PDF'
  },
  '/pdf/pdf-page-numbers/': {
    persona: 'Students and report writers',
    hook: '60 pages. No page numbers. The meeting is at nine.',
    pain: '“See page 34” means nothing when the pages are not numbered, and the source file is long gone.',
    usual: ['Rebuilding it in a word processor', 'Paid editors for a single footer', 'Writing numbers on the printout by hand'],
    promise: 'Choose the format and position. Every page is numbered.',
    steps: ['Open the PDF', 'Pick format and position', 'Download the numbered PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'report', options: { format: 'page-n-of-t' } },
    howTo: 'How to add page numbers to a PDF',
    cta: 'Number your pages'
  },
  '/pdf/text-to-pdf/': {
    persona: 'Anyone with notes to send as a file',
    hook: 'They asked for a PDF. You have a block of plain text.',
    pain: 'The claim form wants a PDF upload. Your statement lives in a notes app with no export button.',
    usual: ['Opening a word processor for one page', 'Converter sites that want your email', 'Printing to PDF with the margins wrong'],
    promise: 'Paste the text. Get a paginated PDF with margins and page numbers.',
    steps: ['Paste your text', 'Pick font and page size', 'Download the PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: {
      kind: 'pdf-make',
      fields: {
        title: 'Statement: damaged delivery',
        text: 'On 14 September I collected the parcel from the depot at 10:40. The box was dented on two corners and the tape had been split and resealed.\n\nI pointed out the damage to the driver before signing, and he noted it on his handset.\n\nThe lamp inside was broken at the base. I attach photographs of the box, the label and the contents.'
      }
    },
    howTo: 'How to turn plain text into a PDF',
    cta: 'Make a PDF'
  },
  '/pdf/invoice-pdf/': {
    persona: 'Freelancers and sole traders',
    hook: 'The work is done. The invoice is still a blank page.',
    pain: 'The client says “send an invoice and we’ll pay this week”. You have no template and no accounts software.',
    usual: ['Templates that need a word processor', 'Invoice apps that want a monthly plan', 'Sign-up walls before the download'],
    promise: 'Type the line items. VAT or GST is worked out, your logo goes on top, and the next number is ready.',
    steps: ['Fill in you and your client', 'Add one line per item', 'Download the invoice PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: {
      kind: 'pdf-make',
      fields: {
        fromName: 'Studio North Photography',
        fromAddress: '12 Mill Lane, Leeds LS1 4AB',
        toName: 'Harbour Café Ltd',
        toAddress: '3 Quay Street\nWhitby YO21 1PU',
        number: 'INV-2026-0042',
        items: 'Menu photography, half day, 1, 450\nEdited images for web and print, 24, 12\nTravel, 1, 38',
        notes: 'Payment by bank transfer within 30 days.\nThank you, it was a pleasure to shoot for you.'
      }
    },
    howTo: 'How to make an invoice PDF for free',
    cta: 'Make an invoice'
  },
  '/pdf/paper-pdf/': {
    persona: 'Teachers, students and sketchers',
    hook: 'Out of graph paper the night before the maths test?',
    pain: 'The homework needs 5 mm squares and the shop is shut. Random printables come out the wrong size.',
    usual: ['Printable sites full of pop-ups', 'Grids that print at the wrong scale', 'Buying a whole pad for three sheets'],
    promise: 'Pick grid, lined, dot, isometric or music. Print it at true size.',
    steps: ['Choose the paper type', 'Set spacing and page size', 'Print at 100% scale'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'pdf-make', fields: { type: 'grid', spacing: 5 } },
    howTo: 'How to print graph paper at home',
    cta: 'Print your paper'
  },
  '/pdf/label-pdf/': {
    persona: 'Small sellers and office admins',
    hook: 'Writing addresses on 40 parcels by hand? Print them.',
    pain: 'The orders are in a list and the label sheets are blank. Mail merge has beaten you before.',
    usual: ['Mail merge that eats an afternoon', 'Templates that drift off the labels', 'Handwriting every parcel at midnight'],
    promise: 'Paste the addresses, pick the sheet layout, print the labels.',
    steps: ['Paste the addresses', 'Pick the label layout', 'Print a test sheet first'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: {
      kind: 'pdf-make',
      fields: {
        layout: '3x7',
        repeat: 'once',
        items: 'Mrs J. Patel\n14 Orchard Road\nReading RG1 2AB\n\nTom Walsh\nFlat 3, 22 High Street\nBath BA1 5LP\n\nGreen Leaf Café\n8 Market Square\nYork YO1 8RS\n\nDr A. Nowak\n5 Castle View\nCardiff CF10 1AA'
      }
    },
    howTo: 'How to print address labels from a list',
    cta: 'Print labels'
  },
  '/pdf/certificate-pdf/': {
    persona: 'Teachers, trainers and club organisers',
    hook: '32 names. 32 certificates. Before the ceremony.',
    pain: 'The course ends tomorrow. Every certificate needs a name, and you are not typing them one by one.',
    usual: ['Design apps that charge to export in bulk', 'Editing one template thirty times', 'Free versions with a logo in the corner'],
    promise: 'Paste the name list. Get one certificate per name in a single PDF.',
    steps: ['Paste one name per line', 'Set the title and wording', 'Download and print'],
    proof: ['Free', 'No sign-up', 'No watermark'],
    example: {
      kind: 'pdf-make',
      fields: {
        heading: 'Certificate of Achievement',
        names: 'Aisha Rahman\nDaniel Okoye\nMegan Price',
        body: 'has successfully completed\nFirst Aid at Work (3 days)',
        signatory: 'S. Collins\nLead Trainer',
        org: 'Riverside Training Centre'
      }
    },
    howTo: 'How to make certificates from a list of names',
    cta: 'Make certificates'
  },
  '/pdf/scan-to-pdf/': {
    persona: 'Anyone who needs a scan and has only a phone',
    hook: 'They want it scanned by five. The scanner is in the office.',
    pain: 'A photo of the signed form shows the kitchen table, a slant and a grey shadow. They asked for a PDF, page by page.',
    usual: ['Sending a crooked photo and hoping', 'An app that wants an account first', 'Uploading a signed form to a stranger\'s server'],
    promise: 'Photograph each page. The edges are found, the page straightened and whitened, and one PDF made.',
    steps: ['Take or choose a photo per page', 'Check the corners on each card', 'Make the PDF'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'schematic', input: 'Three phone photos of A4 pages: on wood with a shadow, on a grey table, on carpet', output: 'One PDF of three upright A4 pages', sampleIn: 'A slanted page on a wooden table, grey in the shadow', sampleOut: 'A straight A4 page, paper white, ink black' },
    howTo: 'How to scan pages to PDF with your phone camera',
    cta: 'Scan to PDF'
  },
  '/pdf/pdf-to-images/': {
    persona: 'Anyone posting a PDF as a picture',
    hook: 'Instagram will not take a PDF. Your poster is a PDF.',
    pain: 'The flyer came back from the designer as a PDF. The post, the slide and the chat all want a PNG.',
    usual: ['Screenshots that come out blurry', 'Converters that email you a link later', 'Uploading the whole file for one page'],
    promise: 'Pick the pages and the DPI. Get sharp PNG or JPEG images.',
    steps: ['Open the PDF', 'Choose pages, format and DPI', 'Download the images'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'report' },
    howTo: 'How to convert PDF pages to images',
    cta: 'Convert to images'
  },
  '/pdf/pdf-to-text/': {
    persona: 'Anyone quoting from a PDF report',
    hook: 'You copied one paragraph. You got both columns, mixed.',
    pain: 'The report is set in two columns. Copy and paste brings the lines across in the wrong order, broken at every line end.',
    usual: ['Retyping the paragraph by hand', 'Fixing line breaks one by one', 'Uploading the report to a converter'],
    promise: 'Get the text in reading order: columns, headings and paragraphs kept apart.',
    steps: ['Open the PDF', 'Choose reading order and pages', 'Copy the text or save the .txt'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'schematic', input: 'A two-column PDF newsletter with a title, headings and page numbers', output: 'A plain .txt in reading order', sampleIn: 'Two columns under one title, a page number at the foot', sampleOut: 'The title, then the left column, then the right; the page numbers left out if you choose' },
    howTo: 'How to get the text out of a PDF in reading order',
    cta: 'Get the text'
  },
  '/pdf/pdf-to-word/': {
    persona: 'Anyone who has to edit a PDF',
    hook: 'They sent the policy as a PDF. You need to change two clauses.',
    pain: 'The only copy of the handbook is a PDF. Retyping forty pages to fix a few lines is out of the question.',
    usual: ['Retyping the document from scratch', 'Uploading it to a converter site', 'Editing a screenshot of the page'],
    promise: 'Turn the text into a Word file with real headings and lists, ready to edit.',
    steps: ['Open the PDF', 'Choose the pages', 'Download the .docx'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'schematic', input: 'A PDF with a title, section headings and a bulleted list', output: 'An editable .docx with Heading 1–3 styles and bulleted items', sampleIn: 'A two-page newsletter in two columns', sampleOut: 'Six headings in Word heading styles, three bulleted items, one page break' },
    howTo: 'How to convert a PDF to an editable Word document',
    cta: 'Convert to Word'
  },
  '/pdf/pdf-organise/': {
    persona: 'Anyone assembling a document pack',
    hook: 'The appendix ended up first. Page 6 is upside down.',
    pain: 'You merged everything and the order is wrong. You need to see the pages to fix it, not guess numbers.',
    usual: ['Guessing page numbers in a text box', 'Editors that need an account to save', 'Uploading the pack to rearrange it'],
    promise: 'See every page as a thumbnail. Drag, turn or remove, then save.',
    steps: ['Open the PDF', 'Drag, rotate or remove pages', 'Save the new PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'report' },
    howTo: 'How to reorder PDF pages by dragging',
    cta: 'Organise pages'
  },
  '/pdf/pdf-editor/': {
    persona: 'Anyone filling in a form that is a PDF',
    hook: 'The form is a flat PDF. The boxes will not take typing.',
    pain: 'You need to fill in a form that has no fields. Print, write, scan is the only way you know.',
    usual: ['Print, handwrite, scan, repeat', 'Editors that stamp their name on the page', 'Signing up just to type one line'],
    promise: 'Click where the text goes. Type it. Download the filled-in PDF.',
    steps: ['Open the PDF', 'Click to place your text', 'Add text and download'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'letter', options: { text: 'Approved for payment. J. Patel, Finance' } },
    howTo: 'How to add text to a PDF without printing it',
    cta: 'Add text to a PDF'
  },
  '/pdf/pdf-signature/': {
    persona: 'Freelancers, tenants and small firms',
    hook: 'Print, sign, scan, send. All that for one signature?',
    pain: 'The supplier form only needs your signature on the last page. Your printer is out of ink.',
    usual: ['A printer that is always out of ink', 'Signing apps that want an account first', 'Phone scans that come out at a slant'],
    promise: 'Draw or type your signature, place it, download the signed PDF.',
    steps: ['Open the PDF', 'Draw or type your signature', 'Place it and download'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-edit', sample: 'letter' },
    howTo: 'How to sign a PDF without printing it',
    cta: 'Sign your PDF'
  },
  '/pdf/payslip-pdf/': {
    persona: 'Small employers in India',
    hook: 'Your employee needs payslips for a loan by Friday.',
    pain: 'The bank wants three months of payslips. You pay salaries by transfer and have never printed one.',
    usual: ['Payroll software for a team of four', 'Word templates with sums done by hand', 'Templates that cannot write lakh and crore'],
    promise: 'Type earnings and deductions. Get a payslip with net pay in words.',
    steps: ['Fill in company and employee', 'List earnings and deductions', 'Download the payslip PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-make' },
    howTo: 'How to make a payslip PDF for an employee',
    cta: 'Make a payslip'
  },
  '/pdf/quotation-pdf/': {
    persona: 'Contractors and suppliers who quote',
    hook: 'The client wants a quote tonight, with the GST split.',
    pain: 'They want a proper quotation: HSN codes, GST, terms and a place to sign. You have a WhatsApp message.',
    usual: ['Spreadsheets where one formula breaks', 'Billing apps you pay for every month', 'Working out CGST and SGST by hand'],
    promise: 'Add the line items. GST or VAT, totals and terms are laid out.',
    steps: ['Enter you and your client', 'Add items, rate and discount', 'Download the quotation PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-make' },
    howTo: 'How to make a quotation PDF with GST',
    cta: 'Make a quotation'
  },
  '/pdf/purchase-order-pdf/': {
    persona: 'Buyers, site managers and owners',
    hook: 'You ordered by phone. They delivered something else.',
    pain: 'Nothing is in writing about the price, the delivery date or what happens if the goods are wrong.',
    usual: ['Orders agreed on a phone call', 'Purchasing software built for big firms', 'Templates with no Incoterms or inspection'],
    promise: 'Items, tax, delivery terms and an inspection clause, in one PDF.',
    steps: ['Enter supplier and delivery', 'Add items and charges', 'Download the purchase order'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-make' },
    howTo: 'How to make a purchase order PDF',
    cta: 'Make a purchase order'
  },
  '/pdf/delivery-challan-pdf/': {
    persona: 'Traders and manufacturers in India',
    hook: 'The lorry leaves at six. The challan is not printed.',
    pain: 'The goods are on the vehicle and the driver needs a challan, in three copies, before he moves.',
    usual: ['Carbon-copy books that run out', 'Billing software for a one-off movement', 'Handwritten challans nobody can read'],
    promise: 'Fill in goods and vehicle. Get Original, Duplicate and Triplicate.',
    steps: ['Enter consignor and consignee', 'Add items, vehicle and purpose', 'Print all three copies'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'pdf-make' },
    howTo: 'How to make a delivery challan PDF',
    cta: 'Make a challan'
  },
  /* Compress runs on the desk's text "report" sample (a real run: Email gave 6.3 KB → 2.2 KB,
     the text streams deflated; the pages look the same before and after). Protect and Remove a
     Password are schematic: an encrypted output cannot be rendered without its password, and the
     desk's samples have no password to remove. */
  '/pdf/compress-pdf/': {
    persona: 'Anyone emailing photo-heavy PDFs',
    hook: 'Attachment too large. Again.',
    pain: 'The inspection report has a phone photo on every page, and the mail server sends it straight back.',
    usual: ['Uploading the report to shrink it', 'Squashing it until the text blurs', 'Splitting one report into five emails'],
    promise: 'Pick a preset. Photos shrink to the size they are printed at; the text stays sharp.',
    steps: ['Open the PDF', 'Pick Email, Screen or Print', 'Download the smaller copy'],
    proof: ['Free', 'Nothing uploaded', 'Size shown before and after'],
    example: { kind: 'pdf-edit', sample: 'report' },
    howTo: 'How to make a PDF smaller for email',
    cta: 'Compress a PDF'
  },
  '/pdf/protect-pdf/': {
    persona: 'Anyone emailing personal documents',
    hook: 'Your tax return is about to go out as a plain attachment.',
    pain: 'The accountant wants last year’s return by email. Anyone who gets into that inbox can open it.',
    usual: ['Zipping it with a password nobody remembers', 'Uploading the file to encrypt it', 'Hoping the email is never forwarded'],
    promise: 'Set a password and every page is encrypted with AES-256. Choose whether it may be printed or copied.',
    steps: ['Open the PDF', 'Type the password twice', 'Download the protected copy'],
    proof: ['Free', 'Nothing uploaded', 'Password never stored'],
    example: { kind: 'schematic', input: 'A PDF and a password you choose', output: 'An AES-256 copy that asks for the password', sampleIn: 'tax-return-2025.pdf · password typed twice', sampleOut: 'tax-return-2025-protected.pdf · opens only with the password' },
    howTo: 'How to password-protect a PDF',
    cta: 'Protect a PDF'
  },
  '/pdf/unlock-pdf/': {
    persona: 'Anyone sent password-protected statements',
    hook: 'Every statement asks for your date of birth.',
    pain: 'The bank protects each statement with a password, and your bookkeeping software will not open them.',
    usual: ['Printing each one and scanning it back', 'Uploading bank statements to a site you do not know', 'Typing the password every time you look'],
    promise: 'Type the password once, here. Save a copy that opens without it.',
    steps: ['Open the protected PDF', 'Type its password', 'Download the plain copy'],
    proof: ['Free', 'Nothing uploaded', 'Password never stored'],
    example: { kind: 'schematic', input: 'A PDF you have the password for', output: 'The same document with no password', sampleIn: 'statement-sep-2026.pdf · RC4 128-bit · password needed', sampleOut: 'statement-sep-2026-unlocked.pdf · opens anywhere, no limits' },
    howTo: 'How to remove a password from a PDF you can open',
    cta: 'Remove a password'
  },
  /* Wave 2, drop 2. All five are schematic: OCR needs a scan, flatten a filled form, and crop and
     add-an-image a choice made on the page; none of the desk's samples is one. Every sample line
     is a run recorded in build/content/pdf.js. */
  '/pdf/ocr-pdf/': {
    persona: 'Anyone with a drawer of scanned paperwork',
    hook: 'You know the letter mentions the policy number. Search finds nothing.',
    pain: 'Every page the scanner made is a photograph. Search, copy and select all come up empty.',
    usual: ['Retyping the paragraph you need', 'Uploading a scanned contract to a converter', 'Paging through forty scans by eye'],
    promise: 'Each page is read in your browser and given an invisible text layer. It looks the same; now it searches and copies.',
    steps: ['Open the scanned PDF', 'Choose English, Hindi or both', 'Download the searchable PDF'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'schematic', input: 'A scanned PDF: every page a picture, no text', output: 'The same pages with an invisible, searchable text layer', sampleIn: 'A two-page scan at 200 DPI, one line in Hindi', sampleOut: '45 words read at 96% mean confidence; pdf.js copies every line' },
    howTo: 'How to make a scanned PDF searchable',
    cta: 'Make it searchable'
  },
  '/pdf/image-to-text/': {
    persona: 'Anyone copying words out of a picture',
    hook: 'The error message is in a screenshot. You need it as text.',
    pain: 'A receipt, a notice, a screenshot: the words are right there, and none of them can be copied.',
    usual: ['Typing it out letter by letter', 'Uploading the photo to an app', 'Zooming in and guessing'],
    promise: 'Add the pictures. The text is read on your device, in English or Hindi, ready to copy.',
    steps: ['Add one picture or several', 'Choose the language', 'Copy the text or save the .txt'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'schematic', input: 'Photos and screenshots with text in them', output: 'Plain text, with each picture\'s name above its words', sampleIn: 'receipt.png: three lines of a shop receipt', sampleOut: '17 words at 96% mean confidence, every character as printed' },
    howTo: 'How to copy text from a picture',
    cta: 'Get the text'
  },
  '/pdf/flatten-pdf/': {
    persona: 'Anyone sending a filled-in form',
    hook: 'You filled in the form. They opened it and the boxes were empty.',
    pain: 'Some viewers and printers leave form answers out, and anyone can change an answer after you send it.',
    usual: ['Printing the form and scanning it back', 'A screenshot of every page', 'Hoping their viewer shows the fields'],
    promise: 'The answers, ticks, notes and stamps become part of the page. Links stay links.',
    steps: ['Open the filled-in PDF', 'Choose fields, comments or both', 'Download the flattened copy'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'schematic', input: 'A filled-in PDF form with a note and a stamp', output: 'The same page with the answers drawn in, no fields left', sampleIn: 'renewal-form.pdf: 4 answers, a note, a stamp, a link', sampleOut: '4 fields and 2 comments drawn in, the link kept: 5.2 KB became 4.3 KB' },
    howTo: 'How to flatten a filled-in PDF form',
    cta: 'Flatten a PDF'
  },
  '/pdf/crop-pdf/': {
    persona: 'Anyone printing an e-ticket or a label',
    hook: 'You need the ticket. The PDF is a whole A4 page of small print.',
    pain: 'The part you want is a box in one corner, and the rest of the page prints, wastes paper and shrinks it on a phone.',
    usual: ['Screenshotting the box and losing the sharp text', 'Printing the whole page and cutting it out', 'Uploading the ticket to an editor'],
    promise: 'Set the box on the page. The PDF shows just that part, its text still sharp. The rest is hidden, not deleted.',
    steps: ['Open the PDF', 'Fit to the content or set each margin', 'Download the cropped PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'schematic', input: 'An A4 PDF with the part you need in one box', output: 'The same PDF showing only that box', sampleIn: 'e-ticket.pdf: a ticket box at the top of an A4 page', sampleOut: 'A 164 x 89.5 mm page with the ticket alone; the small print hidden, still in the file' },
    howTo: 'How to crop a PDF page',
    cta: 'Crop a PDF'
  },
  '/pdf/add-image-to-pdf/': {
    persona: 'Small firms putting a logo on paperwork',
    hook: 'The letter went out without the logo. Again.',
    pain: 'The document is a PDF now. The logo, the stamp or the photo has to go on top, on the right pages.',
    usual: ['Rebuilding the document in a word processor', 'Pasting a screenshot and losing the quality', 'Uploading the file to a site to stamp it'],
    promise: 'Place a PNG or JPEG on the page, drag and resize it, and put it on one page or many.',
    steps: ['Open the PDF and choose the picture', 'Drag and resize it on the page', 'Download the PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'schematic', input: 'A PDF and a logo with a transparent background', output: 'The same PDF with the logo on the pages you chose', sampleIn: 'A two-page quotation and acme-logo.png, 600 x 240 px, transparent', sampleOut: 'The logo on both pages, stored once in the file' },
    howTo: 'How to add a logo or picture to a PDF',
    cta: 'Add an image'
  }
};
