/*
 * Drives /social/link-in-bio/ in headless Chrome against a local server and
 * checks the page it builds against references written here, not the
 * engine's own code:
 *
 *   - the downloaded file is read as text: one <html> with a lang, a
 *     charset, a viewport, a non-empty <title>, no <script>, no @import,
 *     no url( that is not data:, every <a> with rel="noopener", the hrefs
 *     exactly the https / mailto / tel / wa.me addresses expected, in the
 *     order set, and under 200 KB;
 *   - it is opened in a fresh page served from a made-up address with every
 *     request recorded (zero besides the document), then again with the
 *     browser offline (the photo still decodes, at 256 × 256);
 *   - javascript:, data: and http:// addresses are refused with a reason
 *     and left out; an imported project carrying one is cleaned the same way;
 *   - every theme with every button style is rendered in the preview and
 *     its colours are read back from the iframe's computed styles; the
 *     contrast ratio is worked out here (WCAG 2 formula) and must be ≥ 4.5;
 *   - storage: nothing personal is kept until "Remember this page" is
 *     ticked; ticked, a reload restores it; unticked, it is deleted;
 *   - JSON export and import round-trip; bad files are named in the error;
 *   - 390 px and 1400 px, dark and light, without sideways scroll; every
 *     control reachable by keyboard and labelled.
 *
 *   node build/social/tests/link-in-bio.js [--root <site>] [--port 8892] [--out <dir>]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const ROOT = path.resolve(flag('root', path.join(__dirname, '..', '..', '..')));
const PORT = Number(flag('port', 8892));
const OUT = path.resolve(flag('out', 'E:/tmp/wsoc-social2/link-in-bio'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:' + PORT;
const URL_ = '/social/link-in-bio/';
fs.mkdirSync(OUT, { recursive: true });
let puppeteer;
for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) { try { puppeteer = require(p); break; } catch (e) { /* next */ } }

let passes = 0; const fails = [], outside = [], errors = [];
const check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (ok) passes++; else fails.push(what); return !!ok; };
const section = (s) => console.log('\n' + s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser, server;

async function open(url, opt) {
  opt = opt || {};
  const p = await browser.newPage();
  await p.setViewport({ width: opt.width || 1400, height: opt.height || 1000 });
  /* past the site's service worker, so every request the page makes is seen here */
  await p.setBypassServiceWorker(true);
  await p.setRequestInterception(true);
  p.on('request', (r) => { const u = r.url(); if (/^(data|blob):/.test(u) || u.startsWith(BASE)) return r.continue(); outside.push(url + ' -> ' + u); return r.abort(); });
  p.on('pageerror', (e) => errors.push(url + ': ' + String(e && e.message || e)));
  await p.evaluateOnNewDocument((theme, keep) => {
    try { localStorage.setItem('1234tools-consent', 'denied'); if (theme) localStorage.setItem('1234tools-theme', theme); } catch (e) { /* */ }
    if (!keep) { try { localStorage.removeItem('1234tools-social-link-in-bio-v1'); } catch (e) { /* */ } }
    window.__downloads = [];
    HTMLAnchorElement.prototype.click = function () {
      const a = this;
      if (a.download) window.__downloads.push(fetch(a.href).then((r) => r.blob()).then(async (b) => ({ name: a.download, type: b.type, bytes: Array.from(new Uint8Array(await b.arrayBuffer())) })));
    };
  }, opt.theme || null, !!opt.keep);
  await p.goto(BASE + url, { waitUntil: 'load', timeout: 120000 });
  await p.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  await p.waitForSelector('.sv-lib-frame', { timeout: 30000 });
  await sleep(300);
  return p;
}
const downloads = async (p) => (await p.evaluate(() => Promise.all(window.__downloads))).map((d) => ({ name: d.name, type: d.type, bytes: Buffer.from(d.bytes) }));
const clearDl = (p) => p.evaluate(() => { window.__downloads = []; });
const waitDl = async (p, n) => { await p.waitForFunction((n) => window.__downloads.length >= n, { timeout: 60000 }, n); return downloads(p); };
const press = (p, re) => p.evaluate((src) => { const b = [...document.querySelectorAll('.tool-io button')].find((x) => new RegExp(src).test(x.textContent)); if (!b) throw new Error('no button ' + src); b.click(); }, re.source);
const msg = (p) => p.$eval('.tool-io > .aiimg > .io-msg', (e) => ({ text: e.textContent, cls: e.className }));
const settle = () => sleep(350);
/* type into an input the way a person does: value, then an input event */
const type = (p, sel, v, i) => p.evaluate((sel, v, i) => { const e = document.querySelectorAll(sel)[i || 0]; if (!e) throw new Error('no ' + sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('blur')); }, sel, v, i || 0);
const srcdoc = (p) => p.$eval('.sv-lib-frame', (f) => f.srcdoc);
/* the preview is sandboxed (no scripts, an opaque origin), so it is read through the DevTools protocol, once its current srcdoc has loaded */
async function inFrame(p, fn) {
  const want = await srcdoc(p);
  for (let k = 0; k < 60; k++) {
    const f = await (await p.$('.sv-lib-frame')).contentFrame();
    try {
      const ok = await f.evaluate((len) => document.readyState === 'complete' && !!document.querySelector('h1') && document.documentElement.outerHTML.length > len * 0.5, want.length);
      if (ok) return await f.evaluate(fn);
    } catch (e) { /* navigating */ }
    await sleep(100);
  }
  throw new Error('the preview never loaded');
}

/* ---------- references written here ---------- */
function relLum(rgb) { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
const ratio = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const parseColour = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { rgb: v.slice(0, 3), a: v.length > 3 ? v[3] : 1 }; };
const over = (top, under) => top.rgb.map((c, i) => Math.round(c * top.a + under[i] * (1 - top.a)));

/** The checks on a downloaded page, as text. */
function lintHtml(h) {
  const r = {};
  r.htmlTags = (h.match(/<html[\s>]/gi) || []).length;
  r.doctype = /^<!DOCTYPE html>/i.test(h);
  r.lang = (/<html[^>]*\slang="([^"]+)"/i.exec(h) || [])[1] || '';
  r.charset = /<meta charset="utf-8">/i.test(h);
  r.viewport = /<meta name="viewport" content="width=device-width, initial-scale=1">/i.test(h);
  r.title = (/<title>([^<]*)<\/title>/i.exec(h) || [])[1] || '';
  r.titles = (h.match(/<title>/gi) || []).length;
  r.scripts = (h.match(/<script/gi) || []).length;
  r.imports = /@import|@font-face/i.test(h);
  r.urls = (h.match(/url\(\s*['"]?([^)'"]+)/gi) || []).filter((u) => !/url\(\s*['"]?data:/i.test(u)).length;
  r.srcs = (h.match(/\s(src|srcset|href)="([^"]*)"/gi) || []).map((x) => /"([^"]*)"/.exec(x)[1]);
  r.anchors = [...h.matchAll(/<a\s([^>]*)>/gi)].map((m) => ({ href: ((/href="([^"]*)"/.exec(m[1]) || [])[1] || '').replace(/&amp;/g, '&'), rel: (/rel="([^"]*)"/.exec(m[1]) || [])[1] || '' }));
  r.bytes = Buffer.byteLength(h, 'utf8');
  r.balanced = ['html', 'head', 'body', 'main', 'ul', 'nav', 'style', 'title'].every((t) => (h.match(new RegExp('<' + t + '[\\s>]', 'g')) || []).length === (h.match(new RegExp('</' + t + '>', 'g')) || []).length);
  return r;
}

(async () => {
  if (!puppeteer) throw new Error('puppeteer-core not found');
  const { serve } = require(path.join(ROOT, 'build/tests/serve.js'));
  server = await serve(ROOT, PORT);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'], protocolTimeout: 180000 });
  console.log('link-in-bio: ' + ROOT + ' on ' + BASE);

  /* a photo, drawn here: a 600 × 400 PNG, red on the left half, blue on the right */
  const p0 = await open(URL_);
  const png = Buffer.from(await p0.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#d01010'; x.fillRect(0, 0, 300, 400); x.fillStyle = '#1030d0'; x.fillRect(300, 0, 300, 400); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  const photo = path.join(OUT, 'photo.png'); fs.writeFileSync(photo, png);
  const notImage = path.join(OUT, 'notes.txt'); fs.writeFileSync(notImage, 'hello');

  section('first visit');
  {
    const p = p0;
    const doc = await srcdoc(p);
    check(/Sam Rivera/.test(doc), 'the preview shows the example page');
    const sb = await p.$eval('.sv-lib-frame', (f) => f.getAttribute('sandbox'));
    check(sb !== null && !/allow-scripts/.test(sb), 'the preview iframe is sandboxed without scripts (sandbox="' + sb + '")');
    const stored = await p.evaluate(() => localStorage.getItem('1234tools-social-link-in-bio-v1'));
    check(stored && !/Sam Rivera|example\.com/.test(stored) && /"theme"/.test(stored), 'before anything is ticked, only the look is stored (' + stored + ')');
    const kb = await p.evaluate(() => {
      const io = document.querySelector('.tool-io');
      const ctl = [...io.querySelectorAll('button, input, select, textarea, summary')].filter((e) => e.offsetParent !== null && e.type !== 'file');
      const bad = ctl.filter((e) => e.tabIndex < 0);
      const unl = ctl.filter((e) => /INPUT|SELECT|TEXTAREA/.test(e.tagName) && e.type !== 'checkbox' && !(e.labels && e.labels.length) && !e.getAttribute('aria-label'));
      const iconOnly = [...io.querySelectorAll('.sv-mini')].filter((b) => !b.getAttribute('aria-label'));
      return { n: ctl.length, bad: bad.length, unl: unl.map((e) => e.id || e.className), iconOnly: iconOnly.length };
    });
    check(kb.n > 20 && !kb.bad && !kb.unl.length && !kb.iconOnly, 'all ' + kb.n + ' controls reachable by Tab and labelled' + (kb.unl.length ? ' (unlabelled: ' + kb.unl.join(', ') + ')' : ''));
    /* keyboard: Tab from the name field lands on the bio */
    await p.focus('#lib-name');
    await p.keyboard.press('Tab');
    check(await p.evaluate(() => document.activeElement && document.activeElement.id === 'lib-bio'), 'Tab moves from the name to the bio');
  }

  section('building a page');
  const p = p0;
  await (await p.$('#lib-photo')).uploadFile(photo);
  await p.waitForFunction(() => !document.querySelector('.sv-lib-thumb').hidden, { timeout: 15000 });
  check(/photo\.png: added as a 256 × 256 photo/.test((await msg(p)).text), 'the photo is added and named: ' + (await msg(p)).text);
  await (await p.$('#lib-photo')).uploadFile(notImage);
  await sleep(500);
  const m1 = await msg(p);
  check(/^notes\.txt: not an image/.test(m1.text) && /is-error/.test(m1.cls), 'a text file as the photo is refused by name: ' + m1.text);
  await type(p, '#lib-name', 'Test Person <b>');
  await type(p, '#lib-bio', 'Line one & two\nLine three');
  /* four links: one plain domain, three that must be refused */
  for (let i = 0; i < 2; i++) await press(p, /^\+ Add a link$/);
  await settle();
  const rows = await p.$$eval('.lib-link-url', (l) => l.length);
  check(rows === 5, 'five link rows after adding two to the three in the example (' + rows + ')');
  const L = [['Shop', 'example.com/shop?a=1&b=2'], ['Bad', 'javascript:alert(1)'], ['Old', 'http://example.org/'], ['Data', 'data:text/html,<b>x</b>'], ['Blog', 'https://blog.example.net/posts/']];
  for (let i = 0; i < L.length; i++) { await type(p, '.lib-link-title', L[i][0], i); await type(p, '.lib-link-url', L[i][1], i); }
  await settle();
  const errs = await p.$$eval('.sv-lib-err', (l) => l.map((e) => e.textContent));
  check(/“javascript:” addresses are refused/.test(errs[1]) && /http:\/\/ addresses are refused/.test(errs[2]) && /“data:” addresses are refused/.test(errs[3]) && !errs[0] && !errs[4], 'javascript:, http:// and data: each refused beside the row: ' + JSON.stringify(errs.slice(0, 5)));
  const left = await p.$$eval('.sv-lib-left li', (l) => l.map((e) => e.textContent));
  check(left.length === 3 && /Bad/.test(left[0]), 'three rows listed as left out of the page: ' + JSON.stringify(left));
  const inv = await p.$$eval('.lib-link-url', (l) => l.map((e) => e.getAttribute('aria-invalid')));
  check(inv.join() === 'false,true,true,true,false', 'the refused fields are marked aria-invalid (' + inv.join() + ')');
  /* reorder: Blog up three places, using the row buttons */
  for (let k = 0; k < 4; k++) {
    const at = 4 - k;
    await p.evaluate((at) => document.querySelectorAll('.sv-lib-list')[0].children[at].querySelector('[aria-label^="Move link"][aria-label$="up"]').click(), at);
  }
  await settle();
  const order = await p.$$eval('.lib-link-title', (l) => l.map((e) => e.value));
  check(order.join() === 'Blog,Shop,Bad,Old,Data', 'the up arrows move Blog to the top: ' + order.join());
  const foc = await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'));
  check(/^Move link \d (up|down)$/.test(foc || ''), 'focus follows the moved row to a move button (' + foc + ')');
  /* icons: the example has Instagram and Email; set them and add Phone and WhatsApp */
  await type(p, '.lib-icon-value', 'https://www.instagram.com/test.person', 0);
  await type(p, '.lib-icon-value', 'test@example.com', 1);
  await press(p, /^\+ Add an icon$/); await press(p, /^\+ Add an icon$/);
  await settle();
  await p.evaluate(() => { const s = document.querySelectorAll('.lib-icon-kind'); s[2].value = 'phone'; s[2].dispatchEvent(new Event('change', { bubbles: true })); s[3].value = 'whatsapp'; s[3].dispatchEvent(new Event('change', { bubbles: true })); });
  await type(p, '.lib-icon-value', '+44 20 7946 0000', 2);
  await type(p, '.lib-icon-value', '447700900000', 3);
  await settle();
  /* a bad email is refused too */
  await press(p, /^\+ Add an icon$/); await settle();
  await p.evaluate(() => { const s = document.querySelectorAll('.lib-icon-kind'); s[4].value = 'email'; s[4].dispatchEvent(new Event('change', { bubbles: true })); });
  await type(p, '.lib-icon-value', 'not an email', 4);
  await settle();
  const ierr = await p.$$eval('.sv-lib-iconrow .sv-lib-err', (l) => l.map((e) => e.textContent));
  check(/not an email address/.test(ierr[4]) && !ierr[0] && !ierr[2] && !ierr[3], 'a bad email address is refused beside its row: ' + ierr[4]);

  section('the downloaded file');
  await clearDl(p);
  await press(p, /^Download index\.html$/);
  const [dl] = await waitDl(p, 1);
  const html = dl.bytes.toString('utf8');
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  check(dl.name === 'index.html' && /^text\/html/.test(dl.type), 'saved as index.html, ' + dl.type + ', ' + dl.bytes.length + ' bytes');
  const r = lintHtml(html);
  check(r.doctype && r.htmlTags === 1 && r.titles === 1 && r.title === 'Test Person &lt;b&gt;' && r.lang === 'en' && r.charset && r.viewport && r.balanced,
    'one <html lang="en">, a charset, a viewport, one <title> (' + r.title + '), tags balanced');
  check(r.scripts === 0 && !r.imports && r.urls === 0, 'no <script>, no @import or @font-face, no url() that is not data:');
  const nonData = r.srcs.filter((s) => !/^data:/.test(s) && !/^(https:|mailto:|tel:)/.test(s));
  check(!nonData.length && r.srcs.filter((s) => /^data:image\/jpeg;base64,/.test(s)).length === 1, 'every src and href is data:, https:, mailto: or tel: — the photo a JPEG data URL' + (nonData.length ? ' (others: ' + nonData.join(', ') + ')' : ''));
  const want = ['https://blog.example.net/posts/', 'https://example.com/shop?a=1&b=2', 'https://www.instagram.com/test.person', 'mailto:test@example.com', 'tel:+442079460000', 'https://wa.me/447700900000'];
  check(JSON.stringify(r.anchors.map((a) => a.href)) === JSON.stringify(want), 'the links are exactly ' + want.join(' ') + ' (got ' + r.anchors.map((a) => a.href).join(' ') + ')');
  check(r.anchors.length && r.anchors.every((a) => /\bnoopener\b/.test(a.rel)), 'every <a> has rel="noopener" (' + r.anchors.length + ')');
  check(!/javascript:|data:text|http:\/\//i.test(html), 'no javascript:, data:text or http:// anywhere in the file');
  check(/Test Person &lt;b&gt;/.test(html) && !/<b>/.test(html) && /Line one &amp; two\nLine three/.test(html), 'typed text is escaped, not run as HTML');
  check(r.bytes < 200 * 1024, 'under 200 KB: ' + r.bytes + ' bytes');
  const shown = await p.$eval('.sv-lib-size', (e) => e.dataset.bytes);
  check(Number(shown) === dl.bytes.length, 'the size shown (' + shown + ') is the size saved');

  /* opened in a fresh page at a made-up address: nothing but the document is fetched */
  const q = await browser.newPage();
  const reqs = [];
  await q.setRequestInterception(true);
  q.on('request', (rq) => {
    const u = rq.url();
    if (u === 'https://links.example.test/') return rq.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    if (!/^data:/.test(u)) reqs.push(u);
    rq.abort();
  });
  await q.goto('https://links.example.test/', { waitUntil: 'networkidle0' });
  await sleep(500);
  check(reqs.length === 0, 'opened on its own, the page makes no request at all (' + (reqs.join(', ') || 'none') + ')');
  const look = await q.evaluate(() => ({ h1: document.querySelector('h1').textContent, a: document.querySelectorAll('.links a').length, i: document.querySelectorAll('.icons a').length, img: document.querySelector('.avatar').naturalWidth, labels: [...document.querySelectorAll('.icons a')].map((a) => a.getAttribute('aria-label')) }));
  check(look.h1 === 'Test Person <b>' && look.a === 2 && look.i === 4 && look.img === 256, 'it shows the name, 2 link buttons, 4 icons and the 256 px photo (' + JSON.stringify(look) + ')');
  check(look.labels.join() === 'Instagram,Email,Phone,WhatsApp', 'each icon is labelled with its platform: ' + look.labels.join(', '));
  /* the photo was cut from the middle: the left half red, the right half blue */
  const px = await q.evaluate(async () => { const im = document.querySelector('.avatar'); const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return [Array.from(x.getImageData(40, 128, 1, 1).data), Array.from(x.getImageData(216, 128, 1, 1).data)]; });
  check(px[0][0] > 170 && px[0][2] < 70 && px[1][2] > 170 && px[1][0] < 70, 'the photo is a centred square crop: red left, blue right (' + JSON.stringify(px) + ')');
  await q.close();
  /* and offline */
  const o = await browser.newPage();
  await o.setOfflineMode(true);
  await o.setContent(html, { waitUntil: 'load' });
  const off = await o.evaluate(() => ({ img: document.querySelector('.avatar').complete && document.querySelector('.avatar').naturalWidth, a: document.querySelectorAll('a').length }));
  check(off.img === 256 && off.a === 6, 'with the browser offline it still renders, photo and all (' + JSON.stringify(off) + ')');
  await o.close();

  section('looks: every theme and button style, contrast measured here');
  const themes = await p.$$eval('.sv-lib-theme', (l) => l.map((b) => b.dataset.theme));
  check(themes.length >= 6, themes.length + ' themes offered: ' + themes.join(', '));
  const styles = await p.$$eval('#lib-button option', (l) => l.map((o) => o.value));
  let worst = { r: 99 }, combos = 0, low = [];
  const seen = new Set();
  for (const th of themes) {
    await p.evaluate((t) => document.querySelector('.sv-lib-theme[data-theme="' + t + '"]').click(), th);
    for (const st of styles) {
      await p.evaluate((s) => { const e = document.getElementById('lib-button'); e.value = s; e.dispatchEvent(new Event('change', { bubbles: true })); }, st);
      await settle();
      const c = await inFrame(p, () => {
        const d = document, w = window;
        const body = w.getComputedStyle(d.body), a = w.getComputedStyle(d.querySelector('.links a'));
        return { bodyBg: body.backgroundColor, bodyImg: body.backgroundImage, htmlBg: w.getComputedStyle(d.documentElement).backgroundColor, h1: w.getComputedStyle(d.querySelector('h1')).color, bio: w.getComputedStyle(d.querySelector('.bio')).color, aCol: a.color, aBg: a.backgroundColor, icon: w.getComputedStyle(d.querySelector('.icons a')).color };
      });
      const grads = (c.bodyImg.match(/rgba?\([^)]+\)/g) || []).map((s) => parseColour(s).rgb);
      const bgs = grads.length ? grads : [parseColour(c.bodyBg).rgb];
      seen.add(JSON.stringify(bgs));
      for (const bg of bgs) {
        const ab = parseColour(c.aBg);
        const btnBg = ab.a === 0 ? bg : over(ab, bg);
        for (const [what, fg, back] of [['name', parseColour(c.h1).rgb, bg], ['bio', parseColour(c.bio).rgb, bg], ['icon', parseColour(c.icon).rgb, bg], ['button', parseColour(c.aCol).rgb, btnBg]]) {
          const rr = ratio(fg, back); combos++;
          if (rr < worst.r) worst = { r: rr, th, st, what };
          if (rr < 4.5) low.push(th + '/' + st + ' ' + what + ' ' + rr.toFixed(2));
        }
      }
    }
  }
  check(!low.length, combos + ' text-and-background pairs over ' + themes.length + ' themes × ' + styles.length + ' button styles all ≥ 4.5:1; lowest ' + worst.r.toFixed(2) + ':1 (' + worst.th + ', ' + worst.st + ', ' + worst.what + ')' + (low.length ? ' LOW: ' + low.join('; ') : ''));
  check(seen.size >= 6, seen.size + ' different page backgrounds');
  const fonts = await p.$$eval('#lib-font option', (l) => l.map((o) => o.value));
  const fam = [];
  for (const f of fonts) { await p.evaluate((v) => { const e = document.getElementById('lib-font'); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, f); await settle(); fam.push(await inFrame(p, () => getComputedStyle(document.body).fontFamily)); }
  check(new Set(fam).size === fonts.length && fam.every((x) => /(sans-serif|serif|monospace)$/.test(x)), fonts.length + ' fonts, each a system stack ending in a generic family');

  section('storage');
  const before = await p.evaluate(() => localStorage.getItem('1234tools-social-link-in-bio-v1'));
  check(!/Test Person|example\.net/.test(before), 'with "Remember" unticked, nothing typed is stored');
  await p.click('#lib-keep'); await settle();
  const after = JSON.parse(await p.evaluate(() => localStorage.getItem('1234tools-social-link-in-bio-v1')));
  check(after.v === 1 && after.project && after.project.profile.name === 'Test Person <b>' && /^data:image\/jpeg/.test(after.project.profile.photo), 'ticked, the page is kept under one versioned key (v ' + after.v + ')');
  const p2 = await open(URL_, { keep: true });
  const restored = await p2.evaluate(() => ({ name: document.getElementById('lib-name').value, links: [...document.querySelectorAll('.lib-link-title')].map((e) => e.value).join(), keep: document.getElementById('lib-keep').checked, msg: document.querySelector('.tool-io .io-msg').textContent }));
  check(restored.name === 'Test Person <b>' && restored.links === 'Blog,Shop,Bad,Old,Data' && restored.keep && /Restored/.test(restored.msg), 'a reload restores it: ' + JSON.stringify(restored));
  await p2.click('#lib-keep'); await settle();
  const gone = await p2.evaluate(() => localStorage.getItem('1234tools-social-link-in-bio-v1'));
  check(!/Test Person/.test(gone) && /"look"/.test(gone), 'unticked, it is deleted and only the look stays');
  await p2.close();

  section('export and import');
  await clearDl(p);
  await press(p, /^Export the project/);
  const [js] = await waitDl(p, 1);
  const proj = JSON.parse(js.bytes.toString('utf8'));
  check(js.name === 'link-in-bio-project.json' && js.type === 'application/json' && proj.app === '1234tools-link-in-bio' && proj.v === 1 && proj.links.length === 5 && proj.icons.length === 5, 'exported as link-in-bio-project.json: 5 links, 5 icons, version 1');
  /* a project file someone tampered with: a javascript: link and a script in the name */
  const evil = Object.assign({}, proj, { profile: Object.assign({}, proj.profile, { name: '<script>alert(1)</script>', photo: 'data:text/html;base64,PHNjcmlwdD4=' }), links: [{ title: 'Ok', url: 'https://ok.example.com/' }, { title: 'Evil', url: 'javascript:alert(document.cookie)' }] });
  const evilF = path.join(OUT, 'tampered.json'); fs.writeFileSync(evilF, JSON.stringify(evil));
  await (await p.$('#lib-import')).uploadFile(evilF);
  await sleep(600);
  const mi = await msg(p);
  check(/^tampered\.json: imported 1 link and 4 icons\./.test(mi.text) && /Evil \(“javascript:” addresses are refused/.test(mi.text), 'an imported javascript: link is refused and named: ' + mi.text.slice(0, 160));
  await clearDl(p);
  await press(p, /^Download index\.html$/);
  const [dl2] = await waitDl(p, 1);
  const h2 = dl2.bytes.toString('utf8');
  check(!/javascript:|<script|data:text/i.test(h2) && /&lt;script&gt;alert\(1\)&lt;\/script&gt;/.test(h2) && !/class="avatar"/.test(h2), 'its page carries no javascript:, no script and not the fake photo; the name is escaped');
  const junk = path.join(OUT, 'junk.json'); fs.writeFileSync(junk, '{ not json');
  await (await p.$('#lib-import')).uploadFile(junk); await sleep(400);
  const mj = await msg(p);
  check(/^junk\.json: not a JSON file/.test(mj.text) && /is-error/.test(mj.cls), 'a broken file is refused by name: ' + mj.text);
  const other = path.join(OUT, 'other.json'); fs.writeFileSync(other, JSON.stringify({ hello: 1 }));
  await (await p.$('#lib-import')).uploadFile(other); await sleep(400);
  check(/^other\.json: not a project file from this tool/.test((await msg(p)).text), 'a JSON file from elsewhere is refused by name');

  section('sizes');
  {
    const s = await browser.newPage();
    await s.goto(BASE + URL_, { waitUntil: 'load' });
    await s.evaluate(() => localStorage.removeItem('1234tools-social-link-in-bio-v1'));
    await s.close();
    const e = await open(URL_);
    const noPhoto = Number(await e.$eval('.sv-lib-size', (x) => x.dataset.bytes));
    const sizes = {};
    for (const s of ['portrait.jpg', 'group.jpg', 'pet.jpg']) {
      await (await e.$('#lib-photo')).uploadFile(path.join(ROOT, 'build/promo/samples', s));
      await e.waitForFunction((n) => new RegExp('^' + n.replace('.', '\.') + ': added').test(document.querySelector('.tool-io .io-msg').textContent), { timeout: 15000 }, s);
      await sleep(400);
      sizes[s] = Number(await e.$eval('.sv-lib-size', (x) => x.dataset.bytes));
    }
    console.log('    the example page: ' + noPhoto + ' bytes without a photo; with the sample photos ' + JSON.stringify(sizes));
    const vals = Object.values(sizes);
    check(noPhoto > 2000 && vals.every((v) => v > noPhoto && v < 60 * 1024), 'the example is ' + noPhoto + ' bytes; with a real photo ' + Math.min(...vals) + ' to ' + Math.max(...vals) + ' bytes, all under 60 KB');
    await e.close();
  }

  section('layout');
  for (const [w, theme] of [[390, 'dark'], [1400, 'dark'], [390, 'light'], [1400, 'light']]) {
    const l = await open(URL_, { width: w, height: 900, theme });
    await l.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await sleep(400);
    const m = await l.evaluate(() => {
      const io = document.querySelector('.tool-io');
      const wide = [...io.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1); }).slice(0, 3).map((e) => e.tagName + '.' + e.className);
      return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, wide, frameH: document.querySelector('.sv-lib-frame').getBoundingClientRect().height };
    });
    check(m.sw <= m.iw && !m.wide.length && m.frameH >= 500, w + ' px, ' + theme + ': no sideways scroll (' + m.sw + ' of ' + m.iw + (m.wide.length ? '; too wide: ' + m.wide.join(', ') : '') + '), preview ' + Math.round(m.frameH) + ' px tall');
    await l.screenshot({ path: path.join(OUT, 'layout-' + w + '-' + theme + '.png') });
    await l.close();
  }
  /* no layout shift: the preview keeps its height whatever is typed */
  {
    const l = await open(URL_);
    const h0 = await l.$eval('.sv-lib-frame', (f) => f.getBoundingClientRect().height);
    await type(l, '#lib-bio', 'A much longer bio '.repeat(12)); await settle();
    const h1 = await l.$eval('.sv-lib-frame', (f) => f.getBoundingClientRect().height);
    check(h0 === h1, 'the preview does not change size as the bio grows (' + h0 + ' → ' + h1 + ')');
    await l.close();
  }

  await browser.close(); if (server) server.close();
  section('requests outside 127.0.0.1: ' + (outside.length ? outside.join(' | ') : 'none'));
  if (errors.length) console.log('page errors: ' + errors.join(' | '));
  check(!outside.length, 'no request left 127.0.0.1');
  check(!errors.length, 'no page error');
  console.log('\nlink-in-bio: ' + passes + ' passed, ' + fails.length + ' failed');
  fails.forEach((f) => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
})().catch(async (e) => { console.error(e); try { await browser.close(); } catch (x) { /* */ } if (server) server.close(); process.exit(2); });
