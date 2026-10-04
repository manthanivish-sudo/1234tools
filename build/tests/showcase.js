/* The showcase, in a real browser: /showcase/ and its cards, the "Made with
   this tool" panel on a tool page and its absence on one nobody has used,
   and the form — inline errors with nothing sent, a good submission posted
   in the callable's shape with a stubbed fetch, the server's own words shown
   when it refuses, and ?tool= picking the tool. Through all of it, nothing
   but 127.0.0.1 is contacted.

   node build/tests/showcase.js [--port 8791] [--root <site>] [--out <dir>]
   --root defaults to the site this file sits in and is served on --port by
   build/tests/serve.js (a server already on that port is used instead). It
   expects a build/showcase.json with entries for /ai-video/auto-captions/
   (two) and /pdf/merge-pdf/ (one), and none for /pdf/split-pdf/: seed a
   private export with `node build/showcase.js add …` and run
   build-showcase.js there first. --out defaults to a folder in the OS temp
   dir, for screenshots. */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { serve } = require('./serve.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', 8791));
const ROOT = path.resolve(arg('root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), '1234tools-showcase')));
const ORIGIN = 'http://127.0.0.1:' + PORT;
fs.mkdirSync(OUT, { recursive: true });
function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), path.join(__dirname, '..', '..', 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found; npm install puppeteer-core');
}
const puppeteer = loadPuppeteer();

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) pass++; else fail++; console.log((cond ? '  ok   ' : '  FAIL ') + msg + (cond || extra === undefined ? '' : '  -> ' + JSON.stringify(extra).slice(0, 300))); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/showcase.json'), 'utf8'));
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 950 });
  const errors = [], foreign = [], posts = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('request', (r) => {
    const u = r.url();
    if (r.method() === 'POST') posts.push(u);
    if (!/^(data|blob|about):/.test(u) && u.indexOf(ORIGIN) !== 0) foreign.push(u);
  });
  const go = async (p) => { await page.goto(ORIGIN + p, { waitUntil: 'networkidle0', timeout: 60000 }); await page.evaluate(() => { const cc = document.querySelector('.cc'); if (cc) cc.remove(); }); };

  try {
    /* ---------------- /showcase/ ---------------- */
    console.log('\n/showcase/');
    await go('/showcase/');
    const s = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('main .showcase-card')];
      return {
        h1: (document.querySelector('main h1') || {}).textContent,
        eyebrow: (document.querySelector('main .eyebrow') || {}).textContent,
        crumb: [...document.querySelectorAll('nav.crumbs li')].map((li) => li.textContent).join(' > '),
        cards: cards.map((c) => {
          const a = c.querySelector('a.showcase-out');
          return {
            name: (c.querySelector('.showcase-name') || {}).textContent,
            platform: (c.querySelector('.showcase-platform') || {}).textContent,
            tool: (c.querySelector('.showcase-tool a') || {}).getAttribute ? c.querySelector('.showcase-tool a').getAttribute('href') : null,
            href: a && a.getAttribute('href'), rel: a && a.getAttribute('rel'), target: a && a.getAttribute('target'), text: a && a.textContent
          };
        }),
        media: document.querySelectorAll('main img, main iframe, main video, main embed, main object').length,
        scripts: [...document.querySelectorAll('script[src]')].map((x) => x.getAttribute('src')),
        empty: !!document.querySelector('.showcase-empty'),
        form: !!document.querySelector('#sc-form'),
        endpoint: (document.querySelector('#sc-form') || { getAttribute: () => '' }).getAttribute('data-endpoint'),
        trap: !!document.querySelector('#sc-form input[name="trap"]'),
        how: !!document.querySelector('#how') && /contact/.test(document.querySelector('#how').innerHTML),
        faqs: document.querySelectorAll('main details').length,
        ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((x) => { try { return JSON.parse(x.textContent); } catch (e) { return null; } })
      };
    });
    await page.screenshot({ path: path.join(OUT, 'showcase.png'), fullPage: true });
    ok(s.h1 === 'Made with 1234Tools' && s.eyebrow === 'Showcase', 'eyebrow "Showcase", h1 "Made with 1234Tools"', [s.eyebrow, s.h1]);
    ok(s.crumb === 'Home > Showcase', 'breadcrumb Home > Showcase', s.crumb);
    ok(s.cards.length === data.entries.length && s.cards.length === 3, data.entries.length + ' entries in the file, ' + s.cards.length + ' cards on the page');
    ok(s.cards.every((c) => /\bugc\b/.test(c.rel) && /\bnoopener\b/.test(c.rel) && c.target === '_blank'), 'every outbound link is rel="noopener ugc" target="_blank"', s.cards.map((c) => c.rel));
    ok(s.cards.every((c) => /utm_source=1234tools\.com/.test(c.href) && /utm_campaign=showcase/.test(c.href)), 'and carries the site UTM tags', s.cards.map((c) => c.href));
    ok(s.cards.every((c) => /^See it on (Instagram|YouTube) ↗/.test(c.text.trim())), '"See it on Instagram ↗" / "See it on YouTube ↗"', s.cards.map((c) => c.text));
    ok(s.cards[0] && s.cards[0].name === 'Test Creator' && /Featured/.test(s.cards[0].platform), 'the featured entry comes first', s.cards[0]);
    ok(s.cards.every((c) => c.tool && /^\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(c.tool)), '"Made with" links to the tool', s.cards.map((c) => c.tool));
    ok(s.media === 0, 'no image, iframe, video or embed in the page body', s.media);
    ok(!s.empty, 'no empty-state paragraph when there are entries');
    ok(s.form && s.trap && /\/submitShowcase$/.test(s.endpoint), 'the form is there, with a honeypot named trap, posting to submitShowcase', s.endpoint);
    ok(s.scripts.indexOf('/assets/showcase.js') >= 0, 'assets/showcase.js is loaded', s.scripts);
    ok(s.how, 'the "how it works" panel says how to be removed (contact page)');
    const graph = (s.ld[0] && s.ld[0]['@graph']) || [];
    const types = graph.map((x) => x['@type']);
    const faq = graph.find((x) => x['@type'] === 'FAQPage');
    const coll = graph.find((x) => x['@type'] === 'CollectionPage');
    ok(types.indexOf('CollectionPage') >= 0 && types.indexOf('BreadcrumbList') >= 0 && faq && faq.mainEntity.length >= 4 && s.faqs === faq.mainEntity.length,
      'JSON-LD: CollectionPage, BreadcrumbList, FAQPage with ' + (faq ? faq.mainEntity.length : 0) + ' questions matching the page', types);
    ok(coll && coll.mainEntity.numberOfItems === 3, 'the CollectionPage lists the three entries');

    /* ---------------- the form: refused without consent ---------------- */
    console.log('\nthe form');
    const fill = async (values) => {
      await page.evaluate((v) => {
        const set = (id, val) => { const el = document.getElementById(id); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
        set('sc-name', v.name); set('sc-handle', v.handle); set('sc-platform', v.platform); set('sc-url', v.url);
        set('sc-tool', v.tool); set('sc-note', v.note); set('sc-email', v.email);
        const c = document.getElementById('sc-consent'); if (c.checked !== v.consent) c.click();
      }, values);
    };
    const submit = () => page.evaluate(() => document.getElementById('sc-send').click());
    const good = { name: 'Browser Test', handle: '@browsertest', platform: 'instagram', url: 'https://www.instagram.com/p/BROWSER1/', tool: '/pdf/merge-pdf/', note: 'A test.', email: '', consent: true };
    posts.length = 0;
    await fill(Object.assign({}, good, { consent: false }));
    await submit();
    await wait(300);
    let st = await page.evaluate(() => ({
      err: document.getElementById('sc-consent-err').textContent, hidden: document.getElementById('sc-consent-err').hidden,
      msg: document.getElementById('sc-msg').textContent, cls: document.getElementById('sc-msg').className
    }));
    ok(!st.hidden && /Tick the box/.test(st.err), 'no consent: the inline error says to tick the box', st);
    ok(/is-error/.test(st.cls), 'and the message line is an error', st.cls);
    ok(posts.length === 0, 'and nothing was sent', posts);

    await fill(Object.assign({}, good, { url: 'https://www.youtube.com/watch?v=WRONG' }));
    await submit();
    await wait(200);
    st = await page.evaluate(() => ({ err: document.getElementById('sc-url-err').textContent, inv: document.getElementById('sc-url').getAttribute('aria-invalid') }));
    ok(/not on Instagram/.test(st.err) && st.inv === 'true', 'a YouTube link filed under Instagram is marked on the link field', st);
    ok(posts.length === 0, 'still nothing sent', posts);

    /* ---------------- a good one, with fetch stubbed ---------------- */
    await go('/showcase/');
    const loadedAt = Date.now();
    await page.evaluate(() => {
      window.__posts = [];
      window.fetch = function (u, o) {
        window.__posts.push({ url: String(u), method: o && o.method, body: o && o.body, type: o && o.headers && o.headers['content-type'] });
        return Promise.resolve(new Response(JSON.stringify({ result: { ok: true, id: 'stubbed' } }), { status: 200, headers: { 'content-type': 'application/json' } }));
      };
    });
    await fill(good);
    const left = 2600 - (Date.now() - loadedAt);
    if (left > 0) await wait(left);
    await submit();
    await wait(400);
    const sent = await page.evaluate(() => ({ posts: window.__posts, msg: document.getElementById('sc-msg').textContent, cls: document.getElementById('sc-msg').className, name: document.getElementById('sc-name').value }));
    const p0 = sent.posts[0] || {};
    let body = {}; try { body = JSON.parse(p0.body); } catch (e) { /* below */ }
    const d = body.data || {};
    ok(sent.posts.length === 1 && p0.method === 'POST' && /\/submitShowcase$/.test(p0.url) && p0.type === 'application/json', 'one POST, JSON, to submitShowcase', sent.posts);
    ok(Object.keys(body).length === 1 && body.data && typeof body.data === 'object', 'in the callable shape {"data":{…}}', Object.keys(body));
    ok(d.consent === true && d.trap === '' && typeof d.tookMs === 'number' && d.tookMs >= 2500, 'consent true, trap empty, tookMs ' + d.tookMs + ' (>= 2500)', d);
    ok(d.name === 'Browser Test' && d.handle === 'browsertest' && d.platform === 'instagram' && d.url === 'https://www.instagram.com/p/BROWSER1/' && d.tool === '/pdf/merge-pdf/' && d.note === 'A test.' && d.email === null,
      'the fields arrive cleaned: handle without @, empty email as null', d);
    ok(/Thank you/.test(sent.msg) && !/is-error/.test(sent.cls) && sent.name === '', 'the success message shows and the form is cleared', sent);

    /* ---------------- the server says no ---------------- */
    await go('/showcase/');
    await page.evaluate(() => {
      window.fetch = function () {
        return Promise.resolve(new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'That is 5 in an hour from this connection. Send the rest later, or use the contact page.' } }), { status: 429, headers: { 'content-type': 'application/json' } }));
      };
    });
    await fill(good);
    await wait(100);
    await submit();
    await wait(400);
    st = await page.evaluate(() => ({ msg: document.getElementById('sc-msg').textContent, cls: document.getElementById('sc-msg').className, btn: document.getElementById('sc-send').disabled }));
    ok(/5 in an hour/.test(st.msg) && /is-error/.test(st.cls) && !st.btn, 'a refusal from the server is shown in its own words, and the button comes back', st);

    /* ---------------- ?tool= ---------------- */
    await go('/showcase/?tool=/pdf/merge-pdf/');
    const pre = await page.evaluate(() => document.getElementById('sc-tool').value);
    ok(pre === '/pdf/merge-pdf/', '?tool=/pdf/merge-pdf/ preselects the tool', pre);

    /* ---------------- tool pages ---------------- */
    console.log('\ntool pages');
    await go('/ai-video/auto-captions/');
    const t = await page.evaluate(() => {
      const panel = document.querySelector('main .showcase-made');
      const next = panel && panel.nextElementSibling;
      return {
        has: !!panel, h2: panel && panel.querySelector('h2').textContent,
        items: panel ? panel.querySelectorAll('.showcase-list li').length : 0,
        next: next && next.querySelector('h2') && next.querySelector('h2').textContent,
        inArticle: !!(panel && panel.closest('article')),
        rels: panel ? [...panel.querySelectorAll('a.showcase-out')].map((a) => a.getAttribute('rel') + ' ' + a.getAttribute('target') + ' ' + /utm_source=1234tools/.test(a.href)) : [],
        all: panel && panel.querySelector('.showcase-more a').getAttribute('href'),
        send: panel && panel.querySelectorAll('.showcase-more a')[1].getAttribute('href')
      };
    });
    await page.screenshot({ path: path.join(OUT, 'tool-panel.png'), fullPage: true });
    ok(t.has && t.h2 === 'Made with this tool' && t.inArticle, '/ai-video/auto-captions/ has the "Made with this tool" panel in its article', t);
    ok(t.next === 'Frequently asked questions', 'immediately before the FAQ panel', t.next);
    ok(t.items === 2, 'listing its two entries', t.items);
    ok(t.rels.length === 2 && t.rels.every((x) => /ugc/.test(x) && /_blank/.test(x) && / true$/.test(x)), 'their links are ugc, open in a new tab and carry the UTM tags', t.rels);
    ok(t.all === '/showcase/' && t.send === '/showcase/?tool=/ai-video/auto-captions/#submit', '"See all" and a send-yours link that preselects this tool', [t.all, t.send]);

    await go('/pdf/merge-pdf/');
    const m = await page.evaluate(() => {
      const panel = document.querySelector('main .showcase-made');
      const next = panel && panel.nextElementSibling && panel.nextElementSibling.querySelector('h2');
      return { n: panel ? panel.querySelectorAll('.showcase-list li').length : 0, next: next && next.textContent };
    });
    ok(m.n === 1 && m.next === 'Frequently asked questions', '/pdf/merge-pdf/ lists its one entry, before its FAQ', m);

    const raw = fs.readFileSync(path.join(ROOT, 'pdf/split-pdf/index.html'), 'utf8');
    await go('/pdf/split-pdf/');
    const none = await page.evaluate(() => document.querySelectorAll('.showcase-made').length);
    ok(raw.indexOf('<!-- SHOWCASE') < 0 && none === 0, '/pdf/split-pdf/, which nobody has used, has no SHOWCASE marker and no panel', { marker: raw.indexOf('<!-- SHOWCASE'), panels: none });

    ok(foreign.length === 0, 'no request left 127.0.0.1' + (foreign.length ? ': ' + [...new Set(foreign)].slice(0, 5).join(', ') : ''));
    ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    fail++;
    console.log('  FAIL driver: ' + (e && e.stack || e));
  } finally {
    await browser.close();
    if (server) server.close();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (fail ? '' : '\nALL PASS') + '\nscreenshots in ' + OUT);
  process.exit(fail ? 1 : 0);
})();
