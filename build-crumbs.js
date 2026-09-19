/**
 * The breadcrumb, as one component instead of 1,251 hand-written copies.
 *
 *   node build-crumbs.js          apply
 *   node build-crumbs.js --check  report what would change, write nothing
 *
 * Every page's trail is derived from its own URL against build/sections.js,
 * so a page cannot disagree with the sidebar about what its section is
 * called, and the structured data cannot drift from what the reader sees —
 * both come out of the same function call.
 *
 * What the hand-written copies were missing:
 *
 * - No accessible name. A <nav> without one is announced as an unlabelled
 *   navigation region, and a page that also has a site nav and a sidebar then
 *   offers three of them with nothing to tell them apart.
 * - No list semantics. A breadcrumb is an ordered list, and assistive
 *   technology announces "list, 3 items" only if it is marked up as one.
 * - The "›" was a real character in the markup, so it was read out. The
 *   separator belongs in CSS, where it is decoration and nothing else.
 * - No aria-current, so the last item did not announce itself as the page
 *   you are on.
 * - 26 hub pages had a visible trail and no BreadcrumbList at all, which is
 *   the half Google reads. They were the section hubs — the pages the trail
 *   matters most on.
 *
 * The last crumb is kept, not derived. A tool called "ROI & Payback Period
 * Calculator" is not reconstructible from "roi", and the existing labels were
 * written deliberately.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { SECTIONS, trailFor } = require('./build/sections.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const VERBOSE = process.argv.includes('--verbose');
const SITE = 'https://www.1234tools.com';

/* The root has nothing above it, and the 404 is not a place in the tree. */
const NO_CRUMB = new Set(['index.html', '404.html']);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const unesc = (s) => String(s)
  .replace(/&(?:amp|#0*38);/g, '&').replace(/&(?:lt|#0*60);/g, '<')
  .replace(/&(?:gt|#0*62);/g, '>').replace(/&(?:quot|#0*34);/g, '"')
  .replace(/&(?:#0*39|apos|#x27);/g, "'").replace(/&nbsp;/g, ' ');

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

/** Untracked HTML is somebody's unfinished work; it is not ours to rewrite. */
function unpublished() {
  const out = new Set();
  try {
    require('child_process')
      .execFileSync('git', ['ls-files', '--others', '--exclude-standard'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n').forEach(function (f) {
        const t = f.trim();
        if (t.endsWith('.html')) out.add(t);
      });
  } catch (e) { /* no git: treat everything as published */ }
  return out;
}

/** The page's own URL, from the canonical it already declares. */
function urlOf(html, rel) {
  const m = /<link rel="canonical" href="([^"]+)"/.exec(html);
  if (m) return m[1].replace(SITE, '') || '/';
  return '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '/');
}

/**
 * What this page is called at the end of its own trail. The existing label
 * first, because it was chosen; the <h1> second; the <title> last, with the
 * site suffix taken off.
 */
function labelOf(html) {
  const crumb = /<nav class="crumbs"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  if (crumb) {
    const parts = crumb[1].split(/<\/(?:a|span)>/).filter(function (p) { return /<(?:a|span)\b/.test(p); });
    const last = parts[parts.length - 1];
    if (last) {
      const text = unesc(last.replace(/<[^>]*>/g, '').replace(/[›>]/g, '').trim());
      if (text) return text;
    }
  }
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  if (h1) {
    const text = unesc(h1[1].replace(/<[^>]*>/g, '').trim());
    if (text) return text;
  }
  const t = /<title>([^<]*)<\/title>/.exec(html);
  if (t) return unesc(t[1].split('|')[0].split('—')[0].trim());
  return null;
}

/**
 * The markup. An ordered list inside a named nav, the separator left to CSS,
 * and the current page marked as such.
 */
function render(trail, label) {
  const items = trail.map(function (s) {
    return '<li><a href="' + s.url + '">' + esc(s.crumb) + '</a></li>';
  });
  items.unshift('<li><a href="/">Home</a></li>');
  items.push('<li><span aria-current="page">' + esc(label) + '</span></li>');
  return '<nav class="crumbs" aria-label="Breadcrumb"><ol>' + items.join('') + '</ol></nav>';
}

/** The same trail again, for the half of it that Google reads. */
function breadcrumbList(trail, label, url) {
  const items = [{ name: 'Home', item: SITE + '/' }]
    .concat(trail.map(function (s) { return { name: s.crumb, item: SITE + s.url }; }))
    .concat([{ name: label, item: SITE + url }]);
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(function (x, i) {
      return { '@type': 'ListItem', position: i + 1, name: x.name, item: x.item };
    })
  };
}

/**
 * Put the BreadcrumbList into whatever shape of structured data the page
 * already has: replace the one in a @graph, add it to a @graph without one,
 * or promote a lone object into a @graph so it can have a neighbour.
 */
function patchJsonLd(html, list) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
  const m = re.exec(html);
  if (!m) return { html, added: false, replaced: false };

  let data;
  try { data = JSON.parse(m[1]); }
  catch (e) { return { html, added: false, replaced: false, unparseable: true }; }

  let replaced = false;
  if (Array.isArray(data['@graph'])) {
    const at = data['@graph'].findIndex(function (x) { return x && x['@type'] === 'BreadcrumbList'; });
    if (at >= 0) { data['@graph'][at] = list; replaced = true; }
    else data['@graph'].splice(1, 0, list);
  } else {
    const context = data['@context'] || 'https://schema.org';
    const self = Object.assign({}, data);
    delete self['@context'];
    data = { '@context': context, '@graph': [self, list] };
  }

  const next = html.replace(re,
    function () { return '<script type="application/ld+json">' + JSON.stringify(data) + '</script>'; });
  return { html: next, added: !replaced, replaced };
}

function main() {
  const drafts = unpublished();
  let scanned = 0, skipped = 0, changed = 0, marked = 0, ldAdded = 0, ldReplaced = 0;
  const noLabel = [], noLd = [], relabelled = [], downgrades = [];
  const files = [];
  /* Nothing is written until every page has been checked, so a registry
     mistake found on page 900 does not leave 899 pages half-migrated. */
  const pending = [];

  for (const abs of pages()) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (NO_CRUMB.has(rel) || drafts.has(rel)) { skipped++; continue; }

    const before = fs.readFileSync(abs, 'utf8');
    if (isStub(before)) { skipped++; continue; }
    scanned++;

    const url = urlOf(before, rel);
    /* A section hub is named by the registry, not by whatever its own page
       happened to say — that is how "business" survived in four of them. A
       meta page (privacy, terms) keeps its own heading, which is better than
       anything a registry would guess. */
    const own = SECTIONS[url];
    const label = (own && !own.meta) ? (own.hub || own.name) : labelOf(before);
    if (!label) { noLabel.push(rel); continue; }

    const trail = trailFor(url);
    const markup = render(trail, label);

    let html = before;
    const existing = /<nav class="crumbs"[^>]*>[\s\S]*?<\/nav>/.exec(html);
    if (existing) {
      if (existing[0] !== markup) {
        html = html.replace(existing[0], function () { return markup; });
        /* A changed label means the registry disagreed with the page — worth
           naming, because it is the bug this was written to find. */
        const was = /<a href="\/([^"]*)">([^<]*)<\/a>/g;
        let mm, old = [];
        while ((mm = was.exec(existing[0]))) old.push(unesc(mm[2]));
        const now = ['Home'].concat(trail.map(function (s) { return s.crumb; }));
        if (old.join(' > ') !== now.join(' > ')) {
          relabelled.push(rel + ': ' + old.join(' > ') + '  ->  ' + now.join(' > '));
          /* Replacing "image" with a name is the job. Replacing "Image &
             Photo Tools" with something else is the registry being wrong,
             and it stops the run rather than rewriting twenty pages. */
          old.forEach(function (label, i) {
            const want = now[i];
            const section = trail[i - 1];
            const intended = section && (section.also || []).indexOf(label) >= 0;
            if (want && label !== want && label.toLowerCase() !== label && !intended) {
              downgrades.push(rel + ': "' + label + '" -> "' + want + '"');
            }
          });
        }
      }
    } else {
      /* No trail at all: put one at the top of the content, where every other
         page carries it. */
      const at = html.indexOf('<main id="main" class="content">');
      if (at < 0) { noLabel.push(rel + ' (no main)'); continue; }
      const cut = at + '<main id="main" class="content">'.length;
      html = html.slice(0, cut) + '\n' + markup + html.slice(cut);
      marked++;
    }

    const ld = patchJsonLd(html, breadcrumbList(trail, label, url));
    if (ld.unparseable) noLd.push(rel);
    html = ld.html;
    if (ld.added) ldAdded++;
    if (ld.replaced) ldReplaced++;

    if (html !== before) {
      changed++;
      files.push(rel);
      pending.push([abs, html]);
    }
  }

  if (downgrades.length) {
    console.error('\nbuild-crumbs.js refuses to write: the registry would replace a curated label.\n');
    downgrades.slice(0, 10).forEach(function (d) { console.error('    ' + d); });
    if (downgrades.length > 10) console.error('    … and ' + (downgrades.length - 10) + ' more');
    console.error('\n  Fix build/sections.js so it carries the better name, then run again.\n');
    process.exit(1);
  }
  if (!CHECK) pending.forEach(function (p) { fs.writeFileSync(p[0], p[1]); });

  console.log('\nbuild-crumbs.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  pages with a trail  ' + scanned);
  console.log('  skipped             ' + skipped + ' (home, 404, redirect stubs, unpublished drafts)');
  console.log('  trails added        ' + marked);
  console.log('  BreadcrumbList      ' + ldAdded + ' added, ' + ldReplaced + ' rewritten');
  console.log('  section labels put right on ' + relabelled.length + ' page(s)');
  if (relabelled.length) {
    const kinds = {};
    relabelled.forEach(function (r) { kinds[r.split(': ')[1]] = (kinds[r.split(': ')[1]] || 0) + 1; });
    Object.entries(kinds).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8)
      .forEach(function (k) { console.log('      ' + String(k[1]).padStart(5) + '  ' + k[0]); });
  }
  if (noLabel.length) console.log('  ! no label found on ' + noLabel.length + ': ' + noLabel.slice(0, 5).join(', '));
  if (noLd.length) console.log('  ! unparseable JSON-LD on ' + noLd.length + ': ' + noLd.slice(0, 5).join(', '));
  if (VERBOSE) files.slice(0, 40).forEach(function (f) { console.log('    ' + f); });
  console.log('\n  ' + changed + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

/* The renderer is the component. Any generator that writes a page calls it
   rather than typing its own <nav>, so there is one breadcrumb on the site,
   not one per script. Run directly it patches the site; required, it only
   lends out the functions. */
if (require.main === module) main();

module.exports = { render, breadcrumbList, labelOf };
