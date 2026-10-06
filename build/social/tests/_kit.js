/*
 * What the /social/ browser tests share: flags, the static server
 * (build/tests/serve.js), headless Chrome through puppeteer-core, a page
 * opener that records downloads and every request that leaves 127.0.0.1,
 * check() counting, and readers written here from the file formats'
 * specifications — never the engines' own code — for ZIP (local headers,
 * central directory, CRC-32), PNG (signature, IHDR, chunk CRCs) and PDF
 * (xref offsets, page objects, MediaBox, image XObjects).
 *
 *   const T = require('./_kit.js')({ name: 'carousel-maker', port: 8875 });
 *   await T.start(); const p = await T.open('/social/carousel-maker/');
 *   T.check(ok, 'what'); … await T.finish();   // exits non-zero on a failure
 *
 * Flags every suite takes: --root <site> (default: this checkout),
 * --port <n>, --out <dir> (screenshots and saved files; default
 * E:/tmp/wsoc-social/<name>), --chrome <exe> (or CHROME / CHROME_PATH).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

module.exports = function (o) {
  const args = process.argv.slice(2);
  const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
  const ROOT = path.resolve(flag('root', path.join(__dirname, '..', '..', '..')));
  const PORT = Number(flag('port', o.port));
  const OUT = path.resolve(flag('out', path.join('E:/tmp/wsoc-social', o.name)));
  const CHROME = flag('chrome', null) || process.env.CHROME || process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const BASE = 'http://127.0.0.1:' + PORT;
  fs.mkdirSync(OUT, { recursive: true });

  let puppeteer;
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) {
    try { puppeteer = require(p); break; } catch (e) { /* next */ }
  }
  const T = { ROOT, PORT, OUT, BASE, flag, passes: 0, fails: [], outside: [], errors: [] };

  T.check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (ok) T.passes++; else T.fails.push(what); return !!ok; };
  T.section = (s) => console.log('\n' + s);
  T.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  T.start = async () => {
    if (!puppeteer) throw new Error('puppeteer-core not found');
    const { serve } = require(path.join(ROOT, 'build/tests/serve.js'));
    T.server = await serve(ROOT, PORT);
    T.browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'], protocolTimeout: 180000 });
    console.log(o.name + ': ' + ROOT + ' on ' + BASE);
  };

  /** A page with downloads captured (window.__downloads), clipboard writes kept (window.__copied), outside requests refused and noted. */
  T.open = async (url, opt) => {
    opt = opt || {};
    const p = await T.browser.newPage();
    await p.setViewport({ width: opt.width || 1400, height: opt.height || 1000, deviceScaleFactor: 1 });
    await p.setRequestInterception(true);
    p.on('request', (r) => {
      const u = r.url();
      if (/^(data|blob):/.test(u) || u.startsWith(BASE)) return r.continue();
      T.outside.push(url + ' -> ' + u);
      return r.abort();
    });
    p.on('pageerror', (e) => T.errors.push(url + ': ' + String(e && e.message || e)));
    await p.evaluateOnNewDocument((theme, keep) => {
      try { localStorage.setItem('1234tools-consent', 'denied'); if (theme) localStorage.setItem('1234tools-theme', theme); } catch (e) { /* */ }
      if (!keep) { try { Object.keys(localStorage).filter((k) => /^1234tools-social/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* */ } }
      window.__downloads = [];
      window.__copied = [];
      const desc = { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } };
      try { Object.defineProperty(navigator, 'clipboard', { value: desc, configurable: true }); } catch (e) { /* */ }
      HTMLAnchorElement.prototype.click = function () {
        const a = this;
        if (a.download) window.__downloads.push(fetch(a.href).then((r) => r.blob()).then(async (b) => ({ name: a.download, type: b.type, bytes: Array.from(new Uint8Array(await b.arrayBuffer())) })));
      };
    }, opt.theme || null, !!opt.keepStorage);
    await p.goto(BASE + url, { waitUntil: 'load', timeout: 120000 });
    await p.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    await p.waitForSelector(opt.wait || '.tool-io > *', { timeout: 30000 });
    return p;
  };
  T.downloads = async (p) => (await p.evaluate(() => Promise.all(window.__downloads))).map((d) => ({ name: d.name, type: d.type, bytes: Buffer.from(d.bytes) }));
  T.clearDownloads = (p) => p.evaluate(() => { window.__downloads = []; });
  T.waitDownloads = async (p, n, ms) => { await p.waitForFunction((n) => window.__downloads.length >= n, { timeout: ms || 120000 }, n); return T.downloads(p); };

  /** The page at 390 px and at 1400 px, dark and light: no sideways scroll, a screenshot of each. */
  T.layouts = async (url, prep) => {
    for (const [w, theme] of [[390, 'dark'], [1400, 'dark'], [390, 'light'], [1400, 'light']]) {
      const p = await T.open(url, { width: w, height: 900, theme });
      await p.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, theme);
      if (prep) await prep(p);
      await T.sleep(500);
      const m = await p.evaluate(() => {
        const io = document.querySelector('.tool-io');
        const r = io.getBoundingClientRect();
        const wide = [...(document.querySelector('main') || io).querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1); }).slice(0, 3).map((e) => e.tagName + '.' + e.className);
        return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, ioW: r.width, wide, bg: getComputedStyle(document.body).backgroundColor };
      });
      T.check(m.sw <= m.iw && !m.wide.length, w + ' px, ' + theme + ': no sideways scroll (page ' + m.sw + ' of ' + m.iw + ' px' + (m.wide.length ? '; too wide: ' + m.wide.join(', ') : '') + ')');
      await p.screenshot({ path: path.join(OUT, 'layout-' + w + '-' + theme + '.png'), fullPage: false });
      await p.close();
    }
  };

  /** Every interactive control in the tool can be reached with Tab (a real element with no negative tabindex, not hidden). */
  T.keyboard = async (p) => p.evaluate(() => {
    const io = document.querySelector('.tool-io');
    const ctl = [...io.querySelectorAll('button, input, select, textarea, [role=button]')].filter((e) => e.offsetParent !== null && !(e.type === 'file'));
    const bad = ctl.filter((e) => e.tabIndex < 0 || (e.getAttribute('role') === 'button' && e.tagName !== 'BUTTON' && e.tabIndex !== 0));
    const unlabelled = ctl.filter((e) => /INPUT|SELECT|TEXTAREA/.test(e.tagName) && e.type !== 'checkbox' && !(e.labels && e.labels.length) && !e.getAttribute('aria-label'));
    return { n: ctl.length, bad: bad.map((e) => e.outerHTML.slice(0, 80)), unlabelled: unlabelled.map((e) => e.id || e.outerHTML.slice(0, 60)) };
  });

  T.finish = async () => {
    try { if (T.browser) await T.browser.close(); } catch (e) { /* */ }
    if (T.server) T.server.close();
    T.section('requests outside 127.0.0.1: ' + (T.outside.length ? T.outside.join(' | ') : 'none'));
    if (T.errors.length) console.log('page errors: ' + T.errors.join(' | '));
    T.check(!T.outside.length, 'no request left 127.0.0.1');
    T.check(!T.errors.length, 'no page error');
    console.log('\n' + o.name + ': ' + T.passes + ' passed, ' + T.fails.length + ' failed');
    if (T.fails.length) T.fails.forEach((f) => console.log('  FAIL ' + f));
    process.exit(T.fails.length ? 1 : 0);
  };

  /* ---------------------------------------------------------------- */
  /* readers written from the specifications                          */
  /* ---------------------------------------------------------------- */
  const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t.push(c >>> 0); } return t; })();
  T.crc32 = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  /** ZIP (APPNOTE 6.3): the end record, then each central-directory entry, its local header and data; CRCs recomputed. */
  T.unzip = (b) => {
    let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('no end-of-central-directory record');
    const count = b.readUInt16LE(e + 10), cdSize = b.readUInt32LE(e + 12), cdOff = b.readUInt32LE(e + 16);
    if (cdOff + cdSize !== e) throw new Error('central directory does not end at the end record');
    const out = [];
    let q = cdOff;
    for (let k = 0; k < count; k++) {
      if (b.readUInt32LE(q) !== 0x02014b50) throw new Error('bad central header ' + k);
      const flags = b.readUInt16LE(q + 8), method = b.readUInt16LE(q + 10), crc = b.readUInt32LE(q + 16), csize = b.readUInt32LE(q + 20), usize = b.readUInt32LE(q + 24);
      const nlen = b.readUInt16LE(q + 28), xlen = b.readUInt16LE(q + 30), clen = b.readUInt16LE(q + 32), loff = b.readUInt32LE(q + 42);
      const name = b.slice(q + 46, q + 46 + nlen).toString(flags & 0x800 ? 'utf8' : 'latin1');
      if (b.readUInt32LE(loff) !== 0x04034b50) throw new Error('bad local header for ' + name);
      const lnlen = b.readUInt16LE(loff + 26), lxlen = b.readUInt16LE(loff + 28);
      const raw = b.slice(loff + 30 + lnlen + lxlen, loff + 30 + lnlen + lxlen + csize);
      const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
      out.push({ name, method, crcOk: data && T.crc32(data) === crc && data.length === usize, size: usize, data });
      q += 46 + nlen + xlen + clen;
    }
    return out;
  };

  /** PNG: signature, IHDR first, every chunk's CRC, IEND last. */
  T.png = (b) => {
    if (!b || b.length < 33 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return { ok: false, why: 'not a PNG signature' };
    let i = 8, chunks = [], crcOk = true;
    while (i + 12 <= b.length) {
      const len = b.readUInt32BE(i), type = b.slice(i + 4, i + 8).toString('latin1');
      const crc = b.readUInt32BE(i + 8 + len);
      if (T.crc32(b.slice(i + 4, i + 8 + len)) !== crc) crcOk = false;
      chunks.push(type);
      i += 12 + len;
      if (type === 'IEND') break;
    }
    return { ok: chunks[0] === 'IHDR' && chunks[chunks.length - 1] === 'IEND' && crcOk, w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], colour: b[25], chunks };
  };

  /** PDF: header, the xref table's offsets each landing on "n 0 obj", the page tree's count, and per page its MediaBox and image. */
  T.pdf = (b) => {
    const s = b.toString('latin1');
    const r = { header: s.slice(0, 8), pages: [], xrefOk: false, eof: /%%EOF\s*$/.test(s) };
    const sx = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(s);
    if (!sx) return r;
    const at = Number(sx[1]);
    const xr = /^xref\s+0\s+(\d+)\s+/.exec(s.slice(at));
    if (!xr) return r;
    const n = Number(xr[1]);
    const rows = s.slice(at + xr[0].length).split(/\r?\n/).slice(0, n);
    const offs = rows.map((l) => Number(l.slice(0, 10)));
    r.xrefOk = rows.slice(1).every((l, i) => / n\s*$/.test(l) && s.slice(offs[i + 1], offs[i + 1] + 20).startsWith((i + 1) + ' 0 obj'));
    const obj = (k) => { const a = offs[k]; return s.slice(a, s.indexOf('endobj', a)); };
    const tr = /trailer\s*<<([\s\S]*?)>>\s*startxref/.exec(s);
    const root = tr && /\/Root (\d+) 0 R/.exec(tr[1]);
    const pagesRef = root && /\/Pages (\d+) 0 R/.exec(obj(Number(root[1])));
    const pages = pagesRef && obj(Number(pagesRef[1]));
    r.count = pages ? Number((/\/Count (\d+)/.exec(pages) || [])[1]) : 0;
    const kids = pages ? [...(/\/Kids \[([^\]]*)\]/.exec(pages) || ['', ''])[1].matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1])) : [];
    for (const k of kids) {
      const po = obj(k);
      const mb = /\/MediaBox \[([^\]]+)\]/.exec(po);
      const im = /\/Im0 (\d+) 0 R/.exec(po);
      const io = im ? obj(Number(im[1])) : '';
      const jpegAt = io ? s.indexOf('stream\n', offs[Number(im[1])]) + 7 : -1;
      r.pages.push({
        box: mb ? mb[1].trim().split(/\s+/).map(Number) : null,
        image: io ? { w: Number((/\/Width (\d+)/.exec(io) || [])[1]), h: Number((/\/Height (\d+)/.exec(io) || [])[1]), filter: (/\/Filter \/(\w+)/.exec(io) || [])[1], len: Number((/\/Length (\d+)/.exec(io) || [])[1]), soi: jpegAt > 0 && b[jpegAt] === 0xFF && b[jpegAt + 1] === 0xD8 } : null
      });
    }
    return r;
  };

  /** Render a PDF in the page with the site's vendored pdf.js: per page, its size and how much ink. */
  T.pdfjs = (p, bytes) => p.evaluate(async (b64) => {
    const lib = await import('/engine/vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = '/engine/vendor/pdfjs/pdf.worker.min.mjs';
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const pdf = await lib.getDocument({ data: u8 }).promise;
    const out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const vp = pg.getViewport({ scale: 0.5 });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let dark = 0; for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 600) dark++;
      out.push({ w: pg.getViewport({ scale: 1 }).width, h: pg.getViewport({ scale: 1 }).height, ink: dark / (d.length / 4) });
    }
    return { n: pdf.numPages, pages: out };
  }, Buffer.from(bytes).toString('base64'));

  /** Boxes inside a rectangle (with half a pixel of slack), and pairs that overlap. */
  T.inside = (b, r) => b.x >= r.x - 0.5 && b.y >= r.y - 0.5 && b.x + b.w <= r.x + r.w + 0.5 && b.y + b.h <= r.y + r.h + 0.5;
  T.overlap = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
  T.save = (name, bytes) => { const f = path.join(OUT, name); fs.writeFileSync(f, bytes); return f; };
  return T;
};
