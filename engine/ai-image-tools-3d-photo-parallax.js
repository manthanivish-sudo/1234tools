/**
 * 3D Photo Parallax Video, as a spec.
 *
 * build-ai-image.js reads this file in Node to write the page, the hub card,
 * the search-index row and the sitemap line; the page itself loads the
 * `scripts` listed, never this file.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['3d-photo-parallax'] = {
    order: 5,
    title: '3D Photo Parallax Video',
    pageTitle: '3D Photo Effect — Turn a Photo Into a Parallax Video | 1234Tools',
    description: 'Turn one still photo into a looping 3D parallax clip. AI depth runs in your browser — nothing is uploaded. Export a 6-second MP4 or GIF in 9:16, 1:1 or 16:9.',
    keywords: ['3d photo effect', 'parallax photo effect', '2.5d photo animation', '3d zoom effect online',
      'photo to video parallax', 'ken burns 3d', 'tiktok 3d photo trend', 'capcut 3d zoom alternative'],
    glyph: 'i-ai-3d-photo-parallax',
    glyphSvg: '<symbol id="i-ai-3d-photo-parallax" viewBox="0 0 24 24">\n  <rect x="3" y="6.5" width="13" height="14" rx="1.5"/>\n  <path d="M7.5 3.5h11.5a2 2 0 0 1 2 2v11.5" class="thin"/>\n  <path d="M5.5 17.5l3-3.6 2.4 2.4 2-2.2 2.6 3.4" class="thin"/>\n  <circle cx="12.3" cy="10.3" r="1.1" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-depth.js', '/engine/aiimg-3d-photo-parallax.js'],
    privacy: 'Your photo never leaves your device. Two small AI models are served from this site and kept by your browser after the first visit: Depth Anything V2 Small (26 MB, Apache-2.0), which estimates how far away every part of the picture is, and EfficientViT-Seg B1 (18 MB, Apache-2.0), which finds the subject to frame the clip around. The runtime that executes them is served from here too; no third-party server is contacted at all. The 3D scene is drawn by your own graphics chip through WebGL and the clip is encoded by your browser. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: {
      name: 'Depth Anything V2 Small', file: '/engine/models/depth-anything-v2-small-uint8.onnx', bytes: 27258801, licence: 'Apache-2.0',
      source: 'https://github.com/DepthAnything/Depth-Anything-V2',
      converted: 'onnx-community/depth-anything-v2-small onnx/model_quantized.onnx (uint8 dynamic quantisation), unmodified; see engine/models/README-depth-anything-v2-small.txt'
    },
    models: [
      { name: 'Depth Anything V2 Small', file: '/engine/models/depth-anything-v2-small-uint8.onnx', bytes: 27258801, licence: 'Apache-2.0' },
      { name: 'EfficientViT-Seg B1', file: '/engine/models/efficientvit-seg-b1-ade20k.onnx', bytes: 19317241, licence: 'Apache-2.0' }
    ],
    how: [
      'Choose a photo. For this tool the picture is worked on at up to 1,536 pixels on the long edge, which is more than a 1080p clip needs and keeps a phone comfortable.',
      'On your device a depth model estimates how far away every pixel is, and a second model finds the subject so the frame can be centred on it. Nothing is sent anywhere.',
      'The picture is laid over a fine mesh of about 30,000 points, each pushed towards or away from the camera by its depth, and a virtual camera moves around it. Near things shift more than far things — that parallax is what makes a flat photo read as 3D.',
      'Pick a camera move — sway, dolly zoom, circle, vertical drift or push-in with tilt — set the amount and speed, and choose the frame: 9:16 for Reels, TikTok and Shorts, 1:1 for a feed post, 16:9 for YouTube. The preview loops live.',
      'Export a six-second loop as MP4 at 1080×1920, 1080×1080 or 1920×1080, or as a GIF. The motion is a cycle, so the last frame leads straight back into the first.'
    ],
    uses: [
      ['Reels, TikTok and Shorts', 'The "3D photo" trend from a single picture: a 9:16 sway or push-in, six seconds, loopable, with no app subscription.'],
      ['Estate agents', 'A living room or a garden with a slow dolly feels like a walk-through rather than a listing photo.'],
      ['Travel photos', 'Mountains, streets and coastlines have real depth to work with: a circle move sends the foreground gliding past the view.'],
      ['Product shots', 'A product on a table with a gentle push-in reads as a filmed spot. Keep the amount low so the edges stay clean.'],
      ['Portraits', 'A person against a distant background is the ideal case: the sway separates them from it like a camera on a slider.'],
      ['Old photographs', 'Scanned family photos take on a quiet motion that suits a memorial or an anniversary montage.']
    ],
    tips: [
      'The best photos have a clear foreground, a middle distance and a background — a person on a path with hills behind. A flat wall has nothing to move.',
      'Keep the amount modest. Strong parallax stretches the pixels at depth edges; a little goes a long way, and the sway and circle moves hide stretching better than the dolly.',
      'Glass, mirrors, water and sky give the depth model trouble — reflections read as near and a plain sky as nothing at all. Raise Edge softening if those areas tear.',
      'Faces at the edge of the frame get pushed out by the crop. Choose the frame first and check the subject sits where you want it.',
      'A short clip loops better than a long one looks: six seconds at one cycle is the sweet spot for a story; two cycles feels busier.',
      'For a GIF keep the size to 480 or 560 px — a 720 px six-second GIF runs to many megabytes.'
    ],
    faq: [
      { q: 'Is my photo uploaded?',
        a: 'No. Two models are downloaded once from this site and kept by your browser: Depth Anything V2 Small (26 MB, Apache-2.0), which estimates distance, and EfficientViT-Seg B1 (18 MB, Apache-2.0), which finds the subject for framing. The runtime that runs them is served from here too. The 3D scene is drawn by your own device through WebGL and the clip is encoded in your browser; no third-party server is contacted, and there is no account and no watermark.' },
      { q: 'How does it know what is near and what is far?',
        a: 'A monocular depth network — Depth Anything V2, trained on tens of millions of images — predicts the relative distance of every pixel from a single photo, much as you can judge depth with one eye closed. It is relative, not measured. It can be wrong on reflections, glass, water, a featureless sky and repeating patterns, which is where the Edge softening control helps.' },
      { q: 'Why do edges smear or stretch in the video?',
        a: 'A single photo holds no picture of what was behind the subject. When the camera moves, the pixels along a depth edge have to cover the gap that opens up, so they stretch. This tool fills those gaps with a softened copy of the background instead of a hole, and Edge softening blends the stretched pixels into it. Small amounts and the sway, circle and drift moves show it least; a dolly shows it most.' },
      { q: 'Can I use the result commercially?',
        a: 'Yes. The clip is yours. Both models are published under the Apache-2.0 licence — Depth Anything V2 Small by its authors and EfficientViT-Seg by the MIT HAN Lab — and nothing we make adds a watermark or a credit.' },
      { q: 'Why is the first run slow, and how big is the download?',
        a: 'The first use downloads the depth model (26 MB), the segmentation model (18 MB) and the 14 MB runtime, all from this site, and your browser keeps them. After that, estimating depth takes a few seconds on your processor through WebAssembly; the clip itself is drawn by your graphics chip and encoded in a few more. The tools in this section share the same downloads.' },
      { q: 'Does it work on a phone?',
        a: 'Yes, in Safari on iOS and Chrome on Android — WebGL is on every current phone. The picture is worked on at up to 1,536 px on the long edge to keep memory in check. Export MP4 at 1080 on a recent phone; on an older one choose the 720 size.' },
      { q: 'What if WebGL is not available?',
        a: 'The tool falls back to a simpler version drawn on a plain canvas: the picture is sliced into a few depth bands that slide at different speeds. It is less smooth than the mesh but exports the same loop.' },
      { q: 'Why did I get a WebM instead of an MP4?',
        a: 'MP4 is encoded on the device with the browser’s WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the clip is recorded in real time as WebM, which every browser and most apps play. Convert it if a site insists on MP4, or use Chrome or Edge.' },
      { q: 'Will the loop be seamless?',
        a: 'Yes. Every camera move is a cycle that returns exactly to its start, and the clip holds a whole number of cycles, so when a player loops it the join is invisible.' }
    ],
    related: ['/image/photo-filters/', '/image/social-media-resizer/', '/image/image-cropper/', '/image/background-remover/', '/image/image-compressor/']
  };
})();
