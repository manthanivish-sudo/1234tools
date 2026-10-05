/**
 * Reel Maker — a script, pictures, a voice and music in; a 9:16 MP4 out.
 *
 * Scenes are laid end to end and drawn by ONE function, renderFrame(ctx, W,
 * H, t), for the preview, the cover and every exported frame, so what is
 * exported is what was seen. Sound (a voiceover, music that ducks under it,
 * a clip's own sound) is mixed in an OfflineAudioContext; captions come from
 * Whisper tiny on the device (aivid-whisper.js) and are drawn by the Auto
 * Captions tool's own drawCaptions. The voiceover can also be generated:
 * "Generate voice" has Kokoro-82M (aivid-tts.js, in a worker) read each
 * scene's line in one of 28 English voices, lays the lines on the timeline
 * so each scene lasts as long as its line (plus a pause), and builds the
 * same S.voice a recording makes — with `plan` (scene id → seconds) and
 * `generated` added — so mixing, ducking and Fit scenes work unchanged and
 * the captions are the script itself, timed as spoken, with no
 * transcription. The post caption then says the voice is AI-generated.
 * Encoding is the shared runtime's
 * encodeVideo / encodeVideoFrames (aiimg-core.js). Nothing leaves the browser.
 *
 * The visual language is the promotion kits' (build/promo/kit-templates):
 * the same eight AA-checked palettes, the same five heading treatments
 * (two-tone gradient, outlined keyword, highlighter marker, all-caps stack,
 * serif editorial), the same beats and hero frames — animated. A look is
 * { palette, type, motion, bg, layout, copy }; a seeded picker chooses one
 * from (tool + reel number) and steps past the tool's last three looks and
 * the last two of any reel (kept in localStorage), so no two reels look the
 * same unless the visitor pins a look.
 *
 * "Promote a 1234Tools tool" reads the tool's story from assets/stories.js
 * (loaded on demand) and tells it in seven beats: hook, pain, the usual way,
 * the fix, a real example (assets/examples.js, loaded on demand; the in → out
 * line when there is none), three steps, and an end card with the proof
 * pills, a QR code to the UTM link and the story's call to action. A tool
 * with no story falls back to a script written from its finder-index row.
 * Visitors get seven script templates (Problem → Solution, Before / After,
 * 3 Mistakes, Myth vs Fact, How-to, Top 5, Testimonial) written in a small
 * line grammar: "HOOK: …", "USUAL: title | a | b | c", "STEPS: …" and so on.
 *
 * Every text block is fitted to its box by a shrink loop; a block that still
 * does not fit is recorded in overflow() (the browser test asserts it stays
 * empty). Nothing is drawn in the top 250 px or bottom 340 px of a 1080×1920
 * frame except the progress bar's own strip.
 *
 * Exports: AIImg.tools['reel-maker'] = { mount, buildScript, captionFor,
 * mixAudio, sceneAt, renderFrame, scenesFromScript, tagsFor, qrUrlFor,
 * encodeWAV, factsOf, templates, palettes, paletteAudit, chooseLook,
 * overflow, state() }.
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
  const ANIMS = [['auto', 'The look’s motion'], ['pop', 'Kinetic pop'], ['slide', 'Slide stack'], ['type', 'Typewriter'], ['punch', 'Zoom punch'], ['fade', 'Fade'], ['none', 'Still']];
  const OLD_ANIM = { zoom: 'pop', typewriter: 'type' };
  const KIND_LABEL = { text: 'Text', hook: 'Hook', pain: 'Pain', usual: 'The usual way', fix: 'The fix', example: 'Example', steps: 'Steps', point: 'Point',
    versus: 'Versus', quote: 'Quote', cta: 'Call to action', endcard: 'End card' };
  const HEADING_LABEL = { usual: 'Title', fix: 'Name', steps: 'Title', point: 'Number', versus: 'Labels, e.g. Myth | Fact', quote: 'Who said it', pain: 'Label' };
  const FITS = [['card', 'Card — fits the width, rounded'], ['phone', 'Phone frame'], ['cover', 'Full-bleed']];
  const CAP_STYLES = [
    ['karaoke', 'Karaoke', 'Words light up as they are spoken'],
    ['pop', 'Pop', 'The current word jumps in size'],
    ['outline', 'Bold outline', 'White, heavy, black edge'],
    ['minimal', 'Minimal', 'A dark box under one line']
  ];

  /* ------------------------------------------------------------------ */
  /* looks: the kits' palettes and heading treatments, plus motion and  */
  /* background                                                         */
  /* ------------------------------------------------------------------ */
  /* build/promo/kit-templates/palettes.js, value for value, so a Reel and a
     kit for the same tool are one campaign. Pure #ffffff is written #fefefe:
     the end card's QR plate is the only pure-white thing in a frame, which
     is what lets a test (or a phone) find and read it. */
  const PALETTES = {
    midnight: {
      label: 'Midnight Gold', light: false,
      bg: '#06080f', ink: '#f4f6fb', ink2: '#c3c9d9', muted: '#8a93a8',
      grad: ['#ffe29a', '#f7c948', '#ff9d2e'], chip: ['#ffe29a', '#f7c948', '#ff9d2e'], chipInk: '#1a1206',
      accent: '#f7c948', accentInk: '#f7c948', coralInk: '#ff8f8f',
      field: '#f7c948', fieldInk: '#120d02', card: '#0f1422', cardInk: '#f4f6fb', cardMuted: '#8f98ad',
      glowA: 'rgba(247,201,72,.19)', glowB: 'rgba(124,92,255,.24)', glowC: 'rgba(45,212,255,.08)', dot: 'rgba(255,255,255,.055)'
    },
    daylight: {
      label: 'Daylight', light: true,
      bg: '#fbf7ee', ink: '#15171f', ink2: '#3c4050', muted: '#5f6375',
      grad: ['#b86e00', '#c2570c', '#b8321a'], chip: ['#ffe29a', '#f7c948', '#ff9d2e'], chipInk: '#1a1206',
      accent: '#b86e00', accentInk: '#9a5300', marker: '#f7c948', coralInk: '#c22f2f',
      field: '#f7c948', fieldInk: '#15171f', card: '#fefefe', cardInk: '#15171f', cardMuted: '#5f6375',
      glowA: 'rgba(247,201,72,.40)', glowB: 'rgba(124,92,255,.15)', glowC: 'rgba(45,212,255,.12)', dot: 'rgba(21,23,31,.075)'
    },
    violet: {
      label: 'Violet Night', light: false,
      bg: '#0e0a24', ink: '#f5f3ff', ink2: '#d0c9f2', muted: '#a197cf',
      grad: ['#f5d0fe', '#c4b5fd', '#a78bfa'], chip: ['#f5d0fe', '#c4b5fd', '#a78bfa'], chipInk: '#1b0f3a',
      accent: '#a78bfa', accentInk: '#c4b5fd', coralInk: '#ff9a9a',
      field: '#6d4aff', fieldInk: '#fefefe', card: '#171135', cardInk: '#f5f3ff', cardMuted: '#a79ed6',
      glowA: 'rgba(167,139,250,.26)', glowB: 'rgba(240,171,252,.16)', glowC: 'rgba(45,212,255,.07)', dot: 'rgba(255,255,255,.055)'
    },
    ocean: {
      label: 'Ocean', light: false,
      bg: '#041526', ink: '#eefaff', ink2: '#b7d3e3', muted: '#7fa3ba',
      grad: ['#cffafe', '#67e8f9', '#2dd4ff'], chip: ['#a5f3fc', '#2dd4ff', '#38bdf8'], chipInk: '#04121f',
      accent: '#2dd4ff', accentInk: '#5fe0ff', coralInk: '#ff9a9a',
      field: '#2dd4ff', fieldInk: '#04121f', card: '#0a2238', cardInk: '#eefaff', cardMuted: '#8cb0c6',
      glowA: 'rgba(45,212,255,.20)', glowB: 'rgba(56,189,248,.14)', glowC: 'rgba(124,92,255,.10)', dot: 'rgba(255,255,255,.05)'
    },
    ember: {
      label: 'Ember', light: false,
      bg: '#17110d', ink: '#fff6ee', ink2: '#ecd5c6', muted: '#b8998a',
      grad: ['#ffd08a', '#ff9d2e', '#ff6b6b'], chip: ['#ffd08a', '#ff9d2e', '#ff7a5c'], chipInk: '#1f0d04',
      accent: '#ff9d2e', accentInk: '#ffb15c', coralInk: '#ff9a8a',
      field: '#ff9d2e', fieldInk: '#1f0d04', card: '#231a14', cardInk: '#fff6ee', cardMuted: '#c3a596',
      glowA: 'rgba(255,157,46,.22)', glowB: 'rgba(255,107,107,.18)', glowC: 'rgba(247,201,72,.08)', dot: 'rgba(255,255,255,.05)'
    },
    mint: {
      label: 'Mint', light: false,
      bg: '#04100c', ink: '#eefff7', ink2: '#c2ead9', muted: '#86b6a4',
      grad: ['#d1fae5', '#6ee7b7', '#2dd4bf'], chip: ['#d1fae5', '#6ee7b7', '#2dd4bf'], chipInk: '#03140e',
      accent: '#6ee7b7', accentInk: '#6ee7b7', coralInk: '#ff9a9a',
      field: '#6ee7b7', fieldInk: '#03140e', card: '#0a1d17', cardInk: '#eefff7', cardMuted: '#8fbfad',
      glowA: 'rgba(110,231,183,.18)', glowB: 'rgba(45,212,191,.14)', glowC: 'rgba(247,201,72,.06)', dot: 'rgba(255,255,255,.05)'
    },
    paper: {
      label: 'Paper', light: true,
      bg: '#f4efe3', ink: '#1c1a17', ink2: '#45403a', muted: '#6b645a',
      grad: ['#b42318', '#c2410c', '#9a3412'], chip: ['#b42318', '#c2410c', '#9a3412'], chipInk: '#fefefe',
      accent: '#c2410c', accentInk: '#9a3412', marker: '#f2c14e', coralInk: '#a61b1b',
      field: '#1c1a17', fieldInk: '#f4efe3', card: '#fffdf7', cardInk: '#1c1a17', cardMuted: '#665f55',
      glowA: 'rgba(194,65,12,.07)', glowB: 'rgba(28,26,23,.05)', glowC: 'rgba(194,65,12,.04)', dot: 'rgba(28,26,23,.07)'
    },
    block: {
      label: 'Bold Block', light: true,
      bg: '#f7c948', ink: '#0b0b0f', ink2: '#2b2410', muted: '#4d4215',
      grad: ['#4c1d95', '#5b21b6', '#3b0764'], chip: ['#0b0b0f', '#1f1a10', '#0b0b0f'], chipInk: '#f7c948',
      accent: '#5b21b6', accentInk: '#4c1d95', marker: '#fefefe', coralInk: '#9f1239',
      field: '#0b0b0f', fieldInk: '#f7c948', card: '#fffbef', cardInk: '#0b0b0f', cardMuted: '#5c5236',
      glowA: 'rgba(255,255,255,.30)', glowB: 'rgba(255,157,46,.35)', glowC: 'rgba(255,255,255,.12)', dot: 'rgba(11,11,15,.10)'
    }
  };
  const PAL_IDS = Object.keys(PALETTES);
  /* old preset links (?preset=sunrise, ?preset=bold) still land on a look */
  const PAL_ALIAS = { sunrise: 'ember', bold: 'block' };
  const TYPES = ['gradient', 'outline', 'marker', 'caps', 'serif'];
  const TYPE_LABELS = { gradient: 'Two-tone gradient', outline: 'Outlined keyword', marker: 'Highlighter marker', caps: 'All-caps stack', serif: 'Serif editorial' };
  const MOTIONS = ['pop', 'slide', 'type', 'punch'];
  const MOTION_LABELS = { pop: 'Kinetic pop', slide: 'Slide stack', type: 'Typewriter', punch: 'Zoom punch' };
  const BGS = ['glow', 'grid', 'grain', 'mesh'];
  const BG_LABELS = { glow: 'Glow field', grid: 'Grid', grain: 'Film grain', mesh: 'Gradient mesh' };
  const LAYOUTS = ['classic', 'poster', 'split'];
  const LAYOUT_LABELS = { classic: 'Classic stack', poster: 'Big-type poster', split: 'Split screen' };
  /* the kits' section leanings (variant.js): every palette stays possible */
  const LEAN = {
    creator: { violet: 4, ember: 4, mint: 3, midnight: 2, block: 2, ocean: 2, daylight: 1, paper: 1 },
    money: { midnight: 4, paper: 4, daylight: 3, ocean: 3, block: 2, mint: 1, violet: 1, ember: 1 },
    dev: { mint: 4, ocean: 4, midnight: 3, violet: 2, paper: 1, daylight: 1, ember: 1, block: 1 },
    docs: { daylight: 4, paper: 4, midnight: 3, ocean: 2, block: 2, violet: 1, mint: 1, ember: 1 },
    ai: { violet: 4, midnight: 3, ocean: 3, paper: 2, daylight: 2, mint: 1, ember: 1, block: 1 },
    general: { midnight: 3, daylight: 3, violet: 2, ocean: 2, ember: 2, mint: 2, paper: 2, block: 2 }
  };
  const SECTION_LEAN = {
    'ai-image': 'creator', 'ai-video': 'creator', image: 'creator', design: 'creator', qr: 'creator',
    business: 'money', india: 'money', finance: 'money', time: 'money',
    developer: 'dev', engineering: 'dev', mathematics: 'dev', pdf: 'docs', text: 'docs', education: 'docs', ai: 'ai'
  };
  const TYPE_LEAN = {
    paper: { serif: 4, marker: 3, caps: 2, outline: 1, gradient: 1 },
    daylight: { marker: 3, gradient: 3, serif: 2, caps: 2, outline: 1 },
    block: { caps: 4, outline: 3, marker: 2, serif: 1, gradient: 2 },
    default: { gradient: 3, outline: 2, marker: 2, caps: 2, serif: 2 }
  };
  const CORAL = '#ff6b6b';

  /* ---- WCAG 2 contrast, checked when the file loads ---- */
  function lumOf(hex) {
    const h = String(hex).replace('#', '');
    return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((x) => parseInt(x, 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
      .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  }
  function contrast(a, b) { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  /** Every pair a palette must pass (the kits' list, plus the Reel's own: the chip ink on the coral ✗, the card ink on the ticket). */
  function palettePairs(p) {
    const out = [
      ['ink on bg', p.ink, p.bg, 4.5], ['ink2 on bg', p.ink2, p.bg, 4.5], ['muted on bg', p.muted, p.bg, 4.5],
      ['accentInk on bg', p.accentInk, p.bg, 4.5], ['coralInk on bg', p.coralInk, p.bg, 4.5],
      ['accent on bg', p.accent, p.bg, 3], ['ink on marker', p.ink, p.marker || p.bg, 4.5], ['fieldInk on field', p.fieldInk, p.field, 4.5],
      ['cardInk on card', p.cardInk, p.card, 4.5], ['cardMuted on card', p.cardMuted, p.card, 4.5]
    ];
    p.grad.forEach((c, i) => out.push(['grad[' + i + '] on bg (large text)', c, p.bg, 3]));
    p.chip.forEach((c, i) => out.push(['chipInk on chip[' + i + ']', p.chipInk, c, 4.5]));
    return out;
  }
  function paletteAudit() {
    const rows = [];
    for (const id of PAL_IDS) for (const [pair, fg, bg, min] of palettePairs(PALETTES[id])) {
      const ratio = contrast(fg, bg);
      rows.push({ palette: id, pair, ratio: Math.round(ratio * 100) / 100, min, ok: ratio >= min });
    }
    return rows;
  }
  const AUDIT_BAD = paletteAudit().filter((r) => !r.ok);
  if (AUDIT_BAD.length) console.error('Reel Maker: palette contrast below WCAG AA — ' + AUDIT_BAD.map((r) => r.palette + ' ' + r.pair + ' ' + r.ratio).join('; '));

  /* The quick picks in the promote picker. Kept in step with build-site.js
     POPULAR plus the high-interest list; filtered through the index at run
     time, so a removed tool drops out on its own. */
  const POPULAR_PATHS = ['image/image-compressor/', 'pdf/merge-pdf/', 'developer/json-formatter/', 'image/passport-photo/', 'qr/qr-code-generator/',
    'business/currency-converter/', 'india/gst-calculator/', 'text/word-counter/', 'ai-image/background-remover/', 'ai-video/auto-captions/',
    'ai-image/text-behind-image/', 'pdf/split-pdf/', 'india/emi-calculator/', 'india/sip-calculator/', 'india/india-income-tax/',
    'business/uk-take-home-pay/', 'health/bmi/', 'time/age-calculator/', 'time/date-difference/', 'pdf/payslip-pdf/', 'pdf/invoice-pdf/'];

  /* ---- the fallback script's tables (tools with no story) ---- */
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
  const HOOKS = {
    Calculate: ['Stop guessing your {noun}.', '{noun} in ten seconds.\nFree.', 'Still working out\n{noun} by hand?'],
    Convert: ['{inPart} → {outPart}.\nNo upload.', 'Convert {inPart} to {outPart}\nwithout an app.', '{title}:\ndrop it in, it’s done.'],
    Check: ['Check your {noun}\nbefore you send it.', '{title} —\npaste, done.', 'Not sure about the {noun}?\nCheck it free.'],
    Make: ['Make {aNoun}\nin your browser. Free.', 'Need {aNoun}?\nNo account, no watermark.', '{title}:\nmade on your device.'],
    'Clean up': ['{title},\nwithout uploading the photo.', 'Clean it up.\nKeep it private.', '{title} —\nfree, no watermark.']
  };
  const AI_HOOKS = ['{title}:\nyour first draft, by AI.', 'Paste it in.\nRead what the AI sends back.', '{noun} with AI —\nyou do the checking.'];
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
  /* words a hook's "strongest noun" is never */
  const WEAK = new Set('the and for you your are was were has have had can will its it\'s that this with from into what when where which while who why how not but all any one two six ten get got gets make made takes take using use used every each just only still need needs want wants says said shows show seconds second minutes before after again ever never always really'.split(' '));

  /* the kits' copy alternates (variant.js copyFor), chosen by the look's copy index */
  const COPY = {
    painLabel: ['Sound familiar?', 'The problem', 'You know this one'],
    usualTitle: [['Still doing it the hard way?', 'the hard way?'], ['The usual way is a detour.', 'a detour'], ['Why is this still so fiddly?', 'so fiddly?']],
    turn: ['There is a simpler way', 'There is a better way', 'Here is the fix'],
    fixEyebrow: ['The fix', 'The better way', 'Meet the fix'],
    stepsTitle: [['Three steps. Done.', 'Done.'], ['How it works, in three steps.', 'three steps.'], ['As easy as 1, 2, 3.', '1, 2, 3.']]
  };

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
  const reelsWord = (n) => n + ' reel' + (n === 1 ? '' : 's');
  const slugify = (s) => (String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []).join('-').slice(0, 40).replace(/-+$/, '');
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  const pickBy = (key, list) => list[fnv(key) % list.length];
  const wordCount = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
  const isWordChar = (c) => !!c && /[\p{L}\p{N}]/u.test(c);
  const hexA = (hex, a) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ''); return m ? 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')' : 'rgba(0,0,0,' + a + ')'; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease3 = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t, 0, 1)));
  const backOut = (t, k) => { t = clamp(t, 0, 1); const c = k || 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bump = (t) => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t));
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function weighted(r, weights) {
    const ks = Object.keys(weights);
    const total = ks.reduce((s, k) => s + weights[k], 0);
    let x = r() * total;
    for (const k of ks) { x -= weights[k]; if (x < 0) return k; }
    return ks[ks.length - 1];
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /** Safe areas (fractions of H) and the content box, per frame shape. 9:16 keeps the top 250 px and bottom 340 px of 1920 clear. */
  function safeOf(W, H) {
    if (H > W * 1.3) return { top: 250 / 1920, bottom: 340 / 1920, box: [0.20, 0.70], maxW: 0.84 };
    if (W > H * 1.3) return { top: 0.08, bottom: 0.12, box: [0.16, 0.76], maxW: 0.70 };
    return { top: 0.06, bottom: 0.10, box: [0.14, 0.78], maxW: 0.84 };
  }
  const timeline = (scenes) => { let s = 0; const starts = scenes.map((sc) => { const v = s; s += Number(sc.seconds) || 0; return v; }); return { starts, D: s }; };
  const totalSeconds = (S) => timeline(S.scenes).D;
  const isVideoScene = (sc) => sc.type === 'media' && sc.media && sc.media.kind === 'video';
  /** Scene types drawn as words (everything but pictures, clips and the end card). */
  const WORDY = { text: 1, hook: 1, pain: 1, usual: 1, fix: 1, example: 1, steps: 1, point: 1, versus: 1, quote: 1, cta: 1 };
  const isWordy = (sc) => !!WORDY[sc.type];
  const itemsOf = (sc) => String(sc.text || '').split('\n').map((x) => x.trim()).filter(Boolean);
  /** What a scene says, as one line: the teleprompter, the captions and the timing read this. */
  function spoken(sc) {
    if (!sc) return '';
    switch (sc.type) {
      case 'usual': case 'steps': return oneLine([sc.heading].concat(itemsOf(sc)).filter(Boolean).join('. '));
      case 'fix': return oneLine([sc.heading, sc.text].filter(Boolean).join('. '));
      case 'versus': return oneLine(itemsOf(sc).join('. '));
      case 'endcard': return oneLine([sc.cta, sc.title].filter(Boolean).join('. '));
      case 'media': return oneLine(sc.text || '');
      default: return oneLine(sc.text || '');
    }
  }
  /* ------------------------------------------------------------------ */
  /* the voice-over script: what is said, apart from what is shown      */
  /* ------------------------------------------------------------------ */
  /* British spellings for words a script may carry in American form (the captions show the voice-over text) */
  const UK_SPELL = { color: 'colour', colors: 'colours', favorite: 'favourite', favorites: 'favourites', center: 'centre', organize: 'organise',
    organized: 'organised', organizing: 'organising', optimize: 'optimise', optimized: 'optimised', analyze: 'analyse', analyzed: 'analysed',
    customize: 'customise', customized: 'customised', recognize: 'recognise', realize: 'realise', behavior: 'behaviour', license: 'licence',
    catalog: 'catalogue', gray: 'grey', canceled: 'cancelled', traveling: 'travelling', labeled: 'labelled', meter: 'metre', meters: 'metres',
    liter: 'litre', liters: 'litres', percent: 'per cent', summarize: 'summarise', personalize: 'personalise', prioritize: 'prioritise' };
  const SPELL_RE = new RegExp('\\b(' + Object.keys(UK_SPELL).join('|') + ')\\b', 'gi');
  /**
   * Screen text → words to say. Things that only make sense on screen are
   * dropped or described: Wi-Fi and other QR payloads, links (our own site is
   * said as its name, anything else becomes "the link in our bio"), e-mail
   * addresses, JSON, base64, hex, file names, hashtags, @handles and emoji.
   * Symbols are said: × times (or "by" between sizes), % per cent, ₹/£/$/€
   * as rupees, pounds, dollars, euros after the figure; arrows, ticks, bars
   * and bullets become pauses. Line breaks become sentence ends; spelling is
   * British.
   */
  function toSpeech(s) {
    let t = String(s || '');
    if (!t.trim()) return '';
    t = t.replace(/\[([^\]]*)\]/g, '$1')
      .replace(/\bWIFI:(?:[^;]*;)*;?/gi, ' ')                                  /* WIFI:T:WPA;S:…;P:…;; */
      .replace(/\b(?:MECARD|BEGIN:VCARD|MATMSG|SMSTO|geo):\S*/gi, ' ')
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, ' ')                          /* e-mail addresses */
      .replace(/(?:https?:\/\/)?(?:www\.)?1234tools\.com(?:\/[^\s)]*)?/gi, '1234Tools')
      .replace(/\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|org|net|co\.uk|co|io|ai|app|dev|me|ly)(?:\/\S*)?/gi, 'the link in our bio')
      .replace(/\{\{\s*([\w ]+?)\s*\}\}/g, '$1')                               /* {{Name}} merge fields: the field's name */
      .replace(/[{[]\s*"[\s\S]*?[}\]]/g, ' ')                                  /* JSON */
      .replace(/\b[A-Za-z0-9+/]{24,}={0,2}(?=\s|$)/g, ' ')                     /* base64 and long tokens */
      .replace(/#[0-9a-f]{3,8}\b|\b0x[0-9a-f]+\b|\b[0-9a-f]{16,}\b/gi, ' ')    /* hex colours, hashes */
      /* file names: a few are the subject and are said ("robots dot TXT"); any other says only its type ("a PDF"), never its name */
      .replace(/(^|[^\w.])(robots\.txt|sitemap\.xml|\.htaccess|package\.json|\.env)\b/gi, (m, pre, n) => pre + n.replace(/^\./, 'dot ').replace(/\.(\w+)$/, (x, e) => ' dot ' + e.toUpperCase()))
      .replace(/(^|[^\w])[\w-]*\.(pdf|png|jpe?g|webp|gif|svg|csv|xlsx?|docx?|pptx?|txt|json|zip|mp4|mov|webm|mp3|wav|heic|html?)\b/gi, (m, pre, e) => pre + e.toUpperCase())
      .replace(/(^|\s)[#@][A-Za-z_][\w.]*/g, '$1')                             /* hashtags, handles (#1 stays a number) */
      .replace(/(^|\s)#(\d)/g, '$1number $2')
      .replace(/\p{Extended_Pictographic}|[\u{FE0F}\u{200D}\u{20E3}]/gu, ' ')
      .replace(/(\d)\s*[×x]\s*(\d)/g, '$1 by $2').replace(/×/g, ' times ')
      .replace(/\s*(?:→|⇒|->|➜|➔|›|»)\s*/g, ', ').replace(/[✓✔✗✘•·|]+/g, ', ')
      .replace(/(\d)\.00\b/g, '$1')
      .replace(/\bUS\$/g, '$').replace(/±\s?/g, 'plus or minus ').replace(/(\d)\s?[–-]\s?(\d)/g, '$1 to $2').replace(/\s=\s?$|\s=\s/g, ' is ')
      .replace(/([₹£$€])(?!\s?\d)/g, (m, c) => ' the ' + ({ '₹': 'rupee', '£': 'pound', $: 'dollar', '€': 'euro' })[c] + ' sign ')
      /* a figure ends on a digit, so "₹1,50,000, then" keeps its comma outside */
      .replace(/₹\s?(\d(?:[\d,]*\d)?(?:\.\d+)?)(\s?(?:lakh|crore|k|cr)\b)?/gi, (m, n, u) => n + (u || '') + ' rupees')
      .replace(/£\s?(\d(?:[\d,]*\d)?(?:\.\d+)?)(\s?(?:k|m|million|bn|billion)\b)?/gi, (m, n, u) => n + (u || '') + ' pounds')
      .replace(/\$\s?(\d(?:[\d,]*\d)?(?:\.\d+)?)(\s?(?:k|m|million|bn|billion)\b)?/gi, (m, n, u) => n + (u || '') + ' dollars')
      .replace(/€\s?(\d(?:[\d,]*\d)?(?:\.\d+)?)/g, '$1 euros')
      .replace(/\s?%/g, ' per cent')
      .replace(/\s&\s/g, ' and ').replace(/(\w)\s?\+\s?(\w)/g, '$1 plus $2')
      .replace(/([A-Za-z]{2,})\/([A-Za-z]{2,})/g, '$1 or $2')
      .replace(/\s*\(([^)]*)\)/g, (m, x) => (x.trim() ? ', ' + x.trim() + ',' : ''))
      .replace(SPELL_RE, (w) => { const r = UK_SPELL[w.toLowerCase()]; return w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r; });
    t = t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => (/[.!?…:;,]$/.test(l) ? l : l + '.')).join(' ');
    return t.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').replace(/([,;:])(?:\s*[,;:])+/g, '$1')
      .replace(/,\s*([.!?])/g, '$1').replace(/([.!?])\s*[,;:]\s*/g, '$1 ').replace(/^[\s,.;:—-]+/, '').replace(/\s+—\s*([.!?])/g, '$1')
      .replace(/(the link in our bio)(?:\s*(?:,|or|and)\s*the link in our bio)+/g, '$1')
      .replace(/\s(?:or|and)([.!?])/g, '$1').replace(/[\s,;:—-]+$/, '').trim()
      .replace(/([\p{L}\p{N}])$/u, '$1.');
  }
  const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
  const sentence = (s) => { const t = String(s || '').trim().replace(/[\s,;:—-]+$/, ''); return !t ? '' : /[.!?…]["”’)]?$/.test(t) ? t : t + '.'; };
  /** "First, … Then, … Last, …" from step lines. */
  function stepsSpeech(items) {
    const lead = ['First, ', 'Then, ', 'Then, ', 'Then, ', 'Last, '];
    const xs = items.map((x) => toSpeech(x).replace(/[.!?]+$/, '')).filter(Boolean);
    return xs.map((x, i) => (i === xs.length - 1 && i > 0 ? 'Last, ' : lead[i]) + lowerFirst(x) + '.').join(' ');
  }
  /** A tool's name as said: no "(India)", no trailing "Online". */
  const toolName = (f) => toSpeech(f.title.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+online$/i, '').trim()).replace(/[.!?]+$/, '');
  /** "So try the GST Calculator" for a thing, "So open Merge PDF Files" for an action. */
  const tryLine = (name) => (/(?:er|or|maker|tool|kit|planner|guide)s?$/i.test(name) ? 'So try the ' + name + ', free on 1234Tools.' : 'So open ' + name + ' on 1234Tools. It’s free.');
  /** What the example scene says: the result in words, never its data. */
  function exampleSpeech(ex, f) {
    if (!ex) return '';
    const cap = String(ex.caption || '');
    if (/qr/i.test(f.path) && /WIFI:/i.test(cap)) return 'Point your phone camera at the code and it joins the Wi-Fi. No typing, no spelling out the password.';
    if (/qr/i.test(f.path)) return /scan/i.test(f.path) ? 'Show it a code and it reads it straight away, and tells you what is inside before you open anything.' : 'Point your phone camera at the code and it opens straight away. Every code is scanned back before you download it.';
    if (ex.kind === 'calc') {
      const short = (r) => r && r.value.length <= 22 && /\d/.test(r.value);
      const p = ex.results.find((r) => r.primary) || ex.results[0];
      const other = ex.results.find((r) => r !== p && short(r) && !/^0(\.0+)?$|[₹£$€]0(\.0+)?$/.test(r.value.replace(/\s/g, '')));
      const say = (r) => lowerFirst(toSpeech(r.label).replace(/\s*(?:is|[=:])$/, '').replace(/\.$/, '')) + ', ' + toSpeech(r.value).replace(/\s*(?:is|[=:])$/, '').replace(/\.$/, '');
      return 'Here it is with real numbers: ' + [p, other].filter(short).map(say).join('; ') + '.';
    }
    if (ex.kind === 'flow') return ex.input && ex.output ? 'In goes ' + lowerFirst(toSpeech(ex.input).replace(/\.$/, '')) + '. Out comes ' + lowerFirst(toSpeech(ex.output).replace(/\.$/, '')) + '.' : '';
    if (/^pdf\//.test(f.path || '')) return 'Here it is on real files, start to finish.';
    if (ex.kind === 'beforeAfter') return 'Here is a real before and after, made with it.';
    if (ex.kind === 'document') return 'Here is a real page it made.';
    if (ex.kind === 'text') return 'Here is a real example: what goes in, and what comes out.';
    return 'Here is a real result, made with it.';
  }
  /** The suggested voice-over for a scene from its own fields (a visitor's script, or a beat whose text was edited). */
  function voFromScreen(sc) {
    if (!sc) return '';
    const items = itemsOf(sc);
    switch (sc.type) {
      case 'usual': return toSpeech((sc.heading ? sentence(sc.heading.replace(/[?]$/, '')) + ' ' : '') + items.map(sentence).join(' '));
      case 'steps': return toSpeech(sc.heading ? sentence(sc.heading) : '') + (sc.heading ? ' ' : '') + stepsSpeech(items);
      case 'fix': return toSpeech([sc.heading, sc.text].filter(Boolean).map(sentence).join(' '));
      case 'versus': {
        const lab = String(sc.heading || 'Myth | Fact').split('|').map((x) => x.trim());
        return items.map((x, i) => (lab[i] ? lab[i] + ': ' : '') + sentence(toSpeech(x).replace(/[.!?]+$/, ''))).join(' ');
      }
      case 'point': return (sc.heading ? (sc.bad ? 'Mistake ' : 'Number ') + sc.heading + ': ' : '') + toSpeech(sc.text);
      case 'quote': return toSpeech(sc.text) + (sc.heading ? ' That’s ' + toSpeech(sc.heading).replace(/\.$/, '') + '.' : '');
      case 'example': return exampleSpeech(sc.ex, { path: sc.path || '', title: sc.title || '' }) || toSpeech(sc.text);
      case 'endcard': return sc.voEnd || '';
      default: return toSpeech(sc.text);
    }
  }
  /** The suggestion: the line written for the ear when the scene was built (while its screen text is unchanged), else one made from the screen. */
  function suggestedVO(sc) {
    if (!sc) return '';
    if (sc._vo !== undefined && sc._voKey === voKeyOf(sc)) return sc._vo;
    return voFromScreen(sc);
  }
  const voKeyOf = (sc) => [sc.type, sc.heading || '', sc.text || '', sc.title || ''].join('\u0001');
  /** What is said in a scene: the visitor's own line if they wrote one (even an empty one: silence), else the suggestion. */
  const voOf = (sc) => (sc && sc.vo !== undefined ? sc.vo : suggestedVO(sc));
  /** Fix the beat's spoken line at build time; it stays the suggestion until the screen text changes. */
  const setVO = (sc, line) => { sc._vo = String(line || '').replace(/\s+/g, ' ').trim(); sc._voKey = voKeyOf(sc); return sc; };

  /** Seconds a scene stays: ≈2.6 words a second, at least 1.6 s, at most 4 s; the example and end card need time to play. */
  function beatSeconds(sc) {
    let words = wordCount(spoken(sc));
    if (sc.type === 'usual' || sc.type === 'steps') words = wordCount(sc.heading || '') + 0.65 * wordCount(itemsOf(sc).join(' '));
    let s = clamp(words / 2.6, 1.6, 4);
    if (sc.type === 'example') s = Math.max(s, sc.ex && sc.ex.kind !== 'flow' ? 3.6 : 3.0);
    if (sc.type === 'usual' || sc.type === 'steps') s = Math.max(s, 3.2);
    if (sc.type === 'endcard') s = sc.qr === false ? 3.0 : 3.6;
    if (sc.type === 'hook') s = Math.max(s, 2.4);
    /* beats whose motion needs time: two panels and a strike, a number that lands, a quote, a button */
    const MIN = { versus: 3.4, point: 2.2, quote: 3.0, cta: 2.4, pain: 2.6, fix: 2.6 };
    if (MIN[sc.type]) s = Math.max(s, MIN[sc.type]);
    return r1(s);
  }

  /* ------------------------------------------------------------------ */
  /* looks: choosing one, remembering it                                */
  /* ------------------------------------------------------------------ */
  const LOOK_STORE = 'reel-maker-looks-v2';
  const sectionOf = (tool) => String(tool || '').split('/').filter(Boolean)[0] || '';
  /** The look for (tool, seed). Pure. */
  function pickLook(tool, seed) {
    const r = rng(fnv(String(tool)) ^ (seed >>> 0));
    const lean = LEAN[SECTION_LEAN[sectionOf(tool)] || 'general'];
    const palette = weighted(r, lean);
    const type = weighted(r, TYPE_LEAN[palette] || TYPE_LEAN.default);
    const motion = MOTIONS[Math.floor(r() * MOTIONS.length)];
    const bg = BGS[Math.floor(r() * BGS.length)];
    const layout = LAYOUTS[Math.floor(r() * LAYOUTS.length)];
    const copy = Math.floor(r() * 3);
    return { palette, type, motion, bg, layout, copy, seed: seed >>> 0 };
  }
  const comboOf = (v) => [v.palette, v.type, v.motion, v.bg, v.layout].join('|');
  function loadLookHistory() {
    try { const h = JSON.parse(localStorage.getItem(LOOK_STORE) || 'null'); if (h && Array.isArray(h.e)) return h; } catch (e) { /* private window, blocked storage */ }
    return { e: [] };
  }
  function saveLookHistory(h) {
    try { h.e = h.e.slice(-200); localStorage.setItem(LOOK_STORE, JSON.stringify(h)); } catch (e) { /* the look is still used, just not remembered */ }
  }
  let MEMORY = null;   /* used when storage is unavailable, so one page still varies */
  function history() { const h = loadLookHistory(); if (!h.e.length && MEMORY) return MEMORY; return h; }
  function recordLook(tool, v, replace) {
    const h = history();
    const row = { tool, palette: v.palette, type: v.type, motion: v.motion, bg: v.bg, layout: v.layout, copy: v.copy };
    if (replace && h.e.length && h.e[h.e.length - 1].tool === tool) h.e[h.e.length - 1] = row; else h.e.push(row);
    MEMORY = h;
    saveLookHistory(h);
  }
  /**
   * The look for a new reel. o: { lock: { palette, type, motion, bg, layout } (pinned values), exclude: palettes to avoid (a batch),
   * avoidCombos, record (default true), step (extra seed steps, for "Shuffle look") }.
   * Steps the seed until the palette is not one of the tool's last three or the last two of any reel, and the
   * treatment differs from the tool's last one — relaxing those rules one at a time if a pinned value makes them impossible.
   */
  function chooseLook(tool, o) {
    o = o || {};
    const lock = o.lock || {};
    const h = history();
    const mine = h.e.filter((e) => e.tool === tool);
    const n = mine.length + 1 + (o.step || 0);
    const lastMine = mine.slice(-3), lastAny = h.e.slice(-2);
    const avoidPal = new Set(lastMine.map((e) => e.palette).concat(lastAny.map((e) => e.palette)).concat(o.exclude || []));
    const avoidCombo = new Set(lastMine.concat(lastAny).map(comboOf).concat(o.avoidCombos || []));
    const prev = mine[mine.length - 1];
    const apply = (v) => { const w = Object.assign({}, v); for (const k of ['palette', 'type', 'motion', 'bg', 'layout']) if (lock[k]) w[k] = lock[k]; return w; };
    const s0 = fnv(tool + '#' + n);
    const rules = [
      (w) => (lock.palette || !avoidPal.has(w.palette)) && (lock.type || !prev || w.type !== prev.type) && (lock.motion || !prev || w.motion !== prev.motion) && !avoidCombo.has(comboOf(w)),
      (w) => (lock.palette || !avoidPal.has(w.palette)) && !avoidCombo.has(comboOf(w)),
      (w) => (lock.palette || !(o.exclude || []).includes(w.palette)) && !avoidCombo.has(comboOf(w)),
      (w) => !avoidCombo.has(comboOf(w)),
      () => true
    ];
    let v = null;
    for (const ok of rules) {
      for (let k = 0; k < 400 && !v; k++) { const w = apply(pickLook(tool, (s0 + k) >>> 0)); if (ok(w)) v = w; }
      if (v) break;
    }
    if (o.record !== false) recordLook(tool, v);
    return v;
  }
  /** The drawing look: a palette's tokens, the treatment, motion and background, and the fields the media, caption and colour controls use. */
  function lookFrom(v, over) {
    const id = PALETTES[v.palette] ? v.palette : (PAL_ALIAS[v.palette] || 'midnight');
    const p = PALETTES[id];
    const L = Object.assign({}, p, {
      id, palette: id, type: TYPES.includes(v.type) ? v.type : 'gradient', motion: MOTIONS.includes(v.motion) ? v.motion : 'pop',
      bgT: BGS.includes(v.bg) ? v.bg : 'glow', layout: LAYOUTS.includes(v.layout) ? v.layout : 'classic', copy: Math.abs(v.copy | 0) % 3,
      grad: p.grad.slice(), chip: p.chip.slice()
    });
    /* the fields the rest of the tool reads */
    L.text = p.ink; L.bg = [p.bg, p.bg]; L.plate = hexA(p.card, 0.9); L.plateText = p.cardInk; L.font = 'Sora'; L.bar = p.accent;
    L.caption = {
      preset: { gradient: 'karaoke', outline: 'outline', marker: 'pop', caps: 'outline', serif: 'minimal' }[L.type],
      accent: p.light ? p.chip[1] : p.grad[1], fill: '#fefefe', box: p.light ? p.ink : p.card
    };
    if (over) {
      if (over.accent) { L.accent = over.accent; L.accentInk = over.accent; L.grad = [over.accent, over.accent, over.accent]; L.chip = [over.accent, over.accent, over.accent]; }
      if (over.text) { L.ink = over.text; L.text = over.text; }
      if (over.bg0) L.bg[0] = over.bg0;
      if (over.bg1) L.bg[1] = over.bg1;
    }
    L.key = [id, L.type, L.motion, L.bgT, L.layout, L.copy, L.accent, L.ink, L.bg[0], L.bg[1]].join('|');
    L.name = p.label + ' · ' + TYPE_LABELS[L.type] + ' · ' + MOTION_LABELS[L.motion] + ' · ' + BG_LABELS[L.bgT];
    L.spec = { palette: id, type: L.type, motion: L.motion, bg: L.bgT, layout: L.layout, copy: L.copy };
    return L;
  }

  /* ------------------------------------------------------------------ */
  /* the finder row → facts                                             */
  /* ------------------------------------------------------------------ */
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
  /** The fallback hook for a tool with no story: its own words where a template fits, the desk's library otherwise. */
  function hookFor(f) {
    if (f.isAI) return { text: fill(pickBy(f.path, AI_HOOKS), f), emphasis: [f.noun] };
    const pool = (HOOKS[f.verb] || HOOKS.Make).filter((t) => !(/\{inPart\}|\{outPart\}/.test(t) && !(f.inPart && f.outPart)))
      .map((t) => ({ text: fill(t, f), emphasis: [f.noun, 'Free'] }));
    for (let [text, verb, angle, fit] of LIBRARY) {
      if (verb !== f.verb) continue;
      if (fit && !fit.test(f.path)) continue;
      if (angle === 'offline' && !f.offlineOk) continue;
      const low = text.toLowerCase();
      if (text.length > 26) text = text.replace(/([.;]) (?=\S)/, '$1\n');
      const acc = HOOK_ACCENT.find((w) => new RegExp('(^|[^a-z])' + w + '([^a-z]|$)').test(low)) ||
        (low.match(/[a-z’']+/g) || []).reduce((b, w) => (w.length > b.length ? w : b), '');
      pool.push({ text, emphasis: acc ? [acc] : [] });
    }
    return pickBy(f.path, pool);
  }

  /* ------------------------------------------------------------------ */
  /* highlights                                                         */
  /* ------------------------------------------------------------------ */
  const NUM_RE = /[₹£$€]?\d[\d,]*(?:\.\d+)?(?:\s?%|\s?(?:KB|MB|GB|kB|x|×))?/g;
  /** The hook's key word: its first figure ("₹11,800", "200 KB"), else its strongest noun (an acronym, else the longest real word, later wins a tie). */
  function keyWordOf(text) {
    const t = String(text || '');
    const m = t.match(NUM_RE);
    if (m && m[0].replace(/[^\d]/g, '').length) return m[0].replace(/[.,]$/, '').trim();
    const words = (t.match(/[\p{L}][\p{L}’'-]*/gu) || []).map((w) => w.replace(/[’']s$/, ''));
    const acr = words.filter((w) => /^[A-Z]{2,6}s?$/.test(w));
    if (acr.length) return acr[0];
    let best = '';
    for (const w of words) { const lw = w.toLowerCase(); if (WEAK.has(lw) || STOP.has(lw) || lw.length < 3) continue; if (w.length >= best.length) best = w; }
    return best;
  }
  /**
   * The kits' two-tone split (parts.js splitHighlight) as a [start, end) range:
   * an explicit phrase; the last sentence when there are two; the part after a
   * dash or colon; the last figure; else the last one or two words.
   */
  function hlRange(text, phrase) {
    const t = String(text || '');
    if (!t.trim()) return null;
    if (phrase) {
      const i = t.toLowerCase().lastIndexOf(String(phrase).toLowerCase());
      if (i >= 0) return [i, i + phrase.length];
    }
    const sentences = t.match(/[^.?!]+[.?!]+["')\]]*|[^.?!]+$/g) || [t];
    if (sentences.length >= 2) {
      const last = sentences[sentences.length - 1].trim();
      const i = t.lastIndexOf(last);
      if (i > 0 && last.length >= 3) return [i, i + last.replace(/[.]$/, '').length];
    }
    const dash = Math.max(t.lastIndexOf(' — '), t.lastIndexOf(' – '), t.lastIndexOf(': '));
    if (dash > 4 && t.length - dash > 4) { const a = dash + (t[dash] === ':' ? 2 : 3); return [a, t.replace(/[.!?]$/, '').length]; }
    const nums = [...t.matchAll(/[₹£$€]?\d[\d,.:]*\s?%?/g)];
    if (nums.length) { const m = nums[nums.length - 1]; const s = m[0].replace(/[.,]$/, '').trim(); return [m.index, m.index + s.length]; }
    const words = [...t.matchAll(/\S+/g)];
    const n = words.length > 3 ? 2 : 1;
    const from = words[words.length - n].index;
    return [from, t.replace(/[.!?]+$/, '').length];
  }
  /** A range from a list of emphasised words (a visitor's #word lines): the first one found, whole word. */
  function rangeOfWords(text, words) {
    const low = String(text || '').toLowerCase();
    for (const w of words || []) {
      const ww = String(w || '').toLowerCase().trim();
      if (!ww) continue;
      let i = -1;
      while ((i = low.indexOf(ww, i + 1)) >= 0) { if (!isWordChar(low[i - 1]) && !isWordChar(low[i + ww.length])) return [i, i + ww.length]; }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* stories, examples, the tool glyph — loaded on demand               */
  /* ------------------------------------------------------------------ */
  const loaders = {};
  /** A site script that sets window[global], loaded once; resolves its value, or null if it is missing or the page is offline. */
  function loadGlobal(src, global, timeout) {
    if (window[global]) return Promise.resolve(window[global]);
    if (loaders[src]) return loaders[src];
    loaders[src] = new Promise((res) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.dataset.reel = global;
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(timer); res(window[global] || null); if (!window[global]) loaders[src] = null; };
      s.onload = fin; s.onerror = fin;
      const timer = setTimeout(fin, timeout || 15000);
      document.head.appendChild(s);
    });
    return loaders[src];
  }
  function loadFinderIndex() {
    return loadGlobal('/assets/finder-index.js', 'FINDER_INDEX').then((fi) => { if (!fi || !fi.tools) throw new Error('The tool list could not be loaded — you may be offline.'); return fi; });
  }
  const loadStories = () => loadGlobal('/assets/stories.js', 'TOOL_STORIES');
  const loadExamples = () => loadGlobal('/assets/examples.js', 'TOOL_EXAMPLES', 10000);
  const keyOf = (path) => '/' + String(path || '').replace(/^\/+|\/+$/g, '') + '/';
  function storyFor(path) {
    const S = window.TOOL_STORIES;
    const s = S && S[keyOf(path)];
    return s && s.hook && s.pain && Array.isArray(s.usual) && s.usual.length && Array.isArray(s.steps) && s.steps.length && s.promise ? s : null;
  }
  /** Where an example's picture is: a site path or data: URL as given, else a file name in /assets/img/examples/<dir>/. Nothing off the site. */
  function exampleUrl(name, path, e) {
    const n = String(name || '').trim();
    if (!n) return '';
    if (/^data:image\//i.test(n) || /^blob:/i.test(n)) return n;
    if (/^\/(?!\/)/.test(n)) return n;
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(n)) return '';
    const segs = keyOf(path).split('/').filter(Boolean);
    const dir = e.dir || segs[segs.length - 1] || '';
    return '/assets/img/examples/' + dir + '/' + n;
  }
  /** The tool's captured example, normalised for the hero frames; null when there is none or it failed. */
  function exampleFor(path) {
    const E = window.TOOL_EXAMPLES;
    const e = E && E[keyOf(path)];
    if (!e || e.ok === false) return null;
    const kind = String(e.kind || '');
    const out = { kind, caption: String(e.caption || ''), stats: Array.isArray(e.stats) ? e.stats : [] };
    if (kind === 'calc') {
      out.inputs = (e.inputs || []).filter((x) => x && x.label).map((x) => ({ label: String(x.label), value: String(x.value == null ? '' : x.value) }));
      out.results = (e.results || []).filter((x) => x && x.label).map((x) => ({ label: String(x.label), value: String(x.value == null ? '' : x.value), primary: !!x.primary }));
      return out.results.length ? out : null;
    }
    if (kind === 'text') {
      if (!e.output) return null;
      return Object.assign(out, { input: String(e.input || ''), output: String(e.output), inputLabel: e.inputLabel || 'Input', outputLabel: e.outputLabel || 'Output' });
    }
    if (kind === 'schematic') return Object.assign(out, { kind: 'flow', input: String(e.input || ''), output: String(e.output || ''), sampleIn: e.sampleIn || '', sampleOut: e.sampleOut || '' });
    const before = exampleUrl(e.before, path, e), after = exampleUrl(e.after, path, e), page = exampleUrl(e.page, path, e);
    if (kind === 'document' || (page && !before)) return page ? Object.assign(out, { kind: 'document', page, fileName: e.fileName || '' }) : null;
    if (before && after) return Object.assign(out, { kind: 'beforeAfter', before, after, alpha: !!e.alpha || /\.png(\?|$)/i.test(after) && /remov|cut|sticker/i.test(path) });
    if (after) return Object.assign(out, { kind: 'image', after });
    return null;
  }
  const imgCache = new Map();
  /** A picture for the hero frames: { img, ok, ready }. Same-origin or data: only. */
  function exImage(url) {
    if (!url) return null;
    let e = imgCache.get(url);
    if (e) return e;
    e = { img: new Image(), ok: false, ready: null };
    e.ready = new Promise((res) => {
      e.img.onload = () => { e.ok = e.img.naturalWidth > 0; res(); if (API) API.invalidate(); };
      e.img.onerror = () => res();
      e.img.decoding = 'async';
      e.img.src = url;
    });
    imgCache.set(url, e);
    return e;
  }
  function exImages(ex) { return ex ? [ex.before, ex.after, ex.page].filter(Boolean).map(exImage).filter(Boolean) : []; }
  let spriteP = null;
  const glyphCache = new Map();
  /** The tool's icon from assets/icons.svg, drawn in `colour` on a 256 px canvas (null until loaded, or for an unknown id). */
  function glyphCanvas(id, colour, fallback) {
    if (!id) return null;
    const key = id + '|' + colour;
    let e = glyphCache.get(key);
    if (e) return e.canvas;
    e = { canvas: null };
    glyphCache.set(key, e);
    if (!spriteP) spriteP = fetch('/assets/icons.svg').then((r) => (r.ok ? r.text() : '')).catch(() => '');
    e.ready = spriteP.then((sprite) => {
      const find = (gid) => new RegExp('<symbol id="' + gid.replace(/[^\w-]/g, '') + '"([^>]*)>([\\s\\S]*?)</symbol>').exec(sprite);
      const m = find(id) || (fallback ? find(fallback) : null);
      if (!m) return null;
      const vb = (/viewBox="([^"]+)"/.exec(m[1]) || [0, '0 0 24 24'])[1];
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" width="256" height="256" fill="none" stroke="' + colour + '" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><style>.fill{fill:' + colour + ';stroke:none}.thin{stroke-width:1.25}</style>' + m[2] + '</svg>';
      return loadSvgImage(svg).then((img) => { const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(img, 0, 0, 256, 256); e.canvas = c; if (API) API.invalidate(); });
    }).catch(() => null);
    return null;
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

  /* ------------------------------------------------------------------ */
  /* scripts: a story's seven beats, the fallback, the visitor's lines  */
  /* ------------------------------------------------------------------ */
  const beat = (type, fields) => { const sc = Object.assign({ id: nid(), type, text: '', anim: 'auto' }, fields); sc.seconds = beatSeconds(sc); return sc; };
  /** Keep a story reel near 15–22 s: if it runs long, every beat but the end card gives up to 15% of its time. */
  function trimTo(scenes, target) {
    const D = timeline(scenes).D;
    if (D <= target) return scenes;
    const body = scenes.filter((s) => s.type !== 'endcard');
    const sum = body.reduce((a, s) => a + s.seconds, 0);
    const k = Math.max(0.85, (sum - (D - target)) / sum);
    for (const s of body) s.seconds = r1(Math.max(1.6, s.seconds * k));
    return scenes;
  }
  /** The example scene's words: the capture's caption, else the io line (with the AI model said out loud). */
  function exampleText(ex, f) {
    let t = '';
    if (ex && ex.kind === 'calc') { const p = ex.results.find((r) => r.primary) || ex.results[0]; t = p.label + ': ' + p.value; }
    else if (ex && ex.kind === 'flow') t = [ex.input, ex.output].filter(Boolean).join(' → ');
    else if (ex) t = ex.caption || (ex.kind === 'text' ? (ex.inputLabel + ' → ' + ex.outputLabel) : 'Before → after');
    if (f.isAI) t += '\nYour text goes to an AI model.';
    return t;
  }
  /**
   * Scenes for one tool. With a story (assets/stories.js): hook, pain, the usual way, the fix, the example, three steps, the end card.
   * Without one: the finder-index script (hook, what it does, in → out, trust, end card).
   */
  function buildScript(row, brand, look) {
    const f = factsOf(row);
    brand = brand || {};
    const story = storyFor(f.path);
    if (!story) return buildFallback(f, brand);
    const c = look && look.copy !== undefined ? look.copy : fnv(f.path) % 3;
    const ex = exampleFor(f.path) || (f.inPart && f.outPart ? { kind: 'flow', input: f.inPart, output: f.outPart, schematicOnly: true } : null);
    const out = [];
    out.push(beat('hook', { text: story.hook, eyebrow: story.persona || '', emphasis: [keyWordOf(story.hook)] }));
    out.push(beat('pain', { text: story.pain, eyebrow: COPY.painLabel[c] }));
    out.push(beat('usual', { heading: COPY.usualTitle[c][0], hl: COPY.usualTitle[c][1], text: story.usual.slice(0, 3).join('\n'), foot: COPY.turn[c] }));
    out.push(beat('fix', { heading: f.title, text: story.promise, eyebrow: COPY.fixEyebrow[c], glyph: f.row.glyph, section: f.sectionSlug,
      sub: f.isAI ? 'Sends your text to an AI model, and says so first.' : '' }));
    if (ex) out.push(beat('example', { ex, text: exampleText(ex, f), glyph: f.row.glyph, section: f.sectionSlug, title: f.title, ai: f.isAI }));
    out.push(beat('steps', { heading: COPY.stepsTitle[c][0], hl: COPY.stepsTitle[c][1], text: story.steps.slice(0, 3).join('\n'), eyebrow: f.title,
      foot: f.outPart ? 'You get: ' + f.outPart : '' }));
    if (brand.endcard !== false) {
      out.push(beat('endcard', { title: f.title, cta: story.cta || (f.isAI ? 'Try 10 free runs' : 'Try it free'), proof: (story.proof || []).slice(0, 3),
        text: f.isAI ? '10 free runs a month at 1234tools.com' : 'Free at 1234tools.com', qr: brand.qr !== false }));
    }
    for (const sc of out) for (const k of ['eyebrow', 'heading', 'hl', 'foot']) sc['_auto_' + k] = sc[k];
    /* the voice-over, written for the ear from the story rather than read off the screen */
    const name = toolName(f);
    const byType = {
      hook: toSpeech(story.hook),
      pain: toSpeech(story.pain),
      usual: 'The usual way? ' + story.usual.slice(0, 3).map((u) => sentence(toSpeech(u).replace(/[.!?]+$/, ''))).join(' '),
      fix: tryLine(name) + ' ' + toSpeech(story.promise),
      example: '',
      steps: stepsSpeech(story.steps.slice(0, 3)),
      endcard: sentence(toSpeech(story.cta || (f.isAI ? 'Try ten free runs a month' : 'Try it free'))) + (f.isAI ? ' Ten free runs a month on 1234Tools.' : ' It’s free on 1234Tools.') + ' The link is in our bio.'
    };
    for (const sc of out) {
      if (sc.type === 'example') { sc.path = f.path; setVO(sc, exampleSpeech(sc.ex, f)); }
      else setVO(sc, byType[sc.type] || toSpeech(sc.text));
      if (sc.type === 'endcard') sc.voEnd = sc._vo;
    }
    out.story = true;
    return trimTo(out, 22);
  }
  /** The finder-index script for a tool with no story: the same words as before, drawn in the new beats. */
  function buildFallback(f, brand) {
    const out = [];
    const hook = hookFor(f);
    const hs = beat('hook', { text: hook.text, eyebrow: f.row.section || '', emphasis: hook.emphasis });
    hs.seconds = Math.max(2.4, hs.seconds);
    out.push(hs);
    const regionLine = f.region && f.first.toLowerCase().indexOf(f.region.toLowerCase()) < 0 ? '(' + f.region + ')' : '';
    out.push(beat('text', { text: f.first + (regionLine ? '\n' + regionLine : ''), eyebrow: f.title }));
    if (f.inPart && f.outPart && f.inPart.toLowerCase() !== f.outPart.toLowerCase()) {
      const ex = { kind: 'flow', input: f.inPart, output: f.outPart, schematicOnly: true };
      out.push(beat('example', { ex, text: exampleText(ex, f), glyph: f.row.glyph, section: f.sectionSlug, title: f.title, ai: f.isAI }));
    }
    const trust = beat('text', { text: f.trustLine + '\n' + f.sectionLine, eyebrow: f.isAI ? 'Say so first' : 'Private by design' });
    trust.seconds = r1(clamp(trust.seconds, 3, 4.5));
    out.push(trust);
    if (brand.endcard !== false) out.push(beat('endcard', { title: f.title, cta: f.isAI ? 'Try 10 free runs' : 'Try it free', proof: [], text: f.isAI ? '10 free runs a month at 1234tools.com' : 'Free at 1234tools.com', qr: brand.qr !== false }));
    const name = toolName(f);
    for (const sc of out) {
      if (sc.type === 'hook') setVO(sc, toSpeech(sc.text));
      else if (sc.type === 'example') { sc.path = f.path; setVO(sc, exampleSpeech(sc.ex, f)); }
      else if (sc.type === 'endcard') { setVO(sc, 'Try ' + name + (f.isAI ? '. Ten free runs a month on 1234Tools.' : ', free on 1234Tools.') + ' The link is in our bio.'); sc.voEnd = sc._vo; }
      else if (sc === out[1]) setVO(sc, name + '. ' + toSpeech(f.first));
      else setVO(sc, toSpeech(sc.text));
    }
    return out;
  }

  /* ---- the visitor's script: one line per scene, with an optional beat word ---- */
  const TEMPLATES = [
    ['problem', 'Problem → Solution', 'Hook, the pain, why the usual fixes annoy, your fix, three steps, a call to action.',
      'HOOK: Still [doing the boring task] by hand?\nPAIN: The problem | Every [week] you lose [an hour] to [the boring task].\nUSUAL: The usual way | [Workaround one] | [Workaround two] | [Workaround three]\nFIX: [Your product] | [What it does for them], in [how long].\nSTEPS: How it works | [Step one] | [Step two] | [Step three]\nCTA: Follow for more [topic] tips'],
    ['beforeafter', 'Before / After', 'The result first, then the before and after side by side, what changed, how to copy it.',
      'HOOK: [The result] in [how long]. Here’s the before.\nVERSUS: Before | [What it looked like before] | After | [What it looks like now]\nTEXT: What changed: [the one thing you did]\nSTEPS: Do it yourself | [Step one] | [Step two] | [Step three]\nCTA: Save this for your next [project]'],
    ['mistakes', '3 Mistakes', 'Three mistakes, crossed out one at a time, then the better way.',
      'HOOK: 3 [topic] mistakes almost everyone makes\nMISTAKE: 1 | [Mistake one] — [why it hurts]\nMISTAKE: 2 | [Mistake two] — [why it hurts]\nMISTAKE: 3 | [Mistake three] — [why it hurts]\nFIX: Do this instead | [The better way, in one line]\nCTA: Follow so you never make them again'],
    ['myth', 'Myth vs Fact', 'A belief, crossed out, and what is actually true — twice.',
      'HOOK: [A common belief]? Not quite.\nVERSUS: Myth | [What people believe] | Fact | [What is actually true]\nVERSUS: Myth | [A second belief] | Fact | [The truth about it]\nTEXT: [One line on why it matters]\nCTA: Follow for more [topic] facts'],
    ['howto', 'How-to in 3 steps', 'The promise, one step per scene, then a recap.',
      'HOOK: How to [get the result] in 3 steps\nPOINT: 1 | [First, do this]\nPOINT: 2 | [Then this]\nPOINT: 3 | [Finally, this]\nSTEPS: Recap | [Step one] | [Step two] | [Step three]\nCTA: Save this for later'],
    ['top5', 'Listicle (Top 5)', 'Five picks counted down, the best last.',
      'HOOK: Top 5 [things] for [who it is for]\nPOINT: 5 | [Fifth pick] — [why]\nPOINT: 4 | [Fourth pick] — [why]\nPOINT: 3 | [Third pick] — [why]\nPOINT: 2 | [Second pick] — [why]\nPOINT: 1 | [Top pick] — [why it wins]\nCTA: Which one would you pick? Tell me below'],
    ['testimonial', 'Testimonial-style', 'A customer’s own words — use a real quote, with their permission; nothing here is invented for you.',
      'HOOK: “[The result your customer got, in their words]”\nQUOTE: [Paste a real quote from a customer, with their permission] | [Customer name, what they do]\nPAIN: Before | [What they struggled with]\nFIX: [Your product] | [What changed for them]\nCTA: [Your call to action]']
  ];
  /** The scene types a template makes, in order (the browser test checks these). */
  const TEMPLATE_TYPES = {};
  const LINE_RE = /^(HOOK|PAIN|USUAL|FIX|STEPS|POINT|MISTAKE|VERSUS|QUOTE|CTA|TEXT)\s*:\s*(.*)$/;
  function sceneOfLine(kind, rest) {
    const parts = rest.split(/\s*\|\s*/).map((x) => x.trim());
    switch (kind) {
      case 'HOOK': return beat('hook', { text: parts.join(' '), emphasis: [keyWordOf(parts.join(' '))] });
      case 'PAIN': return parts.length > 1 ? beat('pain', { eyebrow: parts[0], text: parts.slice(1).join(' ') }) : beat('pain', { eyebrow: 'Sound familiar?', text: parts[0] });
      case 'USUAL': return beat('usual', { heading: parts[0], text: parts.slice(1).filter(Boolean).join('\n'), foot: '' });
      case 'FIX': return beat('fix', { heading: parts[0], text: parts.slice(1).join(' '), eyebrow: 'The fix' });
      case 'STEPS': return beat('steps', { heading: parts[0], text: parts.slice(1).filter(Boolean).join('\n'), eyebrow: '' });
      case 'POINT': case 'MISTAKE': {
        const num = parts.length > 1 ? parts[0] : '';
        return beat('point', { heading: num, text: parts.length > 1 ? parts.slice(1).join(' ') : parts[0], bad: kind === 'MISTAKE' });
      }
      case 'VERSUS': {
        const p = parts.concat(['', '', '', '']);
        const labels = p.length >= 4 && parts.length >= 4 ? [p[0], p[2]] : ['Myth', 'Fact'];
        const lines = parts.length >= 4 ? [p[1], p[3]] : [p[0], p[1]];
        return beat('versus', { heading: labels.join(' | '), text: lines.join('\n') });
      }
      case 'QUOTE': return beat('quote', { text: parts[0], heading: parts.slice(1).join(' ') });
      case 'CTA': return beat('cta', { text: parts.join(' ') });
      default: return beat('text', { text: parts.join(' ') });
    }
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
  /**
   * One scene per line. "HOOK:", "PAIN:", "USUAL:", "FIX:", "STEPS:", "POINT:", "MISTAKE:", "VERSUS:", "QUOTE:", "CTA:" or "TEXT:"
   * at the start makes that kind of scene (parts split by "|"); a line made only of #words colours those words in the scene above.
   */
  function scenesFromScript(text) {
    const scenes = [];
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (/^#\S+(\s+#\S+)*$/.test(line)) {
        const prev = scenes[scenes.length - 1];
        if (prev) { prev.emphasis = (prev._userEm ? prev.emphasis || [] : []).concat(line.split(/\s+/).map((w) => w.replace(/^#/, '')).filter(Boolean)); prev._userEm = true; }
        continue;
      }
      const m = LINE_RE.exec(line);
      if (m) { scenes.push(sceneOfLine(m[1], m[2])); continue; }
      for (const part of splitLong(line)) scenes.push(beat('text', { text: part }));
    }
    scenes.shrunk = fitToMax(scenes);
    return scenes;
  }
  for (const [id, , , body] of TEMPLATES) TEMPLATE_TYPES[id] = scenesFromScript(body).map((s) => s.type);
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
    for (const w of String(text || '').toLowerCase().replace(/\[[^\]]*\]/g, ' ').match(/[a-z][a-z0-9]{4,}/g) || []) { if (!STOP.has(w)) count.set(w, (count.get(w) || 0) + 1); }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([w]) => '#' + w.charAt(0).toUpperCase() + w.slice(1));
    return top.concat(['#Reels']);
  }
  function qrUrlFor(path, source) {
    const f = factsOf({ title: '', path: String(path || '').replace(/^\/+/, '') });
    return SITE + '/' + f.path + '?utm_source=' + encodeURIComponent(source || 'instagram') + '&utm_medium=social&utm_campaign=' + encodeURIComponent(f.sectionSlug) + '&utm_content=' + encodeURIComponent(f.slug);
  }
  /**
   * The Instagram caption, hook first, in one of three shapes picked with the look (so a new look is a new caption too):
   * 0 the story (pain → fix → steps), 1 the usual way crossed out → instead, 2 who it is for → the promise → save it.
   * Every shape ends with the link-in-bio line and 5–8 hashtags; the share module adds its "Made free, on my device" line.
   */
  function captionFor(S) {
    S = S || CUR;
    if (!S) return '';
    const text = captionBody(S);
    if (!(S.voice && S.voice.generated)) return text;
    /* a generated voice is disclosed in the caption, just above the hashtags */
    const line = '🔊 The voiceover is an AI-generated voice.';
    const m = /\n\n(#[^\n]*)$/.exec(text);
    return m ? text.slice(0, m.index) + '\n' + line + text.slice(m.index) : text + '\n' + line;
  }
  function captionBody(S) {
    const firstText = S.scenes.find((s) => isWordy(s));
    if (S.promote) {
      const f = factsOf(S.promote);
      const story = storyFor(f.path);
      const hook = oneLine(firstText ? firstText.text : f.title);
      const bio = 'Link in bio → ' + f.url + ' ' + f.emoji;
      const tags = tagsFor(S.promote).join(' ');
      if (!story) {
        const line3 = pickBy(f.path + '#3', f.offlineOk ? ['Save this for later.', 'Works offline once opened.', 'Send it to someone who needs it.'] : ['Save this for later.', 'Send it to someone who needs it.']);
        return [hook, f.first, f.trustSentence, line3, bio, '', tags].join('\n');
      }
      const shape = ((S.look && S.look.copy) || 0) % 3;
      const proof = (story.proof || []).join(' · ');
      const lines = [hook, ''];
      if (shape === 0) {
        lines.push(story.pain, '', 'The fix: ' + f.title + '. ' + story.promise, story.steps.map((s, i) => (i + 1) + ') ' + s).join('  '), proof);
      } else if (shape === 1) {
        lines.push('The usual way:', story.usual.map((u) => '✗ ' + u).join('\n'), '', 'Instead: ' + story.promise, proof);
      } else {
        lines.push((story.persona || 'Anyone') + ': this one is for you.', story.promise, '', proof, 'Save this for later.');
      }
      lines.push((story.cta ? story.cta + ' → ' : '') + bio, '', tags);
      return lines.join('\n').replace(/\n{3,}/g, '\n\n');
    }
    const texts = S.scenes.filter((s) => isWordy(s)).map((s) => spoken(s));
    const out = [texts[0] || ''];
    let body = texts.slice(1, 3).join(' ');
    if (body.length > 180) { body = body.slice(0, 180); body = body.slice(0, body.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '.'; }
    if (body) out.push(body);
    if (S.brand.url) out.push('Link in bio → ' + S.brand.url);
    out.push('', scriptTags(texts.join(' ')).join(' '));
    return out.join('\n').trim();
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
  /* type: laying words out, fitting them, drawing them in motion       */
  /* ------------------------------------------------------------------ */
  const HEAD = '"Sora", "Inter", Arial, sans-serif';
  const BODY = '"Inter", "Sora", Arial, sans-serif';
  const SERIF = "'Palatino Linotype', 'Book Antiqua', Palatino, 'Iowan Old Style', Georgia, 'Times New Roman', serif";
  const MONO = "'Cascadia Code', 'Cascadia Mono', Consolas, 'Courier New', monospace";
  const HAS_LS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
  const MEASURE = document.createElement('canvas').getContext('2d');
  const fontCss = (weight, px, fam, italic) => (italic ? 'italic ' : '') + weight + ' ' + Math.max(1, px).toFixed(2) + 'px ' + fam;
  const fontOf = (weight, px, font) => weight + ' ' + px + 'px "' + (font || 'Sora') + '", "Inter", Arial, sans-serif';
  let FONTGEN = 0;
  /* Text that did not fit its box, and the smallest size drawn — the browser test reads both. */
  const OVER = [];
  const overSeen = new Set();
  let MIN_PX = Infinity;
  /* the smallest any text is drawn: 20 px on a 1080-wide frame, about 7 pt on a phone */
  let FLOOR = 20;
  const setFloor = (W, H) => { FLOOR = 20 * Math.min(W, H) / 1080; };
  function noteOver(what) {
    if (overSeen.has(what)) return;
    overSeen.add(what);
    OVER.push(what);
    console.warn('Reel Maker: text does not fit — ' + what);
  }

  /**
   * Words of `text` laid out at o.px within o.maxW. o: { px, weight, fam, upper, lh, track (em), hl: [a, b) of the text, hlItalic }.
   * Returns { lines: [{ words: [{ t, x, w, hl, i, li, c0 }], w }], px, lh, h, w, n, chars, fBase, fHl, ls }.
   */
  function layWords(text, o) {
    const src = String(text || '');
    const shown = o.upper ? src.toUpperCase() : src;
    const px = o.px;
    const fBase = fontCss(o.weight, px, o.fam, !!o.italic), fHl = fontCss(o.weight, px, o.fam, !!(o.italic || o.hlItalic));
    const ls = HAS_LS && o.track ? (o.track * px).toFixed(2) + 'px' : '0px';
    const M = MEASURE;
    if (HAS_LS) M.letterSpacing = ls;
    const meas = (t, hl) => { M.font = hl ? fHl : fBase; return M.measureText(t).width; };
    M.font = fBase;
    const space = M.measureText(' ').width;
    const hl = o.hl;
    const lines = [];
    let pos = 0, i = 0, c0 = 0;
    for (const para of shown.split('\n')) {
      let line = { words: [], w: 0 };
      const re = /\S+/g;
      let m;
      while ((m = re.exec(para))) {
        const a = pos + m.index, b = a + m[0].length;
        const isHl = !!(hl && a < hl[1] && b > hl[0]);
        const w = meas(m[0], isHl);
        const x = line.words.length ? line.w + space : 0;
        if (line.words.length && x + w > o.maxW) { lines.push(line); line = { words: [], w: 0 }; }
        const wx = line.words.length ? line.w + space : 0;
        line.words.push({ t: m[0], x: wx, w, hl: isHl, i: i++, li: lines.length, c0 });
        line.w = wx + w;
        c0 += m[0].length + 1;
      }
      lines.push(line);
      pos += para.length + 1;
    }
    for (let li = 0; li < lines.length; li++) for (const w of lines[li].words) w.li = li;
    while (lines.length > 1 && !lines[lines.length - 1].words.length) lines.pop();
    const lh = px * (o.lh || 1.1);
    const widest = lines.reduce((a, l) => Math.max(a, l.w), 0);
    return { lines, px, lh, h: lines.length * lh, w: widest, n: i, chars: c0, fBase, fHl, ls, space };
  }
  /** layWords, shrinking until it fits maxW × maxLines (and maxH). Flags `over` when even minPx does not fit. */
  function fitWords(text, o, maxW, maxLines, minPx, maxH) {
    let px = Math.max(o.px, FLOOR), lay;
    minPx = Math.max(minPx || 0, FLOOR);
    for (let k = 0; k < 48; k++) {
      lay = layWords(text, Object.assign({}, o, { px, maxW }));
      const okH = maxH ? lay.h <= maxH + 0.5 : true;
      if (lay.w <= maxW + 0.5 && lay.lines.length <= (maxLines || 99) && okH) return lay;
      if (px <= minPx + 0.01) break;
      px = Math.max(minPx, px * 0.94);
    }
    lay.over = true;
    return lay;
  }
  /** A figure counting up: "₹11,800.00" at p = 0.5 is "₹5,900.00", grouping (Indian or Western) and decimals kept. */
  function countText(final, p) {
    const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(String(final));
    if (!m || p >= 1) return final;
    const num = m[2], n = parseFloat(num.replace(/,/g, ''));
    if (!isFinite(n)) return final;
    const dec = (num.split('.')[1] || '').length;
    const v = (n * clamp(p, 0, 1)).toFixed(dec);
    let [ip, fp] = v.split('.');
    if (num.indexOf(',') >= 0) {
      if (/\d,\d\d,\d{3}/.test(num)) { const last3 = ip.slice(-3); let rest = ip.slice(0, -3); const parts = []; while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); } if (rest) parts.unshift(rest); ip = parts.concat(last3).filter(Boolean).join(','); }
      else ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return m[1] + ip + (fp !== undefined ? '.' + fp : '') + m[3];
  }
  /** Where a word is at time `local` for a motion style: alpha, scale, offset, how many characters are typed. */
  function wordState(motion, wd, lay, local, seconds) {
    switch (motion) {
      case 'pop': {
        const st = Math.min(0.075, 1.0 / Math.max(1, lay.n));
        const d = wd.i * st + (wd.hl ? 0.08 : 0);
        const p = clamp((local - d) / 0.34, 0, 1);
        const t = local - d - 0.34;
        /* a small overshoot only: a word that grows past its slot runs into its neighbour */
        return { a: clamp(p * 3, 0, 1), s: (0.5 + 0.5 * backOut(p, 1.4)) * (wd.hl ? 1 + 0.06 * bump(t / 0.45) : 1), dy: (1 - ease3(p)) * lay.lh * 0.35, chars: Infinity, t };
      }
      case 'slide': {
        const d = wd.li * 0.12, p = clamp((local - d) / 0.5, 0, 1);
        return { a: 1, s: 1, dy: (1 - ease3(p)) * lay.lh * 1.08, clip: true, chars: Infinity, t: local - d - 0.5 };
      }
      case 'type': {
        const cps = clamp(lay.chars / Math.max(0.6, seconds * 0.42), 18, 48);
        const shown = Math.max(0, local) * cps;
        const c = Math.floor(shown - wd.c0);
        return { a: c > 0 ? 1 : 0, s: 1, dy: 0, chars: c, t: (shown - wd.c0 - wd.t.length) / cps, cps };
      }
      case 'fade': {
        const d = wd.li * 0.08, p = ease3((local - d) / 0.45);
        return { a: p, s: 1, dy: (1 - p) * lay.px * 0.25, chars: Infinity, t: local - d - 0.45 };
      }
      case 'punch': return { a: 1, s: wd.hl ? 1 + 0.16 * bump((local - 0.26) / 0.34) : 1, dy: 0, chars: Infinity, t: local - 0.3 };
      default: return { a: 1, s: 1, dy: 0, chars: Infinity, t: 9 };
    }
  }
  const OK_DARK = '#4ade80', OK_LIGHT = '#15803d';
  const okOf = (L) => (L.light ? OK_LIGHT : OK_DARK);
  /**
   * Draw a laid-out block at (x, y) (top-left of a column `w` wide), in motion.
   * o: { align, at, motion, treat ('gradient'|'outline'|'marker'|'caps'|'serif'|'plain'), ink, coral, field (on the split colour field),
   *      count: word index that counts up, alpha }.
   */
  function drawBlock(g, lay, x, y, w, o) {
    const ctx = g.ctx, L = g.look;
    const motion = o.motion || 'none';
    const local = g.local - (o.at || 0);
    if (local < 0 && motion !== 'none') return;
    if (lay.px < MIN_PX) MIN_PX = lay.px;
    const ink = o.ink || L.ink;
    const treat = o.treat || 'plain';
    const coral = !!o.coral;
    ctx.save();
    ctx.globalAlpha = clamp(g.alpha * (o.alpha === undefined ? 1 : o.alpha), 0, 1);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    if (HAS_LS) ctx.letterSpacing = lay.ls;
    const lx = (line) => x + (o.align === 'center' ? (w - line.w) / 2 : o.align === 'right' ? w - line.w : 0);
    const bx0 = x + (o.align === 'center' ? (w - lay.w) / 2 : 0), by0 = y;
    if (motion === 'punch') {
      const p = clamp(local / 0.3, 0, 1);
      const sc = 1 + 0.55 * (1 - easeExpo(p));
      const cx = bx0 + lay.w / 2, cy = y + lay.h / 2;
      ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
      ctx.globalAlpha *= clamp(p * 3, 0, 1);
    }
    const hlSolid = coral ? L.coralInk : L.accentInk;
    const bigEnough = lay.px >= 40 * g.U;
    const markerCol = coral ? 'rgba(255,107,107,.38)' : (L.marker ? hexA(L.marker, 0.85) : hexA(L.accent, 0.38));
    /* marker bands go under every word */
    if (treat === 'marker' && !o.field) {
      lay.lines.forEach((line, li) => {
        const words = line.words;
        for (let k = 0; k < words.length; k++) {
          const wd = words[k];
          if (!wd.hl) continue;
          const st = wordState(motion, wd, lay, local, g.seconds);
          if (st.a <= 0) continue;
          const sweep = motion === 'none' ? 1 : ease3((st.t + 0.12) / 0.32);
          if (sweep <= 0) continue;
          const nextHl = words[k + 1] && words[k + 1].hl;
          const bw = (wd.w + (nextHl ? lay.space : 0) + lay.px * 0.08) * sweep;
          const top = y + li * lay.lh + st.dy;
          ctx.fillStyle = markerCol;
          ctx.fillRect(lx(line) + wd.x - lay.px * 0.04, top + lay.lh * 0.5, bw, lay.lh * 0.38);
        }
      });
    }
    let grad = null;
    let caret = null;
    lay.lines.forEach((line, li) => {
      const top = y + li * lay.lh;
      const cy = top + lay.lh / 2;
      for (const wd of line.words) {
        const st = wordState(motion, wd, lay, local, g.seconds);
        if (st.a <= 0.001 || st.chars <= 0) continue;
        let t = wd.t;
        if (st.chars < t.length) t = t.slice(0, st.chars);
        if (o.count === wd.i && motion !== 'type') t = countText(wd.t, ease3((local - 0.05) / 1.0));
        const wx = lx(line) + wd.x, ww = wd.w;
        ctx.save();
        ctx.globalAlpha *= st.a;
        if (st.clip) { ctx.beginPath(); ctx.rect(x - lay.px, top - lay.lh * 0.18, w + lay.px * 2, lay.lh * 1.3); ctx.clip(); }
        const cx = wx + ww / 2, wy = cy + st.dy;
        ctx.translate(cx, wy);
        if (st.s !== 1) ctx.scale(st.s, st.s);
        ctx.font = wd.hl ? lay.fHl : lay.fBase;
        const tx = -ww / 2;
        if (wd.hl && o.field) {
          ctx.fillStyle = ink; ctx.fillText(t, tx, 0);
          ctx.fillRect(tx, lay.px * 0.42, ctx.measureText(t).width, Math.max(2, lay.px * 0.05));
        } else if (wd.hl && treat === 'gradient' && !coral) {
          /* the gradient spans this line's highlighted run, like the kits' clipped .hl span */
          const s = st.s || 1;
          const run = line.words.filter((q) => q.hl);
          const rx0 = lx(line) + run[0].x, rx1 = lx(line) + run[run.length - 1].x + run[run.length - 1].w;
          grad = ctx.createLinearGradient((rx0 - cx) / s, (top - wy) / s, (rx1 - cx) / s, (top + lay.lh - wy) / s);
          grad.addColorStop(0, L.grad[0]); grad.addColorStop(0.42, L.grad[1]); grad.addColorStop(0.92, L.grad[2]);
          ctx.fillStyle = grad; ctx.fillText(t, tx, 0);
        } else if (wd.hl && treat === 'outline' && bigEnough) {
          ctx.lineWidth = lay.px * 0.064; ctx.strokeStyle = coral ? L.coralInk : L.accent;
          ctx.strokeText(t, tx, 0);
        } else if (wd.hl && treat !== 'marker') {
          ctx.fillStyle = hlSolid; ctx.fillText(t, tx, 0);
        } else {
          ctx.fillStyle = ink; ctx.fillText(t, tx, 0);
        }
        ctx.restore();
        if (motion === 'type' && st.chars < wd.t.length + 1) caret = { x: wx + (st.chars >= wd.t.length ? ww : MEASURE_W(lay, wd, t)), y: cy };
      }
    });
    if (motion === 'type') {
      const last = lay.lines[lay.lines.length - 1];
      const lw = last.words[last.words.length - 1];
      const typingDone = !caret && lw && wordState('type', lw, lay, local, g.seconds).chars >= lw.t.length;
      if (!caret && typingDone) caret = { x: lx(last) + last.w + lay.px * 0.06, y: y + (lay.lines.length - 0.5) * lay.lh, idle: true };
      if (caret && (!caret.idle || (local * 2.2) % 1 < 0.55) && local < g.seconds - 0.2) {
        ctx.fillStyle = L.accent;
        ctx.fillRect(caret.x + lay.px * 0.03, caret.y - lay.px * 0.42, Math.max(2, lay.px * 0.07), lay.px * 0.84);
      }
    }
    ctx.restore();
  }
  function MEASURE_W(lay, wd, t) { MEASURE.font = wd.hl ? lay.fHl : lay.fBase; if (HAS_LS) MEASURE.letterSpacing = lay.ls; return MEASURE.measureText(t).width; }
  /** Spaced capitals on one line (eyebrows, tags), fitted to maxW. Returns the width drawn. */
  function capsLine(ctx, text, x, y, px, colour, track, weight, maxW, align, fam) {
    const t = String(text || '').toUpperCase();
    let size = Math.max(px, FLOOR), w = 0;
    for (let k = 0; k < 30; k++) {
      ctx.font = fontCss(weight || 700, size, fam || BODY);
      if (HAS_LS) ctx.letterSpacing = (track * size).toFixed(2) + 'px';
      w = ctx.measureText(t).width + (HAS_LS ? 0 : t.length * track * size);
      if (!maxW || w <= maxW || size <= FLOOR + 0.01) break;
      size = Math.max(FLOOR, size * 0.94);
    }
    if (maxW && w > maxW + 0.5) noteOver('caps line "' + t.slice(0, 30) + '"');
    if (size < MIN_PX) MIN_PX = size;
    ctx.fillStyle = colour; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    if (HAS_LS) ctx.fillText(t, x0, y);
    else { let cx = x0; for (const ch of t) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + track * size; } }
    if (HAS_LS) ctx.letterSpacing = '0px';
    return w;
  }
  /** One line of plain text, shrunk to maxW (never below minPx: then it is cut with an ellipsis, a display choice, not an overflow). */
  function fitLine(text, px, weight, fam, maxW, minPx) {
    minPx = Math.max(minPx || 0, FLOOR);
    let size = Math.max(px, FLOOR), t = String(text || '');
    MEASURE.font = fontCss(weight, size, fam); if (HAS_LS) MEASURE.letterSpacing = '0px';
    let w = MEASURE.measureText(t).width;
    while (w > maxW && size > minPx) { size = Math.max(minPx, size * 0.94); MEASURE.font = fontCss(weight, size, fam); w = MEASURE.measureText(t).width; }
    if (w > maxW) { while (t.length > 1 && MEASURE.measureText(t + '…').width > maxW) t = t.slice(0, -1); t = t.replace(/\s+$/, '') + '…'; w = MEASURE.measureText(t).width; }
    return { t, px: size, w, font: fontCss(weight, size, fam) };
  }
  function drawLine(ctx, fl, x, y, colour, align) {
    if (fl.px < MIN_PX) MIN_PX = fl.px;
    ctx.font = fl.font; if (HAS_LS) ctx.letterSpacing = '0px';
    ctx.fillStyle = colour; ctx.textBaseline = 'middle'; ctx.textAlign = align || 'left';
    ctx.fillText(fl.t, x, y);
    ctx.textAlign = 'left';
  }
  /** Line icons on the kits' 24-unit grid. */
  function icon(ctx, name, cx, cy, size, colour, lw) {
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = lw || 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    switch (name) {
      case 'x': ctx.moveTo(6.5, 6.5); ctx.lineTo(17.5, 17.5); ctx.moveTo(17.5, 6.5); ctx.lineTo(6.5, 17.5); ctx.stroke(); break;
      case 'check': ctx.moveTo(5, 12.5); ctx.lineTo(10, 17.5); ctx.lineTo(19, 7); ctx.stroke(); break;
      case 'person': ctx.arc(12, 8, 4, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(4.5, 20.5); ctx.bezierCurveTo(4.5, 16, 8, 13.6, 12, 13.6); ctx.bezierCurveTo(16, 13.6, 19.5, 16, 19.5, 20.5); ctx.stroke(); break;
      case 'spark': ctx.moveTo(12, 2.5); ctx.lineTo(14, 10); ctx.lineTo(21.5, 12); ctx.lineTo(14, 14); ctx.lineTo(12, 21.5); ctx.lineTo(10, 14); ctx.lineTo(2.5, 12); ctx.lineTo(10, 10); ctx.closePath(); ctx.fill(); break;
      case 'arrow': ctx.moveTo(4.5, 12); ctx.lineTo(19, 12); ctx.moveTo(13, 6); ctx.lineTo(19, 12); ctx.lineTo(13, 18); ctx.stroke(); break;
      case 'arrowDown': ctx.moveTo(12, 4.5); ctx.lineTo(12, 19); ctx.moveTo(6, 13); ctx.lineTo(12, 19); ctx.lineTo(18, 13); ctx.stroke(); break;
      case 'lr': ctx.moveTo(4, 12); ctx.lineTo(20, 12); ctx.moveTo(8, 8); ctx.lineTo(4, 12); ctx.lineTo(8, 16); ctx.moveTo(16, 8); ctx.lineTo(20, 12); ctx.lineTo(16, 16); ctx.stroke(); break;
      case 'bookmark': ctx.moveTo(6.5, 3.5); ctx.lineTo(17.5, 3.5); ctx.lineTo(17.5, 20.5); ctx.lineTo(12, 16.5); ctx.lineTo(6.5, 20.5); ctx.closePath(); ctx.globalAlpha *= 0.18; ctx.fill(); ctx.globalAlpha /= 0.18; ctx.stroke(); break;
      case 'doc': ctx.moveTo(6, 3); ctx.lineTo(14, 3); ctx.lineTo(19, 8); ctx.lineTo(19, 21); ctx.lineTo(6, 21); ctx.closePath(); ctx.moveTo(14, 3); ctx.lineTo(14, 8); ctx.lineTo(19, 8); ctx.moveTo(9, 12.5); ctx.lineTo(16, 12.5); ctx.moveTo(9, 16); ctx.lineTo(14, 16); ctx.stroke(); break;
      case 'table': ctx.rect(3.5, 5, 17, 14); ctx.moveTo(3.5, 10); ctx.lineTo(20.5, 10); ctx.moveTo(3.5, 14.5); ctx.lineTo(20.5, 14.5); ctx.moveTo(10, 5); ctx.lineTo(10, 19); ctx.stroke(); break;
      case 'photo': ctx.rect(3.5, 5, 17, 14); ctx.moveTo(3.5, 16); ctx.lineTo(9, 11); ctx.lineTo(13, 15); ctx.lineTo(15.5, 12.5); ctx.lineTo(20.5, 17); ctx.stroke(); ctx.beginPath(); ctx.arc(15.5, 8.8, 1.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'text': ctx.moveTo(5, 7); ctx.lineTo(19, 7); ctx.moveTo(5, 11); ctx.lineTo(19, 11); ctx.moveTo(5, 15); ctx.lineTo(15, 15); ctx.moveTo(5, 19); ctx.lineTo(12, 19); ctx.stroke(); break;
      default: break;
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* the background: the kits' atmosphere, in four treatments           */
  /* ------------------------------------------------------------------ */
  const layerCache = new Map();
  function cachedLayer(key, w, h, paint) {
    let c = layerCache.get(key);
    if (c) return c;
    if (layerCache.size > 24) layerCache.clear();
    c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    paint(c.getContext('2d'), c.width, c.height);
    layerCache.set(key, c);
    return c;
  }
  const rgbaA = (rgba, k) => String(rgba).replace(/,\s*([\d.]+)\)$/, (m, a) => ',' + (parseFloat(a) * k).toFixed(3) + ')');
  function glowAt(ctx, cx, cy, rx, ry, colour) {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, colour); g.addColorStop(1, rgbaA(colour, 0));
    ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  function drawBackground(ctx, W, H, t, L, scene, S) {
    const U = Math.min(W, H) / 1080;
    const ph = REDUCED ? 0 : t;
    /* the base and its soft glows are smooth, so they are painted at a quarter of the size and scaled up: four
       full-frame radial gradients a frame were the slowest part of an export */
    const q = 4, aw = Math.ceil(W / q), ah = Math.ceil(H / q);
    const atmo = cachedLayer('atmo|' + aw + 'x' + ah, aw, ah, () => {});
    const ax = atmo.getContext('2d');
    ax.setTransform(1 / q, 0, 0, 1 / q, 0, 0);
    const g0 = ax.createLinearGradient(0, 0, 0, H);
    g0.addColorStop(0, L.bg[0]); g0.addColorStop(1, L.bg[1]);
    ax.fillStyle = g0; ax.fillRect(0, 0, W, H);
    const k = L.bgT === 'grid' ? 0.7 : 1;
    if (L.bgT === 'mesh') {
      const a = L.light ? 0.34 : 0.22;
      const cols = [L.grad[0], L.grad[2], L.chip[1], L.accent];
      const R = Math.max(W, H) * 0.62;
      cols.forEach((c, i) => {
        const cx = W * (0.5 + 0.42 * Math.cos(ph * 0.21 + i * 1.7)), cy = H * (0.52 + 0.34 * Math.sin(ph * 0.17 + i * 2.3));
        glowAt(ax, cx, cy, R * (0.8 + 0.1 * i), R * (0.8 + 0.1 * i), hexA(c, a * (i === 3 ? 0.5 : 1)));
      });
    } else {
      /* the kits' three glows (style.js .deco g1/g2/g3), drifting */
      glowAt(ax, W * (0.2 + 0.03 * Math.sin(ph * 0.4)), H * (0.24 + 0.02 * Math.cos(ph * 0.33)), W * 0.62, H * 0.42, rgbaA(L.glowA, k));
      glowAt(ax, W * (0.82 + 0.03 * Math.cos(ph * 0.3)), H * (0.8 + 0.02 * Math.sin(ph * 0.37)), W * 0.64, H * 0.46, rgbaA(L.glowB, k));
      glowAt(ax, W * (0.86 + 0.02 * Math.sin(ph * 0.5)), H * 0.5, W * 0.34, H * 0.24, rgbaA(L.glowC, k));
    }
    ax.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(atmo, 0, 0, aw, ah, 0, 0, aw * q, ah * q);
    ctx.restore();
    if (L.bgT === 'glow' || L.bgT === 'mesh') {
      const sp = 30 * U;
      const dots = cachedLayer('dots|' + L.dot + '|' + W + 'x' + H, W, H, (x, w, h) => {
        x.fillStyle = L.dot;
        for (let yy = sp / 2; yy < h; yy += sp) for (let xx = sp / 2; xx < w; xx += sp) { x.beginPath(); x.arc(xx, yy, 1.6 * U, 0, Math.PI * 2); x.fill(); }
        x.globalCompositeOperation = 'destination-in';
        x.save(); x.translate(w * 0.78, h * 0.3); x.scale(1, 0.62 * h / w);
        const m = x.createRadialGradient(0, 0, 0, 0, 0, w * 0.8); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = m; x.fillRect(-w, -w, w * 2, w * 2); x.restore();
      });
      ctx.drawImage(dots, 0, 0);
    } else if (L.bgT === 'grid') {
      const sp = 72 * U;
      const grid = cachedLayer('grid|' + L.ink + '|' + W + 'x' + H, W, H + sp, (x, w, h) => {
        x.strokeStyle = hexA(L.ink, L.light ? 0.09 : 0.075); x.lineWidth = Math.max(1, 1.4 * U);
        x.beginPath();
        for (let xx = (w % sp) / 2; xx <= w; xx += sp) { x.moveTo(xx, 0); x.lineTo(xx, h); }
        for (let yy = 0; yy <= h; yy += sp) { x.moveTo(0, yy); x.lineTo(w, yy); }
        x.stroke();
        x.globalCompositeOperation = 'destination-in';
        x.save(); x.translate(w * 0.5, h * 0.5); x.scale(1, (h * 0.55) / (w * 0.75));
        const m = x.createRadialGradient(0, 0, 0, 0, 0, w * 0.75); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.6, 'rgba(0,0,0,.55)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = m; x.fillRect(-w * 2, -w * 2, w * 4, w * 4); x.restore();
      });
      ctx.drawImage(grid, 0, -((ph * 14 * U) % sp));
    } else if (L.bgT === 'grain') {
      const vig = cachedLayer('vig|' + W + 'x' + H + '|' + L.light, W, H, (x, w, h) => {
        x.save(); x.translate(w / 2, h / 2); x.scale(1, h / w);
        const m = x.createRadialGradient(0, 0, w * 0.25, 0, 0, w * 0.78); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, L.light ? 'rgba(60,40,8,.16)' : 'rgba(0,0,0,.42)');
        x.fillStyle = m; x.fillRect(-w, -w, w * 2, w * 2); x.restore();
      });
      ctx.drawImage(vig, 0, 0);
      const tile = cachedLayer('grain|' + L.light, 256, 256, (x, w, h) => {
        const id = x.createImageData(w, h), d = id.data, r = rng(1234);
        for (let i = 0; i < d.length; i += 4) { const v = r() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.round(r() * (L.light ? 22 : 16)); }
        x.putImageData(id, 0, 0);
      });
      const pat = ctx.createPattern(tile, 'repeat');
      /* a new grain per scene, still within it: grain that boils every frame costs the encoder its whole bitrate */
      const f = S && scene ? Math.max(0, S.scenes.indexOf(scene)) : Math.floor(t);
      const r = rng(f + 7);
      if (pat && pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([U * 1.5, 0, 0, U * 1.5, Math.floor(r() * 256), Math.floor(r() * 256)]));
      ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
    }
    /* the tool's glyph as a faint watermark, bottom right (the kits' .wm) */
    const wmId = S && S.promote ? S.promote.glyph : '';
    if (wmId) {
      const gc = glyphCanvas(wmId, L.ink, 'i-' + sectionOf(S.promote.path));
      if (gc) {
        ctx.save();
        ctx.globalAlpha = L.light ? 0.07 : 0.05;
        const s = W * 0.62;
        ctx.translate(W * 0.84, H * 0.8); ctx.rotate((-12 + 2 * Math.sin(ph * 0.3)) * Math.PI / 180);
        ctx.drawImage(gc, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
    /* keep the platform's own UI bands calm */
    const sf = safeOf(W, H);
    const top = ctx.createLinearGradient(0, 0, 0, sf.top * H);
    top.addColorStop(0, hexA(L.bg[0], 0.85)); top.addColorStop(1, hexA(L.bg[0], 0));
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, sf.top * H);
  }

  /* ------------------------------------------------------------------ */
  /* the frame's chrome: header, footer, progress                       */
  /* ------------------------------------------------------------------ */
  /**
   * The AI label at the top: "AI voice" while the voice is generated (it is
   * then always on), "AI-generated" when the visitor labels the reel. ''
   * when neither. The same switch writes the machine-readable note into the
   * MP4 (see aiMetadata).
   */
  function aiLabelOf(S) {
    if (!S || !S.brand) return '';
    if (S.brand.aiLabel) return 'AI-generated';
    return S.voice && S.voice.generated ? 'AI voice' : '';
  }
  /**
   * The machine-readable mark written into the MP4 when the reel is labelled
   * (aiimg-core tagMP4: moov/udta/meta/ilst ©cmt, ©too, desc). EU AI Act
   * Art. 50(2) asks providers of systems that generate synthetic audio or
   * video to mark the output "in a machine-readable format and detectable
   * as artificially generated or manipulated", from 2 August 2026
   * (https://artificialintelligenceact.eu/article/50/). A plain tag, not C2PA.
   * null when the reel is not labelled: then nothing is written.
   */
  const REEL_URL = 'https://www.1234tools.com/ai-video/reel-maker/';
  function aiMetadata(S) {
    const label = aiLabelOf(S);
    if (!label) return null;
    const what = S.voice && S.voice.generated
      ? 'Contains AI-generated audio (synthetic voice, Kokoro-82M).' + (S.brand.aiLabel ? ' Labelled by its maker as AI-generated.' : '')
      : 'Labelled by its maker as containing AI-generated content.';
    const text = what + ' Made with 1234Tools Reel Maker, ' + REEL_URL;
    return { comment: text, description: text, tool: '1234Tools Reel Maker (' + REEL_URL + ')' };
  }
  /** "Made with 1234Tools.com" at the bottom: on unless switched off in Export. */
  const madeWithOn = (S) => !!(S && S.brand && S.brand.madeWith !== false);
  const MADE_WITH = 'Made with 1234Tools.com';
  /* both marks sit on a plate in the look's own light or dark, 90% opaque, so the
     text keeps AA contrast whatever is underneath (a photo, a clip, a gradient) */
  const markColours = (L) => (L && L.light ? { plate: 'rgba(255,255,255,0.9)', ink: '#111522', edge: 'rgba(17,21,34,0.22)' } : { plate: 'rgba(6,8,15,0.9)', ink: '#ffffff', edge: 'rgba(255,255,255,0.32)' });
  function chromeOf(W, H, S) {
    const sf = safeOf(W, H), U = Math.min(W, H) / 1080;
    const promo = !!S.promote;
    const hasHead = promo || !!S.brand.logo || !!String(S.brand.handle || '').trim();
    const mx = W > H * 1.3 ? W * 0.15 : W * 0.065;
    /* the top: the AI label just below the app's own band, then the brand row */
    const ai = aiLabelOf(S);
    const pillY = sf.top * H + 10 * U, pillH = 44 * U;
    const headY = ai ? pillY + pillH + 14 * U : sf.top * H + 10 * U, headH = 58 * U;
    /* the bottom: the credit just above the app's band, then the progress bar, then the URL line */
    const bandTop = (1 - sf.bottom) * H;
    const credit = madeWithOn(S);
    const credH = 34 * U, credY = bandTop - 8 * U - credH;
    const barH = Math.max(4, 7 * U);
    const barY = (credit ? credY - 12 * U : bandTop - 12 * U) - barH;
    const footY = barY - 30 * U;
    const showFoot = promo || !!String(S.brand.url || '').trim();
    return { sf, U, mx, headY, headH, hasHead, barY, barH, footY, showFoot, promo, ai, pillY, pillH, credit, credY, credH, bandTop };
  }
  /** The AI label: a small pill, left-aligned with the content, just below the top band. */
  function drawAiLabel(ctx, W, H, L, S) {
    const c = chromeOf(W, H, S);
    if (!c.ai) return null;
    const U = c.U, col = markColours(L);
    ctx.save();
    ctx.font = fontCss(700, 24 * U, HEAD);
    const tw = ctx.measureText(c.ai).width;
    const dot = 10 * U, padX = 18 * U;
    const w = padX + dot + 10 * U + tw + padX, x = c.mx, y = c.pillY, h = c.pillH;
    ctx.fillStyle = col.plate; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = col.edge; ctx.lineWidth = 1.5 * U; ctx.stroke();
    /* a small sparkle-like dot in the look's accent marks it as a label, not content */
    ctx.fillStyle = L.light ? '#111522' : (L.accent || '#f7c948');
    ctx.beginPath(); ctx.arc(x + padX + dot / 2, y + h / 2, dot / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(c.ai, x + padX + dot + 10 * U, y + h / 2 + 1 * U);
    ctx.restore();
    return { x, y, w, h };
  }
  /** "Made with 1234Tools.com": small, centred, on its plate, just above the bottom band. */
  function drawMadeWith(ctx, W, H, L, S) {
    const c = chromeOf(W, H, S);
    if (!c.credit) return null;
    const U = c.U, col = markColours(L);
    ctx.save();
    ctx.font = fontCss(600, 20 * U, BODY);
    const tw = ctx.measureText(MADE_WITH).width;
    const w = tw + 32 * U, h = c.credH, x = (W - w) / 2, y = c.credY;
    ctx.fillStyle = col.plate; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = col.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(MADE_WITH, W / 2, y + h / 2 + 1 * U);
    ctx.restore();
    return { x, y, w, h };
  }
  /** The content box every beat is fitted into: below the header, above the footer, clear of the caption band when captions run. */
  function contentBox(W, H, S) {
    const c = chromeOf(W, H, S);
    const top = c.hasHead ? c.headY + c.headH + 34 * c.U : c.ai ? c.pillY + c.pillH + 30 * c.U : c.sf.top * H + 40 * c.U;
    let bottom = (c.showFoot ? c.footY - 22 * c.U : c.barY - 26 * c.U);
    if (S.captions && S.captions.source === 'auto' && S.captions.cues && S.captions.cues.length) bottom = Math.min(bottom, 0.69 * H);
    return { x: c.mx, y: top, w: W - 2 * c.mx, h: bottom - top, U: c.U };
  }
  function drawHeader(ctx, W, H, L, S, at) {
    const c = chromeOf(W, H, S);
    if (!c.hasHead) return;
    const U = c.U, y = c.headY, s = c.headH * 0.92, cy = y + c.headH / 2;
    let x = c.mx;
    const logo = S.brand.logo;
    ctx.save();
    if (logo) {
      if (L.light && L.palette !== 'block') { /* the logo is drawn for dark grounds */ }
      ctx.drawImage(logo, x, cy - s / 2, s, s);
      x += s + 16 * U;
    }
    const label = c.promo ? '1234Tools' : String(S.brand.handle || '').trim();
    let right = W - c.mx;
    if (c.promo && at && at.n > 1) {
      /* "3/7" in the chip gradient, like the kits' counter */
      const txt = (at.i + 1) + '/' + at.n;
      ctx.font = fontCss(800, 26 * U, HEAD);
      const tw = ctx.measureText(txt).width + 36 * U, th = 46 * U;
      const g = ctx.createLinearGradient(right - tw, 0, right, 0);
      g.addColorStop(0, L.chip[0]); g.addColorStop(0.5, L.chip[1]); g.addColorStop(1, L.chip[2]);
      ctx.fillStyle = g; roundRect(ctx, right - tw, cy - th / 2, tw, th, th / 2); ctx.fill();
      ctx.fillStyle = L.chipInk; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(txt, right - tw / 2, cy + 1 * U); ctx.textAlign = 'left';
      right -= tw + 12 * U;
      const sec = S.promote.section || '';
      if (sec && sec.length < 26) {
        const fl = fitLine(sec, 26 * U, 600, BODY, right - x - 220 * U, 18 * U);
        const pw = fl.w + 40 * U;
        ctx.fillStyle = L.light ? 'rgba(255,255,255,.62)' : hexA(L.ink, 0.06); roundRect(ctx, right - pw, cy - th / 2, pw, th, th / 2); ctx.fill();
        ctx.strokeStyle = hexA(L.ink, 0.16); ctx.lineWidth = 1.5 * U; ctx.stroke();
        drawLine(ctx, fl, right - pw / 2, cy + 1 * U, L.ink, 'center');
        right -= pw + 12 * U;
      }
    }
    if (label) {
      const fl = fitLine(label, (c.promo ? 34 : 30) * U, c.promo ? 800 : 600, HEAD, Math.max(40 * U, right - x - 10 * U), 18 * U);
      drawLine(ctx, fl, x, cy + 1 * U, L.ink, 'left');
    }
    ctx.restore();
  }
  function drawFooter(ctx, W, H, t, D, L, S, at) {
    const c = chromeOf(W, H, S);
    const U = c.U;
    ctx.save();
    if (c.showFoot && at && at.scene.type !== 'endcard') {
      const url = c.promo ? '1234tools.com/' + S.promote.path : String(S.brand.url || '').trim();
      const fl = fitLine(url, 22 * U, 600, BODY, W - 2 * c.mx, 16 * U);
      drawLine(ctx, fl, c.mx, c.footY, L.muted, 'left');
    }
    if (S.brand.progress && at) {
      /* one segment a scene, filling as it plays (the kits' .prog) */
      const n = at.n, gap = 10 * U, x0 = c.mx, w = W - 2 * c.mx;
      const sw = (w - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * (sw + gap);
        ctx.fillStyle = hexA(L.ink, L.light ? 0.16 : 0.18); roundRect(ctx, x, c.barY, sw, c.barH, c.barH / 2); ctx.fill();
        const f = i < at.i ? 1 : i > at.i ? 0 : clamp(at.local / Math.max(0.1, at.scene.seconds), 0, 1);
        if (f > 0) {
          const g = ctx.createLinearGradient(x, 0, x + sw, 0);
          g.addColorStop(0, L.chip[0]); g.addColorStop(0.5, L.chip[1]); g.addColorStop(1, L.chip[2]);
          ctx.fillStyle = g; roundRect(ctx, x, c.barY, Math.max(c.barH, sw * f), c.barH, c.barH / 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* beats: each is a stack of items fitted into the content box        */
  /* ------------------------------------------------------------------ */
  const famOf = (L, head) => (L.type === 'serif' && head ? SERIF : head ? HEAD : BODY);
  const motionOf = (sc, L) => { const a = OLD_ANIM[sc.anim] || sc.anim; return a && a !== 'auto' ? a : L.motion; };
  /** A headline item: kinetic words in the look's treatment. */
  function itHead(text, c, o) {
    const L = c.look, z = c.z;
    const caps = L.type === 'caps';
    const lay = fitWords(text, { px: o.px * z, weight: L.type === 'serif' ? 700 : 800, fam: famOf(L, true), upper: caps, lh: caps ? 0.98 : (o.lh || 1.04),
      track: caps ? -0.02 : -0.025, hl: o.hl, hlItalic: L.type === 'serif' }, c.w - (o.indent || 0), o.maxLines || 6, (o.minPx || 34) * c.U);
    return { h: lay.h, gap: o.gap === undefined ? 0 : o.gap * z, over: lay.over && 'headline "' + oneLine(text).slice(0, 40) + '"', lay,
      draw: (g, x, y, w) => drawBlock(g, lay, x + (o.indent || 0), y, w - (o.indent || 0), { align: c.align, at: o.at || 0, motion: c.motion, treat: o.field ? 'plain' : L.type, coral: o.coral, count: o.count, field: o.field, ink: o.ink }) };
  }
  /** A paragraph item: body type, words in motion (no treatment). */
  function itBody(text, c, o) {
    const L = c.look, z = c.z;
    const lay = fitWords(text, { px: o.px * z, weight: o.weight || 500, fam: o.fam || BODY, lh: o.lh || 1.3, track: -0.01, hl: o.hl }, c.w - (o.indent || 0), o.maxLines || 6, (o.minPx || 22) * c.U);
    return { h: lay.h, gap: (o.gap || 0) * z, over: lay.over && 'body "' + oneLine(text).slice(0, 40) + '"', lay,
      draw: (g, x, y, w) => drawBlock(g, lay, x + (o.indent || 0), y, w - (o.indent || 0), { align: o.align || c.align, at: o.at || 0, motion: o.motion || (c.motion === 'punch' ? 'fade' : c.motion), treat: 'plain', ink: o.ink || L.ink2 }) };
  }
  function itEyebrow(text, c, o) {
    const z = c.z, L = c.look;
    return { h: 36 * z, gap: (o.gap || 0) * z,
      draw: (g, x, y, w) => {
        const p = ease3((g.local - (o.at || 0)) / 0.35);
        if (p <= 0) return;
        const ctx = g.ctx;
        ctx.save(); ctx.globalAlpha = g.alpha * p;
        const colour = o.colour || L.accentInk;
        const isz = 32 * z, gap = o.icon ? isz + 14 * z : 0;
        ctx.font = fontCss(700, 26 * z, BODY);
        if (HAS_LS) ctx.letterSpacing = (0.16 * 26 * z).toFixed(2) + 'px';
        const tw = Math.min(w - gap, ctx.measureText(String(text).toUpperCase()).width);
        if (HAS_LS) ctx.letterSpacing = '0px';
        const x0 = c.align === 'center' ? x + (w - tw - gap) / 2 : x;
        const dx = (1 - p) * -24 * z;
        if (o.icon) icon(ctx, o.icon, x0 + dx + isz / 2, y + 18 * z, isz, colour, 2.4);
        capsLine(ctx, text, x0 + dx + gap, y + 18 * z, 26 * z, colour, 0.16, 700, w - gap, 'left');
        ctx.restore();
      } };
  }
  /** A pill (badge, sticker): text in chipInk on the chip gradient, tilted. */
  function itSticker(text, c, o) {
    const z = c.z, L = c.look;
    const fl = fitLine(text, 30 * z, 700, BODY, c.w - 120 * z, 18 * c.U);
    const pw = fl.w + 64 * z + 34 * z, ph = 66 * z;
    return { h: ph + 10 * z, gap: (o.gap || 0) * z,
      draw: (g, x, y, w) => {
        const local = g.local - (o.at || 0);
        if (local < 0) return;
        const p = backOut(clamp(local / 0.4, 0, 1), 2.4);
        const ctx = g.ctx;
        const right = o.align === 'left' ? x + pw : c.align === 'center' ? x + (w + pw) / 2 : x + w - 8 * z;
        const cx = right - pw / 2, cy = y + ph / 2 + 4 * z;
        ctx.save(); ctx.globalAlpha = g.alpha * clamp(local / 0.2, 0, 1);
        ctx.translate(cx, cy); ctx.rotate((-2 - 6 * (1 - p)) * Math.PI / 180); ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p);
        ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24 * z; ctx.shadowOffsetY = 10 * z;
        const gr = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0);
        gr.addColorStop(0, L.chip[0]); gr.addColorStop(0.42, L.chip[1]); gr.addColorStop(0.92, L.chip[2]);
        ctx.fillStyle = gr; roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 18 * z); ctx.fill();
        ctx.shadowColor = 'transparent';
        icon(ctx, o.icon || 'check', -pw / 2 + 36 * z, 0, 30 * z, L.chipInk, 2.8);
        drawLine(ctx, fl, -pw / 2 + 64 * z, 1 * z, L.chipInk, 'left');
        ctx.restore();
      } };
  }
  const panelOf = (L) => (L.light ? 'rgba(255,255,255,.62)' : hexA(L.ink, 0.045));
  const lineOf = (L) => hexA(L.ink, L.light ? 0.17 : 0.16);
  function chipGrad(ctx, x0, y0, x1, y1, L) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, L.chip[0]); g.addColorStop(0.42, L.chip[1]); g.addColorStop(0.92, L.chip[2]);
    return g;
  }
  function cardShadow(ctx, L, z) { ctx.shadowColor = L.light ? 'rgba(60,40,8,.26)' : 'rgba(0,0,0,.6)'; ctx.shadowBlur = 60 * z; ctx.shadowOffsetY = 28 * z; }

  const BUILD = {};
  BUILD.hook = (sc, c) => {
    const L = c.look;
    const items = [];
    if (sc.eyebrow) items.push(itEyebrow(sc.eyebrow, c, { icon: 'person', at: 0 }));
    const hl = rangeOfWords(sc.text, sc.emphasis) || hlRange(sc.text);
    const lay0 = layWords(sc.text, { px: 10, weight: 800, fam: HEAD, maxW: 1e9, hl });
    const numWord = hl && /\d/.test(String(sc.text).slice(hl[0], hl[1])) ? (lay0.lines.flatMap((l) => l.words).find((w) => w.hl) || {}).i : undefined;
    const field = L.layout === 'split';
    const head = itHead(sc.text, c, { px: L.layout === 'poster' ? 150 : 132, hl, at: 0.12, gap: sc.eyebrow ? (L.layout === 'split' ? 64 : 30) : 0, count: numWord, field, ink: field ? L.fieldInk : undefined, maxLines: 7 });
    if (field) {
      /* the split layout: the hook on the palette's colour field, wiped in from the left */
      const inner = head.draw;
      head.draw = (g, x, y, w) => {
        const p = ease3((g.local - 0.02) / 0.42);
        const ctx = g.ctx, pad = 30 * c.z;
        ctx.save(); ctx.globalAlpha = g.alpha;
        ctx.fillStyle = L.field;
        ctx.beginPath();
        const right = g.W * p;
        ctx.moveTo(0, y - pad); ctx.lineTo(right, y - pad); ctx.lineTo(right, y + head.h + pad * 0.6); ctx.lineTo(0, y + head.h + pad * 1.6); ctx.closePath(); ctx.fill();
        ctx.restore();
        inner(g, x, y, w);
      };
      head.h += 10 * c.z;
    }
    items.push(head);
    return items;
  };
  BUILD.text = (sc, c) => {
    const items = [];
    if (sc.eyebrow) items.push(itEyebrow(sc.eyebrow, c, { icon: 'spark', at: 0 }));
    const n = String(sc.text || '').length;
    const px = n <= 24 ? 124 : n <= 48 ? 108 : n <= 90 ? 90 : 74;
    const hl = sc.emphasis && sc.emphasis.length ? rangeOfWords(sc.text, sc.emphasis) : hlRange(sc.text);
    items.push(itHead(sc.text, c, { px, hl, at: 0.1, gap: sc.eyebrow ? 30 : 0, maxLines: 9, minPx: 30 }));
    return items;
  };
  BUILD.cta = (sc, c) => {
    const L = c.look, z = c.z;
    const items = [itHead(sc.text, Object.assign({}, c, { align: 'center' }), { px: 120, hl: hlRange(sc.text), at: 0.05, maxLines: 5 })];
    items.push({ h: 120 * z, gap: 40 * z, draw: (g, x, y, w) => {
      const local = g.local - 0.6;
      if (local < 0) return;
      const ctx = g.ctx, r = 54 * z, cx = x + w / 2, cy = y + 60 * z;
      const p = backOut(clamp(local / 0.4, 0, 1), 2.6), pulse = 1 + 0.06 * Math.sin(local * 5);
      ctx.save(); ctx.globalAlpha = g.alpha;
      ctx.fillStyle = hexA(L.accent, 0.16 * clamp(local / 0.4, 0, 1)); ctx.beginPath(); ctx.arc(cx, cy, r * 1.32 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = chipGrad(ctx, cx - r, cy - r, cx + r, cy + r, L); ctx.beginPath(); ctx.arc(cx, cy, r * p, 0, Math.PI * 2); ctx.fill();
      icon(ctx, 'arrow', cx + 4 * z * Math.sin(local * 5), cy, 52 * z * p, L.chipInk, 2.8);
      ctx.restore();
    } });
    const handle = String(c.S.brand.handle || '').trim();
    if (handle) items.push(itBody(handle, Object.assign({}, c, { align: 'center' }), { px: 36, weight: 600, at: 0.9, gap: 26, maxLines: 1, ink: L.muted, align: 'center' }));
    return items;
  };
  BUILD.pain = (sc, c) => {
    const L = c.look, z = c.z;
    const pad = 52 * z;
    const label = sc.eyebrow || 'Sound familiar?';
    const body = fitWords(sc.text, { px: 68 * z, weight: 500, fam: BODY, lh: 1.3, track: -0.01 }, c.w - pad * 2, 8, 24 * c.U);
    const h = pad + 34 * z + 22 * z + body.h + pad;
    return [{ h: h + 40 * z, over: body.over && 'pain "' + oneLine(sc.text).slice(0, 40) + '"', draw: (g, x, y, w) => {
      const ctx = g.ctx, local = g.local;
      const p = ease3(local / 0.45);
      if (p <= 0) return;
      const top = y + 40 * z + (1 - p) * 70 * z;
      ctx.save(); ctx.globalAlpha = g.alpha * p;
      ctx.save(); cardShadow(ctx, L, z);
      ctx.fillStyle = L.light ? 'rgba(255,255,255,.72)' : hexA(L.ink, 0.06);
      ctx.beginPath();
      const r = 34 * z, rb = 10 * z, bw = w, bh = h;
      ctx.moveTo(x + r, top); ctx.arcTo(x + bw, top, x + bw, top + bh, r); ctx.arcTo(x + bw, top + bh, x, top + bh, r); ctx.arcTo(x, top + bh, x, top, rb); ctx.arcTo(x, top, x + bw, top, r); ctx.closePath();
      ctx.fill(); ctx.restore();
      ctx.strokeStyle = lineOf(L); ctx.lineWidth = 1.5 * z; ctx.stroke();
      /* the quote mark pops in at the corner */
      const q = backOut(clamp((local - 0.2) / 0.4, 0, 1), 2.4);
      if (q > 0) {
        ctx.save(); ctx.translate(x + bw - 92 * z, top - 4 * z); ctx.scale(q, q);
        ctx.font = fontCss(800, 190 * z, HEAD); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        ctx.fillStyle = chipGrad(ctx, -60 * z, -60 * z, 60 * z, 60 * z, L); ctx.fillText('“', 0, 46 * z);
        ctx.restore();
      }
      capsLine(ctx, label, x + pad, top + pad + 17 * z, 24 * z, L.accentInk, 0.16, 700, bw - pad * 2 - 140 * z, 'left');
      drawBlock(Object.assign({}, g, { alpha: 1 }), body, x + pad, top + pad + 34 * z + 22 * z, bw - pad * 2, { align: 'left', at: 0.3, motion: c.motion === 'punch' ? 'fade' : c.motion, treat: 'plain', ink: L.ink });
      ctx.restore();
    } }];
  };
  BUILD.usual = (sc, c) => {
    const L = c.look, z = c.z;
    const items = [itEyebrow(sc.eyebrow || 'The usual way', c, { icon: 'x', colour: L.coralInk, at: 0 })];
    if (sc.heading) items.push(itHead(sc.heading, c, { px: 96, hl: hlRange(sc.heading, sc.hl), coral: true, at: 0.12, gap: 22, maxLines: 4 }));
    const list = itemsOf(sc).slice(0, 5);
    const n = Math.max(1, list.length);
    const t0 = 0.6, step = clamp((sc.seconds * 0.66 - t0) / n, 0.32, 0.6);
    const offs = [0, 34, 12, 26, 6], rots = [-1.2, 0.9, -0.5, 0.7, -0.8];
    list.forEach((txt, i) => {
      const xm = 80 * z, pad = 30 * z, off = offs[i % 5] * z;
      const tw = c.w - off - pad * 2 - xm - 28 * z;
      const lay = fitWords(txt, { px: 48 * z, weight: 600, fam: BODY, lh: 1.2, track: -0.015 }, tw, 2, 22 * c.U);
      const ch = Math.max(xm, lay.h) + pad * 2;
      items.push({ h: ch, gap: (i ? 26 : 40) * z, over: lay.over && 'usual "' + txt.slice(0, 40) + '"', draw: (g, x, y, w) => {
        const local = g.local - (t0 + i * step);
        if (local < 0) return;
        const ctx = g.ctx, p = ease3(local / 0.38);
        const cx = x + off, cw = w - off;
        ctx.save(); ctx.globalAlpha = g.alpha * clamp(local / 0.2, 0, 1);
        ctx.translate(cx + cw / 2 + (1 - p) * 90 * z, y + ch / 2); ctx.rotate(rots[i % 5] * Math.PI / 180);
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 40 * z; ctx.shadowOffsetY = 20 * z;
        ctx.fillStyle = L.light ? 'rgba(255,107,107,.10)' : 'rgba(255,107,107,.075)'; roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 28 * z); ctx.fill(); ctx.restore();
        ctx.strokeStyle = L.light ? 'rgba(229,72,77,.38)' : 'rgba(255,107,107,.34)'; ctx.lineWidth = 1.5 * z; roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 28 * z); ctx.stroke();
        const mx = -cw / 2 + pad + xm / 2;
        const q = backOut(clamp((local - 0.08) / 0.34, 0, 1), 2.6);
        ctx.fillStyle = 'rgba(255,107,107,.16)'; ctx.beginPath(); ctx.arc(mx, 0, (xm / 2 + 9 * z) * q, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = CORAL; ctx.beginPath(); ctx.arc(mx, 0, (xm / 2) * q, 0, Math.PI * 2); ctx.fill();
        icon(ctx, 'x', mx, 0, 44 * z * q, '#fff4f4', 3.2);
        const tx = -cw / 2 + pad + xm + 28 * z, ty = -lay.h / 2;
        const strike = ease3((local - 0.42) / 0.36);
        drawBlock(Object.assign({}, g, { local: 1, alpha: 1 - 0.25 * strike }), lay, tx, ty, tw, { align: 'left', motion: 'none', treat: 'plain', ink: L.ink });
        if (strike > 0) {
          ctx.strokeStyle = 'rgba(255,107,107,.78)'; ctx.lineWidth = Math.max(2, 4 * z); ctx.lineCap = 'round';
          lay.lines.forEach((ln, li) => {
            const yy = ty + li * lay.lh + lay.lh * 0.54;
            const seg = clamp(strike * lay.lines.length - li, 0, 1);
            if (seg <= 0) return;
            ctx.beginPath(); ctx.moveTo(tx - 4 * z, yy); ctx.lineTo(tx - 4 * z + (ln.w + 8 * z) * seg, yy); ctx.stroke();
          });
        }
        ctx.restore();
      } });
    });
    if (sc.foot) {
      const fl = fitLine(sc.foot, 36 * z, 700, HEAD, c.w - 60 * z, 20 * c.U);
      const at = Math.min(sc.seconds - 0.7, t0 + n * step + 0.2);
      items.push({ h: 48 * z, gap: 40 * z, draw: (g, x, y, w) => {
        const local = g.local - at;
        if (local < 0) return;
        const p = ease3(local / 0.35), ctx = g.ctx;
        ctx.save(); ctx.globalAlpha = g.alpha * p;
        const x0 = c.align === 'center' ? x + (w - fl.w - 56 * z) / 2 : x;
        drawLine(ctx, fl, x0, y + 24 * z, L.accentInk, 'left');
        icon(ctx, 'arrow', x0 + fl.w + 30 * z + 10 * z * Math.sin(local * 6), y + 24 * z, 40 * z, L.accentInk, 2.6);
        ctx.restore();
      } });
    }
    items.deco = (g) => {
      /* the kits' faint ✗ watermark */
      const ctx = g.ctx;
      ctx.save(); ctx.globalAlpha = g.alpha * 0.07 * ease3(g.local / 0.6);
      ctx.translate(g.W * 0.8, g.H * 0.66); ctx.rotate(-8 * Math.PI / 180);
      icon(ctx, 'x', 0, 0, g.W * 0.5, CORAL, 2.4);
      ctx.restore();
    };
    return items;
  };
  function glyphTile(g, L, id, section, cx, cy, size, p, ring) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate((1 - p) * -14 * Math.PI / 180); ctx.scale(p, p);
    if (ring) { ctx.fillStyle = hexA(L.accent, 0.16); roundRect(ctx, -size / 2 - ring, -size / 2 - ring, size + ring * 2, size + ring * 2, size * 0.3 + ring); ctx.fill(); }
    ctx.fillStyle = chipGrad(ctx, -size / 2, -size / 2, size / 2, size / 2, L); roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.28); ctx.fill();
    const gc = id ? glyphCanvas(id, L.chipInk, section ? 'i-' + section : '') : null;
    if (gc) ctx.drawImage(gc, -size * 0.31, -size * 0.31, size * 0.62, size * 0.62);
    else icon(ctx, 'spark', 0, 0, size * 0.5, L.chipInk);
    ctx.restore();
  }
  BUILD.fix = (sc, c) => {
    const L = c.look, z = c.z;
    const items = [itEyebrow(sc.eyebrow || 'The fix', c, { icon: 'check', at: 0 })];
    const ts = 170 * z;
    items.push({ h: ts + 24 * z, gap: 34 * z, draw: (g, x, y, w) => {
      const local = g.local - 0.12;
      if (local < 0) return;
      const p = backOut(clamp(local / 0.45, 0, 1), 2.2);
      const cx = c.align === 'center' ? x + w / 2 : x + ts / 2 + 12 * z, cy = y + ts / 2 + 12 * z;
      const ctx = g.ctx;
      ctx.save(); ctx.globalAlpha = g.alpha;
      /* a ring that spreads once the tile lands */
      const rp = clamp((local - 0.3) / 0.7, 0, 1);
      if (rp > 0 && rp < 1) { ctx.strokeStyle = hexA(L.accent, 0.5 * (1 - rp)); ctx.lineWidth = 6 * z; roundRect(ctx, cx - ts / 2 - rp * 60 * z, cy - ts / 2 - rp * 60 * z, ts + rp * 120 * z, ts + rp * 120 * z, ts * 0.3 + rp * 60 * z); ctx.stroke(); }
      glyphTile(g, L, sc.glyph, sc.section, cx, cy, ts, p, 12 * z);
      ctx.restore();
    } });
    if (sc.heading) items.push(itHead(sc.heading, c, { px: 100, hl: null, at: 0.32, gap: 30, maxLines: 3 }));
    if (sc.text) items.push(itBody(sc.text, c, { px: 56, at: 0.6, gap: 24, maxLines: 5 }));
    if (sc.sub) items.push(itBody(sc.sub, c, { px: 28, at: 1.0, gap: 22, maxLines: 2, ink: L.muted, motion: 'fade' }));
    return items;
  };
  BUILD.steps = (sc, c) => {
    const L = c.look, z = c.z;
    const items = [];
    if (sc.eyebrow) items.push(itEyebrow(sc.eyebrow, c, { icon: 'spark', at: 0 }));
    if (sc.heading) items.push(itHead(sc.heading, c, { px: 100, hl: hlRange(sc.heading, sc.hl), at: 0.1, gap: sc.eyebrow ? 22 : 0, maxLines: 3 }));
    const list = itemsOf(sc).slice(0, 5);
    const n = Math.max(1, list.length);
    const t0 = 0.5, step = clamp((sc.seconds * 0.7 - t0) / n, 0.3, 0.62);
    const node = (n > 3 ? 104 : 128) * z, offs = [0, 150, 50, 120, 20];
    const rows = list.map((txt, i) => {
      const off = c.align === 'center' ? 0 : offs[i % 5] * z;
      const tw = c.w - off - node - 34 * z;
      const lay = fitWords(txt, { px: 52 * z, weight: 700, fam: famOf(L, true), lh: 1.12, track: -0.03 }, tw, 2, 24 * c.U);
      return { txt, off, tw, lay, h: Math.max(node, lay.h) };
    });
    const gapR = 46 * z;
    const totalH = rows.reduce((a, r) => a + r.h, 0) + gapR * (rows.length - 1) + 24 * z;
    const over = rows.find((r) => r.lay.over);
    items.push({ h: totalH, gap: 44 * z, over: over && 'step "' + over.txt.slice(0, 40) + '"', draw: (g, x, y, w) => {
      const ctx = g.ctx;
      ctx.save(); ctx.globalAlpha = g.alpha;
      let yy = y + 12 * z;
      const centres = rows.map((r) => { const cy = yy + r.h / 2; yy += r.h + gapR; return { x: x + r.off + node / 2, y: cy }; });
      /* the dotted path draws from node to node */
      for (let i = 0; i < centres.length - 1; i++) {
        const a = centres[i], b = centres[i + 1];
        const pr = ease3((g.local - (t0 + i * step + 0.25)) / Math.max(0.2, step));
        if (pr <= 0) continue;
        ctx.save(); ctx.strokeStyle = L.accent; ctx.lineWidth = 5 * z; ctx.setLineDash([2 * z, 14 * z]); ctx.lineCap = 'round';
        const ax = a.x + (b.x - a.x) * 0.12, ay = a.y + node * 0.55, bx = b.x - (b.x - a.x) * 0.12, by = b.y - node * 0.55;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * pr, ay + (by - ay) * pr); ctx.stroke();
        ctx.restore();
      }
      rows.forEach((r, i) => {
        const local = g.local - (t0 + i * step);
        if (local < 0) return;
        const ce = centres[i];
        const p = backOut(clamp(local / 0.4, 0, 1), 2.4);
        ctx.save();
        ctx.fillStyle = hexA(L.accent, 0.16); ctx.beginPath(); ctx.arc(ce.x, ce.y, (node / 2 + 12 * z) * p, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = chipGrad(ctx, ce.x - node / 2, ce.y - node / 2, ce.x + node / 2, ce.y + node / 2, L); ctx.beginPath(); ctx.arc(ce.x, ce.y, (node / 2) * p, 0, Math.PI * 2); ctx.fill();
        ctx.font = fontCss(800, node * 0.48 * p, HEAD); ctx.fillStyle = L.chipInk; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), ce.x, ce.y + node * 0.03);
        ctx.restore();
        const tp = ease3((local - 0.12) / 0.4);
        if (tp > 0) drawBlock(Object.assign({}, g, { local: 9, alpha: tp }), r.lay, x + r.off + node + 34 * z - (1 - tp) * 40 * z, ce.y - r.lay.h / 2, r.tw, { align: 'left', motion: 'none', treat: 'plain', ink: L.ink });
      });
      ctx.restore();
    } });
    if (sc.foot) {
      const fl = fitLine(sc.foot, 30 * z, 600, BODY, c.w - 120 * z, 20 * c.U);
      const at = Math.min(sc.seconds - 0.6, t0 + n * step + 0.1);
      items.push({ h: 84 * z, gap: 34 * z, draw: (g, x, y, w) => {
        const p = ease3((g.local - at) / 0.35);
        if (p <= 0) return;
        const ctx = g.ctx;
        ctx.save(); ctx.globalAlpha = g.alpha * p;
        ctx.fillStyle = panelOf(L); roundRect(ctx, x, y + (1 - p) * 20 * z, w, 84 * z, 22 * z); ctx.fill();
        ctx.setLineDash([6 * z, 6 * z]); ctx.strokeStyle = lineOf(L); ctx.lineWidth = 1.5 * z; ctx.stroke(); ctx.setLineDash([]);
        icon(ctx, 'check', x + 50 * z, y + 42 * z, 36 * z, okOf(L), 2.8);
        drawLine(ctx, fl, x + 86 * z, y + 43 * z, L.ink2, 'left');
        ctx.restore();
      } });
    }
    return items;
  };
  BUILD.point = (sc, c) => {
    const L = c.look, z = c.z;
    const items = [];
    const num = String(sc.heading || '').trim();
    const ns = 230 * z;
    items.push({ h: ns + 20 * z, draw: (g, x, y, w) => {
      const local = g.local;
      const p = backOut(clamp(local / 0.45, 0, 1), 2.2);
      if (p <= 0) return;
      const ctx = g.ctx, cx = c.align === 'center' ? x + w / 2 : x + ns / 2 + 14 * z, cy = y + ns / 2 + 10 * z;
      ctx.save(); ctx.globalAlpha = g.alpha;
      ctx.fillStyle = sc.bad ? 'rgba(255,107,107,.16)' : hexA(L.accent, 0.16); ctx.beginPath(); ctx.arc(cx, cy, (ns / 2 + 16 * z) * p, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = sc.bad ? CORAL : chipGrad(ctx, cx - ns / 2, cy - ns / 2, cx + ns / 2, cy + ns / 2, L);
      ctx.beginPath(); ctx.arc(cx, cy, (ns / 2) * p, 0, Math.PI * 2); ctx.fill();
      if (num) {
        const fl = fitLine(num, ns * 0.52 * p, 800, HEAD, ns * 0.72, 10);
        drawLine(ctx, fl, cx, cy + ns * 0.03, sc.bad ? '#fff4f4' : L.chipInk, 'center');
      } else icon(ctx, sc.bad ? 'x' : 'check', cx, cy, ns * 0.5 * p, sc.bad ? '#fff4f4' : L.chipInk, 3);
      if (sc.bad && num) {
        const bx = cx + ns * 0.36, by = cy - ns * 0.36, br = 34 * z * p;
        ctx.fillStyle = L.bg[0]; ctx.beginPath(); ctx.arc(bx, by, br + 6 * z, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = CORAL; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
        icon(ctx, 'x', bx, by, br * 1.1, '#fff4f4', 3.4);
      }
      ctx.restore();
    } });
    items.push(itHead(sc.text, c, { px: 92, hl: hlRange(sc.text), coral: !!sc.bad, at: 0.3, gap: 40, maxLines: 6 }));
    return items;
  };
  BUILD.versus = (sc, c) => {
    const L = c.look, z = c.z;
    const labels = String(sc.heading || 'Myth | Fact').split(/\s*\|\s*|\s+vs\.?\s+/i);
    const lines = itemsOf(sc);
    const badFirst = /myth|wrong|don|before|old|usual/i.test(labels[0] || '');
    const strike = /myth|wrong|don/i.test(labels[0] || '');
    const items = [];
    const pad = 40 * z;
    const mk = (i) => {
      const txt = lines[i] || '';
      const first = i === 0;
      const lay = first
        ? fitWords(txt, { px: 60 * z, weight: 600, fam: BODY, lh: 1.25, track: -0.01 }, c.w - pad * 2, 5, 24 * c.U)
        : fitWords(txt, { px: 78 * z, weight: L.type === 'serif' ? 700 : 800, fam: famOf(L, true), lh: 1.1, track: -0.02, hl: hlRange(txt), hlItalic: L.type === 'serif' }, c.w - pad * 2, 5, 26 * c.U);
      const h = pad + 44 * z + 20 * z + lay.h + pad;
      const at = first ? 0.1 : clamp(sc.seconds * 0.42, 0.9, 2.2);
      return { h, gap: first ? 0 : 34 * z, over: lay.over && 'versus "' + txt.slice(0, 40) + '"', draw: (g, x, y, w) => {
        const local = g.local - at;
        if (local < 0) return;
        const ctx = g.ctx, p = ease3(local / 0.4);
        ctx.save(); ctx.globalAlpha = g.alpha * p;
        const top = y + (1 - p) * 50 * z;
        const bad = first && badFirst;
        ctx.save(); cardShadow(ctx, L, z * 0.6);
        ctx.fillStyle = bad ? (L.light ? 'rgba(255,107,107,.10)' : 'rgba(255,107,107,.075)') : (first ? panelOf(L) : (L.light ? 'rgba(255,255,255,.8)' : hexA(L.accent, 0.08)));
        roundRect(ctx, x, top, w, h, 30 * z); ctx.fill(); ctx.restore();
        ctx.strokeStyle = bad ? 'rgba(255,107,107,.38)' : first ? lineOf(L) : hexA(L.accent, 0.55); ctx.lineWidth = 2 * z; roundRect(ctx, x, top, w, h, 30 * z); ctx.stroke();
        const ic = 44 * z, icx = x + pad + ic / 2, icy = top + pad + 22 * z;
        ctx.fillStyle = bad ? CORAL : first ? hexA(L.ink, 0.3) : okOf(L);
        ctx.beginPath(); ctx.arc(icx, icy, ic / 2, 0, Math.PI * 2); ctx.fill();
        icon(ctx, bad ? 'x' : first ? 'arrow' : 'check', icx, icy, ic * 0.6, bad || !first ? '#fefefe' : L.ink, 3);
        capsLine(ctx, labels[i] || (first ? 'Myth' : 'Fact'), icx + ic / 2 + 16 * z, icy, 26 * z, bad ? L.coralInk : first ? L.muted : L.accentInk, 0.16, 800, w - pad * 2 - ic - 16 * z, 'left');
        const tx = x + pad, ty = top + pad + 44 * z + 20 * z;
        const sp = first && strike ? ease3((local - 0.6) / 0.4) : 0;
        drawBlock(Object.assign({}, g, { local: first ? 9 : local, alpha: 1 - 0.3 * sp }), lay, tx, ty, w - pad * 2, { align: 'left', motion: first ? 'none' : c.motion, treat: first ? 'plain' : L.type, ink: first ? L.ink2 : L.ink });
        if (sp > 0) {
          ctx.strokeStyle = 'rgba(255,107,107,.8)'; ctx.lineWidth = Math.max(2, 4 * z); ctx.lineCap = 'round';
          lay.lines.forEach((ln, li) => { const seg = clamp(sp * lay.lines.length - li, 0, 1); if (seg <= 0) return; const yy = ty + li * lay.lh + lay.lh * 0.54; ctx.beginPath(); ctx.moveTo(tx, yy); ctx.lineTo(tx + ln.w * seg, yy); ctx.stroke(); });
        }
        ctx.restore();
      } };
    };
    items.push(mk(0), mk(1));
    return items;
  };
  BUILD.quote = (sc, c) => {
    const L = c.look, z = c.z;
    const items = [{ h: 150 * z, draw: (g, x, y, w) => {
      const p = backOut(clamp(g.local / 0.45, 0, 1), 2.4);
      if (p <= 0) return;
      const ctx = g.ctx;
      ctx.save(); ctx.globalAlpha = g.alpha;
      const cx = c.align === 'center' ? x + w / 2 : x + 70 * z;
      ctx.translate(cx, y + 110 * z); ctx.scale(p, p);
      ctx.font = fontCss(800, 300 * z, L.type === 'serif' ? SERIF : HEAD); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = chipGrad(ctx, -80 * z, -80 * z, 80 * z, 80 * z, L); ctx.fillText('“', 0, 0);
      ctx.restore();
    } }];
    const lay = fitWords(sc.text, { px: 64 * z, weight: L.type === 'serif' ? 700 : 700, fam: L.type === 'serif' ? SERIF : HEAD, italic: L.type === 'serif', lh: 1.18, track: -0.02 }, c.w, 8, 26 * c.U);
    items.push({ h: lay.h, gap: 20 * z, over: lay.over && 'quote', draw: (g, x, y, w) => drawBlock(g, lay, x, y, w, { align: c.align, at: 0.2, motion: c.motion === 'punch' ? 'fade' : c.motion, treat: 'plain', ink: L.ink }) });
    if (sc.heading) items.push(itBody('— ' + sc.heading, c, { px: 34, weight: 600, at: 0.9, gap: 34, maxLines: 2, ink: L.muted, motion: 'fade' }));
    return items;
  };

  /* ---- the example: the kits' hero frames, in motion ---- */
  const tear = (ctx, x, y, w, z, bg) => {
    ctx.save(); ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(x, y, 14 * z, 0, Math.PI * 2); ctx.arc(x + w, y, 14 * z, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  function heroCalc(ex, c, sc) {
    const L = c.look, z = c.z;
    const w = Math.min(c.w, 920 * z), pad = 34 * z, rowH = 50 * z;
    const inputs = ex.inputs.slice(0, 3);
    const prim = ex.results.find((r) => r.primary) || ex.results[0];
    const others = ex.results.filter((r) => r !== prim).slice(0, 3);
    const inner = w - pad * 2;
    const pv = fitLine(prim.value, 112 * z, 800, HEAD, inner, 30 * c.U);
    const plabH = 30 * z, headH = 70 * z;
    const H = pad + headH + inputs.length * rowH + 40 * z + plabH + pv.px * 1.08 + 12 * z + others.length * rowH + pad;
    const rowFit = (r) => {
      const lf = fitLine(r.label, 27 * z, 500, BODY, inner * 0.46, 18 * c.U);
      const vf = fitLine(r.value, 27 * z, 700, BODY, inner - lf.w - 24 * z, 16 * c.U);
      return { lf, vf };
    };
    const inRows = inputs.map(rowFit), outRows = others.map(rowFit);
    const title = fitLine(sc.title || '', 30 * z, 700, HEAD, inner - 60 * z - 200 * z, 18 * c.U);
    return { h: H + 30 * z, w, draw: (g, x0, y, wAll) => {
      const local = g.local - 0.3;
      if (local < 0) return;
      const ctx = g.ctx, x = x0 + (wAll - w) / 2;
      const p = ease3(local / 0.45);
      const top = y + (1 - p) * 90 * z;
      ctx.save(); ctx.globalAlpha = g.alpha * p;
      /* the ticket: rounded top, torn bottom */
      ctx.save(); cardShadow(ctx, L, z);
      ctx.fillStyle = L.card;
      ctx.beginPath();
      const r = 24 * z, bottom = top + H, tooth = 16 * z;
      ctx.moveTo(x, bottom); ctx.lineTo(x, top + r); ctx.arcTo(x, top, x + r, top, r); ctx.lineTo(x + w - r, top); ctx.arcTo(x + w, top, x + w, top + r, r); ctx.lineTo(x + w, bottom);
      const nT = Math.max(6, Math.round(w / (tooth * 2)));
      for (let k = nT; k > 0; k--) { const xa = x + (k - 0.5) * (w / nT); ctx.lineTo(xa, bottom - tooth * 0.7); ctx.lineTo(x + (k - 1) * (w / nT), bottom); }
      ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.strokeStyle = hexA(L.cardInk, 0.08); ctx.lineWidth = 1.5 * z; ctx.stroke();
      let yy = top + pad;
      /* head: icon tile, title, live dot */
      const ts = 50 * z;
      ctx.fillStyle = hexA(L.accent, 0.12); roundRect(ctx, x + pad, yy, ts, ts, 14 * z); ctx.fill();
      ctx.strokeStyle = hexA(L.accent, 0.4); ctx.lineWidth = 1.5 * z; ctx.stroke();
      const gc = sc.glyph ? glyphCanvas(sc.glyph, L.accent, 'i-' + (sc.section || '')) : null;
      if (gc) ctx.drawImage(gc, x + pad + ts * 0.18, yy + ts * 0.18, ts * 0.64, ts * 0.64);
      drawLine(ctx, title, x + pad + ts + 16 * z, yy + ts / 2, L.cardInk, 'left');
      const blink = 0.55 + 0.45 * Math.sin(local * 6);
      const lw = capsLine(ctx, 'Live result', x + w - pad, yy + ts / 2, 20 * z, okOf(L), 0.14, 800, 260 * z, 'right');
      ctx.fillStyle = hexA(okOf(L), blink); ctx.beginPath(); ctx.arc(x + w - pad - lw - 16 * z, yy + ts / 2, 6 * z, 0, Math.PI * 2); ctx.fill();
      yy += headH;
      const row = (rf, i, at) => {
        const q = ease3((local - at) / 0.3);
        if (q <= 0) { yy += rowH; return; }
        ctx.save(); ctx.globalAlpha *= q;
        drawLine(ctx, rf.lf, x + pad + (1 - q) * 30 * z, yy + rowH / 2, L.cardMuted, 'left');
        drawLine(ctx, rf.vf, x + w - pad + (1 - q) * 30 * z, yy + rowH / 2, L.cardInk, 'right');
        ctx.strokeStyle = hexA(L.cardInk, 0.1); ctx.setLineDash([2 * z, 5 * z]); ctx.lineWidth = 1.2 * z;
        ctx.beginPath(); ctx.moveTo(x + pad, yy + rowH); ctx.lineTo(x + w - pad, yy + rowH); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
        yy += rowH;
      };
      inRows.forEach((rf, i) => row(rf, i, 0.2 + i * 0.09));
      /* the tear line with its notches */
      yy += 20 * z;
      ctx.save(); ctx.strokeStyle = hexA(L.cardInk, 0.22); ctx.setLineDash([8 * z, 8 * z]); ctx.lineWidth = 2 * z;
      ctx.beginPath(); ctx.moveTo(x + 20 * z, yy); ctx.lineTo(x + w - 20 * z, yy); ctx.stroke(); ctx.restore();
      tear(ctx, x, yy, w, z, L.bg[0]);
      yy += 20 * z;
      capsLine(ctx, prim.label, x + pad, yy + plabH / 2, 19 * z, L.cardMuted, 0.16, 800, inner, 'left');
      yy += plabH;
      /* the primary result counts up in the gradient */
      const cp = ease3((local - 0.55) / 1.1);
      if (local > 0.5) {
        const shown = countText(prim.value, cp);
        ctx.save();
        ctx.font = pv.font; ctx.textBaseline = 'middle';
        const gy = yy + pv.px * 0.54;
        const gr = ctx.createLinearGradient(x + pad, gy - pv.px / 2, x + pad + pv.w, gy + pv.px / 2);
        gr.addColorStop(0, L.grad[0]); gr.addColorStop(0.42, L.grad[1]); gr.addColorStop(0.92, L.grad[2]);
        ctx.fillStyle = gr;
        const sc2 = 1 + 0.05 * bump((local - 1.65) / 0.35);
        ctx.translate(x + pad, gy); ctx.scale(sc2, sc2); ctx.fillText(pv.t === prim.value ? shown : pv.t, 0, 0);
        ctx.restore();
      }
      if (pv.px < MIN_PX) MIN_PX = pv.px;
      yy += pv.px * 1.08 + 12 * z;
      outRows.forEach((rf, i) => row(rf, i, 1.5 + i * 0.14));
      ctx.restore();
    } };
  }
  function looksLikeCode(s) {
    const t = String(s || '').trim();
    return /^[[{<]/.test(t) || /[;{}]\s*$/m.test(t) || /^\s*(const|let|var|function|def|SELECT|import)\b/m.test(t) || /=>|\b\w+\(\)/.test(t);
  }
  /** Wrap code or prose to `cols` characters, keeping at most `max` lines (the last one says how many more). */
  function codeLines(src, cols, max) {
    const out = [];
    for (const raw of String(src || '').replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n')) {
      let l = raw;
      if (!l.length) { out.push(''); continue; }
      while (l.length > cols) {
        let cut = l.lastIndexOf(' ', cols);
        if (cut < cols * 0.5) cut = cols;
        out.push(l.slice(0, cut)); l = l.slice(cut).replace(/^ /, '');
      }
      out.push(l);
    }
    while (out.length > 1 && !out[out.length - 1].trim()) out.pop();
    if (out.length > max) { const more = out.length - (max - 1); return out.slice(0, max - 1).concat(['… ' + more + ' more lines']); }
    return out;
  }
  function drawCodeLine(ctx, line, x, y, L, plain, px) {
    if (plain || /^… \d+ more lines$/.test(line)) { ctx.fillStyle = /^… /.test(line) ? L.cardMuted : L.cardInk; ctx.fillText(line, x, y); return; }
    const re = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*"?)|(-?\b\d[\d_.]*\b)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\](),;:=<>+*/.-])|([^"\d{}[\](),;:=<>+*/.-]+)/g;
    let m, cx = x;
    while ((m = re.exec(line))) {
      const t = m[0];
      ctx.fillStyle = m[1] ? L.accentInk : m[2] ? okOf(L) : m[3] || m[4] ? L.coralInk : m[5] ? L.cardMuted : L.cardInk;
      ctx.fillText(t, cx, y);
      cx += ctx.measureText(t).width;
    }
  }
  function heroCode(ex, c, sc) {
    const L = c.look, z = c.z;
    const w = c.w, px = 25 * z, lh = px * 1.5;
    MEASURE.font = fontCss(500, px, MONO); if (HAS_LS) MEASURE.letterSpacing = '0px';
    const cw = MEASURE.measureText('0').width || px * 0.6;
    const cols = Math.max(16, Math.floor((w - 110 * z) / cw));
    const plainIn = !looksLikeCode(ex.input), plainOut = !looksLikeCode(ex.output);
    const inL = ex.input ? codeLines(ex.input, cols, 5) : [];
    const outL = codeLines(ex.output, cols, 10);
    const barH = 62 * z, labH = 40 * z, sepH = 56 * z;
    const inH = inL.length ? labH + inL.length * lh + 22 * z : 0;
    const outH = labH + outL.length * lh + 26 * z;
    const H = barH + inH + (inL.length ? sepH : 0) + outH;
    const title = fitLine(sc.title || '', 24 * z, 600, BODY, w - 420 * z, 16 * c.U);
    return { h: H + 20 * z, draw: (g, x, y) => {
      const local = g.local - 0.3;
      if (local < 0) return;
      const ctx = g.ctx, p = ease3(local / 0.45);
      const top = y + (1 - p) * 80 * z;
      ctx.save(); ctx.globalAlpha = g.alpha * p;
      ctx.save(); cardShadow(ctx, L, z); ctx.fillStyle = L.card; roundRect(ctx, x, top, w, H, 26 * z); ctx.fill(); ctx.restore();
      ctx.strokeStyle = hexA(L.cardInk, 0.09); ctx.lineWidth = 1.5 * z; roundRect(ctx, x, top, w, H, 26 * z); ctx.stroke();
      ctx.save(); roundRect(ctx, x, top, w, H, 26 * z); ctx.clip();
      ctx.fillStyle = hexA(L.cardInk, 0.05); ctx.fillRect(x, top, w, barH);
      ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 34 * z + i * 30 * z, top + barH / 2, 9 * z, 0, Math.PI * 2); ctx.fill(); });
      drawLine(ctx, title, x + 140 * z, top + barH / 2, L.cardMuted, 'left');
      const lw = capsLine(ctx, 'Live output', x + w - 28 * z, top + barH / 2, 20 * z, okOf(L), 0.14, 800, 260 * z, 'right');
      ctx.fillStyle = okOf(L); ctx.beginPath(); ctx.arc(x + w - 28 * z - lw - 16 * z, top + barH / 2, 6 * z, 0, Math.PI * 2); ctx.fill();
      let yy = top + barH;
      ctx.font = fontCss(500, px, MONO); ctx.textBaseline = 'middle';
      const pane = (label, lines, plain, at, typing) => {
        capsLine(ctx, label, x + 30 * z, yy + labH / 2 + 6 * z, 17 * z, L.cardMuted, 0.14, 700, w - 60 * z, 'left');
        yy += labH;
        ctx.font = fontCss(500, px, MONO);
        lines.forEach((ln, i) => {
          const q = typing ? clamp((local - at - i * 0.09) / 0.12, 0, 1) : ease3((local - at) / 0.3);
          if (q <= 0) return;
          ctx.save(); ctx.globalAlpha *= typing ? 1 : q;
          ctx.fillStyle = hexA(L.cardMuted, 0.8); ctx.textAlign = 'right'; ctx.fillText(String(i + 1), x + 58 * z, yy + i * lh + lh / 2); ctx.textAlign = 'left';
          const shown = typing ? ln.slice(0, Math.ceil(ln.length * q)) : ln;
          drawCodeLine(ctx, shown, x + 76 * z, yy + i * lh + lh / 2, L, plain, px);
          ctx.restore();
        });
        if (px < MIN_PX) MIN_PX = px;
        yy += lines.length * lh + 22 * z;
      };
      if (inL.length) {
        pane(ex.inputLabel || 'Input', inL, plainIn, 0.15, false);
        ctx.fillStyle = hexA(L.cardInk, 0.06); ctx.fillRect(x, yy, w, sepH);
        const ap = ease3((local - 0.55) / 0.3);
        ctx.save(); ctx.globalAlpha *= ap;
        icon(ctx, 'arrowDown', x + 46 * z, yy + sepH / 2 + (1 - ap) * -10 * z, 28 * z, L.accentInk, 2.6);
        capsLine(ctx, ex.outputLabel || 'Output', x + 72 * z, yy + sepH / 2, 18 * z, L.accentInk, 0.14, 800, w - 100 * z, 'left');
        ctx.restore();
        yy += sepH - 4 * z;
      }
      pane(ex.outputLabel || 'Output', outL, plainOut, 0.75, true);
      ctx.restore();
      ctx.restore();
    } };
  }
  function drawContain(ctx, img, x, y, w, h) {
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function checker(ctx, x, y, w, h, z) {
    const s = 22 * z;
    ctx.fillStyle = '#e9e9ee'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#cfcfd6';
    for (let yy = 0; yy < h; yy += s) for (let xx = ((yy / s) % 2) * s; xx < w; xx += s * 2) ctx.fillRect(x + xx, y + yy, Math.min(s, w - xx), Math.min(s, h - yy));
  }
  /** Where the before/after seam is, 0 (all after) … 1 (all before), at `local` seconds into the hero. */
  function seamAt(local) {
    if (local < 0.35) return 1;
    if (local < 1.6) return 1 - 0.88 * (0.5 - 0.5 * Math.cos(Math.PI * (local - 0.35) / 1.25));
    if (local < 2.4) return 0.12 + 0.38 * ease3((local - 1.6) / 0.8);
    return 0.5;
  }
  function heroBA(ex, c, sc) {
    const L = c.look, z = c.z;
    const b = exImage(ex.before), a = exImage(ex.after);
    const ar = b && b.ok ? b.img.naturalWidth / b.img.naturalHeight : 4 / 3;
    let w = c.w, h = w / ar;
    const maxH = 700 * z;
    if (h > maxH) { h = maxH; w = h * ar; }
    return { h: h + 20 * z, draw: (g, x0, y, wAll) => {
      const local = g.local - 0.25;
      if (local < 0) return;
      const ctx = g.ctx, x = x0 + (wAll - w) / 2;
      const p = ease3(local / 0.4);
      ctx.save(); ctx.globalAlpha = g.alpha * p;
      const sc2 = 0.94 + 0.06 * p;
      ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc2, sc2); ctx.translate(-(x + w / 2), -(y + h / 2));
      ctx.save(); cardShadow(ctx, L, z); ctx.fillStyle = L.card; roundRect(ctx, x, y, w, h, 28 * z); ctx.fill(); ctx.restore();
      ctx.save(); roundRect(ctx, x, y, w, h, 28 * z); ctx.clip();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      if (b && b.ok) drawContain(ctx, b.img, x, y, w, h);
      const sx = x + w * seamAt(local);
      sc._ba = { x, y, w, h, sx, local };
      ctx.save(); ctx.beginPath(); ctx.rect(sx, y, x + w - sx, h); ctx.clip();
      if (ex.alpha) checker(ctx, x, y, w, h, z); else { ctx.fillStyle = L.card; ctx.fillRect(x, y, w, h); }
      if (a && a.ok) drawContain(ctx, a.img, x, y, w, h);
      ctx.restore();
      /* the seam, its handle, the tags */
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12 * z;
      ctx.fillStyle = '#fefefe'; ctx.fillRect(sx - 3 * z, y, 6 * z, h); ctx.restore();
      ctx.restore();
      const hr = 46 * z;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 30 * z; ctx.shadowOffsetY = 10 * z;
      ctx.fillStyle = 'rgba(254,254,254,.28)'; ctx.beginPath(); ctx.arc(sx, y + h / 2, hr + 10 * z, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fefefe'; ctx.beginPath(); ctx.arc(sx, y + h / 2, hr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      icon(ctx, 'lr', sx, y + h / 2, hr * 1.1, '#06080f', 2.6);
      const tag = (txt, tx, align) => {
        ctx.font = fontCss(700, 24 * z, BODY);
        const tw = ctx.measureText(txt).width + 32 * z;
        const bx = align === 'left' ? tx : tx - tw;
        ctx.fillStyle = 'rgba(6,8,15,.66)'; roundRect(ctx, bx, y + 20 * z, tw, 46 * z, 23 * z); ctx.fill();
        ctx.fillStyle = '#f4f6fb'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(txt, bx + tw / 2, y + 43 * z); ctx.textAlign = 'left';
      };
      tag('Before', x + 20 * z, 'left'); tag('After', x + w - 20 * z, 'right');
      ctx.restore();
    } };
  }
  function heroDoc(ex, c, sc) {
    const L = c.look, z = c.z;
    const pg = exImage(ex.page);
    const w = c.w, barH = 64 * z;
    const ar = pg && pg.ok ? pg.img.naturalWidth / pg.img.naturalHeight : 0.707;
    const stageH = Math.min(760 * z, (w - 80 * z) / ar + 60 * z);
    const H = barH + stageH;
    const name = fitLine(ex.fileName || (sc.title ? slugify(sc.title) + '.pdf' : 'document.pdf'), 24 * z, 600, BODY, w - 360 * z, 16 * c.U);
    return { h: H + 20 * z, draw: (g, x, y) => {
      const local = g.local - 0.25;
      if (local < 0) return;
      const ctx = g.ctx, p = ease3(local / 0.45);
      ctx.save(); ctx.globalAlpha = g.alpha * p;
      ctx.save(); cardShadow(ctx, L, z); ctx.fillStyle = L.light ? '#e9e3d5' : '#161b29'; roundRect(ctx, x, y, w, H, 26 * z); ctx.fill(); ctx.restore();
      ctx.save(); roundRect(ctx, x, y, w, H, 26 * z); ctx.clip();
      ctx.fillStyle = L.light ? '#fefefe' : '#10141f'; ctx.fillRect(x, y, w, barH);
      ctx.fillStyle = '#e5484d'; roundRect(ctx, x + 24 * z, y + barH / 2 - 18 * z, 70 * z, 36 * z, 8 * z); ctx.fill();
      ctx.font = fontCss(800, 20 * z, BODY); ctx.fillStyle = '#fff5f5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PDF', x + 59 * z, y + barH / 2 + 1 * z); ctx.textAlign = 'left';
      drawLine(ctx, name, x + 110 * z, y + barH / 2, L.light ? '#3c4050' : '#c3c9d9', 'left');
      drawLine(ctx, fitLine('Page 1', 22 * z, 600, BODY, 120 * z, 14), x + w - 28 * z, y + barH / 2, L.light ? '#5f6375' : '#8f98ad', 'right');
      if (pg && pg.ok) {
        const q = ease3((local - 0.2) / 0.6);
        const kb = 1 + 0.035 * clamp((local - 0.8) / 2.5, 0, 1);
        const sx = x + 40 * z, sy = y + barH + 30 * z, sw = w - 80 * z, sh = stageH - 60 * z;
        ctx.save(); ctx.translate(0, (1 - q) * sh * 0.6); ctx.globalAlpha *= q;
        ctx.translate(sx + sw / 2, sy + sh / 2); ctx.scale(kb, kb); ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
        const s = Math.min(sw / pg.img.naturalWidth, sh / pg.img.naturalHeight);
        const dw = pg.img.naturalWidth * s, dh = pg.img.naturalHeight * s;
        ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30 * z; ctx.shadowOffsetY = 12 * z;
        ctx.drawImage(pg.img, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
        ctx.restore();
      }
      ctx.restore();
      ctx.restore();
    } };
  }
  function heroImage(ex, c) {
    const L = c.look, z = c.z;
    const a = exImage(ex.after);
    const ar = a && a.ok ? a.img.naturalWidth / a.img.naturalHeight : 1;
    let w = c.w, h = w / ar;
    if (h > 720 * z) { h = 720 * z; w = h * ar; }
    return { h: h + 20 * z, draw: (g, x0, y, wAll) => {
      const local = g.local - 0.25;
      if (local < 0) return;
      const ctx = g.ctx, x = x0 + (wAll - w) / 2, p = backOut(clamp(local / 0.5, 0, 1), 1.6);
      ctx.save(); ctx.globalAlpha = g.alpha * clamp(local / 0.25, 0, 1);
      ctx.translate(x + w / 2, y + h / 2); ctx.scale(0.85 + 0.15 * p, 0.85 + 0.15 * p); ctx.translate(-(x + w / 2), -(y + h / 2));
      ctx.save(); cardShadow(ctx, L, z); ctx.fillStyle = L.card; roundRect(ctx, x, y, w, h, 28 * z); ctx.fill(); ctx.restore();
      ctx.save(); roundRect(ctx, x, y, w, h, 28 * z); ctx.clip();
      if (a && a.ok) drawContain(ctx, a.img, x, y, w, h);
      const sp = clamp((local - 0.7) / 0.8, 0, 1);
      if (sp > 0 && sp < 1) {
        const sxx = x - w * 0.5 + sp * w * 2;
        const gr = ctx.createLinearGradient(sxx - 120 * z, y, sxx + 120 * z, y + h * 0.3);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
      }
      ctx.restore();
      ctx.restore();
    } };
  }
  function flowKind(words, side) {
    const w = String(words || '').toLowerCase();
    if (side === 'out') {
      if (/table|csv|excel|spreadsheet|rows|sheet|columns|split|breakdown/.test(w)) return 'table';
      if (/png|jpe?g|image|photo|picture|qr/.test(w)) return 'photo';
      if (/pdf|document|letter|report|contract|invoice|plan|cv|résumé|resume/.test(w)) return 'doc';
      return 'text';
    }
    if (/photo|image|picture|selfie|scan|screenshot/.test(w)) return 'photo';
    if (/pdf|invoice|receipt|document|contract|letter|statement|cv|résumé|resume|form|bill|payslip/.test(w)) return 'doc';
    if (/csv|excel|spreadsheet|table|data/.test(w)) return 'table';
    return 'text';
  }
  function heroFlow(ex, c, sc) {
    const L = c.look, z = c.z;
    const mid = 190 * z, cw = (c.w - mid) / 2, ch = Math.min(340 * z, cw * 1.15);
    const labIn = fitWords(ex.input || 'Your input', { px: 32 * z, weight: 700, fam: HEAD, lh: 1.12, track: -0.02 }, cw, 3, 18 * c.U);
    const labOut = fitWords(ex.output || 'The result', { px: 32 * z, weight: 700, fam: HEAD, lh: 1.12, track: -0.02 }, cw, 3, 18 * c.U);
    const labH = 34 * z + Math.max(labIn.h, labOut.h);
    const sIn = ex.sampleIn ? fitWords(String(ex.sampleIn).split(/\s*(?:;|\n|·)\s*/).join('\n'), { px: 22 * z, weight: 500, fam: BODY, lh: 1.3 }, cw - 44 * z, 8, 14 * c.U, ch - 80 * z) : null;
    const sOut = ex.sampleOut ? fitWords(String(ex.sampleOut).split(/\s*(?:;|\n|·)\s*/).join('\n'), { px: 22 * z, weight: 500, fam: BODY, lh: 1.3 }, cw - 44 * z, 8, 14 * c.U, ch - 80 * z) : null;
    const H = ch + 30 * z + labH;
    const over = (labIn.over || labOut.over) && 'flow labels';
    return { h: H, over, draw: (g, x, y) => {
      const ctx = g.ctx;
      const card = (cx, at, kind, sample, dir) => {
        const local = g.local - at;
        if (local < 0) return;
        const p = ease3(local / 0.45);
        ctx.save(); ctx.globalAlpha = g.alpha * p;
        ctx.translate(dir * (1 - p) * 60 * z, 0);
        ctx.save(); cardShadow(ctx, L, z * 0.7);
        const paper = kind === 'doc' && !L.light;
        ctx.fillStyle = paper ? '#fdfcf8' : L.card; roundRect(ctx, cx, y, cw, ch, 24 * z); ctx.fill(); ctx.restore();
        ctx.strokeStyle = hexA(L.cardInk, 0.1); ctx.lineWidth = 1.5 * z; roundRect(ctx, cx, y, cw, ch, 24 * z); ctx.stroke();
        if (sample) {
          drawBlock(Object.assign({}, g, { local: 9, alpha: 1 }), sample, cx + 22 * z, y + 26 * z, cw - 44 * z, { align: 'left', motion: 'none', treat: 'plain', ink: paper ? '#1c1a17' : L.cardInk });
          ctx.fillStyle = paper ? '#665f55' : L.cardMuted;
          capsLine(ctx, 'Illustration', cx + cw - 18 * z, y + ch - 24 * z, 15 * z, paper ? '#665f55' : L.cardMuted, 0.14, 700, cw - 30 * z, 'right');
        } else if (kind === 'doc') {
          const ink = paper ? 'rgba(28,26,23,.16)' : hexA(L.cardInk, 0.14);
          ctx.fillStyle = paper ? '#1c1a17' : L.cardInk; ctx.font = fontCss(800, 22 * z, HEAD); ctx.textBaseline = 'middle'; ctx.fillText('Document', cx + 26 * z, y + 40 * z);
          [0.86, 0.64, 0.92, 0.48, 0.78, 0.58].forEach((f, i) => { const q = clamp((local - 0.2 - i * 0.05) / 0.2, 0, 1); ctx.fillStyle = ink; roundRect(ctx, cx + 26 * z, y + 78 * z + i * 38 * z, (cw - 52 * z) * f * q, 16 * z, 8 * z); ctx.fill(); });
        } else if (kind === 'table') {
          for (let r = 0; r < 5; r++) for (let k = 0; k < 2; k++) {
            const q = clamp((local - 0.2 - (r * 2 + k) * 0.04) / 0.2, 0, 1);
            ctx.fillStyle = r === 0 ? hexA(L.accent, 0.35) : hexA(L.cardInk, 0.13);
            roundRect(ctx, cx + 22 * z + k * (cw - 44 * z) / 2, y + 30 * z + r * 54 * z, ((cw - 60 * z) / 2) * q, 34 * z, 8 * z); ctx.fill();
          }
        } else icon(ctx, kind === 'photo' ? 'photo' : 'text', cx + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.42, L.cardMuted, 1.6);
        ctx.restore();
      };
      const local = g.local;
      ctx.save(); ctx.globalAlpha = g.alpha;
      /* the wire: dashes flowing from input to output */
      const wy = y + ch / 2;
      const wp = ease3((local - 0.4) / 0.5);
      if (wp > 0) {
        ctx.save(); ctx.strokeStyle = L.accent; ctx.lineWidth = 6 * z; ctx.lineCap = 'round'; ctx.setLineDash([3 * z, 18 * z]); ctx.lineDashOffset = -local * 60 * z;
        ctx.beginPath(); ctx.moveTo(x + cw + 6 * z, wy); ctx.lineTo(x + cw + 6 * z + (mid - 12 * z) * wp, wy); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
      card(x, 0.2, flowKind(ex.input, 'in'), sIn, -1);
      card(x + cw + mid, 0.75, flowKind(ex.output, 'out'), sOut, 1);
      const ep = backOut(clamp((local - 0.5) / 0.45, 0, 1), 2.2);
      if (ep > 0) {
        ctx.save(); ctx.globalAlpha = g.alpha;
        glyphTile(g, L, sc.glyph, sc.section, x + cw + mid / 2, wy, 136 * z, ep, 14 * z);
        if (sc.ai) {
          ctx.font = fontCss(800, 22 * z, HEAD);
          const tw = ctx.measureText('AI').width + 22 * z;
          ctx.fillStyle = L.card; roundRect(ctx, x + cw + mid / 2 + 30 * z, wy - 86 * z, tw, 36 * z, 18 * z); ctx.fill();
          ctx.strokeStyle = hexA(L.accent, 0.6); ctx.lineWidth = 2 * z; ctx.stroke();
          ctx.fillStyle = L.cardInk; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('AI', x + cw + mid / 2 + 30 * z + tw / 2, wy - 67 * z); ctx.textAlign = 'left';
        }
        ctx.restore();
      }
      const lab = (lx, small, lay, at) => {
        const q = ease3((local - at) / 0.35);
        if (q <= 0) return;
        ctx.save(); ctx.globalAlpha = g.alpha * q;
        capsLine(ctx, small, lx, y + ch + 30 * z + 12 * z, 18 * z, L.muted, 0.14, 700, cw, 'left');
        drawBlock(Object.assign({}, g, { local: 9, alpha: 1 }), lay, lx, y + ch + 30 * z + 30 * z, cw, { align: 'left', motion: 'none', treat: 'plain', ink: L.ink });
        ctx.restore();
      };
      lab(x, 'You give it', labIn, 0.45);
      lab(x + cw + mid, 'You get', labOut, 1.0);
    } };
  }
  BUILD.example = (sc, c) => {
    const L = c.look, z = c.z;
    const ex = sc.ex;
    const items = [];
    if (!ex) return BUILD.text(Object.assign({}, sc, { type: 'text' }), c);
    const real = ex.kind !== 'flow';
    const illus = !real && (ex.sampleIn || ex.sampleOut);
    items.push(itSticker(real ? 'Real result from the tool' : illus ? 'How it works · illustration' : 'How it works', c, { icon: real ? 'check' : 'spark', at: 0.05 }));
    const heroC = c;
    const hero = ex.kind === 'calc' ? heroCalc(ex, heroC, sc) : ex.kind === 'text' ? heroCode(ex, heroC, sc) : ex.kind === 'beforeAfter' ? heroBA(ex, heroC, sc)
      : ex.kind === 'document' ? heroDoc(ex, heroC, sc) : ex.kind === 'image' ? heroImage(ex, heroC, sc) : heroFlow(ex, heroC, sc);
    hero.gap = 26 * z;
    items.push(hero);
    const lines = itemsOf(sc);
    const cap = real ? (ex.caption || '') : '';
    const foot = lines.slice(1).join(' ');
    if (cap) items.push(itBody(cap, c, { px: 28, at: 1.0, gap: 26, maxLines: 2, ink: L.muted, motion: 'fade', align: c.align === 'center' ? 'center' : 'left' }));
    if (foot) items.push(itBody(foot, c, { px: 28, at: 1.2, gap: 20, maxLines: 2, ink: L.muted, motion: 'fade' }));
    return items;
  };

  /* ---- the end card: the call to action, the QR, the proof pills ---- */
  BUILD.endcard = (sc, c) => {
    const L = c.look, z = c.z, S = c.S;
    const cc = Object.assign({}, c, { align: 'center' });
    const promo = !!S.promote;
    const items = [];
    const head = promo ? (sc.cta || 'Try it free') : (String(sc.title || '').trim() || String(S.brand.handle || '').trim());
    if (head) items.push(itHead(head, cc, { px: 124, hl: hlRange(head), at: 0.05, maxLines: 3 }));
    if (promo && sc.title) items.push(itBody(sc.title, cc, { px: 36, weight: 600, at: 0.25, gap: 14, maxLines: 2, align: 'center', motion: 'fade' }));
    const qrUrl = qrPayload(S);
    const qe = qrUrl ? qrEntry(qrUrl) : null;
    if (qe) {
      const size = 360 * z, pad = size * 0.06, lab = 52 * z;
      items.push({ h: size + pad * 2 + lab + 30 * z, gap: 40 * z, draw: (g, x, y, w) => {
        const local = g.local - 0.35;
        if (local < 0) return;
        const ctx = g.ctx, p = backOut(clamp(local / 0.5, 0, 1), 1.8);
        const cx = x + w / 2, top = y + 12 * z;
        const tw = size + pad * 2, th = size + pad * 2 + lab;
        ctx.save(); ctx.globalAlpha = g.alpha * clamp(local / 0.25, 0, 1);
        ctx.translate(cx, top + th / 2); ctx.scale(0.7 + 0.3 * p, 0.7 + 0.3 * p); ctx.rotate((1 - clamp(local / 0.5, 0, 1)) * -6 * Math.PI / 180); ctx.translate(-cx, -(top + th / 2));
        ctx.fillStyle = hexA(L.accent, 0.16); roundRect(ctx, cx - tw / 2 - 12 * z, top - 12 * z, tw + 24 * z, th + 24 * z, 40 * z); ctx.fill();
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 50 * z; ctx.shadowOffsetY = 20 * z;
        ctx.fillStyle = '#ffffff'; roundRect(ctx, cx - tw / 2, top, tw, th, 30 * z); ctx.fill(); ctx.restore();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qe.canvas, cx - size / 2, top + pad, size, size);
        ctx.imageSmoothingEnabled = true;
        capsLine(ctx, promo ? 'Scan to open' : 'Scan me', cx, top + pad + size + lab / 2, 22 * z, '#3f4456', 0.14, 700, size, 'center');
        ctx.restore();
      } });
    }
    const url = String(S.brand.url || '').trim();
    const freeLine = promo ? (sc.text || 'Free at 1234tools.com') : url;
    if (freeLine) {
      const fl = fitLine(freeLine, 46 * z, 800, HEAD, c.w, 22 * c.U);
      items.push({ h: 60 * z, gap: qe ? 34 * z : 40 * z, draw: (g, x, y, w) => {
        const p = ease3((g.local - 0.6) / 0.35);
        if (p <= 0) return;
        const ctx = g.ctx;
        ctx.save(); ctx.globalAlpha = g.alpha * p;
        ctx.font = fl.font; if (HAS_LS) ctx.letterSpacing = '0px';
        const host = fl.t.indexOf('1234tools.com');
        const x0 = x + (w - fl.w) / 2, yy = y + 30 * z + (1 - p) * 16 * z;
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        if (promo && host >= 0) {
          const a = fl.t.slice(0, host), b = '1234tools.com', rest = fl.t.slice(host + b.length);
          ctx.fillStyle = L.ink; ctx.fillText(a, x0, yy);
          const aw = ctx.measureText(a).width, bw = ctx.measureText(b).width;
          ctx.fillStyle = L.accentInk; ctx.fillText(b, x0 + aw, yy);
          ctx.fillStyle = L.ink; ctx.fillText(rest, x0 + aw + bw, yy);
        } else { ctx.fillStyle = promo ? L.ink : L.accentInk; ctx.fillText(fl.t, x0, yy); }
        if (fl.px < MIN_PX) MIN_PX = fl.px;
        ctx.restore();
      } });
    }
    const proof = (sc.proof || []).filter(Boolean).slice(0, 3);
    if (proof.length) {
      const px = 32 * z, ph = 66 * z, gp = 12 * z;
      const pills = proof.map((t) => fitLine(t, px, 600, BODY, c.w - 80 * z, 18 * c.U));
      /* one row if they fit, else one per row */
      const rowW = pills.reduce((a, p) => a + p.w + 70 * z, 0) + gp * (pills.length - 1);
      const rows = rowW <= c.w ? [pills] : pills.map((p) => [p]);
      const dots = [L.accent, L.ink2, CORAL];
      items.push({ h: rows.length * ph + (rows.length - 1) * gp, gap: 26 * z, draw: (g, x, y, w) => {
        const ctx = g.ctx;
        let k = 0;
        rows.forEach((row, ri) => {
          const rw = row.reduce((a, p) => a + p.w + 70 * z, 0) + gp * (row.length - 1);
          let px0 = x + (w - rw) / 2;
          row.forEach((p) => {
            const q = backOut(clamp((g.local - 0.8 - k * 0.12) / 0.35, 0, 1), 2.2);
            const pw = p.w + 70 * z, yy = y + ri * (ph + gp);
            if (q > 0) {
              ctx.save(); ctx.globalAlpha = g.alpha * clamp((g.local - 0.8 - k * 0.12) / 0.15, 0, 1);
              ctx.translate(px0 + pw / 2, yy + ph / 2); ctx.scale(q, q);
              ctx.fillStyle = hexA(L.accent, 0.1); roundRect(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fill();
              ctx.strokeStyle = hexA(L.accent, L.light ? 0.42 : 0.5); ctx.lineWidth = 1.5 * z; ctx.stroke();
              ctx.fillStyle = dots[k % 3]; ctx.beginPath(); ctx.arc(-pw / 2 + 30 * z, 0, 6 * z, 0, Math.PI * 2); ctx.fill();
              drawLine(ctx, p, -pw / 2 + 48 * z, 1 * z, L.ink, 'left');
              ctx.restore();
            }
            px0 += pw + gp; k++;
          });
        });
      } });
    }
    const handle = String(S.brand.handle || '').trim();
    const tail = promo ? 'Link in bio' + (handle ? ' · ' + handle : '') : [url ? 'Link in bio' : '', handle && handle !== head ? handle : ''].filter(Boolean).join(' · ');
    if (tail) {
      const fl = fitLine(tail, 30 * z, 700, HEAD, c.w, 18 * c.U);
      items.push({ h: 64 * z, gap: 26 * z, draw: (g, x, y, w) => {
        const p = ease3((g.local - 1.1) / 0.35);
        if (p <= 0) return;
        const ctx = g.ctx;
        ctx.save(); ctx.globalAlpha = g.alpha * p;
        const bs = 56 * z, tot = bs + 16 * z + fl.w, x0 = x + (w - tot) / 2;
        ctx.fillStyle = L.light ? '#fefefe' : hexA(L.ink, 0.075); roundRect(ctx, x0, y + 4 * z, bs, bs, 16 * z); ctx.fill();
        ctx.strokeStyle = lineOf(L); ctx.lineWidth = 1.5 * z; ctx.stroke();
        icon(ctx, 'bookmark', x0 + bs / 2, y + 4 * z + bs / 2, 30 * z, L.accentInk, 2.4);
        drawLine(ctx, fl, x0 + bs + 16 * z, y + 4 * z + bs / 2, L.ink, 'left');
        ctx.restore();
      } });
    }
    if (!items.length) items.push({ h: 1, draw: () => {} });
    return items;
  };

  /** The fitted plan of a wordy scene or end card: items, their places, cached on the scene. */
  function planOf(scene, W, H, L, S) {
    setFloor(W, H);
    const box = contentBox(W, H, S);
    const key = [W, H, L.key, FONTGEN, box.y | 0, box.h | 0, scene.type, scene.text, scene.heading, scene.eyebrow, scene.hl, scene.foot, scene.sub, scene.anim, scene.seconds,
      (scene.emphasis || []).join(','), scene.cta, scene.title, (scene.proof || []).join('|'), S.brand.handle, S.brand.url, S.brand.qr, qrPayload(S), S.brand.logo ? 1 : 0,
      scene.ex ? exImages(scene.ex).map((e) => (e.ok ? 1 : 0)).join('') : ''].join('\u0001');
    if (scene._plan && scene._plan.key === key) return scene._plan;
    const U = box.U;
    const align = L.layout === 'poster' || W > H * 1.3 ? 'center' : 'left';
    const build = BUILD[scene.type] || BUILD.text;
    let s = 1, items = [], total = 0;
    for (let k = 0; k < 30; k++) {
      const c = { s, U, z: s * U, w: box.w, look: L, S, W, H, align: scene.type === 'endcard' ? 'center' : align, motion: motionOf(scene, L) };
      items = build(scene, c);
      total = items.reduce((a, it, i) => a + it.h + (i ? it.gap || 0 : 0), 0);
      if (total <= box.h + 0.5) break;
      s *= 0.94;
    }
    const overs = [];
    if (total > box.h + 1) overs.push('stack ' + Math.round(total) + ' px in ' + Math.round(box.h) + ' px');
    for (const it of items) if (it.over) overs.push(it.over);
    for (const o of overs) noteOver(scene.type + ' at ' + W + '×' + H + ' (' + L.spec.palette + '/' + L.spec.type + '): ' + o);
    let y = box.y + (box.h - total) / 2;
    const placed = items.map((it, i) => { if (i) y += it.gap || 0; const at = { it, y }; y += it.h; return at; });
    scene._plan = { key, placed, deco: items.deco, box, s, total, overs };
    return scene._plan;
  }
  function drawBeat(ctx, W, H, scene, local, alpha, L, S) {
    const P = planOf(scene, W, H, L, S);
    const g = { ctx, W, H, U: P.box.U, local, alpha: clamp(alpha, 0, 1), look: L, S, seconds: scene.seconds };
    if (g.alpha <= 0.002) return;
    if (P.deco) P.deco(g);
    for (const { it, y } of P.placed) it.draw(g, P.box.x, y, P.box.w);
  }

  /* ------------------------------------------------------------------ */
  /* pictures and clips                                                 */
  /* ------------------------------------------------------------------ */
  function wrapText(text, px, weight, font, maxW, upper) {
    MEASURE.font = fontOf(weight, px, font); if (HAS_LS) MEASURE.letterSpacing = '0px';
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
  function drawLines(ctx, text, cx, cy, px, weight, colourStr, maxW, maxLines, font) {
    let wr = wrapText(text, px, weight, font, maxW, false);
    for (let k = 0; k < 12 && (wr.widest > maxW || wr.lines.length > maxLines); k++) { px *= 0.9; wr = wrapText(text, px, weight, font, maxW, false); }
    if (wr.widest > maxW + 0.5) noteOver('media caption "' + oneLine(text).slice(0, 40) + '"');
    const lines = wr.lines.slice(0, maxLines);
    const lh = px * 1.15;
    ctx.font = fontOf(weight, px, font); if (HAS_LS) ctx.letterSpacing = '0px';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = colourStr;
    lines.forEach((l, i) => ctx.fillText(l, cx, cy - (lines.length - 1) * lh / 2 + i * lh));
    return { h: lines.length * lh, px, w: wr.widest };
  }
  function measureLines(text, px, weight, maxW, maxLines, font) {
    let wr = wrapText(text, px, weight, font, maxW, false);
    for (let k = 0; k < 12 && (wr.widest > maxW || wr.lines.length > maxLines); k++) { px *= 0.9; wr = wrapText(text, px, weight, font, maxW, false); }
    return Math.min(maxLines, wr.lines.length) * px * 1.15;
  }
  /** The rectangle media and its caption share: inside the safe area, below the header, the caption below. */
  function mediaRegion(W, H, hasCaption, S) {
    const c = chromeOf(W, H, S);
    const top = c.hasHead ? c.headY + c.headH + 24 * c.U : (c.sf.top + 0.03) * H;
    const bot = (c.showFoot ? c.footY - 24 * c.U : c.barY - 20 * c.U) - (hasCaption ? 0.1 * H : 0);
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
    const reg = mediaRegion(W, H, !!capText && S.captions.source !== 'none', S);
    const kb = scene.motion ? 1 + 0.06 * clamp(local / Math.max(0.1, scene.seconds), 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const enter = ease3(local / 0.45);
    if (scene.fit === 'cover') {
      if (ready) drawCover(ctx, src, sw, sh, 0, 0, W, H, kb);
      const shade = ctx.createLinearGradient(0, H * 0.6, 0, H);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = shade; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    } else if (scene.fit === 'phone') {
      const maxH = reg.bot - reg.top;
      let ph = Math.min(maxH, H * 0.8), pw = ph * 9 / 19.5;
      if (pw > W * 0.62) { pw = W * 0.62; ph = pw * 19.5 / 9; }
      const x = (W - pw) / 2, y = reg.top + (maxH - ph) / 2 + (1 - enter) * 80 * U / 1080;
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
      const x = (W - cw) / 2, y = reg.top + (maxH - ch) / 2 + (1 - enter) * 80 * U / 1080;
      const rad = 36 * U / 1080;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = W * 0.06; ctx.shadowOffsetY = W * 0.012;
      ctx.fillStyle = look.light ? '#fefefe' : '#0b0f19'; roundRect(ctx, x, y, cw, ch, rad); ctx.fill();
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
      const capY = scene.fit === 'cover' ? (1 - safeOf(W, H).bottom) * H - h / 2 - 0.05 * H : reg.capY;
      ctx.fillStyle = look.plate;
      const wr = wrapText(capText, px, 700, look.font, maxW - px, false);
      const bw = Math.min(maxW, wr.widest + px * 1.2);
      roundRect(ctx, W / 2 - bw / 2, capY - h / 2 - px * 0.35, bw, h + px * 0.7, px * 0.45); ctx.fill();
      drawLines(ctx, capText, W / 2, capY, px, 700, look.plateText, maxW - px, 2, look.font);
    }
    ctx.restore();
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
    const n = sc.length;
    if (t >= D) { const i = n - 1; return { i, n, scene: sc[i], local: sc[i].seconds, prev: null, blend: 1, start: starts[i], starts, D }; }
    let i = 0;
    while (i < n - 1 && t >= starts[i + 1]) i++;
    const local = Math.max(0, t - starts[i]);
    let prev = null, blend = 1;
    if (i > 0 && local < XFADE) { prev = sc[i - 1]; blend = easeOut(local / XFADE); }
    return { i, n, scene: sc[i], local, prev, blend, start: starts[i], starts, D };
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
    setFloor(W, H);
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const at = sceneAt(t, S);
    drawBackground(ctx, W, H, t, look, at && at.scene, S);
    if (at) {
      const draw = (scene, local, alpha) => {
        if (isWordy(scene) || scene.type === 'endcard') drawBeat(ctx, W, H, scene, local, alpha, look, S);
        else if (scene.type === 'media') drawMedia(ctx, W, H, scene, local, alpha, look, S);
      };
      if (at.prev) {
        /* the outgoing scene leaves in the look's own way */
        ctx.save();
        const k = at.blend, m = motionOf(at.prev, look);
        if (m === 'slide') ctx.translate(0, -60 * Math.min(W, H) / 1080 * k);
        else if (m === 'pop' || m === 'punch') { ctx.translate(W / 2, H / 2); const s = 1 + 0.06 * k; ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); }
        draw(at.prev, at.prev.seconds, 1 - k);
        ctx.restore();
      }
      const fadeUp = at.i === 0 ? clamp(t / 0.3, 0, 1) : 1;
      draw(at.scene, at.local, at.blend * fadeUp);
      const onEnd = at.scene.type === 'endcard';
      if (S.captions.source === 'auto' && S.captions.cues.length && !onEnd) {
        const AC = A.tools['auto-captions'];
        const U = Math.min(W, H);
        const st = Object.assign({}, S.captions.style, { size: (Number(S.captions.style.size) || 7) * U / W });
        /* captions sit above the credit line and the progress bar, never on them */
        const ch = chromeOf(W, H, S);
        st.maxBottom = (S.brand.progress ? ch.barY : ch.credit ? ch.credY : ch.bandTop) - 10 * ch.U;
        if (AC) AC.drawCaptions(ctx, W, H, t, S.captions.cues, st);
      }
      drawHeader(ctx, W, H, look, S, at);
      if (o.progress !== false) drawFooter(ctx, W, H, t, at.D, look, S, at);
    }
    /* the two marks, on every frame, the cover and the preview alike (o.credit concerns only the old corner credit, no longer drawn here) */
    drawAiLabel(ctx, W, H, look, S);
    drawMadeWith(ctx, W, H, look, S);
    ctx.restore();
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
      /* the track can start part-way in (its chorus, its drop); a loop goes back to that point, not to the intro */
      const from = clamp(Number(mu.from) || 0, 0, Math.max(0, mu.audioBuffer.duration - 0.5));
      if (mu.loop) { src.loop = true; src.loopStart = from; src.loopEnd = mu.audioBuffer.duration; }
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
      if (mu.loop) src.start(0, from); else src.start(0, from, Math.min(mu.audioBuffer.duration - from, D));
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
  async function* framesOf(S, w, h, D, signal, opening) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const total = Math.max(1, Math.round(D * FPS));
    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) throw abortError();
      const t = i / FPS;
      await prepareMedia(S, t);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      renderFrame(ctx, w, h, t, S);
      if (opening) opening(ctx, w, h, t);
      yield { canvas: c, timestampUs: Math.round(i * 1e6 / FPS), durationUs: Math.round(1e6 / FPS) };
    }
  }

  /* ------------------------------------------------------------------ */
  /* opening on the cover                                               */
  /* ------------------------------------------------------------------ */

  /* Instagram, TikTok and Shorts take a video's first frame as its preview
     unless a cover is picked by hand, and a reel's first frame is its opening
     scene before anything has faded in: nearly blank. So the export lays the
     cover frame over the first OPEN_HOLD seconds and dissolves it over the
     next OPEN_FADE, while the reel runs underneath as usual: frame 0 IS the
     cover, the length and the sound do not move, and with the default cover
     (the opening scene, fully drawn) the dissolve is seamless. */
  const OPEN_HOLD = 0.4, OPEN_FADE = 0.3;
  /** The cover's moment: the one picked, else three quarters into the opening scene. */
  function coverTimeOf(X) {
    const D = totalSeconds(X);
    if (X.coverT !== null && X.coverT !== undefined && X.coverT <= D) return X.coverT;
    const f = X.scenes[0];
    return f ? 0.75 * f.seconds : 0;
  }
  /** The overlay for an export of X at w×h, or null when the option is off. Call before encoding. */
  async function openingFor(X, w, h) {
    if (X.openOnCover === false || !X.scenes.length) return null;
    const ct = coverTimeOf(X);
    await prepareMedia(X, ct);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h);
    renderFrame(cx, w, h, ct, X, { progress: false });
    await prepareMedia(X, 0);
    return (ctx, W, H, t) => {
      if (t >= OPEN_HOLD + OPEN_FADE) return;
      const a = t < OPEN_HOLD ? 1 : 1 - (t - OPEN_HOLD) / OPEN_FADE;
      ctx.save(); ctx.globalAlpha = a; ctx.drawImage(c, 0, 0, W, H); ctx.restore();
    };
  }
  let fontsP = null;
  /** The site's two faces in every weight the beats use; layouts measured before they arrived are thrown away. */
  function loadFonts() {
    if (fontsP) return fontsP;
    if (!document.fonts || !document.fonts.load) return (fontsP = Promise.resolve());
    const want = ['800 40px "Sora"', '700 40px "Sora"', '600 40px "Sora"', '500 20px "Sora"', '400 20px "Inter"', '500 20px "Inter"', '600 20px "Inter"', '700 20px "Inter"', '800 20px "Inter"'];
    fontsP = Promise.all(want.map((f) => document.fonts.load(f).catch(() => {}))).then(() => { FONTGEN++; if (API) API.invalidate(); });
    return fontsP;
  }
  async function prepareFonts(S) {
    await loadFonts();
    const c = document.createElement('canvas'); c.width = 2; c.height = 2;
    try { renderFrame(c.getContext('2d'), 1080, 1920, 0, S, { credit: false }); } catch (e) { /* warm-up only */ }
  }
  async function prepareAssets(S) {
    if (S.brand.logoKind === 'site' && !S.brand.logo) { try { S.brand.logo = await loadSiteLogo(); } catch (e) { /* no logo then */ } }
    const q = qrPayload(S);
    if (q) { const e = qrEntry(q); if (e && e.ready) await e.ready; }
    /* the example's pictures and the tool's glyph, so the first exported frame has them */
    const waits = [];
    for (const sc of S.scenes) {
      if (sc.ex) for (const im of exImages(sc.ex)) waits.push(im.ready);
      if (sc.glyph) {
        const L = S.look;
        for (const col of [L.chipInk, L.accent]) { glyphCanvas(sc.glyph, col, 'i-' + (sc.section || '')); const e = glyphCache.get(sc.glyph + '|' + col); if (e && e.ready) waits.push(e.ready); }
      }
    }
    if (S.promote && S.promote.glyph) { glyphCanvas(S.promote.glyph, S.look.ink, 'i-' + sectionOf(S.promote.path)); const e = glyphCache.get(S.promote.glyph + '|' + S.look.ink); if (e && e.ready) waits.push(e.ready); }
    await Promise.all(waits.map((p) => Promise.race([p, sleep(4000)]).catch(() => {})));
    for (const sc of S.scenes) sc._plan = null;
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
      look: lookFrom({ palette: 'midnight', type: 'gradient', motion: 'pop', bg: 'glow', layout: 'classic', copy: 0 }),
      lookLock: {}, lookOver: {}, lookTool: 'custom',
      brand: { handle: '', url: '', endcard: true, qr: false, progress: true, safe: true, logo: null, logoKind: 'none', utm: 'instagram', aiLabel: false, madeWith: true },
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
    const exampleBtn = button('Try an example', 'btn-ghost', () => { scriptBox.value = EXAMPLE; tplSel.value = ''; tplHint.textContent = TPL_HINT; scriptBox.focus(); });
    const TPL_HINT = 'A template is a scene skeleton: replace the [bracketed] words with yours. HOOK:, PAIN:, USUAL:, FIX:, STEPS:, POINT:, VERSUS:, QUOTE: and CTA: at the start of a line pick the kind of scene; | separates its parts.';
    const tplSel = select('reel-template', [['', 'Blank — write my own']].concat(TEMPLATES.map((t) => [t[0], t[1]])), '');
    const tplHint = hint(TPL_HINT);
    let tplText = '';
    tplSel.addEventListener('change', () => {
      const t = TEMPLATES.find((x) => x[0] === tplSel.value);
      if (!t) { tplHint.textContent = TPL_HINT; return; }
      const cur = scriptBox.value.trim();
      if (cur && cur !== tplText.trim() && cur !== EXAMPLE && !confirm('Replace your script with the “' + t[1] + '” template?')) { tplSel.value = ''; return; }
      scriptBox.value = tplText = t[3];
      tplHint.textContent = t[2] + ' Replace the [bracketed] words with yours.';
      scriptBox.focus();
    });
    scriptPane.append(field('Start from a template', tplSel), tplHint, field('Your script', scriptBox, 'One line is one scene. #word on a line of its own colours that word in the scene above.'), row(makeBtn, exampleBtn));
    const promotePane = el('div', 'reel-mode'); promotePane.dataset.mode = 'promote'; promotePane.hidden = true; promotePane.setAttribute('role', 'tabpanel');
    const picker = el('div', 'reel-picker');
    const find = el('input', 'control'); find.id = 'reel-find'; find.type = 'search'; find.placeholder = 'Search the tools…'; find.autocomplete = 'off';
    find.setAttribute('role', 'combobox'); find.setAttribute('aria-controls', 'reel-tools'); find.setAttribute('aria-expanded', 'true');
    const filterRow = el('div', 'reel-filter'); filterRow.setAttribute('role', 'group'); filterRow.setAttribute('aria-label', 'Filter by section');
    const toolList = el('ul', 'reel-tools'); toolList.id = 'reel-tools'; toolList.setAttribute('role', 'listbox'); toolList.setAttribute('aria-label', 'Tools');
    const pickStatus = el('p', 'aiimg-status', 'Loading the tool list…');
    /* one click makes every ticked tool's reel: the button says how many, changes at once, and the run starts without a second "Start" */
    const batchBtn = button('Make reels', 'btn-primary', () => openBatch()); batchBtn.id = 'reel-batch'; batchBtn.disabled = true;
    const clearBtn = button('Clear', 'btn-ghost', () => { S.picked.clear(); renderPicker(); });
    const batchFolder = check('reel-batch-folder', 'Save into a folder (asks once)', false); batchFolder.hidden = typeof window.showDirectoryPicker !== 'function';
    const batchCaps = check('reel-batch-captions', 'Also save reel-captions.txt', true);
    const batchLine = el('p', 'aiimg-status reel-batch-line'); batchLine.id = 'reel-batch-line'; batchLine.setAttribute('aria-live', 'polite');
    const pickFoot = el('div', 'aiimg-row reel-picker-foot'); pickFoot.append(batchBtn, clearBtn, hint('Click a tool to open its reel; tick one or more and press Make to export one reel each.'));
    picker.append(field('Find a tool', find), filterRow, pickStatus, toolList, pickFoot, row(batchFolder, batchCaps), batchLine);
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
    const shuffleBtn = button('Shuffle look', 'btn-ghost', () => shuffleLook()); shuffleBtn.id = 'reel-shuffle';
    shuffleBtn.title = 'A new palette, type treatment, motion and background';
    transport.append(playBtn, scrub, clockEl, shuffleBtn, overBtn);
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
    const addText = button('+ Text scene', 'btn-ghost', () => addScene(beat('text', { text: 'New scene' })));
    const addMedia = button('+ Media scene', 'btn-ghost', () => { showPane('media'); mediaFile.click(); });
    const addEnd = button('+ End card', 'btn-ghost', () => { if (!S.scenes.some((x) => x.type === 'endcard')) addScene(endCardScene(), true); });
    /** A fresh end card: the story's (call to action, proof pills) for a tool, the visitor's own otherwise. */
    function endCardScene() {
      if (S.promote) {
        const sc = buildScript(S.promote, Object.assign({}, S.brand, { endcard: true }), S.look).filter((x) => x.type === 'endcard')[0];
        if (sc) return sc;
      }
      return beat('endcard', { title: S.brand.handle || '', qr: !!S.brand.qr });
    }
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
      S.scenes.forEach((x) => { x._plan = null; });
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
        const kind = el('span', 'reel-kind', sc.type === 'media' ? (sc.media && sc.media.kind === 'video' ? 'Clip' : 'Picture') : (KIND_LABEL[sc.type] || 'Text'));
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
        const dup = button('⧉', 'btn-ghost', () => { const c = Object.assign({}, sc, { id: nid(), _plan: null, emphasis: (sc.emphasis || []).slice(), proof: sc.proof ? sc.proof.slice() : sc.proof }); S.scenes.splice(i + 1, 0, c); scenesChanged(true); selectScene(i + 1); });
        dup.setAttribute('aria-label', 'Duplicate'); dup.disabled = sc.type === 'endcard';
        const del = button('✕', 'btn-ghost', () => { const [x] = S.scenes.splice(i, 1); scenesChanged(true); offerUndo(x, i); });
        del.setAttribute('aria-label', 'Delete scene ' + (i + 1));
        head.append(badge, kind, secs, unit, upB, dnB, dup, del);
        li.appendChild(head);
        /* a heading for the beats that have one (the usual way's title, the tool name, a step list's title, a quote's name …) */
        if (HEADING_LABEL[sc.type]) {
          const hi = el('input', 'control reel-scene-heading'); hi.value = sc.heading || ''; hi.placeholder = HEADING_LABEL[sc.type];
          hi.setAttribute('aria-label', HEADING_LABEL[sc.type] + ' for scene ' + (i + 1));
          hi.addEventListener('input', () => { sc.heading = hi.value; sc._plan = null; syncVO(sc); refreshCaptionPreview(); invalidate(); });
          hi.addEventListener('focus', () => { if (S.live !== i) selectScene(i); });
          li.appendChild(hi);
        }
        const ta = el('textarea', 'control reel-scene-text');
        const listy = sc.type === 'usual' || sc.type === 'steps' || sc.type === 'versus';
        ta.rows = listy ? 3 : isWordy(sc) ? 2 : 1;
        ta.value = sc.type === 'endcard' ? (sc.title || '') : (sc.text || '');
        ta.placeholder = sc.type === 'media' ? 'Optional caption line' : sc.type === 'endcard' ? 'Title on the end card' : listy ? 'One item per line' : 'Scene text';
        ta.setAttribute('aria-label', (sc.type === 'endcard' ? 'End card title' : sc.type === 'media' ? 'Caption for scene ' : 'Text of scene ') + (sc.type === 'endcard' ? '' : (i + 1)));
        ta.addEventListener('input', () => {
          if (sc.type === 'endcard') sc.title = ta.value;
          else {
            const was = sc.text;
            sc.text = ta.value;
            /* the hook's key word follows the text unless the visitor chose one with #word */
            if (sc.type === 'hook' && !sc._userEm && was !== sc.text) sc.emphasis = [keyWordOf(sc.text)];
          }
          sc._plan = null;
          syncVO(sc);
          refreshCaptionPreview();
          invalidate();
        });
        ta.addEventListener('focus', () => { if (S.live !== i) selectScene(i); });
        li.appendChild(ta);
        /* what the voice says in this scene (the same line as in Sound) */
        const vo = el('textarea', 'control reel-scene-vo'); vo.rows = 1; vo.value = voOf(sc); vo.dataset.id = sc.id;
        vo.placeholder = 'Voice-over: silent';
        vo.setAttribute('aria-label', 'Voice-over for scene ' + (i + 1));
        vo.title = 'What the voice says in this scene';
        vo.addEventListener('input', () => { sc.vo = vo.value; syncVO(sc, vo); voChanged(); });
        vo.addEventListener('focus', () => { if (S.live !== i) selectScene(i); });
        li.appendChild(vo);
        if (isWordy(sc)) {
          const an = select('reel-anim-' + sc.id, ANIMS, OLD_ANIM[sc.anim] || sc.anim || 'auto');
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
      renderVO();
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
    const mmss = (v) => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');
    const musicFrom = range('reel-music-from', 0, 1, 0.5, 0, (v) => mmss(v) + (S.music ? ' of ' + mmss(S.music.duration) : ''));
    let listen = null;
    const stopListen = () => { if (listen) { try { listen.src.stop(); } catch (e) { /* */ } listen.ctx.close().catch(() => {}); listen = null; } listenBtn.textContent = '▶ Listen'; listenBtn.setAttribute('aria-pressed', 'false'); };
    const listenBtn = button('▶ Listen', 'btn-ghost', () => {
      if (listen || !S.music) { stopListen(); return; }
      const ctx = new AudioContext();
      const src = ctx.createBufferSource(); src.buffer = S.music.audioBuffer;
      const g = ctx.createGain(); g.gain.value = dB(S.music.gainDb + 8);
      src.connect(g); g.connect(ctx.destination);
      src.onended = stopListen;
      src.start(0, Number(musicFrom.input.value) || 0, 8);
      listen = { ctx, src };
      listenBtn.textContent = '■ Stop'; listenBtn.setAttribute('aria-pressed', 'true');
    });
    listenBtn.id = 'reel-music-listen'; listenBtn.setAttribute('aria-pressed', 'false');
    const musicCtl = el('div', 'reel-music-ctl'); musicCtl.hidden = true;
    musicCtl.append(field('Start the track at', musicFrom), row(listenBtn), hint('Pick where the music begins, such as its chorus. Listen plays 8 seconds from there; a looped track goes back to this point, not to the start.'),
      field('Music volume', musicGain), duckChk, loopChk);
    on(musicFrom, () => { if (!S.music) return; S.music.from = Number(musicFrom.input.value) || 0; if (listen) stopListen(); soundDirty(); });
    on(musicGain, () => { if (!S.music) return; S.music.gainDb = Number(musicGain.input.value); S.music.touched = true; soundDirty(); });
    on(duckChk, () => { if (S.music) { S.music.duck = duckChk.input.checked; soundDirty(); } });
    on(loopChk, () => { if (S.music) { S.music.loop = loopChk.input.checked; soundDirty(); } });
    const prevSoundChk = on(check('reel-preview-sound', 'Play the sound with the preview', true), () => { S.previewSound = prevSoundChk.input.checked; if (!S.previewSound) stopPreviewSound(); else if (S.playing) startPreviewSound(); });
    const soundStatus = el('p', 'aiimg-status'); soundStatus.id = 'reel-sound-status'; soundStatus.setAttribute('aria-live', 'polite');
    /* generated voice: Kokoro-82M on the device (aivid-tts.js) */
    const TTS = window.AIVidTTS || null;
    let ttsJob = null, ttsPlay = null;
    const ttsVoice = el('select', 'control'); ttsVoice.id = 'reel-tts-voice';
    if (TTS) {
      for (const acc of Object.keys(TTS.ACCENTS)) {
        const og = el('optgroup'); og.label = TTS.ACCENTS[acc];
        for (const v of TTS.voices.filter((x) => x.accent === acc)) { const op = el('option', null, v.label); op.value = v.id; og.appendChild(op); }
        ttsVoice.appendChild(og);
      }
      ttsVoice.value = 'af_heart';
    }
    const ttsSpeed = range('reel-tts-speed', 0.8, 1.2, 0.05, 1, (v) => v.toFixed(2) + '×');
    const ttsPause = range('reel-tts-pause', 0, 1.5, 0.1, 0.4, (v) => v.toFixed(1) + ' s');
    const previewBtn = button('▶ Preview', 'btn-ghost', () => previewVoice()); previewBtn.id = 'reel-tts-preview';
    const genBtn = button('Generate voice', 'btn-primary', () => generateVoice()); genBtn.id = 'reel-tts-generate';
    const ttsCancel = button('Cancel', 'btn-ghost', () => { if (ttsJob) ttsJob.abort(); }); ttsCancel.id = 'reel-tts-cancel'; ttsCancel.hidden = true;
    const ttsProgress = el('div', 'aiimg-progress'); const ttsBar = el('i'); ttsProgress.appendChild(ttsBar); ttsProgress.hidden = true;
    ttsProgress.setAttribute('role', 'progressbar'); ttsProgress.setAttribute('aria-valuemin', '0'); ttsProgress.setAttribute('aria-valuemax', '100'); ttsProgress.setAttribute('aria-label', 'Voice generation progress');
    const ttsStatus = el('p', 'aiimg-status'); ttsStatus.id = 'reel-tts-status'; ttsStatus.setAttribute('aria-live', 'polite');
    const ttsBox = el('div', 'reel-tts');
    ttsBox.append(field('Voice', ttsVoice), field('Speed', ttsSpeed), field('Pause after each scene', ttsPause), row(genBtn, previewBtn, ttsCancel), ttsProgress, ttsStatus,
      hint('A synthetic voice reads each scene’s text aloud, made on your device by Kokoro-82M (Apache-2.0 licence). The first use downloads about 94 MB from this site — the 92 MB model, a 1.5 MB pronunciation dictionary and 0.5 MB for each voice you try, plus the 14 MB AI runtime if the captions have not already fetched it — and your browser keeps them. The script never leaves your device. English only for now.'));
    if (!TTS) ttsBox.hidden = true;
    /* the voice-over script: one line per scene, what is SAID — written for the ear, apart from the screen text */
    const voList = el('ol', 'reel-vo'); voList.id = 'reel-vo';
    const voResetAll = button('Reset all to suggested', 'btn-ghost', () => { for (const sc of S.scenes) delete sc.vo; renderVO(); voChanged(); });
    voResetAll.id = 'reel-vo-reset-all';
    const PRON_STORE = 'reel-maker-pronunciation';
    const pronBox = el('textarea', 'control reel-pron'); pronBox.id = 'reel-pron'; pronBox.rows = 3; pronBox.spellcheck = false;
    pronBox.placeholder = 'Zerodha = zeh-roh-dah\nNiamh = neeve';
    try { pronBox.value = localStorage.getItem(PRON_STORE) || ''; } catch (e) { /* storage blocked: the box still works for this visit */ }
    pronBox.addEventListener('input', () => { try { localStorage.setItem(PRON_STORE, pronBox.value); } catch (e) { /* not kept */ } updateSoundStatus(); });
    const voBox = el('div', 'reel-vo-box');
    voBox.append(hint('What the voice says in each scene. It starts as a suggestion written to be heard — links, codes and symbols on the screen are left out or said in words — and you can change any line. An empty line is a silent scene. Generate voice reads these lines, the teleprompter shows them, and the captions of a generated voice are these words.'),
      voList, row(voResetAll),
      field('Pronunciation', pronBox, 'One per line: word = how it sounds. Used for this reel’s generated voice and kept in this browser only; the captions still show the word as written.'));
    panes.sound.append(h('Voice-over script'), voBox,
      h('Voiceover'), row(recVoiceBtn, upVoiceBtn), voiceFile, level, prompter, voiceInfo, voiceCtl,
      hint('Recording asks for the microphone only when you press the button. The voice-over script is shown as a teleprompter while you read.'),
      h('Or generate a voice'), ttsBox,
      h('Music'), row(upMusicBtn), musicFile, musicInfo, musicCtl, hint('Use a track you have the rights to; the file never leaves your device.'),
      prevSoundChk, soundStatus);
    voiceFile.addEventListener('change', () => { const f = voiceFile.files[0]; voiceFile.value = ''; if (f) setVoice(f); });
    musicFile.addEventListener('change', () => { const f = musicFile.files[0]; musicFile.value = ''; if (f) setMusic(f); });

    function updateSoundStatus() {
      const parts = [];
      const D = totalSeconds(S);
      if (S.voice) parts.push('Voice ' + S.voice.duration.toFixed(1) + ' s from ' + S.voice.offset.toFixed(1) + ' s');
      if (S.music) parts.push('music ' + S.music.gainDb + ' dB' + (S.music.from ? ' from ' + mmss(S.music.from) : '') + (S.music.duck && S.voice ? ', ducked' : '') + (S.music.loop ? ', looped' : ''));
      const clips = S.scenes.filter((x) => x.type === 'media' && x.sound).length;
      if (clips) parts.push(clips + ' clip' + (clips === 1 ? '' : 's') + ' with their own sound');
      soundStatus.textContent = parts.length ? capFirst(parts.join(' · ')) + ' · reel ' + D.toFixed(1) + ' s' : 'No sound yet — the reel will be silent unless you add a voice or music.';
      fitChk.hidden = !S.voice;
      /* a generated voice turns the AI label on (and removing it, off): the layout moves, so beats are laid out again */
      const marks = aiLabelOf(S) + '|' + madeWithOn(S);
      if (marks !== S._marks) { S._marks = marks; for (const sc of S.scenes) sc._plan = null; invalidate(); }
      try { syncMarksUi(); } catch (e) { /* the Export pane is not built yet */ }
      if (S.voice && S.voice.generated && !ttsJob) {
        const stale = scriptKey(spokenScenes()) !== S.voice.generated.script;
        ttsStatus.textContent = stale ? 'The scene text has changed since the voice was made — press Generate voice again to match it.' : S.voice.generated.note;
        ttsStatus.className = 'aiimg-status' + (stale ? ' is-warn' : '');
      }
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
      S.music = { file, name: file.name || 'music', duration: dec.duration, audioBuffer: dec.audioBuffer, gainDb: g, duck: duckChk.input.checked, loop: loopChk.input.checked, touched: false, from: 0 };
      musicGain.set(g);
      stopListen();
      musicFrom.input.max = String(Math.max(0, Math.floor((dec.duration - 1) * 2) / 2));
      musicFrom.set(0);
      infoRow(musicInfo, S.music.name, S.music.duration, () => { stopListen(); S.music = null; musicInfo.hidden = true; musicCtl.hidden = true; soundDirty(); });
      musicCtl.hidden = false;
      soundDirty();
    }
    /** Fit scenes to the voice: scale text and media scenes to the voice's length (each 1–15 s); the end card keeps its own. */
    function applyFit() {
      /* `base` is the length the visitor chose; fitting scales from it, unticking goes back to it */
      for (const sc of S.scenes) if (sc.base === undefined) sc.base = sc.seconds;
      if (S.fitVoice && S.voice && S.voice.plan) {
        /* a generated voice knows how long each scene's line lasts: each scene lasts that long */
        for (const sc of S.scenes) sc.seconds = S.voice.plan[sc.id] !== undefined ? S.voice.plan[sc.id] : sc.base;
      } else if (S.fitVoice && S.voice) {
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

    /* ---------------- generated voice ---------------- */
    /** The scenes the voice reads, in order, with their voice-over lines; a scene with an empty line is silent and keeps its length. */
    function spokenScenes() {
      return S.scenes.map((sc) => ({ sc, text: voOf(sc) })).filter((x) => /[\p{L}\p{N}]/u.test(x.text || ''));
    }
    function scriptKey(list) { return list.map((x) => x.sc.id + '\u0001' + x.text).join('\u0002') + '\u0003' + pronBox.value.trim(); }
    /** The visitor's "word = sounds like" lines. */
    function pronRules() {
      const out = [];
      for (const line of pronBox.value.split('\n')) {
        const m = /^\s*([^=]+?)\s*=\s*(.+?)\s*$/.exec(line);
        if (m && m[1] && m[2]) out.push([new RegExp('(^|[^\\p{L}\\p{N}])' + m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'giu'), m[2]]);
      }
      return out;
    }
    /** The line the voice is given: the voice-over with the visitor's pronunciations swapped in (the captions keep the words as written). */
    function pronApply(text) {
      let t = String(text || '');
      for (const [re, to] of pronRules()) t = t.replace(re, (m, pre) => pre + to);
      return t;
    }
    const sentencesOf = (text) => String(text || '').split(/(?<=[.!?…]["”')\]]*)\s+/).map((s) => s.trim()).filter(Boolean);
    /** What the scene shows, in a line, beside its voice-over box. */
    function refOf(sc) {
      const t = sc.type === 'endcard' ? 'End card: ' + [sc.cta, sc.title].filter(Boolean).join(' · ')
        : sc.type === 'media' ? (sc.media ? sc.media.name : 'Picture') + (sc.text ? ' — ' + oneLine(sc.text) : '')
        : oneLine([sc.heading, sc.text].filter(Boolean).join(' · '));
      return 'On screen: ' + (t.length > 110 ? t.slice(0, 108) + '…' : t || '(nothing)');
    }
    /** The voice-over list in Sound: one box per scene, in order. */
    function renderVO() {
      voList.innerHTML = '';
      S.scenes.forEach((sc, i) => {
        const li = el('li', 'reel-vo-item'); li.dataset.id = sc.id;
        const head = el('div', 'reel-vo-head');
        head.append(el('span', 'reel-badge', String(i + 1)), el('small', 'reel-vo-ref', refOf(sc)));
        const ta = el('textarea', 'control reel-vo-text'); ta.rows = 2; ta.value = voOf(sc); ta.dataset.id = sc.id;
        ta.placeholder = 'Silent — nothing is said in this scene';
        ta.setAttribute('aria-label', 'Voice-over for scene ' + (i + 1));
        const reset = button('Reset to suggested', 'btn-ghost reel-vo-reset', () => { delete sc.vo; syncVO(sc); voChanged(); });
        reset.disabled = sc.vo === undefined;
        ta.addEventListener('input', () => { sc.vo = ta.value; reset.disabled = false; syncVO(sc, ta); voChanged(); });
        ta.addEventListener('focus', () => { if (S.live !== i) selectScene(i); });
        li.append(head, ta, reset);
        voList.appendChild(li);
      });
    }
    /** Put a scene's voice-over into every box that shows it (the one being typed in stays as it is). */
    function syncVO(sc, except) {
      for (const ta of root.querySelectorAll('textarea[data-id="' + sc.id + '"]')) if (ta !== except) ta.value = voOf(sc);
      for (const li of voList.children) if (li.dataset.id === sc.id) {
        const r = li.querySelector('.reel-vo-reset'); if (r) r.disabled = sc.vo === undefined;
        const ref = li.querySelector('.reel-vo-ref'); if (ref) ref.textContent = refOf(sc);
      }
    }
    function voChanged() { updateSoundStatus(); if (!prompter.hidden) renderPrompter(); }
    function ttsBusy(on) {
      genBtn.disabled = on; previewBtn.disabled = on; ttsVoice.disabled = on;
      ttsCancel.hidden = !on;
      if (on) { ttsProgress.hidden = false; ttsBarAt(0); } else setTimeout(() => { if (!ttsJob) ttsProgress.hidden = true; }, 400);
    }
    function ttsBarAt(f) { const p = Math.round(clamp(f, 0, 1) * 100); ttsBar.style.width = p + '%'; ttsProgress.setAttribute('aria-valuenow', String(p)); }
    /** Progress from the worker: the first-use download, then the model starting, then the pieces spoken. */
    function ttsProgressFn(prefix, base, span) {
      return (p) => {
        if (p.stage === 'download') { ttsStatus.textContent = 'Downloading the voice model — ' + Math.round(p.loaded / 1e6) + ' of ' + Math.round(p.total / 1e6) + ' MB'; ttsBarAt(p.loaded / Math.max(1, p.total)); }
        else if (p.stage === 'compile') { ttsStatus.textContent = 'Starting the voice model…'; ttsBarAt(1); }
        else if (p.stage === 'speak') { ttsStatus.textContent = prefix; ttsBarAt(base + span * p.done / Math.max(1, p.of)); }
      };
    }
    function stopTtsPlay() { if (ttsPlay) { try { ttsPlay.close(); } catch (e) { /* closed */ } ttsPlay = null; } }
    async function previewVoice() {
      if (!TTS || ttsJob) return;
      const v = TTS.voices.find((x) => x.id === ttsVoice.value) || TTS.voices[0];
      const job = ttsJob = new AbortController();
      ttsBusy(true); stopTtsPlay();
      ttsStatus.className = 'aiimg-status';
      ttsStatus.textContent = TTS.ready ? 'Making the preview…' : 'Getting the voice model ready…';
      try {
        const r = await TTS.speak('Hi, I’m ' + v.name + '. This is how your reel will sound.', { voice: v.id, speed: Number(ttsSpeed.input.value), signal: job.signal, onProgress: ttsProgressFn('Making the preview…', 0, 1) });
        let peak = 0; for (let i = 0; i < r.samples.length; i++) { const a = Math.abs(r.samples[i]); if (a > peak) peak = a; }
        S.ttsPreview = { voice: v.id, duration: r.duration, peak };
        ttsStatus.textContent = 'Preview: ' + v.label + ' · ' + r.duration.toFixed(1) + ' s';
        try {
          const ac = ttsPlay = new (window.AudioContext || window.webkitAudioContext)();
          const b = ac.createBuffer(1, r.samples.length, r.sampleRate); b.copyToChannel(r.samples, 0);
          const src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination);
          src.onended = () => { if (ttsPlay === ac) stopTtsPlay(); };
          src.start();
        } catch (e) { /* no audio output: the preview was still made */ }
      } catch (e) {
        if (e && e.name === 'AbortError') ttsStatus.textContent = 'Cancelled.';
        else { ttsStatus.textContent = 'The preview could not be made.'; say((e && e.message) || String(e), 'error'); }
      } finally { if (ttsJob === job) ttsJob = null; ttsBusy(false); }
    }
    async function generateVoice() {
      if (!TTS || ttsJob) return;
      const list = spokenScenes();
      if (!list.length) { ttsStatus.textContent = 'The voice-over script is empty — write a line for at least one scene first.'; return; }
      if (mic) stopMic();
      stopTtsPlay();
      const v = TTS.voices.find((x) => x.id === ttsVoice.value) || TTS.voices[0];
      const speed = Number(ttsSpeed.input.value), pause = Number(ttsPause.input.value);
      const job = ttsJob = new AbortController();
      ttsBusy(true);
      ttsStatus.className = 'aiimg-status';
      ttsStatus.textContent = TTS.ready ? 'Starting…' : 'Getting the voice model ready…';
      const t0 = performance.now();
      try {
        const parts = [];
        let total = Math.max(0, Number(voiceOffset.input.value)), cut = false;
        for (let i = 0; i < list.length; i++) {
          const msg = 'Speaking scene ' + (i + 1) + ' of ' + list.length + '…';
          ttsStatus.textContent = TTS.ready ? msg : ttsStatus.textContent;
          const r = await TTS.speak(pronApply(list[i].text), { voice: v.id, speed, signal: job.signal, onProgress: ttsProgressFn(msg, i / list.length, 1 / list.length) });
          if (job.signal.aborted) throw abortError();
          parts.push({ sc: list[i].sc, text: list[i].text, r });
          total += r.duration + pause;
          if (total >= MAX_VOICE_SECONDS) { cut = list.length > i + 1 || total > MAX_VOICE_SECONDS; break; }
        }
        await useGenerated(parts, { v, speed, pause, cut, key: scriptKey(list), secs: (performance.now() - t0) / 1000 });
      } catch (e) {
        if (e && e.name === 'AbortError') ttsStatus.textContent = 'Cancelled — the voiceover was not changed.';
        else { ttsStatus.textContent = 'The voice could not be generated.'; say((e && e.message) || String(e), 'error'); }
      } finally { if (ttsJob === job) ttsJob = null; ttsBusy(false); }
    }
    /**
     * Lay the spoken scenes on the reel's timeline and make them the voiceover:
     * each spoken scene lasts its line plus the pause (1–15 s, the first one
     * also the "Starts at" lead), the others keep their length, and every line
     * starts as its scene does. The captions are the script's own words, timed
     * sentence by sentence from what the model produced — no transcription.
     */
    async function useGenerated(parts, o) {
      const offset = Math.max(0, Number(voiceOffset.input.value));
      if (Number(voiceOffset.input.value) < 0) voiceOffset.set(offset);
      for (const sc of S.scenes) if (sc.base === undefined) sc.base = sc.seconds;
      const first = S.scenes[0];
      const plan = {};
      for (const p of parts) plan[p.sc.id] = clamp(Math.ceil(((p.sc === first ? offset : 0) + p.r.duration + o.pause) * 10) / 10, 1, 15);
      /* where each line goes, in voice time (reel time minus the offset) */
      let at = 0, prevEnd = 0;
      const placed = [];
      for (const sc of S.scenes) {
        const p = parts.find((x) => x.sc === sc);
        if (p) {
          const pos = Math.max(prevEnd + (placed.length ? 0.05 : 0), at + (sc === first ? offset : 0) - offset);
          placed.push({ p, pos });
          prevEnd = pos + p.r.duration;
        }
        at += plan[sc.id] !== undefined ? plan[sc.id] : sc.base;
      }
      const sr = parts[0].r.sampleRate;
      let dur = Math.min(MAX_VOICE_SECONDS, prevEnd);
      const len = Math.max(1, Math.round(dur * sr));
      const buf = new Float32Array(len);
      for (const { p, pos } of placed) {
        const o0 = Math.round(pos * sr);
        if (o0 >= len) break;
        buf.set(p.r.samples.subarray(0, Math.min(p.r.samples.length, len - o0)), o0);
      }
      const audioBuffer = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: sr });
      audioBuffer.copyToChannel(buf, 0);
      const samples = await Wh.toMono16k(audioBuffer);
      const segments = [];
      for (const { p, pos } of placed) {
        /* the captions are the voice-over as written: the worker's sentences, unless a pronunciation swap changed them */
        const own = sentencesOf(p.text);
        p.r.sentences.forEach((s, k) => { s.caption = own.length === p.r.sentences.length ? own[k] : s.text; });
        for (const s of p.r.sentences) {
          const seg = { start: pos + s.start, end: Math.min(dur, pos + s.end), text: s.caption };
          if (seg.start >= dur || seg.end <= seg.start) continue;
          seg.words = Wh.wordsFor(seg);
          segments.push(seg);
        }
      }
      if (S.capJob) S.capJob.abort();
      const words = segments.reduce((n, s) => n + s.words.length, 0);
      const note = 'Generated: ' + o.v.label + ', ' + fmtSec(dur) + ' of speech for ' + placed.length + ' scene' + (placed.length === 1 ? '' : 's') +
        ' in ' + fmtSec(Math.max(1, o.secs)) + '. Scenes fitted to it; captions timed from the script.' + (o.cut ? ' Stopped at 90 s, the Reels limit.' : '');
      S.voice = { file: null, name: 'Generated voice · ' + o.v.name + ' (' + TTS.ACCENTS[o.v.accent] + ')', duration: dur, audioBuffer, samples, offset,
        gainDb: Number(voiceGain.input.value), peak: peakOf(audioBuffer), plan,
        generated: { voice: o.v.id, speed: o.speed, pause: o.pause, script: o.key, note, seconds: o.secs } };
      S.captions.segments = segments; S.captions.status = 'ready';
      capStatus.dataset.base = words + ' words, timed from the script';
      renderSegs(); againBtn.hidden = true;
      infoRow(voiceInfo, S.voice.name, S.voice.duration, removeVoice);
      voiceCtl.hidden = false;
      if (S.music && !S.music.touched) { S.music.gainDb = -16; musicGain.set(-16); }
      S.fitVoice = true; fitChk.input.checked = true;
      applyFit();
      if (!S.captions.chosen || S.captions.source === 'scene') setCapSource('auto', false);
      S.captions.cues = cuesFor(S);
      updateCapStatusTail();
      soundDirty();
      invalidate();
      ttsStatus.textContent = note;
      if (o.cut) say('The generated voice stops at 90 s, the Reels limit; shorten the script to hear it all.', 'warn');
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
      /* the voice-over script, scene by scene; a silent scene shows as a pause */
      S.scenes.forEach((sc) => { const li = el('li', null, voOf(sc).trim() || '(pause)'); li.dataset.id = sc.id; prompter.appendChild(li); });
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
    const capSource = select('reel-cap-source', [['auto', 'From the voiceover (on this device)'], ['scene', 'The scene text, timed to the scene'], ['none', 'No captions']], 'scene');
    const capHint = hint('A recorded or uploaded voice is transcribed by Whisper tiny — the first use downloads it (41 MB) from this site and it is kept for next time; English speech in this version. A generated voice needs no transcription: its captions are the script, timed as it was spoken.');
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
      list: PAL_IDS.map((id) => ({ id, label: PALETTES[id].label, swatch: PALETTES[id].light ? PALETTES[id].bg : PALETTES[id].accent, apply: () => applyLook(id) })),
      root: looksBox
    });
    const lookName = el('p', 'aiimg-status reel-look-name'); lookName.id = 'reel-look-name'; lookName.setAttribute('aria-live', 'polite');
    const typeSel = select('reel-type', TYPES.map((k) => [k, TYPE_LABELS[k]]), S.look.type);
    const motionSel = select('reel-motion', MOTIONS.map((k) => [k, MOTION_LABELS[k]]), S.look.motion);
    const bgSel = select('reel-bg', BGS.map((k) => [k, BG_LABELS[k]]), S.look.bgT);
    const layoutSel = select('reel-layout', LAYOUTS.map((k) => [k, LAYOUT_LABELS[k]]), S.look.layout);
    const shuffle2 = button('Shuffle look', 'btn-ghost', () => shuffleLook());
    const pinOne = (k, v) => { S.lookLock[k] = v; setLook(Object.assign({}, S.look.spec, { [k]: v }), { replace: true }); };
    typeSel.addEventListener('change', () => pinOne('type', typeSel.value));
    motionSel.addEventListener('change', () => pinOne('motion', motionSel.value));
    bgSel.addEventListener('change', () => pinOne('bg', bgSel.value));
    layoutSel.addEventListener('change', () => pinOne('layout', layoutSel.value));
    const handleIn = el('input', 'control'); handleIn.id = 'reel-handle'; handleIn.maxLength = 32; handleIn.placeholder = '@yourhandle';
    const urlIn = el('input', 'control'); urlIn.id = 'reel-url'; urlIn.placeholder = 'yoursite.com';
    const utmIn = el('input', 'control'); utmIn.id = 'reel-utm-source'; utmIn.value = 'instagram';
    const utmField = field('utm_source in the QR and the bio link', utmIn, 'instagram for Reels and square posts, youtube for Shorts and landscape.'); utmField.hidden = true;
    const endChk = on(check('reel-endcard', 'End card', true), () => {
      S.brand.endcard = endChk.input.checked;
      const has = S.scenes.findIndex((x) => x.type === 'endcard');
      if (S.brand.endcard && has < 0 && endCardHasContent()) S.scenes.push(endCardScene());
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
    const recolour = (k, v) => { S.lookOver[k] = v; S.look = lookFrom(S.look.spec, S.lookOver); scenesLook(); };
    const lookAccent = on(colour('reel-accent', S.look.accent), () => recolour('accent', lookAccent.value));
    const lookText = on(colour('reel-text', S.look.ink), () => recolour('text', lookText.value));
    const lookBg1 = on(colour('reel-bg1', S.look.bg[0]), () => recolour('bg0', lookBg1.value));
    const lookBg2 = on(colour('reel-bg2', S.look.bg[1]), () => recolour('bg1', lookBg2.value));
    panes.brand.append(h('Look'), lookName, looksBox, grid(field('Headline type', typeSel), field('Motion', motionSel)), grid(field('Background', bgSel), field('Layout', layoutSel)),
      row(shuffle2), hint('Each new reel gets a look of its own — not one of the last three for this tool. Pick a palette or a style to keep it; Shuffle look lets it vary again.'),
      grid(field('Handle', handleIn), field('URL', urlIn)), utmField,
      endChk, qrChk, qrHint, barChk, safeChk, h('Logo'), logoRow,
      h('Colours'), grid(field('Accent', lookAccent), field('Text', lookText)), grid(field('Background top', lookBg1), field('Background bottom', lookBg2)));
    handleIn.addEventListener('input', () => { S.brand.handle = handleIn.value.trim(); invalidate(); refreshCaptionPreview(); ensureEndCard(); });
    urlIn.addEventListener('input', () => { if (S.promote) return; S.brand.url = urlIn.value.trim(); syncQrUi(); invalidate(); refreshCaptionPreview(); ensureEndCard(); });
    utmIn.addEventListener('input', () => { S.brand.utm = utmIn.value.trim() || 'instagram'; invalidate(); });
    function endCardHasContent() { return !!(S.promote || S.brand.handle || S.brand.url || S.brand.logo); }
    function ensureEndCard() {
      if (!S.brand.endcard || !S.scenes.length || S.scenes.some((x) => x.type === 'endcard') || !endCardHasContent()) return;
      S.scenes.push(endCardScene());
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
    /** A palette chip (or ?preset=): pins the palette, keeps the rest of the look. */
    function applyLook(id) {
      id = PALETTES[id] ? id : (PAL_ALIAS[id] || 'midnight');
      S.lookLock.palette = id;
      setLook(Object.assign({}, S.look.spec, { palette: id }), { replace: true });
    }
    /** Use look spec v: colours reset to the palette's, captions restyled, the controls and the look name brought up to date. */
    function setLook(v, o) {
      o = o || {};
      S.lookOver = {};
      S.look = lookFrom(v);
      const L = S.look;
      lookAccent.value = L.accent; lookText.value = L.ink; lookBg1.value = L.bg[0]; lookBg2.value = L.bg[1];
      typeSel.value = L.type; motionSel.value = L.motion; bgSel.value = L.bgT; layoutSel.value = L.layout;
      Object.assign(S.captions.style, { preset: L.caption.preset, accent: L.caption.accent, fill: L.caption.fill, box: L.caption.box, uppercase: L.type === 'caps' });
      capAccent.value = st.accent; capFill.value = st.fill; capUpper.input.checked = st.uppercase;
      syncSwatches();
      if (o.record !== false && o.replace && S.scenes.length) recordLook(S.lookTool, L.spec, true);
      /* a new copy index rewrites the story's eyebrows and titles, never what the visitor typed */
      if (S.promote && S.scenes.story && o.recopy) {
        const fresh = buildScript(S.promote, S.brand, L);
        for (const sc of S.scenes) {
          const nw = fresh.find((x) => x.type === sc.type);
          if (!nw) continue;
          for (const k of ['eyebrow', 'heading', 'hl', 'foot']) if (sc[k] === sc['_auto_' + k]) { sc[k] = nw[k]; sc['_auto_' + k] = nw[k]; }
        }
      }
      scenesLook();
      if (presets.current() !== L.palette) { const c = looksBox.querySelector('.chip[data-preset="' + L.palette + '"]'); for (const b of looksBox.querySelectorAll('.chip[data-preset]')) { const onIt = b === c; b.classList.toggle('is-on', onIt); b.setAttribute('aria-pressed', onIt ? 'true' : 'false'); } }
      return L;
    }
    function scenesLook() {
      lookName.textContent = 'This reel: ' + S.look.name + (S.lookLock.palette || S.lookLock.type || S.lookLock.motion || S.lookLock.bg || S.lookLock.layout ? ' (pinned)' : '');
      S.scenes.forEach((x) => { x._plan = null; });
      prepareFonts(S).then(invalidate);
      prepareAssets(S).then(invalidate);
      refreshCaptionPreview();
      invalidate();
    }
    /** A new look: every pin let go, the next look in this tool's sequence that is not one of its recent ones. */
    function shuffleLook() {
      S.lookLock = {};
      S.shuffles = (S.shuffles || 0) + 1;
      const v = chooseLook(S.lookTool, { record: false, step: S.shuffles * 7, avoidCombos: [comboOf(S.look.spec)], exclude: [S.look.palette] });
      setLook(v, { replace: true, recopy: true });
    }
    /** The look for a new reel: chosen by the picker unless pinned values say otherwise. */
    function freshLook(tool) {
      S.lookTool = tool;
      S.shuffles = 0;
      const v = chooseLook(tool, { lock: S.lookLock });
      return setLook(v, { record: false });
    }

    /* ---------------- export pane ---------------- */
    const sizeSel = select('reel-size', [['1080x1920', '1080 × 1920 — Reels, Shorts, TikTok'], ['1080x1080', '1080 × 1080 — square post'], ['1920x1080', '1920 × 1080 — landscape']], '1080x1920');
    const qualSel = select('reel-quality', [['standard', 'Standard — 8 Mbps'], ['high', 'High — 12 Mbps'], ['small', 'Small — 5 Mbps']], 'standard');
    sizeSel.addEventListener('change', () => {
      S.sizeKey = sizeSel.value; const z = SIZES[S.sizeKey]; S.size = { w: z.w, h: z.h };
      if (!S.utmTouched) { S.brand.utm = z.utm; utmIn.value = z.utm; }
      qualSel.options[0].textContent = 'Standard — ' + z.rates.standard / 1e6 + ' Mbps'; qualSel.options[1].textContent = 'High — ' + z.rates.high / 1e6 + ' Mbps'; qualSel.options[2].textContent = 'Small — ' + z.rates.small / 1e6 + ' Mbps';
      S.scenes.forEach((x) => { x._plan = null; });
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
    const openChk = on(check('reel-open-cover', 'Open the video on the cover', S.openOnCover !== false), () => { S.openOnCover = openChk.input.checked; });
    const openHint = hint('Instagram, TikTok and Shorts show a video’s first frame as its preview unless you pick a cover by hand. With this on, the first frame is the cover above: it shows for 0.4 s and dissolves into the reel, which keeps its length and sound.');
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
    const aiHint = hint('This reel’s voice is synthetic, and the caption says so. Meta requires its AI label on Instagram and Facebook for “realistic-sounding audio that was digitally created or altered” — switch on “AI info” (or “Add AI label”) when you post. YouTube and TikTok have their own rules for realistic AI content; check them when you upload.');
    aiHint.id = 'reel-ai-hint'; aiHint.hidden = true;
    shareBox.append(field('Caption for Instagram, TikTok or Shorts', capPreview), row(capBtn, linkBtn), hint('Instagram does not link captions; put the link in your bio and say so.'), aiHint);
    const batchBox = el('div', 'reel-batch'); batchBox.hidden = true;
    const results = el('div', 'aiimg-results');
    /* the marks: an AI label (forced on while the voice is generated) and the removable credit */
    const aiChk = on(check('reel-ai-label', 'Label this reel as AI-generated', false), () => { S.brand.aiLabel = aiChk.input.checked; marksChanged(); });
    const aiLabelHint = hint('Adds an “AI-generated” label at the top of every frame and the cover, and a note inside the MP4 file that says so. Use it when pictures, clips, words or a voice in the reel were made by AI. While the voice is generated it is on and cannot be switched off: the label then reads “AI voice”, because some laws and most platforms expect synthetic voices to be marked.');
    aiLabelHint.id = 'reel-ai-label-hint';
    const madeChk = on(check('reel-made-with', 'Show “Made with 1234Tools.com”', true), () => { S.brand.madeWith = madeChk.input.checked; marksChanged(); });
    const madeHint = hint('A small line at the bottom of every frame and the cover. Switch it off and the reel carries no credit at all — no watermark is forced on you.');
    function marksChanged() { syncMarksUi(); for (const sc of S.scenes) sc._plan = null; invalidate(); drawCoverThumb(); }
    /** The AI switch shows what will be drawn: ticked and locked while the voice is generated. */
    function syncMarksUi() {
      const gen = !!(S.voice && S.voice.generated);
      aiChk.input.checked = gen || !!S.brand.aiLabel;
      aiChk.input.disabled = gen;
      madeChk.input.checked = S.brand.madeWith !== false;
    }
    panes.export.append(grid(field('Size', sizeSel), field('Quality', qualSel)), exHint, row(exportBtn, cancelBtn), exProgress, exStatus,
      h('Labels'), aiChk, aiLabelHint, madeChk, madeHint,
      h('Cover'), row(coverNow, coverThumb, coverFmt, coverBtn), openChk, openHint, h('Post it'), shareBox, batchBox, results);

    function bioLink() {
      if (S.promote) return qrUrlFor(S.promote.path, S.brand.utm || 'instagram');
      const u = String(S.brand.url || '').trim();
      return u ? (/^https?:\/\//i.test(u) ? u : 'https://' + u) : '';
    }
    function refreshCaptionPreview() {
      if (panes.export.hidden) return;
      capPreview.value = captionFor(S);
      linkBtn.disabled = !bioLink();
      aiHint.hidden = !(S.voice && S.voice.generated);
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
      const opening = await openingFor(X, w, hh);
      let r;
      if (hasVideo && webcodecs && A.__forceRecorder !== true) {
        r = await A.encodeVideoFrames(framesOf(X, w, hh, D, signal, opening), { width: w, height: hh, fps: FPS, total: Math.round(D * FPS), audio, bitrate, onProgress, signal, metadata: aiMetadata(X) });
      } else {
        const live = hasVideo && !webcodecs;
        const render = (ctx, Wd, Ht, t) => { if (live) liveMedia(X, t); renderFrame(ctx, Wd, Ht, t, X); if (opening) opening(ctx, Wd, Ht, t); };
        try { r = await A.encodeVideo(render, { width: w, height: hh, fps: FPS, duration: D, bitrate, audio, onProgress, signal, metadata: aiMetadata(X) }); }
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
        const label = (r.ext === 'mp4' ? (r.note || 'MP4').split(' — ')[0] : 'WebM recorded in real time') + ' · ' + D.toFixed(1) + ' s · ' + FPS + ' fps · ' + w + '×' + hh + (r.tagged ? ' · AI label in the file' : '');
        const rowEl = addResult(r.blob, name, label, 'video');
        A.download(r.blob, name);
        S.lastExport = { seconds: took, D, name, size: r.blob.size, tagged: !!r.tagged };
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
      const f = S.scenes.find((x) => isWordy(x));
      return (f && slugify(f.text.split(/\s+/).slice(0, 4).join(' '))) || 'reel';
    }

    /* ---------------- batch ---------------- */
    const folderOk = typeof window.showDirectoryPicker === 'function';
    /** One look per reel of a batch, all different: the first is the one on screen, the rest step past each other's palettes. */
    function planBatch(rows, o) {
      o = o || {};
      const out = [];
      const used = [], combos = [];
      rows.forEach((r, i) => {
        const path = rowObj(r).path;
        let v;
        if (i === 0 && S.promote && S.promote.path === path) v = S.look.spec;
        else v = chooseLook(path, { lock: S.lookLock, exclude: used.length < PAL_IDS.length ? used : [], avoidCombos: combos, record: o.record !== false });
        used.push(v.palette); combos.push(comboOf(v));
        out.push(v);
      });
      return out;
    }
    /**
     * Make one reel per ticked tool, in one click. The button changes in the
     * same tick as the click (disabled, "Making 2 reels…", a status line), the
     * first tool's studio opens, and the run starts at once in Export with a
     * progress bar and Cancel. (It used to read "Make 2 reels" with one tool
     * ticked, stay disabled until two were, wait for the story files with no
     * sign of life, then wait again for a second "Start" click in Export.)
     */
    async function openBatch() {
      if (S.job || S.batchBusy) return;
      const rows = [...S.picked.values()].slice(0, MAX_BATCH);
      if (!rows.length) return;
      S.batchBusy = true;
      batchBtn.disabled = true; batchBtn.textContent = 'Making ' + reelsWord(rows.length) + '…';
      batchLine.textContent = 'Starting: writing the script for ' + rows[0].title + '…';
      S.batchRows = rows;
      try {
        /* the folder is asked for first, while the click still counts as the visitor's */
        let dir = null;
        if (batchFolder.input.checked && folderOk) {
          try { dir = await window.showDirectoryPicker({ mode: 'readwrite' }); }
          catch (e) { if (e && e.name === 'AbortError') { batchLine.textContent = 'No folder chosen, so nothing was made.'; return; } say('The folder could not be opened; the files will be downloaded instead.', 'warn'); dir = null; }
        }
        await usePromote(rows[0]);
        batchBox.innerHTML = '';
        const list = el('ol', 'reel-batch-list');
        rows.forEach((r) => list.appendChild(el('li', null, r.title)));
        const bStatus = el('p', 'aiimg-status reel-batch-status'); bStatus.setAttribute('aria-live', 'polite');
        bStatus.textContent = 'Making ' + reelsWord(rows.length) + '. The look, brand, size and music you set apply to all; voice and pictures are not used in a batch.';
        const stopBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); else { batchBox.hidden = true; S.batchRows = null; } });
        stopBtn.id = 'reel-batch-cancel';
        batchBox.append(h('Making ' + reelsWord(rows.length)), list, row(stopBtn), bStatus);
        batchBox.hidden = false;
        showPane('export');
        batchBox.scrollIntoView && batchBox.scrollIntoView({ block: 'nearest' });
        batchLine.textContent = '';
        await runBatch(dir, batchCaps.input.checked, bStatus);
      } finally {
        S.batchBusy = false;
        syncBatchBtn();
      }
    }
    async function saveFile(blob, name, dir) {
      if (dir) { const fh = await dir.getFileHandle(name, { create: true }); const wr = await fh.createWritable(); await wr.write(blob); await wr.close(); }
      else A.download(blob, name);
    }
    async function runBatch(dir, withCaptions, bStatus) {
      const rows = S.batchRows;
      if (!rows || S.job) return;
      const job = S.job = new AbortController();
      busyUI(true, 'Making ' + reelsWord(rows.length));
      const n = rows.length;
      const texts = [];
      let done = 0;
      const started = performance.now();
      const looks = planBatch(rows);
      S.lastBatchLooks = looks.map(comboOf);
      try {
        for (let i = 0; i < n; i++) {
          if (job.signal.aborted) throw abortError();
          const r = rows[i];
          const f = factsOf(r);
          const brand = Object.assign({}, S.brand, brandFor(r));
          const look = i === 0 ? S.look : lookFrom(looks[i]);
          const X = Object.assign({}, S, { promote: r, brand, voice: null, look, scenes: buildScript(r, brand, look), mixP: null,
            captions: Object.assign({}, S.captions, { source: 'scene', cues: [], segments: [] }, { style: Object.assign({}, S.captions.style, look.caption) }) });
          const label = 'Reel ' + (i + 1) + ' of ' + n + ' — ' + r.title;
          bStatus.textContent = label + ' — preparing…' + (i === 1 && !dir ? ' Your browser may ask once to allow several downloads.' : '');
          const { r: out } = await encodeState(X, job.signal, (p) => {
            const fr = typeof p === 'number' ? p : (p && p.fraction) || 0;
            progressTo((i + fr) / n);
            bStatus.textContent = label + ' — encoding ' + Math.round(fr * 100) + '%';
          });
          const name = 'reel-' + f.slug + '.' + out.ext;
          await saveFile(out.blob, name, dir);
          addResult(out.blob, name, (out.note || '').split(' — ')[0] + ' · ' + totalSeconds(X).toFixed(1) + ' s · ' + r.title + (out.tagged ? ' · AI label in the file' : ''), 'video');
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
        bStatus.textContent = reelsWord(done) + ', ' + done + ' cover' + (done === 1 ? '' : 's') + tail + ' ' + (dir ? 'saved to ' + dir.name : 'downloaded') + ' in ' + fmtSec((performance.now() - started) / 1000) + '.';
      } catch (e) {
        if (e && e.name === 'AbortError') bStatus.textContent = 'Cancelled after ' + done + ' reel' + (done === 1 ? '' : 's') + '; the finished files stay.';
        else { bStatus.textContent = 'The batch stopped at reel ' + (done + 1) + ' of ' + n + '.'; say((e && e.message) || String(e), 'error'); console.error(e); }
      } finally {
        if (job === S.job) S.job = null;
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
      const n = Math.min(S.picked.size, MAX_BATCH);
      if (S.batchBusy) return;
      /* the number on the button is exactly how many reels a click makes */
      batchBtn.textContent = n ? 'Make ' + reelsWord(n) : 'Make reels';
      batchBtn.disabled = n === 0 || !!S.job;
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
      const scenes = scenesFromScript(text);
      S.scenes = scenes;
      freshLook('script:' + (tplSel.value || 'own'));
      if (S.brand.endcard && endCardHasContent()) S.scenes.push(endCardScene());
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
      /* the story and the captured example are fetched only now, in promote mode */
      note('Writing the script…');
      await Promise.all([loadStories(), loadExamples(), loadFonts()]);
      note('');
      if (S.promote !== r) return;
      const L = freshLook(r.path);
      S.scenes = buildScript(r, S.brand, L);
      S.reels = (S.reels || 0) + 1;
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
    const preParam = params.get('preset');
    if (preParam && PAL_ALIAS[preParam]) presets.apply(PAL_ALIAS[preParam]);
    else presets.applyFromUrl();
    scenesLook();
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
      state: S, invalidate, renderFrame: (ctx, W, H, t) => renderFrame(ctx, W, H, t, S), usePromote, openBatch, planBatch, shuffleLook,
      /** Pin a look (any of palette, type, motion, bg, layout, copy), as the selects do. */
      setLook: (v) => { for (const k of ['palette', 'type', 'motion', 'bg', 'layout']) if (v[k]) S.lookLock[k] = v[k]; return setLook(Object.assign({}, S.look.spec, v), { replace: true, recopy: v.copy !== undefined }); },
      prepare: async () => { await prepareFonts(S); await prepareAssets(S); },
      destroy: () => { mounted = false; if (CUR === S) CUR = null; }
    };
    A.tools['reel-maker'].current = API;
    return API;
  }

  A.tools['reel-maker'] = {
    mount, buildScript, captionFor, mixAudio, sceneAt, scenesFromScript, tagsFor, qrUrlFor, encodeWAV, factsOf,
    /** The voice-over: what a scene says (voOf), the suggestion (suggestedVO), and the screen-to-speech rules (toSpeech). */
    voOf, suggestedVO, toSpeech,
    /** The two marks: what they say, their colours, the metadata, and where they land on a W×H frame (rects drawn on a scratch canvas). */
    aiLabelOf, madeWithOn, markColours, aiMetadata,
    marks: (W, H, S) => {
      S = S || CUR;
      const x = document.createElement('canvas').getContext('2d');
      const c = chromeOf(W, H, S), box = contentBox(W, H, S);
      return { ai: drawAiLabel(x, W, H, S.look, S), credit: drawMadeWith(x, W, H, S.look, S), head: c.hasHead ? { y: c.headY, h: c.headH } : null,
        box: { y: box.y, h: box.h }, bar: S.brand.progress ? { y: c.barY, h: c.barH } : null, foot: c.showFoot ? c.footY : null, top: c.sf.top * H, bottom: (1 - c.sf.bottom) * H };
    },
    templates: TEMPLATES.map((t) => ({ id: t[0], label: t[1], about: t[2], script: t[3], types: TEMPLATE_TYPES[t[0]] })),
    palettes: PALETTES, types: TYPES, motions: MOTIONS, backgrounds: BGS, layouts: LAYOUTS, paletteAudit, chooseLook, pickLook, lookFrom, keyWordOf, contrast,
    overflow: () => OVER.slice(), clearOverflow: () => { OVER.length = 0; overSeen.clear(); MIN_PX = Infinity; }, minPx: () => MIN_PX,
    loadStories, loadExamples, storyFor, exampleFor,
    /** The background alone, as renderFrame draws it under the scene (the test diffs the safe bands against it). */
    background: (ctx, W, H, t, S) => { S = S || CUR; ctx.save(); drawBackground(ctx, W, H, t, S.look, (sceneAt(t, S) || {}).scene, S); ctx.restore(); },
    renderFrame: (ctx, W, H, t, S, o) => renderFrame(ctx, W, H, t, S || CUR, o),
    state: () => CUR
  };
})();
