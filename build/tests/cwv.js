/**
 * Core Web Vitals in the lab: LCP, CLS and INP on 12 pages, the method of the
 * 2026-10-04 pass — a first visit (fresh profile, no service worker, empty
 * cache), CPU slowed 4x, the network at DevTools' "Slow 4G" — with a
 * puppeteer trace of every load kept for inspection.
 *
 *   node build/tests/cwv.js --root <site> [--port 9117] [--runs 3] [--out <dir>]
 *        [--compare <older site>] [--json <file>]
 *
 * --compare serves the older site on port+1 and measures it in the same way,
 * page by page and interleaved, so a slow minute on the machine hits both.
 * Each figure is the median of --runs loads. INP is the slowest interaction
 * of a scripted one: a click on the tool's first control, then three keys
 * typed into its first text box (Event Timing, interactionId > 0).
 * Exit code 2 when, with --compare, a page's median LCP or INP is worse by
 * more than 10% and 50 ms, or its CLS by more than 0.02.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OLD = arg('--compare', '') ? path.resolve(arg('--compare', '')) : null;
const PORT = Number(arg('--port', 9117));
const RUNS = Number(arg('--runs', 3));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-cwv')));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  '/', '/image/', '/image/image-compressor/', '/image/image-cropper/', '/pdf/merge-pdf/', '/pdf/compress-pdf/',
  '/text/word-counter/', '/developer/json-formatter/', '/finance/compound-interest/', '/time/age-calculator/',
  '/qr/qr-code-generator/', '/conversions/length/'
];

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found');
}
const puppeteer = loadPuppeteer();
const { serve } = require('./serve.js');
const SLOW4G = (puppeteer.PredefinedNetworkConditions && puppeteer.PredefinedNetworkConditions['Slow 4G']) ||
  { download: (1.6 * 1000 * 1000) / 8 * 0.9, upload: (750 * 1000) / 8 * 0.9, latency: 150 * 3.75 };

const OBSERVE = () => {
  window.__cwv = { lcp: 0, cls: 0, inp: 0 };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__cwv.lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cwv.cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__cwv.inp = Math.max(window.__cwv.inp, e.duration); })
      .observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch (e) { /* old */ }
};

async function measure(browser, base, p, tag, run) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1350, height: 940 });
  /* no interception (it can bypass the throttling); consent is refused, so nothing leaves 127.0.0.1 */
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) {} });
  await page.evaluateOnNewDocument(OBSERVE);
  await page.emulateCPUThrottling(4);
  await page.emulateNetworkConditions(SLOW4G);
  const trace = path.join(OUT, tag + '-' + p.replace(/\W+/g, '_') + '-' + run + '.json');
  await page.tracing.start({ path: trace, screenshots: false });
  await page.goto(base + p, { waitUntil: 'load', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500));
  /* one interaction: the tool's first control, then typing */
  await page.evaluate(() => {
    const t = document.querySelector('.tool input:not([type=file]):not([type=hidden]), .tool textarea, .tool select, #q');
    if (t) t.setAttribute('data-cwv', '1');
  });
  const target = await page.$('[data-cwv]');
  if (target) {
    await target.click().catch(() => {});
    await page.keyboard.type('123', { delay: 120 });
  }
  await new Promise((r) => setTimeout(r, 1500));
  await page.tracing.stop();
  const m = await page.evaluate(() => window.__cwv);
  await ctx.close();
  return m;
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

(async () => {
  const s1 = await serve(ROOT, PORT);
  const s2 = OLD ? await serve(OLD, PORT + 1) : null;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const rows = [];
  try {
    for (const p of PAGES) {
      const now = [], old = [];
      for (let i = 0; i < RUNS; i++) {
        if (OLD) old.push(await measure(browser, 'http://127.0.0.1:' + (PORT + 1), p, 'before', i));
        now.push(await measure(browser, 'http://127.0.0.1:' + PORT, p, 'after', i));
      }
      const pick = (l) => ({ lcp: median(l.map((x) => x.lcp)), cls: median(l.map((x) => x.cls)), inp: median(l.map((x) => x.inp)) });
      const r = { page: p, after: pick(now), before: OLD ? pick(old) : null };
      rows.push(r);
      const f = (x) => x ? (x.lcp / 1000).toFixed(2) + ' s  CLS ' + x.cls.toFixed(3) + '  INP ' + Math.round(x.inp) + ' ms' : '';
      console.log(p.padEnd(30) + (OLD ? 'before LCP ' + f(r.before) + '   |   ' : '') + 'after LCP ' + f(r.after));
    }
  } finally {
    await browser.close();
    if (s1) s1.close();
    if (s2) s2.close();
  }
  let worse = 0;
  if (OLD) {
    for (const r of rows) {
      const b = r.before, a = r.after;
      const bad = (a.lcp - b.lcp > Math.max(50, b.lcp * 0.1)) || (a.inp - b.inp > Math.max(50, b.inp * 0.1)) || (a.cls - b.cls > 0.02);
      if (bad) { worse++; console.log('  worse: ' + r.page); }
    }
  }
  if (arg('--json', '')) fs.writeFileSync(arg('--json', ''), JSON.stringify(rows, null, 2));
  console.log('\n' + rows.length + ' pages, ' + RUNS + ' runs each' + (OLD ? ', ' + worse + ' worse than before' : '') + '. Traces in ' + OUT);
  process.exit(worse ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
