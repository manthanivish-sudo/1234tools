/**
 * Social Post Maker — the spec build-social.js reads. The page loads the
 * `scripts` listed, never this file. The size table is SocialKit.SIZES in
 * engine/social-kit.js, with the platform page each size came from (checked
 * 6 October 2026); build/content/social.js cites them on the page.
 */
(function () {
  window.SOCIAL_TOOLS = window.SOCIAL_TOOLS || {};
  window.SOCIAL_TOOLS['social-post-maker'] = {
    order: 2,
    title: 'Social Post Maker',
    pageTitle: 'Social Post Maker — Quote & Announcement Images | 1234Tools',
    description: 'Make quote and announcement posts in your brand colours, logo and fonts, then download them in every platform size at once: Instagram, stories, X, LinkedIn, Facebook, Pinterest and YouTube. Nine templates; nothing you add is uploaded.',
    keywords: ['social media post maker', 'quote post maker', 'announcement post template', 'instagram post maker free', 'brand kit social media',
      'social media image sizes', 'make a post for every platform', 'linkedin post image 1200x628', 'pinterest pin maker', 'free social media graphics'],
    glyph: 'i-social-post',
    glyphSvg: '<symbol id="i-social-post" viewBox="0 0 24 24">\n  <rect x="3" y="5" width="11" height="14" rx="2"/>\n  <rect x="15.5" y="8" width="5.5" height="8" rx="1.2"/>\n  <path d="M6 10h5M6 13h5M6 16h3" class="thin"/>\n</symbol>',
    category: 'DesignApplication',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/social-kit.js', '/engine/social-social-post-maker.js'],
    privacy: 'Nothing you add is uploaded. Your words and logo are drawn by this page in your browser, and every PNG and the ZIP are made on your device. The template, the sizes you tick and the preview size are remembered in this browser; the words are not. Your brand kit — colours, fonts, handle and a logo shrunk to 512 pixels — is kept in this browser only when you press “Save brand kit on this device”, and “Forget the saved kit” removes it. There is no account.',
    how: [
      'Pick a template: Quote, Announcement, Offer, Event, Big number, Tip, Question, We’re hiring or New. Each starts with an example to type over.',
      'Write a heading, a line of text and a small line — a name, a date, a code or a web address.',
      'In Brand, set the background, text and accent colours, a heading font and a text font, your handle and a logo. Save the kit to have it here next time.',
      'Look at every size at once under the preview: the layout is worked out from each frame’s own shape and the text is shrunk until it fits.',
      'Tick the sizes you need and download them as one ZIP, or make each one separately with its own Download button.'
    ],
    uses: [
      ['Announcements', 'New opening hours, a move or a launch, posted everywhere in one go.'],
      ['Quotes', 'A customer’s words (with their permission) or your own line, in your brand.'],
      ['Offers and codes', 'The code sits in an outlined pill so it reads at a glance.'],
      ['Events', 'Name, date and place, in a frame that matches the rest of your feed.'],
      ['Hiring', 'A role and how to apply, sized for LinkedIn, Facebook and a story.']
    ],
    tips: [
      'Keep the heading under eight words; the story size is narrow and long headings shrink.',
      'Use the accent for one thing only — the label, the number or the code — so it still stands out.',
      'Save your brand kit once: the Carousel Maker on this site reads the same kit.',
      'A logo with a transparent background (PNG) sits better on every colour than one on a white square.',
      'Check the warning under the preview: it names any size where the text had to be cut, and flags low contrast.'
    ],
    faq: [
      { q: 'Which sizes does it make?', a: 'Instagram post 1080 × 1080, Instagram portrait 1080 × 1350, story or reel cover 1080 × 1920, X 1920 × 1080, LinkedIn 1200 × 628, Facebook 1200 × 630, Pinterest 1000 × 1500 and a YouTube post 1080 × 1080. Each comes from the platform’s own guidance; the list with sources is further down this page.' },
      { q: 'How does one design fit such different shapes?', a: 'Nothing is stretched. Margins and type are measured from the shorter side of each frame, wide frames move the decoration aside, and every block of text is shrunk step by step until it fits its space. If it still will not fit at the smallest size, it is cut with “…” and the page names that size.' },
      { q: 'Where is my brand kit kept?', a: 'In this browser’s storage on this device, and only after you press Save. Colours, fonts and handle are one small record; the logo is kept as a PNG no bigger than 512 pixels a side. Clearing the site’s data, or pressing Forget, removes it.' },
      { q: 'Is anything uploaded?', a: 'No. Every image is drawn on a canvas in your browser and saved from there. We never receive your words or your logo.' },
      { q: 'Is there a watermark?', a: 'No. Nothing is added to your posts.' },
      { q: 'Can I use my own font?', a: 'Not in this version: the heading and text fonts come from a fixed list — Sora and Inter, which this site serves, and fonts most devices already have, such as Georgia, Arial and Verdana.' },
      { q: 'What file type do I get?', a: 'PNG, at exactly the pixel size listed, so text and edges stay sharp. The ZIP holds one PNG per ticked size, named after the platform and the size.' }
    ],
    related: ['/image/social-media-resizer/', '/ai/social-post-writer/', '/ai-image/thumbnail-maker/', '/qr/qr-code-generator/']
  };
})();
