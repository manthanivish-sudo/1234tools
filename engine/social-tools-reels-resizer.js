/**
 * Reels Resizer — the spec build-social.js reads. The page loads the
 * `scripts` listed, never this file. The engine is
 * engine/social-reels-resizer.js; the MP4 is encoded with WebCodecs and
 * boxed by the vendored mp4-muxer (MIT) through AIImg.encodeVideoFrames in
 * engine/aiimg-core.js. Every behaviour quoted here is checked by
 * build/social/tests/reels-resizer.js and the claims in
 * build/tests/claims/social.js.
 */
(function () {
  window.SOCIAL_TOOLS = window.SOCIAL_TOOLS || {};
  window.SOCIAL_TOOLS['reels-resizer'] = {
    order: 6,
    title: 'Reels Resizer',
    pageTitle: 'Reels Resizer — Landscape Video to 9:16, 1:1, 4:5 | 1234Tools',
    description: 'Turn a landscape video into a vertical 9:16 MP4 for Reels, Shorts and TikTok, or a 1:1 or 4:5 one: fit it over a blurred copy or a colour, or crop it to fill around the part that matters. Add a title; the sound is kept. Nothing is uploaded.',
    keywords: ['resize video for reels', 'landscape to vertical video', '16:9 to 9:16', 'horizontal video to vertical', 'video for instagram reels',
      'youtube shorts resize', 'tiktok video resize', 'blurred background video', 'square video maker', '4:5 video', 'reframe video online free'],
    glyph: 'i-social-reframe',
    glyphSvg: '<symbol id="i-social-reframe" viewBox="0 0 24 24">\n  <rect x="7" y="2.5" width="10" height="19" rx="2"/>\n  <rect x="2.5" y="8.5" width="19" height="7" rx="1.2" class="thin"/>\n  <path d="M11 10.6v2.8l2.4-1.4z" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/social-reels-resizer.js'],
    privacy: 'Nothing you add is uploaded. Your video is played and decoded by your browser, every frame is drawn on a canvas in this page and encoded to MP4 by your browser’s own media engine, and the sound is decoded and re-encoded on your device too. The settings you choose — size, background, position and the title’s size and colour — are remembered in this browser; the video, its name and the title’s words are not kept. There is no account.',
    how: [
      'Choose a video: MP4, MOV or WebM, up to 3 minutes and 500 MB.',
      'Pick the size: 9:16 for Reels, Shorts, TikTok and Stories (1080 × 1920, or 720 × 1280 for a quicker, smaller file), 4:5 for a portrait feed post, or 1:1.',
      'Choose what fills the space: a blurred, darkened copy of the video, a solid colour, or the video itself cropped to fill the frame. When it is cropped, drag the picture to keep the part that matters.',
      'Add a title above the picture if you like, and move the picture higher to keep the bottom of the frame clear for captions.',
      'Press Make the MP4. The video plays through once while every frame is encoded; the progress bar shows how far it has got, and Cancel stops it.'
    ],
    uses: [
      ['Podcast and interview clips', 'A landscape camera shot, fitted in the middle of a vertical frame with a blurred copy behind and the episode title above.'],
      ['Webinar and screen recordings', 'Keep the whole slide or screen readable instead of cropping half of it away; leave the bottom clear for captions.'],
      ['Gameplay and sport', 'Crop to fill the vertical frame and drag the focus onto the action.'],
      ['One video, every feed', 'Make the 9:16 for Reels and Shorts, then the 4:5 for the feed from the same file.']
    ],
    tips: [
      'Fit with a blurred copy keeps everything in the shot; crop to fill looks more native but loses the sides of a landscape frame.',
      'Keep a title short — two lines at most — so it stays big enough to read on a phone.',
      'Higher position leaves the bottom of the frame clear, where the apps put the caption, the account name and the buttons.',
      'Want captions too? Make the vertical video here, then put it through Auto Captions.',
      'Choose 720 × 1280 for a long clip on a phone: it encodes faster and makes a smaller file.'
    ],
    faq: [
      { q: 'Is the video uploaded?', a: 'No. The page plays your file in the browser, draws each frame on a canvas and encodes it with your browser’s own H.264 encoder (WebCodecs). The MP4 is put together in this tab and saved straight to your downloads.' },
      { q: 'Is the sound kept?', a: 'Yes. The sound is decoded from your file and encoded again as AAC, or as Opus where the browser has no AAC encoder, and put in the MP4 beside the picture. A video with no sound track comes out silent, and the page says so.' },
      { q: 'Why does it take as long as the video?', a: 'Every frame has to be decoded and drawn before it can be encoded, and the page reads them by playing the video through once, muted, so a one-minute clip takes at least a minute. If the encoder falls behind, the video pauses until it catches up; if a frame goes by before the page could take it, the video goes back to the last frame taken and plays on at half the speed (down to an eighth), so frames are not skipped — on a slow phone that makes the export take several times as long as the clip. Keep the tab in front: browsers slow down tabs in the background.' },
      { q: 'Will it look as sharp as my original?', a: 'It is re-encoded, so the picture quality is your browser’s encoder’s at about 8 Mbps for 1080-pixel-wide output (5 Mbps for 720), not a copy of the original stream. A landscape video fitted into a vertical frame is also shown smaller, so it uses fewer pixels than it had.' },
      { q: 'Why did I get a WebM?', a: 'MP4 is encoded on the device with WebCodecs, which Chrome, Edge and Safari 16.4+ provide. Firefox does not yet, so there the video is recorded in real time as it plays, usually as WebM, with the sound played into the same recording. Open the page in Chrome or Edge for an MP4.' },
      { q: 'What are the limits?', a: 'Three minutes and 500 MB per video, one video at a time. The whole sound track is decoded into memory and the finished MP4 is built in memory before it is saved, so longer files risk running a phone out of memory.' },
      { q: 'Which sizes does it make?', a: '1080 × 1920 and 720 × 1280 (9:16, for Reels, Shorts, TikTok and Stories), 1080 × 1350 (4:5) and 1080 × 1080 (1:1), at 30 or 60 frames a second. Frames the video does not have are not made up: 60 only helps when the source has 60.' }
    ],
    related: ['/ai-video/auto-captions/', '/ai-video/reel-maker/', '/image/social-media-resizer/', '/ai-image/thumbnail-maker/']
  };
})();
