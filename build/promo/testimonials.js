'use strict';
/**
 * Testimonials: named client quotes, kept per site, published only with the client's
 * written permission.
 *
 * Owner decision, 2026-10-05: testimonials may come back on any MVR site only as named
 * quotes given with each client's written permission. Everything here enforces that:
 *
 *   a record     { id, site, name, role, business, contact, quote (the client's exact words), about,
 *                  uses: ['site-pages' | 'social' | 'kits'],
 *                  permission: { given: 'yes' | 'no' | '', how: 'email-reply' | 'signed-form' | 'message', date: 'YYYY-MM-DD', evidence },
 *                  rating: null | { value: 1-5, outOf: 5, evidence }   (only when the client gave one in writing),
 *                  incentive: false, key (optional: the site's own key, e.g. XLeShop's `shot`),
 *                  status: requested -> received -> approved -> published -> withdrawn,
 *                  published: [{ url, at, removedAt? }], history: [{ at, status, note }] }
 *   the gate     a quote can be approved, published or exported only when permission.given is "yes" with a
 *                date (not in the future), the way it was given, the evidence the owner keeps, the client's
 *                contact details, a name and a business (a shop's customers: the business only if they give
 *                one), at least one place it may be used, and no incentive.
 *                Approved words are frozen: a change needs the client's OK again.
 *   withdrawn    leaves every export at once and lists each published URL still to take down.
 *
 * Stored in PROMO_HOME (or PROMO_HOME/sites/<id>/ for any site but 1234Tools) as testimonials.json,
 * the same pattern as store.js: one file per site, written to a temporary file and renamed.
 *
 *   list(filter)               { items, counts }
 *   get(id) / add(fields) / update(id, fields) / setStatus(id, status, { url, note }) / markTakenDown(id, url)
 *   gate(rec)                  [reasons a record may not be approved, published or exported]
 *   requestEmail(opts)         { subject, body, whatsapp, places, lint }  the request in plain British English
 *   exportFor(use)             { items (JSON array), html, js (XLeShop QUOTES map), refused, takeDown }
 *   suggestions()              first requests for the owner to send (XLeShop: its client shops' owners;
 *                              MVR IT Services: the clients on its site's client list; others: none)
 *
 * The desk never contacts anyone: the email and WhatsApp texts are for the owner to send by hand.
 *
 * Sources, read 2026-10-05:
 *   CAP Code (UK non-broadcast), section 3, "Endorsements and testimonials":
 *     https://www.asa.org.uk/type/non_broadcast/code_section/03.html
 *     3.45 "Marketing communications must make clear where consumer reviews have been incentivised."
 *     3.46 "Marketers must not publish consumer reviews, or consumer review information, in a misleading way in
 *          marketing communications."
 *     3.47 "Marketers must hold documentary evidence that a testimonial or endorsement used in a marketing
 *          communication is genuine, unless it is obviously fictitious, and hold contact details for the person
 *          who, or organisation that, gives it."   -> evidence and contact are required before approval
 *     3.48 "Testimonials must relate to the advertised product."   -> `about`, and quotes stay on their own site
 *   Digital Markets, Competition and Consumers Act 2024, Schedule 20 (banned practices), paragraph 13,
 *     in force 6 April 2025 (S.I. 2025/272): https://www.legislation.gov.uk/ukpga/2024/13/schedule/20
 *     13(1) submitting or commissioning "(a) a fake consumer review, or (b) a consumer review that conceals the
 *     fact it has been incentivised"; 13(2) publishing consumer reviews "in a misleading way"; 13(5)(b) a fake
 *     review "purports to be, but is not, based on a person's genuine experience"; 13(5)(g) "'commissioning'
 *     includes incentivising by any means"; 13(5)(i) misleading publication includes removing negative reviews
 *     while publishing positive ones, giving positive ones greater prominence, and omitting how a review came
 *     to be written.   -> no incentive at all; the client's words, unedited; the request invites any honest view
 *   CMA, Fake reviews guidance (CMA208), 4 April 2025:
 *     https://assets.publishing.service.gov.uk/media/67eeb64fe9c76fa33048c790/CMA208_-_Fake_reviews_guidance.pdf
 *     2.4 a consumer review "does not have to be written by a consumer"; 2.10 commissioning includes money,
 *     discounts or vouchers, free products, invitations to events; 3.6 encouraging reviews "without
 *     predetermining the contents or sentiment expressed in the review, for example by merely emailing
 *     customers generally to ask if they wish to provide a review, is not prohibited"; 4.4(b) do not "limit
 *     access to and/or the impact of negative reviews by editing, withholding or removing such reviews";
 *     4.5 cherry picking includes "encouraging just those who are satisfied to leave reviews".
 *     -> no suggested wording, no praise put in the client's mouth, ask clients generally, never edit
 *   CMA, Unfair commercial practices (CMA207), banned practice 13, which refers to CMA208:
 *     https://www.gov.uk/government/publications/unfair-commercial-practices-cma207/unfair-commercial-practices
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('./log');
const SITE = require('./site');
const { lint } = require('./lint');

const FILE = 'testimonials.json';
const STATUSES = ['requested', 'received', 'approved', 'published', 'withdrawn'];
const HOWS = ['email-reply', 'signed-form', 'message'];
const HOW_LABEL = { 'email-reply': 'email reply', 'signed-form': 'signed form', message: 'message (WhatsApp, SMS or similar)' };
const USES = ['site-pages', 'social', 'kits'];
const PHRASE = 'Yes, you may publish this';
const MAX_QUOTE = 600;

/* Where the owner keeps the client's OK; shown as a placeholder in the UI. */
const EVIDENCE_HINT = 'e.g. the email in Outlook "Clients/Quotes", 5 Oct 2026; or the path to a saved PDF or screenshot';

/* XLeShop's customers page keys its QUOTES by each store's `shot` (E:/projects/XLeShop/xleshop/public/js/site.js,
   window.XLE_CUSTOMERS, read 2026-10-05), matched here by the shop's host. */
const XLESHOP_SHOT = {
  'gajananafoods.co.in': 'gajanan', 'sribalajistores.co.uk': 'sri-balaji', 'southbasket.co.in': 'south-basket',
  'naturalcureayurveda.com': 'natural-cure', 'kbkdairyproducts.com': 'kbk-dairy', 'kbkmart.com': 'kbk-mart',
  'aarvikdairyproducts.com': 'aarvik', 'dairyzest.com': 'dairyzest', 'rapclub.co.in': 'rapclub'
};

/* MVR IT Services' client list: products/index.html, section #client-work "Live sites we've built and support"
   (E:/projects/MVRITServicesLTD, read 2026-10-05). XLeShop and Attend Now on the same list are MVR's own
   platforms, not clients, so they are left out. */
const MVR_CLIENTS = [
  { business: 'PESTNEST', url: 'https://pestnest.co.in' },
  { business: 'Gajanana Foods', url: 'https://gajananafoods.co.in' },
  { business: 'South Basket', url: 'https://southbasket.co.in' },
  { business: 'Sri Balaji Stores', url: 'https://sribalajistores.co.uk' },
  { business: 'KBK Dairy Products', url: 'https://kbkdairyproducts.com' },
  { business: 'Natural Cure Ayurveda', url: 'https://naturalcureayurveda.com' },
  { business: 'Swara Vikasa Yoga', url: 'https://swaravikasayoga.com' }
];
const MVR_SOURCE = 'MVR IT Services products page, "Client Work" (products/index.html #client-work), read 2026-10-05';

/* ------------------------------------------------------------------ store */

function file() { return path.join(L.home(), FILE); }
const nowDate = () => (process.env.PROMO_NOW ? new Date(process.env.PROMO_NOW) : new Date());
const now = () => nowDate().toISOString();
const today = () => { const d = nowDate(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function load() {
  let j = null;
  try { j = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (e) { j = null; }
  const items = j && Array.isArray(j.items) ? j.items : [];
  const site = SITE.currentId();
  /* a record carries its site; one that does not belong here is ignored, never shown or exported */
  return { v: 1, site, items: items.filter((r) => r && r.id && (r.site || site) === site) };
}

function save(db) {
  const target = file();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ v: 1, site: SITE.currentId(), items: db.items }, null, 1));
  fs.renameSync(tmp, target);
}

const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 300);

function cleanUses(u) {
  const list = Array.isArray(u) ? u : String(u || '').split(/[\s,]+/);
  const out = [];
  for (const x of list.map((s) => String(s).trim()).filter(Boolean)) {
    if (!USES.includes(x)) throw new Error('Unknown use "' + x + '": choose from ' + USES.join(', ') + '.');
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

function cleanPermission(p, was) {
  p = Object.assign({}, was || { given: '', how: '', date: '', evidence: '' }, p || {});
  const given = String(p.given === true ? 'yes' : p.given === false ? 'no' : p.given || '').toLowerCase();
  if (given && !['yes', 'no'].includes(given)) throw new Error('Permission given must be yes or no.');
  const how = str(p.how, 40);
  if (how && !HOWS.includes(how)) throw new Error('Permission "how" must be one of ' + HOWS.join(', ') + '.');
  const date = str(p.date, 10);
  if (date && !validDate(date)) throw new Error('Permission date must be a real date, YYYY-MM-DD.');
  return { given, how, date, evidence: str(p.evidence, 500) };
}

function cleanRating(r) {
  if (r == null || r === '' || r === false) return null;
  if (typeof r !== 'object') r = { value: r };
  if (r.value == null || r.value === '') return null;
  const value = Number(r.value);
  const outOf = Number(r.outOf || 5);
  if (!Number.isInteger(value) || !Number.isInteger(outOf) || outOf < 1 || outOf > 10 || value < 1 || value > outOf) throw new Error('A rating is a whole number from 1 to ' + (outOf || 5) + '.');
  return { value, outOf, evidence: str(r.evidence, 500) };
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

/* -------------------------------------------------------------- the gate */

/** Every reason this record may not be approved, published or exported; [] when it may. */
function gate(r) {
  const why = [];
  const p = r.permission || {};
  if (!str(r.quote)) why.push('no quote: paste the client\'s final wording, exactly as they sent it');
  if (!str(r.name)) why.push('no name: quotes are published only with the person\'s name');
  /* a shop's customers may be private people: for a shop the business is shown only if they give one */
  if (!str(r.business) && SITE.current().kind !== 'shop') why.push('no business: the request tells the client their business name is shown');
  if (p.given !== 'yes') why.push(p.given === 'no' ? 'the client said no' : 'no written permission recorded (permission given: yes)');
  if (!p.date) why.push('no date for the permission');
  else if (!validDate(p.date)) why.push('the permission date is not a real date');
  else if (p.date > today()) why.push('the permission date is in the future');
  if (!HOWS.includes(p.how)) why.push('how the permission was given is missing (email reply, signed form or message)');
  if (!str(p.evidence)) why.push('no evidence: say where you keep the client\'s reply (CAP Code 3.47)');
  if (!str(r.contact)) why.push('no contact details for the client (CAP Code 3.47)');
  if (!(r.uses || []).length) why.push('no place it may be used (site pages, social, kits)');
  if (r.incentive) why.push('an incentive was given: the desk publishes no incentivised quotes');
  if (r.rating && !str(r.rating.evidence)) why.push('a rating is stored without the client\'s written rating as evidence');
  return why;
}

/* ------------------------------------------------------------- records */

function list(f) {
  f = f || {};
  const all = load().items;
  const counts = { all: all.length };
  for (const s of STATUSES) counts[s] = all.filter((x) => x.status === s).length;
  let items = all;
  if (f.status && f.status !== 'all') items = items.filter((x) => x.status === f.status);
  items = items.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return { items: items.map(view), counts };
}

/** A record with what the UI needs: the gate's reasons and owner notes on the quote. */
function view(r) {
  return Object.assign({}, r, { blocked: gate(r), notes: quoteNotes(r), takeDown: (r.published || []).filter((x) => !x.removedAt) });
}

function get(id) {
  const r = load().items.find((x) => x.id === id);
  return r ? view(r) : null;
}

function newId() { return 't-' + today().replace(/-/g, '') + '-' + crypto.randomBytes(3).toString('hex'); }

const FIELDS = ['name', 'role', 'business', 'contact', 'quote', 'about', 'uses', 'permission', 'rating', 'incentive', 'key', 'note'];
/* Words the client approved: frozen once approved (and while published). */
const FROZEN = ['name', 'role', 'business', 'quote', 'uses', 'rating'];

function apply(r, fields) {
  if ('name' in fields) r.name = str(fields.name, 120);
  if ('role' in fields) r.role = str(fields.role, 120);
  if ('business' in fields) r.business = str(fields.business, 160);
  if ('contact' in fields) r.contact = str(fields.contact, 200);
  if ('quote' in fields) {
    /* the client's exact words: only the outer whitespace and wrapping quotation marks are trimmed */
    const q = String(fields.quote == null ? '' : fields.quote).trim().replace(/^["“'‘]+|["”'’]+$/g, '').trim();
    if ([...q].length > MAX_QUOTE) throw new Error('The quote is ' + [...q].length + ' characters; the request asks for one or two sentences (at most ' + MAX_QUOTE + '). Ask the client to shorten it; the desk does not cut their words.');
    r.quote = q;
  }
  if ('about' in fields) r.about = str(fields.about, 200);
  if ('uses' in fields) r.uses = cleanUses(fields.uses);
  if ('permission' in fields) r.permission = cleanPermission(fields.permission, r.permission);
  if ('rating' in fields) r.rating = cleanRating(fields.rating);
  if ('incentive' in fields) r.incentive = fields.incentive === true || fields.incentive === 'yes' || fields.incentive === 'true';
  if ('key' in fields) r.key = str(fields.key, 60).replace(/[^a-z0-9-]/gi, '');
  if ('note' in fields) r.note = str(fields.note, 500);
}

function add(fields) {
  fields = fields || {};
  const db = load();
  const at = now();
  const r = { id: newId(), site: SITE.currentId(), name: '', role: '', business: '', contact: '', quote: '', about: '', uses: ['site-pages'], permission: cleanPermission({}), rating: null, incentive: false, key: '', note: '', status: 'requested', published: [], history: [], createdAt: at, updatedAt: at, requestedAt: at };
  apply(r, pick(fields));
  if (!r.name && !r.business) throw new Error('Give at least the client\'s name or business.');
  r.status = r.quote ? 'received' : 'requested';
  r.history.push({ at, status: r.status, note: r.quote ? 'added with the client\'s quote' : 'request recorded' });
  if (fields.status && fields.status !== r.status) {
    if (!['approved', 'published'].includes(fields.status)) throw new Error('A new record starts as requested or received.');
    const why = gate(r);
    if (why.length) throw new Error('Not approved: ' + why.join('; ') + '.');
    transition(r, 'approved', {});
    if (fields.status === 'published') transition(r, 'published', { url: fields.url });
  }
  db.items.push(r);
  save(db);
  return view(r);
}

function pick(fields) { const o = {}; for (const k of FIELDS) if (k in fields) o[k] = fields[k]; return o; }

function update(id, fields) {
  const db = load();
  const r = db.items.find((x) => x.id === id);
  if (!r) throw new Error('No testimonial ' + id + ' for ' + SITE.current().name + '.');
  if (r.status === 'withdrawn') throw new Error('This quote was withdrawn. Ask again and record a new one if the client agrees.');
  const f = pick(fields || {});
  if (['approved', 'published'].includes(r.status)) {
    const before = JSON.stringify(FROZEN.map((k) => r[k]));
    const trial = JSON.parse(JSON.stringify(r));
    apply(trial, f);
    if (JSON.stringify(FROZEN.map((k) => trial[k])) !== before) throw new Error('The client approved these words, name and places as they stand. To change them, set it back to "received" (only before it is published) or withdraw it, and get their OK again.');
    if (gate(trial).length) throw new Error('That edit would leave a ' + r.status + ' quote without valid permission: ' + gate(trial).join('; ') + '. Withdraw it instead.');
  }
  apply(r, f);
  if (r.status === 'requested' && r.quote) { r.status = 'received'; r.history.push({ at: now(), status: 'received', note: 'quote added' }); }
  r.updatedAt = now();
  save(db);
  return view(r);
}

/* requested -> received -> approved -> published -> withdrawn; approved may go back to received before it is
   published; anything may be withdrawn (a client who says no, or takes it back); withdrawn is final. */
const NEXT = { requested: ['received', 'withdrawn'], received: ['approved', 'withdrawn'], approved: ['published', 'received', 'withdrawn'], published: ['published', 'withdrawn'], withdrawn: [] };

function transition(r, status, o) {
  o = o || {};
  if (!STATUSES.includes(status)) throw new Error('Status must be one of ' + STATUSES.join(', ') + '.');
  if (!NEXT[r.status].includes(status)) throw new Error(r.status === 'withdrawn' ? 'This quote was withdrawn; it cannot come back. Record a new request if the client agrees again.' : 'A ' + r.status + ' quote cannot go to ' + status + ' (next: ' + NEXT[r.status].join(', ') + ').');
  const at = now();
  if (status === 'received' && !str(r.quote)) throw new Error('Paste the client\'s quote first.');
  if (status === 'received' && r.status === 'approved' && (r.published || []).length) throw new Error('It has been published: withdraw it instead.');
  if (status === 'approved' || status === 'published') {
    const why = gate(r);
    if (why.length) throw new Error((status === 'published' ? 'Not published: ' : 'Not approved: ') + why.join('; ') + '.');
  }
  if (status === 'published') {
    const url = str(o.url, 600);
    if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('Give the URL where it is published (the page or the post), so a withdrawal can list it.');
    r.published = r.published || [];
    if (!r.published.some((x) => x.url === url && !x.removedAt)) r.published.push({ url, at });
  }
  r.history.push({ at, status, note: str(o.note, 300) || (status === 'published' ? 'published at ' + str(o.url, 600) : '') });
  r.status = status;
  r.updatedAt = at;
  if (status === 'withdrawn') r.withdrawnAt = at;
}

function setStatus(id, status, o) {
  const db = load();
  const r = db.items.find((x) => x.id === id);
  if (!r) throw new Error('No testimonial ' + id + ' for ' + SITE.current().name + '.');
  transition(r, status, o);
  save(db);
  return view(r);
}

/** After a withdrawal: the owner took the quote down from one URL. */
function markTakenDown(id, url) {
  const db = load();
  const r = db.items.find((x) => x.id === id);
  if (!r) throw new Error('No testimonial ' + id + '.');
  const p = (r.published || []).find((x) => x.url === url && !x.removedAt);
  if (!p) throw new Error('That URL is not listed as published for this quote.');
  p.removedAt = now();
  r.history.push({ at: p.removedAt, status: r.status, note: 'taken down from ' + url });
  r.updatedAt = p.removedAt;
  save(db);
  return view(r);
}

/* Owner notes on a quote: the client's words are never changed, but a claim in them that the site's own rules
   refuse still needs the owner to check it is true before it goes up (CAP Code: a testimonial does not make
   a claim acceptable on its own). Shown, never blocking. The client's name and business are masked first. */
function quoteNotes(r) {
  if (!str(r.quote)) return [];
  const res = lint(mask(r.quote, r), {});
  return res.errors.concat(res.warnings).filter((e) => e.rule !== 'testimonial').map((e) => e.msg + (e.match ? ' ("' + e.match + '")' : ''));
}

function mask(text, who) {
  let t = String(text);
  const names = [who && who.business, who && who.name, who && who.name && String(who.name).split(/\s+/)[0]].filter((x) => x && String(x).trim().length > 1);
  for (const n of names) t = t.split(new RegExp(String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join('the client');
  return t;
}

/* ------------------------------------------------------- request email */

function host(u) { try { return new URL(u).host; } catch (e) { return String(u || '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''); } }

/** What the client is asked about, per kind of site. */
function subjectOf(p) {
  if (p.id === 'xleshop') return 'running your shop on XLeShop';
  if (p.builtin) return 'using ' + p.name;
  if (p.kind === 'shop') return 'buying from ' + p.name;
  if (p.kind === 'services') return 'working with ' + p.name;
  return 'using ' + p.name;
}

function places(p, uses) {
  const out = [];
  for (const u of uses) {
    if (u === 'site-pages') out.push('the ' + p.name + ' website (' + host(p.baseUrl) + ')');
    if (u === 'social') out.push(p.name + '\'s social media posts');
    if (u === 'kits') out.push('promotion images made for ' + p.name);
  }
  return out;
}
function joinAnd(xs) { return xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; }

/**
 * The request, for the owner to send by hand. opts: { id } (a saved record), or { name, business, uses, from }.
 * No suggested wording, no incentive, any honest view welcome (CMA208 3.6, 4.5); exactly where it will appear,
 * that the name and business are shown, that no is fine and that it can be withdrawn by replying.
 */
function requestEmail(opts) {
  opts = opts || {};
  const p = SITE.current();
  const rec = opts.id ? load().items.find((x) => x.id === opts.id) : null;
  if (opts.id && !rec) throw new Error('No testimonial ' + opts.id + '.');
  const name = str(opts.name != null && opts.name !== '' ? opts.name : rec && rec.name, 120);
  const business = str(opts.business != null && opts.business !== '' ? opts.business : rec && rec.business, 160);
  const uses = cleanUses(opts.uses != null && String(opts.uses) !== '' ? opts.uses : (rec && rec.uses && rec.uses.length ? rec.uses : ['site-pages']));
  if (!uses.length) throw new Error('Choose at least one place the quote would appear.');
  const from = str(opts.from, 120) || p.name;
  const first = name ? name.split(/\s+/)[0] : '';
  const where = places(p, uses);
  const about = subjectOf(p);
  const shopper = p.kind === 'shop' && !business;
  const shown = shopper ? 'Your name, and your business name if you give one, will be shown next to it.' : 'Your name, your role and your business name' + (business ? ' (' + business + ')' : '') + ' will be shown next to it.';
  const shownWa = shopper ? 'your name (and your business name, if you give one)' : 'your name, role and business name' + (business ? ' (' + business + ')' : '');
  const subject = uses.includes('site-pages') ? 'May we quote you on the ' + p.name + ' website?' : 'May we quote you in ' + p.name + '\'s posts?';
  const body = [
    'Hello' + (first ? ' ' + first : '') + ',',
    '',
    'Would you be willing to write one or two sentences about your experience of ' + about + '? Please use your own words and say whatever is true for you, good or bad. We will not change your words; if a quote needs shortening, we will send you the shorter version to approve first.',
    '',
    'If you agree, your words will appear in ' + (where.length === 1 ? 'this place' : 'these places') + ' only:',
    where.map((w) => '- ' + w).join('\n'),
    '',
    shown,
    '',
    'Nothing is offered in return, and saying no is completely fine. If you agree now, you can still ask us to take the quote down at any time: just reply to this email and we will remove it.',
    '',
    'If you are happy for us to publish it, please reply with your final wording and the words "' + PHRASE + '".',
    '',
    'Thank you,',
    from
  ].join('\n');
  const whatsapp = [
    'Hello' + (first ? ' ' + first : '') + ', would you write one or two sentences, in your own words, about your experience of ' + about + '? Say whatever is true for you; we will not change your words.',
    '',
    'It would appear only on ' + joinAnd(where) + ', with ' + shownWa + '.',
    '',
    'Nothing is offered in return, and no is a fine answer. You can ask us to take it down at any time by replying here.',
    '',
    'If you are happy for us to publish it, please reply with your final wording and "' + PHRASE + '". Thank you! ' + from
  ].join('\n');
  /* linted with the site's own rules; the recipient's own name and business are not promotion copy */
  const who = { name, business };
  const lEmail = lint(mask(subject + '\n' + body, who), {});
  const lWa = lint(mask(whatsapp, who), {});
  return { site: p.id, subject, body, whatsapp, places: where, uses, phrase: PHRASE, lint: { email: lEmail, whatsapp: lWa, ok: lEmail.ok && lWa.ok } };
}

/* ---------------------------------------------------------------- export */

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c])); }

/**
 * Approved and published quotes for one use, as the JSON array a site's QUOTES list or testimonials section
 * can read, an HTML snippet, and (where records carry a key, e.g. XLeShop's `shot`) a QUOTES object.
 * Withdrawn quotes never appear; any approved or published record failing the gate is refused and listed.
 * Star ratings appear only where the client gave one in writing (stored with its evidence).
 */
function exportFor(use) {
  use = use || 'site-pages';
  if (!USES.includes(use)) throw new Error('Export for one of ' + USES.join(', ') + '.');
  const p = SITE.current();
  const all = load().items;
  const refused = [];
  const ok = [];
  for (const r of all) {
    if (!['approved', 'published'].includes(r.status)) continue;
    if (!(r.uses || []).includes(use)) continue;
    const why = gate(r);
    if (why.length) { refused.push({ id: r.id, name: r.name, why }); continue; }
    ok.push(r);
  }
  ok.sort((a, b) => String(a.permission.date).localeCompare(String(b.permission.date)) || String(a.name).localeCompare(String(b.name)));
  const items = ok.map((r) => {
    const o = { name: r.name, role: r.role, business: r.business, quote: r.quote, date: r.permission.date };
    if (r.rating) o.rating = { value: r.rating.value, outOf: r.rating.outOf };
    if (r.key) o.key = r.key;
    return o;
  });
  const fig = (o) => [
    '  <figure class="testimonial">',
    '    <blockquote><p>\u201C' + esc(o.quote) + '\u201D</p></blockquote>',
    o.rating ? '    <p class="t-rating" aria-label="' + esc('Rated ' + o.rating.value + ' out of ' + o.rating.outOf + ' by ' + o.name) + '">' + '\u2605'.repeat(o.rating.value) + '\u2606'.repeat(o.rating.outOf - o.rating.value) + '</p>' : null,
    '    <figcaption><span class="t-name">' + esc(o.name) + '</span>' + (o.role ? ', <span class="t-role">' + esc(o.role) + '</span>' : '') + (o.business ? ', <span class="t-business">' + esc(o.business) + '</span>' : '') + '</figcaption>',
    '  </figure>'
  ].filter((x) => x != null).join('\n');
  const html = items.length ? [
    '<!-- ' + esc(p.name) + ': client quotes for ' + use + ', exported ' + today() + ' by the Promotion Desk. Each is the client\'s own words,',
    '     published with their written permission (kept by the owner). Remove a quote as soon as the client withdraws it. -->',
    '<section class="testimonials" aria-label="Clients in their own words">',
    items.map(fig).join('\n'),
    '  <p class="t-note">Quoted with each person\'s permission.</p>',
    '</section>'
  ].join('\n') : '';
  const keyed = items.filter((o) => o.key);
  /* Keyed objects, not bare strings: a quote is published only with the person's name, so the page must show
     name, role and business beside the words (XLeShop's js/site.js renders QUOTES[shot] as a bare string
     inside a <blockquote> today; it needs q.quote plus a caption before these go in). */
  const js = keyed.length ? '/* ' + p.name + ' quotes, keyed for the site (exported ' + today() + '). Each is the client\'s own words with their written OK.\n   Show name, role and business with every quote: render q.quote in the blockquote and q.name, q.role, q.business beneath it. */\nvar QUOTES = ' + JSON.stringify(Object.fromEntries(keyed.map((o) => [o.key, { quote: o.quote, name: o.name, role: o.role, business: o.business, date: o.date }])), null, 2) + ';' : '';
  const takeDown = all.filter((r) => r.status === 'withdrawn').flatMap((r) => (r.published || []).filter((x) => !x.removedAt).map((x) => ({ id: r.id, name: r.name, url: x.url })));
  return { site: p.id, use, items, json: JSON.stringify(items, null, 2), html, js, refused, takeDown };
}

/* ----------------------------------------------------------- suggestions */

/** First requests for the owner to send. The desk contacts nobody. */
function suggestions() {
  const p = SITE.current();
  if (p.id === 'xleshop') {
    return SITE.list().filter((s) => s.kind === 'shop' && (SITE.get(s.id).platform === 'xleshop' || s.group === 'XLeShop shops')).map((s) => {
      const prof = SITE.get(s.id);
      const notes = ['The shop profile (build/promo/sites/' + s.id + '.js) names no owner: use the contact you already have.'];
      if (!s.items) notes.push('Skeleton: the store is still a prototype with a sample catalogue. Ask once it trades.');
      if (s.id === 'natural-cure-ayurveda') notes.push('The quote is about XLeShop; if it names any health effect, it cannot be used.');
      if (MVR_CLIENTS.some((c) => host(c.url) === host(prof.baseUrl))) notes.push('Also on MVR IT Services\' client list: ask once, saying which site each quote would go on.');
      return { business: s.name, role: 'Owner', name: '', url: s.baseUrl, key: XLESHOP_SHOT[host(s.baseUrl)] || '', source: 'build/promo/sites/' + s.id + '.js', notes };
    });
  }
  if (p.id === 'mvr-it') {
    return MVR_CLIENTS.map((c) => {
      const notes = ['Named on ' + MVR_SOURCE + '. Use the contact you already have.'];
      const shop = SITE.list().find((s) => s.kind === 'shop' && host(s.baseUrl) === host(c.url));
      if (shop) notes.push('Also an XLeShop shop (' + shop.name + '): ask once, saying which site each quote would go on.');
      return { business: c.business, role: 'Owner', name: '', url: c.url, key: '', source: MVR_SOURCE, notes };
    });
  }
  return [];
}

module.exports = { STATUSES, HOWS, HOW_LABEL, USES, PHRASE, EVIDENCE_HINT, XLESHOP_SHOT, MVR_CLIENTS, file, list, get, add, update, setStatus, markTakenDown, gate, requestEmail, exportFor, suggestions, quoteNotes };
