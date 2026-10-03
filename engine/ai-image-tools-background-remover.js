/**
 * AI Background Remover — the spec.
 *
 * build-ai-image.js reads this in Node to write the page, the hub card,
 * the search-index row and the sitemap line; the page loads `scripts`,
 * never this file.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['background-remover'] = {
    order: 1,
    title: 'AI Background Remover',
    pageTitle: 'Background Remover — Free, Private, In Your Browser | 1234Tools',
    description: 'Remove the background from any photo, or keep only the people, cars or sky. AI in your browser — nothing is uploaded. Transparent PNG or WebP, 20 at a time.',
    keywords: ['remove background', 'background remover', 'remove bg free', 'transparent background maker',
      'cut out person from photo', 'keep only the sky', 'remove background from product photo', 'background remover no upload'],
    glyph: 'i-ai-background-remover',
    glyphSvg: '<symbol id="i-ai-background-remover" viewBox="0 0 24 24">\n  <circle cx="12" cy="9" r="3.2"/>\n  <path d="M6.2 20.5a5.8 5.8 0 0 1 11.6 0z"/>\n  <path d="M3.5 4.5h3M3.5 8.5h1.5M20.5 4.5h-3M20.5 8.5h-1.5M3.5 13.5h2M20.5 13.5h-2" class="thin"/>\n  <path d="M4 17l-1.5 1.5M20 17l1.5 1.5" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-matte.js', '/engine/zip.js', '/engine/aiimg-background-remover.js'],
    privacy: 'Your photo never leaves your device. Two models run inside your browser through WebAssembly: EfficientViT-Seg (18 MB, Apache-2.0) finds the layers and MODNet (25 MB, Apache-2.0) draws the edges of people, hair included. Both, and the runtime that executes them, are served from this site and kept by your browser after the first visit; no third-party server is contacted at all. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: {
      name: 'MODNet, photographic portrait matting (with EfficientViT-Seg B1 from aiimg-core.js)',
      file: '/engine/models/modnet-photographic-portrait-matting.onnx',
      bytes: 25888640,
      licence: 'Apache-2.0',
      source: 'https://github.com/ZHKKKe/MODNet — ONNX from https://huggingface.co/Xenova/modnet (onnx/model.onnx, sha256 07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9)',
      converted: 'not re-exported: the Hub file byte for byte, fp32, opset 11; see engine/models/README-modnet.txt'
    },
    how: [
      'Choose a photo. The AI splits it into layers on your device — people, cars, bicycles, animals, buildings, sky, trees, road and more — and ticks the people and objects for you.',
      'Tick and untick layers to say what stays. Untick everything but Sky to keep only the sky; tick Buildings and untick People to keep the street and lose the crowd.',
      'For people, a second model (MODNet, a portrait matting network) redraws the edge strand by strand, so hair and loose threads survive instead of being traced as a blob. Set Show to Compare to see the two edges side by side on the same photo.',
      'Choose what goes behind: nothing (transparent), a colour, a two-colour gradient or the photo itself blurred. Pick a frame — the whole picture, 9:16 for a story, 1:1, 4:5 or 16:9 — and it is centred on what you kept.',
      'Download a PNG or WebP with real transparency. For a product range or a class photo, add up to 20 photos as a batch: each goes through the same settings and gets its own download, or take them all as one zip. The simple background remover under Image & Photo is quicker if your subject is already on a plain white wall.'
    ],
    uses: [
      ['Product photos', 'A phone photo of the thing on the kitchen table becomes the thing on white, or on the brand colour, in the shape the marketplace wants. Twenty at a time for a whole listing.'],
      ['Profile pictures and CVs', 'You, cut out cleanly, hair and all, on a plain colour — the photo a LinkedIn page or a CV wants, without a studio.'],
      ['Instagram and WhatsApp', 'A 9:16 story or a 4:5 post with the subject centred and the background swapped for a gradient, exported at full resolution.'],
      ['School projects and presentations', 'Cut-outs of a car, a building or an animal to drop onto a slide or a poster, with no fringe of the old background.'],
      ['Keeping only the sky', 'Untick everything but Sky and you have the sunset alone, transparent elsewhere, for a composite or a texture.'],
      ['Collages and mock-ups', 'Several people from several photos on one background, each a transparent PNG from one pass through the batch.']
    ],
    tips: [
      'Light the subject and let the background be a different colour or brightness: the layer model sees the picture at 512 pixels across, and a dark coat against a dark wall is hard for anyone.',
      'Open the compare view (Show: Compare) with a portrait: the left half is the layer mask alone, the right half the matted edge. If the right half looks no better, the portrait model did not find a person clearly — a closer, front-on photo helps.',
      'A halo of the old background around the subject goes with one step of "Grow or shrink the cut" towards shrink; a nibbled edge goes the other way. Edge softness 2–4 suits most photos, 5–7 suits fur.',
      'Detail: High or Maximum shows the model the picture at a higher resolution. It is worth it for small subjects, thin straps and railings; for a head-and-shoulders portrait, Standard is enough.',
      'Export PNG when the picture will be edited again or printed, WebP for the web — the same picture at half the size with the same transparency.',
      'For a batch, set the layers, background and frame on one typical photo first. Every photo in the batch keeps the same kinds of layer you ticked — People, Cars — and falls back to whatever subject it finds when those are absent.'
    ],
    faq: [
      { q: 'Is my photo uploaded?',
        a: 'No. The only downloads are the two models and the runtime, served from 1234tools.com itself: EfficientViT-Seg (18 MB, Apache-2.0) for the layers and MODNet (25 MB, Apache-2.0) for the edges of people, both fetched once and kept by your browser. No third-party server is contacted. Your picture is read, cut and encoded on your device; we never see it, and there is no account and no watermark.' },
      { q: 'How is this different from the simple background remover?',
        a: 'The simple one under Image & Photo samples the corners of the picture and removes everything of that colour. It is instant, ideal for a logo or a product on a plain wall, and useless for a person in a room. This one understands the picture: a segmentation network labels every pixel as a person, a car, sky, a building and so on, so you choose what to keep, and a matting network draws the edges of people properly. It needs a one-off download and a second or two per photo.' },
      { q: 'Why do hair edges look better for people than for pets?',
        a: 'Because the second model, MODNet, is a portrait matting network: it was trained on photographs of people and predicts a soft alpha for hair, strands and the edge of a shoulder. It is applied only where the layer model found a person. Fur on a cat or a dog gets the layer edge refined against the pixels, which follows the fur loosely but not strand by strand. Edge softness 5–7 helps with fur.' },
      { q: 'Can I use the results commercially?',
        a: 'Yes. The output is yours. Both models are published under the Apache-2.0 licence — EfficientViT-Seg by the MIT HAN Lab, MODNet by its authors — and nothing here adds a watermark or a credit.' },
      { q: 'Can I keep only the sky, or only the car?',
        a: 'Yes. Every layer the model finds has a tick. Untick People and tick Sky to keep the sky alone; tick Cars and nothing else for the car. A kept layer is cut at the model\'s boundary and refined against the real pixels of the photo, so it follows the edge of a bumper or a roofline.' },
      { q: 'What are the crops for?',
        a: 'A story or a Reel wants 9:16, Instagram\'s grid 1:1 or 4:5, a header 16:9. The frame is the largest rectangle of that shape that fits in the photo, centred on the layers you keep, and the export has exactly that shape at up to the original resolution.' },
      { q: 'How does the batch work, and why 20?',
        a: 'Add up to 20 photos and each goes through the same settings as the one on screen: the same kinds of layer kept, the same background, frame, format and size. Each result gets its own download, and "Download all" packs them into one zip. Twenty keeps the memory of a phone comfortable; run another batch for the next twenty.' },
      { q: 'The edge still looks wrong. What can I do?',
        a: 'Raise Edge softness for hair and fur, lower it for a crisp product edge. Grow or shrink the cut by a step to lose a halo or recover a fringe. Switch Detail to High for small subjects. For a person, make sure "Hair-quality edges for people" is on. A sharp, well-lit photo with the subject in focus always does better than a dim one.' },
      { q: 'Does it work on a phone?',
        a: 'Yes, in Safari on iOS and Chrome on Android. The first run downloads the models (43 MB together) and the runtime (14 MB); after that everything is cached. A photo takes a second or two; a batch of twenty, a minute or so.' }
    ],
    related: ['/image/background-remover/', '/image/circle-crop/', '/image/social-media-resizer/', '/image/image-converter/', '/image/image-compressor/', '/image/passport-photo/']
  };
})();
