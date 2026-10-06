#!/usr/bin/env node
/**
 * Tool suite — the PDF tools as they ship.
 *
 * Loads what the site serves, the way a browser does: engine/pdfcore.bundle.js
 * for the core, and engine/pdf-<id>.js for every tool page under /pdf/ — the
 * same new Function('window', src) load build-pdf-ship.js uses. So these
 * tests cannot drift from production: change an engine and this is what runs.
 *
 * Exercises every shipped spec: its declared shape (which render-pdf.js and
 * the page builder consume), a run() with its defaults, and for the tools
 * that have them, detailed runs against real fixtures. Output PDFs are parsed
 * back with the shipped core and written to tests/output/ so they can be
 * checked independently with PyMuPDF or opened in Acrobat.
 *
 * The 'render' tools have no run() — rasterising needs a browser — so they
 * are covered up to the point where the renderer takes over.
 *
 * build/pdf-package/engine/pdftools.js is not what ships. It keeps a copy of
 * most shipped specs (for the disabled build-pdf.js) and the drafts that never
 * shipped; the last group fails if a copy has drifted from its engine.
 *
 * The site root is three levels up (run it from the repo or from an export);
 * set MVR_SITE_ROOT to point elsewhere. Fixtures come from make-fixtures.py;
 * set MVR_PDF_FIXTURES to relocate them.
 */
'use strict';
const fs = require('fs');
const path = require('path');

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

const SITE = process.env.MVR_SITE_ROOT
  ? path.resolve(process.env.MVR_SITE_ROOT)
  : path.resolve(__dirname, '..', '..', '..');
const siteFile = (rel) => path.join(SITE, rel);
if (!fs.existsSync(siteFile('engine/pdfcore.bundle.js')) || !fs.existsSync(siteFile('pdf/index.html'))) {
  console.error(`No site at ${SITE} (looked for engine/pdfcore.bundle.js and pdf/index.html). Set MVR_SITE_ROOT.`);
  process.exit(2);
}

/** Run a shipped script against a fake window, as the browser would. */
function loadScript(rel) {
  const w = {};
  new Function('window', fs.readFileSync(siteFile(rel), 'utf8'))(w);
  return w;
}

const core = loadScript('engine/pdfcore.bundle.js').MVRPdfCore;
if (!core || !core.PDFDocument) {
  console.error('engine/pdfcore.bundle.js did not define window.MVRPdfCore.');
  process.exit(2);
}

/* The shipped set: every tool page under /pdf/ and the engine it loads. A
   page that loads no engine of its own shows up as a failure below rather
   than being silently left out. */
const HUB = fs.readFileSync(siteFile('pdf/index.html'), 'utf8');
const TOOL_PAGES = fs.readdirSync(siteFile('pdf'))
  .filter(d => fs.existsSync(siteFile(`pdf/${d}/index.html`)))
  .sort();
const PAGE_ENGINE = new Map(TOOL_PAGES.map(d => [d,
  fs.readFileSync(siteFile(`pdf/${d}/index.html`), 'utf8').includes(`/engine/pdf-${d}.js"`)]));
const SHIPPED = TOOL_PAGES.filter(d => PAGE_ENGINE.get(d) && fs.existsSync(siteFile(`engine/pdf-${d}.js`)));

const PDF_TOOLS = Object.create(null);
const ENGINE_DEFINES = new Map();   /* id -> the ids its engine put on window.PDF_TOOLS */
const HELPERS = new Map();          /* helper name -> Map(source -> { fn, engines }) */
const HELPER_NAMES = ['fmtBytes', 'slug', 'rgbTriplet'];
for (const id of SHIPPED) {
  const rel = `engine/pdf-${id}.js`;
  const w = loadScript(rel);
  ENGINE_DEFINES.set(id, Object.keys(w.PDF_TOOLS || {}));
  if (w.PDF_TOOLS && w.PDF_TOOLS[id]) PDF_TOOLS[id] = w.PDF_TOOLS[id];

  /* Each engine carries its own copy of the shared helpers inside its IIFE.
     Reopen it with a return on the end to reach them, so the helper tests
     run on every distinct copy that ships rather than on a package one. */
  const src = fs.readFileSync(siteFile(rel), 'utf8');
  const close = /\n\}\)\(\);?\s*$/;
  if (!/^\(function\s*\(\)\s*\{/.test(src) || !close.test(src)) continue;
  const grab = '\nreturn {' + HELPER_NAMES.map(n => `${n}: typeof ${n} === 'function' ? ${n} : null`).join(', ') + '};\n})();';
  const got = new Function('window', 'return ' + src.replace(close, grab))({});
  for (const n of HELPER_NAMES) {
    if (!got[n]) continue;
    if (!HELPERS.has(n)) HELPERS.set(n, new Map());
    const key = got[n].toString().replace(/\s+/g, ' ');
    const m = HELPERS.get(n);
    if (!m.has(key)) m.set(key, { fn: got[n], engines: [] });
    m.get(key).engines.push(id);
  }
}

/* The package copy, for the drift check only. */
const PKG_TOOLS_FILE = path.join(__dirname, '..', 'engine', 'pdftools.js');
const PKG_TOOLS = fs.existsSync(PKG_TOOLS_FILE) ? require(PKG_TOOLS_FILE).PDF_TOOLS : null;

/* The control types render-pdf.js knows how to draw: its explicit branches,
   plus the plain text box it falls back to. */
const RENDERER = fs.readFileSync(siteFile('engine/render-pdf.js'), 'utf8');
const buildControl = RENDERER.slice(RENDERER.indexOf('function buildControl'),
                                    RENDERER.indexOf('window.MVRTool.mountPDF'));
const CTRL_TYPES = new Set(['text',
  ...[...buildControl.matchAll(/c\.type === '([a-z]+)'/g)].map(m => m[1])]);

const FIXTURES = process.env.MVR_PDF_FIXTURES
  ? path.resolve(process.env.MVR_PDF_FIXTURES)
  : path.dirname(findFile(
      ['fixtures/classic5.pdf', '../tests/fixtures/classic5.pdf', '../fixtures/classic5.pdf'],
      'the fixtures (run: python3 tests/make-fixtures.py)'));

const OUT = path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });

const { PDFDocument, latin1, isDict, isName } = core;

/* ---------- assertions ---------- */

let pass = 0, fail = 0, group = '';
const failures = [];

function G(name) { group = name; console.log(`\n${name}`); }
function ok(cond, label, detail) {
  if (cond) { pass++; console.log(`  ok    ${label}`); }
  else {
    fail++; failures.push(`${group} → ${label}${detail ? '  (' + detail + ')' : ''}`);
    console.log(`  FAIL  ${label}${detail ? '  → ' + detail : ''}`);
  }
}
const eq = (a, b, label) =>
  ok(a === b, label, a === b ? '' : `got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const near = (a, b, tol, label) =>
  ok(Math.abs(a - b) <= tol, label, `got ${a}, expected ${b} ±${tol}`);

/* ---------- harness ---------- */

const loaded = new Map();
async function load(name) {
  if (!loaded.has(name)) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)));
    loaded.set(name, { doc: await PDFDocument.load(bytes), name, size: bytes.length });
  }
  return loaded.get(name);
}

/** Control defaults, as the renderer would supply them. */
function defaults(spec) {
  const o = Object.create(null);
  for (const c of spec.controls || []) {
    o[c.key] = c.default === 'TODAY' ? new Date().toISOString().slice(0, 10) : c.default;
  }
  return o;
}

/** Invoke a tool the way render-pdf.js does. */
async function run(id, { docs = [], opts = {}, text = '' } = {}) {
  const spec = PDF_TOOLS[id];
  return spec.run({ docs, opts: Object.assign(defaults(spec), opts), core, text });
}

/** Parse a produced file back and report its page count. */
async function pagesOf(bytes) {
  return (await PDFDocument.load(bytes)).pageCount();
}

/** Keep a copy for independent verification. */
function keep(name, bytes) {
  fs.writeFileSync(path.join(OUT, name), Buffer.from(bytes));
  return name;
}

const statMap = (res) => new Map((res.stats || []).map(([k, v]) => [k, v]));

(async function main() {

  /* =====================================================================
     Declared shape — this is exactly what the page generator reads
     ===================================================================== */
  G('Catalogue (what ships)');

  const ids = Object.keys(PDF_TOOLS);
  const byKind = (k) => ids.filter(id => PDF_TOOLS[id].kind === k);
  /* the hub groups by what a tool needs: the organiser runs in the worker
     like any transform, but its thumbnails still need the renderer */
  const needsEngine = ids.filter(id => PDF_TOOLS[id].needsRenderer === true);
  console.log(`  ${ids.length} shipped tools: ` + ['transform', 'create', 'inspect', 'render']
    .map(k => `${byKind(k).length} ${k}`).join(', '));

  /* every count here is checked against an independent source on the site:
     the tool pages, the hub's cards, its lede and its sidebar count */
  ok(TOOL_PAGES.every(d => PAGE_ENGINE.get(d)), 'every tool page under /pdf/ loads its own engine',
    TOOL_PAGES.filter(d => !PAGE_ENGINE.get(d)).join(', '));
  eq(ids.length, TOOL_PAGES.length, 'one shipped engine per tool page');
  ok(SHIPPED.every(id => ENGINE_DEFINES.get(id).length === 1 && ENGINE_DEFINES.get(id)[0] === id),
    'every engine defines its own tool and nothing else',
    SHIPPED.filter(id => String(ENGINE_DEFINES.get(id)) !== id).map(id => `${id}: ${ENGINE_DEFINES.get(id)}`).join('; '));
  ok(ids.every(id => /^[a-z0-9-]+$/.test(id)), 'every id is URL-safe lower-case kebab');
  eq(new Set(ids.map(id => PDF_TOOLS[id].title)).size, ids.length, 'every title is distinct');

  const hubSections = [...HUB.matchAll(/<h2>([^<]+)<\/h2>\s*<p class="lede">[^<]*<\/p>\s*<div class="grid[^"]*">([\s\S]*?)<\/div>\n/g)]
    .map(m => ({ heading: m[1], ids: [...m[2].matchAll(/<a class="card" href="\/pdf\/([a-z0-9-]+)\/"/g)].map(x => x[1]) }));
  const hubIds = hubSections.flatMap(s => s.ids);
  const section = (h) => (hubSections.find(s => s.heading === h) || { ids: [] }).ids;
  eq(hubIds.length, ids.length, 'the hub has one card per shipped tool');
  ok(hubIds.every(id => PDF_TOOLS[id]) && ids.every(id => hubIds.includes(id)),
    'the hub cards and the shipped engines are the same set',
    [...hubIds.filter(id => !PDF_TOOLS[id]).map(id => 'card without engine: ' + id),
     ...ids.filter(id => !hubIds.includes(id)).map(id => 'engine without card: ' + id)].join('; '));
  const lede = /<p class="lede">(\d+) tools for /.exec(HUB);
  eq(lede && Number(lede[1]), ids.length, 'the hub lede counts the shipped tools');
  const side = /<span class="side-name">PDF Tools<\/span><span class="side-count">(\d+)<\/span>/.exec(HUB);
  eq(side && Number(side[1]), ids.length, 'the sidebar count matches the shipped tools');
  eq(byKind('transform').length + byKind('create').length + byKind('inspect').length + byKind('render').length,
    ids.length, 'every tool is one of the four kinds');
  eq(needsEngine.length, section('Needs a rendering engine').length,
    'the render tools are the hub’s “needs a rendering engine” cards');
  eq(byKind('inspect').length, section('Look inside a PDF').length,
    'the inspect tools are the hub’s “look inside a PDF” cards');
  eq(byKind('transform').filter(id => !PDF_TOOLS[id].needsRenderer).length + byKind('create').length,
    section('Work with an existing PDF').length + section('Create a PDF from scratch').length,
    'the transform and create tools are the hub’s other two sections');

  G('Spec integrity (every shipped tool)');

  const KINDS = new Set(['transform', 'create', 'inspect', 'render']);
  ok(CTRL_TYPES.size > 3, `the renderer's control types were read: ${[...CTRL_TYPES].join(', ')}`);

  for (const id of ids) {
    const s = PDF_TOOLS[id];
    const t = (label, cond, detail) => ok(cond, `${id}: ${label}`, detail);

    t('has a non-empty title', typeof s.title === 'string' && s.title.length > 3);
    t('has a description of usable length',
      typeof s.description === 'string' && s.description.length >= 30,
      s.description ? `${s.description.length} chars` : 'missing');
    t('declares a known kind', KINDS.has(s.kind), s.kind);
    t('declares multiple as a boolean', typeof s.multiple === 'boolean');
    t('has keywords for the meta description',
      Array.isArray(s.keywords) && s.keywords.length >= 4, `${(s.keywords || []).length}`);
    t('keywords are all non-empty strings',
      (s.keywords || []).every(k => typeof k === 'string' && k.trim()));
    t('has tips', Array.isArray(s.tips) && s.tips.length >= 3, `${(s.tips || []).length}`);
    t('tips are substantial prose', (s.tips || []).every(x => typeof x === 'string' && x.length > 40));
    t('has at least one FAQ', Array.isArray(s.faq) && s.faq.length >= 1);
    t('every FAQ has a question and an answer',
      (s.faq || []).every(f => f && typeof f.q === 'string' && f.q.trim().length > 8 &&
                               typeof f.a === 'string' && f.a.trim().length > 40));
    t('questions end with a question mark', (s.faq || []).every(f => /\?$/.test(f.q.trim())));
    t('declares a controls array', Array.isArray(s.controls));
    t('control keys are unique',
      new Set((s.controls || []).map(c => c.key)).size === (s.controls || []).length);
    t('every control has a key, label and known type',
      (s.controls || []).every(c => c.key && c.label && CTRL_TYPES.has(c.type)));
    t('every select control offers options',
      (s.controls || []).filter(c => c.type === 'select')
        .every(c => Array.isArray(c.options) && c.options.length >= 2 &&
                    c.options.every(o => o.value !== undefined && o.label)));
    t('every select default is one of its options',
      (s.controls || []).filter(c => c.type === 'select')
        .every(c => c.options.some(o => String(o.value) === String(c.default))));
    t('every number control has a numeric default within its bounds',
      (s.controls || []).filter(c => c.type === 'number').every(c => {
        const v = Number(c.default);
        return isFinite(v) && (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max);
      }));
    t('every colour default is a hex triplet',
      (s.controls || []).filter(c => c.type === 'color')
        .every(c => /^#[0-9a-f]{6}$/i.test(String(c.default))));

    if (s.kind === 'render') {
      t('render tools flag needsRenderer', s.needsRenderer === true);
      t('render tools have no run() — the browser supplies it', typeof s.run === 'undefined');
    } else {
      t('has an async run()', typeof s.run === 'function');
      t('sets needsRenderer only with a page grid that draws thumbnails', !s.needsRenderer || !!s.pageGrid || typeof s.mainRun === 'function');
    }
  }

  /* =====================================================================
     Helpers
     ===================================================================== */
  G('Shared helpers (every distinct copy in the shipped engines)');

  ok(HELPERS.has('fmtBytes') && HELPERS.has('slug'), 'the engines\' helpers were reached');
  /* engines that carry their own copy of a helper, by name */
  const carriers = (n) => [...(HELPERS.get(n) || new Map()).values()];
  const who = (c) => `${c.engines.length} engine${c.engines.length === 1 ? '' : 's'}`;
  for (const c of carriers('fmtBytes')) {
    const fmtBytes = c.fn, at = ` [${who(c)}]`;
    eq(fmtBytes(0), '0 B', 'fmtBytes formats zero' + at);
    eq(fmtBytes(999), '999 B', 'fmtBytes formats bytes' + at);
    eq(fmtBytes(1024), '1.0 KB', 'fmtBytes switches to KB at 1024' + at);
    eq(fmtBytes(1536), '1.5 KB', 'fmtBytes formats fractional KB' + at);
    eq(fmtBytes(1048576), '1.00 MB', 'fmtBytes switches to MB at a megabyte' + at);
  }
  for (const c of carriers('slug')) {
    const slug = c.fn, at = ` [${who(c)}]`;
    eq(slug('Hello World'), 'hello-world', 'slug lower-cases and hyphenates' + at);
    eq(slug('INV-0001'), 'inv-0001', 'slug keeps digits' + at);
    eq(slug('  spaced  out  '), 'spaced-out', 'slug trims leading and trailing hyphens' + at);
    eq(slug('Priya Sharma!'), 'priya-sharma', 'slug drops punctuation' + at);
    eq(slug('***'), 'document', 'slug falls back to "document" when nothing survives' + at);
  }
  for (const c of carriers('rgbTriplet')) {
    const rgbTriplet = c.fn, at = ` [${who(c)}]`;
    eq(rgbTriplet('#ffffff'), '1 1 1', 'rgbTriplet converts white' + at);
    eq(rgbTriplet('#000000'), '0 0 0', 'rgbTriplet converts black' + at);
    eq(rgbTriplet('nonsense'), '0 0 0', 'rgbTriplet falls back to black' + at);
    ok(/^1 0 0$/.test(rgbTriplet('#ff0000')), 'rgbTriplet converts pure red' + at);
  }

  /* =====================================================================
     merge-pdf
     ===================================================================== */
  G('merge-pdf');

  const c5 = await load('classic5.pdf');
  const o4 = await load('objstm4.pdf');
  const m3 = await load('mixed3.pdf');
  const meta = await load('meta1.pdf');
  const many = await load('many30.pdf');
  const img1 = await load('withimage.pdf');

  let r = await run('merge-pdf', { docs: [c5, o4] });
  ok(!r.error, 'merging two documents succeeds', r.error);
  eq(r.files.length, 1, 'merging produces a single file');
  eq(r.files[0].name, 'classic5-merged.pdf', 'the merged file is named after the first file');
  eq(await pagesOf(r.files[0].bytes), 9, 'five pages plus four gives nine');
  keep('out-merged.pdf', r.files[0].bytes);
  eq(statMap(r).get('Files merged'), '2', 'the stats report two files merged');
  eq(statMap(r).get('Total pages'), '9', 'the stats report nine pages');
  ok(statMap(r).has('Output size'), 'the stats report an output size');

  r = await run('merge-pdf', { docs: [c5] });
  ok(!!r.error, 'merging one file is refused');
  ok(/at least two/i.test(r.error), 'the message asks for a second file');

  r = await run('merge-pdf', { docs: [c5, o4], opts: { ranges: '1-2 | 1' } });
  eq(await pagesOf(r.files[0].bytes), 3, 'per-file ranges are applied in order');
  r = await run('merge-pdf', { docs: [c5, o4], opts: { ranges: '1' } });
  eq(await pagesOf(r.files[0].bytes), 2, 'a single range applies to every file');
  r = await run('merge-pdf', { docs: [c5, o4], opts: { ranges: 'bad' } });
  ok(!!r.error, 'an invalid range is refused');
  ok(/classic5\.pdf/.test(r.error), 'the error names the offending file');

  r = await run('merge-pdf', { docs: [meta, c5], opts: { keepMeta: 'strip' } });
  const mergedStripped = await (await PDFDocument.load(r.files[0].bytes)).getInfo();
  eq(Object.keys(mergedStripped).length, 0, 'metadata is stripped by default');
  r = await run('merge-pdf', { docs: [meta, c5], opts: { keepMeta: 'first' } });
  eq((await (await PDFDocument.load(r.files[0].bytes)).getInfo()).Author, 'A Patel',
    'keepMeta "first" carries the first file\'s author across');
  r = await run('merge-pdf', { docs: [c5, o4], opts: { title: 'Bundle' } });
  eq((await (await PDFDocument.load(r.files[0].bytes)).getInfo()).Title, 'Bundle',
    'an explicit title is written');

  r = await run('merge-pdf', { docs: [m3, img1] });
  eq(await pagesOf(r.files[0].bytes), 4, 'documents with mixed page sizes merge');

  /* =====================================================================
     split-pdf
     ===================================================================== */
  G('split-pdf');

  r = await run('split-pdf', { docs: [c5], opts: { mode: 'each' } });
  eq(r.files.length, 5, 'one file per page gives five files');
  eq(r.files[0].name, 'classic5-p1.pdf', 'single-page files are named by page');
  eq(await pagesOf(r.files[0].bytes), 1, 'each split file holds one page');
  eq(await pagesOf(r.files[4].bytes), 1, 'the last split file holds one page');
  eq(statMap(r).get('Files produced'), '5', 'the stats report five files');
  eq(statMap(r).get('Source pages'), '5', 'the stats report the source page count');

  r = await run('split-pdf', { docs: [c5], opts: { mode: 'every', n: 2 } });
  eq(r.files.length, 3, 'every two pages of five gives three files');
  eq(await pagesOf(r.files[0].bytes), 2, 'the first group holds two pages');
  eq(await pagesOf(r.files[2].bytes), 1, 'the final group holds the remainder');
  eq(r.files[0].name, 'classic5-p1-2.pdf', 'multi-page files are named by range');

  r = await run('split-pdf', { docs: [c5], opts: { mode: 'half' } });
  eq(r.files.length, 2, 'splitting in half gives two files');
  eq(await pagesOf(r.files[0].bytes), 3, 'the first half of five pages is three');
  eq(await pagesOf(r.files[1].bytes), 2, 'the second half of five pages is two');

  r = await run('split-pdf', { docs: [c5], opts: { mode: 'ranges', ranges: '1-2 | 3 | 4-' } });
  eq(r.files.length, 3, 'three explicit ranges give three files');
  eq(await pagesOf(r.files[0].bytes), 2, 'range 1-2 yields two pages');
  eq(await pagesOf(r.files[1].bytes), 1, 'range 3 yields one page');
  eq(await pagesOf(r.files[2].bytes), 2, 'an open-ended range takes the rest');

  r = await run('split-pdf', { docs: [c5], opts: { mode: 'ranges', ranges: 'nope' } });
  ok(!!r.error, 'an unparseable range is refused');
  r = await run('split-pdf', { docs: [c5], opts: { mode: 'ranges', ranges: '' } });
  ok(!!r.error, 'no ranges at all is refused');
  ok(/at least one range/i.test(r.error), 'the message asks for a range');

  r = await run('split-pdf', { docs: [many], opts: { mode: 'each' } });
  eq(r.files.length, 30, 'a thirty-page document splits into thirty files');
  r = await run('split-pdf', { docs: [many], opts: { mode: 'every', n: 1 } });
  eq(r.files.length, 30, 'every-one-page matches one-file-per-page');

  /* =====================================================================
     extract-pdf-pages
     ===================================================================== */
  G('extract-pdf-pages');

  r = await run('extract-pdf-pages', { docs: [c5], opts: { pages: '1-3' } });
  eq(r.files.length, 1, 'extraction produces one file');
  eq(r.files[0].name, 'classic5-extract.pdf', 'the extract is named after the source');
  eq(await pagesOf(r.files[0].bytes), 3, 'extracting 1-3 gives three pages');
  eq(statMap(r).get('Pages extracted'), '3', 'the stats report three pages extracted');
  eq(statMap(r).get('Page order'), '1, 2, 3', 'the stats list the page order');

  r = await run('extract-pdf-pages', { docs: [c5], opts: { pages: '5,1,3', order: 'asis' } });
  eq(statMap(r).get('Page order'), '5, 1, 3', 'order "as listed" preserves what was typed');
  r = await run('extract-pdf-pages', { docs: [c5], opts: { pages: '5,1,3', order: 'sorted' } });
  eq(statMap(r).get('Page order'), '1, 3, 5', 'order "sorted" reorders ascending');
  r = await run('extract-pdf-pages', { docs: [c5], opts: { pages: '5,1,3', order: 'reverse' } });
  eq(statMap(r).get('Page order'), '3, 1, 5', 'order "reversed" reverses the list');

  r = await run('extract-pdf-pages', { docs: [c5], opts: { pages: '1,1,2' } });
  eq(await pagesOf(r.files[0].bytes), 3, 'a duplicated page is extracted twice');
  r = await run('extract-pdf-pages', { docs: [c5], opts: { pages: '99' } });
  ok(!!r.error, 'extracting a page past the end is refused');
  r = await run('extract-pdf-pages', { docs: [c5], opts: { pages: 'x' } });
  ok(!!r.error, 'an invalid selection is refused');
  r = await run('extract-pdf-pages', { docs: [many], opts: { pages: 'all' } });
  eq(await pagesOf(r.files[0].bytes), 30, 'extracting "all" copies every page');

  /* =====================================================================
     delete-pdf-pages
     ===================================================================== */
  G('delete-pdf-pages');

  r = await run('delete-pdf-pages', { docs: [c5], opts: { pages: '1' } });
  eq(r.files[0].name, 'classic5-trimmed.pdf', 'the output is named "trimmed"');
  eq(await pagesOf(r.files[0].bytes), 4, 'removing one page of five leaves four');
  eq(statMap(r).get('Pages removed'), '1', 'the stats report one page removed');
  eq(statMap(r).get('Pages remaining'), '4', 'the stats report four remaining');
  eq(statMap(r).get('Removed'), '1', 'the stats name the removed page');

  r = await run('delete-pdf-pages', { docs: [c5], opts: { pages: '2-4' } });
  eq(await pagesOf(r.files[0].bytes), 2, 'removing a range leaves the rest');
  r = await run('delete-pdf-pages', { docs: [c5], opts: { pages: 'all' } });
  ok(!!r.error, 'removing every page is refused');
  ok(/at least one/i.test(r.error), 'the message insists on keeping a page');
  r = await run('delete-pdf-pages', { docs: [c5], opts: { pages: '1-5' } });
  ok(!!r.error, 'removing every page by range is also refused');
  r = await run('delete-pdf-pages', { docs: [c5], opts: { pages: 'bad' } });
  ok(!!r.error, 'an invalid selection is refused');
  r = await run('delete-pdf-pages', { docs: [many], opts: { pages: '2-29' } });
  eq(await pagesOf(r.files[0].bytes), 2, 'deleting the middle of thirty pages leaves two');

  /* =====================================================================
     rotate-pdf
     ===================================================================== */
  G('rotate-pdf');

  r = await run('rotate-pdf', { docs: [c5], opts: { angle: '90', pages: 'all' } });
  eq(r.files[0].name, 'classic5-rotated.pdf', 'the output is named "rotated"');
  eq(await pagesOf(r.files[0].bytes), 5, 'rotating keeps every page');
  eq(statMap(r).get('Pages rotated'), '5', 'the stats report five pages rotated');
  eq(statMap(r).get('Rotation applied'), '90°', 'the stats report the angle');

  let rotDoc = await PDFDocument.load(r.files[0].bytes);
  let rotPages = await rotDoc.getPages();
  ok(rotPages.every(p => (Number(p.dict.Rotate) || 0) === 90), 'every page carries /Rotate 90');

  r = await run('rotate-pdf', { docs: [c5], opts: { angle: '180', pages: '1,2' } });
  rotDoc = await PDFDocument.load(r.files[0].bytes);
  rotPages = await rotDoc.getPages();
  eq(Number(rotPages[0].dict.Rotate) || 0, 180, 'a selected page is rotated');
  eq(Number(rotPages[2].dict.Rotate) || 0, 0, 'an unselected page is left alone');
  eq(statMap(r).get('Pages rotated'), '2', 'the stats count only the selected pages');

  /* mixed3 page 2 is already at 90°, so +90 must land on 180 */
  r = await run('rotate-pdf', { docs: [m3], opts: { angle: '90', pages: '2' } });
  rotDoc = await PDFDocument.load(r.files[0].bytes);
  eq(Number((await rotDoc.getPages())[1].dict.Rotate) || 0, 180,
    'rotation adds to a page that is already rotated');
  r = await run('rotate-pdf', { docs: [m3], opts: { angle: '270', pages: '2' } });
  rotDoc = await PDFDocument.load(r.files[0].bytes);
  eq(Number((await rotDoc.getPages())[1].dict.Rotate) || 0, 0,
    'rotation wraps back to zero at 360');
  r = await run('rotate-pdf', { docs: [c5], opts: { angle: '90', pages: 'zzz' } });
  ok(!!r.error, 'an invalid page selection is refused');

  /* =====================================================================
     pdf-metadata
     ===================================================================== */
  G('pdf-metadata');

  r = await run('pdf-metadata', { docs: [meta], opts: { action: 'strip' } });
  eq(r.files[0].name, 'meta1-clean.pdf', 'stripping names the output "clean"');
  eq(await pagesOf(r.files[0].bytes), 1, 'the page survives the rewrite');
  const stripped = await (await PDFDocument.load(r.files[0].bytes)).getInfo();
  eq(Object.keys(stripped).length, 0, 'every metadata field is gone');
  keep('out-clean.pdf', r.files[0].bytes);
  ok(/Removed:/.test(r.warn || ''), 'a warning lists what was removed');
  ok(/original file on your device/i.test(r.warn || ''),
    'the warning is honest that the source still has the metadata');
  eq(statMap(r).get('Title'), 'Confidential Report', 'the stats show the title that was found');
  eq(statMap(r).get('Author'), 'A Patel', 'the stats show the author that was found');
  eq(statMap(r).get('Action'), 'All fields removed', 'the stats confirm the action');

  r = await run('pdf-metadata', { docs: [meta], opts: {
    action: 'edit', Title: 'New Title', Author: 'New Author', Subject: 'S', Keywords: 'k' } });
  eq(r.files[0].name, 'meta1-updated.pdf', 'editing names the output "updated"');
  const edited = await (await PDFDocument.load(r.files[0].bytes)).getInfo();
  eq(edited.Title, 'New Title', 'the new title is written');
  eq(edited.Author, 'New Author', 'the new author is written');
  eq(edited.Subject, 'S', 'the new subject is written');
  eq(edited.Keywords, 'k', 'the new keywords are written');
  ok(!r.warn, 'editing does not emit a removal warning');

  r = await run('pdf-metadata', { docs: [c5], opts: { action: 'strip' } });
  ok(!r.error, 'stripping a document with little metadata still works');
  r = await run('pdf-metadata', { docs: [meta], opts: { action: 'edit', Title: 'Only Title' } });
  const partly = await (await PDFDocument.load(r.files[0].bytes)).getInfo();
  eq(partly.Title, 'Only Title', 'a single supplied field is written');
  eq(partly.Author, undefined, 'fields left blank are not carried over from the source');

  /* =====================================================================
     pdf-inspector
     ===================================================================== */
  G('pdf-inspector');

  r = await run('pdf-inspector', { docs: [m3] });
  eq(r.files.length, 0, 'the inspector produces no files');
  ok(typeof r.report === 'string' && r.report.length > 100, 'it produces a text report');
  const im = statMap(r);
  eq(im.get('File'), 'mixed3.pdf', 'the report names the file');
  eq(im.get('Pages'), '3', 'the report gives the page count');
  eq(im.get('PDF version'), '1.7', 'the report gives the PDF version');
  ok(/595 × 842/.test(im.get('Page sizes')), 'the report lists the A4 page size');
  ok(/842 × 595/.test(im.get('Page sizes')), 'the report lists the landscape page size');
  ok(/612 × 792/.test(im.get('Page sizes')), 'the report lists the Letter page size');
  ok(/mm/.test(im.get('Page sizes')), 'page sizes are also given in millimetres');
  ok(/90°/.test(im.get('Rotations')), 'the report notes the rotated page');
  ok(/0°/.test(im.get('Rotations')), 'the report notes the unrotated pages');
  ok(Number(im.get('Objects')) > 3, 'the report counts objects');
  ok(im.has('Embedded images'), 'the report has an image count');
  ok(im.has('Annotations'), 'the report has an annotation count');
  ok(r.report.includes('Pages'), 'the plain-text report is aligned and readable');

  r = await run('pdf-inspector', { docs: [img1] });
  eq(statMap(r).get('Embedded images'), '1', 'the inspector finds the embedded image');
  r = await run('pdf-inspector', { docs: [meta] });
  const mi = statMap(r);
  eq(mi.get('Metadata: Title'), 'Confidential Report', 'the inspector surfaces the title');
  eq(mi.get('Metadata: Author'), 'A Patel', 'the inspector surfaces the author');
  r = await run('pdf-inspector', { docs: [c5] });
  ok(/Helvetica/.test(statMap(r).get('Distinct fonts')), 'the inspector lists the fonts used');
  r = await run('pdf-inspector', { docs: [many] });
  eq(statMap(r).get('Pages'), '30', 'the inspector counts thirty pages');

  /* =====================================================================
     watermark-pdf
     ===================================================================== */
  G('watermark-pdf');

  r = await run('watermark-pdf', { docs: [c5] });
  ok(!r.error, 'the default watermark applies cleanly', r.error);
  eq(r.files[0].name, 'classic5-watermarked.pdf', 'the output is named "watermarked"');
  eq(await pagesOf(r.files[0].bytes), 5, 'watermarking keeps every page');
  eq(statMap(r).get('Text'), 'DRAFT', 'the stats echo the watermark text');
  eq(statMap(r).get('Pages watermarked'), '5', 'every page is watermarked by default');
  eq(statMap(r).get('Opacity'), '20%', 'the stats report the opacity');
  keep('out-wm.pdf', r.files[0].bytes);

  /* the overlay must be reachable: font bound in Resources, and the text present */
  let wmDoc = await PDFDocument.load(r.files[0].bytes);
  let wmPage = (await wmDoc.getPages())[0];
  ok(Array.isArray(wmPage.dict.Contents), 'the watermark is appended as an extra content stream');
  let wmRes = await wmDoc.resolve(wmPage.dict.Resources);
  let wmFont = await wmDoc.resolve(wmRes.Font);
  ok(isDict(wmFont) && wmFont.MVRwm !== undefined,
    'the watermark font is bound in the page Resources');
  const wmFontDict = await wmDoc.resolve(wmFont.MVRwm);
  ok(isName(wmFontDict.BaseFont, 'Helvetica-Bold'), 'the watermark font is Helvetica-Bold');
  let wmGS = await wmDoc.resolve(wmRes.ExtGState);
  ok(isDict(wmGS) && wmGS.MVRgs !== undefined, 'an ExtGState carries the transparency');
  near(Number((await wmDoc.resolve(wmGS.MVRgs)).ca), 0.2, 1e-6, 'the opacity reaches the ExtGState');
  ok(latin1(r.files[0].bytes).includes('(DRAFT) Tj'), 'the watermark text is drawn');

  /* the original page text must still be underneath */
  /* Contents[0] is the q that isolates the page's own state from the stamp */
  const wmOrig = await wmDoc.decodeStream(await wmDoc.resolve(wmPage.dict.Contents[1]));
  ok(/\bT[jJ]\b/.test(latin1(wmOrig)), 'the original page content survives beneath the watermark');

  r = await run('watermark-pdf', { docs: [c5], opts: { text: '' } });
  ok(!!r.error, 'an empty watermark is refused');
  r = await run('watermark-pdf', { docs: [c5], opts: { text: '   ' } });
  ok(!!r.error, 'a whitespace-only watermark is refused');
  r = await run('watermark-pdf', { docs: [c5], opts: { pages: 'zz' } });
  ok(!!r.error, 'an invalid page selection is refused');

  r = await run('watermark-pdf', { docs: [c5], opts: { pages: '1' } });
  eq(statMap(r).get('Pages watermarked'), '1', 'only the selected page is watermarked');
  wmDoc = await PDFDocument.load(r.files[0].bytes);
  const unstamped = (await wmDoc.getPages())[2];
  ok(!Array.isArray(unstamped.dict.Contents),
    'an unselected page keeps its single content stream');

  r = await run('watermark-pdf', { docs: [c5], opts: { position: 'tile' } });
  eq(statMap(r).get('Layout'), 'tile', 'the tiled layout is reported');
  const tiled = latin1(r.files[0].bytes);
  ok((tiled.match(/\(DRAFT\) Tj/g) || []).length > 5, 'tiling repeats the text many times');
  r = await run('watermark-pdf', { docs: [c5], opts: { position: 'bottom' } });
  eq(statMap(r).get('Layout'), 'bottom', 'the bottom layout is reported');

  r = await run('watermark-pdf', { docs: [c5], opts: { opacity: 500 } });
  eq(statMap(r).get('Opacity'), '100%', 'an over-large opacity is clamped to 100%');
  r = await run('watermark-pdf', { docs: [c5], opts: { opacity: 0 } });
  eq(statMap(r).get('Opacity'), '20%', 'a zero opacity falls back to the default');
  r = await run('watermark-pdf', { docs: [c5], opts: { size: 9999 } });
  ok(latin1(r.files[0].bytes).includes('/MVRwm 300 Tf'), 'an over-large font size is clamped to 300');
  /* Check the drawn text itself, not the whole file — byte-copied source
     streams legitimately contain 0x3F, so scanning for "?" proves nothing. */
  const fancy = 'Smart “quotes” — dash';
  r = await run('watermark-pdf', { docs: [c5], opts: { text: fancy } });
  const escaped = core.contentEscape(fancy);
  ok(!escaped.includes('?'), 'the watermark text escapes with no unrepresentable glyphs');
  ok(latin1(r.files[0].bytes).includes(`(${escaped}) Tj`),
    'typographic characters survive into the watermark as WinAnsi');
  eq(statMap(r).get('Text'), fancy, 'the stats echo the original text unmangled');
  r = await run('watermark-pdf', { docs: [m3] });
  eq(await pagesOf(r.files[0].bytes), 3, 'watermarking works across mixed page sizes');

  /* =====================================================================
     pdf-page-numbers
     ===================================================================== */
  G('pdf-page-numbers');

  r = await run('pdf-page-numbers', { docs: [c5] });
  ok(!r.error, 'page numbering applies cleanly', r.error);
  eq(r.files[0].name, 'classic5-numbered.pdf', 'the output is named "numbered"');
  eq(await pagesOf(r.files[0].bytes), 5, 'numbering keeps every page');
  eq(statMap(r).get('Pages numbered'), '5', 'the stats report five pages numbered');
  keep('out-numbered.pdf', r.files[0].bytes);

  let pnDoc = await PDFDocument.load(r.files[0].bytes);
  let pnRes = await pnDoc.resolve((await pnDoc.getPages())[0].dict.Resources);
  let pnFont = await pnDoc.resolve(pnRes.Font);
  ok(isDict(pnFont) && pnFont.MVRpn !== undefined,
    'the page-number font is bound in the page Resources');
  ok(isName((await pnDoc.resolve(pnFont.MVRpn)).BaseFont, 'Helvetica'),
    'the page-number font is Helvetica');
  eq(await pnDoc.resolve(pnRes.ExtGState), undefined,
    'page numbers need no transparency group');

  const pnStr = latin1(r.files[0].bytes);
  ok(pnStr.includes('(1) Tj'), 'page one is numbered "1"');
  ok(pnStr.includes('(5) Tj'), 'page five is numbered "5"');

  const fmt = async (format) => latin1((await run('pdf-page-numbers',
    { docs: [c5], opts: { format } })).files[0].bytes);
  ok((await fmt('n-of-t')).includes('(1 of 5) Tj'), 'format "n of t" renders as "1 of 5"');
  ok((await fmt('page-n')).includes('(Page 1) Tj'), 'format "page-n" renders as "Page 1"');
  ok((await fmt('page-n-of-t')).includes('(Page 1 of 5) Tj'), 'format "page-n-of-t" renders in full');
  ok((await fmt('dash')).includes('\\226 1 \\226'), 'format "dash" uses a WinAnsi en dash');
  ok((await fmt('nonsense')).includes('(1) Tj'), 'an unknown format falls back to a bare number');

  r = await run('pdf-page-numbers', { docs: [c5], opts: { skip: 2 } });
  eq(statMap(r).get('Pages numbered'), '3', 'skipping two pages numbers only three');
  pnDoc = await PDFDocument.load(r.files[0].bytes);
  ok(!Array.isArray((await pnDoc.getPages())[0].dict.Contents),
    'a skipped page gets no overlay');
  ok(Array.isArray((await pnDoc.getPages())[2].dict.Contents),
    'the first numbered page does get an overlay');
  ok(latin1(r.files[0].bytes).includes('(1) Tj'),
    'numbering restarts at 1 on the first non-skipped page');

  r = await run('pdf-page-numbers', { docs: [c5], opts: { start: 10 } });
  eq(statMap(r).get('First number'), '10', 'the stats report the starting number');
  ok(latin1(r.files[0].bytes).includes('(10) Tj'), 'numbering starts at the requested value');
  ok(latin1(r.files[0].bytes).includes('(14) Tj'), 'numbering continues from the start value');
  r = await run('pdf-page-numbers', { docs: [c5], opts: { start: 0 } });
  ok(latin1(r.files[0].bytes).includes('(0) Tj'), 'numbering can start at zero');

  r = await run('pdf-page-numbers', { docs: [c5], opts: { extra: 'Confidential' } });
  ok(latin1(r.files[0].bytes).includes('(Confidential) Tj'), 'a header or footer line is drawn');
  for (const position of ['bl', 'bc', 'br', 'tl', 'tc', 'tr']) {
    r = await run('pdf-page-numbers', { docs: [c5], opts: { position } });
    eq(statMap(r).get('Position'), position, `position "${position}" is honoured`);
  }
  r = await run('pdf-page-numbers', { docs: [m3] });
  eq(await pagesOf(r.files[0].bytes), 3, 'numbering handles mixed page sizes');

  /* =====================================================================
     text-to-pdf
     ===================================================================== */
  G('text-to-pdf');

  r = await run('text-to-pdf', { text: 'Hello world.' });
  ok(!r.error, 'a short text converts', r.error);
  eq(r.files[0].name, 'document.pdf', 'the default filename is document.pdf');
  eq(await pagesOf(r.files[0].bytes), 1, 'a short text makes one page');
  eq(statMap(r).get('Characters'), '12', 'the stats count characters');
  eq(statMap(r).get('Words'), '2', 'the stats count words');
  eq(statMap(r).get('Pages'), '1', 'the stats count pages');
  ok(latin1(r.files[0].bytes).includes('(Hello world.) Tj'), 'the text is drawn');

  r = await run('text-to-pdf', { text: '' });
  ok(!!r.error, 'empty text is refused');
  r = await run('text-to-pdf', { text: '    \n  ' });
  ok(!!r.error, 'whitespace-only text is refused');

  r = await run('text-to-pdf', { text: 'Line\n'.repeat(400) });
  ok(await pagesOf(r.files[0].bytes) > 1, 'a long text paginates');
  eq(Number(statMap(r).get('Pages')), await pagesOf(r.files[0].bytes),
    'the reported page count matches the document');
  ok(Number(statMap(r).get('Lines per page')) > 10, 'the stats report lines per page');

  r = await run('text-to-pdf', { text: 'x', opts: { title: 'My Report' } });
  eq(r.files[0].name, 'my-report.pdf', 'the title becomes the filename');
  eq((await (await PDFDocument.load(r.files[0].bytes)).getInfo()).Title, 'My Report',
    'the title is written into the metadata');

  r = await run('text-to-pdf', { text: 'x', opts: { pageSize: 'letter' } });
  ok(latin1(r.files[0].bytes).includes('[0 0 612 792]'), 'US Letter is honoured');
  r = await run('text-to-pdf', { text: 'x', opts: { pageSize: 'a5' } });
  ok(latin1(r.files[0].bytes).includes('419.53'), 'A5 is honoured');
  r = await run('text-to-pdf', { text: 'x', opts: { font: 'Times-Roman' } });
  ok(latin1(r.files[0].bytes).includes('/BaseFont /Times-Roman'), 'the Times face is used');
  r = await run('text-to-pdf', { text: 'x', opts: { font: 'Courier' } });
  ok(latin1(r.files[0].bytes).includes('/BaseFont /Courier'), 'the Courier face is used');
  r = await run('text-to-pdf', { text: 'x', opts: { font: 'Nonsense' } });
  ok(latin1(r.files[0].bytes).includes('/BaseFont /Helvetica'), 'an unknown face falls back');

  r = await run('text-to-pdf', { text: 'x', opts: { numbers: 'yes' } });
  ok(latin1(r.files[0].bytes).includes('(1) Tj'), 'page numbers are drawn when asked for');
  r = await run('text-to-pdf', { text: 'only line', opts: { numbers: 'no' } });
  ok(!latin1(r.files[0].bytes).includes('(1) Tj'), 'page numbers are omitted when not wanted');

  const fancyText = 'Smart “quotes”, an em—dash and a € sign';
  r = await run('text-to-pdf', { text: fancyText });
  const fancyEsc = core.contentEscape(fancyText);
  ok(!fancyEsc.includes('?'), 'the text escapes with no unrepresentable glyphs');
  ok(latin1(r.files[0].bytes).includes(`(${fancyEsc}) Tj`),
    'typographic characters are written as WinAnsi octal escapes');
  ok(fancyEsc.includes('\\223') && fancyEsc.includes('\\227') && fancyEsc.includes('\\200'),
    'the quote, em dash and euro each map to their WinAnsi slot');
  keep('out-winansi.pdf', r.files[0].bytes);
  r = await run('text-to-pdf', { text: 'a\n\nb' });
  ok(!r.error, 'blank lines are handled');
  r = await run('text-to-pdf', { text: 'word '.repeat(300) });
  ok(Number(statMap(r).get('Lines after wrapping')) > 1, 'long paragraphs wrap');
  r = await run('text-to-pdf', { text: 'x', opts: { size: 999 } });
  ok(!r.error, 'an absurd font size is clamped rather than failing');
  r = await run('text-to-pdf', { text: 'x', opts: { margin: 60, size: 36, leading: 3 } });
  ok(!r.error, 'extreme margins and leading still produce a page');

  /* =====================================================================
     invoice-pdf
     ===================================================================== */
  G('invoice-pdf');

  r = await run('invoice-pdf', {});
  ok(!r.error, 'the default invoice generates', r.error);
  eq(r.files[0].name, 'inv-0001.pdf', 'the invoice number becomes the filename');
  eq(await pagesOf(r.files[0].bytes), 1, 'the invoice is one page');
  eq(statMap(r).get('Line items'), '3', 'the three default line items are read');
  keep('out-invoice.pdf', r.files[0].bytes);

  /* 1×4500 + 12×45 + 1×15 = 5055; VAT at 20% = 1011; total 6066 */
  eq(statMap(r).get('Subtotal'), '£5,055.00', 'the subtotal is computed and formatted');
  eq(statMap(r).get('VAT 20%'), '£1,011.00', 'the tax line is computed');
  eq(statMap(r).get('Total due'), '£6,066.00', 'the grand total is subtotal plus tax');
  ok(latin1(r.files[0].bytes).includes('(INVOICE) Tj'), 'the invoice heading is drawn');
  eq((await (await PDFDocument.load(r.files[0].bytes)).getInfo()).Title, 'Invoice INV-0001',
    'the invoice number goes into the metadata title');

  r = await run('invoice-pdf', { opts: { items: 'One thing, 2, 10' } });
  eq(statMap(r).get('Subtotal'), '£20.00', 'a single line item multiplies out');
  r = await run('invoice-pdf', { opts: { items: 'Thing, with, commas, 1, 100' } });
  eq(statMap(r).get('Subtotal'), '£100.00', 'only the last two fields are read as numbers');
  r = await run('invoice-pdf', { opts: { items: 'Website, 1, 4,500', tax: 0 } });
  eq(statMap(r).get('Subtotal'), '£4,500.00', 'a western thousands comma stays inside the price');
  r = await run('invoice-pdf', { opts: { items: 'Fit-out, 1, 1,25,000', tax: 0 } });
  eq(statMap(r).get('Subtotal'), '£125,000.00', 'an Indian-grouped price is read whole');
  r = await run('invoice-pdf', { opts: { items: 'Consulting x2 @ 1,200', tax: 0 } });
  eq(statMap(r).get('Subtotal'), '£2,400.00', '"x2 @ 1,200" is read as written');
  r = await run('invoice-pdf', { opts: { items: 'Item,2,2,650' } });
  ok(!!r.error && /can be read 2 ways/.test(r.error), 'a line with two readings is reported, not guessed', r.error);
  r = await run('invoice-pdf', { opts: { items: 'Item, 2, 2,65' } });
  ok(!!r.error && /not a number with thousands separators/.test(r.error), 'a malformed grouped number is reported', r.error);
  r = await run('invoice-pdf', { opts: { items: 'A, 1, 100', tax: 0 } });
  eq(statMap(r).get('Total due'), '£100.00', 'zero tax leaves the total at the subtotal');
  r = await run('invoice-pdf', { opts: { items: 'A, 1, 100', tax: 5.5 } });
  eq(statMap(r).get('Total due'), '£105.50', 'a fractional tax rate is applied');
  r = await run('invoice-pdf', { opts: { items: 'A, 1, 100', taxLabel: 'GST', tax: 18 } });
  ok(statMap(r).has('GST 18%'), 'a custom tax label is used');

  for (const [cur, sym] of [['USD', '$'], ['EUR', '€'], ['INR', 'Rs']]) {
    r = await run('invoice-pdf', { opts: { items: 'A, 1, 10', currency: cur } });
    ok(String(statMap(r).get('Subtotal')).includes(sym), `the ${cur} symbol is used`);
  }

  r = await run('invoice-pdf', { opts: { items: '' } });
  ok(!!r.error, 'an invoice with no items is refused');
  ok(/at least one line item/i.test(r.error), 'the message asks for a line item');
  r = await run('invoice-pdf', { opts: { items: 'Just a description' } });
  ok(!!r.error, 'a line item with no numbers is refused');
  ok(/description, quantity, unit price/.test(r.error), 'the message explains the expected format');
  r = await run('invoice-pdf', { opts: { items: 'A, notanumber, 10' } });
  ok(!!r.error, 'a non-numeric quantity is refused');
  r = await run('invoice-pdf', { opts: { items: 'A, 1, 10', number: '' } });
  eq(r.files[0].name, 'invoice.pdf', 'a missing invoice number falls back in the filename');
  r = await run('invoice-pdf', { opts: { items: 'A, 1, 10', notes: '' } });
  ok(!r.error, 'the notes block is optional');
  r = await run('invoice-pdf', { opts: {
    items: Array.from({ length: 12 }, (_, i) => `Item ${i + 1}, 1, 10`).join('\n') } });
  eq(statMap(r).get('Line items'), '12', 'many line items are all read');
  ok(statMap(r).get('Due date'), 'a due date is computed from the payment terms');

  /* =====================================================================
     paper-pdf
     ===================================================================== */
  G('paper-pdf');

  for (const type of ['grid', 'lined', 'dot', 'iso', 'music', 'cornell', 'blank']) {
    r = await run('paper-pdf', { opts: { type } });
    ok(!r.error, `paper type "${type}" generates`, r.error);
    eq(await pagesOf(r.files[0].bytes), 1, `paper type "${type}" makes one page`);
    ok(Number(statMap(r).get('Drawing operations per page')) > 0,
      `paper type "${type}" draws something`);
  }

  r = await run('paper-pdf', { opts: { type: 'grid' } });
  eq(r.files[0].name, 'grid-paper-5mm.pdf', 'the filename records type and spacing');
  keep('out-grid.pdf', r.files[0].bytes);
  r = await run('paper-pdf', { opts: { type: 'music' } });
  keep('out-music.pdf', r.files[0].bytes);
  ok(latin1(r.files[0].bytes).includes(' l S'), 'music paper draws staff lines');

  r = await run('paper-pdf', { opts: { pages: 5 } });
  eq(await pagesOf(r.files[0].bytes), 5, 'a multi-page pad is produced');
  eq(statMap(r).get('Pages'), '5', 'the stats report the page count');
  r = await run('paper-pdf', { opts: { pages: 999 } });
  eq(await pagesOf(r.files[0].bytes), 100, 'the page count is clamped to 100');
  r = await run('paper-pdf', { opts: { orientation: 'landscape' } });
  ok(latin1(r.files[0].bytes).includes('[0 0 841.89 595.28]'), 'landscape swaps the page dimensions');
  ok(/landscape/.test(statMap(r).get('Page size')), 'the stats note the orientation');
  r = await run('paper-pdf', { opts: { pageSize: 'a3' } });
  ok(latin1(r.files[0].bytes).includes('1190.55'), 'A3 is honoured');

  const opsAt = async (spacing) => Number(statMap(await run('paper-pdf',
    { opts: { type: 'grid', spacing } })).get('Drawing operations per page'));
  ok(await opsAt(2) > await opsAt(20), 'tighter spacing produces more lines');
  r = await run('paper-pdf', { opts: { type: 'dot', spacing: 2 } });
  ok(r.warn && /dense/i.test(r.warn), 'a very dense dot grid warns about file size');
  r = await run('paper-pdf', { opts: { type: 'grid', spacing: 10 } });
  ok(!r.warn, 'a sensible grid produces no warning');
  r = await run('paper-pdf', { opts: { margin: 0 } });
  ok(!r.error, 'a zero margin is allowed');

  /* =====================================================================
     label-pdf
     ===================================================================== */
  G('label-pdf');

  r = await run('label-pdf', {});
  ok(!r.error, 'the default label sheet generates', r.error);
  eq(r.files[0].name, 'labels-3x7.pdf', 'the filename records the layout');
  eq(await pagesOf(r.files[0].bytes), 1, 'one sheet is produced');
  eq(statMap(r).get('Distinct labels'), '2', 'the two default label blocks are read');
  eq(statMap(r).get('Labels placed'), '21', 'a 3 × 7 sheet is filled to 21 labels');
  eq(statMap(r).get('Layout'), '3 × 7 on A4', 'the stats describe the layout');
  eq(statMap(r).get('Label size'), '63.5 × 38.1 mm', 'the stats give the label dimensions');
  keep('out-labels.pdf', r.files[0].bytes);

  for (const [layout, perSheet] of [['3x7', 21], ['2x8', 16], ['2x7', 14], ['1x10', 10], ['4x10', 40]]) {
    r = await run('label-pdf', { opts: { layout } });
    eq(statMap(r).get('Labels placed'), String(perSheet),
      `layout ${layout} holds ${perSheet} labels`);
  }

  r = await run('label-pdf', { opts: { items: 'Only one', repeat: 'once' } });
  eq(statMap(r).get('Labels placed'), '1', '"leave the rest blank" places a single label');
  eq(statMap(r).get('Sheets'), '1', 'a single label still needs one sheet');
  r = await run('label-pdf', { opts: { items: 'Only one', repeat: 'repeat' } });
  eq(statMap(r).get('Labels placed'), '21', '"repeat" fills the sheet from one label');
  r = await run('label-pdf', { opts: {
    items: Array.from({ length: 25 }, (_, i) => `Label ${i + 1}`).join('\n\n'), repeat: 'once' } });
  eq(statMap(r).get('Sheets'), '2', '25 labels on a 21-up sheet needs two sheets');
  eq(await pagesOf(r.files[0].bytes), 2, 'two sheets means two pages');
  r = await run('label-pdf', { opts: { items: '' } });
  ok(!!r.error, 'a label sheet with no text is refused');
  ok(/blank line/i.test(r.error), 'the message explains the blank-line separator');
  r = await run('label-pdf', { opts: { items: '   \n\n   ' } });
  ok(!!r.error, 'whitespace-only label text is refused');
  r = await run('label-pdf', { opts: { guides: 'yes' } });
  ok(latin1(r.files[0].bytes).includes('re S'), 'cutting guides draw label outlines');
  r = await run('label-pdf', { opts: { guides: 'no' } });
  ok(!latin1(r.files[0].bytes).includes('re S'), 'guides are omitted when not wanted');
  r = await run('label-pdf', { opts: { align: 'center' } });
  ok(!r.error, 'centred labels generate');
  r = await run('label-pdf', { opts: { items: 'A very long address line that will certainly need wrapping inside a narrow label' } });
  ok(!r.error, 'over-long label text is wrapped and clipped rather than failing');

  /* =====================================================================
     certificate-pdf
     ===================================================================== */
  G('certificate-pdf');

  r = await run('certificate-pdf', {});
  ok(!r.error, 'the default certificate batch generates', r.error);
  eq(r.files[0].name, 'certificates.pdf', 'a batch is named certificates.pdf');
  eq(await pagesOf(r.files[0].bytes), 3, 'three names give three pages');
  eq(statMap(r).get('Certificates'), '3', 'the stats count the certificates');
  eq(statMap(r).get('Orientation'), 'landscape', 'landscape is the default');
  keep('out-cert.pdf', r.files[0].bytes);

  const certStr = latin1(r.files[0].bytes);
  ok(certStr.includes('(Priya Sharma) Tj'), 'the first recipient is drawn');
  ok(certStr.includes('(James Okafor) Tj'), 'the second recipient is drawn');
  ok(certStr.includes('(Anna Kowalski) Tj'), 'the third recipient is drawn');
  ok(certStr.includes('[0 0 841.89 595.28]'), 'landscape A4 is used');

  r = await run('certificate-pdf', { opts: { names: 'Solo Person' } });
  eq(r.files[0].name, 'certificate-solo-person.pdf', 'a single certificate is named after the recipient');
  eq(await pagesOf(r.files[0].bytes), 1, 'one name gives one page');
  r = await run('certificate-pdf', { opts: { names: '' } });
  ok(!!r.error, 'a certificate with no names is refused');
  ok(/at least one recipient/i.test(r.error), 'the message asks for a name');
  r = await run('certificate-pdf', { opts: { names: '\n\n  \n' } });
  ok(!!r.error, 'whitespace-only names are refused');
  r = await run('certificate-pdf', {
    opts: { names: Array.from({ length: 501 }, (_, i) => 'Person ' + i).join('\n') } });
  ok(!!r.error, 'more than 500 certificates is refused');
  ok(/over 500/.test(r.error), 'the message gives the limit');
  r = await run('certificate-pdf', {
    opts: { names: Array.from({ length: 60 }, (_, i) => 'Person ' + i).join('\n') } });
  eq(await pagesOf(r.files[0].bytes), 60, 'a 60-name batch produces 60 pages');
  r = await run('certificate-pdf', { opts: { orientation: 'portrait' } });
  ok(latin1(r.files[0].bytes).includes('[0 0 595.28 841.89]'), 'portrait is honoured');
  r = await run('certificate-pdf', { opts: { heading: 'Award of Excellence' } });
  ok(latin1(r.files[0].bytes).includes('(Award of Excellence) Tj'), 'a custom heading is drawn');
  eq((await (await PDFDocument.load(r.files[0].bytes)).getInfo()).Title, 'Award of Excellence',
    'the heading becomes the document title');
  r = await run('certificate-pdf', { opts: { org: '', signatory: '', date: '' } });
  ok(!r.error, 'the optional blocks can all be omitted');
  eq(statMap(r).get('Date shown'), 'none', 'an omitted date is reported as none');

  /* =====================================================================
     The two render tools
     ===================================================================== */
  G('Render tools (no run() by design)');

  for (const id of byKind('render')) {
    const s = PDF_TOOLS[id];
    ok(s.needsRenderer === true, `${id}: needs the rendering engine`);
    ok(typeof s.run === 'undefined', `${id}: has no run(), the browser drives it`);
    ok(/download|rendering engine|thumbnail/i.test(s.tips.join(' ')),
      `${id}: the tips disclose the rendering-engine download`);
  }
  const toImg = PDF_TOOLS['pdf-to-images'];
  const dpi = toImg.controls.find(c => c.key === 'dpi');
  ok(dpi && dpi.options.some(o => o.value === '300'), 'pdf-to-images offers 300 DPI for print');
  const fmtCtl = toImg.controls.find(c => c.key === 'format');
  ok(fmtCtl.options.some(o => o.value === 'image/png'), 'pdf-to-images offers lossless PNG');
  ok(fmtCtl.options.every(o => /^image\//.test(o.value)),
    'every pdf-to-images format is a real MIME type');
  eq(PDF_TOOLS['pdf-organise'].controls.length, 0,
    'pdf-organise is driven entirely by its thumbnails');

  /* =====================================================================
     Cross-tool: a realistic pipeline
     ===================================================================== */
  G('Pipeline');

  const step1 = await run('merge-pdf', { docs: [c5, o4] });
  const step1Doc = { doc: await PDFDocument.load(step1.files[0].bytes),
                     name: 'merged.pdf', size: step1.files[0].bytes.length };
  eq(await step1Doc.doc.pageCount(), 9, 'stage 1: merge gives nine pages');

  const step2 = await run('delete-pdf-pages', { docs: [step1Doc], opts: { pages: '1' } });
  const step2Doc = { doc: await PDFDocument.load(step2.files[0].bytes),
                     name: 'trimmed.pdf', size: step2.files[0].bytes.length };
  eq(await step2Doc.doc.pageCount(), 8, 'stage 2: deleting a page gives eight');

  const step3 = await run('watermark-pdf', { docs: [step2Doc], opts: { text: 'FINAL' } });
  const step3Doc = { doc: await PDFDocument.load(step3.files[0].bytes),
                     name: 'wm.pdf', size: step3.files[0].bytes.length };
  eq(await step3Doc.doc.pageCount(), 8, 'stage 3: watermarking keeps eight pages');

  const step4 = await run('pdf-page-numbers', { docs: [step3Doc], opts: { format: 'n-of-t' } });
  const finalBytes = step4.files[0].bytes;
  const finalDoc = await PDFDocument.load(finalBytes);
  eq(await finalDoc.pageCount(), 8, 'stage 4: numbering keeps eight pages');
  keep('out-pipeline.pdf', finalBytes);

  const finalStr = latin1(finalBytes);
  ok(finalStr.includes('(FINAL) Tj'), 'the watermark survives a later pass');
  ok(finalStr.includes('(1 of 8) Tj'), 'the page numbers are added on top');
  const finalRes = await finalDoc.resolve((await finalDoc.getPages())[0].dict.Resources);
  const finalFonts = await finalDoc.resolve(finalRes.Font);
  ok(finalFonts.MVRwm !== undefined && finalFonts.MVRpn !== undefined,
    'both overlay fonts are bound after two stacked overlays');
  eq((await run('pdf-inspector', { docs: [{ doc: finalDoc, name: 'final.pdf',
    size: finalBytes.length }] })).stats.find(([k]) => k === 'Pages')[1], '8',
    'the inspector agrees the pipeline output has eight pages');

  /* =====================================================================
     Every shipped run(), with the defaults a visitor first sees
     ===================================================================== */
  G('Every shipped run() with its defaults');

  for (const id of ids) {
    const s = PDF_TOOLS[id];
    if (typeof s.run !== 'function') continue;
    const docs = s.kind === 'create' ? [] : s.multiple ? [c5, o4] : [c5];
    let res, threw = null;
    try { res = await run(id, { docs, text: s.inputLabel ? 'Hello world.' : '' }); }
    catch (e) { threw = e; }
    ok(!threw, `${id}: run() does not throw`, threw && (threw.message || String(threw)));
    if (threw) continue;
    const files = (res && res.files) || [];
    if (s.kind === 'create') {
      ok(!res.error && files.length >= 1, `${id}: the defaults produce a document`, res.error);
    } else if (s.kind === 'inspect') {
      ok(!res.error && typeof res.report === 'string' && res.report.length > 0, `${id}: the defaults produce a report`, res.error);
    } else {
      ok(files.length >= 1 || (typeof res.error === 'string' && res.error.trim().length > 0),
        `${id}: the defaults produce a file or say what is missing`);
    }
    let parsed = true, why = '';
    for (const f of files) {
      try { if (await pagesOf(f.bytes) < 1) { parsed = false; why = f.name + ' has no pages'; } }
      catch (e) { parsed = false; why = `${f.name}: ${e.message}`; }
    }
    if (files.length) ok(parsed, `${id}: every file it writes parses back with at least one page`, why);
  }

  /* =====================================================================
     The package copy must not drift from what ships
     ===================================================================== */
  G('pdftools.js mirrors the shipped engines');

  if (!PKG_TOOLS) {
    ok(true, 'no package copy present, nothing to compare');
  } else {
    const same = (a, b) => typeof a === 'function' || typeof b === 'function'
      ? typeof a === typeof b && String(a).replace(/\s+/g, ' ') === String(b).replace(/\s+/g, ' ')
      : JSON.stringify(a) === JSON.stringify(b);
    const copied = ids.filter(id => PKG_TOOLS[id]);
    console.log(`  ${copied.length} of ${ids.length} shipped tools have a copy in pdftools.js; ` +
      `${Object.keys(PKG_TOOLS).filter(id => !PDF_TOOLS[id]).length} specs there do not ship`);
    for (const id of copied) {
      const keys = [...new Set([...Object.keys(PKG_TOOLS[id]), ...Object.keys(PDF_TOOLS[id])])];
      const off = keys.filter(k => !same(PKG_TOOLS[id][k], PDF_TOOLS[id][k]));
      ok(!off.length, `${id}: the pdftools.js copy matches engine/pdf-${id}.js`, off.length ? 'differs in ' + off.join(', ') : '');
    }
  }

  /* ---------------------------------------------------------------- */
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`${pass + fail} assertions   ${pass} passed   ${fail} failed`);
  console.log(`output PDFs written to ${OUT}`);
  if (fail) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  · ' + f));
  }
  console.log();
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('\nSuite crashed:', e && e.stack || e);
  process.exit(1);
});
