#!/usr/bin/env node
/**
 * The version line at the foot of every page, in headless Chrome.
 *
 *   node build/tests/version.js --port 8712 --root E:/path/to/site [--out DIR]
 *
 * The test serves --root on --port with its own small server (not
 * build/tests/serve.js: it must swap in a newer sw.js and version record
 * half-way, without writing to --root), so the port must be free.
 * build/tests/footer.js checks the markup on every page; this checks what a
 * visitor sees:
 *
 *   a. the record is this release's: assets/version.js's v is sw.js's
 *      1234tools-vNNN (build/release.js writes both; a build that bumps sw.js
 *      without the record fails here)
 *   b. with JavaScript off the line is there, empty, and as tall as when it
 *      is filled: no text, and nothing moves when the script fills it
 *   c. on a first visit, and then on one page of every kind (home, a tool,
 *      a conversion, an AI tool, a PDF tool, About, Settings), the line reads
 *      "Version N · D Mon YYYY" from the record, and once the service worker
 *      controls the page /assets/version.js comes from it, out of the cache
 *      named 1234tools-vN
 *   d. with the server gone, pages visited once still show "Version N"
 *   e. a newer release on the server (sw.js and the record both N+1): once
 *      the browser checks for it, the line still says N (what this page is
 *      running) and offers "Update ready — reload" as a real button; pressing
 *      it reloads into N+1
 *   f. at 390 px nothing scrolls sideways; screenshots of the footer at
 *      390 and 1400 px in both themes, and of the reload offer
 *   and, through all of it, no request off 127.0.0.1 from the version line,
 *   and none at all except the Firebase scripts the AI tool and Settings
 *   pages load for sign-in.
 * Exit code 2 when a check fails, 1 when the run itself breaks.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8712));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-version')));
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
const { TYPES } = require('./serve.js');

let pass = 0, fail = 0;
const fails = [];
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; fails.push(msg); console.log('  FAIL ' + msg); } };

/* ---- the record, read as the page reads it ---- */
const VSRC = fs.readFileSync(path.join(ROOT, 'assets/version.js'), 'utf8');
const SWSRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const REC = JSON.parse(/var REC = (\{[^}\n]*\});/.exec(VSRC)[1]);
const SWV = Number(/var V = '1234tools-v(\d+)';/.exec(SWSRC)[1]);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayOf = (iso) => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso); return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1]; };
const lineOf = (v) => 'Version ' + v + ' · ' + dayOf(REC.date);

/* ---- a static server whose sw.js and record can be swapped ---- */
const overrides = new Map();   /* url path -> body */
function startServer() {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const s = http.createServer((req, res) => {
      let p;
      try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); res.end(); return; }
      if (p.endsWith('/')) p += 'index.html';
      const type = TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream';
      if (overrides.has(p)) {
        const body = Buffer.from(overrides.get(p));
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-store' });
        res.end(body);
        return;
      }
      const abs = path.join(ROOT, p);
      if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
      fs.stat(abs, (err, st) => {
        if (!err && st.isDirectory()) { res.writeHead(301, { Location: p + '/' }); res.end(); return; }
        if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found: ' + p); return; }
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-store' });
        fs.createReadStream(abs).pipe(res);
      });
    });
    s.on('connection', (c) => { sockets.add(c); c.on('close', () => sockets.delete(c)); });
    s.once('error', (e) => reject(e.code === 'EADDRINUSE' ? new Error('port ' + PORT + ' is in use; this test needs its own server (pass a free --port)') : e));
    s.listen(PORT, '127.0.0.1', () => resolve({ close: () => new Promise((r) => { sockets.forEach((c) => c.destroy()); s.close(() => r()); }) }));
  });
}

const PAGES = [
  ['home', '/'],
  ['tool', '/finance/loan-payment/'],
  ['conversion', '/conversions/length/kilometer-to-mile/'],
  ['ai', '/ai/invoice-extractor/'],
  ['pdf', '/pdf/merge-pdf/'],
  ['about', '/about/'],
  ['settings', '/settings/']
].filter(([, u]) => fs.existsSync(path.join(ROOT, u, 'index.html')));

const lineText = (page) => page.evaluate(() => {
  const b = document.querySelector('[data-site-ver] .site-ver-num');
  return b ? b.textContent : null;
});
const waitLine = (page) => page.waitForFunction(() => !!document.querySelector('[data-site-ver] .site-ver-num'), { timeout: 10000 }).then(() => true, () => false);
const quiet = (page) => page.evaluate(() => document.querySelectorAll('.cc, .install-bar').forEach((n) => n.remove()));

(async () => {
  console.log('version: ' + ROOT + ' on ' + BASE);
  /* a */
  ok(Number.isInteger(REC.v) && REC.v === SWV, 'a. the record is this release\'s: assets/version.js v ' + REC.v + ' = sw.js 1234tools-v' + SWV);
  ok(/^\d{4}-\d\d-\d\d$/.test(REC.date), 'a. the record has a date (' + REC.date + ')' + (REC.built_on ? ', built on ' + REC.built_on : ''));

  let server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), '1234tools-version-'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ['--window-size=1400,1000'] });
  /* Off-host requests: none at all from the version line, and none on the
     pages without sign-in. The AI tool and Settings pages load Firebase from
     www.gstatic.com for the account themselves, which is theirs to declare. */
  const offHost = new Set(), fromVersion = new Set();
  const ACCOUNT_PAGES = new Set(['/ai/invoice-extractor/', '/settings/']);
  const watchRequests = (page) => page.on('request', (r) => {
    const u = r.url();
    if (/^(data|blob|about|chrome-extension):/.test(u) || u.startsWith(BASE + '/')) return;
    const init = r.initiator && r.initiator();
    const stack = JSON.stringify(init || {});
    if (/assets\/version\.js/.test(stack)) fromVersion.add(u);
    const at = (() => { try { return new URL(page.url()).pathname; } catch (e) { return ''; } })();
    if (!(ACCOUNT_PAGES.has(at) && /^https:\/\/www\.gstatic\.com\/firebasejs\//.test(u))) offHost.add(at + ' -> ' + u);
  });
  try {
    /* b. JavaScript off: an empty line, as tall as the filled one (measured
       on /about/ again in c, at the same width) */
    let noJs = null;
    {
      const page = await browser.newPage();
      watchRequests(page);
      await page.setJavaScriptEnabled(false);
      await page.setViewport({ width: 1400, height: 900 });
      await page.goto(BASE + '/about/', { waitUntil: 'load' });
      const off = await page.evaluate(() => {
        const b = document.querySelector('[data-site-ver]');
        return b && { text: b.textContent, h: b.getBoundingClientRect().height, legal: document.querySelector('.footer-legal').getBoundingClientRect().height };
      });
      ok(!!off && off.text === '', 'b. without JavaScript the line is there and empty' + (off ? ' ("' + off.text + '")' : ''));
      noJs = off;
      await page.close();
    }

    /* c. first visit, then a page of every kind once the worker controls them */
    const page = await browser.newPage();
    watchRequests(page);
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    ok(await waitLine(page) && await lineText(page) === lineOf(REC.v), 'c. first visit: "' + await lineText(page) + '"');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'load' });
    ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'c. the service worker controls the page after one reload');
    const keys = await page.evaluate(() => caches.keys());
    ok(keys.includes('1234tools-v' + SWV), 'c. the cache is 1234tools-v' + SWV + ' (' + keys.join(', ') + ')');
    const cached = await page.evaluate((k) => caches.open(k).then((c) => c.match('/assets/version.js')).then((r) => r ? r.text() : ''), '1234tools-v' + SWV);
    ok(cached.includes('"v":' + REC.v + ','), 'c. the worker precached this release\'s record in 1234tools-v' + SWV);

    for (const [kind, url] of PAGES) {
      let fromSw = null;
      const onResp = (r) => { if (r.url() === BASE + '/assets/version.js') fromSw = r.fromServiceWorker(); };
      page.on('response', onResp);
      await page.goto(BASE + url, { waitUntil: 'load' });
      await waitLine(page);
      page.off('response', onResp);
      const t = await lineText(page);
      ok(t === lineOf(REC.v) && fromSw === true, 'c. ' + kind + ' ' + url + ': "' + t + '", record ' + (fromSw ? 'from the service worker' : 'NOT from the service worker (' + fromSw + ')'));
      if (kind === 'about') {
        const filled = await page.evaluate(() => ({ h: document.querySelector('[data-site-ver]').getBoundingClientRect().height, legal: document.querySelector('.footer-legal').getBoundingClientRect().height }));
        ok(!!noJs && noJs.h >= 24 && Math.abs(noJs.h - filled.h) < 0.5 && Math.abs(noJs.legal - filled.legal) < 0.5,
          'b. the line is reserved: ' + (noJs && noJs.h) + ' px empty, ' + filled.h + ' px filled; legal row ' + (noJs && noJs.legal) + ' -> ' + filled.legal + ' px');
      }
    }
    ok(await page.evaluate(() => !!document.querySelector('[data-site-ver] [role="status"]') && !document.querySelector('.site-ver-update')),
      'c. no reload offered while the installed release is the newest');

    /* f. 390 px, both themes; 1400 px both themes */
    const shots = [];
    for (const [w, theme] of [[1400, 'dark'], [1400, 'light'], [390, 'dark'], [390, 'light']]) {
      await page.setViewport({ width: w, height: 900 });
      await page.goto(BASE + '/', { waitUntil: 'load' });
      await waitLine(page);
      await quiet(page);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (w === 390) ok(sw <= 390, 'f. 390 px ' + theme + ': nothing scrolls sideways (scrollWidth ' + sw + ')');
      const legal = await page.$('.footer-legal');
      const file = path.join(OUT, 'footer-' + w + '-' + theme + '.png');
      await legal.screenshot({ path: file });
      shots.push(file);
    }
    await page.setViewport({ width: 1400, height: 900 });

    /* d. the server gone: what was visited still says the installed version */
    await server.close();
    for (const url of ['/', PAGES.find((p) => p[0] === 'tool') ? PAGES.find((p) => p[0] === 'tool')[1] : '/about/']) {
      let t = null;
      try {
        await page.goto(BASE + url, { waitUntil: 'load' });
        await waitLine(page);
        t = await lineText(page);
      } catch (e) { t = 'error: ' + e.message; }
      ok(t === lineOf(REC.v), 'd. offline ' + url + ': "' + t + '"');
    }

    /* e. a newer release on the server */
    const NEXT = REC.v + 1;
    overrides.set('/sw.js', SWSRC.replace(/var V = '1234tools-v\d+';/, "var V = '1234tools-v" + NEXT + "';"));
    overrides.set('/assets/version.js', VSRC.replace(/var REC = \{[^}\n]*\};/, 'var REC = ' + JSON.stringify(Object.assign({}, REC, { v: NEXT })) + ';'));
    server = await startServer();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await waitLine(page);
    ok(await lineText(page) === lineOf(REC.v), 'e. before the browser checks, the page still runs and shows ' + REC.v);
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    const offered = await page.waitForSelector('[data-site-ver] button.site-ver-update', { timeout: 15000 }).then(() => true, () => false);
    const offer = await page.evaluate(() => {
      const b = document.querySelector('.site-ver-update');
      return b && { text: b.textContent, tag: b.tagName, type: b.type, line: document.querySelector('.site-ver-num').textContent,
        h: document.querySelector('[data-site-ver]').getBoundingClientRect().height, inStatus: !!b.closest('[role="status"]') };
    });
    ok(offered && offer.text === 'Update ready — reload' && offer.tag === 'BUTTON' && offer.type === 'button' && offer.inStatus,
      'e. a newer release offers "Update ready — reload" as a real button in a status region' + (offer ? ' ("' + offer.text + '")' : ''));
    ok(!!offer && offer.line === lineOf(REC.v), 'e. while offered, the line still says what this page runs: "' + (offer && offer.line) + '"');
    ok(!!offer && offer.h >= 24 && offer.h < 25, 'e. the offer fits the reserved line (' + (offer && offer.h) + ' px)');
    for (const [w, theme] of [[1400, 'dark'], [390, 'light']]) {
      await page.setViewport({ width: w, height: 900 });
      await quiet(page);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const file = path.join(OUT, 'footer-update-' + w + '-' + theme + '.png');
      await (await page.$('.footer-legal')).screenshot({ path: file });
      shots.push(file);
    }
    await page.setViewport({ width: 1400, height: 900 });
    if (offered) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('.site-ver-update')]);
      await waitLine(page);
      ok(await lineText(page) === lineOf(NEXT), 'e. pressing it reloads into the new release: "' + await lineText(page) + '"');
      ok(await page.evaluate(() => !document.querySelector('.site-ver-update')), 'e. after the reload nothing more is offered');
      ok((await page.evaluate(() => caches.keys())).join() === '1234tools-v' + NEXT, 'e. only the new cache is left (' + (await page.evaluate(() => caches.keys())).join(', ') + ')');
    }
    await page.close();

    ok(fromVersion.size === 0, 'the version line made no request off 127.0.0.1' + (fromVersion.size ? ': ' + [...fromVersion].slice(0, 5).join(' ') : ''));
    ok(offHost.size === 0, 'no other request left 127.0.0.1 (Firebase on the account pages aside)' + (offHost.size ? ': ' + [...offHost].slice(0, 5).join(' ') : ''));
    console.log('\nscreenshots:\n  ' + shots.join('\n  '));
  } finally {
    await browser.close();
    await server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Chrome may still hold it */ }
  }
  if (fails.length) { console.log('\nfailed:'); fails.forEach((m) => console.log('  FAIL ' + m)); }
  console.log('\nversion: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 2 : 0);
})().catch((e) => { console.error(e); console.log('\nversion: ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
