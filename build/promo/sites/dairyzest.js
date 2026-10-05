'use strict';
/** Site profile: DairyZest, a shop on XLeShop. Read from E:/projects/XLeShop/dairyzest (read-only; git
 *  https://github.com/vmanthani/dairyzest.git, last commit 2d052e1 2026-10-02; firebase project dairyzest-2026) and the
 *  live site https://dairyzest.com on 2026-10-05, plus the public menu.json / settings.json / details.json under
 *  xleshop-menu.storage.googleapis.com/dz/. A dairy shop in Hyderabad, Telangana selling butter, paneer and curd in
 *  several pack sizes (up to 20 kg curd), Cash on Delivery only. The newest XLeShop tenant: its live catalogue has
 *  nine products in three categories; the delivery-area FAQ answer is still a TODO. */
const SHOP = require('./_shop');

const ORDER_STEPS = [
  'Add it to your basket on dairyzest.com',
  'Enter your mobile number, your address and a delivery slot',
  'Place the order and pay cash on delivery'
];

module.exports = {
  id: 'dairyzest',
  name: 'DairyZest',
  baseUrl: 'https://dairyzest.com',
  domainSource: 'public/brand-config.js domain "dairyzest.com" / url "https://dairyzest.com" (lines 28-29); public/sitemap.xml <loc>https://dairyzest.com/... (19 URLs); curl https://dairyzest.com/ and https://www.dairyzest.com/ both end 200 at https://dairyzest.com/ (no www) on 2026-10-05, title "DairyZest – Fresh Dairy Products delivered to your door in Hyderabad". Canonical tags are written empty (href="") and filled by script. Clean URLs: /faq.html 301s to /faq, so items use extensionless paths.',
  repo: 'E:/projects/XLeShop/dairyzest',
  platform: 'xleshop',
  pickerGroup: SHOP.PICKER_GROUP,
  kind: 'shop',
  promotes: 'products',
  utm: { medium: 'social' },
  brandWords: ['DairyZest', 'Taste That Cares'],
  colours: { primary: '#1B5E28', accent: '#C8A068', background: '#FAF8F3', ink: '#1c1c1e' },
  colourSource: 'public/brand-config.js colors.primary / accent / bg / text (lines 94-99), "Sampled from the DairyZest logo: deep forest green wordmark + gold ribbon. Not a placeholder any more." (lines 91-92)',
  logo: 'E:/projects/XLeShop/dairyzest/public/images/logo.png',
  audiences: ['general', 'india'],
  regions: ['india'],
  area: 'Hyderabad, Telangana',
  areaSource: 'public/contact.html JSON-LD areaServed [State "Telangana", City "Hyderabad"] and meta description "... dairy delivery in your area in Hyderabad, Telangana"; index.html title "DairyZest – Fresh Dairy Products delivered to your door in Hyderabad"; brand-config.js address "DairyZest, Hyderabad, Telangana, India". Exact delivery area within the city not stated: faq.html "We deliver across your delivery area — TODO: confirm and update. Please contact us via WhatsApp to confirm delivery availability for your specific location."',
  social: {
    instagram: null,
    facebook: null,
    whatsapp: 'https://wa.me/917013455700',
    whatsappChannel: null,
    youtube: null,
    googleBusiness: null,
    source: 'WhatsApp: public/contact.html "Chat on WhatsApp" and index.html JSON-LD sameAs, both built from brand-config.js phoneWA "917013455700" (line 49). No Instagram, Facebook, YouTube or Google Business link appears in any public page; whatsappCommunity is disabled with an empty url.'
  },
  calendarTargets: SHOP.TARGETS,
  disclosure: SHOP.disclosure('DairyZest'),
  rules: SHOP.rules({
    type: 'dairy',
    market: 'india',
    pureEvidence: {
      pure: 'live menu.json description of Butter 200 g / 500 g / 1 kg: "Fresh creamy butter, churned from pure dairy cream."',
      'preservative-free': 'settings.json storefront band "Two ingredients. Cream and time." / "No colour, no preservative, no \\"spread\\". Just butter, the way a dairy makes it."'
    },
    allow: [],
    free: false,
    freePhrases: [],
    forbid: [
      { rule: 'dairyzest-unconfirmed-bands', re: '\\bmade this morning\\b|\\bdelivered cold\\b|\\bnothing else in it\\b|\\bsmall batch(es)?\\b|\\bslow[- ]churned\\b|\\bcut to order\\b|\\bfarm[- ]fresh\\b|\\bmade daily\\b|\\btwo ingredients\\b|\\bno colou?r\\b|\\bthe way it used to taste\\b', msg: 'The storefront bands (settings.json) and descriptions say "Paneer made this morning", "made daily", "Delivered cold", "Slow-churned", "small batches", "Nothing else in it", "No colour, no preservative". The desk cannot check them: leave them out until the owner confirms.' },
      { rule: 'dairyzest-not-on-menu', re: '\\bghee\\b|\\bcheese\\b|\\b(fresh|daily|buy|order|our) milk\\b|\\bmilk (delivery|delivered|subscriptions?|packets?|bottles?)\\b', msg: 'The live menu (2026-10-05) has only butter, paneer and curd. The topbar, footer and meta descriptions mention milk and ghee, but neither is on sale: do not promote them.' },
      { rule: 'dairyzest-cod-only', re: '\\bupi\\b|\\bcards?\\b|\\bnet ?banking\\b|\\bpay online\\b|\\bonline payments?\\b|\\brazorpay\\b|\\bpayu\\b|\\bphonepe\\b|\\bwallet\\b', msg: 'DairyZest takes Cash on Delivery only (settings.json payments: cod true, others false; faq.html "We currently accept Cash on Delivery (COD)"). Do not mention other ways to pay.' },
      { rule: 'dairyzest-delivery-time', re: '\\b\\d\\s?[–-]\\s?\\d business days\\b|\\b24 hours\\b|\\bdelivered daily\\b|\\bdaily delivery\\b|\\bevery morning\\b', msg: 'faq.html "1–3 business days" and "within 24 hours" are template wording; "Delivered Daily" is starter copy. No delivery times in copy.' },
      { rule: 'dairyzest-area', re: '\\b(all|across|anywhere in|every part of|the whole of) (of )?(hyderabad|telangana)\\b|\\bhyderabad[- ]wide\\b|\\btelangana\\b', msg: 'The shop names Hyderabad, but the FAQ says to check your location on WhatsApp ("TODO: confirm and update"). Say "in Hyderabad" and "check your area on WhatsApp"; never "all of Hyderabad" or the state.' }
    ],
    notes: [
      'DairyZest\'s live menu (2026-10-05) has nine products in three categories: BUTTER (Butter 200 g, 500 g, 1 kg), PANEER (Paneer 500 g, 1 kg) and CURD (Curd 1 kg, 5 kg, 10 kg, 20 kg). No milk, ghee or cheese, although some page text mentions them.',
      'The tagline "Taste That Cares" is from the logo\'s own ribbon (brand-config.js), fine to use as the shop\'s name line.',
      'How to order, from the basket and FAQ: add to basket, enter a WhatsApp/mobile number (verified by a one-time code, then a PIN), address and delivery slot, place the order, pay cash on delivery. An Order Status page tracks it; orders can be cancelled until they are packed.',
      'Phone and WhatsApp hours on contact.html: Mon–Sat, 9 am – 7 pm; ordering on the site at any time.',
      'Area: Hyderabad (contact.html areaServed, home title). The FAQ asks people to check their location on WhatsApp, so copy should too.',
      '"Fresh" in product descriptions and "pure" in the butter description warn as owner-to-confirm (FSSAI Schedule V): keep them out of hooks.'
    ]
  }),
  items: [
    {
      id: 'butter-200-g',
      path: '/product/butter-200-g',
      title: 'Butter 200 g',
      group: 'butter',
      audiences: ['general', 'india'],
      hook: 'A 200 g block of butter, small enough to finish while it is at its best.',
      pain: 'A big tub of butter sits in our fridge for weeks; we only need a little at a time.',
      usual: ['Buying the biggest pack on the shelf', 'Picking up butter on the next big shop'],
      promise: 'DairyZest sells its butter in a 200 g pack for small households, with 500 g and 1 kg packs beside it.',
      steps: ORDER_STEPS,
      cta: 'Order DairyZest butter, 200 g',
      facts: ['Butter in 200 g, 500 g and 1 kg packs', 'The 200 g, for toast. Small enough to finish while it is at its best', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/butter-200-g.html (live 200) + live menu.json "Butter 200 g", unit 200 g, category BUTTER; settings.json band "The 200 g, for toast. Small enough to finish while it is at its best."'
    },
    {
      id: 'butter-500-g',
      path: '/product/butter-500-g',
      title: 'Butter 500 g',
      group: 'butter',
      audiences: ['general', 'india'],
      hook: 'Butter for the week, in a 500 g pack from DairyZest.',
      pain: 'We get through butter faster than we can remember to buy it.',
      usual: ['Several small packs from the corner shop', 'Running out halfway through the week'],
      promise: 'DairyZest\'s 500 g butter pack sits between the 200 g and the 1 kg, and goes in the same basket as paneer and curd.',
      steps: ORDER_STEPS,
      cta: 'Order DairyZest butter, 500 g',
      facts: ['Butter in 200 g, 500 g and 1 kg packs', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/butter-500-g.html (live 200) + live menu.json "Butter 500 g", unit 500 g, category BUTTER'
    },
    {
      id: 'butter-1-kg',
      path: '/product/butter-1-kg',
      title: 'Butter 1 kg',
      group: 'butter',
      audiences: ['general', 'india', 'smallbiz'],
      hook: 'Baking, a big family or a small kitchen business? DairyZest butter comes in 1 kg.',
      pain: 'I use butter by the kilo and small packs mean a pile of wrappers and constant re-buying.',
      usual: ['Buying several small packs', 'A trip to the wholesale market'],
      promise: 'DairyZest sells butter in a 1 kg pack, ordered online in Hyderabad and paid in cash on delivery.',
      steps: ORDER_STEPS,
      cta: 'Order DairyZest butter, 1 kg',
      facts: ['Butter 1 kg, in the BUTTER category', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/butter-1-kg.html (live 200) + live menu.json "Butter 1 kg", unit 1 kg, category BUTTER; /c/butter'
    },
    {
      id: 'paneer-500-g',
      path: '/product/paneer-500-g',
      title: 'Paneer 500 g',
      group: 'paneer',
      audiences: ['general', 'india'],
      hook: 'The 500 g paneer, for weeknight curries.',
      pain: 'I want paneer for dinner and the shop near us only has it some days.',
      usual: ['Checking two or three shops for paneer', 'Changing the menu at the last minute'],
      promise: 'DairyZest sells paneer in a 500 g pack, enough for a curry, ordered from your phone in Hyderabad.',
      steps: ORDER_STEPS,
      cta: 'Order DairyZest paneer, 500 g',
      facts: ['Paneer in 500 g and 1 kg packs', 'The 500 g, for weeknights. Enough for a curry', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/paneer-500-g.html (live 200) + live menu.json "Paneer 500 g", unit 500 g, category PANEER; settings.json band "The 500 g, for weeknights." / "Enough for a curry, ..."'
    },
    {
      id: 'paneer-1-kg',
      path: '/product/paneer-1-kg',
      title: 'Paneer 1 kg',
      group: 'paneer',
      audiences: ['general', 'india', 'smallbiz'],
      hook: 'Cooking for a crowd? DairyZest paneer comes in 1 kg.',
      pain: 'For a function or a family get-together I need a lot of paneer, and small packs never add up.',
      usual: ['Buying every pack the shop has', 'Ordering ahead from a sweet shop'],
      promise: 'DairyZest sells paneer in a 1 kg pack alongside the 500 g, delivered in Hyderabad and paid in cash on delivery.',
      steps: ORDER_STEPS,
      cta: 'Order DairyZest paneer, 1 kg',
      facts: ['Paneer in 500 g and 1 kg packs', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/paneer-1-kg.html (live 200) + live menu.json "Paneer 1 kg", unit 1 kg, category PANEER; /c/paneer'
    },
    {
      id: 'curd-1-kg',
      path: '/product/curd-1-kg',
      title: 'Curd 1 kg',
      group: 'curd',
      audiences: ['general', 'india'],
      hook: 'Thick set curd for the family table, in a 1 kg pack.',
      pain: 'We go through curd every day and the little cups run out by lunch.',
      usual: ['Several small cups from the shop', 'Setting curd at home and hoping it sets'],
      promise: 'DairyZest sells thick set curd in a 1 kg pack, with 5, 10 and 20 kg packs for bigger kitchens.',
      steps: ORDER_STEPS,
      cta: 'Order DairyZest curd, 1 kg',
      facts: ['Thick set curd', 'Curd in 1 kg, 5 kg, 10 kg and 20 kg packs', 'Payment: Cash on Delivery (COD)'],
      source: 'public/product/curd-1-kg.html (live 200) + live menu.json "Curd 1 kg", unit 1 kg, category CURD, description "Thick set curd, naturally cultured."'
    },
    {
      id: 'curd-catering-sizes',
      path: '/c/curd',
      title: 'Curd by the kilo',
      group: 'curd',
      audiences: ['general', 'india', 'smallbiz'],
      hook: 'Curd by the kilo: 5, 10 and 20 kg packs for caterers, messes and big events.',
      pain: 'For a wedding lunch or a mess kitchen I need curd in bulk, not in little cups.',
      usual: ['Buying dozens of small packs', 'Ordering from a wholesaler a day ahead'],
      promise: 'DairyZest sells thick set curd in family and catering sizes: 5 kg, 10 kg and 20 kg, as well as 1 kg.',
      steps: ['Open the CURD category on dairyzest.com', 'Pick the 5 kg, 10 kg or 20 kg pack', 'Choose a delivery slot and pay cash on delivery'],
      cta: 'See DairyZest curd sizes',
      facts: ['Curd by the kilo. Thick, set curd in family and catering sizes', 'Curd 5 kg, Curd 10 kg, Curd 20 kg', 'Payment: Cash on Delivery (COD)'],
      source: 'public/c/curd.html (live /c/curd 200) and product pages curd-5-kg, curd-10-kg, curd-20-kg (all live 200) + live menu.json CURD items; settings.json hero slide "Curd by the kilo." / "Thick, set curd in family and catering sizes"'
    },
    {
      id: 'cash-on-delivery',
      path: '/faq',
      title: 'Cash on Delivery',
      group: 'ordering',
      audiences: ['general', 'india'],
      hook: 'Order butter, paneer and curd online and pay in cash at the door.',
      pain: 'I would rather pay at the door than pay a website before I have seen the order.',
      usual: ['Paying at the shop counter', 'Phoning an order through and hoping it comes'],
      promise: 'DairyZest takes Cash on Delivery: order on dairyzest.com and pay when the order reaches you. There is no minimum order value.',
      steps: ['Add butter, paneer or curd to the basket', 'Enter your mobile number, address and delivery slot', 'Pay cash when the order arrives'],
      cta: 'Order from DairyZest, pay on delivery',
      facts: ['"We currently accept Cash on Delivery (COD)."', 'There is no minimum order value for delivery'],
      source: 'public/faq.html "What payment methods do you accept?" and "Do you have a minimum order value?" (live /faq 200) + live settings.json payments { cod: true, razorpay: false, payu: false, phonepe: false }'
    },
    {
      id: 'track-or-cancel',
      path: '/refund',
      title: 'Track or cancel an order',
      group: 'ordering',
      audiences: ['general', 'india'],
      hook: 'Plans changed? Cancel your DairyZest order before it is packed.',
      pain: 'Plans change after I have ordered, and I never know if it is too late to stop it.',
      usual: ['Calling the shop and hoping someone answers', 'Taking the delivery anyway'],
      promise: 'Every order gets an Order Status page with a tracking link. Until the order is packed you can cancel it there or on WhatsApp.',
      steps: ['Place your order on dairyzest.com', 'Keep the Order Status link from your confirmation', 'Cancel from that page or on WhatsApp before it is packed'],
      cta: 'Order from DairyZest',
      facts: ['"You\'ll receive an order confirmation with a tracking link."', 'Before packing: you may cancel your order. Use the Order Status page or contact us on WhatsApp', 'Damaged or incorrect items: send a photo via WhatsApp; the refund page gives the time limit'],
      source: 'public/refund.html "Cancellations" and "Refunds" (live /refund 200) + public/faq.html "Can I cancel my order?" and "How do I track my order?"'
    },
    {
      id: 'whatsapp-hyderabad',
      path: '/contact',
      title: 'Phone and WhatsApp, Hyderabad',
      group: 'contact',
      audiences: ['general', 'india'],
      hook: 'In Hyderabad? Ask DairyZest on WhatsApp whether they deliver to your area.',
      pain: 'I never know if a dairy delivers to my street until I have filled in the whole order.',
      usual: ['Filling in the order and hoping', 'Asking around the building'],
      promise: 'DairyZest serves Hyderabad and answers on phone and WhatsApp, Monday to Saturday, 9 am to 7 pm. The FAQ asks you to check your location there.',
      steps: ['Open the Contact page and tap Chat on WhatsApp', 'Ask whether they deliver to your area', 'Order on dairyzest.com'],
      cta: 'Message DairyZest on WhatsApp',
      facts: ['Phone / WhatsApp: available Mon–Sat, 9 am – 7 pm', '"Please contact us via WhatsApp to confirm delivery availability for your specific location."', 'Browse and order online 24/7'],
      source: 'public/contact.html (live /contact 200; areaServed Hyderabad, Telangana) + public/faq.html "What areas do you deliver to?"; number from brand-config.js phone / phoneWA'
    },
    {
      id: 'regular-delivery',
      path: '/',
      title: 'Regular deliveries',
      group: 'subscriptions',
      audiences: ['general', 'india'],
      hook: 'Same curd and paneer every week? Set it up once as a regular delivery.',
      pain: 'I order the same curd and paneer every week and type it all in again each time.',
      usual: ['Re-ordering the same things by hand', 'Messaging the same list every week'],
      promise: 'The DairyZest basket has a Subscribe option for regular delivery, so a repeat order is set up once.',
      steps: ['Add your usual items to the basket', 'Choose the subscribe (regular delivery) option in the basket', 'Pay cash on delivery'],
      cta: 'Set up regular delivery with DairyZest',
      facts: ['"Subscribe for regular deliveries"', 'Basket button: "Subscribe & Save (regular delivery)"'],
      source: 'public/index.html meta description "... Subscribe for regular deliveries and save time." and the basket\'s "Subscribe & Save (regular delivery)" / "Set up subscription" (live / 200); SETUP_CHECKLIST.md "Features on: subscriptions"'
    }
  ],
  notConfirmed: [
    'Prices in menu.json (all nine products): never used.',
    'Free delivery: brand-config.js freeDeliveryMin 1 / deliveryCharge 0 and a splash slide "Free Delivery — On all orders — always free" (marked "TODO: placeholder copy"); the slot fallback charges for the Day slot and faq.html says small orders "may incur a delivery charge". Not used; "free" stays refused.',
    'Delivery slot windows (Morning 6–9 AM, Day 9 AM–5 PM, Evening 5–9 PM): brand-config.js marks them "TODO: confirm these windows suit DairyZest\'s actual delivery operation". Copy says only "choose a delivery slot".',
    'Delivery area inside Hyderabad: faq.html "We deliver across your delivery area — TODO: confirm and update".',
    'Delivery times: faq.html "typically delivered within 1–3 business days" and "Milk is processed and delivered within 24 hours" are template wording (and the shop sells no milk); settings.json "from our dairy to your kitchen the same day": blocked (same-day).',
    'Storefront bands in settings.json: "Paneer made this morning.", "Soft, fresh, cut to order", "Slow-churned", "Butter the way it used to taste.", "Cultured cream, churned in small batches. Nothing else in it.", "Two ingredients. Cream and time.", "No colour, no preservative, no \\"spread\\"", "Made this morning · Delivered cold · Family & catering sizes". Production and delivery claims the desk cannot check; only "family and catering sizes" (true of the 5/10/20 kg packs) and "Curd by the kilo" are used.',
    'Product descriptions: butter "Fresh creamy butter, churned from pure dairy cream." ("pure" and "fresh": FSSAI Schedule V, owner to confirm); paneer "Soft fresh paneer, made daily from full-cream milk." ("made daily" unconfirmed); curd "Thick set curd, naturally cultured." (only "thick set curd" used).',
    'Milk and ghee: named in the topbar ("Farm-Fresh Dairy Delivered Daily"), footer ("milk, curd, paneer, ghee and more"), meta descriptions and the landing copy, but neither is on the live menu. Not promoted.',
    'Splash slide "Pure & Natural — Quality dairy for your whole family" and landing promo "BESTSELLER": marked TODO placeholder copy; excluded.',
    'Landing subscription plans with prices and "save 8% / 12%" (brand-config.js "TODO: placeholder pricing"): excluded.',
    'Vouchers / promo codes, wallet credit, loyalty tiers: platform features, no running offer shown; excluded by the offer rules.',
    'Online payments: faq.html "Online payment options will be added soon"; not promoted.',
    'details.json is empty (no rich product bodies); the product pages show only the product name.',
    'SETUP_CHECKLIST.md and ASSETS_NEEDED.md (2026-09-10) still list the phone, city, colours and images as missing; brand-config.js and the live site have since filled them (phone +91 70134 55700, Hyderabad, logo-sampled colours, product photos in images/home). The checklist is out of date, not the site.'
  ],
  todo: [
    'Owner to confirm: the phone / WhatsApp number in brand-config.js (+91 70134 55700, phoneWA 917013455700) is the same number KBK Dairy Products uses, and KBK Mart\'s copy of it is marked "TODO: replace with KBK Mart\'s own number". Check it is really DairyZest\'s before any post sends people to it (added by the lead, 2026-10-05).',
    'faq.html "What areas do you deliver to?" still says "TODO: confirm and update": owner to give the delivery area within Hyderabad.',
    'Delivery slot windows in brand-config.js are marked "TODO: confirm"; subscription plan prices are "TODO: placeholder pricing"; splash slides are "TODO: placeholder copy".',
    'brand-config.js legal.entityName is "TODO: registered legal/trading name" and the DPDP grievance officer name is empty.',
    'Topbar, footer and meta descriptions mention milk and ghee, which the live menu does not sell: owner to add them or change the text.',
    'settings.json storefront bands ("made this morning", "delivered cold", "nothing else in it", "same day") are live on the storefront: owner to confirm or soften them.',
    'Confirm subscriptions run in the backend before posting the regular-delivery item.',
    'No Instagram, Facebook or Google Business link on the site: add them to the footer if the shop has them, then to this profile.'
  ],
  checked: '2026-10-05'
};
