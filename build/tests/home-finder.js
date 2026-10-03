/**
 * The home hero finder, the finder's modes, the header search and the home
 * page head, driven in headless Chrome against a static server.
 *
 *   node build/tests/home-finder.js --port 8711 --root E:/path/to/site [--out DIR]
 *
 * The test serves --root on --port itself through build/tests/serve.js (a
 * server already listening there is used instead). --root defaults to the
 * site this file sits in (two levels up) and --out to a folder in the OS
 * temp dir. Exit code 2 when a case fails, 1 when the run itself breaks.
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
 *   h. a number typed with a conversion ("5 lbs in kg") rides along as ?v=,
 *      and the conversion page opens with it in the box; calculators open on
 *      the keys their spec declares (?amount=…), refusing values the field
 *      could not hold, and text tools on ?text=, none of it counted as use;
 *      a number typed with a calculator job ("tip on 84.50", "20% of 150")
 *      rides along when the one answer declares its field (build/jobs.js
 *      PREFILL), and nothing rides when the mapping is a guess
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
const { serve } = require('./serve.js');

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
  const server = await serve(ROOT, PORT);
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
    window.__toolUsed = 0;
    document.addEventListener('mvr:tool-used', () => { window.__toolUsed++; });
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

  /* h. a typed number is kept with the conversion */
  const valued = await page.evaluate(() => {
    const pick = (r) => ({ kind: r.kind, top: r.hit && r.hit.path, value: r.value, elsewhere: r.elsewhere && r.elsewhere.value });
    return {
      a: pick(window.ToolFinder.understand('5 lbs in kg')),
      b: pick(window.ToolFinder.understand('-40 celsius to fahrenheit')),
      c: pick(window.ToolFinder.understand('1,5 km to miles')),
      d: pick(window.ToolFinder.understand('convert 1,000 metres to feet')),
      e: pick(window.ToolFinder.understand('km to miles')),
      f: pick(window.ToolFinder.understand('5 km to miles', { section: 'pdf' }))
    };
  });
  check(valued.a.kind === 'convert' && valued.a.value === 5 && valued.b.kind === 'convert' && valued.b.value === -40 && valued.c.value === 1.5 && valued.d.value === 1000, 'the number rides along: 5 lbs -> 5, -40 celsius -> -40, "1,5 km" -> 1.5, "1,000 metres" -> 1000', JSON.stringify(valued));
  check(valued.e.kind === 'convert' && valued.e.value === undefined && valued.f.kind === 'none' && valued.f.elsewhere === 5, 'no number typed, none carried; a scoped miss keeps it on the site-wide answer', JSON.stringify([valued.e, valued.f]));

  /* h. a number typed with a calculator job, when the one answer declares its field */
  const filled = await page.evaluate(() => {
    const pick = (r) => ({ kind: r.kind, top: r.hit ? r.hit.path : (r.results && r.results[0] ? r.results[0].doc.path : null), value: r.value, fill: r.fill || null });
    const q = ['20% of 150', 'tip on 84.50', '15% tip on 84.50', 'emi on 50 lakh', 'bmi 70 kg 175 cm', 'km to miles', 'tip on 84.50 for 4 people', 'loan for 30 years', 'percentage of 150', 'compound interest on 10000 at 7%'];
    const out = {};
    for (const t of q) out[t] = pick(window.ToolFinder.understand(t));
    out.scoped = window.ToolFinder.understand('tip on 84.50', { section: 'finance' });
    out.scoped = { kind: out.scoped.kind, else: out.scoped.elsewhere && pick(out.scoped.elsewhere) };
    return out;
  });
  const f = (q) => JSON.stringify(filled[q]);
  check(filled['20% of 150'].kind === 'one' && filled['20% of 150'].top === 'mathematics/percentage/' && f('20% of 150').indexOf('"fill":{"value":20,"total":150}') >= 0, '"20% of 150" -> the percentage tool with value=20, total=150: ' + f('20% of 150'));
  check(filled['tip on 84.50'].kind === 'one' && filled['tip on 84.50'].top === 'utilities/tip-calculator/' && f('tip on 84.50').indexOf('"fill":{"bill":84.5}') >= 0, '"tip on 84.50" -> the tip calculator with bill=84.5: ' + f('tip on 84.50'));
  check(f('15% tip on 84.50').indexOf('"fill":{"tip":15,"bill":84.5}') >= 0 && f('emi on 50 lakh').indexOf('"fill":{"amount":5000000}') >= 0 && f('compound interest on 10000 at 7%').indexOf('"fill":{"principal":10000,"rate":7}') >= 0, 'a % number fills the percent field, "50 lakh" is 5,000,000: ' + [f('15% tip on 84.50'), f('emi on 50 lakh')].join(' '));
  check(filled['bmi 70 kg 175 cm'].fill === null && filled['bmi 70 kg 175 cm'].value === undefined, '"bmi 70 kg 175 cm" carries nothing (two numbers with units; BMI declares no field): ' + f('bmi 70 kg 175 cm'));
  check(filled['km to miles'].kind === 'convert' && filled['km to miles'].top === 'conversions/length/kilometer-to-mile/' && filled['km to miles'].value === undefined && filled['km to miles'].fill === null, '"km to miles" unchanged: the conversion, nothing carried');
  check(filled['tip on 84.50 for 4 people'].top === 'utilities/tip-calculator/' && filled['tip on 84.50 for 4 people'].fill === null && filled['loan for 30 years'].fill === null && filled['percentage of 150'].fill === null, 'guesses carry nothing: a second number ("4 people"), a unit ("30 years"), a lone number where either box fits ("percentage of 150")', [f('tip on 84.50 for 4 people'), f('loan for 30 years'), f('percentage of 150')].join(' '));
  check(filled.scoped.kind === 'none' && filled.scoped.else && filled.scoped.else.top === 'utilities/tip-calculator/' && JSON.stringify(filled.scoped.else.fill) === '{"bill":84.5}', 'a scoped miss keeps the fill on the site-wide answer', JSON.stringify(filled.scoped));
  const protoWords = await page.evaluate(() => ['constructor', 'constructor to miles', 'toString', '50 constructor'].map((q) => { try { return q + ':' + window.ToolFinder.understand(q).kind; } catch (e) { return q + ':THROWS ' + e.message; } }));
  check(protoWords.every((s) => s.indexOf('THROWS') < 0), 'words that name Object\u2019s own properties ("constructor", "toString") are just words: ' + protoWords.join(', '));

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

  /* h. the conversion card carries the typed value (after the chip step: a
     conversion answer swaps the chips for "All mass conversions" and co.) */
  await page.$eval('.hero-finder .finder-input', (e) => { e.value = ''; });
  await page.type('.hero-finder .finder-input', '5 lbs in kg');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const a = document.querySelector('.hero-finder .finder-answer .finder-card'); return a && /pound-to-kilogram/.test(a.getAttribute('href')); }, { timeout: 20000 });
  const valuedCard = await page.evaluate(() => ({
    href: document.querySelector('.hero-finder .finder-answer .finder-card').getAttribute('href'),
    sec: document.querySelector('.hero-finder .finder-answer .finder-card').getAttribute('data-sec'),
    text: document.querySelector('.hero-finder .finder-answer .finder-text').textContent,
    desc: (document.querySelector('.hero-finder .finder-answer .finder-card-desc') || {}).textContent || '',
    bots: document.querySelectorAll('.hero-finder .finder-answer .finder-msg.is-bot').length,
    chips: Array.from(document.querySelectorAll('.hero-finder .finder-chips .chip')).map((c) => c.textContent)
  }));
  check(valuedCard.href === '/conversions/mass/pound-to-kilogram/?v=5' && valuedCard.sec === 'conversions' && /opens with 5 already in the box/i.test(valuedCard.text) && /Opens with 5/.test(valuedCard.desc) && valuedCard.bots === 1, '"5 lbs in kg" links to the pair page with ?v=5 and says so: ' + valuedCard.href + ' / ' + valuedCard.text);
  check(valuedCard.chips[0] === 'All mass conversions' && valuedCard.chips[1] === 'Reverse it', 'a conversion answer offers the family and the reverse: ' + valuedCard.chips.slice(0, 2).join(' / '));

  /* h. a calculator card carries the typed number the same way */
  const heroCard = async (q, pathPart) => {
    await page.$eval('.hero-finder .finder-input', (e) => { e.value = ''; });
    await page.type('.hero-finder .finder-input', q);
    await page.keyboard.press('Enter');
    await page.waitForFunction((p) => { const a = document.querySelector('.hero-finder .finder-answer .finder-card'); return a && a.getAttribute('href').indexOf(p) >= 0; }, { timeout: 20000 }, pathPart);
    return page.evaluate(() => ({
      href: document.querySelector('.hero-finder .finder-answer .finder-card').getAttribute('href'),
      text: document.querySelector('.hero-finder .finder-answer .finder-text').textContent,
      desc: (document.querySelector('.hero-finder .finder-answer .finder-card-desc') || {}).textContent || '',
      bots: document.querySelectorAll('.hero-finder .finder-answer .finder-msg.is-bot').length
    }));
  };
  const tipCard = await heroCard('tip on 84.50', '/utilities/tip-calculator/');
  check(tipCard.href === '/utilities/tip-calculator/?bill=84.5' && /opens with 84\.5 already filled in/i.test(tipCard.text) && /^Opens with 84\.5 already filled in\./.test(tipCard.desc) && tipCard.bots === 1, '"tip on 84.50" links to the tip calculator with ?bill=84.5 and says so: ' + tipCard.href + ' / ' + tipCard.text);
  const pctCard = await heroCard('20% of 150', '/mathematics/percentage/');
  check(pctCard.href === '/mathematics/percentage/?value=20&total=150' && /opens with 20% and 150 already filled in/i.test(pctCard.text), '"20% of 150" links to the percentage tool with ?value=20&total=150: ' + pctCard.href + ' / ' + pctCard.text);

  /* c. analytics: shape, never words */
  const calls = await page.evaluate(() => window.__gtagCalls);
  const answers = calls.filter((c) => c[0] === 'event' && c[1] === 'finder_answer');
  const typed = ['merge two pdf files', 'count the words in my essay', 'knitting', 'scarf', 'merge', 'essay', '5 lbs', 'lbs in kg', 'tip on', '84.5', '20% of', chipText.toLowerCase()];
  const leaked = calls.filter((c) => typed.some((w) => JSON.stringify(c).toLowerCase().indexOf(w) >= 0));
  check(answers.length >= 4 && answers.every((c) => c[2] && typeof c[2].kind === 'string' && c[2].mode === 'inline' && c[2].section === '(all)'), 'finder_answer fired ' + answers.length + 'x with kind/mode/section: ' + JSON.stringify(answers.map((c) => c[2].kind)));
  check(leaked.length === 0 && answers.every((c) => Object.keys(c[2]).sort().join() === 'kind,mode,section'), 'no analytics call carries the typed words; params are exactly kind, mode, section', JSON.stringify(leaked).slice(0, 200));

  /* h. the conversion page opens on the value */
  await page.goto(BASE + '/conversions/mass/pound-to-kilogram/?v=5', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('#u-value', { timeout: 15000 });
  const prefilled = await page.evaluate(() => ({
    v: document.getElementById('u-value').value,
    label: (document.querySelector('.result-primary .result-label') || {}).textContent || '',
    value: (document.querySelector('.result-primary .result-value') || {}).textContent || ''
  }));
  check(prefilled.v === '5' && /^5 lb =$/.test(prefilled.label.trim()) && /^2\.2[67]/.test(prefilled.value), '?v=5 opens the converter on 5: ' + prefilled.label + ' ' + prefilled.value, JSON.stringify(prefilled));
  await page.goto(BASE + '/conversions/mass/pound-to-kilogram/?v=five', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('#u-value', { timeout: 15000 });
  const notANumber = await page.$eval('#u-value', (e) => e.value);
  check(notANumber === '1', 'a ?v= that is not a number keeps the worked example of 1 (got ' + notANumber + ')');

  /* h. the cards' own hrefs open worked out */
  await page.goto(BASE + tipCard.href, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('.tool-results .result-primary', { timeout: 15000 });
  const tipPage = await page.evaluate(() => ({ bill: document.querySelector('[name="bill"]').value, rows: Array.from(document.querySelectorAll('.tool-results .result')).map((r) => r.textContent) }));
  check(tipPage.bill === '84.5' && tipPage.rows.some((r) => /^Tip amount.*10\.56/.test(r)) && tipPage.rows.some((r) => /^Total including tip.*95\.06/.test(r)), 'the tip card opens on a bill of 84.5: tip 10.56, total 95.06', JSON.stringify(tipPage));
  await page.goto(BASE + pctCard.href, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('.tool-results .result-primary', { timeout: 15000 });
  const pctPage = await page.evaluate(() => ({ value: document.querySelector('[name="value"]').value, total: document.querySelector('[name="total"]').value, rows: Array.from(document.querySelectorAll('.tool-results .result')).map((r) => r.textContent), used: window.__toolUsed }));
  check(pctPage.value === '20' && pctPage.total === '150' && pctPage.rows.some((r) => /^A% of B30\b/.test(r)) && pctPage.used === 0, 'the percentage card opens on 20 and 150: "A% of B" is 30, and it is not counted as use', JSON.stringify(pctPage));

  /* h. calculators open on the keys their spec declares; text tools on ?text= */
  const calcAt = async (url) => {
    await page.goto(BASE + url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('.tool-results .result-primary', { timeout: 15000 });
    return page.evaluate(() => {
      const vals = {};
      document.querySelectorAll('.tool-form [name]').forEach((e) => { vals[e.name] = e.value; });
      return { vals, primary: (document.querySelector('.tool-results .result-primary .result-value') || {}).textContent || '', html: document.querySelector('.tool').innerHTML, used: window.__toolUsed, today: new Date().toISOString().slice(0, 10) };
    });
  };
  const loanPlain = await calcAt('/finance/loan-payment/');
  check(loanPlain.vals.amount === '250000' && /1,580\.17/.test(loanPlain.primary), 'no query string: the loan calculator shows its worked example (' + loanPlain.primary + ')', JSON.stringify(loanPlain.vals));
  const loan = await calcAt('/finance/loan-payment/?amount=200000&rate=6.5&years=30');
  check(loan.vals.amount === '200000' && loan.vals.rate === '6.5' && loan.vals.years === '30' && /1,264\.14/.test(loan.primary), '?amount=200000&rate=6.5&years=30 opens the loan calculator on them: ' + loan.primary, JSON.stringify(loan.vals));
  await page.type('#in-amount', '1');
  const typedUse = await page.evaluate(() => window.__toolUsed);
  check(loan.used === 0 && typedUse > 0, 'values from the URL are not use: no mvr:tool-used on load (' + loan.used + '), one keystroke is (' + typedUse + ')');
  const loanBad = await calcAt('/finance/loan-payment/?amount=lots&years=-5&rate=');
  check(loanBad.vals.amount === '250000' && loanBad.vals.years === '30' && loanBad.vals.rate === '6.5' && loanBad.primary === loanPlain.primary, 'not a number, below min, or empty: each keeps its default', JSON.stringify(loanBad.vals));
  const loanOdd = await calcAt('/finance/loan-payment/?foo=1&utm_source=x&v=9');
  check(loanOdd.html === loanPlain.html, 'unknown keys change nothing: the tool markup is byte-for-byte the plain page');
  const week = await calcAt('/time/week-number/?date=2026-12-25');
  check(week.vals.date === '2026-12-25' && /\b52\b/.test(week.primary), '?date=2026-12-25 fills the date field: ' + week.primary, JSON.stringify(week.vals));
  const weekBad = await calcAt('/time/week-number/?date=2026-02-30');
  check(weekBad.vals.date === weekBad.today, 'a date that is not on the calendar (2026-02-30) keeps today', JSON.stringify(weekBad.vals));
  const vatBad = await calcAt('/finance/vat-sales-tax/?mode=bogus&amount=50');
  const vatOk = await calcAt('/finance/vat-sales-tax/?mode=gross');
  check(vatBad.vals.mode === 'net' && vatBad.vals.amount === '50' && vatOk.vals.mode === 'gross', 'a select ignores a value outside its options (bogus -> net) and takes one of its own (gross); the other key still applies', JSON.stringify([vatBad.vals, vatOk.vals]));
  await page.goto(BASE + '/text/word-counter/?text=one%20two%20three', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('.stat-grid .stat-row', { timeout: 15000 });
  const wc = await page.evaluate(() => ({ ta: document.querySelector('.code-area').value, words: (Array.from(document.querySelectorAll('.stat-row')).find((r) => r.querySelector('.stat-key').textContent === 'Words') || { textContent: '' }).querySelector('.stat-val').textContent }));
  check(wc.ta === 'one two three' && wc.words === '3', '/text/word-counter/?text=one%20two%20three counts 3 words', JSON.stringify(wc));
  await page.goto(BASE + '/text/word-counter/?text=' + 'a%20'.repeat(2500), { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('.stat-grid .stat-row', { timeout: 15000 });
  const wcLong = await page.$eval('.code-area', (e) => e.value.length);
  check(wcLong === 4000, '?text= is capped at 4,000 characters (got ' + wcLong + ')');

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
  if (server) server.close();
  check(external.length === 0, 'no request to anything but 127.0.0.1 (' + external.length + ' seen)', external.slice(0, 3).join(' ; '));
  console.log('\nsummary: ' + pass + ' pass, ' + fail + ' fail, ' + stamp() + '; screenshots in ' + OUT);
  if (fail) process.exit(2);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
