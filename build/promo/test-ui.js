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
/* the Start with Windows switch writes shortcuts: point both folders at temp folders before any toggle */
const STARTUP = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-startup-'));
const PROGRAMS = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-programs-'));
process.env.PROMO_STARTUP_DIR = STARTUP;
process.env.PROMO_PROGRAMS_DIR = PROGRAMS;
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
    await check('Back returns to the calendar slot you left from: browser Back, the "Back to" bar, and the sidebar', async () => {
      await page.click('.tabs button[data-tab="calendar"]');
      await page.waitForSelector('#cal-weeks .cal-item');
      /* a slot well down the page: the last one of the last open week */
      const id = await page.$$eval('#cal-weeks details.cal-week[open]', (ds) => { const xs = ds[ds.length - 1].querySelectorAll('.cal-item'); return xs[xs.length - 1].dataset.id; });
      const sel = '.cal-item[data-id="' + id + '"]';
      const backOnSlot = () => page.waitForFunction((s) => { const el = document.querySelector(s); if (!el || document.querySelector('#tab-calendar').hidden) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight && scrollY > 300; }, { timeout: 15000 }, sel);
      const pack = async () => {
        await page.click(sel + ' .tg-pack');
        await page.waitForFunction(() => !document.querySelector('#tab-post').hidden && !document.querySelector('#nav-back').hidden && location.hash === '#post', { timeout: 10000 });
      };
      await pack();
      assert.ok(/Back to Calendar · \d{4}-\d\d-\d\d/.test(await page.$eval('#nav-back-btn', (b) => b.textContent)), 'back bar names the calendar slot');
      assert.strictEqual(await page.evaluate(() => scrollY), 0, 'the Post tab opens at its top');
      await page.evaluate(() => history.back());
      await backOnSlot();
      assert.strictEqual(await page.evaluate(() => location.hash), '#calendar');
      await pack();
      await page.click('#nav-back-btn');
      await backOnSlot();
      await page.click('.tabs button[data-tab="guide"]');
      await page.waitForFunction(() => !document.querySelector('#tab-guide').hidden, { timeout: 10000 });
      await page.click('.tabs button[data-tab="calendar"]');
      await backOnSlot();
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
    await check('site picker with 15 sites (XLePOS, a pilot, among them): grouped "Sites" and "XLeShop shops"; a shop gets its own items and the shop calendar (Facebook post starts as "no link")', async () => {
      const groups = await page.$$eval('#site optgroup', (gs) => gs.map((g) => ({ label: g.label, n: g.querySelectorAll('option').length })));
      assert.deepStrictEqual(groups.map((g) => g.label), ['Sites', 'XLeShop shops'], JSON.stringify(groups));
      assert.deepStrictEqual(groups.map((g) => g.n), [6, 9], JSON.stringify(groups));
      assert.strictEqual(await page.$$eval('#site option', (o) => o.length), 15);
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

    // ---- picker, venue chips, Post, Grow, calendar styles, Reels links, Windows switch
    const typeInto = async (sel, text) => {
      await page.click(sel);
      await page.$eval(sel, (e) => e.select());
      await page.keyboard.press('Backspace');
      if (text) await page.keyboard.type(text);
    };
    await check('picker: "mrge pdf" finds Merge PDF Files first (typo tolerant)', async () => {
      await page.click('.tabs button[data-tab="post"]');
      await typeInto('#p-tool', 'mrge pdf');
      await page.waitForSelector('#p-tool-list li.sel');
      const first = await page.$eval('#p-tool-list li.sel', (e) => e.dataset.path);
      assert.strictEqual(first, '/pdf/merge-pdf/');
    });
    await check('Post: Shorts pack for Merge PDF Files has Title, Description, Tags and the YouTube guides', async () => {
      await page.click('#p-tool-list li.sel[data-path="/pdf/merge-pdf/"]');
      await page.waitForSelector('#p-channels .tile[data-channel="youtube-shorts"]');
      const groups = await page.$$eval('#p-channels .tile-label', (x) => x.map((e) => e.textContent));
      assert.deepStrictEqual(groups, ['Video', 'Image and carousel', 'Text and chat']);
      await page.click('#p-channels .tile[data-channel="youtube-shorts"]');
      await page.waitForSelector('#p-pack .part[data-key="description"]');
      const labels = await page.$$eval('#p-pack .part .lab', (x) => x.map((e) => e.textContent));
      for (const want of ['Title', 'Description', 'Tags (comma-separated)']) assert.ok(labels.includes(want), want + ' in ' + labels.join('|'));
      const count = await page.$eval('#p-pack .part[data-key="title"] .count', (e) => e.textContent);
      assert.ok(/^\d+ \/ 100$/.test(count), count);
      const guides = await page.$$eval('#p-pack .pack-guides a', (x) => x.map((e) => e.href + '|' + e.rel + '|' + e.target));
      assert.ok(guides.length >= 2 && guides.every((g) => /noopener noreferrer\|_blank$/.test(g)) && guides.some((g) => /youtube|google/.test(g)), guides.join(' '));
      assert.ok(await page.$eval('#p-upload', (e) => /studio\.youtube\.com/.test(e.href)));
      assert.ok((await page.$$eval('#p-pack .pack-steps li', (x) => x.length)) >= 3);
      assert.ok((await page.$$eval('#p-pack .pack-check li', (x) => x.length)) >= 3);
      assert.ok((await page.$$eval('#p-pack .pack-red li', (x) => x.length)) >= 3);
    });
    await check('Post: Copy all puts every field on the clipboard; Another version changes the pack', async () => {
      await page.evaluate(() => { window.__clip = null; });
      await page.click('#p-copyall');
      const clip = await page.evaluate(() => window.__clip);
      assert.ok(/^Title:\n/.test(clip) && /Description:\n/.test(clip) && /Tags/.test(clip), String(clip).slice(0, 80));
      const all = () => page.$$eval('#p-pack .part textarea', (x) => x.map((e) => e.value).join('|'));
      const before = await all();
      await page.click('#p-another');
      await page.waitForFunction(() => /version 1/.test((document.querySelector('.pack-head') || {}).textContent || ''), { timeout: 10000 });
      assert.notStrictEqual(await all(), before);
    });
    await check('picker: an empty focused box suggests Today\'s calendar tools and Recent', async () => {
      await typeInto('#p-tool', '');
      await page.waitForFunction(() => { const g = [...document.querySelectorAll('#p-tool-list li.grp')].map((e) => e.textContent); return g.includes('Recent') && g.includes('Today\'s calendar') && g.includes('Popular by section'); }, { timeout: 10000 });
      const recent = await page.evaluate(() => { const li = [...document.querySelectorAll('#p-tool-list li')]; const i = li.findIndex((e) => e.textContent === 'Recent'); return li[i + 1].dataset.path; });
      assert.strictEqual(recent, '/pdf/merge-pdf/');
      await page.keyboard.press('Escape');
    });
    await check('picker: Browse all lists the sections; picking a tool fills #d-tool and loads the draft', async () => {
      await page.click('.tabs button[data-tab="draft"]');
      await page.click('#d-picker .browse-btn');
      await page.waitForSelector('#d-picker .browse:not([hidden]) .browse-chips .chip');
      const chips = await page.$$eval('#d-picker .browse-chips .chip', (x) => x.map((e) => e.textContent));
      assert.ok(chips[0] === 'All' && chips.includes('PDF Tools') && chips.length >= 5, chips.join('|'));
      await page.click('#d-picker .browse-chips .chip[data-sec="pdf"]');
      await page.waitForSelector('#d-picker .browse-grid .bt[data-path="/pdf/compress-pdf/"], #d-picker .browse-grid .bt[data-path="/pdf/merge-pdf/"]');
      const allPdf = await page.$$eval('#d-picker .browse-grid .bt', (x) => x.every((e) => /^\/pdf\//.test(e.dataset.path)));
      assert.ok(allPdf);
      await page.type('#d-picker .browse-q', 'merge');
      await page.waitForFunction(() => document.querySelectorAll('#d-picker .browse-grid .bt').length >= 1 && document.querySelector('#d-picker .browse-grid .bt').dataset.path === '/pdf/merge-pdf/');
      await page.click('#d-picker .browse-grid .bt[data-path="/pdf/merge-pdf/"]');
      assert.strictEqual(await page.$eval('#d-tool', (e) => e.value), 'Merge PDF Files');
      assert.ok(await page.$eval('#d-picker .browse', (e) => e.hidden));
      await page.waitForFunction(() => document.querySelectorAll('#d-parts .part').length >= 1, { timeout: 15000 });
    });
    await check('picker: Escape closes the Browse all panel; arrows and Enter pick from the list', async () => {
      await page.click('#d-picker .browse-btn');
      await page.waitForSelector('#d-picker .browse:not([hidden])');
      await page.keyboard.press('Escape');
      assert.ok(await page.$eval('#d-picker .browse', (e) => e.hidden));
      await typeInto('#d-tool', 'compress');
      await page.waitForSelector('#d-tool-list li.sel');
      await page.keyboard.press('ArrowDown');
      const second = await page.$eval('#d-tool-list li.sel.on', (e) => e.dataset.path);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#d-tool-list').hidden);
      const chosen = await page.$eval('#d-tool', (e) => e.value);
      assert.ok(chosen && chosen.toLowerCase().includes('compress'), chosen);
      assert.ok(second && second !== '/pdf/merge-pdf/' || chosen.length > 3);
      await typeInto('#d-tool', 'merge pdf');
      await page.waitForSelector('#d-tool-list li.sel[data-path="/pdf/merge-pdf/"]');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelectorAll('#d-parts .part').length >= 1);
      assert.strictEqual(await page.$eval('#d-tool', (e) => e.value), 'Merge PDF Files');
    });
    await check('Draft: the top venues show as chips; a chip sets the venue select', async () => {
      await page.waitForFunction(() => document.querySelectorAll('#d-venue-chips .vchip').length >= 5, { timeout: 15000 });
      const n = await page.$$eval('#d-venue-chips .vchip', (x) => x.length);
      assert.ok(n >= 5 && n <= 8, 'chips ' + n);
      assert.ok(await page.$eval('#d-venue-chips .vchip .badge', (e) => /low|medium|high/.test(e.textContent)));
      const id = await page.$eval('#d-venue-chips .vchip:last-child', (e) => e.dataset.venue);
      await page.click('#d-venue-chips .vchip:last-child');
      await page.waitForFunction((v) => document.querySelector('#d-venue').value === v && document.querySelector('#d-venue-chips .vchip.on').dataset.venue === v, { timeout: 10000 }, id);
    });
    await check('Grow: three moves, experiment, style of the day and the playbook; a move opens its desk tab', async () => {
      await page.click('.tabs button[data-tab="grow"]');
      await page.waitForSelector('#gw-moves .gw-card');
      assert.strictEqual(await page.$$eval('#gw-moves .gw-card', (x) => x.length), 3);
      assert.ok(await page.$$eval('#gw-moves .gw-card', (x) => x.every((c) => c.querySelector('.badge') && c.querySelector('.what').textContent.length > 20 && c.querySelectorAll('li').length >= 2)));
      assert.ok(await page.$('#gw-experiment .gw-card'));
      assert.ok(/./.test(await page.$eval('#gw-style', (e) => e.textContent)));
      assert.ok((await page.$$eval('#gw-playbook details.gw-sec', (x) => x.length)) >= 6);
      assert.ok((await page.$$eval('#gw-playbook details.gw-sec .gw-card', (x) => x.length)) >= 15);
      assert.ok(await page.$('#gw-prepare') && await page.$('#gw-next .moment'));
    });
    await check('Grow: viral angles for a tool - hooks with Copy and Make this reel, series, challenge, proof', async () => {
      await typeInto('#gw-tool', 'mrge pdf');
      await page.waitForSelector('#gw-tool-list li.sel');
      await page.waitForSelector('#gw-tool-list li.sel.on[data-path="/pdf/merge-pdf/"]');
      await page.keyboard.press('Enter');
      await page.waitForSelector('#gw-angles .gw-hooks .hook').catch(async (e) => { throw new Error(e.message + ' :: ' + await page.$eval('#gw-angles', (b) => b.textContent.slice(0, 200)) + ' :: ' + await page.$eval('#gw-tool', (b) => b.value)); });
      assert.strictEqual(await page.$$eval('#gw-angles .hook', (x) => x.length), 10);
      assert.ok(await page.$eval('#gw-angles .hook a.btn', (e) => /reel-maker\/\?tool=%2Fpdf%2Fmerge-pdf%2F&style=/.test(e.href) && e.target === '_blank'));
      await page.evaluate(() => { window.__clip = null; });
      await page.click('#gw-angles .hook .copy');
      assert.ok(/merge/i.test(await page.evaluate(() => window.__clip)));
      assert.ok((await page.$$eval('#gw-series .angle', (x) => x.length)) >= 2);
      assert.ok(/MergePDFChallenge/.test(await page.$eval('#gw-challenge', (e) => e.textContent)));
      assert.ok((await page.$$eval('#gw-proof .badge', (x) => x.length)) >= 2);
      assert.ok((await page.$$eval('#gw-styles a', (x) => x.length)) >= 8);
    });
    await check('Today: one "Growth move of the day" card links to the Grow tab', async () => {
      await page.click('.tabs button[data-tab="today"]');
      await page.waitForSelector('#plan-grow .today-grow');
      assert.strictEqual(await page.$$eval('#plan-grow .today-grow', (x) => x.length), 1);
      const moveTitle = await page.$eval('#plan-grow b', (e) => e.textContent);
      await page.click('#plan-grow .today-grow button');
      await page.waitForSelector('#tab-grow:not([hidden]) #gw-moves');
      assert.ok(await page.$$eval('#gw-moves h3', (x, t) => x.some((e) => e.textContent === t), moveTitle));
    });
    await check('Reels: each tool row has Speed run, Myth vs fact, POV and Surprise me links', async () => {
      await page.click('.tabs button[data-tab="reels"]');
      await page.waitForSelector('#r-sections .reel');
      const live = await page.$('#r-sections .reel .reel-links');
      if (!live) return; // the Reel Maker is not live in this setup: the rows show the switched-off button
      const links = await page.$eval('#r-sections .reel .reel-links', (box) => [...box.querySelectorAll('.reel-style')].map((e) => e.textContent + '|' + e.getAttribute('href')));
      assert.deepStrictEqual(links.map((l) => l.split('|')[0]), ['Speed run', 'Myth vs fact', 'POV', 'Surprise me']);
      assert.ok(/&style=speedrun$/.test(links[0]) && /&style=myth$/.test(links[1]) && /&style=pov$/.test(links[2]) && /&style=(speedrun|beforeafter|myth|mistakes|pov|stop|quiz|countdown|hottake|thisorthat|tutorial)$/.test(links[3]), links.join(' '));
    });
    await check('Calendar: a slot shows its style badge, "Another style" changes it, and Pack opens the Post tab', async () => {
      await page.click('.tabs button[data-tab="calendar"]');
      await page.waitForSelector('#cal-weeks .cal-item.is-today .cal-style');
      const sid = await page.$eval('#cal-weeks .cal-item.is-today', (e) => e.dataset.id);
      const sel = '#cal-weeks .cal-item[data-id="' + sid + '"]';
      const before = await page.$eval(sel + ' .cal-style', (e) => e.textContent);
      assert.ok(before.length > 2 && (await page.$eval(sel + ' .cal-style', (e) => e.title.length)) > 10);
      await page.click(sel + ' .cal-restyle');
      await page.waitForFunction((s, b) => { const e = document.querySelector(s + ' .cal-style'); return e && e.textContent !== b; }, { timeout: 10000 }, sel, before);
      const after = await page.$eval(sel + ' .cal-style', (e) => e.textContent);
      assert.notStrictEqual(after, before);
      const reel = await page.$eval(sel + ' .cal-actions a.btn', (e) => e.href);
      assert.ok(/style=/.test(reel) || after === 'Full story', reel);
      await page.click(sel + ' .tg[data-channel="instagram-reel"] .tg-pack');
      await page.waitForSelector('#tab-post:not([hidden]) #p-pack .part[data-key]', { timeout: 15000 });
      assert.ok(await page.$eval('#p-channels .tile.on', (e) => e.dataset.channel === 'instagram-reel'));
      assert.ok((await page.$eval('#p-tool', (e) => e.value)).length > 2);
    });
    await check('Start with Windows: the switch creates and removes the Startup shortcut (temp folders)', async () => {
      await page.click('.tabs button[data-tab="today"]');
      if (process.platform !== 'win32') { assert.ok(await page.$eval('#autostart', (e) => e.hidden)); return; }
      await page.waitForFunction(() => !document.getElementById('autostart').hidden, { timeout: 10000 });
      const lnk = path.join(STARTUP, '1234Tools Promotion Desk.lnk');
      assert.ok(!fs.existsSync(lnk));
      await page.click('#as-on');
      for (let i = 0; i < 100 && !fs.existsSync(lnk); i++) await sleep(100);
      assert.ok(fs.existsSync(lnk), 'shortcut not created');
      assert.ok(await page.$eval('#as-on', (e) => e.checked));
      await page.click('#as-on');
      for (let i = 0; i < 100 && fs.existsSync(lnk); i++) await sleep(100);
      assert.ok(!fs.existsSync(lnk), 'shortcut not removed');
      assert.ok(await page.$eval('#as-on', (e) => !e.checked));
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
    fs.rmSync(STARTUP, { recursive: true, force: true });
    fs.rmSync(PROGRAMS, { recursive: true, force: true });
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
