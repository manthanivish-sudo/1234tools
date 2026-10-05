'use strict';
/* Kit v2 story data: AI Video Tools. Contract: kit2-schema.md, sections 1 and 2.
   Whisper tiny is downloaded once and runs on the viewer's device; English only. */
module.exports = {
  '/ai-video/auto-captions/': {
    persona: 'Reels, Shorts and TikTok creators',
    hook: 'Most people scroll with the sound off. Caption it.',
    pain: 'Typing captions for a 60-second clip takes longer than filming it, and caption apps add their logo.',
    usual: ['Typing every word and timing it by hand', 'Caption apps that add their own logo', 'Uploading raw footage to a server'],
    promise: 'Whisper writes the words on your device. Pick a style, export MP4.',
    steps: ['Choose a video', 'Check and fix the words', 'Export MP4 and SRT'],
    proof: ['Free', 'Runs on your device', 'No watermark'],
    example: { kind: 'video', sample: 'speech' },
    howTo: 'How to add captions to a video for free',
    cta: 'Caption a video'
  },
  '/ai-video/reel-maker/': {
    persona: 'Creators, shops and small brands',
    hook: 'You have the idea. Not three hours to edit a Reel.',
    pain: 'A 20-second Reel means a video app, a template you pay for, captions by hand and a logo you did not ask for.',
    usual: ['Templates locked behind a subscription', 'Free exports stamped with a logo', 'Uploading your clips to a server'],
    promise: 'Type the script. Get a 9:16 Reel with motion text and captions.',
    steps: ['Type one line per scene', 'Add a voice, clips or music', 'Export the MP4 and caption'],
    /* the reel carries a "Made with 1234Tools.com" line by default; it switches off, so the watermark is not forced */
    proof: ['Free', 'Runs on your device', 'No forced watermark'],
    example: { kind: 'schematic', input: 'Five lines of script and a voice note', output: 'A 9:16 MP4 with motion text and captions', sampleIn: 'Your photo has a kitchen behind it. / One click. Gone. / Free, in your browser.', sampleOut: 'A 15-second Reel, 1080×1920, captions burned in' },
    howTo: 'How to make an Instagram Reel from a script, free',
    cta: 'Make a Reel'
  }
};
