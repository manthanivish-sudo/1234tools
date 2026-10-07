/**
 * Video Trimmer — the spec build-video.js reads. The page loads the
 * `scripts` listed, never this file. Every behaviour quoted here is checked
 * by build/video/tests/video-tools.js and build/tests/claims/video.js.
 */
(function () {
  window.VIDEO_TOOLS = window.VIDEO_TOOLS || {};
  window.VIDEO_TOOLS['video-trimmer'] = {
    order: 2,
    title: 'Video Trimmer',
    pageTitle: 'Video Trimmer — Cut a Video to the Frame, Free | 1234Tools',
    description: 'Trim a video in your browser: drag the start and end, step them a frame at a time, play the selection, then cut exactly on your frame or copy it without re-encoding. MP4, MOV and WebM. Nothing is uploaded.',
    keywords: ['video trimmer', 'trim video', 'cut video', 'cut mp4', 'trim mp4 online', 'video cutter', 'cut the start of a video', 'trim video without losing quality', 'shorten a video', 'clip a video'],
    glyph: 'i-video-trim',
    glyphSvg: '<symbol id="i-video-trim" viewBox="0 0 24 24">\n  <rect x="2.5" y="6" width="19" height="12" rx="2.5"/>\n  <path d="M8 6v12M16 6v12" class="thin"/>\n  <path d="M8 3.5v2.5M16 3.5v2.5M8 18v2.5M16 18v2.5"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/video-video-trimmer.js'],
    privacy: 'Nothing you add is uploaded. The page reads your video from your device, shows it in your browser’s own player and makes the trimmed copy in this tab. Only the cutting method you choose is remembered in this browser; the video, its name and the times are not kept. There is no account.',
    how: [
      'Choose a video: MP4, MOV, WebM or MKV.',
      'Drag the two handles to the start and end you want. With a handle selected, the arrow keys move it one frame at a time (Shift moves a second), and the ◀ ▶ buttons do the same; you can also type the times in seconds.',
      'The player shows the frame under the handle you move. Press Play the selection to watch the part you are keeping.',
      'Choose how to cut: Exact starts on the very frame you chose and re-encodes the part; Fast copies it untouched, from the keyframe at or before your start.',
      'Press Trim the video, then play or download the result.'
    ],
    uses: [
      ['Cutting the fumble at the start', 'Lose the seconds of fiddling with the phone before the real recording begins.'],
      ['Sharing one moment', 'Keep the goal, the speech or the punchline and send only that.'],
      ['Tidying screen recordings', 'Trim the start and end of a tutorial or a bug report to the steps that matter.'],
      ['Fitting a length limit', 'Bring a clip under a platform’s maximum length.']
    ],
    tips: [
      'For a cut that keeps the original quality, use Fast: the page says how far before your start the nearest keyframe is.',
      'Phone videos usually have a keyframe every second or two; screen recordings can go much longer between them.',
      'Exact re-encodes only the part you keep, at a bitrate a little above the original’s, and copies the sound as it is.',
      'Arrow keys on a handle step one frame, so you can stop exactly before a cut or a flash.'
    ],
    limits: [
      'Files up to 2 GB; phones may run short of memory before that.',
      'A Fast cut can only start on a keyframe, so it may begin a little earlier than your start; Exact starts on your frame.',
      'Exact cuts are re-encoded as H.264 MP4 (or VP9 WebM for a WebM). MOV and MKV files are saved as MP4.',
      'Where the browser has no WebCodecs video encoder, Exact plays the part once and records it as it plays.'
    ],
    support: {
      head: ['Browser', 'Fast (copy)', 'Exact (re-encode)'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'Yes, faster than real time'],
        ['Safari 16.4 and later', 'Yes', 'Yes'],
        ['Firefox 130 and later (computer)', 'Yes', 'Yes, where the system has an H.264 encoder'],
        ['Browsers without WebCodecs', 'Yes', 'Recorded in real time; the page says so']
      ]
    },
    faq: [
      { q: 'Can I trim a video without losing quality?', a: 'Yes: choose Fast. The frames are copied into the new file untouched, so the quality and the sound are exactly the original’s. The one catch is that a cut can only begin on a keyframe — a frame stored whole — so the clip starts at the keyframe at or before your start, and the page tells you how much earlier that is.' },
      { q: 'What is the difference between Exact and Fast?', a: 'Exact decodes the part you keep and encodes it again, so it starts on the very frame you chose. Fast copies the stored frames as they are: no loss and almost no waiting, but it starts at a keyframe.' },
      { q: 'How precise is the cut?', a: 'One frame. The handles move between the frame times stored in the file, the arrow keys step one frame, and the player shows the frame the handle is on.' },
      { q: 'Is the sound kept?', a: 'Yes. In both modes the sound is copied packet by packet for the part you keep.' },
      { q: 'Which format do I get?', a: 'An MP4 for MP4, MOV and MKV videos, and a WebM for WebM videos.' },
      { q: 'Is my video uploaded?', a: 'No. The page reads the file from your device and makes the trimmed copy in this tab. Nothing is sent anywhere.' }
    ],
    related: ['/video/video-compressor/', '/video/mute-video/', '/social/video-to-gif/', '/ai-video/auto-captions/']
  };
})();
