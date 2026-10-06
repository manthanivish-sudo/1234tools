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
    description: 'Add word-by-word animated captions to a video, free and offline. English is the most accurate of the 13 languages offered. Whisper runs in your browser — nothing is uploaded. MP4, SRT, VTT and ASS.',
    keywords: ['auto captions', 'add captions to video', 'subtitle generator free', 'captions for reels', 'auto subtitles offline',
      'srt generator', 'word by word captions', 'tiktok captions free no watermark', 'ass subtitle file', 'hindi captions', 'captions in any language'],
    glyph: 'i-ai-captions',
    glyphSvg: '<symbol id="i-ai-captions" viewBox="0 0 24 24">\n  <rect x="3" y="4.5" width="18" height="15" rx="2"/>\n  <path d="M6.5 12.3h3.2M11.8 12.3h5.7" class="thin"/>\n  <path d="M6.5 15.6h6.4M15 15.6h2.5" class="thin"/>\n  <path d="M16.4 6.4l.55 1.25 1.25.55-1.25.55-.55 1.25-.55-1.25-1.25-.55 1.25-.55z" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aivid-whisper.js', '/engine/aivid-auto-captions.js'],
    privacy: 'Your video never leaves your device. Speech is recognised by OpenAI’s Whisper tiny model (41 MB in total, MIT licence), served from this site and kept by your browser after the first visit; the runtime that executes it is served from here too, so no third-party server is contacted at all. Audio and video frames are decoded, transcribed, drawn and re-encoded in the browser. Nothing is uploaded, queued or logged, and there is no watermark. The settings you choose (language, look, colours, position) are remembered in this browser; your words and files are not.',
    model: { name: 'Whisper tiny', size: '41 MB', licence: 'MIT', source: 'https://github.com/openai/whisper', files: 'engine/models/whisper-tiny/' },
    how: [
      'Pick the language spoken — English, Hindi and eleven of the world’s most spoken languages by name, or Auto-detect, which listens to the first 30 seconds. Then choose a video or an audio file. The first run downloads the 41 MB speech model, which is then kept.',
      'Whisper listens in 30-second windows and writes out what it hears. Each word is then placed in time where the model was listening when it wrote it — an alignment of its own attention to the sound, the method OpenAI’s Whisper uses for word timestamps. A clip takes roughly as long as it lasts on a laptop; the first window tells you the estimate, and you can cancel.',
      'Read the words. Every segment is editable: fix a name, fix a number, nudge a cue earlier or later, or re-split the text into shorter lines. Mark keywords by clicking them in the transcript or typing a list; they are drawn in their own colour.',
      'Pick a look — Karaoke, Pop, Bold outline, Minimal, Word box, Bold capitals, Neon or One word — how many words to show at once, the font, size and colours, and where the captions sit: a preset, or drag them on the preview. Auto emoji adds an emoji after common English words. The preview shows the real frame.',
      'Export. The video is redrawn frame by frame with the captions burned in and re-encoded on your device with its original sound. Download SRT, VTT and ASS too: they carry the same words and the same timings, and the ASS also carries the style, the position and, for Karaoke, per-word timing.'
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
      'Choose the language yourself when you know it. Auto-detect is right most of the time but can confuse close languages — in our test it heard Hindi as Urdu and Urdu as Hindi.',
      'Whisper tiny is weak in some languages. It writes Hindi speech in English or Urdu script, and produces no readable Bengali; the page warns you when that happens, and the text is yours to retype.',
      'Proofread names, brands and numbers before you export — the smallest Whisper is good at everyday words and weak on proper nouns. The segment text is editable.',
      'One to three words on screen at a time is what Reels and Shorts use. Line mode suits an interview or a lecture. Mark two or three keywords per clip, not every noun.',
      'For Reels, Shorts and TikTok export 1080×1920. Keep captions inside the safe area — the presets already do — so the app’s own buttons do not sit on them; if you drag them, keep clear of the bottom fifth and the right edge.',
      'On a phone keep clips to a few minutes: transcription is slower there and the re-encode has to hold every frame. A laptop handles ten minutes.'
    ],
    faq: [
      { q: 'Is my video uploaded?',
        a: 'No. The speech model is OpenAI’s Whisper tiny — about 41 MB in total, published under the MIT licence — served from this site, downloaded once and kept by your browser. The runtime that executes it is served from here too. Audio and frames never leave the browser: your video is decoded, transcribed, redrawn and re-encoded on your own device. We never receive it, and there is no account and no watermark.' },
      { q: 'How accurate is it?',
        a: 'Whisper tiny is the smallest of the Whisper models, chosen because it is the one a browser can hold and run at close to real time. Clear English speech comes out well; strong accents, music under the voice, cross-talk and proper nouns come out worse. The text is editable before export, and you should read it through — thirty seconds of proofreading is the difference between captions and a caption meme.' },
      { q: 'Which languages does it understand?',
        a: 'Whisper tiny was trained on 99 languages, and Auto-detect can pick any of them. The list names English, Hindi and the eleven languages that follow them in Ethnologue’s ranking of the most spoken languages: Mandarin Chinese, Spanish, Arabic, French, Bengali, Portuguese, Russian, Urdu, Indonesian, German and Japanese. How well it does varies a great deal. In our own test — five short spoken sentences per language from Mozilla Common Voice — it caught about 88% of the Japanese characters, 64% of the German words, 59% of the Spanish, 52% of the French, 45% of the Arabic, 42% of the Urdu, 40% of the Russian, 28% of the Indonesian, 15% of the Chinese characters and 5% of the Portuguese; it wrote the Hindi in English and produced no readable Bengali. English, on our test sentence, came out word for word. Arabic and Urdu captions run right to left; Chinese and Japanese are split into words by your browser’s own word segmenter, with no spaces added.' },
      { q: 'How long does it take?',
        a: 'About as long as the clip lasts on a laptop — a 60-second video takes roughly a minute to transcribe and another to re-encode at 1080p. A phone is two to three times slower. The first window gives a live estimate, and you can cancel at any point.' },
      { q: 'Why did I get a WebM instead of an MP4?',
        a: 'MP4 is encoded on the device with the browser’s WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the captioned clip is recorded as WebM, which every browser and most apps play. Convert it if a site insists on MP4, or open the page in Chrome or Edge.' },
      { q: 'Does the sound stay in the exported video?',
        a: 'Yes. The original sound track is decoded, re-encoded as AAC (or Opus where AAC is not available) and muxed into the new file alongside the captioned frames. In the rare browser that can encode video but not audio, the tool says so before you download, and the result head says so too — a silent clip is never passed off as the original.' },
      { q: 'Can I use the SRT, VTT or ASS somewhere else?',
        a: 'Yes. SRT and VTT are standard SubRip and WebVTT files, with cues of at most two lines and 42 characters a line (16 for Chinese and Japanese), and the same timings as the burned-in captions; video platforms, editing programs and players such as VLC take them. The ASS file (Advanced SubStation Alpha) adds the look: font, size, colours, outline, position, keyword colours and, for Karaoke, a timing tag on every word, so players that render ASS light each word as it is spoken. The animated looks and the emoji are drawn into the video only.' },
      { q: 'How are the word timings worked out?',
        a: 'From the model itself. While Whisper writes each word, part of it is looking at a particular moment of the sound; lining those moments up with the words (dynamic time warping over its cross-attention, as OpenAI’s own Whisper code does for word timestamps) gives each word a start and an end. On our test sentence, read by a speech synthesiser that reports where every word starts, the words landed 0.08 s from the truth on average and never more than 0.17 s, against 0.30 s on average and up to 0.79 s when each phrase’s time is simply shared out by word length. If you edit a line into a different number of words, that line falls back to sharing its time out by word length; the page says which you have.' },
      { q: 'What do keywords and auto emoji do?',
        a: 'A keyword is drawn in its own colour wherever it is spoken — click a word in the transcript to mark it, or type a list. Auto emoji adds an emoji after about ninety common English words (love, fire, money, idea and so on); it is English only, because the word list is. Both are drawn the same way on the preview and in the exported video. Keywords are also coloured in the ASS file; emoji go into the video only.' },
      { q: 'What are the limits?',
        a: 'Ten minutes of audio or video per file, output at up to 1080×1920 (or 1920×1080 for landscape), and one file at a time. The limits exist because everything is held in your browser’s memory; there is no server to send the rest to.' }
    ],
    related: ['/ai-image/text-behind-image/', '/image/social-media-resizer/', '/text/word-counter/', '/image/image-compressor/', '/image/meme-generator/']
  };
})();
