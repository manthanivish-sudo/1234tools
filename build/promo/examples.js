'use strict';
/**
 * Real examples for promotional kits.
 *
 * A kit never shows made-up figures or mock-ups. This engine opens the live
 * tool page in headless Chrome, against a local server of the repo, does what
 * a person would do (types the values, uploads the sample, presses the
 * button), and keeps what the tool itself produced:
 *
 *   %PROMO_HOME%/examples/<slug>/example.json   (+ before/after/page images)
 *
 * PROMO_HOME defaults to %USERPROFILE%/.1234tools-promo. <slug> is the tool's
 * last path segment; the one slug two finder tools share (background-remover,
 * in /image/ and /ai-image/) becomes <section>-<slug> for both. Use dirFor()
 * or read() rather than building the path by hand.
 *
 *   const E = require('./examples');
 *   await E.capture('/india/gst-calculator/', { kind: 'calc', inputs: { amount: 11800, mode: 'inclusive' } })
 *   await E.captureMany([{ tool, example }, ...])      one browser for the lot
 *   E.read('/india/gst-calculator/')                    the cached example.json, or null
 *
 *   node build/promo/examples.js capture <toolPath> [--fresh] [--spec '<json>']
 *   node build/promo/examples.js capture-all [--section s] [--kind k] [--fresh]
 *   node build/promo/examples.js show <toolPath>
 *
 * Example kinds (the story's `example`, see the kit contract section 2):
 *   calc       inputs {key: value}      ?key=value on the calculator; every input's label and
 *                                       displayed value, every result row as shown
 *   converter  value, from, to          ?v= plus the From/To selects (unit key or its label)
 *   text       input, options?          ?text= on a text-in/text-out tool; the output pane
 *   qr         text, style?, type?, fields?   the QR generator, saved as after.png
 *   pdf-make   fields? {controlKey: value}    presses Create PDF, renders page 1 (page1.png)
 *   pdf-edit   sample invoice|letter|report, options?   makes the sample with the site's
 *                                       own generators, runs the tool, renders before/after
 *   image      sample portrait|product|street|landscape|pet|food|document|group, options?
 *   video      sample speech            Auto Captions on a clip with real speech
 *   schematic  input, output, sampleIn?, sampleOut?   nothing is run
 *
 * Image `options` on /ai-image/: `text` or `title` (text-behind-image, thumbnail-maker), `sky`
 * (sky-replacement: clear-blue, soft-clouds, golden-hour, sunset, dusk-pink, storm, overcast,
 * night-stars), `preset` (color-pop, film-grain), `remove` / `removeAllPeople` (object-remover),
 * `scale` 2|4 (image-upscaler), `keep` (a layer-name regex: tick only those layers), any key
 * whose control id ends in -<key> (style -> #aiimg-blur-style, move -> #aiimg-par-move) or
 * chip with data-<key> (frame -> [data-frame="9:16"]), and any '#id' / '.class' selector
 * (a value sets the control, true clicks it). On /image/ tools options are the control keys
 * (format, quality, ratio, ...), and `area` {x0,y0,x1,y1} is the drag for croppers and
 * redactors. pdf-edit `options` and pdf-make `fields` are control keys (fields.text fills
 * text-to-pdf's main box).
 *
 * Every example.json carries { tool, kind, captured, source, ok, note }. A failure is
 * ok:false with the reason in note; nothing is ever filled in by hand. A cached example is
 * reused while it succeeded and neither its spec nor its sample photo has changed; failures
 * are retried on the next run.
 *
 * Inert on require: nothing is launched or read until a function is called.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.PROMO_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SAMPLES = path.join(__dirname, 'samples');
const SAMPLE_NAMES = ['portrait', 'product', 'street', 'landscape', 'pet', 'food', 'document', 'group'];
const SAMPLE_WORDS = {
  portrait: 'a portrait', product: 'a product photo of a coffee cup', street: 'a street photo', landscape: 'a landscape',
  pet: 'a photo of a dog', food: 'a food photo', document: 'a photo of a receipt', group: 'a group photo'
};
const PORT_MIN = 8740, PORT_MAX = 8749;
const SPEECH = 'Most people watch videos with the sound off. Captions keep them watching, and they only take a minute to add.';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const T = () => require('./tools');

/* ------------------------------------------------------------------ */
/* paths                                                              */
/* ------------------------------------------------------------------ */

function home() { return process.env.PROMO_HOME || path.join(os.homedir(), '.1234tools-promo'); }
function examplesDir() { return path.join(home(), 'examples'); }
function normPath(p) { return T().normPath(p); }

let finderCache = null;
function finder(root) {
  if (finderCache) return finderCache;
  const rows = new Map();
  const bySlug = new Map();
  try {
    const w = {};
    // eslint-disable-next-line no-new-func
    new Function('window', fs.readFileSync(path.join(root || ROOT, 'assets', 'finder-index.js'), 'utf8'))(w);
    for (const r of w.FINDER_INDEX.tools) {
      const p = normPath(r[1]);
      rows.set(p, { title: r[0], path: p, section: r[3], io: r[6] });
      const s = p.split('/').filter(Boolean).pop();
      bySlug.set(s, (bySlug.get(s) || 0) + 1);
    }
  } catch (e) { /* no index: slugs stay plain */ }
  finderCache = { rows, bySlug };
  return finderCache;
}

/** Folder name for a tool: its slug, or section-slug where two tools share the slug. */
function slugFor(toolPath) {
  const parts = normPath(toolPath).split('/').filter(Boolean);
  const slug = parts[parts.length - 1] || 'home';
  return (finder().bySlug.get(slug) || 0) > 1 && parts.length > 1 ? parts[0] + '-' + slug : slug;
}
function dirFor(toolPath) { return path.join(examplesDir(), slugFor(toolPath)); }
function titleOf(toolPath) {
  const r = finder().rows.get(normPath(toolPath));
  if (r) return r.title;
  const s = normPath(toolPath).split('/').filter(Boolean).pop() || '';
  return s.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** The cached example.json for a tool, or null. */
function read(toolPath) {
  try { return JSON.parse(fs.readFileSync(path.join(dirFor(toolPath), 'example.json'), 'utf8')); }
  catch (e) { return null; }
}

/* ------------------------------------------------------------------ */
/* image sizes, so the json and the tests can say what was saved      */
/* ------------------------------------------------------------------ */

function imageSize(buf) {
  if (!buf || buf.length < 30) return null;
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + len;
    }
    return null;
  }
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    const c = buf.toString('latin1', 12, 16);
    if (c === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
    if (c === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (c === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* what every page gets before its own scripts run                    */
/* ------------------------------------------------------------------ */

/* Runs in the page. Declines analytics (the banner covers buttons), records
   every Blob handed to URL.createObjectURL so a download can be read back
   without touching the disk, and carries the small helpers the drivers use. */
function pageHook() {
  try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* private mode */ }
  const blobs = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = function (o) {
    const u = orig.call(URL, o);
    try { if (o && typeof o.size === 'number' && typeof o.type === 'string' && blobs.length < 2000) blobs.push({ url: u, blob: o }); } catch (e) { /* not a blob */ }
    return u;
  };
  const toB64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  const fromB64 = (b64) => { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
  const P = window.__promo = {
    blobs,
    count: () => blobs.length,
    since: (n) => blobs.slice(n).map((b, k) => ({ i: n + k, url: b.url, type: b.blob.type, size: b.blob.size })),
    b64: (i) => toB64(blobs[i].blob),
    async urlB64(u) {
      const hit = blobs.find((b) => b.url === u);
      const blob = hit ? hit.blob : await (await fetch(u)).blob();
      return { type: blob.type, size: blob.size, b64: await toB64(blob) };
    },
    toB64, fromB64,
    text: (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : ''),
    visible: (el) => !!(el && !el.hidden && el.offsetParent !== null),
    setField(el, v) {
      if (!el) return false;
      if (el.tagName === 'SELECT') {
        const s = String(v).toLowerCase();
        const opts = [...el.options];
        const o = opts.find((x) => x.value === String(v)) || opts.find((x) => x.textContent.trim().toLowerCase() === s)
          || opts.find((x) => x.textContent.toLowerCase().indexOf(s) >= 0);
        if (!o) return false;
        el.value = o.value;
      } else if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = !(v === false || v === 'false' || v === 'no' || v === 0 || v === '0');
      } else {
        const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
        if (d && d.set) d.set.call(el, String(v)); else el.value = String(v);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    clickText(scope, re) {
      const r = new RegExp(re);
      for (const b of document.querySelectorAll(scope)) if (r.test(b.textContent.trim()) && !b.disabled) { b.click(); return true; }
      return false;
    },
    stats(root) {
      return [...(root || document).querySelectorAll('.stat-grid .stat-row')].map((r) => [P.text(r.querySelector('.stat-key')), P.text(r.querySelector('.stat-val'))]).filter((r) => r[0] || r[1]);
    },
    /* A photo, scaled to fit max px, as a JPEG. */
    async scaleJpeg(b64, max, q) {
      const bmp = await createImageBitmap(new Blob([fromB64(b64)], { type: 'image/jpeg' }));
      let w = bmp.width, h = bmp.height;
      if (Math.max(w, h) > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q || 0.9));
      return { b64: await toB64(blob), w, h };
    },
    /* Any image blob URL re-encoded as PNG (for WebP or GIF results). */
    async toPng(u) {
      const blob = await (await fetch(u)).blob();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      const png = await new Promise((r) => c.toBlob(r, 'image/png'));
      return { b64: await toB64(png), type: 'image/png', from: blob.type };
    },
    /* One frame of a video (blob URL or File), at a fraction of its length, as JPEG. */
    async videoFrame(src, at, q) {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.src = typeof src === 'string' ? src : URL.createObjectURL(src);
      await new Promise((res) => { v.onloadedmetadata = res; v.onerror = res; setTimeout(res, 15000); });
      let d = v.duration;
      if (!isFinite(d)) { v.currentTime = 1e6; await new Promise((res) => { v.ontimeupdate = res; setTimeout(res, 5000); }); d = v.duration; }
      const t = isFinite(d) ? d * at : 2;
      await new Promise((res) => { v.onseeked = () => setTimeout(res, 300); v.onerror = res; v.currentTime = t; setTimeout(res, 15000); });
      const c = document.createElement('canvas'); c.width = v.videoWidth || 1080; c.height = v.videoHeight || 1920;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q || 0.9));
      return { b64: await toB64(blob), w: c.width, h: c.height, t, duration: d };
    },
    /* PDFs rendered with the site's own pdf.js. One page: that page at `width`.
       Several: a strip of pages, each `pageWidth` wide, on a transparent ground. */
    async renderPdf(list, o) {
      const base = location.origin + '/engine/vendor/pdfjs/';
      const lib = await import(base + 'pdf.min.mjs');
      lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
      const canvases = [], counts = [];
      for (const d of list) {
        const pdf = await lib.getDocument({ data: fromB64(d.b64), cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/' }).promise;
        counts.push(pdf.numPages);
        let pages = d.pages === 'all' ? Array.from({ length: Math.min(pdf.numPages, d.max || 4) }, (_, i) => i + 1) : (d.pages || [1]);
        pages = pages.filter((p) => p >= 1 && p <= pdf.numPages);
        for (const p of pages) {
          const page = await pdf.getPage(p);
          const one = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: o.pageWidth / one.width });
          const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
          const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext: x, viewport: vp }).promise;
          canvases.push(c);
        }
        await pdf.destroy();
      }
      if (!canvases.length) throw new Error('no page to render');
      let out = canvases[0];
      if (canvases.length > 1) {
        const gap = Math.round(o.pageWidth * 0.05);
        out = document.createElement('canvas');
        out.width = canvases.reduce((s, c) => s + c.width, 0) + gap * (canvases.length - 1);
        out.height = Math.max(...canvases.map((c) => c.height));
        const x = out.getContext('2d');
        let left = 0;
        for (const c of canvases) { x.drawImage(c, left, 0); left += c.width + gap; }
      }
      const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
      return { b64: await toB64(blob), w: out.width, h: out.height, counts };
    }
  };
}

/* ------------------------------------------------------------------ */
/* browser session                                                    */
/* ------------------------------------------------------------------ */

function loadPuppeteer() {
  try { return require('puppeteer-core'); } catch (e) { return require(path.join(ROOT, 'node_modules', 'puppeteer-core')); }
}

/** One local server and one Chrome, shared by every capture until close(). */
async function open(opts) {
  opts = opts || {};
  const { serve } = require('../tests/serve.js');
  const root = path.resolve(opts.root || ROOT);
  const ports = opts.port ? [Number(opts.port)] : Array.from({ length: PORT_MAX - PORT_MIN + 1 }, (_, i) => PORT_MIN + i);
  let server = null, port = null;
  for (const p of ports) {
    if (!(p >= PORT_MIN && p <= PORT_MAX)) throw new Error('port ' + p + ' is outside ' + PORT_MIN + '-' + PORT_MAX);
    const s = await serve(root, p);
    if (s) { server = s; port = p; break; }
  }
  if (!server) throw new Error('no free port in ' + ports.join(', '));
  const browser = await loadPuppeteer().launch({
    executablePath: CHROME, headless: true, protocolTimeout: 1200000,
    args: ['--no-first-run', '--window-size=1400,1000', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebGPU']
  });
  return { browser, server, port, root, base: 'http://127.0.0.1:' + port, memo: {}, log: opts.onLog || (() => {}) };
}

async function close(session) {
  if (!session) return;
  try { await session.browser.close(); } catch (e) { /* already gone */ }
  try { session.server.close(); } catch (e) { /* already closed */ }
}

async function newPage(session) {
  const page = await session.browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  try { await page.setBypassServiceWorker(true); } catch (e) { /* older puppeteer */ }
  try {
    const cdp = page.createCDPSession ? await page.createCDPSession() : await page.target().createCDPSession();
    await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' });
  } catch (e) { /* downloads just land nowhere */ }
  await page.evaluateOnNewDocument(pageHook);
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(String(e && e.message || e).slice(0, 200)));
  return page;
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
}

/* ------------------------------------------------------------------ */
/* writing results                                                    */
/* ------------------------------------------------------------------ */

function clearDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    try { if (fs.statSync(p).isFile()) fs.unlinkSync(p); } catch (e) { /* in use: overwritten below */ }
  }
}

function saveB64(dir, name, b64) {
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(dir, name), buf);
  return { file: name, size: imageSize(buf), bytes: buf.length };
}

const extOf = (type) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'application/pdf': 'pdf' })[String(type).split(';')[0]] || 'bin';

/** Save an image result as png/jpg: other formats are re-encoded as PNG in the page. */
async function saveImageUrl(page, dir, base, url) {
  let got = await page.evaluate((u) => window.__promo.urlB64(u), url);
  let from = null, output = null;
  if (!/^image\/(png|jpeg)$/.test(got.type)) {
    /* the file exactly as the tool made it, then a PNG of it for the kit */
    from = got.type;
    output = saveB64(dir, 'output.' + extOf(got.type), got.b64).file;
    got = await page.evaluate((u) => window.__promo.toPng(u), url);
  }
  const s = saveB64(dir, base + '.' + extOf(got.type), got.b64);
  return Object.assign(s, { type: got.type, convertedFrom: from, output });
}

/* ------------------------------------------------------------------ */
/* drivers, one per example kind                                      */
/* ------------------------------------------------------------------ */

const DRIVERS = {};

/* ---- calc: the calculators (render-core mount) ---- */
DRIVERS.calc = async (c) => {
  const { page, spec, url } = c;
  const inputs = spec.inputs || {};
  const q = new URLSearchParams();
  for (const k of Object.keys(inputs)) q.set(k, String(inputs[k]));
  await goto(page, url + (q.toString() ? '?' + q.toString() : ''));
  await page.waitForSelector('.tool-results .result', { timeout: 30000 });
  await wait(400);
  const got = await page.evaluate((want) => {
    const P = window.__promo;
    const form = document.querySelector('.tool-form');
    const read = (el) => el.tagName === 'SELECT' ? P.text(el.options[el.selectedIndex]) : String(el.value);
    const fields = [...form.querySelectorAll('.field')].map((f) => {
      const el = f.querySelector('select, input, textarea');
      return el ? { label: P.text(f.querySelector('label')), value: read(el), key: el.name } : null;
    }).filter(Boolean);
    const refused = Object.keys(want).filter((k) => {
      const el = form.querySelector('[name="' + k + '"]');
      if (!el) return true;
      const a = String(el.value), b = String(want[k]);
      return !(a === b || (a !== '' && b !== '' && Number(a) === Number(b)));
    });
    const rows = [...document.querySelectorAll('.tool-results .result')].map((r) => ({
      label: P.text(r.querySelector('.result-label')), value: P.text(r.querySelector('.result-value')), primary: r.classList.contains('result-primary')
    }));
    return { fields, refused, rows };
  }, inputs);
  if (got.rows.some((r) => r.label === 'Error')) return { ok: false, note: 'the calculator said "Check your inputs" for ' + JSON.stringify(inputs) };
  const results = got.rows.filter((r) => r.value);
  if (!results.length) return { ok: false, note: 'no result rows on the page' };
  const notes = [];
  if (got.refused.length) notes.push('the page did not take ' + got.refused.join(', ') + ' (unknown key or out of range), so its worked example stands for ' + (got.refused.length === 1 ? 'that field' : 'those fields'));
  if (!Object.keys(inputs).length) notes.push("the page's own worked example");
  return {
    ok: true, kind: 'calc', note: notes.join('; '),
    inputs: got.fields.map((f) => ({ label: f.label, value: f.value, key: f.key })),
    results
  };
};

/* ---- converter: ?v= and the From/To selects (render-core mountConverter) ---- */
/* The currency converter (fx.bundle.js mountCurrency) reads ?amount=&from=&to= and
   loads its rates first; the unit converters (render-core) read ?v=&from=&to=. */
DRIVERS.converter = async (c) => {
  const { page, spec, url } = c;
  const fx = /\/currency-converter\/$/.test(c.tool);
  const q = new URLSearchParams();
  if (spec.value !== undefined) q.set(fx ? 'amount' : 'v', String(spec.value));
  if (spec.from !== undefined) q.set('from', String(spec.from));
  if (spec.to !== undefined) q.set('to', String(spec.to));
  await goto(page, url + (q.toString() ? '?' + q.toString() : ''));
  await page.waitForFunction(() => document.querySelector('.tool-results .result-primary') || document.querySelector('.tool-io .io-msg.is-error'), { timeout: 60000 });
  /* a unit named by its label rather than its key: choose it the way a person would */
  const set = await page.evaluate((s) => {
    const P = window.__promo;
    const out = {};
    for (const k of ['from', 'to']) {
      if (s[k] === undefined) continue;
      const el = document.querySelector('.tool-io select[name="' + k + '"], #fx-' + k);
      if (!el) { out[k] = false; continue; }
      out[k] = el.value === String(s[k]) || P.setField(el, s[k]);
    }
    return out;
  }, spec);
  await wait(400);
  const got = await page.evaluate(() => {
    const P = window.__promo;
    const io = document.querySelector('.tool-io');
    const inputs = [...io.querySelectorAll('.tool-form .field, .gen-form .field')].map((f) => {
      const el = f.querySelector('select, input');
      return el ? { label: P.text(f.querySelector('label')), value: el.tagName === 'SELECT' ? P.text(el.options[el.selectedIndex]) : el.value, key: el.name || el.id || 'v' } : null;
    }).filter(Boolean);
    const rows = [...io.querySelectorAll('.tool-results .result')].map((r) => ({
      label: P.text(r.querySelector('.result-label')), value: P.text(r.querySelector('.result-value')), primary: r.classList.contains('result-primary')
    }));
    const m = io.querySelector('.io-msg');
    return { inputs, rows, msg: m ? P.text(m) : '', error: !!(m && m.classList.contains('is-error')) };
  });
  if (got.error) return { ok: false, note: 'the tool reported: ' + got.msg };
  const notes = [];
  if (set.from === false) notes.push('unit "' + spec.from + '" is not on this page');
  if (set.to === false) notes.push('unit "' + spec.to + '" is not on this page');
  const primary = got.rows.filter((r) => r.primary);
  if (!primary.length) return { ok: false, note: 'no conversion shown' };
  return { ok: true, kind: 'calc', note: notes.join('; '), inputs: got.inputs, results: primary.concat(got.rows.filter((r) => !r.primary).slice(0, 6)), message: got.msg || undefined };
};

/* ---- text: ?text= on a text-in/text-out tool (render-dev mountCode) ---- */
DRIVERS.text = async (c) => {
  const { page, spec, url } = c;
  const input = String(spec.input || '').slice(0, 600);
  if (!input) return { ok: false, note: 'the spec has no input text' };
  await goto(page, url + '?text=' + encodeURIComponent(input));
  await page.waitForSelector('.tool-io textarea.code-area', { timeout: 30000 });
  const opts = spec.options || {};
  if (Object.keys(opts).length) {
    const miss = await page.evaluate((o) => Object.keys(o).filter((k) => !window.__promo.setField(document.querySelector('.opt-bar [name="' + k + '"]'), o[k])), opts);
    if (miss.length) c.notes.push('options not on the page: ' + miss.join(', '));
  }
  await page.waitForFunction(() => {
    const out = document.querySelector('.tool-io pre.code-out');
    return (out && out.textContent.trim()) || document.querySelector('.tool-io .stat-grid .stat-row') || document.querySelector('.tool-io .io-msg.is-error');
  }, { timeout: 30000 }).catch(() => {});
  await wait(300);
  const got = await page.evaluate(() => {
    const P = window.__promo;
    const io = document.querySelector('.tool-io');
    const labels = [...io.querySelectorAll('.io-label')].map(P.text);
    const msg = io.querySelector('.io-msg');
    return {
      typed: (io.querySelector('textarea.code-area') || {}).value || '',
      output: (io.querySelector('pre.code-out') || { textContent: '' }).textContent,
      inputLabel: labels[0] || 'Input', outputLabel: labels[1] || 'Output',
      stats: P.stats(io), msg: msg ? P.text(msg) : '', error: !!(msg && msg.classList.contains('is-error'))
    };
  });
  if (got.typed !== input) c.notes.push('the page holds ' + got.typed.length + ' of the ' + input.length + ' characters');
  if (got.error) return { ok: false, note: 'the tool reported: ' + got.msg };
  if (!got.output.trim() && !got.stats.length) return { ok: false, note: 'the output pane stayed empty' };
  return {
    ok: true, kind: 'text', input: got.typed, output: got.output.slice(0, 4000), inputLabel: got.inputLabel, outputLabel: got.outputLabel,
    stats: got.stats, message: got.msg || undefined, truncated: got.output.length > 4000 || undefined
  };
};

/* ---- qr: the generator, read back by its own scanner ---- */
DRIVERS.qr = async (c) => {
  const { page, spec, dir } = c;
  const q = new URLSearchParams();
  let fields = spec.fields;
  const wifi = !spec.type && !fields && String(spec.text || '').match(/^WIFI:(.*)$/i);
  if (wifi) {
    /* a WIFI: string is what the WiFi form builds: fill that form instead */
    const f = {};
    for (const part of wifi[1].split(/;(?=[A-Z]:)/)) { const m = part.match(/^([TSPH]):(.*?);*$/); if (m) f[m[1]] = m[2].replace(/\\([\\;,:"])/g, '$1'); }
    fields = { ssid: f.S || '', pass: f.P || '', enc: f.T || 'WPA', hidden: f.H === 'true' ? 'yes' : 'no' };
  }
  const type = spec.type || (wifi ? 'wifi' : /^https?:\/\//i.test(String(spec.text || '')) ? 'url' : 'text');
  q.set('t', type);
  if (fields) for (const k of Object.keys(fields)) q.set(k, String(fields[k]));
  else if (type === 'url') q.set('url', String(spec.text || ''));
  else q.set('text', String(spec.text || ''));
  if (spec.style) q.set('style', typeof spec.style === 'string' ? spec.style : Object.keys(spec.style).map((k) => k + ':' + String(spec.style[k]).replace('#', '')).join(','));
  await goto(page, c.base + '/qr/qr-code-generator/?' + q.toString());
  await page.waitForFunction(() => { const v = document.querySelector('.qr-verdict'); return v && /is-(pass|warn|fail)/.test(v.className); }, { timeout: 60000 });
  await wait(300);
  const got = await page.evaluate(async () => {
    const P = window.__promo;
    const svg = document.querySelector('.qr-box svg');
    const v = document.querySelector('.qr-verdict');
    const res = { verdict: P.text(v.querySelector('.qr-verdict-head')), kind: (v.className.match(/is-(\w+)/) || [])[1], content: P.text(document.querySelector('.shared-content')), stats: P.stats(document) };
    if (!svg) return res;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.onerror = r; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
    const size = 800;
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
    cv.getContext('2d').drawImage(img, 0, 0, size, size);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    res.png = await P.toB64(blob);
    return res;
  });
  if (!got.png) return { ok: false, note: 'no code was drawn' };
  if (got.kind === 'fail') return { ok: false, note: 'the generator said: ' + got.verdict };
  const a = saveB64(dir, 'after.png', got.png);
  return { ok: true, kind: 'image', after: 'after.png', afterSize: a.size, caption: got.verdict + (got.content ? ' — ' + got.content : ''), content: got.content, verdict: got.verdict, stats: got.stats };
};

/* ---- PDFs ---- */

const PDF_RUN = '.pdf-run .btn-primary';

async function pdfSummary(page, timeout) {
  await page.waitForFunction(() => {
    const s = document.querySelector('.pdf-summary');
    const m = document.querySelector('.tool-io > .io-msg');
    return (s && !s.hidden) || (m && m.classList.contains('is-error'));
  }, { timeout: timeout || 120000 });
  return page.evaluate(() => {
    const P = window.__promo;
    const m = document.querySelector('.tool-io > .io-msg');
    const s = document.querySelector('.pdf-summary');
    return {
      error: m && m.classList.contains('is-error') ? P.text(m) : '',
      name: P.text(s && s.querySelector('.pdf-summary-name')), meta: P.text(s && s.querySelector('.pdf-summary-meta')),
      stats: P.stats(document.querySelector('.tool-io')), report: (() => { const r = document.querySelector('.tool-io > pre.code-out'); return r && !r.hidden ? r.textContent : ''; })()
    };
  });
}

/** Click something that downloads, and return the newest PDF blob it made. */
async function grabDownload(page, clickSel, typeRe) {
  const n0 = await page.evaluate(() => window.__promo.count());
  await page.$eval(clickSel, (b) => b.click());
  const re = (typeRe || /pdf/).source;
  const hit = await page.waitForFunction((n, src) => {
    const r = new RegExp(src);
    const list = window.__promo.since(n).filter((b) => r.test(b.type));
    return list.length ? list[list.length - 1] : false;
  }, { timeout: 60000, polling: 100 }, n0, re).then((h) => h.jsonValue());
  return { type: hit.type, b64: await page.evaluate((i) => window.__promo.b64(i), hit.i) };
}

async function setPdfControls(page, fields) {
  return page.evaluate((f) => Object.keys(f).filter((k) => {
    const el = document.getElementById('pc-' + k);
    const ok = window.__promo.setField(el, f[k]);
    if (ok && el && el.classList.contains('colour-hex')) { const sw = el.parentNode.querySelector('.colour-swatch'); if (sw) sw.value = String(f[k]); }
    return !ok;
  }), fields || {});
}

/** Run a creator (kind 'create') with these control values (and text, for text-to-pdf). */
async function runCreator(c, toolPath, fields, text) {
  const { page } = c;
  await goto(page, c.base + toolPath);
  await page.waitForSelector(PDF_RUN, { timeout: 30000 });
  fields = Object.assign({}, fields);
  /* text-to-pdf's main box is not a control: a story names it fields.text */
  if (fields.text !== undefined && text === undefined && await page.$('.tool-io textarea.code-area')) { text = String(fields.text); delete fields.text; }
  const missing = await setPdfControls(page, fields);
  if (text !== undefined) await page.evaluate((t) => window.__promo.setField(document.querySelector('.tool-io textarea.code-area'), t), text);
  await page.click(PDF_RUN);
  const sum = await pdfSummary(page);
  if (sum.error) throw new Error('the tool reported: ' + sum.error);
  const pdf = await grabDownload(page, '.pdf-summary-actions .btn-primary');
  return { sum, pdf, missing };
}

const LETTER = (date) => [
  'MVR IT Services LTD', 'Reading, United Kingdom', '', date, '', 'Ms A. Patel', 'Client Name Ltd', '1 Example Street', 'London EC1A 1AA', '',
  'Dear Ms Patel,', '',
  'Thank you for meeting us last week. As agreed, we will start the website rebuild on Monday and send the first designs within two weeks.', '',
  'The fixed price is 4,500 pounds plus VAT, paid in two stages: half when the designs are approved and half at launch. Hosting and support continue at 45 pounds a month.', '',
  'If anything changes on your side, reply to this letter or call the office and we will adjust the plan.', '',
  'Yours sincerely,', '', '', 'A. Director', 'Managing Director'
].join('\n');

const REPORT = [
  ['QUARTERLY OPERATIONS REPORT', 'Third quarter, prepared for the board meeting.'],
  ['1. SUMMARY', 'Orders grew steadily through the quarter and delivery times held at three days. Two new suppliers were approved and one contract was renewed on the same terms. The team stayed at twelve people.'],
  ['2. SALES', 'Repeat customers placed more than half of all orders. The spring price list stays in place until the end of the year, and the new catalogue goes to print next month.'],
  ['3. OPERATIONS', 'The warehouse move finished on schedule. Picking errors fell after the new labels were introduced, and returns are now checked within two working days.'],
  ['4. PEOPLE', 'Two staff completed first-aid training. Holiday cover for December is agreed and published on the shared calendar.'],
  ['5. FINANCE', 'Cash is in line with the plan. Supplier invoices are paid within thirty days and no account is overdue by more than a week.'],
  ['6. RISKS', 'Freight costs remain the largest uncertainty. A second carrier has been set up so that orders can move if prices rise again.'],
  ['7. NEXT QUARTER', 'Priorities are the catalogue launch, a review of packaging costs and a simpler returns form on the website.'],
  ['8. DECISIONS NEEDED', 'The board is asked to approve the catalogue budget and the second carrier contract.']
].map(([h, p]) => h + '\n\n' + p + '\n\n' + p.split('. ').reverse().join('. ') + '\n').join('\n');

const SAMPLE_PDFS = {
  invoice: { tool: '/pdf/invoice-pdf/', fields: {} },
  letter: { tool: '/pdf/text-to-pdf/', fields: { title: 'Letter to Client Name Ltd' }, text: () => LETTER(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) },
  report: { tool: '/pdf/text-to-pdf/', fields: { title: 'Quarterly operations report', size: 15, leading: 1.5 }, text: () => REPORT }
};

/** The sample PDF, made once per session with the site's own generator. */
async function samplePdf(c, name) {
  const memo = c.session.memo;
  if (memo['pdf:' + name]) return memo['pdf:' + name];
  const def = SAMPLE_PDFS[name];
  if (!def) throw new Error('unknown PDF sample "' + name + '" (invoice, letter or report)');
  const r = await runCreator(c, def.tool, def.fields, def.text ? def.text() : undefined);
  const dir = path.join(home(), 'cache', 'promo-samples');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name + '.pdf');
  fs.writeFileSync(file, Buffer.from(r.pdf.b64, 'base64'));
  memo['pdf:' + name] = { name, file, b64: r.pdf.b64, meta: r.sum.meta };
  return memo['pdf:' + name];
}

async function renderPdf(page, list, pageWidth) {
  return page.evaluate((l, w) => window.__promo.renderPdf(l, { pageWidth: w }), list, pageWidth);
}

DRIVERS['pdf-make'] = async (c) => {
  const { page, spec, dir, tool } = c;
  const r = await runCreator(c, tool, spec.fields || {});
  if (r.missing.length) c.notes.push('fields not on the page: ' + r.missing.join(', '));
  fs.writeFileSync(path.join(dir, 'output.pdf'), Buffer.from(r.pdf.b64, 'base64'));
  const img = await renderPdf(page, [{ b64: r.pdf.b64, pages: [1] }], 1000);
  const p = saveB64(dir, 'page1.png', img.b64);
  return {
    ok: true, kind: 'document', page: 'page1.png', pageSize: p.size, pages: img.counts[0], pdf: 'output.pdf',
    caption: [r.sum.name, r.sum.meta].filter(Boolean).join(' · '), stats: r.sum.stats
  };
};

/* What each PDF editor is asked to do, unless the story's options say otherwise. */
const PDF_EDIT = {
  'merge-pdf': { inputs: 2 },
  'split-pdf': { multi: true, opts: { mode: 'each' } },
  'extract-pdf-pages': { multi: true, opts: { pages: '2' } },
  'delete-pdf-pages': { multi: true, opts: { pages: '1' } },
  'rotate-pdf': { opts: { angle: '90', pages: 'all' } },
  'pdf-page-numbers': { multi: true },
  'pdf-organise': { multi: true, organise: true },
  'pdf-to-images': { images: true },
  'pdf-inspector': { panel: true, auto: true },
  'pdf-metadata': { panel: true },
  'watermark-pdf': {},
  'pdf-editor': { opts: { text: 'PAID', size: 20, colour: '#c0392b', x: 72, y: 240 } },
  'pdf-signature': { opts: { signatureText: 'Signed by: A. Director' } }
};

DRIVERS['pdf-edit'] = async (c) => {
  const { page, spec, dir, tool } = c;
  const id = tool.split('/').filter(Boolean).pop();
  const how = PDF_EDIT[id] || {};
  let sample = spec.sample || 'invoice';
  if (how.multi && sample !== 'report') { c.notes.push('used the multi-page report sample, since "' + sample + '" has one page'); sample = 'report'; }
  const first = await samplePdf(c, sample);
  const docs = [first];
  if (how.inputs === 2) docs.push(await samplePdf(c, sample === 'invoice' ? 'letter' : 'invoice'));

  await goto(page, c.base + tool);
  await page.waitForSelector('.tool-io .dropzone input[type=file]', { timeout: 30000 });

  /* before: page 1 of the input, or page 1 of each input for a merge
     (rendered on the tool page: a reused sample means no page has loaded yet) */
  const beforeImg = await renderPdf(page, docs.map((d) => ({ b64: d.b64, pages: how.multi ? 'all' : [1], max: 3 })), docs.length > 1 || how.multi ? 600 : 1000);
  const before = saveB64(dir, 'before.png', beforeImg.b64);
  const missing = await setPdfControls(page, Object.assign({}, how.opts || {}, spec.options || {}));
  if (missing.length) c.notes.push('options not on the page: ' + missing.join(', '));
  const input = await page.$('.tool-io .dropzone input[type=file]');
  await input.uploadFile(...docs.map((d) => d.file));
  await page.waitForFunction((n) => document.querySelectorAll('.file-list .file-row').length >= n, { timeout: 30000 }, docs.length);
  const inputsLine = docs.map((d) => d.name + '.pdf (' + d.meta + ')').join(' + ');

  if (how.panel) {
    if (!how.auto) await page.click(PDF_RUN);
    await page.waitForFunction(() => document.querySelector('.tool-io .stat-grid .stat-row') || document.querySelector('.tool-io > .io-msg.is-error'), { timeout: 60000 });
    await wait(300);
    const sum = await page.evaluate(() => ({ stats: window.__promo.stats(document.querySelector('.tool-io')), error: (() => { const m = document.querySelector('.tool-io > .io-msg.is-error'); return m ? m.textContent : ''; })() }));
    if (sum.error) return { ok: false, note: 'the tool reported: ' + sum.error };
    await page.setViewport({ width: 900, height: 1000, deviceScaleFactor: 2 });
    await wait(300);
    const el = await page.$('.tool-io .stat-grid');
    await el.screenshot({ path: path.join(dir, 'after.png') });
    const a = imageSize(fs.readFileSync(path.join(dir, 'after.png')));
    return { ok: true, kind: 'beforeAfter', before: 'before.png', after: 'after.png', beforeSize: before.size, afterSize: a, caption: (id === 'pdf-metadata' ? 'Metadata of ' : 'Inspected ') + inputsLine, stats: sum.stats };
  }

  await page.click(PDF_RUN);

  if (how.images) {
    /* the stats arrive after the last page is drawn */
    await page.waitForFunction(() => (document.querySelector('.pdf-results .pdf-file-card img') && document.querySelector('.tool-io .stat-grid .stat-row')) || document.querySelector('.tool-io > .io-msg.is-error'), { timeout: 120000 });
    const src = await page.$eval('.pdf-results .pdf-file-card img', (i) => i.src).catch(() => null);
    if (!src) return { ok: false, note: 'no image came out' };
    const a = await saveImageUrl(page, dir, 'after', src);
    const stats = await page.evaluate(() => window.__promo.stats(document.querySelector('.tool-io')));
    const cards = await page.$$eval('.pdf-results .pdf-file-card', (l) => l.length);
    return { ok: true, kind: 'beforeAfter', before: 'before.png', after: a.file, beforeSize: before.size, afterSize: a.size, caption: inputsLine + ' → ' + cards + ' image' + (cards === 1 ? '' : 's') + ' (first shown)', stats };
  }

  if (how.organise) {
    /* the thumbnails paint one by one; the Build button arrives after the last */
    await page.waitForFunction(() => [...document.querySelectorAll('.pdf-actions button')].some((b) => /^Build reorganised PDF/.test(b.textContent)) || document.querySelector('.tool-io > .io-msg.is-error'), { timeout: 120000 });
    const n = await page.$$eval('.page-grid .page-card', (l) => l.length);
    if (n < 2) return { ok: false, note: 'the organiser showed ' + n + ' page(s)' };
    /* move the last page to the front, one press of "Move earlier" at a time */
    for (let k = 0; k < n - 1; k++) {
      const pos = n - 1 - k;
      await page.evaluate((i) => { const card = document.querySelectorAll('.page-grid .page-card')[i]; const b = [...card.querySelectorAll('button')].find((x) => x.title === 'Move earlier'); b.click(); }, pos);
      await page.waitForFunction((i, want, total) => { const all = document.querySelectorAll('.page-grid .page-card'); const c = all[i]; return all.length === total && c && c.querySelector('.page-num') && c.querySelector('.page-num').textContent === String(want); }, { timeout: 30000 }, pos - 1, n, n);
      await wait(250);
    }
    await page.evaluate(() => window.__promo.clickText('.pdf-actions button', '^Build reorganised PDF'));
    c.notes.push('moved page ' + n + ' to the front');
  }

  const sum = await pdfSummary(page);
  if (sum.error) return { ok: false, note: 'the tool reported: ' + sum.error };
  const multi = await page.$$eval('.pdf-results .pdf-file-card button', (l) => l.length);
  const outs = [];
  if (multi > 1) {
    for (let k = 0; k < Math.min(multi, 4); k++) outs.push(await grabDownload(page, '.pdf-results .pdf-file-card:nth-child(' + (k + 1) + ') button'));
  } else {
    outs.push(await grabDownload(page, '.pdf-summary-actions .btn-primary'));
  }
  fs.writeFileSync(path.join(dir, 'output.pdf'), Buffer.from(outs[0].b64, 'base64'));
  /* after: page 1 of the output; every page of a merge; page 1 of each file a split made;
     the first three pages where the tool works on several (to match the before strip) */
  const strip = how.inputs === 2 ? [{ b64: outs[0].b64, pages: 'all', max: 4 }]
    : multi > 1 ? outs.map((o) => ({ b64: o.b64, pages: [1] }))
    : how.multi ? [{ b64: outs[0].b64, pages: 'all', max: 3 }]
    : [{ b64: outs[0].b64, pages: [1] }];
  const afterImg = await renderPdf(page, strip, how.inputs === 2 || how.multi ? 600 : 1000);
  const a = saveB64(dir, 'after.png', afterImg.b64);
  return {
    ok: true, kind: 'beforeAfter', before: 'before.png', after: 'after.png', beforeSize: before.size, afterSize: a.size, pdf: 'output.pdf',
    pagesBefore: beforeImg.counts, pagesAfter: afterImg.counts,
    caption: inputsLine + ' → ' + [sum.name, sum.meta].filter(Boolean).join(' · ') + (multi > 1 ? ' (page 1 of the first ' + outs.length + ' files shown)' : ''),
    stats: sum.stats, report: sum.report || undefined
  };
};

/* ---- image: /image/ (render-image) and /ai-image/ (AIImg) tools ---- */

/* How each AI image tool is driven, from the tool's own engine and its test. */
const AI = {
  'background-remover': { exportSel: '#aiimg-bgr-download' },
  'blur-background': { status: '.aiimg-pane[data-pane=blur] .aiimg-status', exportText: '^Download the image' },
  'color-pop': { exportText: '^Download the image', preset: (k) => '.aiimg-pop-presets [data-preset="' + k + '"]' },
  'face-blur': { status: '.aiimg-pane[data-pane=faces] .aiimg-status', exportText: '^Download the image' },
  'film-grain': { status: '.aiimg-pane[data-pane=look] .aiimg-status', exportSel: '#aiimg-grain-still', preset: (k) => '#aiimg-grain-preset-' + k },
  'image-upscaler': { status: '.aiimg-pane[data-pane=upscale] .aiimg-status', loadedRe: 'Photo loaded', run: '#aiimg-up-run', exportSel: '#aiimg-up-download', inputMax: 480 },
  'object-remover': { exportText: '^Download the picture', remove: 'people' },
  'sky-replacement': { exportText: '^Download the image', sky: 'sunset' },
  'sticker-maker': { exportSel: '#aiimg-stk-png' },
  'text-behind-image': { readyRe: 'layers? found|ready$|could not', exportText: '^Download the image', text: 'SUMMER', stage: true },
  'thumbnail-maker': { exportText: '^Download PNG', text: 'WATCH THIS' },
  '3d-photo-parallax': { status: '.aiimg-pane[data-pane=motion] .aiimg-status', exportText: '^Export the 6-second loop' }
};

/* The subject of each sample photo, by layer name, for tools that cut one out. */
const KEEP = { portrait: '^People$', group: '^People$', pet: '^(Animals?|Dogs?)$' };

async function makeBefore(c, sample, max) {
  const file = path.join(SAMPLES, sample + '.jpg');
  if (!fs.existsSync(file)) throw new Error('no sample photo ' + file);
  const b64 = fs.readFileSync(file).toString('base64');
  const s = await c.page.evaluate((b, m) => window.__promo.scaleJpeg(b, m, 0.9), b64, max);
  return saveB64(c.dir, 'before.jpg', s.b64);
}

async function aiStatus(page, sel) {
  return page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : ''; }, sel);
}

async function driveAiImage(c, slug) {
  const { page, spec, dir } = c;
  const D = AI[slug] || {};
  const opts = Object.assign({}, spec.options || {});
  const statusSel = D.status || '.aiimg-status';
  await goto(page, c.url);
  await page.waitForSelector('.aiimg .dropzone', { timeout: 60000 });
  const before = await makeBefore(c, spec.sample, D.inputMax || 1200);
  const input = await page.$('.aiimg input[type=file][accept="image/*"]:not([multiple])') || await page.$('.aiimg input[type=file]');
  await input.uploadFile(path.join(dir, 'before.jpg'));
  const readyRe = D.loadedRe || D.readyRe || '(^|\\s)ready\\.?$|— ready|could not|failed';
  await page.waitForFunction((s, re) => { const e = document.querySelector(s); return e && new RegExp(re).test(e.textContent.trim()); }, { timeout: 900000, polling: 500 }, statusSel, readyRe);
  let status = await aiStatus(page, statusSel);
  if (/could not|failed/i.test(status)) return { ok: false, note: 'the tool said: ' + status };
  if (D.stage) await page.waitForFunction(() => !document.querySelector('.aiimg-stagemsg') || document.querySelector('.aiimg-stagemsg').hidden, { timeout: 120000 }).catch(() => {});

  /* the tool's own choices, then the story's */
  const applied = [];
  /* the words story writers reach for, mapped to the tools' own controls */
  if (opts.title !== undefined && opts.text === undefined) { opts.text = opts.title; delete opts.title; }
  if (opts.removeAllPeople) { opts.remove = 'people'; delete opts.removeAllPeople; }
  if (opts.scale !== undefined && slug === 'image-upscaler') { opts.mode = /^(2|4)$/.test(String(opts.scale)) ? 'x' + opts.scale : opts.scale; delete opts.scale; }
  const text = opts.text !== undefined ? opts.text : D.text;
  delete opts.text;
  if (text !== undefined && await page.$('#aiimg-text')) { await page.evaluate((t) => window.__promo.setField(document.getElementById('aiimg-text'), t), String(text)); applied.push('text "' + text + '"'); }
  const sky = opts.sky || D.sky;
  delete opts.sky;
  if (sky && slug === 'sky-replacement') {
    const hit = await page.$('.aiimg-sky-choice[data-sky="' + sky + '"]');
    if (!hit) c.notes.push('no sky called "' + sky + '"');
    else {
      await page.evaluate(() => { const t = document.querySelector('.aiimg-tabs [data-pane=sky]'); if (t) t.click(); });
      await hit.click();
      await page.waitForFunction((k) => { const t = document.querySelector('.tool'); const S = t && t.aiimgTool && t.aiimgTool.state; return !S || (S.sky === k && S.skyImg && !S.skyLoading); }, { timeout: 60000 }, sky).catch(() => {});
      applied.push('sky ' + sky);
    }
  }
  if (opts.preset && D.preset) {
    const sel = D.preset(opts.preset);
    const ok = await page.evaluate((s) => { const b = document.querySelector(s); if (!b) return false; const pane = b.closest('.aiimg-pane'); if (pane) { const t = document.querySelector('.aiimg-tabs [data-pane="' + pane.dataset.pane + '"]'); if (t) t.click(); } b.click(); return true; }, sel);
    if (ok) applied.push('preset ' + opts.preset); else c.notes.push('no preset "' + opts.preset + '"');
    delete opts.preset;
  }
  /* keep only the subject's layers, as a person unticks the rest in the Layers pane */
  const keep = opts.keep || (slug === 'background-remover' || slug === 'sticker-maker' ? KEEP[spec.sample] : null);
  delete opts.keep;
  if (keep && await page.$('.aiimg-layer input[type=checkbox]')) {
    const r = await page.evaluate((src) => {
      const re = new RegExp(src, 'i');
      const rows = [...document.querySelectorAll('.aiimg-layer')];
      const hit = rows.filter((row) => re.test(window.__promo.text(row.querySelector('.aiimg-lname'))));
      if (!hit.length) return { names: rows.map((row) => window.__promo.text(row.querySelector('.aiimg-lname'))), kept: [] };
      for (const row of rows) {
        const cb = row.querySelector('input[type=checkbox]');
        const want = hit.indexOf(row) >= 0;
        if (cb.checked !== want) cb.click();
      }
      return { kept: hit.map((row) => window.__promo.text(row.querySelector('.aiimg-lname'))) };
    }, keep);
    if (r.kept.length) {
      applied.push('kept ' + r.kept.join(', '));
      await wait(800);
      await page.waitForFunction((s, re) => { const e = document.querySelector(s); return e && new RegExp(re).test(e.textContent.trim()); }, { timeout: 300000, polling: 300 }, statusSel, readyRe);
    } else c.notes.push('no layer matched "' + keep + '" (found ' + r.names.join(', ') + '), so the tool’s own choice stands');
  }
  const remove = opts.remove || D.remove;
  delete opts.remove;
  for (const k of Object.keys(opts)) {
    /* '#id' / '.class', or a plain key matched to the tool's control whose id ends in -<key> (aiimg-blur-style) */
    const sel = /^[#.]/.test(k) ? k : '.aiimg select[id$="-' + k + '"], .aiimg input[id$="-' + k + '"]';
    const ok = await page.evaluate((s, key, v) => {
      const e = document.querySelector(s);
      if (e) { if (v === true || e.tagName === 'BUTTON') { e.click(); return true; } return window.__promo.setField(e, v); }
      /* a row of chips such as the parallax frame: <button data-frame="9:16"> */
      const chip = /^[a-z]+$/i.test(key) && document.querySelector('.aiimg [data-' + key.toLowerCase() + '="' + String(v).replace(/"/g, '') + '"]');
      if (chip) { chip.click(); return true; }
      return false;
    }, sel, k, opts[k]);
    if (ok) applied.push(k + ' ' + opts[k]); else c.notes.push('option "' + k + '" is not a control on this tool, or "' + opts[k] + '" is not one of its values');
  }
  if (applied.length) await wait(800);

  if (slug === 'object-remover' && remove) {
    const runs0 = await page.evaluate(() => { const t = document.querySelector('.tool'); return t && t.aiimgEraser ? t.aiimgEraser.state.stats.runs.length : 0; });
    const did = await page.evaluate((what) => {
      if (what === 'people') { const b = document.querySelector('.aiimg-era-people'); if (b && !b.disabled) { b.click(); return 'people'; } }
      const re = new RegExp(what === 'people' ? '.' : what, 'i');
      for (const ch of document.querySelectorAll('.aiimg-era-taps .chip')) if (re.test(ch.textContent) && !ch.disabled) { ch.click(); return ch.textContent.trim(); }
      return null;
    }, String(remove));
    if (!did) return { ok: false, note: 'nothing to remove: no "' + remove + '" layer was found' };
    await page.waitForFunction((n) => { const S = document.querySelector('.tool').aiimgEraser.state; const s = document.querySelector('.aiimg-status'); return (S.stats.runs.length > n && !S.job && /ready$/.test(s.textContent.trim())) || /failed/.test(s.textContent); }, { timeout: 900000, polling: 500 }, runs0);
    status = await aiStatus(page, statusSel);
    if (/failed/i.test(status)) return { ok: false, note: 'the tool said: ' + status };
    applied.push('removed ' + did);
  }
  if (D.run) {
    await page.click(D.run);
    await page.waitForFunction((s) => { const e = document.querySelector(s); return e && /ready$|failed|Cancelled/.test(e.textContent.trim()); }, { timeout: 900000, polling: 500 }, statusSel);
    status = await aiStatus(page, statusSel);
    if (!/ready$/.test(status)) return { ok: false, note: 'the tool said: ' + status };
  }

  /* export, as the person would */
  await page.evaluate(() => { const t = document.querySelector('.aiimg-tabs [data-pane=export]'); if (t) t.click(); });
  await wait(300);
  const seen = await page.$$eval('.aiimg-result img, .aiimg-result video', (l) => l.map((e) => e.src));
  const clicked = D.exportSel
    ? await page.evaluate((s) => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, D.exportSel)
    : await page.evaluate((re) => window.__promo.clickText('.aiimg-pane[data-pane=export] button, .aiimg button', re), D.exportText || '^Download');
  if (!clicked) return { ok: false, note: 'no export button found' };
  const src = await page.waitForFunction((old) => {
    for (const e of document.querySelectorAll('.aiimg-result img, .aiimg-result video')) if (e.src && old.indexOf(e.src) < 0) return e.src;
    const m = document.querySelector('.aiimg > .io-msg.is-error');
    return m ? 'error:' + m.textContent : false;
  }, { timeout: 900000, polling: 500 }, seen).then((h) => h.jsonValue());
  if (src.startsWith('error:')) return { ok: false, note: 'the tool reported: ' + src.slice(6) };
  const head = await page.evaluate((s) => { const e = [...document.querySelectorAll('.aiimg-result img, .aiimg-result video')].find((x) => x.src === s); const r = e && e.closest('.aiimg-result'); return r ? window.__promo.text(r.querySelector('.aiimg-result-head')) : ''; }, src);
  const isVideo = await page.evaluate((s) => !![...document.querySelectorAll('.aiimg-result video')].find((x) => x.src === s), src);
  let after;
  const extra = {};
  if (isVideo) {
    const clip = await page.evaluate((u) => window.__promo.urlB64(u), src);
    const cf = saveB64(dir, 'clip.' + extOf(clip.type), clip.b64);
    const frame = await page.evaluate((u) => window.__promo.videoFrame(u, 0.5, 0.92), src);
    after = saveB64(dir, 'after.jpg', frame.b64);
    extra.clip = cf.file; extra.clipBytes = cf.bytes; extra.frameAt = Math.round(frame.t * 100) / 100;
  } else {
    after = await saveImageUrl(page, dir, 'after', src);
    if (after.convertedFrom) { extra.exportedAs = after.convertedFrom; extra.output = after.output; }
  }
  return {
    ok: true, kind: 'beforeAfter', before: 'before.jpg', after: after.file, beforeSize: before.size, afterSize: after.size,
    caption: titleOf(c.tool) + ' on ' + SAMPLE_WORDS[spec.sample] + (applied.length ? ' (' + applied.join(', ') + ')' : ''),
    status, result: head, ...extra
  };
}

async function driveImage(c) {
  const { page, spec, dir } = c;
  await goto(page, c.url);
  await page.waitForSelector('.tool-io .dropzone input[type=file]', { timeout: 30000 });
  const before = await makeBefore(c, spec.sample, 1200);
  const opts = spec.options || {};
  if (Object.keys(opts).length) {
    const miss = await page.evaluate((o) => Object.keys(o).filter((k) => !window.__promo.setField(document.getElementById('ic-' + k) || document.querySelector(k), o[k])), opts);
    if (miss.length) c.notes.push('options not on the page: ' + miss.join(', '));
  }
  const input = await page.$('.tool-io .dropzone input[type=file]');
  await input.uploadFile(path.join(dir, 'before.jpg'));
  await page.waitForFunction(() => {
    const io = document.querySelector('.tool-io');
    const m = io.querySelector('.io-msg');
    return io.querySelector('.image-stage img.image-preview') || io.querySelector('.image-stage .palette-grid') || io.querySelector('.image-stage pre.code-out')
      || io.querySelector('.io-actions .btn-primary') || (m && m.classList.contains('is-error'));
  }, { timeout: 120000 });
  await wait(600);
  /* croppers and redactors: drag an area, as a person does (a ratio only applies to a drag) */
  const sel = await page.$('.tool-io .image-stage canvas.select-canvas');
  if (sel) {
    const area = Object.assign({ x0: 0.2, y0: 0.15, x1: 0.8, y1: 0.85 }, spec.area || {});
    await sel.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await wait(300);
    const r = await sel.boundingBox();
    const old = await page.$$eval('.tool-io .image-stage .image-card img.image-preview', (l) => l.map((i) => i.src));
    await page.mouse.move(r.x + r.width * area.x0, r.y + r.height * area.y0);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width * area.x1, r.y + r.height * area.y1, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction((o) => [...document.querySelectorAll('.tool-io .image-stage .image-card img.image-preview')].some((i) => i.src && o.indexOf(i.src) < 0), { timeout: 15000 }, old)
      .catch(() => c.notes.push('dragging an area did not change the result, so the default area stands'));
    await wait(400);
  }
  const got = await page.evaluate(() => {
    const P = window.__promo;
    const io = document.querySelector('.tool-io');
    const m = io.querySelector('.io-msg');
    return {
      error: m && m.classList.contains('is-error') ? P.text(m) : '', note: m ? P.text(m) : '',
      imgs: [...io.querySelectorAll('.image-stage .image-card img.image-preview')].map((i) => i.src).filter((s) => s.startsWith('blob:')),
      pdfButton: !![...io.querySelectorAll('.io-actions .btn-primary')].find((b) => /Download PDF/.test(b.textContent)),
      stats: P.stats(io)
    };
  });
  if (got.error) return { ok: false, note: 'the tool reported: ' + got.error };
  let after, how;
  if (got.pdfButton) {
    const pdf = await grabDownload(page, '.tool-io .io-actions .btn-primary');
    fs.writeFileSync(path.join(dir, 'output.pdf'), Buffer.from(pdf.b64, 'base64'));
    const img = await renderPdf(page, [{ b64: pdf.b64, pages: [1] }], 1000);
    after = saveB64(dir, 'after.png', img.b64);
    how = 'page 1 of the PDF';
  } else if (got.imgs.length === 1 || got.imgs.length === 2) {
    /* one result, or a result and its print sheet (passport photo): the first is the picture */
    after = await saveImageUrl(page, dir, 'after', got.imgs[0]);
    how = got.imgs.length === 2 ? 'the first of 2 results' : '';
  } else {
    await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 1 });
    await wait(400);
    const el = await page.$('.tool-io .image-stage');
    await el.screenshot({ path: path.join(dir, 'after.png') });
    after = { file: 'after.png', size: imageSize(fs.readFileSync(path.join(dir, 'after.png'))) };
    how = got.imgs.length > 1 ? got.imgs.length + ' results, shown as the page lays them out' : 'the result panel';
  }
  const stat = (k) => (got.stats.find((r) => r[0] === k) || [])[1];
  const pct = (String(stat('Change') || '').match(/\(([^)]+)\)/) || [])[1];
  /* file sizes are the point only for tools whose job is the file (not a border or a filter) */
  const sizeTool = /\/(image-compressor|image-converter|bulk-image-resizer|exif-remover)\/$/.test(c.tool);
  const sizes = sizeTool && stat('Original total') && stat('Result total') ?stat('Original total') + ' → ' + stat('Result total') + (pct ? ' (' + pct + ')' : '') : '';
  return {
    ok: true, kind: 'beforeAfter', before: 'before.jpg', after: after.file, beforeSize: before.size, afterSize: after.size,
    caption: titleOf(c.tool) + ' on ' + SAMPLE_WORDS[spec.sample] + (sizes ? ': ' + sizes : '') + (how ? ' (' + how + ')' : ''),
    output: after.output || undefined, exportedAs: after.convertedFrom || undefined,
    stats: got.stats, message: got.note || undefined
  };
}

DRIVERS.image = async (c) => {
  if (SAMPLE_NAMES.indexOf(c.spec.sample) < 0) return { ok: false, note: 'unknown sample "' + c.spec.sample + '" (' + SAMPLE_NAMES.join(', ') + ')' };
  const parts = c.tool.split('/').filter(Boolean);
  if (parts[0] === 'ai-image') return driveAiImage(c, parts[1]);
  return driveImage(c);
};

/* ---- video: Auto Captions on a clip with real speech ---- */

function speechWav() {
  const dir = path.join(home(), 'cache');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'speech.wav');
  const tag = path.join(dir, 'speech.txt');
  if (fs.existsSync(out) && fs.existsSync(tag) && fs.readFileSync(tag, 'utf8') === SPEECH) return out;
  if (process.platform !== 'win32') throw new Error('the speech sample needs Windows speech synthesis (PowerShell System.Speech)');
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)',
    "$s.SetOutputToWaveFile('" + path.win32.normalize(out).replace(/'/g, "''") + "', $f)",
    "$s.Speak('" + SPEECH.replace(/'/g, "''") + "')",
    '$s.Dispose()'
  ].join('; ');
  const r = require('child_process').spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error('speech synthesis failed: ' + ((r.stderr || r.stdout || '').trim() || 'no output'));
  fs.writeFileSync(tag, SPEECH);
  return out;
}

DRIVERS.video = async (c) => {
  const { page, dir } = c;
  const wav = speechWav();
  await goto(page, c.base + '/ai-video/auto-captions/');
  await page.waitForSelector('.aiimg input[type=file]', { timeout: 60000 });
  /* the clip: the CC0 portrait, cover-cropped to 9:16 with a slow push-in, and the speech as its sound */
  const photo = fs.readFileSync(path.join(SAMPLES, 'portrait.jpg')).toString('base64');
  const made = await page.evaluate(async (wavB64, jpgB64) => {
    const P = window.__promo;
    const ac = new AudioContext({ sampleRate: 48000 });
    const buf = await ac.decodeAudioData(P.fromB64(wavB64).buffer);
    const dest = ac.createMediaStreamDestination();
    const src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
    const bmp = await createImageBitmap(new Blob([P.fromB64(jpgB64)], { type: 'image/jpeg' }));
    const W = 1080, H = 1920;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const stream = cv.captureStream(30);
    for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    const mime = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });
    const total = buf.duration + 1;
    let running = true;
    const t0 = performance.now();
    (function frame() {
      const t = Math.min(1, (performance.now() - t0) / 1000 / total);
      const z = 1 + 0.08 * t;
      const s = Math.max(W / bmp.width, H / bmp.height) * z;
      const w = bmp.width * s, h = bmp.height * s;
      x.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
      if (running) requestAnimationFrame(frame);
    })();
    rec.start(250);
    src.start(0);
    await new Promise((r) => { src.onended = r; setTimeout(r, buf.duration * 1000 + 1500); });
    await new Promise((r) => setTimeout(r, 500));
    running = false;
    rec.stop();
    await stopped;
    ac.close();
    const blob = new Blob(chunks, { type: mime });
    window.__clip = new File([blob], 'speech-clip.webm', { type: 'video/webm' });
    const input = document.querySelector('.aiimg input[type=file]');
    const dt = new DataTransfer(); dt.items.add(window.__clip);
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    return { size: blob.size, duration: buf.duration };
  }, fs.readFileSync(wav).toString('base64'), photo);
  const words = '.aiimg-pane[data-pane=words] .aiimg-status';
  await page.waitForFunction((s) => { const e = document.querySelector(s); return e && (/ready$/.test(e.textContent.trim()) || /failed|could not|Cancelled/i.test(e.textContent)); }, { timeout: 900000, polling: 500 }, words);
  const status = await aiStatus(page, words);
  if (!/ready$/.test(status)) return { ok: false, note: 'the tool said: ' + status };
  const transcript = await page.$$eval('.aivid-seg-text', (t) => t.map((e) => e.value.trim()).join(' '));
  await page.evaluate(() => { const t = document.querySelector('.aiimg-tabs [data-pane=export]'); if (t) t.click(); });
  const clicked = await page.evaluate(() => window.__promo.clickText('.aiimg-pane[data-pane=export] button', '^Export the captioned video'));
  if (!clicked) return { ok: false, note: 'no export button found' };
  await page.waitForFunction(() => { const st = document.querySelector('.aivid-exstatus'); return document.querySelector('.aiimg-result video') || /failed|Cancelled/.test(st ? st.textContent : ''); }, { timeout: 900000, polling: 500 });
  const src = await page.$eval('.aiimg-result video', (v) => v.src).catch(() => null);
  if (!src) return { ok: false, note: 'export failed: ' + await page.$eval('.aivid-exstatus', (e) => e.textContent).catch(() => 'no result') };
  const at = 0.55;
  const afterF = await page.evaluate((u, a) => window.__promo.videoFrame(u, a, 0.9), src, at);
  const beforeF = await page.evaluate((a) => window.__promo.videoFrame(window.__clip, a, 0.9), at);
  const before = saveB64(dir, 'before.jpg', beforeF.b64);
  const after = saveB64(dir, 'after.jpg', afterF.b64);
  const clip = await page.evaluate((u) => window.__promo.urlB64(u), src);
  const cf = saveB64(dir, 'clip.' + extOf(clip.type), clip.b64);
  return {
    ok: true, kind: 'beforeAfter', before: 'before.jpg', after: 'after.jpg', beforeSize: before.size, afterSize: after.size,
    caption: 'Captions written on the device from the clip\u2019s own speech: \u201c' + transcript + '\u201d',
    transcript, spoken: SPEECH, clip: cf.file, clipBytes: cf.bytes, frameAt: Math.round(afterF.t * 100) / 100, sourceSeconds: Math.round(made.duration * 100) / 100
  };
};

/* ------------------------------------------------------------------ */
/* capture                                                            */
/* ------------------------------------------------------------------ */

const RESULT_KIND = { calc: 'calc', converter: 'calc', text: 'text', qr: 'image', 'pdf-make': 'document', 'pdf-edit': 'beforeAfter', image: 'beforeAfter', video: 'beforeAfter', schematic: 'schematic' };

function sameSpec(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }

/* A changed sample photo makes every example drawn from it stale. */
const sampleHashes = {};
function sampleHash(spec) {
  const n = spec && spec.kind === 'image' && SAMPLE_NAMES.indexOf(spec.sample) >= 0 ? spec.sample : spec && spec.kind === 'video' ? 'portrait' : null;
  if (!n) return undefined;
  if (!sampleHashes[n]) {
    try { sampleHashes[n] = require('crypto').createHash('sha1').update(fs.readFileSync(path.join(SAMPLES, n + '.jpg'))).digest('hex').slice(0, 12); }
    catch (e) { sampleHashes[n] = 'missing'; }
  }
  return sampleHashes[n];
}
function fresh(old, tool, spec) { return !!(old && old.ok && old.tool === tool && sameSpec(old.spec, spec) && old.sampleHash === sampleHash(spec)); }

async function captureIn(session, toolPath, spec, opts) {
  opts = opts || {};
  const tool = normPath(toolPath);
  const dir = dirFor(tool);
  spec = spec || {};
  const asked = spec;
  let kind = spec.kind === 'calc' && spec.value !== undefined && !spec.inputs ? 'converter' : spec.kind;
  if (kind === 'calc' && /\/currency-converter\/$/.test(tool)) {
    /* the currency converter is not a render-core calculator: drive it as a converter */
    const i = spec.inputs || {};
    spec = Object.assign({}, spec, { value: spec.value !== undefined ? spec.value : (i.amount !== undefined ? i.amount : i.v), from: spec.from || i.from, to: spec.to || i.to });
    kind = 'converter';
  }
  if (!opts.fresh) {
    const old = read(tool);
    if (fresh(old, tool, asked)) { session && session.log('cached  ' + tool); return old; }
  }
  const t0 = Date.now();
  const out = { tool, kind: RESULT_KIND[kind] || kind, captured: new Date().toISOString(), source: 'live tool', ok: false, note: '', spec: asked, sampleHash: sampleHash(asked) };
  clearDir(dir);
  if (kind === 'schematic') {
    Object.assign(out, {
      ok: true, source: 'none (nothing is run for a schematic)', note: 'Nothing was run: the kit draws "How it works" and labels any sample text "Illustration".',
      input: spec.input || '', output: spec.output || '', sampleIn: spec.sampleIn, sampleOut: spec.sampleOut
    });
  } else if (!DRIVERS[kind]) {
    out.note = 'unknown example kind "' + spec.kind + '"';
  } else {
    let page = null;
    const notes = [];
    try {
      page = await newPage(session);
      const c = { session, page, spec, tool, dir, base: session.base, url: session.base + tool, notes };
      session.log('capture ' + tool + ' (' + kind + ')');
      const res = await Promise.race([
        DRIVERS[kind](c),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after ' + Math.round((opts.timeout || 1500000) / 60000) + ' min')), opts.timeout || 1500000))
      ]);
      const note = [res.note].concat(notes).filter(Boolean).join('; ');
      Object.assign(out, res, { note, kind: res.kind || out.kind });
      if (page.__errors.length) out.pageErrors = page.__errors.slice(0, 5);
    } catch (e) {
      out.ok = false;
      out.note = [String(e && e.message || e).split('\n')[0].slice(0, 300)].concat(notes).join('; ');
      if (page && page.__errors.length) out.pageErrors = page.__errors.slice(0, 5);
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }
  out.ms = Date.now() - t0;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'example.json'), JSON.stringify(out, null, 2));
  session && session.log((out.ok ? 'ok      ' : 'FAILED  ') + tool + ' ' + (out.ms / 1000).toFixed(1) + 's' + (out.note ? ' — ' + out.note : ''));
  return out;
}

/**
 * Capture one example. opts: { fresh, root, port, onLog, session }.
 * Opens (and closes) its own browser unless a session from open() is passed.
 */
async function capture(toolPath, exampleSpec, opts) {
  opts = opts || {};
  if (exampleSpec && exampleSpec.kind === 'schematic') return captureIn({ log: opts.onLog || (() => {}) }, toolPath, exampleSpec, opts);
  if (!opts.fresh) {
    const old = read(toolPath);
    if (fresh(old, normPath(toolPath), exampleSpec)) return old;
  }
  const own = !opts.session;
  const session = opts.session || await open(opts);
  try { return await captureIn(session, toolPath, exampleSpec, opts); }
  finally { if (own) await close(session); }
}

/** Capture a list ({tool, example} | {tool, spec} | [tool, spec]) with one browser. */
async function captureMany(list, opts) {
  opts = opts || {};
  const items = (list || []).map((x) => Array.isArray(x) ? { tool: x[0], spec: x[1] } : { tool: x.tool || x.path, spec: x.example || x.spec });
  const results = [];
  let session = null;
  try {
    for (const it of items) {
      const needsBrowser = it.spec && it.spec.kind !== 'schematic';
      if (needsBrowser && !session) session = await open(opts);
      let r;
      try { r = await captureIn(session || { log: opts.onLog || (() => {}) }, it.tool, it.spec, opts); }
      catch (e) { r = { tool: normPath(it.tool), ok: false, note: String(e && e.message || e) }; }
      results.push(r);
      /* a crashed browser takes the session with it: start again for the rest */
      if (session && !session.browser.connected) { await close(session); session = null; }
    }
  } finally { await close(session); }
  return results;
}

/* ------------------------------------------------------------------ */
/* stories                                                            */
/* ------------------------------------------------------------------ */

/** Every story with an example, from build/promo/stories/*.js. */
function allStories() {
  const dir = path.join(__dirname, 'stories');
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((n) => /\.js$/.test(n) && n !== 'index.js').sort()) {
    try {
      const shard = require(path.join(dir, f));
      for (const k of Object.keys(shard || {})) if (shard[k] && shard[k].example) out[normPath(k)] = shard[k];
    } catch (e) { process.stderr.write('stories/' + f + ': ' + e.message + '\n'); }
  }
  return out;
}

function storyExample(toolPath) {
  const p = normPath(toolPath);
  const all = allStories();
  if (all[p]) return all[p].example;
  try { const s = require('./stories/index.js').storyFor(p); return s && s.example; } catch (e) { return null; }
}

/* ------------------------------------------------------------------ */
/* CLI                                                                */
/* ------------------------------------------------------------------ */

function summarise(results) {
  const by = {};
  for (const r of results) {
    const k = (r.spec && r.spec.kind) || r.kind || '?';
    const b = by[k] || (by[k] = { ok: 0, failed: 0, notes: [] });
    if (r.ok) b.ok++; else { b.failed++; b.notes.push(r.tool + ': ' + r.note); }
  }
  return by;
}

async function cli(argv) {
  const args = argv.slice(2);
  const cmd = args[0];
  const flag = (n) => { const i = args.indexOf('--' + n); return i < 0 ? undefined : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
  const log = (m) => console.log(new Date().toISOString().slice(11, 19) + ' ' + m);
  const common = { fresh: !!flag('fresh'), root: flag('root'), port: flag('port') ? Number(flag('port')) : undefined, onLog: log };
  if (cmd === 'capture') {
    const tool = args[1];
    if (!tool) throw new Error('usage: capture <toolPath> [--fresh] [--spec <json>]');
    const spec = flag('spec') ? JSON.parse(flag('spec')) : storyExample(tool);
    if (!spec) throw new Error('no story example for ' + normPath(tool) + '; pass --spec \'{"kind":"calc"}\'');
    const r = await capture(tool, spec, common);
    console.log(JSON.stringify(r, null, 2));
    console.log(dirFor(tool));
    return r.ok ? 0 : 1;
  }
  if (cmd === 'capture-all') {
    const stories = allStories();
    const sec = flag('section'), kind = flag('kind');
    const list = Object.keys(stories)
      .filter((p) => !sec || p.split('/')[1] === String(sec).replace(/\//g, ''))
      .filter((p) => !kind || stories[p].example.kind === kind)
      .map((p) => ({ tool: p, example: stories[p].example }));
    if (!list.length) { console.log('no stories with examples' + (sec || kind ? ' for that filter' : ' in build/promo/stories/')); return 1; }
    log(list.length + ' examples to capture');
    const t0 = Date.now();
    const results = await captureMany(list, common);
    const by = summarise(results);
    console.log('\nby kind (ok / failed):');
    for (const k of Object.keys(by).sort()) {
      console.log('  ' + k.padEnd(10) + ' ' + by[k].ok + ' / ' + by[k].failed);
      for (const n of by[k].notes) console.log('      - ' + n);
    }
    console.log('total ' + results.filter((r) => r.ok).length + ' ok, ' + results.filter((r) => !r.ok).length + ' failed, ' + ((Date.now() - t0) / 60000).toFixed(1) + ' min');
    return 0;
  }
  if (cmd === 'show') {
    const tool = args[1];
    const r = read(tool);
    console.log(dirFor(tool));
    console.log(r ? JSON.stringify(r, null, 2) : 'no example captured yet');
    return r ? 0 : 1;
  }
  console.log('usage:\n  node build/promo/examples.js capture <toolPath> [--fresh] [--spec <json>]\n  node build/promo/examples.js capture-all [--section s] [--kind k] [--fresh]\n  node build/promo/examples.js show <toolPath>');
  return cmd ? 1 : 0;
}

module.exports = {
  capture, captureMany, open, close, read, dirFor, slugFor, examplesDir, home, imageSize, allStories, storyExample,
  SAMPLE_NAMES, SAMPLES, PDF_EDIT, AI
};

if (require.main === module) {
  cli(process.argv).then((code) => process.exit(code), (e) => { console.error(e && e.stack || e); process.exit(1); });
}
