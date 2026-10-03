/*
 * Drives /ai-image/color-pop/ in headless Chrome: upload car.jpg, wait for
 * the layers, check that the car stays coloured while the rest is grey,
 * export a PNG, an MP4 and a GIF and check their magic bytes; then upload
 * city-streets.jpg, restrict the kept colour to one hue band and check
 * that only that band is coloured. Records every non-local response.
 *
 *   node color-pop.js [--root <export dir>] [--port 8722] [--out <dir>] [--img <harness img dir>]
 *
 * With --root the script serves that directory itself on --port; without
 * it a server must already be listening there. Exits non-zero on failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8722));
const ROOT = flag('root', null);
const OUT = flag('out', path.join(__dirname, 'out', 'color-pop'));
const IMG = flag('img', 'E:/tmp/1234-agents/harness/img');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (cond, m) => { if (cond) console.log('  ok   ' + m); else { console.log('  FAIL ' + m); failures.push(m); } };

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
function serve(root, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const abs = path.join(root, p);
      fs.stat(abs, (err, st) => {
        if (err || !st.isFile()) { r.writeHead(404); r.end('not found'); return; }
        r.writeHead(200, { 'Content-Type': TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
        fs.createReadStream(abs).pipe(r);
      });
    }).listen(port, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  const server = ROOT ? await serve(ROOT, PORT) : null;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU'], protocolTimeout: 600000 });
  const logs = [], net = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (/error/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
    page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); failures.push('page error: ' + e.message); });
    page.on('requestfailed', (r) => { logs.push('requestfailed ' + r.url()); console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText); });
    page.on('response', (r) => { const u = r.url(); if (!/^http:\/\/127\.0\.0\.1/.test(u) && !/^(data|blob):/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); });
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' });

    await page.goto('http://127.0.0.1:' + PORT + '/ai-image/color-pop/', { waitUntil: 'networkidle0', timeout: 120000 });
    console.log(stamp(), 'page loaded; title =', await page.title());
    check((await page.title()).length <= 70, 'title is at most 70 characters');
    const h1 = await page.$eval('h1', (e) => e.textContent.trim());
    const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
    const active = await page.$eval('.side-link.is-active', (e) => e.getAttribute('href')).catch(() => null);
    console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '), '| sidebar active =', active);
    check(/Colour Pop/.test(h1), 'h1 names the tool');
    check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
    check((await page.$$('.aiimg input[type=file][accept="image/*"]')).length === 1, 'exactly one image file input');
    await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    await page.screenshot({ path: path.join(OUT, '1-empty.png') });

    const ready = () => page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && /ready$|could not/.test(s.textContent.trim()); }, { timeout: 600000, polling: 500 });
    const upload = async (name) => {
      const input = await page.$('.aiimg input[type=file][accept="image/*"]');
      await input.uploadFile(path.join(IMG, name));
      const t = Date.now();
      await page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && !/ready$/.test(s.textContent.trim()); }, { timeout: 10000, polling: 50 }).catch(() => {});
      await ready();
      const status = await page.$eval('.aiimg-status', (e) => e.textContent.trim());
      console.log(stamp(), name, '→', status, '(' + ((Date.now() - t) / 1000).toFixed(1) + ' s)');
      check(/ready$/.test(status), name + ': status ends in "ready"');
      const layers = await page.$$eval('.aiimg-layer', (rows) => rows.map((r) => (r.querySelector('input').checked ? '[x] ' : '[ ] ') + r.querySelector('.aiimg-lname').textContent + ' ' + r.querySelector('.aiimg-area').textContent));
      console.log('  layers:', layers.join(' | '));
      await new Promise((r) => setTimeout(r, 400));
      return layers;
    };
    const canvasPng = (file) => page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png')).then((d) => fs.writeFileSync(path.join(OUT, file), Buffer.from(d.split(',')[1], 'base64')));
    const results = () => page.$$eval('.aiimg-result-head', (h) => h.map((x) => x.textContent.trim()));

    /* ---- car.jpg: the car in colour, the rest grey ---- */
    const layers = await upload('car.jpg');
    check(layers.some((l) => /\[x\] Cars/.test(l)), 'Cars layer is kept in colour by default');
    await page.screenshot({ path: path.join(OUT, '2-car-layers.png') });
    await canvasPng('2-car-canvas.png');
    const sat = await page.evaluate(() => {
      const S = document.querySelector('.tool').aiimgTool.state;
      const c = document.querySelector('.aiimg-canvas'), x = c.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const car = S.seg.layers.find((l) => l.label === 'car');
      const sx = c.width / S.seg.mw, sy = c.height / S.seg.mh;
      const bb = car ? [car.bbox[0] * sx, car.bbox[1] * sy, (car.bbox[2] + 1) * sx, (car.bbox[3] + 1) * sy] : null;
      let inS = 0, inN = 0, outS = 0, outN = 0;
      for (let y = 0; y < c.height; y += 2) for (let xx = 0; xx < c.width; xx += 2) {
        const j = (y * c.width + xx) * 4, r = d[j], g = d[j + 1], b = d[j + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
        const inside = bb && xx >= bb[0] && xx < bb[2] && y >= bb[1] && y < bb[3];
        if (inside) { inS += s; inN++; } else { outS += s; outN++; }
      }
      return { inside: inS / Math.max(1, inN), outside: outS / Math.max(1, outN), bbox: bb, carShare: car ? car.area : 0 };
    });
    console.log('  mean saturation inside the car bbox =', sat.inside.toFixed(3), '| outside =', sat.outside.toFixed(3), '| car share =', (sat.carShare * 100).toFixed(1) + '%');
    check(sat.bbox !== null, 'a car layer was found');
    check(sat.outside < 0.05, 'outside the car bbox is grey (mean saturation < 0.05)');
    check(sat.inside > 5 * Math.max(sat.outside, 0.01), 'inside the car bbox is coloured (mean saturation ≫ outside)');

    /* presets and the colour pane */
    await page.click('.aiimg-tabs [data-pane=colour]');
    await page.click('.aiimg-pop-presets [data-preset=tealorange]');
    await ready();
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT, '3-car-tealorange.png') });
    await canvasPng('3-car-tealorange-canvas.png');
    await page.click('.aiimg-pop-presets [data-preset=red]');
    await ready();
    await new Promise((r) => setTimeout(r, 400));
    await canvasPng('3-car-red-canvas.png');

    /* exports: PNG still, MP4 and GIF clips */
    await page.click('.aiimg-tabs [data-pane=motion]');
    await page.$eval('#aiimg-dur', (e) => { e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('.aiimg-tabs [data-pane=export]');
    await page.$eval('#aiimg-still-size', (e) => { e.value = '1080'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Download the image/.test(b.textContent)) b.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 1, { timeout: 60000 });
    console.log(stamp(), 'still:', (await results())[0]);
    const clipDone = (n) => page.waitForFunction((k) => {
      const st = document.querySelector('.aiimg-pane[data-pane=export] .aiimg-status');
      return document.querySelectorAll('.aiimg-result').length > k || /failed|Cancelled/.test(st ? st.textContent : '');
    }, { timeout: 300000, polling: 500 }, n);
    for (const [fmt, size, fps] of [['mp4', '720', '24'], ['gif', '480', '12']]) {
      await page.$eval('#aiimg-clip-fmt', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, fmt);
      await page.$eval('#aiimg-clip-size', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, size);
      await page.$eval('#aiimg-clip-fps', (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, fps);
      const n0 = (await results()).length, tg = Date.now();
      await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Export the clip/.test(b.textContent)) b.click(); });
      await clipDone(n0);
      console.log(stamp(), fmt + ':', (await results())[0], '|', await page.$eval('.aiimg-pane[data-pane=export] .aiimg-status', (e) => e.textContent), '| took', ((Date.now() - tg) / 1000).toFixed(1) + 's');
    }
    await page.screenshot({ path: path.join(OUT, '4-export.png') });
    const blobs = await page.evaluate(async () => {
      const out = [];
      for (const el of document.querySelectorAll('.aiimg-result img, .aiimg-result video')) {
        const b = await (await fetch(el.src)).blob();
        const buf = new Uint8Array(await b.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        out.push({ type: b.type, size: b.size, b64: btoa(bin) });
      }
      return out;
    });
    const seen = {};
    blobs.forEach((b, i) => {
      const ext = b.type === 'image/gif' ? 'gif' : b.type === 'video/mp4' ? 'mp4' : b.type === 'video/webm' ? 'webm' : 'png';
      const f = path.join(OUT, 'result-' + i + '.' + ext);
      const buf = Buffer.from(b.b64, 'base64');
      fs.writeFileSync(f, buf);
      const head = buf.subarray(0, 12).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
      console.log('  saved', path.basename(f), b.size, 'bytes, magic:', head);
      seen[ext] = { size: b.size, buf };
    });
    check(seen.png && seen.png.buf.subarray(1, 4).toString() === 'PNG', 'PNG export has the PNG magic');
    check(seen.mp4 && seen.mp4.buf.subarray(4, 8).toString() === 'ftyp', 'MP4 export has ftyp');
    check(seen.gif && seen.gif.buf.subarray(0, 6).toString() === 'GIF89a', 'GIF export is GIF89a');

    /* ---- city-streets.jpg: one hue band only ---- */
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-transport button')) if (/Change photo/.test(b.textContent)) b.focus(); });
    await upload('city-streets.jpg');
    await page.click('.aiimg-tabs [data-pane=colour]');
    const swatches = await page.$$eval('.aiimg-pop-swatch', (b) => b.map((x) => ({ hue: x.dataset.hue, title: x.title })));
    console.log('  swatches:', swatches.map((s) => s.hue + '°').join(', ') || 'none');
    check(swatches.length >= 2, 'at least two hue swatches found in the kept layers');
    await page.screenshot({ path: path.join(OUT, '5-streets-colour-pane.png') });
    await canvasPng('5-streets-before-hue.png');
    if (swatches.length) {
      await page.click('.aiimg-pop-swatch');
      await new Promise((r) => setTimeout(r, 600));
      const hue = await page.evaluate(() => {
        const S = document.querySelector('.tool').aiimgTool.state;
        const c = document.querySelector('.aiimg-canvas'), x = c.getContext('2d');
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let coloured = 0, inBand = 0;
        for (let j = 0; j < d.length; j += 8) {
          const r = d[j], g = d[j + 1], b = d[j + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn, s = mx ? dd / mx : 0;
          if (s < 0.25 || mx < 30) continue;
          let h = 0;
          if (mx === r) h = 60 * (((g - b) / dd) % 6); else if (mx === g) h = 60 * ((b - r) / dd + 2); else h = 60 * ((r - g) / dd + 4);
          if (h < 0) h += 360;
          let dh = Math.abs(h - S.hue.centre); if (dh > 180) dh = 360 - dh;
          coloured++;
          if (dh <= S.hue.width + 16) inBand++;
        }
        return { on: S.hue.on, centre: S.hue.centre, width: S.hue.width, coloured, inBand, total: d.length / 8 };
      });
      console.log('  hue restriction:', JSON.stringify(hue), '| in-band share of coloured pixels =', (hue.inBand / Math.max(1, hue.coloured) * 100).toFixed(1) + '%');
      check(hue.on, 'clicking a swatch switches the hue restriction on');
      check(hue.coloured > hue.total * 0.001, 'some pixels remain coloured');
      check(hue.inBand / Math.max(1, hue.coloured) > 0.93, 'at least 93% of the coloured pixels are inside the chosen hue band');
      await page.screenshot({ path: path.join(OUT, '6-streets-hue.png') });
      await canvasPng('6-streets-hue-canvas.png');
    }

    const third = [...new Set(net.map((n) => n.replace(/\?.*$/, '')))];
    console.log('  third-party responses:', third.length ? third.join('\n    ') : 'none');
    check(third.length === 0, 'zero third-party requests');
  } finally {
    fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n'));
    await browser.close();
    if (server) server.close();
  }
  console.log(stamp(), failures.length ? 'FAILED: ' + failures.length + ' check(s)\n  - ' + failures.join('\n  - ') : 'all checks passed');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
