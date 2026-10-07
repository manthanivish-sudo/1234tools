/**
 * The reading part of the Image tools, rendered by build-depth.js in its file-and-text shape (howItWorks in place of formula). Written in two batches; each batch's notes follow.
 *
 * The reading part of ten Image tools (background remover to image
 * converter), rendered by build-depth.js in its file-and-text shape
 * (howItWorks in place of formula). Shape and rules: build-depth.js and
 * build/content/_check.js.
 *
 * Every figure in a worked example comes from a run of the live tool in
 * headless Chrome against a local server of the site, recorded in `runs` as
 * { browser: { … }, shown: [ … ] }: the file given (a CC0 sample from
 * build/promo/samples at full size, or a file made deterministically as
 * described), the controls set, and what the tool showed. Measurements of a
 * downloaded result (transparent share, metadata segments) say how they
 * were taken.
 *
 * ----
 *
 * The reading part of ten of the Image tools (the other /image/ pages live in
 * their own file), rendered by build-depth.js in its file-and-text shape
 * (howItWorks in place of formula). Shape and rules: build-depth.js and
 * build/content/_check.js.
 *
 * Every figure in a worked example comes from a run of the live tool. The
 * canvas tools were run in headless Chrome against a local server of the
 * site: the page opened, the #ic-<key> controls set, the file uploaded
 * through the drop zone's file input, and the .stat-grid rows and the
 * result cards' captions read off the page. Sample photos are the CC0 files
 * in build/promo/samples, uploaded at their full size (1,600 pixels wide),
 * not the 1,200-pixel copies the Example panels use. The SVG optimiser is a
 * text tool, so its runs are { input, options, check } and are re-run in
 * Node by build/content/_check.js.
 */
'use strict';

const GRADIENT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40">\n  <defs>\n    <linearGradient id="fade" x1="0" x2="1">\n      <stop offset="0" stop-color="#0b5fff"/>\n      <stop offset="1" stop-color="#7a2cff"/>\n    </linearGradient>\n  </defs>\n  <rect x="0.5" y="0.5" width="119" height="39" rx="7.75" fill="url(#fade)"/>\n  <path d="M 18.236 27.514 L 30.881 12.403 L 43.0496 27.514 Z" fill="#ffffff"/>\n</svg>';

/* the svg-optimizer page's own Example panel input (build/promo/stories/image.js) */
const CUP_SVG = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Exported from a design app -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/ns" width="48" height="48" viewBox="0 0 48 48">\n  <metadata>rdf:RDF cc:Work dc:format image/svg+xml</metadata>\n  <title>cup</title>\n  <path id="path1042" inkscape:label="Layer 1" d="M 10.123456 14.987654 L 37.876543 14.987654 L 34.500001 40.250002 L 13.499999 40.250002 Z" fill="#f7c948"/>\n</svg>';

module.exports = {
  '/image/image-compressor/': {
    term: 'image compression',
    whatIs: [
      'Image compression makes a picture file smaller. Lossless compression, used by PNG, gives every pixel back exactly. Lossy compression, used by JPEG, WebP and AVIF, throws away detail the eye is unlikely to miss, and more of it as quality falls.',
      'JPEG opens everywhere but has no transparency. PNG suits screenshots and logos but stores a photograph at many times the size. WebP and AVIF keep transparency and usually beat JPEG for the same look.'
    ],
    howItWorks: {
      text: 'The browser decodes your file and a background worker writes it again with WebAssembly encoders: MozJPEG, libwebp, libavif and oxipng. Where WebAssembly is off, `canvas.toBlob` takes over and the page says so.',
      points: [
        'Keep original format re-encodes in the file’s own format; a PNG is first cut to 256 colours, unless PNG colours says All.',
        'A max width scales the picture down first with Lanczos3; a narrower photo is never enlarged.',
        '“Make it under” bisects the quality, then shrinks the size if it must, and reports its tries.',
        'Only the colour profile is kept by default, so EXIF tags and GPS do not reach the smaller file.'
      ]
    },
    worked: {
      text: 'A 1600×1200 street photo, already a tight 321.4 KB JPEG, came out at 322.4 KB at quality 80, Keep original format: larger, and the page said so. WebP at 80 gave 277.0 KB, JPEG at 60 185.8 KB, AVIF 188.0 KB. Under 100 KB gave 96.1 KB at 1472×1104 after 12 tries; a max width of 800 gave 92.4 KB. A 2.41 MB PNG fell to 835.3 KB in 256 colours, 1.60 MB with all colours, 1.10 MB as lossless WebP.'
    },
    uses: [
      ['Portal size limits', 'Get a CV photo under an upload cap.'],
      ['Faster web pages', 'Turn camera JPEGs into WebP at the width the page shows.'],
      ['Email attachments', 'Fit a dozen phone photos under a 25 MB attachment limit.']
    ],
    mistakes: [
      'Reading sizes here as a form’s kilobytes. A 195 KB result is 199.7 KB to a form counting 1,000 bytes; the size limit already counts 1,000.',
      'Recompressing a small JPEG. The street photo grew at quality 80; check the saving first.'
    ],
    faq: [
      { q: 'Does compressing an image reduce its resolution?', a: 'Not unless you set a max width, or a limit that quality alone cannot meet. Otherwise the street photo stayed 1600×1200.' },
      { q: 'Does compressing a photo remove its EXIF data?', a: 'By default, yes: a test JPEG with camera, date and GPS tags came out with none. The Metadata control can keep EXIF.' },
      { q: 'Why does the size differ from what my computer shows?', a: 'This page divides by 1,024 and macOS by 1,000: 329,068 bytes is 321.4 KB here, 329.1 KB on a Mac.' }
    ],
    related: { guides: ['/guides/compress-an-image/'], conversions: ['/conversions/data/kibibyte-1024-to-kilobyte-1000/'] },
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome: build/promo/samples/street.jpg at full size (1600×1200, 329,068 bytes = 321.4 KB),
         every control at its default (Keep original format, quality 80, metadata colour profile only), then the control named. */
      { browser: { input: 'street.jpg, 1600x1200, 321.4 KB', format: 'same', quality: 80 }, shown: ['321.4 KB', '322.4 KB'] },
      { browser: { input: 'street.jpg', format: 'image/webp', quality: 80 }, shown: ['277.0 KB'] },
      { browser: { input: 'street.jpg', format: 'image/avif' }, shown: ['188.0 KB'] },
      { browser: { input: 'street.jpg', format: 'image/jpeg', quality: 60 }, shown: ['185.8 KB'] },
      /* target 100 KB, Keep original format: "quality 32, 1472×1104, 12 tries" */
      { browser: { input: 'street.jpg', format: 'same', target: '100' }, shown: ['96.1 KB', '1472×1104', '12 tries'] },
      { browser: { input: 'street.jpg', format: 'same', quality: 80, maxWidth: 800 }, shown: ['92.4 KB'] },
      /* pet.jpg re-saved as a PNG in Chrome (2,529,986 bytes = 2.41 MB): Keep original format with PNG colours 256, then All, then WebP lossless */
      { browser: { input: 'pet.jpg as PNG, 2.41 MB', format: 'same', pngColours: '256' }, shown: ['2.41 MB', '835.3 KB'] },
      { browser: { input: 'pet.jpg as PNG', format: 'image/png', pngColours: 'all' }, shown: ['1.60 MB'] },
      { browser: { input: 'pet.jpg as PNG', format: 'image/webp', webpMode: 'lossless' }, shown: ['1.10 MB'] },
      /* the FAQ's EXIF answer: pukaki-tagged.jpg (see /image/exif-viewer/), Keep original format at 80; the downloaded result
         parsed with the site's own MVRImage.metadataSegments / readExif: APP0 and ICC only, no EXIF */
      { browser: { input: 'pukaki-tagged.jpg (EXIF with GPS, XMP)', format: 'same', quality: 80 }, shown: ['camera, date and GPS tags'] }
    ]
  },

  '/image/image-converter/': {
    term: 'image format conversion',
    whatIs: [
      'An image format is a way of packing pixels into a file. Converting packs the picture again in another format: that changes the size, the transparency and which programs open it, but cannot restore lost detail.',
      'JPEG suits photos that must open anywhere, PNG anything where every pixel must survive, WebP and AVIF small web files. An animated GIF or WebP gives one still frame in any other format.'
    ],
    howItWorks: {
      text: 'The browser decodes the file and a background worker writes it with WebAssembly encoders: MozJPEG, libwebp and libavif, plus the page’s own writers for GIF, BMP and ICO. Where WebAssembly is off, `canvas.toBlob` is used and the page says so.',
      points: [
        'For JPEG the picture is first laid on your background colour, so transparent areas take it instead of turning black.',
        'The quality slider, 92 by default, reaches JPEG, WebP and AVIF; each result’s name and type come from its bytes.',
        'EXIF, GPS and XMP stay behind unless Metadata keeps them; a rotation recorded as a tag is applied to the pixels.',
        'A link ending ?from=png&to=jpg opens the page set for that pair.'
      ]
    },
    worked: {
      text: 'A dog in long grass, a 1600 × 1067 photograph saved as a PNG of 2.41 MB, became a 205.1 KB WebP at the default quality of 92, 92% smaller. JPEG at 92 gave 285.1 KB, AVIF 84.2 KB, WebP at 80 101.6 KB. An ICO came out at 256×256 and 161.0 KB. A photograph kept as PNG is a common reason a picture will not attach.'
    },
    uses: [
      ['WebP downloads', 'Turn an image saved from a website into JPEG for a print shop or an old editor.'],
      ['Logos on coloured pages', 'Keep a transparent logo see-through as WebP, where JPEG would fill it in.'],
      ['Favicons', 'Make an ICO from a square logo for a site’s tab icon.']
    ],
    mistakes: [
      'Converting a transparent logo to JPEG on the default white for a dark page. Set the background to the page colour.',
      'Feeding in a TIFF scan or camera RAW file. Chrome cannot decode either, and the page names the file; export a JPEG first.'
    ],
    faq: [
      { q: 'Does converting an image change its resolution?', a: 'Not unless you set a longest side. The test photo stayed 1600×1067, except in ICO, which holds at most 256×256.' },
      { q: 'Does converting keep the photo’s EXIF data?', a: 'Not by default. A test JPEG with camera tags and a GPS position came out with only a JFIF header; Metadata can keep EXIF.' },
      { q: 'Is converting PNG to JPG lossless?', a: 'No. JPEG discards some detail at every quality setting, 100 included. Only PNG keeps every pixel exactly.' }
    ],
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome: build/promo/samples/pet.jpg (1600×1067) drawn in Chrome onto a canvas of its own size and
         saved with toBlob('image/png') → pet-as-png.png, 2,529,986 bytes. Convert to and Quality set, then uploaded; Metadata at its default. */
      { browser: { input: 'pet.jpg re-saved as PNG in Chrome, 1600x1067', format: 'image/webp', quality: 92 }, shown: ['2.41 MB', '205.1 KB', '92%', '1600×1067'] },
      { browser: { input: 'pet-as-png.png', format: 'image/jpeg', quality: 92, bg: '#ffffff' }, shown: ['285.1 KB'] },
      { browser: { input: 'pet-as-png.png', format: 'image/avif', quality: 92 }, shown: ['84.2 KB'] },
      { browser: { input: 'pet-as-png.png', format: 'image/webp', quality: 80 }, shown: ['101.6 KB'] },
      { browser: { input: 'pet-as-png.png', format: 'image/x-icon' }, shown: ['161.0 KB', '256×256'] },
      /* the FAQ's EXIF answer: pukaki-tagged.jpg (see /image/exif-viewer/) to JPEG 92; the downloaded file's
         segments read with MVRImage.metadataSegments: APP0 (16 B) only; readExif found nothing */
      { browser: { input: 'pukaki-tagged.jpg', format: 'image/jpeg', quality: 92 }, shown: ['JFIF header'] }
    ]
  },

  '/image/bulk-image-resizer/': {
    term: 'image resizing',
    whatIs: [
      'Resizing changes how many pixels a picture has. Shrinking merges neighbouring pixels, so the file gets lighter. Enlarging invents in-between pixels: the file grows and the detail stays as it was.',
      'File weight follows the pixel count, not the width: halve both sides and a quarter of the pixels remain. A batch applies one rule to every file, and a fixed width makes upright shots much taller than wide ones.'
    ],
    howItWorks: {
      text: 'Each photo is shrunk by Lanczos3 resampling in a background worker, then written by a WebAssembly encoder, WebP at quality 85 unless you change it. Without WebAssembly the canvas is used, and the page says so.',
      points: [
        'Fixed width or height works out the other side from the photo’s ratio; longest edge scales the bigger side to the value; percentage scales both; exact size takes your width and height.',
        'Nothing is enlarged unless “Allow enlarging” is Yes: a photo the target would make bigger keeps its own size, and the page names it.',
        'Results are named after their source plus the new size, such as street-800x600.webp, and come as one ZIP or go straight into a folder.'
      ]
    },
    worked: {
      text: 'Three photos, a portrait and pancakes at 1600×1067 and a street scene at 1600×1200, were 803.0 KB together. Longest edge 800 with WebP at 85 gave 800×534, 800×600 and 800×534, 220.7 KB in all (66.2, 112.8 and 41.7 KB); as JPEG they came to 253.7 KB. Under 100 KB each, the street photo fell to quality 81 and the batch to 203.1 KB. A width of 2400 left all three at their own size, 624.6 KB, with a note; with “Allow enlarging” on they became 2400×1601 and 2400×1800, 993.3 KB.'
    },
    uses: [
      ['Shop listings', 'Bring a folder of product shots to a marketplace’s width in one pass.'],
      ['Photos by email', 'Cut a holiday set to 1,280 px on the long side so it fits in one message.'],
      ['Thumbnails', 'Make 25% copies of a photo set for a preview grid.']
    ],
    mistakes: [
      'Choosing exact size for a mixed batch. Every file is forced into one box, distorting upright and wide shots; use longest edge.',
      'Reading the Source figure as the whole batch. It gives the first file’s dimensions only; each card’s caption shows its own.'
    ],
    faq: [
      { q: 'Does resizing reduce image quality?', a: 'Shrinking drops detail that would not show at the smaller size; most visible loss comes from the encoder, so raise the quality if edges look soft.' },
      { q: 'What happens to the file names?', a: 'Each keeps its name with the new size added, so IMG_2041.jpg at 800 px wide might become IMG_2041-800x600.webp.' },
      { q: 'Does resizing remove EXIF data from photos?', a: 'By default, yes: each file is rewritten without camera and GPS tags, though Metadata can keep them.' }
    ],
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome: build/promo/samples portrait.jpg (1600×1067, 264.5 KB), street.jpg (1600×1200, 321.4 KB),
         food.jpg (1600×1067, 217.2 KB): 803.0 KB together. Options set, then all three uploaded in that order; figures from each
         card's caption and the stat row; the size-limit run's captions read "quality 85", "quality 81", "quality 85". */
      { browser: { inputs: 'portrait.jpg 1600x1067, street.jpg 1600x1200, food.jpg 1600x1067; 803.0 KB together', mode: 'longest', value: 800, format: 'image/webp', quality: 85 }, shown: ['800×534', '800×600', '220.7 KB', '66.2', '112.8', '41.7'] },
      { browser: { inputs: 'the same three', mode: 'longest', value: 800, format: 'image/jpeg', quality: 85 }, shown: ['253.7 KB'] },
      { browser: { inputs: 'the same three', mode: 'longest', value: 800, format: 'image/webp', quality: 85, target: '100' }, shown: ['203.1 KB', 'quality 81'] },
      /* width 2400 with "Allow enlarging" No (the default) leaves 1600×1067, 1600×1200 and 1600×1067 with the note "3 of 3 images were
         smaller than that and were left at their own size"; with Yes, 2400×1601, 2400×1800, 2400×1601 */
      { browser: { inputs: 'the same three', mode: 'width', value: 2400, enlarge: 'no', format: 'image/webp', quality: 85 }, shown: ['624.6 KB'] },
      { browser: { inputs: 'the same three', mode: 'width', value: 2400, enlarge: 'yes', format: 'image/webp', quality: 85 }, shown: ['2400×1601', '2400×1800', '993.3 KB'] },
      /* the FAQ's EXIF answer: pukaki-tagged.jpg (see /image/exif-viewer/), longest edge 800, JPEG 85 → 800×532;
         the result's segments read with MVRImage.metadataSegments: no EXIF; readExif found nothing */
      { browser: { input: 'pukaki-tagged.jpg', mode: 'longest', value: 800, format: 'image/jpeg', quality: 85 }, shown: ['camera and GPS tags'] }
    ]
  },

  '/image/image-resizer/': {
    term: 'resizing one picture',
    whatTitle: 'What resizing a single picture decides',
    whatIs: [
      'A resize fixes the pixel size of the result, and how the shape is reached matters more than the number. Scaling keeps the whole picture, cropping keeps part of it at full scale, and padding keeps all of it, smaller, and fills the rest.',
      'DPI is a note for printers about how large to print and does not change a single pixel; a file’s size on screen follows its pixel count alone.'
    ],
    howItWorks: {
      text: 'The photo is decoded, resampled by Lanczos3 in a background worker and written by a WebAssembly encoder, WebP at quality 85 unless you choose another format. Where WebAssembly is off, the canvas does the work and the page says so.',
      points: [
        'Percentage, width, height and longest side keep the ratio; crop fills the frame and trims the overhang; pad keeps the whole picture and fills the gap with your colour.',
        'A picture smaller than the size you ask for stays as it is unless Allow enlarging is Yes.',
        'A DPI is written into a JPEG’s JFIF header or a PNG’s pHYs chunk, and a row on the page confirms it.',
        '“Make it under” searches for the best quality that fits a KB limit, then smaller sizes, and reports the quality it used.'
      ]
    },
    worked: {
      text: 'A 1600×1200 street photograph, a 321.4 KB JPEG, was halved to 800×600 and came to 112.6 KB as WebP. Cropped to a 1080×1080 square it weighed 235.0 KB, since the frame keeps the full scale. Padded to the same square it kept every pixel on a colour fill and weighed 182.4 KB. A width of 1200 as JPEG at 85 with 300 DPI gave 224.2 KB and the row “DPI in the file = 300”.'
    },
    uses: [
      ['Form uploads', 'Reach the exact pixel size a portal asks for, then trim the weight with a KB limit.'],
      ['Square product images', 'Pad a wide shot to a square so a shop grid shows all of it.'],
      ['Print orders', 'Set 300 DPI so a lab prints a 1200-pixel width at 4 inches.']
    ],
    mistakes: [
      'Cropping to a square when the subject runs to the edge. The overhang is lost; pad instead, or crop the original first.',
      'Typing a DPI and expecting a smaller file. It changes only the label inside the file.'
    ],
    faq: [
      { q: 'Is it better to crop or pad to fit a size?', a: 'Crop when the subject is central and the edges are spare. Pad when everything in the frame matters, as with the square above.' },
      { q: 'Will a small image be stretched to fit?', a: 'No. With enlarging off, a smaller picture keeps its own size, and padding centres it.' },
      { q: 'Which format should I choose for a form?', a: 'JPEG, unless the form names another. A KB limit on this page counts 1,000 bytes to the KB.' }
    ],
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome: build/promo/samples/street.jpg (1600×1200, 321.4 KB), WebP at quality 85 unless stated.
         Mode and value set, then uploaded; figures from the caption and the stat rows. */
      { browser: { input: 'street.jpg, 1600x1200, 321.4 KB', mode: 'percent', value: 50 }, shown: ['321.4 KB', '800×600', '112.6 KB'] },
      { browser: { input: 'street.jpg', mode: 'cover', value: 1080, height: 1080 }, shown: ['1080×1080', '235.0 KB'] },
      { browser: { input: 'street.jpg', mode: 'pad', value: 1080, height: 1080 }, shown: ['182.4 KB'] },
      { browser: { input: 'street.jpg', mode: 'width', value: 1200, dpi: 300, format: 'image/jpeg', quality: 85 }, shown: ['224.2 KB', 'DPI in the file = 300'] }
    ]
  },

  '/image/circle-crop/': {
    term: 'a circle crop',
    whatIs: [
      'Image files are always rectangles. A round avatar is a square picture with transparent corners, so whatever lies behind shows through. That needs an alpha channel, which PNG and WebP have and JPEG does not.',
      'The crop also decides what is kept. A square cut from a wide photo loses its sides, so an off-centre face needs moving into the shape first.'
    ],
    howItWorks: {
      text: 'A square canvas of the output size, 512 px by default, is clipped to the shape, and the photo is drawn in scaled so its shorter side fills the square, then zoomed and moved by your sliders. Pixels outside the clip are never painted.',
      points: [
        'Zoom runs from 100% to 400%, and the Move sliders bring an off-centre face into the middle.',
        'Circle clips to an arc whose diameter is the output size less twice the border. Squircle is a rounded square with the radius fixed at 22.5%, not a true superellipse.',
        'A ring is stroked just outside the picture, so it never covers the photo: solid, solid with a gap, double or a gradient.',
        'Save as PNG (the default) or WebP to keep the corners transparent; JPEG fills them with your background colour.'
      ]
    },
    worked: {
      text: 'A 1600 × 1067 photo of a dog in long grass, a 220.3 KB JPEG, became a 1024×1024 circle that weighed 1.48 MB as PNG and 113.6 KB as WebP. At 256 px with a 6 px ring set apart from the picture by a gap, the PNG was 125.5 KB, light enough for any profile upload.'
    },
    uses: [
      ['Team pages', 'Give every headshot the same size and shape so a staff grid lines up.'],
      ['Slides and signatures', 'Place a round photo on a coloured slide without a white box round it.'],
      ['Story rings', 'Add a gapped or gradient ring for a profile picture.']
    ],
    mistakes: [
      'Exporting at 1024 px for a site that shows 100 px. A photographic PNG is heavy; pick the smallest size the service accepts, or save WebP.',
      'Leaving the face off-centre. The shape keeps the middle square only unless you zoom and move the picture first.'
    ],
    faq: [
      { q: 'Can I move the circle to a face that is off-centre?', a: 'Yes. Raise Zoom, then use the two Move sliders until the face sits in the middle of the shape.' },
      { q: 'Why is my round PNG bigger than the original photo?', a: 'PNG keeps every pixel without loss, while the photo came as a lossy JPEG. A 1024 px circle from a 220.3 KB JPEG weighed 1.48 MB; WebP or a smaller size fixes it.' },
      { q: 'What is the difference between a squircle and a rounded square?', a: 'A true squircle is a superellipse whose curve begins gradually; a rounded square joins straight sides to quarter-circles. The Squircle option here is the latter.' }
    ],
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome: input build/promo/samples/pet.jpg at full size (1600×1067, 220.3 KB). Output size 1024,
         Shape circle, no border, PNG; then Save as WebP; then size 256, border 6, ring "gap", PNG. Figures from the card captions. */
      { browser: { input: 'pet.jpg, 1600x1067', shape: 'circle', size: 1024, border: 0, format: 'image/png' }, shown: ['220.3 KB', '1024×1024', '1.48 MB'] },
      { browser: { input: 'pet.jpg', shape: 'circle', size: 1024, border: 0, format: 'image/webp' }, shown: ['113.6 KB'] },
      { browser: { input: 'pet.jpg', shape: 'circle', size: 256, border: 6, borderColor: '#f7c948', ring: 'gap', format: 'image/png' }, shown: ['125.5 KB'] }
    ]
  },

  '/image/image-border/': {
    whatTitle: 'What adding a border does to a photo',
    whatIs: [
      'A border is new pixels added round the outside of a picture. Nothing is painted over the photo: the canvas grows on every side and the photo sits untouched in the middle, so a 60 px border adds 120 px to both width and height.',
      'A polaroid frame copies the instant-film print, with a deep bottom strip for a caption. A double border adds a thin inner line inside the margin.'
    ],
    howItWorks: {
      text: 'A canvas the size of the photo plus the border is filled with the border colour, and the photo is drawn into it at its own resolution with `drawImage`, then encoded with `canvas.toBlob`.',
      points: [
        'Polaroid makes the bottom strip three times the border width.',
        'Double draws its inner line 45% of the border width in from the edge, 12% of the border thick, only when the border is wider than 8 px.',
        'A corner radius rounds the frame’s outer edge and leaves the cut-away corners transparent.',
        'It saves PNG unless you pick JPEG or WebP; a JPEG fills rounded corners white.'
      ]
    },
    worked: {
      text: 'A 1600 × 1067 food photo, a 217.2 KB JPEG, with an even 60 px white border came out at 1720×1187, as a PNG of 2.29 MB, ten times the original. The polaroid style at the same width gave 1720×1307, all the extra height in the bottom strip. Saved as JPEG at 85 instead, the bordered picture was 216.8 KB, smaller than the photo it framed.'
    },
    uses: [
      ['Prints with a margin', 'Add white space so a lab print or a mount does not crop into the picture.'],
      ['Screenshots in documents', 'Give a mostly white screenshot a thin grey edge so it stands apart from the page.'],
      ['Product grids', 'Give marketplace shots a matching margin so they sit evenly side by side.']
    ],
    mistakes: [
      'Uploading the bordered PNG where a size limit applies. Save it as JPEG instead; a plain border costs almost nothing in a JPEG.',
      'Choosing the width without looking at the photo’s size. A 40 px border is bold on a 1,000 px picture and a hairline on a 6,000 px one; aim for 2 to 4% of the width.'
    ],
    faq: [
      { q: 'Does adding a border reduce image quality?', a: 'Not as PNG: the photo is copied at its own size, pixel for pixel, and saved losslessly. A JPEG or WebP copy is compressed again.' },
      { q: 'Why is the bordered image so much bigger?', a: 'PNG, the default, keeps every pixel exactly, while the JPEG it came from had already thrown detail away to stay small. Choose JPEG under Save as.' },
      { q: 'Can I add a border without changing the image size?', a: 'Not directly, as the border goes outside the photo. Shrink the photo by twice the border width first, then add the border.' }
    ],
    runs: [
      /* input: build/promo/samples/food.jpg at full size (1600×1067, 217.2 KB). Options set, then uploaded;
         border colour left at #ffffff, radius 0. */
      { browser: { input: 'food.jpg, 1600x1067', style: 'solid', width: 60 }, shown: ['217.2 KB', '1720×1187', '2.29 MB'] },
      { browser: { input: 'food.jpg', style: 'polaroid', width: 60 }, shown: ['1720×1307'] },
      /* re-run 2026-10-04 with the Save as control: solid, 60 px, #ic-format JPEG, #ic-quality 85 (the same figure the
         compressor gave for the PNG before the tool had a format choice) */
      { browser: { input: 'food.jpg', style: 'solid', width: 60, format: 'image/jpeg', quality: 85 }, shown: ['216.8 KB'] }
    ]
  },

  '/image/blur-redact/': {
    term: 'image redaction',
    whatIs: [
      'Redaction means destroying the information in part of a picture, not just covering it. A solid block replaces every pixel, pixelation keeps one averaged colour per square, and a blur keeps a weighted mix of nearby pixels, so large shapes still show through.',
      'Typical targets are faces, number plates and house numbers in photos, and names and account numbers in screenshots.'
    ],
    howItWorks: {
      text: 'Each area you draw is changed on a full-size canvas, and the whole picture is encoded again, with no layers: PNG by default, or JPEG or WebP. Nothing is covered until you draw.',
      points: [
        'Drag a box, an oval or a free brush stroke, as many areas as you need; Undo, or Ctrl+Z, takes back the last one.',
        'Pixelate shrinks the area to about one pixel per block, the strength being the block size in pixels, then draws it back with smoothing off, so each block is one flat colour.',
        'Blur clips to the area and averages it in three box passes, so colour from just outside bleeds in.',
        'Block fills the area with your colour, black by default. “Whole image” applies the method everywhere.'
      ]
    },
    worked: {
      text: 'In a 1600 × 1200 street photo, a 321.4 KB JPEG, one box was dragged over the people on a zebra crossing. Pixelated at the default strength of 16, each figure became a column of flat squares: a red top and a blue jacket still showed as colour, but no faces. Saved as PNG the result weighed 2.79 MB; JPEG at quality 85 gave 349.5 KB. Blur gave 2.86 MB as PNG; with nothing drawn, the PNG was 2.91 MB.'
    },
    uses: [
      ['Bug reports', 'Block a customer’s name and email in a screenshot before it goes into a ticket.'],
      ['Car and property listings', 'Pixelate a number plate or a house number.'],
      ['Proof of address', 'Black out the account number on a photographed bill.']
    ],
    mistakes: [
      'Drawing the box tight to the text. Descenders and capitals often sit a pixel or two beyond the visible edge; leave a margin.',
      'Hiding one copy and missing the rest: the same number on a second line, in a reflection, or in a tab title.'
    ],
    faq: [
      { q: 'Can a blurred image be unblurred?', a: 'Partly. A blur is a known mathematical operation, so deblurring software can sometimes bring back shapes and even text at low strengths. A solid block leaves nothing to work from.' },
      { q: 'Does the saved image keep the original under the blur?', a: 'No. Only the changed pixels are in the new file, and none of the source photo’s metadata is copied.' },
      { q: 'Why is the redacted image bigger than the original?', a: 'PNG, the default, is lossless: the 321.4 KB street photo above became 2.79 MB. JPEG at 85 gave 349.5 KB, close to the original.' }
    ],
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome 154: build/promo/samples/street.jpg at full size (1600×1200, 321.4 KB). Uploaded with nothing drawn
         (the message "Nothing is covered yet", PNG 2.91 MB). Then a mouse drag on the picture canvas (722×542 on screen) from 38%,48% to 60%,63%:
         "Areas covered = 1", method pixelate, strength 16 (the defaults), PNG. Then #ic-format JPEG, #ic-quality 85; then PNG with method blur; then block. */
      { browser: { input: 'street.jpg, 1600x1200, 321.4 KB', method: 'pixelate', strength: 16, drag: { x0: 0.38, y0: 0.48, x1: 0.6, y1: 0.63 } }, shown: ['2.79 MB'] },
      { browser: { input: 'street.jpg', method: 'pixelate', strength: 16, drag: { x0: 0.38, y0: 0.48, x1: 0.6, y1: 0.63 }, format: 'image/jpeg', quality: 85 }, shown: ['349.5 KB'] },
      { browser: { input: 'street.jpg', method: 'blur', drag: { x0: 0.38, y0: 0.48, x1: 0.6, y1: 0.63 } }, shown: ['2.86 MB'] },
      { browser: { input: 'street.jpg', method: 'block', drag: { x0: 0.38, y0: 0.48, x1: 0.6, y1: 0.63 } }, shown: ['2.79 MB'] },
      { browser: { input: 'street.jpg', drag: 'none' }, shown: ['2.91 MB'] }
    ]
  },

  '/image/color-palette-extractor/': {
    term: 'a colour palette',
    whatIs: [
      'A palette is a short list of colours that stands for a whole image: similar colours are grouped, and one represents each group.',
      'Hex #ED815C and rgb(237, 129, 92) are the same colour: red, green and blue amounts from 0 to 255, written in base 16 and base 10.'
    ],
    howItWorks: {
      text: 'The image is drawn onto a small canvas, 160 px on its longest side, and read with `getImageData`, skipping pixels with alpha under 125. The palette comes from median cut, in the site’s own image library.',
      points: [
        'All pixels start in one box. The box with the widest spread in one channel is sorted along it and cut in two, until there are as many boxes as colours asked for.',
        'The cut falls at the biggest jump in value, so a small, distinct group gets its own box; with no jump of 8 or more it falls at the halfway point.',
        'Each swatch is its box’s average colour, and its share the box’s fraction of the pixels, rounded to a whole percentage.',
        'Each swatch also gets its HSL value and its WCAG contrast with white and black text; the CSS properties, `--colour-1` onwards, carry the HSL too.'
      ]
    },
    worked: {
      text: 'A photo of pancakes with strawberry slices on a white plate, asked for 4 colours: a light grey #BFBCB8 at 50%, a brown #67543E and a near-black #1F1F1E at 25% each, and a coral #ED815C at 0% of image. The coral is the strawberries, under half a percent of the pixels, kept apart by the cut at the biggest jump. Asked for 8, the greys, browns and creams split further and the coral stayed.'
    },
    uses: [
      ['Brand colours from a logo', 'Pull hex values from a client’s logo when there is no style guide.'],
      ['Slides that match a photo', 'Take heading and chart colours from a presentation’s cover photo.'],
      ['CSS themes', 'Paste the custom properties straight into a stylesheet.']
    ],
    mistakes: [
      'Reading the share as exact coverage. Boxes cut at their halfway point give round shares such as 50%, 25% and 13%; treat the figure as a ranking.',
      'Extracting from a screenshot with white page margins in it: margins take a swatch too, so crop to the picture first.'
    ],
    faq: [
      { q: 'Does the extractor give HSL values and contrast?', a: 'Yes. The coral #ED815C is hsl(15, 80%, 65%), 2.66:1 against white text, a fail, and 7.90:1 against black, AAA.' },
      { q: 'Why does another tool give a different palette for the same image?', a: 'Methods differ: median cut like this one, k-means with random starting points, or a count of the commonest colours.' },
      { q: 'Can I extract colours from a transparent PNG logo?', a: 'Yes. Pixels with alpha under 125 out of 255 are skipped, so the transparent background never becomes a swatch.' }
    ],
    runs: [
      /* input: build/promo/samples/food.jpg at full size (1600×1067). Number of colours set, then uploaded;
         figures from the stat rows ("Colour n #HEX", "rgb(…) · n% of image"). */
      { browser: { input: 'food.jpg, 1600x1067', count: 4 }, shown: ['#BFBCB8', '#67543E', '#1F1F1E', '#ED815C', 'rgb(237, 129, 92)', '0% of image', '50%', '25%'] },
      /* re-run 2026-10-04 with HSL and contrast added: the same swatches; colour 4's row reads
         "rgb(237, 129, 92) · hsl(15, 80%, 65%) · 0% of image · contrast with white text 2.66:1 fail, with black text 7.90:1 AAA" */
      { browser: { input: 'food.jpg', count: 4 }, shown: ['hsl(15, 80%, 65%)', '2.66:1', '7.90:1'] },
      { browser: { input: 'food.jpg', count: 8 }, shown: ['13%'] }
    ]
  },

  '/image/exif-viewer/': {
    term: 'EXIF metadata',
    whatIs: [
      'EXIF is a block of tags a camera or phone writes into a photo: the make and model, the exposure, the date and time, which way up it was held and, if location was switched on, where it was taken. XMP and IPTC are two more such blocks, written by editing software.',
      'None of it shows in the picture, and much of it survives email and file sharing.'
    ],
    howItWorks: {
      text: 'The file is read as raw bytes with `FileReader`, and the site’s own parser finds the metadata in whichever container it is: a JPEG’s APP1 segment, a PNG’s eXIf chunk, a WebP’s EXIF chunk, the Exif item a HEIC or AVIF file locates through its iloc box, or a TIFF’s tag directory.',
      points: [
        'It reads the main tag directory and the Exif and GPS directories, showing a fixed list of common tags, from Make to LensModel; others are skipped.',
        'GPS degrees, minutes and seconds become signed decimal degrees, south and west negative, with a map link that sends only those two numbers.',
        'XMP and IPTC fields such as creator, rights and caption follow the EXIF.',
        'A HEIC photo’s metadata is read even where the browser cannot draw the picture itself.'
      ]
    },
    worked: {
      text: 'A Lake Pukaki photo was given hand-made EXIF and XMP blocks. The viewer listed EXIF (168 B), XMP (413 B), APP0 (16 B) and ICC colour profile (472 B), turned 44° 6′ 30.6″ S, 170° 9′ 15″ E into -44.108500 and 170.154167, with the XMP creator. The same EXIF block inside a 362-byte HEIC file with no picture read the same, with Dimensions 4032×3024 from its ispe box and the orientation as Rotated 90° CW (6).'
    },
    uses: [
      ['Before posting', 'Check whether a photo for a listing or a forum still says where your home is.'],
      ['Checking a claim', 'See which camera and date a photo carries before relying on it.'],
      ['Photo credits', 'Read the creator an agency wrote into an image.']
    ],
    mistakes: [
      'Trusting the date blindly. DateTime is when software last saved the file, DateTimeOriginal when the shutter fired, and both rely on the camera’s clock.',
      'Taking “no EXIF” to mean the photo is clean. XMP and IPTC blocks can still hold names and places.'
    ],
    faq: [
      { q: 'How accurate is the GPS position in a photo?', a: 'A phone fix is usually good to a few metres outdoors. The six decimal places shown here are about 11 cm, far finer than the fix.' },
      { q: 'Can EXIF data be faked?', a: 'Yes. It is ordinary data that any metadata editor can rewrite, as the test file above was. Treat it as a claim, not proof.' },
      { q: 'What does the Orientation tag do?', a: 'It tells software to turn the picture on display instead of rotating the stored pixels; browsers obey it.' }
    ],
    runs: [
      /* re-run 2026-10-06: build/promo/samples/landscape.jpg (220,631 bytes) with an EXIF APP1 (Make DemoCam, Orientation 1,
         GPS 44°6'30.6"S 170°9'15"E; build/tests/image-fixtures.js exifTiff) and an XMP APP1 (dc:creator A. Photographer,
         dc:rights (c) 2026 A. Photographer) put in after SOI → lake-tagged.jpg, 221,216 bytes. Rows read off the page. */
      { browser: { input: 'lake-tagged.jpg', gps: '44 6 30.6 S, 170 9 15 E' }, shown: ['EXIF (168 B)', 'XMP (413 B)', 'ICC colour profile (472 B)', '-44.108500', '170.154167'] },
      /* the same EXIF block (Orientation 6) in a HEIF file built by heicWithExif(…, 4032, 3024): 362 bytes, no image item */
      { browser: { input: 'phone.heic (heicWithExif, 362 bytes)' }, shown: ['4032×3024', 'Rotated 90° CW (6)'] }
    ]
  },

  '/image/exif-remover/': {
    term: 'removing photo metadata',
    whatIs: [
      'Removing metadata means making a copy of a photo without the blocks of tags that ride along with the picture: EXIF from the camera, XMP and IPTC from editing software, comments and time stamps.',
      'A JPEG keeps its compressed picture in one run of bytes, the scan, and its metadata in separate segments before it; a PNG and a WebP keep theirs in separate chunks. So the metadata can be cut out without touching the picture.'
    ],
    howItWorks: {
      text: 'Lossless, the default, copies the file’s own bytes and leaves out every metadata segment or chunk; Redraw instead draws the pixels onto a fresh canvas and encodes a new file.',
      points: [
        'A JPEG keeps its scan byte for byte, with its JFIF header and colour profile; a PNG keeps only its drawing chunks; a WebP loses its EXIF and XMP chunks.',
        'Keep writes the chosen fields back as a small EXIF block of their own: the orientation tag by default, or the copyright and author.',
        'First the site’s own parser lists the original’s metadata and any GPS position being removed; then it reads each cleaned file back and reports what is really in it.',
        'GIF, BMP and AVIF have no lossless path here, so they are redrawn, and the page says so.'
      ]
    },
    worked: {
      text: 'A Lake Pukaki photo carrying camera, GPS and author tags, 216.0 KB, was listed with EXIF, XMP, APP0 and ICC colour profile, and the position going, -44.10850, 170.15417. Lossless gave 215.5 KB, 585 bytes lighter, with a scan identical to the original’s. Redraw as JPEG at 92 gave 271.2 KB, 26% bigger, and as PNG 1.48 MB.'
    },
    uses: [
      ['Selling online', 'Take the home location out of photos of things for sale before listing them.'],
      ['Sharing with the press', 'Send pictures without the device serial number and editing history.'],
      ['Keeping credit', 'Publish photos with only the copyright line left in.']
    ],
    mistakes: [
      'Stripping first and editing afterwards. Some editors write their own name, date and XMP on save, so strip last.',
      'Choosing “Nothing at all” for phone photos stored on their side. Without the orientation tag they display turned; keep it, or use Redraw.'
    ],
    faq: [
      { q: 'Does removing EXIF reduce photo quality?', a: 'Not in Lossless mode: the compressed picture is copied as it is, so the pixels are identical. Redraw compresses it again, at quality 92 by default.' },
      { q: 'Will the stripped photo still be the right way up?', a: 'Yes, by default: Lossless keeps the orientation tag unless you choose otherwise, and Redraw turns the pixels upright so no tag is needed.' },
      { q: 'How can I check that the metadata is gone?', a: 'The page reads the cleaned file back and says what is left; the EXIF viewer then lists only APP0 and the ICC colour profile for the test JPEG.' }
    ],
    runs: [
      /* re-run 2026-10-06 with Lossless as the default: lake-tagged.jpg (see /image/exif-viewer/: landscape.jpg plus an
         EXIF APP1 with camera and GPS and an XMP APP1 with creator and rights), uploaded with every control at its default,
         then Method Redraw (JPEG 92), then Save as PNG. Rows read off the page. */
      { browser: { input: 'lake-tagged.jpg, 221,216 bytes', method: 'lossless', keep: 'orientation' }, shown: ['216.0 KB', '-44.10850, 170.15417', '215.5 KB', '585'] },
      { browser: { input: 'lake-tagged.jpg', method: 'redraw', format: 'image/jpeg', quality: 92 }, shown: ['271.2 KB', '26%'] },
      { browser: { input: 'lake-tagged.jpg', method: 'redraw', format: 'image/png' }, shown: ['1.48 MB'] }
    ]
  },

  '/image/background-remover/': {
    term: 'background removal',
    whatIs: [
      'Background removal makes the pixels around a subject transparent, leaving a cut-out for any colour behind. That needs an alpha channel, which PNG has and JPEG lacks.',
      'Colour keying removes pixels close to a known background colour: exact on a plain backdrop, poor when the subject shares its colours. Segmentation models, neural networks trained to find the subject, cope with hair and busy scenes but are a large download.'
    ],
    howItWorks: {
      text: 'Automatic and “Pick a colour” are colour keying with a flood fill in the site’s own renderer, reading the canvas pixels with `getImageData`; no model is involved.',
      points: [
        'Automatic takes the four corner pixels as reference colours; “Pick a colour” uses yours. A pixel matches when it is within the tolerance of a reference.',
        'The fill starts from every edge pixel and spreads only to matching neighbours above, below and beside, so background cut off from the border stays.',
        'Edge softness averages each pixel’s opacity with its four neighbours, once per step.',
        'At tolerance 0 only the exact reference colour goes. No model is loaded and no other server is contacted; hair and busy scenes need the AI Background Remover.'
      ]
    },
    worked: {
      text: 'An 800 × 600 JPEG logo, a navy ring with a white centre and an orange square on white, lost 71.94% of its pixels to transparency on default settings. The white inside the ring stayed, since the fill from the edge never reached it. On a 1600 × 1067 portrait before a dark hedge, the same settings cleared 79.28%, taking the black top and much of the hair with the hedge.'
    },
    uses: [
      ['Product shots on a sweep', 'Cut out a product shot on white paper for a catalogue.'],
      ['Logos supplied as JPEG', 'Turn a JPEG logo on white into a transparent PNG.'],
      ['Changing a plain backdrop', 'Swap a grey studio background for pure white with “Replace with”.']
    ],
    mistakes: [
      'Expecting enclosed holes to clear. The inside of an O or the loops of a signature only go if they touch the edge.',
      'Using Automatic when a corner is not background. A watermark or shadow there becomes a reference colour; pick the colour instead.'
    ],
    faq: [
      { q: 'How do I remove a white background from a logo?', a: 'Leave Automatic on, or pick white, and raise the tolerance until the grey JPEG fringe goes. White enclosed by the logo stays.' },
      { q: 'What does the tolerance number mean?', a: 'It is a distance in red, green and blue values: at the default 32, a pixel up to about 55 units from the reference counts as background, since 32 × √3 ≈ 55.4.' },
      { q: 'How do I get a hard edge instead of a soft one?', a: 'Set Edge softness to 0. The default of 2 blends the boundary’s opacity over two passes.' }
    ],
    runs: [
      /* input: logo-on-white.jpg, drawn in Chrome: 800×600 canvas filled #ffffff, a #1d3557 disc r170 at (280,300)
         with a #ffffff disc r90 on top, a #e76f51 square 200×200 at (500,200), saved toBlob('image/jpeg', 0.85).
         Method Automatic, tolerance 32, softness 2, transparency. Measured on the downloaded PNG with getImageData:
         alpha 0 at 71.94% of pixels; the ring's centre (280,300) alpha 255, rgb 255,255,255. */
      { browser: { input: 'logo-on-white.jpg, 800x600, JPEG 0.85', mode: 'auto', tolerance: 32, feather: 2, replace: 'transparent' }, shown: ['71.94%'] },
      /* input: build/promo/samples/portrait.jpg at full size (1600×1067), same defaults; alpha 0 at 79.28% */
      { browser: { input: 'portrait.jpg, 1600x1067', mode: 'auto', tolerance: 32, feather: 2 }, shown: ['79.28%'] }
      /* re-run 2026-10-04 after the AI mode was removed and tolerance 0 fixed: the default path is unchanged (the
         logo's PNG is still 800×600, 63.8 KB); build/tests/image-fixes.js proves tolerance 0 keeps a #f5f5f5 area */
    ]
  },

  '/image/image-cropper/': {
    whatTitle: 'What cropping actually changes',
    whatIs: [
      'Cropping keeps one rectangle of the original pixels and discards the rest. Nothing is scaled, so cutting away half the width leaves half the resolution to print or display.',
      'The aspect ratio is the box’s shape: 1:1 for an avatar, 16:9 for a slide or video frame, 9:16 for a story, 3:2 for a 6×4 inch print. Locking it fixes the shape, never the size.'
    ],
    howItWorks: {
      text: 'The preview is only a window: every box you draw, move or type is kept in the original’s own pixel coordinates, so the crop comes from the full-resolution file.',
      points: [
        'Draw a box, drag it, pull its handles, or type X, Y, Width and Height; a locked ratio is obeyed at once.',
        'Straighten turns the picture up to 45° against a grid, then sets the box to the largest upright area with no empty corners.',
        'A platform size saves at its exact pixels, shrunk by Lanczos3; a box smaller than that is saved at its own size, never enlarged.',
        'The result is encoded again as PNG (the default), JPEG or WebP, and the page shows its output size.'
      ]
    },
    worked: {
      text: 'A 1600×1200 street photo, a 321.4 KB JPEG, was cropped with 16:9 locked: the number boxes were set to X 160, Y 240 and a width of 1280, and the height followed: a 1280×720 box, a true 16:9. Downloaded as PNG, the default, the crop weighed 1.51 MB, nearly five times the whole original. The same box saved as JPEG at quality 85 was 184.7 KB. For photographs, change the format before downloading.'
    },
    uses: [
      ['Profile pictures', 'Lock 1:1 and centre the face for a round avatar.'],
      ['Slides and thumbnails', 'Lock 16:9 so a photo fills a presentation slide or a video frame without bars.'],
      ['Trimming screenshots', 'Cut one dialogue box out of a full-screen capture.']
    ],
    mistakes: [
      'Leaving PNG selected for a photograph. Lossless PNG makes a cropped photo heavier than its JPEG source; pick JPEG or WebP.',
      'Cropping a shrunk copy. Crop the original first, then resize.'
    ],
    faq: [
      { q: 'Does cropping a photo reduce its quality?', a: 'The pixels inside the box are copied unchanged. Quality drops only if you save as JPEG or WebP, which compress them again.' },
      { q: 'Does cropping remove location data from a photo?', a: 'By default, yes: the crop is a new file with no EXIF or GPS tags. Metadata can keep the colour profile or EXIF without GPS.' },
      { q: 'Can I crop several images at once?', a: 'No. Each crop needs its own box on its own picture, so the cropper takes one image at a time.' }
    ],
    related: { guides: ['/guides/convert-jpg-to-pdf/'] },
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome: street.jpg from build/promo/samples at full size (1600×1200, 329,068 bytes = 321.4 KB).
         #ic-ratio 16:9, #ic-format PNG, upload; then the number boxes #crop-w 1280, #crop-x 160, #crop-y 240 (each followed by a change event):
         the Selection row reads 1280×720 at 160, 240. Output size row and the download's size read. */
      { browser: { tool: '/image/image-cropper/', file: 'build/promo/samples/street.jpg, full size 1600×1200, 321.4 KB', ratio: '16:9', format: 'image/png', box: 'w 1280, x 160, y 240 typed in the number boxes' },
        shown: ['1280×720', '1.51 MB'] },
      /* the same box, #ic-format JPEG and #ic-quality 85 */
      { browser: { tool: '/image/image-cropper/', file: 'build/promo/samples/street.jpg, full size', ratio: '16:9', format: 'image/jpeg', quality: 85, box: 'w 1280, x 160, y 240' },
        shown: ['184.7 KB'] }
    ]
  },

  '/image/image-rotate-flip/': {
    term: 'image rotation',
    whatIs: [
      'Rotation turns a picture about its centre; mirroring flips it across a vertical or horizontal line, like a reflection. A quarter turn only rearranges whole pixels. Any other angle lands each new pixel between old ones, so its value is blended from its neighbours and fine detail softens slightly.',
      'A tilted picture also stops fitting its rectangle: the frame has to grow, and its new corners need filling with something.'
    ],
    howItWorks: {
      text: 'The canvas is sized to the turned picture’s bounding box, `w·|cos θ| + h·|sin θ|` wide by `w·|sin θ| + h·|cos θ|` high, rounded to whole pixels.',
      points: [
        'For any angle but zero the canvas is first painted with the fill colour, white by default; that is what shows in the corners.',
        'The origin moves to the centre, `ctx.rotate` turns it, `ctx.scale` with −1 applies a mirror, and the image is drawn once with high-quality smoothing.',
        'Save as is PNG by default, lossless and far heavier than a JPEG photo; JPEG or WebP take the quality slider, 92 to start.',
        'Several images dropped together get the same settings and download as one ZIP.'
      ]
    },
    worked: {
      text: 'Straightening a 1600×1063 landscape, a 215.5 KB JPEG, by −4° produced a 1670×1172 canvas: the picture plus four white wedges in the corners, which a crop then has to remove. As a PNG it weighed 2.49 MB; saved as JPEG at 92, 288.2 KB. A plain horizontal mirror kept the size at 1600×1063 and weighed 2.31 MB as PNG, 254.6 KB as JPEG, while a 90° turn simply swapped the sides to 1063×1600.'
    },
    uses: [
      ['Straightening a horizon', 'Turn a tilted sea or skyline by a degree or two, then crop the corners off.'],
      ['Fixing a scanned page', 'Turn a page that went through the scanner sideways or upside down by 90 or 180 degrees.'],
      ['Un-mirroring a selfie', 'Flip a front-camera shot so the writing on a sign reads the right way.']
    ],
    mistakes: [
      'Mirroring a photo with writing in it. Text, logos and number plates come out backwards; mirror only symmetric subjects.',
      'Correcting a tilt in several small steps. Every odd angle resamples the pixels again; find the right angle and apply it once to the original.'
    ],
    faq: [
      { q: 'Why is the rotated file so much bigger than my photo?', a: 'PNG, the default, has no lossy compression: the 215.5 KB landscape JPEG above, mirrored, became 2.31 MB. Pick JPEG under Save as, quality 92, and it was 254.6 KB.' },
      { q: 'What is the difference between flipping and rotating 180 degrees?', a: 'A 180° turn leaves text readable once turned back; a vertical flip mirrors it. Mirroring both ways at once equals a 180° turn.' },
      { q: 'Can I rotate several photos at once?', a: 'Yes. Drop them in together and each gets the same angle and mirror.' }
    ],
    related: { guides: ['/guides/compress-an-image/'] },
    runs: [
      /* landscape.jpg from build/promo/samples at full size (1600×1063, 215.5 KB). Set #ic-angle to -4, mirrors No, fill white,
         upload, read the result card's caption and the Original total / Result total rows. */
      /* every figure below re-measured 2026-10-04 in headless Chrome 154.0.8037.94; the earlier 2.66 MB, 2.45 MB,
         288.3 KB and 254.7 KB no longer reproduced */
      { browser: { tool: '/image/image-rotate-flip/', file: 'build/promo/samples/landscape.jpg, full size 1600×1063', angle: -4, flipH: 'no', flipV: 'no', bg: '#ffffff' },
        shown: ['1600×1063', '215.5 KB', '1670×1172', '2.49 MB'] },
      /* the same photo, angle 0, #ic-flipH Yes */
      { browser: { tool: '/image/image-rotate-flip/', file: 'build/promo/samples/landscape.jpg, full size', angle: 0, flipH: 'yes' },
        shown: ['2.31 MB'] },
      /* #ic-format JPEG, #ic-quality 92 (its default), angle −4, then the mirror */
      { browser: { tool: '/image/image-rotate-flip/', file: 'build/promo/samples/landscape.jpg, full size', angle: -4, format: 'image/jpeg', quality: 92 },
        shown: ['288.2 KB'] },
      { browser: { tool: '/image/image-rotate-flip/', file: 'build/promo/samples/landscape.jpg, full size', angle: 0, flipH: 'yes', format: 'image/jpeg', quality: 92 },
        shown: ['254.6 KB'] },
      /* the same photo, angle 90 */
      { browser: { tool: '/image/image-rotate-flip/', file: 'build/promo/samples/landscape.jpg, full size', angle: 90 },
        shown: ['1063×1600'] }
    ]
  },

  '/image/image-splitter/': {
    whatTitle: 'What splitting an image into tiles means',
    whatIs: [
      'Splitting cuts one picture into a grid of separate files, so many columns across and so many rows down. Each tile is an ordinary image: a panorama becomes swipeable panels, a poster prints sheet by sheet, a sprite sheet breaks into frames.',
      'Every tile has the same size, so the pieces line up and read as one picture again when they are shown side by side.'
    ],
    howItWorks: {
      text: 'Tile size is the picture’s size divided by the grid and rounded down: `floor(width ÷ columns)` by `floor(height ÷ rows)`.',
      points: [
        'Presets set the grid: 3 or 2 carousel panels, a 3×3 mosaic or two halves; Custom takes your own counts.',
        'Each tile is copied with `drawImage` from its own rectangle of the original, so tiles meet exactly, unscaled and without overlap.',
        'Pixels left over by the rounding, fewer than the column or row count, are dropped at the right and bottom edges.',
        'Tiles are JPEG at a fixed quality of 90, or PNG, named `r1c1`, `r1c2` and so on, and download together as a ZIP.'
      ]
    },
    worked: {
      text: 'A 1600×1200 street photo split into a custom grid of 7 columns and 2 rows gave 14 tiles of 228×600. Seven columns of 228 pixels fall 4 short of the full width, so a thin strip on the right was dropped. As JPEG the tiles came to 475.4 KB, from 44.0 KB for the busiest piece of street to 23.4 KB for the plainest. The 3×3 preset gave tiles of 533×400, losing one pixel column.'
    },
    uses: [
      ['Printing a poster at home', 'Split a large image 2×2 or 3×3 and print each tile on its own sheet.'],
      ['Sprite sheets', 'Cut a game or icon sheet laid out on an even grid into separate frames.'],
      ['Before-and-after pairs', 'Separate a side-by-side comparison into its two pictures with the horizontal halves preset.']
    ],
    mistakes: [
      'Splitting a portrait photo into a 3-panel carousel. Three columns of a tall picture are slivers; carousels suit panoramas about three times as wide as they are tall.',
      'Choosing JPEG for pixel-art sprites. JPEG smears hard edges and flat colour; switch to PNG for sprites, icons and screenshots.'
    ],
    faq: [
      { q: 'How do I split a picture for an Instagram carousel?', a: 'Pick the 3-panel or 2-panel preset and post the tiles in r1c1, r1c2, r1c3 order. For square panels, start from an image three (or two) times as wide as it is tall.' },
      { q: 'What size will each tile be in a 3×3 grid?', a: 'A third of each side, rounded down. Crop the source to a square first if you want square tiles.' },
      { q: 'Can I split an image into more than nine pieces?', a: 'Yes. The custom boxes go up to 12 columns and 12 rows, 144 tiles in all.' }
    ],
    runs: [
      /* street.jpg from build/promo/samples at full size (1600×1200). #ic-preset Custom grid, #ic-cols 7, #ic-rows 2, format
         JPEG (default). Read the Files produced and Total size rows and each tile card's caption. */
      { browser: { tool: '/image/image-splitter/', file: 'build/promo/samples/street.jpg, full size 1600×1200', preset: 'custom', cols: 7, rows: 2, format: 'image/jpeg' },
        shown: ['14', '228×600', '475.4 KB', '44.0 KB', '23.4 KB'] },
      /* the same photo, #ic-preset "Instagram 3×3 mosaic" */
      { browser: { tool: '/image/image-splitter/', file: 'build/promo/samples/street.jpg, full size', preset: 'grid3x3' },
        shown: ['533×400'] }
    ]
  },

  '/image/image-to-base64/': {
    term: 'Base64 encoding',
    whatIs: [
      'Base64 writes binary data with 64 text-safe characters (A–Z, a–z, 0–9, + and /), so an image can sit inside a stylesheet or a JSON field. Every 3 bytes become 4 characters, padded with = to a multiple of 4: hence the one-third growth.',
      'A data URI puts the type in front, as in data:image/png;base64,…, and the browser decodes the picture from the text without a request.'
    ],
    howItWorks: {
      text: 'The file is read byte for byte with `FileReader.readAsArrayBuffer` and never redrawn, so the text decodes back to an identical copy of it.',
      points: [
        'The bytes go, as a binary string, to the browser’s `btoa`, which returns the Base64.',
        'The prefix uses the type the browser reports for the file (`file.type`), such as `image/svg+xml`, falling back to `image/png`.',
        'Output can be a data URI, a CSS `background-image` rule, an HTML `<img>` tag or bare Base64.',
        'The preview stops at 40,000 characters to stay responsive; Copy always takes the full value.'
      ]
    },
    worked: {
      text: 'A 16×16 PNG icon of 83 B, written by a short script, became 112 characters of Base64, an overhead of +35%: on a tiny file the padding pushes the cost past a third. At the other extreme, a 1600×1067 food photo of 217.2 KB became 296,508 characters (289.6 KB encoded, +33%), and the tool warned that it was too large to inline. The icon belongs in the stylesheet; the photo belongs in a file of its own.'
    },
    uses: [
      ['Icons in a stylesheet', 'Put a small arrow or tick into the CSS so it never pops in late.'],
      ['Single-file HTML', 'Embed every picture in a report so it opens offline as one file.'],
      ['API requests', 'Send an image inside a JSON body to a service that takes Base64 strings.']
    ],
    mistakes: [
      'Pasting the whole data URI where an API wants Base64 alone. Many expect only the characters after the comma; choose Raw Base64 or the request fails to decode.',
      'Inlining images in HTML email. Gmail and many other webmail clients do not display data: URI images, so recipients see a broken picture; host or attach the image instead.'
    ],
    faq: [
      { q: 'How do I turn Base64 back into an image file?', a: 'Decode the characters after the comma with any Base64 decoder and save the bytes with the right extension. The file was encoded as it was, so the copy is identical.' },
      { q: 'Is Base64 a kind of encryption?', a: 'No. Anyone can reverse it in one step, so it hides nothing and protects nothing.' },
      { q: 'Which image formats can be encoded?', a: 'Any image the browser can open, PNG, JPEG, GIF, WebP and SVG among them. The bytes are not converted, so a GIF stays a GIF inside the data URI.' }
    ],
    runs: [
      /* .work/icon16.png: a 16×16 PNG written by a Node script, every pixel #f7c948 opaque, 8-bit RGBA, filter 0 on every row,
         IDAT from zlib.deflateSync(level 9), no other chunks; 83 bytes. Output as CSS background-image. Read the stats. */
      { browser: { tool: '/image/image-to-base64/', file: '16×16 PNG, all pixels #f7c948 opaque, RGBA, IHDR + one IDAT (zlib level 9) + IEND, 83 bytes', wrap: 'css' },
        shown: ['83 B', '112 characters', '+35%'] },
      /* food.jpg from build/promo/samples at full size (1600×1067, 222,381 bytes), output as data URI. The warning reads
         "This file is large for inlining." */
      { browser: { tool: '/image/image-to-base64/', file: 'build/promo/samples/food.jpg, full size 1600×1067', wrap: 'datauri' },
        shown: ['217.2 KB', '296,508 characters', '289.6 KB', '+33%'] }
    ]
  },

  '/image/image-to-pdf/': {
    whatTitle: 'What happens to a photo when it becomes a PDF page',
    whatIs: [
      'In a PDF the photo becomes an image object drawn at a set size in points, 72 to the inch. A4 is 595 × 842 points and US Letter 612 × 792, whatever the pixel count.',
      'PDF can hold JPEG data as it is (DCTDecode) and PNG data losslessly (FlateDecode), so photo PDFs stay close to the size of their pictures. Text in the photos stays a picture.'
    ],
    howItWorks: {
      text: 'The site’s own small PDF writer in `imagecore` builds the file; no PDF library is loaded.',
      points: [
        'A JPEG’s own compressed bytes become the page image, with its colour profile; only EXIF, GPS, XMP and comment blocks are left out.',
        'PNG, GIF and BMP keep every pixel, with transparency as a soft mask. WebP, AVIF, sideways or CMYK JPEGs, and any JPEG under Re-encode are drawn on white and saved at the slider’s quality, 88 by default.',
        'Each image fits inside the margin (28 points by default) or fills the page; “Match each image” turns pages landscape for wide images, and “Fit to image” makes the page one point per pixel.',
        'Drag the thumbnails to reorder, turn a single page with ⟲ or ⟳, and name the file yourself. The result has no title, bookmarks or text layer.'
      ]
    },
    worked: {
      text: 'Two landscape photos, 1600×1067 (264.5 KB) and 1600×1063 (215.5 KB), went onto Letter with “Match each image”, and both pages turned to 792 × 612 points. Kept as they were, the PDF was 482.2 KB. Re-encoded at 88 it came to 495.6 KB, at 100 to 1.82 MB and at 60 to 218.7 KB. “Fit to image” made the first page 1600 × 1067 points.'
    },
    uses: [
      ['Applications that want one file', 'Put photos of a passport page and a utility bill into the single PDF a form accepts.'],
      ['Handing in written work', 'Photograph handwritten pages, drag them into order and submit one PDF.'],
      ['Screenshot evidence', 'Use “Fit to image” so each screenshot keeps its own shape in a complaint bundle.']
    ],
    mistakes: [
      'Re-encoding at 100 to “keep” quality. Keeping the JPEGs as they are loses nothing, and quality 100 made a PDF nearly four times the size of 88.',
      'Typing the margin in millimetres. The box is in points: 28 is just under 10 mm.'
    ],
    faq: [
      { q: 'Does converting JPG to PDF reduce image quality?', a: 'Not by default: each JPEG’s data goes in unchanged and PNGs stay lossless. Sideways phone shots and a chosen Re-encode are compressed again.' },
      { q: 'How do I make the PDF smaller?', a: 'Choose Re-encode and lower the slider; at 60 the two photos above made 218.7 KB instead of 482.2 KB.' },
      { q: 'What page size does “Fit to image” give?', a: 'One point per pixel, so a 1600-pixel-wide photo makes a page over 22 inches wide: too big for paper.' }
    ],
    related: { guides: ['/guides/convert-jpg-to-pdf/'] },
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome. portrait.jpg then landscape.jpg from build/promo/samples, both full size
         (1600×1067, 270,812 B = 264.5 KB; 1600×1063, 220,631 B = 215.5 KB; the file list shows both). #ic-pageSize Letter,
         #ic-orientation Match each image, margin 28, #ic-jpeg "Keep as they are". Read the PDF size row; the Embedding row reads
         "2 JPEGs embedded as they are"; /MediaBox read from the downloaded bytes. */
      { browser: { tool: '/image/image-to-pdf/', files: ['build/promo/samples/portrait.jpg, full size 1600×1067, 264.5 KB', 'build/promo/samples/landscape.jpg, full size 1600×1063, 215.5 KB'], pageSize: 'letter', orientation: 'auto', margin: 28, jpeg: 'keep', mediaBox: '[0 0 792.00 612.00] on both pages' },
        shown: ['264.5 KB', '215.5 KB', '792 × 612', '482.2 KB'] },
      /* the same two files, #ic-jpeg "Re-encode at the quality below", #ic-quality 88, then 100, then 60 */
      { browser: { tool: '/image/image-to-pdf/', files: ['portrait.jpg', 'landscape.jpg'], pageSize: 'letter', orientation: 'auto', jpeg: 'reencode', quality: 88 },
        shown: ['495.6 KB'] },
      { browser: { tool: '/image/image-to-pdf/', files: ['portrait.jpg', 'landscape.jpg'], pageSize: 'letter', orientation: 'auto', jpeg: 'reencode', quality: 100 },
        shown: ['1.82 MB'] },
      { browser: { tool: '/image/image-to-pdf/', files: ['portrait.jpg', 'landscape.jpg'], pageSize: 'letter', orientation: 'auto', jpeg: 'reencode', quality: 60 },
        shown: ['218.7 KB'] },
      /* the same two files, #ic-pageSize Fit to image, kept; /MediaBox [0 0 1600.00 1067.00] and [0 0 1600.00 1063.00] */
      { browser: { tool: '/image/image-to-pdf/', files: ['portrait.jpg', 'landscape.jpg'], pageSize: 'fit', jpeg: 'keep', mediaBox: '[0 0 1600.00 1067.00], [0 0 1600.00 1063.00]' },
        shown: ['1600 × 1067'] }
    ]
  },

  '/image/meme-generator/': {
    term: 'an image macro',
    whatIs: [
      'An image macro is a picture with a short caption in large type along its top and bottom edges, the format most people mean by “meme”. The style that stuck is white capitals with a thick black outline, readable on light and dark backgrounds alike.',
      'The usual face is Impact, a heavy condensed sans-serif that came with most Windows and Mac computers; phones often lack it.'
    ],
    howItWorks: {
      text: 'The captions are painted onto a full-size copy of your picture, so they become part of the pixels. The default face is Anton, a free font served from this site, so every device draws the same letters.',
      points: [
        'Font size is a percentage of the picture’s height, in Anton unless you choose Impact (where the device has it), Bebas Neue, Comic Neue or Permanent Marker.',
        'The text is capitalised if “Force uppercase” is on, then broken at spaces into lines no wider than 94% of the picture.',
        'Each line is stroked in the outline colour, 12% of the font size by default, then filled in the text colour on top.',
        'Drag any caption, add more text boxes and image stickers, and save PNG (the default), JPEG or WebP at the picture’s own size.'
      ]
    },
    worked: {
      text: 'On a 1600×1067 group photo, “when the meeting could have been an email” was typed in lower case and came out in capitals. At the default 10% size the PNG was 1600×1067 and 2.52 MB; at 6% it was 2.65 MB, from a 308.3 KB original. Smaller text hides less photographic detail, and detail is what makes a PNG heavy. Saved as JPEG at 92, the 10% meme was 391.9 KB.'
    },
    uses: [
      ['Team updates', 'Open a sprint review or an internal newsletter with a captioned office photo.'],
      ['Small-brand social posts', 'Caption your own product photo, with no app logo stamped on it.'],
      ['Reaction images', 'Turn a screenshot into a reusable reply for a forum or group chat.']
    ],
    mistakes: [
      'Writing a full sentence in each caption. Three or four lines at 10% bury much of the picture; cut the words or lower the size.',
      'Sending the PNG where uploads are capped. A phone-photo meme is often several megabytes; pick JPEG under Save as.'
    ],
    faq: [
      { q: 'What font do memes use?', a: 'Impact, in white capitals with a black outline. This page uses Anton, a similar free face it carries itself, because Impact is missing on many phones.' },
      { q: 'Can I change the colour of the meme text?', a: 'Yes, both the text and the outline colour. Keep strong contrast between them, such as yellow on black.' },
      { q: 'Can I make a meme with only a top caption?', a: 'Yes. Leave the bottom box empty and nothing is drawn there; the same works the other way round.' }
    ],
    related: { guides: ['/guides/compress-an-image/'] },
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome: group.jpg from build/promo/samples at full size (1600×1067, 308.3 KB). #ic-top "when the meeting
         could have been an email", #ic-bottom "and it was", #ic-size 10, font Anton, colours and Force uppercase at their defaults. Read the result card
         and the Original total / Result total rows. */
      { browser: { tool: '/image/meme-generator/', file: 'build/promo/samples/group.jpg, full size 1600×1067', top: 'when the meeting could have been an email', bottom: 'and it was', size: 10, caps: 'yes' },
        shown: ['1600×1067', '308.3 KB', '2.52 MB'] },
      /* the same with #ic-size 6 */
      { browser: { tool: '/image/meme-generator/', file: 'build/promo/samples/group.jpg, full size', top: 'when the meeting could have been an email', bottom: 'and it was', size: 6 },
        shown: ['2.65 MB'] },
      /* size 10 again, #ic-format JPEG, #ic-quality 92 */
      { browser: { tool: '/image/meme-generator/', file: 'build/promo/samples/group.jpg, full size', top: 'when the meeting could have been an email', bottom: 'and it was', size: 10, format: 'image/jpeg', quality: 92 },
        shown: ['391.9 KB'] }
    ]
  },

  '/image/passport-photo/': {
    whatTitle: 'What a passport photo specification sets',
    whatIs: [
      'A passport or visa photo must match a printed size, such as 35×45 mm for a UK passport or 2×2 inches for a US one. The rules also cover head size, background and expression, and differ by country.',
      'To print, millimetres become pixels at a set resolution: at 300 dots per inch, 35 mm is 413 pixels.'
    ],
    howItWorks: {
      text: 'The tool holds 43 documents with their sizes at 300 DPI; all but a generic stamp size name the issuer’s page. Your photo is scaled to cover the frame and placed where you drag it, or where a 1.5 MB face-finding model on your device puts it.',
      points: [
        'Pixels are `round(mm ÷ 25.4 × 300)`: 35×45 mm is 413×531, the US 2×2 inch photo 600×600 (50.8 mm), India’s 51 mm visa photo 602×602, which prints at 50.97 mm.',
        'The head guide uses the issuer’s published figure, or the ICAO 70–80% where there is none.',
        'The print sheet is 6×4 inches (1800×1200) or A4 (2480×3508), with as many copies as fit and thin cutting lines.',
        'Files are JPEG or PNG and say 300 DPI inside; “under N KB” finds the highest JPEG quality that fits.',
        'Replace cuts the person out with MODNet, a 25 MB model served from this site.'
      ]
    },
    worked: {
      text: 'From a 1600×1067 portrait, the UK preset gave a 413×531 single photo of 79.7 KB as JPEG and 288.4 KB as PNG. The 6×4 sheet held 8 copies and weighed 671.4 KB; the A4 sheet held 30 copies at 2480×3508 and weighed 2.45 MB. With a limit of 50 KB the JPEG came to 45.1 KB at quality 89. India’s 602×602 square fitted 2 copies on a 6×4 sheet.'
    },
    uses: [
      ['Kiosk or lab prints', 'Take the 6×4 sheet to a print service and cut the copies out along the grey lines.'],
      ['Portal uploads', 'Upload the single JPEG under the KB limit the form states.'],
      ['Visa applications', 'Pick the destination’s own document when its photo differs.']
    ],
    mistakes: [
      'Shooting too close or off-centre. Dragging cannot add what the shot lacks; stand back from a plain wall.',
      'Printing the sheet with “fit to page”. Any scaling changes the millimetre size of every copy; print at 100%.'
    ],
    faq: [
      { q: 'What size is a UK passport photo in pixels?', a: 'At 300 DPI, 35×45 mm is 413×531 pixels. The UK online application has its own digital rules; read them first.' },
      { q: 'How many passport photos fit on a print sheet?', a: 'Here, 8 at 35×45 mm on a 6×4 inch sheet and 30 on A4, but only 2 of India’s 51×51 mm photos on the 6×4.' },
      { q: 'Is a 2×2 inch photo the same as 51×51 mm?', a: 'Nearly. Two inches is 50.8 mm, which is 600 pixels; 51 mm comes out as 602 pixels, about 0.2 mm longer.' }
    ],
    related: { conversions: ['/conversions/length/millimeter-to-inch/'] },
    runs: [
      /* 2026-10-07, wave 1 build in headless Chrome: portrait.jpg from build/promo/samples at full size (1600×1067). #ic-preset uk-passport,
         Single photo + print sheet, JPEG (quality 95 by default), then PNG, then the 6×4 and A4 sheets, then a 50 KB limit.
         Read the result cards' captions. */
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size 1600×1067', preset: 'uk-passport', sheet: 'single', format: 'image/jpeg' },
        shown: ['413×531', '79.7 KB'] },
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: 'uk-passport', sheet: 'single', format: 'image/png' },
        shown: ['288.4 KB'] },
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: 'uk-passport', sheet: '6×4', format: 'image/jpeg' },
        shown: ['8 copies', '671.4 KB'] },
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: 'uk-passport', sheet: 'A4', format: 'image/jpeg' },
        shown: ['30 copies', '2480×3508', '2.45 MB'] },
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: 'uk-passport', sheet: 'single', target: '50' },
        shown: ['45.1 KB', 'quality 89'] },
      /* in-2x2: the Print size row reads "602×602 px at 300 DPI = 50.97 × 50.97 mm"; the 6×4 sheet holds 2 copies. us-passport: 600×600 */
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: 'in-2x2', sheet: '6×4' },
        shown: ['602×602', '2 copies', '50.97 mm'] },
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: 'us-passport' },
        shown: ['600×600', '50.8 mm'] }
    ]
  },

  '/image/photo-filters/': {
    whatTitle: 'What a photo filter does to the pixels',
    whatIs: [
      'A filter is a fixed calculation run on every pixel. Brightness multiplies each colour value; contrast pushes values away from mid-grey; saturation moves colours towards or away from grey; a hue rotation turns every colour round the colour wheel; blur averages each pixel with its neighbours.',
      'Presets are recipes of those steps. Black & white removes saturation while keeping each pixel’s brightness, sepia tints the result brown, and invert subtracts every value from the maximum.'
    ],
    howItWorks: {
      text: 'The page works the filters out itself, pixel by pixel, in a background worker, rather than through the canvas filter Safari lacks, so every browser makes the same file.',
      points: [
        'Presets are the Filter Effects colour matrices: Black & white is grayscale at 1, sepia 0.85, and Cool and Warm turn the hue by −12° and +12°.',
        'Preset strength mixes the filtered picture with the original, so 40% keeps 60% of each pixel as it was.',
        'Exposure doubles the light per stop; Highlights and Shadows bend only the bright or the dark half of the tones.',
        'The result keeps the original size, saved as PNG unless Save as says JPEG or WebP.'
      ]
    },
    worked: {
      text: 'A 1600×1200 street photo, a 321.4 KB JPEG, saved with no changes came back as a 1.95 MB PNG: that jump is the format, not the filter. With Black & white it was 1.02 MB, since a grey picture needs one channel instead of three. A 3 px blur brought it to 345.4 KB. The same Black & white picture as JPEG at 92 was 367.6 KB.'
    },
    uses: [
      ['A consistent set', 'Give a batch of product or event photos the same preset so they read as one series.'],
      ['Backgrounds behind text', 'Blur and darken a photo used behind a slide title so the words stand out.'],
      ['Rescuing a dark face', 'Lift Shadows on a backlit portrait without washing out the sky behind it.']
    ],
    mistakes: [
      'Stacking a preset and the same slider. Dramatic already sets contrast to 1.35; contrast at 130% on top multiplies to about 1.75 and crushes the shadows.',
      'Blurring text or faces to hide them. A light blur can sometimes still be read; for redaction, cover the area with a solid block.'
    ],
    faq: [
      { q: 'How do I make a photo black and white?', a: 'Choose the Black & white preset, then raise contrast a little if the result looks flat.' },
      { q: 'Do these filters work in every browser?', a: 'Yes. The page calculates them itself, so a photo filtered in Safari matches the one from Chrome.' },
      { q: 'What is the difference between brightness and exposure?', a: 'Brightness scales the stored values, so mid-tones and shadows move by the same factor. Exposure scales the light before it is stored, so one stop brightens shadows less than highlights, as opening a lens would.' }
    ],
    related: { guides: ['/guides/compress-an-image/'] },
    runs: [
      /* re-run 2026-10-06 after the filters moved onto the pixels (engine/img-filters-core.mjs) and PNG onto oxipng:
         street.jpg from build/promo/samples at full size (1600×1200, 321.4 KB), every slider at its default,
         Preset None. Read the Original total and Result total rows. */
      { browser: { tool: '/image/photo-filters/', file: 'build/promo/samples/street.jpg, full size 1600×1200', preset: 'none' },
        shown: ['321.4 KB', '1.95 MB'] },
      { browser: { tool: '/image/photo-filters/', file: 'build/promo/samples/street.jpg, full size', preset: 'grayscale' },
        shown: ['1.02 MB'] },
      { browser: { tool: '/image/photo-filters/', file: 'build/promo/samples/street.jpg, full size', preset: 'grayscale', blur: 3 },
        shown: ['345.4 KB'] },
      { browser: { tool: '/image/photo-filters/', file: 'build/promo/samples/street.jpg, full size', preset: 'grayscale', format: 'image/jpeg', quality: 92 },
        shown: ['367.6 KB'] }
    ]
  },

  '/image/social-media-resizer/': {
    term: 'social media image sizes',
    whatIs: [
      'Every platform shows pictures in frames of its own shape: square and upright posts, tall stories, wide covers and thumbnails. A photo of another shape is either cropped to fit the frame or shrunk inside it with the gaps filled.',
      'Uploading at the exact size a platform uses means its own resizing does as little as possible to the picture, and you, not an algorithm, choose what gets cut.'
    ],
    howItWorks: {
      text: '16 presets cover Instagram, Facebook, X, LinkedIn, YouTube, Pinterest, TikTok, WhatsApp and the web, from a 600×200 email header to 2560×1440 channel art, dated beside the list. Each one you tick gets a canvas of exactly its size, and the photo is drawn in with Lanczos3 resampling.',
      points: [
        'Fill and crop takes the larger of the two scale factors and keeps the point you clicked on the photo as near the middle as the edges allow.',
        'Fit whole image takes the smaller factor and fills the rest with the bar colour, or with a soft, darkened copy of the photo itself.',
        'Dragging one result moves the photo inside that frame only.',
        'A frame bigger than the photo enlarges it, and each card says by how much.'
      ]
    },
    worked: {
      text: 'A 1600×1067 portrait photo went to three slots. Fill and crop gave 660.9 KB in all at quality 90, the 1080×1920 story enlarged 1.80× and the 1584×396 LinkedIn cover keeping only a strip of the photo. Fit whole image kept every pixel, 484.5 KB in all; on a blurred copy instead of bars it came to 582.3 KB. At quality 75 the cropped set fell to 289.3 KB.'
    },
    uses: [
      ['One post, every network', 'Make the square, the story and the link preview of one photo in one go.'],
      ['Channel branding', 'Cut a cover, a header and a thumbnail from the same picture.'],
      ['Newsletters', 'Make the 600×200 header for an email from a wide photo.']
    ],
    mistakes: [
      'Leaving every preset ticked. All 16 are on when the page opens; untick the slots you never post to.',
      'Ignoring the focal point. A face at the edge of a wide photo is cut off by tall frames unless you click it first.'
    ],
    faq: [
      { q: 'What size is an Instagram story?', a: '1080×1920 pixels, a 9:16 frame, so a landscape photo loses most of its width there or sits between bars.' },
      { q: 'What is the best size for a YouTube thumbnail?', a: '1280×720 pixels, the 16:9 preset here. The 1600×1067 portrait photo above, filled and cropped, made a 210.1 KB JPEG at quality 90.' },
      { q: 'Should I upload JPEG or PNG to social media?', a: 'JPEG for photographs, since platforms recompress uploads anyway. PNG suits graphics with text and flat colour, where JPEG artefacts show.' }
    ],
    runs: [
      /* re-run 2026-10-06 with the wave 1 editor (Lanczos3, focal point, MozJPEG): portrait.jpg from build/promo/samples
         (1600×1067), only Instagram Story / Reel, LinkedIn Cover and YouTube Thumbnail ticked (presets 2, 8, 9), JPEG at 90;
         figures from the cards and the Total size row */
      { browser: { input: 'portrait.jpg, 1600x1067', presets: [2, 8, 9], mode: 'cover', quality: 90 }, shown: ['660.9 KB', '1.80×', '210.1 KB', '1080×1920', '1584×396', '1280×720'] },
      { browser: { input: 'portrait.jpg', presets: [2, 8, 9], mode: 'contain', quality: 90 }, shown: ['484.5 KB'] },
      { browser: { input: 'portrait.jpg', presets: [2, 8, 9], mode: 'blur', quality: 90 }, shown: ['582.3 KB'] },
      { browser: { input: 'portrait.jpg', presets: [2, 8, 9], mode: 'cover', quality: 75 }, shown: ['289.3 KB'] }
    ]
  },

  '/image/svg-optimizer/': {
    term: 'SVG',
    whatIs: [
      'SVG (Scalable Vector Graphics) is an XML text format that describes a picture as shapes and paths instead of pixels, so it stays sharp at any size. Anything in the file that does not draw is dead weight.',
      'Design apps add plenty: comments, metadata blocks, namespaced editor attributes, layer IDs, six-decimal coordinates. Removing them changes nothing on screen unless something in the file refers to them.'
    ],
    howItWorks: {
      text: 'The site’s `imagecore` edits the markup as text, scanning tags with regular expressions; it never builds a tree or rewrites path commands.',
      points: [
        'It deletes comments, the XML declaration, DOCTYPE, `<metadata>`, a “Created with” `<desc>`, editor elements (self-closed or not) and attributes, empty `<defs>` and `<g>` that nothing points at, and `data-name`. Editor namespaces go once unused, so the XML stays well-formed.',
        'An `id` goes only when nothing in the file points at it: `url(#…)`, `href="#…"`, `aria-labelledby`, animation timing and `<style>` rules keep theirs. The `<title>` always stays.',
        'With rounding on, decimal numbers inside tags are rounded to the chosen precision, 2 by default.',
        'Open, drop or paste an SVG; Download saves a .svg file (image/svg+xml).'
      ]
    },
    worked: {
      text: 'A hand-written 404 B button, a rounded rectangle with fill="url(#fade)" and a white triangle, came out at 359 B with precision 2, saving 45 B (11.1%). The Ids kept row listed fade, the gradient’s id, so drawn in Chrome both versions gave the same colour at the centre. Precision 0 saved 69 B (17.1%) but moved the rectangle’s half-pixel edge from 0.5 to x="1" y="1" and its corner radius from 7.75 to rx="8".'
    },
    uses: [
      ['Icons in a web app', 'Shrink exported icons before inlining them in a component, where every byte ships with the page.'],
      ['A logo for a site header', 'Strip the clutter from a logo exported from Illustrator or Inkscape.'],
      ['Cleaner commits', 'Remove volatile editor IDs so committed SVGs change only when the drawing does.']
    ],
    mistakes: [
      'Expecting a page’s own script to find its ids. An id referenced only from outside the file goes; keep the original if code targets one.',
      'Rounding to 0 on detailed artwork. Small curves and thin strokes can shift; keep 2 unless the shapes are few and large.'
    ],
    faq: [
      { q: 'How much smaller can an SVG get?', a: 'It depends on the clutter: the page’s own example lost 58.1%, mostly editor metadata. Paths are rounded, never simplified, so dense artwork shrinks less.' },
      { q: 'Does optimising an SVG change how it looks?', a: 'Not through broken references, since referenced ids stay. Two decimals are usually invisible at icon sizes; at 0, points can move by up to half a unit.' },
      { q: 'Does it keep the title for screen readers?', a: 'Yes. The title element, and any id that aria-labelledby points at, stay in the file.' }
    ],
    runs: [
      /* the gradient button, default options (precision 2, rounding on) */
      { input: GRADIENT_SVG, check: [['stat:Original', '404 B'], ['stat:Optimised', '359 B'], ['stat:Saved', '45 B (11.1%)'], ['stat:Ids kept', 'fade'], ['output', 'fill="url(#fade)"']] },
      /* the same at precision 0 */
      { input: GRADIENT_SVG, options: { precision: '0' }, check: [['stat:Saved', '69 B (17.1%)'], ['output', 'x="1" y="1"'], ['output', 'rx="8"']] },
      /* the page's own Example panel input, for the FAQ's 58.1% (its <title>cup</title> now stays) */
      { input: CUP_SVG, check: [['stat:Saved', '58.1%']] },
      /* both versions of the button drawn in Chrome: each SVG as a data: URL on an Image, drawn to a 120×40 canvas, pixel
         (80, 20) read back: rgba(85, 60, 255, 255) from both. */
      { browser: { what: 'GRADIENT_SVG before and after the default optimisation, drawn in Chrome to a 120×40 canvas, pixel (80, 20)', before: 'rgba(85, 60, 255, 255)', after: 'rgba(85, 60, 255, 255)' },
        shown: ['same colour'] }
    ]
  }
};
