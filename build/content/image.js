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
      'Image compression makes a picture file smaller. Lossless compression, used by PNG, packs the pixels more tightly and gives every one back exactly. Lossy compression, used by JPEG and WebP, throws away detail the eye is unlikely to miss, and throws more away as the quality setting falls.',
      'JPEG opens everywhere but has no transparency. PNG keeps hard edges and transparency, ideal for screenshots and logos, but stores a photograph at many times the size. WebP does lossy and lossless coding with transparency and usually beats JPEG on size for the same look.'
    ],
    howItWorks: {
      text: 'The browser decodes your file, the picture is drawn onto a `<canvas>`, and the browser’s own encoder writes it out again with `canvas.toBlob(format, quality)`, the slider divided by 100.',
      points: [
        'A max width scales the picture down in proportion first; a narrower photo is never enlarged.',
        'For JPEG the canvas is painted white first, since JPEG cannot store transparency.',
        'Only pixels are drawn, so EXIF tags do not reach the smaller file.',
        'Sizes use binary units: a KB here is 1,024 bytes.'
      ]
    },
    worked: {
      text: 'A street photo enlarged to phone size, 4000 × 3000 pixels, was a 1.76 MB JPEG. JPEG at quality 80 gave 1.14 MB, only 35% smaller; at quality 40, 627.1 KB. WebP at 80 came to 635.0 KB, the size of the quality-40 JPEG at twice the setting. The real saving came from pixels: a max width of 1600 with WebP at 80 gave 204.1 KB, 89% off. Saved as PNG, the photo swelled to 13.10 MB.'
    },
    uses: [
      ['Portal size limits', 'Get a CV photo under an upload cap by lowering width and quality together.'],
      ['Faster web pages', 'Turn camera JPEGs into WebP at the width the page shows.'],
      ['Email attachments', 'Fit a dozen phone photos under a 25 MB attachment limit.']
    ],
    mistakes: [
      'Ignoring which kilobyte a form means. A file shown here as 195 KB is 199.7 KB to a form that counts 1,000 bytes to the KB; leave headroom.',
      'Setting quality to 100 for a perfect copy. JPEG is lossy at every setting, and a re-encode at 100 is often bigger than the original.'
    ],
    faq: [
      { q: 'Does compressing an image reduce its resolution?', a: 'Not unless you set a max width. With it at 0 the test photo came out at 4000×3000 at every quality.' },
      { q: 'Does compressing a photo remove its EXIF data?', a: 'Yes. A test JPEG carrying camera, date and GPS tags came out with none of them. Keep the original if you need them.' },
      { q: 'Why does the size differ from what my computer shows?', a: 'This tool divides by 1,024 and macOS by 1,000, so the 1,846,375-byte test photo is 1.76 MB here and 1.85 MB on a Mac.' }
    ],
    related: { guides: ['/guides/compress-an-image/'], conversions: ['/conversions/data/kibibyte-1024-to-kilobyte-1000/'] },
    runs: [
      /* input: build/promo/samples/street.jpg (1600×1200) drawn in Chrome onto a 4000×3000 canvas,
         imageSmoothingQuality 'high', saved with toBlob('image/jpeg', 0.92) → 1,846,375 bytes.
         Output format and Quality set, then uploaded; Max width 0 unless stated. Figures from the stat rows and card caption. */
      { browser: { input: 'street.jpg upscaled to 4000x3000, JPEG 0.92, 1846375 bytes', format: 'image/jpeg', quality: 80, maxWidth: 0 }, shown: ['1.76 MB', '1.14 MB', '35%', '4000×3000'] },
      { browser: { input: 'the same 4000x3000 file', format: 'image/jpeg', quality: 40, maxWidth: 0 }, shown: ['627.1 KB'] },
      { browser: { input: 'the same 4000x3000 file', format: 'image/webp', quality: 80, maxWidth: 0 }, shown: ['635.0 KB'] },
      { browser: { input: 'the same 4000x3000 file', format: 'image/webp', quality: 80, maxWidth: 1600 }, shown: ['204.1 KB', '89%'] },
      { browser: { input: 'the same 4000x3000 file', format: 'image/png', maxWidth: 0 }, shown: ['13.10 MB'] },
      /* the FAQ's EXIF answer: pukaki-tagged.jpg (see /image/exif-viewer/), JPEG at 80; the downloaded result
         parsed with the site's own MVRImage.metadataSegments / readExif: APP0 and ICC only, no EXIF */
      { browser: { input: 'pukaki-tagged.jpg (EXIF with GPS, XMP)', format: 'image/jpeg', quality: 80 }, shown: ['camera, date and GPS tags'] }
    ]
  },

  '/image/image-converter/': {
    term: 'image format conversion',
    whatIs: [
      'An image format is a way of packing pixels into a file. Converting decodes the picture and packs it again in another format: that changes the size, whether it can hold transparency and which programs open it, but cannot restore detail the source has lost.',
      'JPEG suits photos that must open anywhere, PNG anything where every pixel must survive, and WebP small files for the web. Any file the browser can display can go in, though an animated GIF comes out as one still frame.'
    ],
    howItWorks: {
      text: 'The file is decoded by the browser, drawn once onto a canvas at its own width and height, and written out with `canvas.toBlob` in the format you pick. The encoders are the browser’s own; no conversion library is loaded.',
      points: [
        'For JPEG the canvas is first filled with your background colour, so transparent areas take it instead of turning black.',
        'The quality slider, 92 by default, reaches the JPEG and WebP encoders as 0.92.',
        'Only pixels cross over. EXIF, GPS and XMP blocks stay behind, and a rotation recorded as a tag is applied to the pixels.'
      ]
    },
    worked: {
      text: 'A photo of a dog in long grass, stored as a PNG at 1600 × 1067, weighed 2.57 MB. As WebP at the default quality of 92 it came to 203.7 KB, 92% smaller; JPEG at the same setting gave 252.3 KB, and WebP at 80 just 101.6 KB. A photograph kept as PNG is a common reason a picture will not attach: the format is the problem, not the picture.'
    },
    uses: [
      ['WebP downloads', 'Turn an image saved from a website into JPEG for a print shop or an old editor.'],
      ['Logos on coloured pages', 'Keep a transparent logo see-through as WebP, where JPEG would fill it in.'],
      ['Screenshots for editing', 'Convert to PNG before annotating, so repeated saves stop blurring the text.']
    ],
    mistakes: [
      'Converting a transparent logo to JPEG on the default white when it will sit on a dark page. Set “Background for transparency” to the page colour.',
      'Feeding in a TIFF scan or a camera RAW file. Chrome cannot decode either, so the tool says “None of those files could be decoded.”; export a JPEG first.'
    ],
    faq: [
      { q: 'Does converting an image change its resolution?', a: 'No. The canvas takes the picture’s own size, so the test photo came out at 1600×1067 in every format.' },
      { q: 'Does converting keep the photo’s EXIF data?', a: 'No. A test JPEG with camera tags and a GPS position came out with none of them; only a JFIF header and the browser’s standard sRGB colour profile remained.' },
      { q: 'Is converting PNG to JPG lossless?', a: 'No. JPEG discards some detail at every quality setting, 100 included. Of the three outputs, only PNG keeps every pixel exactly.' }
    ],
    runs: [
      /* input: build/promo/samples/pet.jpg (1600×1067) drawn in Chrome onto a canvas of its own size and saved
         with toBlob('image/png') → pet-as-png.png. Convert to and Quality set, then uploaded. */
      { browser: { input: 'pet.jpg re-saved as PNG in Chrome, 1600x1067', format: 'image/webp', quality: 92 }, shown: ['2.57 MB', '203.7 KB', '92%', '1600×1067'] },
      { browser: { input: 'pet-as-png.png', format: 'image/jpeg', quality: 92, bg: '#ffffff' }, shown: ['252.3 KB'] },
      { browser: { input: 'pet-as-png.png', format: 'image/webp', quality: 80 }, shown: ['101.6 KB'] },
      /* the FAQ's EXIF answer: pukaki-tagged.jpg (see /image/exif-viewer/) to JPEG 92; the downloaded file's
         segments read with MVRImage.metadataSegments: APP0 (16 B), ICC colour profile (472 B); readExif found nothing */
      { browser: { input: 'pukaki-tagged.jpg', format: 'image/jpeg', quality: 92 }, shown: ['JFIF header', 'sRGB colour profile'] }
    ]
  },

  '/image/bulk-image-resizer/': {
    term: 'image resizing',
    whatIs: [
      'Resizing changes how many pixels a picture has. Shrinking merges neighbouring pixels into fewer, so the file gets lighter. Enlarging invents the in-between pixels by interpolation: the file grows and the detail stays as it was.',
      'File weight follows the pixel count, not the width: halve both sides and a quarter of the pixels remain. A batch applies one rule to every file, and a fixed width makes upright shots much taller than wide ones.'
    ],
    howItWorks: {
      text: 'Each photo is decoded, drawn onto a canvas of the new size with `drawImage`, and encoded with `canvas.toBlob`, WebP at quality 85 unless you change it.',
      points: [
        'Fixed width or height works out the other side from the photo’s ratio; longest edge scales the bigger side to the value; percentage scales both; exact size stretches to your width and height.',
        'Nothing is enlarged unless “Allow enlarging” is Yes: a photo the target would make bigger keeps its own size, and the page names it.',
        'Each result is named after its source plus the new size, such as street-800x600.webp, and a batch comes as one ZIP built in the page.'
      ]
    },
    worked: {
      text: 'Three photos went in at full size: a head-and-shoulders portrait and a plate of pancakes at 1600×1067 and a street scene at 1600×1200, 803.0 KB together. Longest edge 800 with WebP at 85 gave 800×534, 800×600 and 800×534, 220.5 KB in all; as JPEG at 85 they came to 275.2 KB. Set by mistake to a width of 2400, all three stayed at their own size, 624.6 KB, with a note saying so; with “Allow enlarging” on they became 2400×1601 and 2400×1800, 864.2 KB.'
    },
    uses: [
      ['Shop listings', 'Bring a folder of product shots to a marketplace’s width in one pass.'],
      ['Photos by email', 'Cut a holiday set to 1,280 px on the long side so it fits in one message.'],
      ['Thumbnails', 'Make 25% copies of a photo set for a preview grid.']
    ],
    mistakes: [
      'Choosing exact size for a mixed batch. Every file is stretched into one box, distorting upright and wide shots alike; use longest edge.',
      'Reading the Source figure as the whole batch. It gives the first file’s dimensions only; each card’s caption shows its own.'
    ],
    faq: [
      { q: 'Does resizing reduce image quality?', a: 'Shrinking drops detail that would not show at the smaller size; most visible loss comes from the encoder, so raise the quality if edges look soft.' },
      { q: 'What happens to the file names?', a: 'Each keeps its name with the new size added, so IMG_2041.jpg at 800 px wide might become IMG_2041-800x600.webp.' },
      { q: 'Does resizing remove EXIF data from photos?', a: 'Yes. Each file is redrawn from its pixels, so a tagged test photo resized to 800 px lost its camera and GPS tags too.' }
    ],
    runs: [
      /* inputs: build/promo/samples portrait.jpg (1600×1067, 264.5 KB), street.jpg (1600×1200, 321.4 KB),
         food.jpg (1600×1067, 217.2 KB): 803.0 KB together, the sizes as the image tools report them. Options set,
         then all three uploaded in that order; figures from each card's caption and the stat row. */
      { browser: { inputs: 'portrait.jpg 1600x1067, street.jpg 1600x1200, food.jpg 1600x1067; 803.0 KB together', mode: 'longest', value: 800, format: 'image/webp', quality: 85 }, shown: ['800×534', '800×600', '220.5 KB'] },
      { browser: { inputs: 'the same three', mode: 'longest', value: 800, format: 'image/jpeg', quality: 85 }, shown: ['275.2 KB'] },
      /* re-run 2026-10-04 after enlarging became opt-in: width 2400 with "Allow enlarging" No (the default) leaves
         1600×1067, 1600×1200 and 1600×1067 with the note "3 of 3 images were smaller than that and were left at their
         own size"; with Yes, the old result */
      { browser: { inputs: 'the same three', mode: 'width', value: 2400, enlarge: 'no', format: 'image/webp', quality: 85 }, shown: ['624.6 KB'] },
      { browser: { inputs: 'the same three', mode: 'width', value: 2400, enlarge: 'yes', format: 'image/webp', quality: 85 }, shown: ['2400×1601', '2400×1800', '864.2 KB'] },
      /* the FAQ's EXIF answer: pukaki-tagged.jpg (see /image/exif-viewer/), longest edge 800, JPEG 85 → 800×532;
         the result's segments read with MVRImage.metadataSegments: APP0, ICC only; readExif found nothing */
      { browser: { input: 'pukaki-tagged.jpg', mode: 'longest', value: 800, format: 'image/jpeg', quality: 85 }, shown: ['camera and GPS tags'] }
    ]
  },

  '/image/circle-crop/': {
    term: 'a circle crop',
    whatIs: [
      'Image files are always rectangles. A round avatar is a square picture with transparent corners, so whatever lies behind shows through. That needs an alpha channel, which PNG and WebP have and JPEG does not.',
      'The crop also decides what is kept. A square from the middle of a wide photo loses its sides, so an off-centre face needs cropping first.'
    ],
    howItWorks: {
      text: 'A square canvas of the output size, 512 px by default, is clipped to the shape, and the photo is drawn in with `drawImage`, scaled so its shorter side fills the square, and centred. Pixels outside the clip are never painted, and the file is always saved as PNG.',
      points: [
        'Circle clips to an arc whose diameter is the output size less twice the border.',
        'Rounded square takes the corner radius as a percentage of that inner width. Squircle is the same shape with the radius fixed at 22.5%, not a true superellipse.',
        'A border is stroked as a ring just outside the picture, so it never covers the photo.'
      ]
    },
    worked: {
      text: 'A 1600 × 1067 photo of a dog in long grass, a 220.3 KB JPEG, became a 1024×1024 circle: 21.31% of the pixels, the four corners, were fully transparent, and the PNG weighed 1.40 MB. The Squircle shape left only 4.28% transparent, being a rounded square, and came to 1.64 MB. At 256 px with a 6 px white border the circle was 121.5 KB, light enough for any profile upload.'
    },
    uses: [
      ['Team pages', 'Give every headshot the same size and shape so a staff grid lines up.'],
      ['Slides and signatures', 'Place a round photo on a coloured slide without a white box round it.'],
      ['Launcher icons', 'Make a rounded-square icon from a logo for a home-screen shortcut.']
    ],
    mistakes: [
      'Exporting at 1024 px for a site that shows 100 px. A photographic PNG is heavy; pick the smallest size the service accepts.',
      'Starting from a wide group photo. The centred crop keeps the middle square only; crop round the face with the image cropper first.'
    ],
    faq: [
      { q: 'Can I move the circle to a face that is off-centre?', a: 'Not here: the crop is always centred. Cut a square round the face with the image cropper, then make it round.' },
      { q: 'Why is my round PNG bigger than the original photo?', a: 'PNG keeps every pixel without loss, while the photo came as a lossy JPEG. A 1024 px circle from a 220.3 KB JPEG weighed 1.40 MB; a smaller output size fixes it.' },
      { q: 'What is the difference between a squircle and a rounded square?', a: 'A true squircle is a superellipse whose curve begins gradually; a rounded square joins straight sides to quarter-circles. The Squircle option here is the latter.' }
    ],
    runs: [
      /* input: build/promo/samples/pet.jpg at full size (1600×1067, 220.3 KB). Options set, then uploaded.
         The transparent share was measured on the downloaded PNG: decoded, getImageData, pixels with alpha 0 ÷ all. */
      { browser: { input: 'pet.jpg, 1600x1067', shape: 'circle', size: 1024, border: 0 }, shown: ['220.3 KB', '1024×1024', '1.40 MB', '21.31%'] },
      { browser: { input: 'pet.jpg', shape: 'squircle', size: 1024, border: 0 }, shown: ['4.28%', '1.64 MB'] },
      { browser: { input: 'pet.jpg', shape: 'circle', size: 256, border: 6, borderColor: '#ffffff' }, shown: ['121.5 KB'] }
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
      'Redaction means destroying the information in part of a picture, not just covering it. The usual methods destroy different amounts: a solid block replaces every pixel, pixelation keeps one averaged colour per square, and a blur keeps a weighted mix of nearby pixels, so large shapes still show through.',
      'Typical targets are faces, number plates and house numbers in photos, and names and account numbers in screenshots.'
    ],
    howItWorks: {
      text: 'The photo is drawn at full size onto a canvas, the area you dragged is changed there, and the whole picture is encoded again, with no layers: PNG by default, or JPEG or WebP.',
      points: [
        'Pixelate shrinks the area to about one pixel per block, the strength being the block size in pixels, then draws it back with smoothing off, so each block is one flat colour.',
        'Blur clips to the area and redraws the photo through the canvas filter `blur()`, so colour from just outside bleeds in while the box edges stay sharp.',
        'Block fills the area with your colour, black by default.',
        'Before you drag, the selection is the middle 70% of the picture.'
      ]
    },
    worked: {
      text: 'In a 1600 × 1200 street photo, a 321.4 KB JPEG, a drag over the people on a zebra crossing selected 352×179 pixels. Pixelated at the default strength of 16, each figure became a column of flat squares: a red top and a blue jacket still showed as colour, but no faces. Saved as PNG the result weighed 2.79 MB; JPEG at quality 85 gave 355.3 KB, squares intact.'
    },
    uses: [
      ['Bug reports', 'Block a customer’s name and email in a screenshot before it goes into a ticket.'],
      ['Car and property listings', 'Pixelate a number plate or a house number.'],
      ['Proof of address', 'Black out the account number on a photographed bill.']
    ],
    mistakes: [
      'Drawing the box tight to the text. Descenders and the tops of capitals often sit a pixel or two beyond the visible edge; leave a margin.',
      'Hiding one copy and missing the rest: the same number on a second line, in a reflection, or in a tab title.'
    ],
    faq: [
      { q: 'Can a blurred image be unblurred?', a: 'Partly. A blur is a known mathematical operation, so deblurring software can sometimes bring back shapes and even text at low strengths. A solid block leaves nothing to work from.' },
      { q: 'Does the saved image keep the original under the blur?', a: 'No. Only the changed pixels are in the new file, and none of the source photo’s metadata is copied.' },
      { q: 'Why is the redacted image bigger than the original?', a: 'PNG, the default, is lossless: the 321.4 KB street photo above became 2.79 MB. Undragged (the middle 70%) it gave 1.47 MB pixelated, 2.23 MB blurred, 1.46 MB blocked. JPEG or WebP is far smaller.' }
    ],
    runs: [
      /* input: build/promo/samples/street.jpg at full size (1600×1200, 321.4 KB). Method and Strength set,
         uploaded, then a mouse drag on the selection canvas from 38%,48% to 60%,63% of its width and height. */
      /* re-measured 2026-10-04 in headless Chrome 154.0.8037.94 (the earlier 3.02 MB / 357.1 KB no longer reproduced):
         the drag gave "352 × 179 px at 606, 576", PNG 2.79 MB */
      { browser: { input: 'street.jpg, 1600x1200, 321.4 KB', method: 'pixelate', strength: 16, drag: { x0: 0.38, y0: 0.48, x1: 0.6, y1: 0.63 } }, shown: ['352×179', '2.79 MB'] },
      /* the same drag, #ic-format JPEG, #ic-quality 85 */
      { browser: { input: 'street.jpg', method: 'pixelate', strength: 16, drag: { x0: 0.38, y0: 0.48, x1: 0.6, y1: 0.63 }, format: 'image/jpeg', quality: 85 }, shown: ['355.3 KB'] },
      /* no drag: the starting selection, 1120×840 at 240, 180; PNG, strength 16, block colour black, each method */
      { browser: { input: 'street.jpg', method: 'pixelate' }, shown: ['1.47 MB'] },
      { browser: { input: 'street.jpg', method: 'blur' }, shown: ['2.23 MB'] },
      { browser: { input: 'street.jpg', method: 'block' }, shown: ['1.46 MB'] }
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
    term: 'EXIF data',
    whatIs: [
      'EXIF (Exchangeable Image File Format) is a set of tags that cameras and phones write into a JPEG: make and model, date and time, exposure settings, often a serial number and, from a phone with location on, GPS latitude, longitude and altitude.',
      'It lives in the APP1 segment near the start of the file. Beside it there may be XMP, an XML packet for captions and authors, IPTC fields and an ICC colour profile.'
    ],
    howItWorks: {
      text: 'The file is read as raw bytes with `FileReader`, and the site’s own parser walks the JPEG’s segments up to the image data, looking for the APP1 block that begins “Exif”.',
      points: [
        'It reads the main tag directory and the Exif and GPS directories, showing a fixed list of common tags, from Make to LensModel; others are skipped.',
        'GPS degrees, minutes and seconds become signed decimal degrees, south and west negative, with a link to OpenStreetMap.',
        'Every metadata segment is listed with its size, including XMP, IPTC and ICC blocks whose contents are not decoded.',
        'Only JPEG is parsed; a PNG or WebP gets “Not a JPEG”, even if it carries EXIF.'
      ]
    },
    worked: {
      text: 'A Lake Pukaki photo was given hand-made EXIF and XMP blocks. The viewer listed EXIF (540 B), XMP (372 B), APP0 (16 B), ICC colour profile (472 B), and turned 44° 6′ 30.6″ S, 170° 9′ 15″ E into -44.108500 and 170.154167. An exposure of 1/640 s showed as 0.0015625. The time-zone tag and the XMP author did not appear. With the orientation tag set to rotate 90°, Dimensions read 1063×1600.'
    },
    uses: [
      ['Before posting a listing', 'See whether a photo of your home carries a GPS position.'],
      ['When was it taken', 'Read DateTimeOriginal to settle when a picture was shot.'],
      ['Learning from a good shot', 'See the shutter speed, aperture, ISO and focal length behind it.']
    ],
    mistakes: [
      'Trusting the date blindly. DateTime is when software last saved the file, DateTimeOriginal when the shutter fired, and both rely on the camera’s clock.',
      'Taking “no EXIF” to mean the photo is clean. XMP and IPTC blocks can still hold names and places; the segment list shows whether they are there.'
    ],
    faq: [
      { q: 'How accurate is the GPS position in a photo?', a: 'A phone fix is usually good to a few metres outdoors. The six decimal places shown here are about 11 cm, far finer than the fix.' },
      { q: 'Can EXIF data be faked?', a: 'Yes. It is ordinary data that any metadata editor can rewrite, as the test file above was. Treat it as a claim, not proof.' },
      { q: 'What does the Orientation tag do?', a: 'It tells software to turn the picture on display instead of rotating the stored pixels; browsers obey it.' }
    ],
    runs: [
      /* input: pukaki-tagged.jpg, made by .work/makeexif.js from build/promo/samples/landscape.jpg (1600×1063):
         an EXIF APP1 (big-endian TIFF) and an XMP APP1 inserted after SOI. Tags: Make DemoCam, Model DC-200,
         Orientation 1, Software, DateTime, Artist, ExposureTime 1/640, FNumber 2.8, ISO 100, DateTimeOriginal,
         OffsetTimeOriginal +13:00, FocalLength 6.7, BodySerialNumber, LensModel; GPS 44/1 6/1 3060/100 S,
         170/1 9/1 1500/100 E, altitude 532 m. XMP dc:creator. Uploaded with no controls to set. */
      { browser: { input: 'pukaki-tagged.jpg', exposureTime: '1/640', gps: '44 6 30.6 S, 170 9 15 E', orientation: 1 }, shown: ['EXIF (540 B), XMP (372 B), APP0 (16 B), ICC colour profile (472 B)', '-44.108500', '170.154167', '0.0015625'] },
      /* the same file made with Orientation 6 (rotate 90° clockwise): node makeexif.js 6 pukaki-tagged-rot6.jpg */
      { browser: { input: 'pukaki-tagged-rot6.jpg, stored 1600x1063', orientation: '6 = rotate 90 clockwise' }, shown: ['1063×1600'] }
    ]
  },

  '/image/exif-remover/': {
    whatTitle: 'What stripping photo metadata removes',
    whatIs: [
      'Photo metadata is everything in the file besides the picture: EXIF tags such as time, device, serial number and GPS position, XMP and IPTC blocks from editing software, comments and a colour profile.',
      'There are two ways to remove it. Byte surgery cuts the metadata segments out and leaves the image data untouched, but has to know every place metadata can hide. Re-encoding writes a new file from the pixels: a second compression, but nothing carried over.'
    ],
    howItWorks: {
      text: 'This tool re-encodes. Each photo is drawn onto a fresh canvas of its own size and saved with `canvas.toBlob`, as JPEG at quality 92 unless you choose otherwise.',
      points: [
        'First the site’s own JPEG parser lists the original’s segments and any GPS position being removed.',
        'The browser applies the Orientation tag as it draws, so a photo stored sideways by a phone is saved upright.',
        'Then it reads the cleaned file’s bytes back: Chrome adds a 16-byte JFIF header and an sRGB colour profile to a JPEG, neither about you; its PNG holds only the image.',
        'The original’s list reads JPEG only; a PNG’s text chunks go unlisted but are dropped too.'
      ]
    },
    worked: {
      text: 'The tagged test photo from the EXIF viewer page, 1600 × 1063 with camera, author and GPS tags, went in at 216.4 KB. The tool listed EXIF, XMP, APP0 and ICC colour profile and showed the position going, -44.10850, 170.15417. For the result it read “No EXIF, GPS or camera data; standard JFIF header and sRGB colour profile kept”, at 254.6 KB, 18% bigger. A copy tagged to rotate 90° came out at 1063×1600, upright. As PNG it grew to 2.45 MB.'
    },
    uses: [
      ['Selling and letting sites', 'Clean photos taken at home before they go on a listing.'],
      ['Files sent to strangers', 'Strip a picture before it goes by email or a shared link, where nothing removes the tags.'],
      ['Protecting a source', 'Remove the device serial number and time before publishing a photo.']
    ],
    mistakes: [
      'Stripping first and editing afterwards. Some editors write their own name, date and XMP on save, so strip last.',
      'Sharing the original by mistake. Check the downloaded copy in the EXIF viewer before sending it.'
    ],
    faq: [
      { q: 'Does removing EXIF reduce photo quality?', a: 'Slightly, here: the picture is compressed again, at quality 92 by default. Tools that only cut out the metadata segments avoid that.' },
      { q: 'Will the stripped photo still be the right way up?', a: 'Yes. The rotation is applied to the pixels before saving, so the clean file needs no tag.' },
      { q: 'How can I check that the metadata is gone?', a: 'The page reads the cleaned file back and says what is left; the EXIF viewer showed the test JPEG with only APP0 (16 B) and ICC colour profile (472 B).' }
    ],
    runs: [
      /* input: pukaki-tagged.jpg (made by .work/makeexif.js, see /image/exif-viewer/), 1600×1063, 216.4 KB.
         Save as JPEG, quality 92, then uploaded; figures from the stat rows. Re-run 2026-10-04: the "Metadata in result"
         row is now read from the result's bytes (APP0 JFIF + APP2 ICC, the profile's description sRGB); as PNG it reads
         "No EXIF, GPS or camera data; no other metadata either". */
      { browser: { input: 'pukaki-tagged.jpg, 1600x1063', format: 'image/jpeg', quality: 92 }, shown: ['216.4 KB', '-44.10850, 170.15417', '254.6 KB', '18%', 'No EXIF, GPS or camera data; standard JFIF header and sRGB colour profile kept'] },
      /* the Orientation 6 copy (pukaki-tagged-rot6.jpg), JPEG 92: the result card read 1063×1600 */
      { browser: { input: 'pukaki-tagged-rot6.jpg, orientation 6 = rotate 90 clockwise', format: 'image/jpeg', quality: 92 }, shown: ['1063×1600'] },
      { browser: { input: 'pukaki-tagged.jpg', format: 'image/png' }, shown: ['2.45 MB'] },
      /* the downloaded clean JPEG from the first run, opened in /image/exif-viewer/ */
      { browser: { tool: '/image/exif-viewer/', input: 'the clean JPEG from the first run' }, shown: ['APP0 (16 B) and ICC colour profile (472 B)'] }
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
      text: 'The preview canvas is at most 720 pixels wide, but your drag is converted back into the original’s pixel coordinates, so the crop comes from the full-resolution file.',
      points: [
        'With a ratio locked, the drag is first held inside the picture’s edges, then trimmed on its longer side to match and rounded to whole pixels, so the shape holds even when you drag past an edge.',
        'On release, `drawImage` copies exactly that rectangle onto a new canvas, pixel for pixel.',
        '`canvas.toBlob` encodes it as PNG (the default), JPEG or WebP. Quality applies to the last two, and a JPEG gets a white backing so transparency does not turn black.',
        'Because the file is newly encoded, the camera’s EXIF tags, GPS included, are not carried over.'
      ]
    },
    worked: {
      text: 'A 1600×1200 street photo, a 321.4 KB JPEG, cropped with 16:9 locked by dragging across the middle gave a 1280×720 selection, a true 16:9. Downloaded as PNG, the default, the crop weighed 1.51 MB, almost five times the whole original. The same selection saved as JPEG at quality 85 was 217.2 KB. For photographs, change the format before downloading.'
    },
    uses: [
      ['Profile pictures', 'Lock 1:1 and centre the face for a round avatar.'],
      ['Slides and thumbnails', 'Lock 16:9 so a photo fills a presentation slide or a video frame without bars.'],
      ['Trimming screenshots', 'Cut one dialogue box or chart out of a full-screen capture for a bug ticket.']
    ],
    mistakes: [
      'Leaving PNG selected for a photograph. Lossless PNG makes a cropped photo heavier than its JPEG source; pick JPEG or WebP.',
      'Picking a ratio and downloading at once. The lock shapes the box only while you drag, and the starting box follows the picture’s own shape, so drag once first.'
    ],
    faq: [
      { q: 'Does cropping a photo reduce its quality?', a: 'The pixels inside the box are copied unchanged. Quality drops only if you save as JPEG or WebP, which compress them again.' },
      { q: 'Does cropping remove location data from a photo?', a: 'Yes, as a side effect. The browser’s canvas writes a new file and does not copy the original’s EXIF tags, GPS coordinates included, into it.' },
      { q: 'Can I crop several images at once?', a: 'No. Each crop needs its own box drawn on its own picture, so the cropper takes one image at a time.' }
    ],
    related: { guides: ['/guides/convert-jpg-to-pdf/'] },
    runs: [
      /* street.jpg from build/promo/samples at full size (1600×1200, 329,068 bytes = 321.4 KB). Set #ic-ratio to 16:9 and
         #ic-format to PNG, upload, then drag on the preview canvas (722×542 on screen, viewport 1280×1000) with the mouse from
         10%,20% to 90%,80% of its box. Read the Selection and Output size rows. */
      { browser: { tool: '/image/image-cropper/', file: 'build/promo/samples/street.jpg, full size 1600×1200, 321.4 KB', ratio: '16:9', format: 'image/png', drag: 'from 0.1,0.2 to 0.9,0.8 of the preview canvas' },
        shown: ['1280×720', '1.51 MB'] },
      /* re-measured 2026-10-04 in headless Chrome 154.0.8037.94 after the ratio fix in engine/render-image.js (the pointer
         is held inside the picture before the ratio trims the box): the old engine's 1279×720 / 1.63 MB no longer apply */
      /* the same, with #ic-format JPEG and #ic-quality 85 */
      { browser: { tool: '/image/image-cropper/', file: 'build/promo/samples/street.jpg, full size', ratio: '16:9', format: 'image/jpeg', quality: 85, drag: 'from 0.1,0.2 to 0.9,0.8 of the preview canvas' },
        shown: ['217.2 KB'] }
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
      'PDF can hold JPEG data as it is, through its DCTDecode filter, so photo PDFs stay close to the size of their pictures. Text in the photos stays a picture.'
    ],
    howItWorks: {
      text: 'The site’s own small PDF writer in `imagecore` builds the file; no PDF library is loaded. A JPEG goes in as it is.',
      points: [
        'A JPEG’s own compressed bytes become the page image (`DCTDecode`), with its colour profile; only EXIF, GPS, XMP and comment blocks are left out.',
        'Other images, sideways or CMYK JPEGs, and any JPEG under Re-encode are drawn on white and saved with `canvas.toBlob` at the slider’s quality, 88 by default.',
        'Each image is fitted inside the margin (28 points by default) and centred; “Match each image” turns pages landscape for wide images, and “Fit to image” makes the page one point per pixel.',
        'The result is a plain PDF with no title, bookmarks or text layer.'
      ]
    },
    worked: {
      text: 'Two landscape photos, 1600×1067 (264.5 KB) and 1600×1063 (215.5 KB), went onto Letter with “Match each image”, and both pages turned to 792 × 612 points. Kept as they were, the PDF was 482.2 KB. Re-encoded at 88 it came to 495.6 KB, at 100 to 1.82 MB and at 60 to 218.7 KB. “Fit to image” made the first page 1600 × 1067 points.'
    },
    uses: [
      ['Applications that want one file', 'Put photos of a passport page and a utility bill into the single PDF a form accepts.'],
      ['Handing in written work', 'A student photographs handwritten pages and submits one PDF in page order.'],
      ['Screenshot evidence', 'Use “Fit to image” so each screenshot keeps its own shape in a complaint bundle.']
    ],
    mistakes: [
      'Re-encoding at 100 to “keep” quality. Keeping the JPEGs as they are already loses nothing, and quality 100 made a PDF nearly four times the size of 88 here.',
      'Typing the margin in millimetres. The box is in points: 28 is just under 10 mm, and 10 gives about 3.5 mm.'
    ],
    faq: [
      { q: 'Does converting JPG to PDF reduce image quality?', a: 'Not by default: each JPEG’s own data goes in unchanged. PNGs, sideways phone shots and a chosen Re-encode are compressed again.' },
      { q: 'How do I make the PDF smaller?', a: 'Choose Re-encode and lower the slider; at 60 the two photos above made 218.7 KB instead of 482.2 KB. Check small print stays readable.' },
      { q: 'What page size does “Fit to image” give?', a: 'One point per pixel, so a 1600-pixel-wide photo makes a page over 22 inches wide: fine on screen, too big for paper.' }
    ],
    related: { guides: ['/guides/convert-jpg-to-pdf/'] },
    runs: [
      /* Re-run 2026-10-04, after JPEGs began to go in as they are. portrait.jpg then landscape.jpg from build/promo/samples,
         both full size (1600×1067, 270,812 B = 264.5 KB; 1600×1063, 220,631 B = 215.5 KB; the file list shows both).
         #ic-pageSize Letter, #ic-orientation Match each image, margin 28, #ic-jpeg "Keep as they are". Read the PDF size
         row; press Download PDF (493,746 B) and read /MediaBox from the bytes; both files' bytes are inside it unchanged. */
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
      'The usual face is Impact, a heavy condensed sans-serif from the 1960s that came installed on most Windows and Mac computers.'
    ],
    howItWorks: {
      text: 'The captions are painted onto a full-size copy of your picture on a canvas, so they become part of the pixels.',
      points: [
        'Font size is a percentage of the picture’s height, in bold Impact, falling back to Haettenschweiler, Arial Narrow Bold or any sans-serif.',
        'The text is capitalised if “Force uppercase” is on, then broken at spaces into lines no wider than 94% of the picture.',
        'Each line is stroked in the outline colour at 12% of the font size, then filled in the text colour on top.',
        'The meme keeps the picture’s size: PNG by default, or JPEG or WebP at your quality.'
      ]
    },
    worked: {
      text: 'On a 1600×1067 group photo, “when the meeting could have been an email” was typed in lower case and came out in capitals. At the default 10% size the top caption wrapped onto two lines; at 6% it fitted on one. Both versions were PNGs of 1600×1067: 2.49 MB at 10% and 2.64 MB at 6%, from a 308.3 KB original. Smaller text hides less photographic detail, and detail is what makes a PNG heavy. Saved as JPEG at 92, the 10% meme was 378.0 KB.'
    },
    uses: [
      ['Team updates', 'Open a sprint review or an internal newsletter with a captioned office photo.'],
      ['Small-brand social posts', 'Caption your own product photo in the familiar format, with no app logo stamped on it.'],
      ['Reaction images', 'Turn a screenshot into a reusable reply for a forum or group chat.']
    ],
    mistakes: [
      'Writing a full sentence in each caption. Long text wraps, and three or four lines at 10% bury much of the picture; cut the words or lower the size.',
      'Sending the PNG where uploads are capped. A meme made from a phone photo is often several megabytes; pick JPEG under Save as before posting.'
    ],
    faq: [
      { q: 'What font do memes use?', a: 'Impact, in white capitals with a black outline. This tool asks for Impact and falls back to similar faces where it is missing, as it is on many phones.' },
      { q: 'Can I change the colour of the meme text?', a: 'Yes, both the text and the outline colour. Keep strong contrast between them, such as yellow on black.' },
      { q: 'Can I make a meme with only a top caption?', a: 'Yes. Leave the bottom box empty and nothing is drawn there; the same works the other way round.' }
    ],
    related: { guides: ['/guides/compress-an-image/'] },
    runs: [
      /* group.jpg from build/promo/samples at full size (1600×1067, 308.3 KB). #ic-top "when the meeting could have been an
         email", #ic-bottom "and it was", #ic-size 10, colours and Force uppercase at their defaults. Read the result card and
         the Original total / Result total rows; look at the PNG to count the caption's lines. */
      { browser: { tool: '/image/meme-generator/', file: 'build/promo/samples/group.jpg, full size 1600×1067', top: 'when the meeting could have been an email', bottom: 'and it was', size: 10, caps: 'yes' },
        shown: ['1600×1067', '308.3 KB', '2.49 MB', 'two lines'] },
      /* the same with #ic-size 6: the top caption fits on one line */
      { browser: { tool: '/image/meme-generator/', file: 'build/promo/samples/group.jpg, full size', top: 'when the meeting could have been an email', bottom: 'and it was', size: 6 },
        shown: ['2.64 MB'] },
      /* added 2026-10-04 with the Save as control: size 10 again, #ic-format JPEG, #ic-quality 92 */
      { browser: { tool: '/image/meme-generator/', file: 'build/promo/samples/group.jpg, full size', top: 'when the meeting could have been an email', bottom: 'and it was', size: 10, format: 'image/jpeg', quality: 92 },
        shown: ['378.0 KB'] }
    ]
  },

  '/image/passport-photo/': {
    whatTitle: 'What a passport photo specification sets',
    whatIs: [
      'A passport or visa photo must match a printed size, such as 35×45 mm for a UK passport or a Schengen visa, or 2×2 inches for a US passport. The full rules also cover head size, background, lighting and expression, and differ by country.',
      'To print, millimetres become pixels at a set resolution: at 300 dots per inch, 35 mm is 413 pixels.'
    ],
    howItWorks: {
      text: 'The tool knows six fixed sizes at 300 DPI: India passport / visa 51×51 mm, UK passport 35×45 mm, US passport 51×51 mm, Schengen visa 35×45 mm, India PAN card 25×35 mm and stamp size 20×25 mm. No face is detected or measured.',
      points: [
        'Pixels are `round(mm ÷ 25.4 × 300)`: 51 mm is 602.36, so 602 px, which prints at 50.97 mm. Your photo is scaled to cover the frame and cut from the centre.',
        'Replace cuts the person out on your device with MODNet, a 25 MB portrait model served from this site, and lays them on your colour.',
        'The print sheet is 1800×1200 pixels, 6×4 inches, with as many copies as fit at a 12-pixel gap.',
        'Files are JPEG at quality 95, or PNG, and say 300 DPI inside: in the JFIF header or a pHYs chunk.'
      ]
    },
    worked: {
      text: 'From a 1600×1067 portrait, the UK preset gave a 413×531 single photo of 70.8 KB as JPEG, 439.8 KB as PNG, and a 1800×1200 sheet with 8 copies. The India preset’s 602×602 square fitted only 2 copies, one row, on the same sheet; PAN card size fitted 10 copies and stamp size 21. Replace with white turned the dark hedge white: 47.0% of the photo.'
    },
    uses: [
      ['Kiosk or lab prints', 'Take the 6×4 sheet to a print service and cut the copies out along the grey lines.'],
      ['Pasted-photo forms', 'Use the PAN card or stamp size for admission forms and membership cards.'],
      ['Portal uploads', 'Upload the single JPEG; most forms ask for that format.']
    ],
    mistakes: [
      'Shooting too close or off-centre. The crop always comes from the middle of the shot, so stand back from a plain wall with your face centred.',
      'Printing the sheet with “fit to page”. Any scaling changes the millimetre size of every copy; print at 100% on 6×4 inch paper.'
    ],
    faq: [
      { q: 'What size is a UK passport photo in pixels?', a: 'At 300 DPI, 35×45 mm is 413×531 pixels. The UK online application has its own rules for digital photos; read them before uploading.' },
      { q: 'How many passport photos fit on a 6×4 print?', a: 'Here, 8 at 35×45 mm and 21 at stamp size, but only 2 at 51×51 mm.' },
      { q: 'Is a 2×2 inch photo the same as 51×51 mm?', a: 'Nearly. Two inches is 50.8 mm; 51 mm comes out as 602 pixels, so each side prints about 0.2 mm longer.' }
    ],
    related: { conversions: ['/conversions/length/millimeter-to-inch/'] },
    runs: [
      /* Re-run 2026-10-04 (JPEG became the default, both files now carry 300 DPI). portrait.jpg from build/promo/samples at
         full size (1600×1067). #ic-preset "UK passport — 35×45 mm", #ic-bgmode keep, #ic-sheet "Single photo + print sheet",
         #ic-format JPEG (quality 95), then PNG. Read both result cards' captions. The JPEGs' JFIF density reads 300×300 dpi,
         the PNGs' pHYs 11,811 px/m. */
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size 1600×1067', preset: '1 (UK passport 35×45 mm)', sheet: 'both', format: 'image/jpeg', quality: 95 },
        shown: ['413×531', '70.8 KB', '1800×1200', '8 copies'] },
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: '1', sheet: 'both', format: 'image/png' },
        shown: ['439.8 KB'] },
      /* the same photo, #ic-preset "India passport / visa — 51×51 mm", sheet both; the Print size and Rounding rows read
         "602×602 px at 300 DPI = 50.97 × 50.97 mm" and "51×51 mm is 602.36 × 602.36 px" */
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: '0 (India passport / visa 51×51 mm)', sheet: 'both' },
        shown: ['602×602', '2 copies', '602.36', '50.97 mm'] },
      /* UK preset, single photo, #ic-bgmode replace, #ic-bg #ffffff: MODNet on WASM; the JPEG decoded in Chrome had
         pixels with r, g and b all above 245 at 47.0% of 413×531, the top-left corner rgb(255, 255, 255) */
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: '1', sheet: 'single', bgmode: 'replace', bg: '#ffffff' },
        shown: ['47.0%'] },
      /* the same photo, #ic-preset India PAN card, then Stamp size, #ic-sheet "4×6 print sheet only" */
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: '4 (India PAN card 25×35 mm)', sheet: 'sheet' },
        shown: ['10 copies'] },
      { browser: { tool: '/image/passport-photo/', file: 'build/promo/samples/portrait.jpg, full size', preset: '5 (Stamp size 20×25 mm)', sheet: 'sheet' },
        shown: ['stamp size 21'] }
    ]
  },

  '/image/photo-filters/': {
    whatTitle: 'What a photo filter does to the pixels',
    whatIs: [
      'A filter is a fixed calculation run on every pixel. Brightness multiplies each colour value; contrast pushes values away from mid-grey; saturation moves colours towards or away from grey; a hue rotation turns every colour round the colour wheel; blur averages each pixel with its neighbours.',
      'Presets are recipes of those steps. Black & white removes saturation while keeping each pixel’s brightness, sepia tints the result brown, and invert subtracts every value from the maximum.'
    ],
    howItWorks: {
      text: 'The browser’s own CSS filter engine does the work: the tool builds a string such as `sepia(0.4) contrast(1.1) saturate(0.8)`, sets it as `ctx.filter` and draws your photo through it.',
      points: [
        'The preset comes first and any slider moved from its default is appended after it, so sliders adjust the filtered picture.',
        'Black & white is `grayscale(1)`, sepia `sepia(0.85)`; Cool and Warm add a `hue-rotate` of −12° and +12°.',
        'Blur is Gaussian, measured in the photo’s own pixels, so 3 px is subtle on a large photo.',
        'The result keeps the original size, as PNG unless Save as says JPEG or WebP.'
      ]
    },
    worked: {
      text: 'A 1600×1200 street photo, a 321.4 KB JPEG, saved with no changes at all came back as a 3.15 MB PNG: that jump is the format, not the filter. With Black & white it was 2.17 MB, since grey pixels repeat one value across red, green and blue and compress better. Adding a 3 px blur brought it down to 1.11 MB, because smoothed detail compresses better still. The same Black & white picture saved as JPEG at 92 was 398.4 KB.'
    },
    uses: [
      ['A consistent set', 'Give a batch of product or event photos the same preset so they read as one series.'],
      ['Backgrounds behind text', 'Blur and darken a photo used behind a slide title so the words stand out.'],
      ['Viewing old negatives', 'Photograph a black-and-white negative on a light box and invert it to see the positive.']
    ],
    mistakes: [
      'Stacking a preset and the same slider. Dramatic already sets contrast to 1.35; contrast at 130% on top multiplies to about 1.75 and crushes the shadows.',
      'Blurring text or faces to hide them. A light blur can sometimes still be read; for redaction, cover the area with a solid block.'
    ],
    faq: [
      { q: 'How do I make a photo black and white?', a: 'Choose the Black & white preset, then raise contrast a little if the result looks flat.' },
      { q: 'Do these filters work in every browser?', a: 'They rely on the canvas filter property. A browser without it ignores the setting and saves the photo unchanged.' },
      { q: 'What is the difference between brightness and contrast?', a: 'Brightness scales every value up or down, lifting shadows and highlights together. Contrast stretches values away from mid-grey, so darks get darker and lights lighter.' }
    ],
    related: { guides: ['/guides/compress-an-image/'] },
    runs: [
      /* street.jpg from build/promo/samples at full size (1600×1200, 321.4 KB). #ic-preset None, every slider at its default.
         Read the Original total and Result total rows. */
      { browser: { tool: '/image/photo-filters/', file: 'build/promo/samples/street.jpg, full size 1600×1200', preset: 'none' },
        shown: ['321.4 KB', '3.15 MB'] },
      /* the same photo, #ic-preset Black & white */
      { browser: { tool: '/image/photo-filters/', file: 'build/promo/samples/street.jpg, full size', preset: 'grayscale' },
        shown: ['2.17 MB'] },
      /* the same photo, #ic-preset Black & white and #ic-blur 3 */
      { browser: { tool: '/image/photo-filters/', file: 'build/promo/samples/street.jpg, full size', preset: 'grayscale', blur: 3 },
        shown: ['1.11 MB'] },
      /* added 2026-10-04 with the Save as control: Black & white, blur 0, #ic-format JPEG, #ic-quality 92 */
      { browser: { tool: '/image/photo-filters/', file: 'build/promo/samples/street.jpg, full size', preset: 'grayscale', format: 'image/jpeg', quality: 92 },
        shown: ['398.4 KB'] }
    ]
  },

  '/image/social-media-resizer/': {
    whatTitle: 'What a social media image size really is',
    whatIs: [
      'Each platform shows pictures in fixed slots, from a tall 9:16 story to a long thin profile banner. The published sizes mostly describe a shape; upload another shape and the platform crops or pads the picture for you.',
      'Fill and crop enlarges a picture until the frame is full and cuts off the overflow. Fit whole image shrinks it until all of it shows and fills the gaps with bars.'
    ],
    howItWorks: {
      text: '16 presets cover Instagram, Facebook, X, LinkedIn, YouTube, Pinterest, TikTok, WhatsApp and the web, from a 600×200 email header to 2560×1440 channel art. Each one you tick gets a canvas of exactly its size.',
      points: [
        'Fill and crop takes the larger of the two scale factors, frame side ÷ photo side, and centres the photo.',
        'Fit whole image takes the smaller factor and paints the rest in the bar colour, near-black navy (`#0a0e1a`) by default.',
        'Photos are enlarged as readily as reduced, even past their own size.',
        'Files are JPEG, PNG or WebP at a fixed quality of 90, named after their slot.'
      ]
    },
    worked: {
      text: 'A 1600×1067 portrait photo went to three slots. Fit whole image kept every pixel, but the 1080×1920 story is mostly bars around a band of photo; the three files came to 429.7 KB. Fill and crop filled every frame, 580.9 KB in all, yet the 1584×396 LinkedIn cover kept only a strip just over a third of the photo’s height, and the story an upright slice enlarged to almost double. The 1280×720 thumbnail, closest in shape, lost about a sixth of the height.'
    },
    uses: [
      ['Promoting an event', 'Turn one poster photo into a story, a feed post and a cover banner for the same week.'],
      ['Starting a YouTube channel', 'Make the 1280×720 thumbnail and the 2560×1440 channel art from one shot of the presenter.'],
      ['Email campaigns', 'Produce the 600×200 email header from the photo used in the social posts, so they match.']
    ],
    mistakes: [
      'Leaving every preset ticked. All 16 are on when the page opens; untick the slots you never post to.',
      'Feeding in a small photo. Large slots like channel art are reached by enlarging, which softens the picture; start from the biggest original you have.'
    ],
    faq: [
      { q: 'What size is an Instagram story?', a: '1080×1920 pixels, a 9:16 frame, so a landscape photo loses most of its width there or sits between bars.' },
      { q: 'What is the best size for a YouTube thumbnail?', a: '1280×720 pixels, the 16:9 preset here. As JPEG it stays small: the 1600×1067 portrait photo from the example above, on Fill and crop, made a 185.8 KB thumbnail.' },
      { q: 'Should I upload JPEG or PNG to social media?', a: 'JPEG for photographs, since platforms recompress uploads anyway. PNG suits graphics with text and flat colour, where JPEG artefacts show.' }
    ],
    runs: [
      /* portrait.jpg from build/promo/samples at full size (1600×1067). Untick every platform except Instagram · Story / Reel,
         LinkedIn · Cover and YouTube · Thumbnail (preset indexes 2, 8, 9), #ic-mode "Fit whole image", bar colour and format
         (JPEG) at their defaults. Read Total size and each card's caption. */
      { browser: { tool: '/image/social-media-resizer/', file: 'build/promo/samples/portrait.jpg, full size 1600×1067', presets: ['Instagram Story / Reel', 'LinkedIn Cover', 'YouTube Thumbnail'], mode: 'contain', format: 'image/jpeg' },
        shown: ['1080×1920', '1584×396', '1280×720', '429.7 KB'] },
      /* the same three, #ic-mode "Fill and crop"; the YouTube Thumbnail card read 1280×720 · 185.8 KB.
         Re-measured 2026-10-04 in headless Chrome 154.0.8037.94 (the earlier 430.1, 583.2 and 186.3 KB no longer reproduced):
         contain 185.1 + 72.0 + 172.6 KB, cover 282.1 + 113.0 + 185.8 KB */
      { browser: { tool: '/image/social-media-resizer/', file: 'build/promo/samples/portrait.jpg, full size', presets: ['Instagram Story / Reel', 'LinkedIn Cover', 'YouTube Thumbnail'], mode: 'cover' },
        shown: ['580.9 KB', '185.8 KB'] }
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
