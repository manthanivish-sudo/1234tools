/**
 * Mute Video — the spec build-video.js reads. The page loads the `scripts`
 * listed, never this file. Every behaviour quoted here is checked by
 * build/video/tests/video-tools.js and build/tests/claims/video.js.
 */
(function () {
  window.VIDEO_TOOLS = window.VIDEO_TOOLS || {};
  window.VIDEO_TOOLS['mute-video'] = {
    order: 4,
    title: 'Mute Video',
    pageTitle: 'Mute Video — Remove the Sound From a Video, Free | 1234Tools',
    description: 'Remove the sound from a video in your browser. The picture is copied untouched into a new MP4 or WebM, so the quality stays exactly the same and a long video takes seconds. Nothing is uploaded.',
    keywords: ['mute video', 'remove audio from video', 'remove sound from video', 'silent video', 'mute mp4', 'delete audio from video', 'video without sound', 'strip audio from video'],
    glyph: 'i-video-mute',
    glyphSvg: '<symbol id="i-video-mute" viewBox="0 0 24 24">\n  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>\n  <path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/video-mute-video.js'],
    privacy: 'Nothing you add is uploaded. The page reads your video from your device, copies its picture into a new file in this tab and saves it to your downloads. Nothing is remembered: the video and its name are not kept. There is no account.',
    how: [
      'Choose a video: MP4, MOV, WebM or MKV.',
      'The page says whether the picture can be copied untouched (nearly always) or has to be re-encoded.',
      'Press Remove the sound. The new file has the same picture and no sound track at all.'
    ],
    uses: [
      ['Background music you cannot use', 'Remove a song before posting a clip, then add your own sound in the app.'],
      ['Private conversations', 'Share what a video shows without what was said behind the camera.'],
      ['Silent loops', 'Make a looping clip for a website or a presentation that should never make a sound.'],
      ['Wind and traffic noise', 'Drop a soundtrack that is only noise.']
    ],
    tips: [
      'The picture is copied, not re-encoded, so the muted file is the original’s size less its sound.',
      'MOV and MKV videos come out as MP4; WebM stays WebM.',
      'To keep the sound but lose the picture, use Extract Audio.'
    ],
    limits: [
      'Files up to 2 GB; phones may run short of memory before that.',
      'A picture format an MP4 cannot hold as it is (VP8 inside an MKV, for example) is re-encoded, and the page says so first.'
    ],
    support: {
      head: ['Browser', 'Mute by copying'],
      rows: [
        ['Chrome, Edge, Safari, Firefox (current)', 'Yes: no codecs are needed to copy the picture'],
        ['Older browsers', 'Yes, where the page loads at all']
      ]
    },
    faq: [
      { q: 'Does muting change the picture quality?', a: 'No. The stored picture frames are copied into the new file byte for byte; only the sound track is left out.' },
      { q: 'Is the sound turned down or removed?', a: 'Removed. The new file has no sound track, so it cannot be turned back up.' },
      { q: 'How long does it take?', a: 'A few seconds for most videos, because nothing is decoded or encoded: the page only copies the picture’s data into a new file.' },
      { q: 'Which format do I get?', a: 'An MP4 for MP4, MOV and MKV videos; a WebM for WebM videos.' },
      { q: 'Can I keep the sound as a separate file?', a: 'Yes: Extract Audio saves the sound of a video as M4A, Ogg or WAV, or as an MP3 when that is how the video stores it.' },
      { q: 'Is my video uploaded?', a: 'No. The page reads the file from your device and builds the muted copy in this tab.' }
    ],
    related: ['/video/extract-audio/', '/video/video-trimmer/', '/video/video-compressor/', '/social/reels-resizer/']
  };
})();
