#!/usr/bin/env node
/**
 * The calculator shell (engine/render-core.js) and the wave 5 tools, in
 * Chrome: what a visitor does, checked against figures worked out here.
 *
 *   node build/tests/calc-shell.js [--root DIR] [--port 8962] [--out DIR]
 *
 *   1. EMI: charts drawn as inline SVG with a value on an arrow key; the
 *      yearly / monthly schedule toggle (20 and 240 rows); the CSV holds the
 *      raw figures; the formula filled with the reader's numbers; a slider
 *      moves the number box and the answer; per-field messages for a value
 *      over the maximum and an empty required field; save, compare, reload,
 *      remove and "Reset to example".
 *   2. Preferences: a GBP tool follows a chosen currency (labels and
 *      results); the Indian tax tool keeps rupees; the imperial preference
 *      opens BMI on ft + in and st + lb, and 5 ft 9 in, 11 st gives the BMI
 *      worked out here.
 *   3. Income tax: the computation downloads as a real PDF.
 *   4. Tip presets; percentage forms.
 *   5. Scientific calculator: typed expressions, the keypad, memory, the
 *      angle mode, history kept across a reload and emptied by Clear.
 *   6. Conversions: a mixed fraction and feet + inches typed in, the
 *      precision control, the batch list (with a bad line named), the live
 *      table following the value.
 *   7. Currency: the rate date and "fetched N hours ago" from rates.json,
 *      several amounts at once, a fee, the 90-day chart from this site.
 *   8. Each page at 390 px and 1366 px, light and dark: no sideways scroll;
 *      no console errors; no request leaves 127.0.0.1.
 *
 * Exit code 2 when a check fails, 1 when the run breaks.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const REPO = path.join(__dirname, '..', '..');
const ROOT = path.resolve(arg('--root', REPO));
const PORT = Number(arg('--port', 8962));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-calc-shell')));
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(REPO, 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found');
}
const puppeteer = loadPuppeteer();
const { serve } = require('./serve.js');

let pass = 0, fail = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (detail !== undefined && !ok ? '   (' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400) + ')' : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], external = [];
const num = (s) => Number(String(s).replace(/[^0-9.\-−]/g, '').replace('−', '-'));
const annuity = (P, a, n) => { const r = a / 1200; return P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1); };

async function open(browser, url, o) {
  o = o || {};
  /* a fresh profile for each page, so storage starts empty and survives a reload */
  const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
  const page = await ctx.newPage();
  const close = page.close.bind(page);
  page.close = async () => { await close(); await ctx.close(); };
  await page.setViewport({ width: o.w || 1366, height: 900 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(url + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push(url + ': ' + e.message));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !/^(data|blob):/.test(u)) external.push(u); });
  await page.evaluateOnNewDocument((prefs, theme) => {
    try {
      if (prefs) localStorage.setItem('1234tools.prefs', JSON.stringify({ values: prefs }));
      if (theme) localStorage.setItem('1234tools-theme', theme);
      localStorage.setItem('1234tools-install-dismissed', '1');
    } catch (e) { /* none */ }
    /* capture downloads: the anchor's name and the blob's bytes */
    window.__downloads = [];
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && /^blob:/.test(this.href)) {
        const rec = { name: this.download, href: this.href };
        window.__downloads.push(rec);
        fetch(this.href).then((r) => r.blob()).then((b) => b.arrayBuffer().then((buf) => { rec.type = b.type; rec.size = b.size; rec.head = Array.from(new Uint8Array(buf.slice(0, 5))).map((c) => String.fromCharCode(c)).join(''); return b.text(); }).then((t) => { rec.text = t.slice(0, 20000); }));
        return;
      }
      return click.call(this);
    };
  }, o.prefs || null, o.theme || null);
  await page.goto(BASE + url, { waitUntil: 'networkidle0' });
  await sleep(250);
  return page;
}
const setVal = (page, sel, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, String(v));
const results = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.tool-results .result')).map((x) => ({ label: (x.querySelector('.result-label') || {}).textContent || '', value: ((x.querySelector('.result-value') || {}).textContent || '').replace('⧉', '').trim(), cls: x.className })));
const resultOf = async (page, re) => { const r = (await results(page)).find((x) => re.test(x.label)); return r ? r.value : null; };
const clickText = (page, text, scope) => page.evaluate((t, s) => { const b = Array.from(document.querySelectorAll((s || '') + ' button')).find((x) => x.textContent.trim() === t || x.textContent.trim().indexOf(t) === 0); if (!b) return false; b.click(); return true; }, text, scope || '');

async function emi(browser) {
  const U = '/india/emi-calculator/';
  const page = await open(browser, U);
  const want = annuity(5000000, 8.5, 240);
  const v = await resultOf(page, /Monthly EMI/i);
  check(Math.abs(num(v) - want) < 0.01, 'EMI page: ₹50 lakh, 8.5%, 20 years shows ₹43,391.16', v);
  const charts = await page.evaluate(() => Array.from(document.querySelectorAll('.ch-box')).map((b) => ({ svg: !!b.querySelector('svg'), title: (b.querySelector('.ch-title') || {}).textContent })));
  check(charts.length >= 2 && charts.every((c) => c.svg), 'EMI page: charts are inline SVG (' + charts.length + ')', charts);
  /* a value on an arrow key */
  const tip = await page.evaluate(async () => {
    const stage = document.querySelector('.ch-box [tabindex], .ch-box svg');
    if (!stage) return null;
    stage.focus();
    stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    const t = document.querySelector('.ch-tip');
    return t && !t.hidden ? t.textContent : null;
  });
  check(tip && /₹|\d/.test(tip), 'EMI page: an arrow key on a chart shows a value', tip);
  /* schedule views */
  const rowsNow = () => page.evaluate(() => { const t = document.querySelector('.tool-table table, table.schedule'); return t ? t.tBodies[0].rows.length : 0; });
  check((await rowsNow()) === 20, 'EMI page: yearly schedule of 20 rows', await rowsNow());
  await clickText(page, 'Monthly');
  await sleep(150);
  check((await rowsNow()) === 240, 'EMI page: monthly view of 240 rows', await rowsNow());
  await clickText(page, 'Download CSV');
  await sleep(400);
  const csv = await page.evaluate(() => window.__downloads.find((d) => /\.csv$/.test(d.name)));
  const lines = csv && csv.text ? csv.text.trim().split(/\r?\n/) : [];
  const first = lines[1] ? lines[1].split(',') : [];
  const i1 = 5000000 * 8.5 / 1200;
  check(lines.length === 242 || lines.length === 241, 'EMI page: the monthly CSV has a header and 240 months (+ total)', lines.length);
  check(first.length >= 4 && Math.abs(Number(first[2]) - i1) < 0.01, 'EMI page: CSV month 1 interest is the raw ₹35,416.67 (no symbols)', lines[1]);
  await clickText(page, 'Yearly');
  /* filled formula */
  const filled = await page.evaluate(() => { const f = document.querySelector('.formula-filled'); return f && !f.hidden ? f.innerText : ''; });
  check(/43,391\.16/.test(filled) && /50,00,000/.test(filled), 'EMI page: the formula is filled with the reader’s numbers', filled.slice(0, 200));
  /* slider */
  await page.evaluate(() => { const s = document.querySelector('#in-rate').closest('.field').querySelector('input[type=range]'); s.value = '10'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(150);
  const rate = await page.$eval('#in-rate', (e) => e.value);
  const v10 = await resultOf(page, /Monthly EMI/i);
  check(Number(rate) === 10 && Math.abs(num(v10) - annuity(5000000, 10, 240)) < 0.01, 'EMI page: the rate slider sets 10% and the EMI follows (₹48,251.10)', rate + ' / ' + v10);
  /* validation */
  await setVal(page, '#in-rate', '75');
  await sleep(150);
  const msg = await page.evaluate(() => { const m = document.querySelector('#in-rate').closest('.field').querySelector('.field-msg'); return m && !m.hidden ? m.textContent : ''; });
  check(/60/.test(msg), 'EMI page: 75% gets a message naming the 60% maximum', msg);
  const inv = await page.evaluate(() => !!document.querySelector('.tool-results .result-invalid'));
  check(inv, 'EMI page: the results say what is wrong instead of a figure');
  await setVal(page, '#in-rate', '');
  await sleep(150);
  const msg2 = await page.evaluate(() => { const m = document.querySelector('#in-rate').closest('.field').querySelector('.field-msg'); return m && !m.hidden ? m.textContent : ''; });
  check(msg2.length > 0, 'EMI page: an empty rate gets its own message', msg2);
  await setVal(page, '#in-rate', '9');
  await sleep(150);
  /* scenarios */
  await clickText(page, 'Save scenario');
  await sleep(100);
  const stored = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('1234tools.calc.v1.emi-calculator')); } catch (e) { return null; } });
  const sc = stored && (stored.scenarios || (stored.v && stored.scenarios));
  check(Array.isArray(sc) && sc.length === 1, 'EMI page: Save scenario keeps one scenario in localStorage (1234tools.calc.v1.emi-calculator)', stored);
  await setVal(page, '#in-rate', '8');
  await sleep(100);
  await clickText(page, 'Compare');
  await sleep(150);
  const cmp = await page.evaluate(() => { const t = document.querySelector('.calc-compare-table'); if (!t) return null; return { heads: Array.from(t.tHead.rows[0].cells).map((c) => c.textContent.trim()), row: Array.from(t.tBodies[0].rows).map((r) => Array.from(r.cells).map((c) => c.textContent.trim())).find((r) => /^Monthly EMI$/i.test(r[0])) }; });
  check(cmp && cmp.heads.length === 3 && cmp.row && Math.abs(num(cmp.row[1]) - annuity(5000000, 8, 240)) < 0.01 && Math.abs(num(cmp.row[2]) - annuity(5000000, 9, 240)) < 0.01, 'EMI page: Compare puts now (8%) beside scenario 1 (9%)', cmp);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(250);
  const cnt = await page.evaluate(() => { const b = document.querySelector('[data-act=compare]'); return b ? b.textContent : ''; });
  check(/\(1\)/.test(cnt), 'EMI page: the scenario is still there after a reload', cnt);
  await setVal(page, '#in-rate', '11');
  await clickText(page, 'Reset to example');
  await sleep(150);
  check((await page.$eval('#in-rate', (e) => e.value)) === '8.5', 'EMI page: Reset to example puts 8.5% back');
  await page.close();
  /* the reload must not keep the scenario when storage was cleared: fresh page */
}

async function prefs(browser) {
  const p1 = await open(browser, '/finance/loan-payment/', { prefs: { currency: 'USD' } });
  const unit = await p1.evaluate(() => { const f = document.querySelector('#in-amount').closest('.field'); return f.textContent; });
  const m = await resultOf(p1, /Monthly/i);
  check(/\$/.test(unit) && !/£/.test(unit), 'loan page with the USD preference: the amount field is in $', unit.trim().slice(0, 60));
  check(/^\$|US\$/.test(m) && Math.abs(num(m) - annuity(250000, 6.5, 360)) < 0.01, 'loan page with the USD preference: $1,580.17', m);
  await p1.close();
  const p2 = await open(browser, '/india/india-income-tax/', { prefs: { currency: 'USD' } });
  const t = await resultOf(p2, /New regime|new regime/);
  check(/₹/.test(t || ''), 'income tax page keeps rupees whatever the preference', t);
  /* the computation as a PDF */
  const pdf = await p2.evaluate(async () => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /Download as PDF/.test(x.textContent));
    if (!b) return null;
    b.click();
    for (let i = 0; i < 100 && !(window.__downloads[0] && window.__downloads[0].text !== undefined); i++) await new Promise((r) => setTimeout(r, 100));
    return window.__downloads[0] || null;
  });
  check(pdf && pdf.type === 'application/pdf' && pdf.head === '%PDF-' && /\.pdf$/.test(pdf.name) && pdf.size > 1000, 'income tax: Download as PDF gives a real PDF named .pdf', pdf && { name: pdf.name, type: pdf.type, head: pdf.head, size: pdf.size });
  await p2.close();
  /* imperial: BMI opens on ft + in and st + lb */
  const p3 = await open(browser, '/health/bmi/', { prefs: { units: 'imperial' } });
  const parts = await p3.evaluate(() => Array.from(document.querySelectorAll('.field-measure')).map((f) => ({ unit: (f.querySelector('.measure-unit') || {}).value, boxes: Array.from(f.querySelectorAll('.measure-part input, input.measure-value, .measure-boxes input')).filter((i) => i.offsetParent).length })));
  check(parts.length >= 2 && /ft/.test(parts[0].unit + parts[1].unit) && /st/.test(parts[0].unit + parts[1].unit), 'BMI with the imperial preference opens on ft + in and st + lb', parts);
  const filledIn = await p3.evaluate(() => {
    const set = (inp, v) => { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); };
    const fields = Array.from(document.querySelectorAll('.field-measure'));
    const h = fields.find((f) => /ft/.test(f.querySelector('.measure-unit').value));
    const w = fields.find((f) => /st/.test(f.querySelector('.measure-unit').value));
    const hi = Array.from(h.querySelectorAll('input')).filter((i) => i.type !== 'hidden' && i.offsetParent);
    const wi = Array.from(w.querySelectorAll('input')).filter((i) => i.type !== 'hidden' && i.offsetParent);
    set(hi[0], '5'); set(hi[1], '9'); set(wi[0], '11'); set(wi[1], '0');
    return [hi.length, wi.length];
  });
  await sleep(200);
  const bmi = await resultOf(p3, /Body Mass Index/i);
  const want = (154 * 0.45359237) / Math.pow(69 * 0.0254, 2);
  check(Math.abs(num(bmi) - want) < 0.01, 'BMI: 5 ft 9 in and 11 st 0 lb is ' + want.toFixed(2), { bmi, filledIn });
  await p3.close();
}

async function small(browser) {
  const p = await open(browser, '/utilities/tip-calculator/');
  await clickText(p, '15%', '.field-presets');
  await sleep(100);
  const tip = await p.$eval('#in-tip', (e) => e.value);
  const each = await resultOf(p, /each/i);
  check(tip === '15' && Math.abs(num(each) - 85 * 1.15 / 4) < 0.006, 'tip: the 15% preset gives £24.44 each on £85 between 4', tip + ' / ' + each);
  await p.close();
  const q = await open(browser, '/mathematics/percentage/');
  await setVal(q, '#in-mode', 'of');
  await setVal(q, '#in-p', '17.5');
  await setVal(q, '#in-n', '240');
  await sleep(100);
  const r = (await results(q)).map((x) => x.value).join(' | ');
  check(/\b42\b/.test(r), 'percentage: 17.5% of 240 is 42', r);
  const steps = await q.evaluate(() => { const w = document.querySelector('.working, .formula-filled'); return w ? w.innerText : ''; });
  check(/17\.5/.test(steps) && /240/.test(steps), 'percentage: the working uses the reader’s numbers', steps.slice(0, 160));
  await q.close();
}

async function sci(browser) {
  const U = '/mathematics/scientific-calculator/';
  const p = await open(browser, U);
  const type = async (s) => { await p.evaluate(() => { const e = document.querySelector('.calc-expr'); e.value = ''; }); await p.type('.calc-expr', s); await p.keyboard.press('Enter'); await sleep(80); return p.$eval('.calc-result', (e) => e.textContent.trim()); };
  check((await type('15%*80')) === '12', 'scientific: 15% × 80 = 12');
  check((await type('ncr(52,5)')).replace(/[, ]/g, '') === '2598960', 'scientific: nCr(52, 5) = 2,598,960');
  await clickText(p, 'DEG');
  check(num(await type('sin(30)')) === 0.5, 'scientific: sin 30 in degrees = 0.5');
  const mode = await p.$eval('.calc-mode', (e) => e.textContent);
  check(mode === 'DEG', 'scientific: the display shows DEG', mode);
  await p.evaluate(() => { document.querySelector('.calc-expr').value = ''; });
  for (const k of ['7', '×', '6']) await clickText(p, k, '.calc-grid');
  await clickText(p, '=', '.calc-grid');
  await sleep(80);
  check((await p.$eval('.calc-result', (e) => e.textContent.trim())) === '42', 'scientific: the keypad 7 × 6 = 42');
  await p.evaluate(() => { const b = document.querySelector('[aria-label="memory add"], .calc-key-mem'); Array.from(document.querySelectorAll('.calc-key-mem')).find((x) => x.textContent === 'M+').click(); });
  await sleep(50);
  const saved = await p.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/scientific/.test(k)) return { k, v: JSON.parse(localStorage.getItem(k)) }; } return null; });
  check(saved && saved.v.memory === 42 && saved.v.angle === 'deg' && saved.v.history.length >= 3, 'scientific: memory, angle and history kept under one key', saved);
  await p.reload({ waitUntil: 'networkidle0' });
  await sleep(200);
  const after = await p.evaluate(() => ({ hist: document.querySelectorAll('.calc-hist-row').length, mode: document.querySelector('.calc-mode').textContent, mem: !document.querySelector('.calc-mem').hidden }));
  check(after.hist >= 3 && after.mode === 'DEG' && after.mem, 'scientific: after a reload the history, DEG and M are back', after);
  await clickText(p, 'Clear', '.calc-history');
  await sleep(50);
  check((await p.evaluate(() => document.querySelectorAll('.calc-hist-row').length)) === 0, 'scientific: Clear empties the history');
  await p.close();
}

async function conv(browser) {
  const p = await open(browser, '/conversions/length/inch-to-centimeter/');
  const val = async () => { await sleep(120); return p.evaluate(() => { const r = document.querySelector('.tool-results .result-primary .result-value, .tool-results .result-value'); return r ? r.textContent.replace('⧉', '').trim() : ''; }); };
  await setVal(p, '#u-value', '5 3/4');
  check(/14\.605/.test(await val()), 'conversion: 5 3/4 in = 14.605 cm', await val());
  await setVal(p, '#u-value', '5\' 11"');
  check(/180\.34/.test(await val()), 'conversion: 5′ 11″ typed into inches = 180.34 cm', await val());
  await setVal(p, '#u-value', '1');
  const opts = await p.$$eval('#u-precision option', (o) => o.map((x) => x.value));
  const sf = opts.find((v) => /sig|s3|sf3|3s/.test(v)) || opts.find((v) => /3/.test(v));
  if (sf) { await setVal(p, '#u-precision', sf); check(/^2\.54\b/.test(await val()), 'conversion: 3 significant figures shows 2.54 cm', sf + ' → ' + await val()); }
  else check(false, 'conversion: a precision control with significant figures', opts);
  await setVal(p, '#u-precision', opts[0]);
  await p.evaluate(() => { const d = document.querySelector('.conv-batch'); if (d) d.open = true; });
  await setVal(p, '#u-batch', '1\n2.5\nbanana\n10');
  await sleep(150);
  const batch = await p.evaluate(() => { const t = document.querySelector('.conv-batch-table'); const m = document.querySelector('.conv-batch-out .field-msg'); return { rows: t ? Array.from(t.tBodies[0].rows).map((r) => Array.from(r.cells).map((c) => c.textContent.trim())) : [], msg: m ? m.textContent : '' }; });
  const good = batch.rows.filter((r) => /2\.54|6\.35|25\.4/.test(r.join(' ')));
  check(good.length === 3 && /1 line/.test(batch.msg), 'conversion: a pasted list converts 3 values and names the 1 bad line', batch);
  await setVal(p, '#u-value', '12');
  await sleep(150);
  const live = await p.evaluate(() => { const h = document.querySelector('.conv-live-h'); const t = document.querySelector('.conv-live-table'); return { h: h ? h.textContent : '', cells: t ? t.innerText : '' }; });
  check(/12 in/.test(live.h) && /30\.48/.test(live.cells), 'conversion: the live table follows 12 in (30.48 cm)', live.h);
  const tips = await p.evaluate(() => Array.from(document.querySelectorAll('.tips li, .tool-tips li')).map((l) => l.textContent).join(' '));
  check(!/full table below the result shows the same value in every/.test(tips), 'conversion: the old "full table below the result" tip is gone', tips.slice(0, 200));
  await p.close();
}

async function fx(browser) {
  const rates = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'rates.json'), 'utf8'));
  const p = await open(browser, '/business/currency-converter/');
  const text = await p.evaluate(() => document.querySelector('main').innerText);
  const fetched = rates.fetched ? new Date(rates.fetched).getTime() : null;
  if (fetched) {
    const h = Math.floor((Date.now() - fetched) / 3600000);
    const m = /fetched (less than an hour|\d+ hours?|\d+ days?) ago/.exec(text);
    const shown = m ? (/less/.test(m[1]) ? 0 : parseInt(m[1], 10)) : null;
    check(m && (h >= 48 || Math.abs(shown - h) <= 1), 'currency: "fetched N hours ago" from rates.json (' + h + ' h)', m && m[0]);
  } else check(/\d{1,2} \w+ 20\d\d/.test(text), 'currency: the rate date is shown');
  await setVal(p, '#fx-amount', '100');
  await setVal(p, '#fx-from', 'GBP');
  await setVal(p, '#fx-to', 'USD');
  await sleep(150);
  const want = 100 * rates.rates.USD / rates.rates.GBP;
  const main = await p.evaluate(() => document.querySelector('main').innerText);
  const shown = (main.match(/\$\s?([\d,]+\.\d\d)/) || [])[1];
  check(shown && Math.abs(num(shown) - want) < 0.006, '£100 to USD at the file’s rates = $' + want.toFixed(2), shown);
  await setVal(p, '#fx-fee', '3');
  await sleep(150);
  const withFee = await p.evaluate(() => document.querySelector('main').innerText);
  check(new RegExp(want * 0.97 >= 100 ? (want * 0.97).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : (want * 0.97).toFixed(2)).test(withFee), 'currency: a 3% fee leaves $' + (want * 0.97).toFixed(2), withFee.slice(0, 300));
  await setVal(p, '#fx-fee', '0');
  await p.evaluate(() => { const d = document.querySelector('.fx-many'); if (d) d.open = true; });
  await setVal(p, '#fx-many', '10\n250\n1,000');
  await sleep(150);
  const many = await p.evaluate(() => { const o = document.querySelector('.fx-many .conv-batch-out'); return o ? o.innerText : ''; });
  check([10, 250, 1000].every((a) => many.indexOf((a * rates.rates.USD / rates.rates.GBP).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) >= 0), 'currency: several amounts at once, each right', many.slice(0, 300));
  await clickText(p, 'Show the chart');
  await sleep(600);
  const hist = await p.evaluate(() => { const b = document.querySelector('.fx-history-body'); return { svg: !!(b && b.querySelector('svg')), text: b ? b.innerText.slice(0, 200) : '' }; });
  check(hist.svg, 'currency: the 90-day chart draws from this site’s rates-history.json', hist.text);
  await p.close();
}

async function health(browser) {
  /* a spec's own metric / imperial select opens on the preference and converts what is entered */
  const p = await open(browser, '/health/bmr-tdee/', { prefs: { units: 'imperial' } });
  const sys = await p.$eval('#in-system', (e) => e.value);
  check(sys === 'imperial', 'BMR with the imperial preference opens on imperial', sys);
  await setVal(p, '#in-system', 'metric');
  await setVal(p, '#in-weight', '70');
  await setVal(p, '#in-system', 'imperial');
  await sleep(150);
  const lb = await p.$eval('#in-weight', (e) => e.value);
  check(Math.abs(Number(lb) - 154.3) < 0.051, 'BMR: switching to imperial turns 70 kg into 154.3 lb', lb);
  await p.close();
}

async function validation(browser) {
  const p = await open(browser, '/education/attendance-calculator/');
  await setVal(p, '#in-attended', '70');
  await setVal(p, '#in-held', '60');
  await sleep(150);
  const msg = await p.evaluate(() => { const m = document.querySelector('#in-attended').closest('.field').querySelector('.field-msg'); return m && !m.hidden ? m.textContent : ''; });
  check(/more classes than/.test(msg), 'attendance: 70 attended of 60 held is refused with a reason', msg);
  await setVal(p, '#in-held', '12.5');
  await sleep(150);
  const m2 = await p.evaluate(() => { const m = document.querySelector('#in-held').closest('.field').querySelector('.field-msg'); return m && !m.hidden ? m.textContent : ''; });
  check(/whole/i.test(m2), 'attendance: 12.5 classes asks for a whole number', m2);
  await p.close();
  const q = await open(browser, '/utilities/random-number-generator/');
  await setVal(q, '#in-min', '50');
  await setVal(q, '#in-max', '10');
  await sleep(150);
  const m3 = await q.evaluate(() => { const m = document.querySelector('#in-max').closest('.field').querySelector('.field-msg'); return m && !m.hidden ? m.textContent : ''; });
  check(/at least the minimum/.test(m3), 'random numbers: a maximum below the minimum is named', m3);
  await q.close();
}

async function layout(browser) {
  const pages = ['/india/emi-calculator/', '/india/india-income-tax/', '/india/sip-calculator/', '/india/gst-calculator/', '/finance/compound-interest/', '/finance/loan-payment/', '/health/bmi/', '/mathematics/percentage/', '/mathematics/scientific-calculator/', '/utilities/tip-calculator/', '/business/currency-converter/', '/business/depreciation/', '/business/amortization-schedule/', '/conversions/mass/kilogram-to-pound/'];
  for (const u of pages) {
    for (const [w, theme] of [[390, 'dark'], [390, 'light'], [1366, 'light']]) {
      const p = await open(browser, u, { w, theme });
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(over <= 0, u + ' at ' + w + ' px (' + theme + '): no sideways scroll', over + ' px');
      if (w === 390 && theme === 'dark') await p.screenshot({ path: path.join(OUT, u.replace(/[^a-z0-9]+/gi, '_') + '-390-dark.png'), fullPage: false });
      await p.close();
    }
  }
}

(async () => {
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    for (const f of [emi, prefs, small, sci, conv, fx, health, validation, layout]) {
      try { await f(browser); } catch (e) { check(false, f.name + ' ran to the end', e.stack); }
    }
  } finally { await browser.close(); if (server && server.close) server.close(); }
  check(errors.length === 0, 'no console errors', errors.slice(0, 4).join(' | '));
  check(external.length === 0, 'no request left 127.0.0.1', external.slice(0, 4).join(', '));
  console.log('\ncalc-shell: ' + pass + ' passed, ' + fail + ' failed. Screenshots: ' + OUT);
  process.exit(fail ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
