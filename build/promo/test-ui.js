'use strict';
/**
 * Browser test for the Promotion Desk UI (puppeteer-core + local Chrome).
 *   node build/promo/test-ui.js
 * Serves the desk on 127.0.0.1:8751 (PROMO_UI_PORT=8752-8759 to change) with a
 * temporary PROMO_HOME and a pinned Tuesday (PROMO_NOW), drives Draft, Today,
 * Kits, Venues, Log, Calendar (targets, link checks, coverage) and Guide, and checks
 * the four kit PNGs by their headers. Nothing leaves the machine: composer
 * links are read, never followed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-ui-'));
process.env.PROMO_HOME = TMP;
process.env.PROMO_NOW = '2026-10-06T10:00:00';
/* 8750-8759 is this test's range; createServer does not limit ports like serve() does */
const PORT = +process.env.PROMO_UI_PORT || 8751;
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.PROMO_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const desk = require('./desk');
const kit = require('./kit');

let pass = 0;
let fail = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; failures.push(name); console.log('  FAIL ' + name + ': ' + (e && e.message || e)); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let S_ch = '';

(async () => {
  const server = desk.createServer(PORT);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
  // the kit's example: copy the owner's captured one so examples.js serves it from its cache
  try {
    const E = require('./examples');
    const from = path.join(process.env.PROMO_REAL_HOME || path.join(os.homedir(), '.1234tools-promo'), 'examples', E.slugFor('/pdf/merge-pdf/'));
    if (fs.existsSync(path.join(from, 'example.json'))) {
      const to = path.join(TMP, 'examples', E.slugFor('/pdf/merge-pdf/'));
      fs.mkdirSync(to, { recursive: true });
      for (const f of fs.readdirSync(from)) if (fs.statSync(path.join(from, f)).isFile()) fs.copyFileSync(path.join(from, f), path.join(to, f));
    }
  } catch (e) { /* no capture engine: the kit falls back to a schematic */ }
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  const external = [];
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    // the desk must work offline: nothing but our own origin is requested
    if (!req.url().startsWith(BASE) && !req.url().startsWith('data:')) { external.push(req.url()); req.abort(); } else req.continue();
  });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.evaluateOnNewDocument(() => {
    window.__clip = null;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } }, configurable: true });
  });

  try {
    await page.goto(BASE + '/#draft', { waitUntil: 'networkidle0' });
    await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 });

    await check('host guard refuses a foreign Host header', async () => {
      const http = require('http');
      const code = await new Promise((res) => http.get({ host: '127.0.0.1', port: PORT, path: '/api/tools', headers: { Host: 'evil.example' } }, (r) => res(r.statusCode)));
      assert.strictEqual(code, 421);
    });

    // ---- Draft: /pdf/merge-pdf/ on a Reddit venue
    await page.type('#d-tool', 'merge pdf');
    await page.waitForSelector('#d-tool-list li[data-path="/pdf/merge-pdf/"]');
    await page.click('#d-tool-list li[data-path="/pdf/merge-pdf/"]');
    await page.waitForFunction(() => document.querySelectorAll('#d-venue option').length > 3);
    await page.select('#d-venue', 'reddit-r-sideproject');
    await page.waitForFunction(() => { const t = document.querySelector('textarea[data-key="body"]'); return t && /merge-pdf/.test(t.value); }, { timeout: 15000 });

    const got = await page.evaluate(() => ({
      body: document.querySelector('textarea[data-key="body"]').value,
      title: document.querySelector('textarea[data-key="title"]').value,
      count: document.querySelector('[data-part="body"] .count').textContent,
      href: document.getElementById('d-composer').getAttribute('href'),
      composerHidden: document.getElementById('d-composer').hidden,
      template: document.getElementById('d-template').value,
      status: document.getElementById('d-status').textContent,
    }));
    await check('Draft shows the text', async () => assert.ok(got.body.length > 100 && got.body.includes('https://www.1234tools.com/pdf/merge-pdf/') && got.title.length > 10));
    await check('Draft shows a char count against the limit', async () => assert.ok(/^\d+ \/ 2000 chars$/.test(got.count), got.count));
    await check('template is reddit-post and status is OK', async () => { assert.strictEqual(got.template, 'reddit-post'); assert.ok(/OK to post/.test(got.status), got.status); });
    await check('Copy works (stubbed clipboard)', async () => {
      await page.click('[data-copy="body"]');
      const clip = await page.evaluate(() => window.__clip);
      assert.strictEqual(clip, got.body);
    });
    await check('Open composer href is correct and URL-encoded', async () => {
      assert.ok(!got.composerHidden);
      const expected = 'https://www.reddit.com/r/SideProject/submit?title=' + encodeURIComponent(got.title) + '&text=' + encodeURIComponent(got.body);
      assert.strictEqual(got.href, expected);
      assert.ok(!/[\s\n]/.test(got.href) && /%0A/.test(got.href) && /%E2%86%92|%20/.test(got.href));
      const target = await page.$eval('#d-composer', (a) => a.target + '|' + a.rel);
      assert.ok(/_blank\|noopener/.test(target));
    });
    await check('editing updates the live count and the composer', async () => {
      await page.focus('textarea[data-key="body"]');
      await page.keyboard.press('End');
      await page.keyboard.type(' Extra.');
      const r = await page.evaluate(() => ({ count: document.querySelector('[data-part="body"] .count').textContent, href: document.getElementById('d-composer').href }));
      assert.ok(r.count.startsWith(String(Array.from(got.body).length + 7) + ' / 2000'), r.count);
      assert.ok(r.href.includes(encodeURIComponent(' Extra.')));
    });
    await check('variant switcher changes the copy', async () => {
      await page.click('#d-vnext');
      await page.waitForFunction((b) => { const t = document.querySelector('textarea[data-key="body"]'); return t && t.value !== b && document.getElementById('d-vnum').textContent === '1'; }, { timeout: 10000 }, got.body);
    });
    await check('"verify rules first" badge on a venue whose rules were not captured', async () => {
      const id = await page.evaluate(() => { const o = Array.from(document.querySelectorAll('#d-venue option')).find((x) => /verify rules first/.test(x.textContent)); return o && o.value; });
      assert.ok(id, 'no verify venue in the list');
      await page.select('#d-venue', id);
      await page.waitForSelector('#d-verify .badge.verify', { timeout: 10000 });
    });
    await check('lint: a forbidden phrase shows in red', async () => {
      await page.select('#d-venue', 'reddit-r-sideproject');
      await page.waitForFunction(() => document.querySelector('textarea[data-key="body"]'));
      await page.focus('textarea[data-key="body"]');
      await page.keyboard.type(' It is 100% private.');
      await page.waitForFunction(() => /100% private/.test((document.querySelector('#d-lint .err') || {}).textContent || ''), { timeout: 10000 });
    });
    await check('Log as posted writes the log, then the venue waits', async () => {
      page.once('dialog', (d) => d.accept('https://www.reddit.com/r/SideProject/comments/abc/test/'));
      await page.click('#d-logpost');
      await page.waitForFunction(() => /Not today/.test(document.getElementById('d-status').textContent), { timeout: 10000 });
      const log = JSON.parse(fs.readFileSync(path.join(TMP, 'log.json'), 'utf8'));
      assert.ok(log.entries.length === 1 && log.entries[0].venueId === 'reddit-r-sideproject' && log.entries[0].toolPath === '/pdf/merge-pdf/');
      const disabled = await page.$eval('[data-copy="body"]', (b) => b.disabled);
      assert.ok(disabled, 'copy should be disabled while blocked');
    });

    // ---- Today
    await check('Today lists Tuesday tasks with verify badges and no high-risk venue', async () => {
      await page.click('.tabs button[data-tab="today"]');
      await page.waitForSelector('#plan-tasks .task', { timeout: 20000 });
      const r = await page.evaluate(() => ({ title: document.getElementById('plan-title').textContent, n: document.querySelectorAll('#plan-tasks .task').length, verify: document.querySelectorAll('#plan-tasks [data-verify]').length, ids: Array.from(document.querySelectorAll('#plan-tasks .task h3')).map((x) => x.textContent) }));
      assert.ok(/Tuesday/.test(r.title) && r.n >= 3 && r.verify >= 1, JSON.stringify(r));
      const hi = require('./venues').all().filter((v) => v.risk === 'high').map((v) => v.name);
      assert.ok(!r.ids.some((n) => hi.includes(n)), r.ids.join());
    });

    // ---- Venues
    await check('Venues table, exclusions and insights render', async () => {
      await page.click('.tabs button[data-tab="venues"]');
      await page.waitForSelector('#v-table tbody tr.vrow');
      const r = await page.evaluate(() => ({ rows: document.querySelectorAll('#v-table tbody tr.vrow').length, ex: document.querySelectorAll('#v-excluded li').length, ins: document.querySelectorAll('#v-insights .insight').length }));
      assert.ok(r.rows >= 60 && r.ex >= 40 && r.ins >= 20, JSON.stringify(r));
    });

    // ---- Kits
    await check('Kits: look selects are filled; picking a tool shows 6 alternative looks', async () => {
      await page.click('.tabs button[data-tab="kits"]');
      await page.waitForFunction(() => document.querySelectorAll('#k-palette option').length >= 9 && document.querySelectorAll('#k-layout option').length >= 5 && document.querySelectorAll('#k-type option').length >= 5, { timeout: 15000 });
      await page.type('#k-tool', 'merge pdf');
      await page.waitForSelector('#k-tool-list li[data-path="/pdf/merge-pdf/"]');
      await page.click('#k-tool-list li[data-path="/pdf/merge-pdf/"]');
      await page.waitForFunction(() => document.querySelectorAll('#k-looks button img').length === 6 && Array.from(document.querySelectorAll('#k-looks img')).every((i) => i.complete && i.naturalWidth > 0), { timeout: 90000 });
      const labels = await page.$$eval('#k-looks button', (xs) => xs.map((b) => b.title));
      assert.strictEqual(new Set(labels).size, 6, 'six different looks');
    });
    await check('Kits: Shuffle look sets a new seed and redraws the strip; a thumbnail picks its seed', async () => {
      const before = await page.$$eval('#k-looks button', (xs) => xs.map((b) => b.dataset.seed).join());
      await page.click('#k-shuffle');
      await page.waitForFunction((b) => { const xs = document.querySelectorAll('#k-looks button'); return xs.length === 6 && Array.from(xs).map((x) => x.dataset.seed).join() !== b; }, { timeout: 90000 }, before);
      const seed = await page.$eval('#k-seed', (i) => i.value);
      assert.ok(/^\d+$/.test(seed), 'seed field: ' + seed);
      await page.click('#k-looks button:nth-child(3)');
      const picked = await page.evaluate(() => ({ seed: document.getElementById('k-seed').value, btn: document.querySelector('#k-looks button:nth-child(3)').dataset.seed, pressed: document.querySelector('#k-looks button:nth-child(3)').getAttribute('aria-pressed') }));
      assert.ok(picked.seed === picked.btn && picked.pressed === 'true', JSON.stringify(picked));
    });
    await check('Kits generates the carousel (5 PNGs + PDF) and 4 singles in the chosen palette', async () => {
      await page.select('#k-palette', 'paper');
      const seed = await page.$eval('#k-seed', (i) => i.value);
      await page.click('#k-go');
      await page.waitForSelector('#k-new img', { timeout: 300000 });
      const dir = path.join(TMP, 'kits', 'merge-pdf');
      const want = { 'carousel-1.png': [1080, 1350], 'carousel-5.png': [1080, 1350], 'square-1080.png': [1080, 1080], 'pin-1000x1500.png': [1000, 1500], 'story-1080x1920.png': [1080, 1920], 'wide-1200x630.png': [1200, 630] };
      for (const [f, [w, h]] of Object.entries(want)) {
        const buf = fs.readFileSync(path.join(dir, f));
        assert.deepStrictEqual(kit.pngSize(buf), { w, h }, f);
      }
      assert.strictEqual(kit.pdfPages(fs.readFileSync(path.join(dir, 'carousel.pdf'))), 5);
      const md = fs.readFileSync(path.join(dir, 'kit.md'), 'utf8');
      assert.ok(md.includes('# Launch kit: Merge PDF Files'));
      assert.ok(md.includes('palette `paper`') && md.includes('seed `' + seed + '`'), 'look recorded in kit.md');
      const imgs = await page.$$eval('#k-new img', (xs) => xs.map((i) => i.naturalWidth));
      assert.strictEqual(imgs.length, 9);
      const look = await page.$eval('#k-new .k-lookline', (p) => p.textContent);
      assert.ok(/paper/.test(look) && look.includes(seed), look);
    });

    // ---- Log and Reels
    await check('Log tab shows the entry and cadence', async () => {
      await page.click('.tabs button[data-tab="log"]');
      await page.waitForFunction(() => document.querySelectorAll('#l-table tbody tr').length >= 1 && /reddit-r-sideproject/.test(document.querySelector('#l-table tbody').textContent));
    });
    await check('Reels lists tools: a Reel Maker link when it is live, a switched-off button when not', async () => {
      await page.click('.tabs button[data-tab="reels"]');
      await page.waitForSelector('#r-sections .reel a, #r-sections .reel .is-off');
      const s = await page.evaluate(() => ({
        href: (document.querySelector('#r-sections .reel a') || {}).href || null,
        off: document.querySelectorAll('#r-sections .reel .is-off').length,
        note: document.querySelector('#r-note').textContent
      }));
      if (s.href) assert.ok(s.href.startsWith('https://www.1234tools.com/ai-video/reel-maker/?tool=%2F'), s.href);
      else assert.ok(s.off > 0 && /not live/.test(s.note), JSON.stringify(s));
    });
    await check('Opportunities shows the saved list from disk, and statuses stick', async () => {
      require('./store').mergeOpps([{ url: 'https://superuser.com/q/42', title: 'Saved question about merging PDFs', venueId: 'qa-stackexchange-superuser', matchScore: 77, created: '2026-10-01T09:00:00Z', suggestedTemplate: 'stackexchange-answer' }], { tool: '/pdf/merge-pdf/' });
      await page.click('.tabs button[data-tab="opps"]');
      await page.waitForFunction(() => /Saved question about merging PDFs/.test(document.querySelector('#o-results').textContent));
      await page.evaluate(() => [...document.querySelectorAll('#o-results .opp button')].find((b) => b.textContent === 'Mark answered').click());
      await page.waitForFunction(() => !/Saved question/.test(document.querySelector('#o-results').textContent));
      assert.strictEqual(require('./store').listOpps({ status: 'answered' }).items.length, 1);
    });
    await check('Calendar shows the 90-day plan and saves a status', async () => {
      await page.click('.tabs button[data-tab="calendar"]');
      await page.waitForSelector('#cal-weeks .cal-item');
      const n = await page.$$eval('#cal-weeks .cal-item', (x) => x.length);
      assert.ok(n >= 100, 'items ' + n);
      await page.evaluate(() => [...document.querySelectorAll('#cal-weeks .cal-item button')].find((b) => b.textContent === 'Made').click());
      await page.waitForFunction(() => document.querySelector('#cal-weeks .cal-item.is-made'));
      assert.ok((await page.$eval('#cal-stats', (e) => e.textContent)).includes('1 made'));
    });
    // ---- per-channel targets, verification and coverage (calendar.js, channels.js)
    const slotId = await page.$eval('#cal-weeks .cal-item.is-today', (el) => el.dataset.id).catch(() => null);
    const row = (ch) => '.cal-item[data-id="' + slotId + '"] .tg[data-channel="' + ch + '"]';
    const prog = () => page.$eval('.cal-item[data-id="' + slotId + '"] .cal-prog', (e) => e.textContent);
    await check('Calendar: today\'s slot lists its target channels, "0 of N"', async () => {
      assert.ok(slotId, 'no slot marked today');
      const n = await page.$$eval('.cal-item[data-id="' + slotId + '"] .tg', (x) => x.length);
      assert.ok(n >= 3, 'targets ' + n);
      assert.strictEqual(await prog(), '0 of ' + n + ' channels');
    });
    await check('recording a valid link on a target makes the slot "1 of N" and logs it', async () => {
      const ch = await page.$eval('.cal-item[data-id="' + slotId + '"] .tg', (e) => e.dataset.channel);
      const C = require('./channels').get(ch);
      await page.type(row(ch) + ' input.tg-input', C.samples.valid[0]);
      await page.click(row(ch) + ' .tg-record');
      await page.waitForFunction((id) => /^1 of \d channels$/.test((document.querySelector('.cal-item[data-id="' + id + '"] .cal-prog') || {}).textContent || ''), { timeout: 10000 }, slotId);
      await page.waitForSelector(row(ch) + '.is-posted');
      const log = JSON.parse(fs.readFileSync(path.join(TMP, 'log.json'), 'utf8'));
      assert.ok(log.entries.some((e) => e.venueId === C.venue && e.url === C.samples.valid[0] && /^calendar /.test(e.note)), 'log entry for ' + C.venue);
      S_ch = ch;
    });
    let wrongCh = '';
    await check('a wrong-format link shows the warning and does not count', async () => {
      wrongCh = await page.$$eval('.cal-item[data-id="' + slotId + '"] .tg.is-due', (xs) => xs[0].dataset.channel);
      const C = require('./channels').get(wrongCh);
      await page.type(row(wrongCh) + ' input.tg-input', C.samples.wrongFormat[0]);
      await page.click(row(wrongCh) + ' .tg-record');
      await page.waitForSelector(row(wrongCh) + ' .tg-issues li.bad[data-code="wrong-format"]', { timeout: 10000 });
      const msg = await page.$eval(row(wrongCh) + ' .tg-issues li.bad', (e) => e.textContent);
      assert.ok(/wrong format/.test(msg), msg);
      assert.ok(/^1 of \d channels$/.test(await prog()));
      assert.ok(await page.$(row(wrongCh) + ' .tg-accept'), 'offers "It is right"');
    });
    await check('the coverage view lists the missing channel and the link to check', async () => {
      const missing = await page.$$eval('.cal-item[data-id="' + slotId + '"] .tg.is-due', (xs) => xs.map((x) => x.dataset.channel));
      assert.ok(missing.length >= 1);
      await page.waitForSelector('#cov-body .cov-slot[data-id="' + slotId + '"] [data-channel="' + missing[0] + '"]', { timeout: 10000 });
      await page.waitForSelector('#cov-body .cov-check [data-channel="' + wrongCh + '"]', { timeout: 10000 });
      const rows = await page.$$eval('#cov-body .cov-table tbody tr', (x) => x.length);
      assert.ok(rows >= 3, 'per-channel rows ' + rows);
    });
    await check('Today shows today\'s video slots with the channels still missing', async () => {
      await page.click('.tabs button[data-tab="today"]');
      /* wait for the drawn state, not just the first chip: the tab may redraw */
      await page.waitForFunction((id, w, done) => { const ch = Array.from(document.querySelectorAll('#plan-cal .tv-slot[data-id="' + id + '"] .chip')).map((c) => c.dataset.channel); return ch.includes(w) && !ch.includes(done); }, { timeout: 20000 }, slotId, wrongCh, S_ch).catch(() => {});
      const chips = await page.$$eval('#plan-cal .tv-slot[data-id="' + slotId + '"] .chip', (x) => x.map((c) => c.dataset.channel));
      assert.ok(!chips.includes(S_ch) && chips.includes(wrongCh), JSON.stringify({ chips, recorded: S_ch, wrongFormat: wrongCh }));
    });
    await check('Guide tab renders every channel card, the process and the FAQ', async () => {
      await page.click('.tabs button[data-tab="guide"]');
      await page.waitForSelector('#g-channels .g-card', { timeout: 10000 });
      const r = await page.evaluate(() => ({ cards: Array.from(document.querySelectorAll('#g-channels .g-card')).map((c) => c.dataset.channel), faq: document.querySelectorAll('#g-faq details.g-q').length, steps: document.querySelectorAll('#g-process .g-step').length, vision: document.querySelectorAll('#g-vision li').length, specs: document.querySelectorAll('#g-channels .g-specs dt').length, nc: document.querySelectorAll('#g-channels .g-specs .nc').length, src: document.querySelectorAll('#g-channels .g-src').length }));
      assert.deepStrictEqual(r.cards, require('./channels').list().map((c) => c.id));
      assert.ok(r.faq >= 12 && r.steps >= 7 && r.vision >= 4 && r.specs >= 100 && r.nc >= 1 && r.src >= 80, JSON.stringify(r));
    });
    await check('"How to post" on a target opens that channel\'s card alone', async () => {
      await page.click('.tabs button[data-tab="calendar"]');
      await page.waitForSelector(row(wrongCh) + ' button.linkish');
      await page.click(row(wrongCh) + ' button.linkish');
      await page.waitForFunction((ch) => { const c = document.getElementById('gc-' + ch); return c && !c.hidden && c.open && document.querySelectorAll('#g-channels .g-card:not([hidden])').length === 1; }, { timeout: 10000 }, wrongCh);
    });
    await check('Calendar: profile-link badge on Reels, and the Facebook link budget in Coverage', async () => {
      await page.click('.tabs button[data-tab="calendar"]');
      await page.waitForSelector('#cal-weeks .cal-item');
      assert.ok(await page.$('.cal-item[data-id="' + slotId + '"] .tg[data-channel="instagram-reel"] .badge.plink'), 'Reel row is marked profile link');
      await page.waitForSelector('#cov-body .fb-budget', { timeout: 10000 });
      assert.ok(/0 of 2 used this month/.test(await page.$eval('#cov-body .fb-budget', (e) => e.textContent)));
    });
    await check('site picker: XLeShop has its own items, copy and calendar; 1234Tools data is untouched', async () => {
      const before = await page.$eval('.cal-item[data-id="' + slotId + '"] .cal-prog', (e) => e.textContent);
      await page.select('#site', 'xleshop');
      await page.waitForFunction(() => document.body.dataset.site === 'xleshop' && document.body.dataset.ready === '1', { timeout: 20000 });
      await page.click('.tabs button[data-tab="draft"]');
      await page.type('#d-tool', 'domain');
      await page.waitForSelector('#d-tool-list li', { timeout: 10000 });
      const first = await page.$eval('#d-tool-list li', (li) => li.dataset.path);
      assert.ok(!/^\/(pdf|image|india)\//.test(first), first);
      await page.click('#d-tool-list li');
      await page.waitForFunction(() => document.querySelectorAll('#d-venue option').length > 2, { timeout: 15000 });
      await page.waitForFunction(() => { const t = document.querySelector('#d-parts textarea'); return t && t.value.length > 20; }, { timeout: 15000 });
      const txt = await page.$$eval('#d-parts textarea', (xs) => xs.map((x) => x.value).join('\n'));
      assert.ok(!/1234tools/i.test(txt) && /xleshop/i.test(txt), txt.slice(0, 300));
      await page.click('.tabs button[data-tab="calendar"]');
      await page.waitForSelector('#cal-weeks .cal-item');
      const n = await page.$$eval('#cal-weeks .cal-item', (x) => x.length);
      assert.ok(n >= 30 && n <= 45, 'xleshop slots ' + n);
      assert.ok(fs.existsSync(path.join(TMP, 'sites', 'xleshop', 'calendar.json')), 'xleshop calendar in its own folder');
      const home = await page.$eval('#site-home', (e) => e.textContent);
      assert.ok(home.endsWith(path.join('sites', 'xleshop')), home);
      await page.select('#site', '1234tools');
      await page.waitForFunction(() => document.body.dataset.site === '1234tools' && document.body.dataset.ready === '1', { timeout: 20000 });
      await page.waitForSelector('.cal-item[data-id="' + slotId + '"] .cal-prog', { timeout: 15000 });
      assert.strictEqual(await page.$eval('.cal-item[data-id="' + slotId + '"] .cal-prog', (e) => e.textContent), before);
    });
    await check('site picker with 14 sites: grouped "Sites" and "XLeShop shops"; a shop gets its own items and the shop calendar (Facebook post starts as "no link")', async () => {
      const groups = await page.$$eval('#site optgroup', (gs) => gs.map((g) => ({ label: g.label, n: g.querySelectorAll('option').length })));
      assert.deepStrictEqual(groups.map((g) => g.label), ['Sites', 'XLeShop shops'], JSON.stringify(groups));
      assert.deepStrictEqual(groups.map((g) => g.n), [5, 9], JSON.stringify(groups));
      assert.strictEqual(await page.$$eval('#site option', (o) => o.length), 14);
      const shop = await page.evaluate(async () => { const r = await (await fetch('/api/sites')).json(); return r.sites.find((s) => s.group === 'XLeShop shops' && s.items >= 8); });
      assert.ok(shop, 'a shop with items');
      await page.select('#site', shop.id);
      await page.waitForFunction((id) => document.body.dataset.site === id && document.body.dataset.ready === '1', { timeout: 20000 }, shop.id);
      const label = await page.$eval('#site', (s) => s.options[s.selectedIndex].parentElement.label);
      assert.strictEqual(label, 'XLeShop shops');
      await page.click('.tabs button[data-tab="calendar"]');
      await page.waitForSelector('#cal-weeks .cal-item .tg[data-channel="facebook-post"]', { timeout: 15000 });
      const t = await page.$eval('#cal-weeks .cal-item', (el) => ({ chans: Array.from(el.querySelectorAll('.tg')).map((x) => x.dataset.channel), native: !!(el.querySelector('.tg[data-channel="facebook-post"] .tg-nolink-box') || {}).checked }));
      assert.deepStrictEqual(t.chans, ['whatsapp-status', 'instagram-reel', 'facebook-post', 'instagram-carousel'], JSON.stringify(t));
      assert.ok(t.native, 'the Facebook Page post starts as "no link"');
      assert.ok(fs.existsSync(path.join(TMP, 'sites', shop.id, 'calendar.json')), 'the shop calendar in its own folder');
      await page.select('#site', '1234tools');
      await page.waitForFunction(() => document.body.dataset.site === '1234tools' && document.body.dataset.ready === '1', { timeout: 20000 });
    });
    // ---- Testimonials (testimonials.js): XLeShop, then another site sees none of it
    const tmSite = async (id) => { await page.select('#site', id); await page.waitForFunction((x) => document.body.dataset.site === x && document.body.dataset.ready === '1', { timeout: 20000 }, id); };
    const tmItem = '#tm-list .tm-item';
    await check('Testimonials: XLeShop\'s nine suggested shops; the request email names the shop, the places and the reply phrase, lint-clean', async () => {
      await tmSite('xleshop');
      await page.click('.tabs button[data-tab="testimonials"]');
      await page.waitForFunction(() => document.querySelectorAll('#tm-suggest-list .tm-sug').length === 9, { timeout: 15000 });
      await page.evaluate(() => document.querySelector('#tm-suggest-list .tm-sug[data-business="Gajanan Home Foods"] .tm-sug-email').click());
      await page.waitForFunction(() => /Gajanan Home Foods/.test(document.getElementById('tm-e-body').value) && /clean/.test(document.getElementById('tm-e-lint').textContent), { timeout: 10000 });
      const e = await page.evaluate(() => ({ s: document.getElementById('tm-e-subject').value, b: document.getElementById('tm-e-body').value, w: document.getElementById('tm-e-wa').value }));
      assert.ok(/^May we quote you on the XLeShop website\?$/.test(e.s), e.s);
      for (const t of [e.b, e.w]) assert.ok(t.includes('"Yes, you may publish this"') && t.includes('xleshop.com') && /Nothing is offered in return/.test(t) && /take (the quote|it) down at any time/.test(t), t);
      await page.click('#tm-e-uses input[data-use="social"]');
      await page.waitForFunction(() => /social media posts/.test(document.getElementById('tm-e-body').value), { timeout: 10000 });
      await page.click('#tm-e-copy-body');
      assert.ok(/social media posts/.test(await page.evaluate(() => window.__clip)));
    });
    await check('Testimonials: a quote without written permission is saved as received and cannot be approved', async () => {
      await page.type('#tm-name', 'Asha Rao');
      await page.type('#tm-role', 'Owner');
      await page.type('#tm-business', 'Gajanan Home Foods');
      await page.type('#tm-contact', 'asha@example.com');
      await page.type('#tm-quote', 'Orders reach my phone the moment they are placed.');
      await page.click('#tm-save');
      await page.waitForFunction(() => /no written permission/.test(document.getElementById('tm-form-msg').textContent), { timeout: 10000 });
      await page.waitForSelector(tmItem + '[data-status="received"]', { timeout: 10000 });
      await page.click(tmItem + '[data-status="received"] [data-act="Approve"]');
      await page.waitForSelector(tmItem + ' .tm-err', { timeout: 10000 });
      assert.ok(/Not approved/.test(await page.$eval(tmItem + ' .tm-err', (e) => e.textContent)));
      assert.strictEqual(await page.$eval(tmItem, (e) => e.dataset.status), 'received');
    });
    await check('Testimonials: with permission it is approved, published at a URL and exported as HTML and JSON', async () => {
      await page.select('#tm-perm', 'yes');
      await page.select('#tm-how', 'email-reply');
      await page.$eval('#tm-date', (el) => { el.value = '2026-10-01'; });
      await page.type('#tm-evidence', 'Outlook Clients/Quotes, 1 Oct 2026');
      await page.click('#tm-save');
      await page.waitForFunction(() => /can be approved/.test(document.getElementById('tm-form-msg').textContent), { timeout: 10000 });
      await page.waitForFunction(() => { const it = document.querySelector('#tm-list .tm-item[data-status="received"]'); return it && !it.querySelector('.tm-why'); }, { timeout: 10000 });
      await page.click(tmItem + '[data-status="received"] [data-act="Approve"]');
      await page.waitForSelector(tmItem + '[data-status="approved"]', { timeout: 10000 });
      page.once('dialog', (d) => d.accept('https://xleshop.com/customers.html'));
      await page.click(tmItem + '[data-status="approved"] [data-act="Mark published…"]');
      await page.waitForSelector(tmItem + '[data-status="published"]', { timeout: 10000 });
      await page.click('#tm-x-go');
      await page.waitForSelector('#tm-x-out [data-out="json"] textarea', { timeout: 10000 });
      const out = await page.evaluate(() => ({ html: document.querySelector('#tm-x-out [data-out="html"] textarea').value, json: document.querySelector('#tm-x-out [data-out="json"] textarea').value }));
      assert.deepStrictEqual(JSON.parse(out.json), [{ name: 'Asha Rao', role: 'Owner', business: 'Gajanan Home Foods', quote: 'Orders reach my phone the moment they are placed.', date: '2026-10-01' }]);
      assert.ok(out.html.includes('“Orders reach my phone the moment they are placed.”') && !/★/.test(out.html), out.html);
    });
    await check('Testimonials: Withdraw takes it out of the export and lists where it was published', async () => {
      page.once('dialog', (d) => d.accept());
      await page.click(tmItem + '[data-status="published"] [data-act="Withdraw…"]');
      await page.waitForSelector(tmItem + '[data-status="withdrawn"] .tm-take li[data-url="https://xleshop.com/customers.html"]', { timeout: 10000 });
      await page.click('#tm-x-go');
      await page.waitForFunction(() => /^0 quotes/.test((document.getElementById('tm-x-count') || {}).textContent || '') && /still to take down: Asha Rao at https:\/\/xleshop\.com\/customers\.html/.test(document.getElementById('tm-x-out').textContent), { timeout: 10000 });
      await page.click(tmItem + '[data-status="withdrawn"] .tm-taken');
      await page.waitForFunction(() => !document.querySelector('#tm-list .tm-item[data-status="withdrawn"] .tm-take'), { timeout: 10000 });
      const f = JSON.parse(fs.readFileSync(path.join(TMP, 'sites', 'xleshop', 'testimonials.json'), 'utf8'));
      assert.ok(f.items.length === 1 && f.items[0].status === 'withdrawn' && f.items[0].published[0].removedAt, JSON.stringify(f.items[0]).slice(0, 200));
    });
    await check('Testimonials: another site starts empty with its own suggestions; 1234Tools has none', async () => {
      await tmSite('mvr-it');
      await page.waitForFunction(() => document.querySelectorAll('#tm-suggest-list .tm-sug').length === 7 && /No quotes or requests/.test(document.getElementById('tm-list').textContent) && !document.getElementById('tm-e-name').value, { timeout: 15000 });
      assert.ok(!fs.existsSync(path.join(TMP, 'sites', 'mvr-it', 'testimonials.json')) || JSON.parse(fs.readFileSync(path.join(TMP, 'sites', 'mvr-it', 'testimonials.json'), 'utf8')).items.length === 0);
      await tmSite('1234tools');
      await page.waitForFunction(() => document.getElementById('tm-suggest').hidden && /clean/.test(document.getElementById('tm-e-lint').textContent) && /1234tools\.com/.test(document.getElementById('tm-e-body').value), { timeout: 15000 });
    });

    await check('no external requests and no page errors', async () => {
      assert.deepStrictEqual(external, []);
      assert.deepStrictEqual(pageErrors, []);
    });
  } finally {
    await browser.close();
    server.close();
    await sleep(100);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
