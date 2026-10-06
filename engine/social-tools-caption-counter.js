/**
 * Caption Counter — the spec build-social.js reads. The limits and how each
 * is counted are in engine/social-caption-counter.js, with the page each
 * came from (checked 6 October 2026); build/content/social.js cites them.
 */
(function () {
  window.SOCIAL_TOOLS = window.SOCIAL_TOOLS || {};
  window.SOCIAL_TOOLS['caption-counter'] = {
    order: 3,
    title: 'Caption Counter',
    pageTitle: 'Caption Character Counter for Instagram, X, LinkedIn | 1234Tools',
    description: 'Check a caption against the limits of Instagram, X, LinkedIn, TikTok, YouTube, Facebook and Threads at once, counted the way each platform counts: X’s weighted count, emoji, hashtags, mentions and links. Fixes Instagram line breaks. Nothing is uploaded.',
    keywords: ['caption character counter', 'instagram caption character limit', 'twitter character counter', 'x character count', 'linkedin character limit',
      'tiktok caption length', 'youtube title length', 'threads character limit', 'instagram line break', 'hashtag counter'],
    glyph: 'i-social-count',
    glyphSvg: '<symbol id="i-social-count" viewBox="0 0 24 24">\n  <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-9l-4 3.5v-3.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5z"/>\n  <path d="M6.5 10h7M6.5 13h4" class="thin"/>\n  <path d="M16.5 9.5v4" class="thin"/>\n</symbol>',
    category: 'UtilitiesApplication',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/social-kit.js', '/engine/social-caption-counter.js'],
    privacy: 'Nothing you type is uploaded: the counting happens in this page as you type. The caption is not stored anywhere unless you tick “Keep this text as a draft on this device”, which keeps it in this browser until you untick it. Which platform the preview shows and whether you post with X Premium are remembered in this browser. There is no account.',
    how: [
      'Type or paste a caption, or press Try an example.',
      'Read the row for each platform: how much you have used, how much is left, and the unit that platform counts in. A row turns amber at 90% and red over the limit.',
      'Check the hashtags, mentions and links: Instagram allows 20 @ tags, Threads 5 links, and Instagram is cutting hashtags to 5.',
      'Pick a platform under “Before … more” to see roughly what shows in the feed before the caption is cut.',
      'Posting on Instagram with blank lines between paragraphs? Press “Copy with the line-break fix” and paste that instead.'
    ],
    uses: [
      ['One caption, many platforms', 'Write once and see at a glance which platform needs a shorter version.'],
      ['Posts on X', 'The count follows X’s rules: a link is 23 whatever its length, an emoji 2, and Chinese, Japanese and Korean characters 2 each.'],
      ['YouTube titles', 'Catches a title over 100 characters and the < and > YouTube refuses.'],
      ['Instagram captions with paragraphs', 'Keeps the gaps between paragraphs that Instagram can remove.']
    ],
    tips: [
      'Put the point of the caption in the first line: that is what shows before “… more”.',
      'On X a long link costs no more than a short one: every link counts 23.',
      'Hashtags count towards the length everywhere. On Instagram, a few specific ones beat thirty generic ones.',
      'Emoji are not all the same size: most are 2 UTF-16 units, a flag is 4 and a family emoji can be 11.',
      'Paste the fixed text from the Copy button, not from the box above it: the fix is in the copied version.'
    ],
    faq: [
      { q: 'Why does X count my caption differently?', a: 'X weighs characters. Most Latin letters, digits and punctuation count 1; Chinese, Japanese and Korean characters, most symbols and every emoji count 2 — an emoji counts 2 however many code points it is built from — and every link counts 23, because X shortens it. The text is normalised first, so é typed as e plus an accent counts 1. These are the rules of X’s open-source twitter-text library, which this tool follows.' },
      { q: 'What does “UTF-16 units” mean?', a: 'It is how a web form counts length. Most characters are one unit; most emoji are two, and an emoji built from several (a family, a flag, a skin tone) is more. Where a platform does not say how it counts an emoji, this tool uses UTF-16 units — the stricter count — so a caption that fits here is not cut there.' },
      { q: 'How does Threads count emoji?', a: 'Threads’ own developer documentation says an emoji counts as the number of its UTF-8 bytes, usually 4, against the 500-character limit. Every other character counts one.' },
      { q: 'Why do my blank lines disappear on Instagram?', a: 'Instagram can remove empty lines between paragraphs, so the paragraphs run together. The fix this tool copies puts an invisible character (U+2800, Braille Pattern Blank) on each empty line and trims spaces from line ends. It is a workaround, not an Instagram feature: each one counts as a character and some screen readers announce it.' },
      { q: 'How many hashtags can I use on Instagram?', a: 'Instagram’s developer documentation says 30. In December 2025 Instagram said it would gradually limit captions to five hashtags. The counter warns above 5 and flags anything above 30 as over.' },
      { q: 'Is my caption saved or uploaded?', a: 'Not uploaded, ever: the counting runs in this page. It is not saved either, unless you tick “Keep this text as a draft on this device”; then it stays in this browser until you untick the box.' },
      { q: 'Where does the “… more” cut-off come from?', a: 'It is approximate. No platform publishes where it cuts a caption in the feed; it changes with the screen and the line breaks. The preview uses common working figures: about 125 characters or two lines on Instagram and Facebook, 150 or three lines on LinkedIn, 100 or one line on TikTok.' }
    ],
    related: ['/text/word-counter/', '/ai/social-post-writer/', '/text/case-tools/', '/text/readability-score/']
  };
})();
