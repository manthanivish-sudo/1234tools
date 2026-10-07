'use strict';
/* Kit v2 story data: Image & Photo Tools. Contract: kit2-schema.md, sections 1 and 2.
   Every claim is checked against the tool's own page; image examples name a CC0
   sample and the options the capture engine sets before it runs the real tool. */
module.exports = {
  '/image/image-compressor/': {
    persona: 'Bloggers, sellers and form-fillers',
    hook: 'The form says max 200 KB. Your photo is 4.8 MB.',
    pain: 'The job portal rejects your photo for size, again. Nobody tells you how to make it smaller.',
    usual: ['Compressors that queue your photo online', 'Download limits on the free version', 'Shrinking it until it turns to mush'],
    promise: 'Set a size limit or move the quality slider. See both sizes.',
    steps: ['Drop in your photo', 'Set quality or a size limit', 'Download the smaller file'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'landscape', options: { format: 'image/webp', quality: 80 } },
    howTo: 'How to compress a photo under a size limit',
    cta: 'Compress a photo'
  },
  '/image/image-converter/': {
    persona: 'Anyone a website rejected for format',
    hook: 'The site wants JPG. Your download saved as WebP.',
    pain: 'You saved an image and it came down as WebP. The form, the printer and the old editor all refuse it.',
    usual: ['Converters that email you the result', 'Ad-heavy pages with three fake buttons', 'Opening a heavy editor just to save as'],
    promise: 'Pick the new format. The converted file downloads straight away.',
    steps: ['Drop in the image', 'Choose the new format', 'Download the converted file'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'product', options: { format: 'image/jpeg' } },
    howTo: 'How to convert WebP to JPG or PNG',
    cta: 'Convert an image'
  },
  '/image/image-resizer/': {
    persona: 'Anyone sizing one photo for a form or print',
    hook: 'Exactly 600×600 and under 100 KB, in one go.',
    pain: 'The form wants exact pixels and a size cap. Your photo is the wrong shape and too heavy.',
    usual: ['Editors that need an install for one resize', 'Resizers that stretch the picture', 'Guessing the quality to meet a limit'],
    promise: 'Set the size, crop or pad to fit, and add a KB limit.',
    steps: ['Drop in the photo', 'Set size, fit and any KB limit', 'Download the resized photo'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'product', options: { mode: 'cover', value: 1080, height: 1080 } },
    howTo: 'How to resize a photo to exact pixels',
    cta: 'Resize a photo'
  },
  '/image/bulk-image-resizer/': {
    persona: 'Online sellers and web editors',
    hook: '60 product photos. Every one needs to be 1200 px wide.',
    pain: 'The shop platform wants 1200 px images, and you have a folder of 4000 px phone shots.',
    usual: ['Resizing one photo at a time', 'Free tools that cap the batch size', 'Uploading the whole folder and waiting'],
    promise: 'Drop them all in, set one size, download a ZIP.',
    steps: ['Drop in all the photos', 'Set width, height or %', 'Download the ZIP'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'product', options: { mode: 'width', value: 1200 } },
    howTo: 'How to resize many images at once',
    cta: 'Resize in bulk'
  },
  '/image/image-cropper/': {
    persona: 'Anyone cropping for a profile or post',
    hook: 'Crop to exactly 1:1 without guessing the pixels.',
    pain: 'You need the photo square for the feed, and a freehand crop never lands on the right shape.',
    usual: ['Phone croppers with only a few ratios', 'Editors that need an install', 'Re-saves that soften the picture'],
    promise: 'Lock a ratio, drag or type the box, download the crop.',
    steps: ['Drop in the image', 'Pick a ratio and drag', 'Download the crop'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'street', options: { ratio: '1:1' } },
    howTo: 'How to crop a photo to an exact ratio',
    cta: 'Crop an image'
  },
  '/image/social-media-resizer/': {
    persona: 'Small brands posting everywhere',
    hook: 'One photo, six platforms, six different sizes.',
    pain: 'The launch photo has to fit a story, a feed post, a banner and a link preview. Each one crops it differently.',
    usual: ['Rebuilding the image for every platform', 'Resize features kept for paid plans', 'Letting each app crop your logo off'],
    promise: 'Drop the photo in once. Get every platform size in one pass.',
    steps: ['Drop in your image', 'Tick the platforms', 'Download every size'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'product' },
    howTo: 'How to resize one image for every social platform',
    cta: 'Resize for social'
  },
  '/image/circle-crop/': {
    persona: 'Anyone updating a profile picture',
    hook: 'Your new avatar, cut round, with see-through corners.',
    pain: 'The team page wants a round headshot. A square photo with white corners looks wrong in dark mode.',
    usual: ['Editors where the circle tool is buried', 'Exports that fill the corners with white', 'Apps that want a login for one crop'],
    promise: 'Drop in a photo. Get a round PNG with see-through corners.',
    steps: ['Drop in your photo', 'Zoom, move, pick the shape', 'Download the PNG'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'portrait', options: { shape: 'circle' } },
    howTo: 'How to make a round profile picture',
    cta: 'Make an avatar'
  },
  '/image/image-border/': {
    persona: 'Photographers and feed curators',
    hook: 'Make a phone photo look like a print on the wall.',
    pain: 'Your photos vanish into a dark feed. A clean white border or a polaroid frame would make them stand out.',
    usual: ['Frame apps with a logo in the corner', 'Editors that need layers for a border', 'Filters that crop the edges off'],
    promise: 'Choose solid, double or polaroid. Set the width. Download.',
    steps: ['Drop in a photo', 'Pick a frame style', 'Download the framed photo'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'landscape', options: { style: 'polaroid' } },
    howTo: 'How to add a border or frame to a photo',
    cta: 'Frame a photo'
  },
  '/image/image-rotate-flip/': {
    persona: 'Anyone with a sideways phone photo',
    hook: 'Upright on your phone. Sideways on theirs.',
    pain: 'You sent the photo and it arrived on its side. Your phone hid the problem in a flag inside the file.',
    usual: ['Rotating in a viewer that never saves', 'Sites that flip it back on upload', 'Turning the screen round to read it'],
    promise: 'Turn it by any angle or mirror it. The fix is baked into the pixels.',
    steps: ['Drop in the image', 'Set the angle or mirror', 'Download the fixed image'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'document', options: { angle: 90 } },
    howTo: 'How to rotate a photo so it stays rotated',
    cta: 'Rotate an image'
  },
  '/image/photo-filters/': {
    persona: 'Anyone with a dull or dark photo',
    hook: 'Shot at dusk, looks like midnight. Brighten it.',
    pain: 'The photo is good but flat and dark. You want it brighter with a touch more contrast, nothing fancy.',
    usual: ['Filter apps that demand an account', 'Editors with 200 sliders for one fix', 'Presets that turn skin orange'],
    promise: 'Pick a preset or move the sliders. See it live. Download.',
    steps: ['Drop in a photo', 'Pick a preset or adjust', 'Download the result'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'food', options: { preset: 'warm' } },
    howTo: 'How to brighten and adjust a photo online',
    cta: 'Adjust a photo'
  },
  '/image/blur-redact/': {
    persona: 'Anyone sharing a screenshot',
    hook: 'Your screenshot shows the account number. Block it first.',
    pain: 'You need to share the error message, but the screen also shows a customer’s name and address.',
    usual: ['A drawn box with the pixels still under it', 'Pixelated text that can be recovered', 'Cropping out half the useful part'],
    promise: 'Drag over the detail. Blur, pixelate or block it. Download.',
    steps: ['Drop in the image', 'Drag over what to hide', 'Download the safe copy'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'document', options: { method: 'block' } },
    howTo: 'How to blur or black out part of an image',
    cta: 'Redact an image'
  },
  '/image/exif-viewer/': {
    persona: 'Sellers, daters and the cautious',
    hook: 'Your photo may know the street you took it on.',
    pain: 'You are about to email a photo of the flat. It can carry the GPS spot and the phone it came from.',
    usual: ['Never checking until it is too late', 'Uploading a photo to see if it leaks', 'File properties that show half the story'],
    promise: 'Drop in a photo. See camera, time, settings and GPS location.',
    steps: ['Drop in a photo', 'Read the metadata list', 'Strip it if it says too much'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'A photo straight from your phone',
      output: 'Its camera, time, settings and GPS location',
      sampleIn: 'IMG_2041.jpg, emailed as it came off the phone',
      sampleOut: 'Date taken · camera model · exposure · GPS latitude and longitude'
    },
    howTo: 'How to see the hidden EXIF data in a photo',
    cta: 'Check a photo'
  },
  '/image/exif-remover/': {
    persona: 'Anyone posting photos of home',
    hook: 'Before you post it, take the location out.',
    pain: 'The listing photo of your spare room could put its exact location on a stranger’s screen.',
    usual: ['Trusting every app to strip it for you', 'Uploading a photo to remove its data', 'Screenshotting a photo to lose the tags'],
    promise: 'Drop in a photo. Get a copy without its GPS and camera tags.',
    steps: ['Drop in the photo', 'See what was found', 'Download the clean copy'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: {
      kind: 'schematic',
      input: 'A photo carrying GPS, camera and date tags',
      output: 'The same picture with its location and camera tags cut out',
      sampleIn: 'spare-room.jpg: GPS position, phone model, date and time',
      sampleOut: 'spare-room.jpg: the same pixels, the tags cut out'
    },
    howTo: 'How to remove location data from a photo',
    cta: 'Strip the metadata'
  },
  '/image/image-to-pdf/': {
    persona: 'Students and anyone claiming expenses',
    hook: 'Twelve receipt photos. The claim form wants one PDF.',
    pain: 'Expenses need one PDF of every receipt. You have a camera roll full of crooked JPEGs.',
    usual: ['Emailing twelve attachments and hoping', 'Converters that cap you at a few images', 'A watermark stamped on every page'],
    promise: 'Drop the photos in order. Get one PDF, one image per page.',
    steps: ['Drop in the images', 'Set the order and page size', 'Download the PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'document', options: { pageSize: 'a4' } },
    howTo: 'How to turn photos into one PDF',
    cta: 'Make the PDF'
  },
  '/image/image-splitter/': {
    persona: 'Instagram creators and designers',
    hook: 'One wide photo. Three swipes. One unbroken panorama.',
    pain: 'Your panorama shrinks to a thin strip in the feed. Split into panels, it fills the screen as people swipe.',
    usual: ['Guessing pixel widths in an editor', 'Apps that watermark every tile', 'Panels that do not line up'],
    promise: 'Pick a carousel or a grid. Get every tile, cut to the pixel.',
    steps: ['Drop in the image', 'Pick carousel or grid', 'Download the tiles'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'landscape', options: { preset: 'carousel3' } },
    howTo: 'How to split a photo into an Instagram carousel',
    cta: 'Split an image'
  },
  '/image/meme-generator/': {
    persona: 'Group-chat comedians and marketers',
    hook: 'The joke lands in the next ten minutes or never.',
    pain: 'You have the perfect picture and the perfect line. The meme app wants a sign-up and adds its logo.',
    usual: ['Meme apps that stamp their logo on it', 'Sign-ups before you can download', 'Text that vanishes on light photos'],
    promise: 'Drop in a picture, type or drag your lines, download.',
    steps: ['Drop in a picture', 'Type top and bottom text', 'Download the meme'],
    proof: ['Free', 'No sign-up', 'No watermark'],
    example: { kind: 'image', sample: 'pet', options: { top: 'I SAID ONE TREAT', bottom: 'I HEARD SIX' } },
    howTo: 'How to make a meme without a watermark',
    cta: 'Make a meme'
  },
  '/image/color-palette-extractor/': {
    persona: 'Designers and brand builders',
    hook: 'You love the colours in that photo. What are the codes?',
    pain: 'The client sent a photo and said “make the brand feel like this”. You need hex codes, not vibes.',
    usual: ['Eyedropping pixel by pixel', 'Palette apps that need an account', 'Guessing hex codes by eye'],
    promise: 'Drop in an image. Get its main colours as HEX, RGB and HSL.',
    steps: ['Drop in the image', 'Choose how many colours', 'Copy the codes'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'image', sample: 'landscape', options: { count: 6 } },
    howTo: 'How to get a colour palette from a photo',
    cta: 'Extract a palette'
  },
  '/image/svg-optimizer/': {
    persona: 'Front-end developers and designers',
    hook: 'Your exported SVG is carrying editor clutter. Strip it.',
    pain: 'The icon from your design app arrives with metadata, IDs and long decimals that browsers ignore.',
    usual: ['Shipping the export as it is', 'Optimisers that quietly break the artwork', 'Cleaning the markup by hand'],
    promise: 'Paste or drop the SVG. Get a smaller file with the same artwork.',
    steps: ['Paste or open the SVG', 'Set the decimal precision', 'Copy or download the .svg'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'text',
      input: '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Exported from a design app -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/ns" width="48" height="48" viewBox="0 0 48 48">\n  <metadata>rdf:RDF cc:Work dc:format image/svg+xml</metadata>\n  <title>cup</title>\n  <path id="path1042" inkscape:label="Layer 1" d="M 10.123456 14.987654 L 37.876543 14.987654 L 34.500001 40.250002 L 13.499999 40.250002 Z" fill="#f7c948"/>\n</svg>'
    },
    howTo: 'How to make an SVG file smaller',
    cta: 'Optimise an SVG'
  },
  '/image/image-to-base64/': {
    persona: 'Web developers and email builders',
    hook: 'Need that tiny icon inline in the CSS? One drop.',
    pain: 'You want a 1 KB icon inside the stylesheet, not one more file request on every page.',
    usual: ['Command-line encoders and copy errors', 'Online encoders that upload your file', 'Hand-building the data: prefix'],
    promise: 'Drop in the image. Copy a data URI, a CSS rule or an img tag.',
    steps: ['Drop in the image', 'Pick data URI, CSS or HTML', 'Copy the output'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'A small PNG or SVG icon',
      output: 'A data URI, a CSS rule or an img tag to paste',
      sampleIn: 'cup-icon.png, 1 KB',
      sampleOut: 'background-image: url("data:image/png;base64,iVBORw0KGgo…");'
    },
    howTo: 'How to convert an image to Base64',
    cta: 'Encode an image'
  },
  '/image/passport-photo/': {
    persona: 'Visa and passport applicants',
    hook: 'Passport photos at home, laid out on one 6×4 print.',
    pain: 'The photo booth is across town and the application closes on Friday. Your phone takes a better photo anyway.',
    usual: ['Photo booths that charge for one strip', 'Apps that hold the download for payment', 'Cropping to 35×45 mm by guesswork'],
    promise: 'Pick the document. Get the right size on a 6×4 or A4 sheet.',
    steps: ['Drop in a front-facing photo', 'Pick the document type', 'Print the sheet'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'image', sample: 'passport', options: { bgmode: 'replace', bg: '#ffffff', sheet: 'both' } },
    howTo: 'How to make passport photos at home',
    cta: 'Make passport photos'
  },
  '/image/background-remover/': {
    persona: 'Online sellers with white-wall shots',
    hook: 'Your product is on white. Make the white disappear.',
    pain: 'The marketplace wants a clean cut-out. The product was shot on a white sheet that came out grey.',
    usual: ['Full-size downloads kept for paid plans', 'Uploading product shots before launch', 'Tracing round it with a lasso tool'],
    promise: 'Drop in the photo. The plain background goes; download a PNG.',
    steps: ['Drop in the photo', 'Raise tolerance if needed', 'Download the PNG'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'schematic', input: 'A logo or product on a plain backdrop', output: 'A transparent PNG, the backdrop removed', sampleIn: 'logo.jpg on a white sheet', sampleOut: 'logo.png with a transparent background' },
    howTo: 'How to remove a white background from a photo',
    cta: 'Remove the background'
  }
};
