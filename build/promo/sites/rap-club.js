'use strict';
/** Site profile: RAP CLUB, a shop on XLeShop. SKELETON: no items yet. Read from E:/projects/XLeShop/rapclub (read-only;
 *  git https://github.com/vmanthani/rapclub.git, last commit 21e6221 2026-10-02; firebase project rapclub2026),
 *  xleshop-shared/docs/RAPCLUB_ONBOARDING.md and RAPCLUB_BUILD_PLAN.md, and the live site https://rapclub.co.in on
 *  2026-10-05, plus the public menu.json / settings.json / details.json under xleshop-menu.storage.googleapis.com/rc/.
 *  Menswear (shirts, sizes XS–XXL), India. The domain now serves the XLeShop storefront, but it is a PROTOTYPE:
 *  rapclub/ASSETS_NEEDED.md says "this build is a prototype. The business will supply its own catalogue and
 *  photography. Placeholder imagery is used until then", and the 18 shirts on the live menu are the developer's sample
 *  catalogue (xleshop-shared/docs/rapclub-sample-catalogue.csv) with SVG drawings for photos and a size guide marked
 *  "provisional". Nothing on the site is yet the shop's own confirmed range, so no item is promoted. */
const SHOP = require('./_shop');

module.exports = {
  id: 'rap-club',
  name: 'RAP CLUB',
  baseUrl: 'https://rapclub.co.in',
  domainSource: 'public/brand-config.js domain "rapclub.co.in" / url "https://rapclub.co.in" (lines 40-41); public/sitemap.xml <loc>https://rapclub.co.in/...; curl https://rapclub.co.in/ and https://www.rapclub.co.in/ both end 200 at https://rapclub.co.in/ (no www) on 2026-10-05, title "RAP CLUB — Premium Cotton Shirts, Tailored Fit" (the XLeShop storefront; RAPCLUB_ONBOARDING.md of 2026-09-21 still described the domain as "a GoDaddy Website Builder placeholder"). Canonical tags are written empty and filled by script; clean URLs (/faq.html 301s to /faq).',
  repo: 'E:/projects/XLeShop/rapclub',
  platform: 'xleshop',
  pickerGroup: SHOP.PICKER_GROUP,
  kind: 'shop',
  promotes: 'products',
  utm: { medium: 'social' },
  brandWords: ['RAP CLUB', 'Style Meets Urban Culture'],
  colours: { primary: '#092151', accent: '#B9233A', background: '#FFFFFF', ink: '#101828' },
  colourSource: 'public/brand-config.js colors.primary / accent / bg / text (lines 113-119). The file warns (lines 108-111) they were "SAMPLED FROM AN IMAGE, NOT FROM THE SOURCE ARTWORK ... Re-sample from the AI/PDF/SVG before launch".',
  logo: 'E:/projects/XLeShop/rapclub/public/images/logo.png',
  audiences: ['general', 'india'],
  regions: ['india'],
  area: null,
  areaSource: 'Not confirmed. settings.json deliveryLocations.label "Delivered across India" and topbar "Free shipping across India" are prototype settings; faq.html "What areas do you deliver to?" says "We deliver across your delivery area — TODO: confirm and update"; brand-config.js address "PLACEHOLDER ADDRESS — NOT A REAL LOCATION — REPLACE BEFORE LAUNCH". Market India: country "India", timezone "Asia/Kolkata", +91 phone, ₹.',
  social: {
    instagram: null,
    facebook: null,
    whatsapp: 'https://wa.me/919000944842',
    whatsappChannel: null,
    youtube: null,
    googleBusiness: null,
    source: 'WhatsApp: public/contact.html "Chat on WhatsApp" and index.html JSON-LD sameAs, both built from brand-config.js phoneWA "919000944842" (line 61); the phone is not marked as a placeholder, but the owner should confirm it (ASSETS_NEEDED.md lists support email and hours as still needed). No Instagram, Facebook, YouTube or Google Business link appears on any public page.'
  },
  calendarTargets: SHOP.TARGETS,
  disclosure: SHOP.disclosure('RAP CLUB'),
  rules: SHOP.rules({
    type: 'fashion',
    market: 'india',
    allow: [],
    free: false,
    freePhrases: [],
    forbid: [
      { rule: 'rapclub-prototype-promises', re: '\\bfree shipping\\b|\\bsize exchange\\b|\\b\\d+[- ]day (size )?(exchange|returns?)\\b|\\beasy (returns|exchanges?)\\b|\\bdispatched in\\b|\\b\\d\\s?[–-]\\s?\\d (working|business) days\\b', msg: 'The prototype shows "Free shipping across India", "7-day size exchange" and "Dispatched in 2–3 business days", but the refund page is still a food-shop template and the onboarding docs list the policy pages as not written. No shipping, exchange or dispatch promises until the owner confirms the policies.' },
      { rule: 'rapclub-sale-label', re: '\\bsale\\b|\\bmrp\\b|\\bslashed\\b|\\bmarked down\\b', msg: 'Every sample product carries the label "SALE" with an MRP above the price (sample catalogue). No sale or MRP talk.' },
      { rule: 'rapclub-not-affiliated', re: '\\bblack ?thread\\b', msg: 'RAPCLUB_ONBOARDING.md names a reference site the client admires. Never name it: RAP CLUB is not affiliated with it.' },
      { rule: 'rapclub-made-in-india', re: '\\bmade in india\\b|\\bhand[- ]set\\b|\\bhandmade\\b|\\bhand[- ]crafted\\b|\\b100\\s*% (cotton|linen)\\b|\\bpure linen\\b|\\bpremium cotton\\b', msg: 'Fabric, origin and handwork lines ("100% Cotton", "Pure Linen", "Premium Cotton", "Made in India", "hand-set stone") come from the sample catalogue, not from the owner. Owner to confirm per product before any copy uses them.' }
    ],
    notes: [
      'SKELETON: RAP CLUB\'s live site is the XLeShop prototype with a sample catalogue (ASSETS_NEEDED.md: "this build is a prototype. The business will supply its own catalogue and photography"). Add items only from the owner\'s real catalogue once it replaces the sample.',
      'Launch scope per RAPCLUB_ONBOARDING.md: shirts only; trousers and other readymade lines to follow. Owner\'s tagline from the hang tag: "Style Meets Urban Culture".',
      'Cash on Delivery only today (settings.json payments: cod true; Razorpay off pending KYC per ASSETS_NEEDED.md).',
      'Fashion rules: no prices, sale or MRP, no shipping/exchange promises, no "best"/"bestseller", no counts of customers.'
    ]
  }),
  items: [],
  notConfirmed: [
    'All 18 products on the live menu (2026-10-05) are the sample catalogue seeded from xleshop-shared/docs/rapclub-sample-catalogue.csv (SETUP_CHECKLIST.md §3 "Seed 20 sample shirts"): Botanical Printed Half Sleeve — Cream; Corduroy Shirt — Bottle Green; Corduroy Shirt — Camel; Denim Shirt — Indigo; Denim Shirt — Mid Wash; Embroidered Party Shirt — Black; Fine Stripe Shirt — Blue; Floral Printed Shirt — Wine; Gingham Check Shirt — Navy; Premium Cotton Oxford Shirt — Charcoal / Sky / White; Pure Linen Full Sleeve Shirt — Ivory / Wine; Pure Linen Half Sleeve Shirt — Sage; Stone Work Party Shirt — Wine; Tartan Check Shirt — Wine; Windowpane Check Shirt — Olive. Each has a live page under /product/ (200), but the owner has not supplied the range, so none is an item.',
    'Categories on the live site (all 200): /c/shirts and /c/shirts/solid, linen, printed, checks, corduroy, striped, denim, evening (sample taxonomy). Not items for the same reason.',
    'Product photos are SVG drawings (public/images/shirt/RC-*.svg), placeholders until the owner\'s shoot (ASSETS_NEEDED.md §2).',
    'Size guide in details.json: "Measurements are provisional and pending confirmation against production garments" (SETUP_CHECKLIST.md: "a plausible template, not measured fact").',
    'Prices, MRPs and the "SALE" label on every product: sample data; never used.',
    'Shipping and returns: topbar "Free shipping across India · Premium cotton, tailored fit", settings.json stripe "Free shipping across India · 7-day size exchange · Made in India", details.json "Free shipping across India. Dispatched in 2–3 business days", faq.html "Delivery is free on every order" and "Orders arrive in 3–7 working days". The refund page is still the food-shop template ("Because our products are freshly made to order...") and offers no size exchange, so these contradict each other: not used.',
    'Storefront bands (settings.json): "Shirts cut for a clean line.", "The Linen Edit", "Evening shirts", "The Oxford, three ways", "Since 2026"; two bands use watermarked Shutterstock preview images hot-linked from www.shutterstock.com (b3 and b4). Not used; see todo.',
    'Footer "Premium cotton shirts, tailored fit. Made in India. Since 2026." and the tagline "Style Meets Urban Culture" (owner\'s, from the hang tag): the tagline is safe as a brand line; fabric/origin claims wait for the real catalogue.',
    'Address: "PLACEHOLDER ADDRESS — NOT A REAL LOCATION — REPLACE BEFORE LAUNCH" (brand-config.js and legal.registeredAddress); legal.entityName "this tenant" // TODO.',
    'Contact hours on contact.html "Mon–Sat, 9 am – 7 pm" are the template default; ASSETS_NEEDED.md lists support hours as not yet given.',
    'Payment: Cash on Delivery only; Razorpay waits for KYC.'
  ],
  todo: [
    'TODO: owner to supply the real catalogue and photography (ASSETS_NEEDED.md §2, RAPCLUB_BUILD_PLAN.md §8 items 1-2); then add items (at least 8) from the live product and category pages.',
    'TODO: replace the sample catalogue on the live site; it is public, indexed in sitemap.xml and labelled "SALE" with MRPs.',
    'TODO: remove the two hot-linked Shutterstock preview images from the settings.json storefront bands (b3, b4): watermarked stock previews used without a licence.',
    'TODO: write the policy pages (shipping, return & exchange, cancellation & refund): the live refund page is the food template and contradicts the "7-day size exchange" band.',
    'TODO: replace the placeholder address and legal entity name in brand-config.js; confirm the phone/WhatsApp number, support email (brand-config.js care@rapclub.co.in vs ASSETS_NEEDED.md rapclub2026@gmail.com) and support hours.',
    'TODO: faq.html "What areas do you deliver to?" still says "TODO: confirm and update".',
    'TODO: re-sample brand colours from the hang-tag artwork (brand-config.js warning) and update colours here.',
    'TODO: Instagram / Facebook links if the brand has them (none on the site).'
  ],
  checked: '2026-10-05'
};
