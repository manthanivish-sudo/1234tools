#!/usr/bin/env node
/**
 * The page text a calculator's spec owns, written onto its static page.
 *
 *   node build/calc-page-sync.js /india/emi-calculator/ [/finance/loan-payment/ …]
 *   node build/calc-page-sync.js --all          every calculator page
 *   node build/calc-page-sync.js --check [--all | urls]
 *                                               report pages that differ, write nothing
 *   [--root DIR]                                another copy of the site
 *
 * No generator writes a calculator page's lede, formula, tips or questions:
 * they were written once from engine/calc-<slug>.js and both copies were
 * edited by hand since, so a tip changed in the spec stayed old on the page
 * (or the other way round). This copies, from the spec the page mounts:
 *
 *   description  the lede, meta description, og: and twitter: descriptions,
 *                and the SoftwareApplication's description in the JSON-LD
 *   formula      the Formula panel's <pre class="formula">
 *   tips         the Tips panel's list
 *   faq          the "Frequently asked questions" panel, and the page's own
 *                questions at the head of the JSON-LD FAQPage (the depth
 *                questions after them, with their @id, are build-depth.js's
 *                and are left exactly as they are)
 *
 * Nothing else on the page is touched. A page that does not have one of the
 * panels is not given one. Pages are written only when they change. The
 * service worker is not bumped (the release does that). Inert on require.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');

function pageEngine(root, url) {
  const html = fs.readFileSync(path.join(root, url.replace(/^\/+/, ''), 'index.html'), 'utf8');
  const m = /MVRTool\.mount\(window\.TOOLS\[['"]([^'"]+)['"]\]/.exec(html);
  if (!m) return null;
  return { html, slug: m[1], file: path.join(root, 'engine', 'calc-' + m[1] + '.js') };
}
function specOf(file, slug) {
  const window = { TOOLS: {} };
  const ctx = vm.createContext({ window, console, Intl, Math, Date, Number, String, Array, Object, JSON, isFinite, isNaN, parseFloat, parseInt });
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return window.TOOLS[slug];
}

/** The page with the spec's words in it. Pure: html in, html out. */
function apply(html, spec) {
  let h = html;
  const d = spec.description;
  if (d) {
    h = h.replace(/<p class="lede">[\s\S]*?<\/p>/, '<p class="lede">' + esc(d) + '</p>');
    h = h.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + attr(d) + '$2');
    h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + attr(d) + '$2');
    h = h.replace(/(<meta name="twitter:description" content=")[^"]*(")/, '$1' + attr(d) + '$2');
  }
  if (spec.formula) {
    const f = Array.isArray(spec.formula) ? spec.formula.join('\n') : spec.formula;
    h = h.replace(/(<section class="panel"><h2>Formula<\/h2><pre class="formula">)[\s\S]*?(<\/pre>)/, (m, a, b) => a + esc(f) + b);
  }
  if (Array.isArray(spec.tips)) {
    h = h.replace(/(<section class="panel"><h2>Tips<\/h2><ul class="tips">)[\s\S]*?(<\/ul><\/section>)/, (m, a, b) => a + spec.tips.map((t) => '<li>' + esc(t) + '</li>').join('') + b);
  }
  if (Array.isArray(spec.faq)) {
    h = h.replace(/(<section class="panel"><h2>Frequently asked questions<\/h2>)[\s\S]*?(<\/section>)/, (m, a, b) => a + spec.faq.map((q) => '<details><summary>' + esc(q.q) + '</summary><p>' + esc(q.a) + '</p></details>').join('') + b);
  }
  /* the JSON-LD: the spec's description, and its questions ahead of the depth ones */
  h = h.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (m, a, body, b) => {
    let ld;
    try { ld = JSON.parse(body); } catch (e) { return m; }
    const graph = Array.isArray(ld['@graph']) ? ld['@graph'] : [ld];
    graph.forEach((node) => {
      if (node['@type'] === 'SoftwareApplication' && d) node.description = d;
      if (node['@type'] === 'FAQPage' && Array.isArray(spec.faq)) {
        const depth = (node.mainEntity || []).filter((q) => q['@id']);
        node.mainEntity = spec.faq.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })).concat(depth);
      }
    });
    return a + JSON.stringify(ld) + b;
  });
  return h;
}

function calcPages(root) {
  const out = [];
  const skip = new Set(['node_modules', '.git', 'build', 'conversions', 'learn', 'practice', 'account', 'pwa', 'hi', 'engine', 'assets']);
  for (const sec of fs.readdirSync(root)) {
    if (skip.has(sec)) continue;
    const dir = path.join(root, sec);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const t of fs.readdirSync(dir)) {
      const f = path.join(dir, t, 'index.html');
      if (fs.existsSync(f) && /MVRTool\.mount\(window\.TOOLS\[/.test(fs.readFileSync(f, 'utf8'))) out.push('/' + sec + '/' + t + '/');
    }
  }
  return out.sort();
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--root');
  const root = path.resolve(i >= 0 ? argv[i + 1] : path.join(__dirname, '..'));
  const check = argv.includes('--check');
  let urls = argv.filter((a, k) => a.startsWith('/') && argv[k - 1] !== '--root');
  if (argv.includes('--all')) urls = calcPages(root);
  if (!urls.length) { console.log('calc-page-sync: name the pages, or --all'); process.exit(1); }
  let changed = 0;
  for (const url of urls) {
    const e = pageEngine(root, url);
    if (!e) { console.log('  skip ' + url + ' (mounts no calculator)'); continue; }
    const spec = specOf(e.file, e.slug);
    if (!spec) { console.log('  skip ' + url + ' (no spec ' + e.slug + ')'); continue; }
    const next = apply(e.html, spec);
    if (next === e.html) continue;
    changed++;
    if (check) console.log('  would change ' + url);
    else { fs.writeFileSync(path.join(root, url.replace(/^\/+/, ''), 'index.html'), next); console.log('  wrote ' + url); }
  }
  console.log('calc-page-sync: ' + changed + ' page(s) ' + (check ? 'differ' : 'written'));
  if (check && changed) process.exitCode = 2;
}

if (require.main === module) main();
module.exports = { apply, calcPages };
