/**
 * Audio to Text — the spec build-audio.js reads. Checked by
 * build/audio/tests/audio-ai.js and build/tests/claims/audio.js.
 */
(function () {
  window.AUDIO_TOOLS = window.AUDIO_TOOLS || {};
  window.AUDIO_TOOLS['audio-to-text'] = {
    order: 9,
    title: 'Audio to Text',
    pageTitle: 'Audio to Text — Transcribe Offline, SRT Too, Free | 1234Tools',
    description: 'Transcribe a recording to text in your browser with Whisper running on your device: plain text with times, or SRT and VTT subtitles. English and 98 other languages. Nothing is uploaded.',
    keywords: ['audio to text', 'transcribe audio', 'speech to text', 'transcription free', 'mp3 to text', 'voice to text', 'transcribe audio to text free', 'whisper transcription online', 'audio to srt', 'transcribe offline'],
    glyph: 'i-audio-stt',
    glyphSvg: '<symbol id="i-audio-stt" viewBox="0 0 24 24">\n  <path d="M3 9v6M5.5 7v10M8 10v4"/>\n  <path d="M12 7h9M12 11h9M12 15h6" class="thin"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/aivid-whisper.js', '/engine/aivid-auto-captions.js', '/engine/audio-audio-to-text.js'],
    privacy: 'Your recording is not uploaded. It is decoded by your browser and transcribed on your device by Whisper tiny, a speech model served from this site and kept by your browser after the first use (41 MB). The language and the time setting are remembered in this browser; the recording and the transcript are not kept. There is no account.',
    how: [
      'Choose a recording or a video, up to an hour.',
      'Choose the language, or leave Auto-detect, which listens to the first 30 seconds.',
      'Press Transcribe. The first time, the speech model is downloaded; then the bar follows the recording.',
      'Read the transcript on the page, copy it, or download it as TXT, SRT or VTT.'
    ],
    uses: [
      ['Meeting notes', 'A rough transcript of a recorded call to search and quote from.'],
      ['Interviews and podcasts', 'A first draft to correct, quicker than typing from scratch.'],
      ['Subtitles', 'SRT or VTT files for a video player or an upload.'],
      ['Voice memos', 'Turn spoken notes into text you can paste.']
    ],
    tips: [
      'Clear speech close to the microphone transcribes best; music under the voice and crosstalk make mistakes.',
      'Choosing the language rather than Auto-detect avoids a wrong guess on a short or quiet start.',
      'Whisper tiny is the smallest Whisper: quick and private, but expect to correct names and technical words.',
      'Untick Show the time of each line for clean text to paste into a document.'
    ],
    limits: [
      'Up to an hour of sound. On a computer it usually runs faster than the recording plays; phones are slower.',
      'Whisper tiny is most accurate in English. In our tests it wrote Hindi speech in English and produced no readable Bengali.',
      'It writes what it hears, without telling speakers apart.',
      'The first use downloads the 41 MB model from this site.'
    ],
    support: {
      head: ['Browser', 'Transcribe'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes'],
        ['Firefox', 'Yes'],
        ['Safari', 'Yes, for formats Safari decodes'],
        ['Phones', 'Yes, more slowly']
      ]
    },
    faq: [
      { q: 'Is my recording uploaded?', a: 'No. The speech model is downloaded from this site and runs in your browser, so the recording is transcribed on your device and never sent anywhere.' },
      { q: 'How accurate is it?', a: 'For clear English speech, usually most words are right; on our test sentence it got over 70% of the words. Accents, noise and technical terms bring more mistakes, so read it through.' },
      { q: 'Which languages does it understand?', a: 'Whisper knows 99 languages. Thirteen are listed by name; Auto-detect can return any of them. The smallest model is far better in English than in most others.' },
      { q: 'Can I get subtitles?', a: 'Yes: Download SRT or Download VTT gives timed subtitles, split into readable lines.' },
      { q: 'How long does it take?', a: 'On a recent computer, usually less time than the recording lasts. The bar shows how far through the sound it is.' },
      { q: 'Does it tell speakers apart?', a: 'No. It writes one transcript of everything it hears.' }
    ],
    related: ['/audio/text-to-speech/', '/ai-video/auto-captions/', '/audio/silence-remover/']
  };
})();
