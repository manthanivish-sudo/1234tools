/**
 * The rules build/content/*.js is held to, as one function the test
 * (build/tests/depth.js) and an author both run:
 *
 *   node build/content/_check.js [--root <site>] [--only india,business] [--words]
 *
 *   - every calculator page (MVRTool.mount, or the currency converter's
 *     mountCurrency) has an entry, and every entry a page;
 *   - 250–450 words of new text a page;
 *   - no sentence (or clause) of 8 words or more appears on two pages;
 *   - the worked example's inputs are the tool's own keys and values, differ
 *     from the captured example's, and every figure it lists in `check`
 *     appears in its text and equals a fresh compute with the page's own
 *     engine (to the decimals shown); the same for each entry of `checks`,
 *     which hold the figures quoted in FAQ answers and elsewhere;
 *   - no new question repeats one the page already answers;
 *   - related links point at pages that exist;
 *   - statutory pages name the year the engine uses ("FY 2026-27",
 *     "2026/27"); no fluff words; no American spellings (warned).
 *
 * The tools that work on files and text (every tool page in /image/,
 * /pdf/, /text/, /developer/ and /qr/) are held to the same rules, in their
 * own shape: `howItWorks` ({ text, points }) in place of `formula`, a worked
 * example in words, and `runs`, the record of each run of the tool that a
 * quoted figure came from:
 *
 *   { input, options, check: [[key, shown], …] }   a text or code tool: the
 *       page's own engine (its DEV_TOOLS / TEXT_TOOLS / IMAGE_TOOLS spec) is run here, in
 *       Node, on that input with those options, and each figure compared.
 *       key is 'output' (shown is part of the output), 'stat:<label>' (the
 *       stat row's value contains shown), 'outputLines', 'outputLength',
 *       'outputBytes', 'note', 'warn' or 'error'. { fields, check } for a
 *       form-in generator.
 *   { browser: { …parameters… }, shown: [ … ] }   a file tool, run in
 *       headless Chrome against a local server: the parameters say exactly
 *       what was uploaded and set, so the run can be repeated.
 *
 * Every shown figure must appear in the page's text, and every figure in
 * the worked example must be one a run shows or was given (warned).
 *
 * Exit code 2 when an error is found.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };

const MIN_WORDS = 250, MAX_WORDS = 450, DUP_WORDS = 8;
const FLUFF = /\b(effortless(ly)?|seamless(ly)?|unlock(s|ing)?|game[- ]changer|supercharge|delve|leverag(e|es|ing)|empower(s|ing)?|cutting[- ]edge|in today's|look no further|hassle[- ]free|revolutioni[sz]e)\b/i;
const US = /\b(color(s|ed|ing)?|center(s|ed)?|analyz\w*|optimiz\w*|favor(s|ite|ed)?|behavior\w*|organiz\w*|recogniz\w*|meters?|liters?|fiber|defense|labor|traveled|traveling|modeled|catalog)\b/i;
const STATUTORY = {
  '/india/india-income-tax/': 'FY 2026-27', '/india/advance-tax/': 'FY 2026-27', '/india/ctc-take-home/': 'FY 2026-27',
  '/india/tds-calculator/': 'FY 2026-27', '/india/india-capital-gains/': 'FY 2026-27', '/india/hra-exemption/': 'FY 2026-27',
  '/india/gst-calculator/': 'GST', '/india/epf-calculator/': 'EPF',
  '/business/uk-take-home-pay/': '2026/27', '/business/employer-cost/': '2026/27'
};

function contentFiles(root) {
  const dir = path.join(root, 'build', 'content');
  return fs.readdirSync(dir).filter((n) => /^[a-z0-9-]+\.js$/.test(n)).sort();
}

function loadContent(root) {
  const all = {};
  const from = {};
  for (const name of contentFiles(root)) {
    const abs = path.join(root, 'build', 'content', name);
    delete require.cache[require.resolve(abs)];
    const map = require(abs);
    for (const url of Object.keys(map)) { all[url] = map[url]; from[url] = name; }
  }
  return { all, from };
}

function calculatorPages(root) {
  const out = [];
  const skip = new Set(['node_modules', '.git', 'build', 'conversions', 'learn', 'practice', 'account', 'pwa', 'hi']);
  for (const sec of fs.readdirSync(root)) {
    if (skip.has(sec)) continue;
    const d = path.join(root, sec);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const slug of fs.readdirSync(d)) {
      const f = path.join(d, slug, 'index.html');
      if (!fs.existsSync(f)) continue;
      const html = fs.readFileSync(f, 'utf8');
      if (/MVRTool\.mount\(window\.TOOLS\[/.test(html) || /MVRTool\.mountCurrency\(/.test(html)) out.push('/' + sec + '/' + slug + '/');
    }
  }
  return out.sort();
}

/** The tools that work on files and text: every tool page in these sections. */
const FILE_SECTIONS = ['image', 'pdf', 'text', 'developer', 'qr'];

function filePages(root) {
  const out = [];
  for (const sec of FILE_SECTIONS) {
    const d = path.join(root, sec);
    if (!fs.existsSync(d)) continue;
    for (const slug of fs.readdirSync(d)) {
      const f = path.join(d, slug, 'index.html');
      if (!fs.existsSync(f)) continue;
      const html = fs.readFileSync(f, 'utf8');
      if (/<meta name="robots" content="noindex/.test(html) || /http-equiv="refresh"/.test(html)) continue;
      if (/<article class="tool[ "]/.test(html)) out.push('/' + sec + '/' + slug + '/');
    }
  }
  return out.sort();
}

/* ---------- a text or code tool's own engine, run in Node ---------- */

const codeCache = new Map();
/** The DEV_TOOLS / IMAGE_TOOLS spec a page mounts, loaded from the page's own engine scripts. */
function codeTool(url, root) {
  const abs = path.join(root, url.replace(/^\/+/, ''), 'index.html');
  const key = abs;
  if (codeCache.has(key)) return codeCache.get(key);
  const html = fs.readFileSync(abs, 'utf8');
  const m = /var spec = window\.(DEV_TOOLS|TEXT_TOOLS|IMAGE_TOOLS)\[['"]([^'"]+)['"]\]/.exec(html);
  if (!m) throw new Error('the page mounts no DEV_TOOLS / TEXT_TOOLS / IMAGE_TOOLS spec');
  const vm = require('vm');
  const sandbox = {
    console, Intl, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa,
    crypto: require('crypto').webcrypto, navigator: { language: 'en-GB' }, setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  const re = /<script src="\/engine\/([^"]+\.js)"/g;
  let s;
  while ((s = re.exec(html))) {
    if (/^(render-|zip\.js|pdfcore|vendor\/)/.test(s[1])) continue;
    const f = path.join(root, 'engine', s[1]);
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  }
  const spec = sandbox[m[1]] && sandbox[m[1]][m[2]];
  if (!spec) throw new Error('engine defines no ' + m[1] + '["' + m[2] + '"]');
  codeCache.set(key, spec);
  return spec;
}

/** One recorded run, repeated: spec.transform(input, options) or spec.generate(fields), defaults filled in. */
function runCode(spec, run) {
  if (run.input !== undefined) {
    if (typeof spec.transform !== 'function') throw new Error('this tool has no transform()');
    const opts = {};
    (spec.options || []).forEach((o) => { opts[o.key] = o.default; });
    Object.assign(opts, run.options || {});
    return spec.transform(String(run.input), opts) || {};
  }
  if (typeof spec.generate !== 'function') throw new Error('this tool has no generate()');
  const f = {};
  (spec.fields || []).forEach((o) => { f[o.key] = o.default; });
  Object.assign(f, run.fields || {});
  return spec.generate(f) || {};
}

/** Does a re-run show this figure? */
function runShows(res, key, shown) {
  const out = String(res.output || '');
  const s = String(shown);
  if (key === 'output' || key === 'note' || key === 'warn' || key === 'error') return String(res[key] || '').indexOf(s) >= 0;
  if (key.indexOf('stat:') === 0) {
    const row = (res.stats || []).find((r) => String(r[0]) === key.slice(5));
    return !!row && String(row[1]).indexOf(s) >= 0;
  }
  const n = { outputLines: out ? out.split('\n').length : 0, outputLength: [...out].length, outputBytes: Buffer.byteLength(out, 'utf8') }[key];
  return n !== undefined && same(n, s);
}

/** Every piece of new prose on a page, in the order it is read. */
function texts(d, withExpr) {
  const t = [];
  (Array.isArray(d.whatIs) ? d.whatIs : [d.whatIs]).forEach((s) => { if (s) t.push(s); });
  if (d.howItWorks) {
    (Array.isArray(d.howItWorks.text) ? d.howItWorks.text : [d.howItWorks.text]).forEach((s) => t.push(s));
    (d.howItWorks.points || []).forEach((p) => t.push(p));
  }
  if (d.formula) {
    t.push(d.formula.text);
    /* the expressions are notation, not prose: not counted as words, and two
       pages may well share one (EMI, loan payment, amortisation) */
    if (withExpr) (Array.isArray(d.formula.expr) ? d.formula.expr : [d.formula.expr]).forEach((e) => t.push(e));
    (d.formula.vars || []).forEach((v) => t.push(v[1]));
  }
  (d.howTo || []).forEach((s) => t.push(s));
  if (d.worked) (Array.isArray(d.worked.text) ? d.worked.text : [d.worked.text]).forEach((s) => t.push(s));
  (d.uses || []).forEach((u) => t.push(u[0] + '. ' + u[1]));
  (d.mistakes || []).forEach((m) => t.push(m));
  (d.faq || []).forEach((f) => { t.push(f.q); t.push(f.a); });
  return t;
}

const words = (s) => (String(s).match(/[A-Za-z0-9₹£$€%][A-Za-z0-9₹£$€%.,'’\-/×÷]*/g) || []).length;
const norm = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function sentences(s) {
  return String(s).split(/(?<=[.!?;:])\s+|\s+—\s+/).map((x) => x.trim()).filter(Boolean);
}

function get(obj, keyPath) {
  return String(keyPath).split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
}

/** Does the shown figure equal the computed value, to the decimals shown? */
function same(value, shown, scale) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    const a = value.toLowerCase(), b = String(shown).toLowerCase();
    return a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
  }
  const s = String(shown).replace(/−/g, '-');
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(s);
  if (!m) return false;
  const n = Number(m[0].replace(/,/g, ''));
  const dec = (m[0].split('.')[1] || '').length;
  const v = Number(value) * (scale || 1);
  return Math.abs(v - n) <= 0.5 * Math.pow(10, -dec) + 1e-9 * Math.max(1, Math.abs(v));
}

function examples(root) {
  const f = path.join(root, 'assets', 'examples.js');
  if (!fs.existsSync(f)) return {};
  const w = {};
  new Function('window', fs.readFileSync(f, 'utf8'))(w);
  return w.TOOL_EXAMPLES || {};
}

function existingFaq(root, url) {
  const f = path.join(root, url.replace(/^\/+/, ''), 'index.html');
  if (!fs.existsSync(f)) return [];
  const html = fs.readFileSync(f, 'utf8').replace(/<!-- DEPTH:[\s\S]*?<!-- \/DEPTH -->/g, '');
  const out = [];
  const re = /<details><summary>([^<]*)<\/summary>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1].replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’'));
  return out;
}

function overlap(a, b) {
  const A = new Set(norm(a).split(' ').filter((w) => w.length > 3));
  const B = new Set(norm(b).split(' ').filter((w) => w.length > 3));
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((w) => { if (B.has(w)) n++; });
  return n / Math.min(A.size, B.size);
}

function run(opts) {
  const root = path.resolve((opts && opts.root) || path.join(__dirname, '..', '..'));
  const only = opts && opts.only ? new Set(opts.only) : null;
  const { tool, compute } = require('./_engine.js');
  const { all, from } = loadContent(root);
  const errors = [], warnings = [];
  const stats = {};
  const exs = examples(root);
  const err = (url, m) => errors.push(url + '  ' + m);
  const warn = (url, m) => warnings.push(url + '  ' + m);

  const pages = calculatorPages(root);
  const files = filePages(root).filter((u) => pages.indexOf(u) < 0);
  const inScope = (url) => !only || only.has(url.split('/')[1]);
  pages.concat(files).filter(inScope).forEach((u) => { if (!all[u]) err(u, 'no content entry'); });
  Object.keys(all).filter(inScope).forEach((u) => {
    if (pages.indexOf(u) < 0 && files.indexOf(u) < 0) err(u, 'content for a page that is neither a calculator nor a file or text tool page (' + from[u] + ')');
    else if (files.indexOf(u) >= 0 && !all[u].howItWorks) err(u, 'a file or text tool page: its entry needs howItWorks, not formula');
    else if (pages.indexOf(u) >= 0 && all[u].howItWorks) err(u, 'a calculator page: its entry takes formula, not howItWorks');
  });

  /* duplicates are checked across every file, whatever --only says */
  const seen = new Map();
  Object.keys(all).forEach((url) => {
    texts(all[url]).forEach((t) => sentences(t).forEach((s) => {
      const n = norm(s);
      if (n.split(' ').length < DUP_WORDS) return;
      if (!seen.has(n)) seen.set(n, new Set());
      seen.get(n).add(url);
    }));
  });
  seen.forEach((urls, n) => {
    if (urls.size > 1 && [...urls].some(inScope)) errors.push('duplicate sentence on ' + [...urls].join(' and ') + ': "' + n.slice(0, 120) + '"');
  });

  Object.keys(all).filter(inScope).forEach((url) => {
    const d = all[url];
    const tx = texts(d);
    const n = tx.reduce((a, s) => a + words(s), 0);
    stats[url] = n;
    if (n < MIN_WORDS || n > MAX_WORDS) err(url, n + ' words of new text (want ' + MIN_WORDS + '–' + MAX_WORDS + ')');
    tx.forEach((s) => {
      const f = FLUFF.exec(s); if (f) err(url, 'fluff word "' + f[0] + '"');
      /* `code spans` are code (CSS's color, a library's name), not English */
      const u = US.exec(s.replace(/World Health Organization/g, '').replace(/`[^`]*`/g, '')); if (u) warn(url, 'American spelling? "' + u[0] + '"');
    });
    if (STATUTORY[url] && !tx.some((s) => s.indexOf(STATUTORY[url]) >= 0)) err(url, 'statutory page never says "' + STATUTORY[url] + '"');
    if (!d.uses || d.uses.length < 3 || d.uses.length > 5) err(url, 'want 3–5 uses');
    if (!d.mistakes || d.mistakes.length < 2 || d.mistakes.length > 3) err(url, 'want 2–3 mistakes');
    if (!d.faq || d.faq.length < 3 || d.faq.length > 5) err(url, 'want 3–5 new questions');
    const sharedChecks = () => {
      const old = existingFaq(root, url);
      (d.faq || []).forEach((f) => old.forEach((o) => {
        if (norm(o) === norm(f.q) || overlap(o, f.q) >= 0.75) err(url, 'question repeats the page\'s FAQ: "' + f.q + '" ~ "' + o + '"');
      }));
      const r = d.related || {};
      (r.conversions || []).concat(r.guides || []).forEach((href) => {
        const f = path.join(root, href.replace(/^\/+/, ''), 'index.html');
        if (!fs.existsSync(f)) warn(url, 'related link to a page that does not exist (it will not be written): ' + href);
      });
    };

    if (d.howItWorks) {
      fileChecks(url, d, tx, root, err, warn);
      sharedChecks();
      return;
    }

    let t;
    try { t = tool(url, root); } catch (e) { err(url, e.message); return; }
    const keys = new Map((t.inputs || []).map((i) => [i.key, i]));
    const okInputs = (inputs, what) => {
      Object.keys(inputs || {}).forEach((k) => {
        const i = keys.get(k);
        if (!i) { err(url, what + ': "' + k + '" is not one of the tool\'s inputs'); return; }
        if (i.type === 'select' && !(i.options || []).some((o) => String(o.value) === String(inputs[k]))) err(url, what + ': ' + k + '=' + inputs[k] + ' is not one of its options');
      });
    };
    const verify = (inputs, list, what, text) => {
      let r;
      try { r = compute(url, inputs, root); } catch (e) { err(url, what + ': compute threw ' + e.message); return; }
      (list || []).forEach((c) => {
        const [key, shown, scale] = c;
        if (text !== null && String(text).indexOf(shown) < 0) err(url, what + ': "' + shown + '" is not in the text');
        if (!same(get(r, key), shown, scale)) err(url, what + ': ' + key + ' computes to ' + JSON.stringify(get(r, key)) + ', text says ' + shown);
      });
    };

    if (typeof t.compute !== 'function') {
      /* the currency converter: live rates, no compute(). Its worked example
         states the rate it assumes and says so; nothing to recompute. */
      const w = d.worked || {};
      if (!w.illustrative) err(url, 'this tool has no compute(): the worked example must be marked illustrative and state the rate it assumes');
      if ((w.check || []).length || (d.checks || []).length) err(url, 'this tool has no compute(): nothing can be checked');
      const ex = exs[url];
      const allowed = ex && ex.try ? [...new URLSearchParams(ex.try.replace(/^#/, '')).keys()] : [];
      Object.keys(w.inputs || {}).forEach((k) => { if (allowed.indexOf(k) < 0) err(url, 'worked: "' + k + '" is not a key the page reads (' + allowed.join(', ') + ')'); });
    } else if (d.worked) {
      const w = d.worked;
      if (!w.inputs || !Object.keys(w.inputs).length) err(url, 'worked example has no inputs');
      if (!w.check || !w.check.length) err(url, 'worked example checks no figures');
      okInputs(w.inputs, 'worked');
      verify(w.inputs, w.check, 'worked', Array.isArray(w.text) ? w.text.join(' ') : w.text);
      const ex = exs[url];
      if (ex && ex.try && w.inputs) {
        const cap = new URLSearchParams(ex.try.replace(/^#/, ''));
        const differs = Object.keys(w.inputs).some((k) => cap.get(k) !== String(w.inputs[k]));
        if (!differs) err(url, 'worked example uses the captured example\'s inputs');
      }
    } else err(url, 'no worked example');

    (d.checks || []).forEach((c, i) => {
      okInputs(c.inputs, 'checks[' + i + ']');
      const where = tx.join(' ');
      verify(c.inputs, [[c.key, c.shown, c.scale]], 'checks[' + i + ']', where);
    });

    sharedChecks();
  });

  return { errors, warnings, stats, pages, files, content: all };
}

/** A file or text tool's entry: the method, the worked example and the runs its figures came from. */
function fileChecks(url, d, tx, root, err, warn) {
  const h = d.howItWorks;
  if (!h.points || h.points.length < 2 || h.points.length > 6) err(url, 'howItWorks: want 2–6 points');
  const w = d.worked;
  if (!w || !w.text) { err(url, 'no worked example'); return; }
  if (w.inputs || w.check) err(url, 'worked: a file or text tool has no inputs to try; record the run in runs');
  const runs = d.runs || [];
  if (!runs.length) err(url, 'runs: no record of the tool run the worked example came from');
  const all = tx.join(' ');
  const given = [];
  runs.forEach((r, i) => {
    const what = 'runs[' + i + ']';
    if (r.browser) {
      if (typeof r.browser !== 'object' || !Object.keys(r.browser).length) err(url, what + ': browser holds the run\'s parameters');
      if (!Array.isArray(r.shown) || !r.shown.length) err(url, what + ': shown lists the figures the run produced');
      (r.shown || []).forEach((s) => { given.push(String(s)); if (all.indexOf(s) < 0) err(url, what + ': "' + s + '" is not in the text'); });
      given.push(JSON.stringify(r.browser));
      return;
    }
    if (r.input === undefined && !r.fields) { err(url, what + ': a run is { input, options, check } or { fields, check } or { browser, shown }'); return; }
    if (!Array.isArray(r.check) || !r.check.length) err(url, what + ': check lists the figures to compare');
    let res;
    try { res = runCode(codeTool(url, root), r); } catch (e) { err(url, what + ': the engine could not be run: ' + e.message); return; }
    if (res.error && !(r.check || []).some((c) => c[0] === 'error')) err(url, what + ': the tool reported an error: ' + String(res.error).split('\n')[0]);
    (r.check || []).forEach((c) => {
      given.push(String(c[1]));
      if (all.indexOf(c[1]) < 0) err(url, what + ': "' + c[1] + '" is not in the text');
      if (!runShows(res, c[0], c[1])) {
        const row = c[0].indexOf('stat:') === 0 ? (res.stats || []).find((x) => String(x[0]) === c[0].slice(5)) : null;
        err(url, what + ': ' + c[0] + ' does not show "' + c[1] + '" (the run gives ' + JSON.stringify(row ? row[1] : c[0] === 'output' ? String(res.output || '').slice(0, 80) : res[c[0]]) + ')');
      }
    });
    given.push(JSON.stringify(r.input || ''), JSON.stringify(r.options || {}), JSON.stringify(r.fields || {}));
  });

  /* every figure in the worked example comes from a run (a shown figure or a parameter) */
  const pool = given.join(' ').replace(/,/g, '');
  const text = Array.isArray(w.text) ? w.text.join(' ') : w.text;
  (text.match(/\d[\d,]*(?:\.\d+)?/g) || []).forEach((n) => {
    const bare = n.replace(/,/g, '').replace(/\.$/, '');
    if (bare.length < 2 && !/\./.test(bare)) return;          /* "3 pages", "2 files": counts the reader can see */
    if (pool.indexOf(bare) < 0) warn(url, 'worked: the figure ' + n + ' is not shown by, or given to, any recorded run');
  });
}

module.exports = { run, texts, words, sentences, norm, same, calculatorPages, filePages, codeTool, runCode, runShows, loadContent, FILE_SECTIONS };

if (require.main === module) {
  const only = arg('--only', '');
  const res = run({ root: arg('--root', ''), only: only ? only.split(',') : null });
  const urls = Object.keys(res.stats).sort();
  if (process.argv.includes('--words')) urls.forEach((u) => console.log(String(res.stats[u]).padStart(5) + '  ' + u));
  res.warnings.forEach((w) => console.log('warn   ' + w));
  res.errors.forEach((e) => console.log('ERROR  ' + e));
  const tot = urls.reduce((a, u) => a + res.stats[u], 0);
  const nFile = urls.filter((u) => res.content[u] && res.content[u].howItWorks).length;
  console.log('\n' + urls.length + ' page(s) (' + (urls.length - nFile) + ' calculator, ' + nFile + ' file and text tool), ' + tot + ' words' + (urls.length ? ' (' + Math.round(tot / urls.length) + ' a page)' : '') + ', ' + res.errors.length + ' error(s), ' + res.warnings.length + ' warning(s)');
  process.exit(res.errors.length ? 2 : 0);
}
