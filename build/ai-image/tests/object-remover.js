/*
 * Drives /ai-image/object-remover/ in headless Chrome against a local
 * server and proves the tool works end to end:
 *
 *   1. city-streets.jpg — "Remove all people": the People layer of the
 *      result, re-segmented, must be under 20% of its original area, and
 *      the pixels inside the old mask must differ from the original. The
 *      before/after divider is dragged.
 *   2. car.jpg — brush strokes synthesised with mouse events over the car's
 *      bounding box, then "Remove the selection"; still PNG, MP4 and GIF
 *      exports checked by their magic bytes.
 *   3. a 4000 px photo made in the page from city-streets.jpg — "Remove all
 *      people" must take the tiled path; time and peak JS heap reported
 *      (the heap must stay under 900 MB).
 *
 * Zero third-party requests throughout. Exits non-zero on any failure.
 *
 *   node object-remover.js [--port 8724] [--root <export dir>] [--out <dir>] [--img <dir>] [--quick]
 *
 * With --root the static server (harness/serve.js) is started for the run;
 * without it one must already be listening on --port.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8724));
const ROOT = flag('root', null);
const OUT = flag('out', 'E:/tmp/1234-agents/C4-eraser/out');
const IMG = flag('img', 'E:/tmp/1234-agents/harness/img');
const QUICK = flag('quick', false) === true;
const SERVE = flag('serve', 'E:/tmp/1234-agents/harness/serve.js');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failures.push(what); };
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let server = null;
  if (ROOT) {
    server = spawn(process.execPath, [SERVE, ROOT, String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((res) => server.stdout.on('data', () => res()));
  }
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU', '--enable-precise-memory-info'],
    protocolTimeout: 900000
  });
  const logs = [];
  const net = [];
  let page;
  const save = () => { try { fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n')); } catch (e) { /* */ } };
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    page.on('console', (m) => { const t = stamp() + ' ' + m.type() + ': ' + m.text(); logs.push(t); if (/error|warn/i.test(m.type()) || /object-remover/.test(m.text())) console.log('  [console]', t.slice(0, 300)); });
    page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); });
    page.on('requestfailed', (r) => { logs.push('requestfailed ' + r.url()); console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText); });
    page.on('request', (r) => { const u = r.url(); if (!/^(data|blob):/.test(u) && !u.startsWith('http://127.0.0.1:' + PORT + '/')) net.push(u); });
    const big = (u) => /\.(onnx|wasm)$/.test(u);
    page.on('response', (r) => { if (big(r.url())) logs.push(stamp() + ' response ' + r.status() + ' ' + r.url().split('/').pop()); });

    const URL = 'http://127.0.0.1:' + PORT + '/ai-image/object-remover/';
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 });
    const title = await page.title();
    console.log(stamp(), 'page loaded; title =', title, '(' + title.length + ')');
    check(title.length <= 70 && / \| 1234Tools$/.test(title), 'title is at most 70 characters and ends in " | 1234Tools"');
    const h1 = await page.$eval('h1', (e) => e.textContent.trim());
    const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
    const active = await page.$eval('.side-link.is-active', (e) => e.getAttribute('href')).catch(() => null);
    console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '), '| sidebar active =', active);
    check(h1 === 'Object & People Remover', 'h1 is the tool title');
    check(active === '/ai-image/', 'sidebar marks /ai-image/ active');
    const faqN = await page.$$eval('.aiimg-tool details', (d) => d.length);
    const privacy = await page.$eval('.privacy-line', (e) => e.textContent);
    check(faqN >= 6, 'FAQ has at least 6 entries (' + faqN + ')');
    check(/MI-GAN/.test(privacy) && /EfficientViT/.test(privacy) && /MIT/.test(privacy) && /Apache-2\.0/.test(privacy) && /28 MB/.test(privacy) && /18 MB/.test(privacy), 'privacy line names both models, sizes and licences');
    const inputs = await page.$$eval('.aiimg input[type=file]', (l) => l.map((i) => i.accept));
    check(inputs.length === 1 && inputs[0] === 'image/*', 'exactly one file input accepting image/*');
    check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
    await page.screenshot({ path: path.join(OUT, '1-empty.png') });

    const status = () => page.$eval('.aiimg-status', (e) => e.textContent);
    const waitReady = async (label, timeout) => {
      await page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && (/ready$/.test(s.textContent) || /failed/.test(s.textContent)); }, { timeout: timeout || 600000, polling: 400 });
      const s = await status();
      console.log(stamp(), label + ':', s);
      const err = await page.$eval('.aiimg > .io-msg', (e) => e.textContent).catch(() => '');
      if (err) console.log('  io-msg:', err);
      return s;
    };
    const waitBusyThenReady = async (label, timeout) => {
      await page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && !/ready$/.test(s.textContent); }, { timeout: 20000, polling: 100 }).catch(() => {});
      return waitReady(label, timeout);
    };
    const waitLoaded = async (name, label) => {
      await page.waitForFunction((n) => { const t = document.querySelector('.tool'); const S = t && t.aiimgEraser && t.aiimgEraser.state; const s = document.querySelector('.aiimg-status');
        return S && S.name === n && !S.segBusy && s && /ready$/.test(s.textContent); }, { timeout: 600000, polling: 300 }, name);
      return waitReady(label);
    };
    const runsNow = () => page.evaluate(() => document.querySelector('.tool').aiimgEraser.state.stats.runs.length);
    const waitRemoved = async (before, label, timeout) => {
      await page.waitForFunction((b) => { const S = document.querySelector('.tool').aiimgEraser.state; const s = document.querySelector('.aiimg-status');
        return (S.stats.runs.length > b && !S.job && /ready$/.test(s.textContent)) || /failed/.test(s.textContent); }, { timeout: timeout || 600000, polling: 300 }, before);
      return waitReady(label);
    };
    const canvasRect = async () => {
      await page.$eval('.aiimg-canvas', (c) => c.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await wait(600);
      return page.$eval('.aiimg-canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    };
    const upload = async (file) => {
      const input = await page.$('.aiimg input[type=file][accept="image/*"]');
      await input.uploadFile(file);
      console.log(stamp(), 'uploaded', path.basename(file));
    };
    const state = (expr) => page.evaluate('(() => { const S = document.querySelector(".tool").aiimgEraser.state; return ' + expr + '; })()');
    const layers = () => state('S.seg ? S.seg.layers.map((l) => ({ label: l.label, name: l.name, area: l.area, bbox: l.bbox, mw: S.seg.mw, mh: S.seg.mh })) : []');
    /* Re-segment the current working picture and compare the pixels under the last mask with the original. */
    const verify = (label) => page.evaluate(async (lab) => {
      const S = document.querySelector('.tool').aiimgEraser.state;
      const o = S.original.getContext('2d').getImageData(0, 0, S.W, S.H).data;
      const c = S.image.getContext('2d').getImageData(0, 0, S.W, S.H).data;
      const m = S.lastMask;
      let n = 0, sum = 0, changed = 0;
      for (let i = 0; i < m.length; i++) {
        if (m[i] <= 6) continue;
        n++;
        const d = (Math.abs(o[i * 4] - c[i * 4]) + Math.abs(o[i * 4 + 1] - c[i * 4 + 1]) + Math.abs(o[i * 4 + 2] - c[i * 4 + 2])) / 3;
        sum += d; if (d > 8) changed++;
      }
      let outside = 0, outN = 0;
      for (let i = 0; i < m.length; i += 97) { if (m[i]) continue; outN++; if (o[i * 4] !== c[i * 4] || o[i * 4 + 1] !== c[i * 4 + 1] || o[i * 4 + 2] !== c[i * 4 + 2]) outside++; }
      const seg = await AIImg.segment({ canvas: S.image, width: S.W, height: S.H }, { detail: 'standard' });
      const L = seg.layers.find((l) => l.label === lab);
      return { maskPx: n, meanDiff: sum / Math.max(1, n), changedFrac: changed / Math.max(1, n), outsideChanged: outside / Math.max(1, outN), areaAfter: L ? L.area : 0, stats: S.stats.last, heapPeak: S.stats.heapPeak };
    }, label);
    const canvasPng = async (name) => {
      const dataUrl = await page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png'));
      fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
    };

    /* ---------- 1. people out of city-streets.jpg ---------- */
    console.log('\n[1] city-streets.jpg — Remove all people');
    await upload(path.join(IMG, 'city-streets.jpg'));
    let s = await waitLoaded('city-streets', 'after load');
    let L = await layers();
    console.log('  layers:', L.map((l) => l.name + ' ' + (l.area * 100).toFixed(1) + '%').join(' | '));
    const people0 = (L.find((l) => l.label === 'person') || { area: 0 }).area;
    check(people0 > 0.01, 'a People layer was found (' + (people0 * 100).toFixed(1) + '%)');
    const peopleLabel = await page.$eval('.aiimg-era-people', (b) => b.textContent + (b.disabled ? ' [disabled]' : ''));
    console.log('  people button:', peopleLabel);
    const chips = await page.$$eval('.aiimg-era-taps .chip', (b) => b.map((x) => x.textContent));
    console.log('  chips:', chips.join(' | ') || 'none');
    await page.screenshot({ path: path.join(OUT, '2-loaded.png') });
    const t1 = Date.now();
    let r0 = await runsNow();
    await page.click('.aiimg-era-people');
    s = await waitRemoved(r0, 'after Remove all people');
    check(/^Removed/.test(s), 'status reports the removal (' + ((Date.now() - t1) / 1000).toFixed(1) + ' s wall)');
    await wait(300);
    await page.screenshot({ path: path.join(OUT, '3-people-removed.png') });
    await canvasPng('3-canvas.png');
    let v = await verify('person');
    console.log('  verify:', JSON.stringify(v));
    check(v.stats && v.stats.tiles >= 1, 'network ran: ' + JSON.stringify(v.stats && { mode: v.stats.mode, tiles: v.stats.tiles, ms: v.stats.ms, seconds: v.stats.seconds }));
    check(v.areaAfter < 0.2 * people0, 'People layer after re-segmenting is under 20% of before (' + (v.areaAfter / people0 * 100).toFixed(1) + '%)');
    check(v.meanDiff > 6 && v.changedFrac > 0.5, 'pixels inside the old mask differ from the original (mean ' + v.meanDiff.toFixed(1) + ', ' + (v.changedFrac * 100).toFixed(0) + '% changed)');
    check(v.outsideChanged < 0.01, 'pixels outside the mask are untouched (' + (v.outsideChanged * 100).toFixed(2) + '% changed)');
    const tileMs1 = v.stats ? v.stats.ms : [];

    /* before/after divider */
    await page.click('#aiimg-era-compare');
    await wait(200);
    const rect = await canvasRect();
    await page.mouse.move(rect.x + rect.w * 0.5, rect.y + rect.h * 0.5);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.w * 0.4, rect.y + rect.h * 0.5, { steps: 5 });
    await page.mouse.move(rect.x + rect.w * 0.3, rect.y + rect.h * 0.5, { steps: 5 });
    await page.mouse.up();
    await wait(200);
    const split = await state('S.split');
    check(Math.abs(split - 0.3) < 0.03, 'divider dragged to 30% (' + split.toFixed(2) + ')');
    await page.screenshot({ path: path.join(OUT, '4-compare.png') });
    await canvasPng('4-compare-canvas.png');
    await page.click('#aiimg-era-compare');

    /* ---------- 2. the car out of car.jpg, by brush ---------- */
    console.log('\n[2] car.jpg — brush over the car, Remove the selection');
    await upload(path.join(IMG, 'car.jpg'));
    s = await waitLoaded('car', 'after load');
    L = await layers();
    console.log('  layers:', L.map((l) => l.name + ' ' + (l.area * 100).toFixed(1) + '%').join(' | '));
    const car = L.find((l) => l.label === 'car');
    check(!!car, 'a Cars layer was found' + (car ? ' (' + (car.area * 100).toFixed(1) + '%, bbox ' + car.bbox.join(',') + ' of ' + car.mw + '×' + car.mh + ')' : ''));
    const dims = await state('[S.W, S.H]');
    const rect2 = await canvasRect();
    /* brush size in working px: a tenth of the car's height, at least 24 */
    const bw = car.bbox[2] - car.bbox[0], bh = car.bbox[3] - car.bbox[1];
    const toWork = dims[0] / car.mw;
    const size = Math.max(24, Math.min(160, Math.round(bh * toWork * 0.14 / 2) * 2));
    await page.$eval('#aiimg-era-size', (e, v) => { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); }, size);
    const toScreen = (mx, my) => ({ x: rect2.x + mx / car.mw * rect2.w, y: rect2.y + my / car.mh * rect2.h });
    const rowStep = Math.max(2, size / toWork * 0.45);   /* mask-res px between rows */
    let rows = 0;
    const inset = Math.max(1, size / toWork * 0.3);
    for (let my = car.bbox[1] + inset; my <= car.bbox[3] - inset + 0.01; my += rowStep) {
      const a = toScreen(car.bbox[0] + inset, my), b = toScreen(car.bbox[2] - inset, my);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: Math.max(4, Math.round(bw / 8)) });
      await page.mouse.up();
      rows++;
    }
    await wait(200);
    const selArea = await state('(() => { let n = 0; for (const v of S.mask) if (v > 6) n++; return n / S.mask.length; })()');
    console.log('  brushed', rows, 'rows with a', size, 'px brush; selection covers', (selArea * 100).toFixed(1) + '% of the frame (car layer ' + (car.area * 100).toFixed(1) + '%)');
    const cover = await page.evaluate(() => { const S = document.querySelector('.tool').aiimgEraser.state; const seg = S.seg; const k = seg.layers.find((l) => l.label === 'car').key;
      let n = 0, hit = 0; for (let y = 0; y < seg.mh; y++) for (let x = 0; x < seg.mw; x++) { if (seg.classMap[y * seg.mw + x] !== k) continue; n++;
        const wx = Math.min(S.W - 1, Math.floor((x + 0.5) * S.W / seg.mw)), wy = Math.min(S.H - 1, Math.floor((y + 0.5) * S.H / seg.mh)); if (S.mask[wy * S.W + wx] > 6) hit++; }
      return hit / Math.max(1, n); });
    check(cover > 0.9, 'brush strokes cover the car (' + (cover * 100).toFixed(0) + '% of its pixels)');
    const undoable = await page.$eval('.aiimg-pane[data-pane=remove] button', (b) => true) && await page.$$eval('.aiimg-pane[data-pane=remove] button', (bs) => bs.filter((b) => /^Undo stroke/.test(b.textContent)).map((b) => b.disabled)[0]);
    check(undoable === false, 'Undo stroke is enabled after painting');
    await page.screenshot({ path: path.join(OUT, '5-brushed.png') });
    await canvasPng('5-brushed-canvas.png');
    const t2 = Date.now();
    r0 = await runsNow();
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=remove] button')) if (/^Remove the selection/.test(b.textContent)) b.click(); });
    s = await waitRemoved(r0, 'after Remove the selection');
    check(/^Removed/.test(s), 'status reports the removal (' + ((Date.now() - t2) / 1000).toFixed(1) + ' s wall)');
    await wait(300);
    await page.screenshot({ path: path.join(OUT, '6-car-removed.png') });
    await canvasPng('6-canvas.png');
    v = await verify('car');
    console.log('  verify:', JSON.stringify(v));
    check(v.areaAfter < 0.35 * car.area, 'Cars layer after re-segmenting shrank to under 35% of before (' + (v.areaAfter / car.area * 100).toFixed(1) + '%)');
    check(v.meanDiff > 6 && v.changedFrac > 0.5, 'pixels inside the brushed mask differ from the original (mean ' + v.meanDiff.toFixed(1) + ', ' + (v.changedFrac * 100).toFixed(0) + '% changed)');
    const tileMs2 = v.stats ? v.stats.ms : [];

    /* exports */
    await page.click('.aiimg-tabs [data-pane=export]');
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' });
    const results = async () => page.$$eval('.aiimg-result-head', (h) => h.map((x) => x.textContent.trim()));
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Download the picture/.test(b.textContent)) b.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 1, { timeout: 60000 });
    console.log(stamp(), 'still:', (await results())[0]);
    const clipDone = (n) => page.waitForFunction((k) => {
      const st = document.querySelector('.aiimg-era-clipstatus');
      return document.querySelectorAll('.aiimg-result').length > k || /failed|Cancelled/.test(st ? st.textContent : '');
    }, { timeout: 300000, polling: 500 }, n);
    for (const [fmt, size2] of [['mp4', '720'], ['gif', '480']]) {
      await page.$eval('#aiimg-era-clip-fmt', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, fmt);
      await page.$eval('#aiimg-era-clip-size', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, size2);
      const n0 = (await results()).length;
      const tg = Date.now();
      await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Export the before-and-after clip/.test(b.textContent)) b.click(); });
      await clipDone(n0);
      console.log(stamp(), fmt + ':', (await results())[0], '|', await page.$eval('.aiimg-era-clipstatus', (e) => e.textContent), '| took', ((Date.now() - tg) / 1000).toFixed(1) + 's');
    }
    await page.screenshot({ path: path.join(OUT, '7-export.png') });
    const blobs = await page.evaluate(async () => {
      const out = [];
      for (const el of document.querySelectorAll('.aiimg-result img, .aiimg-result video')) {
        const r = await fetch(el.src); const b = await r.blob();
        const buf = new Uint8Array(await b.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        out.push({ type: b.type, size: b.size, b64: btoa(bin) });
      }
      return out;
    });
    const magics = {};
    blobs.forEach((b, i) => {
      const ext = b.type === 'image/gif' ? 'gif' : b.type === 'video/mp4' ? 'mp4' : b.type === 'video/webm' ? 'webm' : 'png';
      const f = path.join(OUT, 'result-' + i + '.' + ext);
      fs.writeFileSync(f, Buffer.from(b.b64, 'base64'));
      const head = fs.readFileSync(f).subarray(0, 12);
      magics[ext] = head;
      console.log('  saved', path.basename(f), b.size, 'bytes, magic:', head.toString('latin1').replace(/[^\x20-\x7e]/g, '.'));
    });
    check(magics.png && magics.png[0] === 0x89 && magics.png.toString('latin1', 1, 4) === 'PNG', 'still is a PNG (\\x89PNG)');
    check(magics.mp4 && magics.mp4.toString('latin1', 4, 8) === 'ftyp', 'clip is an MP4 (ftyp)');
    check(magics.gif && magics.gif.toString('latin1', 0, 4) === 'GIF8', 'clip is a GIF (GIF8)');
    const pngDims = magics.png ? { w: fs.readFileSync(path.join(OUT, 'result-' + blobs.findIndex((b) => b.type === 'image/png') + '.png')).readUInt32BE(16), h: fs.readFileSync(path.join(OUT, 'result-' + blobs.findIndex((b) => b.type === 'image/png') + '.png')).readUInt32BE(20) } : null;
    if (pngDims) check(pngDims.w === dims[0] && pngDims.h === dims[1], 'still PNG is at the working resolution ' + pngDims.w + '×' + pngDims.h);

    /* ---------- 3. a 4000 px photo: the tiled path ---------- */
    let tileMs3 = [], big3 = null;
    if (!QUICK) {
      console.log('\n[3] 4000 px photo from city-streets.jpg — Remove all people (tiled path)');
      await page.click('.aiimg-tabs [data-pane=remove]');
      const b64 = fs.readFileSync(path.join(IMG, 'city-streets.jpg')).toString('base64');
      await page.evaluate(async (data) => {
        const bin = atob(data); const u8 = new Uint8Array(bin.length); for (let i = 0; i < u8.length; i++) u8[i] = bin.charCodeAt(i);
        const bmp = await createImageBitmap(new Blob([u8], { type: 'image/jpeg' }));
        const c = document.createElement('canvas'); c.width = 4000; c.height = Math.round(4000 * bmp.height / bmp.width);
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, c.width, c.height);
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
        const file = new File([blob], 'city-4000.jpg', { type: 'image/jpeg' });
        await document.querySelector('.tool').aiimgEraser.loadFiles([file]);
      }, b64);
      s = await waitLoaded('city-4000', 'after load');
      check(/scaled down from 4000×/.test(s) || /4000/.test(s), 'status says the 4000 px photo was scaled down');
      const dims3 = await state('[S.W, S.H]');
      console.log('  working size', dims3.join('×'));
      L = await layers();
      const people3 = (L.find((l) => l.label === 'person') || { area: 0 }).area;
      const t3 = Date.now();
      const heapBefore = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0);
      let heapPoll = heapBefore;
      const poll = setInterval(async () => { try { const h = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0); heapPoll = Math.max(heapPoll, h); } catch (e) { /* busy */ } }, 400);
      r0 = await runsNow();
      await page.click('.aiimg-era-people');
      s = await waitRemoved(r0, 'after Remove all people (4000 px)', 900000);
      clearInterval(poll);
      const wall = (Date.now() - t3) / 1000;
      check(/^Removed/.test(s), 'status reports the removal (' + wall.toFixed(1) + ' s wall)');
      await wait(300);
      await page.screenshot({ path: path.join(OUT, '8-big-removed.png') });
      await canvasPng('8-canvas.png');
      v = await verify('person');
      big3 = v;
      console.log('  verify:', JSON.stringify(v));
      tileMs3 = v.stats ? v.stats.ms : [];
      check(v.stats && v.stats.mode === 'tiled', 'the tiled path ran (' + (v.stats && v.stats.mode) + ', ' + (v.stats && v.stats.tiles) + ' runs)');
      check(v.areaAfter < 0.2 * people3, 'People layer after re-segmenting is under 20% of before (' + (people3 ? (v.areaAfter / people3 * 100).toFixed(1) : '?') + '%)');
      const peak = Math.max(v.heapPeak || 0, heapPoll);
      console.log('  JS heap: before ' + (heapBefore / 1048576).toFixed(0) + ' MB, peak ' + (peak / 1048576).toFixed(0) + ' MB (in-page ' + ((v.heapPeak || 0) / 1048576).toFixed(0) + ' MB, polled ' + (heapPoll / 1048576).toFixed(0) + ' MB)');
      check(peak < 900 * 1048576, 'peak JS heap under 900 MB');
      check(wall < 240, 'tiled removal finished in a sane time');
    }

    /* ---------- wrap up ---------- */
    const tp = [...new Set(net.map((u) => u.replace(/\?.*$/, '')))];
    console.log('\n  third-party requests:', tp.length ? tp.slice(0, 10).join('\n    ') : 'none');
    check(tp.length === 0, 'zero third-party requests');
    const all = tileMs1.concat(tileMs2, tileMs3);
    if (all.length) console.log('  MI-GAN 512 on WASM: ' + all.length + ' runs, ' + Math.min(...all) + '–' + Math.max(...all) + ' ms, median ' + all.slice().sort((a, b) => a - b)[Math.floor(all.length / 2)] + ' ms');
    if (big3 && big3.stats) console.log('  4000 px run: ' + JSON.stringify({ mode: big3.stats.mode, tiles: big3.stats.tiles, ms: big3.stats.ms, seconds: big3.stats.seconds, window: big3.stats.window }));
    save();
  } finally {
    save();
    await browser.close().catch(() => {});
    if (server) server.kill();
  }
  console.log('\n' + (failures.length ? 'FAILED: ' + failures.length + ' check(s)\n  - ' + failures.join('\n  - ') : 'all checks passed') + ' in ' + stamp());
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
