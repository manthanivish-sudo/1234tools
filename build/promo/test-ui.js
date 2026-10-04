'use strict';
/**
 * Browser test for the Promotion Desk UI (puppeteer-core + local Chrome).
 *   node build/promo/test-ui.js
 * Serves the desk on 127.0.0.1:8798 with a temporary PROMO_HOME and a pinned
 * Tuesday (PROMO_NOW), drives Draft, Today, Kits, Venues and Log, and checks
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
const PORT = 8798;
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

(async () => {
  const server = await desk.serve(PORT);
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
    await check('Kits generates 4 PNGs of the right size into PROMO_HOME', async () => {
      await page.click('.tabs button[data-tab="kits"]');
      await page.type('#k-tool', 'merge pdf');
      await page.waitForSelector('#k-tool-list li[data-path="/pdf/merge-pdf/"]');
      await page.click('#k-tool-list li[data-path="/pdf/merge-pdf/"]');
      await page.click('#k-go');
      await page.waitForSelector('#k-new img', { timeout: 90000 });
      const dir = path.join(TMP, 'kits', 'merge-pdf');
      const want = { 'square-1080.png': [1080, 1080], 'pin-1000x1500.png': [1000, 1500], 'story-1080x1920.png': [1080, 1920], 'wide-1200x630.png': [1200, 630] };
      for (const [f, [w, h]] of Object.entries(want)) {
        const buf = fs.readFileSync(path.join(dir, f));
        assert.deepStrictEqual(kit.pngSize(buf), { w, h }, f);
      }
      assert.ok(fs.readFileSync(path.join(dir, 'kit.md'), 'utf8').includes('# Launch kit: Merge PDF Files'));
      const imgs = await page.$$eval('#k-new img', (xs) => xs.map((i) => i.naturalWidth));
      assert.strictEqual(imgs.length, 4);
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
