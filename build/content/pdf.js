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
 */
'use strict';

const FORM = 'membership-form.pdf (2 A4 pages, 2.4 KB: 2 bookmarks, a fillable text field, a web link, a link from page 2 to page 1, Title and Author set; see the top of this file)';
const CLUB_INVOICE = 'membership-invoice.pdf, made by /pdf/invoice-pdf/ with from "Riverside Club\\n4 Towpath Walk, Oxford OX1 1AA", to "Sam Whitlock\\n9 Canal Row\\nOxford OX2 6AB", number RC-2026-118, date 2026-10-01, Net 14, items "Annual membership, 1, 120\\nLocker hire (12 months), 12, 4.50", GBP, tax 0 (1 page, 3.1 KB)';

module.exports = {
  '/pdf/merge-pdf/': {
    whatTitle: 'What merging PDFs actually does',
    whatIs: [
      'A PDF is a catalogue of numbered objects. One is the page tree, the pages in order; others belong to the whole file: the outline (bookmarks), the form dictionary that makes boxes fillable, named destinations, page labels and XMP metadata.',
      'Merging writes a new catalogue and decides which of those follow. Annotations (links, comments, the visible boxes of form fields) are stored on each page and can travel with it. Bookmarks and forms belong to a whole file, and two forms may both have a field called “name”, so they do not simply add up.'
    ],
    howItWorks: {
      text: 'The site’s own PDF engine, pdfcore, reads each file and writes the result; pdf.js only draws the preview.',
      points: [
        'Each chosen page is rebuilt from its contents, resources, page boxes, rotation and `Annots`; values it inherited from the old tree are resolved first.',
        'Streams are copied byte for byte, so images and fonts are never re-encoded.',
        'The new catalogue holds only the page tree: no `/Outlines`, no `/AcroForm`, no named destinations, page labels or XMP.',
        'A web link keeps working. A link to another page of the same file points at a copy of its old page, outside the new tree.',
        'No Info dictionary is written unless you keep the first file’s Title, Author, Subject, Keywords, Creator, Producer and dates.'
      ]
    },
    worked: {
      text: 'A club’s two-page membership form (bookmarks, a fillable name field, a web link and a “back to the form” link; 2.4 KB) was merged with a one-page invoice from the site’s generator (3.1 KB), keeping the first file’s metadata. merged.pdf had 3 pages and 5.1 KB. The PDF Inspector counted 3 annotations, and the Title “Membership application” now covered an invoice too. pdf.js found no bookmarks and no form fields: the box was drawn, but nothing declared it a field. With the files swapped, the back link on page 3 jumped to page 1, the invoice.'
    },
    uses: [
      ['Board packs', 'Agenda, minutes and reports as one file.'],
      ['Tender submissions', 'Letter, priced schedule and certificates in the portal’s order.'],
      ['Expense claims', 'Separate receipt PDFs joined behind the claim form.']
    ],
    mistakes: [
      'Merging a form that still needs filling in. The output no longer declares its fields as a form, so fill and save them in a PDF reader first.',
      'Trusting a contents page’s internal links after merging. Click through them before sending.'
    ],
    faq: [
      { q: 'Does merging PDFs reduce quality?', a: 'No. Content, images and fonts are copied without being decoded again, so a scan looks exactly the same.' },
      { q: 'Can I merge password-protected PDFs?', a: 'No. An encrypted file is refused on opening; remove the password in the program that made it.' },
      { q: 'Do hyperlinks still work after merging?', a: 'Web links do; links between pages of one document can land on the wrong page.' }
    ],
    related: { guides: ['/guides/merge-pdf-files/'] },
    runs: [
      /* Merge PDF Files, files added in this order, "Keep metadata from the first file", ranges "all".
         The output was then opened in /pdf/pdf-inspector/ and with the site's pdf.js
         (getOutline, getFieldObjects, getAnnotations, getMetadata). */
      {
        browser: {
          tool: '/pdf/merge-pdf/', files: [FORM, CLUB_INVOICE], controls: { keepMeta: 'first', ranges: 'all' }, pressed: 'Merge PDFs',
          inspector: 'Pages 3, Annotations 3, Metadata: Title Membership application, Author Riverside Club',
          pdfjs: 'getOutline() null, getFieldObjects() null, IsAcroFormPresent false; annotations: Link (URI) and Widget "fullname" on page 1, Link to page 1 on page 2'
        },
        shown: ['2.4 KB', '3.1 KB', '3 pages', '5.1 KB', '3 annotations', 'Membership application']
      },
      /* the same two files in the opposite order (invoice first), metadata stripped: pdf.js
         resolves the form's internal link, now on page 3, to page 1 */
      {
        browser: { tool: '/pdf/merge-pdf/', files: ['membership-invoice.pdf (as above)', 'membership-form.pdf (as above)'], controls: { keepMeta: 'strip' }, result: '3 pages, 5.0 KB', pdfjs: 'Link on page 3: destPage 1' },
        shown: ['page 3', 'page 1']
      }
    ]
  },

  '/pdf/delete-pdf-pages/': {
    whatTitle: 'What deleting a PDF page really removes',
    whatIs: [
      'Deleting pages means writing a new PDF whose page tree leaves them out; your original file is not touched.',
      'A viewer shows only the pages listed in that tree, not every object stored. Whatever a kept page still points at, such as a shared font or an annotation that refers back to the old page tree, can carry other objects across with it.'
    ],
    howItWorks: {
      text: 'Your list is inverted into the pages to keep and passed to the page assembler that merge and extract also use, in the site’s own PDF engine.',
      points: [
        'Spaces are ignored, “10-” runs to the end, “-3” means the first three, and numbers past the last page are skipped.',
        'A list that covers every page is refused, because a PDF must keep at least one.',
        'Kept pages are rebuilt with their contents, resources, page boxes, rotation and annotations. Bookmarks, the form dictionary and the Info metadata are not written.'
      ]
    },
    worked: {
      text: 'A two-page membership form (2.4 KB) had page 2, the payment details, deleted. The output was 1 page and 2.0 KB, and the inspector showed Metadata: none, with the kept page’s 2 annotations intact. Yet searching the file’s bytes found the removed page’s account number, 55779911. The kept page’s annotations name their page, that page names its old parent, and the parent lists both pages, so the writer copied the removed one as an unlisted object. No viewer shows it; anyone reading the raw file can.'
    },
    uses: [
      ['Blank backs from a duplex scan', 'List the even pages of a one-sided letter scanned double-sided.'],
      ['Trimming a statement pack', 'Drop the marketing inserts and terms before sending statements to a lender.'],
      ['Fax header sheets', 'Remove the transmission page from a fax received by email.']
    ],
    mistakes: [
      'Using deletion to hide something confidential. As the example shows, a removed page can stay in the file when a kept page has links or form fields; export only the wanted pages from the source program instead.',
      'Trimming a form you still have to submit. The output no longer declares the fields as a form, so send the form first.'
    ],
    faq: [
      { q: 'Does deleting pages make a PDF smaller?', a: 'Usually, by about the share those pages held. Fonts and images shared with kept pages stay, and so can a page that a kept one links to.' },
      { q: 'How do I delete every other page?', a: 'List them, as “2, 4, 6, 8” for an eight-page scan; there is no step syntax.' },
      { q: 'Will the page numbers printed on the remaining pages change?', a: 'No. Printed numbers are part of each page’s drawing, so they keep their gaps; Add Page Numbers can stamp a fresh sequence.' }
    ],
    runs: [
      /* Delete PDF Pages on membership-form.pdf, pages "2", Delete pages; the output opened in
         /pdf/pdf-inspector/; then its bytes searched (latin1) for "55779911" */
      {
        browser: { tool: '/pdf/delete-pdf-pages/', file: FORM, controls: { pages: '2' }, pressed: 'Delete pages', result: 'form-trimmed.pdf, 1 page, 2.0 KB', inspector: 'Pages 1, Objects 13, Annotations 2, Metadata none', search: 'the bytes contain "55779911"; 3 objects of /Type /Page against 1 listed page' },
        shown: ['2.4 KB', '1 page', '2.0 KB', 'Metadata: none', '2 annotations', '55779911']
      }
    ]
  },

  '/pdf/extract-pdf-pages/': {
    whatTitle: 'What extracting PDF pages means',
    whatIs: [
      'Extracting pages makes a new PDF from a selection of another one’s pages, in the order you choose: the opposite of deleting, and a split with a single output.',
      'A page is drawing instructions plus the fonts and images it calls on, so it looks exactly as before. Anything defined for the whole document stays behind: bookmarks, the fillable form, page labels such as “iv”, and the title and author.'
    ],
    howItWorks: {
      text: 'The selection becomes a list of page numbers, as typed unless you choose sorted or reversed, and the site’s own PDF engine writes a file from it.',
      points: [
        'A page may be listed more than once; the copies share one content stream, so repeats cost very little.',
        'Contents, fonts and images are copied without decoding, so text stays selectable and scans keep their sharpness.',
        'Rotation, page boxes and annotations come across. The outline, the form dictionary and the Info metadata do not.'
      ]
    },
    worked: {
      text: 'A three-page merged file, a two-page form followed by an invoice, was cut with “3, 1” left as listed: the invoice came first and the form’s opening page second, 2 pages and 4.8 KB. Sorted, the same selection came out as “1, 3”. Separately, a one-page invoice of 3.1 KB extracted as “1, 1, 1” gave three identical pages in 3.4 KB, since all three page entries share one content stream.'
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
      /* Extract PDF Pages on the 3-page merged.pdf from the merge run (form pages 1-2, invoice page 3), pages "3, 1", order As listed */
      { browser: { tool: '/pdf/extract-pdf-pages/', file: 'merged.pdf (3 pages, 5.1 KB, from the /pdf/merge-pdf/ run recorded on that page)', controls: { pages: '3, 1', order: 'asis' }, pressed: 'Extract pages' }, shown: ['2 pages', '4.8 KB'] },
      /* the same, order Sorted by page number: Page order "1, 3", 4.8 KB */
      { browser: { tool: '/pdf/extract-pdf-pages/', file: 'merged.pdf', controls: { pages: '3, 1', order: 'sorted' } }, shown: ['1, 3'] },
      /* Extract PDF Pages on membership-invoice.pdf, pages "1, 1, 1", As listed: 3 pages, 3.4 KB */
      { browser: { tool: '/pdf/extract-pdf-pages/', file: CLUB_INVOICE, controls: { pages: '1, 1, 1', order: 'asis' } }, shown: ['3.1 KB', '3.4 KB'] }
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
      text: 'Chrome’s print to PDF (version 154, A4) turned the site’s merge guide into a 441.8 KB file. The inspector read 4 pages at 596 × 842 pt (210 × 297 mm), 1041 objects and 22 annotations, the guide’s links. The metadata held the page title, the full HeadlessChrome browser string as Creator, Skia/PDF m154 as Producer and the creation time to the second. Distinct fonts said “none found” on pages full of text: Chrome wrote every font as Type 3, drawn glyph by glyph with no name to list.'
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
         All 60 font resources in the file are Subtype /Type3 with no /BaseFont. */
      {
        browser: { tool: '/pdf/pdf-inspector/', file: 'merge-guide-chrome.pdf: Chrome 154 Save as PDF of /guides/merge-pdf-files/, A4, printBackground true', creator: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.' },
        shown: ['441.8 KB', '4 pages', '596 × 842 pt (210 × 297 mm)', '1041', '22 annotations', 'Skia/PDF m154', 'none found']
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
        'Each chosen page gets a new content stream and a font entry, `MVRedit`, for Helvetica: one of the standard 14 fonts readers supply, so nothing is embedded.',
        'Text is mapped to WinAnsi, which covers Western European letters, curly quotes, dashes and €; most characters outside it become question marks.',
        'The file is rebuilt by the assembler merge uses, which drops the bookmarks, the form dictionary, the title and the author.'
      ]
    },
    worked: {
      text: 'A two-page membership form with a real fillable name field (2.4 KB) got two items: “Sam Whitlock” at X 156, Y 698 on page 1, inside the field’s box, and “Paid by card on 1 October 2026” at X 72, Y 600 on page 2. The run showed 2 pages written to, 2 items placed and 2 lines written, and the file grew to 2.7 KB. pdf.js found both phrases as selectable text, but no form fields and no title: the name was drawn on the page, not entered into the field.'
    },
    uses: [
      ['Reference numbers', 'Stamp a purchase-order number on every page before filing.'],
      ['Marking an invoice paid', 'Add the date and method so the filed copy shows it was settled.'],
      ['Exhibit labels', 'Write “Exhibit B” at the top of each page for a court bundle.']
    ],
    mistakes: [
      'Typing over a real form field. Fill a fillable PDF in a PDF reader: text added here sits on the page, and the output no longer declares a form.',
      'Expecting to delete the note later. It becomes part of the page drawing, so keep the original.'
    ],
    faq: [
      { q: 'Will the text I add be searchable?', a: 'Yes: it is real text, so it can be selected, searched and copied.' },
      { q: 'Why did my PDF’s title disappear after adding text?', a: 'The edited file is written fresh and the Info dictionary is not copied. Set the title again with the PDF Metadata tool.' },
      { q: 'Does adding text break a digital signature?', a: 'Yes. The file is rewritten from scratch, which invalidates a signature, and the rewrite drops the form dictionary that signature fields belong to.' }
    ],
    runs: [
      /* Add Text to a PDF on membership-form.pdf: item 1 typed (text "Sam Whitlock", size 12, X 156,
         Y 698, Pages 1, wrap 0) and banked with "Add as another item"; item 2 typed (text "Paid by
         card on 1 October 2026", size 12, X 72, Y 600, Pages 2); Add text pressed. The output was
         read with pdf.js: getTextContent, getFieldObjects (null), getMetadata (no Title). */
      {
        browser: { tool: '/pdf/pdf-editor/', file: FORM, items: [{ text: 'Sam Whitlock', size: 12, x: 156, y: 698, pages: '1' }, { text: 'Paid by card on 1 October 2026', size: 12, x: 72, y: 600, pages: '2' }], pressed: ['Add as another item', 'Add text'], result: 'form-edited.pdf, 2 pages, 2.7 KB' },
        shown: ['2.4 KB', '2 pages written to', '2 items placed', '2 lines written', '2.7 KB']
      }
    ]
  },

  '/pdf/invoice-pdf/': {
    term: 'an invoice',
    whatIs: [
      'An invoice is a seller’s request for payment: who is billing whom, for what, how much and by when. It is the record both sides keep and, between VAT-registered businesses, what the buyer needs to reclaim the VAT.',
      'What the law adds depends on the country and the tax, so registration numbers and similar identifiers are yours to type into the business block.'
    ],
    howItWorks: {
      text: 'One A4 page is drawn by the site’s own PDF writer in Helvetica, a font readers supply themselves, so nothing is embedded.',
      points: [
        'Item lines are split at commas and read from the right: unit price last, quantity before it, description the rest.',
        'Tax is the rate applied once to the subtotal, not line by line, and every sum shows two decimals.',
        'The due date is the invoice date plus the payment terms in calendar days.',
        'Text uses the WinAnsi character set: £, € and $ print but the rupee sign cannot, so INR shows as “Rs”.',
        'The file’s Title is “Invoice” plus your number; its Author is the first line of your business details.'
      ]
    },
    worked: {
      text: 'A stationery supplier billed a school for laminating pouches at £12.53, two packs of sticky labels at £3.74 and rubber bands at £3.33. The subtotal was £23.34, VAT at 20% was £4.67 and the total due £28.01. Invoiced one line at a time, the same items gave VAT of £2.51, £1.50 and £0.67, a penny more between them, because each line is then rounded on its own. With Net 7 terms from 2 October 2026, the due date was 9 October 2026, and the PDF was 1 page and 3.6 KB.'
    },
    uses: [
      ['Clubs and societies', 'Subscriptions or hall hire, with tax at 0 when the club is not VAT-registered.'],
      ['A lost copy', 'Recreate an invoice with its original number and date.'],
      ['Overseas clients', 'Bill in euros or dollars; the currency sign changes, the sums do not.']
    ],
    mistakes: [
      'Typing a thousands separator in a price. “Consulting, 1, 1,200” is read as quantity 1 at 200, because commas separate the fields; type 1200.',
      'Pasting characters outside Western European text, such as ₹ or Polish ł, into an address or note. They print as question marks.'
    ],
    faq: [
      { q: 'What is the difference between an invoice and a receipt?', a: 'An invoice asks to be paid; a receipt confirms payment. To mark one of these invoices settled, add “Paid in full” and the date in the notes.' },
      { q: 'What does Net 30 mean on an invoice?', a: 'Payment is due 30 days after the invoice date; the tool prints that due date for you.' },
      { q: 'Can I add my logo to the invoice?', a: 'No. The page is built from text, lines and filled boxes only, so print it on headed paper instead.' }
    ],
    related: { guides: ['/guides/chase-unpaid-invoices/'] },
    runs: [
      /* Invoice Generator: the fields below set, Create PDF pressed */
      {
        browser: { tool: '/pdf/invoice-pdf/', controls: { from: 'Inkwell Stationers\n7 Bridge Street, Hereford HR4 9DG', to: 'Castle Primary School\nSchool Office\nHereford HR1 2NN', number: 'INK-1907', date: '2026-10-02', due: '7', currency: 'GBP', tax: 20, taxLabel: 'VAT', items: 'Laminating pouches A4 (pack of 100), 1, 12.53\nSticky labels, 2, 3.74\nRubber bands, 1, 3.33', notes: 'Bank transfer to Inkwell Stationers, sort code 40-11-22.' } },
        shown: ['£23.34', '£4.67', '£28.01', '9 October 2026', '1 page', '3.6 KB']
      },
      /* the same invoice with one line at a time in Line items (other fields as above): VAT 20% each time */
      { browser: { tool: '/pdf/invoice-pdf/', items: 'Laminating pouches A4 (pack of 100), 1, 12.53' }, shown: ['£2.51'] },
      { browser: { tool: '/pdf/invoice-pdf/', items: 'Sticky labels, 2, 3.74' }, shown: ['£1.50'] },
      { browser: { tool: '/pdf/invoice-pdf/', items: 'Rubber bands, 1, 3.33' }, shown: ['£0.67'] }
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
      'In India, Rule 55 of the CGST Rules, 2017 sets its contents: number and date; names, addresses and GSTINs of the consignor and (if registered) the consignee; HSN code, description and quantity; taxable value; and a signature. A supply to the consignee also needs the tax rate and amount, and an inter-state movement the place of supply.'
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
      { q: 'Which Avery sheets do these layouts match?', a: 'By size and count, 3 × 7 matches Avery L7160, 2 × 8 matches L7162 and 2 × 7 matches L7163. Margins vary a little, so print a test sheet first.' },
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
        'Every page is copied into a fresh document with a new catalogue, so the XMP stream and whatever else hung off the old one is left behind.',
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
      { q: 'Does stripping metadata also remove bookmarks?', a: 'Yes, as a side effect. The new catalogue has no outline and no form structure, so keep the original if you need either.' }
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
      text: 'This tool must draw your pages before you change anything, so the first press loads pdf.js, Mozilla’s open-source renderer, from this site’s own copy.',
      points: [
        'pdf.js renders every page onto a small canvas at 28% of its size; each card has buttons to move it earlier or later, turn it 90° clockwise or mark it for removal.',
        'There is no dragging: a page moves one place per press, and each press redraws the whole grid.',
        'Build hands the kept pages, in grid order, to the site’s own writer, `pdfcore`. A turn is added to any `/Rotate` the page already had; nothing is re-rendered.'
      ]
    },
    worked: {
      text: 'A 5-page, 18.7 KB test file (200 numbered lines from Text to PDF) had page 2 marked for removal, page 4 turned once and page 5 moved one place earlier. The grid read 1, 2, 3, 5, 4 and the stats 4 kept, 1 removed, 1 rotated. The built file had 4 pages in 14.4 KB, its last page the old page 4 on its side. Its extracted text still begins “Line 142”, because the turn is a flag, not a picture.'
    },
    uses: [
      ['Fixing a merged pack', 'Put a covering letter back in front of its attachments.'],
      ['Blank scanned sides', 'Remove the empty backs a duplex scanner adds, seeing each one before it goes.'],
      ['Mixed scans', 'Turn the odd landscape page upright without touching the others.']
    ],
    mistakes: [
      'Trying to drag a thumbnail. Moving page 30 to the front takes 29 presses of its arrow; for long moves, split the file and merge the parts in the new order.',
      'Opening a document of several hundred pages. Every thumbnail is drawn on opening and again after each click, which costs memory and time.'
    ],
    faq: [
      { q: 'Does reordering PDF pages reduce quality?', a: 'No. The thumbnails are only for choosing; the saved file reuses each page’s content stream and images byte for byte.' },
      { q: 'Can I undo a page I marked for removal?', a: 'Yes. It stays in the grid, shown as dropped, with a restore button, until you build the file.' },
      { q: 'Do bookmarks survive reorganising?', a: 'No. The rebuilt file has a new catalogue, so the outline and any form structure are not carried over.' }
    ],
    related: { guides: ['/guides/merge-pdf-files/'] },
    runs: [
      /* Open /pdf/pdf-organise/, choose numbered-test-document.pdf (top of this file), press "Show the pages"; on card 2 press "Remove this page", on card 4 "Rotate 90°", on card 5 "Move earlier"; read the order and stats, press "Build reorganised PDF", save the download and read its text with pdf.js. */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, 200 numbered lines', pressed: ['Show the pages', 'card 2: Remove this page', 'card 4: Rotate 90°', 'card 5: Move earlier', 'Build reorganised PDF'] }, shown: ['1, 2, 3, 5, 4', '4 kept, 1 removed, 1 rotated', '4 pages in 14.4 KB', 'Line 142'] }
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
        'The spot is worked out on the page’s unrotated `MediaBox`; `/Rotate` and any crop box are ignored.',
        'Nothing is flattened: the label is real text in a font resource named `MVRpn`, and the original text stays searchable.'
      ]
    },
    worked: {
      text: 'A 5-page report whose first page is a cover (the test file from Text to PDF, its own numbering off) was numbered in the “Page 1 of 10” style, skipping 1 page and starting at 1. Pages numbered: 4. The output’s text reads “Page 1 of 4” on the second sheet and “Page 4 of 4” on the last, each 32 points above the bottom edge, centred: the total counts numbered pages only. The file grew from 18.7 KB to 19.8 KB.'
    },
    uses: [
      ['Dissertations', 'Number the body of a thesis exported without page numbers, leaving the title page bare.'],
      ['Meeting papers', 'Add “Page n of m” after merging papers so a missing sheet shows at once.'],
      ['Scanned agreements', 'Number a scanned contract so cross-references can point at a page.']
    ],
    mistakes: [
      'Numbering pages that carry a /Rotate value. On a page turned 90°, a bottom-centre number lands halfway up the left edge, reading sideways; check such pages in the preview.',
      'Using a long header at a large size. It is centred but never wrapped, so a line wider than the page runs off both sides.'
    ],
    faq: [
      { q: 'How do I start page numbering on page 3 of a PDF?', a: 'Set Skip first N pages to 2 and Start numbering at 1; the third page then shows 1.' },
      { q: 'Are added page numbers searchable?', a: 'Yes. They are real Helvetica text, so they can be selected, copied and found with a viewer’s search.' },
      { q: 'Will my viewer’s page counter match the printed numbers?', a: 'Not when you skip pages. No page labels are written, so the viewer still calls the cover page 1.' }
    ],
    runs: [
      /* Open /pdf/pdf-page-numbers/, set Format "Page 1 of 10", Position "Bottom centre", Start numbering at 1, Skip first N pages 1, choose numbered-test-document.pdf (top of this file), press "Add page numbers"; read the output's text and positions with pdf.js (label baseline at y = 32 pt). */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, Text to PDF with numbers off', format: 'page-n-of-t (label "Page 1 of 10")', position: 'bc', start: 1, skip: 1, size: 10, pressed: 'Add page numbers' }, shown: ['Pages numbered: 4', 'Page 1 of 4', 'Page 4 of 4', '32 points', '19.8 KB'] }
    ]
  },

  '/pdf/pdf-signature/': {
    whatTitle: 'What “signing” a PDF here actually does',
    whatIs: [
      'Two different things are called signing a PDF. A visible signature is marks on the page, such as a typed name or a scanned autograph. A cryptographic digital signature is a field stored in the file, with a /ByteRange entry and a certificate-based signature over those bytes, so any later change can be detected.',
      'This tool makes the first kind only, as typed Helvetica text with an optional date; there is no drawing pad and no image. Whether that is acceptable depends on the law that applies and what the other party accepts.'
    ],
    howItWorks: {
      text: 'The signature is drawn into the page by the site’s own PDF writer; no keys or certificates are involved.',
      points: [
        'pdf.js, from this site’s own copy, draws the page so a click sets X and Y, in points from the bottom left.',
        'Each selected page gets an extra content stream drawing your text in 11-point black Helvetica, plus “Date:” and your device’s date 14 points lower if the date is on.',
        'No `/Sig` field, `/ByteRange` or certificate is written, so the file holds nothing a signature validator could check.'
      ]
    },
    worked: {
      text: 'The 2-page quotation from this site’s Quotation tool was signed “For Acme Interiors: R. Shah”, date on, X 330, Y 150, Pages “last”. The stats read 2 pages, 1 signed, and the file went from 11,463 to 11,620 bytes. Page 2’s extracted text holds the name as an ordinary line and “Date: 4 October 2026” 14 points below it, so any editor can select or delete it. A byte search of the output finds no /ByteRange and no /Sig entry.'
    },
    uses: [
      ['Internal approvals', 'Mark an expense claim approved by a named manager.'],
      ['Simple forms', 'Add your name and date where a form asks only for a signature line.'],
      ['Delivery notes', 'Add “Received by” and a name before filing.']
    ],
    mistakes: [
      'Setting X to 0 for the very left edge. A zero is read as empty and the text lands at the default 400 points; use 1 or more.',
      'Signing with letters the standard font lacks. Ł, ś or Devanagari print as “?”, so check the preview first.'
    ],
    faq: [
      { q: 'Is a typed name on a PDF a valid signature?', a: 'That depends on the jurisdiction, the document and what the other side accepts, not on this tool. For proof of who signed and that nothing changed since, use a certificate-based signing service.' },
      { q: 'How can I tell whether a PDF is digitally signed?', a: 'A signed file shows a signature panel or banner in viewers such as Adobe Acrobat Reader. A file from this tool shows none: it has no signature field.' },
      { q: 'Does the date update when the file is opened later?', a: 'No. It is your device’s date when you pressed the button, written as fixed text.' }
    ],
    runs: [
      /* Open /pdf/pdf-signature/, set Signature text "For Acme Interiors: R. Shah", Include date Yes, X 330, Y 150, Pages "last", choose quotation-qt-0001.pdf (top of this file), press "Add signature" on 4 October 2026; save the download, read page 2's text with pdf.js and search its bytes for /ByteRange and /Sig. */
      { browser: { input: 'quotation-qt-0001.pdf, 2 pages, 11,463 bytes', signatureText: 'For Acme Interiors: R. Shah', date: 'yes', x: 330, y: 150, pages: 'last', pressed: 'Add signature', runDate: '2026-10-04' }, shown: ['2 pages, 1 signed', '11,620 bytes', 'Date: 4 October 2026', '14 points below'] }
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

  '/pdf/purchase-order-pdf/': {
    term: 'a purchase order',
    whatIs: [
      'A purchase order, or PO, is the buyer’s written order to a supplier: what is wanted, how many, at what price, where and by when, and on what terms. Its number lets invoices and delivery papers be matched back to it.',
      'This tool adds the supplier’s quotation reference, freight lines, GST or UK VAT, an Incoterms 2020 term and an inspection clause. It lays out and adds up what you enter; whether the terms suit your contract is your call.'
    ],
    howItWorks: {
      text: 'The order is calculated and typeset by the page’s script, then written by `createPDF` in the site’s PDF engine.',
      points: [
        'Item lines are read from the right: rate, an optional unit word, quantity, then a 4–8 digit HSN/SAC code; the rest is the description.',
        'Charges join the discounted goods total as the taxable value, and one VAT or GST rate is applied to it, split into CGST and SGST for an intra-state order.',
        'Amounts stay unrounded; only the committed value follows the Round the total setting.'
      ]
    },
    worked: {
      text: 'A UK print studio orders paper: 40 reams at £38.50 and 25 at £29.90 less 5%, a £65.00 pallet delivery, VAT 20%, no rounding, DAP Harlow CM20 2BN. The tool shows goods of £2,287.50, a discount of -£37.38, taxable value £2,315.13, VAT £463.02 and a committed value of £2,778.15 on 2 pages. Note the penny: the printed lines add up to £2,315.12, but the discount is really £37.375 and the tool keeps the half-penny. With the named place emptied, the term prints as “DAP — Delivered At Place” and a warning says the Incoterm is incomplete.'
    },
    uses: [
      ['Site and project orders', 'Put the price, address and date agreed by phone in writing.'],
      ['Small firms', 'Number every order so invoices can be matched to it.'],
      ['Imports', 'State an Incoterm with its place so carriage and risk are settled.']
    ],
    mistakes: [
      'Typing thousands separators inside an item line. The line is split at commas, so “Chequered plate, 38, Sqm, 2,650” is silently read as 2 at 650; write 2650.',
      'Expecting the GST rate box to change VAT. The UK VAT choices use fixed rates of 20%, 5% and 0%.'
    ],
    faq: [
      { q: 'What does DAP mean on a purchase order?', a: 'Delivered At Place, an Incoterms 2020 rule: the supplier brings the goods to the named place, ready for unloading, while import clearance and duties stay with the buyer.' },
      { q: 'Is a PO number the same as an invoice number?', a: 'No. The PO number is the buyer’s; the supplier’s invoice has its own number and should quote the PO number.' },
      { q: 'Can I make a purchase order in pounds or euros?', a: 'Yes. The £ and € signs print, and the value in words uses pounds and pence or euros and cents.' }
    ],
    related: { guides: ['/guides/calculate-gst/'] },
    runs: [
      /* Open /pdf/purchase-order-pdf/, set the fields below (all others left at their defaults), press "Create PDF". The note is a hand check of the printed lines, not a tool figure. */
      { browser: { fields: { buyerName: 'Harlow Print Studio Ltd', buyerAddress: 'Unit 4, Edinburgh Way\nHarlow CM20 2BN', buyerTax: '', buyerContact: '01279 000000  ·  orders@harlowprint.example', supplierName: 'Fenwick Paper Supplies Ltd', supplierAddress: '22 Mill Lane\nChelmsford CM1 1AA', supplierTax: '', number: 'HPS-PO-118', date: '2026-10-04', quoteRef: 'FPS-Q-2291', requiredBy: '2026-10-16', sameAddress: 'same', items: 'SRA3 silk paper 170 gsm, 40, Ream, 38.50\nSRA3 uncoated 120 gsm, 25, Ream, 29.90, 5%', charges: 'Pallet delivery, 65', currency: 'GBP', taxMode: 'vat20', rounding: 'none', incoterm: 'DAP', incotermPlace: 'Harlow CM20 2BN' }, pressed: 'Create PDF', note: 'printed lines: 2,287.50 - 37.38 + 65.00 = 2,315.12; unrounded discount 747.50 x 5% = 37.375' }, shown: ['£2,287.50', '-£37.38', '£65.00', '£2,315.13', '£463.02', '£2,778.15', '2 pages'] },
      /* The same with "Named place or port" emptied. */
      { browser: { fields: 'as above, incotermPlace: ""', pressed: 'Create PDF' }, shown: ['DAP — Delivered At Place', 'Incoterm is incomplete'] }
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
        'If the two GSTINs begin with different two-digit state codes while intra-state is chosen, the tool warns but prints your choice.'
      ]
    },
    worked: {
      text: 'A Hubballi fabricator (GSTIN beginning 29) sends a Pune warehouse (27) a proforma invoice: a mezzanine structure at Rs 4,85,000, 38 Sqm of chequered plate at Rs 2,650 less 3%, and installation at Rs 64,500. On intra-state GST at 18% the tool warns that different state codes usually mean IGST. Switched to inter-state: taxable value Rs 6,47,179.00, IGST 18% Rs 1,16,492.22, total Rs 7,63,671.00 rounded to the rupee, or Rs 7,63,671.22 unrounded. The 2 pages are valid for 15 days and state that this is not a tax invoice.'
    },
    uses: [
      ['Contractors', 'Quote materials and labour with HSN and SAC codes.'],
      ['Advance payment', 'Send a proforma so a new buyer can pay before supply.'],
      ['UK trades', 'Price a kitchen fit in pounds with VAT at 20% on its own line.']
    ],
    mistakes: [
      'Writing a rate as 4,85,000 inside an item line. Commas separate the fields, so the number is taken apart and the line mispriced without any error; type 485000.',
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
      { browser: { fields: 'as above, taxMode: gst-inter, rounding: none', pressed: 'Create PDF' }, shown: ['Rs 7,63,671.22'] }
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
      text: 'The 5-page, 18.7 KB test document (200 numbered lines from Text to PDF) had pages 2-3 turned 90° clockwise. The stats show 2 pages rotated; the output, 19,114 bytes against 19,177 in, contains exactly two “/Rotate 90” entries, and all five content streams match the original byte for byte. Running it again with page 2 at 270 brought that page back upright: 90 + 270 is 360, so the entry disappears, while page 3 still reports 90 and opens as an 841.89 × 595.28 landscape view.'
    },
    uses: [
      ['Sideways phone scans', 'Turn receipts a scanning app saved on their side before uploading them.'],
      ['Wide tables in a portrait report', 'Rotate only the landscape pages so they read correctly on screen.'],
      ['Upside-down feeder pages', 'Fix sheets a document feeder took in the wrong way round with 180°.']
    ],
    mistakes: [
      'Typing the pages as “2 to 3” or “p2”. Use digits with hyphens and commas, such as 2-3, 7; anything else stops with an error naming the part it could not read.',
      'Expecting the document properties to survive. The rotated copy is a rebuilt file without the original’s Title or Author; set them again with the metadata tool.',
      'Picking 90° when the page leans the other way. A page whose top points to the right needs 270, the anticlockwise option.'
    ],
    faq: [
      { q: 'How do I rotate just one page of a PDF?', a: 'Type that page’s number in Pages, choose the angle and press Rotate pages; every other page is copied unchanged.' },
      { q: 'Can I rotate a PDF page by 45 degrees?', a: 'No. The rotation entry accepts only multiples of 90.' },
      { q: 'Does rotating make the PDF bigger?', a: 'Barely. Each turned page gains one short entry; in the run above the output was even slightly smaller, because the document’s Title was not carried over.' }
    ],
    runs: [
      /* Open /pdf/rotate-pdf/, Rotate by "90° clockwise", Pages "2-3", choose numbered-test-document.pdf (top of this file), press "Rotate pages"; count "/Rotate 90" in the download and compare its stream bodies with the input's. */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, 19,177 bytes, 200 numbered lines', angle: '90', pages: '2-3', pressed: 'Rotate pages' }, shown: ['2 pages rotated', '19,114 bytes', 'two “/Rotate 90” entries'] },
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
        'For each group, `pdfcore` copies every page with the objects it refers to (content, fonts, images, annotations), renumbered into a fresh file.',
        'Title, Author and other document information, bookmarks and form structure stay behind; parts are named after the source with their page span, such as `-p3-4`.',
        'Up to 500 files can be made at once, and two or more can be saved together as a ZIP built in the page.'
      ]
    },
    worked: {
      text: 'The 5-page test document from Text to PDF (18.7 KB, titled “Numbered test document”) split Every 2 pages gave 3 files: pages 1-2 and 3-4 at 9,072 bytes each, and page 5, holding only lines 189 to 200, at 1,633 bytes, 19.3 KB in total. Split in half it gave pages 1-3 and 4-5, 19.0 KB together. Loading the first part into the metadata tool found none: the title stayed behind in the original.'
    },
    uses: [
      ['Separating a scanned batch', 'Turn one long scan of two-page forms into one file per form.'],
      ['Email size limits', 'Cut a large manual into chapters that each fit under an attachment cap.'],
      ['Sending only the relevant part', 'Give a contractor the drawings from a tender pack without the pricing pages.']
    ],
    mistakes: [
      'Putting commas between ranges. A comma joins pages into the same group, so “1-3, 4-6” makes a single six-page file; separate groups with |.',
      'Splitting a fillable form and expecting the fields to work. The form structure is not carried over, so fill and save the form first.'
    ],
    faq: [
      { q: 'How do I split a PDF into single pages?', a: 'Choose One file per page. A 30-page file gives 30 PDFs named from -p1 to -p30, downloadable together as a ZIP.' },
      { q: 'Can I split a PDF by file size?', a: 'Not directly. Split by page count, look at the size listed for each part and adjust N; pages with photographs weigh far more than text.' },
      { q: 'Can one page go into two of the split files?', a: 'Yes, with explicit ranges: “1-3 | 3-5” puts page 3 in both files.' }
    ],
    related: { guides: ['/guides/merge-pdf-files/'] },
    runs: [
      /* Open /pdf/split-pdf/, Split "Every N pages", Pages per file 2, choose numbered-test-document.pdf (top of this file), press "Split PDF"; note each file's byte size. Then Split "In half". Then load the p1-2 part into /pdf/pdf-metadata/ and press its button. */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, title "Numbered test document", page 5 holds lines 189-200', mode: 'every', n: 2, pressed: 'Split PDF' }, shown: ['9,072 bytes', '1,633 bytes', '19.3 KB'] },
      { browser: { input: 'numbered-test-document.pdf', mode: 'half' }, shown: ['19.0 KB'] },
      { browser: { input: 'numbered-test-document-p1-2.pdf from the first run, opened in /pdf/pdf-metadata/', action: 'strip' }, shown: ['found none'] }
    ]
  },

  '/pdf/text-to-pdf/': {
    whatTitle: 'What turning plain text into a PDF involves',
    whatIs: [
      'Plain text has characters and line breaks but no page. To become a PDF it must be typeset: broken into lines that fit a measured width, gathered into pages and drawn in a font the viewer can show.',
      'The PDF standard names 14 base fonts that readers have long been expected to provide, Helvetica, Times and Courier among them. Using only those means no font data in the file, but only the characters their WinAnsi encoding holds.'
    ],
    howItWorks: {
      text: 'Your text is laid out by the page’s own script and written by `createPDF` in the site’s engine; no font file is fetched or embedded.',
      points: [
        'Each paragraph is wrapped word by word, using the font’s character widths at the chosen size, within the page width less both margins.',
        'Each line becomes a `Tj` command in WinAnsi: curly quotes, dashes, € and ½ have their own codes; anything else becomes “?”.',
        'A Document title goes into the file’s Title property and its name, not onto the page.'
      ]
    },
    worked: {
      text: 'Take 1,200 words written as 200 short numbered sentences. One sentence per line on A4 at 11 pt fills 200 lines over 5 pages (47 lines a page, 18.7 KB). Joined into one paragraph, they wrap to 67 lines in Helvetica, 58 in Times and 86 in Courier, 2 pages each, at 10.6 KB, 10.1 KB and 11.5 KB. In a second test, “Advance: ₹1500 or €18 — paid ½ now” kept the euro sign, the dash and the half, but the rupee sign came out as “?”, and a 126-character URL with no spaces ran past the margin and off the page.'
    },
    uses: [
      ['Claim forms', 'Turn a written statement into the PDF an upload form demands.'],
      ['Printed notes', 'Set long notes large, with generous spacing, for reading on paper.'],
      ['Records', 'Keep a paginated copy of an email or transcript with other PDFs.']
    ],
    mistakes: [
      'Pasting indented or column-aligned text. Runs of spaces and tabs shrink to one space when lines are wrapped, so code, tables and verse lose their layout, even in Courier.',
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
      { browser: { text: 'Advance: ₹1500 or €18 — paid ½ now, “balance” later. Łódź office.\nhttps://example.com/a/very/long/path/that/has/no/spaces/at/all/so/it/cannot/be/wrapped/anywhere/by/the/line/breaker/index.html (126 characters)', font: 'Helvetica', numbers: 'no' }, shown: ['came out as “?”', 'off the page'] }
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
      text: 'The 5-page test document (18.7 KB, 200 numbered lines from Text to PDF) was stamped DRAFT at 60 pt, 45°, 15% opacity. Centred, it gained 5 copies, one a page, and grew to 20.7 KB. Tiled, the output was 58.1 KB, about three times the size, because the file holds 385 separate “(DRAFT) Tj” commands, 77 a page, most of them starting off the visible sheet. Every page’s extracted text includes “DRAFT”, so search and copy pick it up too.'
    },
    uses: [
      ['Drafts for comment', 'Stamp DRAFT so nobody mistakes a proposal for the agreed version.'],
      ['Named copies', 'Tile a client’s name across a document so a leaked copy shows its source.'],
      ['File copies', 'Add PAID, VOID or COPY to an invoice kept for the records.']
    ],
    mistakes: [
      'Stamping a page that carries a /Rotate value. The angle and centre are worked out on the unrotated page, so on a page turned 90° a horizontal watermark shows as vertical.',
      'Using a long phrase at a large size with Centre. The text is neither wrapped nor shrunk, so “CONFIDENTIAL – NOT FOR DISTRIBUTION” at 60 pt runs off both edges.'
    ],
    faq: [
      { q: 'How do I watermark only some pages of a PDF?', a: 'Type them in Pages, for example 1 or 2-5, 9; the other pages are copied unchanged.' },
      { q: 'Can I use a logo or image as the watermark?', a: 'No, only text, in Helvetica Bold. Colour, angle, a size from 6 to 300 pt and the opacity can all be set.' },
      { q: 'Can I watermark a password-protected PDF?', a: 'No. Encrypted files are refused on opening; remove the password in the program that set it first.' }
    ],
    runs: [
      /* Open /pdf/watermark-pdf/, Watermark text DRAFT, Font size 60, Angle 45° diagonal, Opacity 15, Position Centre, Pages all, choose numbered-test-document.pdf (top of this file), press "Add watermark"; count "(DRAFT) Tj" in the download. Then Position "Tiled across the page"; read the page text back with pdf.js. */
      { browser: { input: 'numbered-test-document.pdf, 5 pages, 18.7 KB, 200 numbered lines', text: 'DRAFT', size: 60, angle: '45', opacity: 15, position: 'center', pages: 'all', pressed: 'Add watermark' }, shown: ['5 copies', '20.7 KB'] },
      { browser: { input: 'numbered-test-document.pdf', text: 'DRAFT', size: 60, angle: '45', opacity: 15, position: 'tile', pages: 'all' }, shown: ['58.1 KB', '385', '77 a page'] }
    ]
  }
};
