'use strict';
/**
 * Hashtag table (copy spec Part B section 3), ranked broad -> niche per section.
 *
 * One deliberate change from the spec: #ChatGPTAlternative is left out of the
 * ai row, because a competitor's name in a post breaks the "no competitor
 * names" red line in section 6 of the same spec.
 */

const TABLE = {
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
  conversions: ['#UnitConverter', '#Converter', '#Metric', '#Imperial', '#Cooking', '#Travel', '#Students', '#Engineering', '#Measurement', '#Conversion'],
};

/* Brand tags. The ones that make a claim are limited to the browser tools:
   an AI-for-Business tool needs an account and sends text to a server. */
const BRAND = [
  { tag: '#1234Tools' },
  { tag: '#FreeTools', freeOnly: true },
  { tag: '#NoSignup', freeOnly: true },
  { tag: '#PrivacyFirst', freeOnly: true },
  { tag: '#WorksOffline', freeOnly: true },
  { tag: '#BuildInPublic', makerOnly: true },
];

/* Tags that only fit a media section. */
const MEDIA_ONLY = ['#NoWatermark'];
/* Tags that claim on-device / offline; never on an AI-for-Business tool. */
const DEVICE_CLAIMS = ['#OnDeviceAI', '#OfflineAI', '#WorksOffline', '#PrivacyFirst', '#NoSignup', '#FreeTools'];

function words(tag) {
  return tag.replace(/^#/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').toLowerCase();
}

/**
 * Pick hashtags for a record.
 *   n       how many section tags (before brand tags)
 *   tier    'niche' (Pinterest, Instagram, dev.to) or 'broad' (LinkedIn)
 *   brand   how many brand tags to append (0-2)
 *   maker   allow #BuildInPublic
 *   lower   lowercase everything (TikTok, dev.to)
 */
function tagsFor(rec, opts) {
  opts = opts || {};
  const n = opts.n == null ? 3 : opts.n;
  const tier = opts.tier || 'niche';
  const row = (TABLE[rec.section] || TABLE.utilities).filter((t) => {
    if (MEDIA_ONLY.includes(t) && !rec.media) return false;
    if (rec.pricing === 'freemium' && DEVICE_CLAIMS.includes(t)) return false;
    return true;
  });
  const hay = (rec.title + ' ' + rec.keywords.join(' ') + ' ' + rec.io + ' ' + rec.description).toLowerCase();
  const scored = row.map((t, i) => {
    const w = words(t);
    let s = 0;
    if (hay.includes(w)) s += 10;
    else if (w.split(' ').some((x) => x.length > 3 && hay.includes(x))) s += 4;
    s += tier === 'niche' ? i * 0.1 : -i * 0.1;
    return { t, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const out = scored.slice(0, n).map((x) => x.t);
  const brandN = opts.brand == null ? 0 : opts.brand;
  if (brandN > 0) {
    const brand = BRAND.filter((b) => {
      if (b.freeOnly && rec.pricing === 'freemium') return false;
      if (b.makerOnly && !opts.maker) return false;
      if (out.includes(b.tag)) return false;
      return true;
    }).map((b) => b.tag);
    // maker posts lead with #BuildInPublic, otherwise #1234Tools first
    if (opts.maker && brand.includes('#BuildInPublic')) brand.unshift(brand.splice(brand.indexOf('#BuildInPublic'), 1)[0]);
    out.push(...brand.slice(0, Math.min(2, brandN)));
  }
  return opts.lower ? out.map((t) => t.toLowerCase()) : out;
}

/** dev.to tags: lowercase, alphanumeric, at most 4. */
function devtoTags(rec) {
  const base = ['webdev', 'javascript'];
  const extra = tagsFor(rec, { n: 6, tier: 'niche' }).map((t) => t.replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  const out = [];
  for (const t of base.concat(extra)) if (t && !out.includes(t) && t.length <= 20) out.push(t);
  return out.slice(0, 4);
}

module.exports = { TABLE, BRAND, tagsFor, devtoTags };
