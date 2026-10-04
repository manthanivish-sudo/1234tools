/**
 * The reading part of the QR tools, rendered by build-depth.js in its
 * file-and-text shape (howItWorks in place of formula). Shape and rules:
 * build-depth.js and build/content/_check.js.
 *
 * The QR tools need a browser (canvas, file input, camera), so every run is
 * recorded as { browser: { … }, shown: [ … ] }: the page, what was typed or
 * uploaded, what was set, and the figures it showed. The runs were made in
 * headless Chrome on 4 October 2026 against a local server of the site on
 * port 8746 (build/tests/serve.js), driving the page as a person would:
 * setting the fields and selects by their ids (#qr-type, #f-url, #qr-ec,
 * #qr-size, #qr-values) and firing input/change events, pressing the buttons,
 * and reading the .stat-row figures, the verdict line and the scanner's result
 * card. That Chrome had no BarcodeDetector, so every scan here was made by the
 * site's own reader (engine/qr-detect.js with the decoder in qr.bundle.js).
 */
'use strict';

module.exports = {
  '/qr/qr-code-generator/': {
    term: 'a QR code',
    whatIs: [
      'A QR code is a grid of dark and light modules defined by ISO/IEC 18004. Its version sets the size, from 21 × 21 modules at version 1 to 177 × 177 at version 40, four more a side each step.',
      'Reed-Solomon error correction restores about 7%, 15%, 25% or 30% of the data at levels L, M, Q and H. At level L, version 40 holds 7,089 digits but only 4,296 upper-case characters.'
    ],
    howItWorks: {
      text: 'The site’s own encoder, engine/qr.bundle.js, builds the code from the standard without a library.',
      points: [
        'A cheapest-path search splits the text into numeric, alphanumeric and byte segments; byte mode writes UTF-8.',
        'The smallest version that fits the chosen level is used, and each data block gets Reed-Solomon codewords over GF(256) before the blocks are interleaved.',
        'All eight masks are scored with the standard’s four penalty rules, and the lowest wins.',
        'The SVG is decoded by the scanner’s own reader at 10 and then 4 pixels a module; only both passes earn Verified. The PNG is the SVG redrawn with `toBlob`.'
      ]
    },
    worked: {
      text: 'A table card links to https://www.example.com/spring-menu?utm_source=table-card&utm_medium=qr, 71 characters. At level M that is version 5, 37 x 37 modules, with a smallest safe print of 23 mm wide. At level H, for a card that will meet spilt coffee, it needs 49 x 49 modules, printed at least 29 mm wide. Drop the tracking tail and level H fits back into 37 x 37 modules at 23 mm wide: the tracking cost the room the stronger correction needed. All three were Verified, each PNG 600 x 600 px.'
    },
    uses: [
      ['Business cards', 'Put a vCard on the back so a contact saves in one scan.'],
      ['UPI payments', 'Print a code with your VPA and payee name.'],
      ['Event posters', 'Add a calendar-event code so passers-by save the date.']
    ],
    mistakes: [
      'Printing light on dark. This site’s scanner reads it, but many phone cameras do not, so only a dark-on-light code earns Verified.',
      'Changing the destination after printing. The address is in the code, so use a URL on your own domain that you can redirect.'
    ],
    faq: [
      { q: 'Why does upper-case text make a smaller QR code?', a: 'Capitals, digits, space and eight symbols pack two characters to 11 bits, so HTTPS://MENU.EXAMPLE.COM/TABLE/12 fits version 2 at level M, while in lower case it needs version 3. Paths can be case-sensitive, so test it.' },
      { q: 'What is the mask pattern number?', a: 'It names which of eight patterns was laid over the data to break up solid blocks. The encoder keeps the lowest-penalty one; it says nothing about quality.' },
      { q: 'Can a QR code hold emoji?', a: 'Yes, as UTF-8 in byte mode, at 4 bytes for most emoji.' }
    ],
    runs: [
      /* /qr/qr-code-generator/: #qr-type = url, #f-url = the long UTM link, #qr-ec = M (PNG size 600, quiet zone 4, square shapes: the defaults); stats and verdict read once the read-back finished ("Version: 5 (37 x 37 modules)", "Content length: 71 characters", "Smallest safe print: 23 mm wide", "Verified: this exact image was scanned and read back correctly"); Download PNG saved utm-M.png */
      { browser: { page: '/qr/qr-code-generator/', type: 'url', url: 'https://www.example.com/spring-menu?utm_source=table-card&utm_medium=qr', ec: 'M', pngSize: 600, quiet: 4 }, shown: ['71 characters', '37 x 37 modules', '23 mm wide', 'Verified', '600 x 600 px'] },
      /* the same link, #qr-ec = H ("Version: 8 (49 x 49 modules)", "29 mm wide"); PNG saved as utm-H.png */
      { browser: { page: '/qr/qr-code-generator/', type: 'url', url: 'https://www.example.com/spring-menu?utm_source=table-card&utm_medium=qr', ec: 'H', pngSize: 600, quiet: 4 }, shown: ['49 x 49 modules', '29 mm wide', 'Verified'] },
      /* the link without its tracking tail, #qr-ec = H ("Version: 5 (37 x 37 modules)", "Encoding: byte x35") */
      { browser: { page: '/qr/qr-code-generator/', type: 'url', url: 'https://www.example.com/spring-menu', ec: 'H', pngSize: 600, quiet: 4 }, shown: ['37 x 37 modules', '23 mm wide', 'Verified'] },
      /* the FAQ: the same short address in capitals and in lower case, #qr-ec = M; the page showed "Version: 2 (25 x 25 modules)", "Encoding: alphanumeric x33" and "Version: 3 (29 x 29 modules)", "Encoding: byte x33" */
      { browser: { page: '/qr/qr-code-generator/', type: 'url', url: 'HTTPS://MENU.EXAMPLE.COM/TABLE/12', ec: 'M' }, shown: ['version 2'] },
      { browser: { page: '/qr/qr-code-generator/', type: 'url', url: 'https://menu.example.com/table/12', ec: 'M' }, shown: ['version 3'] }
    ]
  },

  '/qr/qr-code-scanner/': {
    whatTitle: 'What a QR scanner has to do',
    whatIs: [
      'Reading a QR code is the encoder run backwards. The reader finds the three finder patterns, whose runs measure 1:1:3:1:1 at any angle, estimates the version from their spacing, maps the grid with a perspective transform and samples one bit per module.',
      'It then reads the format bits, removes the mask, collects the codewords and lets Reed-Solomon repair the damage. The result is plain text, judged by its prefix: https:, WIFI: or BEGIN:VCARD.'
    ],
    howItWorks: {
      text: 'If the browser offers `BarcodeDetector` for QR codes it looks first; otherwise the site’s own reader, engine/qr-detect.js, does the work.',
      points: [
        'The camera opens through `getUserMedia`, asking for the rear camera at up to 1920 × 1080, with autofocus and a torch where available.',
        'About every 80 milliseconds a frame is read, alternating between the whole frame at 800 pixels and its central 62% in detail.',
        'Each 8 × 8 block of grey levels is thresholded against its neighbours; a failed read retries after a blur, and the grid is also tried transposed, for mirrored codes.',
        'A picture that gives nothing is read again with its grey levels flipped, for light-on-dark codes; the camera flips every third frame.',
        'After a read the camera stops, and a link’s headline is its `URL.hostname`; nothing opens until you press the button.'
      ]
    },
    worked: {
      text: 'A code for https://www.example.com@login.example.net/pay, made on the generator (version 4), was chosen as a PNG in the picture area. The headline read login.example.net: everything before the @ is a user name. With a white square 90 pixels wide painted over the 600-pixel image it still read, with 8 damaged codewords repaired, and a mirrored copy read too, marked mirrored. A colour-inverted copy, white on black, read as well, marked light on dark.'
    },
    uses: [
      ['Proof checks', 'Read a printer’s proof before ordering 500 copies.'],
      ['Wi-Fi from a screenshot', 'Read the password out of a code someone sent as an image.'],
      ['Worn signage', 'See whether a scuffed code still reads, and how much needed repair.']
    ],
    mistakes: [
      'Taking a dark-mode screenshot as proof a code works. This reader flips it, but many phone cameras cannot.',
      'Judging a link by how it starts. Read the Goes to line: it is the host the browser will visit.'
    ],
    faq: [
      { q: 'Can I scan a QR code from a screenshot?', a: 'Yes. Choose it in the picture area below the camera, or paste it on a computer.' },
      { q: 'Why does a code from Japan show garbled text?', a: 'The site’s own reader decodes byte-mode data as UTF-8 and ignores character-set markers, so Shift JIS text is garbled; Kanji mode is not read at all.' },
      { q: 'Does it read ordinary barcodes too?', a: 'No. It asks only for QR codes, so EAN product barcodes are ignored.' }
    ],
    runs: [
      /* /qr/qr-code-generator/: #qr-type = url, #f-url = https://www.example.com@login.example.net/pay, #qr-ec = M, PNG 600 px ("Version: 4 (33 x 33 modules)", mask 7, Verified); Download PNG saved trick-M.png */
      { browser: { page: '/qr/qr-code-generator/', type: 'url', url: 'https://www.example.com@login.example.net/pay', ec: 'M', pngSize: 600 }, shown: ['version 4'] },
      /* /qr/qr-code-scanner/: trick-M.png set on the .scan-drop file input (no camera); result card: "Website address · from your picture", headline and "Goes to: login.example.net", meta "Version 4 · level M · mask 7" */
      { browser: { page: '/qr/qr-code-scanner/', file: 'trick-M.png (the 600 x 600 PNG from the run above)', barcodeDetector: false }, shown: ['login.example.net'] },
      /* the same PNG with a white 90 x 90 px square drawn on a canvas, centred at 60% across and 60% down of the 600 px image (15% of its side), then uploaded; meta "Version 4 · level M · mask 7 · 8 damaged codewords repaired" */
      { browser: { page: '/qr/qr-code-scanner/', file: 'trick-M.png with a white 90 px square centred at (360, 360) of 600 px', barcodeDetector: false }, shown: ['8 damaged codewords repaired'] },
      /* the same PNG drawn mirrored left to right on a canvas (translate(width, 0), scale(-1, 1)), then uploaded; meta ends "· mirrored" */
      { browser: { page: '/qr/qr-code-scanner/', file: 'trick-M.png mirrored left to right', barcodeDetector: false }, shown: ['mirrored'] },
      /* the same PNG drawn through ctx.filter = 'invert(1)', then uploaded (re-run after the inverted-read fix); result card "Goes to: login.example.net", meta "Version 4 · level M · mask 7 · light on dark" */
      { browser: { page: '/qr/qr-code-scanner/', file: 'trick-M.png colour-inverted', barcodeDetector: false }, shown: ['light on dark'] }
    ]
  },

  '/qr/qr-bulk-generator/': {
    whatTitle: 'What a batch of QR codes involves',
    whatIs: [
      'A batch turns one list into many codes that share a look but carry different data. Each row is encoded on its own, so each code gets the version its content needs, even when all are printed at one size.',
      'Format matters as much as length: a vCard spells out a field name on every line, while a MeCard packs name, phone and email into one.'
    ],
    howItWorks: {
      text: 'The page parses the list, maps its columns and encodes each row with the single generator’s encoder and style controls.',
      points: [
        'Tabs, commas or semicolons are detected from the first 20 lines, and quoted fields are handled.',
        'A first row is a header when at least half its cells name a field or a file-name column (name, label, filename, id, ref). One-field types without a header are read line by line, so commas in a URL survive.',
        'Each of up to 500 codes is decoded from its SVG at 10 and 4 pixels a module, then again on download from the exact PNG or SVG bytes, before the site’s ZIP writer stores it uncompressed.'
      ]
    },
    worked: {
      text: 'A dental practice pastes three staff rows as contact cards under a header line, with an address for the practice manager only, at level M and 300 px PNG. The files are named amara-osei, tom-reid and lina-haddad, and all three verify. The address makes the longest content 271 characters, so versions run 9 to 12 and the smallest safe print is 37 mm wide; at level H, 13 to 17 and 47 mm wide. As MeCards with name, phone and email only, the same people need versions 4 to 5, at most 69 characters, and 23 mm wide.'
    },
    uses: [
      ['Conference badges', 'Give each delegate a contact card from the registration export.'],
      ['Asset tags', 'Print a code for every laptop or tool ID in an inventory sheet.'],
      ['School kits', 'Label library books or classroom kits with their catalogue numbers.']
    ],
    mistakes: [
      'Pasting contact cards without a header. Columns then follow field order, so a name, phone, email list puts the phone number in the last-name field.',
      'Mixing content types. The type applies to every row, so links and contact cards need separate runs.'
    ],
    faq: [
      { q: 'Can I make QR codes from an Excel file?', a: 'Paste the copied cells, which arrive as tab-separated text, or save the sheet as CSV; .xlsx files are not read.' },
      { q: 'How do I number QR codes in sequence?', a: 'Fill ASSET-001 to ASSET-250 down a spreadsheet column and paste it; the tool encodes rows as given.' },
      { q: 'Why is the ZIP hardly smaller than the files?', a: 'The site’s ZIP writer stores files uncompressed, because PNG data is already compressed.' }
    ],
    runs: [
      /* /qr/qr-bulk-generator/: #qr-type = vcard, #qr-ec = M, #qr-size = 300; #qr-values = the four lines below; Generate codes pressed; read once the summary stopped being busy ("3 of 3 checked · 3 verified", "Version: 9 to 12", "Longest content: 271 characters", "Smallest safe print: 37 mm wide"); Download PNG (ZIP) pressed: "All 3 files were decoded again from the exact bytes in the archive before it was built.", ZIP held amara-osei.png, tom-reid.png, lina-haddad.png */
      { browser: { page: '/qr/qr-bulk-generator/', type: 'vcard', ec: 'M', pngSize: 300, list: 'first,last,org,title,phone,email,site,street,city,zip,country\nAmara,Osei,Northgate Dental,Practice Manager,+447700900301,amara@northgate.example,https://northgate.example,14 Station Road,Leeds,LS1 4AB,United Kingdom\nTom,Reid,Northgate Dental,Dentist,+447700900302,tom@northgate.example,,,,,\nLina,Haddad,Northgate Dental,Hygienist,+447700900303,lina@northgate.example,,,,,' }, shown: ['amara-osei', 'tom-reid', 'lina-haddad', '271 characters', '9 to 12', '37 mm wide'] },
      /* the same list, #qr-ec = H ("Version: 13 to 17", "Smallest safe print: 47 mm wide", all 3 verified) */
      { browser: { page: '/qr/qr-bulk-generator/', type: 'vcard', ec: 'H', pngSize: 300, list: 'the vCard list above' }, shown: ['13 to 17', '47 mm wide'] },
      /* the same three people as MeCards, #qr-type = mecard, #qr-ec = M, #qr-size = 300 ("Version: 4 to 5", "Longest content: 69 characters", "Smallest safe print: 23 mm wide") */
      { browser: { page: '/qr/qr-bulk-generator/', type: 'mecard', ec: 'M', pngSize: 300, list: 'name,phone,email\nAmara Osei,+447700900301,amara@northgate.example\nTom Reid,+447700900302,tom@northgate.example\nLina Haddad,+447700900303,lina@northgate.example' }, shown: ['4 to 5', '69 characters', '23 mm wide'] }
    ]
  }
};
