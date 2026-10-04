/**
 * The share bar, the embed mode and the preview cards, in headless Chrome
 * against a static server.
 *
 *   node build/tests/share.js [--port 8713] [--root <site>] [--out <dir>]
 *
 * --root defaults to the site this file sits in and is served on --port by
 * build/tests/serve.js (a server already on that port is used instead).
 * --out defaults to a folder in the OS temp dir. Exit code 2 when a case
 * fails, 1 when the run itself breaks.
 *
 * What it proves:
 *   static  one row and one head block on every tool page with an anchor,
 *           none on /learn/ or on a stub; build-share.js --check twice says
 *           0; analytics.js has the embed early-return and the page_location
 *           filter; app.css has the D1-share block
 *   1  calculator: the bar, the figures toggle (off, then shown once changed),
 *      the WhatsApp link with the figures after the # and the UTMs before it,
 *      the link reproducing the answer, Copy link, the GA4 event, the QR
 *      popover (lazy engine, Escape, focus), the embed code, the 1080 card,
 *      and unticking taking the figures out again
 *   2  the native share sheet first, where there is one
 *   3  converter: v/from/to in the fragment and in the query, and junk ignored
 *   4  currency: amount/from/to
 *   5  text tool: ?text= and #text=, the 300-character limit
 *   6  PDF and 7 AI image: the tool alone, nothing about the visitor's input
 *   8  QR generator: its own "Copy share link" untouched, the content travels
 *   9  a collection page: channels only
 *   10 ?embed=1: the shell gone, a credit, no consent banner, the tool working
 *   11 og:image, its size and type, twitter:image, per kind of page
 *   12 every node showing the figure is under the analytics MASK
 *   13 screenshots at 1400 and 390, light and dark
 *   14 GA4's page_location keeps only utm_* and src (gtm requests aborted)
 *   and, through all of it, not one request to anything but 127.0.0.1.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8713));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-share')));
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
  '.io-pane', '.io-msg', '.pdf-file-name', '.page-grid', '.stat-val'].join(',');

const SECTIONS = ['finance', 'mathematics', 'engineering', 'health', 'design', 'utilities', 'time', 'developer', 'qr',
  'business', 'india', 'image', 'text', 'pdf', 'education', 'ai', 'ai-image', 'ai-video', 'conversions'];

/* ---------- static ---------- */

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'build') continue;
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, out);
    else if (name === 'index.html') out.push(abs);
  }
  return out;
}

function staticChecks() {
  let tools = 0, bad = [], learnBad = [], stubBad = [];
  for (const abs of walk(ROOT, [])) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const html = fs.readFileSync(abs, 'utf8');
    const rows = (html.match(/<!-- SHARE: /g) || []).length;
    const heads = (html.match(/<!-- SHARE-HEAD/g) || []).length;
    const stub = /name="robots" content="noindex/.test(html) && /http-equiv="refresh"/.test(html);
    if (stub) { if (rows || heads) stubBad.push(rel); continue; }
    if (rel.startsWith('learn/')) { if (rows || heads) learnBad.push(rel); continue; }
    if (!SECTIONS.includes(rel.split('/')[0])) continue;
    if (!/<article class="tool/.test(html)) continue;
    if (!/<div class="calc">/.test(html) && !/<div class="tool-io"/.test(html)) continue;
    tools++;
    if (rows !== 1 || heads !== 1) bad.push(rel + ' rows=' + rows + ' heads=' + heads);
  }
  check(tools >= 1281 && bad.length === 0, 'every tool page with an anchor has exactly one row and one head block (' + tools + ' pages)', bad.slice(0, 5).join(', '));
  check(learnBad.length === 0, '/learn/ pages carry no share row', learnBad.slice(0, 5).join(', '));
  check(stubBad.length === 0, 'redirect stubs carry no share row', stubBad.slice(0, 5).join(', '));

  for (let i = 1; i <= 2; i++) {
    let out = '';
    try { out = cp.execFileSync(process.execPath, ['build-share.js', '--check'], { cwd: ROOT, encoding: 'utf8' }); }
    catch (e) { out = String(e.stdout || e.message); }
    check(/\b0 file\(s\) would change/.test(out), 'build-share.js --check run ' + i + ': 0 file(s) would change', out.trim().split('\n').pop());
  }
  const an = fs.readFileSync(path.join(ROOT, 'assets/analytics.js'), 'utf8');
  check(an.indexOf("if (/[?&]embed=1(?:&|$)/.test(location.search)) return;") > 0, 'analytics.js returns early in embed mode');
  check(/page_location: loc/.test(an) && /\^utm_/.test(an), 'analytics.js gives GA4 a page_location with only utm_* and src kept');
  const css = fs.readFileSync(path.join(ROOT, 'assets/app.css'), 'utf8');
  check(css.indexOf('/* ==== D1-share') >= 0 && css.indexOf('/* ==== /D1-share') >= 0, 'app.css carries the D1-share block');
}

/* ---------- browser ---------- */

const external = [];
const requested = [];
function watch(p, allow) {
  p.on('request', (r) => {
    const u = r.url();
    requested.push(u);
    if (/^(data|about|blob|chrome-error):/.test(u) || u.indexOf(BASE + '/') === 0) return;
    if (allow && allow(u)) return;
    external.push(u);
  });
  p.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  p.on('console', (m) => { if (/error/i.test(m.type()) && !/Failed to load resource/.test(m.text())) console.log('  [console]', m.text().slice(0, 200)); });
}

/* Stubs that run before any page script. withShare: a phone-like share
   sheet; otherwise the share sheet is removed so the bar is the desktop one
   whatever the host Chrome supports. */
function STUBS(ws) {
  {
    window.__gtagCalls = [];
    window.gtag = function () { window.__gtagCalls.push(Array.prototype.slice.call(arguments)); };
    window.__copied = null;
    const clip = { writeText: (t) => { window.__copied = t; return Promise.resolve(); } };
    try { Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => clip }); } catch (e) {}
    if (ws) {
      Object.defineProperty(Navigator.prototype, 'share', { configurable: true, writable: true, value: async (d) => { window.__shared = d; } });
      Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, writable: true, value: () => true });
    } else {
      try { Object.defineProperty(Navigator.prototype, 'share', { configurable: true, writable: true, value: undefined }); } catch (e) {}
      try { Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, writable: true, value: undefined }); } catch (e) {}
    }
    window.__results = [];
    document.addEventListener('mvr:result', (e) => window.__results.push(e.detail));
    try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) {}
  }
}
const stubs = (withShare) => [STUBS, !!withShare];

const local = (u) => u.replace(/^https:\/\/www\.1234tools\.com/, BASE);

async function open(browser, url, withShare, ctx) {
  const page = await (ctx || browser).newPage();
  watch(page);
  await page.evaluateOnNewDocument(...stubs(withShare));
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto(BASE + url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('[data-share]:not([hidden])', { timeout: 15000 }).catch(() => {});
  return page;
}

/* Clear the field the way a visitor would (select all, delete), then type. */
async function setValue(page, sel, text) {
  await page.focus(sel);
  await page.evaluate((s) => { const e = document.querySelector(s); if (e.select) e.select(); }, sel);
  await page.keyboard.press('Backspace');
  if (text) await page.type(sel, text);
}

/* A real click on a share button, after checking nothing covers it. */
async function press(page, sel) {
  const covered = await page.evaluate((s) => {
    const b = document.querySelector(s);
    /* instantly: the site scrolls smoothly, and a click sent mid-scroll
       lands wherever the button was a frame ago (the install bar, often) */
    document.documentElement.style.scrollBehavior = 'auto';
    b.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = b.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top && (top === b || b.contains(top)) ? null : (top ? top.outerHTML.slice(0, 160) : 'nothing');
  }, sel);
  if (covered) console.log('  note: ' + sel + ' is covered by ' + covered);
  await page.click(sel);
}

const hrefOf = (page, ch) => page.$eval('[data-share] [data-ch="' + ch + '"]', (a) => a.href);
/* The page URL carried by an intent link. */
function innerUrl(ch, href) {
  const u = new URL(href);
  if (ch === 'whatsapp') return u.searchParams.get('text').split('\n').pop();
  if (ch === 'facebook') return u.searchParams.get('u');
  if (ch === 'email') return decodeURIComponent(href.split('body=')[1]).split('\n').pop();
  return u.searchParams.get('url');
}
const toggleState = (page) => page.evaluate(() => {
  const t = document.getElementById('share-figures');
  if (!t) return null;
  const l = t.closest('label');
  return { hidden: l.hidden, text: l.textContent.trim(), checked: t.checked };
});

async function case1(browser) {
  console.log('\n1. calculator /finance/compound-interest/');
  const page = await open(browser, '/finance/compound-interest/');
  await page.waitForSelector('.result-primary .result-value');
  const first = await page.evaluate(() => ({
    shown: !!document.querySelector('.share[data-share]:not([hidden])'),
    btns: document.querySelectorAll('.share .share-btn').length,
    native: !!document.querySelector('.share-native'),
    results: window.__results.length,
    afterCalc: !!document.querySelector('.calc + .share, .calc ~ .share')
  }));
  const t0 = await toggleState(page);
  check(first.shown && first.btns >= 10, 'the bar is shown with ' + first.btns + ' buttons', JSON.stringify(first));
  check(first.afterCalc, 'the bar sits after the calculator');
  check(t0 && t0.hidden && !t0.checked, 'the figures toggle is hidden and unticked on load', JSON.stringify(t0));
  check(!first.native, 'no Share… button without a share sheet');
  check(first.results >= 1, 'the calculator announced its result (' + first.results + ')');

  await setValue(page, '#in-principal', '5000');
  await sleep(150);
  const last = await page.evaluate(() => window.__results[window.__results.length - 1]);
  check(last && last.changed === true && last.params.principal === '5000' && last.kind === 'calc', 'typing announces changed state with principal=5000', JSON.stringify(last));
  const t1 = await toggleState(page);
  check(t1 && !t1.hidden && /Include my figures/.test(t1.text) && !t1.checked, 'the toggle appears, "Include my figures", still unticked', JSON.stringify(t1));
  const plainWa = await hrefOf(page, 'whatsapp');
  check(!/principal/.test(decodeURIComponent(plainWa)), 'before ticking, no figure is in any link');

  await page.click('#share-figures');
  await sleep(100);
  const wa = await hrefOf(page, 'whatsapp');
  const text = new URL(wa).searchParams.get('text');
  const inner = innerUrl('whatsapp', wa);
  const iu = new URL(inner);
  check(/Final Balance:/.test(text), 'WhatsApp text carries the result line', text);
  check(iu.hash.indexOf('principal=5000') >= 0 && !iu.searchParams.has('principal'), 'the figures ride after the #, not in the query', inner);
  check(iu.searchParams.get('utm_source') === 'whatsapp' && iu.searchParams.get('utm_medium') === 'share' &&
    iu.searchParams.get('utm_campaign') === 'finance' && iu.searchParams.get('utm_content') === 'compound-interest', 'UTMs: whatsapp / share / finance / compound-interest', inner);
  check(inner.indexOf('utm_source') < inner.indexOf('#principal') || inner.indexOf('#') > inner.indexOf('utm_content'), 'the query (UTMs) comes before the fragment (figures)');
  const resultLine = await page.$eval('.share-result', (e) => ({ hidden: e.hidden, text: e.textContent }));
  check(!resultLine.hidden && /Sharing: Final Balance/.test(resultLine.text), 'the bar says what is being shared', JSON.stringify(resultLine));
  const A = await page.$eval('.result-primary .result-value', (e) => e.textContent);

  /* the link reproduces the answer */
  const p2 = await open(browser, local(inner).replace(BASE, ''));
  await p2.waitForSelector('.result-primary .result-value');
  const got = await p2.evaluate(() => ({
    value: document.querySelector('.result-primary .result-value').textContent,
    principal: document.getElementById('in-principal').value,
    first: window.__results[0],
    toggle: !document.getElementById('share-figures').closest('label').hidden
  }));
  check(got.value === A && got.principal === '5000', 'the shared link opens on the same answer (' + A + ')', JSON.stringify(got));
  check(got.first && got.first.changed === true && got.toggle, 'a figure from the link counts as changed: toggle shown without typing');
  await p2.close();

  /* copy */
  await press(page, '[data-share] [data-ch="copy"]');
  await sleep(150);
  const copy = await page.evaluate(() => ({ copied: window.__copied, want: window.MVRShare.url('copy', true), status: document.querySelector('.share-status').textContent, calls: window.__gtagCalls }));
  check(copy.copied === copy.want && /utm_source=copy/.test(copy.copied) && /#.*principal=5000/.test(copy.copied), 'Copy link copies the utm_source=copy URL with the figures', copy.copied);
  check(/Link copied/.test(copy.status), 'status says Link copied');
  const ev = copy.calls.find((c) => c[0] === 'event' && c[1] === 'share' && c[2].method === 'copy');
  check(ev && ev[2].content_type === 'tool' && ev[2].item_id === 'finance/compound-interest' && ev[2].with_figures === 1, 'GA4 share event: copy / tool / finance/compound-interest / with_figures 1', JSON.stringify(ev));

  /* QR */
  const before = requested.filter((u) => /qr\.bundle\.js/.test(u)).length;
  await press(page, '[data-share] [data-ch="qr"]');
  await page.waitForSelector('.share-qr-result svg', { timeout: 10000 }).catch(() => {});
  const qr = await page.evaluate(() => {
    const pop = document.getElementById('share-pop');
    return { svg: !!document.querySelector('.share-qr-result svg'), visible: !pop.hidden, role: pop.getAttribute('role'), label: pop.getAttribute('aria-label'),
      expanded: document.querySelector('[data-ch="qr"]').getAttribute('aria-expanded'), url: (document.querySelector('.share-url') || {}).textContent || '',
      dl: !!document.querySelector('.share-pop a[download$="-link.svg"]') };
  });
  check(requested.filter((u) => /\/engine\/qr\.bundle\.js/.test(u)).length > before, 'the QR engine is fetched from this site on the first click');
  check(qr.svg && qr.visible && qr.role === 'dialog' && qr.expanded === 'true' && qr.dl, 'QR popover: an SVG code, role=dialog, aria-expanded, Download SVG', JSON.stringify(qr));
  check(/utm_source=qr/.test(qr.url), 'the QR encodes the utm_source=qr link', qr.url);
  await page.keyboard.press('Escape');
  const esc = await page.evaluate(() => ({ hidden: document.getElementById('share-pop').hidden, focus: document.activeElement && document.activeElement.getAttribute('data-ch') }));
  check(esc.hidden && esc.focus === 'qr', 'Escape closes the popover and focus returns to QR', JSON.stringify(esc));

  /* embed */
  await press(page, '[data-share] [data-ch="embed"]');
  const code = await page.$eval('.share-embed-result', (t) => t.value);
  check(/<iframe/.test(code) && /embed=1/.test(code) && /principal=5000/.test(code) && /utm_source=embed/.test(code) &&
    /<p [^>]*><a href="https:\/\/www\.1234tools\.com\/finance\/compound-interest\/">/.test(code), 'embed code: iframe with embed=1, figures, utm_source=embed, and a backlink', code);
  await page.click('.share-close');

  /* result card */
  const card = await page.evaluate(async () => {
    const blob = await window.MVRShare.card();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
    const px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data);
    let dark = 0;
    const d = x.getImageData(824, 824, 184, 184).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 60) dark++;
    const png = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
    return { type: blob.type, w: bmp.width, h: bmp.height, tile: px(832, 832), bg: px(540, 1060), dark, png };
  });
  fs.writeFileSync(path.join(OUT, 'result-card.png'), Buffer.from(card.png.split(',')[1], 'base64'));
  delete card.png;
  check(card.type === 'image/png' && card.w === 1080 && card.h === 1080, 'result card: a 1080 x 1080 PNG', JSON.stringify(card));
  check(card.tile.slice(0, 3).every((v) => v > 235) && card.dark > 2000, 'the card has a white QR tile with a code in it (bottom right)', JSON.stringify(card));
  fs.writeFileSync(path.join(OUT, 'card-check.json'), JSON.stringify(card));

  /* masking, with the toggle on */
  const masked = await page.evaluate((MASK, A) => {
    const bad = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeValue.indexOf(A) < 0) continue;
      const elx = n.parentElement;
      if (!elx.closest(MASK)) bad.push(elx.outerHTML.slice(0, 120));
    }
    for (const a of document.querySelectorAll('.share a[href]')) { /* hrefs are attributes, not text: noted, not masked */ }
    return bad;
  }, MASK, A);
  check(masked.length === 0, 'every node showing the figure is under the analytics MASK', masked.join(' | '));

  /* untick */
  await page.click('#share-figures');
  await sleep(100);
  const wa2 = await hrefOf(page, 'whatsapp');
  const t2 = new URL(wa2).searchParams.get('text');
  const desc = await page.$eval('meta[name="description"]', (m) => m.content);
  check(!/principal=/.test(decodeURIComponent(wa2)) && t2.indexOf(desc.slice(0, 40)) >= 0, 'unticking: no figures, the text is the description again', t2);
  return page;
}

async function case2(ctx) {
  console.log('\n2. native share sheet');
  const page = await ctx.newPage();
  watch(page);
  await page.evaluateOnNewDocument(...stubs(true));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(BASE + '/finance/compound-interest/', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('.share-native');
  const firstIsNative = await page.$eval('.share .share-btn', (b) => b.classList.contains('share-native'));
  check(firstIsNative, 'Share… is the first button');
  await page.click('.share-native');
  await sleep(150);
  const shared = await page.evaluate(() => window.__shared);
  check(shared && /utm_source=native/.test(shared.url) && shared.title === 'Compound Interest Calculator', 'navigator.share gets the utm_source=native link and the title', JSON.stringify(shared));
  await page.screenshot({ path: path.join(OUT, 'native-390.png') });
  const coll = await ctx.newPage();
  watch(coll);
  await coll.evaluateOnNewDocument(...stubs(true));
  await coll.goto(BASE + '/for/accountants/', { waitUntil: 'networkidle0', timeout: 60000 });
  await coll.waitForSelector('.share-native');
  const n = await coll.$$eval('.share .share-btn', (b) => b.length);
  check(n === 10, 'collection page with a share sheet: Share… + 8 channels + QR (' + n + ')');
  await coll.close();
  await page.close();
}

async function case3(browser) {
  console.log('\n3. converter /conversions/length/kilometer-to-mile/');
  const page = await open(browser, '/conversions/length/kilometer-to-mile/');
  await page.waitForSelector('.result-primary');
  await setValue(page, '#u-value', '5');
  const third = await page.$eval('select[name="to"]', (s) => s.options[2].value);
  await page.select('select[name="to"]', third);
  await sleep(100);
  await page.click('#share-figures');
  const sel = await page.evaluate(() => ({ f: document.querySelector('select[name="from"]').value, t: document.querySelector('select[name="to"]').value, v: document.querySelector('.result-primary').textContent }));
  const inner = innerUrl('whatsapp', await hrefOf(page, 'whatsapp'));
  check(inner.indexOf('#v=5&from=' + encodeURIComponent(sel.f) + '&to=' + encodeURIComponent(sel.t)) > 0, 'link carries #v=5&from=' + sel.f + '&to=' + sel.t, inner);
  const p2 = await open(browser, local(inner).replace(BASE, ''));
  await p2.waitForSelector('.result-primary');
  const got = await p2.evaluate(() => ({ f: document.querySelector('select[name="from"]').value, t: document.querySelector('select[name="to"]').value, v: document.querySelector('.result-primary').textContent }));
  check(got.f === sel.f && got.t === sel.t && got.v === sel.v, 'the link opens on the same units and answer', JSON.stringify([sel, got]));
  await p2.goto(BASE + '/conversions/length/kilometer-to-mile/?v=3&from=' + sel.t + '&to=' + sel.f, { waitUntil: 'networkidle0' });
  const sw = await p2.evaluate(() => ({ f: document.querySelector('select[name="from"]').value, t: document.querySelector('select[name="to"]').value, v: document.getElementById('u-value').value }));
  check(sw.f === sel.t && sw.t === sel.f && sw.v === '3', '?v=3&from=&to= in the query is honoured (the finder hand-off still works)', JSON.stringify(sw));
  await p2.goto(BASE + '/conversions/length/kilometer-to-mile/?from=nonsense#to=alsonot', { waitUntil: 'networkidle0' });
  const junk = await p2.evaluate(() => ({ f: document.querySelector('select[name="from"]').value, t: document.querySelector('select[name="to"]').value }));
  check(junk.f === 'km' && junk.t === 'mi', 'unknown units keep the page preset km → mi', JSON.stringify(junk));
  await p2.close();
  await page.close();
}

async function case4(browser) {
  console.log('\n4. currency /business/currency-converter/');
  const page = await open(browser, '/business/currency-converter/');
  await page.waitForSelector('.result-primary', { timeout: 15000 });
  await setValue(page, '#fx-amount', '250');
  await sleep(100);
  await page.click('#share-figures');
  const inner = innerUrl('whatsapp', await hrefOf(page, 'whatsapp'));
  const text = new URL(await hrefOf(page, 'whatsapp')).searchParams.get('text');
  check(inner.indexOf('#amount=250&from=GBP&to=USD') > 0, 'link carries #amount=250&from=GBP&to=USD', inner);
  check(/=.*(USD|\$)/.test(text), 'the summary names the converted amount', text);
  const p2 = await open(browser, local(inner).replace(BASE, ''));
  await p2.waitForSelector('.result-primary', { timeout: 15000 });
  const amt = await p2.$eval('#fx-amount', (i) => i.value);
  check(amt === '250', 'the link opens on 250');
  await p2.close();
  await page.close();
}

async function case5(browser) {
  console.log('\n5. text tool /text/word-counter/');
  const page = await open(browser, '/text/word-counter/?text=hello%20world');
  const t = await toggleState(page);
  const last = await page.evaluate(() => window.__results[window.__results.length - 1]);
  check(t && !t.hidden && /Include my text/.test(t.text), 'toggle shown on load from ?text=, "Include my text"', JSON.stringify(t));
  check(last && last.params.text === 'hello world' && last.summary === null, 'announces params.text, no summary', JSON.stringify(last));
  await setValue(page, '.code-area', 'x'.repeat(320));
  const long = await toggleState(page);
  check(long.hidden, 'over 300 characters the toggle hides');
  await setValue(page, '.code-area', 'short text');
  const back = await toggleState(page);
  check(!back.hidden, 'short text again: the toggle is back');
  await page.close();
  const p2 = await open(browser, '/text/word-counter/#text=hi%20there');
  const v = await p2.$eval('.code-area', (t) => t.value);
  check(v === 'hi there', 'the word counter reads #text= from the fragment', v);
  await p2.close();
}

async function toolOnly(browser, url, label) {
  const page = await open(browser, url);
  await sleep(300);
  const info = await page.evaluate(() => {
    const s = document.querySelector('[data-share]');
    const panel = document.querySelector('.tool > .panel');
    return {
      shown: s && !s.hidden, fig: !!document.getElementById('share-figures'),
      embed: !!document.querySelector('[data-share] [data-ch="embed"]'), card: !!document.querySelector('[data-share] [data-ch="card"]'),
      results: window.__results.length, beforePanel: !!(panel && (s.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING))
    };
  });
  check(info.shown && !info.fig && !info.embed && !info.card, label + ': row present, no toggle, no embed, no card', JSON.stringify(info));
  check(info.results === 0, label + ': the tool announces nothing');
  const bad = [];
  for (const ch of ['whatsapp', 'telegram', 'x', 'facebook', 'linkedin', 'reddit', 'email']) {
    const u = new URL(innerUrl(ch, await hrefOf(page, ch)));
    const keys = Array.from(u.searchParams.keys());
    if (u.hash || keys.some((k) => !/^utm_/.test(k)) || keys.length !== 4) bad.push(ch + ':' + u.href);
  }
  check(bad.length === 0, label + ': every channel link carries only the four utm_* parameters', bad.join(' '));
  return { page, info };
}

async function case67(browser) {
  console.log('\n6. PDF /pdf/merge-pdf/');
  (await toolOnly(browser, '/pdf/merge-pdf/', 'merge-pdf')).page.close();
  console.log('\n7. AI image /ai-image/background-remover/');
  const r = await toolOnly(browser, '/ai-image/background-remover/', 'background-remover');
  check(r.info.beforePanel, 'background-remover: the row sits before the first panel');
  await r.page.close();
}

async function case8(browser) {
  console.log('\n8. QR generator /qr/qr-code-generator/');
  const page = await open(browser, '/qr/qr-code-generator/');
  await page.waitForSelector('.qr-box svg', { timeout: 15000 });
  const own = await page.evaluate(() => Array.from(document.querySelectorAll('.qr-actions button')).some((b) => /Copy share link/.test(b.textContent)));
  check(own, 'the generator\u2019s own "Copy share link" is still there');
  await setValue(page, '#f-url', 'https://example.org/menu');
  await sleep(400);
  const t = await toggleState(page);
  check(t && !t.hidden && /Include this code.s content/.test(t.text), 'toggle: "Include this code\u2019s content"', JSON.stringify(t));
  await page.click('#share-figures');
  const inner = innerUrl('whatsapp', await hrefOf(page, 'whatsapp'));
  const h = new URLSearchParams(new URL(inner).hash.slice(1));
  check(h.get('t') === 'url' && h.get('v') === '1' && h.get('url') === 'https://example.org/menu', 'the link carries #t=url&url=…&v=1', inner);
  const p2 = await open(browser, local(inner).replace(BASE, ''));
  await p2.waitForSelector('.qr-box svg', { timeout: 15000 });
  const got = await p2.evaluate(() => ({ shared: document.documentElement.classList.contains('is-shared-view'), url: (document.getElementById('f-url') || {}).value }));
  check(got.shared && got.url === 'https://example.org/menu', 'the link opens the code in shared view with its content', JSON.stringify(got));
  await p2.close();
  await page.close();
}

async function case9(browser) {
  console.log('\n9. collection /for/accountants/');
  const page = await open(browser, '/for/accountants/');
  const info = await page.evaluate(() => {
    const s = document.querySelector('article.collection .share.share-page');
    return { ok: !!s, kind: s && s.getAttribute('data-share-kind'), btns: s ? s.querySelectorAll('.share-btn').length : 0,
      channels: s ? Array.from(s.querySelectorAll('.share-btn')).map((b) => b.getAttribute('data-ch')).join(',') : '',
      toggle: !!document.getElementById('share-figures'), label: s && s.getAttribute('aria-label') };
  });
  check(info.ok && info.kind === 'page' && !info.toggle && info.channels === 'whatsapp,telegram,x,facebook,linkedin,reddit,email,copy,qr', 'share-page row: 8 channels + QR, no toggle', JSON.stringify(info));
  const inner = new URL(innerUrl('whatsapp', await hrefOf(page, 'whatsapp')));
  check(inner.searchParams.get('utm_campaign') === 'for' && inner.searchParams.get('utm_content') === 'accountants', 'utm_campaign=for, utm_content=accountants', inner.href);
  await press(page, '[data-share] [data-ch="copy"]');
  await sleep(100);
  const ev = await page.evaluate(() => window.__gtagCalls.find((c) => c[1] === 'share'));
  check(ev && ev[2].content_type === 'page' && ev[2].with_figures === 0, 'GA4 share event content_type page', JSON.stringify(ev));
  await page.close();
}

async function case10(browser) {
  console.log('\n10. embed /finance/compound-interest/?embed=1');
  const page = await browser.newPage();
  watch(page);
  await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('1234tools-consent'); } catch (e) {} });
  await page.setViewport({ width: 720, height: 640 });
  await page.goto(BASE + '/finance/compound-interest/?embed=1&utm_source=embed', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('.result-primary');
  await sleep(300);
  const info = await page.evaluate(() => {
    const d = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).display : 'absent'; };
    const credit = document.querySelector('.embed-credit a[href*="utm_source=embed-credit"]');
    return { embed: document.documentElement.classList.contains('is-embed'),
      header: d('.site-header'), sidebar: d('.sidebar'), footer: d('.site-footer'), crumbs: d('.crumbs'), share: d('.share'),
      credit: !!credit && credit.getBoundingClientRect().height > 0, open: !!document.querySelector('.embed-credit a[href*="utm_source=embed-open"]'),
      cc: !!document.querySelector('.cc'), result: !!document.querySelector('.result-primary .result-value'), pwa: !!document.querySelector('.pwa-offer, .install-offer') };
  });
  check(info.embed, 'html.is-embed is set before the page renders');
  check(['header', 'sidebar', 'footer', 'crumbs', 'share'].every((k) => info[k] === 'none' || info[k] === 'absent'), 'header, sidebar, footer, crumbs and the share row are hidden', JSON.stringify(info));
  check(info.credit && info.open, 'a visible "Powered by 1234Tools" credit and an "Open the full tool" link');
  check(!info.cc, 'no consent banner inside the frame');
  check(info.result, 'the calculator works inside the frame');
  await page.screenshot({ path: path.join(OUT, 'embed-720.png'), fullPage: true });
  await page.close();
}

async function case11(browser) {
  console.log('\n11. og:image');
  const page = await browser.newPage();
  watch(page);
  for (const [url, type] of [['/finance/compound-interest/', 'image/jpeg'], ['/conversions/length/kilometer-to-mile/', 'image/jpeg'], ['/pdf/', 'image/jpeg'], ['/for/accountants/', 'image/png']]) {
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const m = await page.evaluate(() => {
      const g = (s) => { const e = document.querySelector(s); return e ? e.getAttribute('content') : null; };
      return { img: g('meta[property="og:image"]'), w: g('meta[property="og:image:width"]'), h: g('meta[property="og:image:height"]'),
        type: g('meta[property="og:image:type"]'), alt: g('meta[property="og:image:alt"]'), tw: g('meta[name="twitter:image"]') };
    });
    const res = await page.evaluate(async (u) => { const r = await fetch(u); const b = await r.arrayBuffer(); return { status: r.status, type: r.headers.get('content-type'), size: b.byteLength }; }, local(m.img));
    const fileOk = type === 'image/png' ? /og-image\.png$/.test(m.img) : /\/assets\/img\/og\//.test(m.img);
    check(fileOk && res.status === 200 && res.type === type && m.type === type && m.w === '1200' && m.h === '630' && m.tw === m.img && m.alt,
      url + ' → ' + m.img.replace('https://www.1234tools.com', '') + ' (' + (res.size / 1024).toFixed(1) + ' KB, ' + type + ')', JSON.stringify([m, res]));
    if (type === 'image/jpeg') check(res.size <= 80 * 1024, url + ' card is within 80 KB');
  }
  await page.close();
}

async function case13(browser) {
  console.log('\n13. screenshots');
  for (const theme of ['dark', 'light']) {
    for (const w of [1400, 390]) {
      const page = await browser.newPage();
      watch(page);
      await page.evaluateOnNewDocument(...stubs(false));
      await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('1234tools-theme', t); } catch (e) {} }, theme);
      await page.setViewport(w === 390 ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1400, height: 1000 });
      await page.goto(BASE + '/india/ctc-take-home/', { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForSelector('[data-share]:not([hidden])');
      await page.evaluate(() => { const i = document.querySelector('.tool-form input[type="number"]'); i.value = String(Number(i.value || 0) + 100000); i.dispatchEvent(new Event('input', { bubbles: true })); });
      await sleep(150);
      const vis = await page.evaluate(() => !document.getElementById('share-figures').closest('label').hidden);
      if (vis) await page.click('#share-figures');
      await page.evaluate(() => { const c = document.querySelector('.cc'); if (c) c.remove(); });
      const el = await page.$('[data-share]');
      const file = path.join(OUT, 'share-' + theme + '-' + w + '.png');
      await el.screenshot({ path: file });
      check(fs.existsSync(file), 'screenshot ' + path.basename(file));
      if (theme === 'dark' && w === 1400) {
        const warn = await page.evaluate(() => { const s = document.querySelector('.share-warn'); return s ? s.textContent : null; });
        check(vis && warn === 'This link will contain your pay figures', 'a pay tool warns that the link will contain pay figures', warn);
      }
      await page.close();
    }
  }
}

async function case14(browser) {
  console.log('\n14. GA4 page_location');
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const aborted = [];
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u.indexOf(BASE + '/') === 0 || /^(data|about|blob):/.test(u)) r.continue();
    else { aborted.push(u); r.abort(); }
  });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('1234tools-consent', 'granted'); } catch (e) {} });
  await page.goto(BASE + '/finance/compound-interest/?principal=5000&src=pwa&utm_source=x#rate=7', { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(300);
  const dl = await page.evaluate(() => (window.dataLayer || []).map((a) => Array.prototype.slice.call(a)));
  const cfg = dl.find((a) => a[0] === 'config');
  const want = BASE + '/finance/compound-interest/?src=pwa&utm_source=x';
  check(cfg && cfg[2] && cfg[2].page_location === want && cfg[2].anonymize_ip === true, 'GA4 config page_location keeps only src and utm_*: ' + (cfg && cfg[2] && cfg[2].page_location), JSON.stringify(cfg));
  check(aborted.every((u) => /googletagmanager\.com|clarity\.ms/.test(u)), 'with consent, only the GA4 and Clarity tags were requested (aborted here)', aborted.join(' '));
  await ctx.close();
}

(async () => {
  console.log('static');
  staticChecks();
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1400,1000'] });
  try {
    const p1 = await case1(browser);
    await p1.close();
    const ctx2 = await browser.createBrowserContext();
    await case2(ctx2);
    await ctx2.close();
    await case3(browser);
    await case4(browser);
    await case5(browser);
    await case67(browser);
    await case8(browser);
    await case9(browser);
    await case10(browser);
    await case11(browser);
    await case13(browser);
    await case14(browser);
  } catch (e) {
    console.error(e);
    fail++;
  } finally {
    await browser.close();
    if (server) server.close();
  }
  check(external.length === 0, 'no request left 127.0.0.1 (' + external.length + ')', external.slice(0, 5).join(' '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed. Screenshots in ' + OUT);
  process.exit(fail ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
