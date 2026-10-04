/**
 * The real examples, published for the site.
 *
 *   node build-examples.js            write assets/examples.js and assets/img/examples/
 *   node build-examples.js --check    report what would change, write nothing
 *
 * build/promo/examples.js drives every tool in headless Chrome and keeps what
 * the tool itself produced, under %PROMO_HOME%/examples/<dir>/ (default
 * %USERPROFILE%/.1234tools-promo). That folder is the promotion desk's, full
 * of 1,200-pixel PNGs and an 8 MB clip, and it never ships. This script takes
 * the part a page can show:
 *
 *   assets/img/examples/<dir>/before.webp | after.webp | page.webp
 *       at most 720 px on the long edge and at most 60 KB each, encoded by
 *       Chrome's own canvas (toBlob 'image/webp', quality 0.78, stepped down
 *       only when a picture will not fit);
 *   assets/img/examples/<dir>/thumb.webp (+ thumb-before.webp)
 *       a 480 x 270 cover crop of the result for hub cards and the home
 *       strip, and of the original where the two line up;
 *   assets/img/examples/CREDITS.txt
 *       who took the stock photos, from build/promo/samples/LICENSES.md;
 *   assets/examples.js
 *       window.TOOL_EXAMPLES = { '/section/slug/': { kind, caption, inputs,
 *       results, try, input, output, stats, before, after, page, thumb, ... } }
 *
 * Only examples that ran (ok:true) are published, never a schematic one (it
 * is a drawing, not a result) and never one whose note mentions a failure.
 * Text is cut to 600 characters. Every sample is a CC0 stock photo or a
 * document the site's own generators made, so no visitor's data is in here.
 *
 * Output is deterministic: examples.js carries no dates of its own, keys are
 * sorted, and each image is re-encoded only when its source, or the settings
 * it is encoded with, change (a hash of both is kept in examples.js as `v`).
 * Inert on require.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const VERBOSE = process.argv.includes('--verbose');
const OUT_JS = 'assets/examples.js';
const IMG_DIR = 'assets/img/examples';
const URL_DIR = '/assets/img/examples';
const CHROME = process.env.PROMO_CHROME || process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/* The encoder settings. A change here re-encodes everything, which is what
   the hash below is for. */
const ENC = { long: 720, quality: 0.78, floor: 0.4, maxBytes: 60 * 1024, thumbW: 480, thumbH: 270, thumbQ: 0.72, rev: 1 };
const TEXT_MAX = 600;
const FAIL_NOTE = /\b(fail(ed|s|ure)?|error|could ?n[o']t|crash(ed)?|timed? ?out|exception)\b/i;
/* The kinds a page can show. A schematic is a drawing: it is left out. */
const SHOWN = new Set(['calc', 'text', 'beforeAfter', 'document', 'image']);

const E = () => require('./build/promo/examples.js');

/* ------------------------------------------------------------------ */
/* the tools                                                          */
/* ------------------------------------------------------------------ */

function finderTools() {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/finder-index.js'), 'utf8'))(w);
  return w.FINDER_INDEX.tools.map((r) => ({ title: String(r[0]), path: '/' + String(r[1]).replace(/^\/+/, '').replace(/\/?$/, '/') }))
    .filter((t) => t.path.indexOf('/conversions/') !== 0);
}

const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

function trimText(s) {
  s = String(s || '').replace(/\r\n/g, '\n');
  if (s.length <= TEXT_MAX) return s;
  return s.slice(0, TEXT_MAX - 1).replace(/[\uD800-\uDBFF]$/, '').replace(/\s+\S*$/, '') + '…';
}

function day(iso) { return /^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? String(iso).slice(0, 10) : ''; }

/** Fit [w, h] inside `long` on the long edge, never enlarging. */
function fit(size, long) {
  const [w, h] = size;
  const s = Math.min(1, long / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

/** The size of an image file, read from its own header (the capture engine's reader). */
function sizeOf(abs) {
  const s = E().imageSize(fs.readFileSync(abs));
  if (!s) throw new Error('cannot read the size of ' + abs);
  return s;
}

/* How a card's 16:9 picture is cut: a document is read from its top; a
   tall picture (a 9:16 video frame) is shown whole, over a dimmed, blurred
   copy of itself, so the captions and the face both stay in; anything else
   is cropped from the middle. */
function cropFor(kind, size) {
  if (kind === 'document') return { mode: 'cover', focus: 0 };
  if (size[1] > size[0] * 1.25) return { mode: 'frame', focus: 0.5 };
  return { mode: 'cover', focus: 0.5 };
}

/* What the example was made from, for the credit line under it. */
function sourceOf(spec) {
  const k = spec && spec.kind;
  if (k === 'image') return 'stock-photo';
  if (k === 'video') return 'stock-photo-voice';
  if (k === 'pdf-edit') return 'sample-pdf';
  if (k === 'pdf-make') return 'example-details';
  if (k === 'qr') return 'example-details';
  return 'example-inputs';
}

/* ------------------------------------------------------------------ */
/* the plan: what each tool publishes, without encoding anything      */
/* ------------------------------------------------------------------ */

function linkFor(j) {
  const spec = j.spec || {};
  const q = [];
  const add = (k, v) => { if (v === undefined || v === null || v === '') return; if (!q.some((p) => p[0] === k)) q.push([k, String(v)]); };
  if (spec.kind === 'converter') {
    const fx = /\/currency-converter\/$/.test(j.tool);
    add(fx ? 'amount' : 'v', spec.value);
    add('from', spec.from);
    add('to', spec.to);
  } else if (spec.kind === 'calc') {
    const refused = new Set();
    const m = /did not take ([^(]+)\(/.exec(j.note || '');
    if (m) m[1].split(',').forEach((k) => refused.add(k.trim()));
    const asked = spec.inputs || {};
    for (const k of Object.keys(asked)) if (!refused.has(k)) add(k, asked[k]);
    /* Fields the spec left at the page's default but whose shown value is
       already the raw one (a number, a date): carried too, so a date that
       defaults to "today" still reproduces the captured answer. A select
       shows its label, not its value, and is left to its default. */
    for (const f of j.inputs || []) {
      if (!f.key || refused.has(f.key)) continue;
      const v = String(f.value);
      if (/^-?\d+(\.\d+)?$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v)) add(f.key, v);
    }
  } else if (spec.kind === 'text') {
    add('text', j.input);
  }
  if (!q.length) return '';
  return '#' + q.map((p) => encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1])).join('&');
}

function plan() {
  const ex = E();
  const tools = finderTools().sort((a, b) => a.path.localeCompare(b.path));
  const out = {};
  const jobs = [];
  const skipped = { missing: [], failed: [], schematic: [], notShown: [], failNote: [] };
  for (const t of tools) {
    const j = ex.read(t.path);
    if (!j) { skipped.missing.push(t.path); continue; }
    if (!j.ok) { skipped.failed.push(t.path); continue; }
    if (j.kind === 'schematic') { skipped.schematic.push(t.path); continue; }
    if (!SHOWN.has(j.kind)) { skipped.notShown.push(t.path + ' (' + j.kind + ')'); continue; }
    if (j.note && FAIL_NOTE.test(j.note)) { skipped.failNote.push(t.path + ': ' + j.note); continue; }

    const srcDir = ex.dirFor(t.path);
    const dir = path.basename(srcDir);
    const spec = j.spec || {};
    const rec = { kind: j.kind, dir, title: t.title, captured: day(j.captured), source: sourceOf(spec) };

    if (j.kind === 'calc') {
      rec.inputs = (j.inputs || []).map((f) => ({ label: String(f.label || ''), value: trimText(f.value) }));
      rec.results = (j.results || []).filter((r) => r.value && r.label !== 'Error').slice(0, 8)
        .map((r) => ({ label: String(r.label || ''), value: String(r.value), primary: !!r.primary }));
      if (!rec.results.some((r) => r.primary) && rec.results.length) rec.results[0].primary = true;
      rec.try = linkFor(j);
      rec.form = spec.kind === 'converter' ? (/\/currency-converter\/$/.test(t.path) ? 'currency' : 'converter') : 'calc';
      if (j.message) rec.message = trimText(j.message);
      rec.caption = t.title + ': the figures above, put through the live tool';
    } else if (j.kind === 'text') {
      rec.input = trimText(j.input);
      rec.output = trimText(j.output);
      rec.inputLabel = String(j.inputLabel || 'Input');
      rec.outputLabel = String(j.outputLabel || 'Output');
      rec.try = String(j.input || '').length <= 2000 ? linkFor(j) : '';
      rec.caption = t.title + ': this input, put through the live tool';
    } else {
      rec.caption = String(j.caption || t.title).replace(/\s+/g, ' ').trim();
    }
    if (Array.isArray(j.stats) && j.stats.length) {
      rec.stats = j.stats.filter((s) => Array.isArray(s) && s.length >= 2 && String(s[1]).trim())
        .slice(0, 6).map((s) => [String(s[0]), String(s[1])]);
    }

    /* the pictures */
    const pics = [];
    const want = (role, file) => {
      if (!file) return;
      const abs = path.join(srcDir, file);
      if (!fs.existsSync(abs)) throw new Error(t.path + ': ' + file + ' is named in example.json but is not in ' + srcDir);
      const size = sizeOf(abs);
      pics.push({ role, abs, size, out: fit(size, ENC.long) });
    };
    if (j.kind === 'beforeAfter') { want('before', j.before); want('after', j.after); }
    if (j.kind === 'document') want('page', j.page);
    if (j.kind === 'image') want('after', j.after);

    if (pics.length) {
      const main = pics.find((p) => p.role === 'after') || pics.find((p) => p.role === 'page');
      const before = pics.find((p) => p.role === 'before');
      const aspect = (s) => s[0] / s[1];
      const lined = !!(before && main && Math.abs(aspect(before.size) - aspect(main.size)) / aspect(main.size) < 0.03);
      const crop = cropFor(j.kind, main.size);
      const enc = [];
      for (const p of pics) {
        const name = p.role + '.webp';
        rec[p.role] = URL_DIR + '/' + dir + '/' + name;
        rec[p.role + 'Size'] = p.out;
        enc.push({ src: p.abs, file: name, mode: 'fit', w: p.out[0], h: p.out[1] });
      }
      rec.thumb = URL_DIR + '/' + dir + '/thumb.webp';
      rec.thumbSize = [ENC.thumbW, ENC.thumbH];
      enc.push({ src: main.abs, file: 'thumb.webp', mode: crop.mode, w: ENC.thumbW, h: ENC.thumbH, focus: crop.focus });
      if (lined) {
        rec.thumbBefore = URL_DIR + '/' + dir + '/thumb-before.webp';
        enc.push({ src: before.abs, file: 'thumb-before.webp', mode: crop.mode, w: ENC.thumbW, h: ENC.thumbH, focus: crop.focus });
      }
      rec.slider = lined;
      const h = crypto.createHash('sha1');
      h.update(JSON.stringify(ENC));
      for (const e of enc) { h.update(e.file + JSON.stringify([e.mode, e.w, e.h, e.focus])); h.update(fs.readFileSync(e.src)); }
      rec.v = h.digest('hex').slice(0, 12);
      jobs.push({ tool: t.path, dir, v: rec.v, enc });
    }
    out[t.path] = rec;
  }
  return { out, jobs, skipped, total: tools.length };
}

/* ------------------------------------------------------------------ */
/* the encoder: Chrome's canvas, in one headless browser              */
/* ------------------------------------------------------------------ */

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(ROOT, '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found (npm install puppeteer-core)');
}

async function encodeAll(jobs) {
  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-gpu'] });
  const results = [];
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    for (const job of jobs) {
      for (const e of job.enc) {
        const type = /\.png$/i.test(e.src) ? 'image/png' : 'image/jpeg';
        const b64 = fs.readFileSync(e.src).toString('base64');
        const got = await page.evaluate(async (b64, type, e, ENC) => {
          const bin = atob(b64);
          const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          const bmp = await createImageBitmap(new Blob([u8], { type }));
          const draw = (w, h) => {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d');
            g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
            const cover = () => {
              const s = Math.max(w / bmp.width, h / bmp.height);
              const sw = w / s, sh = h / s;
              const sx = (bmp.width - sw) / 2;
              const sy = Math.max(0, Math.min(bmp.height - sh, bmp.height * e.focus - sh / 2));
              g.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
            };
            if (e.mode === 'cover') cover();
            else if (e.mode === 'frame') {
              g.filter = 'blur(14px) brightness(0.55)';
              cover();
              g.filter = 'none';
              const s = Math.min(w / bmp.width, h / bmp.height);
              const dw = Math.round(bmp.width * s), dh = Math.round(bmp.height * s);
              g.drawImage(bmp, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
            } else g.drawImage(bmp, 0, 0, w, h);
            return c;
          };
          const blobOf = (c, q) => new Promise((r) => c.toBlob(r, 'image/webp', q));
          const limit = e.mode !== 'fit' ? ENC.maxBytes / 2 : ENC.maxBytes;
          let w = e.w, h = e.h, q = e.mode !== 'fit' ? ENC.thumbQ : ENC.quality, blob, tries = 0;
          let c = draw(w, h);
          for (;;) {
            blob = await blobOf(c, q);
            tries++;
            if (blob.size <= limit) break;
            if (q > ENC.floor + 1e-9) { q = Math.max(ENC.floor, Math.round((q - 0.08) * 100) / 100); continue; }
            if (e.mode !== 'fit' || tries > 40) break;
            w = Math.round(w * 0.88); h = Math.round(h * 0.88); q = ENC.quality; c = draw(w, h);
          }
          const buf = new Uint8Array(await blob.arrayBuffer());
          let s = '';
          for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
          return { b64: btoa(s), w, h, q, bytes: blob.size, type: blob.type };
        }, b64, type, e, ENC);
        if (got.type !== 'image/webp') throw new Error('this Chrome did not encode WebP (' + got.type + ')');
        results.push({ job, e, got });
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* credits                                                            */
/* ------------------------------------------------------------------ */

function credits() {
  const md = fs.readFileSync(path.join(ROOT, 'build/promo/samples/LICENSES.md'), 'utf8');
  const rows = md.split('\n').filter((l) => /^\| `[a-z]+\.jpg` \|/.test(l)).map((l) => l.split('|').map((c) => c.trim()));
  const link = (cell) => { const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(cell); return m ? { text: m[1], url: m[2] } : { text: cell, url: '' }; };
  const lines = [
    'Photo credits for the examples on 1234Tools',
    '=============================================',
    '',
    'The before-and-after examples on the tool pages were made by the tools',
    'themselves, run on these sample photos. Each comes from Wikimedia Commons,',
    'where its file page carries a CC0 1.0 Universal Public Domain Dedication',
    '(https://creativecommons.org/publicdomain/zero/1.0/), so no attribution',
    'is required. The photographers are credited here all the same.',
    ''
  ];
  for (const r of rows) {
    const file = r[1].replace(/`/g, '');
    const page = link(r[3]);
    lines.push(file + ' - ' + r[2]);
    lines.push('  by ' + r[4] + ', CC0 1.0');
    lines.push('  ' + page.url);
    lines.push('');
  }
  lines.push('The voice in the Auto Captions example is synthesised speech; the PDF');
  lines.push('examples start from sample documents the site\'s own generators made.');
  lines.push('');
  lines.push('People who can be recognised in a photo appear only to show what a tool');
  lines.push('does. Their appearance does not mean they endorse 1234Tools.');
  lines.push('');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */

function previous() {
  const abs = path.join(ROOT, OUT_JS);
  if (!fs.existsSync(abs)) return {};
  try {
    const w = {};
    new Function('window', fs.readFileSync(abs, 'utf8'))(w);
    return w.TOOL_EXAMPLES || {};
  } catch (e) { return {}; }
}

function body(out) {
  const keys = Object.keys(out).sort();
  const sorted = {};
  for (const k of keys) sorted[k] = out[k];
  return '/* Generated by build-examples.js from the captured examples — do not edit. */\n' +
    'window.TOOL_EXAMPLES=' + JSON.stringify(sorted).replace(/<\//g, '<\\/') + ';\n';
}

function dirBytes(abs) {
  let n = 0, files = 0, largest = 0, largestName = '';
  if (!fs.existsSync(abs)) return { n, files, largest, largestName };
  (function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else {
        const s = fs.statSync(p).size;
        n += s; files++;
        if (/\.webp$/.test(ent.name) && s > largest) { largest = s; largestName = path.relative(abs, p).replace(/\\/g, '/'); }
      }
    }
  })(abs);
  return { n, files, largest, largestName };
}

async function main() {
  const { out, jobs, skipped, total } = plan();
  const prev = previous();
  const imgRoot = path.join(ROOT, IMG_DIR);

  /* an image is re-encoded when its hash moved or a file is missing */
  const stale = jobs.filter((j) => {
    const p = prev[j.tool];
    if (!p || p.v !== j.v) return true;
    return j.enc.some((e) => !fs.existsSync(path.join(imgRoot, j.dir, e.file)));
  });
  /* an image kept from the last run keeps the size it was written at (the
     encoder may have had to make it smaller to stay under 60 KB) */
  const fresh = new Set(stale.map((j) => j.tool));
  for (const j of jobs) {
    if (fresh.has(j.tool)) continue;
    for (const k of ['beforeSize', 'afterSize', 'pageSize']) if (prev[j.tool][k] && out[j.tool][k]) out[j.tool][k] = prev[j.tool][k];
  }

  /* folders and files nobody publishes any more */
  const wanted = new Map(jobs.map((j) => [j.dir, new Set(j.enc.map((e) => e.file))]));
  const orphans = [];
  if (fs.existsSync(imgRoot)) {
    for (const ent of fs.readdirSync(imgRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) { if (ent.name !== 'CREDITS.txt') orphans.push(ent.name); continue; }
      const keep = wanted.get(ent.name);
      if (!keep) { orphans.push(ent.name + '/'); continue; }
      for (const f of fs.readdirSync(path.join(imgRoot, ent.name))) if (!keep.has(f)) orphans.push(ent.name + '/' + f);
    }
  }

  const js = body(out);
  const jsAbs = path.join(ROOT, OUT_JS);
  const jsChanged = (fs.existsSync(jsAbs) ? fs.readFileSync(jsAbs, 'utf8') : null) !== js;
  const cred = credits();
  const credAbs = path.join(imgRoot, 'CREDITS.txt');
  const credChanged = (fs.existsSync(credAbs) ? fs.readFileSync(credAbs, 'utf8') : null) !== cred;

  let encoded = [];
  const tooBig = [];
  if (!CHECK) {
    if (stale.length) encoded = await encodeAll(stale);
    for (const r of encoded) {
      const abs = path.join(imgRoot, r.job.dir, r.e.file);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const buf = Buffer.from(r.got.b64, 'base64');
      fs.writeFileSync(abs, buf);
      /* the page states this size in width/height: it must be true */
      if (r.got.w !== r.e.w || r.got.h !== r.e.h) {
        const rec = out[r.job.tool];
        const role = r.e.file.replace(/\.webp$/, '');
        if (rec[role + 'Size']) rec[role + 'Size'] = [r.got.w, r.got.h];
      }
    }
    for (const o of orphans) fs.rmSync(path.join(imgRoot, o), { recursive: true, force: true });
    fs.mkdirSync(imgRoot, { recursive: true });
    if (credChanged) fs.writeFileSync(credAbs, cred);
  }
  const finalJs = body(out);
  if (!CHECK && (fs.existsSync(jsAbs) ? fs.readFileSync(jsAbs, 'utf8') : null) !== finalJs) fs.writeFileSync(jsAbs, finalJs);

  /* the limits, asserted on what is on disk */
  for (const j of jobs) {
    for (const e of j.enc) {
      const abs = path.join(imgRoot, j.dir, e.file);
      if (!fs.existsSync(abs)) { if (!CHECK) tooBig.push(j.dir + '/' + e.file + ' missing'); continue; }
      const s = fs.statSync(abs).size;
      if (s > ENC.maxBytes) tooBig.push(j.dir + '/' + e.file + ' ' + (s / 1024).toFixed(1) + ' KB');
    }
  }
  const disk = dirBytes(imgRoot);
  const kinds = {};
  for (const k of Object.keys(out)) kinds[out[k].kind] = (kinds[out[k].kind] || 0) + 1;

  console.log('\nbuild-examples.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  examples home       ' + E().dirFor('/x/').replace(/[\\/]x$/, ''));
  console.log('  tools               ' + total + ' (non-conversion)');
  console.log('  published           ' + Object.keys(out).length + ' (' + Object.entries(kinds).sort().map((k) => k[0] + ' ' + k[1]).join(', ') + ')');
  console.log('  left out            schematic ' + skipped.schematic.length + ', not captured ' + skipped.missing.length +
    ', failed ' + skipped.failed.length + ', failure in note ' + skipped.failNote.length + (skipped.notShown.length ? ', other kind ' + skipped.notShown.length : ''));
  if (VERBOSE || skipped.missing.length) skipped.missing.forEach((p) => console.log('    not captured: ' + p));
  skipped.failed.forEach((p) => console.log('    failed: ' + p));
  skipped.failNote.forEach((p) => console.log('    note: ' + p));
  console.log('  images              ' + jobs.reduce((a, j) => a + j.enc.length, 0) + ' for ' + jobs.length + ' tools; ' +
    (CHECK ? stale.length + ' tool(s) would be encoded' : encoded.length + ' encoded now'));
  if (orphans.length) console.log('  stale files         ' + orphans.length + (CHECK ? ' would be removed' : ' removed') + ': ' + orphans.slice(0, 6).join(', '));
  console.log('  on disk             ' + (disk.n / 1024 / 1024).toFixed(2) + ' MB in ' + disk.files + ' files (target 5 MB); largest ' +
    (disk.largest / 1024).toFixed(1) + ' KB ' + disk.largestName);
  console.log('  assets/examples.js  ' + (Buffer.byteLength(finalJs) / 1024).toFixed(1) + ' KB');
  if (tooBig.length) {
    console.error('\n  ! over 60 KB or missing:\n    ' + tooBig.join('\n    '));
    process.exitCode = 1;
  }
  if (disk.n > 5 * 1024 * 1024) console.log('  ! over the 5 MB target');
  const changed = (CHECK ? stale.length : encoded.length ? new Set(encoded.map((r) => r.job.dir)).size : 0) + (jsChanged ? 1 : 0) + (credChanged ? 1 : 0) + (orphans.length ? 1 : 0);
  console.log('\n  ' + changed + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
module.exports = { plan, credits, ENC };
