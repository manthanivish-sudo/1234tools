/**
 * Give every tool page its own directory, so its URL ends in a slash.
 *
 *   node build-urls.js          apply
 *   node build-urls.js --check  report what would change, write nothing
 *
 * `qr/qr-code-scanner.html` becomes `qr/qr-code-scanner/index.html`, served at
 * `/qr/qr-code-scanner/`. Section hubs and the meta pages are already
 * `index.html` files, so their URLs do not move.
 *
 * Why the file moves rather than the host rewriting it: a directory with an
 * index in it is the one URL shape every static host agrees on. It works on
 * GitHub Pages today, and it will still work behind Firebase Hosting,
 * Cloudflare or anything else later — no `cleanUrls` flag, no rewrite rule, and
 * nothing to re-verify when the hosting moves.
 *
 * The old address keeps working. Every moved page leaves a stub behind at its
 * `.html` path: noindex, canonical to the new URL, and a redirect. That is not
 * politeness towards old bookmarks — this site prints QR codes, and a code on
 * somebody's poster or business card carrying a `.html` URL has to keep
 * resolving for as long as the paper exists.
 *
 * Links become root-absolute along the way, which is what makes the move safe.
 * A page one directory deeper resolves `../assets/app.css` somewhere else
 * entirely, so every relative link would have to be re-counted; `/assets/app.css`
 * means the same thing from any depth and cannot drift again.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const VERBOSE = process.argv.includes('--verbose');
const SITE = 'https://www.1234tools.com';

/* ------------------------------------------------------------------ */
/* the page inventory                                                 */
/* ------------------------------------------------------------------ */

const changes = [];
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (existing === content) return false;
  changes.push((existing === null ? 'create ' : 'update ') + rel);
  if (!CHECK) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return true;
}

function remove(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return false;
  changes.push('delete ' + rel);
  if (!CHECK) fs.unlinkSync(abs);
  return true;
}

/** Every .html file in the tree, repo-relative, with forward slashes. */
function pages() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git' || name === 'build') continue;
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith('.html')) out.push(path.relative(ROOT, abs).split(path.sep).join('/'));
    }
  })(ROOT);
  return out;
}

/** The tool list the site already maintains for its own search box. */
function tools() {
  const src = fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  return sandbox.window.SEARCH_INDEX.map(function (r) { return r[1]; });
}

/**
 * Pages that exist but have never shipped.
 *
 * The working tree can carry a half-finished section whose pages are listed in
 * the search index but not yet committed. Restructuring those would be
 * rewriting somebody's draft underneath them, so they are left exactly where
 * they are and will be moved by the next run after they land.
 */
function unpublished() {
  const out = new Set();
  try {
    const listed = require('child_process')
      .execFileSync('git', ['ls-files', '--others', '--exclude-standard'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    listed.split(/\r?\n/).forEach(function (f) { if (f.endsWith('.html')) out.add(f.trim()); });
  } catch (e) { /* no git here: assume everything in the index has shipped */ }
  return out;
}

/**
 * A tool, reduced to the part that never changes.
 *
 * The index spells a tool `qr/qr-code-scanner.html` before this script runs and
 * `qr/qr-code-scanner/` after it. Everything here works from the slug in
 * between, which is what lets the script be run twice without trying to move
 * an already-moved page.
 */
const slugOf = (entry) => entry.replace(/\/+$/, '').replace(/\.html$/, '');

const DRAFTS = unpublished();
const ENTRIES = tools();
const SLUGS = ENTRIES.filter(function (e) { return !DRAFTS.has(e); }).map(slugOf);
const SKIPPED = ENTRIES.filter(function (e) { return DRAFTS.has(e); });

/* The old address of every tool, which is what links and canonicals in an
   un-migrated page still say. */
const MOVING = new Set(SLUGS.map(function (slug) { return slug + '.html'; }));

/** Where a tool page's markup lives now. */
function sourceOf(slug) {
  const moved = slug + '/index.html';
  return fs.existsSync(path.join(ROOT, moved)) ? moved : slug + '.html';
}

/** Where it should live, and the address it is served at. */
const targetOf = (slug) => slug + '/index.html';
const stubPathOf = (slug) => slug + '.html';

/**
 * The address a file is served at.
 *
 * This is the one place that knows the site's URL shape, so a later change of
 * mind is one function rather than a thousand hand-edited links.
 */
function publicUrl(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return '/' + file.slice(0, -'index.html'.length);
  if (MOVING.has(file)) return '/' + file.replace(/\.html$/, '') + '/';
  return '/' + file;
}

/* ------------------------------------------------------------------ */
/* rewriting one page                                                 */
/* ------------------------------------------------------------------ */

const posixJoin = (a, b) => path.posix.normalize(path.posix.join(a, b));

/** Is this a link we should leave completely alone? */
const external = (url) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(url);

/**
 * Turn every relative href and src into a root-absolute one, and point links
 * at the address a page is served at rather than the file behind it.
 */
function absolutiseLinks(html, fromDir) {
  return html.replace(/(\s(?:href|src)=")([^"]*)(")/g, function (m, pre, url, post) {
    if (!url || external(url)) return m;
    const hashAt = url.indexOf('#');
    const hash = hashAt >= 0 ? url.slice(hashAt) : '';
    const clean = hashAt >= 0 ? url.slice(0, hashAt) : url;
    if (!clean) return m;                                   // a bare fragment
    const resolved = posixJoin(fromDir, clean);
    if (resolved.startsWith('..')) return m;                // outside the site
    return pre + publicUrl(resolved) + hash + post;
  });
}

/**
 * The absolute addresses the page states about itself — canonical, og:url,
 * the JSON-LD `url` and every breadcrumb `item`. One pass covers all of them,
 * which is what stops the canonical and the breadcrumb disagreeing.
 */
function absolutiseSelf(html) {
  return html.replace(/https:\/\/www\.1234tools\.com\/([A-Za-z0-9/_.-]+\.html)/g,
    function (m, file) { return SITE + publicUrl(file); });
}

/** The base every page hands to app.js for building search-result links. */
const setBase = (html) => html.replace(/window\.__BASE__="[^"]*"/, 'window.__BASE__="/"');

function rewritePage(html, fromDir) {
  return setBase(absolutiseSelf(absolutiseLinks(html, fromDir)));
}

/* ------------------------------------------------------------------ */
/* the stub left at the old address                                   */
/* ------------------------------------------------------------------ */

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A page whose whole job is to send a visitor on.
 *
 * `noindex,follow` keeps it out of the index while still passing the link on,
 * the canonical names the real address, and the redirect happens without
 * JavaScript so a printed code still works in a browser that has it switched
 * off.
 */
function stub(title, to) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escAttr(title)} has moved | 1234Tools</title>
<link rel="canonical" href="${SITE}${to}">
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace('${to}' + location.search + location.hash);</script>
<style>
  body { margin: 0; display: grid; place-items: center; min-height: 100vh;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         background: #06080f; color: #f4f6fb; text-align: center; padding: 24px; }
  a { color: #f7c948; }
</style>
</head>
<body>
<main>
  <h1>${escAttr(title)} has moved</h1>
  <p>It now lives at <a href="${to}">${to}</a>.</p>
  <p>You should arrive there automatically.</p>
</main>
</body>
</html>
`;
}

/** A page whose only job is to redirect, whoever wrote it. */
const isStub = (html) =>
  /name="robots" content="noindex,follow"/.test(html) && /http-equiv="refresh"/.test(html);

/**
 * The tool's name, from whatever page we are looking at.
 *
 * Regenerating a stub reads the stub's own title, which already ends in "has
 * moved" — leave that on and the name grows a little longer every run.
 */
const titleOf = (html) => {
  const m = /<title>([^<]*)<\/title>/.exec(html);
  if (!m) return 'This tool';
  return m[1].replace(/\s*[—|].*$/, '').replace(/\s+has moved$/i, '').trim() || 'This tool';
};

/* ------------------------------------------------------------------ */
/* the files that list URLs                                           */
/* ------------------------------------------------------------------ */

function updateSearchIndex() {
  const rel = 'assets/search-index.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const out = src.replace(/"([A-Za-z0-9/_-]+)\.html"/g, function (m, p) {
    const file = p + '.html';
    return MOVING.has(file) ? '"' + p + '/"' : m;
  });
  return write(rel, out);
}

function updateSitemap() {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return write(rel, absolutiseSelf(src));
}

/**
 * Manifests follow their page, with one exception that matters: `id` stays as
 * it was. It is what a browser uses to recognise an app it has already
 * installed, so changing it would not move those installs — it would orphan
 * them and offer the same tool again as a second app.
 */
function updateManifests() {
  let touched = 0;
  for (const slug of SLUGS) {
    const rel = 'pwa/' + slug + '.webmanifest';
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const m = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const url = publicUrl(stubPathOf(slug));
    if (!m.id) m.id = '/' + slug + '.html';       // keep the original identity
    m.start_url = url + '?src=pwa';
    m.scope = url;
    if (write(rel, JSON.stringify(m, null, 2) + '\n')) touched++;
  }
  return touched;
}

function bumpServiceWorker() {
  const rel = 'sw.js';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const out = src.replace(/var V = '1234tools-v(\d+)';/, function (m, n) {
    return "var V = '1234tools-v" + (Number(n) + 1) + "';";
  });
  return write(rel, out);
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */

function main() {
  const all = pages();
  let moved = 0, stubbed = 0, rewritten = 0;

  /* 1. the tool pages: rewrite, write at the new path, stub the old one */
  for (const slug of SLUGS) {
    const from = sourceOf(slug);
    const target = targetOf(slug);
    const abs = path.join(ROOT, from);
    if (!fs.existsSync(abs)) continue;

    const html = fs.readFileSync(abs, 'utf8');
    /* Links resolve against the directory the markup was authored in: the
       section directory on the first run, the tool's own directory after. */
    const out = rewritePage(html, path.posix.dirname(from));

    if (write(target, out)) rewritten++;
    if (from !== target) moved++;          // the old path becomes the stub below
    if (write(stubPathOf(slug), stub(titleOf(html), publicUrl(stubPathOf(slug))))) stubbed++;
  }

  /* 2. everything else keeps its address but still gets absolute links */
  for (const rel of all) {
    if (MOVING.has(rel)) continue;                        // handled above
    if (DRAFTS.has(rel)) continue;                        // not ours to touch
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');

    /* A stub written by an earlier move gets rebuilt rather than patched, so
       every redirect on the site has the same shape and none of them points at
       another redirect. Its canonical already names the destination. */
    if (isStub(html)) {
      const dest = /<link rel="canonical" href="https:\/\/www\.1234tools\.com([^"]*)"/.exec(html);
      if (dest) {
        const to = publicUrl(dest[1].replace(/^\//, '') || 'index.html');
        if (write(rel, stub(titleOf(html), to))) rewritten++;
      }
      continue;
    }

    if (write(rel, rewritePage(html, path.posix.dirname(rel)))) rewritten++;
  }

  const index = updateSearchIndex();
  const map = updateSitemap();
  const manifests = updateManifests();
  /* Only when something else actually moved. Bumping on every run would
     expire every visitor's cache each time the script is executed. */
  const sw = changes.length > 0 ? bumpServiceWorker() : false;

  console.log('\nbuild-urls.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  tool pages moved    ' + moved);
  console.log('  pages rewritten     ' + rewritten);
  console.log('  redirect stubs      ' + stubbed);
  console.log('  search index        ' + (index ? 'updated' : 'unchanged'));
  console.log('  sitemap             ' + (map ? 'updated' : 'unchanged'));
  console.log('  manifests           ' + manifests + ' updated');
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  if (SKIPPED.length) {
    console.log('  ! left alone        ' + SKIPPED.length + ' page(s) not committed yet:');
    console.log('      ' + SKIPPED.slice(0, 4).join(', ') + (SKIPPED.length > 4 ? ', …' : ''));
  }
  if (VERBOSE) changes.forEach(function (c) { console.log('    ' + c); });
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

main();
