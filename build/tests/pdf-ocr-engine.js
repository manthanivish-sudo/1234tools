/**
 * The OCR engine (engine/pdf-ocr-engine.js, tesseract.js 6 with the vendored
 * core and tessdata_fast), proved in headless Chrome.
 *
 *   node build/tests/pdf-ocr-engine.js [--root <site>] [--port 8862]
 *
 * --root defaults to the site this file sits in. It is served by
 * build/tests/serve.js on the first free port of 8862-8864 (from --port), and
 * a second free port in that range runs a recording proxy set on the test's
 * browser context, so the pages, their workers and the service worker reach
 * anything not on 127.0.0.1 only through it. Any page or worker request to a
 * host other than 127.0.0.1, or anything reaching the proxy once the loader is
 * on the page, fails the run (a probe request proves the proxy is listening).
 *
 * On /pdf/merge-pdf/ the loader is added to the page, text is drawn on
 * canvases and read back:
 *   1  English at three sizes: the text exactly, each word's box within a
 *      few pixels of where it was drawn, the progress labels, the bytes
 *   2  the same image as ImageBitmap, ImageData and Blob: the same text
 *   3  a second recognize on the same engine: nothing downloaded, and fast;
 *      a 40-line page timed; terminate() leaves no worker
 *   4  Hindi ("भारत एक विशाल देश है") at two sizes: character error rate
 *      under 5%, word boxes over the drawn words
 *   5  English and Hindi together: both read, both downloaded again (the
 *      engine keeps nothing itself), and nothing written to IndexedDB
 *   6  abort while loading and while reading: AbortError, and no worker left
 *   7  what stays on the device: on a second page the site's service worker
 *      is allowed, and a second create() downloads nothing because the
 *      service worker's Cache Storage holds the engine and the gzipped data
 *   8  a browser without WebAssembly SIMD: the plain LSTM core, same text
 *   9  language data that answers 404: create() rejects, no worker left
 *
 * Sections 1-6 run with the service worker kept from registering, so every
 * create() really downloads and the bytes per language can be counted.
 *
 * Exit code 2 when an assertion fails, 1 when the run itself breaks.
 */
'use strict';
const path = require('path');
const http = require('http');
const net = require('net');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT0 = Number(arg('--port', 8862));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORTS = [8862, 8863, 8864];
if (!PORTS.includes(PORT0)) { console.error('--port must be 8862, 8863 or 8864'); process.exit(1); }

let pass = 0, fail = 0;
const failures = [];
function check(ok, what, detail) {
  if (ok) { pass++; console.log('  ok    ' + what + (detail !== undefined && detail !== '' ? '  (' + detail + ')' : '')); }
  else { fail++; failures.push(what + (detail ? '  (' + detail + ')' : '')); console.log('  FAIL  ' + what + (detail ? '  -> ' + detail : '')); }
}
const group = (t) => console.log('\n' + t);
const kb = (n) => (n / 1024).toFixed(0) + ' KiB';
const ms = (n) => Math.round(n) + ' ms';

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'),
    'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}

/* Levenshtein over code points, for the character error rate. */
function cer(ref, hyp) {
  const a = [...ref.normalize('NFC')], b = [...hyp.normalize('NFC')];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] / a.length;
}

/* A proxy that records every host Chrome tries to reach through it and
   refuses them all. Loopback never goes through a proxy in Chrome. */
function recordingProxy(port, hosts) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      try { hosts.add(new URL(req.url).host); } catch (e) { hosts.add(String(req.headers.host || req.url)); }
      res.writeHead(403); res.end();
    });
    s.on('connect', (req, sock) => { hosts.add(req.url); try { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); } catch (e) { /* */ } });
    s.once('error', () => resolve(null));
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}
const portFree = (port) => new Promise((resolve) => {
  const t = net.createServer();
  t.once('error', () => resolve(false));
  t.listen(port, '127.0.0.1', () => t.close(() => resolve(true)));
});

/* ---------- in the page ---------- */

function pageHelpers(noServiceWorker) {
  try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* */ }
  if (noServiceWorker && navigator.serviceWorker) {
    navigator.serviceWorker.register = () => Promise.reject(new Error('no service worker in this test page'));
  }
  const EN_FONT = 'Arial, Helvetica, sans-serif';
  const HI_FONT = '"Nirmala UI", Mangal, "Noto Sans Devanagari", sans-serif';
  /* Draws lines of text on white with a margin; returns the canvas and every
     word's ink box as drawn (measureText's actual bounding box). */
  function draw(lines, size, font) {
    const m = Math.round(size * 1.2), lead = Math.round(size * 1.6);
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = size + 'px ' + font;
    const width = Math.ceil(Math.max(...lines.map((l) => probe.measureText(l).width))) + 2 * m;
    const c = document.createElement('canvas');
    c.width = width; c.height = m * 2 + lead * lines.length;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000'; g.font = size + 'px ' + font; g.textBaseline = 'alphabetic';
    const words = [];
    lines.forEach((line, i) => {
      const y = m + lead * i + size;
      g.fillText(line, m, y);
      let at = 0;
      for (const w of line.split(' ')) {
        const start = g.measureText(line.slice(0, line.indexOf(w, at))).width;
        const mt = g.measureText(w);
        words.push({ text: w, line: i, base: y, x0: m + start - mt.actualBoundingBoxLeft, x1: m + start + mt.actualBoundingBoxRight,
          y0: y - mt.actualBoundingBoxAscent, y1: y + mt.actualBoundingBoxDescent });
        at = line.indexOf(w, at) + w.length;
      }
    });
    return { canvas: c, words };
  }
  window.__t = { draw, EN_FONT, HI_FONT, store: {} };
}

async function main() {
  const puppeteer = loadPuppeteer();
  const { serve } = require('./serve.js');

  /* the site on the first free port from --port; the proxy on the next */
  let server = null, port = null;
  for (const p of [PORT0, ...PORTS.filter((x) => x !== PORT0)]) {
    if (!(await portFree(p))) continue;
    server = await serve(ROOT, p);
    if (server) { port = p; break; }
  }
  if (!server) throw new Error('no free port among 8862-8864 for the site');
  const proxyHosts = new Set();
  let proxy = null, proxyPort = null;
  for (const p of PORTS.filter((x) => x !== port)) {
    if (!(await portFree(p))) continue;
    proxy = await recordingProxy(p, proxyHosts);
    if (proxy) { proxyPort = p; break; }
  }
  const BASE = 'http://127.0.0.1:' + port;
  console.log('pdf-ocr-engine: ' + ROOT + ' on ' + BASE + (proxy ? ', recording proxy on ' + proxyPort : ', no free port for the proxy (page and worker requests are still recorded)'));

  /* bytes the server sends, by path, so each phase can be measured */
  const served = [];
  server.on('request', (req, res) => {
    let len = 0;
    const wh = res.writeHead;
    res.writeHead = function (code, headers) { if (headers && headers['Content-Length'] !== undefined) len = Number(headers['Content-Length']); return wh.apply(this, arguments); };
    res.on('finish', () => served.push({ path: decodeURIComponent(req.url.split('?')[0]), bytes: len, status: res.statusCode }));
  });
  /* paths the server answers 404 for (section 9); Chrome cannot intercept a
     worker's requests, so the refusal happens here */
  let refuse = null;
  const listeners = server.listeners('request');
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    if (refuse && refuse.test(req.url)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('refused by the test'); return; }
    for (const fn of listeners) fn(req, res);
  });
  const mark = () => served.length;
  const since = (i) => served.slice(i);
  const bytesOf = (list, re) => list.filter((r) => re.test(r.path)).reduce((a, r) => a + r.bytes, 0);

  /* The proxy is set on the test's own browser context, not on Chrome, so
     Chrome's own services (updates, sign-in) never reach it: everything it
     hears came from the page, its workers or its service worker. */
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 180000,
    args: ['--no-sandbox', '--disable-features=AutofillServerCommunication,OptimizationHints,OptimizationHintsFetching,OptimizationGuideModelDownloading,Translate,MediaRouter,PreconnectToSearch,NetworkPrediction', '--dns-prefetch-disable']
  });
  const hosts = new Set();
  const urls = [];
  let page;
  try {
    const ctx = proxy ? await browser.createBrowserContext({ proxyServer: 'http://127.0.0.1:' + proxyPort }) : browser.defaultBrowserContext();
    page = await ctx.newPage();
    page.on('request', (r) => {
      const u = r.url();
      urls.push(u);
      if (/^(data|blob):/.test(u)) return;           /* made on the device, never sent */
      try { hosts.add(new URL(u).host); } catch (e) { hosts.add(u); }
    });
    page.on('pageerror', (e) => console.log('  [page error] ' + e.message));
    await page.evaluateOnNewDocument(pageHelpers, true);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + '/pdf/merge-pdf/', { waitUntil: 'load', timeout: 120000 });

    const workerTargets = () => browser.targets().filter((t) => t.type() === 'worker').length;
    const settleWorkers = async (n) => { for (let i = 0; i < 40 && workerTargets() > n; i++) await new Promise((r) => setTimeout(r, 100)); return workerTargets(); };
    const baseWorkers = workerTargets();

    /* Chrome opens a bare connection to its default search engine when the
       context starts (no request is sent on it); the proxy judges from here,
       when the loader arrives. The page's own requests are all recorded. */
    const beforeLoader = [...proxyHosts];
    proxyHosts.clear();
    let t0 = mark();
    await page.addScriptTag({ url: BASE + '/engine/pdf-ocr-engine.js' });
    check(await page.evaluate(() => typeof window.MVROcr === 'object' && typeof window.MVROcr.create === 'function'), 'the loader attaches window.MVROcr');
    check(!since(t0).some((r) => /tesseract/.test(r.path)), 'nothing of tesseract is fetched until create()');
    const files = await page.evaluate(() => window.MVROcr.files(['eng']));
    check(/\/engine\/vendor\/tesseract\/tesseract-core-simd-lstm\.js$/.test(files.core), 'Chrome gets the SIMD LSTM-only core', files.core.replace(BASE, ''));

    /* ---- 1 English ---- */
    group('1  English at three sizes');
    t0 = mark();
    const c1 = await page.evaluate(async () => {
      const ev = [];
      const t = performance.now();
      const ocr = await window.MVROcr.create({ langs: ['eng'], onProgress: (f, l) => ev.push([f, l]) });
      window.__t.eng = ocr;
      return { ms: performance.now() - t, ev };
    });
    const createReq = since(t0);
    const labels = [...new Set(c1.ev.map((e) => e[1]))];
    check(labels.includes('Loading the OCR engine') && labels.includes('Loading English language data'), 'create reports progress in plain English', labels.join(' / '));
    const fr = c1.ev.map((e) => e[0]);
    check(fr.every((f, i) => i === 0 || f >= fr[i - 1] - 1e-9) && fr[fr.length - 1] === 1 && fr.every((f) => f >= 0 && f <= 1), 'create progress climbs from 0 to 1', fr.map((f) => f.toFixed(2)).join(' '));
    const engBytes = bytesOf(createReq, /eng\.traineddata\.gz$/);
    const coreBytes = bytesOf(createReq, /\/vendor\/tesseract\//);
    check(engBytes === 1962155, 'English data downloaded once, gzipped', kb(engBytes));
    check(createReq.some((r) => /tesseract-core-simd-lstm\.wasm$/.test(r.path)) && !createReq.some((r) => /\.wasm\.js$|tesseract-core-lstm|tesseract-core-simd\.|tesseract-core\./.test(r.path)), 'only the SIMD LSTM core and its .wasm are fetched', createReq.filter((r) => /vendor/.test(r.path)).map((r) => r.path.split('/').pop()).join(', '));
    check(createReq.length > 0 && createReq.every((r) => r.status === 200), 'every engine file answers 200', createReq.filter((r) => r.status !== 200).map((r) => r.status + ' ' + r.path).join(', '));
    check(urls.some((u) => /eng\.traineddata\.gz$/.test(u)), 'requests made inside the worker are seen by the host recorder');
    console.log('        create: ' + ms(c1.ms) + ', engine files ' + kb(coreBytes) + ', English data ' + kb(engBytes));

    const EN = ['The quick brown fox jumps over the lazy dog', 'Invoice 2026-10 total 4,512.75 due 31 October'];
    let maxDev = 0;
    let firstReadMs = 0;
    for (const size of [20, 32, 56]) {
      const r = await page.evaluate(async (EN, size) => {
        const d = window.__t.draw(EN, size, window.__t.EN_FONT);
        window.__t.store['en' + size] = d.canvas;
        const ev = [];
        const t = performance.now();
        const res = await window.__t.eng.recognize(d.canvas, { onProgress: (f, l) => ev.push([f, l]) });
        return { ms: performance.now() - t, res, drawn: d.words, ev, w: d.canvas.width, h: d.canvas.height };
      }, EN, size);
      if (!firstReadMs) firstReadMs = r.ms;
      const got = r.res.lines.map((l) => l.text);
      check(got.join('\n') === EN.join('\n'), size + ' px: the text exactly', JSON.stringify(got.join(' | ')));
      check(r.res.text.trim() === EN.join('\n'), size + ' px: .text carries the same lines');
      check(r.res.width === r.w && r.res.height === r.h, size + ' px: width and height are the image\'s', r.res.width + 'x' + r.res.height);
      check(r.ev.length > 0 && r.ev.every((e) => e[1] === 'Reading the text'), size + ' px: recognize reports "Reading the text"', r.ev.length + ' events');
      check(r.res.confidence > 80, size + ' px: mean confidence above 80', String(r.res.confidence));
      /* boxes: the n-th recognised word against the n-th drawn word */
      const words = r.res.words;
      let dev = 0, ok = words.length === r.drawn.length, bad = '';
      for (let i = 0; ok && i < words.length; i++) {
        const a = words[i], b = r.drawn[i];
        const d = Math.max(Math.abs(a.bbox.x0 - b.x0), Math.abs(a.bbox.x1 - b.x1), Math.abs(a.bbox.y0 - b.y0), Math.abs(a.bbox.y1 - b.y1));
        if (a.text !== b.text) { ok = false; bad = a.text + ' vs ' + b.text; }
        if (d > dev) dev = d;
        if (d > 4) { ok = false; bad = b.text + ' off by ' + d.toFixed(1) + ' px: got ' + JSON.stringify(a.bbox) + ' drew ' + [b.x0, b.y0, b.x1, b.y1].map((v) => v.toFixed(1)).join(','); }
      }
      maxDev = Math.max(maxDev, dev);
      check(ok, size + ' px: every word\'s box within 4 px of where it was drawn', bad || ('worst ' + dev.toFixed(1) + ' px'));
      const w0 = words[0] || {};
      check(w0.baseline && Math.abs(w0.baseline.y0 - r.drawn[0].base) <= 3 && Math.abs(w0.baseline.y1 - r.drawn[0].base) <= 3 && w0.confidence > 80 && w0.fontSize > 0.8 * size && w0.fontSize < 1.05 * size, size + ' px: words carry a confidence, a baseline on the drawn one and a font size near the drawn one', JSON.stringify({ baseline: w0.baseline, confidence: w0.confidence, fontSize: w0.fontSize }));
      check(r.res.lines.length === 2 && r.res.lines.every((l) => l.bbox && l.words.length), size + ' px: two lines, each with its box and words');
      console.log('        ' + size + ' px read in ' + ms(r.ms));
    }
    console.log('        worst English word-box edge, all sizes: ' + maxDev.toFixed(1) + ' px from where it was drawn');

    /* ---- 2 other image types ---- */
    group('2  ImageBitmap, ImageData and Blob');
    const kinds = await page.evaluate(async () => {
      const c = window.__t.store.en32;
      const out = {};
      out.bitmap = (await window.__t.eng.recognize(await createImageBitmap(c))).text.trim();
      out.imagedata = (await window.__t.eng.recognize(c.getContext('2d').getImageData(0, 0, c.width, c.height))).text.trim();
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
      out.blob = (await window.__t.eng.recognize(blob)).text.trim();
      return out;
    });
    for (const k of Object.keys(kinds)) check(kinds[k] === EN.join('\n'), k + ': the same text', JSON.stringify(kinds[k]));

    /* ---- 3 second recognize ---- */
    group('3  a second recognize on the same engine');
    t0 = mark();
    const again = await page.evaluate(async () => {
      const t = performance.now();
      const r = await window.__t.eng.recognize(window.__t.store.en32);
      return { ms: performance.now() - t, text: r.text.trim() };
    });
    check(since(t0).length === 0, 'nothing downloaded', since(t0).map((r) => r.path).join(', '));
    check(again.text === EN.join('\n'), 'the same text again');
    check(again.ms < c1.ms && again.ms < 3000, 'fast: well under the time create took', ms(again.ms) + ' vs create ' + ms(c1.ms));
    console.log('        first 20 px read ' + ms(firstReadMs) + ', repeat of 32 px ' + ms(again.ms));
    const full = await page.evaluate(async () => {
      const lines = [];
      for (let i = 0; i < 40; i++) lines.push('Line ' + (i + 1) + ' of a page of text set at 28 pixels, about 150 dpi');
      const d = window.__t.draw(lines, 28, window.__t.EN_FONT);
      const t = performance.now();
      const r = await window.__t.eng.recognize(d.canvas);
      return { ms: performance.now() - t, w: d.canvas.width, h: d.canvas.height, lines: r.lines.length, words: r.words.length, drawn: d.words.length,
        exact: r.lines.map((l) => l.text).join('\n') === lines.join('\n') };
    });
    check(full.lines === 40 && full.words === full.drawn && full.exact, 'a 40-line page: every line and word, exactly', full.w + 'x' + full.h + ' px in ' + ms(full.ms));
    await page.evaluate(() => window.__t.eng.terminate());
    check(await page.evaluate(() => window.__t.eng.closed), 'terminate() closes the engine');
    check(await page.evaluate(() => window.__t.eng.recognize(window.__t.store.en20).then(() => false, () => true)), 'recognize after terminate() rejects');
    check((await settleWorkers(baseWorkers)) === baseWorkers, 'terminate() leaves no worker running');

    /* ---- 4 Hindi ---- */
    group('4  Hindi');
    const HI = 'भारत एक विशाल देश है';
    t0 = mark();
    const c2 = await page.evaluate(async () => {
      const ev = [];
      const t = performance.now();
      window.__t.hin = await window.MVROcr.create({ langs: ['hin'], onProgress: (f, l) => ev.push(l) });
      return { ms: performance.now() - t, labels: [...new Set(ev)] };
    });
    const hinBytes = bytesOf(since(t0), /hin\.traineddata\.gz$/);
    check(c2.labels.includes('Loading Hindi language data'), 'progress names Hindi', c2.labels.join(' / '));
    check(hinBytes === 920821, 'Hindi data downloaded once, gzipped', kb(hinBytes));
    check(bytesOf(since(t0), /eng\.traineddata/) === 0, 'no English data for a Hindi-only engine');
    console.log('        create: ' + ms(c2.ms) + ', Hindi data ' + kb(hinBytes));
    for (const size of [32, 48]) {
      const r = await page.evaluate(async (HI, size) => {
        const d = window.__t.draw([HI], size, window.__t.HI_FONT);
        window.__t.store['hi' + size] = d.canvas;
        const t = performance.now();
        const res = await window.__t.hin.recognize(d.canvas);
        return { ms: performance.now() - t, res, drawn: d.words };
      }, HI, size);
      const text = r.res.text.trim().replace(/\s+/g, ' ');
      const e = cer(HI, text);
      check(e < 0.05, size + ' px: character error rate under 5%', 'CER ' + (e * 100).toFixed(1) + '%, read ' + JSON.stringify(text) + ' in ' + ms(r.ms));
      /* boxes: each drawn word is covered by the recognised word in the same place */
      let worst = 0, bad = '';
      const words = r.res.words;
      if (words.length !== r.drawn.length) bad = words.length + ' words read, ' + r.drawn.length + ' drawn';
      for (let i = 0; !bad && i < words.length; i++) {
        const a = words[i].bbox, b = r.drawn[i];
        const d = Math.max(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.y0 - b.y0), Math.abs(a.y1 - b.y1));
        worst = Math.max(worst, d);
        if (d > 6) bad = b.text + ' off by ' + d.toFixed(1) + ' px: got ' + JSON.stringify(a) + ' drew ' + [b.x0, b.y0, b.x1, b.y1].map((v) => v.toFixed(1)).join(',');
      }
      check(!bad, size + ' px: every word\'s box within 6 px of where it was drawn', bad || ('worst ' + worst.toFixed(1) + ' px'));
    }
    await page.evaluate(() => window.__t.hin.terminate());

    /* ---- 5 both ---- */
    group('5  English and Hindi together');
    t0 = mark();
    const both = await page.evaluate(async (EN, HI) => {
      const ev = [];
      const t = performance.now();
      const ocr = await window.MVROcr.create({ langs: ['eng', 'hin'], onProgress: (f, l) => ev.push(l) });
      const ms = performance.now() - t;
      const d = window.__t.draw([EN[0]], 32, window.__t.EN_FONT);
      const h = window.__t.draw([HI], 40, window.__t.HI_FONT);
      const c = document.createElement('canvas');
      c.width = Math.max(d.canvas.width, h.canvas.width); c.height = d.canvas.height + h.canvas.height;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(d.canvas, 0, 0); g.drawImage(h.canvas, 0, d.canvas.height);
      const r = await ocr.recognize(c);
      ocr.terminate();
      const dbs = indexedDB.databases ? (await indexedDB.databases()).map((x) => x.name) : ['(databases() unsupported)'];
      return { ms, labels: [...new Set(ev)], lines: r.lines.map((l) => l.text), dbs };
    }, EN, HI);
    const bothReq = since(t0);
    check(both.labels.includes('Loading English and Hindi language data'), 'progress names both languages', both.labels.join(' / '));
    check(bytesOf(bothReq, /eng\.traineddata\.gz$/) === 1962155 && bytesOf(bothReq, /hin\.traineddata\.gz$/) === 920821, 'both languages\' data downloaded again: the engine keeps no copy of its own');
    check(both.lines[0] === EN[0], 'the English line exactly', JSON.stringify(both.lines[0]));
    const hiLine = (both.lines[1] || '').replace(/\s+/g, ' ');
    check(cer(HI, hiLine) < 0.05, 'the Hindi line, CER under 5%', 'CER ' + (cer(HI, hiLine) * 100).toFixed(1) + '% ' + JSON.stringify(hiLine));
    check(!both.dbs.includes('keyval-store'), 'nothing written to IndexedDB', JSON.stringify(both.dbs));
    console.log('        create with both languages: ' + ms(both.ms));

    /* ---- 6 abort ---- */
    group('6  abort');
    const ab1 = await page.evaluate(async () => {
      const ac = new AbortController();
      const t = performance.now();
      let first = null;
      try {
        await window.MVROcr.create({ langs: ['eng'], signal: ac.signal, onProgress: (f, l) => { if (!first && f > 0.3) { first = l; ac.abort(); } } });
        return { ok: true };
      } catch (e) { return { name: e.name, msg: e.message, at: first, ms: performance.now() - t }; }
    });
    check(ab1.name === 'AbortError', 'abort while loading rejects with AbortError', JSON.stringify(ab1));
    check((await settleWorkers(baseWorkers)) === baseWorkers, 'and leaves no worker running', workerTargets() + ' worker(s)');

    const ab2 = await page.evaluate(async () => {
      const ac = new AbortController();
      const ocr = await window.MVROcr.create({ langs: ['eng'], signal: ac.signal });
      /* a page-sized image, so the read is still running when the abort lands */
      const lines = [];
      for (let i = 0; i < 40; i++) lines.push('Line ' + i + ' of a long page of text that takes a while to read');
      const d = window.__t.draw(lines, 28, window.__t.EN_FONT);
      let reading = false;
      const t = performance.now();
      const p = ocr.recognize(d.canvas, { onProgress: () => { if (!reading) { reading = true; setTimeout(() => ac.abort(), 30); } } });
      const out = await p.then(() => ({ ok: true }), (e) => ({ name: e.name, msg: e.message }));
      out.ms = performance.now() - t;
      out.closed = ocr.closed;
      out.after = await ocr.recognize(d.canvas).then(() => 'resolved', (e) => e.name);
      return out;
    });
    check(ab2.name === 'AbortError', 'abort while reading rejects with AbortError', JSON.stringify(ab2));
    check(ab2.closed && ab2.after === 'AbortError', 'the engine is closed after the abort');
    check((await settleWorkers(baseWorkers)) === baseWorkers, 'and leaves no worker running', workerTargets() + ' worker(s)');

    const ab3 = await page.evaluate(async () => {
      const ac = new AbortController(); ac.abort();
      return window.MVROcr.create({ langs: ['eng'], signal: ac.signal }).then(() => 'resolved', (e) => e.name);
    });
    check(ab3 === 'AbortError', 'an already-aborted signal rejects at once');
    check(await page.evaluate(() => window.MVROcr.create({ langs: ['fra'] }).then(() => 'resolved', (e) => e.message)) !== 'resolved', 'a language we do not ship is refused');

    /* ---- 7 the service worker ---- */
    group('7  what stays on the device (the site\'s service worker allowed)');
    const pageB = await ctx.newPage();
    pageB.on('request', (r) => {
      const u = r.url();
      urls.push(u);
      if (/^(data|blob):/.test(u)) return;
      try { hosts.add(new URL(u).host); } catch (e) { hosts.add(u); }
    });
    await pageB.evaluateOnNewDocument(pageHelpers, false);
    await pageB.goto(BASE + '/pdf/merge-pdf/', { waitUntil: 'load', timeout: 120000 });
    await pageB.evaluate(() => navigator.serviceWorker.ready.then(() => null));
    if (!(await pageB.evaluate(() => !!navigator.serviceWorker.controller))) await pageB.reload({ waitUntil: 'load' });
    check(await pageB.evaluate(() => !!navigator.serviceWorker.controller), 'the service worker controls the page');
    await pageB.addScriptTag({ url: BASE + '/engine/pdf-ocr-engine.js' });
    const createOnB = () => pageB.evaluate(async (EN) => {
      const t = performance.now();
      const o = await window.MVROcr.create({ langs: ['eng'] });
      const ms = performance.now() - t;
      const r = await o.recognize(window.__t.draw(EN, 32, window.__t.EN_FONT).canvas);
      o.terminate();
      return { ms, text: r.text.trim() };
    }, EN);
    t0 = mark();
    const b1 = await createOnB();
    const b1Req = since(t0);
    check(b1.text === EN.join('\n') && bytesOf(b1Req, /eng\.traineddata\.gz$/) === 1962155, 'first create under the service worker: downloaded, and reads', kb(bytesOf(b1Req, /./)) + ' in ' + ms(b1.ms));
    t0 = mark();
    const b2 = await createOnB();
    const b2Req = since(t0);
    check(b2.text === EN.join('\n') && !b2Req.some((r) => /tesseract|tessdata/.test(r.path)), 'second create: nothing downloaded (the service worker\'s cache)', b2Req.map((r) => r.path).join(', ') || 'no request reached the server, ' + ms(b2.ms));
    const cached = await pageB.evaluate(async () => {
      const out = [];
      for (const k of await caches.keys()) {
        const c = await caches.open(k);
        for (const req of await c.keys()) {
          const p = new URL(req.url).pathname;
          if (/tesseract|tessdata/.test(p)) { const res = await c.match(req); out.push([p.split('/').pop(), (await res.arrayBuffer()).byteLength]); }
        }
      }
      const dbs = indexedDB.databases ? (await indexedDB.databases()).map((x) => x.name) : [];
      return { out, dbs };
    });
    const names = cached.out.map((x) => x[0]).sort();
    check(['eng.traineddata.gz', 'tesseract-core-simd-lstm.js', 'tesseract-core-simd-lstm.wasm', 'tesseract.min.js', 'worker.min.js'].every((n) => names.includes(n)),
      'Cache Storage holds the engine and the gzipped English data', cached.out.map((x) => x[0] + ' ' + kb(x[1])).join(', '));
    check(!cached.dbs.includes('keyval-store'), 'and IndexedDB holds nothing of the engine\'s', JSON.stringify(cached.dbs));
    await pageB.close();
    await settleWorkers(baseWorkers);

    /* ---- 8 without SIMD ---- */
    group('8  a browser without WebAssembly SIMD');
    const pageC = await ctx.newPage();
    pageC.on('request', (r) => {
      const u = r.url();
      urls.push(u);
      if (/^(data|blob):/.test(u)) return;
      try { hosts.add(new URL(u).host); } catch (e) { hosts.add(u); }
    });
    await pageC.evaluateOnNewDocument(pageHelpers, true);
    /* answer "no" to any SIMD probe, as Safari before 16.4 would */
    await pageC.evaluateOnNewDocument(() => {
      const v = WebAssembly.validate;
      WebAssembly.validate = function (b) {
        const a = new Uint8Array(b instanceof ArrayBuffer ? b : b.buffer || b);
        if (a.length < 64 && a.includes(253)) return false;
        return v.apply(this, arguments);
      };
    });
    await pageC.goto(BASE + '/pdf/merge-pdf/', { waitUntil: 'load', timeout: 120000 });
    await pageC.addScriptTag({ url: BASE + '/engine/pdf-ocr-engine.js' });
    const u0 = urls.length;
    const ns = await pageC.evaluate(async (EN) => {
      const t = performance.now();
      const o = await window.MVROcr.create({ langs: ['eng'] });
      const ms = performance.now() - t;
      const t2 = performance.now();
      const r = await o.recognize(window.__t.draw(EN, 32, window.__t.EN_FONT).canvas);
      const ms2 = performance.now() - t2;
      o.terminate();
      return { ms, ms2, text: r.text.trim(), core: window.MVROcr.files().core };
    }, EN);
    const coreFiles = urls.slice(u0).filter((u) => /tesseract-core/.test(u)).map((u) => u.split('/').pop());
    check(/tesseract-core-lstm\.js$/.test(ns.core) && coreFiles.join() === 'tesseract-core-lstm.js,tesseract-core-lstm.wasm', 'it gets the plain LSTM-only core and its .wasm', coreFiles.join(', '));
    check(ns.text === EN.join('\n'), 'and reads the same text exactly', 'create ' + ms(ns.ms) + ', read ' + ms(ns.ms2));
    await pageC.close();
    await settleWorkers(baseWorkers);

    /* ---- 9 missing data ---- */
    group('9  language data that will not download');
    const pageD = await ctx.newPage();
    pageD.on('request', (r) => {
      const u = r.url();
      urls.push(u);
      if (!/^(data|blob):/.test(u)) { try { hosts.add(new URL(u).host); } catch (e) { hosts.add(u); } }
    });
    await pageD.setBypassServiceWorker(true);
    refuse = /hin\.traineddata\.gz$/;
    await pageD.evaluateOnNewDocument(pageHelpers, true);
    await pageD.goto(BASE + '/pdf/merge-pdf/', { waitUntil: 'load', timeout: 120000 });
    await pageD.addScriptTag({ url: BASE + '/engine/pdf-ocr-engine.js' });
    const miss = await pageD.evaluate(async () => {
      const t = performance.now();
      const timeout = new Promise((r) => setTimeout(() => r({ hung: true }), 20000));
      const out = await Promise.race([window.MVROcr.create({ langs: ['hin'] }).then(() => ({ resolved: true }), (e) => ({ name: e.name, msg: e.message })), timeout]);
      out.ms = performance.now() - t;
      return out;
    });
    refuse = null;
    check(miss.msg === 'The Hindi language data could not be downloaded (HTTP 404).' && !miss.hung, 'create() rejects in plain English instead of hanging', JSON.stringify(miss));
    check((await settleWorkers(baseWorkers)) === baseWorkers, 'and leaves no worker running', workerTargets() + ' worker(s)');
    await pageD.close();

    /* ---- hosts ---- */
    group('hosts');
    /* a deliberate request to a host that cannot exist proves the proxy hears the page */
    const PROBE = 'mvr-proxy-probe.invalid';
    if (proxy) await page.evaluate((h) => fetch('http://' + h + '/').catch(() => null), PROBE);
    const foreign = [...hosts].filter((h) => !/^127\.0\.0\.1(:\d+)?$/.test(h) && h !== PROBE);
    check(!foreign.length, 'no page or worker request left 127.0.0.1', foreign.join(', ') || [...hosts].filter((h) => h !== PROBE).join(', '));
    if (proxy) {
      check(proxyHosts.has(PROBE), 'the recording proxy is live (it heard the probe)');
      const other = [...proxyHosts].filter((h) => h !== PROBE);
      check(!other.length, 'nothing else reached the recording proxy once the loader was on the page', other.join(', '));
      if (beforeLoader.length) console.log('        before the loader, Chrome itself connected to: ' + beforeLoader.join(', ') + ' (no page request; see above)');
    }
    console.log('        ' + served.length + ' requests served; language data per language: English ' + kb(engBytes) + ', Hindi ' + kb(hinBytes) + '; engine files per create ' + kb(coreBytes));
  } finally {
    await browser.close();
    server.close();
    if (proxy) proxy.close();
  }
}

main().then(() => {
  console.log('\n' + (pass + fail) + ' assertions   ' + pass + ' passed   ' + fail + ' failed');
  if (fail) { console.log('\nFailures:\n  ' + failures.join('\n  ')); process.exit(2); }
}, (e) => {
  console.error('\nthe run broke: ' + (e && e.stack || e));
  process.exit(1);
});
