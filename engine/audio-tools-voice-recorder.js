/**
 * Voice Recorder — the spec build-audio.js reads. Checked by
 * build/audio/tests/audio-tools.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['voice-recorder'] = {
    order: 7,
    title: 'Voice Recorder',
    pageTitle: 'Voice Recorder — Record Audio Online, Free | 1234Tools',
    description: 'Record your voice in the browser with a level meter, a clock and pause, then save the recording as it is or as WAV, M4A or Opus. Choose the microphone and switch noise suppression off for music. Nothing is uploaded.',
    keywords: ['voice recorder', 'online voice recorder', 'record audio', 'microphone recorder', 'record my voice', 'audio recorder online free', 'record voice to mp3', 'voice memo'],
    glyph: 'i-audio-mic',
    glyphSvg: '<symbol id="i-audio-mic" viewBox="0 0 24 24">\n  <rect x="9" y="3" width="6" height="11" rx="3"/>\n  <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/audio-dsp.js', '/engine/render-audio.js', '/engine/audio-voice-recorder.js'],
    privacy: 'Nothing you record is uploaded. The microphone is read by your browser and the recording is kept in this tab until you save it or close the page; the browser shows its own recording indicator while the microphone is on. The processing switches and the save format are remembered in this browser; the recording and the microphone’s name are not kept. There is no account.',
    how: [
      'Press Record and allow the browser to use your microphone. The meter shows the level and the clock counts.',
      'Pause and Resume as often as you like; Stop ends the recording and turns the microphone off.',
      'Download the recording as the browser made it, or press Save as to make a WAV, M4A or Opus copy.',
      'Once the browser has been allowed, the Microphone list shows every microphone it can use.'
    ],
    uses: [
      ['Voice notes and messages', 'Record a message to send as a sound file.'],
      ['Practice', 'Record a speech, a song or an instrument and listen back.'],
      ['Narration', 'Record a voice-over for slides or a video.'],
      ['Interviews', 'Record a conversation on a laptop, then trim and normalise it here.']
    ],
    tips: [
      'Keep the meter in the upper half while you speak, and away from the right-hand end, where it clips.',
      'For music, untick echo cancellation, noise suppression and automatic gain: they are made for speech and can pump or dull an instrument.',
      'A headset or a microphone close to the mouth beats the laptop’s built-in one.',
      'Recordings are kept in the page only: download before you close the tab.'
    ],
    limits: [
      'The recording is held in the page’s memory: at the 64 kbit/s it asks for, an hour is about 30 MB in Chrome and Edge.',
      'The format as recorded is the browser’s choice: Opus in WebM in Chrome, Edge and Firefox, AAC in MP4 in Safari.',
      'The page needs permission to use the microphone, and a secure (https) address, which this site is.'
    ],
    support: {
      head: ['Browser', 'Record', 'As recorded'],
      rows: [
        ['Chrome, Edge', 'Yes', 'Opus in WebM'],
        ['Firefox', 'Yes', 'Opus in WebM'],
        ['Safari 14.1 and later', 'Yes', 'AAC in MP4'],
        ['Very old browsers', 'No: the page says so', '—']
      ]
    },
    faq: [
      { q: 'Is my recording sent anywhere?', a: 'No. The browser hands the microphone’s sound to this page, which keeps it in memory until you download it. Nothing is uploaded, and closing the tab discards it.' },
      { q: 'How long can I record?', a: 'As long as the device has memory for it: the page asks for 64 kbit/s, about 30 MB an hour. The clock shows how long you have been going.' },
      { q: 'Why does the browser ask for permission?', a: 'Every browser asks before a page may use the microphone, and shows a recording indicator while it is on. You can take the permission back in the address bar at any time.' },
      { q: 'Can I choose which microphone?', a: 'Yes. After the first recording, or once permission is given, the Microphone list shows every microphone the browser can use.' },
      { q: 'Why turn off noise suppression?', a: 'It is tuned for speech and treats a held note or a guitar’s sustain as noise to remove. For music, switch it and the other two off.' },
      { q: 'Can I save as MP3?', a: 'No, for licence reasons: WAV, M4A and Opus play everywhere MP3 does.' }
    ],
    related: ['/audio/audio-trimmer/', '/audio/volume-normaliser/', '/audio/silence-remover/']
  };
})();
