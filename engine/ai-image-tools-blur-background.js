/**
 * Blur Background (Portrait Mode), as a spec.
 *
 * build-ai-image.js reads this file in Node to write the page, the hub card,
 * the search-index row and the sitemap line; the page itself loads the
 * `scripts` listed, never this file.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['blur-background'] = {
    order: 4,
    title: 'Blur Background (Portrait Mode)',
    pageTitle: 'Blur Background — Portrait Mode for Any Photo, Offline | 1234Tools',
    description: 'Blur the background of a photo and keep the subject sharp: bokeh, motion streaks or zoom blur that grows with distance, like portrait mode. Nothing is uploaded.',
    keywords: ['blur background', 'portrait mode online', 'bokeh effect online', 'blur photo background free',
      'motion blur behind subject', 'depth blur photo', 'blur background keep subject sharp', 'speed effect photo'],
    glyph: 'i-ai-blur-background',
    glyphSvg: '<symbol id="i-ai-blur-background" viewBox="0 0 24 24">\n  <circle cx="10" cy="9" r="3.2"/>\n  <path d="M4.2 20.5a5.8 5.8 0 0 1 11.6 0z"/>\n  <circle cx="18" cy="6.5" r="1.7" class="thin"/>\n  <circle cx="19.6" cy="12.6" r="1.2" class="thin"/>\n  <path d="M3.5 4.5h3M3.5 8h1.6" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-depth.js', '/engine/aiimg-blur-background.js'],
    privacy: 'Your photo never leaves your device. Two small AI models are served from this site and kept by your browser after the first visit: EfficientViT-Seg B1 (18 MB, Apache-2.0), which finds the people and objects to keep sharp, and Depth Anything V2 Small (26 MB, Apache-2.0), which judges how far away everything is. The runtime that executes them is served from here too; no third-party server is contacted at all. The blur is drawn and the result encoded by your own browser. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: {
      name: 'Depth Anything V2 Small', file: '/engine/models/depth-anything-v2-small-uint8.onnx', bytes: 27258801, licence: 'Apache-2.0',
      source: 'https://github.com/DepthAnything/Depth-Anything-V2',
      converted: 'onnx-community/depth-anything-v2-small onnx/model_quantized.onnx (uint8 dynamic quantisation), unmodified; see engine/models/README-depth-anything-v2-small.txt'
    },
    models: [
      { name: 'EfficientViT-Seg B1', file: '/engine/models/efficientvit-seg-b1-ade20k.onnx', bytes: 19317241, licence: 'Apache-2.0' },
      { name: 'Depth Anything V2 Small', file: '/engine/models/depth-anything-v2-small-uint8.onnx', bytes: 27258801, licence: 'Apache-2.0' }
    ],
    how: [
      'Choose a photo. A clear subject a few steps in front of its background — a person, a pet, a product — gives the most convincing result.',
      'On your device, one model finds the people and objects in the picture and another estimates how far away every pixel is. Both run through WebAssembly inside your browser; nothing is sent anywhere.',
      'The background is blurred by distance: the further a pixel sits from the point of focus, the softer it becomes, like the shallow depth of field of a large lens. Ticked layers — People by default — stay sharp whatever their depth.',
      'Tap anywhere on the preview to focus there, then set the strength, the depth of field and the style: soft bokeh, motion streaks for a speed effect, or a zoom blur that rushes outwards from the subject. Drag the divider to compare with the original.',
      'Export a PNG or JPEG at full size, or a four-second before-and-after clip as MP4 or GIF for a story or a Reel.'
    ],
    uses: [
      ['Portraits from a phone', 'The soft, falling-away background of a portrait lens, without the lens. Tap the face to focus and keep the strength moderate.'],
      ['Reels, TikTok and Shorts', 'The before-and-after wipe clip is the whole post: one tap on the subject, export the four-second MP4, done.'],
      ['Product shots', 'A product sharp against a softened room reads as a studio photo. Untick People if someone is holding it and you want only the product crisp.'],
      ['Cars, bikes and runners', 'Motion streaks behind a sharp subject give the panning-shot look that normally needs a tripod and a lot of luck.'],
      ['Estate agents and interiors', 'Zoom blur draws the eye to the feature you want noticed — the fireplace, the view — and quietens the clutter around it.'],
      ['Travel photos', 'Soften a crowded background so the person in front of the landmark is the picture.']
    ],
    tips: [
      'A subject that stands clear of the background — a step or two in front of it — blurs most convincingly. The model estimates relative distance, so a person leaning on the wall behind them will share its depth.',
      'Tap to focus on the subject’s face or on the nearest part of the object, not on the background. Depth of field widens the band that stays sharp around that point.',
      'If a halo of sharp background clings to the subject, raise Edge feather a step or two; if hair or thin straps are being blurred away, lower it and grow the cut by one step.',
      'Glass, mirrors, water and the sky confuse depth estimation: reflections look near and a plain sky has no texture to judge. Check those areas and lower the strength if they look wrong.',
      'Motion streaks look best short, with the angle matching the direction the subject is moving. For zoom blur, focus on the subject so the streaks radiate from it.',
      'Export the still at the original size for print; the clip is for sharing, and 1080 px is plenty for a story.'
    ],
    faq: [
      { q: 'Is my photo uploaded?',
        a: 'No. Two models are downloaded once from this site and kept by your browser: EfficientViT-Seg B1 (18 MB, Apache-2.0), which finds people and objects, and Depth Anything V2 Small (26 MB, Apache-2.0), which estimates distance. The runtime that runs them comes from here as well. Your picture is read, analysed, blurred and encoded on your own device; no third-party server is contacted, and there is no account and no watermark.' },
      { q: 'How does it know what is near and what is far?',
        a: 'A monocular depth network — Depth Anything V2, trained on tens of millions of images — predicts the relative distance of every pixel from a single photo, the way you can judge depth with one eye closed. It is relative, not measured: it knows the wall is behind the person, not that it is three metres away. It can be wrong on reflections, glass, water, a featureless sky and repeating patterns, which is why there is tap-to-focus and a depth of field control rather than one automatic result.' },
      { q: 'How is this different from a plain blur with a cut-out?',
        a: 'A plain blur softens everything outside the subject by the same amount, which looks like a sticker on a blurry card. Here the blur grows with distance from the focus point — the floor just behind the subject is barely touched and the far wall is very soft — which is what a real lens does, and the subject layer is kept sharp on top so no blur bleeds into it.' },
      { q: 'Why is the subject not sharp, or the wrong thing sharp?',
        a: 'Open Keep sharp and tick the layer you want — People, Cars, Animals and so on — or untick one that should blur. Then tap the subject on the preview to put the focus on it. If a fringe of hair is blurred, lower Edge feather or grow the cut by a step; if background sticks to the edge, raise Edge feather.' },
      { q: 'Can I use the result commercially?',
        a: 'Yes. The output is yours. Both models are published under the Apache-2.0 licence — EfficientViT-Seg by the MIT HAN Lab and Depth Anything V2 Small by its authors — and nothing we make adds a watermark or a credit.' },
      { q: 'Why is the first run slow, and how big is the download?',
        a: 'The first use downloads the depth model (26 MB), the segmentation model (18 MB) and the 14 MB runtime, all from this site, and your browser keeps them. After that a photo takes a few seconds: the depth estimate is the slowest step, and it runs on your processor through WebAssembly. The tools in this section share the same downloads.' },
      { q: 'What can I export?',
        a: 'A still as PNG or JPEG at up to the original resolution (4,096 px on the long edge), and a four-second before-and-after clip — a divider wipes from the original to the result and back — as H.264 MP4 or animated GIF, at 480 to 1,920 px.' },
      { q: 'Why did I get a WebM instead of an MP4?',
        a: 'MP4 is encoded on the device with the browser’s WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the clip is recorded as WebM, which every browser and most apps play. Convert it if a site insists on MP4, or use Chrome or Edge.' },
      { q: 'Does it work on a phone?',
        a: 'Yes, in Safari on iOS and Chrome on Android. Expect the depth step to take longer than on a laptop, and export clips at 720 px or under to keep encoding quick.' }
    ],
    related: ['/image/photo-filters/', '/image/background-remover/', '/image/social-media-resizer/', '/image/image-cropper/', '/image/image-compressor/']
  };
})();
