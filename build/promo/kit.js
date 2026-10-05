'use strict';
/**
 * Launch kit for one tool, written to <PROMO_HOME>/kits/<slug>/:
 *
 *   carousel-1.png … carousel-5.png  1080x1350  hook+pain · the usual way · the fix + example · steps · CTA
 *   carousel.pdf                     the same five slides as 1080x1350 pages (LinkedIn document post)
 *   square-1080.png                  1080x1080  hook · example · tool name · proof
 *   story-1080x1920.png              1080x1920  pain · example · promise · QR sticker (safe areas kept)
 *   pin-1000x1500.png                1000x1500  "How to …" · example · 3 steps · URL
 *   wide-1200x630.png                1200x630   pain → fix · example · URL
 *   kit.md                           the story, captions written from it (linted), images, venues, UTM links, every template
 *
 * Every kit has a look, variant = { layout, palette, type, copy, seed } (see
 * kit-templates/variant.js): five composition families, eight AA-checked
 * palettes, five heading treatments and three copy alternates. Without a seed
 * each new kit for a tool takes the next look that differs from its last three
 * and from the last two kits of any tool (kits/history.json); with a seed the
 * look, and the PNG bytes, are reproduced exactly.
 *
 *   await kit('/pdf/merge-pdf/')                                  next look for this tool
 *   await kit('/pdf/merge-pdf/', { seed: 1234 })                  reproducible
 *   await kit('/pdf/merge-pdf/', { layout: 'cover', palette: 'paper', type: 'serif' })
 *   await kit('/pdf/merge-pdf/', { theme: 'both' })               the look in Midnight, plus Daylight as "-daylight" files
 *     -> { tool, slug, dir, files, variant, qr, story, example, fit: { overflow, clamped, clipped } }
 *
 * `theme` is kept from the first API: 'midnight' or 'daylight' set the palette,
 * 'both' renders a second palette alongside. The primary look always uses the
 * plain file names above; extra palettes add "-<palette>" before the extension.
 *
 * The story comes from stories/index.js (written copy or a fallback). The example
 * is the tool's REAL output, captured by examples.js when it is present; if the
 * capture fails or the module is absent, a previously captured example on disk is
 * used, and failing that an honest "How it works" schematic built from the story.
 * Every text is fitted in the page (shrink to a floor, then clamp) and audited for
 * overflow before the screenshot. Nothing is uploaded or posted anywhere.
 */
const fs = require('fs');
const path = require('path');
const T = require('./tools');
const TPL = require('./templates');
const V = require('./venues');
const L = require('./log');
const P = require('./kit-templates/parts');
const S = require('./kit-templates/style');
const LAY = require('./kit-templates/layouts');
const { kitPage } = require('./kit-templates/page');
const VAR = require('./kit-templates/variant');
const PAL = require('./kit-templates/palettes');

const CHROME = process.env.PROMO_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = T.ROOT;
const THEME_IDS = Object.keys(S.THEMES);

/* Single-image formats. The primary look uses these names; an extra palette adds "-<palette>". */
const SIZES = [
  { file: 'square-1080.png', w: 1080, h: 1080, layout: 'square', use: 'Instagram feed, LinkedIn, X image post' },
  { file: 'pin-1000x1500.png', w: 1000, h: 1500, layout: 'pin', use: 'Pinterest pin (2:3)' },
  { file: 'story-1080x1920.png', w: 1080, h: 1920, layout: 'story', use: 'Instagram / Facebook story, with a QR sticker to the tool' },
  { file: 'wide-1200x630.png', w: 1200, h: 630, layout: 'wide', use: 'Link preview size: LinkedIn, Facebook, Mastodon, newsletters' },
];
const CAROUSEL = [1, 2, 3, 4, 5].map((n) => ({
  file: 'carousel-' + n + '.png', w: 1080, h: 1350, layout: 'carousel', slide: n,
  use: ['Slide 1: hook and pain', 'Slide 2: the usual way', 'Slide 3: the fix, with the example', 'Slide 4: three steps', 'Slide 5: QR, link, proof, "Save this for later"'][n - 1],
}));
const PDF = { file: 'carousel.pdf', w: 1080, h: 1350, layout: 'carousel', use: 'LinkedIn document post: the five slides as pages' };

/** File name for a look: the primary look (suffix null) keeps the plain name. */
function themed(file, suffix) { return suffix ? file.replace(/(\.[a-z]+)$/, '-' + suffix + '$1') : file; }
const KIT_FILE = /^(carousel(-[1-5])?|square-1080|pin-1000x1500|story-1080x1920|wide-1200x630)(-[a-z]+)?\.(png|pdf)$/;

/** Proof pills: what is true for this pricing tier (kept for callers of the old API). */
function pills(rec) {
  return rec.pricing === 'freemium' ? ['10 free runs a month', 'Account needed', 'Says what it sends'] : ['Free', 'No upload', 'No sign-up'];
}
function glyphSvg(id, fallback) { return P.glyph(id, fallback); }

function kitSlug(rec) {
  const dup = T.listTools().filter((r) => r.slug === rec.slug).length > 1;
  return dup ? rec.section + '-' + rec.slug : rec.slug;
}
function kitsDir() { return path.join(L.home(), 'kits'); }
function examplesDir() { return path.join(L.home(), 'examples'); }

/* ------------------------------------------------------------- images */

/** PNG width/height from the IHDR chunk. */
function pngSize(buf) {
  if (!buf || buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
/** { w, h, mime, alpha } for PNG, JPEG and WebP. */
function imageMeta(buf) {
  if (!buf || buf.length < 16) return null;
  if (buf.readUInt32BE(0) === 0x89504e47) {
    const ct = buf[25];
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), mime: 'image/png', alpha: ct === 4 || ct === 6 || buf.indexOf('tRNS') > 0 && buf.indexOf('tRNS') < 200 };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), mime: 'image/jpeg', alpha: false };
      i += 2 + len;
    }
    return { w: 0, h: 0, mime: 'image/jpeg', alpha: false };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fmt = buf.toString('ascii', 12, 16);
    if (fmt === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), mime: 'image/webp', alpha: !!(buf[20] & 0x10) };
    if (fmt === 'VP8L') { const b = buf.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff), mime: 'image/webp', alpha: !!((b >> 28) & 1) }; }
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, mime: 'image/webp', alpha: false };
  }
  return null;
}
function dataUrl(file) {
  const buf = fs.readFileSync(file);
  const meta = imageMeta(buf);
  if (!meta) throw new Error('not an image: ' + file);
  return { url: 'data:' + meta.mime + ';base64,' + buf.toString('base64'), meta };
}

/* ------------------------------------------------------------ examples */

let examplesOverride = null;
/** Tests can swap the capture module: setExamples({ capture(path, spec) }) or null. */
function setExamples(mod) { examplesOverride = mod; }
function examplesModule() {
  if (examplesOverride) return { mod: examplesOverride };
  const file = path.join(__dirname, 'examples.js');
  if (!fs.existsSync(file)) return { mod: null, note: 'examples.js is not installed' };
  try { return { mod: require(file) }; } catch (e) { return { mod: null, note: 'examples.js failed to load: ' + (e && e.message || e) }; }
}

function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(what + ' timed out after ' + Math.round(ms / 1000) + ' s')), ms); })]).finally(() => clearTimeout(t));
}

/** Candidate folders of an already-captured example. */
function exampleDirs(rec) {
  const base = examplesDir();
  return [...new Set([kitSlug(rec), rec.slug, rec.section + '-' + rec.slug].map((n) => path.join(base, n)))];
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

/** Whatever capture() returned -> { data, dir } or null. */
function resolveCaptured(res, rec) {
  if (!res) return null;
  if (typeof res === 'string') {
    if (/\.json$/i.test(res) && fs.existsSync(res)) return { data: readJson(res), dir: path.dirname(res) };
    if (fs.existsSync(path.join(res, 'example.json'))) return { data: readJson(path.join(res, 'example.json')), dir: res };
    return null;
  }
  if (typeof res !== 'object') return null;
  const data = res.kind ? res : (res.example && res.example.kind ? res.example : res.result && res.result.kind ? res.result : null);
  let dir = res.dir || res.folder || res.outDir || (res.file && path.dirname(res.file)) || (res.path && /\.json$/i.test(res.path) ? path.dirname(res.path) : res.path);
  if (data) {
    if (!dir || !fs.existsSync(dir)) dir = exampleDirs(rec).find((d) => fs.existsSync(path.join(d, 'example.json'))) || exampleDirs(rec)[0];
    return { data, dir };
  }
  if (dir && fs.existsSync(path.join(dir, 'example.json'))) return { data: readJson(path.join(dir, 'example.json')), dir };
  return null;
}
function fromDisk(rec) {
  for (const d of exampleDirs(rec)) {
    const f = path.join(d, 'example.json');
    if (fs.existsSync(f)) { try { return { data: readJson(f), dir: d }; } catch (e) { /* next */ } }
  }
  return null;
}

/** "18% — standard rate (most goods & services)" -> "18%": the label already says what it is. */
function shortValue(v) {
  const s = String(v == null ? '' : v).trim();
  if (s.length <= 22) return s;
  const cut = s.split(/\s+[—–]\s+|\s+\(/)[0].trim();
  return cut.length >= 1 && cut.length < s.length ? cut : s;
}

/** The schematic: the story's own (if it is one) or the tool's io line. */
function schematic(rec, story, note) {
  const sp = story.example && story.example.kind === 'schematic' ? story.example : {};
  const io = String(rec.io || '').split('→').map((x) => x.trim());
  return {
    kind: 'schematic', real: false, note: note || '',
    input: sp.input || io[0] || 'Your input', output: sp.output || io[1] || 'The result',
    sampleIn: sp.sampleIn || '', sampleOut: sp.sampleOut || '', caption: '',
  };
}

/** A captured example.json -> the shape heroes.js draws, or null when unusable. */
function normaliseCaptured(data, dir, rec, spec) {
  if (!data || data.ok === false) return null;
  const img = (name) => {
    if (!name) return null;
    const f = path.isAbsolute(name) ? name : path.join(dir || '', name);
    if (!fs.existsSync(f)) return null;
    try { return dataUrl(f); } catch (e) { return null; }
  };
  const base = { real: data.source ? /live/i.test(data.source) : true, caption: data.caption || '', captured: data.captured || '', note: data.note || '' };
  const k = data.kind;
  if (k === 'calc') {
    let results = (data.results || []).filter((r) => r && r.value != null && String(r.value).trim()).map((r) => Object.assign({}, r));
    if (!results.length) return null;
    const inputs = (data.inputs || []).filter((r) => r && r.label).map((r) => Object.assign({}, r, { value: shortValue(r.value) }));
    // the figure worth showing big: not one that only echoes an input (an "invoice total" equal to the amount typed)
    const num = (s) => { const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
    const echoes = new Set(inputs.map((i) => num(i.value)).filter((x) => x != null && x !== 0));
    let primary = results.find((r) => r.primary) || results[0];
    if (echoes.has(num(primary.value))) {
      const better = results.find((r) => r !== primary && num(r.value) != null && num(r.value) !== 0 && !echoes.has(num(r.value)) && String(r.value).length <= 24);
      if (better) primary = better;
    }
    results = [primary].concat(results.filter((r) => r !== primary && !/^[^\d]*0(\.0+)?[^\d]*$/.test(String(r.value).replace(/,/g, ''))))
      .map((r, i) => Object.assign(r, { primary: i === 0, value: i === 0 ? r.value : shortValue(r.value) }));
    return Object.assign(base, { kind: 'calc', inputs, results });
  }
  if (k === 'text') {
    if (!data.output || !String(data.output).trim()) return null;
    return Object.assign(base, { kind: 'text', input: String(data.input || ''), output: String(data.output), inputLabel: data.inputLabel || 'Input', outputLabel: data.outputLabel || 'Output' });
  }
  if (k === 'document') {
    const p = img(data.page || data.after);
    if (!p) return null;
    return Object.assign(base, { kind: 'document', page: p.url, fileName: data.fileName || data.file || (rec.slug.replace(/-pdf$/, '') + '.pdf') });
  }
  if (k === 'beforeAfter') {
    const a = img(data.after);
    const b = img(data.before);
    if (!a) return null;
    const sk = spec && spec.kind;
    const variant = rec.section === 'ai-video' || sk === 'video' ? 'video' : (sk === 'pdf-edit' || rec.section === 'pdf') ? 'document' : 'photo';
    if (!b && variant !== 'video') return Object.assign(base, { kind: 'image', after: a.url });
    return Object.assign(base, { kind: 'beforeAfter', variant, before: b ? b.url : null, after: a.url, alpha: a.meta.alpha });
  }
  if (k === 'image') {
    const a = img(data.after || data.image);
    if (!a) return null;
    return Object.assign(base, { kind: 'image', after: a.url });
  }
  if (k === 'schematic') {
    return { kind: 'schematic', real: false, caption: '', note: data.note || '', input: data.input || '', output: data.output || '', sampleIn: data.sampleIn || '', sampleOut: data.sampleOut || '' };
  }
  return null;
}

/**
 * The example for a kit. opts.capture === false skips the live capture and
 * only reads what is on disk. Never throws.
 */
async function getExample(rec, story, opts) {
  opts = opts || {};
  const spec = story.example || {};
  const notes = [];
  if (opts.capture !== false) {
    const { mod, note } = examplesModule();
    if (note) notes.push(note);
    if (mod && typeof mod.capture === 'function') {
      try {
        const res = await withTimeout(Promise.resolve(mod.capture(rec.path, spec, opts.captureOptions || {})), opts.captureTimeout || 900000, 'capture');
        let got = resolveCaptured(res, rec);
        if (got && typeof mod.dirFor === 'function') { try { const d = mod.dirFor(rec.path); if (d && fs.existsSync(d)) got.dir = d; } catch (e) { /* keep */ } }
        if (got && got.data && got.data.kind === 'schematic' && got.data.ok !== false) {
          return { ex: Object.assign(schematic(rec, story), { input: got.data.input || schematic(rec, story).input, output: got.data.output || schematic(rec, story).output }), how: 'schematic: nothing is run for this tool, the illustration is labelled as such' };
        }
        if (got && got.data && got.data.ok === false) notes.push('capture reported: ' + (got.data.note || 'not ok'));
        const ex = got && normaliseCaptured(got.data, got.dir, rec, spec);
        if (ex) return { ex, how: 'captured from the live tool' + (ex.captured ? ' (' + ex.captured + ')' : '') };
        if (got && got.data && got.data.ok !== false) notes.push('capture returned an example the kit could not use (' + (got.data.kind || 'no kind') + ')');
        if (!got) notes.push('capture returned nothing usable');
      } catch (e) {
        notes.push('capture failed: ' + String(e && e.message || e).split('\n')[0].slice(0, 200));
      }
    } else if (mod) notes.push('examples.js has no capture()');
  }
  if (spec.kind === 'schematic') return { ex: schematic(rec, story, notes.join('; ')), how: 'schematic: nothing is run for this tool, the illustration is labelled as such' };
  const disk = fromDisk(rec);
  if (disk) {
    const ex = normaliseCaptured(disk.data, disk.dir, rec, spec);
    if (ex) return { ex, how: 'captured earlier (' + (ex.captured || 'on disk') + ')' + (notes.length ? '; ' + notes.join('; ') : '') };
  }
  const ex = schematic(rec, story, notes.join('; '));
  return { ex, how: 'schematic fallback' + (notes.length ? ': ' + notes.join('; ') : '') };
}

/* ---------------------------------------------------------------- QR */

let QRLIB = null;
function qrSvg(text, px) {
  if (!QRLIB) QRLIB = require(path.join(ROOT, 'engine', 'qr.bundle.js'));
  const qr = QRLIB.encode(text, 'M');
  let verified = false;
  try { const v = QRLIB.verify(qr); verified = !!(v && (v.ok || v.matches)); } catch (e) { verified = false; }
  const svg = QRLIB.toSVG(qr, { scale: 10, quiet: 1, dark: '#06080f', light: '#ffffff' })
    .replace(/width="\d+" height="\d+"/, 'width="' + px + '" height="' + px + '"');
  return { svg, info: { text, version: qr.version, verified } };
}

/* ------------------------------------------------------------- render */

function documentHtml(canvases) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + S.css() + '</style></head><body>' + canvases.join('') + '</body></html>';
}

/** The HTML of one format for one theme (also used by tests and previews). */
function renderHtml(fmt, ctx) {
  const out = LAY[fmt](ctx);
  return documentHtml(Array.isArray(out) ? out : [out]);
}

/** Lay out one format in the page and return its fit report (no screenshot). */
async function layoutFormat(page, fmt, ctx, scale) {
  const f = LAY.FORMATS[fmt];
  await page.setViewport({ width: f.w, height: f.h, deviceScaleFactor: scale || 1 });
  await page.setContent(renderHtml(fmt, ctx), { waitUntil: 'load' });
  return page.evaluate(kitPage);
}

/** Render one look: five slides + PDF + four singles, named with an optional suffix. */
async function renderLook(page, dir, ctx, files, fit, suffix) {
  const tag = ctx.v.palette + '/' + ctx.v.layout + '/' + ctx.v.type;
  const merge = (r) => { for (const k of ['overflow', 'clamped', 'clipped']) fit[k].push(...r[k].map((x) => tag + ' ' + x)); };
  // carousel: five canvases in one document -> five PNGs and a five-page PDF
  merge(await layoutFormat(page, 'carousel', ctx));
  for (const c of CAROUSEL) {
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: (c.slide - 1) * 1350, width: 1080, height: 1350 }, captureBeyondViewport: true });
    const out = path.join(dir, themed(c.file, suffix));
    fs.writeFileSync(out, buf);
    files.push(Object.assign({}, c, { file: themed(c.file, suffix), path: out, bytes: buf.length, actual: pngSize(buf), palette: ctx.v.palette }));
  }
  const pdf = await page.pdf({ width: '1080px', height: '1350px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1-5' });
  const pdfOut = path.join(dir, themed(PDF.file, suffix));
  fs.writeFileSync(pdfOut, pdf);
  files.push(Object.assign({}, PDF, { file: themed(PDF.file, suffix), path: pdfOut, bytes: pdf.length, pages: pdfPages(pdf), palette: ctx.v.palette }));
  for (const size of SIZES) {
    merge(await layoutFormat(page, size.layout, ctx));
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size.w, height: size.h } });
    const out = path.join(dir, themed(size.file, suffix));
    fs.writeFileSync(out, buf);
    files.push(Object.assign({}, size, { file: themed(size.file, suffix), path: out, bytes: buf.length, actual: pngSize(buf), palette: ctx.v.palette }));
  }
}

/** The render context for a tool, story, example and variant. */
function makeCtx(rec, story, ex, v, n, qrs) {
  return { rec, story, ex, v, c: VAR.copyFor(rec, story, v.copy, ex), n: (v.seed % 97) + 1, qr: { story: qrs.story.svg, carousel: qrs.carousel.svg } };
}

/** Pages in a PDF, by counting page objects. */
function pdfPages(buf) { return (String(buf.toString('latin1')).match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length; }

/* ------------------------------------------------------------ kit.md */

function venueForTemplate(fitList, id) {
  for (const f of fitList) if (f.templates.includes(id)) return V.get(f.id);
  return null;
}
function mdEsc(s) { return String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }

/** Captions written from the story, each linted against the tool's truth rules. */
function captions(rec, story) {
  const { lint } = require('./lint');
  let tags = [];
  const other = !require('./site').isDefault();
  // the 1234Tools hashtag table fits its tools only; another site gets its brand and the item's group
  if (other) tags = [require('./site').current().name, rec.section].map((t) => '#' + String(t).replace(/[^A-Za-z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase()));
  else try { tags = require('./hashtags').tagsFor(rec, { n: 5, brand: 1 }); } catch (e) { tags = []; }
  const x = story.usual.map((u) => '✗ ' + u).join('\n');
  const steps = story.steps.map((s, i) => (i + 1) + '. ' + s).join('\n');
  const proof = story.proof.join(' · ');
  const li = T.utmUrl(rec.path, 'social-linkedin', 'social');
  const ig = T.utmUrl(rec.path, 'social-instagram', 'social');
  const pin = T.utmUrl(rec.path, 'social-pinterest', 'social');
  const xl = T.utmUrl(rec.path, 'social-x', 'social');
  const exWord = { calc: 'the result card', text: 'the input and the output', document: 'the PDF it made', beforeAfter: 'a before and after', image: 'the result', schematic: 'how it works' };
  const list = [
    { id: 'linkedin-document', label: 'LinkedIn document post (attach carousel.pdf)', limit: 3000,
      text: story.hook + '\n\n' + story.pain + '\n\nThe usual way:\n' + x + '\n\n' + rec.title + ': ' + story.promise + '\n\n' + steps + '\n\n' + proof + '\n' + li },
    { id: 'instagram-carousel', label: 'Instagram carousel / feed caption', limit: 2200,
      text: story.hook + '\n\n' + story.pain + '\n\n' + x + '\n\nThe fix: ' + rec.title + '. ' + story.promise + '\n\n' + steps + '\n\n' + proof + '. Link in bio: ' + P.cleanHost(rec.path) + '\n\nSave this for later.\n\n' + tags.join(' ') },
    { id: 'pinterest-title', label: 'Pinterest pin title', limit: 100, text: story.howTo || (rec.title + ': ' + story.hook).slice(0, 100) },
    { id: 'pinterest-description', label: 'Pinterest pin description', limit: 500,
      text: story.pain + ' ' + story.promise + ' ' + story.steps.map((s, i) => (i + 1) + ') ' + s + '.').join(' ') + ' ' + proof + '.' },
    { id: 'pinterest-link', label: 'Pinterest destination link', text: pin },
    { id: 'x-post', label: 'X / Threads post', limit: 280, countMode: 'x', text: story.hook + '\n\n' + story.promise + '\n\n' + xl },
    { id: 'story-sticker', label: 'Story link sticker (the QR in the image encodes the same page)', text: story.cta + ' → ' + T.utmUrl(rec.path, 'instagram-story', 'social') },
    { id: 'alt', label: 'Alt text for every image', limit: 250,
      text: rec.title + ': ' + story.hook + ' The image shows ' + (exWord[story._exKind] || 'the tool') + ', then ' + P.cleanHost(rec.path) + '.' },
  ];
  for (const c of list) {
    const r = lint(c.text, { pricing: rec.pricing, section: rec.section, limit: c.limit, countMode: c.countMode, record: rec, multiLinkOk: true });
    c.count = r.count;
    c.errors = r.errors;
    c.warnings = r.warnings;
  }
  return list;
}

function buildMarkdown(rec, story, exInfo, fitList, dir, qrs, fit, caps, look) {
  const lines = [];
  const push = (s) => lines.push(s == null ? '' : s);
  push('# Launch kit: ' + rec.title);
  push('');
  push('Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' by the Promotion Desk for ' + P.brandName() + '. Nothing here has been posted: a human reads, edits and publishes every piece.');
  push('');
  push('- Tool: ' + rec.cleanUrl);
  push('- Section: ' + rec.sectionName + ' (`' + rec.section + '`) · Verb: ' + rec.verb + ' · ' + rec.io);
  push('- Pricing: ' + (rec.pricing === 'freemium' ? 'freemium: account needed, 10 AI runs a month free, sends text to a model. Never call it free without the allowance, never "offline" or "on your device".' : 'free: runs in the browser, nothing you type is uploaded, no account.'));
  push('- Audiences: ' + (rec.audiences.join(', ') || '(none)') + ' · venue tags: ' + rec.audienceTags.join(', '));
  if (rec.relatedGuides.length) push('- Guides that link here: ' + rec.relatedGuides.map((g) => T.ORIGIN + g).join(', '));
  if (rec.relatedCompare.length) push('- Comparisons that link here: ' + rec.relatedCompare.map((g) => T.ORIGIN + g).join(', '));
  push('');
  push('## Story');
  push('');
  push('Source: ' + (story.source === 'story' ? 'written story (`stories/' + story.shard + '`)' : 'generated fallback (no written story for this tool yet; edit `build/promo/stories/<section>.js` to replace it)') + '.');
  push('');
  push('- **Persona:** ' + story.persona);
  push('- **Hook:** ' + story.hook);
  push('- **Pain:** ' + story.pain);
  push('- **The usual way:**');
  for (const u of story.usual) push('  - ✗ ' + u);
  push('- **Promise:** ' + story.promise);
  push('- **Steps:** ' + story.steps.map((s, i) => (i + 1) + '. ' + s).join(' · '));
  push('- **Proof:** ' + story.proof.join(' · '));
  push('- **How-to title:** ' + story.howTo);
  push('- **CTA:** ' + story.cta);
  push('- **Example:** ' + exInfo.ex.kind + (exInfo.ex.real ? ' (real output)' : ' (illustration, labelled as such)') + ' · ' + exInfo.how);
  push('');
  const v = look.variant;
  push('## Look');
  push('');
  push('- **Variant:** layout `' + v.layout + '` (' + VAR.LAYOUT_LABELS[v.layout] + ') · palette `' + v.palette + '` (' + PAL.PALETTES[v.palette].label + ') · type `' + v.type + '` (' + VAR.TYPE_LABELS[v.type] + ') · copy `' + v.copy + '` · seed `' + v.seed + '`');
  push('- Chosen by: ' + look.how);
  push('- Words on the images: hook "' + look.copy.hook + '" · CTA "' + look.copy.cta + '"');
  push('- Reproduce exactly: `node build/promo/desk.js kit ' + rec.path + ' --seed ' + v.seed + ' --layout ' + v.layout + ' --palette ' + v.palette + ' --type ' + v.type + ' --copy ' + v.copy
    + ((look.extra || []).includes('daylight') && v.palette === 'midnight' ? ' --theme both' : '') + '`');
  push('');
  push('## Images');
  push('');
  let present = [];
  try { present = fs.readdirSync(dir); } catch (e) { present = []; }
  for (const sfx of [null].concat(look.extra || [])) {
    const all = CAROUSEL.concat([PDF], SIZES).map((s) => Object.assign({}, s, { file: themed(s.file, sfx) })).filter((s) => present.includes(s.file));
    if (!all.length) continue;
    const pal = sfx || v.palette;
    push('**' + PAL.PALETTES[pal].label + '**' + (sfx ? ' (the same look in a second palette)' : ''));
    push('');
    for (const im of all) push('- `' + im.file + '` ' + im.w + '×' + im.h + ': ' + im.use);
    push('');
  }
  for (const q of qrs) push('- ' + q.label + ' QR encodes ' + q.text + ' (version ' + q.version + ', level M, read back ' + (q.verified ? 'OK' : 'NOT verified') + ').');
  if (fit.overflow.length) { push(''); push('**Text that did not fit** (fix the copy or report it):'); for (const o of fit.overflow) push('- ' + o); }
  if (fit.clamped.length) { push(''); push('Text shortened to fit: ' + fit.clamped.join('; ')); }
  push('');
  push('## Captions');
  push('');
  push('Written from the story. Counts are against each platform\'s limit; lint errors must be fixed before posting.');
  push('');
  for (const c of caps) {
    push('### ' + c.label + ' (`' + c.id + '`)');
    push('');
    push('**' + c.count + (c.limit ? ' / ' + c.limit : '') + (c.countMode === 'x' ? ' (X counting)' : ' chars') + '**');
    push('');
    push('```text');
    push(c.text);
    push('```');
    push('');
    const notes = c.errors.map((e) => 'ERROR ' + e.rule + ': ' + e.msg).concat(c.warnings.map((w) => 'note ' + w.rule + ': ' + w.msg));
    if (notes.length) { for (const n of notes) push('- ' + n); push(''); }
  }
  push('## Best-fit venues');
  push('');
  push('| # | Venue | Kind | Risk | Self-promo | Links | Cadence | Today | Rules |');
  push('|---|---|---|---|---|---|---|---|---|');
  fitList.slice(0, 12).forEach((f, i) => {
    push('| ' + (i + 1) + ' | ' + mdEsc(f.name) + ' (`' + f.id + '`) | ' + f.kind + ' | ' + f.risk + ' | ' + f.selfPromo + ' | ' + f.linkPolicy + ' | every ' + f.cadenceDays + ' d, ' + f.maxPerWeek + '/wk | ' + (f.status.ok ? 'ok' : 'wait: ' + mdEsc(f.status.reasons[0])) + ' | ' + (f.rulesUrl || '') + ' |');
  });
  push('');
  for (const f of fitList.slice(0, 12)) {
    push('### ' + f.name);
    push('');
    if (f.promoThread) push('- Promo thread: ' + f.promoThread);
    push('- Templates: ' + f.templates.join(', '));
    if (f.notes) push('- Notes: ' + f.notes);
    if (f.verifiedHow) push('- Verified: ' + f.verifiedHow);
    push('- UTM link: ' + T.utmUrl(rec.path, f.id, TPL.KIND_MEDIUM[f.kind] || 'social'));
    push('');
  }
  push('## UTM links for every post venue');
  push('');
  push('| Venue | Link |');
  push('|---|---|');
  for (const f of fitList) push('| `' + f.id + '` | ' + T.utmUrl(rec.path, f.id, TPL.KIND_MEDIUM[f.kind] || 'social') + ' |');
  push('| `instagram-story` (QR) | ' + T.utmUrl(rec.path, 'instagram-story', 'social') + ' |');
  push('| `kit-carousel` (QR on slide 5) | ' + T.utmUrl(rec.path, 'kit-carousel', 'social') + ' |');
  push('');
  push('## Copy');
  push('');
  push('Variant 0 of every template. Counts are against each part\'s hard limit. Re-read every line before posting; fill anything in [brackets].');
  push('');
  for (const id of TPL.TEMPLATE_IDS) {
    const venue = venueForTemplate(fitList, id);
    const r = TPL.render(id, rec, { variant: 0, venue });
    push('### ' + r.label + ' (`' + id + '`)' + (venue ? ' — for ' + venue.name : ''));
    push('');
    for (const p of r.parts) {
      push('**' + p.label + '** — ' + p.chars + (p.limit ? ' / ' + p.limit : '') + (p.countMode && p.countMode !== 'chars' ? ' ' + p.countMode : ' chars'));
      push('');
      push('```text');
      push(p.text);
      push('```');
      push('');
    }
    const notes = r.errors.map((e) => 'ERROR ' + e.rule + ': ' + e.msg).concat(r.warnings.map((w) => 'note ' + w.rule + ': ' + w.msg));
    if (notes.length) { for (const n of notes) push('- ' + n); push(''); }
  }
  return lines.join('\n');
}

/* ---------------------------------------------------------------- kit */

async function withBrowser(opts, fn) {
  let browser = opts.browser;
  const own = !browser;
  if (own) {
    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--font-render-hinting=none', '--disable-gpu'] });
  }
  try {
    const page = await browser.newPage();
    try { return await fn(page); } finally { await page.close().catch(() => {}); }
  } finally {
    if (own) await browser.close();
  }
}

function qrPair(rec) {
  return { story: qrSvg(T.utmUrl(rec.path, 'instagram-story', 'social'), 250), carousel: qrSvg(T.utmUrl(rec.path, 'kit-carousel', 'social'), 380) };
}

/** opts.theme ('midnight' | 'daylight' | 'both') from the first API -> palette override + extra palettes. */
function themeOpts(opts) {
  const t = String(opts.theme || '').toLowerCase();
  const out = { palette: opts.palette, extra: Array.isArray(opts.palettes) ? opts.palettes.filter((p) => PAL.IDS.includes(p)) : [] };
  if (t === 'midnight' || t === 'daylight') out.palette = out.palette || t;
  if (t === 'both' || t === 'all') { out.palette = out.palette || 'midnight'; if (!out.extra.includes('daylight')) out.extra.push('daylight'); }
  return out;
}

/**
 * opts: seed (reproducible look), layout, palette, type, copy (overrides),
 * theme (first API: 'midnight' | 'daylight' | 'both'), palettes (extra palettes),
 * record (false: do not write kits/history.json), capture (false = disk only),
 * browser (a puppeteer Browser to reuse), story (override), example (a
 * normalised example to draw instead of capturing; tests and previews).
 */
/* Another site (site.js): the profile's story, no live capture (the example
   capture drives 1234Tools pages only, so the kit draws its "how it works"
   schematic), and the palette whose accent is nearest the brand's colour. */
function hueOf(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16); const r = (n >> 16) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
  if (!d) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function brandPalette(site) {
  const want = hueOf(site && site.colours && site.colours.primary);
  if (want == null) return undefined;
  let best = null;
  for (const id of PAL.IDS) {
    const h = hueOf(PAL.PALETTES[id].accent);
    if (h == null) continue;
    const dist = Math.min(Math.abs(h - want), 360 - Math.abs(h - want));
    if (!best || dist < best.dist) best = { id, dist };
  }
  return best ? best.id : undefined;
}
function forSite(opts, rec) {
  const S = require('./site');
  if (S.isDefault()) return opts;
  const o = Object.assign({ capture: false }, opts);
  if (!o.story) o.story = rec.story;
  if (!o.palette && !o.theme) o.palette = brandPalette(S.current());
  return o;
}

async function kit(toolPath, opts) {
  const rec = T.record(toolPath);
  opts = forSite(opts || {}, rec);
  const story = Object.assign({}, opts.story || require('./stories').storyFor(rec.path));
  const th = themeOpts(opts);
  const dir = path.join(kitsDir(), kitSlug(rec));
  fs.mkdirSync(dir, { recursive: true });
  // a kit is one look: clear the images of the previous one
  for (const f of fs.readdirSync(dir)) if (KIT_FILE.test(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* in use */ } }
  const exInfo = opts.example ? { ex: opts.example, how: opts.exampleHow || 'supplied by the caller' } : await getExample(rec, story, opts);
  story._exKind = exInfo.ex.kind;
  const chosen = VAR.choose(rec.path, Object.assign({}, opts, { palette: th.palette }), L.home());
  const v = chosen.variant;
  const extra = th.extra.filter((p) => p !== v.palette);
  const fitList = V.fit(rec.path);
  const qrs = qrPair(rec);
  const files = [];
  const fit = { overflow: [], clamped: [], clipped: [] };
  const ctx = makeCtx(rec, story, exInfo.ex, v, chosen.n, qrs);
  await withBrowser(opts, async (page) => {
    await renderLook(page, dir, ctx, files, fit, null);
    for (const p of extra) {
      // the same look in another palette; a pruned pairing (an outline on cream) takes the marker instead
      const v2 = Object.assign({}, v, { palette: p });
      if (VAR.pruned(v2)) v2.type = 'marker';
      await renderLook(page, dir, Object.assign({}, ctx, { v: v2 }), files, fit, p);
    }
  });
  const qrInfo = [Object.assign({ label: 'Story' }, qrs.story.info), Object.assign({ label: 'Carousel slide 5' }, qrs.carousel.info)];
  // captions open with the image's hook, unless that hook is the pain's own first sentence (it would be said twice)
  const capHook = String(story.pain || '').startsWith(ctx.c.hook) ? story.hook : ctx.c.hook;
  const capStory = Object.assign({}, story, { hook: capHook, cta: ctx.c.cta });
  const caps = captions(rec, capStory);
  const md = buildMarkdown(rec, story, exInfo, fitList, dir, qrInfo, fit, caps, { variant: v, how: chosen.how, copy: ctx.c, extra });
  fs.writeFileSync(path.join(dir, 'kit.md'), md);
  files.unshift({ path: path.join(dir, 'kit.md'), file: 'kit.md', bytes: Buffer.byteLength(md) });
  delete story._exKind;
  return {
    tool: rec.path, slug: kitSlug(rec), dir, files, variant: v, n: chosen.n, how: chosen.how, palettes: [v.palette].concat(extra),
    themes: [v.palette].concat(extra), qr: qrs.story.info, qrs: qrInfo,
    story: { source: story.source, shard: story.shard, hook: story.hook }, copy: { hook: ctx.c.hook, cta: ctx.c.cta },
    example: { kind: exInfo.ex.kind, real: !!exInfo.ex.real, how: exInfo.how },
    fit, captions: caps.map((c) => ({ id: c.id, count: c.count, limit: c.limit || 0, errors: c.errors.length })),
  };
}

/**
 * Alternative looks for the thumbnail strip: n square previews (PNG data URLs)
 * from consecutive seeds, never recorded in history. opts: seed, n, scale,
 * layout/palette/type (fixed fields), browser, capture (default false: use the
 * example already on disk, else the schematic).
 */
async function looks(toolPath, opts) {
  const rec = T.record(toolPath);
  opts = require('./site').isDefault() ? (opts || {}) : Object.assign({ capture: false, story: rec.story }, opts || {});
  const story = Object.assign({}, opts.story || require('./stories').storyFor(rec.path));
  const exInfo = opts.example ? { ex: opts.example, how: 'supplied' } : await getExample(rec, story, Object.assign({ capture: false }, opts));
  const seed = opts.seed != null && opts.seed !== '' ? +opts.seed >>> 0 : (Math.random() * 4294967295) >>> 0;
  const vs = VAR.alternatives(rec.path, seed, opts.n || 6).map((v) => VAR.applyOverrides(v, opts));
  const qrs = qrPair(rec);
  const fmt = opts.format && LAY.FORMATS[opts.format] && opts.format !== 'carousel' ? opts.format : 'square';
  const out = [];
  await withBrowser(opts, async (page) => {
    for (const v of vs) {
      const ctx = makeCtx(rec, story, exInfo.ex, v, 1, qrs);
      const rep = await layoutFormat(page, fmt, ctx, opts.scale || 0.3);
      const f = LAY.FORMATS[fmt];
      const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: f.w, height: f.h } });
      out.push({ variant: v, overflow: rep.overflow, png: 'data:image/png;base64,' + buf.toString('base64'),
        label: VAR.LAYOUT_LABELS[v.layout] + ' · ' + PAL.PALETTES[v.palette].label + ' · ' + VAR.TYPE_LABELS[v.type] });
    }
  });
  return { tool: rec.path, seed, format: fmt, example: exInfo.ex.kind, looks: out };
}

/** Kits already on disk. */
function list() {
  const d = kitsDir();
  let names = [];
  try { names = fs.readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name); } catch (e) { return []; }
  return names.map((n) => {
    const dir = path.join(d, n);
    let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { files = []; }
    let at = null;
    try { at = fs.statSync(path.join(dir, 'kit.md')).mtime.toISOString(); } catch (e) { at = null; }
    let title = n;
    try { title = (fs.readFileSync(path.join(dir, 'kit.md'), 'utf8').match(/^# Launch kit: (.+)$/m) || [, n])[1]; } catch (e) { /* keep slug */ }
    let look = '';
    try { look = (fs.readFileSync(path.join(dir, 'kit.md'), 'utf8').match(/^- \*\*Variant:\*\* (.+)$/m) || [, ''])[1].replace(/`/g, ''); } catch (e) { /* none */ }
    return { slug: n, title, dir, files: files.filter((f) => f !== 'history.json'), look, at };
  }).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** The choices the Kits tab offers. */
function options() {
  return {
    layouts: VAR.LAYOUTS.map((id) => ({ id, label: VAR.LAYOUT_LABELS[id] })),
    palettes: PAL.IDS.map((id) => ({ id, label: PAL.PALETTES[id].label, light: PAL.PALETTES[id].light, swatch: [PAL.PALETTES[id].bg, PAL.PALETTES[id].grad[1], PAL.PALETTES[id].field] })),
    types: VAR.TYPES.map((id) => ({ id, label: VAR.TYPE_LABELS[id] })),
  };
}

module.exports = {
  kit, looks, list, options, renderHtml, layoutFormat, makeCtx, qrPair, getExample, setExamples, normaliseCaptured, schematic, captions,
  pngSize, imageMeta, pdfPages, kitSlug, kitsDir, examplesDir, themed,
  SIZES, CAROUSEL, PDF, THEMES: S.THEMES, THEME_IDS, pills, glyphSvg, qrSvg,
};
