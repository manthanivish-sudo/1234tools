/**
 * Audio Joiner — the spec build-audio.js reads. Checked by
 * build/audio/tests/audio-tools.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['audio-joiner'] = {
    order: 3,
    title: 'Audio Joiner',
    pageTitle: 'Audio Joiner — Merge MP3, WAV and M4A Files, Free | 1234Tools',
    description: 'Join sound files into one in your browser: put them in order, add a gap of silence or a crossfade between them, and save as WAV, M4A or Opus. Mixed sample rates and mono files are matched for you. Nothing is uploaded.',
    keywords: ['audio joiner', 'merge mp3', 'join mp3 files', 'combine audio files', 'merge audio online', 'join wav files', 'audio merger', 'crossfade songs', 'combine songs into one'],
    glyph: 'i-audio-join',
    glyphSvg: '<symbol id="i-audio-join" viewBox="0 0 24 24">\n  <path d="M3 10v4M5.5 8v8M8 10v4"/>\n  <path d="M16 10v4M18.5 7v10M21 10v4"/>\n  <path d="M10 12h4M12 10v4" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/audio-dsp.js', '/engine/render-audio.js', '/engine/audio-audio-joiner.js'],
    privacy: 'Nothing you add is uploaded. Your files are decoded by your browser’s own audio decoder and joined in this tab. What goes between them, the format and the bitrate are remembered in this browser; the files and their names are not kept. There is no account.',
    how: [
      'Choose two or more sound files, or videos whose sound you want.',
      'Put them in order with the ↑ and ↓ buttons; × leaves one out.',
      'Choose what goes between them: nothing, half a second to two seconds of silence, or a crossfade of one to three seconds.',
      'Choose WAV, M4A or Opus and press Join the files.'
    ],
    uses: [
      ['Podcast episodes', 'Put the intro, the interview and the outro together in one file.'],
      ['Mixtapes and playlists', 'One continuous file of songs with crossfades between them.'],
      ['Audiobook chapters', 'Join the chapter files of a recording into one.'],
      ['Voice notes', 'Several short recordings of one conversation, as one file to send.']
    ],
    tips: [
      'A crossfade suits music; a short gap of silence suits speech.',
      'Files at a lower sample rate are resampled to the highest rate among them, so nothing is lost from the best file.',
      'If any file is stereo the result is stereo; mono files are spread to both sides.',
      'Join as WAV while you are still editing, then make an M4A or Opus at the end.'
    ],
    limits: [
      'Up to 400 MB and 3 hours a file, and the joined sound is held in memory, so on a phone keep the total short.',
      'There is no MP3 output: the usual MP3 encoder (LAME) is under the LGPL, which this site does not ship.',
      'M4A and Opus need WebCodecs’ audio encoder; where a browser lacks it, WAV still works.'
    ],
    support: {
      head: ['Browser', 'Join to WAV', 'Save as M4A or Opus'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'Yes'],
        ['Firefox 130 and later', 'Yes', 'Opus; M4A where the system has an AAC encoder'],
        ['Safari', 'Yes', 'Where Safari offers the encoder'],
        ['Browsers without WebCodecs', 'Yes', 'No']
      ]
    },
    faq: [
      { q: 'Can I join files of different formats?', a: 'Yes. An MP3, a WAV and an M4A can be joined: each is decoded first, then they are matched to one sample rate and channel count.' },
      { q: 'How does the crossfade work?', a: 'The end of one file fades out while the start of the next fades in, over the length you choose, along equal-power curves so the loudness does not dip in the middle. A file too short for the crossfade gets one half its length.' },
      { q: 'Can I change the order?', a: 'Yes: the ↑ and ↓ buttons move a file, and × takes it out.' },
      { q: 'Can I save it as MP3?', a: 'No, for licence reasons. WAV, M4A and Opus play everywhere MP3 does.' },
      { q: 'Is there a limit on how many files?', a: 'No set number; the limit is memory, since the joined sound is built in the page.' },
      { q: 'Are my files uploaded?', a: 'No. They are decoded and joined in this tab.' }
    ],
    related: ['/audio/audio-trimmer/', '/audio/audio-converter/', '/audio/volume-normaliser/']
  };
})();
