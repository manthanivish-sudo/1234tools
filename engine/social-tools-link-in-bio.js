/**
 * Link in Bio Page Maker — the spec build-social.js reads. The page loads
 * the `scripts` listed, never this file. The engine is
 * engine/social-link-in-bio.js. Every behaviour quoted here is checked by
 * build/social/tests/link-in-bio.js (the downloaded file is opened in a
 * fresh page with every request recorded) and the claims in
 * build/tests/claims/social.js.
 */
(function () {
  window.SOCIAL_TOOLS = window.SOCIAL_TOOLS || {};
  window.SOCIAL_TOOLS['link-in-bio'] = {
    order: 7,
    title: 'Link in Bio Page Maker',
    pageTitle: 'Link in Bio Page Maker — One HTML File, Yours to Host | 1234Tools',
    description: 'Make a link-in-bio page as one HTML file you own: photo, name, bio, link buttons and icons, in eight themes. The file has no scripts and makes no outside requests, so it works offline and on any static host. Nothing is uploaded.',
    keywords: ['link in bio', 'link in bio page', 'free link in bio', 'link in bio without account', 'instagram bio link page',
      'tiktok link in bio', 'bio link page html', 'static link page', 'self hosted link in bio'],
    glyph: 'i-social-links',
    glyphSvg: '<symbol id="i-social-links" viewBox="0 0 24 24">\n  <rect x="5" y="2.5" width="14" height="19" rx="2.5"/>\n  <circle cx="12" cy="7" r="1.8"/>\n  <path d="M8.5 11.5h7M8.5 14.5h7M8.5 17.5h7" class="thin"/>\n</symbol>',
    category: 'DesignApplication',
    scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/social-link-in-bio.js'],
    privacy: 'Nothing you add is uploaded. The page is built in your browser and saved straight to your downloads; the photo is shrunk on your device and stored inside the file. The look you pick is remembered in this browser. Your name, bio, photo and links are kept here only if you tick “Remember this page in this browser”, and unticking it deletes them. The file you download has no scripts, no analytics and no links back to this site.',
    how: [
      'Add a photo, your name and a line or two of bio.',
      'Add your links — the words on each button and its https:// address — and put them in order with the arrows. Add icons for your profiles, email or phone.',
      'Pick a theme (eight to choose from), a button style, corners and a font, and watch the preview.',
      'Press Download index.html. That one file is the whole page.',
      'Upload it to any static host as the home page and put its address in your bio. Export the project as a .json file to edit it again later.'
    ],
    uses: [
      ['Creators', 'One address in an Instagram or TikTok bio that leads to the shop, the newsletter and the latest video.'],
      ['Small shops and studios', 'Opening hours, booking and the shop on one page that loads instantly on a phone signal.'],
      ['Events and talks', 'Slides, sign-up and contact on one page behind a QR code on the last slide.'],
      ['Anyone who wants to own their page', 'A file on your own host or domain: no account to lose, no branding and no tracking you did not choose.']
    ],
    tips: [
      'Put the link that matters most at the top: most visitors tap the first button.',
      'Keep button words short and specific — “Book a workshop”, not “Click here”.',
      'Use a square, well-lit photo of your face or logo; it is shown as a circle.',
      'Tick “Remember this page in this browser” if you will come back on this device; export the project file if you might edit it elsewhere.',
      'Pair it with the QR code generator for flyers, cards and the last slide of a talk.'
    ],
    faq: [
      { q: 'Does the page track visitors or load anything from elsewhere?', a: 'No. The file has no scripts, no web fonts, no analytics and no images fetched from anywhere: the photo and the icons are inside the file, and the fonts are the ones already on the visitor’s device. Opening it makes no network request at all, so it also works offline. If you want visit counts, your host’s own statistics are the place for them.' },
      { q: 'Why are only https:// links allowed?', a: 'A link-in-bio page is opened by strangers on their phones. https:// addresses are encrypted and are what the apps expect; other kinds of address — javascript:, data:, plain http:// — can be used to run code or to send people somewhere unsafe, so they are refused and left out of the page with a note saying why. Email and phone icons are the exception: they become mailto: and tel: links built from an address or number that has been checked.' },
      { q: 'Where do I put the file?', a: 'On any static web host: upload index.html as the home page of a site and use that site’s address in your bio. Free static-site hosts let you drag the file into a web page; your own domain’s web space works just as well. This site is not involved after the download.' },
      { q: 'Are those the real platform logos?', a: 'No. The icons are simple, generic symbols drawn for this tool — a camera for Instagram, a play button for YouTube, an envelope for email — so no company’s trademark is copied. Each icon carries the platform’s name as its label, which screen readers announce and which shows when you hover.' },
      { q: 'How big is the file?', a: 'Small. Without a photo the example page is about 3 KB; the photo is cut to a 256-pixel square JPEG and stored inside the file, and with each of our three sample photos the whole page came to between 23 and 27 KB. The tool shows the size as you edit and warns if it passes 200 KB.' },
      { q: 'Can I edit it later?', a: 'Yes. Either tick “Remember this page in this browser” and it is here when you come back on this device, or press Export the project to save a .json file you can import on any device. Edit, download again and replace the file on your host.' },
      { q: 'Is anything I type stored or sent?', a: 'Nothing is sent anywhere. Unless you tick “Remember this page in this browser”, your name, bio, photo and links are gone when you close the page; only the theme, buttons, corners and font are remembered.' }
    ],
    related: ['/qr/qr-code-generator/', '/developer/meta-tag-generator/', '/image/circle-crop/', '/developer/favicon-generator/']
  };
})();
