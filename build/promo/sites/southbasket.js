'use strict';
/** Site profile: South Basket, a shop on XLeShop. Read from E:/projects/XLeShop/SouthBasket (read-only; git
 *  https://github.com/vmanthani/SouthBasket.git, firebase project southbasketin) and the live site
 *  https://southbasket.co.in on 2026-10-05, with the live menu.json / settings.json the storefront loads
 *  (xleshop-menu.storage.googleapis.com/sb/). South Indian groceries and pooja items (rice, greens, oils, filter
 *  coffee, snacks, appalam, Ganesh and Varalakshmi pooja items) delivered in Delhi NCR. */
const SHOP = require('./_shop');
module.exports = {
  id: 'southbasket',
  name: 'South Basket',
  baseUrl: 'https://southbasket.co.in',
  domainSource: 'public/brand-config.js domain "southbasket.co.in" and url "https://southbasket.co.in" (lines 21-22); public/sitemap.xml <loc>s (21 pages + 181 products); index.html sets the canonical to BRAND.url (non-www); curl https://southbasket.co.in/ -> 200 on 2026-10-05, title "South Basket – Fresh South Indian Groceries Delivered in NCR"; live brand-config.js identical to the repo. www.southbasket.co.in also answers 200 but the canonical and sitemap use the bare domain. Clean URLs (/faq.html redirects to /faq).',
  repo: 'E:/projects/XLeShop/SouthBasket',
  platform: 'xleshop',
  pickerGroup: SHOP.PICKER_GROUP,
  kind: 'shop',
  promotes: 'products',
  utm: { medium: 'social' },
  brandWords: ['South Basket', 'SouthBasket', 'Aishwarya', 'Lalitha', 'Rajabhogam', 'Ponni', 'Akshaya', 'Idhayam', 'Nandini', 'GRB', 'Cothas', 'Udhayam', 'Bru', 'Rajam', 'Ambica', 'Meenakshi', 'Gongura', 'Varalakshmi', 'Ganesh'],
  colours: { primary: '#1b8a5a', accent: '#ff6b2c', background: '#f6f7f9', ink: '#1c1c1c' },
  colourSource: 'public/brand-config.js colors.primary / accent / bg / text (lines 80, 82, 84, 85)',
  logo: 'E:/projects/XLeShop/SouthBasket/public/images/logo.png',
  audiences: ['general', 'india'],
  regions: ['india'],
  area: 'Delhi NCR: Delhi, Noida, Gurugram, Ghaziabad and Faridabad',
  areaSource: 'public/faq.html: "We currently deliver across Delhi, Noida, Gurugram, Ghaziabad and Faridabad in the NCR region. Please contact us via WhatsApp to confirm delivery availability for your specific area."; brand-config.js tagline "Fresh Groceries Delivered Across NCR"',
  social: {
    instagram: null,
    facebook: null,
    whatsapp: 'https://wa.me/919810183569',
    whatsappChannel: null,
    whatsappCommunity: 'https://chat.whatsapp.com/DoAQTWj0vicJmjIwlfq3FW',
    youtube: null,
    googleBusiness: null,
    source: 'WhatsApp: index.html schema sameAs ["https://wa.me/" + BRAND.phoneWA], phoneWA "919810183569" in brand-config.js, contact.html "Chat on WhatsApp". WhatsApp Community: brand-config.js whatsappCommunity (enabled true, url chat.whatsapp.com/DoAQTWj0vicJmjIwlfq3FW), shown by storefront.js as a popup and link. No Instagram, Facebook, YouTube or Maps profile is linked.'
  },
  calendarTargets: SHOP.TARGETS,
  disclosure: SHOP.disclosure('South Basket'),
  rules: SHOP.rules({
    type: 'grocery',
    market: 'india',
    allow: [],
    free: false,
    freePhrases: [],
    forbid: [
      { rule: 'sb-cod', re: '\\bcash on delivery\\b|\\bcod\\b|\\bpay (in cash|cash) (on|at) (delivery|the door)\\b', msg: 'Cash on delivery is switched off in the live store settings (payments.cod false; Razorpay on), although the FAQ and a banner still mention it. Say "pay online at checkout" until the owner switches COD back on.' },
      { rule: 'sb-farm-morning', re: '\\bfarm[- ]fresh\\b|\\bevery morning\\b|\\bdaily from\\b|\\bsourced (fresh )?(daily|every)\\b|\\bwarehouse\\b|\\bpicked (and delivered )?(today|the same day)\\b', msg: 'Banners and the FAQ say "sourced fresh every morning", "Fresh in, every morning", "did not sit in a warehouse": sourcing claims the owner has not evidenced; left out.' },
      { rule: 'sb-fast', re: '\\bfast delivery\\b|\\bdelivered fast\\b|\\b1[–-]3 (business )?days\\b|\\border in minutes\\b', msg: 'The footer says "delivered fast", the splash "Order in minutes", the FAQ "1–3 business days": not promises copy can make.' },
      { rule: 'sb-easy-returns', re: '\\beasy returns\\b|\\bhassle[- ]free returns?\\b', msg: 'A brand-config chip says "Easy returns", but the refund page allows replacements or refunds only for damaged, incorrect or undelivered orders.' },
      { rule: 'sb-collection', re: '\\bclick (&|and) collect\\b|\\bcollect(ion)? (in|from) (the )?(store|shop)\\b|\\bpick ?up (in|from) (the )?(store|shop)\\b', msg: 'Collection is on in settings.json ("Call us on +91 98101 83569 for collection"), but the shop address in brand-config is a placeholder ("94, Best Street, NCR, 110001"). Do not offer collection until the owner gives the real address.' }
    ],
    notes: [
      'South Basket (the shop writes both "South Basket" and "SouthBasket") sells South Indian groceries in Delhi NCR: rice and millets (Aishwarya hand pound, Lalitha, Rajabhogam Ponni, Andhra raw rice), greens and vegetables (gongura, moringa leaves, drumsticks, banana stem, chow chow, dosakaya, raw mangoes), oils and ghee (Akshaya wood pressed, Idhayam, Nandini, GRB), filter coffee (Cothas, Udhayam, Bru, Rajam), snacks (chakli, ribbon murku, chegodi, janthikalu, thattai), appalam and vadam, and Ganesh and Varalakshmi pooja items. Source: live menu.json sb/ (181 products) on 2026-10-05.',
      'The shop\'s own category for greens and vegetables is called "FRESH": use the category name only as the shop writes it; do not describe products as fresh (FSSAI Schedule V conditions; warn rule fssai-descriptors).',
      'Delivery: Delhi, Noida, Gurugram, Ghaziabad and Faridabad; the FAQ asks customers to confirm their area on WhatsApp. At checkout customers choose a delivery slot ("Choose a delivery slot to place your order").',
      'Payment: online through Razorpay at checkout (live settings.json payments.razorpay true, cod false). The FAQ still says COD only.',
      'Customers can sign in (one-time code, then a PIN) and use "Order Again" / "Reorder" on past orders (live /account).',
      'WhatsApp / phone +91 98101 83569: Mon–Sat, 9 am – 7 pm (contact.html). The shop also runs a WhatsApp Community for new arrivals and seasonal products.'
    ]
  }),
  items: [
    {
      id: 'rice-millets',
      path: '/c/rice-n-millets',
      title: 'Rice N Millets',
      group: 'rice',
      audiences: ['general', 'india'],
      hook: 'Ponni, Andhra raw rice, idli rice and hand pound rice, in Delhi NCR.',
      pain: 'Delhi shops sell basmati everywhere, but I cannot find the rice we eat at home in the south.',
      usual: ['Bringing a bag back after every trip home', 'Making do with whatever the kirana has'],
      promise: 'Rice for South Indian kitchens: Aishwarya Hand Pound, Andhra Raw, Idli / Dosa, Rajabhogam Ponni and Lalitha HMT.',
      steps: ['Open Rice N Millets on southbasket.co.in', 'Add the rice and pack size you use', 'Choose a delivery slot and pay online at checkout'],
      cta: 'See the rice at South Basket',
      facts: [
        'AISHWARYA HAND POUND RICE 1KG and 5KG',
        'ANDHRA RAW RICE 5KG, KAMALAM ANDHRA RAW RICE 26KG',
        'IDLI /DOSA RICE 1KG, DOSA RICE 1KG',
        'RAJABHOGAM PONNI FULL BOILED 1KG',
        'LALITHA HMT 5KG, LALITHA BRWON RICE 5KG (as the shop spells it)'
      ],
      source: 'public/c/rice-n-millets.html (live /c/rice-n-millets) + live menu.json sb/ category "RICE N MILLETS" (14 products)'
    },
    {
      id: 'greens-vegetables',
      path: '/c/fresh',
      title: 'Greens and vegetables',
      group: 'greens',
      audiences: ['general', 'india'],
      hook: 'Gongura, moringa leaves, drumsticks and banana stem, delivered in NCR.',
      pain: 'I want to make gongura pachadi but nobody in my sector sells gongura.',
      usual: ['Hunting through weekly markets', 'Going without the dishes from home'],
      promise: 'South Basket\'s greens and vegetables include Gongura, Moringa Leaves, Drumsticks, Banana Stem (Arati Davva), Chow Chow, Dosakaya and Raw Mangoes for Pickle.',
      steps: ['Open the greens and vegetables category on southbasket.co.in', 'Add what you need for the week', 'Choose a delivery slot and place the order'],
      cta: 'Order greens and vegetables from South Basket',
      facts: [
        'GONGURA 1KG, MORINGA LEAVES 250GM',
        'DRUMSTICKS FAT ONES 1 PC, BANANA STEM (ARATI DAVVA)',
        'CHOW CHOW (SEEMA VANKAYA), DOSAKAYA (HYD CUCUMBER) 1KG',
        'RAW MANGOES FOR PICKLE 1KG, RAW TOTAPURI MANGOES 1KG',
        'SAMBAR ONIONS 500GM, MALABAR SPINACH 1KG'
      ],
      source: 'public/c/fresh.html (live /c/fresh, the shop\'s category "FRESH") + live menu.json sb/ category "FRESH" (15 products)'
    },
    {
      id: 'gongura',
      path: '/product/gongura-fresh-1kg',
      title: 'Gongura 1kg',
      group: 'greens',
      audiences: ['general', 'india'],
      hook: 'Gongura by the kilo, for pachadi or pappu, in Delhi NCR.',
      pain: 'Every Telugu family in Delhi asks the same question: where do you get gongura?',
      usual: ['Asking friends who visited home', 'Dried gongura from a packet'],
      promise: 'South Basket sells gongura leaves in a 1 kg bunch for delivery across Delhi NCR.',
      steps: ['Open the Gongura page on South Basket', 'Add it to the cart', 'Choose a delivery slot and pay online'],
      cta: 'Order gongura from South Basket',
      facts: ['Gongura, 1 kg', 'In the shop\'s greens and vegetables category', 'Delivery across Delhi NCR'],
      source: 'public/product/gongura-fresh-1kg.html (live /product/gongura-fresh-1kg, title "GONGURA FRESH 1KG – South Basket") + live menu.json item "GONGURA FRESH 1KG"'
    },
    {
      id: 'filter-coffee',
      path: '/c/coffee-tea',
      title: 'Coffee & Tea',
      group: 'coffee',
      audiences: ['general', 'india'],
      hook: 'Cothas 85:15 and Udhayam 80:20 filter coffee for the morning decoction.',
      pain: 'The instant coffee here is nothing like a tumbler of filter coffee.',
      usual: ['Instant coffee', 'Waiting for someone to bring a pack from Chennai or Bengaluru'],
      promise: 'South Basket stocks filter coffee blends and South Indian coffee: Cothas Filter Coffee 85:15, Udhayam Filter Coffee 80:20, Bru Green Label and Rajam Chukku Coffee.',
      steps: ['Open Coffee & Tea on the shop', 'Add your blend', 'Choose a delivery slot and pay online'],
      cta: 'Order filter coffee from South Basket',
      facts: ['COTHAS FILTER COFFEE 85:15 500GM', 'UDHAYAM FILTER COFFEE 80:20 500GM', 'BRU GREEN LABEL COFFEE 500GM', 'RAJAM CHUKKU COFFEE 100GM'],
      source: 'public/c/coffee-tea.html (live /c/coffee-tea) + live menu.json sb/ category "COFFEE & TEA" (4 products); product page /product/cothas-filter-coffee-85-15-500gm'
    },
    {
      id: 'oil-ghee',
      path: '/c/oil-ghee',
      title: 'Oil & Ghee',
      group: 'oil-ghee',
      audiences: ['general', 'india'],
      hook: 'Wood pressed gingelly, groundnut and coconut oil, plus Nandini ghee.',
      pain: 'Our tadka needs gingelly oil and the local store only has refined.',
      usual: ['Refined oil from the supermarket', 'Carrying cans back from home'],
      promise: 'South Basket lists oils and ghee from Akshaya, Idhayam, AS Brand, Gold Winner, Nandini, GRB and Durga, plus lamp oil for pooja.',
      steps: ['Open Oil & Ghee on the shop', 'Add the oils and ghee you use', 'Choose a delivery slot and pay online'],
      cta: 'Order oil and ghee from South Basket',
      facts: [
        'AKSHAYA WOOD PRESSED COCONUT OIL 1LTR, GROUNDNUT OIL 1LTR, SESEME OIL 1LTR',
        'IDHAYAM OIL 1LTR and 500ML, IDHAYAM MANTRA GROUNDNUT OIL 1LTR',
        'AS BRAND GINGELLY OIL 1LTR',
        'NANDINI GHEE 1LTR, GRB COW GHEE 500ML, DURGA GHEE 500ML',
        'DHEEPAM LAMP OIL 1LTR and 500ML'
      ],
      source: 'public/c/oil-ghee.html (live /c/oil-ghee) + live menu.json sb/ category "OIL & GHEE" (14 products)'
    },
    {
      id: 'snacks',
      path: '/c/snacks',
      title: 'Snacks',
      group: 'snacks',
      audiences: ['general', 'india'],
      hook: 'Ribbon murku, chegodi, janthikalu and thattai for tea time.',
      pain: 'Delhi namkeen is good, but I miss the murukku and chegodilu from home.',
      usual: ['Namkeen from the corner shop', 'Making a batch at Diwali only'],
      promise: 'South Basket stocks South Indian snacks: Chakli, Chegodi (Andhra Murku), Ribbon Murku, Janthikalu, Kara Boondi, Thattai / Chakkalu, Rose Cookies and South Indian Mixture.',
      steps: ['Open Snacks on southbasket.co.in', 'Add the snacks you want', 'Choose a delivery slot and pay online'],
      cta: 'See the snacks at South Basket',
      facts: ['CHAKLI 500GM, RIBBON MURKU 500GM', 'CHEGODI, ANDHRA MURKU 500GM', 'JANTHIKALU 500GM, KARA BOONDI 500GM', 'THATTAI/ CHAKKALU 250GM, ROSE COOKIES 10PC', 'SOUTH INDIAN MIXTURE 500GM'],
      source: 'public/c/snacks.html (live /c/snacks) + live menu.json sb/ category "SNACKS" (11 products)'
    },
    {
      id: 'appalam-vadam',
      path: '/c/fryums',
      title: 'Fryums',
      group: 'fryums',
      audiences: ['general', 'india'],
      hook: 'Ambica appalam and rice vadam for Sunday lunch.',
      pain: 'Sambar rice is not the same without appalam on the side.',
      usual: ['Papad from the supermarket', 'Skipping it'],
      promise: 'South Basket\'s Fryums: Ambica Appalam No 2, No 3 and No 5 (50 pc packs), Meenakshi Appalam, Rice Vadam, Makka Poha and Vepala Katti.',
      steps: ['Open Fryums on the shop', 'Add the appalam and vadam you like', 'Choose a delivery slot and pay online'],
      cta: 'Order appalam from South Basket',
      facts: ['AMBICA APPALAM NO 2, NO 3 and NO 5, 50 PC', 'MEENAKSHI APPALAM 250GM', 'RICE VADAM 150GM', 'MAKKA POHA 250GM', 'VEPALA KATTI 4 PC'],
      source: 'public/c/fryums.html (live /c/fryums) + live menu.json sb/ category "FRYUMS" (7 products)'
    },
    {
      id: 'ganesh-pooja',
      path: '/c/ganesh-pooja',
      title: 'Ganesh Pooja',
      group: 'pooja',
      audiences: ['general', 'india'],
      hook: 'Everything for the pooja, in one basket.',
      pain: 'Every pooja I run round three shops for camphor, wicks and banana leaves.',
      usual: ['Several trips to the market the day before', 'Finding out something is missing at the last minute'],
      promise: 'South Basket\'s Ganesh Pooja category lists over fifty items: clay Ganesha idols, camphor, deepam wicks, deepam oil, banana leaves, Ganga Jal, akshata and a Ganesh pooja book.',
      steps: ['Open Ganesh Pooja on southbasket.co.in', 'Add everything on your pooja list', 'Choose a delivery slot and place the order'],
      cta: 'Get pooja items from South Basket',
      facts: [
        'Everything for the pooja, in one basket.',
        'CLAY GANESHA IDOL 6-8 INCH and 8-10 INCH',
        'AMBICA CAMPHOR 35PC and 70 PC, DEEPAM WICKS',
        'BANANA LEAVES, GANGA JAL 100ML, Akshata',
        'GANESH POOJA BOOK'
      ],
      source: 'public/c/ganesh-pooja.html (live /c/ganesh-pooja) + live menu.json sb/ category "GANESH POOJA" (53 products); banner "Everything for the pooja, in one basket." in live settings.json'
    },
    {
      id: 'varalakshmi-pooja',
      path: '/c/varalakshmi-pooja',
      title: 'Varalakshmi Pooja',
      group: 'pooja',
      audiences: ['general', 'india'],
      hook: 'Bangles, blouse pieces and haldi kumkum sets for Varalakshmi Vratham.',
      pain: 'Putting together the thamboolam for every guest takes a whole weekend of shopping.',
      usual: ['Buying item by item at the market', 'Asking family down south to post things'],
      promise: 'South Basket\'s Varalakshmi Pooja category lists bangle sets, blouse pieces, haldi kumkum packs and sets, dry haldi, dry dates, gomati chakra and more.',
      steps: ['Open Varalakshmi Pooja on the shop', 'Add the items for your guests', 'Choose a delivery slot and place the order'],
      cta: 'Shop Varalakshmi Pooja items at South Basket',
      facts: [
        'BANGLES 24 (RED 12 + GREEN 12), BANGLES 36',
        'ASSORTED COLOR BLOUSE PC 1MTR',
        'HALDI KUMKUM COMBO 10PACK, HALDI KUMKUM LEAF SET 10 SET',
        'DRY HALDI STICKS 5PC, DRY DATES 5 PC',
        'GOMATI CHAKRA SHELL 11PC'
      ],
      source: 'public/c/varalakshmi-pooja.html (live /c/varalakshmi-pooja) + live menu.json sb/ category "VARALAKSHMI POOJA" (37 products)'
    },
    {
      id: 'delivery-ncr',
      path: '/faq',
      title: 'Delivery in Delhi NCR',
      group: 'delivery',
      audiences: ['general', 'india'],
      hook: 'Delhi, Noida, Gurugram, Ghaziabad or Faridabad? South Basket delivers.',
      pain: 'The South Indian store is across the city and the traffic makes it a half-day trip.',
      usual: ['A weekend drive across Delhi', 'Asking a friend nearby to pick things up'],
      promise: 'Delivery across Delhi, Noida, Gurugram, Ghaziabad and Faridabad; choose a delivery slot at checkout.',
      steps: ['Message the shop on WhatsApp to confirm your area', 'Place your order on southbasket.co.in', 'Choose a delivery slot at checkout'],
      cta: 'Check delivery to your area with South Basket',
      facts: [
        'We currently deliver across Delhi, Noida, Gurugram, Ghaziabad and Faridabad in the NCR region',
        'Please contact us via WhatsApp to confirm delivery availability for your specific area',
        'Choose a delivery slot to place your order'
      ],
      source: 'public/faq.html (live /faq) + checkout copy in storefront.js (brand-config checkout.slotMode "select")'
    },
    {
      id: 'order-again',
      path: '/account',
      title: 'Order Again',
      group: 'ordering',
      audiences: ['general', 'india'],
      hook: 'Same rice, dal and coffee every month? Reorder in a tap.',
      pain: 'My monthly list is the same every time and I still type it all out.',
      usual: ['Retyping the list', 'Forwarding last month\'s WhatsApp message'],
      promise: 'Sign in with a one-time code, set a PIN, and use Order Again on a past order to fill the basket.',
      steps: ['Open My Account and sign in with the code sent to you', 'Set a PIN to sign in faster next time', 'Tap Order Again on a past order'],
      cta: 'Reorder from South Basket',
      facts: ['Set a PIN to sign in faster next time.', '↺ Order Again', 'Every past order in your account'],
      source: 'public/account.html (live /account): "Set a PIN to sign in faster next time.", "↺ Order Again", "🔄 Reorder"; brand-config.js features.customerLogin true, auth.mode "pin_after_otp"'
    },
    {
      id: 'whatsapp-community',
      path: '/',
      title: 'South Basket WhatsApp Community',
      group: 'whatsapp',
      audiences: ['general', 'india'],
      hook: 'Join the South Basket WhatsApp Community for new arrivals and seasonal products.',
      pain: 'I only find out the raw mangoes or pooja items were in after they are gone.',
      usual: ['Checking the site every few days', 'Hearing about it from a neighbour'],
      promise: 'The shop runs a WhatsApp Community where it posts new arrivals and seasonal products; you can also chat with the shop on WhatsApp, Mon–Sat, 9 am – 7 pm.',
      steps: ['Open southbasket.co.in', 'Tap Join on the WhatsApp Community prompt', 'Or tap Chat on WhatsApp on the Contact page'],
      cta: 'Join the South Basket WhatsApp Community',
      facts: [
        'Join South Basket WhatsApp Community',
        'Be the first to know about new arrivals, seasonal products',
        'Phone / WhatsApp: Available Mon–Sat, 9 am – 7 pm'
      ],
      source: 'brand-config.js whatsappCommunity (enabled, chat.whatsapp.com link, title and message) rendered by live storefront.js on the home page; contact.html hours'
    }
  ],
  notConfirmed: [
    'Prices: every product on the live menu has a rupee price; left out by the rules.',
    'Delivery charge / free delivery: brand-config deliveryCharge 100 / freeDeliveryMin 1000 with a splash "Free Delivery – On orders above ₹1,000 across NCR" and chip "🚚 Free over ₹1000"; live settings.json deliveryCharge 100 / freeDeliveryMin 2500 and a banner "Free delivery over ₹2,500"; the FAQ says "Orders above ₹1000 qualify for free delivery. A delivery charge of ₹70 applies to smaller orders." Three different figures: no delivery-cost wording is used.',
    'Payment: live settings.json has Razorpay on and cash on delivery off; the FAQ says "We currently accept Cash on Delivery (COD). Online payment options will be added soon." and a banner says "Cash on delivery or pay online". Copy says "pay online"; COD is blocked by rule sb-cod.',
    'Banners and splash: "picked and delivered the same day", "Same-day delivery", "⚡ Same-day slots", "Fresh in, every morning. Greens, flowers and dairy that did not sit in a warehouse", "Farm Fresh Daily – Fruits, vegetables & dairy sourced fresh every morning", "Fast & Easy – Order in minutes", FAQ "delivered same-day or next-day" and "typically delivered within 1–3 business days": delivery-time and sourcing claims; left out.',
    'Banner "Rice your grandmother would recognise. Hand-pound, single-polish and heritage millets" — no millet product is on the live menu; "heritage" left out.',
    'Banner "Fresh, honest and from around here." and footer "Fresh fruits, vegetables, dairy, and everyday Indian groceries delivered fast across NCR": no dairy or fruit products on the live menu apart from ghee; "fresh"/"fast" left out.',
    'brand-config chips "↩️ Easy returns", "🔒 Secure pay": the refund page does not support "easy returns"; left out.',
    'The shop\'s category is named "FRESH" and a product is named "GONGURA FRESH 1KG": FSSAI Schedule V allows "fresh" only on conditions, so items call them greens and vegetables / Gongura; the paths still point to /c/fresh and /product/gongura-fresh-1kg.',
    'Product description "NANDINI PURE COW GHEE": "pure" is not used (FSSAI Schedule V).',
    'Collection: settings.json fulfilment.pickup true with "Call us on +91 98101 83569 for collection", but no real shop address is shown; not offered (rule sb-collection).',
    'Address "94, Best Street, NCR, 110001" in brand-config.js (and legal.registeredAddress marked TODO): a placeholder; not used anywhere in copy.',
    'Brand page /brand/amul is in the sitemap, but no Amul product is on the live menu; not used.',
    'Refund page says "Because our products are freshly made to order": copied from a food shop; not used.',
    'Contact hours: contact.html says Mon–Sat 9 am – 7 pm; the WhatsApp button shows 8:00–21:00 (brand-config waHours). Copy uses the contact page hours.',
    'Instagram, Facebook, YouTube, Google Business Profile: none linked on the shop\'s pages.'
  ],
  todo: [
    'TODO (owner): the shop address "94, Best Street, NCR, 110001" in brand-config.js is a placeholder; the real address is needed before collection or a Google Business Profile can be promoted.',
    'brand-config.js legal block is marked TODO: entityName, registeredAddress, governingLawCity and DPDP grievance officer name.',
    'brand-config.js phonepe.upiId is marked "TODO: set your PhonePe/UPI merchant VPA" (PhonePe is off).',
    'Owner: the FAQ payment answer says COD only while the live checkout is online-only (Razorpay); update faq.html, the banner "Cash on delivery or pay online", or switch COD back on.',
    'Owner: settle the free-delivery threshold and charge (₹1,000 / ₹2,500 / ₹70 / ₹100 across FAQ, brand-config and settings).',
    'Owner: refund.html is a food-shop text ("freshly made to order"); it needs a grocery version.',
    'Owner: the shop name is written "South Basket" (brand-config, titles) and "SouthBasket" (FAQ, contact, banners); pick one.',
    'The Firebase phone-auth config in brand-config.js points at project "register-check-2025", not southbasketin — check with the platform owner (not a copy issue).'
  ],
  checked: '2026-10-05'
};
