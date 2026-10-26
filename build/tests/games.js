/**
 * The quiz and party games under /games/, in a real browser.
 *
 *   node build/tests/games.js [--root <site>] [--port 8960] [--only <slug>]
 *
 * Every game build-games.js knows about is opened on a desktop and a 390 px
 * phone: it must mount, raise no page error, never scroll sideways, and its
 * big-screen view (?stage=1) must follow the host page over the
 * BroadcastChannel. The shared kit's randomness is checked against what fair
 * means (chi-square against a uniform distribution, not against the kit's own
 * output), its seeded generator against a second implementation written here,
 * and each game's own rules by build/tests/games/<slug>.js — a game or a
 * landing page added without its checks fails, so every game arrives with
 * its tests.
 *
 * Landing pages must open with their preset applied, and every game page,
 * landing page and the hub must be in sitemap-1.xml.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ROOT = path.resolve(opt('--root', path.join(__dirname, '..', '..')));
const PORT = Number(opt('--port', 8960));
const ONLY = opt('--only', null);
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; return true; }
  fail++; failures.push(name + (detail ? ' — ' + detail : ''));
  return false;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found');
}

/* chi-square critical values at p = 0.001 for df 1..40 (upper tail): a fair
   source fails one run in a thousand, so a failure here means bias */
const CHI_001 = [0, 10.83, 13.82, 16.27, 18.47, 20.52, 22.46, 24.32, 26.12, 27.88, 29.59, 31.26, 32.91, 34.53, 36.12, 37.70, 39.25, 40.79, 42.31, 43.82, 45.31,
  46.80, 48.27, 49.73, 51.18, 52.62, 54.05, 55.48, 56.89, 58.30, 59.70, 61.10, 62.49, 63.87, 65.25, 66.62, 67.99, 69.35, 70.70, 72.05, 73.40];
function chiSquare(counts) {
  const total = counts.reduce((a, b) => a + b, 0), e = total / counts.length;
  return counts.reduce((s, c) => s + (c - e) * (c - e) / e, 0);
}

/* An independent cyrb128 + sfc32, from the published reference, to hold the
   kit's seeded generator to: the same seed must give the same numbers. */
function refSeeded(seed) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  const str = String(seed);
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
  let a = h1 >>> 0, b = h2 >>> 0, c = h3 >>> 0, d = h4 >>> 0;
  const u32 = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; return t >>> 0;
  };
  for (let i = 0; i < 12; i++) u32();
  return u32;
}

/* ------------------------------------------------------------------ */
/* each game's own rules: GAME_CHECKS[slug](page, h) — h has ok, sleep, */
/* chiSquare, CHI_001, BASE. Every game must have an entry.             */
/* ------------------------------------------------------------------ */

/* every game brings its own file: build/tests/games/<slug>.js exports
   { check(page, h), landings: { '<landing-slug>': async (page, h) => {} } } */
const GAME_CHECKS = {}, LANDING_CHECKS = {};
for (const f of fs.readdirSync(path.join(__dirname, 'games')).filter((n) => /^[a-z0-9-]+\.js$/.test(n))) {
  const m = require(path.join(__dirname, 'games', f));
  GAME_CHECKS[f.replace(/\.js$/, '')] = m.check;
  Object.assign(LANDING_CHECKS, m.landings || {});
}


/* ------------------------------------------------------------------ */

async function main() {
  const games = require(path.join(ROOT, 'build-games.js'));
  const list = games.tools().filter((t) => !ONLY || t.slug === ONLY);
  const lands = [];
  for (const t of list) for (const L of t.spec.landings || []) lands.push({ t, L });
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap-1.xml'), 'utf8');
  const inMap = (p) => sitemap.indexOf('<loc>https://www.1234tools.com' + p + '</loc>') >= 0;
  ok(inMap('/games/'), 'sitemap: the hub');
  for (const t of list) ok(inMap('/games/' + t.slug + '/'), 'sitemap: ' + t.slug);
  for (const x of lands) ok(inMap('/games/' + x.L.slug + '/'), 'sitemap: landing ' + x.L.slug);
  for (const t of list) {
    ok(fs.existsSync(path.join(ROOT, 'games', t.slug, 'index.html')), 'page exists: ' + t.slug);
    ok(fs.existsSync(path.join(ROOT, 'pwa', 'games', t.slug + '.webmanifest')), 'PWA manifest: ' + t.slug);
    ok(fs.existsSync(path.join(ROOT, 'assets', 'pwa', t.spec.glyph + '-192.png')), 'PWA icon drawn: ' + t.spec.glyph);
  }

  const puppeteer = loadPuppeteer();
  const { serve } = require('./serve.js');
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  async function open(url, width) {
    const page = await browser.newPage();
    await page.setViewport({ width: width || 1280, height: width && width < 600 ? 844 : 800, deviceScaleFactor: 1, isMobile: !!(width && width < 600), hasTouch: !!(width && width < 600) });
    page.on('pageerror', (e) => errors.push(url + ': ' + e.message));
    await page.goto(BASE + url, { waitUntil: 'load' });
    await page.evaluate(() => { const b = document.querySelector('.cc .cc-no, .cc button'); if (b) b.click(); });
    return page;
  }
  const h = {
    ok, sleep, chiSquare, CHI_001, BASE, open,
    openStage: async (slug) => open('/games/' + slug + '/?stage=1')
  };

  try {
    /* the kit: fairness and the seeded generator */
    const kitPage = await open('/games/' + (list[0] ? list[0].slug : 'team-generator') + '/');
    const kit = await kitPage.evaluate(() => {
      const K = window.GameKit;
      const c7 = new Array(7).fill(0);
      for (let i = 0; i < 70000; i++) c7[K.randInt(7)]++;
      const g = K.seeded('DIWALI26'), g2 = K.seeded('DIWALI26');
      const a = [], b = [];
      for (let i = 0; i < 8; i++) { a.push(g.u32()); b.push(g2.u32()); }
      const seedOk = /^[A-HJKMNP-Z2-9]{6}$/.test(K.newSeed());
      const c40 = new Array(40).fill(0);
      const s = K.seeded('x');
      for (let i = 0; i < 80000; i++) c40[s.int(40)]++;
      return { c7, a, b, seedOk, c40 };
    });
    const chi7 = chiSquare(kit.c7);
    ok(chi7 < CHI_001[6], 'kit: randInt(7) is uniform (chi² ' + chi7.toFixed(1) + ')');
    const chi40 = chiSquare(kit.c40);
    ok(chi40 < CHI_001[39], 'kit: seeded int(40) is uniform (chi² ' + chi40.toFixed(1) + ')');
    ok(kit.a.join() === kit.b.join(), 'kit: the same seed gives the same sequence');
    const ref = refSeeded('DIWALI26');
    const want = Array.from({ length: 8 }, () => ref());
    ok(kit.a.join() === want.join(), 'kit: seeded output matches the reference sfc32', kit.a.slice(0, 2).join() + ' vs ' + want.slice(0, 2).join());
    ok(kit.seedOk, 'kit: a new seed has no confusable characters');
    await kitPage.close();

    for (const t of list) {
      for (const width of [1280, 390]) {
        const page = await open('/games/' + t.slug + '/', width);
        const mounted = await page.evaluate((slug) => {
          const io = document.querySelector('[data-tool="' + slug + '"] .tool-io');
          return !!io && io.querySelectorAll('button').length > 0;
        }, t.slug);
        ok(mounted, t.slug + ' @' + width + ': mounts');
        const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
        ok(sideways <= 1, t.slug + ' @' + width + ': no sideways scroll', sideways + ' px');
        const small = await page.evaluate((slug) => Array.from(document.querySelectorAll('[data-tool="' + slug + '"] .tool-io button, [data-tool="' + slug + '"] .tool-io input, [data-tool="' + slug + '"] .tool-io select'))
          .filter((b) => b.offsetParent !== null && b.type !== 'checkbox' && b.type !== 'radio' && b.type !== 'range' && b.type !== 'color')
          .filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => b.textContent || b.name || b.type).slice(0, 5), t.slug);
        ok(small.length === 0, t.slug + ' @' + width + ': every control at least 44 px tall', small.join(' | '));
        if (width === 1280) {
          if (!GAME_CHECKS[t.slug]) ok(false, t.slug + ': has its checks in GAME_CHECKS');
          else await GAME_CHECKS[t.slug](page, h);
          const stage = await open('/games/' + t.slug + '/?stage=1');
          const st = await stage.evaluate(() => ({ stage: !!document.querySelector('.game-stage'), hidden: getComputedStyle(document.querySelector('header') || document.body).display }));
          ok(st.stage, t.slug + ': ?stage=1 shows the big screen');
          await stage.close();
        }
        await page.close();
      }
    }
    for (const x of lands) {
      const page = await open('/games/' + x.L.slug + '/');
      const r = await page.evaluate((slug) => {
        const root = document.querySelector('[data-tool="' + slug + '"]');
        return { mounted: !!root && root.querySelectorAll('.tool-io button').length > 0, preset: root && root.getAttribute('data-preset') };
      }, x.t.slug);
      ok(r.mounted, 'landing ' + x.L.slug + ': the game mounts');
      ok(r.preset === JSON.stringify(x.L.preset || {}), 'landing ' + x.L.slug + ': carries its preset');
      if (LANDING_CHECKS[x.L.slug]) await LANDING_CHECKS[x.L.slug](page, h);
      else ok(false, 'landing ' + x.L.slug + ': has its check in its game’s test file');
      await page.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  for (const e of errors) ok(false, 'page error', e);
  console.log('\ngames.js  ' + pass + ' passed, ' + fail + ' failed');
  failures.forEach((f) => console.log('  FAIL ' + f));
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
