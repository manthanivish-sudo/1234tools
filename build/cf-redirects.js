#!/usr/bin/env node
/**
 * build/cf-redirects.js — write _redirects for Cloudflare from the old-URL
 * stubs, so /x.html goes straight to the page it moved to.
 *
 *   node build/cf-redirects.js [--root <dir>]          write _redirects
 *   node build/cf-redirects.js [--root <dir>] --check  exit 1 if it is out of date
 *
 * Every page that moved (build-urls.js and the section generators) left a
 * stub at its .html path: noindex, canonical to the new URL, a meta refresh
 * and a location.replace. GitHub Pages serves those stubs as they are.
 * Cloudflare's static hosting never serves a path ending in .html as itself:
 * /x.html answers 307 to /x, and only then would the stub load and refresh.
 * A rule here per stub turns that into one permanent redirect to where the
 * stub points; Cloudflare applies _redirects before it looks for a file.
 * The query string is carried over (the stub's script carried it too) and
 * the browser keeps the #fragment. Printed QR codes with .html addresses keep
 * working either way. GitHub Pages ignores this file.
 *
 * A stub is an .html file other than index.html and 404.html whose head has
 * <meta http-equiv="refresh" content="0; url=/…"> and a robots noindex. Any
 * other .html file (none today) is listed as a warning: Cloudflare serves it
 * at its address without .html. Cloudflare allows 2,000 static rules; past
 * that the remaining stubs still work through the 307 and the refresh, and
 * the run fails so someone notices.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const at = (n) => args.indexOf('--' + n);
const ROOT = path.resolve(at('root') >= 0 ? args[at('root') + 1] : path.join(__dirname, '..'));
const CHECK = at('check') >= 0;
const OUT = path.join(ROOT, '_redirects');
const SKIP = new Set(['.git', '.github', '.wrangler', 'node_modules']);
const LIMIT = 2000;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.html') && e.name !== 'index.html' && !(dir === ROOT && e.name === '404.html')) out.push(p);
  }
  return out;
}

const rules = [], other = [];
for (const f of walk(ROOT, []).sort()) {
  const head = fs.readFileSync(f, 'utf8').slice(0, 4000);
  const url = '/' + path.relative(ROOT, f).split(path.sep).join('/');
  const m = /<meta\s+http-equiv="refresh"\s+content="0;\s*url=([^"\s]+)"/i.exec(head);
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(head);
  if (!m || !noindex || !m[1].startsWith('/') || /\s/.test(url)) { other.push(url); continue; }
  rules.push(url + ' ' + m[1] + ' 301');
}

const text = '# Written by build/cf-redirects.js from the old-URL stubs; do not edit by hand.\n' +
  '# Cloudflare only: each moved page\'s .html address, permanently to its new one.\n' +
  rules.join('\n') + '\n';
let bad = 0;
if (rules.length > LIMIT) { console.log('FAIL ' + rules.length + ' stubs, over Cloudflare\'s ' + LIMIT + ' static redirects'); bad++; }
for (const u of other) console.log('note ' + u + ' is not a stub; Cloudflare serves it at ' + u.replace(/\.html$/, ''));
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
if (CHECK) {
  if (current !== text) { console.log('FAIL _redirects is out of date (run node build/cf-redirects.js)'); bad++; }
  else console.log('_redirects is up to date: ' + rules.length + ' rules');
} else if (current !== text) {
  fs.writeFileSync(OUT, text);
  console.log('_redirects written: ' + rules.length + ' rules');
} else console.log('_redirects unchanged: ' + rules.length + ' rules');
process.exit(bad ? 1 : 0);
