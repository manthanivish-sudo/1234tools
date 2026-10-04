'use strict';
/**
 * Launch kit for one tool, written to <PROMO_HOME>/kits/<slug>/:
 *   kit.md               every template rendered (with counts), best-fit venues with
 *                        their rules notes, and the UTM link for each venue
 *   square-1080.png      1080x1080   Instagram / LinkedIn / X card
 *   pin-1000x1500.png    1000x1500   Pinterest
 *   story-1080x1920.png  1080x1920   Instagram story, with a QR of the instagram-story UTM link
 *   wide-1200x630.png    1200x630    link-preview size
 *
 *   await kit('/pdf/merge-pdf/')  -> { dir, files, qr }
 *
 * Images are drawn from one HTML template in the site's brand (fonts inlined as
 * base64 like build/make-og.js) and screenshotted with puppeteer-core. Nothing
 * is uploaded anywhere: the owner attaches them to posts by hand.
 */
const fs = require('fs');
const path = require('path');
const T = require('./tools');
const TPL = require('./templates');
const V = require('./venues');
const L = require('./log');

const CHROME = process.env.PROMO_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = T.ROOT;

const SIZES = [
  { file: 'square-1080.png', w: 1080, h: 1080, layout: 'square', use: 'Instagram feed, LinkedIn, X image post' },
  { file: 'pin-1000x1500.png', w: 1000, h: 1500, layout: 'pin', use: 'Pinterest pin (2:3)' },
  { file: 'story-1080x1920.png', w: 1080, h: 1920, layout: 'story', use: 'Instagram / Facebook story, with a QR to the tool' },
  { file: 'wide-1200x630.png', w: 1200, h: 630, layout: 'wide', use: 'Link preview size: LinkedIn, Facebook, Mastodon, newsletters' },
];

let fontCache = null;
function fonts() {
  if (!fontCache) {
    const f = (n) => fs.readFileSync(path.join(ROOT, 'assets', 'fonts', n)).toString('base64');
    fontCache = { sora: f('sora-latin.woff2'), inter: f('inter-latin.woff2') };
  }
  return fontCache;
}

let iconSrc = null;
function glyphSvg(id, fallback) {
  if (!iconSrc) iconSrc = fs.readFileSync(path.join(ROOT, 'assets', 'icons.svg'), 'utf8');
  const find = (g) => {
    const re = new RegExp('<symbol id="' + g.replace(/[^a-z0-9-]/gi, '') + '"([^>]*)>([\\s\\S]*?)</symbol>');
    return iconSrc.match(re);
  };
  const m = find(id) || (fallback && find(fallback)) || find('i-grid');
  if (!m) return '';
  const vb = (m[1].match(/viewBox="([^"]+)"/) || [, '0 0 24 24'])[1];
  return '<svg class="glyph" viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg">' + m[2] + '</svg>';
}

/* The four-square mark, as in build/make-og.js. */
const LOGO = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><defs>
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
</svg>`;

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/** Proof pills: what is true for this pricing tier. */
function pills(rec) {
  return rec.pricing === 'freemium' ? ['10 free a month', 'Says what it sends', 'No card'] : ['Free', 'No upload', 'No sign-up'];
}

/* Title size by layout and length, so 60-character titles still fit on three lines. */
function titleSize(layout, title) {
  const n = [...title].length;
  const base = { square: 104, pin: 100, story: 116, wide: 76 }[layout];
  const fit = { square: 22, pin: 20, story: 20, wide: 28 }[layout];
  return Math.round(base * Math.min(1, Math.max(0.5, (fit * 2.1) / Math.max(n, fit * 2.1) + (n < fit ? 0.05 : 0))));
}

function html(rec, size) {
  const f = fonts();
  const L = size.layout;
  const ts = titleSize(L, rec.title);
  const p = pills(rec);
  const host = 'www.1234tools.com' + rec.path;
  const qrBlock = L === 'story'
    ? '<div class="qrcard"><div id="qr"></div><div class="qrcap">Scan to open the tool</div></div>'
    : '';
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Sora';font-weight:400 800;font-display:block;src:url(data:font/woff2;base64,${f.sora}) format('woff2')}
@font-face{font-family:'Inter';font-weight:400 600;font-display:block;src:url(data:font/woff2;base64,${f.inter}) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${size.w}px;height:${size.h}px;background:#06080f;overflow:hidden;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;color:#f4f6fb}
.stage{position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:${{ square: '72px', pin: '80px 72px', story: '120px 84px 110px', wide: '52px 64px' }[L]}}
.glow-a{position:absolute;top:-30%;left:-25%;width:90%;height:${L === 'wide' ? '150%' : '80%'};background:radial-gradient(closest-side,rgba(247,201,72,.17) 0%,rgba(247,201,72,0) 100%)}
.glow-b{position:absolute;bottom:-30%;right:-25%;width:90%;height:${L === 'wide' ? '150%' : '80%'};background:radial-gradient(closest-side,rgba(124,92,255,.16) 0%,rgba(124,92,255,0) 100%)}
.glow-c{position:absolute;top:40%;right:-20%;width:50%;height:40%;background:radial-gradient(closest-side,rgba(45,212,255,.07) 0%,rgba(45,212,255,0) 100%)}
.brand,.mid,.foot{position:relative;z-index:1}
.brand{display:flex;align-items:center;gap:18px}
.brand svg{width:${L === 'wide' ? 46 : 56}px;height:${L === 'wide' ? 46 : 56}px;display:block}
.brand span{font-family:'Sora',sans-serif;font-weight:700;font-size:${L === 'wide' ? 26 : 32}px;letter-spacing:-.01em}
.brand em{margin-left:auto;font-style:normal;font-size:${L === 'wide' ? 18 : 22}px;color:#8790a5;font-weight:500}
.mid{display:flex;flex-direction:column;gap:${L === 'wide' ? 14 : 26}px}
.icon{width:${{ square: 132, pin: 150, story: 170, wide: 92 }[L]}px;height:${{ square: 132, pin: 150, story: 170, wide: 92 }[L]}px;border-radius:28%;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(145deg,rgba(247,201,72,.16),rgba(247,201,72,.04));border:1px solid rgba(247,201,72,.35)}
.glyph{width:58%;height:58%;fill:none;stroke:#f7c948;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.glyph .fill{fill:#f7c948;stroke:none}.glyph .thin{stroke-width:1.25}
h1{font-family:'Sora',sans-serif;font-weight:800;font-size:${ts}px;line-height:1.02;letter-spacing:-.03em;
  background:linear-gradient(120deg,#ffe29a 0%,#f7c948 34%,#ff9d2e 78%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;padding-bottom:.06em}
h2{font-family:'Sora',sans-serif;font-weight:600;font-size:${{ square: 44, pin: 46, story: 54, wide: 34 }[L]}px;line-height:1.2;letter-spacing:-.015em;color:#f4f6fb}
h2 .arrow{color:#2dd4ff}
.pills{display:flex;flex-wrap:wrap;gap:12px;margin-top:${L === 'wide' ? 4 : 10}px}
.pill{font-size:${{ square: 25, pin: 26, story: 30, wide: 20 }[L]}px;font-weight:600;color:#e8ecf6;padding:${L === 'wide' ? '9px 18px' : '12px 24px'};
  border:1px solid rgba(247,201,72,.4);border-radius:999px;background:rgba(247,201,72,.08)}
.pill:nth-child(2){border-color:rgba(45,212,255,.45);background:rgba(45,212,255,.08)}
.pill:nth-child(3){border-color:rgba(124,92,255,.5);background:rgba(124,92,255,.10)}
.qrcard{align-self:center;display:flex;flex-direction:column;align-items:center;gap:18px;padding:30px 30px 22px;background:#fff;border-radius:36px;margin-top:20px}
#qr svg{width:360px;height:360px;display:block}
.qrcap{font-family:'Sora',sans-serif;font-weight:700;font-size:30px;color:#06080f}
.foot{display:flex;align-items:center;justify-content:space-between;gap:20px;border-top:1px solid rgba(255,255,255,.09);padding-top:${L === 'wide' ? 16 : 24}px}
.url{font-size:${{ square: 26, pin: 26, story: 32, wide: 21 }[L]}px;font-weight:600;color:#f7c948;letter-spacing:.005em;word-break:break-all}
.sec{font-size:${L === 'wide' ? 18 : 22}px;color:#8790a5;white-space:nowrap}
</style>
<div class="stage">
  <div class="glow-a"></div><div class="glow-b"></div><div class="glow-c"></div>
  <div class="brand">${LOGO}<span>1234Tools</span><em>${esc(rec.sectionName)}</em></div>
  <div class="mid">
    <div class="icon">${glyphSvg(rec.glyph, 'i-' + rec.section)}</div>
    <h1>${esc(rec.title)}</h1>
    <h2>${esc(rec.io).replace(/→/g, '<span class="arrow">→</span>')}</h2>
    <div class="pills">${p.map((x) => '<div class="pill">' + esc(x) + '</div>').join('')}</div>
    ${qrBlock}
  </div>
  <div class="foot"><div class="url">${esc(host)}</div>${L === 'story' ? '' : '<div class="sec">' + (rec.pricing === 'freemium' ? 'AI · account needed' : 'Runs in your browser') + '</div>'}</div>
</div>`;
}

function kitSlug(rec) {
  const dup = T.listTools().filter((r) => r.slug === rec.slug).length > 1;
  return dup ? rec.section + '-' + rec.slug : rec.slug;
}
function kitsDir() { return path.join(L.home(), 'kits'); }

/** The venue used for a template's UTM in the kit: the best-fit venue that uses it. */
function venueForTemplate(fitList, id) {
  for (const f of fitList) if (f.templates.includes(id)) return V.get(f.id);
  return null;
}

function mdEsc(s) { return String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }

function buildMarkdown(rec, fitList, images, qrInfo) {
  const lines = [];
  const push = (s) => lines.push(s == null ? '' : s);
  push('# Launch kit: ' + rec.title);
  push('');
  push('Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' by the 1234Tools Promotion Desk. Nothing here has been posted: a human reads, edits and publishes every piece.');
  push('');
  push('- Tool: ' + rec.cleanUrl);
  push('- Section: ' + rec.sectionName + ' (`' + rec.section + '`) · Verb: ' + rec.verb + ' · ' + rec.io);
  push('- Pricing: ' + (rec.pricing === 'freemium' ? 'freemium: account needed, 10 AI runs a month free, sends text to a model. Never call it free without the allowance, never "offline" or "on your device".' : 'free: runs in the browser, nothing you type is uploaded, no account.'));
  push('- Audiences: ' + (rec.audiences.join(', ') || '(none)') + ' · venue tags: ' + rec.audienceTags.join(', '));
  if (rec.relatedGuides.length) push('- Guides that link here: ' + rec.relatedGuides.map((g) => T.ORIGIN + g).join(', '));
  if (rec.relatedCompare.length) push('- Comparisons that link here: ' + rec.relatedCompare.map((g) => T.ORIGIN + g).join(', '));
  push('');
  push('## Images');
  push('');
  for (const im of images) push('- `' + im.file + '` ' + im.w + '×' + im.h + ': ' + im.use);
  if (qrInfo) push('- Story QR encodes ' + qrInfo.text + ' (version ' + qrInfo.version + ', level M, read back ' + (qrInfo.verified ? 'OK' : 'NOT verified') + ').');
  push('- Alt text for any of them: "' + TPL.render('pinterest-pin', rec, { variant: 1 }).parts.find((p) => p.key === 'alt').text + '"');
  push('');
  push('## Best-fit venues');
  push('');
  push('| # | Venue | Kind | Risk | Self-promo | Links | Cadence | Today | Rules |');
  push('|---|---|---|---|---|---|---|---|---|');
  fitList.slice(0, 12).forEach((f, i) => {
    push('| ' + (i + 1) + ' | ' + mdEsc(f.name) + ' (`' + f.id + '`) | ' + f.kind + ' | ' + f.risk + ' | ' + f.selfPromo + ' | ' + f.linkPolicy + ' | every ' + f.cadenceDays + ' d, ' + f.maxPerWeek + '/wk | ' + (f.status.ok ? 'ok' : 'wait: ' + mdEsc(f.status.reasons[0])) + ' | ' + (f.rulesUrl || '') + ' |');
  });
  push('');
  for (const f of fitList.slice(0, 12)) {
    push('### ' + f.name);
    push('');
    if (f.promoThread) push('- Promo thread: ' + f.promoThread);
    push('- Templates: ' + f.templates.join(', '));
    if (f.notes) push('- Notes: ' + f.notes);
    if (f.verifiedHow) push('- Verified: ' + f.verifiedHow);
    push('- UTM link: ' + T.utmUrl(rec.path, f.id, TPL.KIND_MEDIUM[f.kind] || 'social'));
    push('');
  }
  push('## UTM links for every post venue');
  push('');
  push('| Venue | Link |');
  push('|---|---|');
  for (const f of fitList) push('| `' + f.id + '` | ' + T.utmUrl(rec.path, f.id, TPL.KIND_MEDIUM[f.kind] || 'social') + ' |');
  push('| `instagram-story` (QR) | ' + T.utmUrl(rec.path, 'instagram-story', 'social') + ' |');
  push('');
  push('## Copy');
  push('');
  push('Variant 0 of every template. Counts are against each part\'s hard limit. Re-read every line before posting; fill anything in [brackets].');
  push('');
  for (const id of TPL.TEMPLATE_IDS) {
    const venue = venueForTemplate(fitList, id);
    const r = TPL.render(id, rec, { variant: 0, venue });
    push('### ' + r.label + ' (`' + id + '`)' + (venue ? ' — for ' + venue.name : ''));
    push('');
    for (const p of r.parts) {
      push('**' + p.label + '** — ' + p.chars + (p.limit ? ' / ' + p.limit : '') + (p.countMode && p.countMode !== 'chars' ? ' ' + p.countMode : ' chars'));
      push('');
      push('```text');
      push(p.text);
      push('```');
      push('');
    }
    const notes = r.errors.map((e) => 'ERROR ' + e.rule + ': ' + e.msg).concat(r.warnings.map((w) => 'note ' + w.rule + ': ' + w.msg));
    if (notes.length) { for (const n of notes) push('- ' + n); push(''); }
  }
  return lines.join('\n');
}

/** PNG width/height from the IHDR chunk. */
function pngSize(buf) {
  if (!buf || buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function kit(toolPath, opts) {
  opts = opts || {};
  const rec = T.record(toolPath);
  const dir = path.join(kitsDir(), kitSlug(rec));
  fs.mkdirSync(dir, { recursive: true });
  const fitList = V.fit(rec.path);
  const qrText = T.utmUrl(rec.path, 'instagram-story', 'social');
  const qrSrc = fs.readFileSync(path.join(ROOT, 'engine', 'qr.bundle.js'), 'utf8');
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--font-render-hinting=none'] });
  const files = [];
  let qrInfo = null;
  try {
    const page = await browser.newPage();
    for (const size of SIZES) {
      await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1 });
      await page.setContent(html(rec, size), { waitUntil: 'load' });
      if (size.layout === 'story') {
        await page.addScriptTag({ content: qrSrc });
        qrInfo = await page.evaluate((text) => {
          const qr = window.QR.encode(text, 'M');
          document.getElementById('qr').innerHTML = window.QR.toSVG(qr, { scale: 10, quiet: 2, dark: '#06080f', light: '#ffffff' });
          let verified = false;
          try { const v = window.QR.verify(qr); verified = !!(v && (v.ok || v.matches)); } catch (e) { verified = false; }
          return { text, version: qr.version, verified };
        }, qrText);
      }
      await page.evaluateHandle('document.fonts.ready');
      const buf = await page.screenshot({ type: 'png' });
      const out = path.join(dir, size.file);
      fs.writeFileSync(out, buf);
      files.push(Object.assign({ path: out, bytes: buf.length }, size, { actual: pngSize(buf) }));
    }
  } finally {
    await browser.close();
  }
  const md = buildMarkdown(rec, fitList, SIZES, qrInfo);
  fs.writeFileSync(path.join(dir, 'kit.md'), md);
  files.unshift({ path: path.join(dir, 'kit.md'), file: 'kit.md', bytes: Buffer.byteLength(md) });
  return { tool: rec.path, slug: kitSlug(rec), dir, files, qr: qrInfo };
}

/** Kits already on disk. */
function list() {
  const d = kitsDir();
  let names = [];
  try { names = fs.readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name); } catch (e) { return []; }
  return names.map((n) => {
    const dir = path.join(d, n);
    let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { files = []; }
    let at = null;
    try { at = fs.statSync(path.join(dir, 'kit.md')).mtime.toISOString(); } catch (e) { at = null; }
    let title = n;
    try { title = (fs.readFileSync(path.join(dir, 'kit.md'), 'utf8').match(/^# Launch kit: (.+)$/m) || [, n])[1]; } catch (e) { /* keep slug */ }
    return { slug: n, title, dir, files, at };
  }).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

module.exports = { kit, list, html, pngSize, kitSlug, kitsDir, SIZES, pills, glyphSvg };
