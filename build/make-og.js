/**
 * Regenerates assets/img/og-image.png.
 *
 * The OG image is the only page asset that states the tool count in pixels
 * rather than in text, so it is the one place a stale number cannot be fixed by
 * a find-and-replace and will sit there for months. The previous image said
 * "1,169+" while the site said "1,185" in 6,095 places. Hence a generator: the
 * count is read from assets/search-index.js at render time, so the image cannot
 * disagree with the site unless this is never run.
 *
 *   npm install puppeteer-core          (not committed; consent-check.js needs it too)
 *   node build/make-og.js               writes assets/img/og-image.png
 *   node build/make-og.js --check       renders and diffs, writes nothing
 *
 * Fonts are inlined as base64 rather than linked, because the page is rendered
 * from a data: URL with no origin to resolve assets/fonts/ against, and a
 * silent fallback to Segoe UI would not look wrong enough to notice.
 *
 * Lives in build/ because that is package source, not site output: robots.txt
 * disallows it and build-site.js skips the directory.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'img', 'og-image.png');
const CHECK = process.argv.includes('--check');

/* 1200x630 is the size Facebook, LinkedIn, Slack and X all size their previews
   from, and every one of them downscales to roughly 600px wide to display it.
   Rendered at 2x this file is 664 KB against 231 KB at 1x, which buys nothing
   the previews can show -- the type is already crisp here because it is set at
   104px, not because of the pixel ratio. */
const W = 1200, H = 630, SCALE = 1;

/** The count the site itself claims, so the image cannot drift from the pages. */
function toolCount() {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'search-index.js'), 'utf8');
  const fn = new Function(`var window={};${src};return window.SEARCH_INDEX;`);
  const idx = fn();
  if (!Array.isArray(idx) || !idx.length) throw new Error('search-index.js parsed to nothing');
  return idx.length;
}

const font = (f) => fs.readFileSync(path.join(ROOT, 'assets', 'fonts', f)).toString('base64');

/* Brand tokens, copied from :root in assets/app.css. If those change, these are
   the matching pair -- there is no way to share them across a data: URL. */
function html(count) {
  const n = count.toLocaleString('en-US');
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Sora';font-weight:400 800;font-display:block;
  src:url(data:font/woff2;base64,${font('sora-latin.woff2')}) format('woff2')}
@font-face{font-family:'Inter';font-weight:400 600;font-display:block;
  src:url(data:font/woff2;base64,${font('inter-latin.woff2')}) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;background:#06080f;overflow:hidden;
  font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
.stage{position:relative;width:100%;height:100%;padding:64px 72px;
  display:flex;flex-direction:column;justify-content:space-between}
/* Same two light sources as the logo: gold from the top left, violet bleeding
   in from the bottom right. Keeps the card recognisably part of the brand
   without repeating the mark at poster size. */
.glow-a{position:absolute;top:-340px;left:-220px;width:900px;height:900px;
  background:radial-gradient(circle,rgba(247,201,72,.17) 0%,rgba(247,201,72,0) 68%)}
.glow-b{position:absolute;bottom:-420px;right:-260px;width:900px;height:900px;
  background:radial-gradient(circle,rgba(124,92,255,.16) 0%,rgba(124,92,255,0) 68%)}
/* Named rather than a child-universal selector -- that matches the glows too,
   and being declared later at equal specificity it beat their
   position:absolute and dropped two 900px decorations into the flex flow. */
.brand,.mid,.foot{position:relative;z-index:1}
.brand{display:flex;align-items:center;gap:18px}
.brand svg{width:52px;height:52px;display:block}
.brand span{font-family:'Sora',sans-serif;font-weight:700;font-size:29px;
  color:#f4f6fb;letter-spacing:-.01em}
h1{font-family:'Sora',sans-serif;font-weight:800;font-size:104px;line-height:.98;
  letter-spacing:-.035em;
  background:linear-gradient(120deg,#ffe29a 0%,#f7c948 34%,#ff9d2e 78%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
h2{font-family:'Sora',sans-serif;font-weight:600;font-size:41px;line-height:1.22;
  letter-spacing:-.02em;color:#f4f6fb;margin-top:18px}
.pills{display:flex;gap:12px;margin-top:34px}
.pill{font-size:20px;font-weight:500;color:#d8dfef;padding:11px 20px;
  border:1px solid rgba(247,201,72,.32);border-radius:999px;
  background:rgba(247,201,72,.07)}
.foot{display:flex;align-items:center;justify-content:space-between;
  border-top:1px solid rgba(255,255,255,.09);padding-top:22px}
.url{font-size:22px;font-weight:600;color:#f7c948;letter-spacing:.005em}
.note{font-size:19px;color:#8790a5}
</style>
<div class="stage">
  <div class="glow-a"></div><div class="glow-b"></div>

  <div class="brand">
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe29a"/><stop offset="100%" stop-color="#f7c948"/></linearGradient>
      <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f7c948"/><stop offset="100%" stop-color="#e8a020"/></linearGradient>
      <linearGradient id="g3" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#e8a020"/><stop offset="100%" stop-color="#ff9d2e"/></linearGradient>
      <linearGradient id="g4" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff9d2e"/><stop offset="100%" stop-color="#f7c948"/></linearGradient>
    </defs>
      <rect x="74" y="74" width="170" height="170" rx="38" fill="url(#g1)"/>
      <rect x="268" y="74" width="170" height="170" rx="38" fill="url(#g2)"/>
      <rect x="74" y="268" width="170" height="170" rx="38" fill="url(#g3)"/>
      <rect x="268" y="268" width="170" height="170" rx="38" fill="url(#g4)"/>
      <circle cx="438" cy="74" r="17" fill="#2dd4ff"/>
      <circle cx="74" cy="438" r="17" fill="#7c5cff"/>
    </svg>
    <span>1234Tools</span>
  </div>

  <div class="mid">
    <h1>${n} calculators</h1>
    <h2>that run entirely in your browser</h2>
    <div class="pills">
      <div class="pill">No account</div>
      <div class="pill">Nothing you type is uploaded</div>
      <div class="pill">Works offline</div>
    </div>
  </div>

  <div class="foot">
    <div class="url">www.1234tools.com</div>
    <div class="note">Free &middot; No signup &middot; No paywall</div>
  </div>
</div>`;
}

/* ==================================================================
   --cards: one preview card per tool, per conversion family, per section
   ==================================================================

   node build/make-og.js --cards [--only finance/] [--check]

   WhatsApp, LinkedIn, Telegram, Slack and iMessage show og:image when a link
   is pasted, and with one site-wide card every tool looked the same in a
   chat. These go to assets/img/og/<section>/<slug>.jpg (each tool),
   assets/img/og/conversions/<family>.jpg and assets/img/og/<section>.jpg;
   build-share.js points each page at the most specific one along its path.
   New file names, so no chat app can serve a cached copy of the old card.

   JPEG at quality 80, 1200x630 at 1x: the glows are gradients, which PNG
   stores badly. One page is loaded once with the fonts inlined and each card
   is a DOM update and a screenshot, so a run is deterministic and quick. */

const OG_DIR = path.join(ROOT, 'assets', 'img', 'og');
const BUDGET = 80 * 1024;

const argOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

function loadWindowVar(rel, name) {
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, rel), 'utf8'))(box);
  return box[name];
}

const unesc = (s) => String(s)
  .replace(/&(?:lt|#0*60);/g, '<').replace(/&(?:gt|#0*62);/g, '>')
  .replace(/&(?:quot|#0*34);/g, '"').replace(/&(?:#0*39|apos|#x27);/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&(?:amp|#0*38);/g, '&');

function readPage(p) {
  const abs = path.join(ROOT, p, 'index.html');
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
}

/** The sprite's symbols, by id, as inner markup. */
function symbols() {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'icons.svg'), 'utf8');
  const out = {};
  const re = /<symbol id="(i-[a-z0-9-]+)" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = { viewBox: m[2], inner: m[3].trim() };
  return out;
}

/* The three claims on a card. Each is true of every tool it is put on; none
   says "no third party", which the site as a whole cannot claim. */
const MEDIA = new Set(['image', 'pdf', 'ai-image', 'ai-video']);
function pillsFor(sec) {
  if (sec === 'ai') return ['Free to try', '10 calls a month', 'Says what it sends'];
  /* the Reel Maker adds an optional "Made with 1234Tools.com" credit (on by default, one click off) */
  if (sec === 'ai-video') return ['Free', 'No forced watermark', 'Runs in your browser'];
  if (MEDIA.has(sec)) return ['Free', 'No watermark', 'Runs in your browser'];
  return ['Free', 'No account', 'Runs in your browser'];
}
const noteFor = (sec) => (sec === 'ai' ? 'Free to try · Cloud AI' : 'Free · No signup · No paywall');

/** Every card to draw: { file, title, desc, glyph, pill, pills, url, note }. */
function cardList() {
  const { SECTIONS } = require('./sections.js');
  const finder = loadWindowVar('assets/finder-index.js', 'FINDER_INDEX').tools;
  const search = loadWindowVar('assets/search-index.js', 'SEARCH_INDEX');
  const byPath = new Map(finder.map((r) => [r[1], r]));
  const list = [];
  const count = {};
  search.forEach((r) => { const s = r[1].split('/')[0]; count[s] = (count[s] || 0) + 1; });

  /* tools: every register entry outside the conversions */
  search.filter((r) => !r[1].startsWith('conversions/')).forEach((r) => {
    const p = r[1];
    const sec = p.split('/')[0];
    const row = byPath.get(p);
    const html = readPage(p);
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    const glyph = (row && row[2]) || ((/<h1[^>]*>[\s\S]*?icons\.svg#(i-[a-z0-9-]+)/.exec(html) || [])[1]) || 'i-' + sec;
    const desc = (row && row[4]) || unesc((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '');
    const title = (h1 && unesc(h1[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())) || (row && row[0]) || r[0];
    const secName = (SECTIONS['/' + sec + '/'] || {}).name || sec;
    list.push({
      file: p.replace(/\/$/, '') + '.jpg', title, desc, glyph, pill: secName,
      pills: pillsFor(sec), url: 'www.1234tools.com/' + p.replace(/\/$/, ''), note: noteFor(sec)
    });
  });

  /* conversion families */
  const fams = {};
  search.filter((r) => r[1].startsWith('conversions/')).forEach((r) => {
    const f = r[1].split('/')[1];
    fams[f] = (fams[f] || 0) + 1;
  });
  Object.keys(fams).sort().forEach((f) => {
    const s = SECTIONS['/conversions/' + f + '/'];
    if (!s) return;
    list.push({
      file: 'conversions/' + f + '.jpg',
      title: s.name + ' conversions',
      desc: fams[f].toLocaleString('en-GB') + ' converters, every unit to every other, with the full table',
      glyph: 'i-' + f, pill: 'Conversions',
      pills: [fams[f].toLocaleString('en-GB') + ' converters', 'Free', 'Runs in your browser'],
      url: 'www.1234tools.com/conversions/' + f, note: noteFor('conversions')
    });
  });

  /* sections */
  Object.keys(count).sort().forEach((sec) => {
    const s = SECTIONS['/' + sec + '/'];
    if (!s) return;
    const html = readPage(sec);
    const lede = unesc(((/<p class="lede">([\s\S]*?)<\/p>/.exec(html) || [])[1] || '').replace(/<[^>]*>/g, '').trim());
    const glyph = ((new RegExp('href="/' + sec + '/"[^>]*>\\s*<svg[^>]*><use href="/assets/icons\\.svg#(i-[a-z0-9-]+)"').exec(html) || [])[1]) || 'i-' + sec;
    const n = count[sec];
    const noun = sec === 'conversions' ? 'converters' : (n === 1 ? 'tool' : 'tools');
    list.push({
      file: sec + '.jpg',
      title: sec === 'conversions' ? 'Unit conversions' : (/tools$/i.test(s.head) ? s.head : s.head + ' tools'),
      desc: lede || s.name,
      glyph, pill: s.name,
      pills: [n.toLocaleString('en-GB') + ' ' + noun].concat(pillsFor(sec).slice(0, 2)),
      url: 'www.1234tools.com/' + sec, note: noteFor(sec)
    });
  });
  return list;
}

function cardShell() {
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Sora';font-weight:400 800;font-display:block;
  src:url(data:font/woff2;base64,${font('sora-latin.woff2')}) format('woff2')}
@font-face{font-family:'Inter';font-weight:400 600;font-display:block;
  src:url(data:font/woff2;base64,${font('inter-latin.woff2')}) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;background:#06080f;overflow:hidden;
  font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
.stage{position:relative;width:100%;height:100%;padding:52px 64px 44px;
  display:flex;flex-direction:column;justify-content:space-between}
.glow-a{position:absolute;top:-340px;left:-220px;width:900px;height:900px;
  background:radial-gradient(circle,rgba(247,201,72,.17) 0%,rgba(247,201,72,0) 68%)}
.glow-b{position:absolute;bottom:-420px;right:-260px;width:900px;height:900px;
  background:radial-gradient(circle,rgba(124,92,255,.16) 0%,rgba(124,92,255,0) 68%)}
.top,.mid,.foot{position:relative;z-index:1}
.top{display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand{display:flex;align-items:center;gap:16px}
.brand svg{width:52px;height:52px;display:block}
.brand span{font-family:'Sora',sans-serif;font-weight:700;font-size:29px;color:#f4f6fb;letter-spacing:-.01em}
.sec{font-size:20px;font-weight:500;color:#d8dfef;padding:9px 18px;white-space:nowrap;
  border:1px solid rgba(247,201,72,.32);border-radius:999px;background:rgba(247,201,72,.07);
  max-width:560px;overflow:hidden;text-overflow:ellipsis}
.mid{display:flex;gap:40px;align-items:center}
.gbox{flex:none;width:160px;height:160px;border-radius:32px;display:flex;align-items:center;justify-content:center;
  background:rgba(247,201,72,.08);border:1px solid rgba(247,201,72,.32)}
.glyph{width:112px;height:112px;display:block}
.glyph *{fill:none;stroke:#f7c948;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.glyph .fill{fill:#f7c948;stroke:none}
.glyph .thin{stroke-width:1.25}
.text{min-width:0;flex:1}
h1{font-family:'Sora',sans-serif;font-weight:800;font-size:72px;line-height:1.04;letter-spacing:-.03em;
  background:linear-gradient(120deg,#ffe29a 0%,#f7c948 34%,#ff9d2e 78%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;padding-bottom:4px}
h1.clamp,p.desc{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.desc{font-size:30px;font-weight:400;line-height:1.33;color:#b7bfd2;margin-top:14px}
.pills{display:flex;gap:12px;margin-top:24px;flex-wrap:nowrap}
.pill{font-size:20px;font-weight:500;color:#d8dfef;padding:9px 18px;white-space:nowrap;
  border:1px solid rgba(247,201,72,.32);border-radius:999px;background:rgba(247,201,72,.07)}
.foot{display:flex;align-items:center;justify-content:space-between;gap:24px;
  border-top:1px solid rgba(255,255,255,.09);padding-top:20px}
.url{font-size:22px;font-weight:600;color:#f7c948;letter-spacing:.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.note{font-size:19px;color:#8790a5;white-space:nowrap}
</style>
<div class="stage">
  <div class="glow-a"></div><div class="glow-b"></div>
  <div class="top">
    <div class="brand">
      <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe29a"/><stop offset="100%" stop-color="#f7c948"/></linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f7c948"/><stop offset="100%" stop-color="#e8a020"/></linearGradient>
        <linearGradient id="g3" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#e8a020"/><stop offset="100%" stop-color="#ff9d2e"/></linearGradient>
        <linearGradient id="g4" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff9d2e"/><stop offset="100%" stop-color="#f7c948"/></linearGradient>
      </defs>
        <rect x="74" y="74" width="170" height="170" rx="38" fill="url(#g1)"/>
        <rect x="268" y="74" width="170" height="170" rx="38" fill="url(#g2)"/>
        <rect x="74" y="268" width="170" height="170" rx="38" fill="url(#g3)"/>
        <rect x="268" y="268" width="170" height="170" rx="38" fill="url(#g4)"/>
        <circle cx="438" cy="74" r="17" fill="#2dd4ff"/>
        <circle cx="74" cy="438" r="17" fill="#7c5cff"/>
      </svg>
      <span>1234Tools</span>
    </div>
    <div class="sec" id="sec"></div>
  </div>
  <div class="mid">
    <div class="gbox" id="gbox"></div>
    <div class="text">
      <h1 id="title"></h1>
      <p class="desc" id="desc"></p>
      <div class="pills" id="pills"></div>
    </div>
  </div>
  <div class="foot">
    <div class="url" id="url"></div>
    <div class="note" id="note"></div>
  </div>
</div>`;
}

/* Fill the one page with a card, then shrink the title from 72px until it
   sits on two lines, clamping at 52px. Runs inside the page. */
function paintCard(c) {
  const $ = (id) => document.getElementById(id);
  $('sec').textContent = c.pill;
  $('gbox').innerHTML = c.glyphSvg;
  $('desc').textContent = c.desc;
  $('url').textContent = c.url;
  $('note').textContent = c.note;
  const pills = $('pills');
  pills.textContent = '';
  c.pills.forEach((p) => { const d = document.createElement('div'); d.className = 'pill'; d.textContent = p; pills.appendChild(d); });
  const h = $('title');
  h.className = '';
  h.textContent = c.title;
  let size = 72;
  h.style.fontSize = size + 'px';
  const lines = () => Math.round((h.scrollHeight - 4) / (size * 1.04));
  while (lines() > 2 && size > 52) { size -= 2; h.style.fontSize = size + 'px'; }
  if (lines() > 2) h.className = 'clamp';
  return size;
}

async function cards() {
  const only = argOf('--only');
  const sym = symbols();
  const list = cardList().filter((c) => !only || c.file.indexOf(only.replace(/^\/+/, '')) === 0 || c.file === only.replace(/\/$/, '') + '.jpg');
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--font-render-hinting=none'] });
  let wrote = 0, same = 0, would = 0, bytes = 0, over = [], missing = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
    await page.setContent(cardShell(), { waitUntil: 'load' });
    await page.evaluateHandle('document.fonts.ready');
    for (const c of list) {
      const s = sym[c.glyph] || sym['i-grid'];
      if (!sym[c.glyph]) missing.push(c.file + ' (' + c.glyph + ')');
      c.glyphSvg = s ? '<svg class="glyph" viewBox="' + s.viewBox + '" xmlns="http://www.w3.org/2000/svg"><g>' + s.inner + '</g></svg>' : '';
      await page.evaluate(paintCard, c);
      await page.evaluateHandle('document.fonts.ready');
      const buf = await page.screenshot({ type: 'jpeg', quality: 80 });
      bytes += buf.length;
      if (buf.length > BUDGET) over.push(c.file + ' ' + (buf.length / 1024).toFixed(1) + ' KB');
      const out = path.join(OG_DIR, c.file);
      const prev = fs.existsSync(out) ? fs.readFileSync(out) : null;
      if (prev && prev.equals(buf)) { same++; continue; }
      if (CHECK) { would++; continue; }
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buf);
      wrote++;
    }
  } finally {
    await browser.close();
  }
  console.log('og cards  ' + list.length + ' (' + W + 'x' + H + ' JPEG q80) — ' + (bytes / 1024 / 1024).toFixed(2) + ' MB in all, ' +
    (bytes / list.length / 1024).toFixed(1) + ' KB average');
  console.log('  ' + (CHECK ? would + ' would change, ' : wrote + ' written, ') + same + ' unchanged');
  if (missing.length) console.log('  ! glyph not in the sprite, drew i-grid: ' + missing.slice(0, 8).join(', '));
  if (over.length) console.log('  ! over the ' + (BUDGET / 1024) + ' KB budget: ' + over.join(', '));
}

if (require.main === module && process.argv.includes('--cards')) {
  cards().catch((e) => { console.error(e); process.exit(1); });
} else if (require.main === module) (async () => {
  const count = toolCount();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
    await page.setContent(html(count), { waitUntil: 'load' });
    await page.evaluateHandle('document.fonts.ready');
    const buf = await page.screenshot({ type: 'png' });

    const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT) : null;
    const same = prev && prev.equals(buf);

    console.log(`og-image  ${W}x${H} @${SCALE}x — "${count.toLocaleString('en-US')} calculators"`);
    if (CHECK) {
      console.log(`  --check: ${same ? 'unchanged' : 'WOULD CHANGE'} (${(buf.length / 1024).toFixed(1)} KB)`);
    } else if (same) {
      console.log('  unchanged');
    } else {
      fs.writeFileSync(OUT, buf);
      console.log(`  wrote ${path.relative(ROOT, OUT)} — ${(buf.length / 1024).toFixed(1)} KB` +
        (prev ? ` (was ${(prev.length / 1024).toFixed(1)} KB)` : ''));
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
