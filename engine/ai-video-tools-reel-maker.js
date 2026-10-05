/**
 * Reel Maker — the spec build-ai-video.js reads (see engine/ai-video-tools.js
 * for the shape). The page loads the `scripts` listed, never this file.
 * Copy rules: everything is made on the device; the microphone or the screen
 * is used only when the visitor presses the button; no forced watermark: the
 * "Made with 1234Tools.com" line is on by default and switches off in Export;
 * the "AI voice" label stays while the voice is generated. A generated voice is called
 * synthetic wherever it is offered; its sizes (92 MB model, ~94 MB first use)
 * are the files under engine/models/kokoro-82m/ and the speed claim ("two to
 * four times as long as the speech") is what headless Chrome measured on the
 * test laptop on 2026-10-05: 1.8–2.1× warm, 2.8–4× on a first run, for lines
 * of 4 to 38 words (single-threaded WebAssembly; build/ai-video/tests/
 * reel-voice.js prints the ratio each run).
 */
(function () {
  window.AI_VIDEO_TOOLS = window.AI_VIDEO_TOOLS || {};

  window.AI_VIDEO_TOOLS['reel-maker'] = {
    order: 1,
    title: 'Reel Maker',
    pageTitle: 'Free Reel Maker — Text to Reel, No Forced Watermark | 1234Tools',
    description: 'Turn a script into a 9:16 Reel in your browser: animated text scenes, screenshots or screen recording, your voice or a generated one, music and auto-captions. MP4 with sound, no upload, no account, no forced watermark.',
    keywords: ['reel maker', 'free reel maker no watermark', 'text to video', 'text to reel', 'instagram reel maker online free',
      'youtube shorts maker', 'tiktok video maker no watermark', 'make a reel from text', 'add voiceover to video', 'faceless reels',
      'ai voiceover for reels', 'text to speech reel maker'],
    glyph: 'i-ai-reel',
    glyphSvg: '<symbol id="i-ai-reel" viewBox="0 0 24 24">\n  <rect x="6.5" y="3" width="11" height="18" rx="2.2"/>\n  <path d="M10.6 9.4v5.2l4.4-2.6z" class="fill"/>\n  <path d="M9 17.3h6" class="thin"/>\n  <path d="M4 7h1.2M4 12h1.2M4 17h1.2" class="thin"/>\n  <path d="M19.4 2.9l.55 1.25 1.25.55-1.25.55-.55 1.25-.55-1.25-1.25-.55 1.25-.55z" class="fill"/>\n</symbol>',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/aivid-whisper.js', '/engine/aivid-auto-captions.js', '/engine/aivid-tts.js', '/engine/qr.bundle.js', '/engine/aivid-reel-maker.js'],
    privacy: 'Your script, pictures, recordings and voice never leave your device. Scenes are drawn on a canvas and encoded to MP4 by your browser’s own media engine; the voiceover and music are mixed in the browser too. The microphone and screen are used only when you press the button that asks for them. If you turn on auto-captions, speech is recognised by OpenAI’s Whisper tiny model (41 MB, MIT licence). If you generate a voice, the script is read aloud by Kokoro-82M (a 92 MB model, Apache-2.0 licence, with pronunciation dictionaries from misaki, also Apache-2.0) — the text is turned into speech on your device and is never sent anywhere. Both models are served from this site, downloaded only when you press the button that needs them, and kept by your browser after that. Nothing is uploaded, queued or logged, and there is no account. No watermark is forced on you: a small “Made with 1234Tools.com” line at the bottom is on by default and switches off in Export. When the voice is generated, an “AI voice” label is drawn at the top and a note saying so is written into the MP4 file — that one stays, because synthetic voices are expected to be marked.',
    model: { name: 'Whisper tiny', size: '41 MB', licence: 'MIT', source: 'https://github.com/openai/whisper', files: 'engine/models/whisper-tiny/' },
    voiceModel: { name: 'Kokoro-82M v1.0 (8-bit ONNX)', size: '92 MB', licence: 'Apache-2.0', source: 'https://huggingface.co/hexgrad/Kokoro-82M', files: 'engine/models/kokoro-82m/', voices: 28 },
    how: [
      'Write or paste a script, one scene per line, or start from a template — Problem → Solution, Before / After, 3 Mistakes, Myth vs Fact, How-to in 3 steps, Top 5 or Testimonial — and replace the [bracketed] words. Each line becomes a scene of moving type; a line such as #GST on its own colours that word in the scene above.',
      'Add pictures or clips where words are not enough: a screenshot in a phone frame, a photo full-bleed, or a screen recording made right here with “Record my screen”. Move scenes up or down and set how long each one stays.',
      'Add a voice — record your own from the microphone with the voice-over script shown as a teleprompter, upload a file, or press Generate voice and pick one of 28 synthetic English voices (American and British, women and men) to read the voice-over script on your device — and, if you like, a music track. The music ducks under the voice automatically. Captions follow the voice word by word: a recording is transcribed on your device, a generated voice is captioned from its voice-over script.',
      'Every reel gets a look of its own — a palette, a headline style, a motion and a background — chosen so it is not one of your last few. Keep it, press Shuffle look, or pick each part yourself; then set the brand strip: a logo, your handle, a URL and a QR end card.',
      'Export a 1080×1920 MP4 for Reels, Shorts and TikTok (or 1080×1080 and 1920×1080), a cover image, and copy a ready caption with hashtags. Promoting several tools from this site? Tick them and get one reel each.'
    ],
    uses: [
      ['Faceless explainer reels', 'A script, a few bold text scenes and a music bed is the whole format. No camera, no editor, no watermark to crop off: the small credit line switches off.'],
      ['Product and app demos', 'Record your screen, drop the clip into a card or a phone frame and talk over it. The captions keep it watchable on mute.'],
      ['Tips and listicles', 'The Top 5 and 3 Mistakes templates count down with big numbered scenes, the mistakes crossed out one by one. Fill in the brackets, export — a few minutes of work for a thirty-second reel.'],
      ['Myths, before-and-afters and testimonials', 'Myth vs Fact strikes the myth through before the fact lands; Before / After puts the two side by side; the testimonial template is for a real customer’s own words, with their permission.'],
      ['Promoting a tool from this site', 'Pick one of the tools here and it tells the tool’s story in seven beats — the hook, the pain, the usual way crossed out, the fix, a real result from the tool, three steps, and an end card with a QR code — and writes the caption. Tick several and each reel gets a different look.']
    ],
    tips: [
      'Seven to thirty seconds suits a reel. Say one thing per scene; if a line is over twelve words, split it.',
      'Keep words out of the top 13% and bottom 17% of the frame — the app’s own buttons sit there. The looks here already do; the safe-area guide shows where.',
      'Record the voice first, then tick “Fit scenes to the voice” to stretch the scenes to what you actually said. Captions come from the recording, so you do not retype anything.',
      'Generating a voice? Press Preview to hear a sentence in each voice before you commit, set the speed (0.8× to 1.2×) and the pause after each scene, then Generate: every scene lasts as long as its line. Edit a line afterwards and press Generate voice again. If a name comes out wrong, add it to the Pronunciation box as “word = how it sounds”; the captions keep the word as written.',
      'What is said and what is shown are separate. Sound has a voice-over script with one line per scene, suggested for you and written to be heard: a Wi-Fi code, a link or a file name on screen is left out or described (“the link in our bio”), and ₹, % and × are said in words. Change any line, empty one for a silent scene, or press Reset to get the suggestion back.',
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
        a: 'No. Your script, images, screen recording, voice and music stay in the browser; the frames are drawn on a canvas and encoded to MP4 on your device with WebCodecs. The only downloads are two optional models, each fetched from this site the first time you press the button that needs it and then kept by your browser: the 41 MB Whisper speech model for captions, and about 94 MB for a generated voice (the 92 MB Kokoro model, a pronunciation dictionary and the voices you use). We never receive your content, and there is no account.' },
      { q: 'Is there a watermark?',
        a: 'No forced one. Reels carry a small “Made with 1234Tools.com” line just above the bottom edge, on by default; untick “Show ‘Made with 1234Tools.com’” in Export and the reel carries no credit at all. The one mark that cannot be removed is the “AI voice” label on a reel whose voice is generated (below).' },
      { q: 'Why does my reel say “AI voice”?',
        a: 'Because its voice is synthetic. A reel with a generated voice gets a small “AI voice” label at the top of every frame and the cover, and the MP4 file itself carries a text note — “Contains AI-generated audio (synthetic voice, Kokoro-82M)” — in its metadata. Platforms ask for realistic AI audio to be labelled, and Article 50(2) of the EU AI Act asks providers of systems that generate synthetic audio or video to mark the output “in a machine-readable format and detectable as artificially generated or manipulated”, from 2 August 2026 (artificialintelligenceact.eu/article/50). The label stays on while the voice is generated. You can also add it yourself — “Label this reel as AI-generated” in Export — when pictures, clips or words in the reel were made by AI; it then reads “AI-generated”. The note in the file is a plain text tag, not a signed content credential. A clip recorded in real time by a browser without on-device MP4 encoding (Firefox) shows the label but carries no note in the file.' },
      { q: 'Can it read my script aloud?',
        a: 'Yes. In Sound, pick a voice and press Generate voice: Kokoro-82M, an open text-to-speech model published under the Apache-2.0 licence, reads the voice-over script on your device — one line per scene, suggested from what is on screen but written to be heard, and yours to edit — in one of 28 English voices — 20 American and 8 British, women and men — at 0.8× to 1.2× speed, with a pause of your choosing after each scene. Preview plays one sentence in the chosen voice first. The first use downloads about 94 MB from this site, which your browser keeps; the script itself is never sent anywhere. It is a synthetic voice, not a recording of a person, and English only for now. Generating takes a while on the device — on our test laptop, two to four times as long as the speech itself, and longer on a phone — so it goes scene by scene with a progress bar, and Cancel stops it.' },
      { q: 'Do I have to label a generated voice when I post?',
        a: 'Check each platform’s rules when you post. Meta says it will “require people to use this disclosure and label tool when they post organic content with a photorealistic video or realistic-sounding audio that was digitally created or altered” (about.fb.com, “Labeling AI-Generated Images on Facebook, Instagram and Threads”, 6 February 2024, updated 1 April 2025), so switch on the AI label on Instagram and Facebook. YouTube’s disclosure rules (support.google.com/youtube/answer/14328491) are about realistic content, such as making a real person appear to say something they did not. The caption this tool writes says the voiceover is AI-generated whenever you use one.' },
      { q: 'How do the captions work?',
        a: 'When you record or upload a voiceover, Whisper tiny transcribes it on your device (English speech, in this version) and the words are drawn in time with your speech, one to three at a time, in the same four styles as the Auto Captions tool. A generated voice needs no transcription: the captions are the script’s own words, timed sentence by sentence as the voice says them. Without a voice, the scene text itself is what people read, and pictures can carry a caption line of their own. The words are editable before export.' },
      { q: 'Which sizes and formats?',
        a: '1080×1920 (9:16, Reels, Shorts, TikTok), 1080×1080 (square) and 1920×1080 (landscape), at 30 frames per second as H.264 MP4 with AAC sound (Opus where the browser has no AAC encoder), up to 90 seconds. A cover image is exported as JPG or PNG at the same size.' },
      { q: 'Why did I get a WebM without sound?',
        a: 'MP4 is encoded on the device with the browser’s WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the clip is recorded in real time as WebM, and the mixed sound cannot be attached — it is offered as a separate WAV instead. Open the page in Chrome or Edge for the complete MP4.' },
      { q: 'Can I record my screen?',
        a: 'On a desktop browser, yes: “Record my screen” asks the browser which tab, window or screen to share, records it until you stop, and drops the clip into a scene. Phones do not offer screen capture to web pages; record with the phone’s own screen recorder and upload the file.' },
      { q: 'Is my reel saved if I close the page?',
        a: 'The words and settings are: as you edit, the reel — its scenes, voice-over lines, look, brand and switches — is kept as a draft in this browser’s own storage, and the next visit offers “Restore your last reel” or “Start fresh”. Nothing is sent anywhere. Pictures, clips, a voice and music are files, and files are not kept: after a restore the page names the scenes that need theirs again. While an export is running, the page asks before it is closed.' },
      { q: 'What are the limits?',
        a: 'Ninety seconds per reel, ten media files, 200 MB per video clip, music up to 10 minutes long (a WAV can be any length: only the part the reel uses is read), and one export at a time (a batch runs them one after another). The limits exist because everything is held in your browser’s memory. A high-bitrate clip is read frame by frame and can take several minutes to export; the Export pane says how long before it starts. On a phone, keep reels under a minute and use the phone frame rather than full-bleed video.' }
    ],
    related: ['/ai-image/text-behind-image/', '/ai-image/thumbnail-maker/', '/image/social-media-resizer/', '/qr/qr-code-generator/', '/text/word-counter/']
  };
})();
