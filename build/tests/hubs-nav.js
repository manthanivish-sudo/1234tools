/* Hubs by job, the sidebar's finder row and fold, the phone Find button and
   the directory's job facet and keyboard, in a real browser.
   node build/tests/hubs-nav.js [--port 8712] [--root <site>] [--base <older copy>] [--out <dir>]
   --root defaults to the site this file sits in and is served on --port by
   build/tests/serve.js (a server already on that port is used instead).
   --base is an older copy of the site: every card link its hubs had must
   still be present. Without it that check counts the cards instead. --out
   defaults to a folder in the OS temp dir. */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { serve } = require('./serve.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', 8712));
const ROOT = path.resolve(arg('root', path.join(__dirname, '..', '..')));
const BASE = arg('base', null);
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), '1234tools-hubs-nav')));
const ORIGIN = 'http://127.0.0.1:' + PORT;
fs.mkdirSync(OUT, { recursive: true });
function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}
const puppeteer = loadPuppeteer();

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else fail++; console.log((cond ? '  ok   ' : '  FAIL ') + msg); };
const hrefsOf = (file) => {
  if (!fs.existsSync(file)) return [];
  const h = fs.readFileSync(file, 'utf8');
  const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
  return [...new Set([...main.matchAll(/<a class="card[^"]*" href="([^"]+)"/g)].map((m) => m[1].replace(/^\.\.\//, '/').replace(/index\.html$/, '')))];
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  const errors = [], foreign = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('request', (r) => { const u = r.url(); if (!/^(data|blob):/.test(u) && u.indexOf(ORIGIN) !== 0) foreign.push(u); });

  try {
    for (const [w, h, mobile] of [[1400, 1000, false], [390, 844, true]]) {
      await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
      for (const hub of ['/pdf/', '/image/', '/business/', '/ai/']) {
        console.log('\n' + hub + ' at ' + w + 'px');
        errors.length = 0;
        await page.goto(ORIGIN + hub, { waitUntil: 'networkidle0', timeout: 60000 });
        await wait(400);
        const shotBanner = path.join(OUT, 'hub-' + hub.replace(/\//g, '') + '-' + w + '-banner.png');
        if (mobile) await page.screenshot({ path: shotBanner });
        const info = await page.evaluate(() => {
          const cc = document.querySelector('.cc'); const hadBanner = !!cc; if (cc) cc.remove();
          const fab = document.querySelector('.side-find-fab');
          const first = document.querySelector('.sidebar .side-nav .side-link');
          const r = fab && fab.getBoundingClientRect();
          return {
            hadBanner,
            verbs: [...document.querySelectorAll('h2.hub-verb')].map((x) => x.textContent),
            hrefs: [...document.querySelectorAll('main a.card')].map((a) => a.getAttribute('href')),
            io: document.querySelectorAll('main .card .card-io').length,
            cards: document.querySelectorAll('main a.card').length,
            tags: document.querySelectorAll('main .card .card-tags .tag').length,
            mounted: !!document.querySelector('.finder-inline .finder'),
            start: (document.querySelector('.hub-start') || {}).textContent || '',
            intro: !!document.querySelector('.hub-intro'),
            faqs: document.querySelectorAll('main details').length,
            bodySec: document.body.getAttribute('data-sec'),
            first: first ? first.textContent.trim() + ' ' + first.getAttribute('href') : '',
            fabShown: !!(fab && getComputedStyle(fab).display !== 'none' && r.width > 0),
            fabInView: !!(r && r.bottom <= innerHeight && r.right <= innerWidth),
            ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch (e) { return null; } })
          };
        });
        if (BASE) {
          const old = hrefsOf(path.join(BASE, hub.slice(1), 'index.html'));
          const missing = old.filter((x) => info.hrefs.indexOf(x) < 0);
          ok(missing.length === 0 && old.length > 0, 'all ' + old.length + ' old card links present' + (missing.length ? ' — missing ' + missing.join(', ') : ''));
        } else ok(info.hrefs.length > 0, info.hrefs.length + ' card links on the hub (no --base to compare with)');
        if (hub === '/pdf/') ok(info.verbs.length === 0, 'PDF keeps its hand-made groups (no verb headings)');
        else ok(info.verbs.length >= 2, 'verb headings: ' + info.verbs.join(', '));
        ok(info.io === info.cards && info.tags >= info.cards, '.card-io on all ' + info.cards + ' cards, tags on each');
        ok(info.mounted, 'finder box mounted');
        ok(/^Start here:/.test(info.start.trim()), 'start line: ' + info.start.trim());
        ok(info.intro, 'intro paragraph present');
        ok(info.bodySec === hub.replace(/\//g, ''), 'body data-sec=' + info.bodySec);
        const graph = (info.ld[0] && info.ld[0]['@graph']) || [];
        const faqNodes = graph.filter((n) => n['@type'] === 'FAQPage').length;
        ok(info.faqs >= 3 && faqNodes <= 1, info.faqs + ' FAQs visible, ' + faqNodes + ' FAQPage node in JSON-LD');
        ok(info.first === 'Find a tool /utilities/tool-finder/', 'sidebar first row: ' + info.first);
        if (mobile) ok(info.fabShown && info.fabInView, 'Find button visible at 390px' + (info.hadBanner ? ' (hidden while the cookie banner was up)' : ''));
        else ok(!info.fabShown, 'Find button hidden at 1400px');
        ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
        await page.screenshot({ path: path.join(OUT, 'hub-' + hub.replace(/\//g, '') + '-' + w + '.png'), fullPage: !mobile });
      }

      console.log('\n/engineering/ at ' + w + 'px (a folded section)');
      await page.goto(ORIGIN + '/engineering/', { waitUntil: 'networkidle0' });
      const fold = await page.evaluate(() => {
        const d = document.querySelector('.sidebar details.side-fold-more');
        const a = d && d.querySelector('.side-link.is-active');
        return { exists: !!d, open: !!(d && d.open), summary: d && d.querySelector('summary').textContent, active: a && a.getAttribute('href'), rows: d ? d.querySelectorAll('.side-link').length : 0 };
      });
      ok(fold.exists && fold.summary === 'More sections', '"More sections" fold exists with ' + fold.rows + ' rows');
      ok(fold.open && fold.active === '/engineering/', 'fold is open and Engineering is active inside it');
      await page.goto(ORIGIN + '/business/', { waitUntil: 'networkidle0' });
      ok(await page.evaluate(() => !document.querySelector('.sidebar details.side-fold-more').open), 'fold is closed on a page outside it');
      if (mobile) {
        await page.evaluate(() => { const c = document.querySelector('.cc'); if (c) c.remove(); });
        await page.click('#sidebarOpen'); await wait(400);
        await page.screenshot({ path: path.join(OUT, 'drawer-390.png') });
        ok(await page.evaluate(() => getComputedStyle(document.querySelector('.side-find-fab')).display === 'none'), 'Find button steps aside while the drawer is open');
      }

      console.log('\n/tools/ at ' + w + 'px');
      await page.goto(ORIGIN + '/tools/', { waitUntil: 'networkidle0' });
      await page.evaluate(() => { const c = document.querySelector('.cc'); if (c) c.remove(); });
      const count = () => page.evaluate(() => [...document.querySelectorAll('.dir-row')].filter((r) => !r.hidden).length);
      const all = await count();
      ok(await page.$$eval('.filter-verb .chip', (c) => c.map((x) => x.textContent).join(',')) === 'Any job,Make,Convert,Check,Calculate,Clean up', 'verb facet: Any job + five verbs');
      ok(await page.$$eval('.dir-row .dir-io', (x) => x.length) === all, '.dir-io on every row (' + all + ')');
      await page.click('.filter-verb .chip[data-verb="Check"]');
      const checks = await count();
      ok(checks > 0 && checks < all, 'Check filter: ' + all + ' -> ' + checks + ' rows');
      ok(await page.evaluate(() => [...document.querySelectorAll('.dir-row')].filter((r) => !r.hidden).every((r) => r.dataset.verb === 'Check')), 'every visible row is a Check');
      await page.click('.filter-chips .chip[data-cat="/developer/"]');
      const both = await count();
      ok(both > 0 && both < checks, 'AND with category Developer: ' + both + ' rows');
      if (!mobile) await page.screenshot({ path: path.join(OUT, 'tools-filtered-1400.png') });
      await page.evaluate(() => { document.querySelector('.dir-empty').hidden = false; });
      await page.click('#dirReset');
      ok(await count() === all && await page.$eval('.filter-verb .chip.is-on', (c) => c.dataset.verb) === 'all', 'reset clears all four filters');
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.press('/');
      ok(await page.evaluate(() => document.activeElement.id) === 'dirSearch', '/ focuses the directory search');
      await page.keyboard.press('ArrowDown');
      const r1 = await page.evaluate(() => document.activeElement.className + ' ' + document.activeElement.getAttribute('href'));
      ok(/dir-row/.test(r1), '↓ from search moves to the first row: ' + r1);
      await page.keyboard.press('ArrowDown');
      const r2 = await page.evaluate(() => document.activeElement.getAttribute('href'));
      ok(r2 && r2 !== r1.split(' ')[1], '↓ again moves to the next row: ' + r2);
      await page.type('#dirSearch', '');
      await page.keyboard.press('Escape');
      ok(await page.evaluate(() => document.activeElement.id) === 'dirSearch', 'Escape returns to the search box');
      await page.type('#dirSearch', 'pdf');
      await page.keyboard.press('ArrowDown');
      const firstVisible = await page.evaluate(() => [...document.querySelectorAll('.dir-row')].find((r) => !r.hidden).getAttribute('href'));
      ok(await page.evaluate(() => document.activeElement.getAttribute('href')) === firstVisible, '↓ skips hidden rows (lands on ' + firstVisible + ')');
      if (!mobile) { await page.screenshot({ path: path.join(OUT, 'tools-keyboard-1400.png') }); }
      else await page.screenshot({ path: path.join(OUT, 'tools-390.png') });
    }
    ok(foreign.length === 0, 'no request left 127.0.0.1' + (foreign.length ? ': ' + [...new Set(foreign)].slice(0, 5).join(', ') : ''));
  } finally {
    await browser.close();
    if (server) server.close();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed. Screenshots in ' + OUT);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
