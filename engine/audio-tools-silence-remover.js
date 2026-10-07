/**
 * Silence Remover — the spec build-audio.js reads. Checked by
 * build/audio/tests/audio-tools.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['silence-remover'] = {
    order: 6,
    title: 'Silence Remover',
    pageTitle: 'Silence Remover — Cut Pauses From Audio, Free | 1234Tools',
    description: 'Take the long pauses out of a recording in your browser: set how quiet and how long a silence is, see what will go on the waveform, keep a little either side so words are not clipped. Nothing is uploaded.',
    keywords: ['silence remover', 'remove silence from audio', 'cut silence', 'remove pauses from audio', 'truncate silence', 'tighten podcast audio', 'remove dead air', 'trim silence mp3'],
    glyph: 'i-audio-silence',
    glyphSvg: '<symbol id="i-audio-silence" viewBox="0 0 24 24">\n  <path d="M3 9v6M6 7v10M9 10v4"/>\n  <path d="M11.5 12h2" class="thin"/>\n  <path d="M16 10v4M19 7v10M21.5 9v6"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/audio-dsp.js', '/engine/render-audio.js', '/engine/audio-silence-remover.js'],
    privacy: 'Nothing you add is uploaded. Your file is decoded by your browser’s own audio decoder, and the silences are found and cut in a worker in this tab. The settings are remembered in this browser; the file and its name are not kept. There is no account.',
    how: [
      'Choose a recording or a video.',
      'Set how quiet counts as silence (−30 to −60 dBFS) and how long it must last (0.3 to 3 s). The silences found are shaded on the waveform, with how much will go.',
      'Choose how much to keep either side so words are not clipped, and whether to leave nothing or a short pause in each gap.',
      'Choose WAV, M4A or Opus and press Remove the silences.'
    ],
    uses: [
      ['Podcasts and interviews', 'Take out the long thinking pauses without editing them one by one.'],
      ['Lecture recordings', 'Remove the minutes of quiet while the class works.'],
      ['Voice-overs', 'Tighten a read-through so it fits the video.'],
      ['Dictation', 'Make a long voice memo quicker to listen back to.']
    ],
    tips: [
      'Start at −40 dBFS and 0.7 s; raise the threshold towards −30 if the room was noisy, lower it towards −60 for a quiet studio.',
      'Leaving a 0.25 s pause in each gap keeps speech natural; cutting it all makes a tight, quick edit.',
      'Each join gets a 10 ms fade so it does not click.',
      'Nothing is removed until you press the button: change the settings and watch the shading move.'
    ],
    limits: [
      'Files up to 400 MB and 3 hours; on a phone keep files short.',
      'Silence is judged by level only: steady background noise louder than the threshold counts as sound.',
      'M4A and Opus need WebCodecs’ audio encoder; where a browser lacks it, WAV still works.'
    ],
    support: {
      head: ['Browser', 'Find and remove silences', 'Save as M4A or Opus'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes, in a worker', 'Yes'],
        ['Firefox 130 and later', 'Yes, in a worker', 'Opus; M4A where the system has an AAC encoder'],
        ['Safari', 'Yes, in a worker', 'Where Safari offers the encoder'],
        ['Browsers without WebCodecs', 'Yes, as WAV', 'No']
      ]
    },
    faq: [
      { q: 'How does it decide what is silence?', a: 'It measures the level of the loudest channel over every 10 ms. A stretch where that stays under the threshold for at least the minimum length counts as one silence.' },
      { q: 'Will it cut the ends of my words?', a: 'Not with the default setting: 0.15 s of each silence is kept either side, so breaths and the tails of words stay.' },
      { q: 'Can I keep short pauses?', a: 'Yes. Silences shorter than the minimum length are left alone, and Leave in its place can shorten long ones to a 0.25 or 0.5 s pause instead of removing them.' },
      { q: 'Can I see what will be removed first?', a: 'Yes: the waveform shades every stretch that will go, and the page says how many seconds that comes to.' },
      { q: 'Does it work on music?', a: 'It finds silences anywhere, but quiet passages in music can fall under the threshold; check the shading before you save.' },
      { q: 'Is my file uploaded?', a: 'No. Everything happens in this tab.' }
    ],
    related: ['/audio/speed-changer/', '/audio/audio-trimmer/', '/audio/volume-normaliser/']
  };
})();
