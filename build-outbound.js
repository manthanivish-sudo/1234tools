/**
 * Tag every outbound link so the destination can see where the click came
 * from.
 *
 *   node build-outbound.js          apply
 *   node build-outbound.js --check  report what would change, write nothing
 *
 * Two mechanisms, because either one alone leaks traffic.
 *
 * The Referer header is the one destinations already look at, but browsers
 * default to strict-origin-when-cross-origin, so all they currently receive
 * is "https://www.1234tools.com/" — the site, never the page. Setting
 * referrerpolicy="no-referrer-when-downgrade" on the link sends the full URL
 * over https, and still sends nothing if the destination is plain http, which
 * is the part of the old default worth keeping. Nothing private travels this
 * way: every URL here is a public static page and no tool puts user input in
 * a query string.
 *
 * UTM parameters are the belt to that pair of braces. Referrers are dropped
 * by privacy extensions, by some in-app browsers, and by any redirect through
 * http, and a destination that only reads utm_source would otherwise file the
 * whole lot under "direct". They are also the only signal that survives a
 * copy-pasted link.
 *
 * utm_campaign carries the section rather than the page — about twenty values
 * instead of twelve hundred — because a campaign dimension with a thousand
 * members is a dimension nobody reads. The exact page is in the referrer.
 *
 * Idempotent: a URL that already carries utm_source is left alone, so this
 * can run after every build. It rewrites finished pages rather than any
 * template, so run it last, after build-site.js and build-learn.js, the same
 * way build-pwa.js does.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const VERBOSE = process.argv.includes('--verbose');

const SELF = /(^|\.)1234tools\.com$/i;
const SOURCE = '1234tools.com';
const POLICY = 'no-referrer-when-downgrade';

/* Directories that are not the served site. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'build']);

/* Section names read better than raw path segments in a report. */
function sectionOf(rel) {
  const first = rel.split('/')[0];
  return (first === 'index.html' || !first) ? 'home' : first.replace(/\.html$/, '');
}

function pages() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith('.html')) out.push(abs);
    }
  })(ROOT);
  return out;
}

/* An href in the source is HTML-escaped, so a URL that already carries a
   query arrives as "?d=Mathematics&amp;p=2". Handing that to the URL parser
   makes a parameter literally named "amp;p", and re-escaping the result then
   compounds it on every run. Decode first, escape once on the way out. */
function unescapeHtml(s) {
  return String(s)
    .replace(/&(?:amp|#0*38|#[xX]0*26);/g, '&')
    .replace(/&(?:quot|#0*34);/g, '"')
    .replace(/&(?:apos|#0*39);/g, "'")
    .replace(/&(?:lt|#0*60);/g, '<')
    .replace(/&(?:gt|#0*62);/g, '>');
}

/** Append the parameters, respecting an existing query string and fragment. */
function decorate(url, campaign, content) {
  let target;
  try { target = new URL(unescapeHtml(url)); }
  catch (e) { return null; }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
  if (SELF.test(target.hostname)) return null;
  /* Somebody has already tagged this one — theirs wins. */
  if (target.searchParams.has('utm_source')) return null;

  target.searchParams.set('utm_source', SOURCE);
  target.searchParams.set('utm_medium', 'referral');
  target.searchParams.set('utm_campaign', campaign);
  target.searchParams.set('utm_content', content);
  return target.href;
}

const ANCHOR = /<a\b[^>]*>/gi;
const HREF = /\bhref="([^"]*)"/i;

/**
 * Where on the page the link sits. A destination that sees every click from
 * 1234Tools arriving as one undifferentiated blob cannot tell a footer
 * credit from a link somebody actually chose to follow.
 */
function zoneAt(html, index, footerAt, headerEnd) {
  if (footerAt >= 0 && index > footerAt) return 'footer';
  if (headerEnd >= 0 && index < headerEnd) return 'nav';
  return 'content';
}

function rewrite(html, campaign) {
  const footerAt = html.search(/<footer\b/i);
  const headerEnd = html.search(/<\/header>/i);
  let touched = 0;

  const out = html.replace(ANCHOR, function (tag, index) {
    const m = HREF.exec(tag);
    if (!m) return tag;
    const next = decorate(m[1], campaign, zoneAt(html, index, footerAt, headerEnd));
    if (!next) return tag;

    /* $& in a replacement string is a back-reference, and a URL can contain
       one; a function replacement takes the text literally. */
    const escaped = next.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    let updated = tag.replace(HREF, function () { return 'href="' + escaped + '"'; });
    if (!/\breferrerpolicy=/i.test(updated)) {
      updated = updated.replace(/<a\b/i, '<a referrerpolicy="' + POLICY + '"');
    }
    touched++;
    return updated;
  });

  return { html: out, touched };
}

/* Every page changed, so returning visitors must be told to refetch rather
   than keep serving untagged links out of the cache. */
function bumpServiceWorker() {
  const rel = 'sw.js';
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return false;
  const src = fs.readFileSync(abs, 'utf8');
  const next = src.replace(/var V = '1234tools-v(\d+)';/, function (m, n) {
    return "var V = '1234tools-v" + (Number(n) + 1) + "';";
  });
  if (next === src) return false;
  if (!CHECK) fs.writeFileSync(abs, next);
  return true;
}

function main() {
  let files = 0, links = 0;
  const hosts = {};
  const changes = [];

  for (const abs of pages()) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const before = fs.readFileSync(abs, 'utf8');
    const { html, touched } = rewrite(before, sectionOf(rel));
    if (!touched || html === before) continue;

    for (const m of html.matchAll(/href="(https?:\/\/[^"]*utm_source=1234tools[^"]*)"/gi)) {
      try { hosts[new URL(m[1].replace(/&amp;/g, '&')).hostname] = (hosts[new URL(m[1].replace(/&amp;/g, '&')).hostname] || 0) + 1; }
      catch (e) { /* not a URL we tagged */ }
    }

    files++;
    links += touched;
    changes.push(rel + '  (' + touched + ')');
    if (!CHECK) fs.writeFileSync(abs, html);
  }

  const sw = files ? bumpServiceWorker() : false;
  const top = Object.entries(hosts).sort(function (a, b) { return b[1] - a[1]; });

  console.log('\nbuild-outbound.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  pages changed       ' + files);
  console.log('  links tagged        ' + links);
  console.log('  referrer policy     ' + POLICY + ' (sends the full page URL over https)');
  console.log('  parameters          utm_source=' + SOURCE + ', utm_medium=referral, utm_campaign=<section>, utm_content=<nav|content|footer>');
  if (top.length) {
    console.log('  destinations        ' + top.length + ' host(s), most-linked first:');
    top.slice(0, 12).forEach(function (h) {
      console.log('      ' + String(h[1]).padStart(6) + '  ' + h[0]);
    });
    if (top.length > 12) console.log('      ' + String(top.length - 12).padStart(6) + '  more');
  }
  console.log('  service worker      ' + (sw ? 'bumped' : 'unchanged'));
  if (VERBOSE) changes.slice(0, 40).forEach(function (c) { console.log('    ' + c); });
  console.log('\n  ' + files + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

/* A generator that writes a page with an outbound link calls rewrite() on
   it before writing, so the page and this pass agree on the first run. Run
   directly, this tags the whole site; required, it only lends the function. */
if (require.main === module) main();
module.exports = { rewrite, decorate, sectionOf };
