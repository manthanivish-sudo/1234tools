/**
 * Video Compressor — the spec build-video.js reads. The page loads the
 * `scripts` listed, never this file. Every behaviour quoted here is checked
 * by build/video/tests/video-tools.js and build/tests/claims/video.js.
 */
(function () {
  window.VIDEO_TOOLS = window.VIDEO_TOOLS || {};
  window.VIDEO_TOOLS['video-compressor'] = {
    order: 1,
    title: 'Video Compressor',
    pageTitle: 'Video Compressor — Shrink a Video to a Size, Free | 1234Tools',
    description: 'Compress a video to a file size you choose, or to a quality level, in your browser. Lower the resolution or frame rate, keep or shrink the sound, and see the size before and after. Nothing is uploaded.',
    keywords: ['video compressor', 'compress video', 'reduce video size', 'compress mp4', 'compress video to 25 mb', 'make video smaller', 'shrink video file size', 'compress video for email', 'compress video online free', 'video size reducer'],
    glyph: 'i-video-compress',
    glyphSvg: '<symbol id="i-video-compress" viewBox="0 0 24 24">\n  <rect x="2.5" y="5.5" width="13.5" height="13" rx="2.5"/>\n  <path d="M16 10.2l5.5-3.2v10l-5.5-3.2"/>\n  <path d="M9.2 7.8v3.4M7.4 9.6l1.8 1.8 1.8-1.8M9.2 16.2v-3.4M7.4 14.4l1.8-1.8 1.8 1.8" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/video-video-compressor.js'],
    privacy: 'Nothing you add is uploaded. The page reads your video from your device a few megabytes at a time, decodes and re-encodes it with your browser’s own codecs, and saves the smaller file to your downloads. The settings you choose — target size, quality, resolution, frame rate and sound — are remembered in this browser; the video and its name are not kept. There is no account.',
    how: [
      'Choose a video: MP4, MOV, WebM or MKV.',
      'Aim for a file size in MB (the Half and A quarter buttons fill it in), or for a quality level: High, Balanced or Small.',
      'Lower the resolution or the frame rate if you like, and choose what happens to the sound: kept as it is, re-encoded at 128 or 96 kbit/s, or removed.',
      'Read the estimate, then press Compress the video. The bar shows progress and Cancel stops it.',
      'Compare the sizes, bitrates and resolution of the two files in the table, play the result, and download it.'
    ],
    uses: [
      ['Email and chat limits', 'Bring a phone video under an attachment limit, such as 25 MB, without guessing at settings.'],
      ['Course and site uploads', 'A smaller file uploads faster and uses less of a hosting plan’s storage.'],
      ['Screen recordings', 'Long recordings of a screen shrink a lot at a lower frame rate, because little changes from frame to frame.'],
      ['Archiving', 'Keep a lighter copy of footage you want to share, and the original for editing.']
    ],
    tips: [
      'Resolution matters most. A 1080p video at 720p has under half the pixels, so the same bitrate looks much better.',
      'Screen recordings and slides compress well at 15 fps; sport and fast movement need the original frame rate.',
      'Keeping the sound as it is copies it untouched: no loss, and nothing to wait for.',
      'If the result is not smaller, the original was already well compressed. The page says so; keep the original.',
      'A target that leaves too little for the picture is flagged before you start, with the resolution that would look better.'
    ],
    limits: [
      'Files up to 2 GB. The new video is assembled in memory, so phones may run short before that; a few hundred megabytes is comfortable on most.',
      'The result is an H.264 MP4, the format phones, browsers, editors and social sites all accept. Picture formats WebCodecs cannot decode in this browser (some HEVC files from iPhones on older computers, for example) are read through the browser’s video player instead, which is slower.',
      'Where the browser has no WebCodecs video encoder, the video is played once and recorded as it plays: it takes as long as the clip, the browser chooses the format (often WebM) and the size cannot be aimed at a target.'
    ],
    support: {
      head: ['Browser', 'How it compresses'],
      rows: [
        ['Chrome, Edge (computer)', 'WebCodecs H.264, faster than real time; new sound as AAC'],
        ['Safari 16.4 and later (Mac, iPhone, iPad)', 'WebCodecs H.264; the sound is copied as it is, or re-encoded where Safari offers an audio encoder'],
        ['Firefox 130 and later (computer)', 'WebCodecs H.264 where the system provides it'],
        ['Browsers without WebCodecs', 'Recorded in real time with the media recorder; the page says so']
      ]
    },
    faq: [
      { q: 'How small can I make my video?', a: 'Any size the page accepts, but below a point the picture breaks into blocks. The page works out how many bits a second the target leaves for each pixel, and when that is too few (under 0.018 bits per pixel per frame) it says so and suggests the resolution that would look better.' },
      { q: 'Will the file be exactly the size I asked for?', a: 'At or just under it in most cases. An encoder hits a bitrate on average, not exactly, so when the first pass comes out over the target the page encodes again with the bitrate cut by the overshoot, up to three passes, and tells you how many it took and whether the target was met.' },
      { q: 'Which format does it make?', a: 'An MP4 with H.264 video, which plays on practically every phone, computer and website. The sound is copied as it was (AAC or Opus) or re-encoded as AAC, or as Opus where the browser has no AAC encoder.' },
      { q: 'Is my video uploaded?', a: 'No. The page reads the file from your device and does all the work in this tab with your browser’s own codecs. Nothing is sent anywhere.' },
      { q: 'Why is my compressed video bigger than the original?', a: 'Because the original was already compressed more tightly than the setting you chose. The table shows both bitrates; choose a lower resolution, a smaller quality or a target size, or keep the original.' },
      { q: 'Does it keep the sound in sync?', a: 'Yes. Kept sound is copied packet by packet with its own timestamps; re-encoded sound is decoded and encoded from the same starting point as the picture.' },
      { q: 'How long does it take?', a: 'On a recent computer in Chrome or Edge, usually less time than the video lasts: the progress bar gives an estimate as it goes. Phones are slower, and browsers without WebCodecs take exactly as long as the video.' }
    ],
    related: ['/video/video-trimmer/', '/video/video-converter/', '/social/reels-resizer/', '/image/image-compressor/']
  };
})();
