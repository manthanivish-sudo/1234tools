'use strict';
/**
 * Promotion copy templates (copy spec Part B section 2).
 *
 *   render(templateId, record, opts) -> { id, text, title?, parts[], chars, limit, countMode,
 *                                         url, cleanUrl, utmUrl, warnings[], errors[], lint }
 *   record(toolPath)                  -> tool record (from tools.js)
 *   utmUrl(toolPath, venueId, medium)
 *
 * Deterministic: the same (template, record, opts) always gives the same text.
 * opts:
 *   variant    integer; pick(slot, arr) = arr[(variant + slot) % arr.length]
 *   venue      venue object from venues.json (limits, link policy, angle, id)
 *   venueId    used for UTM when no venue object is given
 *   question   string or {title, url, body} - a live thread the answer templates reply to
 *   result     {summary, params} - a figure produced by the tool itself (never invented)
 *   angle      hook angle override
 *   metric     indiehackers: one honest metric (never invented)
 *   firstName, theirPageTitle, pageTopic   email-outreach slots
 *
 * Nothing here publishes anything: every template returns text a human pastes.
 */
const T = require('./tools');
const H = require('./hooks');
const TAGS = require('./hashtags');
const { lint, count } = require('./lint');

/* ------------------------------------------------------------------ meta */

const META = {
  'reddit-comment': { label: 'Reddit comment', limit: 1200, medium: 'community', clean: true, disclose: true, answer: true },
  'reddit-post': { label: 'Reddit post', limit: 2000, medium: 'community', clean: true, disclose: true },
  'hn-show': { label: 'Show HN', limit: 1500, medium: 'launch', clean: true },
  'hn-comment': { label: 'HN comment', limit: 1000, medium: 'community', clean: true, disclose: true, answer: true },
  'ph-launch': { label: 'Product Hunt launch', limit: 1500, medium: 'launch' },
  'x-post': { label: 'X post', limit: 280, countMode: 'x', medium: 'social' },
  'x-thread': { label: 'X thread (5 posts)', limit: 280, countMode: 'x', medium: 'social' },
  'linkedin-post': { label: 'LinkedIn post', limit: 1300, medium: 'social' },
  'facebook-group': { label: 'Facebook group post', limit: 800, medium: 'community', disclose: true },
  'pinterest-pin': { label: 'Pinterest pin', limit: 500, medium: 'social' },
  'youtube-comment': { label: 'YouTube comment', limit: 500, medium: 'video', disclose: true, answer: true },
  'youtube-description': { label: 'YouTube Short description', limit: 5000, medium: 'video', multiLink: true },
  'quora-answer': { label: 'Quora answer', limit: 2500, medium: 'community', disclose: true, answer: true },
  'stackexchange-answer': { label: 'Stack Exchange answer', limit: 3000, medium: 'community', clean: true, disclose: true, answer: true, needsQuestion: true },
  'forum-reply': { label: 'Forum reply', limit: 1000, medium: 'forum', disclose: true, answer: true },
  'forum-post': { label: 'Forum post', limit: 1500, medium: 'forum', disclose: true },
  'devto-article': { label: 'dev.to article outline', limit: 1200, medium: 'community', multiLink: true },
  'indiehackers-post': { label: 'Indie Hackers post', limit: 1500, medium: 'community' },
  'discord-message': { label: 'Discord message', limit: 600, medium: 'community', disclose: true, answer: true },
  'whatsapp-broadcast': { label: 'WhatsApp broadcast', limit: 400, medium: 'newsletter' },
  'telegram-post': { label: 'Telegram post', limit: 1000, medium: 'newsletter' },
  'instagram-caption': { label: 'Instagram caption', limit: 2200, medium: 'social' },
  'tiktok-caption': { label: 'TikTok caption', limit: 2200, medium: 'video' },
  'threads-post': { label: 'Threads post', limit: 500, medium: 'social' },
  'bluesky-post': { label: 'Bluesky post', limit: 300, countMode: 'graphemes', medium: 'social', clean: true },
  'mastodon-post': { label: 'Mastodon post', limit: 500, countMode: 'x', medium: 'social' },
  'newsletter-blurb': { label: 'Newsletter blurb', limit: 60, countMode: 'words', medium: 'newsletter' },
  'directory-listing': { label: 'Directory listing', limit: 500, medium: 'directory' },
  'email-outreach': { label: 'Email outreach', limit: 90, countMode: 'words', medium: 'email', clean: true },
  'signature': { label: 'Forum signature', limit: 120, medium: 'forum' },
  'bio': { label: 'Profile bios', limit: 150, medium: 'social' },
};
const TEMPLATE_IDS = Object.keys(META);

const KIND_MEDIUM = {
  reddit: 'community', community: 'community', qa: 'community', blog: 'community', forum: 'forum',
  social: 'social', video: 'video', launch: 'launch', directory: 'directory', newsletter: 'newsletter', email: 'email',
};

/* ------------------------------------------------------------- vocabulary */

const SECTION_OBJECT = {
  pdf: 'PDFs', image: 'photos', 'ai-image': 'photos', 'ai-video': 'videos', text: 'text', developer: 'code and data',
  business: 'business figures', india: 'salary and tax figures', finance: 'financial figures', mathematics: 'numbers',
  health: 'health numbers', time: 'dates', qr: 'links', utilities: 'everyday data', education: 'school data',
  engineering: 'measurements', design: 'design files', conversions: 'values', ai: 'documents',
};
const SECTION_ADJ = {
  pdf: 'PDF', image: 'image', 'ai-image': 'photo', 'ai-video': 'video', text: 'text', developer: 'developer-tool', business: 'calculator',
  india: 'tax calculator', finance: 'finance calculator', mathematics: 'maths', health: 'health calculator', time: 'date', qr: 'QR',
  utilities: 'online tool', education: 'school-admin', engineering: 'engineering calculator', design: 'design', conversions: 'converter', ai: 'AI',
};
const SECTION_MANUAL = {
  pdf: 'a desktop PDF editor, if you have one installed', business: 'the official rates tables and a spreadsheet',
  india: 'the official rates tables and a spreadsheet', finance: 'the official rates tables and a spreadsheet',
  developer: 'a one-liner in your shell', image: "your OS's built-in photo viewer or editor",
  'ai-image': 'a desktop photo editor and some patience', 'ai-video': 'typing the captions by hand in your editor',
  text: 'a text editor with regex', mathematics: 'pen, paper and the formula', education: 'a spreadsheet and a free afternoon',
  time: 'a calendar and careful counting', health: 'the formula and a calculator', qr: "your phone's built-in share-as-QR option, where it has one",
  utilities: 'a spreadsheet', engineering: 'the formula and a scientific calculator', design: 'a design app',
  conversions: 'the conversion factor and a calculator', ai: 'doing it by hand, line by line',
};
const MERGE_MANUAL = "print each file to PDF and use your OS's print-to-PDF 'collate' trick, which is fiddly for more than two files";
const SECTION_ENGINE = {
  pdf: 'pdf.js is self-hosted and the PDF work happens inside the page', image: "the image work uses the browser's own canvas",
  'ai-image': 'the model downloads once and then runs in the browser', 'ai-video': 'Whisper runs in the browser on your own machine',
  ai: 'the page sends your text to the model only when you press run, and says so first',
  developer: 'it is plain JavaScript in the page', text: 'it is plain JavaScript in the page', utilities: 'it is plain JavaScript in the page',
};
const SECTION_LIMIT = {
  pdf: 'OCR or editing the text inside a page', image: 'RAW files from every camera', 'ai-image': 'very large images on older phones',
  'ai-video': 'long videos on low-memory machines', ai: 'anything without a sign-in, and you should still check what it returns',
  business: 'tax advice (it does the arithmetic; the judgement is still yours)', india: 'tax advice (it does the arithmetic; the judgement is still yours)',
  finance: 'financial advice (it does the arithmetic; the judgement is still yours)', developer: 'files of hundreds of megabytes', text: 'grammar checking',
  mathematics: 'step-by-step proofs', education: 'syncing with a school MIS', health: 'medical advice',
};
const SECTION_TECH = {
  pdf: 'PDF object handling', image: 'canvas resizing', 'ai-image': 'WebGPU fallback path', 'ai-video': 'audio decoding',
  ai: 'redaction step before the model call', business: 'rounding rules', india: 'slab and rounding rules', finance: 'rounding and compounding',
  developer: 'parsing edge cases', text: 'Unicode handling', mathematics: 'floating-point edge cases',
};
const SECTION_TIP_DO = {
  pdf: 'name files 01-, 02- before you start so the order is right first time', image: 'start from the largest original you have',
  'ai-image': 'start from the sharpest original you have', 'ai-video': 'use a clip with clean audio for the most accurate words',
  business: 'check the tax year shown matches yours', india: 'check the tax year shown matches yours', finance: 'check the rate is the annual one',
  developer: 'paste the raw input, not a pretty-printed copy', text: 'paste plain text rather than rich text',
  ai: 'remove anything you would not email to a stranger before you run it',
};
const SECTION_TIP_WHEN = {
  pdf: 'you name files 01-, 02- so the drop order is already right', image: 'you start from the largest original you have',
  'ai-image': 'the photo is sharp to begin with', 'ai-video': 'the audio is clean', business: 'you check the tax year matches yours',
  india: 'you check the tax year matches yours', finance: 'the rate you type is the annual one', developer: 'you paste the raw input',
  text: 'you paste plain text', ai: 'the input is tidy and has nothing private in it',
};
const SECTION_DEPENDS = {
  business: 'which tax year and region you are in', india: 'which tax year and regime you are in', finance: 'how often the interest compounds',
  pdf: 'whether the files are scans or digital PDFs', image: 'the format you need at the end', ai: 'how clean the input is',
};
const CATEGORIES = {
  pdf: 'PDF, Productivity, Privacy', business: 'Finance, Small Business, Productivity', india: 'Finance, Tax, India',
  developer: 'Developer Tools, Utilities', image: 'Design, Image Editing', 'ai-image': 'Design, Image Editing', ai: 'AI, Productivity',
};
const PH_TOPICS = {
  pdf: ['Productivity', 'Privacy', 'PDF'], business: ['Fintech', 'Productivity', 'Small Business'], india: ['Fintech', 'Productivity'],
  developer: ['Developer Tools', 'Web App'], image: ['Design Tools', 'Photography'], 'ai-image': ['Artificial Intelligence', 'Design Tools'],
  'ai-video': ['Artificial Intelligence', 'Video'], ai: ['Artificial Intelligence', 'Productivity'], text: ['Writing', 'Productivity'],
  education: ['Education', 'Productivity'],
};
const IG_EMOJI = { pdf: '📄', business: '💷', finance: '💷', india: '🇮🇳' };

const AUD = {
  'accountants': ['accountants and bookkeepers', "close a client's month", 'a client export in the wrong shape and a deadline'],
  'small-business': ['small business owners', 'do your own admin', 'three tools, three logins, one afternoon gone'],
  'schools': ['schools and tutors', 'plan a school term', 'a spreadsheet nobody else can follow'],
  'hr-payroll': ['HR and payroll teams', 'run payroll', 'the same salary question every month'],
  'freelancers': ['freelancers and contractors', 'invoice your own clients', 'admin that eats a billable hour'],
  'developers': ['developers', 'debug data by hand', 'pasting company data into a random website'],
  'month-end': ['anyone closing the month', 'close the month', 'reconciliations at 6pm on the last working day'],
  'get-paid': ['anyone chasing invoices', 'chase unpaid invoices', 'the same reminder email, rewritten every week'],
  'going-digital': ['businesses moving to digital records', 'keep digital records', 'a spreadsheet that has to become a submission'],
  'start-of-term': ['school staff at the start of term', 'set up a new school year', 'timetables and lists due before day one'],
  'shopkeepers': ['shopkeepers and traders', 'raise invoices', 'bills to raise between customers'],
  'landlords': ['landlords', 'manage a rental', 'paperwork for every tenancy'],
  'students': ['students', 'study for exams', 'homework at 11pm and an app that wants a login'],
  'marketers': ['marketers and content teams', 'ship content every week', 'one more tool that wants a seat licence'],
  'year-end': ['anyone facing the year end', 'get through the year end', 'a year of paperwork due at once'],
  'going-paperless': ['anyone going paperless', 'get paper off the desk', 'scans, PDFs and attachments everywhere'],
  'creators': ['creators', 'post every day', 'an export that needs one more app'],
  'online-sellers': ['online sellers', 'list products', 'photos and prices for every listing'],
  'job-seekers': ['job seekers', 'apply for jobs', 'a CV, a cover letter and an offer to compare'],
  'teachers': ['teachers and tutors', 'prepare lessons', 'admin on top of marking'],
  'photographers': ['photographers', 'deliver photos to clients', 'resizing and renaming batch after batch'],
  'designers': ['designers', 'hand off assets', 'small fixes that need a big app'],
};

const ACTION = /^(merge|split|compress|convert|remove|resize|crop|rotate|add|extract|make|create|generate|calculate|check|validate|format|clean|count|compare|translate|blur|upscale|cut|sign|protect|unlock|watermark|edit|write|draft|summari[sz]e|categori[sz]e|reconcile|build|plan|track|decode|encode|scan|minify|beautify|find|replace|change|turn|organi[sz]e|sort|join|combine|reorder|delete|redact|flatten|number|stamp|fill|read|transcribe|caption)\b/i;
const VERB_WORD = { Calculate: 'work out', Convert: 'convert', Check: 'check', Make: 'make', 'Clean up': 'clean up' };

/* ---------------------------------------------------------------- helpers */

function cp(s) { return [...String(s || '')]; }
function trunc(s, n) {
  s = String(s || '');
  if (n <= 0) return '';
  if (cp(s).length <= n) return s;
  const cut = cp(s).slice(0, Math.max(1, n - 1)).join('');
  const sp = cut.lastIndexOf(' ');
  const base = (sp > n * 0.4 ? cut.slice(0, sp) : cut).replace(/[\s,;:—–-]+$/, '');
  return base + '…';
}
function cap(s) { s = String(s || ''); return s ? s[0].toUpperCase() + s.slice(1) : s; }
/** Lowercase the first letter unless the first word is an acronym (PDF, GST, UK). */
function lc1(s) { s = String(s || ''); return /^([A-Z]{2}|I\b|I')/.test(s) ? s : (s ? s[0].toLowerCase() + s.slice(1) : s); }
const ACRO = /\b(pdfs?|gst|gstin|uk|csv|json|qr|vat|hra|epf|ctc|png|jpe?g|webp|svg|html|css|url|ocr|ai|ni|paye|itr|tds|hsn|upi|sql|xml|mtd|bmi|emi|sip|ppf|cgpa|gpa|cv|rgb|hex|utc|id|uuid|sha|md5|tally|excel|whatsapp|india|indian|england|hmrc)\b/gi;
const ACRO_FIX = { pdfs: 'PDFs', tally: 'Tally', excel: 'Excel', whatsapp: 'WhatsApp', india: 'India', indian: 'Indian', england: 'England', jpeg: 'JPEG', jpg: 'JPG' };
function acro(s) { return String(s || '').replace(ACRO, (m) => ACRO_FIX[m.toLowerCase()] || m.toUpperCase()); }
/** Title in running text: lowercase initial capitals, keep acronyms. */
function lcTitle(s) { return String(s || '').replace(/\b([A-Z])([a-z])/g, (m, a, b) => a.toLowerCase() + b); }
/** Sentence: '' stays '', otherwise ends with terminal punctuation. */
function sent(s) { s = String(s || '').trim(); if (!s) return ''; return /[.!?…:)]$/.test(s) ? s : s + '.'; }
function words(s) { return String(s || '').split(/\s+/).filter(Boolean); }
function truncWords(s, n) { const w = words(s); return w.length <= n ? s : w.slice(0, Math.max(0, n)).join(' ').replace(/[,;:—–-]+$/, '') + '…'; }
/** Remove the debris an empty slot leaves behind. */
function tidy(s) {
  return String(s)
    .split('\n').map((line) => line
      .replace(/\(\s*\)/g, '')
      .replace(/\s+([.,;:!?…])/g, '$1')
      .replace(/([.;,:])(?:\s*[.;,])+/g, '$1')
      .replace(/—\s*([.;,])/g, '$1')
      .replace(/\s*—\s*$/g, '')
      .replace(/…\./g, '…')
      .replace(/ {2,}/g, ' ')
      .trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function S() { return tidy([].slice.call(arguments).filter((x) => x != null && String(x).trim() !== '').join(' ')); }

function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* -------------------------------------------------------------- context */

let sectionCounts = null;
function sectionCount(section) {
  if (!sectionCounts) {
    sectionCounts = {};
    for (const r of T.listAll()) { const s = T.sectionSlugOf(r.path); sectionCounts[s] = (sectionCounts[s] || 0) + 1; }
  }
  return sectionCounts[section] || 0;
}
let finderList = null;
function relatedTool(rec) {
  if (!finderList) finderList = T.listTools();
  const same = finderList.filter((r) => r.section === rec.section);
  if (same.length < 2) return null;
  const i = same.findIndex((r) => r.path === rec.path);
  return same[(i + 1) % same.length];
}

function taskPhrase(rec) {
  let kw = String(rec.keywords[0] || rec.title).toLowerCase().trim();
  if (ACTION.test(kw)) return acro(kw);
  kw = kw.replace(/\b(calculator|generator|converter|maker|tool|checker|online|free|app|software|planner|finder|validator)\b/g, '').replace(/\s+/g, ' ').trim();
  if (!kw) kw = lcTitle(rec.title);
  return acro((VERB_WORD[rec.verb] || 'work out') + ' ' + kw);
}

function audienceOf(rec) {
  const slug = rec.audiences.find((a) => AUD[a]);
  if (slug) return { slug, name: AUD[slug][0], task: AUD[slug][1], pain: AUD[slug][2] };
  return {
    slug: '', name: 'anyone who needs to ' + taskPhrase(rec), task: taskPhrase(rec),
    pain: rec.pricing === 'freemium' ? 'a subscription for a job you do twice a month' : 'a site that wants an upload and a login',
  };
}

function questionOf(q) {
  if (!q) return null;
  if (typeof q === 'string') return { title: q.trim(), url: '', body: '' };
  if (!q.title) return null;
  return { title: String(q.title).trim(), url: q.url || '', body: q.body || '' };
}

function makeCtx(id, rec, opts, flags) {
  const meta = META[id];
  const v = Math.abs(parseInt(opts.variant, 10) || 0);
  const venue = opts.venue || null;
  const venueId = (venue && venue.id) || opts.venueId || 'promo';
  const medium = opts.medium || (venue && KIND_MEDIUM[venue.kind]) || meta.medium;
  const params = opts.result && opts.result.params ? opts.result.params : null;
  const utm = T.utmUrl(rec.path, venueId, medium, params);
  let clean = rec.cleanUrl;
  if (params) {
    const q = Object.entries(params).filter(([, x]) => x != null && x !== '').map(([k, x]) => encodeURIComponent(k) + '=' + encodeURIComponent(x));
    if (q.length) clean += '?' + q.join('&');
  }
  const useClean = venue && typeof venue.utm === 'boolean' ? !venue.utm : !!meta.clean;
  const free = rec.pricing === 'free';
  const media = rec.media;
  const aud = audienceOf(rec);
  const rel = relatedTool(rec);
  const C = {
    id, meta, rec, opts, v, venue, venueId, medium, utm, clean, URL: useClean ? clean : utm, flags,
    free, media, aud, rel,
    q: questionOf(opts.question),
    result: opts.result || null,
    count: T.toolCountText(),
    countRounded: (Math.floor(T.toolCount() / 100) * 100).toLocaleString('en-US') + '+',
    task: taskPhrase(rec),
    object: SECTION_OBJECT[rec.section] || 'files',
    manual: (rec.section === 'pdf' && /merge|combine|join/i.test(rec.title)) ? MERGE_MANUAL : (SECTION_MANUAL[rec.section] || 'a spreadsheet'),
    engine: SECTION_ENGINE[rec.section] || 'the maths is plain JavaScript in the page',
    limitation: SECTION_LIMIT[rec.section] || 'accounts, sync or history across devices',
    tech: SECTION_TECH[rec.section] || 'input validation',
    tipDo: SECTION_TIP_DO[rec.section] || 'keep the page open in a pinned tab for next time',
    tipWhen: SECTION_TIP_WHEN[rec.section] || 'you keep the page in a pinned tab',
    depends: SECTION_DEPENDS[rec.section] || 'what you want to do with the result',
    secLc: lcTitle(rec.sectionName),
    titleLc: lcTitle(rec.title),
    kw: (i) => acro(rec.keywords[i] || rec.keywords[0] || lcTitle(rec.title)),
    adj: SECTION_ADJ[rec.section] || 'online tool',
    oneLineFull: sent((rec.description.match(/^[^.!?]+[.!?]/) || [rec.description])[0]),
  };
  C.pick = (slot, arr) => arr[(v + slot) % arr.length];
  Object.defineProperty(C, 'oneLine', { get: () => trunc(C.oneLineFull, flags.descMax == null ? 220 : Math.max(flags.descMax, 20)) });
  C.D = () => {
    const d = rec.description;
    if (flags.descMax == null) return d;
    return trunc(d, flags.descMax);
  };
  C.PRIV = (slot) => {
    if (flags.noPriv) return free ? '' : 'cloud AI, 10 free runs a month';
    if (free) {
      const what = media ? 'nothing you drop in is uploaded' : 'nothing you type is uploaded';
      return C.pick(slot, [
        'runs in your browser — ' + what,
        'everything happens on your device; ' + what,
        'works in the browser and keeps working offline once the page has loaded',
      ]);
    }
    return C.pick(slot, [
      'cloud AI, 10 runs a month free with an account; it sends your text to a server and says so before you start',
      'the AI part runs on a server (the page is upfront about that); 10 a month are free',
      'needs a free account; 10 runs a month included; your text goes to the model provider',
    ]);
  };
  C.PRIVSHORT = (slot) => (free ? C.pick(slot, ['Nothing uploaded.', 'Runs in your browser.', 'Works offline once loaded.']) : 'Cloud AI, 10 free a month.');
  C.PRIVWHAT = () => (free ? (flags.noPriv ? '' : (media ? 'nothing you drop in is uploaded' : 'nothing you type is uploaded')) : C.PRIV(0));
  C.FREE = () => (free ? (media ? 'free, no account, no watermark' : 'free, no account') : 'free for 10 runs a month');
  C.OFFLINE = (near) => (free && !flags.noOffline && !/offline/i.test(near || '') ? 'works offline once opened' : '');
  C.HOOK = (angle, slot) => {
    const a = angle || (venue && venue.angle) || opts.angle || 'privacy';
    if (flags.shortHook) return H.shortestHook(rec, { video: opts.video }).text;
    return H.hook(rec, a, v + (slot || 0), { result: opts.result, video: opts.video }).text;
  };
  C.tags = (o) => (flags.noTags ? [] : TAGS.tagsFor(rec, o));
  C.sub = () => {
    const m = venue && String(venue.url || venue.id || '').match(/\/r\/([A-Za-z0-9_]+)/);
    return m ? m[1] : 'SideProject';
  };
  C.linkMode = () => {
    const lp = venue && venue.linkPolicy;
    if (lp === 'profile-only' || lp === 'none') return 'none';
    if (lp === 'comment-only') return 'comment';
    return 'inline';
  };
  return C;
}

/* --------------------------------------------------------- shared pieces */

function whyLine(C, slot) {
  if (C.free) {
    return C.pick(slot, [
      `I kept needing to ${C.task} and didn't want to upload ${C.object} to a server.`,
      `Most ${C.adj} sites upload what you give them and keep it 'for 24 hours'. Mine doesn't have a server to upload to.`,
      `Built for ${C.aud.slug ? C.aud.name : 'people who need it'}, and for my own admin; sharing in case it saves you a minute.`,
    ]);
  }
  return C.pick(slot, [
    `I kept needing to ${C.task} and didn't want another monthly subscription for it.`,
    'The AI step runs on a server and the page says so before you start; 10 runs a month are free.',
    `Built for ${C.aud.slug ? C.aud.name : 'people who need it'}, and for my own admin; sharing in case it saves you a minute.`,
  ]);
}
function howLine(C, slot) {
  if (C.free) {
    return C.pick(slot, [
      S(`It's static HTML + JS; ${C.engine}`, C.OFFLINE(C.engine) ? '; ' + C.OFFLINE(C.engine) : '') + '.',
      sent(S('No framework, no build at runtime', C.PRIV(slot) ? ', ' + C.PRIV(slot) : '')),
      'Everything is open in the page source if you want to check what it does.',
    ]);
  }
  return C.pick(slot, [
    sent(`The page is static HTML + JS; ${C.engine}`),
    sent(S('No framework, no build at runtime', C.PRIV(slot) ? '; ' + C.PRIV(slot) : '')),
    'The page source shows exactly what is sent to the model.',
  ]);
}
function notLine(C, slot) {
  return C.pick(slot, [`It doesn't do ${C.limitation}.`, `Known gaps: ${C.limitation}.`, `Not for ${C.limitation} yet.`]);
}
function askLine(C, slot) { return C.pick(slot, ["What's missing?", 'Happy to take requests.', 'Tell me what broke.']); }
function whatLine(C, slot) {
  const noLogin = C.free ? (C.media ? 'No login, no upload, no watermark.' : 'No login, no upload.') : '10 free runs a month with a free account.';
  return C.pick(slot, [
    S(C.D(), sent(cap(C.PRIV(slot))), sent(cap(C.FREE()))),
    S(`${C.rec.title}: ${C.rec.io}.`, sent(cap(C.PRIV(slot)))),
    S(C.D(), noLogin),
  ]);
}
function placeholderAnswer(C, kind) {
  return C.q ? `[Your ${kind} to "${trunc(C.q.title, 140)}"]` : '';
}

/* -------------------------------------------------------------- builders */
/* Each returns { main, title?, parts: [{key, label, text, limit?, countMode?}] }.
   main is the key of the part that is "the text". */

const B = {};

B['reddit-comment'] = (C) => {
  const r = C.rec;
  const opener = C.pick(0, [`Short version: ${lc1(C.D())}`, 'You can do this without installing anything.', 'Two ways, depending on how often you need it.']);
  const answer = C.q ? placeholderAnswer(C, '2–6 sentence answer') : (C.v % 3 === 0 ? '' : C.D());
  const method = C.pick(1, [`Manually: ${C.manual}.`, `If it's a one-off: ${C.manual}.`, `The long way is ${C.manual}.`]);
  const p = C.PRIV(2);
  const tool = C.pick(2, [
    p ? `If you'd rather not, I made ${r.title} — ${p}.` : `If you'd rather not, I made ${r.title}.`,
    S(`I built a small page for exactly this: ${r.title}.`, sent(cap(p))),
    C.free ? (C.PRIVWHAT() ? `Otherwise ${r.title} does it in the browser, and ${C.PRIVWHAT()}.` : `Otherwise ${r.title} does it in the browser.`) : (p ? `Otherwise ${r.title} does it for you; ${p}.` : `Otherwise ${r.title} does it for you.`),
  ]);
  const text = tidy(S(opener, answer, method) + '\n\n' + S(tool, 'Disclosure: I built this.') + '\n' + C.URL);
  return { main: 'text', parts: [{ key: 'text', label: 'Comment', text }] };
};

B['reddit-post'] = (C) => {
  const r = C.rec;
  const f = C.v % 5;
  const toolWord = /(tool|calculator|converter|generator|maker|checker|editor|planner|extractor|writer|cleaner|finder|validator|reader|remover|builder)\b/i.test(r.title) ? '' : ' tool';
  let title;
  if (C.free) {
    title = [
      `I made a free ${C.titleLc}${toolWord} that runs entirely in the browser — nothing is uploaded`,
      `${r.title}: ${r.io}, no upload, no account`,
      `Tired of uploading ${C.object} to random sites to ${C.task}, so I built one that doesn't`,
      `[Free tool] ${r.title} — ${trunc(r.description, 80)}`,
      `Show r/${C.sub()}: ${r.title}, an offline-capable ${C.secLc} page`,
    ][f];
  } else {
    title = [
      `I made ${C.titleLc}${toolWord}: AI that ${lc1(trunc(r.io, 60))}, 10 free runs a month`,
      `${r.title}: ${r.io}, 10 free runs a month`,
      `Tired of paying monthly to ${C.task}, so I built ${r.title} (10 free runs a month)`,
      `[AI tool, 10 free runs a month] ${r.title} — ${trunc(r.description, 60)}`,
      `Show r/${C.sub()}: ${r.title}, an AI helper with 10 free runs a month`,
    ][f];
  }
  const body = tidy([C.D(), S(whyLine(C, 0), howLine(C, 1)), notLine(C, 2), S(askLine(C, 3), 'Disclosure: I built this.') + '\n' + C.URL].filter(Boolean).join('\n\n'));
  return { main: 'body', parts: [{ key: 'title', label: 'Title', text: tidy(title), limit: 300 }, { key: 'body', label: 'Body', text: body }] };
};

B['hn-show'] = (C) => {
  const r = C.rec;
  const clause = C.free
    ? C.pick(0, [`${r.io}, entirely client-side`, trunc(r.description.replace(/[.]$/, ''), 45), `a no-upload ${C.secLc} page`])
    : C.pick(0, [`${r.io} with an AI model`, trunc(r.description.replace(/[.]$/, ''), 45), `an AI ${C.secLc} helper`]);
  const head = `Show HN: ${r.title} – `;
  const room = 80 - cp(head).length;
  const title = room > 8 ? head + trunc(clause, room) : trunc(`Show HN: ${r.title}`, 80);
  const what = C.pick(0, [C.D(), `${r.title}: ${r.io}.`, C.free ? `Static page: ${lc1(C.D())}` : C.D()]);
  const p = C.PRIV(2);
  const how = C.pick(2, [
    S('Plain HTML/JS, no framework, no build step at runtime.', sent(cap(C.engine)), sent(cap(p))),
    S(sent(cap(p)), (r.section === 'pdf' ? 'Fonts and pdf.js are self-hosted' : 'Fonts are self-hosted') + '; analytics only load if you accept the consent bar.'),
    'Everything is in the page source.',
  ]);
  const ask = C.pick(4, ['Curious what edge cases break it.', `Would value a look at the ${C.tech}.`, 'Open to requests for the next tool.']);
  const comment = tidy([what, S(whyLine(C, 1), how), S(notLine(C, 3), ask)].join('\n\n'));
  return {
    main: 'comment',
    parts: [
      { key: 'title', label: 'Title', text: title, limit: 80 },
      { key: 'url', label: 'URL field', text: C.clean, limit: 2000 },
      { key: 'comment', label: 'First comment', text: comment },
    ],
  };
};

B['hn-comment'] = (C) => {
  const r = C.rec;
  const answer = C.q ? placeholderAnswer(C, 'technical answer (2–5 sentences)') : S(C.oneLine, `Without a tool: ${C.manual}.`);
  const p = C.PRIV(0);
  const tool = C.free
    ? C.pick(0, [p ? `I ended up building a client-side page for this (${r.title}); ${p}.` : `I ended up building a client-side page for this (${r.title}).`, `Shameless but relevant: ${r.title} does this in the browser.`, `I maintain ${r.title}, which is the same idea without the server.`])
    : C.pick(0, [p ? `I built ${r.title} for this; ${p}.` : `I built ${r.title} for this.`, `Shameless but relevant: ${r.title} does this with an AI model (10 free runs a month).`, `I maintain ${r.title}; ${p || 'cloud AI, 10 free runs a month'}.`]);
  const text = tidy(S(answer, tool, 'Disclosure: I built this.', C.URL));
  return { main: 'text', parts: [{ key: 'text', label: 'Comment', text }] };
};

B['ph-launch'] = (C) => {
  const r = C.rec;
  const tagline = C.free
    ? C.pick(0, [`${r.io} — in your browser, nothing uploaded`, `${cap(C.task)} without an account or an upload`, `Free ${C.secLc}: ${trunc(r.description, 40)}`])
    : C.pick(0, [`${r.io} — 10 free AI runs a month`, `${cap(C.task)} with AI, 10 free runs a month`, `AI ${C.secLc}: ${trunc(r.description, 30)}`]);
  const description = C.pick(1, [
    S(C.D(), sent(cap(C.FREE()) + (C.PRIV(1) ? '; ' + C.PRIV(1) : '')), sent(cap(C.OFFLINE(C.PRIV(1))))),
    S(`${r.title} does one job: ${r.io}.`, sent(cap(C.PRIV(1))), sent(cap(C.FREE()))),
    S(C.D(), `Part of 1234Tools, ${C.count} tools from a one-person shop in Reading, UK.`, C.free ? '' : sent(cap(C.FREE()))),
  ]);
  const next = C.rel ? `${C.rel.title} is in the same section if you need the next step.` : '';
  const ask = C.pick(3, ['What would make you use it twice?', C.media ? 'Tell me the file that breaks it.' : 'Tell me the input that breaks it.', 'Requests welcome — I ship weekly.']);
  const comment = tidy(['Hi PH — I built this — ' + lc1(whyLine(C, 0)), howLine(C, 1), S(notLine(C, 2), next), ask].join('\n\n'));
  const c1Verb = {
    Calculate: 'Type a number, read the breakdown', Check: 'Paste it in, read the verdict', 'Clean up': 'Paste the mess, copy it clean',
    Make: C.media ? 'Drop, arrange, download' : 'Fill it in, download the result', Convert: C.media ? 'Drop, convert, download' : 'Paste in, copy out',
  }[r.verb] || 'Step 1 to result in one screen';
  const c1 = C.pick(4, [`${r.io}: the whole flow`, c1Verb, 'Step 1 to result in one screen']);
  const c2 = C.free
    ? C.pick(5, [C.media ? 'No upload: your files stay on your machine' : 'No upload: the inputs stay on your screen', 'Works offline once opened', 'Dark-first, phone-first'])
    : C.pick(5, ['Says what it sends before it runs', '10 free runs a month', 'Dark-first, phone-first']);
  const sharable = r.prefill.length || ['conversions', 'text'].includes(r.section);
  const c3 = C.pick(6, [sharable ? 'Share a link that carries your inputs' : `Part of ${sectionCount(r.section)} tools in ${r.sectionName}`, `Part of ${sectionCount(r.section)} tools in ${r.sectionName}`, 'Set currency and date format once in Preferences']);
  return {
    main: 'comment',
    parts: [
      { key: 'name', label: 'Name', text: trunc(`${r.title} by 1234Tools`, 60), limit: 60 },
      { key: 'tagline', label: 'Tagline', text: trunc(tagline, 60), limit: 60 },
      { key: 'description', label: 'Description', text: description, limit: 260 },
      { key: 'comment', label: 'Maker comment', text: comment },
      { key: 'caption1', label: 'Gallery caption 1', text: trunc(c1, 80), limit: 80 },
      { key: 'caption2', label: 'Gallery caption 2', text: trunc(c2, 80), limit: 80 },
      { key: 'caption3', label: 'Gallery caption 3', text: trunc(c3, 80), limit: 80 },
      { key: 'topics', label: 'Topics', text: (PH_TOPICS[r.section] || ['Productivity', 'Web App']).join(', '), limit: 200 },
      { key: 'url', label: 'Website URL', text: C.utm, limit: 2000 },
    ],
  };
};

B['x-post'] = (C) => {
  const r = C.rec;
  const angle = (C.venue && C.venue.angle) || C.opts.angle || 'privacy';
  const hook = C.HOOK(angle, 0);
  const value = C.pick(1, [`${r.io}.`, trunc(C.D(), 90), `${r.title}, ${C.FREE()}.`]);
  const priv = C.flags.noPriv && C.free ? '' : (!C.free && /\b10\b|\bten\b/i.test(hook + value) ? 'Cloud AI.' : C.PRIVSHORT(2));
  const mine = angle === 'result-first' ? ' (mine)' : '';
  const tag = !C.flags.noTags && C.opts.hashtag ? ' ' + C.opts.hashtag : '';
  if (C.linkMode() === 'comment') {
    // the venue says links cost reach in the post: the link goes in the first reply
    const text = tidy(S(hook, value, priv) + tag);
    return { main: 'text', linkInReply: true, parts: [{ key: 'text', label: 'Post (no link)', text }, { key: 'reply', label: 'First reply', text: tidy(C.URL + ' (mine)'), limit: 280, countMode: 'x' }] };
  }
  const text = tidy(S(hook, value, priv, C.URL) + mine + tag);
  return { main: 'text', parts: [{ key: 'text', label: 'Post', text }] };
};

B['x-thread'] = (C) => {
  const r = C.rec;
  const hook = C.HOOK((C.venue && C.venue.angle) || C.opts.angle || 'privacy', 0);
  const p1 = C.free
    ? C.pick(0, [`${hook} A short thread.`, `${hook} 1/5`, `Thread: ${r.title}, and why it has no server.`])
    : C.pick(0, [`${hook} A short thread.`, `${hook} 1/5`, `Thread: ${r.title}, and what it sends where.`]);
  const p2 = C.free
    ? C.pick(1, [`Most ${C.object} sites work by uploading your file and promising to delete it.`, `The usual way to ${C.task} is a site that stores your data 'briefly'.`, "Every upload is a copy you don't control."])
    : C.pick(1, [`The usual way to ${C.task} is a subscription you use twice a month.`, "Most AI helpers don't say what they send. This one does, before it runs.", 'Paying monthly for a job you do twice a month adds up.']);
  const p3 = C.free
    ? C.pick(2, [S(`${r.title} is a static page.`, sent(cap(C.PRIV(2) || 'it runs in your browser')), sent(cap(C.OFFLINE(C.PRIV(2))))), S(sent(cap(C.PRIV(2) || 'it runs in your browser')), 'No account. The source is right there in the page.'), 'Open it once, and it keeps working on a train with no signal.'])
    : C.pick(2, [S(`${r.title}:`, sent(C.PRIV(2))), S(sent(cap(C.PRIV(2))), 'No card needed.'), 'Sign in once and run it 10 times a month for free.']);
  const p4 = C.pick(3, [
    `Tip: ${C.kw(1)} works best when ${C.tipWhen}.`,
    `Example: ${sent((C.result && C.result.summary) || r.io)}`,
    `It also handles ${C.kw(2)}.`,
  ]);
  const p5 = C.pick(4, [`Try it: ${C.URL} (mine)`, `Here: ${C.URL} — tell me what breaks (mine)`, `Link, ${C.FREE()}: ${C.URL} (mine)`]);
  const posts = [p1, p2, p3, p4, p5].map(tidy);
  return {
    main: 'p1',
    parts: posts.map((t, i) => ({ key: 'p' + (i + 1), label: 'Post ' + (i + 1) + '/5', text: t, limit: 280, countMode: 'x' })),
    joined: posts.map((t, i) => (i + 1) + '/ ' + t).join('\n\n'),
  };
};

B['linkedin-post'] = (C) => {
  const r = C.rec;
  const a = C.aud;
  const hook = C.pick(0, [C.HOOK('cost', 0), C.free ? `I built a free tool for ${a.name}.` : `I built an AI helper for ${a.name}.`, `Small tool, big time saver for ${a.name}: ${r.title}.`]);
  const story = C.pick(1, [`If you ${a.task}, you know the drill: ${a.pain}.`, `Built with ${a.name} in mind.`, 'Built it for my own admin; sharing it.']);
  const what = whatLine(C, 2);
  const ask = C.pick(3, ['What would you want next to it?', `Which tool should I build for ${a.name} next?`, 'Forward it to the person who does this every month.']);
  const tags = C.tags({ n: 3, tier: 'broad' }).join(' ');
  const body = tidy([hook, story, what, ask + ' Link in the first comment.', tags].filter(Boolean).join('\n\n'));
  return {
    main: 'body',
    parts: [{ key: 'body', label: 'Post (no link in the body)', text: body }, { key: 'comment', label: 'First comment', text: `${r.title}: ${C.URL}`, limit: 1250 }],
  };
};

B['facebook-group'] = (C) => {
  const r = C.rec;
  const greet = C.pick(0, ['Hi all,', 'Morning everyone —', 'Quick one for the group:']);
  const ctx = C.pick(1, [`in case ${C.kw(0)} comes up for anyone here.`, `for anyone who needs to ${C.task}.`, `for anyone who has to ${C.aud.task} this week.`]);
  const what = whatLine(C, 2);
  const mode = C.linkMode();
  const disc = 'I run the site, so take that as read.';
  const link = mode === 'inline' ? C.URL : mode === 'comment' ? 'Link in the comments.' : `Search "1234tools ${r.title}".`;
  const text = tidy(S(greet, ctx, what, disc, link));
  const parts = [{ key: 'text', label: 'Post', text }];
  if (mode === 'comment') parts.push({ key: 'comment', label: 'First comment', text: `${r.title}: ${C.URL}`, limit: 800 });
  return { main: 'text', parts };
};

B['pinterest-pin'] = (C) => {
  const r = C.rec;
  const title = C.free
    ? C.pick(0, [`How to ${C.task} without uploading (free)`, `${r.title} — free, no account`, `${r.io}: the private way`])
    : C.pick(0, [`How to ${C.task} with AI (10 free a month)`, `${r.title} — 10 free runs a month`, `${r.io} with AI`]);
  const desc = C.free
    ? C.pick(1, [
      S(C.D(), sent(cap(C.PRIV(1))), sent(cap(C.FREE())), `Save this for the next time you need to ${C.task}.`),
      S(`${r.title}: ${C.kw(0)}, ${C.kw(1)}, ${C.kw(2)} — all in your browser.`, sent(cap(C.PRIV(1)))),
      S(`A free ${C.secLc} page: ${lc1(C.D())}`, sent(cap(C.OFFLINE(C.D())))),
    ])
    : C.pick(1, [
      S(C.D(), sent(cap(C.PRIV(1))), sent(cap(C.FREE())), `Save this for the next time you need to ${C.task}.`),
      S(`${r.title}: ${C.kw(0)}, ${C.kw(1)}, ${C.kw(2)}.`, sent(cap(C.PRIV(1)))),
      S(`An AI ${C.secLc} page: ${lc1(C.D())}`, sent(cap(C.FREE()))),
    ]);
  const tags = C.tags({ n: 4, tier: 'niche', brand: 1 }).join(' ');
  const alt = C.pick(2, [
    `Dark 1234Tools card: "${r.title}", ${r.io}, with three badges and the web address`,
    `Dark card titled "${r.title}" with the line "${r.io}" and the 1234Tools logo`,
    `Pin for ${r.title} on 1234Tools: ${r.io}, in gold lettering on a dark card`,
  ]);
  return {
    main: 'description',
    parts: [
      { key: 'title', label: 'Pin title', text: trunc(tidy(title), 100), limit: 100 },
      { key: 'description', label: 'Description', text: tidy(S(desc, tags)) },
      { key: 'alt', label: 'Alt text', text: trunc(alt, 500), limit: 500 },
      { key: 'url', label: 'Destination link', text: C.utm, limit: 2000 },
    ],
  };
};

B['youtube-comment'] = (C) => {
  const r = C.rec;
  const value = C.q ? placeholderAnswer(C, '1–3 sentence addition to the video') : C.pick(0, [`Good walkthrough. One thing worth adding: ${C.tipDo}.`, `For anyone who got here searching ${C.kw(0)}: ${C.oneLine}`, `Useful for anyone comparing ways to ${C.task}.`]);
  const tool = C.free
    ? C.pick(1, [`If you don't want to upload, search "1234tools ${r.title}" — it runs in the browser.`, `I keep a free browser version at 1234tools dot com (${r.title}).`, `There's a no-upload version on 1234tools dot com under ${r.sectionName}.`])
    : C.pick(1, [`Search "1234tools ${r.title}" if you want an AI version with 10 free runs a month.`, `I keep an AI version at 1234tools dot com (${r.title}), 10 free runs a month.`, `There's an AI version on 1234tools dot com under ${r.sectionName}.`]);
  const text = tidy(S(value, tool, 'I run that site, so biased.'));
  return { main: 'text', parts: [{ key: 'text', label: 'Comment (no URL)', text }] };
};

B['youtube-description'] = (C) => {
  const r = C.rec;
  const line1 = trunc(C.free
    ? C.pick(0, [`${r.title} in 30 seconds: ${r.io}.`, `How to ${C.task} without uploading — ${r.title}.`, C.D()])
    : C.pick(0, [`${r.title} in 30 seconds: ${r.io}.`, `How to ${C.task} with AI — ${r.title}.`, C.D()]), 100);
  const bullets = [
    '• ' + cap(C.FREE()),
    C.PRIV(1) ? '• ' + cap(C.PRIV(1)) : '',
    C.free ? (C.OFFLINE(C.PRIV(1)) ? '• ' + cap(C.OFFLINE(C.PRIV(1))) : '') : '• The page says what it sends before it runs',
  ].filter(Boolean).join('\n');
  const more = `More tools: https://www.1234tools.com/?utm_source=${encodeURIComponent(C.venueId)}&utm_medium=video`;
  const tags = C.tags({ n: 3, tier: 'niche' }).join(' ');
  const text = tidy([line1, C.utm, bullets, more, tags].filter(Boolean).join('\n\n'));
  return { main: 'text', parts: [{ key: 'text', label: 'Description', text }] };
};

B['quora-answer'] = (C) => {
  const r = C.rec;
  const open = C.free
    ? C.pick(0, ["Yes — and you don't need to upload anything to do it.", C.oneLine, `It depends on one thing: ${C.depends}.`])
    : C.pick(0, ['Yes — and you can do it without a subscription.', C.oneLine, `It depends on one thing: ${C.depends}.`]);
  const expl = C.q ? `[Your explanation for "${trunc(C.q.title, 140)}": 2–4 short paragraphs, worked numbers where relevant]` : C.D();
  const p = C.PRIV(1);
  const tool = C.free
    ? C.pick(1, [C.PRIVWHAT() ? `If you'd rather not do it by hand, ${r.title} does exactly this in the browser; ${C.PRIVWHAT()}.` : `If you'd rather not do it by hand, ${r.title} does exactly this in the browser.`, `The browser-only option is ${r.title} (${C.FREE()}).`, `I made ${r.title} for this: ${r.io}.`])
    : C.pick(1, [`If you'd rather not do it by hand, ${r.title} does exactly this; ${p || 'cloud AI, 10 free runs a month'}.`, `The AI option is ${r.title} (${C.FREE()}).`, S(`I made ${r.title} for this: ${r.io}.`, sent(cap(C.FREE())))]);
  const text = tidy([open, expl, `By hand: ${C.manual}.`, S(tool, '(I built this site, so take that into account.)') + '\n' + C.URL].filter(Boolean).join('\n\n'));
  return { main: 'text', parts: [{ key: 'text', label: 'Answer', text }] };
};

B['stackexchange-answer'] = (C) => {
  const r = C.rec;
  const answer = C.q
    ? `[Write the complete method for "${trunc(C.q.title, 140)}" here: steps or code that work without the link]`
    : '[Write the complete method here: the answer must stand on its own without the link]';
  const method = `Without any tool: ${C.manual}.`;
  const tool = C.free
    ? C.pick(0, [`If you want a GUI for the same thing, ${r.title} does it client-side.`, `For a no-install route, ${r.title} runs the same logic in the browser.`, `A browser version: ${r.title} (${r.io}).`])
    : C.pick(0, [`If you want an AI-assisted version, ${r.title} does it (${C.FREE()}).`, `For a no-install route, ${r.title} does it with an AI model (${C.FREE()}).`, `An AI version: ${r.title} (${r.io}; ${C.FREE()}).`]);
  const text = tidy([answer, method, S(tool, "Disclosure: I'm the author of this tool.") + '\n' + C.URL].join('\n\n'));
  return { main: 'text', parts: [{ key: 'text', label: 'Answer', text }] };
};

B['forum-reply'] = (C) => {
  const r = C.rec;
  const quote = C.q ? '> ' + trunc(C.q.title, 160) : '';
  const answer = C.q ? '[Your answer in 2–4 sentences]' : S(C.oneLine, `If it's a one-off: ${C.manual}.`);
  const p = C.PRIV(0);
  const tool = C.free
    ? C.pick(0, [C.PRIVWHAT() ? `There's also ${r.title}, which does this in the browser (${C.PRIVWHAT()}).` : `There's also ${r.title}, which does this in the browser.`, `I built ${r.title} for this — ${r.io}.`, `Quickest no-install option I know is ${r.title}.`])
    : C.pick(0, [`There's also ${r.title} (${p || 'cloud AI, 10 free runs a month'}).`, S(`I built ${r.title} for this — ${r.io}.`, sent(cap(C.FREE()))), `An AI option is ${r.title} (${C.FREE()}).`]);
  const link = C.linkMode() === 'none' ? 'Link in my signature.' : C.URL;
  const text = tidy([quote, S(answer, tool, 'Disclosure: I built this.', link)].filter(Boolean).join('\n\n'));
  return { main: 'text', parts: [{ key: 'text', label: 'Reply', text }] };
};

B['forum-post'] = (C) => {
  const r = C.rec;
  const title = C.free
    ? C.pick(0, [`Free browser tool: ${r.title} (${r.io})`, `Built a no-upload ${C.secLc} page — feedback wanted`, `${r.title}: ${trunc(r.description, 50)}`])
    : C.pick(0, [`AI helper: ${r.title} (${r.io})`, `Built an AI ${C.secLc} helper — feedback wanted`, `${r.title}: ${trunc(r.description, 50)}`]);
  const intro = C.pick(1, ['I run a small static tools site and wanted to share one page.', 'Solo developer in Reading; I build small browser tools.', 'Hello — sharing something I made for my own work.']);
  const link = C.linkMode() === 'none' ? 'Link in my signature.' : C.URL;
  const body = tidy([intro, C.D(), S(whyLine(C, 2), howLine(C, 3)), notLine(C, 4), S(askLine(C, 5), 'Disclosure: I built this.') + '\n' + link].filter(Boolean).join('\n\n'));
  return { main: 'body', parts: [{ key: 'title', label: 'Thread title', text: trunc(tidy(title), 80), limit: 80 }, { key: 'body', label: 'Post', text: body }] };
};

B['devto-article'] = (C) => {
  const r = C.rec;
  const title = C.free
    ? C.pick(0, [`How ${r.title} works without a server`, `${r.io} in the browser: what it takes`, `Why I stopped uploading ${C.object} and wrote a static page instead`])
    : C.pick(0, [`How ${r.title} calls an AI model, and what it sends`, `${r.io} with an AI model: what it takes`, `Building ${r.title}: a static page in front of an AI model`]);
  const intro = C.free
    ? C.pick(1, [S(C.D(), "Most sites that do this ask for an upload. Here's how a static page does it instead."), `I needed to ${C.task} and didn't trust the upload-and-delete promise. This is the write-up.`, `${r.title} is one of ${C.count} tools on a static site. This post is the engineering behind one page.`])
    : C.pick(1, [S(C.D(), 'This is how the page talks to the model, and what it tells you first.'), `I needed to ${C.task} without a monthly subscription. This is the write-up.`, `${r.title} is one of ${C.count} tools on a static site. This post is the engineering behind one page.`]);
  const pools = C.free
    ? [['The format problem', 'The client-side approach', "What it doesn't do (yet)"], ['Why upload sites exist', 'The page that replaces them', 'Offline, caching and the service worker'], ['The question people actually ask', 'Building it as plain HTML/JS', 'Shipping it on GitHub Pages']]
    : [['The problem', 'What the page sends, and when', "What it doesn't do (yet)"], ['Why a monthly allowance of 10 runs', 'The static page in front of the model', 'Redaction and the consent step'], ['The question people actually ask', 'Building it as plain HTML/JS', 'Shipping it on GitHub Pages']];
  const h2 = C.pick(2, pools);
  const cta = C.free
    ? C.pick(3, [`Try it: ${C.URL}. It's free, no account; the page source is the documentation.`, `Live page: ${C.URL}. Tell me what breaks in the comments.`, `${C.URL} — and the next tool in the series is ${C.rel ? C.rel.title : 'coming soon'}.`])
    : C.pick(3, [S(`Try it: ${C.URL}.`, sent(cap(C.FREE()))), `Live page: ${C.URL}. Tell me what breaks in the comments.`, `${C.URL} — and the next tool in the series is ${C.rel ? C.rel.title : 'coming soon'}.`]);
  const tags = C.flags.noTags ? [] : TAGS.devtoTags(r);
  const front = ['---', 'title: ' + trunc(title, 100), 'published: false', tags.length ? 'tags: ' + tags.join(', ') : '', r.relatedGuides[0] ? 'canonical_url: ' + T.ORIGIN + r.relatedGuides[0] : '', '---'].filter(Boolean).join('\n');
  const body = tidy(front + '\n\n' + [intro, ...h2.map((h) => '## ' + h + '\n\n[Write this section]'), cta].join('\n\n'));
  return { main: 'body', parts: [{ key: 'title', label: 'Title', text: trunc(title, 100), limit: 100 }, { key: 'body', label: 'Markdown (front matter + outline)', text: body }] };
};

B['indiehackers-post'] = (C) => {
  const r = C.rec;
  const n = C.opts.n ? `Shipped tool #${C.opts.n}: ` : 'Shipped: ';
  const title = C.free
    ? C.pick(0, [`${n}${r.title}. Zero servers, zero signups.`, `What a one-page ${C.secLc} tool taught me about SEO`, `One person, ${C.count} tools: this week's page`])
    : C.pick(0, [`${n}${r.title}, an AI helper with 10 free runs a month`, `What a one-page ${C.secLc} tool taught me about SEO`, `One person, ${C.count} tools: this week's page`]);
  const context = C.pick(1, ['I run 1234Tools solo from Reading, UK: static HTML, no backend for the browser tools.', `Solo, static site, ${C.count} tools; the browser ones have no backend at all.`, `1234Tools is a one-person project: ${C.count} tools on GitHub Pages.`]);
  const shipped = S(`What shipped: ${r.title} — ${lc1(C.D())}`, sent(cap(C.PRIV(2))));
  const happened = C.opts.metric ? sent(C.opts.metric) : (C.v % 2 === 0 ? "Too early for numbers; I'll report back in 30 days." : 'Search Console shows impressions but no clicks yet — that\'s normal for week one.');
  const next = `Next: whatever the comments ask for in ${r.sectionName}.`;
  const body = tidy([context, shipped, happened, next, C.URL].join('\n\n'));
  return { main: 'body', parts: [{ key: 'title', label: 'Title', text: trunc(title, 150), limit: 150 }, { key: 'body', label: 'Post', text: body }] };
};

B['discord-message'] = (C) => {
  const r = C.rec;
  const ctx = C.q ? '[One line that answers the question]' : '';
  const tool = C.free
    ? C.pick(0, [`${r.title} does that in the browser — I run the site so obviously biased.`, `I built a page for this: ${r.title}. (Mine, so biased.)`, `No-upload option: ${r.title} — mine.`])
    : C.pick(0, [`${r.title} does that with an AI model — I run the site so obviously biased.`, `I built a page for this: ${r.title}. (Mine, so biased.)`, `AI option: ${r.title} — mine.`]);
  const priv = sent(cap(C.PRIV(1)));
  const text = tidy(S(ctx, tool, priv, C.free ? '' : sent(cap(C.FREE()))) + '\n' + C.URL);
  return { main: 'text', parts: [{ key: 'text', label: 'Message', text }] };
};

B['whatsapp-broadcast'] = (C) => {
  const r = C.rec;
  const greet = C.pick(0, ['Hi —', 'New on 1234Tools:', 'Quick update:']);
  const line = `*${r.title}* — ${r.io}.`;
  const why = C.pick(1, [`Handy if you ${C.aud.task}.`, `For anyone who needs to ${C.task}.`, sent(cap(C.PRIV(1)))]);
  const text = tidy(S(greet, line, why, C.free ? '' : sent(cap(C.FREE())), C.URL) + "\nReply STOP and I'll take you off this list.");
  return { main: 'text', parts: [{ key: 'text', label: 'Broadcast', text }] };
};

B['telegram-post'] = (C) => {
  const r = C.rec;
  const lead = C.pick(0, [`**${r.title}**`, `New: **${r.title}**`, `**${r.io}** — ${r.title}`]);
  const own = !C.venue || /channel|share-/.test(C.venue.id || '') || C.venue.kind === 'newsletter' || C.venue.kind === 'social';
  const tags = C.tags({ n: 3, tier: 'niche', lower: true }).join(' ');
  const text = tidy([lead, sent(C.D()), S(sent(cap(C.PRIV(0))), sent(cap(C.FREE()))), own ? '' : 'I run the site.', C.URL, tags].filter(Boolean).join('\n'));
  return { main: 'text', parts: [{ key: 'text', label: 'Post', text }] };
};

B['instagram-caption'] = (C) => {
  const r = C.rec;
  const hook = C.HOOK((C.venue && C.venue.angle) || 'no-signup', 0);
  const l2 = C.free ? C.pick(1, [`${r.title}: ${r.io}.`, trunc(C.D(), 80), 'Free, no account, nothing uploaded.']) : C.pick(1, [`${r.title}: ${r.io}.`, trunc(C.D(), 80), 'Free for 10 runs a month.']);
  const l3 = C.free ? C.pick(2, [`For ${C.aud.name}.`, 'Save this for later.', 'Works offline once opened.']) : C.pick(2, [`For ${C.aud.name}.`, 'Save this for later.', 'Says what it sends before it runs.']);
  const extra = C.free ? '' : (/10/.test(l2) ? '' : 'Cloud AI, 10 free runs a month.');
  const cta = 'Link in bio → 1234tools.com ' + (IG_EMOJI[r.section] || '✅');
  const tags = C.tags({ n: 4, tier: 'niche', brand: 2 }).join(' ');
  const text = tidy([hook, l2, l3, extra, cta, '', tags].filter((x, i) => x !== '' || i === 5).join('\n'));
  return { main: 'text', parts: [{ key: 'text', label: 'Caption', text }] };
};

B['tiktok-caption'] = (C) => {
  const hook = C.HOOK('speed', 0);
  const clause = C.free ? C.pick(1, ['Free, no account.', 'Nothing uploaded.', 'Works offline.']) : C.pick(1, ['Free for 10 runs a month.', 'Cloud AI, 10 free runs a month.', 'No card needed for 10 runs a month.']);
  const shown = trunc(S(hook, clause, '1234tools.com'), 150);
  const tags = C.tags({ n: 4, tier: 'niche', lower: true }).join(' ');
  const text = tidy(S(shown, tags));
  return { main: 'text', parts: [{ key: 'text', label: 'Caption', text }] };
};

function shortSocial(C, valueMax) {
  const r = C.rec;
  const hook = C.HOOK((C.venue && C.venue.angle) || C.opts.angle || 'privacy', 0);
  const value = C.pick(1, [`${r.title}: ${r.io}.`, trunc(C.D(), valueMax), `${r.title}, ${C.FREE()}.`]);
  const priv = sent(cap(C.PRIV(2)));
  return { hook, value, priv };
}

B['threads-post'] = (C) => {
  const x = shortSocial(C, 160);
  const text = tidy(S(x.hook, x.value, x.priv, C.free ? '' : (/10/.test(x.value + x.priv) ? '' : 'Free for 10 runs a month.'), C.URL) + ' (mine)');
  return { main: 'text', parts: [{ key: 'text', label: 'Post', text }] };
};

B['bluesky-post'] = (C) => {
  const x = shortSocial(C, 110);
  const text = tidy(S(x.hook, x.value, x.priv, C.free ? '' : (/10/.test(x.value + x.priv) ? '' : 'Free for 10 runs a month.'), C.URL) + ' (mine)');
  return { main: 'text', parts: [{ key: 'text', label: 'Post', text }] };
};

B['mastodon-post'] = (C) => {
  const x = shortSocial(C, 200);
  const off = C.OFFLINE(x.priv + x.value) ? sent(cap(C.OFFLINE(x.priv + x.value))) : '';
  const tags = C.tags({ n: 3, tier: 'niche', brand: 1 }).join(' ');
  const text = tidy(S(x.hook, x.value, x.priv, off, C.free ? '' : (/10/.test(x.value + x.priv) ? '' : 'Free for 10 runs a month.'), C.URL) + ' (mine)' + (tags ? ' ' + tags : ''));
  return { main: 'text', parts: [{ key: 'text', label: 'Post', text }] };
};

B['newsletter-blurb'] = (C) => {
  const r = C.rec;
  const open = C.pick(0, [`**${r.title}** — ${C.D()}`, `New: **${r.title}**. ${r.io}.`, `For ${C.aud.name}: **${r.title}**.`]);
  const middle = C.v % 3 === 0 ? S(sent(cap(C.PRIV(1))), sent(cap(C.OFFLINE(C.PRIV(1)))), `Built for ${C.aud.name}.`) : S(C.D(), sent(cap(C.PRIV(1))));
  const close = C.pick(1, [`[Try it](${C.URL}).`, `[Open the tool](${C.URL}) — ${C.FREE()}.`, `[Have a look](${C.URL}).`]);
  const freeLine = !C.free && !/10/.test(open + middle + close) ? 'Free for 10 runs a month.' : '';
  let text = tidy(S(open, middle, freeLine, close));
  if (count(text, 'words') < 40 && !/Built for/.test(text)) text = tidy(S(open, middle, freeLine, `Built for ${C.aud.name}.`, close));
  return { main: 'text', parts: [{ key: 'text', label: 'Blurb', text }] };
};

B['directory-listing'] = (C) => {
  const r = C.rec;
  const tagline = C.free
    ? C.pick(0, [`${r.io} — in your browser, nothing uploaded`, `${cap(C.task)} without an account or an upload`, `Free ${C.secLc}: ${trunc(r.description, 40)}`])
    : C.pick(0, [`${r.io} — 10 free AI runs a month`, `${cap(C.task)} with AI, 10 free runs a month`, `AI ${C.secLc}: ${trunc(r.description, 30)}`]);
  const shortFree = sent(cap(C.FREE()));
  const short = S(trunc(r.description, 160 - cp(shortFree).length - 1), shortFree);
  const long = S(C.D(), sent(cap(C.PRIV(0))), sent(cap(C.FREE())), sent(cap(C.OFFLINE(C.PRIV(0) + C.D()))), `One of ${C.count} tools from MVR IT Services LTD, Reading, UK; analytics only after you accept the consent bar.`);
  const cats = CATEGORIES[r.section] || (r.sectionName + ', Utilities');
  const tags = r.keywords.slice(0, 6).map((k) => k.toLowerCase()).concat(C.free ? ['free', 'no-signup', 'offline'] : ['ai', 'freemium']).join(', ');
  return {
    main: 'long',
    parts: [
      { key: 'name', label: 'Name', text: trunc(`1234Tools — ${r.title}`, 100), limit: 100 },
      { key: 'tagline', label: 'Tagline', text: trunc(tagline, 60), limit: 60 },
      { key: 'short', label: 'Short description', text: short, limit: 160 },
      { key: 'long', label: 'Long description', text: long },
      { key: 'categories', label: 'Categories', text: cats, limit: 200 },
      { key: 'tags', label: 'Tags', text: tags, limit: 400 },
      { key: 'url', label: 'Link (UTM)', text: C.utm, limit: 2000 },
      { key: 'clean', label: 'Link (clean)', text: C.clean, limit: 2000 },
    ],
  };
};

B['email-outreach'] = (C) => {
  const r = C.rec;
  const first = C.opts.firstName || '[first name]';
  const their = C.opts.theirPageTitle || '[their page title]';
  const topic = C.opts.pageTopic || lc1(r.sectionName.replace(/ Tools$/, '')) + ' tools';
  const subjects = C.free
    ? [`A no-upload ${C.kw(0)} tool for your ${topic} page`, `Small addition for "${their}"`, `${r.title} — free, runs in the browser (for your list)`]
    : [`An AI ${C.kw(0)} helper for your ${topic} page`, `Small addition for "${their}"`, `${r.title} — 10 free runs a month (for your list)`];
  const how = C.free ? 'It runs in the browser, so nothing is uploaded; free, no account.' : 'It uses an AI model, the page says what it sends first, and 10 runs a month are free.';
  const body = tidy(`Hi ${first}, I'm Vishal from 1234Tools (MVR IT Services, Reading). Your "${their}" page lists ${topic}, and I think one is missing: ${r.title} — ${sent(lc1(C.D()))} ${how} Link: ${C.clean}. If it doesn't fit, no reply needed — and if there's a tool you wish existed, tell me and I'll build it. Vishal`);
  const follow = `Hi ${first}, a quick nudge on the ${r.title} note from last week — happy to drop it if it's not a fit. Vishal, 1234Tools`;
  return {
    main: 'body',
    parts: [
      { key: 'subject1', label: 'Subject 1', text: trunc(subjects[0], 120), limit: 120 },
      { key: 'subject2', label: 'Subject 2', text: trunc(subjects[1], 120), limit: 120 },
      { key: 'subject3', label: 'Subject 3', text: trunc(subjects[2], 120), limit: 120 },
      { key: 'body', label: 'Body (≤ 90 words)', text: body },
      { key: 'followup', label: 'Follow-up after 7 days (≤ 50 words)', text: follow, limit: 50, countMode: 'words' },
    ],
  };
};

B['signature'] = (C) => {
  const r = C.rec;
  const l1 = C.free ? `Vishal · 1234tools.com — ${C.countRounded} free browser tools, nothing uploaded` : 'Vishal · 1234tools.com — browser tools and AI helpers';
  const room = 120 - cp(l1).length - 1;
  const l2 = trunc(`${r.sectionName}: ${r.title}`, room);
  return { main: 'text', parts: [{ key: 'text', label: 'Signature (2 lines)', text: l1 + '\n' + l2 }] };
};

B['bio'] = (C) => {
  const list = C.pick(0, ['PDF · salary · GST · images', 'PDF · invoices · payroll · photos', 'calculators · converters · QR · text']);
  const listComma = list.replace(/ · /g, ', ');
  const ig = `Free browser tools that don't upload your files. ${cap(list)}. Solo-built in Reading, UK. Analytics only if you opt in. ↓`;
  const x = `${C.countRounded} free tools that run in your browser — nothing uploaded, no account. Built by one person. Posts: what shipped, what broke. 1234tools.com`;
  const tt = `Free tools, no upload, no signup. ${cap(listComma)}. Link below.`;
  return {
    main: 'instagram', site: true,
    parts: [
      { key: 'instagram', label: 'Instagram bio', text: ig, limit: 150 },
      { key: 'x', label: 'X bio', text: x, limit: 150 },
      { key: 'tiktok', label: 'TikTok bio', text: tt, limit: 80 },
    ],
  };
};

/* ------------------------------------------------------------- fitting */

const STEPS = [
  {}, { noTags: true }, { noTags: true, noOffline: true }, { noTags: true, noOffline: true, noPriv: true },
  { noTags: true, noOffline: true, noPriv: true, shortHook: true },
];
for (const d of [240, 180, 140, 100, 70, 45, 25, 0]) STEPS.push({ noTags: true, noOffline: true, noPriv: true, shortHook: true, descMax: d });

function limitFor(id, part, mainKey, venue) {
  const meta = META[id];
  let lim = part.limit || (part.key === mainKey ? meta.limit : 0);
  const mode = part.countMode || (part.key === mainKey ? meta.countMode : null) || 'chars';
  // the venue's own cap applies to the main body of single-body templates
  if (venue && venue.maxChars > 0 && part.key === mainKey && mode !== 'words' && !['ph-launch', 'directory-listing', 'email-outreach', 'signature', 'bio', 'devto-article', 'youtube-description'].includes(id)) {
    lim = lim ? Math.min(lim, venue.maxChars) : venue.maxChars;
  }
  return { lim, mode };
}

function fits(id, built, venue) {
  for (const p of built.parts) {
    const { lim, mode } = limitFor(id, p, built.main, venue);
    if (lim && count(p.text, mode) > lim) return false;
  }
  return true;
}

/** Render one template for one tool. Never throws for a known template and tool. */
function render(templateId, rec, opts) {
  opts = opts || {};
  if (!META[templateId]) throw new Error('Unknown template: ' + templateId);
  if (typeof rec === 'string') rec = T.record(rec);
  const venue = opts.venue || null;
  let built = null;
  let step = 0;
  for (; step < STEPS.length; step++) {
    const C = makeCtx(templateId, rec, opts, STEPS[step]);
    built = B[templateId](C);
    built.C = C;
    if (fits(templateId, built, venue)) break;
  }
  const warnings = [];
  const C = built.C;
  if (step >= STEPS.length) {
    step = STEPS.length - 1;
    warnings.push({ rule: 'hard-trunc', msg: 'Cut to fit the limit; read it before posting.' });
    for (const p of built.parts) {
      const { lim, mode } = limitFor(templateId, p, built.main, venue);
      if (lim && count(p.text, mode) > lim) p.text = mode === 'words' ? truncWords(p.text, lim) : trunc(p.text, lim - (mode === 'x' ? 0 : 0));
    }
  } else if (step > 0) {
    const s = STEPS[step];
    warnings.push({ rule: 'overflow', msg: 'Shortened to fit: ' + [s.noTags && 'hashtags dropped', s.noOffline && 'offline line dropped', s.noPriv && 'privacy line dropped', s.shortHook && 'shortest hook', s.descMax != null && 'description cut to ' + s.descMax].filter(Boolean).join(', ') + '.' });
  }
  if (META[templateId].needsQuestion && !C.q) warnings.push({ rule: 'question-required', msg: 'Stack Exchange answers need a real question: draft from the Opportunities tab.' });
  if (templateId === 'newsletter-blurb') {
    const n = count(built.parts[0].text, 'words');
    if (n < 40) warnings.push({ rule: 'short', msg: 'Blurb is ' + n + ' words; aim for 40–60.' });
  }

  // lint every part
  const errors = [];
  const parts = built.parts.map((p) => {
    const { lim, mode } = limitFor(templateId, p, built.main, venue);
    const isUrl = /^url$|^clean$/.test(p.key);
    const res = lint(p.text, {
      pricing: built.site ? 'free' : rec.pricing,
      section: built.site ? '' : rec.section,
      limit: lim, countMode: mode === 'chars' ? undefined : mode, record: rec,
      requireDisclosure: !!META[templateId].disclose && p.key === built.main,
      multiLinkOk: !!META[templateId].multiLink, cleanOnly: !!META[templateId].clean && !isUrl,
    });
    for (const e of res.errors) errors.push(Object.assign({ part: p.key }, e));
    for (const w of res.warnings) warnings.push(Object.assign({ part: p.key }, w));
    return { key: p.key, label: p.label, text: p.text, chars: res.count, limit: lim, countMode: mode };
  });
  const main = parts.find((p) => p.key === built.main) || parts[0];
  const title = parts.find((p) => p.key === 'title' || p.key === 'name');
  const text = built.joined || main.text;
  return {
    id: templateId, label: META[templateId].label, tool: rec.path, variant: C.v,
    text, title: title ? title.text : undefined, parts,
    chars: main.chars, limit: main.limit, countMode: main.countMode,
    url: C.URL, cleanUrl: C.clean, utmUrl: C.utm, medium: C.medium,
    linkInReply: !!built.linkInReply || templateId === 'linkedin-post' || (templateId === 'facebook-group' && built.parts.some((p) => p.key === 'comment')),
    warnings, errors, ok: errors.length === 0, hash: hash32(text).toString(16), step,
  };
}

function renderAll(rec, opts) {
  if (typeof rec === 'string') rec = T.record(rec);
  return TEMPLATE_IDS.map((id) => render(id, rec, opts));
}

module.exports = {
  META, TEMPLATE_IDS, render, renderAll,
  record: T.record, utmUrl: T.utmUrl, cleanUrl: T.cleanUrl,
  trunc, taskPhrase, hash32, KIND_MEDIUM,
};
