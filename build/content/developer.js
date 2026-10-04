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
      'JSON (JavaScript Object Notation) is a plain-text format for structured data: objects in curly braces holding "name": value pairs, arrays in square brackets, and strings, numbers, true, false and null. Most web APIs and many configuration files use it.',
      'Valid has a precise meaning. RFC 8259, the standard, allows no comments, no trailing commas, no single quotes and no unquoted keys. JavaScript accepts some of those; a strict parser rejects every one.'
    ],
    howItWorks: {
      text: 'Your text goes to the browser’s own parser, the `JSON.parse` that web apps call, so the verdict is the one your code would get. Nothing leaves the tab.',
      points: [
        'When parsing fails, the character position in the error becomes a line and a column, and the offending line is printed beneath.',
        'A valid document is written back with `JSON.stringify`: indented by 2 or 4 spaces or a tab, or on one line when minified.',
        'With keys sorted, every object at every depth is rebuilt in alphabetical key order; arrays keep their own order.',
        'The figures count every key and array item at all levels, the deepest nesting, and both sizes in UTF-8 bytes.'
      ]
    },
    worked: {
      text: 'A five-line service config, {"port": 8080, "hosts": ["api.internal", "cache.internal"], "retries": 3,}, will not load. The tool stops at line 5, column 1, the closing brace, where the parser still expected a property name: the stray comma sits on the line above. Without it the file is valid, with 5 keys and items and a maximum depth of 3. Minified it drops from 81 B to 67 B; sorted with 4-space indents it grows to 109 B.'
    },
    uses: [
      ['Reading an API response', 'Turn the one-line body from curl or the network tab into something you can scan.'],
      ['Finding why a config will not load', 'Get the line and column of a stray comma rather than a bare “unexpected token”.'],
      ['Clean diffs in Git', 'Sort the keys of generated JSON so two versions differ only where the data does.']
    ],
    mistakes: [
      'Pasting a JavaScript object literal. Single quotes, bare keys and comments work in a .js file and are invalid JSON.',
      'Taking the error line literally. The parser reports where it gave up, often one line after the real fault.'
    ],
    faq: [
      { q: 'Can JSON have comments?', a: 'Not under RFC 8259. Dialects such as JSONC (VS Code settings) and JSON5 add them, but a standard parser, this one included, rejects them.' },
      { q: 'Does minifying JSON change the data?', a: 'No. Only whitespace between tokens goes; spaces inside strings stay, and both versions parse to the same value.' },
      { q: 'Why did a long number change after formatting?', a: 'JSON numbers are read as 64-bit floating-point values, so whole numbers past 9,007,199,254,740,991 lose precision: an ID of 12345678901234567890 comes back as 12345678901234567000. Keep long IDs in strings.' }
    ],
    related: { guides: ['/guides/format-json/'] },
    runs: [
      /* the broken config, default options (formatted, 2 spaces) */
      { input: '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3,\n}', check: [['error', 'line 5, column 1']] },
      /* the same config with the comma removed, minified */
      { input: '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3\n}', options: { mode: 'minify' }, check: [['stat:Keys / items', '5'], ['stat:Max depth', '3'], ['stat:Input', '81 B'], ['stat:Output', '67 B']] },
      /* and formatted with keys sorted, 4-space indent */
      { input: '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3\n}', options: { mode: 'sorted', indent: '4' }, check: [['stat:Output', '109 B']] },
      /* the FAQ's long ID */
      { input: '{"id": 12345678901234567890}', options: { mode: 'minify' }, check: [['output', '12345678901234567000']] }
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
        'Input and Output are byte sizes; Growth compares the output with the number of characters you typed.'
      ]
    },
    worked: {
      text: 'The query condition x >= y? is 7 B. Standard encoding gives eCA+PSB5Pw==, 12 B: seven bytes fill three groups, the last one short, so two = signs pad it and Growth reads +71%, well above the usual third. That + would turn into a space inside a query string. URL-safe gives eCA-PSB5Pw, 10 B, and Decode turns it straight back into x >= y?.'
    },
    uses: [
      ['Kubernetes secrets', 'Values in a Secret manifest are stored this way; decode one to check it, or encode a new one.'],
      ['HTTP Basic authentication', 'Build or check an Authorization header, which carries user:password encoded.'],
      ['Data URIs', 'Inline a small SVG or font in CSS as a data: URL to save a request.']
    ],
    mistakes: [
      'Decoding binary data as text. The decoded bytes are read as UTF-8, so an image or a ZIP comes out as gibberish; decode files with the base64 command instead.',
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
      { input: 'eCA-PSB5Pw', options: { dir: 'dec' }, check: [['output', 'x >= y?']] }
    ]
  },

  '/developer/case-converter/': {
    whatTitle: 'What case conventions are',
    whatIs: [
      'Code identifiers cannot contain spaces, so programmers mark word boundaries another way: a capital letter (camelCase, PascalCase), an underscore (snake_case, CONSTANT_CASE) or a hyphen (kebab-case). The choice is convention, enforced by style guides and linters rather than compilers.',
      'Conventions collide where systems meet. A hyphenated CSS property such as font-size is style.fontSize in JavaScript, and a created_at database column often reaches the front end as createdAt.'
    ],
    howItWorks: {
      text: 'Each line is split into words on its own, then rejoined in the style you pick.',
      points: [
        'A lower-case letter or digit followed by a capital starts a new word: userId becomes user and Id.',
        'In a run of capitals, the last one before a lower-case letter starts the next word, so XMLHttp splits into XML and Http.',
        'Underscores, hyphens and dots become spaces; other punctuation stays attached to its word.',
        'The words are re-cased and joined. Title Case keeps 14 short words such as of, and and vs lower-case unless they come first.'
      ]
    },
    worked: {
      text: 'Three names from a codebase, XMLHttpRequest, getUserIDs and v2ApiClient, converted to snake_case give xml_http_request, get_user_i_ds and v2_api_client, with Lines converted at 3. The first and last are right. The middle one shows the limit of splitting on capitals: the plural acronym IDs is read as a capital I and then a word, Ds. Rename it getUserIds first and the result is get_user_ids.'
    },
    uses: [
      ['Mapping an API to a front end', 'Turn snake_case response fields into the camelCase names a TypeScript interface uses.'],
      ['Database columns', 'Convert a spreadsheet’s header row into snake_case column names for a CREATE TABLE statement.'],
      ['Environment variables', 'Make CONSTANT_CASE keys such as DATABASE_URL from a list of setting names.']
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
      { input: 'Hello, world!\nThe The', options: { target: 'title' }, check: [['output', 'Hello, World!'], ['output', 'The the']] }
    ]
  },

  '/developer/color-converter/': {
    whatTitle: 'What colour contrast measures',
    whatIs: [
      'HEX, RGB, HSL and HSB are four ways of writing one sRGB colour. HEX and RGB give the red, green and blue channels from 0 to 255; HSL and HSB give a hue angle plus saturation and lightness or brightness.',
      'WCAG 2 contrast is a ratio of relative luminance, in which green counts for 71.52% and blue for only 7.22%. It runs from 1:1 for identical colours to 21:1 for black on white, so two very different hues can score almost the same.'
    ],
    howItWorks: {
      text: 'Both colours are read as three- or six-digit hex and split into channels; anything else is refused. The maths is plain JavaScript in the page.',
      points: [
        'HSL and HSB come from the largest and smallest channel, rounded to whole numbers.',
        'Luminance linearises each channel with the WCAG 2 curve and weights them 0.2126, 0.7152 and 0.0722; the ratio is (lighter + 0.05) ÷ (darker + 0.05).',
        'The ratio is shown to two decimals but graded unrounded: 4.5 and 7 for body text, 3 and 4.5 for large text, 3 for interface parts.'
      ]
    },
    worked: {
      text: 'Mid-grey text on white sits right on the line. #767676 scores 4.54:1 and passes AA for body text; #777777, one step lighter in each channel, scores 4.48:1 and fails, though their HSL lightness is 46% and 47%. Coloured buttons surprise too: white text on a #e63946 red gives 4.17:1, a fail for body text, while black text on the same red reaches 5.04:1 and passes.'
    },
    uses: [
      ['Accessibility audits', 'Check each text and background pair in a design system before an auditor does.'],
      ['Converting a brand palette', 'Turn a brand guide’s HEX codes into RGB for slides or HSL for CSS custom properties.'],
      ['Choosing button text', 'Compare the ratios for white and for black text on a coloured button.']
    ],
    mistakes: [
      'Checking against white only. Text also sits on cards, hover states and dark panels; test each background it appears on.',
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
      'A cron expression tells the Unix scheduler when to run a job. Each of its five fields takes a single value, a comma list, a range, * for every value or a step such as */10.',
      'There is no single standard. Vixie cron, behind most Linux systems, added names, steps and shortcuts such as @daily to the POSIX fields; Quartz puts seconds first and AWS adds a year.'
    ],
    howItWorks: {
      text: 'Each line is parsed into five sets of allowed values, put into English, then tested against your clock.',
      points: [
        'Names such as mon or jan become numbers, and ranges and steps are expanded: */20 in the minute field is 0, 20 and 40.',
        '@yearly, @monthly, @weekly, @daily, @hourly and their aliases are swapped for five fields first; @reboot is refused.',
        'Next runs come from stepping forward a minute at a time in your time zone for up to 527,040 minutes (366 days), with the OR rule when both day fields are set.'
      ]
    },
    worked: {
      text: 'Someone wants a report at 9 am on the first Monday of each month and writes 0 9 1-7 * 1. The parser reads it back as "At 09:00, on day 1, 2, 3, 4, 5, 6 and 7 of the month, and on Monday." That is ten or eleven runs a month, not one. Five-field cron cannot say "first Monday": schedule 0 9 1-7 * * and let the script exit unless it is Monday. A second line, 0 0 31 2 *, counts as valid but reports "no runs found within the next year".'
    },
    uses: [
      ['Reviewing a crontab', 'Paste all of crontab -l at once and see which jobs pile up on the same minute.'],
      ['Writing a CI schedule', 'Check a GitHub Actions schedule before committing; it takes five-field cron and runs it in UTC.'],
      ['Explaining a schedule', 'Paste the English line into a ticket for colleagues who do not read cron.']
    ],
    mistakes: [
      'Using */45 for every 45 minutes. Steps restart each hour, so the parser says "At minute 0 and minute 45 of every hour": gaps of 45 minutes, then 15.',
      'Leaving the minute as *. The line * 9 * * * reads "Every minute during 09:00", sixty runs rather than one; write 0 9 * * * instead.'
    ],
    faq: [
      { q: 'How do I run a cron job every 5 minutes?', a: 'Use */5 * * * *. It fires on the clock at minute 0, 5, 10 and so on through minute 55.' },
      { q: 'What does 0 0 * * 0 mean?', a: 'Midnight every Sunday, read here as "At 00:00, on Sunday." It is the same schedule as @weekly.' },
      { q: 'Why did my cron job not run?', a: 'Often not the expression: the server’s time zone, a PATH cron does not set, or a bare % in the command, which crontab reads as a newline.' }
    ],
    runs: [
      /* the "first Monday" line and 31 February, default options; the run dates depend on the day it is run, so only the description is quoted */
      { input: '0 9 1-7 * 1\n0 0 31 2 *', check: [['output', 'At 09:00, on day 1, 2, 3, 4, 5, 6 and 7 of the month, and on Monday.'], ['output', 'no runs found within the next year'], ['stat:Valid', '2']] },
      /* the mistakes */
      { input: '*/45 * * * *\n* 9 * * *', check: [['output', 'At minute 0 and minute 45 of every hour'], ['output', 'Every minute during 09:00']] },
      /* the FAQ answers */
      { input: '*/5 * * * *\n0 0 * * 0', check: [['output', 'minute 55'], ['output', 'At 00:00, on Sunday.']] }
    ]
  },

  '/developer/css-gradient/': {
    whatTitle: 'What a CSS gradient is',
    whatIs: [
      'A CSS gradient is an image the browser draws itself, so it goes wherever an image can, usually in the background property. There is no file to download and it stays sharp at any size.',
      'linear-gradient blends along a straight line; radial-gradient spreads out from a centre as a circle or ellipse; conic-gradient sweeps round a centre like a clock hand, which is how pie charts and colour wheels are drawn in pure CSS. Each takes a list of colour stops, a colour with an optional position.'
    ],
    howItWorks: {
      text: 'The form becomes one line of CSS, and the same value paints the preview, so what you see is the browser rendering the code you copy.',
      points: [
        'Empty colour fields are dropped; the rest are spaced evenly, at 0% and 100% or at 0%, 50% and 100%.',
        'Linear uses the angle as its direction: `linear-gradient(120deg, …)`.',
        'Radial ignores the angle and always writes a circle centred at 50% 50%.',
        'Conic uses the angle as the start of the sweep: `conic-gradient(from 120deg at 50% 50%, …)`.'
      ]
    },
    worked: {
      text: 'For a colour-wheel badge, choose Conic, angle 90, and the stops #ff6b6b, #4ecdc4 and #ff6b6b again. The tool writes conic-gradient(from 90deg at 50% 50%, #ff6b6b 0%, #4ecdc4 50%, #ff6b6b 100%); repeating the first colour as the last removes the hard seam where the sweep meets its start. Switch to Radial and clear the third field, and the angle stops mattering: the line becomes radial-gradient(circle at 50% 50%, #ff6b6b 0%, #4ecdc4 100%), with 2 colour stops.'
    },
    uses: [
      ['Hero sections', 'A full-width banner background with no image request and nothing to blur when it scales.'],
      ['Pie charts and progress rings', 'A conic gradient, its stop positions edited into hard edges, draws segments without SVG.'],
      ['Image placeholders', 'Show a gradient in a photo’s main colours while the real image loads.']
    ],
    mistakes: [
      'Expecting the angle to move a radial gradient. A circle has no direction; to shift its centre, edit the at 50% 50% part of the copied code.',
      'Applying a gradient to text without clipping it. Add background-clip: text and make the text transparent, or the gradient fills the whole box.'
    ],
    faq: [
      { q: 'How do I make a gradient with a hard edge?', a: 'Give two neighbouring stops the same position, such as #ff6b6b 50%, #4ecdc4 50%; edit the percentages in the copied code to do it.' },
      { q: 'Can a CSS gradient be animated?', a: 'Not directly in most browsers, because background images do not interpolate. The usual workarounds animate background-position on an oversized gradient, or a registered custom property used inside it.' },
      { q: 'Do conic gradients work in every browser?', a: 'In every current one. Chrome and Safari added them first and Firefox followed in 2020.' }
    ],
    runs: [
      /* Type: Conic, Angle 90, colours #ff6b6b, #4ecdc4, #ff6b6b */
      { fields: { type: 'conic', angle: '90', c1: '#ff6b6b', c2: '#4ecdc4', c3: '#ff6b6b' }, check: [['output', 'conic-gradient(from 90deg at 50% 50%, #ff6b6b 0%, #4ecdc4 50%, #ff6b6b 100%)']] },
      /* the same with Type: Radial and Colour 3 cleared */
      { fields: { type: 'radial', angle: '90', c1: '#ff6b6b', c2: '#4ecdc4', c3: '' }, check: [['output', 'radial-gradient(circle at 50% 50%, #ff6b6b 0%, #4ecdc4 100%)'], ['stat:Colour stops', '2']] }
    ]
  },

  '/developer/csv-to-json/': {
    term: 'CSV',
    whatIs: [
      'CSV, comma-separated values, is the plain-text table every spreadsheet can export: one record per line, fields split by commas, usually with a header row. RFC 4180 wrote the common rules down in 2005, chiefly that a field holding a comma, a quote or a line break is wrapped in double quotes.',
      'JSON holds the same rows as an array of objects keyed by the header. CSV is flat and untyped while JSON nests and has numbers, booleans and null, so neither direction is lossless.'
    ],
    howItWorks: {
      text: 'Both directions run in plain JavaScript; the CSV side reads one character at a time rather than splitting on commas.',
      points: [
        'Quotes are tracked, so a quoted comma or line break stays in its field and "" becomes one quote.',
        'The first row is the header; every value stays a string, and short rows are padded with empty strings.',
        'The array is written with `JSON.stringify` at a 2-space indent, though Output measures it without the indent.',
        'JSON to CSV uses the union of every object’s keys as columns and quotes values containing the delimiter, a quote or a line break.'
      ]
    },
    worked: {
      text: 'Two products as JSON, one with a qty and the other with a price instead, become CSV with Columns 4 and Rows 2. The header is sku,title,qty,price, "Oak shelf, 80 cm" is quoted for its comma, and the hook is written "Wall hook ""S"" type". Paste that CSV back and the round trip is not exact: the shelf returns with "qty": "4", a string, and each product now carries the key it never had, empty: "price": "".'
    },
    uses: [
      ['Seed data', 'Turn a spreadsheet of test users into a JSON fixture for a database seed script.'],
      ['Bulk imports', 'Convert a supplier’s price list into the array of objects an import endpoint expects.'],
      ['Opening JSON in Excel', 'Flatten an API export into CSV so a colleague can sort and filter it.']
    ],
    mistakes: [
      'Converting nested JSON to CSV. Arrays become comma-joined text and objects become the literal [object Object]; flatten nested fields into keys of their own first.',
      'Double-clicking a UTF-8 CSV to open it in Excel, which can garble accents. Import it through Data, From Text/CSV instead.'
    ],
    faq: [
      { q: 'Can CSV headers contain spaces?', a: 'Yes, and they become JSON keys exactly as written, such as "Unit price". Rename them first if your code reads keys with dot notation.' },
      { q: 'What happens to a row with more fields than the header?', a: 'The extra fields are dropped, because only header columns become keys. A row with fewer fields gets empty strings for the missing ones.' },
      { q: 'What is the difference between CSV and TSV?', a: 'Only the delimiter. Pick Tab in the delimiter list to read or write TSV.' }
    ],
    related: { guides: ['/guides/format-json/'] },
    runs: [
      /* Direction: JSON → CSV, delimiter comma */
      { input: '[{"sku":"BK-101","title":"Oak shelf, 80 cm","qty":4},{"sku":"BK-102","title":"Wall hook \\"S\\" type","price":3.5}]', options: { dir: 'j2c' }, check: [['output', 'sku,title,qty,price'], ['output', '"Oak shelf, 80 cm"'], ['output', '"Wall hook ""S"" type"'], ['stat:Columns', '4'], ['stat:Rows', '2']] },
      /* that CSV pasted back, Direction: CSV → JSON */
      { input: 'sku,title,qty,price\nBK-101,"Oak shelf, 80 cm",4,\nBK-102,"Wall hook ""S"" type",,3.5', check: [['output', '"qty": "4"'], ['output', '"price": ""']] },
      /* the mistake: nested values, JSON → CSV */
      { input: '[{"id":7,"tags":["a","b"],"addr":{"city":"York"}}]', options: { dir: 'j2c' }, check: [['output', '[object Object]']] },
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
        'The HTML snippet also links favicon.ico and site.webmanifest, which this tool does not make.'
      ]
    },
    worked: {
      text: 'A 300×200 transparent PNG of 840 B, an orange disc on nothing, produced 8 icons totalling 44.0 KB, from 397 B for the smallest to 18.4 KB for the 512 pixel one. The tool warned that the source is smaller than 512px, so the large icons are enlarged. Every corner pixel came out opaque white, not transparent, because the background is always painted. Setting it to #1d3557 gave navy corners and a total of 43.5 KB.'
    },
    uses: [
      ['Launching a small site', 'Make the whole icon set from one logo before the site goes live.'],
      ['Making a web app installable', 'Get the 192 and 512 pixel icons a manifest needs for Add to Home Screen.'],
      ['Rebranding', 'Regenerate every size from the new mark so tabs and home screens match.']
    ],
    mistakes: [
      'Expecting transparent icons from a transparent logo. Pick a background colour that works in both light and dark browser tabs, since every icon will be a solid square.',
      'Pasting the HTML without the files it names. Delete the favicon.ico line or make an .ico separately, and write a site.webmanifest that lists the 192, 512 and maskable icons.',
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
      'They are built for different jobs. SHA-256, from the SHA-2 family in FIPS 180-4, is cryptographic: finding two inputs with the same digest is believed infeasible. CRC32, the check inside ZIP and PNG files and Ethernet frames, only catches accidental corruption and is easy to forge.'
    ],
    howItWorks: {
      text: 'All four algorithms are written out in the engine file itself and run synchronously, so the digests update on every keystroke.',
      points: [
        'Your text is first encoded as UTF-8, which is why Input length shows characters and bytes separately.',
        'SHA-256 and SHA-1 pad the bytes to 64-byte blocks, append the length big-endian and run 64 or 80 rounds per block.',
        'MD5 follows RFC 1321, with its 64 constants derived from the sine function and the length appended little-endian.',
        'CRC32 uses the reflected polynomial 0xEDB88320 through a 256-entry lookup table.',
        'All four are always computed; the Show menu only filters the output.'
      ]
    },
    worked: {
      text: 'The word café hashes differently depending on how its é was typed. As one precomposed character, Input length reads 4 characters, 5 bytes and the first digest begins 850f7dc4. Typed as e plus a combining accent, as some systems store it, it reads 5 characters, 6 bytes and begins 81ef060b. Both look identical on screen. Add the newline that echo appends and there is a third digest, 7b49b9e0….'
    },
    uses: [
      ['Test fixtures', 'Get the expected digest of a known string for a unit test.'],
      ['Cache keys', 'Derive a stable key from a request body or template so identical input maps to one entry.'],
      ['Spotting invisible differences', 'Hash two strings that look the same: different digests prove a hidden space or accent encoding.']
    ],
    mistakes: [
      'Comparing with a terminal hash of echo output. echo adds a newline; use printf or echo -n so the bytes match what you typed here.',
      'Treating CRC32 as a security check. Anyone can alter data and then adjust it so the CRC still matches.'
    ],
    faq: [
      { q: 'How long is a SHA-256 hash?', a: '64 hexadecimal characters, or 256 bits, whatever the input length. SHA-1 gives 40 characters, MD5 32 and CRC32 8.' },
      { q: 'Can this generate an HMAC?', a: 'No. An HMAC mixes a secret key into the hash, as webhook signatures do; this tool hashes the text alone, so its SHA-256 will not match a signature header.' },
      { q: 'Can two different inputs have the same hash?', a: 'In principle, yes. Nobody has found such a pair for SHA-256, while MD5 pairs can be made on a laptop in seconds.' }
    ],
    runs: [
      /* "café" with é as U+00E9, default options (all algorithms, lowercase) */
      { input: 'café', check: [['stat:Input length', '4 characters, 5 bytes'], ['stat:SHA-256', '850f7dc4']] },
      /* "café" as e + U+0301 combining acute */
      { input: 'café', check: [['stat:Input length', '5 characters, 6 bytes'], ['stat:SHA-256', '81ef060b']] },
      /* "café" plus a trailing newline */
      { input: 'café\n', check: [['stat:SHA-256', '7b49b9e0']] }
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
        'Force HTTPS adds `RewriteCond %{HTTPS} off` and a 301 to the same host and path over https.',
        'Force www redirects to https://www. plus your domain, cleaned of any http:// or www.; Force non-www captures the host after www. and redirects to that.',
        'Both www rules send visitors to https, even when Force HTTPS is set to No.',
        'Caching gives CSS, JavaScript, SVG, WebP and WOFF2 a year and HTML zero seconds; security adds five headers, HSTS among them.'
      ]
    },
    worked: {
      text: 'For a site that should live at https://ashworth-joinery.co.uk without www, choose Force HTTPS and Force non-www and switch the other blocks off: 5 directives, 192 B. Mind the order. A request for http://www.ashworth-joinery.co.uk/ meets the HTTPS rule first and goes to https://www., then the www rule redirects it again, so that visitor takes two permanent redirects and an extra round trip. The domain field is not used in this combination at all.'
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
      { fields: { https: 'yes', www: 'root', domain: 'https://www.ashworth-joinery.co.uk/', cache: 'no', gzip: 'no', security: 'no' }, check: [['stat:Directives', '5'], ['stat:Size', '192 B'], ['output', 'R=301']] }
    ]
  },

  '/developer/html-entities/': {
    whatTitle: 'What HTML character references are',
    whatIs: [
      'A character reference writes a character in HTML source without typing it: &amp; for an ampersand, &lt; for a less-than sign. The browser turns it back when it renders, so text containing markup characters is displayed instead of being read as tags.',
      'Numeric references give the Unicode code point in decimal (&#163;) or hex (&#xA3;) and work for any character. Named references such as &pound; come from a list of more than 2,000 in the HTML standard; XML recognises only five of them.'
    ],
    howItWorks: {
      text: 'Each direction is a single regular-expression pass over your text in plain JavaScript.',
      points: [
        'Escaping replaces exactly five characters: & < > " and \', the last as &#39;.',
        'Escaping does not look for existing entities, so escaped text is escaped again.',
        'Unescaping knows seven names (amp, lt, gt, quot, apos, nbsp and #39) and converts every decimal or hex reference with `String.fromCodePoint`.',
        'Any other named reference is left as written, yet Entities decoded counts every entity-shaped token, changed or not.'
      ]
    },
    worked: {
      text: 'A menu line exported from an old CMS reads Caf&eacute; &copy; 2026 &mdash; menu from &#163;9 &#x2615;. Unescaped, it becomes Caf&eacute; &copy; 2026 &mdash; menu from £9 ☕. The two numeric references turn into a pound sign and a coffee cup; the three names are outside the tool’s short list and stay put, though Entities decoded says 5. Convert the names to numbers first, &#233; &#169; &#8212;, and they come out as é © —.'
    },
    uses: [
      ['Showing code in a post', 'Escape an HTML snippet so it appears as text inside a pre block.'],
      ['Quoted attributes', 'Escape quotes in alt text or a title before it goes inside an attribute.'],
      ['Cleaning feed text', 'Turn &#39; and &quot; left by a CMS or RSS feed back into plain quotes.']
    ],
    mistakes: [
      'Escaping twice. Tom &amp; Jerry run through again becomes Tom &amp;amp; Jerry, and the page then shows the entity; check the input is raw first.',
      'Escaping a whole template. Every tag is escaped too and the page displays as source; escape only the text you insert.'
    ],
    faq: [
      { q: 'What is the difference between &nbsp; and a normal space?', a: 'A non-breaking space looks the same but blocks a line break there and is not collapsed with neighbouring spaces. Unescaping turns &nbsp; into that character, not an ordinary space.' },
      { q: 'Do I need entities for accented letters or the euro sign?', a: 'Not in a page served as UTF-8, which nearly all are; type them directly. Escaping here leaves them alone for that reason.' },
      { q: 'Should I use &apos; or &#39; for an apostrophe?', a: '&#39; works everywhere. &apos; is valid in XML and HTML5 but not HTML 4, so some older email clients show it literally; this tool writes &#39; and reads both.' }
    ],
    runs: [
      /* Direction: Unescape */
      { input: 'Caf&eacute; &copy; 2026 &mdash; menu from &#163;9 &#x2615;', options: { dir: 'dec' }, check: [['output', 'Caf&eacute; &copy; 2026 &mdash; menu from £9 ☕'], ['stat:Entities decoded', '5']] },
      /* the names rewritten as numbers, Unescape */
      { input: '&#233; &#169; &#8212;', options: { dir: 'dec' }, check: [['output', 'é © —']] },
      /* the mistake: escaping text that is already escaped, Direction: Escape */
      { input: 'Tom &amp; Jerry', check: [['output', 'Tom &amp;amp; Jerry']] }
    ]
  },

  '/developer/jwt-decoder/': {
    term: 'a JSON Web Token',
    whatIs: [
      'A JSON Web Token, defined in RFC 7519, packs claims about a user or service into one URL-safe string. The usual signed form is three base64url segments joined by dots: a header naming the algorithm, a payload of claims such as sub, aud, iat and exp, and a signature over the first two.',
      'Decoding and verifying are different acts. Decoding only reverses the encoding of the first two segments; verifying recomputes the signature with the issuer’s key and compares the two.'
    ],
    howItWorks: {
      text: 'The token is split on its dots and the first two parts are decoded in the page. The third part is never read.',
      points: [
        'Anything other than three parts is refused, which also rules out the five-part encrypted form.',
        'Header and payload are mapped from base64url to standard Base64, re-padded, decoded as UTF-8 and parsed with `JSON.parse`.',
        'alg and typ come from the header; iat and exp are multiplied by 1,000 and shown as UTC.',
        'Status compares exp with your device clock and nothing else: no signature check, and nbf is ignored.'
      ]
    },
    worked: {
      text: 'A service token with an RS256 header and key ID k-2026-01 decodes to subject svc-reports, Issued 2026-01-01 00:00:00 UTC and Expires 2026-01-01 01:00:00 UTC, so Status reads EXPIRED. Its third segment just encodes the words signature-not-checked, and the decoder showed everything regardless. A token whose header says "alg": "none" and whose third part is empty decodes just as readily, which is why a server must reject any algorithm it did not expect.'
    },
    uses: [
      ['Debugging a 401', 'See whether a rejected token has expired or carries the wrong aud.'],
      ['Checking roles and scopes', 'Read the claim an API uses to refuse an action.'],
      ['Clock skew', 'Compare iat with the time your server logged a request that was refused.']
    ],
    mistakes: [
      'Writing exp in milliseconds. An exp of 1767229200000 decodes to +057971-04-07, an expiry tens of thousands of years away; NumericDate is whole seconds.',
      'Pasting the Bearer prefix. Copy only what follows "Bearer " in the Authorization header, or the header segment will not decode.'
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
      /* the first token with "Bearer " in front */
      { input: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImstMjAyNi0wMSJ9.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZSIsInN1YiI6InN2Yy1yZXBvcnRzIiwiYXVkIjoiYXBpLmV4YW1wbGUiLCJpYXQiOjE3NjcyMjU2MDAsImV4cCI6MTc2NzIyOTIwMH0.c2lnbmF0dXJlLW5vdC1jaGVja2Vk', check: [['error', 'header segment']] }
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
        'The Latin list holds 63 distinct words from the classic passage and the English list 59; words are picked independently, so the famous opening appears only by chance.',
        'A sentence is 8 to 19 words, capitalised and closed with a full stop, with no commas; a paragraph is 3 to 5 sentences.',
        'Choosing Words returns that many bare words, with no capitals or full stops.',
        'The count is capped at 100, and <p> or <li> tags wrap each paragraph, or the single block that Words and Sentences produce.'
      ]
    },
    worked: {
      text: 'Asking for 250 words wrapped in <li> tags returns Words 100, because the count is capped. It also returns Paragraphs 1: one <li> holding every word inside a <ul>, since only the Paragraphs setting makes more than one block. For a six-item list, choose Paragraphs, 6, with <li> tags. The output is 8 lines, the <ul>, six items and the closing tag, each item 3 to 5 sentences long.'
    },
    uses: [
      ['Wireframes', 'Fill content blocks in a mock-up so a review stays on structure.'],
      ['CMS templates', 'Paste paragraphs in <p> tags to check the spacing between them.'],
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
      /* Generate: Words, How many: 250, Wrap in: <li> tags (output words are random; only the counts are quoted) */
      { fields: { unit: 'words', count: '250', wrap: 'li' }, check: [['stat:Words', '100'], ['stat:Paragraphs', '1']] },
      /* Generate: Paragraphs, How many: 6, Wrap in: <li> tags */
      { fields: { unit: 'paragraphs', count: '6', wrap: 'li' }, check: [['stat:Paragraphs', '6'], ['outputLines', '8']] }
    ]
  },

  '/developer/markdown-preview/': {
    term: 'Markdown',
    whatIs: [
      'Markdown is a plain-text way of writing formatted documents: # for headings, asterisks for emphasis, a hyphen for each list item. John Gruber published it in 2004, and because his description left many cases open, converters disagreed at the edges.',
      'CommonMark, begun in 2014, is the strict specification that followed, and GitHub Flavored Markdown extends it with tables, strikethrough and task lists. This converter is a compact line-by-line one covering the common syntax, not a CommonMark implementation.'
    ],
    howItWorks: {
      text: 'The conversion is a short chain of regular expressions in the page, with no Markdown library behind it.',
      points: [
        'Fenced code blocks are lifted out first and escaped, so nothing inside them changes.',
        'Each other line is classified by how it starts: #, >, a bullet, a number or a rule. Any other line joins the paragraph above until a blank line.',
        'Inline, &, < and > are escaped, then code spans, images, links, bold, italic and ~~strikethrough~~ are converted.',
        'The result is shown as HTML source, not rendered; Full HTML document wraps it in a doctype, head and body.'
      ]
    },
    worked: {
      text: 'Notes written for GitHub do not all survive. A heading underlined with ===, a bullet with two indented sub-items and a two-row table come out as Headings 0, Paragraphs 2 and Lists 1. The underline heading becomes ordinary text, the sub-items are lifted to the level of their parent, and the table is joined into one paragraph of pipes. Rewrite the heading with #, flatten the list and keep the table in HTML.'
    },
    uses: [
      ['Newsletter copy', 'Draft in Markdown, then paste the HTML into an editor that only takes HTML.'],
      ['Docs pages', 'Turn a project’s install steps into HTML for a website.'],
      ['HTML email', 'Write bullets and links in plain text and get markup for an email template.']
    ],
    mistakes: [
      'Expecting a line break where you pressed Enter. Lines are joined into one paragraph, and two trailing spaces do not force a <br> here; leave a blank line instead.',
      'Indenting code by four spaces. Only fenced blocks become code; indented lines are treated as paragraph text.',
      'Publishing links from someone else’s text unchecked. Addresses are copied as written, so a javascript: address stays a live link.'
    ],
    faq: [
      { q: 'How do I make a link open in a new tab?', a: 'Markdown has no syntax for it. Add target="_blank" to the <a> tags afterwards; the links written here already carry rel="noopener noreferrer".' },
      { q: 'Can I use underscores for italics?', a: 'Not here: _a_ stays as typed. Single asterisks make italics, and __double underscores__ make bold after a space or at the start of a line.' },
      { q: 'How do I convert Markdown on the command line?', a: 'Pandoc does it with pandoc notes.md -o notes.html, and cmark gives the CommonMark reference output.' }
    ],
    runs: [
      /* GitHub-style notes: setext heading, nested list, pipe table; default Output: HTML fragment */
      { input: 'Release notes\n=============\n\n- Faster export\n  - PDF\n  - CSV\n\n| Plan | Price |\n|------|-------|\n| Pro | £9 |', check: [['stat:Headings', '0'], ['stat:Paragraphs', '2'], ['stat:Lists', '1']] },
      /* the mistakes: a two-space line break, indented code, a javascript: link */
      { input: 'Line one  \nLine two\n\n    indented code\n\n[x](javascript:void)', check: [['stat:Code blocks', '0'], ['output', 'javascript:']] },
      /* the FAQ: underscores and asterisks */
      { input: '_a_ and __b__ and *c*', check: [['output', '_a_']] }
    ]
  },

  '/developer/meta-tag-generator/': {
    whatTitle: 'What meta tags and Open Graph do',
    whatIs: [
      'Meta tags sit in a page’s head and describe it to software. The title and description feed the link and snippet in search results, though Google may rewrite both; the canonical link names the one address to index when several show the same page.',
      'Open Graph, introduced by Facebook in 2010, is the set of og: properties behind the card shown when a link is shared in Facebook, LinkedIn, WhatsApp or Slack. It requires og:title, og:type, og:image and og:url.'
    ],
    howItWorks: {
      text: 'The tags are built from the form in plain JavaScript on every keystroke.',
      points: [
        'Each value has &, <, > and " replaced by entities before it goes into a tag, so a quote in a title cannot end the attribute.',
        'You get the title, description and canonical link, seven og: properties with og:type fixed at website, and four twitter: tags using the summary_large_image card.',
        'Lengths count the characters you typed, before escaping: over 60 or 160 may be truncated, under 30 or 70 is quite short.',
        'URLs are copied exactly; nothing checks that they are absolute or that the image exists.'
      ]
    },
    worked: {
      text: 'For a joinery workshop, the title Ashworth Joinery | Bespoke Oak Staircases, Kitchens & Doors in York measures 67 — may be truncated, and in the tags its ampersand becomes Kitchens &amp; Doors. The description is labelled 78 — good. The share image was entered as /img/share.jpg and copied into both image tags as content="/img/share.jpg". That relative path is the real problem: Open Graph needs an absolute URL, so most previews will show no picture.'
    },
    uses: [
      ['Launching a landing page', 'Write the title, description and share card before a campaign link goes out.'],
      ['Fixing a link preview', 'Replace a missing or wrong image in the card a chat app shows.'],
      ['Hand-written sites', 'Add a complete head block to static pages with no CMS or SEO plugin.']
    ],
    mistakes: [
      'Expecting old shares to update. Platforms cache the card; Facebook’s Sharing Debugger and LinkedIn’s Post Inspector fetch it again.',
      'Pointing every page’s canonical at the home page, which asks search engines to drop the other pages.'
    ],
    faq: [
      { q: 'What is the difference between og:title and the title tag?', a: 'The title tag is what tabs and search results show; og:title is what a share card shows. This tool fills both from one field, so edit the copy to make them differ.' },
      { q: 'Do I need Twitter card tags if I have Open Graph?', a: 'Only twitter:card, for the large-image layout; X falls back to the og: title, description and image.' },
      { q: 'Why is my Open Graph image not showing?', a: 'Usually a relative or http-only URL, or a server that blocks the platform’s crawler.' }
    ],
    runs: [
      /* title, description, canonical https://ashworthjoinery.example/, share image /img/share.jpg, site Ashworth Joinery, locale en_GB */
      { fields: { title: 'Ashworth Joinery | Bespoke Oak Staircases, Kitchens & Doors in York', desc: 'Handmade oak staircases, kitchens and doors from our York workshop since 1998.', url: 'https://ashworthjoinery.example/', image: '/img/share.jpg', site: 'Ashworth Joinery' },
        check: [['stat:Title length', '67 — may be truncated'], ['stat:Description length', '78 — good'], ['output', 'Kitchens &amp; Doors'], ['output', 'content="/img/share.jpg"']] }
    ]
  },

  '/developer/regex-tester/': {
    term: 'a regular expression',
    whatIs: [
      'A regular expression is a pattern describing a set of strings: \\d{4} is four digits, [A-Z]+ one or more capitals, ^ the start of a line. The engine walks through the text looking for stretches that match, and can capture parts of each match in groups.',
      'Every language has its own dialect. This page uses the browser’s JavaScript engine, so a pattern that works here works unchanged in JavaScript and TypeScript code; Go’s RE2, by contrast, has no backreferences or lookaround, in exchange for guaranteed linear-time matching.'
    ],
    howItWorks: {
      text: 'Your pattern and flags go straight to the browser’s `RegExp` constructor, and a syntax error is shown in the engine’s own words.',
      points: [
        'Matches are collected with `exec` in a loop; without g in your flags it stops after the first.',
        'An empty match moves the search on one character, and the loop stops at 10,000 matches so it cannot freeze the page.',
        'Each match is listed with its index, counted from 0 in UTF-16 code units, and its numbered and named groups.',
        'Replace and Split call `String.replace` and `String.split`. The flags on offer are g, i, m and s, not y or u.'
      ]
    },
    worked: {
      text: 'An invoice line, Invoice 4471 due 03/11/2026, reminder 17/11/2026, final 01/12/2026, tested with (?<d>\\d{2})/(?<m>\\d{2})/(?<y>\\d{4}) gives Matches 3 and Capture groups 3, the first at index 17. In Replace view with $<y>-$<m>-$<d> it becomes Invoice 4471 due 2026-11-03, reminder 2026-11-17, final 2026-12-01. Set the flags to (none) and Matches replaced drops to 1: only the first date changes, as String.replace does in code.'
    },
    uses: [
      ['Form validation', 'Try a postcode or phone pattern against good and bad examples first.'],
      ['Cleaning data', 'Rewrite dates or collapse spaces across a pasted column.'],
      ['Log analysis', 'Pull IDs or error codes out of a log extract with a capture group.']
    ],
    mistakes: [
      'A pattern that can match nothing. \\d* matches an empty string at every position: on a1b22c333 it reports 7 matches, 4 of them empty. Use \\d+ instead.',
      'Leaving a dot unescaped. In example.com the dot matches any character, so exampleXcom matches too; write example\\.com.'
    ],
    faq: [
      { q: 'How do I match any character including a newline?', a: 'Use the s flag (gs in the list here), or [\\s\\S] where it is missing. By default the dot stops at line breaks.' },
      { q: 'What is the difference between greedy and lazy quantifiers?', a: 'Greedy .* takes as much as it can; lazy .*? as little. On <b>a</b><b>c</b>, <b>.*</b> gives 1 match covering both, <b>.*?</b> gives 2.' },
      { q: 'How do I make a regex case-insensitive?', a: 'Add the i flag (gi in the list); in JavaScript code, /pattern/i.' }
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
        'Allow all writes User-agent: * and Allow: / and ignores the exclusion list. Only Allow, with exclusions below turns each path into a Disallow line, adding a leading / where one is missing.',
        'Blocking AI crawlers adds a group with Disallow: / for each of seven agents: GPTBot, CCBot, Google-Extended, anthropic-ai, ClaudeBot, PerplexityBot and Bytespider.'
      ]
    },
    worked: {
      text: 'A shop wants its basket, internal search and sorted listings out of the crawl. Entering /basket/, search? and /*?sort= under the default policy gives Rules 1 and no Disallow line at all, because the list is used only with Allow, with exclusions below. With that policy and AI crawlers blocked, the file has Rules 11, Named agents 8 and 409 B, and search? is written as Disallow: /search?. The Allow: / line under the exclusions does not cancel them: /basket/ is the longer, more specific match.'
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
      { q: 'What happens if a site has no robots.txt?', a: 'A missing file (a 404) means everything may be crawled. A server error is different: RFC 9309 tells crawlers to assume a full disallow until it can be fetched.' },
      { q: 'Is there a size limit for robots.txt?', a: 'Crawlers must read at least the first 500 kibibytes under RFC 9309, and Google ignores anything beyond that.' }
    ],
    runs: [
      /* Default policy: Allow all crawlers, exclusions /basket/, search?, /*?sort=, default sitemap, AI crawlers allowed */
      { fields: { policy: 'allow', disallow: '/basket/\nsearch?\n/*?sort=' }, check: [['stat:Rules', '1']] },
      /* Default policy: Allow, with exclusions below; AI training crawlers: Block; Sitemap https://shop.example/sitemap.xml */
      { fields: { policy: 'custom', disallow: '/basket/\nsearch?\n/*?sort=', aibots: 'block', sitemap: 'https://shop.example/sitemap.xml' }, check: [['stat:Rules', '11'], ['stat:Named agents', '8'], ['stat:Size', '409 B'], ['output', 'Disallow: /search?']] }
    ]
  },

  '/developer/slug-generator/': {
    term: 'a URL slug',
    whatIs: [
      'A slug is the part of a URL that names one page in readable words, such as descale-a-kettle in /guides/descale-a-kettle/. The word comes from newspaper offices, where a slug was the short working name of a story in production.',
      'A URL can hold almost any character once it is percent-encoded, but a slug kept to lower-case ASCII letters, digits and hyphens survives being typed, printed and pasted into chat without turning into %C3%A9 sequences.'
    ],
    howItWorks: {
      text: 'Each line becomes one slug through a short chain of text replacements in the page.',
      points: [
        'Unicode normalisation, `normalize(\'NFD\')`, splits letters such as é into e plus an accent mark, and the marks are deleted.',
        'Straight apostrophes and backticks are removed, so don\'t becomes dont, and & becomes the word and.',
        'Every run of characters outside A–Z, a–z and 0–9 becomes one separator, and the ends are trimmed.',
        'Remove stop words drops 16 short words such as the, of and is, but only from titles longer than two words.'
      ]
    },
    worked: {
      text: 'Three titles show where accent stripping stops. Don’t Panic: The Guide to the Galaxy, typed with the curly apostrophe a word processor inserts, becomes don-t-panic-guide-galaxy with stop words removed: the curly mark counts as a gap, unlike a straight one. Łódź & Straße: Große Æsthetik becomes odz-stra-e-gro-e-sthetik, because Ł, ß and Æ are letters of their own rather than accented ones, so normalisation cannot reduce them and they are dropped. A Hindi headline gives an empty line, yet Slugs still says 3.'
    },
    uses: [
      ['Blog posts', 'Make the permalink from a title before publishing in a CMS that slugs badly.'],
      ['Product imports', 'Turn a batch of product names into URL paths for an import file.'],
      ['Heading anchors', 'Generate id values so a table of contents can link to each heading.']
    ],
    mistakes: [
      'Feeding it non-Latin titles. Greek, Cyrillic, Arabic and Devanagari letters are removed, not transliterated; write a Latin version of the title yourself.',
      'Putting the year in an evergreen slug. A path such as best-laptops-2026 must change next year, breaking links.',
      'Trusting symbols to survive. 50% Off £20 Deals ends in 50-off-20-deals, so reread the slug for meaning.'
    ],
    faq: [
      { q: 'Should slugs be lower-case?', a: 'Yes. Paths are case-sensitive on most servers, so /About and /about can be two pages or one can fail; lower case everywhere avoids both.' },
      { q: 'Is a slug the same as a permalink?', a: 'No. The permalink is the page’s full permanent URL; the slug is its last readable segment, which a CMS such as WordPress lets you edit separately.' },
      { q: 'What characters are allowed in a URL slug?', a: 'Any, once percent-encoded, but a–z, 0–9 and hyphens are the safe set, and all this tool writes by default.' }
    ],
    runs: [
      /* three titles, one per line (the curly apostrophe is U+2019), Stop words: Remove */
      { input: 'Don’t Panic: The Guide to the Galaxy\nहिंदी समाचार\nŁódź & Straße: Große Æsthetik', options: { stop: 'strip' }, check: [['output', 'don-t-panic-guide-galaxy'], ['output', 'odz-stra-e-gro-e-sthetik'], ['stat:Slugs', '3']] },
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
        'Decoding uses `decodeURIComponent` or `decodeURI`. Neither turns + into a space.',
        'A % without two hex digits after it, or bytes that are not valid UTF-8, stop decoding with an error. Input and Output are UTF-8 byte counts.'
      ]
    },
    worked: {
      text: 'A search link typed with a raw ampersand, https://shop.example/search?q=fish & chips&page=2, shows the trap in Full URL scope. It returns https://shop.example/search?q=fish%20&%20chips&page=2, 53 B from 49 B: the spaces are fixed, but the & inside the search term is kept, so the shop receives q as "fish " and a stray parameter. Encode only the value in Component scope, where fish & chips becomes fish%20%26%20chips, and build the link around it.'
    },
    uses: [
      ['Campaign links', 'Encode a campaign name containing spaces or & before adding it as utm_campaign.'],
      ['Return URLs', 'Put a whole address inside ?next= as one value, so its own ? and & stay inside it.'],
      ['Reading logs', 'Decode a request path from an access log to see what was really asked for.']
    ],
    mistakes: [
      'Expecting + to decode as a space. Decoding follows JavaScript’s decodeURIComponent, so q=fish+chips%20to%20go comes back as q=fish+chips to go; swap + for %20 first when the text came from a form.',
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
      { input: 'q=fish+chips%20to%20go', options: { dir: 'dec' }, check: [['output', 'q=fish+chips to go']] },
      { input: '100% sure', options: { dir: 'dec' }, check: [['error', 'Malformed percent-encoding']] },
      /* the FAQ, Component scope */
      { input: 'café ☕', check: [['output', 'caf%C3%A9%20%E2%98%95'], ['stat:Input', '9 B'], ['stat:Output', '21 B']] },
      { input: 'it\'s (really) *fine*!', check: [['output', '%20(really)%20'], ['output', '*'], ['output', '!']] }
    ]
  },

  '/developer/uuid-generator/': {
    term: 'a UUID',
    whatIs: [
      'A UUID, or GUID in Microsoft’s terms, is a 128-bit identifier written as hex digits in five hyphenated groups, 8-4-4-4-12. Separate systems can create them without asking a central counter for the next number.',
      'RFC 9562, which replaced RFC 4122 in 2024, defines the versions: 1 and 6 encode a timestamp, 3 and 5 hash a name, 7 leads with a Unix millisecond timestamp, and 4 is random apart from six bits marking the version and variant.'
    ],
    howItWorks: {
      text: 'Each ID comes from the browser’s `crypto.randomUUID()`, which draws on the operating system’s secure random source.',
      points: [
        'Where that is missing, 16 bytes from `crypto.getRandomValues` are used with the version and variant bits set by hand; the Source row names getRandomValues either way.',
        'Only if neither exists does it fall back to `Math.random`, which is not cryptographically secure; current browsers have both.',
        'No hyphens strips the hyphens, Uppercase raises a–f, and Braces wraps each ID in { } last.',
        'The count is held between 1 and 500 per click, one ID per line.'
      ]
    },
    worked: {
      text: 'Asking for 800 IDs with No hyphens returns Generated 500, the per-click maximum: 500 lines of bare hex digits, 16,499 characters with the line breaks. For a SQL Server script, Uppercase with Braces gives 500 lines such as {…} totalling 19,499 characters. Dropping the hyphens loses nothing, since they are only formatting, and most parsers accept the compact form.'
    },
    uses: [
      ['Test fixtures', 'Fill a seed file or mock response with IDs shaped like the real system’s.'],
      ['Idempotency keys', 'Attach a fresh UUID to a payment or webhook request so a retry is not processed twice.'],
      ['Offline records', 'Give records created on a phone IDs that will not clash when they sync.'],
      ['Correlation IDs', 'Tag a request so its log lines can be found across several services.']
    ],
    mistakes: [
      'Storing UUIDs as text. As a 36-character string one takes more than twice the 16 bytes of a native uuid column, and indexes grow to match.',
      'Comparing them case-sensitively. RFC 9562 writes lower case but readers must accept either; normalise before comparing strings.'
    ],
    faq: [
      { q: 'What is the difference between a UUID and a GUID?', a: 'None in practice. GUID is Microsoft’s name for the same format; .NET and SQL Server often show it in upper case and braces, which the options here reproduce.' },
      { q: 'How do I generate a UUID in JavaScript?', a: 'Call crypto.randomUUID() in any current browser, or through the crypto module in Node.js; it is the same call this page makes.' },
      { q: 'Is a UUID without hyphens still valid?', a: 'Most libraries and databases, PostgreSQL’s uuid type included, accept the 32-digit form, but the hyphenated layout is the canonical text form for interchange.' }
    ],
    runs: [
      /* How many: 800 (capped), Format: No hyphens; the IDs are random, only lengths and counts are quoted */
      { fields: { count: '800', braces: 'nodash' }, check: [['stat:Generated', '500'], ['outputLines', '500'], ['outputLength', '16,499']] },
      /* How many: 500, Case: Uppercase, Format: Braces */
      { fields: { count: '500', case: 'upper', braces: 'braces' }, check: [['outputLength', '19,499']] },
      /* one plain ID: 36 characters */
      { fields: { count: '1' }, check: [['outputLength', '36']] }
    ]
  },

  '/developer/xml-formatter/': {
    term: 'well-formed XML',
    whatIs: [
      'XML carries structured data in RSS feeds, sitemaps, SVG, Office files and many supplier and banking feeds. The W3C XML 1.0 rules are strict: one root element, tags closed in order, attribute values in quotes, and & and < in text written as entities.',
      'A document that keeps those rules is well-formed, and a conforming parser must stop at the first breach rather than repair it as browsers do with HTML.'
    ],
    howItWorks: {
      text: 'The check is a pattern scan of the tags, not a full XML parser, aimed at the commonest fault: tags that do not pair up.',
      points: [
        'A regular expression finds every start, end and self-closing tag, skipping the declaration, comments, CDATA and DOCTYPE.',
        'Start tags go on a stack; an end tag must match the top exactly, case included, or the pair is named.',
        'Attribute quoting, entities and the number of root elements are not checked.',
        'Formatting removes whitespace between tags and indents by depth; text followed by a child tag, as in <title>Teapot <b>new</b></title>, throws the indentation off by a level.'
      ]
    },
    worked: {
      text: 'This fragment, <menu><item>Fish & chips</item><item price=4.50>Mushy peas</item></menu><menu/>, passes with Tags balanced yes, Elements 4 and Max depth 2, yet a real XML parser rejects it three times over: the bare &, the unquoted attribute and the second root element. A case slip is caught: <order><Item>Tea</item></order> fails with "Mismatched tags: <Item> is closed by </item>." Read yes as "the tags pair up", and let xmllint or your importer have the final word.'
    },
    uses: [
      ['Supplier feeds', 'Indent a one-line product feed to find the record an import choked on.'],
      ['Sitemaps', 'Tidy sitemap.xml to read its url and lastmod entries.'],
      ['SOAP and payment messages', 'Lay out a SOAP response or an ISO 20022 payment file so it can be read.']
    ],
    mistakes: [
      'Using HTML entity names in XML. Only &amp;, &lt;, &gt;, &quot; and &apos; are predefined, so &nbsp; is an error unless a DTD defines it; write &#160; instead.',
      'Minifying mixed content. Whitespace between tags is removed, so <b>fish</b> <i>chips</i> becomes <b>fish</b><i>chips</i>.'
    ],
    faq: [
      { q: 'Does formatting change my data?', a: 'Only the whitespace between tags is replaced by line breaks and indentation. Text inside elements and attribute values are left alone.' },
      { q: 'How is XML different from HTML?', a: 'HTML has a fixed set of tags and forgiving browsers; XML lets each format define its own tags and refuses a document with an error.' },
      { q: 'What is the <?xml version="1.0"?> line at the top?', a: 'The XML declaration, giving the version and often the encoding. It is optional for UTF-8, must come first if present, and is kept in place here.' }
    ],
    runs: [
      /* default options (Formatted, 2 spaces) */
      { input: '<menu><item>Fish & chips</item><item price=4.50>Mushy peas</item></menu><menu/>', check: [['stat:Tags balanced', 'yes'], ['stat:Elements', '4'], ['stat:Max depth', '2']] },
      { input: '<order><Item>Tea</item></order>', check: [['error', 'Mismatched tags: <Item> is closed by </item>.']] },
      /* the mistake: Output Minified */
      { input: '<p><b>fish</b> <i>chips</i></p>', options: { mode: 'minify' }, check: [['output', '<b>fish</b><i>chips</i>']] },
      /* the FAQ: the declaration is kept */
      { input: '<?xml version="1.0"?>\n<feed><qty>3</qty></feed>', check: [['output', '<?xml version="1.0"?>']] }
    ]
  }
};
