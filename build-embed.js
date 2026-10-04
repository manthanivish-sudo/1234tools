/**
 * Generate /embed/ — "Embed our calculators".
 *
 *   node build-embed.js          apply
 *   node build-embed.js --check  report what would change, write nothing
 *
 * Every calculator and unit converter already has an Embed button in its
 * share bar (assets/share.js). This page is for the people who would use it
 * and do not know it is there: a blogger, a school, a club, a small business.
 * It says what the frame does and does not do, shows two working, and has a
 * picker that writes the same code the Embed button writes, for any of them,
 * without opening each tool first.
 *
 * The page cannot be allowed to disagree with the share bar, so the facts it
 * prints are read rather than typed:
 *
 *   - the heights come out of assets/share.js's EMBED_HEIGHT, and the kinds
 *     that can be embedded out of its FIG_KINDS;
 *   - the tools that can be embedded are found by reading every page's share
 *     placeholder (data-share-kind), not from a list kept here;
 *   - the picker builds the code from the search index, so this builder
 *     checks, for every embeddable page, that what the picker will derive —
 *     the title, the canonical, utm_campaign and utm_content — is exactly what
 *     share.js reads off that page. One mismatch stops the build.
 *
 * Not a section and no tool of its own, so nothing here moves a count. The
 * page is a meta page in build/sections.js ('/embed/') and a reading page in
 * build-site.js's READING table at 0.6. It does not touch sw.js: bump it by
 * hand when this ships.
 *
 * Run it on a clean export, never on the working tree.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const hubs = require('./build-hubs.js');
const crumbs = require('./build-crumbs.js');
const outbound = require('./build-outbound.js');
const share = require('./build-share.js'); /* the share bar and og:image, as build-share.js writes them */
const proof = require('./build-proof.js'); /* the example, the story and the card thumbnails, as build-proof.js writes them */
const { trailFor } = require('./build/sections.js');
/* the sidebar has one owner; ours must match what it would write */
const { apply: sidebarFor } = require('./build-sidebar.js');
const { footerApply } = require('./build-site.js'); /* the footer note, as build-site.js words it */

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const SITE = 'https://www.1234tools.com';
const SITE_NAME = '1234Tools';
const SECTION = 'embed';
const SHELL_PAGE = 'business/index.html';
const LABEL = 'Embed';

/* The two frames that run on the page itself. */
const LIVE = ['health/bmi/', 'conversions/length/inch-to-centimeter/'];

/* A dozen to start with. Our pick, not a ranking: no analytics run inside an
   embedded frame, so which tools are embedded most is not something we know. */
const PICKS = [
  'health/bmi/', 'mathematics/percentage/', 'finance/compound-interest/', 'finance/loan-payment/',
  'india/emi-calculator/', 'india/gst-calculator/', 'india/sip-calculator/', 'time/age-calculator/',
  'education/marks-percentage/', 'conversions/length/inch-to-centimeter/',
  'conversions/temperature/celsius-to-fahrenheit/', 'conversions/mass/kilogram-to-pound/'
];

const changes = [];
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (existing === content) return false;
  changes.push((existing === null ? 'create ' : 'update ') + rel);
  if (!CHECK) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, content); }
  return true;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s)
  .replace(/&(?:lt|#0*60);/g, '<').replace(/&(?:gt|#0*62);/g, '>')
  .replace(/&(?:quot|#0*34);/g, '"').replace(/&(?:#0*39|apos|#x27);/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&(?:amp|#0*38);/g, '&');
const icon = (id) => '<svg class="ico" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + id + '"></use></svg>';
const num = (n) => Number(n).toLocaleString('en-GB');

/* ---------- what assets/share.js says ---------------------------------- */

function shareFacts() {
  const src = fs.readFileSync(path.join(ROOT, 'assets/share.js'), 'utf8');
  const read = (name) => {
    const m = new RegExp('var ' + name + ' = (\\{[^}]*\\});').exec(src);
    if (!m) throw new Error('could not read ' + name + ' from assets/share.js');
    return new Function('return ' + m[1])();
  };
  const heights = read('EMBED_HEIGHT');
  const kinds = Object.keys(read('FIG_KINDS'));
  for (const k of kinds) if (!heights[k]) throw new Error('assets/share.js embeds "' + k + '" with no height of its own');
  if (src.indexOf("href = '/embed/'") < 0 && src.indexOf('href="/embed/"') < 0) {
    throw new Error('the Embed popover in assets/share.js does not link to /embed/');
  }
  return { heights, kinds };
}

/* ---------- the search index: titles, in the site's own order ---------- */

function searchIndex() {
  const box = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/search-index.js'), 'utf8'))(box);
  return box.SEARCH_INDEX || [];
}

/* ---------- every embeddable page, read off the page ------------------- */

function pages() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git' || name === 'build') continue;
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else if (name === 'index.html') out.push(abs);
    }
  })(ROOT);
  return out;
}

/** The code share.js's embedCode() writes for a page, with "Include my figures" off. */
function embedCode(p, title, kind, heights) {
  const parts = p.replace(/\/$/, '').split('/');
  const canonical = SITE + '/' + p;
  const u = new URL(canonical);
  u.searchParams.set('embed', '1');
  u.searchParams.set('utm_source', 'embed');
  u.searchParams.set('utm_medium', 'share');
  u.searchParams.set('utm_campaign', parts[0]);
  u.searchParams.set('utm_content', parts.slice(1).join('/'));
  return '<iframe src="' + esc(u.href) + '" width="100%" height="' + (heights[kind] || 600) +
    '" style="border:0;border-radius:12px;max-width:720px" loading="lazy" title="' + esc(title + ' — ' + SITE_NAME) + '"></iframe>\n' +
    '<p style="font:14px system-ui"><a href="' + esc(canonical) + '">' + esc(title) + '</a> by ' + SITE_NAME +
    ' — free, runs in the browser.</p>';
}

/**
 * Every page that share.js would give an Embed button, checked against what
 * the picker on /embed/ will derive for it from the search index.
 */
function embeddable(facts, index) {
  const titles = new Map(index.map((e) => [String(e[1]), String(e[0])]));
  const found = [];
  const bad = [];
  for (const abs of pages()) {
    const html = fs.readFileSync(abs, 'utf8');
    const m = /data-share data-share-kind="([a-z]+)" data-share-sec="([^"]*)" data-share-slug="([^"]*)"/.exec(html);
    if (!m || facts.kinds.indexOf(m[1]) < 0) continue;
    const rel = path.relative(ROOT, path.dirname(abs)).split(path.sep).join('/') + '/';
    const [, kind, sec, slug] = m;
    const parts = rel.replace(/\/$/, '').split('/');
    if (sec !== parts[0] || slug !== parts.slice(1).join('/')) bad.push(rel + ': share.js would send utm_campaign=' + sec + ' utm_content=' + slug);
    const c = /<link rel="canonical" href="([^"]+)">/.exec(html);
    if (!c || c[1] !== SITE + '/' + rel) bad.push(rel + ': canonical is ' + (c ? c[1] : 'missing'));
    const h = /<article class="tool[^"]*"[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    const h1 = h ? unesc(h[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : '';
    const t = titles.get(rel);
    if (t === undefined) bad.push(rel + ': not in assets/search-index.js, so the picker cannot offer it');
    else if (t !== h1) bad.push(rel + ': the index calls it "' + t + '", its own heading "' + h1 + '"');
    if (kind === 'converter' && !/^conversions\/[^/]+\/[^/]+\/$/.test(rel)) bad.push(rel + ': a converter outside conversions/<family>/<pair>/');
    if (kind !== 'converter' && rel.indexOf('conversions/') === 0) bad.push(rel + ': a ' + kind + ' inside conversions/');
    found.push({ path: rel, kind, title: h1 });
  }
  /* The picker treats every conversions/<family>/<pair>/ entry in the index
     as a converter; that has to stay true. */
  const conv = new Set(found.filter((f) => f.kind === 'converter').map((f) => f.path));
  for (const e of index) {
    if (/^conversions\/[^/]+\/[^/]+\/$/.test(e[1]) && !conv.has(e[1])) bad.push(e[1] + ': in the index as a conversion, but its page has no converter share row');
  }
  if (bad.length) throw new Error('/embed/ would hand out code that does not match the share bar:\n    - ' + bad.slice(0, 20).join('\n    - ') + (bad.length > 20 ? '\n    … and ' + (bad.length - 20) + ' more' : ''));
  return found;
}

/* ---------- a tool's own words, read from its own page ----------------- */

function toolMeta(p) {
  const abs = path.join(ROOT, p, 'index.html');
  if (!fs.existsSync(abs)) throw new Error('/embed/ points at /' + p + ', which does not exist');
  const d = /<meta name="description" content="([^"]*)">/.exec(fs.readFileSync(abs, 'utf8'));
  if (!d) throw new Error('/' + p + ' has no description to read');
  return unesc(d[1]);
}

/* ---------- the shell, borrowed from a real page ----------------------- */

function shell() {
  const src = fs.readFileSync(path.join(ROOT, SHELL_PAGE), 'utf8');
  const headEnd = src.indexOf('</head>');
  const open = '<main id="main" class="content">';
  const mainStart = src.indexOf(open);
  const mainEnd = src.indexOf('</main>');
  if (headEnd < 0 || mainStart < 0 || mainEnd < 0) throw new Error('could not read the shell from ' + SHELL_PAGE);
  return { head: src.slice(0, headEnd), mid: src.slice(headEnd, mainStart + open.length), tail: src.slice(mainEnd) };
}

function headFor(parts, pathOnly, title, description) {
  const url = SITE + pathOnly;
  const full = title + ' | 1234Tools';
  return parts.head
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(full) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(full) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">')
    .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(full) + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(description) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '')
    .replace(/<!-- PWA: generated by build-pwa\.js, do not edit -->[\s\S]*?<!-- \/PWA -->\n?/, '')
    .replace(/(<script src="\/engine\/[^"]*"[^>]*><\/script>\n?)+/, '');
}

/* ---------- the page --------------------------------------------------- */

const KIND_NAME = { calc: 'Calculator', converter: 'Unit converter', currency: 'Currency converter' };

function page(parts, facts, list) {
  const pathOnly = '/' + SECTION + '/';
  const rel = SECTION + '/index.html';
  const trail = trailFor(pathOnly);
  const byPath = new Map(list.map((f) => [f.path, f]));
  const n = { calc: 0, converter: 0, currency: 0 };
  list.forEach((f) => { n[f.kind] = (n[f.kind] || 0) + 1; });
  const calcs = n.calc + (n.currency || 0);
  const total = list.length;

  const need = (p) => { const f = byPath.get(p); if (!f) throw new Error('/embed/ names /' + p + ', which has no Embed button'); return f; };
  LIVE.forEach(need);
  PICKS.forEach(need);
  if (new Set(PICKS).size !== PICKS.length) throw new Error('a pick on /embed/ is listed twice');

  const title = 'Embed our calculators: free calculators and converters for your own website';
  const description = 'Put any ' + SITE_NAME + ' calculator or unit converter on your blog, school site or small business page with two lines of HTML — free, no account, nothing your readers type is sent anywhere, and no analytics inside the frame.';

  /* The two frames on this page are the real thing, at the heights the code
     uses, so what a visitor sees here is what their readers will see. */
  const liveFig = (p, caption) => {
    const f = need(p);
    return '<figure class="embed-live-item"><iframe src="/' + p + '?embed=1" width="100%" height="' + facts.heights[f.kind] +
      '" loading="lazy" title="' + esc(f.title + ' — ' + SITE_NAME) + '"></iframe>' +
      '<figcaption>' + caption + '</figcaption></figure>';
  };

  const sample = embedCode('health/bmi/', need('health/bmi/').title, 'calc', facts.heights);

  /* Only what the picker cannot work out for itself: which pages outside
     conversions/ can be embedded, and as what. */
  const data = {
    site: SITE,
    heights: facts.heights,
    kinds: list.filter((f) => f.kind !== 'converter').reduce((o, f) => { o[f.path] = f.kind; return o; }, {})
  };

  const pickCards = PICKS.map((p) => {
    const f = need(p);
    return '<div class="card embed-card"><a class="embed-card-link" href="/' + p + '"><strong>' + esc(f.title) + '</strong></a>' +
      '<span class="card-desc">' + esc(toolMeta(p)) + '</span>' +
      '<span class="embed-card-foot"><span class="tag tag-free">' + esc(KIND_NAME[f.kind]) + ' · ' + facts.heights[f.kind] + ' px</span>' +
      '<button type="button" class="linkish" data-embed-path="' + esc(p) + '">Get the code</button></span></div>';
  }).join('');

  const faq = [
    { q: 'Does it cost anything?', a: 'No. There is no account, no key and no plan behind the embed code, and nothing to renew. Paste it into your page and it works.' },
    { q: 'Does it track my readers?', a: 'No analytics run inside the frame. When a tool is opened with ?embed=1 in its address there is no consent banner, no Google Analytics and no Clarity: the analytics script stops before it loads anything. The frame is fetched from 1234tools.com like any other page, so the request reaches our host the way a request for your page reaches yours.' },
    { q: 'Can I make it match my site’s colours?', a: 'Not at the moment. The frame shows the tool in this site’s own dark theme whatever your page looks like; there is no setting for a light version or for your colours. The rounded corners and the border in the code are yours to change.' },
    { q: 'Which tools can be embedded?', a: 'Every calculator and every unit converter — ' + num(total) + ' of them. The PDF, image and AI tools have no embed code: they need a file chooser, a download or an account, which belong on their own pages. Link to those instead.' },
    { q: 'Will it work on a phone?', a: 'Yes. The frame is 100% wide and the tool rearranges itself to fit the column, which makes it a little taller on a narrow screen. Look at your page on a phone, and raise the height in the code if more of the tool should show without scrolling inside the frame.' },
    { q: 'Can the frame open with figures already filled in?', a: 'Yes. Open the tool on this site, enter the figures, tick “Include my figures” in its share bar, then press Embed. The figures travel after the # in the frame’s address, so the tool opens showing that answer — and your readers can still change it. The picker on this page writes the code without figures.' }
  ];

  const body =
    crumbs.render(trail, LABEL) + '\n' +
    '<article class="collection embed-page">\n' +
    '  <p class="eyebrow">For bloggers, schools and small sites</p>\n' +
    '  <h1>' + icon('i-code').replace('class="ico"', 'class="ico ico-title"') + 'Embed our calculators</h1>\n' +
    '  <p class="lede">Any calculator or unit converter on ' + SITE_NAME + ' can go on your own page: copy two lines of HTML and the tool works there, for your readers, exactly as it does here. Free, no account, nothing your readers type is sent anywhere, and a small “Powered by ' + SITE_NAME + '” credit underneath.</p>\n' +
    '  <p class="collection-count">' + num(calcs) + ' calculators and ' + num(n.converter) + ' unit converters can be embedded · free · no account · no analytics inside the frame</p>\n' +
    '  <p class="collection-intro">Every calculator and converter on this site has an Embed button in its share bar. It writes an iframe that shows the tool on its own — no header, no sidebar, no footer — and a short paragraph under it that links back to the tool. Paste both into your page and you are done.</p>\n' +
    '  <p class="collection-intro">This page explains what that frame does and does not do, shows two of them working, and gets you the code for any of the ' + num(total) + ' without opening each one.</p>\n' +

    '  <section class="collection-group">\n    <h2>Two of them, working</h2>\n' +
    '    <p class="group-blurb">These are real frames, at the heights the code uses. Type into them.</p>\n' +
    '    <div class="embed-live">' +
      liveFig(LIVE[0], 'A calculator, at the ' + facts.heights.calc + ' pixels every calculator’s code asks for.') +
      liveFig(LIVE[1], 'A unit converter, at ' + facts.heights.converter + ' pixels: the value, the two units and the answer. The full table of every unit stays on 1234Tools; it is left out of the frame so it fits.') +
    '</div>\n  </section>\n' +

    '  <section class="panel"><h2>Why put one on your page</h2><ul class="tips">' +
      '<li><strong>Free, and nothing to sign up to.</strong> There is no key, no account and no plan. Paste the code and it works.</li>' +
      '<li><strong>Nothing your readers type is sent anywhere.</strong> The sums are done in their own browser. The frame loads from 1234tools.com and asks nothing of any other site; the currency converter fetches the day’s rates from this site too.</li>' +
      '<li><strong>No analytics inside the frame.</strong> With ?embed=1 in the address there is no consent banner, no Google Analytics and no Clarity. Nothing asks your readers to accept anything.</li>' +
      '<li><strong>Just the tool.</strong> The header, the sidebar, the footer, the share bar and the explanations are hidden. What is left is the tool, its answer and a one-line credit with a link to the full page.</li>' +
      '<li><strong>No adverts.</strong> There is no advertising code on these pages, so nothing in the frame competes with yours.</li>' +
      '<li><strong>It keeps working once it has loaded.</strong> Every answer after that is worked out in the reader’s browser, without another trip to the network.</li>' +
    '</ul></section>\n' +

    '  <section class="panel embed-picker" id="get-code" aria-labelledby="get-code-h">\n' +
    '    <h2 id="get-code-h">Get the code for any calculator or converter</h2>\n' +
    '    <p>Search the ' + num(total) + ' tools that can be embedded. Pick one and its code appears below, exactly as the Embed button on its own page writes it.</p>\n' +
    '    <label class="visually-hidden" for="embed-q">Search calculators and converters</label>\n' +
    '    <input id="embed-q" class="control dir-search" type="search" placeholder="Search calculators and converters — try “BMI”, “EMI” or “miles”" autocomplete="off">\n' +
    '    <p class="embed-hint" id="embed-hint">Start typing to search.</p>\n' +
    '    <div class="embed-results" id="embed-results"></div>\n' +
    '    <div class="embed-out" id="embed-out" hidden>\n' +
    '      <p class="embed-picked"><strong id="embed-name"></strong> <span id="embed-meta"></span> · <a id="embed-open" href="/">Open the tool</a></p>\n' +
    '      <textarea id="embed-code" class="share-embed-result" readonly aria-label="Embed code" spellcheck="false"></textarea>\n' +
    '      <div class="io-actions"><button type="button" class="btn-primary" id="embed-copy">Copy embed code</button>' +
      '<button type="button" class="btn-ghost" id="embed-preview-btn" aria-expanded="false" aria-controls="embed-preview">Preview it here</button></div>\n' +
    '      <div class="embed-preview" id="embed-preview" hidden></div>\n' +
    '    </div>\n' +
    '    <p class="embed-status" id="embed-status" role="status" aria-live="polite"></p>\n' +
    '    <noscript><p>The search needs JavaScript. Every calculator and converter has the same code under the Embed button in its own share bar.</p></noscript>\n' +
    '    <script type="application/json" id="embed-data">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>\n' +
    '  </section>\n' +

    '  <section class="panel"><h2>What the code looks like</h2>\n' +
    '    <p>This is the code for the BMI calculator. Every tool’s code has the same two parts.</p>\n' +
    '    <pre class="code-out embed-sample">' + esc(sample) + '</pre>\n' +
    '    <ul class="tips">' +
      '<li><strong>The iframe.</strong> Its address ends in ?embed=1, which is what hides the site around the tool. The utm_ parameters say which tool it is; they carry nothing about you or your readers.</li>' +
      '<li><strong>width="100%" and max-width:720px.</strong> The frame fills your column, up to 720 pixels.</li>' +
      '<li><strong>loading="lazy".</strong> The frame loads only when a reader scrolls near it, so it does not slow the top of your page.</li>' +
      '<li><strong>The paragraph.</strong> A plain link to the tool, in your readers’ system font so it sits quietly in your page.</li>' +
    '</ul></section>\n' +

    '  <section class="panel"><h2>Sizing</h2>\n' +
    '    <div class="table-scroll"><table class="biz-table trust-table"><thead><tr><th>Kind</th><th>Height in the code</th><th>How many</th></tr></thead><tbody>' +
      '<tr><th scope="row">Calculators</th><td>' + facts.heights.calc + ' px</td><td>' + num(n.calc) + '</td></tr>' +
      '<tr><th scope="row">Unit converters</th><td>' + facts.heights.converter + ' px</td><td>' + num(n.converter) + '</td></tr>' +
      (n.currency ? '<tr><th scope="row">The currency converter</th><td>' + facts.heights.currency + ' px</td><td>' + num(n.currency) + '</td></tr>' : '') +
    '</tbody></table></div>\n' +
    '    <ul class="tips">' +
      '<li><strong>The height is fixed, and it is a starting point.</strong> A frame cannot grow to fit what is inside it. The heights above show a tool’s inputs and its main answer; a few carry more underneath — a loan’s payment schedule, for instance — and that part scrolls inside the frame, with the credit at the bottom. A converter’s table of every unit is left out of embeds, so a converter fits its height. To show more without scrolling, raise the height.</li>' +
      '<li><strong>Too much space?</strong> If there is empty space under the credit on your page, lower the height until it goes.</li>' +
      '<li><strong>Narrow columns make it a little taller.</strong> On a phone, or in a sidebar, labels and answers wrap onto more lines. Check your page at phone width before you settle on a height.</li>' +
      '<li><strong>Leave the width at 100%.</strong> The tool is built to fit any width from a phone up, so a fixed pixel width only gets in its way.</li>' +
    '</ul></section>\n' +

    '  <section class="panel"><h2>The one thing we ask: keep the credit</h2>\n' +
    '    <p>Use the code on a blog, a school or club site, or a small business page — that is what it is for. Keep the paragraph under the frame and its link to the tool: restyle it to suit your page if you like, but leave the link in. It is how anybody ever finds this site, and it is the whole of the price.</p>\n' +
    '    <p>Inside the frame there is a “Powered by ' + SITE_NAME + '” line and an “Open the full tool” link. They are part of the tool and stay whatever the code around them says. Please do not present the tool as your own.</p>\n' +
    '  </section>\n' +

    '  <section class="collection-group">\n    <h2>A dozen good ones to start with</h2>\n' +
    '    <p class="group-blurb">Our pick, not a ranking: no analytics run inside an embedded frame, so which tools get embedded most is not something we know.</p>\n' +
    '    <div class="grid embed-picks">' + pickCards + '</div>\n  </section>\n' +

    '  <section class="panel"><h2>Frequently asked questions</h2>' +
      faq.map((f) => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n' +
    '  <section class="panel"><h2>Related</h2><ul class="related">' +
      '<li><a href="/tools/">Every tool on ' + SITE_NAME + ', in one list</a></li>' +
      '<li><a href="/for/teachers/">Free tools for teachers and tutors</a></li>' +
      '<li><a href="/for/students/">Free tools for students and exam candidates</a></li>' +
    '</ul></section>\n' +
    '</article>\n';

  /* WebPage, FAQPage and BreadcrumbList. */
  const ld = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: title, description, url: SITE + pathOnly },
      { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      crumbs.breadcrumbList(trail, LABEL, pathOnly)
    ]
  }) + '</script>\n';

  const script = '<script src="/assets/embed.js" defer></script>\n';
  const html = sidebarFor(headFor(parts, pathOnly, title, description) + script + ld + parts.mid + '\n' + body + parts.tail, rel);
  return { html: footerApply(proof.apply(share.apply(outbound.rewrite(hubs.apply(html, rel), SECTION).html, rel), rel), rel), n, total };
}

/* ---------- wiring ----------------------------------------------------- */

/* The same values build-site.js's READING table gives embed/, so the two
   writers agree. */
function patchSitemap() {
  const rel = 'sitemap-1.xml';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const u = '/' + SECTION + '/';
  if (src.indexOf('<loc>' + SITE + u + '</loc>') >= 0) return 0;
  write(rel, src.replace('</urlset>', '<url><loc>' + SITE + u + '</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n</urlset>'));
  return 1;
}

function main() {
  const facts = shareFacts();
  const index = searchIndex();
  const list = embeddable(facts, index);
  const out = page(shell(), facts, list);
  const built = write(SECTION + '/index.html', out.html);
  const mapped = patchSitemap();

  console.log('\nbuild-embed.js' + (CHECK ? '  (--check: nothing will be written)' : ''));
  console.log('  embeddable          ' + out.total + ' (' + out.n.calc + ' calculators, ' + out.n.converter + ' converters, ' + (out.n.currency || 0) + ' currency)');
  console.log('  heights             ' + Object.keys(facts.heights).map((k) => k + ' ' + facts.heights[k]).join(', ') + ' (from assets/share.js)');
  console.log('  checked             title, canonical, utm_campaign and utm_content agree with every page’s share row');
  console.log('  page                ' + (built ? 'written' : 'unchanged'));
  console.log('  sitemap             ' + (mapped ? '1 added' : 'unchanged'));
  console.log('  service worker      not touched — bump it by hand when this ships');
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
module.exports = { embedCode, shareFacts };
