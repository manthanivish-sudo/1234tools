/*
 * Drives /ai-image/background-remover/ in headless Chrome against a local
 * static server of the export, and proves what the page claims:
 *
 *   - the page mounts, its title fits, nothing is fetched from a third party
 *   - a portrait is cut with MODNet edges that beat the layer mask in the
 *     hair band (semi-transparent pixel count and boundary gradient, printed)
 *   - every crop exports at its ratio, PNG and WebP carry their magic bytes
 *   - a batch of 20 completes, each with its own download, plus one zip
 *
 *   node build/ai-image/tests/background-remover.js --root <export-dir> --port 8721 [--out dir] [--img dir]
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
const OUT = flag('out', path.join(ROOT, 'build', 'ai-image', 'tests', 'out', 'background-remover'));
const IMG = flag('img', 'E:/tmp/1234-agents/harness/img');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:' + PORT;
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failures.push(what); return ok; };
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ratio = (w, h) => (w / h).toFixed(4);

(async () => {
  for (const f of ['engine/models/modnet-photographic-portrait-matting.onnx.part0', 'engine/models/modnet-photographic-portrait-matting.onnx.part1', 'engine/models/LICENSE-modnet.txt', 'engine/models/README-modnet.txt', 'engine/aiimg-matte.js', 'ai-image/background-remover/index.html']) {
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
    /* decline analytics before the page loads: the consent banner sits over
       the lower side pane and would swallow clicks meant for the export buttons */
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* private mode */ } });

    await page.goto(BASE + '/ai-image/background-remover/', { waitUntil: 'networkidle0', timeout: 120000 });
    await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    const title = await page.title();
    console.log(stamp(), 'loaded:', title);
    check(title.length <= 70, 'title is ' + title.length + ' chars (<= 70)');
    check(/^Background Remover/.test(title), 'primary keyword first in the title');
    const h1 = await page.$eval('h1', (e) => e.textContent.trim());
    check(h1 === 'AI Background Remover', 'h1 = ' + h1);
    check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
    const inputs = await page.$$eval('.aiimg input[type=file]', (l) => l.map((i) => i.accept + (i.multiple ? ' multiple' : '')));
    check(inputs[0] === 'image/*' && inputs[1] === 'image/* multiple', 'file inputs in order: ' + inputs.join(' | '));
    const privacy = await page.$eval('.privacy-line', (e) => e.textContent);
    check(/MODNet \(25 MB, Apache-2.0\)/.test(privacy) && /EfficientViT-Seg \(18 MB, Apache-2.0\)/.test(privacy), 'privacy line names both models, sizes and licences');
    const faqN = await page.$$eval('.aiimg-tool details', (l) => l.length);
    check(faqN >= 6, 'FAQ count ' + faqN + ' (>= 6)');
    await page.screenshot({ path: path.join(OUT, '0-empty.png') });

    /* ---- the portrait ---- */
    const input = await page.$('.aiimg input[type=file][accept="image/*"]:not([multiple])');
    const tUp = Date.now();
    await input.uploadFile(path.join(IMG, 'portrait-of-woman_small.jpg'));
    await page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && /ready|could not/.test(s.textContent); }, { timeout: 600000, polling: 300 });
    const status = await page.$eval('.aiimg-status', (e) => e.textContent);
    console.log(stamp(), 'status:', status);
    check(/ready$/.test(status), 'status ends in "ready"');
    const timings = await page.evaluate(() => { const i = AIImg.instances['background-remover'].state.main; return { timings: i.timings, matteInfo: i.matteInfo, matteUsed: i.matteUsed, matteSkipped: i.matteSkipped, mw: i.seg.mw, mh: i.seg.mh, input: i.seg.input }; });
    console.log('  first photo took', ((Date.now() - tUp) / 1000).toFixed(1) + 's including model downloads; segment', timings.timings.segment + 'ms, matte', timings.timings.matte + 'ms (network run', timings.matteInfo && timings.matteInfo.ms + 'ms, input ' + (timings.matteInfo && timings.matteInfo.input.join('x')) + ')', '| mask', timings.mw + 'x' + timings.mh, '| seg input', timings.input.join('x'));
    const layers = await page.$$eval('.aiimg-layer', (rows) => rows.map((r) => ({ name: r.querySelector('.aiimg-lname').textContent, area: r.querySelector('.aiimg-area').textContent, on: r.querySelector('input').checked })));
    console.log('  layers:', layers.map((l) => (l.on ? '[x] ' : '[ ] ') + l.name + ' ' + l.area).join(' | '));
    check(layers.some((l) => l.name === 'People' && l.on), 'People layer found and ticked');
    check(await page.$eval('#aiimg-bgr-hair', (e) => e.checked && !e.closest('div[hidden]')), 'hair-quality toggle shown and on');
    check(timings.matteUsed >= 1, 'MODNet applied to ' + timings.matteUsed + ' people region(s)');
    await wait(300);
    await page.screenshot({ path: path.join(OUT, '1-portrait.png') });

    /* hair-edge numbers: the band within 10 px of the person class boundary, upper half of the person box */
    const hair = await page.evaluate(() => {
      const M = AIImg.matte;
      const item = AIImg.instances['background-remover'].state.main;
      const { mw, mh, classMap, layers } = item.seg;
      const pk = M.personKey(item.seg);
      const n = mw * mh;
      const people = new Uint8Array(n), notPeople = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (classMap[i] === pk) people[i] = 1; else notPeople[i] = 1; }
      const dOut = M.distance(people, mw, mh), dIn = M.distance(notPeople, mw, mh);
      const box = layers.find((l) => l.key === pk).bbox;
      const yMax = box[1] + (box[3] - box[1]) * 0.5;
      const stats = (a) => {
        let semi = 0, band = 0, grad = 0, gn = 0;
        for (let y = 1; y < mh - 1; y++) {
          if (y > yMax) break;
          for (let x = 1; x < mw - 1; x++) {
            const i = y * mw + x;
            if (dOut[i] > 10 && dIn[i] > 10) continue;
            band++;
            if (a[i] > 0.05 && a[i] < 0.95) semi++;
            const gx = a[i + 1] - a[i - 1], gy = a[i + mw] - a[i - mw];
            grad += Math.hypot(gx, gy); gn++;
          }
        }
        return { band, semi, semiPct: (semi / band * 100).toFixed(2), meanGrad: (grad / gn).toFixed(4) };
      };
      const toPng = (a) => { const c = document.createElement('canvas'); c.width = mw; c.height = mh; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, mw, mh); x.globalCompositeOperation = 'destination-in'; x.drawImage(AIImg.maskCanvas(a, mw, mh), 0, 0); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#000'; x.fillRect(0, 0, mw, mh); return c.toDataURL('image/png'); };
      return { layer: stats(item.alphaLayer), full: stats(item.alphaFull), pngLayer: toPng(item.alphaLayer), pngFull: toPng(item.alphaFull) };
    });
    fs.writeFileSync(path.join(OUT, 'alpha-layer-mask.png'), Buffer.from(hair.pngLayer.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, 'alpha-modnet-blend.png'), Buffer.from(hair.pngFull.split(',')[1], 'base64'));
    console.log('  hair band (upper half of the person, within 10 px of the class boundary): ' + hair.layer.band + ' px');
    console.log('    layer mask only : semi-transparent ' + hair.layer.semi + ' (' + hair.layer.semiPct + '%), mean |grad alpha| ' + hair.layer.meanGrad);
    console.log('    with MODNet     : semi-transparent ' + hair.full.semi + ' (' + hair.full.semiPct + '%), mean |grad alpha| ' + hair.full.meanGrad);
    check(hair.full.semi > hair.layer.semi * 1.3, 'MODNet blend has >= 1.3x the semi-transparent pixels of the layer mask in the hair band (' + hair.full.semi + ' vs ' + hair.layer.semi + ')');

    /* compare view: left half layer mask, right half MODNet */
    const canvasPng = async (name) => { const d = await page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png')); fs.writeFileSync(path.join(OUT, name), Buffer.from(d.split(',')[1], 'base64')); };
    await page.select('#aiimg-bgr-view', 'split');
    await wait(400);
    await page.screenshot({ path: path.join(OUT, '2-compare.png') });
    await canvasPng('2-compare-canvas.png');
    await page.select('#aiimg-bgr-view', 'layer'); await wait(300); await canvasPng('2a-layer-only-canvas.png');
    await page.select('#aiimg-bgr-view', 'mask'); await wait(300); await canvasPng('2b-mask-canvas.png');
    await page.select('#aiimg-bgr-view', 'result'); await wait(300); await canvasPng('2c-result-canvas.png');

    /* toggling MODNet off and on changes the alpha */
    await page.click('#aiimg-bgr-hair');
    await wait(500);
    const offSemi = await page.evaluate(() => { const i = AIImg.instances['background-remover'].state.main; let s = 0; for (let k = 0; k < i.alphaFull.length; k++) if (i.alphaFull[k] > 0.05 && i.alphaFull[k] < 0.95) s++; return s; });
    await page.click('#aiimg-bgr-hair');
    await wait(500);
    const onSemi = await page.evaluate(() => { const i = AIImg.instances['background-remover'].state.main; let s = 0; for (let k = 0; k < i.alphaFull.length; k++) if (i.alphaFull[k] > 0.05 && i.alphaFull[k] < 0.95) s++; return s; });
    check(onSemi !== offSemi, 'hair toggle changes the alpha (semi-transparent whole-frame: off ' + offSemi + ', on ' + onSemi + ')');

    /* ---- exports: crops and formats ---- */
    const results = async () => page.$$eval('.aiimg-result', (rows) => rows.map((r) => ({ head: r.querySelector('.aiimg-result-head').textContent.trim(), img: (r.querySelector('img') || {}).src || '', link: (r.querySelector('a.btn-download') || {}).download || '' })));
    const grab = async (src) => page.evaluate(async (u) => {
      const b = await (await fetch(u)).blob();
      const buf = new Uint8Array(await b.arrayBuffer());
      const bmp = await createImageBitmap(b);
      let head = ''; for (let i = 0; i < 16; i++) head += String.fromCharCode(buf[i]);
      /* transparency: count alpha < 250 on a small decode */
      const c = document.createElement('canvas'); c.width = Math.min(256, bmp.width); c.height = Math.round(c.width * bmp.height / bmp.width);
      const x = c.getContext('2d'); x.drawImage(bmp, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data; let tr = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) tr++;
      const out = { type: b.type, size: b.size, width: bmp.width, height: bmp.height, head, transparentPct: (tr / (d.length / 4) * 100).toFixed(1) };
      bmp.close();
      return out;
    }, src);
    const exportOne = async (label) => {
      const n0 = (await results()).length;
      await page.click('#aiimg-bgr-download');
      await page.waitForFunction((k) => document.querySelectorAll('.aiimg-result').length > k, { timeout: 60000 }, n0);
      const r = (await results())[0];
      const b = await grab(r.img);
      console.log('  ' + label + ': ' + r.head.replace(/\s+/g, ' ') + ' | decoded ' + b.width + 'x' + b.height + ' ratio ' + ratio(b.width, b.height) + ' | ' + b.type + ' ' + b.size + ' B | magic ' + JSON.stringify(b.head.slice(0, 12)) + ' | transparent ' + b.transparentPct + '%');
      check(r.img.startsWith('blob:') && r.link.length > 0, label + ': result row has a blob img and a download link (' + r.link + ')');
      return b;
    };
    await page.click('.aiimg-tabs [data-pane=export]');
    const sizes = { original: null, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };
    const saved = {};
    for (const crop of Object.keys(sizes)) {
      await page.select('#aiimg-bgr-crop', crop);
      await wait(200);
      if (crop === '9:16') { await page.click('.aiimg-tabs [data-pane=background]'); await wait(200); await page.screenshot({ path: path.join(OUT, '3-crop-9x16-frame.png') }); await page.click('.aiimg-tabs [data-pane=export]'); }
      const b = await exportOne('crop ' + crop);
      check(b.head.startsWith('\x89PNG'), 'crop ' + crop + ' is a PNG (magic \\x89PNG)');
      if (sizes[crop]) check(Math.abs(b.width / b.height - sizes[crop]) < 0.01, 'crop ' + crop + ' ratio ' + ratio(b.width, b.height) + ' ~ ' + sizes[crop].toFixed(4));
      else check(b.width === 360 && b.height === 450, 'original crop keeps 360x450');
      check(Number(b.transparentPct) > 5, 'crop ' + crop + ' has transparency (' + b.transparentPct + '%)');
      saved[crop] = b;
    }
    /* WebP at 1:1, 720 px */
    await page.select('#aiimg-bgr-fmt', 'image/webp');
    await page.select('#aiimg-bgr-size', '720');
    await page.select('#aiimg-bgr-crop', '1:1');
    const webp = await exportOne('webp 1:1 720');
    check(webp.head.startsWith('RIFF') && webp.head.slice(8, 12) === 'WEBP', 'WebP magic RIFF....WEBP');
    check(webp.width === 360 && webp.height === 360, 'WebP 1:1 at the photo\'s 360 px (cap 720 does not upscale)');
    await page.select('#aiimg-bgr-fmt', 'image/png');
    await page.select('#aiimg-bgr-size', '0');
    await page.select('#aiimg-bgr-crop', 'original');

    /* ---- backgrounds ---- */
    await page.click('.aiimg-tabs [data-pane=background]');
    for (const [mode, name] of [['colour', '4-bg-colour'], ['gradient', '4-bg-gradient'], ['blur', '4-bg-blur']]) {
      await page.select('#aiimg-bgr-bg', mode);
      await wait(350);
      await page.screenshot({ path: path.join(OUT, name + '.png') });
    }
    await page.click('.aiimg-tabs [data-pane=export]');
    const blurred = await exportOne('blur background');
    check(Number(blurred.transparentPct) < 1, 'blurred background export is opaque (' + blurred.transparentPct + '% transparent)');
    await page.click('.aiimg-tabs [data-pane=background]');
    await page.select('#aiimg-bgr-bg', 'transparent');
    await page.click('.aiimg-tabs [data-pane=export]');

    /* ---- batch of 20 ---- */
    const before = (await results()).length;
    const five = ['portrait-of-woman_small.jpg', 'city-streets.jpg', 'segmentation_input.jpg', 'car.jpg', 'cats.jpg'].map((f) => path.join(IMG, f));
    const twenty = [].concat(five, five, five, five);
    const batchInput = await page.$('.aiimg input[type=file][multiple]');
    const tb = Date.now();
    await batchInput.uploadFile(...twenty);
    await page.waitForFunction(() => { const s = document.querySelectorAll('.aiimg-pane[data-pane=export] .aiimg-status')[0]; return s && /ready$/.test(s.textContent); }, { timeout: 900000, polling: 500 });
    const batchStatus = await page.$eval('.aiimg-pane[data-pane=export] .aiimg-status', (e) => e.textContent);
    console.log(stamp(), 'batch:', batchStatus, '| wall', ((Date.now() - tb) / 1000).toFixed(1) + 's');
    const after = await results();
    const batchRows = after.slice(0, after.length - before);
    const withImg = batchRows.filter((r) => r.img.startsWith('blob:') && r.link);
    check(/Batch done: 20 of 20/.test(batchStatus), 'batch status reports 20 of 20');
    check(withImg.length === 20, 'batch produced 20 result rows with blob previews and download links (' + withImg.length + ')');
    const b0 = await grab(withImg[0].img), b19 = await grab(withImg[19].img);
    console.log('  batch first:', withImg[0].head.replace(/\s+/g, ' '), '|', b0.width + 'x' + b0.height, b0.type, b0.size + ' B');
    console.log('  batch last :', withImg[19].head.replace(/\s+/g, ' '), '|', b19.width + 'x' + b19.height, b19.type, b19.size + ' B');
    check(b0.head.startsWith('\x89PNG') && b19.head.startsWith('\x89PNG'), 'batch results are PNGs');
    await page.screenshot({ path: path.join(OUT, '5-batch.png') });

    /* download all → one zip */
    await page.click('#aiimg-bgr-download-all');
    await page.waitForFunction(() => { const s = AIImg.instances['background-remover'].state; return !!s.lastZip || document.querySelector('#aiimg-bgr-download-all').textContent === 'Download all'; }, { timeout: 120000 });
    const zip = await page.evaluate(async () => { const z = AIImg.instances['background-remover'].state.lastZip; if (!z) return null; const u = new Uint8Array(await z.slice(0, 4).arrayBuffer()); return { size: z.size, type: z.type, magic: String.fromCharCode(u[0], u[1]), n: AIImg.instances['background-remover'].state.outputs.length }; });
    check(!!zip && zip.magic === 'PK', 'Download all made a zip (' + (zip ? zip.n + ' files, ' + zip.size + ' B, ' + zip.type : 'none') + ')');

    /* ---- both themes, phone width ---- */
    await page.click('.aiimg-tabs [data-pane=layers]');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await wait(300);
    await page.screenshot({ path: path.join(OUT, '6-light.png') });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await wait(400);
    await page.screenshot({ path: path.join(OUT, '7-mobile.png') });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, 'no horizontal overflow at 390 px (' + overflow + ' px)');
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });

    /* ---- network ---- */
    const third = [...new Set(net.map((u) => u.replace(/\?.*$/, '')))];
    check(third.length === 0, 'third-party requests: ' + (third.length ? third.join(', ') : 'none'));
    const pageErrors = logs.filter((l) => /^pageerror/.test(l));
    check(pageErrors.length === 0, 'no page errors');
    await page.screenshot({ path: path.join(OUT, '8-final.png'), fullPage: false });
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
