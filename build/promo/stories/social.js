'use strict';
/* Kit v2 story data: Social Media Tools (/social/). Contract: kit2-schema.md, sections 1 and 2.
   Every claim here is one the tool pages make and build/tests/claims/social.js checks:
   nothing uploaded, no watermark, the sizes and file names as exported. No figures are
   invented: the examples are schematic. */
module.exports = {
  '/social/carousel-maker/': {
    persona: 'Creators, coaches and small brands on Instagram and LinkedIn',
    hook: 'Type the slides. The carousel draws itself.',
    pain: 'Five slides means five canvases, five exports, renaming files in order and a separate PDF for LinkedIn.',
    usual: ['Rebuilding the same template slide by slide', 'Exporting and renaming every image by hand', 'Converting the slides to a PDF somewhere else'],
    promise: 'Type the slides. Get a ZIP of PNGs and a LinkedIn PDF.',
    steps: ['Write a heading and a line per slide', 'Pick a template and your colours', 'Download the ZIP or the PDF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'schematic', input: 'Five slides of text and a photo', output: 'carousel-01.png … carousel-05.png and one PDF', sampleIn: '5 ways to make product photos sell / Use daylight / Clean the background', sampleOut: 'Five 1080 × 1350 slides and a five-page PDF for LinkedIn' },
    howTo: 'How to make an Instagram or LinkedIn carousel for free',
    cta: 'Make a carousel'
  },
  '/social/social-post-maker/': {
    persona: 'Shops, cafés, clubs and anyone posting on several platforms',
    hook: 'One announcement. Eight platform sizes. One click.',
    pain: 'Every platform wants a different shape, so one post becomes eight resized, re-checked images.',
    usual: ['Resizing the same design for every platform', 'Text that falls off the edge of a story', 'Re-entering your colours and logo every time'],
    promise: 'Write it once in your brand; download every size at once.',
    steps: ['Pick a template and type the words', 'Set your colours, fonts and logo once', 'Download every size as a ZIP'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'schematic', input: 'A heading, a line and your brand kit', output: 'PNGs for Instagram, stories, X, LinkedIn, Facebook, Pinterest and YouTube', sampleIn: 'We’re open on Sundays / From 5 October, 10 am to 4 pm', sampleOut: 'Eight PNGs from 1200 × 628 to 1080 × 1920, text fitted to each' },
    howTo: 'How to make one social media post in every size, free',
    cta: 'Make a post'
  },
  '/social/caption-counter/': {
    persona: 'Social media managers and anyone posting the same caption twice',
    hook: 'Will this caption fit? Seven platforms, one box.',
    pain: 'Each platform counts differently: X weighs emoji and links, Threads counts emoji in bytes, Instagram drops blank lines.',
    usual: ['Pasting the caption into each app to see if it fits', 'Character counters that count emoji as one', 'Paragraphs that run together on Instagram'],
    promise: 'Counted the way each platform counts, with the Instagram line-break fix.',
    steps: ['Paste your caption', 'Read the row for each platform', 'Copy the fixed text'],
    proof: ['Free', 'Nothing uploaded', 'Works as you type'],
    example: { kind: 'schematic', input: 'A caption with emoji, a link and hashtags', output: 'Used and left for Instagram, X, LinkedIn, TikTok, YouTube, Facebook and Threads', sampleIn: 'New in the shop this week ☕\ufe0f … #coffee #flatwhite', sampleOut: 'Instagram 227 / 2,200 · X 223 / 280 · Threads 233 / 500' },
    howTo: 'How to check a caption’s length for every platform',
    cta: 'Check a caption'
  },
  '/social/engagement-rate-calculator/': {
    persona: 'Creators, freelancers and marketers who report on posts',
    hook: 'Which engagement rate? All of them, side by side.',
    pain: 'By followers, by reach or by impressions: the same post gives very different rates, and reports rarely say which.',
    usual: ['Working the rate out in a spreadsheet', 'Quoting a rate without saying which formula', 'Comparing a rate by reach with one by followers'],
    promise: 'Five formulas at once, each with its sum shown.',
    steps: ['Enter likes, comments, shares and saves', 'Add followers, reach and impressions', 'Copy the results with their working'],
    proof: ['Free', 'Nothing uploaded', 'Formulas shown'],
    example: { kind: 'schematic', input: '412 likes, 38 comments, 17 shares, 55 saves; 12,400 followers', output: 'Rates by followers, reach and impressions', sampleIn: '522 engagements, reach 9,850, impressions 14,200', sampleOut: '4.21% by followers · 5.30% by reach · 3.68% by impressions' },
    howTo: 'How to calculate an engagement rate',
    cta: 'Work out my rate'
  },
  /* ---- Video to GIF, Reels Resizer and Link in Bio (drop 2) ----
  */
  '/social/video-to-gif/': {
    persona: 'Support teams, makers and anyone who explains things with a loop',
    hook: 'Three seconds of video. One GIF. Know the size before you make it.',
    pain: 'A GIF of a few seconds can outweigh the whole video, and you only find out after exporting.',
    usual: ['Exporting, checking the size, exporting again', 'Converters that want the video uploaded', 'GIFs stamped with someone else’s logo'],
    promise: 'Trim, crop and caption a clip; the size is estimated before you export.',
    steps: ['Choose a video and drag the trim handles', 'Pick width, frame rate, speed and loops', 'Read the size estimate and make the GIF'],
    proof: ['Free', 'Nothing uploaded', 'No watermark'],
    example: { kind: 'schematic', input: 'A 6-second 640 × 360 clip, trimmed to 2 seconds', output: 'frames.gif: 20 frames at 480 × 270, plays 3 times', sampleIn: '1.0–3.0 s · 480 px · 10 fps · Play 3 times', sampleOut: 'Estimated 61,155 bytes; made 61,026 bytes' },
    howTo: 'How to turn a video clip into a GIF, free',
    cta: 'Make a GIF'
  },
  '/social/reels-resizer/': {
    persona: 'Podcasters, educators and anyone with landscape footage for Reels and Shorts',
    hook: 'Landscape video, vertical feed. Keep the whole picture.',
    pain: 'A 16:9 clip in a 9:16 frame is either cropped to the middle or left floating in black bars.',
    usual: ['Cropping away the sides of every shot', 'Black bars above and below', 'Uploading footage to a server to reframe it'],
    promise: 'Fit it over a blurred copy of itself, or crop to the part that matters. Sound kept.',
    steps: ['Choose a landscape video', 'Pick 9:16, 4:5 or 1:1 and the background', 'Make the MP4'],
    proof: ['Free', 'Nothing uploaded', 'Sound kept'],
    example: { kind: 'schematic', input: 'A 640 × 360 clip, 3 seconds, with sound', output: 'A 1080 × 1920 MP4 with the sound, every frame kept', sampleIn: '16:9 landscape · Fit, blurred copy behind', sampleOut: '9:16, the picture at 1080 × 608 over its own blur; 90 frames in, 90 out' },
    howTo: 'How to make a landscape video vertical for Reels and Shorts, free',
    cta: 'Resize a video'
  },
  '/social/link-in-bio/': {
    persona: 'Creators, small shops and anyone with more links than a bio holds',
    hook: 'Your link-in-bio page, as one file you own.',
    pain: 'One link in a bio, and a page of links that lives on someone else’s service, with their name on it.',
    usual: ['A hosted page under someone else’s address', 'Tracking scripts you did not add', 'Losing the page when an account goes'],
    promise: 'Build it here, download one HTML file, host it anywhere. No scripts, no tracking.',
    steps: ['Add a photo, your name and your links', 'Pick a theme, buttons and a font', 'Download index.html and upload it'],
    proof: ['Free', 'Nothing uploaded', 'No tracking in the file'],
    example: { kind: 'schematic', input: 'A photo, a name, three links and two icons', output: 'One index.html that makes no outside requests', sampleIn: 'Shop the new collection · Book a workshop · Read the studio notes', sampleOut: 'About 3 KB without a photo, 23–27 KB with one; eight themes' },
    howTo: 'How to make a link-in-bio page you host yourself, free',
    cta: 'Make your page'
  }
};
