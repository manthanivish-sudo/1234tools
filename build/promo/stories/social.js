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
  }
};
