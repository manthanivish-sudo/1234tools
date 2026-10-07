/**
 * Video Resizer — the spec build-video.js reads. Checked by
 * build/video/tests/video-more.js and build/tests/claims/video.js.
 */
(function () {
  window.VIDEO_TOOLS = window.VIDEO_TOOLS || {};
  window.VIDEO_TOOLS['video-resizer'] = {
    order: 6,
    title: 'Video Resizer',
    pageTitle: 'Video Resizer — Change Size and Aspect Ratio, Free | 1234Tools',
    description: 'Resize a video in your browser: a new resolution, or a new shape — 16:9, 9:16, square, 4:5 — with the picture over blurred bars, a colour, cropped to fill or stretched. MP4 out, sound kept. Nothing is uploaded.',
    keywords: ['video resizer', 'resize video', 'change video aspect ratio', 'video to 9:16', 'make video square', 'video to 16:9', 'resize video for instagram', 'change video resolution', 'add blur bars to video', 'crop video to vertical'],
    glyph: 'i-video-resize',
    glyphSvg: '<symbol id="i-video-resize" viewBox="0 0 24 24">\n  <rect x="3" y="7" width="12" height="10" rx="2"/>\n  <path d="M18 4h3v3M21 4l-4.5 4.5M18 20h3v-3M21 20l-4.5-4.5" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/video-video-resizer.js'],
    privacy: 'Nothing you add is uploaded. Your video is decoded, redrawn at its new size and encoded again in this tab with your browser’s own codecs. The shape, size, fitting, colour and crop position are remembered in this browser; the video and its name are not kept. There is no account.',
    how: [
      'Choose a video: MP4, MOV, WebM or MKV.',
      'Choose a shape — keep it, or 16:9, 9:16, 1:1, 4:5, 4:3 or 21:9 — and the length of the short side in pixels.',
      'For a new shape, choose how the picture fits: whole over a blurred copy of itself, whole over a colour, cropped to fill (slide to choose what stays), or stretched. The preview shows a frame.',
      'Press Resize the video. The picture is re-encoded as H.264; the sound is copied.'
    ],
    uses: [
      ['Landscape to vertical', 'A 16:9 clip into a 9:16 frame for stories and shorts, over its own blurred copy.'],
      ['Smaller files for sharing', 'A 4K recording down to 1080p or 720p.'],
      ['Square posts', 'Any video into a 1:1 frame for a feed.'],
      ['Slides and presentations', 'Match a clip to the 16:9 or 4:3 of a slide deck.']
    ],
    tips: [
      'Blurred bars look better than black ones on phones, where the picture fills the screen.',
      'Crop to fill suits talking heads: slide the crop position to keep the face in the frame.',
      'Stretching distorts people and circles; use it only for graphics drawn at the wrong shape.',
      'For a title above the picture and safe zones for captions, the Reels Resizer does more for social posts.'
    ],
    limits: [
      'Files up to 2 GB; phones may run short of memory before that.',
      'The picture is always re-encoded, as H.264 in an MP4; sizes are rounded to even numbers of pixels, as H.264 needs.',
      'The size is never made larger than the original unless you tick Allow a size larger than the original.',
      'Where the browser has no WebCodecs encoder, the video is played once and recorded as it plays.'
    ],
    support: {
      head: ['Browser', 'Resize'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes, faster than real time'],
        ['Safari 16.4 and later', 'Yes'],
        ['Firefox 130 and later (computer)', 'Where the system has an H.264 encoder'],
        ['Browsers without WebCodecs', 'Recorded in real time; the page says so']
      ]
    },
    faq: [
      { q: 'How do I make a landscape video vertical?', a: 'Choose 9:16 and Fit, blurred copy behind: the whole picture sits in the middle of a vertical frame with a soft, darkened copy of itself filling the space above and below.' },
      { q: 'Does resizing lose quality?', a: 'A little, because the picture is encoded again. Making a video smaller hides that; making it larger cannot add detail that was not there.' },
      { q: 'What sizes can I choose?', a: 'A short side of 2160, 1440, 1080, 720, 480 or 360 pixels, or the original size, in any of the shapes offered.' },
      { q: 'Is the sound kept?', a: 'Yes, copied as it was when it suits an MP4 (AAC or Opus), re-encoded when it does not.' },
      { q: 'What happens to a rotated phone video?', a: 'It is turned upright first, so the new frame is laid out the way the video is shown.' },
      { q: 'Is my video uploaded?', a: 'No. It is resized in this tab.' }
    ],
    related: ['/video/video-compressor/', '/video/video-converter/', '/social/reels-resizer/', '/image/social-media-resizer/']
  };
})();
