#!/usr/bin/env node
/**
 * build/affected.js — which test suites cover what you changed.
 *
 *   node build/affected.js [--base <ref>] [--run]
 *
 * Lists the working-tree changes against --base (default HEAD, plus untracked
 * files), then every suite under build/tests/ (and the ai-video and
 * pdf-package suites) whose source names one of the changed files, by path
 * or by file name. A changed test file covers itself. Prints two lines to
 * paste: the suites to run on their own, and the --tests list for
 * build/release.js (only the suites release.js knows).
 *
 * --run runs the stand-alone suites one after another on this tree and
 * prints one summary line each (they serve the repo themselves).
 *
 * A suite that loads a file indirectly (a bundle that pulls in another, a
 * page that mounts an engine) is only found if its source names the file, so
 * this is a floor, not a ceiling: the full release run is still the gate.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const base = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'HEAD';
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);

const changed = git('diff', '--name-only', base).concat(git('ls-files', '-o', '--exclude-standard'));
if (!changed.length) { console.log('No changes against ' + base + '.'); process.exit(0); }

/* helpers the suites require, not suites themselves */
const HELPERS = new Set(['serve', 'image-fixtures', 'calc-preamble']);
const DIRS = ['build/tests', 'build/ai-video/tests', 'build/pdf-package/tests'];
const suites = [];
for (const d of DIRS) {
  const abs = path.join(REPO, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (!f.endsWith('.js') || HELPERS.has(f.slice(0, -3))) continue;
    suites.push({ name: f.slice(0, -3), file: d + '/' + f, src: fs.readFileSync(path.join(abs, f), 'utf8') });
  }
}

/* claims.js runs the per-area files in build/tests/claims/: they count as its source */
const claimsDir = path.join(REPO, 'build/tests/claims');
const claims = suites.find((s) => s.name === 'claims');
if (claims && fs.existsSync(claimsDir)) {
  for (const f of fs.readdirSync(claimsDir)) if (f.endsWith('.js')) claims.src += '\n' + fs.readFileSync(path.join(claimsDir, f), 'utf8');
}

/* release.js names its suites in one list; read it rather than copy it */
const rel = fs.readFileSync(path.join(REPO, 'build/release.js'), 'utf8');
const inRelease = (name) => new RegExp("['\"]" + name.replace(/[-]/g, '\\-') + "['\"]").test(rel);

const hits = [];
for (const s of suites) {
  const why = changed.filter((c) => c === s.file || s.src.includes(c) || s.src.includes(path.basename(c)));
  if (why.length) hits.push({ s: s, why: why });
}

console.log('Changed (' + changed.length + '): ' + changed.slice(0, 12).join(', ') + (changed.length > 12 ? ', …' : ''));
if (!hits.length) {
  console.log('No suite names these files. Run the full release dry run, or add a check to the suite that owns the area.');
  process.exit(0);
}
for (const h of hits) console.log('  ' + h.s.name.padEnd(18) + (inRelease(h.s.name) ? 'release ' : 'alone   ') + h.why.slice(0, 3).join(', '));
const alone = hits.map((h) => 'node ' + h.s.file);
const relList = hits.filter((h) => inRelease(h.s.name)).map((h) => h.s.name);
console.log('\nOn their own:  ' + alone.join(' && '));
console.log('Release:       --tests ' + (relList.join(',') || '(none of these is a release suite)'));

if (argv.includes('--run')) {
  console.log('');
  for (const h of hits) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [h.s.file], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
    const out = (r.stdout || '') + (r.stderr || '');
    const m = out.match(/(\d+) passed[, ]+(\d+) failed/g);
    const tail = m ? m[m.length - 1] : out.trim().split('\n').slice(-1)[0];
    console.log(h.s.name.padEnd(18) + 'exit ' + r.status + '  ' + Math.round((Date.now() - t0) / 1000) + 's  ' + (tail || '').slice(0, 120));
  }
}
