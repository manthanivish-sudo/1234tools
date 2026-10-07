#!/usr/bin/env node
/**
 * Engine suite — pdffont.js (TrueType subsetting, Type0/CIDFontType2
 * embedding, ToUnicode) and engine/pdf-shaper.js (HarfBuzz shaping).
 *
 * Every assertion about a written PDF or font is checked by a reader that
 * shares no code with the module:
 *   - fontTools (Python) for parse() results and for the subset fonts, which
 *     it must load with strict table checksums and whose outlines must match
 *     the original font's glyph for glyph;
 *   - pdf.js (engine/vendor/pdfjs, in Node) for text extraction, with its
 *     console captured to show it raised no font warnings;
 *   - MuPDF (PyMuPDF) for text extraction, its warning log, ink where the
 *     text is drawn, and pixel-identical rendering against the same page
 *     embedded with the whole, unsubsetted font.
 *
 * Text comparison: each reader's output is split into lines (pdf.js: item
 * strings joined with nothing, a line ending at each hasEOL; MuPDF: its
 * newlines). Each line is trimmed and runs of whitespace become one space;
 * empty lines are dropped. Nothing else is normalised — no Unicode
 * normalisation, no reordering — so each line must equal its source exactly.
 *
 * Needs: Python with pymupdf and fontTools.
 * Run:   node build/pdf-package/tests/test_pdffont.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

/* ---------- locating things ---------- */

function findFile(rels, what) {
  for (const rel of rels) {
    const p = path.join(__dirname, rel);
    if (fs.existsSync(p)) return p;
  }
  console.error(`Cannot find ${what}. Looked for:\n  ` +
    rels.map(r => path.join(__dirname, r)).join('\n  '));
  process.exit(2);
}

const CORE_PATH = findFile(['../engine/pdfcore.js', './pdfcore.js', '../pdfcore.js'], 'pdfcore.js');
const FONT_PATH = findFile(['../engine/pdffont.js', './pdffont.js', '../pdffont.js'], 'pdffont.js');
const core = require(CORE_PATH);
const { PDFFont } = require(FONT_PATH);
const { PDFWriter, Name, Ref, PDFStream, bytesOf, contentEscape } = core;

const REPO = path.resolve(__dirname, '../../..');
const ENGINE = path.join(REPO, 'engine');
const SHAPER_PATH = path.join(ENGINE, 'pdf-shaper.js');
const MVRShaper = require(SHAPER_PATH);
const FONTS_DIR = path.join(ENGINE, 'vendor/fonts');
const PDFJS_DIR = path.join(ENGINE, 'vendor/pdfjs');
const OUTPUT = path.join(__dirname, 'output');
const PYTHON = process.env.PYTHON || 'python';
const DEPS = { Name, Ref, PDFStream };

/* ---------- assertions ---------- */

let pass = 0, failCount = 0, group = '';
const failures = [];

function G(name) { group = name; console.log(`\n${name}`); }

function check(cond, what, detail) {
  if (cond) { pass++; console.log(`  ok    ${what}`); }
  else {
    failCount++; failures.push(`${group} → ${what}${detail ? '  (' + detail + ')' : ''}`);
    console.log(`  FAIL  ${what}${detail ? '  → ' + detail : ''}`);
  }
}
const eq = (a, b, what) => check(a === b, what, a === b ? '' : `got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const deep = (a, b, what) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  check(A === B, what, A === B ? '' : `got ${A}, expected ${B}`);
};
const esc = (s) => JSON.stringify(s).replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

/* ---------- the independent readers ---------- */

const PY = String.raw`
import sys, json, io
cmd = json.loads(sys.stdin.read())
op = cmd['op']
out = {}

def glyph_coords(f, gid):
    order = f.getGlyphOrder()
    g = f['glyf'][order[gid]]
    if g.numberOfContours == 0:
        return None
    c, ends, flags = g.getCoordinates(f['glyf'])
    return [list(map(list, c)), list(ends), list(flags)]

if op == 'fontinfo':
    from fontTools.ttLib import TTFont
    f = TTFont(cmd['path'])
    cm = f.getBestCmap()
    order = f.getGlyphOrder()
    rev = {n: i for i, n in enumerate(order)}
    out['unitsPerEm'] = f['head'].unitsPerEm
    out['numGlyphs'] = f['maxp'].numGlyphs
    out['bbox'] = [f['head'].xMin, f['head'].yMin, f['head'].xMax, f['head'].yMax]
    out['ascent'] = f['hhea'].ascent
    out['descent'] = f['hhea'].descent
    out['capHeight'] = getattr(f['OS/2'], 'sCapHeight', 0)
    out['italicAngle'] = f['post'].italicAngle
    out['postScriptName'] = f['name'].getDebugName(6)
    out['gid'] = {str(cp): rev[cm[cp]] if cp in cm else 0 for cp in cmd.get('cps', [])}
    out['advance'] = {str(g): f['hmtx'][order[g]][0] for g in cmd.get('gids', [])}
    out['name'] = {str(g): order[g] for g in cmd.get('names', [])}
    out['cmapAll'] = sorted(cm.keys()) if cmd.get('cmapAll') else None

elif op == 'checksubset':
    from fontTools.ttLib import TTFont
    data = open(cmd['path'], 'rb').read()
    try:
        f = TTFont(io.BytesIO(data), checkChecksums=2)
        f['glyf']; f['hmtx']; f['loca']
        out['loads'] = True
    except Exception as e:
        out['loads'] = False
        out['error'] = repr(e)
        print(json.dumps(out)); sys.exit(0)
    padded = data + b'\0' * ((4 - len(data) % 4) % 4)
    tot = 0
    for i in range(0, len(padded), 4):
        tot = (tot + int.from_bytes(padded[i:i+4], 'big')) & 0xffffffff
    out['fileChecksum'] = tot
    out['tables'] = sorted(t for t in f.keys() if t != 'GlyphOrder')
    out['numGlyphs'] = f['maxp'].numGlyphs
    out['postFormat'] = f['post'].formatType
    orig = TTFont(cmd['orig'])
    bad = []
    order = f.getGlyphOrder()
    for i, s in enumerate(cmd['slots']):
        try:
            mine = glyph_coords(f, i)
        except Exception as e:
            bad.append([i, s, 'unreadable: ' + repr(e)[:80]])
            continue
        if s < 0:
            if mine is not None: bad.append([i, s, 'should be empty'])
            continue
        if mine != glyph_coords(orig, s): bad.append([i, s, 'outline differs'])
        if f['hmtx'][order[i]][0] != orig['hmtx'][orig.getGlyphOrder()[s]][0]: bad.append([i, s, 'advance differs'])
    out['bad'] = bad[:10]
    out['badCount'] = len(bad)

elif op == 'pdf':
    import pymupdf
    pymupdf.TOOLS.mupdf_warnings()        # clear
    d = pymupdf.open(cmd['path'])
    out['repaired'] = bool(d.is_repaired)
    pages = []
    for i, p in enumerate(d):
        fonts = [[x[1], x[2], x[3], x[5]] for x in p.get_fonts(full=True)]
        pages.append({'text': p.get_text(), 'fonts': fonts})
    ink = []
    for r in cmd.get('rects', []):
        p = d[r[0]]
        pix = p.get_pixmap(dpi=cmd.get('dpi', 100), clip=pymupdf.Rect(r[1], r[2], r[3], r[4]), colorspace=pymupdf.csGRAY)
        s = pix.samples
        ink.append(sum(1 for b in s if b < 128))
    out['pages'] = pages
    out['ink'] = ink
    out['warnings'] = pymupdf.TOOLS.mupdf_warnings()

elif op == 'samepixels':
    import pymupdf
    a = pymupdf.open(cmd['a']); b = pymupdf.open(cmd['b'])
    res = []
    for i in range(len(a)):
        pa = a[i].get_pixmap(dpi=cmd.get('dpi', 150)); pb = b[i].get_pixmap(dpi=cmd.get('dpi', 150))
        sa, sb = pa.samples, pb.samples
        diff = sum(1 for x, y in zip(sa, sb) if x != y) if len(sa) == len(sb) else -1
        ink = sum(1 for x in sa if x < 128)
        res.append({'diff': diff, 'ink': ink})
    out['pages'] = res

print(json.dumps(out))
`;

function py(cmd) {
  const r = spawnSync(PYTHON, ['-c', PY], {
    input: JSON.stringify(cmd), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
  });
  if (r.status !== 0) throw new Error('python failed: ' + (r.stderr || r.error));
  return JSON.parse(r.stdout);
}

let pdfjs = null;
async function pdfjsText(bytes) {
  if (!pdfjs) {
    pdfjs = await import(pathToFileURL(path.join(PDFJS_DIR, 'pdf.min.mjs')).href);
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(PDFJS_DIR, 'pdf.worker.min.mjs')).href;
  }
  // Capture whatever pdf.js prints: its warnings go to the console.
  const logged = [];
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const k of Object.keys(saved)) console[k] = (...a) => logged.push(a.map(String).join(' '));
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 5 }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      await page.getOperatorList();            // translates the fonts fully
      pages.push(tc.items);
    }
    await doc.destroy();
    return { pages, logged };
  } finally {
    Object.assign(console, saved);
  }
}

const normLines = (lines) => lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
function pdfjsLines(items) {
  const lines = [''];
  for (const it of items) {
    lines[lines.length - 1] += it.str;
    if (it.hasEOL) lines.push('');
  }
  return normLines(lines);
}
const mupdfLines = (text) => normLines(text.split('\n'));

/* ---------- building test documents ---------- */

const loadFont = (file) => {
  const bytes = new Uint8Array(fs.readFileSync(path.join(FONTS_DIR, file)));
  return { file, bytes, font: PDFFont.parse(bytes) };
};

/**
 * pages: [{ lines: [{ runs: [{ text, f }], size, x, y }] }]; fonts: { F1: loaded font }.
 * Devanagari runs are shaped with HarfBuzz, the rest with shapeSimple.
 */
function buildDoc(pages, fonts, shaper, opts) {
  const o = opts || {};
  const w = new PDFWriter();
  const cat = w.alloc(), pagesNum = w.alloc();
  const regs = {}, refs = {};
  for (const k of Object.keys(fonts)) { regs[k] = PDFFont.createRegistry(fonts[k].font); refs[k] = w.alloc(); }
  const kids = [], placed = [];
  const H = 842;
  pages.forEach((pg, pi) => {
    let cs = '';
    const used = new Set();
    for (const ln of pg.lines) {
      let x = ln.x, width = 0;
      cs += `BT\n1 0 0 1 ${ln.x} ${ln.y} Tm\n`;
      for (const run of ln.runs) {
        const F = fonts[run.f];
        used.add(run.f);
        const glyphs = PDFFont.scriptOf(run.text) === 'devanagari'
          ? PDFFont.fromShaper(F.font, run.text, shaper.shape(F.bytes, run.text))
          : PDFFont.shapeSimple(F.font, run.text);
        cs += `/${run.f} ${ln.size} Tf\n` + PDFFont.showGlyphs(regs[run.f], glyphs, ln.size);
        for (const g of glyphs) width += g.adv * ln.size / F.font.unitsPerEm;
      }
      cs += 'ET\n';
      placed.push({ page: pi, text: ln.runs.map((r) => r.text).join(''), rect: [x, H - ln.y - ln.size * 0.95, x + width, H - ln.y + ln.size * 0.4] });
    }
    const content = w.add(new PDFStream(Object.create(null), bytesOf(cs)));
    const fd = {};
    used.forEach((k) => { fd[k] = new Ref(refs[k]); });
    const page = w.add({ Type: new Name('Page'), Parent: new Ref(pagesNum), MediaBox: [0, 0, 595, H],
      Resources: { Font: fd }, Contents: new Ref(content) });
    kids.push(new Ref(page));
  });
  for (const k of Object.keys(fonts)) {
    PDFFont.embedType0(w, DEPS, { font: fonts[k].font, registry: regs[k], ref: refs[k], subset: o.subset });
  }
  w.set(pagesNum, { Type: new Name('Pages'), Kids: kids, Count: kids.length });
  w.set(cat, { Type: new Name('Catalog'), Pages: new Ref(pagesNum) });
  return { bytes: w.build(new Ref(cat), null, '1.7'), placed, regs };
}

/* ---------- the samples ---------- */

// Line spacing that fits n lines between y = 800 and y = 40.
const epsilonSpacing = (n) => Math.min(36, Math.floor(760 / Math.max(1, n - 1)));

const LATIN = [
  { text: 'Zażółć gęślą jaźń — ŁĄŻ łąż', f: 'F1' },
  { text: 'Ελληνικά: Καλημέρα κόσμε, Ωμέγα', f: 'F1' },
  { text: 'Русский: Съешь же ещё этих булок', f: 'F1' },
  { text: 'Price ₹1,250.00 or €10 “quoted” — £5', f: 'F1' },
  { text: 'Combining: café mañana', f: 'F1' },
  { text: 'Soft co­operate, zero​width, end­', f: 'F1' },
  { text: 'Bold ŁĄŻ Ωμέγα Жж ₹99', f: 'F2' }
];
const HINDI = [
  { text: 'हिन्दी में परीक्षण', f: 'F3' },
  { text: 'क्षत्रिय', f: 'F3' },
  { text: 'र्क', f: 'F3' },
  { text: 'कि', f: 'F3' },
  { text: 'ड़', f: 'F3' },         // ड + nukta, decomposed
  { text: 'ड़', f: 'F3' },               // ड़ precomposed
  { text: 'प्रश्न कुछ के स्त्री', f: 'F3' },
  { text: 'र्कि और धर्म', f: 'F3' },
  { text: '\u0915\u094D\u200D\u0937 \u0939\u093F\u200C\u0928\u094D\u0926\u0940', f: 'F3' },   // ZWJ in a conjunct, ZWNJ breaking one
  { text: 'Rupee ₹500 नमस्ते', f: 'F3' },
  { text: 'हिन्दी में परीक्षण', f: 'F4' },
  // a wider corpus: chandrabindu, ऋ/ृ, nukta letters, Om, digits, danda,
  // triple conjuncts, reph over a conjunct, ra-forms below and after
  { text: 'भारत एक विशाल देश है। यहाँ अनेक भाषाएँ बोली जाती हैं।', f: 'F3' },
  { text: 'श्रीमान्, कृपया ध्यान दें: द्वितीय ज्ञान त्र्यम्बक', f: 'F3' },
  { text: 'उज्ज्वल स्वास्थ्य अर्थव्यवस्था ट्रक ड्रम हृदय ऋषि', f: 'F3' },
  { text: 'क़लम ज़रूरी फ़िल्म ॐ १२३४५६७८९० ₹१०० रु॰ कार्त्तिक', f: 'F3' },
  { text: 'श्रीमान्, कृपया ध्यान दें: द्वितीय ज्ञान त्र्यम्बक', f: 'F4' },
  { text: 'उज्ज्वल स्वास्थ्य अर्थव्यवस्था ट्रक ड्रम हृदय ऋषि', f: 'F4' }
];

(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const NS = loadFont('NotoSans-Regular.ttf'), NSB = loadFont('NotoSans-Bold.ttf');
  const NSD = loadFont('NotoSansDevanagari-Regular.ttf'), NSDB = loadFont('NotoSansDevanagari-Bold.ttf');

  /* ---------------------------------------------------------------- */
  G('Module shape (it is concatenated into the browser bundle)');
  {
    const src = fs.readFileSync(FONT_PATH, 'utf8');
    const tailAt = src.indexOf("\nif (typeof module !== 'undefined' && module.exports) {");
    check(tailAt > 0, 'the export block begins with the exact line the bundler strips from');
    const body = src.slice(0, tailAt);
    const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').trim();
    check(code.startsWith('const PDFFont = (function () {') && code.endsWith('})();'),
      'everything before it is the single declaration const PDFFont = (function () { … })();');
    check(!/\brequire\s*\(/.test(body), 'no require() inside the module');
    {
      // pdffont alone in a bare context, where pdfcore's names do not exist:
      // embedding still works when the classes arrive through deps.
      const ctx = vm.createContext({ __fontBytes: NS.bytes, __deps: DEPS, __W: new PDFWriter(), Uint8Array, Uint16Array, Uint32Array, Int16Array, Map, Set, Math, Object, Array, String, Number, Error });
      let err = null, ok = false;
      try {
        vm.runInContext(body + '\n;(function () { const f = PDFFont.parse(__fontBytes); const reg = PDFFont.createRegistry(f);' +
          ' PDFFont.showGlyphs(reg, PDFFont.shapeSimple(f, "Ωμέγα"), 12);' +
          ' globalThis.__ok = PDFFont.embedType0(__W, __deps, { font: f, registry: reg }) instanceof __deps.Ref; })();', ctx);
        ok = ctx.__ok === true;
      } catch (e) { err = e; }
      check(ok, "pdffont alone, with no pdfcore names in scope, embeds through the deps argument", err ? String(err) : '');
    }

    // Simulate the bundle: pdfcore + pdffont, each without its export block,
    // run in a bare context with no module, require or process.
    const strip = (s) => s.slice(0, s.indexOf("\nif (typeof module !== 'undefined' && module.exports) {"));
    const bundle = strip(fs.readFileSync(CORE_PATH, 'utf8')) + '\n' + strip(src) +
      '\n;globalThis.__out = (function () {' +
      ' const f = PDFFont.parse(__fontBytes); const reg = PDFFont.createRegistry(f);' +
      ' const ops = PDFFont.showGlyphs(reg, PDFFont.shapeSimple(f, "Łódź"), 12);' +
      ' const w = new PDFWriter(); const r = PDFFont.embedType0(w, { Name, Ref, PDFStream }, { font: f, registry: reg });' +
      ' return { ops, ref: r instanceof Ref, n: w.objects.length }; })();';
    const ctx = vm.createContext({ __fontBytes: NS.bytes, Uint8Array, Uint16Array, Uint32Array, Int16Array, Map, Set, Math, Object, Array, String, Number, Error, JSON });
    let res = null, err = null;
    try { vm.runInContext(bundle, ctx); res = ctx.__out; } catch (e) { err = e; }
    check(!err && res && res.ref && res.n > 5 && /Tj|TJ/.test(res.ops),
      'pdfcore + pdffont concatenated run in a bare context and embed a font', err ? String(err) : '');
  }

  /* ---------------------------------------------------------------- */
  G('parse() against fontTools');
  for (const F of [NS, NSD]) {
    const cps = [0x41, 0x61, 0x141, 0x3a9, 0x416, 0x20b9, 0x915, 0x93f, 0x20ac, 0x4e00, 0x1f600];
    const mine = cps.map((c) => F.font.glyphForCodePoint(c));
    const ref = py({ op: 'fontinfo', path: path.join(FONTS_DIR, F.file), cps, gids: mine.filter((g) => g) });
    eq(F.font.unitsPerEm, ref.unitsPerEm, `${F.file}: unitsPerEm ${ref.unitsPerEm}`);
    eq(F.font.numGlyphs, ref.numGlyphs, `${F.file}: numGlyphs ${ref.numGlyphs}`);
    deep(F.font.bbox, ref.bbox, `${F.file}: bounding box`);
    eq(F.font.ascent, ref.ascent, `${F.file}: ascent (hhea)`);
    eq(F.font.descent, ref.descent, `${F.file}: descent (hhea)`);
    eq(F.font.capHeight, ref.capHeight, `${F.file}: cap height (OS/2)`);
    eq(F.font.italicAngle, ref.italicAngle, `${F.file}: italic angle`);
    eq(F.font.postScriptName, ref.postScriptName, `${F.file}: PostScript name`);
    deep(cps.map((c, i) => mine[i]), cps.map((c) => ref.gid[c]), `${F.file}: cmap lookups for ${cps.length} code points (incl. missing ones → 0)`);
    deep(mine.filter((g) => g).map((g) => F.font.advance(g)), mine.filter((g) => g).map((g) => ref.advance[g]), `${F.file}: advances`);
  }
  {
    // the format 12 path: every code point fontTools knows maps the same way
    const ref = py({ op: 'fontinfo', path: path.join(FONTS_DIR, NSD.file), cmapAll: true, cps: [] });
    const all = ref.cmapAll;
    const ref2 = py({ op: 'fontinfo', path: path.join(FONTS_DIR, NSD.file), cps: all });
    const bad = all.filter((c) => NSD.font.glyphForCodePoint(c) !== ref2.gid[c]);
    check(!bad.length, `NotoSansDevanagari: all ${all.length} cmap entries agree with fontTools`, bad.slice(0, 5).join(','));
  }

  /* ---------------------------------------------------------------- */
  G('subset() and subsetCompact() against fontTools');
  const sizeReport = [];
  {
    const cases = [
      { F: NS, text: 'The quick brown fox.' },          // 20 characters
      { F: NS, text: 'ŁĄŻ Ωμέγα Жж ₹ é ǅ ẞ' },
      { F: NSD, text: 'हिन्दी में परीक्षण', shaped: true }
    ];
    const shaper = await MVRShaper.load(ENGINE);
    for (const c of cases) {
      const gids = c.shaped
        ? shaper.shape(c.F.bytes, c.text).map((g) => g.g)
        : PDFFont.shapeSimple(c.F.font, c.text).map((g) => g.gid);
      const keep = PDFFont.closure(c.F.font, gids);
      const ids = PDFFont.subset(c.F.font, gids);
      const compact = PDFFont.subsetCompact(c.F.font, gids);
      const tag = c.text.length + ' chars of ' + c.F.file;
      // glyph ids kept: slot g holds glyph g, unused slots empty
      let maxG = 0; keep.forEach((g) => { if (g > maxG) maxG = g; });
      const slots = [];
      for (let g = 0; g <= maxG; g++) slots.push(keep.has(g) ? g : -1);
      const p1 = path.join(OUTPUT, 'pdffont-subset-ids.ttf');
      fs.writeFileSync(p1, ids);
      const r1 = py({ op: 'checksubset', path: p1, orig: path.join(FONTS_DIR, c.F.file), slots });
      check(r1.loads, `${tag}: id-preserving subset loads in fontTools with strict checksums`, r1.error);
      if (r1.loads) {
        eq(r1.fileChecksum, 0xb1b0afba, `${tag}: id-preserving subset: whole-file checksum is 0xB1B0AFBA (checkSumAdjustment right)`);
        check(r1.badCount === 0, `${tag}: id-preserving subset: ${slots.filter((s) => s >= 0).length} glyphs match the original outline and advance at the same id, the rest are empty`, JSON.stringify(r1.bad));
        check(!r1.tables.some((t) => ['cmap', 'name', 'GSUB', 'GPOS', 'GDEF'].includes(t)) && ['head', 'hhea', 'maxp', 'loca', 'glyf', 'hmtx', 'post'].every((t) => r1.tables.includes(t)),
          `${tag}: tables are ${r1.tables.join(' ')}`);
        eq(r1.postFormat, 3, `${tag}: post is format 3`);
      }
      const order = Array.from(keep).sort((a, b) => a - b);
      const p2 = path.join(OUTPUT, 'pdffont-subset-compact.ttf');
      fs.writeFileSync(p2, compact.bytes);
      const r2 = py({ op: 'checksubset', path: p2, orig: path.join(FONTS_DIR, c.F.file), slots: order });
      check(r2.loads, `${tag}: compact subset loads in fontTools with strict checksums`, r2.error);
      if (r2.loads) {
        eq(r2.fileChecksum, 0xb1b0afba, `${tag}: compact subset: whole-file checksum is 0xB1B0AFBA`);
        check(r2.badCount === 0, `${tag}: compact subset: all ${order.length} renumbered glyphs (composites resolved through their rewritten references) match the original outlines`, JSON.stringify(r2.bad));
      }
      const composites = order.filter((g) => {
        const s = c.F.font.tables.glyf.offset + c.F.font.loca[g];
        return c.F.font.loca[g + 1] - c.F.font.loca[g] >= 10 && (c.F.font.bytes[s] & 0x80);
      }).length;
      sizeReport.push(`${c.F.file} "${c.text}": ${keep.size} glyphs (${composites} composite) — compact ${compact.bytes.length} B, ids kept ${ids.length} B, full font ${c.F.bytes.length} B`);
    }
    check(sizeReport.length === 3, 'subset sizes recorded');
  }

  /* ---------------------------------------------------------------- */
  G('HarfBuzz shaping (engine/pdf-shaper.js), checked against the font\'s own glyph names via fontTools');
  const shaper = await MVRShaper.load(ENGINE);
  check(/^\d+\.\d+\.\d+$/.test(shaper.version), `HarfBuzz ${shaper.version} loaded from engine/vendor/harfbuzz/harfbuzz.wasm`);
  const names = (F, text) => {
    const gl = shaper.shape(F.bytes, text);
    const ref = py({ op: 'fontinfo', path: path.join(FONTS_DIR, F.file), names: gl.map((g) => g.g) });
    return { gl, names: gl.map((g) => ref.name[g.g]), hb: gl.map((g) => shaper.glyphName(F.bytes, g.g)) };
  };
  {
    const ki = names(NSD, 'कि');
    deep(ki.hb, ki.names, 'HarfBuzz glyph names agree with the post table read by fontTools');
    check(ki.names.length === 2 && /^uni093F/.test(ki.names[0]) && ki.names[1] === 'uni0915',
      'कि: the i-matra glyph comes first, then क', ki.names.join(' '));
    deep(ki.gl.map((g) => g.cl), [0, 0], 'कि: both glyphs belong to cluster 0');
    const ksa = names(NSD, 'क्ष');
    deep(ksa.names, ['uni0915094D0937'], 'क्ष: one conjunct glyph (uni0915094D0937)');
    const rk = names(NSD, 'र्क');
    check(rk.names.length === 2 && rk.names[0] === 'uni0915' && /^uni0930094D/.test(rk.names[1]),
      'र्क: क then the reph glyph above it', rk.names.join(' '));
    check(rk.gl[1].ax === 0 && rk.gl[1].dx !== 0, 'र्क: the reph has no advance and an x offset', JSON.stringify(rk.gl[1]));
    const nk = names(NSD, 'ड़');
    deep(nk.names, ['uni095C'], 'ड + nukta: composed to the ड़ glyph');
    const ksh = names(NSD, 'क्षत्रिय');
    check(ksh.names.length === 4 && ksh.names[0] === 'uni0915094D0937' && /^uni093F/.test(ksh.names[1]) && ksh.names[2] === 'uni0924094D0930',
      'क्षत्रिय: क्ष, then the i-matra before the त्र conjunct', ksh.names.join(' '));
    // mixed scripts: the Devanagari part shapes as it does alone
    const mixed = shaper.shape(NSD.bytes, 'Rupee नमस्ते').filter((g) => g.cl >= 6).map((g) => g.g);
    const alone = shaper.shape(NSD.bytes, 'नमस्ते').map((g) => g.g);
    deep(mixed, alone, 'Rupee नमस्ते: the Devanagari run shapes exactly as on its own (script itemisation)');
    const forced = shaper.shape(NSD.bytes, 'नमस्ते', { script: 'Latn' }).map((g) => g.g);
    check(JSON.stringify(forced) !== JSON.stringify(alone), 'shaping Devanagari as Latin gives different glyphs (so the itemisation matters)');
    const nokern = shaper.shape(NS.bytes, 'AVATAR', { features: ['-kern'] }).map((g) => g.ax);
    const kern = shaper.shape(NS.bytes, 'AVATAR').map((g) => g.ax);
    check(JSON.stringify(nokern) !== JSON.stringify(kern), 'features are applied (-kern changes the advances of AVATAR)');
    const surrogate = shaper.shape(NS.bytes, 'a\u{1F600}b');
    deep(surrogate.map((g) => g.cl), [0, 1, 3], 'clusters are UTF-16 indices (an astral character takes two)');
  }

  /* ---------------------------------------------------------------- */
  G('pdf-shaper.js as a classic script in a worker-like context (no module, no require)');
  {
    const wasm = fs.readFileSync(path.join(ENGINE, 'vendor/harfbuzz/harfbuzz.wasm'));
    const fetched = [];
    const ctx = {
      WebAssembly, URL, TextDecoder, Uint8Array, Uint16Array, Uint32Array, Int32Array, WeakMap, Promise, Math, Error, String, Object, Array,
      location: { href: 'http://localhost/tools/x/' },
      fetch: async (u) => { fetched.push(u); return { ok: true, arrayBuffer: async () => wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) }; },
      importScripts: () => {}
    };
    ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(SHAPER_PATH, 'utf8'), ctx);
    check(!!ctx.MVRShaper && typeof ctx.MVRShaper.load === 'function', 'attaches MVRShaper to self');
    const sh = await ctx.MVRShaper.load('/engine/');
    deep(fetched, ['http://localhost/engine/vendor/harfbuzz/harfbuzz.wasm'], 'fetches only vendor/harfbuzz/harfbuzz.wasm, from this site');
    const again = await ctx.MVRShaper.load('/engine/');
    check(sh === again && fetched.length === 1, 'the instance is cached: a second load() fetches nothing');
    deep(sh.shape(NSD.bytes, 'कि').map((g) => g.g), shaper.shape(NSD.bytes, 'कि').map((g) => g.g), 'shapes the same as in Node');
  }

  /* ---------------------------------------------------------------- */
  G('The written PDF, read by pdf.js and MuPDF');
  const fonts = { F1: NS, F2: NSB, F3: NSD, F4: NSDB };
  const mixedLine = { runs: [{ text: 'Name: ', f: 'F1' }, { text: 'राम ', f: 'F3' }, { text: 'Ωμέγα', f: 'F1' }], size: 14, x: 40, y: 760 };
  const spec = [
    { lines: LATIN.map((l, i) => ({ runs: [l], size: 16, x: 40, y: 780 - i * 32 })) },
    { lines: HINDI.map((l, i) => ({ runs: [l], size: 16, x: 40, y: 800 - i * epsilonSpacing(HINDI.length) })) },
    { lines: [mixedLine] }
  ];
  const expected = spec.map((pg) => pg.lines.map((ln) => ln.runs.map((r) => r.text).join('')));
  const built = buildDoc(spec, fonts, shaper);
  const file = path.join(OUTPUT, 'pdffont-unicode.pdf');
  fs.writeFileSync(file, built.bytes);
  console.log(`  (written to ${path.relative(REPO, file)}, ${built.bytes.length} bytes)`);

  const pj = await pdfjsText(built.bytes);
  check(pj.pages.length === 3, 'pdf.js opens it: 3 pages');
  const fontNoise = pj.logged.filter((l) => /warn|error|font|TT:|glyph|cmap/i.test(l));
  check(fontNoise.length === 0, 'pdf.js printed no warnings or font errors (verbosity: all)', fontNoise.slice(0, 3).join(' | '));
  for (let p = 0; p < 3; p++) {
    const got = pdfjsLines(pj.pages[p]);
    const want = normLines(expected[p]);
    for (let i = 0; i < want.length; i++) {
      // The one known loss: pdf.js skips any glyph whose string ends in a
      // format character, so a soft hyphen or ZWJ at the very end of a line
      // (with nothing after it to carry it) is not extracted. MuPDF keeps it.
      const trail = /\p{Cf}+$/u.test(want[i]);
      eq(got[i], want[i].replace(/\p{Cf}+$/u, ''), `pdf.js page ${p + 1} line ${i + 1}: ${esc(want[i]).slice(0, 60)}${trail ? ' (less the trailing format character)' : ''}`);
    }
    eq(got.length, want.length, `pdf.js page ${p + 1}: ${want.length} lines, no more`);
  }

  const mu = py({ op: 'pdf', path: file, rects: built.placed.map((pl) => [pl.page].concat(pl.rect)).concat([[0, 568, 10, 592, 832], [1, 568, 10, 592, 832]]) });
  check(!mu.repaired, 'MuPDF opens it without repairing');
  check(mu.warnings === '', 'MuPDF logged no warnings', mu.warnings);
  for (let p = 0; p < 3; p++) {
    const got = mupdfLines(mu.pages[p].text);
    const want = normLines(expected[p]);
    for (let i = 0; i < want.length; i++) {
      eq(got[i], want[i], `MuPDF page ${p + 1} line ${i + 1}: ${esc(want[i]).slice(0, 60)}`);
    }
    eq(got.length, want.length, `MuPDF page ${p + 1}: ${want.length} lines, no more`);
  }
  const fontsSeen = mu.pages.flatMap((pg) => pg.fonts);
  check(fontsSeen.length >= 4 && fontsSeen.every((f) => f[0] === 'ttf' && f[1] === 'Type0' && /^[A-Z]{6}\+Noto/.test(f[2]) && f[3] === 'Identity-H'),
    'MuPDF sees embedded Type0 TrueType fonts, Identity-H, with ABCDEF+ subset names', JSON.stringify(fontsSeen));
  const inks = mu.ink.slice(0, built.placed.length);
  const thin = built.placed.filter((pl, i) => inks[i] < 40);
  check(!thin.length, `MuPDF draws ink where each of the ${built.placed.length} lines is (min ${Math.min(...inks)} dark pixels at 100 dpi)`,
    thin.map((t) => esc(t.text)).join(', '));
  deep(mu.ink.slice(built.placed.length), [0, 0], 'and none in the empty right margin (control)');

  /* ---------------------------------------------------------------- */
  G('Subsetting loses nothing: MuPDF renders the subset and the whole font identically');
  {
    const full = buildDoc(spec, fonts, shaper, { subset: false });
    const ids = buildDoc(spec, fonts, shaper, { subset: 'ids' });
    const fFull = path.join(OUTPUT, 'pdffont-unicode-fullfont.pdf');
    const fIds = path.join(OUTPUT, 'pdffont-unicode-ids.pdf');
    fs.writeFileSync(fFull, full.bytes);
    fs.writeFileSync(fIds, ids.bytes);
    const a = py({ op: 'samepixels', a: file, b: fFull, dpi: 150 });
    a.pages.forEach((r, i) => check(r.diff === 0 && r.ink > 1000, `page ${i + 1}: compact subset vs whole font — ${r.diff} of the pixels differ (${r.ink} dark)`));
    const b = py({ op: 'samepixels', a: fIds, b: fFull, dpi: 150 });
    b.pages.forEach((r, i) => check(r.diff === 0, `page ${i + 1}: id-preserving subset vs whole font — ${r.diff} differ`));
    check(built.bytes.length * 10 < full.bytes.length, `the subset document is ${built.bytes.length} bytes against ${full.bytes.length} with whole fonts`);
    const pjFull = await pdfjsText(full.bytes);
    deep(pjFull.pages.map(pdfjsLines), pj.pages.map(pdfjsLines), 'pdf.js extracts the same text from the whole-font document');
  }

  /* ---------------------------------------------------------------- */
  G('The PDF structures');
  {
    const reg = PDFFont.createRegistry(NSD.font);
    const glyphs = PDFFont.fromShaper(NSD.font, 'क्ष', shaper.shape(NSD.bytes, 'क्ष'));
    const ops = PDFFont.showGlyphs(reg, glyphs, 12);
    const ent = reg.entries();
    const conj = ent.find((e) => e.gid === glyphs[0].gid);
    const carrier = ent.find((e) => e.gid === reg.blankGid && e.text);
    check(conj && conj.text === 'क' && carrier && carrier.text === '्ष' && carrier.width === 0,
      'क्ष: the conjunct glyph maps to क and a zero-width carrier to ्ष (no nonspacing mark on a spacing glyph)', JSON.stringify(ent));
    check(/^<00010002> Tj\n$/.test(ops), 'and is drawn as one Tj of two CIDs', ops);
    const W = PDFFont.widthsArray([{ cid: 1, width: 500 }, { cid: 2, width: 500 }, { cid: 3, width: 500 }, { cid: 4, width: 600 }, { cid: 5, width: 700 }, { cid: 9, width: 100 }]);
    deep(W, [1, 3, 500, 4, [600, 700], 9, [100]], '/W compresses equal runs to c1 c2 w and the rest to c [w …]');
    const cmap = PDFFont.toUnicodeCMap([{ cid: 1, text: 'A' }, { cid: 2, text: 'B' }, { cid: 3, text: 'C' }, { cid: 4, text: '\u{1F600}' }, { cid: 5, text: 'क्ष' }]);
    check(/<0001> <0003> <0041>/.test(cmap), 'ToUnicode: consecutive CIDs and characters become a bfrange');
    check(/<0004> <D83DDE00>/.test(cmap), 'ToUnicode: an astral character is a UTF-16BE surrogate pair');
    check(/<0005> <0915094D0937>/.test(cmap), 'ToUnicode: one CID can map to several characters');
    // the reph: offset glyph gets its own width so the pen never jumps right
    const r2 = PDFFont.createRegistry(NSD.font);
    const rk = PDFFont.fromShaper(NSD.font, 'र्क', shaper.shape(NSD.bytes, 'र्क'));
    const rops = PDFFont.showGlyphs(r2, rk, 10);
    const nums = (rops.match(/-?\d+(\.\d+)?(?=[ \]])/g) || []).map(Number).filter((n) => n < 0);
    check(/\[<\w+> 221 <\w+>\] TJ/.test(rops) && !nums.length, 'र्क: the reph is reached by a leftward TJ move and no rightward one follows', rops);
  }

  /* ---------------------------------------------------------------- */
  G('A cluster with more glyphs than characters (split vowels in other Indic scripts)');
  {
    // Two drawn glyphs standing for one character: the second has no text of
    // its own and maps to U+200B. pdf.js drops it; MuPDF keeps it (invisible).
    const g = (c) => NS.font.glyphForCodePoint(c.codePointAt(0));
    const reg = PDFFont.createRegistry(NS.font);
    const glyphs = [{ gid: g('a'), adv: NS.font.advance(g('a')), cl: 'q' }, { gid: g('b'), adv: NS.font.advance(g('b')), cl: '' }]
      .concat(PDFFont.shapeSimple(NS.font, ' next'));
    const w = new PDFWriter();
    const cat = w.alloc(), pagesN = w.alloc(), fN = w.alloc();
    const content = w.add(new PDFStream(Object.create(null), bytesOf('BT\n/F1 18 Tf\n1 0 0 1 40 780 Tm\n' + PDFFont.showGlyphs(reg, glyphs, 18) + 'ET\n')));
    PDFFont.embedType0(w, DEPS, { font: NS.font, registry: reg, ref: fN });
    const pg = w.add({ Type: new Name('Page'), Parent: new Ref(pagesN), MediaBox: [0, 0, 595, 842], Resources: { Font: { F1: new Ref(fN) } }, Contents: new Ref(content) });
    w.set(pagesN, { Type: new Name('Pages'), Kids: [new Ref(pg)], Count: 1 });
    w.set(cat, { Type: new Name('Catalog'), Pages: new Ref(pagesN) });
    const f = path.join(OUTPUT, 'pdffont-extra-glyph.pdf');
    fs.writeFileSync(f, w.build(new Ref(cat), null, '1.7'));
    const pj = await pdfjsText(fs.readFileSync(f));
    deep(pdfjsLines(pj.pages[0]), ['q next'], 'pdf.js: "q next"');
    deep(mupdfLines(py({ op: 'pdf', path: f }).pages[0].text), ['q​ next'], 'MuPDF: "q\\u200b next" (an invisible U+200B, not a control character)');
  }

  /* ---------------------------------------------------------------- */
  G('needsUnicode / scriptOf / pickFont / measure / wrap');
  {
    for (const [t, want] of [['Hello “quotes” – € café', false], ['minus − nbsp ', false], ['ŁĄŻ', true], ['₹', true], ['Ωμέγα', true], ['हिन्दी', true]]) {
      eq(PDFFont.needsUnicode(t), want, `needsUnicode(${esc(t)}) = ${want}`);
      if (!want) check(!contentEscape(t).includes('?'), `  and pdfcore's contentEscape shows ${esc(t)} without '?'`);
      else check(contentEscape(t).includes('?'), `  and pdfcore's contentEscape cannot show ${esc(t)}`);
    }
    for (const [t, want] of [['Hello', 'latin'], ['Ωμέγα Жж ₹', 'latin'], ['हिन्दी', 'devanagari'], ['Rupee ₹500 नमस्ते', 'devanagari'], ['中文', 'other'], ['مرحبا', 'other']]) {
      eq(PDFFont.scriptOf(t), want, `scriptOf(${esc(t)}) = ${want}`);
    }
    const nsdCmap = new Set(py({ op: 'fontinfo', path: path.join(FONTS_DIR, NSD.file), cmapAll: true, cps: [] }).cmapAll);
    const nsCmap = new Set(py({ op: 'fontinfo', path: path.join(FONTS_DIR, NS.file), cmapAll: true, cps: [] }).cmapAll);
    const covers = (set, t) => Array.from(t).every((c) => set.has(c.codePointAt(0)));
    for (const [t, bold, want] of [
      ['Hello', false, 'NotoSans-Regular.ttf'], ['Hello', true, 'NotoSans-Bold.ttf'],
      ['हिन्दी में परीक्षण', false, 'NotoSansDevanagari-Regular.ttf'], ['Rupee ₹500 “नमस्ते” café', true, 'NotoSansDevanagari-Bold.ttf'],
      ['हिन्दी Ωμέγα', false, 'NotoSans-Regular.ttf'], ['हिन्दी ō', false, 'NotoSans-Regular.ttf']
    ]) {
      const got = PDFFont.pickFont(t, bold);
      eq(got, want, `pickFont(${esc(t)}, ${bold}) = ${want}`);
      check(covers(/Devanagari/.test(got) ? nsdCmap : nsCmap, t), `  and fontTools confirms ${got} has every character`);
    }
    // the coverage table inside pickFont matches the font (fontTools)
    const nonDeva = Array.from(nsdCmap).filter((c) => !(c >= 0x900 && c <= 0x97f) && !(c >= 0xa8e0 && c <= 0xa8ff) && !(c >= 0x1cd0 && c <= 0x1cff) && !(c >= 0x11b00 && c <= 0x11b5f));
    const wrongYes = nonDeva.filter((c) => PDFFont.pickFont('क' + String.fromCodePoint(c)) !== 'NotoSansDevanagari-Regular.ttf');
    check(!wrongYes.length, `pickFont keeps all ${nonDeva.length} non-Devanagari characters of Noto Sans Devanagari with it`, wrongYes.slice(0, 5).map((c) => c.toString(16)).join(','));
    const sample = [];
    for (let c = 0x20; c < 0x2200; c++) if (!nsdCmap.has(c) && !(c >= 0x900 && c <= 0x97f) && nsCmap.has(c)) sample.push(c);
    const wrongNo = sample.filter((c) => PDFFont.pickFont('क' + String.fromCodePoint(c)) !== 'NotoSans-Regular.ttf');
    check(!wrongNo.length, `and sends Devanagari mixed with any of ${sample.length} characters it lacks (U+0020–U+21FF) to Noto Sans`, wrongNo.slice(0, 5).map((c) => c.toString(16)).join(','));
    check(Array.from('हिन्दी में परीक्षण').every((c) => nsCmap.has(c.codePointAt(0))), 'Noto Sans itself (Google Fonts build) contains the Devanagari block');

    const adv = py({ op: 'fontinfo', path: path.join(FONTS_DIR, NS.file), cps: Array.from('Hello').map((c) => c.codePointAt(0)) });
    const adv2 = py({ op: 'fontinfo', path: path.join(FONTS_DIR, NS.file), gids: Object.values(adv.gid) });
    const units = Array.from('Hello').reduce((s, c) => s + adv2.advance[adv.gid[c.codePointAt(0)]], 0);
    eq(PDFFont.measure(NS.font, 'Hello', 10), units / 100, 'measure("Hello", 10) is the hmtx advances (fontTools) × 10 / 1000');
    const text = 'Zażółć gęślą jaźń. Съешь же ещё этих мягких французских булок, да выпей чаю.\n\nΚαλημέρα';
    const lines = PDFFont.wrap(NS.font, text, 11, 150);
    check(lines.length > 3 && lines.every((l) => !l || PDFFont.measure(NS.font, l, 11) <= 150 || !l.includes(' ')), `wrap() keeps every line within 150 pt (${lines.length} lines)`);
    eq(lines.join(' ').replace(/\s+/g, ' '), text.replace(/\s+/g, ' '), 'wrap() loses no words');
    check(lines.includes(''), 'wrap() keeps the blank line between paragraphs');
  }

  /* ---------------------------------------------------------------- */
  G('Subset sizes');
  sizeReport.forEach((l) => console.log('  ' + l));

  /* ---------------------------------------------------------------- */
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`${pass + failCount} assertions   ${pass} passed   ${failCount} failed`);
  if (failCount) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  · ' + f));
  }
  console.log();
  process.exit(failCount ? 1 : 0);
})().catch(e => {
  console.error('\nSuite crashed:', e && e.stack || e);
  process.exit(1);
});
