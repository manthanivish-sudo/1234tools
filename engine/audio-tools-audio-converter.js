/**
 * Audio Converter — the spec build-audio.js reads. The page loads the
 * `scripts` listed, never this file. Every behaviour quoted here is checked
 * by build/audio/tests/audio-tools.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['audio-converter'] = {
    order: 1,
    title: 'Audio Converter',
    pageTitle: 'Audio Converter — MP3, FLAC, Ogg to WAV, M4A, Opus | 1234Tools',
    description: 'Convert sound files in your browser: MP3, WAV, M4A, FLAC, Ogg or the sound of a video to WAV, M4A (AAC) or Opus. Several at once, stereo or mono, any common sample rate. Nothing is uploaded.',
    keywords: ['audio converter', 'mp3 to wav', 'flac to wav', 'wav to m4a', 'ogg to wav', 'm4a to wav', 'convert audio online free', 'audio file converter', 'wav to opus', 'convert to mono'],
    glyph: 'i-audio-convert',
    glyphSvg: '<symbol id="i-audio-convert" viewBox="0 0 24 24">\n  <path d="M3 10v4M6 8v8M9 10v4"/>\n  <path d="M12.5 12h5l-2-2M17.5 12l-2 2" class="thin"/>\n  <path d="M20.5 7v10"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/audio-dsp.js', '/engine/render-audio.js', '/engine/zip.js', '/engine/audio-audio-converter.js'],
    privacy: 'Nothing you add is uploaded. Your files are decoded by your browser’s own audio decoder, converted in this tab and saved to your downloads. The format, bitrate, channels and sample rate you choose are remembered in this browser; the files and their names are not kept. There is no account.',
    how: [
      'Choose one or several files: MP3, WAV, M4A, FLAC, Ogg, WebM, or a video whose sound you want.',
      'Choose WAV (uncompressed), M4A (AAC, 96 to 192 kbit/s) or Opus (32 to 128 kbit/s), and whether to keep the channels or mix to mono.',
      'For WAV, keep the file’s own sample rate or pick 48, 44.1, 22.05 or 16 kHz.',
      'Press Convert. Each file is listed with what it became, or why it could not be converted; with several, Download all as a ZIP saves them together.'
    ],
    uses: [
      ['Editing software', 'Many editors and DAWs want WAV: open an MP3 or M4A in them without trouble.'],
      ['Speech recognition', 'Transcription services often ask for 16 kHz mono WAV.'],
      ['Saving space', 'Turn big WAV recordings into M4A or Opus files a tenth of the size.'],
      ['Old phones and car stereos', 'M4A plays on almost every phone and stereo made in the last fifteen years.']
    ],
    tips: [
      'For the smallest file at good quality, choose Opus: 96 kbit/s suits music and 32 kbit/s is clear for speech.',
      'WAV is the safest for editing; it is about 10 MB a minute in stereo at 44.1 kHz.',
      'Mixing to mono halves a WAV and suits speech; music sounds flatter.',
      'Converting an MP3 to WAV does not restore detail the MP3 left out; it only makes it easier to edit.'
    ],
    limits: [
      'Files up to 400 MB and 3 hours each. The sound is decoded into memory (about 23 MB a minute in stereo), so on a phone keep to shorter files.',
      'There is no MP3 output: the usual MP3 encoder (LAME) is under the LGPL, which this site does not ship.',
      'What can be opened depends on the browser: Chrome, Edge and Firefox open Ogg and FLAC; Safari opens MP3, WAV, M4A and FLAC.',
      'M4A and Opus need WebCodecs’ audio encoder; where a browser lacks it, WAV still works.'
    ],
    support: {
      head: ['Browser', 'WAV', 'M4A (AAC)', 'Opus'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'Yes', 'Yes'],
        ['Firefox 130 and later', 'Yes', 'Where the system has an AAC encoder', 'Yes'],
        ['Safari', 'Yes', 'Where Safari offers an AAC encoder', 'Where Safari offers an Opus encoder'],
        ['Browsers without WebCodecs', 'Yes', 'No', 'No']
      ]
    },
    faq: [
      { q: 'Can I convert to MP3?', a: 'No. The usual MP3 encoder for the web is under the LGPL, a licence this site does not ship. M4A (AAC) gives the same quality in a smaller file and plays everywhere MP3 does.' },
      { q: 'Does converting lose quality?', a: 'To WAV, no: the decoded sound is written as it is, at 16 bits. To M4A or Opus the sound is compressed again; at 128 kbit/s or more that is very hard to hear.' },
      { q: 'Can I convert many files at once?', a: 'Yes. Choose or drop several; they are converted one after another, each is listed with its result or the reason it failed, and Download all as a ZIP saves them together.' },
      { q: 'Will the sample rate change?', a: 'Only if you choose a new one for WAV. M4A is saved at 44.1 or 48 kHz and Opus at 48 kHz, because those formats work at those rates; the page says which.' },
      { q: 'Can I take the sound out of a video?', a: 'Yes: choose the video here. Extract Audio, in the video tools, can also copy the sound out without re-encoding.' },
      { q: 'Is my audio uploaded?', a: 'No. The browser decodes it on your device and the new file is made in this tab.' }
    ],
    related: ['/audio/audio-trimmer/', '/video/extract-audio/', '/video/video-converter/', '/ai-video/auto-captions/']
  };
})();
