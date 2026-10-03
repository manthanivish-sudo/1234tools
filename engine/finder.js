/**
 * Tool Finder — describe the job, get the tool.
 *
 * A conversation in shape, a ranked search underneath. The register
 * (assets/search-index.js) and the finder index (assets/finder-index.js:
 * every tool's description and keywords) are searched by the browser with
 * a weighted TF-IDF over title, slug, keywords, description and section, a
 * hand-written vocabulary of synonyms, a table of unit names and short forms
 * for the 1,048 conversions, and one-edit typo forgiveness. Nothing typed
 * here leaves the page; the request form, which the reader opens on
 * purpose, is the only thing that posts anywhere.
 */
(function () {
  'use strict';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const base = (window.__BASE__ || '/');

  /* ------------------------------------------------------------------ */
  /* language                                                           */
  /* ------------------------------------------------------------------ */
  const STOP = new Set(('a an the for of on at by with from and or my me i we you your it its is are be am was can could do does how what which want need would like please help find looking look tool tools online free make create get some any this that there here one thing something way best good quick easy simple use using').split(' '));
  /* words that mean the same job; each group becomes one extra token */
  const GROUPS = [
    ['image', 'photo', 'picture', 'pic', 'img', 'photograph', 'jpeg', 'jpg', 'png', 'webp', 'selfie', 'snapshot'],
    ['compress', 'shrink', 'reduce', 'smaller', 'lighter', 'optimise', 'optimize', 'compression', 'kb', 'mb'],
    ['merge', 'combine', 'join', 'stitch', 'together', 'concatenate', 'append'],
    ['split', 'separate', 'divide', 'extract', 'pages'],
    ['crop', 'trim', 'cut'],
    ['rotate', 'turn', 'flip', 'mirror', 'orientation', 'upside'],
    ['background', 'bg', 'backdrop', 'behind'],
    ['transparent', 'cutout', 'cut-out', 'isolate', 'remove'],
    ['resize', 'scale', 'dimensions', 'enlarge', 'bigger', 'resolution', 'pixels'],
    ['convert', 'change', 'into', 'export', 'turn', 'transform', 'converter', 'conversion'],
    ['pdf', 'acrobat', 'document', 'doc'],
    ['word', 'docx', 'microsoft'],
    ['excel', 'xlsx', 'xls', 'spreadsheet', 'sheet', 'sheets', 'csv', 'table', 'rows', 'columns'],
    ['json', 'xml', 'yaml', 'api', 'data'],
    ['salary', 'payslip', 'payroll', 'wages', 'pay', 'take-home', 'in-hand', 'ctc', 'net', 'gross', 'employee', 'staff'],
    ['tax', 'income', 'itr', 'tds', 'hmrc', 'paye', 'deduction'],
    ['gst', 'vat', 'sales', 'cgst', 'sgst', 'igst', 'hsn'],
    ['invoice', 'bill', 'billing', 'receipt', 'quotation', 'quote', 'estimate'],
    ['loan', 'emi', 'mortgage', 'instalment', 'installment', 'repayment', 'borrow', 'amortisation', 'amortization'],
    ['interest', 'compound', 'fd', 'rd', 'deposit', 'sip', 'lumpsum', 'investment', 'returns', 'savings', 'maturity'],
    ['bmi', 'weight', 'height', 'obese', 'overweight', 'body'],
    ['calories', 'calorie', 'diet', 'tdee', 'bmr', 'metabolism'],
    ['age', 'birthday', 'born', 'dob', 'old'],
    ['date', 'days', 'between', 'countdown', 'until', 'calendar', 'deadline', 'weekday', 'working'],
    ['time', 'timezone', 'zone', 'utc', 'clock', 'hours', 'minutes'],
    ['percent', 'percentage', 'discount', 'off', 'markup', 'margin', 'ratio', 'share'],
    ['password', 'random', 'generate', 'generator', 'secure', 'strong'],
    ['colour', 'color', 'hex', 'rgb', 'hsl', 'palette', 'swatch', 'gradient'],
    ['code', 'html', 'css', 'javascript', 'js', 'minify', 'beautify', 'format', 'formatter', 'pretty', 'validate', 'validator', 'developer', 'dev'],
    ['encode', 'decode', 'base64', 'url', 'escape', 'entity', 'jwt', 'hash', 'md5', 'sha'],
    ['timetable', 'schedule', 'rota', 'roster', 'periods', 'lessons', 'classes'],
    ['marks', 'grade', 'grades', 'gpa', 'cgpa', 'percentile', 'score', 'result', 'results', 'exam', 'exams', 'test'],
    ['attendance', 'present', 'absent', 'register'],
    ['count', 'counter', 'words', 'characters', 'letters', 'length', 'reading'],
    ['text', 'string', 'paragraph', 'sentence', 'case', 'uppercase', 'lowercase', 'lines', 'duplicate'],
    ['meme', 'caption', 'funny', 'joke'],
    ['sticker', 'emoji', 'whatsapp', 'telegram'],
    ['thumbnail', 'youtube', 'cover', 'banner'],
    ['instagram', 'story', 'stories', 'reel', 'reels', 'tiktok', 'facebook', 'linkedin', 'twitter', 'social', 'post', 'carousel'],
    ['gif', 'animation', 'animated', 'video', 'mp4', 'clip', 'motion', 'moving'],
    ['passport', 'visa', 'id', 'identity', 'headshot', 'photograph'],
    ['qr', 'qrcode', 'barcode', 'scan', 'scanner', 'wifi', 'vcard', 'upi'],
    ['exif', 'metadata', 'gps', 'location', 'camera', 'privacy'],
    ['blur', 'pixelate', 'redact', 'hide', 'anonymise', 'anonymize', 'censor', 'face', 'faces'],
    ['border', 'frame', 'polaroid', 'padding'],
    ['svg', 'vector', 'icon', 'logo'],
    ['translate', 'translation', 'language', 'hindi', 'english', 'french', 'spanish'],
    ['write', 'writer', 'draft', 'compose', 'rewrite', 'summarise', 'summarize', 'summary', 'proofread', 'grammar', 'copy', 'content', 'blog', 'article', 'email', 'letter', 'newsletter', 'script'],
    ['contract', 'agreement', 'legal', 'notice', 'tenancy', 'lease', 'nda', 'terms'],
    ['cv', 'resume', 'job', 'hiring', 'candidate', 'interview', 'recruit'],
    ['ad', 'ads', 'advert', 'marketing', 'seo', 'keywords', 'landing', 'campaign', 'listing', 'product'],
    ['bank', 'statement', 'transactions', 'reconcile', 'reconciliation', 'ledger', 'bookkeeping', 'accounts', 'accounting', 'tally', 'journal', 'trial'],
    ['epf', 'pf', 'provident', 'esi', 'gratuity', 'hra', 'nps', 'ppf', 'pension', 'retirement'],
    ['depreciation', 'asset', 'wdv', 'straight'],
    ['break-even', 'breakeven', 'profit', 'loss', 'revenue', 'cost', 'costs', 'pricing', 'price'],
    ['cagr', 'growth', 'npv', 'irr', 'roi', 'valuation'],
    ['ageing', 'aging', 'overdue', 'receivables', 'debtors', 'unpaid', 'chase'],
    ['mtd', 'digital', 'quarterly', 'return', 'filing'],
    ['currency', 'exchange', 'forex', 'rupee', 'dollar', 'pound', 'euro', 'inr', 'usd', 'gbp'],
    ['fuel', 'petrol', 'diesel', 'mileage', 'trip', 'journey', 'distance', 'drive', 'car'],
    ['cooking', 'recipe', 'kitchen', 'baking', 'cups', 'tablespoons', 'oven'],
    ['dice', 'coin', 'toss', 'lottery', 'pick', 'shuffle'],
    ['binary', 'hex', 'hexadecimal', 'octal', 'decimal', 'base'],
    ['prime', 'factor', 'factors', 'factorise', 'factorize', 'lcm', 'gcd', 'hcf', 'multiple', 'divisor'],
    ['fraction', 'fractions', 'numerator', 'denominator', 'simplify'],
    ['geometry', 'area', 'volume', 'perimeter', 'triangle', 'circle', 'rectangle', 'shape', 'cylinder', 'sphere'],
    ['statistics', 'mean', 'median', 'mode', 'average', 'deviation', 'variance', 'standard'],
    ['quadratic', 'equation', 'solve', 'roots', 'algebra'],
    ['ohm', 'resistor', 'voltage', 'current', 'amps', 'volts', 'watts', 'circuit', 'electronics'],
    ['pregnancy', 'pregnant', 'due', 'baby', 'ovulation', 'fertile', 'period', 'cycle', 'conceive'],
    ['heart', 'pulse', 'zones', 'training', 'fitness', 'exercise', 'run', 'running'],
    ['aspect', 'ratio', '16:9', '4:3', 'widescreen'],
    ['splitter', 'grid', 'tiles', 'mosaic', 'sprite'],
    ['filter', 'filters', 'brightness', 'contrast', 'saturation', 'sepia', 'grayscale', 'greyscale', 'vintage', 'adjust', 'edit', 'editor', 'enhance'],
    ['india', 'indian'], ['uk', 'british', 'england'],
    ['school', 'teacher', 'teachers', 'student', 'students', 'pupil', 'class', 'lesson', 'parent', 'homework', 'question', 'paper', 'rubric'],
    ['doctor', 'clinic', 'patient', 'medical', 'hospital', 'health'],
    ['property', 'landlord', 'tenant', 'rent', 'rental', 'house', 'flat', 'estate'],
    ['shop', 'store', 'retail', 'seller', 'ecommerce', 'amazon', 'flipkart', 'listing'],
    ['ocr', 'scanned', 'scan', 'photo', 'read', 'reader', 'extract', 'extractor']
  ];
  const groupOf = {};
  GROUPS.forEach((g, i) => g.forEach((w) => { (groupOf[w] = groupOf[w] || []).push(i); }));

  function stem(w) {
    if (w.length <= 3) return w;
    if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
    if (/sses$/.test(w)) return w.slice(0, -2);
    if (/ing$/.test(w) && w.length > 5) return w.slice(0, -3);
    if (/ed$/.test(w) && w.length > 4) return w.slice(0, -2);
    if (/s$/.test(w) && !/ss$|us$|is$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function words(s) {
    return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9°%./:+\- ]+/g, ' ').split(/\s+/).filter(Boolean);
  }
  /** Tokens for a field: stems, plus one token per synonym group a word belongs to. */
  function tokens(s, keepStops) {
    const out = [];
    for (const raw of words(s)) {
      const parts = raw.split(/[-/.:]/).filter(Boolean);
      for (const p of parts.length ? parts : [raw]) {
        if (!keepStops && STOP.has(p)) continue;
        const st = stem(p);
        out.push(st);
        const gs = groupOf[p] || groupOf[st];
        if (gs) for (const g of gs) out.push('~' + g);
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* units                                                              */
  /* ------------------------------------------------------------------ */
  /* alias -> candidate slugs, as the conversion pages spell them */
  const UNITS = {
    km: ['kilometer'], kms: ['kilometer'], kilometre: ['kilometer'], kilometres: ['kilometer'], kilometer: ['kilometer'], kilometers: ['kilometer'],
    mi: ['mile'], mile: ['mile'], miles: ['mile'], m: ['meter', 'minute'], metre: ['meter'], metres: ['meter'], meter: ['meter'], meters: ['meter'],
    cm: ['centimeter'], centimetre: ['centimeter'], centimetres: ['centimeter'], centimeter: ['centimeter'], centimeters: ['centimeter'],
    mm: ['millimeter'], millimetre: ['millimeter'], millimetres: ['millimeter'], millimeter: ['millimeter'], millimeters: ['millimeter'],
    in: ['inch'], inch: ['inch'], inches: ['inch'], '"': ['inch'], ft: ['foot'], foot: ['foot'], feet: ['foot'], "'": ['foot'], yd: ['yard'], yard: ['yard'], yards: ['yard'],
    nmi: ['nautical-mile'], nautical: ['nautical-mile'], ly: ['light-year'], lightyear: ['light-year'], lightyears: ['light-year'], au: ['astronomical-unit'], parsec: ['parsec'], parsecs: ['parsec'],
    kg: ['kilogram'], kgs: ['kilogram'], kilo: ['kilogram'], kilos: ['kilogram'], kilogram: ['kilogram'], kilograms: ['kilogram'], g: ['gram'], gram: ['gram'], grams: ['gram'], gm: ['gram'], mg: ['milligram'], milligram: ['milligram'], milligrams: ['milligram'],
    lb: ['pound'], lbs: ['pound'], pound: ['pound'], pounds: ['pound'], oz: ['ounce', 'fluid-ounce-us'], ounce: ['ounce'], ounces: ['ounce'], st: ['stone'], stone: ['stone'], stones: ['stone'],
    t: ['tonne'], tonne: ['tonne'], tonnes: ['tonne'], ton: ['tonne', 'ton-us-short', 'ton-uk-long'], tons: ['tonne', 'ton-us-short', 'ton-uk-long'],
    c: ['celsius'], '°c': ['celsius'], celsius: ['celsius'], centigrade: ['celsius'], f: ['fahrenheit'], '°f': ['fahrenheit'], fahrenheit: ['fahrenheit'], k: ['kelvin'], kelvin: ['kelvin'], rankine: ['rankine'],
    ml: ['milliliter'], millilitre: ['milliliter'], millilitres: ['milliliter'], milliliter: ['milliliter'], milliliters: ['milliliter'], l: ['liter'], litre: ['liter'], litres: ['liter'], liter: ['liter'], liters: ['liter'], ltr: ['liter'],
    gal: ['gallon-us'], gallon: ['gallon-us', 'gallon-imperial'], gallons: ['gallon-us', 'gallon-imperial'], cup: ['cup-us'], cups: ['cup-us'], tbsp: ['tablespoon-us'], tablespoon: ['tablespoon-us'], tablespoons: ['tablespoon-us'],
    tsp: ['teaspoon-us'], teaspoon: ['teaspoon-us'], teaspoons: ['teaspoon-us'], floz: ['fluid-ounce-us'], pint: ['pint-us'], pints: ['pint-us'], quart: ['quart-us'], quarts: ['quart-us'],
    m3: ['cubic-meter'], 'm³': ['cubic-meter'], ft3: ['cubic-foot'], 'ft³': ['cubic-foot'],
    sqm: ['square-meter'], m2: ['square-meter'], 'm²': ['square-meter'], sqft: ['square-foot'], ft2: ['square-foot'], 'ft²': ['square-foot'], acre: ['acre'], acres: ['acre'], hectare: ['hectare'], hectares: ['hectare'], ha: ['hectare'],
    km2: ['square-kilometer'], 'km²': ['square-kilometer'], sqkm: ['square-kilometer'], sqmi: ['square-mile'], sqin: ['square-inch'], in2: ['square-inch'], sqyd: ['square-yard'], cm2: ['square-centimeter'], mm2: ['square-millimeter'],
    ms: ['millisecond'], millisecond: ['millisecond'], milliseconds: ['millisecond'], s: ['second'], sec: ['second'], secs: ['second'], second: ['second'], seconds: ['second'], min: ['minute'], mins: ['minute'], minute: ['minute'], minutes: ['minute'],
    h: ['hour'], hr: ['hour'], hrs: ['hour'], hour: ['hour'], hours: ['hour'], day: ['day'], days: ['day'], wk: ['week'], week: ['week'], weeks: ['week'], month: ['month-avg'], months: ['month-avg'], yr: ['year-julian'], year: ['year-julian'], years: ['year-julian'],
    mph: ['miles-per-hour'], kph: ['kilometers-per-hour'], kmh: ['kilometers-per-hour'], 'km/h': ['kilometers-per-hour'], kmph: ['kilometers-per-hour'], 'm/s': ['meters-per-second'], mps: ['meters-per-second'], knot: ['knot'], knots: ['knot'], kn: ['knot'], kt: ['knot'], kts: ['knot'], fps: ['feet-per-second'], 'ft/s': ['feet-per-second'], mach: ['mach-sea-level'],
    pa: ['pascal'], pascal: ['pascal'], pascals: ['pascal'], kpa: ['kilopascal'], mpa: ['megapascal'], bar: ['bar'], bars: ['bar'], mbar: ['millibar'], millibar: ['millibar'], millibars: ['millibar'], psi: ['psi'], atm: ['atmosphere'], atmosphere: ['atmosphere'], atmospheres: ['atmosphere'], torr: ['torr-mmhg'], mmhg: ['torr-mmhg'], inhg: ['inches-of-mercury'],
    j: ['joule'], joule: ['joule'], joules: ['joule'], kj: ['kilojoule'], kilojoule: ['kilojoule'], kilojoules: ['kilojoule'], cal: ['calorie-thermo'], calorie: ['calorie-thermo', 'kilocalorie'], calories: ['kilocalorie', 'calorie-thermo'], kcal: ['kilocalorie'], kilocalorie: ['kilocalorie'], kilocalories: ['kilocalorie'],
    wh: ['watt-hour'], kwh: ['kilowatt-hour'], btu: ['british-thermal-unit'], ev: ['electronvolt'], ftlb: ['foot-pound'],
    w: ['watt'], watt: ['watt'], watts: ['watt'], kw: ['kilowatt'], kilowatt: ['kilowatt'], kilowatts: ['kilowatt'], mw: ['megawatt', 'milliwatt'], megawatt: ['megawatt'], megawatts: ['megawatt'], hp: ['horsepower-mech', 'horsepower-metric'], horsepower: ['horsepower-mech', 'horsepower-metric'], bhp: ['horsepower-mech'],
    bit: ['bit'], bits: ['bit'], byte: ['byte'], bytes: ['byte'], b: ['byte'], kb: ['kilobyte-1000'], kilobyte: ['kilobyte-1000'], kilobytes: ['kilobyte-1000'], mb: ['megabyte-1000'], megabyte: ['megabyte-1000'], megabytes: ['megabyte-1000'],
    gb: ['gigabyte-1000'], gigabyte: ['gigabyte-1000'], gigabytes: ['gigabyte-1000'], tb: ['terabyte-1000'], terabyte: ['terabyte-1000'], terabytes: ['terabyte-1000'], kib: ['kibibyte-1024'], mib: ['mebibyte-1024'], gib: ['gibibyte-1024'], tib: ['tebibyte-1024'],
    rad: ['radian'], radian: ['radian'], radians: ['radian'], deg: ['degree'], degree: ['degree'], degrees: ['degree'], '°': ['degree'], grad: ['gradian'], gradian: ['gradian'], gradians: ['gradian'], turn: ['turn'], turns: ['turn'], rev: ['turn'], revolution: ['turn'], arcmin: ['arcminute'], arcsec: ['arcsecond']
  };
  const FAMILY_WORDS = { length: 'length', distance: 'length', mass: 'mass', weight: 'mass', temperature: 'temperature', temp: 'temperature', volume: 'volume', capacity: 'volume', area: 'area', time: 'time', duration: 'time', speed: 'speed', velocity: 'speed', pressure: 'pressure', energy: 'energy', power: 'power', data: 'data', storage: 'data', angle: 'angle' };

  /* ------------------------------------------------------------------ */
  /* the index                                                          */
  /* ------------------------------------------------------------------ */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('could not load ' + src)); document.head.appendChild(s); });
  }
  async function loadIndexes() {
    const jobs = [];
    if (!window.SEARCH_INDEX) jobs.push(loadScript(base + 'assets/search-index.js'));
    if (!window.FINDER_INDEX) jobs.push(loadScript(base + 'assets/finder-index.js'));
    await Promise.all(jobs);
    if (!window.SEARCH_INDEX || !window.FINDER_INDEX) throw new Error('The tool list could not be loaded.');
  }

  let DOCS = null, DF = null, N = 0, VOCAB = null, CONV = null, FAMILY_HUBS = null;
  function build() {
    const fi = window.FINDER_INDEX.tools;
    DOCS = fi.map((r) => {
      const [title, p, glyph, section, desc, kw] = r;
      const slug = p.replace(/\/+$/, '').split('/').pop().replace(/-/g, ' ');
      const fields = { title: tokens(title), slug: tokens(slug), kw: tokens(kw.replace(/\|/g, ' ')), desc: tokens(desc), section: tokens(section) };
      const tf = {};
      const add = (list, w) => { for (const t of list) tf[t] = Math.max(tf[t] || 0, w) + (tf[t] ? 0.15 : 0); };
      add(fields.desc, 1.2); add(fields.section, 1); add(fields.kw, 2.5); add(fields.slug, 3); add(fields.title, 4);
      return { title, path: p, glyph, section, desc, tf, titleText: title.toLowerCase(), slugText: slug, kwText: kw.toLowerCase() };
    });
    N = DOCS.length;
    DF = {}; VOCAB = new Set();
    for (const d of DOCS) for (const t in d.tf) { DF[t] = (DF[t] || 0) + 1; if (t[0] !== '~') VOCAB.add(t); }
    CONV = {}; FAMILY_HUBS = {};
    for (const [title, p] of window.SEARCH_INDEX) {
      const m = /^conversions\/([^/]+)\/([a-z0-9-]+)-to-([a-z0-9-]+)\/$/.exec(p);
      if (!m) continue;
      CONV[m[2] + '>' + m[3]] = { title, path: p, family: m[1] };
      FAMILY_HUBS[m[1]] = 'conversions/' + m[1] + '/';
    }
  }
  const idf = (t) => Math.log(1 + N / (1 + (DF[t] || 0)));

  /* one-edit forgiveness: "payslp" -> "payslip" */
  function nearest(word) {
    if (word.length < 4) return null;
    let best = null, bestD = word.length >= 7 ? 2 : 1;
    for (const v of VOCAB) {
      if (Math.abs(v.length - word.length) > bestD || v[0] !== word[0]) continue;
      const d = edit(word, v, bestD);
      if (d !== null && d <= bestD && (best === null || d < bestD)) { best = v; bestD = d; if (d === 0) break; }
    }
    return best;
  }
  function edit(a, b, max) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return null;
    let prev = new Array(lb + 1), cur = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      cur[0] = i; let rowMin = cur[0];
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev[j - 1]);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return null;
      const t = prev; prev = cur; cur = t;
    }
    return prev[lb];
  }

  /* ------------------------------------------------------------------ */
  /* understanding a message                                            */
  /* ------------------------------------------------------------------ */
  function unitCandidates(str) {
    const s = str.trim().toLowerCase().replace(/\s+/g, ' ');
    const direct = UNITS[s] || UNITS[s.replace(/\s/g, '')] || UNITS[s.replace(/\s/g, '-')];
    if (direct) return direct;
    const compact = s.replace(/[^a-z0-9°/]/g, '');
    if (UNITS[compact]) return UNITS[compact];
    const parts = s.split(' ');
    if (parts.length > 1) { const last = UNITS[parts[parts.length - 1]]; if (last && !/^(square|cubic|fluid|nautical|light)$/.test(parts[0])) return last; }
    if (/^square (metre|meter)s?$/.test(s)) return ['square-meter'];
    if (/^square (foot|feet)$/.test(s)) return ['square-foot'];
    if (/^square (kilometre|kilometer)s?$/.test(s)) return ['square-kilometer'];
    if (/^square miles?$/.test(s)) return ['square-mile'];
    if (/^square inch(es)?$/.test(s)) return ['square-inch'];
    if (/^square yards?$/.test(s)) return ['square-yard'];
    if (/^cubic (metre|meter)s?$/.test(s)) return ['cubic-meter'];
    if (/^cubic (foot|feet)$/.test(s)) return ['cubic-foot'];
    if (/^fluid ounces?$/.test(s) || /^fl\.? ?oz$/.test(s)) return ['fluid-ounce-us'];
    if (/^nautical miles?$/.test(s)) return ['nautical-mile'];
    if (/^light ?years?$/.test(s)) return ['light-year'];
    if (/^(imperial|uk) gallons?$/.test(s)) return ['gallon-imperial'];
    if (/^(us )?gallons?$/.test(s)) return ['gallon-us'];
    return null;
  }
  /** "5 km to miles", "psi in bar", "convert kg into lbs", "celsius fahrenheit" */
  function conversionIntent(text) {
    let s = text.toLowerCase().replace(/→|->|=>/g, ' to ').replace(/\bconvert(ing|er|ed)?\b|\bconversion\b|\bplease\b|\bcalculator\b|\bhow (many|much)\b|\bis\b|\bwhat\b|\bare\b|\?/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^\d+(?:[.,]\d+)?\s*/, '');
    const m = /^(.{1,30}?)\s+(?:to|in|into|as|vs|versus|per|equals?)\s+(.{1,30}?)$/.exec(s);
    const pairs = [];
    if (m) pairs.push([m[1], m[2]]);
    const w = s.split(' ').filter(Boolean);
    if (w.length === 2) pairs.push([w[0], w[1]]);
    if (w.length === 3 && !m) pairs.push([w[0], w[1] + ' ' + w[2]], [w[0] + ' ' + w[1], w[2]]);
    for (const [a, b] of pairs) {
      const A = unitCandidates(a), B = unitCandidates(b);
      if (!A || !B) continue;
      for (const x of A) for (const y of B) { if (CONV[x + '>' + y]) return { hit: CONV[x + '>' + y], from: x, to: y }; }
    }
    const fam = w.length <= 2 && w.map((x) => FAMILY_WORDS[x]).find(Boolean);
    if (fam && FAMILY_HUBS[fam]) return { family: fam, path: FAMILY_HUBS[fam] };
    return null;
  }

  function rank(text) {
    const qTokens = tokens(text);
    const plain = qTokens.filter((t) => t[0] !== '~');
    const fixes = [];
    const expanded = [];
    for (const t of qTokens) {
      if (t[0] === '~' || DF[t]) { expanded.push(t); continue; }
      const alt = nearest(t);
      if (alt) { expanded.push(alt); fixes.push([t, alt]); const gs = groupOf[alt]; if (gs) for (const g of gs) expanded.push('~' + g); }
    }
    const q = Array.from(new Set(expanded));
    const qPlain = q.filter((t) => t[0] !== '~');
    const phrase = text.toLowerCase().trim();
    const scored = [];
    for (const d of DOCS) {
      let s = 0, matched = 0;
      const why = [];
      for (const t of q) {
        const w = d.tf[t];
        if (!w) continue;
        s += w * idf(t) * (t[0] === '~' ? 0.6 : 1);
        if (t[0] !== '~') { matched++; why.push(t); }
      }
      if (!s) continue;
      /* against every word the reader typed, not only the ones the site
         knows: a word nothing here matches is the strongest sign the tool
         is missing, and must count against the match, not vanish */
      const coverage = plain.length ? matched / new Set(plain).size : 1;
      s *= 0.45 + 0.55 * coverage;
      if (phrase.length > 3 && d.titleText.indexOf(phrase) >= 0) s += 6;
      if (qPlain.length > 1 && qPlain.every((t) => d.tf[t] && d.tf[t] >= 3)) s += 3;
      scored.push({ doc: d, score: s, coverage, why });
    }
    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, 8), fixes, plain, qPlain };
  }

  const GREETING = /^(hi|hello|hey|hiya|yo|good (morning|afternoon|evening)|help|start|menu|\?)[!. ]*$/i;
  const THANKS = /^(thanks?|thank you|cheers|ta|great|perfect|nice|cool|ok|okay)[!. ]*$/i;

  /** Everything the UI needs to answer one message. */
  function understand(text, previous) {
    const t = text.trim();
    if (!t) return { kind: 'empty' };
    if (GREETING.test(t)) return { kind: 'greeting' };
    if (THANKS.test(t)) return { kind: 'thanks' };
    const conv = conversionIntent(t);
    if (conv && conv.hit) return { kind: 'convert', hit: conv.hit, from: conv.from, to: conv.to };
    if (conv && conv.family) return { kind: 'family', family: conv.family, path: conv.path };
    let r = rank(t), used = t;
    /* a short follow-up narrows the last question rather than starting over */
    if (previous && previous.text && r.plain.length <= 2) {
      const r2 = rank(previous.text + ' ' + t);
      const best = r.results[0] ? r.results[0].score : 0, best2 = r2.results[0] ? r2.results[0].score : 0;
      if (best2 > best * 1.05) { r = r2; used = previous.text + ' ' + t; }
    }
    const top = r.results[0];
    if (!top) return { kind: 'none', text: used, fixes: r.fixes };
    const second = r.results[1];
    /* words the top match did not account for; two long ones means the
       reader asked for something this site may not have */
    const unknown = r.plain.filter((t) => !DF[t] && t.length >= 5 && !r.fixes.some((f) => f[0] === t)).length;
    const strong = top.coverage >= 0.75 && unknown === 0 && (!second || top.score > second.score * 1.35);
    const weak = top.coverage < 0.6 || top.score < 2.2;
    return { kind: weak ? 'weak' : strong ? 'one' : 'several', results: r.results.slice(0, weak ? 3 : strong ? 3 : 4), text: used, fixes: r.fixes };
  }

  /* ------------------------------------------------------------------ */
  /* the conversation                                                   */
  /* ------------------------------------------------------------------ */
  const STARTERS = ['Merge two PDFs', 'Km to miles', 'Remove the background from a photo', 'Payslip for one employee', 'QR code for my Wi-Fi', 'Put text behind a person in a photo', 'GST on an invoice', 'Days until my exam'];
  const SECTION_CHIPS = [['PDF', 'pdf'], ['Image', 'image'], ['Text', 'text'], ['Business', 'business'], ['India', 'india'], ['Developer', 'developer'], ['Education', 'education'], ['Health', 'health'], ['Units', 'convert units']];

  function mount(root) {
    const io = root.querySelector('.tool-io');
    const endpoint = io.getAttribute('data-endpoint') || '';
    io.innerHTML = '';
    const box = el('section', 'finder');
    box.setAttribute('aria-label', 'Tool Finder');
    const head = el('div', 'finder-head');
    const orb = el('span', 'finder-orb'); orb.setAttribute('aria-hidden', 'true');
    const headText = el('div', 'finder-head-text');
    headText.append(el('strong', null, 'Tool Finder'), el('span', null, 'Runs on your device · nothing you type leaves this page'));
    head.append(orb, headText);
    const log = el('div', 'finder-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
    const chips = el('div', 'finder-chips');
    const form = el('form', 'finder-composer'); form.noValidate = true;
    const input = el('textarea', 'finder-input'); input.rows = 1; input.placeholder = 'Describe the job… e.g. “merge two PDFs”, “km to miles”, “payslip for one employee”';
    input.setAttribute('aria-label', 'Describe what you need'); input.maxLength = 300;
    const send = el('button', 'finder-send'); send.type = 'submit'; send.setAttribute('aria-label', 'Send');
    send.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
    form.append(input, send);
    box.append(head, log, chips, form);
    io.appendChild(box);

    const state = { ready: false, previous: null, busy: false, count: window.SEARCH_INDEX ? window.SEARCH_INDEX.length : 0 };
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function scrollDown() { log.scrollTop = log.scrollHeight; }
    function bubble(kind, node) {
      const m = el('div', 'finder-msg is-' + kind);
      if (kind === 'bot') { const a = el('span', 'finder-avatar'); a.setAttribute('aria-hidden', 'true'); m.appendChild(a); }
      const b = el('div', 'finder-bubble');
      if (typeof node === 'string') b.textContent = node; else b.appendChild(node);
      m.appendChild(b);
      log.appendChild(m);
      scrollDown();
      return b;
    }
    function typing() {
      const m = el('div', 'finder-msg is-bot is-typing');
      const a = el('span', 'finder-avatar'); a.setAttribute('aria-hidden', 'true');
      const b = el('div', 'finder-bubble finder-typing'); b.innerHTML = '<i></i><i></i><i></i>';
      m.append(a, b); log.appendChild(m); scrollDown();
      return () => m.remove();
    }
    function setChips(list, onPick) {
      chips.innerHTML = '';
      for (const c of list) {
        const label = Array.isArray(c) ? c[0] : c, value = Array.isArray(c) ? c[1] : c;
        const b = el('button', 'chip', label); b.type = 'button';
        b.addEventListener('click', () => onPick(value, label));
        chips.appendChild(b);
      }
    }
    function card(d, why) {
      const a = el('a', 'finder-card');
      a.href = base + d.path.replace(/^\//, '');
      const ic = el('span', 'finder-card-icon');
      ic.innerHTML = '<svg class="ico" aria-hidden="true" focusable="false"><use href="' + base + 'assets/icons.svg#' + d.glyph + '"></use></svg>';
      const body = el('span', 'finder-card-body');
      const t = el('strong', null, d.title);
      const meta = el('span', 'finder-card-meta', d.section + (d.path.indexOf('ai/') === 0 ? ' · free to try' : ' · free, on your device'));
      body.append(t, meta);
      if (d.desc) body.appendChild(el('span', 'finder-card-desc', d.desc));
      const go = el('span', 'finder-card-go', 'Open →');
      a.append(ic, body, go);
      return a;
    }
    function cards(results) {
      const wrap = el('div', 'finder-cards');
      for (const r of results) wrap.appendChild(card(r.doc, r.why));
      return wrap;
    }
    function textAnd(text, node) { const w = el('div'); w.appendChild(el('p', 'finder-text', text)); if (node) w.appendChild(node); return w; }
    function narrowRow(text) {
      const row = el('div', 'finder-narrow');
      row.appendChild(el('span', 'finder-narrow-label', 'Narrow it:'));
      for (const [label, value] of SECTION_CHIPS) {
        const b = el('button', 'chip', label); b.type = 'button';
        b.addEventListener('click', () => ask(text + ' ' + value, label));
        row.appendChild(b);
      }
      return row;
    }
    function requestButton(text) {
      const b = el('button', 'btn-primary finder-request', 'It does not exist — request it');
      b.type = 'button';
      b.addEventListener('click', () => requestForm(text));
      return b;
    }
    const fixNote = (fixes) => fixes.length ? ' (reading “' + fixes[0][0] + '” as “' + fixes[0][1] + '”)' : '';

    function intro() {
      const n = state.count ? state.count.toLocaleString('en-GB') : 'all the';
      bubble('bot', textAnd('Tell me the job and I will find the tool — there are ' + n + ' here, from a VAT return to a passport photo. Plain words work best: what goes in, what should come out.'));
      setChips(STARTERS, (v) => ask(v));
    }

    async function ask(text, shown) {
      const t = String(text || '').trim();
      if (!t || state.busy) return;
      state.busy = true;
      bubble('user', shown || t);
      input.value = ''; autosize();
      const stop = typing();
      await sleep(reduced ? 60 : 320 + Math.min(500, t.length * 8));
      let u;
      try { u = understand(t, state.previous); } catch (e) { u = { kind: 'error', message: e.message }; }
      stop();
      answer(u, t);
      state.busy = false;
      input.focus({ preventScroll: true });
    }

    function answer(u, raw) {
      switch (u.kind) {
        case 'greeting': intro(); break;
        case 'thanks': bubble('bot', 'Any time. Ask for the next one whenever you need it.'); break;
        case 'empty': break;
        case 'error': bubble('bot', 'Something went wrong on this page: ' + u.message + '. The full directory still lists everything.'); break;
        case 'convert': {
          const d = { title: u.hit.title, path: u.hit.path, glyph: 'i-' + u.hit.family, section: 'Conversions', desc: 'Type a value and it converts both ways, with the formula shown.' };
          bubble('bot', textAnd('There is a page for exactly that.', cards([{ doc: d }])));
          setChips([['All ' + u.hit.family + ' conversions', 'convert ' + u.hit.family], ['Reverse it', u.to.replace(/-/g, ' ') + ' to ' + u.from.replace(/-/g, ' ')]].concat(STARTERS.slice(0, 3)), (v, l) => ask(v, l));
          state.previous = { text: raw };
          break;
        }
        case 'family': {
          const d = { title: u.family[0].toUpperCase() + u.family.slice(1) + ' conversions', path: u.path, glyph: 'i-' + u.family, section: 'Conversions', desc: 'Every pair in the family on one page.' };
          bubble('bot', textAnd('The whole family is here; name two units and I will open the exact pair.', cards([{ doc: d }])));
          state.previous = { text: raw };
          break;
        }
        case 'none': {
          const w = textAnd('I could not match that to anything here' + fixNote(u.fixes) + '. Try the noun for the thing and the verb for the job — or if it should exist, send it and it goes on the build list.');
          w.appendChild(narrowRow(u.text));
          w.appendChild(requestButton(raw));
          bubble('bot', w);
          setChips(STARTERS, (v) => ask(v));
          state.previous = { text: raw };
          break;
        }
        case 'weak': {
          const w = textAnd('Nothing matches that closely' + fixNote(u.fixes) + '. The nearest are below; if none of them is it, say so and I will take the request.', cards(u.results));
          w.appendChild(narrowRow(u.text));
          w.appendChild(requestButton(raw));
          bubble('bot', w);
          state.previous = { text: u.text };
          break;
        }
        case 'one': {
          const top = u.results[0];
          const w = textAnd('That is the ' + top.doc.title + fixNote(u.fixes) + '.', cards([top]));
          if (u.results.length > 1) {
            const more = el('details', 'finder-more');
            more.appendChild(el('summary', null, 'Not quite? Two more that are close'));
            more.appendChild(cards(u.results.slice(1)));
            w.appendChild(more);
          }
          bubble('bot', w);
          setChips([['Request a tool', '__request']].concat(STARTERS.slice(0, 4)), (v, l) => v === '__request' ? requestForm('') : ask(v, l));
          state.previous = { text: u.text };
          break;
        }
        default: {
          const w = textAnd('A few tools do that' + fixNote(u.fixes) + ' — the closest first. Add a word to narrow it, or pick one.', cards(u.results));
          w.appendChild(narrowRow(u.text));
          bubble('bot', w);
          state.previous = { text: u.text };
        }
      }
    }

    function requestForm(prefill) {
      if (!endpoint) {
        bubble('bot', textAnd('Requests are taken on the contact page for now.', (() => { const a = el('a', 'btn-ghost', 'Open the contact page'); a.href = base + 'contact/'; return a; })()));
        return;
      }
      const f = el('form', 'finder-form'); f.noValidate = true;
      const opened = Date.now();
      const what = el('textarea', 'control'); what.rows = 3; what.maxLength = 2000; what.required = true; what.value = prefill || ''; what.placeholder = 'What should the tool do? One sentence is plenty.'; what.setAttribute('aria-label', 'What should the tool do?');
      const who = el('input', 'control'); who.type = 'text'; who.maxLength = 120; who.placeholder = 'What do you do? (optional)'; who.setAttribute('aria-label', 'What do you do? (optional)');
      const email = el('input', 'control'); email.type = 'email'; email.maxLength = 200; email.placeholder = 'Email, if you want an answer (optional)'; email.setAttribute('aria-label', 'Email (optional)');
      const trap = el('input'); trap.type = 'text'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true'); trap.className = 'finder-trap';
      const btn = el('button', 'btn-primary', 'Send the request'); btn.type = 'submit';
      const msg = el('div', 'io-msg');
      const note = el('p', 'field-hint', 'This is the one thing on the page that leaves your device: it goes to our server, is kept until dealt with, and the email is used to reply and for nothing else.');
      f.append(el('p', 'finder-text', 'Tell me what it should do and it goes straight on the build list.'), what, who, email, trap, btn, msg, note);
      bubble('bot', f);
      what.focus({ preventScroll: true });
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = what.value.trim();
        const say = (t, k) => { msg.textContent = t || ''; msg.className = 'io-msg' + (k ? ' is-' + k : ''); };
        if (text.length < 10) { say('Tell us a little more about what the tool should do — one sentence is plenty.', 'error'); return; }
        btn.disabled = true; say('Sending…', 'note');
        fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: { what: text, who: who.value, email: email.value, trap: trap.value, tookMs: Date.now() - opened, page: location.pathname, via: 'tool-finder' } }) })
          .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
          .then((x) => {
            if (x.ok && x.b && x.b.result && x.b.result.ok) { f.querySelectorAll('textarea,input,button').forEach((n) => { n.disabled = true; }); say('Thank you — that is on the list. If you left an email you will hear back when it is built, or when it turns out it cannot be.', 'note'); return; }
            say((x.b && x.b.error && x.b.error.message) || 'That did not send. Try again in a moment, or use the contact page.', 'error'); btn.disabled = false;
          })
          .catch(() => { say('That did not send — the network refused it. Try again, or use the contact page.', 'error'); btn.disabled = false; });
      });
    }

    function autosize() { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px'; }
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : ask(input.value); } });
    form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

    /* load, then greet; a ?q= from the search box is answered straight away */
    const loading = bubble('bot', 'Loading the tool list…');
    loadIndexes().then(() => {
      build();
      state.count = window.SEARCH_INDEX.length;
      state.ready = true;
      loading.parentNode.remove();
      intro();
      const q = new URLSearchParams(location.search).get('q');
      if (q) ask(q);
      else input.focus({ preventScroll: true });
    }).catch((e) => {
      loading.textContent = e.message + ' The full directory at /tools/ lists everything.';
    });

    return { ask, understand };
  }

  window.ToolFinder = { mount, understand: (t) => understand(t, null), ready: () => !!DOCS };
})();
