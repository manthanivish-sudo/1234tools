/**
 * Object & People Remover — the spec.
 *
 * build-ai-image.js reads this beside engine/ai-image-tools.js to write the
 * page, the hub card, the search-index row and the sitemap line. The page
 * loads the `scripts` listed, never this file.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['object-remover'] = {
    order: 6,
    title: 'Object & People Remover',
    pageTitle: 'Magic Eraser — Remove Objects and People From Photos | 1234Tools',
    description: 'Brush over a person, car, bin or cable and it is gone, filled in by AI running in your browser — nothing is uploaded. One tap removes every person in the shot.',
    keywords: ['magic eraser', 'remove object from photo', 'remove people from photo', 'photo cleanup', 'remove tourists from photo',
      'object remover free', 'inpainting online', 'remove unwanted objects'],
    glyph: 'i-ai-eraser',
    glyphSvg: '<symbol id="i-ai-eraser" viewBox="0 0 24 24">\n  <path d="M13.6 3.9l6.5 6.5-8.4 8.4H8.2l-4.6-4.6z"/>\n  <path d="M8.3 9.2l6.5 6.5" class="thin"/>\n  <path d="M3 20.5h18" class="thin"/>\n  <circle cx="18.6" cy="17.4" r="1.1" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-object-remover.js'],
    privacy: 'Your photo never leaves your device. Two models are served from this site and kept by your browser after the first visit: EfficientViT-Seg B1 (18 MB, Apache-2.0), which finds the people and objects for the one-tap buttons, and MI-GAN (28 MB, MIT), which paints the gap. No third-party server is contacted at all. Brushing, filling and saving happen in your own browser; nothing is uploaded, queued or logged, and there is no watermark.',
    model: {
      name: 'MI-GAN 512 (Places2)',
      file: '/engine/models/migan-512-places2.onnx',
      bytes: 28037335,
      licence: 'MIT',
      source: 'https://github.com/Picsart-AI-Research/MI-GAN',
      converted: 'build/ai-image/export-migan.py'
    },
    how: [
      'Choose a photo. It is opened on your device and, if it is larger than 2,048 pixels on the long edge, worked on at that size.',
      'Mark what should go. Paint over it with the brush, or use a one-tap button: "Remove all people" takes every person the AI found, and there is a button for each kind of object it saw — cars, bicycles, signs, bins. Grow the selection a little so the edge of the object is covered too, and add shadows if there are any.',
      'Press Remove. A square of the picture around the selection is handed to the inpainting network, which paints the gap from what surrounds it; a large selection is filled in overlapping tiles after a coarse first pass that sees the whole frame. The fill is pasted back only where you painted, with a soft edge.',
      'The result becomes the working picture, so you can brush again for the next object. Drag the divider on the preview to compare before and after, or go back to the original at any time.',
      'Save a PNG or JPEG at the working resolution, or a four-second before-and-after wipe as MP4 or GIF.'
    ],
    uses: [
      ['Holiday photos', 'The stranger who walked into the frame, the crowd at the railing, the coach parked in front of the cathedral. One tap on "Remove all people", then a brush for the stragglers.'],
      ['Property and rental listings', 'Cables, wheelie bins, the neighbour’s car, a wet patch on the drive. Clean exteriors photograph better and sell faster.'],
      ['Group shots', 'The person who left the company, or the ex, out of an otherwise good group photo — most convincing against a plain or textured background.'],
      ['Product photos for a listing', 'A price sticker, a brand mark, a reflection or a stray hand holding the item. Marketplace listings look like catalogue shots.'],
      ['Street and travel photography', 'Bins, bollards, road signs and lamp posts that cut across an otherwise clean composition.'],
      ['Social posts', 'A clutter-free kitchen, desk or background before the picture goes up.']
    ],
    tips: [
      'Brush slightly beyond the edge of the object. A fringe of the old object left behind is the most common reason a removal looks wrong; the "Grow" slider does this for the one-tap selections.',
      'Remove the shadow with the object. A person with no body but a sharp shadow on the pavement gives the game away; tick "Include shadows" or brush it in.',
      'Big areas look smeary. The network has to invent everything inside the selection, so a hole that is half the picture becomes a blur. Remove a large object in two or three smaller passes, letting each fill become the context for the next.',
      'Backgrounds with texture or repetition — grass, sand, sky, brick, a hedge, a tiled floor — fill almost invisibly. Straight lines that cross the hole, such as a kerb or a window frame, are harder; keep the brush tight so the line only has to bridge a short gap.',
      'Use the eraser mode of the brush to take back part of a selection before you press Remove, and Undo if a stroke went wrong.',
      'After a removal, drag the divider on the preview across the filled area. If a patch looks off, brush over just that patch and remove again — a small second pass usually fixes it.',
      'The one-tap buttons only know what the segmentation model labelled, and it is not infallible: a cyclist is often read as a bicycle rather than a person, so "Remove all people" can leave the rider standing. Brush over anything a button missed — the brush does not need a label.'
    ],
    faq: [
      { q: 'Is my photo uploaded?',
        a: 'No. Two models are downloaded once from 1234tools.com itself and kept by your browser: EfficientViT-Seg B1 (18 MB, Apache-2.0 licence) to find the people and objects for the one-tap buttons, and MI-GAN (28 MB, MIT licence) to paint the gap. The runtime that executes them is served from this site too. Your picture is read, brushed, filled and saved on your own device; no third-party server is contacted, we never see the photo, and there is no account and no watermark.' },
      { q: 'How does it fill the gap?',
        a: 'An inpainting network — MI-GAN, from Picsart AI Research, trained on the Places2 scene dataset — looks at the pixels around the hole and generates new ones that continue the textures, colours and lines it can see. It is a guess that fits the surroundings, not a photograph of what was behind the object; it cannot know that, and nothing can. On textured or repetitive backgrounds the guess is usually invisible.' },
      { q: 'Why does a large removal look smeared?',
        a: 'The network works on a 512-pixel square and has to invent every pixel inside the selection from what is left outside it. The bigger the hole relative to its surroundings, the less there is to continue, so it falls back to a soft average. This tool runs a coarse pass over the whole frame first and then refines each tile at full resolution, which helps a great deal on big photos, but a hole that covers half the picture will still look painted. Remove large objects in two or three smaller passes instead.' },
      { q: 'Can it remove text or a watermark?',
        a: 'It fills whatever you brush, so a date stamp or a stray caption on your own photo can be painted out. We do not offer watermark removal, and copyright marks on other people’s work must not be removed.' },
      { q: 'Can I use the result commercially?',
        a: 'Yes, for a photo you have the rights to. The output is yours and nothing is added to it. Both models are published under permissive licences — MI-GAN under MIT and EfficientViT-Seg under Apache-2.0 — and this site adds no watermark or credit.' },
      { q: 'Why is the first run slow, and how big is the download?',
        a: 'The first time, your browser downloads the inpainting model (28 MB) and the runtime (14 MB); using a one-tap button also fetches the segmentation model (18 MB). All three come from this site and are cached, so the next visit skips the download entirely. After that a single removal takes a second or two on a laptop and a few seconds on a phone; a large selection on a big photo is filled in several tiles and takes correspondingly longer. The progress bar shows how far it has got, and Cancel stops it.' },
      { q: 'What does "Remove all people" actually select?',
        a: 'Every pixel the segmentation model labelled as a person, snapped to the real edges of the picture, then grown by the margin you set so hair, hands and clothing edges are covered. Tick "Include shadows" to extend each selection downwards as well. If the model missed someone — very small or partly hidden figures sometimes — brush them in before pressing Remove.' },
      { q: 'What resolution does it work at?',
        a: 'Up to 2,048 pixels on the long edge. A larger photo is scaled down to that on opening, and the status line says so. Stills export at the working resolution as PNG or JPEG; the before-and-after clip exports at up to 1,080 pixels as MP4 or GIF.' },
      { q: 'Does it work on a phone?',
        a: 'Yes, in Safari on iOS and Chrome on Android. The models are downloaded once and cached. A big photo with a big selection is more work for a phone, so expect a longer wait there; the progress bar and Cancel button apply as they do on a laptop.' }
    ],
    related: ['/image/background-remover/', '/image/photo-filters/', '/image/image-cropper/', '/image/blur-redact/', '/image/image-compressor/']
  };
})();
