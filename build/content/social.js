/**
 * The reading part of the Social Media Tools (/social/), rendered by
 * build-depth.js in its file-and-text shape (howItWorks in place of
 * formula). Shape and rules: build-depth.js and build/content/_check.js.
 *
 * The limits and sizes quoted here were checked on the platforms' own pages
 * on 6 October 2026; each is cited with its address where it is quoted. The
 * one exception is Facebook's 63,206, which no Meta page states: it is the
 * figure a Facebook engineer gave in November 2011 (reported by blog404.com
 * on 3 December 2011) and is called unofficial on the page.
 *
 * Every figure comes from a run of the tool in headless Chrome on
 * 6 October 2026 against a local server of the site (build/tests/serve.js),
 * from a fresh page with nothing stored, driven as a person would: the
 * buttons pressed, the downloads read back (E:/tmp/wsoc-social/runs.js and
 * build/social/tests/*.js). Byte sizes of PNGs depend on the machine's font
 * rendering and will differ a little elsewhere.
 */
'use strict';

module.exports = {
  '/social/carousel-maker/': {
    term: 'a carousel post',
    whatIs: [
      'A carousel is one post that holds several images people swipe through. On Instagram they are separate pictures in a single post; on LinkedIn the usual form is a PDF added as a document, each page shown as one slide.',
      'Instagram keeps a photo 1080 pixels wide when its shape lies between 1.91:1 and 4:5 (help.instagram.com/1631821640426723, checked 6 October 2026), which makes 1080 × 1350 the tallest slide it shows without cropping.'
    ],
    howItWorks: {
      text: 'One function draws each slide on a `canvas`, and the preview and every file come from it.',
      points: [
        'Text is wrapped at spaces and made about 6% smaller a step until it fits its box; past the smallest size it is cut with an ellipsis and the slide is named under the preview.',
        'The indicator, swipe cue, handle and logo sit in bands at the top and bottom that text never enters.',
        'PNGs come from `canvas.toBlob`; the ZIP is written in the page without compression, with a CRC-32 for each file.',
        'For the PDF each slide becomes a JPEG at quality 0.92, placed whole on its own page at 0.75 points per pixel.'
      ]
    },
    worked: {
      text: 'Exported as it opens — five slides, Bold hook, dots and a swipe cue — the example gave carousel-1080x1350.zip of 482,439 bytes, holding carousel-01.png to carousel-05.png, and carousel-linkedin.pdf of 334,072 bytes: five pages of 810 × 1012.5 points.'
    },
    uses: [
      ['Course modules', 'One lesson summary per slide, numbered by the Numbered tips template.'],
      ['Event recaps', 'A photo on each slide with a single line under it.'],
      ['Product comparisons', 'Before and after sets the old way against the new on every slide.']
    ],
    mistakes: [
      'Crowding a slide. When the warning says text was cut, split the slide in two rather than squeezing the words.',
      'Sharing the PDF on LinkedIn as a photo post. Add it as a document, or it will not swipe.'
    ],
    faq: [
      { q: 'Can I reorder slides after adding photos?', a: 'Yes. A photo belongs to its slide, so the ↑ and ↓ buttons move it together with the words.' },
      { q: 'How big are the files?', a: 'In the example run each PNG came to between 81,517 and 121,365 bytes; photos make them larger. The PDF is smaller than the ZIP because its pages are JPEGs.' },
      { q: 'Why does a contrast warning appear?', a: 'When the text and background colours fall below 4.5:1, the ratio WCAG 2 sets for body text, the page says so. It uses the WCAG contrast formula.' }
    ],
    runs: [
      /* /social/carousel-maker/ as it opens (the five example slides, Bold hook, 1080 × 1350, dots, swipe cue on), Export → "Download a ZIP of PNGs", then "Download a PDF for LinkedIn"; the ZIP and the PDF read back by build/social/tests/_kit.js (unzip, pdf) */
      { browser: { page: '/social/carousel-maker/', slides: 5, template: 'bold-hook', size: 'portrait', px: '1080x1350', last: 'carousel-05.png', progress: 'dots', exports: ['zip', 'pdf'] }, shown: ['482,439 bytes', '334,072 bytes', '810 × 1012.5', '81,517', '121,365'] }
    ]
  },

  '/social/social-post-maker/': {
    whatTitle: 'The sizes, and where each one comes from',
    whatIs: [
      'Each size was checked on the platform’s own pages on 6 October 2026. Instagram keeps photos 1080 pixels wide between 1.91:1 and 4:5, hence 1080 × 1080 and 1080 × 1350 (help.instagram.com/1631821640426723); stories and reels are 9:16, 1080 × 1920 (help.instagram.com/1038071743007909).',
      'X’s ad specs give 16:9 at 1920 × 1080 (business.x.com/en/help/campaign-setup/creative-ad-specifications); LinkedIn’s single-image spec 1200 × 628 (linkedin.com/help/lms/answer/a426534); Meta’s sharing guide at least 1200 × 630 (developers.facebook.com/documentation/sharing/webmasters/images); Pinterest 2:3 at 1000 × 1500 (help.pinterest.com/en/business/article/pinterest-product-specs); YouTube suggests 1:1 for images in posts (support.google.com/youtube/answer/7124474).'
    ],
    howItWorks: {
      text: 'A single drawing function lays each post out from the frame’s own proportions.',
      points: [
        'Margins are 8.5% of the short side, 7.5% on wide frames, and type grows with the frame’s length up to 1.35 times, so a story is not a square with empty bands.',
        'Every block of text runs through the same shrink loop, and each later block is promised a line before an earlier one may grow.',
        'On the 1080 × 1920 size the top and bottom 250 pixels stay empty, where the app draws its own buttons.',
        'The logo is redrawn as a PNG no bigger than 512 pixels a side, which is also the copy Save keeps in `localStorage`.'
      ]
    },
    worked: {
      text: 'The Quote example as it opens — “Good coffee takes time. So does good work.”, Small Batch Café — exported at all eight sizes made social-posts-quote.zip of 791,558 bytes. The PNGs ran from 63,849 bytes for LinkedIn’s 1200 × 628 to 133,879 for the 1080 × 1920 story, each at exactly its listed size.'
    },
    uses: [
      ['Opening-hours changes', 'One edit, every platform, posted the same morning.'],
      ['Club and charity notices', 'A plain announcement in the club colours, kept as a kit for the next one.'],
      ['Recruitment', 'The hiring template, sized for LinkedIn and a story in one export.']
    ],
    mistakes: [
      'Putting key words at the very top or bottom of a story, where the app covers them.',
      'Choosing a pale accent on a pale background. The contrast warning under the preview flags it.'
    ],
    faq: [
      { q: 'Why 1200 × 628 for LinkedIn and not 1200 × 627?', a: 'LinkedIn’s own single-image specification says 1200 × 628 for a 1.91:1 image, so that is the size made here.' },
      { q: 'Can I make only some of the sizes?', a: 'Yes. Untick the ones you do not need in Export; the ticks are remembered in this browser.' },
      { q: 'Why is the X image 1920 × 1080?', a: 'X’s creative specifications list 1920 × 1080 for a 16:9 image, the shape its timeline shows in full.' }
    ],
    runs: [
      /* /social/social-post-maker/ as it opens (Quote, its example, all eight sizes ticked), Export → "Download the ticked sizes (ZIP)"; each PNG's IHDR read back by build/social/tests/_kit.js */
      { browser: { page: '/social/social-post-maker/', template: 'quote', sizes: 8, smallest: '1200x628', largest: '1080x1920', export: 'zip' }, shown: ['791,558 bytes', '63,849', '133,879'] }
    ]
  },

  '/social/caption-counter/': {
    whatTitle: 'Where each limit comes from',
    whatIs: [
      'Each limit was checked on 6 October 2026. Instagram: 2,200 characters, 30 hashtags and 20 @ tags (developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media), and a five-hashtag limit announced by @creators on Threads on 18 December 2025. X: 280, weighted (docs.x.com/fundamentals/counting-characters). LinkedIn: 3,000 (linkedin.com/help/linkedin/answer/a528176). TikTok: 2,200 UTF-16 units through its posting API (developers.tiktok.com/doc/content-posting-api-reference-direct-post).',
      'YouTube: 100 for a title and 5,000 for a description, counted in characters by its help page and in bytes by its Data API (support.google.com/youtube/answer/57404, developers.google.com/youtube/v3/docs/videos). Threads: 500 with emoji counted as UTF-8 bytes, and 5 links (developers.facebook.com/docs/threads/posts). Facebook’s 63,206 appears on no Meta page; a Facebook engineer gave it in 2011, so treat it as unofficial.'
    ],
    howItWorks: {
      text: 'Every figure is worked out in the page as you type, with no library.',
      points: [
        'Characters are grapheme clusters from `Intl.Segmenter`; without it, a fallback joins marks, skin tones, flags, keycaps, ZWJ sequences and Indic conjuncts.',
        'X’s count follows twitter-text’s v3 settings: NFC first, code points 0–4351 and three punctuation ranges weigh 1, the rest 2.',
        'An address without https:// is a link when it ends in a common ending such as .com or .io; X knows them all.',
        'Instagram, LinkedIn, TikTok, Facebook and YouTube titles are measured in UTF-16 units, YouTube descriptions in UTF-8 bytes.'
      ]
    },
    worked: {
      text: 'The example caption — a café’s new flat white, two emoji, a mention, a menu link and four hashtags — is 225 characters but 227 UTF-16 units and 236 bytes. X weighs it at 223, as its 27-character link counts 23, and Threads at 233, as each emoji costs its bytes. A post with three emoji and a long tracking link, 120 units in all, weighs 83 on X.'
    },
    uses: [
      ['Scheduling a week of posts', 'Paste each draft in turn and fix the failures before they reach the scheduler.'],
      ['Captions in other scripts', 'Hindi, Japanese or Arabic is counted per visible character, with X’s double weight for Chinese, Japanese and Korean shown.'],
      ['Signing off a client’s copy', 'A row per platform is a quick final check.']
    ],
    mistakes: [
      'Treating an emoji as one character. Where a platform does not say, assume two units, and eleven for a family.',
      'Trusting a scheduler’s own counter: it may count differently.'
    ],
    faq: [
      { q: 'Why 2,200 for TikTok when the app takes longer captions?', a: 'TikTok’s developer documentation gives 2,200 UTF-16 units for captions posted through its API, which scheduling tools use. The app is widely reported to accept more, but no TikTok page we found states a figure.' },
      { q: 'Does a line break count?', a: 'Yes: one character everywhere here, and a weight of 1 on X.' },
      { q: 'Do hashtags and mentions count towards the length?', a: 'Yes. Every character of a #tag or an @name counts like any other; only links get a fixed weight, and only on X.' }
    ],
    runs: [
      /* /social/caption-counter/, "Try an example": the .stat-row figures (Characters 225, UTF-16 units 227, Bytes (UTF-8) 236) and the rows (X 223 / 280, Threads 233 / 500); the menu link smallbatch.example.com/menu is 27 characters */
      { browser: { page: '/social/caption-counter/', action: 'Try an example', linkChars: 27 }, shown: ['225 characters', '227 UTF-16 units', '236 bytes', '223', '233'] },
      /* the same page, #cc-text set to the post below: every UTF-16 row 120, X 83 / 280 */
      { browser: { page: '/social/caption-counter/', text: 'Ready for the weekend? 🎉🎉 Our new menu is live 👉 https://smallbatch.example.com/menu-autumn-2026?utm_source=x #coffee' }, shown: ['120 units', '83 on X'] }
    ]
  },

  '/social/engagement-rate-calculator/': {
    term: 'an engagement rate',
    whatIs: [
      'An engagement rate is the share of people who did something with a post — liked, commented, shared or saved it — measured against a base: your followers, the accounts that saw it, or the number of times it was shown.',
      'There is no single definition. Reports and tools choose different bases, so one post can be quoted at very different rates; naming the base is what makes a rate comparable.'
    ],
    howItWorks: {
      text: 'The sums run in the page each time a figure changes.',
      points: [
        'Engagements are likes plus comments plus shares plus saves; a blank count is taken as 0, a blank reach or impressions as not given.',
        'Over several posts the totals are divided by the number of posts only for the follower base, because reach and impressions are already totals.',
        'A rate is shown only when its base is above 0, and each card prints the sum behind it.',
        'Counts must be whole numbers; commas and spaces are ignored, so 12,400 is read as 12400.'
      ]
    },
    worked: {
      text: 'One post with 412 likes, 38 comments, 17 shares and 55 saves has 522 engagements. Against 12,400 followers that is 4.21%; against a reach of 9,850 it is 5.30%; against 14,200 impressions 3.68%. Likes and comments alone give 3.63%.'
    },
    uses: [
      ['Monthly reports', 'Ten posts in, the per-post average and the rate by reach fit on one line.'],
      ['Influencer shortlists', 'The same formula for every account you weigh up.'],
      ['Testing posting times', 'Compare two weeks of posts made at different hours, by reach.']
    ],
    mistakes: [
      'Mixing bases: setting your rate by reach against someone else’s rate by followers.',
      'Dividing summed reach by the number of posts as well; added up over the posts, it is already the right base.'
    ],
    faq: [
      { q: 'Should video views count as engagements?', a: 'Not here. Views measure exposure, like impressions, so enter them as impressions and the calculator gives the rate per view.' },
      { q: 'Does adding more posts lower the rate by followers?', a: 'No: engagements are averaged per post before dividing by followers. If it falls, the newer posts did less well.' },
      { q: 'Does it work for a Facebook Page or a LinkedIn company page?', a: 'Yes. Put reactions in likes and reposts in shares; the formulas stay the same.' }
    ],
    runs: [
      /* /social/engagement-rate-calculator/?likes=412&comments=38&shares=17&saves=55&followers=12400&reach=9850&impressions=14200&posts=1, 2 decimal places: the .social-er-card values */
      { browser: { page: '/social/engagement-rate-calculator/', likes: 412, comments: 38, shares: 17, saves: 55, followers: 12400, reach: 9850, impressions: 14200, posts: 1 }, shown: ['522 engagements', '4.21%', '5.30%', '3.68%', '3.63%'] }
    ]
  }
};
