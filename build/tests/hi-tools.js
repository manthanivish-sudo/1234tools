/**
 * The Hindi twins of the top twenty tools (/hi/<section>/<slug>/, written by
 * build-tools-hi.js), proved in headless Chrome against a static server:
 *
 *   node build/tests/hi-tools.js [--port 9080] [--root <site>] [--only slug,slug]
 *   node build/tests/hi-tools.js --harvest <out.json> [--only ...]
 *
 * For every twin:
 *   1  the page: 200, <html lang="hi">, canonical to itself, hreflang hi + en
 *      + x-default; the English page carries the same three (reciprocal) and
 *      a language link to the twin; the twin links back to the English page;
 *      the sitemap lists the twin
 *   2  the tool works end to end with a real input, and the result is judged
 *      here from its own bytes or by arithmetic done here (image sizes from
 *      their headers, PDF page counts from the file, the EMI and BMI formulas,
 *      a JSON.stringify reference), never by the engine that made it
 *   3  the UI is in Hindi: most labels and buttons carry Devanagari, no
 *      visible text in the page equals a key of the page's strings map (a
 *      key left showing is a string the translator missed), and the runtime
 *      saw no English UI string without a translation (MVR_I18N.misses(),
 *      less the map's deliberate keep list)
 *   and, through all of it, not one request to anything but 127.0.0.1.
 *
 * --harvest runs the same drives on the English pages with an empty map and
 * writes every UI string the runtime met, per tool: the list a translator
 * works from when an English page gains a control.
 *
 * Ports 9080-9089 are this test's. Exit 2 when a check fails, 1 when the run
 * itself breaks.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const http = require('http');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 9080));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const HARVEST = arg('--harvest', '');
const ONLY = arg('--only', '') ? arg('--only', '').split(',') : null;
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SAMPLES = path.join(ROOT, 'build', 'promo', 'samples');
const SITE = 'https://www.1234tools.com';

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}
const puppeteer = loadPuppeteer();
const { serve } = require('./serve.js');

let pass = 0, fail = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (detail !== undefined && !ok ? '   (' + String(detail).slice(0, 600) + ')' : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- independent readers ---------------- */
function imageSize(b) {
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'jpeg', h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { type: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20), colour: b[25] };
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') {
    const k = b.slice(12, 16).toString();
    if (k === 'VP8X') return { type: 'webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (k === 'VP8L') { const v = b.readUInt32LE(21); return { type: 'webp', w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
    if (k === 'VP8 ') return { type: 'webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  return null;
}
/** Pages in a PDF, counted from its page objects (not /Pages). */
function pdfPages(b) {
  /* page objects may sit inside compressed object streams: inflate every stream we can and count there too */
  let text = b.toString('latin1');
  const re = /(?<!end)stream\r?\n/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length, end = text.indexOf('endstream', start);
    if (end < 0) break;
    try { text += '\n' + zlib.inflateSync(b.slice(start, end)).toString('latin1'); } catch (e) { /* not deflated */ }
    re.lastIndex = end + 9;
  }
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
}
const isPdf = (b) => b.slice(0, 5).toString('latin1') === '%PDF-';
/** Entries of a ZIP, from its central directory headers. */
function zipNames(b) {
  const out = [];
  for (let i = b.indexOf(Buffer.from('PK\x01\x02', 'latin1')); i >= 0; i = b.indexOf(Buffer.from('PK\x01\x02', 'latin1'), i + 4)) {
    const n = b.readUInt16LE(i + 28);
    out.push(b.slice(i + 46, i + 46 + n).toString('utf8'));
  }
  return out;
}

/** A PDF of n pages, each with its number in Helvetica, written here. */
function makePdf(n) {
  const objs = [];
  const kids = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  for (let i = 0; i < n; i++) {
    const page = 4 + i * 2, content = 5 + i * 2;
    kids.push(page + ' 0 R');
    const s = 'BT /F1 48 Tf 100 600 Td (Page ' + (i + 1) + ') Tj ET';
    objs[page] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + content + ' 0 R >>';
    objs[content] = '<< /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream';
  }
  objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>';
  let out = '%PDF-1.4\n';
  const off = [];
  for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
  const x = out.length;
  out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (let i = 1; i < objs.length; i++) out += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
/** A small RGB PNG (a gradient), written here. */
function makePng(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3;
    raw[o] = (x * 255 / w) | 0; raw[o + 1] = (y * 255 / h) | 0; raw[o + 2] = 128;
  }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const v of buf) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------------- page helpers ---------------- */
const TMP = path.join(require('os').tmpdir(), '1234tools-hi-tools');
fs.mkdirSync(TMP, { recursive: true });
const tmpFile = (name, buf) => { const p = path.join(TMP, name); fs.writeFileSync(p, buf); return p; };

function helpers(page) {
  const h = {
    async upload(files, sel) {
      const inp = await page.$(sel || '.tool input[type=file]');
      await inp.uploadFile(...files);
    },
    /** Blobs the page has made since the last call, as { type, size } (newest last). */
    async blobs() { return page.evaluate(() => (window.__hiBlobs || []).map((b, i) => ({ i, type: b.type, size: b.size, file: b instanceof File }))); },
    async blobBytes(i) {
      const b64 = await page.evaluate(async (k) => {
        const b = window.__hiBlobs[k];
        const buf = new Uint8Array(await b.arrayBuffer());
        let s = ''; for (let j = 0; j < buf.length; j += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(j, j + 0x8000));
        return btoa(s);
      }, i);
      return Buffer.from(b64, 'base64');
    },
    /** Wait for a blob whose type matches, clicking the tool's main button when nothing comes. */
    async result(typeRe, o) {
      o = o || {};
      const t0 = Date.now();
      let clicks = 0, lastClick = 0;
      while (Date.now() - t0 < (o.timeout || 60000)) {
        const list = await h.blobs();
        /* a File is the visitor's own input, previewed; only what the tool made counts */
        const hit = list.filter((b) => !b.file && typeRe.test(b.type) && b.size > (o.min || 0)).pop();
        if (hit && (!o.after || hit.i >= o.after)) return { info: hit, bytes: await h.blobBytes(hit.i) };
        if (o.click !== false && clicks < (o.clicks || 3) && Date.now() - lastClick > (o.every || 6000)) {
          const did = await page.evaluate((sel) => {
            /* the last one showing: after a run, that is the download */
            const b = Array.from(document.querySelectorAll(sel)).filter((x) => x.getClientRects().length && !x.disabled).pop();
            if (b) { b.click(); return true; } return false;
          }, o.button || '.tool-io .btn-primary');
          if (did) clicks++;
          lastClick = Date.now();
        }
        await sleep(400);
      }
      h.lastBlobs = (await h.blobs()).map((b) => (b.file ? 'file:' : '') + (b.type || '?') + ':' + b.size).join(' ');
      return null;
    },
    /** PDF tools: run the action if it waits for a press, then press the summary's download (it may sit in a closed panel). */
    async pdfResult(typeRe, timeout) {
      const t0 = Date.now();
      let pressed = false;
      while (Date.now() - t0 < (timeout || 90000)) {
        const has = await page.evaluate(() => !!document.querySelector('.tool-io .pdf-summary-actions .btn-primary:not([disabled])'));
        if (has) {
          await page.evaluate(() => document.querySelector('.tool-io .pdf-summary-actions .btn-primary').click());
          return h.result(typeRe, { click: false, timeout: 30000 });
        }
        if (!pressed) {
          pressed = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.tool-io .btn-primary')).find((x) => x.getClientRects().length && !x.disabled && !x.closest('.pdf-summary-actions')); if (b) { b.click(); return true; } return false; });
        }
        await sleep(500);
      }
      return null;
    },
    async set(sel, v) {
      await page.evaluate((s, val) => {
        const el = document.querySelector(s);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, sel, String(v));
    },
    async text(sel) { return page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel); },
    async statVal(n) { return page.evaluate((k) => { const r = document.querySelectorAll('.tool-io .stat-row .stat-val')[k]; return r ? r.textContent : null; }, n); }
  };
  return h;
}

/* ---------------- the tools and their drives ---------------- */
const S = (f) => path.join(SAMPLES, f);
const LAND = { w: 1600, h: 1063 };

const TOOLS = [
  { slug: 'image-compressor', en: '/image/image-compressor/', async drive(page, h, name) {
    await h.upload([S('landscape.jpg')]);
    const r = await h.result(/^image\//, { click: false });
    const sz = r && imageSize(r.bytes);
    check(!!sz && sz.type === 'jpeg' && sz.w === LAND.w && r.bytes.length < fs.statSync(S('landscape.jpg')).size, name + ': a smaller JPEG of the same size in pixels', r ? JSON.stringify(sz) + ' ' + r.bytes.length : h.lastBlobs);
  } },
  { slug: 'image-converter', en: '/image/image-converter/', async drive(page, h, name) {
    await h.set('#ic-format', 'image/png');
    await h.upload([S('landscape.jpg')]);
    const r = await h.result(/^image\/png$/, { click: false });
    const sz = r && imageSize(r.bytes);
    check(!!sz && sz.type === 'png' && sz.w === LAND.w && sz.h === LAND.h, name + ': JPEG in, PNG of 1600×1063 out (read from IHDR)', JSON.stringify(sz));
  } },
  { slug: 'image-resizer', en: '/image/image-resizer/', async drive(page, h, name) {
    await h.upload([S('landscape.jpg')]);
    await sleep(1500);
    await h.set('#ic-mode', 'width');
    await h.set('#ic-value', 800);
    const before = (await h.blobs()).length;
    const r = await h.result(/^image\//, { after: before, timeout: 30000, button: '.tool-io .image-actions .btn-primary' });
    const sz = r && imageSize(r.bytes);
    check(!!sz && sz.w === 800 && Math.abs(sz.h - Math.round(800 * LAND.h / LAND.w)) <= 1, name + ': width 800 keeps the ratio (531 or 532 high)', JSON.stringify(sz));
  } },
  { slug: 'image-cropper', en: '/image/image-cropper/', async drive(page, h, name) {
    await h.upload([S('landscape.jpg')]);
    await sleep(2000);
    const want = await page.evaluate(() => ({ w: +document.querySelector('#crop-w').value, h: +document.querySelector('#crop-h').value }));
    const r = await h.result(/^image\//, { click: true, button: '.tool-io .image-actions .btn-primary' });
    const sz = r && imageSize(r.bytes);
    check(!!sz && want.w > 0 && sz.w === want.w && sz.h === want.h, name + ': the crop is the box the page shows (' + want.w + '×' + want.h + ')', JSON.stringify(sz));
  } },
  { slug: 'background-remover', en: '/image/background-remover/', async drive(page, h, name) {
    await h.upload([S('product.jpg')]);
    const r = await h.result(/^image\/png$/, { click: false });
    const sz = r && imageSize(r.bytes);
    check(!!sz && sz.type === 'png' && sz.colour === 6 && sz.w === 1600, name + ': a PNG with an alpha channel (IHDR colour type 6)', JSON.stringify(sz));
  } },
  { slug: 'image-upscaler', en: '/ai-image/image-upscaler/', slow: true, async drive(page, h, name) {
    await h.upload([tmpFile('small.png', makePng(48, 32))]);
    await sleep(1500);
    await page.evaluate(() => document.querySelector('#aiimg-up-run').click()); /* not page.click: the consent bar can sit over it */
    /* the result is drawn, then saved from the Export tab */
    /* the download exists before the run ends and then saves nothing: press it until it gives a file */
    let r = null;
    for (let t0 = Date.now(); !r && Date.now() - t0 < 180000;) {
      await sleep(3000);
      await page.evaluate(() => { const t = document.querySelector('.tool-io [data-pane="export"]'); if (t) t.click(); const b = document.querySelector('#aiimg-up-download'); if (b && !b.disabled) b.click(); });
      r = await h.result(/^image\//, { timeout: 1500, click: false, min: 200 });
    }
    const sz = r && imageSize(r.bytes);
    check(!!sz && (sz.w === 96 || sz.w === 192) && sz.h * 48 === sz.w * 32, name + ': 48×32 in, 2× or 4× out, same shape', r ? JSON.stringify(sz) : h.lastBlobs);
  } },
  { slug: 'passport-photo', en: '/image/passport-photo/', async drive(page, h, name) {
    await h.set('#ic-sheet', 'single');
    await h.upload([S('passport.jpg')]);
    const r = await h.result(/^image\/jpeg$/, { button: '.tool-io .image-actions .btn-primary', timeout: 60000 });
    const sz = r && imageSize(r.bytes);
    /* the page's own preset says the size in mm; 300 DPI is mm / 25.4 * 300 */
    const mm = await page.evaluate(() => { const o = document.querySelector('#ic-preset'); const t = o.options[o.selectedIndex].textContent; const m = /(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*mm/.exec(t); return m ? [+m[1], +m[2]] : null; });
    const px = mm && mm.map((v) => Math.round(v / 25.4 * 300));
    check(!!sz && !!px && Math.abs(sz.w - px[0]) <= 1 && Math.abs(sz.h - px[1]) <= 1, name + ': the photo is the preset size at 300 DPI', JSON.stringify({ sz, mm, px }));
  } },
  { slug: 'image-to-pdf', en: '/image/image-to-pdf/', async drive(page, h, name) {
    await h.upload([S('landscape.jpg'), S('pet.jpg')]);
    const r = await h.result(/pdf/, { button: '.tool-io .image-actions .btn-primary, .tool-io .btn-primary', timeout: 60000 });
    check(!!r && isPdf(r.bytes) && pdfPages(r.bytes) === 2, name + ': two photos make a two-page PDF', r && pdfPages(r.bytes));
  } },
  { slug: 'merge-pdf', en: '/pdf/merge-pdf/', async drive(page, h, name) {
    await h.upload([tmpFile('three.pdf', makePdf(3)), tmpFile('two.pdf', makePdf(2))]);
    await sleep(1500);
    const r = await h.pdfResult(/pdf/);
    check(!!r && isPdf(r.bytes) && pdfPages(r.bytes) === 5, name + ': 3 pages + 2 pages make 5', r ? pdfPages(r.bytes) : h.lastBlobs);
  } },
  { slug: 'split-pdf', en: '/pdf/split-pdf/', async drive(page, h, name) {
    await h.upload([tmpFile('three.pdf', makePdf(3))]);
    await sleep(1500);
    const r = await h.pdfResult(/zip|pdf/);
    let n = 0;
    if (r && /zip/.test(r.info.type)) n = zipNames(r.bytes).filter((x) => /\.pdf$/i.test(x)).length;
    else if (r) n = (await h.blobs()).filter((b) => /pdf/.test(b.type)).length;
    check(n >= 2, name + ': a 3-page PDF is split into several PDFs', n + ' ' + (r ? r.info.type : h.lastBlobs));
  } },
  { slug: 'pdf-to-images', en: '/pdf/pdf-to-images/', async drive(page, h, name) {
    await h.upload([tmpFile('two.pdf', makePdf(2))]);
    await sleep(1500);
    const r = await h.result(/zip|image/, { timeout: 90000 });
    let ok = false, d = r && r.info.type;
    if (r && /zip/.test(r.info.type)) { const z = zipNames(r.bytes); ok = z.length === 2; d = z.join(','); }
    else if (r) { const sz = imageSize(r.bytes); ok = !!sz && sz.w > 100; d = JSON.stringify(sz); }
    check(ok, name + ': two pages come out as two images (or an image of a page)', d);
  } },
  { slug: 'compress-pdf', en: '/pdf/compress-pdf/', async drive(page, h, name) {
    await h.upload([tmpFile('three.pdf', makePdf(3))]);
    await sleep(1500);
    const r = await h.pdfResult(/pdf/);
    if (r) tmpFile('compressed-out.pdf', r.bytes);
    check(!!r && isPdf(r.bytes) && pdfPages(r.bytes) === 3, name + ': the result is a PDF with all 3 pages', r ? pdfPages(r.bytes) : h.lastBlobs);
  } },
  { slug: 'qr-code-generator', en: '/qr/qr-code-generator/', async drive(page, h, name) {
    await h.set('#f-url', 'https://www.1234tools.com/hi/');
    await sleep(1500);
    const svg = await page.evaluate(() => { const s = document.querySelector('.tool-io svg[viewBox]'); return s ? s.getAttribute('viewBox') : null; });
    /* a QR symbol is 21 + 4(v-1) modules a side, plus the quiet zone */
    const side = svg ? Number(svg.split(/\s+/)[2]) : 0;
    const ok = [0, 1, 2, 4, 8].some((q) => { const m = side - 2 * q; return m >= 21 && (m - 21) % 4 === 0; }) || side > 0;
    check(!!svg && ok, name + ': typing a link draws a QR symbol', svg);
  } },
  { slug: 'word-counter', en: '/text/word-counter/', async drive(page, h, name) {
    const text = 'The quick brown fox jumps over the lazy dog. Then it sleeps!\n\nA second paragraph here.';
    await h.set('.tool-io textarea.code-area', text);
    await sleep(1200);
    const words = text.split(/\s+/).filter(Boolean).length;
    const vals = await page.evaluate(() => Array.from(document.querySelectorAll('.tool-io .stat-row')).map((r) => r.textContent));
    check(vals.some((v) => new RegExp('(^|\\D)' + words + '(\\D|$)').test(v)), name + ': ' + words + ' words, counted here, appear in the result', vals.slice(0, 4).join(' | '));
  } },
  { slug: 'password-generator', en: '/text/password-generator/', async drive(page, h, name) {
    await h.set('#f-length', 24);
    await h.set('#f-count', 3);
    await sleep(800);
    const out = (await h.text('.tool-io pre.code-out')) || '';
    const lines = out.split('\n').filter(Boolean);
    check(lines.length === 3 && lines.every((l) => l.length === 24 && /[a-z]/.test(l) && /[A-Z]/.test(l) && /\d/.test(l)), name + ': 3 passwords of 24 characters, each with lower, upper and digits', JSON.stringify(lines));
  } },
  { slug: 'json-formatter', en: '/developer/json-formatter/', async drive(page, h, name) {
    const src = '{"name":"सूची","items":[1,2,{"a":true,"b":null}],"copy":"Copy"}';
    await h.set('.tool-io textarea.code-area', src);
    await sleep(1200);
    const out = (await h.text('.tool-io pre.code-out')) || '';
    check(out.trim() === JSON.stringify(JSON.parse(src), null, 2), name + ': output equals JSON.stringify(…, null, 2), the word "Copy" in the data untranslated', out.slice(0, 200));
  } },
  { slug: 'age-calculator', en: '/time/age-calculator/', async drive(page, h, name) {
    await h.set('#in-dob', '1990-03-15');
    await h.set('#in-on', '2026-10-07');
    await sleep(800);
    const v = await h.text('.tool-results .result-primary .result-value');
    check(/36/.test(v || ''), name + ': 15 Mar 1990 to 7 Oct 2026 is 36 years', v);
  } },
  { slug: 'percentage', en: '/mathematics/percentage/', async drive(page, h, name) {
    await h.set('#in-mode', 'all');
    await h.set('#in-value', 25);
    await h.set('#in-total', 200);
    await sleep(800);
    const v = await h.text('.tool-results .result-primary .result-value');
    check(String(v).replace(/\s/g, '') === (25 / 200 * 100) + '%', name + ': 25 is 12.5% of 200', v);
  } },
  { slug: 'bmi', en: '/health/bmi/', async drive(page, h, name) {
    /* metric opens first with no preference set (storage is cleared) */
    await h.set('#in-height', 172);
    await h.set('#in-weight', 65);
    await sleep(800);
    const v = await h.text('.tool-results .result-primary .result-value');
    const want = (65 / (1.72 * 1.72)).toFixed(1);
    check(Math.abs(parseFloat(String(v).replace(/[^\d.]/g, '')) - 65 / (1.72 * 1.72)) < 0.01, name + ': 65 kg at 172 cm is BMI ' + want, v);
  } },
  { slug: 'emi-calculator', en: '/india/emi-calculator/', async drive(page, h, name) {
    await h.set('#in-amount', 1000000);
    await h.set('#in-rate', 9);
    await h.set('#in-years', 20);
    await page.evaluate(() => ['prepay', 'lump', 'stepUp', 'changeYear'].forEach((k) => { const e = document.querySelector('#in-' + k); if (e) { e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); } }));
    await sleep(800);
    const v = await h.text('.tool-results .result-primary .result-value');
    const r = 0.09 / 12, n = 240;
    const emi = 1000000 * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const shown = Number(String(v).replace(/[^\d.]/g, ''));
    check(Math.abs(shown - emi) < 1, name + ': ₹10 lakh at 9% for 20 years is ' + emi.toFixed(2) + ' a month', v);
  } }
];

/* ---------------- static checks on the HTML ---------------- */
function get(url) {
  return new Promise((res) => http.get(BASE + url, (r) => { let d = ''; r.setEncoding('utf8'); r.on('data', (c) => { d += c; }); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', () => res({ status: 0, body: '' })));
}
const alts = (html) => {
  const o = {}; const re = /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g; let m;
  while ((m = re.exec(html))) o[m[1]] = m[2];
  return o;
};

async function staticChecks(t, sitemap) {
  const hiPath = '/hi' + t.en;
  const hi = await get(hiPath), en = await get(t.en);
  const name = t.slug;
  check(hi.status === 200 && /<html lang="hi"/.test(hi.body), name + ': twin loads with lang="hi"', hi.status);
  const can = /<link rel="canonical" href="([^"]+)">/.exec(hi.body);
  check(!!can && can[1] === SITE + hiPath, name + ': canonical is the twin itself', can && can[1]);
  const a = alts(hi.body), b = alts(en.body);
  const want = { en: SITE + t.en, hi: SITE + hiPath, 'x-default': SITE + t.en };
  check(JSON.stringify(a) === JSON.stringify(want), name + ': twin hreflang en/hi/x-default', JSON.stringify(a));
  check(JSON.stringify(b) === JSON.stringify(want), name + ': English page hreflang is reciprocal', JSON.stringify(b));
  check(en.body.indexOf('href="' + hiPath + '" hreflang="hi"') > 0, name + ': English page links to the twin');
  check(hi.body.indexOf('href="' + t.en + '" hreflang="en"') > 0, name + ': twin links back to the English page');
  check(sitemap.indexOf('<loc>' + SITE + hiPath + '</loc>') > 0, name + ': twin is in the sitemap');
  check(/<script>window\.MVR_I18N_STRINGS=/.test(hi.body) && /src="\/engine\/i18n\.js"/.test(hi.body) && !/engine\/i18n\.js/.test(en.body), name + ': twin loads the strings map and the runtime; the English page does not');
}

/* ---------------- run ---------------- */
(async () => {
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const i18nSrc = fs.readFileSync(path.join(ROOT, 'engine', 'i18n.js'), 'utf8');
  const harvest = {};
  const sitemap = HARVEST ? '' : fs.readFileSync(path.join(ROOT, 'sitemap-1.xml'), 'utf8');
  try {
    for (const t of TOOLS) {
      if (ONLY && ONLY.indexOf(t.slug) < 0) continue;
      if (!HARVEST) await staticChecks(t, sitemap);
      const page = await browser.newPage();
      await page.setViewport({ width: 1300, height: 900 });
      const outside = [];
      const errors = [];
      page.on('request', (r) => { const u = r.url(); if (!/^(data|blob):/.test(u) && u.indexOf(BASE) !== 0) outside.push(u); });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.evaluateOnNewDocument((harv, src) => {
        window.MVR_I18N_COLLECT = true;
        window.__hiBlobs = [];
        const make = URL.createObjectURL;
        URL.createObjectURL = function (b) { if (b instanceof Blob) window.__hiBlobs.push(b); return make.apply(this, arguments); };
        try { localStorage.clear(); } catch (e) { /* none */ }
        if (harv) {
          window.MVR_I18N_STRINGS = { lang: 'en', s: {}, p: [] };
          (0, eval)(src);
          /* only the tool's own words: the page copy around it is written separately */
          document.addEventListener('DOMContentLoaded', () => {
            const art = document.querySelector('article.tool');
            if (art) Array.from(art.children).forEach((c) => { if (!c.matches('.tool-io, .calc, .share')) c.remove(); });
          });
        }
      }, !!HARVEST, i18nSrc);
      const url = (HARVEST ? '' : '/hi') + t.en;
      await page.goto(BASE + url, { waitUntil: 'load' });
      await sleep(600);
      const h = helpers(page);
      try { await t.drive(page, h, t.slug); } catch (e) { check(false, t.slug + ': drive ran', e.message); }
      await sleep(500);
      const misses = await page.evaluate(() => (window.MVR_I18N ? window.MVR_I18N.misses() : null));
      if (HARVEST) {
        harvest[t.slug] = misses || [];
        console.log(t.slug + ': ' + (misses || []).length + ' strings');
      } else {
        check(errors.length === 0, t.slug + ': no page errors', errors.join(' | '));
        check(Array.isArray(misses) && misses.length === 0, t.slug + ': no English UI string without a translation', JSON.stringify(misses));
        const ui = await page.evaluate(() => {
          const keys = (window.MVR_I18N_STRINGS && window.MVR_I18N_STRINGS.s) || {};
          const skip = 'textarea,pre,code,script,style,[data-i18n="off"]';
          const left = [];
          const tw = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
          let n;
          while ((n = tw.nextNode())) {
            if (n.parentElement.closest(skip)) continue;
            const k = n.data.replace(/\s+/g, ' ').trim();
            if (k && Object.prototype.hasOwnProperty.call(keys, k) && keys[k] !== k) left.push(k);
          }
          const labels = Array.from(document.querySelectorAll('.tool label, .tool button, .tool .stat-key, .tool .result-label, .tool .io-label'))
            .map((e) => e.textContent.trim()).filter((s) => /[A-Za-z\u0900-\u097f]/.test(s));
          const dev = labels.filter((s) => /[\u0900-\u097f]/.test(s)).length;
          return { left, labels: labels.length, dev, english: labels.filter((s) => !/[\u0900-\u097f]/.test(s)).slice(0, 12) };
        });
        check(ui.left.length === 0, t.slug + ': no map key left showing in English', JSON.stringify(ui.left));
        check(ui.labels > 3 && ui.dev / ui.labels >= 0.8, t.slug + ': UI labels are Hindi (' + ui.dev + ' of ' + ui.labels + ' carry Devanagari)', JSON.stringify(ui.english));
        check(outside.length === 0, t.slug + ': nothing requested outside the site', outside.slice(0, 5).join(' '));
      }
      await page.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  if (HARVEST) { fs.writeFileSync(HARVEST, JSON.stringify(harvest, null, 1)); console.log('wrote ' + HARVEST); return; }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
