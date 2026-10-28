/**
 * Collections, third batch: the audiences the site was invisible to.
 *
 * The first two batches were written for the people who wrote in — an
 * accountant, a school office, a shop doing its own GST. Six more groups
 * use the tools without ever having been told they are for them, and
 * each is large enough to matter on its own: people who make content for
 * Instagram, YouTube and TikTok; people who sell online; people looking
 * for work; teachers; photographers; designers. Around thirty-five tools
 * were built for the first of those and no page said so.
 *
 * Same shape as build/collections.js, plus optional fields the builder
 * reads when they are present:
 *
 *   next  — tools this audience would want that do not exist yet, shown
 *           as "coming next" with a link to ask for them. Honest about the
 *           gap, and the requests tell us what to build first.
 *   hi    — the Hindi version of the page (build/collections-hi.js fills
 *           it in; a page without one has no Hindi twin).
 *
 * TILES orders the home page's "I am a…" row and also covers collections
 * shipped in the earlier batches, so the row is one list in one place.
 *
 * Every path below is a real page. A path that does not resolve stops
 * the build rather than shipping a dead link.
 */
'use strict';

const COLLECTIONS = [
  {
    slug: 'creators', kind: 'role', glyph: 'i-ai-captions',
    name: 'Creators and influencers',
    title: 'Free tools for creators and influencers',
    lede: 'Captions, thumbnails, cut-outs, hooks and the brand-deal paperwork, for Instagram, YouTube, TikTok and podcasts. No forced watermark, no app, no upload.',
    intro: [
      'Most of the work behind a post is not the idea. It is the captions that take an hour by hand, the thumbnail that needs the face cut out and the background punched up, the same photo at four sizes for four apps, and the invoice for the brand that finally paid. The apps that do it want a subscription, put a watermark on the free version, or want your video on their server first.',
      'These run in your browser. The AI models for captions, cut-outs, upscaling and the rest are downloaded once and run on your own device, so an unreleased video or a client’s product shot never leaves it, and nothing you export carries a watermark you cannot switch off. The writing tools for hooks, scripts and titles are the exception: they send what you type to a language model, say so on the page, and give you ten free a month.'
    ],
    groups: [
      { name: 'Video', blurb: 'Reels from a script, captions burned in word by word, and clips made out of stills.', tools: ['/ai-video/reel-maker/', '/ai-video/auto-captions/', '/ai-image/3d-photo-parallax/', '/ai-image/text-behind-image/', '/ai-image/face-blur/'] },
      { name: 'Thumbnails and covers', blurb: 'The frame people decide on in half a second.', tools: ['/ai-image/thumbnail-maker/', '/ai-image/background-remover/', '/ai-image/blur-background/', '/ai-image/color-pop/', '/ai-image/image-upscaler/', '/ai-image/film-grain/'] },
      { name: 'Every size every app wants', blurb: 'One picture in; a carousel, a story, a square and an avatar out.', tools: ['/image/social-media-resizer/', '/image/image-splitter/', '/image/circle-crop/', '/image/image-compressor/', '/image/image-cropper/', '/ai-image/sticker-maker/', '/image/meme-generator/'] },
      { name: 'Words that get the click', blurb: 'Drafts to edit: the first three seconds, the script, the title and the tags.', tools: ['/ai/video-hook-writer/', '/ai/video-script-writer/', '/ai/youtube-metadata-writer/', '/ai/social-post-writer/', '/ai/content-repurposer/', '/ai/podcast-show-notes/', '/text/word-counter/'] },
      { name: 'The business of it', blurb: 'Brand deals, invoices in another currency, and the tax on what came in.', tools: ['/pdf/invoice-pdf/', '/pdf/quotation-pdf/', '/ai/contract-generator/', '/business/currency-converter/', '/qr/qr-code-generator/', '/india/india-income-tax/', '/business/uk-take-home-pay/'] }
    ],
    faq: [
      { q: 'Is there really no watermark?', a: 'None is forced on anything. The captioned video, the thumbnail, the cut-out and the clip are drawn and encoded by your own browser. The one mark on by default is a small “Made with 1234Tools.com” line at the bottom of a Reel Maker reel, and it switches off in Export. A reel whose voice is generated also says “AI voice” at the top, because synthetic voices are expected to be labelled.' },
      { q: 'Do my videos get uploaded?', a: 'No. Auto Captions downloads a 41 MB speech model into your browser once and transcribes on your device; the image tools do the same with their own models. Your clip is decoded, captioned and re-encoded on your own machine. The AI writing tools are different and say so on their pages: they send the text you type to a language model.' },
      { q: 'Will it work on my phone?', a: 'Yes, in current Chrome and Safari. Phones are slower than laptops at the AI steps, so the pages warn you before a long job; a one-minute clip is comfortable on a recent phone, ten minutes is a laptop job.' },
      { q: 'Can I use what I make commercially?', a: 'Yes. The output is yours, sponsored posts and client work included. The models are under licences that allow commercial use, and each tool’s page names its licence.' }
    ],
    related: ['marketers', 'designers', 'photographers', 'freelancers'],
    next: [
      { name: 'Engagement rate calculator', what: 'Followers, likes, comments and views in; engagement rate and how it compares out.' },
      { name: 'Video compressor and GIF maker', what: 'A clip under a platform’s size limit, without an upload.' },
      { name: 'Silence and filler cutter', what: 'The pauses and the ums found from the transcript and cut out.' }
    ]
  },
  {
    slug: 'online-sellers', kind: 'role', glyph: 'i-ai-background-remover',
    name: 'Online sellers',
    title: 'Free tools for online sellers',
    lede: 'White-background product photos, listings, margins after fees, GST, invoices and shipping labels — for Amazon, Flipkart, Meesho, Etsy, eBay and your own Shopify store.',
    intro: [
      'A marketplace listing is judged on its first photo, and the first photo has rules: a clean background, the right size, under the upload limit. Then come the listing copy, the price that still leaves a margin once the platform has taken its cut, the tax on it, and the invoice and the label for every order. A small seller does all of it, usually at night, usually with a different paid app for each step.',
      'Here the photo work happens in your browser. A product shot is cut out, cleaned up and resized on your own machine — forty at a time if you want — so an unreleased product never sits on somebody else’s server. The margin, GST and invoice tools are the same: figures in, answer out, nothing stored. The listing and reply writers are AI tools that send your text to a model and say so first.'
    ],
    groups: [
      { name: 'Product photos', blurb: 'The first image is the listing. Make it clean, sharp and the right size.', tools: ['/ai-image/background-remover/', '/image/background-remover/', '/ai-image/object-remover/', '/ai-image/image-upscaler/', '/image/bulk-image-resizer/', '/image/image-compressor/', '/image/image-converter/'] },
      { name: 'Listings and the words around them', blurb: 'Titles, bullets, ads and replies, as drafts in your own words.', tools: ['/ai/product-listing-writer/', '/ai/ad-copy-writer/', '/ai/review-responder/', '/ai/whatsapp-template-writer/', '/ai/business-translator/', '/image/social-media-resizer/'] },
      { name: 'Price, margin and tax', blurb: 'What a sale actually leaves you with.', tools: ['/business/profit-margin/', '/business/discount-calculator/', '/business/break-even/', '/india/gst-calculator/', '/ai/hsn-gst-finder/', '/finance/vat-sales-tax/', '/business/currency-converter/'] },
      { name: 'Orders and paperwork', blurb: 'The invoice, the label and the slip that go out with the parcel.', tools: ['/pdf/invoice-pdf/', '/pdf/label-pdf/', '/pdf/delivery-challan-pdf/', '/business/einvoice-json/', '/qr/qr-bulk-generator/', '/ai/receipt-batch-reader/', '/business/bookkeeping/'] }
    ],
    faq: [
      { q: 'Will the background remover give me the white background marketplaces ask for?', a: 'Yes. Cut the product out, then export it on white, or as a transparent PNG to place on any colour. Amazon and Flipkart both ask for a pure white main image; check the current pixel and size rules in your seller dashboard, because they change, and use the resizer to hit them.' },
      { q: 'Does the margin calculator know each marketplace’s fees?', a: 'Not by name — fee tables change often and differ by category, and a stale table would be worse than none. Enter the fee as a percentage or an amount and the calculator gives you the margin and markup after it. Your seller dashboard has the current figure.' },
      { q: 'Are my product photos uploaded?', a: 'No. The image tools are canvas and on-device AI operations in your own browser, so a product that has not launched yet can go through them. The AI writing tools are the exception and say so: they send your text to a model.' }
    ],
    related: ['shopkeepers', 'small-business', 'marketers', 'creators'],
    next: [
      { name: 'Marketplace fee and profit calculator', what: 'Amazon, Flipkart, Meesho, Etsy and eBay fee structures, each with the date it was checked.' },
      { name: 'Volumetric weight calculator', what: 'Box dimensions in; the weight couriers charge for out.' },
      { name: 'Barcode generator', what: 'EAN-13 and Code 128 labels for your stock, printed as a sheet.' },
      { name: 'Image watermark', what: 'Your logo on a batch of product photos before they go to a reseller.' }
    ]
  },
  {
    slug: 'job-seekers', kind: 'role', glyph: 'i-ai-cv',
    name: 'Job seekers',
    title: 'Free tools for job seekers',
    lede: 'Check your CV against the job, make the photo and the PDF the form wants, and work out what the offer pays after tax — without signing up to anything.',
    intro: [
      'Applying for jobs is mostly admin. The portal wants a photo of a certain size, the documents merged into one PDF under 2 MB, a signature on the form, and a CV that matches words in a job description nobody wrote clearly. Then an offer arrives as a CTC or a gross salary, and the number that matters — what lands in your account each month — is not in the letter.',
      'Everything here except the CV screener runs in your browser: your passport photo, your certificates and your payslips stay on your own device. The CV screener is an AI tool and says so on its page: it sends the CV and the job description to a model, with personal details like your phone number and email masked on your device first.'
    ],
    groups: [
      { name: 'The CV and the letter', blurb: 'Matched to the job, the right length, and read once more before it goes.', tools: ['/ai/cv-screener/', '/ai/business-writer/', '/text/word-counter/', '/text/readability-score/', '/text/text-diff/'] },
      { name: 'Photos the forms accept', blurb: 'Passport and profile photos at the size the portal asks for.', tools: ['/image/passport-photo/', '/ai-image/background-remover/', '/ai-image/blur-background/', '/image/circle-crop/', '/image/image-compressor/', '/image/image-cropper/'] },
      { name: 'Documents', blurb: 'Certificates merged, signed and under the upload limit.', tools: ['/pdf/merge-pdf/', '/image/image-to-pdf/', '/pdf/pdf-signature/', '/pdf/pdf-editor/', '/pdf/split-pdf/', '/pdf/pdf-organise/'] },
      { name: 'The offer', blurb: 'What it pays in your hand, and how it compares.', tools: ['/business/uk-take-home-pay/', '/india/ctc-take-home/', '/business/ctc-structure/', '/india/india-income-tax/', '/business/currency-converter/', '/time/timezone-converter/'] },
      { name: 'Exams and scores', blurb: 'The conversions every application form asks for.', tools: ['/education/cgpa-to-percentage/', '/education/percentile-rank/', '/education/marks-percentage/', '/education/exam-countdown/'] }
    ],
    faq: [
      { q: 'Is my CV sent anywhere?', a: 'Only by the CV screener, which is an AI tool and says so at the top of its page. It masks your email, phone number and ID numbers on your device before anything is sent, shows you what will go, and nothing is stored after the answer comes back. Every other tool here runs entirely in your browser.' },
      { q: 'Will the passport photo be accepted?', a: 'The tool lays out the photo at the official size for the country you pick and prints it as a sheet. Acceptance still depends on the photo itself — lighting, expression, a plain background — so read the checklist on the page before you print, and check the authority’s current rules.' },
      { q: 'My offer letter gives a CTC. What will I actually get?', a: 'Use the CTC to take-home calculator for India, or the UK take-home pay calculator for a gross salary in the UK. Both show the deductions line by line, so you can see where the difference between the headline and your account goes.' }
    ],
    related: ['students', 'freelancers', 'hr-payroll'],
    next: [
      { name: 'CV builder', what: 'A clean, ATS-friendly CV as a PDF, built in the browser.' },
      { name: 'Compress PDF', what: 'A document under the 1 or 2 MB limit job portals set.' },
      { name: 'Salary hike calculator', what: 'Current and offered pay in; the real percentage rise out.' },
      { name: 'Notice period calculator', what: 'Resignation date and notice in; last working day out.' }
    ]
  },
  {
    slug: 'teachers', kind: 'role', glyph: 'i-ai-lesson',
    name: 'Teachers and tutors',
    title: 'Free tools for teachers and tutors',
    lede: 'Lesson plans, question papers, rubrics and report comments as drafts; marks, grades and certificates in a few clicks; timers, random pickers and classroom games for the lesson itself.',
    intro: [
      'A teacher’s evening goes on the same things every week: a lesson plan, a worksheet, a question paper with the marks adding up, comments for thirty report cards, and a message home. The school office has its own list — the timetable, the seating plan — and the tools for those are in the collection for schools. This page is for the person in front of the class.',
      'The marks, grades, certificates, timers and pickers run in your browser, so a class list or a marks sheet never leaves your device. The writing tools are AI tools and say so on their pages: they send the topic and notes you give them to a model, never pupils’ names unless you type them, and they give you a structured draft to edit rather than a finished paper.'
    ],
    groups: [
      { name: 'Planning', blurb: 'A draft to edit instead of a blank page.', tools: ['/ai/lesson-plan-writer/', '/ai/question-paper-writer/', '/ai/rubric-writer/', '/ai/ncert-solution-writer/', '/text/readability-score/'] },
      { name: 'Marks and reports', blurb: 'Totals, grades and comments for the whole class at once.', tools: ['/education/report-card/', '/ai/student-comment-writer/', '/education/marks-percentage/', '/education/cgpa-to-percentage/', '/education/attendance-calculator/', '/mathematics/statistics/'] },
      { name: 'In the lesson', blurb: 'On the board, on the projector, in front of the class.', tools: ['/time/stopwatch-timer/', '/time/countdown-timer/', '/utilities/random-number-generator/', '/utilities/dice-roller/', '/mathematics/scientific-calculator/', '/mathematics/fraction-calculator/', '/qr/qr-code-generator/'] },
      { name: 'Classroom games', blurb: 'Teams, a name wheel, a buzzer and a scoreboard on the projector for a review lesson.', tools: ['/games/team-generator/', '/games/spin-the-wheel/', '/games/quiz-buzzer/', '/games/scoreboard/', '/games/bingo-card-generator/'] },
      { name: 'Live classroom tools', blurb: 'Pupils answer from their own phones and the results grow on the projector.', tools: ['/live/live-poll/', '/live/word-cloud/', '/live/audience-qa/', '/live/rating-scale/', '/live/live-presentation/', '/live/live-quiz-for-classroom/'] },
      { name: 'Paper, certificates and letters home', blurb: 'Printed, named and signed.', tools: ['/pdf/certificate-pdf/', '/pdf/paper-pdf/', '/pdf/text-to-pdf/', '/business/mail-merge/', '/ai/parent-message-writer/', '/ai-video/auto-captions/'] }
    ],
    faq: [
      { q: 'Do the AI tools see my pupils’ data?', a: 'Only what you type into them. A lesson plan or a question paper needs a topic, a class and a length, not a name. The report-comment writer works from the marks and notes you give it; use first names or initials if you can. Every AI page says what it sends before you press the button.' },
      { q: 'Can I make certificates for a whole class at once?', a: 'Yes. Paste or upload the list of names and the certificate generator makes one PDF with a page per pupil. It runs in your browser, so the class list stays on your device.' },
      { q: 'What do the live tools send, and where?', a: 'The live tools are the one part of this page that uses pupils’ phones. Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants. During the launch trial a free session takes up to 1,000 phones.' },
      { q: 'Are the question papers aligned to my board?', a: 'You give the board, the class, the chapters and the marks blueprint, and the draft follows them. Check every question and the answer key before it is printed — it is a first draft, and you are the examiner.' }
    ],
    related: ['schools', 'start-of-term', 'students'],
    next: [
      { name: 'Worksheet maker', what: 'Maths practice sheets with answer keys, printed as PDF.' },
      { name: 'Grade boundaries', what: 'Raw marks in; grades by your boundaries, with the distribution.' }
    ]
  },
  {
    slug: 'families', kind: 'role', glyph: 'i-tambola-number-caller',
    name: 'Families',
    title: 'Free tools for families: games nights, festivals, homework and household money',
    lede: 'A quiz for Sunday evening, tambola for Diwali, a wheel to settle who washes up, sums for the kids, the home-loan EMI and the holiday photos, all free and without an account.',
    intro: [
      'A family has a long list of small jobs and none of them deserves a subscription: a games night that does not turn into an argument about teams, tambola tickets for the whole building, the fraction your child is stuck on, what the loan will really cost each month, and a folder of holiday photos that is too big to send. These pages gather the tools for them in one place.',
      'Nearly everything here runs in your browser, on your own device. Names, scores, tickets, sums and photos are not uploaded. The exception is the live tools, such as Live Poll: the family joins from their own phones at 1234tools.com/join, and what they send passes through our server only to reach the screen you are showing. The Family games night guide walks through an evening from start to finish.'
    ],
    groups: [
      { name: 'Family games night', blurb: 'A quiz, tambola, charades and antakshari, with fair teams and a scoreboard for the TV.', tools: ['/games/quiz-maker/', '/games/tambola-ticket-generator/', '/games/spin-the-wheel/', '/games/team-generator/', '/games/charades-generator/', '/games/antakshari/', '/games/scoreboard/'] },
      { name: 'Festivals and parties', blurb: 'Tambola for the whole building, bingo for a baby shower, icebreakers for guests who have not met, and a live vote for a decision.', tools: ['/games/tambola-number-caller/', '/games/printable-tambola-tickets/', '/games/diwali-tambola-caller/', '/games/bingo-card-generator/', '/games/baby-shower-bingo/', '/games/icebreaker-cards/', '/live/live-poll/'] },
      { name: 'Kids’ learning', blurb: 'Fractions, percentages, factors, ratios and shapes, answered as fast as you can type.', tools: ['/mathematics/fraction-calculator/', '/mathematics/percentage/', '/mathematics/lcm-gcd/', '/mathematics/prime-factorisation/', '/mathematics/ratio-calculator/', '/mathematics/geometry-calculator/', '/mathematics/roman-numerals/', '/education/exam-countdown/', '/time/age-calculator/'] },
      { name: 'Household money', blurb: 'What a loan costs, what a monthly saving grows into, and who owes what after dinner.', tools: ['/india/emi-calculator/', '/finance/loan-payment/', '/india/sip-calculator/', '/india/fd-rd-calculator/', '/india/ppf-calculator/', '/finance/compound-interest/', '/utilities/tip-calculator/', '/business/discount-calculator/'] },
      { name: 'Photos and memories', blurb: 'Make the pictures smaller to send, change the format, tidy them up, or turn a stack into one PDF.', tools: ['/image/image-resizer/', '/image/image-compressor/', '/image/heic-to-jpg/', '/image/photo-filters/', '/image/image-border/', '/image/image-cropper/', '/pdf/jpg-to-pdf/', '/ai-image/image-upscaler/'] }
    ],
    guides: [
      { slug: 'plan-a-family-games-night', name: 'How to plan a family games night' }
    ],
    faq: [
      { q: 'Does anything I enter get uploaded?', a: 'Not by the games, calculators and photo tools: they run in your browser, so names, scores, loan figures and photos stay on your device. The live tools are the exception, because phones have to reach the screen somehow. The privacy statement for them is: Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.' },
      { q: 'Do the children need an app or an account?', a: 'No. The games run on one laptop or phone, with the TV showing the board. For a live poll the family open 1234tools.com/join in a browser and type a six-digit code. During the launch trial a free session takes up to 1,000 phones.' },
      { q: 'Are the loan and savings calculators financial advice?', a: 'No. They do the arithmetic on the figures you enter. A bank’s own quote includes fees and rate changes that a general calculator cannot know, so use the result to compare options and ask the lender for the exact figures.' },
      { q: 'Can I make a quiz in Hindi or another language?', a: 'The Quiz Maker shows the questions you type. The Antakshari scorekeeper draws its letter in Hindi or English, and the Tambola caller has Hindi calls, which need a Hindi text-to-speech voice on the device to be spoken.' }
    ],
    related: ['teachers', 'students', 'photographers'],
    next: [
      { name: 'Household budget planner', what: 'Income and bills in; what is left each month, and where it goes.' },
      { name: 'Photo collage maker', what: 'Several photos laid out on one page, ready to print or share.' },
      { name: 'Pocket-money tracker', what: 'Who has saved what, for children saving up for something.' }
    ]
  },
  {
    slug: 'photographers', kind: 'role', glyph: 'i-ai-sky-replacement',
    name: 'Photographers',
    title: 'Free tools for photographers',
    lede: 'Upscale, swap a sky, remove a stranger, add grain, strip the GPS, and deliver at the right size — on your own device, with no upload and no watermark.',
    intro: [
      'The edits a photographer reaches for between shoots are mostly small and specific: a sky that was white, a person who walked into the frame, a print that needs twice the pixels, a set of files to deliver at web size with the location data taken out. Each one is a reason to open a heavy editor or pay a monthly fee for a single feature.',
      'These do one thing each, in your browser. The AI models — upscaling, sky segmentation, object removal, depth — are downloaded once and run on your own processor, so a client’s photographs never leave your machine and nothing is watermarked. The EXIF tools read and strip metadata locally, which is the point: you see what a file gives away before anyone else does.'
    ],
    groups: [
      { name: 'Retouching with AI', blurb: 'The fixes that used to mean an hour with a brush.', tools: ['/ai-image/image-upscaler/', '/ai-image/sky-replacement/', '/ai-image/object-remover/', '/ai-image/blur-background/', '/ai-image/face-blur/', '/ai-image/background-remover/'] },
      { name: 'Looks', blurb: 'Grain, colour and a little movement.', tools: ['/ai-image/film-grain/', '/ai-image/color-pop/', '/image/photo-filters/', '/image/image-border/', '/ai-image/3d-photo-parallax/', '/image/color-palette-extractor/'] },
      { name: 'Metadata and privacy', blurb: 'What the file says about where you were.', tools: ['/image/exif-viewer/', '/image/exif-remover/', '/image/blur-redact/'] },
      { name: 'Delivery', blurb: 'Every size and format, in a batch.', tools: ['/image/bulk-image-resizer/', '/image/image-compressor/', '/image/image-converter/', '/image/image-cropper/', '/design/aspect-ratio/', '/image/image-splitter/', '/image/image-to-pdf/'] },
      { name: 'The business side', blurb: 'Quotes, invoices and the contract before the shoot.', tools: ['/pdf/quotation-pdf/', '/pdf/invoice-pdf/', '/ai/contract-generator/', '/pdf/pdf-signature/', '/business/currency-converter/'] }
    ],
    faq: [
      { q: 'How good is the upscaler?', a: 'It uses Real-ESRGAN, a widely used open model, at 2× or 4×, or at 1× to clean up a soft image. It is good on detail and texture, and it invents what was never captured, so check faces and text closely before printing large.' },
      { q: 'Are RAW files supported?', a: 'Not directly — the tools read what a browser can decode: JPEG, PNG, WebP and, in Safari, HEIC. Export from your RAW editor first.' },
      { q: 'Will my client’s photos be uploaded?', a: 'No. Every image tool on this page runs in your browser, including the AI ones: the models are downloaded once and run on your own device. Nothing is queued, stored or watermarked. The contract generator is the one AI writing tool here, and it sends the terms you type to a model and says so first.' }
    ],
    related: ['designers', 'creators', 'freelancers'],
    next: [
      { name: 'Image watermark', what: 'Your logo or name on a batch of photos, at a size and opacity you choose.' },
      { name: 'Print size and DPI calculator', what: 'Pixels in; the largest print at 300, 240 or 150 DPI out.' },
      { name: 'Contact sheet', what: 'A folder of photos laid out as a numbered PDF for the client to choose from.' }
    ]
  },
  {
    slug: 'designers', kind: 'role', glyph: 'i-css-gradient',
    name: 'Designers',
    title: 'Free tools for designers',
    lede: 'Colour and contrast, palettes from a photo, gradients, SVG clean-up, favicons, cut-outs and the right size for every screen — fast, free and on your own machine.',
    intro: [
      'Between the big files there are fifty small jobs: check the contrast ratio, pull a palette from the client’s photo, make the favicon set, take the background off a product shot, shrink the SVG the illustrator exported, and get the same banner out at six sizes. None of them justifies a new subscription, and most free sites that do them want the file uploaded first.',
      'These run in your browser. Colours, gradients and SVGs are text operations; images are canvas and on-device AI. A client’s unreleased brand work goes through them without leaving your device, and there is no watermark on anything you export.'
    ],
    groups: [
      { name: 'Colour', blurb: 'Convert it, check it, find it in a photo.', tools: ['/developer/color-converter/', '/image/color-palette-extractor/', '/developer/css-gradient/', '/ai-image/color-pop/'] },
      { name: 'Images and cut-outs', blurb: 'The subject off the background, ready to place.', tools: ['/ai-image/background-remover/', '/ai-image/text-behind-image/', '/ai-image/sticker-maker/', '/ai-image/object-remover/', '/ai-image/image-upscaler/', '/ai-image/thumbnail-maker/'] },
      { name: 'Sizes and formats', blurb: 'One master, every output.', tools: ['/image/social-media-resizer/', '/design/aspect-ratio/', '/image/bulk-image-resizer/', '/image/image-converter/', '/image/image-compressor/', '/image/image-splitter/'] },
      { name: 'For the web build', blurb: 'The files and snippets a developer will ask you for.', tools: ['/image/svg-optimizer/', '/developer/favicon-generator/', '/image/image-to-base64/', '/developer/meta-tag-generator/', '/developer/lorem-ipsum/', '/developer/case-converter/'] },
      { name: 'Client work', blurb: 'Quotes, invoices, and proofs as PDFs.', tools: ['/pdf/quotation-pdf/', '/pdf/invoice-pdf/', '/image/image-to-pdf/', '/pdf/pdf-to-images/', '/ai/brand-voice-guide/', '/qr/qr-code-generator/'] }
    ],
    faq: [
      { q: 'Does the contrast check follow WCAG?', a: 'Yes. The colour converter gives the contrast ratio between two colours and whether it passes WCAG 2.x AA and AAA for normal and large text.' },
      { q: 'Will the SVG optimiser break my file?', a: 'It removes editor metadata, comments, hidden elements and needless precision, and shows the saving. Keep the original, and check anything with filters or embedded fonts after optimising.' },
      { q: 'Are client files uploaded?', a: 'No. Everything on this page runs in your browser — colour and SVG work as text, images as canvas and on-device AI. The one AI writing tool on the page, the brand voice guide, sends the sample copy you paste to a model and says so first.' }
    ],
    related: ['photographers', 'developers', 'marketers', 'creators'],
    next: [
      { name: 'Font pairing preview', what: 'Two typefaces side by side in headings and body, from the fonts on your machine.' },
      { name: 'Device mock-ups', what: 'A screenshot in a phone or laptop frame, exported as PNG.' },
      { name: 'Image to SVG', what: 'A logo or icon traced into clean vector paths.' }
    ]
  }
];

/*
 * The home page's "I am a…" row, in the order a visitor should meet it:
 * the biggest audiences first. Each tile names three tools by path; the
 * builder reads their titles from their own pages. `hue` is the tile's
 * accent as an angle, so the row reads as a set rather than a rainbow.
 */
const TILES = [
  { slug: 'creators', label: 'Creators & influencers', hue: 290, picks: ['/ai-video/reel-maker/', '/ai-video/auto-captions/', '/ai-image/thumbnail-maker/'] },
  { slug: 'online-sellers', label: 'Online sellers', hue: 25, picks: ['/ai-image/background-remover/', '/business/profit-margin/', '/pdf/invoice-pdf/'] },
  { slug: 'small-business', label: 'Small businesses', hue: 42, picks: ['/pdf/invoice-pdf/', '/business/bookkeeping/', '/business/payroll-run/'] },
  { slug: 'students', label: 'Students', hue: 200, picks: ['/education/cgpa-to-percentage/', '/mathematics/percentage/', '/pdf/merge-pdf/'] },
  { slug: 'job-seekers', label: 'Job seekers', hue: 160, picks: ['/ai/cv-screener/', '/image/passport-photo/', '/india/ctc-take-home/'] },
  { slug: 'teachers', label: 'Teachers & tutors', hue: 120, picks: ['/ai/lesson-plan-writer/', '/education/report-card/', '/pdf/certificate-pdf/'] },
  { slug: 'families', label: 'Families', hue: 85, picks: ['/games/quiz-maker/', '/games/tambola-ticket-generator/', '/india/emi-calculator/'] },
  { slug: 'photographers', label: 'Photographers', hue: 260, picks: ['/ai-image/image-upscaler/', '/ai-image/sky-replacement/', '/image/exif-remover/'] },
  { slug: 'designers', label: 'Designers', hue: 320, picks: ['/developer/color-converter/', '/image/svg-optimizer/', '/image/color-palette-extractor/'] },
  { slug: 'accountants', label: 'Accountants', hue: 50, picks: ['/business/bank-reconciliation/', '/business/vat-return/', '/business/tally-converter/'] },
  { slug: 'freelancers', label: 'Freelancers', hue: 180, picks: ['/pdf/quotation-pdf/', '/pdf/invoice-pdf/', '/business/currency-converter/'] },
  { slug: 'developers', label: 'Developers', hue: 220, picks: ['/developer/json-formatter/', '/developer/regex-tester/', '/developer/jwt-decoder/'] },
  { slug: 'hr-payroll', label: 'HR & payroll', hue: 0, picks: ['/business/payroll-run/', '/pdf/payslip-pdf/', '/business/full-final-settlement/'] }
];

module.exports = { COLLECTIONS, TILES };
