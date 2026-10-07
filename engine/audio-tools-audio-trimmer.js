/**
 * Audio Trimmer — the spec build-audio.js reads. The page loads the
 * `scripts` listed, never this file. Every behaviour quoted here is checked
 * by build/audio/tests/audio-tools.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['audio-trimmer'] = {
    order: 2,
    title: 'Audio Trimmer',
    pageTitle: 'Audio Trimmer — Cut MP3, WAV and M4A, Free | 1234Tools',
    description: 'Cut a sound file in your browser: see its waveform, drag the start and end, play the part, then keep it or cut it out, with fades if you like. To the millisecond. Nothing is uploaded.',
    keywords: ['audio trimmer', 'trim mp3', 'cut mp3', 'audio cutter', 'cut audio online', 'trim wav', 'ringtone maker', 'cut a song', 'remove part of audio', 'mp3 cutter free'],
    glyph: 'i-audio-trim',
    glyphSvg: '<symbol id="i-audio-trim" viewBox="0 0 24 24">\n  <path d="M3 11v2M6 9v6M9 6v12M12 9v6M15 7v10M18 10v4M21 11v2" class="thin"/>\n  <path d="M8 3.5v17M16 3.5v17"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/audio-dsp.js', '/engine/render-audio.js', '/engine/audio-audio-trimmer.js'],
    privacy: 'Nothing you add is uploaded. Your file is decoded by your browser’s own audio decoder, cut in this tab and saved to your downloads. What to keep, the fades, the format and the bitrate are remembered in this browser; the file, its name and the times are not kept. There is no account.',
    how: [
      'Choose a sound file: MP3, WAV, M4A, FLAC, Ogg, or a video whose sound you want to cut.',
      'Drag the handles over the waveform, or type the start and end in seconds. With a handle selected, the arrow keys move it a tenth of a second (Shift: a second), and the ◀ ▶ buttons move it 10 ms.',
      'Press Play the selection to hear it. Choose Keep the selection, or Cut the selection out to remove a part and join what is either side.',
      'Add a fade in or out if you like, choose WAV, M4A or Opus, and press Trim the sound.'
    ],
    uses: [
      ['Ringtones and alerts', 'Keep the 20 seconds you want from a song or a recording.'],
      ['Podcasts and interviews', 'Cut the false start, the cough or the sound check.'],
      ['Voice notes', 'Trim the silence at the start and the fumbling with the phone at the end.'],
      ['Samples', 'Lift one bar, one word or one effect for an edit.']
    ],
    tips: [
      'Cut on a quiet point in the waveform and a join sounds natural.',
      'A short fade out (0.5 to 1 s) stops a clip ending abruptly mid-note.',
      'When cutting a part out, the page puts a 10 ms fade either side of the join, so it does not click.',
      'Save as WAV while you are still editing; make the M4A or Opus at the end.'
    ],
    limits: [
      'Files up to 400 MB and 3 hours. The sound is decoded into memory, so on a phone keep to shorter files.',
      'MP3 is not offered as an output: the usual MP3 encoder (LAME) is under the LGPL, which this site does not ship.',
      'An M4A or Opus result is encoded again, which loses a little; WAV keeps every sample of the part as it was decoded.'
    ],
    support: {
      head: ['Browser', 'Trim to WAV', 'Save as M4A or Opus'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'Yes'],
        ['Firefox 130 and later', 'Yes', 'Opus; M4A where the system has an AAC encoder'],
        ['Safari', 'Yes', 'Where Safari offers the encoder'],
        ['Browsers without WebCodecs', 'Yes', 'No']
      ]
    },
    faq: [
      { q: 'How precise is the cut?', a: 'To the sample. The times you see are the times cut: a WAV of 2.000 s to 4.000 s at 48 kHz holds exactly 96,000 samples per channel.' },
      { q: 'Can I remove a part from the middle?', a: 'Yes. Select it and choose Cut the selection out, keep the rest; the two sides are joined with a 10 ms fade so the join does not click.' },
      { q: 'Can I save it as MP3?', a: 'No: there is no MP3 encoder here, for licence reasons. WAV, M4A and Opus play on phones and computers.' },
      { q: 'Does trimming lose quality?', a: 'Not as WAV: the samples are kept as decoded. M4A and Opus are encoded again, which at 128 kbit/s is very hard to hear.' },
      { q: 'Can I trim the sound of a video?', a: 'Yes, choose the video: the sound is cut and saved as a sound file. To cut the video itself, use the Video Trimmer.' },
      { q: 'Is my file uploaded?', a: 'No. It is decoded and cut in this tab.' }
    ],
    related: ['/audio/audio-converter/', '/video/video-trimmer/', '/video/extract-audio/']
  };
})();
