/**
 * The AI video tools, as specs.
 *
 * build-ai-video.js runs this file in Node to write each page, the hub, the
 * search-index rows and the sitemap lines; the page itself loads the
 * `scripts` listed, never this file. Keep the copy here, so that the page,
 * the card on the hub and the row in the directory can never disagree.
 */
(function () {
  window.AI_VIDEO_TOOLS = window.AI_VIDEO_TOOLS || {};

  window.AI_VIDEO_TOOLS['auto-captions'] = {
    order: 0,
    title: 'Auto Captions (offline)',
    pageTitle: 'Auto Captions for Reels, Shorts and TikTok — Offline | 1234Tools',
    description: 'Add word-by-word animated captions to a video, free and offline. Whisper runs in your browser — nothing is uploaded. Edit the words, pick a style, export MP4 with sound, plus SRT and VTT.',
    keywords: ['auto captions', 'add captions to video', 'subtitle generator free', 'captions for reels', 'auto subtitles offline',
      'srt generator', 'word by word captions', 'tiktok captions free no watermark'],
    glyph: 'i-ai-captions',
    glyphSvg: '<symbol id="i-ai-captions" viewBox="0 0 24 24">\n  <rect x="3" y="4.5" width="18" height="15" rx="2"/>\n  <path d="M6.5 12.3h3.2M11.8 12.3h5.7" class="thin"/>\n  <path d="M6.5 15.6h6.4M15 15.6h2.5" class="thin"/>\n  <path d="M16.4 6.4l.55 1.25 1.25.55-1.25.55-.55 1.25-.55-1.25-1.25-.55 1.25-.55z" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aivid-whisper.js', '/engine/aivid-auto-captions.js'],
    privacy: 'Your video never leaves your device. Speech is recognised by OpenAI’s Whisper tiny model (41 MB in total, MIT licence), served from this site and kept by your browser after the first visit; the runtime that executes it is served from here too, so no third-party server is contacted at all. Audio and video frames are decoded, transcribed, drawn and re-encoded in the browser. Nothing is uploaded, queued or logged, and there is no watermark.',
    model: { name: 'Whisper tiny', size: '41 MB', licence: 'MIT', source: 'https://github.com/openai/whisper', files: 'engine/models/whisper-tiny/' },
    how: [
      'Choose a video or an audio file. The sound track is decoded by your browser and the first run downloads the 41 MB speech model, which is then kept.',
      'Whisper listens in 30-second windows and writes out what it hears with timestamps. A clip takes roughly as long as it lasts on a laptop; the first window tells you the estimate.',
      'Read the words. Every segment is editable: fix a name, fix a number, nudge a cue earlier or later, or re-split the text into shorter lines.',
      'Pick a caption style — Karaoke, Pop, Bold outline or Minimal — how many words to show at once, where they sit, the font, size and colours. The preview shows the real frame.',
      'Export. The video is redrawn frame by frame with the captions burned in and re-encoded on your device with its original sound. Download the SRT and VTT too: they carry the same words and the same timings.'
    ],
    uses: [
      ['Reels, Shorts and TikTok', 'Most people watch with the sound off. Word-by-word captions in a 9:16 frame are what keeps them watching, and this does them without an app, a subscription or a watermark.'],
      ['Course clips and tutorials', 'Burn the captions into the lesson for the player, and keep the SRT for the platform’s own caption track so the words are searchable.'],
      ['Interviews and talking heads', 'A clean Minimal style under the speaker, with the transcript corrected before export, is the format broadcast uses.'],
      ['Accessibility', 'Captions make a clip usable for deaf and hard-of-hearing viewers and anyone in a quiet room. A standard SRT works in every player that takes one.'],
      ['Podcast clips', 'Drop in the audio, get the words, and lay them over a still or a waveform to make a shareable clip from an episode.']
    ],
    tips: [
      'Clear speech transcribes best. A lav or a headset mic beats the phone’s own from across the room, and music under the voice costs accuracy.',
      'English only for now. Other languages are recognised by the same model but this version prompts it in English; they will come once the English result is right.',
      'Proofread names, brands and numbers before you export — the smallest Whisper is good at everyday words and weak on proper nouns. The segment text is editable.',
      'One to three words on screen at a time is what Reels and Shorts use. Line mode suits an interview or a lecture.',
      'For Reels, Shorts and TikTok export 1080×1920. Keep captions inside the safe area — the position control already does — so the app’s own buttons do not sit on them.',
      'On a phone keep clips to a few minutes: transcription is slower there and the re-encode has to hold every frame. A laptop handles ten minutes.'
    ],
    faq: [
      { q: 'Is my video uploaded?',
        a: 'No. The speech model is OpenAI’s Whisper tiny — about 41 MB in total, published under the MIT licence — served from this site, downloaded once and kept by your browser. The runtime that executes it is served from here too. Audio and frames never leave the browser: your video is decoded, transcribed, redrawn and re-encoded on your own device. We never receive it, and there is no account and no watermark.' },
      { q: 'How accurate is it?',
        a: 'Whisper tiny is the smallest of the Whisper models, chosen because it is the one a browser can hold and run at close to real time. Clear English speech comes out well; strong accents, music under the voice, cross-talk and proper nouns come out worse. The text is editable before export, and you should read it through — thirty seconds of proofreading is the difference between captions and a caption meme.' },
      { q: 'Which languages does it understand?',
        a: 'English, in this version. The model itself is multilingual, but the prompt here asks for English transcription, and other languages are not yet offered until the English result has been proven in the wild.' },
      { q: 'How long does it take?',
        a: 'About as long as the clip lasts on a laptop — a 60-second video takes roughly a minute to transcribe and another to re-encode at 1080p. A phone is two to three times slower. The first window gives a live estimate, and you can cancel at any point.' },
      { q: 'Why did I get a WebM instead of an MP4?',
        a: 'MP4 is encoded on the device with the browser’s WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the captioned clip is recorded as WebM, which every browser and most apps play. Convert it if a site insists on MP4, or open the page in Chrome or Edge.' },
      { q: 'Does the sound stay in the exported video?',
        a: 'Yes. The original sound track is decoded, re-encoded as AAC (or Opus where AAC is not available) and muxed into the new file alongside the captioned frames. In the rare browser that can encode video but not audio, the tool says so before you download, and the result head says so too — a silent clip is never passed off as the original.' },
      { q: 'Can I use the SRT or VTT somewhere else?',
        a: 'Yes. They are standard SubRip and WebVTT files, with cues of at most two lines and 42 characters a line, and the same timings as the burned-in captions. YouTube, Vimeo, Instagram, LinkedIn, Premiere, DaVinci Resolve, CapCut and VLC all take them.' },
      { q: 'How are the word timings worked out?',
        a: 'Whisper gives a start and end time for each phrase it hears. Each phrase is then split into words and its time shared out in proportion to the length of each word. That is approximate, but a word is on screen for only a few hundred milliseconds, and the result reads as in-time for the karaoke and pop styles. Nudge any segment by a tenth of a second if it needs it.' },
      { q: 'What are the limits?',
        a: 'Ten minutes of audio or video per file, output at up to 1080×1920 (or 1920×1080 for landscape), and one file at a time. The limits exist because everything is held in your browser’s memory; there is no server to send the rest to.' }
    ],
    related: ['/ai-image/text-behind-image/', '/image/social-media-resizer/', '/text/word-counter/', '/image/image-compressor/', '/image/meme-generator/']
  };
})();
