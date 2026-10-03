/*
 * Drives /ai-image/thumbnail-maker/ in headless Chrome: upload
 * portrait-of-woman_small.jpg, wait for the cut-out, check that the glow
 * is visible, export the three variants and check that they are 1280×720
 * PNGs that differ, export a JPEG and check it is under 2 MB; then do the
 * glow check again on city-streets.jpg. Records every non-local response.
 *
 *   node thumbnail-maker.js [--root <export dir>] [--port 8722] [--out <dir>] [--img <harness img dir>]
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
const OUT = flag('out', path.join(__dirname, 'out', 'thumbnail-maker'));
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
const pngSize = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

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

    await page.goto('http://127.0.0.1:' + PORT + '/ai-image/thumbnail-maker/', { waitUntil: 'networkidle0', timeout: 120000 });
    console.log(stamp(), 'page loaded; title =', await page.title());
    check((await page.title()).length <= 70, 'title is at most 70 characters');
    const h1 = await page.$eval('h1', (e) => e.textContent.trim());
    const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
    console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '));
    check(/Thumbnail Maker/.test(h1), 'h1 names the tool');
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
      await new Promise((r) => setTimeout(r, 500));
      const cut = await page.evaluate(() => { const S = document.querySelector('.tool').aiimgTool.state; return S.cut ? { w: S.cut.w, h: S.cut.h, baseH: S.subject.baseH } : null; });
      console.log('  cut-out:', JSON.stringify(cut));
      check(!!cut, name + ': a cut-out exists');
      return layers;
    };
    const canvasPng = (file) => page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png')).then((d) => fs.writeFileSync(path.join(OUT, file), Buffer.from(d.split(',')[1], 'base64')));
    const glowCheck = async (tag) => {
      await page.click('.aiimg-tabs [data-pane=glow]');
      const setStrength = async (v) => { await page.$eval('#aiimg-thumb-glows', (e, val) => { e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(v)); await new Promise((r) => setTimeout(r, 350)); };
      await setStrength(0);
      const a = await page.$eval('.aiimg-canvas', (c) => Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data));
      await canvasPng(tag + '-glow-0.png');
      await setStrength(100);
      const b = await page.$eval('.aiimg-canvas', (c) => Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data));
      await canvasPng(tag + '-glow-100.png');
      let changed = 0;
      for (let j = 0; j < a.length; j += 4) if (Math.abs(a[j] - b[j]) > 40 || Math.abs(a[j + 1] - b[j + 1]) > 40 || Math.abs(a[j + 2] - b[j + 2]) > 40) changed++;
      console.log('  glow: pixels changed by > 40 between strength 0 and 100 =', changed, 'of', a.length / 4);
      check(changed > 3000, tag + ': the glow is visible (more than 3,000 pixels change)');
      await setStrength(90);
    };

    /* ---- portrait ---- */
    const layers = await upload('portrait-of-woman_small.jpg');
    check(layers.some((l) => /\[x\] People/.test(l)), 'People layer is the cut-out by default');
    const dims = await page.$eval('.aiimg-canvas', (c) => [c.width, c.height]);
    check(dims[0] === 1280 && dims[1] === 720, 'preview canvas is 1280×720');
    await page.screenshot({ path: path.join(OUT, '2-portrait.png') });
    await canvasPng('2-portrait-canvas.png');
    await glowCheck('3-portrait');

    /* title and accent, for the screenshots */
    await page.click('.aiimg-tabs [data-pane=text]');
    await page.$eval('#aiimg-text', (e) => { e.value = 'I TRIED\nTHIS'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('.aiimg-tabs [data-pane=accent]');
    await page.$eval('#aiimg-thumb-accent', (e) => { e.value = 'arrow'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, '4-portrait-title-arrow.png') });
    await canvasPng('4-portrait-title-arrow-canvas.png');

    /* three variants */
    await page.click('.aiimg-tabs [data-pane=export]');
    const results = () => page.$$eval('.aiimg-result-head', (h) => h.map((x) => x.textContent.trim()));
    const tv = Date.now();
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Export 3 variants/.test(b.textContent)) b.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 3, { timeout: 120000, polling: 300 });
    await new Promise((r) => setTimeout(r, 400));
    const heads = await results();
    console.log(stamp(), 'variants:', heads.slice(0, 3).join(' || '), '| took', ((Date.now() - tv) / 1000).toFixed(1) + 's');
    check(heads.length >= 3 && /-c\.png/.test(heads[0]) && /-b\.png/.test(heads[1]) && /-a\.png/.test(heads[2]), 'three results named -a, -b, -c');

    /* JPEG under 2 MB */
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Download JPEG/.test(b.textContent)) b.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 4, { timeout: 60000 });
    console.log(stamp(), 'jpeg:', (await results())[0]);
    await page.screenshot({ path: path.join(OUT, '5-export.png') });

    const blobs = await page.evaluate(async () => {
      const out = [];
      for (const row of document.querySelectorAll('.aiimg-result')) {
        const el = row.querySelector('img');
        const name = row.querySelector('.aiimg-result-head strong').textContent;
        const b = await (await fetch(el.src)).blob();
        const buf = new Uint8Array(await b.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        /* a coarse sample of the decoded picture, for comparing variants */
        const bmp = await createImageBitmap(b);
        const c = document.createElement('canvas'); c.width = 64; c.height = 36;
        c.getContext('2d').drawImage(bmp, 0, 0, 64, 36);
        out.push({ name, type: b.type, size: b.size, b64: btoa(bin), sample: Array.from(c.getContext('2d').getImageData(0, 0, 64, 36).data) });
      }
      return out;
    });
    const byName = {};
    for (const b of blobs) {
      const f = path.join(OUT, b.name);
      const buf = Buffer.from(b.b64, 'base64');
      fs.writeFileSync(f, buf);
      const info = b.type === 'image/png' ? pngSize(buf) : {};
      console.log('  saved', b.name, b.size, 'bytes, magic:', buf.subarray(0, 8).toString('latin1').replace(/[^\x20-\x7e]/g, '.'), info.width ? info.width + '×' + info.height : '');
      byName[b.name] = { buf, size: b.size, sample: b.sample, type: b.type, ...info };
    }
    const vA = blobs.find((b) => /-a\.png$/.test(b.name)), vB = blobs.find((b) => /-b\.png$/.test(b.name)), vC = blobs.find((b) => /-c\.png$/.test(b.name));
    const jpg = blobs.find((b) => /\.jpg$/.test(b.name));
    for (const v of [vA, vB, vC]) {
      if (!v) { check(false, 'variant missing'); continue; }
      const buf = Buffer.from(v.b64, 'base64');
      const s = pngSize(buf);
      check(buf.subarray(1, 4).toString() === 'PNG' && s.width === 1280 && s.height === 720, v.name + ' is a 1280×720 PNG');
    }
    const differ = (p, q) => { let n = 0; for (let j = 0; j < p.sample.length; j += 4) if (Math.abs(p.sample[j] - q.sample[j]) > 24 || Math.abs(p.sample[j + 1] - q.sample[j + 1]) > 24 || Math.abs(p.sample[j + 2] - q.sample[j + 2]) > 24) n++; return n / (p.sample.length / 4); };
    if (vA && vB && vC) {
      const ab = differ(vA, vB), ac = differ(vA, vC), bc = differ(vB, vC);
      console.log('  variants differ: A/B', (ab * 100).toFixed(1) + '%', 'A/C', (ac * 100).toFixed(1) + '%', 'B/C', (bc * 100).toFixed(1) + '%', 'of sampled pixels');
      check(ab > 0.1 && ac > 0.1 && bc > 0.1, 'the three variants differ from each other (more than 10% of sampled pixels)');
    }
    check(jpg && jpg.type === 'image/jpeg' && Buffer.from(jpg.b64, 'base64').subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), 'JPEG export has the JPEG magic');
    check(jpg && jpg.size <= 2000000, 'JPEG is at most 2,000,000 bytes (' + (jpg ? jpg.size : '-') + ')');

    /* ---- a street scene: people among bikes and cars ---- */
    await upload('city-streets.jpg');
    await page.screenshot({ path: path.join(OUT, '6-streets.png') });
    await canvasPng('6-streets-canvas.png');
    await glowCheck('7-streets');
    await page.click('.aiimg-tabs [data-pane=background]');
    await page.$eval('#aiimg-thumb-bg', (e) => { e.value = 'gradient'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 400));
    await canvasPng('8-streets-gradient-canvas.png');

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
