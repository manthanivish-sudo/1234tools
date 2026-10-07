/**
 * Waveform Video — the spec build-audio.js reads. Checked by
 * build/audio/tests/audio-tools.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['waveform-video'] = {
    order: 10,
    title: 'Waveform Video',
    pageTitle: 'Waveform Video Maker — Audiogram for Podcasts, Free | 1234Tools',
    description: 'Turn a podcast clip or a song into a video with a moving waveform, a title and your cover picture, square, vertical or landscape. Made in your browser as an MP4 with the sound. Nothing is uploaded.',
    keywords: ['waveform video', 'audiogram', 'audiogram maker', 'audio to video', 'podcast video', 'mp3 to mp4 with image', 'music visualizer video', 'audio waveform animation', 'convert audio to video for instagram'],
    glyph: 'i-audio-video',
    glyphSvg: '<symbol id="i-audio-video" viewBox="0 0 24 24">\n  <rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/>\n  <path d="M7 10.5v3M10 9v6M13 8v8M16 10v4" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/audio-dsp.js', '/engine/render-audio.js', '/engine/audio-waveform-video.js'],
    privacy: 'Nothing you add is uploaded. The sound and the picture are read by your browser and the video is drawn and encoded in this tab. The size, style, colours and frame rate are remembered in this browser; the sound, the picture and the title are not kept. There is no account.',
    how: [
      'Choose the sound: a podcast clip, a song, a voice note, or a video’s sound.',
      'Choose a size — square, vertical for stories and reels, or landscape — and bars or a line.',
      'Add a title and a cover picture if you like, and pick the colours. The preview shows a frame.',
      'Set From and To for the part you want (up to 10 minutes) and press Make the video.'
    ],
    uses: [
      ['Podcast promotion', 'A minute of an episode as a video, for platforms that take only video.'],
      ['New music', 'A track with its cover art and a moving waveform for a post.'],
      ['Voice notes and quotes', 'A spoken quote with the speaker’s photo behind it.'],
      ['Teaching', 'A pronunciation clip that shows when each word lands.']
    ],
    tips: [
      'Vertical 1080 × 1920 suits stories and reels; square suits feeds.',
      'The picture is darkened behind the waveform so the bars stay readable on any image.',
      'Keep clips under a minute for social posts; the whole episode can go to a video site.',
      '1280 × 720 renders quickest if you are on a slow machine.'
    ],
    limits: [
      'Up to 10 minutes of sound per video, rendered at 25 or 30 frames a second.',
      'Needs a browser that can encode H.264 on the device (WebCodecs): Chrome, Edge, Safari 16.4 and later, or Firefox 130 and later on a computer.',
      'The sound is encoded as AAC, or as Opus where the browser has no AAC encoder; the page says which.'
    ],
    support: {
      head: ['Browser', 'Make the video'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes, faster than real time'],
        ['Safari 16.4 and later', 'Yes'],
        ['Firefox 130 and later (computer)', 'Where the system has an H.264 encoder'],
        ['Browsers without WebCodecs', 'No: the page says so']
      ]
    },
    faq: [
      { q: 'What is an audiogram?', a: 'A short video made from a sound clip: a still picture or a colour, a title, and a waveform that moves with the sound, so a podcast or a song can be shared where only video plays.' },
      { q: 'Which format is the video?', a: 'An H.264 MP4 with the sound as AAC, which every phone and social site accepts.' },
      { q: 'How long can the video be?', a: 'Up to 10 minutes. Choose From and To to pick the part.' },
      { q: 'Can I use my own picture?', a: 'Yes: choose any picture as the cover. It fills the frame and is darkened a little so the waveform shows.' },
      { q: 'How does the waveform follow the sound?', a: 'The loudness is measured every 10 ms; each frame draws the 0.8 seconds around its moment as bars or a line.' },
      { q: 'Is anything uploaded?', a: 'No. The video is drawn and encoded in this tab.' }
    ],
    related: ['/audio/audio-trimmer/', '/social/reels-resizer/', '/ai-video/reel-maker/']
  };
})();
