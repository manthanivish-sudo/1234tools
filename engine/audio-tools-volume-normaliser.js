/**
 * Volume Normaliser — the spec build-audio.js reads. Checked by
 * build/audio/tests/audio-tools.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['volume-normaliser'] = {
    order: 4,
    title: 'Volume Normaliser',
    pageTitle: 'Volume Normaliser — LUFS Loudness, Free | 1234Tools',
    description: 'Make a recording as loud as it should be in your browser: its loudness is measured in LUFS (ITU-R BS.1770) and one gain brings it to −14, −16, −19 or −23 LUFS without letting the peaks clip. Nothing is uploaded.',
    keywords: ['volume normaliser', 'normalize audio', 'audio normalizer', 'lufs meter', 'loudness normalization', 'make audio louder', 'podcast loudness -16 lufs', 'normalize mp3', 'measure lufs online'],
    glyph: 'i-audio-level',
    glyphSvg: '<symbol id="i-audio-level" viewBox="0 0 24 24">\n  <path d="M4 20V14M9 20V9M14 20V5M19 20V11"/>\n  <path d="M2.5 8h19" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/audio-dsp.js', '/engine/render-audio.js', '/engine/audio-volume-normaliser.js'],
    privacy: 'Nothing you add is uploaded. Your file is decoded by your browser’s own audio decoder, measured and adjusted in this tab. The target, format and bitrate are remembered in this browser; the file and its name are not kept. There is no account.',
    how: [
      'Choose a sound file or a video. Its integrated loudness, true peak and sample peak are measured straight away.',
      'Choose a target: −14 LUFS for music streaming, −16 for podcasts, −19 for quieter speech, −23 for EBU R128 broadcast, or the loudest peak at −1 dBTP.',
      'Read how many decibels it will be raised or lowered by, then press Normalise.',
      'The result is measured again; the before-and-after readings are shown under it.'
    ],
    uses: [
      ['Podcasts', 'Bring every episode to −16 LUFS so listeners never reach for the volume.'],
      ['Uploads to streaming sites', 'Hear your track at the level the service will play it.'],
      ['Mixed recordings', 'Even out clips from different microphones before joining them.'],
      ['Teaching material', 'A quiet lecture recording, brought up to a level a phone speaker can carry.']
    ],
    tips: [
      'LUFS measures loudness as people hear it, not the highest peak, which is why two files that peak at the same level can sound very different.',
      'One gain changes the level only: the quiet and loud parts keep their distance from each other.',
      'When the target would push the peaks over −1 dBTP the gain stops there, and the page says how loud the result is instead.',
      'A file that is already at its target is left within a few hundredths of a decibel of where it was.'
    ],
    limits: [
      'Files up to 400 MB and 3 hours; the sound is held decoded in memory, so on a phone keep files short.',
      'No compressor or limiter is applied, so a very dynamic recording may stop short of a loud target; the page says by how much.',
      'Measured by ITU-R BS.1770-4 integrated loudness with its gates; loudness range is not reported.'
    ],
    support: {
      head: ['Browser', 'Measure and normalise', 'Save as M4A or Opus'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'Yes'],
        ['Firefox 130 and later', 'Yes', 'Opus; M4A where the system has an AAC encoder'],
        ['Safari', 'Yes', 'Where Safari offers the encoder'],
        ['Browsers without WebCodecs', 'Yes, as WAV', 'No']
      ]
    },
    faq: [
      { q: 'What is LUFS?', a: 'Loudness units relative to full scale: a measure of how loud a recording sounds over its whole length, from ITU-R BS.1770. It weights the frequencies the ear is most sensitive to and leaves out silent passages, so it matches what people hear far better than the peak level does.' },
      { q: 'Which target should I use?', a: 'Music for streaming: −14 LUFS. Podcasts: −16 LUFS. Broadcast in Europe: −23 LUFS (EBU R128). For quiet, dynamic speech, −19 keeps more headroom.' },
      { q: 'Will it make my audio distort?', a: 'No. The gain is never allowed to take the true peak — the highest point of the wave between samples — above −1 dBTP, so nothing clips.' },
      { q: 'Does it compress the sound?', a: 'No. It applies one gain to the whole file, so the dynamics are exactly as recorded.' },
      { q: 'How accurate is the measurement?', a: 'It follows ITU-R BS.1770-4 (K-weighting, 400 ms blocks, the −70 LUFS and −10 LU gates) and reads the EBU Tech 3341 test signals within 0.1 LU.' },
      { q: 'Is my file uploaded?', a: 'No. It is measured and adjusted in this tab.' }
    ],
    related: ['/audio/audio-joiner/', '/audio/silence-remover/', '/audio/audio-converter/']
  };
})();
