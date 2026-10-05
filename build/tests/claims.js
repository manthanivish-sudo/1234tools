#!/usr/bin/env node
/**
 * Claims against behaviour: what each tool page promises, checked against
 * what the tool really does. The file and text tools (/pdf/, /image/,
 * /developer/, /text/, /qr/), the calculators (/india/, /business/,
 * /finance/, /health/, /time/, /education/, /mathematics/, /utilities/,
 * /engineering/, /design/) and the unit conversion pages (/conversions/).
 *
 *   node build/tests/claims.js [--root <site>] [--out <dir>] [--port 8860]
 *                              [--only pdf,image,india,conversions,…] [--no-browser]
 *                              [--grep <regex on page, name or quote>] [--json <file>]
 *
 * --root is the site to test (default: the one this file sits in); it is
 * served on --port by build/tests/serve.js for the browser checks. ALWAYS
 * pass a port of your own: serve.js reuses whatever already listens there.
 * Exit code 2 when a claim fails, 1 when the run itself breaks.
 *
 * Every check is one sentence the page says, quoted: where it is (tip, FAQ,
 * "How it works" point, mistake, card line from build/jobs.js …), the quote,
 * and a run of the real tool that either bears it out or does not. Two
 * things fail a check:
 *
 *   - the quote is no longer on the page (the copy changed: re-read the new
 *     words and update the check, so a new promise is never left unchecked);
 *   - the tool does not do what the quote says.
 *
 * Engines run in Node where they can (the PDF specs on the shipped
 * pdfcore.bundle.js, the developer and text specs in a vm with a stub
 * window, the QR encoder and reader); everything that needs a canvas, a
 * file input or the page's own UI runs in headless Chrome against the
 * served site. Claims nothing can check automatically (legal statements,
 * advice, browser support) are listed under "manual" with the reason.
 *
 * The checks live in build/tests/claims/*.js, one file per section; the
 * shared fixtures and readers in build/tests/claims/kit.js.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-claims')));
const PORT = Number(arg('--port', 8860));
const ONLY = arg('--only', '') ? arg('--only', '').split(',') : null;
const GREP = arg('--grep', '') ? new RegExp(arg('--grep', ''), 'i') : null;
const BROWSER = !argv.includes('--no-browser');
const JSON_OUT = arg('--json', path.join(OUT, 'claims-report.json'));
fs.mkdirSync(OUT, { recursive: true });

const kit = require('./claims/kit.js');
kit.init({ ROOT, OUT, PORT });

/* ---------- the register ---------- */

const claims = [];
const manuals = [];
const SECTIONS = ['pdf', 'image', 'developer', 'text', 'qr',
  'india', 'business', 'finance', 'health', 'time', 'education', 'mathematics', 'utilities', 'engineering', 'design', 'conversions'];
const sectionOf = (page) => page.split('/')[1];

/**
 * claim(page, where, quote, name, env, fn)
 *   page   the tool's path, '/pdf/merge-pdf/'
 *   where  tip | faq | lede | works | point | mistake | dfaq | what | card | why | ui
 *          | example | formula | worked | use | table | hub
 *   quote  words that must be on the page, as a reader sees them
 *   name   what the check proves, in a few words
 *   env    'node' or 'browser'
 *   fn     async (t) => [ok, observed]
 */
function claim(page, where, quote, name, env, fn) {
  claims.push({ page, where, quote, name, env, fn });
}
function manual(page, where, quote, why) {
  manuals.push({ page, where, quote, why });
}

const api = { claim, manual, kit };
/* the file and text tools, then the calculators and conversions; a file not
   written yet is skipped, so sections can be added one at a time */
for (const f of ['pdf.js', 'image.js', 'developer.js', 'text.js', 'qr.js',
  'examples.js', 'calc-privacy.js', 'calc-india.js', 'calc-business.js', 'calc-everyday.js', 'calc-maths.js', 'conversions.js']) {
  if (fs.existsSync(path.join(__dirname, 'claims', f))) require('./claims/' + f)(api);
}

/* ---------- the page's words ---------- */

const norm = (s) => String(s)
  .replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"')
  .replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
const ent = (s) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
const textCache = new Map();
function pageText(page) {
  if (textCache.has(page)) return textCache.get(page);
  const f = path.join(ROOT, page.replace(/^\/+/, ''), 'index.html');
  let t = '';
  if (fs.existsSync(f)) {
    const h = fs.readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
    t = norm(ent(h.replace(/<[^>]+>/g, ' ')));
    /* control labels and option text count as words on the page too */
  }
  textCache.set(page, t);
  return t;
}
let jobs = null;
function cardText(page) {
  if (!jobs) jobs = require(path.join(ROOT, 'build', 'jobs.js'));
  return norm(jobs.descOf(page) || '');
}
const quoteFound = (c) => {
  const q = norm(c.quote).replace(/\s+/g, ' ');
  if (c.where === 'card') return cardText(c.page).indexOf(q) >= 0;
  /* the page text has a space wherever a tag was: compare without them too */
  const t = pageText(c.page);
  return t.indexOf(q) >= 0 || t.replace(/ /g, '').indexOf(q.replace(/ /g, '')) >= 0;
};

/* ---------- running ---------- */

const results = [];
async function runOne(c) {
  const found = quoteFound(c);
  let ok = false, saw = '';
  const t0 = Date.now();
  try {
    const r = await c.fn(kit);
    ok = !!r[0];
    saw = r[1] === undefined ? '' : String(r[1]);
  } catch (e) {
    ok = false;
    saw = 'the check broke: ' + (e && e.message || e);
  }
  const status = !found ? 'FAIL' : ok ? 'PASS' : 'FAIL';
  const why = !found ? 'the quoted words are no longer on the page' + (ok ? ' (behaviour still as quoted)' : '; and ' + saw) : (ok ? '' : saw);
  const row = { section: sectionOf(c.page), page: c.page, where: c.where, quote: c.quote, name: c.name, env: c.env, found, ok, status, observed: saw, why, ms: Date.now() - t0 };
  results.push(row);
  console.log((status === 'PASS' ? 'PASS' : 'FAIL') + '  ' + c.page + '  [' + c.where + '] ' + c.name +
    (status === 'PASS' ? '' : '\n        claim:    "' + c.quote + '"\n        observed: ' + why.slice(0, 600)));
}

(async () => {
  const chosen = claims.filter((c) => (!ONLY || ONLY.indexOf(sectionOf(c.page)) >= 0) && (!GREP || GREP.test(c.page + ' ' + c.name + ' ' + c.quote)));
  const nodeClaims = chosen.filter((c) => c.env === 'node');
  const browserClaims = chosen.filter((c) => c.env === 'browser');
  console.log('claims: ' + ROOT + '   ' + chosen.length + ' checks (' + nodeClaims.length + ' in Node, ' + browserClaims.length + ' in Chrome), ' +
    manuals.filter((m) => !ONLY || ONLY.indexOf(sectionOf(m.page)) >= 0).length + ' manual');
  const t0 = Date.now();
  try {
    console.log('\n=== Node');
    for (const c of nodeClaims) await runOne(c);
    if (BROWSER && browserClaims.length) {
      console.log('\n=== Chrome on ' + kit.BASE);
      await kit.startBrowser();
      for (const c of browserClaims) await runOne(c);
    } else if (browserClaims.length) console.log('\n(' + browserClaims.length + ' browser checks skipped: --no-browser)');
  } catch (e) {
    console.error('\nthe run broke: ' + (e && e.stack || e));
    await kit.stopBrowser();
    process.exit(1);
  }
  const outside = kit.outsideRequests();
  await kit.stopBrowser();

  /* ---------- the report ---------- */
  console.log('\n=== Summary by section (claims checked / passed / failed; manual)');
  const pad = (s, n) => String(s).padEnd(n);
  for (const s of SECTIONS) {
    if (ONLY && ONLY.indexOf(s) < 0) continue;
    const rs = results.filter((r) => r.section === s);
    const tools = new Set(chosen.filter((c) => sectionOf(c.page) === s).map((c) => c.page));
    console.log('  ' + pad('/' + s + '/', 15) + pad(rs.length + ' checked', 13) + pad(rs.filter((r) => r.status === 'PASS').length + ' pass', 10) +
      pad(rs.filter((r) => r.status !== 'PASS').length + ' fail', 9) + pad(tools.size + ' tools', 10) + manuals.filter((m) => sectionOf(m.page) === s).length + ' manual');
  }
  const failed = results.filter((r) => r.status !== 'PASS');
  if (failed.length) {
    console.log('\n=== False or unverifiable claims (' + failed.length + ')');
    for (const r of failed) console.log('  ' + r.page + '  [' + r.where + ']  "' + r.quote + '"\n      ' + r.name + ': ' + r.why.slice(0, 700));
  }
  const man = manuals.filter((m) => !ONLY || ONLY.indexOf(sectionOf(m.page)) >= 0);
  console.log('\n=== Manual: claims no automatic check can settle (' + man.length + ')');
  for (const m of man) console.log('  ' + m.page + '  [' + m.where + ']  "' + m.quote + '"\n      ' + m.why);
  if (BROWSER && browserClaims.length) console.log('\nRequests outside ' + kit.BASE + ' during the browser checks: ' + (outside.length ? outside.join(' | ') : 'none'));
  const pass = results.filter((r) => r.status === 'PASS').length;
  console.log('\n' + results.length + ' claims checked   ' + pass + ' passed   ' + failed.length + ' failed   ' + man.length + ' manual   (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  fs.writeFileSync(JSON_OUT, JSON.stringify({ root: ROOT, when: new Date().toISOString(), results, manual: man, outside }, null, 1));
  console.log('report: ' + JSON_OUT);
  process.exit(failed.length ? 2 : 0);
})();
