#!/usr/bin/env node
/**
 * The currency converter with its longer list (engine/fx.bundle.js COMMON,
 * 158 currencies from October 2026), in headless Chrome:
 *
 *   node build/tests/currency-list.js [--root DIR] [--port 8833]
 *
 *  1  a rates file that lacks some listed currencies (the fallback feed has
 *     no KPW or SVC): those two are greyed out as "(no rate today)" and the
 *     rest still convert;
 *  2  a rates copy cached on the device while the list was shorter is
 *     fetched again once, even inside its six hours;
 *  3  a fresh copy saved with the current list is used without a fetch.
 *
 * Every request off 127.0.0.1 is refused. Exit code 2 when a case fails.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
function loadPuppeteer() {
  for (const p of [path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) { try { return require(p); } catch (e) { /* next */ } }
  return null;
}
const puppeteer = loadPuppeteer();
const { serve } = require('./serve.js');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..'))), PORT = Number(arg('--port', 8833)), BASE = 'http://127.0.0.1:' + PORT;
  if (!puppeteer) { console.log('SKIP  puppeteer-core not found'); process.exit(1); }
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const rates = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/rates.json'), 'utf8'));
  const fx = fs.readFileSync(path.join(ROOT, 'engine/fx.bundle.js'), 'utf8');
  const listed = [...(/var COMMON = \{([\s\S]*?)\};/.exec(fx)[1]).matchAll(/\b([A-Z]{3}):/g)].length;
  const thin = JSON.parse(JSON.stringify(rates)); delete thin.rates.KPW; delete thin.rates.SVC;
  const res = [];
  try {
    // 1: a rates file without KPW and SVC: both greyed, the rest convert
    let p = await browser.newPage();
    await p.setBypassServiceWorker(true);
    await p.setRequestInterception(true);
    let hits = 0;
    p.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith(BASE)) return r.abort();
      if (/\/assets\/rates\.json/.test(u)) { hits++; return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(thin) }); }
      r.continue();
    });
    await p.goto(BASE + '/business/currency-converter/', { waitUntil: 'load' });
    await p.waitForSelector('.result-primary');
    const a = await p.evaluate(() => {
      const s = document.getElementById('fx-from');
      const off = [...s.options].filter((o) => o.disabled).map((o) => o.textContent);
      s.value = 'MVR'; s.dispatchEvent(new Event('change', { bubbles: true }));
      return { off, n: s.options.length, out: document.querySelector('.result-primary').textContent, err: (document.querySelector('.io-msg') || {}).className };
    });
    res.push(['thin file: KPW and SVC greyed, MVR converts', a.n === listed && a.off.length === 2 && a.off.every((t) => /\(no rate today\)$/.test(t)) && /MVR/.test(a.out), JSON.stringify(a)]);
    // 2: a fresh cache saved with the old 58-currency list is refetched once
    await p.evaluate((r) => { localStorage.setItem('mvr-fx-v2', JSON.stringify({ rates: r, base: 'USD', date: 'old', source: 'x', fetchedAt: Date.now(), listed: 58 })); }, { USD: 1, GBP: 0.8 });
    hits = 0;
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('.result-primary');
    const b = await p.evaluate(() => JSON.parse(localStorage.getItem('mvr-fx-v2')).listed);
    res.push(['a cache from the 58-currency list is refetched', hits === 1 && b === listed, 'fetches ' + hits + ', listed now ' + b]);
    // 3: and a fresh cache with the current list is not
    hits = 0;
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('.result-primary');
    res.push(['a fresh cache with the current list is used, no fetch', hits === 0, 'fetches ' + hits]);
    await p.close();
  } finally { await browser.close(); server && server.close(); }
  res.forEach((r) => console.log((r[1] ? 'PASS' : 'FAIL') + '  ' + r[0] + (r[1] ? '' : '   (' + r[2] + ')')));
  const failed = res.filter((r) => !r[1]).length;
  console.log('\n' + (res.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
