/**
 * AI Image Upscaler — the spec.
 *
 * Read by build-ai-image.js to write the page, the hub card, the search-index
 * row and the sitemap line; the page itself loads the `scripts` listed.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['image-upscaler'] = {
    order: 8,
    title: 'AI Image Upscaler',
    pageTitle: 'AI Image Upscaler — Upscale and Unblur Photos Offline | 1234Tools',
    description: 'Upscale a photo 2× or 4×, or unblur it at its own size, with Real-ESRGAN running in your browser. Nothing is uploaded. Before/after slider; PNG, JPEG or WebP.',
    keywords: ['image upscaler', 'upscale image', 'unblur image', 'enhance photo quality', 'ai upscaler free no upload',
      '4x upscale', 'increase image resolution', 'sharpen blurry photo'],
    glyph: 'i-ai-upscale',
    glyphSvg: '<symbol id="i-ai-upscale" viewBox="0 0 24 24">\n  <rect x="3" y="3" width="18" height="18" rx="2"/>\n  <path d="M7 12.5V17h4.5" class="thin"/>\n  <path d="M9.5 14.5l7-7M12 7.5h4.5V12"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-image-upscaler.js'],
    privacy: 'Your photo never leaves your device. The upscaling network — Real-ESRGAN general-x4v3, 4.7 MB, BSD-3-Clause licence — and the runtime that executes it are served from this site and kept by your browser after the first visit; no third-party server is contacted at all. The picture is cut into tiles, run through the network and reassembled by your own processor. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: {
      name: 'Real-ESRGAN general-x4v3',
      file: '/engine/models/realesr-general-x4v3.onnx',
      bytes: 4868039,
      licence: 'BSD-3-Clause',
      source: 'https://github.com/xinntao/Real-ESRGAN'
    },
    how: [
      'Choose a photo. Small, soft or compressed pictures gain the most: an old scan, a photo from a phone of ten years ago, a thumbnail saved from the web, a screenshot.',
      'Pick what you want: 4× for four times the width and height, 2× for a cleaner double, or Unblur to keep the size and only sharpen. Raise Denoise if the picture is grainy or heavily compressed.',
      'Press Upscale. The network is downloaded once (4.7 MB), then the picture is cut into tiles that run one by one on your device, with a progress bar and a time estimate after the first tile. Cancel at any point.',
      'Drag the divider on the result to compare before and after at the same size; switch to 1:1 to inspect the real pixels.',
      'Download as PNG for the sharpest file, or as JPEG or WebP for a smaller one.'
    ],
    uses: [
      ['Old family photos', 'A 600-pixel scan or a picture from a 2005 phone becomes big enough to print or to frame on a screen, with the softness taken out of it.'],
      ['Product photos for listings', 'Marketplaces reject small pictures. Upscale the one you have to 2,000 pixels or more, sharper than a plain resize would be.'],
      ['Screenshots for slides and documents', 'Interface text and icons stay crisp when a small capture is blown up for a presentation.'],
      ['Web images and thumbnails', 'When the only copy of a logo or a picture is a 300-pixel thumbnail, four times larger is usually enough to work with.'],
      ['Soft phone photos', 'Unblur keeps the size and sharpens what is there: edges firm up, compression blocks go away.']
    ],
    tips: [
      'Upscaling cannot invent detail. It sharpens and cleans what is there — edges, lines, textures. A face that is a blur of ten pixels stays a face you cannot name.',
      'JPEG artefacts get sharpened too. Give it the least-compressed copy you have, the original rather than a forwarded one, or raise Denoise, which trades a little texture for cleaner flat areas.',
      '2× is the 4× result reduced by half with a high-quality resample, which is why it is cleaner than a 2× network would be. Unblur is the same reduced to the original size.',
      'The time depends on the pixels going in, not coming out. A 1,000-pixel photo is about 50 tiles; above 2,000 pixels the photo is reduced first, and the tool says so when it does.',
      'Compare at 1:1. At the fitted size a 4,000-pixel result is shown shrunk, and most of what the network did is invisible. The divider works at either zoom.',
      'Save as PNG if you will edit the picture further; export JPEG at 90 or above if it is going straight to a listing or a message.'
    ],
    faq: [
      { q: 'Is my photo uploaded?',
        a: 'No. The model — Real-ESRGAN general-x4v3, 4.7 MB, published under the BSD-3-Clause licence — and the runtime that executes it are served from this site, fetched once and kept by your browser. No third-party server is contacted. The picture is tiled, processed and reassembled on your device, and we never see it. There is no account and no watermark.' },
      { q: 'What does Unblur actually do?',
        a: 'It runs the same 4× network and then reduces the result back to the original size with a high-quality resample. The network firms up edges and removes compression blocking; shrinking it again folds that into the original pixel grid, so the picture is the same size and visibly crisper. It is a sharpener that understands edges, not a deconvolution: strong motion blur or a badly missed focus does not come back.' },
      { q: 'Why does it take time, and what are the tiles?',
        a: 'The network looks at every pixel through 34 layers of convolutions — about 1.2 million multiplications per input pixel — on one processor core through WebAssembly. A 1,000-pixel photo is a million pixels, so it is cut into tiles of up to 160 pixels that run in turn; that keeps memory flat and lets the bar move and the Cancel button work. Tiles overlap by 16 pixels and are blended across the overlap, so there are no seams. Expect a second or two per tile on a laptop.' },
      { q: 'How big can the output be?',
        a: '4,000 pixels on the long edge. For 4× that means a photo of up to 1,000 pixels; for 2×, up to 2,000. Bigger inputs are reduced first and the tool says so. Unblur works at the original size up to 2,000 pixels.' },
      { q: 'Can I use the result commercially?',
        a: 'Yes. The output is yours to use however you may use the original. The network is Real-ESRGAN by Xintao Wang, published under the BSD-3-Clause licence, which permits commercial use; nothing we make adds a watermark or a credit.' },
      { q: 'What is Denoise?',
        a: 'A second set of weights for the same network, trained with noise and compression in the input — the "wdn" variant of Real-ESRGAN. At 0 the standard model runs; at 100 only the denoising one; in between, both run on each tile and the outputs are blended. The standard model keeps more texture and film grain; the denoising one gives cleaner skies, skin and flat colour from a grainy or heavily compressed original. It doubles the time when both run.' },
      { q: 'Which pictures gain the most?',
        a: 'Photographs of things with edges — buildings, products, cars, text, faces at a reasonable size — and anything that was saved small or compressed hard. Pictures that are already large and sharp gain little, and pure noise or heavy motion blur cannot be undone.' },
      { q: 'Does it work on a phone?',
        a: 'Yes, in Safari on iOS and Chrome on Android. The first run downloads the 4.7 MB model and the 14 MB runtime, after which both are cached. Phones are slower per tile and have less memory, so a 4× of a 1,000-pixel picture can take a few minutes there; 2× or Unblur of the same photo is the same work, so pick by the size you need.' }
    ],
    related: ['/image/image-compressor/', '/image/image-converter/', '/image/bulk-image-resizer/', '/image/photo-filters/']
  };
})();
