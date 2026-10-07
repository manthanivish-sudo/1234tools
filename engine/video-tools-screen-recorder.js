/**
 * Screen Recorder — the spec build-video.js reads. Checked by
 * build/video/tests/video-more.js and build/tests/claims/video.js.
 */
(function () {
  window.VIDEO_TOOLS = window.VIDEO_TOOLS || {};
  window.VIDEO_TOOLS['screen-recorder'] = {
    order: 8,
    title: 'Screen Recorder',
    pageTitle: 'Screen Recorder — Record Your Screen Online, Free | 1234Tools',
    description: 'Record your screen, a window or a tab in the browser, with the tab’s sound and your microphone if you like. Pause, stop, and save as WebM or make an MP4. Nothing is uploaded and there is no time limit.',
    keywords: ['screen recorder', 'record screen', 'online screen recorder', 'screen recording with audio', 'record my screen', 'record a tab', 'free screen recorder no watermark', 'screen capture video', 'record screen and microphone'],
    glyph: 'i-video-screen',
    glyphSvg: '<symbol id="i-video-screen" viewBox="0 0 24 24">\n  <rect x="2.5" y="4" width="19" height="13" rx="2"/>\n  <path d="M8 21h8M12 17v4" class="thin"/>\n  <circle cx="12" cy="10.5" r="2.5" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/video-recorders.js'],
    privacy: 'Nothing you record is uploaded. The browser asks what to share and shows that it is sharing; the recording is kept in this tab until you save it or close the page. Whether to record the sound and the microphone is remembered in this browser; the recording is not. There is no account.',
    how: [
      'Tick whether to record the sound of what you share and to mix in your microphone.',
      'Press Start recording and choose, in the browser’s own window, the whole screen, a window or a tab.',
      'Pause and resume as you like; press Stop, or the browser’s Stop sharing, to finish.',
      'Download the recording as the browser made it, or press Make an MP4 for an H.264 MP4 with AAC sound.'
    ],
    uses: [
      ['Tutorials and demos', 'Show how something works, with your voice explaining.'],
      ['Bug reports', 'Record the steps that cause a problem, to send to whoever fixes it.'],
      ['Meetings and lessons', 'Keep a copy of a presentation you are giving.'],
      ['Feedback on a design', 'Talk through a page or a document while you scroll it.']
    ],
    tips: [
      'Share a single tab for the smallest file and the sharpest text, and to record its sound in Chrome or Edge.',
      'Close notifications first: everything on the shared screen is recorded.',
      'Use a headset when mixing in the microphone, so the speakers are not recorded twice.',
      'Make an MP4 for editors, phones and sites that do not take WebM.'
    ],
    limits: [
      'A computer browser is needed: phones do not let pages record the screen.',
      'Sound from the tab is shared by Chrome and Edge, and the whole system’s sound on Windows; other browsers record the picture only.',
      'The recording is held in the page’s memory until you save it, and is lost if the tab is closed.',
      'The format as recorded is the browser’s choice: WebM in Chrome, Edge and Firefox, MP4 in Safari.'
    ],
    support: {
      head: ['Browser', 'Record the screen', 'With its sound'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'A tab’s sound; the system’s on Windows'],
        ['Firefox (computer)', 'Yes', 'No'],
        ['Safari 14.1 and later (Mac)', 'Yes', 'No'],
        ['Phones and tablets', 'No', '—']
      ]
    },
    faq: [
      { q: 'Is there a time limit or a watermark?', a: 'No. You can record for as long as the computer has memory for the recording, and nothing is added to it.' },
      { q: 'Can it record my voice too?', a: 'Yes: tick Mix in my microphone. Your voice and the shared sound are mixed into one track.' },
      { q: 'Why is there no sound in my recording?', a: 'Only Chrome and Edge share sound, and only when the box to share it is ticked in their picker: a tab’s sound everywhere, the whole system’s on Windows.' },
      { q: 'Which format do I get?', a: 'The browser’s own: usually WebM with VP9 or VP8 and Opus sound. Make an MP4 converts it on your device to H.264 with AAC sound.' },
      { q: 'Is the recording uploaded?', a: 'No. It stays in the page until you download it.' },
      { q: 'Can I record on my phone?', a: 'No: phone browsers do not allow pages to record the screen. Use the phone’s own screen recorder.' }
    ],
    related: ['/video/webcam-recorder/', '/video/video-trimmer/', '/video/video-compressor/', '/audio/voice-recorder/']
  };
})();
