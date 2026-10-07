'use strict';
/* Stories for the developer tools added in wave 6 (see stories/index.js for the shape). */
module.exports = {
  '/developer/unix-timestamp/': {
    persona: 'Developers reading logs and databases',
    hook: '1792888200. Was that before or after the clocks went back?',
    pain: 'The log says 1792888200, the database says 1792888200000 and the ticket says 01:30 London time. You need them on one clock.',
    usual: ['Pasting stamps one at a time into a converter', 'Guessing whether a number is seconds or milliseconds', 'Forgetting summer time'],
    promise: 'Paste a column of timestamps or dates. Get every one in UTC and your time zone, with summer time handled.',
    steps: ['Paste timestamps or dates, one per line', 'Pick the time zone', 'Copy the converted column'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: '1791374400\n1791374400123\n2026-10-25 01:30\n[07/Oct/2026:12:00:00 +0000]' },
    howTo: 'How to convert a Unix timestamp to a date',
    cta: 'Convert timestamps'
  },
  '/developer/sql-formatter/': {
    persona: 'Developers and analysts reviewing SQL',
    hook: 'A 400-character query on one line, copied from a slow-query log.',
    pain: 'The query from the log is one long line. You cannot see where the join ends and the filter starts.',
    usual: ['Adding line breaks by hand', 'An editor plugin that does not know your dialect', 'Online formatters that send the query to a server'],
    promise: 'Paste SQL. Get it laid out clause by clause, or minified to one line, with strings and names untouched.',
    steps: ['Paste the SQL', 'Pick the dialect', 'Copy the formatted query'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: "select o.id, sum(l.qty * l.price) as total from orders o join lines l on l.order_id = o.id where o.placed_at >= '2026-01-01' group by o.id having sum(l.qty * l.price) > 500;" },
    howTo: 'How to format an SQL query',
    cta: 'Format SQL'
  },
  '/developer/code-minifier/': {
    persona: 'People running a small site without a build step',
    hook: 'Half your stylesheet is comments and indentation.',
    pain: 'Your hand-written CSS and JavaScript go out exactly as you typed them, comments and all.',
    usual: ['Setting up a bundler for three files', 'Deleting comments by hand', 'Online minifiers that rewrite code you cannot check'],
    promise: 'Paste JavaScript, CSS or HTML. Get it smaller, with every name and statement as you wrote it.',
    steps: ['Paste or open the file', 'Check the sizes before and after', 'Download the .min file'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: '.card {\n  color: #ffffff;\n  margin: 0.5rem 0px;\n  /* spacing */\n  padding: 0 0 0 0;\n}\n.empty { }\n' },
    howTo: 'How to minify JavaScript, CSS and HTML',
    cta: 'Minify code'
  },
  '/developer/code-beautifier/': {
    persona: 'Developers reading someone else’s code',
    hook: 'A vendor script, 40,000 characters, one line.',
    pain: 'The bug is somewhere in a minified script and you cannot read a single statement of it.',
    usual: ['Scrolling sideways through one line', 'Browser dev tools you cannot copy from easily', 'Reformatting by hand'],
    promise: 'Paste minified JavaScript, CSS or HTML. Get it indented and readable, still working exactly the same.',
    steps: ['Paste the code', 'Pick the indent', 'Copy or download the result'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: 'if(a){b()}else{c()}const x={k:1,v:[1,2]};' },
    howTo: 'How to beautify minified JavaScript',
    cta: 'Beautify code'
  },
  '/developer/yaml-json/': {
    persona: 'Developers working with config files',
    hook: 'country: NO. Is that Norway, or false?',
    pain: 'Your compose file uses anchors and merge keys, and you need to know what the program actually reads.',
    usual: ['Writing a script just to convert one file', 'Online converters that drop anchors', 'YAML 1.1 surprises: no becomes false'],
    promise: 'Paste YAML or JSON. Get the other, with anchors expanded, errors by line and every number exact.',
    steps: ['Paste YAML or JSON', 'Check the warnings', 'Copy or download the result'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: 'base: &base\n  image: node:22\n  retries: 2\ntest:\n  <<: *base\n  retries: 5\ncountry: NO\n' },
    howTo: 'How to convert YAML to JSON',
    cta: 'Convert YAML'
  },
  '/developer/barcode-generator/': {
    persona: 'Shops, warehouses and makers labelling stock',
    hook: '200 products, no barcodes, and a label printer waiting.',
    pain: 'Your supplier sent products without barcodes, and you need EAN-13 labels that scan at the till.',
    usual: ['Generators that make one code at a time', 'Images at the wrong print size', 'A typo in the number nobody notices'],
    promise: 'Paste your numbers, one per line. Get checked barcodes as SVG, PNG or a PDF sheet of labels at true size.',
    steps: ['Paste the numbers', 'Pick the barcode type and size', 'Download the PDF sheet or a ZIP'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: '501234567890\n4006381333931\n9781234567897' },
    howTo: 'How to make EAN-13 barcodes',
    cta: 'Make barcodes'
  },
  '/developer/color-contrast-checker/': {
    persona: 'Designers and front-end developers',
    hook: 'Grey #777 on white: 4.47:1. Body text needs 4.5.',
    pain: 'The design looks fine on your screen, but an accessibility audit says the grey text fails.',
    usual: ['Checking one pair at a time', 'Rounding 4.47 up to 4.5 and hoping', 'Guessing a darker shade until it passes'],
    promise: 'Enter two colours, or a whole list. See the WCAG result, the pair on real text, and the nearest colours that pass.',
    steps: ['Enter the text and background colours', 'Read the AA and AAA results', 'Take a suggested colour that passes'],
    proof: ['Free', 'Nothing uploaded', 'Runs in your browser'],
    example: { kind: 'text', input: '#777777 on #ffffff\n#595959 on #ffffff\n#f7c948 on #ffffff' },
    howTo: 'How to check colour contrast for WCAG',
    cta: 'Check contrast'
  }
};
