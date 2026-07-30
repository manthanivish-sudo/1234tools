/**
 * Consent-gate regression test, run against the deployed site.
 *
 * The privacy and cookie pages make a hard promise: no third party is contacted
 * before the visitor opts in. That promise is only as good as the last time it
 * was checked, and a change to the banner, to build-site.js or to a tool page
 * could break it without anything looking wrong. This is how you check.
 *
 * It drives the Chrome already installed on the machine, so there is no
 * bundled browser. One dependency, not committed:
 *
 *   npm install puppeteer-core
 *   node build/consent-check.js
 *
 * Each scenario runs in a fresh incognito context, because localStorage
 * persists a stored choice and would otherwise leak between them -- a repeat
 * visit after accepting loads both trackers immediately and with no banner,
 * which looks exactly like a broken gate if you forget that.
 *
 * Lives in build/ because that is package source, not site output: robots.txt
 * disallows it and build-site.js skips the directory.
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'https://www.1234tools.com/';
const TRACKERS = /googletagmanager\.com|clarity\.ms|google-analytics\.com/;

let pass = 0, fail = 0;
function assert(ok, label, detail) {
  (ok ? pass++ : fail++);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
}

/** Loads the page in a clean context, runs `act`, returns tracker URLs seen. */
async function scenario(browser, name, act, opts = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const hits = [];

  page.on('request', (r) => { if (TRACKERS.test(r.url())) hits.push(r.url()); });

  if (opts.gpc) {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
    });
  }
  if (opts.dnt) {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
    });
  }

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  const result = await act(page, hits);
  await ctx.close();
  return result;
}

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/** The banner is built with plain buttons; find one by its text. */
async function clickByText(page, text) {
  const handle = await page.evaluateHandle((t) => {
    const b = [...document.querySelectorAll('.cc button')].find(
      (x) => x.textContent.trim() === t
    );
    return b || null;
  }, text);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  return true;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  console.log('\nConsent gate — live site (' + URL + ')\n');

  /* 1. First visit, no interaction ------------------------------------ */
  console.log('1. First visit, banner showing, nothing clicked');
  await scenario(browser, 'fresh', async (page, hits) => {
    await settle(3000);
    const hasBanner = await page.$('.cc') !== null;
    assert(hasBanner, 'consent banner is shown');
    assert(hits.length === 0, 'ZERO tracker requests before consent',
      hits.length ? hits.join(', ') : 'none seen');
  });

  /* 2. Decline -------------------------------------------------------- */
  console.log('\n2. Clicking "No thanks"');
  await scenario(browser, 'decline', async (page, hits) => {
    const clicked = await clickByText(page, 'No thanks');
    assert(clicked, 'decline button found and clicked');
    await settle(3000);
    assert(hits.length === 0, 'ZERO tracker requests after declining',
      hits.length ? hits.join(', ') : 'none seen');
    const stored = await page.evaluate(() => localStorage.getItem('1234tools-consent'));
    assert(stored === 'denied', 'decline is stored', 'value=' + stored);
    await page.reload({ waitUntil: 'networkidle2' });
    await settle(2000);
    assert(hits.length === 0, 'still zero after a reload',
      hits.length ? hits.join(', ') : 'none seen');
    const banner = await page.$('.cc');
    assert(banner === null, 'banner does not reappear');
  });

  /* 3. Accept --------------------------------------------------------- */
  console.log('\n3. Clicking "Allow"');
  await scenario(browser, 'accept', async (page, hits) => {
    const clicked = await clickByText(page, 'Allow');
    assert(clicked, 'allow button found and clicked');
    await settle(5000);
    const gtm = hits.some((u) => /googletagmanager\.com/.test(u));
    const clarity = hits.some((u) => /clarity\.ms/.test(u));
    assert(gtm, 'googletagmanager loads after consent');
    assert(clarity, 'clarity loads after consent');
    const stored = await page.evaluate(() => localStorage.getItem('1234tools-consent'));
    assert(stored === 'granted', 'consent is stored', 'value=' + stored);
    const id = hits.find((u) => /googletagmanager\.com/.test(u)) || '';
    assert(id.includes('G-BJWYN6QS86'), 'correct GA4 id in the request',
      id.slice(0, 90));
  });

  /* 4. Global Privacy Control ----------------------------------------- */
  console.log('\n4. Global Privacy Control set');
  await scenario(browser, 'gpc', async (page, hits) => {
    await settle(3000);
    const banner = await page.$('.cc');
    assert(banner === null, 'no banner is shown at all (never asks)');
    assert(hits.length === 0, 'ZERO tracker requests under GPC',
      hits.length ? hits.join(', ') : 'none seen');
  }, { gpc: true });

  /* 5. Do Not Track ---------------------------------------------------- */
  console.log('\n5. Do Not Track set');
  await scenario(browser, 'dnt', async (page, hits) => {
    await settle(3000);
    const banner = await page.$('.cc');
    assert(banner === null, 'no banner is shown at all');
    assert(hits.length === 0, 'ZERO tracker requests under DNT',
      hits.length ? hits.join(', ') : 'none seen');
  }, { dnt: true });

  /* 6. Masking, on a tool page that produces results -------------------- */
  console.log('\n6. Masking on a tool page after consent');
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.goto('https://www.1234tools.com/finance/compound-interest.html',
    { waitUntil: 'networkidle2', timeout: 60000 });
  await clickByText(page, 'Allow');
  await settle(3000);
  const masking = await page.evaluate(() => {
    const fields = [...document.querySelectorAll('input, textarea, select')];
    const unmasked = fields.filter((f) => f.getAttribute('data-clarity-mask') !== 'true');
    return { total: fields.length, unmasked: unmasked.length };
  });
  assert(masking.total > 0, 'page has form fields', masking.total + ' found');
  assert(masking.unmasked === 0, 'every form field carries data-clarity-mask',
    masking.unmasked + ' unmasked');
  await ctx.close();

  await browser.close();
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
