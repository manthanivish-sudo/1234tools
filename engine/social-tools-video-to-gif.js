/**
 * Video to GIF — the spec build-social.js reads. The page loads the
 * `scripts` listed, never this file. The engine is
 * engine/social-video-to-gif.js; the encoder runs in
 * engine/social-gif-worker.js (gifenc 1.0.3, MIT, vendored). Every
 * behaviour quoted here is checked by build/social/tests/video-to-gif.js
 * and the claims in build/tests/claims/social.js.
 */
(function () {
  window.SOCIAL_TOOLS = window.SOCIAL_TOOLS || {};
  window.SOCIAL_TOOLS['video-to-gif'] = {
    order: 5,
    title: 'Video to GIF',
    pageTitle: 'Video to GIF Converter — Trim, Crop, Caption | 1234Tools',
    description: 'Turn a clip from an MP4, MOV or WebM into an animated GIF in your browser: trim it, pick the width, frame rate, speed and loops, crop it square or vertical and add a caption. See the size before you export. Nothing is uploaded.',
    keywords: ['video to gif', 'mp4 to gif', 'mov to gif', 'webm to gif', 'make a gif from a video', 'gif maker from video',
      'convert video to gif online free', 'gif with caption', 'reaction gif maker', 'square gif', 'trim video to gif'],
    glyph: 'i-social-gif',
    glyphSvg: '<symbol id="i-social-gif" viewBox="0 0 24 24">\n  <rect x="2.5" y="5" width="19" height="14" rx="2.5"/>\n  <path d="M2.5 9h19M2.5 15h19" class="thin"/>\n  <path d="M6 5v4M10 5v4M14 5v4M18 5v4M6 15v4M10 15v4M14 15v4M18 15v4" class="thin"/>\n  <path d="M10.2 10.4v3.2l2.8-1.6z" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/social-video-to-gif.js'],
    privacy: 'Nothing you add is uploaded. Your video is read by your browser’s own video decoder, the frames are drawn on a canvas in this page, and the GIF is compressed by a worker running on your device (gifenc, an MIT-licensed encoder served from this site). The settings you choose — width, frame rate, speed, plays, crop and caption position — are remembered in this browser; the video, its name and the caption’s words are not kept. There is no account.',
    how: [
      'Choose a video: MP4, MOV or WebM, anything your browser can play.',
      'Drag the two handles on the trim bar to the start and end you want, or select a handle and use the arrow keys (a tenth of a second a press, a whole second with Shift). You can also type the times in seconds. Play the selection to check it.',
      'Pick the width (240 to 640 px; the height follows the shape), 5 to 20 frames per second, a speed from 0.5× to 2×, and how many times it plays.',
      'Crop it square, vertical (9:16) or 4:5 if you like, and slide the crop to keep the part that matters. Add a caption at the top or bottom.',
      'Read the size estimate, then press Make the GIF. The progress bar counts the frames, and Cancel stops it.'
    ],
    uses: [
      ['Reaction GIFs', 'Two seconds of a clip with a caption, square so it sits well in a chat or a comment.'],
      ['Product loops', 'A turntable shot or a one-step demo that loops for ever on a shop page or in an email.'],
      ['Tutorial steps', 'A screen recording cut to the one click that matters, small enough for a help article.'],
      ['Previews for a post', 'A few seconds of a longer video, for platforms and messages where a GIF plays on its own.']
    ],
    tips: [
      'Length, width and frame rate decide the size. Half the width is a quarter of the pixels; on our flat test clip it halved the file.',
      '10 to 12 frames per second looks smooth for most movement; 20 is for fast action.',
      'Busy, grainy footage makes big GIFs. A steady, plain background compresses far better.',
      'Dither is on by default because it hides colour banding in skies and skin; turn it off for flat graphics and screen recordings, which then come out smaller.',
      'A caption in short capitals reads best at GIF sizes.'
    ],
    faq: [
      { q: 'How big will my GIF be?', a: 'The tool tells you before you export: it takes four frames of your selection, compresses them exactly as the export will, and multiplies up by the number of frames. A GIF stores every frame as a whole picture, so the size grows with the length, the width and the frame rate — and busy footage costs more than a still background.' },
      { q: 'Why does the GIF look grainier than the video?', a: 'The GIF format allows at most 256 colours in a picture. The tool picks up to 256 that suit your clip from eight frames spread over it and uses that one palette for every frame, so colours do not flicker from frame to frame. Dithering mixes neighbouring colours in a fixed pattern to hide the steps; turn it off for flat graphics.' },
      { q: 'How long can the GIF be?', a: 'Up to 600 frames — 30 seconds at 20 frames per second, or a minute at 10 — and up to 640 pixels wide. Past that a GIF gets very large and slow to open; an MP4 of the same clip is a fraction of the size.' },
      { q: 'How many times does it play?', a: 'Loop for ever is the default. For a set number of plays the GIF carries a repeat count (the NETSCAPE2.0 block): Play 3 times writes “repeat twice after the first play”, which is how Chrome reads it. Play once writes no repeat block at all. Some apps and sites ignore the count and loop every GIF.' },
      { q: 'Does it keep the sound?', a: 'No. GIF is a picture format and has no sound track.' },
      { q: 'Which videos work?', a: 'Any file your browser can play: MP4 (H.264) and WebM everywhere, and MOV when it holds H.264. A MOV from an iPhone may be HEVC, which a browser plays only where the device has a decoder for it; if the tool says it cannot read a picture, set the phone to record “Most compatible” video, or try the page in Safari.' },
      { q: 'Is my video uploaded?', a: 'No. The page reads the file from your device, seeks through it with the browser’s own decoder and builds the GIF in a worker in this tab. Nothing is sent anywhere, and the video is not kept after you close the page.' }
    ],
    related: ['/ai-video/reel-maker/', '/ai-video/auto-captions/', '/image/meme-generator/', '/image/image-compressor/']
  };
})();
