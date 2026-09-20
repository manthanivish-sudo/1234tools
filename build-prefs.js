/**
 * build-prefs.js — put the preference store on every page.
 *
 * assets/prefs.js has to be running before an engine draws anything, or a
 * calculator formats its first result in the wrong currency and corrects
 * itself a moment later. So the tag goes in the head, ahead of the engine
 * scripts, next to the other thing that already loads there.
 *
 * Like build-outbound and build-sidebar, this is both a post-processor and
 * a function the generators call at write time. A generator that writes a
 * page without calling tag() would have the tag put back on the next pass
 * and taken off on the one after, and the pipeline would never settle —
 * that has happened twice here already, so: apply(html) at write time.
 *
 *   node build-prefs.js [--check]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const TAG = '<script src="/assets/prefs.js" defer></script>';

/* Where the tag goes: on the stylesheet link, which every page has, which
   sits after the PWA block and before the engine scripts.

   NOT after pwa.js, which is where this went first. That line lives inside
   the block build-pwa.js deletes and rewrites wholesale, so the tag was
   added on one pass and swept away on the next, for ever. */
const AFTER = '<link rel="stylesheet" href="/assets/app.css">';

/* A preference nobody can find is not a preference. The footer is the one
   list that is on every page, so the way in goes there, beside the other
   pages about how the site treats you. */
const FOOT_AT = '<li><a href="/privacy/">Privacy Policy</a></li>';
const FOOT_LINK = '<li><a href="/settings/">Settings</a></li>';

/** Put the tag and the footer link on a page, or leave it exactly as it is. */
function apply(html) {
  if (typeof html !== 'string') return html;
  if (html.indexOf('/assets/prefs.js') < 0) {
    if (html.indexOf(AFTER) >= 0) html = html.replace(AFTER, AFTER + '\n' + TAG);
    else if (html.indexOf('</head>') >= 0) html = html.replace('</head>', TAG + '\n</head>');
  }
  if (html.indexOf(FOOT_LINK) < 0 && html.indexOf(FOOT_AT) >= 0) {
    html = html.replace(FOOT_AT, FOOT_LINK + '\n          ' + FOOT_AT);
  }
  return html;
}

/** True when the page carries the tag ahead of any engine script. */
function ok(html) {
  const at = html.indexOf('/assets/prefs.js');
  if (at < 0) return false;
  const engine = html.indexOf('<script src="/engine/');
  return engine < 0 || at < engine;
}

const changes = [];
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  if (fs.readFileSync(abs, 'utf8') === content) return false;
  changes.push(rel);
  if (!CHECK) fs.writeFileSync(abs, content);
  return true;
}

function pages() {
  const out = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'assets' || ent.name === 'engine' || ent.name === 'build') continue;
        walk(abs);
        continue;
      }
      if (ent.name === 'index.html' || ent.name === '404.html') out.push(path.relative(ROOT, abs).split(path.sep).join('/'));
    }
  })(ROOT);
  return out;
}

function main() {
  if (!fs.existsSync(path.join(ROOT, 'assets/prefs.js'))) {
    throw new Error('assets/prefs.js is missing; every page would ask for a script that is not there');
  }
  let touched = 0, wrong = [];
  for (const rel of pages()) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const out = apply(src);
    if (out !== src && write(rel, out)) touched++;
    if (!ok(out)) wrong.push(rel);
  }
  if (wrong.length) {
    throw new Error('these pages would load an engine before the preferences it reads:\n  ' + wrong.slice(0, 10).join('\n  '));
  }
  console.log('\nbuild-prefs.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  pages               ' + pages().length);
  console.log('  pages changed       ' + touched + ' (the script tag, the footer link, or both)');
  console.log('  order               every page loads preferences before any engine');
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
module.exports = { apply, ok, TAG };
