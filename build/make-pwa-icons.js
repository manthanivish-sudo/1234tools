/**
 * Draws the app icon for every glyph the tools use.
 *
 *   node build/make-pwa-icons.js
 *
 * An installed tool needs its own icon or a home screen full of them is
 * unusable. Rather than commission 1,194 drawings, each icon is the glyph the
 * tool already shows in its own heading, set on the brand plate — so the icon
 * on the home screen is the one the page has always used.
 *
 * Two SVGs and one PNG per glyph. The SVGs are what browsers actually use
 * (0.6 KB each, sharp at any size); the PNG exists because iOS will not take
 * an SVG for a Home Screen icon. Run after build-pwa.js reports a new glyph.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets/pwa');
const SPRITE = path.join(ROOT, 'assets/icons.svg');
const LIST = path.join(ROOT, 'build/pwa-glyphs.json');

const CHROME = process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

/** Pull one symbol's inner markup out of the sprite. */
function glyphBody(sprite, id) {
  const open = sprite.indexOf('<symbol id="' + id + '"');
  if (open < 0) return null;
  const start = sprite.indexOf('>', open) + 1;
  const end = sprite.indexOf('</symbol>', start);
  return sprite.slice(start, end).trim();
}

/**
 * The plate, matching assets/img/logo.svg, with the glyph drawn in gold.
 * `span` is how much of the 512 grid the 24-unit glyph fills: generous for the
 * normal icon, tighter for the maskable one, whose corners a launcher may crop
 * to a circle.
 */
function icon(body, span) {
  const scale = span / 24;
  const offset = (512 - span) / 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#ffe29a"/><stop offset="100%" stop-color="#f7c948"/>' +
    '</linearGradient>' +
    '<style>.fill{fill:url(#g);stroke:none}.thin{stroke-width:1.25}</style></defs>' +
    /* A flat plate rather than the logo's gradient: at 192 pixels the two are
       indistinguishable, and a gradient makes every PNG six times the size,
       which over 158 icons is megabytes for nothing. */
    '<rect width="512" height="512" rx="' + (span > 300 ? 112 : 0) + '" fill="#0b1020"/>' +
    '<g transform="translate(' + offset + ' ' + offset + ') scale(' + scale + ')" ' +
    'fill="none" stroke="url(#g)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
    body + '</g></svg>';
}

(async () => {
  const sprite = fs.readFileSync(SPRITE, 'utf8');
  const glyphs = JSON.parse(fs.readFileSync(LIST, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });

  const made = [];
  const missing = [];
  for (const id of glyphs) {
    const body = glyphBody(sprite, id);
    if (!body) { missing.push(id); continue; }
    made.push({ id, any: icon(body, 358), maskable: icon(body, 266) });
  }

  let written = 0;
  for (const g of made) {
    for (const [suffix, svg] of [['', g.any], ['-maskable', g.maskable]]) {
      const file = path.join(OUT, g.id + suffix + '.svg');
      const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (existing !== svg) { fs.writeFileSync(file, svg); written++; }
    }
  }

  /* The PNGs need a renderer; everything above is plain string work. */
  const need = made.filter((g) => !fs.existsSync(path.join(OUT, g.id + '-192.png')));
  if (need.length) {
    const puppeteer = require(path.join(ROOT, 'node_modules/puppeteer-core'));
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 192, height: 192, deviceScaleFactor: 1 });
    for (const g of need) {
      await page.setContent(
        '<style>html,body{margin:0;padding:0}img{width:192px;height:192px;display:block}</style>' +
        '<img src="data:image/svg+xml;base64,' + Buffer.from(g.any).toString('base64') + '">');
      await page.waitForSelector('img');
      await page.evaluate(() => new Promise((r) => {
        const i = document.querySelector('img');
        if (i.complete) r(); else i.onload = r;
      }));
      const el = await page.$('img');
      await el.screenshot({ path: path.join(OUT, g.id + '-192.png') });
      written++;
    }
    await browser.close();
  }

  console.log('make-pwa-icons.js');
  console.log('  glyphs      ' + glyphs.length);
  console.log('  files written ' + written);
  console.log('  png rendered  ' + need.length);
  if (missing.length) console.log('  ! not in the sprite: ' + missing.join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
