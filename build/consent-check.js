/**
 * Consent-gate regression test.
 *
 * The privacy and cookie pages make a hard promise: no third party is contacted
 * before the visitor opts in, and nothing the visitor types is ever recorded.
 * That promise is only as good as the last time it was checked, and a change to
 * the banner, to build-site.js or to a tool page could break it without
 * anything looking wrong. This is how you check.
 *
 * It drives the Chrome already installed on the machine, so there is no
 * bundled browser. One dependency, not committed:
 *
 *   npm install puppeteer-core
 *   node build/consent-check.js              scenarios 1-5 live, then sweep
 *   node build/consent-check.js --sweep-only just the masking sweep
 *   node build/consent-check.js --live-sweep sweep the deployed site instead
 *
 * Two halves, deliberately pointed at different things:
 *
 *   Scenarios 1-5 run against the DEPLOYED site, because the question they ask
 *   is "does the gate visitors actually meet still hold".
 *
 *   The masking sweep (6) runs against the WORKING TREE over a local server,
 *   because the question it asks is "does what I am about to push mask
 *   everything", and answering that for 1,218 pages over the network would take
 *   the better part of an hour. --live-sweep points it at production instead.
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
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'https://www.1234tools.com/';
const TRACKERS = /googletagmanager\.com|clarity\.ms|google-analytics\.com/;

const ROOT = path.join(__dirname, '..');
const SWEEP_ONLY = process.argv.includes('--sweep-only');
const LIVE_SWEEP = process.argv.includes('--live-sweep');
const CONSENT_KEY = '1234tools-consent';

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

/* ------------------------------------------------------------------ */
/* masking sweep                                                      */
/* ------------------------------------------------------------------ */

/**
 * What must never reach a session replay. Note this list is deliberately NOT
 * the MASK list in assets/analytics.js: checking a page against the same
 * selectors that masked it only proves setAttribute works. This is the wider,
 * independent definition -- anything that holds what a visitor typed or what a
 * tool produced -- so a page that grows a field the masker does not know about
 * fails here, which is the whole point of sweeping all 1,218.
 */
const SENSITIVE = [
  'input:not([type="hidden"])', 'textarea', 'select', 'canvas',
  '[contenteditable]:not([contenteditable="false"])',
  '[class*="result"]', '[class*="output"]', '[class*="readout"]',
  '[class*="preview"]', '[class*="io-"]', '[class*="file-name"]',
  '[class*="stat-val"]', '[class*="page-grid"]', '[class*="display"]',
  '#recent-tools'
].join(',');

/**
 * Chrome, not data: action bars, pane headings and static labels match the
 * substrings above but hold button text, never anything a visitor typed.
 * Masking them would cost real replay detail and buy no privacy, so they are
 * excluded from the sweep rather than added to MASK.
 */
const UI_FURNITURE = /(^|-)(actions?|head|label|btn|button|toolbar|tabs?|nav|legend|title|hint)(-|$)/;

/** Every deployed page, matching build-site.js's own walk. */
function sitePages(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'build' || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) sitePages(abs, out);
    else if (e.name.endsWith('.html')) out.push(path.relative(ROOT, abs).replace(/\\/g, '/'));
  }
  return out;
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.wasm': 'application/wasm',
  '.xml': 'application/xml', '.txt': 'text/plain'
};

/** Serves the working tree, so the sweep tests what is about to be pushed. */
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const abs = path.join(ROOT, rel);
      /* Refuse to serve outside the tree even though this only ever listens on
         loopback -- a path-traversal hole in a test is still a hole. */
      if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream' });
      fs.createReadStream(abs).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/**
 * Checks one page with consent already granted. Tracker requests are aborted at
 * the network layer: masking only happens on the consented path, but actually
 * letting 1,218 page views reach GA4 would corrupt the property this test
 * exists to protect. analytics.js masks before it injects either tag, so
 * killing the request changes nothing about what is being measured here.
 */
async function sweepPage(ctx, base, rel) {
  const page = await ctx.newPage();
  try {
    await page.evaluateOnNewDocument((k) => {
      try { localStorage.setItem(k, 'granted'); } catch (e) {}
    }, CONSENT_KEY);

    await page.setRequestInterception(true);
    const escaped = [], thirdParty = [];
    page.on('request', (r) => {
      const url = r.url();
      if (TRACKERS.test(url)) { escaped.push(url); r.abort().catch(() => {}); return; }
      /* Anything else leaving the origin is a third party contacted regardless
         of consent -- which is precisely what privacy/index.html promises does
         not happen. data: and blob: have no host and are not requests off the
         machine. This caught the currency converter calling cdn.jsdelivr.net on
         load, which made that promise false on one page for months. */
      try {
        const h = new URL(url).hostname;
        if (h && h !== '127.0.0.1' && h !== 'localhost') thirdParty.push(h);
      } catch (e) {}
      r.continue().catch(() => {});
    });

    await page.goto(base + rel, { waitUntil: 'load', timeout: 30000 });
    await settle(200);

    /* Results are built after load, so the masker leans on a MutationObserver.
       Probing it per page is what proves the dynamic path is live here and not
       just on the one page that used to be tested. */
    const dynamic = await page.evaluate(async (sel, chromeSrc) => {
      const chrome = new RegExp(chromeSrc);
      const probe = document.createElement('input');
      probe.setAttribute('data-sweep-probe', '1');
      document.body.appendChild(probe);
      await new Promise((r) => setTimeout(r, 120));
      const masked = probe.getAttribute('data-clarity-mask') === 'true';
      probe.remove();

      const classesOf = (n) => (n.className && typeof n.className === 'string')
        ? n.className.trim().split(/\s+/) : [];

      /* Only elements that hold text of their own can leak it. A grid or row
         whose values are masked is not a finding -- and if one of its children
         is genuinely exposed, that child matches on its own account. This is
         what keeps the report down to real leaks instead of every wrapper. */
      const ownText = (n) => [...n.childNodes]
        .some((c) => c.nodeType === 3 && c.textContent.trim() !== '');

      const bad = [...document.querySelectorAll(sel)]
        .filter((n) => !n.closest('.cc'))
        .filter((n) => !classesOf(n).some((c) => chrome.test(c)))
        .filter((n) => n.getAttribute('data-clarity-mask') !== 'true')
        /* Clarity masks a masked element's whole subtree, so an exposed-looking
           node under one is already covered. */
        .filter((n) => !n.parentElement || !n.parentElement.closest('[data-clarity-mask="true"]'))
        .filter(ownText)
        .map((n) => {
          const cs = classesOf(n);
          return n.tagName.toLowerCase() + (cs.length ? '.' + cs.join('.') : '');
        });

      return {
        total: document.querySelectorAll(sel).length,
        unmasked: [...new Set(bad)],
        observerLive: masked
      };
    }, SENSITIVE, UI_FURNITURE.source);

    return { rel, ...dynamic, attempted: escaped, thirdParty: [...new Set(thirdParty)] };
  } catch (e) {
    return { rel, error: e.message };
  } finally {
    await page.close().catch(() => {});
  }
}

/** Runs the sweep with a small pool -- 1,218 serial page loads is a coffee break. */
async function sweep(browser) {
  const list = sitePages();
  let server = null, base;
  if (LIVE_SWEEP) {
    base = URL;
  } else {
    server = await serve();
    base = `http://127.0.0.1:${server.address().port}/`;
  }

  console.log(`\n6. Masking sweep — all ${list.length} pages ` +
    `(${LIVE_SWEEP ? 'deployed site' : 'working tree via ' + base})`);

  const ctx = await browser.createBrowserContext();
  const queue = list.slice();
  const failures = [], errors = [];
  let done = 0, noObserver = 0, fieldsSeen = 0, consentRan = 0;
  const offOrigin = new Map();

  const worker = async () => {
    for (;;) {
      const rel = queue.shift();
      if (!rel) return;
      const r = await sweepPage(ctx, base, rel);
      done++;
      if (r.error) errors.push(r);
      else {
        fieldsSeen += r.total;
        if (r.unmasked.length) failures.push(r);
        if (!r.observerLive) noObserver++;
        if (r.attempted.length) consentRan++;
        r.thirdParty.forEach((h) => {
          if (!offOrigin.has(h)) offOrigin.set(h, []);
          offOrigin.get(h).push(r.rel);
        });
      }
      if (done % 200 === 0) process.stdout.write(`     … ${done}/${list.length}\n`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  await ctx.close();
  if (server) server.close();

  assert(errors.length === 0, `all ${list.length} pages loaded`,
    errors.length ? `${errors.length} failed, first: ${errors[0].rel} — ${errors[0].error}` : 'no load errors');
  /* Every page must have tried to load a tag and been stopped. If a page never
     tried, analytics.js did not run there, and its masking result would be a
     false pass rather than a real one. */
  assert(consentRan === list.length, 'the consented path ran on every page',
    `${consentRan}/${list.length} attempted a tag load (all aborted before leaving the machine)`);
  assert(fieldsSeen > 0, 'sweep actually found fields to check', fieldsSeen + ' across the site');
  /* The privacy and cookie pages both promise this outright. Asserting it
     across every page is the only way that promise stays true by accident
     rather than by luck. */
  assert(offOrigin.size === 0, 'no page contacts a third party on load',
    offOrigin.size
      ? [...offOrigin.entries()].map(([h, p]) => `${h} (${p.length} page(s), e.g. ${p[0]})`).join('; ')
      : 'nothing left the origin but the aborted tags');
  assert(noObserver === 0, 'the mask observer is live on every page',
    noObserver ? noObserver + ' page(s) did not mask a node added after load' : 'probe masked everywhere');
  assert(failures.length === 0, `every sensitive element is masked on all ${list.length} pages`,
    failures.length ? `${failures.length} page(s) with unmasked fields` : 'none unmasked');

  if (failures.length) {
    /* Grouped by offending element, not by page. A missing selector shows up on
       every page that uses the shell, and 1,218 near-identical lines hide how
       many distinct problems there actually are -- usually one or two. */
    const byElement = new Map();
    failures.forEach((f) => f.unmasked.forEach((u) => {
      if (!byElement.has(u)) byElement.set(u, []);
      byElement.get(u).push(f.rel);
    }));

    console.log(`\n  ${byElement.size} distinct unmasked element(s), ` +
                `across ${failures.length} page(s):\n`);
    [...byElement.entries()].sort((a, b) => b[1].length - a[1].length)
      .forEach(([el, pgs]) => {
        console.log(`    ${el}`);
        console.log(`        on ${pgs.length} page(s), e.g. ${pgs.slice(0, 3).join(', ')}`);
      });
    console.log('\n  Fix by adding the selector to MASK in assets/analytics.js,');
    console.log('  or by narrowing SENSITIVE here if it is chrome rather than data.\n');
  }
}

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

  if (SWEEP_ONLY) {
    await sweep(browser);
    await browser.close();
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  }

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

  /* 6. Masking, swept across every page --------------------------------- */
  await sweep(browser);

  await browser.close();
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
