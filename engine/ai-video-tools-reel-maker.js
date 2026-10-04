/**
 * Reel Maker — the spec build-ai-video.js reads (see engine/ai-video-tools.js
 * for the shape). The page loads the `scripts` listed, never this file.
 * Copy rules: everything is made on the device; the microphone or the screen
 * is used only when the visitor presses the button; no watermark; the small
 * 1234tools.com credit is off unless switched on.
 */
(function () {
  window.AI_VIDEO_TOOLS = window.AI_VIDEO_TOOLS || {};

  window.AI_VIDEO_TOOLS['reel-maker'] = {
    order: 1,
    title: 'Reel Maker',
    pageTitle: 'Free Reel Maker — Text to Reel, No Watermark, Offline | 1234Tools',
    description: 'Turn a script into a 9:16 Reel in your browser: animated text scenes, screenshots or screen recording, your voice, music and auto-captions. MP4 with sound, no upload, no watermark, no account.',
    keywords: ['reel maker', 'free reel maker no watermark', 'text to video', 'text to reel', 'instagram reel maker online free',
      'youtube shorts maker', 'tiktok video maker no watermark', 'make a reel from text', 'add voiceover to video', 'faceless reels'],
    glyph: 'i-ai-reel',
    glyphSvg: '<symbol id="i-ai-reel" viewBox="0 0 24 24">\n  <rect x="6.5" y="3" width="11" height="18" rx="2.2"/>\n  <path d="M10.6 9.4v5.2l4.4-2.6z" class="fill"/>\n  <path d="M9 17.3h6" class="thin"/>\n  <path d="M4 7h1.2M4 12h1.2M4 17h1.2" class="thin"/>\n  <path d="M19.4 2.9l.55 1.25 1.25.55-1.25.55-.55 1.25-.55-1.25-1.25-.55 1.25-.55z" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/aivid-whisper.js', '/engine/aivid-auto-captions.js', '/engine/qr.bundle.js', '/engine/aivid-reel-maker.js'],
    privacy: 'Your script, pictures, recordings and voice never leave your device. Scenes are drawn on a canvas and encoded to MP4 by your browser’s own media engine; the voiceover and music are mixed in the browser too. The microphone and screen are used only when you press the button that asks for them. If you turn on auto-captions, speech is recognised by OpenAI’s Whisper tiny model (41 MB, MIT licence), served from this site and kept by your browser after the first visit. Nothing is uploaded, queued or logged, there is no account and there is no watermark; the small “1234tools.com” credit is off unless you switch it on.',
    model: { name: 'Whisper tiny', size: '41 MB', licence: 'MIT', source: 'https://github.com/openai/whisper', files: 'engine/models/whisper-tiny/' },
    how: [
      'Write or paste a script, one scene per line, or start from a template — Problem → Solution, Before / After, 3 Mistakes, Myth vs Fact, How-to in 3 steps, Top 5 or Testimonial — and replace the [bracketed] words. Each line becomes a scene of moving type; a line such as #GST on its own colours that word in the scene above.',
      'Add pictures or clips where words are not enough: a screenshot in a phone frame, a photo full-bleed, or a screen recording made right here with “Record my screen”. Move scenes up or down and set how long each one stays.',
      'Add your voice — record it from the microphone with the script shown as a teleprompter, or upload a file — and, if you like, a music track. The music ducks under your voice automatically. With a voice on, captions are transcribed word by word on your device.',
      'Every reel gets a look of its own — a palette, a headline style, a motion and a background — chosen so it is not one of your last few. Keep it, press Shuffle look, or pick each part yourself; then set the brand strip: a logo, your handle, a URL and a QR end card.',
      'Export a 1080×1920 MP4 for Reels, Shorts and TikTok (or 1080×1080 and 1920×1080), a cover image, and copy a ready caption with hashtags. Promoting several tools from this site? Tick them and get one reel each.'
    ],
    uses: [
      ['Faceless explainer reels', 'A script, a few bold text scenes and a music bed is the whole format. No camera, no editor, no watermark to crop off.'],
      ['Product and app demos', 'Record your screen, drop the clip into a card or a phone frame and talk over it. The captions keep it watchable on mute.'],
      ['Tips and listicles', 'The Top 5 and 3 Mistakes templates count down with big numbered scenes, the mistakes crossed out one by one. Fill in the brackets, export — a few minutes of work for a thirty-second reel.'],
      ['Myths, before-and-afters and testimonials', 'Myth vs Fact strikes the myth through before the fact lands; Before / After puts the two side by side; the testimonial template is for a real customer’s own words, with their permission.'],
      ['Promoting a tool from this site', 'Pick one of the tools here and it tells the tool’s story in seven beats — the hook, the pain, the usual way crossed out, the fix, a real result from the tool, three steps, and an end card with a QR code — and writes the caption. Tick several and each reel gets a different look.']
    ],
    tips: [
      'Seven to thirty seconds suits a reel. Say one thing per scene; if a line is over twelve words, split it.',
      'Keep words out of the top 13% and bottom 17% of the frame — the app’s own buttons sit there. The looks here already do; the safe-area guide shows where.',
      'Record the voice first, then tick “Fit scenes to the voice” to stretch the scenes to what you actually said. Captions come from the recording, so you do not retype anything.',
      'Music under speech: pick something without lyrics and leave the ducking on. The tool drops it by 12 dB while you talk and brings it back in the gaps. Use a track you have the rights to.',
      'Phone screenshots look best in the phone frame; desktop screenshots and screen recordings in the card. Full-bleed is for photos.',
      'Export 1080×1920 for Instagram, TikTok and Shorts — the same file works on all three. Use the square or landscape sizes for a feed post or YouTube.'
    ],
    faq: [
      { q: 'Why does every reel look different?',
        a: 'Posting the same look every day trains people to scroll past it. Each new reel is given a palette, a headline style (two-tone gradient, outlined keyword, highlighter, all-caps or serif), a motion and a background that are not the ones you used for your last few; the choice is remembered only in your browser. Pick any part in Brand to keep it, or press Shuffle look for another. Every palette is checked for WCAG AA contrast.' },
      { q: 'What do the script templates do?',
        a: 'They give you the shape of a reel that works — Problem → Solution, Before / After, 3 Mistakes, Myth vs Fact, How-to in 3 steps, Top 5, Testimonial — with [bracketed] placeholders to replace. A word such as HOOK:, USUAL:, STEPS: or VERSUS: at the start of a line picks the kind of scene; you can type them yourself too. The testimonial template is for a real customer’s words, used with their permission: nothing in it is written for you.' },
      { q: 'Is anything uploaded?',
        a: 'No. Your script, images, screen recording, voice and music stay in the browser; the frames are drawn on a canvas and encoded to MP4 on your device with WebCodecs. The only download is the optional 41 MB Whisper speech model for captions, served from this site and kept by your browser. We never receive your content, and there is no account.' },
      { q: 'Is there a watermark?',
        a: 'No. A small “1234tools.com” credit can be switched on in the corner if you want to say where the clip was made; it is off by default and never added without you choosing it.' },
      { q: 'Can it read my script aloud?',
        a: 'Not yet. Browsers can speak text but give no way to record what they say into a file, so a robot voice cannot be put into the MP4. Record your own voice with the microphone button — the script is shown as a teleprompter while you read — or upload a voice file made elsewhere.' },
      { q: 'How do the captions work?',
        a: 'When a voiceover is attached, Whisper tiny transcribes it on your device (English speech, in this version) and the words are drawn in time with your speech, one to three at a time, in the same four styles as the Auto Captions tool. Without a voice, the scene text itself is what people read, and pictures can carry a caption line of their own. The words are editable before export.' },
      { q: 'Which sizes and formats?',
        a: '1080×1920 (9:16, Reels, Shorts, TikTok), 1080×1080 (square) and 1920×1080 (landscape), at 30 frames per second as H.264 MP4 with AAC sound (Opus where the browser has no AAC encoder), up to 90 seconds. A cover image is exported as JPG or PNG at the same size.' },
      { q: 'Why did I get a WebM without sound?',
        a: 'MP4 is encoded on the device with the browser’s WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the clip is recorded in real time as WebM, and the mixed sound cannot be attached — it is offered as a separate WAV instead. Open the page in Chrome or Edge for the complete MP4.' },
      { q: 'Can I record my screen?',
        a: 'On a desktop browser, yes: “Record my screen” asks the browser which tab, window or screen to share, records it until you stop, and drops the clip into a scene. Phones do not offer screen capture to web pages; record with the phone’s own screen recorder and upload the file.' },
      { q: 'What are the limits?',
        a: 'Ninety seconds per reel, ten media files, 200 MB per video clip, and one export at a time (a batch runs them one after another). The limits exist because everything is held in your browser’s memory. On a phone, keep reels under a minute and use the phone frame rather than full-bleed video.' }
    ],
    related: ['/ai-image/text-behind-image/', '/ai-image/thumbnail-maker/', '/image/social-media-resizer/', '/qr/qr-code-generator/', '/text/word-counter/']
  };
})();
