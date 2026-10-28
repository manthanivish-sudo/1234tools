/**
 * The live tools under /live/ and the phone page /join/, end to end, in a
 * real browser against a real relay.
 *
 *   node build/tests/live-rooms.js [--root <site>] [--port 9010]
 *        [--relay-port 8931] [--relay-dir E:/projects/1234tools-relay]
 *        [--phones 30] [--only <slug>] [--skip-flows]
 *
 * Starts the relay's local dev server exactly as its test/devserver.js does
 * (wrangler dev on 127.0.0.1:<relay-port>, inspector 8939, CREATE_PER_MIN
 * 1000, a local PLAN_SECRET, FREE_CAP 100: the code's default, which the
 * full-room test fills; production may raise it) unless one already answers /health there, and
 * stops only the process it started (by PID). Serves the site with
 * build/tests/serve.js.
 *
 * Static: every live page, landing page and the hub exists, is in the
 * sitemap with /join/, carries the "Live" badge and the approved privacy
 * text word for word, names no competitor, has its PWA manifest and icon;
 * the footer note is the live one, not "nothing is sent to a server".
 * Browser: every page at 390 and 1280 px mounts, never scrolls sideways,
 * and has no control under 44 px; /join/ loads nothing from another origin,
 * no analytics, and transfers under 40 KB before room-client.js; the host
 * page contacts the relay only after "Start a live session".
 * Live: one host page and N phone pages (fresh incognito contexts each), per
 * tool, run by build/tests/live/<slug>.js — answers reach the host and are
 * counted right, phones never receive another phone's answer (every frame a
 * phone receives is recorded and inspected), a dropped socket rejoins with
 * one vote, 70 extra sockets fill the room to 100 and the 101st phone is
 * told it is full, and ending the session closes every phone.
 * Pages outside /live/ that use the relay have a file there with
 * `extra: true` (build/tests/live/quiz-phones.js: the quiz games' phones),
 * run after the live tools, or alone with --only <its name>.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ROOT = path.resolve(opt('--root', path.join(__dirname, '..', '..')));
const PORT = Number(opt('--port', 9010));
const RELAY_PORT = Number(opt('--relay-port', 8931));
const RELAY_DIR = opt('--relay-dir', 'E:/projects/1234tools-relay');
const PHONES = Number(opt('--phones', 30));
const ONLY = opt('--only', null);
const SKIP_FLOWS = args.includes('--skip-flows');
const FLOWS_ONLY = args.includes('--flows-only');
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PRIVACY = 'Answers pass through our server only to reach the presenter\u2019s screen. They are held in memory for the room\u2019s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
const BADGE = 'Live — answers pass through our server';
/* the approved words, compared with straight and curly apostrophes treated alike */
const plain = (t) => String(t).replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
const hasPrivacy = (t) => plain(t).indexOf(plain(PRIVACY)) >= 0;
const COMPETITORS = /mentimeter|menti\.com|slido|sli\.do|kahoot|poll ?everywhere|ahaslides|wooclap|vevox|beekast|pigeonhole/i;

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (process.env.LIVE_TRACE) console.log((cond ? '  ok   ' : '  FAIL ') + name);
  if (cond) { pass++; return true; }
  fail++; failures.push(name + (detail !== undefined && detail !== '' ? ' — ' + detail : ''));
  return false;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms, every) {
  const t0 = Date.now();
  for (;;) {
    let v;
    try { v = await fn(); } catch (e) { v = false; }
    if (v) return v;
    if (Date.now() - t0 > (ms || 10000)) return false;
    await sleep(every || 100);
  }
}
function req(name) {
  for (const p of [path.join(ROOT, 'node_modules', name), path.join(__dirname, '..', '..', 'node_modules', name), path.join(RELAY_DIR, 'node_modules', name), name]) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error(name + ' not found');
}

/* ---------- the relay, as its own test/devserver.js starts it ---------- */

async function healthy(endpoint) {
  try { const r = await fetch(endpoint + '/health'); return r.ok && (await r.text()) === 'ok'; } catch (e) { return false; }
}
async function startRelay() {
  const endpoint = 'http://127.0.0.1:' + RELAY_PORT;
  if (await healthy(endpoint)) return { endpoint, stop: () => {}, pid: null };
  const child = spawn(process.execPath, [path.join(RELAY_DIR, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--port', String(RELAY_PORT), '--ip', '127.0.0.1', '--inspector-port', '8939', '--var', 'CREATE_PER_MIN:1000', '--var', 'PLAN_SECRET:local-dev-secret', '--var', 'FREE_CAP:100'], {
    cwd: RELAY_DIR, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' })
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const t0 = Date.now();
  while (!(await healthy(endpoint))) {
    if (Date.now() - t0 > 90000 || child.exitCode !== null) throw new Error('wrangler dev did not start:\n' + log.slice(-2000));
    await sleep(300);
  }
  const stop = () => {
    try {
      if (process.platform === 'win32') execSync('taskkill /pid ' + child.pid + ' /T /F', { stdio: 'ignore' });
      else child.kill('SIGTERM');
    } catch (e) { /* already gone */ }
  };
  return { endpoint, stop, pid: child.pid };
}

/* Every frame a phone receives, recorded before the page's own code runs. */
const RECORD = '(() => { const R = window.WebSocket; window.__rx = []; window.__ws = [];' +
  ' function W(u, p) { const w = p === undefined ? new R(u) : new R(u, p); window.__ws.push(w);' +
  ' w.addEventListener("message", (e) => { window.__rx.push(String(e.data)); }); return w; }' +
  ' W.prototype = R.prototype; W.CONNECTING = 0; W.OPEN = 1; W.CLOSING = 2; W.CLOSED = 3; window.WebSocket = W; })();';

async function main() {
  const live = require(path.join(ROOT, 'build-live.js'));
  const list = live.tools().filter((t) => !ONLY || t.slug === ONLY);
  const lands = [];
  for (const t of list) for (const L of t.spec.landings || []) lands.push({ t, L });
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  /* ---------- static ---------- */
  const sitemap = read('sitemap-1.xml');
  const inMap = (p) => sitemap.indexOf('<loc>https://www.1234tools.com' + p + '</loc>') >= 0;
  ok(inMap('/live/'), 'sitemap: the hub');
  ok(inMap('/join/'), 'sitemap: /join/');
  const pages = [{ url: '/live/', rel: 'live/index.html', kind: 'hub' }]
    .concat(list.map((t) => ({ url: '/live/' + t.slug + '/', rel: 'live/' + t.slug + '/index.html', kind: 'tool', t })))
    .concat(lands.map((x) => ({ url: '/live/' + x.L.slug + '/', rel: 'live/' + x.L.slug + '/index.html', kind: 'landing', t: x.t, L: x.L })));
  for (const p of pages) {
    ok(inMap(p.url), 'sitemap: ' + p.url);
    if (!ok(fs.existsSync(path.join(ROOT, p.rel)), 'page exists: ' + p.url)) continue;
    const html = read(p.rel);
    const text = html.replace(/&amp;/g, '&');
    ok(text.indexOf(BADGE) >= 0, p.url + ': the Live badge');
    ok(hasPrivacy(text), p.url + ': the approved privacy text, word for word');
    ok(!COMPETITORS.test(html), p.url + ': names no competitor', (COMPETITORS.exec(html) || [])[0]);
    ok(/<!--foot:live-->/.test(html), p.url + ': footer note is the live one');
    ok(html.indexOf('no figures are sent to a server') < 0, p.url + ': no untrue "no figures are sent to a server" note');
  }
  for (const t of list) {
    ok(fs.existsSync(path.join(ROOT, 'pwa', 'live', t.slug + '.webmanifest')), 'PWA manifest: ' + t.slug);
    ok(fs.existsSync(path.join(ROOT, 'assets', 'pwa', t.spec.glyph + '-192.png')), 'PWA icon drawn: ' + t.spec.glyph);
    const m = t.spec.manual || {};
    ok(['setup', 'play', 'tv', 'troubleshooting'].every((k) => Array.isArray(m[k]) && m[k].length >= 3 && m[k].length <= 6), t.slug + ': spec.manual has setup, play, tv, troubleshooting (3-6 each)');
    ok((t.spec.how || []).length >= 5 && t.spec.how.some((s) => /1234tools\.com\/join/.test(s)) && t.spec.how.some((s) => /End session/.test(s)) && t.spec.how.some((s) => /Export CSV/.test(s)), t.slug + ': how covers join, export and end');
    ok(!COMPETITORS.test(fs.readFileSync(path.join(ROOT, 'engine', 'room-' + t.slug + '.js'), 'utf8')), t.slug + ': engine names no competitor');
  }
  const join = read('join/index.html');
  ok(hasPrivacy(join), '/join/: the approved privacy text, word for word');
  ok(/<meta name="mvr-shell" content="lean">/.test(join), '/join/: marked lean (build-site.js leaves it alone)');
  ok(!/analytics\.js|clarity\.ms|googletagmanager|gtag\(|fonts\.googleapis|fonts\.gstatic/i.test(join), '/join/: no analytics, tag manager or web fonts in the page');
  ok(!COMPETITORS.test(join + read('engine/room-join.js') + read('engine/room-join-hi.js')), '/join/: names no competitor');
  const relayClient = fs.existsSync(path.join(RELAY_DIR, 'client/room-client.js')) ? fs.readFileSync(path.join(RELAY_DIR, 'client/room-client.js'), 'utf8').replace(/\r/g, '') : null;
  if (relayClient) ok(read('engine/room-client.js').split('\n').slice(1).join('\n') === relayClient, 'engine/room-client.js is the relay client verbatim (after its one header line)');

  /* ---------- the browser ---------- */
  const puppeteer = req('puppeteer-core');
  const { serve } = require('./serve.js');
  const server = await serve(ROOT, PORT);
  let relay = null;
  if (!SKIP_FLOWS) relay = await startRelay();
  const EP = relay ? relay.endpoint : 'http://127.0.0.1:' + RELAY_PORT;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required',
    /* every phone page stands for a separate phone in someone's hand: none of them is a background tab */
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling'], protocolTimeout: 120000 });
  const errors = [];
  async function open(url, width, ctx) {
    const page = await (ctx || browser).newPage();
    const w = width || 1280;
    await page.setViewport({ width: w, height: w < 600 ? 844 : 800, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 });
    page.on('pageerror', (e) => errors.push(url + ': ' + e.message));
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.goto(BASE + url, { waitUntil: 'load' });
    await page.evaluate(() => { const b = document.querySelector('.cc .cc-no, .cc button'); if (b) b.click(); });
    return page;
  }
  async function layout(page, label, scope) {
    const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    ok(sideways <= 1, label + ': no sideways scroll', sideways + ' px');
    const small = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel + ' button, ' + sel + ' input, ' + sel + ' select, ' + sel + ' summary'))
      .filter((b) => b.offsetParent !== null && !['checkbox', 'radio', 'range', 'color', 'hidden'].includes(b.type))
      .filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => (b.textContent || b.name || b.type).trim().slice(0, 30) + ' ' + Math.round(b.getBoundingClientRect().height)).slice(0, 5), scope);
    ok(small.length === 0, label + ': every control at least 44 px tall', small.join(' | '));
  }
  const h = { ok, sleep, waitFor, BASE, EP, open, PRIVACY };

  try {
    /* every page, both widths */
    const CHECKS = {};
    for (const f of fs.readdirSync(path.join(__dirname, 'live')).filter((n) => /^[a-z0-9-]+\.js$/.test(n))) CHECKS[f.replace(/\.js$/, '')] = require(path.join(__dirname, 'live', f));
    if (!FLOWS_ONLY) {
    for (const p of pages) {
      for (const width of [1280, 390]) {
        const page = await open(p.url, width);
        if (p.kind !== 'hub') {
          const mounted = await page.evaluate((slug) => { const io = document.querySelector('[data-tool="' + slug + '"] .tool-io'); return !!io && !!io.querySelector('.live-start'); }, p.t.slug);
          ok(mounted, p.url + ' @' + width + ': mounts with a Start button');
          await layout(page, p.url + ' @' + width, '[data-tool] .tool-io');
          if (p.kind === 'landing') {
            const pre = await page.evaluate(() => document.querySelector('[data-tool]').getAttribute('data-preset'));
            ok(pre === JSON.stringify(p.L.preset || {}), p.url + ': carries its preset');
          }
        } else {
          /* the hub's finder chips and FAQ belong to build-hubs.js and the shell; here: no sideways scroll */
          const sideways = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
          ok(sideways <= 1, p.url + ' @' + width + ': no sideways scroll', sideways + ' px');
        }
        await page.close();
      }
    }

    /* the stage window of every tool */
    for (const t of list) {
      const st = await open('/live/' + t.slug + '/?stage=1');
      ok(await st.evaluate(() => !!document.querySelector('.game-stage')), t.slug + ': ?stage=1 shows the big screen');
      await st.close();
    }

    /* /join/: lean, same-origin, small */
    for (const width of [390, 1280]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: width < 600 ? 844 : 800, isMobile: width < 600, hasTouch: width < 600 });
      page.on('pageerror', (e) => errors.push('/join/: ' + e.message));
      const urls = [];
      let bytes = 0, clientBytes = 0;
      const cdp = await page.createCDPSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      const reqUrl = {};
      cdp.on('Network.requestWillBeSent', (e) => { reqUrl[e.requestId] = e.request.url; urls.push(e.request.url); });
      cdp.on('Network.loadingFinished', (e) => { const u = reqUrl[e.requestId] || ''; if (/room-client\.js/.test(u)) clientBytes += e.encodedDataLength; else bytes += e.encodedDataLength; });
      await page.goto(BASE + '/join/', { waitUntil: 'networkidle0' });
      await sleep(300);
      const foreign = urls.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:'));
      /* what came over the wire, as the browser reports it (cache off) */
      const sizes = await page.evaluate(() => performance.getEntriesByType('navigation').concat(performance.getEntriesByType('resource')).map((e) => [e.name, e.transferSize || e.encodedBodySize || 0]));
      bytes = 0; clientBytes = 0;
      sizes.forEach(([u, n]) => { if (/room-client\.js/.test(u)) clientBytes += n; else bytes += n; });
      ok(foreign.length === 0, '/join/ @' + width + ': no request to another origin', foreign.slice(0, 3).join(' '));
      ok(!urls.some((u) => /analytics|clarity|gtag|googletagmanager|collect/i.test(u)), '/join/ @' + width + ': no analytics request');
      ok(!urls.some((u) => /room-join-hi\.js/.test(u)) || width === 0, '/join/ @' + width + ': Hindi strings not loaded until asked for');
      if (width === 390) {
        ok(bytes > 0 && bytes < 40 * 1024, '/join/: transfer before room-client.js under 40 KB', Math.round(bytes / 1024 * 10) / 10 + ' KB (+ room-client.js ' + Math.round(clientBytes / 1024 * 10) / 10 + ' KB)');
        console.log('  /join/ transfer: ' + (bytes / 1024).toFixed(1) + ' KB + room-client.js ' + (clientBytes / 1024).toFixed(1) + ' KB, ' + urls.length + ' requests: ' + sizes.map(([u, n]) => u.replace(BASE, '') + ' ' + n).join(', '));
      }
      ok(hasPrivacy(await page.evaluate(() => document.body.textContent)), '/join/ @' + width + ': shows the approved privacy text');
      await layout(page, '/join/ @' + width, 'body');
      const cookies = await page.cookies();
      ok(cookies.length === 0, '/join/ @' + width + ': no cookies', cookies.map((c) => c.name).join());
      await page.close();
    }

    /* each tool's own maths, from its test file */
    for (const t of list) {
      if (!ok(!!CHECKS[t.slug], t.slug + ': has build/tests/live/' + t.slug + '.js')) continue;
      const page = await open('/live/' + t.slug + '/');
      await CHECKS[t.slug].maths(page, h);
      await page.close();
    }
    /* pages outside /live/ that use the relay: build/tests/live/<name>.js with extra: true (the quiz games' phones) */
    for (const k of Object.keys(CHECKS).filter((x) => CHECKS[x].extra && (!ONLY || ONLY === x))) if (CHECKS[k].maths) await CHECKS[k].maths(null, h);
    {
      const page = await open('/live/' + (list[0] ? list[0].slug : 'live-poll') + '/');
      const kit = await page.evaluate(() => {
        const L = window.LiveKit, W = window.RoomWords;
        return {
          cells: ['=SUM(A1)', '+1', '-2', '@x', 'plain', 'a,b', 'say "hi"', 'line\nbreak'].map(L.csvCell),
          csv: L.csv([['a', '=b'], ['1', '2']]),
          stats: L.stats([1, 2, 3, 4]),
          masked: ['what the fuuuck', 'B1tch', 'class assessment', 'Scunthorpe', 'चूतिया', 'madarchod!!', 'good morning', '500 BC'].map(W.mask)
        };
      });
      ok(JSON.stringify(kit.cells) === JSON.stringify(["'=SUM(A1)", "'+1", "'-2", "'@x", 'plain', '"a,b"', '"say ""hi"""', '"line\nbreak"']), 'kit: CSV cells guarded against formulas and quoted', JSON.stringify(kit.cells));
      ok(kit.csv === "a,'=b\r\n1,2\r\n", 'kit: CSV rows end in CRLF');
      ok(Math.abs(kit.stats.mean - 2.5) < 1e-9 && Math.abs(kit.stats.sd - Math.sqrt(1.25)) < 1e-9 && kit.stats.min === 1 && kit.stats.max === 4, 'kit: mean and standard deviation');
      const want = ['what the f*****', 'B****', 'class assessment', 'Scunthorpe', null, 'm********!!', 'good morning', '500 BC'];
      kit.masked.forEach((m, i) => { if (want[i] === null) ok(m !== 'चूतिया' && m[0] === 'च', 'words: Devanagari word masked', m); else ok(m === want[i], 'words: mask ' + JSON.stringify(want[i]), m); });
      await page.close();
    }

    } /* end of the page checks (skipped with --flows-only) */
    /* ---------- live flows ---------- */
    if (!SKIP_FLOWS) {
      const phones = [];
      for (let i = 0; i < PHONES; i++) {
        const ctx = await browser.createBrowserContext();
        const page = await ctx.newPage();
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.evaluateOnNewDocument(RECORD);
        page.on('pageerror', (e) => errors.push('phone ' + i + ': ' + e.message));
        phones.push({ ctx, page, i, nick: 'Phone ' + (i + 1) });
      }
      h.phones = phones;
      h.newPhone = async () => {
        const ctx = await browser.createBrowserContext();
        const page = await ctx.newPage();
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.evaluateOnNewDocument(RECORD);
        return { ctx, page };
      };
      /* the host: nothing goes to the relay before Start */
      h.startHost = async (slug, before) => {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        page.on('pageerror', (e) => errors.push('host ' + slug + ': ' + e.message));
        page.on('dialog', (d) => d.accept().catch(() => {}));
        const relayHits = [];
        page.on('request', (r) => { if (r.url().startsWith(EP) || r.url().indexOf(':' + RELAY_PORT) >= 0) relayHits.push(r.url()); });
        await page.goto(BASE + '/live/' + slug + '/?relay=' + encodeURIComponent(EP), { waitUntil: 'load' });
        /* start from the tool's defaults: the page checks above (landing presets) share this context's saved settings */
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
        await page.reload({ waitUntil: 'load' });
        await page.evaluate(() => { const b = document.querySelector('.cc .cc-no, .cc button'); if (b) b.click(); });
        if (before) await before(page);
        await sleep(400);
        ok(relayHits.length === 0, slug + ': nothing reaches the relay before Start', relayHits.join(' '));
        await page.evaluate(() => document.querySelector('.live-start').click());
        const code = await waitFor(() => page.evaluate(() => { const c = document.querySelector('[data-live-code]'); const t = c ? c.textContent.replace(/\D/g, '') : ''; return /^\d{6}$/.test(t) ? t : null; }), 20000);
        ok(!!code, slug + ': the session starts and shows a 6-digit code');
        ok(relayHits.length > 0, slug + ': the relay is contacted after Start');
        /* the QR code on the page decodes (with the site's own decoder) to the join link */
        const qr = await waitFor(() => page.evaluate(() => {
          const cv = document.querySelector('.live-qr');
          if (!cv || !cv.width || !window.decodeQR) return null;
          const c = cv.getContext('2d'), d = c.getImageData(0, 0, cv.width, cv.height).data;
          /* find the module size from the first dark pixel on the diagonal (quiet zone is 4 modules) */
          let first = -1;
          for (let i = 0; i < cv.width; i++) if (d[(i * cv.width + i) * 4] < 128) { first = i; break; }
          if (first < 0) return null;
          const scale = first / 4, n = Math.round(cv.width / scale) - 8;
          const m = [];
          for (let y = 0; y < n; y++) { const row = []; for (let x = 0; x < n; x++) { const px = Math.floor((x + 4 + 0.5) * scale), py = Math.floor((y + 4 + 0.5) * scale); row.push(d[(py * cv.width + px) * 4] < 128 ? 1 : 0); } m.push(row); }
          const r = window.decodeQR(m);
          return r && r.ok ? r.text : 'undecodable';
        }), 8000);
        ok(qr && qr.indexOf('/join/') > 0 && qr.endsWith('#' + code), slug + ': the QR code reads back as the join link with the code', qr);
        return { page, code };
      };
      h.hostCount = (host) => host.evaluate(() => { const c = document.querySelector('.live-count'); return c ? Number((c.textContent.match(/\d+/) || [0])[0]) : -1; });
      h.join = async (ph, code) => {
        await ph.page.goto('about:blank');
        await ph.page.goto(BASE + '/join/?relay=' + encodeURIComponent(EP) + '#' + code, { waitUntil: 'load' });
        await ph.page.evaluate((nick) => { document.getElementById('nick').value = nick; }, ph.nick);
        await ph.page.click('#go');
        return waitFor(() => ph.page.evaluate(() => !document.getElementById('s-room').hidden), 15000);
      };
      h.joinAll = async (code, n) => {
        const use = phones.slice(0, n || phones.length);
        let joined = 0;
        for (let i = 0; i < use.length; i += 10) {
          const r = await Promise.all(use.slice(i, i + 10).map((ph) => h.join(ph, code)));
          joined += r.filter(Boolean).length;
        }
        return joined;
      };
      /* every frame each phone has received since the last call, parsed */
      h.frames = async (ph) => (await ph.page.evaluate(() => window.__rx.splice(0))).map((s) => { try { return JSON.parse(s); } catch (e) { return { bad: s }; } });
      h.clearFrames = async (ps) => { for (const ph of ps) await ph.page.evaluate(() => { window.__rx.length = 0; }); };
      /* drop the phone's socket (not a clean close): the client reconnects with its rejoin token */
      h.dropSocket = async (ph) => ph.page.evaluate(() => { const w = window.__ws[window.__ws.length - 1]; if (w) w.close(); return window.__ws.length; });
      h.socketCount = (ph) => ph.page.evaluate(() => window.__ws.length);
      h.connected = (ph) => ph.page.evaluate(() => { const c = document.getElementById('conn'); return !!c && /Connected/.test(c.textContent); });
      h.endSession = async (host, slug, use) => {
        await host.evaluate(() => document.querySelector('.live-end').click());
        await sleep(150);
        await host.evaluate(() => document.querySelector('.live-end').click());
        const ended = await Promise.all(use.map((ph) => waitFor(() => ph.page.evaluate(() => !document.getElementById('s-end').hidden && /ended the session/.test(document.getElementById('end-msg').textContent)), 10000)));
        ok(ended.every(Boolean), slug + ': End session closes every phone (' + ended.filter(Boolean).length + '/' + use.length + ')');
        ok(await host.evaluate(() => !document.querySelector('.live-before').hidden), slug + ': the host page is back to Start');
      };
      /* 70 extra participants as plain sockets, to fill a free room to 100 */
      h.fillWithSockets = async (code, n) => {
        const WS = req('ws');
        const socks = [];
        await Promise.all(Array.from({ length: n }, (_, i) => new Promise((res) => {
          const s = new WS(EP.replace(/^http/, 'ws') + '/rooms/' + code + '/ws?role=player', { headers: { Origin: BASE } });
          s.on('open', () => s.send(JSON.stringify({ t: 'hello', nick: 'Bot ' + (i + 1) })));
          s.on('message', (d) => { const m = JSON.parse(String(d)); if (m.t === 'welcome') res(); });
          s.on('error', () => res());
          s.on('close', () => res());
          socks.push(s);
        })));
        return { socks, close: () => socks.forEach((s) => { try { s.close(); } catch (e) { /* gone */ } }) };
      };

      for (const t of list) {
        if (!CHECKS[t.slug] || !CHECKS[t.slug].flow) { ok(false, t.slug + ': has a live flow'); continue; }
        const t0 = Date.now();
        await CHECKS[t.slug].flow(h, t);
        console.log('  ' + t.slug + ' flow: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
      }
      for (const k of Object.keys(CHECKS).filter((x) => CHECKS[x].extra && (!ONLY || ONLY === x))) {
        const t0 = Date.now();
        await CHECKS[k].flow(h);
        console.log('  ' + k + ' flow: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
      }
      for (const ph of phones) await ph.ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
    if (relay) relay.stop();
  }
  for (const e of errors) ok(false, 'page error', e);
  console.log('\nlive-rooms.js  ' + pass + ' passed, ' + fail + ' failed');
  failures.forEach((f) => console.log('  FAIL ' + f));
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
