/* Bigger rooms for a signed-in paid plan (engine/room-kit.js L.planToken,
   assets/account.js Account.liveToken, the backend's liveToken callable), for
   build/tests/live-rooms.js. Not a /live/ tool: `extra: true` makes live-rooms.js
   run it after the live tools (and alone with --only pro-token).

   The relay runs with PLAN_SECRET local-dev-secret and FREE_CAP 100. Each
   presenter is a fresh incognito context on Live Poll. The real account.js runs;
   only Google's Firebase modules (www.gstatic.com) are answered by small fakes
   here, which sign the presenter in with a record on the chosen plan and answer
   the liveToken callable with a token minted in Node exactly as the backend mints
   it. The cap is read from the page and proved at the relay: 105 sockets join,
   and a free room turns away the ones past 100 while a Pro room takes them all.

   - never signed in: no account code, no Firebase, no functions request at all;
     a free room (100)
   - signed in on Pro: one liveToken call, a room of 1,000
   - signed in on the free plan: no call, a free room
   - the call fails, or never answers, or answers with a token signed with
     another secret: the room still opens, at the free cap */
'use strict';
const crypto = require('crypto');
const path = require('path');

const SECRET = 'local-dev-secret';
const BOTS = 105;
const SDK = 'https://www.gstatic.com/firebasejs/';
const ACCOUNT = /\/assets\/(account|firebase-config)\.js|gstatic\.com|firebase|googleapis\.com|cloudfunctions\.net/i;

function planToken(secret, plan, cap, ttl) {
  const p = Buffer.from(JSON.stringify({ plan, cap, exp: Math.floor(Date.now() / 1000) + (ttl || 600) })).toString('base64url');
  return p + '.' + crypto.createHmac('sha256', secret).update(p).digest('base64url');
}

/* Google's modules, cut down to what account.js calls. window.__fake (set
   before the page loads) chooses the plan and what the callable does. */
const FAKE = {
  'firebase-app.js': 'export function initializeApp(c) { return { c }; }',
  'firebase-auth.js': 'export function getAuth() { return {}; }\n' +
    'export function connectAuthEmulator() {}\n' +
    'export function onAuthStateChanged(a, cb) { setTimeout(() => cb({ uid: "u-test", email: "presenter@example.com", displayName: null }), 0); return () => {}; }',
  'firebase-firestore.js': 'export function getFirestore() { return {}; }\n' +
    'export function connectFirestoreEmulator() {}\n' +
    'export function doc() { return {}; }\n' +
    'export function onSnapshot(ref, cb) { const f = window.__fake || {}; setTimeout(() => cb({ exists: () => true, data: () => ({ plan: f.plan || "free", status: f.plan && f.plan !== "free" ? "active" : null, planUntil: null }) }), 0); return () => {}; }',
  'firebase-functions.js': 'export function getFunctions() { return {}; }\n' +
    'export function connectFunctionsEmulator() {}\n' +
    'export function httpsCallable(fns, name) { return (data) => { const f = window.__fake || {}; (window.__calls = window.__calls || []).push(name);\n' +
    '  if (f.mode === "fail") return Promise.reject(Object.assign(new Error("internal"), { code: "functions/internal" }));\n' +
    '  if (f.mode === "hang") return new Promise(() => {});\n' +
    '  return Promise.resolve({ data: { token: f.token || null, plan: f.plan } }); }; }'
};

function wsLib() {
  for (const p of [path.join(__dirname, '..', '..', '..', 'node_modules', 'ws'), 'E:/projects/1234tools-relay/node_modules/ws', 'ws']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('ws not found');
}

/* n plain sockets into the room: how many were welcomed and how many told it is full */
async function fill(h, code, n) {
  const WS = wsLib();
  const socks = [];
  let welcome = 0, full = 0;
  await Promise.all(Array.from({ length: n }, (_, i) => new Promise((res) => {
    const s = new WS(h.EP.replace(/^http/, 'ws') + '/rooms/' + code + '/ws?role=player', { headers: { Origin: h.BASE } });
    const t = setTimeout(res, 15000);
    s.on('open', () => s.send(JSON.stringify({ t: 'hello', nick: 'Bot ' + (i + 1) })));
    s.on('message', (d) => { let m = {}; try { m = JSON.parse(String(d)); } catch (e) { /* not ours */ } if (m.t === 'welcome') { welcome++; clearTimeout(t); res(); } else if (m.t === 'full') { full++; clearTimeout(t); res(); } });
    s.on('error', () => { clearTimeout(t); res(); });
    s.on('close', () => { clearTimeout(t); res(); });
    socks.push(s);
  })));
  return { welcome, full, close: () => socks.forEach((s) => { try { s.close(); } catch (e) { /* gone */ } }) };
}

/* One presenter: a fresh context, signed in or not, on Live Poll; Start; the cap. */
async function present(h, label, setup) {
  const { ctx, page } = await h.newPhone();
  await page.setViewport({ width: 1280, height: 900 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const seen = [];
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (ACCOUNT.test(u)) seen.push(u);
    if (u.startsWith(SDK)) {
      const name = u.split('/').pop();
      if (FAKE[name]) return r.respond({ status: 200, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: FAKE[name] });
      return r.respond({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    }
    if (ACCOUNT.test(u) && !/\/assets\/(account|firebase-config)\.js/.test(u)) return r.abort();   /* nothing real leaves the test */
    return r.continue();
  });
  if (setup.signedIn) await page.evaluateOnNewDocument((fake) => { try { localStorage.setItem('1234tools.signedIn', '1'); } catch (e) { /* none */ } window.__fake = fake; }, setup.fake || {});
  await page.goto(h.BASE + '/live/live-poll/?relay=' + encodeURIComponent(h.EP), { waitUntil: 'load' });
  await page.evaluate(() => { const b = document.querySelector('.cc .cc-no, .cc button'); if (b) b.click(); });
  const early = seen.length;
  if (setup.wait) await page.evaluate((ms) => { window.LiveKit.PLAN_WAIT = ms; }, setup.wait);
  const t0 = Date.now();
  await page.evaluate(() => document.querySelector('.live-start').click());
  const code = await h.waitFor(() => page.evaluate(() => { const c = document.querySelector('[data-live-code]'); const t = c ? c.textContent.replace(/\D/g, '') : ''; return /^\d{6}$/.test(t) ? t : null; }), 20000);
  const took = Date.now() - t0;
  h.ok(!!code, 'pro-token ' + label + ': the session starts and shows a code', took + ' ms');
  const cap = code ? await page.evaluate(() => { const m = (document.querySelector('.live-count') || {}).textContent || ''; const x = m.match(/of ([\d,]+)/); return x ? Number(x[1].replace(/,/g, '')) : -1; }) : -1;
  const calls = await page.evaluate(() => (window.__calls || []).slice());
  return { ctx, page, code, cap, calls, seen, early, errs, took };
}

async function finish(h, p, label) {
  await p.page.evaluate(() => { const b = document.querySelector('.live-end'); if (b) b.click(); });
  await h.sleep(150);
  await p.page.evaluate(() => { const b = document.querySelector('.live-end'); if (b) b.click(); });
  h.ok(p.errs.length === 0, 'pro-token ' + label + ': no page errors', p.errs.join(' | '));
  await p.ctx.close();
}

module.exports = {
  extra: true,

  /* the token helper on its own, in Node: no browser needed */
  async maths(page, h) {
    const kit = require('fs').readFileSync(path.join(__dirname, '..', '..', '..', 'engine', 'room-kit.js'), 'utf8');
    h.ok(/MVR\.create\(Object\.assign\(\{ title: opts\.title \|\| '' \}, roomOpts, plan \? \{ plan \} : \{\}\)\)/.test(kit), 'pro-token: room-kit.js creates every room with the plan token when there is one');
    h.ok((kit.match(/MVR\.create\(/g) || []).length === 1, 'pro-token: room-kit.js has one place that creates a room');
    const others = require('fs').readdirSync(path.join(__dirname, '..', '..', '..', 'engine')).filter((n) => /^(room|game)-.*\.js$/.test(n) && n !== 'room-kit.js' && n !== 'room-client.js')
      .filter((n) => /\bMVR(Room)?\.create\(/.test(require('fs').readFileSync(path.join(__dirname, '..', '..', '..', 'engine', n), 'utf8')));
    h.ok(others.length === 0, 'pro-token: no other engine file creates a room past the helper', others.join(' '));
  },

  async flow(h) {
    /* never signed in on this device */
    let p = await present(h, 'never signed in', { signedIn: false });
    h.ok(p.seen.length === 0, 'pro-token never signed in: no account code, Firebase or functions request at all', p.seen.join(' '));
    h.ok(p.cap === 100, 'pro-token never signed in: a free room (of 100)', p.cap);
    let f = p.code ? await fill(h, p.code, BOTS) : { welcome: 0, full: 0, close() {} };
    h.ok(f.welcome === 100 && f.full === BOTS - 100, 'pro-token never signed in: the relay takes 100 and tells the rest it is full', f);
    f.close(); await finish(h, p, 'never signed in');

    /* signed in on Pro */
    p = await present(h, 'Pro', { signedIn: true, fake: { plan: 'pro', token: planToken(SECRET, 'pro', 1000) } });
    h.ok(p.early === 0, 'pro-token Pro: nothing account-related loads before Start', p.seen.slice(0, p.early).join(' '));
    h.ok(p.seen.some((u) => /\/assets\/account\.js/.test(u)) && p.seen.some((u) => /firebase-app\.js/.test(u)), 'pro-token Pro: Start loads the account code', p.seen.join(' '));
    h.ok(p.calls.length === 1 && p.calls[0] === 'liveToken', 'pro-token Pro: one liveToken call', p.calls);
    h.ok(p.cap === 1000, 'pro-token Pro: the relay gives a room of 1,000', p.cap);
    f = p.code ? await fill(h, p.code, BOTS) : { welcome: 0, full: 0, close() {} };
    h.ok(f.welcome === BOTS && f.full === 0, 'pro-token Pro: the relay takes all ' + BOTS + ' (past the free 100)', f);
    f.close(); await finish(h, p, 'Pro');

    /* signed in on the free plan */
    p = await present(h, 'signed in, free plan', { signedIn: true, fake: { plan: 'free', token: planToken(SECRET, 'pro', 1000) } });
    h.ok(p.calls.length === 0, 'pro-token signed in, free plan: no liveToken call', p.calls);
    h.ok(p.cap === 100, 'pro-token signed in, free plan: a free room', p.cap);
    await finish(h, p, 'signed in, free plan');

    /* the call fails */
    p = await present(h, 'call fails', { signedIn: true, fake: { plan: 'pro', mode: 'fail' } });
    h.ok(p.calls.length === 1 && p.cap === 100, 'pro-token the liveToken call fails: the room still opens, at the free cap', { calls: p.calls, cap: p.cap });
    await finish(h, p, 'call fails');

    /* the call never answers: the room opens after PLAN_WAIT */
    p = await present(h, 'call hangs', { signedIn: true, fake: { plan: 'pro', mode: 'hang' }, wait: 400 });
    h.ok(p.code && p.cap === 100 && p.took < 8000, 'pro-token the liveToken call never answers: the room opens after the wait, at the free cap', { cap: p.cap, took: p.took });
    await finish(h, p, 'call hangs');

    /* a token signed with another secret */
    p = await present(h, 'forged token', { signedIn: true, fake: { plan: 'pro', token: planToken('another-secret', 'pro', 1000) } });
    h.ok(p.code && p.cap === 100, 'pro-token a token signed with another secret: a free room, no error', p.cap);
    await finish(h, p, 'forged token');
  }
};
