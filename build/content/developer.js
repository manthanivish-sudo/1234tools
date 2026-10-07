/**
 * The reading part of the Developer tools, rendered by build-depth.js in its
 * file-and-text shape (howItWorks in place of formula). Shape and rules:
 * build-depth.js and build/content/_check.js.
 *
 * Every figure in a worked example comes from a run of the page's own engine,
 * recorded in `runs` with its input and options; build/content/_check.js runs
 * each one again in Node (the spec's transform or generate) and compares.
 * A tool that needs a browser (canvas, camera) records its run as
 * { browser: { … }, shown: [ … ] }: what was given and set, and what it showed.
 */
'use strict';

module.exports = {
  '/developer/json-formatter/': {
    term: 'JSON',
    whatIs: [
      'JSON is a plain-text format for structured data: objects of "name": value pairs in curly braces, arrays in square brackets, and strings, numbers, true, false and null.',
      'RFC 8259, the standard, allows no comments, no trailing commas, no single quotes and no unquoted keys. JavaScript accepts some of those; a strict parser rejects every one.'
    ],
    howItWorks: {
      text: 'Your text goes to the browser’s own parser, `JSON.parse`, so the verdict is the one your code would get.',
      points: [
        'When parsing fails, the tool’s own checker finds the first fault and prints its line, column and the reason, whatever the browser’s message says. A trailing comma is marked at the comma itself.',
        'A valid document is written back with `JSON.stringify`: indented by 2 or 4 spaces or a tab, or on one line when minified.',
        'With keys sorted, every object at every depth is rebuilt in alphabetical key order; arrays keep their own order.',
        'Repair edits your own text, then hands it to `JSON.parse`, so nothing is called valid that the browser refuses.',
        'JSONPath queries (RFC 9535) run in the tool’s own code, and YAML, CSV and XML come from its own writers.',
        'The figures count every key and array item at all levels, the deepest nesting, and both sizes in UTF-8 bytes.'
      ]
    },
    worked: {
      text: 'A five-line service config, {"port": 8080, "hosts": ["api.internal", "cache.internal"], "retries": 3,}, will not load. The tool points at line 4, column 15: the stray comma after 3. Without it the file has 5 keys and items, depth 3, and minifies from 81 B to 67 B. As YAML it is 64 B, and $.hosts[-1] picks "cache.internal".'
    },
    uses: [
      ['Reading an API response', 'Make a one-line body from the network tab readable.'],
      ['Finding why a config will not load', 'Get the line and column of a stray comma.'],
      ['Pulling fields out of an export', 'The query $..sku lists every SKU in an order dump, with the path of each.']
    ],
    mistakes: [
      'Pasting a JavaScript object literal. Single quotes, bare keys and comments work in a .js file and are invalid JSON.',
      'Taking the error line literally. Other than a trailing comma, the position is where the parser gave up, often a line after the real fault, such as a missing comma.'
    ],
    faq: [
      { q: 'Can JSON have comments?', a: 'Not under RFC 8259; JSONC and JSON5 add them. This parser rejects them unless Repair is ticked: then each comment is removed and listed.' },
      { q: 'Why did a long number change after formatting?', a: 'JSON numbers are read as 64-bit floating-point values, so whole numbers past 9,007,199,254,740,991 lose precision: an ID of 12345678901234567890 comes back as 12345678901234567000. Keep long IDs in strings.' },
      { q: 'Which JSONPath syntax does it follow?', a: 'RFC 9535: a filter is written ?@.price < 10, and the older ?(@.price < 10) works too.' }
    ],
    related: { guides: ['/guides/format-json/'] },
    runs: [
      /* the broken config, default options (formatted, 2 spaces) */
      { input: '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3,\n}', check: [['error', 'line 4, column 15']] },
      /* the same config with the comma removed, minified */
      { input: '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3\n}', options: { mode: 'minify' }, check: [['stat:Keys / items', '5'], ['stat:Max depth', '3'], ['stat:Input', '81 B'], ['stat:Output', '67 B']] },
      /* the FAQ's long ID */
      { input: '{"id": 12345678901234567890}', options: { mode: 'minify' }, check: [['output', '12345678901234567000']] },
      /* the broken config again, with Repair ticked */
      { input: '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3,\n}', options: { repair: 'yes' }, check: [['stat:Keys / items', '5']] },
      /* as YAML, and queried */
      { input: '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3\n}', options: { mode: 'yaml' }, check: [['stat:Output', '64 B']] },
      { input: '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3\n}', options: { mode: 'minify', query: '$.hosts[-1]' }, check: [['output', '"cache.internal"'], ['stat:JSONPath matches', '1']] }
    ]
  },

  '/developer/base64/': {
    term: 'Base64',
    whatIs: [
      'Base64 writes arbitrary bytes with 64 printable characters: A–Z, a–z, 0–9, + and /. Every three bytes become four characters of 6 bits each, so binary data such as a key or an image survives email, JSON or an HTTP header.',
      'RFC 4648 is the standard. It adds = padding to round the output to a multiple of four, and a second alphabet, base64url, with - and _ in place of + and /, which JWTs use with the padding dropped. No key is involved: it writes bytes down rather than hiding them.'
    ],
    howItWorks: {
      text: 'Text is first turned into UTF-8 bytes by the tool’s own encoder, so an emoji becomes four bytes before any Base64 is written; the browser’s `btoa()` is not used.',
      points: [
        'Encoding reads three bytes at a time and looks up each 6-bit slice in the table; a short last group gets one or two = signs.',
        'URL-safe output swaps + for - and / for _, then drops the = signs.',
        'Decoding accepts either alphabet, restores missing padding and ignores spaces and line breaks. Any other stray character is an error.',
        'Input, Output and Growth count UTF-8 bytes: Café Zoë — ₹1,499 paid ✓ is 32 B in, 44 B out, +38%.',
        'Open or drop any file to encode its bytes. Decode shows text as text; anything else gets a hex view, a Download of the exact bytes and, for images, a preview.'
      ]
    },
    worked: {
      text: 'The query condition x >= y? is 7 B. Standard encoding gives eCA+PSB5Pw==, 12 B: two = signs pad the short last group and Growth reads +71%. That + would turn into a space inside a query string. URL-safe gives eCA-PSB5Pw, 10 B, and Decode turns it straight back into x >= y?.'
    },
    uses: [
      ['Kubernetes secrets', 'Secret manifest values are stored this way; decode one to check it.'],
      ['HTTP Basic authentication', 'Build or check an Authorization header, which carries user:password encoded.'],
      ['Data URIs', 'Inline a small SVG or font in CSS to save a request.']
    ],
    mistakes: [
      'Copying a Base64 string with its quotation marks or a trailing comma from JSON or code. They are not Base64 characters, and the error names the line and column.',
      'Mixing alphabets. A base64url value without padding fails in a strict standard decoder; restore + and / and the = signs first, as this decoder does for you.'
    ],
    faq: [
      { q: 'Why does Base64 end with = or ==?', a: 'The = signs are padding. One leftover byte at the end produces two characters plus ==; two leftover bytes produce three characters plus =.' },
      { q: 'Can Base64 contain line breaks?', a: 'MIME email wraps it at 76 characters and PEM files at 64. This decoder ignores whitespace, so wrapped input decodes as one block.' },
      { q: 'How do I decode Base64 on the command line?', a: 'Use base64 -d file.txt on Linux or base64 -D on older macOS; PowerShell has [Convert]::FromBase64String($s).' }
    ],
    runs: [
      /* "x >= y?" encoded, default options (standard alphabet) */
      { input: 'x >= y?', check: [['output', 'eCA+PSB5Pw=='], ['stat:Input', '7 B'], ['stat:Output', '12 B'], ['stat:Growth', '+71%']] },
      /* the same text, Variant: URL-safe */
      { input: 'x >= y?', options: { safe: 'url' }, check: [['output', 'eCA-PSB5Pw'], ['stat:Output', '10 B']] },
      /* the URL-safe result pasted back, Direction: Decode */
      { input: 'eCA-PSB5Pw', options: { dir: 'dec' }, check: [['output', 'x >= y?']] },
      /* accented text: the byte sizes and Growth on bytes */
      { input: 'Café Zoë — ₹1,499 paid ✓', check: [['stat:Input', '32 B'], ['stat:Output', '44 B'], ['stat:Growth', '+38%']] }
    ]
  },

  '/developer/case-converter/': {
    whatTitle: 'What case conventions are',
    whatIs: [
      'Code identifiers cannot contain spaces, so programmers mark word boundaries another way: a capital letter (camelCase, PascalCase), an underscore (snake_case, CONSTANT_CASE) or a hyphen (kebab-case). The choice is convention, enforced by style guides and linters rather than compilers.',
      'Conventions collide where systems meet: CSS font-size is style.fontSize in JavaScript, and a created_at column often reaches the front end as createdAt.'
    ],
    howItWorks: {
      text: 'Each line is split into words on its own, then rejoined in the style you pick.',
      points: [
        'A lower-case letter or digit followed by a capital starts a new word: userId becomes user and Id.',
        'In a run of capitals, the last one before a lower-case letter starts the next word, so XMLHttp splits into XML and Http.',
        'Underscores, hyphens, dots and slashes become spaces; other punctuation stays attached to its word.',
        'The words are re-cased and joined, by dots for dot.case and slashes for path/case. Title Case keeps 14 short words such as of, and and vs lower-case unless they come first.',
        'Alternating case counts letters only, so a space or digit does not break the lower, upper rhythm; Every case at once prints all twelve forms under each line.'
      ]
    },
    worked: {
      text: 'XMLHttpRequest, getUserIDs and v2ApiClient in snake_case give xml_http_request, get_user_i_ds and v2_api_client, with Lines converted at 3. The middle one shows the limit of splitting on capitals: the plural IDs is read as a capital I and a word, Ds. Rename it getUserIds and the result is get_user_ids. A path converts too: src/components/NavBar in dot.case is src.components.nav.bar.'
    },
    uses: [
      ['Mapping an API to a front end', 'Turn snake_case response fields into the camelCase names a TypeScript interface uses.'],
      ['Database columns', 'Convert a spreadsheet’s header row into snake_case column names for a CREATE TABLE statement.'],
      ['Environment variables', 'Make CONSTANT_CASE keys such as DATABASE_URL.']
    ],
    mistakes: [
      'Converting sentences with punctuation. Commas and exclamation marks stay inside the words, so Hello, world! in Title Case is Hello, World!; strip punctuation first when you want identifiers.',
      'Trusting Title Case with names. Short words after the first are always lowered, so a band called The The comes out as The the.'
    ],
    faq: [
      { q: 'What is the difference between camelCase and PascalCase?', a: 'Only the first letter: orderTotal is camelCase, OrderTotal is PascalCase. Every later word is capitalised in both.' },
      { q: 'Can I use kebab-case in variable names?', a: 'Not in most languages, where the hyphen is a minus sign. It is the norm for CSS classes, URLs, HTML attributes and command-line flags.' },
      { q: 'Should JSON keys be camelCase or snake_case?', a: 'JSON has no rule. Google’s JSON style guide uses camelCase while many Python and Ruby APIs use snake_case; pick one per API and keep to it.' }
    ],
    runs: [
      /* three identifiers, one per line, Convert to: snake_case */
      { input: 'XMLHttpRequest\ngetUserIDs\nv2ApiClient', options: { target: 'snake' }, check: [['output', 'xml_http_request'], ['output', 'get_user_i_ds'], ['output', 'v2_api_client'], ['stat:Lines converted', '3']] },
      /* the renamed identifier */
      { input: 'getUserIds', options: { target: 'snake' }, check: [['output', 'get_user_ids']] },
      /* the mistakes: punctuation and The The, Convert to: Title Case */
      { input: 'Hello, world!\nThe The', options: { target: 'title' }, check: [['output', 'Hello, World!'], ['output', 'The the']] },
      /* a file path, Convert to: dot.case */
      { input: 'src/components/NavBar', options: { target: 'dot' }, check: [['output', 'src.components.nav.bar']] }
    ]
  },

  '/developer/color-converter/': {
    whatTitle: 'What colour contrast measures',
    whatIs: [
      'HEX, RGB, HSL and HSB are four ways of writing one sRGB colour. HEX and RGB give the red, green and blue channels from 0 to 255; HSL and HSB give a hue angle plus saturation and lightness or brightness.',
      'WCAG 2 contrast is a ratio of relative luminance, in which green counts for 71.52% and blue for only 7.22%. It runs from 1:1 to 21:1 for black on white, so two very different hues can score almost the same.'
    ],
    howItWorks: {
      text: 'Either colour can be written in any CSS syntax, or as a name.',
      points: [
        'HSL and HSB come from the largest and smallest channel, rounded to whole numbers.',
        'Luminance linearises each channel with the WCAG 2 curve and weights them 0.2126, 0.7152 and 0.0722; the ratio is (lighter + 0.05) ÷ (darker + 0.05).',
        'The ratio is shown to two decimals but graded unrounded: 4.5 and 7 for body text, 3 and 4.5 for large text, 3 for interface parts.',
        'Lab and LCH use CSS’s D50 white point. Fix contrast keeps the hue and changes only lightness, to the nearest colour that passes.',
        'Tints and shades mix with white or black, harmonies turn the hue, and colour-blind views apply the Machado 2009 matrices.'
      ]
    },
    worked: {
      text: 'Mid-grey text on white sits right on the line. #767676 scores 4.54:1 and passes AA for body text; #777777, one step lighter in each channel, scores 4.48:1 and fails, though their HSL lightness is 46% and 47%. White text on a #e63946 red gives 4.17:1, a fail for body text, while black text on it reaches 5.04:1.'
    },
    uses: [
      ['Accessibility audits', 'Check each text and background pair before an auditor does.'],
      ['Converting a brand palette', 'Turn HEX codes into RGB or OKLCH.'],
      ['Choosing button text', 'Compare white and black text on a coloured button.']
    ],
    mistakes: [
      'Checking against white only. Text also sits on cards and dark panels; test each background.',
      'Treating HSL lightness as perceived brightness. Pure yellow and pure blue both come out at 50% lightness, yet on white yellow scores 1.07:1 and blue 8.59:1.'
    ],
    faq: [
      { q: 'How do I convert HEX to RGB by hand?', a: 'Read each pair of digits as a base-16 number. #1D3557 is 1D = 29, 35 = 53 and 57 = 87, so rgb(29, 53, 87).' },
      { q: 'What is the difference between HSL and HSB?', a: 'They share the hue. In HSL, 100% lightness is always white; in HSB (or HSV), 100% brightness is the purest form of the hue. Pure red is hsl(0, 100%, 50%) but hsb(0, 100%, 100%).' },
      { q: 'What is relative luminance?', a: 'Brightness as the eye weighs it, from 0 for black to 1 for white, with the sRGB gamma curve undone. #767676 measures 0.1812.' }
    ],
    runs: [
      /* #767676 text on #ffffff */
      { fields: { colour: '#767676', bg: '#ffffff' }, check: [['stat:Contrast ratio', '4.54:1'], ['stat:Body text (AA needs 4.5)', 'AA'], ['output', '46%'], ['stat:Relative luminance', '0.1812']] },
      /* #777777 text on #ffffff */
      { fields: { colour: '#777777', bg: '#ffffff' }, check: [['stat:Contrast ratio', '4.48:1'], ['output', '47%']] },
      /* white text on #e63946, then black text on it */
      { fields: { colour: '#ffffff', bg: '#e63946' }, check: [['stat:Contrast ratio', '4.17:1']] },
      { fields: { colour: '#000000', bg: '#e63946' }, check: [['stat:Contrast ratio', '5.04:1']] },
      /* the mistake: pure yellow and pure blue on white */
      { fields: { colour: '#ffff00', bg: '#ffffff' }, check: [['output', '50%'], ['stat:Contrast ratio', '1.07:1']] },
      { fields: { colour: '#0000ff', bg: '#ffffff' }, check: [['output', '50%'], ['stat:Contrast ratio', '8.59:1']] },
      /* the FAQ: #1D3557 and pure red */
      { fields: { colour: '#1d3557', bg: '#ffffff' }, check: [['output', 'rgb(29, 53, 87)']] },
      { fields: { colour: '#ff0000', bg: '#ffffff' }, check: [['output', 'hsl(0, 100%, 50%)'], ['output', 'hsb(0, 100%, 100%)']] }
    ]
  },

  '/developer/cron-parser/': {
    term: 'a cron expression',
    whatIs: [
      'A cron expression tells a scheduler when to run a job. Each of its five fields takes a single value, a comma list, a range, * for every value or a step such as */10.',
      'There is no single standard. Vixie cron, behind most Linux systems, added names, steps and shortcuts such as @daily; Quartz and many libraries put seconds first.'
    ],
    howItWorks: {
      text: 'Each line is parsed into sets of allowed values, put into English, then searched forward in the time zone you pick.',
      points: [
        'Names such as mon or jan become numbers, and ranges and steps are expanded: */20 in the minute field is 0, 20 and 40.',
        'Weekday 7 is Sunday, like 0: 1-7 reads every day, 5-7 on Friday, Saturday and Sunday.',
        '@yearly, @monthly, @weekly, @daily, @hourly and their aliases are swapped for five fields first; @reboot is refused.',
        'Six fields put seconds first; seven (Quartz) add a year. Quartz needs a ? in one day field and reads L, W and #.',
        'Next runs come from the calendar in the chosen time zone, through Intl. Both day fields restricted means either may match.',
        'A time the clocks skip is not shown; one they repeat is shown once.'
      ]
    },
    worked: {
      text: 'Someone wants a report at 9 am on the first Monday of each month and writes 0 9 1-7 * 1. The parser reads it back as "At 09:00, on day 1, 2, 3, 4, 5, 6 and 7 of the month, and on Monday." That is ten or eleven runs a month, not one. Quartz can say it: 0 0 9 ? * 2#1 reads "At 09:00, on the 1st Monday of the month." A second line, 0 0 31 2 *, counts as valid but reports "no runs found within the next 9 years".'
    },
    uses: [
      ['Reviewing a crontab', 'Paste crontab -l and see which jobs share a minute.'],
      ['Writing a CI schedule', 'Check a GitHub Actions schedule; it runs in UTC.'],
      ['Explaining a schedule', 'Paste the English line into a ticket.']
    ],
    mistakes: [
      'Using */45 for every 45 minutes. Steps restart each hour, so the parser says "At minute 0 and minute 45 of every hour".',
      'Leaving the minute as *. The line * 9 * * * reads "Every minute during 09:00", sixty runs; write 0 9 * * * instead.'
    ],
    faq: [
      { q: 'How do I run a cron job every 5 minutes?', a: 'Use */5 * * * *. It fires on the clock at minute 0, 5, 10 and so on through minute 55.' },
      { q: 'What does 0 0 * * 0 mean?', a: 'Midnight every Sunday, read here as "At 00:00, on Sunday." It is the same schedule as @weekly.' },
      { q: 'Why did my cron job not run?', a: 'Often not the expression: the server’s time zone, a PATH cron does not set, or a bare % in the command.' }
    ],
    runs: [
      /* the "first Monday" line and 31 February, default options; the run dates depend on the day it is run, so only the description is quoted */
      { input: '0 9 1-7 * 1\n0 0 31 2 *', check: [['output', 'At 09:00, on day 1, 2, 3, 4, 5, 6 and 7 of the month, and on Monday.'], ['output', 'no runs found within the next 9 years'], ['stat:Valid', '2']] },
      /* the Quartz line, Format: detected */
      { input: '0 0 9 ? * 2#1', check: [['output', 'At 09:00, on the 1st Monday of the month.'], ['stat:Valid', '1']] },
      /* the mistakes */
      { input: '*/45 * * * *\n* 9 * * *', check: [['output', 'At minute 0 and minute 45 of every hour'], ['output', 'Every minute during 09:00']] },
      /* the FAQ answers */
      { input: '*/5 * * * *\n0 0 * * 0', check: [['output', 'minute 55'], ['output', 'At 00:00, on Sunday.']] },
      /* weekday 7 */
      { input: '0 9 * * 1-7\n0 9 * * 5-7', check: [['output', 'every day'], ['output', 'on Friday, Saturday and Sunday'], ['stat:Valid', '2']] }
    ]
  },

  '/developer/css-gradient/': {
    whatTitle: 'What a CSS gradient is',
    whatIs: [
      'A CSS gradient is an image the browser draws itself, usually in the background property: nothing to download, sharp at any size.',
      'linear-gradient blends along a line, radial-gradient spreads from a centre, and conic-gradient sweeps round a centre like a clock hand, which is how pure-CSS pie charts are drawn. Each takes a list of colour stops: a colour with an optional position.'
    ],
    howItWorks: {
      text: 'The stop editor and the form write one stop list, and the same CSS value paints the preview.',
      points: [
        'A missing position is filled in as CSS does: the first is 0%, the last 100%, gaps are shared evenly, and a position below an earlier one is raised to it.',
        'Linear uses the angle as its direction, `linear-gradient(120deg, …)`; conic uses it as the start of the sweep.',
        'Radial and conic take a centre, dragged on the preview or typed as two percentages: `radial-gradient(ellipse at 30% 40%, …)`.',
        'OKLab or OKLCH blending adds `in oklab` or `in oklch` to the value, and the solid fallback line, the colour halfway along, comes first for browsers that cannot read it.',
        'The PNG is painted pixel by pixel with the same geometry and blend, a slice of rows at a time.'
      ]
    },
    worked: {
      text: 'With the stops #0000ff, #ffff00 and the classic sRGB blend, the fallback line reads background: #808080; the colour halfway along is a flat grey. Switch the blend to OKLab and the gradient line becomes linear-gradient(120deg in oklab, #0000ff 0%, #ffff00 100%), with #6cabc7 at the halfway point. A conic #e63946 25%, #e9ecef 25% draws a quarter segment, counted as 1 hard edge.'
    },
    uses: [
      ['Hero sections', 'A full-width banner with no image request.'],
      ['Pie charts and progress rings', 'A conic gradient whose neighbouring stops share a position draws crisp segments without SVG.'],
      ['Share images and slide backgrounds', 'Save a 1200 × 630 PNG for an Open Graph card.']
    ],
    mistakes: [
      'Expecting the angle to move a radial gradient. A circle has no direction; drag the centre handle on the preview to move it.',
      'Putting a gradient on text without background-clip: text and a transparent colour; it fills the whole box instead.'
    ],
    faq: [
      { q: 'How do I make a gradient with a hard edge?', a: 'Give two neighbouring stops the same position, such as #ff6b6b 50%, #4ecdc4 50%: type it into the stop list, or drag one marker onto the other.' },
      { q: 'Does the PNG look the same as the CSS?', a: 'To within a couple of levels per colour channel, because it uses the same angle, centre, stops and blend.' },
      { q: 'Which browsers understand in oklab?', a: 'Chrome and Edge 111, Safari 16.2 and Firefox 127 onwards. An older browser drops the whole declaration and keeps the solid fallback line written above it.' }
    ],
    runs: [
      /* stops #0000ff, #ffff00; everything else default (linear, 120deg, sRGB, fallback on) */
      { fields: { stops: '#0000ff, #ffff00' }, check: [['output', 'background: #808080;']] },
      /* the same, Blend colours in: OKLab */
      { fields: { stops: '#0000ff, #ffff00', space: 'oklab' }, check: [['output', 'linear-gradient(120deg in oklab, #0000ff 0%, #ffff00 100%)'], ['output', '#6cabc7']] },
      /* Type: Conic, stops #e63946 25%, #e9ecef 25% */
      { fields: { type: 'conic', stops: '#e63946 25%, #e9ecef 25%' }, check: [['stat:Hard edges', '1']] },
      /* the "How it works" point: Radial, Ellipse, centre 30 / 40 */
      { fields: { type: 'radial', shape: 'ellipse', cx: '30', cy: '40' }, check: [['output', 'radial-gradient(ellipse at 30% 40%, ']] }
    ]
  },

  '/developer/csv-to-json/': {
    term: 'CSV',
    whatIs: [
      'CSV, comma-separated values, is the plain-text table every spreadsheet can export: one record per line, fields split by commas, usually with a header row. RFC 4180 wrote the common rules down in 2005: a field holding a comma, a quote or a line break is wrapped in double quotes.',
      'JSON holds the same rows as objects keyed by the header. CSV is flat and untyped while JSON nests and has numbers, booleans and null, so neither direction is lossless.'
    ],
    howItWorks: {
      text: 'Both directions run in plain JavaScript; the CSV side reads one character at a time.',
      points: [
        'Quotes are tracked, so a quoted comma or line break stays in its field and "" becomes one quote.',
        'The first row is the header unless set otherwise; values stay strings unless Infer types is on, and short rows are padded with empty strings.',
        'The array is written with `JSON.stringify` at a 2-space indent; Output measures it without.',
        'JSON to CSV uses the union of every object’s keys as columns, nested objects as dotted names, and quotes values containing the delimiter, a quote or a line break.',
        'JSON Lines writes one compact object a line. JSON to CSV can quote every field or only text, end lines with CRLF and add a byte order mark.'
      ]
    },
    worked: {
      text: 'Two products as JSON, one with a qty and the other with a price instead, become CSV with Columns 4 and Rows 2. The header is sku,title,qty,price, "Oak shelf, 80 cm" is quoted for its comma, and the hook is written "Wall hook ""S"" type". Pasted back, it is not exact: the shelf returns with "qty": "4", a string, and each product now carries the key it never had, empty: "price": "".'
    },
    uses: [
      ['Seed data', 'Turn a test-user spreadsheet into a JSON fixture.'],
      ['Bulk imports', 'Convert a supplier’s price list into an import payload.'],
      ['Opening JSON in Excel', 'Flatten an API export so a colleague can sort and filter it.']
    ],
    mistakes: [
      'Expecting nested JSON back unchanged. An addr object becomes an addr.city column and returns flat, "addr.city": "York", unless Dotted headers is set to Nest.',
      'Double-clicking a UTF-8 CSV in Excel, which can garble accents. Add the byte order mark instead.'
    ],
    faq: [
      { q: 'Can CSV headers contain spaces?', a: 'Yes, and they become JSON keys exactly as written, such as "Unit price". Rename them first if your code reads keys with dot notation.' },
      { q: 'What happens to a row with more fields than the header?', a: 'The extra fields are dropped, because only header columns become keys, and a warning counts those rows. A row with fewer fields gets empty strings.' },
      { q: 'What is the difference between CSV and TSV?', a: 'Only the delimiter. Pick Tab in the delimiter list to read or write TSV.' }
    ],
    related: { guides: ['/guides/format-json/'] },
    runs: [
      /* Direction: JSON → CSV, delimiter comma */
      { input: '[{"sku":"BK-101","title":"Oak shelf, 80 cm","qty":4},{"sku":"BK-102","title":"Wall hook \\"S\\" type","price":3.5}]', options: { dir: 'j2c' }, check: [['output', 'sku,title,qty,price'], ['output', '"Oak shelf, 80 cm"'], ['output', '"Wall hook ""S"" type"'], ['stat:Columns', '4'], ['stat:Rows', '2']] },
      /* that CSV pasted back, Direction: CSV → JSON */
      { input: 'sku,title,qty,price\nBK-101,"Oak shelf, 80 cm",4,\nBK-102,"Wall hook ""S"" type",,3.5', check: [['output', '"qty": "4"'], ['output', '"price": ""']] },
      /* the mistake: a nested object, JSON → CSV, then back with the default settings */
      { input: '[{"addr":{"city":"York"}}]', options: { dir: 'j2c' }, check: [['output', 'addr.city']] },
      { input: 'addr.city\nYork', check: [['output', '"addr.city": "York"']] },
      /* the FAQ: a long row and a short row */
      { input: 'a,b\n1,2,3\n4', check: [['stat:Data rows', '2'], ['stat:Columns', '2']] }
    ]
  },

  '/developer/favicon-generator/': {
    term: 'a favicon',
    whatIs: [
      'A favicon is the small icon a browser shows in tabs, bookmarks and history. Internet Explorer 5 introduced it in 1999 as a favicon.ico file at the site root; now link rel="icon" tags point to PNG or SVG icons.',
      'Phones and installed web apps want bigger versions: an apple-touch-icon for the iOS home screen, and 192 and 512 pixel icons listed in a web app manifest for Android.'
    ],
    howItWorks: {
      text: 'The browser decodes your image and draws it onto a fresh `<canvas>` for each size, and each canvas is saved with `canvas.toBlob(…, \'image/png\')`.',
      points: [
        'Eight PNGs are made: 16, 32, 48 and 96 pixel favicons, a 180 pixel apple-touch-icon, 192 and 512 pixel app icons and a 512 pixel maskable icon with a 10% margin.',
        'The source is scaled to fit the square and centred, never cropped, so a wide logo gets bars above and below.',
        'Every canvas is filled with the background colour first, white by default, so transparent areas come out solid.',
        'favicon.ico, holding the 16, 32 and 48 pixel PNGs, and site.webmanifest make ten files in favicons.zip, and the snippet links only those.',
        'Icons bigger than your image are scaled up from it, and the tool names each one.',
        'Text and Emoji are drawn afresh at every size, and add favicon.svg, which can switch to dark-mode colours.'
      ]
    },
    worked: {
      text: 'A 300×200 transparent PNG of 840 B, an orange disc on nothing, produced 8 icons totalling 44.0 KB, from 397 B for the smallest to 18.4 KB for the 512 pixel one. The tool warned that the source is smaller than 512px, so the large icons are enlarged. Setting the background to #1d3557 gave navy corners and a total of 43.5 KB.'
    },
    uses: [
      ['Launching a small site', 'Make the whole icon set from one logo.'],
      ['Making a web app installable', 'Get the 192 and 512 pixel icons a manifest needs for Add to Home Screen.'],
      ['Rebranding', 'Regenerate every size from the new mark.']
    ],
    mistakes: [
      'Expecting transparent icons from a transparent logo. Pick a background colour that works in both light and dark browser tabs, since every icon will be a solid square.',
      'Leaving the site name blank: site.webmanifest then has no name, which browsers need before offering to install.',
    ],
    faq: [
      { q: 'What size should a favicon be?', a: '32 and 16 pixels square for browser tabs, 180 for Apple devices, 192 and 512 for Android. One square master of 512 pixels or more covers them all.' },
      { q: 'Where do favicon files go?', a: 'In the site’s root folder: the snippet’s paths all start with a slash.' },
      { q: 'What is an apple-touch-icon?', a: 'The icon iOS shows when your site is added to the home screen. Apple rounds the corners itself, so it wants a square, opaque PNG, as written here.' }
    ],
    runs: [
      /* Input: .work/logo-300x200.png, made by .work/make-logo.js: 300 × 200 RGBA PNG, fully transparent,
         with a solid #e8590c disc of radius 90 px centred at (150, 100), no anti-aliasing (840 bytes).
         Headless Chrome on the export served at port 8745 (.work/favicon-run.js): upload it, wait for the
         8 cards, read the cards, the stats and the message, and sample pixel (0,0) of each canvas.
         Then type #1d3557 into the background hex field and read again. */
      { browser: { page: '/developer/favicon-generator/', file: 'logo-300x200.png (300 x 200, transparent, #e8590c disc r=90 at 150,100; 840 B)', background: '#ffffff (default)', then: { background: '#1d3557' } },
        shown: ['300×200', '840 B', '8 icons', '44.0 KB', '397 B', '18.4 KB', 'smaller than 512px', '43.5 KB'] }
    ]
  },

  '/developer/hash-generator/': {
    term: 'a hash function',
    whatIs: [
      'A hash function turns input of any length into a fixed-length fingerprint: 256 bits for SHA-256, 160 for SHA-1, 128 for MD5 and 32 for CRC32, written in hexadecimal. Change a single bit of the input and the digest changes completely.',
      'They are built for different jobs. SHA-256 is cryptographic: finding two inputs with the same digest is believed infeasible. CRC32, the check inside ZIP and PNG files, only catches accidental corruption and is easy to forge.'
    ],
    howItWorks: {
      text: 'All 13 algorithms are written out in the engine file itself as streaming hashes, so a file never has to fit in memory.',
      points: [
        'Your text is first encoded as UTF-8, which is why Input length shows characters and bytes separately; Hex and Base64 input are decoded to the bytes they spell.',
        'SHA-2 follows FIPS 180-4, SHA-3 FIPS 202 and MD5 RFC 1321; Keccak-256 is SHA-3 with the original padding.',
        'A file is read 4 MB at a time and fed to every chosen hash, with progress and a Cancel button.',
        'With an HMAC key, each digest becomes an HMAC as RFC 2104 defines it.',
        'Expected hash is compared with every digest, in hex, Base64 or a sha256sum or BSD line, and the algorithm that matches is named.'
      ]
    },
    worked: {
      text: 'The word café hashes differently depending on how its é was typed. As one precomposed character, Input length reads 4 characters, 5 bytes and the first digest begins 850f7dc4. Typed as e plus a combining accent, as some systems store it, it reads 5 characters, 6 bytes and begins 81ef060b. Add the newline that echo appends and there is a third, 7b49b9e0….'
    },
    uses: [
      ['Test fixtures', 'Get the expected digest of a known string for a unit test.'],
      ['Checking a download', 'Open the file and paste the published checksum into Expected hash.'],
      ['Spotting invisible differences', 'Two strings that look the same but hash differently hide a space or an accent encoding.']
    ],
    mistakes: [
      'Comparing with a terminal hash of echo output. echo adds a newline; use printf or echo -n so the bytes match what you typed here.',
      'Treating CRC32 as a security check. Anyone can alter data and then adjust it so the CRC still matches.'
    ],
    faq: [
      { q: 'How long is a SHA-256 hash?', a: '64 hexadecimal characters, or 256 bits, whatever the input length. SHA-1 gives 40 characters, MD5 32 and CRC32 8.' },
      { q: 'Can this generate an HMAC?', a: 'Yes. Type a key in HMAC key and every digest becomes an HMAC: for the message hello and the key secret, HMAC-SHA-256 begins 88aab3ed. The key is never shared or kept.' },
      { q: 'Can two different inputs have the same hash?', a: 'In principle, yes. Nobody has found such a pair for SHA-256, while MD5 pairs can be made on a laptop in seconds.' }
    ],
    runs: [
      /* "café" with é as U+00E9, default options (all algorithms, lowercase) */
      { input: 'café', check: [['stat:Input length', '4 characters, 5 bytes'], ['output', '850f7dc4']] },
      /* "café" as e + U+0301 combining acute */
      { input: 'café', check: [['stat:Input length', '5 characters, 6 bytes'], ['output', '81ef060b']] },
      /* "café" plus a trailing newline */
      { input: 'café\n', check: [['output', '7b49b9e0']] },
      /* the FAQ's HMAC: message hello, key secret, SHA-256 only */
      { input: 'hello', options: { algo: 'sha256', key: 'secret' }, check: [['output', '88aab3ed']] }
    ]
  },

  '/developer/htaccess-generator/': {
    term: 'an .htaccess file',
    whatIs: [
      'An .htaccess file is per-directory configuration for the Apache web server, read on every request from the requested folder and each one above it, so changes apply without a restart. Shared hosting relies on it.',
      'Each block depends on a module: mod_rewrite, mod_expires, mod_deflate or mod_headers. A block wrapped in IfModule is skipped quietly when its module is missing; the rewrite rules here are not wrapped.'
    ],
    howItWorks: {
      text: 'The rules are assembled line by line from your choices in plain JavaScript. Nothing about your server is checked.',
      points: [
        'Force www redirects to www. plus your domain, cleaned of any http:// or www.; Force non-www captures the host after www. and redirects to that.',
        'The www rule runs first, straight to https when HTTPS is forced, otherwise keeping the visitor’s scheme through `%{REQUEST_SCHEME}` (Apache 2.4 on).',
        'Force HTTPS then adds `RewriteCond %{HTTPS} off` and a 301 to the same host and path over https.',
        'Caching gives CSS, JavaScript, SVG, WebP and WOFF2 a year and HTML zero seconds; security adds four headers, and HSTS as a fifth only when HTTPS is forced.'
      ]
    },
    worked: {
      text: 'For a site that should live at https://ashworth-joinery.co.uk without www, choose Force HTTPS and Force non-www and switch the other blocks off: 5 directives, 192 B. A request for http://www.ashworth-joinery.co.uk/ meets the www rule first and goes straight to https://ashworth-joinery.co.uk/ in one permanent redirect; the HTTPS rule after it catches plain http on the bare domain. The domain field is not used in this combination at all.'
    },
    uses: [
      ['Moving a site to HTTPS', 'Redirect every plain http request once a certificate is installed.'],
      ['Picking one host name', 'Send www and bare-domain visitors to one form so search engines index a single copy.'],
      ['Speeding up shared hosting', 'Add long caching for static files where you cannot edit the server config.']
    ],
    mistakes: [
      'Forcing HTTPS behind a proxy or CDN. The connection Apache sees may be plain http even when the visitor’s is not, so the rule loops; test X-Forwarded-Proto instead.',
      'Caching CSS and JavaScript for a year under fixed names. A changed style.css stays stale in browsers; put a version or hash in the file name.'
    ],
    faq: [
      { q: 'Where does the .htaccess file go?', a: 'In the document root, the folder holding your home page, often public_html or htdocs. Rules there apply to it and every folder below.' },
      { q: 'Should an HTTPS redirect be a 301 or a 302?', a: 'A 301, which marks the move as permanent so search engines carry the old address’s standing across. Every redirect written here uses R=301.' },
      { q: 'Does .htaccess slow a site down?', a: 'Slightly: Apache looks for the file in every directory of the path on each request.' }
    ],
    runs: [
      /* Force HTTPS: Yes, Domain form: Force non-www, Domain https://www.ashworth-joinery.co.uk/, caching, compression and security headers: No */
      { fields: { https: 'yes', www: 'root', domain: 'https://www.ashworth-joinery.co.uk/', cache: 'no', gzip: 'no', security: 'no' }, check: [['stat:Directives', '5'], ['stat:Size', '192 B'], ['output', 'R=301']] },
      /* Force HTTPS: No, Force www: the scheme is kept */
      { fields: { https: 'no', www: 'www', domain: 'ashworth-joinery.co.uk', cache: 'no', gzip: 'no', security: 'no' }, check: [['output', '%{REQUEST_SCHEME}']] }
    ]
  },

  '/developer/html-entities/': {
    whatTitle: 'What HTML character references are',
    whatIs: [
      'A character reference writes a character in HTML source without typing it: &amp; for an ampersand, &lt; for a less-than sign. The browser turns it back when it renders, so markup characters in text are shown, not read as tags.',
      'Numeric references give the Unicode code point in decimal (&#163;) or hex (&#xA3;) and work for any character. Named references such as &pound; come from a list of 2,125 in the HTML standard; XML recognises only five of them.'
    ],
    howItWorks: {
      text: 'The HTML Standard’s full list of names is built into this page, and decoding follows its rules.',
      points: [
        'Escaping replaces exactly five characters by default: & < > " and \', the last as &#39; or, if you choose, &apos;.',
        'Escaping does not look for existing entities, so escaped text is escaped again.',
        'The other Escape modes also write non-ASCII characters as their shortest name, or as decimal or hex references.',
        'Unescaping reads all 2,125 names, the 106 older ones even without their closing ;, and every numeric reference; an unknown name is left as written and counted.',
        'Find an entity searches by name, character or code point.'
      ]
    },
    worked: {
      text: 'A menu line exported from an old CMS reads Caf&eacute; &copy; 2026 &mdash; menu from &#163;9 &#x2615;. Unescaped, it becomes Café © 2026 — menu from £9 ☕ with Entities decoded 5. Escaped with names it gives Caf&eacute; &copy; 2026 &mdash; menu from &pound;9 &#x2615;; the cup stays numeric as it has no name.'
    },
    uses: [
      ['Showing code in a post', 'Escape an HTML snippet so it appears as text.'],
      ['Quoted attributes', 'Escape quotes in alt text before it goes in an attribute.'],
      ['Cleaning feed text', 'Turn &#39; and &quot; left by a CMS or RSS feed back into plain quotes.']
    ],
    mistakes: [
      'Escaping twice. Tom &amp; Jerry run through again becomes Tom &amp;amp; Jerry, and the page shows the entity.',
      'Escaping a whole template. Every tag is escaped too and the page displays as source; escape only the text you insert.'
    ],
    faq: [
      { q: 'What is the difference between &nbsp; and a normal space?', a: 'A non-breaking space looks the same but blocks a line break there and is not collapsed with neighbouring spaces. Unescaping turns &nbsp; into that character, not an ordinary space.' },
      { q: 'Do I need entities for accented letters or the euro sign?', a: 'Not in a page served as UTF-8, which nearly all are; type them directly. The default mode leaves them alone for that reason.' },
      { q: 'Should I use &apos; or &#39; for an apostrophe?', a: '&#39; works everywhere. &apos; is valid in XML and HTML5 but not HTML 4, so some older email clients show it literally; this tool writes &#39; unless you ask for &apos;, and reads both.' }
    ],
    runs: [
      /* Direction: Unescape */
      { input: 'Caf&eacute; &copy; 2026 &mdash; menu from &#163;9 &#x2615;', options: { dir: 'dec' }, check: [['output', 'Café © 2026 — menu from £9 ☕'], ['stat:Entities decoded', '5']] },
      /* the same line, Direction: Escape, Escape: Also non-ASCII, as names */
      { input: 'Café © 2026 — menu from £9 ☕', options: { mode: 'named' }, check: [['output', 'Caf&eacute; &copy; 2026 &mdash; menu from &pound;9 &#x2615;']] },
      /* the mistake: escaping text that is already escaped, Direction: Escape */
      { input: 'Tom &amp; Jerry', check: [['output', 'Tom &amp;amp; Jerry']] }
    ]
  },

  '/developer/jwt-decoder/': {
    term: 'a JSON Web Token',
    whatIs: [
      'A JSON Web Token, defined in RFC 7519, packs claims about a user or service into one URL-safe string. The usual signed form is three base64url segments joined by dots: a header naming the algorithm, a payload of claims such as sub, aud, iat and exp, and a signature over the first two.',
      'Decoding and verifying are different acts. Decoding only reverses the encoding of the first two segments; verifying recomputes the signature with the issuer’s key.'
    ],
    howItWorks: {
      text: 'The token is split on its dots and the first two parts are decoded in the page; the signature is checked only when you give a secret or a key.',
      points: [
        'Anything other than three parts is refused, which also rules out the five-part encrypted form.',
        'Header and payload are decoded from base64url as UTF-8 and parsed with `JSON.parse`; each claim gets a line saying what it means.',
        'iat, nbf and exp are read as seconds and shown as UTC, and Status counts down to the expiry on your device clock.',
        'Verifying uses the browser’s WebCrypto, with the key taken from a PEM, a certificate, a JWK or a JWKS entry picked by kid.',
        'alg none is never verified, and an HS token with a public key given as its secret is refused.'
      ]
    },
    worked: {
      text: 'A service token with an RS256 header and key ID k-2026-01 decodes to subject svc-reports, Issued 2026-01-01 00:00:00 UTC and Expires 2026-01-01 01:00:00 UTC, so Status reads EXPIRED. Its third segment just encodes the words signature-not-checked, so with the issuer’s public key pasted under Verify the result is Invalid signature.'
    },
    uses: [
      ['Debugging a 401', 'See whether a rejected token has expired or carries the wrong aud.'],
      ['Checking roles and scopes', 'Read the claim an API uses to refuse an action.'],
      ['Clock skew', 'Compare iat with the time your server logged a request that was refused.']
    ],
    mistakes: [
      'Writing exp in milliseconds. An exp of 1767229200000 decodes to +057971-04-07; NumericDate is whole seconds.',
      'Trusting a decoded token. Anyone can write a payload; only a valid signature from a key you trust means the issuer wrote it.'
    ],
    faq: [
      { q: 'What is the difference between a JWT and a JWE?', a: 'A signed JWT has three parts and anyone can read it. A JWE (RFC 7516) encrypts the payload and has five parts; this decoder accepts only the three-part form.' },
      { q: 'What do iss, sub and aud mean?', a: 'Registered claims from RFC 7519: iss is who issued the token, sub who it is about, aud who it is for. A server should reject a token whose aud is not itself.' },
      { q: 'How long should a JWT access token last?', a: 'Minutes rather than days, with a refresh token to get the next one: a stolen JWT works until exp.' }
    ],
    runs: [
      /* header {"alg":"RS256","typ":"JWT","kid":"k-2026-01"}, payload {"iss":"https://auth.example","sub":"svc-reports","aud":"api.example","iat":1767225600,"exp":1767229200},
         signature segment = base64url("signature-not-checked") */
      { input: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImstMjAyNi0wMSJ9.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZSIsInN1YiI6InN2Yy1yZXBvcnRzIiwiYXVkIjoiYXBpLmV4YW1wbGUiLCJpYXQiOjE3NjcyMjU2MDAsImV4cCI6MTc2NzIyOTIwMH0.c2lnbmF0dXJlLW5vdC1jaGVja2Vk',
        check: [['stat:Algorithm', 'RS256'], ['output', 'k-2026-01'], ['output', 'svc-reports'], ['stat:Issued', '2026-01-01 00:00:00 UTC'], ['stat:Expires', '2026-01-01 01:00:00 UTC'], ['stat:Status', 'EXPIRED']] },
      /* header {"alg":"none","typ":"JWT"}, payload {"sub":"admin","iat":1767225600,"exp":1767229200000} (milliseconds), empty signature */
      { input: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTc2NzIyNTYwMCwiZXhwIjoxNzY3MjI5MjAwMDAwfQ.', check: [['stat:Algorithm', 'none'], ['stat:Expires', '+057971-04-07']] },
      { input: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImstMjAyNi0wMSJ9.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZSIsInN1YiI6InN2Yy1yZXBvcnRzIiwiYXVkIjoiYXBpLmV4YW1wbGUiLCJpYXQiOjE3NjcyMjU2MDAsImV4cCI6MTc2NzIyOTIwMH0.c2lnbmF0dXJlLW5vdC1jaGVja2Vk', check: [['stat:Status', 'EXPIRED']] }
    ]
  },

  '/developer/lorem-ipsum/': {
    term: 'lorem ipsum',
    whatIs: [
      'Lorem ipsum is placeholder text: words with the rhythm and letter shapes of prose that nobody reads for meaning. It fills a layout before the copy exists, so a reviewer judges spacing, line length and hierarchy rather than wording.',
      'The classic paragraph begins Lorem ipsum dolor sit amet, consectetur adipiscing elit. Real copy rarely behaves like it: German and Finnish words run long and translated interfaces often grow, so filler is only a first pass at fitting text.'
    ],
    howItWorks: {
      text: 'Every run draws fresh words from a fixed list using `Math.random`, so no two results are the same.',
      points: [
        'The Latin list holds 63 distinct words from the classic passage and the English list 54. With the box ticked, Latin output opens with the classic 19-word sentence.',
        'A drawn sentence is 8 to 19 words, capitalised and closed with a full stop, with no commas; a paragraph is 3 to 5 sentences, and a heading 2 to 5 words.',
        'Words returns that many bare words, with no capitals or full stops; List items makes one sentence per item.',
        'Bytes cuts plain text to exactly the number asked for, up to 100,000. Every other unit stops at 100, and the format wraps the result in <p>, headings, a <ul> or <ol> list, or Markdown.'
      ]
    },
    worked: {
      text: 'To test a VARCHAR(255) column at its limit, choose Bytes, 255: one block of filler showing Characters 255 and Bytes (UTF-8) 255. Asking for 250 words gives Words 100, with a note that the most at once is 100. List items, 6, as a numbered <ol> list is 8 lines: the two tags and six items.'
    },
    uses: [
      ['Wireframes', 'Fill content blocks in a mock-up so a review stays on structure.'],
      ['Field limits', 'Paste text of an exact byte length into a form to see what is cut off.'],
      ['Staging data', 'Give product descriptions in a test database text of realistic length.']
    ],
    mistakes: [
      'Leaving filler in production. Search for lorem and ipsum before launch; it hides in alt text, meta descriptions and error pages.',
      'Expecting the same text twice. Any change of setting, or Generate again, replaces it; copy what you need first.'
    ],
    faq: [
      { q: 'What does lorem ipsum mean in English?', a: 'Nothing as written. It is cut from Cicero’s "Neque porro quisquam est qui dolorem ipsum", roughly "nor is there anyone who loves pain itself"; lorem is the tail of dolorem.' },
      { q: 'How many words are in a paragraph of lorem ipsum?', a: 'There is no fixed number. Here a paragraph is 3 to 5 sentences of 8 to 19 words, so 24 to 95 words.' },
      { q: 'Does placeholder text hurt search rankings?', a: 'Only once it is published: search engines treat it as thin, unfinished content. Keep staging sites out of the index with noindex.' }
    ],
    runs: [
      /* Generate: Bytes, How many: 255 (output words are random; only the counts are quoted) */
      { fields: { unit: 'bytes', count: '255' }, check: [['stat:Characters', '255'], ['stat:Bytes (UTF-8)', '255'], ['outputLength', '255']] },
      /* Generate: Words, How many: 250 */
      { fields: { unit: 'words', count: '250' }, check: [['stat:Words', '100'], ['warn', 'most at once is 100']] },
      /* Generate: List items, How many: 6, Format: numbered list */
      { fields: { unit: 'items', count: '6', wrap: 'ol' }, check: [['stat:List items', '6'], ['outputLines', '8']] }
    ]
  },

  '/developer/markdown-preview/': {
    term: 'Markdown',
    whatIs: [
      'Markdown is a plain-text way of writing formatted documents: # for headings, asterisks for emphasis, a hyphen for each list item. John Gruber published it in 2004.',
      'CommonMark, begun in 2014, is the strict specification that followed, and GitHub Flavored Markdown extends it with tables, strikethrough and task lists. This converter is a compact line-by-line one covering that common syntax, not a CommonMark implementation.'
    ],
    howItWorks: {
      text: 'The conversion is a short chain of regular expressions in the page, with no Markdown library behind it.',
      points: [
        'Fenced code blocks are lifted out first, so nothing inside them changes; reference and footnote lines are collected next.',
        'Each other line is classified by how it starts: #, >, a bullet, a task box, a number, a rule or a table; others join the paragraph above until a blank line.',
        'Inline, &, < and > are escaped, then code spans, maths, images, links, bold, italic and ~~strikethrough~~ are converted.',
        'Addresses must be http, https, mailto, tel or relative, quotes escaped; [x](javascript:void) becomes plain <p>x</p>.',
        'Preview renders the source through a sanitiser that keeps known tags and never fetches images; Full HTML document adds a doctype, head and body.',
        'Maths is drawn as MathML by Temml, kept on this site and loaded only when a formula appears.'
      ]
    },
    worked: {
      text: 'Notes written for GitHub do not all survive. A heading underlined with ===, a bullet with two indented sub-items and a two-row table come out as Headings 0, Paragraphs 1, Lists 1 and Tables 1. The table converts, but the underline heading becomes ordinary text and the sub-items are lifted to the level of their parent.'
    },
    uses: [
      ['Newsletter copy', 'Draft in Markdown, then paste the HTML into an editor that only takes HTML.'],
            ['HTML email', 'Write bullets and links in plain text for an email template.'],
      ['Printable notes', 'Print a README with its tables and maths, or save it as a PDF.']
    ],
    mistakes: [
      'Expecting a line break where you pressed Enter. Lines are joined into one paragraph, and two trailing spaces do not force a <br> here; leave a blank line instead.',
      'Indenting code by four spaces. Only fenced blocks become code; indented lines are treated as paragraph text.',
      'Typing HTML into the Markdown. A <br> or <div> is escaped and shows as text.'
    ],
    faq: [
      { q: 'How do I make a link open in a new tab?', a: 'Markdown has no syntax for it. Add target="_blank" to the <a> tags afterwards; the links written here already carry rel="noopener noreferrer".' },
      { q: 'Can I use underscores for italics?', a: 'Not here: _a_ stays as typed. Single asterisks make italics, and __double underscores__ make bold after a space or at the start of a line.' },
      { q: 'How do I convert Markdown on the command line?', a: 'Pandoc does it with pandoc notes.md -o notes.html.' }
    ],
    runs: [
      /* GitHub-style notes: setext heading, nested list, pipe table; default Output: HTML fragment */
      { input: 'Release notes\n=============\n\n- Faster export\n  - PDF\n  - CSV\n\n| Plan | Price |\n|------|-------|\n| Pro | £9 |', check: [['stat:Headings', '0'], ['stat:Paragraphs', '1'], ['stat:Lists', '1'], ['stat:Tables', '1']] },
      /* the mistakes: a two-space line break, indented code, a javascript: link */
      { input: 'Line one  \nLine two\n\n    indented code\n\n[x](javascript:void)', check: [['stat:Code blocks', '0'], ['output', '<p>x</p>']] },
      /* the FAQ: underscores and asterisks */
      { input: '_a_ and __b__ and *c*', check: [['output', '_a_']] }
    ]
  },

  '/developer/meta-tag-generator/': {
    whatTitle: 'What meta tags and Open Graph do',
    whatIs: [
      'Meta tags sit in a page’s head and describe it to software. The title and description feed the snippet in search results, though Google may rewrite both; the canonical link names the one address to index.',
      'Open Graph, introduced by Facebook in 2010, is the set of og: properties behind the card shown when a link is shared on Facebook, LinkedIn, WhatsApp or Slack. It requires og:title, og:type, og:image and og:url.'
    ],
    howItWorks: {
      text: 'The tags are built from the form in plain JavaScript on every keystroke.',
      points: [
        'Each value has &, <, > and " replaced by entities before it goes into a tag, so a quote in a title cannot end the attribute.',
        'You get the title, description and canonical link, seven og: properties with og:type fixed at website, and four twitter: tags using the summary_large_image card: Tags generated reads 14.',
        'Blank fields write no tags: with no share image, Tags generated reads 12.',
        'Lengths count the characters you typed, before escaping: over 60 or 160 may be truncated, under 30 or 70 is quite short.',
        'URLs are copied exactly; nothing checks that they are absolute or that the image exists.',
        'Robots, X account, image description and image size add tags only when you set them. Previews of Google, Facebook and X are drawn from the same values, and the image is fetched only if you press the button.'
      ]
    },
    worked: {
      text: 'For a joinery workshop, the title Ashworth Joinery | Bespoke Oak Staircases, Kitchens & Doors in York measures 67 — may be truncated, and in the tags its ampersand becomes Kitchens &amp; Doors. The description is labelled 78 — good. The share image was entered as /img/share.jpg and copied into both image tags as content="/img/share.jpg". That relative path is the real problem: Open Graph needs an absolute URL.'
    },
    uses: [
      ['Launching a landing page', 'Write the title, description and card before a campaign.'],
      ['Fixing a link preview', 'Replace a missing or wrong image in a shared card.'],
      ['Hand-written sites', 'Add a complete head block to static pages.']
    ],
    mistakes: [
      'Expecting old shares to update. Platforms cache the card; Facebook’s Sharing Debugger fetches it again.',
      'Pointing every canonical at the home page, which asks search engines to drop the other pages.'
    ],
    faq: [
      { q: 'What is the difference between og:title and the title tag?', a: 'The title tag is what tabs and search results show; og:title is what a share card shows. This tool fills both from one field, so edit the copy to make them differ.' },
      { q: 'Do I need Twitter card tags if I have Open Graph?', a: 'Only twitter:card, for the large layout; X falls back to the og: tags.' },
      { q: 'Why is my Open Graph image not showing?', a: 'Usually a relative or http-only URL, or a blocked crawler.' }
    ],
    runs: [
      /* title, description, canonical https://ashworthjoinery.example/, share image /img/share.jpg, site Ashworth Joinery, locale en_GB */
      { fields: { title: 'Ashworth Joinery | Bespoke Oak Staircases, Kitchens & Doors in York', desc: 'Handmade oak staircases, kitchens and doors from our York workshop since 1998.', url: 'https://ashworthjoinery.example/', image: '/img/share.jpg', site: 'Ashworth Joinery' },
        check: [['stat:Title length', '67 — may be truncated'], ['stat:Description length', '78 — good'], ['output', 'Kitchens &amp; Doors'], ['output', 'content="/img/share.jpg"'], ['stat:Tags generated', '14']] },
      /* the "How it works" point: the default form with Share image URL cleared */
      { fields: { image: '' }, check: [['stat:Tags generated', '12']] }
    ]
  },

  '/developer/regex-tester/': {
    term: 'a regular expression',
    whatIs: [
      'A regular expression is a pattern describing a set of strings: \\d{4} is four digits, [A-Z]+ one or more capitals, ^ the start of a line. The engine walks through the text looking for stretches that match, and can capture parts of each match in groups.',
      'Every language has its own dialect. This page uses the browser’s JavaScript engine, so a pattern that works here works unchanged in JavaScript and TypeScript code. Go’s RE2 has no backreferences or lookaround.'
    ],
    howItWorks: {
      text: 'Your pattern and flags go straight to the browser’s `RegExp` constructor, and a syntax error is shown in the engine’s own words.',
      points: [
        'Matches are collected with `exec` in a loop, in a background worker; without g in your flags it stops after the first.',
        'An empty match moves the search on one character, and the loop stops at 10,000 matches so it cannot freeze the page.',
        'A run over 2 seconds is stopped and reported, so runaway backtracking cannot hang the tab.',
        'Each match is listed with its index, counted from 0 in UTF-16 code units, and its numbered and named groups.',
        'The explanation is the tool’s own reading of the pattern; `RegExp` still decides what is valid.',
        'Replace and Split call `String.replace` and `String.split`; the eight flags combine as the browser allows.'
      ]
    },
    worked: {
      text: 'An invoice line, Invoice 4471 due 03/11/2026, reminder 17/11/2026, final 01/12/2026, tested with (?<d>\\d{2})/(?<m>\\d{2})/(?<y>\\d{4}) gives Matches 3 and Capture groups 3, the first at index 17. In Replace view with $<y>-$<m>-$<d> it becomes Invoice 4471 due 2026-11-03, reminder 2026-11-17, final 2026-12-01. With no flags, only the first date changes.'
    },
    uses: [
      ['Form validation', 'Try a postcode pattern on good and bad examples, and save them as a test.'],
      ['Cleaning data', 'Rewrite dates or collapse spaces across a pasted column.'],
      ['Log analysis', 'Pull error codes out of a log with a capture group.']
    ],
    mistakes: [
      'A pattern that can match nothing. \\d* matches an empty string at every position: on a1b22c333 it reports 7 matches, 4 of them empty. Use \\d+ instead.',
      'Leaving a dot unescaped. In example.com the dot matches any character, so exampleXcom matches too; write example\\.com.'
    ],
    faq: [
      { q: 'How do I match any character including a newline?', a: 'Use the s flag, or [\\s\\S] where it is missing. By default the dot stops at line breaks.' },
      { q: 'What is the difference between greedy and lazy quantifiers?', a: 'Greedy .* takes as much as it can; lazy .*? as little. On <b>a</b><b>c</b>, <b>.*</b> gives 1 match covering both, <b>.*?</b> gives 2.' },
      { q: 'How do I make a regex case-insensitive?', a: 'Press the i flag button, or type i in Flags; in JavaScript code, /pattern/i.' }
    ],
    runs: [
      /* Pattern (?<d>\d{2})/(?<m>\d{2})/(?<y>\d{4}), Flags g, Show: Matches with groups */
      { input: 'Invoice 4471 due 03/11/2026, reminder 17/11/2026, final 01/12/2026', options: { pattern: '(?<d>\\d{2})/(?<m>\\d{2})/(?<y>\\d{4})' }, check: [['stat:Matches', '3'], ['stat:Capture groups', '3'], ['stat:First match at', '17']] },
      /* Show: Replace result, Replacement $<y>-$<m>-$<d> */
      { input: 'Invoice 4471 due 03/11/2026, reminder 17/11/2026, final 01/12/2026', options: { pattern: '(?<d>\\d{2})/(?<m>\\d{2})/(?<y>\\d{4})', view: 'replace', replacement: '$<y>-$<m>-$<d>' }, check: [['output', 'Invoice 4471 due 2026-11-03, reminder 2026-11-17, final 2026-12-01']] },
      /* the same with Flags: (none) */
      { input: 'Invoice 4471 due 03/11/2026, reminder 17/11/2026, final 01/12/2026', options: { pattern: '(?<d>\\d{2})/(?<m>\\d{2})/(?<y>\\d{4})', flags: '', view: 'replace', replacement: '$<y>-$<m>-$<d>' }, check: [['stat:Matches replaced', '1']] },
      /* the mistake: \d* in Show: Text with matches marked */
      { input: 'a1b22c333', options: { pattern: '\\d*', view: 'highlight' }, check: [['stat:Matches', '7']] },
      /* the FAQ: greedy and lazy */
      { input: '<b>a</b><b>c</b>', options: { pattern: '<b>.*</b>' }, check: [['stat:Matches', '1']] },
      { input: '<b>a</b><b>c</b>', options: { pattern: '<b>.*?</b>' }, check: [['stat:Matches', '2']] }
    ]
  },

  '/developer/robots-txt-generator/': {
    term: 'robots.txt',
    whatIs: [
      'robots.txt is a plain-text file at the root of a host telling crawlers which paths they may fetch. The convention dates from 1994 and became a standard, the Robots Exclusion Protocol, as RFC 9309 in 2022.',
      'The file is made of groups, each starting with User-agent lines, whose Allow and Disallow rules may use * for any characters and $ for the end of the URL. A crawler obeys only the group naming it most specifically, else User-agent: *, and there the longest matching rule wins.'
    ],
    howItWorks: {
      text: 'The file is assembled from the four settings in plain JavaScript; nothing is fetched from your site or checked against it.',
      points: [
        'Block all crawlers writes User-agent: * and Disallow: / and nothing more.',
        'Allow all, except the paths below writes User-agent: *, a Disallow line for each excluded path, adding a leading / where one is missing, then Allow: /.',
        'Blocking AI crawlers adds a group with Disallow: / for each of seven agents: GPTBot, CCBot, Google-Extended, anthropic-ai, ClaudeBot, PerplexityBot and Bytespider.'
      ]
    },
    worked: {
      text: 'A shop wants its basket, internal search and sorted listings out of the crawl. Entering /basket/, search? and /*?sort= under the default policy gives Rules 4: three Disallow lines and Allow: /. With AI crawlers blocked and the shop’s own sitemap, the file has Rules 11, Named agents 8 and 409 B, and search? is written as Disallow: /search?. The Allow: / line under the exclusions does not cancel them: /basket/ is the longer, more specific match.'
    },
    uses: [
      ['Faceted navigation', 'Stop endless sort and filter URLs eating a shop’s crawl budget.'],
      ['Opting out of AI training', 'Refuse the crawlers that gather training data while staying in normal search.'],
      ['Pointing to the sitemap', 'Tell every crawler where the XML sitemap lives.']
    ],
    mistakes: [
      'Blocking CSS and JavaScript folders. Google renders pages like a browser, and without the styles and scripts it may judge a page broken.',
      'Expecting a named group to inherit the * rules. A crawler with its own group, such as GPTBot here, ignores the * group entirely, so repeat shared Disallow lines inside it.'
    ],
    faq: [
      { q: 'How do I check that my robots.txt works?', a: 'Open it in a browser, then read the robots.txt report in Google Search Console for the version Google fetched.' },
      { q: 'What happens if a site has no robots.txt?', a: 'A missing file (a 404) means everything may be crawled. A server error is different: RFC 9309 has crawlers assume a full disallow, but after a long outage, say 30 days, they may treat it as missing.' },
      { q: 'Is there a size limit for robots.txt?', a: 'RFC 9309 says a crawler that sets a parsing limit must make it at least 500 kibibytes. Google ignores anything past 500 KiB.' }
    ],
    runs: [
      /* Default policy: Allow all, except the paths below; exclusions /basket/, search?, /*?sort=, default sitemap, AI crawlers allowed */
      { fields: { policy: 'allow', disallow: '/basket/\nsearch?\n/*?sort=' }, check: [['stat:Rules', '4']] },
      /* the same; AI training crawlers: Block; Sitemap https://shop.example/sitemap.xml */
      { fields: { policy: 'allow', disallow: '/basket/\nsearch?\n/*?sort=', aibots: 'block', sitemap: 'https://shop.example/sitemap.xml' }, check: [['stat:Rules', '11'], ['stat:Named agents', '8'], ['stat:Size', '409 B'], ['output', 'Disallow: /search?']] },
      /* the "How it works" point: Block all crawlers with the default sitemap and AI crawlers blocked */
      { fields: { policy: 'block', aibots: 'block' }, check: [['stat:Rules', '1'], ['stat:Named agents', '1']] }
    ]
  },

  '/developer/slug-generator/': {
    term: 'a URL slug',
    whatIs: [
      'A slug is the part of a URL that names one page in readable words, such as descale-a-kettle in /guides/descale-a-kettle/. The word comes from newspaper offices, where a slug was the short working name of a story in production.',
      'A URL can hold almost any character once percent-encoded, but a slug of lower-case ASCII letters, digits and hyphens survives typing, printing and chat without turning into %C3%A9 sequences.'
    ],
    howItWorks: {
      text: 'Each line becomes one slug through a chain of replacements in the page.',
      points: [
        'Devanagari is written in plain Latin first: a consonant carries a short a unless a vowel sign or the halant follows, and the a is dropped at a word’s end and between sounded syllables, so भारत becomes bharat.',
        'Letters that are not accented ones are spelt out, ß as ss, Æ as ae and Ł as l; then `normalize(\'NFD\')` splits é into e plus an accent mark, and the marks are deleted.',
        'Apostrophes, straight or curly, and backticks are removed, so don’t becomes dont, and & becomes the word and.',
        'Every run of characters outside A–Z, a–z and 0–9 becomes one separator, the ends are trimmed, and a maximum length cuts at the last whole word that fits.',
        'Remove stop words drops 16 short words such as the, of and is, but only from titles longer than two words.'
      ]
    },
    worked: {
      text: 'With stop words removed, Don’t Panic: The Guide to the Galaxy, typed with a curly apostrophe, becomes dont-panic-guide-galaxy. Łódź & Straße: Große Æsthetik becomes lodz-strasse-grosse-aesthetik, every letter kept. A Hindi headline, हिंदी समाचार, becomes hindi-samachar. A maximum of 20 stops a pangram at the-quick-brown-fox, 19 characters, not mid-word.'
    },
    uses: [
      ['Blog posts', 'Make the permalink from a title before publishing in a CMS that slugs badly.'],
      ['Hindi pages', 'Give a Devanagari headline a Latin address.'],
      ['Heading anchors', 'Generate id values so a table of contents can link to each heading.']
    ],
    mistakes: [
      'Feeding it Greek, Cyrillic, Arabic or Chinese titles. Only Latin and Devanagari are transliterated; other scripts are left out, with a warning.',
      'Putting the year in an evergreen slug: best-laptops-2026 must change next year, breaking links.',
      'Trusting symbols to survive. 50% Off £20 Deals ends in 50-off-20-deals, so reread the slug for meaning.'
    ],
    faq: [
      { q: 'Should slugs be lower-case?', a: 'Yes. Paths are case-sensitive on most servers, so /About and /about can be two pages or one can fail; lower case everywhere avoids both.' },
      { q: 'Is a slug the same as a permalink?', a: 'No. The permalink is the page’s full permanent URL; the slug is its last readable segment, which a CMS such as WordPress lets you edit separately.' },
      { q: 'What characters are allowed in a URL slug?', a: 'Any, once percent-encoded, but a–z, 0–9 and hyphens are the safe set, and all this tool writes by default.' }
    ],
    runs: [
      /* three titles, one per line (the curly apostrophe is U+2019), Stop words: Remove */
      { input: 'Don’t Panic: The Guide to the Galaxy\nŁódź & Straße: Große Æsthetik\nहिंदी समाचार', options: { stop: 'strip' }, check: [['output', 'dont-panic-guide-galaxy'], ['output', 'lodz-strasse-grosse-aesthetik'], ['output', 'hindi-samachar']] },
      /* Maximum length: 20 */
      { input: 'The Quick Brown Fox Jumps Over The Lazy Dog', options: { max: '20' }, check: [['output', 'the-quick-brown-fox'], ['stat:Longest', '19']] },
      /* the mistake: symbols */
      { input: 'Best Laptops of 2026: 50% Off £20 Deals', check: [['output', '50-off-20-deals']] }
    ]
  },

  '/developer/url-encoder/': {
    term: 'percent-encoding',
    whatIs: [
      'Percent-encoding, set out in RFC 3986, writes one byte as % and two hex digits, so a space becomes %20. It lets a URL carry characters it could not otherwise hold, and stops a character that has a job in the address, such as & between parameters, being read as structure when it is data.',
      'Non-ASCII text is converted to UTF-8 first and each byte is encoded, so é becomes %C3%A9. Writing a space as + is a separate convention from HTML form submission, not part of RFC 3986.'
    ],
    howItWorks: {
      text: 'The tool calls the browser’s built-in functions directly, so the result is what JavaScript code would produce.',
      points: [
        'Component scope uses `encodeURIComponent`, which escapes everything except letters, digits and - _ . ! ~ * \' ( ).',
        'Full URL scope uses `encodeURI`, which also leaves ; , / ? : @ & = + $ # alone.',
        'Decoding uses `decodeURIComponent` or `decodeURI`; Treat + as space first turns + into spaces, by default in Component scope only.',
        'A % without two hex digits after it, or bytes that are not valid UTF-8, stop decoding with an error. Input and Output are UTF-8 byte counts.',
        'Form scope writes a space as + and escapes ! \' ( ) ~, as an HTML form does. Query string → table splits at & and the first =.'
      ]
    },
    worked: {
      text: 'A search link typed with a raw ampersand, https://shop.example/search?q=fish & chips&page=2, shows the trap in Full URL scope. It returns https://shop.example/search?q=fish%20&%20chips&page=2, 53 B from 49 B: the & inside the search term is kept, so the shop receives q as "fish " and a stray parameter. In Component scope fish & chips becomes fish%20%26%20chips, safe to build a link around.'
    },
    uses: [
      ['Campaign links', 'Encode a campaign name with spaces or & for utm_campaign.'],
      ['Return URLs', 'Put a whole address inside ?next= as one value.'],
      ['Reading logs', 'Decode a request path from an access log to see what was really asked for.']
    ],
    mistakes: [
      'Decoding a form’s address in Full URL scope, which keeps +: q=fish+chips%20to%20go comes back as q=fish+chips to go. Set Treat + as space to Yes for q=fish chips to go.',
      'Decoding text with a bare percent sign. 100% sure is not valid encoding, and the tool stops with "Malformed percent-encoding"; a literal % is written %25.'
    ],
    faq: [
      { q: 'What is the difference between encodeURI and encodeURIComponent?', a: 'encodeURI is for a whole address and keeps / ? & = and # as they are; encodeURIComponent is for one piece and escapes them too. Use the second for any value you insert.' },
      { q: 'How are accents and symbols encoded in a URL?', a: 'As their UTF-8 bytes. café ☕ becomes caf%C3%A9%20%E2%98%95: two escapes for é, three for the cup, 21 B from 9 B of input.' },
      { q: 'Why are brackets not encoded?', a: 'encodeURIComponent leaves ( ) ! * and \' alone, although RFC 3986 reserves them: (really) comes out as %20(really)%20. Most servers accept them.' }
    ],
    runs: [
      /* Direction: Encode, Scope: Full URL */
      { input: 'https://shop.example/search?q=fish & chips&page=2', options: { scope: 'full' }, check: [['output', 'https://shop.example/search?q=fish%20&%20chips&page=2'], ['stat:Input', '49 B'], ['stat:Output', '53 B']] },
      /* Direction: Encode, Scope: Component */
      { input: 'fish & chips', check: [['output', 'fish%20%26%20chips']] },
      /* the mistakes, Direction: Decode */
      { input: 'q=fish+chips%20to%20go', options: { dir: 'dec', scope: 'full' }, check: [['output', 'q=fish+chips to go']] },
      { input: 'q=fish+chips%20to%20go', options: { dir: 'dec', scope: 'full', plus: 'yes' }, check: [['output', 'q=fish chips to go']] },
      { input: '100% sure', options: { dir: 'dec' }, check: [['error', 'Malformed percent-encoding']] },
      /* the FAQ, Component scope */
      { input: 'café ☕', check: [['output', 'caf%C3%A9%20%E2%98%95'], ['stat:Input', '9 B'], ['stat:Output', '21 B']] },
      { input: 'it\'s (really) *fine*!', check: [['output', '%20(really)%20'], ['output', '*'], ['output', '!']] }
    ]
  },

  '/developer/uuid-generator/': {
    term: 'a UUID',
    whatIs: [
      'A UUID, or GUID in Microsoft’s terms, is a 128-bit identifier written as hex digits in five hyphenated groups, 8-4-4-4-12.',
      'RFC 9562, which replaced RFC 4122 in 2024, defines the versions: 1 and 6 encode a timestamp, 3 and 5 hash a name, 7 leads with a Unix millisecond timestamp, and 4 is random apart from six bits marking the version and variant.'
    ],
    howItWorks: {
      text: 'A version 4 ID comes from the browser’s `crypto.randomUUID()`, which draws on the operating system’s secure random source.',
      points: [
        'Where that is missing, 16 bytes from `crypto.getRandomValues` are used with the version and variant bits set by hand; the Source row names getRandomValues either way.',
        'Only if neither exists does it fall back to `Math.random`, which is not cryptographically secure; current browsers have both.',
        'No hyphens strips the hyphens, Uppercase raises a–f, and Braces wraps each ID in { } last.',
        'The count is held between 1 and 500 per click, one ID per line.',
        'Version 7 and ULID put the clock first and count up within a millisecond, so a batch sorts in the order it was made. Version 1 uses a random node, never your network address.',
        'Check IDs reads each line as a UUID of any version or a ULID and gives the version, variant and any time.'
      ]
    },
    worked: {
      text: 'Asking for 800 IDs with No hyphens returns Generated 500, the per-click maximum: 500 lines of bare hex digits, 16,499 characters with the line breaks. Uppercase with Braces gives 500 lines such as {…} totalling 19,499 characters. The standard’s own v7 example, 017F22E2-79B0-7CC3-98C4-DC0C0C07398F, reads in Check IDs as version 7, made 2022-02-22T19:22:22.000Z.'
    },
    uses: [
      ['Test fixtures', 'Fill a seed file or mock response with realistic IDs.'],
      ['Idempotency keys', 'Attach a fresh UUID to a payment request so a retry is not processed twice.'],
      ['Database keys', 'Use version 7 or ULID so new rows land together in the index.'],
      ['Correlation IDs', 'Tag a request so its log lines can be found across services.']
    ],
    mistakes: [
      'Storing UUIDs as text. A 36-character string takes more than twice the 16 bytes of a native uuid column.',
      'Comparing them case-sensitively. RFC 9562 writes lower case but readers must accept either.'
    ],
    faq: [
      { q: 'What is the difference between a UUID and a GUID?', a: 'None in practice. GUID is Microsoft’s name for the same format, often shown in upper case and braces, which the options reproduce.' },
      { q: 'How do I generate a UUID in JavaScript?', a: 'Call crypto.randomUUID() in any current browser, or through the crypto module in Node.js; it is the same call this page makes for version 4.' },
      { q: 'Is a UUID without hyphens still valid?', a: 'Most libraries and databases, PostgreSQL’s uuid type included, accept the 32-digit form, but the hyphenated layout is canonical.' }
    ],
    runs: [
      /* How many: 800 (capped), Format: No hyphens; the IDs are random, only lengths and counts are quoted */
      { fields: { count: '800', braces: 'nodash' }, check: [['stat:Generated', '500'], ['outputLines', '500'], ['outputLength', '16,499']] },
      /* How many: 500, Case: Uppercase, Format: Braces */
      { fields: { count: '500', case: 'upper', braces: 'braces' }, check: [['outputLength', '19,499']] },
      /* What to do: Check IDs, the RFC 9562 version 7 example */
      { fields: { mode: 'check', ids: '017F22E2-79B0-7CC3-98C4-DC0C0C07398F' }, check: [['output', '2022-02-22T19:22:22.000Z'], ['output', 'version 7']] }
    ]
  },

  '/developer/xml-formatter/': {
    term: 'well-formed XML',
    whatIs: [
      'XML carries structured data in RSS feeds, sitemaps, SVG, Office files and many supplier and banking feeds. The W3C XML 1.0 rules are strict: one root, tags closed in order, quoted attributes, and & and < in text written as entities.',
      'A document that keeps those rules is well-formed, and a conforming parser must stop at the first breach rather than repair it as browsers do with HTML.'
    ],
    howItWorks: {
      text: 'A parser written for this page reads the text character by character against the XML 1.0 rules and stops at the first breach, naming its line and column.',
      points: [
        'It checks names, quoted attributes, comments, CDATA, the declaration, entities, character references, namespace prefixes and the single root. It does not check a DTD or XSD.',
        'An end tag must match the open tag exactly, case included, or the pair is named.',
        'Formatting puts each node on its own line, indented by depth. An element that mixes text and tags, or has xml:space="preserve", is printed exactly as written.',
        'Minifying drops whitespace between tags and, if you choose, comments. XPath 1.0 queries run in your browser’s own engine.'
      ]
    },
    worked: {
      text: 'This fragment, <menu><item>Fish & chips</item><item price=4.50>Mushy peas</item></menu><menu/>, has three faults, reported one at a time: the bare & at line 1, column 18, then the unquoted price=4.50 at column 48, then the second root at column 79. With all three fixed it is 3 elements, depth 2, 78 B in and 85 B out. A case slip such as <order><Item>Tea</item></order> fails with "Mismatched tags: <Item> is closed by </item>."'
    },
    uses: [
      ['Supplier feeds', 'Indent a one-line feed to find the record an import choked on.'],
      ['Sitemaps', 'Tidy sitemap.xml to read its url and lastmod entries.'],
      ['SOAP and payment messages', 'Lay out a SOAP response or payment file, then query it with XPath.']
    ],
    mistakes: [
      'Using HTML entity names in XML. Only &amp;, &lt;, &gt;, &quot; and &apos; are predefined, so &nbsp; is an error unless a DOCTYPE defines it; write &#160; instead.',
      'Minifying mixed content. Whitespace between tags is removed, so <b>fish</b> <i>chips</i> becomes <b>fish</b><i>chips</i>.'
    ],
    faq: [
      { q: 'Does formatting change my data?', a: 'Only the whitespace between tags is replaced by line breaks and indentation. Text inside elements and attribute values are left alone.' },
      { q: 'How is XML different from HTML?', a: 'HTML has a fixed set of tags and forgiving browsers; XML lets each format define its own tags and refuses a document with an error.' },
      { q: 'What is the <?xml version="1.0"?> line at the top?', a: 'The XML declaration, giving the version and often the encoding. It is optional for UTF-8, must come first if present, and is kept in place here.' }
    ],
    runs: [
      /* default options (Formatted, 2 spaces), the three faults in turn */
      { input: '<menu><item>Fish & chips</item><item price=4.50>Mushy peas</item></menu><menu/>', check: [['error', 'line 1, column 18']] },
      { input: '<menu><item>Fish &amp; chips</item><item price=4.50>Mushy peas</item></menu><menu/>', check: [['error', 'column 48']] },
      { input: '<menu><item>Fish &amp; chips</item><item price="4.50">Mushy peas</item></menu><menu/>', check: [['error', 'column 79']] },
      { input: '<menu><item>Fish &amp; chips</item><item price="4.50">Mushy peas</item></menu>', check: [['stat:Elements', '3'], ['stat:Max depth', '2'], ['stat:Input', '78 B'], ['stat:Output', '85 B']] },
      { input: '<order><Item>Tea</item></order>', check: [['error', 'Mismatched tags: <Item> is closed by </item>.']] },
      /* the mistakes */
      { input: '<p>Fish&nbsp;chips</p>', check: [['error', '&nbsp;']] },
      { input: '<p><b>fish</b> <i>chips</i></p>', options: { mode: 'minify' }, check: [['output', '<b>fish</b><i>chips</i>']] },
      /* the FAQ: the declaration is kept */
      { input: '<?xml version="1.0"?>\n<feed><qty>3</qty></feed>', check: [['output', '<?xml version="1.0"?>']] }
    ]
  }
};
