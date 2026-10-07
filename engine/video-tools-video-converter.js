/**
 * Video Converter — the spec build-video.js reads. The page loads the
 * `scripts` listed, never this file. Every behaviour quoted here is checked
 * by build/video/tests/video-tools.js and build/tests/claims/video.js.
 */
(function () {
  window.VIDEO_TOOLS = window.VIDEO_TOOLS || {};
  window.VIDEO_TOOLS['video-converter'] = {
    order: 3,
    title: 'Video Converter',
    pageTitle: 'Video Converter — MOV to MP4, WebM to MP4, Free | 1234Tools',
    description: 'Convert MOV, MKV, WebM and MP4 videos to MP4 or WebM in your browser, sound included. When the picture and sound already suit the new format they are copied untouched, with no loss. Nothing is uploaded.',
    keywords: ['video converter', 'mov to mp4', 'webm to mp4', 'mkv to mp4', 'mp4 to webm', 'convert video to mp4', 'convert mov to mp4 online free', 'video format converter', 'change video format'],
    glyph: 'i-video-convert',
    glyphSvg: '<symbol id="i-video-convert" viewBox="0 0 24 24">\n  <rect x="2.5" y="5.5" width="13.5" height="13" rx="2.5"/>\n  <path d="M16 10.2l5.5-3.2v10l-5.5-3.2"/>\n  <path d="M6 10.5h5.5l-1.6-1.6M10.5 13.5H5l1.6 1.6" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/video-video-converter.js'],
    privacy: 'Nothing you add is uploaded. The page reads your video from your device, converts it in this tab with your browser’s own codecs and saves the new file to your downloads. The format, the copy preference and the quality are remembered in this browser; the video and its name are not kept. There is no account.',
    how: [
      'Choose a video: MOV, MP4, MKV or WebM.',
      'Choose MP4 (H.264 video, AAC sound: plays everywhere) or WebM (VP9 video, Opus sound: for the web).',
      'Leave “Copy the picture and sound untouched when they already fit” ticked. The page tells you before you start whether the file will be copied or re-encoded, and why.',
      'Press Convert the video. A copied file takes seconds; a re-encoded one shows its progress and can be cancelled.'
    ],
    uses: [
      ['iPhone and Mac MOV files', 'A MOV holding H.264 and AAC becomes an MP4 by copying alone: the same picture, a format every app accepts.'],
      ['Screen recordings in WebM', 'Turn a WebM from a browser or a screen recorder into an MP4 for an editor or a phone.'],
      ['Web pages', 'Make a WebM copy of an MP4 for a site that serves both.'],
      ['MKV downloads', 'Repackage an MKV with H.264 inside as an MP4 that phones and TVs play.']
    ],
    tips: [
      'MOV to MP4 is usually just a change of box: the page copies the tracks and the file is ready in seconds.',
      'WebM VP9 with Opus sound can go into an MP4 untouched too; untick the copy option if you need H.264 for an older player.',
      'Choose MP4 when in doubt: it plays on every phone, computer, TV and social site.',
      'Re-encoding at High keeps the picture close to the original; Small trades sharpness for size.'
    ],
    limits: [
      'Files up to 2 GB; phones may run short of memory before that.',
      'HEVC (H.265) from an iPhone can be copied into an MP4 as it is, but the result plays only where HEVC does; untick the copy option to get H.264.',
      'VP8 WebM files are always re-encoded for MP4, because MP4 has no place for VP8.',
      'Where the browser has no WebCodecs encoder for the format, the video is played once and recorded as it plays, and the browser chooses the format; the page says so.'
    ],
    support: {
      head: ['Browser', 'Copy (repackage)', 'MP4 (H.264)', 'WebM (VP9)'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'Yes', 'Yes'],
        ['Safari 16.4 and later', 'Yes', 'Yes', 'Where Safari offers a VP9 encoder'],
        ['Firefox 130 and later (computer)', 'Yes', 'Where the system has an H.264 encoder', 'Yes'],
        ['Browsers without WebCodecs', 'Yes', 'Recorded in real time', 'Recorded in real time']
      ]
    },
    faq: [
      { q: 'How do I convert MOV to MP4?', a: 'Choose the MOV and MP4, and press Convert the video. Most MOV files from iPhones and Macs hold H.264 or HEVC video with AAC sound, which an MP4 can hold as they are, so the page copies them into an MP4 without re-encoding: no loss, and seconds for a long video.' },
      { q: 'Will converting lose quality?', a: 'Not when the tracks are copied: the page says before you start when that will happen. When the picture has to be re-encoded, High keeps it close to the original.' },
      { q: 'Is the sound kept?', a: 'Yes. It is copied when it suits the new format (AAC or Opus into MP4, Opus or Vorbis into WebM), and re-encoded when it does not.' },
      { q: 'Why is WebM conversion slower?', a: 'VP9 encoding takes more work than H.264, and most computers have no hardware for it, so the browser does it in software.' },
      { q: 'Can it make a GIF?', a: 'Use Video to GIF, in the Social Media tools: it trims, crops and captions a clip and shows the GIF’s size before you export.' },
      { q: 'Is my video uploaded?', a: 'No. Everything happens in this tab with your browser’s own codecs.' }
    ],
    related: ['/video/video-compressor/', '/video/extract-audio/', '/social/video-to-gif/', '/image/image-converter/']
  };
})();
