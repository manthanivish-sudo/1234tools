/**
 * Webcam Recorder — the spec build-video.js reads. Checked by
 * build/video/tests/video-more.js and build/tests/claims/video.js.
 */
(function () {
  window.VIDEO_TOOLS = window.VIDEO_TOOLS || {};
  window.VIDEO_TOOLS['webcam-recorder'] = {
    order: 9,
    title: 'Webcam Recorder',
    pageTitle: 'Webcam Recorder — Record Video From Your Camera | 1234Tools',
    description: 'Record yourself with your webcam in the browser: choose the camera and resolution, see a mirrored preview, pause and stop, then save the video or make an MP4. Nothing is uploaded.',
    keywords: ['webcam recorder', 'record webcam video', 'online webcam recorder', 'record video from camera', 'webcam video recorder free', 'record yourself online', 'video message recorder', 'camera recorder'],
    glyph: 'i-video-cam',
    glyphSvg: '<symbol id="i-video-cam" viewBox="0 0 24 24">\n  <circle cx="12" cy="10" r="6.5"/>\n  <circle cx="12" cy="10" r="2.5" class="fill"/>\n  <path d="M7.5 21h9M12 16.5V21" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/video-recorders.js'],
    privacy: 'Nothing you record is uploaded. The camera and microphone are read by your browser, which asks first and shows they are on; the recording is kept in this tab until you save it or close the page. The resolution, the microphone and the mirror setting are remembered in this browser; the recording and the camera’s name are not. There is no account.',
    how: [
      'Choose the resolution and whether to record the microphone, then press Show the camera (or go straight to Start recording) and allow the browser to use it.',
      'Once allowed, the Camera list shows every camera the browser can use.',
      'Press Start recording; pause and resume as you like, and press Stop to finish.',
      'Download the recording as the browser made it, or press Make an MP4 for an H.264 MP4 with AAC sound.'
    ],
    uses: [
      ['Video messages', 'A short hello, a thank-you or a birthday message to send.'],
      ['Applications and auditions', 'Record a self-introduction for a job, a course or a casting.'],
      ['Practice', 'Rehearse a presentation and watch it back.'],
      ['Teaching', 'A quick explanation to camera for a class.']
    ],
    tips: [
      'Face a window or a lamp: light from in front makes the biggest difference to a webcam picture.',
      'The preview is mirrored like a mirror; the recording is not, so writing reads the right way round.',
      'Look at the camera, not the screen, to meet the viewer’s eye.',
      '720p is plenty for most messages and keeps the file small.'
    ],
    limits: [
      'The camera may not offer the resolution chosen; the page says the size it actually gives.',
      'The recording is held in the page’s memory until you save it, and is lost if the tab is closed.',
      'The format as recorded is the browser’s choice: WebM in Chrome, Edge and Firefox, MP4 in Safari.',
      'The page needs permission to use the camera, and a secure (https) address, which this site is.'
    ],
    support: {
      head: ['Browser', 'Record the camera', 'As recorded'],
      rows: [
        ['Chrome, Edge', 'Yes', 'WebM (VP9 or VP8, Opus)'],
        ['Firefox', 'Yes', 'WebM'],
        ['Safari 14.1 and later', 'Yes', 'MP4 (H.264, AAC)'],
        ['Phones', 'Yes, in the phone’s browser', 'As above']
      ]
    },
    faq: [
      { q: 'Is my video sent anywhere?', a: 'No. The camera’s picture goes from the browser to this page and stays in memory until you download it. Closing the tab discards it.' },
      { q: 'Why is my video mirrored?', a: 'Only the preview is, so moving feels natural. The recording is the right way round.' },
      { q: 'Can I choose which camera?', a: 'Yes. Once the browser has been allowed, the Camera list shows every camera it can use, such as a laptop’s built-in one and a USB webcam.' },
      { q: 'How long can I record?', a: 'As long as the device has memory for the recording; the clock shows the time and the size as you go.' },
      { q: 'Can I record without sound?', a: 'Yes: untick Record the microphone too.' },
      { q: 'Which format do I get?', a: 'The browser’s own, usually WebM. Make an MP4 converts it on your device for phones and editors.' }
    ],
    related: ['/video/screen-recorder/', '/audio/voice-recorder/', '/video/video-trimmer/', '/video/video-compressor/']
  };
})();
