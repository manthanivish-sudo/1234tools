/**
 * The landing pages build-landing.js writes: one job each, the tool that
 * does it, the preset the tool opens with, and the page's own words.
 *
 * Every page:
 *   section, slug        its address, /<section>/<slug>/
 *   tool                 the tool page whose spec and engine it mounts
 *   preset               the link settings that tool reads (refused if it would not)
 *   presetIsDefault      the preset only restates a default (it still wins over
 *                        a remembered setting, which is why it is there)
 *   presetNote           what the preset sets, in words, shown under the tool
 *   group                its heading on the hub and its neighbours in Related
 *   h1, pageTitle, description, lede, answer {h, paras}, steps, faq, keywords, io
 *   example              { files, shown, text, date, source }: the run the test
 *                        (build/tests/landing.js) repeats on this page; `files`
 *                        names its fixtures, `shown` the figures it read, and
 *                        `text` quotes them as {name}
 *
 * The passport pages are made from engine/img-passport-presets.js, so a size
 * on them is the size the tool uses. A country gets a page only when its
 * preset's source is the issuer's own page about photos (not a home page), so
 * nothing here rests on a figure that still waits for a check.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATE = '2026-10-07';
const CONVERTER = '/image/image-converter/';
const COMPRESSOR = '/image/image-compressor/';
const PASSPORT = '/image/passport-photo/';
const PDF_COMPRESS = '/pdf/compress-pdf/';
const PDF_IMAGES = '/pdf/pdf-to-images/';
const IMAGE_PDF = '/image/image-to-pdf/';

/* figures read from the runs in build/tests/landing.js --record (Chrome, --disable-gpu) */
const R = require('./recorded.json');
const rec = (slug) => R[slug] || {};

/* ------------------------------------------------------------------ */
/* format pairs                                                       */
/* ------------------------------------------------------------------ */

const FORMAT = 'Convert a format';
function pair(o) {
  return Object.assign({
    section: 'image', tool: CONVERTER, group: FORMAT,
    stepsTitle: 'How to convert ' + o.a + ' to ' + o.b,
    keywords: [o.a.toLowerCase() + ' to ' + o.b.toLowerCase(), 'convert ' + o.a.toLowerCase() + ' to ' + o.b.toLowerCase(), o.a.toLowerCase() + ' ' + o.b.toLowerCase() + ' converter'],
    io: o.a + ' → ' + o.b,
    h1: o.a + ' to ' + o.b,
    eyebrow: 'Image converter'
  }, o, { example: Object.assign({ date: DATE, shown: rec(o.slug) }, o.example) });
}

const PAIRS = [
  pair({
    slug: 'png-to-jpg', a: 'PNG', b: 'JPG', preset: { from: 'png', to: 'jpg' },
    presetNote: 'PNG files in, JPG out, at quality 92 on a white background.',
    pageTitle: 'PNG to JPG Converter — Free, No Upload | 1234Tools',
    description: 'Convert PNG to JPG in your browser: transparency filled with a colour you pick, quality 92 by default, one file or a batch. Nothing is uploaded.',
    lede: 'Turn PNG screenshots, exports and photos into JPG files that every form, printer and phone accepts. The converter below is already set for PNG to JPG.',
    answer: { h: 'What changes when a PNG becomes a JPG', paras: [
      'PNG keeps every pixel exactly, so a photograph saved as PNG is often several times the size it needs to be. JPG throws away detail the eye rarely misses, which is why a website or an application form that caps uploads usually wants JPG.',
      'JPG has no transparent pixels. Anything see-through in your PNG is painted with the background colour, white unless you choose another, before the JPG is written. A logo meant for a dark page wants that colour set to match the page.'
    ] },
    steps: ['Choose or drop your PNG files; a whole folder works too.', 'Leave the quality at 92, or lower it for a smaller file.', 'Pick a background colour if the PNG has transparent areas.', 'Download each JPG, or all of them in one ZIP.'],
    faq: [
      { q: 'Why is my JPG so much smaller than the PNG?', a: 'Because a PNG stores a photograph losslessly and a JPG does not. The example photo above lost 86% of its size. A PNG of flat colour, like a chart, shrinks far less and may show soft edges as a JPG.' },
      { q: 'What happens to the transparent background?', a: 'JPG cannot store transparency, so those pixels take the background colour shown under the format, white by default. Choose the colour of the page the picture will sit on, or keep the image as PNG or WebP.' },
      { q: 'Can I convert many PNG files to JPG at once?', a: 'Yes. Choose them all, or drop a folder; each comes out as its own JPG and the lot can be saved as one ZIP or straight into a folder you pick.' }
    ],
    example: { files: ['street.png'], text: 'A street photograph re-saved as a 1600 × 1200 PNG weighed {in}. Converted here at the default quality of 92 it became a JPG of {out}, the same 1600 × 1200 pixels.' }
  }),
  pair({
    slug: 'jpg-to-png', a: 'JPG', b: 'PNG', preset: { from: 'jpg', to: 'png' }, presetIsDefault: true,
    presetNote: 'JPG files in, lossless PNG out.',
    pageTitle: 'JPG to PNG Converter — Lossless, In Your Browser | 1234Tools',
    description: 'Convert JPG to PNG without uploading: every pixel of the JPG kept, transparency-ready, one photo or a batch. Free, with no watermark.',
    lede: 'Save a JPG as a PNG when an editor, a print template or a design tool asks for PNG. The converter below opens set for JPG to PNG.',
    answer: { h: 'Will a PNG make my JPG look better?', paras: [
      'No. A PNG stores whatever pixels it is given without losing any more, but the detail a JPG discarded when it was saved is gone. Converting stops further loss from repeated JPG saves; it does not undo the loss already there.',
      'Expect the file to grow, often several times over, because PNG keeps every pixel exactly. That is the price of an editable copy that never degrades, and the reason to keep the original JPG for sharing.'
    ] },
    steps: ['Choose or drop the JPG photos.', 'Check that the format reads PNG; there is no quality to set, PNG is lossless.', 'Optionally cap the longest side to keep the PNG smaller.', 'Download the PNG files, one by one or as a ZIP.'],
    faq: [
      { q: 'Why is the PNG bigger than my JPG?', a: 'A JPG is compressed with loss; a PNG of the same picture keeps every pixel, so it needs far more bytes for a photograph. The example above grew more than six times over.' },
      { q: 'Does converting to PNG add a transparent background?', a: 'No. The PNG is only as transparent as the picture it came from, and a JPG has no transparent pixels. To cut out a background, use the background remover first.' },
      { q: 'Are the camera details kept in the PNG?', a: 'By default only the colour profile is carried over; the date, camera and location are left out. The Metadata setting can keep them, without the GPS position if you prefer.' }
    ],
    related: ['png-to-jpg', 'jpg-to-webp'],
    example: { files: ['food.jpg'], text: 'A 1600 × 1067 food photograph, a JPG of {in}, came out as a PNG of {out}: the same pixels, held without any further loss.' }
  }),
  pair({
    slug: 'webp-to-jpg', a: 'WebP', b: 'JPG', preset: { from: 'webp', to: 'jpg' },
    presetNote: 'WebP files in, JPG out, at quality 92 on a white background.',
    pageTitle: 'WebP to JPG Converter — Free, No Upload | 1234Tools',
    description: 'Convert WebP images saved from websites into JPG that older software, printers and forms accept. In your browser, one file or a batch.',
    lede: 'Pictures saved from a web page often arrive as WebP, which some older programs and upload forms still refuse. Turn them into JPG here.',
    answer: { h: 'Why a WebP needs converting at all', paras: [
      'Websites serve WebP because it is smaller than JPG at the same look. Every current browser opens it, but a print shop’s upload page, an older photo editor or a government portal may only accept JPG or PNG.',
      'Converting decodes the WebP and writes a fresh JPG, so the result is a second lossy copy. At quality 92 the difference is hard to see; keep the WebP if you only want to look at it.'
    ] },
    steps: ['Choose the WebP files you saved.', 'Keep quality 92 unless you need a smaller file.', 'If the WebP had transparency, choose the colour to fill it with.', 'Download the JPG files.'],
    faq: [
      { q: 'Why did my JPG come out larger than the WebP?', a: 'WebP packs the same picture into fewer bytes than JPG, so a straight conversion usually grows. The example above grew by about two fifths. Lower the quality if the size matters more than the look.' },
      { q: 'What about animated WebP files?', a: 'A JPG holds one picture, so only the first frame is used, and the page says so. Keep animations as WebP or GIF.' },
      { q: 'Can I turn WebP into PNG instead?', a: 'Yes: change the format under the converter to PNG. Choose PNG when the WebP has transparent parts you want to keep.' }
    ],
    example: { files: ['landscape.webp'], text: 'A 1600 × 1063 landscape saved as a WebP of {in} became a JPG of {out} at quality 92.' }
  }),
  pair({
    slug: 'jpg-to-webp', a: 'JPG', b: 'WebP', preset: { from: 'jpg', to: 'webp' },
    presetNote: 'JPG files in, WebP out, at quality 92.',
    pageTitle: 'JPG to WebP Converter — Smaller Images for the Web | 1234Tools',
    description: 'Convert JPG photos to WebP for faster web pages, with libwebp running in your browser. Quality 92 by default, batches welcome, nothing uploaded.',
    lede: 'Make product photos, blog images and banners lighter for a website by saving them as WebP. The converter is set for JPG to WebP.',
    answer: { h: 'How much WebP saves over JPG', paras: [
      'WebP usually reaches the look of a JPG in fewer bytes, which is why page-speed reports keep suggesting it. How much it saves depends on the picture and on the quality you choose; the example below shows one real photo.',
      'Every current browser shows WebP, so it is safe for a website. Email attachments and print orders are another matter: send those as JPG.'
    ] },
    steps: ['Choose the JPG photos for your site.', 'Set the quality: 92 keeps detail, 75 to 80 is the usual choice for the web.', 'Cap the longest side if the photos are larger than the page shows them.', 'Download the WebP files or a ZIP.'],
    faq: [
      { q: 'What quality should I use for WebP on a website?', a: 'Start at 75 to 80 for photos and look at the result beside the original using the compare view. The default of 92 is cautious and keeps more than most pages need.' },
      { q: 'Will WebP work in every browser?', a: 'Every current version of Chrome, Edge, Firefox and Safari displays WebP. Only very old browsers, mostly Safari before 2020, do not.' },
      { q: 'Is the WebP written by my browser’s own encoder?', a: 'No. The page runs libwebp, the reference WebP encoder, compiled to WebAssembly, so Safari and Chrome produce the same files. Where WebAssembly is switched off it falls back and says so.' }
    ],
    example: { files: ['product.jpg'], text: 'A 1600 × 1067 product photograph, a JPG of {in}, became a WebP of {out} at the cautious default of quality 92, still {dims}: a small saving, which is why a website usually wants 75 to 80.' }
  }),
  pair({
    slug: 'png-to-webp', a: 'PNG', b: 'WebP', preset: { from: 'png', to: 'webp' },
    presetNote: 'PNG files in, WebP out, at quality 92, transparency kept.',
    pageTitle: 'PNG to WebP Converter — Keep Transparency, Lose the Weight | 1234Tools',
    description: 'Convert PNG to WebP in your browser and keep transparent areas transparent. Usually far smaller than the PNG; one image or a batch.',
    lede: 'WebP can hold transparency like PNG at a fraction of the size, which makes it the usual swap for PNG photos and cut-outs on a website.',
    answer: { h: 'PNG or WebP for images with transparency', paras: [
      'A cut-out product shot or a photo with a soft shadow is heavy as PNG, because PNG keeps every pixel. WebP keeps the transparent parts and compresses the rest, so the same picture often weighs a small fraction as much.',
      'This page writes lossy WebP at the quality you set. For sharp text, line art or pixel-exact graphics, the image compressor can write lossless WebP instead, which is still usually smaller than PNG.'
    ] },
    steps: ['Choose the PNG files.', 'Keep quality 92, or lower it for photos.', 'Check the compare view for edges around transparent areas.', 'Download the WebP files.'],
    faq: [
      { q: 'Does WebP keep my transparent background?', a: 'Yes. WebP has an alpha channel, so see-through pixels stay see-through; no background colour is painted in, unlike a conversion to JPG.' },
      { q: 'Should I use WebP for logos and screenshots?', a: 'Lossy WebP can blur fine text and hard edges. For those, open the image compressor, choose WebP and set WebP mode to Lossless.' },
      { q: 'How much smaller will the WebP be?', a: 'For a photograph saved as PNG the saving is usually most of the file; the example on this page lost over nine tenths. For a flat graphic the gap is smaller.' }
    ],
    related: ['jpg-to-webp', 'png-to-jpg'],
    example: { files: ['pet.png'], text: 'A 1600 × 1067 photograph of a dog stored as a PNG of {in} became a WebP of {out} at quality 92.' }
  }),
  pair({
    slug: 'avif-to-jpg', a: 'AVIF', b: 'JPG', preset: { from: 'avif', to: 'jpg' },
    presetNote: 'AVIF files in, JPG out, at quality 92 on a white background.',
    pageTitle: 'AVIF to JPG Converter — Free, In Your Browser | 1234Tools',
    description: 'Convert AVIF images to JPG for software and sites that cannot open AVIF yet. Decoded by your browser, written by MozJPEG, nothing uploaded.',
    lede: 'AVIF is the newest web format and many programs still cannot open it. Convert AVIF to JPG here; your browser does the decoding.',
    answer: { h: 'Opening an AVIF file you cannot use', paras: [
      'AVIF files are small for their quality, which is why some websites and phones now save them. Plenty of desktop software, printers and upload forms do not read them yet, and a JPG copy solves that.',
      'The decoding is done by your browser, and current Chrome, Edge, Firefox and Safari all read AVIF. If yours cannot, the page names the file instead of producing a blank picture.'
    ] },
    steps: ['Choose the AVIF files.', 'Keep quality 92 for a faithful JPG.', 'Choose a background colour if the AVIF has transparency.', 'Download the JPG files.'],
    faq: [
      { q: 'Why is the JPG so much larger than the AVIF?', a: 'AVIF is one of the most efficient image formats there is; JPG needs more bytes for the same look. The example above grew more than two and a half times at quality 92.' },
      { q: 'My browser will not open the AVIF. What now?', a: 'Update the browser, or open this page in another one: AVIF has been readable in Chrome since 2020 and in Safari since 2022. A file the browser cannot decode is named in the message under the tool.' },
      { q: 'Can I convert JPG to AVIF too?', a: 'Yes. Open the image converter and choose AVIF as the format; the encoder is libavif running in the page.' }
    ],
    example: { files: ['group.avif'], text: 'A 1600 × 1067 group photograph saved as an AVIF of {in} became a JPG of {out} at quality 92.' }
  }),
  pair({
    slug: 'gif-to-png', a: 'GIF', b: 'PNG', preset: { from: 'gif', to: 'png' }, presetIsDefault: true,
    presetNote: 'GIF files in, PNG out; an animated GIF gives its first frame.',
    pageTitle: 'GIF to PNG Converter — First Frame or Still GIF | 1234Tools',
    description: 'Convert a GIF to PNG in your browser: a still GIF exactly, an animated GIF as its first frame, with the page telling you which.',
    lede: 'Turn a GIF into a PNG for an editor, a document or a profile picture. For an animation, the PNG is its first frame.',
    answer: { h: 'GIF to PNG: what you get', paras: [
      'A GIF holds at most 256 colours per frame. PNG holds those exactly and can hold millions more, so a still GIF converts with no change at all to the picture, only to the container.',
      'A PNG is one picture, so an animated GIF loses its movement: the first frame is used, and the message under the tool says so. To keep the animation, leave the file as a GIF.'
    ] },
    steps: ['Choose the GIF files.', 'Leave the format at PNG.', 'If a GIF is animated, read the note about its first frame.', 'Download the PNG.'],
    faq: [
      { q: 'Can I get every frame of an animated GIF as PNG?', a: 'Not on this page: it writes one PNG per file, from the first frame. The note under the tool tells you when a GIF was animated.' },
      { q: 'Will the PNG have more colours than the GIF?', a: 'No. The picture keeps the colours the GIF had. PNG simply does not limit them, which matters only if you edit the picture afterwards.' },
      { q: 'Is the PNG smaller than the GIF?', a: 'Sometimes, sometimes not. The example above shows one photograph saved as GIF; flat cartoons and diagrams often come out smaller as PNG.' }
    ],
    example: { files: ['product.gif'], text: 'A product photograph saved as an 800 × 534 GIF of 256 colours ({in}) became a PNG of {out}, with the same pixels.' }
  }),
  pair({
    slug: 'bmp-to-jpg', a: 'BMP', b: 'JPG', preset: { from: 'bmp', to: 'jpg' },
    presetNote: 'BMP files in, JPG out, at quality 92.',
    pageTitle: 'BMP to JPG Converter — Shrink Bitmap Files | 1234Tools',
    description: 'Convert BMP bitmaps from old software, scanners and Paint into small JPG files, in your browser. One file or a whole folder.',
    lede: 'A BMP stores every pixel uncompressed, so even a modest picture is megabytes. Convert BMP to JPG to email it, upload it or keep it.',
    answer: { h: 'Why BMP files are so big', paras: [
      'BMP is the bitmap format of early Windows: three bytes for every pixel, no compression. A 1600 × 1067 picture is about five megabytes whatever is in it, which is why mailboxes and upload forms balk.',
      'JPG keeps the same width and height and brings the size down to a small fraction. For screenshots with sharp text, PNG keeps the text crisp and still shrinks a BMP a great deal.'
    ] },
    steps: ['Choose the BMP files, or drop the folder they are in.', 'Keep quality 92, or pick PNG for screenshots.', 'Check one result in the compare view.', 'Download the JPG files or a ZIP.'],
    faq: [
      { q: 'How much smaller will the JPG be?', a: 'Usually more than nine tenths smaller for a photograph, as in the example above, because a BMP is not compressed at all.' },
      { q: 'My BMP is a screenshot. Is JPG right?', a: 'Choose PNG instead under the format. JPG blurs the edges of text; PNG keeps them and still shrinks an uncompressed bitmap.' },
      { q: 'Can I make a BMP from a JPG?', a: 'Yes, in the image converter: choose BMP, which some old embroidery, signage and industrial software still asks for.' }
    ],
    example: { files: ['portrait.bmp'], text: 'A 1600 × 1067 portrait saved as a 24-bit BMP weighed {in}. As a JPG at quality 92 it came to {out}.' }
  }),
  pair({
    slug: 'svg-to-png', a: 'SVG', b: 'PNG', preset: { from: 'svg', to: 'png' }, presetIsDefault: true,
    presetNote: 'SVG files in, PNG out at the SVG’s own size, transparency kept.',
    pageTitle: 'SVG to PNG Converter — Transparent PNG from SVG | 1234Tools',
    description: 'Convert an SVG logo or icon to a transparent PNG in your browser, at the size the SVG declares. Nothing is uploaded.',
    lede: 'Some sites and apps take PNG but not SVG. Turn an SVG logo or icon into a PNG that keeps its transparent background.',
    answer: { h: 'How big will the PNG be?', paras: [
      'An SVG is drawing instructions, not pixels, so it has to be drawn at some size. Your browser draws it at the width and height written in the SVG file; this page then saves that drawing as PNG, keeping the transparent background.',
      'The converter never enlarges a picture, so to get a bigger PNG, set larger width and height attributes in the SVG first. Make sure they are in the file; an SVG without them is drawn at the browser’s own default size.'
    ] },
    steps: ['Choose the SVG file.', 'Leave the format at PNG to keep transparency.', 'Check the size shown under the result.', 'Download the PNG.'],
    faq: [
      { q: 'Is the PNG background transparent?', a: 'Yes, wherever the SVG draws nothing. PNG keeps the alpha channel; only a conversion to JPG paints a background in.' },
      { q: 'Why is my PNG small?', a: 'It is drawn at the width and height the SVG states. Edit those two attributes in the file to draw it larger; scaling the PNG up afterwards would only blur it.' },
      { q: 'Do fonts in my SVG come out right?', a: 'Text in an SVG uses the fonts your device has. Convert the text to outlines in your design program first if the font is unusual.' }
    ],
    related: ['png-to-webp', 'png-to-jpg'],
    example: { files: ['logo.svg'], text: 'The 1234Tools logo, an SVG of {in} drawn at 512 × 512, became a PNG of {out} at {dims}, with its rounded corners transparent.' }
  }),
  pair({
    slug: 'heic-to-jpg', a: 'HEIC', b: 'JPG', preset: { from: 'heic', to: 'jpg' },
    presetNote: 'HEIC files in, JPG out at quality 92: this works in Safari only, as explained below.',
    pageTitle: 'HEIC to JPG — Convert iPhone Photos (Safari) | 1234Tools',
    description: 'Convert iPhone HEIC photos to JPG in Safari, on the device. Other browsers cannot decode HEIC; here is what to do instead.',
    lede: 'iPhones save photos as HEIC, which many websites and Windows programs cannot open. In Safari this page converts them to JPG; in other browsers it tells you plainly that it cannot.',
    answer: { h: 'Why HEIC works in Safari and nowhere else here', paras: [
      'HEIC pictures are compressed with HEVC, a video codec. Safari on iPhone, iPad and Mac decodes it, so there the converter reads your HEIC and writes a JPG like any other file.',
      'Chrome, Edge and Firefox have no HEIC decoder, and the free decoders that exist are under licences this site does not ship, so in those browsers the file is named with the advice below rather than turned into a blank or broken picture.',
      'The simplest fix is on the iPhone itself: Settings, Camera, Formats, Most Compatible makes the camera save JPG from then on. Sharing a photo by email or AirDrop to a Windows PC also often converts it on the way.'
    ] },
    steps: ['Open this page in Safari on your iPhone, iPad or Mac.', 'Choose the HEIC photos from Photos or Files.', 'Keep quality 92, or lower it for a smaller file.', 'Save the JPG files.'],
    faq: [
      { q: 'Can I convert HEIC to JPG in Chrome on Windows?', a: 'Not on this page. Chrome has no HEIC decoder and none is shipped here. Use Safari on an Apple device, change the iPhone to Most Compatible, or export as JPEG from the Photos app.' },
      { q: 'Why not upload the HEIC to a server that can decode it?', a: 'Because this site does not upload your files: every tool runs in the browser. That rules out server-side decoding, and we would rather say so than send your photos away.' },
      { q: 'Will the JPG keep the photo’s date and place?', a: 'Only if you ask: by default just the colour profile is kept. The Metadata setting can keep the camera details, with or without the GPS position.' }
    ],
    example: { files: ['photo.heic'], text: 'Given a HEIC file in Chrome, the page converted nothing and said: “{msg}”' , source: 'Safari was not available for this run' }
  })
];

/* ------------------------------------------------------------------ */
/* image size targets: the compressor's "Make it under"               */
/* ------------------------------------------------------------------ */

const IMG_SIZE = 'Compress an image to a size';
function imgSize(o) {
  return Object.assign({
    section: 'image', tool: COMPRESSOR, group: IMG_SIZE, eyebrow: 'Image compressor',
    preset: { target: String(o.kb) },
    presetNote: 'Make it under ' + o.label + ', keeping each file’s own format.',
    h1: 'Compress Image to ' + o.label,
    pageTitle: 'Compress Image to ' + o.label + ' — Free, No Upload | 1234Tools',
    stepsTitle: 'How to get an image under ' + o.label,
    keywords: ['compress image to ' + o.label.toLowerCase().replace(' ', ''), 'compress image to ' + o.label.toLowerCase(), 'reduce photo size to ' + o.label.toLowerCase(), 'image under ' + o.label.toLowerCase()],
    io: 'Image → under ' + o.label
  }, o, { example: Object.assign({ date: DATE, shown: rec(o.slug) }, o.example) });
}

const SIZES = [
  imgSize({
    slug: 'compress-image-to-20kb', kb: 20, label: '20 KB',
    description: 'Get a photo or signature under 20 KB for an exam, job or visa form, in your browser. Tries qualities, then smaller sizes, until it fits.',
    lede: 'Application portals often cap a photo or a signature at 20 KB. This compressor is set to get each image under that, and tells you the size it reached.',
    answer: { h: 'Getting under 20 KB without ruining the photo', paras: [
      'Twenty kilobytes is very little for a modern photo, which may start at several megabytes. The page first lowers the JPEG quality; when that alone is not enough it also shrinks the picture, because a smaller picture at a decent quality looks better than a full-size one at the lowest quality.',
      'Forms that ask for 20 KB usually also give pixel dimensions. Crop to that shape first with the cropper or the passport tool: a picture that starts small fits at a higher quality and comes out sharper.'
    ] },
    steps: ['Choose the photo or the scanned signature.', 'Leave “Make it under” at 20 KB.', 'Read the size and the pixel dimensions under the result.', 'Download it and upload it to the form.'],
    faq: [
      { q: 'Is 20 KB here the same as 20 KB on the form?', a: 'It is counted as 20,000 bytes, which is under 20 KB however the form counts a kilobyte, as 1,000 or 1,024 bytes.' },
      { q: 'Why did the picture get smaller in pixels?', a: 'Because no quality setting could bring the full-size photo under 20 KB without turning it to mush. The page shrinks it only as far as needed, and the result shows the dimensions it used.' },
      { q: 'What if the form also asks for exact dimensions?', a: 'Make the photo that size first with the image resizer, cropper or passport photo maker, then bring it back here. A small picture fits 20 KB at a higher quality.' }
    ],
    example: { files: ['portrait.jpg'], text: 'A 1600 × 1067 portrait JPG of {in} came out at {out}, {dims} at JPEG quality {q}, after the page had tried qualities and then smaller sizes.' }
  }),
  imgSize({
    slug: 'compress-image-to-50kb', kb: 50, label: '50 KB',
    description: 'Compress a JPG or PNG photo to under 50 KB in your browser, for online applications and ID uploads. No upload, no sign-up.',
    lede: 'Fifty kilobytes is a common ceiling on government, university and recruitment portals. The compressor below is set to get each file under it.',
    answer: { h: 'What a 50 KB limit allows', paras: [
      'At 50 KB a photo of around a thousand pixels across can still look clean at a middling JPEG quality. The page starts by lowering the quality and only reduces the dimensions when quality alone cannot get under the limit.',
      'Check the message under the result: if a file cannot fit even at the lowest quality and smallest size the page will try, it says so by name and gives you the smallest version it made.'
    ] },
    steps: ['Choose one image or a batch.', 'Keep “Make it under” at 50 KB.', 'Look at the result beside the original.', 'Download the file, or a ZIP for a batch.'],
    faq: [
      { q: 'Can I compress a PNG to 50 KB?', a: 'Yes. A PNG photo is best changed to JPEG or WebP under Output format first; a PNG with few colours, like a screenshot, may fit as PNG.' },
      { q: 'The form wants between 20 and 50 KB. Will this be too small?', a: 'Usually not: the page lowers the quality only as far as it must, so a large photo tends to land close to the limit; the example above came to 48.6 KB.' },
      { q: 'Does it remove the location from my photo?', a: 'Yes, by default: the camera details and the GPS position stay behind, and only the colour profile goes into the smaller file. That also saves a few kilobytes.' }
    ],
    example: { files: ['document.jpg'], text: 'A photographed document, 1600 × 1503 and {in} as a JPG, came down to {out} at {dims}, JPEG quality {q}.' }
  }),
  imgSize({
    slug: 'compress-image-to-100kb', kb: 100, label: '100 KB',
    description: 'Compress an image to under 100 KB for an email, a listing or an upload form. Quality first, dimensions only if needed; all in your browser.',
    lede: 'A hundred kilobytes is enough for a sharp photo on screen. Set to that limit, the compressor below keeps as much of the picture as fits.',
    answer: { h: 'Why 100 KB is often enough', paras: [
      'A typical phone photo is a few megabytes because it has twelve or more megapixels. Shown on a web page or opened from an email, it rarely needs more than a quarter of that; 100 KB holds a picture around 1,500 pixels wide at a modest quality.',
      'The page starts from the quality on the slider, 80 unless you change it, lowers it until the file lands under 100 KB, and shrinks the picture only when quality alone falls short. The quality it settled on is shown with each result.'
    ] },
    steps: ['Choose the images.', 'Keep “Make it under” at 100 KB, or pick another limit.', 'Compare the result with the original using the slider.', 'Download the compressed files.'],
    faq: [
      { q: 'Which format gets the most picture into 100 KB?', a: 'AVIF, then WebP, then JPEG. Choose WebP or AVIF under Output format if the place you are sending it accepts them; JPEG opens everywhere.' },
      { q: 'Why does it take longer than plain compression?', a: 'Because the page encodes several versions of each photo to find the best one that fits. A progress bar shows how far a batch has got, and Cancel keeps the files already finished.' },
      { q: 'Will the result be under 100 KB on Windows too?', a: 'Yes. The limit is 100,000 bytes, which Windows shows as about 97 KB, so it fits whichever way the size is counted.' }
    ],
    example: { files: ['street.jpg'], text: 'A 1600 × 1200 street photograph of {in} was compressed to {out}, {dims} at JPEG quality {q}.' }
  }),
  imgSize({
    slug: 'compress-image-to-200kb', kb: 200, label: '200 KB',
    description: 'Reduce a photo to under 200 KB in your browser while keeping its full size where possible. For listings, CVs, forms and email.',
    lede: 'Two hundred kilobytes leaves room for a full-size, good-looking photo. The compressor below is set to that limit.',
    answer: { h: 'Under 200 KB, usually at full size', paras: [
      'For most photos up to about two thousand pixels across, 200 KB can be reached by quality alone, so the picture keeps every pixel of its width and height. Only very large or very detailed photos are scaled down.',
      'If a photo is already under 200 KB, compressing it again only loses quality for little gain. The page shows the size before and after for each file, so you can keep whichever is better.'
    ] },
    steps: ['Choose the photos.', 'Leave “Make it under” at 200 KB.', 'Check the size and the quality under each result.', 'Save them, singly or as a ZIP.'],
    faq: [
      { q: 'Will my photo be resized?', a: 'Only if it cannot fit by lowering the quality. In the example above it kept its full 1600 × 1067 pixels.' },
      { q: 'Can I set my own limit, like 150 KB?', a: 'Yes: choose “Another size…” under “Make it under” and type the number of kilobytes.' },
      { q: 'What happens to a photo already under 200 KB?', a: 'It is still re-encoded at the best quality that fits, and the page notes when the result is not smaller. Keep the original if so.' }
    ],
    example: { files: ['food.jpg'], text: 'A food photograph, 1600 × 1067 and already {in}, came out at {out}, still {dims}, at JPEG quality {q}.' }
  }),
  imgSize({
    slug: 'compress-image-to-500kb', kb: 500, label: '500 KB',
    description: 'Bring a large camera or phone photo under 500 KB in your browser, keeping it sharp enough to print small. No upload.',
    lede: 'Half a megabyte suits a photo that should still look good on a large screen or as a small print. The compressor below is set to 500 KB.',
    answer: { h: 'When 500 KB is the right limit', paras: [
      'Camera and phone photos are often three to eight megabytes. Many photo competitions, property sites and print-on-demand forms ask for something under 500 KB, which keeps a large picture at a high quality.',
      'Because the limit is generous, the page can usually keep the full dimensions and simply lower the quality a little. Large panoramas may still be scaled down; the result always says what it did.'
    ] },
    steps: ['Choose the large photos.', 'Leave “Make it under” at 500 KB.', 'Zoom to 100% in the compare view to check fine detail.', 'Download the results.'],
    faq: [
      { q: 'Is 500 KB enough to print?', a: 'For a small print it can be, if the dimensions survive: check the pixel size under the result. For large prints, keep the original.' },
      { q: 'Does it keep the photo’s EXIF data?', a: 'By default only the colour profile; choose under Metadata to keep the camera details, with or without the location.' },
      { q: 'Why did one file in my batch not reach 500 KB?', a: 'A very large or noisy photo may not fit even at the lowest quality and smallest size the page tries. It is named in the message, with the smallest version it made.' }
    ],
    example: { files: ['street-camera.jpg'], text: 'The street photograph enlarged to 3200 × 2400 and saved at quality 95, the size a phone camera writes, was a JPG of {in}. Set to 500 KB it came out at {out}, {dims} at JPEG quality {q}.' }
  }),
  imgSize({
    slug: 'compress-image-to-1mb', kb: 1000, label: '1 MB',
    description: 'Compress photos to under 1 MB in your browser for email, cloud forms and websites with a 1 MB cap, keeping full size where possible.',
    lede: 'A one-megabyte cap is common on support forms, marketplaces and older email systems. The compressor below is set to bring each photo under it.',
    answer: { h: 'Fitting a big photo under 1 MB', paras: [
      'One megabyte is plenty for a large photo at a good JPEG quality, so most pictures keep their full dimensions here and are simply saved at a lower quality.',
      'The limit counts 1,000,000 bytes. Systems that count a megabyte as 1,048,576 bytes have a little more room, so the file passes either way.'
    ] },
    steps: ['Choose the photos, or a folder of them.', 'Leave “Make it under” at 1 MB.', 'Check the sizes in the list.', 'Download one by one, as a ZIP, or into a folder.'],
    faq: [
      { q: 'Will a 1 MB photo look the same as the original?', a: 'It kept its full size in the example above: 3200 × 2126 pixels at quality 80, the slider’s default, which already fitted.' },
      { q: 'Can I compress several photos to under 1 MB each?', a: 'Yes. Each file in a batch is brought under the limit on its own, and the whole set can be saved as one ZIP.' },
      { q: 'Does the page keep PNG as PNG?', a: 'By default each file keeps its own format. For a photo saved as PNG, choose JPEG or WebP under Output format: a size limit is reached far more easily that way.' }
    ],
    example: { files: ['landscape-camera.jpg'], text: 'A landscape enlarged to 3200 × 2126 and saved at quality 98 was a JPG of {in}. Set to 1 MB it came out at {out}, {dims} at JPEG quality {q}.' }
  })
];

/* ------------------------------------------------------------------ */
/* PDF size targets: compress-pdf's ?kb=                              */
/* ------------------------------------------------------------------ */

const PDF_SIZE = 'Compress a PDF to a size';
function pdfSize(o) {
  return Object.assign({
    section: 'pdf', tool: PDF_COMPRESS, group: PDF_SIZE, eyebrow: 'Compress PDF',
    preset: { kb: String(o.kb) },
    presetNote: '“A size I choose”, aiming for under ' + o.label + '.',
    h1: 'Compress PDF to ' + o.label,
    pageTitle: 'Compress PDF to ' + o.label + ' — Free, In Your Browser | 1234Tools',
    stepsTitle: 'How to get a PDF under ' + o.label,
    keywords: ['compress pdf to ' + o.label.toLowerCase().replace(' ', ''), 'compress pdf to ' + o.label.toLowerCase(), 'reduce pdf size to ' + o.label.toLowerCase(), 'pdf under ' + o.label.toLowerCase()],
    io: 'PDF → under ' + o.label
  }, o, { example: Object.assign({ date: DATE, shown: rec(o.slug) }, o.example) });
}

const PDF_SIZES = [
  pdfSize({
    slug: 'compress-pdf-to-100kb', kb: 100, label: '100 KB',
    description: 'Shrink a scanned PDF under 100 KB for a form that demands it, in your browser. Pictures scaled down step by step until it fits; text kept sharp.',
    lede: 'Some portals accept a document only under 100 KB. The PDF compressor below is set to aim for that, stepping its pictures down until the file fits.',
    answer: { h: 'What it takes to reach 100 KB', paras: [
      'A PDF of a few scanned or photographed pages is mostly picture data. To reach 100 KB the page re-encodes those pictures at lower resolutions and JPEG qualities, from 150 DPI down to 36 DPI at the lowest, and stops at the first step that fits.',
      'At 36 DPI a full-page photo is soft. If even that is too big, the page says so and keeps the smallest version: split the document, or scan in black and white, and try again.'
    ] },
    steps: ['Choose the PDF.', 'Check that “How small” reads “A size I choose” and the KB box says 100.', 'Press Compress PDF and watch the steps it tries.', 'Download the smaller PDF, and open it to check it is legible.'],
    faq: [
      { q: 'Will the text in my PDF go blurry?', a: 'Real text, typed or exported from a program, stays sharp at any setting: only pictures are re-encoded. Text that is itself a photograph, as in a scan, softens with the picture.' },
      { q: 'What if the PDF cannot reach 100 KB?', a: 'The page keeps the smallest result and tells you how far it got and whether pictures or text make up what is left.' },
      { q: 'Is 100 KB counted the way the portal counts it?', a: 'It is 100,000 bytes, so the file is under the limit whether the portal counts a kilobyte as 1,000 or 1,024 bytes.' }
    ],
    example: { files: ['photos-4.pdf'], text: 'A four-page PDF of photographs, one 1600-pixel photo per A4 page and {in} in all, came out at {out} with {settings}.' }
  }),
  pdfSize({
    slug: 'compress-pdf-to-200kb', kb: 200, label: '200 KB',
    description: 'Compress a PDF to under 200 KB in your browser for job, visa and university applications. Text untouched, pictures resampled until it fits.',
    lede: 'Two hundred kilobytes is a common limit for certificates and ID scans on application sites. The compressor is set to aim for it.',
    answer: { h: 'Why 200 KB is reachable for most scans', paras: [
      'A certificate or ID scanned at 300 DPI carries far more pixels than a screen shows. Scaled to 96 or 120 DPI and saved as a JPEG of moderate quality, a page usually stays readable and drops well under 200 KB.',
      'Typed text, vector drawings, form fields, bookmarks and links are carried across untouched; only pictures change, and each is replaced only when its new version is smaller.'
    ] },
    steps: ['Choose the scanned PDF.', 'Make sure “A size I choose” is set to 200 KB.', 'Press Compress PDF.', 'Download it and check the smallest print is still legible.'],
    faq: [
      { q: 'Can I see which resolution it used?', a: 'Yes. The results list the resolution and quality of the step that fitted, the number of pictures re-encoded, and the size before and after.' },
      { q: 'My PDF is already under 200 KB. What happens?', a: 'The first step is tried anyway; if it is not smaller than your file there is nothing to download, and the page says the PDF is already compact.' },
      { q: 'Are bookmarks and form fields kept?', a: 'Yes. The document is rewritten page by page with the same engine the merge and split tools use, which carries them across.' }
    ],
    example: { files: ['scan-2.pdf'], text: 'A two-page PDF holding a photographed document and a group photo, {in} in all, was brought down to {out}, using {settings}.' }
  }),
  pdfSize({
    slug: 'compress-pdf-to-1mb', kb: 1000, label: '1 MB',
    description: 'Compress a PDF to under 1 MB in your browser: photos resampled only as far as needed, text and links left alone. No upload.',
    lede: 'A one-megabyte limit is common on support portals and older email systems. The compressor tries gentle settings first and stops as soon as the file fits.',
    answer: { h: 'Gentle first, then smaller', paras: [
      'The page starts at 150 DPI and JPEG quality 72, which keeps photos looking good on screen and in an office print, and steps down only if the file is still over 1 MB.',
      'Reports and brochures full of photographs often get under 1 MB at the first or second step. A file that is mostly text may already be small; the results say how much of what is left is pictures.'
    ] },
    steps: ['Choose the PDF.', 'Leave the target at 1 MB, which is 1,000 KB.', 'Press Compress PDF.', 'Download the result.'],
    faq: [
      { q: 'Is 1 MB here 1,000 or 1,024 KB?', a: 'It is 1,000,000 bytes, a little under a binary megabyte, so the file passes either kind of limit.' },
      { q: 'Will my photos still print well?', a: 'At 150 DPI, the first step, a photo prints acceptably at the size it has on the page. Lower steps are for screens.' },
      { q: 'Does it keep the document’s title and author?', a: 'Metadata is removed by default; choose “Keep it” under Metadata to carry it over.' }
    ],
    example: { files: ['photos-6.pdf'], text: 'A six-page photo report of {in}, each page an A4 sheet with one 1600-pixel photograph, came to {out} with {settings}.' }
  }),
  pdfSize({
    slug: 'compress-pdf-to-2mb', kb: 2000, label: '2 MB',
    description: 'Compress a PDF to under 2 MB for email attachments and uploads, in your browser. Pictures resampled only as much as needed.',
    lede: 'Two megabytes is a safe size to attach to almost any email. The compressor is set to aim for it and to stop at the gentlest setting that fits.',
    answer: { h: 'Getting a PDF under 2 MB for email', paras: [
      'Most mail services take attachments of 20 MB or more, but many inboxes, company filters and forms are stricter, and 2 MB passes nearly everywhere. Large PDFs are usually large because of photographs placed at camera resolution.',
      'Scaling those photos to the resolution they are printed at, 150 DPI to begin with, removes most of the weight without changing the layout. The results list how many pictures were re-encoded and what was left alone.'
    ] },
    steps: ['Choose the large PDF.', 'Check that the target reads 2,000 KB.', 'Press Compress PDF.', 'Attach the smaller file.'],
    faq: [
      { q: 'How is this different from the Email preset?', a: 'Both aim for 2 MB. This page uses “A size I choose”, which can step further down, to 36 DPI, if 72 DPI is not enough.' },
      { q: 'What if my PDF is mostly text?', a: 'Text and fonts compress very little. The page will tell you if what remains is mostly text and fonts, in which case splitting the file is the way to go.' },
      { q: 'Does anyone else see my PDF?', a: 'No. It is read and rewritten in a background worker inside this page; nothing is uploaded.' }
    ],
    example: { files: ['photos-hq-8.pdf'], text: 'An eight-page PDF of {in}, each page holding a 2400-pixel photograph saved at quality 95, came out at {out} with {settings}.' }
  })
];

/* ------------------------------------------------------------------ */
/* passport photo sizes, from the tool's own presets                  */
/* ------------------------------------------------------------------ */

function presets() {
  const box = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', '..', 'engine', 'img-passport-presets.js'), 'utf8'), box);
  return box.window.MVRPassportPresets;
}
const P = presets();
const byId = (id) => { const p = P.find((x) => x.id === id); if (!p) throw new Error('build/landing/data.js: no passport preset ' + id); return p; };
const px = (mm) => Math.round(mm / 25.4 * 300);
const mm = (v) => (Math.round(v * 10) / 10).toLocaleString('en-GB');
const inch = (v) => (Math.round(v / 25.4 * 100) / 100).toLocaleString('en-GB');
const headWords = (p) => p.head ? mm(p.head[0]) + ' to ' + mm(p.head[1]) + ' mm from chin to crown' : 'not published as a figure by the issuer; the tool frames the head at 70–80% of the photo’s height, the ICAO guide';
const sizeWords = (p) => mm(p.w) + ' × ' + mm(p.h) + ' mm';

const PASS = 'Passport photo by size';
const COUNTRY = 'Passport photo by country';

function passFacts(p) {
  return [
    ['Document', p.name.replace(/ \([^)]*\)$/, '')],
    ['Print size', sizeWords(p) + ' (' + inch(p.w) + ' × ' + inch(p.h) + ' in)'],
    ['Pixels at 300 DPI', px(p.w) + ' × ' + px(p.h)],
    ['Head size', headWords(p)],
    ['Background', p.bg],
    ['Source', p.source ? p.source.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : 'no single issuer', p.source || null]
  ];
}

function passSize(o) {
  const p = byId(o.presetId);
  return Object.assign({
    section: 'image', tool: PASSPORT, group: PASS, eyebrow: 'Passport photo maker',
    preset: { preset: p.id }, presetIsDefault: p.id === 'in-2x2',
    presetNote: p.name + ', ' + sizeWords(p) + ', with a 6 × 4 in print sheet.',
    stepsTitle: 'How to make a ' + o.short + ' photo',
    facts: passFacts(p),
    io: 'Photo → ' + o.short
  }, o, { example: Object.assign({ date: DATE, shown: rec(o.slug), files: ['passport.jpg'] }, o.example) });
}

const PASS_SIZES = [
  passSize({
    slug: 'passport-photo-35x45mm', presetId: 'icao', short: '35 × 45 mm',
    h1: 'Passport Photo 35 × 45 mm', pageTitle: 'Passport Photo 35x45 mm Maker — Free, On Your Device | 1234Tools',
    description: 'Make a 35 × 45 mm passport photo (413 × 531 px at 300 DPI) from your own picture, with the ICAO head guide and a 6 × 4 in print sheet.',
    lede: '35 × 45 mm is the passport photo size of the UK, the Schengen area, Australia and most of the world. Frame your picture to it below.',
    answer: { h: 'The 35 × 45 mm standard', paras: [
      'The size comes from ICAO Document 9303, the international guide for machine-readable passports, which asks for the head to fill 70 to 80 per cent of the photo’s height. At 300 DPI the photo is 413 pixels wide and 531 high.',
      'Countries agree on the frame but not on every detail: head height, background shade and whether glasses are allowed differ. If you are applying to one country, use its page below, which follows that issuer’s own figures.'
    ] },
    keywords: ['passport photo 35x45', '35x45 mm photo', '35 x 45 passport size photo', '3.5 x 4.5 cm photo'],
    steps: ['Choose a front-facing photo against a plain, light wall.', 'Press “Frame my face automatically”, or drag and zoom until the chin sits on the gold line.', 'Check the head between the dashed lines.', 'Download the photo and the 6 × 4 in sheet for a photo shop print.'],
    faq: [
      { q: 'How many pixels is a 35 × 45 mm photo?', a: 'At 300 DPI, the usual print resolution, 413 × 531 pixels. Online forms that ask for a 35 × 45 photo usually expect about that, or the same shape at a larger size.' },
      { q: 'Can I print the photo at home or in a shop?', a: 'Yes. The 6 × 4 in sheet is the standard photo print size any shop or kiosk prints, with copies laid out and cutting gaps between them; an A4 sheet is under Output for a home printer.' },
      { q: 'Is the background replaced?', a: 'Only if you ask: choose “Replace with the colour below” and the subject is cut out on your device with a small model, then put on the colour you pick.' }
    ],
    example: { text: 'A head-and-shoulders photo of 1200 × 1296 pixels, framed where the tool first placed it, became a 35 × 45 mm photo of {dims}, a JPEG of {out}, and a 6 × 4 in print sheet of {sheet}.' }
  }),
  passSize({
    slug: 'passport-photo-2x2-inch', presetId: 'us-passport', short: '2 × 2 in',
    h1: 'Passport Photo 2 × 2 Inch (US)', pageTitle: '2x2 Inch Passport Photo Maker — US Size, Free | 1234Tools',
    description: 'Make a 2 × 2 inch (51 × 51 mm) photo for a US passport or visa: 600 × 600 px, head 1 to 1⅜ in, on your device, with a print sheet.',
    lede: 'The United States asks for a square photo, two inches on each side. The maker below is set to the US passport guide.',
    answer: { h: 'The 2 × 2 inch photo', paras: [
      'The US State Department asks for a 2 × 2 inch photo with the head between 1 and 1⅜ inches from chin to crown, and the eyes between 1⅛ and 1⅜ inches above the bottom edge, against a plain white or off-white background.',
      'Digital uploads for a US passport renewal or a visa want a square JPEG of at least 600 × 600 pixels, which is exactly what this page saves at 300 DPI.'
    ] },
    keywords: ['2x2 photo', '2x2 inch passport photo', 'us passport photo', '600x600 photo'],
    steps: ['Choose a photo taken against a white or off-white wall.', 'Frame the face automatically or by hand to the guide lines.', 'Keep the background white or replace it.', 'Download the 600 × 600 photo, or the sheet to print.'],
    faq: [
      { q: 'Is a 2 × 2 inch photo 600 × 600 pixels?', a: 'At 300 DPI, yes: two inches times 300. The US online renewal asks for at least 600 × 600.' },
      { q: 'Can I use this for the US visa and green card too?', a: 'Yes. The tool also lists the US visa and the immigrant visa, which share the same size and head guide; choose them under Document if you prefer the name to match.' },
      { q: 'May I wear glasses?', a: 'Not in a US passport photo since 2016, unless a doctor’s note explains why. This page does not check that; it only frames the photo.' }
    ],
    example: { text: 'A 1200 × 1296 head-and-shoulders photo became a 2 × 2 inch photo of {dims}, a JPEG of {out}; the 6 × 4 in sheet for printing it was {sheet}.' }
  }),
  passSize({
    slug: 'passport-photo-51x51mm', presetId: 'in-2x2', short: '51 × 51 mm',
    h1: 'Passport Photo 51 × 51 mm', pageTitle: '51x51 mm Photo Maker — Indian Visa and OCI Size | 1234Tools',
    description: 'Make a 51 × 51 mm square photo for an Indian visa, OCI card or a passport applied for abroad: 602 × 602 px at 300 DPI, on your device.',
    lede: 'India asks for a square 51 × 51 mm photo for visas, OCI cards and passports applied for outside India. The maker is set to that guide.',
    answer: { h: '51 × 51 mm, the Indian square photo', paras: [
      'India’s e-visa and OCI guides ask for a square photo of 51 × 51 mm, the head between 25.4 and 34.9 mm tall, on a plain white or off-white background. It is the US 2 × 2 inch frame rounded to whole millimetres.',
      'At 300 DPI the photo is 602 pixels square. The online visa form also has a file size limit; set “Single photo under” to the figure it gives.'
    ] },
    keywords: ['51x51 mm photo', 'indian visa photo size', 'oci photo size', '5.1 x 5.1 cm photo'],
    steps: ['Choose a clear, front-facing photo.', 'Frame it automatically, or drag and zoom to the guide.', 'Set a KB limit if the visa site gives one.', 'Download the photo, or a sheet to print.'],
    faq: [
      { q: 'Is 51 × 51 mm the same as 2 × 2 inches?', a: 'Nearly: two inches is 50.8 mm. India writes it as 51 mm; the pixel size here is 602 rather than the US 600.' },
      { q: 'What size is an Indian passport photo inside India?', a: 'Passport Seva in India asks for 4.5 × 3.5 cm. That is a separate choice under Document, and its own page.' },
      { q: 'Can I print it on A4?', a: 'Yes: choose “Single photo + A4 sheet” under Output. Print at 100%, not “fit to page”, so each photo keeps its 51 mm sides.' }
    ],
    example: { text: 'Made from a 1200 × 1296 head-and-shoulders picture, the 51 × 51 mm photo came out at {dims}, a JPEG of {out}, with a 6 × 4 in sheet of {sheet}.' }
  })
];

/* One page per country whose photo differs from the plain 35 × 45 mm ICAO
   photo in something a reader must get right: its own size, its own head
   figure, its own background rule, or several documents. Countries whose
   preset says nothing the 35 × 45 mm page does not (Ireland, Italy, Belgium,
   Poland, Austria, Switzerland, Germany, Japan, New Zealand, the
   Philippines) are served by that page; a country whose preset is sourced to
   a home page waits for the owner's check. Each page's words are its own:
   `paras` and `tip` are written for it, and every generated sentence names
   the document, so no two pages share one. */
const COUNTRIES = [
  { key: 'uk', label: 'UK passport photo', ids: ['uk-passport'], place: 'the UK',
    paras: ['HM Passport Office asks for a head of 29 to 34 mm from chin to crown, a little smaller than the 32 to 36 mm many other countries use, so a photo framed for a Schengen visa can come out too tight for a British passport.',
      'The background must be plain cream or light grey. If the wall behind you is patterned, bright white or in shadow, let the tool replace it with a light grey.'],
    tip: { q: 'Which download do I need for an online UK application?', a: 'The single photo, as a JPEG. Choose “Single photo only” under Output and leave the print sheets out.' } },
  { key: 'india', label: 'Indian passport photo', ids: ['in-passport', 'in-2x2', 'in-pan'], place: 'India',
    paras: ['India uses three different photo sizes, and they are easy to mix up. Passport Seva, for a passport applied for inside India, wants 4.5 × 3.5 cm; the e-visa, the OCI card and a passport applied for at a mission abroad want a 51 × 51 mm square; a PAN card wants 25 × 35 mm.',
      'This page opens on the Passport Seva size. Switch Document to the square for OCI or a visa, or to PAN, and the frame and guide lines change with it.'],
    tip: { q: 'Which size for the OCI card?', a: 'The 51 × 51 mm square, which the tool lists as India visa / OCI / passport abroad. It has its own page too, Passport Photo 51 × 51 mm.' } },
  { key: 'schengen-visa', label: 'Schengen visa photo', ids: ['schengen'], place: 'the Schengen area',
    paras: ['Every Schengen state takes the same visa photo: 35 × 45 mm with the head 32 to 36 mm tall, as the European Commission’s visa page sets out. One photo serves an application to France, Germany, Italy, Spain or any other member.',
      'Embassies and visa centres usually want the photo printed and stuck to the form, so the 6 × 4 in sheet is the useful download here, ready for any photo printer.'],
    tip: { q: 'Is the Schengen photo the same as a German or French passport photo?', a: 'The frame and head height are the same; a French passport additionally refuses a white background. Those are separate choices under Document.' } },
  { key: 'france', label: 'French passport photo', ids: ['fr-passport'], place: 'France',
    paras: ['France asks for 35 × 45 mm with the head 32 to 36 mm tall, like most of Europe, but its background rule is unusual: plain and light, but not white.',
      'If your wall is white, choose “Replace with the colour below” and pick a pale grey or blue; the subject is cut out on your device before the colour goes in.'],
    tip: { q: 'Why is a white background refused for France?', a: 'The French rules ask for a light background that is not white, so the face stands out for the machine reading the photo. This page cannot judge that for you; it only lets you set the colour.' } },
  { key: 'spain', label: 'Spanish passport and DNI photo', ids: ['es-passport'], place: 'Spain',
    paras: ['Spain’s passport and DNI photo is smaller than most: 26 mm wide and 32 mm tall, on a plain white background.',
      'At 300 DPI that is 307 × 378 pixels. A 35 × 45 mm photo trimmed down will not do, because the head would be the wrong proportion of the frame.'],
    tip: { q: 'Is the DNI photo the same size as the passport photo?', a: 'Yes. The Spanish passport and the DNI identity card use the same 32 × 26 mm photo, which is the one this page makes.' } },
  { key: 'netherlands', label: 'Dutch passport photo', ids: ['nl-passport'], place: 'the Netherlands',
    paras: ['The Dutch government’s photo requirements put the head at 26 to 30 mm, smaller than the 32 to 36 mm common elsewhere, inside the usual 35 × 45 mm frame.',
      'Three backgrounds are accepted: plain light grey, light blue or white. The same photo is used for the passport and the identity card.'],
    tip: { q: 'Can a Dutch photo use a light blue background?', a: 'Yes, light blue is one of the three the Dutch page allows, with light grey and white. The tool’s background colour box takes any colour you type.' } },
  { key: 'turkey', label: 'Turkish passport and visa photo', ids: ['tr-passport'], place: 'Turkey',
    paras: ['Turkey asks for a large photo: 50 mm wide and 60 mm tall, on plain white, for passports and for visas issued by its consulates.',
      'That is 591 × 709 pixels at 300 DPI. If a consulate wants several printed copies, the A4 sheet under Output lays out more of them than a 6 × 4 in print.'],
    tip: { q: 'Is a 50 × 60 mm photo the same as a biometric 35 × 45?', a: 'No. The proportions differ, so a 35 × 45 photo enlarged would put too much space around the head. Make it at 50 × 60 here instead.' } },
  { key: 'canada', label: 'Canadian passport photo', ids: ['ca-passport', 'ca-visa'], place: 'Canada',
    paras: ['A Canadian passport photo is 50 × 70 mm, much taller than most, with the head 31 to 36 mm from chin to crown. A visa or permanent-resident card photo, by contrast, is the common 35 × 45 mm with the same head height.',
      'At 300 DPI the passport photo is 591 × 827 pixels. Choose the A4 sheet under Output when you want several printed copies of so tall a photo.'],
    tip: { q: 'Which Canadian photo is 35 × 45 mm?', a: 'The visa and the PR card photo. Choose Canada visa / PR card under Document and the frame changes to 35 × 45 mm.' } },
  { key: 'brazil', label: 'Brazilian passport photo', ids: ['br-passport'], place: 'Brazil',
    paras: ['Brazil’s Federal Police list a 5 × 7 cm photo on a plain white background for the passport.',
      'Brazil publishes no head height in millimetres, so the tool frames the head at 70 to 80 per cent of the 70 mm height, which is the ICAO guide, and calls its own measurement an estimate.'],
    tip: { q: 'Is 5 × 7 cm the same as 2 × 3 inches?', a: 'Close but not equal: 5 × 7 cm is 1.97 × 2.76 inches. Make it at 5 × 7 cm here rather than trimming a print made in inches.' } },
  { key: 'australia', label: 'Australian passport photo', ids: ['au-passport', 'au-visa'], place: 'Australia',
    paras: ['The Australian Passport Office accepts a photo 35 to 40 mm wide and 45 to 50 mm high, with the face 32 to 36 mm from chin to crown. This page makes the smallest allowed, 35 × 45 mm.',
      'Australian visas use the same 35 × 45 mm frame and head height, on a plain light background; both are under Document.'],
    tip: { q: 'Can the photo be bigger than 35 × 45 mm?', a: 'For an Australian passport, up to 40 × 50 mm. The tool makes 35 × 45, which is inside the range and fits more copies on a sheet.' } },
  { key: 'china-visa', label: 'Chinese visa photo', ids: ['cn-visa', 'cn-passport'], place: 'China',
    paras: ['China’s visa centres ask for a 33 × 48 mm photo, narrower and taller than most, with the head 28 to 33 mm tall on plain white.',
      'At 300 DPI the photo is 390 × 567 pixels. Use the guide lines: the space above the head counts as much as the head’s own height.'],
    tip: { q: 'Is a Chinese passport photo the same size?', a: 'The tool lists the Chinese passport at the same 33 × 48 mm; its source is a ministry home page, so check the current rules before you apply.' } },
  { key: 'hong-kong', label: 'Hong Kong passport photo', ids: ['hk-passport'], place: 'Hong Kong',
    paras: ['Hong Kong’s Immigration Department asks for a 40 × 50 mm photo on plain white, with the head 32 to 36 mm tall.',
      'The same photo is used for HKSAR passports and other travel documents. At 300 DPI it is 472 × 591 pixels.'],
    tip: { q: 'Can I use a 35 × 45 mm photo for Hong Kong?', a: 'No: Hong Kong’s frame is 40 × 50 mm, and a smaller photo would be refused. Make it at that size here.' } },
  { key: 'singapore', label: 'Singapore passport photo', ids: ['sg-passport'], place: 'Singapore',
    paras: ['Singapore’s ICA asks for 35 × 45 mm on plain white, with a head of 25 to 35 mm, a wider range than most countries allow.',
      'The same photo serves the passport and the identity card, at 413 × 531 pixels when saved at 300 DPI.'],
    tip: { q: 'Is the Singapore IC photo the same?', a: 'Yes, the tool lists the passport and the IC together, at 35 × 45 mm.' } }
];
const homePage = (u) => !u || /^https?:\/\/[^/]+\/?$/.test(u);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const domain = (u) => u.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

function country(c) {
  const docs = c.ids.map(byId);
  const p = docs[0];
  if (homePage(p.source)) throw new Error('build/landing/data.js: ' + c.key + ': the preset ' + p.id + ' is sourced to a home page; it waits for the owner’s check');
  const L = c.label, l = L.charAt(0).toLowerCase() + L.slice(1);
  const visa = /visa photo$/.test(L);
  return Object.assign(passSize({
    slug: c.key + (/visa$/.test(c.key) ? '' : '-passport') + '-photo', presetId: p.id, short: L.replace(/ photo$/, ''),
    group: COUNTRY,
    h1: L + ' (' + sizeWords(p) + ')',
    pageTitle: L + ' Size ' + mm(p.w) + 'x' + mm(p.h) + ' mm — Free Maker | 1234Tools',
    description: L + ': ' + sizeWords(p) + ', ' + px(p.w) + ' × ' + px(p.h) + ' px at 300 DPI, ' + p.bg + '. Framed to the guide on your device.',
    lede: 'A ' + l.replace(/^(a|an) /, '') + ' is ' + sizeWords(p) + ' on a ' + p.bg + ' background. The maker below opens set to the ' + p.name + ' guide.',
    answer: { h: 'The ' + l + ', in detail', paras: c.paras },
    keywords: [l, l + ' size', l.replace(/ photo$/, '') + ' photo requirements', mm(p.w) + 'x' + mm(p.h) + ' mm photo ' + c.place.replace(/^the /, '').toLowerCase()],
    stepsTitle: 'How to make a ' + l,
    steps: ['Take a photo facing the camera against a plain wall, or choose one you have.', 'Document is already set to ' + p.name + '.', 'Frame the face automatically, then check the head against the guide lines.', 'Download the single ' + l + ', or the sheet to print.'],
    faq: [
      { q: 'What size is a ' + l + '?', a: 'The ' + p.name + ' photo is ' + sizeWords(p) + ', which is ' + inch(p.w) + ' × ' + inch(p.h) + ' inches, or ' + px(p.w) + ' × ' + px(p.h) + ' pixels at 300 DPI.' },
      { q: 'Where do the ' + (visa ? 'visa' : c.place.replace(/^the /, '')) + ' figures on this page come from?', a: 'From ' + domain(p.source) + ', the issuer’s page linked in the table, as compiled for the tool on 6 October 2026. Rules change, so read that page before you apply for the ' + p.name + '.' },
      c.tip
    ],
    example: { text: 'The 1200 × 1296 test photo, set to the ' + p.name + ', came out at {dims}, a JPEG of {out}, with a 6 × 4 in print sheet of {sheet} for the ' + p.name + '.' }
  }), { presetIsDefault: p.id === 'in-2x2' });
}


/* ------------------------------------------------------------------ */
/* PDF pairs                                                          */
/* ------------------------------------------------------------------ */

const PDF_PAIR = 'Convert to or from PDF';
function pdfPair(o) {
  return Object.assign({ section: 'pdf', group: PDF_PAIR, stepsTitle: 'How to convert ' + o.a + ' to ' + o.b, h1: o.a + ' to ' + o.b, io: o.a + ' → ' + o.b,
    keywords: [o.a.toLowerCase() + ' to ' + o.b.toLowerCase(), 'convert ' + o.a.toLowerCase() + ' to ' + o.b.toLowerCase()] }, o,
  { example: Object.assign({ date: DATE, shown: rec(o.slug) }, o.example) });
}

const PDF_PAIRS = [
  pdfPair({
    slug: 'pdf-to-jpg', a: 'PDF', b: 'JPG', tool: PDF_IMAGES, eyebrow: 'PDF to images', preset: { format: 'jpg' },
    presetNote: 'every page as a JPG at 150 DPI, quality 90.',
    pageTitle: 'PDF to JPG Converter — Every Page as a JPG | 1234Tools',
    description: 'Convert each page of a PDF to a JPG image in your browser, at 72 to 600 DPI. All pages or a range; saved one by one or as a ZIP.',
    lede: 'Turn PDF pages into JPG pictures for a slide, a message or a website. The converter below draws each page and saves it as a JPG.',
    answer: { h: 'Choosing the resolution', paras: [
      'A PDF page has no pixels until it is drawn. At 150 DPI, the default, an A4 page becomes 1240 × 1754 pixels, sharp on a screen; 300 DPI doubles each side for printing, at four times the file size.',
      'JPG suits pages full of photographs. For pages of text and line drawings, PNG keeps letters crisp and is often no larger; that is the PDF to PNG page.'
    ] },
    steps: ['Choose the PDF.', 'Type a page range, or leave it at all.', 'Pick the resolution; the format is already JPG.', 'Press the button and save each page, or the ZIP.'],
    faq: [
      { q: 'How do I convert only one page?', a: 'Type its number in Pages, for example 3, or a range such as 2-4. The thumbnails show which pages are chosen.' },
      { q: 'Are the JPG files named after the PDF?', a: 'Yes, with the page number added, so a ten-page file gives ten names in order.' },
      { q: 'Can it read a password-protected PDF?', a: 'Yes, if you know the password: a box asks for it when you add the file, and the PDF is decrypted on your device.' }
    ],
    example: { files: ['photos-4.pdf'], text: 'The four-page A4 photo PDF ({in}) became {n} JPG files at 150 DPI, each {dims}, {total} in all.' }
  }),
  pdfPair({
    slug: 'pdf-to-png', a: 'PDF', b: 'PNG', tool: PDF_IMAGES, eyebrow: 'PDF to images', preset: { format: 'png' }, presetIsDefault: true,
    presetNote: 'every page as a lossless PNG at 150 DPI.',
    pageTitle: 'PDF to PNG Converter — Sharp Page Images | 1234Tools',
    description: 'Convert PDF pages to lossless PNG images in your browser: crisp text and lines, 72 to 600 DPI, any range of pages, nothing uploaded.',
    lede: 'PNG keeps every pixel of a drawn page, so text, tables and diagrams stay crisp. The converter is set to save each page as PNG.',
    answer: { h: 'When PNG beats JPG for PDF pages', paras: [
      'Letters and thin lines have hard edges, and JPG smears hard edges into a faint haze. PNG stores the drawn page exactly, which is why it is the right choice for documents, invoices, charts and slides.',
      'For a page that is one big photograph, PNG files get large; the example below shows how large. Switch the format to JPEG for those.'
    ] },
    steps: ['Choose the PDF.', 'Pick the pages and the resolution.', 'Keep the format at PNG.', 'Press the button and save the images.'],
    faq: [
      { q: 'Is the PNG background transparent?', a: 'No. The page is drawn on white, as it looks in a reader, so the PNG is opaque.' },
      { q: 'Which resolution should I use for a slide?', a: 'A slide is about 1920 pixels wide; an A4 page at 150 DPI is 1240 wide and at 300 DPI 2480, so pick 300 for a full-width slide.' },
      { q: 'Why are the PNG files so big?', a: 'Because they keep every pixel. Pages of photographs, like the example, are better as JPG; pages of text come out much smaller.' }
    ],
    related: ['pdf-to-jpg'],
    example: { files: ['photos-4.pdf'], text: 'The same four-page photo PDF ({in}) became {n} PNG files at 150 DPI, each {dims}, {total} in all: much larger than as JPG, because the pages are photographs.' }
  }),
  pdfPair({
    slug: 'jpg-to-pdf', a: 'JPG', b: 'PDF', tool: IMAGE_PDF, eyebrow: 'Image to PDF', preset: { jpeg: 'keep', pageSize: 'a4' }, presetIsDefault: true,
    presetNote: 'JPG photos placed on A4 pages untouched, without re-encoding.',
    pageTitle: 'JPG to PDF Converter — Photos into One PDF | 1234Tools',
    description: 'Combine JPG photos into one PDF in your browser, each placed untouched on an A4 page, in the order you choose. No upload, no watermark.',
    lede: 'Put receipts, scans and photos into one PDF to send or print. The page is set to place each JPG on an A4 page without re-encoding it.',
    answer: { h: 'Why the photos are not re-encoded', paras: [
      'A PDF can carry a JPG exactly as it is, so the default here is to copy each photo’s own bytes into the PDF. Nothing is lost, and the PDF is about the size of the photos added together.',
      'If the PDF must be smaller, change “JPEG photos” to re-encode at a lower quality, or run the finished PDF through the compressor with a size target.'
    ] },
    steps: ['Choose the JPG files.', 'Drag the pages into order, and turn any that are sideways.', 'Pick A4, Letter or a page the size of each photo.', 'Name the file and download the PDF.'],
    faq: [
      { q: 'Will the PDF be bigger than the photos?', a: 'Only by a few kilobytes of PDF structure, because the photos are copied in unchanged; the example above shows the figures.' },
      { q: 'Can I mix JPG and PNG?', a: 'Yes. PNG, GIF and BMP pictures are stored losslessly; JPGs are copied as they are.' },
      { q: 'Can the page be the size of the photo?', a: 'Choose “Fit to image” under Page size, and each page takes its photo’s own proportions.' }
    ],
    example: { files: ['food.jpg', 'street.jpg'], text: 'Two photographs, {in} together, became a two-page A4 PDF of {out}.' }
  })
];

const PAGES = [].concat(PAIRS, SIZES, PASS_SIZES, COUNTRIES.map(country), PDF_SIZES, PDF_PAIRS);

/* the hub blocks: a heading and a line, and where on the hub they go */
const HUBS = {
  image: { h: 'Ready-made for one job', p: 'The tools above, opened already set for a common job: one format to another, a size limit, or a passport photo size.' },
  pdf: { h: 'Ready-made for one job', p: 'Each of these opens a PDF tool already set for one common job: a size to get under, or one format to another.', before: '<section class="panel"><h2>What these tools deliberately will not do</h2>' }
};

module.exports = { PAGES, HUBS, DATE };
