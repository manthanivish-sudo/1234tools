'use strict';
/** Site profile: XLeShop. Read from E:/projects/XLeShop/xleshop (read-only; the platform's marketing site, public/*.html, features.html and pricing.html re-read 2026-10-25; billing is now yearly only)
 *  and the workspace CLAUDE.md at E:/projects/XLeShop, plus https://xleshop.com/pricing.html (fetched to confirm prices) on 2026-10-05.
 *  XLeShop is a store platform sold to shop owners (food, grocery, dairy, fashion; India and UK). Items are its features for shop owners,
 *  not the products of the shops that run on it: those shops are separate brands (see notConfirmed). */
module.exports = {
  id: 'xleshop',
  name: 'XLeShop',
  baseUrl: 'https://xleshop.com',
  domainSource: 'canonical tags in xleshop/public/*.html (https://xleshop.com/...), robots.txt and sitemap.xml; firebase project "xleshop" in .firebaserc; live pricing page fetched and matched the repo',
  repo: 'E:/projects/XLeShop/xleshop',
  kind: 'app',
  promotes: 'app features',
  utm: { medium: 'social' },
  brandWords: ['XLeShop', 'Service Desk', 'Starter', 'Growth', 'Pro', 'Enterprise'],
  colours: { primary: '#1F55E6', accent: '#FF6B1A', background: '#FFFFFF', ink: '#0A1224' },
  colourSource: 'xleshop/public/css/site.css:12-16 (:root --blue, --orange, --bg, --ink; light theme; dark theme at :root[data-theme="dark"] uses --bg #060A15)',
  logo: 'E:/projects/XLeShop/xleshop/public/images/XLeShop-logo.png',
  audiences: ['smallbiz', 'india', 'uk', 'marketers', 'creators', 'accountants'],
  regions: ['india', 'uk'],
  rules: {
    free: false,
    freePhrases: [
      'Catalogue migration and domain set-up are free on every plan',
      'free catalogue migration',
      'free-delivery threshold',
      // added by the desk from facts this profile already sources (features.html, pricing.html):
      'free delivery',
      'Migration is free',
      'Catalogue migration is free on every plan',
      'we\'ll load it for you, free'
    ],
    browserClaims: false,
    forbid: [
      { rule: 'no-unlimited', re: '\\bunlimited\\b', msg: 'The Growth plan lists "Unlimited orders", but copy must not say unlimited. Say "Starter includes up to 1,000 orders a month" or leave the order cap out.' },
      { rule: 'no-store-counts', re: '\\b(nine|9|\\d+)\\s+(live\\s+)?(stores|brands|shops|domains)\\b', msg: 'The site counts its live stores; promotion copy must not use customer or store counts.' },
      { rule: 'no-testimonials', re: '(gajanan|sri balaji|eight cities|zero downtime, and our)', msg: 'The home and customers pages carry owner quotes with star ratings. Do not quote or name client shops in copy.' },
      { rule: 'no-app-store', re: '\\b(on|in|from) the (app store|play store)\\b|\\bgoogle play\\b|\\bdownload (our|the|your) app\\b', msg: 'The installable app is a home-screen web app with no app store. Say "customers add your store to their home screen".' },
      { rule: 'not-live-yet', re: '\\b(push notifications?|order alerts?|tally|zoho|whatsapp business api|automatic whatsapp)\\b', msg: 'Tally/Zoho export is "rolling out"; staff order alerts and customer order updates are "coming soon"; automatic WhatsApp/SMS updates are "roadmap". Do not promote them as live.' },
      { rule: 'on-request-gateways', re: '\\b(stripe|phonepe|cashfree|meta pixel|facebook pixel)\\b', msg: 'These are "on request", not built in. Built-in payments are Razorpay, PayU, UPI QR, cash on delivery and wallet.' },
      { rule: 'no-compliance', re: '\\b(gdpr|dpdp|pci|iso ?27001|soc ?2)\\b[^.]{0,20}\\b(compliant|certified|compliance)\\b|\\b(compliant|certified)\\b[^.]{0,20}\\b(gdpr|dpdp|pci|iso|soc)', msg: 'Compliance wording appears only in the privacy policy metadata. Do not make compliance or certification claims in promotion.' },
      { rule: 'no-uptime-guarantee', re: '\\b(100\\s*%|guaranteed?)\\s*(uptime|availability)\\b|\\bnever (goes )?down\\b|\\bnever fails\\b', msg: 'The site states backups, monitoring and response targets, not an uptime guarantee.' },
      { rule: 'no-uk-prices', re: '£\\s?\\d', msg: 'UK shops are billed in pounds on a quote. No pound prices are shown.' },
      { rule: 'no-free-trial', re: '\\bfree (trial|plan|month|tier)\\b|\\btry (it )?free\\b', msg: 'There is no free trial or free plan. The free things are catalogue migration and domain set-up.' },
      { rule: 'no-marketplace-names', re: '\\b(swiggy|zomato|amazon|flipkart|blinkit|zepto|bigbasket|dunzo|jiomart|meesho|shopify|dukaan|woocommerce|wordpress|wix)\\b', msg: 'The site contrasts "a marketplace" in general and has retired its named comparison pages. Never name a marketplace or platform.' },
      { rule: 'monthly-price-alone', level: 'warn', re: '(?<!(a year|yearly|paid yearly)[^.\\n]{0,60})₹\\s?(1,500|2,499|3,999|7,999)\\b(?![^.\\n]{0,60}(a year|yearly))', msg: 'Billing is yearly only. A monthly price (₹1,500, ₹2,499, ₹3,999, ₹7,999) must sit next to the yearly price (₹18,000, ₹29,988, ₹47,988, ₹95,988 a year, paid yearly in advance), for example: ₹18,000 a year, paid yearly (₹1,500 a month).' },
      { rule: 'no-money-claims', re: '\\b(save|keep) ₹\\s?[\\d,]+', msg: 'Savings from the commission calculator depend on the visitor\'s own inputs. Point people to the calculator instead of quoting a saving.' }
    ],
    notes: [
      'XLeShop is a store platform for shop owners: speak to owners of food, grocery, dairy, sweets, Ayurveda and fashion shops in India and the UK.',
      '"0% commission" is stated on every page and is fine to use; payment gateways still charge their own per-transaction fee, so never imply payments cost nothing.',
      'Billing is yearly only, paid in advance: Starter ₹18,000 a year, Growth ₹29,988, Pro ₹47,988, Enterprise ₹95,988 (pricing.html also shows the monthly equivalents ₹1,500, ₹2,499, ₹3,999 and ₹7,999 a month, paid yearly). Quote the yearly price with the monthly equivalent in brackets; never show a monthly price on its own as if it were billed monthly. Always name the plan a feature needs.',
      'Razorpay and PayU are integrations: name them only as facts about how payments settle, never in a comparison.',
      'Compare with "selling through a marketplace" only in the site\'s own general terms (commission per order, the app keeps the customer); never name one.',
      'The only free things are catalogue migration and domain set-up; "free delivery" is a setting the shop offers its own customers.'
    ]
  },
  items: [
    {
      id: 'own-domain-store',
      path: '/features.html#storefront',
      title: 'Your own domain',
      group: 'storefront',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Your shop on your own .com, in your colours, with 0% commission on sales.',
      pain: 'My customers order through an app that shows my product next to the shop down the road, and takes a cut every time.',
      usual: ['Selling through a marketplace app', 'Taking orders in WhatsApp chats'],
      promise: 'XLeShop puts your store on your own domain with SSL, your logo and colours, and a zero-downtime switch-over handled for you.',
      steps: ['Tell XLeShop your name, domain and catalogue', 'Preview the store and ask for changes', 'Switch the domain over and start taking orders'],
      cta: 'Start your store on XLeShop',
      facts: [
        'yourbrand.com, with SSL, DNS and a zero-downtime switch-over handled for you (All plans)',
        'Logo, colours and a choice of four design themes. Customers see only your brand, never ours',
        'You pay one flat plan, and we take 0% of your sales',
        'Catalogue migration and domain set-up are free on every plan',
        'Starter ₹18,000 a year, paid yearly in advance (₹1,500 a month)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'installable-app',
      path: '/features.html#storefront',
      title: 'Installable app',
      group: 'storefront',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Put your shop on your regulars\' home screens, without building an app.',
      pain: 'A custom shopping app costs more than my shop makes in a year, so my customers just message me instead.',
      usual: ['Paying a developer for an app', 'Sending price lists as photos'],
      promise: 'Customers add your store to their home screen on Android or iPhone, and it opens like an app, with no app store and no fee.',
      steps: ['Your XLeShop store goes live on your domain', 'Customers open it on their phone', 'They tap Add to Home screen and it opens like an app'],
      cta: 'See the store app on XLeShop',
      facts: [
        'Customers add your store to their home screen on Android or iPhone. It opens like an app, with no app store and no fee (All plans)',
        'A fast, mobile-first store in your colours and on your domain',
        'Built to be fast on a mid-range phone and a patchy 4G signal'
      ],
      source: 'public/features.html'
    },
    {
      id: 'checkout-payments',
      path: '/features.html#checkout',
      title: 'Checkout & payments',
      group: 'checkout',
      audiences: ['smallbiz', 'india'],
      hook: 'Take UPI, cards and netbanking on your own store, settled to your own bank.',
      pain: 'I chase customers for payment screenshots after every delivery and still lose track of who has paid.',
      usual: ['Asking for UPI screenshots on WhatsApp', 'Cash only, counted at night'],
      promise: 'Payments settle from your gateway straight to your bank, are verified by the server, and refund automatically if you cancel.',
      steps: ['Connect your payment gateway during set-up', 'Customers pay by UPI, card or netbanking at checkout', 'Money settles from the gateway to your bank'],
      cta: 'Get paid on your own XLeShop store',
      facts: [
        'UPI, cards and netbanking through Razorpay or PayU, straight to your bank',
        'Payments are verified by the server, captured when you confirm the order and refunded automatically if you cancel',
        'UPI QR: show your own UPI QR code at checkout; staff mark the payment as received in the admin',
        'XLeShop never touches your money',
        'The payment gateway charges its own fee per transaction, as it would anywhere'
      ],
      source: 'public/features.html'
    },
    {
      id: 'cash-settlement',
      path: '/features.html#operations',
      title: 'Cash settlement',
      group: 'operations',
      audiences: ['smallbiz', 'india'],
      hook: 'Cash on delivery without the end-of-day guessing game.',
      pain: 'Drivers hand over cash at night and I can never match it to the orders they delivered.',
      usual: ['A notebook of who paid cash', 'Counting the bag and hoping it matches'],
      promise: 'Drivers declare the cash they collect and an admin confirms it, so the cash-on-delivery gap is closed.',
      steps: ['Switch cash on delivery on in the admin', 'Drivers declare cash collected in the driver app', 'An admin confirms it and the order is settled'],
      cta: 'Settle COD cash on XLeShop',
      facts: [
        'Switch COD on or off. Drivers declare the cash they collect and an admin settles it, so no money goes missing (All plans)',
        'Drivers declare the cash they collected, and an admin confirms it. The cash-on-delivery gap is closed'
      ],
      source: 'public/features.html'
    },
    {
      id: 'delivery-slots',
      path: '/features.html#checkout',
      title: 'Delivery slots',
      group: 'checkout',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Let customers pick a delivery window you can actually keep.',
      pain: 'Everyone wants their order at 8am and I find out at 7am how many there are.',
      usual: ['Promising times over the phone', 'Delivering whenever the van gets back'],
      promise: 'Morning and evening windows with a charge for each slot, calculated on the server, and pick lists for each slot.',
      steps: ['Set your slots and their charges in the admin', 'Customers choose a slot at checkout', 'Pack each slot from its own pick list'],
      cta: 'Set up delivery slots on XLeShop',
      facts: [
        'Morning and evening windows with a charge for each slot. Customers pick the one that suits them at checkout (All plans)',
        'Delivery slots with per-slot charges and free-delivery thresholds',
        'A delivery charge and a free-delivery threshold, both calculated on the server so they can\'t be tampered with',
        'Packing app: a pick list for each slot, packing slips, and a single "packed" button'
      ],
      source: 'public/features.html'
    },
    {
      id: 'gst-invoices',
      path: '/features.html#checkout',
      title: 'GST tax invoices',
      group: 'checkout',
      audiences: ['smallbiz', 'india', 'accountants'],
      hook: 'GST invoices with HSN codes and the CGST/SGST split, made with every order.',
      pain: 'Customers and my accountant both want proper GST invoices and I write them by hand.',
      usual: ['Hand-written bills', 'Re-typing orders into billing software'],
      promise: 'Add your GSTIN and invoices show HSN codes and a CGST/SGST or IGST split automatically.',
      steps: ['Add your GSTIN in the admin', 'Set HSN codes on your products', 'Invoices are made with each order'],
      cta: 'Send GST invoices from XLeShop',
      facts: [
        'Add your GSTIN and invoices show HSN codes and a CGST/SGST or IGST split automatically (All plans)',
        'Sales reports by day, product, category and brand, with CSV export for your accountant'
      ],
      source: 'public/features.html'
    },
    {
      id: 'subscriptions',
      path: '/features.html#customers',
      title: 'Subscriptions',
      group: 'premium',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Daily milk, set once. Customers pause and skip it themselves.',
      pain: 'Every evening I get messages: skip tomorrow, we\'re away till Monday, double the curd on Saturday.',
      usual: ['A register of daily customers', 'Changes sent by text and missed'],
      promise: 'Daily or weekly deliveries customers pause, skip, resume or cancel themselves, with a forecast of what to stock.',
      steps: ['Switch on subscriptions (Growth plan and up)', 'Customers set up a daily or weekly order', 'Check the forecast and buy in for tomorrow'],
      cta: 'Run subscriptions on XLeShop',
      facts: [
        'Daily or weekly deliveries that customers pause, skip, resume or cancel themselves. You get a forecast of what to stock (Growth)',
        'Daily milk, a weekly vegetable box, paneer every Wednesday. Customers set it once and manage it themselves',
        'Growth ₹29,988 a year, paid yearly in advance (₹2,499 a month)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'customer-wallet',
      path: '/features.html#customers',
      title: 'Customer wallet',
      group: 'premium',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Give refunds as store credit that stays in your shop.',
      pain: 'Every small refund is a bank transfer, and the money leaves my shop for good.',
      usual: ['Refunding to the card or UPI', 'Noting credits in a book'],
      promise: 'Credits, refunds and top-ups in one balance with a full ledger, and customers can pay all or part of an order from it.',
      steps: ['Switch on the wallet (Growth plan and up)', 'Credit or debit a customer with a reason', 'They spend it on their next order'],
      cta: 'Add a customer wallet with XLeShop',
      facts: [
        'Credits, refunds and top-ups in one balance, with a full ledger. Admins can credit or debit with a reason (Growth)',
        'Customers can pay all or part of an order from their wallet balance (Growth)',
        'Wallet balances and a complete wallet log in reports (Growth)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'loyalty-tiers',
      path: '/features.html#customers',
      title: 'Loyalty tiers',
      group: 'premium',
      audiences: ['smallbiz', 'marketers'],
      hook: 'New, Bronze, Silver, Gold, Platinum: a reason for regulars to choose you again.',
      pain: 'My regulars get nothing that the shop down the road doesn\'t give them.',
      usual: ['Paper stamp cards', 'Ad-hoc discounts for faces you know'],
      promise: 'Customers climb from New to Platinum automatically as they order, and see their tier and how close they are to the next.',
      steps: ['Switch on loyalty tiers (Pro plan)', 'Customers earn tiers as they order', 'They see their tier in their account'],
      cta: 'Turn on loyalty tiers with XLeShop',
      facts: [
        'New, Bronze, Silver, Gold and Platinum. Customers see their tier and how close they are to the next one (Pro)',
        'Customers climb from New to Bronze, Silver, Gold and Platinum as they order. It\'s automatic, visible to them',
        'Pro ₹47,988 a year, paid yearly in advance (₹3,999 a month)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'one-tap-reorder',
      path: '/features.html#customers',
      title: 'One-tap reorder',
      group: 'customers',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Your regular\'s last basket, back in the cart in one tap.',
      pain: 'My regulars order the same things every week and still have to type the whole list again.',
      usual: ['Retyping the list on WhatsApp', 'Phoning the order in'],
      promise: 'Customers put their last basket back in the cart with one tap, from their own account. On every plan.',
      steps: ['Customer signs in with a one-time code, then a PIN', 'They open their past orders', 'One tap puts the last basket in the cart'],
      cta: 'Make reordering one tap on XLeShop',
      facts: [
        'Put the last basket back in the cart with one tap. It\'s the quickest way to a second order (All plans)',
        'Customers sign in with a one-time password by SMS or email, then use a PIN',
        'Every order, every address and every status, in the customer\'s own account'
      ],
      source: 'public/features.html'
    },
    {
      id: 'packing-driver-apps',
      path: '/features.html#operations',
      title: 'Packing app and driver app',
      group: 'operations',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Packers get a pick list, drivers get their drops. Each on their own phone.',
      pain: 'I forward every order to my packer and driver by hand, and someone always gets the wrong list.',
      usual: ['Forwarding orders on WhatsApp', 'Printed lists stuck to the wall'],
      promise: 'Orders move through a checked pipeline, go to the least busy packer or driver, and each person sees only their own queue.',
      steps: ['Add packers and drivers as staff', 'New orders are assigned automatically', 'Packers mark packed, drivers mark delivered'],
      cta: 'Run packing and delivery on XLeShop',
      facts: [
        'Order pipeline: placed, confirmed, packed, dispatched, delivered. The server checks every step, and each order keeps a full timeline (All plans)',
        'Packing app: a pick list for each slot, packing slips, and a single "packed" button (All plans)',
        'Driver app: the day\'s drops in order, with cash to collect and a delivered button. It keeps working without a signal (All plans)',
        'New orders go to the least busy packer or driver, and each person sees only their own queue (All plans)',
        '7 team roles: Admin, Manager, Staff, Support, Viewer, Packer, Driver'
      ],
      source: 'public/features.html'
    },
    {
      id: 'stock-management',
      path: '/features.html#catalogue',
      title: 'Stock management',
      group: 'catalogue',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Know what is running low before your customers find out.',
      pain: 'Customers order things I ran out of yesterday, and I have to call them to apologise.',
      usual: ['Checking the shelves by eye', 'Taking items off a price list by hand'],
      promise: 'Stock levels, reorder points and low-stock alerts, with sold-out items marked on the store automatically.',
      steps: ['Set stock and a reorder point per product', 'Bulk edit stock across many products', 'Sold-out items are marked on the store'],
      cta: 'Track stock with XLeShop',
      facts: [
        'Stock levels, reorder points and low-stock alerts, with sold-out items marked on the store automatically (All plans)',
        'Name, price, photo, live. There\'s no review queue, so a flash sale can go up the same evening',
        'Change stock, category and visibility across many products at once (Bulk edit, All plans)',
        'Variants: sizes and options, each with its own stock count'
      ],
      source: 'public/features.html'
    },
    {
      id: 'product-reels',
      path: '/features.html#premium',
      title: 'Product reels',
      group: 'premium',
      audiences: ['smallbiz', 'marketers', 'creators'],
      hook: 'Turn your product photos into short vertical videos for Reels and Status.',
      pain: 'I know I should post videos of new stock, but I have no time to film or edit them.',
      usual: ['Posting still photos only', 'Editing clips by hand on the phone'],
      promise: 'Short vertical videos made from your own product photos, ready to post on Instagram, YouTube Shorts and WhatsApp Status.',
      steps: ['Switch on product reels (Pro plan)', 'Use the product photos already in your store', 'Post the reel to Instagram, Shorts or Status'],
      cta: 'Make product reels with XLeShop',
      facts: [
        'Short vertical videos made from your own product photos, to share on Instagram, YouTube Shorts and WhatsApp Status (Pro)',
        'Pro ₹47,988 a year, paid yearly in advance (₹3,999 a month)'
      ],
      source: 'public/index.html'
    },
    {
      id: 'segment-campaigns',
      path: '/features.html#premium',
      title: 'Campaigns, vouchers and segments',
      group: 'growth',
      audiences: ['smallbiz', 'marketers'],
      hook: 'Find customers who haven\'t ordered in 30 days and send them their own offer.',
      pain: 'Some of my regulars have gone quiet and I don\'t know who they are.',
      usual: ['One broadcast to everyone', 'Guessing from memory who stopped ordering'],
      promise: 'Segments for new, regular, lapsed and top spenders, each with its own offer by email, and vouchers with use limits.',
      steps: ['Open Customers and pick a segment', 'Create a voucher: percentage, flat amount or delivery', 'Email that group its own offer'],
      cta: 'Win back regulars with XLeShop',
      facts: [
        'Find the customers who haven\'t ordered in 30 days, your top spenders or this week\'s first-timers, and send each group its own offer by email (All plans)',
        'Vouchers: percentage off, a flat amount off or free delivery, with limits on how many times each voucher can be used',
        'Customer CRM: every customer\'s orders, spend, notes and contact details in one place'
      ],
      source: 'public/index.html'
    },
    {
      id: 'whatsapp-sellers',
      path: '/whatsapp.html',
      title: 'WhatsApp sellers',
      group: 'whatsapp',
      audiences: ['smallbiz', 'india'],
      hook: 'Selling on WhatsApp? Keep the chat, stop losing the order.',
      pain: 'My orders live in unread chats: "2kg onion", a voice note, a photo of a list. Things get missed.',
      usual: ['Copying chats into a spreadsheet', 'Scrolling back to find who ordered what'],
      promise: 'XLeShop captures the cart, the slot and the payment, and customers can still message you on WhatsApp.',
      steps: ['Send XLeShop the catalogue you already have', 'Preview your store on a private link', 'Tell regulars the URL in your bio and status'],
      cta: 'Move WhatsApp orders to XLeShop',
      facts: [
        'One tap sends the basket to your number with items and totals',
        'A WhatsApp button on every page, and baskets customers can share to your number or with family (All plans)',
        'Screenshots, Excel, a Google sheet, photos from the kitchen. All fine',
        'Migration is free. Commission from XLeShop is zero. From ₹1,500/month'
      ],
      source: 'public/whatsapp.html'
    },
    {
      id: 'catalogue-migration',
      path: '/features.html#catalogue',
      title: 'Catalogue migration',
      group: 'onboarding',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Send a spreadsheet, photos or an old website. XLeShop loads the catalogue for you.',
      pain: 'Typing hundreds of products into a new system is the reason I keep putting off going online.',
      usual: ['Entering products one by one', 'Paying someone to copy them across'],
      promise: 'Send a spreadsheet, photos or an old website and XLeShop loads it for you. Catalogue migration is free on every plan.',
      steps: ['Send your catalogue in whatever form you have', 'XLeShop builds the store with your products', 'Preview it and ask for changes'],
      cta: 'Bring your catalogue to XLeShop',
      facts: [
        'Send us a spreadsheet, photos or an old website and we\'ll load it for you, free (All plans)',
        'Catalogue migration and domain set-up are free on every plan',
        'Are there set-up fees? No. Domain set-up, catalogue migration, payment gateway set-up and training are included',
        'Bespoke development, such as a custom integration, is quoted up front before any work starts'
      ],
      source: 'public/pricing.html'
    },
    {
      id: 'service-desk',
      path: '/support.html',
      title: 'Service Desk',
      group: 'support',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Support with named people, tracked tickets and response targets in writing.',
      pain: 'When checkout breaks on a busy morning I need a person who knows my shop, not a chatbot.',
      usual: ['Emailing a general inbox', 'Calling a freelance developer'],
      promise: 'Every store is an account on the Service Desk: incidents get a priority from P1 to P4, a response clock and an owner.',
      steps: ['Raise a ticket from your admin footer, email or WhatsApp', 'A person sets the priority and the clock starts', 'The ticket closes when you agree it\'s fixed'],
      cta: 'See how XLeShop support works',
      facts: [
        'Incidents with priorities from P1 to P4 and a response clock on each',
        'Change requests that are planned, approved, scheduled and recorded',
        'Lead management for bulk, wholesale and corporate enquiries',
        'Named support staff who speak English, Hindi and Telugu',
        'Business hours: Monday to Saturday, 9:00–18:00 IST',
        'First response to P1 critical: Starter same business day, Growth 4 hours, Pro 2 hours, Enterprise 1 hour, 24×7'
      ],
      source: 'public/support.html'
    },
    {
      id: 'licence-promise',
      path: '/pricing.html#licence',
      title: 'Our licence promise',
      group: 'pricing',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'A late renewal never switches off your checkout.',
      pain: 'I worry that if a bill slips through, my shop disappears and my customers can\'t order.',
      usual: ['Setting reminders for every renewal', 'Paying early just in case'],
      promise: 'Reminders 60, 30 and 7 days ahead, 14 days of grace, then only premium extras pause. Checkout, payments and stock keep working.',
      steps: ['Pick a plan (billed yearly, in advance)', 'Get renewal reminders by email and in your admin', 'Renew; nothing changes for your customers'],
      cta: 'Read how XLeShop licences work',
      facts: [
        'We will never switch off your checkout over a bill',
        'Renewal reminders arrive 60, 30 and 7 days before the renewal date',
        '14-day grace period: every feature keeps working',
        'After grace, wallet, loyalty, subscriptions, brands and reels pause. Selling never stops',
        'Suspending a whole shop is only ever a deliberate, manual decision, and never an automatic one'
      ],
      source: 'public/pricing.html'
    },
    {
      id: 'commission-calculator',
      path: '/pricing.html#calculator',
      title: 'Commission calculator',
      group: 'pricing',
      audiences: ['smallbiz', 'india'],
      hook: 'What does marketplace commission cost you in a year? Work it out in a minute.',
      pain: 'I know a cut comes off every order, but I\'ve never added up what it costs me over a year.',
      usual: ['Looking at one payout at a time', 'Rough sums on a calculator'],
      promise: 'Move the slider to your monthly sales, pick the commission you pay today, and see what you would keep over a year on an XLeShop plan.',
      steps: ['Set your monthly online sales', 'Pick the commission rate on your last payout', 'Compare it with an XLeShop plan'],
      cta: 'Try the XLeShop commission calculator',
      facts: [
        'Move the slider to your monthly sales and pick the commission rate you pay today',
        'Commission rates vary by marketplace and category, so choose the one on your last payout',
        'Payment gateway fees apply either way, so they\'re left out',
        'XLeShop never takes a cut of what you sell'
      ],
      source: 'public/pricing.html'
    },
    {
      id: 'multi-brand-catalogue',
      path: '/features.html#catalogue',
      title: 'Multi-brand catalogue',
      group: 'premium',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Sell your own label next to the brands you stock, and see what each one earns.',
      pain: 'I stock dozens of brands plus my own, and I can\'t tell which ones actually make me money.',
      usual: ['One long product list', 'Working out brand sales in a spreadsheet'],
      promise: 'Each brand gets a brand page and a filter, and you get brand-level revenue reports.',
      steps: ['Switch on brands (Growth plan and up)', 'Tag products with their brand', 'Read revenue by brand in Reports'],
      cta: 'Sell many brands on XLeShop',
      facts: [
        'Sell many brands under one store. Each brand gets a brand page, a filter and brand-level revenue reports (Growth)',
        'Revenue by brand, so you can see what your own label earns next to the brands you stock (Growth)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'google-product-pages',
      path: '/features.html#storefront',
      title: 'Product pages built for Google',
      group: 'storefront',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Every product on your store gets its own page, ready to be found and shared.',
      pain: 'My products only exist inside a chat or an app, so nobody can find them on Google or share a link.',
      usual: ['Sending product photos on WhatsApp', 'Listing products only inside someone else\'s app'],
      promise: 'Every product gets its own page, with a sitemap and share previews that look right on WhatsApp and social media.',
      steps: ['Add a product to your catalogue', 'It gets its own page on your domain', 'Share the link, and the preview looks right on WhatsApp'],
      cta: 'Put your products on their own pages with XLeShop',
      facts: [
        'Every product gets its own page, with a sitemap and share previews that look right on WhatsApp and social media (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'vouchers',
      path: '/features.html#checkout',
      title: 'Vouchers',
      group: 'checkout',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Offer money off or free delivery, with a limit on each voucher.',
      pain: 'I give discounts by message and then can\'t stop the same code being used again and again.',
      usual: ['Promising discounts over WhatsApp', 'Knocking money off by hand at delivery'],
      promise: 'Create vouchers for a percentage off, a flat amount off or free delivery, and limit how many times each can be used.',
      steps: ['Create a voucher in your admin', 'Set how many times it can be used', 'Customers enter the code at checkout'],
      cta: 'Run vouchers on your XLeShop store',
      facts: [
        'Percentage off, a flat amount off or free delivery, with limits on how many times each voucher can be used (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'returns',
      path: '/features.html#customers',
      title: 'Returns',
      group: 'customers',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Customers start a return from their own account. Your team approves it and processes the refund.',
      pain: 'Returns arrive as messages and phone calls, and nobody can tell which ones are sorted.',
      usual: ['Handling returns by phone call', 'Tracking refunds in a notebook'],
      promise: 'Customers start a return from their account, your team approves it, and you process the refund.',
      steps: ['The customer starts a return from their account', 'Your team approves it', 'You process the refund'],
      cta: 'Handle returns on your XLeShop store',
      facts: [
        'Customers start a return from their account. Your team approves it and processes the refund (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'sizes-variants',
      path: '/features.html#catalogue',
      title: 'Sizes, size charts and variants',
      group: 'catalogue',
      audiences: ['smallbiz', 'india', 'uk', 'marketers'],
      hook: 'Sell anything that comes in sizes, with stock counted for each size.',
      pain: 'One product, five sizes, and I lose track of which size has sold out.',
      usual: ['A separate listing for every size', 'Counting sizes in a spreadsheet'],
      promise: 'Sell clothing and anything else that comes in sizes, with stock tracked for each size and a size chart on the product.',
      steps: ['Add the sizes or options to a product', 'Set the stock count for each one', 'Show a size chart on the product page'],
      cta: 'Sell sizes and options on XLeShop',
      facts: [
        'Sell clothing and anything else that comes in sizes, with stock tracked for each size and a size chart on the product (All plans)',
        'Variants: sizes and options, each with its own stock count (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'order-tracking',
      path: '/features.html#storefront',
      title: 'Order tracking',
      group: 'storefront',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Every order gets a private tracking link, so customers can follow it themselves.',
      pain: 'Customers keep messaging to ask where their order is.',
      usual: ['Answering "where is my order?" messages', 'Calling customers with updates'],
      promise: 'Every order has a private tracking link, so customers can follow it from confirmed to delivered.',
      steps: ['A customer places an order', 'They get a private tracking link for it', 'They follow it from confirmed to delivered'],
      cta: 'Give your customers order tracking with XLeShop',
      facts: [
        'Every order has a private tracking link, so customers can follow it from confirmed to delivered (All plans)',
        'Order pipeline: placed, confirmed, packed, dispatched, delivered. The server checks every step, and each order keeps a full timeline (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'publish-and-bulk-edit',
      path: '/features.html#catalogue',
      title: 'Publish in under a minute and bulk edit',
      group: 'catalogue',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Name, price, photo, live. There is no review queue.',
      pain: 'A flash sale idea comes in the afternoon, but updating every product takes until the next day.',
      usual: ['Waiting for a developer to update the catalogue', 'Editing products one at a time'],
      promise: 'Name, price, photo, live, with no review queue, so a flash sale can go up the same evening. Bulk edit changes many products at once.',
      steps: ['Add the name, price and photo', 'Publish it: no review queue', 'Use bulk edit to change stock, category or visibility across many products'],
      cta: 'Update your catalogue fast with XLeShop',
      facts: [
        'Publish in under a minute: name, price, photo, live. There\'s no review queue, so a flash sale can go up the same evening (All plans)',
        'Bulk edit: change stock, category and visibility across many products at once, and switch a whole range on or off (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'auto-confirm-assignment',
      path: '/features.html#operations',
      title: 'Auto-confirm and automatic assignment',
      group: 'operations',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Confirm orders automatically and send each new order to the least busy packer or driver.',
      pain: 'On a busy morning, customers wait for me to confirm and I decide by hand who packs what.',
      usual: ['Confirming every order by hand', 'Telling staff by phone which orders are theirs'],
      promise: 'Turn on auto-confirm, and new orders go to the least busy packer or driver, who each see only their own queue.',
      steps: ['Switch on auto-confirm if you like', 'New orders go to the least busy packer or driver', 'Each person sees only their own queue'],
      cta: 'Run your orders on XLeShop',
      facts: [
        'Auto-confirm: confirm orders automatically if you like, so customers aren\'t left waiting on a busy morning (All plans)',
        'Automatic assignment: new orders go to the least busy packer or driver, and each person sees only their own queue (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'staff-audit-log',
      path: '/features.html#team',
      title: 'Staff accounts and audit log',
      group: 'team',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Add your team, and see who changed what, and when.',
      pain: 'A price changed and nobody knows who did it.',
      usual: ['Sharing one admin password', 'Asking around who edited an order'],
      promise: 'Add, change or remove team members and reset their passwords, with an audit log of who changed what, and when, for orders, products and settings.',
      steps: ['Add your team members as staff accounts', 'They work in their own accounts', 'Check the audit log for who changed what, and when'],
      cta: 'Give your team their own accounts on XLeShop',
      facts: [
        'Staff accounts: add, change or remove team members, and reset their passwords (All plans)',
        'Audit log: who changed what, and when, for orders, products and settings (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'sales-reports-ledgers',
      path: '/features.html#insights',
      title: 'Sales reports, analytics and payment ledgers',
      group: 'insights',
      audiences: ['smallbiz', 'india', 'uk', 'accountants'],
      hook: 'Sales by day, product, category and brand, with a CSV for your accountant.',
      pain: 'At month end I rebuild my sales from chat messages and bank entries.',
      usual: ['Adding up sales in a spreadsheet', 'Matching bank credits to orders by hand'],
      promise: 'Sales reports by day, product, category and brand with CSV export, analytics for trends and best sellers, and payment records for Razorpay and PayU.',
      steps: ['Open Reports in your admin', 'Pick the view: by day, product, category or brand', 'Export a CSV for your accountant'],
      cta: 'See your sales clearly on XLeShop',
      facts: [
        'Sales reports: by day, product, category and brand, with CSV export for your accountant (All plans)',
        'Analytics: trends, best sellers and repeat rate (All plans)',
        'Payment ledgers: payment records for Razorpay and PayU, including Razorpay settlements, with CSV export (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'delivery-charges',
      path: '/features.html#checkout',
      title: 'Delivery charges and free delivery',
      group: 'checkout',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'Set a delivery charge and a free-delivery threshold, worked out on the server.',
      pain: 'I quote delivery charges by message and customers argue about them.',
      usual: ['Quoting delivery by message', 'Adjusting totals by hand'],
      promise: 'A delivery charge and a free-delivery threshold, both calculated on the server so they can\'t be tampered with.',
      steps: ['Set your delivery charge', 'Set the free-delivery threshold', 'Checkout works the charge out on the server'],
      cta: 'Set your delivery charges on XLeShop',
      facts: [
        'A delivery charge and a free-delivery threshold, both calculated on the server so they can\'t be tampered with (All plans)'
      ],
      source: 'public/features.html'
    },
    {
      id: 'duplicate-orders',
      path: '/features.html#checkout',
      title: 'Protection against duplicate orders',
      group: 'checkout',
      audiences: ['smallbiz', 'india', 'uk'],
      hook: 'The same basket sent twice from the same phone is caught before it becomes two orders.',
      pain: 'A slow signal, a second tap, and the customer is charged for two orders.',
      usual: ['Phoning customers about double orders', 'Cancelling the extra order by hand'],
      promise: 'If the same basket is submitted twice from the same phone, it\'s caught before it becomes two orders.',
      steps: ['A customer taps place order', 'If the same basket is submitted again from the same phone', 'It is caught before it becomes two orders'],
      cta: 'Take orders on XLeShop',
      facts: [
        'If the same basket is submitted twice from the same phone, it\'s caught before it becomes two orders (All plans)'
      ],
      source: 'public/features.html'
    }
  ],
  notConfirmed: [
    'Tally and Zoho Books export: marked "Rolling out" on the home, features and pricing pages, so not promoted as live.',
    'Order alerts on staff phones and order updates for customers (push notifications): marked "Coming soon".',
    'Automatic WhatsApp and SMS updates through a Business API provider: marked "Roadmap" on integrations.html.',
    'Other gateways (Stripe, PhonePe PG, Cashfree), hyperlocal and UK carriers, Meta Pixel: "On request" on integrations.html, not built in.',
    'Shiprocket / Delhivery: "Your account" (bring your own credentials), set-up included only on Enterprise; left out as an item.',
    'Partner API and dedicated success manager: Enterprise / "On request"; left out as items.',
    'UK pricing: billed in pounds on a quote; no pound prices are shown, so none are used.',
    'Owner testimonials with star ratings (Gajanan Home Foods, Sri Balaji Stores) and the "9 brands live" / "9 live stores" counts: excluded by the honesty rules.',
    '"GDPR and Indian IT Act compliant": appears only in privacy.html metadata; not used as a promotional claim.',
    'Merchant lookbook (/lookbook/): a walkthrough of homepage layouts for tenants ("current default", "one-file switch"); reads as a sales aid, not a product feature, so left out.',
    'Blog posts (/blog/), including "best ecommerce platforms for Indian grocery 2026": articles, not items; the old named comparison pages now 301 to /#why.',
    'Commission calculator saving figures (e.g. ₹6,90,012) depend on the visitor\'s inputs; not quoted.',
    'XLePOS: now in a pilot (practice period) with its own profile, sites/xlepos.js; it is still not offered on xleshop.com and has no public page, so it is not an item here.',
    '/console/ (noindex) and chat-widget.js: internal or support tooling, not promoted.',
    'Separate shop brands run on XLeShop, candidates for their own profiles: Gajanan Home Foods (gajananafoods.co.in, repo gajananafoods/), Sri Balaji Stores (sribalajistores.co.uk, SriBalajiStores/), SouthBasket (southbasket.co.in, SouthBasket/), Natural Cure Ayurveda (naturalcureayurveda.com, naturalcureayurveda/), KBK Dairy Products (kbkdairyproducts.com, kbkdairyproducts/), KBK Mart (kbkmart.com, kbkmart/), Aarvik Dairy Products (aarvikdairyproducts.com, aarvikdairyproducts/), DairyZest (dairyzest.com, dairyzest/), RAP CLUB (rapclub.co.in, rapclub/). Domains as linked from xleshop/public/customers.html.'
  ],
  checked: '2026-10-25'
};
