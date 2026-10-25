'use strict';
/** Site profile: XLePOS, the in-store till for XLeShop merchants. Read from E:/projects/XLeShop/xlepos (read-only) on 2026-10-25:
 *  README.md, CLAUDE.md, docs/product/AUTHORING.md section 2 (the P0 pilot paragraph), HARDWARE.md, PAYMENTS.md, SUPPORT_CARD.md,
 *  requirements/M04, M05, M07, M11, M14, docs/counter/DESIGN_SYSTEM.md section 1, brand/xlepos/palette.json, and the feature
 *  commit log (E:/tmp/wave-sites-in/xlepos-feats.txt, newest 2026-10-05).
 *  XLePOS is in a PILOT (a practice period, about two months from October 2026). It is not on sale and has no public page or site:
 *  xleshop.com does not offer it. The angle is building in public, so every item says it is being piloted, and the call to
 *  action is to ask XLeShop or follow the build. Item paths are /contact.html on xleshop.com. */
module.exports = {
  id: 'xlepos',
  name: 'XLePOS',
  baseUrl: 'https://xleshop.com',
  domainSource: 'XLePOS has no site of its own. xleshop.com (canonical tags in xleshop/public/*.html) is the nearest public page, so items point at /contact.html where people can ask XLeShop about XLePOS',
  repo: 'E:/projects/XLeShop/xlepos',
  kind: 'app',
  promotes: 'pilot features',
  utm: { medium: 'social' },
  brandWords: ['XLePOS', 'XLeShop'],
  colours: { primary: '#004EEF', accent: '#FD7401', background: '#FFFFFF', ink: '#000417' },
  colourSource: 'xlepos/brand/xlepos/palette.json: xleposBlue #004EEF (primary brand colour), xleposOrange #FD7401 (secondary), darkNavy #000417 (the master\'s background); white is the Day theme background (docs/counter/DESIGN_SYSTEM.md, Day is the pilot theme)',
  logo: 'E:/projects/XLeShop/xlepos/brand/xlepos/icon-512.png',
  audiences: ['smallbiz', 'india', 'uk'],
  regions: ['india', 'uk'],
  rules: {
    free: false,
    freePhrases: [],
    browserClaims: false,
    forbid: [
      { rule: 'no-prices', re: '₹|£|\\$|\\bper (month|year|till|store)\\b|\\ba (month|year)\\b|\\bfree trial\\b|\\bpricing\\b|\\bprices?\\b|\\bplans?\\b|\\bcosts?\\b', msg: 'XLePOS has no price or plan: it is in a pilot and not on sale. Say nothing about cost.' },
      { rule: 'no-availability', re: '\\b(available|live) (now|today|to buy)\\b|\\bbuy now\\b|\\bsign[- ]?up\\b|\\bdownload\\b|\\bget it today\\b|\\blaunch(ing)? (date|on|in)\\b|\\bon sale\\b|\\bnow open\\b|\\bpre-?order\\b|\\bgo(es)? live\\b|\\border (it|yours) now\\b', msg: 'XLePOS is in a pilot and is not on sale, so do not say it is available, launching, or downloadable. Use "being piloted" and "ask XLeShop about XLePOS".' },
      { rule: 'no-pilot-shop-names', re: 'south\\s?basket|rap\\s?club|rapclub', msg: 'The two pilot shops have not given permission to be named. Say "pilot shops" only.' },
      { rule: 'no-compliance', re: '\\b(compliant|certified|certification|approved|accredited|e-?invoic\\w*|gst[- ]ready|legally compliant)\\b', msg: 'The GST engine\'s fixtures are not yet signed off by a chartered accountant, so make no compliance, certification or approval claim (no "GST-compliant"). Say "a GST engine with an India rule pack".' },
      { rule: 'no-app-store', re: '\\bapp store\\b|\\bplay store\\b|\\bgoogle play\\b|\\bapple\\b|\\bios app\\b', msg: 'XLePOS is a web app (a PWA) that installs from Chrome. It is not in any app store. A Play Store wrapper is only an idea for later.' },
      { rule: 'no-store-counts', re: '\\b(one|two|three|both|\\d+)\\s+(pilot\\s+|live\\s+|indian\\s+)?(stores?|shops?|tills?|merchants?|retailers?|businesses)\\b', msg: 'No store, shop or till counts. Say "pilot shops" without a number.' },
      { rule: 'no-any-hardware', re: '\\b(any|all|every|most)\\s+(receipt |thermal |usb |bluetooth |label )?(printers?|scanners?|barcode scanners?|tablets?|devices?|card terminals?|cash drawers?)\\b|\\bplug and play\\b|\\bworks? with (any|all|every)', msg: 'Only what docs/product/HARDWARE.md lists: Chrome on an Android tablet, an 80 mm ESC/POS thermal printer over USB or Bluetooth Classic, a keyboard-wedge scanner, a drawer on the printer. It is not tested on real hardware yet ("Lab"), so never say it works with any printer or scanner.' },
      { rule: 'no-absolutes', re: '\\bnever (loses?|lose|lost|miss(es)?|drops?)\\b|\\b(can\'?t|cannot|won\'?t|will not|doesn\'?t) (ever )?lose\\b|\\bzero (lost|data loss)\\b|\\bno (sale|sales|data) (is |are |will be )?(ever )?lost\\b|\\bnever fails?\\b|\\bnever goes? down\\b|\\bfoolproof\\b', msg: 'Do not promise that no sale is ever lost. Say it is "designed to keep selling offline" and that the sale is saved on the tablet first.' },
      { rule: 'no-measured-speed', re: '\\bin (two|2|a couple of) seconds\\b|\\b(two|2)[- ]second sale (is|takes|in)\\b|\\bfaster than\\b|\\bfastest\\b', msg: 'The two-second sale is a design goal that has not been measured. Write "designed for a two-second sale", never "a sale in two seconds" or a comparison.' },
      { rule: 'no-not-built', re: '\\b(loyalty|vouchers?|khata|gift cards?|label[- ]printing scales?|card terminals?|dynamic upi|upi qr|multi-?store|multi-?branch|ipad|ios|windows|electron)\\b', msg: 'Loyalty, vouchers, khata, gift cards, integrated card terminals, dynamic UPI QR, label-printing scales, Windows and iPad are planned (P1 or P2) and not built. Do not promote them.' }
    ],
    notes: [
      'XLePOS is a pilot: a practice period of about two months from October 2026, with real pilot shops but no public launch. It is not on sale, has no price, no public page and no sign-up. The only route is to ask XLeShop (xleshop.com/contact.html).',
      'Tell the story as building in public: what has been built, what is being tried, and what is not built yet. Say "being piloted" in every post.',
      'Never name the pilot shops. Say "pilot shops". Do not count them.',
      'It is "designed for" a two-second sale and "designed to keep selling offline". Those are design goals from docs/counter/DESIGN_SYSTEM.md, not measured results.',
      'Hardware: say only what HARDWARE.md says (Chrome on an Android tablet, an 80 mm thermal ESC/POS printer over USB or Bluetooth Classic, a keyboard-wedge scanner, a drawer plugged into the printer). The document marks real-hardware tests as "Lab": not yet tested.',
      'Payments in the pilot are cash, plus card and UPI recorded by hand. XLePOS holds no funds and sees no card data (docs/product/PAYMENTS.md). Do not say it takes card or UPI payments itself.',
      'The GST engine has an India rule pack. Its fixtures are not yet signed by a chartered accountant (commit 2026-10-02: "unsigned CA fixtures"), so make no compliance claim.'
    ]
  },
  items: [
    {
      id: 'till-sign-in-and-manager-mode',
      path: '/contact.html',
      title: 'Till enrolment, staff PINs and manager mode',
      group: 'sign-in',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Every cashier signs in with their own PIN, and the till locks when they step away. Being piloted now.',
      pain: 'Everyone at my counter uses the same login, so I never know who rang up a discount or voided a sale.',
      usual: ['One shared login for the whole counter', 'Asking staff who gave the discount'],
      promise: 'XLePOS, now in a pilot, gives each till an enrolment code and each cashier a PIN, with a lock screen and a manager mode for discounts and voids.',
      steps: ['The owner adds a till in the back office and gets a code', 'The code enrols the tablet as a till', 'Staff sign in with their PIN; a manager PIN unlocks manager mode'],
      cta: 'Ask XLeShop about XLePOS',
      facts: [
        'The owner gets an enrolment code in the back office: Tills, Add a till. The 8 characters are typed into the till (docs/product/SUPPORT_CARD.md)',
        'Staff sign in with a PIN, and the till can be locked (commit log: "till enrolment, PIN sign-in, lock, manager mode")',
        'Voids, discounts over a threshold and refunds without a receipt need a supervisor PIN, and every one is written to the audit ledger (docs/counter/DESIGN_SYSTEM.md, principle 6)',
        'A manager\'s PIN and manager mode need an internet connection (SUPPORT_CARD.md: "Needs a connection")',
        'In a pilot now. Not on sale.'
      ],
      source: 'xlepos/docs/product/SUPPORT_CARD.md; xlepos/docs/counter/DESIGN_SYSTEM.md section 1; xlepos/docs/product/requirements/M03-identity.md'
    },
    {
      id: 'offline-first-till',
      path: '/contact.html',
      title: 'A till designed to keep selling offline',
      group: 'offline',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'When the internet drops, the counter should keep selling. That is the design, and it is being piloted.',
      pain: 'The Wi-Fi goes down at the busiest hour and the queue stops.',
      usual: ['Writing sales on paper until the internet returns', 'Waiting for the router to restart'],
      promise: 'XLePOS saves every sale on the tablet first and sends it up when the internet is back, and the pilot is where that design gets tested.',
      steps: ['The sale is saved on the tablet first', 'A small badge shows the till is offline, and selling carries on', 'Sales go up by themselves when the internet returns'],
      cta: 'Follow the XLePOS pilot with XLeShop',
      facts: [
        '"The till saves every sale on the tablet first, even with no internet and no printer. Keep selling." (docs/product/SUPPORT_CARD.md)',
        'Offline: "Sales wait on the tablet and go up by themselves when the internet is back" (SUPPORT_CARD.md)',
        'Every state change is an event appended to the local log and then synced (xlepos/CLAUDE.md, non-negotiable 3)',
        '"Offline is a state, not an error. The only thing that changes offline is a small badge." (docs/counter/DESIGN_SYSTEM.md, principle 2: a design goal)',
        'A rule for staff: never clear Chrome\'s data or reset the tablet, because sales not yet sent are only on that tablet (SUPPORT_CARD.md)'
      ],
      source: 'xlepos/docs/product/SUPPORT_CARD.md; xlepos/CLAUDE.md; xlepos/docs/counter/DESIGN_SYSTEM.md section 1'
    },
    {
      id: 'gst-invoices-numbered-on-the-till',
      path: '/contact.html',
      title: 'GST invoices numbered on the device',
      group: 'tax',
      audiences: ['smallbiz', 'india', 'accountants'],
      hook: 'The invoice number is issued on the till itself, so it is final when printed, even offline. In a pilot.',
      pain: 'When the internet is down I cannot be sure my bill numbers will stay in order.',
      usual: ['Pre-printed bill books', 'Fixing the numbering at the end of the day'],
      promise: 'XLePOS has a GST engine with an India rule pack, and each register issues its own invoice numbers on the device, online or offline.',
      steps: ['The basket is priced and taxed by the GST engine', 'The register issues the next number in its own series', 'The number is final when printed, online or offline'],
      cta: 'Ask XLeShop about XLePOS',
      facts: [
        'Invoice and credit-note numbers are assigned on the device, from a per-register series and document type, at most 16 characters; they are final when printed, online or offline (xlepos/CLAUDE.md, non-negotiable 4)',
        'The server records each series\' high-water mark to check for gaps and never renumbers (CLAUDE.md)',
        'Tax is computed in one place, in whole paise or pence, never floats (CLAUDE.md, non-negotiables 1 and 2)',
        'Commit log: "GST engine, India rule pack"',
        'Every refund issues its own tax document (requirements/M07, M07-004)'
      ],
      source: 'xlepos/CLAUDE.md; xlepos/docs/product/requirements/M14-accounts-compliance.md; xlepos/docs/product/requirements/M07-returns-exchanges.md'
    },
    {
      id: 'receipts-and-cash-drawer',
      path: '/contact.html',
      title: 'Receipts, cash drawer and customer screen from Chrome',
      group: 'hardware',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Print a receipt and open the drawer straight from Chrome on a tablet. Being piloted.',
      pain: 'A counter system that needs special software on each counter machine is a headache for a small shop.',
      usual: ['Installing drivers one machine at a time', 'Handwritten bills'],
      promise: 'XLePOS prints ESC/POS receipts from Chrome over USB or Serial, opens the cash drawer through the printer, and can turn the screen to the customer.',
      steps: ['Plug in an 80 mm thermal receipt printer', 'The sale is saved first; the receipt prints and the drawer opens', 'Flip the screen to the customer'],
      cta: 'Ask XLeShop about XLePOS',
      facts: [
        'Receipts print from Chrome over WebUSB and Web Serial using ESC/POS (commit log: "the Device Hub: WebUSB and Web Serial printers, drawer, status, pairing, flip display")',
        'The pilot kit is Chrome on an Android tablet, an 80 mm thermal ESC/POS printer over USB or Bluetooth Classic, and a keyboard-wedge scanner (docs/product/HARDWARE.md, section 3)',
        'The cash drawer plugs into the receipt printer, which sends the pulse (HARDWARE.md)',
        'Receipts print as images, so any Indian script prints (HARDWARE.md)',
        'The sale commits first; a failed print does not lose it, and a reprint is marked DUPLICATE (HARDWARE.md; SUPPORT_CARD.md)',
        'The customer display is a flip-to-customer on the till screen (HARDWARE.md, ADR-0011)',
        'HARDWARE.md marks real-hardware tests as "Lab": still to be done'
      ],
      source: 'xlepos/docs/product/HARDWARE.md sections 1 to 3; xlepos/docs/product/SUPPORT_CARD.md'
    },
    {
      id: 'shifts-and-z-report',
      path: '/contact.html',
      title: 'Shifts, blind cash-up and the Z-report',
      group: 'cash-up',
      audiences: ['smallbiz', 'india', 'uk', 'accountants'],
      hook: 'Count the drawer at close without seeing what it should hold, then print the Z-report. In a pilot.',
      pain: 'At closing the drawer is out and nobody can say why.',
      usual: ['Counting the drawer against a total you already know', 'A day\'s notes on a scrap of paper'],
      promise: 'Each cashier\'s drawer runs from a counted opening float to a blind count at close, and closing issues a numbered Z-report.',
      steps: ['Count the opening float by denomination', 'Sell through the shift', 'At close, count the drawer; the Z-report shows expected, counted and variance'],
      cta: 'Follow the XLePOS pilot with XLeShop',
      facts: [
        'The drawer is counted by denomination at opening and at a blind close; the expected cash is not shown until the count is submitted (requirements/M05-007, M14-010)',
        'Closing issues a numbered Z-report in its own series, with gross, returns, net, tax by rate, tenders, discounts, voids, float, pay-ins, pay-outs, drops, expected, counted and variance (requirements/M14-011)',
        'A variance never blocks closing; it is recorded (M14-010)',
        'Commit log: "shifts and the Z, customers and contacts, exchanges, bound approvals"'
      ],
      source: 'xlepos/docs/product/requirements/M14-accounts-compliance.md (M14-010, M14-011); requirements/M05-payments.md (M05-007); AUTHORING.md section 2'
    },
    {
      id: 'customers-by-phone-with-consent',
      path: '/contact.html',
      title: 'Customers by phone number, with consent',
      group: 'customers',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Take a customer\'s number only if they want to give it, and record their consent. Being piloted.',
      pain: 'Asking for a phone number slows the bill, and customers resent being forced to give it.',
      usual: ['A notebook of numbers with no record of consent', 'Insisting on a number before billing'],
      promise: 'XLePOS lets a sale complete without a phone number, and records consent separately when a customer does give one.',
      steps: ['Ring up the sale; the phone prompt has a one-tap Skip', 'If the customer agrees, a privacy notice shows before the number is stored', 'Marketing consent is a separate, unticked choice'],
      cta: 'Ask XLeShop about XLePOS',
      facts: [
        'Every phone prompt has a one-tap Skip, and a sale completes without a number (requirements/M04-019)',
        'The notice shows before the number is stored. Marketing consent is a separate unticked choice per channel (M04-019)',
        'The consent record holds time, language, notice version and staff id (M04-019)',
        'In the pilot, customers are stored in XLePOS only, with no web wallet, loyalty or vouchers at the counter (AUTHORING.md section 2)'
      ],
      source: 'xlepos/docs/product/requirements/M04-selling.md (M04-019); xlepos/docs/product/AUTHORING.md section 2'
    },
    {
      id: 'exchanges-and-stock-value',
      path: '/contact.html',
      title: 'Exchanges at the counter and exact stock value',
      group: 'back-room',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'A size swap at the counter, and stock value that adds up to the paisa. Being piloted.',
      pain: 'A customer comes back to swap a size and the till has no way to do it, so I do it on paper.',
      usual: ['Handling exchanges on paper', 'Adjusting stock by hand afterwards'],
      promise: 'XLePOS handles returns and exchanges at the counter, refunding at the value the goods were sold for, and keeps stock value as an exact figure.',
      steps: ['Find the sale to return', 'Refund or exchange at the value the goods were sold for', 'Put the goods back on the shelf or write them off'],
      cta: 'Follow the XLePOS pilot with XLeShop',
      facts: [
        'Each returned unit is refunded at the value it was sold for after its share of any discounts, in whole minor units (requirements/M07-003)',
        'Returned goods go back to stock or are written off (M07-007)',
        'Stock value is held as total cost and total quantity, so no rounded cost is stored: receive 3 at a set cost, then sell 3, and the value is exactly 0 (requirements/M11-031)',
        'Commit log: "exchanges, ... stock value"'
      ],
      source: 'xlepos/docs/product/requirements/M07-returns-exchanges.md; xlepos/docs/product/requirements/M11-inventory.md (M11-031)'
    },
    {
      id: 'back-office-staff-and-devices',
      path: '/contact.html',
      title: 'A back office for staff, devices and cash-up',
      group: 'back-office',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'The owner manages staff and tills from one back office. A minimum one, in a pilot.',
      pain: 'When a tablet is lost or a cashier leaves, I do not know how to cut their access.',
      usual: ['Changing a shared password', 'Phoning the person who set the system up'],
      promise: 'The XLePOS back office is deliberately minimal for the pilot: an owner login, staff and devices, and cash-up.',
      steps: ['The owner signs in to the back office', 'Add or remove staff, and add or remove tills', 'Review cash-up'],
      cta: 'Ask XLeShop about XLePOS',
      facts: [
        'The pilot back office is "the minimum (owner login, staff and devices, cash-up)" (docs/product/AUTHORING.md, section 2)',
        'The owner gets a till\'s enrolment code in the back office: Tills, Add a till (SUPPORT_CARD.md)',
        'A removed till is asked to be set up again with a new code (SUPPORT_CARD.md: "This till was removed")',
        'Commit log: "back-office for staff and devices"'
      ],
      source: 'xlepos/docs/product/AUTHORING.md section 2; xlepos/docs/product/SUPPORT_CARD.md'
    }
  ],
  notConfirmed: [
    'Not on sale: XLePOS is in a pilot (a practice period of about two months from October 2026). There is no public page, price, plan, sign-up or launch date, and xleshop.com does not offer it. Items point at /contact.html only so people can ask.',
    'The two pilot shops\' names: not given permission to be named, so never used (xlepos/CLAUDE.md names them; the desk must not).',
    'Loyalty, vouchers, gift cards, khata (store credit book) and web wallet at the counter: P1 or P2 in docs/product/PAYMENTS.md and AUTHORING.md, not built.',
    'Card terminals (an integrated terminal in India, Stripe then SumUp in the UK) and dynamic UPI QR per bill: P1. In the pilot, card and UPI are recorded by hand and XLePOS holds no funds.',
    'Label-printing scales and scale links: P1 (HARDWARE.md, M02-018). Pilot weights are typed by staff.',
    'A label printer for size tags, Windows PC (Electron), iPad, Sunmi/iMin all-in-ones, a Play Store wrapper: P1 or P2 in HARDWARE.md, not built.',
    'Camera barcode scanning: P1 (HARDWARE.md condition 2).',
    'Real-hardware results: HARDWARE.md marks printer, drawer and scanner claims as "Lab" (not yet tested on real hardware), so no "works with" claims.',
    'GST compliance or an e-invoice (IRP) link: the commit log says "unsigned CA fixtures", and the IRP client is an adapter still to come, so no compliance wording.',
    'Hindi and other languages at the till: P1 (SUPPORT_CARD.md: English on day one, Hindi later), so not promoted.',
    'Night theme: the pilot is Day only (CLAUDE.md, AUTHORING.md).',
    'The two-second sale: a design goal (DESIGN_SYSTEM.md principle 1), not measured. Always "designed for".',
    'Shadow billing before legal billing (AUTHORING.md: 1 to 2 weeks): an internal pilot step, not promoted.'
  ],
  checked: '2026-10-25'
};
