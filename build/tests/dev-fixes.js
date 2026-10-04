#!/usr/bin/env node
/**
 * The October 2026 fixes to the developer, text and QR tools, each one
 * reproduced on the engine as it stood before (BASE, read with `git show`,
 * read-only; skipped loudly when git or the commit is not there) and then
 * proved on the engine as it is now.
 *
 *   node build/tests/dev-fixes.js [--root DIR] [--port 8680] [--out DIR] [--node-only]
 *
 * --root is the site to test (default: the one this file sits in); it is
 * served on --port (ports 8680-8689 are this test's) for the browser part.
 * Exit code 2 when a case fails, 1 when the run itself breaks.
 *
 *  1  Markdown: link and image addresses are escaped and limited to http(s),
 *     mailto, tel and relative ones; raw HTML is escaped; the Preview pane is
 *     rebuilt by a sanitiser, so hostile HTML handed to it runs nothing,
 *     fetches nothing and keeps no attribute but a checked href (browser)
 *  2  Favicon generator: "Download all as ZIP" writes a ZIP that the system
 *     unzip lists and that holds all eight PNGs at their sizes, CRCs right;
 *     the page without its zip.js tag still works (lazy load), and the old
 *     renderer on that page reproduces the failure (browser)
 *  3  Cron: 1-7, 5-7, 0-7, 7, mon-sun and @weekly
 *  4  Meta tags: "Tags generated" is the number of tags in the output
 *  5  .htaccess: the four https x www combinations, run through a small
 *     mod_rewrite model: every start URL ends where it should in one hop,
 *     and https stays off when Force HTTPS is No
 *  6  Passwords: one capital per passphrase, no copied word (seeded RNG
 *     replayed exactly), chi-square sanity on real crypto, no Math.random
 *  7  Number to words: half-up rounding on the decimal digits, with carry
 *  8  Word counter: Unicode letters and marks in the density list
 *  9  Text diff: a second --- line is content, not the end of the input
 * 10  QR reader: a light-on-dark code reads (Node, from the encoder's own
 *     matrix; browser, from QR.toSVG with the colours swapped, through the
 *     scanner's picture input and through a stubbed camera); the generator's
 *     read-back still refuses it
 * 11  Base64: Growth on UTF-8 bytes
 * and the published examples of these tools still match their engines.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const zlib = require('zlib');
const { execFileSync, spawnSync } = require('child_process');
const { webcrypto } = require('crypto');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const REPO = path.join(__dirname, '..', '..');
const PORT = Number(arg('--port', 8680));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-dev-fixes')));
const NODE_ONLY = argv.includes('--node-only');
const BASE = 'ca32a154a';                       // the engines before these fixes
const BASE_URL = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0, skipped = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (!ok && detail !== undefined ? '   (' + String(detail).slice(0, 500) + ')' : ''));
}
function skip(what) { skipped++; console.log('SKIP  ' + what); }
const section = (t) => console.log('\n--- ' + t);

/* ---------- engines in Node ---------- */

function context(extra) {
  const sb = Object.assign({
    console, Intl, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa,
    crypto: webcrypto, navigator: { language: 'en-GB' }, setTimeout, clearTimeout
  }, extra || {});
  sb.window = sb;
  sb.self = sb;
  sb.globalThis = sb;
  return vm.createContext(sb);
}
function runIn(ctx, src, name) { vm.runInContext(src, ctx, { filename: name }); return ctx; }
function current(rel, extra) { return runIn(context(extra), fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel); }
let gitOk = null;
function oldSrc(rel) {
  try { return execFileSync('git', ['-C', REPO, 'show', BASE + ':' + rel], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { return null; }
}
function before(rel, extra) {
  const src = oldSrc(rel);
  if (src === null) { if (gitOk !== false) skip('git show ' + BASE + ' is not available: the "before" reproductions are skipped'); gitOk = false; return null; }
  gitOk = true;
  return runIn(context(extra), src, BASE + ':' + rel);
}
function defaults(list) { const o = {}; (list || []).forEach((x) => { o[x.key] = x.default; }); return o; }
function transform(spec, input, opts) { return spec.transform(String(input), Object.assign(defaults(spec.options), opts || {})) || {}; }
function generate(spec, fields) { return spec.generate(Object.assign(defaults(spec.fields), fields || {})) || {}; }
const stat = (res, label) => { const r = (res.stats || []).find((x) => x[0] === label); return r ? r[1] : undefined; };

/* ======================================================================
   1  Markdown
   ====================================================================== */

const decodeAttr = (v) => v.replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Every tag well formed, only known attributes, every address safe. */
function auditHtml(html) {
  const problems = [];
  const ALLOWED_ATTR = new Set(['href', 'rel', 'src', 'alt', 'class', 'lang']);
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let m;
  while ((m = tagRe.exec(html))) {
    const attrs = m[3];
    if (m[1]) { if (attrs.trim()) problems.push('closing tag with attributes: ' + m[0]); continue; }
    const rest = attrs.replace(/\s+([a-zA-Z-]+)="([^"<>]*)"/g, (all, name, value) => {
      if (!ALLOWED_ATTR.has(name.toLowerCase())) problems.push('attribute ' + name + ' in ' + m[0]);
      if (name === 'href' || name === 'src') {
        const v = decodeAttr(value).replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
        const sch = /^([a-z][a-z0-9+.\-]*):/.exec(v);
        const ok = name === 'src' ? ['http', 'https'] : ['http', 'https', 'mailto', 'tel'];
        if (sch && ok.indexOf(sch[1]) < 0) problems.push(name + ' with scheme ' + sch[1] + ': ' + m[0]);
      }
      return '';
    });
    if (rest.trim() && rest.trim() !== '/') problems.push('malformed attributes: ' + m[0]);
    if (/^(script|iframe|style|svg|object|embed)$/i.test(m[2])) problems.push('tag ' + m[2]);
  }
  return problems;
}

function testMarkdown() {
  section('1  Markdown: addresses, attributes and raw HTML');
  const spec = current('engine/dev2-markdown-preview.js').DEV_TOOLS['markdown-preview'];
  const md = (t, o) => transform(spec, t, o);
  const PAYLOADS = [
    ['javascript: link', '[x](javascript:alert(1))'],
    ['quote breaking out of href (spaced)', '[x](" onmouseover="alert(1))'],
    ['quote breaking out of href (unspaced)', '[x](x"onmouseover="alert(1))'],
    ['javascript: image', '![x](javascript:alert(1))'],
    ['quote breaking out of alt', '![x" onerror="alert(1)](https://example.com/a.png)'],
    ['mixed-case scheme', '[x](JaVaScRiPt:alert(1))'],
    ['vbscript:', '[x](vbscript:msgbox(1))'],
    ['data: URL', '[x](data:text/html,<script>alert(1)</script>)'],
    ['data: image', '![x](data:image/svg+xml,<svg onload=alert(1)>)'],
    ['entity-encoded colon', '[x](javascript&#58;alert(1))'],
    ['raw script tag', '<script>alert(1)</script>'],
    ['raw img onerror', '<img src=x onerror=alert(1)>'],
    ['raw HTML inside a heading', '# <b onclick="alert(1)">hi</b>'],
    ['link inside a list', '- [x](javascript:alert(1))'],
    ['full document wrap', '[x](javascript:alert(1)) and [y](x"onmouseover="alert(1))']
  ];
  for (const [name, text] of PAYLOADS) {
    for (const wrap of ['fragment', 'document']) {
      const res = md(text, { wrap });
      const html = res.output || '';
      const probs = auditHtml(html.replace(/^<!DOCTYPE html>\n/, '').replace(/<meta [^>]*>/g, ''));
      check(probs.length === 0 && !/javascript:/i.test(html.replace(/&amp;/g, '&').match(/(?:href|src)="[^"]*"/g)?.join(' ') || ''),
        'Markdown ' + name + ' (' + wrap + '): no live attribute or unsafe address', probs.join('; ') + ' | ' + html);
      check(auditHtml(res.preview || '').length === 0, 'Markdown ' + name + ' (' + wrap + '): the preview HTML passes too', res.preview);
    }
  }
  // what the refused ones become
  check(md('[x](javascript:alert(1))').output === '<p>x</p>', 'a javascript: link is written as its text', md('[x](javascript:alert(1))').output);
  check(md('![logo](javascript:alert(1))').output === '<p>logo</p>', 'a javascript: image is written as its alt text', md('![logo](javascript:alert(1))').output);
  check(/<a href="x&quot;onmouseover=&quot;alert\(1\)" rel="noopener noreferrer">x<\/a>/.test(md('[x](x"onmouseover="alert(1))').output),
    'quotes in an address are escaped as &quot;', md('[x](x"onmouseover="alert(1))').output);
  check(/alt="x&quot; onerror=&quot;alert\(1\)"/.test(md('![x" onerror="alert(1)](https://example.com/a.png)').output), 'quotes in alt text are escaped', md('![x" onerror="alert(1)](https://example.com/a.png)').output);
  check(md('<script>alert(1)</script>').output === '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>', 'raw HTML is escaped and shown as text (documented behaviour)', md('<script>alert(1)</script>').output);
  // ordinary links still work
  const GOOD = [
    ['[a](https://example.com/a?b=1&c=2)', '<a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer">a</a>'],
    ['[m](mailto:hello@example.com)', 'href="mailto:hello@example.com"'],
    ['[t](tel:+441234567890)', 'href="tel:+441234567890"'],
    ['[r](/developer/cron-parser/)', 'href="/developer/cron-parser/"'],
    ['[r](../notes.html)', 'href="../notes.html"'],
    ['[h](#install)', 'href="#install"'],
    ['[w](https://en.wikipedia.org/wiki/Cron_(software))', 'href="https://en.wikipedia.org/wiki/Cron_(software)"'],
    ['[t](https://example.com "Title")', '<a href="https://example.com" rel="noopener noreferrer">t</a>'],
    ['![logo](https://example.com/logo.png)', '<img src="https://example.com/logo.png" alt="logo">'],
    ['![rel](img/logo.png)', '<img src="img/logo.png" alt="rel">'],
    ['[**bold** link](https://example.com)', '<a href="https://example.com" rel="noopener noreferrer"><strong>bold</strong> link</a>'],
    ['[x](https://example.com/*a*_b_)', 'href="https://example.com/*a*_b_"'],
    ['`[a](b)` and `*c*`', '<code>[a](b)</code> and <code>*c*</code>']
  ];
  for (const [input, want] of GOOD) {
    const out = md(input).output;
    check(out.indexOf(want) >= 0, 'still converted: ' + input, out);
  }
  // the sample and the published example are unchanged by the fix
  const ex = examples()['/developer/markdown-preview/'];
  if (ex) {
    const res = md(ex.input);
    check(res.output === ex.output, 'the published Markdown example converts exactly as captured', res.output);
    check(stat(res, 'HTML out') === '276 characters', 'its HTML out is still 276 characters', stat(res, 'HTML out'));
  }

  const old = before('engine/dev2-markdown-preview.js');
  if (old) {
    const ospec = old.DEV_TOOLS['markdown-preview'];
    const o1 = transform(ospec, '[x](javascript:alert(1))').output;
    const o2 = transform(ospec, '[x](x"onmouseover="alert(1))').output;
    const o3 = transform(ospec, '![x](javascript:alert(1))').output;
    check(/href="javascript:alert\(1"/.test(o1), 'BEFORE: reproduced — a javascript: href reached the output', o1);
    check(/<a href="x"onmouseover="alert\(1"/.test(o2), 'BEFORE: reproduced — a quote broke out of href into onmouseover', o2);
    check(/<img src="javascript:/.test(o3), 'BEFORE: reproduced — a javascript: image src reached the output', o3);
  }
  // the other three dev2 engines carry the same shared code
  for (const f of ['dev2-cron-parser.js', 'dev2-hash-generator.js', 'dev2-regex-tester.js']) {
    const a = fs.readFileSync(path.join(ROOT, 'engine/dev2-markdown-preview.js'), 'utf8');
    const b = fs.readFileSync(path.join(ROOT, 'engine', f), 'utf8');
    const head = (s) => s.slice(0, s.indexOf('\nwindow.DEV_TOOLS = window.DEV_TOOLS || {};\n'));
    check(head(a) === head(b), f + ' shares the fixed Markdown and cron code');
  }
}

/* ======================================================================
   3  Cron
   ====================================================================== */

function testCron() {
  section('3  Cron: weekday 7 is Sunday');
  const spec = current('engine/dev2-cron-parser.js').DEV_TOOLS['cron-parser'];
  const line = (e) => (transform(spec, e).output || '').split('\n')[1] || '';
  const CASES = [
    ['0 9 * * 1-7', '  → At 09:00, every day.'],
    ['0 9 * * 5-7', '  → At 09:00, on Friday, Saturday and Sunday.'],
    ['0 9 * * 0-7', '  → At 09:00, every day.'],
    ['0 9 * * 7', '  → At 09:00, on Sunday.'],
    ['0 9 * * mon-sun', '  → At 09:00, every day.'],
    ['0 9 * * fri-sun', '  → At 09:00, on Friday, Saturday and Sunday.'],
    ['0 9 * * 6,7', '  → At 09:00, on Saturday and Sunday.'],
    ['@weekly', '  → At 00:00, on Sunday.'],
    ['0 9 * * 1-5', '  → At 09:00, on Monday, Tuesday, Wednesday, Thursday and Friday.'],
    ['0 0 * * 0', '  → At 00:00, on Sunday.']
  ];
  for (const [e, want] of CASES) check(line(e) === want, 'cron "' + e + '" reads' + want.slice(4), line(e));
  // next runs of 5-7 fall only on Friday, Saturday and Sunday
  const res = transform(spec, '0 9 * * 5-7', { count: '10' });
  const runs = (res.output || '').split('\n').filter((l) => /^\s{5}\w{3}, /.test(l));
  check(runs.length === 10 && runs.every((l) => /^\s+(Fri|Sat|Sun),/.test(l)), '0 9 * * 5-7: ten next runs, all Friday to Sunday', runs.join(' | '));
  check(stat(transform(spec, '0 9 * * 1-7\n0 9 * * 5-7\n@weekly'), 'Valid') === '3', 'all three of the reported expressions are valid');
  for (const bad of ['0 9 * * 8', '0 9 * * 6-1', '0 9 * * 7-1']) {
    check(/✗/.test(transform(spec, bad).output), 'still refused: ' + bad, transform(spec, bad).output);
  }
  const old = before('engine/dev2-cron-parser.js');
  if (old) {
    const o = transform(old.DEV_TOOLS['cron-parser'], '0 9 * * 1-7').output;
    check(/✗ 1-0 is outside the allowed range/.test(o), 'BEFORE: reproduced — 0 9 * * 1-7 was refused as 1-0', o);
  }
}

/* ======================================================================
   4  Meta tags
   ====================================================================== */

function testMeta() {
  section('4  Meta tags: the count is the count');
  const spec = current('engine/dev-meta-tag-generator.js').DEV_TOOLS['meta-tag-generator'];
  const res = generate(spec, {});
  const tags = (res.output.match(/<(title|meta|link)\b/g) || []).length;
  check(tags === 14, 'the generator writes 14 tags', tags);
  check(stat(res, 'Tags generated') === String(tags), '"Tags generated" says ' + tags, stat(res, 'Tags generated'));
  const old = before('engine/dev-meta-tag-generator.js');
  if (old) {
    const o = generate(old.DEV_TOOLS['meta-tag-generator'], {});
    check(stat(o, 'Tags generated') === '16', 'BEFORE: reproduced — it said 16 for 14 tags', stat(o, 'Tags generated'));
  }
}

/* ======================================================================
   5  .htaccess
   ====================================================================== */

/** A small model of the mod_rewrite lines this generator writes. */
function rewrite(htaccess, url) {
  const u = new URL(url);
  const req = { scheme: u.protocol.replace(':', ''), host: u.host, path: u.pathname.replace(/^\//, '') };
  const lines = htaccess.split('\n').map((l) => l.trim()).filter((l) => /^Rewrite(Cond|Rule)\b/.test(l));
  let conds = [], caps = [];
  for (const l of lines) {
    let m;
    if ((m = /^RewriteCond (\S+) (\S+)(?: \[NC\])?$/.exec(l))) {
      const nc = /\[NC\]$/.test(l);
      const subject = m[1] === '%{HTTPS}' ? (req.scheme === 'https' ? 'on' : 'off') : m[1] === '%{HTTP_HOST}' ? req.host : null;
      if (subject === null) throw new Error('model does not know ' + m[1]);
      let pat = m[2], neg = false;
      if (pat[0] === '!') { neg = true; pat = pat.slice(1); }
      const re = new RegExp(pat === 'off' || pat === 'on' ? '^' + pat + '$' : pat, nc ? 'i' : '');
      const r = re.exec(subject);
      conds.push(neg ? !r : !!r);
      if (r && !neg) caps = r;
      continue;
    }
    if ((m = /^RewriteRule \^\(\.\*\)\$ (\S+) \[R=301,L\]$/.exec(l))) {
      const ok = conds.every(Boolean);
      const capsNow = caps;
      conds = []; caps = [];
      if (!ok) continue;
      const target = m[1].replace(/\$1/g, req.path).replace(/%1/g, capsNow[1] || '')
        .replace(/%\{HTTP_HOST\}/g, req.host).replace(/%\{REQUEST_SCHEME\}/g, req.scheme);
      return target;
    }
    throw new Error('model does not know: ' + l);
  }
  return null;
}
function follow(htaccess, url) {
  const hops = [];
  let at = url;
  for (let i = 0; i < 5; i++) {
    const next = rewrite(htaccess, at);
    if (!next) break;
    hops.push(next);
    at = next;
  }
  return { final: at, hops: hops.length };
}

function testHtaccess() {
  section('5  .htaccess: https and www are independent');
  const spec = current('engine/dev-htaccess-generator.js').DEV_TOOLS['htaccess-generator'];
  const STARTS = ['http://example.com/a', 'http://www.example.com/a', 'https://example.com/a', 'https://www.example.com/a'];
  for (const https of ['yes', 'no']) {
    for (const www of ['www', 'root', 'none']) {
      const res = generate(spec, { https, www, domain: 'example.com', cache: 'no', gzip: 'no', security: 'yes' });
      const out = res.output;
      for (const start of STARTS) {
        const s = new URL(start);
        const scheme = https === 'yes' ? 'https' : s.protocol.replace(':', '');
        const host = www === 'www' ? 'www.example.com' : www === 'root' ? 'example.com' : s.host;
        const want = scheme + '://' + host + '/a';
        const got = follow(out, start);
        const hopsWant = want === start ? 0 : 1;
        check(got.final === want && got.hops === hopsWant,
          'https ' + https + ', www ' + www + ': ' + start + ' -> ' + want + ' in ' + hopsWant + ' hop' + (hopsWant === 1 ? '' : 's'),
          got.final + ' in ' + got.hops);
      }
      if (https === 'no') {
        check(!/https:\/\//.test(out) && !/%\{HTTPS\}/.test(out), 'https no, www ' + www + ': no rule sends anyone to https', out);
        check(!/Strict-Transport-Security/.test(out), 'https no, www ' + www + ': no HSTS header', out);
      } else {
        check(/RewriteCond %\{HTTPS\} off/.test(out) && /Strict-Transport-Security/.test(out), 'https yes, www ' + www + ': the HTTPS rule and HSTS are there');
      }
    }
  }
  const old = before('engine/dev-htaccess-generator.js');
  if (old) {
    const o = generate(old.DEV_TOOLS['htaccess-generator'], { https: 'no', www: 'www', domain: 'example.com', cache: 'no', gzip: 'no', security: 'no' }).output;
    const got = follow(o, 'http://example.com/a');
    check(got.final === 'https://www.example.com/a', 'BEFORE: reproduced — with Force HTTPS: No, Force www still sent http visitors to https', got.final);
    const o2 = generate(old.DEV_TOOLS['htaccess-generator'], { https: 'yes', www: 'root', domain: 'example.com', cache: 'no', gzip: 'no', security: 'no' }).output;
    check(follow(o2, 'http://www.example.com/a').hops === 2, 'BEFORE: reproduced — http://www. took two redirects with Force HTTPS + non-www');
  }
  // the depth content's own run
  const res = generate(spec, { https: 'yes', www: 'root', domain: 'https://www.ashworth-joinery.co.uk/', cache: 'no', gzip: 'no', security: 'no' });
  check(stat(res, 'Directives') === '5' && stat(res, 'Size') === '192 B', 'the ashworth-joinery run is still 5 directives, 192 B', stat(res, 'Directives') + ' ' + stat(res, 'Size'));
}

/* ======================================================================
   6  Passwords
   ====================================================================== */

/** A seeded 32-bit generator, xorshift32. */
function xorshift(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
}
function stubCrypto(next) {
  return { getRandomValues(arr) { for (let i = 0; i < arr.length; i++) arr[i] = next(); return arr; } };
}

function testPasswords() {
  section('6  Passwords: one draw per word, one for the capital');
  const words = () => {
    const src = fs.readFileSync(path.join(ROOT, 'engine/txt-password-generator.js'), 'utf8');
    return /const WORDS = \('([^']+)'\)/.exec(src)[1].split(' ');
  };
  const WORDS = words();
  check(new Set(WORDS).size === WORDS.length && WORDS.length === 510, 'the word list has 510 distinct words', WORDS.length + ' / ' + new Set(WORDS).size);

  // 6a: a counter as the "random" source: words 0..4 are drawn, then capital index 5 % 5 = 0
  let n = 0;
  const counter = current('engine/txt-password-generator.js', { crypto: stubCrypto(() => n++) }).TEXT_TOOLS['password-generator'];
  n = 0;
  const one = generate(counter, { type: 'passphrase', words: 5, upper: 'yes', digits: 'no', count: 1 }).output;
  check(one === 'Able-acid-aged-also-area', 'counter source: five different words, the first capitalised', one);
  const oldC = before('engine/txt-password-generator.js', { crypto: stubCrypto(() => n++) });
  if (oldC) {
    n = 0;
    const o = generate(oldC.TEXT_TOOLS['password-generator'], { type: 'passphrase', words: 5, upper: 'yes', digits: 'no', count: 1 }).output;
    check(o === 'Acid-acid-aged-also-area', 'BEFORE: reproduced — the second word was copied over the first (acid twice, able lost)', o);
  }

  // 6b: a seeded stream, replayed: the phrase is exactly the words the draws chose, one capital at the drawn place
  const seeded = (seed) => current('engine/txt-password-generator.js', { crypto: stubCrypto(xorshift(seed)) }).TEXT_TOOLS['password-generator'];
  const replayRand = (next) => (limit) => { const bound = 4294967296 - (4294967296 % limit); let v; do { v = next(); } while (v >= bound); return v % limit; };
  let exact = 0, total = 0, chanceDup = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const spec = seeded(seed);
    const out = generate(spec, { type: 'passphrase', words: 6, upper: 'yes', digits: 'yes', count: 10 }).output.split('\n');
    const rand = replayRand(xorshift(seed));
    out.forEach((p) => {
      total++;
      const want = Array.from({ length: 6 }, () => WORDS[rand(WORDS.length)]);
      const k = rand(6);
      want[k] = want[k][0].toUpperCase() + want[k].slice(1);
      const num = rand(100);
      if (p === want.join('-') + '-' + num) exact++;
      if (new Set(want.map((w) => w.toLowerCase())).size < 6) chanceDup++;
    });
  }
  check(exact === total, 'seeded replay: all ' + total + ' passphrases are exactly the drawn words, one capital, then the number', exact + ' / ' + total);
  console.log('      (duplicates in the replayed draws themselves, by chance: ' + chanceDup + ' of ' + total + '; expected about ' + Math.round(total * (1 - [...Array(6)].reduce((a, _, i) => a * (510 - i) / 510, 1))) + ')');

  // 6c: real crypto, distribution sanity
  const real = current('engine/txt-password-generator.js').TEXT_TOOLS['password-generator'];
  const counts = new Map(WORDS.map((w) => [w, 0]));
  const caps = [0, 0, 0, 0, 0];
  let phrases = 0, dupPhrases = 0, capsWrong = 0;
  for (let i = 0; i < 400; i++) {
    const out = generate(real, { type: 'passphrase', words: 5, upper: 'yes', digits: 'no', count: 50 }).output.split('\n');
    out.forEach((p) => {
      phrases++;
      const parts = p.split('-');
      const capped = parts.map((w, j) => (/^[A-Z]/.test(w) ? j : -1)).filter((j) => j >= 0);
      if (capped.length !== 1) capsWrong++; else caps[capped[0]]++;
      const lower = parts.map((w) => w.toLowerCase());
      if (new Set(lower).size < 5) dupPhrases++;
      lower.forEach((w) => counts.set(w, counts.get(w) + 1));
    });
  }
  const draws = phrases * 5, exp = draws / WORDS.length;
  let chi = 0;
  counts.forEach((c) => { chi += (c - exp) * (c - exp) / exp; });
  // 509 degrees of freedom: mean 509, sd about 32; 680 is over five sd
  check(chi < 680 && chi > 360, 'real crypto: ' + draws + ' word draws spread evenly (chi-square ' + chi.toFixed(0) + ' for 509 df)', chi);
  check(capsWrong === 0, 'real crypto: every passphrase has exactly one capitalised word', capsWrong);
  check(caps.every((c) => Math.abs(c - phrases / 5) < phrases / 5 * 0.08), 'real crypto: the capital lands on each of the five places about equally', caps.join(' '));
  const dupRate = dupPhrases / phrases;
  check(dupRate < 0.04, 'real crypto: a repeated word only by chance (' + (dupRate * 100).toFixed(2) + '% of phrases; about 2% expected; the bug made it about 80%)', dupRate);
  // characters
  const pool = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()-_=+[]{};:,.?';
  const ccount = new Map([...pool].map((c) => [c, 0]));
  let chars = 0;
  for (let i = 0; i < 100; i++) {
    generate(real, { type: 'password', length: 128, count: 50 }).output.split('\n').forEach((p) => {
      for (const c of p) { ccount.set(c, (ccount.get(c) || 0) + 1); chars++; }
    });
  }
  check(ccount.size === 80, 'real crypto: passwords use exactly the 80-character default pool', ccount.size);
  const cexp = chars / 80;
  let cchi = 0;
  ccount.forEach((c) => { cchi += (c - cexp) * (c - cexp) / cexp; });
  check(cchi < 140 && cchi > 30, 'real crypto: ' + chars + ' characters spread evenly (chi-square ' + cchi.toFixed(0) + ' for 79 df)', cchi);
  // no crypto, no password
  const none = current('engine/txt-password-generator.js', { crypto: undefined }).TEXT_TOOLS['password-generator'];
  const r = generate(none, {});
  check(!!r.error && !r.output, 'without crypto.getRandomValues no password is made (no Math.random fallback)', JSON.stringify(r).slice(0, 200));
  check(stat(generate(real, {}), 'Entropy') === '126 bits', 'the default still reports 126 bits');
}

/* ======================================================================
   7  Number to words
   ====================================================================== */

function testWords() {
  section('7  Number to words: rounding to the minor unit');
  const spec = current('engine/txt-number-to-words.js').TEXT_TOOLS['number-to-words'];
  const say = (n, style) => transform(spec, n, { style: style || 'gbp' }).output;
  const CASES = [
    ['2.999', 'gbp', 'Three pounds only'],
    ['0.285', 'gbp', 'Zero pounds and twenty-nine pence only'],
    ['0.284', 'gbp', 'Zero pounds and twenty-eight pence only'],
    ['0.005', 'gbp', 'Zero pounds and one penny only'],
    ['0.004', 'gbp', 'Zero pounds only'],
    ['1.005', 'gbp', 'One pound and one penny only'],
    ['1.995', 'gbp', 'Two pounds only'],
    ['999999.999', 'gbp', 'One million pounds only'],
    ['999999.994', 'gbp', 'Nine hundred and ninety-nine thousand nine hundred and ninety-nine pounds and ninety-nine pence only'],
    ['-2.999', 'gbp', 'Minus three pounds only'],
    ['-0.285', 'gbp', 'Minus zero pounds and twenty-nine pence only'],
    ['-0.004', 'gbp', 'Zero pounds only'],
    ['£1,050.07', 'gbp', 'One thousand and fifty pounds and seven pence only'],
    ['0.285', 'usd', 'Zero dollars and twenty-nine cents only'],
    ['0.285', 'inr', 'Zero rupees and twenty-nine paise only'],
    ['99999.995', 'inr', 'One lakh rupees only'],
    ['1250000.50', 'gbp', 'One million two hundred and fifty thousand pounds and fifty pence only'],
    ['1.5', 'plain', 'One point five'],
    ['1250000.50', 'plain', 'One million two hundred and fifty thousand point five zero'],
    ['2.999', 'plain', 'Two point nine nine nine'],
    ['0.285', 'plain', 'Zero point two eight five'],
    ['1e3', 'plain', 'One thousand'],
    ['1.5e-1', 'plain', 'Zero point one five'],
    ['-7', 'plain', 'Minus seven'],
    ['999999999999', 'plain', 'Nine hundred and ninety-nine billion nine hundred and ninety-nine million nine hundred and ninety-nine thousand nine hundred and ninety-nine'],
    ['999999999999.995', 'gbp', '999999999999.995 → too large (limit is under a trillion)'],
    ['1000000000000', 'plain', '1000000000000 → too large (limit is under a trillion)'],
    ['€40', 'plain', '€40 → not a number'],
    ['21', 'ordinal', 'Twenty-first'],
    ['21.7', 'ordinal', 'Twenty-first']
  ];
  for (const [n, style, want] of CASES) check(say(n, style) === want, style + ' ' + n + ' -> ' + want, say(n, style));
  const ex = examples()['/text/number-to-words/'];
  if (ex) check(transform(spec, ex.input).output === ex.output, 'the published example is unchanged');
  const old = before('engine/txt-number-to-words.js');
  if (old) {
    const o = old.TEXT_TOOLS['number-to-words'];
    check(transform(o, '2.999', { style: 'gbp' }).output === 'Two pounds and one hundred pence only', 'BEFORE: reproduced — 2.999 gave "one hundred pence"');
    check(transform(o, '0.285', { style: 'gbp' }).output === 'Zero pounds and twenty-eight pence only', 'BEFORE: reproduced — 0.285 gave 28 pence');
  }
}

/* ======================================================================
   8  Word counter
   ====================================================================== */

function testCounter() {
  section('8  Word counter: Unicode words');
  const spec = current('engine/txt-word-counter.js').TEXT_TOOLS['word-counter'];
  const density = (t, o) => (transform(spec, t, Object.assign({ ignoreCommon: 'no', density: '25' }, o || {})).output || '').split('\n').slice(2).map((l) => l.trim().split(/\s+/));
  const fr = density('café naïve résumé café');
  check(fr.length === 3 && fr[0][0] === 'café' && fr[0][1] === '2' && fr.some((r) => r[0] === 'naïve') && fr.some((r) => r[0] === 'résumé'),
    'café naïve résumé: kept whole, café counted twice', JSON.stringify(fr));
  const hi = density('नमस्ते दुनिया नमस्ते');
  check(hi.length === 2 && hi[0][0] === 'नमस्ते' && hi[0][1] === '2' && hi[1][0] === 'दुनिया', 'Hindi: नमस्ते twice and दुनिया, vowel signs kept', JSON.stringify(hi));
  const nfd = density('cafe\u0301 café');
  check(nfd.length === 1 && nfd[0][1] === '2', 'a decomposed é counts with a composed one', JSON.stringify(nfd));
  const res = transform(spec, 'Grand reopening of Café Lumière on Saturday 🎉 Free coffee for the first 50 customers. See you there!');
  check(/^café\s/m.test(res.output) && /^lumière\s/m.test(res.output), 'the depth page\'s notice now lists café and lumière', res.output);
  check(stat(res, 'Words') === '18' && stat(res, 'Characters') === '101' && stat(res, 'Unique words') === '11', 'its counts are unchanged (18 words, 101 characters, 11 unique)');
  check(stat(transform(spec, 'Ünïcödé snake_case'), 'Longest word') === 'snake_case', 'Longest word still keeps underscores', stat(transform(spec, 'Ünïcödé snake_case'), 'Longest word'));
  check(stat(transform(spec, 'résumés are nice'), 'Longest word') === 'résumés', 'Longest word keeps accents', stat(transform(spec, 'résumés are nice'), 'Longest word'));
  const ex = examples()['/text/word-counter/'];
  if (ex) {
    const r = transform(spec, ex.input);
    // the published example keeps the first six figures
    check(r.output === ex.output && (ex.stats || []).every(([k, v]) => stat(r, k) === v), 'the published example is unchanged', r.output);
  }
  const old = before('engine/txt-word-counter.js');
  if (old) {
    const o = old.TEXT_TOOLS['word-counter'];
    const out = transform(o, 'café naïve résumé', { ignoreCommon: 'no' }).output;
    check(/^caf\s/m.test(out) && /^nave\s/m.test(out), 'BEFORE: reproduced — café became caf and naïve nave', out);
    const h = transform(o, 'नमस्ते दुनिया', { ignoreCommon: 'no' }).output;
    check(h === '', 'BEFORE: reproduced — Hindi words vanished from the density list', h);
  }
}

/* ======================================================================
   9  Text diff
   ====================================================================== */

function testDiff() {
  section('9  Text diff: a second --- line');
  const spec = current('engine/txt-text-diff.js').TEXT_TOOLS['text-diff'];
  const input = 'title: Notes\nbody\n---\ntitle: Notes\n---\nbody\nnew line';
  const res = transform(spec, input);
  check(res.output === '  title: Notes\n+ ---\n  body\n+ new line', 'everything after the second --- is compared', res.output);
  check(stat(res, 'Added lines') === '2' && /first --- line/.test(res.note || ''), '2 added, and a note says where the split was', stat(res, 'Added lines') + ' | ' + res.note);
  const res2 = transform(spec, 'a\n---\nb\n---\nc\n---\nd');
  check(/The other 2 --- lines were/.test(res2.note || '') && /\+ d$/.test(res2.output), 'three separators: the last text still compared', res2.output + ' | ' + res2.note);
  const crlf = transform(spec, 'one\r\n---\r\ntwo');
  check(stat(crlf, 'Result') === '1 added, 1 removed', 'a Windows line ending around --- still splits', stat(crlf, 'Result'));
  check(!!transform(spec, 'no separator here').error, 'no separator: still an error');
  const ex = examples()['/text/text-diff/'];
  if (ex) {
    const r = transform(spec, ex.input);
    check(r.output === ex.output && (ex.stats || []).every(([k, v]) => stat(r, k) === v) && !r.note, 'the published example is unchanged');
  }
  const old = before('engine/txt-text-diff.js');
  if (old) {
    const o = transform(old.TEXT_TOOLS['text-diff'], input).output;
    check(!/new line/.test(o), 'BEFORE: reproduced — the text after the second --- was ignored', o);
  }
}

/* ======================================================================
   10  QR reader, in Node
   ====================================================================== */

function raster(matrix, px, dark, light, quiet) {
  const n = matrix.length, size = (n + 2 * quiet) * px;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.floor(y / px) - quiet, c = Math.floor(x / px) - quiet;
      const on = r >= 0 && c >= 0 && r < n && c < n && matrix[r][c];
      const v = on ? dark : light, i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

function testQrNode() {
  section('10  QR reader (Node): light on dark');
  const load = (srcs) => { const ctx = context(); srcs.forEach(([s, n]) => runIn(ctx, s, n)); return ctx; };
  const read = (rel) => [fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel];
  const ctx = load([read('engine/qr.bundle.js'), read('engine/qr-detect.js')]);
  const text = 'https://www.1234tools.com/qr/qr-code-scanner/?from=inverted';
  const q = ctx.QR.encode(text, 'M');
  const normal = raster(q.matrix, 6, 0, 255, 4);
  const inverted = raster(q.matrix, 6, 255, 0, 4);
  const navy = raster(q.matrix, 6, 240, 30, 4);
  const a = ctx.QRDetect.scan(normal);
  check(a && a.text === text && !a.inverted, 'a dark-on-light code reads, not marked inverted', a && a.text);
  const b = ctx.QRDetect.scan(inverted);
  check(b && b.text === text && b.inverted === true, 'a light-on-dark code reads, marked inverted', b && b.text);
  const c = ctx.QRDetect.scan(navy);
  check(c && c.text === text && c.inverted === true, 'pale on navy (240 on 30) reads too', c && c.text);
  check(ctx.QRDetect.scan(inverted, { invert: false }) === null, 'invert:false (the generator\'s read-back) still refuses it');
  const only = ctx.QRDetect.scan(inverted, { invert: 'only' });
  check(only && only.text === text, "invert:'only' (the camera's third frames) reads it");
  check(ctx.QRDetect.scan(normal, { invert: 'only' }) === null, "invert:'only' does not read a normal code");
  // the same with a damaged, mirrored inverted code (version 7, level H)
  const q2 = ctx.QR.encode('Inverted, mirrored and damaged: still a QR code ' + 'x'.repeat(80), 'H');
  const m2 = q2.matrix.map((row) => row.slice().reverse());
  for (let r = 14; r < 20; r++) for (let cc = 14; cc < 20; cc++) m2[r][cc] ^= 1;
  const d = ctx.QRDetect.scan(raster(m2, 5, 255, 0, 4));
  check(d && d.inverted && d.mirrored && d.corrected > 0, 'inverted + mirrored + damaged reads, with repairs', d && JSON.stringify({ v: d.version, corrected: d.corrected, mirrored: d.mirrored }));
  const oldSrcText = oldSrc('engine/qr-detect.js');
  if (oldSrcText !== null) {
    const octx = load([read('engine/qr.bundle.js'), [oldSrcText, BASE + ':engine/qr-detect.js']]);
    check(octx.QRDetect.scan(inverted) === null, 'BEFORE: reproduced — the old reader found nothing in the light-on-dark code');
  } else skip('BEFORE: qr-detect.js at ' + BASE);
}

/* ======================================================================
   11  Base64
   ====================================================================== */

function testBase64() {
  section('11  Base64: Growth on bytes');
  const spec = current('engine/dev-base64.js').DEV_TOOLS['base64'];
  const CASES = [
    ['Café Zoë — ₹1,499 paid ✓', '32 B', '44 B', '+38%'],
    ['x >= y?', '7 B', '12 B', '+71%'],
    ['😀😀😀', '12 B', '16 B', '+33%'],
    ['नमस्ते', '18 B', '24 B', '+33%']
  ];
  for (const [t, i, o, g] of CASES) {
    const r = transform(spec, t);
    check(stat(r, 'Input') === i && stat(r, 'Output') === o && stat(r, 'Growth') === g, JSON.stringify(t) + ': ' + i + ' -> ' + o + ', Growth ' + g, (r.stats || []).join(' | '));
  }
  // growth agrees with the byte sizes it sits next to
  const r = transform(spec, 'Ünïcödé ✓ ' + '€'.repeat(30));
  const ib = parseInt(stat(r, 'Input'), 10), ob = parseInt(stat(r, 'Output'), 10);
  check(stat(r, 'Growth') === '+' + Math.round((ob / ib - 1) * 100) + '%', 'Growth is Output bytes over Input bytes', stat(r, 'Growth'));
  const ex = examples()['/developer/base64/'];
  if (ex) {
    const e = transform(spec, ex.input);
    check(e.output === ex.output, 'the published example still encodes the same');
    const g = (ex.stats || []).find((s) => s[0] === 'Growth');
    check(g && g[1] === stat(e, 'Growth'), 'the published example\'s Growth figure matches the engine (' + stat(e, 'Growth') + ')', g && g[1]);
  }
  const old = before('engine/dev-base64.js');
  if (old) {
    check(stat(transform(old.DEV_TOOLS['base64'], 'Café Zoë — ₹1,499 paid ✓'), 'Growth') === '+83%', 'BEFORE: reproduced — Growth +83% for 32 bytes becoming 44');
  }
}

let exCache = null;
function examples() {
  if (exCache) return exCache;
  const f = path.join(ROOT, 'assets/examples.js');
  const w = {};
  if (fs.existsSync(f)) new Function('window', fs.readFileSync(f, 'utf8'))(w);
  exCache = w.TOOL_EXAMPLES || {};
  return exCache;
}

/* ======================================================================
   the browser part
   ====================================================================== */

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(REPO, 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Read a ZIP from its central directory; every entry's data, checked. */
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10), cdStart = buf.readUInt32LE(eocd + 16);
  const out = [];
  let p = cdStart;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central header ' + i);
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('bad local header for ' + name);
    const lnl = buf.readUInt16LE(local + 26), lxl = buf.readUInt16LE(local + 28);
    let data = buf.slice(local + 30 + lnl + lxl, local + 30 + lnl + lxl + csize);
    if (method === 8) data = zlib.inflateRawSync(data);
    out.push({ name, data, crcOk: crc32(data) === crc });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

async function browserPart() {
  const puppeteer = loadPuppeteer();
  if (!puppeteer) { skip('puppeteer-core not found: the browser cases are skipped'); return; }
  if (!fs.existsSync(CHROME)) { skip('Chrome not found at ' + CHROME + ': the browser cases are skipped'); return; }
  const { serve } = require('./serve.js');
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  });
  const offsite = [];
  const watch = (page) => {
    page.on('request', (r) => { const u = r.url(); if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:|about:)/.test(u)) offsite.push(u); });
  };
  try {
    await testPreview(browser, watch);
    await testFavicon(browser, watch);
    await testQrBrowser(browser, watch);
    check(offsite.length === 0, 'browser: not one request to anything but 127.0.0.1', offsite.slice(0, 5).join(' '));
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

async function newPage(browser, watch, opts) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  // the site's service worker would answer from its cache, past the interception below
  await page.setBypassServiceWorker(true);
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setRequestInterception(true);
  const requests = [];
  page.on('request', (r) => {
    const u = r.url();
    requests.push(u);
    if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(u)) { r.abort(); return; }   // analytics, fonts: never off the machine
    if (opts && opts.rewrite) {
      const body = opts.rewrite(u);
      if (body) { r.respond(body); return; }
    }
    r.continue();
  });
  watch(page);
  return { page, dialogs, errors, requests };
}

/* ---------- 1  the Markdown preview ---------- */

async function testPreview(browser, watch) {
  section('1  Markdown preview in the browser');
  const { page, dialogs, requests } = await newPage(browser, watch);
  await page.goto(BASE_URL + '/developer/markdown-preview/', { waitUntil: 'load' });
  await page.waitForSelector('.md-preview', { timeout: 10000 });
  const type = async (text) => {
    await page.evaluate((t) => {
      const ta = document.querySelector('.code-area');
      ta.value = t;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
    await sleep(60);
  };
  const audit = () => page.evaluate(() => {
    const box = document.querySelector('.md-preview');
    const bad = [];
    box.querySelectorAll('*').forEach((n) => {
      for (const a of n.attributes) {
        if (['href', 'target', 'rel', 'class', 'title', 'referrerpolicy'].indexOf(a.name) < 0) bad.push(n.localName + '[' + a.name + ']');
      }
      if (/^(script|iframe|svg|img|style|object|embed|form|details|math)$/.test(n.localName)) bad.push('<' + n.localName + '>');
      if (n.localName === 'a' && n.hasAttribute('href') && ['http:', 'https:', 'mailto:', 'tel:'].indexOf(new URL(n.href).protocol) < 0) bad.push('href ' + n.href);
    });
    return { bad, html: box.innerHTML, links: box.querySelectorAll('a[href]').length, text: box.textContent };
  });
  const PAYLOADS = ['[x](javascript:alert(1))', '[x](" onmouseover="alert(1))', '[x](x"onmouseover="alert(1))', '![x](javascript:alert(1))',
    '![x" onerror="alert(1)](https://example.com/a.png)', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '[x](data:text/html,<script>alert(1)</script>)'];
  for (const p of PAYLOADS) {
    await type(p);
    const a = await audit();
    // hover and click every link: nothing may run
    const links = await page.$$('.md-preview a');
    for (const l of links) { try { await l.hover(); } catch (e) { /* off screen */ } }
    check(a.bad.length === 0, 'preview of ' + p + ': nothing live', a.bad.join(' ') + ' | ' + a.html);
  }
  await type('<img src=x onerror=alert(1)>');
  const raw = await audit();
  check(raw.text === '<img src=x onerror=alert(1)>', 'raw HTML shows in the preview as the text you typed', raw.text);
  await type('# Title\n\nSome **bold** and a [link](https://example.com/x).\n\n![logo](https://example.com/logo.png)\n\n```js\nconst a = 1;\n```');
  const good = await audit();
  check(/<h1>Title<\/h1>/.test(good.html) && /<strong>bold<\/strong>/.test(good.html) && good.links === 1 && /class="language-js"/.test(good.html),
    'ordinary Markdown renders: heading, bold, one link, a code block', good.html);
  const link = await page.$eval('.md-preview a', (a) => ({ href: a.href, target: a.target, rel: a.rel }));
  check(link.href === 'https://example.com/x' && link.target === '_blank' && /noopener/.test(link.rel) && /noreferrer/.test(link.rel), 'a preview link opens in a new tab with no opener or referrer', JSON.stringify(link));
  check(/Image: logo \(not loaded in the preview\)/.test(good.text) && !requests.some((u) => /logo\.png/.test(u)), 'a picture is a labelled box and is never fetched', good.text);

  // the sanitiser itself, handed hostile HTML directly
  const marker = BASE_URL + '/__dev-fixes-pixel.png';
  await page.evaluate((px) => {
    const spec = window.DEV_TOOLS['markdown-preview'];
    spec.__orig = spec.transform;
    spec.transform = function () {
      return { output: 'x', preview:
        '<img src="' + px + '" onerror="alert(1)"><script>alert(2)</script>' +
        '<a href="javascript:alert(3)" onclick="alert(4)">jlink</a>' +
        '<svg onload="alert(5)"><circle r="1"/></svg><iframe src="javascript:alert(6)"></iframe>' +
        '<p style="color:red" onmouseover="alert(7)" id="p7">para</p>' +
        '<details open ontoggle="alert(8)"><summary>s</summary>d</details>' +
        '<a href="  java&#x09;script:alert(9)">tab</a><a href="https://example.com/ok">ok</a>' +
        '<math><mtext><table><mglyph><style><img src=x onerror=alert(10)>' +
        '<form action="javascript:alert(11)"><button>b</button></form><object data="javascript:alert(12)"></object>' +
        '<base href="javascript:alert(13)//"><meta http-equiv="refresh" content="0;url=javascript:alert(14)">' };
    };
    const ta = document.querySelector('.code-area');
    ta.value = 'hostile';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, marker);
  await sleep(300);
  const h = await audit();
  for (const l of await page.$$('.md-preview a')) { try { await l.hover(); await l.click({ button: 'middle' }); } catch (e) { /* fine */ } }
  try { await page.hover('.md-preview p'); } catch (e) { /* fine */ }
  await sleep(300);
  check(h.bad.length === 0, 'hostile HTML handed straight to the sanitiser: no handler, script, frame, svg, img or bad href survives', h.bad.join(' ') + ' | ' + h.html);
  check(/para/.test(h.text) && /ok/.test(h.text) && h.links === 1, 'its harmless text survives and only the https link is a link', h.html);
  check(!requests.some((u) => u.indexOf('__dev-fixes-pixel') >= 0), 'the hostile <img> was never fetched (DOMParser is inert)');
  check(dialogs.length === 0, 'no alert ran in any of it', dialogs.join(' | '));
  await page.close();
}

/* ---------- 2  the favicon ZIP ---------- */

async function makeIcon(page) {
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#e8590c';
    g.beginPath(); g.arc(150, 100, 90, 0, Math.PI * 2); g.fill();
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'logo.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.querySelector('.dropzone input[type=file]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll('.file-card').length === 8, { timeout: 15000 });
}

async function zipDownload(page, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Download all as ZIP');
    b.click();
  });
  const file = path.join(dir, 'favicons.zip');
  for (let i = 0; i < 50; i++) {
    if (fs.existsSync(file) && fs.statSync(file).size > 0 && !fs.readdirSync(dir).some((f) => /\.crdownload$/.test(f))) return fs.readFileSync(file);
    await sleep(100);
  }
  return null;
}

async function testFavicon(browser, watch) {
  section('2  Favicon generator: Download all as ZIP');
  const SIZES = { 'favicon-16x16.png': 16, 'favicon-32x32.png': 32, 'favicon-48x48.png': 48, 'favicon-96x96.png': 96,
    'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512 };
  const html = fs.readFileSync(path.join(ROOT, 'developer/favicon-generator/index.html'), 'utf8');
  check(/<script src="\/engine\/zip\.js" defer><\/script>/.test(html), 'the favicon page loads engine/zip.js');

  const verify = (buf, label) => {
    if (!buf) { check(false, label + ': a favicons.zip was downloaded'); return; }
    let entries;
    try { entries = readZip(buf); } catch (e) { check(false, label + ': the ZIP parses', e.message); return; }
    const names = entries.map((e) => e.name).sort();
    check(JSON.stringify(names) === JSON.stringify(Object.keys(SIZES).sort()), label + ': the ZIP holds all eight icons', names.join(', '));
    let allOk = true;
    const bad = [];
    entries.forEach((e) => {
      const png = e.data.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
      const w = e.data.readUInt32BE(16), hgt = e.data.readUInt32BE(20);
      if (!e.crcOk || !png || w !== SIZES[e.name] || hgt !== SIZES[e.name]) { allOk = false; bad.push(e.name + ' ' + w + 'x' + hgt + ' crc ' + e.crcOk); }
    });
    check(allOk, label + ': every entry is a PNG of its size with a correct CRC', bad.join('; '));
    // and the system's own unzip reads it
    const zipPath = path.join(OUT, label.replace(/\W+/g, '-') + '.zip');
    fs.writeFileSync(zipPath, buf);
    const tarExe = fs.existsSync('C:/Windows/System32/tar.exe') ? 'C:/Windows/System32/tar.exe' : null;
    if (tarExe) {
      const r = spawnSync(tarExe, ['-tf', zipPath], { encoding: 'utf8' });
      const listed = (r.stdout || '').trim().split(/\r?\n/).sort();
      check(r.status === 0 && JSON.stringify(listed) === JSON.stringify(Object.keys(SIZES).sort()), label + ': Windows tar (libarchive) lists the same eight files', r.stderr || listed.join(', '));
    } else {
      const r = spawnSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
      if (r.status === null) skip(label + ': no system unzip to cross-check with');
      else check(r.status === 0, label + ': unzip -l reads it', r.stderr);
    }
  };

  // as shipped
  {
    const { page, errors } = await newPage(browser, watch);
    await page.goto(BASE_URL + '/developer/favicon-generator/', { waitUntil: 'load' });
    await makeIcon(page);
    verify(await zipDownload(page, path.join(OUT, 'zip-shipped')), 'favicon page as shipped');
    check(errors.length === 0, 'favicon page as shipped: no script errors', errors.join(' | '));
    await page.close();
  }
  // a page without the zip.js tag: the renderer fetches it on first use
  const strip = (u) => {
    if (/\/developer\/favicon-generator\/(index\.html)?$/.test(u)) {
      return { status: 200, contentType: 'text/html; charset=utf-8', body: html.replace(/<script src="\/engine\/zip\.js" defer><\/script>\n?/, '') };
    }
    return null;
  };
  {
    const { page, errors, requests } = await newPage(browser, watch, { rewrite: strip });
    await page.goto(BASE_URL + '/developer/favicon-generator/', { waitUntil: 'load' });
    const before = await page.evaluate(() => typeof window.MVRZip);
    await makeIcon(page);
    verify(await zipDownload(page, path.join(OUT, 'zip-lazy')), 'favicon page without its zip.js tag');
    check(before === 'undefined' && requests.some((u) => /\/engine\/zip\.js$/.test(u)), 'without the tag, zip.js was not there at first and was fetched on the click', before);
    check(errors.length === 0, 'lazy load: no script errors', errors.join(' | '));
    await page.close();
  }
  // the old renderer on the old page: reproduce
  const oldRender = oldSrc('engine/render-dev.js');
  if (oldRender !== null) {
    const { page, errors } = await newPage(browser, watch, {
      rewrite: (u) => strip(u) || (/\/engine\/render-dev\.js$/.test(u) ? { status: 200, contentType: 'application/javascript; charset=utf-8', body: oldRender } : null)
    });
    await page.goto(BASE_URL + '/developer/favicon-generator/', { waitUntil: 'load' });
    await makeIcon(page);
    const buf = await zipDownload(page, path.join(OUT, 'zip-before'));
    check(buf === null && errors.some((e) => /zip\.js not loaded/.test(e)), 'BEFORE: reproduced — the old page gave no ZIP and "zip.js not loaded"', errors.join(' | '));
    await page.close();
  } else skip('BEFORE: render-dev.js at ' + BASE);
}

/* ---------- 10  the QR scanner in the browser ---------- */

async function testQrBrowser(browser, watch) {
  section('10  QR scanner in the browser: light on dark');
  const text = 'https://www.1234tools.com/?inverted=1';
  const { page, errors } = await newPage(browser, watch);
  await page.goto(BASE_URL + '/qr/qr-code-scanner/', { waitUntil: 'load' });
  await page.waitForSelector('.scan-drop input[type=file]', { timeout: 10000 });
  // QR.toSVG with dark and light swapped, rasterised by the browser
  const direct = await page.evaluate(async (t) => {
    const q = window.QR.encode(t, 'M');
    const svg = window.QR.toSVG(q, { dark: '#ffffff', light: '#000000', scale: 10, quiet: 4 });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height);
    const corner = Array.from(data.data.slice(0, 3));
    const got = window.QRDetect.scan(data);
    const strict = window.QRDetect.scan(data, { invert: false });
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    window.__invertedPng = blob;
    return { corner, text: got && got.text, inverted: got && got.inverted, strict: strict };
  }, text);
  check(direct.corner.join(',') === '0,0,0', 'the swapped SVG really is light on dark (corner pixel black)', direct.corner);
  check(direct.text === text && direct.inverted === true, 'QRDetect reads the rasterised light-on-dark SVG', JSON.stringify(direct));
  check(direct.strict === null, 'the generator-style strict read (invert:false) still refuses it');
  // through the scanner's own picture input
  await page.evaluate(() => {
    const file = new File([window.__invertedPng], 'inverted.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.querySelector('.scan-drop input[type=file]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  try {
    await page.waitForSelector('.scan-card', { timeout: 10000 });
    const card = await page.evaluate(() => ({ text: document.querySelector('.scan-text') && document.querySelector('.scan-text').textContent, meta: document.querySelector('.scan-meta') && document.querySelector('.scan-meta').textContent }));
    check(card.text === text && /light on dark/.test(card.meta || ''), 'the scanner page reads the picture and says "light on dark"', JSON.stringify(card));
  } catch (e) {
    check(false, 'the scanner page reads the picture', await page.evaluate(() => (document.querySelector('.io-msg') || {}).textContent));
  }
  check(errors.length === 0, 'scanner page: no script errors', errors.join(' | '));
  await page.close();

  // the camera, stubbed with a canvas stream showing the inverted code
  const cam = await newPage(browser, watch);
  await cam.page.evaluateOnNewDocument((t) => {
    window.__camText = t;
    const orig = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) : null;
    navigator.mediaDevices.getUserMedia = async function () {
      const q = window.QR.encode(window.__camText, 'M');
      const svg = window.QR.toSVG(q, { dark: '#f0f0f0', light: '#101828', scale: 8, quiet: 4 });
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      const g = c.getContext('2d');
      const draw = () => {
        g.fillStyle = '#101828'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, (c.width - 420) / 2, (c.height - 420) / 2, 420, 420);
        window.__camFrames = (window.__camFrames || 0) + 1;
      };
      draw();
      setInterval(draw, 50);
      return c.captureStream(20);
    };
    void orig;
  }, text);
  await cam.page.goto(BASE_URL + '/qr/qr-code-scanner/', { waitUntil: 'load' });
  await cam.page.waitForSelector('button[data-act=start]', { timeout: 10000 });
  await cam.page.evaluate(() => { try { delete window.BarcodeDetector; } catch (e) { /* fine */ } });
  await cam.page.click('button[data-act=start]');
  try {
    await cam.page.waitForSelector('.scan-card', { timeout: 15000 });
    const card = await cam.page.evaluate(() => ({ text: document.querySelector('.scan-text') && document.querySelector('.scan-text').textContent, meta: document.querySelector('.scan-meta') && document.querySelector('.scan-meta').textContent }));
    check(card.text === text && /light on dark/.test(card.meta || ''), 'the camera loop reads a light-on-dark code (every third frame is flipped)', JSON.stringify(card));
  } catch (e) {
    check(false, 'the camera loop reads a light-on-dark code', await cam.page.evaluate(() => (document.querySelector('.io-msg') || {}).textContent + ' frames=' + window.__camFrames));
  }
  await cam.page.close();
}

/* ---------- run ---------- */

(async () => {
  console.log('dev-fixes  root ' + ROOT + '  before = ' + BASE);
  testMarkdown();
  testCron();
  testMeta();
  testHtaccess();
  testPasswords();
  testWords();
  testCounter();
  testDiff();
  testQrNode();
  testBase64();
  if (!NODE_ONLY) await browserPart();
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (skipped ? ', ' + skipped + ' skipped' : ''));
  process.exit(fail ? 2 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
