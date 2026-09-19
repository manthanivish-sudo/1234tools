/**
 * Make build/sections.js the authority on what every section is called and
 * how many tools it holds — in the sidebar of every page, the homepage cards,
 * and each section hub's own title, heading and description.
 *
 *   node build-sections.js          apply
 *   node build-sections.js --check  report what would change, write nothing
 *
 * What it found the first time it ran:
 *
 * - Four sections were named by their slug everywhere: "business", "image",
 *   "india" and "text" sat in the sidebar of all 1,253 pages next to "Health"
 *   and "Time & Dates", and their hubs were titled "business Tools — 14 Free
 *   Calculators".
 * - Two hubs were titled "<Name> Tools Tools", because the name already ended
 *   in Tools and the generator appended it again.
 * - The QR hub said 1 tool in its title, 2 in the sidebar and 3 in its own
 *   lede. It has three. The developer hub said 22 in its title and 21 in its
 *   lede. It has 21.
 *
 * Counts come from the search index, which is the site's own list of what
 * exists, so a section cannot claim tools that are not searchable. Run this
 * against a clean export: the working tree's index can carry unpublished
 * drafts, and their count would leak into every page.
 *
 * Curated hub metadata is left alone. Only text that matches the generator's
 * own pattern is rewritten, so "Free PDF Tools — Merge, Split, Rotate" and
 * "Learning Resources — Curated Courses" survive untouched.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { SECTIONS } = require('./build/sections.js');
const { searchIndexTools } = require('./build-site.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const VERBOSE = process.argv.includes('--verbose');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&amp;/g, '&').replace(/&#0*38;/g, '&');
const num = (n) => Number(n).toLocaleString('en-GB');
const rx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* "Developer & Web" -> "developer & web", but "PDF" stays "PDF". */
const lower = (s) => s.split(' ').map((w) => (w === w.toUpperCase() && /[A-Z]/.test(w)) ? w : w.toLowerCase()).join(' ');

function pages() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git' || name === 'build') continue;
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith('.html')) out.push(abs);
    }
  })(ROOT);
  return out;
}

const isStub = (html) =>
  /name="robots" content="noindex,follow"/.test(html) && /http-equiv="refresh"/.test(html);

function unpublished() {
  const out = new Set();
  try {
    require('child_process')
      .execFileSync('git', ['ls-files', '--others', '--exclude-standard'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n').forEach((f) => { const t = f.trim(); if (t.endsWith('.html')) out.add(t); });
  } catch (e) { /* no git */ }
  return out;
}

/** How many tools each section URL holds, from the search index. */
function counts() {
  const out = {};
  for (const t of searchIndexTools()) {
    const top = '/' + t.category + '/';
    out[top] = (out[top] || 0) + 1;
    if (t.family) {
      const fam = top + t.family + '/';
      out[fam] = (out[fam] || 0) + 1;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* the pieces that print a section's name                             */
/* ------------------------------------------------------------------ */

/** Sidebar entry, present on every page. */
function patchSidebar(html, url, s, n) {
  const re = new RegExp(
    '(<a class="side-link[^"]*" href="' + rx(url) + '">[\\s\\S]{0,400}?<span class="side-name">)([^<]*)(</span><span class="side-count">)([^<]*)(</span>)');
  return html.replace(re, function (m, a, name, b, count, c) {
    const wantCount = n === undefined ? count : num(n);
    return a + esc(s.name) + b + wantCount + c;
  });
}

/** Homepage card. Only cards that count tools; the learn card counts resources. */
function patchCard(html, url, s, n) {
  const re = new RegExp(
    '(<a class="card[^"]*" href="' + rx(url) + '">[\\s\\S]{0,400}?<strong>)([^<]*)(</strong><span class="card-desc">)(\\d[\\d,]* tools?)(</span>)');
  return html.replace(re, function (m, a, name, b, desc, c) {
    const wantDesc = n === undefined ? desc : num(n) + (n === 1 ? ' tool' : ' tools');
    return a + esc(s.name) + b + wantDesc + c;
  });
}

/**
 * The hub's own head and heading. Each field is rewritten only when it still
 * matches what the generator wrote, so a hand-written one is never touched.
 */
function patchHub(html, s, n) {
  const noun = s.noun || 'calculator';
  const plural = (k, w) => k === 1 ? w : w + 's';
  const Noun = noun[0].toUpperCase() + noun.slice(1);

  /* "<anything> Tools — 22 Free Calculators | 1234Tools", including the
     doubled "Tools Tools" and the singular "1 Free Calculator". A name that
     already ends in Tools is used whole, so nothing gets "Tools" twice. */
  const titleRe = /^(.+?)(?: Tools)+ — (\d[\d,]*) Free (Calculators?|Tools?) \| 1234Tools$/;
  const prefix = /Tools$/.test(s.name) ? s.name : s.head + ' Tools';
  const title = esc(prefix) + ' — ' + num(n) + ' Free ' + plural(n, Noun) + ' | 1234Tools';
  for (const tag of ['<title>', '<meta property="og:title" content="', '<meta name="twitter:title" content="']) {
    const close = tag === '<title>' ? '</title>' : '">';
    const re = new RegExp(rx(tag) + '([^<"]*)' + rx(close));
    html = html.replace(re, function (m, text) {
      return titleRe.test(unesc(text)) ? tag + title + close : m;
    });
  }

  /* "22 free developer &amp; web tools tools that run entirely in your browser. No sign-up, works offline." */
  const descRe = /^\d[\d,]* free .+? tools that run entirely in your browser\. No sign-up, works offline\.$/;
  const desc = num(n) + ' free ' + esc(lower(s.head)) + ' tools that run entirely in your browser. No sign-up, works offline.';
  for (const tag of ['<meta name="description" content="', '<meta property="og:description" content="', '<meta name="twitter:description" content="']) {
    const re = new RegExp(rx(tag) + '([^"]*)">');
    html = html.replace(re, function (m, text) {
      return descRe.test(unesc(text)) ? tag + desc + '">' : m;
    });
  }

  /* "<h1><svg…/>business tools</h1>", "…Developer &amp; Web Tools tools</h1>". The
     lowercase "tools" is the generator's; "QR Tools" and "Free PDF tools" are not. */
  html = html.replace(/(<h1[^>]*>(?:<svg[\s\S]*?<\/svg>)?)([^<]*)(<\/h1>)/, function (m, a, text, c) {
    const t = unesc(text).trim();
    /* Case-sensitive on purpose: the trailing lowercase " tools" is the
       generator's signature. "QR Tools" was written by hand and stays. */
    const generated = new RegExp('^(?:' + [s.slug, s.name, s.head].map(rx).join('|') + ')(?: Tools)? tools$');
    return generated.test(t) ? a + esc(s.head) + ' tools' + c : m;
  });

  /* The eyebrow: the slug, or the full name where the sidebar shows it. */
  html = html.replace(/(<p class="eyebrow">)([^<]*)(<\/p>)/, function (m, a, text, c) {
    const t = unesc(text).trim();
    return (t === s.slug || t === s.name) ? a + esc(s.name) + c : m;
  });

  /* "3 free tools. No sign-up, no server, works offline." */
  html = html.replace(/(<p class="lede">)(\d[\d,]*)( free tools\. No sign-up, no server, works offline\.)/,
    function (m, a, k, c) { return a + num(n) + c; });

  return html;
}

/* ------------------------------------------------------------------ */

function main() {
  const drafts = unpublished();
  const n = counts();
  const missing = Object.keys(n).filter((u) => !SECTIONS[u]);
  if (missing.length) {
    console.error('\nbuild-sections.js: the search index has sections the registry does not name:\n' +
      missing.map((u) => '    ' + u).join('\n') + '\n\n  Add them to build/sections.js first.\n');
    process.exit(1);
  }

  const toolSections = Object.values(SECTIONS).filter((s) => !s.meta && s.url !== '/');
  let scanned = 0, sidebars = 0, cards = 0, hubs = 0, changed = 0;
  const renamed = {}, recounted = {};
  const files = [];

  for (const abs of pages()) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (drafts.has(rel)) continue;
    const before = fs.readFileSync(abs, 'utf8');
    if (isStub(before)) continue;
    scanned++;
    let html = before;

    for (const s of toolSections) {
      const count = n[s.url];
      const was = html;
      html = patchSidebar(html, s.url, s, count);
      if (html !== was) sidebars++;
    }

    if (rel === 'index.html') {
      for (const s of toolSections) {
        const was = html;
        html = patchCard(html, s.url, s, n[s.url]);
        if (html !== was) cards++;
      }
    }

    const own = Object.values(SECTIONS).find((s) => s.url !== '/' && rel === s.url.slice(1) + 'index.html');
    if (own && !own.meta && n[own.url] !== undefined) {
      const was = html;
      html = patchHub(html, own, n[own.url]);
      if (html !== was) hubs++;
    }

    if (html !== before) {
      changed++;
      files.push(rel);
      if (!CHECK) fs.writeFileSync(abs, html);
    }
  }

  /* What the first page's sidebar said before, against the registry — the
     report is only useful if it names the mistakes it fixed. */
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const s of toolSections) {
    const m = new RegExp('href="' + rx(s.url) + '">[\\s\\S]{0,400}?<span class="side-name">([^<]*)</span><span class="side-count">([^<]*)</span>').exec(home);
    if (!m) continue;
    if (unesc(m[1]) !== s.name) renamed[s.url] = unesc(m[1]) + ' -> ' + s.name;
    if (n[s.url] !== undefined && m[2] !== num(n[s.url])) recounted[s.url] = m[2] + ' -> ' + num(n[s.url]);
  }

  console.log('\nbuild-sections.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  pages scanned       ' + scanned);
  console.log('  sidebar entries     ' + sidebars + ' corrected');
  console.log('  homepage cards      ' + cards + ' corrected');
  console.log('  hub pages           ' + hubs + ' corrected');
  const rn = Object.entries(renamed), rc = Object.entries(recounted);
  if (rn.length) { console.log('  renamed             ' + rn.length); rn.forEach(([u, v]) => console.log('      ' + u.padEnd(24) + v)); }
  if (rc.length) { console.log('  recounted           ' + rc.length); rc.forEach(([u, v]) => console.log('      ' + u.padEnd(24) + v)); }
  if (VERBOSE) files.slice(0, 30).forEach((f) => console.log('    ' + f));
  console.log('\n  ' + changed + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

main();
