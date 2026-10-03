/**
 * The AI image tools, as specs.
 *
 * build-ai-image.js runs this file in Node to write each page, the hub, the
 * search-index rows and the sitemap lines; the page itself loads the
 * `scripts` listed, never this file. Keep the copy here, so that the page,
 * the card on the hub and the row in the directory can never disagree.
 */
(function () {
  window.AI_IMAGE_TOOLS = window.AI_IMAGE_TOOLS || {};

  window.AI_IMAGE_TOOLS['text-behind-image'] = {
    order: 0,
    title: 'Text Behind Image',
    pageTitle: 'Text Behind Image — Free AI Text Behind Person & Object Editor | 1234Tools',
    description: 'Put text behind a person, car, building or sky in any photo. AI finds the layers in your browser — nothing is uploaded. Animate the text and export PNG, JPEG, GIF or MP4.',
    keywords: ['text behind image', 'text behind person', 'text behind object', 'put text behind subject in photo',
      'ai text behind image free', 'animated text behind image', 'text behind image video maker', 'text behind image gif'],
    glyph: 'i-text-behind',
    glyphSvg: '<symbol id="i-text-behind" viewBox="0 0 24 24">\n  <path d="M3.5 5.5h10M8.5 5.5v6.2" class="thin"/>\n  <path d="M18 7.2v4.5M15.8 7.2h4.4" class="thin"/>\n  <circle cx="12.5" cy="11.3" r="2.9"/>\n  <path d="M6.6 21.2a5.9 5.9 0 0 1 11.8 0z"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/aiimg-text-behind.js'],
    privacy: 'Your photo never leaves your device. The AI model (18 MB) and the runtime that executes it are served from this site and kept by your browser after the first visit; no third-party server is contacted at all. The picture itself is split into layers, drawn and encoded by your own browser. Nothing is uploaded, queued or logged, and there is no watermark.',
    how: [
      'Choose a photo. A clear subject — a person, a car, a building against the sky — gives the best result.',
      'The AI splits the picture into layers on your device: people, vehicles, buildings, sky, trees, road and more. People and objects start in front of the text; the sky and the background start behind it. Tick or untick any layer to change that.',
      'Type your words, pick a font, size, colour, outline, shadow or glow, and drag the text into place on the preview. Add more text layers if you want a second line at a different depth.',
      'Give each text its own motion: scroll in any of eight directions, wave, slide in, zoom, typewriter, bounce, pulse, fade, float or spin. Set the clip length and press Play.',
      'Export a still as PNG, JPEG or WebP at up to the original size, or a clip as MP4 or animated GIF. The cut-out itself is one click away as a transparent PNG.'
    ],
    uses: [
      ['Instagram and TikTok', 'The classic "name behind the person" story cover, or a scrolling caption that passes behind the subject in a Reel.'],
      ['YouTube thumbnails', 'A title that sits behind your head and in front of the background reads as depth, which is what makes a thumbnail look produced.'],
      ['Posters and invitations', 'Event name behind the building, date in front of the sky. Export at full resolution for print.'],
      ['Product shots', 'The product in front, the brand word behind — a shop-window look from a phone photo.'],
      ['Travel and landscape', 'Put the place name behind the mountain or the skyline and leave the sky in front of it.']
    ],
    tips: [
      'Big and bold reads best: a heavy weight at 20–35% of the picture width, placed so the subject overlaps part of the word. The overlap is the whole effect.',
      'For a title under the horizon, tick Sky so the sky sits in front and the text appears to rise from behind the land.',
      'If a halo of background clings to the subject, grow the cut by one step; if the text is being clipped by a fringe of hair, shrink it. Edge softness 2–4 suits most photos, and Detail: High gives the model a closer look at thin edges.',
      'Open "Fix the cut-out by hand" to paint anything the model missed — a hand, a bag strap, a lamp post — in or out of the front layer.',
      'For a seamless loop, keep "times per clip" a whole number and make the clip 4–8 seconds. GIFs are big: 640 px and 12–15 fps is plenty for a chat or a story.',
      'The still exports the exact frame on the preview. Pause on the moment you like before downloading.'
    ],
    faq: [
      { q: 'How does it know where the person ends and the background begins?',
        a: 'A semantic segmentation network (EfficientViT-Seg, trained on the ADE20K scene dataset and published under the Apache-2.0 licence) labels every pixel as one of 150 kinds of thing — person, car, bicycle, building, sky, tree, road, wall and so on. It runs inside your browser through WebAssembly. The boundary it draws is then refined against the real pixels of your photo, so it follows edges rather than blobs.' },
      { q: 'Is my photo uploaded anywhere?',
        a: 'No. The only downloads are the model (18 MB) and the runtime that runs it, both served from 1234tools.com itself, fetched once and kept by your browser. No third-party server is contacted. Your picture is read, split, drawn and encoded on your device. We never see it, and there is no account and no watermark.' },
      { q: 'Can I put text behind a car, a building or the sky, not only behind a person?',
        a: 'Yes. Every layer the model finds has an "in front of the text" switch. Untick People to put the text in front of someone; tick Sky or Buildings to put it behind them. Each text layer can also be set to sit in front of everything, so a second line can float on top.' },
      { q: 'The edge around hair or a thin object looks rough. What helps?',
        a: 'Three things, in order: raise Edge softness so the cut follows fine detail; switch Detail to High or Maximum, which shows the model the picture at a higher resolution and is sharper on small parts; and paint the remainder by hand with the brush. A well-lit, in-focus photo also helps — at the Standard setting the model sees the picture at 512 pixels across, so very small subjects are hard for it.' },
      { q: 'What can I export?',
        a: 'Stills as PNG, JPEG or WebP at up to the original resolution (4,096 px on the long edge). Clips as H.264 MP4, or animated GIF, at 480 to 1,920 pixels and 10 to 60 frames a second, up to 20 seconds long. The subject cut-out alone exports as a transparent PNG.' },
      { q: 'Why did I get a WebM instead of an MP4?',
        a: 'MP4 is encoded on the device with the browser’s WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the clip is recorded in real time as WebM, which every browser and most apps play. Convert it if a site insists on MP4, or open the page in Chrome or Edge.' },
      { q: 'Can I use my own font?',
        a: 'Yes — choose "Upload a font file" in the font list and pick a TTF, OTF, WOFF or WOFF2. It is loaded into this page only, never uploaded, and forgotten when you leave.' },
      { q: 'Does it work on a phone?',
        a: 'Yes, in Safari on iOS and Chrome on Android. The first run downloads the 18 MB model and the 14 MB runtime; after that both are cached. Export clips at 720 px or under on a phone — encoding a long 1080p clip is work for a laptop.' },
      { q: 'Which motions are there, and will the loop be seamless?',
        a: 'Scroll across in eight directions, wave, wave and scroll together, slide in and out, zoom in, typewriter, bounce, pulse, fade, float and spin. The cyclic ones complete a whole number of cycles per clip, so a GIF or a looping video joins up with itself.' },
      { q: 'Is there a watermark? What is the optional credit?',
        a: 'There is no watermark. In the Export pane there is a box, off unless you tick it, that adds a small “1234tools.com” to the bottom corner of GIF and MP4 clips — a way to tell friends where you made it, if you want to. It is never added to a still image or a cut-out, and the choice is remembered on this device only.' },
      { q: 'Can I share a link to a particular text style?',
        a: 'Yes. Pick a look in the Text pane — Neon sunset, Bold white, Outline, Gold headline, Typewriter or Wave — and press “Copy link to this look”. The link opens this page with that look ready to apply to whatever photo the other person chooses. It carries only the name of the style: no photo and no words of yours.' }
    ],
    related: ['/image/background-remover/', '/image/meme-generator/', '/image/social-media-resizer/', '/image/photo-filters/', '/image/circle-crop/', '/image/image-compressor/']
  };
})();
