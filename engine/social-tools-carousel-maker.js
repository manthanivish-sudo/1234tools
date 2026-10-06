/**
 * Carousel Maker — the spec build-social.js reads. The page loads the
 * `scripts` listed, never this file. Copy rules: nothing the visitor adds is
 * uploaded; sizes and file names are what engine/social-carousel-maker.js
 * writes (build/social/tests/carousel-maker.js checks them).
 */
(function () {
  window.SOCIAL_TOOLS = window.SOCIAL_TOOLS || {};
  window.SOCIAL_TOOLS['carousel-maker'] = {
    order: 1,
    title: 'Carousel Maker',
    pageTitle: 'Free Carousel Maker for Instagram & LinkedIn (PDF) | 1234Tools',
    description: 'Make an Instagram or LinkedIn carousel from text slides and photos in your browser: seven templates, your colours and handle, a progress indicator and a swipe cue. Download a ZIP of PNGs or one PDF for LinkedIn. Nothing you add is uploaded.',
    keywords: ['carousel maker', 'instagram carousel maker', 'linkedin carousel maker', 'linkedin carousel pdf', 'carousel post template',
      'instagram carousel template free', 'make a carousel post', 'slides to pdf for linkedin', 'instagram 4:5 carousel', 'free carousel generator'],
    glyph: 'i-social-carousel',
    glyphSvg: '<symbol id="i-social-carousel" viewBox="0 0 24 24">\n  <rect x="6.5" y="4" width="11" height="14" rx="2"/>\n  <path d="M4 6.5v9M20 6.5v9" class="thin"/>\n  <circle cx="10" cy="20.5" r=".9" class="fill"/>\n  <circle cx="12" cy="20.5" r=".9"/>\n  <circle cx="14" cy="20.5" r=".9"/>\n</symbol>',
    category: 'DesignApplication',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/social-kit.js', '/engine/social-carousel-maker.js'],
    privacy: 'Nothing you add is uploaded. Your words, photos and logo are read and drawn by this page in your browser, and the PNGs and the PDF are written on your device and saved straight to your downloads. The size, the template and the indicator settings are remembered in this browser; your slides are not kept when you close the page. A brand kit (colours, fonts, handle and logo) is kept in this browser only when you press “Save brand kit on this device”, and “Forget the saved kit” removes it. There is no account.',
    how: [
      'Write your slides: a heading and a line or two of text each. The example carousel shows the shape; add, move or delete slides, up to 20.',
      'Add photos if you want them: drop several at once and each goes on the next slide without one, or give one slide its own. A file that is not an image is named and skipped.',
      'Pick a template — Bold hook, Numbered tips, Quote, Before and after, Checklist, Minimal or Gradient — the size, 1080 × 1350 or 1080 × 1080, and a progress indicator: dots, a bar, the slide number or none.',
      'Set your colours, fonts, handle and logo in Brand. The preview is phone-shaped and swipes like the real thing.',
      'Export a ZIP of PNGs named carousel-01.png, carousel-02.png and so on for Instagram, or one PDF with a page per slide for LinkedIn.'
    ],
    uses: [
      ['Tips and how-tos', 'Numbered tips gives each slide a big number, so a five-step guide reads in order at a glance.'],
      ['LinkedIn document posts', 'The PDF has one page per slide, the format LinkedIn shows as a swipeable post.'],
      ['Before and after', 'One panel for the problem, one for the fix, on every slide.'],
      ['Checklists people save', 'Each line of text becomes a ticked item, shrunk to fit the slide.'],
      ['Photo stories', 'Drop a set of photos and write a line for each; Bold hook and Quote put the words over the photo on a dark shade.']
    ],
    tips: [
      'Make the first slide the reason to swipe: a promise or a question, not your logo.',
      'One idea per slide. When a slide says “cut with …”, the words did not fit even at the smallest size: split it in two.',
      'Use 1080 × 1350 for Instagram: a 4:5 slide takes more of the feed than a square one. Keep every slide of a carousel the same size; the tool makes them all one size.',
      'End on a slide that asks for something: save, follow, comment or visit.',
      'Keep your handle on every slide: carousels get screenshotted and shared on their own.',
      'Check the contrast warning under the preview: light text on a pale accent is hard to read on a phone in daylight.'
    ],
    faq: [
      { q: 'What sizes does it make?', a: '1080 × 1350 pixels (4:5 portrait) or 1080 × 1080 (square). Instagram shows photos at 1080 pixels wide and keeps shapes between 1.91:1 and 4:5, so the portrait size is the tallest that is not cropped. The PDF pages are the same shape.' },
      { q: 'How do I post the PDF on LinkedIn?', a: 'Start a post, choose “Add a document”, pick carousel-linkedin.pdf and give it a title. LinkedIn shows each page as a slide that people swipe through. The PDF holds the slides as images, so the text in it is not selectable.' },
      { q: 'How do I post the ZIP on Instagram?', a: 'Unzip it on your phone or computer, then start a new post and select the PNGs in order — they are numbered carousel-01.png upwards so they sort the right way.' },
      { q: 'Is anything uploaded?', a: 'No. The slides are drawn on a canvas in your browser and the PNG, ZIP and PDF files are put together on your device. We never receive your text, photos or logo.' },
      { q: 'Is there a watermark?', a: 'No. Nothing is added to your slides except what you put there.' },
      { q: 'Are my slides saved?', a: 'No. The words and photos stay only while the page is open. The size, template and indicator are remembered, and your brand kit is kept only if you press Save; both stay in this browser.' },
      { q: 'What happens when the text is too long?', a: 'Each block of text is shrunk step by step until it fits its space. If it still does not fit at the smallest size, the end is cut with “…” and the page names the slide, so nothing is ever drawn off the edge.' },
      { q: 'Which fonts can I use?', a: 'Sora and Inter, which this site serves itself, and common system fonts: Georgia, Arial, Arial Black, Impact, Trebuchet MS, Verdana, Times New Roman and Courier New. If a device lacks one, it draws its nearest sans-serif instead.' }
    ],
    related: ['/image/social-media-resizer/', '/image/image-to-pdf/', '/ai/social-post-writer/', '/image/image-compressor/']
  };
})();
