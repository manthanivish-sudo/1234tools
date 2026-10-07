'use strict';
/* Kit v2 story data: Developer & Web Tools. Contract: kit2-schema.md, sections 1 and 2.
   Tools mounted with mountCode take a `text` example (?text=, default options);
   form generators (a link sets only their settings, never a text) and the favicon tool get a
   schematic with true in/out words. */
module.exports = {
  '/developer/json-formatter/': {
    persona: 'Developers and API testers',
    hook: 'Unexpected token at position 214. Where, exactly?',
    pain: 'The API sent back one long line of JSON, and something in it will not parse. Your eyes give up first.',
    usual: ['Pasting configs into sites you do not know', 'Squinting at one 4,000-character line', 'Editor plugins you have to install'],
    promise: 'Paste JSON. Get it tidy, repaired, queried or turned into YAML, CSV or XML, or the exact line and column at fault.',
    steps: ['Paste or open the JSON', 'Pick formatted, minified, YAML, CSV or XML', 'Copy or download the result'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'text',
      input: '{"order":1042,"customer":{"name":"Priya Shah","city":"Leeds"},"items":[{"sku":"MUG-01","qty":2,"price":8.5},{"sku":"TEE-03","qty":1,"price":18}],"paid":true,"notes":null}'
    },
    howTo: 'How to format and validate JSON',
    cta: 'Format JSON'
  },
  '/developer/xml-formatter/': {
    persona: 'Developers working with feeds',
    hook: 'The product feed is one line of XML. Find the bad tag.',
    pain: 'The supplier’s feed arrives as a single unbroken line, and the import fails somewhere inside it.',
    usual: ['Scrolling sideways through one long line', 'A heavy IDE for a one-off check', 'Pasting supplier data into random sites'],
    promise: 'Paste XML. Get it indented and checked, with the line and column of the first error, and query it with XPath.',
    steps: ['Paste the XML', 'Pick pretty or minify', 'Copy the tidy XML'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'text',
      input: '<feed><product id="A12"><name>Oak desk</name><price currency="GBP">249.00</price><stock>4</stock></product><product id="B07"><name>Desk lamp</name><price currency="GBP">39.50</price><stock>0</stock></product></feed>'
    },
    howTo: 'How to format and check XML',
    cta: 'Format XML'
  },
  '/developer/csv-to-json/': {
    persona: 'Developers moving spreadsheet data',
    hook: 'The spreadsheet is CSV. The API wants JSON.',
    pain: 'Someone exported a sheet and you need it as JSON for a seed file. One name has a comma in quotes.',
    usual: ['Writing a throwaway script for it', 'Converters that split quoted commas', 'Fixing broken columns by hand'],
    promise: 'Paste or open a CSV. Get clean JSON or JSON Lines, quoted commas handled, with a table to check it. And back again.',
    steps: ['Paste or open the CSV', 'Pick the direction', 'Copy or download the JSON'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'text',
      input: 'name,team,city\nPriya Shah,Design,Leeds\n"Okafor, James",Sales,Bristol\nAnna Nowak,Support,Cardiff'
    },
    howTo: 'How to convert CSV to JSON',
    cta: 'Convert CSV'
  },
  '/developer/base64/': {
    persona: 'Developers and integration testers',
    hook: 'Base64 that does not choke on é, ₹ or ✓.',
    pain: 'A quick encode of a customer name throws an error the moment it holds an accent or a ₹ sign.',
    usual: ['Encoders that only handle plain Latin', 'Console one-liners you have to recall', 'Mistaking Base64 for encryption'],
    promise: 'Paste text or open a file. Get Base64, a data URI or URL-safe output, and back again, with a preview for images.',
    steps: ['Paste the text or open a file', 'Pick encode or decode', 'Copy or download the result'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: 'Café Zoë — ₹1,499 paid ✓' },
    howTo: 'How to encode text to Base64',
    cta: 'Encode Base64'
  },
  '/developer/url-encoder/': {
    persona: 'Developers and marketers building links',
    hook: 'Your link broke at the ampersand.',
    pain: 'The search term in your link has a space and an & in it. The page at the other end reads half of it.',
    usual: ['Hand-replacing spaces with %20', 'Links that break inside emails', 'Double-encoding % into %25'],
    promise: 'Paste the value or a list. Get it percent-encoded for a component, a whole URL or a form, or a query string as a table.',
    steps: ['Paste the text, a list or a query string', 'Pick component, full URL or form', 'Copy the result'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: 'fish & chips, Leeds (open late?)' },
    howTo: 'How to URL-encode text for a link',
    cta: 'Encode a URL'
  },
  '/developer/html-entities/': {
    persona: 'Web editors and developers',
    hook: 'Your code sample vanished from the blog post.',
    pain: 'You pasted <div class="note"> into the article, and the browser read it as markup and hid it.',
    usual: ['Escaping angle brackets by hand', 'Missing one & and double-escaping', 'CMS editors that eat your tags'],
    promise: 'Paste text. Get it escaped to show safely in HTML, with any of 2,125 named entities, or decoded back.',
    steps: ['Paste the text', 'Pick escape or unescape', 'Copy the result'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: '<div class="note">Tea & biscuits at 3 > 2</div>' },
    howTo: 'How to escape HTML special characters',
    cta: 'Escape HTML'
  },
  '/developer/jwt-decoder/': {
    persona: 'Developers debugging logins',
    hook: 'Why was the user logged out? Read the exp claim.',
    pain: 'The login keeps failing and the token is a wall of letters and dots. You need the payload and expiry now.',
    usual: ['Decoding by hand in the console', 'Pasting live tokens into unknown sites', 'Forgetting exp is seconds, not ms'],
    promise: 'Paste a JWT. See its header, payload and expiry in plain words, and check its signature with your secret or public key.',
    steps: ['Paste the token', 'Read every claim explained', 'Verify it with the secret or key'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'text',
      input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEwNDIiLCJuYW1lIjoiVGVzdCBVc2VyIiwicm9sZSI6ImVkaXRvciIsImlhdCI6MTc5MDAwMDAwMCwiZXhwIjoxNzkwMDAzNjAwfQ.bm90LWEtcmVhbC1zaWduYXR1cmUtanVzdC1hLWRlbW8'
    },
    howTo: 'How to decode a JWT and check its expiry',
    cta: 'Decode a JWT'
  },
  '/developer/meta-tag-generator/': {
    persona: 'Site owners and SEO beginners',
    hook: 'You shared your new page. The preview was a bare URL.',
    pain: 'The link went out on WhatsApp with no picture and no title. Nobody tapped it.',
    usual: ['Copying tags from another site’s source', 'Titles cut off in search results', 'SEO plugins for five lines of HTML'],
    promise: 'Fill in the page details. See how Google, Facebook and X will show it, then copy the meta, Open Graph and Twitter tags.',
    steps: ['Enter title and description', 'Add the share image and check its size', 'Copy the tags into <head>'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'Page title, description, URL and share image',
      output: 'Meta, Open Graph and Twitter Card tags to paste',
      sampleIn: 'Harbour Café · Breakfast and brunch on Whitby quay · 1200×630 image',
      sampleOut: '<meta property="og:title" content="Harbour Café"> <meta property="og:image" content="…">'
    },
    howTo: 'How to make Open Graph meta tags',
    cta: 'Generate meta tags'
  },
  '/developer/robots-txt-generator/': {
    persona: 'Site owners and developers',
    hook: 'Keep AI training crawlers out without hurting search.',
    pain: 'You want search engines in, the admin pages out and some AI crawlers blocked. One wrong line blocks everything.',
    usual: ['Copying a robots.txt from another site', 'One stray slash that blocks the whole site', 'Plugins that hide what they write'],
    promise: 'Pick the rules and the bots. Copy a valid robots.txt.',
    steps: ['Set the crawl rules', 'Add your sitemap', 'Copy it to the domain root'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'Crawl rules, bots to block and your sitemap',
      output: 'A valid robots.txt for the root of your domain',
      sampleOut: 'User-agent: * · Disallow: /admin/ · User-agent: Google-Extended · Disallow: / · Sitemap: …/sitemap.xml'
    },
    howTo: 'How to write a robots.txt file',
    cta: 'Build robots.txt'
  },
  '/developer/htaccess-generator/': {
    persona: 'Site owners on Apache hosting',
    hook: 'Your site answers on http and https. Pick one.',
    pain: 'Your home page loads at four addresses: http, https, with www and without. One redirect fixes it.',
    usual: ['Copying rules from old forum posts', 'One typo and a 500 error', 'Waiting on hosting support'],
    promise: 'Tick HTTPS, www, caching and headers. Copy the rules.',
    steps: ['Tick the options you need', 'Copy the rules', 'Paste them into .htaccess'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'HTTPS, www, caching and security header options',
      output: 'Apache rules ready to paste into .htaccess',
      sampleOut: 'RewriteEngine On · RewriteCond %{HTTPS} off · RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]'
    },
    howTo: 'How to force HTTPS with .htaccess',
    cta: 'Generate .htaccess'
  },
  '/developer/uuid-generator/': {
    persona: 'Developers seeding test data',
    hook: 'You need 50 unique IDs for test data. Right now.',
    pain: 'The fixture file needs fifty IDs and you are about to type “test-id-1, test-id-2”.',
    usual: ['Made-up IDs that collide later', 'A script written for a one-off list', 'Generators with a weak random source'],
    promise: 'Pick how many. Get v4, v7 or v1 UUIDs, ULIDs or nanoids from the browser’s crypto source, or check any ID.',
    steps: ['Pick the type and how many', 'Generate', 'Copy the list'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'How many UUIDs you need',
      output: 'Random version 4 UUIDs, one per line',
      sampleOut: 'Shape of each: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx'
    },
    howTo: 'How to generate UUIDs in bulk',
    cta: 'Generate UUIDs'
  },
  '/developer/lorem-ipsum/': {
    persona: 'Designers and front-end developers',
    hook: 'The layout is ready. The words are not.',
    pain: 'The mock-up needs body text today. The client’s copy arrives next week, if at all.',
    usual: ['Pasting one paragraph ten times', 'Latin filler that looks unfinished to clients', 'Ad-filled generator pages'],
    promise: 'Pick paragraphs, sentences or words. Latin or plain English.',
    steps: ['Pick the length', 'Choose Latin or English', 'Copy the text'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'How many paragraphs, sentences or words',
      output: 'Placeholder text in classical Latin or plain English'
    },
    howTo: 'How to generate placeholder text',
    cta: 'Get placeholder text'
  },
  '/developer/slug-generator/': {
    persona: 'Bloggers and content editors',
    hook: 'Your title has an é, a colon and a %. Your URL cannot.',
    pain: 'Your post title has accents, punctuation and capitals, and the CMS turned the slug into a mess.',
    usual: ['Slugs typed by hand, with typos', 'Underscores search engines do not split', 'Accents turned into %-codes'],
    promise: 'Paste titles, one per line. Get clean, hyphenated slugs.',
    steps: ['Paste your titles', 'Pick separator and case', 'Copy the slugs'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: 'Café Menus: 10 Tips for Autumn 2026!\nWhy Our Crème Brûlée Sells Out (Every Time)\n50% Off Brunch — This Weekend Only' },
    howTo: 'How to make a URL slug from a title',
    cta: 'Make a slug'
  },
  '/developer/case-converter/': {
    persona: 'Developers renaming things',
    hook: 'user_profile_url, userProfileUrl or user-profile-url?',
    pain: 'The API sends snake_case, the front end wants camelCase and the CSS wants kebab-case. Retyping invites typos.',
    usual: ['Renaming every field by hand', 'A regex you write once and lose', 'Acronyms mangled into H T T P'],
    promise: 'Paste the names. Get camelCase, snake_case, kebab-case and more.',
    steps: ['Paste one name per line', 'Pick the target case', 'Copy the result'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: 'user profile image url\nHTTP response code\norder_total_amount\nmax-retry-attempts' },
    howTo: 'How to convert text to camelCase or snake_case',
    cta: 'Convert case'
  },
  '/developer/color-converter/': {
    persona: 'Designers and front-end developers',
    hook: 'Your brand yellow on white scores 1.57:1. Text needs 4.5.',
    pain: 'The brand colour looks great on a button. As text on white, people squint, and an audit will flag it.',
    usual: ['Converting HEX to HSL by hand', 'Guessing whether text is readable', 'Hopping between three colour sites'],
    promise: 'Enter a colour in any CSS syntax. Get HEX, RGB, HSL, OKLCH and more, its WCAG contrast score, and the nearest colour that passes.',
    steps: ['Enter the colour', 'Set the background', 'Read the contrast result or take the fix'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'A colour in HEX, RGB or HSL, and a background',
      output: 'Every format, plus WCAG AA and AAA results',
      sampleIn: '#F7C948 text on #FFFFFF',
      sampleOut: 'Contrast 1.57:1: fails AA for body text (needs 4.5:1)'
    },
    howTo: 'How to check colour contrast for accessibility',
    cta: 'Check a colour'
  },
  '/developer/css-gradient/': {
    persona: 'Front-end developers and designers',
    hook: 'Two colours, one live preview, one line of CSS.',
    pain: 'You want a smooth hero gradient, and every hand-typed attempt goes muddy grey in the middle.',
    usual: ['Typing stops and refreshing the browser', 'Gradients that go grey in the middle', 'A design app just for one CSS line'],
    promise: 'Drag the colour stops and the angle. Blend in OKLab so the middle stays clean, then copy the CSS, a Tailwind class or a PNG.',
    steps: ['Drag or type the colour stops', 'Set the angle, or the centre', 'Copy the CSS or save a PNG'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'Colour stops, angle or centre, type and blend',
      output: 'Copy-ready linear, radial or conic CSS, a Tailwind class and a PNG',
      sampleOut: 'background: linear-gradient(120deg in oklab, #0000ff 0%, #ffff00 100%);'
    },
    howTo: 'How to make a CSS gradient',
    cta: 'Build a gradient'
  },
  '/developer/favicon-generator/': {
    persona: 'Anyone launching a website',
    hook: 'Your site is live. The browser tab shows a blank icon.',
    pain: 'Every device wants a different icon size, and the HTML to load them is another thing to get wrong.',
    usual: ['Resizing the logo eight times by hand', 'Generators that upload your logo', 'Forgetting the HTML that loads them'],
    promise: 'Drop in a square image, or type a letter or pick an emoji. Get every size, an SVG with a dark-mode option, and the HTML.',
    steps: ['Drop in an image or type a letter', 'Download the icon set', 'Paste the HTML into <head>'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'schematic',
      input: 'One square logo, 512 px or larger',
      output: 'Every favicon and app icon size, plus the HTML',
      sampleIn: 'logo-512.png',
      sampleOut: 'favicon-16, favicon-32, apple-touch-icon 180, 192 and 512 app icons, and the <link> tags'
    },
    howTo: 'How to make a favicon from a logo',
    cta: 'Make a favicon'
  },
  '/developer/hash-generator/': {
    persona: 'Developers checking data',
    hook: 'Change one character and watch every hash change.',
    pain: 'You need the SHA-256 of a string for a test, and the terminal command is different on every machine.',
    usual: ['A different command on every OS', 'Pasting secrets into sites that may log', 'Using MD5 where SHA-256 belongs'],
    promise: 'Type text or open a file of any size. Get SHA-256, SHA-1, MD5 and CRC32 at once, or SHA-3 and HMAC, and check it against the published value.',
    steps: ['Type the text or open the file', 'Pick the algorithms', 'Copy the hash or paste the expected one'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: 'The quick brown fox jumps over the lazy dog' },
    howTo: 'How to make a SHA-256 hash of some text',
    cta: 'Hash some text'
  },
  '/developer/regex-tester/': {
    persona: 'Developers writing patterns',
    hook: 'Your regex matched nothing. Was it the g flag?',
    pain: 'You need every email address out of a block of text. The pattern works in your head, not in code.',
    usual: ['Trial and error in the console', 'Testers that use a different engine', 'Forgetting the g flag, again'],
    promise: 'Type the pattern, paste the text. See every match and group coloured live, and each part of the pattern explained.',
    steps: ['Type your pattern', 'Paste the test text', 'Read matches and groups'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'text',
      input: 'Please reply to orders@harbourcafe.example or to Sam (sam.lee@post.example).\nThe old address info@old-domain no longer works.\nInvoices: accounts@harbourcafe.example'
    },
    howTo: 'How to test a regular expression online',
    cta: 'Test a regex'
  },
  '/developer/cron-parser/': {
    persona: 'Developers and sysadmins',
    hook: 'When does “*/15 9-17 * * 1-5” actually run?',
    pain: 'A job ran at 2 a.m. on a Sunday and nobody knows why. The cron line is your only clue.',
    usual: ['Counting asterisks on your fingers', 'Deploying and waiting to see', 'Mixing up day-of-month and weekday'],
    promise: 'Paste the cron line, Unix, seconds-first or Quartz. Read it in plain English, with the next runs in the time zone you choose.',
    steps: ['Paste the expression', 'Read the plain English', 'Check the next run times in your zone'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: '*/15 9-17 * * 1-5\n0 2 * * 0' },
    howTo: 'How to read a cron expression',
    cta: 'Parse a cron line'
  },
  '/developer/markdown-preview/': {
    persona: 'Writers and developers using Markdown',
    hook: 'You wrote it in Markdown. The newsletter wants HTML.',
    pain: 'The update is written in Markdown. The newsletter tool only takes HTML, and converting by hand breaks the lists.',
    usual: ['Hand-writing <ul> and <li> tags', 'Converters that let raw HTML through', 'Installing a tool for one conversion'],
    promise: 'Paste Markdown. See it rendered beside the text, tables, task lists, footnotes and maths included, and copy clean HTML or save a styled page.',
    steps: ['Paste or open the Markdown', 'Check the live preview', 'Copy the HTML, export it or print it'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: {
      kind: 'text',
      input: '## Opening hours\n\nWe are **open late** on Fridays.\n\n- Mon to Thu: 8 am to 6 pm\n- Fri: 8 am to 10 pm\n- Sun: *closed*\n\nBook a table at [our site](https://example.com/book).'
    },
    howTo: 'How to convert Markdown to HTML',
    cta: 'Convert Markdown'
  }
};
