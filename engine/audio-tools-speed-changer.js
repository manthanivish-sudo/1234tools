/**
 * Speed Changer — the spec build-audio.js reads. Checked by
 * build/audio/tests/audio-tools.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['speed-changer'] = {
    order: 5,
    title: 'Audio Speed Changer',
    pageTitle: 'Audio Speed Changer — Faster, Same Pitch, Free | 1234Tools',
    description: 'Speed up or slow down a recording in your browser, from 0.5× to 2×, keeping the voice at its own pitch — or let the pitch move with the speed. Saved as WAV, M4A or Opus. Nothing is uploaded.',
    keywords: ['audio speed changer', 'speed up audio', 'slow down audio', 'change audio speed without changing pitch', 'speed up mp3', 'slow down a song', 'time stretch audio', 'playback speed', 'podcast speed up'],
    glyph: 'i-audio-speed',
    glyphSvg: '<symbol id="i-audio-speed" viewBox="0 0 24 24">\n  <path d="M4.5 16a8 8 0 1 1 15 0"/>\n  <path d="M12 15l4-5" />\n  <path d="M3 11v2M21 11v2" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/audio-dsp.js', '/engine/render-audio.js', '/engine/audio-speed-changer.js'],
    privacy: 'Nothing you add is uploaded. Your file is decoded by your browser’s own audio decoder and stretched in a worker in this tab. The speed, the pitch choice, the format and the bitrate are remembered in this browser; the file and its name are not kept. There is no account.',
    how: [
      'Choose a sound file or a video.',
      'Set the speed from 0.5× to 2×, or press 0.75×, 1.25×, 1.5× or 2×.',
      'Leave Keep the pitch ticked so voices stay natural, or untick it to shift the pitch with the speed, like a record.',
      'Choose WAV, M4A or Opus and press Change the speed.'
    ],
    uses: [
      ['Lectures and podcasts', 'Listen at 1.5× without the chipmunk voice.'],
      ['Learning a language or an instrument', 'Slow a passage to 0.75× and hear every note or syllable at its real pitch.'],
      ['Fitting a time slot', 'Bring a voice-over to the length of a video.'],
      ['Nightcore and slowed edits', 'Untick Keep the pitch for the sped-up or slowed-down sound.']
    ],
    tips: [
      'Speech stays clear up to about 1.5×; music starts to smear sooner.',
      'Without Keep the pitch, 2× raises the pitch an octave and 0.5× lowers it one.',
      'The page tells you the new length and, when the pitch moves, by how many semitones.',
      'For the smoothest result, change the speed once from the original rather than in several steps.'
    ],
    limits: [
      'Files up to 400 MB and 3 hours; on a phone keep files short.',
      'Keeping the pitch uses WSOLA, which suits speech and most music; very fast or very slow settings can add a slight echo.',
      'M4A and Opus need WebCodecs’ audio encoder; where a browser lacks it, WAV still works.'
    ],
    support: {
      head: ['Browser', 'Change the speed', 'Save as M4A or Opus'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes, in a worker', 'Yes'],
        ['Firefox 130 and later', 'Yes, in a worker', 'Opus; M4A where the system has an AAC encoder'],
        ['Safari', 'Yes, in a worker', 'Where Safari offers the encoder'],
        ['Browsers without WebCodecs', 'Yes, as WAV', 'No']
      ]
    },
    faq: [
      { q: 'How does it keep the pitch?', a: 'With WSOLA, waveform-similarity overlap-add: the sound is cut into overlapping 42 ms slices, and each is taken from wherever it best continues the one before, so the waveform keeps its shape and its pitch while the slices are packed closer together or further apart.' },
      { q: 'How much faster can I go?', a: 'Up to 2×, which halves the length, or down to 0.5×, which doubles it.' },
      { q: 'What happens without Keep the pitch?', a: 'The sound is resampled, as if a record were played at another speed: 1.5× is 7.0 semitones higher and 0.75× is 5.0 semitones lower.' },
      { q: 'Does it work for music?', a: 'Yes, for moderate changes. Large changes in music with sharp drums can smear the attacks a little.' },
      { q: 'Can I change the pitch without the speed?', a: 'Not here yet: this tool changes the speed, keeping the pitch or not.' },
      { q: 'Is my file uploaded?', a: 'No. It is stretched in a worker in this tab.' }
    ],
    related: ['/audio/silence-remover/', '/audio/audio-trimmer/', '/audio/audio-converter/']
  };
})();
