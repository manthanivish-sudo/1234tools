/**
 * Colour Pop & Duotone — the spec. build-ai-image.js reads this file in
 * Node to write the page, the hub card, the search-index row and the
 * sitemap line; the page itself loads `scripts`, never this file.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['color-pop'] = {
    order: 3,
    title: 'Colour Pop & Duotone',
    pageTitle: 'Colour Pop — Keep One Colour, Black and White the Rest | 1234Tools',
    description: 'Keep one layer or one colour and turn the rest black and white, sepia or duotone. AI finds the layers in your browser; nothing is uploaded. PNG, MP4 or GIF.',
    keywords: ['color pop effect', 'colour pop', 'selective color', 'color splash effect', 'black and white with one color',
      'duotone photo effect', 'keep one colour in photo', 'selective colour online'],
    glyph: 'i-ai-color-pop',
    glyphSvg: '<symbol id="i-ai-color-pop" viewBox="0 0 24 24">\n  <path d="M12 3.2c3.3 4.1 5.4 7 5.4 9.9a5.4 5.4 0 0 1-10.8 0c0-2.9 2.1-5.8 5.4-9.9z"/>\n  <path d="M12 3.2c-3.3 4.1-5.4 7-5.4 9.9A5.4 5.4 0 0 0 12 18.5z" class="fill"/>\n  <path d="M4 21.3h16" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-color-pop.js'],
    privacy: 'Your photo never leaves your device. The AI model that finds the layers — EfficientViT-Seg B1, 18 MB, Apache-2.0, already used by the other tools here — and the runtime that executes it are served from this site and kept by your browser after the first visit; no third-party server is contacted at all. The greyscale, the duotone and the colour mask are computed, and the files encoded, by your own browser. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: { name: 'EfficientViT-Seg B1', file: '/engine/models/efficientvit-seg-b1-ade20k.onnx', bytes: 19317241, licence: 'Apache-2.0', source: 'https://github.com/mit-han-lab/efficientvit' },
    how: [
      'Choose a photo. One clear subject against a busier scene — a red car on a grey street, a person in a crowd, a flower in a field — is where the effect is strongest.',
      'The AI splits the picture into layers on your device: people, cars, sky, buildings, trees, road and more. The subject layers start in colour and everything else turns black and white. Tick or untick any layer to change what stays coloured.',
      'Pick what happens to the rest: greyscale, sepia, a faded film look, a colour tint or a two-colour duotone with its own dark and light colours and a mid-point. The kept layers can have a treatment of their own too, so the car can be colour while the street is teal and orange.',
      'To keep only one colour inside a layer — the red of the car but not its chrome and glass — switch on "Only one colour" and click one of the swatches the tool found in that layer, then widen or narrow the band and soften the edge.',
      'Export the still as PNG, JPEG or WebP at up to the original size, or a short reveal clip — the colour sweeps in, fades in or pulses — as MP4 or animated GIF.'
    ],
    uses: [
      ['Car dealers and detailers', 'The car in full colour on a monochrome forecourt. It reads as "this one", which is the whole point of a listing photo.'],
      ['Instagram and Reels', 'The classic selective-colour portrait, or the reveal clip in which the colour washes across the photo — a six-second loop that holds attention in a feed.'],
      ['Product shots', 'Keep the product in colour and turn the hand, table and props to a soft sepia. Nothing else needs retouching.'],
      ['Posters and album art', 'A teal and orange, noir or neon duotone over the whole frame, or a duotone background behind a full-colour subject, straight from a phone photo.'],
      ['Estate agents', 'A blue-sky pop for a listing where the house is nice but the street is not: keep the sky and the house, send the rest to black and white.']
    ],
    tips: [
      'The effect works best when the kept colour is rare in the rest of the frame. A red jacket in a park pops; a red jacket in a red brick street does not — use "Only one colour" with a narrow band instead and the bricks drop out of the band.',
      'If grey is creeping into the subject at its edge, raise Edge softness one step or grow the cut by one. If a halo of colour clings to the subject, shrink it.',
      'For duotone, the mid-point decides where the two colours meet: lower it for a dark, moody frame, raise it for a bright, washed one. Teal–orange (shadows teal, lights orange) is the cinema look; black–white at mid 0.5 is plain black and white with extra contrast.',
      'Sepia and Faded suit old streets and portraits; Greyscale suits anything with strong shapes. Try Tint with a cold blue for a night feel around a warm subject.',
      'The reveal clip is a loop: the sweep runs in the first half, holds, and the GIF or MP4 starts again. Four to six seconds and 640 px is plenty for a story; keep GIFs short, they are big.',
      'Detail: High gives the model a closer look and is worth the extra seconds on small subjects — a bicycle, a bottle, a child at the far side of the frame.'
    ],
    faq: [
      { q: 'Is my photo uploaded anywhere?',
        a: 'No. The only downloads are the model — EfficientViT-Seg B1, 18 MB, Apache-2.0 — and the runtime that runs it, both served from 1234tools.com and kept by your browser after the first visit. No third-party server is contacted. Your picture is read, split into layers, recoloured and encoded on your own device, and there is no account and no watermark.' },
      { q: 'How does it know which part is the car?',
        a: 'A semantic segmentation network trained on the ADE20K scene dataset labels every pixel as one of 150 kinds of thing — person, car, bicycle, sky, tree, building, road and so on. The boundary it draws is then refined against the real pixels of your photo with a guided filter, so it follows the edge of a door or a sleeve rather than a blob. You can tick any combination of layers to keep in colour.' },
      { q: 'What if the car is red but I want only the red, not the chrome and the windows?',
        a: 'Switch on "Only one colour" in the Colour pane. The tool finds the six main hues inside the kept layer and shows them as swatches; click one and only pixels within that band of hue (and above the saturation floor) keep their colour. Widen the band if parts of the paint drop out in shadow, narrow it if the brake lights are joining in.' },
      { q: 'What is a duotone?',
        a: 'Every pixel is mapped by its brightness to a colour between two you choose — dark shadows become one colour, bright highlights the other, with a mid-point control that decides where they meet. It is how the classic teal–orange poster, the noir print and the neon album cover are made. You can apply one duotone to the background and another, or full colour, to the subject.' },
      { q: 'Can I use the result commercially?',
        a: 'Yes. The output is yours. The model is EfficientViT-Seg from the MIT HAN Lab, published under the Apache-2.0 licence, and nothing we make adds a watermark or a credit. The photo itself must of course be one you have the right to use.' },
      { q: 'Why is the first run slow?',
        a: 'The first run on a device downloads the 18 MB model and the 14 MB runtime, then warms the runtime up. After that both come from your browser’s cache and a photo is split into layers in about a second on a laptop, a few seconds on a phone.' },
      { q: 'The edge around hair or a thin object looks rough. What helps?',
        a: 'Raise Edge softness so the cut follows fine detail; set Detail to High, which shows the model the picture at a higher resolution; and if a hand or a bag strap is still missing, tick the layer it was mistaken for — a bag is its own layer. A sharp, well-lit photo helps most.' },
      { q: 'What can I export?',
        a: 'A still as PNG, JPEG or WebP at up to the original resolution (4,096 px on the long edge), or the reveal clip as H.264 MP4 or animated GIF, 3 to 10 seconds, 480 to 1,920 px. In Firefox, which has no on-device MP4 encoder yet, the clip is recorded as WebM instead.' },
      { q: 'Does it work on a phone?',
        a: 'Yes, in Safari on iOS and Chrome on Android. Keep clip exports at 720 px or under on a phone; a still exports at full size anywhere.' }
    ],
    related: ['/image/photo-filters/', '/image/background-remover/', '/image/social-media-resizer/', '/image/image-cropper/', '/image/meme-generator/']
  };
})();
