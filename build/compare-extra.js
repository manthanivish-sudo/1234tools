/**
 * Comparisons, second batch.
 *
 * Same shape and same three rules as build/compare.js, kept in its own file
 * so it can be written and reviewed without touching the seven already
 * shipped. The loader at the bottom of build/compare.js concatenates these
 * onto its own list, merges REF and COMPETITORS, and build-compare.js then
 * polices every page here exactly as it polices the first seven: no
 * disparaging word, no currency amount anywhere, at least three points in
 * the gap, and a table that opens with a row the other side wins.
 *
 * None of these pages names a product. Each compares against a category —
 * desktop PDF editors, upload-based compressors, a developer's own editor,
 * accounting software, GST billing and return software — because we have
 * tested none of them and will not describe one from memory. Every claim on
 * our side was checked against the tool's own page and engine on
 * 2026-10-04: what it reads, what it writes, what it refuses, and what its
 * FAQ already admits.
 *
 * Every path below is a real page. A path that does not resolve stops the
 * build rather than shipping a dead link.
 */
'use strict';

/* Guidance links, all already vetted in build/sources.js. */
const REF = {
  gstRates: ['CBIC-GST — rates for goods and services', 'https://cbic-gst.gov.in/'],
  eInvoice: ['e-Invoice portal (IRP) — schema and the API specification', 'https://einvoice1.gst.gov.in/']
};

/* No product is named in this batch, so there is nothing new to police. */
const COMPETITORS = [];

const COMPARISONS = [

  /* ================================================================== */
  {
    slug: 'free-pdf-editor',
    glyph: 'i-pdf-editor',
    name: 'Free PDF editor',
    crumb: 'Free PDF editor',
    title: 'Free PDF editor: what a browser can honestly do to a PDF, and what it cannot',
    lede: 'Add text, a signature, a watermark or page numbers; merge, split, reorder, rotate and delete pages; turn pages into images and images into a PDF — free, with nothing uploaded. What these tools cannot do is change the words already on the page, and that is the first thing a desktop PDF editor is bought for.',
    honest: [
      'Most people searching for a free PDF editor want one of two things. Either they need to put something onto a PDF — a line of text in a form that has no boxes, a signature, a date, a DRAFT stamp — or they need to rearrange its pages. Both are here, free, with no account and no watermark of ours on the result, and the file is read and rewritten by your own browser rather than sent anywhere.',
      'The other thing people mean by “edit a PDF” is changing the text that is already there: a typo in a contract, a price, a paragraph. None of these tools can do that, and the Add Text tool says so on its own page. Changing existing words means re-flowing the original text with the fonts and the layout it was made from, which is the core job of a desktop PDF editor. If that is what you need, this page will save you finding out the slow way.'
    ],
    gap: {
      heading: 'What a desktop PDF editor does that we do not',
      intro: 'We compare against the category, not a product: we have not tested any particular editor and will not describe one from memory. These are the jobs the category exists for.',
      points: [
        { h: 'It changes the text that is already there.', p: 'Click into a paragraph, retype it, and the line re-flows. Our Add Text tool draws new text on top of the page and leaves what is underneath exactly as it was. The honest workaround is to correct the source document and export it again.' },
        { h: 'It reads scanned pages.', p: 'Character recognition turns a scanned or photographed page into text you can select and search. Nothing here makes a scanned PDF searchable. The AI readers on this site pull the fields out of invoices and receipts, which is a different job.' },
        { h: 'It fills and builds forms.', p: 'Interactive fields — text boxes, tick boxes, drop-downs — can be filled, created and flattened. Ours do not fill form fields: Add Text places text where you click, which suits a form that is only a printed page, but it is not a field anything can read back. Merging drops form fields altogether, and the merge page says so.' },
        { h: 'It signs with a certificate.', p: 'A certificate-based digital signature makes any later change detectable. Our signature tool draws a visible signature — the same as signing a printout and scanning it — and its own page explains the difference and when it matters.' },
        { h: 'It redacts, protects and compresses.', p: 'Permanently removing what sits under a black box, adding or removing a password, and making a PDF smaller are all common editor features. None of the three is here. A watermark added here sits on top of the page and can be removed by anyone with an editor; the watermark tool says that too.' },
        { h: 'It writes in any script, and places pictures.', p: 'Text added with the Add Text tool is drawn in the standard Helvetica font, which has no characters outside Latin-1, so Hindi, Greek, Cyrillic and Chinese will not render. Placing a logo or an image onto an existing page is not offered either.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'A desktop PDF editor',
      rows: [
        { edge: 'them', need: 'Changing words already on the page', us: 'No. New text can be drawn on top; what is there is untouched.', them: 'The core feature of the category.' },
        { edge: 'them', need: 'Scanned pages to searchable text', us: 'No.', them: 'Common in the category; check the edition you are looking at.' },
        { edge: 'them', need: 'Filling interactive form fields', us: 'No. Text goes where you click, which suits a form with no fields; merging drops fields altogether.', them: 'Filled, created and flattened.' },
        { edge: 'them', need: 'A certificate-based digital signature', us: 'No. A drawn or typed signature, visible and removable.', them: 'Usually offered, with a certificate you obtain from a provider.' },
        { edge: 'them', need: 'Redaction, passwords and making a PDF smaller', us: 'None of the three.', them: 'Commonly included.' },
        { edge: 'them', need: 'Text in Hindi, Greek, Cyrillic or Chinese', us: 'Not with Add Text: Helvetica has no characters for them.', them: 'Embeds fonts, so any script the font covers.' },
        { edge: 'them', need: 'Bookmarks and annotations', us: 'Merging rebuilds the page tree and drops them on purpose, because that is what keeps the output reliably valid.', them: 'Kept, and editable.' },
        { edge: 'us', need: 'Putting a line of text, a date or a signature on a PDF', us: 'Click where it goes, type, download. As many pieces as you like on any pages, previewed before you commit.', them: 'Also does it, after an install or a sign-in.' },
        { edge: 'us', need: 'Merging, splitting, reordering, rotating, deleting or extracting pages', us: 'One page per job, and an organiser with page thumbnails you drag into order. Merging takes a page range per file — “1-3 | all | 2,5”.', them: 'Also does it.' },
        { edge: 'us', need: 'Where the contract goes', us: 'Nowhere. It is parsed and rewritten by your own browser; nothing is uploaded, queued or logged.', them: 'A desktop editor works locally too. An online editor may take the file onto its server; check before you send a contract to one.' },
        { edge: 'us', need: 'A machine you cannot install anything on', us: 'Nothing to install: a browser tab on a work laptop, a library computer or a phone.', them: 'An install, and often an administrator to approve it.' },
        { edge: 'us', need: 'Cost', us: 'Free, no account, no limit, and no watermark of ours on the output.', them: 'A licence or a subscription. The vendor has the current figure; we will not guess at it.' }
      ]
    },
    buy: {
      heading: 'When you should buy a desktop PDF editor',
      intro: 'If your work is changing documents rather than adding to them, the answer is yes, and soon.',
      points: [
        'You need to change existing wording, and often. Correcting the source and exporting again stops being a workaround after the third contract.',
        'You handle scanned paperwork that has to be searchable, or you need the text out of it.',
        'You build or fill forms that a system reads back, or you send documents that must carry a certificate-based signature.',
        'You redact. Covering text with a box is not removing it, and getting that wrong discloses exactly what you meant to hide.',
        'You write in a script other than Latin, or you need logos and images placed onto existing pages.'
      ]
    },
    groups: [
      { name: 'Put something onto a PDF', blurb: 'Text, a signature, a stamp, page numbers — drawn on top and previewed first.', tools: ['/pdf/pdf-editor/', '/pdf/pdf-signature/', '/pdf/watermark-pdf/', '/pdf/pdf-page-numbers/'] },
      { name: 'Rearrange the pages', blurb: 'Visually, or by page number when you already know which.', tools: ['/pdf/pdf-organise/', '/pdf/merge-pdf/', '/pdf/split-pdf/', '/pdf/rotate-pdf/', '/pdf/delete-pdf-pages/', '/pdf/extract-pdf-pages/'] },
      { name: 'Convert in and out', blurb: 'Pages to pictures, pictures to pages, plain text to a paginated document.', tools: ['/pdf/pdf-to-images/', '/image/image-to-pdf/', '/pdf/text-to-pdf/'] },
      { name: 'Look inside before you send it', blurb: 'What the file says about itself, and what it says about you.', tools: ['/pdf/pdf-inspector/', '/pdf/pdf-metadata/'] }
    ],
    faq: [
      { q: 'Can I edit the existing text in a PDF here?', a: 'No. The Add Text tool draws new text on top of the page and does not touch what is already there. Editing existing words means re-flowing the original text, which needs the fonts and the layout the PDF was made from, and most PDFs do not carry enough of either. If you need to change the wording, edit the source document and export it again, or use a desktop PDF editor.' },
      { q: 'How do I fill in a PDF form that has no boxes?', a: 'Open Add Text, click the page where the first answer goes, type it, then press “Add as another item” and do the next one. Each piece keeps its own page, position and size, and a wrap width stops a long answer running off the page. The preview shows every piece before anything is written.' },
      { q: 'Is my PDF uploaded?', a: 'No. Each tool parses and rewrites the file in your own browser, so nothing is transmitted, queued or logged — which is why they work offline and why they are safe for contracts. The page organiser downloads a rendering engine from this site the first time you use it, to draw the thumbnails; your file still never leaves the device.' },
      { q: 'Is a signature added here legally binding?', a: 'It is a visible signature, the same as signing a printout and scanning it. A digital signature in the legal sense is a cryptographic operation with a certificate from a trust service provider. If a contract, a court or a regulator asks for one, this is not it. For a form, an invoice or an internal approval that needs to look signed, it is exactly right.' },
      { q: 'Will there be a watermark on my file?', a: 'Not one of ours. The only watermark that ends up on your PDF is one you add yourself with the watermark tool.' },
      { q: 'Can it make a PDF smaller, or remove a password?', a: 'No. There is no compression tool and no password tool for PDFs on this site. A desktop PDF editor is the right tool for both.' }
    ],
    collections: ['small-business', 'going-paperless', 'freelancers'],
    sources: null
  },

  /* ================================================================== */
  {
    slug: 'free-image-compressor',
    glyph: 'i-image-compressor',
    name: 'Free image compressor',
    crumb: 'Free image compressor',
    title: 'Free image compressor: smaller photos without uploading them, and where specialist compressors do better',
    lede: 'Shrink JPEG, PNG and WebP files in your browser, several at once, with the size before and after for each and a ZIP of the lot — no upload, no account, no watermark. It uses the encoder your browser already has, which is very good with photographs and plain with PNGs; the gap is set out below before anything else.',
    honest: [
      'An image compressor does one thing: encode a picture again at a lower quality, a smaller size or a more efficient format until the file is small enough for whatever turned it away. The one here does it inside your browser. The file is decoded, redrawn onto a canvas and encoded again on your own device, so a photo of your passport, your house or your child never leaves it. There is no upload queue because there is no upload.',
      'We compare against the category — compressors that take an upload, and specialist image software — rather than any named product, because we have not tested them and will not describe them from memory. The honest summary is that a browser’s own encoder is very good at turning a large photograph into a small WebP or JPEG, and not the best tool there is for squeezing the last few per cent out of a PNG.'
    ],
    gap: {
      heading: 'What a specialist compressor does that we do not',
      intro: 'Some of these matter only to somebody chasing kilobytes on a website. The first two matter to almost everyone who has tried to make a PNG smaller or a photo fit a form.',
      points: [
        { h: 'It shrinks a PNG properly.', p: 'Specialist tools reduce a PNG’s colour palette or recompress it harder than a browser does. Ours encodes PNG losslessly with the browser’s own encoder, so a PNG kept as a PNG may barely shrink, and the tool warns you when the result is larger than the original. Converting a screenshot to WebP is usually the better move.' },
        { h: 'It aims at a target size.', p: 'Some compressors let you type a limit and hand back a file that fits it, which is what a job or exam portal asks for. Ours does not: you set a quality and a maximum width, read the size, and adjust.' },
        { h: 'It reads more formats.', p: 'HEIC photos from an iPhone are not read here, because browsers do not ship a decoder for them, and AVIF is not offered as an output. The tool is built for JPEG, PNG and WebP, in and out.' },
        { h: 'It keeps the metadata you want kept.', p: 'Because the picture is redrawn, nothing from the original file’s header survives — not the camera details and GPS location, which is usually what you want gone, and not the copyright and author fields either, which sometimes is not.' },
        { h: 'It runs without a person.', p: 'An API, a plugin for a website’s media library, a folder that compresses whatever lands in it. Ours is a page somebody opens.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'A specialist or upload-based compressor',
      rows: [
        { edge: 'them', need: 'Making a PNG much smaller while it stays a PNG', us: 'Lossless re-encoding only: often a small saving, and a warning if the file grows.', them: 'Palette reduction and heavier recompression, where the product offers them.' },
        { edge: 'them', need: 'Compressing to a target size', us: 'No. Set the quality and the width, read the result, adjust.', them: 'Offered by some. Check the one you use.' },
        { edge: 'them', need: 'HEIC in, AVIF out', us: 'Neither.', them: 'Varies by product.' },
        { edge: 'them', need: 'Keeping copyright and camera metadata', us: 'Not kept. Redrawing removes all of it.', them: 'Often a setting.' },
        { edge: 'them', need: 'Automation: an API, a plugin, a watched folder', us: 'None. A page a person opens.', them: 'Available in some products.' },
        { edge: 'level', need: 'How good a compressed photograph looks', us: 'The browser’s own JPEG and WebP encoders, with a live preview and the size before and after.', them: 'Some use encoders tuned to save a little more at the same quality. Resizing usually matters far more than the encoder: a 4,000-pixel photo shown 800 wide wastes most of its bytes.' },
        { edge: 'us', need: 'Where your photos go', us: 'Nowhere. Decoded, redrawn and encoded on your own device, which is why it works with the network off.', them: 'An upload-based compressor receives the file. Read its terms before sending anything personal.' },
        { edge: 'us', need: 'GPS location in a phone photo', us: 'Gone from the compressed copy, because nothing from the original header survives the redraw.', them: 'Depends on the product and its settings.' },
        { edge: 'us', need: 'A batch of photos', us: 'Drop them all in, see every result and its size, and download one at a time or all of them as a ZIP.', them: 'Also offered. Whether a free tier limits how many is a question for the product.' },
        { edge: 'us', need: 'Cost and limits', us: 'Free, no account, no watermark, and no limit beyond your own device’s memory.', them: 'Free tiers and subscriptions. The vendor has the figures; we will not guess at them.' }
      ]
    },
    buy: {
      heading: 'When you should use something else',
      intro: 'Often there is nothing to buy — but there is sometimes a better tool for the job, and you should use it.',
      points: [
        'You prepare PNG graphics for a website and every kilobyte counts. A dedicated PNG optimiser will beat a browser’s lossless encoder.',
        'A portal demands an exact size limit and you are doing it every day. A compressor with a target-size setting saves the trial and error.',
        'Your photos arrive as HEIC and you would rather not change the camera setting that makes them.',
        'It has to happen without a person: a site’s uploads, a product feed, a build step. That is an API or a plugin, not a page.',
        'You must keep copyright and author metadata in the files you deliver.'
      ]
    },
    groups: [
      { name: 'Make it smaller', blurb: 'Quality, dimensions and format — the three things that decide a file’s size.', tools: ['/image/image-compressor/', '/image/bulk-image-resizer/', '/image/image-converter/', '/image/svg-optimizer/'] },
      { name: 'Make it the right shape', blurb: 'For the platform, the form or the print.', tools: ['/image/social-media-resizer/', '/image/image-cropper/', '/image/passport-photo/'] },
      { name: 'Make it safe to share', blurb: 'What the photo says about where it was taken, and what is visible in it.', tools: ['/image/exif-viewer/', '/image/exif-remover/', '/image/blur-redact/'] },
      { name: 'Put it in a document', blurb: 'Photos into a PDF, and PDF pages back into pictures.', tools: ['/image/image-to-pdf/', '/pdf/pdf-to-images/'] }
    ],
    faq: [
      { q: 'Are my photos uploaded?', a: 'No. Each file is read by your browser, drawn to a canvas and encoded again on your device. Nothing is transmitted, which is why the compressor works with the network off.' },
      { q: 'How do I get a photo under a portal’s size limit?', a: 'Choose JPEG or WebP, start at quality 80, and set a maximum width — the biggest saving is nearly always the dimensions, not the quality. Read the size under the result; if it is still too big, lower the width before you lower the quality. There is no target-size box, so it can take two tries.' },
      { q: 'Why did my PNG get bigger?', a: 'PNG is lossless, so the quality slider does nothing to it, and a browser’s PNG encoder is not tuned for size. Saving a screenshot as JPEG usually makes it worse too, because JPEG handles flat colour badly. Try WebP, or keep the original.' },
      { q: 'Which format should I choose?', a: 'WebP for the web: it is typically a quarter to a third smaller than JPEG at the same visual quality, and every current browser shows it. JPEG where a form or an older program refuses WebP. PNG for screenshots, logos and diagrams that need to stay sharp and lossless.' },
      { q: 'Can it compress HEIC photos from an iPhone?', a: 'Not here: browsers do not ship a HEIC decoder. On an iPhone you can set the camera format to “Most Compatible” so that it saves JPEG in the first place.' },
      { q: 'Is there a limit on how many images?', a: 'No artificial one. Each image is decoded in memory, so a few dozen photographs is comfortable on a phone and a few hundred is better done on a desktop.' }
    ],
    collections: ['online-sellers', 'photographers', 'job-seekers'],
    sources: null
  },

  /* ================================================================== */
  {
    slug: 'free-json-formatter',
    glyph: 'i-json-formatter',
    name: 'Free JSON formatter',
    crumb: 'Free JSON formatter',
    title: 'Free JSON formatter: when a browser tab is the right tool, and when your editor is',
    lede: 'Paste JSON and get it indented, minified or with its keys sorted — or get the exact line and column where it stops parsing — in your browser, with nothing sent anywhere. For anything bigger than a paste, your code editor and the command line do more, and this page says which jobs those are first.',
    honest: [
      'A JSON formatter is what you reach for when an API hands back one unbroken line, or a config file will not load and the error says “unexpected token” and nothing else. The one here parses with the browser’s built-in JSON engine as you type, prints the result with the indent you choose, and on a failure tells you the line, the column and the text around it. Nothing you paste leaves the page.',
      'We compare it against the tools a developer already has rather than against other websites: a code editor with a formatter built in or added, and command-line JSON processors. For a lot of jobs those are the better choice, and this page is for deciding which one to open.'
    ],
    gap: {
      heading: 'What your editor or a command-line processor does that we do not',
      intro: 'The comparison is not with a paid product. It is with the tools already on a developer’s machine, which is why the list is long.',
      points: [
        { h: 'It works on the file where it lives.', p: 'Format on save, in the repository, with the diff right there. Here you paste in and copy out; there is no file picker on this tool.' },
        { h: 'It checks the shape, not just the syntax.', p: 'Making sure a document has the right fields of the right types is schema validation. This tool checks that JSON is well-formed — that it parses — and nothing more.' },
        { h: 'It queries and reshapes.', p: 'Pulling one field out of every object in an array, filtering, restructuring: that is what command-line processors are for. Ours formats, minifies and sorts keys. It does not query.' },
        { h: 'It handles a big document.', p: 'Folding a tree to see its shape, jumping between matching brackets, searching inside it. Our output is a plain block of text with a copy button and a download button.' },
        { h: 'It leaves your text alone.', p: 'This tool follows the specification, so comments and trailing commas — common in config files — are errors. And because it goes through the browser’s JSON parser, integers larger than 9,007,199,254,740,991 lose precision and a key that appears twice keeps only its last value. An editor working on the text keeps both visible.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'Your code editor or a command-line processor',
      rows: [
        { edge: 'them', need: 'Formatting the file where it lives', us: 'Paste in, copy out. No file picker on this tool.', them: 'Format on save, in the repository.' },
        { edge: 'them', need: 'Checking against a schema', us: 'Well-formedness only.', them: 'Supported by editors and by validators you add.' },
        { edge: 'them', need: 'Querying, filtering and reshaping', us: 'Not attempted.', them: 'What command-line processors exist for.' },
        { edge: 'them', need: 'Big documents: folding, bracket matching, search', us: 'A plain text block, scrollable, with copy and download.', them: 'Built in.' },
        { edge: 'them', need: 'Comments, trailing commas, 64-bit integers, repeated keys', us: 'Strict JSON through the browser’s parser: comments and trailing commas are errors, very large integers lose precision, and a repeated key keeps its last value.', them: 'Work on the text, so nothing is silently changed.' },
        { edge: 'level', need: 'Finding why it will not parse', us: 'The line, the column and the text around it, worked out from the parser’s own error.', them: 'Editors underline it as you type, which is at least as good.' },
        { edge: 'level', need: 'A token or a config with internal hostnames in it', us: 'Parsed in this page and sent nowhere; open the network panel and watch it stay empty.', them: 'Local too. The risk is pasting into a web page that does its work on a server, so check before you do.' },
        { edge: 'us', need: 'A machine you cannot install anything on', us: 'A browser tab: a locked-down work laptop, a client’s machine, a phone.', them: 'Needs the editor, and its extensions, installed and allowed.' },
        { edge: 'us', need: 'Starting from nothing', us: 'Open the page and paste. Indent with two spaces, four or a tab, minify, or sort the keys at every depth.', them: 'Install, configure, find the extension.' },
        { edge: 'us', need: 'The jobs next to it', us: 'CSV to JSON and back, XML, JWT decoding, Base64 and URL encoding, hashes, a regex tester and a text diff — each one click away, none of them sending anything.', them: 'An extension per job, to find and install.' }
      ]
    },
    buy: {
      heading: 'When you should open your editor instead',
      intro: 'Nothing on this page needs buying. The question is which free tool to open, and most days a developer should open the one already on the machine.',
      points: [
        'The JSON is a file in a repository. Format it where it lives, with the formatter your team has agreed on, so the diff is only the change.',
        'You need to know it is the right shape, not just valid. That is a schema and a validator, in the editor or in your pipeline.',
        'You are pulling fields out or restructuring it. Use a command-line processor; a formatter is the wrong tool.',
        'It is large, or it carries comments, trailing commas or 64-bit IDs that must survive. Work on the text, not through a JavaScript parser.',
        'Where this page earns its place: a machine with nothing installed, a quick look at an API response, a token to decode, or a colleague who needs a link rather than an extension.'
      ]
    },
    groups: [
      { name: 'Format and check', blurb: 'Make it readable, find the error, convert it.', tools: ['/developer/json-formatter/', '/developer/xml-formatter/', '/developer/csv-to-json/'] },
      { name: 'Decode what an API handed you', blurb: 'Tokens, encodings and checksums.', tools: ['/developer/jwt-decoder/', '/developer/base64/', '/developer/url-encoder/', '/developer/hash-generator/'] },
      { name: 'Compare and test', blurb: 'Two versions side by side, and the pattern that matches them.', tools: ['/text/text-diff/', '/developer/regex-tester/'] }
    ],
    faq: [
      { q: 'Is my JSON sent anywhere?', a: 'No. It is parsed and formatted in your browser by its built-in JSON engine, and nothing leaves the page. One thing worth knowing: if you use the share bar and tick “Include my text”, an input of up to 300 characters is put into the link you are sharing. That box is off on every page load.' },
      { q: 'Why does it reject my config file?', a: 'Most likely a comment or a trailing comma. The JSON specification allows neither, even though JavaScript and many config formats do. Remove them, or format the file in an editor that understands the dialect it is written in.' },
      { q: 'Why did a long number change?', a: 'The browser’s parser holds every number as a 64-bit floating-point value, so integers larger than 9,007,199,254,740,991 cannot all be represented exactly and are rounded. If your IDs are that long, keep them as strings in the JSON, or use a tool that works on the text.' },
      { q: 'Can it validate against a JSON Schema?', a: 'No. It checks that the JSON is well-formed — that it parses — and reports the line and column where it does not. Checking fields and types against a schema needs a schema validator.' },
      { q: 'What do the figures under the output mean?', a: 'Whether it parsed, the type at the top level, how many keys and array items there are in total, how deeply it nests, and the size of the input and of the output — so you can see what minifying saved.' }
    ],
    collections: ['developers'],
    sources: null
  },

  /* ================================================================== */
  {
    slug: 'spreadsheet-vs-accounting-software',
    glyph: 'i-sheet-merge',
    name: 'Spreadsheet or accounting software?',
    crumb: 'Spreadsheet vs accounting software',
    title: 'Spreadsheet vs accounting software for a small business: when the sheet is enough, and when to move',
    lede: 'A spreadsheet is a perfectly good set of books for a small, simple business — until it is not. This page puts what accounting software does first, says where the line falls, and shows the free tools that let a spreadsheet hold up for longer: double entry, a bank reconciliation and the VAT figures, all from the sheet you already keep.',
    honest: [
      'Plenty of sole traders and small companies keep their books in a spreadsheet, and there is nothing wrong with that while the business is small, the transactions are few and one person does the lot. The trouble with a spreadsheet is not that it is a spreadsheet. It is that nothing in it insists the books balance, nothing stops last quarter being quietly edited, and nothing ties it to the bank unless somebody does that by hand.',
      'The tools here close part of that gap for nothing. The bookkeeping tool takes bank lines, sales and purchase invoices or plain journals into a real double-entry ledger and gives back a trial balance, a profit and loss and a balance sheet; it refuses an entry that does not balance, and it can lock a period once you have reported it. The book is a file you save and open again, kept on your own machine. What none of them can be is accounting software, and the rest of this page is about when you need that.'
    ],
    gap: {
      heading: 'What accounting software does that a spreadsheet and these tools do not',
      intro: 'Compared against the category, not a product: we have not tested any particular package and will not describe one from memory.',
      points: [
        { h: 'It fetches the bank for you.', p: 'A bank feed brings transactions in every day without anybody downloading a statement. Here you download the statement and import it, every time.' },
        { h: 'It files.', p: 'Under Making Tax Digital a VAT return goes through software HMRC has recognised. Our VAT tool and the bookkeeping tool work out the nine boxes and show the rows behind each one; neither can submit anything, and both say so on their own pages.' },
        { h: 'It is one set of books for everybody.', p: 'Several people posting into the same ledger, with permissions, a record of who changed what, and an accountant who logs in to the same figures. Our book is a file on one machine; sharing it means sending the file.' },
        { h: 'It joins the invoices to the ledger.', p: 'Raise an invoice and it is in the books, numbered in sequence and tracked until it is paid. Our invoice generator draws a PDF and our ledger is a separate tool; nothing joins them except you.' },
        { h: 'It carries the business from one year to the next.', p: 'Closing a year, bringing the balances forward, last year beside this one. The bookkeeping tool keeps one book per file and has no year-end routine.' },
        { h: 'Somebody supports it.', p: 'A vendor with a support desk and an obligation to keep up with the rules. Here there is a contact form, and tools that print the date their rules were last checked.' }
      ]
    },
    table: {
      us: 'A spreadsheet, plus these free tools',
      them: 'Accounting software you subscribe to',
      rows: [
        { edge: 'them', need: 'Getting transactions in', us: 'Download the statement and import it, each time.', them: 'A bank feed, daily, with nobody downloading anything.' },
        { edge: 'them', need: 'Filing VAT under Making Tax Digital', us: 'Not from here. The nine boxes are worked out, with the rows behind every box; the filing goes through recognised software.', them: 'Submitted from where the books are kept, if the product is on gov.uk’s list.' },
        { edge: 'them', need: 'Several people in the same books', us: 'One person, one file. Send the file to share it.', them: 'Users, permissions and a record of who changed what.' },
        { edge: 'them', need: 'Invoices that post themselves', us: 'The invoice PDF and the ledger are separate tools.', them: 'Raised, numbered, posted and tracked to payment in one place.' },
        { edge: 'them', need: 'Year end, and the year after', us: 'No year-end routine. A book covers the year you set it up for.', them: 'Closed, carried forward and compared.' },
        { edge: 'them', need: 'Somebody to ring', us: 'A contact form.', them: 'A support desk.' },
        { edge: 'level', need: 'Books that have to balance', us: 'Every journal must sum to zero, in whole pence or paise; a row that would break that is refused with the reason, and the rest still posts.', them: 'Enforced too. This is where a bare spreadsheet falls short, not where software does.' },
        { edge: 'level', need: 'Reconciling to the bank', us: 'Drop in the statement and the bank ledger and get the unmatched items on each side and the closing balances explained.', them: 'Built in, against the feed.' },
        { edge: 'us', need: 'Changing nothing about how you work', us: 'Keep the sheet you have. Import from it whenever you want a trial balance, a P&L or a reconciliation.', them: 'A migration: a chart of accounts, opening balances and a new habit.' },
        { edge: 'us', need: 'Where the books are kept', us: 'In a file on your machine. Nothing is uploaded, which is why an accountant can put a client’s books through it without a processing agreement.', them: 'On the vendor’s servers. Usually fine, and a processing arrangement to paper.' },
        { edge: 'us', need: 'Trying double entry before committing to anything', us: 'Start a book in a minute with a UK or an Indian chart of accounts and see your own figures as a trial balance.', them: 'Possible, once the business is set up inside it.' },
        { edge: 'us', need: 'Cost while you are small', us: 'Free, no account, no charge per user or per month.', them: 'A subscription. The vendor has the current figure; we will not guess at it.' }
      ]
    },
    buy: {
      heading: 'When to move from a spreadsheet to accounting software',
      intro: 'This is the useful part of the page. If two or more of these are true, it is time — and the free tools here are not a reason to wait.',
      points: [
        'You are VAT registered. The return goes through recognised software, and keeping the books in the same product is the simplest way to keep the link from record to return digital the whole way.',
        'Making Tax Digital for Income Tax is about to reach you. gov.uk has a checker for whether it does and from when, and the MTD checker here works it out from your own figures.',
        'More than one person touches the books — a partner, a bookkeeper, or an accountant who wants to log in rather than be sent a file.',
        'You raise more than a handful of invoices a month and need to know who has paid without keeping a second sheet to tell you.',
        'You carry stock, or you have closed a year in the spreadsheet and opening the next one by hand felt fragile. That feeling is accurate.'
      ]
    },
    groups: [
      { name: 'Keep the books from the sheet you have', blurb: 'Double entry without moving house.', tools: ['/business/bookkeeping/', '/business/sheet-merge/', '/ai/bank-statement-categoriser/'] },
      { name: 'Check them against reality', blurb: 'The bank, the debtors, and what the figures say about the business.', tools: ['/business/bank-reconciliation/', '/business/receivables-ageing/', '/business/business-ratios/'] },
      { name: 'The tax figures, not the filing', blurb: 'Worked out and shown row by row. Submitting them needs recognised software.', tools: ['/business/vat-return/', '/business/mtd-checker/', '/business/mtd-quarterly-update/'] },
      { name: 'The paperwork, and the day you move', blurb: 'Invoices and terms now; journals in the format a package imports, later.', tools: ['/pdf/invoice-pdf/', '/business/invoice-payment-terms/', '/business/accounting-converter/'] }
    ],
    faq: [
      { q: 'Is a spreadsheet good enough for a small business?', a: 'For a simple one, often yes: one person, not many transactions, not VAT registered. The risks are that nothing makes it balance, nothing stops an old period being changed, and nothing reconciles it to the bank unless you do. The bookkeeping and reconciliation tools here cover those three without asking you to give the spreadsheet up.' },
      { q: 'Does Making Tax Digital mean I cannot use a spreadsheet?', a: 'Not by itself. Records may be kept in a spreadsheet; what the rules require is that the return goes through compatible software and that the figures travel from the records to it by digital link rather than retyping. gov.uk is the authority on what counts, and is linked below.' },
      { q: 'Can the bookkeeping tool replace accounting software?', a: 'For one person producing management figures from their own records, it does a lot of the work: a double-entry ledger, a trial balance, a profit and loss, a balance sheet and the VAT or GST figures. It does not produce statutory accounts, it files nothing, it has no bank feed and no second user, and it has no year-end routine. When those start to matter, move.' },
      { q: 'Where are my books kept?', a: 'In the page while it is open, and in the file you save. Nothing is uploaded. The trade is that you look after the file: close the tab without saving and the work is gone.' },
      { q: 'How do I move to accounting software later?', a: 'Most packages import journals or transactions from a CSV, so a clean set of records in a spreadsheet is a good starting point in itself. The accounting converter here moves journals and day books between the formats the packages it names import, and checks every voucher balances before it writes anything.' }
    ],
    collections: ['small-business', 'freelancers', 'month-end', 'year-end'],
    sources: {
      heading: 'The authorities, rather than us',
      refs: [
        ['mtdVat', 'what Making Tax Digital for VAT requires of your records and your software'],
        ['mtdVatSoftware', 'who is recognised to file a VAT return — the list is the authority'],
        ['mtdItsaCheck', 'whether Making Tax Digital for Income Tax reaches you, and from when']
      ]
    }
  },

  /* ================================================================== */
  {
    slug: 'free-gst-software',
    glyph: 'i-gst-calculator',
    name: 'Free GST software',
    crumb: 'Free GST software',
    title: 'Free GST software: the sums and the checks free, the filing and the books not',
    lede: 'GST worked out and split, a GSTR-2B reconciliation, e-invoice JSON for bulk upload and a bulk GSTIN checker — free, in your browser, with nothing uploaded. Plus an HSN and SAC finder that is an AI tool: it needs a free account and gives ten runs a month. None of it files a return, issues an IRN or keeps your books.',
    honest: [
      '“GST software” usually means one of two products: billing software that raises GST invoices from a stock list, or return software — often working through a GST Suvidha Provider — that prepares and files GSTR-1 and GSTR-3B. This site is neither. It is the arithmetic and the checking that sit around both: the split between CGST, SGST and IGST, matching your purchase register against GSTR-2B before you claim credit, building e-invoice JSON from a spreadsheet, and checking a column of GSTINs before any of them reaches the portal.',
      'All of that runs in your browser except one tool. The HSN and SAC finder is an AI tool: the product description you type is sent to a model, it needs a free account, and the free plan gives ten runs a month. Its own page says the code it suggests is a pointer to check against the tariff, not a classification to file on.'
    ],
    gap: {
      heading: 'What GST billing and return software does that we do not',
      intro: 'Compared against the category: we have not tested any particular product and will not describe one from memory.',
      points: [
        { h: 'It files returns.', p: 'GSTR-1, GSTR-3B and the annual return, prepared from your books and filed — directly, or through a GST Suvidha Provider. Nothing on this site connects to the GST portal or files anything.' },
        { h: 'It issues the IRN.', p: 'Software connected to the invoice registration portal can send an invoice and get the IRN and the signed QR back on the spot. Our e-invoice tool writes the JSON for the portal’s bulk upload; the IRN comes from the portal when you upload it, and nothing offline can produce one.' },
        { h: 'It fetches GSTR-2B for you.', p: 'Connected software can pull 2B and your suppliers’ filing status itself. Here you download the JSON or the Excel from the portal and drop it in, every month.' },
        { h: 'It keeps the books and the stock.', p: 'Sales, purchases, items with their HSN codes, and the ledgers the return figures come from, carried from year to year. The bookkeeping tool here has an Indian chart of accounts with separate CGST, SGST and IGST accounts, but it is a file you keep, not a system of record, and it holds no stock.' },
        { h: 'It raises e-way bills and watches the calendar.', p: 'E-way bills, due-date reminders and notices. None of that is here.' }
      ]
    },
    table: {
      us: 'Here, free, in your browser',
      them: 'GST billing or return software',
      rows: [
        { edge: 'them', need: 'Filing GSTR-1 and GSTR-3B', us: 'No. Nothing here connects to the portal.', them: 'The reason it is bought.' },
        { edge: 'them', need: 'Getting the IRN and signed QR', us: 'No. The JSON is built here; the portal issues the IRN when you upload it.', them: 'Issued directly, where the product is connected to the invoice registration portal.' },
        { edge: 'them', need: 'Fetching GSTR-2B and supplier filing status', us: 'You download 2B from the portal yourself and drop it in.', them: 'Fetched, where the product is connected.' },
        { edge: 'them', need: 'Billing from a stock list with HSN codes', us: 'Invoice PDFs drawn one at a time. No item list, no stock.', them: 'Items, stock and codes held for you.' },
        { edge: 'them', need: 'E-way bills', us: 'Not here.', them: 'Commonly included; check the product.' },
        { edge: 'them', need: 'Books and history', us: 'The bookkeeping tool keeps a book in a file you save. There is no year-to-year system of record.', them: 'Held and carried forward.' },
        { edge: 'level', need: 'The tax split on an invoice', us: 'Decided from the state codes in the two GSTINs, so CGST and SGST, or IGST, cannot disagree with the parties printed on it.', them: 'Also worked out for you.' },
        { edge: 'us', need: 'Matching the purchase register to GSTR-2B', us: 'Both files read here: the credit that is safe to claim, which suppliers have not filed, what is in 2B but not in your books, and where the tax differs.', them: 'Also does it, inside the product, once your purchases are in it.' },
        { edge: 'us', need: 'Checking a whole column of GSTINs', us: 'Format and checksum for every one at once, with the reason for each failure — PANs, IFSC codes and other IDs too. Nothing is looked up or uploaded.', them: 'Depends on the product; ask whether it checks a list or one at a time.' },
        { edge: 'us', need: 'Where your purchase register goes', us: 'Nowhere. It is read and compared by your own browser. The HSN finder is the exception: it sends the description you type to a model, and says so.', them: 'A hosted product holds your invoices on its servers, which is normal and belongs in your contract with them.' },
        { edge: 'us', need: 'Cost', us: 'Free with no account — except the HSN finder: a free account and ten runs a month.', them: 'A licence or a subscription. The vendor has the figure; we will not guess at it.' }
      ]
    },
    buy: {
      heading: 'When you should buy GST software',
      intro: 'If you are GST registered and file every month, almost certainly — and the free tools here are what you use alongside it.',
      points: [
        'You file GSTR-1 and GSTR-3B yourself and would rather prepare them from the same place you bill from.',
        'You have to e-invoice, and you raise enough invoices that uploading a file and copying IRNs back by hand has become a daily chore.',
        'You carry stock and need codes, rates and quantities held against every item.',
        'You raise e-way bills.',
        'More than one person bills, or your CA wants to see the same books without being sent files.'
      ]
    },
    groups: [
      { name: 'Work out the tax', blurb: 'The rate, the split and the document it goes on. The finder is AI and says what it sends.', tools: ['/india/gst-calculator/', '/ai/hsn-gst-finder/', '/pdf/invoice-pdf/', '/pdf/delivery-challan-pdf/'] },
      { name: 'Check it before the portal does', blurb: 'Credit you can claim, IDs that will fail, and the e-invoice payload.', tools: ['/business/gst-reconciler/', '/business/id-validator/', '/business/einvoice-json/'] },
      { name: 'The books behind the figures', blurb: 'A ledger on the Indian chart, and the way in from a spreadsheet or another package.', tools: ['/business/bookkeeping/', '/business/tally-converter/', '/business/accounting-converter/'] }
    ],
    faq: [
      { q: 'Can I file GST returns with these tools?', a: 'No. Nothing on this site connects to the GST portal. The tools work out figures, reconcile them and build files you upload yourself; filing GSTR-1, GSTR-3B or the annual return needs the portal itself or software connected to it.' },
      { q: 'Is the HSN and SAC finder free?', a: 'It is an AI tool, so it works differently from the rest of this page. It needs a free account, gives ten runs a month on the free plan, and sends the description you type to a model; the page shows what is sent. It returns likely codes with the rate, the reasoning and what could move a product to a different code. Treat a low-confidence answer as a reason to look it up in the tariff or ask your CA.' },
      { q: 'Which GST rates does the calculator use?', a: 'The GST 2.0 slabs in force since 22 September 2025: 0%, 0.25%, 3%, 5%, 18% and 40%. Which one applies to a product depends on its HSN or SAC code, not on a general category, so check the current notification for anything you are unsure of.' },
      { q: 'Is my purchase register uploaded for the 2B reconciliation?', a: 'No. Your register and the GSTR-2B file are both read and compared in your own browser, and the report is written there. Nothing leaves your device.' },
      { q: 'Does the e-invoice tool generate the IRN?', a: 'No, and nothing offline can: the IRN is issued by the portal when it accepts the JSON. The tool builds schema 1.1 JSON for the bulk upload from a spreadsheet, with every GSTIN checked against its checksum and the totals computed from the items, so what you upload is consistent before the portal sees it.' }
    ],
    collections: ['shopkeepers', 'accountants', 'small-business', 'online-sellers'],
    sources: {
      heading: 'The authorities, rather than us',
      refs: [
        ['gstPortal', 'returns, GSTR-2B and the conditions for claiming input tax credit'],
        ['gstRates', 'the tariff and the notified rates — the classification you file is yours'],
        ['eInvoice', 'the e-invoice schema, the mandatory fields and who must issue an e-invoice']
      ]
    }
  }
];

module.exports = { COMPARISONS, REF, COMPETITORS };
