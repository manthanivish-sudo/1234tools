/**
 * What each tool does, in a register.
 *
 *   node build/jobs.js    print every non-conversion tool with its verb, its
 *                         in → out line and its card description; exit 1 if
 *                         any tool is unmapped or any description is too long
 *
 * A hub that lists twenty cards alphabetically asks the reader to know the
 * names already. Grouping the cards by the job — Make, Convert, Check,
 * Calculate, Clean up — lets someone who has never seen the site find the
 * right card by what they came to do. The verb, the one-line "what goes in →
 * what comes out" and the short description for every tool live here, so the
 * hubs (build-hubs.js), the directory (build-tools.js) and the finder read one
 * table and cannot disagree.
 *
 * Every tool in the register has an explicit entry. The per-section defaults
 * exist for a tool added later, so a new page still lands under a heading;
 * the self-test names tools that fell back to a default so the entry can be
 * written properly.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { SECTIONS, sectionOf } = require('./sections.js');
const { pricingFor } = require('./collections.js');

const ROOT = path.join(__dirname, '..');

/* Display order. Five verbs cover everything the site does; a sixth would
   be a heading with one card under it. */
const VERBS = ['Make', 'Convert', 'Check', 'Calculate', 'Clean up'];

const IO_MAX = 32;
const DESC_MAX = 110;

/* A section's default when a tool has no entry of its own. */
const SECTION_DEFAULT = {
  '/business/':    ['Calculate', 'Figures → result'],
  '/ai/':          ['Make', 'Your facts → draft'],
  '/pdf/':         ['Convert', 'PDF → PDF'],
  '/education/':   ['Calculate', 'Marks → result'],
  '/india/':       ['Calculate', 'Figures → result'],
  '/developer/':   ['Convert', 'Text → text'],
  '/image/':       ['Convert', 'Image → image'],
  '/ai-image/':    ['Make', 'Photo → PNG/GIF/MP4'],
  '/ai-video/':    ['Make', 'Video → MP4'],
  '/social/':      ['Make', 'Text → post images'],
  '/video/':       ['Convert', 'Video → video'],
  '/audio/':       ['Convert', 'Sound → sound'],
  '/text/':        ['Check', 'Text → result'],
  '/mathematics/': ['Calculate', 'Numbers → result'],
  '/finance/':     ['Calculate', 'Figures → result'],
  '/time/':        ['Calculate', 'Dates → result'],
  '/health/':      ['Calculate', 'Measurements → estimate'],
  '/qr/':          ['Make', 'Text → QR code'],
  '/utilities/':   ['Calculate', 'Figures → result'],
  '/engineering/': ['Calculate', 'Values → result'],
  '/design/':      ['Calculate', 'Dimensions → result']
};

/* path → [verb, in → out]. Read from each tool's own title and description;
   the io line is what you give it and what you get back, in 32 characters. */
const JOBS = {
  /* finance */
  '/finance/compound-interest/': ['Calculate', 'Deposit + rate → growth'],
  '/finance/loan-payment/': ['Calculate', 'Loan terms → monthly payment'],
  '/finance/vat-sales-tax/': ['Calculate', 'Net or gross → tax split'],

  /* mathematics */
  '/mathematics/percentage/': ['Calculate', 'Two numbers → percentage'],
  '/mathematics/quadratic-solver/': ['Calculate', 'a, b, c → roots and vertex'],
  '/mathematics/statistics/': ['Calculate', 'Data set → mean, SD, quartiles'],
  '/mathematics/fraction-calculator/': ['Calculate', 'Fractions → result, decimal'],
  '/mathematics/ratio-calculator/': ['Calculate', 'Ratio → simplified or scaled'],
  '/mathematics/average-calculator/': ['Calculate', 'Numbers → mean, median, mode'],
  '/mathematics/prime-factorisation/': ['Calculate', 'Number → prime factors'],
  '/mathematics/lcm-gcd/': ['Calculate', 'Numbers → LCM and GCD'],
  '/mathematics/geometry-calculator/': ['Calculate', 'Dimensions → area, volume'],
  '/mathematics/roman-numerals/': ['Convert', 'Number → Roman numeral, back'],
  '/mathematics/number-base-converter/': ['Convert', 'Number → binary, hex, any base'],
  '/mathematics/scientific-calculator/': ['Calculate', 'Expression → result'],

  /* engineering, design */
  '/engineering/ohms-law/': ['Calculate', 'Any two of V, I, R → the rest'],
  '/engineering/gauge-absolute-pressure/': ['Convert', 'Gauge or absolute → both'],
  '/design/aspect-ratio/': ['Calculate', 'One dimension → the other'],

  /* health */
  '/health/bmi/': ['Calculate', 'Height + weight → BMI'],
  '/health/bmr-tdee/': ['Calculate', 'Body + activity → kcal a day'],
  '/health/body-fat/': ['Calculate', 'Tape measurements → body fat %'],
  '/health/ideal-weight/': ['Calculate', 'Height → reference weight range'],
  '/health/water-intake/': ['Calculate', 'Weight + activity → litres a day'],
  '/health/heart-rate-zones/': ['Calculate', 'Age or max HR → training zones'],
  '/health/pregnancy-due-date/': ['Calculate', 'Last period → due date'],
  '/health/ovulation-calculator/': ['Calculate', 'Cycle dates → fertile window'],

  /* utilities */
  '/utilities/fuel-efficiency/': ['Calculate', 'MPG or L/100km → trip cost'],
  '/utilities/tip-calculator/': ['Calculate', 'Bill → tip and split'],
  '/utilities/square-footage/': ['Calculate', 'Room sizes → area and cost'],
  '/utilities/random-number-generator/': ['Make', 'Range → random numbers'],
  '/utilities/dice-roller/': ['Make', 'Dice notation → rolls'],
  '/utilities/gpa-calculator/': ['Calculate', 'Grades + credits → GPA'],
  '/utilities/cooking-converter/': ['Convert', 'Cups → grams, ml, ounces'],
  '/utilities/shoe-size-converter/': ['Convert', 'Shoe size → UK, US, EU, JP'],
  '/utilities/tool-finder/': ['Convert', 'Job in words → the right tool'],

  /* time */
  '/time/date-difference/': ['Calculate', 'Two dates → years, months, days'],
  '/time/age-calculator/': ['Calculate', 'Birth date → exact age'],
  '/time/date-add-subtract/': ['Calculate', 'Date ± days → new date'],
  '/time/week-number/': ['Calculate', 'Date → ISO week number'],
  '/time/business-days/': ['Calculate', 'Two dates → working days'],
  '/time/timezone-converter/': ['Convert', 'Time → other time zones'],
  '/time/countdown-timer/': ['Make', 'Date → live countdown'],
  '/time/stopwatch-timer/': ['Make', 'Start → laps, timer, Pomodoro'],

  /* developer */
  '/developer/json-formatter/': ['Clean up', 'JSON → formatted, validated'],
  '/developer/xml-formatter/': ['Clean up', 'XML → tidy, validated'],
  '/developer/csv-to-json/': ['Convert', 'CSV → JSON, and back'],
  '/developer/base64/': ['Convert', 'Text → Base64, and back'],
  '/developer/url-encoder/': ['Convert', 'Text → percent-encoded URL'],
  '/developer/html-entities/': ['Convert', 'Text → HTML entities, and back'],
  '/developer/jwt-decoder/': ['Check', 'JWT → header, payload, expiry'],
  '/developer/meta-tag-generator/': ['Make', 'Page details → meta tags'],
  '/developer/robots-txt-generator/': ['Make', 'Crawl rules → robots.txt'],
  '/developer/htaccess-generator/': ['Make', 'Options → .htaccess rules'],
  '/developer/uuid-generator/': ['Make', 'One click → v4 UUIDs'],
  '/developer/lorem-ipsum/': ['Make', 'Length → placeholder text'],
  '/developer/slug-generator/': ['Convert', 'Title → URL slug'],
  '/developer/case-converter/': ['Convert', 'Text → camelCase, snake_case…'],
  '/developer/color-converter/': ['Convert', 'Colour → HEX, RGB, HSL, contrast'],
  '/developer/css-gradient/': ['Make', 'Colour stops → CSS gradient'],
  '/developer/favicon-generator/': ['Make', 'One image → every favicon size'],
  '/developer/hash-generator/': ['Convert', 'Text → SHA-256, MD5, CRC32'],
  '/developer/regex-tester/': ['Check', 'Pattern + text → matches'],
  '/developer/cron-parser/': ['Check', 'Cron expression → next runs'],
  '/developer/markdown-preview/': ['Convert', 'Markdown → HTML'],

  /* qr */
  '/qr/qr-code-generator/': ['Make', 'Link, WiFi, card → QR code'],
  '/qr/qr-code-scanner/': ['Check', 'Camera or photo → QR contents'],
  '/qr/qr-bulk-generator/': ['Make', 'List or CSV → hundreds of QRs'],

  /* business */
  '/business/currency-converter/': ['Convert', 'Amount → 150+ currencies'],
  '/business/profit-margin/': ['Calculate', 'Cost + price → margin, markup'],
  '/business/break-even/': ['Calculate', 'Costs + price → break-even point'],
  '/business/roi/': ['Calculate', 'Investment → ROI and payback'],
  '/business/npv-irr/': ['Calculate', 'Cash flows → NPV and IRR'],
  '/business/cagr/': ['Calculate', 'Start + end value → CAGR'],
  '/business/depreciation/': ['Calculate', 'Asset cost → yearly schedule'],
  '/business/amortization-schedule/': ['Calculate', 'Loan → payment-by-payment table'],
  '/business/business-ratios/': ['Calculate', 'Accounts → financial ratios'],
  '/business/uk-take-home-pay/': ['Calculate', 'Gross salary → UK take-home'],
  '/business/employer-cost/': ['Calculate', 'Salary → true employer cost'],
  '/business/discount-calculator/': ['Calculate', 'Price + discount → sale price'],
  '/business/commission-calculator/': ['Calculate', 'Sales → commission earned'],
  '/business/invoice-payment-terms/': ['Calculate', 'Invoice → due date and interest'],
  '/business/tally-converter/': ['Convert', 'Excel/CSV → Tally import XML'],
  '/business/accounting-converter/': ['Convert', 'QuickBooks/Zoho → Tally vouchers'],
  '/business/bank-reconciliation/': ['Check', 'Statement + ledger → unmatched'],
  '/business/einvoice-json/': ['Convert', 'Invoice sheet → e-invoice JSON'],
  '/business/gst-reconciler/': ['Check', 'Purchases + GSTR-2B → ITC check'],
  '/business/id-validator/': ['Check', 'Column of IDs → valid or not'],
  '/business/mail-merge/': ['Make', 'Letter + spreadsheet → PDFs'],
  '/business/sheet-merge/': ['Clean up', 'Many sheets → one, deduped'],
  '/business/receivables-ageing/': ['Make', 'Invoices → ageing + reminders'],
  '/business/ctc-structure/': ['Calculate', 'CTC → salary structure, in-hand'],
  '/business/full-final-settlement/': ['Calculate', 'Leaving employee → settlement'],
  '/business/payroll-run/': ['Make', 'Salary sheet → payroll pack'],
  '/business/bookkeeping/': ['Make', 'Journals → trial balance, P&L'],
  '/business/mtd-checker/': ['Check', 'Your income → does MTD apply'],
  '/business/mtd-quarterly-update/': ['Calculate', 'Spreadsheet → quarterly figures'],
  '/business/vat-return/': ['Calculate', 'Spreadsheet → nine VAT boxes'],

  /* india */
  '/india/gst-calculator/': ['Calculate', 'Amount → GST split'],
  '/india/india-income-tax/': ['Calculate', 'Income → tax, both regimes'],
  '/india/hra-exemption/': ['Calculate', 'Salary + rent → HRA exemption'],
  '/india/india-capital-gains/': ['Calculate', 'Buy + sell → capital gains tax'],
  '/india/tds-calculator/': ['Calculate', 'Payment → TDS to deduct'],
  '/india/sip-calculator/': ['Calculate', 'Monthly SIP → future value'],
  '/india/lumpsum-returns/': ['Calculate', 'One-time sum → future value'],
  '/india/ppf-calculator/': ['Calculate', 'Yearly deposit → PPF maturity'],
  '/india/epf-calculator/': ['Calculate', 'Basic pay → EPF at retirement'],
  '/india/gratuity-calculator/': ['Calculate', 'Salary + years → gratuity'],
  '/india/fd-rd-calculator/': ['Calculate', 'Deposit → maturity value'],
  '/india/nps-calculator/': ['Calculate', 'NPS contribution → corpus at 60'],
  '/india/ctc-take-home/': ['Calculate', 'CTC → monthly in-hand pay'],
  '/india/emi-calculator/': ['Calculate', 'Loan → EMI and schedule'],
  '/india/advance-tax/': ['Calculate', 'Income → quarterly instalments'],

  /* image */
  '/image/image-compressor/': ['Clean up', 'Photo → smaller JPEG/PNG/WebP/AVIF'],
  '/image/image-converter/': ['Convert', 'Image → PNG, JPEG, WebP, AVIF, GIF, BMP or ICO'],
  '/image/image-resizer/': ['Convert', 'Image → resized image'],
  '/image/bulk-image-resizer/': ['Convert', 'Many images → resized ZIP'],
  '/image/image-cropper/': ['Convert', 'Image → cropped image'],
  '/image/social-media-resizer/': ['Make', 'One image → every platform size'],
  '/image/circle-crop/': ['Make', 'Photo → round avatar PNG'],
  '/image/image-border/': ['Make', 'Photo → bordered or framed photo'],
  '/image/image-rotate-flip/': ['Convert', 'Image → rotated or mirrored'],
  '/image/photo-filters/': ['Clean up', 'Photo → adjusted or filtered'],
  '/image/blur-redact/': ['Clean up', 'Image → faces, details hidden'],
  '/image/exif-viewer/': ['Check', 'Photo → hidden metadata, GPS'],
  '/image/exif-remover/': ['Clean up', 'Photo → metadata stripped'],
  '/image/image-to-pdf/': ['Convert', 'JPEG/PNG images → one PDF'],
  '/image/image-splitter/': ['Convert', 'Image → grid of tiles'],
  '/image/meme-generator/': ['Make', 'Image + captions → meme'],
  '/image/color-palette-extractor/': ['Convert', 'Image → HEX, RGB, HSL palette'],
  '/image/svg-optimizer/': ['Clean up', 'SVG → smaller SVG'],
  '/image/image-to-base64/': ['Convert', 'Image → Base64 data URI'],
  '/image/passport-photo/': ['Make', 'Photo → passport sheet to print'],
  '/image/background-remover/': ['Clean up', 'Product photo → transparent PNG'],

  /* ai-image */
  '/ai-image/text-behind-image/': ['Make', 'Photo → PNG/GIF/MP4'],
  '/ai-image/background-remover/': ['Clean up', 'Photo → transparent PNG/WebP'],
  '/ai-image/sticker-maker/': ['Make', 'Photo → sticker PNG or pack'],
  '/ai-image/blur-background/': ['Make', 'Photo → portrait-mode PNG'],
  '/ai-image/3d-photo-parallax/': ['Make', 'Photo → 6 s MP4/GIF loop'],
  '/ai-image/object-remover/': ['Clean up', 'Photo + brush → clean PNG'],
  '/ai-image/color-pop/': ['Make', 'Photo → PNG/MP4/GIF'],
  '/ai-image/sky-replacement/': ['Make', 'Photo → new sky PNG/MP4'],
  '/ai-image/thumbnail-maker/': ['Make', 'Photo + title → 1280×720'],
  '/ai-image/face-blur/': ['Clean up', 'Photo/video → blurred faces'],
  '/ai-image/image-upscaler/': ['Clean up', 'Photo → 2×/4× PNG/JPEG/WebP'],
  '/ai-image/film-grain/': ['Make', 'Photo → grainy PNG/GIF/MP4'],
  /* ai-video */
  '/ai-video/auto-captions/': ['Make', 'Video → captioned MP4 + SRT'],
  '/ai-video/reel-maker/': ['Make', 'Script → 9:16 MP4 reel'],
  /* social */
  '/social/carousel-maker/': ['Make', 'Slides → PNG ZIP or PDF'],
  '/social/social-post-maker/': ['Make', 'Text + brand → post images'],
  '/social/caption-counter/': ['Check', 'Caption → limits per platform'],
  '/social/engagement-rate-calculator/': ['Calculate', 'Likes, followers → rates'],
  '/social/video-to-gif/': ['Make', 'Video → animated GIF'],
  '/social/reels-resizer/': ['Make', 'Landscape video → 9:16 MP4'],
  '/social/link-in-bio/': ['Make', 'Links → one HTML page'],
  /* video */
  '/video/video-compressor/': ['Clean up', 'Video → smaller MP4'],
  '/video/video-trimmer/': ['Clean up', 'Video → the part you keep'],
  '/video/video-converter/': ['Convert', 'MOV/WebM/MKV → MP4 or WebM'],
  '/video/mute-video/': ['Clean up', 'Video → same video, no sound'],
  '/video/extract-audio/': ['Convert', 'Video → M4A, WAV or Ogg'],
  '/video/video-resizer/': ['Convert', 'Video → new size or shape'],
  '/video/video-to-frames/': ['Convert', 'Video → PNG or JPG frames'],
  '/video/screen-recorder/': ['Make', 'Screen → video recording'],
  '/video/webcam-recorder/': ['Make', 'Camera → video recording'],
  /* audio */
  '/audio/audio-converter/': ['Convert', 'MP3/FLAC/Ogg → WAV, M4A, Opus'],
  '/audio/audio-trimmer/': ['Clean up', 'Sound → the part you keep'],
  '/audio/audio-joiner/': ['Make', 'Several files → one file'],
  '/audio/volume-normaliser/': ['Clean up', 'Sound → −14/−16/−23 LUFS'],
  '/audio/speed-changer/': ['Convert', 'Sound → faster or slower'],
  '/audio/silence-remover/': ['Clean up', 'Recording → pauses removed'],
  '/audio/voice-recorder/': ['Make', 'Microphone → recording'],
  '/audio/text-to-speech/': ['Make', 'Text → spoken WAV/M4A'],
  '/audio/audio-to-text/': ['Convert', 'Recording → text, SRT, VTT'],
  '/audio/waveform-video/': ['Make', 'Sound + picture → MP4'],

  /* text */
  '/text/word-counter/': ['Check', 'Text → words, reading time'],
  '/text/text-diff/': ['Check', 'Two texts → the differences'],
  '/text/readability-score/': ['Check', 'Text → readability grades'],
  '/text/case-tools/': ['Clean up', 'Messy text → tidy text'],
  '/text/number-to-words/': ['Convert', 'Number → words'],
  '/text/morse-code/': ['Convert', 'Text → Morse code, and back'],
  '/text/caesar-cipher/': ['Convert', 'Text → shifted cipher, ROT13'],
  '/text/palindrome-anagram/': ['Check', 'Phrases → palindrome, anagram'],
  '/text/password-generator/': ['Make', 'Length + rules → password'],

  /* pdf */
  '/pdf/merge-pdf/': ['Make', 'PDFs → PDF'],
  '/pdf/split-pdf/': ['Convert', 'PDF → several PDFs'],
  '/pdf/extract-pdf-pages/': ['Convert', 'PDF → chosen pages as PDF'],
  '/pdf/delete-pdf-pages/': ['Clean up', 'PDF → PDF minus unwanted pages'],
  '/pdf/rotate-pdf/': ['Convert', 'PDF → PDF, pages rotated'],
  '/pdf/pdf-metadata/': ['Clean up', 'PDF → metadata edited or gone'],
  '/pdf/pdf-inspector/': ['Check', 'PDF → structure, fonts, pages'],
  '/pdf/watermark-pdf/': ['Make', 'PDF + text → watermarked PDF'],
  '/pdf/pdf-page-numbers/': ['Make', 'PDF → PDF with page numbers'],
  '/pdf/text-to-pdf/': ['Convert', 'Plain text → paginated PDF'],
  '/pdf/invoice-pdf/': ['Make', 'Line items → invoice PDF'],
  '/pdf/paper-pdf/': ['Make', 'Paper type → printable PDF'],
  '/pdf/label-pdf/': ['Make', 'Address list → label sheet PDF'],
  '/pdf/certificate-pdf/': ['Make', 'Name list → certificate PDFs'],
  '/pdf/pdf-to-images/': ['Convert', 'PDF pages → PNG or JPEG'],
  '/pdf/pdf-organise/': ['Clean up', 'PDF → reordered, trimmed PDF'],
  '/pdf/pdf-editor/': ['Make', 'PDF → PDF with your text on it'],
  '/pdf/pdf-signature/': ['Make', 'PDF + signature → signed PDF'],
  '/pdf/compress-pdf/': ['Clean up', 'PDF → smaller PDF'],
  '/pdf/protect-pdf/': ['Make', 'PDF + password → encrypted PDF'],
  '/pdf/unlock-pdf/': ['Clean up', 'PDF + its password → open PDF'],
  '/pdf/pdf-to-text/': ['Convert', 'PDF → plain text'],
  '/pdf/pdf-to-word/': ['Convert', 'PDF → Word document'],
  '/pdf/ocr-pdf/': ['Convert', 'Scanned PDF → searchable PDF'],
  '/pdf/image-to-text/': ['Convert', 'Photo or scan → text'],
  '/pdf/scan-to-pdf/': ['Make', 'Camera photos → PDF'],
  '/pdf/flatten-pdf/': ['Clean up', 'PDF → PDF, forms flattened'],
  '/pdf/crop-pdf/': ['Clean up', 'PDF → PDF, margins cropped'],
  '/pdf/add-image-to-pdf/': ['Make', 'PDF + picture → PDF'],
  '/pdf/payslip-pdf/': ['Make', 'Pay details → payslip PDF'],
  '/pdf/quotation-pdf/': ['Make', 'Line items → quotation PDF'],
  '/pdf/purchase-order-pdf/': ['Make', 'Line items → purchase order PDF'],
  '/pdf/delivery-challan-pdf/': ['Make', 'Goods list → challan PDF'],

  /* education */
  '/education/cgpa-to-percentage/': ['Convert', 'CGPA → percentage, and back'],
  '/education/sgpa-to-cgpa/': ['Calculate', 'Semester SGPAs → CGPA'],
  '/education/marks-percentage/': ['Calculate', 'Subject marks → total, grade'],
  '/education/attendance-calculator/': ['Calculate', 'Classes held → attendance %'],
  '/education/percentile-rank/': ['Convert', 'Rank → percentile, and back'],
  '/education/exam-countdown/': ['Calculate', 'Exam date → study days, hours'],
  '/education/timetable/': ['Make', 'Subject allocation → timetable'],
  '/education/exam-seating/': ['Make', 'Student list → seating plan'],
  '/education/report-card/': ['Make', 'Marks sheet → report card PDFs'],

  /* ai */
  '/ai/invoice-extractor/': ['Convert', 'Invoice PDF/text → table'],
  '/ai/bank-statement-categoriser/': ['Convert', 'Bank statement → ledger heads'],
  '/ai/data-cleaner/': ['Clean up', 'Messy list → clean, deduped list'],
  '/ai/business-writer/': ['Make', 'Facts → email or letter'],
  '/ai/product-listing-writer/': ['Make', 'Product list → store listings'],
  '/ai/document-summariser/': ['Convert', 'Contract → plain summary'],
  '/ai/meeting-minutes/': ['Convert', 'Rough notes → minutes, actions'],
  '/ai/social-post-writer/': ['Make', 'One message → posts per platform'],
  '/ai/hsn-gst-finder/': ['Check', 'Product words → HSN code, rate'],
  '/ai/form16-reader/': ['Convert', 'Form 16 PDF → tax fields'],
  '/ai/seo-writer/': ['Make', 'Topic → title, meta, outline'],
  '/ai/blog-writer/': ['Make', 'Brief → blog post'],
  '/ai/ad-copy-writer/': ['Make', 'Offer → Google and Meta ads'],
  '/ai/email-campaign-writer/': ['Make', 'Facts → campaign emails'],
  '/ai/brand-voice-guide/': ['Make', 'Sample copy → voice guide'],
  '/ai/landing-page-writer/': ['Make', 'Product + offer → page copy'],
  '/ai/scanned-invoice-extractor/': ['Convert', 'Receipt photo → table'],
  '/ai/receipt-batch-reader/': ['Convert', 'Receipt photos → CSV or Excel'],
  '/ai/kyc-document-reader/': ['Convert', 'ID photo → typed fields'],
  '/ai/quotation-writer/': ['Make', 'Deal facts → quotation'],
  '/ai/whatsapp-template-writer/': ['Make', 'Purpose → WhatsApp templates'],
  '/ai/review-responder/': ['Make', 'Reviews → replies and fixes'],
  '/ai/contract-generator/': ['Make', 'Parties + terms → draft contract'],
  '/ai/job-description-writer/': ['Make', 'Role facts → job description'],
  '/ai/cv-screener/': ['Check', 'JD + CVs → fit scores'],
  '/ai/excel-formula-helper/': ['Make', 'Plain words → Excel formula'],
  '/ai/business-translator/': ['Convert', 'Document → 13 languages'],
  '/ai/question-paper-writer/': ['Make', 'Blueprint → question paper'],
  '/ai/lesson-plan-writer/': ['Make', 'Topic → lesson plan, worksheet'],
  '/ai/student-comment-writer/': ['Make', 'Class list → report comments'],
  '/ai/rubric-writer/': ['Make', 'Task → marking rubric'],
  '/ai/parent-message-writer/': ['Make', 'Purpose → message home'],
  '/ai/ncert-solution-writer/': ['Make', 'Question → worked explanation'],
  '/ai/video-script-writer/': ['Make', 'Topic → video script'],
  '/ai/youtube-metadata-writer/': ['Make', 'Video outline → titles, tags'],
  '/ai/video-hook-writer/': ['Make', 'Video idea → ten openings'],
  '/ai/podcast-show-notes/': ['Convert', 'Transcript → show notes'],
  '/ai/article-writer/': ['Make', 'Brief → long-form article'],
  '/ai/story-editor/': ['Check', "Your draft → editor's notes"],
  '/ai/newsletter-writer/': ['Make', 'Notes → newsletter issue'],
  '/ai/content-repurposer/': ['Convert', 'One piece → six formats'],
  '/ai/contract-reviewer/': ['Check', 'Contract → structured first read'],
  '/ai/legal-letter-writer/': ['Make', 'Facts → draft legal letter'],
  '/ai/case-summariser/': ['Convert', 'Bundle → chronology, issues'],
  '/ai/property-listing-writer/': ['Make', 'Property facts → draft listing'],
  '/ai/tenancy-agreement-drafter/': ['Make', 'Terms → draft tenancy agreement'],
  '/ai/property-document-reader/': ['Convert', 'Document photo → typed fields'],
  '/ai/clinic-letter-writer/': ['Make', 'Dictation → admin letter'],
  '/ai/patient-info-writer/': ['Make', 'Your words → patient leaflet']
};

/* Card descriptions, where the automatic cut of the page's own description
   read badly: a sentence that stopped mid-list, or a fragment ending in an
   ellipsis. ≤ 110 characters, one or two plain sentences. */
const DESCS = {
  '/qr/qr-code-generator/': 'QR codes for links, WiFi, contact cards and UPI, with custom colours and a logo. Download as SVG or PNG.',
  '/qr/qr-code-scanner/': 'Scan a QR code with your camera or from a picture, and see where a link really goes before you open it.',
  '/qr/qr-bulk-generator/': 'Turn a list or a CSV into hundreds of QR codes at once, all sharing one look, as PNG or SVG.',
  '/business/currency-converter/': 'Convert between 150+ currencies using daily reference rates. Rates are cached, so it works offline.',
  '/business/tally-converter/': 'Turn a spreadsheet of vouchers into Tally import XML, and bring Tally’s XML back into Excel.',
  '/business/accounting-converter/': 'Move journals and invoices between QuickBooks, Zoho Books and Tally, every voucher checked to balance.',
  '/business/bank-reconciliation/': 'Match a bank statement against your ledger and get the unmatched entries on each side, explained.',
  '/business/einvoice-json/': 'Turn a spreadsheet of invoices into the JSON the GST e-invoice portal accepts, checked before upload.',
  '/business/gst-reconciler/': 'Match your purchase register against GSTR-2B and see which input tax credit is safe to claim.',
  '/business/id-validator/': 'Check a whole column of GSTINs, PANs, IFSC codes and more at once, with the reason for every failure.',
  '/business/mail-merge/': 'One letter with placeholders plus a spreadsheet of recipients gives you a PDF for every row.',
  '/business/sheet-merge/': 'Combine up to ten Excel or CSV files into one sheet, then remove duplicates on the columns you choose.',
  '/business/receivables-ageing/': 'Turn unpaid invoices into an ageing report by customer, with a reminder letter for each debtor.',
  '/business/ctc-structure/': 'Turn an annual CTC into the full salary structure and the monthly in-hand, under both tax regimes.',
  '/business/full-final-settlement/': 'Everything a leaving employee is owed, from final salary to gratuity, as a signable PDF statement.',
  '/business/payroll-run/': 'From a salary sheet: a payslip PDF for every employee, the bank transfer CSV and the statutory summaries.',
  '/business/bookkeeping/': 'Turn journals or a bank statement into a double-entry ledger with trial balance, P&L and balance sheet.',
  '/business/mtd-checker/': 'Work out whether Making Tax Digital for Income Tax catches you, and from which April.',
  '/business/mtd-quarterly-update/': 'Turn your income and expense spreadsheet into the figures a Making Tax Digital quarterly update asks for.',
  '/business/vat-return/': 'Turn a spreadsheet of sales and purchases into the nine boxes of a UK VAT return, each box opened up.',
  '/ai/invoice-extractor/': 'Drop an invoice or receipt and get the vendor, dates, taxes and every line item back as a table.',
  '/ai/bank-statement-categoriser/': 'Every transaction on a bank statement categorised to a ledger head, as a spreadsheet or Tally vouchers.',
  '/ai/data-cleaner/': 'A messy customer, supplier or product list comes back normalised, with duplicates flagged and explained.',
  '/ai/business-writer/': 'Payment reminders, follow-ups, complaint replies and offer letters, written properly from a few facts.',
  '/ai/product-listing-writer/': 'Turn a bare product list into store-ready listings: title, description, bullets, SEO text and tags.',
  '/ai/document-summariser/': 'A contract, tender or policy summarised into what it says, who owes what, the dates and the money.',
  '/ai/meeting-minutes/': 'Rough notes or a transcript in; proper minutes out, with decisions, owners, dates and open questions.',
  '/ai/social-post-writer/': 'One announcement written as ready-to-post copy for LinkedIn, Instagram, Facebook, X and WhatsApp.',
  '/ai/hsn-gst-finder/': 'Describe a product or service in plain words and get the likely HSN or SAC codes with the GST rate.',
  '/ai/form16-reader/': 'Drop a Form 16 and get salary, deductions, quarterly TDS and the tax computed back as checkable fields.',
  '/ai/seo-writer/': 'A title that fits the search result, a meta description, an H1, an outline and the questions people ask.',
  '/ai/blog-writer/': 'A brief in, a finished post out, with headings and a summary. Anything unsupported is marked for you.',
  '/ai/ad-copy-writer/': 'A full set of Google and Meta ad copy from one offer, every line counted against its character limit.',
  '/ai/email-campaign-writer/': 'A launch, offer, win-back or onboarding email from your facts, with subject lines and a plain-text version.',
  '/ai/brand-voice-guide/': 'Paste copy you already like and get a voice guide: tone, words to use and avoid, and rewritten samples.',
  '/ai/landing-page-writer/': 'Hero, benefits, how it works, objections answered and calls to action, written from your facts only.',
  '/ai/scanned-invoice-extractor/': 'Photograph or scan an invoice or receipt and get every field and line item back as a table.',
  '/ai/receipt-batch-reader/': 'Photograph up to four receipts at a time and get one row per receipt as a CSV or Excel file.',
  '/ai/kyc-document-reader/': 'Photograph a PAN card, Aadhaar, passport or licence and get the typed fields back with a checklist.',
  '/ai/quotation-writer/': 'The facts of a deal written up as a quotation or short proposal, with line items, totals and terms.',
  '/ai/whatsapp-template-writer/': 'Three to five WhatsApp Business templates in Meta’s format, with a note on what gets each rejected.',
  '/ai/review-responder/': 'For every review: the sentiment, the issue, a reply in your voice and what to fix inside the business.',
  '/ai/contract-generator/': 'A full first draft of an NDA, service agreement or offer letter, with brackets where you still decide.',
  '/ai/job-description-writer/': 'A job description from the facts of a role, then checked for wording that puts good candidates off.',
  '/ai/cv-screener/': 'A fit score with reasoning for each CV against the job description, plus questions for the interview.',
  '/ai/excel-formula-helper/': 'Say what a cell should do and get the formula for Excel and Google Sheets, explained part by part.',
  '/ai/business-translator/': 'Letters, notices and price lists translated into 13 languages, with the terms that stay in English kept.',
  '/ai/question-paper-writer/': 'A full question paper from your blueprint, with a separate marking scheme and model answers.',
  '/ai/lesson-plan-writer/': 'A lesson plan a cover teacher could use, with a timed sequence, a printable worksheet and its answer key.',
  '/ai/student-comment-writer/': 'Paste the class list with marks and notes and get a report card comment for every pupil, by name.',
  '/ai/rubric-writer/': 'A marking rubric for a task you set: criteria against bands, marks per criterion, and what a top answer does.',
  '/ai/parent-message-writer/': 'The message home, written properly for its channel, with a second language where a family needs one.',
  '/ai/ncert-solution-writer/': 'Paste a textbook question and get the method worked step by step, the common mistake and one to try.',
  '/ai/video-script-writer/': 'A script you can read to camera: hook, timed outline, the spoken words in full and a B-roll list.',
  '/ai/youtube-metadata-writer/': 'Five titles counted against the 60-character limit, a description, chapters, tags and a pinned comment.',
  '/ai/video-hook-writer/': 'Ten opening lines for one video idea, each on a different angle, with the shot it opens on.',
  '/ai/podcast-show-notes/': 'Show notes from a transcript: summary, chapter timestamps, quotable lines and the links mentioned.',
  '/ai/article-writer/': 'A brief in, a full article out, with a standfirst and an ending that lands. No statistic is ever invented.',
  '/ai/story-editor/': 'An editor’s read of your own draft: what works, what does not, and the three things to fix first.',
  '/ai/newsletter-writer/': 'Your notes become a finished issue: subject lines, a real opening, the body in sections, one thing to click.',
  '/ai/content-repurposer/': 'One piece becomes six: a blog outline, a thread, three short scripts, a newsletter blurb and captions.',
  '/ai/contract-reviewer/': 'A structured first read of a contract for a qualified lawyer to check. A working note, not advice.',
  '/ai/legal-letter-writer/': 'A draft letter before action, client care letter or chaser for the fee-earner to check and sign.',
  '/ai/case-summariser/': 'A chronology and issues list from the papers for a qualified lawyer to check against the file.',
  '/ai/property-listing-writer/': 'A draft listing from your facts, with every statement that needs proof on file before it goes live.',
  '/ai/tenancy-agreement-drafter/': 'A first draft tenancy or leave-and-licence agreement for a solicitor or advocate to settle.',
  '/ai/property-document-reader/': 'The typed fields from a photo of a title document, survey or deed, with a checklist of what to verify.',
  '/ai/clinic-letter-writer/': 'A draft administrative letter built around the clinician’s own words, for them to check and sign.',
  '/ai/patient-info-writer/': 'Your own explanation turned into a plain-language draft a patient can read, for the clinician to check.',
  '/education/cgpa-to-percentage/': 'Convert CGPA to percentage and back, using your university’s own formula or one you enter yourself.',
  '/education/sgpa-to-cgpa/': 'Turn semester grade points into a cumulative CGPA, weighted by credits, with the equivalent percentage.',
  '/education/marks-percentage/': 'Add up marks across subjects and get the total, the percentage and the grade.',
  '/education/attendance-calculator/': 'Your attendance percentage, how many classes you can still miss, and how many you must attend in a row.',
  '/education/percentile-rank/': 'Convert between rank and percentile for any competitive exam, with the standard or the NTA formula.',
  '/education/exam-countdown/': 'Days left until your exam, how many of them are study days, and the hours a day your syllabus needs.',
  '/education/timetable/': 'A clash-free school timetable from the subject allocation: a grid for every class and every teacher.',
  '/education/exam-seating/': 'Seat a whole exam from a student list and a set of rooms, with a chart for every door and an attendance sheet.',
  '/education/report-card/': 'A printed report card for every student from a class marks spreadsheet, as one PDF each and one combined.',
  '/pdf/pdf-editor/': 'Put text anywhere on a PDF, on any pages, wrapped to a width. Click the page to place each piece.',
  '/pdf/pdf-signature/': 'Draw or type a signature onto a PDF and place it where you want. A visible signature, not a cryptographic one.',
  '/pdf/compress-pdf/': 'Make a PDF smaller: pictures scaled to the resolution you choose, streams compressed. Before and after shown.',
  '/pdf/protect-pdf/': 'Encrypt a PDF with a password, AES-256 by default, and choose whether it can be printed or copied.',
  '/pdf/unlock-pdf/': 'Remove the password from a PDF you can open, or lift its printing and copying restrictions.',
  '/pdf/pdf-to-text/': 'The text of a PDF as a .txt file, in reading order or as stored, with columns and headings kept apart.',
  '/pdf/pdf-to-word/': 'The text of a PDF as an editable Word file with headings, paragraphs and lists. Layout is not kept.',
  '/pdf/ocr-pdf/': 'Make a scanned PDF searchable and copyable: text recognised on your device, in English and Hindi.',
  '/pdf/image-to-text/': 'Read the text in a photo or a scan, in English or Hindi, on your device, and copy it or save it.',
  '/pdf/scan-to-pdf/': 'Photograph pages; the edges are found and straightened, the paper whitened, and a PDF made.',
  '/pdf/flatten-pdf/': 'Fix form answers and comments into the page, so they print as shown and can no longer be changed.',
  '/pdf/crop-pdf/': 'Draw a crop box on the page and apply it to every page, or only the ones you choose.',
  '/pdf/add-image-to-pdf/': 'Place a logo, a stamp or a photo on a PDF; drag and resize it, on one page or many.',
  '/pdf/payslip-pdf/': 'A clean, print-ready payslip PDF: company and employee details, earnings, deductions and the net pay.',
  '/pdf/quotation-pdf/': 'A quotation, proforma invoice or estimate as a clean PDF, with GST or VAT worked out and terms included.',
  '/pdf/purchase-order-pdf/': 'A purchase order PDF from the buyer’s side: supplier, line items with HSN/SAC, charges, tax and terms.',
  '/pdf/delivery-challan-pdf/': 'The document that travels with the goods, printed as Original, Duplicate and Triplicate copies.',
  '/image/background-remover/': 'Remove a plain background from product photos and logos by colour, in your browser; the AI Background Remover handles hair and busy scenes.',
  '/ai-image/text-behind-image/': 'Put text behind a person, car, building or sky in any photo. Animate it and export PNG, JPEG, GIF or MP4.',
  '/ai-image/background-remover/': 'Remove the background from any photo, or keep only the people, cars or sky. Transparent PNG or WebP.',
  '/ai-image/sticker-maker/': 'Cut a sticker from any photo, white outline and all: a WhatsApp or Telegram pack or a transparent PNG.',
  '/ai-image/blur-background/': 'Blur the background and keep the subject sharp: bokeh, motion or zoom blur that grows with distance.',
  '/ai-image/3d-photo-parallax/': 'Turn one still photo into a looping 3D parallax clip. A 6-second MP4 or GIF in 9:16, 1:1 or 16:9.',
  '/ai-image/object-remover/': 'Brush over a person, car, bin or cable and it is filled in by AI. One tap removes everyone in the shot.',
  '/ai-image/color-pop/': 'Keep one layer or one colour and turn the rest black and white, sepia or duotone. PNG, MP4 or GIF out.',
  '/ai-image/sky-replacement/': 'Swap a flat sky for blue, clouds, sunset, storm or stars, with the light matched. PNG, MP4 or GIF out.',
  '/ai-image/thumbnail-maker/': 'Face cut out with a glow, punched-up background, bold title on top. 1280×720 under 2 MB, three at once.',
  '/ai-image/face-blur/': 'Blur or pixelate every face in a photo or short video and tap the ones to keep. PNG or MP4 out.',
  '/ai-image/image-upscaler/': 'Upscale a photo 2× or 4×, or unblur it at its own size, with Real-ESRGAN. PNG, JPEG or WebP out.',
  '/ai-image/film-grain/': 'Film grain, light leaks, VHS tracking, a date stamp and faded colour. Seven presets; PNG, GIF or MP4.',
  '/ai-video/auto-captions/': 'Word-by-word animated captions on a video, transcribed offline by Whisper. MP4 with sound, SRT, VTT, ASS.',
  '/ai-video/reel-maker/': 'A script becomes a 9:16 reel: animated text, screenshots or screen recording, voice, music, captions. MP4 out.',
  '/social/carousel-maker/': 'Instagram and LinkedIn carousels from text slides and photos: a ZIP of PNGs, or one PDF for LinkedIn.',
  '/social/social-post-maker/': 'Quote and announcement posts in your brand colours, logo and fonts, exported in every platform size.',
  '/social/caption-counter/': 'Check a caption against Instagram, X, LinkedIn, TikTok, YouTube, Facebook and Threads limits.',
  '/social/engagement-rate-calculator/': 'Engagement rate by followers, by reach and per post, side by side, from likes, comments, shares and saves.',
  '/social/video-to-gif/': 'Trim a clip, crop it square or vertical, add a caption and save a GIF. Size shown before you export.',
  '/social/reels-resizer/': 'Landscape video to a 9:16, 4:5 or 1:1 MP4 over a blurred copy or a colour, with its sound and a title.',
  '/social/link-in-bio/': 'A link-in-bio page as one HTML file: photo, links and icons, eight themes, no scripts or tracking.',
  '/video/video-compressor/': 'Shrink a video to a size you choose, or a quality level, with the sizes before and after.',
  '/video/video-trimmer/': 'Cut a video to the frame, or copy the part untouched from a keyframe. MP4, MOV, WebM.',
  '/video/video-converter/': 'MOV, MKV and WebM to MP4 or WebM, copied untouched when the codecs already fit.',
  '/video/mute-video/': 'Remove the sound track from a video; the picture is copied untouched, so nothing is lost.',
  '/video/extract-audio/': 'Save a video’s sound as its own file: the original copied untouched, WAV or Opus.',
  '/video/video-resizer/': 'A video at a new size or shape — 9:16, square, 4:5 — over blurred bars, a colour, or cropped.',
  '/video/video-to-frames/': 'Save frames of a video as PNG or JPG: every frame, one every few seconds, or the one on screen.',
  '/video/screen-recorder/': 'Record a screen, window or tab with its sound and your microphone; save WebM or make an MP4.',
  '/video/webcam-recorder/': 'Record yourself with a webcam, mirrored preview, pause and stop; save the video or make an MP4.',
  '/audio/audio-converter/': 'MP3, FLAC, Ogg or a video’s sound to WAV, M4A or Opus; several files at once, with a ZIP.',
  '/audio/audio-trimmer/': 'Cut a sound file on its waveform, to the sample: keep a part or cut it out, with fades.',
  '/audio/audio-joiner/': 'Join sound files in order, with a gap or an equal-power crossfade between them.',
  '/audio/volume-normaliser/': 'Measure loudness in LUFS and bring a file to −14, −16 or −23 LUFS without clipping.',
  '/audio/speed-changer/': 'Speed a recording up or down, 0.5× to 2×, keeping the voice at its own pitch.',
  '/audio/silence-remover/': 'Find and cut the long pauses in a recording, keeping a little either side of the words.',
  '/audio/voice-recorder/': 'Record your microphone with a level meter and pause; save as WebM, WAV, M4A or Opus.',
  '/audio/text-to-speech/': 'Text read aloud by one of 28 natural English voices, run on your device. WAV, M4A, Opus.',
  '/audio/audio-to-text/': 'Transcribe a recording on your device with Whisper: text with times, SRT or VTT.',
  '/audio/waveform-video/': 'Turn a podcast clip or a song into an MP4 with a moving waveform, title and cover.',
  '/utilities/tool-finder/': 'Say what you need in plain words and it finds the right tool among all of them, on your device.'
};

/* The hub's "Start here" line: one or two tools most people come for. */
const START = {
  '/business/': ['/business/uk-take-home-pay/', '/business/vat-return/'],
  '/ai/': ['/ai/invoice-extractor/', '/ai/business-writer/'],
  '/pdf/': ['/pdf/merge-pdf/', '/pdf/split-pdf/'],
  '/education/': ['/education/cgpa-to-percentage/', '/education/attendance-calculator/'],
  '/india/': ['/india/gst-calculator/', '/india/india-income-tax/'],
  '/developer/': ['/developer/json-formatter/', '/developer/regex-tester/'],
  '/image/': ['/image/image-compressor/', '/image/image-converter/'],
  '/ai-image/': ['/ai-image/background-remover/', '/ai-image/text-behind-image/'],
  '/ai-video/': ['/ai-video/reel-maker/', '/ai-video/auto-captions/'],
  '/social/': ['/social/carousel-maker/', '/social/caption-counter/'],
  '/video/': ['/video/video-compressor/', '/video/video-trimmer/'],
  '/audio/': ['/audio/audio-converter/', '/audio/text-to-speech/'],
  '/text/': ['/text/word-counter/', '/text/text-diff/'],
  '/mathematics/': ['/mathematics/percentage/', '/mathematics/scientific-calculator/'],
  '/finance/': ['/finance/loan-payment/', '/finance/compound-interest/'],
  '/time/': ['/time/date-difference/', '/time/age-calculator/'],
  '/health/': ['/health/bmi/', '/health/bmr-tdee/'],
  '/qr/': ['/qr/qr-code-generator/', '/qr/qr-code-scanner/'],
  '/utilities/': ['/utilities/tool-finder/', '/utilities/tip-calculator/'],
  '/engineering/': ['/engineering/ohms-law/', '/engineering/gauge-absolute-pressure/'],
  '/design/': ['/design/aspect-ratio/']
};

/* ------------------------------------------------------------------ */

/* path → the calculator inputs a number typed into the Tool Finder fills,
   for the tools where one number is unmistakably the main input. "n" takes a
   lone plain number ("tip on 84.50"), "pct" one written with % ("15% tip");
   "pair" means the plain number only counts beside a percentage ("20% of
   150" fills both, "percentage of 150" fills nothing: alone it could be
   either box). The finder carries nothing when a question holds more numbers
   than that, a number with a unit after it ("30 years", "70 kg"), or when it
   has several answers. The self-test checks every key against the spec.
   Left out on purpose: two-number tools (BMI, ratio, fractions, CAGR); tools
   whose lone number could be either of two fields (CGPA ↔ percentage, shoe
   sizes, number bases, cooking units, FD vs RD); fields with a max the
   finder cannot see (PPF); dates (age needs a whole date of birth, not a
   year); and tools where "at age 30" would land in the money box (EPF, NPS,
   heart-rate zones). GST's rate is a select, so only its amount is here. */
const PREFILL = {
  '/utilities/tip-calculator/':        { n: 'bill', pct: 'tip' },
  '/mathematics/percentage/':          { n: 'total', pct: 'value', pair: true },
  '/business/discount-calculator/':    { n: 'original', pct: 'd1' },
  '/finance/vat-sales-tax/':           { n: 'amount', pct: 'rate' },
  '/india/gst-calculator/':            { n: 'amount' },
  '/finance/loan-payment/':            { n: 'amount', pct: 'rate' },
  '/india/emi-calculator/':            { n: 'amount', pct: 'rate' },
  '/business/amortization-schedule/':  { n: 'amount', pct: 'rate' },
  '/finance/compound-interest/':       { n: 'principal', pct: 'rate' },
  '/india/lumpsum-returns/':           { n: 'principal', pct: 'rate' },
  '/india/sip-calculator/':            { n: 'monthly', pct: 'rate' },
  '/india/india-income-tax/':          { n: 'gross' },
  '/business/uk-take-home-pay/':       { n: 'gross' },
  '/india/ctc-take-home/':             { n: 'ctc' },
  '/business/employer-cost/':          { n: 'salary' },
  '/india/gratuity-calculator/':       { n: 'salary' },
  '/india/tds-calculator/':            { n: 'amount' },
  '/business/commission-calculator/':  { n: 'sales' },
  '/business/depreciation/':           { n: 'cost' },
  '/mathematics/prime-factorisation/': { n: 'n' },
  '/mathematics/roman-numerals/':      { n: 'value' }
};

/** The finder index's 8th column for a tool: "n|pct" or "n|pct|pair", '' when none. */
function prefillOf(p) {
  const f = PREFILL[normalise(p)];
  if (!f) return '';
  return (f.n || '') + (f.pct || f.pair ? '|' + (f.pct || '') : '') + (f.pair ? '|pair' : '');
}

/** The inputs of the calculator spec a page mounts, or null when it mounts none. */
function specInputs(p) {
  const abs = path.join(ROOT, normalise(p).replace(/^\/+/, ''), 'index.html');
  if (!fs.existsSync(abs)) return null;
  const html = fs.readFileSync(abs, 'utf8');
  const id = /MVRTool\.mount\(window\.TOOLS\['([^']+)'\]/.exec(html);
  if (!id) return null;
  const box = { TOOLS: {} };
  for (const m of html.matchAll(/<script src="\/(engine\/(?:calc|biz|edu)-[^"]+\.js)"/g)) {
    try { new Function('window', 'document', fs.readFileSync(path.join(ROOT, m[1]), 'utf8'))(box, { addEventListener() {}, querySelector() { return null; } }); } catch (e) { /* not a spec file */ }
  }
  const spec = box.TOOLS[id[1]];
  return spec && Array.isArray(spec.inputs) ? spec.inputs : null;
}

const unesc = (s) => String(s)
  .replace(/&(?:amp|#0*38);/g, '&').replace(/&(?:lt|#0*60);/g, '<').replace(/&(?:gt|#0*62);/g, '>')
  .replace(/&(?:quot|#0*34);/g, '"').replace(/&(?:#0*39|apos|#x27);/g, '\'').replace(/&nbsp;/g, ' ');

const normalise = (p) => {
  let s = String(p || '');
  if (s.indexOf('/') !== 0) s = '/' + s;
  s = s.replace(/index\.html$/, '');
  if (!/\/$/.test(s)) s += '/';
  return s;
};

const isConversion = (p) => normalise(p).indexOf('/conversions/') === 0;

/** Every tool in the register, as it is listed there. */
let _register = null;
function register() {
  if (_register) return _register;
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  _register = (box.SEARCH_INDEX || []).map((e) => ({ title: String(e[0]), path: normalise(e[1]), glyph: String(e[2] || '') }));
  return _register;
}

/** The page's own <title> and meta description, read once. */
const _pages = {};
function pageOf(p) {
  const key = normalise(p);
  if (_pages[key] !== undefined) return _pages[key];
  const abs = path.join(ROOT, key.replace(/^\/+/, ''), 'index.html');
  if (!fs.existsSync(abs)) return (_pages[key] = null);
  const html = fs.readFileSync(abs, 'utf8');
  const d = /<meta name="description" content="([^"]*)">/.exec(html);
  const t = /<title>([^<]*)<\/title>/.exec(html);
  return (_pages[key] = { description: d ? unesc(d[1]) : '', title: t ? unesc(t[1]) : '' });
}

function tagsFor(p) {
  return pricingFor(normalise(p)).key === 'freemium' ? ['Free to try', 'AI'] : ['Free', 'On your device'];
}

/**
 * { verb, io, tags } for a tool path, or null when no rule covers it. A
 * conversion is always "Convert, number → number"; everything else has an
 * entry or falls back to its section's default (flagged by `defaulted`).
 */
function jobOf(p) {
  const key = normalise(p);
  if (isConversion(key)) return { verb: 'Convert', io: 'Number → number', tags: tagsFor(key), defaulted: false };
  if (JOBS[key]) return { verb: JOBS[key][0], io: JOBS[key][1], tags: tagsFor(key), defaulted: false };
  const sec = sectionOf(key);
  const def = sec && SECTION_DEFAULT[sec.url];
  if (!def) return null;
  return { verb: def[0], io: def[1], tags: tagsFor(key), defaulted: true };
}

/**
 * The automatic cut: the whole description when it fits; else the longest
 * run of whole sentences that fits; else a word boundary and an ellipsis.
 */
function cut(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  let best = '';
  const re = /[.!?](?=\s|$)/g;
  let m;
  while ((m = re.exec(s))) {
    const end = m.index + 1;
    if (end <= max) best = s.slice(0, end);
    else break;
  }
  if (best.length >= 40) return best;
  const words = s.slice(0, max - 1);
  return words.slice(0, words.lastIndexOf(' ')).replace(/[,;:–—-]$/, '') + '…';
}

/** The ≤ 110-character card description for a tool. */
function descOf(p) {
  const key = normalise(p);
  if (DESCS[key]) return DESCS[key];
  const page = pageOf(key);
  return cut(page ? page.description : '', DESC_MAX);
}

/* ------------------------------------------------------------------ */

function selfTest() {
  const tools = register().filter((t) => !isConversion(t.path));
  const problems = [];
  const defaulted = [];
  const byVerb = {};
  for (const t of tools) {
    const job = jobOf(t.path);
    const desc = descOf(t.path);
    if (!job) problems.push(t.path + ': no verb (no entry and no section default)');
    else {
      if (VERBS.indexOf(job.verb) < 0) problems.push(t.path + ': unknown verb ' + job.verb);
      if (job.io.length > IO_MAX) problems.push(t.path + ': io is ' + job.io.length + ' chars: ' + job.io);
      if (job.io.indexOf('→') < 0) problems.push(t.path + ': io has no →: ' + job.io);
      if (job.defaulted) defaulted.push(t.path);
      byVerb[job.verb] = (byVerb[job.verb] || 0) + 1;
    }
    if (!desc) problems.push(t.path + ': no description');
    if (desc.length > DESC_MAX) problems.push(t.path + ': description is ' + desc.length + ' chars');
    if (!pageOf(t.path)) problems.push(t.path + ': no page');
    console.log(t.path.padEnd(40) + (job ? job.verb.padEnd(10) + job.io.padEnd(IO_MAX + 2) : 'UNMAPPED'.padEnd(IO_MAX + 12)) + desc);
  }
  for (const p of Object.keys(JOBS).concat(Object.keys(DESCS))) {
    if (!tools.some((t) => t.path === p)) problems.push(p + ': in the table but not in the register');
  }
  for (const [p, f] of Object.entries(PREFILL)) {
    if (!tools.some((t) => t.path === p)) { problems.push('PREFILL names a tool not in the register: ' + p); continue; }
    const inputs = specInputs(p);
    if (!inputs) { problems.push('PREFILL ' + p + ': the page mounts no calculator spec'); continue; }
    for (const k of [f.n, f.pct].filter(Boolean)) {
      const inp = inputs.find((i) => i.key === k);
      if (!inp) problems.push('PREFILL ' + p + ': the spec has no input "' + k + '" (it has ' + inputs.map((i) => i.key).join(', ') + ')');
      else if (inp.type !== 'number' && !(inp.type === 'text' && k === f.n)) problems.push('PREFILL ' + p + ': "' + k + '" is a ' + inp.type + ', not a number');
      else if (inp.max !== undefined) problems.push('PREFILL ' + p + ': "' + k + '" has a max the finder cannot check');
    }
    if (f.pair && !(f.n && f.pct)) problems.push('PREFILL ' + p + ': pair needs both n and pct');
  }
  for (const [url, list] of Object.entries(START)) {
    if (!SECTIONS[url]) problems.push('START names a section the registry does not: ' + url);
    for (const p of list) if (!tools.some((t) => t.path === p)) problems.push('START for ' + url + ' names a tool not in the register: ' + p);
  }
  console.log('\nbuild/jobs.js');
  console.log('  tools               ' + tools.length + ' (conversions excluded)');
  console.log('  by verb             ' + VERBS.map((v) => v + ' ' + (byVerb[v] || 0)).join(', '));
  console.log('  overrides           ' + Object.keys(JOBS).length + ' jobs, ' + Object.keys(DESCS).length + ' descriptions');
  console.log('  start-here lines    ' + Object.keys(START).length + ' sections');
  console.log('  finder prefill      ' + Object.keys(PREFILL).length + ' calculators');
  if (defaulted.length) console.log('  ! on a section default (write an entry): ' + defaulted.join(', '));
  if (problems.length) {
    console.log('\n  ' + problems.length + ' problem(s):');
    problems.forEach((p) => console.log('    ' + p));
    process.exit(1);
  }
  console.log('  all mapped, every description within ' + DESC_MAX + ' characters\n');
}

if (require.main === module) selfTest();

module.exports = { VERBS, jobOf, descOf, prefillOf, PREFILL, START, JOBS, DESCS, SECTION_DEFAULT, register, pageOf, cut, isConversion, normalise, IO_MAX, DESC_MAX };
