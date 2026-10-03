/**
 * YouTube Thumbnail Maker — the spec. build-ai-image.js reads this file in
 * Node to write the page, the hub card, the search-index row and the
 * sitemap line; the page itself loads `scripts`, never this file.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['thumbnail-maker'] = {
    order: 10,
    title: 'YouTube Thumbnail Maker',
    pageTitle: 'YouTube Thumbnail Maker — Face Pop-Out and Glow | 1234Tools',
    description: 'Face cut out with a glow, background punched up, a bold title on top; export 1280×720 PNG or JPEG under 2 MB, three variants in one click. Nothing is uploaded.',
    keywords: ['youtube thumbnail maker', 'thumbnail face cutout', 'thumbnail background remover', 'glow outline thumbnail',
      'thumbnail maker free no watermark', '1280x720 thumbnail', 'pop out effect thumbnail'],
    glyph: 'i-ai-thumbnail-maker',
    glyphSvg: '<symbol id="i-ai-thumbnail-maker" viewBox="0 0 24 24">\n  <rect x="2.5" y="6.5" width="19" height="13" rx="2"/>\n  <circle cx="7.5" cy="6.2" r="2.5"/>\n  <path d="M3.5 14.5a4 4 0 0 1 8 0" class="thin"/>\n  <path d="M13.5 10.6v4.8l4-2.4z" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-thumbnail-maker.js'],
    privacy: 'Your photo never leaves your device. The AI model that cuts you out — EfficientViT-Seg B1, 18 MB, Apache-2.0, already used by the other tools here — and the runtime that executes it are served from this site and kept by your browser after the first visit; no third-party server is contacted at all. The glow, the background, the title and the three variants are drawn and encoded by your own browser. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: { name: 'EfficientViT-Seg B1', file: '/engine/models/efficientvit-seg-b1-ade20k.onnx', bytes: 19317241, licence: 'Apache-2.0', source: 'https://github.com/mit-han-lab/efficientvit' },
    how: [
      'Choose a photo of yourself, a product or anything with a clear subject. Any shape works: the frame is cropped to 16:9 around the subject, and the subject is cut out as its own layer.',
      'The AI finds the people in the picture on your device and cuts them out with a soft edge. Pick another layer — a car, a dog, a plate of food — if that is the star instead.',
      'Choose the background: the original, blurred, darkened and zoomed a little so the cut-out pops; a solid or gradient colour; a pattern; or the original sharpened. Drag the cut-out into place, scale it, mirror it or add a mirrored twin.',
      'Set the glow: colour, width and strength, as a soft halo or a hard outline. Type a title of up to two lines in a heavy font with a fill, gradient, outline and shadow, and add an arrow or circle accent pointing at what matters.',
      'Export 1280×720 PNG, 1920×1080 PNG, or JPEG under YouTube’s 2 MB limit — or press "Export 3 variants" for A, B and C with different accent colours, backgrounds and title placements, ready for an A/B test.'
    ],
    uses: [
      ['YouTube creators', 'The face-with-glow thumbnail, three variants at a time, so the test runs on the click rate rather than on a hunch.'],
      ['Shorts, Reels and TikTok covers', 'Make it here at 16:9, then crop to 9:16 with the Image Cropper. The glow outline survives any crop.'],
      ['Podcasts and streams', 'Guest cut out, episode number as the title, the same template every week, and nobody opens a paid editor.'],
      ['Course and webinar promos', 'A speaker on a clean gradient with a two-line title reads at thumbnail size in a mail client, which a slide screenshot does not.'],
      ['Product videos', 'The product as the cut-out, a hard white outline, the price or the claim as the title, an arrow at the feature the video is about.']
    ],
    tips: [
      'A thumbnail is seen at 168 pixels wide on most phones. Three to five words in the title, a face that fills a third of the frame and one accent are what survive that; a sentence does not.',
      'Hard outline in white or the accent colour reads better than a soft glow on a busy background; soft glow reads better on a dark or blurred one. Try both — the preview is at the real size.',
      'Darken the blurred background to 40–60% and the face and the title both gain contrast without any other change. Zoom 8–12% hides the blurred edge where the original frame ended.',
      'Put the title on the opposite side from the face and let the two overlap by a little, so the cut-out sits in front of the words. That overlap is what makes it look produced.',
      'The three variants change the accent colour, the background treatment and where the title sits, and nothing else — so when B wins you know why. Change the text and export three again for the next test.',
      'Export JPEG for the upload; the tool lowers the quality until the file is under 2 MB. Keep the PNG as your master and for anywhere that allows it.'
    ],
    faq: [
      { q: 'Is my photo uploaded anywhere?',
        a: 'No. The only downloads are the model — EfficientViT-Seg B1, 18 MB, Apache-2.0 — and the runtime that runs it, both served from 1234tools.com and kept by your browser after the first visit. No third-party server is contacted. Your picture is cut out, composed and encoded on your own device, and there is no account and no watermark.' },
      { q: 'What size does YouTube want?',
        a: '1280×720 pixels, 16:9, under 2 MB, as JPG, PNG, GIF or BMP, and at least 640 pixels wide. This tool exports exactly 1280×720, or 1920×1080 at the same proportions, and the JPEG export lowers its quality until the file is under 2 MB. YouTube shows the thumbnail at anything from 168 pixels wide on a phone to 1280 on a television, so keep the words few and large.' },
      { q: 'How does it cut me out?',
        a: 'A semantic segmentation network trained on the ADE20K dataset labels every pixel — person, car, animal, building, sky and 145 more — and the person pixels become the cut-out. The outline is then refined against the real pixels of your photo, so it follows hair and shoulders. Edge softness and Shrink or grow in the Subject pane fix a halo or a lost fringe, and Detail: High looks at the picture more closely.' },
      { q: 'Can I use a different subject than a person?',
        a: 'Yes. Every layer the model found is listed; tick a car, an animal, a bottle, a plate of food or any combination and that becomes the cut-out with the glow.' },
      { q: 'What are the three variants?',
        a: 'The same photo, cut-out and words with three different accent colours, three background treatments and three title positions — A, B and C — exported as 1280×720 PNGs named -a, -b and -c. Upload them to a YouTube thumbnail test, or to a poll, and keep the winner.' },
      { q: 'Can I use it commercially, and is there a watermark?',
        a: 'Yes, and no. The output is yours, the model is EfficientViT-Seg from the MIT HAN Lab under the Apache-2.0 licence, and nothing is added to the picture. The photo itself must be one you have the right to use.' },
      { q: 'Why is the first run slow?',
        a: 'The first run on a device downloads the 18 MB model and the 14 MB runtime, then warms the runtime up. After that both come from your browser’s cache and the cut-out appears in about a second on a laptop, a few seconds on a phone.' },
      { q: 'My photo is portrait or square. What happens to it?',
        a: 'The background is cropped to 16:9 around the subject, and the cut-out is placed on top at its own scale and position, so a tall phone photo still gives a wide thumbnail with the face large. If the crop misses what you wanted, drag the cut-out, scale it, or pick a solid or gradient background instead.' },
      { q: 'Can I use my own font or brand colours?',
        a: 'The six fonts are the heavy ones that read at thumbnail size — Impact, Arial Black, Sora, Inter, Verdana and Georgia. Every colour is a free picker, so the glow, the title, the gradient and the accent can be your brand’s exactly.' }
    ],
    related: ['/image/image-cropper/', '/image/background-remover/', '/image/social-media-resizer/', '/image/image-compressor/', '/image/meme-generator/']
  };
})();
