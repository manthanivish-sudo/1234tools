#!/usr/bin/env node
/**
 * The October 2026 fixes to the developer, text and QR tools, each one
 * reproduced on the engine as it stood before (BASE, read with `git show`,
 * read-only; skipped loudly when git or the commit is not there) and then
 * proved on the engine as it is now.
 *
 *   node build/tests/dev-fixes.js [--root DIR] [--port 8680] [--out DIR] [--node-only] [--repo GIT_DIR]
 *
 * --root is the site to test (default: the one this file sits in); it is
 * served on --port (ports 8680-8689 are this test's) for the browser part.
 * --repo is the git checkout the "before" engines are read from (default:
 * the one this file sits in; pass it when running a copy outside git).
 * Exit code 2 when a case fails, 1 when the run itself breaks.
 *
 *  1  Markdown: link and image addresses are escaped and limited to http(s),
 *     mailto, tel and relative ones; raw HTML is escaped; the Preview pane is
 *     rebuilt by a sanitiser, so hostile HTML handed to it runs nothing,
 *     fetches nothing and keeps no attribute but a checked href (browser)
 *  2  Favicon generator: "Download all as ZIP" writes a ZIP that the system
 *     unzip lists and that holds all eight PNGs at their sizes, CRCs right,
 *     plus a favicon.ico of the 16/32/48 PNGs and a site.webmanifest;
 *     the page without its zip.js tag still works (lazy load), and the old
 *     renderer on that page reproduces the failure (browser)
 *  3  Cron: 1-7, 5-7, 0-7, 7, mon-sun and @weekly
 *  4  Meta tags: "Tags generated" is the number of tags in the output, and
 *     a blank field writes no tag (robots.txt and Lorem ipsum follow it:
 *     Block all is two lines; the English list is 54 distinct words)
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
 * 12  Generator defaults: no default, sample or placeholder of a developer
 *     or text tool, and no engine script, names mvritservices.com; the
 *     robots.txt, .htaccess and meta-tag defaults are 1234Tools ones
 * and the published examples of these tools still match their engines.
 *
 * Wave 0-B (reproduced on BASE2, the engines before it):
 * 13  URL encoder: Treat + as space, Auto by scope; %2B stays a plus
 * 14  CSV to JSON: nested objects flatten to dotted columns and back, the
 *     delimiter is detected, header row and type inference are options, and
 *     the download is .json or .csv by direction
 * 15  robots.txt: typed exclusions are kept under every policy but Block
 *     all; robots.txt and .htaccess download under those names
 *
 * Wave 0-A:
 * 16  (2026-10-06) The QR renderers live in engine/render-qr.js: it registers
 *     mountQR, mountQRBulk and mountQRScanner and render-dev.js no longer
 *     does; every function of the QR section of render-dev.js at 364240974
 *     is in render-qr.js (moved verbatim, since extended by wave 4: see
 *     build/tests/qr-fixes.js), render-dev.js outside the text and form shells is
 *     unchanged, and the helpers
 *     render-qr.js keeps a copy of match render-dev.js's; the three QR pages
 *     load render-qr.js and not render-dev.js, every developer and text page
 *     still loads render-dev.js; in the browser the three pages mount with
 *     no script error and never fetch render-dev.js (browser)
 *
 * Wave 3:
 * 17  The shell (render-dev.js): two columns from 900 px with a divider
 *     (keys and drag), stacked at 390 px; full screen; undoable Load example
 *     and Clear; debounced typing and Ctrl+Enter; the highlighter; the error
 *     line and caret; options in the share link; settings and drafts on the
 *     device; Ctrl+S, Ctrl+Shift+C and the shortcuts list; opened files and
 *     the big-file mode in the Worker; the regex time limit and Cancel; no
 *     draft for the JWT decoder; a generator's link and settings (browser)
 * 18  Lorem ipsum: the classic opening, exact bytes, headings, lists and
 *     Markdown; slugs: Hindi and Latin transliteration, maximum length;
 *     case: dot, path, alternating, all; number to words: US and cheque
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
const REPO = path.resolve(arg('--repo', path.join(__dirname, '..', '..')));   // where git show reads the "before" engines
const PORT = Number(arg('--port', 8680));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-dev-fixes')));
const NODE_ONLY = argv.includes('--node-only');
const BASE = 'ca32a154a';                       // the engines before these fixes
const BASE2 = '364240974';                      // the engines before wave 0-B
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
function oldSrcAt(commit, rel) {
  try { return execFileSync('git', ['-C', REPO, 'show', commit + ':' + rel], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { return null; }
}
function oldSrc(rel) { return oldSrcAt(BASE, rel); }
function before(rel, extra) {
  const src = oldSrc(rel);
  if (src === null) { if (gitOk !== false) skip('git show ' + BASE + ' is not available: the "before" reproductions are skipped'); gitOk = false; return null; }
  gitOk = true;
  return runIn(context(extra), src, BASE + ':' + rel);
}
function beforeAt(commit, rel, extra) {
  let src = null;
  try { src = execFileSync('git', ['-C', REPO, 'show', commit + ':' + rel], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { /* none */ }
  if (src === null) { skip('git show ' + commit + ':' + rel + ' is not available: its "before" reproduction is skipped'); return null; }
  return runIn(context(extra), src, commit + ':' + rel);
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
      // a table column's alignment, and only these three exact values
      const align = name === 'style' && /^t[hd]$/i.test(m[2]) && /^text-align:(left|center|right)$/.test(value);
      if (!ALLOWED_ATTR.has(name.toLowerCase()) && !align) problems.push('attribute ' + name + ' in ' + m[0]);
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
    ['full document wrap', '[x](javascript:alert(1)) and [y](x"onmouseover="alert(1))'],
    ['script and img onerror in table cells', '| <script>alert(1)</script> | <img src=x onerror=alert(1)> |\n|---|---|\n| a | b |'],
    ['javascript: link and image in a table cell', '| a | b |\n|---|---|\n| [x](javascript:alert(1)) | ![y](javascript:alert(1)) |'],
    ['quotes breaking out of a link in a table cell', '| a | b |\n|:-:|--:|\n| [x](x"onmouseover="alert(1)) | ![z" onerror="alert(1)](https://example.com/a.png) |'],
    ['attribute text in a divider row', '| a |\n|---" onmouseover="alert(1)|\n| b |'],
    ['escaped pipes around hostile text', '| a \\| <b onclick="alert(1)"> | c |\n|---|---|\n| d\\|" onclick="x | e |']
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
  // pipe tables, GitHub style
  const TABLES = [
    ['| a | b |\n|---|---|\n| 1 | 2 |', '<table>\n<thead>\n<tr><th>a</th><th>b</th></tr>\n</thead>\n<tbody>\n<tr><td>1</td><td>2</td></tr>\n</tbody>\n</table>'],
    ['a | b\n--- | ---\n1 | 2', '<table>\n<thead>\n<tr><th>a</th><th>b</th></tr>\n</thead>\n<tbody>\n<tr><td>1</td><td>2</td></tr>\n</tbody>\n</table>'],
    ['| L | C | R | N |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |', '<tr><td style="text-align:left">1</td><td style="text-align:center">2</td><td style="text-align:right">3</td><td>4</td></tr>'],
    ['| a | b |\n|---|---|\n| only |\n| 1 | 2 | 3 |', '<tr><td>only</td><td></td></tr>\n<tr><td>1</td><td>2</td></tr>'],
    ['| a \\| b | c |\n|---|---|\n| `x \\| y` | **z** |', '<tr><th>a | b</th><th>c</th></tr>\n</thead>\n<tbody>\n<tr><td><code>x | y</code></td><td><strong>z</strong></td></tr>'],
    ['| a |\n|---|', '<table>\n<thead>\n<tr><th>a</th></tr>\n</thead>\n</table>'],
    ['p\n| a |\n|---|\n| 1 |\nrow\n\nq', '<p>p</p>\n<table>\n<thead>\n<tr><th>a</th></tr>\n</thead>\n<tbody>\n<tr><td>1</td></tr>\n<tr><td>row</td></tr>\n</tbody>\n</table>\n<p>q</p>'],
    ['| a |\n|---|\n| 1 |\n> quote', '</table>\n<blockquote>'],
    ['| a | b |\n|---|\n| 1 | 2 |', '<p>| a | b | |---| | 1 | 2 |</p>'],
    ['```\n| a | b |\n|---|---|\n```', '<pre><code>| a | b |\n|---|---|</code></pre>']
  ];
  for (const [input, want] of TABLES) {
    const out = md(input).output;
    check(out.indexOf(want) >= 0, 'table: ' + JSON.stringify(input), out);
  }
  const hostile = md('| <script>alert(1)</script> | x |\n|:-:|---|\n| [a](javascript:alert(1)) | [b](x"onclick="alert(1)) |').output;
  check(/<th style="text-align:center">&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/th>/.test(hostile) && /<td style="text-align:center">a<\/td>/.test(hostile) &&
    /<a href="x&quot;onclick=&quot;alert\(1\)" rel="noopener noreferrer">b<\/a>/.test(hostile), 'hostile cells: escaped as text, javascript: dropped, quotes escaped', hostile);
  const divider = md('| a |\n|:---" onmouseover="x|\n| b |').output;
  check(!/<table/.test(divider) && !/style=/.test(divider), 'a divider row carrying anything but :---: is not a table, so no alignment is copied from it', divider);
  check(stat(md('| a |\n|---|\n\n| b |\n|---|'), 'Tables') === '2', 'the Tables stat counts tables');
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
  // the other dev2 engines carry the same shared code (the cron parser no longer does: it is its own engine, rewritten in wave 3)
  check(!/function markdownToHtml|function sha256/.test(fs.readFileSync(path.join(ROOT, 'engine/dev2-cron-parser.js'), 'utf8')), 'the cron parser engine carries no Markdown or hashing code any more');
  for (const f of ['dev2-hash-generator.js', 'dev2-regex-tester.js']) {
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
  // blank fields write no tags, and the count follows
  const BLANK = { title: '', desc: '   ', url: '', image: '', site: '' };
  const noImg = generate(spec, { image: '' });
  const nTags = (o) => (o.match(/<(title|meta|link)\b/g) || []).length;
  check(nTags(noImg.output) === 12 && stat(noImg, 'Tags generated') === '12' && !/og:image|twitter:image/.test(noImg.output),
    'no share image: the two image tags are left out and "Tags generated" says 12', stat(noImg, 'Tags generated'));
  check(/twitter:card" content="summary"/.test(noImg.output), 'no share image: the Twitter card is summary, not summary_large_image');
  const blank = generate(spec, BLANK);
  check(!/content=""|href=""|<title><\/title>|content="\s+"/.test(blank.output) && stat(blank, 'Tags generated') === String(nTags(blank.output)),
    'every text field blank: no empty tag, and the count (' + stat(blank, 'Tags generated') + ') is the tags written', blank.output);
  check(/Page title, Canonical URL, Share image URL/.test(blank.warn || ''), 'every text field blank: the warning names the fields Open Graph needs', blank.warn);
  check(stat(generate(spec, { title: '  Spaced  ' }), 'Title length') === '6 — quite short' && /<title>Spaced<\/title>/.test(generate(spec, { title: '  Spaced  ' }).output),
    'surrounding spaces are trimmed from what is written and from the length');
  if (old) {
    const o = generate(old.DEV_TOOLS['meta-tag-generator'], BLANK);
    check(/<title><\/title>/.test(o.output) && /og:image" content=""/.test(o.output), 'BEFORE: reproduced — blank fields wrote <title></title> and content=""');
  }
}

/* ======================================================================
   robots.txt: Block all is two lines
   ====================================================================== */

function testRobots() {
  section('robots.txt: Block all crawlers is two lines and nothing more');
  const spec = current('engine/dev-robots-txt-generator.js').DEV_TOOLS['robots-txt-generator'];
  const F = { policy: 'block', aibots: 'block', sitemap: 'https://shop.example/sitemap.xml', disallow: '/admin/' };
  const r = generate(spec, F);
  check(r.output === 'User-agent: *\nDisallow: /\n', 'block, with a sitemap, exclusions and AI blocking set: exactly User-agent: * / Disallow: /', JSON.stringify(r.output));
  check(/sitemap/i.test(r.warn || ''), 'the warning says the sitemap and AI settings are left out', r.warn);
  const c = generate(spec, { policy: 'custom', aibots: 'block', sitemap: 'https://shop.example/sitemap.xml' });
  check(/\nSitemap: https:\/\/shop\.example\/sitemap\.xml\n$/.test(c.output) && /User-agent: GPTBot/.test(c.output), 'the other policies still write the sitemap and the AI groups');
  check(!/Sitemap/.test(generate(spec, { policy: 'allow', sitemap: '   ' }).output), 'a sitemap field of spaces writes no Sitemap line');
  const old = before('engine/dev-robots-txt-generator.js');
  if (old) {
    const o = generate(old.DEV_TOOLS['robots-txt-generator'], F).output;
    check(/Sitemap:/.test(o) && /GPTBot/.test(o), 'BEFORE: reproduced — Block all also wrote a Sitemap line and seven AI groups');
  }
}

/* ======================================================================
   Lorem ipsum: 54 distinct English words, none twice
   ====================================================================== */

function testLorem() {
  section('Lorem ipsum: the English list is 54 distinct words');
  const spec = current('engine/dev-lorem-ipsum.js').DEV_TOOLS['lorem-ipsum'];
  const seen = new Set(), counts = {};
  for (let i = 0; i < 200; i++) generate(spec, { unit: 'words', count: 100, flavour: 'english' }).output.split(' ').forEach((w) => { seen.add(w); counts[w] = (counts[w] || 0) + 1; });
  check(seen.size === 54, '20,000 English words use 54 distinct words', seen.size);
  // with no word listed twice, "the" is drawn about as often as any other word (expected 370 each)
  check(counts.the < 520 && counts.parts < 520, '"the" and "parts" are not drawn twice as often as the rest', 'the ' + counts.the + ', parts ' + counts.parts);
  const old = before('engine/dev-lorem-ipsum.js');
  if (old) {
    const s2 = new Set();
    for (let i = 0; i < 200; i++) generate(old.DEV_TOOLS['lorem-ipsum'], { unit: 'words', count: 100, flavour: 'english' }).output.split(' ').forEach((w) => s2.add(w));
    check(s2.size === 54, 'BEFORE: reproduced — the old list also gave 54 distinct words, not the 59 the page said', s2.size);
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
    return fs.readFileSync(path.join(ROOT, 'build/wordlist/words.txt'), 'utf8').split('\n').filter(Boolean);
  };
  const WORDS = words();
  check(new Set(WORDS).size === WORDS.length && WORDS.length > 5000, 'the word list has ' + WORDS.length + ' distinct words', WORDS.length + ' / ' + new Set(WORDS).size);

  // 6a: a counter as the "random" source: words 0..4 are drawn, then capital index 5 % 5 = 0
  let n = 0;
  const counter = current('engine/txt-password-generator.js', { crypto: stubCrypto(() => n++) }).TEXT_TOOLS['password-generator'];
  n = 0;
  const one = generate(counter, { type: 'passphrase', words: 5, upper: 'yes', digits: 'no', addnum: 'no', count: 1 }).output;
  check(one === WORDS.slice(0, 5).map((w, i) => i ? w : w[0].toUpperCase() + w.slice(1)).join('-'), 'counter source: five different words (the first five of the list), the first capitalised', one);
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
    const out = generate(spec, { type: 'passphrase', words: 6, count: 10 }).output.split('\n');
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
  console.log('      (duplicates in the replayed draws themselves, by chance: ' + chanceDup + ' of ' + total + '; expected about ' + Math.round(total * (1 - [...Array(6)].reduce((a, _, i) => a * (WORDS.length - i) / WORDS.length, 1))) + ')');

  // 6c: real crypto, distribution sanity
  const real = current('engine/txt-password-generator.js').TEXT_TOOLS['password-generator'];
  const counts = new Map(WORDS.map((w) => [w, 0]));
  const caps = [0, 0, 0, 0, 0];
  let phrases = 0, dupPhrases = 0, capsWrong = 0;
  for (let i = 0; i < 400; i++) {
    const out = generate(real, { type: 'passphrase', words: 5, addnum: 'no', count: 50 }).output.split('\n');
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
  // N - 1 degrees of freedom: mean N - 1, sd sqrt(2(N - 1)); five sd either side
  const dfN = WORDS.length - 1, sdN = Math.sqrt(2 * dfN);
  check(Math.abs(chi - dfN) < 5 * sdN, 'real crypto: ' + draws + ' word draws spread evenly (chi-square ' + chi.toFixed(0) + ' for ' + dfN + ' df)', chi);
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
  check(res.diff.A.join('|') === 'title: Notes|body' && res.diff.B.join('|') === 'title: Notes|---|body|new line' && /\n\+---\n body\n\+new line$/.test(res.output), 'everything after the second --- is compared', res.output);
  check(stat(res, 'Added lines') === '2' && /first --- line/.test(res.note || ''), '2 added, and a note says where the split was', stat(res, 'Added lines') + ' | ' + res.note);
  const res2 = transform(spec, 'a\n---\nb\n---\nc\n---\nd');
  check(/The other 2 --- lines were/.test(res2.note || '') && res2.diff.B.join('|') === 'b|---|c|---|d', 'three separators: the last text still compared', res2.output + ' | ' + res2.note);
  const crlf = transform(spec, 'one\r\n---\r\ntwo');
  check(stat(crlf, 'Result') === '1 added, 1 removed', 'a Windows line ending around --- still splits', stat(crlf, 'Result'));
  check(!!transform(spec, 'no separator here').error, 'no separator: still an error');
  const ex = examples()['/text/text-diff/'];
  if (ex) {
    const r = transform(spec, ex.input);
    check((ex.stats || []).every(([k, v]) => stat(r, k) === v) && !r.note, 'the published example\'s figures are unchanged (its output text is the old format; the owner re-captures it)');
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

/* ======================================================================
   12  Generator defaults name 1234Tools, not mvritservices.com
   ====================================================================== */

function testDefaults() {
  section('12  Generator defaults: 1234Tools, never mvritservices.com');
  // every default, sample and placeholder of every developer and text tool spec
  const files = fs.readdirSync(path.join(ROOT, 'engine')).filter((f) => /^(dev|dev2|txt)-.*\.js$/.test(f)).sort();
  const bad = [];
  let specs = 0, values = 0;
  const walk = (o, where) => {
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, where + '[' + i + ']')); return; }
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string' && /^(default|sample|placeholder)$/.test(k)) { values++; if (/mvritservices/i.test(v)) bad.push(where + '.' + k + ' = ' + v); }
      else if (v && typeof v === 'object') walk(v, where + '.' + k);
    }
  };
  for (const f of files) {
    let ctx;
    try { ctx = current('engine/' + f); } catch (e) { check(false, f + ' loads in Node', e.message); continue; }
    for (const reg of ['DEV_TOOLS', 'TEXT_TOOLS']) {
      for (const [id, spec] of Object.entries(ctx[reg] || {})) { specs++; walk(spec, f + ' ' + id); }
    }
  }
  check(specs >= files.length && values > 0 && bad.length === 0,
    'no default, sample or placeholder in ' + specs + ' developer and text tool specs (' + values + ' values) contains mvritservices', bad.join(' | '));
  // and no engine script at all, which covers the QR generators' tuple defaults and bulk examples in render-qr.js
  const scripts = fs.readdirSync(path.join(ROOT, 'engine')).filter((f) => /\.js$/.test(f));
  const hits = scripts.filter((f) => /mvritservices/i.test(fs.readFileSync(path.join(ROOT, 'engine', f), 'utf8')));
  check(hits.length === 0, 'none of the ' + scripts.length + ' engine scripts mentions mvritservices', hits.join(', '));
  // the defaults that replaced them
  const rb = current('engine/dev-robots-txt-generator.js').DEV_TOOLS['robots-txt-generator'];
  check(defaults(rb.fields).sitemap === 'https://www.1234tools.com/sitemap.xml' && /\nSitemap: https:\/\/www\.1234tools\.com\/sitemap\.xml\n$/.test(generate(rb, {}).output),
    'robots.txt: the default sitemap is https://www.1234tools.com/sitemap.xml and is written', defaults(rb.fields).sitemap);
  check(defaults(current('engine/dev-htaccess-generator.js').DEV_TOOLS['htaccess-generator'].fields).domain === '1234tools.com', '.htaccess: the default domain is 1234tools.com');
  const mt = current('engine/dev-meta-tag-generator.js').DEV_TOOLS['meta-tag-generator'];
  const md = defaults(mt.fields), mr = generate(mt, {});
  check(md.url === 'https://www.1234tools.com/' && md.image === 'https://www.1234tools.com/assets/img/og-image.png' && md.site === '1234Tools' && /1234Tools$/.test(md.title),
    'meta tags: the default URL, share image, site name and title are 1234Tools ones', JSON.stringify(md));
  check(fs.existsSync(path.join(ROOT, 'assets/img/og-image.png')), 'meta tags: the default share image exists in the site (assets/img/og-image.png)');
  check(stat(mr, 'Tags generated') === '14' && / — good$/.test(stat(mr, 'Title length') || '') && / — good$/.test(stat(mr, 'Description length') || ''),
    'meta tags: the default form writes 14 tags with a title and description of good length', (mr.stats || []).join(' | '));
}

/* ======================================================================
   13  URL encoder: + as a space
   ====================================================================== */

function testUrlPlus() {
  section('13  URL encoder: Treat + as space');
  const spec = current('engine/dev-url-encoder.js').DEV_TOOLS['url-encoder'];
  const opt = (spec.options || []).find((o) => o.key === 'plus');
  check(opt && opt.default === 'auto' && opt.options.map((o) => o.value).join() === 'auto,yes,no', 'the option exists: Auto (default), Yes, No', opt && JSON.stringify(opt.options));
  // expected values written out by hand from the form-encoding rules (WHATWG application/x-www-form-urlencoded)
  const CASES = [
    // [input, options, expected]
    ['salt+%2B+pepper', { dir: 'dec' }, 'salt + pepper'],                                   // Auto, Component: + is a space, %2B a plus
    ['salt+%2B+pepper', { dir: 'dec', plus: 'no' }, 'salt+++pepper'],                       // No: + kept, %2B decoded
    ['https://x.example/a+b?q=fish+chips', { dir: 'dec', scope: 'full' }, 'https://x.example/a+b?q=fish+chips'],   // Auto, Full URL: kept
    ['https://x.example/?q=fish+chips%20to%20go', { dir: 'dec', scope: 'full', plus: 'yes' }, 'https://x.example/?q=fish chips to go'],
    ['https://x.example/?q=1%2B1', { dir: 'dec', scope: 'full', plus: 'yes' }, 'https://x.example/?q=1%2B1'],    // decodeURI keeps reserved %2B
    ['caf%C3%A9+au+lait', { dir: 'dec' }, 'café au lait'],
    ['a b+c', { dir: 'enc' }, 'a%20b%2Bc'],                                                   // encoding never writes +
    ['a b+c', { dir: 'enc', plus: 'yes' }, 'a%20b%2Bc']
  ];
  for (const [inp, o, want] of CASES) {
    const r = transform(spec, inp, o);
    check(r.output === want, JSON.stringify(inp) + ' ' + JSON.stringify(o) + ' -> ' + JSON.stringify(want), r.output || r.error);
  }
  // against the platform's own form decoder, on random form strings
  let agree = 0, n = 0;
  const alphabet = 'ab +%2B%20é&=';
  for (let i = 0; i < 300; i++) {
    let t = ''; const len = 1 + (i % 9);
    for (let k = 0; k < len; k++) { const pick = (i * 7 + k * 13 + (i >> 2)) % 8; t += ['a', 'b', '+', '%2B', '%20', '%C3%A9', '%26', '%3D'][pick]; }
    n++;
    const want = new URLSearchParams('v=' + t).get('v');
    if (transform(spec, t, { dir: 'dec' }).output === want) agree++;
  }
  check(agree === n, 'Component scope, Auto: agrees with URLSearchParams on ' + n + ' form-encoded values', agree + '/' + n);
  check(stat(transform(spec, 'a+b+c', { dir: 'dec' }), 'Plus signs') === '2 read as spaces' && stat(transform(spec, 'a+b', { dir: 'dec', plus: 'no' }), 'Plus signs') === '1 kept as +' && stat(transform(spec, 'a+b', { dir: 'dec' }), 'Plus signs') === '1 read as a space',
    'the Plus signs row counts them and says what happened');
  const tip = (spec.tips || []).join(' ');
  check(!/Both decode to a space/.test(tip) && /Treat \+ as space/.test(tip), 'the tip no longer says both decode to a space, and names the option', tip);
  const old = beforeAt(BASE2, 'engine/dev-url-encoder.js');
  if (old) {
    const os = old.DEV_TOOLS['url-encoder'];
    check(transform(os, 'salt+%2B+pepper', { dir: 'dec' }).output === 'salt+++pepper' && /Both decode to a space/.test(os.tips.join(' ')),
      'BEFORE: reproduced — + never became a space, while the tip said both decode to a space');
  }
}

/* ======================================================================
   14  CSV to JSON: nested data, delimiters, header, types, download
   ====================================================================== */

function testCsv() {
  section('14  CSV to JSON: nested objects, delimiter, header, types');
  const spec = current('engine/dev-csv-to-json.js').DEV_TOOLS['csv-to-json'];
  const j = (r) => { try { return JSON.parse(r.output); } catch (e) { return { unparsed: r.output || r.error }; } };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // JSON -> CSV: nested objects flatten with dots, arrays and {} as JSON text (expected CSV written by hand)
  const DATA = [
    { id: 1, user: { name: 'Ann', address: { city: 'Leeds', zip: 'LS1' } }, tags: ['x', 'y'], meta: {} },
    { id: 2, user: { name: 'Bo, Jr', address: { city: 'York' } }, tags: [], ok: true, note: null }
  ];
  const WANT = 'id,user.name,user.address.city,user.address.zip,tags,meta,ok,note\n' +
    '1,Ann,Leeds,LS1,"[""x"",""y""]",{},,\n' +
    '2,"Bo, Jr",York,,[],,true,';
  const c = transform(spec, JSON.stringify(DATA), { dir: 'j2c' });
  check(c.output === WANT, 'JSON -> CSV: nested keys become a.b.c columns, arrays and {} JSON text, null empty', JSON.stringify(c.output));
  check(!/object Object/.test(c.output), 'JSON -> CSV: no [object Object] anywhere');
  check(stat(c, 'Dotted columns') === '3' && stat(c, 'Columns') === '8' && stat(c, 'Rows') === '2', 'JSON -> CSV: Columns 8, Rows 2, Dotted columns 3', (c.stats || []).join(' | '));
  check(transform(spec, JSON.stringify([{ a: 'x;y', b: 1 }]), { dir: 'j2c', delim: ';' }).output === 'a;b\n"x;y";1', 'JSON -> CSV with a semicolon: a value holding it is quoted');
  check(transform(spec, JSON.stringify([{ 'a,b': 1 }]), { dir: 'j2c' }).output === '"a,b"\n1', 'JSON -> CSV: a header holding the delimiter is quoted too');
  check(transform(spec, JSON.stringify([{ a: 1, b: 2 }]), { dir: 'j2c', header: 'no' }).output === '1,2', 'JSON -> CSV, First row is a header No: no header line');

  // and back: Nest + Infer types restores the original objects, except where CSV cannot say (missing vs empty, null)
  const back = j(transform(spec, WANT, { nest: 'nest', types: 'on' }));
  const WANT_BACK = [
    { id: 1, user: { name: 'Ann', address: { city: 'Leeds', zip: 'LS1' } }, tags: ['x', 'y'], meta: {}, ok: '', note: '' },
    { id: 2, user: { name: 'Bo, Jr', address: { city: 'York', zip: '' } }, tags: [], meta: '', ok: true, note: '' }
  ];
  check(same(back, WANT_BACK), 'CSV -> JSON with Nest and Infer types: the nested objects and arrays come back', JSON.stringify(back));
  const flat = j(transform(spec, WANT));
  check(flat[0]['user.address.city'] === 'Leeds' && flat[0].id === '1' && flat[0].tags === '["x","y"]', 'CSV -> JSON by default: dotted headers stay flat keys, values text', JSON.stringify(flat[0]));
  const clash = transform(spec, 'a,a.b\n1,2', { nest: 'nest' });
  check(same(j(clash), [{ a: '1', 'a.b': '2' }]) && /a\.b/.test(clash.warn || ''), 'Nest: a.b beside a plain a stays a flat key, with a warning', JSON.stringify(clash));

  // delimiter detection: each file holds the other delimiters inside quotes
  const FILES = [
    ['Semicolon', 'name;price\n"Tea, green";"2,50"\nCoffee;3', [{ name: 'Tea, green', price: '2,50' }, { name: 'Coffee', price: '3' }]],
    ['Comma', 'name,note\nA,"x;y;z"\nB,"p;q"', [{ name: 'A', note: 'x;y;z' }, { name: 'B', note: 'p;q' }]],
    ['Tab', 'a\tb\n"1,2"\t3', [{ a: '1,2', b: '3' }]],
    ['Pipe', 'a|b|c\n1|2|"x,y"\n4|5|6', [{ a: '1', b: '2', c: 'x,y' }, { a: '4', b: '5', c: '6' }]]
  ];
  for (const [name, text, want] of FILES) {
    const r = transform(spec, text);
    check(same(j(r), want) && stat(r, 'Delimiter') === name + ' (detected)', 'Detect: a ' + name.toLowerCase() + ' file', JSON.stringify(r.output) + ' ' + stat(r, 'Delimiter'));
  }
  check(stat(transform(spec, 'a;b\n1;2', { delim: ',' }), 'Delimiter') === 'Comma', 'a delimiter picked by hand is used as it is, and not called detected');
  check(defaults(spec.options).delim === 'auto', 'Detect is the default');

  // header toggle
  check(same(j(transform(spec, 'a,b\n1,2,3', { header: 'no' })), [{ column1: 'a', column2: 'b', column3: '' }, { column1: '1', column2: '2', column3: '3' }]),
    'First row is a header No: every row is data, keyed column1.. by the widest row');

  // type inference, off by default (expected values by hand)
  const CELLS = ['42', '-0.5', '6.02e23', 'true', 'FALSE', 'null', 'NULL', '007', '+1', '1.', '.5', '12345678901234567890', '0x1F', 'yes'];
  const WANT_T = [42, -0.5, 6.02e23, true, false, null, 'NULL', '007', '+1', '1.', '.5', '12345678901234567890', '0x1F', 'yes'];
  const typed = j(transform(spec, 'v\n' + CELLS.join('\n'), { types: 'on' })).map((o) => o.v);
  check(same(typed, WANT_T), 'Infer types: JSON numbers, true/false in any case, null; 007, +1, 1., .5, 0x1F and a 20-digit id stay text', JSON.stringify(typed));
  check(j(transform(spec, 'v\n42\ntrue')).every((o) => typeof o.v === 'string') && defaults(spec.options).types === 'off', 'Infer types is off by default: every value a string');

  // the download follows the direction
  transform(spec, 'a\n1');
  const d1 = spec.download && [spec.download.ext, spec.download.type].join(' ');
  transform(spec, '[{"a":1}]', { dir: 'j2c' });
  const d2 = spec.download && [spec.download.ext, spec.download.type].join(' ');
  check(d1 === 'json application/json' && d2 === 'csv text/csv', 'download: JSON saves as .json, CSV as .csv', d1 + ' / ' + d2);

  const old = beforeAt(BASE2, 'engine/dev-csv-to-json.js');
  if (old) {
    const os = old.DEV_TOOLS['csv-to-json'];
    check(/\[object Object\]/.test(transform(os, JSON.stringify(DATA), { dir: 'j2c' }).output), 'BEFORE: reproduced — nested objects were written as [object Object]');
    check(Object.keys(JSON.parse(transform(os, FILES[0][1]).output)[0]).length === 1 && !os.download, 'BEFORE: reproduced — a semicolon file came out as one column, and the download was a .txt');
  }
}

/* ======================================================================
   15  robots.txt exclusions under every policy; download names
   ====================================================================== */

function testRobotsExclusions() {
  section('15  robots.txt: exclusions under every policy; robots.txt and .htaccess file names');
  const spec = current('engine/dev-robots-txt-generator.js').DEV_TOOLS['robots-txt-generator'];
  const F = { disallow: 'admin/\n /cart/ \n\n/*.json$', sitemap: '', aibots: 'allow' };
  const WANT = 'User-agent: *\nDisallow: /admin/\nDisallow: /cart/\nDisallow: /*.json$\nAllow: /\n';
  check(generate(spec, Object.assign({ policy: 'allow' }, F)).output === WANT, 'Allow all: the typed exclusions are written, a / added where missing');
  check(generate(spec, Object.assign({ policy: 'custom' }, F)).output === WANT, 'an old link\'s policy=custom gives the same file');
  check(generate(spec, Object.assign({ policy: 'block' }, F)).output === 'User-agent: *\nDisallow: /\n', 'Block all: still exactly two lines (Disallow: / already covers every exclusion)');
  check(generate(spec, { policy: 'allow', disallow: '', sitemap: '', aibots: 'allow' }).output === 'User-agent: *\nAllow: /\n', 'Allow all with no exclusions: User-agent: * and Allow: /');
  const vals = (spec.fields.find((f) => f.key === 'policy') || {}).options.map((o) => o.value).join();
  check(vals === 'allow,block', 'the policy list is Allow all (except the paths below) and Block all', vals);
  check(spec.filename === 'robots.txt', 'robots.txt downloads as robots.txt', spec.filename);
  const ht = current('engine/dev-htaccess-generator.js').DEV_TOOLS['htaccess-generator'];
  check(ht.filename === '.htaccess', '.htaccess downloads as .htaccess', ht.filename);
  const old = beforeAt(BASE2, 'engine/dev-robots-txt-generator.js');
  if (old) {
    const o = generate(old.DEV_TOOLS['robots-txt-generator'], Object.assign({ policy: 'allow' }, F)).output;
    check(!/Disallow/.test(o) && !old.DEV_TOOLS['robots-txt-generator'].filename, 'BEFORE: reproduced — Allow all dropped the typed exclusions, and the file saved as output.txt');
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
   16  the QR renderers moved out of render-dev.js into render-qr.js
   ====================================================================== */

const SPLIT_BASE = '364240974';                 // render-dev.js with the QR code still in it
const QR_START = '  /* ---------------- QR ---------------- */\n';
const QR_END = '  /* ---------------- file in, images out ---------------- */\n';
const QR_HELPERS = ['el', 'copyButton', 'downloadButton', 'buildField', 'linkParams', 'announce', 'renderStats', 'loadZip'];

/** A top-level helper's text: from its declaration (with the comment just
 *  above it) to the line that closes it at the same indent. */
function helperText(src, name) {
  const lines = src.split('\n');
  const at = lines.findIndex((l) => new RegExp('^  (async )?function ' + name + '\\b|^  (const|let) ' + name + '\\b').test(l));
  if (at < 0) return null;
  let from = at;
  while (from > 0 && /^  (\/\*|   |\*\/| \*)/.test(lines[from - 1]) && !/^  \}/.test(lines[from - 1])) from--;
  let to = at;
  if (!/;\s*$/.test(lines[at]) || /\{\s*$/.test(lines[at])) { while (to < lines.length && lines[to] !== '  }') to++; }
  return lines.slice(from, to + 1).join('\n');
}
/** What a renderer registers on window.MVRTool, run in a vm with a stub window. */
function registers(rel) {
  const ctx = context({ MVRTool: undefined, document: { addEventListener() {} } });
  ctx.MVRTool = undefined;
  runIn(ctx, fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel);
  return Object.keys(ctx.MVRTool || {}).sort();
}
/** Every page of the site that calls one of these mounts: rel path → html. */
function pagesCalling(re) {
  const out = {};
  const walk = (dir) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.isDirectory()) { if (!/^(\.|node_modules$|engine$|build$|assets$)/.test(d.name)) walk(path.join(dir, d.name)); }
      else if (d.name.endsWith('.html')) {
        const f = path.join(dir, d.name), html = fs.readFileSync(f, 'utf8');
        if (re.test(html)) out[path.relative(ROOT, f).replace(/\\/g, '/')] = html;
      }
    }
  };
  walk(ROOT);
  return out;
}
const loads = (html, file) => new RegExp('<script src="/engine/' + file.replace('.', '\\.') + '"').test(html);

function testQrSplit() {
  section('16  QR renderers: their own file, moved verbatim');
  const dev = fs.readFileSync(path.join(ROOT, 'engine/render-dev.js'), 'utf8');
  const qrPath = path.join(ROOT, 'engine/render-qr.js');
  if (!fs.existsSync(qrPath)) { check(false, 'engine/render-qr.js exists'); return; }
  const qr = fs.readFileSync(qrPath, 'utf8');

  // what each registers, run in Node
  let r1 = [], r2 = [];
  try { r1 = registers('engine/render-qr.js'); } catch (e) { check(false, 'render-qr.js loads in Node', e.message); }
  try { r2 = registers('engine/render-dev.js'); } catch (e) { check(false, 'render-dev.js loads in Node', e.message); }
  check(r1.join() === 'mountQR,mountQRBulk,mountQRScanner', 'render-qr.js registers mountQR, mountQRBulk and mountQRScanner, and nothing else', r1.join());
  check(r2.join() === '_zipStore,mountCode,mountFile,mountGenerate', 'render-dev.js registers mountCode, mountGenerate, mountFile and _zipStore, and no QR mount', r2.join());
  check(!/function mountQR|QR_TYPES|function svgToPngBlob|BULK_LIMIT|classifyPayload/.test(dev), 'render-dev.js holds none of the QR code');

  // verbatim: the QR section of render-dev.js as it was, inside render-qr.js unchanged
  const old = oldSrcAt(SPLIT_BASE, 'engine/render-dev.js');
  if (old === null) skip('git show ' + SPLIT_BASE + ':engine/render-dev.js is not available: the verbatim checks are skipped');
  else {
    const a = old.indexOf(QR_START), b = old.indexOf(QR_END);
    const block = a >= 0 && b > a ? old.slice(a, b).replace(/\n+$/, '\n') : null;
    /* The move itself was verbatim (wave 0-A, 6 October 2026); wave 4 then
       extended render-qr.js (PDF/EPS, frames, barcodes, label sheets), so
       the check is now that every top-level function of the old section is
       still there, by name, rather than the old text byte for byte. The
       render-dev.js side below still proves exactly that section left it. */
    const fnNames = block ? (block.match(/^  (?:async )?function ([A-Za-z0-9_]+)/gm) || []).map((l) => l.replace(/^  (?:async )?function /, '')) : [];
    const lost = fnNames.filter((n) => !new RegExp('^  (?:async )?function ' + n + '\\b', 'm').test(qr));
    check(block && block.length > 100000 && fnNames.length >= 10 && lost.length === 0,
      'every top-level function of the QR section of render-dev.js at ' + SPLIT_BASE + ' (' + fnNames.length + ', mountQR through svgToPngBlob) is still in render-qr.js', lost.join(', ') || (block ? block.length : 'markers not found'));
    // and render-dev.js is what it was, less that section and its three exports, apart from the text and
    // form shells (mountCode, mountGenerate) that wave 3 rebuilt; those are tested in section 17
    const oldLess = block ? (old.slice(0, a) + old.slice(b)).replace(/^  window\.MVRTool\.mountQR(Scanner|Bulk)? = mountQR(Scanner|Bulk)?;\n/gm, '') : null;
    const cut = (t, endMark) => { const i = t.indexOf('(function () {'), j = t.indexOf(endMark); return i < 0 || j < 0 ? null : t.slice(i, j); };
    // the file-in shell: its sizes table before mountFile, and makeIco onwards, are unchanged; mountFile
    // itself gained the favicon generator's hooks in wave 3 (prefix, extraFiles, setSource), tested in section 19
    const sizes = (t) => { const i = t.indexOf('  /* ---------------- file in, images out ---------------- */'), j = t.indexOf('  function mountFile('); return i < 0 || j < i ? null : t.slice(i, j); };
    const tail = (t) => { const i = t.indexOf('  async function makeIco('); return i < 0 ? null : t.slice(i); };
    const headOld = oldLess && cut(oldLess, '  /* ---------------- text in, code out ---------------- */');
    const headNew = cut(dev, '  /* ---------------- the shell\'s shared machinery (wave 3) ----------------');
    check(!!headOld && headOld === headNew && !!tail(oldLess) && tail(oldLess) === tail(dev) && !!sizes(oldLess) && sizes(oldLess) === sizes(dev),
      'render-dev.js outside the rebuilt shells is unchanged: the helpers and safe preview before them, the favicon sizes table, makeIco and the ZIP loader after, line for line', 'differs');
    // the helpers the QR code calls are copies of render-dev.js's, identical to the old ones and to today's
    const bad = QR_HELPERS.filter((n) => { const x = helperText(qr, n); return !x || x !== helperText(dev, n) || x !== helperText(old, n); });
    check(bad.length === 0, 'the ' + QR_HELPERS.length + ' helpers render-qr.js keeps a copy of (' + QR_HELPERS.join(', ') + ') are identical to render-dev.js\'s', bad.join(', '));
  }

  // the pages: QR mounts load render-qr.js and not render-dev.js; the developer mounts still load render-dev.js
  const qrPages = pagesCalling(/MVRTool\.mountQR(Scanner|Bulk)?\(/);
  const qrNames = Object.keys(qrPages).sort();
  check(qrNames.join() === 'qr/qr-bulk-generator/index.html,qr/qr-code-generator/index.html,qr/qr-code-scanner/index.html' &&
    qrNames.every((f) => loads(qrPages[f], 'render-qr.js') && !loads(qrPages[f], 'render-dev.js')),
    'the three QR pages, and only they, mount a QR renderer; each loads /engine/render-qr.js and not /engine/render-dev.js', qrNames.map((f) => f + ' qr=' + loads(qrPages[f], 'render-qr.js') + ' dev=' + loads(qrPages[f], 'render-dev.js')).join(' | '));
  const devPages = pagesCalling(/MVRTool\.mount(Code|Generate|File)\(/);
  const missing = Object.keys(devPages).filter((f) => !loads(devPages[f], 'render-dev.js'));
  check(Object.keys(devPages).length >= 30 && missing.length === 0, 'all ' + Object.keys(devPages).length + ' pages that mount a developer or text renderer still load /engine/render-dev.js', missing.join(', '));
}

/* ======================================================================
   18  Wave 3 tools: lorem ipsum, slugs, case, number to words
   ====================================================================== */

function testWave3Small() {
  section('18  Lorem ipsum (opening, bytes, formats), slugs (Hindi, Latin, length), case (dot, path, alternating), number to words (US, cheque)');
  const L = current('engine/dev-lorem-ipsum.js').DEV_TOOLS['lorem-ipsum'];
  const OPEN = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
  const sizes = [1, 3, 30, 123, 255, 256, 1000, 65535, 100000];
  const badB = sizes.filter((n) => { const o = generate(L, { unit: 'bytes', count: n }).output; return Buffer.byteLength(o, 'utf8') !== n || /\s$/.test(o); });
  check(badB.length === 0, 'Bytes: exactly n UTF-8 bytes (Buffer.byteLength) for ' + sizes.join(', ') + ', never ending in a space', badB.join(', '));
  check(generate(L, {}).output.indexOf(OPEN) === 0 && generate(L, { classic: 'no' }).output.indexOf('Lorem ipsum dolor sit amet,') !== 0 && generate(L, { flavour: 'english' }).output.indexOf('Lorem') !== 0,
    'the classic opening leads Latin by default, and not when unticked or in English');
  const h2 = generate(L, { unit: 'paragraphs', count: 4, wrap: 'h2' }).output;
  check((h2.match(/<h2>[^<]+<\/h2>\n<p>[^<]+<\/p>/g) || []).length === 4, 'headings and paragraphs: four <h2> each followed by a <p>', h2.slice(0, 80));
  const ol = generate(L, { unit: 'items', count: 5, wrap: 'ol' }).output.split('\n');
  check(ol.length === 7 && ol[0] === '<ol>' && ol[6] === '</ol>' && ol.slice(1, 6).every((l) => /^  <li>[A-Z][^<]*\.<\/li>$/.test(l)), 'five list items as an <ol>: 7 lines', ol.length);
  const md = generate(L, { unit: 'paragraphs', count: 3, wrap: 'md' }).output;
  check((md.match(/^## [A-Z]/gm) || []).length === 3 && (md.match(/^- [A-Z]/gm) || []).length === 3, 'Markdown: three ## headings and a three-item list', md.slice(0, 60));
  const big = generate(L, { unit: 'paragraphs', count: 500 });
  check(/most at once is 100/.test(big.warn || '') && big.output.split('\n\n').length === 100, 'asking for 500 paragraphs gives 100 and says so', big.warn);

  const S = current('engine/dev-slug-generator.js').DEV_TOOLS['slug-generator'];
  const sl = (t, o) => transform(S, t, o).output;
  const HINDI = { 'नमस्ते': 'namaste', 'भारत': 'bharat', 'हिंदी': 'hindi', 'दिल्ली': 'dilli', 'मुंबई': 'mumbai', 'कोलकाता': 'kolkata', 'पटना': 'patna', 'नागपुर': 'nagpur',
    'शिक्षा': 'shiksha', 'ज्ञान': 'gyan', 'प्रदेश': 'pradesh', 'मित्र': 'mitra', 'समझना': 'samajhna', 'पढ़ना': 'padhna', 'राष्ट्रीय': 'rashtriya', 'सरकार': 'sarkar', 'अदालत': 'adalat' };
  const badH = Object.keys(HINDI).filter((h) => sl(h) !== HINDI[h]).map((h) => h + '→' + sl(h));
  check(badH.length === 0, Object.keys(HINDI).length + ' Hindi words come out in their usual Latin spelling (written out by hand)', badH.join(' '));
  check(sl('Łódź & Straße: Große Æsthetik') === 'lodz-and-strasse-grosse-aesthetik' && sl('Grüße', { german: 'yes' }) === 'gruesse' && sl('Grüße') === 'grusse',
    'Ł, ß and Æ are spelt out; German style turns ü into ue', sl('Łódź & Straße: Große Æsthetik'));
  let badM = 0;
  for (let i = 0; i < 200; i++) {
    const t = 'alpha beta gamma delta epsilon zeta eta theta iota kappa'.split(' ').slice(0, 2 + (i % 8)).join(' ');
    const max = 3 + (i % 37);
    const got = sl(t, { max: String(max) });
    let ref = ''; for (const w of sl(t).split('-')) { const n = ref ? ref + '-' + w : w; if (n.length <= max) ref = n; else break; }
    if (!ref) ref = sl(t).slice(0, max);
    if (got !== ref) badM++;
  }
  check(badM === 0, 'Maximum length: 200 cuts equal a whole-word reference', badM);
  const em = transform(S, 'Ελλάδα\nok');
  check(em.output === '\nok' && /Line 1 has no letters/.test(em.warn || ''), 'a Greek-only line gives an empty slug and a warning naming the line', em.warn);

  const C = current('engine/dev-case-converter.js').DEV_TOOLS['case-converter'];
  const cc = (t, target) => transform(C, t, { target }).output;
  check(cc('src/components/NavBar', 'dot') === 'src.components.nav.bar' && cc('app.cache.maxSize', 'path') === 'app/cache/max/size' && cc('hello world 42 ok', 'alternating') === 'hElLo WoRlD 42 oK',
    'dot.case, path/case and alternating case', [cc('src/components/NavBar', 'dot'), cc('hello world 42 ok', 'alternating')].join(' | '));
  const all = cc('order total', 'all').split('\n');
  check(all.length === 12 && all[2] === 'snake_case    order_total' && all[9] === 'aLtErNaTiNg   oRdEr ToTaL', 'Every case at once: twelve rows', all.join(' / '));

  const W = current('engine/txt-number-to-words.js').TEXT_TOOLS['number-to-words'];
  const nw = (t, o) => transform(W, t, o).output;
  check(nw('120\n1000005', { dialect: 'us' }) === 'One hundred twenty\nOne million five' && nw('120\n1000005') === 'One hundred and twenty\nOne million and five',
    'American English drops the and inside the number; British keeps it');
  check(nw('1234.56\n0.999\n50', { style: 'cheque', dialect: 'us' }) === 'One thousand two hundred thirty-four and 56/100 dollars\nOne and 00/100 dollars\nFifty and 00/100 dollars',
    'US cheque form: cents as /100, rounded half up (0.999 is 1.00)', nw('1234.56\n0.999\n50', { style: 'cheque', dialect: 'us' }));
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

/* OKLab from Björn Ottosson's published matrices (2020), written here from the
   paper, not from the engine: sRGB hex -> OKLab, and back with clipping. */
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function hexToOklab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => srgbToLin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklabToHex([L, A, B]) {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  return '#' + rgb.map((c) => Math.round(Math.max(0, Math.min(1, linToSrgb(Math.max(0, c)))) * 255).toString(16).padStart(2, '0')).join('');
}

function testGradient() {
  section('19  CSS gradient: stop positions as CSS fills them, fallback colour, OKLab blend, Tailwind, centre');
  const G = current('engine/dev-css-gradient.js').DEV_TOOLS['css-gradient'];
  const g = (f) => generate(G, f);
  const a = g({ stops: '#ff0000, #0000ff 30%, #008000, #ffff00 10%, #000000', fallback: 'no' });
  // CSS Images 3, "color stop fixup": first 0%, last 100%, a position below an earlier one is raised to it,
  // missing ones shared evenly between their neighbours (30% and the raised 30%)
  check(a.preview === 'linear-gradient(120deg, #ff0000 0%, #0000ff 30%, #008000 30%, #ffff00 30%, #000000 100%)', 'missing and backwards positions are filled in as CSS fills them', a.preview);
  const two = g({ stops: '#0000ff, #ffff00' });
  check(two.output === 'background: #808080;\nbackground: linear-gradient(120deg, #0000ff 0%, #ffff00 100%);', 'sRGB: the fallback is the halfway colour, (0+255)/2 rounded = 0x80 in each channel, written first', two.output);
  const pa = hexToOklab('#0000ff'), pb = hexToOklab('#ffff00');
  const mid = oklabToHex(pa.map((v, i) => (v + pb[i]) / 2));
  const ok = g({ stops: '#0000ff, #ffff00', space: 'oklab' });
  check(ok.fallback === mid && /^linear-gradient\(120deg in oklab, /.test(ok.preview), 'OKLab: "in oklab" in the value, and the fallback equals an independent OKLab midpoint (' + mid + ')', ok.fallback);
  let badMid = 0;
  for (let i = 0; i < 40; i++) {
    const h = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    const x = h(), y = h();
    const want = oklabToHex(hexToOklab(x).map((v, k) => (v + hexToOklab(y)[k]) / 2));
    const got = g({ stops: x + ', ' + y, space: 'oklab' }).fallback;
    const diff = [1, 3, 5].reduce((m, k) => Math.max(m, Math.abs(parseInt(want.slice(k, k + 2), 16) - parseInt(got.slice(k, k + 2), 16))), 0);
    if (diff > 1) badMid++;
  }
  check(badMid === 0, 'OKLab midpoints of 40 random pairs are within 1/255 of the reference', badMid);
  check(two.tailwind === 'bg-[#808080] bg-[linear-gradient(120deg,#0000ff_0%,#ffff00_100%)]', 'Tailwind: an arbitrary value, spaces as _ and none after commas, the fallback class first', two.tailwind);
  const r = g({ type: 'radial', shape: 'ellipse', cx: 30, cy: 40, fallback: 'no' });
  check(/^radial-gradient\(ellipse at 30% 40%, /.test(r.preview), 'radial: shape and a typed centre', r.preview);
  const c = g({ type: 'conic', stops: '#e63946 25%, #e9ecef 25%' });
  const hard = (c.stats || []).find((s) => s[0] === 'Hard edges');
  check(/^conic-gradient\(from 120deg at 50% 50%, #e63946 25%, #e9ecef 25%\)$/.test(c.preview) && hard && hard[1] === '1' && c.fallback === '#e9ecef', 'conic: two stops at 25% are one hard edge; halfway round is the second colour', JSON.stringify(hard) + ' ' + c.fallback);
  const bad = g({ stops: '#ffe29a 0%, nope' });
  check(/Stop 2/.test(bad.error || ''), 'a bad stop is named by its number', bad.error);
}

function testJsonFormatter() {
  section('20  JSON formatter: Repair recovers the value from JSON5-style text; outputs round-trip');
  const J = current('engine/dev-json-formatter.js').DEV_TOOLS['json-formatter'];
  let seed = 7;
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
  const word = () => ['alpha', 'beta', 'x1', '_id', '$ref', 'name', 'v'][rnd(7)];
  const value = (d) => {
    const k = d > 3 ? rnd(4) : rnd(6);
    if (k === 0) return rnd(2000) - 1000;
    if (k === 1) return ['plain', 'it\'s', 'say "hi"', 'a\\b', 'tab\there', ''][rnd(6)];
    if (k === 2) return [true, false, null][rnd(3)];
    if (k === 3) return rnd(100) / 8;
    if (k === 4) { const a = []; for (let i = rnd(4); i > 0; i--) a.push(value(d + 1)); return a; }
    const o = {}; for (let i = rnd(4); i > 0; i--) o[word() + rnd(9)] = value(d + 1); return o;
  };
  // JSON5-ish writer: bare keys where they are identifiers, single quotes where safe, trailing commas, comments
  const loose = (v) => {
    if (Array.isArray(v)) return '[' + v.map(loose).join(', ') + (v.length && rnd(2) ? ',' : '') + (rnd(3) ? '' : ' /* end */') + ']';
    if (v && typeof v === 'object') {
      const ks = Object.keys(v);
      return '{' + ks.map((k) => (/^[A-Za-z_$][\w$]*$/.test(k) && rnd(2) ? k : JSON.stringify(k)) + ': ' + loose(v[k]) + (rnd(4) ? '' : ' // note\n')).join(', ') + (ks.length && rnd(2) ? ',' : '') + '}';
    }
    if (typeof v === 'string' && !/['"\\]/.test(v) && rnd(2)) return "'" + v.replace(/\t/g, '\\t') + "'";
    return JSON.stringify(v);
  };
  let bad = [], mutated = 0;
  for (let i = 0; i < 300; i++) {
    const v = { root: value(0) };
    const t = loose(v);
    let strict = true; try { JSON.parse(t); } catch (e) { strict = false; }
    if (!strict) mutated++;
    const r = transform(J, t, { repair: 'yes', mode: 'minify' });
    if (r.error || r.output !== JSON.stringify(v)) bad.push(t.slice(0, 60) + ' → ' + (r.error || r.output).slice(0, 60));
    else if (r.fixed !== undefined && JSON.stringify(JSON.parse(r.fixed)) !== JSON.stringify(v)) bad.push('fixed text differs: ' + t.slice(0, 60));
  }
  check(bad.length === 0 && mutated > 200, '300 random documents written JSON5-style (' + mutated + ' not strict JSON): Repair gives back exactly the original value, and its repaired text parses to it', bad.slice(0, 2).join(' | '));
  let badFmt = 0;
  for (let i = 0; i < 200; i++) {
    const v = value(0), t = JSON.stringify(v);
    const pretty = transform(J, t, { indent: '4' }).output, min = transform(J, t, { mode: 'minify' }).output;
    if (pretty !== JSON.stringify(v, null, 4) || min !== t) badFmt++;
  }
  check(badFmt === 0, '200 random documents: formatted equals JSON.stringify(v, null, 4), minified equals JSON.stringify(v)', badFmt);
  const strictRefused = transform(J, '{a:1}');
  check(!!strictRefused.error && strictRefused.repairable === 1, 'without Repair ticked, a repairable fault is refused and the number of changes Repair would make is offered', JSON.stringify({ e: !!strictRefused.error, n: strictRefused.repairable }));
  const stuck = transform(J, '{"a": }', { repair: 'yes' });
  check(/^Repair stopped at line 1, column 7/.test(stuck.error || ''), 'a value missing after its colon stops Repair, at the place', stuck.error);
}

function testRegex() {
  section('21  Regex tester: matches, groups, replace and split agree with the native engine; flags; the explanation');
  const R = current('engine/dev2-regex-tester.js').DEV_TOOLS['regex-tester'];
  const PATTERNS = ['\\d+', '(\\w)(\\w)?', '(?<y>\\d{4})-(?<m>\\d\\d)', 'a|b|', '[^\\s,]+', '(x)?y', '\\b\\w', '.', '(?:ab)+?', '^\\w+$', '(?=a)', '(\\d)\\1'];
  const TEXTS = ['', 'abc 123, 2026-10 x1 y', 'aaa\nbbb\n2027-01', 'xy y ab abab 11 22 3', '😀a1 é2'];
  const FLAGS = ['g', 'gi', 'gm', 'gu', 'gs', 'gy', ''];
  let bad = [], n = 0;
  for (const pat of PATTERNS) for (const t of TEXTS) for (const f of FLAGS) {
    n++;
    const re = new RegExp(pat, f);
    const want = f.indexOf('g') >= 0 ? [...t.matchAll(re)].slice(0, 10000) : (re.exec(t) ? [re.exec(t)] : []);
    const r = transform(R, t, { pattern: pat, flags: f, view: 'matches' });
    const rows = r.rows || [];
    if (!t) { if (!/Paste some text/.test(r.note || '')) bad.push('empty text: ' + r.note); continue; }   // empty text: the tool asks for text instead of matching
    const same = rows.length === want.length && rows.every((x, k) => x.i === want[k].index && x.t === want[k][0] &&
      JSON.stringify(x.g) === JSON.stringify(want[k].slice(1).map((v) => (v === undefined ? null : v))));
    if (!same) { bad.push(pat + '/' + f + ' on ' + JSON.stringify(t).slice(0, 20) + ': ' + rows.length + ' v ' + want.length); continue; }
    const rep = transform(R, t, { pattern: pat, flags: f, view: 'replace', replacement: '<$&|$1>' });
    if (rep.output !== t.replace(new RegExp(pat, f), '<$&|$1>')) bad.push('replace ' + pat + '/' + f);
    const sp = transform(R, t, { pattern: pat, flags: f, view: 'split' });
    const parts = t.split(new RegExp(pat, f));
    if (sp.output !== parts.map((p, i) => String(i).padStart(3) + '  ' + p).join('\n')) bad.push('split ' + pat + '/' + f);
  }
  check(bad.length === 0, n + ' pattern, text and flag combinations: every match, index and group, the replace and the split equal matchAll, String.replace and String.split', bad.slice(0, 3).join(' | '));
  const named = transform(R, '2026-10', { pattern: '(?<y>\\d{4})-(?<m>\\d\\d)', view: 'replace', replacement: '$<m>/$<y>' });
  check(named.output === '10/2026', 'named groups in the replacement', named.output);
  const order = transform(R, 'a', { pattern: 'a', flags: 'ygimd' });
  check(order.stats.find((s) => s[0] === 'Flags')[1] === new RegExp('a', 'ygimd').flags, 'flags in any order are written as RegExp writes them', JSON.stringify(order.stats));
  const uv = transform(R, 'a', { pattern: 'a', flags: 'uv' });
  check(/u and v/.test(uv.error || ''), 'u with v is refused with the reason', uv.error);
  const ex = transform(R, 'x', { pattern: '^(?:[A-Z]{2}\\d{1,2})\\s?\\d[A-Z]{2}$', flags: 'i' });
  const txt = (ex.explain || []).map((x) => x.txt).join(' | ');
  check(/start/i.test(txt) && /end/i.test(txt) && /1 to 2 times|between 1 and 2/i.test(txt) && /exactly 2 times/.test(txt) && /optional|0 or 1|zero or one/i.test(txt), 'a UK postcode pattern is explained part by part', txt.slice(0, 160));
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
    await testDownloads(browser, watch);
    await testQrPages(browser, watch);
    await testShell(browser, watch);
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

/* ---------- 14, 15  what the Download buttons save ---------- */

async function downloadOne(page, dir, label) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  await page.evaluate((l) => { [...document.querySelectorAll('button')].find((x) => x.textContent === l).click(); }, label);
  for (let i = 0; i < 50; i++) {
    const f = fs.readdirSync(dir).filter((n) => !/\.crdownload$/.test(n));
    if (f.length && !fs.readdirSync(dir).some((n) => /\.crdownload$/.test(n))) return { name: f[0], body: fs.readFileSync(path.join(dir, f[0]), 'utf8') };
    await sleep(100);
  }
  return null;
}

function testBase64Bytes() {
  section('22  Base64: bytes in and out agree with Node\'s Buffer; wrapping, URL-safe, data URIs and file kinds');
  const B = current('engine/dev-base64.js').DEV_TOOLS['base64'];
  let seed = 11;
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
  const bytesOf = (n) => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = rnd(256); return b; };
  let bad = [];
  for (let n = 0; n <= 300; n++) {
    const b = bytesOf(n);
    const std = b.toString('base64');
    const dec = transform(B, std, { dir: 'dec' });
    // decoded bytes: text when they are UTF-8 text, otherwise the exact bytes ride in res.bytes
    const got = dec.bytes ? Buffer.from(dec.bytes) : Buffer.from(dec.output || '', 'utf8');
    if (n > 0 && !got.equals(b)) bad.push(n + ' bytes: ' + (dec.error || 'bytes differ'));
    const url = transform(B, b.toString('base64url'), { dir: 'dec' });
    const gotUrl = url.bytes ? Buffer.from(url.bytes) : Buffer.from(url.output || '', 'utf8');
    if (n > 0 && !gotUrl.equals(b)) bad.push(n + ' bytes url-safe: ' + (url.error || 'bytes differ'));
  }
  check(bad.length === 0, 'every length 0–300 of random bytes: standard and base64url Base64 from Buffer decodes to the same bytes', bad.slice(0, 3).join('; '));
  bad = [];
  for (let n = 1; n <= 200; n++) {
    let t = ''; for (let i = 0; i < n; i++) t += ['a', 'é', '₹', '😀', ' ', '>', '?', '~'][rnd(8)];
    const raw = Buffer.from(t, 'utf8');
    const std = raw.toString('base64');
    const e = transform(B, t).output, u = transform(B, t, { safe: 'url' }).output;
    if (e !== std) bad.push('std ' + n);
    if (u !== raw.toString('base64url')) bad.push('url ' + n);
    for (const w of [64, 76]) {
      const ref = std.match(new RegExp('.{1,' + w + '}', 'g')).join('\n');
      if (transform(B, t, { wrap: String(w) }).output !== ref) bad.push('wrap ' + w + ' ' + n);
    }
    const uri = transform(B, t, { form: 'uri' }).output;
    if (uri !== 'data:text/plain;charset=utf-8;base64,' + std) bad.push('uri ' + n);
    const back = transform(B, uri, { dir: 'dec' });
    if (back.output !== t) bad.push('uri back ' + n);
  }
  check(bad.length === 0, '200 random texts: Standard, URL-safe, 64- and 76-character lines and the data URI equal Node\'s Buffer and string splitting, and the URI decodes back', bad.slice(0, 3).join('; '));
  // file kinds by their magic numbers
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), jpg = Buffer.from('ffd8ffe000104a464946', 'hex'), pdf = Buffer.from('%PDF-1.7\n%âãÏÓ\n', 'latin1'), zip = Buffer.from('504b03040a000000', 'hex');
  const kinds = [[png, 'PNG image', 'png', true], [jpg, 'JPEG image', 'jpg', true], [pdf, 'PDF document', 'pdf', false], [zip, 'ZIP archive', 'zip', false], [Buffer.from([0, 1, 2, 3, 250, 251]), 'Binary data', 'bin', false]];
  const wrong = [];
  for (const [b, kind, ext, img] of kinds) {
    const r = transform(B, b.toString('base64'), { dir: 'dec' });
    if (stat(r, 'Content') !== kind || r.download.ext !== ext || !!r.image !== img || !/^00000000  /.test(r.output)) wrong.push(kind + ' → ' + stat(r, 'Content') + '/' + (r.download && r.download.ext));
  }
  check(wrong.length === 0, 'PNG, JPEG, PDF, ZIP and unknown bytes are named, get the right extension, and show a hex view (images get a preview)', wrong.join('; '));
  const hex = transform(B, Buffer.from('Hello, hex view!\u0001').toString('base64'), { dir: 'dec' });
  check(Buffer.from('Hello, hex view!\u0001').toString('base64').length && /^00000000  48 65 6c 6c 6f 2c 20 68  65 78 20 76 69 65 77 21  \|Hello, hex view!\|\n00000010  01 +\|\.\|$/.test(hex.output), 'hex view layout (the `hexdump -C` shape: offset, 8 + 8 bytes, ASCII column) on a 17-byte file', JSON.stringify(hex.output));
  const svg = transform(B, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'), { dir: 'dec' });
  check(stat(svg, 'Content') === 'SVG image' && svg.download.ext === 'svg' && !!svg.image, 'decoded SVG text is shown as text, named an SVG and previewed');
  // errors name the place
  const e1 = transform(B, 'QUJD\nRE*F', { dir: 'dec' });
  check(e1.errorAt && e1.errorAt.line === 2 && e1.errorAt.col === 3, 'a stray character on line 2 is reported at line 2, column 3', JSON.stringify(e1.errorAt));
  const e2 = transform(B, 'QUJDR', { dir: 'dec' });
  check(!!e2.error && /cut off/.test(e2.error), 'five characters (4n+1) are refused as cut off', e2.error);
  const e3 = transform(B, 'QU=JD', { dir: 'dec' });
  check(!!e3.error && /padding/.test(e3.error), 'padding in the middle is refused', e3.error);
}

function testUrlForms() {
  section('23  URL encoder: Form scope, the query table, each line; agree with URLSearchParams');
  const U = current('engine/dev-url-encoder.js').DEV_TOOLS['url-encoder'];
  let seed = 99;
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
  const alpha = ['a', 'Q', '7', ' ', '!', "'", '(', ')', '~', '*', '-', '_', '.', '&', '=', '+', '%', 'ü', '₹', '😀', '/', '?', '#', ':', '@'];
  const rs = () => { let t = ''; for (let i = rnd(10); i >= 0; i--) t += alpha[rnd(alpha.length)]; return t; };
  let badE = 0, badD = 0, badT = 0, badB = 0;
  for (let i = 0; i < 400; i++) {
    const s = rs();
    if (!s.trim()) continue;
    const enc = transform(U, s, { scope: 'form' }).output;
    if (enc !== new URLSearchParams({ v: s }).toString().slice(2)) badE++;
    if (transform(U, enc, { dir: 'dec', scope: 'form' }).output !== s) badD++;
    const sp = new URLSearchParams(); const n = 1 + rnd(5); for (let k = 0; k < n; k++) sp.append('k' + rnd(3), rs());
    const qs = sp.toString();
    const tab = transform(U, qs, { dir: 'table' });
    const ref = [...sp].map((p) => p[0] + '\t' + p[1]).join('\n');
    if (tab.output !== ref) badT++;
    // table -> query string, Form scope, gives a string URLSearchParams reads to the same pairs
    const back = transform(U, ref, { dir: 'build', scope: 'form' });
    if (!/[\n\r]/.test(ref.replace(/\n/g, '')) && JSON.stringify([...new URLSearchParams(back.output)]) !== JSON.stringify([...sp])) badB++;
  }
  check(badE === 0 && badD === 0, 'Form scope: encoding equals URLSearchParams and decodes back, on 400 random strings', badE + ' / ' + badD);
  check(badT === 0, 'Query string → table lists exactly the pairs URLSearchParams reads (names, values, order, repeats)', badT);
  check(badB === 0, 'Table → query string builds text that URLSearchParams reads back to the same pairs', badB);
  const lines = transform(U, 'x y\n%zz\n\nü', { lines: 'each' });
  check(lines.output === 'x%20y\n%25zz\n\n%C3%BC' && !lines.warn, 'Each line separately encodes every line, blank ones stay blank', JSON.stringify(lines.output));
  const dl = transform(U, 'x%20y\n%zz\n%C3%BC', { dir: 'dec', lines: 'each' });
  check(dl.output === 'x y\n%zz\nü' && /^Line 2 is not valid/.test(dl.warn), 'Each line separately decodes the good lines and names the bad one', JSON.stringify([dl.output, dl.warn]));
  const solo = transform(U, '\ud83d', {});
  check(!!solo.error && /surrogate/.test(solo.error), 'a lone surrogate half is refused with its own message, not the % one', solo.error);
}

function testCsvPython() {
  section('24  CSV to JSON: quoting, line ends and parsing agree with Python\'s csv module; JSON Lines; BOM');
  const C = current('engine/dev-csv-to-json.js').DEV_TOOLS['csv-to-json'];
  try { execFileSync('python', ['--version'], { stdio: 'ignore' }); } catch (e) { skip('python is not installed: the csv.writer / csv.DictReader comparisons are skipped'); return; }
  const py = (code, input) => execFileSync('python', ['-X', 'utf8', '-c', code], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }) });
  let seed = 31;
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
  const pieces = ['a', 'b c', 'x,y', 'say "hi"', 'é', '₹5', '😀', 'line1\nline2', ';', '|', 'Q', '12', '007'];
  const str = () => { let t = ''; for (let i = rnd(3); i >= 0; i--) t += pieces[rnd(pieces.length)]; return t.trim() === t ? t : t.trim() + 'z'; };
  const keys = ['id', 'name', 'note', 'qty'];
  const data = [];
  for (let i = 0; i < 120; i++) data.push({ id: rnd(100000), name: str(), note: str(), qty: rnd(50) });
  const writeCode = 'import csv,io,json,sys\nd=json.load(sys.stdin)\nq={"min":csv.QUOTE_MINIMAL,"all":csv.QUOTE_ALL,"text":csv.QUOTE_NONNUMERIC}[d["quote"]]\nf=io.StringIO(newline="")\nw=csv.writer(f,delimiter=d["delim"],quoting=q,lineterminator=d["eol"])\nw.writerow(d["keys"])\nfor r in d["rows"]: w.writerow([r[k] for k in d["keys"]])\nsys.stdout.buffer.write(f.getvalue().encode("utf8"))';
  const bad = [];
  for (const quote of ['min', 'all', 'text']) for (const [eol, term] of [['lf', '\n'], ['crlf', '\r\n']]) for (const delim of [',', ';', '\t']) {
    const want = py(writeCode, { rows: data, keys, quote, eol: term, delim }).replace(/(\r?\n)$/, '');
    // Python's NONNUMERIC quotes the header too; so does Text fields mode here
    const got = transform(C, JSON.stringify(data), { dir: 'j2c', quote, eol, delim }).output;
    if (got !== want) { let k = 0; while (k < got.length && got[k] === want[k]) k++; bad.push(quote + '/' + eol + '/' + JSON.stringify(delim) + ' differs at ' + k + ': ' + JSON.stringify(got.slice(k, k + 30)) + ' vs ' + JSON.stringify(want.slice(k, k + 30))); }
  }
  check(bad.length === 0, 'JSON → CSV equals csv.writer on 120 rows, for 3 quoting modes x LF/CRLF x comma, semicolon, tab', bad.slice(0, 2).join(' | '));
  // CSV -> JSON against csv.DictReader, on Python-written CSV with quotes and newlines inside fields
  const csvText = py(writeCode, { rows: data, keys, quote: 'min', eol: '\r\n', delim: ',' });
  const readCode = 'import csv,io,json,sys\nt=sys.stdin.read()\nt=json.loads(t)\nr=list(csv.DictReader(io.StringIO(t,newline="")))\nsys.stdout.buffer.write(json.dumps(r,ensure_ascii=False).encode("utf8"))';
  const want = JSON.parse(py(readCode, csvText));
  const got = JSON.parse(transform(C, csvText, { dir: 'c2j', delim: ',' }).output);
  check(JSON.stringify(got) === JSON.stringify(want) && got.length === 120, 'CSV → JSON equals csv.DictReader on a 120-row CSV with embedded commas, quotes and line breaks (CRLF)', got.length + ' rows');
  // JSON Lines
  const small = data.slice(0, 5).map((o) => ({ id: String(o.id), name: o.name }));
  const jl = transform(C, 'id,name\n1,Ann\n2,"Bo, Jr."\n', { dir: 'c2j', fmt: 'lines' });
  check(jl.output === '{"id":"1","name":"Ann"}\n{"id":"2","name":"Bo, Jr."}' && jl.download.ext === 'jsonl', 'JSON Lines: one compact object a line, saved as .jsonl', JSON.stringify(jl.output));
  const back = transform(C, jl.output, { dir: 'j2c' });
  check(back.output === 'id,name\n1,Ann\n2,"Bo, Jr."', 'JSON → CSV reads JSON Lines as well as an array', JSON.stringify(back.output));
  // BOM
  const b = transform(C, '[{"a":"é"}]', { dir: 'j2c', bom: 'yes' });
  check(Buffer.from(b.bytes).slice(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) && Buffer.from(b.bytes).toString('utf8') === '\ufeffa\né' && b.output === 'a\né', 'the download carries a UTF-8 byte order mark; the text on screen does not');
  const inBom = transform(C, '\ufeffname,age\nAnn,3', { dir: 'c2j' });
  check(JSON.parse(inBom.output)[0].name === 'Ann', 'a BOM at the start of the input does not become part of the first header', inBom.output.slice(0, 40));
  // problems are named, not dropped silently
  const rag = transform(C, 'a,b\n1,2,3\n4\n', { dir: 'c2j' });
  check(/1 row has more fields than the 2 columns \(first: data row 1, with 3\); the extra fields were dropped/.test(rag.warn) && /1 row has fewer fields/.test(rag.warn), 'a long row and a short row are both named', rag.warn);
  const open = transform(C, 'a,b\n1,"2\n3,4\n', { dir: 'c2j' });
  check(/A quote opened in row 2 is never closed/.test(open.warn || ''), 'an unclosed quote is named with its row', open.warn);
}

function testXmlExpat() {
  section('25  XML formatter: well-formedness agrees with Python\'s expat; formatting and minifying keep the document\'s content');
  const X = current('engine/dev-xml-formatter.js').DEV_TOOLS['xml-formatter'];
  try { execFileSync('python', ['--version'], { stdio: 'ignore' }); } catch (e) { skip('python is not installed: the expat comparisons are skipped'); return; }
  const env = Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' });
  const py = (code, input) => execFileSync('python', ['-X', 'utf8', '-c', code], { input: JSON.stringify(input), encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  let seed = 17;
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
  const texts = ['hello', 'a &amp; b', '1 &lt; 2', '&#233;', '&#x20AC;', ' ', '\n  ', 'caf\u00e9', 'x]y', '😀', '&co;'];
  const gen = (d) => {
    const nm = ['a', 'item', 'row', 'x-y', 'Z'][rnd(5)];
    const parts = ['<' + nm];
    const used = {};
    for (let i = rnd(3); i > 0; i--) {
      const an = ['id', 'class', 'v'][rnd(3)]; if (used[an]) continue; used[an] = 1;
      const q = rnd(3) ? '"' : "'";
      parts.push((rnd(4) ? ' ' : '\n  ') + an + (rnd(6) ? '=' : ' = ') + q + ['1', 'a b', '&amp;', 'x&#233;', 'q>r', ''][rnd(6)] + q);
    }
    if (!rnd(5) || d > 3) { parts.push(rnd(2) ? '/>' : '></' + nm + '>'); return parts.join(''); }
    parts.push('>');
    for (let i = rnd(4); i > 0; i--) {
      const k = rnd(8);
      if (k < 3) parts.push(gen(d + 1));
      else if (k < 5) parts.push(texts[rnd(texts.length)]);
      else if (k === 5) parts.push('<!-- note ' + rnd(9) + ' -->');
      else if (k === 6) parts.push('<![CDATA[<raw & ' + rnd(9) + '>]]>');
      else parts.push('<?pi go?>');
      if (!rnd(3)) parts.push('\n' + '  '.repeat(rnd(4)));
    }
    parts.push('</' + nm + '>');
    return parts.join('');
  };
  const DECL = '<?xml version="1.0" encoding="UTF-8"?>';
  const body = () => (rnd(6) ? '' : '<!DOCTYPE a [<!ENTITY co "x">]>') + gen(0) + (rnd(4) ? '' : '\n');
  const muts = [
    (s) => { const i = rnd(s.length); return s.slice(0, i) + s.slice(i + 1); },
    (s) => { const i = rnd(s.length); return s.slice(0, i) + ['<', '>', '&', '"', "'", '/', '=', ' ', ']]>', '--', '&nbsp;', '&co;', '\u0001', '<b'][rnd(14)] + s.slice(i); },
    (s) => { const i = rnd(s.length), j = rnd(s.length); const a = s.split(''); [a[i], a[j]] = [a[j], a[i]]; return a.join(''); },
    (s) => s.replace(/<\/(\w[\w-]*)>/, (m, n) => '</' + n.toUpperCase() + '>'),
    (s) => s + (rnd(2) ? '<extra/>' : 'text'),
    (s) => s
  ];
  const docs = [];
  for (let i = 0; i < 1500; i++) { const b = muts[rnd(muts.length)](body()); docs.push((i % 3 ? DECL : '') + b); }
  const wf = 'import sys,json,xml.etree.ElementTree as ET\nd=json.load(sys.stdin)\nout=[]\nfor s in d:\n  try:\n    ET.fromstring(s.encode("utf8","surrogatepass")); out.append([1,0])\n  except ET.ParseError as e:\n    out.append([0,e.position[0]])\nprint(json.dumps(out))';
  const ref = JSON.parse(py(wf, docs));
  let agree = 0, rejects = 0, sameLine = 0; const dis = [];
  docs.forEach((s, i) => {
    const r = transform(X, s);
    if (!r.error === !!ref[i][0]) { agree++; if (r.error) { rejects++; if (r.errorAt.line === ref[i][1]) sameLine++; } }
    else dis.push(JSON.stringify(s).slice(0, 90) + ' ours: ' + (r.error || 'ok').slice(0, 60));
  });
  check(agree === docs.length, 'accept or reject agrees with expat on ' + docs.length + ' mutated documents (' + rejects + ' rejected: stray characters, case slips, bad entities, a second root, bad DOCTYPEs…)', dis.slice(0, 2).join(' | '));
  check(sameLine / rejects > 0.9, 'the error line equals expat\'s on ' + sameLine + ' of the ' + rejects + ' rejected documents (expat sometimes reports a token later)', sameLine + '/' + rejects);
  // formatting and minifying keep the document: same tree under expat, whitespace between tags aside
  const valid = docs.filter((s, i) => ref[i][0]);
  const tree = 'import sys,json,xml.etree.ElementTree as ET\ndef n(e):\n  t=e.text if e.text and e.text.strip() else ""\n  return [e.tag,sorted(e.attrib.items()),t,[[n(c),(c.tail if c.tail and c.tail.strip() else "")] for c in e]]\nd=json.load(sys.stdin)\nprint(json.dumps([[n(ET.fromstring(s.encode("utf8","surrogatepass"))) for s in x] for x in d],ensure_ascii=False))';
  const pretty = valid.map((s) => transform(X, s, { mode: 'pretty', indent: '2' }).output);
  const mini = valid.map((s) => transform(X, s, { mode: 'minify' }).output);
  const tabs = valid.map((s) => transform(X, s, { mode: 'pretty', indent: 'tab' }).output);
  const T = JSON.parse(py(tree, valid.map((s, i) => [s, pretty[i], mini[i], tabs[i]])));
  let badP = 0, badM = 0, badT = 0;
  T.forEach((t) => { if (JSON.stringify(t[0]) !== JSON.stringify(t[1])) badP++; if (JSON.stringify(t[0]) !== JSON.stringify(t[2])) badM++; if (JSON.stringify(t[0]) !== JSON.stringify(t[3])) badT++; });
  check(badP === 0 && badM === 0 && badT === 0, 'on ' + valid.length + ' valid documents, formatted (2 spaces and tabs) and minified output parse to the same tree as the original (element names, attributes, text)', badP + '/' + badM + '/' + badT);
  const again = valid.filter((s, i) => transform(X, pretty[i], { mode: 'pretty', indent: '2' }).output !== pretty[i]).length;
  check(again === 0, 'formatting is stable: formatting formatted output changes nothing', again + ' differ');
  // the engine does not need the DOM or a Worker-unsafe call
  check(!/document\.|DOMParser/.test(String(X.transform)), 'the check and the formatter use no DOM, so they can run in the Worker');
}

function testHtmlEntities() {
  section('26  HTML entities: the named list, decoding by the HTML Standard\'s rules, and escaping, against Python\'s html module');
  const H = current('engine/dev-html-entities.js').DEV_TOOLS['html-entities'];
  try { execFileSync('python', ['--version'], { stdio: 'ignore' }); } catch (e) { skip('python is not installed: the html.unescape comparisons are skipped'); return; }
  const env = Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' });
  const py = (code, input) => execFileSync('python', ['-X', 'utf8', '-c', code], { input: JSON.stringify(input), encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  // the table itself: every entry of Python's html.entities.html5 (the WHATWG list), by name, both ways
  const table = JSON.parse(py('import sys,json,html.entities as e\njson.load(sys.stdin)\nprint(json.dumps(e.html5,ensure_ascii=False))', 0));
  const names = Object.keys(table);
  const decodeAll = names.map((n) => '&' + n);
  const got = decodeAll.map((s) => transform(H, s, { dir: 'dec' }).output);
  const bad = names.filter((n, i) => got[i] !== table[n]);
  check(names.length === 2231 && bad.length === 0, 'all ' + names.length + ' references of the WHATWG list (2,125 with ; and 106 without) decode to the characters Python lists', bad.slice(0, 4).join(' '));
  let seed = 23;
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
  const withSemi = names.filter((n) => n.endsWith(';'));
  const legacy = names.filter((n) => !n.endsWith(';'));
  const nums = [65, 90, 160, 233, 0x20AC, 0x2192, 0x1F600, 0, 0x80, 0x85, 0x9F, 0xD800, 0x110000, 0x0D, 0x7A, 0x2028];
  const bits = ['&', 'a', ' ', '<b>', 'x', '&;', '&#;', '&#x;', '&bogus;', '&Amp;', '=', '9'];
  const docs = [];
  for (let i = 0; i < 3000; i++) {
    let t = '';
    for (let k = 1 + rnd(8); k > 0; k--) {
      const r = rnd(10);
      if (r < 3) t += '&' + withSemi[rnd(withSemi.length)];
      else if (r < 5) t += '&' + legacy[rnd(legacy.length)] + ['', 'x', '=1', ' ', ';', '9'][rnd(6)];
      else if (r < 7) { const n = nums[rnd(nums.length)]; t += rnd(2) ? '&#' + n + (rnd(3) ? ';' : '') : '&#x' + n.toString(16) + (rnd(3) ? ';' : ''); }
      else t += bits[rnd(bits.length)];
    }
    docs.push(t);
  }
  const ref = JSON.parse(py('import sys,json,html\nd=json.load(sys.stdin)\nprint(json.dumps([html.unescape(s) for s in d],ensure_ascii=False))', docs));
  const wrong = [];
  docs.forEach((s, i) => { const r = transform(H, s, { dir: 'dec' }).output; if (r !== ref[i]) wrong.push(JSON.stringify(s) + ' → ' + JSON.stringify(r) + ' vs ' + JSON.stringify(ref[i])); });
  check(wrong.length === 0, 'Unescape equals html.unescape on 3000 random strings: names with and without ;, longest legacy prefix (&notit; → ¬it;), numeric references with C1 and out-of-range values', wrong.slice(0, 2).join(' | '));
  // escaping: markup characters as html.escape does (apostrophe aside); non-ASCII round-trips through every mode
  const texts = [];
  const pool = ['a', '<', '>', '&', '"', "'", 'é', '€', '→', '😀', '\u00a0', '≂\u0338', 'Ω', '日本', '©', ' '];
  for (let i = 0; i < 400; i++) { let t = ''; for (let k = 1 + rnd(10); k > 0; k--) t += pool[rnd(pool.length)]; texts.push(t); }
  const esc = JSON.parse(py('import sys,json,html\nd=json.load(sys.stdin)\nprint(json.dumps([html.escape(s,quote=True).replace("&#x27;","&#39;") for s in d],ensure_ascii=False))', texts));
  const refUn = JSON.parse(py('import sys,json,html\nd=json.load(sys.stdin)\nprint(json.dumps([html.unescape(s) for s in d],ensure_ascii=False))', ['x']));
  let badMark = 0;
  texts.forEach((t, i) => { if (transform(H, t, { mode: 'markup' }).output !== esc[i]) badMark++; });
  check(badMark === 0, 'Markup-only escaping equals html.escape (apostrophe as &#39;) on 400 texts', badMark);
  const modes = ['named', 'dec', 'hex'];
  const encoded = modes.map((m) => texts.map((t) => transform(H, t, { mode: m }).output));
  const back = JSON.parse(py('import sys,json,html\nd=json.load(sys.stdin)\nprint(json.dumps([[html.unescape(s) for s in row] for row in d],ensure_ascii=False))', encoded));
  const lost = [];
  modes.forEach((m, mi) => texts.forEach((t, i) => { if (back[mi][i] !== t) lost.push(m + ' ' + JSON.stringify(t) + ' → ' + JSON.stringify(encoded[mi][i])); }));
  check(lost.length === 0, 'Escaping as names, decimal and hex, then html.unescape, gives back all 400 texts (' + (400 * 3) + ' round trips)', lost.slice(0, 2).join(' | '));
  const sample = transform(H, 'é€→ © ≂\u0338 😀 \u00a0', { mode: 'named' }).output;
  check(sample === '&eacute;&euro;&rarr; &copy; &nesim; &#x1F600; &nbsp;', 'the name chosen is the shortest (rarr, not rightarrow; nbsp, not NonBreakingSpace), a two-character entity is used, and a character with no name falls back to hex', sample);
  const apos = transform(H, "it's", { apos: 'named' }).output;
  check(apos === 'it&apos;s' && transform(H, apos, { dir: 'dec' }).output === "it's", '&apos; is offered and read back');
  const attr = transform(H, '&notit; &amp=1 &copy2 &amp;', { dir: 'dec', ctx: 'attr' }).output;
  check(attr === '&notit; &amp=1 &copy2 &', 'in an attribute value a name without ; is left alone when letters, digits or = follow it (HTML Standard)', attr);
}

function testTextDiff() {
  section('27  Text compare: the edit script is as short as GNU diff --minimal\'s, and GNU patch rebuilds the second text from it');
  const D = current('engine/txt-text-diff.js').TEXT_TOOLS['text-diff'];
  const cp = require('child_process'), os = require('os');
  try { cp.execFileSync('diff', ['--version'], { stdio: 'ignore' }); cp.execFileSync('patch', ['--version'], { stdio: 'ignore' }); } catch (e) { skip('GNU diff and patch are not installed: the comparison is skipped'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td-'));
  let seed = 61;
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
  const words = ['alpha', 'beta', 'gamma', 'delta', 'x', '', 'same', 'é', '  indented', 'a b'];
  let badLen = 0, badPatch = 0, total = 0, changes = 0;
  for (let t = 0; t < 120; t++) {
    const A = Array.from({ length: 1 + rnd(40) }, () => words[rnd(words.length)] + (rnd(3) ? '' : rnd(5)));
    let B = A.slice();
    for (let k = rnd(8); k > 0; k--) { const i = rnd(B.length + 1); const r = rnd(3); if (r === 0) B.splice(i, 1); else if (r === 1) B.splice(i, 0, words[rnd(words.length)] + rnd(9)); else B[i % Math.max(1, B.length)] = 'chg' + rnd(9); }
    if (!B.length) B = ['only'];
    const a = path.join(dir, 'a.txt'), b = path.join(dir, 'b.txt');
    fs.writeFileSync(a, A.join('\n') + '\n'); fs.writeFileSync(b, B.join('\n') + '\n');
    let gnu = '';
    try { gnu = cp.execFileSync('diff', ['--minimal', '-U3', a, b], { encoding: 'utf8' }); } catch (e) { gnu = e.stdout || ''; }
    const gnuChanges = gnu.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l)).length;
    const US = String.fromCharCode(31);
    const r = transform(D, A.join('\n') + '\n' + US + US + US + '\n' + B.join('\n'), { ws: 'exact' });   // the two-box form keeps blank first lines
    const ours = (r.output || '').split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l)).length;
    total++; changes += ours;
    if (ours !== gnuChanges) badLen++;
    if (r.output) {
      const pf = path.join(dir, 'p.diff'); fs.writeFileSync(pf, r.output + '\n');
      try { cp.execFileSync('patch', ['-s', a, pf]); if (fs.readFileSync(a, 'utf8') !== B.join('\n') + '\n') badPatch++; } catch (e) { badPatch++; }
    } else if (A.join('\n') !== B.join('\n')) badPatch++;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  check(badLen === 0, total + ' random line files (' + changes + ' changed lines in all): the number of added and removed lines equals GNU diff --minimal on every one', badLen + ' differ');
  check(badPatch === 0, 'GNU patch applies our unified diff to the first file and produces the second, byte for byte, on every one', badPatch + ' differ');
}

function testWordCounter() {
  section('28  Word counter: words, against GNU wc -w; limit weights and SMS units by hand-counted cases');
  const W = current('engine/txt-word-counter.js').TEXT_TOOLS['word-counter'];
  const cp = require('child_process');
  try { cp.execFileSync('wc', ['--version'], { stdio: 'ignore' }); } catch (e) { skip('GNU wc is not installed: the word comparison is skipped'); return; }
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(71);
  const bits = ['word', 'e-mail', '£5', 'café', '—', '-', '...', 'a', '1,000', 'x_y', '"q"', 'नमस्ते'];
  const gaps = [' ', '  ', '\n', '\t', '\r\n', '\n\n', ' \n '];
  let bad = 0, total = 0;
  for (let t = 0; t < 200; t++) {
    let s = rnd(2) ? gaps[rnd(gaps.length)] : '';
    for (let k = 1 + rnd(30); k > 0; k--) s += bits[rnd(bits.length)] + gaps[rnd(gaps.length)];
    const ref = Number(cp.execFileSync('wc', ['-w'], { input: s, encoding: 'utf8', env: Object.assign({}, process.env, { LC_ALL: 'C.UTF-8' }) }).trim());
    const got = transform(W, s);
    const n = s.trim() ? Number((stat(got, 'Words') || '0').replace(/,/g, '')) : 0;
    total++;
    if (s.trim() && n !== ref) bad++;
  }
  check(bad === 0, 'Words equals `wc -w` on ' + total + ' random texts with hyphens, currency, dashes, Hindi and every ASCII kind of space (wc ignores emoji, which this tool counts as words)', bad + ' differ');
  const lim = (s, o) => Object.fromEntries((transform(W, s, o).limits || []).map((l) => [l.id, l]));
  check(lim('hello').x.used === 5 && lim('日本語').x.used === 6 && lim('a😀').x.used === 3 && lim('see https://example.com/x?y=1 now').x.used === 4 + 23 + 4, 'X weight: Latin 1, CJK 2, emoji 2, a link 23 (hand-counted)', JSON.stringify([lim('hello').x.used, lim('日本語').x.used, lim('a😀').x.used]));
  check(lim('a'.repeat(160)).sms.used === 160 && lim('a'.repeat(160)).sms.limit === 160 && lim('€'.repeat(80)).sms.used === 160 && lim('a'.repeat(70) + 'ж').sms.limit === 70 && lim('a'.repeat(70) + 'ж').sms.used === 71, 'SMS: 160 GSM units (€ is 2), and one non-GSM letter makes it Unicode with a limit of 70', '');
  check(lim('x'.repeat(61)).title.used === 61 && lim('x'.repeat(61)).title.limit === 60 && !lim('x', { limits: 'hide' }).title, 'the 60-character title bar goes over at 61, and Hide removes the bars', '');
  const r = transform(W, 'one two three', { goal: 10 });
  check(r.goal && r.goal.goal === 10 && r.goal.words === 3, 'a word goal reports words against the goal', JSON.stringify(r.goal));
}

function testReadability() {
  section('29  Readability: each formula against a hand calculation; per-sentence marks');
  const R = current('engine/txt-readability-score.js').TEXT_TOOLS['readability-score'];
  // eight sentences of six one-syllable words: 48 words, 8 sentences, 1.00 syllables a word, 18 letters a sentence
  const cat = 'The cat sat on the mat. '.repeat(8);
  const wps = 6, spw = 1, lettersPerWord = 18 / 6;
  const want = {
    'Flesch Reading Ease': (206.835 - 1.015 * wps - 84.6 * spw).toFixed(1)
  };
  const r = transform(R, cat);
  check(stat(r, 'Flesch Reading Ease') === want['Flesch Reading Ease'] && want['Flesch Reading Ease'] === '116.1', 'Flesch Reading Ease of a text of one-syllable six-word sentences is 206.835 − 1.015×6 − 84.6×1 = 116.1', stat(r, 'Flesch Reading Ease'));
  const near = (line, v) => Math.abs(Number(new RegExp(line + String.raw`\s+(-?[\d.]+)`).exec(r.output)[1]) - v) < 0.051;
  check(near('Flesch-Kincaid Grade', 0.39 * wps + 11.8 * spw - 15.59) && near('Gunning Fog Index', 0.4 * (wps + 0)) && near('SMOG Index', 3.1291) && near('Automated Readability', 4.71 * lettersPerWord + 0.5 * wps - 21.43),
    'Flesch-Kincaid (−1.45), Gunning Fog (2.4), SMOG (3.13) and the Automated Readability Index (−4.3) match the published formulas on that text', r.output.split('\n').slice(1, 5).join(' | '));
  check(stat(r, 'Words') === '48' && stat(r, 'Sentences') === '8' && stat(r, 'Words per sentence') === '6.0' && stat(r, 'Syllables per word') === '1.00', 'the counts are the hand counts: 48 words, 8 sentences, 6.0 a sentence, 1.00 syllables a word');
  // per-sentence marks
  const w = (n) => Array.from({ length: n }, () => 'word').join(' ');
  const text = w(20) + '. ' + w(21) + '. ' + w(30) + '. ' + w(31) + '. ' + w(6) + '. ' + 'fill '.repeat(10).trim() + '.';
  const m = transform(R, text, { limit: 20 }).marks;
  const lv = m.sents.map((s) => s[4]).join('');
  check(lv === '011200', 'sentences of 20, 21, 30, 31, 6 and 10 words: 20 is not long, 21 is amber, 30 amber, 31 red (past 1.5 times 20)', lv);
  const offs = m.sents.every((s) => text.slice(s[0], s[1]).trim().split(/\s+/).length === s[2]);
  check(offs, 'each mark\'s positions cut out exactly the sentence it counted');
  const ex = transform(R, 'The extraordinary organisational transformation necessitated comprehensive collaboration. '.repeat(5) + 'It was fine. '.repeat(3));
  const hits = ex.marks.words.map((p) => ('The extraordinary organisational transformation necessitated comprehensive collaboration. '.repeat(5) + 'It was fine. '.repeat(3)).slice(p[0], p[1]));
  check(hits.indexOf('extraordinary') >= 0 && hits.indexOf('organisational') >= 0 && hits.indexOf('fine.') < 0 && ex.marks.hardest.length === 5, 'long words are the 3+ syllable ones, and the five hardest sentences are picked', hits.slice(0, 4).join(','));
}

function testUuid() {
  section('30  UUID, ULID, nanoid: layouts against Python\'s uuid module and the specifications; time order; no bias');
  const base = current('engine/dev-uuid-generator.js');
  const fixedMs = Date.UTC(2024, 4, 17, 12, 30, 45, 123);
  class FakeDate extends Date { static now() { return fixedMs; } }
  const U = current('engine/dev-uuid-generator.js', { Date: FakeDate, crypto: require('crypto').webcrypto }).DEV_TOOLS['uuid-generator'];
  const gen = (o) => generate(U, Object.assign({ mode: 'gen' }, o)).output.split('\n');
  const cp = require('child_process');
  const env = Object.assign({}, process.env, { PYTHONUTF8: '1' });
  const py = (code, input) => { try { return JSON.parse(cp.execFileSync('python', ['-X', 'utf8', '-c', code], { input: JSON.stringify(input), encoding: 'utf8', env })); } catch (e) { return null; } };
  const v4 = gen({ kind: 'v4', count: 300 }), v1 = gen({ kind: 'v1', count: 300 }), v7 = gen({ kind: 'v7', count: 500 });
  const pyInfo = py('import sys,json,uuid\nd=json.load(sys.stdin)\nout=[]\nfor s in d:\n  u=uuid.UUID(s)\n  out.append([u.version,u.variant==uuid.RFC_4122,str(u.time) if u.version==1 else "0",(u.node>>40)&1])\nprint(json.dumps(out))', v4.concat(v1, v7.slice(0, 20)));
  if (!pyInfo) skip('python is not installed: the uuid-module comparison is skipped');
  else {
    const bad4 = pyInfo.slice(0, 300).filter((x) => x[0] !== 4 || !x[1]).length;
    check(bad4 === 0, '300 version 4 IDs: Python\'s uuid module reads every one as version 4, RFC 4122 variant', bad4);
    const rows1 = pyInfo.slice(300, 600);
    const ticks0 = (BigInt(fixedMs) + 12219292800000n) * 10000n;
    const ok1 = rows1.every((x, i) => x[0] === 1 && x[1] && BigInt(x[2]) === ticks0 + BigInt(i) && x[3] === 1);
    check(ok1, '300 version 1 IDs: version 1, RFC variant, the time Python decodes is the clock plus one 100 ns tick per ID, and the multicast bit of the node is set (no hardware address)', K1(rows1));
    check(pyInfo.slice(600).every((x) => x[0] === 7 || x[0] === 0 || x[0] >= 7) , 'Python does not know version 7 here, so its layout is checked by hand below');
  }
  function K1(rows) { return JSON.stringify(rows.slice(0, 2)); }
  // version 7 by hand: 48-bit ms, version nibble 7, variant 10, sorts in generation order
  const ms7 = v7.map((u) => parseInt(u.replace(/-/g, '').slice(0, 12), 16));
  check(ms7[0] >= fixedMs && ms7.every((m) => m >= fixedMs && m < fixedMs + 3), 'version 7: the first 48 bits are the Unix milliseconds', ms7[0] + ' vs ' + fixedMs);
  check(v7.every((u) => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(u)), '500 version 7 IDs have the 7 and the variant digit in place');
  check(v7.every((u, i) => i === 0 || u > v7[i - 1]) && new Set(v7).size === 500, '500 version 7 IDs made in one millisecond are strictly increasing as text (the 12-bit counter), all different');
  // ULID by hand: Crockford base 32
  const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const ul = gen({ kind: 'ulid', count: 500 });
  const dec = (s) => { let v = 0n; for (const ch of s) v = v * 32n + BigInt(CROCK.indexOf(ch)); return v; };
  check(ul.every((u) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(u)) && ul.every((u) => Number(dec(u.slice(0, 10))) === fixedMs), '500 ULIDs: 26 Crockford characters, the first ten decode to the clock in milliseconds');
  check(ul.every((u, i) => i === 0 || (dec(u.slice(10)) === dec(ul[i - 1].slice(10)) + 1n)) && ul.every((u, i) => i === 0 || u > ul[i - 1]), 'within a millisecond each ULID is the previous one plus one in the random part, so they sort in order');
  check(Number(dec('01ARZ3NDEK')) === 1469922850259, 'the specification\'s example 01ARZ3NDEK decodes to 1469922850259 ms (30 July 2016)', String(dec('01ARZ3NDEK')));
  // the checker, on the RFC 9562 appendix vectors
  const chk = (s) => generate(U, { mode: 'check', ids: s }).output;
  const vec = chk('C232AB00-9414-11EC-B3C8-9F6BDECED846\n1EC9414C-232A-6B00-B3C8-9F6BDECED846\n017F22E2-79B0-7CC3-98C4-DC0C0C07398F\n919108f7-52d1-4320-9bac-f847db4148a8\n01ARZ3NDEKTSV4RRFFQ69G5FAV');
  check((vec.match(/2022-02-22T19:22:22\.000Z/g) || []).length === 3 && /version 4, RFC 9562 variant \(random\)/.test(vec) && /ULID, made 2016-07-30T23:54:10\.259Z/.test(vec), 'RFC 9562 vectors: v1, v6 and v7 all read 2022-02-22T19:22:22.000Z, v4 reads random, the ULID example reads 30 July 2016', vec.split('\n').filter((l) => /✓|✗/.test(l)).join(' | '));
  const nope = chk('abc\n12345678-1234-1234-1234-12345678901\n12345678-1234-1234-1234-1234567890123\n12345678-1234-1234-c234-123456789012\n12345678-1234-9234-8234-123456789012\ngggggggg-gggg-gggg-gggg-gggggggggggg\n{FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF}\nurn:uuid:00000000-0000-0000-0000-000000000000');
  const cnt = (re) => (nope.match(re) || []).length;
  check(cnt(/✗/g) === 6 && cnt(/max UUID/g) === 1 && cnt(/nil UUID/g) === 1 && /variant digit c/.test(nope) && /version digit is 9/.test(nope), 'bad IDs are named: wrong length, a variant digit of c, a version 9, non-hex; the max and nil UUIDs are recognised, braces and urn: are accepted', nope.split('\n').filter((l) => /✓|✗/.test(l)).join(' | '));
  // nanoid: members of the alphabet, the length, and no character favoured
  const nano = (n, size, alpha) => generate(U, { mode: 'gen', kind: 'nano', count: n, size: size, alphabet: alpha }).output.split('\n');
  const a10 = nano(500, 100, '0-9');
  const counts = new Array(10).fill(0);
  a10.join('').split('').forEach((c) => counts[c.charCodeAt(0) - 48]++);
  const N10 = counts.reduce((x, y) => x + y, 0), exp = N10 / 10;
  const chi = counts.reduce((x, c) => x + (c - exp) * (c - exp) / exp, 0);
  check(a10.every((s) => /^[0-9]{100}$/.test(s)) && N10 === 50000 && chi < 27.9, 'nanoid over 0-9 (not a power of two): 50,000 characters, each digit within chi-square 27.9 (p = 0.001, 9 degrees of freedom) of equal; chi-square = ' + chi.toFixed(1));
  const def = nano(5, 21, 'A-Za-z0-9_-');
  check(def.every((s) => /^[A-Za-z0-9_-]{21}$/.test(s)) && nano(1, 7, 'abc')[0].length === 7 && /^[abc]{7}$/.test(nano(1, 7, 'abc')[0]), 'default nanoid is 21 URL-safe characters; a custom alphabet and length are kept');
  check(!!generate(U, { mode: 'gen', kind: 'nano', count: 1, size: 5, alphabet: 'a' }).error, 'a one-character alphabet is refused');
}

function testPasswordList() {
  section('31  Passwords: the word list, each word equally likely, the exact entropy under "guarantee", the strength estimate');
  const P = current('engine/txt-password-generator.js', { crypto: require('crypto').webcrypto }).TEXT_TOOLS['password-generator'];
  const gen = (o) => generate(P, o);
  const list = fs.readFileSync(path.join(ROOT, 'build/wordlist/words.txt'), 'utf8').split('\n').filter(Boolean);
  check(list.length > 5000 && new Set(list).size === list.length && list.every((w) => /^[a-z]{4,9}$/.test(w)) && list.join('\n') === list.slice().sort().join('\n'), 'the word list: ' + list.length + ' distinct lower-case words of 4 to 9 letters, sorted', list.length);
  const src = fs.readdirSync(path.join(ROOT, 'build/wordlist/source')).filter((f) => /\.txt$/.test(f));
  const srcWords = new Set(); src.forEach((f) => fs.readFileSync(path.join(ROOT, 'build/wordlist/source', f), 'utf8').split(/\s+/).forEach((w) => srcWords.add(w)));
  check(list.every((w) => srcWords.has(w)) && src.length >= 5, 'every word in the list is in the hand-written source files (' + src.length + ' files), none came from elsewhere');
  const out = execFileSync(process.execPath, [path.join(ROOT, 'build/gen-passphrase-words.js'), '--check'], { encoding: 'utf8' });
  check(/up to date/.test(out), 'build/gen-passphrase-words.js --check: the list file and the engine carry exactly what the sources give', out.trim());
  const blocked = ['sex', 'porn', 'rape', 'nazi', 'hitler', 'fuck', 'shit', 'bitch', 'slut', 'whore', 'cunt', 'murder', 'suicide', 'bomb', 'terror', 'cocaine', 'heroin'];
  check(!blocked.some((w) => list.includes(w)), 'none of the blocked words is in the list');
  /* each word equally likely: chi-square over all words, 4 draws a word on average */
  const N = list.length, counts = new Map();
  const draws = N * 40;
  const per = 50, words = 12;
  let drawn = 0;
  while (drawn < draws) { gen({ type: 'passphrase', words: words, count: per, caps: 'none', addnum: 'no', sep: ' ' }).output.split('\n').forEach((p) => p.split(' ').forEach((w) => { counts.set(w, (counts.get(w) || 0) + 1); drawn++; })); }
  let chi = 0; const exp = drawn / N;
  list.forEach((w) => { const c = counts.get(w) || 0; chi += (c - exp) * (c - exp) / exp; });
  const sd = Math.sqrt(2 * (N - 1));
  check(counts.size === N && Math.abs(chi - (N - 1)) < 5 * sd, 'the passphrase draws are level: ' + drawn.toLocaleString('en-GB') + ' words over ' + N + ', every word seen, chi-square ' + chi.toFixed(0) + ' against ' + (N - 1) + ' ± ' + sd.toFixed(0) + ' (5 sigma)', '');
  /* the exact entropy of "guarantee": count the valid strings by brute force on a small pool, then compare the engine's formula */
  const small = (n, sizes) => { let dp = new Map([[0, 1n]]); for (let i = 0; i < n; i++) { const nx = new Map(); for (const [m, c] of dp) for (let k = 0; k < sizes.length; k++) { const mm = m | (1 << k); nx.set(mm, (nx.get(mm) || 0n) + c * BigInt(sizes[k])); } dp = nx; } return dp.get((1 << sizes.length) - 1); };
  const fcount = (n, sizes) => { // brute force over a tiny alphabet: 2 kinds of 2 and 3 characters, strings of length 6
    const kinds = ['ab', 'cde']; const pool = kinds.join(''); let ok = 0;
    const rec = (s) => { if (s.length === n) { if (kinds.every((k) => [...s].some((c) => k.includes(c)))) ok++; return; } for (const c of pool) rec(s + c); };
    rec(''); return BigInt(ok); };
  check(fcount(6) === small(6, [2, 3]), 'the table that counts passwords with every kind present agrees with listing all 5^6 strings of a tiny alphabet', String(fcount(6)) + ' vs ' + String(small(6, [2, 3])));
  const e = gen({ type: 'password', length: 6, lower: 'no', upper: 'yes', digits: 'yes', symbols: 'yes', cover: 'yes' });
  check(stat(e, 'Entropy') === Math.round(Math.log2(Number(small(6, [24, 8, 23])))) + ' bits', 'Guarantee: the entropy shown is log2 of the number of valid strings (' + stat(e, 'Entropy') + '), not length x log2 of the pool', stat(e, 'Entropy'));
  /* the estimate: hand-worked cases */
  const est = (t) => Number((stat(gen({ type: 'check', typed: t }), 'Estimated strength') || '').replace(/\D/g, ''));
  check(est('aaaaaaaaaaaaaaaaaaaa') < 20 && est('12345678') < 15 && est('qwertyuiop') < 20, 'repeats, counting up and keyboard rows score as little, however long: 20 a\'s, 12345678, qwertyuiop');
  const rnd = gen({ type: 'password', length: 20, count: 20 }).output.split('\n');
  check(rnd.every((p) => est(p) >= 100), 'twenty generated 20-character passwords all score 100 bits or more in the checker (a random password reads as random)', rnd.map(est).join(','));
  const pass = gen({ type: 'passphrase', words: 5, caps: 'none', addnum: 'no', sep: ' ', count: 1 }).output.replace(/ /g, '-');
  check(Math.abs(est(pass) - Math.round(5 * Math.log2(list.length) + 5 * 3.3 - 0)) <= 18 && est(pass) < est('Zx9$mQ7!vLp2#aB4'), 'five words from the list read as about five words of entropy plus separators, well under a random password of the same length', pass + ' ' + est(pass));
}

function testCronEngine() {
  section('32  Cron: the next runs against a minute-by-minute search through Intl, in five time zones across clock changes; Quartz L, W, #; wording; errors');
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(83);
  let fakeNow = Date.UTC(2026, 9, 7, 3, 49, 12);
  class FakeDate extends Date { static now() { return fakeNow; } }
  const C = current('engine/dev2-cron-parser.js', { Date: FakeDate }).DEV_TOOLS['cron-parser'];
  const run = (text, o) => transform(C, text, Object.assign({ count: '10' }, o || {}));
  const runsOf = (res) => res.output.split('\n').filter((l) => /^ {5}\S/.test(l)).map((l) => l.trim());
  const TZS = ['UTC', 'Europe/London', 'America/New_York', 'Asia/Kolkata', 'Australia/Lord_Howe'];
  const fmtOf = (tz, sec) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: sec ? '2-digit' : undefined, hourCycle: 'h23' });
  const wallOf = (ms, tz) => { const o = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }).formatToParts(new Date(ms)).forEach((p) => { if (p.type !== 'literal') o[p.type] = p.value; }); return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) }; };
  /* random expressions built from sets, so the matcher below never parses text */
  const pickSet = (min, max, allowStep) => {
    const k = rnd(5);
    if (k === 0) return { text: '*', vals: null, star: true };
    if (k === 1 && allowStep) { const st = [2, 3, 5, 10, 15, 20][rnd(6)]; const vals = []; for (let v = min; v <= max; v += st) vals.push(v); return { text: '*/' + st, vals: vals, star: true }; }
    if (k === 2) { const a = min + rnd(max - min), b = a + rnd(Math.min(6, max - a) + 1); const vals = []; for (let v = a; v <= b; v++) vals.push(v); return { text: a + '-' + b, vals: vals }; }
    if (k === 3) { const a = min + rnd(max - min + 1), b = min + rnd(max - min + 1); const vals = Array.from(new Set([a, b])).sort((x, y) => x - y); return { text: vals.join(','), vals: vals }; }
    const a = min + rnd(max - min + 1); return { text: String(a), vals: [a] };
  };
  const exprs = [];
  for (let i = 0; i < 90; i++) {
    const sec = rnd(4) === 0;
    const f = { s: sec ? pickSet(0, 59, true) : null, mi: pickSet(0, 59, true), h: pickSet(0, 23, true), d: pickSet(1, 31, true), mo: pickSet(1, 12, true), w: pickSet(0, 6, true) };
    const text = [sec ? f.s.text : null, f.mi.text, f.h.text, f.d.text, f.mo.text, f.w.text].filter((x) => x !== null).join(' ');
    exprs.push({ text, f, sec });
  }
  const matches = (e, w) => {
    const has = (set, v) => !set.vals || set.vals.indexOf(v) >= 0;
    if (e.sec && !has(e.f.s, w.s)) return false;
    if (!e.sec && w.s !== 0) return false;
    if (!has(e.f.mi, w.mi) || !has(e.f.h, w.h) || !has(e.f.mo, w.mo)) return false;
    const dom = has(e.f.d, w.d), dow = has(e.f.w, w.wd);
    return (e.f.d.star || e.f.w.star) ? (dom && dow) : (dom || dow);   // crontab(5): a * in either day field makes the test an AND
  };
  const starts = [Date.UTC(2026, 9, 7, 3, 49, 12), Date.UTC(2026, 2, 27, 12, 0, 0), Date.UTC(2026, 9, 23, 12, 0, 0)];
  let compared = 0, nonEmpty = 0; const bad = [];
  const wallCache = new Map();
  const wallAt = (t, tz) => { const k = tz + '|' + t; let w = wallCache.get(k); if (!w) { w = wallOf(t, tz); wallCache.set(k, w); } return w; };
  const dayNum = (line) => { const m = /(\d\d) (\w{3})\w* (\d{4})/.exec(line); return m ? Date.UTC(+m[3], ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[2]), +m[1]) : 0; };
  for (const e of exprs) {
    const tz = TZS[rnd(TZS.length)], t0 = starts[rnd(starts.length)];
    fakeNow = t0;
    const got = runsOf(run(e.text, { tz: tz }));
    /* the independent search: every minute for 45 days (every second for 4 hours, 6 fields) from the start */
    const step = e.sec ? 1000 : 60000, span = e.sec ? 4 * 3600e3 : 45 * 86400e3;
    const want = [], seenWall = new Set();
    const fmt = fmtOf(tz, e.sec);
    for (let t = Math.floor(t0 / step) * step + step; t <= t0 + span && want.length < 10; t += step) {
      const w = wallAt(t, tz);
      if (!matches(e, w)) continue;
      const key = [w.y, w.mo, w.d, w.h, w.mi, w.s].join('-');
      if (seenWall.has(key)) continue;      // a wall-clock time that happens twice is shown once
      seenWall.add(key);
      want.push(fmt.format(new Date(t)));
    }
    compared++;
    if (want.length) nonEmpty++;
    /* the engine looks further than the search: compare the part the search covers; every run it shows inside the span (less a day's margin) must be in the search too */
    const cut = t0 + span - 86400e3 * 1.5;
    const inSpan = got.filter((l) => dayNum(l) <= cut);
    const wantIn = want.filter((l) => dayNum(l) <= cut);
    if (e.sec) { if (want.slice(0, got.length).join('|') !== got.slice(0, want.length).join('|') && want.length && got.length) bad.push(e.text + ' (' + tz + ') ' + got[0] + ' vs ' + want[0]); continue; }
    if (inSpan.join('|') !== wantIn.join('|') || want.slice(0, got.length).join('|') !== got.slice(0, want.length).join('|')) bad.push(e.text + ' in ' + tz + ' from ' + new Date(t0).toISOString() + ': ' + (got[0] || '-') + ' vs ' + (want[0] || '-') + ' (' + got.length + '/' + want.length + ')');
  }
  check(bad.length === 0 && nonEmpty >= 20, compared + ' random expressions (Unix and seconds-first; steps, ranges, lists; both day fields) in 5 zones from 3 starting points (two just before the March and October clock changes): the runs equal a search of every minute (second, for 6 fields) through Intl over 45 days (4 hours) (' + nonEmpty + ' with runs in the window)', bad.slice(0, 2).join(' | '));
  /* clock changes, by hand */
  fakeNow = Date.UTC(2026, 2, 28, 12, 0, 0);
  const gap = runsOf(run('30 1 * * *', { tz: 'Europe/London', count: '3' }));
  check(gap.join('|') === ['Mon, 30 Mar 2026, 01:30', 'Tue, 31 Mar 2026, 01:30', 'Wed, 01 Apr 2026, 01:30'].join('|'), 'London, 30 1 * * * from 28 March 2026 noon: 01:30 on the 29th does not exist (clocks go from 01:00 to 02:00) and is skipped', gap.join(' | '));
  fakeNow = Date.UTC(2026, 9, 24, 12, 0, 0);
  const twice = runsOf(run('30 1 * * *', { tz: 'Europe/London', count: '3' }));
  check(twice.join('|') === ['Sun, 25 Oct 2026, 01:30', 'Mon, 26 Oct 2026, 01:30', 'Tue, 27 Oct 2026, 01:30'].join('|'), 'London, 30 1 * * * across 25 October: 01:30 happens twice that night and is shown once', twice.join(' | '));
  const off = runsOf(run('30 1 * * *', { tz: 'Europe/London', count: '2', offset: 'show' }));
  check(/UTC\+01:00$/.test(off[0]) && /UTC\+00:00$/.test(off[1]), 'the UTC offset option shows the offset in force at each run: +01:00 (BST) for 01:30 on 25 October, +00:00 once the clocks have gone back', off.join(' | '));
  fakeNow = Date.UTC(2026, 9, 7, 3, 49, 12);
  /* Quartz day rules, against a plain calendar */
  const cal = (y, m) => { const days = []; const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); for (let d = 1; d <= dim; d++) days.push({ d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }); return days; };
  const dayOf = (line) => { const m = /(\d\d) (\w+) (\d{4})/.exec(line); return m && (+m[1]); };
  const months = (n, from) => Array.from({ length: n }, (_, k) => { const m = (from || 10) + k; return [2026 + Math.floor((m - 1) / 12), ((m - 1) % 12) + 1]; });
  const lastDays = runsOf(run('0 0 12 L * ?', { tz: 'UTC', count: '6' })).map(dayOf);
  const wantLast = months(6).map(([y, m]) => cal(y, m).length);
  check(lastDays.join() === wantLast.join(), 'Quartz L: the last day of October 2026 to March 2027', lastDays.join() + ' vs ' + wantLast.join());
  const nearest = (y, m, n) => { const c = cal(y, m), last = c.length; if (n > last) return null; const wd = c[n - 1].wd; if (wd >= 1 && wd <= 5) return n; if (wd === 6) return n === 1 ? 3 : n - 1; return n === last ? n - 2 : n + 1; };
  const w15 = runsOf(run('0 0 12 15W * ?', { tz: 'UTC', count: '6' })).map(dayOf), want15 = months(6).map(([y, m]) => nearest(y, m, 15));
  check(w15.join() === want15.join(), 'Quartz 15W: the weekday nearest the 15th, for six months', w15.join() + ' vs ' + want15.join());
  const w1 = runsOf(run('0 0 12 1W * ?', { tz: 'UTC', count: '12' })).map(dayOf), want1 = months(12, 11).map(([y, m]) => nearest(y, m, 1));
  check(w1.join() === want1.join() && want1.indexOf(3) >= 0, 'Quartz 1W never leaves the month: a Saturday 1st (August 2027) becomes Monday the 3rd, a Sunday 1st (November 2026) Monday the 2nd', w1.join() + ' vs ' + want1.join());
  const lw = runsOf(run('0 0 12 LW * ?', { tz: 'UTC', count: '6' })).map(dayOf), wantLW = months(6).map(([y, m]) => { const c = cal(y, m); let i = c.length - 1; while (c[i].wd === 0 || c[i].wd === 6) i--; return c[i].d; });
  check(lw.join() === wantLW.join(), 'Quartz LW: the last weekday of each month', lw.join() + ' vs ' + wantLW.join());
  const lm2 = runsOf(run('0 0 12 L-2 * ?', { tz: 'UTC', count: '6' })).map(dayOf), wantL2 = months(6).map(([y, m]) => cal(y, m).length - 2);
  check(lm2.join() === wantL2.join(), 'Quartz L-2: two days before the last day of the month', lm2.join() + ' vs ' + wantL2.join());
  const fri1 = runsOf(run('0 0 9 ? * 6#1', { tz: 'UTC', count: '6' })), wantF = months(6, 11).map(([y, m]) => cal(y, m).filter((x) => x.wd === 5)[0].d);
  check(fri1.map(dayOf).join() === wantF.join() && fri1.every((l) => /^Fri/.test(l)), 'Quartz 6#1: the first Friday of the month (6 is Friday in Quartz)', fri1.map(dayOf).join() + ' vs ' + wantF.join());
  const lastFri = runsOf(run('0 0 9 ? * 6L', { tz: 'UTC', count: '6' })), wantLF = months(6).map(([y, m]) => { const fr = cal(y, m).filter((x) => x.wd === 5); return fr[fr.length - 1].d; });
  check(lastFri.map(dayOf).join() === wantLF.join(), 'Quartz 6L: the last Friday of the month', lastFri.map(dayOf).join() + ' vs ' + wantLF.join());
  const yr = runsOf(run('0 0 0 29 2 ? 2028-2032', { tz: 'UTC', count: '5' }));
  check(yr.length === 2 && /29 Feb 2028/.test(yr[0]) && /29 Feb 2032/.test(yr[1]), 'Quartz year field 2028-2032 on 29 February: only 2028 and 2032 are leap years, so there are two runs', yr.join(' | '));
  /* wording, hand-written */
  const say = (t, o) => run(t, o).output.split('\n')[1].replace(/^\s*→ /, '');
  const WORDS = [
    ['0 9 * * 1-5', 'At 09:00, on Monday, Tuesday, Wednesday, Thursday and Friday.'],
    ['*/15 * * * *', 'At minute 0, minute 15, minute 30 and minute 45 of every hour, every day.'],
    ['0 0 1 * *', 'At 00:00, on day 1 of the month.'],
    ['@daily', 'At 00:00, every day.'],
    ['*/30 * * * * *', 'Every 30 seconds, every day.'],
    ['0 30 9 ? * MON-FRI', 'At 09:30, on Monday, Tuesday, Wednesday, Thursday and Friday.'],
    ['0 0 12 L * ?', 'At 12:00, on the last day of the month.'],
    ['0 0 12 ? * 6L', 'At 12:00, on the last Friday of the month.'],
    ['0 0 9 ? * 2#3', 'At 09:00, on the 3rd Monday of the month.'],
    ['0 0 0 1 JAN,JUL ? 2027', 'At 00:00, on day 1 of the month, in January and July, in the year 2027.'],
    ['15 30 9 ? * MON', 'At 09:30:15, on Monday.']
  ];
  const wrong = WORDS.filter((w) => say(w[0]) !== w[1]).map((w) => w[0] + ' → ' + say(w[0]));
  check(wrong.length === 0, 'the English for ' + WORDS.length + ' expressions (Unix, seconds-first and Quartz) is the hand-written sentence (seconds are named only when they are not 0)', wrong.slice(0, 2).join(' | '));
  /* errors */
  const e1 = run('0 99 * * *'), e2 = run('0 9 * *\n5 4 * * * 2027 x'), e3 = run('0 0 12 * * *', { format: 'quartz' }), e4 = run('0 0 12 1 * 1', { format: 'quartz' }), e5 = run('0 9 * * 8'), e6 = run('*/0 * * * *');
  check(/hour field, column 3/.test(e1.output) && e1.errorAt && e1.errorAt.line === 1 && e1.errorAt.col === 3, 'an out-of-range hour is named with its field and column, and the gutter gets line 1, column 3', e1.output.split('\n')[1] + ' ' + JSON.stringify(e1.errorAt));
  check(e2.stats[2][1] === '2' && /This has 4/.test(e2.output), 'a wrong field count says how many there are; the second bad line is counted too', e2.output.slice(0, 200));
  check(/needs a \?|wants a \?/.test(e3.output + e4.output) && /you cannot restrict both|needs a \?/.test(e4.output), 'Quartz asks for a ? in one day field, and refuses both restricted', e3.output.split('\n')[1] + ' | ' + e4.output.split('\n')[1]);
  check(/outside the day of week range/.test(e5.output) && /step/.test(e6.output), 'weekday 8 and step 0 are refused with their reason', e5.output.split('\n')[1] + ' | ' + e6.output.split('\n')[1]);
  const bogus = transform(C, '0 9 * * *', { count: '3', tz: 'Mars/Olympus' });
  check(!!bogus.error && /Mars\/Olympus/.test(bogus.error), 'an unknown time zone is refused by name', bogus.error);
}

function testColourConverter() {
  section('33  Colour converter: HSL and HSB against Python\'s colorsys; every output line reads back to the same colour; WCAG ratios; the 148 names; refusals');
  const C = current('engine/dev-color-converter.js').DEV_TOOLS['color-converter'];
  const gen = (c, bg, o) => generate(C, Object.assign({ colour: c, bg: bg || '#ffffff' }, o || {}));
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(97);
  const cols = Array.from({ length: 1500 }, () => [rnd(256), rnd(256), rnd(256)]);
  const hex = (v) => '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('');
  const outs = cols.map((v) => gen(hex(v)).output);
  const line = (o, tag) => (o.split('\n').find((x) => x.indexOf(tag) === 0) || '').slice(6).trim();
  let pyOK = true, hs = null;
  try {
    hs = JSON.parse(execFileSync('python', ['-X', 'utf8', '-c', 'import sys,json,colorsys\nd=json.load(sys.stdin)\nout=[]\nfor r,g,b in d:\n  h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255)\n  h2,s2,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)\n  out.append([h*360,s,l,h2*360,s2,v])\nprint(json.dumps(out))'], { input: JSON.stringify(cols), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) }));
  } catch (e) { pyOK = false; }
  if (!pyOK) skip('python is not installed: the colorsys comparison is skipped');
  else {
    let bad = 0;
    cols.forEach((v, i) => {
      const m = /hsl\((\d+), (\d+)%, (\d+)%\)/.exec(line(outs[i], 'HSL')), n = /hsb\((\d+), (\d+)%, (\d+)%\)/.exec(line(outs[i], 'HSB'));
      const [h, s, l, h2, s2, vv] = hs[i];
      const hd = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
      if (hd(+m[1], Math.round(h)) > 0.51 + 1 || Math.abs(+m[2] - s * 100) > 0.51 || Math.abs(+m[3] - l * 100) > 0.51 || hd(+n[1], h2) > 1.01 || Math.abs(+n[2] - s2 * 100) > 0.51 || Math.abs(+n[3] - vv * 100) > 0.51) bad++;
    });
    check(bad === 0, 'HSL and HSB of 1,500 random colours equal colorsys\'s, to the rounding shown', bad);
  }
  /* every line reads back */
  let off = 0, worst = 0;
  const tags = ['HEX', 'RGB', 'HSL', 'HWB', 'LAB', 'LCH', 'OKLAB', 'OKLCH'];
  cols.slice(0, 600).forEach((v, i) => tags.forEach((t) => {
    const r = gen(line(outs[i], t));
    const m = r.output && /rgb\((\d+), (\d+), (\d+)\)/.exec(r.output);
    if (!m) { off++; return; }
    const d = Math.max(Math.abs(m[1] - v[0]), Math.abs(m[2] - v[1]), Math.abs(m[3] - v[2]));
    const tol = t === 'HSL' || t === 'HWB' ? 3 : t === 'HEX' || t === 'RGB' ? 0 : t === 'LAB' ? 2 : t === 'LCH' ? 3 : 1;
    if (d > worst && d <= tol) worst = d;
    if (d > tol) { off++; if (!global.__ccBad) global.__ccBad = {}; global.__ccBad[t] = (global.__ccBad[t] || 0) + 1; }
  }));
  check(off === 0, '600 colours x 8 output lines (HEX, RGB, HSL, HWB, Lab, LCH, OKLab, OKLCH): each line, pasted back in, gives the colour it came from (within the rounding the line shows: 0 steps for HEX and RGB, 1 for OKLab and OKLCH, 2 for Lab, 3 for HSL, HWB and LCH)', off + ' differ ' + JSON.stringify(global.__ccBad || {}));
  /* the contrast ratio, from the WCAG definition with the 0.04045 knee */
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (v) => 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]);
  let badRatio = 0;
  for (let i = 0; i < 300; i++) { const a = cols[i], b = cols[i + 300]; const x = lum(a), y = lum(b); const want = ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2) + ':1'; if (stat(gen(hex(a), hex(b)), 'Contrast ratio') !== want) badRatio++; }
  check(badRatio === 0 && stat(gen('#000000', '#ffffff'), 'Contrast ratio') === '21.00:1' && stat(gen('#123456', '#123456'), 'Contrast ratio') === '1.00:1', '300 random pairs: the contrast ratio equals the WCAG definition; black on white is 21.00:1, a colour on itself 1.00:1', badRatio);
  const names = Object.keys(current('engine/dev-color-converter.js').CC_NAMES_FOR_TEST || {});
  const src = fs.readFileSync(path.join(ROOT, 'engine/dev-color-converter.js'), 'utf8');
  const n = (/const CC_NAMES = \{([^}]*)\}/.exec(src)[1].match(/[a-z]+: '[0-9a-f]{6}'/g) || []).length;
  check(n === 148, 'the table holds the 148 CSS colour names (Chrome checks each value in the claims)', n);
  const bad = ['', 'foo', '#12', '#12345', 'rgb(1 2)', 'rgb(1 2 x)', 'hsl(a b c)', 'color(display-p3 1 0 0)', '1 2 3 4'];
  const refused = bad.filter((s) => !generate(C, { colour: s, bg: '#ffffff' }).error);
  check(refused.length === 0, 'nine malformed colours are refused, each with a message', refused.join(' | '));
  const clip = gen('oklch(70% 0.4 150)');
  check(/outside the sRGB screen range/.test(clip.warn || '') && /rgb\(\d+, \d+, \d+\)/.test(clip.output), 'a colour outside sRGB is moved inside it and the page says so', clip.warn);
  const nameCheck = gen('#ff6347').output;
  check(/NAME  tomato/.test(nameCheck) && /NAME  nearest/.test(gen('#ff6348').output), 'an exact CSS name is named; a near miss says "nearest"', nameCheck.split('\n')[11]);
}

function testMetaTags() {
  section('34  Meta tags: the head read back by Python\'s HTML parser gives the values that were typed, whatever characters they hold');
  const M = current('engine/dev-meta-tag-generator.js').DEV_TOOLS['meta-tag-generator'];
  const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(5);
  try { execFileSync('python', ['--version'], { stdio: 'ignore' }); } catch (e) { skip('python is not installed: the HTML parser comparison is skipped'); return; }
  const bits = ['a', 'B', ' ', '&', '<', '>', '"', "'", '&amp;', '&lt;b&gt;', 'é', '₹', '😀', '=', '/', '--', '\\', '%20', 'x y'];
  const word = () => { let t = ''; for (let k = 1 + rnd(8); k > 0; k--) t += bits[rnd(bits.length)]; return t; };
  const cases = [];
  for (let i = 0; i < 300; i++) cases.push({ title: word(), desc: word() + word(), url: 'https://example.com/' + word().replace(/\s/g, '_'), image: 'https://example.com/i/' + word().replace(/\s/g, '_') + '.png', site: word(), imgalt: word(), twitter: 'user_' + rnd(100), robots: ['', 'noindex, nofollow', 'index, follow'][rnd(3)] });
  const outs = cases.map((c) => generate(M, c).output);
  const py = 'import sys,json\nfrom html.parser import HTMLParser\nclass P(HTMLParser):\n  def __init__(s):\n    super().__init__(convert_charrefs=True); s.tags=[]; s.title=None; s.intitle=False\n  def handle_starttag(s,t,a):\n    if t=="title": s.intitle=True; s.title=""\n    else: s.tags.append([t,dict(a)])\n  def handle_endtag(s,t):\n    if t=="title": s.intitle=False\n  def handle_data(s,d):\n    if s.intitle: s.title+=d\nd=json.load(sys.stdin)\nout=[]\nfor h in d:\n  p=P(); p.feed(h); out.append([p.title,p.tags])\nprint(json.dumps(out,ensure_ascii=False))';
  const parsed = JSON.parse(execFileSync('python', ['-X', 'utf8', '-c', py], { input: JSON.stringify(outs), encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }), maxBuffer: 64 * 1024 * 1024 }));
  let bad = 0, firstBad = '';
  cases.forEach((c, i) => {
    const [title, tags] = parsed[i];
    const find = (k, v) => tags.find((t) => t[1][k] === v);
    const val = (k, v) => { const t = find(k, v); return t ? (t[1].content !== undefined ? t[1].content : t[1].href) : undefined; };
    const want = (s) => s.trim() || undefined;   // a blank field writes no tag
    const ok = (title === null ? undefined : title) === want(c.title) && val('name', 'description') === want(c.desc) && val('rel', 'canonical') === want(c.url) &&
      val('property', 'og:title') === want(c.title) && val('property', 'og:description') === want(c.desc) && val('property', 'og:site_name') === want(c.site) &&
      val('property', 'og:image') === want(c.image) && val('property', 'og:image:alt') === want(c.imgalt) && val('name', 'twitter:image:alt') === want(c.imgalt) &&
      val('name', 'twitter:site') === '@' + c.twitter && (c.robots === '' ? val('name', 'robots') === undefined : val('name', 'robots') === c.robots);
    if (!ok) { bad++; if (!firstBad) firstBad = JSON.stringify({ c, title, tags: tags.slice(0, 3) }).slice(0, 300); }
  });
  check(bad === 0, '300 random head blocks (quotes, angle brackets, ampersands, entities typed as text, emoji, backslashes): title, description, canonical, og:title, og:description, og:site_name, og:image, both image alts, twitter:site and robots come back exactly as typed', bad + ' differ ' + firstBad);
  const count = (c) => (generate(M, c).output.match(/^<(title|meta|link)\b/gm) || []).length;
  check(count({}) === 14 && stat(generate(M, {}), 'Tags generated') === '14', 'the default form writes 14 tags, as its depth copy says');
}

async function testDownloads(browser, watch) {
  section('14, 15  Downloads in the browser: .json / .csv, robots.txt, .htaccess');
  const dir = path.join(OUT, 'downloads');
  const { page, errors } = await newPage(browser, watch);
  await page.goto(BASE_URL + '/developer/csv-to-json/', { waitUntil: 'load' });
  await page.waitForSelector('.code-area');
  const setText = (t) => page.evaluate((v) => { const a = document.querySelector('.code-area'); a.value = v; a.dispatchEvent(new Event('input', { bubbles: true })); }, t);
  const setOpt = (k, v) => page.evaluate((key, val) => { const s = document.getElementById('f-' + key); s.value = val; s.dispatchEvent(new Event('change', { bubbles: true })); }, k, v);
  await setText('name;price\n"Tea, green";"2,50"');
  let got = await downloadOne(page, dir, 'Download');
  check(got && got.name === 'csv-to-json-output.json' && JSON.parse(got.body)[0].price === '2,50', 'CSV -> JSON (semicolons detected) saves csv-to-json-output.json', got && got.name + ' ' + got.body.slice(0, 80));
  await setOpt('dir', 'j2c');
  await setText('[{"a":{"b":1}}]');
  got = await downloadOne(page, dir, 'Download');
  check(got && got.name === 'csv-to-json-output.csv' && got.body === 'a.b\n1', 'JSON -> CSV saves csv-to-json-output.csv holding a.b / 1', got && got.name + ' ' + JSON.stringify(got.body));
  check(errors.length === 0, 'CSV to JSON: no page errors', errors.join(' | '));
  await page.close();
  /* Chrome will not save a name that starts with a dot: it drops the dot and,
     with no extension left, adds .txt for text/plain. The page asks for
     .htaccess (the link's download attribute) and its tip says what arrives. */
  for (const [url, asked, saved, head] of [['/developer/robots-txt-generator/', 'robots.txt', 'robots.txt', 'User-agent: *\nDisallow: /admin/'],
    ['/developer/htaccess-generator/', '.htaccess', 'htaccess.txt', '# Redirects']]) {
    const p = await newPage(browser, watch);
    await p.page.goto(BASE_URL + url, { waitUntil: 'load' });
    await p.page.waitForFunction(() => (document.querySelector('.code-out') || {}).textContent, { timeout: 10000 });
    await p.page.evaluate(() => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { window.__asked = this.download; return orig.call(this); };
    });
    const g = await downloadOne(p.page, dir, 'Download');
    const askedFor = await p.page.evaluate(() => window.__asked);
    check(askedFor === asked && g && g.name === saved && g.body.indexOf(head) === 0, url + ' asks for ' + asked + ' and Chrome saves ' + saved, askedFor + ' -> ' + (g && g.name) + ' ' + JSON.stringify(g && g.body.slice(0, 40)));
    await p.page.close();
  }
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
    await sleep(260);   // typing is debounced by 120 ms since wave 3
  };
  const audit = () => page.evaluate(() => {
    const box = document.querySelector('.md-preview');
    const bad = [];
    box.querySelectorAll('*').forEach((n) => {
      for (const a of n.attributes) {
        // th and td may carry one of three alignments, and nothing else in style
        if (a.name === 'style' && /^t[hd]$/.test(n.localName) && /^text-align: (left|center|right);$/.test(a.value)) continue;
        if (['href', 'target', 'rel', 'class', 'title', 'referrerpolicy'].indexOf(a.name) < 0) bad.push(n.localName + '[' + a.name + ']');
      }
      if (/^(script|iframe|svg|img|style|object|embed|form|details|math)$/.test(n.localName)) bad.push('<' + n.localName + '>');
      if (n.localName === 'a' && n.hasAttribute('href') && ['http:', 'https:', 'mailto:', 'tel:'].indexOf(new URL(n.href).protocol) < 0) bad.push('href ' + n.href);
    });
    return { bad, html: box.innerHTML, links: box.querySelectorAll('a[href]').length, text: box.textContent };
  });
  const PAYLOADS = ['[x](javascript:alert(1))', '[x](" onmouseover="alert(1))', '[x](x"onmouseover="alert(1))', '![x](javascript:alert(1))',
    '![x" onerror="alert(1)](https://example.com/a.png)', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '[x](data:text/html,<script>alert(1)</script>)',
    '| <script>alert(1)</script> | <img src=x onerror=alert(1)> |\n|:-:|--:|\n| [x](javascript:alert(1)) | [y](x"onmouseover="alert(1)) |\n| ![z" onerror="alert(1)](https://example.com/a.png) | <svg onload=alert(1)> |',
    '| a |\n|---" onmouseover="alert(1)|\n| b |'];
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

  // a pipe table renders, aligned, with borders that show in both themes
  await type('| Plan | Price | Note |\n|:-----|------:|:----:|\n| Pro | £9 | **best** |\n| Free | £0 |');
  const tbl = await audit();
  const look = await page.evaluate(() => {
    const res = {};
    for (const theme of ['dark', 'light']) {
      document.documentElement.setAttribute('data-theme', theme);
      const td = document.querySelector('.md-preview td'), box = document.querySelector('.md-preview');
      const cs = getComputedStyle(td);
      res[theme] = { width: cs.borderTopWidth, style: cs.borderTopStyle, color: cs.borderTopColor, bg: getComputedStyle(box).backgroundColor };
    }
    const cells = Array.prototype.map.call(document.querySelectorAll('.md-preview tr'), (tr) => Array.prototype.map.call(tr.children, (c) => c.localName + ':' + getComputedStyle(c).textAlign + ':' + c.textContent).join(' '));
    return { res, cells };
  });
  check(tbl.bad.length === 0 && /<table>\s*<thead>\s*<tr><th style="text-align: left;">Plan<\/th>/.test(tbl.html) && /<strong>best<\/strong>/.test(tbl.html),
    'a pipe table renders in the preview with its alignment and inline formatting', tbl.bad.join(' ') + ' | ' + tbl.html);
  check(look.cells.join(' / ') === 'th:left:Plan th:right:Price th:center:Note / td:left:Pro td:right:£9 td:center:best / td:left:Free td:right:£0 td:center:',
    'columns align left, right and centre; a short row is padded', look.cells.join(' / '));
  const lum = (c) => { const v = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const theme of ['dark', 'light']) {
    const r = look.res[theme];
    check(r.width === '1px' && r.style === 'solid' && ratio(r.color, r.bg) >= 3, 'table borders are solid and at least 3:1 against the preview in the ' + theme + ' theme', JSON.stringify(r) + ' ratio ' + ratio(r.color, r.bg).toFixed(2));
  }

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
        '<table><tr><td style="background:url(' + px + ')" onclick="alert(15)">c</td><td style="text-align:center;color:red">d</td>' +
        '<th style="text-align:left" onmouseover="alert(16)">e</th></tr></table>' +
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

async function makeIcon(page, cards) {
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
  /* eight PNG cards, then favicon.ico and site.webmanifest */
  await page.waitForFunction((n) => document.querySelectorAll('.file-card').length === n, { timeout: 15000 }, cards || 10);
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
  const ALL = Object.keys(SIZES).concat(['favicon.ico', 'site.webmanifest']).sort();
  const html = fs.readFileSync(path.join(ROOT, 'developer/favicon-generator/index.html'), 'utf8');
  check(/<script src="\/engine\/zip\.js" defer><\/script>/.test(html), 'the favicon page loads engine/zip.js');

  const verify = (buf, label) => {
    if (!buf) { check(false, label + ': a favicons.zip was downloaded'); return; }
    let entries;
    try { entries = readZip(buf); } catch (e) { check(false, label + ': the ZIP parses', e.message); return; }
    const names = entries.map((e) => e.name).sort();
    check(JSON.stringify(names) === JSON.stringify(ALL), label + ': the ZIP holds the eight icons, favicon.ico and site.webmanifest', names.join(', '));
    let allOk = true;
    const bad = [];
    const ico = entries.find((e) => e.name === 'favicon.ico');
    const man = entries.find((e) => e.name === 'site.webmanifest');
    if (ico) {
      const d = ico.data, n = d.readUInt16LE(4), got = [];
      for (let i = 0; i < n; i++) {
        const at = 6 + 16 * i, len = d.readUInt32LE(at + 8), off = d.readUInt32LE(at + 12), png = d.slice(off, off + len);
        got.push(d[at] + 'x' + d[at + 1] + (png.slice(0, 8).toString('hex') === '89504e470d0a1a0a' && png.readUInt32BE(16) === d[at] ? '' : ' (not a matching PNG)'));
      }
      check(ico.crcOk && d.readUInt16LE(0) === 0 && d.readUInt16LE(2) === 1 && got.join(',') === '16x16,32x32,48x48', label + ': favicon.ico is an icon file holding 16, 32 and 48 px PNGs', got.join(','));
    }
    if (man) {
      let m = null;
      try { m = JSON.parse(man.data.toString('utf8')); } catch (e) { /* null */ }
      check(m && m.icons.map((i) => i.src + ' ' + i.sizes + (i.purpose ? ' ' + i.purpose : '')).join(', ') === '/icon-192.png 192x192, /icon-512.png 512x512, /icon-maskable-512.png 512x512 maskable',
        label + ': site.webmanifest lists the 192, 512 and maskable icons', man.data.toString('utf8').slice(0, 300));
    }
    entries.filter((e) => SIZES[e.name]).forEach((e) => {
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
      check(r.status === 0 && JSON.stringify(listed) === JSON.stringify(ALL), label + ': Windows tar (libarchive) lists the same ten files', r.stderr || listed.join(', '));
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
    await makeIcon(page, 8);
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

/* ---------- 16  the QR pages in the browser ---------- */

async function testQrPages(browser, watch) {
  section('16  QR pages in the browser: render-qr.js, not render-dev.js');
  const PAGES = [
    ['/qr/qr-code-generator/', 'the generator draws a code and reads it back ("Verified")', () => /Verified: this exact image was scanned and read back correctly/.test(document.querySelector('.tool-io').textContent) && !!document.querySelector('.qr-stage svg')],
    ['/qr/qr-bulk-generator/', 'the bulk generator shows its list box', () => !!document.querySelector('.tool-io .bulk-input')],
    ['/qr/qr-code-scanner/', 'the scanner shows its picture input and camera button', () => !!document.querySelector('.scan-drop input[type=file]') && !!document.querySelector('button[data-act=start]')]
  ];
  for (const [url, what, ready] of PAGES) {
    const { page, errors, requests } = await newPage(browser, watch);
    await page.goto(BASE_URL + url, { waitUntil: 'load' });
    let ok = true;
    try { await page.waitForFunction(ready, { timeout: 15000, polling: 100 }); } catch (e) { ok = false; }
    const mounts = await page.evaluate(() => ['mountQR', 'mountQRBulk', 'mountQRScanner', 'mountCode', 'mountFile'].map((k) => k + ':' + typeof (window.MVRTool || {})[k]).join(' '));
    check(ok, url + ': ' + what, mounts + ' | ' + errors.join(' | '));
    const got = requests.filter((u) => /\/engine\/render-(qr|dev)\.js/.test(u)).map((u) => u.replace(/^.*\/engine\//, ''));
    check(got.join() === 'render-qr.js' && /mountQR:function mountQRBulk:function mountQRScanner:function mountCode:undefined mountFile:undefined/.test(mounts),
      url + ': fetched render-qr.js and not render-dev.js; the QR mounts are there and the developer ones are not', got.join() + ' | ' + mounts);
    check(errors.length === 0, url + ': no script errors', errors.join(' | '));
    await page.close();
  }
}

/* ---------- 17  the wave 3 shell (render-dev.js): layout, keys, memory, Worker ---------- */

/* Every expected value here comes from somewhere other than the shell: the
   browser's own JSON.stringify, the text the test typed, a position counted
   by hand, the file the test wrote. */
async function testShell(browser, watch) {
  section('17  The developer and text shell: two columns, keys, links, memory, Worker, errors');
  const URL_JSON = BASE_URL + '/developer/json-formatter/';
  const dir = path.join(OUT, 'downloads17');
  const { page, errors } = await newPage(browser, watch);
  await page.evaluateOnNewDocument(() => {
    const W = window.Worker; window.__workers = 0;
    window.Worker = function (u, o) { window.__workers++; window.__workerUrl = String(u); return new W(u, o); };
    window.Worker.prototype = W.prototype;
  });
  const ctx = browser.defaultBrowserContext();
  try { await ctx.overridePermissions(BASE_URL, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']); } catch (e) { /* older Chrome */ }
  await page.goto(URL_JSON, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.code-area');
  const type = (t) => page.evaluate((v) => { const a = document.querySelector('.code-area'); a.value = v; a.dispatchEvent(new Event('input', { bubbles: true })); }, t);
  const outText = () => page.$eval('.code-out', (e) => e.textContent);
  const SAMPLE = '{"b":[1,2,{"c":null}],"a":"x\\"y","n":-1.5e3,"t":true}';

  // --- layout: side by side at 1400, stacked at 390 with no sideways scroll
  await page.setViewport({ width: 1400, height: 900 });
  await sleep(150);
  let L = await page.evaluate(() => {
    const i = document.querySelector('.io-in').getBoundingClientRect(), o = document.querySelector('.io-out').getBoundingClientRect();
    const d = document.querySelector('.dev-divider');
    return { side: o.left >= i.right - 1 && Math.abs(o.top - i.top) < 2, sameH: Math.abs(o.height - i.height) < 2, divider: !!d && getComputedStyle(d).display !== 'none' && d.tabIndex === 0 && d.getAttribute('role') === 'separator' };
  });
  check(L.side && L.sameH && L.divider, 'at 1400 px the input and output sit side by side, the same height, with a focusable separator between', JSON.stringify(L));
  const w0 = await page.$eval('.io-in', (e) => e.getBoundingClientRect().width);
  await page.focus('.dev-divider');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const w1 = await page.$eval('.io-in', (e) => e.getBoundingClientRect().width);
  const now = await page.$eval('.dev-divider', (e) => e.getAttribute('aria-valuenow'));
  check(w1 > w0 + 40 && now === '60', 'the divider moves by keyboard: two presses of → widen the input from 50% to 60%', w0 + ' -> ' + w1 + ' (' + now + ')');
  // drag it back with the mouse
  const box = await page.$eval('.dev-split', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, w: r.width, y: r.top + 60 }; });
  const dv = await page.$eval('.dev-divider', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 60 }; });
  await page.mouse.move(dv.x, dv.y); await page.mouse.down(); await page.mouse.move(box.x + box.w * 0.35, dv.y, { steps: 5 }); await page.mouse.up();
  const dragged = await page.$eval('.dev-divider', (e) => Number(e.getAttribute('aria-valuenow')));
  check(dragged >= 33 && dragged <= 37, 'and by dragging: let go at 35% of the width, the input takes 35%', String(dragged));
  await page.setViewport({ width: 390, height: 844 });
  await sleep(150);
  L = await page.evaluate(() => {
    const i = document.querySelector('.io-in').getBoundingClientRect(), o = document.querySelector('.io-out').getBoundingClientRect();
    return { stacked: o.top >= i.bottom - 1, hidden: getComputedStyle(document.querySelector('.dev-divider')).display === 'none', sw: document.scrollingElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  check(L.stacked && L.hidden && L.sw <= L.cw, 'at 390 px they stack, the divider is gone and the page does not scroll sideways', JSON.stringify(L));
  await page.setViewport({ width: 1400, height: 900 });

  // --- full screen and Esc
  await page.click('.dev-full-btn');
  let F = await page.evaluate(() => { const r = document.querySelector('.tool-io').getBoundingClientRect(); return { pos: getComputedStyle(document.querySelector('.tool-io')).position, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; });
  check(F.pos === 'fixed' && F.w >= F.vw - 1 && F.h >= F.vh - 1, 'Full screen fills the window with the tool', JSON.stringify(F));
  await page.focus('.code-area');
  await page.keyboard.press('Escape');
  F = await page.evaluate(() => ({ pos: getComputedStyle(document.querySelector('.tool-io')).position, label: document.querySelector('.dev-full-btn').textContent }));
  check(F.pos !== 'fixed' && F.label === 'Full screen', 'Esc leaves full screen', JSON.stringify(F));

  // --- Load example and Clear are undoable
  const sample = await page.evaluate(() => window.DEV_TOOLS['json-formatter'].sample);
  await type('');
  await page.evaluate(() => [...document.querySelectorAll('.io-in button')].find((b) => b.textContent === 'Load example').click());
  const afterEx = await page.$eval('.code-area', (t) => t.value);
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  const undone = await page.$eval('.code-area', (t) => t.value);
  check(afterEx === sample && undone === '', 'Load example fills the box, and Ctrl+Z takes it out again', JSON.stringify(undone.slice(0, 30)));
  await type(SAMPLE);
  await page.evaluate(() => [...document.querySelectorAll('.io-in button')].find((b) => b.textContent === 'Clear').click());
  const cleared = await page.$eval('.code-area', (t) => t.value);
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  const back = await page.$eval('.code-area', (t) => t.value);
  check(cleared === '' && back === SAMPLE, 'Clear empties the box, and Ctrl+Z brings the text back', JSON.stringify(back.slice(0, 30)));

  // --- typing is debounced; Ctrl+Enter runs at once
  await sleep(200);
  await type('[1,2]');
  const early = await outText();
  await sleep(300);
  const late = await outText();
  check(early !== JSON.stringify([1, 2], null, 2) && late === JSON.stringify([1, 2], null, 2), 'typing waits for a pause (120 ms) before running; 300 ms later the output is there', JSON.stringify(early.slice(0, 20)) + ' -> ' + JSON.stringify(late));
  await type('[3]');
  await page.focus('.code-area');
  await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
  const ce = await outText();
  check(ce === JSON.stringify([3], null, 2), 'Ctrl+Enter runs straight away', JSON.stringify(ce));

  // --- the highlighter: spans, and the text is exactly the output
  await type(SAMPLE);
  await sleep(300);
  const H = await page.evaluate(() => { const o = document.querySelector('.code-out'); return { text: o.textContent, key: [...o.querySelectorAll('.hl-key')].map((s) => s.textContent), str: [...o.querySelectorAll('.hl-str')].map((s) => s.textContent), num: [...o.querySelectorAll('.hl-num')].map((s) => s.textContent), kw: [...o.querySelectorAll('.hl-kw')].map((s) => s.textContent), html: o.innerHTML }; });
  const ref = JSON.stringify(JSON.parse(SAMPLE), null, 2);
  check(H.text === ref, 'with highlighting on, the output pane\'s text is exactly JSON.stringify(…, null, 2)', JSON.stringify(H.text.slice(0, 60)));
  check(H.key.join() === '"b","c","a","n","t"' && H.str.join() === '"x\\"y"' && H.num.join() === '1,2,-1500' && H.kw.join() === 'null,true',
    'keys, strings, numbers and literals each get their own colour class', JSON.stringify([H.key, H.str, H.num, H.kw]));
  check(!/<(script|img|a)\b|on\w+=/.test(H.html), 'the highlighted pane holds only spans and text');
  const col = async (theme) => page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); return getComputedStyle(document.querySelector('.code-out .hl-key')).color; }, theme);
  const dark = await col('dark'), light = await col('light');
  check(dark !== light, 'the colours follow the theme: a key is ' + dark + ' on dark and ' + light + ' on light');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

  // --- an error marks its line and column in the input
  const BAD = '{\n  "a": 1,\n  "b": [1, 2,],\n  "c": 3\n}';
  await type(BAD);
  await sleep(300);
  const E = await page.evaluate(() => {
    const m = document.querySelector('.code-mark'), c = document.querySelector('.code-caret'), ta = document.querySelector('.code-area');
    const cs = getComputedStyle(ta), lh = parseFloat(cs.lineHeight), pt = parseFloat(cs.paddingTop);
    const mt = m.getBoundingClientRect().top - ta.getBoundingClientRect().top;
    return { msg: document.querySelector('.io-msg').textContent, jump: (document.querySelector('.dev-jump button') || {}).textContent, markShown: !m.hidden, line: Math.round((mt - pt) / lh) + 1, caretShown: !c.hidden, gutter: document.querySelector('.code-gutter-in').textContent.split('\n').length };
  });
  // the stray comma is on line 3; counted by hand: "  \"b\": [1, 2," is 13 characters, so the comma is column 13
  check(/line 3, column 13/.test(E.msg) && E.jump === 'Go to line 3, column 13' && E.markShown && E.line === 3 && E.caretShown && E.gutter === 5,
    'a trailing comma: the message names line 3, column 13; the gutter has 5 lines and line 3 is marked, with a caret', JSON.stringify(E));
  await page.click('.dev-jump button');
  const sel = await page.$eval('.code-area', (t) => [t.selectionStart, document.activeElement === t]);
  check(sel[0] === BAD.indexOf(',]') && sel[1], '"Go to line 3, column 13" puts the cursor on the comma', JSON.stringify(sel) + ' want ' + BAD.indexOf(',]'));
  await page.keyboard.press('Escape');
  const escMsg = await page.$eval('.io-msg', (m) => m.textContent);
  check(escMsg === '', 'Esc closes the message', escMsg);

  // --- options travel in the share link; a link sets them; a bad value is ignored
  await type('{"z":1}');
  await page.evaluate(() => { const s = document.getElementById('f-indent'); s.value = '4'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(200);
  const st = await page.evaluate(() => window.MVRTool.shareState());
  check(st.params.text === '{"z":1}' && st.params.indent === '4' && !('mode' in st.params), 'the share state carries the text and the changed option (indent 4), not the unchanged ones', JSON.stringify(st.params));
  const p2 = await newPage(browser, watch);
  const T2 = '{"k":[1,{"m":2}]}';
  await p2.page.goto(URL_JSON + '#text=' + encodeURIComponent(T2) + '&mode=minify&indent=evil', { waitUntil: 'load' });
  await p2.page.waitForSelector('.code-area');
  const L2 = await p2.page.evaluate(() => ({ mode: document.getElementById('f-mode').value, indent: document.getElementById('f-indent').value, out: document.querySelector('.code-out').textContent, bar: !document.querySelector('.dev-draft').hidden }));
  check(L2.mode === 'minify' && L2.indent === '2' && L2.out === JSON.stringify(JSON.parse(T2)) && !L2.bar,
    'a link with #text=…&mode=minify&indent=evil opens minified, ignores the bad indent, and offers no draft over the link', JSON.stringify(L2));
  await p2.page.close();

  // --- settings and the draft are remembered on this device
  await type('{"draft":true}');
  await sleep(900);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('1234tools-dev:json-formatter') || 'null'));
  check(saved && saved.v === 1 && saved.opts && saved.opts.indent === '4' && saved.draft && saved.draft.text === '{"draft":true}',
    'one key per tool, versioned: 1234tools-dev:json-formatter holds { v: 1, opts, draft }', JSON.stringify(saved));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.code-area');
  const R = await page.evaluate(() => ({ indent: document.getElementById('f-indent').value, ta: document.querySelector('.code-area').value, bar: document.querySelector('.dev-draft').hidden ? '' : document.querySelector('.dev-draft').textContent }));
  check(R.indent === '4' && R.ta === '' && /saved on this device \(14 characters\)/.test(R.bar), 'after a reload the indent is still 4 and a bar offers the 14-character draft back, without putting it in the box', JSON.stringify(R));
  await page.evaluate(() => [...document.querySelectorAll('.dev-draft button')].find((b) => b.textContent === 'Restore it').click());
  const restored = await page.$eval('.code-area', (t) => t.value);
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  const unrestored = await page.$eval('.code-area', (t) => t.value);
  check(restored === '{"draft":true}' && unrestored === '', 'Restore it puts the draft back as an undoable edit', JSON.stringify([restored, unrestored]));

  // --- the keyboard: Ctrl+S saves, Ctrl+Shift+C copies, the popover lists them
  await type(SAMPLE);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  await page.focus('.code-area');
  await page.keyboard.down('Control'); await page.keyboard.press('s'); await page.keyboard.up('Control');
  let saw = null;
  for (let i = 0; i < 50 && !saw; i++) { await sleep(100); const f = fs.readdirSync(dir).filter((n) => !/\.crdownload$/.test(n)); if (f.length) saw = { name: f[0], body: fs.readFileSync(path.join(dir, f[0]), 'utf8') }; }
  check(saw && saw.name === 'json-formatter-output.json' && saw.body === JSON.stringify(JSON.parse(SAMPLE), null, 4),
    'Ctrl+S, pressed straight after typing, saves json-formatter-output.json with the formatted text (4 spaces, as remembered)', saw && saw.name + ' ' + saw.body.slice(0, 40));
  await page.focus('.code-area');
  await page.keyboard.down('Control'); await page.keyboard.down('Shift'); await page.keyboard.press('KeyC'); await page.keyboard.up('Shift'); await page.keyboard.up('Control');
  await sleep(200);
  let clip = null;
  try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = null; }
  if (clip === null) skip('the clipboard cannot be read in this Chrome: Ctrl+Shift+C not checked');
  else check(clip.replace(/\r\n/g, '\n') === JSON.stringify(JSON.parse(SAMPLE), null, 4), 'Ctrl+Shift+C copies the whole output (the system clipboard may turn line ends into CRLF)', JSON.stringify(clip.slice(0, 40)));
  await page.click('.dev-keys-btn');
  const K = await page.evaluate(() => { const p = document.querySelector('.dev-keys'); return { shown: !p.hidden, keys: [...p.querySelectorAll('dt')].map((d) => d.textContent), exp: document.querySelector('.dev-keys-btn').getAttribute('aria-expanded') }; });
  check(K.shown && K.exp === 'true' && K.keys.join('|') === 'Ctrl + Enter|Ctrl + Shift + C|Ctrl + S|Esc', 'Shortcuts opens a list of the four keys', JSON.stringify(K));
  await page.keyboard.press('Escape');
  check(await page.$eval('.dev-keys', (p) => p.hidden), 'Esc closes the list');

  // --- an opened file: its name for the download; over 2 MB it stays out of the box
  const small = path.join(OUT, 'orders.json');
  fs.writeFileSync(small, '{"orders":[1,2,3]}');
  const picker = await page.$('.io-in input[type=file]');
  await picker.uploadFile(small);
  await page.waitForFunction(() => document.querySelector('.code-area').value === '{"orders":[1,2,3]}', { timeout: 5000 }).catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent === 'Download').click());
  saw = null;
  for (let i = 0; i < 50 && !saw; i++) { await sleep(100); const f = fs.readdirSync(dir).filter((n) => !/\.crdownload$/.test(n)); if (f.length) saw = f[0]; }
  check(saw === 'orders-formatted.json', 'an opened orders.json is saved as orders-formatted.json', String(saw));

  const rows = []; for (let i = 0; i < 30000; i++) rows.push({ id: i, name: 'Customer ' + i, city: ['Leeds', 'York', 'Hull'][i % 3], spend: (i * 7.31) % 1000 });
  const bigText = JSON.stringify(rows);
  const bigPath = path.join(OUT, 'big.json');
  fs.writeFileSync(bigPath, bigText);
  const workersBefore = await page.evaluate(() => window.__workers);
  const t0 = Date.now();
  await picker.uploadFile(bigPath);
  await page.waitForFunction(() => !document.querySelector('.dev-file').hidden && document.querySelector('.code-out').textContent.length > 1000000, { timeout: 30000 }).catch(() => {});
  const BG = await page.evaluate(() => ({ ta: document.querySelector('.code-area').value.length, bar: document.querySelector('.dev-file').textContent, shown: document.querySelector('.code-out').textContent.length, clip: document.querySelector('.dev-clip').hidden ? '' : document.querySelector('.dev-clip').textContent, workers: window.__workers, url: window.__workerUrl, items: [...document.querySelectorAll('.stat-row')].map((r) => r.textContent).join(' | ') }));
  const bigRef = JSON.stringify(rows, null, 4);
  check(BG.ta === 0 && /big\.json \(\d+\.\d\d MB\) is loaded but not shown/.test(BG.bar), 'a ' + (bigText.length / 1048576).toFixed(2) + ' MB file stays out of the text box, and a bar says so', JSON.stringify(BG.bar));
  check(BG.workers > workersBefore && /render-dev-worker\.js$/.test(BG.url || ''), 'it was formatted in the Web Worker (engine/render-dev-worker.js)', BG.workers + ' ' + BG.url);
  check(BG.shown === 1024 * 1024 && /Showing the first 1\.00 MB of [\d.]+ MB/.test(BG.clip) && BG.items.indexOf('Keys / items' + (rows.length * 5).toLocaleString('en-GB')) >= 0,
    'the pane shows the first 1 MB and says so; the figures count all ' + (rows.length * 5).toLocaleString('en-GB') + ' keys and items (30,000 rows of 4 keys)', JSON.stringify([BG.shown, BG.clip, BG.items.slice(0, 120)]) + ' in ' + (Date.now() - t0) + ' ms');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent === 'Download').click());
  saw = null;
  for (let i = 0; i < 100 && !saw; i++) { await sleep(100); const f = fs.readdirSync(dir).filter((n) => !/\.crdownload$/.test(n)); if (f.length && !fs.readdirSync(dir).some((n) => /\.crdownload$/.test(n))) saw = { name: f[0], body: fs.readFileSync(path.join(dir, f[0]), 'utf8') }; }
  check(saw && saw.name === 'big-formatted.json' && saw.body === bigRef, 'Download saves all of it, equal to JSON.stringify(…, null, 4) of the file (' + (bigRef.length / 1048576).toFixed(2) + ' MB)', saw && saw.name + ' ' + saw.body.length);
  check(errors.length === 0, 'JSON formatter: no page errors', errors.join(' | '));
  await page.close();

  // --- the regex tester: a runaway pattern is stopped at 2 s; Cancel stops it sooner
  const rx = await newPage(browser, watch);
  await rx.page.goto(BASE_URL + '/developer/regex-tester/', { waitUntil: 'load' });
  await rx.page.waitForSelector('.code-area');
  await rx.page.evaluate(() => {
    const p = document.getElementById('f-pattern'); p.value = '^(a+)+$'; p.dispatchEvent(new Event('change', { bubbles: true }));
    const t = document.querySelector('.code-area'); t.value = 'a'.repeat(34) + '!'; t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const r0 = Date.now();
  // the page stays responsive while the Worker grinds: a timer set now fires on time
  const lag = await rx.page.evaluate(() => new Promise((res) => { const s = performance.now(); setTimeout(() => res(performance.now() - s - 500), 500); }));
  await rx.page.waitForFunction(() => /Stopped after 2 seconds/.test(document.querySelector('.io-msg').textContent), { timeout: 8000 }).catch(() => {});
  const took = Date.now() - r0;
  const rmsg = await rx.page.$eval('.io-msg', (m) => [m.textContent, m.className]);
  check(/Stopped after 2 seconds/.test(rmsg[0]) && /is-error/.test(rmsg[1]) && took < 4500 && lag < 150,
    '^(a+)+$ on 34 a\'s and a ! (catastrophic backtracking) is stopped after 2 s and reported; the page kept running (a 500 ms timer was ' + Math.round(lag) + ' ms late)', took + ' ms: ' + rmsg[0].slice(0, 80));
  await rx.page.evaluate(() => { const t = document.querySelector('.code-area'); t.value = 'a'.repeat(35) + '!'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await rx.page.waitForFunction(() => !document.querySelector('.dev-busy').hidden, { timeout: 3000 }).catch(() => {});
  const busyShown = await rx.page.$eval('.dev-busy', (b) => !b.hidden && /Cancel/.test(b.textContent));
  await rx.page.evaluate(() => document.querySelector('.dev-busy button').click());
  const cm = await rx.page.$eval('.io-msg', (m) => [m.textContent, m.className]);
  check(busyShown && /^Stopped\./.test(cm[0]) && /is-warn/.test(cm[1]), 'past 300 ms a Working… bar with Cancel shows; Cancel stops the run at once', JSON.stringify(cm));
  await rx.page.evaluate(() => {
    const p = document.getElementById('f-pattern'); p.value = '(\\w+)@(\\w+)'; p.dispatchEvent(new Event('change', { bubbles: true }));
    const t = document.querySelector('.code-area'); t.value = 'ann@x and bo@y'; t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await rx.page.waitForFunction(() => /ann@x/.test(document.querySelector('.code-out').textContent), { timeout: 5000 }).catch(() => {});
  const ok = await rx.page.$eval('.code-out', (o) => o.textContent);
  const want = [...'ann@x and bo@y'.matchAll(/(\w+)@(\w+)/g)].map((m) => m[0]);
  check(want.every((w) => ok.indexOf('"' + w + '"') >= 0), 'after a stop, an ordinary pattern runs again in a fresh Worker', ok.slice(0, 80));
  check(rx.errors.length === 0, 'regex tester: no page errors', rx.errors.join(' | '));
  await rx.page.close();

  // --- the JWT decoder keeps no draft
  const jw = await newPage(browser, watch);
  await jw.page.goto(BASE_URL + '/developer/jwt-decoder/', { waitUntil: 'load' });
  await jw.page.waitForSelector('.code-area');
  await jw.page.evaluate(() => { const t = document.querySelector('.code-area'); t.value = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.x'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(900);
  const jst = await jw.page.evaluate(() => localStorage.getItem('1234tools-dev:jwt-decoder'));
  check(!jst || !JSON.parse(jst).draft, 'the JWT decoder never keeps a draft of a token', String(jst));
  await jw.page.close();

  // --- a generator: its settings in the link, remembered, its own file name, highlighted CSS
  const gr = await newPage(browser, watch);
  await gr.page.goto(BASE_URL + '/developer/css-gradient/#angle=45', { waitUntil: 'load' });
  await gr.page.waitForSelector('.gen-form');
  const G = await gr.page.evaluate(() => ({ angle: document.getElementById('f-angle').value, out: document.querySelector('.code-out').textContent, attr: [...document.querySelectorAll('.code-out .hl-attr')].map((s) => s.textContent), st: window.MVRTool.shareState() }));
  check(G.angle === '45' && /linear-gradient\(45deg/.test(G.out) && G.attr[0] === 'background' && G.st.kind === 'gen' && G.st.params.angle === '45',
    'CSS gradient opened with #angle=45: the angle is 45, the CSS is highlighted, and the share state carries angle=45', JSON.stringify(G));
  const kindAttr = await gr.page.$eval('[data-share]', (s) => s.getAttribute('data-share-kind'));
  check(kindAttr === 'gen', 'the generator\'s share row is the settings kind (gen)', kindAttr);
  await gr.page.waitForFunction(() => { const t = document.querySelector('.share-toggle'); return t && !t.hidden; }, { timeout: 5000 }).catch(() => {});
  const tog = await gr.page.evaluate(() => { const t = document.querySelector('.share-toggle'); return t ? { hidden: t.hidden, text: t.textContent } : null; });
  check(tog && !tog.hidden && /Include my settings/.test(tog.text), 'and the share bar offers "Include my settings"', JSON.stringify(tog));
  check(gr.errors.length === 0, 'CSS gradient: no page errors', gr.errors.join(' | '));
  await gr.page.close();

  // --- a text tool: wrapped prose, no gutter
  const wc = await newPage(browser, watch);
  await wc.page.goto(BASE_URL + '/text/word-counter/', { waitUntil: 'load' });
  await wc.page.waitForSelector('.code-area');
  const W = await wc.page.evaluate(() => ({ ws: getComputedStyle(document.querySelector('.code-area')).whiteSpace, gutter: !!document.querySelector('.code-wrap.has-gutter') }));
  check(W.ws === 'pre-wrap' && !W.gutter, 'the word counter wraps its text and shows no line numbers', JSON.stringify(W));
  await wc.page.close();
}

/* ---------- run ---------- */

(async () => {
  console.log('dev-fixes  root ' + ROOT + '  before = ' + BASE);
  testMarkdown();
  testCron();
  testMeta();
  testRobots();
  testLorem();
  testHtaccess();
  testPasswords();
  testWords();
  testCounter();
  testDiff();
  testQrNode();
  testBase64();
  testDefaults();
  testUrlPlus();
  testCsv();
  testRobotsExclusions();
  testQrSplit();
  testWave3Small();
  testGradient();
  testJsonFormatter();
  testRegex();
  testBase64Bytes();
  testUrlForms();
  testCsvPython();
  testXmlExpat();
  testHtmlEntities();
  testTextDiff();
  testWordCounter();
  testReadability();
  testUuid();
  testPasswordList();
  testCronEngine();
  testColourConverter();
  testMetaTags();
  if (!NODE_ONLY) await browserPart();
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (skipped ? ', ' + skipped + ' skipped' : ''));
  process.exit(fail ? 2 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
