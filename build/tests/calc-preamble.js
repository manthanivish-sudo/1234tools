#!/usr/bin/env node
/**
 * The calculator preamble removal (build/strip-calc-preamble.js) changes
 * nothing a calculator computes.
 *
 *   node build/tests/calc-preamble.js [--root DIR] [--before COMMIT] [--repo GIT_DIR] [--no-replay]
 *
 * --root    the site whose engines are "after" (default: the one this file sits in)
 * --repo    also gives the engines.js that is replayed (its own regression
 *           checks read git); --no-replay skips that run
 * --before  the commit whose engines are "before" (default 364240974, the
 *           last commit with the preamble in every file), read with
 *           `git show` from --repo (default: the checkout this file sits in)
 *
 * Every engine/calc-*.js is loaded twice, the "before" source and the
 * "after" one, each in a fresh vm context with the stub window that
 * build/content/_engine.js uses (the clock pinned to one instant in both,
 * so "today" is the same, and Math.random seeded afresh before every call,
 * so the random tools draw the same numbers), and:
 *
 *   1. the after file is exactly the before file run through strip() —
 *      only the preamble went, or nothing did; the one allowance is a spec
 *      line of page text (title, description, keywords, tips, FAQ) edited
 *      in place, which is listed (the currency converter's description
 *      changed in the same wave);
 *   2. both define the same tools, with the same specs apart from compute
 *      (inputs, outputs, tips, FAQ … compared value by value);
 *   3. compute() gives the same result, value by value (NaN, -0, Infinity,
 *      dates and nested tables included), or throws the same message, on:
 *        - every input object build/tests/engines.js passes to compute()
 *          (it is run here, against --root, with a recorder preloaded, and
 *          must itself pass);
 *        - each tool's defaults;
 *        - each page's captured example (assets/examples.js, its "try"
 *          values) and its worked example and checks (build/content/*.js);
 *        - 40 seeded mixes per tool: random select options, and numbers
 *          drawn from the default, half and double it, 0, 1, -1 and the
 *          input's min and max.
 *
 * Exit code 2 when anything differs, 1 when the run itself breaks.
 *
 * When CALC_PREAMBLE_REC is set this file is the recorder instead: preloaded
 * with -r, it wraps every compute() that a vm-loaded engine defines and
 * appends each input object (v8-serialised) to that file.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const v8 = require('v8');

/* ---------------- the recorder (preloaded into engines.js) ---------------- */

if (process.env.CALC_PREAMBLE_REC) {
  const out = process.env.CALC_PREAMBLE_REC;
  const lines = [];
  const seen = new Set();
  const wrapped = new WeakSet();
  const orig = vm.runInContext;
  vm.runInContext = function (code, ctx) {
    const r = orig.apply(this, arguments);
    try {
      const T = ctx && ctx.window && ctx.window.TOOLS;
      if (T) {
        for (const slug of Object.keys(T)) {
          const spec = T[slug];
          if (!spec || typeof spec.compute !== 'function' || wrapped.has(spec)) continue;
          wrapped.add(spec);
          const compute = spec.compute;
          spec.compute = function (vals) {
            try {
              const b64 = v8.serialize(vals).toString('base64');
              const key = slug + '\t' + b64;
              if (!seen.has(key) && seen.size < 200000) { seen.add(key); lines.push(key); }
            } catch (e) { /* not serialisable: not recorded */ }
            return compute.apply(this, arguments);
          };
        }
      }
    } catch (e) { /* never disturb the run */ }
    return r;
  };
  process.on('exit', () => { try { fs.appendFileSync(out, lines.join('\n') + (lines.length ? '\n' : '')); } catch (e) { /* nothing */ } });
  return;
}

if (require.main !== module) return;

/* ---------------- the test ---------------- */

process.env.TZ = 'Europe/London';                    // as engines.js, before any Date is made
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const REPO = path.resolve(arg('--repo', path.join(__dirname, '..', '..')));
const BEFORE = arg('--before', '364240974');
const REPLAY = !argv.includes('--no-replay');
const PIN = Date.UTC(2026, 9, 6, 11, 0, 0);          // 6 October 2026, 12:00 in London

const { strip } = require(path.join(ROOT, 'build', 'strip-calc-preamble.js'));

let pass = 0, fail = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (!ok && detail !== undefined ? '   (' + String(detail).slice(0, 600) + ')' : ''));
}

/* the stub window of build/content/_engine.js, with the clock pinned */
function pinnedDate(ms) {
  class Pinned extends Date {
    constructor(...a) { if (a.length === 0) super(ms); else super(...a); }
    static now() { return ms; }
  }
  return Pinned;
}
/* Math with a seeded random, reset before every call, so the dice roller
   and the other random tools draw the same numbers before and after. */
let seed = 1;
const SeededMath = Object.create(Math, { random: { value: () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; } } });
function load(src, filename) {
  const window = { TOOLS: {} };
  const ctx = vm.createContext({ window, console, Intl, Math: SeededMath, Date: pinnedDate(PIN), Number, String, Array, Object, JSON, isFinite, isNaN, parseFloat, parseInt });
  vm.runInContext(src, ctx, { filename });
  return window.TOOLS;
}

/* A value written out in full, the same way whichever vm made it. */
function canon(v, seen) {
  seen = seen || new Set();
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'number') return Object.is(v, -0) ? '-0' : Number.isNaN(v) ? 'NaN' : String(v);
  if (t === 'string') return JSON.stringify(v);
  if (t === 'boolean' || t === 'bigint') return String(v) + (t === 'bigint' ? 'n' : '');
  if (t === 'function') return 'fn(' + Function.prototype.toString.call(v) + ')';
  if (t === 'symbol') return String(v);
  if (seen.has(v)) return '[cycle]';
  seen.add(v);
  const tag = Object.prototype.toString.call(v);
  let s;
  if (tag === '[object Date]') s = 'Date(' + Date.prototype.getTime.call(v) + ')';
  else if (Array.isArray(v)) s = '[' + v.map((x) => canon(x, seen)).join(',') + ']';
  else s = '{' + Object.keys(v).map((k) => JSON.stringify(k) + ':' + canon(v[k], seen)).join(',') + '}';
  seen.delete(v);
  return s;
}
function result(spec, buf) {
  const vals = v8.deserialize(buf);                 // a fresh copy for every call
  seed = 0x9e3779b9;
  try { return canon(spec.compute(vals)); }
  catch (e) { return 'threw ' + (e && e.message); }
}
const specWithoutCompute = (spec) => { const o = {}; Object.keys(spec).forEach((k) => { if (k !== 'compute') o[k] = spec[k]; }); return canon(o); };

function gitShow(rel) {
  try { return execFileSync('git', ['-C', REPO, 'show', BEFORE + ':' + rel], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); }
  catch (e) { return null; }
}

/* ---------- the inputs ---------- */

const inputs = new Map();                            // slug -> Map(b64 -> Buffer)
function addInput(slug, vals) {
  let buf;
  try { buf = v8.serialize(vals); } catch (e) { return; }
  if (!inputs.has(slug)) inputs.set(slug, new Map());
  const m = inputs.get(slug);
  const k = buf.toString('base64');
  if (!m.has(k)) m.set(k, buf);
}
function withDefaults(spec, given) {
  const vals = {};
  (spec.inputs || []).forEach((i) => {
    let d = i.default;
    if (i.type === 'number') d = d === null || d === undefined || d === '' ? null : Number(d);
    vals[i.key] = d;
  });
  return Object.assign(vals, given || {});
}

(function main() {
  console.log('calc-preamble  root ' + ROOT + '  before = ' + BEFORE + ' (git ' + REPO + ')');
  const files = fs.readdirSync(path.join(ROOT, 'engine')).filter((f) => /^calc-.*\.js$/.test(f)).sort();

  /* 1, 2: the sources and the specs */
  console.log('\n--- 1, 2  sources and specs');
  const before = new Map(), after = new Map();
  let identical = 0, stripped = 0, wrong = [], specDiff = [], missing = [], textOnly = [], later = [];
  const TEXT_LINE = /^"(title|description|keywords|tips|faq)": /;
  const TEXT_KEYS = ['title', 'description', 'keywords', 'tips', 'faq'];
  const specText = (spec) => { const o = {}; Object.keys(spec).forEach((k) => { if (k !== 'compute' && TEXT_KEYS.indexOf(k) < 0) o[k] = spec[k]; }); return canon(o); };
  for (const f of files) {
    const rel = 'engine/' + f;
    const a = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const b = gitShow(rel);
    if (b === null) { missing.push(f); continue; }
    if (a === b) identical++;
    else if (a === strip(b)) stripped++;
    else {
      /* Stripped, and a page-text line of the spec edited since (the
         currency converter's description, in the same wave): allowed only
         when the files line up and every other line is the same. */
      const sl = strip(b).split('\n'), al = a.split('\n');
      const changed = sl.length === al.length ? al.map((l, i) => l === sl[i] ? null : l).filter((l) => l !== null) : null;
      if (changed && changed.length && changed.every((l) => TEXT_LINE.test(l))) { textOnly.push(f + ' (' + changed.map((l) => TEXT_LINE.exec(l)[1]).join(', ') + ')'); stripped++; }
      /* Rewritten since by a later wave (wave 5 rewrote several calculators):
         the proof is then about strip() itself, so the before file run
         through strip() stands in as "after", and the file on disk must still
         not carry back a preamble that strip() would remove. */
      else if (strip(a) === a) later.push(f);
      else wrong.push(f);
    }
    let A, B;
    const isLater = later.indexOf(f) >= 0;
    try { A = load(isLater ? strip(b) : a, rel); } catch (e) { check(false, f + ' (after) loads', e.message); continue; }
    try { B = load(b, BEFORE + ':' + rel); } catch (e) { check(false, f + ' (before) loads', e.message); continue; }
    after.set(f, A); before.set(f, B);
    const ka = Object.keys(A).sort().join(), kb = Object.keys(B).sort().join();
    if (ka !== kb) specDiff.push(f + ': tools ' + kb + ' -> ' + ka);
    else {
      const textEdited = textOnly.some((t) => t.indexOf(f + ' ') === 0);
      for (const slug of Object.keys(A)) {
        if ((textEdited ? specText : specWithoutCompute)(A[slug]) !== (textEdited ? specText : specWithoutCompute)(B[slug])) specDiff.push(f + ' ' + slug);
      }
    }
  }
  check(missing.length === 0, 'every engine exists at ' + BEFORE + ' (' + files.length + ' files)', missing.join(', '));
  if (textOnly.length) console.log('      stripped, and spec page text edited since: ' + textOnly.join('; '));
  if (later.length) console.log('      rewritten since, checked as strip(before) and for no preamble come back: ' + later.join(', '));
  check(wrong.length === 0, 'each engine is either unchanged (' + identical + '), exactly the before file with its preamble stripped (' + stripped + '), or rewritten since with no unused preamble (' + later.length + ')', wrong.join(', '));
  check(specDiff.length === 0 && after.size === files.length - missing.length, 'the same tools with the same specs (compute aside) in all ' + after.size + ' engines', specDiff.join(' | '));

  /* 3: the inputs */
  console.log('\n--- 3  compute(), before and after');
  let replayed = 0;
  if (REPLAY) {
    /* the engines.js that goes with the engines under test (the one in --root),
       given the git checkout for its own "before" checks; the checkout's copy
       only when --root has none */
    const own = path.join(ROOT, 'build', 'tests', 'engines.js');
    const enginesJs = fs.existsSync(own) ? own : fs.existsSync(path.join(REPO, 'build', 'tests', 'engines.js')) ? path.join(REPO, 'build', 'tests', 'engines.js') : path.join(__dirname, 'engines.js');
    const rec = path.join(os.tmpdir(), 'calc-preamble-rec-' + process.pid + '.txt');
    try { fs.unlinkSync(rec); } catch (e) { /* none */ }
    const env = Object.assign({}, process.env, { CALC_PREAMBLE_REC: rec, NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' -r "' + __filename.replace(/\\/g, '/') + '"').trim() });
    const r = spawnSync(process.execPath, [enginesJs, '--root', ROOT, '--repo', REPO], { env, encoding: 'utf8', maxBuffer: 256 << 20 });
    const tail = String(r.stdout || '').trim().split('\n').pop();
    check(r.status === 0 && / 0 failed/.test(tail), 'build/tests/engines.js --root passes with the recorder in it: ' + tail, (r.stderr || '').slice(-400));
    const text = fs.existsSync(rec) ? fs.readFileSync(rec, 'utf8') : '';
    try { fs.unlinkSync(rec); } catch (e) { /* none */ }
    for (const line of text.split('\n')) {
      if (!line) continue;
      const t = line.indexOf('\t');
      const slug = line.slice(0, t), buf = Buffer.from(line.slice(t + 1), 'base64');
      if (!inputs.has(slug)) inputs.set(slug, new Map());
      const m = inputs.get(slug);
      if (!m.has(line.slice(t + 1))) { m.set(line.slice(t + 1), buf); replayed++; }
    }
    check(replayed > 0, 'engines.js passed ' + replayed + ' distinct input objects to ' + inputs.size + ' tools');
  }
  // defaults
  const specOf = new Map();
  for (const [f, T] of after) for (const slug of Object.keys(T)) { specOf.set(slug, f); if (typeof T[slug].compute === 'function') addInput(slug, withDefaults(T[slug])); }
  // the captured examples and the worked examples, by page
  const { pageEngine } = require(path.join(ROOT, 'build', 'content', '_engine.js'));
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets', 'examples.js'), 'utf8'))(w);
  const EX = w.TOOL_EXAMPLES || {};
  let exN = 0, workedN = 0;
  const specForPage = (url) => {
    try { const e = pageEngine(url, ROOT); const T = after.get(path.basename(e.file)); return T && T[e.slug] ? { slug: e.slug, spec: T[e.slug] } : null; }
    catch (e) { return null; }
  };
  for (const url of Object.keys(EX)) {
    const ex = EX[url];
    if (ex.kind !== 'calc' || !ex.try) continue;
    const s = specForPage(url);
    if (!s || typeof s.spec.compute !== 'function') continue;
    const given = {};
    const types = new Map((s.spec.inputs || []).map((i) => [i.key, i.type]));
    for (const [k, v] of new URLSearchParams(String(ex.try).replace(/^#/, ''))) given[k] = types.get(k) === 'number' ? Number(v) : v;
    addInput(s.slug, withDefaults(s.spec, given)); exN++;
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'build', 'content')).filter((x) => /^[a-z].*\.js$/.test(x))) {
    let C;
    try { C = require(path.join(ROOT, 'build', 'content', f)); } catch (e) { continue; }
    for (const url of Object.keys(C || {})) {
      const d = C[url];
      if (!d || d.howItWorks) continue;
      const s = specForPage(url);
      if (!s || typeof s.spec.compute !== 'function') continue;
      const sets = [];
      if (d.worked && d.worked.inputs) sets.push(d.worked.inputs);
      (d.checks || []).forEach((c) => { if (c.inputs) sets.push(c.inputs); });
      sets.forEach((x) => { addInput(s.slug, withDefaults(s.spec, x)); workedN++; });
    }
  }
  // and 40 seeded mixes per tool: every select option, numbers around the default, zero, negatives and the limits
  let mixN = 0, ms = 12345;
  const rnd = () => { ms ^= ms << 13; ms >>>= 0; ms ^= ms >>> 17; ms ^= ms << 5; ms >>>= 0; return ms / 4294967296; };
  for (const [f, T] of after) {
    for (const slug of Object.keys(T)) {
      const spec = T[slug];
      if (typeof spec.compute !== 'function') continue;
      for (let n = 0; n < 40; n++) {
        const given = {};
        (spec.inputs || []).forEach((i) => {
          if (i.type === 'select' && (i.options || []).length) given[i.key] = i.options[Math.floor(rnd() * i.options.length)].value;
          else if (i.type === 'number') {
            const d = Number(i.default) || 0;
            const pool = [d, 0, 1, -1, d / 2, d * 2, Math.round(d * 1.37 * 100) / 100,
              i.min !== undefined ? Number(i.min) : d, i.max !== undefined ? Number(i.max) : d * 10, Math.round(rnd() * Math.max(10, Math.abs(d) * 3))];
            given[i.key] = pool[Math.floor(rnd() * pool.length)];
          }
        });
        addInput(slug, withDefaults(spec, given)); mixN++;
      }
    }
  }
  console.log('      inputs: ' + replayed + ' from engines.js, ' + specOf.size + ' tools\' defaults, ' + exN + ' captured examples, ' + workedN + ' worked examples and checks, ' + mixN + ' seeded mixes');

  // compare
  let calls = 0, diffs = [], perFile = new Map();
  for (const [slug, m] of inputs) {
    const f = specOf.get(slug);
    if (!f) continue;                                   // a slug engines.js loaded from somewhere else
    const A = after.get(f)[slug], B = before.get(f)[slug];
    if (!A || !B || typeof A.compute !== 'function') continue;
    for (const buf of m.values()) {
      const ra = result(A, buf), rb = result(B, buf);
      calls++;
      perFile.set(f, (perFile.get(f) || 0) + 1);
      if (ra !== rb) diffs.push(slug + ' ' + canon(v8.deserialize(buf)) + ': ' + rb.slice(0, 120) + ' -> ' + ra.slice(0, 120));
    }
  }
  const touched = files.filter((f) => after.has(f) && before.has(f) && (later.indexOf(f) >= 0 ? strip(gitShow('engine/' + f)) : fs.readFileSync(path.join(ROOT, 'engine', f), 'utf8')) !== gitShow('engine/' + f));
  // an engine with no compute() (the currency converter is mounted by mountCurrency) has only its spec to compare, done in 2
  const computes = (f) => Object.values(after.get(f)).some((t) => t && typeof t.compute === 'function');
  const noCompute = touched.filter((f) => !computes(f));
  if (noCompute.length) console.log('      no compute(), spec compared only: ' + noCompute.join(', '));
  const uncovered = touched.filter((f) => computes(f) && !perFile.get(f));
  check(diffs.length === 0, calls + ' compute() calls on ' + inputs.size + ' tools give the same result before and after', diffs.slice(0, 5).join(' | '));
  check(uncovered.length === 0, 'every one of the ' + (touched.length - noCompute.length) + ' stripped engines with a compute() was run (fewest calls: ' +
    touched.filter(computes).map((f) => [f, perFile.get(f) || 0]).sort((a, b) => a[1] - b[1]).slice(0, 3).map((x) => x[0] + ' ' + x[1]).join(', ') + ')', uncovered.join(', '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 2 : 0);
})();
