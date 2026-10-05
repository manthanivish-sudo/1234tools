'use strict';
/** Site profile: Sri Balaji Stores, a shop on XLeShop. Read from E:/projects/XLeShop/SriBalajiStores (read-only; git
 *  https://github.com/vmanthani/SriBalajiStores.git, firebase project bestone94kent) and the live site
 *  https://sribalajistores.co.uk on 2026-10-05, with the live menu.json / settings.json the storefront loads
 *  (xleshop-menu.storage.googleapis.com/sbs/). Indian and Asian groceries (spices, flours, atta, dals, dry fruits)
 *  from 94 Watling St, Gillingham, delivered in Gillingham, Chatham, Maidstone and around Kent. */
const SHOP = require('./_shop');
module.exports = {
  id: 'sri-balaji-stores',
  name: 'Sri Balaji Stores',
  baseUrl: 'https://sribalajistores.co.uk',
  domainSource: 'public/brand-config.js domain "sribalajistores.co.uk" and url "https://sribalajistores.co.uk" (lines 21-22); public/sitemap.xml <loc>s (31 pages + 327 products); curl https://sribalajistores.co.uk/ -> 200 on 2026-10-05, title "Sri Balaji Stores – Fresh Indian Groceries Delivered in Kent, UK"; live brand-config.js identical to the repo; www.sribalajistores.co.uk fails TLS (certificate does not cover www), so the bare domain is canonical. Clean URLs (/faq.html redirects to /faq).',
  repo: 'E:/projects/XLeShop/SriBalajiStores',
  platform: 'xleshop',
  pickerGroup: SHOP.PICKER_GROUP,
  kind: 'shop',
  promotes: 'products',
  utm: { medium: 'social' },
  brandWords: ['Sri Balaji Stores', 'Sri Balaji', 'Aashirvad', 'Eastern', 'MDH', 'Heera', 'Natco', 'Top-Op', 'Jalpur', 'Viswas', 'Shan', 'Jaimin', 'Bombino', 'MTR', 'Dabur', 'Vatika', 'Britannia', 'Gits', 'Malabar Choice', 'Kolhapuri'],
  colours: { primary: '#E07D10', accent: '#A61A1A', background: '#FAF8F5', ink: '#1A130A' },
  colourSource: 'public/brand-config.js colors.primary / accent / bg / text (lines 79, 81, 83, 84)',
  logo: 'E:/projects/XLeShop/SriBalajiStores/public/images/logo.png',
  audiences: ['general', 'uk'],
  regions: ['uk'],
  area: 'Gillingham, Chatham, Maidstone and surrounding areas in Kent (shop at 94 Watling St, Gillingham ME7 2YS)',
  areaSource: 'public/faq.html: "We currently deliver across Gillingham, Chatham, Maidstone, and surrounding areas in Kent, UK. Please contact us via WhatsApp to confirm delivery availability for your postcode."; brand-config.js address "94 Watling St, Gillingham ME7 2YS"; contact.html title "Contact Sri Balaji Stores – Gillingham, Kent"',
  social: {
    instagram: null,
    facebook: null,
    whatsapp: 'https://wa.me/447809150184',
    whatsappChannel: null,
    youtube: null,
    googleBusiness: null,
    source: 'public/index.html schema sameAs ["https://wa.me/" + BRAND.phoneWA], phoneWA "447809150184" in brand-config.js; contact.html "Chat on WhatsApp". No Instagram, Facebook, YouTube or Google Business Profile link on the shop\'s pages (stores.js builds Google Maps directions links for the store locator, not a profile).'
  },
  calendarTargets: SHOP.TARGETS,
  disclosure: SHOP.disclosure('Sri Balaji Stores'),
  rules: SHOP.rules({
    type: 'grocery',
    market: 'uk',
    allow: [],
    free: false,
    freePhrases: [],
    forbid: [
      { rule: 'sbs-collect', re: '\\bclick (&|and) collect\\b|\\bcollect(ion)? (in|from) (the )?(store|shop)\\b|\\bpick ?up (in|from) (the )?(store|shop)\\b', msg: 'A home-page banner says "Click & collect", but collection is switched off in the live store settings (fulfilment.pickup false). Do not offer it until the owner switches it on.' },
      { rule: 'sbs-store-prices', re: '\\bstore prices\\b|\\bpay less\\b|\\bbuy big\\b|\\bcheap(er|est)?\\b|\\blow(est)? prices?\\b', msg: 'The banners say "Buy big, pay less" and "at store prices": price claims, left out.' },
      { rule: 'sbs-restock-day', re: '\\bthursdays?\\b|\\brestocked every week\\b|\\bevery week\\b', msg: 'A banner says new arrivals land on Thursdays: a stock promise the owner has not confirmed.' },
      { rule: 'sbs-fast', re: '\\bfast delivery\\b|\\bdelivered fast\\b|\\b1[–-]3 (business )?days\\b', msg: 'The top bar says "Fast Delivery Across Kent" and the FAQ says "typically 1–3 business days": not a promise copy can make.' },
      { rule: 'sbs-easy-returns', re: '\\beasy returns\\b|\\bhassle[- ]free returns?\\b', msg: 'A brand-config chip says "Easy returns", but the refund page allows replacements or refunds only for damaged, incorrect or undelivered orders.' }
    ],
    notes: [
      'Sri Balaji Stores is an Indian and Asian grocery in Gillingham, Kent: spices and masalas (Eastern, MDH, Natco, Heera, Top-Op, Shan, Viswas), flours (Jalpur, Natco, Top-Op, Viswas), atta (Aashirvad, Pillsbury, Dr. Nature), dals, beans and lentils (Natco, Top-Op), dry fruits, nuts and seeds, jaggery, vermicelli, and a few fresh items (coconut, coriander, tomatoes). Product names are written in capitals on the shop. Source: live menu.json sbs/ (325 products) on 2026-10-05.',
      'Delivery: Gillingham, Chatham, Maidstone and surrounding areas in Kent; the FAQ asks customers to confirm their postcode on WhatsApp.',
      'Payment: cash on delivery only (live settings.json payments: cod true, everything else off; FAQ "We currently accept Cash on Delivery (COD)").',
      'Customers can sign in (one-time code, then a PIN) and use "Order Again" / "Reorder" on past orders in their account (live /account).',
      'WhatsApp / phone +44 7809 150184: Mon–Sat, 9 am – 7 pm (contact.html).',
      'Skip the Dabur Chywanprash, Dr. Nature Karela Juice and the "HEALTHY DRINK" category in copy: the products are fine to stock, but anything said about them turns into a health claim.'
    ]
  }),
  items: [
    {
      id: 'spices',
      path: '/c/spices',
      title: 'Spices',
      group: 'spices',
      audiences: ['general', 'uk'],
      hook: 'Eastern, MDH, Natco, Heera and Top-Op masalas, in Gillingham.',
      pain: 'The supermarket world-food aisle has three masalas and never the one my recipe asks for.',
      usual: ['A drive to a bigger Asian grocer', 'Making do with a generic curry powder'],
      promise: 'Sri Balaji Stores lists over a hundred spices and masalas, whole and ground, from Eastern, MDH, Natco, Heera, Top-Op, Shan and Viswas.',
      steps: ['Open Spices on sribalajistores.co.uk', 'Add the masalas you need to the cart', 'Check out with your Kent address and pay cash on delivery'],
      cta: 'See the spices at Sri Balaji Stores',
      facts: [
        'Eastern Sambar Powder, Eastern Kashmiri Chilli Powder, Eastern Fish Masala',
        'MDH Chana Masala, MDH Kitchen King, MDH Kasoori Methi, MDH Deggi Mirch',
        'Heera Garam Masala Powder, Kings Curry Powder',
        'Brands in the category: Eastern, MDH, Natco, Heera, Top-Op, Shan, Viswas'
      ],
      source: 'public/c/spices.html (live /c/spices) + live menu.json sbs/ category "SPICES" (137 products)'
    },
    {
      id: 'eastern-sambar-powder',
      path: '/product/eastern-sambar-powder-165g',
      title: 'Eastern Sambar Powder 165g',
      group: 'spices',
      audiences: ['general', 'uk'],
      hook: 'Eastern Sambar Powder for Sunday sambar, from a Gillingham shop.',
      pain: 'I ran out of sambar powder and the nearest shop that stocks Eastern is miles away.',
      usual: ['Buying online in bulk and waiting for the parcel', 'Mixing my own from whatever is in the cupboard'],
      promise: 'Sri Balaji Stores stocks Eastern Sambar Powder 165g, with Eastern Madras Sambar Powder 50g and other Eastern masalas alongside.',
      steps: ['Open Eastern Sambar Powder 165g on the shop', 'Add it to the cart with anything else you need', 'Place the order for delivery in Kent'],
      cta: 'Order Eastern Sambar Powder from Sri Balaji Stores',
      facts: ['EASTERN SAMBAR POWDER 165G', 'EASTERN MADRAS SAMBAR POWDER 50G', 'Category: Spices'],
      source: 'public/product/eastern-sambar-powder-165g.html (live, title "EASTERN SAMBAR POWDER 165G – Sri Balaji Stores") + live menu.json'
    },
    {
      id: 'atta',
      path: '/c/atta-and-wheat',
      title: 'Atta and Wheat',
      group: 'atta',
      audiences: ['general', 'uk'],
      hook: 'Aashirvad Atta 10kg, delivered in Kent.',
      pain: 'Carrying a 10 kg bag of atta home from the shop is the worst part of the weekly shop.',
      usual: ['Lugging the bag to the car', 'Buying small packs more often'],
      promise: 'Big bags of atta for delivery: Aashirvad 10kg and Multigrains 5kg, Pillsbury 10kg, Dr. Nature Sharbati 5kg.',
      steps: ['Open Atta and Wheat on the shop', 'Add the bag you use', 'Check out with your address in Kent'],
      cta: 'Order atta from Sri Balaji Stores',
      facts: ['AASHIRVAD ATTA 10KG', 'AASHIRVAD ATTA MULTIGRAINS 5KG', 'PILLBURY ATTA 10KG (as the shop spells it)', 'DR. NATURE MP SHARBATI CHAKKI ATTA 5KG'],
      source: 'public/c/atta-and-wheat.html (live /c/atta-and-wheat) + live menu.json sbs/ category "ATTA AND WHEAT"; product page /product/aashirvad-atta-10kg'
    },
    {
      id: 'flours',
      path: '/c/flours',
      title: 'Flours',
      group: 'flours',
      audiences: ['general', 'uk'],
      hook: 'Besan, bajri, juwar, ragi and puttu podi on one shelf.',
      pain: 'Every recipe from home needs a different flour and no single shop near me has them all.',
      usual: ['Substituting plain flour and hoping', 'Ordering one flour at a time online'],
      promise: 'Over forty flours and mixes from Jalpur, Natco, Top-Op and Viswas: besan, bajri, juwar, rice flour, ragi, sooji, puttu podi, idly rava and more.',
      steps: ['Open Flours on sribalajistores.co.uk', 'Add the flours you need', 'Place the order and pay cash on delivery'],
      cta: 'See the flours at Sri Balaji Stores',
      facts: [
        'Jalpur Besan, Bajri, Juwar, Dhokra and Ondhwa Flour',
        'Top-Op Ragi Flour, Gram Flour, Roasted Sooji, Idly Rava',
        'Viswas Rice Puttu Podi, Dosa Podi, Idly Podi',
        'Gits Dahi Vada Mix, Malabar Choice Instant Upma Mix'
      ],
      source: 'public/c/flours.html (live /c/flours) + live menu.json sbs/ category "FLOURS" (44 products)'
    },
    {
      id: 'dals-lentils',
      path: '/c/beans-lentils',
      title: 'Beans & Lentils',
      group: 'dals',
      audiences: ['general', 'uk'],
      hook: 'Toor, urad, moong and masoor dal in 2 kg bags.',
      pain: 'I get through dal fast and the small supermarket packs run out in a week.',
      usual: ['Several small packs from the supermarket', 'A trip to a wholesale cash-and-carry'],
      promise: 'Dals, beans and lentils from Natco and Top-Op, mostly in 2 kg bags: toor, urad, moong, masoor, chana and more.',
      steps: ['Open Beans & Lentils on the shop', 'Add the dals and beans you use', 'Check out with your Kent address'],
      cta: 'Order dals from Sri Balaji Stores',
      facts: [
        'Top-Op Toor Dal, Urad Dal, Chana Dal, Masoor Dal, Moong Dal Chilka',
        'Natco Chick Peas, Red Kidney Beans, Kala Chana, Moth Beans',
        'Top-Op Horse Gram 1kg',
        'Most packs are 2 kg'
      ],
      source: 'public/c/beans-lentils.html (live /c/beans-lentils) + live menu.json sbs/ categories "DALL,BEANS & LENTILS" and "DAL,BEANS & LENTILS" (35 products)'
    },
    {
      id: 'dry-fruits-nuts-seeds',
      path: '/c/dry-fruits-nuts-seeds',
      title: 'Dry Fruits, Nuts & Seeds',
      group: 'dry-fruits',
      audiences: ['general', 'uk'],
      hook: 'Cashews, almonds, sultanas and melon seeds for festival sweets.',
      pain: 'Diwali sweets need a lot of nuts and the little supermarket bags cost a fortune.',
      usual: ['Supermarket baking-aisle bags', 'Buying whatever the corner shop has'],
      promise: 'Sri Balaji Stores lists nearly sixty dry fruits, nuts and seeds from Natco, Heera and Top-Op, including cashews, almonds, sultanas, pumpkin, melon and sesame seeds.',
      steps: ['Open Dry Fruits, Nuts & Seeds on the shop', 'Add what your recipe needs', 'Place the order for delivery in Kent'],
      cta: 'See the dry fruits at Sri Balaji Stores',
      facts: [
        'Natco Almonds 750g, Natco Cashew Nuts 750g',
        'Heera Golden Sultana, Heera Melon Seeds, Heera Pumpkin Seeds',
        'Heera Sesame Seeds 1kg, Natco Brown Linseed 1kg'
      ],
      source: 'public/c/dry-fruits-nuts-seeds.html (live /c/dry-fruits-nuts-seeds) + live menu.json sbs/ category "DRY FRUITS NUTS & SEEDS" (59 products)'
    },
    {
      id: 'jaggery',
      path: '/c/jaggery-sugar',
      title: 'Jaggery & Sugar',
      group: 'jaggery',
      audiences: ['general', 'uk'],
      hook: 'Kolhapuri jaggery and desi gur, by the kilo.',
      pain: 'Payasam needs proper jaggery and the supermarket only has brown sugar.',
      usual: ['Brown sugar as a stand-in', 'Asking family to bring a block from India'],
      promise: 'Sri Balaji Stores sells jaggery from Top-Op, Jaimin and Natco: Kolhapuri jaggery, Punjabi desi gur, jaggery cubes and jaggery goor.',
      steps: ['Open Jaggery & Sugar on the shop', 'Add the jaggery you want', 'Check out and pay cash on delivery'],
      cta: 'Order jaggery from Sri Balaji Stores',
      facts: ['TOP-OP KOLHAPURI JAGGERY 1KG and 500G', 'TOP-OP PUNJABI DESI GUR 1KG', 'JAIMIN DESI GUR 1KG', 'TOP-OP JAGGERY CUBES 500G', 'NATCO JAGGERY GOOR 1KG'],
      source: 'public/c/jaggery-sugar.html (live /c/jaggery-sugar) + live menu.json sbs/ category "JAGGERY & SUGAR" (6 products); product page /product/jaimin-desi-gur-1kg'
    },
    {
      id: 'vermicelli',
      path: '/c/noodles-vermicelli',
      title: 'Noodles & Vermicelli',
      group: 'vermicelli',
      audiences: ['general', 'uk'],
      hook: 'Bombino, MTR and Purvi vermicelli for semiya payasam.',
      pain: 'Supermarket vermicelli is the wrong kind for semiya.',
      usual: ['Breaking up spaghetti', 'Skipping the dessert'],
      promise: 'Sri Balaji Stores stocks Bombino Vermicelli and Roasted Vermicelli, MTR Vermicelli, Purvi Rice Vermicelli and Fenni.',
      steps: ['Open Noodles & Vermicelli on the shop', 'Add the vermicelli you use', 'Place the order for delivery in Kent'],
      cta: 'Order vermicelli from Sri Balaji Stores',
      facts: ['BOMBINO ROASTED VERMICELLI 800G', 'BOMBINO VERMICELLI 800G', 'MTR VERMICELLI 950G', 'PURVI RICE VERMICELLI 200G', 'FENNI 200G'],
      source: 'public/c/noodles-vermicelli.html (live /c/noodles-vermicelli) + live menu.json sbs/ category "NOODLES & VERMICELLI" (5 products)'
    },
    {
      id: 'delivery-kent',
      path: '/faq',
      title: 'Delivery in Kent',
      group: 'delivery',
      audiences: ['general', 'uk'],
      hook: 'Gillingham, Chatham or Maidstone? Sri Balaji Stores delivers.',
      pain: 'I do not drive, and the Indian grocery is two buses away.',
      usual: ['Two buses with heavy bags', 'Waiting for a lift at the weekend'],
      promise: 'Delivery across Gillingham, Chatham, Maidstone and nearby areas in Kent; confirm your postcode on WhatsApp.',
      steps: ['Message the shop on WhatsApp with your postcode', 'Place your order on sribalajistores.co.uk', 'Pay cash on delivery when it arrives'],
      cta: 'Check delivery to your postcode with Sri Balaji Stores',
      facts: [
        'We currently deliver across Gillingham, Chatham, Maidstone, and surrounding areas in Kent, UK',
        'Please contact us via WhatsApp to confirm delivery availability for your postcode',
        'Fresh Indian Groceries Delivered in Kent, UK'
      ],
      source: 'public/faq.html (live /faq) + brand-config.js tagline'
    },
    {
      id: 'how-to-order',
      path: '/faq',
      title: 'How to order',
      group: 'ordering',
      audiences: ['general', 'uk'],
      hook: 'Order your Indian groceries online and pay cash on delivery.',
      pain: 'I would rather pay when the shopping is at my door.',
      usual: ['Card payment on a big online grocer', 'Phoning a list through'],
      promise: 'Fill the cart, add your delivery details and place the order. Pay cash on delivery.',
      steps: ['Browse the products and add them to your cart', 'Fill in your delivery details and click Place Order', 'Open the Order Status link from your confirmation to follow it'],
      cta: 'Order from Sri Balaji Stores',
      facts: [
        'Browse our products on the home page, add items to your cart, then proceed to checkout',
        'You\'ll receive an order confirmation with a tracking link',
        'We currently accept Cash on Delivery (COD)',
        'You can cancel your order as long as it hasn\'t been packed yet'
      ],
      source: 'public/faq.html (live /faq) + live settings.json sbs/ payments {cod: true, others false}'
    },
    {
      id: 'order-again',
      path: '/account',
      title: 'Order Again',
      group: 'ordering',
      audiences: ['general', 'uk'],
      hook: 'Same shop every fortnight? Put your last order back in the basket.',
      pain: 'I buy the same atta, dal and masalas every time and type the list out again and again.',
      usual: ['Retyping the list', 'Scrolling back through old messages'],
      promise: 'Sign in with a one-time code, set a PIN, and use Order Again on a past order to fill the basket.',
      steps: ['Open My Account and sign in with the code sent to you', 'Set a PIN to sign in faster next time', 'Tap Order Again on a past order'],
      cta: 'Reorder from Sri Balaji Stores',
      facts: ['Set a PIN to sign in faster next time.', '↺ Order Again', 'Every past order in your account'],
      source: 'public/account.html (live /account): "Create a PIN", "Set a PIN to sign in faster next time.", "↺ Order Again", "🔄 Reorder"; brand-config.js features.customerLogin true, auth.mode "pin_after_otp"'
    },
    {
      id: 'whatsapp',
      path: '/contact',
      title: 'Chat on WhatsApp',
      group: 'whatsapp',
      audiences: ['general', 'uk'],
      hook: 'Cannot find a brand? Ask Sri Balaji Stores on WhatsApp.',
      pain: 'I want to know if they have my usual brand before I order.',
      usual: ['Calling round the shops', 'Driving over to look'],
      promise: 'Reach the shop on WhatsApp or by phone, Monday to Saturday, 9 am to 7 pm, or by email.',
      steps: ['Open the Contact page', 'Tap Chat on WhatsApp', 'Have your Order ID ready if it is about an order'],
      cta: 'Message Sri Balaji Stores on WhatsApp',
      facts: [
        'Reach us on WhatsApp for the fastest response',
        'Phone / WhatsApp: Available Mon–Sat, 9 am – 7 pm',
        'Browse and order online 24/7',
        '94 Watling St, Gillingham ME7 2YS'
      ],
      source: 'public/contact.html (live /contact) + brand-config.js phone "+44 7809 150184", address'
    }
  ],
  notConfirmed: [
    'Prices: every product on the live menu has a pound price; left out by the rules.',
    'Delivery charge / free delivery: brand-config.js has deliveryCharge 5.99 and freeDeliveryMin 60 with a splash slide "Free Delivery – On orders above £60 across Kent" and a hero chip "🚚 Free over £60"; live settings.json fulfilment has deliveryCharge 0 and freeDeliveryMin 0; the FAQ says "very small orders may incur a delivery charge — the applicable charge will be communicated when your order is confirmed". They disagree and carry prices, so no delivery-cost wording is used.',
    'brand-config heroBand chips "⚡ Same-day slots", "↩️ Easy returns", "🔒 Secure pay" (the live home shows the settings.json slideshow instead): same-day is refused, the refund page does not support "easy returns", and only cash on delivery is on.',
    'Home-page banners (live settings.json): "Buy big, pay less. 10 kg atta, 20 kg rice and family-size pulses at store prices", "Restocked every week. New arrivals land on Thursdays. Curry leaves, fresh chillies and the seasonal bits you cannot get elsewhere", "Local delivery across Kent · Click & collect · Family packs at store prices", "The shop you would walk to, delivered." Price claims, an unconfirmed restock day, collection that is switched off (fulfilment.pickup false) and products (20 kg rice, curry leaves, fresh chillies) not on the menu: left out.',
    'Top bar "🚚 Fast Delivery Across Kent" and FAQ "typically delivered within 1–3 business days": delivery-speed wording, left out.',
    'Splash "Fresh & Authentic – Curated selection from trusted suppliers" and FAQ "sourced from trusted suppliers to ensure quality and authenticity": supplier claims the desk cannot check; left out.',
    'FAQ "Online payment options will be added soon": not live; left out.',
    'Refund page says "Because our products are freshly made to order" and talks of preparation and UPI refunds: it is copied from a food shop and does not fit a UK grocery; not used.',
    'Label "POPULAR" (Vatika Sandal Wood Soap) and "FRESH" (Tomatoes): popularity and freshness labels; left out.',
    'Dabur Chywanprash 250g, Dr. Nature Karela Juice 500ml and the "HEALTHY DRINK" category: any line about them drifts into a health claim; not used.',
    'Fresh items (Coconut, Corriander, Tomatoes) — only three; not made an item.',
    'Dabur brand page /brand/dabur (hair oils, rose water, chywanprash): left out to keep clear of the chywanprash; the hair oils could be an item if the owner wants one.',
    'The store locator /stores loads from the API; not used.',
    'Contact hours: contact.html says Mon–Sat 9 am – 7 pm; the WhatsApp button shows 9:00–20:00 (brand-config waHours). Copy uses the contact page hours.',
    'Instagram, Facebook, YouTube, Google Business Profile: none linked on the shop\'s pages.'
  ],
  todo: [
    'Owner: settle the delivery charge and free-delivery threshold (brand-config £5.99 under £60 vs settings.json 0/0 vs FAQ "communicated when confirmed").',
    'Owner: the home-page banner offers "Click & collect" while collection is switched off; switch it on or change the banner.',
    'Owner: refund.html is a food-shop text ("freshly made to order", UPI refunds); it needs a grocery/UK version.',
    'brand-config.js legal block is marked TODO: entityName ("registered legal/trading name (+ company no. if Ltd)") and registeredAddress ("confirm registered address").',
    'brand-config.js razorpay keyId "rzp_test_DUMMY_KEY_REPLACE_ME" (Razorpay off) — housekeeping, not copy.',
    'www.sribalajistores.co.uk has no valid certificate (TLS name mismatch on 2026-10-05).',
    'Social: no Instagram, Facebook or Google Business Profile is linked from the shop; add any the owner has.'
  ],
  checked: '2026-10-05'
};
