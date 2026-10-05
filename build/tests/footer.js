#!/usr/bin/env node
/**
 * The footer note against what each page does.
 *
 *   node build/tests/footer.js [--root <site>] [--backend <1234tools-backend>] [--port <n>] [--out <dir>]
 *
 * Every page's footer says "Every calculation runs inside your browser — no
 * figures are sent to a server, and nothing you type is stored or logged."
 * That is false on a page that sends what is typed into it, so build-site.js
 * words those pages differently (see footerApply there). This checks the
 * built site from the page side, without asking build-site.js what it meant:
 *
 *   - a page that mounts an AI tool (/engine/render-ai.js) says the text, or
 *     on a picture tool the photo or scan, goes to Anthropic's API, that it
 *     needs an account, and the free allowance the page itself enforces
 *     (window.AI_LIMITS);
 *   - a page with a tool request form (a submitToolRequest endpoint) names
 *     the form; a FormSubmit form names FormSubmit.co; /account/, /settings/,
 *     /pricing/ and the practice pages say what they store;
 *   - every other page carries the default sentence, unchanged, with no block;
 *   - /showcase/, if built, carries no block of ours and not the default
 *     sentence (its builder words its own);
 *   - the line under the logo ends ", almost all of them running entirely in
 *     your browser." and names the exceptions (the AI for Business tools,
 *     the tool request, contact and showcase forms) on every page; on the
 *     AI pages that second sentence is narrowed to the page in an
 *     <!--about:ai|ai-hub--> block, and there is no such block anywhere
 *     else; no page says "running entirely in your browser" without
 *     "almost all of them" (the old unqualified ending);
 *   - footerApply() leaves every page as it is (the site is a fixed point).
 *   - every page with a footer-legal row carries exactly one version line
 *     (an empty <div data-site-ver> and the /assets/version.js script, right
 *     after "Made with dedication by MVR IT Services."), versionApply() is a
 *     fixed point, assets/version.js holds a valid record, sw.js precaches
 *     it past the HTTP cache, and app.css reserves the line's height. That
 *     the script fills it, offline too, is build/tests/version.js.
 *
 * With the backend checked out beside the site (or --backend), the claim
 * "we keep a count of your calls, not what you sent or what came back" and
 * the free allowance are checked against functions/index.js as well.
 * --port and --out are accepted for the same command line as the other
 * suites; nothing is served. Exit code 2 on a failed check.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(__dirname, '..', '..')));
const BACKEND = path.resolve(arg('backend', path.join(ROOT, '..', '1234tools-backend')));
const DEFAULT = 'Every calculation runs inside your browser — no figures are sent to a server, and nothing you type is stored or logged.';
/* the about line's ending, written out here rather than read from build-site.js */
const ABOUT_LEAD = ', almost all of them running entirely in your browser.';
const ABOUT_DEFAULT = ABOUT_LEAD + ' The exceptions are the <a href="/ai/">AI for Business</a> tools, which send what you give them through our server to Anthropic’s API, and the tool request, contact and showcase forms, which send what you type to us, as the <a href="/privacy/">privacy policy</a> explains.';
const ABOUT_LEGACY = ' and running entirely in your browser.';
/* the version line (build-site.js versionApply), written out here too */
const VER_AFTER = '<div>Made with dedication by MVR IT Services.</div>';
const VER_MARKUP = '<!--ver--><div class="site-ver" data-site-ver></div><script src="/assets/version.js" defer></script><!--/ver-->';

let pass = 0, fail = 0;
const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else { fail++; fails.push(msg); } };

function pages(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'build' || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) pages(abs, out);
    else if (e.name.endsWith('.html')) out.push(abs);
  }
  return out;
}

/* which AI tools send a picture, from the specs the pages run */
const box = { window: {} }; box.window.window = box.window;
for (const f of fs.readdirSync(path.join(ROOT, 'engine')).filter((n) => /^ai-tools.*\.js$/.test(n)).sort()) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'engine', f), 'utf8'), box, { filename: f });
}
const AI = box.window.AI_TOOLS || {};
const freeOf = (html) => {
  const m = /window\.AI_LIMITS=(\{[^}]*\})/.exec(html);
  return m ? JSON.parse(m[1]).free : Number(/free:\s*(\d+)/.exec(fs.readFileSync(path.join(ROOT, 'engine', 'render-ai.js'), 'utf8'))[1]);
};

const site = require(path.join(ROOT, 'build-site.js'));
const counts = {};   /* variant -> section -> n */
const bump = (v, rel) => { const s = rel.includes('/') ? rel.split('/')[0] : '(root)'; (counts[v] = counts[v] || {})[s] = (counts[v][s] || 0) + 1; };
const frees = new Set();

for (const abs of pages()) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const html = fs.readFileSync(abs, 'utf8');
  if (/http-equiv="refresh"/.test(html) && /noindex/.test(html)) continue;
  const sendsAi = /^ai\/[^/]+\/index\.html$/.test(rel) && html.includes('/engine/render-ai.js');

  /* the line under the logo: "… built by MVR IT Services, almost all of them
     running entirely in your browser." and then the exceptions — the AI
     tools and the three forms — everywhere, narrowed to the page in an
     <!--about:ai|ai-hub--> block on the AI pages, and nowhere the old
     unqualified "… and running entirely in your browser." */
  const aboutM = /<div class="footer-about">([\s\S]*?)<\/div>/.exec(html);
  if (aboutM) {
    const about = aboutM[1];
    const aboutKind = (/<!--about:([a-z-]+)-->/.exec(about) || [])[1] || null;
    const aiKind = rel === 'ai/index.html' ? 'ai-hub' : (sendsAi ? 'ai' : null);
    ok(!about.includes(ABOUT_LEGACY), rel + ': footer-about still says "and running entirely in your browser." unqualified');
    if (aiKind) {
      const aboutWords = (/<!--about:[a-z-]+-->([\s\S]*?)<!--\/about-->/.exec(about) || [])[1] || '';
      ok(aboutKind === aiKind && about.includes('MVR IT Services<!--about:' + aiKind + '-->' + ABOUT_LEAD) &&
        /Anthropic’s API/.test(aboutWords) && /as the note below explains\.$/.test(aboutWords) && !about.includes(ABOUT_DEFAULT) &&
        (aiKind === 'ai' ? /This AI tool is one of the exceptions/.test(aboutWords) : /AI tools in this section/.test(aboutWords) && /tool request form/.test(aboutWords)) &&
        (about.match(/<!--about:/g) || []).length === 1,
        rel + ': footer-about line not qualified for the AI tool (' + aiKind + '), found ' + aboutKind);
      bump('about-' + aiKind, rel);
    } else {
      ok(!aboutKind, rel + ': footer-about carries an about block (' + aboutKind + ') off the AI pages');
      ok(about.includes('MVR IT Services' + ABOUT_DEFAULT + '</p>'), rel + ': footer-about does not end with the default about line');
      bump('about-default', rel);
    }
  }
  /* anywhere on the page, "running entirely in your browser" only after "almost all of them" */
  const bare = html.split('almost all of them running entirely in your browser').join('');
  ok(!/running entirely in your browser/.test(bare), rel + ': says "running entirely in your browser" without "almost all of them"');

  /* the version line: one empty line and its script, straight after the
     legal row's last line, on every page with a legal row */
  if (html.includes('<div class="footer-legal">')) {
    const legal = html.slice(html.indexOf('<div class="footer-legal">'));
    ok((html.match(/<!--ver-->/g) || []).length === 1 && (html.match(/data-site-ver/g) || []).length === 1 &&
      (html.match(/\/assets\/version\.js/g) || []).length === 1, rel + ': not exactly one version line');
    ok(legal.includes(VER_AFTER + '\n      ' + VER_MARKUP), rel + ': version line missing, or not right after "' + VER_AFTER + '"');
    ok(site.versionApply(html) === html, rel + ': versionApply would change it (not a fixed point)');
    bump('version', rel);
  } else ok(!html.includes('<!--ver-->'), rel + ': a version line outside a footer-legal row');

  const n = /<div class="footer-note">([\s\S]*?)<\/div>/.exec(html);
  if (!n) continue;
  const note = n[1];
  const block = /<!--foot:([a-z-]+)-->([\s\S]*?)<!--\/foot-->/.exec(note);
  const kind = block ? block[1] : (note.includes(DEFAULT) ? 'default' : 'other');
  const words = block ? block[2] : '';
  bump(kind, rel);

  ok(site.footerApply(html, rel) === html, rel + ': footerApply would change it (not a fixed point)');
  ok((note.match(/<!--foot:/g) || []).length <= 1, rel + ': more than one footer block');
  const request = /data-endpoint="[^"]*\/submitToolRequest"/.test(html);
  const formsubmit = /<form\b[^>]*\baction="https:\/\/formsubmit\.co\//.test(html);
  const practice = html.includes('src="/assets/practice.js"');

  if (rel.startsWith('showcase/')) {
    ok(!block, rel + ': carries a footer block of ours; build-showcase.js words this page');
    ok(!note.includes(DEFAULT), rel + ': has the default sentence, but its form sends what is typed');
    continue;
  }
  if (rel === 'ai/index.html') {
    ok(kind === 'ai-hub', rel + ': expected the ai-hub wording, found ' + kind);
    ok(/Anthropic’s API/.test(words) && /tool request form/.test(words) && words.includes(freeOf(html) + ' AI calls a month'), rel + ': ai-hub wording misses the model, the request form or the allowance');
    ok(!note.includes(DEFAULT), rel + ': still carries the default sentence');
    continue;
  }
  if (sendsAi) {
    const slug = (/data-tool="([^"]+)"/.exec(html) || [])[1];
    const spec = AI[slug];
    ok(!!spec, rel + ': mounts ' + slug + ', which engine/ai-tools*.js does not define');
    const picture = !!spec && (spec.inputs || []).some((i) => i.type === 'image');
    const free = freeOf(html); frees.add(free);
    ok(kind === 'ai', rel + ': expected the ai wording, found ' + kind);
    ok(!note.includes(DEFAULT), rel + ': still carries the default sentence');
    ok(/Anthropic’s API/.test(words) && /free account/.test(words) && words.includes(free + ' AI calls a month') && /not what you sent or what came back/.test(words),
      rel + ': ai wording misses the model, the account, the allowance or what is kept');
    ok(picture === /photo or scan/.test(words), rel + ': ' + (picture ? 'a picture tool not saying the photo goes' : 'a text tool talking about a photo'));
    continue;
  }
  if (formsubmit) {
    ok(kind === 'contact' && /FormSubmit\.co/.test(words) && !note.includes(DEFAULT), rel + ': a FormSubmit form without the contact wording');
    continue;
  }
  const own = { 'account/index.html': 'account', 'settings/index.html': 'settings', 'pricing/index.html': 'pricing' }[rel];
  if (own) {
    ok(kind === own && !note.includes(DEFAULT), rel + ': expected the ' + own + ' wording, found ' + kind);
    continue;
  }
  if (practice) {
    ok(kind === 'practice' && /London/.test(words) && !note.includes(DEFAULT), rel + ': practice page without the practice wording');
    continue;
  }
  if (request) {
    ok(kind === 'request' && note.includes(DEFAULT + '<!--foot:request--> ') && /tool request form/.test(words), rel + ': a tool request form without the request wording');
    continue;
  }
  ok(kind === 'default', rel + ': expected the default sentence alone, found ' + kind);
}

/* what the version line reads and how it is served: the record parses; sw.js
   precaches it past the HTTP cache and serves .js cache-first; the line's
   height is reserved in app.css (build/site/shell.css) */
{
  const vsrc = fs.existsSync(path.join(ROOT, 'assets/version.js')) ? fs.readFileSync(path.join(ROOT, 'assets/version.js'), 'utf8') : '';
  const m = /var REC = (\{[^}\n]*\});/.exec(vsrc);
  let rec = null;
  try { rec = m && JSON.parse(m[1]); } catch (e) { /* null */ }
  ok(!!rec && Number.isInteger(rec.v) && /^\d{4}-\d\d-\d\d$/.test(rec.date) && (rec.built_on == null || /^[0-9a-f]{7,40}$/.test(rec.built_on)),
    'assets/version.js: no valid record (v, date, built_on): ' + (m && m[1]));
  ok(/data-site-ver/.test(vsrc) && /Update ready — reload/.test(vsrc) && !/https?:\/\//.test(vsrc.replace(/\/\*[\s\S]*?\*\//g, '')),
    'assets/version.js: does not fill [data-site-ver], offer the reload, or stays off the network');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(/var SHELL = \[[^\]]*'\.\/assets\/version\.js'/.test(sw) && /'\.\/assets\/version\.js': true/.test(sw) && /cache: 'no-cache'/.test(sw),
    'sw.js: does not precache assets/version.js past the HTTP cache');
  const css = fs.readFileSync(path.join(ROOT, 'assets/app.css'), 'utf8');
  const rule = /\.site-ver \{([^}]*)\}/.exec(css);
  ok(!!rule && /min-height:\s*24px/.test(rule[1]) && /flex-basis:\s*100%/.test(rule[1]), 'app.css: no .site-ver rule reserving the line');
  ok(/\.site-ver-update:focus-visible/.test(css), 'app.css: the reload button has no focus style');
}

/* the backend: what aiComplete keeps, and the free allowance */
const fnFile = path.join(BACKEND, 'functions', 'index.js');
if (fs.existsSync(fnFile)) {
  const src = fs.readFileSync(fnFile, 'utf8');
  const start = src.indexOf('exports.aiComplete');
  const body = src.slice(start, src.indexOf('\nexports.', start + 10));
  const writes = [...body.matchAll(/\.(?:set|add|update)\(\s*(\w+)\s*,\s*(\{[^;]*?\})\s*(?:,\s*\{[^}]*\})?\)/g)].map((m) => m[2]);
  ok(start > 0 && writes.length > 0, 'backend: aiComplete and its writes were found');
  ok(writes.every((w) => !/\b(input|words|text|system|images|pics|content|data)\b\s*[:,}]/.test(w)), 'backend: an aiComplete write stores the input or the answer: ' + writes.join(' | '));
  ok(!/console\.(log|info|warn|error)\([^)]*\b(input|words|text)\b/.test(body), 'backend: aiComplete logs the input or the answer');
  const fc = /FREE_CREDITS\s*=\s*Number\(process\.env\.FREE_CREDITS\s*\|\|\s*(\d+)\)/.exec(src);
  ok(!!fc && [...frees].every((f) => f === Number(fc[1])), 'backend: FREE_CREDITS default ' + (fc && fc[1]) + ' vs the pages\' ' + [...frees].join(','));
  ok(/api\.anthropic\.com/.test(body), 'backend: aiComplete calls Anthropic’s API, as the footer says');
} else {
  console.log('  (backend not found at ' + BACKEND + ': its checks skipped)');
}

console.log('\nfooter variants by section:');
for (const v of Object.keys(counts).sort()) {
  const s = counts[v];
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  console.log('  ' + v.padEnd(9) + String(total).padStart(5) + '   ' + Object.keys(s).sort().map((k) => k + ' ' + s[k]).join(', '));
}
fails.slice(0, 40).forEach((m) => console.log('  FAIL ' + m));
if (fails.length > 40) console.log('  … +' + (fails.length - 40) + ' more');
console.log('\nfooter: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 2 : 0);
