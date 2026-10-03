/**
 * Film Grain & VHS Effect — the spec.
 *
 * Read by build-ai-image.js to write the page, the hub card, the search-index
 * row and the sitemap line; the page itself loads the `scripts` listed.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['film-grain'] = {
    order: 11,
    title: 'Film Grain & VHS Effect',
    pageTitle: 'Film Grain and VHS Effect — Retro Photo Filter, Free | 1234Tools',
    description: 'Give a photo film grain, light leaks, VHS tracking, a date stamp and faded colour. Seven presets, a random roll; PNG still or a looping GIF and MP4. No upload.',
    keywords: ['film grain overlay', 'vhs effect', 'vintage photo filter', 'disposable camera effect', 'retro filter online',
      '90s camera effect', 'film grain photo editor', 'vhs filter free'],
    glyph: 'i-ai-film-grain',
    glyphSvg: '<symbol id="i-ai-film-grain" viewBox="0 0 24 24">\n  <rect x="3" y="4.5" width="18" height="15" rx="2"/>\n  <path d="M6.3 7.3v1.4M6.3 11.3v1.4M6.3 15.3v1.4M17.7 7.3v1.4M17.7 11.3v1.4M17.7 15.3v1.4" class="thin"/>\n  <path d="M9.6 9.2a.8.8 0 1 0 .02 0zM13.4 8.3a.8.8 0 1 0 .02 0zM11.2 12.3a.8.8 0 1 0 .02 0zM14.8 11.6a.8.8 0 1 0 .02 0zM10 15.6a.8.8 0 1 0 .02 0zM13.6 15a.8.8 0 1 0 .02 0z" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-film-grain.js'],
    privacy: 'Your photo never leaves your device, and there is no model to download: the grain, light leaks, scan lines and colour are drawn by your own graphics chip through WebGL, and the stills, GIFs and videos are encoded by your browser. No server is contacted. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: null,
    how: [
      'Choose a photo. Anything works; party pictures, street scenes, portraits and holiday snaps suit it best.',
      'Pick a preset — Disposable, VHS 1994, Super 8, Faded Polaroid, Cinematic grain, Night-vision green or Kodachrome — or press Random roll for a different take on the same look.',
      'Adjust what you like: grain amount, size and colour; light leaks; scan lines and tracking wobble; colour fringing; vignette; fade, saturation and warmth; halation on the highlights. Turn on the date stamp and set its date and corner; crop to 4:3 with rounded CRT corners.',
      'Press Play to watch the grain and the tracking move, as they will in the GIF or the video.',
      'Export a still as PNG, JPEG or WebP, a looping GIF of two to three seconds, or an MP4.'
    ],
    uses: [
      ['Instagram grid and stories', 'Grain and a slight fade make a phone photo look as if it was shot on film. Kodachrome for colour, Cinematic grain for moody light.'],
      ['Reels and TikTok', 'The VHS preset with the date stamp, exported as an MP4 or a looping GIF with the tracking lines moving, reads as found footage.'],
      ['Party and festival photos', 'Disposable: hard-flash look, a warm leak in one corner, big grain and a date in orange — the drugstore camera of the late nineties.'],
      ['Posters, covers and headers', 'Super 8 and Faded Polaroid give a texture that sits well behind large type. Export at full size as PNG.'],
      ['Night-vision and horror', 'Green monochrome, scan lines and a heavy vignette, for a Halloween invitation or a game jam.']
    ],
    tips: [
      'Less is more. Real film grain is fine and even; if the picture looks like static, halve the amount and raise the size one step.',
      'Light leaks belong at an edge or a corner, where the back of a camera lets light in. One warm leak looks real; three look like a sticker.',
      'Tracking wobble reads best on a photo with vertical lines — door frames, buildings, a wall — because that is where the displacement shows.',
      'Set the date stamp a few years back. The tool suggests the date the photo carries when it has one, and today’s date otherwise. Keep the 4:3 crop on for the VHS and Disposable looks.',
      'Export the GIF at 640 px or under: grain means every frame changes everywhere, so a GIF barely compresses. Two seconds at 12 frames a second is a loop; longer only makes it heavier. For anything bigger, use MP4.',
      'For a still, PNG keeps the grain crisp. A JPEG at a low quality adds blocking of its own, which is sometimes exactly the point.'
    ],
    faq: [
      { q: 'Is my photo uploaded?',
        a: 'No. There is no model and no server. The effects are shaders that run on your device’s graphics chip through WebGL, and the exports are encoded by your browser. Nothing is uploaded, there is no account, and there is no watermark.' },
      { q: 'Why does the grain flicker in the GIF?',
        a: 'Because that is what film and tape do: every frame has its own grain and the tracking line drifts, and that flicker is what makes a loop look alive rather than like a filtered photo. If you want one fixed frame, export a still; it is a PNG of exactly what is on the preview.' },
      { q: 'What do the presets change?',
        a: 'Everything on the panels at once: grain amount, size and colour, the leaks, scan lines, tracking, colour fringing, vignette, fade, saturation, warmth, halation, the stamp and the crop. Random roll keeps the preset’s character and reshuffles the amounts and the leak positions; press it until you like one, then fine-tune.' },
      { q: 'Can I use the result commercially?',
        a: 'Yes. It is your photo with an effect on it; the output is yours, and nothing here is licensed from anyone else.' },
      { q: 'Does it work on a phone?',
        a: 'Yes, in Safari on iOS and Chrome on Android; the shaders are light enough for any phone of the last decade. Export GIFs at 480 or 640 px on a phone, and MP4 at 720 px.' },
      { q: 'Does it need WebGL?',
        a: 'It uses WebGL where it is available, which is every current browser. Where it is switched off, a simpler version draws the grain, leaks, vignette, fade, tint and scan lines on a plain canvas, without the tracking wobble, colour fringing or halation.' },
      { q: 'What is the difference between film grain and noise?',
        a: 'Noise from a camera sensor is per-pixel and coloured; film grain is clumps of silver, larger than a pixel, mostly monochrome, and densest in the mid-tones. Grain size sets the clump size, Colour grain adds the sensor-style colour, and the amount is weighted toward the mid-tones, which is why the grain here sits inside the picture rather than on top of it.' },
      { q: 'Why did I get a WebM instead of an MP4?',
        a: 'MP4 is encoded on the device with the browser’s WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the clip is recorded in real time as WebM, which every browser and most apps play. Convert it if a site insists on MP4, or open the page in Chrome or Edge.' }
    ],
    related: ['/image/photo-filters/', '/image/image-border/', '/image/image-compressor/', '/image/image-converter/']
  };
})();
