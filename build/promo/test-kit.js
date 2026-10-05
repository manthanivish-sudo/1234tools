'use strict';
/**
 * Kit v2 test (puppeteer-core + local Chrome).
 *   node build/promo/test-kit.js            full run (about 4 minutes)
 *   node build/promo/test-kit.js --quick    skips the layout × type matrix
 *
 * PROMO_HOME is a temporary folder. Examples: when build/promo/examples.js is
 * installed, the six tools' examples already captured in the owner's promo home
 * are copied in, so examples.js serves them from its cache (a missing one is
 * captured live); without examples.js a stub capture module returns fixtures
 * rendered here. Checks:
 *   - every palette passes its WCAG AA pairs;
 *   - six tools spanning every example kind: every PNG's size, a 5-page PDF,
 *     no text overflow, kit.md with the hook, the three "usual way" lines and the look;
 *   - the story fallback is within limits and lint-clean;
 *   - two consecutive kits for a tool differ in two of layout/palette/type,
 *     and a neighbouring tool's kit differs from both;
 *   - the same seed gives identical PNG bytes;
 *   - theme 'both' writes the second palette;
 *   - no overflow in any layout × type (palettes and copy rotating) for the six tools, every format.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const REAL_HOME = process.env.PROMO_REAL_HOME || path.join(os.homedir(), '.1234tools-promo');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-kit-'));
process.env.PROMO_HOME = TMP;
const QUICK = process.argv.includes('--quick');
const CHROME = process.env.PROMO_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const kit = require('./kit');
const T = require('./tools');
const PAL = require('./kit-templates/palettes');
const VAR = require('./kit-templates/variant');
const LAY = require('./kit-templates/layouts');
const S = require('./stories');
const { lint } = require('./lint');

const TOOLS = [
  ['/india/gst-calculator/', 'calc'],
  ['/developer/json-formatter/', 'text'],
  ['/pdf/invoice-pdf/', 'document'],
  ['/ai-image/background-remover/', 'beforeAfter'],
  ['/ai/invoice-extractor/', 'schematic'],
  ['/ai-video/auto-captions/', 'beforeAfter'],
];
const DIMS = {
  'carousel-1.png': [1080, 1350], 'carousel-2.png': [1080, 1350], 'carousel-3.png': [1080, 1350], 'carousel-4.png': [1080, 1350], 'carousel-5.png': [1080, 1350],
  'square-1080.png': [1080, 1080], 'story-1080x1920.png': [1080, 1920], 'pin-1000x1500.png': [1000, 1500], 'wide-1200x630.png': [1200, 630],
};

let pass = 0;
let fail = 0;
async function check(name, fn) {
  try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ': ' + (e && e.message || e)); }
}

/* ---------- examples: the owner's captured ones, or fixtures ---------- */
const HAVE_ENGINE = fs.existsSync(path.join(__dirname, 'examples.js'));
function seedExamples() {
  if (!HAVE_ENGINE) return 0;
  const E = require('./examples');
  let n = 0;
  for (const [tool] of TOOLS) {
    const from = path.join(REAL_HOME, 'examples', E.slugFor(tool));
    const to = path.join(TMP, 'examples', E.slugFor(tool));
    if (!fs.existsSync(path.join(from, 'example.json'))) continue;
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) if (fs.statSync(path.join(from, f)).isFile()) fs.copyFileSync(path.join(from, f), path.join(to, f));
    n++;
  }
  return n;
}

/** Fixture images drawn in Chrome, for the stub capture module. */
async function makeFixtures(browser) {
  const dir = path.join(TMP, 'fixtures');
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  const shot = async (name, w, hgt, html, transparent) => {
    await page.setViewport({ width: w, height: hgt });
    await page.setContent('<body style="margin:0">' + html + '</body>');
    await page.screenshot({ path: path.join(dir, name), omitBackground: !!transparent });
  };
  const mug = '<svg width="1200" height="800" viewBox="0 0 1200 800"><ellipse cx="600" cy="640" rx="260" ry="40" fill="rgba(0,0,0,.25)"/><rect x="430" y="300" width="340" height="330" rx="40" fill="#e85d3a"/><path d="M770 380 q120 0 120 100 t-120 100" fill="none" stroke="#e85d3a" stroke-width="40"/></svg>';
  await shot('before.png', 1200, 800, '<div style="width:1200px;height:800px;background:linear-gradient(160deg,#c9b38f,#7a6248)">' + mug + '</div>');
  await shot('after.png', 1200, 800, '<div style="width:1200px;height:800px;background:transparent">' + mug + '</div>', true);
  await shot('page1.png', 1240, 1754, '<div style="width:1240px;height:1754px;background:#fff;font:28px sans-serif;padding:120px;box-sizing:border-box"><h1 style="font-size:72px">INVOICE</h1><p>Studio North · INV-0042</p><table style="width:100%;margin-top:80px;font-size:30px">' + '<tr><td>Menu photography</td><td align=right>450.00</td></tr>'.repeat(6) + '</table><h2 style="text-align:right;margin-top:80px">Total 776.00</h2></div>');
  await page.close();
  return dir;
}
function stubExamples(fixDir) {
  return {
    capture: async (tool, spec) => {
      const kind = spec && spec.kind;
      if (kind === 'schematic') return Object.assign({ kind: 'schematic', ok: true, source: 'none' }, spec);
      const base = { tool, captured: '2026-10-04T00:00:00Z', source: 'live tool (test fixture)', ok: true };
      if (kind === 'calc') return Object.assign(base, { kind: 'calc', inputs: [{ label: 'Amount (₹)', value: '11800' }, { label: 'GST rate', value: '18%' }], results: [{ label: 'Taxable value', value: '₹10,000.00', primary: true }, { label: 'CGST', value: '₹900.00' }, { label: 'SGST', value: '₹900.00' }] });
      if (kind === 'text') return Object.assign(base, { kind: 'text', input: spec.input, output: JSON.stringify(JSON.parse(spec.input), null, 2), inputLabel: 'Input', outputLabel: 'Formatted' });
      if (kind === 'pdf-make') return Object.assign(base, { kind: 'document', page: path.join(fixDir, 'page1.png') });
      return Object.assign(base, { kind: 'beforeAfter', before: path.join(fixDir, 'before.png'), after: path.join(fixDir, 'after.png') });
    },
  };
}

function pngDims(file) { return kit.pngSize(fs.readFileSync(file)); }

(async () => {
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--font-render-hinting=none', '--disable-gpu'] });
  const results = {};
  try {
    const seeded = seedExamples();
    if (!HAVE_ENGINE) kit.setExamples(stubExamples(await makeFixtures(browser)));
    console.log('examples: ' + (HAVE_ENGINE ? 'examples.js, ' + seeded + ' of 6 served from the owner\'s capture cache' : 'stub fixtures (examples.js not installed)'));

    await check('every palette passes its WCAG AA pairs', async () => {
      const bad = PAL.audit().filter((r) => !r.ok);
      assert.deepStrictEqual(bad, []);
      assert.ok(PAL.IDS.length >= 8, 'at least 8 palettes');
    });

    await check('story fallback: limits, three usual lines and steps, lint-clean', async () => {
      for (const p of ['/india/gst-calculator/', '/ai/invoice-extractor/', '/ai-image/background-remover/', '/pdf/merge-pdf/']) {
        const rec = T.record(p);
        const s = S.fallback(rec);
        assert.ok([...s.hook].length <= 64 && [...s.pain].length <= 120 && [...s.promise].length <= 70 && [...s.howTo].length <= 60, p + ' lengths');
        assert.ok(s.usual.length === 3 && s.usual.every((u) => [...u].length <= 46), p + ' usual');
        assert.ok(s.steps.length === 3 && s.steps.every((u) => [...u].length <= 32), p + ' steps');
        for (const t of [s.hook, s.pain, s.promise, s.howTo, s.cta].concat(s.usual, s.steps, s.proof)) {
          const r = lint(t, { pricing: rec.pricing, section: rec.section, record: rec });
          assert.ok(r.ok, p + ': "' + t + '" ' + JSON.stringify(r.errors));
        }
      }
    });

    for (const [tool, kind] of TOOLS) {
      await check('kit ' + tool + ' (' + kind + '): sizes, 5-page PDF, no overflow, kit.md', async () => {
        const r = await kit.kit(tool, { browser, seed: 101 + TOOLS.findIndex((t) => t[0] === tool) * 7 });
        results[tool] = r;
        for (const [f, [w, h]] of Object.entries(DIMS)) assert.deepStrictEqual(pngDims(path.join(r.dir, f)), { w, h }, f);
        const pdf = fs.readFileSync(path.join(r.dir, 'carousel.pdf'));
        assert.strictEqual(kit.pdfPages(pdf), 5, 'carousel.pdf pages');
        assert.deepStrictEqual(r.fit.overflow, [], 'overflow');
        const md = fs.readFileSync(path.join(r.dir, 'kit.md'), 'utf8');
        const story = S.storyFor(tool);
        assert.ok(md.includes(story.hook), 'hook in kit.md');
        for (const u of story.usual) assert.ok(md.includes(u), 'usual line in kit.md: ' + u);
        assert.ok(md.includes('**Variant:** layout `' + r.variant.layout + '`') && md.includes('seed `' + r.variant.seed + '`'), 'variant in kit.md');
        assert.ok(r.qr.verified, 'story QR reads back');
        assert.strictEqual(r.example.kind, kind === 'document' ? 'document' : kind, 'example kind ' + r.example.kind + ' (' + r.example.how + ')');
        if (kind === 'schematic') assert.ok(!r.example.real, 'a schematic is never labelled real');
        else assert.ok(r.example.real, 'real example expected: ' + r.example.how);
      });
    }

    /* the XLeShop shops: a kit from each shop's first item, with its own name, host and logo, nothing of 1234Tools */
    const SITE = require('./site');
    for (const s of SITE.list().filter((x) => x.group === 'XLeShop shops' && x.items > 0)) {
      await check('shop kit ' + s.id + ': sizes, no overflow, its own host, a schematic (never "real"), QR reads back', async () => {
        const r = await SITE.run(s.id, async () => {
          const item = SITE.listItems()[0];
          return kit.kit(item.path, { browser, seed: 300 + s.id.length });
        });
        for (const [f, [w, h]] of Object.entries(DIMS)) assert.deepStrictEqual(pngDims(path.join(r.dir, f)), { w, h }, f);
        assert.deepStrictEqual(r.fit.overflow, [], 'overflow');
        assert.ok(r.qr.verified, 'story QR reads back');
        assert.ok(!r.example.real, 'a shop kit is a schematic');
        const md = fs.readFileSync(path.join(r.dir, 'kit.md'), 'utf8');
        const host = new URL(s.baseUrl).hostname;
        assert.ok(md.includes(host) && !/1234tools\.com/i.test(md), 'kit.md uses ' + host);
      });
    }

    await check('two consecutive kits for one tool differ in 2+ of layout/palette/type; a neighbour differs too', async () => {
      const a = await kit.kit('/developer/json-formatter/', { browser, example: { kind: 'schematic', input: 'JSON', output: 'Formatted JSON', real: false } });
      const b = await kit.kit('/developer/json-formatter/', { browser, example: { kind: 'schematic', input: 'JSON', output: 'Formatted JSON', real: false } });
      const c = await kit.kit('/pdf/merge-pdf/', { browser, example: { kind: 'schematic', input: 'PDF files', output: 'One PDF', real: false } });
      const d = ['layout', 'palette', 'type'].filter((k) => a.variant[k] !== b.variant[k]);
      assert.ok(d.length >= 2, JSON.stringify([a.variant, b.variant]));
      assert.ok(b.n === a.n + 1, 'kit numbers advance');
      if (c) assert.notStrictEqual(VAR.combo(c.variant), VAR.combo(b.variant), 'neighbour repeats the look');
      const h = VAR.loadHistory(TMP);
      assert.ok(h.entries.length >= 3, 'history.json records kits');
    });

    await check('the same seed reproduces identical PNG bytes', async () => {
      const ex = { kind: 'calc', real: true, inputs: [{ label: 'Amount', value: '11800' }], results: [{ label: 'Taxable value', value: '₹10,000.00', primary: true }, { label: 'CGST', value: '₹900.00' }] };
      const one = await kit.kit('/india/gst-calculator/', { browser, seed: 4242, example: ex });
      const a = ['square-1080.png', 'carousel-1.png', 'story-1080x1920.png'].map((f) => fs.readFileSync(path.join(one.dir, f)));
      const two = await kit.kit('/india/gst-calculator/', { browser, seed: 4242, example: ex });
      const b = ['square-1080.png', 'carousel-1.png', 'story-1080x1920.png'].map((f) => fs.readFileSync(path.join(two.dir, f)));
      assert.deepStrictEqual(one.variant, two.variant);
      a.forEach((buf, i) => assert.ok(buf.equals(b[i]), 'bytes differ for file ' + i));
    });

    await check("theme 'both' adds the Daylight set", async () => {
      const r = await kit.kit('/pdf/invoice-pdf/', { browser, theme: 'both', seed: 7 });
      assert.strictEqual(r.variant.palette, 'midnight');
      for (const [f, [w, h]] of Object.entries(DIMS)) assert.deepStrictEqual(pngDims(path.join(r.dir, kit.themed(f, 'daylight'))), { w, h }, f);
      assert.strictEqual(kit.pdfPages(fs.readFileSync(path.join(r.dir, 'carousel-daylight.pdf'))), 5);
      assert.deepStrictEqual(r.fit.overflow, []);
    });

    if (!QUICK) {
      await check('no overflow in any layout × type (palettes, copy rotating) × format for the six tools', async () => {
        const page = await browser.newPage();
        const problems = [];
        let i = 0;
        let renders = 0;
        for (const [tool] of TOOLS) {
          const rec = T.record(tool);
          const story = S.storyFor(tool);
          const ex = (await kit.getExample(rec, story, { capture: false })).ex;
          const qrs = kit.qrPair(rec);
          for (const layout of VAR.LAYOUTS) {
            for (const type of VAR.TYPES) {
              const v = { layout, type, palette: PAL.IDS[i % PAL.IDS.length], copy: i % 3, seed: i };
              i++;
              const ctx = kit.makeCtx(rec, story, ex, v, 2, qrs);
              for (const fmt of Object.keys(LAY.FORMATS)) {
                const rep = await kit.layoutFormat(page, fmt, ctx, 0.25);
                renders++;
                for (const o of rep.overflow) problems.push(tool + ' ' + VAR.combo(v) + ' c' + v.copy + ' ' + o);
              }
            }
          }
        }
        await page.close();
        console.log('       (' + renders + ' format renders)');
        assert.deepStrictEqual(problems, []);
      });
    }
  } finally {
    await browser.close();
    kit.setExamples(null);
    if (!process.env.KEEP_TMP) fs.rmSync(TMP, { recursive: true, force: true });
    else console.log('kept ' + TMP);
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
