/**
 * Accessibility sweep with axe-core, in headless Chrome.
 *
 *   node build/tests/a11y.js --axe <axe.min.js> [--root <site>] [--port 9110]
 *        [--sample N | --all | --pages /a/,/b/] [--themes dark,light] [--width 1400]
 *        [--impact serious] [--json <file>]
 *
 * axe-core is MPL-2.0, so it is never vendored into the site: fetch it into a
 * scratch folder (npm pack axe-core@4.10.3, untar, pass package/axe.min.js) and
 * point --axe at it. It is injected into each page from here, after load.
 *
 * --sample N (default 3): every section hub, the home page and the first N
 * tool pages of each section, in each theme. --all: every tool page.
 * Fails (exit 2) on any violation at --impact or above (serious, critical).
 * Rules: WCAG 2.0/2.1 A and AA.
 */
'use strict';
const path = require('path');
const fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const PORT = Number(arg('--port', 9110));
const AXE = arg('--axe', '');
const THEMES = arg('--themes', 'dark,light').split(',');
const WIDTH = Number(arg('--width', 1400));
const LEVELS = ['minor', 'moderate', 'serious', 'critical'];
const MIN = LEVELS.indexOf(arg('--impact', 'serious'));
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!AXE || !fs.existsSync(AXE)) { console.error('a11y: --axe <path to axe.min.js> is required (npm pack axe-core into a scratch folder)'); process.exit(1); }

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found');
}
const puppeteer = loadPuppeteer();
const { serve } = require('./serve.js');

/* Tool pages: section/slug/index.html carrying a tool mount. */
function pages() {
  if (arg('--pages', '')) return arg('--pages', '').split(',');
  const n = has('--all') ? Infinity : Number(arg('--sample', 3));
  const out = ['/'];
  const secs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'index.html')) && !/^(node_modules|build|engine|assets|pwa|hi)$/.test(d.name));
  for (const s of secs) {
    const tools = fs.readdirSync(path.join(ROOT, s.name), { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, s.name, d.name, 'index.html')))
      .map((d) => d.name).sort()
      .filter((d) => /class="tool[ "]/.test(fs.readFileSync(path.join(ROOT, s.name, d, 'index.html'), 'utf8').slice(0, 200000)));
    if (!tools.length) continue;
    out.push('/' + s.name + '/');
    tools.slice(0, n).forEach((t) => out.push('/' + s.name + '/' + t + '/'));
  }
  return out;
}

(async () => {
  const axe = fs.readFileSync(AXE, 'utf8');
  const list = pages();
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=' + WIDTH + ',1000'] });
  const byRule = {}, failing = [];
  let checked = 0;
  try {
    for (const theme of THEMES) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: WIDTH, height: 1000 });
      await page.evaluateOnNewDocument((t) => {
        try { localStorage.setItem('1234tools-theme', t); localStorage.setItem('1234tools-consent', 'denied'); } catch (e) {}
      }, theme);
      await page.setRequestInterception(true);
      page.on('request', (r) => (/^http:\/\/127\.0\.0\.1/.test(r.url()) || /^(blob|data):/.test(r.url()) ? r.continue() : r.abort()));
      for (const p of list) {
        try {
          await page.goto(BASE + p, { waitUntil: 'load', timeout: 45000 });
          await new Promise((r) => setTimeout(r, 1200));
          await page.evaluate(axe);
          const res = await page.evaluate(() => window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
            resultTypes: ['violations']
          }).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))));
          checked++;
          const bad = res.filter((v) => LEVELS.indexOf(v.impact) >= MIN);
          for (const v of bad) {
            const k = v.id + ' (' + v.impact + ')';
            (byRule[k] = byRule[k] || { help: v.help, pages: [] }).pages.push(theme + ' ' + p + ' x' + v.nodes + ' ' + v.sample.join(' | '));
          }
          if (bad.length) failing.push(theme + ' ' + p);
        } catch (e) {
          failing.push(theme + ' ' + p + ' (did not run: ' + e.message.slice(0, 80) + ')');
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  for (const [k, v] of Object.entries(byRule)) {
    console.log('\n' + k + ' — ' + v.help + ' — ' + v.pages.length + ' page(s)');
    v.pages.slice(0, 6).forEach((x) => console.log('    ' + x.slice(0, 260)));
  }
  if (arg('--json', '')) fs.writeFileSync(arg('--json', ''), JSON.stringify({ checked, failing, byRule }, null, 2));
  console.log('\n' + checked + ' page loads checked (' + list.length + ' pages x ' + THEMES.length + ' themes), ' + failing.length + ' with ' + LEVELS[MIN] + '+ violations.');
  process.exit(failing.length ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
