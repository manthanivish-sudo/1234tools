/**
 * Reel Maker — a script, pictures, a voice and music in; a 9:16 MP4 out.
 *
 * Scenes of animated text, pictures and clips are laid end to end and drawn
 * by ONE function, renderFrame(ctx, W, H, t), for the preview, the cover and
 * every exported frame, so what is exported is what was seen. Sound (a
 * voiceover, music that ducks under it, a clip's own sound) is mixed in an
 * OfflineAudioContext; captions come from Whisper tiny on the device
 * (aivid-whisper.js) and are drawn by the Auto Captions tool's own
 * drawCaptions. Encoding is the shared runtime's encodeVideo /
 * encodeVideoFrames (aiimg-core.js). Nothing leaves the browser.
 *
 * "Promote a 1234Tools tool" is a preset inside the same product: it reads a
 * row of assets/finder-index.js (loaded on demand) and writes the script,
 * the end card with a QR code and an Instagram caption from it. The copy it
 * writes follows the site's truthfulness rules: browser tools "run in your
 * browser, nothing you type is uploaded, no account"; /ai/ tools "send your
 * text to an AI model and say so first; 10 free a month with an account".
 *
 * Exports: AIImg.tools['reel-maker'] = { mount, buildScript, captionFor,
 * mixAudio, sceneAt, renderFrame, scenesFromScript, tagsFor, qrUrlFor,
 * state() } — renderFrame/sceneAt/captionFor default to the mounted tool's
 * state, which is what the browser test and the share sheet use.
 */
(function () {
  'use strict';
  const A = typeof window !== 'undefined' ? window.AIImg : null;
  if (!A) return;
  const { el, clamp, easeOut, field, select, range, colour, check, button, sleep, fmtBytes } = A;

  /* ------------------------------------------------------------------ */
  /* constants                                                          */
  /* ------------------------------------------------------------------ */
  const MAX_SECONDS = 90, MAX_MEDIA = 10, MAX_VIDEO_BYTES = 200e6, MAX_IMAGE_BYTES = 40e6, MAX_VOICE_SECONDS = 90, MAX_BATCH = 25;
  const FPS = 30, XFADE = 0.35, SR = 48000;
  const SITE = 'https://www.1234tools.com';
  const PHONE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || !!(navigator.userAgentData && navigator.userAgentData.mobile);
  const PREVIEW_MAX = PHONE ? 540 : 720;
  const MEDIA_MAX_EDGE = PHONE ? 1440 : 2048;
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SIZES = {
    '1080x1920': { w: 1080, h: 1920, rates: { standard: 8e6, high: 12e6, small: 5e6 }, utm: 'instagram' },
    '1080x1080': { w: 1080, h: 1080, rates: { standard: 6e6, high: 9e6, small: 4e6 }, utm: 'instagram' },
    '1920x1080': { w: 1920, h: 1080, rates: { standard: 8e6, high: 12e6, small: 5e6 }, utm: 'youtube' }
  };
  const EXAMPLE = 'Stop guessing your GST.\nType the amount, pick the slab.\nCGST, SGST and IGST split — in a second.\nFree. Runs in your browser.';
  const ANIMS = [['zoom', 'Pop in'], ['slide', 'Slide in'], ['typewriter', 'Type on'], ['fade', 'Fade'], ['none', 'Still']];
  const FITS = [['card', 'Card — fits the width, rounded'], ['phone', 'Phone frame'], ['cover', 'Full-bleed']];
  const CAP_STYLES = [
    ['karaoke', 'Karaoke', 'Words light up as they are spoken'],
    ['pop', 'Pop', 'The current word jumps in size'],
    ['outline', 'Bold outline', 'White, heavy, black edge'],
    ['minimal', 'Minimal', 'A dark box under one line']
  ];

  /* The five looks. Text on each background is at least 7:1 (checked by
     hand); the paper look's accent is a deepened bronze so an emphasised
     word stays readable on cream. */
  const LOOKS = [
    { id: 'midnight', label: 'Midnight gold', swatch: '#f7c948', bg: ['#0e1428', '#06080f'], glow: 'rgba(247,201,72,0.14)', text: '#f4f6fb', muted: '#b7bfd2', accent: '#f7c948', bar: '#f7c948', plate: 'rgba(6,8,15,0.78)', plateText: '#f4f6fb', font: 'Sora', textAnim: 'zoom', uppercase: false, textGlow: 0, stroke: '#000000', strokeWidth: 0, shadow: 0.45, blobs: true, light: false, caption: { preset: 'karaoke', accent: '#f7c948', fill: '#ffffff', box: '#0b1020' } },
    { id: 'violet', label: 'Violet neon', swatch: '#7c5cff', bg: ['#1a1240', '#06080f'], glow: 'rgba(124,92,255,0.2)', text: '#f4f6fb', muted: '#b7bfd2', accent: '#7c5cff', bar: '#2dd4ff', plate: 'rgba(10,6,30,0.8)', plateText: '#f4f6fb', font: 'Sora', textAnim: 'fade', uppercase: false, textGlow: 6, stroke: '#000000', strokeWidth: 0, shadow: 0.45, blobs: true, light: false, caption: { preset: 'pop', accent: '#2dd4ff', fill: '#ffffff', box: '#0b1020' } },
    { id: 'sunrise', label: 'Sunrise', swatch: '#ff9d2e', bg: ['#3a2208', '#0a0e1a'], glow: 'rgba(255,157,46,0.16)', text: '#fff7e6', muted: '#e8c9a0', accent: '#ff9d2e', bar: '#ff9d2e', plate: 'rgba(20,12,4,0.8)', plateText: '#fff7e6', font: 'Sora', textAnim: 'slide', uppercase: false, textGlow: 0, stroke: '#000000', strokeWidth: 0, shadow: 0.45, blobs: true, light: false, caption: { preset: 'karaoke', accent: '#ff9d2e', fill: '#ffffff', box: '#0b1020' } },
    { id: 'paper', label: 'Paper', swatch: '#efe6d2', bg: ['#fbf7ee', '#efe6d2'], glow: 'rgba(232,160,32,0.10)', text: '#1a1400', muted: '#5a5040', accent: '#a86400', bar: '#e8a020', plate: 'rgba(26,20,0,0.86)', plateText: '#ffffff', font: 'Sora', textAnim: 'zoom', uppercase: false, textGlow: 0, stroke: '#000000', strokeWidth: 0, shadow: 0.08, blobs: false, light: true, caption: { preset: 'minimal', accent: '#f7c948', fill: '#ffffff', box: '#1a1400' } },
    { id: 'bold', label: 'Bold', swatch: '#ffe600', bg: ['#000000', '#000000'], glow: 'rgba(255,230,0,0.06)', text: '#ffffff', muted: '#cccccc', accent: '#ffe600', bar: '#ffe600', plate: 'rgba(0,0,0,0.85)', plateText: '#ffffff', font: 'Sora', textAnim: 'zoom', uppercase: true, textGlow: 0, stroke: '#000000', strokeWidth: 0, shadow: 0.3, blobs: false, light: false, caption: { preset: 'outline', accent: '#ffe600', fill: '#ffffff', box: '#0b1020' } }
  ];
  const lookCopy = (l) => Object.assign({}, l, { bg: l.bg.slice(), caption: Object.assign({}, l.caption) });

  /* The quick picks in the promote picker. Kept in step with build-site.js
     POPULAR plus the high-interest list; filtered through the index at run
     time, so a removed tool drops out on its own. */
  const POPULAR_PATHS = ['image/image-compressor/', 'pdf/merge-pdf/', 'developer/json-formatter/', 'image/passport-photo/', 'qr/qr-code-generator/',
    'business/currency-converter/', 'india/gst-calculator/', 'text/word-counter/', 'ai-image/background-remover/', 'ai-video/auto-captions/',
    'ai-image/text-behind-image/', 'pdf/split-pdf/', 'india/emi-calculator/', 'india/sip-calculator/', 'india/india-income-tax/',
    'business/uk-take-home-pay/', 'health/bmi/', 'time/age-calculator/', 'time/date-difference/', 'pdf/payslip-pdf/', 'pdf/invoice-pdf/'];

  /* ---- the auto-script tables ---- */
  const VERB_RULES = [
    [/checker|tester|validator|counter|diff|compare|readab|scanner|analy[sz]er|decoder|parser|lookup|inspector|viewer/i, 'Check'],
    [/compressor|remover|cleaner|strip|blur|eraser|upscal|dedup|optimi[sz]er|unblur/i, 'Clean up'],
    [/converter|convert|\bto\b|encoder|resizer|rotate|crop|merge|split|extract|transcri|translator|formatter|minif|beautif/i, 'Convert'],
    [/generator|maker|builder|creator|designer|signature|watermark|captions|timetable|seating|payslip|invoice|certificate|planner|resume|card|writer/i, 'Make'],
    [/calculator|calc\b|estimator|interest|tax|emi|sip|salary|pay\b|bmi|age|difference|percent/i, 'Calculate']
  ];
  const SECTION_DEFAULT = { business: 'Calculate', ai: 'Make', pdf: 'Convert', education: 'Calculate', india: 'Calculate', developer: 'Convert',
    image: 'Convert', 'ai-image': 'Make', 'ai-video': 'Make', text: 'Check', mathematics: 'Calculate', finance: 'Calculate', time: 'Calculate',
    health: 'Calculate', qr: 'Make', utilities: 'Calculate', engineering: 'Calculate', design: 'Calculate', conversions: 'Convert' };
  const TRAIL_RE = /\s+(Calculator|Converter|Generator|Maker|Checker|Tester|Counter|Formatter|Validator|Decoder|Encoder|Compressor|Remover|Resizer|Solver|Tool|Tools|Online)$/i;
  /* Hooks with the tool's own words in them. */
  const HOOKS = {
    Calculate: ['Stop guessing your {noun}.', '{noun} in ten seconds.\nFree.', 'Still working out\n{noun} by hand?'],
    Convert: ['{inPart} → {outPart}.\nNo upload.', 'Convert {inPart} to {outPart}\nwithout an app.', '{title}:\ndrop it in, it’s done.'],
    Check: ['Check your {noun}\nbefore you send it.', '{title} —\npaste, done.', 'Not sure about the {noun}?\nCheck it free.'],
    Make: ['Make {aNoun}\nin your browser. Free.', 'Need {aNoun}?\nNo account, no watermark.', '{title}:\nmade on your device.'],
    'Clean up': ['{title},\nwithout uploading the photo.', 'Clean it up.\nKeep it private.', '{title} —\nfree, no watermark.']
  };
  /* /ai/ tools send text to a model on a server and need an account after
     the free runs: none of the privacy, offline or no-sign-up hooks apply. */
  const AI_HOOKS = ['{title}:\nyour first draft, by AI.', 'Paste it in.\nRead what the AI sends back.', '{noun} with AI —\nyou do the checking.'];
  /* The promotion desk's hook library (copy-spec §4), the same strings the
     owner's other posts use. Result-first hooks (6, 12, 18, 21, 25, 30)
     need a figure checked against the engine, so they are not here; hooks
     written for one kind of tool carry a path pattern. */
  const LIBRARY = [
    ['Your PDFs never need to leave your laptop to be merged.', 'Make', 'privacy', /merge-pdf/],
    ['Three files, one PDF, zero uploads.', 'Make', 'speed', /merge-pdf/],
    ['Stop paying monthly for a button.', 'Make', 'cost'],
    ['Make it on the train with no signal.', 'Make', 'offline'],
    ['No account. No email. Just the file.', 'Make', 'no-signup'],
    ['Convert it without sending it anywhere.', 'Convert', 'privacy'],
    ['Drop, convert, done before the kettle boils.', 'Convert', 'speed'],
    ['The converter that costs exactly nothing.', 'Convert', 'cost'],
    ['Works in airplane mode. Really.', 'Convert', 'offline'],
    ['Convert first, sign up never.', 'Convert', 'no-signup'],
    ['Check it before you send it, not after.', 'Check', 'speed'],
    ['Nobody else sees what you’re checking.', 'Check', 'privacy'],
    ['The free check that saves a penalty.', 'Check', 'cost', /vat|tax|mtd|gst|ir35|deadline/],
    ['Validate offline; the rules are in the page.', 'Check', 'offline', /valid/],
    ['No login to find out if it’s valid.', 'Check', 'no-signup', /valid|checker|tester/],
    ['Payslip maths shouldn’t need a login.', 'Calculate', 'no-signup', /payslip|take-home|salary|ctc/],
    ['Your salary stays on your screen.', 'Calculate', 'privacy', /salary|take-home|ctc|payslip|income-tax/],
    ['Type one number. Read the whole breakdown.', 'Calculate', 'speed'],
    ['The calculator that never asks for your card.', 'Calculate', 'cost'],
    ['Still works when the office Wi-Fi doesn’t.', 'Calculate', 'offline'],
    ['Clean up the mess without uploading it.', 'Clean up', 'privacy'],
    ['Paste. Click. Tidy.', 'Clean up', 'speed', /^text\//],
    ['Free, because tidying text shouldn’t be a subscription.', 'Clean up', 'cost', /^text\//],
    ['Clean it offline; nobody reads your draft.', 'Clean up', 'offline', /^text\//]
  ];
  const HOOK_ACCENT = ['free', 'zero', 'nothing', 'never', 'offline', 'airplane', 'login', 'card', 'penalty', 'tidy', 'private', 'anywhere', 'no'];
  /* Tools that need the network for their data (rates, lookups): no
     "works offline" claim for them. */
  const ONLINE_RE = /currency|exchange|crypto|dns|whois|ip-|lookup|http|website|ping|speed-test|weather|url-/;
  const MODEL_SECTIONS = { 'ai-image': 1, 'ai-video': 1 };
  const FILE_SECTIONS = { pdf: 1, image: 1, 'ai-image': 1, 'ai-video': 1 };
  const SECTION_LINE = {
    'India': 'Built for India. Free, no account.',
    'Business': 'Built for small businesses. No account.',
    'AI for Business': 'A language model does the reading; you do the checking.',
    'PDF Tools': 'Free, with no sign-up.',
    'Image & Photo Tools': 'Your photos stay on your device.',
    'AI Image Tools': 'The AI model runs on your device, not a server.',
    'AI Video Tools': 'Made on your device. No watermark.',
    'Developer & Web Tools': 'Paste it in, copy the result. No account.',
    'Text & Writing Tools': 'Free, with no account.',
    'Education & Exams': 'Made for students and teachers. Free.',
    'Health': 'An estimate, not medical advice.',
    'QR Tools': 'Free, with no sign-up.'
  };
  const SECTION_LINE_DEFAULT = 'Free. No account. Nothing to install.';
  /* copy-spec §3: ranked broad → niche; the caption takes the relevant ones. */
  const SECTION_TAGS = {
    business: ['#SmallBusiness', '#Productivity', '#Accounting', '#Invoicing', '#Payroll', '#UKBusiness', '#VAT', '#MTD', '#TakeHomePay', '#PAYE', '#Bookkeeping'],
    ai: ['#AI', '#Productivity', '#AITools', '#Automation', '#SmallBusiness', '#Copywriting', '#DocumentAI', '#AIForWork', '#Summarizer'],
    pdf: ['#PDF', '#Productivity', '#Paperless', '#PDFTools', '#MergePDF', '#SplitPDF', '#CompressPDF', '#PDFConverter', '#DocumentManagement', '#GoPaperless'],
    education: ['#Teachers', '#EdTech', '#School', '#Timetable', '#TeacherLife', '#Classroom', '#SchoolAdmin', '#LessonPlanning', '#StudyTools', '#GradeCalculator'],
    india: ['#India', '#GST', '#IncomeTax', '#Finance', '#CTC', '#InHandSalary', '#GSTIndia', '#ITR', '#EPF', '#HRA', '#IndianBusiness', '#TaxIndia'],
    developer: ['#WebDev', '#Programming', '#JavaScript', '#DevTools', '#JSON', '#Regex', '#Base64', '#Coding', '#100DaysOfCode', '#Developer', '#CodeNewbie'],
    image: ['#Photography', '#Design', '#ImageEditing', '#PhotoEditing', '#ResizeImage', '#CompressImage', '#WebP', '#Graphics', '#ContentCreator', '#NoWatermark'],
    'ai-image': ['#AIArt', '#Design', '#ImageEditing', '#BackgroundRemover', '#Upscale', '#AIPhoto', '#OnDeviceAI', '#PhotoEditing', '#Creators', '#NoWatermark'],
    'ai-video': ['#Video', '#Captions', '#ContentCreator', '#Subtitles', '#Shorts', '#VideoEditing', '#Whisper', '#AutoCaptions', '#Accessibility', '#OfflineAI'],
    text: ['#Writing', '#Productivity', '#WordCount', '#TextTools', '#Editing', '#Copywriting', '#Students', '#Writers', '#CaseConverter', '#Markdown'],
    mathematics: ['#Maths', '#Math', '#Education', '#Students', '#Percentage', '#Algebra', '#Calculator', '#Homework', '#STEM', '#StudyTips'],
    finance: ['#PersonalFinance', '#Investing', '#Savings', '#CompoundInterest', '#Loans', '#Mortgage', '#MoneyTips', '#Budgeting', '#FinancialLiteracy', '#UKFinance'],
    time: ['#Productivity', '#TimeManagement', '#Timezones', '#Countdown', '#Calendar', '#WorkingDays', '#Scheduling', '#RemoteWork', '#DateCalculator', '#Planning'],
    health: ['#Health', '#Wellness', '#BMI', '#Fitness', '#Nutrition', '#Calories', '#Hydration', '#HealthTools', '#Sleep', '#Wellbeing'],
    qr: ['#QRCode', '#Marketing', '#SmallBusiness', '#QRGenerator', '#Menus', '#Payments', '#Events', '#Branding', '#Print', '#ContactlessPayment'],
    utilities: ['#Productivity', '#LifeHacks', '#Tools', '#PasswordGenerator', '#Checklist', '#Utilities', '#Organised', '#Minimalism', '#DigitalTools', '#TechTips'],
    engineering: ['#Engineering', '#STEM', '#CivilEngineering', '#MechanicalEngineering', '#Calculator', '#UnitConverter', '#Students', '#EngineeringLife', '#Construction', '#Design'],
    design: ['#Design', '#UIDesign', '#GraphicDesign', '#ColorPalette', '#Typography', '#WebDesign', '#DesignTools', '#Branding', '#UX', '#Creative'],
    conversions: ['#UnitConverter', '#Converter', '#Metric', '#Imperial', '#Cooking', '#Travel', '#Students', '#Engineering', '#Measurement', '#Conversion']
  };
  const BRAND_TAGS = ['#FreeTools', '#1234Tools'];
  const CTA_EMOJI = { pdf: '📄', business: '💷', india: '🇮🇳', ai: '✅' };
  const STOP = new Set('about above after again against because before being below between could doesn every first from have having here into itself just more most other ought our ours over same should some such than that their theirs them then there these they this those through under until very what when where which while with would your yours youre without still really thing things make makes made free'.split(' '));

  /* ------------------------------------------------------------------ */
  /* small helpers                                                      */
  /* ------------------------------------------------------------------ */
  let seq = 0;
  const nid = () => 's' + (++seq);
  const r1 = (v) => Math.round(v * 10) / 10;
  const dB = (x) => Math.pow(10, x / 20);
  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };
  const fmtSec = (s) => s < 60 ? (Math.round(s * 10) / 10) + ' s' : Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s';
  const oneLine = (s) => String(s || '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const capFirst = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const slugify = (s) => (String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []).join('-').slice(0, 40).replace(/-+$/, '');
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  const pickBy = (key, list) => list[fnv(key) % list.length];
  const wordCount = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
  function secondsFor(text) { return r1(clamp(wordCount(text) / 2.75 + 0.6, 2.0, 4.5)); }
  const isWordChar = (c) => !!c && /[\p{L}\p{N}]/u.test(c);
  const hexA = (hex, a) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ''); return m ? 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')' : 'rgba(0,0,0,' + a + ')'; };
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /** Safe areas (fractions of H) and the content box, per frame shape. */
  function safeOf(W, H) {
    if (H > W * 1.3) return { top: 0.13, bottom: 0.167, box: [0.20, 0.70], maxW: 0.84 };
    if (W > H * 1.3) return { top: 0.08, bottom: 0.12, box: [0.16, 0.76], maxW: 0.70 };
    return { top: 0.06, bottom: 0.10, box: [0.14, 0.78], maxW: 0.84 };
  }
  const timeline = (scenes) => { let s = 0; const starts = scenes.map((sc) => { const v = s; s += Number(sc.seconds) || 0; return v; }); return { starts, D: s }; };
  const totalSeconds = (S) => timeline(S.scenes).D;
  const isVideoScene = (sc) => sc.type === 'media' && sc.media && sc.media.kind === 'video';

  /* ------------------------------------------------------------------ */
  /* the finder row → facts → a script                                  */
  /* ------------------------------------------------------------------ */
  /** A FINDER_INDEX array as an object. */
  function rowObj(a) {
    if (!Array.isArray(a)) return a;
    return { title: String(a[0] || ''), path: String(a[1] || '').replace(/^\/+/, ''), glyph: String(a[2] || ''), section: String(a[3] || ''),
      description: String(a[4] || ''), keywords: String(a[5] || ''), io: String(a[6] || ''), prefill: String(a[7] || '') };
  }
  function verbOf(title, sectionSlug) {
    for (const [re, v] of VERB_RULES) if (re.test(title)) return v;
    return SECTION_DEFAULT[sectionSlug] || 'Make';
  }
  function nounCase(s) {
    if (/&/.test(s)) return s;
    return s.split(/\s+/).map((w) => (/^[A-Z0-9]{2,5}s?$/.test(w) || /\d/.test(w) ? w : w.toLowerCase())).join(' ');
  }
  function article(noun) {
    const first = noun.split(/\s+/)[0] || '';
    if (/^[A-Z]{2,5}s?$/.test(first)) return /^[AEFHILMNORSX]/.test(first) ? 'an ' : 'a ';
    if (/^(eu|uk|us|uni|one|use)/i.test(first)) return 'a ';
    return /^[aeiou]/i.test(first) ? 'an ' : 'a ';
  }
  /** The description's first sentence, without an upload tail, at most 95 characters, cut at a comma or "and" — never an ellipsis. */
  function firstSentence(desc) {
    let s = String(desc || '').trim();
    const m = /^.*?[.!?](\s|$)/.exec(s);
    if (m) s = m[0].trim();
    s = s.replace(/\s*[—-]\s*nothing (is|you type is) uploaded.*$/i, '').replace(/[,;:\s]+$/, '').trim();
    if (s.length > 95) {
      const head = s.slice(0, 95);
      let at = Math.max(head.lastIndexOf(','), head.lastIndexOf(' and '));
      if (at < 30) at = head.lastIndexOf(' ');
      s = head.slice(0, at).replace(/[,;:\s]+$/, '');
    }
    if (s && !/[.!?]$/.test(s)) s += '.';
    return s;
  }
  function factsOf(row) {
    row = rowObj(row);
    const path = row.path.replace(/^\/+/, '');
    const segs = path.split('/').filter(Boolean);
    const slug = segs[segs.length - 1] || 'tool', sectionSlug = segs[0] || '';
    const isAI = sectionSlug === 'ai';
    const title = row.title;
    const rm = /\s*\((.*?)\)\s*/.exec(title);
    const region = rm ? rm[1] : '';
    let base = title.replace(/\s*\((.*?)\)\s*/, ' ').trim();
    base = base.replace(/\s+(with|for)\s.*$/i, '').trim();
    const verb = verbOf(title, sectionSlug);
    const noun = nounCase(base.replace(TRAIL_RE, '').trim() || base);
    const aNoun = article(noun) + noun;
    const io = String(row.io || '');
    let inPart = '', outPart = '';
    if (io.indexOf('→') >= 0) { const p = io.split('→').map((x) => x.trim()); inPart = p[0]; outPart = p.slice(1).join(' → '); }
    const first = firstSentence(row.description) || (title + '.');
    const offlineOk = !isAI && !MODEL_SECTIONS[sectionSlug] && !ONLINE_RE.test(path);
    const trustLine = isAI ? 'Sends your text to an AI model\nand says so first.' : FILE_SECTIONS[sectionSlug] ? 'Runs in your browser.\nYour files are not uploaded.' : 'Runs in your browser.\nNothing you type is uploaded.';
    const sectionLine = isAI ? '10 free runs a month with an account.' : (SECTION_LINE[row.section] || SECTION_LINE_DEFAULT);
    const trustSentence = isAI ? 'It sends your text to an AI model and says so first; 10 free runs a month with an account.'
      : (FILE_SECTIONS[sectionSlug] ? 'Runs in your browser; your files are not uploaded. Free, no account.' : 'Runs in your browser; nothing you type is uploaded. Free, no account.');
    return { row, path, slug, sectionSlug, isAI, title, region, verb, noun, aNoun, inPart, outPart, first, offlineOk, trustLine, sectionLine, trustSentence,
      url: '1234tools.com/' + path, emoji: CTA_EMOJI[sectionSlug] || '✅' };
  }
  function fill(tpl, f) {
    return capFirst(tpl.replace(/\{(\w+)\}/g, (m, k) => (f[k] !== undefined ? f[k] : m)));
  }
  /** The hook for a tool: its own words where a template fits, the desk's library otherwise; the same tool always gets the same one. */
  function hookFor(f) {
    if (f.isAI) return { text: fill(pickBy(f.path, AI_HOOKS), f), emphasis: [f.noun] };
    const pool = (HOOKS[f.verb] || HOOKS.Make).filter((t) => !(/\{inPart\}|\{outPart\}/.test(t) && !(f.inPart && f.outPart)))
      .map((t) => ({ text: fill(t, f), emphasis: [f.noun, 'Free'] }));
    for (let [text, verb, angle, fit] of LIBRARY) {
      if (verb !== f.verb) continue;
      if (fit && !fit.test(f.path)) continue;
      if (angle === 'offline' && !f.offlineOk) continue;
      const low = text.toLowerCase();
      /* two short sentences read best as two lines */
      if (text.length > 26) text = text.replace(/([.;]) (?=\S)/, '$1\n');
      /* every hook carries one word in the accent: a keyword if it has one, else its longest word */
      const acc = HOOK_ACCENT.find((w) => new RegExp('(^|[^a-z])' + w + '([^a-z]|$)').test(low)) ||
        (low.match(/[a-z’']+/g) || []).reduce((b, w) => (w.length > b.length ? w : b), '');
      pool.push({ text, emphasis: acc ? [acc] : [] });
    }
    return pickBy(f.path, pool);
  }
  const textScene = (text, anim, extra) => Object.assign({ id: nid(), type: 'text', text, seconds: secondsFor(text), anim: anim || 'zoom', emphasis: [] }, extra || {});

  /** Scenes for one tool: hook, what it does, in → out, trust, end card. */
  function buildScript(row, brand) {
    const f = factsOf(row);
    brand = brand || {};
    const out = [];
    const hook = hookFor(f);
    out.push(textScene(hook.text, 'zoom', { lines: [{ text: hook.text, size: 9.5, weight: 800, colour: 'text' }], emphasis: hook.emphasis, seconds: Math.max(2.4, secondsFor(hook.text)) }));
    const regionLine = f.region && f.first.toLowerCase().indexOf(f.region.toLowerCase()) < 0 ? '(' + f.region + ')' : '';
    const l2 = [{ text: f.first, size: 6.8, weight: 700, colour: 'text' }];
    if (regionLine) l2.push({ text: regionLine, size: 5, weight: 600, colour: 'muted' });
    out.push(textScene(l2.map((l) => l.text).join('\n'), 'slide', { lines: l2, seconds: secondsFor(f.first) }));
    const trust = [{ text: f.trustLine, size: 6.2, weight: 700, colour: 'text' }, { text: f.sectionLine, size: 4.6, weight: 500, colour: 'muted' }];
    if (f.inPart && f.outPart && f.inPart.toLowerCase() !== f.outPart.toLowerCase()) {
      const l3 = [{ text: f.inPart, size: 7.5, weight: 800, colour: 'text' }, { text: '↓', size: 4.5, weight: 700, colour: 'accent', anim: 'fade' }, { text: f.outPart, size: 7.5, weight: 800, colour: 'accent' }];
      out.push(textScene(l3.map((l) => l.text).join('\n'), 'typewriter', { lines: l3, seconds: r1(secondsFor(f.inPart + ' ' + f.outPart) + 0.5) }));
    }
    out.push(textScene(trust.map((l) => l.text).join('\n'), 'zoom', { lines: trust, seconds: r1(clamp(secondsFor(f.trustLine + ' ' + f.sectionLine), 3, 4.5)) }));
    if (brand.endcard !== false) out.push({ id: nid(), type: 'endcard', title: f.title, seconds: brand.qr === false ? 3.0 : 3.5 });
    return out;
  }
  /** Split a long line at the sentence boundary nearest its middle (else a comma, else a space). */
  function splitLong(line) {
    if (line.length <= 110) return [line];
    const mid = line.length / 2;
    const cands = (re) => { const at = []; let m; re.lastIndex = 0; while ((m = re.exec(line))) at.push(m.index + m[0].length); return at; };
    let at = cands(/[.!?;:]\s+/g);
    if (!at.length) at = cands(/,\s+/g);
    if (!at.length) at = cands(/\s+/g);
    if (!at.length) return [line];
    const cut = at.reduce((b, x) => (Math.abs(x - mid) < Math.abs(b - mid) ? x : b), at[0]);
    return splitLong(line.slice(0, cut).trim()).concat(splitLong(line.slice(cut).trim())).filter(Boolean);
  }
  /** One scene per line. A line made only of #words colours those words in the scene above. */
  function scenesFromScript(text, look) {
    const anim = (look && look.textAnim) || 'zoom';
    const scenes = [];
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (/^#\S+(\s+#\S+)*$/.test(line)) {
        const prev = scenes[scenes.length - 1];
        if (prev) prev.emphasis = (prev.emphasis || []).concat(line.split(/\s+/).map((w) => w.replace(/^#/, '')).filter(Boolean));
        continue;
      }
      for (const part of splitLong(line)) scenes.push(textScene(part, anim));
    }
    scenes.shrunk = fitToMax(scenes);
    return scenes;
  }
  /** Scale scenes down proportionally (never below 1.5 s) when the total is over 90 s. Returns whether it had to. */
  function fitToMax(scenes) {
    const D = timeline(scenes).D;
    if (D <= MAX_SECONDS) return false;
    const k = MAX_SECONDS / D;
    for (const s of scenes) s.seconds = Math.max(1.5, Math.floor(s.seconds * k * 10) / 10);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* caption and hashtags                                               */
  /* ------------------------------------------------------------------ */
  function camelTag(s, max) {
    const words = (String(s || '').replace(/\(.*?\)/g, ' ').match(/[A-Za-z0-9]+/g) || []);
    const t = '#' + words.map((w) => (/^[A-Z0-9]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('');
    return t.length > 1 && t.length <= (max || 25) ? t : '';
  }
  /** 5–8 hashtags: the section's relevant ones (copy-spec §3), the tool's own, then the brand pair. */
  function tagsFor(row) {
    const f = factsOf(row);
    const r = f.row;
    const text = (r.title + ' ' + r.keywords + ' ' + r.description + ' ' + r.io + ' ' + r.section).toLowerCase();
    const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
    const squashed = text.replace(/[^a-z0-9]+/g, '');
    const table = SECTION_TAGS[f.sectionSlug] || [];
    const hit = (tag) => { const b = tag.slice(1).toLowerCase(); return b.length <= 3 ? words.has(b) : squashed.indexOf(b) >= 0; };
    const relevant = table.filter(hit);
    const niche = relevant.slice(0, 4);
    for (const t of table) { if (niche.length >= 3) break; if (niche.indexOf(t) < 0) niche.push(t); }
    const out = [];
    const add = (t) => { if (t && out.length < 8 && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t); };
    niche.forEach(add);
    add(camelTag(f.title, 24));
    const kw = String(r.keywords || '').split('|').map((x) => x.trim()).filter(Boolean)[0];
    if (out.length < 6) add(camelTag(kw, 24));
    const brand = BRAND_TAGS.slice();
    while (out.length > 8 - brand.length) out.pop();
    brand.forEach(add);
    return out;
  }
  /** Hashtags for a visitor's own script: its most frequent long words, plus #Reels. No brand tags of ours on someone else's reel. */
  function scriptTags(text) {
    const count = new Map();
    for (const w of String(text || '').toLowerCase().match(/[a-z][a-z0-9]{4,}/g) || []) { if (!STOP.has(w)) count.set(w, (count.get(w) || 0) + 1); }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([w]) => '#' + w.charAt(0).toUpperCase() + w.slice(1));
    return top.concat(['#Reels']);
  }
  function qrUrlFor(path, source) {
    const f = factsOf({ title: '', path: String(path || '').replace(/^\/+/, '') });
    return SITE + '/' + f.path + '?utm_source=' + encodeURIComponent(source || 'instagram') + '&utm_medium=social&utm_campaign=' + encodeURIComponent(f.sectionSlug) + '&utm_content=' + encodeURIComponent(f.slug);
  }
  /** The Instagram caption (copy-spec "instagram-caption"): hook, what, why, a link-in-bio line, 5–8 hashtags. The share module adds its "Made free, on my device" line. */
  function captionFor(S) {
    S = S || CUR;
    if (!S) return '';
    const firstText = S.scenes.find((s) => s.type === 'text');
    if (S.promote) {
      const f = factsOf(S.promote);
      const hook = oneLine(firstText ? firstText.text : f.title);
      const line3 = pickBy(f.path + '#3', f.offlineOk ? ['Save this for later.', 'Works offline once opened.', 'Send it to someone who needs it.'] : ['Save this for later.', 'Send it to someone who needs it.']);
      return [hook, f.first, f.trustSentence, line3, 'Link in bio → ' + f.url + ' ' + f.emoji, '', tagsFor(S.promote).join(' ')].join('\n');
    }
    const texts = S.scenes.filter((s) => s.type === 'text').map((s) => oneLine(s.text));
    const out = [texts[0] || ''];
    let body = texts.slice(1, 3).join(' ');
    if (body.length > 180) { body = body.slice(0, 180); body = body.slice(0, body.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '.'; }
    if (body) out.push(body);
    if (S.brand.url) out.push('Link in bio → ' + S.brand.url);
    out.push('', scriptTags(texts.join(' ')).join(' '));
    return out.join('\n').trim();
  }

  /* ------------------------------------------------------------------ */
  /* assets: the tool list, the logo, QR codes                          */
  /* ------------------------------------------------------------------ */
  let indexP = null;
  function loadFinderIndex() {
    if (window.FINDER_INDEX && window.FINDER_INDEX.tools) return Promise.resolve(window.FINDER_INDEX);
    if (indexP) return indexP;
    indexP = new Promise((res, rej) => {
      if (!document.querySelector('script[data-reel-index]')) {
        const s = document.createElement('script');
        s.src = '/assets/finder-index.js'; s.async = true; s.dataset.reelIndex = '1';
        document.head.appendChild(s);
      }
      const t0 = performance.now();
      (function wait() {
        if (window.FINDER_INDEX && window.FINDER_INDEX.tools) return res(window.FINDER_INDEX);
        if (performance.now() - t0 > 15000) { indexP = null; return rej(new Error('The tool list could not be loaded — you may be offline.')); }
        setTimeout(wait, 60);
      })();
    });
    return indexP;
  }
  function loadSvgImage(svgText) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image failed')); };
      img.src = url;
    });
  }
  let siteLogoP = null;
  /** The site logo as a 256×256 canvas. The SVG has only a viewBox, which some browsers draw as 0×0, so it gets a size first. */
  function loadSiteLogo() {
    if (siteLogoP) return siteLogoP;
    siteLogoP = fetch('/assets/img/logo.svg').then((r) => { if (!r.ok) throw new Error('logo ' + r.status); return r.text(); }).then((txt) => {
      const sized = txt.replace(/<svg\b([^>]*)>/, (m, attrs) => '<svg' + attrs.replace(/\s(width|height)="[^"]*"/g, '') + ' width="512" height="512">');
      return loadSvgImage(sized);
    }).then((img) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      c.getContext('2d').drawImage(img, 0, 0, 256, 256);
      return c;
    }).catch((e) => { siteLogoP = null; throw e; });
    return siteLogoP;
  }
  const qrCache = new Map();
  /** A QR code of `url` as a canvas: square modules at once, the rounded-eye SVG rendering as soon as it has loaded. */
  function qrEntry(url) {
    if (!url || !window.QR) return null;
    let e = qrCache.get(url);
    if (e) return e;
    let qr;
    try { qr = window.QR.encode(url, 'M'); } catch (err) { return null; }
    const quiet = 2, n = qr.size + quiet * 2, sc = 8;
    const c = document.createElement('canvas'); c.width = c.height = n * sc;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#06080f';
    for (let r = 0; r < qr.size; r++) for (let col = 0; col < qr.size; col++) if (qr.matrix[r][col]) x.fillRect((col + quiet) * sc, (r + quiet) * sc, sc, sc);
    e = { canvas: c, qr, ready: null };
    e.ready = (async () => {
      const svg = window.QR.toSVG(qr, { scale: sc, quiet, dark: '#06080f', light: '#ffffff', eyeFrame: 'rounded', eyeBall: 'rounded' });
      const img = await loadSvgImage(svg);
      const c2 = document.createElement('canvas'); c2.width = c2.height = n * sc;
      c2.getContext('2d').drawImage(img, 0, 0, c2.width, c2.height);
      e.canvas = c2;
      if (API) API.invalidate();
    })().catch(() => { /* the square-module canvas stays */ });
    qrCache.set(url, e);
    return e;
  }
  /** What the QR on the end card carries: the UTM link in promote mode, the visitor's URL otherwise. */
  function qrPayload(S) {
    if (!S.brand.qr) return '';
    if (S.promote) return qrUrlFor(S.promote.path, S.brand.utm || (SIZES[S.sizeKey] || SIZES['1080x1920']).utm);
    const u = String(S.brand.url || '').trim();
    if (!u) return '';
    return /^https?:\/\//i.test(u) ? u : 'https://' + u;
  }

  /* ------------------------------------------------------------------ */
  /* text layout                                                        */
  /* ------------------------------------------------------------------ */
  const MEASURE = document.createElement('canvas').getContext('2d');
  const fontOf = (weight, px, font) => weight + ' ' + px + 'px "' + (font || 'Sora') + '", "Inter", Arial, sans-serif';
  function wrapText(text, px, weight, font, maxW, upper) {
    MEASURE.font = fontOf(weight, px, font);
    const meas = (s) => MEASURE.measureText(upper ? s.toUpperCase() : s).width;
    const out = [];
    for (const para of String(text || '').split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(''); continue; }
      let line = '';
      for (const w of words) {
        const tryL = line ? line + ' ' + w : w;
        if (line && meas(tryL) > maxW) { out.push(line); line = w; } else line = tryL;
      }
      out.push(line);
    }
    let widest = 0;
    for (const l of out) widest = Math.max(widest, meas(l));
    return { lines: out, widest };
  }
  function autoSize(text) {
    const n = String(text || '').length;
    return n <= 24 ? 9 : n <= 48 ? 8 : n <= 90 ? 7 : 6.2;
  }
  /** Which glyphs of the laid-out text are emphasised (whole-word, case-insensitive), in the order the core lays glyphs out (no newlines). */
  function marksFor(text, words) {
    const chars = Array.from(text);
    const lower = chars.map((c) => c.toLowerCase());
    const marks = new Array(chars.length).fill(false);
    for (const w of words || []) {
      const ww = Array.from(String(w || '').toLowerCase().trim());
      if (!ww.length) continue;
      for (let i = 0; i + ww.length <= lower.length; i++) {
        let ok = true;
        for (let j = 0; j < ww.length; j++) { const c = lower[i + j], d = ww[j]; if (c !== d && !(c === '\n' && d === ' ')) { ok = false; break; } }
        if (!ok || isWordChar(lower[i - 1]) || isWordChar(lower[i + ww.length])) continue;
        for (let j = 0; j < ww.length; j++) marks[i + j] = true;
      }
    }
    const out = [];
    chars.forEach((c, i) => { if (c !== '\n') out.push(marks[i]); });
    return out;
  }
  /** Layers for a text scene, wrapped to the safe width and shrunk to the content box. Cached on the scene. */
  function layoutScene(scene, W, H, look) {
    const key = W + 'x' + H + '|' + look.id + '|' + look.font + '|' + look.uppercase + '|' + scene.text + '|' + JSON.stringify(scene.lines || null) + '|' + (scene.emphasis || []).join(',');
    if (scene._lay && scene._lay.key === key) return scene._lay;
    const sf = safeOf(W, H), U = Math.min(W, H);
    const top = sf.box[0] * H, bot = sf.box[1] * H, maxW = sf.maxW * W;
    const specs = scene.lines && scene.lines.length ? scene.lines : [{ text: scene.text, size: autoSize(scene.text), weight: 800, colour: 'text' }];
    let k = 1, blocks = [], total = 0, gap = 0;
    for (let it = 0; it < 16; it++) {
      blocks = specs.map((sp) => {
        const px = Math.max(8, sp.size / 100 * U * k);
        const wr = wrapText(sp.text, px, sp.weight, look.font, maxW, look.uppercase);
        return { sp, px, lines: wr.lines, w: wr.widest, h: wr.lines.length * px * 1.12 };
      });
      gap = blocks.length > 1 ? Math.min(...blocks.map((b) => b.px)) * 0.55 : 0;
      total = blocks.reduce((s, b) => s + b.h, 0) + gap * (blocks.length - 1);
      if (total <= bot - top && blocks.every((b) => b.w <= maxW * 1.001)) break;
      k *= 0.92;
    }
    let y = (top + bot) / 2 - total / 2;
    const items = blocks.map((b) => {
      const cy = y + b.h / 2;
      y += b.h + gap;
      const text = b.lines.join('\n');
      const shown = look.uppercase ? text.toUpperCase() : text;
      const L = { text, x: 0.5, y: cy / H, size: b.px / W * 100, font: look.font, weight: b.sp.weight, uppercase: look.uppercase, align: 'center', lineHeight: 1.12,
        colour: b.sp.colour || 'text', anim: { type: 'none', speed: 1, amplitude: 0, direction: 'left' } };
      return { L, marks: marksFor(shown, scene.emphasis), anim: b.sp.anim || null, chars: Array.from(text.replace(/\n/g, '')).length };
    });
    scene._lay = { key, items };
    return scene._lay;
  }
  /** Map a scene's local time onto the core motion so it plays once, quickly, then holds. */
  function motionTime(anim, local, seconds, chars) {
    switch (anim) {
      case 'zoom': return { type: 'zoom', Dm: 1.3, tm: Math.min(local, 0.78) };
      case 'slide': return { type: 'slide', Dm: 2.0, tm: Math.min(local, 1.0) };
      /* about 14 characters a second, finished within 80% of the scene */
      case 'typewriter': { const Dm = clamp((chars || 20) / 14 / 0.75, 0.4, Math.max(0.4, seconds * 0.8)); return { type: 'typewriter', Dm, tm: Math.min(local, Dm * 0.76) }; }
      case 'fade': return { type: 'fade', Dm: 1.2, tm: Math.min(local, 0.6) };
      default: return { type: 'none', Dm: 1, tm: 0 };
    }
  }
  /** The core's drawText, with a colour per glyph so emphasised words take the accent. */
  function drawRich(ctx, L, tm, Dm, W, H, alpha, marks, look) {
    const lay = A.layout(ctx, L, W);
    const m = A.motion(L, tm, Dm, W, H, lay);
    const a = clamp(alpha * m.alpha, 0, 1);
    if (a <= 0.002 || m.visible <= 0) return;
    const base = L.colour === 'accent' ? look.accent : L.colour === 'muted' ? look.muted : look.text;
    const colourAt = (i) => (marks && marks[i] ? look.accent : base);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(m.cx, m.cy);
    ctx.rotate(m.rot * Math.PI / 180);
    ctx.scale(m.scale, m.scale);
    ctx.font = A.fontString(L, lay.px);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const n = Math.min(lay.n, m.visible);
    const each = (fn) => { for (let i = 0; i < n; i++) { const c = lay.chars[i]; fn(c.ch, c.x, c.y, i); } };
    const glow = (Number(look.textGlow) || 0) / 100 * lay.px;
    if (glow > 0) {
      ctx.shadowBlur = glow; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      each((ch, x, y, i) => { const f = colourAt(i); ctx.shadowColor = f; ctx.fillStyle = f; ctx.fillText(ch, x, y); });
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }
    if (look.shadow > 0) {
      ctx.shadowColor = 'rgba(0,0,0,' + look.shadow + ')'; ctx.shadowBlur = lay.px * 0.1; ctx.shadowOffsetY = lay.px * 0.03; ctx.shadowOffsetX = 0;
      each((ch, x, y, i) => { ctx.fillStyle = colourAt(i); ctx.fillText(ch, x, y); });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    const sw = (Number(look.strokeWidth) || 0) / 100 * lay.px;
    if (sw > 0) { ctx.lineWidth = sw * 2; ctx.strokeStyle = look.stroke || '#000'; each((ch, x, y) => ctx.strokeText(ch, x, y)); }
    each((ch, x, y, i) => { ctx.fillStyle = colourAt(i); ctx.fillText(ch, x, y); });
    ctx.restore();
  }
  /** Lines of plain text, centred at (cx, cy), shrinking to maxW, at most maxLines (the rest is dropped). */
  function drawLines(ctx, text, cx, cy, px, weight, colourStr, maxW, maxLines, font) {
    let wr = wrapText(text, px, weight, font, maxW, false);
    for (let k = 0; k < 6 && (wr.widest > maxW || wr.lines.length > maxLines); k++) { px *= 0.9; wr = wrapText(text, px, weight, font, maxW, false); }
    const lines = wr.lines.slice(0, maxLines);
    const lh = px * 1.15;
    ctx.font = fontOf(weight, px, font);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = colourStr;
    lines.forEach((l, i) => ctx.fillText(l, cx, cy - (lines.length - 1) * lh / 2 + i * lh));
    return { h: lines.length * lh, px, w: wr.widest };
  }
  function measureLines(text, px, weight, maxW, maxLines, font) {
    let wr = wrapText(text, px, weight, font, maxW, false);
    for (let k = 0; k < 6 && (wr.widest > maxW || wr.lines.length > maxLines); k++) { px *= 0.9; wr = wrapText(text, px, weight, font, maxW, false); }
    return Math.min(maxLines, wr.lines.length) * px * 1.15;
  }

  /* ------------------------------------------------------------------ */
  /* the frame                                                          */
  /* ------------------------------------------------------------------ */
  let CUR = null, API = null;
  /** Which scene is on screen at t, and the one fading out under it. */
  function sceneAt(t, S) {
    S = S || CUR;
    if (!S || !S.scenes.length) return null;
    const sc = S.scenes;
    const { starts, D } = timeline(sc);
    if (t >= D) { const i = sc.length - 1; return { i, scene: sc[i], local: sc[i].seconds, prev: null, blend: 1, start: starts[i], starts, D }; }
    let i = 0;
    while (i < sc.length - 1 && t >= starts[i + 1]) i++;
    const local = Math.max(0, t - starts[i]);
    let prev = null, blend = 1;
    if (i > 0 && local < XFADE) { prev = sc[i - 1]; blend = easeOut(local / XFADE); }
    return { i, scene: sc[i], local, prev, blend, start: starts[i], starts, D };
  }
  function drawBackground(ctx, W, H, t, look) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, look.bg[0]); g.addColorStop(1, look.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const R = Math.max(W, H) * 0.6;
    const r = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, R);
    r.addColorStop(0, look.glow); r.addColorStop(1, hexA('#000000', 0));
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    if (look.blobs) {
      const ph = REDUCED ? 0 : 2 * Math.PI * t / 9;
      const U = Math.min(W, H);
      ctx.save();
      for (let b = 0; b < 2; b++) {
        const cx = W * (0.5 + (b ? -0.22 : 0.24) * Math.cos(ph + b * 2.1));
        const cy = H * (0.5 + (b ? 0.12 : -0.1) * Math.sin(ph * 0.8 + b));
        const rr = U * (0.36 + 0.04 * Math.sin(ph + b));
        const bg = ctx.createRadialGradient(cx, cy, 1, cx, cy, rr);
        bg.addColorStop(0, hexA(look.accent, 0.06)); bg.addColorStop(1, hexA(look.accent, 0));
        ctx.fillStyle = bg; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      }
      ctx.restore();
    }
  }
  function drawTextScene(ctx, W, H, scene, local, alpha, look) {
    const lay = layoutScene(scene, W, H, look);
    lay.items.forEach((it, i) => {
      const li = local - i * 0.22;
      if (li < 0) return;
      const mt = motionTime(it.anim || scene.anim, li, scene.seconds, it.chars);
      it.L.anim.type = mt.type;
      drawRich(ctx, it.L, mt.tm, mt.Dm, W, H, alpha, it.marks, look);
    });
  }
  /** The rectangle media and its caption share: inside the safe area, the caption below. */
  function mediaRegion(W, H, hasCaption) {
    const sf = safeOf(W, H);
    /* clear of the brand strip above and the progress bar below */
    const top = (sf.top + 0.045) * H, bot = (1 - sf.bottom - (hasCaption ? 0.11 : 0.025)) * H;
    return { top, bot, capY: bot + 0.05 * H };
  }
  function drawCover(ctx, src, sw, sh, x, y, w, h, kb) {
    const s = Math.max(w / sw, h / sh) * kb;
    const dw = sw * s, dh = sh * s;
    ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function drawMedia(ctx, W, H, scene, local, alpha, look, S) {
    const m = scene.media;
    if (!m) return;
    const src = m.kind === 'video' ? m.video : m.canvas;
    const ready = !!src && (m.kind !== 'video' || src.readyState >= 2);
    const sw = m.width || 1, sh = m.height || 1;
    const U = Math.min(W, H);
    const capText = String(scene.text || '').trim();
    const showCap = !!capText && S.captions.source !== 'none' && !(S.captions.source === 'auto' && activeCue(S, S._t));
    const reg = mediaRegion(W, H, !!capText && S.captions.source !== 'none');
    const kb = scene.motion ? 1 + 0.06 * clamp(local / Math.max(0.1, scene.seconds), 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (scene.fit === 'cover') {
      if (ready) drawCover(ctx, src, sw, sh, 0, 0, W, H, kb);
      const shade = ctx.createLinearGradient(0, H * 0.6, 0, H);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = shade; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    } else if (scene.fit === 'phone') {
      const maxH = reg.bot - reg.top;
      let ph = Math.min(maxH, H * 0.8), pw = ph * 9 / 19.5;
      if (pw > W * 0.62) { pw = W * 0.62; ph = pw * 19.5 / 9; }
      const x = (W - pw) / 2, y = reg.top + (maxH - ph) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = W * 0.05; ctx.shadowOffsetY = W * 0.012;
      ctx.fillStyle = '#0b0f19'; roundRect(ctx, x, y, pw, ph, pw * 0.12); ctx.fill();
      ctx.restore();
      ctx.lineWidth = Math.max(2, U * 0.002); ctx.strokeStyle = hexA(look.muted, 0.5);
      roundRect(ctx, x, y, pw, ph, pw * 0.12); ctx.stroke();
      const ins = pw * 0.035;
      ctx.save();
      roundRect(ctx, x + ins, y + ins, pw - ins * 2, ph - ins * 2, pw * 0.09); ctx.clip();
      ctx.fillStyle = '#000'; ctx.fillRect(x + ins, y + ins, pw - ins * 2, ph - ins * 2);
      if (ready) drawCover(ctx, src, sw, sh, x + ins, y + ins, pw - ins * 2, ph - ins * 2, kb);
      ctx.restore();
      ctx.fillStyle = '#000'; roundRect(ctx, x + pw / 2 - pw * 0.14, y + ins + pw * 0.02, pw * 0.28, pw * 0.06, pw * 0.03); ctx.fill();
    } else {
      const maxW = W * 0.88, maxH = reg.bot - reg.top;
      let s = Math.min(maxW / sw, maxH / sh);
      const cw = sw * s, ch = sh * s;
      const x = (W - cw) / 2, y = reg.top + (maxH - ch) / 2;
      const rad = 36 * U / 1080;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = W * 0.06; ctx.shadowOffsetY = W * 0.012;
      ctx.fillStyle = look.light ? '#ffffff' : '#0b0f19'; roundRect(ctx, x, y, cw, ch, rad); ctx.fill();
      ctx.restore();
      ctx.save();
      roundRect(ctx, x, y, cw, ch, rad); ctx.clip();
      if (ready) drawCover(ctx, src, sw, sh, x, y, cw, ch, kb);
      ctx.restore();
    }
    if (showCap) {
      const px = 0.046 * U;
      const maxW = W * safeOf(W, H).maxW;
      const h = measureLines(capText, px, 700, maxW - px, 2, look.font);
      const capY = scene.fit === 'cover' ? (1 - safeOf(W, H).bottom) * H - h / 2 - 0.03 * H : reg.capY;
      ctx.fillStyle = look.plate;
      MEASURE.font = fontOf(700, px, look.font);
      const wr = wrapText(capText, px, 700, look.font, maxW - px, false);
      const bw = Math.min(maxW, wr.widest + px * 1.2);
      roundRect(ctx, W / 2 - bw / 2, capY - h / 2 - px * 0.35, bw, h + px * 0.7, px * 0.45); ctx.fill();
      drawLines(ctx, capText, W / 2, capY, px, 700, look.plateText, maxW - px, 2, look.font);
    }
    ctx.restore();
  }
  /** The end card: logo, title, the readable URL, a QR code, "Link in bio", the handle — stacked in the safe area. */
  function drawEndCard(ctx, W, H, scene, local, alpha, look, S) {
    const a = clamp(alpha, 0, 1) * clamp(local / 0.4, 0, 1);
    if (a <= 0.002) return;
    const sf = safeOf(W, H), U = Math.min(W, H);
    const landscape = W > H * 1.3;
    const logo = S.brand.logo;
    const title = String(scene.title || '').trim();
    const url = String(S.brand.url || '').trim();
    const handle = String(S.brand.handle || '').trim();
    const qrUrl = qrPayload(S);
    const qe = qrUrl ? qrEntry(qrUrl) : null;
    const cta = url ? 'Link in bio' : '';
    const font = look.font;
    const pop = easeOut(clamp(local / 0.5, 0, 1));
    ctx.save();
    ctx.globalAlpha = a;
    const colW = landscape ? W * 0.5 : W * sf.maxW;
    const items = [];
    if (logo) items.push({ kind: 'logo', h: U * (landscape ? 0.2 : 0.2) });
    if (title) items.push({ kind: 'title', px: U * 0.066, h: measureLines(title, U * 0.066, 800, colW, 2, font) });
    if (url) items.push({ kind: 'url', px: U * 0.042, h: measureLines(url, U * 0.042, 700, colW, 1, font) });
    if (qe && !landscape) items.push({ kind: 'qr', h: U * 0.34 });
    if (cta) items.push({ kind: 'cta', px: U * 0.04, h: U * 0.04 * 1.15 });
    if (handle) items.push({ kind: 'handle', px: U * 0.036, h: U * 0.036 * 1.15 });
    const gap = U * 0.035;
    const regTop = (sf.top + 0.02) * H, regBot = (1 - sf.bottom - 0.02) * H;
    let total = items.reduce((s, it) => s + it.h, 0) + gap * Math.max(0, items.length - 1);
    const k = total > regBot - regTop ? (regBot - regTop) / total : 1;
    total *= k;
    const cx = landscape ? W * 0.36 : W / 2;
    let y = (regTop + regBot) / 2 - total / 2;
    const drawQr = (qx, qy, size) => {
      const pad = size * 0.06;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = size * 0.08; ctx.shadowOffsetY = size * 0.02;
      ctx.fillStyle = '#ffffff'; roundRect(ctx, qx - size / 2 - pad, qy - size / 2 - pad, size + pad * 2, size + pad * 2, size * 0.08); ctx.fill();
      ctx.restore();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qe.canvas, qx - size / 2, qy - size / 2, size, size);
      ctx.imageSmoothingEnabled = true;
    };
    for (const it of items) {
      const h = it.h * k, mid = y + h / 2;
      if (it.kind === 'logo') {
        const s = h * (0.6 + 0.4 * pop);
        if (look.light) { ctx.fillStyle = '#0b0f19'; roundRect(ctx, cx - s / 2 - s * 0.08, mid - s / 2 - s * 0.08, s * 1.16, s * 1.16, s * 0.24); ctx.fill(); }
        ctx.drawImage(logo, cx - s / 2, mid - s / 2, s, s);
      } else if (it.kind === 'title') drawLines(ctx, title, cx, mid, it.px * k, 800, look.text, colW, 2, font);
      else if (it.kind === 'url') drawLines(ctx, url, cx, mid, it.px * k, 700, look.accent, colW, 1, font);
      else if (it.kind === 'qr') drawQr(cx, mid, h);
      else if (it.kind === 'cta') drawLines(ctx, cta, cx, mid, it.px * k, 600, look.muted, colW, 1, font);
      else if (it.kind === 'handle') drawLines(ctx, handle, cx, mid, it.px * k, 600, look.text, colW, 1, font);
      y += h + gap * k;
    }
    if (qe && landscape) drawQr(W * 0.74, H * 0.5, Math.min(H * 0.42, W * 0.3));
    ctx.restore();
  }
  function drawBrand(ctx, W, H, look, S) {
    const logo = S.brand.logo, handle = String(S.brand.handle || '').trim();
    if (!logo && !handle) return;
    const sf = safeOf(W, H), U = Math.min(W, H);
    const s = U * 0.05;
    const x = W * 0.07, y = (sf.top + 0.01) * H;
    ctx.save();
    let tx = x;
    if (logo) {
      if (look.light) { ctx.fillStyle = '#0b0f19'; roundRect(ctx, x - s * 0.1, y - s * 0.1, s * 1.2, s * 1.2, s * 0.28); ctx.fill(); }
      ctx.drawImage(logo, x, y, s, s);
      tx = x + s * 1.3;
    }
    if (handle) {
      ctx.font = fontOf(600, U * 0.034, look.font);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (!look.light) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = U * 0.008; }
      ctx.fillStyle = look.text;
      ctx.fillText(handle, tx, y + s / 2);
    }
    ctx.restore();
  }
  function drawBar(ctx, W, H, t, D, look) {
    const sf = safeOf(W, H), U = Math.min(W, H);
    const h = Math.max(3, 6 * U / 1080);
    const y = (1 - sf.bottom) * H - 10 * U / 1080 - h;
    const x = W * 0.07, w = W * 0.86;
    ctx.save();
    ctx.fillStyle = hexA(look.muted, 0.25); roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    const f = clamp(D > 0 ? t / D : 0, 0, 1);
    if (f > 0) { ctx.fillStyle = hexA(look.bar, 0.9); roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill(); }
    ctx.restore();
  }
  function activeCue(S, t) {
    for (const c of S.captions.cues) if (t >= c.start && t < c.until) return c;
    return null;
  }
  /**
   * THE frame at time t on a W×H context. o: { progress: false to leave the
   * bar out (covers), credit: false to leave the credit to the caller (the
   * scaled preview draws it at its own size) }.
   */
  function renderFrame(ctx, W, H, t, S, o) {
    S = S || CUR;
    o = o || {};
    if (!S) return;
    const look = S.look;
    S._t = t;
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    drawBackground(ctx, W, H, t, look);
    const at = sceneAt(t, S);
    if (at) {
      const draw = (scene, local, alpha) => {
        if (scene.type === 'text') drawTextScene(ctx, W, H, scene, local, alpha, look);
        else if (scene.type === 'media') drawMedia(ctx, W, H, scene, local, alpha, look, S);
        else if (scene.type === 'endcard') drawEndCard(ctx, W, H, scene, local, alpha, look, S);
      };
      if (at.prev) draw(at.prev, at.prev.seconds, 1 - at.blend);
      const fadeUp = at.i === 0 ? clamp(t / 0.3, 0, 1) : 1;
      draw(at.scene, at.local, at.blend * fadeUp);
      const onEnd = at.scene.type === 'endcard';
      if (S.captions.source === 'auto' && S.captions.cues.length && !onEnd) {
        const AC = A.tools['auto-captions'];
        const U = Math.min(W, H);
        const st = Object.assign({}, S.captions.style, { size: (Number(S.captions.style.size) || 7) * U / W });
        if (AC) AC.drawCaptions(ctx, W, H, t, S.captions.cues, st);
      }
      if (S.brand.progress && o.progress !== false) drawBar(ctx, W, H, t, at.D, look);
      if (!onEnd || at.prev) {
        ctx.save(); ctx.globalAlpha = onEnd ? 1 - at.blend : 1; drawBrand(ctx, W, H, look, S); ctx.restore();
      }
    }
    ctx.restore();
    if (o.credit !== false && A.share) A.share.drawCredit(ctx, W, H);
  }

  /* ------------------------------------------------------------------ */
  /* sound                                                              */
  /* ------------------------------------------------------------------ */
  /** Peak of every channel, for the auto-normalise. */
  function peakOf(buffer) {
    let p = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > p) p = v; } }
    return p;
  }
  /**
   * The reel's sound: voice (normalised, faded at the cut), each clip's own
   * sound where asked for, and music that fades in, fades out and ducks
   * 12 dB under speech — all in one OfflineAudioContext at 48 kHz stereo.
   * Resolves null when there is nothing to hear.
   */
  async function mixAudio(S) {
    S = S || CUR;
    const scenes = S.scenes;
    const { starts, D } = timeline(scenes);
    const media = scenes.map((sc, i) => ({ sc, start: starts[i] })).filter((x) => x.sc.type === 'media' && x.sc.sound && x.sc.media && x.sc.media.audioBuffer);
    if ((!S.voice && !S.music && !media.length) || D <= 0.05) return null;
    const n = Math.max(1, Math.ceil(D * SR));
    const octx = new OfflineAudioContext(2, n, SR);
    const speech = new Uint8Array(Math.max(2, Math.ceil(D * 100)));
    if (S.voice) {
      const v = S.voice;
      const when = Math.max(0, v.offset), from = Math.max(0, -v.offset);
      const dur = Math.min(v.duration - from, D - when);
      if (dur > 0.02) {
        const src = octx.createBufferSource(); src.buffer = v.audioBuffer;
        const norm = Math.min(4, 0.7 / Math.max(1e-4, v.peak || 1));
        const g1 = octx.createGain(); g1.gain.value = norm * dB(v.gainDb || 0);
        const g2 = octx.createGain();
        g2.gain.setValueAtTime(0, when); g2.gain.linearRampToValueAtTime(1, when + 0.01);
        g2.gain.setValueAtTime(1, Math.max(when + 0.01, when + dur - 0.06)); g2.gain.linearRampToValueAtTime(0, when + dur);
        src.connect(g1); g1.connect(g2); g2.connect(octx.destination);
        src.start(when, from, dur);
        /* the speech envelope: 50 ms RMS windows of the 16 kHz mono copy */
        const smp = v.samples, WIN = 800;
        const rms = new Float32Array(Math.ceil(smp.length / WIN));
        for (let w = 0; w < rms.length; w++) { let s = 0; const a = w * WIN, b = Math.min(smp.length, a + WIN); for (let i = a; i < b; i++) s += smp[i] * smp[i]; rms[w] = Math.sqrt(s / Math.max(1, b - a)) * norm; }
        for (let k = 0; k < speech.length; k++) {
          const vt = k / 100 - v.offset;
          if (vt < 0 || vt >= v.duration || k / 100 >= when + dur) continue;
          if (rms[Math.floor(vt * 16000 / WIN)] > 0.02) speech[k] = 1;
        }
      }
    }
    for (const x of media) {
      const sc = x.sc, ab = sc.media.audioBuffer;
      const from = clamp(Number(sc.start) || 0, 0, Math.max(0, ab.duration - 0.05));
      const dur = Math.min(sc.seconds, ab.duration - from, D - x.start);
      if (dur <= 0.02) continue;
      const src = octx.createBufferSource(); src.buffer = ab; src.connect(octx.destination);
      src.start(x.start, from, dur);
      for (let k = Math.floor(x.start * 100); k < Math.min(speech.length, Math.ceil((x.start + dur) * 100)); k++) speech[k] = 1;
    }
    if (S.music) {
      const mu = S.music;
      const src = octx.createBufferSource(); src.buffer = mu.audioBuffer;
      if (mu.loop) { src.loop = true; src.loopStart = 0; src.loopEnd = mu.audioBuffer.duration; }
      const g = octx.createGain();
      const g0 = dB(mu.gainDb);
      const duck = mu.duck && (S.voice || media.length);
      const len = speech.length;
      const curve = new Float32Array(len);
      const down = (g0 - g0 * 0.25) / 12, up = (g0 - g0 * 0.25) / 40;   /* 120 ms attack, 400 ms release at 100 Hz */
      let cur = g0;
      for (let k = 0; k < len; k++) {
        const target = duck && speech[k] ? g0 * 0.25 : g0;
        if (cur > target) cur = Math.max(target, cur - down); else if (cur < target) cur = Math.min(target, cur + up);
        const tt = k / 100;
        curve[k] = cur * Math.min(1, tt / 0.5) * clamp((D - tt) / 1.2, 0, 1);
      }
      g.gain.setValueCurveAtTime(curve, 0, D);
      src.connect(g); g.connect(octx.destination);
      if (mu.loop) src.start(0, 0); else src.start(0, 0, Math.min(mu.audioBuffer.duration, D));
      if (mu.loop) src.stop(D);
    }
    const out = await octx.startRendering();
    const p = peakOf(out);
    if (p > 0.98) { const k = 0.98 / p; for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
    return out;
  }
  /** 16-bit PCM WAV, interleaved, for browsers that record the picture without its sound. */
  function encodeWAV(buffer) {
    const ch = buffer.numberOfChannels, len = buffer.length, rate = buffer.sampleRate;
    const bytes = 44 + len * ch * 2;
    const dv = new DataView(new ArrayBuffer(bytes));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, len * ch * 2, true);
    const planes = []; for (let c = 0; c < ch; c++) planes.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = clamp(planes[c][i], -1, 1); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([dv.buffer], { type: 'audio/wav' });
  }

  /* ------------------------------------------------------------------ */
  /* captions from the voice                                            */
  /* ------------------------------------------------------------------ */
  /** Hold a cue on screen through a short gap so single words do not flicker (Auto Captions' withHold, which it does not export). */
  function hold(cues) {
    for (let i = 0; i < cues.length; i++) {
      const nx = cues[i + 1];
      const u = nx ? Math.min(cues[i].end + 0.35, nx.start) : cues[i].end + 0.35;
      cues[i].until = Math.max(u, cues[i].end);
    }
    return cues;
  }
  /** Whisper's segments (voice time) → cues in reel time. */
  function cuesFor(S) {
    const AC = A.tools['auto-captions'];
    if (!AC || !S.voice) return [];
    const o = S.voice.offset, D = totalSeconds(S);
    const segs = S.captions.segments.map((s) => {
      const words = (s.words || []).map((w) => ({ text: w.text, start: w.start + o, end: Math.min(D, w.end + o) })).filter((w) => w.start < D && w.end > w.start);
      return { start: s.start + o, end: Math.min(D, s.end + o), text: s.text, words };
    }).filter((s) => s.words.length);
    const mode = S.captions.style.mode;
    return hold(mode === 'line' ? AC.fileCues(segs) : AC.wordCues(segs, Number(mode) || 2));
  }

  /* ------------------------------------------------------------------ */
  /* media during an export                                             */
  /* ------------------------------------------------------------------ */
  function seekTo(video, want) {
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; video.removeEventListener('seeked', fin); setTimeout(res, 0); };
      video.addEventListener('seeked', fin);
      try { video.currentTime = want; } catch (e) { fin(); }
      setTimeout(fin, 2000);
    });
  }
  /** Put every visible clip on the frame time t needs (the outgoing one too, during a transition). */
  async function prepareMedia(S, t) {
    const at = sceneAt(t, S);
    if (!at) return;
    const list = [[at.scene, at.local]];
    if (at.prev) list.push([at.prev, at.prev.seconds]);
    for (const [sc, local] of list) {
      if (!isVideoScene(sc) || !sc.media.video) continue;
      const v = sc.media.video;
      const want = clamp((Number(sc.start) || 0) + local, 0, Math.max(0, (sc.media.duration || 0) - 0.04));
      if (Math.abs(v.currentTime - want) > 0.5 / FPS || v.readyState < 2) await seekTo(v, want);
    }
  }
  /** Real-time recording (no WebCodecs): play each clip while its scene is on. */
  function liveMedia(S, t) {
    const at = sceneAt(t, S);
    for (const sc of S.scenes) {
      if (!isVideoScene(sc) || !sc.media.video) continue;
      const v = sc.media.video;
      const on = at && (at.scene === sc || at.prev === sc);
      if (on && v.paused) { try { v.currentTime = (Number(sc.start) || 0) + (at.scene === sc ? at.local : sc.seconds); } catch (e) { /* */ } v.play().catch(() => {}); }
      else if (!on && !v.paused) v.pause();
    }
  }
  function pauseAll(S) { for (const sc of S.scenes) if (isVideoScene(sc) && sc.media.video) { try { sc.media.video.pause(); } catch (e) { /* */ } } }
  async function* framesOf(S, w, h, D, signal) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const total = Math.max(1, Math.round(D * FPS));
    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) throw abortError();
      const t = i / FPS;
      await prepareMedia(S, t);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      renderFrame(ctx, w, h, t, S);
      yield { canvas: c, timestampUs: Math.round(i * 1e6 / FPS), durationUs: Math.round(1e6 / FPS) };
    }
  }
  async function prepareFonts(S) {
    if (document.fonts && document.fonts.load) {
      await Promise.all(['800 40px "Sora"', '700 40px "Sora"', '600 20px "Sora"', '500 20px "Sora"', '500 20px "Inter"'].map((f) => document.fonts.load(f).catch(() => {})));
    }
    const fonts = new Set();
    for (const sc of S.scenes) for (const l of (sc.lines || [{ weight: 800 }])) fonts.add(l.weight || 800);
    await Promise.all([...fonts].map((wgt) => A.ensureFont({ font: S.look.font, weight: wgt })));
    const c = document.createElement('canvas'); c.width = 2; c.height = 2;
    try { renderFrame(c.getContext('2d'), 1080, 1920, 0, S, { credit: false }); } catch (e) { /* warm-up only */ }
  }
  async function prepareAssets(S) {
    if (S.brand.logoKind === 'site' && !S.brand.logo) { try { S.brand.logo = await loadSiteLogo(); } catch (e) { /* no logo then */ } }
    const q = qrPayload(S);
    if (q) { const e = qrEntry(q); if (e && e.ready) await e.ready; }
    for (const sc of S.scenes) {
      if (isVideoScene(sc) && sc.media.video && sc.media.video.readyState < 2) {
        await new Promise((res) => { const v = sc.media.video; const fin = () => { v.removeEventListener('loadeddata', fin); res(); }; v.addEventListener('loadeddata', fin); setTimeout(fin, 3000); });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const Wh = window.AIVidWhisper;
    const share = A.share;
    if (!share) throw new Error('aiimg-share.js did not load');
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      mode: 'script', promote: null, slug: 'reel', scenes: [],
      look: lookCopy(LOOKS[0]),
      brand: { handle: '', url: '', endcard: true, qr: false, progress: true, safe: true, logo: null, logoKind: 'none', utm: 'instagram' },
      voice: null, music: null,
      captions: { source: 'scene', chosen: false, segments: [], cues: [], status: 'idle',
        style: { preset: 'karaoke', mode: '2', position: 'bottom', size: 7, font: 'Sora', fill: '#ffffff', accent: '#f7c948', stroke: '#000000', box: '#0b1020', uppercase: false } },
      mixP: null, sizeKey: '1080x1920', size: { w: 1080, h: 1920 }, quality: 'standard',
      t: 0, playing: false, live: -1, coverT: null, job: null, capJob: null, busy: false,
      batchRows: null, picked: new Map(), index: null, fitVoice: false, previewSound: true, actx: null, src: null, results: []
    };
    CUR = S;

    /* ---------------- helpers ---------------- */
    const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
    const grid = (...f) => { const g = el('div', 'aiimg-grid2'); g.append(...f); return g; };
    const h = (t, id) => { const p = el('p', 'aiimg-h', t); if (id) { p.id = id; p.tabIndex = -1; } return p; };
    const row = (...k) => { const r = el('div', 'aiimg-row'); r.append(...k); return r; };
    const hint = (t) => el('p', 'field-hint', t);
    const hiddenFile = (id, accept, label) => { const f = el('input', 'visually-hidden'); f.type = 'file'; f.id = id; f.accept = accept; f.setAttribute('aria-label', label); return f; };
    function makeTabs(items, onPick, key) {
      const bar = el('div', 'aiimg-tabs'); bar.setAttribute('role', 'tablist');
      const btns = {};
      for (const [k, label] of items) {
        const b = button(label, 'chip', () => onPick(k));
        b.dataset[key] = k; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
        b.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const keys = items.map((x) => x[0]);
          const i = (keys.indexOf(k) + (e.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
          onPick(keys[i]); btns[keys[i]].focus();
        });
        btns[k] = b; bar.appendChild(b);
      }
      return { bar, btns, set(k) { for (const x in btns) { const onIt = x === k; btns[x].classList.toggle('is-on', onIt); btns[x].setAttribute('aria-selected', onIt ? 'true' : 'false'); btns[x].tabIndex = onIt ? 0 : -1; } } };
    }

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aivid reel');
    const start = el('div', 'reel-start');
    const modeTabs = makeTabs([['script', 'Write my own script'], ['promote', 'Promote a 1234Tools tool']], (k) => setMode(k), 'mode');
    const scriptPane = el('div', 'reel-mode'); scriptPane.dataset.mode = 'script'; scriptPane.setAttribute('role', 'tabpanel');
    const scriptBox = el('textarea', 'control'); scriptBox.id = 'reel-script'; scriptBox.rows = 7;
    scriptBox.placeholder = 'One scene per line, for example:\n\n' + EXAMPLE;
    const makeBtn = button('Make my reel', 'btn-primary', () => makeFromScript());
    const exampleBtn = button('Try an example', 'btn-ghost', () => { scriptBox.value = EXAMPLE; scriptBox.focus(); });
    scriptPane.append(field('Your script', scriptBox, 'One line is one scene. #word on a line of its own colours that word in the scene above.'), row(makeBtn, exampleBtn));
    const promotePane = el('div', 'reel-mode'); promotePane.dataset.mode = 'promote'; promotePane.hidden = true; promotePane.setAttribute('role', 'tabpanel');
    const picker = el('div', 'reel-picker');
    const find = el('input', 'control'); find.id = 'reel-find'; find.type = 'search'; find.placeholder = 'Search the tools…'; find.autocomplete = 'off';
    find.setAttribute('role', 'combobox'); find.setAttribute('aria-controls', 'reel-tools'); find.setAttribute('aria-expanded', 'true');
    const filterRow = el('div', 'reel-filter'); filterRow.setAttribute('role', 'group'); filterRow.setAttribute('aria-label', 'Filter by section');
    const toolList = el('ul', 'reel-tools'); toolList.id = 'reel-tools'; toolList.setAttribute('role', 'listbox'); toolList.setAttribute('aria-label', 'Tools');
    const pickStatus = el('p', 'aiimg-status', 'Loading the tool list…');
    const batchBtn = button('Make 2 reels', 'btn-primary', () => openBatch()); batchBtn.id = 'reel-batch'; batchBtn.disabled = true;
    const clearBtn = button('Clear', 'btn-ghost', () => { S.picked.clear(); renderPicker(); });
    const pickFoot = el('div', 'aiimg-row reel-picker-foot'); pickFoot.append(batchBtn, clearBtn, hint('Click a tool to make its reel; tick several to make one reel each.'));
    picker.append(field('Find a tool', find), filterRow, pickStatus, toolList, pickFoot);
    promotePane.appendChild(picker);
    start.append(modeTabs.bar, scriptPane, promotePane);

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const frame = el('div', 'reel-frame');
    const canvas = el('canvas', 'aiimg-canvas reel-canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Preview of the reel; Space plays and pauses, Left and Right arrows move one second, Shift for five');
    const safe = el('div', 'reel-safe'); safe.setAttribute('aria-hidden', 'true');
    const safeTop = el('div', 'reel-safe-band is-top'); safeTop.appendChild(el('span', null, 'covered by app UI'));
    const safeBot = el('div', 'reel-safe-band is-bottom'); safeBot.appendChild(el('span', null, 'covered by app UI'));
    safe.append(safeTop, safeBot);
    frame.append(canvas, safe);
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true; stageMsg.setAttribute('aria-live', 'polite');
    stage.append(frame, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const playBtn = button('▶ Play', 'btn-ghost', () => togglePlay()); playBtn.setAttribute('aria-pressed', 'false');
    const scrub = el('input', 'range'); scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.step = 1; scrub.value = 0; scrub.setAttribute('aria-label', 'Position in the reel');
    const clockEl = el('span', 'range-val', '0.0 / 0.0 s');
    const overBtn = button('Start over', 'btn-ghost', () => startOver());
    transport.append(playBtn, scrub, clockEl, overBtn);
    stageCol.append(stage, transport);
    const side = el('div', 'aiimg-side');
    const panes = {};
    const PANES = [['scenes', 'Scenes'], ['media', 'Media'], ['sound', 'Sound'], ['captions', 'Captions'], ['brand', 'Brand'], ['export', 'Export']];
    const paneTabs = makeTabs(PANES, (k) => showPane(k), 'pane');
    side.appendChild(paneTabs.bar);
    for (const [k] of PANES) {
      const p = el('div', 'aiimg-pane'); p.dataset.pane = k; p.hidden = true; p.setAttribute('role', 'tabpanel'); p.id = 'reel-pane-' + k;
      paneTabs.btns[k].setAttribute('aria-controls', p.id);
      panes[k] = p; side.appendChild(p);
    }
    studio.append(stageCol, side);
    const msg = el('div', 'io-msg'); msg.setAttribute('aria-live', 'polite');
    const hiddenMedia = el('div', 'reel-hidden-media'); hiddenMedia.setAttribute('aria-hidden', 'true');
    wrap.append(start, studio, msg, hiddenMedia);
    io.appendChild(wrap);

    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function note(text) { stageMsg.textContent = text || ''; stageMsg.hidden = !text; }
    function showPane(k) { paneTabs.set(k); for (const p in panes) panes[p].hidden = p !== k; if (k === 'export') refreshCaptionPreview(); }
    function setMode(k) {
      S.modeTab = k; modeTabs.set(k);
      scriptPane.hidden = k !== 'script'; promotePane.hidden = k !== 'promote';
      if (k === 'promote') ensureIndex();
    }

    /* ---------------- preview ---------------- */
    const pctx = canvas.getContext('2d');
    let dirty = true;
    const invalidate = () => { dirty = true; };
    function sizePreview() {
      const { w, h: hh } = S.size;
      const s = PREVIEW_MAX / Math.max(w, hh);
      canvas.width = Math.max(2, Math.round(w * s)); canvas.height = Math.max(2, Math.round(hh * s));
      const sf = safeOf(w, hh);
      safeTop.style.height = (sf.top * 100) + '%'; safeBot.style.height = (sf.bottom * 100) + '%';
      safe.hidden = !S.brand.safe;
      invalidate();
    }
    function draw() {
      const { w, h: hh } = S.size;
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!S.scenes.length) { dirty = false; return; }
      pctx.save();
      pctx.scale(canvas.width / w, canvas.height / hh);
      renderFrame(pctx, w, hh, S.t, S, { credit: false });
      pctx.restore();
      share.drawCredit(pctx, canvas.width, canvas.height);
      dirty = false;
    }
    let mounted = true, t0 = 0;
    function loop() {
      if (!mounted) return;
      if (S.playing) {
        const D = totalSeconds(S);
        S.t = (performance.now() - t0) / 1000;
        if (S.t >= D) { S.t = D; setPlaying(false); }
        syncTransport();
        dirty = true;
      }
      syncPreviewMedia();
      if (dirty && !S.exporting) draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    function syncTransport() {
      const D = totalSeconds(S);
      scrub.value = D ? Math.round(S.t / D * 1000) : 0;
      clockEl.textContent = S.t.toFixed(1) + ' / ' + D.toFixed(1) + ' s';
      scrub.setAttribute('aria-valuetext', S.t.toFixed(1) + ' of ' + D.toFixed(1) + ' seconds');
      markLive();
    }
    let lastSeek = 0;
    function syncPreviewMedia() {
      if (S.exporting) return;
      const at = sceneAt(S.t, S);
      for (const sc of S.scenes) {
        if (!isVideoScene(sc) || !sc.media.video) continue;
        const v = sc.media.video;
        const active = at && (at.scene === sc || at.prev === sc);
        const want = clamp((Number(sc.start) || 0) + (at && at.scene === sc ? at.local : sc.seconds), 0, Math.max(0, (sc.media.duration || 0) - 0.04));
        if (S.playing && active && at.scene === sc) {
          if (v.paused) { try { v.currentTime = want; } catch (e) { /* */ } v.play().catch(() => {}); }
          else if (Math.abs(v.currentTime - want) > 0.3) { try { v.currentTime = want; } catch (e) { /* */ } }
          dirty = true;
        } else {
          if (!v.paused) v.pause();
          if (active && Math.abs(v.currentTime - want) > 0.05 && !v.seeking && performance.now() - lastSeek > 60) { lastSeek = performance.now(); try { v.currentTime = want; } catch (e) { /* */ } }
        }
      }
    }
    async function togglePlay() {
      if (S.exporting || !S.scenes.length) return;
      if (S.playing) { setPlaying(false); return; }
      if (S.t >= totalSeconds(S) - 0.02) S.t = 0;
      if (S.previewSound && (S.voice || S.music || S.scenes.some((x) => x.sound))) {
        try {
          if (!S.actx) S.actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
          S.actx.resume();
        } catch (e) { S.actx = null; }
      }
      setPlaying(true);
    }
    function setPlaying(v) {
      S.playing = v;
      playBtn.textContent = v ? '❚❚ Pause' : '▶ Play';
      playBtn.setAttribute('aria-pressed', v ? 'true' : 'false');
      if (v) {
        t0 = performance.now() - S.t * 1000;
        startPreviewSound();
      } else {
        stopPreviewSound();
        pauseAll(S);
        invalidate();
      }
    }
    function stopPreviewSound() { if (S.src) { try { S.src.stop(); } catch (e) { /* */ } S.src = null; } }
    async function startPreviewSound() {
      stopPreviewSound();
      if (!S.previewSound || !S.actx) return;
      const buf = await getMix();
      if (!buf || !S.playing || !S.actx) return;
      const src = S.actx.createBufferSource(); src.buffer = buf; src.connect(S.actx.destination);
      const at = Math.max(0, (performance.now() - t0) / 1000);
      if (at >= buf.duration) return;
      src.start(0, at);
      stopPreviewSound();
      S.src = src;
    }
    function getMix() {
      if (!S.mixP) S.mixP = mixAudio(S).catch((e) => { console.error(e); return null; });
      return S.mixP;
    }
    function soundDirty() { S.mixP = null; if (S.playing) startPreviewSound(); updateSoundStatus(); }
    scrub.addEventListener('input', () => {
      if (S.exporting) return;
      if (S.playing) setPlaying(false);
      S.t = Number(scrub.value) / 1000 * totalSeconds(S);
      syncTransport(); invalidate();
    });
    canvas.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (S.playing) setPlaying(false);
        S.t = clamp(S.t + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1), 0, totalSeconds(S));
        syncTransport(); invalidate();
      }
    });
    function seekTo2(t) { if (S.playing) setPlaying(false); S.t = clamp(t, 0, totalSeconds(S)); syncTransport(); invalidate(); }

    /* ---------------- scenes pane ---------------- */
    const chosen = el('div', 'reel-chosen'); chosen.hidden = true;
    const totalEl = el('p', 'aiimg-status'); totalEl.id = 'reel-total'; totalEl.setAttribute('aria-live', 'polite');
    const undoRow = el('div', 'aiimg-row reel-undo'); undoRow.hidden = true;
    const fitChk = on(check('reel-fit', 'Fit scenes to the voice', false), () => { S.fitVoice = fitChk.input.checked; applyFit(); });
    fitChk.hidden = true;
    const sceneList = el('ol', 'reel-scenes');
    const addText = button('+ Text scene', 'btn-ghost', () => addScene(textScene('New scene', S.look.textAnim)));
    const addMedia = button('+ Media scene', 'btn-ghost', () => { showPane('media'); mediaFile.click(); });
    const addEnd = button('+ End card', 'btn-ghost', () => { if (!S.scenes.some((x) => x.type === 'endcard')) addScene({ id: nid(), type: 'endcard', title: S.promote ? S.promote.title : '', seconds: S.brand.qr ? 3.5 : 3.0 }, true); });
    panes.scenes.append(h('Scenes', 'reel-scenes-h'), chosen, totalEl, undoRow, fitChk, sceneList, row(addText, addMedia, addEnd),
      hint('Click a scene to jump to it. Each scene fades into the next over a third of a second.'));

    function renderChosen() {
      chosen.innerHTML = '';
      chosen.hidden = !S.promote;
      if (!S.promote) return;
      const r = S.promote;
      const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ic.setAttribute('class', 'ico'); ic.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '/assets/icons.svg#' + r.glyph); ic.appendChild(use);
      const txt = el('div', 'reel-chosen-text'); txt.append(el('strong', null, r.title), el('small', null, r.section + (r.io ? ' · ' + r.io : '')));
      const change = button('Change tool', 'btn-ghost', () => { startOver(); setMode('promote'); find.focus(); });
      const rewrite = button('Rewrite script', 'btn-ghost', () => {
        if (!confirm('Write the script for ' + r.title + ' again? Your edits to the scenes will be lost.')) return;
        usePromote(r, true);
      });
      chosen.append(ic, txt, change, rewrite);
    }
    function updateTotal() {
      const D = totalSeconds(S);
      const n = S.scenes.length;
      if (D > MAX_SECONDS) { totalEl.textContent = n + ' scenes · ' + D.toFixed(1) + ' s — over 90 s: Reels are cut at 90 s; shorten a scene'; totalEl.className = 'aiimg-status is-warn'; }
      else { totalEl.textContent = n + ' scene' + (n === 1 ? '' : 's') + ' · ' + D.toFixed(1) + ' s'; totalEl.className = 'aiimg-status'; }
      addEnd.disabled = S.scenes.some((x) => x.type === 'endcard');
      syncTransport();
    }
    function scenesChanged(structural) {
      S.scenes.forEach((x) => { x._lay = null; });
      if (structural) renderScenes();
      updateTotal();
      if (S.voice) { S.captions.cues = cuesFor(S); updateCapStatusTail(); }
      soundDirty();
      invalidate();
      refreshCaptionPreview();
    }
    function addScene(sc, atEnd) {
      const endAt = S.scenes.findIndex((x) => x.type === 'endcard');
      let at;
      if (atEnd || sc.type === 'endcard') at = S.scenes.length;
      else if (S.live >= 0 && S.live < S.scenes.length && S.scenes[S.live].type !== 'endcard') at = S.live + 1;
      else at = endAt >= 0 ? endAt : S.scenes.length;
      S.scenes.splice(at, 0, sc);
      scenesChanged(true);
      selectScene(at);
      return at;
    }
    function selectScene(i) {
      const { starts } = timeline(S.scenes);
      if (i < 0 || i >= S.scenes.length) return;
      seekTo2(starts[i] + Math.min(0.6, S.scenes[i].seconds * 0.6));
      S.live = -2; markLive();
      renderMediaCtl();
    }
    function markLive() {
      const at = sceneAt(S.t, S);
      const live = at ? at.i : -1;
      if (live === S.live) return;
      S.live = live;
      for (const li of sceneList.children) {
        const onIt = li.dataset.id === (S.scenes[live] && S.scenes[live].id);
        li.classList.toggle('is-live', onIt);
        if (onIt) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current');
      }
      renderMediaCtl();
      highlightPrompter();
    }
    let undoTimer = 0;
    function offerUndo(sc, idx) {
      undoRow.innerHTML = '';
      const u = button('Undo', 'chip', () => { S.scenes.splice(Math.min(idx, S.scenes.length), 0, sc); undoRow.hidden = true; scenesChanged(true); });
      undoRow.append(el('span', 'aiimg-status', 'Scene deleted.'), u);
      undoRow.hidden = false;
      clearTimeout(undoTimer);
      undoTimer = setTimeout(() => { undoRow.hidden = true; if (sc.media && sc.media.url && S.scenes.indexOf(sc) < 0) { URL.revokeObjectURL(sc.media.url); if (sc.media.video) sc.media.video.remove(); } }, 6000);
    }
    function renderScenes() {
      sceneList.innerHTML = '';
      S.scenes.forEach((sc, i) => {
        const li = el('li', 'reel-scene'); li.dataset.id = sc.id; li.dataset.type = sc.type;
        const head = el('div', 'reel-scene-head');
        const badge = el('span', 'reel-badge', String(i + 1));
        const kind = el('span', 'reel-kind', sc.type === 'text' ? 'Text' : sc.type === 'media' ? (sc.media && sc.media.kind === 'video' ? 'Clip' : 'Picture') : 'End card');
        const secs = el('input', 'control reel-secs'); secs.type = 'number'; secs.min = 1; secs.max = 15; secs.step = 0.5; secs.value = sc.seconds;
        secs.setAttribute('aria-label', 'Seconds for scene ' + (i + 1));
        secs.addEventListener('change', () => {
          sc.seconds = r1(clamp(Number(secs.value) || sc.seconds, 1, 15)); secs.value = sc.seconds; sc.base = sc.seconds;
          if (S.fitVoice) { S.fitVoice = false; fitChk.input.checked = false; for (const x of S.scenes) x.base = x.seconds; }
          scenesChanged(false);
        });
        const unit = el('span', 'reel-unit', 's');
        const mv = (d) => { const j = i + d; if (j < 0 || j >= S.scenes.length) return; const [x] = S.scenes.splice(i, 1); S.scenes.splice(j, 0, x); scenesChanged(true); selectScene(j); };
        const upB = button('↑', 'btn-ghost', () => mv(-1)); upB.setAttribute('aria-label', 'Move up'); upB.disabled = i === 0;
        const dnB = button('↓', 'btn-ghost', () => mv(1)); dnB.setAttribute('aria-label', 'Move down'); dnB.disabled = i === S.scenes.length - 1;
        const dup = button('⧉', 'btn-ghost', () => { const c = Object.assign({}, sc, { id: nid(), _lay: null, lines: sc.lines ? sc.lines.map((l) => Object.assign({}, l)) : sc.lines, emphasis: (sc.emphasis || []).slice() }); S.scenes.splice(i + 1, 0, c); scenesChanged(true); selectScene(i + 1); });
        dup.setAttribute('aria-label', 'Duplicate'); dup.disabled = sc.type === 'endcard';
        const del = button('✕', 'btn-ghost', () => { const [x] = S.scenes.splice(i, 1); scenesChanged(true); offerUndo(x, i); });
        del.setAttribute('aria-label', 'Delete scene ' + (i + 1));
        head.append(badge, kind, secs, unit, upB, dnB, dup, del);
        li.appendChild(head);
        const ta = el('textarea', 'control reel-scene-text');
        ta.rows = sc.type === 'text' ? 2 : 1;
        ta.value = sc.type === 'endcard' ? (sc.title || '') : (sc.text || '');
        ta.placeholder = sc.type === 'media' ? 'Optional caption line' : sc.type === 'endcard' ? 'Title on the end card' : 'Scene text';
        ta.setAttribute('aria-label', (sc.type === 'endcard' ? 'End card title' : sc.type === 'media' ? 'Caption for scene ' : 'Text of scene ') + (sc.type === 'endcard' ? '' : (i + 1)));
        ta.addEventListener('input', () => {
          if (sc.type === 'endcard') sc.title = ta.value;
          else { sc.text = ta.value; if (sc.lines) sc.lines = null; }
          sc._lay = null;
          refreshCaptionPreview();
          invalidate();
        });
        ta.addEventListener('focus', () => { if (S.live !== i) selectScene(i); });
        li.appendChild(ta);
        if (sc.type === 'text') {
          const an = select('reel-anim-' + sc.id, ANIMS, sc.anim);
          an.setAttribute('aria-label', 'Animation for scene ' + (i + 1));
          an.addEventListener('change', () => { sc.anim = an.value; invalidate(); });
          li.appendChild(an);
        } else if (sc.type === 'media') {
          li.appendChild(el('small', 'reel-media-name', (sc.media ? sc.media.name : '') + ' · ' + (FITS.find((x) => x[0] === sc.fit) || FITS[0])[1].split(' —')[0]));
        }
        li.addEventListener('click', (e) => { if (e.target.closest('button, input, select, textarea')) return; selectScene(i); });
        sceneList.appendChild(li);
      });
      S.live = -2; markLive();
    }

    /* ---------------- media pane ---------------- */
    const drop = el('div', 'dropzone'); drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Add pictures or clips</strong><span>Nothing is uploaded. JPG, PNG, WebP, MP4, MOV, WebM; up to 10 files, 200 MB each.</span>';
    const mediaFile = hiddenFile('reel-media-file', 'image/*,video/*', 'Add pictures or clips'); mediaFile.multiple = true;
    const recStrip = el('div', 'reel-rec'); recStrip.hidden = true;
    const recDot = el('i', 'reel-rec-dot'); const recClock = el('span', 'reel-rec-clock', '0:00');
    const recStop = button('Stop recording', 'btn-ghost', () => stopScreen());
    recStrip.append(recDot, el('span', null, 'Recording your screen'), recClock, recStop);
    const canScreen = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !PHONE;
    const screenBtn = button('Record my screen', 'btn-ghost', () => recordScreen()); screenBtn.hidden = !canScreen;
    const mediaCtl = el('div', 'reel-media-ctl');
    panes.media.append(drop, mediaFile, row(screenBtn), recStrip, h('This scene'), mediaCtl,
      hint(canScreen ? 'Record my screen asks your browser which tab, window or screen to share; nothing starts until you choose.' : 'Phones do not offer screen capture to web pages: record with the phone’s own screen recorder and add the file here.'));
    drop.addEventListener('click', () => mediaFile.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mediaFile.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) addMediaFiles(e.dataTransfer.files); });
    mediaFile.addEventListener('change', () => { if (mediaFile.files.length) addMediaFiles(Array.from(mediaFile.files)); mediaFile.value = ''; });

    function renderMediaCtl() {
      mediaCtl.innerHTML = '';
      const sc = S.scenes[S.live];
      if (!sc || sc.type !== 'media') { mediaCtl.appendChild(hint('Pick a picture or clip scene in Scenes (or add one above) to set how it is shown.')); return; }
      const m = sc.media;
      mediaCtl.appendChild(el('p', 'aiimg-status', m.name + ' · ' + m.width + '×' + m.height + (m.kind === 'video' ? ' · ' + fmtSec(m.duration) : '')));
      const fitSel = select('reel-fit-mode', FITS, sc.fit);
      fitSel.addEventListener('change', () => { sc.fit = fitSel.value; renderScenes(); invalidate(); });
      mediaCtl.appendChild(field('Show it as', fitSel));
      if (m.kind === 'video') {
        const mx = Math.max(0, (m.duration || 0) - 1);
        const st = range('reel-media-start', 0, r1(mx), 0.1, clamp(sc.start || 0, 0, mx), (v) => v.toFixed(1) + ' s');
        on(st, () => { sc.start = Number(st.input.value); invalidate(); soundDirty(); });
        mediaCtl.appendChild(field('Start at', st));
        const snd = on(check('reel-media-sound', 'Use the clip’s own sound', !!sc.sound), async () => {
          sc.sound = snd.input.checked;
          if (sc.sound && !m.audioBuffer) await decodeClipSound(sc, snd.input);
          soundDirty();
        });
        mediaCtl.appendChild(snd);
      }
      const mo = on(check('reel-media-motion', 'Slow zoom', !!sc.motion), () => { sc.motion = mo.input.checked; invalidate(); });
      mediaCtl.appendChild(mo);
    }
    async function decodeClipSound(sc, box) {
      try { const a = await Wh.decodeAudio(sc.media.file, { sampleRate: SR }); sc.media.audioBuffer = a.audioBuffer; }
      catch (e) { sc.sound = false; if (box) box.checked = false; say('That clip has no sound track the browser can read, so it stays silent.', 'warn'); }
    }
    function videoMeta(v) {
      return new Promise((res) => {
        const fail = () => res(false);
        v.addEventListener('error', fail, { once: true });
        v.addEventListener('loadedmetadata', async () => {
          if (!isFinite(v.duration)) {
            /* a recorded WebM has no duration header until the end has been seen */
            await new Promise((r2) => { const d = () => { if (isFinite(v.duration)) { v.removeEventListener('durationchange', d); r2(); } }; v.addEventListener('durationchange', d); try { v.currentTime = 1e9; } catch (e) { r2(); } setTimeout(r2, 4000); });
            try { v.currentTime = 0; } catch (e) { /* */ }
          }
          res(true);
        }, { once: true });
        setTimeout(() => res(v.readyState >= 1), 10000);
      });
    }
    async function addMediaFiles(files, extra) {
      const list = Array.from(files || []);
      let added = 0, firstAt = -1;
      for (const f of list) {
        const count = S.scenes.filter((x) => x.type === 'media').length;
        if (count >= MAX_MEDIA) { say('Ten pictures or clips per reel — everything is held in your browser’s memory.', 'warn'); break; }
        const isVideo = /^video\//.test(f.type) || /\.(mp4|m4v|mov|webm|mkv|ogv)$/i.test(f.name || '');
        const isImage = /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name || '');
        if (!isVideo && !isImage) { say(f.name + ' is not a picture or a video.', 'warn'); continue; }
        if (isVideo && f.size > MAX_VIDEO_BYTES) { say(f.name + ' is over 200 MB. Trim it first — the whole clip is held in memory.', 'warn'); continue; }
        if (isImage && f.size > MAX_IMAGE_BYTES) { say(f.name + ' is over 40 MB.', 'warn'); continue; }
        try {
          let media;
          const name = String(f.name || (isVideo ? 'clip' : 'picture'));
          if (isImage) {
            const im = await A.loadImageFile(f);
            let c = im.canvas;
            const s = Math.min(1, MEDIA_MAX_EDGE / Math.max(c.width, c.height));
            if (s < 1) c = A.scaled(c, c.width * s, c.height * s);
            media = { kind: 'image', name, file: f, canvas: c, width: c.width, height: c.height, duration: 0 };
          } else {
            const url = URL.createObjectURL(f);
            const v = el('video', 'aivid-video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
            hiddenMedia.appendChild(v);
            const ok = await videoMeta(v);
            if (!ok || !v.videoWidth) { URL.revokeObjectURL(url); v.remove(); say(name + ' could not be opened as a video in this browser.', 'warn'); continue; }
            v.addEventListener('seeked', invalidate); v.addEventListener('loadeddata', invalidate);
            media = { kind: 'video', name, file: f, url, video: v, width: v.videoWidth, height: v.videoHeight, duration: isFinite(v.duration) ? v.duration : (extra && extra.duration) || 5 };
          }
          const sc = { id: nid(), type: 'media', media, fit: media.width / media.height < 0.7 ? 'phone' : 'card', start: 0, sound: false, motion: media.kind === 'image', text: '',
            seconds: media.kind === 'video' ? r1(clamp(media.duration, 1, 15)) : 3 };
          if (extra && extra.fit) sc.fit = extra.fit;
          const at = addScene(sc);
          if (firstAt < 0) firstAt = at;
          if (extra && extra.sound) { sc.sound = true; await decodeClipSound(sc); soundDirty(); }
          added++;
        } catch (e) { say((e && e.message) || String(e), 'error'); }
      }
      if (added) { selectScene(firstAt); say(''); }
    }

    /* screen recording */
    let screen = null;
    async function recordScreen() {
      if (screen) return;
      let stream;
      try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true }); }
      catch (e) { if (e && e.name === 'NotAllowedError') say('Screen recording was cancelled or not allowed.', 'warn'); else say((e && e.message) || String(e), 'error'); return; }
      const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mime = types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
      let rec;
      try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : { videoBitsPerSecond: 8e6 }); }
      catch (e) { stream.getTracks().forEach((t) => t.stop()); say((e && e.message) || String(e), 'error'); return; }
      const chunks = [];
      const hasAudio = stream.getAudioTracks().length > 0;
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const began = performance.now();
      screen = { stream, rec, timer: 0 };
      rec.onstop = async () => {
        clearInterval(screen.timer);
        stream.getTracks().forEach((t) => t.stop());
        recStrip.hidden = true; screenBtn.disabled = false; screenBtn.setAttribute('aria-pressed', 'false');
        const secs = (performance.now() - began) / 1000;
        screen = null;
        const blob = new Blob(chunks, { type: 'video/webm' });
        if (blob.size < 1000) { say('The screen recording was empty.', 'warn'); return; }
        const file = new File([blob], 'screen-recording.webm', { type: 'video/webm' });
        await addMediaFiles([file], { fit: 'card', sound: hasAudio, duration: secs });
      };
      stream.getVideoTracks()[0].addEventListener('ended', () => stopScreen());
      rec.start(500);
      recStrip.hidden = false; screenBtn.disabled = true; screenBtn.setAttribute('aria-pressed', 'true');
      screen.timer = setInterval(() => {
        const s = (performance.now() - began) / 1000;
        recClock.textContent = Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
        if (s >= MAX_SECONDS) stopScreen();
      }, 250);
    }
    function stopScreen() { if (screen && screen.rec.state !== 'inactive') screen.rec.stop(); }

    /* ---------------- sound pane ---------------- */
    const recVoiceBtn = button('● Record voice', 'btn-primary', () => toggleMic()); recVoiceBtn.id = 'reel-rec-voice'; recVoiceBtn.setAttribute('aria-pressed', 'false');
    const voiceFile = hiddenFile('reel-voice-file', 'audio/*,video/*', 'Upload a voice file');
    const upVoiceBtn = button('Upload voice', 'btn-ghost', () => voiceFile.click());
    const level = el('div', 'reel-level'); level.setAttribute('aria-hidden', 'true'); const levelBar = el('i'); level.appendChild(levelBar); level.hidden = true;
    const prompter = el('ol', 'reel-prompter'); prompter.hidden = true; prompter.setAttribute('aria-label', 'Teleprompter');
    const voiceInfo = el('div', 'aiimg-row reel-voice-info'); voiceInfo.hidden = true;
    const voiceOffset = range('reel-voice-offset', -2, 5, 0.1, 0.3, (v) => v.toFixed(1) + ' s');
    const voiceGain = range('reel-voice-gain', -12, 12, 1, 0, (v) => (v > 0 ? '+' : '') + v + ' dB');
    const voiceCtl = el('div', 'reel-voice-ctl'); voiceCtl.hidden = true;
    voiceCtl.append(grid(field('Starts at', voiceOffset), field('Volume', voiceGain)));
    on(voiceOffset, () => { if (!S.voice) return; S.voice.offset = Number(voiceOffset.input.value); applyFit(); S.captions.cues = cuesFor(S); updateCapStatusTail(); soundDirty(); invalidate(); });
    on(voiceGain, () => { if (!S.voice) return; S.voice.gainDb = Number(voiceGain.input.value); soundDirty(); });
    const musicFile = hiddenFile('reel-music-file', 'audio/*', 'Upload music');
    const upMusicBtn = button('Upload music', 'btn-ghost', () => musicFile.click());
    const musicInfo = el('div', 'aiimg-row reel-voice-info'); musicInfo.hidden = true;
    const musicGain = range('reel-music-gain', -30, 0, 1, -8, (v) => v + ' dB');
    const duckChk = check('reel-duck', 'Duck under speech', true);
    const loopChk = check('reel-loop', 'Loop if shorter than the reel', true);
    const musicCtl = el('div', 'reel-music-ctl'); musicCtl.hidden = true;
    musicCtl.append(field('Music volume', musicGain), duckChk, loopChk);
    on(musicGain, () => { if (!S.music) return; S.music.gainDb = Number(musicGain.input.value); S.music.touched = true; soundDirty(); });
    on(duckChk, () => { if (S.music) { S.music.duck = duckChk.input.checked; soundDirty(); } });
    on(loopChk, () => { if (S.music) { S.music.loop = loopChk.input.checked; soundDirty(); } });
    const prevSoundChk = on(check('reel-preview-sound', 'Play the sound with the preview', true), () => { S.previewSound = prevSoundChk.input.checked; if (!S.previewSound) stopPreviewSound(); else if (S.playing) startPreviewSound(); });
    const soundStatus = el('p', 'aiimg-status'); soundStatus.id = 'reel-sound-status'; soundStatus.setAttribute('aria-live', 'polite');
    panes.sound.append(h('Voiceover'), row(recVoiceBtn, upVoiceBtn), voiceFile, level, prompter, voiceInfo, voiceCtl,
      hint('Recording asks for the microphone only when you press the button. The script is shown as a teleprompter while you read.'),
      h('Music'), row(upMusicBtn), musicFile, musicInfo, musicCtl, hint('Use a track you have the rights to; the file never leaves your device.'),
      prevSoundChk, soundStatus);
    voiceFile.addEventListener('change', () => { const f = voiceFile.files[0]; voiceFile.value = ''; if (f) setVoice(f); });
    musicFile.addEventListener('change', () => { const f = musicFile.files[0]; musicFile.value = ''; if (f) setMusic(f); });

    function updateSoundStatus() {
      const parts = [];
      const D = totalSeconds(S);
      if (S.voice) parts.push('Voice ' + S.voice.duration.toFixed(1) + ' s from ' + S.voice.offset.toFixed(1) + ' s');
      if (S.music) parts.push('music ' + S.music.gainDb + ' dB' + (S.music.duck && S.voice ? ', ducked' : '') + (S.music.loop ? ', looped' : ''));
      const clips = S.scenes.filter((x) => x.type === 'media' && x.sound).length;
      if (clips) parts.push(clips + ' clip' + (clips === 1 ? '' : 's') + ' with their own sound');
      soundStatus.textContent = parts.length ? capFirst(parts.join(' · ')) + ' · reel ' + D.toFixed(1) + ' s' : 'No sound yet — the reel will be silent unless you add a voice or music.';
      fitChk.hidden = !S.voice;
    }
    function infoRow(rowEl, name, dur, onRemove) {
      rowEl.innerHTML = '';
      rowEl.append(el('span', 'reel-file-name', name + ' · ' + fmtSec(dur)), button('Remove', 'btn-ghost', onRemove));
      rowEl.hidden = false;
    }
    async function cutTo(dec, secs) {
      const ab = dec.audioBuffer;
      const len = Math.floor(secs * ab.sampleRate);
      const out = new AudioBuffer({ length: len, numberOfChannels: ab.numberOfChannels, sampleRate: ab.sampleRate });
      for (let c = 0; c < ab.numberOfChannels; c++) out.copyToChannel(ab.getChannelData(c).subarray(0, len), c);
      return { samples: dec.samples.subarray(0, Math.floor(secs * 16000)), duration: secs, audioBuffer: out };
    }
    async function setVoice(file) {
      say('');
      soundStatus.textContent = 'Reading ' + (file.name || 'the recording') + '…';
      let dec;
      try { dec = await Wh.decodeAudio(file, { sampleRate: SR }); }
      catch (e) { say((e && e.message) || String(e), 'error'); updateSoundStatus(); return; }
      if (dec.duration > MAX_VOICE_SECONDS) { dec = await cutTo(dec, MAX_VOICE_SECONDS); say('Voice recordings are cut at 90 s, the Reels limit.', 'warn'); }
      if (S.capJob) S.capJob.abort();
      S.captions.segments = []; S.captions.cues = []; S.captions.status = 'idle'; renderSegs();
      S.voice = { file, name: file.name || 'voice', duration: dec.duration, audioBuffer: dec.audioBuffer, samples: dec.samples, offset: Number(voiceOffset.input.value), gainDb: Number(voiceGain.input.value), peak: peakOf(dec.audioBuffer) };
      infoRow(voiceInfo, S.voice.name, S.voice.duration, removeVoice);
      voiceCtl.hidden = false;
      if (S.music && !S.music.touched) { S.music.gainDb = -16; musicGain.set(-16); }
      if (!S.captions.chosen || S.captions.source === 'scene') setCapSource('auto', false);
      applyFit();
      soundDirty();
      if (S.captions.source === 'auto') transcribeVoice();
    }
    function removeVoice() {
      if (S.capJob) S.capJob.abort();
      S.voice = null; voiceInfo.hidden = true; voiceCtl.hidden = true;
      S.captions.segments = []; S.captions.cues = []; renderSegs();
      if (S.captions.source === 'auto') setCapSource('scene', false);
      capStatus.textContent = 'Record or upload a voice to get captions from it.';
      if (S.fitVoice) { fitChk.input.checked = false; S.fitVoice = false; applyFit(); }
      if (S.music && !S.music.touched) { S.music.gainDb = -8; musicGain.set(-8); }
      soundDirty(); invalidate();
    }
    async function setMusic(file) {
      soundStatus.textContent = 'Reading ' + (file.name || 'the music') + '…';
      let dec;
      try { dec = await Wh.decodeAudio(file, { sampleRate: SR }); }
      catch (e) { say((e && e.message) || String(e), 'error'); updateSoundStatus(); return; }
      const g = S.voice ? -16 : -8;
      S.music = { file, name: file.name || 'music', duration: dec.duration, audioBuffer: dec.audioBuffer, gainDb: g, duck: duckChk.input.checked, loop: loopChk.input.checked, touched: false };
      musicGain.set(g);
      infoRow(musicInfo, S.music.name, S.music.duration, () => { S.music = null; musicInfo.hidden = true; musicCtl.hidden = true; soundDirty(); });
      musicCtl.hidden = false;
      soundDirty();
    }
    /** Fit scenes to the voice: scale text and media scenes to the voice's length (each 1–15 s); the end card keeps its own. */
    function applyFit() {
      /* `base` is the length the visitor chose; fitting scales from it, unticking goes back to it */
      for (const sc of S.scenes) if (sc.base === undefined) sc.base = sc.seconds;
      if (S.fitVoice && S.voice) {
        const body = S.scenes.filter((x) => x.type !== 'endcard');
        const sum = body.reduce((s, x) => s + x.base, 0);
        const want = S.voice.duration + Math.max(0, S.voice.offset) + 0.3;
        if (sum > 0) for (const x of body) x.seconds = r1(clamp(x.base * want / sum, 1, 15));
      } else {
        for (const sc of S.scenes) sc.seconds = sc.base;
      }
      renderScenes();
      scenesChanged(false);
    }

    /* microphone */
    let mic = null;
    async function toggleMic() {
      if (mic) { stopMic(); return; }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (e) {
        if (e && e.name === 'NotAllowedError') say('Microphone access was refused — upload a voice file instead.', 'warn');
        else if (e && e.name === 'NotFoundError') say('No microphone found.', 'warn');
        else say((e && e.message) || String(e), 'error');
        return;
      }
      const types = ['audio/webm;codecs=opus', 'audio/mp4'];
      const mime = types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      let actx = null, an = null, timer = 0;
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        an = actx.createAnalyser(); an.fftSize = 1024;
        actx.createMediaStreamSource(stream).connect(an);
      } catch (e) { an = null; }
      const began = performance.now();
      mic = { stream, rec, actx, began };
      rec.onstop = async () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        if (actx) { try { actx.close(); } catch (e) { /* */ } }
        level.hidden = true; prompter.hidden = true;
        recVoiceBtn.textContent = '● Record voice'; recVoiceBtn.setAttribute('aria-pressed', 'false');
        mic = null;
        const type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
        const blob = new Blob(chunks, { type });
        if (blob.size < 500) { say('Nothing was recorded.', 'warn'); updateSoundStatus(); return; }
        await setVoice(new File([blob], 'voice-recording.' + (/mp4/.test(type) ? 'm4a' : 'webm'), { type }));
      };
      rec.start(250);
      recVoiceBtn.textContent = '■ Stop'; recVoiceBtn.setAttribute('aria-pressed', 'true');
      level.hidden = !an;
      renderPrompter(); prompter.hidden = false;
      const buf = an ? new Float32Array(an.fftSize) : null;
      timer = setInterval(() => {
        const s = (performance.now() - began) / 1000;
        soundStatus.textContent = 'Recording — ' + Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
        if (an) { an.getFloatTimeDomainData(buf); let p = 0; for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i])); levelBar.style.width = Math.round(clamp(p * 140, 0, 100)) + '%'; }
        highlightPrompter(s);
        if (s >= MAX_VOICE_SECONDS) stopMic();
      }, 50);
    }
    function stopMic() { if (mic && mic.rec.state !== 'inactive') mic.rec.stop(); }
    function renderPrompter() {
      prompter.innerHTML = '';
      S.scenes.forEach((sc) => { if (sc.type === 'endcard') return; const li = el('li', null, oneLine(sc.type === 'text' ? sc.text : sc.text || '(' + (sc.media ? sc.media.name : 'picture') + ')')); li.dataset.id = sc.id; prompter.appendChild(li); });
    }
    function highlightPrompter(s) {
      if (prompter.hidden) return;
      const t = s === undefined ? S.t : s - (S.voice ? 0 : 0.3);
      const at = sceneAt(Math.max(0, t), S);
      for (const li of prompter.children) {
        const now = at && li.dataset.id === at.scene.id;
        li.classList.toggle('is-now', !!now);
        if (now && li.scrollIntoView && s !== undefined) li.scrollIntoView({ block: 'nearest' });
      }
    }

    /* ---------------- captions pane ---------------- */
    const capSource = select('reel-cap-source', [['auto', 'From the voiceover (Whisper, on this device)'], ['scene', 'The scene text, timed to the scene'], ['none', 'No captions']], 'scene');
    const capHint = hint('First use downloads Whisper tiny (41 MB) from this site; it is kept for next time. English speech in this version.');
    const capProgress = el('div', 'aiimg-progress'); const capBar = el('i'); capProgress.appendChild(capBar); capProgress.hidden = true;
    const capStatus = el('p', 'aiimg-status', 'Record or upload a voice to get captions from it.'); capStatus.id = 'reel-cap-status'; capStatus.setAttribute('aria-live', 'polite');
    const againBtn = button('Transcribe again', 'btn-ghost', () => transcribeVoice()); againBtn.hidden = true;
    const segList = el('div', 'aivid-segs');
    const swatches = el('div', 'aivid-swatches');
    const swatchBtns = {};
    for (const [k, label, desc] of CAP_STYLES) {
      const b = button('', 'aivid-swatch', () => { S.captions.style.preset = k; syncSwatches(); invalidate(); });
      b.dataset.preset = k; b.title = desc;
      const sample = el('span', 'aivid-sample is-' + k);
      sample.innerHTML = k === 'karaoke' ? '<em>Word by</em> word' : k === 'pop' ? 'Word <em>by</em> word' : 'Word by word';
      b.append(sample, el('span', 'aivid-swatch-name', label));
      swatches.appendChild(b); swatchBtns[k] = b;
    }
    function syncSwatches() { for (const k in swatchBtns) { const onIt = k === S.captions.style.preset; swatchBtns[k].classList.toggle('is-on', onIt); swatchBtns[k].setAttribute('aria-pressed', onIt ? 'true' : 'false'); } }
    const st = S.captions.style;
    const capMode = on(select('reel-cap-mode', [['1', '1 word'], ['2', '2 words'], ['3', '3 words'], ['line', 'Whole line']], st.mode), () => { st.mode = capMode.value; S.captions.cues = cuesFor(S); invalidate(); });
    const capPos = on(select('reel-cap-pos', [['bottom', 'Bottom (safe)'], ['middle', 'Middle']], st.position), () => { st.position = capPos.value; invalidate(); });
    const capSize = on(range('reel-cap-size', 5, 10, 0.5, st.size, (v) => v.toFixed(1) + '%'), () => { st.size = Number(capSize.input.value); invalidate(); });
    const capFill = on(colour('reel-cap-fill', st.fill), () => { st.fill = capFill.value; invalidate(); });
    const capAccent = on(colour('reel-cap-accent', st.accent), () => { st.accent = capAccent.value; invalidate(); });
    const capStroke = on(colour('reel-cap-stroke', st.stroke), () => { st.stroke = capStroke.value; invalidate(); });
    const capUpper = on(check('reel-cap-upper', 'UPPERCASE', st.uppercase), () => { st.uppercase = capUpper.input.checked; invalidate(); });
    panes.captions.append(field('Captions', capSource), capHint, capProgress, capStatus, row(againBtn), segList,
      h('Caption style'), swatches, grid(field('Words on screen', capMode), field('Position', capPos)), field('Size', capSize, 'As a share of the frame width.'),
      grid(field('Text', capFill), field('Highlight', capAccent)), grid(field('Outline', capStroke), capUpper));
    syncSwatches();
    capSource.addEventListener('change', () => setCapSource(capSource.value, true));
    function setCapSource(v, byUser) {
      if (byUser) S.captions.chosen = true;
      if (v === 'auto' && !S.voice) { capStatus.textContent = 'Record or upload a voice first — the scene text is used until then.'; v = 'scene'; }
      S.captions.source = v; capSource.value = v;
      if (byUser && v === 'auto' && S.voice && !S.captions.segments.length && !S.capJob) transcribeVoice();
      invalidate();
    }
    function fmtLoad(p) { return p.stage === 'compile' ? 'Starting the speech model…' : 'Downloading the speech model — ' + Math.round((p.loaded || 0) / 1048576) + ' of ' + Math.round((p.total || 0) / 1048576) + ' MB'; }
    async function transcribeVoice() {
      if (!S.voice || !Wh) return;
      if (S.capJob) S.capJob.abort();
      const job = S.capJob = new AbortController();
      const voice = S.voice;
      S.captions.status = 'loading';
      capProgress.hidden = false; capBar.style.width = '0%'; againBtn.hidden = true;
      capStatus.textContent = 'Getting the speech model ready…';
      try {
        const res = await Wh.transcribe(voice.samples, {
          signal: job.signal,
          onLoad: (p) => { if (p.stage === 'ready') return; capBar.style.width = Math.round((p.fraction || 0) * 100) + '%'; capStatus.textContent = fmtLoad(p); },
          onProgress: (p) => {
            S.captions.status = 'running';
            capBar.style.width = Math.round((p.fraction || 0) * 100) + '%';
            capStatus.textContent = 'Listening… ' + Math.round((p.fraction || 0) * 100) + '%' + (p.eta !== null && p.eta !== undefined ? ' · about ' + fmtSec(Math.max(1, p.eta)) + ' left' : '');
          }
        });
        if (job !== S.capJob || voice !== S.voice) return;
        S.captions.segments = res.segments.map((s) => ({ start: s.start, end: s.end, text: s.text, words: s.words.map((w) => ({ text: w.text, start: w.start, end: w.end })) }));
        S.captions.cues = cuesFor(S);
        renderSegs();
        const words = S.captions.segments.reduce((n, s) => n + s.words.length, 0);
        if (!words) {
          S.captions.status = 'empty';
          capStatus.textContent = 'No speech was found in the recording, so captions are off. The on-screen text stays.';
          setCapSource('scene', false);
        } else {
          S.captions.status = 'ready';
          capStatus.dataset.base = words + ' words transcribed';
          updateCapStatusTail();
        }
        againBtn.hidden = false;
      } catch (e) {
        if (job !== S.capJob) return;
        if (e && e.name === 'AbortError') capStatus.textContent = 'Cancelled.';
        else { S.captions.status = 'failed'; capStatus.textContent = 'Transcription failed.'; say((e && e.message) || String(e), 'error'); setCapSource('scene', false); }
        againBtn.hidden = false;
      } finally {
        if (job === S.capJob) S.capJob = null;
        setTimeout(() => { capProgress.hidden = true; }, 500);
        invalidate();
      }
    }
    function updateCapStatusTail() {
      if (S.captions.status !== 'ready' || !S.voice) return;
      const D = totalSeconds(S);
      const over = S.voice.duration + S.voice.offset - D;
      capStatus.textContent = (capStatus.dataset.base || 'Captions') + (over > 0.3 ? ' · the voice runs ' + over.toFixed(1) + ' s past the reel — tick Fit scenes to the voice or shorten it' : '') + ' — captions ready';
    }
    function renderSegs() {
      segList.innerHTML = '';
      const o = S.voice ? S.voice.offset : 0;
      S.captions.segments.forEach((s, i) => {
        const r = el('div', 'aivid-seg'); r.dataset.i = i;
        const head = el('div', 'aivid-seg-head');
        const time = el('span', 'aivid-seg-time', (s.start + o).toFixed(2) + ' → ' + (s.end + o).toFixed(2) + ' s');
        const nudge = (d) => { s.start = Math.max(0, s.start + d); s.end = Math.max(s.start + 0.05, s.end + d); s.words = Wh.wordsFor(s); S.captions.cues = cuesFor(S); renderSegs(); invalidate(); };
        const minus = button('−0.1 s', 'btn-ghost', () => nudge(-0.1));
        const plus = button('+0.1 s', 'btn-ghost', () => nudge(0.1));
        const del = button('×', 'btn-ghost', () => { S.captions.segments.splice(i, 1); S.captions.cues = cuesFor(S); renderSegs(); invalidate(); });
        del.setAttribute('aria-label', 'Remove this caption segment');
        head.append(time, minus, plus, del);
        const ta = el('textarea', 'control aivid-seg-text'); ta.rows = 2; ta.value = s.text; ta.setAttribute('aria-label', 'Caption text ' + (i + 1));
        ta.addEventListener('input', () => { s.text = ta.value; s.words = Wh.wordsFor(s); S.captions.cues = cuesFor(S); invalidate(); });
        ta.addEventListener('focus', () => seekTo2(s.start + o + 0.01));
        r.append(head, ta);
        segList.appendChild(r);
      });
    }

    /* ---------------- brand pane ---------------- */
    const looksBox = el('div', 'aiimg-looks');
    const presets = share.presets({
      list: LOOKS.map((l) => ({ id: l.id, label: l.label, swatch: l.swatch, apply: () => applyLook(l.id) })),
      root: looksBox
    });
    const handleIn = el('input', 'control'); handleIn.id = 'reel-handle'; handleIn.maxLength = 32; handleIn.placeholder = '@yourhandle';
    const urlIn = el('input', 'control'); urlIn.id = 'reel-url'; urlIn.placeholder = 'yoursite.com';
    const utmIn = el('input', 'control'); utmIn.id = 'reel-utm-source'; utmIn.value = 'instagram';
    const utmField = field('utm_source in the QR and the bio link', utmIn, 'instagram for Reels and square posts, youtube for Shorts and landscape.'); utmField.hidden = true;
    const endChk = on(check('reel-endcard', 'End card', true), () => {
      S.brand.endcard = endChk.input.checked;
      const has = S.scenes.findIndex((x) => x.type === 'endcard');
      if (S.brand.endcard && has < 0 && endCardHasContent()) S.scenes.push({ id: nid(), type: 'endcard', title: S.promote ? S.promote.title : '', seconds: S.brand.qr ? 3.5 : 3.0 });
      else if (!S.brand.endcard && has >= 0) S.scenes.splice(has, 1);
      scenesChanged(true);
    });
    const qrChk = on(check('reel-qr', 'QR code on the end card', false), () => { S.brand.qr = qrChk.input.checked; invalidate(); });
    const qrHint = hint('Add a URL to put a QR code on the end card.');
    const barChk = on(check('reel-progress', 'Progress bar', true), () => { S.brand.progress = barChk.input.checked; invalidate(); });
    const safeChk = on(check('reel-safe', 'Show safe area in the preview', true), () => { S.brand.safe = safeChk.input.checked; safe.hidden = !S.brand.safe; });
    const logoRow = el('div', 'reel-logo-row');
    const logoPrev = el('canvas', 'reel-logo-prev'); logoPrev.width = 96; logoPrev.height = 96; logoPrev.setAttribute('aria-hidden', 'true');
    const logoFile = hiddenFile('reel-logo-file', 'image/*', 'Upload a logo');
    const logoUp = button('Upload logo', 'btn-ghost', () => logoFile.click());
    const logoSite = button('Use the 1234Tools logo', 'btn-ghost', () => setLogo('site'));
    const logoNone = button('No logo', 'btn-ghost', () => setLogo('none'));
    logoRow.append(logoPrev, logoUp, logoSite, logoNone, logoFile);
    logoFile.addEventListener('change', async () => {
      const f = logoFile.files[0]; logoFile.value = '';
      if (!f) return;
      try { const im = await A.loadImageFile(f); const s = Math.min(1, 256 / Math.max(im.width, im.height)); S.brand.logo = A.scaled(im.canvas, im.width * s, im.height * s); S.brand.logoKind = 'upload'; drawLogoPrev(); invalidate(); }
      catch (e) { say((e && e.message) || String(e), 'error'); }
    });
    const lookAccent = on(colour('reel-accent', S.look.accent), () => { S.look.accent = lookAccent.value; invalidate(); });
    const lookText = on(colour('reel-text', S.look.text), () => { S.look.text = lookText.value; invalidate(); });
    const lookBg1 = on(colour('reel-bg1', S.look.bg[0]), () => { S.look.bg[0] = lookBg1.value; invalidate(); });
    const lookBg2 = on(colour('reel-bg2', S.look.bg[1]), () => { S.look.bg[1] = lookBg2.value; invalidate(); });
    panes.brand.append(h('Look'), looksBox, grid(field('Handle', handleIn), field('URL', urlIn)), utmField,
      endChk, qrChk, qrHint, barChk, safeChk, h('Logo'), logoRow, share.creditControl(),
      h('Colours'), grid(field('Accent', lookAccent), field('Text', lookText)), grid(field('Background top', lookBg1), field('Background bottom', lookBg2)));
    handleIn.addEventListener('input', () => { S.brand.handle = handleIn.value.trim(); invalidate(); refreshCaptionPreview(); ensureEndCard(); });
    urlIn.addEventListener('input', () => { if (S.promote) return; S.brand.url = urlIn.value.trim(); syncQrUi(); invalidate(); refreshCaptionPreview(); ensureEndCard(); });
    utmIn.addEventListener('input', () => { S.brand.utm = utmIn.value.trim() || 'instagram'; invalidate(); });
    document.getElementById('aiimg-credit') && document.getElementById('aiimg-credit').addEventListener('change', invalidate);
    function endCardHasContent() { return !!(S.promote || S.brand.handle || S.brand.url || S.brand.logo); }
    function ensureEndCard() {
      if (!S.brand.endcard || !S.scenes.length || S.scenes.some((x) => x.type === 'endcard') || !endCardHasContent()) return;
      S.scenes.push({ id: nid(), type: 'endcard', title: S.promote ? S.promote.title : '', seconds: S.brand.qr ? 3.5 : 3.0 });
      scenesChanged(true);
    }
    function syncQrUi() {
      const has = !!(S.promote || S.brand.url);
      qrChk.input.disabled = !has; qrHint.hidden = has;
      if (!has && S.brand.qr) { S.brand.qr = false; qrChk.input.checked = false; }
    }
    function drawLogoPrev() {
      const x = logoPrev.getContext('2d');
      x.clearRect(0, 0, 96, 96);
      if (S.brand.logo) { const l = S.brand.logo; const s = Math.min(96 / l.width, 96 / l.height); x.drawImage(l, (96 - l.width * s) / 2, (96 - l.height * s) / 2, l.width * s, l.height * s); }
    }
    async function setLogo(kind) {
      if (kind === 'site') {
        try { S.brand.logo = await loadSiteLogo(); S.brand.logoKind = 'site'; }
        catch (e) { say('The 1234Tools logo could not be loaded.', 'warn'); }
      } else { S.brand.logo = null; S.brand.logoKind = 'none'; }
      drawLogoPrev(); invalidate();
    }
    function applyLook(id) {
      const l = LOOKS.find((x) => x.id === id) || LOOKS[0];
      S.look = lookCopy(l);
      lookAccent.value = l.accent; lookText.value = l.text; lookBg1.value = l.bg[0]; lookBg2.value = l.bg[1];
      Object.assign(S.captions.style, { preset: l.caption.preset, accent: l.caption.accent, fill: l.caption.fill, box: l.caption.box });
      capAccent.value = st.accent; capFill.value = st.fill;
      syncSwatches();
      S.scenes.forEach((x) => { x._lay = null; });
      prepareFonts(S).then(invalidate);
      invalidate();
    }

    /* ---------------- export pane ---------------- */
    const sizeSel = select('reel-size', [['1080x1920', '1080 × 1920 — Reels, Shorts, TikTok'], ['1080x1080', '1080 × 1080 — square post'], ['1920x1080', '1920 × 1080 — landscape']], '1080x1920');
    const qualSel = select('reel-quality', [['standard', 'Standard — 8 Mbps'], ['high', 'High — 12 Mbps'], ['small', 'Small — 5 Mbps']], 'standard');
    sizeSel.addEventListener('change', () => {
      S.sizeKey = sizeSel.value; const z = SIZES[S.sizeKey]; S.size = { w: z.w, h: z.h };
      if (!S.utmTouched) { S.brand.utm = z.utm; utmIn.value = z.utm; }
      qualSel.options[0].textContent = 'Standard — ' + z.rates.standard / 1e6 + ' Mbps'; qualSel.options[1].textContent = 'High — ' + z.rates.high / 1e6 + ' Mbps'; qualSel.options[2].textContent = 'Small — ' + z.rates.small / 1e6 + ' Mbps';
      S.scenes.forEach((x) => { x._lay = null; });
      sizePreview();
    });
    utmIn.addEventListener('input', () => { S.utmTouched = true; });
    qualSel.addEventListener('change', () => { S.quality = qualSel.value; });
    const recorderOnly = typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined';
    const exHint = hint(recorderOnly
      ? 'This browser has no on-device MP4 encoder. The reel will be recorded in real time as WebM, and the sound is saved as a separate WAV. Chrome, Edge or Safari 16.4+ make the complete MP4.'
      : 'Encoded on your device as H.264 MP4 at 30 frames per second, with the voice and music mixed in. Nothing is uploaded.');
    const exportBtn = button('Export the reel', 'btn-primary', () => exportReel()); exportBtn.id = 'reel-export';
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.id = 'reel-cancel'; cancelBtn.hidden = true;
    const exProgress = el('div', 'aiimg-progress'); const exBar = el('i'); exProgress.appendChild(exBar); exProgress.hidden = true;
    exProgress.setAttribute('role', 'progressbar'); exProgress.setAttribute('aria-valuemin', '0'); exProgress.setAttribute('aria-valuemax', '100'); exProgress.setAttribute('aria-valuenow', '0'); exProgress.setAttribute('aria-label', 'Export progress');
    const exStatus = el('p', 'aiimg-status reel-exstatus', ''); exStatus.setAttribute('aria-live', 'polite');
    const coverNow = button('Use this frame as cover', 'btn-ghost', () => { S.coverT = S.t; drawCoverThumb(); }); coverNow.id = 'reel-cover-now';
    const coverThumb = el('canvas', 'reel-cover-thumb'); coverThumb.setAttribute('aria-label', 'The cover frame');
    const coverFmt = select('reel-cover-format', [['image/jpeg', 'JPG'], ['image/png', 'PNG']], 'image/jpeg');
    coverFmt.setAttribute('aria-label', 'Cover format');
    const coverBtn = button('Export cover', 'btn-ghost', () => exportCover()); coverBtn.id = 'reel-cover';
    const capBtn = share.captionButton(() => captionFor(S));
    capBtn.id = 'reel-copy-caption';
    const linkBtn = button('Copy link for bio', 'btn-ghost', async () => {
      const u = bioLink();
      if (!u) return;
      const ok = await share.copyText(u);
      linkBtn.textContent = ok ? 'Link copied' : 'Could not copy';
      setTimeout(() => { linkBtn.textContent = 'Copy link for bio'; }, 1500);
    });
    linkBtn.id = 'reel-copy-link';
    const capPreview = el('textarea', 'control reel-caption-text'); capPreview.readOnly = true; capPreview.rows = 7; capPreview.id = 'reel-caption-text';
    const shareBox = el('div', 'aiimg-share');
    shareBox.append(field('Caption for Instagram, TikTok or Shorts', capPreview), row(capBtn, linkBtn), hint('Instagram does not link captions; put the link in your bio and say so.'));
    const batchBox = el('div', 'reel-batch'); batchBox.hidden = true;
    const results = el('div', 'aiimg-results');
    panes.export.append(grid(field('Size', sizeSel), field('Quality', qualSel)), exHint, row(exportBtn, cancelBtn), exProgress, exStatus,
      h('Cover'), row(coverNow, coverThumb, coverFmt, coverBtn), h('Post it'), shareBox, batchBox, results);

    function bioLink() {
      if (S.promote) return qrUrlFor(S.promote.path, S.brand.utm || 'instagram');
      const u = String(S.brand.url || '').trim();
      return u ? (/^https?:\/\//i.test(u) ? u : 'https://' + u) : '';
    }
    function refreshCaptionPreview() {
      if (panes.export.hidden) return;
      capPreview.value = captionFor(S);
      linkBtn.disabled = !bioLink();
    }
    function coverTime() {
      if (S.coverT !== null && S.coverT <= totalSeconds(S)) return S.coverT;
      const f = S.scenes[0];
      return f ? Math.min(f.seconds, 0.75 * f.seconds + 0) : 0;
    }
    function drawCoverThumb() {
      const { w, h: hh } = S.size;
      const s = 90 / Math.max(w, hh);
      coverThumb.width = Math.round(w * s); coverThumb.height = Math.round(hh * s);
      const x = coverThumb.getContext('2d');
      x.save(); x.scale(s, s); renderFrame(x, w, hh, coverTime(), S, { progress: false, credit: false }); x.restore();
    }
    const urls = [];
    function addResult(blob, name, label, kind) {
      const r = el('div', 'aiimg-result'); r.tabIndex = -1; r.dataset.name = name;
      const head = el('div', 'aiimg-result-head');
      const url = URL.createObjectURL(blob); urls.push(url);
      const dl = el('a', 'btn-download', 'Download'); dl.href = url; dl.download = name;
      head.append(el('strong', null, name), el('span', null, label + ' · ' + fmtBytes(blob.size)), dl);
      r.appendChild(head);
      if (kind === 'video') { const v = el('video'); v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.src = url; r.appendChild(v); }
      else if (kind === 'image') { const im = el('img'); im.src = url; im.alt = 'Cover image ' + name; r.appendChild(im); }
      else if (kind === 'audio') { const au = el('audio'); au.controls = true; au.src = url; r.appendChild(au); }
      results.appendChild(r);
      return r;
    }
    function clearResults() { for (const u of urls.splice(0)) URL.revokeObjectURL(u); results.innerHTML = ''; }
    function busyUI(b, label) {
      S.exporting = b;
      exportBtn.disabled = b; coverBtn.disabled = b; cancelBtn.hidden = !b; exProgress.hidden = !b;
      exBar.style.width = '0%'; exProgress.setAttribute('aria-valuenow', '0');
      note(b ? (label || 'Encoding…') : '');
      if (b && S.playing) setPlaying(false);
    }
    let lastAria = 0;
    function progressTo(f) {
      exBar.style.width = Math.round(f * 100) + '%';
      if (performance.now() - lastAria > 250) { lastAria = performance.now(); exProgress.setAttribute('aria-valuenow', String(Math.round(f * 100))); }
    }
    /** A copy of the state for export: an end card with nothing on it is left out. */
    function exportState(X) {
      const scenes = X.scenes.filter((sc) => sc.type !== 'endcard' || sc.title || X.brand.logo || X.brand.url || X.brand.handle);
      return Object.assign({}, X, { scenes, mixP: null });
    }
    async function encodeState(X, signal, onProgress) {
      const z = SIZES[X.sizeKey] || SIZES['1080x1920'];
      const w = z.w, hh = z.h;
      await prepareFonts(X);
      await prepareAssets(X);
      const D = totalSeconds(X);
      const mix = await mixAudio(X);
      if (signal.aborted) throw abortError();
      const bitrate = z.rates[X.quality] || z.rates.standard;
      const audio = mix ? { buffer: mix, bitrate: 128000 } : undefined;
      const hasVideo = X.scenes.some(isVideoScene);
      const webcodecs = typeof VideoEncoder !== 'undefined';
      let r;
      if (hasVideo && webcodecs && A.__forceRecorder !== true) {
        r = await A.encodeVideoFrames(framesOf(X, w, hh, D, signal), { width: w, height: hh, fps: FPS, total: Math.round(D * FPS), audio, bitrate, onProgress, signal });
      } else {
        const live = hasVideo && !webcodecs;
        const render = (ctx, Wd, Ht, t) => { if (live) liveMedia(X, t); renderFrame(ctx, Wd, Ht, t, X); };
        try { r = await A.encodeVideo(render, { width: w, height: hh, fps: FPS, duration: D, bitrate, audio, onProgress, signal }); }
        finally { if (live) pauseAll(X); }
      }
      return { r, mix, D, w, h: hh };
    }
    const hasAudioNote = (r) => /with (AAC|Opus) audio/.test(r.note || '');
    async function exportReel() {
      if (S.job || !S.scenes.length) return;
      const X = exportState(S);
      const D = totalSeconds(X);
      if (D > MAX_SECONDS) { say('The reel is ' + D.toFixed(1) + ' s; Reels are cut at 90 s. Shorten a scene first.', 'error'); return; }
      if (X.scenes.length < S.scenes.length) say('The end card has nothing on it yet, so it is left out of this export. Add a title, URL, handle or logo to show it.', 'note');
      else if (PHONE && D > 60) say('Over a minute on a phone can run out of memory; it will try.', 'warn');
      else say('');
      const job = S.job = new AbortController();
      busyUI(true, 'Exporting — the preview is paused');
      const started = performance.now();
      exStatus.textContent = 'Preparing…';
      const onProgress = (p) => {
        const f = typeof p === 'number' ? p : (p && p.fraction) || 0;
        progressTo(f);
        const spent = (performance.now() - started) / 1000;
        exStatus.textContent = 'Encoding — ' + Math.round(f * 100) + '%' + (f > 0.05 && f < 0.98 ? ', about ' + fmtSec(Math.max(1, spent / f - spent)) + ' left' : '') + '.';
      };
      try {
        const { r, mix, w, h: hh } = await encodeState(X, job.signal, onProgress);
        const slug = currentSlug();
        const name = 'reel-' + slug + '.' + r.ext;
        const took = (performance.now() - started) / 1000;
        const label = (r.ext === 'mp4' ? (r.note || 'MP4').split(' — ')[0] : 'WebM recorded in real time') + ' · ' + D.toFixed(1) + ' s · ' + FPS + ' fps · ' + w + '×' + hh;
        const rowEl = addResult(r.blob, name, label, 'video');
        A.download(r.blob, name);
        S.lastExport = { seconds: took, D, name, size: r.blob.size };
        if (mix && !hasAudioNote(r)) {
          addResult(encodeWAV(mix), 'reel-' + slug + '-sound.wav', 'the mixed voice and music', 'audio');
          say('The clip was recorded as ' + (r.ext === 'mp4' ? 'MP4' : 'WebM') + ' without its sound; the sound is in the WAV beside it. Open this page in Chrome or Edge to get one MP4 with both.', 'warn');
        } else if (r.ext === 'webm') say(r.note, 'warn');
        exStatus.textContent = 'Done in ' + fmtSec(took) + '.';
        rowEl.focus();
      } catch (e) {
        if (e && e.name === 'AbortError') exStatus.textContent = 'Cancelled.';
        else { exStatus.textContent = 'The export failed.'; say((e && e.message) || String(e), 'error'); console.error(e); }
      } finally {
        if (job === S.job) S.job = null;
        busyUI(false);
        invalidate();
      }
    }
    async function coverBlob(X, format) {
      const z = SIZES[X.sizeKey] || SIZES['1080x1920'];
      await prepareFonts(X); await prepareAssets(X);
      const t = X === S ? coverTime() : (X.scenes[0] ? X.scenes[0].seconds * 0.75 : 0);
      await prepareMedia(X, t);
      return A.exportStill((ctx, Wd, Ht, tt) => renderFrame(ctx, Wd, Ht, tt, X, { progress: false }), { width: z.w, height: z.h, format, quality: 0.92, t });
    }
    async function exportCover() {
      if (S.job || !S.scenes.length) return;
      const fmt = coverFmt.value;
      try {
        const b = await coverBlob(S, fmt);
        const name = 'reel-' + currentSlug() + '-cover.' + (fmt === 'image/png' ? 'png' : 'jpg');
        const z = SIZES[S.sizeKey];
        addResult(b, name, 'Cover · ' + z.w + '×' + z.h + ' · at ' + coverTime().toFixed(1) + ' s', 'image');
        A.download(b, name);
      } catch (e) { say((e && e.message) || String(e), 'error'); }
    }
    function currentSlug() {
      if (S.promote) return factsOf(S.promote).slug;
      const f = S.scenes.find((x) => x.type === 'text');
      return (f && slugify(f.text.split(/\s+/).slice(0, 4).join(' '))) || 'reel';
    }

    /* ---------------- batch ---------------- */
    const folderOk = typeof window.showDirectoryPicker === 'function';
    async function openBatch() {
      const rows = [...S.picked.values()].slice(0, MAX_BATCH);
      if (rows.length < 2) return;
      S.batchRows = rows;
      await usePromote(rows[0]);
      batchBox.innerHTML = '';
      const list = el('ol', 'reel-batch-list');
      rows.forEach((r) => list.appendChild(el('li', null, r.title)));
      const folderChk = check('reel-batch-folder', 'Save into a folder (asks once)', false); folderChk.hidden = !folderOk;
      const capsChk = check('reel-batch-captions', 'Also save reel-captions.txt', true);
      const bStatus = el('p', 'aiimg-status reel-batch-status'); bStatus.setAttribute('aria-live', 'polite');
      bStatus.textContent = rows.length + ' tools. The look, brand, size and music you set apply to all; voice and pictures are not used in a batch.';
      const startBtn = button('Start', 'btn-primary', () => runBatch(folderChk.input.checked, capsChk.input.checked, bStatus, startBtn));
      const stopBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); else { batchBox.hidden = true; S.batchRows = null; } });
      batchBox.append(h('Make ' + rows.length + ' reels'), list, folderChk, capsChk, row(startBtn, stopBtn), bStatus);
      batchBox.hidden = false;
      showPane('export');
      batchBox.scrollIntoView && batchBox.scrollIntoView({ block: 'nearest' });
    }
    async function saveFile(blob, name, dir) {
      if (dir) { const fh = await dir.getFileHandle(name, { create: true }); const wr = await fh.createWritable(); await wr.write(blob); await wr.close(); }
      else A.download(blob, name);
    }
    async function runBatch(useFolder, withCaptions, bStatus, startBtn) {
      const rows = S.batchRows;
      if (!rows || S.job) return;
      let dir = null;
      if (useFolder && folderOk) {
        try { dir = await window.showDirectoryPicker({ mode: 'readwrite' }); }
        catch (e) { if (e && e.name === 'AbortError') return; say('The folder could not be opened; the files will be downloaded instead.', 'warn'); dir = null; }
      }
      const job = S.job = new AbortController();
      startBtn.disabled = true;
      busyUI(true, 'Making ' + rows.length + ' reels');
      const n = rows.length;
      const texts = [];
      let done = 0;
      const started = performance.now();
      try {
        for (let i = 0; i < n; i++) {
          if (job.signal.aborted) throw abortError();
          const r = rows[i];
          const f = factsOf(r);
          const brand = Object.assign({}, S.brand, brandFor(r));
          const X = Object.assign({}, S, { promote: r, brand, voice: null, scenes: buildScript(r, brand), mixP: null,
            captions: Object.assign({}, S.captions, { source: 'scene', cues: [], segments: [] }) });
          const label = 'Reel ' + (i + 1) + ' of ' + n + ' — ' + r.title;
          bStatus.textContent = label + ' — preparing…' + (i === 1 && !dir ? ' Your browser may ask once to allow several downloads.' : '');
          const { r: out } = await encodeState(X, job.signal, (p) => {
            const fr = typeof p === 'number' ? p : (p && p.fraction) || 0;
            progressTo((i + fr) / n);
            bStatus.textContent = label + ' — encoding ' + Math.round(fr * 100) + '%';
          });
          const name = 'reel-' + f.slug + '.' + out.ext;
          await saveFile(out.blob, name, dir);
          addResult(out.blob, name, (out.note || '').split(' — ')[0] + ' · ' + totalSeconds(X).toFixed(1) + ' s · ' + r.title, 'video');
          const cover = await coverBlob(X, 'image/jpeg');
          await saveFile(cover, 'reel-' + f.slug + '-cover.jpg', dir);
          texts.push(r.title + '\n' + '-'.repeat(Math.min(60, r.title.length)) + '\n' + captionFor(X) + '\nMade free, on my device: ' + share.pageUrl() + '\n');
          done++;
        }
        let tail = '';
        if (withCaptions) {
          const txt = new Blob([texts.join('\n')], { type: 'text/plain' });
          await saveFile(txt, 'reel-captions.txt', dir);
          const rr = addResult(txt, 'reel-captions.txt', 'captions and hashtags for each reel', 'text');
          rr.appendChild(el('pre', 'reel-captions-pre', texts.join('\n')));
          tail = ' and reel-captions.txt';
        }
        bStatus.textContent = done + ' reels, ' + done + ' covers' + tail + ' ' + (dir ? 'saved to ' + dir.name : 'downloaded') + ' in ' + fmtSec((performance.now() - started) / 1000) + '.';
      } catch (e) {
        if (e && e.name === 'AbortError') bStatus.textContent = 'Cancelled after ' + done + ' reel' + (done === 1 ? '' : 's') + '; the finished files stay.';
        else { bStatus.textContent = 'The batch stopped at reel ' + (done + 1) + ' of ' + n + '.'; say((e && e.message) || String(e), 'error'); console.error(e); }
      } finally {
        if (job === S.job) S.job = null;
        startBtn.disabled = false;
        busyUI(false);
        invalidate();
      }
    }
    function brandFor(r) {
      return { url: '1234tools.com/' + rowObj(r).path, handle: S.brand.handle || '@1234tools', qr: S.brand.qr !== false };
    }

    /* ---------------- picker ---------------- */
    let filter = 'popular', active = -1, shown = [];
    async function ensureIndex() {
      if (S.index) return S.index;
      try {
        const fi = await loadFinderIndex();
        S.index = fi.tools.map(rowObj);
        find.placeholder = 'Search ' + S.index.length + ' tools…';
        renderFilters();
        renderPicker();
        return S.index;
      } catch (e) {
        pickStatus.textContent = '';
        say(e.message, 'warn');
        return null;
      }
    }
    function renderFilters() {
      filterRow.innerHTML = '';
      const secs = [];
      for (const r of S.index) if (secs.indexOf(r.section) < 0) secs.push(r.section);
      const mk = (k, label) => { const b = button(label, 'chip', () => { filter = k; renderFilters(); renderPicker(); }); b.setAttribute('aria-pressed', filter === k ? 'true' : 'false'); b.classList.toggle('is-on', filter === k); filterRow.appendChild(b); };
      mk('popular', 'Popular');
      secs.forEach((s) => mk(s, s));
    }
    function rankRows(q) {
      const ql = q.toLowerCase();
      const scored = [];
      for (const r of S.index) {
        if (filter !== 'popular' && r.section !== filter) continue;
        const t = r.title.toLowerCase();
        let s = -1;
        if (t.startsWith(ql)) s = 0;
        else if (t.indexOf(ql) >= 0) s = 1;
        else if (r.keywords.toLowerCase().indexOf(ql) >= 0) s = 2;
        else if (r.section.toLowerCase().indexOf(ql) >= 0 || r.path.indexOf(ql) >= 0) s = 3;
        else if (r.description.toLowerCase().indexOf(ql) >= 0) s = 4;
        if (s >= 0) scored.push([s, r]);
      }
      return scored.sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title)).map((x) => x[1]);
    }
    function renderPicker() {
      if (!S.index) return;
      const q = find.value.trim();
      if (q) shown = rankRows(q);
      else if (filter === 'popular') shown = POPULAR_PATHS.map((p) => S.index.find((r) => r.path === p)).filter(Boolean);
      else shown = S.index.filter((r) => r.section === filter);
      shown = shown.slice(0, 40);
      toolList.innerHTML = '';
      shown.forEach((r, i) => {
        const li = el('li', 'reel-tool'); li.id = 'reel-opt-' + i; li.setAttribute('role', 'option'); li.dataset.path = r.path;
        li.setAttribute('aria-selected', S.promote && S.promote.path === r.path ? 'true' : 'false');
        if (i === active) li.classList.add('is-active');
        const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ic.setAttribute('class', 'ico'); ic.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '/assets/icons.svg#' + r.glyph); ic.appendChild(use);
        const txt = el('div', 'reel-tool-text'); txt.append(el('strong', null, r.title), el('small', null, r.section + (r.io ? ' · ' + r.io : '')));
        const cb = el('input', 'reel-pick'); cb.type = 'checkbox'; cb.checked = S.picked.has(r.path); cb.setAttribute('aria-label', 'Select ' + r.title);
        cb.addEventListener('change', () => { if (cb.checked) { if (S.picked.size >= MAX_BATCH) { cb.checked = false; say('A batch is at most 25 tools.', 'warn'); return; } S.picked.set(r.path, r); } else S.picked.delete(r.path); syncBatchBtn(); });
        li.append(ic, txt, cb);
        li.addEventListener('click', (e) => { if (e.target === cb) return; usePromote(r); });
        toolList.appendChild(li);
      });
      pickStatus.textContent = shown.length ? '' : 'No tool matches “' + q + '”.';
      if (active >= shown.length) active = -1;
      find.setAttribute('aria-activedescendant', active >= 0 ? 'reel-opt-' + active : '');
      syncBatchBtn();
    }
    function syncBatchBtn() {
      const n = S.picked.size;
      batchBtn.textContent = 'Make ' + Math.max(2, n) + ' reels';
      batchBtn.disabled = n < 2;
      clearBtn.disabled = n === 0;
    }
    find.addEventListener('input', () => { active = -1; renderPicker(); });
    find.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!shown.length) return;
        active = e.key === 'ArrowDown' ? Math.min(shown.length - 1, active + 1) : Math.max(0, active - 1);
        for (const li of toolList.children) li.classList.toggle('is-active', li.id === 'reel-opt-' + active);
        find.setAttribute('aria-activedescendant', 'reel-opt-' + active);
        const li = document.getElementById('reel-opt-' + active); if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && active >= 0 && shown[active]) { e.preventDefault(); usePromote(shown[active]); }
    });

    /* ---------------- making a reel ---------------- */
    function openStudio() {
      start.hidden = true; studio.hidden = false;
      sizePreview();
      renderScenes(); renderChosen(); updateTotal(); updateSoundStatus(); syncQrUi();
      /* open on the hook fully drawn, not on the first (empty) frame */
      S.t = S.scenes[0] ? r1(S.scenes[0].seconds * 0.75) : 0; syncTransport();
      showPane('scenes');
      prepareFonts(S).then(() => { drawCoverThumb(); invalidate(); });
      prepareAssets(S).then(invalidate);
      const hd = document.getElementById('reel-scenes-h'); if (hd) hd.focus({ preventScroll: true });
    }
    function makeFromScript() {
      const text = scriptBox.value.trim();
      if (!text) { say('Write a script first — one scene per line — or press “Try an example”.', 'warn'); scriptBox.focus(); return; }
      if (S.mode === 'promote') {
        /* what the promote preset filled in is ours, not the visitor's */
        S.brand.url = ''; urlIn.value = '';
        if (!S.brand.handleTouched) { S.brand.handle = ''; handleIn.value = ''; }
        S.brand.qr = false; qrChk.input.checked = false;
        if (S.brand.logoAuto) { S.brand.logo = null; S.brand.logoKind = 'none'; S.brand.logoAuto = false; drawLogoPrev(); }
      }
      S.mode = 'script'; S.promote = null; S.batchRows = null; batchBox.hidden = true;
      utmField.hidden = true; urlIn.readOnly = false;
      const scenes = scenesFromScript(text, S.look);
      S.scenes = scenes;
      if (S.brand.endcard && endCardHasContent()) S.scenes.push({ id: nid(), type: 'endcard', title: S.brand.handle || '', seconds: S.brand.qr ? 3.5 : 3.0 });
      if (scenes.shrunk) say('The script ran over 90 s, so every scene was shortened to fit.', 'warn'); else say('');
      openStudio();
    }
    async function usePromote(r, rewrite) {
      r = rowObj(r);
      S.mode = 'promote'; S.promote = r;
      if (!rewrite && S.batchRows && S.batchRows[0] !== r) { S.batchRows = null; batchBox.hidden = true; }
      S.brand.url = '1234tools.com/' + r.path; urlIn.value = S.brand.url; urlIn.readOnly = true;
      if (!S.brand.handleTouched) { S.brand.handle = '@1234tools'; handleIn.value = S.brand.handle; }
      S.brand.qr = true; qrChk.input.checked = true;
      utmField.hidden = false;
      if (S.brand.logoKind === 'none') { await setLogo('site'); S.brand.logoAuto = S.brand.logoKind === 'site'; }
      S.scenes = buildScript(r, S.brand);
      S.coverT = null;
      openStudio();
      renderPicker();
      say('');
    }
    handleIn.addEventListener('input', () => { S.brand.handleTouched = true; });
    function startOver() {
      if (S.job) return;
      if (S.playing) setPlaying(false);
      clearResults();
      batchBox.hidden = true; S.batchRows = null;
      studio.hidden = true; start.hidden = false;
      say('');
    }

    /* ---------------- deep links ---------------- */
    let params;
    try { params = new URLSearchParams(location.search); } catch (e) { params = new URLSearchParams(''); }
    const toolParam = params.get('tool');
    setMode('script');
    showPane('scenes');
    sizePreview();
    updateSoundStatus();
    syncQrUi();
    presets.applyFromUrl();
    if (toolParam) {
      let p = toolParam;
      try { p = decodeURIComponent(p); } catch (e) { /* as given */ }
      p = p.replace(/^\/+/, '');
      if (p && !/\/$/.test(p)) p += '/';
      setMode('promote');
      ensureIndex().then((idx) => {
        if (!idx) return;
        const r = idx.find((x) => x.path === p);
        if (r) usePromote(r);
        else { say('No tool at ' + p + ' — pick one below.', 'warn'); find.focus(); }
      });
    }

    API = {
      state: S, invalidate, renderFrame: (ctx, W, H, t) => renderFrame(ctx, W, H, t, S), usePromote, openBatch,
      destroy: () => { mounted = false; if (CUR === S) CUR = null; }
    };
    A.tools['reel-maker'].current = API;
    return API;
  }

  A.tools['reel-maker'] = {
    mount, buildScript, captionFor, mixAudio, sceneAt, scenesFromScript, tagsFor, qrUrlFor, encodeWAV, factsOf,
    renderFrame: (ctx, W, H, t, S, o) => renderFrame(ctx, W, H, t, S || CUR, o),
    state: () => CUR
  };
})();
