/**
 * Video to Frames — the spec build-video.js reads. Checked by
 * build/video/tests/video-more.js and build/tests/claims/video.js.
 */
(function () {
  window.VIDEO_TOOLS = window.VIDEO_TOOLS || {};
  window.VIDEO_TOOLS['video-to-frames'] = {
    order: 7,
    title: 'Video to Frames',
    pageTitle: 'Video to Frames — Save Stills as PNG or JPG, Free | 1234Tools',
    description: 'Save frames from a video as pictures in your browser: every frame of a part, one every few seconds, a set number spread evenly, or the frame on screen. PNG or JPG, in a ZIP. Nothing is uploaded.',
    keywords: ['video to frames', 'extract frames from video', 'video to jpg', 'video to png', 'save frame from video', 'screenshot from video', 'video to images', 'frame grabber', 'export every frame'],
    glyph: 'i-video-frames',
    glyphSvg: '<symbol id="i-video-frames" viewBox="0 0 24 24">\n  <rect x="2.5" y="5" width="8" height="6" rx="1.5"/>\n  <rect x="13.5" y="5" width="8" height="6" rx="1.5"/>\n  <rect x="2.5" y="13" width="8" height="6" rx="1.5"/>\n  <rect x="13.5" y="13" width="8" height="6" rx="1.5"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/zip.js', '/engine/video-video-to-frames.js'],
    privacy: 'Nothing you add is uploaded. Your video is decoded in this tab and each frame is saved as a picture by your browser. Which frames, the interval, the number and the format are remembered in this browser; the video and its name are not kept. There is no account.',
    how: [
      'Choose a video: MP4, MOV, WebM or MKV.',
      'Choose which frames: every frame of a part, one every so many seconds, a number spread evenly, or the one in the player (pause it on the moment you want).',
      'Set From and To for the part, and PNG or JPEG.',
      'Press Take the frames. One frame downloads as a picture; several come in a ZIP, named by frame number and time.'
    ],
    uses: [
      ['Thumbnails', 'Pick the best moment of a clip as its cover picture.'],
      ['Contact sheets', 'Ten frames spread over a film to see it at a glance.'],
      ['Animation and sport', 'Every frame of a movement, to study it frame by frame.'],
      ['Evidence', 'The exact frame of a dashcam or doorbell clip, at full resolution.']
    ],
    tips: [
      'Pause the player on the moment and choose Only the frame in the player for a single still.',
      'PNG keeps every pixel; JPEG files are a fraction of the size and fine for thumbnails.',
      'Every frame of a minute at 30 fps is 1,800 pictures: take a part, or one every few frames, to stay under the limit.',
      'File names carry the frame number and its time, so the order and the moment are never lost.'
    ],
    limits: [
      'Up to 1,000 frames a run, at the video’s own resolution.',
      'Files up to 2 GB; a ZIP of many PNGs can be large, so phones may run short of memory.',
      'Frames are decoded with WebCodecs where it can read the file; otherwise they are taken from the player by seeking, which is slower and may land within a frame of the time asked.'
    ],
    support: {
      head: ['Browser', 'Frame-accurate', 'By seeking'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'Yes'],
        ['Safari 16.4 and later', 'Yes', 'Yes'],
        ['Firefox 130 and later (computer)', 'Yes', 'Yes'],
        ['Browsers without WebCodecs', 'No', 'Yes']
      ]
    },
    faq: [
      { q: 'Are the frames full resolution?', a: 'Yes: each picture is the size the video is shown at, upright for a rotated phone video.' },
      { q: 'How exact is the time?', a: 'Each picture is the frame shown at the time asked for, decoded from the file, and its file name gives its frame number and the time it starts.' },
      { q: 'How many frames can I take?', a: 'Up to 1,000 a run. For more, take the video in parts.' },
      { q: 'PNG or JPEG?', a: 'PNG for the best quality and for editing; JPEG for small files to share or use as thumbnails.' },
      { q: 'Can I make a GIF from the frames?', a: 'Use Video to GIF, which makes the animation directly and shows its size first.' },
      { q: 'Is my video uploaded?', a: 'No. The frames are made in this tab.' }
    ],
    related: ['/video/video-trimmer/', '/social/video-to-gif/', '/image/image-compressor/', '/video/video-resizer/']
  };
})();
