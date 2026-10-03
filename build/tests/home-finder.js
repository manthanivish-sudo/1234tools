/**
 * The home hero finder, the finder's modes, the header search and the home
 * page head, driven in headless Chrome against a static server.
 *
 *   node build/tests/home-finder.js --port 8711 --root E:/path/to/site [--out DIR]
 *
 * The server must already be serving --root on --port (any static server;
 * E:/tmp/1234-agents/harness/serve.js <root> <port> is one). --root defaults
 * to the site this file sits in (two levels up) and --out to a folder in the
 * OS temp dir. Exit code 2 when a case fails, 1 when the run itself breaks.
 *
 * What it proves:
 *   a. /utilities/tool-finder/: the 17 understand() cases, ?section=pdf keeps
 *      the answers under pdf/, and a scoped miss carries the site-wide answer
 *   b. /: the hero mounts the finder inline; a question answers under the box
 *      without navigating; a second question replaces the first; chips work;
 *      the "Open the full Tool Finder" link carries ?q=
 *   c. analytics: finder_answer fires through a stubbed window.gtag with kind,
 *      mode and section, and never with the typed words
 *   d. header search: several typed words are an AND of word-prefixes
 *   e. the home <title> carries the register total and is 70 chars or fewer;
 *      the descriptions carry it and are 160 or fewer
 *   f. the order of the blocks at the top of main, in the DOM and in the file
 *   g. screenshots of / at 1400 and 390 px, and of the inline answer in both themes
 *   and, through all of it, not one request to anything but 127.0.0.1.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8711));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-home-finder')));
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}
const puppeteer = loadPuppeteer();

const CASES = [
  ['remove the background from a product photo', 'image/background-remover/'],
  ['km to miles', 'conversions/length/kilometer-to-mile/'],
  ['5 lbs in kg', 'conversions/mass/pound-to-kilogram/'],
  ['celsius to fahrenheit', 'conversions/temperature/celsius-to-fahrenheit/'],
  ['merge two pdf files into one', 'pdf/merge-pdf/'],
  ['payslip for one employee', 'business/payroll-run/'],
  ['qr code for my wifi', 'qr/qr-code-generator/'],
  ['put text behind a person in a photo', 'ai-image/text-behind-image/'],
  ['gst on an invoice', 'india/gst-calculator/|business/einvoice-json/'],
  ['how many days until my exam', 'education/exam-countdown/'],
  ['shrink a jpeg so it emails', 'image/image-compressor/'],
  ['count the words in my essay', 'text/word-counter/'],
  ['monthly repayment on a home loan', 'india/emi-calculator/|finance/loan-payment/'],
  ['paslip for staf', 'business/payroll-run/'],
  ['read an invoice into a spreadsheet', 'ai/invoice-extractor/|ai/scanned-invoice-extractor/'],
  ['passport photo', 'image/passport-photo/'],
  ['make a 3d parallax video from a photo', 'ai-image/3d-photo-parallax/'],
  ['knitting pattern for a scarf', null]
];
/* header search: typed term -> the path the first result must have (null: no result, only the finder handoff) */
const SEARCH = [
  ['invoice extractor', 'ai/invoice-extractor/'],
  ['text behind', 'ai-image/text-behind-image/'],
  ['merge pdf', 'pdf/merge-pdf/'],
  ['km miles', 'conversions/length/kilometer-to-mile/'],
  ['payroll', 'business/payroll-run/'],
  ['xyzzy', null]
];

let pass = 0, fail = 0;
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (detail !== undefined && !ok ? '   (' + detail + ')' : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const registerTotal = () => {
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  return box.SEARCH_INDEX.length;
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1400,1000'] });
  const external = [];
  const page = await browser.newPage();
  const watch = (p) => {
    p.on('request', (r) => { const u = r.url(); if (!/^(data|about|blob|chrome-error):/.test(u) && u.indexOf(BASE + '/') !== 0) external.push('request ' + u); });
    p.on('response', (r) => { const u = r.url(); if (!/^(data|about|blob|chrome-error):/.test(u) && u.indexOf(BASE + '/') !== 0) external.push('response ' + u); });
    p.on('pageerror', (e) => console.log('  [pageerror]', e.message));
    p.on('console', (m) => { if (/error/i.test(m.type())) console.log('  [console]', m.text().slice(0, 200)); });
  };
  watch(page);
  /* a stub for the consent-gated analytics, and a remembered tool for the
     "pick up where you left off" strip; both run before any page script */
  await page.evaluateOnNewDocument(() => {
    window.__gtagCalls = [];
    window.gtag = function () { window.__gtagCalls.push(Array.prototype.slice.call(arguments)); };
    try { localStorage.setItem('1234tools-recent', JSON.stringify([{ u: 'pdf/merge-pdf/', t: 'Merge PDF Files' }, { u: 'text/word-counter/', t: 'Word & Character Counter' }])); } catch (e) {}
  });
  await page.setViewport({ width: 1400, height: 1000 });
  const noBanner = () => page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });

  /* ---------- a. the full page ---------- */
  await page.goto(BASE + '/utilities/tool-finder/', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.ToolFinder && window.ToolFinder.ready(), { timeout: 30000 });
  console.log('[' + stamp() + '] full page:', await page.title());
  for (const [q, want] of CASES) {
    const u = await page.evaluate((text) => {
      const r = window.ToolFinder.understand(text);
      return { kind: r.kind, top: r.hit ? r.hit.path : (r.results && r.results[0] ? r.results[0].doc.path : (r.path || null)), fixes: r.fixes || [] };
    }, q);
    const ok = want === null ? (u.kind === 'none' || u.kind === 'weak') : (u.top && want.split('|').includes(u.top));
    check(ok, 'understand ' + JSON.stringify(q) + ' -> ' + u.kind + ' ' + (u.top || '-') + (u.fixes.length ? ' fix:' + JSON.stringify(u.fixes) : ''), 'wanted ' + want);
  }
  const scoped = await page.evaluate(() => {
    const a = window.ToolFinder.understand('merge two pdf files', { section: 'pdf' });
    const b = window.ToolFinder.understand('remove the background from a photo', { section: 'pdf' });
    const c = window.ToolFinder.understand('km to miles', { section: 'pdf' });
    const d = window.ToolFinder.understand('km to miles', { section: 'conversions' });
    const e = window.ToolFinder.understand('merge two pdf files', { section: 'conversions' });
    const paths = (r) => (r.results || []).map((x) => x.doc.path);
    return {
      a: { kind: a.kind, section: a.section, paths: paths(a) },
      b: { kind: b.kind, elsewhere: b.elsewhere ? { kind: b.elsewhere.kind, top: paths(b.elsewhere)[0] } : null, paths: paths(b) },
      c: { kind: c.kind, elsewhere: c.elsewhere ? { kind: c.elsewhere.kind, top: c.elsewhere.hit && c.elsewhere.hit.path } : null },
      d: { kind: d.kind, top: d.hit && d.hit.path },
      e: { kind: e.kind, elsewhere: e.elsewhere ? { kind: e.elsewhere.kind, top: paths(e.elsewhere)[0] } : null }
    };
  });
  check(scoped.a.section === 'pdf' && scoped.a.paths.length > 0 && scoped.a.paths.every((p) => p.indexOf('pdf/') === 0) && scoped.a.paths[0] === 'pdf/merge-pdf/', 'section=pdf: "merge two pdf files" answers only from pdf/ -> ' + scoped.a.paths.join(', '));
  check((scoped.b.kind === 'none' || scoped.b.kind === 'weak') && scoped.b.paths.every((p) => p.indexOf('pdf/') === 0) && scoped.b.elsewhere && scoped.b.elsewhere.top === 'image/background-remover/', 'section=pdf: background removal is a miss in-section with the site-wide answer attached', JSON.stringify(scoped.b));
  check(scoped.c.kind === 'none' && scoped.c.elsewhere && scoped.c.elsewhere.kind === 'convert' && scoped.c.elsewhere.top === 'conversions/length/kilometer-to-mile/', 'section=pdf: "km to miles" misses in-section, elsewhere is the conversion', JSON.stringify(scoped.c));
  check(scoped.d.kind === 'convert' && scoped.d.top === 'conversions/length/kilometer-to-mile/', 'section=conversions: "km to miles" is the conversion', JSON.stringify(scoped.d));
  check(scoped.e.kind === 'none' && scoped.e.elsewhere && scoped.e.elsewhere.top === 'pdf/merge-pdf/', 'section=conversions: a PDF job misses, elsewhere is Merge PDF', JSON.stringify(scoped.e));

  /* the scoped page itself, through the URL */
  await page.goto(BASE + '/utilities/tool-finder/?section=pdf&q=' + encodeURIComponent('merge two pdf files'), { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.finder-msg.is-bot .finder-card').length > 0, { timeout: 15000 });
  const scopedPage = await page.evaluate(() => ({
    section: document.querySelector('.finder').getAttribute('data-section'),
    head: document.querySelector('.finder-head-text strong').textContent,
    hrefs: Array.from(document.querySelectorAll('.finder-card')).map((a) => a.getAttribute('href')),
    secs: Array.from(document.querySelectorAll('.finder-card')).map((a) => a.getAttribute('data-sec')),
    tags: Array.from(document.querySelectorAll('.finder-card .tag')).map((t) => t.className + ':' + t.textContent)
  }));
  check(scopedPage.section === 'pdf' && scopedPage.hrefs.length > 0 && scopedPage.hrefs.every((h) => h.indexOf('/pdf/') === 0), '?section=pdf page: every card under /pdf/ -> ' + scopedPage.hrefs.join(', '));
  check(/PDF Tools/.test(scopedPage.head), 'scoped head names the section: ' + scopedPage.head);
  check(scopedPage.secs.every((s) => s === 'pdf') && scopedPage.tags.length >= 2 && /tag-free:Free/.test(scopedPage.tags[0]) && /On your device/.test(scopedPage.tags[1]), 'cards carry data-sec and the two tag chips: ' + scopedPage.tags.slice(0, 2).join(' | '));
  await noBanner();
  await page.screenshot({ path: path.join(OUT, '1-full-scoped-pdf.png') });

  /* an AI card carries the freemium pair */
  await page.goto(BASE + '/utilities/tool-finder/?q=' + encodeURIComponent('read an invoice into a spreadsheet'), { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.finder-msg.is-bot .finder-card').length > 0, { timeout: 15000 });
  const aiCard = await page.evaluate(() => { const c = document.querySelector('.finder-card[data-sec="ai"]'); return c ? Array.from(c.querySelectorAll('.tag')).map((t) => t.className + ':' + t.textContent).join(' | ') : null; });
  check(aiCard && /tag-freemium:Free to try/.test(aiCard) && /tag-freemium:AI/.test(aiCard), 'an ai/ card carries "Free to try" + "AI": ' + aiCard);
  const descLen = await page.$$eval('.finder-card-desc', (els) => Math.max.apply(null, els.map((e) => e.textContent.length)));
  check(descLen <= 110, 'card descriptions are cut at 110 chars (longest ' + descLen + ')');

  /* ---------- b, c, e, f: the home page ---------- */
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 });
  console.log('[' + stamp() + '] home:', await page.title());
  await page.waitForSelector('.hero-finder .finder.finder-inline', { timeout: 15000 });
  const mounted = await page.evaluate(() => ({
    inline: !!document.querySelector('.hero-finder .finder-inline'),
    jobsHidden: document.getElementById('hero-jobs').hidden,
    chips: Array.from(document.querySelectorAll('.hero-finder .finder-chips .chip')).map((c) => c.textContent),
    answerHidden: document.querySelector('.hero-finder .finder-answer').hidden,
    greeting: document.querySelectorAll('.hero-finder .finder-msg').length,
    openHref: document.querySelector('.hero-finder .finder-open').getAttribute('href'),
    finderRequested: !!document.querySelector('script[src="/engine/finder.js"]')
  }));
  check(mounted.inline && mounted.jobsHidden && mounted.greeting === 0 && mounted.answerHidden, 'hero mounts the finder inline: no greeting, static chips hidden, answer area empty');
  check(mounted.chips.length === 6 && mounted.chips[0] === 'Merge two PDFs', 'six starter chips: ' + mounted.chips.join(' / '));
  check(mounted.openHref === '/utilities/tool-finder/', 'footer link before any question: ' + mounted.openHref);

  const total = registerTotal();
  const totalText = total.toLocaleString('en-GB');
  const head = await page.evaluate(() => ({
    title: document.title,
    og: document.querySelector('meta[property="og:title"]').content,
    tw: document.querySelector('meta[name="twitter:title"]').content,
    desc: document.querySelector('meta[name="description"]').content,
    ogd: document.querySelector('meta[property="og:description"]').content,
    twd: document.querySelector('meta[name="twitter:description"]').content,
    browse: (document.querySelector('.home-collections .section-lede') || {}).textContent || ''
  }));
  check(head.title.indexOf(totalText) >= 0 && head.title.length <= 70 && /\| 1234Tools$/.test(head.title), 'home <title> carries ' + totalText + ' and is ' + head.title.length + ' chars: ' + head.title);
  check(head.og === head.title && head.tw === head.title, 'og:title and twitter:title match the title');
  check(head.desc.indexOf(totalText) >= 0 && head.desc.length <= 160 && head.ogd === head.desc && head.twd === head.desc, 'descriptions carry the total, ' + head.desc.length + ' chars, and agree');
  check(head.browse.indexOf(totalText + ' tools is a lot to browse') >= 0, 'collections row says "' + totalText + ' tools is a lot to browse"', head.browse.slice(0, 60));

  /* f. the order, in the DOM and in the file */
  const order = await page.evaluate(() => {
    const main = document.getElementById('main');
    const kids = Array.from(main.children);
    const at = (sel) => { const e = main.querySelector(sel); let n = e; while (n && n.parentNode !== main) n = n.parentNode; return kids.indexOf(n); };
    const popular = Array.from(main.querySelectorAll('h2.section-title')).find((h) => h.textContent.trim() === 'Popular tools');
    const browse = Array.from(main.querySelectorAll('h2.section-title')).find((h) => h.textContent.trim() === 'Browse by category');
    return {
      hero: at('.hero'), popular: kids.indexOf(popular), recent: at('#recent-tools'), why: at('.home-why'), collections: at('.home-collections'),
      picks: at('.home-picks'), browse: kids.indexOf(browse), ask: at('.home-ask'), last: kids.length - 1,
      recentShown: !document.getElementById('recent-tools').hidden,
      recentHead: (document.querySelector('#recent-tools h2') || {}).textContent || ''
    };
  });
  const seq = [order.hero, order.popular, order.recent, order.browse, order.collections, order.picks, order.why, order.ask];
  check(seq.every((v, i) => v >= 0 && (i === 0 || v > seq[i - 1])), 'DOM order: hero < Popular tools < recent strip < Browse by category < collections < picks < why < ask  ' + JSON.stringify(seq));
  check(order.recentShown && order.recentHead === 'Pick up where you left off', '"Pick up where you left off" renders inside Popular tools, under the hero');
  const file = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const marks = ['<!-- HOME-HERO', '<!-- POPULAR', '<!-- CATEGORIES -->', '<!-- COLLECTIONS -->', '<!-- HOME-PICKS', '<!-- HOME-WHY', '<!-- HOME-ASK', '</main>'].map((m) => file.indexOf(m));
  check(marks.every((v, i) => v > 0 && (i === 0 || v > marks[i - 1])) && marks[0] > file.indexOf('<main id="main" class="content">'), 'file order: HOME-HERO, POPULAR, CATEGORIES, COLLECTIONS, HOME-PICKS, HOME-WHY, HOME-ASK  ' + JSON.stringify(marks));

  /* g. finder-first: the caret is in the box on a wide screen, "/" brings it back, the art shows */
  const fold = await page.evaluate(() => ({ at: (document.activeElement || {}).className || '', art: getComputedStyle(document.querySelector('.hero-art')).display, tiles: document.querySelectorAll('.hero-tile').length, trust: document.querySelectorAll('.hero-trust li').length, label: (document.querySelector('.hero-finder-label strong') || {}).textContent }));
  check(/finder-input/.test(fold.at), 'the finder has the caret on load at 1400px: ' + JSON.stringify(fold.at));
  check(fold.art !== 'none' && fold.tiles === 9 && fold.trust === 4 && fold.label === 'Tool Finder', 'hero art (9 tiles) shows at 1400px, the trust row has four facts, the box is labelled Tool Finder', JSON.stringify(fold));
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('/');
  const slash = await page.evaluate(() => ({ at: (document.activeElement || {}).className || '', typed: document.querySelector('.hero-finder .finder-input').value }));
  check(/finder-input/.test(slash.at) && slash.typed === '', '"/" puts the caret in the hero finder, not the header search, and types nothing: ' + JSON.stringify(slash));

  /* b. ask in the hero */
  await noBanner();
  await page.screenshot({ path: path.join(OUT, '2-home-1400.png') });
  const before = page.url();
  await page.click('.hero-finder .finder-input');
  await page.type('.hero-finder .finder-input', 'merge two pdf files');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.hero-finder .finder-answer .finder-card').length > 0, { timeout: 20000 });
  const first = await page.evaluate(() => ({
    url: location.href,
    input: document.querySelector('.hero-finder .finder-input').value,
    bots: document.querySelectorAll('.hero-finder .finder-answer .finder-msg.is-bot').length,
    users: document.querySelectorAll('.hero-finder .finder-msg.is-user').length,
    top: document.querySelector('.hero-finder .finder-answer .finder-card').getAttribute('href'),
    openHref: document.querySelector('.hero-finder .finder-open').getAttribute('href'),
    text: document.querySelector('.hero-finder .finder-answer .finder-text').textContent
  }));
  check(first.url === before && first.top === '/pdf/merge-pdf/', 'hero answers "merge two pdf files" in place, no navigation: ' + first.top + ' — "' + first.text + '"');
  check(first.input === 'merge two pdf files' && first.bots === 1 && first.users === 0, 'the question stays in the composer; one bot answer, no log');
  check(first.openHref === '/utilities/tool-finder/?q=merge%20two%20pdf%20files', '"Open the full Tool Finder" carries ?q=: ' + first.openHref);
  const box = await page.$('.hero-finder');
  await box.screenshot({ path: path.join(OUT, '3-home-inline-answer.png') });
  /* the same answer in the light theme: tokens only, so it must simply follow */
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await sleep(150);
  await box.screenshot({ path: path.join(OUT, '6-home-inline-light.png') });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await sleep(100);

  /* a second question replaces the first */
  await page.$eval('.hero-finder .finder-input', (e) => { e.value = ''; });
  await page.type('.hero-finder .finder-input', 'count the words in my essay');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const a = document.querySelector('.hero-finder .finder-answer .finder-card'); return a && a.getAttribute('href') === '/text/word-counter/'; }, { timeout: 20000 });
  const second = await page.evaluate(() => ({
    bots: document.querySelectorAll('.hero-finder .finder-answer .finder-msg.is-bot').length,
    hasMerge: !!document.querySelector('.hero-finder .finder-answer .finder-card[href="/pdf/merge-pdf/"]'),
    openHref: document.querySelector('.hero-finder .finder-open').getAttribute('href')
  }));
  check(second.bots === 1 && !second.hasMerge && /essay/.test(second.openHref), 'the second question replaces the first answer (one bubble, Merge PDF gone, link updated)');

  /* a chip asks its job */
  const chipText = await page.$eval('.hero-finder .finder-chips .chip', (c) => c.textContent);
  await page.click('.hero-finder .finder-chips .chip');
  await page.waitForFunction((t) => document.querySelector('.hero-finder .finder-input').value === t && document.querySelectorAll('.hero-finder .finder-answer .finder-card').length > 0 && !document.querySelector('.hero-finder .finder-answer .finder-card[href="/text/word-counter/"]'), { timeout: 20000 }, chipText);
  const chipped = await page.evaluate(() => ({ bots: document.querySelectorAll('.hero-finder .finder-answer .finder-msg.is-bot').length, top: document.querySelector('.hero-finder .finder-answer .finder-card').getAttribute('href') }));
  check(chipped.bots === 1 && chipped.top, 'chip "' + chipText + '" asks its job and replaces the answer: ' + chipped.top);

  /* a miss in the hero still offers the request button */
  await page.$eval('.hero-finder .finder-input', (e) => { e.value = ''; });
  await page.type('.hero-finder .finder-input', 'knitting pattern for a scarf');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !!document.querySelector('.hero-finder .finder-answer .finder-request'), { timeout: 20000 });
  await page.click('.hero-finder .finder-answer .finder-request');
  await page.waitForSelector('.hero-finder .finder-answer .finder-form', { timeout: 5000 });
  const formState = await page.evaluate(() => ({ bots: document.querySelectorAll('.hero-finder .finder-answer .finder-msg.is-bot').length, prefill: document.querySelector('.hero-finder .finder-form textarea').value, url: location.href }));
  check(formState.bots === 1 && formState.prefill === 'knitting pattern for a scarf' && /\/$/.test(new URL(formState.url).pathname), 'a miss offers the request form inside the same answer, prefilled, still on /');

  /* c. analytics: shape, never words */
  const calls = await page.evaluate(() => window.__gtagCalls);
  const answers = calls.filter((c) => c[0] === 'event' && c[1] === 'finder_answer');
  const typed = ['merge two pdf files', 'count the words in my essay', 'knitting', 'scarf', 'merge', 'essay', chipText.toLowerCase()];
  const leaked = calls.filter((c) => typed.some((w) => JSON.stringify(c).toLowerCase().indexOf(w) >= 0));
  check(answers.length >= 4 && answers.every((c) => c[2] && typeof c[2].kind === 'string' && c[2].mode === 'inline' && c[2].section === '(all)'), 'finder_answer fired ' + answers.length + 'x with kind/mode/section: ' + JSON.stringify(answers.map((c) => c[2].kind)));
  check(leaked.length === 0 && answers.every((c) => Object.keys(c[2]).sort().join() === 'kind,mode,section'), 'no analytics call carries the typed words; params are exactly kind, mode, section', JSON.stringify(leaked).slice(0, 200));

  /* ---------- d. header search ---------- */
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.click('#q');
  await page.type('#q', 'a');
  await page.waitForFunction(() => !!window.SEARCH_INDEX, { timeout: 10000 });
  for (const [term, want] of SEARCH) {
    await page.$eval('#q', (e, t) => { e.value = t; e.dispatchEvent(new Event('input', { bubbles: true })); }, term);
    await sleep(120);
    const r = await page.evaluate(() => ({
      hits: Array.from(document.querySelectorAll('#results a:not(.search-more)')).map((a) => a.getAttribute('href')),
      more: document.querySelector('#results .search-more') ? document.querySelector('#results .search-more').getAttribute('href') : null,
      empty: !!document.querySelector('#results .search-empty')
    }));
    if (want === null) check(r.hits.length === 0 && r.empty && r.more === '/utilities/tool-finder/?q=' + encodeURIComponent(term), 'search "' + term + '" -> empty state with the finder handoff ' + r.more);
    else check(r.hits[0] === '/' + want && r.more, 'search "' + term + '" -> ' + (r.hits[0] || '-') + (r.hits[1] ? ', ' + r.hits[1] : ''), 'wanted /' + want);
  }

  /* ---------- g. mobile ---------- */
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('.hero-finder .finder-inline', { timeout: 15000 });
  await noBanner();
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(scroll, 'no horizontal overflow at 390px');
  const phone = await page.evaluate(() => ({ art: getComputedStyle(document.querySelector('.hero-art')).display, at: (document.activeElement || {}).className || '', chips: getComputedStyle(document.querySelector('.hero-finder .finder-chips')).flexWrap, inputTop: Math.round(document.querySelector('.hero-finder .finder-input').getBoundingClientRect().top) }));
  check(phone.art === 'none' && !/finder-input/.test(phone.at) && phone.chips === 'nowrap' && phone.inputTop < 560, 'at 390px: art hidden, no autofocus (keyboard stays down), chips in one scrolling row, input within the first screen (top ' + phone.inputTop + 'px)', JSON.stringify(phone));
  await page.screenshot({ path: path.join(OUT, '4-home-390.png') });
  await page.tap('.hero-finder .finder-chips .chip');
  await page.waitForFunction(() => document.querySelectorAll('.hero-finder .finder-answer .finder-card').length > 0, { timeout: 20000 });
  await page.evaluate(() => document.querySelector('.hero-finder').scrollIntoView());
  await sleep(200);
  await page.screenshot({ path: path.join(OUT, '5-home-390-answer.png') });

  await browser.close();
  check(external.length === 0, 'no request to anything but 127.0.0.1 (' + external.length + ' seen)', external.slice(0, 3).join(' ; '));
  console.log('\nsummary: ' + pass + ' pass, ' + fail + ' fail, ' + stamp() + '; screenshots in ' + OUT);
  if (fail) process.exit(2);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
