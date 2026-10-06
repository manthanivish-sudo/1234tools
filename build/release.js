#!/usr/bin/env node
/**
 * build/release.js — the release recipe as one command. Dry run by default:
 * it builds an export, checks it and prints the tree it would commit. It
 * commits only with --commit; it never checks out or pushes, and it fetches
 * only when origin's main is not already local (see "sw.js" below).
 *
 *   node build/release.js --out <dir> [options]
 *
 *   --out <dir>             export to build (must not exist, must be outside the repo)
 *   --report <dir>          logs, lists and summary.txt (default <out>-release; must not exist)
 *   --exclude <path|dir/>   keep HEAD's version of a working-tree file (repeatable;
 *                           a trailing / excludes everything under that folder)
 *   --exclude-file <list>   one --exclude entry per line, # comments allowed
 *   --allow-revert          copy working-tree files that still hold the version
 *                           before HEAD (normally a skipped post-release checkout;
 *                           without this flag the run stops and lists them)
 *
 *   generators, run once in this order, each only when named:
 *   --learn --ai            (never part of --all-generators; run first)
 *   --pdf-ship --finder --stories --examples --tools --collections --guides
 *   --compare --embed --biz --ai-image --ai-video --showcase --og   (og = build/make-og.js --cards;
 *                           with --collections, build-collections runs again after --showcase)
 *   --gen a,b,c             the same names as a list
 *   --all-generators        all of the second group (showcase only if build-showcase.js
 *                           is in the export)
 *
 *   --sw <n>                set sw.js to 1234tools-v<n> instead of live+1 (the
 *                           footer's version record takes the same number)
 *   --no-fetch              never fetch; fail if the live commit is not local
 *
 *   --test                  run the suites against the export (needs --ports)
 *   --ports <a-b>           port range for the browser suites, e.g. 8870-8899
 *   --tests a,b             only these suites (names as in the summary table)
 *   --known-failures <json|file>   e.g. '{"test_pdftools":7}': up to that many
 *                           failures in that suite do not fail the run
 *   --test-timeout <min>    per suite (default 30)
 *
 *   --commit -m <msgfile>   after a clean run only: commit-tree on HEAD, update-ref
 *                           main, git reset -q --mixed HEAD, then PRINT (not run) the
 *                           checkout / push / ls-remote commands
 *
 * Steps: git archive HEAD into --out; copy every modified and untracked
 * working-tree file (git diff --name-only HEAD, git ls-files -o
 * --exclude-standard) minus the excludes, deleting files deleted in the
 * working tree; reset sw.js's V to HEAD's; generators; the post-processor
 * chain twice (pass 2 must change 0 files); sw.js V = live + 1, where live is
 * the V in origin's main (git ls-remote, fetched only if that commit is not
 * already local); the footer's version record in assets/version.js set to
 * that V, today's date and HEAD's short id as built_on (build/version-record.js);
 * build/split-models.js (no file over 24 MiB: parts the
 * loaders read) and build/cf-redirects.js (Cloudflare's _redirects from the
 * stubs); tree audit through a throwaway index (writes objects, no
 * refs); 0x08 scan of every changed text file; tests (the git-ignored
 * pdf-package fixtures are copied in for them, and the tree is rebuilt after
 * them to prove they wrote nothing that would be committed); the list of
 * paths a commit would let you check out; summary.txt in --report.
 *
 * Exit code 0 when everything passed, 1 when anything failed, 2 on bad usage.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const versionRecord = require('./version-record.js');

const REPO = path.resolve(__dirname, '..');
const NODE = process.execPath;
const SW_RE = /var V = '1234tools-v(\d+)';/;
const BS_ALLOWED = new Set(['engine/biz-tally-converter.js']);

/* finder before stories and examples: both read assets/finder-index.js, so a
   new tool's story and example were left out until the next release */
const GENERATORS = [
  ['pdf-ship', 'build-pdf-ship.js'], ['finder', 'build-finder.js'],
  ['stories', 'build-stories.js'], ['examples', 'build-examples.js'], ['tools', 'build-tools.js'], ['collections', 'build-collections.js'],
  ['guides', 'build-guides.js'], ['compare', 'build-compare.js'], ['embed', 'build-embed.js'],
  ['biz', 'build-biz.js'], ['ai-image', 'build-ai-image.js'], ['ai-video', 'build-ai-video.js'], ['social', 'build-social.js'], ['showcase', 'build-showcase.js'],
  ['og', 'build/make-og.js', ['--cards']],
];
const ONCE = [['learn', 'build-learn.js'], ['ai', 'build-ai.js']];
const CHAIN = ['share', 'proof', 'conversions', 'depth', 'sidebar', 'sections', 'hubs', 'crumbs', 'outbound',
  'pwa', 'home', 'site', 'share', 'proof', 'conversions', 'depth'];

/* ------------------------------------------------------------ arguments */
function usage(msg) {
  if (msg) console.error('release: ' + msg + '\n');
  const src = fs.readFileSync(__filename, 'utf8');
  console.error(src.slice(src.indexOf('/**') + 4, src.indexOf('*/')).replace(/^ \* ?/gm, ''));
  process.exit(2);
}
const opt = { exclude: [], gens: new Set(), knownFailures: {}, testTimeout: 30 };
{
  const a = process.argv.slice(2);
  const val = (i) => { if (i + 1 >= a.length || /^--/.test(a[i + 1])) usage(a[i] + ' needs a value'); return a[i + 1]; };
  const genNames = new Set(GENERATORS.concat(ONCE).map((g) => g[0]));
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--help' || k === '-h') usage();
    else if (k === '--out') opt.out = val(i++);
    else if (k === '--report') opt.report = val(i++);
    else if (k === '--exclude') opt.exclude.push(val(i++));
    else if (k === '--exclude-file') opt.excludeFile = val(i++);
    else if (k === '--all-generators') opt.allGenerators = true;
    else if (k === '--gen') val(i++).split(',').filter(Boolean).forEach((g) => { if (!genNames.has(g)) usage('unknown generator ' + g); opt.gens.add(g); });
    else if (k.startsWith('--') && genNames.has(k.slice(2))) opt.gens.add(k.slice(2));
    else if (k === '--sw') { opt.sw = Number(val(i++)); if (!Number.isInteger(opt.sw) || opt.sw < 1) usage('--sw needs a whole number'); }
    else if (k === '--no-fetch') opt.noFetch = true;
    else if (k === '--allow-revert') opt.allowRevert = true;
    else if (k === '--test') opt.test = true;
    else if (k === '--ports') {
      const m = /^(\d+)-(\d+)$/.exec(val(i++)); if (!m || +m[1] > +m[2]) usage('--ports wants a range like 8870-8899');
      opt.ports = [+m[1], +m[2]];
    }
    else if (k === '--tests') opt.only = new Set(val(i++).split(',').filter(Boolean));
    else if (k === '--known-failures') {
      const v = val(i++);
      try { opt.knownFailures = JSON.parse(fs.existsSync(v) ? fs.readFileSync(v, 'utf8') : v); } catch (e) { usage('--known-failures: ' + e.message); }
    }
    else if (k === '--test-timeout') opt.testTimeout = Number(val(i++));
    else if (k === '--commit') opt.commit = true;
    else if (k === '-m' || k === '--message') opt.msgFile = val(i++);
    else usage('unknown option ' + k);
  }
  if (!opt.out) usage('--out is required');
  opt.out = path.resolve(opt.out);
  opt.report = path.resolve(opt.report || opt.out + '-release');
  if (fs.existsSync(opt.out)) usage(opt.out + ' already exists');
  if (fs.existsSync(opt.report)) usage(opt.report + ' already exists');
  const inside = (p, dir) => { const r = path.relative(dir, p); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
  if (inside(opt.out, REPO) || inside(opt.report, REPO)) usage('--out and --report must be outside ' + REPO);
  if (inside(opt.report, opt.out)) usage('--report must not be inside --out');
  if (opt.test && !opt.ports) usage('--test needs --ports (build/tests/serve.js reuses whatever already listens on a port)');
  if (opt.commit && !opt.msgFile) usage('--commit needs -m <msgfile>');
  if (opt.msgFile && !opt.commit) usage('-m is only for --commit');
  if (opt.msgFile) { opt.msgFile = path.resolve(opt.msgFile); if (!fs.existsSync(opt.msgFile)) usage(opt.msgFile + ' not found'); }
  if (opt.excludeFile) {
    if (!fs.existsSync(opt.excludeFile)) usage(opt.excludeFile + ' not found');
    fs.readFileSync(opt.excludeFile, 'utf8').split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean).forEach((l) => opt.exclude.push(l));
  }
  opt.exclude = opt.exclude.map((e) => e.replace(/\\/g, '/').replace(/^\.\//, ''));
  if (!(opt.testTimeout > 0)) usage('--test-timeout wants minutes');
}

/* ------------------------------------------------------------- helpers */
const failures = [];
const notes = [];
const summary = [];
const fail = (m) => { failures.push(m); console.log('  FAIL ' + m); };
const note = (m) => { notes.push(m); console.log('  note ' + m); };
const say = (m) => { summary.push(m); console.log(m); };
const ENV = Object.assign({}, process.env, { NODE_PATH: path.join(REPO, 'node_modules') });

function git(args, o) {
  o = o || {};
  const r = spawnSync('git', args, { cwd: o.cwd || REPO, env: o.env || process.env, encoding: o.buffer ? null : 'utf8', maxBuffer: 1 << 30 });
  if (r.error) throw r.error;
  if (r.status !== 0 && !o.allowFail) throw new Error('git ' + args.join(' ') + ' failed (' + r.status + '):\n' + String(r.stderr).slice(0, 2000));
  return o.full ? r : r.stdout;
}
const gitOk = (args) => spawnSync('git', args, { cwd: REPO, encoding: 'utf8' }).status === 0;
const zlist = (s) => s.split('\0').filter(Boolean);
const swOf = (src) => { const m = SW_RE.exec(src); if (!m) throw new Error("no var V = '1234tools-vNNN' in sw.js"); return Number(m[1]); };
const setSw = (n) => {
  const f = path.join(opt.out, 'sw.js');
  const src = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, src.replace(SW_RE, "var V = '1234tools-v" + n + "';"));
};
const sha1 = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
const pad = (s, n) => String(s).padEnd(n);
const tailOf = (out) => '\n      | ' + out.trimEnd().split('\n').slice(-6).join('\n      | ');
let step = 0;
const logsDir = () => path.join(opt.report, 'logs');

/** Runs a node script with its output in a log file; returns { status, out, secs, timedOut }. */
function runNode(name, script, args, cwd, extraEnv, timeoutMs) {
  const log = path.join(logsDir(), String(++step).padStart(3, '0') + '-' + name.replace(/[^\w.-]+/g, '_') + '.log');
  const fd = fs.openSync(log, 'w');
  const t0 = Date.now();
  const r = spawnSync(NODE, [script].concat(args || []), {
    cwd, env: Object.assign({}, ENV, extraEnv || {}), stdio: ['ignore', fd, fd], timeout: timeoutMs || 0, windowsHide: true,
  });
  fs.closeSync(fd);
  const out = fs.readFileSync(log, 'utf8');
  const timedOut = !!(r.error && r.error.code === 'ETIMEDOUT');
  if (r.error && !timedOut) throw r.error;
  return { status: r.status, out, log, secs: (Date.now() - t0) / 1000, timedOut };
}
/** The "N file(s) changed" (or "written") line every build script ends with. */
function changedCount(out) {
  let m, last = null;
  const re = /(\d+) file\(s\) (?:changed|written|would change)/g;
  while ((m = re.exec(out))) last = Number(m[1]);
  if (last === null && (m = /(\d+) written, \d+ unchanged/.exec(out))) last = Number(m[1]); // make-og --cards
  return last;
}
function portBusy(port) {
  const code = 'const s=require("net").connect(' + port + ',"127.0.0.1");s.on("connect",()=>process.exit(1));' +
    's.on("error",()=>process.exit(0));setTimeout(()=>process.exit(0),1500);';
  return spawnSync(NODE, ['-e', code], { windowsHide: true }).status === 1;
}

/** Builds the export's tree through a throwaway index: no refs, no change to the real index. */
function buildTree(label) {
  const gitDir = git(['rev-parse', '--absolute-git-dir']).trim();
  const idx = path.join(opt.report, 'index-' + label);
  const env = Object.assign({}, process.env, { GIT_INDEX_FILE: idx });
  git(['read-tree', START], { env });
  git(['add', '-A', '.'], { cwd: opt.out, env: Object.assign({}, env, { GIT_DIR: gitDir, GIT_WORK_TREE: opt.out }) });
  const tree = git(['write-tree'], { env }).trim();
  fs.unlinkSync(idx);
  return tree;
}

/* ------------------------------------------------------------ the run */
fs.mkdirSync(opt.report, { recursive: true });
fs.mkdirSync(logsDir());
const START = git(['rev-parse', 'HEAD']).trim();
const BRANCH = git(['symbolic-ref', '-q', 'HEAD'], { allowFail: true }).trim();
let TREE = null, NEWV = null, HEADV = null, VERREC = null;
const t0 = Date.now();
const testRows = [];
const copiedSha = new Map();

function finish() {
  const lines = [];
  lines.push('release.js ' + new Date().toString().replace(/ \(.*\)$/, '') + '  (' + ((Date.now() - t0) / 60000).toFixed(1) + ' min)');
  lines.push('HEAD     ' + START + (BRANCH ? ' (' + BRANCH + ')' : ''));
  lines.push('export   ' + opt.out);
  lines.push('sw.js    ' + (NEWV ? '1234tools-v' + HEADV + ' -> 1234tools-v' + NEWV : 'not set'));
  lines.push('version  ' + (VERREC ? JSON.stringify(VERREC) : 'not written'));
  lines.push('tree     ' + (TREE || 'not built'));
  lines.push('');
  lines.push(...summary);
  if (testRows.length) {
    lines.push('', pad('suite', 16) + pad('port', 6) + pad('passed', 8) + pad('failed', 8) + pad('known', 7) + pad('exit', 6) + pad('secs', 7) + 'status');
    for (const r of testRows) {
      lines.push(pad(r.suite, 16) + pad(r.port || '-', 6) + pad(r.passed == null ? '?' : r.passed, 8) + pad(r.failed == null ? '?' : r.failed, 8) +
        pad(r.known || '-', 7) + pad(r.status == null ? '-' : r.status, 6) + pad(r.secs.toFixed(0), 7) + r.result);
    }
  }
  if (notes.length) lines.push('', 'notes:', ...notes.map((n) => '  ' + n));
  lines.push('', failures.length ? 'FAILED (' + failures.length + '):' : 'ALL CLEAN', ...failures.map((f) => '  - ' + f));
  const text = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(opt.report, 'summary.txt'), text);
  console.log('\n' + '='.repeat(72) + '\n' + text + '\nsummary: ' + path.join(opt.report, 'summary.txt'));
  process.exit(failures.length ? 1 : 0);
}

try {
  /* 1. export */
  console.log('[1] export HEAD ' + START.slice(0, 9) + ' -> ' + opt.out);
  const modified = zlist(git(['diff', '--name-only', '-z', START]));
  const untracked = zlist(git(['ls-files', '-o', '--exclude-standard', '-z']));
  const all = Array.from(new Set(modified.concat(untracked))).sort();
  const used = new Set();
  const isExcluded = (f) => opt.exclude.some((e) => {
    const hit = e.endsWith('/') ? f.startsWith(e) : f === e;
    if (hit) used.add(e);
    return hit;
  });
  /* A working-tree file still holding the PREVIOUS commit's version of a file
     HEAD changed is almost always the step after a release not done yet
     (the printed `git checkout HEAD --pathspec-from-file`). Copying it would
     quietly revert that release, so stop unless --allow-revert. */
  if (gitOk(['rev-parse', '-q', '--verify', START + '^1'])) {
    const blobs = (rev) => {
      const m = new Map();
      for (const e of zlist(git(['ls-tree', '-r', '-z', rev]))) { const t = e.indexOf('\t'); m.set(e.slice(t + 1), e.slice(0, t).split(' ')[2]); }
      return m;
    };
    const headB = blobs(START), parentB = blobs(START + '^1');
    const cand = all.filter((f) => !isExcluded(f) && headB.has(f) && parentB.has(f) && headB.get(f) !== parentB.get(f) && fs.existsSync(path.join(REPO, f)));
    if (cand.length) {
      const r = spawnSync('git', ['hash-object', '--stdin-paths'], { cwd: REPO, input: cand.join('\n') + '\n', encoding: 'utf8', maxBuffer: 1 << 28 });
      if (r.status !== 0) throw new Error('git hash-object failed: ' + r.stderr);
      const ids = String(r.stdout).trim().split('\n');
      const stale = cand.filter((f, i) => ids[i] === parentB.get(f));
      if (stale.length) {
        fs.writeFileSync(path.join(opt.report, 'stale.txt'), stale.join('\n') + '\n');
        const msg = stale.length + ' working-tree file(s) still hold the version before HEAD (' + START.slice(0, 9) +
          '), e.g. ' + stale.slice(0, 5).join(', ') + ' (all in stale.txt); was the checkout after the last release skipped?';
        if (!opt.allowRevert) throw new Error(msg + ' Run it, or pass --allow-revert to release them anyway');
        note(msg + ' Copied anyway (--allow-revert)');
      }
    }
  }

  fs.mkdirSync(opt.out, { recursive: true });
  const tar = path.join(opt.report, 'head.tar');
  git(['archive', '--format=tar', '-o', tar, START]);
  /* Windows' own bsdtar first: GNU tar reads "E:/x.tar" as host E. With cwd
     set to the report folder the archive name has no drive letter anyway. */
  const sysTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  const tarExe = process.platform === 'win32' && fs.existsSync(sysTar) ? sysTar : 'tar';
  const tr = spawnSync(tarExe, ['-xf', 'head.tar', '-C', opt.out], { cwd: opt.report, encoding: 'utf8', windowsHide: true });
  if (tr.status !== 0) throw new Error('tar failed: ' + (tr.stderr || (tr.error && tr.error.message)));
  fs.unlinkSync(tar);

  const copied = [], deleted = [], excluded = [];
  for (const f of all) {
    if (isExcluded(f)) { excluded.push(f); continue; }
    const src = path.join(REPO, f), dst = path.join(opt.out, f);
    if (!fs.existsSync(src)) { if (fs.existsSync(dst)) fs.unlinkSync(dst); deleted.push(f); continue; }
    if (!fs.statSync(src).isFile()) { note('not a regular file, skipped: ' + f); continue; }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    copiedSha.set(f, sha1(src));
    copied.push(f);
  }
  opt.exclude.filter((e) => !used.has(e)).forEach((e) => note('--exclude ' + e + ' matched nothing'));
  fs.writeFileSync(path.join(opt.report, 'copied.txt'), copied.join('\n') + '\n');
  fs.writeFileSync(path.join(opt.report, 'copied.sha1'), copied.map((f) => copiedSha.get(f) + '  ' + f).join('\n') + '\n');
  fs.writeFileSync(path.join(opt.report, 'excluded.txt'), excluded.join('\n') + (excluded.length ? '\n' : ''));
  fs.writeFileSync(path.join(opt.report, 'deleted.txt'), deleted.join('\n') + (deleted.length ? '\n' : ''));
  say('export   ' + copied.length + ' working-tree file(s) copied, ' + deleted.length + ' deleted, ' + excluded.length + ' excluded (lists in ' + opt.report + ')');

  /* 2. sw.js starts from HEAD's V */
  HEADV = swOf(git(['show', START + ':sw.js']));
  setSw(HEADV);

  /* 3. generators */
  const want = (g) => opt.gens.has(g) || (opt.allGenerators && !ONCE.some((o) => o[0] === g));
  const gens = ONCE.concat(GENERATORS).filter((g) => want(g[0]));
  /* build-collections links the showcase only once showcase/index.html
     exists (showcaseLive()), so with both it runs again after the showcase. */
  const sc = gens.findIndex((g) => g[0] === 'showcase');
  if (sc >= 0 && gens.some((g) => g[0] === 'collections')) gens.splice(sc + 1, 0, ['collections-again', 'build-collections.js']);
  console.log('[2] generators: ' + (gens.map((g) => g[0]).join(' ') || 'none'));
  for (const [name, script, args] of gens) {
    const abs = path.join(opt.out, script);
    if (!fs.existsSync(abs)) { note(script + ' is not in the export; skipped'); continue; }
    const r = runNode('gen-' + name, abs, args, opt.out);
    const n = changedCount(r.out);
    say('gen      ' + pad(script, 22) + (n == null ? '?' : n) + ' changed  (' + r.secs.toFixed(0) + ' s)');
    if (r.status !== 0) { fail(script + ' exited ' + r.status + '; see ' + r.log + tailOf(r.out)); throw new Error('stopping after a failed generator'); }
  }

  /* 4. post-processor chain, twice */
  for (const pass of [1, 2]) {
    console.log('[3] post-processor chain, pass ' + pass);
    const counts = [];
    for (const name of CHAIN) {
      const r = runNode('p' + pass + '-' + name, path.join(opt.out, 'build-' + name + '.js'), [], opt.out);
      const n = changedCount(r.out);
      counts.push(name + '=' + (n == null ? '?' : n));
      if (r.status !== 0) { fail('pass ' + pass + ' build-' + name + '.js exited ' + r.status + '; see ' + r.log + tailOf(r.out)); throw new Error('stopping after a failed post-processor'); }
      if (pass === 2 && n !== 0) fail('pass 2: build-' + name + '.js ' + (n == null ? 'printed no "file(s) changed" count' : 'changed ' + n + ' file(s)') + '; see ' + r.log);
    }
    say('chain ' + pass + '  ' + counts.join(' '));
  }

  /* 5. sw.js = live + 1 */
  let live = null;
  if (opt.sw) { NEWV = opt.sw; say('sw.js    --sw ' + opt.sw); }
  else {
    const ls = git(['ls-remote', 'origin', 'refs/heads/main']).trim().split(/\s+/)[0];
    if (!/^[0-9a-f]{40}$/.test(ls)) throw new Error('git ls-remote origin refs/heads/main gave nothing; pass --sw <n>');
    if (!gitOk(['cat-file', '-e', ls + '^{commit}'])) {
      if (opt.noFetch) throw new Error('origin main is ' + ls + ', which is not local; fetch, or pass --sw <n>');
      console.log('  fetching origin main (the live commit is not local)');
      git(['fetch', '-q', 'origin', 'main']);
    }
    const tracking = git(['rev-parse', '-q', '--verify', 'refs/remotes/origin/main'], { allowFail: true }).trim();
    if (tracking && tracking !== ls) note('refs/remotes/origin/main is ' + tracking.slice(0, 9) + ' but origin main is ' + ls.slice(0, 9) + '; used the latter');
    live = swOf(git(['show', ls + ':sw.js']));
    NEWV = live + 1;
    say('sw.js    live (origin main ' + ls.slice(0, 9) + ') is v' + live + '; set v' + NEWV);
  }
  if (NEWV <= HEADV) note('new sw.js V ' + NEWV + ' is not above HEAD\'s ' + HEADV);
  setSw(NEWV);

  /* 5a. the footer's version record, with the same number: v = the cache
     name just set, the date of this run, and built_on = START, the parent
     of the commit --commit makes (that commit's id is not known yet) */
  if (fs.existsSync(path.join(opt.out, versionRecord.FILE))) {
    VERREC = versionRecord.write(opt.out, { v: NEWV, date: versionRecord.today(), built_on: START.slice(0, 9) });
    say('version  ' + versionRecord.FILE + ' ' + JSON.stringify(VERREC));
  } else note(versionRecord.FILE + ' is not in the export; no version record written');

  /* 5b. hosting limits: every file over 24 MiB split into parts its loader
     reads (Cloudflare refuses files over 25 MiB), and Cloudflare's
     _redirects rebuilt from the old-URL stubs */
  for (const [name, script] of [['split-models', 'build/split-models.js'], ['cf-redirects', 'build/cf-redirects.js']]) {
    const abs = path.join(opt.out, script);
    if (!fs.existsSync(abs)) { note(script + ' is not in the export; skipped'); continue; }
    const r = runNode(name, abs, ['--root', opt.out], opt.out);
    say(pad(name, 13) + (r.out.trim().split('\n').pop() || '') + '  (' + r.secs.toFixed(0) + ' s)');
    if (r.status !== 0) fail(script + ' exited ' + r.status + '; see ' + r.log + tailOf(r.out));
  }

  /* 6. tree audit + 0x08 scan */
  console.log('[4] tree audit');
  TREE = buildTree('a');
  fs.writeFileSync(path.join(opt.report, 'tree'), TREE + '\n');
  const stat = git(['diff', '--stat=160', START, TREE]);
  const nameStatus = git(['diff', '--no-renames', '--name-status', START, TREE]);
  fs.writeFileSync(path.join(opt.report, 'changed.txt'), nameStatus);
  fs.writeFileSync(path.join(opt.report, 'diffstat.txt'), stat);
  say('tree     ' + TREE + '  vs HEAD: ' + (stat.trim().split('\n').pop() || 'no change').trim());
  const numstat = zlist(git(['diff', '--no-renames', '--numstat', '-z', START, TREE]));
  let scanned = 0;
  for (const rec of numstat) {
    const m = /^(\S+)\t(\S+)\t(.+)$/s.exec(rec);
    if (!m || m[1] === '-') continue; // binary
    const f = m[3], abs = path.join(opt.out, f);
    if (!fs.existsSync(abs)) continue;
    scanned++;
    if (!BS_ALLOWED.has(f) && fs.readFileSync(abs).includes(0x08)) fail('0x08 byte in ' + f);
  }
  say('0x08     ' + scanned + ' changed text file(s) scanned');

  /* 7. tests */
  if (opt.test) {
    console.log('[5] tests');
    const tmo = opt.testTimeout * 60000;
    let next = opt.ports[0];
    const takePort = () => {
      while (next <= opt.ports[1]) { const p = next++; if (!portBusy(p)) return p; note('port ' + p + ' busy, skipped'); }
      return null;
    };
    const suites = [];
    for (const t of ['share', 'proof', 'depth', 'conversions', 'hubs-nav', 'home-finder', 'dev-fixes', 'pdf-fixes', 'image-fixes', 'claims', 'footer', 'version']) {
      if (fs.existsSync(path.join(REPO, 'build/tests', t + '.js'))) suites.push({ suite: t, script: 'build/tests/' + t + '.js', port: true });
    }
    suites.push({ suite: 'engines', script: 'build/tests/engines.js', args: ['--root', opt.out] });
    for (const t of ['reel-maker', 'auto-captions', 'reel-voice']) suites.push({ suite: t, script: 'build/ai-video/tests/' + t + '.js', port: true });
    suites.push({ suite: 'tts-g2p', script: 'build/ai-video/tests/tts-g2p.js', args: ['--root', opt.out] });
    suites.push({ suite: 'content-check', script: 'build/content/_check.js', inExport: true,
      parse: (o) => { const m = /(\d+) page\(s\)[^\n]*?(\d+) error\(s\)/.exec(o); return m && { passed: +m[1] - +m[2], failed: +m[2] }; } });
    suites.push({ suite: 'test_pdfcore', script: 'build/pdf-package/tests/test_pdfcore.js', inExport: true });
    suites.push({ suite: 'test_pdftools', script: 'build/pdf-package/tests/test_pdftools.js', inExport: true });
    suites.push({ suite: 'promo-test', script: 'build/promo/test.js', fixedPort: 8796 });
    suites.push({ suite: 'promo-test-ui', script: 'build/promo/test-ui.js', envPort: 'PROMO_UI_PORT' });
    suites.push({ suite: 'promo-test-kit', script: 'build/promo/test-kit.js' });
    /* The pdf-package suites read build/pdf-package/tests/fixtures/, which
       .gitignore keeps out of git (so out of git archive too). Copy the
       repo's; being ignored, they cannot reach the tree (re-checked below). */
    const fx = 'build/pdf-package/tests/fixtures';
    if (fs.existsSync(path.join(REPO, fx)) && !fs.existsSync(path.join(opt.out, fx))) {
      fs.cpSync(path.join(REPO, fx), path.join(opt.out, fx), { recursive: true });
      note('copied the git-ignored ' + fx + '/ into the export for test_pdfcore and test_pdftools');
    }
    if (opt.only) {
      for (const n of opt.only) if (!suites.some((s) => s.suite === n)) note('--tests: no suite called ' + n);
    }
    for (const s of suites) {
      if (opt.only && !opt.only.has(s.suite)) continue;
      const row = { suite: s.suite, port: null, passed: null, failed: null, known: opt.knownFailures[s.suite] || 0, status: null, secs: 0, result: '' };
      testRows.push(row);
      let args = (s.args || []).slice(), env = {};
      if (s.port || s.envPort) {
        row.port = takePort();
        if (row.port == null) { row.result = 'FAIL (no free port left in --ports)'; fail(s.suite + ': no free port left in --ports'); continue; }
      }
      if (s.port) args.push('--root', opt.out, '--out', path.join(opt.report, 'tests', s.suite), '--port', String(row.port));
      if (s.envPort) env[s.envPort] = String(row.port);
      if (s.fixedPort) {
        row.port = s.fixedPort;
        if (portBusy(s.fixedPort)) { row.result = 'FAIL (its fixed port ' + s.fixedPort + ' is busy)'; fail(s.suite + ': fixed port ' + s.fixedPort + ' is in use by something else'); continue; }
      }
      const cwd = s.inExport ? opt.out : REPO;
      const script = path.join(cwd, s.script);
      process.stdout.write('  ' + pad(s.suite, 16));
      const r = runNode('test-' + s.suite, script, args, cwd, env, tmo);
      row.status = r.timedOut ? 'tmo' : r.status; row.secs = r.secs;
      const c = (s.parse && s.parse(r.out)) || parseCounts(r.out);
      if (c) { row.passed = c.passed; row.failed = c.failed; }
      let ok;
      if (r.timedOut) { ok = false; row.result = 'FAIL (timed out after ' + opt.testTimeout + ' min)'; }
      else if (!c) { ok = false; row.result = 'FAIL (no pass/fail count in the output)'; }
      else if (c.failed === 0 && r.status === 0) { ok = true; row.result = 'ok'; }
      else if (c.failed > 0 && c.failed <= row.known) { ok = true; row.result = 'ok (known failures)'; }
      else if (c.failed === 0) { ok = false; row.result = 'FAIL (exit ' + r.status + ' with 0 failures counted)'; }
      else { ok = false; row.result = 'FAIL'; }
      if (ok && row.known && c && c.failed < row.known) note(s.suite + ': ' + c.failed + ' failure(s), fewer than the ' + row.known + ' allowed; lower --known-failures');
      console.log(pad(row.passed == null ? '?' : row.passed, 6) + ' passed  ' + pad(row.failed == null ? '?' : row.failed, 4) + ' failed  ' + row.result);
      if (!ok) fail('test ' + s.suite + ': ' + row.result + '; log ' + r.log + tailOf(r.out.split('\n').filter((l) => /FAIL|ERROR|rror:|crash/i.test(l)).slice(-6).join('\n') || r.out));
    }
    /* The release is the tree from step 6; a suite that wrote into the export
       would make that tree a lie, so check. */
    const after = buildTree('b');
    if (after !== TREE) fail('the tests changed the export: ' + git(['diff', '--name-status', TREE, after]).trim().split('\n').join(', '));
  }

  /* 8. commit (opt-in) */
  if (opt.commit) {
    if (failures.length) { fail('--commit refused: the run has failures'); }
    else commit();
  } else {
    say('commit   not requested (dry run); the tree above is what --commit would commit');
    if (TREE) {
      const plan = planCheckout();
      say('checkout ' + plan.take.length + ' path(s) would be checked out after a commit (checkout-paths.txt); ' +
        plan.held.length + ' held back as the working tree differs from this export\'s input (held-back.txt)' +
        (plan.held.length ? ': ' + plan.held.slice(0, 12).join(', ') + (plan.held.length > 12 ? ', ...' : '') : ''));
    }
  }
} catch (e) {
  fail('stopped: ' + (e && e.message || e));
}
finish();

function parseCounts(out) {
  let m, last = null;
  const re = /(\d+)\s+pass(?:ed)?\b[,\s]+(\d+)\s+fail(?:ed)?\b/gi;
  while ((m = re.exec(out))) last = { passed: +m[1], failed: +m[2] };
  if (last) return last;
  const ok = (out.match(/^\s*(?:ok|PASS)\b/gm) || []).length;
  const bad = (out.match(/^\s*FAIL\b/gm) || []).length;
  return ok + bad ? { passed: ok, failed: bad } : null;
}

/** Which paths the tree changes can safely take the committed version in the
 *  working tree afterwards: those whose working-tree file is still the input
 *  this export was built from (the copied bytes, or HEAD's for files not
 *  copied). Anything else (edited since the copy, or excluded and different)
 *  would be lost, so it is held back. Writes checkout-paths.txt and
 *  held-back.txt to the report folder. */
function planCheckout() {
  const wtChanged = new Set(zlist(git(['diff', '--name-only', '-z', START])).concat(zlist(git(['ls-files', '-o', '--exclude-standard', '-z']))));
  const ns = zlist(git(['diff', '--no-renames', '--name-status', '-z', START, TREE]));
  const take = [], held = [];
  for (let i = 0; i + 1 < ns.length; i += 2) {
    const st = ns[i], f = ns[i + 1];
    if (st === 'D') continue;
    const wt = path.join(REPO, f);
    const safe = copiedSha.has(f) ? fs.existsSync(wt) && sha1(wt) === copiedSha.get(f) : !wtChanged.has(f);
    (safe ? take : held).push(f);
  }
  const list = path.join(opt.report, 'checkout-paths.txt');
  fs.writeFileSync(list, take.join('\n') + (take.length ? '\n' : ''));
  fs.writeFileSync(path.join(opt.report, 'held-back.txt'), held.join('\n') + (held.length ? '\n' : ''));
  return { take, held, list };
}

function commit() {
  console.log('[6] commit');
  const head = git(['rev-parse', 'HEAD']).trim();
  if (head !== START) return fail('--commit refused: HEAD moved from ' + START.slice(0, 9) + ' to ' + head.slice(0, 9) + ' during the run');
  if (BRANCH !== 'refs/heads/main') return fail('--commit refused: HEAD is ' + (BRANCH || 'detached') + ', not refs/heads/main');

  if (git(['rev-parse', START + '^{tree}']).trim() === TREE) return fail('--commit refused: the tree is HEAD\'s, nothing to commit');
  const plan = planCheckout();
  const c = git(['commit-tree', TREE, '-p', START, '-F', opt.msgFile]).trim();
  git(['update-ref', '-m', 'release.js', 'refs/heads/main', c, START]);
  git(['reset', '-q', '--mixed', 'HEAD']);
  say('commit   ' + c + ' on main (parent ' + START.slice(0, 9) + '); index reset to it; working tree untouched');
  if (plan.held.length) say('held     ' + plan.held.length + ' path(s) left out of the checkout list (see held-back.txt): ' + plan.held.join(', '));
  const list = plan.list;
  say('next, by hand:');
  say('  git checkout HEAD --pathspec-from-file="' + list.replace(/\\/g, '/') + '"');
  say('  git push origin main');
  say('  git ls-remote origin refs/heads/main      # must print ' + c);
}
