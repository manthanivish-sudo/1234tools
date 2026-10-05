'use strict';
/** Site profile: Aarvik Dairy Products, a shop on XLeShop. Read from E:/projects/XLeShop/aarvikdairyproducts (read-only;
 *  git https://github.com/vmanthani/aarvikdairyproducts.git, last commit 0afc7c7 2026-10-02; firebase project
 *  aarvikdairyproducts-2026) and the live site https://aarvikdairyproducts.com on 2026-10-05, plus the public
 *  menu.json / settings.json / details.json under xleshop-menu.storage.googleapis.com/adp/. An Indian dairy shop
 *  (milk, badam milk, paneer, cheese, butter, ghee), Cash on Delivery only; the city it serves is not stated anywhere
 *  (the live home-page title still reads "TODO: confirm city"). */
const SHOP = require('./_shop');

const ORDER_STEPS = [
  'Add it to your basket on the Aarvik Dairy Products site',
  'Enter your mobile number, your address and a delivery slot',
  'Place the order and pay cash on delivery'
];

module.exports = {
  id: 'aarvik-dairy-products',
  name: 'Aarvik Dairy Products',
  baseUrl: 'https://aarvikdairyproducts.com',
  domainSource: 'public/brand-config.js domain "aarvikdairyproducts.com" / url "https://aarvikdairyproducts.com" (lines 22-23); public/sitemap.xml <loc>https://aarvikdairyproducts.com/...; curl https://aarvikdairyproducts.com/ and https://www.aarvikdairyproducts.com/ both end 200 at https://aarvikdairyproducts.com/ (no www) on 2026-10-05, title "Aarvik Dairy Products – Fresh Dairy Products delivered to your door — TODO: confirm city". Canonical tags are written empty in the HTML (href="") and filled by script. Hosting uses clean URLs: /faq.html 301s to /faq, so items use extensionless paths.',
  repo: 'E:/projects/XLeShop/aarvikdairyproducts',
  platform: 'xleshop',
  pickerGroup: SHOP.PICKER_GROUP,
  kind: 'shop',
  promotes: 'products',
  utm: { medium: 'social' },
  brandWords: ['Aarvik Dairy Products', 'Aarvik', 'Badam Milk on Mart', 'Milk on Mart', 'Fresh Paneer', 'Fresh Cheese', 'Pure Butter', 'Pure Ghee'],
  colours: { primary: '#1565c0', accent: '#2e7d32', background: '#f4f8fb', ink: '#1c1c1e' },
  colourSource: 'public/brand-config.js colors.primary / accent / bg / text (lines 84-90). The file marks this palette "TODO placeholder — a fresh dairy-blue palette ... Swap for Aarvik\'s real brand colours once decided" (lines 82-83).',
  logo: 'E:/projects/XLeShop/aarvikdairyproducts/public/images/logo.jpg',
  audiences: ['general', 'india'],
  regions: ['india'],
  area: null,
  areaSource: 'Not stated. faq.html: "We deliver across your delivery area — TODO: confirm and update. Please contact us via WhatsApp to confirm delivery availability for your specific location."; brand-config.js address "Aarvik Dairy Products, India" // TODO: full address; index.html title "... — TODO: confirm city". Market is India: brand-config.js country "India", timezone "Asia/Kolkata", currency ₹, +91 phone, legal.jurisdiction "IN".',
  social: {
    instagram: null,
    facebook: null,
    whatsapp: 'https://wa.me/918333989666',
    whatsappChannel: null,
    youtube: null,
    googleBusiness: null,
    source: 'WhatsApp: public/contact.html "Chat on WhatsApp" and index.html JSON-LD sameAs, both built from brand-config.js phoneWA "918333989666" (line 43). No Instagram, Facebook, YouTube or Google Business link appears in any public page; brand-config.js whatsappCommunity is disabled with an empty url.'
  },
  calendarTargets: SHOP.TARGETS,
  disclosure: SHOP.disclosure('Aarvik Dairy Products'),
  rules: SHOP.rules({
    type: 'dairy',
    market: 'india',
    pureEvidence: {
      pure: 'product/pure-butter and product/pure-ghee: products named "Pure Butter" and "Pure Ghee" (live menu.json); settings.json storefront hero slide "Pure dairy, honestly made."',
      'preservative-free': 'settings.json storefront bands: hero subtitle "... from our own herd — no additives, no middlemen." and stripe "No additives · Delivered by breakfast · Pause any day"'
    },
    allow: [],
    free: false,
    freePhrases: [],
    forbid: [
      { rule: 'aarvik-unconfirmed-bands', re: '\\bown herd\\b|\\bone herd\\b|\\bno middlem[ae]n\\b|\\bmiddle warehouse\\b|\\bfrom the farm\\b|\\bfarm[- ]fresh\\b|\\bmorning it is made\\b|\\bby breakfast\\b|\\bhonestly made\\b|\\bmilk we drank\\b', msg: 'The storefront bands in settings.json say "from our own herd", "no middlemen", "Delivered the morning it is made", "Order by evening, receive by breakfast" and "Farm-Fresh". They read as starter copy and nothing else on the site backs them: leave them out until the owner confirms them.' },
      { rule: 'aarvik-cod-only', re: '\\bupi\\b|\\bcards?\\b|\\bnet ?banking\\b|\\bpay online\\b|\\bonline payments?\\b|\\brazorpay\\b|\\bpayu\\b|\\bphonepe\\b|\\bwallet\\b', msg: 'Aarvik Dairy Products takes Cash on Delivery only (settings.json payments: cod true, razorpay/payu/phonepe false; faq.html "We currently accept Cash on Delivery (COD)"). Do not mention other ways to pay.' },
      { rule: 'aarvik-no-area', re: '\\bnear you\\b|\\bin your (city|town)\\b|\\bacross (the )?(city|town|state)\\b|\\bdeliver(s|y|ing)? (to|in|across) (the )?(whole )?(city|town|state|district|region)\\b|\\bhyderabad\\b|\\btelangana\\b', msg: 'The shop does not state its city or delivery area (faq.html: "TODO: confirm and update"). Tell people to check their area on WhatsApp; never name a place.' },
      { rule: 'aarvik-delivery-time', re: '\\b\\d\\s?[–-]\\s?\\d business days\\b|\\b24 hours\\b|\\bdelivered daily\\b|\\bdaily delivery\\b|\\bevery morning\\b', msg: 'faq.html "1–3 business days" and "processed and delivered within 24 hours" are template text, and "Delivered Daily" is starter copy: no delivery times in copy.' }
    ],
    notes: [
      'Aarvik Dairy Products sells six named products on its live menu (2026-10-05): Badam Milk on Mart and Milk on Mart (MILK), Fresh Paneer (PANEER), Fresh Cheese (CHEESE), Pure Butter (BUTTER) and Pure Ghee (GHEE). Milk on Mart and Pure Ghee were marked out of stock.',
      'Name products as the shop does in titles; in running copy "paneer", "butter" and "ghee" read better, and keep "pure" out of copy (it is only in the product names, owner to confirm).',
      'How to order, from the cart and FAQ: add to basket, enter a WhatsApp/mobile number (verified by a one-time code, then a PIN), address and delivery slot, place the order, pay cash on delivery. An Order Status page tracks it; orders can be cancelled until they are packed.',
      'Phone and WhatsApp hours on contact.html: Mon–Sat, 9 am – 7 pm. The site takes orders online at any time ("Browse and order online 24/7").',
      'No city or delivery area is stated: send people to WhatsApp to check their location, as the FAQ does.'
    ]
  }),
  items: [
    {
      id: 'badam-milk',
      path: '/product/badam-milk-on-mart',
      title: 'Badam Milk on Mart',
      group: 'milk',
      audiences: ['general', 'india'],
      hook: 'Badam milk at the door, paid in cash when it arrives.',
      pain: 'Everyone at home asks for badam milk and the corner shop has run out again.',
      usual: ['Checking the corner shop on the way home', 'Asking someone to pick it up'],
      promise: 'Aarvik Dairy Products lists Badam Milk in its MILK range. Order it on the site and pay cash on delivery.',
      steps: ORDER_STEPS,
      cta: 'Order badam milk from Aarvik Dairy Products',
      facts: ['Listed as "Badam Milk on Mart" in the MILK category', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/badam-milk-on-mart.html (live 200) + live menu.json item "Badam Milk on Mart", category MILK; details.json body "Badam Milk"'
    },
    {
      id: 'fresh-paneer',
      path: '/product/fresh-paneer',
      title: 'Fresh Paneer',
      group: 'paneer',
      audiences: ['general', 'india'],
      hook: 'Paneer for tonight\'s curry, ordered before you leave work.',
      pain: 'I plan a paneer dish and find out at six that the shop down the road has none.',
      usual: ['Going from shop to shop for paneer', 'Changing the menu at the last minute'],
      promise: 'Fresh Paneer is on the Aarvik Dairy Products menu. Add it to your basket, choose a delivery slot and pay cash at the door.',
      steps: ORDER_STEPS,
      cta: 'Order paneer from Aarvik Dairy Products',
      facts: ['Fresh Paneer, in the PANEER category', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/fresh-paneer.html (live 200) + live menu.json item "Fresh Paneer", category PANEER; /c/paneer'
    },
    {
      id: 'fresh-cheese',
      path: '/product/fresh-cheese',
      title: 'Fresh Cheese',
      group: 'cheese',
      audiences: ['general', 'india'],
      hook: 'Cheese for the sandwiches, on the same order as the paneer.',
      pain: 'Cheese is the one thing I always forget, and it means a second trip out.',
      usual: ['A separate trip to the supermarket', 'Doing without until the weekend shop'],
      promise: 'Aarvik Dairy Products sells Fresh Cheese alongside its milk, paneer and butter, so it goes in the same basket.',
      steps: ORDER_STEPS,
      cta: 'Add cheese to your Aarvik Dairy Products order',
      facts: ['Fresh Cheese, in the CHEESE category', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/fresh-cheese.html (live 200) + live menu.json item "Fresh Cheese", category CHEESE; /c/cheese'
    },
    {
      id: 'butter',
      path: '/product/pure-butter',
      title: 'Pure Butter',
      group: 'butter',
      audiences: ['general', 'india'],
      hook: 'Butter on the list? Add it to your dairy order and skip the extra trip.',
      pain: 'We run out of butter mid-week and nobody wants to go out just for that.',
      usual: ['A special trip to the shop', 'Waiting for the weekly shop'],
      promise: 'Aarvik Dairy Products has butter in its BUTTER category. Order it with the rest of your dairy and pay cash on delivery.',
      steps: ORDER_STEPS,
      cta: 'Order butter from Aarvik Dairy Products',
      facts: ['Listed as "Pure Butter" in the BUTTER category', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/pure-butter.html (live 200) + live menu.json item "Pure Butter", category BUTTER; /c/butter'
    },
    {
      id: 'cash-on-delivery',
      path: '/faq',
      title: 'Cash on Delivery',
      group: 'ordering',
      audiences: ['general', 'india'],
      hook: 'Order your dairy online and pay in cash when it arrives.',
      pain: 'I would rather pay at the door than pay a website before I have seen the order.',
      usual: ['Paying at the shop counter', 'Phoning an order through and hoping it comes'],
      promise: 'Aarvik Dairy Products takes Cash on Delivery: you order on the site and pay when the order reaches you.',
      steps: ['Add your dairy to the basket on the site', 'Enter your mobile number, address and delivery slot', 'Pay cash when the order arrives'],
      cta: 'Order from Aarvik Dairy Products, pay on delivery',
      facts: ['"We currently accept Cash on Delivery (COD)."', 'There is no minimum order value for delivery'],
      source: 'public/faq.html "What payment methods do you accept?" and "Do you have a minimum order value?" (live /faq 200) + live settings.json payments { cod: true, razorpay: false, payu: false, phonepe: false }'
    },
    {
      id: 'track-or-cancel',
      path: '/refund',
      title: 'Track or cancel an order',
      group: 'ordering',
      audiences: ['general', 'india'],
      hook: 'Changed your plans? Cancel the order before it is packed.',
      pain: 'Plans change after I have ordered, and I never know if it is too late to stop it.',
      usual: ['Calling the shop and hoping someone answers', 'Taking the delivery anyway'],
      promise: 'Every order gets an Order Status page with a tracking link. Until the order is packed you can cancel it there or on WhatsApp.',
      steps: ['Place your order on the site', 'Keep the Order Status link from your confirmation', 'Cancel from that page or on WhatsApp before it is packed'],
      cta: 'Order from Aarvik Dairy Products',
      facts: ['"You\'ll receive an order confirmation with a tracking link."', 'Before packing: you may cancel your order. Use the Order Status page or contact us on WhatsApp', 'Damaged or incorrect items: send a photo via WhatsApp; the refund page gives the time limit'],
      source: 'public/refund.html "Cancellations" and "Refunds" (live /refund 200) + public/faq.html "Can I cancel my order?" and "How do I track my order?"'
    },
    {
      id: 'whatsapp-contact',
      path: '/contact',
      title: 'Phone and WhatsApp',
      group: 'contact',
      audiences: ['general', 'india'],
      hook: 'Not sure Aarvik delivers to you? Ask on WhatsApp before you order.',
      pain: 'I never know if a dairy delivers to my street until I have filled in the whole order.',
      usual: ['Filling in the order and hoping', 'Asking around the building'],
      promise: 'Aarvik Dairy Products answers on phone and WhatsApp, Monday to Saturday, 9 am to 7 pm, and asks you to check your location there.',
      steps: ['Open the Contact page and tap Chat on WhatsApp', 'Ask whether they deliver to your area', 'Order on the site'],
      cta: 'Message Aarvik Dairy Products on WhatsApp',
      facts: ['Phone / WhatsApp: available Mon–Sat, 9 am – 7 pm', '"Please contact us via WhatsApp to confirm delivery availability for your specific location."', 'Browse and order online 24/7'],
      source: 'public/contact.html (live /contact 200) + public/faq.html "What areas do you deliver to?"; number from brand-config.js phone / phoneWA'
    },
    {
      id: 'regular-delivery',
      path: '/',
      title: 'Regular deliveries',
      group: 'subscriptions',
      audiences: ['general', 'india'],
      hook: 'The same dairy every week? Set it up once as a regular delivery.',
      pain: 'I order the same milk and paneer every week and type it all in again each time.',
      usual: ['Re-ordering the same things by hand', 'Messaging the same list every week'],
      promise: 'The Aarvik Dairy Products basket has a Subscribe option for regular delivery, so a repeat order is set up once.',
      steps: ['Add your usual items to the basket', 'Choose the subscribe (regular delivery) option in the basket', 'Pay cash on delivery'],
      cta: 'Set up regular delivery with Aarvik Dairy Products',
      facts: ['"Subscribe for regular deliveries"', 'Basket button: "Subscribe & Save (regular delivery)"'],
      source: 'public/index.html meta description "... Subscribe for regular deliveries and save time." and the basket\'s "Subscribe & Save (regular delivery)" / "Set up subscription" (live / 200); brand-config.js features.subscriptions true'
    }
  ],
  notConfirmed: [
    'Prices, the struck-through "basePrice" and promo prices in menu.json (e.g. Fresh Paneer and Fresh Cheese show a promo price): never used.',
    'Free delivery: brand-config.js freeDeliveryMin 1 / deliveryCharge 0 and a splash slide "Free Delivery — On all orders — always free" (marked "TODO: placeholder copy"), but the slot fallback charges for the Day slot and faq.html says "very small orders may incur a delivery charge". Not used; "free" stays refused.',
    'Delivery slot windows (Morning 6–9 AM, Day 9 AM–5 PM, Evening 5–9 PM) and their charges: brand-config.js fallback values; the live checkout reads slots from the API, which was not called. Copy says only "choose a delivery slot".',
    'Delivery area and city: faq.html "We deliver across your delivery area — TODO: confirm and update"; address "Aarvik Dairy Products, India" // TODO; live home-page title and meta description contain "TODO: confirm city".',
    'Delivery times: faq.html "typically delivered within 1–3 business days" and "Milk is processed and delivered within 24 hours" are template wording shared with other XLeShop dairy shops; not used.',
    'Storefront bands in settings.json: "Pure dairy, honestly made.", "Milk, curd, paneer and ghee from our own herd — no additives, no middlemen.", "Delivered the morning it is made.", "Order by evening, receive by breakfast.", "One herd. One dairy. Your kitchen.", "No additives · Delivered by breakfast · Pause any day". Unconfirmed claims (and the menu has no curd): blocked by aarvik-unconfirmed-bands and the dairy rules.',
    'Tagline "Fresh Dairy Products Delivered to Your Door" is marked "TODO: placeholder — confirm real tagline wording"; topbar "Fresh Dairy Products Delivered Daily", hero "Fresh dairy, every day." and landing promo "BESTSELLER" are starter copy: not used.',
    'Splash slide "Health is Wealth — Fresh, quality dairy for your whole family" (marked TODO placeholder copy): a health line, excluded.',
    'Landing subscription plans "Daily milk basket", "Weekly dairy pack", "Family essentials" with prices and "save 8% / 12%": placeholder prices and savings, excluded.',
    'Vouchers / promo codes (faq.html "I have a discount voucher"), wallet credit and loyalty tiers: features of the platform, no running offer shown; excluded by the offer rules.',
    'Product "test" (id TEST, category BUTTER, description "test") is active in the live menu and has a live page /product/test listed in sitemap.xml: not an item.',
    'Online payments: faq.html "Online payment options will be added soon"; Razorpay/PayU/PhonePe all off. Not promoted.',
    'Product detail bodies: details.json has only "Badam Milk" for item 2; the product pages carry no description beyond the name.',
    'Stores page (/stores): reads stores.json from the CDN; not fetched, and no header link was seen for this shop.'
  ],
  todo: [
    'Live home-page <title> and meta description read "— TODO: confirm city": the owner should give the city/area, which would also let this profile name it.',
    'faq.html "What areas do you deliver to?" still says "TODO: confirm and update".',
    'brand-config.js address and legal.registeredAddress are "Aarvik Dairy Products, India" // TODO: full address; governingLawCity and the DPDP grievance officer name are empty.',
    'brand-config.js tagline is marked "TODO: placeholder — confirm real tagline wording"; the colour palette is marked "TODO placeholder" (colours in this profile follow it until replaced).',
    'Product names "Milk on Mart" and "Badam Milk on Mart" look like a leftover from the KBK Mart template: owner to confirm or rename.',
    'Remove or deactivate the "test" product (live at /product/test and in sitemap.xml).',
    'Milk on Mart (/product/milk-on-mart) and Pure Ghee (/product/pure-ghee) were out of stock on 2026-10-05, so they are not items (the calendar would schedule them); add them back when they are in stock, as KBK Mart\'s profile does for the same two products (removed by the lead, 2026-10-05).',
    'Confirm subscriptions are switched on in the backend (brand-config.js says "enable after setupSubscriptionTrigger()") before posting the regular-delivery item.',
    'settings.json storefront bands ("own herd", "no additives", "by breakfast", "Pure dairy") are live on the storefront: owner to confirm or replace them.',
    'No Instagram, Facebook or Google Business link on the site: add them to the footer if the shop has them, then to this profile.'
  ],
  checked: '2026-10-05'
};
