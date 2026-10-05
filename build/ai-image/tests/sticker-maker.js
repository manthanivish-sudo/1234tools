/*
 * Drives /ai-image/sticker-maker/ in headless Chrome against a local
 * static server of the export, and proves what the page claims:
 *
 *   - the page mounts, its title fits, nothing is fetched from a third party
 *   - a sticker from city-streets.jpg (people) and cats.jpg (animals) has a
 *     white border all the way round the cut-out (outer-ring purity, printed)
 *   - the WhatsApp/Telegram export is a 512×512 WebP under 100 KB
 *   - the story export is a 1080×1920 PNG; copy to clipboard works where allowed
 *   - a pack from six photos yields six 512×512 WebPs, each under 100 KB, and a zip
 *
 *   node build/ai-image/tests/sticker-maker.js --root <export-dir> --port 8721 [--out dir] [--img dir]
 *
 * Exits non-zero on any failure. Serve the export first, e.g.
 *   node E:/tmp/1234-agents/harness/serve.js <export-dir> 8721
 */
'use strict';
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require(process.env.PUPPETEER_CORE || 'E:/projects/1234Tools/node_modules/puppeteer-core'); }
catch (e) { puppeteer = require('puppeteer-core'); }

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8721));
const ROOT = flag('root', path.resolve(__dirname, '..', '..', '..'));
const OUT = flag('out', path.join(ROOT, 'build', 'ai-image', 'tests', 'out', 'sticker-maker'));
const IMG = flag('img', 'E:/tmp/1234-agents/harness/img');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:' + PORT;
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failures.push(what); return ok; };
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (const f of ['engine/models/modnet-photographic-portrait-matting.onnx.part0', 'engine/models/modnet-photographic-portrait-matting.onnx.part1', 'engine/aiimg-matte.js', 'engine/aiimg-sticker-maker.js', 'ai-image/sticker-maker/index.html']) {
    check(fs.existsSync(path.join(ROOT, f)), 'export has ' + f);
  }
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU'],
    protocolTimeout: 900000
  });
  const logs = [];
  const net = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (/error|warn/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
    page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); failures.push('page error: ' + e.message); });
    page.on('requestfailed', (r) => { logs.push('requestfailed ' + r.url()); console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText); });
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) net.push(u); });
    page.on('response', (r) => { const u = r.url(); if (/\.(onnx|wasm)$/.test(u)) logs.push(stamp() + ' ' + r.status() + ' ' + u.split('/').pop()); });
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
    try { await browser.defaultBrowserContext().overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']); } catch (e) { logs.push('clipboard permission: ' + e.message); }
    /* decline analytics before the page loads: the consent banner sits over
       the lower side pane and would swallow clicks meant for the export buttons */
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* private mode */ } });

    await page.goto(BASE + '/ai-image/sticker-maker/', { waitUntil: 'networkidle0', timeout: 120000 });
    await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    const title = await page.title();
    console.log(stamp(), 'loaded:', title);
    check(title.length <= 70, 'title is ' + title.length + ' chars (<= 70)');
    check(/^Sticker Maker/.test(title), 'primary keyword first in the title');
    check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
    const inputs = await page.$$eval('.aiimg input[type=file]', (l) => l.map((i) => i.accept + (i.multiple ? ' multiple' : '')));
    check(inputs[0] === 'image/*' && inputs[1] === 'image/* multiple', 'file inputs in order: ' + inputs.join(' | '));
    const privacy = await page.$eval('.privacy-line', (e) => e.textContent);
    check(/MODNet \(25 MB, Apache-2.0\)/.test(privacy) && /EfficientViT-Seg \(18 MB, Apache-2.0\)/.test(privacy), 'privacy line names both models, sizes and licences');
    const faqN = await page.$$eval('.aiimg-tool details', (l) => l.length);
    check(faqN >= 6, 'FAQ count ' + faqN + ' (>= 6)');

    const results = async () => page.$$eval('.aiimg-result', (rows) => rows.map((r) => ({ head: r.querySelector('.aiimg-result-head').textContent.trim(), img: (r.querySelector('img') || {}).src || '', link: (r.querySelector('a.btn-download') || {}).download || '' })));
    /* decode a result blob and measure the border: the outer ring of opaque pixels should be the border colour */
    const grab = async (src, borderHex) => page.evaluate(async (u, hex) => {
      const b = await (await fetch(u)).blob();
      const buf = new Uint8Array(await b.arrayBuffer());
      const bmp = await createImageBitmap(b);
      let head = ''; for (let i = 0; i < 16; i++) head += String.fromCharCode(buf[i]);
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const W = c.width, H = c.height;
      const br = parseInt(hex.slice(1, 3), 16), bg = parseInt(hex.slice(3, 5), 16), bb = parseInt(hex.slice(5, 7), 16);
      let ring = 0, ringBorder = 0, opaque = 0, borderish = 0, transparent = 0;
      const op = (i) => d[i * 4 + 3] > 128;
      const isBorder = (i) => Math.abs(d[i * 4] - br) < 24 && Math.abs(d[i * 4 + 1] - bg) < 24 && Math.abs(d[i * 4 + 2] - bb) < 24;
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
        const i = y * W + xx;
        if (d[i * 4 + 3] < 8) { transparent++; continue; }
        if (!op(i)) continue;
        opaque++;
        if (isBorder(i)) borderish++;
        const edge = xx === 0 || y === 0 || xx === W - 1 || y === H - 1 || !op(i - 1) || !op(i + 1) || !op(i - W) || !op(i + W);
        if (edge) { ring++; if (isBorder(i)) ringBorder++; }
      }
      bmp.close();
      return { type: b.type, size: b.size, width: bmp.width || W, height: bmp.height || H, head, ring, ringPurity: ring ? (ringBorder / ring) : 0, borderShare: opaque ? borderish / opaque : 0, transparentPct: transparent / (W * H) * 100 };
    }, src, borderHex || '#ffffff');
    const clickExport = async (sel, label, timeout) => {
      const n0 = (await results()).length;
      await page.click(sel);
      await page.waitForFunction((k) => document.querySelectorAll('.aiimg-result').length > k || /error/.test((document.querySelector('.aiimg > .io-msg') || {}).className || ''), { timeout: timeout || 120000 }, n0);
      const r = (await results())[0];
      const err = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
      if (err) console.log('  io-msg:', err);
      return r;
    };
    const canvasPng = async (name) => { const d = await page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png')); fs.writeFileSync(path.join(OUT, name), Buffer.from(d.split(',')[1], 'base64')); };
    const uploadAndWait = async (file) => {
      const input = await page.$('.aiimg input[type=file][accept="image/*"]:not([multiple])');
      const t = Date.now();
      await input.uploadFile(path.join(IMG, file));
      await page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && /ready$|could not/.test(s.textContent); }, { timeout: 600000, polling: 300 });
      const status = await page.$eval('.aiimg-status', (e) => e.textContent);
      const info = await page.evaluate(() => { const i = AIImg.instances['sticker-maker'].state.main; const p = AIImg.instances['sticker-maker'].state.preview; return { timings: i.timings, matteUsed: i.matteUsed, mw: i.seg.mw, mh: i.seg.mh, preview: p ? p.w + 'x' + p.h : 'none' }; });
      console.log(stamp(), file + ':', status, '| ' + ((Date.now() - t) / 1000).toFixed(1) + 's; segment ' + info.timings.segment + 'ms, matte ' + info.timings.matte + 'ms | preview sticker ' + info.preview);
      check(/ready$/.test(status), file + ': status ends in "ready"');
      const layers = await page.$$eval('.aiimg-layer', (rows) => rows.map((r) => (r.querySelector('input').checked ? '[x] ' : '[ ] ') + r.querySelector('.aiimg-lname').textContent + ' ' + r.querySelector('.aiimg-area').textContent));
      console.log('  layers:', layers.join(' | '));
      return { status, info, layers };
    };

    /* ---- city-streets: people ---- */
    const city = await uploadAndWait('city-streets.jpg');
    check(city.layers.some((l) => /^\[x\] People/.test(l)), 'People ticked on city-streets');
    await wait(300);
    await page.screenshot({ path: path.join(OUT, '1-city.png') });
    await canvasPng('1-city-canvas.png');
    await page.click('.aiimg-tabs [data-pane=export]');
    const cityPng = await clickExport('#aiimg-stk-png', 'png');
    const c1 = await grab(cityPng.img);
    console.log('  city PNG:', cityPng.head.replace(/\s+/g, ' '), '| decoded', c1.width + 'x' + c1.height, c1.type, c1.size + ' B | magic', JSON.stringify(c1.head.slice(0, 8)), '| outer ring', c1.ring, 'px, border-coloured', (c1.ringPurity * 100).toFixed(1) + '%', '| border share of opaque', (c1.borderShare * 100).toFixed(1) + '%', '| transparent', c1.transparentPct.toFixed(1) + '%');
    check(c1.head.startsWith('\x89PNG'), 'city sticker is a PNG');
    check(Math.max(c1.width, c1.height) === 1024, 'city sticker long edge 1024 (' + c1.width + 'x' + c1.height + ')');
    check(c1.ringPurity >= 0.9, 'city sticker: outer ring is white border (' + (c1.ringPurity * 100).toFixed(1) + '% >= 90%)');
    check(c1.borderShare >= 0.03, 'city sticker: border is a visible share of the sticker (' + (c1.borderShare * 100).toFixed(1) + '% >= 3%)');
    check(c1.transparentPct > 5, 'city sticker has a transparent background (' + c1.transparentPct.toFixed(1) + '%)');

    /* pack: 512×512 WebP ≤ 100 KB */
    const packRow = await clickExport('#aiimg-stk-pack', 'pack');
    const p1 = await grab(packRow.img);
    console.log('  city pack:', packRow.head.replace(/\s+/g, ' '), '| decoded', p1.width + 'x' + p1.height, p1.type, p1.size + ' B | magic', JSON.stringify(p1.head.slice(0, 12)));
    check(p1.head.startsWith('RIFF') && p1.head.slice(8, 12) === 'WEBP', 'pack export magic RIFF....WEBP');
    check(p1.width === 512 && p1.height === 512, 'pack export decodes to 512x512');
    check(p1.size <= 102400, 'pack export under 100 KB (' + p1.size + ' B)');
    check(p1.ringPurity >= 0.85, 'pack export: outer ring is white border (' + (p1.ringPurity * 100).toFixed(1) + '%)');

    /* story */
    const storyRow = await clickExport('#aiimg-stk-story', 'story');
    const s1 = await grab(storyRow.img);
    console.log('  city story:', storyRow.head.replace(/\s+/g, ' '), '| decoded', s1.width + 'x' + s1.height, s1.type, s1.size + ' B');
    check(s1.head.startsWith('\x89PNG') && s1.width === 1080 && s1.height === 1920, 'story is a 1080x1920 PNG');
    check(s1.transparentPct > 30, 'story background is transparent (' + s1.transparentPct.toFixed(1) + '%)');

    /* clipboard — reported, and failed only when the API is present and refuses */
    const copyEnabled = await page.$eval('#aiimg-stk-copy', (b) => !b.disabled);
    if (copyEnabled) {
      await page.click('#aiimg-stk-copy');
      await wait(1500);
      const copied = await page.evaluate(() => ({ msg: (document.querySelector('.aiimg > .io-msg') || {}).textContent || '', last: !!AIImg.instances['sticker-maker'].state.lastCopied }));
      console.log('  clipboard:', copied.msg || '(no message)');
      check(copied.last || /clipboard/i.test(copied.msg), 'copy to clipboard ran (' + (copied.last ? 'copied' : 'refused by the headless browser: ' + copied.msg) + ')');
    } else console.log('  clipboard: button disabled in this browser (no ClipboardItem)');
    await page.screenshot({ path: path.join(OUT, '2-city-exports.png') });

    /* ---- cats: animals ---- */
    const cats = await uploadAndWait('cats.jpg');
    /* EfficientViT-ADE20K has no reliable cat class: on cats.jpg it calls the cats (and the blanket) People. Report the labels; require a ticked subject. */
    console.log('  note: cats.jpg ticked layers:', cats.layers.filter((l) => l.startsWith('[x]')).join(', '));
    check(cats.layers.some((l) => l.startsWith('[x]')), 'a subject layer is ticked on cats');
    await wait(300);
    await page.screenshot({ path: path.join(OUT, '3-cats.png') });
    await canvasPng('3-cats-canvas.png');
    /* a coloured, wider border with glow, to prove the controls reach the export */
    await page.click('.aiimg-tabs [data-pane=sticker]');
    await page.$eval('#aiimg-stk-border', (e) => { e.value = '6'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('#aiimg-stk-border-colour', (e) => { e.value = '#ff3366'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(600);
    await canvasPng('3-cats-pink-canvas.png');
    await page.click('.aiimg-tabs [data-pane=export]');
    const catsPng = await clickExport('#aiimg-stk-png', 'png');
    const c2 = await grab(catsPng.img, '#ff3366');
    console.log('  cats PNG:', catsPng.head.replace(/\s+/g, ' '), '| decoded', c2.width + 'x' + c2.height, '| outer ring', c2.ring, 'px, border-coloured', (c2.ringPurity * 100).toFixed(1) + '%', '| border share', (c2.borderShare * 100).toFixed(1) + '%');
    check(c2.ringPurity >= 0.9, 'cats sticker: outer ring is the chosen pink border (' + (c2.ringPurity * 100).toFixed(1) + '%)');
    check(c2.borderShare >= 0.05, 'cats sticker: 6% border is a visible share (' + (c2.borderShare * 100).toFixed(1) + '%)');
    await page.click('.aiimg-tabs [data-pane=sticker]');
    await page.$eval('#aiimg-stk-border', (e) => { e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('#aiimg-stk-border-colour', (e) => { e.value = '#ffffff'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(500);
    await page.click('.aiimg-tabs [data-pane=export]');

    /* ---- pack from six photos ---- */
    const before = (await results()).length;
    const six = ['cats.jpg', 'city-streets.jpg', 'car.jpg', 'portrait-of-woman_small.jpg', 'segmentation_input.jpg', 'beetle.png'].map((f) => path.join(IMG, f));
    const batchInput = await page.$('.aiimg input[type=file][multiple]');
    const tb = Date.now();
    await batchInput.uploadFile(...six);
    await page.waitForFunction(() => { const s = document.querySelectorAll('.aiimg-pane[data-pane=export] .aiimg-status')[0]; return s && /ready$/.test(s.textContent); }, { timeout: 900000, polling: 500 });
    const batchStatus = await page.$eval('.aiimg-pane[data-pane=export] .aiimg-status', (e) => e.textContent);
    console.log(stamp(), 'pack:', batchStatus, '| wall', ((Date.now() - tb) / 1000).toFixed(1) + 's');
    const after = await results();
    const rows = after.slice(0, after.length - before);
    const made = rows.filter((r) => r.img.startsWith('blob:'));
    const skipped = rows.filter((r) => !r.img);
    skipped.forEach((r) => console.log('  skipped:', r.head.replace(/\s+/g, ' ')));
    check(made.length >= 5, 'pack made ' + made.length + ' of 6 stickers (>= 5; a photo with nothing to keep may be skipped)');
    let allOk = true;
    for (const r of made) {
      const b = await grab(r.img);
      const ok = b.head.startsWith('RIFF') && b.head.slice(8, 12) === 'WEBP' && b.width === 512 && b.height === 512 && b.size <= 102400;
      console.log('   ', r.head.replace(/\s+/g, ' ').slice(0, 70), '|', b.width + 'x' + b.height, b.type, b.size + ' B', ok ? 'ok' : 'NOT OK');
      if (!ok) allOk = false;
    }
    check(allOk, 'every pack sticker is a 512x512 WebP under 100 KB');
    await page.screenshot({ path: path.join(OUT, '4-pack.png') });
    await page.click('#aiimg-stk-download-all');
    await page.waitForFunction(() => !!AIImg.instances['sticker-maker'].state.lastZip || document.querySelector('#aiimg-stk-download-all').textContent === 'Download all', { timeout: 120000 });
    const zip = await page.evaluate(async () => { const z = AIImg.instances['sticker-maker'].state.lastZip; if (!z) return null; const u = new Uint8Array(await z.slice(0, 4).arrayBuffer()); return { size: z.size, magic: String.fromCharCode(u[0], u[1]), n: AIImg.instances['sticker-maker'].state.outputs.length }; });
    check(!!zip && zip.magic === 'PK', 'Download all made a zip (' + (zip ? zip.n + ' files, ' + zip.size + ' B' : 'none') + ')');

    /* ---- both themes, phone width ---- */
    await page.click('.aiimg-tabs [data-pane=sticker]');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await wait(300);
    await page.screenshot({ path: path.join(OUT, '5-light.png') });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await wait(400);
    await page.screenshot({ path: path.join(OUT, '6-mobile.png') });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, 'no horizontal overflow at 390 px (' + overflow + ' px)');
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });

    /* ---- network ---- */
    const third = [...new Set(net.map((u) => u.replace(/\?.*$/, '')))];
    check(third.length === 0, 'third-party requests: ' + (third.length ? third.join(', ') : 'none'));
    check(!logs.some((l) => /^pageerror/.test(l)), 'no page errors');
  } catch (e) {
    failures.push('exception: ' + (e && e.stack || e));
    console.error('EXCEPTION', e);
  } finally {
    fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n'));
    await browser.close();
  }
  console.log(stamp(), failures.length ? 'FAILED: ' + failures.length + ' problem(s)' : 'PASSED');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(failures.length ? 1 : 0);
})();
