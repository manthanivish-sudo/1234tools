/**
 * The two pages an account needs: /account/ and /pricing/.
 *
 *   node build-account.js          apply
 *   node build-account.js --check  report what would change, write nothing
 *   node build-account.js --live   drop noindex; run this once the project
 *                                  exists and firebase-config.js is filled in
 *
 * Both pages ship dark until then: reachable at their URLs, marked noindex,
 * linked from nowhere, and saying plainly that accounts are not switched on.
 * They load /assets/account.js, which loads nothing else while the config
 * still reads REPLACE_ME — so shipping the pages changes nothing for anyone
 * who does not type the address.
 *
 * Prices come from build/plans.json, the display copy of what the backend
 * charges. Every plan card is written into the HTML, not fetched, so the
 * page reads without a backend and a crawler sees the prices.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crumbs = require('./build-crumbs.js');
const { trailFor } = require('./build/sections.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const LIVE = process.argv.includes('--live');
const SITE = 'https://www.1234tools.com';
const PLANS = require('./build/plans.json');

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

function shell() {
  const src = fs.readFileSync(path.join(ROOT, 'about/index.html'), 'utf8');
  const headEnd = src.indexOf('</head>');
  const open = '<main id="main" class="content">';
  const mainStart = src.indexOf(open);
  const mainEnd = src.indexOf('</main>');
  if (headEnd < 0 || mainStart < 0 || mainEnd < 0) throw new Error('could not read the shell from about/index.html');
  return { head: src.slice(0, headEnd), mid: src.slice(headEnd, mainStart + open.length), tail: src.slice(mainEnd) };
}

function headFor(parts, slug, title, description) {
  const url = SITE + '/' + slug + '/';
  let h = parts.head
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(title) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">')
    .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(title) + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(description) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '')
    .replace(/<meta name="robots" content="[^"]*">\n?/, '');
  if (!LIVE) h = h.replace('<link rel="canonical"', '<meta name="robots" content="noindex,nofollow">\n<link rel="canonical"');
  /* the account layer, after the page's own scripts */
  h = h.replace('</head>', '') + '<script src="/assets/firebase-config.js"></script>\n<script src="/assets/account.js" defer></script>\n';
  return h;
}

const fmt = (cur, n) => PLANS.currencies[cur].symbol + (Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toFixed(2));

/* ------------------------------------------------------------------ */

function pricingBody() {
  const cards = PLANS.plans.map(p => {
    const price = (cur, period) => p.price[cur][period];
    return '<div class="plan' + (p.highlight ? ' is-highlight' : '') + '" data-plan="' + p.id + '">' +
      (p.highlight ? '<span class="plan-flag">Most people</span>' : '') +
      '<h2 class="plan-name">' + esc(p.name) + '</h2>' +
      '<p class="plan-tagline">' + esc(p.tagline) + '</p>' +
      '<p class="plan-price">' +
        Object.keys(PLANS.currencies).map(cur => ['monthly', 'annual'].map(per =>
          '<span class="plan-amount" data-cur="' + cur + '" data-period="' + per + '" hidden>' +
            (price(cur, per) === 0 ? '<strong>' + esc(PLANS.currencies[cur].symbol) + '0</strong><small>always</small>' :
              '<strong>' + esc(fmt(cur, per === 'annual' ? Math.round(price(cur, per) / 12 * 100) / 100 : price(cur, per))) + '</strong><small>/month' + (per === 'annual' ? ', billed ' + esc(fmt(cur, price(cur, per))) + ' a year' : '') + '</small>') +
          '</span>').join('')).join('') +
      '</p>' +
      '<ul class="plan-features">' + p.features.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
      (p.id === 'free'
        ? '<a class="btn-ghost plan-cta" href="/">Use the tools</a>'
        : '<button type="button" class="btn-primary plan-cta" data-checkout="' + p.id + '">Choose ' + esc(p.name) + '</button>') +
      '</div>';
  }).join('');

  return '<article class="pricing">\n' +
    '  <p class="eyebrow">Plans</p>\n' +
    '  <h1>Free for everything that runs on your device. Paid for what cannot.</h1>\n' +
    '  <p class="lede">All ' + esc(String(PLANS.plans[0].features[0]).replace(/^All /, '').replace(/,.*$/, '')) + ' stay free with no account. Pro and Business pay for the parts that need a server: AI calls, and settings that follow you between devices.</p>\n' +
    '  <div class="io-msg" id="pricing-msg"></div>\n' +
    '  <div class="plan-controls">\n' +
    '    <div class="biz-seg" role="tablist" aria-label="Billing period"><button type="button" class="biz-seg-btn is-on" data-period="monthly">Monthly</button><button type="button" class="biz-seg-btn" data-period="annual">Annual <small>2 months free</small></button></div>\n' +
    '    <div class="biz-seg" role="tablist" aria-label="Where you pay from">' + Object.entries(PLANS.currencies).map(([cur, c], i) => '<button type="button" class="biz-seg-btn' + (i === 0 ? ' is-on' : '') + '" data-cur="' + cur + '" title="' + esc(c.label) + '">' + esc(cur === 'INR' ? 'India · ₹' : 'Elsewhere · £') + '</button>').join('') + '</div>\n' +
    '  </div>\n' +
    '  <div class="plan-grid">' + cards + '</div>\n' +
    '  <p class="plan-note" id="plan-note"></p>\n' +
    '  <section class="panel"><h2>Questions</h2>' + PLANS.faq.map(f => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>\n' +
    '</article>\n' +
    '<script>\n' + pricingScript() + '</script>\n';
}

function pricingScript() {
  return `document.addEventListener('DOMContentLoaded', function () {
  var period = 'monthly';
  /* India if the browser says so; a guess the reader can overrule */
  var cur = (/^(en-IN|hi|ta|te|kn|ml|mr|gu|bn|pa)/i.test(navigator.language) || /Kolkata|Calcutta/.test(Intl.DateTimeFormat().resolvedOptions().timeZone || '')) ? 'INR' : 'GBP';
  var msg = document.getElementById('pricing-msg');
  var note = document.getElementById('plan-note');
  var providers = ${JSON.stringify(Object.fromEntries(Object.entries(PLANS.currencies).map(([k, v]) => [k, v.provider])))};
  function paint() {
    document.querySelectorAll('.plan-amount').forEach(function (el) { el.hidden = !(el.dataset.cur === cur && el.dataset.period === period); });
    document.querySelectorAll('[data-period]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.period === period); });
    document.querySelectorAll('[data-cur]').forEach(function (b) { if (b.classList.contains('biz-seg-btn')) b.classList.toggle('is-on', b.dataset.cur === cur); });
    note.textContent = cur === 'INR' ? 'Charged in rupees through Razorpay: UPI, cards, net banking. GST invoice on request.' : 'Charged in pounds through Stripe, by card. VAT invoice on request.';
  }
  document.querySelectorAll('[data-period]').forEach(function (b) { b.addEventListener('click', function () { period = b.dataset.period; paint(); }); });
  document.querySelectorAll('.biz-seg-btn[data-cur]').forEach(function (b) { b.addEventListener('click', function () { cur = b.dataset.cur; paint(); }); });
  paint();
  function say(t, k) { msg.textContent = t || ''; msg.className = 'io-msg' + (k ? ' is-' + k : ''); if (t) msg.scrollIntoView({ block: 'nearest' }); }
  document.querySelectorAll('[data-checkout]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!window.Account || !window.Account.enabled) { say('Paid plans are not switched on yet. Everything that runs on your device is free and needs no account.', 'note'); return; }
      window.Account.ready.then(function (s) {
        if (!s.user) { location.href = '/account/?next=' + encodeURIComponent('/pricing/'); return; }
        b.disabled = true; say('Opening checkout…', 'note');
        return window.Account.checkout(b.dataset.checkout, period, providers[cur]).then(function (r) {
          if (r && r.paid) { say('Thank you. Your plan is being activated — the account page will show it in a moment.', 'note'); setTimeout(function () { location.href = '/account/?checkout=success'; }, 1500); }
        });
      }).catch(function (e) { say(e.message || String(e), 'error'); }).then(function () { b.disabled = false; });
    });
  });
  if (/checkout=cancelled/.test(location.search)) say('Checkout was cancelled. Nothing was charged.', 'note');
});
`;
}

/* ------------------------------------------------------------------ */

function accountBody() {
  return '<article class="account">\n' +
    '  <p class="eyebrow">Account</p>\n' +
    '  <h1>Your account</h1>\n' +
    '  <p class="lede">An account is only for the things that cannot run in your browser — AI calls, and settings that follow you between devices. Every other tool works without one.</p>\n' +
    '  <div class="io-msg" id="acct-msg"></div>\n' +
    '  <section class="acct-off panel" id="acct-off" hidden><h2>Not switched on yet</h2><p>Accounts and paid plans are being set up. Every tool that runs on your device is free, needs no account, and is not affected. <a href="/">Back to the tools</a>.</p></section>\n' +
    '  <section class="acct-signin panel" id="acct-signin" hidden>\n' +
    '    <h2>Sign in</h2>\n' +
    '    <div class="acct-providers"><button type="button" class="btn-primary" id="acct-google">Continue with Google</button></div>\n' +
    '    <p class="acct-or">or with email</p>\n' +
    '    <form id="acct-form" class="acct-form" novalidate>\n' +
    '      <div class="field"><label for="acct-email">Email</label><input class="control" id="acct-email" type="email" autocomplete="email" required></div>\n' +
    '      <div class="field"><label for="acct-password">Password</label><input class="control" id="acct-password" type="password" autocomplete="current-password" minlength="8" required><span class="field-hint">At least 8 characters</span></div>\n' +
    '      <div class="io-actions"><button type="submit" class="btn-primary" id="acct-signin-btn">Sign in</button><button type="button" class="btn-ghost" id="acct-signup-btn">Create an account</button><button type="button" class="btn-ghost" id="acct-reset-btn">Forgot password</button></div>\n' +
    '    </form>\n' +
    '    <p class="acct-privacy">Signing in loads Google’s sign-in library on this page and stores your email with your account. The free tools do not change: a file you convert never leaves your device, signed in or not. <a href="/privacy/">Privacy</a>.</p>\n' +
    '  </section>\n' +
    '  <section class="acct-me" id="acct-me" hidden>\n' +
    '    <div class="acct-card">\n' +
    '      <div class="acct-who"><span class="acct-avatar" id="acct-avatar"></span><div><strong id="acct-email-out"></strong><span class="acct-plan" id="acct-plan"></span></div></div>\n' +
    '      <dl class="acct-facts"><div><dt>Plan</dt><dd id="acct-plan-name"></dd></div><div><dt>Renews</dt><dd id="acct-renews"></dd></div><div><dt>AI calls this month</dt><dd id="acct-usage"></dd></div><div><dt>Paid through</dt><dd id="acct-provider"></dd></div></dl>\n' +
    '      <div class="io-actions"><a class="btn-primary" id="acct-upgrade" href="/pricing/">See plans</a><button type="button" class="btn-ghost" id="acct-manage" hidden>Manage billing</button><button type="button" class="btn-ghost" id="acct-cancel" hidden>Cancel at period end</button><button type="button" class="btn-ghost" id="acct-signout">Sign out</button></div>\n' +
    '    </div>\n' +
    '    <section class="panel"><h2>Saved settings</h2><p class="acct-hint">Tool settings you save while signed in — a Tally column mapping, for instance — are kept here and offered on any device.</p><ul class="acct-saved" id="acct-saved"><li class="acct-empty">Nothing saved yet.</li></ul></section>\n' +
    '  </section>\n' +
    '</article>\n' +
    '<script>\n' + accountScript() + '</script>\n';
}

function accountScript() {
  return `document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var msg = $('acct-msg');
  function say(t, k) { msg.textContent = t || ''; msg.className = 'io-msg' + (k ? ' is-' + k : ''); }
  var A = window.Account;
  if (!A || !A.enabled) { $('acct-off').hidden = false; return; }
  var next = new URLSearchParams(location.search).get('next');
  if (/checkout=success/.test(location.search)) say('Payment received. Your plan appears below as soon as the provider confirms it — usually within a minute. This page updates on its own.', 'note');

  function show(s) {
    $('acct-signin').hidden = !!s.user;
    $('acct-me').hidden = !s.user;
    if (!s.user) return;
    if (next) { location.href = next; return; }
    var r = s.record || {};
    $('acct-email-out').textContent = s.user.email || '(no email)';
    $('acct-avatar').textContent = (s.user.email || '?').charAt(0).toUpperCase();
    var plan = s.plan;
    $('acct-plan').textContent = plan === 'free' ? 'Free' : plan.charAt(0).toUpperCase() + plan.slice(1);
    $('acct-plan').className = 'acct-plan is-' + plan;
    $('acct-plan-name').textContent = plan === 'free' ? 'Free' : (plan.charAt(0).toUpperCase() + plan.slice(1)) + (r.status === 'cancelled' ? ' (cancelled, runs to the date shown)' : r.status === 'past_due' ? ' (payment failed — update your card)' : '');
    var until = r.planUntil && (typeof r.planUntil.toDate === 'function' ? r.planUntil.toDate() : new Date(Number(r.planUntil)));
    $('acct-renews').textContent = until ? until.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    $('acct-provider').textContent = r.provider === 'razorpay' ? 'Razorpay (INR)' : r.provider === 'stripe' ? 'Stripe (GBP)' : '—';
    $('acct-upgrade').textContent = plan === 'free' ? 'See plans' : 'Change plan';
    $('acct-manage').hidden = !(r.provider === 'stripe' && r.subscriptionId);
    $('acct-cancel').hidden = !(r.provider === 'razorpay' && r.subscriptionId && r.status === 'active');
    A.usageThisMonth().then(function (u) { $('acct-usage').textContent = u ? String(u.calls || 0) : '0'; }).catch(function () {});
    A.listMappings('tally').then(function (list) {
      var ul = $('acct-saved'); ul.innerHTML = '';
      if (!list.length) { ul.innerHTML = '<li class="acct-empty">Nothing saved yet.</li>'; return; }
      list.forEach(function (m) {
        var li = document.createElement('li');
        li.innerHTML = '<strong></strong><span class="acct-saved-meta"></span>';
        li.querySelector('strong').textContent = m.name;
        li.querySelector('span').textContent = 'Tally · ' + (m.kind || '') + ' · ' + (m.headers || []).length + ' columns';
        var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'btn-ghost'; rm.textContent = 'Remove';
        rm.addEventListener('click', function () { A.deleteMapping(m.id).then(function () { li.remove(); }).catch(function (e) { say(e.message, 'error'); }); });
        li.appendChild(rm); ul.appendChild(li);
      });
    }).catch(function () {});
  }
  A.ready.then(show);
  A.onChange(show);

  var busy = function (b, on) { b.disabled = on; };
  $('acct-google').addEventListener('click', function () { say(''); A.signInWithGoogle().catch(function (e) { say(e.message, 'error'); }); });
  $('acct-form').addEventListener('submit', function (ev) {
    ev.preventDefault(); say('');
    var b = $('acct-signin-btn'); busy(b, true);
    A.signInWithEmail($('acct-email').value, $('acct-password').value).catch(function (e) { say(e.message, 'error'); }).then(function () { busy(b, false); });
  });
  $('acct-signup-btn').addEventListener('click', function () {
    say(''); var b = $('acct-signup-btn'); busy(b, true);
    A.signUpWithEmail($('acct-email').value, $('acct-password').value).catch(function (e) { say(e.message, 'error'); }).then(function () { busy(b, false); });
  });
  $('acct-reset-btn').addEventListener('click', function () {
    var email = $('acct-email').value; if (!email) { say('Type your email first, then press Forgot password.', 'note'); return; }
    A.resetPassword(email).then(function () { say('If there is an account for ' + email + ', a reset link is on its way.', 'note'); }).catch(function (e) { say(e.message, 'error'); });
  });
  $('acct-signout').addEventListener('click', function () { A.signOut().then(function () { say('Signed out.', 'note'); }); });
  $('acct-manage').addEventListener('click', function () { say('Opening billing…', 'note'); A.manage('portal').catch(function (e) { say(e.message, 'error'); }); });
  $('acct-cancel').addEventListener('click', function () {
    if (!confirm('Cancel the subscription? You keep access until the end of the period you have paid for.')) return;
    A.manage('cancel').then(function (r) { say('Cancelled. Access continues until ' + (r.until ? new Date(r.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'the end of the period') + '.', 'note'); }).catch(function (e) { say(e.message, 'error'); });
  });
});
`;
}

/* ------------------------------------------------------------------ */

function main() {
  const parts = shell();
  const pages = [
    { slug: 'pricing', title: 'Plans and pricing — 1234Tools', description: 'Every tool that runs in your browser is free with no account. Pro and Business pay for what needs a server: AI calls and settings that follow you between devices. Rupees through Razorpay, pounds through Stripe.', body: pricingBody(), name: 'Pricing' },
    { slug: 'account', title: 'Your account — 1234Tools', description: 'Sign in to 1234Tools to use the AI tools and keep saved settings across devices. Nothing else on the site needs an account.', body: accountBody(), name: 'Account' }
  ];
  let built = 0;
  for (const p of pages) {
    const pathOnly = '/' + p.slug + '/';
    const html = headFor(parts, p.slug, p.title, p.description) + parts.mid + '\n' + crumbs.render(trailFor(pathOnly), p.name) + '\n' + p.body + parts.tail;
    if (write(p.slug + '/index.html', html)) built++;
  }
  console.log('\nbuild-account.js' + (CHECK ? '  (--check: nothing will be written)' : '') + (LIVE ? '  (--live: indexable)' : '  (dark: noindex, unlinked)'));
  console.log('  pages               ' + pages.map(p => '/' + p.slug + '/').join(', '));
  console.log('  written             ' + built);
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
