/**
 * The reading part of the PDF tools, rendered by build-depth.js in its file-and-text shape (howItWorks in place of formula). Written in two batches; each batch's notes follow.
 *
 * The reading part of eleven PDF tools (merge, delete, extract, inspect, add
 * text, and the six document generators), rendered by build-depth.js in its
 * file-and-text shape (howItWorks in place of formula). Shape and rules:
 * build-depth.js and build/content/_check.js.
 *
 * Every figure in a worked example comes from a run of the live tool in
 * headless Chrome against a local server of the site, recorded in `runs` as
 * { browser: { … }, shown: [ … ] }: what was given and set, and what it showed.
 *
 * Inputs not made by the site's own generators come from one file,
 * membership-form.pdf, written byte for byte by a small Node script: two A4
 * pages in Helvetica; a catalogue with /Outlines (bookmarks "Application" ->
 * page 1 and "Payment details" -> page 2) and /AcroForm (one text field,
 * "fullname", whose widget sits on page 1); on page 1 a URI link to
 * https://www.1234tools.com/; on page 2 a link whose /Dest is page 1 and the
 * text "Sort code 20-00-00, account 55779911"; every annotation carries /P;
 * Info Title "Membership application", Author "Riverside Club"; 2,480 bytes.
 *
 * ----
 *
 * The reading part of eleven PDF tools (metadata, organise, page numbers,
 * signature, PDF to images, purchase order, quotation, rotate, split, text to
 * PDF, watermark), rendered by build-depth.js in its file-and-text shape
 * (howItWorks in place of formula). Shape and rules: build-depth.js and
 * build/content/_check.js.
 *
 * Every figure in a worked example comes from a run of the live tool in
 * headless Chrome against a local server of the site, recorded in `runs` as
 * { browser: { … }, shown: [ … ] }. Two input files were made first, with the
 * site's own generators, and reused:
 *
 *   quotation-qt-0001.pdf   /pdf/quotation-pdf/, every default except Date
 *                           2026-10-04 and Valid until 2026-11-03; Create PDF.
 *                           2 pages, 11,463 bytes (11.2 KB).
 *   numbered-test-document.pdf   /pdf/text-to-pdf/, A4, Helvetica 11, spacing
 *                           1.4, margin 20, Page numbers: No, Document title
 *                           "Numbered test document", text = 200 lines built as
 *                           'Line ' + n.padStart(3, '0') + ' of the test document.'
 *                           for n = 1..200, joined with "\n". 5 pages, 47 lines
 *                           a page, 19,177 bytes (18.7 KB).
 *
 * Byte counts, /Rotate and "(DRAFT) Tj" counts were read from the downloaded
 * output; page text and positions were read back with the site's own pdf.js
 * (engine/vendor/pdfjs, getTextContent).
 *
 * ----
 *
 * 2026-10-06, wave 2: every run recorded for the pages of both batches above
 * was repeated in headless Chrome (154.0.8037.94) against the wave-2 worktree,
 * with the inputs made again: membership-form.pdf byte for byte (2,480
 * bytes), quotation-qt-0001.pdf (11,463) and numbered-test-document.pdf
 * (19,177) unchanged, membership-invoice.pdf 4,534 bytes from the rewritten
 * invoice generator (was 3,181). Figures that changed are corrected and noted
 * at their run: merge and extract (the invoice; the merged file is now named
 * after the first file), the inspector (the guide page it prints has
 * changed), add text, page numbers and watermark (the overlay font is now one
 * object per file, not one per page) and signature (the date is the day of
 * the run). Every figure quoted on delete, payslip, delivery challan, labels,
 * certificate, paper, metadata, organise (no "Show the pages" press now),
 * PDF to images, purchase order, quotation, rotate, split and text to PDF
 * came out the same.
 */
'use strict';

const FORM = 'membership-form.pdf (2 A4 pages, 2.4 KB: 2 bookmarks, a fillable text field, a web link, a link from page 2 to page 1, Title and Author set; see the top of this file)';
/* Re-made on 2026-10-06 with the rewritten invoice generator (its fields renamed, the Modern layout
   by default): 1 page, 4,534 bytes, where the generator of 2026-10-04 made 3,181. The generator names
   it RC-2026-118.pdf; it was saved as membership-invoice.pdf, the name the merge's bookmark shows. */
const CLUB_INVOICE = 'membership-invoice.pdf, made by /pdf/invoice-pdf/ with fromName "Riverside Club", fromAddress "4 Towpath Walk, Oxford OX1 1AA", fromTax and fromContact empty, toName "Sam Whitlock", toAddress "9 Canal Row\\nOxford OX2 6AB", number RC-2026-118, date 2026-10-01, due Net 14, items "Annual membership, 1, 120\\nLocker hire (12 months), 12, 4.50", GBP, taxMode none, bank empty, notes "Membership fees are not subject to VAT.", every other field at its default (1 page, 4.4 KB)';

module.exports = {
  '/pdf/merge-pdf/': {
    whatTitle: 'What merging PDFs actually does',
    whatIs: [
      'A PDF is a catalogue of numbered objects. One is the page tree, the pages in order; others belong to the whole file: the outline (bookmarks), the form dictionary that makes boxes fillable, named destinations, page labels and XMP metadata.',
      'Merging writes a new catalogue and decides which of those follow. Annotations (links, comments, form-field boxes) live on each page and travel with it; bookmarks and forms belong to a whole file, and two forms may both have a field called “name”.'
    ],
    howItWorks: {
      text: 'The site’s own PDF engine, pdfcore, reads each file and writes the result; pdf.js only draws the preview.',
      points: [
        'Each chosen page is rebuilt from its contents, resources, page boxes, rotation and `Annots`; values it inherited from the old tree are resolved first.',
        'Streams are copied byte for byte, so images and fonts are never re-encoded.',
        'Each file’s `/Outlines` goes under a bookmark named after it, minus entries whose page was left out; fields with a box on a kept page join one `/AcroForm`, a taken name getting `_2`.',
        'A link within one file is pointed at its page’s new place; a link to a page left out is removed.',
        'No Info dictionary or XMP is written unless you keep the first file’s metadata.'
      ]
    },
    worked: {
      text: 'A club’s two-page membership form (bookmarks, a fillable name field, a web link and a “back to the form” link; 2.4 KB) was merged with a one-page invoice from the site’s generator (4.4 KB), keeping the first file’s metadata. membership-form-merged.pdf had 3 pages and 6.7 KB. The PDF Inspector counted 3 annotations, and the Title “Membership application” now covered an invoice too. pdf.js found the field “fullname” still fillable and a bookmark per file, with “Application” and “Payment details” under the form’s. Swapped, the back link, now on page 3, jumped to page 2, the form’s first page.'
    },
    uses: [
      ['Board packs', 'Agenda, minutes and reports as one file.'],
      ['Tender submissions', 'Letter, priced schedule and certificates in the portal’s order.'],
      ['Expense claims', 'Separate receipt PDFs joined behind the claim form.']
    ],
    mistakes: [
      'Merging two copies of one form. The second copy’s fields are renamed with _2, so software that reads answers by field name misses them.',
      'Leaving out pages a contents page links to. Those links go with them, and the entries stop jumping anywhere.'
    ],
    faq: [
      { q: 'Does merging PDFs reduce quality?', a: 'No. Content, images and fonts are copied without being decoded again, so a scan looks exactly the same.' },
      { q: 'Can I merge password-protected PDFs?', a: 'Yes, with its password, asked for when the file is added and not kept. The result has none.' },
      { q: 'Do hyperlinks still work after merging?', a: 'Yes. Web links are copied as they are; a link within one document lands on the same page of the merged file.' }
    ],
    related: { guides: ['/guides/merge-pdf-files/'] },
    runs: [
      /* Merge PDF Files, files added in this order, "Keep metadata from the first file", ranges "all".
         The output was then opened in /pdf/pdf-inspector/ and with the site's pdf.js
         (getOutline, getFieldObjects, getAnnotations, getMetadata). Re-measured on 2026-10-04 after the
         writer stopped dropping bookmarks and forms and stopped copying pages through links.
         Re-measured on 2026-10-06 with the invoice made again by the rewritten generator (4.4 KB, was
         3.1 KB): the output is now named after the first file and is 6,840 bytes (was merged.pdf,
         5,523 bytes); the Inspector's counts and pdf.js's findings are unchanged. */
      {
        browser: {
          tool: '/pdf/merge-pdf/', files: [FORM, CLUB_INVOICE], controls: { keepMeta: 'first', ranges: 'all' }, pressed: 'Merge PDFs',
          result: 'membership-form-merged.pdf, 3 pages, 6.7 KB (6,840 bytes)',
          inspector: 'Pages 3, Objects 22, Annotations 3, Metadata: Title Membership application, Author Riverside Club',
          pdfjs: 'getOutline(): "membership-form" { "Application", "Payment details" }, "membership-invoice"; getFieldObjects(): fullname; annotations: Link (URI) and Widget "fullname" on page 1, Link to page 1 on page 2'
        },
        shown: ['2.4 KB', '4.4 KB', '3 pages', '6.7 KB', '3 annotations', 'Membership application', 'fullname', 'Application', 'Payment details']
      },
      /* the same two files in the opposite order (invoice first), metadata stripped: pdf.js
         resolves the form's internal link, now on page 3, to page 2, the form's first page
         (2026-10-06: membership-invoice-merged.pdf, 6.5 KB, 6,703 bytes; was 5.3 KB) */
      {
        browser: { tool: '/pdf/merge-pdf/', files: ['membership-invoice.pdf (as above)', 'membership-form.pdf (as above)'], controls: { keepMeta: 'strip' }, result: 'membership-invoice-merged.pdf, 3 pages, 6.5 KB', pdfjs: 'Link on page 3: destPage 2' },
        shown: ['page 3', 'page 2']
      }
    ]
  },

  /* Compress, Protect and Remove a Password (wave 2). The runs below were made on 2026-10-06 in
     headless Chrome against a local server of the wave-2 branch (build/tests/serve.js), with two
     inputs made for them:
       inventory-report.pdf  4 A4 pages written by reportlab: on each, a heading, three paragraphs of
         Helvetica and one colour photo 160 mm wide (453.5 pt). The photos are the CC0 samples in
         build/promo/samples (landscape, product, food, street) enlarged with Lanczos to 4032 px wide,
         as a 12-megapixel phone saves them, stored as plain DCTDecode JPEG at quality 92; Title
         "Check-in inventory, Lakeside Cottage". 5,483,344 bytes, shown as 5.23 MB.
       statement-rc4.pdf  2 A4 pages written by PyMuPDF (MuPDF 1.28.2), RC4 128-bit, user password
         "15031988", owner password "bank-owner-7731", permissions print, high-quality print and
         accessibility only; Title "Statement September 2026". 3,659 bytes, shown as 3.6 KB.
     Outputs were read back with pdf.js (the site's copy, in the page), MuPDF and pdfcore's parser. */
  '/pdf/compress-pdf/': {
    whatTitle: 'What makes a PDF heavy, and what compression takes out',
    whatIs: [
      'Most of the weight in a large PDF is pictures. A phone photo is about 4,000 pixels across; printed 16 cm wide it needs under 1,000 for a screen or office printer, yet the file keeps every pixel.',
      'Text and vector drawings cost little by comparison, so compressing a PDF mostly means resampling each picture to the size it is shown at.'
    ],
    howItWorks: {
      text: 'It all happens in a background worker on this page, with the site’s own PDF engine and the browser’s JPEG encoder.',
      points: [
        'Each page’s drawing instructions are followed to find how large every picture is printed; a picture used twice is sized for its largest use.',
        'A picture printed at more than the chosen DPI is scaled to fit it, laid on white and saved as JPEG at the chosen quality.',
        'Scaling is skipped when it would remove less than 13% of the width, and a picture under 24 KB that needs no scaling is left alone.',
        'On the way out, uncompressed streams are deflated, identical streams and font dictionaries are stored once, and the rest is packed into compressed object streams with a cross-reference stream.'
      ]
    },
    worked: {
      text: 'A four-page check-in inventory came to 5.23 MB: on each page a few paragraphs and one 4032-pixel phone photo printed 160 mm wide. Email needed only its first step, 150 DPI at quality 72: 251.1 KB, 95.3% smaller, each photo now 945 pixels wide, exactly 160 mm at 150 DPI. Print gave 656.5 KB and Smallest 52.8 KB. Lossless saved only 1.7 KB, since the photos were already JPEG. pdf.js read all four pages’ text from every copy.'
    },
    uses: [
      ['Mail size limits', 'Bring a photo-heavy report under what a mail server will accept.'],
      ['Upload portals', 'Fit scanned passports or payslips under a portal’s per-file cap.'],
      ['Shared folders', 'Shrink photo-filled inspection reports before they fill a team drive.']
    ],
    mistakes: [
      'Choosing Smallest for a document that will be printed. At 72 DPI a photo looks soft on paper; Print keeps 200 DPI and was still 87.7% smaller above.',
      'Expecting a black-and-white scan to shrink much. Such pages are often stored as 1-bit CCITT or JBIG2 pictures, already compact, and those are left as they are.'
    ],
    faq: [
      { q: 'Can I set my own resolution and quality?', a: 'Yes: choose My own settings, then 36 to 600 DPI and a JPEG quality from 10 to 100.' },
      { q: 'Does compressing remove a PDF’s password?', a: 'Yes. A protected file is opened with its password, asked for when you add it, and the smaller copy is saved without one; Protect PDF puts it back.' },
      { q: 'Will the page layout change?', a: 'No. Pages keep their size and every picture its place and printed size; only the pixels inside change.' }
    ],
    runs: [
      /* Compress PDF, inventory-report.pdf (top of this entry), How small "Email: aim for under 2 MB",
         Metadata "Remove it", Compress PDF pressed; the download read back with pdfcore (picture sizes)
         and pdf.js (text of all 4 pages). Stats: Before 5.23 MB, After 251.1 KB, Change "4.98 MB smaller
         (95.3%)", Settings "150 DPI pictures, JPEG quality 72", Pictures "4 found, 4 re-encoded (4 scaled
         down)", Picture data "5.22 MB → 247.3 KB". No warning: under 2 MB at the first step. */
      {
        browser: { tool: '/pdf/compress-pdf/', file: 'inventory-report.pdf, 4 pages, 5,483,344 bytes; 4 JPEG photos 4032 px wide drawn 160 mm (453.5 pt) wide', controls: { preset: 'email', metadata: 'strip' }, pressed: 'Compress PDF', result: 'inventory-report-compressed.pdf, 257,138 bytes; photos 945x628, 945x630, 945x630, 945x709 DCTDecode' },
        shown: ['5.23 MB', '4032-pixel', '160 mm', '150 DPI at quality 72', '251.1 KB', '95.3%', '945 pixels']
      },
      /* the same file and page, How small "Print" (Settings "200 DPI pictures, JPEG quality 85", Change
         "4.59 MB smaller (87.7%)", photos 1260 px wide), then "Smallest" (72 DPI, quality 45, 99%
         smaller, photos 454 px wide), then "Lossless" (Change "1.7 KB smaller (0%)", Pictures kept as
         they were "4 pictures left as they are", Streams compressed 0) */
      { browser: { tool: '/pdf/compress-pdf/', file: 'inventory-report.pdf', controls: { preset: 'print' } }, shown: ['656.5 KB', '87.7%'] },
      { browser: { tool: '/pdf/compress-pdf/', file: 'inventory-report.pdf', controls: { preset: 'smallest' } }, shown: ['52.8 KB'] },
      { browser: { tool: '/pdf/compress-pdf/', file: 'inventory-report.pdf', controls: { preset: 'lossless' } }, shown: ['1.7 KB'] }
    ]
  },

  '/pdf/protect-pdf/': {
    whatTitle: 'What a password on a PDF actually does',
    whatIs: [
      'A PDF can carry two passwords. The open (user) password is needed to read the file at all; the owner password gives full rights, including lifting any limits on printing, copying or editing.',
      'Behind both sits one file key that encrypts every stream and string. Each password is a way of recovering that key, which is why a forgotten one cannot simply be reset.'
    ],
    howItWorks: {
      text: 'The document is rebuilt by the site’s own engine in a background worker on this page, then encrypted with the PDF specification’s standard security handler.',
      points: [
        'AES-256 writes revision 6 from PDF 2.0: a random 256-bit file key, wrapped once for each password with an iterated SHA-2 hash and its own random salt.',
        'AES-128 writes revision 4, which readers from PDF 1.6 onwards understand.',
        'Every stream and string gets its own random 16-byte starting vector, so identical pages never encrypt to identical bytes.',
        'Printing covers high-quality printing too, changes cover page assembly, and comments cover form filling; copying for accessibility always stays allowed, so screen readers keep working.'
      ]
    },
    worked: {
      text: 'The 251.1 KB inventory from the Compress PDF run was protected with AES-256 and a 14-character open password, printing and comments allowed, copying and changes not. The copy was 252.9 KB, 1,871 bytes larger. pdf.js refused it with no password and with the password in lower case; with the right one it read all four pages, printing allowed and copying not. MuPDF described it as Standard V5 R6 256-bit AES. Saved again with no open password and printing off, it opened at once, but printing was gone from its permissions.'
    },
    uses: [
      ['Documents by email', 'Encrypt a tax return or contract before attaching it; send the password separately.'],
      ['Review copies', 'Let a draft be read and printed, not copied, while it circulates.'],
      ['Personal records', 'Keep passport and certificate scans encrypted on a shared computer.']
    ],
    mistakes: [
      'Sending the password in the same email as the file. Anyone who can read one can read the other; send it by text message or say it on the phone.',
      'Treating “no copying” as a barrier. Converters and some readers ignore permission bits, and screens can be photographed; anything confidential needs an open password.'
    ],
    faq: [
      { q: 'Can I protect several PDFs at once?', a: 'Not here: the page takes one file at a time. Merge them first if they can travel together, then protect the merged file.' },
      { q: 'How do I change the password later?', a: 'Open the protected file in the Remove a Password tool with the old password, then protect the plain copy again with the new one.' },
      { q: 'Does encryption make the file bigger?', a: 'Slightly: each stream gains up to 32 bytes of starting vector and padding. The run above grew by 1,871 bytes.' }
    ],
    runs: [
      /* Protect PDF with a Password on inventory-report-compressed.pdf (257,138 bytes, from the Email run
         on /pdf/compress-pdf/): Password to open it and the same again "Lakeside-Oct26", Owner password
         empty, Encryption AES-256, Allow printing on, Allow copying off, Allow changes off, Allow comments
         and form filling on; Protect PDF pressed. Stats: Pages 4, Opens with "A password", Owner password
         "Random, not shown", Printing Allowed, Copying Not allowed, Changes Not allowed, Comments and forms
         Allowed, Output size 252.9 KB. The download, 259,009 bytes, read with pdf.js in the page: no password
         -> PasswordException "No password given"; "lakeside-oct26" -> "Incorrect Password"; the password
         -> the text of all 4 pages, permissions PRINT, PRINT_HIGH_QUALITY, MODIFY_ANNOTATIONS,
         FILL_INTERACTIVE_FORMS, COPY_FOR_ACCESSIBILITY. MuPDF: needs_pass, metadata encryption
         "Standard V5 R6 256-bit AES". localStorage afterwards held the four switches and the method, no password. */
      {
        browser: { tool: '/pdf/protect-pdf/', file: 'inventory-report-compressed.pdf, 4 pages, 257,138 bytes (251.1 KB)', controls: { userPassword: 'Lakeside-Oct26 (14 characters)', userPassword2: 'Lakeside-Oct26', ownerPassword: '', method: 'AES-256', allowPrint: true, allowCopy: false, allowModify: false, allowAnnotate: true }, pressed: 'Protect PDF', result: 'inventory-report-compressed-protected.pdf, 259,009 bytes, 1,871 more than the input' },
        shown: ['251.1 KB', '14-character', '252.9 KB', '1,871 bytes', 'Standard V5 R6 256-bit AES']
      },
      /* the same file, both passwords empty, Allow printing off, Allow copying off, changes and comments on:
         "Opens with: No password (restrictions only)", Printing Not allowed; pdf.js opened it with no
         password and listed MODIFY_CONTENTS, MODIFY_ANNOTATIONS, FILL_INTERACTIVE_FORMS,
         COPY_FOR_ACCESSIBILITY and ASSEMBLE, no PRINT */
      { browser: { tool: '/pdf/protect-pdf/', file: 'inventory-report-compressed.pdf', controls: { userPassword: '', ownerPassword: '', method: 'AES-256', allowPrint: false, allowCopy: false, allowModify: true, allowAnnotate: true } }, shown: ['opened at once'] }
    ]
  },

  '/pdf/unlock-pdf/': {
    whatTitle: 'What taking the password off a PDF involves',
    whatIs: [
      'An encrypted PDF stores its pages scrambled with a file key that only a password recovers. Taking the password off means opening the file with it once, then writing every object out again in plain form.',
      'A file that opens freely yet refuses printing or copying is encrypted too, with an empty open password; the refusal is a flag readers choose to obey.'
    ],
    howItWorks: {
      text: 'Your password goes no further than the background worker on this page, where the site’s own engine opens the file and writes the copy.',
      points: [
        'The security handler reads the method, RC4 at 40 or 128 bits, AES-128 or AES-256, and tries what you type both as the open password and as the owner password.',
        'A wrong password is turned away before anything is decrypted, and the box asks again.',
        'Every string and stream is decrypted, object streams included, and the whole document is written to a new file with no permission flags.',
        'The results name the method, the password that opened the file and each restriction lifted, by internal name such as fillForms.'
      ]
    },
    worked: {
      text: 'A two-page bank statement written by MuPDF, 3.6 KB, used RC4 128-bit with an eight-digit open password and blocked copying and changes. Added here it showed a password box, and a wrong guess got “That password did not open it”. With the right one the results read “RC4 128-bit, opened with the password to open it” and listed five restrictions lifted: modify, copy, annotate, fillForms, assemble. The 3.2 KB copy opened in pdf.js and MuPDF with no password or permission limits. The inventory protected on Protect PDF came back at 252.1 KB.'
    },
    uses: [
      ['Statements for an accountant', 'Save plain copies for bookkeeping software that cannot open protected files.'],
      ['Loan and visa applications', 'Portals often reject encrypted PDFs; a decrypted payslip goes through.'],
      ['Printing a restricted form', 'Lift a no-printing flag on a form you are entitled to print.']
    ],
    mistakes: [
      'Typing the password with Caps Lock on. Passwords are case-sensitive, so “lakeside” will not open a file protected with “Lakeside”.',
      'Leaving the decrypted copy in a shared folder. It has no protection at all; delete it when done, or protect it again.'
    ],
    faq: [
      { q: 'Does the copy keep bookmarks and form fields?', a: 'Yes. Pages, bookmarks, links, form fields and the title come across; only the encryption and permission flags go.' },
      { q: 'Can I use the owner password instead?', a: 'Yes. Either password opens the file, and the results then say it was opened with the owner password.' },
      { q: 'Why did my file open without asking for a password?', a: 'It has restrictions only: its open password is empty. It is still encrypted, and the copy saved here drops the printing and copying limits.' }
    ],
    runs: [
      /* Unlock PDF (Remove a Password) on statement-rc4.pdf (top of the Compress entry): the row showed
         "Password-protected" and the box "statement-rc4.pdf needs its password to open. It is used here,
         on this device, and not kept."; "wrong-one" typed and Open pressed -> "That password did not open
         it. Check the capitals and try again."; then "15031988" -> "2 pages · 3.6 KB · opened with its
         password"; Remove the password pressed. Stats: Pages 2, Was "RC4 128-bit, opened with the
         password to open it", Restrictions lifted "modify, copy, annotate, fillForms, assemble", Now "No
         password, no restrictions", Output size 3.2 KB. The download (3,296 bytes) has no /Encrypt;
         pdf.js read both pages with no password, getPermissions() null, Title "Statement September
         2026"; MuPDF needs_pass false. */
      {
        browser: { tool: '/pdf/unlock-pdf/', file: 'statement-rc4.pdf, 2 pages, 3,659 bytes, RC4 128-bit, an 8-digit user password', typed: ['wrong-one', 'the user password'], pressed: 'Remove the password', result: 'statement-rc4-unlocked.pdf, 3,296 bytes' },
        shown: ['3.6 KB', 'RC4 128-bit', 'That password did not open it', 'RC4 128-bit, opened with the password to open it', 'modify, copy, annotate, fillForms, assemble', '3.2 KB']
      },
      /* the protected inventory from the /pdf/protect-pdf/ run, opened with "Lakeside-Oct26": Was "AES-256,
         opened with the password to open it", Restrictions lifted "modify, copy, assemble", Output size
         252.1 KB (258,138 bytes), no /Encrypt; pdf.js read all 4 pages with no password */
      { browser: { tool: '/pdf/unlock-pdf/', file: 'inventory-report-compressed-protected.pdf, 259,009 bytes', typed: ['Lakeside-Oct26'] }, shown: ['252.1 KB'] }
    ]
  },

  /* Flatten, Crop and Add an Image (wave 2). The runs below were made on 2026-10-06 in headless
     Chrome against a local server of the wave-2 worktree (build/tests/serve.js). Inputs:
       renewal-form.pdf  1 A4 page written by PyMuPDF (MuPDF 1.28.2): the heading "Riverside Club:
         membership renewal 2027", text fields fullname "Sam Whitlock" and email
         "sam.whitlock@example.com", a combo box membership "Family" (Adult, Family, Junior), a ticked
         check box "agree", a FreeText comment "Checked by R. Iyer, 2 Oct", an Approved stamp and a
         URI link to https://www.1234tools.com/; every field with MuPDF's own appearance; Title
         "Membership renewal 2027". 5,327 bytes, shown as 5.2 KB.
       renewal-noap.pdf  the same fullname field and value, its /AP removed and NeedAppearances set
         (as programs that leave drawing to the reader save it). 1,310 bytes.
       e-ticket.pdf  1 A4 page (595.28 x 841.89 pt) written by PyMuPDF: a ticket box from 72 to 523 pt
         across and 60 to 300 pt down, its text "E-TICKET Oxford to London Paddington", "Passenger: Sam
         Whitlock", "Booking reference: RVX4K7", a black square, and at y 800 the 8 pt line "Terms of
         carriage: valid only on the train shown. Ref RVX4K7."; Title "E-ticket RVX4K7". 2,302 bytes.
       acme-logo.png  600 x 240 px, drawn by the page's canvas: a navy disc with a yellow triangle and
         "ACME", the rest transparent. 14,474 bytes.
       product.jpg  build/promo/samples/product.jpg, CC0 (see its LICENSES.md), 1600 x 1067, no EXIF
         turn, 219,945 bytes.
     Outputs were read back with MuPDF (PyMuPDF), pdf.js (the site's copy, in the page) and pdfcore's parser. */
  '/pdf/flatten-pdf/': {
    whatTitle: 'What flattening a PDF changes',
    whatIs: [
      'A filled-in PDF form keeps its answers apart from the page. Each box is a widget annotation holding a value and an appearance stream, a stored picture of it that the reader draws over the page; comments and stamps are annotations too.',
      'Flattening copies those pictures into the page’s own drawing and deletes the annotations.'
    ],
    howItWorks: {
      text: 'It runs in a background worker on this page, in the site’s own PDF engine; nothing becomes pixels.',
      points: [
        'Each field or comment’s appearance, in the state it shows now, is placed on the page as a form XObject scaled to its rectangle.',
        'A field with a value but no stored appearance has the value typed in Helvetica inside its box.',
        'Annotations flagged hidden are dropped undrawn, and a comment’s pop-up note goes with it.',
        'Links stay links. With the fields flattened the form dictionary goes too, so readers stop treating the file as a form.'
      ]
    },
    worked: {
      text: 'A club renewal form filled in by MuPDF (5.2 KB) held four answers, among them Family chosen from a list and a ticked box, plus a typed note, an APPROVED stamp and a web link. With every default the stats read 4 form fields and 2 comments drawn into the page and 1 link kept: 4.3 KB. MuPDF then found no fields or comments, only the link, and read “Sam Whitlock” as page text; rendered at 72 DPI, the page matched the original to within 0.0004 of 255. Form fields only kept the note and stamp as comments (4.7 KB), and a name saved with no appearance came back in Helvetica.'
    },
    uses: [
      ['Applications', 'Fix the answers before a form goes to a landlord or a bank.'],
      ['Printing filled forms', 'Some viewers leave field values out; flattened answers always print.'],
      ['Approved paperwork', 'Make a reviewer’s note and stamp part of the record.']
    ],
    mistakes: [
      'Flattening before checking every answer. Afterwards a slip can only be put right in the original form, so keep it.',
      'Flattening a form that still needs a digital signature. The signature box is a field too, so it is drawn as it looks and can no longer be signed.'
    ],
    faq: [
      { q: 'Does flattening make the PDF smaller?', a: 'Usually a little, as the field objects and the form dictionary go: 5.2 KB became 4.3 KB above.' },
      { q: 'Can the flattened answers still be searched and copied?', a: 'Yes, when their appearance was drawn as text, as typed answers almost always are. MuPDF and pdf.js both read the flattened name and email as page text.' },
      { q: 'What happens to a ticked box or a chosen option?', a: 'Each is drawn as it showed, the tick as a tick and the list as the chosen word, and neither can be changed afterwards.' }
    ],
    runs: [
      /* Flatten PDF, renewal-form.pdf, every default (Flatten: Form fields and comments), Flatten PDF
         pressed. Stats: Pages 1, Form fields drawn into the page 4, Comments and stamps drawn into the
         page 2, Links kept as links 1, Output size 4.3 KB. The download, renewal-form-flattened.pdf
         (4,398 bytes): MuPDF widgets 0, annotations none, links 1, is_form_pdf false, page text holds
         "Sam Whitlock | sam.whitlock@example.com | Family | … Checked by R. Iyer, 2 Oct | APPROVED";
         rendered by MuPDF at 72 DPI against the original with annotations shown, mean difference
         0.0004 of 255, and 0 of 500,990 pixels differing by more than 48; pdf.js: no fields, one Link,
         the same words in getTextContent, Title kept. */
      {
        browser: { tool: '/pdf/flatten-pdf/', file: 'renewal-form.pdf, 1 page, 5,327 bytes: 4 filled fields, a FreeText comment, a stamp, a link', controls: { what: 'all' }, pressed: 'Flatten PDF', result: 'renewal-form-flattened.pdf, 4,398 bytes' },
        shown: ['5.2 KB', '4 form fields', '2 comments', '1 link', '4.3 KB', 'Sam Whitlock', '72 DPI', '0.0004 of 255']
      },
      /* the same file, Flatten "Form fields only": Form fields 4, Comments 0, 4.7 KB (4,773 bytes);
         MuPDF: widgets 0, annotations FreeText and Stamp kept. ("Comments, stamps and drawings only":
         5.3 KB, the 4 fields still fields.) */
      { browser: { tool: '/pdf/flatten-pdf/', file: 'renewal-form.pdf', controls: { what: 'forms' } }, shown: ['4.7 KB'] },
      /* renewal-noap.pdf, Flatten "Form fields and comments": the stat row "Answers with no stored
         appearance, drawn in Helvetica 1", 1.0 KB; MuPDF and pdf.js read "Sam Whitlock" at x 162 as
         page text, no widget left */
      { browser: { tool: '/pdf/flatten-pdf/', file: 'renewal-noap.pdf, 1,310 bytes, a text field with a value and no /AP, NeedAppearances true', controls: { what: 'all' } }, shown: ['Helvetica'] }
    ]
  },

  '/pdf/crop-pdf/': {
    whatTitle: 'What cropping a PDF page does',
    whatIs: [
      'A PDF page carries several boxes. The media box is the whole sheet; the crop box, when set, is the part a viewer shows and a printer prints, and whatever lies outside it stays in the file.',
      'Cropping here sets that crop box: nothing is cut, resampled or redrawn.'
    ],
    howItWorks: {
      text: 'pdf.js, from this site’s own copy, draws the preview; the site’s own engine writes the file in a background worker.',
      points: [
        'Margins are millimetres, at 72 ÷ 25.4 points each, taken off the page as it is shown now.',
        'On a page stored turned by its `/Rotate`, or cropped already, the new box is mapped back into the page’s own coordinates.',
        'Fit to the content finds every preview pixel darker than near-white and adds a 2 mm border; dragged and fitted margins round to half a millimetre.',
        'Margins that would leave a point or less of a page are refused, naming that page and its size.'
      ]
    },
    worked: {
      text: 'An e-ticket saved as an A4 PDF (2.2 KB) fills the top third of the page, with small print at the foot. Fit to the content set the margins to 18.5, 23, 12 and 23 mm, taking in the small print too. Typing 189 into Bottom pulled that edge up under the ticket: the readout said it keeps 164 × 89.5 mm of a 210 × 297 mm page. The cropped file was 2.2 KB, and pdf.js showed a 464.89 × 253.7 point page with the ticket alone. Yet the small print was still there: MuPDF read it again once the crop box was reset to the whole sheet.'
    },
    uses: [
      ['Tickets and labels', 'Cut a ticket or a shipping label down from the A4 page it came on.'],
      ['Scans and slides', 'Trim the white border a scanner or a slide export left.'],
      ['Reading on a phone', 'Take off wide margins so the text fills a small screen.']
    ],
    mistakes: [
      'Cropping to hide an account number or a name. Anyone who resets the crop box sees it again, as MuPDF did above.',
      'Pressing Fit to the content on a page with a footer or a stray speck. The box stretches to include it; drag or type the edge where it should stop.'
    ],
    faq: [
      { q: 'Can I make a crop larger again here?', a: 'No. Margins come off the page as shown, already cropped, so 0 keeps it as it is. Start again from the original, which this tool never changes.' },
      { q: 'Does cropping change the text or links inside the box?', a: 'No. Words stay selectable and links keep their targets; only what falls outside stops showing.' },
      { q: 'Is cropping the same as changing the paper size?', a: 'No. Cropping hides part of the page and scales nothing; print scaling is what fits other paper.' }
    ],
    runs: [
      /* Crop PDF, e-ticket.pdf (top of the Flatten entry): the preview's readout first said "Keeps 180 ×
         267 mm of a 210 × 297 mm page" (the 15 mm defaults); "Fit to the content" pressed: Top 18.5,
         Right 23, Bottom 12, Left 23, "Keeps 164 × 266.5 mm"; Bottom typed as 189: "Keeps 164 × 89.5 mm
         of a 210 × 297 mm page"; Pages all; Crop PDF pressed. Stats: Pages 1, Pages cropped 1, Margins
         removed "top 18.5, right 23, bottom 189, left 23 mm", First cropped page "164 × 89.5 mm", Output
         size 2.2 KB. The download, e-ticket-cropped.pdf (2,229 bytes): /MediaBox [0 0 595.28 841.89] kept,
         /CropBox [65.197 535.748 530.083 789.449]; pdf.js viewport 464.89 × 253.7, text the ticket's
         lines only; MuPDF page.rect 464.9 × 253.7, text the ticket's lines; after MuPDF's
         set_cropbox(mediabox) its text ends "Terms of carriage: valid only on the train shown. Ref RVX4K7." */
      {
        browser: { tool: '/pdf/crop-pdf/', file: 'e-ticket.pdf, 1 A4 page, 2,302 bytes', pressed: ['Fit to the content', 'Crop PDF'], controls: { top: 18.5, right: 23, bottom: 189, left: 23, pages: 'all' }, fitted: 'top 18.5, right 23, bottom 12, left 23', result: 'e-ticket-cropped.pdf, 2,229 bytes' },
        shown: ['2.2 KB', '18.5, 23, 12 and 23 mm', '189', '164 × 89.5 mm of a 210 × 297 mm page', '464.89 × 253.7']
      }
    ]
  },

  '/pdf/add-image-to-pdf/': {
    whatTitle: 'What adding a picture to a PDF involves',
    whatIs: [
      'A picture in a PDF is an image object: pixels, their size and colour space, and a compression filter. A page draws it by name, with a matrix setting its place and size.',
      'One stored picture can appear on any number of pages; its transparency travels as a greyscale soft mask.'
    ],
    howItWorks: {
      text: 'This browser decodes the picture on your device; the site’s own engine writes the PDF in a background worker.',
      points: [
        'A grey or colour JPEG, stored the way up it is shown and at most 6,000 pixels long, goes in as it is.',
        'Any other picture becomes pixels, at most 2,400 on the longer side, deflated without loss, with its transparency as a soft mask.',
        'A picture placed several times, or on many pages, is stored once; each placement is one line of drawing code.',
        'Opacity below 100% adds a graphics state with a fill alpha. X, Y and width are points on the page as shown.'
      ]
    },
    worked: {
      text: 'A 600 × 240-pixel PNG logo with a transparent background (14.1 KB) went on both pages of the Quotation tool’s quotation (11.2 KB) via “every page”, at X 40, Y 760, 150 points wide. A 1600 × 1067 JPEG photo of a coffee cup (214.8 KB, CC0) followed on page 1, 200 points wide. The stats read 2 pictures placed and 2 picture files embedded; the file was 236.3 KB. pdf.js painted two pictures on page 1 and one on page 2, the photo’s stream was the JPEG byte for byte, and the logo was stored once. Alone at 30% opacity it made 21.3 KB.'
    },
    uses: [
      ['Letterhead after the fact', 'Put a logo on every page of a PDF made without one.'],
      ['Seals and stamps', 'Add a scanned company seal or a PAID stamp as a transparent PNG.'],
      ['Photos in reports', 'Drop a site photo into an inspection report.']
    ],
    mistakes: [
      'Using a JPEG logo with a white box round it. JPEG has no transparency, so the box hides what is under it; use a transparent PNG.',
      'Adding a full-size phone photo to a PDF meant for email. A JPEG goes in at full size, so run Compress PDF on the result.'
    ],
    faq: [
      { q: 'Does a logo on every page make the file much bigger?', a: 'No. It is stored once and drawn from each page: above, one image and its soft mask, 9.3 KB in all, served both pages.' },
      { q: 'Can I add a picture to a password-protected PDF?', a: 'Yes, with its password, asked for when you add the file. The result is saved without one; Protect PDF can put it back.' },
      { q: 'Which picture formats can I use?', a: 'PNG, JPEG, WebP and GIF. Only a JPEG keeps its own bytes; the rest are stored as pixels, without loss.' }
    ],
    runs: [
      /* Add an Image to a PDF, quotation-qt-0001.pdf (top of this file, 11,463 bytes): Image
         acme-logo.png (the picker read "acme-logo.png · 600 × 240 px"), the "every page" button above
         the preview (Pages became "all"), X 40, Y 760, Width 150, Opacity 100; "Add as another image";
         Image product.jpg ("1600 × 1067 px"), X 330, Y 470, Width 200, Pages 1; Add the image pressed.
         Stats: Pages 2, Pages with a picture 2, Pictures placed 2, Picture files embedded "2 (each
         stored once, however often it is drawn)", Output size 236.3 KB. The download (242,022 bytes):
         pdf.js paintImageXObject 2 on page 1, 1 on page 2; pdfcore's parser: three image objects, the
         logo 600x240 FlateDecode (4,070 bytes) with its 600x240 soft mask (5,497 bytes), and a
         1600x1067 DCTDecode stream equal to product.jpg byte for byte. */
      {
        browser: { tool: '/pdf/add-image-to-pdf/', file: 'quotation-qt-0001.pdf, 2 pages, 11,463 bytes', images: ['acme-logo.png, 600 x 240, 14,474 bytes, transparent background', 'product.jpg, 1600 x 1067 JPEG, 219,945 bytes'], items: [{ image: 'acme-logo.png', pages: 'all (the "every page" button)', x: 40, y: 760, width: 150, opacity: 100 }, { image: 'product.jpg', pages: '1', x: 330, y: 470, width: 200, opacity: 100 }], pressed: ['Add as another image', 'Add the image'], result: 'quotation-qt-0001-with-image.pdf, 242,022 bytes' },
        shown: ['600 × 240', '14.1 KB', '11.2 KB', '1600 × 1067', '214.8 KB', '2 pictures placed', '2 picture files embedded', '236.3 KB', '9.3 KB']
      },
      /* the quotation again, acme-logo.png alone at X 120, Y 300, Width 360, Opacity 30, Pages last:
         Pictures placed 1, Output size 21.3 KB (21,765 bytes); the file holds "/ca 0.3"; pdf.js still
         reads page 2's text */
      { browser: { tool: '/pdf/add-image-to-pdf/', file: 'quotation-qt-0001.pdf', items: [{ image: 'acme-logo.png', pages: 'last', x: 120, y: 300, width: 360, opacity: 30 }] }, shown: ['30%', '21.3 KB'] }
    ]
  },

  '/pdf/delete-pdf-pages/': {
    whatTitle: 'What deleting a PDF page really removes',
    whatIs: [
      'Deleting pages means writing a new PDF whose page tree leaves them out; your original file is not touched.',
      'A viewer shows only the pages listed in that tree, not every object stored. A kept page’s links and form fields can point back at other pages; a writer that follows them stores a deleted page unseen.'
    ],
    howItWorks: {
      text: 'Your list is inverted into the pages to keep and passed to the page assembler that merge and extract also use, in the site’s own PDF engine.',
      points: [
        'Spaces are ignored, “10-” runs to the end, “-3” means the first three, and numbers past the last page are skipped.',
        'A list that covers every page is refused, because a PDF must keep at least one.',
        'Kept pages are rebuilt with their contents, page boxes, rotation, annotations, and only the fonts and images their own drawing names.',
        'A reference to another page is never followed: a link to a deleted page is dropped, one to a kept page repointed. Bookmarks and fields stay with their page.'
      ]
    },
    worked: {
      text: 'A two-page membership form (2.4 KB) had page 2, the payment details, deleted. The output was 1 page and 1.7 KB; the inspector showed 12 objects, the kept page’s 2 annotations and the Title “Membership application”. A search of the file’s bytes for the removed page’s account number, 55779911, found nothing, and just 1 object in it is a page. pdf.js still lists the fillable name field and the “Application” bookmark; the “Payment details” bookmark went with its page.'
    },
    uses: [
      ['Blank backs from a duplex scan', 'List the even pages of a one-sided letter scanned double-sided.'],
      ['Trimming a statement pack', 'Drop the marketing inserts and terms before sending statements to a lender.'],
      ['Fax header sheets', 'Remove the transmission page from a fax received by email.']
    ],
    mistakes: [
      'Deleting a page to hide words on another one. Only whole pages go; text on a kept page stays in the file even under a black box drawn over it.',
      'Forgetting the document’s Title. It is kept, so a trimmed copy still announces the full report’s name in a reader’s title bar; change it with the PDF Metadata tool.'
    ],
    faq: [
      { q: 'Does deleting pages make a PDF smaller?', a: 'Usually, by about the share those pages held. Fonts and images that kept pages still draw with stay; whatever only the deleted pages used goes.' },
      { q: 'How do I delete every other page?', a: 'List them, as “2, 4, 6, 8” for an eight-page scan; there is no step syntax.' },
      { q: 'Will the page numbers printed on the remaining pages change?', a: 'No. Printed numbers are part of each page’s drawing, so they keep their gaps; Add Page Numbers can stamp a fresh sequence.' }
    ],
    runs: [
      /* Delete PDF Pages on membership-form.pdf, pages "2", Delete pages; the output opened in
         /pdf/pdf-inspector/ and with pdf.js; then its bytes searched (latin1) for "55779911".
         Re-measured on 2026-10-04 after the writer stopped copying pages through links: the
         run before that found the number in the bytes, and 3 page objects for 1 listed page. */
      {
        browser: { tool: '/pdf/delete-pdf-pages/', file: FORM, controls: { pages: '2' }, pressed: 'Delete pages', result: 'membership-form-trimmed.pdf, 1 page, 1.7 KB (1,719 bytes)', inspector: 'Pages 1, Objects 12, Annotations 2, Metadata: Title Membership application, Author Riverside Club', search: 'the bytes do not contain "55779911"; 1 object of /Type /Page', pdfjs: 'getFieldObjects(): fullname; getOutline(): Application' },
        shown: ['2.4 KB', '1 page', '1.7 KB', '12 objects', '2 annotations', 'Membership application', '55779911', '1 object', 'Application']
      }
    ]
  },

  '/pdf/extract-pdf-pages/': {
    whatTitle: 'What extracting PDF pages means',
    whatIs: [
      'Extracting pages makes a new PDF from a selection of another one’s pages, in the order you choose: the opposite of deleting, and a split with a single output.',
      'A page is drawing instructions plus the fonts and images it calls on, so it looks exactly as before. Of what belongs to the whole document, the title and author come along, as do bookmarks and form fields on the chosen pages; page labels such as “iv” stay behind.'
    ],
    howItWorks: {
      text: 'The selection becomes a list of page numbers, as typed unless you choose sorted or reversed, and the site’s own PDF engine writes a file from it.',
      points: [
        'A page may be listed more than once; the copies share one content stream, so repeats cost very little.',
        'Contents, fonts and images are copied without decoding, so text stays selectable and scans keep their sharpness.',
        'Rotation, page boxes and annotations come across, except a link to a page you did not take, which is dropped; nothing of an unchosen page is copied, even out of sight.'
      ]
    },
    worked: {
      text: 'A three-page merged file, a two-page form followed by an invoice, was cut with “3, 1” left as listed: the invoice came first and the form’s opening page second, 2 pages and 6.0 KB. Sorted, the same selection came out as “1, 3”. Separately, a one-page invoice of 4.4 KB extracted as “1, 1, 1” gave three identical pages in 4.8 KB, since all three page entries share one content stream.'
    },
    uses: [
      ['A chapter for a study group', 'Pages 45-62 of a course reader, not the whole volume.'],
      ['Evidence bundles', 'The relevant pages of each statement, extracted one file at a time, then merged.'],
      ['Summary first', 'Extract “12, 1-11” so a report opens on its conclusions.']
    ],
    mistakes: [
      'Typing “10-” for page 10 alone. The trailing dash runs to the end of the document; for one page, type the number by itself.',
      'Choosing sorted order after typing a deliberate sequence. Sorted puts the pages back in document order and undoes the reordering, so leave it on As listed.'
    ],
    faq: [
      { q: 'Is the extracted page an image or real text?', a: 'Real text. Drawing instructions and fonts are copied unchanged, so the words can still be selected, searched and copied.' },
      { q: 'Can I extract pages from several PDFs at once?', a: 'Not here: this takes one file. Merge PDF takes a range per file, such as “1-2 | 4”.' },
      { q: 'Why does my page selection give an error?', a: 'Each part must be a page or a range such as 3-5, 8- or -2, and a selection that matches no page, like “12-15” in a ten-page file, is refused.' }
    ],
    runs: [
      /* Extract PDF Pages on the 3-page membership-form-merged.pdf from the merge run (form pages 1-2, invoice page 3), pages "3, 1", order As listed.
         Re-measured on 2026-10-04 with the fixed writer (before: 4.8 KB, and 3.4 KB for the invoice below).
         Re-measured on 2026-10-06 on the merge re-made with the invoice from the rewritten generator:
         6.0 KB (6,152 bytes; was 4.7 KB), and 4.8 KB (4,896 bytes) for that 4.4 KB invoice (was 3.5 KB from 3.1 KB);
         the three pages still name one content stream. */
      { browser: { tool: '/pdf/extract-pdf-pages/', file: 'membership-form-merged.pdf (3 pages, 6.7 KB, from the /pdf/merge-pdf/ run recorded on that page)', controls: { pages: '3, 1', order: 'asis' }, pressed: 'Extract pages', result: 'membership-form-merged-extract.pdf, 2 pages, 6,152 bytes' }, shown: ['2 pages', '6.0 KB'] },
      /* the same, order Sorted by page number: Page order "1, 3", 6.0 KB */
      { browser: { tool: '/pdf/extract-pdf-pages/', file: 'membership-form-merged.pdf', controls: { pages: '3, 1', order: 'sorted' } }, shown: ['1, 3'] },
      /* Extract PDF Pages on membership-invoice.pdf, pages "1, 1, 1", As listed: 3 pages, 4.8 KB */
      { browser: { tool: '/pdf/extract-pdf-pages/', file: CLUB_INVOICE, controls: { pages: '1, 1, 1', order: 'asis' } }, shown: ['4.4 KB', '4.8 KB'] }
    ]
  },

  '/pdf/pdf-inspector/': {
    whatTitle: 'What a PDF inspector reads',
    whatIs: [
      'A PDF records more about itself than a viewer shows: its format version, how many objects it is built from, each page’s size in points (1/72 inch) and rotation, the fonts and images its pages call on, their annotations, and an Info dictionary naming a title, an author, the software and the date.',
      'Inspecting reads that structure without drawing a page.'
    ],
    howItWorks: {
      text: 'It runs as soon as a file is chosen: the site’s own parser reads the cross-reference data, expands object streams and walks the page tree, without pdf.js.',
      points: [
        'Sizes come from each page’s MediaBox, or its parent’s, rounded to whole points, converted to millimetres and grouped.',
        'Fonts are the entries in a page’s own font resources that carry a `BaseFont` name, so Type 3 fonts, and fonts used only inside form XObjects, are missed. Images are counted the same way.',
        'Annotations are counted from each page’s `Annots`: links, comments and form-field widgets alike.',
        'Metadata comes from the Info dictionary only; an XMP metadata stream is not read.'
      ]
    },
    worked: {
      text: 'Chrome’s print to PDF (version 154, A4) turned the site’s merge guide into a 437.5 KB file. The inspector read 4 pages at 596 × 842 pt (210 × 297 mm), 1030 objects and 22 annotations, the guide’s links. The metadata held the page title, the full HeadlessChrome browser string as Creator, Skia/PDF m154 as Producer and the creation time to the second. Distinct fonts said “none found” on pages full of text: Chrome wrote every font as Type 3, drawn glyph by glyph with no name to list.'
    },
    uses: [
      ['Before an upload portal', 'Check size and page count before a portal rejects the file.'],
      ['Before sending to a client', 'Check the author, software and timestamps the document carries.'],
      ['After another tool', 'Confirm a merge or page edit kept the pages, sizes and metadata you expected.']
    ],
    mistakes: [
      'Reading “none found” as “no text”. It means no named fonts in the pages’ own resources; select a word in a viewer to check.',
      'Taking an empty metadata line as proof the file is clean. An XMP stream can still name the author; the PDF Metadata tool rewrites the file without either.'
    ],
    faq: [
      { q: 'Does the inspector show whether fonts are embedded?', a: 'Not directly; it lists names. A plain name such as Helvetica may not be embedded at all: the site’s own generators rely on the reader’s Helvetica, and their payslip inspects as Helvetica-Bold, Helvetica.' },
      { q: 'What PDF version is my file?', a: 'The PDF version line reads the header at the start of the file, such as 1.4 or 1.7.' },
      { q: 'Can a PDF show who created it?', a: 'Often. Author, Creator and Producer may name a person, a company, or the exact program and version.' }
    ],
    runs: [
      /* Chrome 154.0.8037.94 (headless): page.pdf({ format: 'A4', printBackground: true }) of
         /guides/merge-pdf-files/ served from this export, then that file chosen in PDF Inspector.
         All 60 font resources in the file are Subtype /Type3 with no /BaseFont.
         Re-measured on 2026-10-06 against the wave-2 worktree, the same Chrome: the guide page has
         changed since, so its print is 448,041 bytes, 437.5 KB (was 441.8 KB), with 1030 objects (was
         1041) and 40 font resources, all /Type3; 4 pages, 22 annotations, Skia/PDF m154 and "none
         found" as before. */
      {
        browser: { tool: '/pdf/pdf-inspector/', file: 'merge-guide-chrome.pdf: Chrome 154 Save as PDF of /guides/merge-pdf-files/, A4, printBackground true', creator: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.' },
        shown: ['437.5 KB', '4 pages', '596 × 842 pt (210 × 297 mm)', '1030', '22 annotations', 'Skia/PDF m154', 'none found']
      },
      /* the FAQ: PDF Inspector on the payslip from the /pdf/payslip-pdf/ run recorded on that page */
      { browser: { tool: '/pdf/pdf-inspector/', file: 'payslip-rahul-menon-september-2026.pdf (1 page, 6.0 KB)' }, shown: ['Helvetica-Bold, Helvetica'] }
    ]
  },

  '/pdf/pdf-editor/': {
    whatTitle: 'What adding text to a PDF changes',
    whatIs: [
      'A PDF page holds a content stream: instructions that place runs of glyphs at fixed coordinates, with no paragraph to click into. Adding words means appending instructions.',
      'New words can go on as an annotation that a reader can hide or delete, as a form field’s value, or into the page content itself. This tool takes the last route, so the text looks and prints the same in every viewer.'
    ],
    howItWorks: {
      text: 'Each item becomes a few lines of drawing code appended to the page by the site’s own engine; pdf.js draws only the preview.',
      points: [
        'A wrap width breaks lines using Helvetica’s real character widths, and each line steps down 1.25 times the font size.',
        'Each chosen page gets a new content stream and a font entry, `MVRedit`, for Helvetica: one of the standard 14 fonts readers supply, so nothing is embedded for it.',
        'A line WinAnsi cannot hold (Hindi, Greek, Cyrillic, ₹) is drawn instead from a subset of Noto Sans or Noto Sans Devanagari, `MVRu0`, embedded with a map back to the characters.',
        'The file is rebuilt by the assembler merge uses, which keeps the bookmarks, the form fields, the title and the author.'
      ]
    },
    worked: {
      text: 'A two-page membership form with a real fillable name field (2.4 KB) got two items: “Sam Whitlock” at X 156, Y 698 on page 1, inside the field’s box, and “Paid by card on 1 October 2026” at X 72, Y 600 on page 2. The run showed 2 pages written to, 2 items placed and 2 lines written, and the file grew to 2.9 KB. pdf.js found both phrases as selectable text, the Title and the field “fullname”, which stayed empty: the name was drawn over the box, not entered into it.'
    },
    uses: [
      ['Reference numbers', 'Stamp a purchase-order number on every page before filing.'],
      ['Marking an invoice paid', 'Add the date and method so the filed copy shows it was settled.'],
      ['Exhibit labels', 'Write “Exhibit B” at the top of each page for a court bundle.']
    ],
    mistakes: [
      'Typing over a real form field. Fill a fillable PDF in a PDF reader: text added here sits on the page, over a field that stays empty.',
      'Expecting to delete the note later. It becomes part of the page drawing, so keep the original.'
    ],
    faq: [
      { q: 'Will the text I add be searchable?', a: 'Yes: it is real text, so it can be selected, searched and copied.' },
      { q: 'Will my PDF keep its title and bookmarks?', a: 'Yes. The edited file is written fresh, but its Title, Author, bookmarks and form fields are carried into it.' },
      { q: 'Does adding text break a digital signature?', a: 'Yes. The file is rewritten from scratch, so the signed bytes no longer match and any signature in it stops validating.' }
    ],
    runs: [
      /* Add Text to a PDF on membership-form.pdf: item 1 typed (text "Sam Whitlock", size 12, X 156,
         Y 698, Pages 1, wrap 0) and banked with "Add as another item"; item 2 typed (text "Paid by
         card on 1 October 2026", size 12, X 72, Y 600, Pages 2); Add text pressed. The output was
         read with pdf.js: getTextContent, getFieldObjects (fullname, value empty), getMetadata (Title
         Membership application). Re-measured on 2026-10-04 with the fixed writer (before: 2.7 KB,
         no fields, no Title). Re-measured on 2026-10-06, after the overlay font became one object per
         file instead of one per page: membership-form-edited.pdf, 2,962 bytes, 2.9 KB (was 3,078,
         3.0 KB); the stats, the text, the field and the Title as before. */
      {
        browser: { tool: '/pdf/pdf-editor/', file: FORM, items: [{ text: 'Sam Whitlock', size: 12, x: 156, y: 698, pages: '1' }, { text: 'Paid by card on 1 October 2026', size: 12, x: 72, y: 600, pages: '2' }], pressed: ['Add as another item', 'Add text'], result: 'membership-form-edited.pdf, 2 pages, 2.9 KB (2,962 bytes)' },
        shown: ['2.4 KB', '2 pages written to', '2 items placed', '2 lines written', '2.9 KB', 'fullname']
      }
    ]
  },

  '/pdf/invoice-pdf/': {
    term: 'an invoice',
    whatIs: [
      'An invoice is a seller’s request for payment: who is billing whom, for what, how much and by when. Between VAT-registered businesses it is what the buyer needs to reclaim the VAT.',
      'Other legal details depend on the country, so identifiers are yours to type in; under GST the heading becomes TAX INVOICE.'
    ],
    howItWorks: {
      text: 'The Quotation tool’s line reader parses the items; the site’s own PDF writer draws the pages.',
      points: [
        'Item lines are read from the right: price last, quantity before it, description the rest; a comma between digits, as in 1,25,000, groups thousands.',
        'Tax is worked out once per rate on that rate’s whole taxable value, not line by line, and rounded to the penny or paisa.',
        'The due date is the invoice date plus the payment terms in calendar days.',
        'The file takes the invoice number as its name, SPH-2026-0117.pdf, and as its Title after “Invoice”.'
      ]
    },
    worked: {
      text: 'A Pune printer (GSTIN beginning 27) bills a Bengaluru school (29): 500 brochures at Rs 18.50 at the default 18%, 20 registers at Rs 2,450 written “GST 5%”, 10% off, and Rs 1,500 courier taxed at 18%. Subtotal Rs 58,250.00, discount Rs 5,825.00, taxable value Rs 53,925.00. The states differ, so IGST is Rs 1,768.50 at 18% on Rs 9,825.00 plus Rs 2,205.00 at 5% on Rs 44,100.00: Rs 57,898.50, due 20 October 2026. Billed to a Pune branch (27), the same total splits into CGST and SGST of Rs 884.25 each at 9% and Rs 1,102.50 each at 2.5%.'
    },
    uses: [
      ['Freelancers', 'A day rate in pounds with VAT, stamped PAID when the transfer arrives.'],
      ['Mixed baskets', 'Goods at 5% and 18% on one GST invoice, each rate totalled on its own.'],
      ['Regular clients', 'Pick a saved client and carry on from the last invoice number.']
    ],
    mistakes: [
      'Ending a line with a bare “18%” to mean tax. A bare percentage is that line’s discount; write “GST 18%” or “VAT 20%” for a rate.',
      'Choosing GST for a client with no GSTIN and no place of supply. The tool stops and asks for the state rather than guess the split.'
    ],
    faq: [
      { q: 'What is the difference between an invoice and a receipt?', a: 'An invoice asks to be paid; a receipt confirms payment. Tick Mark as paid and this one says it was settled, with a PAID stamp, the date and the method.' },
      { q: 'What does Net 30 mean on an invoice?', a: 'Payment is due 30 days after the invoice date; the tool prints that due date for you.' },
      { q: 'What is the place of supply on a GST invoice?', a: 'The state where the supply counts as made, shown with its two-digit code. Your own state means CGST plus SGST, another state IGST; 96 is a client abroad.' }
    ],
    related: { guides: ['/guides/chase-unpaid-invoices/'] },
    runs: [
      /* 2026-10-06, the rewritten generator (three layouts, per-line GST). /pdf/invoice-pdf/ in headless
         Chrome, these fields set and "Create invoice" pressed; the stats and the PDF read by pdf.js.
         Repeated by build/tests/pdf-invoice.js (group B4). */
      {
        browser: { tool: '/pdf/invoice-pdf/', controls: { fromName: 'Sahyadri Print House', fromAddress: '14 Karve Road, Pune 411004', fromTax: '27AAKFS4821M1Z3', toName: 'Lalbagh Learning Centre', toAddress: '22 Lalbagh Road, Bengaluru 560027', toTax: '29AACCL7310Q1ZP', number: 'SPH-2026-0117', date: '2026-10-05', due: '15', currency: 'INR', taxMode: 'gst', tax: 18, items: 'Brochures, 500, Nos, 18.50\nHardbound registers, 20, Nos, 2,450, GST 5%', discount: '10', discountType: 'percent', shipping: '1,500', shippingTax: 'taxable' } },
        shown: ['Rs 58,250.00', 'Rs 5,825.00', 'Rs 53,925.00', 'Rs 1,768.50', 'Rs 9,825.00', 'Rs 2,205.00', 'Rs 44,100.00', 'Rs 57,898.50', '20 October 2026', 'SPH-2026-0117.pdf']
      },
      /* the same, toAddress '9 FC Road, Pune 411005' and toTax '27AAACL7310Q1ZQ' */
      { browser: { tool: '/pdf/invoice-pdf/', controls: 'as above, toTax: 27AAACL7310Q1ZQ' }, shown: ['Rs 884.25', 'Rs 1,102.50', 'Rs 57,898.50'] }
    ]
  },

  '/pdf/payslip-pdf/': {
    term: 'a payslip',
    whatIs: [
      'A payslip, or salary slip, is the employer’s statement of one pay period: each earning, each deduction and the net that reached the bank.',
      'The rules differ by country. In the UK, gov.uk lists pay before and after deductions, each deduction that can vary, such as tax and National Insurance, and hours worked where pay depends on them. In India they come from central Acts and each state’s rules, as the answer below explains. This generator follows the Indian format: rupees, PAN and UAN, and the net in lakh and crore.'
    ],
    howItWorks: {
      text: 'The site’s own PDF writer lays out one A4 page; the only arithmetic is two sums and a subtraction.',
      points: [
        'Each line is a label then an amount, and only the last number on it counts.',
        'Net pay is gross earnings minus total deductions. Paid days and loss of pay are printed, never used to prorate.',
        'Amounts use Indian grouping, and the net is spelt out in lakh and crore, with paise if there are any.',
        'Days that do not add up, or a negative net, bring a warning; more than 22 lines in a column stops the run.'
      ]
    },
    worked: {
      text: 'Kaveri Analytics paid Rahul Menon for September 2026: 28 paid days and 2 days’ loss of pay in a 30-day month. Four earnings came to Rs 1,48,500.00 and three deductions (provident fund, professional tax and TDS) to Rs 24,044.00, for a net pay of Rs 1,24,456.00, written as “Rupees One Lakh Twenty-Four Thousand Four Hundred and Fifty-Six Only”. The loss of pay changed nothing: the basic of 62,000 printed as typed, so prorate it before entering it. The payslip was 1 page, 6.0 KB.'
    },
    uses: [
      ['Domestic staff', 'A monthly record of salary paid and any advance recovered.'],
      ['A missing month', 'Rebuild an old payslip from the payroll register for a visa file.'],
      ['Interns on a stipend', 'One earnings line and no deductions still make a complete slip.']
    ],
    mistakes: [
      'Listing the employer’s PF or ESI contribution under deductions. Only the employee’s share comes out of pay; adding the employer’s understates the net.',
      'Using it for a UK employee. The amount column is headed “AMOUNT (Rs)” and the words are in rupees whatever you type.'
    ],
    faq: [
      { q: 'What is the difference between gross pay and net pay?', a: 'Gross is everything earned before deductions; net is what is paid after them.' },
      { q: 'What is LOP on a salary slip?', a: 'Loss of pay: days absent with no salary due. The slip shows the count; the reduction must already be in the earnings you enter.' },
      { q: 'What is the UAN on a payslip?', a: 'The Universal Account Number the EPFO gives a provident fund member, kept across jobs. Left blank, it prints as a dash.' }
    ],
    related: { guides: ['/guides/run-payroll-india/'] },
    runs: [
      /* Payslip Generator: the fields below set (notes and accent left at their defaults), Create PDF pressed */
      {
        browser: { tool: '/pdf/payslip-pdf/', controls: { company: 'Kaveri Analytics Pvt Ltd\n21 Residency Road, Bengaluru 560025', period: 'September 2026', payDate: '2026-09-30', empName: 'Rahul Menon', empId: 'KA-0117', designation: 'Data Engineer', department: 'Platform', doj: '2023-07-10', pan: 'AAAPM1234Q', uan: '100987654321', bank: 'XXXX XXXX 7788', daysInMonth: 30, paidDays: 28, lop: 2, earnings: 'Basic 62000\nHouse rent allowance 24800\nSpecial allowance 41500\nPerformance bonus 20200', deductions: 'Provident fund (employee) 1800\nProfessional tax 200\nIncome tax (TDS) 22044' } },
        shown: ['Rs 1,48,500.00', 'Rs 24,044.00', 'Rs 1,24,456.00', 'Rupees One Lakh Twenty-Four Thousand Four Hundred and Fifty-Six Only', '1 page', '6.0 KB']
      }
    ]
  },

  '/pdf/delivery-challan-pdf/': {
    term: 'a delivery challan',
    whatIs: [
      'A delivery challan travels with goods that move without a tax invoice, or before one exists, and the receiver’s signature on it proves arrival.',
      'In India, Rule 55 of the CGST Rules, 2017 sets its contents: number and date; names, addresses and GSTINs of the consignor and consignee, each if registered; HSN code, description and quantity; taxable value; and a signature. A supply to the consignee also needs the tax rate and amount, and an inter-state movement the place of supply. A supply needs three copies, marked ORIGINAL FOR CONSIGNEE, DUPLICATE FOR TRANSPORTER and TRIPLICATE FOR CONSIGNER.'
    ],
    howItWorks: {
      text: 'The site’s own PDF writer draws a full copy of the document per copy you choose, each on new pages.',
      points: [
        'A 4- to 8-digit number before the quantity is read as the HSN; HSN, weight and package columns appear only when used.',
        'A purpose other than supply prints a transport-only value statement; a value of 0 leaves the value off.',
        'A long table continues under a compact letterhead, and every page is footed with its copy name and page number.',
        'An empty e-way bill field prints “Not generated”, with a warning once the value reaches Rs 50,000.'
      ]
    },
    worked: {
      text: 'Deccan Fabricators sent steel brackets and base plates to a powder coater for job work, as a combined challan and packing list in two copies. Two lines, 400 brackets weighing 120 kg in 8 packages and 60 plates weighing 94.5 kg in 3, gave a total quantity of 460 Nos, 11 packages and 214.5 kg. The declared value, Rs 38,500.00, raised no e-way bill warning, and the job-work purpose printed the transport-only declaration. Each copy fitted on 1 page: 2 pages in all, 17.0 KB.'
    },
    uses: [
      ['Goods on approval', 'Samples sent to a customer, with a record of what left and what must come back.'],
      ['Exhibition stock', 'Display units going to a trade fair, with case marks.'],
      ['Material out for processing', 'Castings sent for machining or plating, line by line with HSN codes.']
    ],
    mistakes: [
      'Leaving out the unit when giving weight and packages. The line is then read as description, HSN, quantity, so the package count becomes the quantity.',
      'Relying on the generator for tax lines. It has no tax rate or amount fields; where a supply needs them, add them in the notes.'
    ],
    faq: [
      { q: 'Does a delivery challan need a signature?', a: 'Yes, Rule 55 lists one. The challan has ruled lines for the consignor’s authorised signatory and the receiver’s signature.' },
      { q: 'What is the HSN code on a challan?', a: 'The Harmonised System code that classifies the goods, the same one the tax invoice uses. Type it before the quantity.' },
      { q: 'Can the challan be printed on Letter or Legal paper?', a: 'Yes: A4, US Letter and US Legal are all offered.' }
    ],
    runs: [
      /* Delivery Challan & Packing List Generator: the fields below set (notes, acknowledgement,
         accent and page size left at their defaults: A4), Create PDF pressed */
      {
        browser: { tool: '/pdf/delivery-challan-pdf/', controls: { docType: 'both', purpose: 'jobwork', copies: '2', number: 'JW-0031', date: '2026-10-05', consignorName: 'Deccan Fabricators', consignorAddress: 'Plot 7, MIDC Bhosari\nPune 411026, Maharashtra', consignorGstin: '27AAKFD4321R1Z2', consignorContact: '', consigneeName: 'Shree Powder Coaters', consigneeAddress: 'Gat 112, Chakan\nPune 410501, Maharashtra', consigneeGstin: '27ABDPS7788K1Z9', reference: '', dispatchFrom: 'Bhosari, Pune', deliverTo: 'Chakan, Pune', vehicle: 'MH 14 KQ 2207', transporter: 'Own vehicle', lrNumber: '', caseMarks: '', items: 'Mild steel brackets 150 mm, 73089090, 400, Nos, 120, 8\nMild steel base plates 200 x 200 mm, 73089090, 60, Nos, 94.5, 3', declaredValue: 38500, currency: 'INR' } },
        shown: ['460 Nos', '11', '214.5 kg', 'Rs 38,500.00', '1 page', '2 pages', '17.0 KB']
      }
    ]
  },

  '/pdf/label-pdf/': {
    term: 'a label sheet',
    whatIs: [
      'A label sheet is self-adhesive labels die-cut in a fixed grid on a backing sheet. A format is its label size, the count across and down, and the margins and gaps, and a template works only if the text lands inside those cuts.',
      'Common A4 formats: 21 labels of 63.5 × 38.1 mm (3 × 7) for addresses, 40 of 45.7 × 25.4 mm (4 × 10) for return addresses and small stickers, and 10 strips of 200 × 27 mm for shelves and file spines.'
    ],
    howItWorks: {
      text: 'Text is placed at measured positions on A4 pages by the site’s own PDF writer; nothing is an image.',
      points: [
        'A blank line in your text starts a new label.',
        'Each layout is a table of margins, sizes and gaps in millimetres, converted at 72 ÷ 25.4 points per mm.',
        'Text sits 4 points in from the label’s left edge, below an 8-point top pad, wrapped to its width, with lines 1.25 times the font size apart.',
        'Lines that do not fit the label’s height are dropped without a warning. Repeat fills one sheet by cycling the list.'
      ]
    },
    worked: {
      text: 'A pottery’s six-line return address, ending with a phone number, went on the 4 × 10 layout at 9 pt, repeated: 1 sheet, 40 labels placed, 14.4 KB. Every label stopped at the postcode. A 25.4 mm label has room for five lines at that size, so “Tel 01782 000111” was left off all 40 with no message. At 7 pt all six lines fitted on every label, and the sheet came to 17.3 KB.'
    },
    uses: [
      ['Jar and product labels', 'Name, weight and best-before date for a market-stall batch.'],
      ['File and shelf labels', 'Box-file spines or freezer contents on the 1 × 10 strips.'],
      ['Office asset tags', 'An asset number and owner on small 4 × 10 labels.']
    ],
    mistakes: [
      'Leaving a blank line inside one address. A blank line ends a label, so the gap splits one address across two labels.',
      'Assuming a sheet matches because the count does. Compare the label size in the layout list with your sheet’s packaging before printing a batch.'
    ],
    faq: [
      { q: 'Which Avery sheets do these layouts match?', a: 'By label size and count as Avery lists them, 3 × 7 matches L7160, 2 × 8 matches L7162, 2 × 7 matches L7163 and 4 × 10 matches L7654. Margins may differ slightly, so print a test sheet on plain paper first.' },
      { q: 'Can I start on a part-used sheet?', a: 'Not directly. The first label always goes top left and empty labels are skipped, so cut away the used rows or start a fresh sheet.' },
      { q: 'Can I print these on US Letter label sheets?', a: 'No. Every layout here is an A4 format on an A4 page, and Letter stock places its labels differently.' }
    ],
    related: { conversions: ['/conversions/length/millimeter-to-inch/'] },
    runs: [
      /* Label Sheet Generator: layout 4 x 10, repeat to fill, font size 9, left, no guides; one label:
         "Return to:\nHollybank Pottery\nUnit 4, Mill Yard\nStoke-on-Trent\nST4 2RR\nTel 01782 000111";
         Create PDF; pdf.js text of the page has no "Tel 01782 000111" */
      { browser: { tool: '/pdf/label-pdf/', controls: { layout: '4x10', repeat: 'repeat', size: 9, align: 'left', guides: 'no', items: 'Return to:\nHollybank Pottery\nUnit 4, Mill Yard\nStoke-on-Trent\nST4 2RR\nTel 01782 000111' }, pdfjs: 'the phone line appears 0 times' }, shown: ['1 sheet', '40 labels placed', '14.4 KB', '25.4 mm'] },
      /* the same at font size 7: pdf.js finds "Tel 01782 000111" 40 times */
      { browser: { tool: '/pdf/label-pdf/', controls: { layout: '4x10', repeat: 'repeat', size: 7 }, pdfjs: 'the phone line appears 40 times' }, shown: ['17.3 KB'] }
    ]
  },

  '/pdf/certificate-pdf/': {
    term: 'a certificate of completion',
    whatIs: [
      'A certificate of completion is a short signed statement, issued by an organisation, that a named person finished a course on a given date. Its worth comes from who issued it and whether that can be checked, not from the border.',
      'The heading carries the meaning. Attendance says someone was there, completion that they did what the course required, and achievement that a standard was assessed; pick the one that matches what you checked.'
    ],
    howItWorks: {
      text: 'One page is drawn per name, all in one PDF from the site’s own writer, using only vector shapes and the standard Times and Helvetica fonts.',
      points: [
        'The border is two rectangles in your accent colour; the heading is Times-Roman at 30 pt, wrapped to the page width.',
        'The name is Helvetica-Bold at 26 pt on one line, centred and underlined to its measured width. It is never wrapped or shrunk.',
        'The body is wrapped and centred, and the date and signatory sit on ruled lines at the foot.',
        'Dates print in the long British form, such as 3 October 2026; one run accepts up to 500 names.'
      ]
    },
    worked: {
      text: 'A portrait certificate of attendance for two people: “Konstantina Papadopoulou-Vasilakis” and “Dr Maximilian Featherstonehaugh-Wrigglesworth”. The run made 2 pages in 3.4 KB. Measured with the font widths the tool itself uses, the first name is about 458 points wide and sits inside the border; the second is 607 points on a page only 595 points wide, so it ran off both edges. The same list in landscape, 842 points across, fitted both, and the file was still 3.4 KB.'
    },
    uses: [
      ['CPD evidence', 'A dated record of a session for an attendee’s professional development log.'],
      ['School and club awards', 'Reading challenges or swimming distances, one page per child.'],
      ['Mandatory training', 'Proof that each employee completed fire-safety training on a date.']
    ],
    mistakes: [
      'Choosing portrait for a list with long names. Names are never shrunk or wrapped, so check the longest one, or use landscape, before printing a batch.',
      'Pasting names from a spreadsheet with other columns. A tab becomes a space, so a score next to “Priya Sharma” prints as part of her name; copy the name column alone.'
    ],
    faq: [
      { q: 'What should a certificate of completion include?', a: 'The recipient’s name, what was completed, the issuer, the date and a signature. Many add a reference number that can be checked against a register.' },
      { q: 'How do I send each person their own certificate?', a: 'The batch is one PDF with a page per name, in list order. Split PDF cuts it into one file per page.' },
      { q: 'What paper size are the certificates?', a: 'A4 only, landscape or portrait. On US Letter, print with fit to page, which shrinks the design slightly.' }
    ],
    runs: [
      /* Certificate Generator: heading "Certificate of Attendance", portrait, date 2026-10-03, the two names
         below, body "attended the two-day workshop\nIntroduction to Bookkeeping", signatory "R. Iyer",
         organisation "Northgate Adult Learning", accent default; Create PDF. Widths measured in the page
         with window.MVRPdfCore.textWidth(name, 'Helvetica-Bold', 26), the call the engine centres the name with. */
      {
        browser: { tool: '/pdf/certificate-pdf/', controls: { heading: 'Certificate of Attendance', orientation: 'portrait', date: '2026-10-03', names: 'Konstantina Papadopoulou-Vasilakis\nDr Maximilian Featherstonehaugh-Wrigglesworth', body: 'attended the two-day workshop\nIntroduction to Bookkeeping', signatory: 'R. Iyer', org: 'Northgate Adult Learning' }, measured: { first: '457.99 pt (458)', second: '606.76 pt (607)', portraitWidth: '595.28 pt (595)', landscapeWidth: '841.89 pt (842)' } },
        shown: ['2 pages', '3.4 KB']
      },
      /* the same with orientation landscape: 2 pages, 3.4 KB */
      { browser: { tool: '/pdf/certificate-pdf/', controls: { orientation: 'landscape' } }, shown: ['3.4 KB'] }
    ]
  },

  '/pdf/paper-pdf/': {
    whatTitle: 'What makes printable paper accurate',
    whatIs: [
      'Graph, dot, lined, isometric and music paper are patterns of evenly spaced lines or points, and the spacing is what matters: 8 mm feint, for example, is the usual ruling on UK A4 pads.',
      'A PDF measures in points, 1/72 of an inch, so lines drawn as vectors print at exactly the stated size, provided nothing rescales the page on its way to the printer.'
    ],
    howItWorks: {
      text: 'Each page is vector lines and tiny filled squares from the site’s own PDF writer, sharp at any zoom.',
      points: [
        'Millimetres become points at 72 ÷ 25.4 per mm; spacing is held between 2 and 30 mm and line weight between 0.1 and 2.',
        'Grid and lined paper start at the bottom-left margin corner and repeat up to the far margin; lined paper adds a pink margin rule 25 mm in.',
        'A dot grid draws every dot as its own small filled square, one drawing operation each.',
        'Drawing instructions are stored uncompressed and repeated in full on every page, so size grows with the pattern and the page count.'
      ]
    },
    worked: {
      text: 'The same A4 portrait page at 5 mm spacing with a 10 mm margin: as squared paper it took 95 drawing operations and 7.0 KB, but as a dot grid it took 2184 and made a 116.9 KB file, because every dot is a separate square. Isometric came to 269 operations and 19.2 KB. Tightening the dot grid to 2 mm gave 13344 operations, 711.5 KB and a warning that it may print slowly; for a fine pattern, squared paper in a pale colour is the lighter choice.'
    },
    uses: [
      ['Bullet journals', 'Dot-grid pages printed and punched for a ring binder.'],
      ['Design and technology', 'Isometric sheets for sketching objects in three dimensions.'],
      ['Handwriting practice', 'Lined paper at a wider spacing, such as 10 mm, for younger children.']
    ],
    mistakes: [
      'Making a many-page file of a dense dot grid. Every page repeats the whole drawing, so print one page and set the copies in the print dialogue.',
      'Setting the margin to 0. The outer lines then fall where most printers cannot reach and come out clipped; leave 5 to 10 mm.'
    ],
    faq: [
      { q: 'What size are the squares on standard graph paper?', a: 'There is no single standard: 5 mm is common on metric paper, and US paper has four or five squares to the inch, 6.35 or 5.08 mm.' },
      { q: 'Can I change the line colour?', a: 'Yes, to any colour; the default is a pale blue-grey, #9db4d0. On lined paper the margin rule stays pink.' },
      { q: 'Can I make one file with different paper types?', a: 'Not in one run. Make each type separately and join them with Merge PDF.' }
    ],
    related: { conversions: ['/conversions/length/millimeter-to-inch/'] },
    runs: [
      /* Printable Paper Generator, A4 portrait, spacing 5 mm, margin 10 mm, 1 page, colour and weight
         left at their defaults; Create PDF pressed once per paper type */
      { browser: { tool: '/pdf/paper-pdf/', controls: { type: 'grid', pageSize: 'a4', orientation: 'portrait', spacing: 5, margin: 10, pages: 1 } }, shown: ['95', '7.0 KB'] },
      { browser: { tool: '/pdf/paper-pdf/', controls: { type: 'dot', pageSize: 'a4', orientation: 'portrait', spacing: 5, margin: 10, pages: 1 } }, shown: ['2184', '116.9 KB'] },
      { browser: { tool: '/pdf/paper-pdf/', controls: { type: 'iso', pageSize: 'a4', orientation: 'portrait', spacing: 5, margin: 10, pages: 1 } }, shown: ['269', '19.2 KB'] },
      /* the dot grid at 2 mm: the run also showed "That spacing produces a very dense grid, which will make a large file and may print slowly." */
      { browser: { tool: '/pdf/paper-pdf/', controls: { type: 'dot', pageSize: 'a4', orientation: 'portrait', spacing: 2, margin: 10, pages: 1 } }, shown: ['13344', '711.5 KB'] }
    ]
  },

  '/pdf/pdf-metadata/': {
    term: 'PDF metadata',
    whatIs: [
      'Besides its pages, a PDF can carry a document information dictionary: text fields such as Title, Author, Subject, Keywords, Creator, Producer and the creation and modification dates. Viewers list them under Document Properties, and they go wherever the file goes.',
      'Many files also hold an XMP packet, an XML copy of the same facts attached to the document catalogue. Neither is printed, which is how a colleague’s name leaves with a file nobody meant it to.'
    ],
    howItWorks: {
      text: 'The site’s own parser, `pdfcore`, reads the fields; then a new file is built rather than the old one being edited.',
      points: [
        'The trailer’s `/Info` dictionary is decoded, UTF-16 strings included, and whichever of its eight standard fields are present appear in the stats.',
        'Every page is copied into a fresh document with a new catalogue; bookmarks and form fields are rebuilt in it, while the XMP stream is left out in both modes.',
        'Remove writes no `/Info` at all. Set writes only Title, Author, Subject and Keywords; a box left empty is dropped, not kept.'
      ]
    },
    worked: {
      text: 'The quotation this site’s Quotation tool makes from its default details (dated 4 October 2026) holds 3 fields: Title “Quotation QT-0001 - Northline Offices LLP”, Author “Acme Interiors Pvt Ltd” and a Subject. Removing them took the file from 11,463 to 11,279 bytes, shown as 11.0 KB, and a second pass found none. Setting only the Title to “Quotation for Northline” holds the surprise: reading that output back finds 1 field, because the empty Author and Subject boxes replaced the old values with nothing.'
    },
    uses: [
      ['Sending a tender', 'Check the Author field does not name whoever drafted it, or another firm’s template.'],
      ['Blind review', 'Strip author and software details before a paper goes to anonymous assessors.'],
      ['Tidying exports', 'Give generated statements one consistent Title and Subject before archiving.']
    ],
    mistakes: [
      'Filling in one box under “Set the fields below” and expecting the rest to stay. Every blank box is removed, so retype the Author and Subject if they should remain.',
      'Treating a clean properties panel as a clean file. Comments keep their authors’ names and embedded photos their EXIF data, because pages and images are copied as they are.'
    ],
    faq: [
      { q: 'How can I see who created a PDF?', a: 'Press the button with either action: the stats list every field the original holds, Author, Creator and Producer included.' },
      { q: 'Can removed metadata be recovered from the new file?', a: 'No. The fields are not blanked, they are never written. The original on your disk, and copies already sent, still have them.' },
      { q: 'Does stripping metadata also remove bookmarks?', a: 'No. Bookmarks and form fields are not metadata and are rebuilt in the new file; only the Info dictionary and the XMP stream are left out.' }
    ],
    runs: [
      /* Make the quotation (see the top of this file), open /pdf/pdf-metadata/, choose it, leave Action on "Remove all metadata", press "Apply to metadata"; save the download and note its byte size. */
      { browser: { input: 'quotation-qt-0001.pdf, 11,463 bytes, made by /pdf/quotation-pdf/ with its defaults, date 2026-10-04, validUntil 2026-11-03', action: 'strip', pressed: 'Apply to metadata', download: 'quotation-qt-0001-clean.pdf' }, shown: ['3 fields', 'Quotation QT-0001 - Northline Offices LLP', 'Acme Interiors Pvt Ltd', '11.0 KB', '11,279 bytes'] },
      /* Load the cleaned download back into the same tool and press the button again. */
      { browser: { input: 'quotation-qt-0001-clean.pdf from the run above', action: 'strip' }, shown: ['none'] },
      /* The original quotation again, Action "Set the fields below", Title only, the other three boxes left empty; then load that output back and press the button. */
      { browser: { input: 'quotation-qt-0001.pdf', action: 'edit', Title: 'Quotation for Northline', Author: '', Subject: '', Keywords: '', then: 'output loaded back, action strip' }, shown: ['Quotation for Northline', '1 field'] }
    ]
  },

  '/pdf/pdf-organise/': {
    whatTitle: 'What reorganising a PDF actually changes',
    whatIs: [
      'A PDF’s page order is the order of references in its page tree. Moving, dropping or turning a page means writing a new tree; each page’s drawing instructions can stay exactly as they were.',
      'Rotation is a page property, the /Rotate entry, counted clockwise in steps of 90 degrees and applied by the viewer, so a turned page keeps selectable text.'
    ],
    howItWorks: {
      text: 'This tool must draw your pages before you change anything, so opening a file loads pdf.js, Mozilla’s open-source renderer, from this site’s own copy.',
      points: [
        'pdf.js draws each card’s page only as it scrolls near the screen; each card has buttons to move it earlier or later, turn it 90° clockwise or mark it for removal.',
        'A card can also be dragged, anywhere on it with a mouse or pen, by its grip with a finger. Each thumbnail is drawn once per turn, so moving pages does not redraw them.',
        'Saving hands the kept pages, in grid order, to the site’s own writer, `pdfcore`, in a background worker. A turn is added to any `/Rotate` the page already had; nothing is re-rendered.'
      ]
    },
    worked: {
      text: 'A 5-page, 18.7 KB test file (200 numbered lines from Text to PDF) had page 2 marked for removal, page 4 turned once and page 5 moved one place earlier. The grid read 1, 2, 3, 5, 4 and the stats 4 kept, 1 removed, 1 rotated. The built file had 4 pages in 14.5 KB, its last page the old page 4 on its side. Its extracted text still begins “Line 142”, because the turn is a flag, not a picture.'
    },
    uses: [
      ['Fixing a merged pack', 'Put a covering letter back in front of its attachments.'],
      ['Blank scanned sides', 'Remove the empty backs a duplex scanner adds, seeing each one before it goes.'],
      ['Mixed scans', 'Turn the odd landscape page upright without touching the others.']
    ],
    mistakes: [
      'Dragging a thumbnail with a finger on a phone. Touching the picture scrolls the page, as it should; drag by the grip in the card’s corner instead.',
      'Waiting for every thumbnail before saving. The file is built from the document, not the pictures, so every page is in it.'
    ],
    faq: [
      { q: 'Does reordering PDF pages reduce quality?', a: 'No. The thumbnails are only for choosing; the saved file reuses each page’s content stream and images byte for byte.' },
      { q: 'Can I undo a page I marked for removal?', a: 'Yes. It stays in the grid, shown as dropped, with a restore button, until you build the file.' },
      { q: 'Do bookmarks survive reorganising?', a: 'Yes, where their page is kept: each points at its page’s new position, and one whose page you removed is dropped. Form fields follow their pages the same way.' }
    ],
    related: { guides: ['/guides/merge-pdf-files/'] },
    runs: [
      /* Open /pdf/pdf-organise/, choose numbered-test-document.pdf (top of this file) and the grid appears (until 2026-10-06 a "Show the pages" press came first); on card 2 press "Remove this page", on card 4 "Rotate 90°", on card 5 "Move earlier"; read the order and stats, press "Build reorganised PDF", save the download and read its text with pdf.js. Re-measured on 2026-10-04 with the fixed writer, which keeps the Title (before: 14.4 KB). */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, 200 numbered lines', pressed: ['card 2: Remove this page', 'card 4: Rotate 90°', 'card 5: Move earlier', 'Save the new order'], result: '4 pages · 14.5 KB (14,822 bytes)' }, shown: ['1, 2, 3, 5, 4', '4 kept, 1 removed, 1 rotated', '4 pages in 14.5 KB', 'Line 142'] }
    ]
  },

  '/pdf/pdf-page-numbers/': {
    whatTitle: 'What adding page numbers to a finished PDF means',
    whatIs: [
      'A finished PDF has no live page-number field. The numbers you see are ordinary text drawn on each page, so adding them later means drawing new text over the existing content, in a spot that is clear on every page.',
      'PDF also has page labels, which change only the counter a viewer shows in its toolbar. This tool prints numbers and writes no labels.'
    ],
    howItWorks: {
      text: 'Each page is copied by the site’s own writer, `pdfcore`, with one extra content stream holding its number.',
      points: [
        'The label is built from the format, start and skip; in the “of” formats the total counts only the pages that get a number.',
        'Helvetica’s published character widths measure it, so a centred number sits in the middle.',
        'The spot is worked out on the part of the page a reader sees, its crop box, turned as its `/Rotate` turns it, so the number reads upright.',
        'Nothing is flattened: the label is real text in a font resource named `MVRpn`, and the original text stays searchable.'
      ]
    },
    worked: {
      text: 'A 5-page report whose first page is a cover (the test file from Text to PDF, its own numbering off) was numbered in the “Page 1 of 10” style, skipping 1 page and starting at 1. Pages numbered: 4. The output’s text reads “Page 1 of 4” on the second sheet and “Page 4 of 4” on the last, each 32 points above the bottom edge, centred: the total counts numbered pages only. The file grew from 18.7 KB to 19.6 KB.'
    },
    uses: [
      ['Dissertations', 'Number the body of a thesis exported without page numbers, leaving the title page bare.'],
      ['Meeting papers', 'Add “Page n of m” after merging papers so a missing sheet shows at once.'],
      ['Scanned agreements', 'Number a scanned contract so cross-references can point at a page.']
    ],
    mistakes: [
      'Picking a corner the document already prints in. A letterhead footer or a running reference there will sit under the number; check one page of the result, then choose a clear spot.',
      'Using a long header at a large size. It is centred but never wrapped, so a line wider than the page runs off both sides.'
    ],
    faq: [
      { q: 'How do I start page numbering on page 3 of a PDF?', a: 'Set Skip first N pages to 2 and Start numbering at 1; the third page then shows 1.' },
      { q: 'Are added page numbers searchable?', a: 'Yes. They are real Helvetica text, so they can be selected, copied and found with a viewer’s search.' },
      { q: 'Will my viewer’s page counter match the printed numbers?', a: 'Not when you skip pages. No page labels are written, so the viewer still calls the cover page 1.' }
    ],
    runs: [
      /* Open /pdf/pdf-page-numbers/, set Format "Page 1 of 10", Position "Bottom centre", Start numbering at 1, Skip first N pages 1, choose numbered-test-document.pdf (top of this file), press "Add page numbers"; read the output's text and positions with pdf.js (label baseline at y = 32 pt). Re-measured on 2026-10-04 with the fixed writer, which keeps the Title (before: 19.8 KB). Re-measured on 2026-10-06, after the label's font became one object per file instead of one per page: 20,079 bytes, 19.6 KB (was 20,427, 19.9 KB); the labels, their x 272.1 and baseline 32 pt as before. */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, Text to PDF with numbers off', format: 'page-n-of-t (label "Page 1 of 10")', position: 'bc', start: 1, skip: 1, size: 10, pressed: 'Add page numbers', result: 'numbered-test-document-numbered.pdf, 5 pages · 19.6 KB (20,079 bytes)' }, shown: ['Pages numbered: 4', 'Page 1 of 4', 'Page 4 of 4', '32 points', '19.6 KB'] }
    ]
  },

  '/pdf/pdf-signature/': {
    whatTitle: 'What “signing” a PDF here actually does',
    whatIs: [
      'Two different things are called signing a PDF. A visible signature is marks on the page, such as a typed name or a scanned autograph. A cryptographic digital signature is a field stored in the file, with a /ByteRange entry and a certificate-based signature over those bytes, so any later change can be detected.',
      'This tool makes the first kind only, drawn on a pad or typed, with an optional date. Whether that is acceptable depends on the law and on the other party.'
    ],
    howItWorks: {
      text: 'The signature is drawn into the page by the site’s own PDF writer; no keys or certificates are involved.',
      points: [
        'pdf.js, from this site’s own copy, draws the page as a viewer shows it, so a click sets X and Y in points from its bottom left.',
        'Each selected page gets an extra content stream: a drawing as black vector strokes, your text in 11-point Helvetica, and “Date:” with your device’s date 14 points lower if the date is on.',
        'No `/Sig` field, `/ByteRange` or certificate is written, so the file holds nothing a signature validator could check.'
      ]
    },
    worked: {
      text: 'The 2-page quotation from this site’s Quotation tool was signed “For Acme Interiors: R. Shah”, date on, X 330, Y 150, Pages “last”. The stats read 2 pages, 1 signed, and the file went from 11,463 to 11,884 bytes. Page 2’s extracted text holds the name as an ordinary line and “Date: 6 October 2026” 14 points below it, so any editor can select or delete it. A byte search of the output finds no /ByteRange and no /Sig entry.'
    },
    uses: [
      ['Internal approvals', 'Mark an expense claim approved by a named manager.'],
      ['Simple forms', 'Add your name and date where a form asks only for a signature line.'],
      ['Delivery notes', 'Add “Received by” and a name before filing.']
    ],
    mistakes: [
      'Drawing a tiny scribble in a corner of the pad. It is enlarged to the width you set and comes out coarse; draw across the pad.',
      'Signing with letters the standard font lacks. Ł, ś or Devanagari print as “?”, so check the preview first.'
    ],
    faq: [
      { q: 'Is a typed name on a PDF a valid signature?', a: 'That depends on the jurisdiction, the document and what the other side accepts, not on this tool. For proof of who signed and that nothing changed since, use a certificate-based signing service.' },
      { q: 'How can I tell whether a PDF is digitally signed?', a: 'A signed file shows a signature panel or banner in viewers such as Adobe Acrobat Reader. A file from this tool shows none: it has no signature field.' },
      { q: 'Does the date update when the file is opened later?', a: 'No. It is your device’s date when you pressed the button, written as fixed text.' }
    ],
    runs: [
      /* Open /pdf/pdf-signature/, set Signature text "For Acme Interiors: R. Shah", Include date Yes, X 330, Y 150, Pages "last", choose quotation-qt-0001.pdf (top of this file), press "Add signature" on 4 October 2026; save the download, read page 2's text with pdf.js and search its bytes for /ByteRange and /Sig. */
      /* Re-measured on 2026-10-04 with the fixed writer, which keeps the Title and isolates the page's own drawing state in q … Q (before: 11,620 bytes). */
      /* Re-measured on 2026-10-06: still 11,884 bytes (one page signed, so one overlay font either way); the date is the day of the run, so it now reads "Date: 6 October 2026" (was 4 October), at x 330, 136 pt up, 14 below the name. */
      { browser: { input: 'quotation-qt-0001.pdf, 2 pages, 11,463 bytes', signatureText: 'For Acme Interiors: R. Shah', date: 'yes', x: 330, y: 150, pages: 'last', pressed: 'Add signature', runDate: '2026-10-06' }, shown: ['2 pages, 1 signed', '11,884 bytes', 'Date: 6 October 2026', '14 points below'] }
    ]
  },

  '/pdf/pdf-to-images/': {
    whatTitle: 'What converting a PDF page to an image does',
    whatIs: [
      'A PDF page is a list of drawing instructions measured in points, 72 to the inch, with no pixels, which is why it stays sharp at any zoom. Turning it into PNG, JPEG or WebP means rasterising it: carrying out those instructions once, at a chosen resolution, into a fixed grid of pixels.',
      'After that the text is a picture. It cannot be selected or searched, and enlarging it only blurs it.'
    ],
    howItWorks: {
      text: 'Rendering is done by pdf.js, Mozilla’s open-source renderer, loaded on first use from this site’s own copy; the site’s parser only counts the pages.',
      points: [
        'Each selected page is drawn onto a canvas scaled by DPI ÷ 72, painted white first so no area is transparent.',
        'Fonts that a PDF names but does not embed come from the standard font data kept beside pdf.js.',
        'The canvas is encoded with `canvas.toBlob` as PNG, or as JPEG or WebP at your quality, held between 40 and 100.'
      ]
    },
    worked: {
      text: 'Page 1 of the 2-page quotation from this site’s Quotation tool, at 300 DPI, came out at 2480×3508 pixels: A4’s 595.28 × 841.89 points times 300/72. As PNG it was 726.7 KB; as JPEG at quality 85, 500.0 KB; as WebP at 85, 241.0 KB. At 72 DPI the PNG was 595×842 and 85.4 KB, fine for a chat message but too coarse to print. For a page of text, PNG keeps letter edges exact and WebP is the smallest.'
    },
    uses: [
      ['Posts and slides', 'Turn a flyer’s first page into a PNG for a post or a presentation.'],
      ['Image-only portals', 'Upload a certificate page where a form accepts JPEG and nothing else.'],
      ['Marking up', 'Draw on a plan in an image editor that cannot open PDFs.']
    ],
    mistakes: [
      'Converting to images to stop copying. Text recognition reads the words straight back, and you lose search and accessibility.',
      'Using JPEG for line drawings and small print. Its compression leaves halos round sharp edges; PNG keeps them clean.'
    ],
    faq: [
      { q: 'How many pixels is an A4 page at 300 DPI?', a: '2480 × 3508. At 150 DPI this tool gives 1240 × 1754, half each way.' },
      { q: 'Can I convert just one page of a PDF to JPG?', a: 'Yes. Type its number in Pages, or a list such as 1, 3-4, and only those pages are drawn.' },
      { q: 'Are the PNG images transparent?', a: 'No. Every page is painted on white first, so the background is opaque, like paper.' }
    ],
    related: { guides: ['/guides/convert-jpg-to-pdf/'] },
    runs: [
      /* Open /pdf/pdf-to-images/, choose quotation-qt-0001.pdf (top of this file), Pages 1, Resolution 300 DPI, Format PNG, press "Convert to images"; read the card ("2480×3508 · 726.7 KB"). Repeat with JPEG quality 85, WebP quality 85, then 72 DPI PNG and 150 DPI PNG. */
      { browser: { input: 'quotation-qt-0001.pdf, 2 pages, A4 595.28 x 841.89 pt', pages: '1', dpi: '300', format: 'image/png', pressed: 'Convert to images' }, shown: ['2480×3508', '726.7 KB'] },
      { browser: { input: 'quotation-qt-0001.pdf', pages: '1', dpi: '300', format: 'image/jpeg', quality: 85 }, shown: ['500.0 KB'] },
      { browser: { input: 'quotation-qt-0001.pdf', pages: '1', dpi: '300', format: 'image/webp', quality: 85 }, shown: ['241.0 KB'] },
      { browser: { input: 'quotation-qt-0001.pdf', pages: '1', dpi: '72', format: 'image/png' }, shown: ['595×842', '85.4 KB'] },
      { browser: { input: 'quotation-qt-0001.pdf', pages: '1', dpi: '150', format: 'image/png' }, shown: ['1240 × 1754'] }
    ]
  },

  /* PDF to Text and PDF to Word. The input files are written by
     build/tests/pdf-to-text-word.js (reportlab and PyMuPDF; the prose is
     seeded, so every run makes the same files): newsletter.pdf, 2 A4 pages,
     3,618 bytes, a running header "Riverside Allotments · Spring 2026", a
     22 pt title over two columns, four 14 pt section headings, the bold
     10 pt subheading "Water butts", three bulleted and three numbered items,
     a sentence carried from column 1 into column 2, a page number on each
     page, Info Title "Riverside Allotments Newsletter, Spring 2026";
     report.pdf, 3 pages, 3,485 bytes, a running header and "Page n of 3"
     footers; scrambled.pdf, 1 page, two justified columns drawn word by word
     in shuffled order; long.pdf, 200 pages (PyMuPDF). Each was added to the
     tool's page in headless Chrome and the button pressed; the figures are
     the page's stat rows and summary. */
  '/pdf/pdf-to-text/': {
    whatTitle: 'What text a PDF actually stores',
    whatIs: [
      'A PDF keeps no paragraphs. Each page is a list of drawing instructions: these characters, in this font and size, at this point, in whatever order the program that wrote it chose.',
      'Getting the text out means rebuilding what a reader sees: lines, columns, paragraphs and headings.'
    ],
    howItWorks: {
      text: 'pdf.js runs on this page and lists each piece of text with its position, size and font; the site’s own layout code puts the pieces in order.',
      points: [
        'Pieces on one baseline join into a line, with a space where the gap is wider than about a sixth of the font size.',
        'The page is cut at wide horizontal gaps and at gutters that run the full height of the text; each column is read top to bottom.',
        'A change of spacing, indent, size or boldness starts a paragraph, and a sentence cut by a column break is joined again.',
        'A line clearly larger than the body text, or a short line wholly in a bold font, counts as a heading.'
      ]
    },
    worked: {
      text: 'A two-page allotment newsletter of 3.5 KB had a running header, a title over two columns, a sentence running from one column into the next, and page numbers. The .txt held 367 words in 47 lines, 2,112 characters (2.1 KB), each column in turn and the broken sentence whole. Six headings were found, one only by its bold font; the columns row read “2 columns: page 1; 1 column: page 2”. Leaving out the header and page numbers removed 4 blocks and left 355 words. An article of 186 words drawn in shuffled order came out jumbled as stored, and right in reading order.'
    },
    uses: [
      ['Quoting from reports', 'Lift a section of a council report into an email without the page’s line breaks.'],
      ['Search and scripts', 'Plain text for a script, a word count or a search across many documents.'],
      ['Listening', 'A clean text for a text-to-speech app that stumbles over two-column pages.']
    ],
    mistakes: [
      'Pasting figures from a statement straight into a spreadsheet. A table comes out as running text, row by row, so its columns must be split again.',
      'Keeping page numbers in text meant for listening or counting. “Leave them out” drops them.'
    ],
    faq: [
      { q: 'Does the .txt keep bold or italics?', a: 'No. Plain text has no formatting; bold only helps to find headings.' },
      { q: 'Can it read a password-protected PDF?', a: 'Yes. The page asks for the password when you add the file and uses it only on this device.' },
      { q: 'How long a PDF can it handle?', a: 'Up to 10,000 pages; above 300, font names are skipped. A 200-page file gave 90,800 words, 425.1 KB; the box showed the first 20,000 characters.' }
    ],
    runs: [
      /* newsletter.pdf (top of this pair), every default: Pages all, Order "Reading order (columns
         rebuilt)", headers and footers "Keep them", Between pages "A line: --- Page 2 ---"; "Get the
         text" pressed. Stats: Pages read 2, Words 367, Lines 47, Headings 6, Columns found "2 columns:
         page 1; 1 column: page 2", Running headers and footers "Kept: 4 blocks", Characters 2,112,
         Output size 2.1 KB; summary "newsletter.txt 2.1 KB". The download equals the generator's text
         block by block (build/tests/pdf-to-text-word.js). */
      { browser: { tool: '/pdf/pdf-to-text/', file: 'newsletter.pdf, 2 A4 pages, 3,618 bytes (3.5 KB)', controls: { pages: 'all', order: 'reading', furniture: 'keep', separator: 'marker' }, pressed: 'Get the text', result: 'newsletter.txt, 2,112 characters' },
        shown: ['3.5 KB', '367 words', '47 lines', '2,112 characters', '2.1 KB', '2 columns: page 1; 1 column: page 2'] },
      /* the same, headers and footers "Leave them out": Words 355, Lines 43, "Left out: 4 blocks", 2.0 KB */
      { browser: { tool: '/pdf/pdf-to-text/', file: 'newsletter.pdf', controls: { furniture: 'drop' } }, shown: ['4 blocks', '355 words'] },
      /* scrambled.pdf: Order "As stored in the file" -> Words 186, Lines 183, the sentences out of order;
         "Reading order" -> Words 186, Lines 26, the text as written */
      { browser: { tool: '/pdf/pdf-to-text/', file: 'scrambled.pdf, 1 page, 186 words drawn one by one in shuffled order', controls: { order: 'stream' } }, shown: ['186 words'] },
      /* long.pdf, 200 pages: Words 90,800, Lines 6,200, Characters 435,327, Output size 425.1 KB; the
         report box ends "[The first 20,000 of 435,327 characters are shown here. …]" */
      { browser: { tool: '/pdf/pdf-to-text/', file: 'long.pdf, 200 pages', controls: { pages: 'all' } }, shown: ['90,800 words', '425.1 KB', '20,000 characters'] }
    ]
  },

  '/pdf/pdf-to-word/': {
    whatTitle: 'What a PDF to Word conversion can bring across',
    whatIs: [
      'A Word document is text with structure: paragraphs, each in a style such as Heading 1 or List Paragraph, flowing onto as many pages as they need. A PDF is a fixed picture of every page, each letter at an exact point.',
      'Converting means deciding what each piece of a page was for. The aim here is a document you can edit, not a copy that looks the same.'
    ],
    howItWorks: {
      text: 'pdf.js reads the pages in this tab, the layout code of PDF to Text puts them in order, and the .docx is written here, with no server.',
      points: [
        'Heading sizes are ranked across the document: the three sizes used by most headings become Heading 1, 2 and 3.',
        'A short bold line at body size takes the next level down, so with one heading size, bold subheadings become Heading 2.',
        'A line starting with a bullet glyph or a dash becomes a bulleted List Paragraph.',
        'Short lines kept apart, such as an address, stay on separate lines within one paragraph.',
        'The file is a standard Office Open XML package, stored uncompressed in a ZIP.'
      ]
    },
    worked: {
      text: 'The allotment newsletter from PDF to Text became a 10.7 KB .docx with six headings: the title as Heading 1, four sections as Heading 2, and “Water butts”, bold at body size, as Heading 3. The tips became bulleted items, the dates kept their typed numbers, and a page break separated the pages. The PDF’s title, “Riverside Allotments Newsletter, Spring 2026”, became the document title. A three-page report with “Page 1 of 3” footers gave 225 words and 6 header and footer blocks; leaving them out gave 201 words and an 8.6 KB file.'
    },
    uses: [
      ['Updating an old policy', 'Revise a handbook that now exists only as a PDF.'],
      ['Correcting minutes', 'Fix minutes sent round as a PDF and return them as a document.'],
      ['Building a contents page', 'Word can make a table of contents from the heading styles.']
    ],
    mistakes: [
      'Expecting the Word file to look like the PDF. Fonts, pictures and positions stay behind; PDF to Images keeps the look, as pictures.',
      'Converting a scanned contract. With no text layer there is nothing to convert; OCR PDF must recognise the words first.'
    ],
    faq: [
      { q: 'Are tables turned into Word tables?', a: 'No. The cells come out as text, row by row, without the grid.' },
      { q: 'Will a password-protected PDF convert?', a: 'Yes, once its password is typed into the box shown when the file is added. The Word file has no password.' },
      { q: 'What page size does the Word file use?', a: 'The size of the PDF’s first page, landscape when that page is wider than tall, with 2.54 cm margins.' }
    ],
    runs: [
      /* newsletter.pdf (see /pdf/pdf-to-text/ above), every default: Pages all, reading order, headers
         and footers kept; "Make the Word file" pressed. Stats: Words 367, Headings "6 (1 Heading 1, 4
         Heading 2, 1 Heading 3)", Paragraphs 11, List items 6, Page breaks 1, Document title "Riverside
         Allotments Newsletter, Spring 2026", Output size 10.7 KB. python-docx on the download: the
         headings listed in that order, 3 bulleted List Paragraphs, "1." "2." "3." kept as text, one
         page break, core title as above. */
      { browser: { tool: '/pdf/pdf-to-word/', file: 'newsletter.pdf, 2 A4 pages, 3,618 bytes', controls: { pages: 'all', order: 'reading', furniture: 'keep' }, pressed: 'Make the Word file', result: 'newsletter.docx, 10.7 KB' },
        shown: ['10.7 KB', 'Riverside Allotments Newsletter, Spring 2026'] },
      /* report.pdf, kept: Words 225, "Kept: 6 blocks", 9.1 KB; "Leave them out": Words 201, "Left out: 6 blocks", 8.6 KB */
      { browser: { tool: '/pdf/pdf-to-word/', file: 'report.pdf, 3 pages, 3,485 bytes, footers "Page 1 of 3" to "Page 3 of 3"', controls: { furniture: 'keep' } }, shown: ['225 words', '6 header and footer blocks'] },
      { browser: { tool: '/pdf/pdf-to-word/', file: 'report.pdf', controls: { furniture: 'drop' } }, shown: ['201 words', '8.6 KB'] }
    ]
  },

  '/pdf/purchase-order-pdf/': {
    term: 'a purchase order',
    whatIs: [
      'A purchase order, or PO, is the buyer’s written order to a supplier: what is wanted, how many, at what price, where and by when, and on what terms. Its number lets invoices and delivery papers be matched back to it.',
      'This tool adds the supplier’s quotation reference, freight lines, GST or UK VAT, an Incoterms 2020 term and an inspection clause. It lays out and adds up what you enter; the terms are your call.'
    ],
    howItWorks: {
      text: 'The order is calculated and typeset by the page’s script, then written by `createPDF` in the site’s PDF engine.',
      points: [
        'Item lines are read from the right: rate, an optional unit word, quantity, then a 4–8 digit HSN/SAC code; the rest is the description. A comma between digits, with no space, groups thousands.',
        'Charges join the discounted goods total as the taxable value, and one VAT or GST rate is applied to it, split into CGST and SGST for an intra-state order.',
        'Amounts stay unrounded; only the committed value follows the Round the total setting.'
      ]
    },
    worked: {
      text: 'A UK print studio orders paper: 40 reams at £38.50 and 25 at £29.90 less 5%, a £65.00 pallet delivery, VAT 20%, no rounding, DAP Harlow CM20 2BN. The tool shows goods of £2,287.50, a discount of -£37.38, taxable value £2,315.13, VAT £463.02 and a committed value of £2,778.15 on 2 pages. Note the penny: the printed lines add up to £2,315.12, but the discount is really £37.375 and the tool keeps the half-penny. With the named place emptied, the term prints as “DAP — Delivered At Place” and a warning says the Incoterm is incomplete.'
    },
    uses: [
      ['Site and project orders', 'Put a price agreed by phone in writing.'],
      ['Small firms', 'Number every order so invoices can be matched to it.'],
      ['Imports', 'State an Incoterm with its place so carriage and risk are settled.']
    ],
    mistakes: [
      'Typing an item line with no spaces. In “Plate,2,2,650” no comma shows which groups thousands, so the tool names both readings, 2 at 650 and 2 at 2650, and stops.',
      'Expecting the GST rate box to change VAT. The UK VAT choices use fixed rates of 20%, 5% and 0%.'
    ],
    faq: [
      { q: 'What does DAP mean on a purchase order?', a: 'Delivered At Place, an Incoterms 2020 rule: the supplier brings the goods to the named place, ready for unloading, while import clearance and duties stay with the buyer.' },
      { q: 'Is a PO number the same as an invoice number?', a: 'No. The PO number is the buyer’s; the supplier’s invoice has its own number and should quote the PO’s.' },
      { q: 'Can I make a purchase order in pounds or euros?', a: 'Yes. The £ and € signs print, and the value in words uses pounds and pence or euros and cents.' }
    ],
    related: { guides: ['/guides/calculate-gst/'] },
    runs: [
      /* Open /pdf/purchase-order-pdf/, set the fields below (all others left at their defaults), press "Create PDF". The note is a hand check of the printed lines, not a tool figure. */
      { browser: { fields: { buyerName: 'Harlow Print Studio Ltd', buyerAddress: 'Unit 4, Edinburgh Way\nHarlow CM20 2BN', buyerTax: '', buyerContact: '01279 000000  ·  orders@harlowprint.example', supplierName: 'Fenwick Paper Supplies Ltd', supplierAddress: '22 Mill Lane\nChelmsford CM1 1AA', supplierTax: '', number: 'HPS-PO-118', date: '2026-10-04', quoteRef: 'FPS-Q-2291', requiredBy: '2026-10-16', sameAddress: 'same', items: 'SRA3 silk paper 170 gsm, 40, Ream, 38.50\nSRA3 uncoated 120 gsm, 25, Ream, 29.90, 5%', charges: 'Pallet delivery, 65', currency: 'GBP', taxMode: 'vat20', rounding: 'none', incoterm: 'DAP', incotermPlace: 'Harlow CM20 2BN' }, pressed: 'Create PDF', note: 'printed lines: 2,287.50 - 37.38 + 65.00 = 2,315.12; unrounded discount 747.50 x 5% = 37.375' }, shown: ['£2,287.50', '-£37.38', '£65.00', '£2,315.13', '£463.02', '£2,778.15', '2 pages'] },
      /* The same with "Named place or port" emptied. */
      { browser: { fields: 'as above, incotermPlace: ""', pressed: 'Create PDF' }, shown: ['DAP — Delivered At Place', 'Incoterm is incomplete'] },
      /* The mistakes: fields as in the first run, items "Plate,2,2,650"; the message names both readings and no PDF is made. With "Plate, 2, 2,650" instead: Goods and services £5,300.00. */
      { browser: { fields: 'as above, items: "Plate,2,2,650"', pressed: 'Create PDF', message: '“Plate,2,2,650” can be read 2 ways: 2 at 650 for “Plate, 2”, or 2 at 2650 for “Plate”.' }, shown: ['both readings', '2 at 650', '2 at 2650'] }
    ]
  },

  '/pdf/quotation-pdf/': {
    term: 'a quotation',
    whatIs: [
      'A quotation is a seller’s written price for a defined job or set of goods, open for acceptance until a stated date. It names both parties, lists items with quantities and rates, shows the expected tax and sets out delivery, payment and warranty terms.',
      'This tool also makes estimates, marked as an indication rather than an offer, and proforma invoices, marked as not tax invoices. It applies the single rate you enter; the rate pages it was checked against are under Sources.'
    ],
    howItWorks: {
      text: 'The arithmetic and layout come from the page’s script, and the file is written by `createPDF` from the site’s own engine.',
      points: [
        'One tax rate covers the document: intra-state GST prints CGST and SGST at half each, inter-state prints IGST, and UK VAT uses 20%, 5% or 0%.',
        'If the two GSTINs begin with different two-digit state codes while intra-state is chosen, the tool warns but prints your choice.',
        'Rates may keep their commas if a space follows each separating comma: typed as 4,85,000, 2,650 and 64,500, the order below still totals Rs 7,63,671.00.'
      ]
    },
    worked: {
      text: 'A Hubballi fabricator (GSTIN beginning 29) sends a Pune warehouse (27) a proforma invoice: a mezzanine structure at Rs 4,85,000, 38 Sqm of chequered plate at Rs 2,650 less 3%, and installation at Rs 64,500. On intra-state GST at 18% the tool warns that different state codes usually mean IGST. Switched to inter-state: taxable value Rs 6,47,179.00, IGST 18% Rs 1,16,492.22, total Rs 7,63,671.00 rounded to the rupee, or Rs 7,63,671.22 unrounded. The 2 pages are valid for 15 days and state that this is not a tax invoice.'
    },
    uses: [
      ['Contractors', 'Quote materials and labour with HSN and SAC codes.'],
      ['Advance payment', 'Send a proforma so a new buyer can pay before supply.'],
      ['UK trades', 'Price a kitchen fit in pounds with VAT at 20%.']
    ],
    mistakes: [
      'Writing a decimal with a comma, as 2,65. It fits neither 2,650 nor 4,85,000 grouping, so the tool stops and asks; use a point.',
      'Choosing a valid-until date before the quotation date. The tool warns that the offer has expired, yet still produces it.'
    ],
    faq: [
      { q: 'How long should a quotation be valid for?', a: 'There is no single rule, and shorter suits trades where material prices move quickly. The tool defaults to 30 days from today.' },
      { q: 'What is the HSN or SAC code on a quotation?', a: 'HSN codes classify goods and SAC codes services under India’s GST. The column appears only when a line carries a code of 4 to 8 digits; the tool does not check it.' },
      { q: 'Can I add my logo to the quotation?', a: 'No. The letterhead is set in text, name, address, tax number and contact line, with an accent colour you choose.' }
    ],
    related: { guides: ['/guides/calculate-gst/'] },
    runs: [
      /* Open /pdf/quotation-pdf/, set the fields below (all others at their defaults), press "Create PDF": the GSTIN warning appears. Then taxMode gst-inter, Create PDF; then also rounding none. */
      { browser: { fields: { docType: 'Proforma Invoice', fromName: 'Kaveri Steel Fabricators', fromAddress: 'Plot 9, KIADB Industrial Area\nHubballi 580030, Karnataka', fromTax: '29ABCDE1234F1Z5', fromPhone: '', fromEmail: '', fromWeb: '', bank: '', toName: 'Deccan Warehousing Pvt Ltd', toAddress: 'Gat 112, Chakan MIDC\nPune 410501, Maharashtra', toTax: '27AAACD5678K1Z2', number: 'PI-0042', date: '2026-10-04', validUntil: '2026-10-19', items: 'Mezzanine floor steel structure, 7308, 1, Lot, 485000\nChequered plate 6 mm, 7208, 38, Sqm, 2650, 3%\nInstallation, 995468, 1, Lot, 64500', taxMode: 'gst-intra', taxRate: 18, rounding: 'near' }, pressed: 'Create PDF' }, shown: ['usually mean IGST'] },
      { browser: { fields: 'as above, taxMode: gst-inter', pressed: 'Create PDF' }, shown: ['Rs 6,47,179.00', 'IGST 18%', 'Rs 1,16,492.22', 'Rs 7,63,671.00', '2 pages', '15 days', 'not a tax invoice'] },
      { browser: { fields: 'as above, taxMode: gst-inter, rounding: none', pressed: 'Create PDF' }, shown: ['Rs 7,63,671.22'] },
      /* 2026-10-04, after the line reader learned thousands separators: gst-inter, rounding near, the three rates typed "4,85,000", "2,650" and "64,500" */
      { browser: { fields: 'as above, taxMode: gst-inter, items with the rates written 4,85,000, 2,650 and 64,500', pressed: 'Create PDF' }, shown: ['4,85,000', '2,650', '64,500', 'Rs 7,63,671.00'] },
      /* items "Chequered plate 6 mm, 7208, 38, Sqm, 2,65": the run stops with a message and no PDF */
      { browser: { fields: 'as above, items: "Chequered plate 6 mm, 7208, 38, Sqm, 2,65"', pressed: 'Create PDF', message: 'In “Chequered plate 6 mm, 7208, 38, Sqm, 2,65”, “2,65” is not a number with thousands separators (2,650 or 1,25,000), so it is not clear what it means.' }, shown: ['2,65', 'stops and asks'] }
    ]
  },

  /* Scan to PDF (wave 2). Runs made on 2026-10-06 in headless Chrome against a local server of
     the wave-2 branch, by build/tests/pdf-scan-to-pdf.js, which draws its own photos in the page
     (an A4 page with a header bar, word blocks, an 8 x 6 checkerboard of 10 mm squares and 1-3 ID
     blocks, put in 3-D and photographed by a pinhole camera, 26 mm-equivalent lens, with sensor
     noise; saved as JPEG at quality 92) and reads the output with pdf.js and MuPDF:
       scan-wood.jpg   1600 x 1200, wood table, page turned 6 degrees and tilted 18, a shadow
                       darkening the right of the frame by up to 42%; 514,134 bytes
       scan-grey.jpg   1600 x 1200, grey table, page turned 18 degrees; 500,544 bytes
       scan-carpet-exif6.jpg   1200 x 1600 shown, stored 1600 x 1200 on its side with EXIF
                       Orientation 6; carpet; 565,796 bytes
       scan-12mp.jpg   4032 x 3024, wood table; 2,904,744 bytes */
  '/pdf/scan-to-pdf/': {
    whatTitle: 'What a phone photo of a page gets wrong',
    whatIs: [
      'A photo of a page is not a scan: the sheet arrives as a slanted four-sided shape, the paper turns grey where the light falls off, and the table shows round the edges.',
      'Scanning undoes all three: find the four corners, map that shape back to a rectangle of the page’s true proportions, and even out the paper.'
    ],
    howItWorks: {
      text: 'It runs in a background worker on this page, in plain JavaScript written for the site.',
      points: [
        'The photo is decoded upright (EXIF orientation applied) and shrunk to 1,280 pixels; its edges vote for straight lines, and each set of four is scored on how much of each side is real edge and whether the inside is lighter.',
        'The winning corners are drawn on the page’s card, where you can drag them.',
        'The page’s proportions are worked out from how its sides converge, and snapped to A4 or Letter when within 3%.',
        'The full photo is warped to that rectangle, at most 2,500 pixels long, turned if asked, and its shading divided out.',
        'Colour and greyscale pages are stored as JPEG; black and white as lossless Flate.'
      ]
    },
    worked: {
      text: 'Three 1600 × 1200 photos of A4 pages went in: one on wood with a shadow across it, one on a grey table turned 18°, one on carpet stored on its side with an EXIF tag, as phones save them. Edges were found with confidence 0.92 to 0.96, and out came three upright A4 pages, 316.7 KB, with 48 of 48 test checkerboard squares in place on each. Paper in the shadow measured 205 out of 255 untouched and 254.5 after Colour document. Black and white: 28.4 KB.'
    },
    uses: [
      ['Expense receipts', 'Photograph each receipt and send finance one file.'],
      ['Signed forms', 'Return a signed page with no scanner nearby.'],
      ['Handouts', 'Turn a stack of printouts into one file for a tablet.']
    ],
    mistakes: [
      'Shooting a white page on a white desk. There is little edge to find; use a darker surface, or set the corners by hand.',
      'Expecting to search the words. Each page is a picture; OCR PDF adds searchable text.'
    ],
    faq: [
      { q: 'Which page size should I choose?', a: 'A4 or US Letter fits every picture on that paper. Fit to the photo keeps each straightened picture’s own shape; a page measured as A4 or Letter gets that size.' },
      { q: 'How large will the PDF be?', a: 'A 12-megapixel photo of an A4 page became a 338.3 KB page, its picture 1768 × 2500 pixels at quality 85.' },
      { q: 'Can I add pages later?', a: 'Yes, from the file picker or the camera at any time; the arrows on each card set the order.' }
    ],
    runs: [
      /* Scan to PDF, the three 1600 x 1200 photos above in that order, Page size A4, Enhancement
         Colour document, Picture quality Standard (85), Make the PDF pressed. Stats: Pages 3, File size
         316.7 KB, Page size "A4 × 3", Edges found "3 of 3 (confidence 0.92 to 0.96)", Pictures "JPEG
         quality 85, up to 886 × 1253 px". pdf.js render at 2x: checkerboard 48/48 on every page,
         header bar top left on every page; mean of the paper right of the header (in the shadow on
         the wood photo) 254.5. MuPDF: 3 pages, one picture each (811x1147, 712x1007, 886x1253). */
      {
        browser: { tool: '/pdf/scan-to-pdf/', files: ['scan-wood.jpg', 'scan-grey.jpg', 'scan-carpet-exif6.jpg'], scenes: 'wood with a shadow; grey table, page turned 18°; carpet, stored on its side with EXIF Orientation 6', controls: { pageSize: 'a4', enhance: 'colour', quality: '0.85' }, pressed: 'Make the PDF', result: 'scan-2026-10-06.pdf, 3 A4 pages, 324,276 bytes' },
        shown: ['1600 × 1200', '0.92 to 0.96', '316.7 KB', '48 of 48', '254.5']
      },
      /* the same photos, Enhancement "None (as photographed)": 449.8 KB; the same paper area 205.3 */
      { browser: { tool: '/pdf/scan-to-pdf/', files: ['the same three'], controls: { enhance: 'none' } }, shown: ['205 out of 255'] },
      /* the same photos, Enhancement "Black and white": 29,079 bytes, shown 28.4 KB; FlateDecode DeviceGray pictures */
      { browser: { tool: '/pdf/scan-to-pdf/', files: ['the same three'], controls: { enhance: 'bw' } }, shown: ['28.4 KB'] },
      /* scan-12mp.jpg alone, A4, Colour document, quality 85: Pages 1, File size 338.3 KB, Pictures
         "JPEG quality 85, up to 1768 × 2500 px"; MuPDF: one 1768x2500 picture */
      { browser: { tool: '/pdf/scan-to-pdf/', files: ['scan-12mp.jpg'], controls: { pageSize: 'a4', enhance: 'colour', quality: '0.85' } }, shown: ['338.3 KB', '1768 × 2500'] }
    ]
  },

  '/pdf/rotate-pdf/': {
    term: 'page rotation in a PDF',
    whatIs: [
      'Every PDF page may carry a /Rotate value of 0, 90, 180 or 270: the degrees clockwise a viewer turns the page when it shows or prints it. The content is still described in the page’s upright coordinates; only the presentation changes.',
      'The value can also be inherited from a parent node in the page tree, so a tool that rotates correctly reads the inherited value before adding to it.'
    ],
    howItWorks: {
      text: 'Rotating here changes one number per page, inside the site’s own PDF engine; pdf.js only previews the result.',
      points: [
        'The page selection is parsed (`all`, `1-3, 7`, `8-`) and every page is copied into a new document, in order.',
        'For a selected page, the angle is added to its existing `/Rotate`, set on the page or inherited, modulo 360; a result of 0 removes the entry.',
        'Content streams, fonts and images are copied byte for byte: nothing is re-rendered or recompressed.'
      ]
    },
    worked: {
      text: 'The 5-page, 18.7 KB test document (200 numbered lines from Text to PDF) had pages 2-3 turned 90° clockwise. The stats show 2 pages rotated; the output, 19,199 bytes against 19,177 in, contains exactly two “/Rotate 90” entries, and all five content streams match the original byte for byte. Running it again with page 2 at 270 brought that page back upright: 90 + 270 is 360, so the entry disappears, while page 3 still reports 90 and opens as an 841.89 × 595.28 landscape view.'
    },
    uses: [
      ['Sideways phone scans', 'Turn receipts a scanning app saved on their side before uploading them.'],
      ['Wide tables in a portrait report', 'Rotate only the landscape pages so they read correctly on screen.'],
      ['Upside-down feeder pages', 'Fix sheets a document feeder took in the wrong way round with 180°.']
    ],
    mistakes: [
      'Typing the pages as “2 to 3” or “p2”. Use digits with hyphens and commas, such as 2-3, 7; anything else stops with an error naming the part it could not read.',
      'Leaving Pages on “all” when only some pages are sideways. Every page turns, the upright ones included; list just the sideways pages.',
      'Picking 90° when the page leans the other way. A page whose top points to the right needs 270, the anticlockwise option.'
    ],
    faq: [
      { q: 'How do I rotate just one page of a PDF?', a: 'Type that page’s number in Pages, choose the angle and press Rotate pages; every other page is copied unchanged.' },
      { q: 'Can I rotate a PDF page by 45 degrees?', a: 'No. The rotation entry accepts only multiples of 90.' },
      { q: 'Does rotating make the PDF bigger?', a: 'Barely. Each turned page gains one short entry; in the run above the file grew by 22 bytes, its Title carried over unchanged.' }
    ],
    runs: [
      /* Open /pdf/rotate-pdf/, Rotate by "90° clockwise", Pages "2-3", choose numbered-test-document.pdf (top of this file), press "Rotate pages"; count "/Rotate 90" in the download and compare its stream bodies with the input's. Re-measured on 2026-10-04 with the fixed writer, which keeps the Title (before: 19,114 bytes). */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, 19,177 bytes, 200 numbered lines', angle: '90', pages: '2-3', pressed: 'Rotate pages' }, shown: ['2 pages rotated', '19,199 bytes', 'two “/Rotate 90” entries', '22 bytes'] },
      /* Load that download, Rotate by "90° anticlockwise" (270), Pages "2"; read each page's rotation and view size with pdf.js. */
      { browser: { input: 'the rotated download above', angle: '270', pages: '2', note: '90 + 270 = 360' }, shown: ['still reports 90', '841.89 × 595.28'] }
    ]
  },

  '/pdf/split-pdf/': {
    whatTitle: 'What splitting a PDF does',
    whatIs: [
      'Splitting makes several smaller PDFs from one, each a complete document with its own catalogue and page tree. No page is cut or redrawn; each new file holds copies of the original page objects.',
      'Whatever a page needs, its fonts and images, travels with it, so resources the original shared across pages are repeated in every part. The parts together usually come to a little more than the whole.'
    ],
    howItWorks: {
      text: 'The grouping is decided first; then each group goes through the site’s own PDF writer as a separate document.',
      points: [
        'In half gives the extra page of an odd count to the first file. Explicit ranges are separated by |, so a page may appear in two outputs.',
        'For each group, `pdfcore` copies every page with the objects it refers to (content, fonts, images, annotations) into a fresh file, but never another page: a link out of the group is dropped.',
        'Each part keeps the Title and Author, and the bookmarks and form fields of its own pages; parts are named after the source with their page span, such as `-p3-4`.',
        'Up to 500 files can be made at once, and saved together as one ZIP.'
      ]
    },
    worked: {
      text: 'The 5-page test document from Text to PDF (18.7 KB, titled “Numbered test document”) split Every 2 pages gave 3 files: pages 1-2 and 3-4 at 9,155 bytes each, and page 5, holding only lines 189 to 200, at 1,716 bytes, 19.6 KB in total. Split in half it gave pages 1-3 and 4-5, 19.1 KB together. Loading the first part into the metadata tool found 1 field, the Title “Numbered test document”, which every part carries.'
    },
    uses: [
      ['Separating a scanned batch', 'Turn one long scan of two-page forms into one file per form.'],
      ['Email size limits', 'Cut a large manual into chapters that each fit under an attachment cap.'],
      ['Sending only the relevant part', 'Give a contractor the drawings from a tender pack without the pricing pages.']
    ],
    mistakes: [
      'Putting commas between ranges. A comma joins pages into the same group, so “1-3, 4-6” makes a single six-page file; separate groups with |.',
      'Sending a part under the original’s title. A reader shows the whole report’s name for one chapter; retitle it in the metadata tool.'
    ],
    faq: [
      { q: 'How do I split a PDF into single pages?', a: 'Choose One file per page. A 30-page file gives 30 PDFs named from -p1 to -p30, downloadable together as a ZIP.' },
      { q: 'Can I split a PDF by file size?', a: 'Not directly. Split by page count, check each part’s size and adjust N; photographs weigh far more than text.' },
      { q: 'Can one page go into two of the split files?', a: 'Yes, with explicit ranges: “1-3 | 3-5” puts page 3 in both files.' }
    ],
    related: { guides: ['/guides/merge-pdf-files/'] },
    runs: [
      /* Open /pdf/split-pdf/, Split "Every N pages", Pages per file 2, choose numbered-test-document.pdf (top of this file), press "Split PDF"; note each file's byte size. Then Split "In half". Then load the p1-2 part into /pdf/pdf-metadata/ and press its button. Re-measured on 2026-10-04 with the fixed writer, which keeps the Title in every part (before: 9,072 and 1,633 bytes, 19.3 KB and 19.0 KB, and no metadata in the part). */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, title "Numbered test document", page 5 holds lines 189-200', mode: 'every', n: 2, pressed: 'Split PDF' }, shown: ['9,155 bytes', '1,716 bytes', '19.6 KB'] },
      { browser: { input: 'numbered-test-document.pdf', mode: 'half' }, shown: ['19.1 KB'] },
      { browser: { input: 'numbered-test-document-p1-2.pdf from the first run, opened in /pdf/pdf-metadata/', action: 'strip' }, shown: ['1 field', 'Numbered test document'] }
    ]
  },

  '/pdf/text-to-pdf/': {
    whatTitle: 'What turning plain text into a PDF involves',
    whatIs: [
      'Plain text has characters and line breaks but no page. To become a PDF it must be typeset: broken into lines that fit a measured width, gathered into pages and drawn in a font the viewer can show.',
      'The PDF standard names 14 base fonts that readers have long been expected to provide, Helvetica, Times and Courier among them. They need no font data in the file, but hold only the characters of their WinAnsi encoding; any other script needs a font embedded.'
    ],
    howItWorks: {
      text: 'Your text is laid out and written by the site’s own engine; a font file is fetched and embedded only when the text needs one.',
      points: [
        'Each paragraph is wrapped word by word, using the font’s character widths at the chosen size, within the page width less both margins.',
        'Each line becomes a `Tj` command in WinAnsi: curly quotes, dashes, € and ½ have their own codes. Text with anything else is set in Noto Sans, glyph by glyph, Hindi shaped by HarfBuzz.',
        'A Document title goes into the file’s Title property and its name, not onto the page.'
      ]
    },
    worked: {
      text: 'Take 1,200 words written as 200 short numbered sentences. One sentence per line on A4 at 11 pt fills 200 lines over 5 pages (47 lines a page, 18.7 KB). Joined into one paragraph, they wrap to 67 lines in Helvetica, 58 in Times and 86 in Courier, 2 pages each, at 10.6 KB, 10.1 KB and 11.5 KB. A second test, “Advance: ₹1500 or €18 — paid ½ now”, came back exactly, rupee sign included, on a 7.4 KB page set in Noto Sans; a 126-character URL with no spaces still ran off the page.'
    },
    uses: [
      ['Claim forms', 'Turn a written statement into the PDF an upload form demands.'],
      ['Printed notes', 'Set long notes large, with generous spacing, for reading on paper.'],
      ['Records', 'Keep a paginated copy of an email or transcript with other PDFs.']
    ],
    mistakes: [
      'Pasting indented or column-aligned text. Runs of spaces and tabs shrink to one space when lines wrap, so code and tables lose their layout.',
      'Expecting the Document title to be printed. It is stored only in the file’s properties and name; type it as the first line if it should appear.'
    ],
    faq: [
      { q: 'How do I convert a TXT file to PDF?', a: 'Open the .txt file in a text editor, copy everything and paste it here; the tool takes pasted text, not uploads.' },
      { q: 'Can I make some of the text bold or add headings?', a: 'No. One font and one size apply to the whole document; set headings apart with blank lines or capitals.' },
      { q: 'Which page size should I choose?', a: 'A4 (210 × 297 mm) for most of the world, US Letter (8.5 × 11 inches) in the United States and Canada.' }
    ],
    runs: [
      /* The first sentence: the base file at the top of this file (200 lines joined with "\n", A4, Helvetica 11, numbers off). */
      { browser: { text: '200 lines "Line 001 of the test document." to "Line 200 of the test document." joined with newlines, 1,200 words', pageSize: 'a4', font: 'Helvetica', size: 11, leading: 1.4, margin: 20, numbers: 'no', pressed: 'Create PDF' }, shown: ['200 lines over 5 pages', '47 lines a page', '18.7 KB'] },
      /* The same 200 sentences joined with single spaces, numbers off, once per font. */
      { browser: { text: 'the same 200 sentences joined with spaces', font: 'Helvetica', size: 11, numbers: 'no' }, shown: ['67 lines in Helvetica', '10.6 KB'] },
      { browser: { text: 'the same 200 sentences joined with spaces', font: 'Times-Roman', size: 11, numbers: 'no' }, shown: ['58 in Times', '10.1 KB'] },
      { browser: { text: 'the same 200 sentences joined with spaces', font: 'Courier', size: 11, numbers: 'no' }, shown: ['86 in Courier', '11.5 KB'] },
      /* Helvetica, numbers off; the output's text read back with pdf.js. */
      /* re-run on 2026-10-06 after Unicode text arrived: the rupee sign and Ł now come back from pdf.js exactly; document.pdf, 1 page, 7,622 bytes; the URL line ends at x 598.7 on a 595.3-wide page */
      { browser: { text: 'Advance: ₹1500 or €18 — paid ½ now, “balance” later. Łódź office.\nhttps://example.com/a/very/long/path/that/has/no/spaces/at/all/so/it/cannot/be/wrapped/anywhere/by/the/line/breaker/index.html (126 characters)', font: 'Helvetica', numbers: 'no', result: 'document.pdf, 1 page, 7.4 KB (7,622 bytes)' }, shown: ['rupee sign included', '7.4 KB', 'off the page'] }
    ]
  },

  '/pdf/watermark-pdf/': {
    term: 'a PDF watermark',
    whatIs: [
      'A watermark on a PDF is a word or image laid across the page to say something about that copy: DRAFT, CONFIDENTIAL, a client’s name. Unlike one in paper, it is simply more drawing on the page.',
      'It can be added as an annotation, which a viewer may hide, or written into the page content, as this tool does. In the content it shows and prints everywhere, yet stays separate, selectable text.'
    ],
    howItWorks: {
      text: 'The site’s own writer copies each page and appends one more content stream after the existing ones, so the watermark is drawn last, on top.',
      points: [
        'The text is set in Helvetica Bold, turned by a text matrix built from the angle’s cosine and sine.',
        'Opacity comes from an `ExtGState` named `MVRgs` whose fill and stroke alpha (`ca`, `CA`) run from 5% to 100%.',
        'Tiled repeats the text in rows over an area three times the page’s width and height, so diagonal rows reach every corner.',
        'The added stream is uncompressed real text, so an editor can delete it whole.'
      ]
    },
    worked: {
      text: 'The 5-page test document (18.7 KB, 200 numbered lines from Text to PDF) was stamped DRAFT at 60 pt, 45°, 15% opacity. Centred, it gained 5 copies, one a page, and grew to 20.4 KB. Tiled, the output was 57.8 KB, about three times the size, because the file holds 385 separate “(DRAFT) Tj” commands, 77 a page, most of them starting off the visible sheet. Every page’s extracted text includes “DRAFT”, so search and copy pick it up too.'
    },
    uses: [
      ['Drafts for comment', 'Stamp DRAFT so nobody mistakes a proposal for the agreed version.'],
      ['Named copies', 'Tile a client’s name across a document so a leaked copy shows its source.'],
      ['File copies', 'Add PAID, VOID or COPY to an invoice kept for the records.']
    ],
    mistakes: [
      'Choosing Bottom of the page for a document with a printed footer. The text sits just above the bottom edge, on top of the footer; use Centre or Tiled there.',
      'Using a long phrase at a large size with Centre. The text is neither wrapped nor shrunk, so “CONFIDENTIAL – NOT FOR DISTRIBUTION” at 60 pt runs off both edges.'
    ],
    faq: [
      { q: 'How do I watermark only some pages of a PDF?', a: 'Type them in Pages, for example 1 or 2-5, 9; the other pages are copied unchanged.' },
      { q: 'Can I use a logo or image as the watermark?', a: 'No, only text, in Helvetica Bold. Colour, angle, a size from 6 to 300 pt and the opacity can all be set.' },
      { q: 'Can I watermark a password-protected PDF?', a: 'Yes, if you know its password: it is asked for when you choose the file. The watermarked copy is saved without a password; add one back with Protect PDF.' }
    ],
    runs: [
      /* Open /pdf/watermark-pdf/, Watermark text DRAFT, Font size 60, Angle 45° diagonal, Opacity 15, Position Centre, Pages all, choose numbered-test-document.pdf (top of this file), press "Add watermark"; count "(DRAFT) Tj" in the download. Then Position "Tiled across the page"; read the page text back with pdf.js. */
      /* Re-measured on 2026-10-04 with the fixed writer, which keeps the Title (before: 20.7 KB and 58.1 KB). */
      /* Re-measured on 2026-10-06, after the watermark font became one object per file instead of one per page: centred 20,918 bytes, 20.4 KB (was 20.9 KB); tiled 59,208 bytes, 57.8 KB (was 58.3 KB), still 385 "(DRAFT) Tj", 77 a page. */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, 200 numbered lines', text: 'DRAFT', size: 60, angle: '45', opacity: 15, position: 'center', pages: 'all', pressed: 'Add watermark' }, shown: ['5 copies', '20.4 KB'] },
      { browser: { input: 'numbered-test-document.pdf', text: 'DRAFT', size: 60, angle: '45', opacity: 15, position: 'tile', pages: 'all' }, shown: ['57.8 KB', '385', '77 a page'] }
    ]
  },

  /*
   * OCR PDF and Image to Text (wave 2). Every figure comes from a run of the
   * page in headless Chrome against a local server of the site. The inputs are
   * the fixtures build/tests/pdf-ocr-tools.js writes: text drawn on canvases in
   * the page (Arial; Nirmala UI for Hindi) and wrapped into PDFs by PyMuPDF.
   *
   *   scan.pdf   2 pages, A4, each one 200 DPI picture, 87,741 bytes (85.7 KB).
   *              Page 1: four lines of English at 42 px ("Scanned letter for
   *              the OCR test" …). Page 2: stored landscape with /Rotate 90 so
   *              it shows upright: "Rotated page with a line in Hindi", "भारत
   *              एक विशाल देश है" (56 px), "Thank you for reading".
   *   small-print.pdf   1 page, a 300 DPI picture drawn by Pillow in Arial: two
   *              pangram lines at each of 5, 6, 7 and 8 pt.
   *   receipt.png (3 lines, 40 px), notice.jpg (2 lines, 44 px, JPEG 0.92),
   *   hindi.png ("आज मौसम बहुत अच्छा है", 60 px), broken.png (56 bytes of text).
   */
  '/pdf/ocr-pdf/': {
    whatTitle: 'What OCR does to a scanned PDF',
    whatIs: [
      'A scanner or phone app saves each page as a photograph inside a PDF. To the file it is only pixels: search finds nothing, and a drag selects the whole picture.',
      'Optical character recognition (OCR) turns the letters in those pixels back into text. A searchable PDF keeps the picture as it was and lays the text over it, invisibly, word by word.'
    ],
    howItWorks: {
      text: 'pdf.js draws each page, Tesseract reads it, and the site’s own PDF writer adds the words, all in your browser.',
      points: [
        'Pages are drawn at 200 or 300 DPI as a viewer shows them, turned by their /Rotate entry, and capped at 16 megapixels.',
        'Tesseract’s LSTM model returns every word with its box, its line’s baseline and a confidence from 0 to 100.',
        'Each word is written in text render mode 3 (`3 Tr`), which paints nothing, on the baseline at its box’s left edge, stretched with `Tz` to the box’s width. Between words goes a real space, so extractors read whole lines.',
        'Hindi is shaped by HarfBuzz and embedded as a Noto Sans Devanagari subset with a ToUnicode map; English uses Helvetica, which embeds nothing.'
      ]
    },
    worked: {
      text: 'A two-page test scan at 200 DPI (85.7 KB), its second page stored sideways with a 90° rotation flag and holding the Hindi line भारत एक विशाल देश है, was read in English and Hindi at 300 DPI: 45 words at a mean confidence of 96%, and the file grew to 90.8 KB. pdf.js and MuPDF both read every line back as drawn, and MuPDF placed each English word within 0.7 pt of the drawn one. On a page of 5 to 8 pt print, 200 DPI added a stray quotation mark; 300 DPI read every character.'
    },
    uses: [
      ['Old paperwork', 'Find scanned letters by a name or reference number.'],
      ['Quoting a clause', 'Copy a paragraph from a scanned contract instead of retyping it.'],
      ['Hindi documents', 'Search a scanned Hindi notice or certificate by its words.']
    ],
    mistakes: [
      'Leaving the language on English for a Hindi page: the test’s Hindi line came back as “URd Up faxna ere”.',
      'Choosing “Recognise them too” for a page with real text: its text is then extracted twice.'
    ],
    faq: [
      { q: 'Why was a page skipped?', a: 'A page counts as having text when pdf.js finds any on it, even a stamped page number. The result lists skipped pages; “Recognise them too” reads them.' },
      { q: 'Can I edit the recognised words in the PDF?', a: 'Not in place: they are an invisible layer for searching and copying. Save the text as a .txt file to work with it.' },
      { q: 'Does it straighten or clean up the scan?', a: 'No. Each page’s picture is carried over byte for byte; only the text layer is added.' }
    ],
    runs: [
      /* Open /pdf/ocr-pdf/, choose scan.pdf (top of this entry), Language "English and Hindi", Pages all, Pages that already have text "Skip them", Resolution 300 DPI, press "Make it searchable". Read the stats and the summary; download and read with pdf.js and MuPDF (build/tests/pdf-ocr-tools.js section 1, which also measures the word boxes: worst 0.66 pt on page 1, 0.60 pt on page 2). */
      { browser: { input: 'scan.pdf, 2 pages, 85.7 KB, page 2 /Rotate 90', lang: 'both', pages: 'all', existing: 'skip', dpi: '300', pressed: 'Make it searchable' }, shown: ['45 words', '96%', '90.8 KB', '0.7 pt'] },
      /* The same file with Language English (section 4 of the test, the run after Cancel): the report's page 2 reads "URd Up faxna ere" for the Hindi line; 44 words, 91%. */
      { browser: { input: 'scan.pdf', lang: 'eng', pages: 'all', existing: 'skip', dpi: '300' }, shown: ['URd Up faxna ere'] },
      /* small-print.pdf at 200 DPI: the report's second line starts with a stray "‘" ("‘Sphinx of black quartz…"); at 300 DPI every line matches. 96 words, 96% both times. */
      { browser: { input: 'small-print.pdf, 1 page, Arial 5, 6, 7 and 8 pt at 300 DPI', lang: 'eng', dpi: '200' }, shown: ['stray quotation mark'] },
      { browser: { input: 'small-print.pdf', lang: 'eng', dpi: '300' }, shown: ['every character'] }
    ]
  },

  '/pdf/image-to-text/': {
    whatTitle: 'What reading text from a picture involves',
    whatIs: [
      'A photo of a page, a screenshot or a scan stores colours, not letters. The words in it cannot be copied, searched or pasted into a document until something recognises them.',
      'That is optical character recognition: finding the shapes of letters and turning them back into characters. What comes out is plain text, the words and their line breaks, without the fonts, sizes or pictures of the original.'
    ],
    howItWorks: {
      text: 'The picture is read by Tesseract, the open-source OCR engine, compiled to WebAssembly and run in a Web Worker in your browser.',
      points: [
        'The browser decodes the file and turns it by its EXIF orientation; transparent areas are read as white paper.',
        'A picture over 16 megapixels is scaled down to 16 first.',
        'Tesseract’s LSTM model reads it line by line and scores every word from 0 to 100; the result shows each picture’s word count and the mean score.',
        'One engine reads every picture in the run and is closed when the run ends, or at once when you press Cancel.'
      ]
    },
    worked: {
      text: 'Two pictures were read as English. receipt.png, three lines of a shop receipt, gave 17 words at a mean confidence of 96%; notice.jpg, a two-line notice saved as JPEG, gave 12 words at 96%. Every character matched what was drawn, and both came back in one image-text.txt with each file’s name above its text. A third file, broken.png, was text renamed as a picture: the run named it and carried on. A Hindi line, आज मौसम बहुत अच्छा है, read as Hindi gave 5 words at 96%, letter for letter.'
    },
    uses: [
      ['Screenshots', 'Copy an error message or a block of figures out of a screenshot.'],
      ['Receipts and notices', 'Turn a photo of a receipt or a notice board into text you can paste.'],
      ['Devanagari text', 'Get Hindi out of a picture without typing it in.']
    ],
    mistakes: [
      'Adding a PDF. This page takes pictures only; OCR PDF reads the pages of a scanned PDF and gives the file back searchable.',
      'Reading Hindi with the language set to English. The same Hindi picture came back as “Sst AA Fed BTS” at 50% mean confidence, against 96% when read as Hindi.'
    ],
    faq: [
      { q: 'What does the confidence figure mean?', a: 'It is Tesseract’s own score, from 0 to 100, of how sure it is of each word, averaged over the picture. It is an estimate rather than a measured error rate, but a low figure is a good sign to check the text against the picture.' },
      { q: 'Does it keep bold, sizes or fonts?', a: 'No. The result is plain text: the words and line breaks only.' },
      { q: 'What about an animated GIF?', a: 'Only its first frame is read, the frame a browser shows before the animation starts.' }
    ],
    runs: [
      /* Open /pdf/image-to-text/, Language English, choose receipt.png, notice.jpg and broken.png (top of the OCR PDF entry), press "Read the text"; read the stats, the warning and the download (build/tests/pdf-ocr-tools.js section 3). */
      { browser: { input: 'receipt.png, notice.jpg, broken.png', lang: 'eng', pressed: 'Read the text' }, shown: ['17 words', '12 words', '96%', 'image-text.txt', 'broken.png'] },
      { browser: { input: 'hindi.png', lang: 'hin' }, shown: ['5 words', '96%'] },
      { browser: { input: 'hindi.png', lang: 'eng' }, shown: ['Sst AA Fed BTS', '50%'] }
    ]
  }
};
