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

(async () => {
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
