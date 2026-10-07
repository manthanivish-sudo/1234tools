/**
 * The "show, don't tell" layer, in headless Chrome against a static server:
 * the Example and "Why people use it" panels, the proof pills, the card
 * thumbnails and the home page's "See it work" strip.
 *
 *   node build/tests/proof.js [--port 8760] [--root <site>] [--out <dir>]
 *
 * --root defaults to the site this file sits in and is served on --port by
 * build/tests/serve.js (ports 8760-8769 are this test's). --out defaults to a
 * folder in the OS temp dir. Exit code 2 when a case fails, 1 when the run
 * itself breaks.
 *
 * What it proves:
 *   static  every published example's pictures exist, are WebP, at most 720 px
 *           and 60 KB, and the total is reported; every tool page with a story
 *           has one pill row and one Why panel, every one with a published
 *           example one Example panel and none for a schematic tool; no page
 *           carries both its own "How it works" and the story's steps; every
 *           image the layer writes has width and height; hub and collection
 *           cards carry a thumbnail exactly when their tool has a picture and
 *           the home category cards never do; build-proof.js and
 *           build-examples.js --check say 0; app.css has the D5-proof block
 *   1  GST calculator: the Example panel shows the captured inputs and
 *      results; "Try these numbers" fills the form with them, scrolls to the
 *      tool, puts them in the #fragment, and the tool then shows the same
 *      primary and secondary results; the same link opened cold fills it too
 *   2  background remover: the range input moves the result's clip-path; the
 *      pictures are lazy, sized, and cause no layout shift; without JS the
 *      two pictures sit side by side
 *   3  a text tool: "Try it" puts the example input in the box and the tool's
 *      output matches the captured one
 *   4  a schematic (AI business) tool: a Why panel, no Example panel
 *   5  the hubs and a collection: thumbnails only on cards whose tool has one
 *   6  home: eight tiles at 1366 and 390 px, no horizontal overflow, every
 *      tile links to its tool
 *   7  every example text container is under the analytics MASK; embed mode
 *      hides the layer
 *   8  screenshots at 1366 and 390, light and dark
 *   and, through all of it, not one request to anything but 127.0.0.1.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8760));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-proof')));
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}
const puppeteer = loadPuppeteer();
const { serve } = require('./serve.js');

let pass = 0, fail = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (detail !== undefined && !ok ? '   (' + String(detail).slice(0, 400) + ')' : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* The analytics MASK, copied from assets/analytics.js. */
const MASK = ['input', 'textarea', 'select', 'canvas', '[contenteditable]',
  '[class*="result"]', '[class*="output"]', '[class*="readout"]',
  '[class*="preview"]', '[class*="display"]', '#recent-tools',
  '.io-pane', '.io-msg', '.pdf-file-name', '.page-grid', '.stat-val', '.tool-table',
  '.tool-chart', '.calc-recent', '.calc-compare', '.formula-filled', '.working',
  '.print-head', '.conv-batch', '.conv-live', '.fx-grid', '.calc-history'].join(',');

function load(file, name) {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, file), 'utf8'))(w);
  return w[name] || {};
}
const EX = load('assets/examples.js', 'TOOL_EXAMPLES');
const ST = load('assets/stories.js', 'TOOL_STORIES');

/* ---------- static ---------- */

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'build' || name === 'conversions') continue;
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, out);
    else if (name === 'index.html') out.push(abs);
  }
  return out;
}

function webpSize(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  return null;
}

function staticChecks() {
  /* the pictures */
  let total = 0, files = 0;
  const bad = [];
  const dir = path.join(ROOT, 'assets/img/examples');
  for (const [p, ex] of Object.entries(EX)) {
    for (const role of ['before', 'after', 'page', 'thumb', 'thumbBefore']) {
      if (!ex[role]) continue;
      const abs = path.join(ROOT, ex[role].replace(/^\//, ''));
      if (!fs.existsSync(abs)) { bad.push(p + ' ' + role + ' missing'); continue; }
      const buf = fs.readFileSync(abs);
      const size = webpSize(buf);
      const want = ex[role + 'Size'] || (role === 'thumbBefore' ? ex.thumbSize : null);
      if (!size) bad.push(p + ' ' + role + ' is not WebP');
      else if (Math.max(size[0], size[1]) > 720) bad.push(p + ' ' + role + ' is ' + size.join('x'));
      else if (want && (want[0] !== size[0] || want[1] !== size[1])) bad.push(p + ' ' + role + ' is ' + size.join('x') + ', examples.js says ' + want.join('x'));
      if (buf.length > 60 * 1024) bad.push(p + ' ' + role + ' ' + (buf.length / 1024).toFixed(1) + ' KB');
    }
  }
  (function sum(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const a = path.join(d, e.name);
      if (e.isDirectory()) sum(a); else { total += fs.statSync(a).size; files++; }
    }
  })(dir);
  check(bad.length === 0, 'every published picture exists, is WebP, at most 720 px and 60 KB, and matches examples.js', bad.slice(0, 5).join('; '));
  console.log('      assets/img/examples: ' + (total / 1024 / 1024).toFixed(2) + ' MB in ' + files + ' files (target 5 MB)');
  check(total <= 5 * 1024 * 1024, 'assets/img/examples is within 5 MB (' + (total / 1024 / 1024).toFixed(2) + ' MB)');
  check(fs.existsSync(path.join(dir, 'CREDITS.txt')) && /CC0/.test(fs.readFileSync(path.join(dir, 'CREDITS.txt'), 'utf8')), 'CREDITS.txt names the CC0 photos');
  check(!Object.values(EX).some((e) => e.kind === 'schematic'), 'no schematic example is published');
  check(!Object.values(EX).some((e) => (e.input || '').length > 600 || (e.output || '').length > 600), 'example text is at most 600 characters');

  /* the pages */
  const problems = { pills: [], why: [], example: [], schematic: [], dup: [], noSize: [], thumbs: [], homeCats: [] };
  let tools = 0, panels = 0, thumbsSeen = 0;
  for (const abs of walk(ROOT, [])) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const html = fs.readFileSync(abs, 'utf8');
    if (/name="robots" content="noindex/.test(html)) continue;
    const blocks = (html.match(/<!-- PROOF: generated by build-proof\.js, do not edit -->[\s\S]*?<!-- \/PROOF -->/g) || []).join('\n') +
      ((/<!-- SEEITWORK[\s\S]*?<!-- \/SEEITWORK -->/.exec(html) || [''])[0]);
    for (const tag of (blocks.match(/<img\b[^>]*>/g) || []).concat(html.match(/<img class="card-thumb"[^>]*>/g) || [])) {
      if (!/ width="\d+"/.test(tag) || !/ height="\d+"/.test(tag)) problems.noSize.push(rel + ' ' + tag.slice(0, 80));
    }
    const canon = /<link rel="canonical" href="https:\/\/www\.1234tools\.com([^"]+)"/.exec(html);
    const url = canon ? canon[1] : '/' + rel.replace(/index\.html$/, '');
    if (/<article class="tool[ "]/.test(html) && !/^(learn|practice|account|pwa)\//.test(rel) && ST[url]) {
      tools++;
      const pills = (html.match(/<ul class="proof-pills"/g) || []).length;
      const why = (html.match(/class="panel proof proof-why"/g) || []).length;
      const exn = (html.match(/id="see-example"/g) || []).length;
      if (pills !== 1) problems.pills.push(rel + ' ' + pills);
      if (why !== 1) problems.why.push(rel + ' ' + why);
      if (exn !== (EX[url] ? 1 : 0)) problems.example.push(rel + ' ' + exn);
      if (exn) panels++;
      const own = /<h2[^>]*>\s*How (?:it works|to use)\b/i.test(html);
      if (own && /class="proof-steps"/.test(html)) problems.dup.push(rel);
      if (!own && ST[url].steps.length && !/class="proof-steps"/.test(html)) problems.dup.push(rel + ' (no steps at all)');
    }
    /* cards */
    const hub = /^[a-z-]+\/index\.html$/.test(rel) && /<!-- HUBS|class="hub-verb"|<div class="grid">/.test(html) && !/^(for|tools|guides|compare|learn|conversions|account|practice|pwa|settings|about|contact|privacy|terms|cookies|pricing|trust)\//.test(rel);
    const coll = /^(hi\/)?for\/[^/]+\/index\.html$/.test(rel);
    const re = /<a class="card(?: [^"]*)?" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
      const has = /class="card-thumb"/.test(m[2]);
      if (has) thumbsSeen++;
      if (/card-lg/.test(m[0].slice(0, 60))) { if (has) problems.homeCats.push(rel + ' ' + m[1]); continue; }
      if (!hub && !coll) { if (has) problems.thumbs.push(rel + ' has a thumbnail on ' + m[1] + ' (not a hub or collection)'); continue; }
      const want = !!(EX[m[1]] && EX[m[1]].thumb);
      if (has !== want) problems.thumbs.push(rel + ' ' + m[1] + (has ? ' has a thumbnail it should not' : ' lacks its thumbnail'));
    }
  }
  check(tools >= 233 && problems.pills.length === 0, 'one proof-pill row on each of the ' + tools + ' tool pages with a story', problems.pills.slice(0, 4).join(', '));
  check(problems.why.length === 0, 'one "Why people use it" panel on each', problems.why.slice(0, 4).join(', '));
  check(problems.example.length === 0 && panels === Object.keys(EX).length, 'an Example panel exactly where an example is published (' + panels + ')', problems.example.slice(0, 4).join(', '));
  check(problems.dup.length === 0, 'steps only where the page has no "How it works" of its own', problems.dup.slice(0, 4).join(', '));
  check(problems.noSize.length === 0, 'every image the layer writes has width and height', problems.noSize.slice(0, 3).join(' | '));
  check(problems.thumbs.length === 0 && thumbsSeen > 100, 'hub and collection cards carry a thumbnail exactly when their tool has a picture (' + thumbsSeen + ')', problems.thumbs.slice(0, 4).join('; '));
  check(problems.homeCats.length === 0, 'the home category cards (card-lg) never get one', problems.homeCats.slice(0, 3).join(', '));

  for (let i = 1; i <= 2; i++) {
    let out = '';
    try { out = cp.execFileSync(process.execPath, ['build-proof.js', '--check'], { cwd: ROOT, encoding: 'utf8' }); }
    catch (e) { out = String(e.stdout || e.message); }
    check(/\b0 file\(s\) would change/.test(out), 'build-proof.js --check run ' + i + ': 0 file(s) would change', out.trim().split('\n').pop());
  }
  if (fs.existsSync(path.join(ROOT, 'build-examples.js'))) {
    let out = '';
    try { out = cp.execFileSync(process.execPath, ['build-examples.js', '--check'], { cwd: ROOT, encoding: 'utf8' }); }
    catch (e) { out = String(e.stdout || e.message); }
    check(/\b0 file\(s\) would change/.test(out), 'build-examples.js --check: 0 file(s) would change', out.trim().split('\n').pop());
  }
  const css = fs.readFileSync(path.join(ROOT, 'assets/app.css'), 'utf8');
  check(css.indexOf('/* ==== D5-proof') >= 0 && css.indexOf('/* ==== /D5-proof') >= 0, 'app.css carries the D5-proof block');
}

/* ---------- browser ---------- */

/* The /ai/ pages load the account SDK from gstatic.com before anyone signs
   in; that is theirs, not this layer's. It is refused here, and counted
   apart, so "nothing left 127.0.0.1" means everything else. */
const ACCOUNT_SDK = /^https:\/\/www\.gstatic\.com\/firebasejs\//;
const external = [];
let sdk = 0;
async function watch(p) {
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = r.url();
    if (/^(data|about|blob|chrome-error):/.test(u) || u.indexOf(BASE + '/') === 0) { r.continue(); return; }
    if (ACCOUNT_SDK.test(u)) sdk++; else external.push(u);
    r.abort();
  });
  p.on('pageerror', (e) => console.log('  [pageerror]', e.message));
}

async function open(browser, url, opts) {
  opts = opts || {};
  const page = await browser.newPage();
  await watch(page);
  await page.evaluateOnNewDocument((theme) => {
    try { localStorage.setItem('1234tools-consent', 'denied'); if (theme) localStorage.setItem('1234tools-theme', theme); } catch (e) {}
    window.__shift = 0;
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shift += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}
  }, opts.theme || null);
  if (opts.noJs) await page.setJavaScriptEnabled(false);
  await page.setViewport({ width: opts.width || 1366, height: opts.height || 900 });
  await page.goto(BASE + url, { waitUntil: 'networkidle0', timeout: 60000 });
  return page;
}

async function toView(page, sel) {
  await page.evaluate((s) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const e = document.querySelector(s);
    if (e) e.scrollIntoView({ block: 'start', behavior: 'instant' });
    window.scrollBy({ top: -80, behavior: 'instant' });
  }, sel);
  await page.evaluate(() => Promise.race([new Promise((r) => setTimeout(r, 3000)),
    Promise.all([...document.images].filter((i) => !i.complete && i.getBoundingClientRect().top < innerHeight * 2).map((i) => new Promise((r) => { i.onload = i.onerror = r; })))]));
  await sleep(250);
}

const readResults = (page) => page.$$eval('.tool .tool-results .result', (rows) => rows.map((r) => ({
  label: (r.querySelector('.result-label') || {}).textContent.trim(),
  value: (r.querySelector('.result-value') || {}).textContent.trim(),
  primary: r.classList.contains('result-primary')
})));

async function caseGst(browser) {
  const url = '/india/gst-calculator/';
  const ex = EX[url];
  check(!!ex && ex.kind === 'calc', 'GST: a calc example is published');
  const page = await open(browser, url);
  const shown = await page.evaluate(() => {
    const p = document.querySelector('#see-example');
    if (!p) return null;
    return {
      inputs: [...p.querySelectorAll('.proof-in .proof-fields > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]),
      primary: [p.querySelector('.proof-primary .proof-label').textContent, p.querySelector('.proof-primary .proof-value').textContent],
      more: [...p.querySelectorAll('.proof-more > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]),
      href: p.querySelector('a.proof-try').getAttribute('href'),
      label: p.querySelector('a.proof-try').textContent.trim(),
      after: (() => { const s = document.querySelector('.share'); return !!(s && s.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING); })()
    };
  });
  check(!!shown, 'GST: the Example panel is on the page');
  if (!shown) { await page.close(); return; }
  const prim = ex.results.find((r) => r.primary);
  const more = ex.results.filter((r) => !r.primary).slice(0, 2);
  check(JSON.stringify(shown.inputs) === JSON.stringify(ex.inputs.slice(0, 8).map((f) => [f.label, f.value])), 'GST: it shows the captured inputs', JSON.stringify(shown.inputs));
  check(shown.primary[0] === prim.label && shown.primary[1] === prim.value && JSON.stringify(shown.more) === JSON.stringify(more.map((r) => [r.label, r.value])),
    'GST: it shows the primary and two secondary results as captured (' + prim.value + ', ' + more.map((r) => r.value).join(', ') + ')', JSON.stringify(shown));
  check(shown.after, 'GST: the panel sits after the share row');
  check(shown.label === 'Try these numbers' && /^#amount=11800&mode=inclusive/.test(shown.href), 'GST: "Try these numbers" carries the inputs in the fragment', shown.href);

  const before = await page.$eval('.tool .tool-form [name="amount"]', (e) => e.value);
  await toView(page, '#see-example');
  await page.click('#see-example a.proof-try');
  await sleep(1200);
  const st = await page.evaluate(() => ({
    amount: document.querySelector('.tool .tool-form [name="amount"]').value,
    mode: document.querySelector('.tool .tool-form [name="mode"]').value,
    hash: location.hash,
    top: document.querySelector('.tool .calc').getBoundingClientRect().top
  }));
  const res = await readResults(page);
  check(st.amount === '11800' && st.mode === 'inclusive' && before !== st.amount, 'GST: the click fills the form (amount ' + before + ' → ' + st.amount + ', ' + st.mode + ')', JSON.stringify(st));
  check(st.hash === shown.href, 'GST: the address now carries the figures in its fragment', st.hash);
  check(st.top > -40 && st.top < 300, 'GST: the page scrolled to the tool', st.top);
  const rp = res.find((r) => r.primary) || {};
  const sameMore = more.every((m) => res.some((r) => r.label === m.label && r.value === m.value));
  check(rp.value === prim.value && sameMore, 'GST: the tool now shows the example\'s results (' + rp.value + ')', JSON.stringify(res.slice(0, 3)));
  await page.close();

  /* the same link, opened cold, fills the tool through render-core */
  const cold = await open(browser, url + shown.href);
  await sleep(400);
  const cres = await readResults(cold);
  const camount = await cold.$eval('.tool .tool-form [name="amount"]', (e) => e.value);
  check(camount === '11800' && cres.some((r) => r.label === more[0].label && r.value === more[0].value), 'GST: the same link opened in a new tab fills the tool too');
  await cold.close();
}

async function caseSlider(browser) {
  const url = '/ai-image/background-remover/';
  const ex = EX[url];
  check(!!ex && ex.slider, 'background remover: a before/after example with a slider is published');
  const page = await open(browser, url);
  /* the tool above mounts as the page loads and moves everything under it;
     what is measured here is what the lazy pictures do once scrolled to */
  await sleep(800);
  await page.evaluate(() => { window.__shift = 0; });
  await toView(page, '#see-example');
  await sleep(600);
  const st = await page.evaluate(() => {
    const f = document.querySelector('.proof-ba[data-proof-slider]');
    if (!f) return null;
    const imgs = [...f.querySelectorAll('img')];
    return {
      live: f.classList.contains('is-live'),
      clip: getComputedStyle(f.querySelector('.proof-after')).clipPath,
      lazy: imgs.every((i) => i.loading === 'lazy'),
      sized: imgs.every((i) => i.getAttribute('width') && i.getAttribute('height')),
      loaded: imgs.every((i) => i.complete && i.naturalWidth > 0),
      alt: imgs.map((i) => i.alt),
      credit: (document.querySelector('#see-example .proof-credit') || {}).textContent || ''
    };
  });
  check(!!st && st.live, 'background remover: the comparison is live (assets/proof.js ran)');
  if (!st) { await page.close(); return; }
  check(st.lazy && st.sized && st.loaded, 'background remover: lazy WebP with width and height, loaded');
  check(st.alt.every((a) => a.indexOf(ex.caption) > 0), 'background remover: alt text from the caption', st.alt.join(' | '));
  check(/free stock photo \(CC0\)/.test(st.credit), 'background remover: the CC0 credit line', st.credit);
  await page.evaluate(() => {
    const r = document.querySelector('.proof-range');
    r.value = '20';
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const clip2 = await page.$eval('.proof-after', (e) => getComputedStyle(e).clipPath);
  check(st.clip !== clip2 && /20%/.test(clip2), 'background remover: the range input moves the clip (' + st.clip + ' → ' + clip2 + ')');
  /* by keyboard too */
  await page.focus('.proof-range');
  await page.keyboard.press('ArrowRight');
  const clip3 = await page.$eval('.proof-after', (e) => getComputedStyle(e).clipPath);
  check(clip3 !== clip2, 'background remover: the arrow keys move it as well', clip3);
  const shift = await page.evaluate(() => window.__shift);
  check(shift < 0.01, 'background remover: no layout shift as the pictures load (CLS ' + shift.toFixed(3) + ')');
  await page.close();

  const nojs = await open(browser, url, { noJs: true });
  const side = await nojs.evaluate(() => {
    const f = document.querySelector('.proof-ba');
    const s = f.querySelectorAll('.proof-side');
    const a = s[0].getBoundingClientRect(), b = s[1].getBoundingClientRect();
    return { two: s.length === 2, sideBySide: Math.abs(a.top - b.top) < 2 && b.left > a.right - 1, range: getComputedStyle(f.querySelector('.proof-range')).display };
  });
  check(side.two && side.sideBySide && side.range === 'none', 'background remover: without JS the two pictures sit side by side', JSON.stringify(side));
  await nojs.close();
}

async function caseText(browser) {
  const url = '/developer/case-converter/';
  const ex = EX[url];
  check(!!ex && ex.kind === 'text', 'case converter: a text example is published');
  const page = await open(browser, url);
  await toView(page, '#see-example');
  const shownIn = await page.$eval('#see-example .proof-pane pre', (e) => e.textContent);
  check(shownIn === ex.input, 'case converter: the panel shows the captured input');
  await page.click('#see-example a.proof-try');
  await sleep(800);
  const st = await page.evaluate(() => ({
    ta: document.querySelector('.tool-io textarea.code-area').value,
    out: document.querySelector('.tool-io pre.code-out').textContent,
    hash: location.hash
  }));
  check(st.ta === ex.input, '"Try it" puts the example input in the box');
  check(st.out.trim() === ex.output.trim(), 'and the tool\'s output matches the captured output', st.out.slice(0, 80));
  check(/^#text=/.test(st.hash), 'and the fragment carries the text', st.hash.slice(0, 40));
  await page.close();
}

async function caseSchematic(browser) {
  const url = '/ai/invoice-extractor/';
  check(!EX[url] && !!ST[url], 'invoice extractor: a story but no published example (schematic)');
  const page = await open(browser, url);
  const st = await page.evaluate(() => ({
    ex: !!document.querySelector('#see-example'),
    why: !!document.querySelector('.proof-why'),
    pills: [...document.querySelectorAll('.proof-pills li')].map((l) => l.textContent),
    script: !!document.querySelector('script[src="/assets/proof.js"]')
  }));
  check(!st.ex && st.why, 'schematic tool: no Example panel, a "Why people use it" panel');
  check(JSON.stringify(st.pills) === JSON.stringify(ST[url].proof), 'schematic tool: its pills are the story\'s, nothing added', st.pills.join(' | '));
  check(!st.script, 'schematic tool: proof.js is not loaded where nothing needs it');
  await page.close();

  /* a page with its own "How it works" gets no second set of steps */
  const own = await open(browser, '/ai-image/sky-replacement/');
  const o = await own.evaluate(() => ({ how: [...document.querySelectorAll('.panel h2')].filter((h) => /How it works/.test(h.textContent)).length, steps: document.querySelectorAll('.proof-steps').length }));
  check(o.how === 1 && o.steps === 0, 'a page with its own "How it works" gets no duplicate steps', JSON.stringify(o));
  await own.close();
}

async function caseHubs(browser) {
  for (const url of ['/ai-image/', '/image/', '/pdf/', '/for/online-sellers/']) {
    const page = await open(browser, url);
    await toView(page, '.grid');
    const cards = await page.$$eval('a.card', (as) => as.map((a) => {
      const t = a.querySelector('.card-thumb');
      return { href: a.getAttribute('href'), thumb: !!t, w: t && t.getAttribute('width'), h: t && t.getAttribute('height'), lazy: t && t.loading, ar: t && getComputedStyle(t).aspectRatio, title: !!a.querySelector('strong') };
    }));
    const wrong = cards.filter((c) => c.thumb !== !!(EX[c.href] && EX[c.href].thumb));
    const bad = cards.filter((c) => c.thumb && (!c.w || !c.h || c.lazy !== 'lazy' || !/16 \/ 9/.test(c.ar) || !c.title));
    check(wrong.length === 0 && cards.some((c) => c.thumb), url + ': thumbnails on exactly the cards whose tool has one (' + cards.filter((c) => c.thumb).length + ' of ' + cards.length + ')', wrong.map((c) => c.href).join(', '));
    check(bad.length === 0, url + ': each thumbnail is lazy, sized, 16:9, and the card keeps its title', JSON.stringify(bad[0]));
    const ow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(ow <= 0, url + ': no horizontal overflow', ow);
    await page.close();
  }
}

async function caseHome(browser) {
  for (const width of [1366, 390]) {
    const page = await open(browser, '/', { width, height: width > 500 ? 900 : 844 });
    await toView(page, '.home-see');
    const st = await page.evaluate(() => {
      const s = document.querySelector('.home-see');
      if (!s) return null;
      const tiles = [...s.querySelectorAll('.see-tile')];
      const prev = s.previousElementSibling;
      return {
        n: tiles.length,
        hrefs: tiles.map((t) => t.getAttribute('href')),
        visible: tiles.every((t) => { const r = t.getBoundingClientRect(); return r.width > 120 && r.height > 120 && r.right <= document.documentElement.clientWidth + 1 && r.left >= 0; }),
        imgs: [...s.querySelectorAll('img')].every((i) => i.getAttribute('width') && i.getAttribute('height') && i.loading === 'lazy'),
        after: !!(prev && prev.classList.contains('home-aud')),
        /* The header's "MVR A–Z" pop-overs (assets/mvr-az.js) already stick
           out 48 px on a 390 px home page before this layer; they are set
           aside so the measure is of the page this test is about. */
        overflow: (() => {
          const pops = [...document.querySelectorAll('.mvraz-pop')];
          pops.forEach((p) => { p.dataset.d = p.style.display; p.style.display = 'none'; });
          const o = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          pops.forEach((p) => { p.style.display = p.dataset.d; });
          return o;
        })(),
        strip: s.scrollWidth - s.clientWidth,
        cols: getComputedStyle(s.querySelector('.see-grid')).gridTemplateColumns.split(' ').length
      };
    });
    check(!!st && st.n === 8, 'home ' + width + ': the "See it work" strip has 8 tiles', st && st.n);
    if (!st) { await page.close(); continue; }
    check(st.visible && st.overflow <= 0 && st.strip <= 0, 'home ' + width + ': every tile fits, no horizontal overflow (' + st.cols + ' columns)', JSON.stringify({ o: st.overflow, s: st.strip, v: st.visible }));
    check(st.imgs, 'home ' + width + ': tile pictures are lazy and sized');
    check(st.after, 'home ' + width + ': the strip comes straight after "I am a…"');
    if (width === 1366) {
      const want = ['/ai-image/background-remover/', '/ai-image/sky-replacement/', '/ai-image/object-remover/', '/ai-video/auto-captions/',
        '/image/image-compressor/', '/pdf/merge-pdf/', '/pdf/invoice-pdf/', '/india/gst-calculator/'];
      check(JSON.stringify(st.hrefs) === JSON.stringify(want), 'home: each tile links to its tool', st.hrefs.join(', '));
      const comp = await page.$eval('.see-tile[href="/image/image-compressor/"] .see-line', (e) => e.textContent);
      const ex = EX['/image/image-compressor/'];
      const o = ex.stats.find((s) => s[0] === 'Original total')[1], r = ex.stats.find((s) => s[0] === 'Result total')[1];
      check(comp.indexOf(o) === 0 && comp.indexOf(r) > 0, 'home: the compressor tile states its real figures (' + comp + ')');
      const gst = await page.$eval('.see-tile[href="/india/gst-calculator/"] .see-ro-big', (e) => e.textContent);
      check(gst === EX['/india/gst-calculator/'].results.find((x) => x.label === 'Taxable value').value, 'home: the GST tile shows the captured taxable value (' + gst + ')');
    }
    await page.close();
  }
}

async function caseMaskEmbed(browser) {
  const page = await open(browser, '/india/gst-calculator/');
  const unmasked = await page.evaluate((MASK) => [...document.querySelectorAll('.proof-in, .proof-out, .proof-pane, .proof-facts .proof-fields, .proof-stats, .see-readout')]
    .filter((n) => !n.matches(MASK) && !n.closest(MASK)).length, MASK);
  check(unmasked === 0, 'every example text container is under the analytics MASK', unmasked);
  await page.close();
  const emb = await open(browser, '/india/gst-calculator/?embed=1');
  const vis = await emb.evaluate(() => [...document.querySelectorAll('.proof, .proof-pills')].filter((e) => getComputedStyle(e).display !== 'none').length);
  check(vis === 0, 'embed mode hides the pills and the panels', vis);
  await emb.close();
}

async function screenshots(browser) {
  const shots = [['calc', '/india/gst-calculator/', '#see-example'], ['calc-top', '/india/gst-calculator/', 'h1'], ['media', '/ai-image/background-remover/', '#see-example'],
    ['pdf', '/pdf/merge-pdf/', '#see-example'], ['doc', '/pdf/invoice-pdf/', '#see-example'], ['text', '/developer/case-converter/', '#see-example'],
    ['why', '/ai/invoice-extractor/', '.proof-why'], ['hub', '/ai-image/', '.grid'], ['collection', '/for/online-sellers/', '.grid'], ['home', '/', '.home-see']];
  let n = 0;
  for (const theme of ['dark', 'light']) {
    for (const width of [1366, 390]) {
      for (const [name, url, sel] of shots) {
        const page = await open(browser, url, { width, height: width > 500 ? 900 : 844, theme });
        await toView(page, sel);
        await page.screenshot({ path: path.join(OUT, name + '-' + width + '-' + theme + '.png') });
        n++;
        await page.close();
      }
    }
  }
  check(n === 40, 'screenshots written to ' + OUT + ' (' + n + ')');
}

(async () => {
  staticChecks();
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  try {
    await caseGst(browser);
    await caseSlider(browser);
    await caseText(browser);
    await caseSchematic(browser);
    await caseHubs(browser);
    await caseHome(browser);
    await caseMaskEmbed(browser);
    await screenshots(browser);
  } finally {
    await browser.close();
    if (server) server.close();
  }
  check(external.length === 0, 'no request left 127.0.0.1 (' + external.length + '; the /ai/ account SDK refused ' + sdk + ' times)', [...new Set(external)].slice(0, 5).join(' '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 2 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
