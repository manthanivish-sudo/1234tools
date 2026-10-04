'use strict';
/**
 * Tests for build/promo/examples.js: captures a fixed list of examples from
 * the live tool pages (one of every kind) and checks what was saved.
 *
 *   node build/promo/test-examples.js [--only <substring>] [--keep] [--port 8740-8749]
 *
 * Writes to a temporary PROMO_HOME (printed; kept with --keep) so the owner's
 * own examples are never touched. Exits non-zero on any failure.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf('--' + n); return i < 0 ? undefined : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const HOME = process.env.PROMO_HOME_TEST || path.join(os.tmpdir(), 'promo-examples-test-' + process.pid);
process.env.PROMO_HOME = HOME;

const E = require('./examples');

const LIST = [
  ['/finance/compound-interest/', { kind: 'calc', inputs: { principal: 5000, rate: 8, years: 15, contribution: 100 } }],
  ['/india/gst-calculator/', { kind: 'calc', inputs: { amount: 11800, mode: 'inclusive', rate: 18 } }],
  ['/business/uk-take-home-pay/', { kind: 'calc', inputs: { gross: 38000 } }],
  ['/developer/json-formatter/', { kind: 'text', input: '{"customer":"Asha Rao","orders":[{"id":101,"total":499.5},{"id":102,"total":1250}],"paid":true}' }],
  ['/qr/qr-code-generator/', { kind: 'qr', text: 'https://www.1234tools.com/qr/qr-code-generator/' }],
  ['/pdf/invoice-pdf/', { kind: 'pdf-make', fields: { number: 'INV-0042', tax: 20 } }],
  ['/pdf/merge-pdf/', { kind: 'pdf-edit', sample: 'invoice' }],
  ['/pdf/watermark-pdf/', { kind: 'pdf-edit', sample: 'invoice' }],
  ['/ai-image/background-remover/', { kind: 'image', sample: 'product' }],
  ['/ai-image/sky-replacement/', { kind: 'image', sample: 'landscape' }],
  ['/image/image-compressor/', { kind: 'image', sample: 'food' }],
  ['/ai-video/auto-captions/', { kind: 'video', sample: 'speech' }],
  ['/ai/business-writer/', { kind: 'schematic', input: 'A few notes about what you need', output: 'A finished business letter' }],
  ['/image/image-cropper/', { kind: 'image', sample: 'nonexistent' }]
];

const failures = [];
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failures.push(what); return ok; };
const money = (s) => Number(String(s).replace(/[^0-9.\-]/g, ''));
const sizeOf = (dir, f) => { try { return E.imageSize(fs.readFileSync(path.join(dir, f))); } catch (e) { return null; } };
const between = (v, a, b) => v >= a && v <= b;

function checkFile(dir, f, minW, maxW, label) {
  const s = sizeOf(dir, f);
  check(!!s && between(s[0], minW, maxW) && s[1] >= 100 && s[1] <= 4000, label + ' ' + f + ' is an image ' + (s ? s.join('x') : 'MISSING'));
  return s;
}

(async () => {
  const t0 = Date.now();
  console.log('PROMO_HOME=' + HOME);

  /* inert on require: requiring did not create the folder or start anything */
  check(!fs.existsSync(HOME), 'require() is inert (no PROMO_HOME written)');
  check(E.slugFor('/ai-image/background-remover/') !== E.slugFor('/image/background-remover/'), 'the shared slug is split: ' + E.slugFor('/ai-image/background-remover/') + ' / ' + E.slugFor('/image/background-remover/'));
  check(E.slugFor('/pdf/merge-pdf/') === 'merge-pdf', 'a unique slug stays plain');

  const only = flag('only');
  const list = LIST.filter(([p]) => !only || p.indexOf(only) >= 0);
  const port = flag('port') ? Number(flag('port')) : undefined;
  const results = await E.captureMany(list.map(([tool, example]) => ({ tool, example })), { fresh: true, port, onLog: (m) => console.log('    ' + m) });
  const by = {};
  results.forEach((r) => { by[r.tool] = r; });

  for (const [tool, spec] of list) {
    const r = by[tool];
    const dir = E.dirFor(tool);
    console.log('\n' + tool + ' (' + spec.kind + ', ' + (r && r.ms ? (r.ms / 1000).toFixed(1) + ' s' : '?') + ')');
    if (!r) { check(false, 'no result'); continue; }
    const json = E.read(tool);
    check(!!json && json.tool === tool && json.captured && json.source, 'example.json written with tool, captured and source');
    if (spec.sample === 'nonexistent') { check(r.ok === false && /unknown sample/.test(r.note), 'a bad sample fails with a note, nothing invented (' + r.note + ')'); continue; }
    if (!check(r.ok === true, 'ok' + (r.note ? ' (note: ' + r.note + ')' : ''))) continue;

    if (spec.kind === 'calc') {
      check(r.kind === 'calc' && r.inputs.length > 0 && r.results.length > 0, r.inputs.length + ' inputs, ' + r.results.length + ' results');
      check(r.results.some((x) => x.primary && x.value), 'a primary result: ' + (r.results.find((x) => x.primary) || {}).label + ' = ' + (r.results.find((x) => x.primary) || {}).value);
      check(r.results.every((x) => x.label && x.value), 'every result row has a label and a value');
      for (const k of Object.keys(spec.inputs)) {
        const f = r.inputs.find((x) => x.key === k);
        check(!!f && (f.value === String(spec.inputs[k]) || Number(f.value) === Number(spec.inputs[k]) || f.value.toLowerCase().indexOf(String(spec.inputs[k]).toLowerCase()) >= 0), 'input ' + k + ' shows ' + (f ? '"' + f.label + '" = ' + f.value : 'nothing'));
      }
    }
    if (tool === '/finance/compound-interest/') {
      const i = 0.08 / 12, n = 180;
      const want = 5000 * Math.pow(1 + i, n) + 100 * (Math.pow(1 + i, n) - 1) / i;
      const got = money(r.results.find((x) => x.primary).value);
      check(Math.abs(got - want) < 0.05, 'final balance ' + got + ' matches the formula (' + want.toFixed(2) + ')');
    }
    if (tool === '/india/gst-calculator/') {
      const all = r.results.map((x) => x.label + ' = ' + x.value).join(' | ');
      console.log('    ' + all);
      check(r.results.some((x) => money(x.value) === 10000) && r.results.some((x) => money(x.value) === 1800), 'Rs 11,800 inclusive at 18% splits into 10,000 + 1,800');
    }
    if (spec.kind === 'text') {
      let same = false;
      try { same = JSON.stringify(JSON.parse(r.output)) === JSON.stringify(JSON.parse(spec.input)); } catch (e) { /* not JSON */ }
      check(same && r.output.split('\n').length > 5, 'output is the same JSON, pretty-printed over ' + r.output.split('\n').length + ' lines');
      check(!!r.inputLabel && !!r.outputLabel, 'pane labels: ' + r.inputLabel + ' / ' + r.outputLabel);
    }
    if (spec.kind === 'qr') {
      const s = checkFile(dir, r.after, 800, 800, 'QR');
      check(s && s[1] === 800, 'QR is square');
      check(/Verified|read back/.test(r.caption), 'caption carries the read-back verdict: ' + r.caption);
    }
    if (spec.kind === 'pdf-make') {
      const s = checkFile(dir, r.page, 1000, 1000, 'page');
      check(s && between(s[1] / s[0], 1.3, 1.5), 'page 1 is A4-shaped (' + (s ? (s[1] / s[0]).toFixed(3) : '?') + ')');
      check(fs.readFileSync(path.join(dir, r.pdf)).toString('latin1', 0, 5) === '%PDF-', 'output.pdf is a PDF');
      check(r.stats.some((x) => /Total due/.test(x[0])), 'stats carry the total: ' + JSON.stringify(r.stats.find((x) => /Total due/.test(x[0]))));
      check(/inv-0042/.test(r.caption), 'the field override reached the PDF name: ' + r.caption);
    }
    if (spec.kind === 'pdf-edit') {
      checkFile(dir, r.before, 600, 2600, 'before');
      checkFile(dir, r.after, 600, 2600, 'after');
      if (tool === '/pdf/merge-pdf/') check(JSON.stringify(r.pagesBefore) === '[1,1]' && JSON.stringify(r.pagesAfter) === '[2]', 'two 1-page inputs became one 2-page PDF ' + JSON.stringify(r.pagesBefore) + ' -> ' + JSON.stringify(r.pagesAfter));
      if (tool === '/pdf/watermark-pdf/') {
        const diff = fs.readFileSync(path.join(dir, r.before)).equals(fs.readFileSync(path.join(dir, r.after)));
        check(!diff, 'after differs from before');
      }
      console.log('    caption: ' + r.caption);
    }
    if (spec.kind === 'image') {
      const b = checkFile(dir, r.before, 300, 1200, 'before');
      const a = checkFile(dir, r.after, 300, 4800, 'after');
      check(b && a && Math.abs(a[0] / a[1] - b[0] / b[1]) < 0.02, 'after keeps the photo\'s shape (' + (b && b.join('x')) + ' -> ' + (a && a.join('x')) + ')');
      if (tool === '/ai-image/background-remover/') {
        const buf = fs.readFileSync(path.join(dir, r.after));
        check(buf.toString('latin1', 1, 4) === 'PNG' && buf[25] === 6, 'cut-out is an RGBA PNG');
      }
      if (tool === '/image/image-compressor/') check(/→/.test(r.caption) && r.output && /webp/.test(r.exportedAs), 'compressor reports sizes and keeps its WebP: ' + r.caption);
      console.log('    caption: ' + r.caption);
    }
    if (spec.kind === 'video') {
      checkFile(dir, r.before, 1080, 1080, 'before');
      const a = checkFile(dir, r.after, 1080, 1080, 'after');
      check(a && a[1] === 1920, 'captioned frame is 9:16');
      check(/caption/i.test(r.transcript) && /sound/i.test(r.transcript), 'transcript heard the speech: "' + r.transcript + '"');
      check(fs.statSync(path.join(dir, r.clip)).size > 100000, 'the captioned clip is saved (' + r.clip + ')');
    }
    if (spec.kind === 'schematic') check(r.kind === 'schematic' && r.input === spec.input && !/live tool/.test(r.source), 'schematic copied from the spec and not labelled as a live capture');
  }

  /* results match what the page shows: open the calculators again, independently */
  const calcs = list.filter(([, s]) => s.kind === 'calc');
  if (calcs.length) {
    console.log('\nre-reading the calculators in a fresh page');
    const session = await E.open({ port });
    try {
      for (const [tool, spec] of calcs) {
        const page = await session.browser.newPage();
        const q = new URLSearchParams(spec.inputs).toString();
        await page.goto(session.base + tool + '?' + q, { waitUntil: 'load' });
        await page.waitForSelector('.tool-results .result');
        await new Promise((r) => setTimeout(r, 400));
        const shown = await page.$$eval('.tool-results .result', (l) => l.map((r) => (r.querySelector('.result-label') || {}).textContent + '=' + (r.querySelector('.result-value') || {}).textContent));
        const saved = by[tool].results.map((x) => x.label + '=' + x.value);
        check(JSON.stringify(shown) === JSON.stringify(saved), tool + ': saved results equal the page (' + saved.length + ' rows)');
        await page.close();
      }
    } finally { await E.close(session); }
  }

  /* the cache: a second capture without fresh returns the same json */
  if (by['/finance/compound-interest/']) {
    const again = await E.capture('/finance/compound-interest/', LIST[0][1], { port });
    check(again.captured === by['/finance/compound-interest/'].captured, 'second capture reused the cache');
  }

  console.log('\n' + ((Date.now() - t0) / 1000).toFixed(1) + ' s; ' + (failures.length ? 'FAILED: ' + failures.length : 'all checks passed'));
  failures.forEach((f) => console.log('  - ' + f));
  if (!flag('keep')) { try { fs.rmSync(HOME, { recursive: true, force: true }); } catch (e) { /* in use */ } } else console.log('kept ' + HOME);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
