'use strict';
/**
 * Truthfulness and limits lint for promotion copy.
 *
 *   lint(text, ctx) -> { ok, errors: [{rule, msg, match}], warnings: [...], count, limit }
 *
 * ctx (all optional):
 *   pricing           'free' | 'freemium'  (freemium = /ai/ tools: account, 10 calls a month, text sent to a model)
 *   section           section slug (no-watermark claims are media-only)
 *   limit             hard limit for this text
 *   countMode         'chars' (default) | 'x' (URLs count 23) | 'graphemes' | 'words'
 *   requireDisclosure true when the venue/template needs an ownership line next to a link
 *   record            the tool record (names inside its own description are interop facts, not comparisons)
 *
 * Errors are things that must not be published. Warnings are for the human to read.
 */

const COMPETITORS = [
  'Adobe', 'Acrobat', 'Smallpdf', 'iLovePDF', 'Sejda', 'PDF24', 'PDFescape', 'Soda PDF', 'Canva', 'Capium', 'Xero',
  'QuickBooks', 'Sage', 'Zoho', 'FreshBooks', 'ClearTax', 'Tally', 'Busy', 'Vyapar', 'ChatGPT', 'OpenAI', 'Gemini',
  'Copilot', 'Remove.bg', 'Photoroom', 'CapCut', 'VEED', 'Kapwing', 'TinyPNG', 'Grammarly', 'Calculator.net',
  'Omni Calculator', 'Gusto', 'Paychex', 'Keka', 'greytHR', 'Razorpay', 'Zamzar', 'CloudConvert', 'Convertio',
  'QR Code Monkey', 'QR Code Generator Pro', 'Bitly', 'Otter', 'Descript', 'Rev',
];
/* Business words that collide with competitor names ("Sage advice", "busy month"):
   only matched with the capital letter, and these two only as whole words. */
const CASE_SENSITIVE = ['Sage', 'Busy', 'Rev', 'Tally', 'Otter', 'Gemini', 'Copilot'];

const DISPARAGE = /\b(unlike|worse|terrible|awful|overpriced|over-priced|rip[- ]?off|scam|sucks|garbage|useless|greedy|expensive|instead of paying|ditch|better than|cheaper than|alternative to|replaces?|stop using|bloated|clunky|junk)\b/i;

/* A sentence containing one of these qualifies a privacy claim. */
const QUALIFIER = /(on page load|until you|after you (accept|opt|consent|agree)|only (if|after|when|once) you (accept|opt|consent|agree)|consent bar|consent|opt[- ]in|opt in)/i;

const DISCLOSURE = /(disclosure|\bI built\b|\bI made\b|\bI run\b|\(mine\)|\bmine\b|I'm the author|\bI maintain\b|\bmy (site|tool|page)\b|I'm Vishal|built this|I run the site|I run that site|I built this site)/i;

const ALLOWANCE = /(\b(10|ten)\b[^.\n]{0,30}\b(runs?|calls?|a month|per month|free|included)\b|\bfree (for|tier of) (10|ten)\b)/i;

function sentences(text) {
  return String(text).split(/(?<=[.!?])\s+|\n+/);
}

function count(text, mode) {
  const s = String(text || '');
  if (mode === 'x') return [...s.replace(/https?:\/\/\S+/g, 'x'.repeat(23))].length;
  if (mode === 'graphemes') {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) return [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length;
    return [...s].length;
  }
  if (mode === 'words') return s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').split(/\s+/).filter((w) => /[A-Za-z0-9£₹]/.test(w)).length;
  return [...s].length;
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function lint(text, ctx) {
  ctx = ctx || {};
  const t = String(text || '');
  const errors = [];
  const warnings = [];
  const err = (rule, msg, match) => errors.push({ rule, msg, match: match || '' });
  const warn = (rule, msg, match) => warnings.push({ rule, msg, match: match || '' });

  // 1. absolute privacy
  let m = t.match(/\b100\s*%\s*(private|secure|safe|anonymous|privacy|confidential)|\b(completely|totally|fully|absolutely|perfectly) (private|anonymous)\b/i);
  if (m) err('absolute-privacy', 'Never claim "100% private" or equivalent; say "nothing you type is uploaded".', m[0]);

  for (const s of sentences(t)) {
    // 2. third-party requests
    m = s.match(/\b(no|zero|without any|never any|doesn'?t make any|makes no) third[- ]part(y|ies)( requests?| calls?| scripts?| cookies?)?\b|\bnothing (ever )?contacts a third party\b/i);
    if (m && !QUALIFIER.test(s)) err('third-party', 'Third-party claim needs the qualifier: "nothing contacts a third party on page load; analytics only after you opt in".', m[0]);
    // 3. tracking / analytics / cookies
    m = s.match(/\b(no|zero|without|never any) (tracking|trackers|analytics|cookies)\b|\bdoesn'?t track\b|\bnever tracks?\b|\bnot tracked\b|\btracking[- ]free\b/i);
    if (m && !QUALIFIER.test(s)) err('tracking', 'Analytics load after consent: never say "no tracking" without "only after you opt in".', m[0]);
    // 4. absolute "nothing is sent"
    m = s.match(/\bnothing (is |ever |gets )?(sent|transmitted|shared) (anywhere|to anyone|off)\b|\bsends nothing\b|\bno data (is |ever )?(sent|collected|leaves)\b|\bnever (sends|collects) (any )?data\b/i);
    if (m && !QUALIFIER.test(s)) err('nothing-sent', 'Too absolute: analytics may load after consent. Say "nothing you type is uploaded".', m[0]);
  }

  // 5. superlatives the generator never uses
  m = t.match(/\b(the )?best\s+(free\s+)?(tool|app|site|website|calculator|converter|editor|generator|option|pdf tool|way to)\b|(^|\s)#1\b|\bnumber one\b|\bunlimited\b|\bthe only (tool|site|app|page)\b|\bworld'?s (best|first|fastest)\b/i);
  if (m) err('superlative', 'No "best", "#1", "unlimited" or "the only" claims.', m[0].trim());

  // 6. fake scarcity
  m = t.match(/\blimited[- ]time\b|\bonly \d+ (left|spots?|places?|seats?)\b|\bhurry\b|\bact now\b|\blast chance\b|\bends (today|tonight|soon)\b|\bwhile (stocks?|supplies|it) lasts?\b|\bbefore it'?s gone\b|\bprice goes up\b/i);
  if (m) err('scarcity', 'No scarcity or urgency claims.', m[0]);

  // 7. fake testimonials / invented counts
  m = t.match(/\b\d[\d,.]*\s*(k|m|million|thousand)?\+?\s*(happy |active |monthly |satisfied |daily )?(users|customers|downloads|sign-?ups|subscribers|members|businesses|accountants|teachers|people)\b(?! (who|that) (ask|asked))/i);
  if (m) err('user-count', 'No user counts or invented metrics.', m[0]);
  m = t.match(/\btrusted by\b|\bloved by\b|\bused by (thousands|millions|hundreds|over)\b|\bjoin (thousands|millions|hundreds|\d)|★★★|\b5[- ]star\b|\b(my|a) (friend|colleague|client|mate) (sent|showed|recommended)( me)?\b/i);
  if (m) err('testimonial', 'No testimonials, social proof or "a friend sent me this".', m[0]);

  // 8. competitors
  const own = ctx.record ? (ctx.record.title + ' ' + ctx.record.description + ' ' + (ctx.record.keywords || []).join(' ')) : '';
  for (const name of COMPETITORS) {
    const flags = CASE_SENSITIVE.includes(name) ? 'g' : 'gi';
    const re = new RegExp('(^|[^A-Za-z0-9])' + escRe(name) + '(?![A-Za-z0-9])', flags);
    let hit;
    while ((hit = re.exec(t))) {
      const at = hit.index + hit[1].length;
      const win = t.slice(Math.max(0, at - 50), at + name.length + 50);
      if (DISPARAGE.test(win)) err('competitor', 'Never disparage or compare against a named competitor.', name);
      else if (!new RegExp('(^|[^A-Za-z0-9])' + escRe(name) + '(?![A-Za-z0-9])', flags).test(own)) warn('competitor-named', 'Names ' + name + ': only as an interop fact, never as a comparison.', name);
      break;
    }
  }

  // 9. AI for Business (freemium) truth
  if (ctx.pricing === 'freemium') {
    m = t.match(/\bon (your|the) (device|phone|laptop|computer)\b|\boffline\b|\bnothing (you type |you enter )?(is |gets )?uploaded\b|\bno uploads?\b|\bwithout (an? )?upload(ing)?\b|\bno server\b|\bno account\b|\bno sign-?ups?\b|#nosignup\b|\bno login\b|\bnever leaves\b|\bclient-side\b|\bentirely in (your|the) browser\b|\bruns in your browser\b|#ondeviceai|#offlineai|#worksoffline/i);
    if (m) err('ai-claim', 'AI for Business tools need an account and send text to a model: no on-device, offline, no-upload or no-account claims.', m[0]);
    if (/\bfree\b/i.test(t.replace(/#\w+/g, (h) => (/free/i.test(h) ? ' free ' : ' '))) && !ALLOWANCE.test(t)) {
      err('ai-free', 'AI tools are free only for 10 runs a month: say so wherever "free" appears.', 'free');
    }
  }

  // 10. no-watermark is a media claim
  if (ctx.section && !['pdf', 'image', 'ai-image', 'ai-video'].includes(ctx.section)) {
    m = t.match(/\bno watermarks?\b|#nowatermark/i);
    if (m) err('watermark', '"No watermark" only for media tools (pdf, image, ai-image, ai-video).', m[0]);
  }

  // 11. disclosure next to a link
  if (ctx.requireDisclosure && /(https?:\/\/|1234tools\.com|1234tools dot com)/i.test(t) && !DISCLOSURE.test(t)) {
    err('disclosure', 'This venue needs ownership disclosed where the tool is mentioned.', '');
  }

  // 12. limits
  const n = count(t, ctx.countMode);
  if (ctx.limit && n > ctx.limit) err('limit', 'Over the limit: ' + n + ' > ' + ctx.limit + (ctx.countMode ? ' (' + ctx.countMode + ')' : '') + '.', String(n));

  // warnings
  m = t.match(/\[(Add|Your|your|Write|write|Fill|fill|Answer|answer)[^\]]*\]/);
  if (m) warn('placeholder', 'Fill in the bracketed part before posting.', m[0].slice(0, 60));
  const links = (t.match(/https?:\/\/\S+/g) || []).length;
  if (links > 1 && !ctx.multiLinkOk) warn('links', links + ' links: one link per piece.', String(links));
  if (/utm_/i.test(t) && ctx.cleanOnly) warn('utm', 'This venue dislikes tracking parameters; use the clean URL.', 'utm_');

  return { ok: errors.length === 0, errors, warnings, count: n, limit: ctx.limit || 0 };
}

module.exports = { lint, count, COMPETITORS };

if (require.main === module) {
  const text = process.argv.slice(2).join(' ');
  const r = lint(text, {});
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}
