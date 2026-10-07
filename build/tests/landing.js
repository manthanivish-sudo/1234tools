/**
 * The landing pages (build-landing.js, build/landing/data.js), statically
 * and in headless Chrome against a static server of the site.
 *
 *   node build/tests/landing.js [--port 9060] [--root <site>] [--out <dir>] [--only slug,slug] [--record]
 *
 * --root defaults to the site this file sits in and is served on --port by
 * build/tests/serve.js. Exit code 2 when a case fails, 1 when the run breaks.
 * --record measures every page's example and writes the figures to
 * build/landing/recorded.json in --root (the figures the pages quote); without
 * it the same runs are repeated and compared with what the pages say.
 *
 * What it proves:
 *   static  build-landing.js --check says 0; the builder refuses presets its
 *           tools do not take (an unknown key, a format the converter cannot
 *           name, a select value that is not an option, a number out of range,
 *           ?from= on a tool that does not read it, a preset that changes
 *           nothing); every page is on disk with its own canonical, hreflang
 *           en and x-default to itself, one FAQPage holding exactly its visible
 *           questions, a BreadcrumbList, a title and a description no other
 *           landing page has; it is in sitemap-1.xml, in its hub's LANDING
 *           block and in assets/finder-index.js, and in neither the search
 *           index nor the tool register (it is not a tool, and carries no
 *           article.tool); every figure its example quotes is in its text
 *   1  each page in Chrome, after a remembered setting that disagrees with
 *      the preset has been stored for the tool: the tool mounts, every
 *      control the preset sets reads the preset's value (the remembered one
 *      lost), the converter's drop zone asks for the right files, the address
 *      carries the preset, no page error, no request off 127.0.0.1
 *   2  each page's example run again on that page with the same files: the
 *      figures it quotes come back (sizes within 2%, pixel sizes, counts and
 *      JPEG quality exact, quality within 3)
 *   3  a visitor's own link wins: /image/png-to-jpg/?to=webp opens on WebP;
 *      the full tool page without a query is unchanged by the landing pages
 *
 * Fixtures: the CC0 photos in build/promo/samples; PNG, WebP, BMP and the
 * large "camera" JPEGs are made from them here by Chrome's own canvas (not by
 * the site's encoders); product.gif and group.avif (build/landing/fixtures)
 * were made from them with Pillow; the HEIC is build/tests/image-fixtures.js's
 * container; the PDFs are written here, each photo's JPEG bytes placed on an
 * A4 page as they are.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] && !/^--/.test(process.argv[i + 1]) ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 9060));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-landing')));
const ONLY = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
const RECORD = process.argv.includes('--record');
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SITE = 'https://www.1234tools.com';
fs.mkdirSync(OUT, { recursive: true });

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}

let pass = 0, fail = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (detail !== undefined && !ok ? '   (' + String(detail).slice(0, 400) + ')' : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtBytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
const bytesOf = (s) => { const m = /^([\d.,]+)\s*(B|KB|MB)$/.exec(String(s).trim()); return m ? Number(m[1].replace(/,/g, '')) * { B: 1, KB: 1024, MB: 1048576 }[m[2]] : NaN; };

const L = require(path.join(ROOT, 'build-landing.js'));
const DATA = require(path.join(ROOT, 'build', 'landing', 'data.js'));
const PAGES = DATA.PAGES.filter((p) => !ONLY || ONLY.has(p.slug));
const urlOf = (p) => '/' + p.section + '/' + p.slug + '/';
const fileOf = (p) => path.join(ROOT, p.section, p.slug, 'index.html');

/* ------------------------------------------------------------------ */
/* static                                                             */
/* ------------------------------------------------------------------ */
function staticChecks() {
  console.log('\nstatic');
  const r = cp.spawnSync(process.execPath, ['build-landing.js', '--check'], { cwd: ROOT, encoding: 'utf8' });
  check(r.status === 0 && /\n\s*0 file\(s\) would change/.test(r.stdout), 'build-landing.js --check says 0 to change', r.stdout.slice(-600) + r.stderr);

  /* refusals: the builder's own gate, given presets each tool would not take */
  const base = DATA.PAGES.find((p) => p.slug === 'png-to-jpg');
  const pdf = DATA.PAGES.find((p) => p.slug === 'compress-pdf-to-100kb');
  const pass1 = DATA.PAGES.find((p) => p.slug === 'passport-photo-35x45mm');
  const cmp = DATA.PAGES.find((p) => p.slug === 'compress-image-to-20kb');
  const refuses = (p, preset, extra) => { try { L.expected(Object.assign({}, p, { preset }, extra || {}), L.tool(p.tool)); return false; } catch (e) { return /does not accept/.test(e.message); } };
  check(refuses(base, { from: 'png', to: 'tiff' }), 'refused: the converter has no TIFF output');
  check(refuses(base, { from: 'psd', to: 'jpg' }), 'refused: ?from= names a format the converter does not');
  check(refuses(base, { from: 'png', to: 'jpg', size: '20' }), 'refused: a key the converter has no control for');
  check(refuses(cmp, { target: '30' }), 'refused: 30 KB is not one of the compressor’s limits');
  check(refuses(cmp, { from: 'png', target: '20' }), 'refused: ?from= on the compressor, which does not read it');
  check(refuses(pass1, { preset: 'xx-passport' }), 'refused: a passport document the tool does not list');
  check(refuses(pdf, { kb: '5' }), 'refused: ?kb=5 is under compress-pdf’s 10 KB floor');
  check(refuses(pdf, { quality: '500' }), 'refused: a number outside its control’s range');
  check(refuses(base, { from: 'png', to: 'png' }, { presetIsDefault: false }) === false, 'a ?from= preset that sets the drop zone is accepted');
  check(refuses(cmp, { target: '0' }, { presetIsDefault: false }), 'refused: a preset that changes nothing');

  const search = fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8');
  const finder = fs.existsSync(path.join(ROOT, 'assets/finder-index.js')) ? fs.readFileSync(path.join(ROOT, 'assets/finder-index.js'), 'utf8') : '';
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap-1.xml'), 'utf8');
  const hubs = { image: fs.readFileSync(path.join(ROOT, 'image/index.html'), 'utf8'), pdf: fs.readFileSync(path.join(ROOT, 'pdf/index.html'), 'utf8') };
  const titles = new Map(), descs = new Map();
  for (const p of PAGES) {
    const f = fileOf(p);
    if (!fs.existsSync(f)) { check(false, urlOf(p) + ' exists'); continue; }
    const h = fs.readFileSync(f, 'utf8');
    const u = SITE + urlOf(p);
    const ok = [];
    const bad = (why) => ok.push(why);
    if ((h.match(/<link rel="canonical" href="([^"]+)">/) || [])[1] !== u) bad('canonical');
    const alt = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => m[1] + '=' + m[2]);
    if (alt.join(' ') !== 'en=' + u + ' x-default=' + u) bad('hreflang ' + alt.join(' '));
    let graph = [];
    try { graph = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(h)[1])['@graph']; } catch (e) { bad('JSON-LD'); }
    const faq = graph.filter((n) => n['@type'] === 'FAQPage');
    const visible = [...h.matchAll(/<details><summary>([^<]+)<\/summary>/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
    if (faq.length !== 1 || JSON.stringify(faq[0].mainEntity.map((q) => q.name)) !== JSON.stringify(visible)) bad('FAQPage ≠ visible questions');
    if (!graph.some((n) => n['@type'] === 'BreadcrumbList')) bad('BreadcrumbList');
    if (/<article class="tool[ "]/.test(h)) bad('carries article.tool');
    if (search.indexOf('"' + p.section + '/' + p.slug + '/"') >= 0) bad('in the search index');
    if (sitemap.indexOf('<loc>' + u + '</loc>') < 0) bad('not in sitemap-1.xml');
    const block = (/<!-- LANDING: generated by build-landing\.js[\s\S]*?<!-- \/LANDING -->/.exec(hubs[p.section]) || [''])[0];
    if (block.indexOf('href="' + urlOf(p) + '"') < 0) bad('not on the /' + p.section + '/ hub');
    if (finder.indexOf('"' + p.section + '/' + p.slug + '/"') < 0) bad('not in the finder index');
    const t = (/<title>([^<]+)<\/title>/.exec(h) || [])[1], d = (/<meta name="description" content="([^"]+)">/.exec(h) || [])[1];
    if (titles.has(t)) bad('title shared with ' + titles.get(t)); titles.set(t, p.slug);
    if (descs.has(d)) bad('description shared with ' + descs.get(d)); descs.set(d, p.slug);
    const ex = (/<section class="panel landing-example[\s\S]*?<\/section>/.exec(h) || [''])[0];
    for (const k of quoted(p)) { const v = (p.example.shown || {})[k]; if (v === undefined || ex.indexOf(esc(String(v))) < 0) bad('example does not quote {' + k + '} = ' + v); }
    if (!Object.keys(p.example.shown || {}).length) bad('example has no recorded figures');
    check(ok.length === 0, urlOf(p) + ': canonical, hreflang, FAQPage, crumbs, sitemap, hub, finder, own title and description, quoted figures', ok.join('; '));
  }
}
/** The figures a page's example text quotes, as {name}. */
const quoted = (p) => [...String(p.example.text).matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((m) => m[1]);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------------ */
/* fixtures                                                           */
/* ------------------------------------------------------------------ */
const SAMPLES = path.join(ROOT, 'build', 'promo', 'samples');
const FIX = path.join(OUT, 'fixtures');
fs.mkdirSync(FIX, { recursive: true });

/** A PDF of A4 pages, one JPEG on each, its bytes stored as they are (DCTDecode). */
function pdfOfJpegs(jpegs) {
  const objs = [];
  const add = (buf) => { objs.push(buf); return objs.length; };
  const pages = [];
  const catalog = add(null), pagesId = add(null);
  for (const j of jpegs) {
    const { w, h } = jpegSize(j);
    const img = add(Buffer.concat([Buffer.from('<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + j.length + ' >>\nstream\n'), j, Buffer.from('\nendstream')]));
    const dw = 453.5, dh = dw * h / w, x = (595.28 - dw) / 2, y = (841.89 - dh) / 2;
    const content = 'q ' + dw.toFixed(2) + ' 0 0 ' + dh.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /Im0 Do Q';
    const c = add(Buffer.from('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'));
    pages.push(add(Buffer.from('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ' + img + ' 0 R >> >> /Contents ' + c + ' 0 R >>')));
  }
  objs[catalog - 1] = Buffer.from('<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>');
  objs[pagesId - 1] = Buffer.from('<< /Type /Pages /Kids [' + pages.map((p) => p + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let at = parts[0].length;
  const offs = [];
  objs.forEach((o, i) => { offs.push(at); const b = Buffer.concat([Buffer.from((i + 1) + ' 0 obj\n'), o, Buffer.from('\nendobj\n')]); parts.push(b); at += b.length; });
  let x = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  x += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R >>\nstartxref\n' + at + '\n%%EOF\n';
  parts.push(Buffer.from(x));
  return Buffer.concat(parts);
}
function jpegSize(b) {
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no SOF');
}
/** A 24-bit BMP from RGBA pixels, bottom-up rows padded to four bytes. */
function bmp(w, h, rgba) {
  const row = (w * 3 + 3) & ~3, size = 54 + row * h, b = Buffer.alloc(size);
  b.write('BM', 0, 'latin1'); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(row * h, 34);
  b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((h - 1 - y) * w + x) * 4, d = 54 + y * row + x * 3;
    b[d] = rgba[s + 2]; b[d + 1] = rgba[s + 1]; b[d + 2] = rgba[s];
  }
  return b;
}

/** Chrome's own canvas: the sample decoded, optionally scaled, encoded as type. */
async function canvasMake(browser, sample, type, quality, w, h) {
  const p = await browser.newPage();
  await p.goto(BASE + '/robots.txt');
  const r = await p.evaluate(async (src, type, quality, w, h) => {
    const bm = await createImageBitmap(await (await fetch(src)).blob());
    const c = document.createElement('canvas'); c.width = w || bm.width; c.height = h || bm.height;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bm, 0, 0, c.width, c.height);
    if (type === 'rgba') return { w: c.width, h: c.height, px: Array.from(x.getImageData(0, 0, c.width, c.height).data) };
    const b = await new Promise((res) => c.toBlob(res, type, quality));
    return { bytes: Array.from(new Uint8Array(await b.arrayBuffer())) };
  }, '/build/promo/samples/' + sample, type, quality, w, h);
  await p.close();
  return r;
}

async function fixtures(browser) {
  const out = {};
  const put = (name, buf) => { fs.writeFileSync(path.join(FIX, name), buf); out[name] = path.join(FIX, name); };
  const sample = (n) => fs.readFileSync(path.join(SAMPLES, n));
  for (const n of fs.readdirSync(SAMPLES)) if (/\.jpg$/.test(n)) put(n, sample(n));
  for (const n of ['product.gif', 'group.avif']) put(n, fs.readFileSync(path.join(ROOT, 'build', 'landing', 'fixtures', n)));
  put('street.png', Buffer.from((await canvasMake(browser, 'street.jpg', 'image/png')).bytes));
  put('pet.png', Buffer.from((await canvasMake(browser, 'pet.jpg', 'image/png')).bytes));
  put('landscape.webp', Buffer.from((await canvasMake(browser, 'landscape.jpg', 'image/webp', 0.9)).bytes));
  put('street-camera.jpg', Buffer.from((await canvasMake(browser, 'street.jpg', 'image/jpeg', 0.95, 3200, 2400)).bytes));
  put('landscape-camera.jpg', Buffer.from((await canvasMake(browser, 'landscape.jpg', 'image/jpeg', 0.98, 3200, 2126)).bytes));
  const px = await canvasMake(browser, 'portrait.jpg', 'rgba');
  put('portrait.bmp', bmp(px.w, px.h, px.px));
  put('logo.svg', Buffer.from(fs.readFileSync(path.join(ROOT, 'assets/img/logo.svg'), 'utf8').replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"')));
  const IF = require(path.join(ROOT, 'build', 'tests', 'image-fixtures.js'));
  put('photo.heic', IF.heicWithExif(IF.exifTiff(1), 4032, 3024));
  put('photos-4.pdf', pdfOfJpegs(['street', 'food', 'pet', 'product'].map((n) => sample(n + '.jpg'))));
  put('photos-6.pdf', pdfOfJpegs(['street', 'food', 'pet', 'product', 'landscape', 'group'].map((n) => sample(n + '.jpg'))));
  put('scan-2.pdf', pdfOfJpegs(['document', 'group'].map((n) => sample(n + '.jpg'))));
  const hq = [];
  for (const n of ['street', 'food', 'pet', 'product', 'landscape', 'group', 'portrait', 'document']) {
    const b = Buffer.from((await canvasMake(browser, n + '.jpg', 'image/jpeg', 0.95, 2400, null)).bytes);
    hq.push(b);
  }
  return Object.assign(out, { 'photos-hq-8.pdf': (put('photos-hq-8.pdf', pdfOfJpegs(hq)), path.join(FIX, 'photos-hq-8.pdf')) });
}

/* ------------------------------------------------------------------ */
/* the browser                                                        */
/* ------------------------------------------------------------------ */
const outside = [];
async function open(browser, url, seed) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !/^(data|blob):/.test(u)) { outside.push(url + ' -> ' + u); return r.abort(); }
    r.continue();
  });
  p.__errors = [];
  p.on('pageerror', (e) => p.__errors.push(String(e && e.message || e)));
  await p.evaluateOnNewDocument((seed) => {
    try {
      localStorage.setItem('1234tools-consent', 'declined');
      /* a visitor who has used the tool before, with settings that disagree with this page's preset */
      Object.keys(localStorage).filter((k) => /^1234tools-(img|pdf)-/.test(k)).forEach((k) => localStorage.removeItem(k));
      if (seed) localStorage.setItem(seed.key, JSON.stringify(seed.value));
    } catch (e) { /* none */ }
    window.__downloads = [];
    HTMLAnchorElement.prototype.click = function () {
      const a = this;
      if (a.download) window.__downloads.push(fetch(a.href).then((r) => r.blob()).then((b) => ({ name: a.download, size: b.size })));
    };
  }, seed || null);
  await p.goto(BASE + url, { waitUntil: 'load' });
  await p.waitForSelector('.tool-io > *', { timeout: 20000 });
  return p;
}

/** A remembered value for each control the preset sets, other than the preset's. */
function seedFor(p) {
  const t = L.tool(p.tool);
  const S = L.SHELLS[t.registry];
  const exp = L.expected(p, t);
  const value = {};
  for (const [id, v] of Object.entries(exp)) {
    if (id === 'drop') continue;
    const key = id.slice(S.idPrefix.length);
    const c = t.spec.controls.find((x) => x.key === key);
    if (c.type === 'select') value[key] = String((c.options.find((o) => String(o.value) !== v) || {}).value);
    else value[key] = Number(v) === Number(c.min) ? Number(c.max || Number(v) + 1) : Number(c.min);
  }
  return { key: S.store(t.id), value, exp };
}

async function presetCase(browser, p) {
  const seed = seedFor(p);
  const pg = await open(browser, urlOf(p), seed);
  const got = await pg.evaluate((ids) => {
    const o = {};
    ids.forEach((id) => { const e = document.getElementById(id); o[id] = e ? e.value : null; });
    const d = document.querySelector('.landing-tool .dropzone strong');
    return { o, drop: d ? d.textContent : null, search: location.search, expect: JSON.parse(document.querySelector('[data-landing-expect]').getAttribute('data-landing-expect')) };
  }, Object.keys(seed.exp).filter((k) => k !== 'drop'));
  const wrong = Object.keys(seed.exp).filter((k) => k !== 'drop' && got.o[k] !== seed.exp[k]);
  check(wrong.length === 0 && JSON.stringify(got.expect) === JSON.stringify(seed.exp), urlOf(p) + ': ' + Object.entries(seed.exp).filter((e) => e[0] !== 'drop').map((e) => e[0] + '=' + e[1]).join(', ') + ' over a remembered ' + JSON.stringify(seed.value),
    wrong.map((k) => k + ' is ' + got.o[k]).join('; ') + ' page expects ' + JSON.stringify(got.expect));
  if (seed.exp.drop) check(got.drop === seed.exp.drop, urlOf(p) + ': drop zone says "' + seed.exp.drop + '"', got.drop);
  const q = new URLSearchParams(got.search);
  check(Object.entries(p.preset).every(([k, v]) => q.get(k) === String(v)), urlOf(p) + ': the address carries the preset', got.search);
  check(pg.__errors.length === 0, urlOf(p) + ': no page error', pg.__errors.join(' | '));
  return pg;
}

/* run a page's example and read what the tool shows */
async function runExample(pg, p, fx) {
  const files = p.example.files.map((f) => fx[f]);
  const isPdf = /^\/pdf\//.test(p.tool);
  const input = await pg.$('.landing-tool .tool-io input[type=file]');
  await input.uploadFile(...files);
  if (isPdf) {
    await pg.waitForFunction(() => { const b = document.querySelector('.landing-tool .opt-bar ~ * .btn-primary, .landing-tool .io-actions .btn-primary, .landing-tool .btn-primary'); return b && !b.disabled; }, { timeout: 30000 });
    await sleep(400);
    await pg.evaluate(() => {
      const b = [...document.querySelectorAll('.landing-tool button.btn-primary')].find((x) => !/Download/.test(x.textContent));
      b.click();
    });
    await pg.waitForFunction(() => document.querySelectorAll('.landing-tool .stat-row').length || document.querySelector('.landing-tool .io-msg.is-error'), { timeout: 180000, polling: 200 });
  } else {
    await pg.waitForFunction(() => {
      const m = document.querySelector('.landing-tool .io-msg');
      if (m && /is-(error|warn)/.test(m.className) && m.textContent.trim()) return true;
      return document.querySelector('.landing-tool .image-stage img, .landing-tool .image-stage canvas') && !document.querySelector('.landing-tool .tool-io[aria-busy]');
    }, { timeout: 120000, polling: 200 });
  }
  let last = '';
  for (let k = 0; k < 40; k++) {
    await sleep(400);
    const now = await pg.evaluate(() => document.querySelector('.landing-tool .tool-io').innerText + (document.querySelector('.landing-tool .tool-io[aria-busy]') ? 'busy' : ''));
    if (now === last && !/busy$/.test(now)) break;
    last = now;
  }
  return pg.evaluate(() => {
    const io = document.querySelector('.landing-tool .tool-io');
    return {
      stats: [...io.querySelectorAll('.stat-row')].map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent]),
      captions: [...io.querySelectorAll('.file-size')].map((e) => e.textContent),
      cards: [...io.querySelectorAll('figcaption, .pdf-result, .img-result-name, .file-name')].map((e) => e.textContent.trim()).slice(0, 20),
      msg: (io.querySelector('.io-msg') || {}).textContent || '',
      text: io.innerText.slice(0, 3000)
    };
  });
}

/** The figures a page quotes, from what its run showed. */
function figures(p, r, fx) {
  const f = {};
  const st = (k) => (r.stats.find((x) => x[0] === k) || [])[1];
  const inBytes = p.example.files.reduce((s, n) => s + fs.statSync(fx[n]).size, 0);
  f.in = fmtBytes(inBytes);
  /* one image: the compare view's "Result 419.2 KB · 1600×1200"; several, or a passport: each card's "413×531 · 74.8 KB" */
  const rm = /\nResult ([\d.]+ (?:B|KB|MB)) · (\d+)×(\d+)/.exec(r.text);
  const cm = /^(\d+)×(\d+) · ([\d.]+ (?:B|KB|MB))/.exec(r.captions[0] || '');
  if (rm) { f.out = rm[1]; f.dims = rm[2] + ' × ' + rm[3]; }
  else if (cm) { f.dims = cm[1] + ' × ' + cm[2]; f.out = cm[3]; }
  const sm = /^(\d+)×(\d+) · ([\d.]+ (?:B|KB|MB))/.exec(r.captions[1] || '');
  if (sm && /passport/.test(p.tool)) f.sheet = sm[1] + ' × ' + sm[2] + ', ' + sm[3];
  if (st('Quality found')) f.q = st('Quality found').replace(/ .*/, '');
  if (st('Images produced')) { f.n = st('Images produced'); f.total = st('Total size'); }
  if (st('PDF size')) f.out = st('PDF size');
  if (st('After')) f.out = st('After');
  if (st('Settings')) f.settings = st('Settings').replace(/^(\d+) DPI pictures, JPEG quality (\d+)$/, '$1 DPI pictures at JPEG quality $2');
  if (/heic/.test(p.slug)) f.msg = r.msg.trim();
  return f;
}

(async () => {
  staticChecks();
  const puppeteer = loadPuppeteer();
  const { serve } = require('./serve.js');
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--disable-gpu'] });
  const recorded = {};
  try {
    const fx = await fixtures(browser);
    console.log('\n1, 2  each page: the preset, then its example');
    for (const p of PAGES) {
      const pg = await presetCase(browser, p);
      let r;
      try { r = await runExample(pg, p, fx); } catch (e) { check(false, urlOf(p) + ': example ran', e.message); await pg.close(); continue; }
      if (RECORD) {
        recorded[p.slug] = { raw: r, figures: figures(p, r, fx) };
        console.log('  ' + p.slug + ' ' + JSON.stringify(recorded[p.slug].figures) + '\n    stats ' + JSON.stringify(r.stats) + '\n    captions ' + JSON.stringify(r.captions) + '\n    msg ' + r.msg.slice(0, 300));
      } else {
        const now = figures(p, r, fx);
        const bad = [];
        for (const k of quoted(p)) {
          const v = (p.example.shown || {})[k];
          const g = now[k];
          const b1 = bytesOf(v), b2 = bytesOf(g);
          if (!isNaN(b1)) { if (!(Math.abs(b2 - b1) <= b1 * 0.02)) bad.push(k + ' ' + v + ' now ' + g); }
          else if (k === 'q') { if (!(Math.abs(Number(g) - Number(v)) <= 3)) bad.push('quality ' + v + ' now ' + g); }
          else if (String(g) !== String(v)) bad.push(k + ' "' + v + '" now "' + g + '"');
        }
        check(bad.length === 0, urlOf(p) + ': the example’s ' + quoted(p).length + ' quoted figure(s) come back: ' + quoted(p).map((k) => (p.example.shown || {})[k]).join(', ').slice(0, 120), bad.join('; '));
      }
      await pg.close();
    }
    if (!ONLY || ONLY.has('png-to-jpg')) {
      console.log('\n3  a visitor’s own link wins; the tool page itself is unchanged');
      const a = await open(browser, '/image/png-to-jpg/?to=webp');
      check(await a.$eval('#ic-format', (e) => e.value) === 'image/webp', '/image/png-to-jpg/?to=webp opens on WebP');
      await a.close();
      const b = await open(browser, '/image/image-converter/');
      check(await b.$eval('#ic-format', (e) => e.value) === 'image/png' && await b.evaluate(() => location.search) === '', 'the converter’s own page still opens on PNG with no query');
      await b.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  check(outside.length === 0, 'no request left 127.0.0.1', outside.slice(0, 5).join(', '));
  if (RECORD) {
    const file = path.join(ROOT, 'build', 'landing', 'recorded.json');
    const was = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    for (const [k, v] of Object.entries(recorded)) was[k] = v.figures;
    fs.writeFileSync(file, JSON.stringify(was, null, 1) + '\n');
    fs.writeFileSync(path.join(OUT, 'recorded-raw.json'), JSON.stringify(recorded, null, 1));
    console.log('\nrecorded ' + Object.keys(recorded).length + ' page(s) into ' + file);
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
