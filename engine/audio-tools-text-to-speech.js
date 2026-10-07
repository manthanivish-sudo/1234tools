/**
 * Text to Speech — the spec build-audio.js reads. Checked by
 * build/audio/tests/audio-ai.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['text-to-speech'] = {
    order: 8,
    title: 'Text to Speech',
    pageTitle: 'Text to Speech — 28 Natural Voices, Offline, Free | 1234Tools',
    description: 'Turn text into natural speech in your browser with 28 English voices, American and British. Listen, then save it as WAV, M4A or Opus. The voice runs on your device; your text is not uploaded.',
    keywords: ['text to speech', 'tts', 'text to speech free', 'read text aloud', 'text to voice', 'ai voice generator', 'text to audio', 'text to speech british voice', 'natural text to speech', 'text to speech download wav'],
    glyph: 'i-audio-tts',
    glyphSvg: '<symbol id="i-audio-tts" viewBox="0 0 24 24">\n  <path d="M3 5h9M3 9h7M3 13h5" class="thin"/>\n  <path d="M13 10h2.5l3.5-3v10l-3.5-3H13z"/>\n  <path d="M21 9.5a3.5 3.5 0 0 1 0 5" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/audio-dsp.js', '/engine/render-audio.js', '/engine/aivid-tts.js', '/engine/audio-text-to-speech.js'],
    privacy: 'Your text is not uploaded. The voice is Kokoro-82M, an open model served from this site and run on your device in a worker; the first use downloads it (about 92 MB, with a 14 MB runtime) and your browser keeps it. The voice, speed, format and bitrate are remembered in this browser; your text is not. There is no account.',
    how: [
      'Type or paste the text, up to 5,000 characters.',
      'Choose a voice — 20 American and 8 British, women and men — and a speed from 0.8× to 1.2×.',
      'Press Make the speech. The first time, the voice model is downloaded and the bar shows how far it has got; after that it starts at once.',
      'Listen on the page, then download it as WAV, M4A or Opus.'
    ],
    uses: [
      ['Voice-overs', 'A narration for a slide deck, a product video or a reel, without recording yourself.'],
      ['Proofreading', 'Hear a draft read back and catch what the eye skips.'],
      ['Accessibility', 'An audio version of a notice, a menu or instructions.'],
      ['Language practice', 'Hear how a passage of English sounds, in an American or a British voice.']
    ],
    tips: [
      'Write numbers, dates and abbreviations the way they should be said: “twenty twenty-six”, not “2026”, when it matters.',
      'Short sentences sound most natural; a comma gives a short pause and a full stop a longer one.',
      'Try two or three voices on the same paragraph: the A- and B-graded voices (Heart, Bella, Nicole, Emma) are the most natural.',
      'Every file is marked in its metadata as AI-generated speech, as the EU AI Act asks of synthetic audio.'
    ],
    limits: [
      'English only, up to 5,000 characters at a time.',
      'The first use downloads about 106 MB in all (the model and its runtime); a slow connection takes a while, once.',
      'Speed is limited to 0.8× to 1.2×, the range the model speaks well; the Audio Speed Changer can go further afterwards.',
      'It runs on the processor through WebAssembly: on a phone, long text takes noticeably longer than on a computer.'
    ],
    support: {
      head: ['Browser', 'Make speech', 'Save as M4A or Opus'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'Yes'],
        ['Firefox', 'Yes', 'Opus; M4A where the system has an AAC encoder'],
        ['Safari', 'Yes', 'Where Safari offers the encoder'],
        ['Phones', 'Yes, more slowly', 'As above']
      ]
    },
    faq: [
      { q: 'Is my text sent to a server?', a: 'No. The voice model is downloaded from this site and runs in your browser, so the text stays on your device. Only the model files travel, once, from us to you.' },
      { q: 'Can I use the audio commercially?', a: 'The model, Kokoro-82M, is under the Apache 2.0 licence, which allows commercial use. The words are yours. Say that the voice is synthetic where people could mistake it for a real person.' },
      { q: 'Why is the first time slow?', a: 'The voice model (about 92 MB) and its runtime (about 14 MB) are downloaded once. Your browser keeps them, so later uses start straight away.' },
      { q: 'Which voices are there?', a: 'Twenty-eight English voices: twenty American and eight British, women and men, from the Kokoro-82M collection.' },
      { q: 'Is the file marked as AI-generated?', a: 'Yes. A WAV carries it in its INFO comment, an M4A in its comment tag and an Opus file in a COMMENT tag, and the page labels the result too.' },
      { q: 'Can I make it speak other languages?', a: 'Not yet: the voices and the pronunciation dictionary are English only.' }
    ],
    related: ['/audio/audio-to-text/', '/ai-video/reel-maker/', '/audio/speed-changer/']
  };
})();
