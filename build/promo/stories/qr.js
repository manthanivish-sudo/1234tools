'use strict';
/* Kit v2 story data: QR Tools. Contract: kit2-schema.md, sections 1 and 2.
   Codes encode the data directly (no redirect service) and are decoded again
   before download; the scanner shows the real domain and never opens a link itself. */
module.exports = {
  '/qr/qr-code-generator/': {
    persona: 'Cafés, shops and event organisers',
    hook: 'Guests keep asking for the Wi-Fi password.',
    pain: 'You spell the Wi-Fi password out loud ten times a day, and half the time someone types it wrong.',
    usual: ['QR sites that route scans via their server', 'Codes that stop working after a trial', 'Codes nobody tested before printing'],
    promise: 'Type the link or Wi-Fi details. Get a QR that is scanned back first.',
    steps: ['Pick link, Wi-Fi or card', 'Style it, check it scans', 'Download SVG, PNG, PDF or EPS'],
    proof: ['Free', 'No sign-up', 'Codes never expire'],
    example: { kind: 'qr', text: 'WIFI:T:WPA;S:Harbour Cafe Guest;P:flatwhite2026;;' },
    howTo: 'How to make a QR code for your Wi-Fi',
    cta: 'Make a QR code'
  },
  '/qr/qr-code-scanner/': {
    persona: 'Anyone wary of a QR sticker',
    hook: 'Where does that car-park QR code really go?',
    pain: 'A sticker on the parking meter wants you to scan and pay. You would like to see the address first.',
    usual: ['Camera apps that open links straight away', 'Scanner apps stuffed with adverts', 'Typing a URL from a blurry photo'],
    promise: 'Scan with the camera or a photo. See the real domain before opening.',
    steps: ['Allow the camera or add photos', 'Point it at the code', 'Check the domain, then open'],
    proof: ['Free', 'No sign-up', 'Nothing uploaded'],
    example: {
      kind: 'schematic',
      input: 'A QR code from the camera, a photo or a screenshot',
      output: 'Its contents, and the real domain of any link',
      sampleIn: 'A QR sticker on a parking meter',
      sampleOut: 'Link to pay-parking.example — domain shown first; nothing opens until you choose'
    },
    howTo: 'How to check where a QR code goes',
    cta: 'Scan a code'
  },
  '/qr/qr-bulk-generator/': {
    persona: 'Event planners, shops and schools',
    hook: '300 badges need 300 different QR codes.',
    pain: 'Every badge, table or product label needs its own code. Making them one by one would take all week.',
    usual: ['Making codes one at a time', 'Bulk features kept for paid plans', 'Finding a dud code after printing'],
    promise: 'Paste a list or a CSV. Every code is scanned back, then zipped or laid out on labels.',
    steps: ['Paste the list or CSV', 'Set one style for all', 'Download a ZIP or label sheet'],
    proof: ['Free', 'Nothing uploaded', 'Every code checked'],
    example: {
      kind: 'schematic',
      input: 'A list or CSV of links, names or IDs',
      output: 'One checked QR code per row, in a ZIP',
      sampleIn: 'name,url · table-01,cafe.example/menu?t=1 · table-02,cafe.example/menu?t=2 …',
      sampleOut: 'table-01.png, table-02.png … each decoded again before it goes in the ZIP'
    },
    howTo: 'How to make QR codes in bulk from a CSV',
    cta: 'Make QR codes in bulk'
  }
};
