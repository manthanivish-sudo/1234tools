/**
 * Extract Audio from Video — the spec build-video.js reads. The page loads
 * the `scripts` listed, never this file. Every behaviour quoted here is
 * checked by build/video/tests/video-tools.js and build/tests/claims/video.js.
 */
(function () {
  window.VIDEO_TOOLS = window.VIDEO_TOOLS || {};
  window.VIDEO_TOOLS['extract-audio'] = {
    order: 5,
    title: 'Extract Audio from Video',
    pageTitle: 'Extract Audio From Video — MP4 to M4A, WAV, Ogg | 1234Tools',
    description: 'Save the sound of a video as its own file in your browser: the original sound copied out untouched, or WAV, or a small Opus file. The whole sound or a part. Nothing is uploaded.',
    keywords: ['extract audio from video', 'mp4 to audio', 'video to audio', 'mp4 to wav', 'mp4 to m4a', 'get sound from video', 'convert video to audio', 'rip audio from video', 'save audio from mp4'],
    glyph: 'i-video-audio',
    glyphSvg: '<symbol id="i-video-audio" viewBox="0 0 24 24">\n  <rect x="2.5" y="5.5" width="11" height="13" rx="2.5"/>\n  <path d="M18 5v9.5"/>\n  <circle cx="16.2" cy="15.8" r="2.2"/>\n  <path d="M18 5l3.5 1.5"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/video-demux.js', '/engine/render-video.js', '/engine/video-extract-audio.js'],
    privacy: 'Nothing you add is uploaded. The page reads your video from your device, takes its sound out in this tab and saves it to your downloads. The format and the Opus bitrate are remembered in this browser; the video, its name and the times are not kept. There is no account.',
    how: [
      'Choose a video: MP4, MOV, MKV or WebM.',
      'Choose how to save the sound. Original sound, untouched copies it out as it is stored (AAC as an .m4a, Opus as an .ogg, MP3 as an .mp3). WAV is uncompressed. Opus is small, at 64, 96 or 128 kbit/s.',
      'For a part, type From and To in seconds; leave them for the whole sound.',
      'Press Extract the sound, then listen to it on the page or download it.'
    ],
    uses: [
      ['Podcasts and interviews', 'Take the conversation out of a video call recording for editing or listening on the go.'],
      ['Music from your own videos', 'Keep the sound of a performance or a rehearsal you filmed.'],
      ['Transcription', 'A WAV or Opus file is what most transcription tools ask for.'],
      ['Voice notes', 'Turn a selfie video into a voice note you can send as a sound file.']
    ],
    tips: [
      'Original sound, untouched is the best choice when it is offered: no loss, and it takes seconds.',
      'WAV is about 10 MB a minute at 44.1 kHz stereo; Opus at 96 kbit/s is about 0.7 MB a minute.',
      'For speech, Opus at 64 kbit/s is clear and very small.',
      'A part copied untouched starts and ends on whole packets, within about 0.03 s of the times typed; WAV and Opus cut to the sample.'
    ],
    limits: [
      'Files up to 2 GB; phones may run short of memory before that.',
      'There is no MP3 encoder here: the usual one for the web (LAME) is under the LGPL, which this site does not ship. An MP3 sound track inside a video is copied out as an MP3.',
      'Re-encoding to Opus or M4A needs WebCodecs’ audio encoder; where a browser lacks it, WAV and the untouched copy still work.'
    ],
    support: {
      head: ['Browser', 'Original copy', 'WAV', 'Opus (.ogg)'],
      rows: [
        ['Chrome, Edge (computer)', 'Yes', 'Yes', 'Yes'],
        ['Firefox 130 and later (computer)', 'Yes', 'Yes', 'Yes'],
        ['Safari', 'Yes', 'Yes', 'Where Safari offers an Opus encoder'],
        ['Browsers without WebCodecs', 'Yes', 'Yes, for files up to 600 MB', 'No']
      ]
    },
    faq: [
      { q: 'How do I get the audio from an MP4?', a: 'Choose the MP4 and press Extract the sound. With Original sound, untouched, the AAC sound inside most MP4s is copied out as an .m4a file with no re-encoding, which plays on phones, computers and in music apps.' },
      { q: 'Can I save it as MP3?', a: 'Only when the video’s own sound is MP3, which is copied out as it is. The usual MP3 encoder for the web is under a licence this site does not ship, so there is no MP3 encoding; M4A, Opus and WAV play everywhere MP3 does.' },
      { q: 'Does it lose quality?', a: 'Not with the untouched copy or WAV. Opus and M4A re-encode the sound, which is very hard to hear at 96 kbit/s and above.' },
      { q: 'Can I take just one part?', a: 'Yes. Type From and To in seconds before extracting.' },
      { q: 'Why is the WAV so big?', a: 'WAV stores every sample uncompressed: 44,100 or 48,000 a second for each channel. It is the easiest format to edit and plays everywhere; choose Opus for a small file.' },
      { q: 'Is my video uploaded?', a: 'No. The page reads the file from your device and takes the sound out in this tab.' }
    ],
    related: ['/video/mute-video/', '/video/video-converter/', '/ai-video/auto-captions/', '/video/video-trimmer/']
  };
})();
