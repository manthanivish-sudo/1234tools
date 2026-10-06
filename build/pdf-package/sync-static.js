#!/usr/bin/env node
/**
 * The PDF pages that build-pdf-ship.js does not write — the sixteen first
 * built by build-pdf.js, which now refuses to run — keep their lede, tips,
 * FAQ and descriptions by hand. This copies them from each tool's spec
 * (engine/pdf-<id>.js), so a spec edit reaches its page and the two cannot
 * disagree:
 *
 *   node build/pdf-package/sync-static.js           write
 *   node build/pdf-package/sync-static.js --check   exit 1 if a page differs
 *
 * Touched on each page: the meta, og and twitter descriptions, the lede,
 * the Tips panel, the FAQ panel, and in the JSON-LD the SoftwareApplication
 * description and the FAQPage questions. The questions build-depth.js adds
 * (their @id ends #depth-q<n>) are left exactly where they are.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CHECK = process.argv.includes('--check');
const onlyAt = process.argv.indexOf('--only');
const ONLY = onlyAt > 0 ? new Set(String(process.argv[onlyAt + 1] || '').split(',')) : null;
const ship = fs.readFileSync(path.join(ROOT, 'build-pdf-ship.js'), 'utf8');
const shipped = new Set([...ship.matchAll(/\['([a-z0-9-]+)', 'i-[a-z0-9-]+'\]/g)].map((m) => m[1]));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function spec(id) {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'engine', 'pdf-' + id + '.js'), 'utf8'))(w);
  return w.PDF_TOOLS[id];
}

const out = [];
for (const d of fs.readdirSync(path.join(ROOT, 'pdf'), { withFileTypes: true })) {
  if (!d.isDirectory() || shipped.has(d.name) || (ONLY && !ONLY.has(d.name))) continue;
  const page = path.join(ROOT, 'pdf', d.name, 'index.html');
  const eng = path.join(ROOT, 'engine', 'pdf-' + d.name + '.js');
  if (!fs.existsSync(page) || !fs.existsSync(eng)) continue;
  const t = spec(d.name);
  const before = fs.readFileSync(page, 'utf8');
  let html = before;
  const desc = esc(t.description);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, (m, a, b) => a + desc + b)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (m, a, b) => a + desc + b)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, (m, a, b) => a + desc + b)
    .replace(/(<article class="tool"[^>]*>[\s\S]*?<p class="lede">)[^<]*(<\/p>)/, (m, a, b) => a + desc + b);
  if (t.tips && t.tips.length) {
    html = html.replace(/<section class="panel"><h2>Tips<\/h2><ul class="tips">[\s\S]*?<\/ul><\/section>/,
      () => '<section class="panel"><h2>Tips</h2><ul class="tips">' + t.tips.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></section>');
  }
  if (t.faq && t.faq.length) {
    html = html.replace(/<section class="panel"><h2>Frequently asked questions<\/h2>(?:<details>[\s\S]*?<\/details>)+<\/section>/,
      () => '<section class="panel"><h2>Frequently asked questions</h2>' + t.faq.map((f) => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>');
  }
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (m, body) => {
    let j;
    try { j = JSON.parse(body); } catch (e) { return m; }
    const g = Array.isArray(j['@graph']) ? j['@graph'] : [];
    const app = g.find((x) => x && x['@type'] === 'SoftwareApplication');
    if (app) app.description = t.description;
    const faq = g.find((x) => x && x['@type'] === 'FAQPage');
    if (faq && t.faq && t.faq.length) {
      const depth = (faq.mainEntity || []).filter((q) => q && /#depth-q\d+$/.test(q['@id'] || ''));
      faq.mainEntity = t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })).concat(depth);
    }
    return '<script type="application/ld+json">' + JSON.stringify(j) + '</script>';
  });
  if (html !== before) {
    out.push('pdf/' + d.name + '/index.html');
    if (!CHECK) fs.writeFileSync(page, html);
  }
}
console.log(out.length ? (CHECK ? 'would update ' : 'updated ') + out.join(', ') : 'every static PDF page matches its spec');
if (CHECK && out.length) process.exit(1);
