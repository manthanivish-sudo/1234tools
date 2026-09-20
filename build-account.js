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
/* outbound links are tagged the way build-outbound.js tags them, at write
   time, so the two never rewrite each other */
const outbound = require('./build-outbound.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const LIVE = process.argv.includes('--live');
const SITE = 'https://www.1234tools.com';
const PLANS = require('./build/plans.json');
const PACKS = (PLANS.packs && PLANS.packs.items) || [];
/* The free plan's feature list states a total. Written by hand it goes
   stale the week after — it said 1,196 for months — so it is read from
   the search index, which is the register of what exists. */
const { counts } = require('./build-collections.js');

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

/* What one call costs on a pack, which is the only number that lets
   anybody compare this with a plan. Pence read better than pounds. */
function perCall(cur, price, credits) {
  const each = price / credits;
  if (cur === 'GBP') return each < 1 ? Math.round(each * 100) + 'p a call' : '\u00a3' + each.toFixed(2) + ' a call';
  return '\u20b9' + (each < 10 ? each.toFixed(2) : Math.round(each)) + ' a call';
}

const fmt = (cur, n) => PLANS.currencies[cur].symbol + (Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toFixed(2));

/* ------------------------------------------------------------------ */

function packsBody(total) {
  const cards = PACKS.map(k =>
    '<div class="pack' + (k.highlight ? ' is-highlight' : '') + '" data-pack="' + k.id + '">' +
      '<h3 class="pack-name">' + esc(k.name) + '</h3>' +
      '<p class="pack-price">' + Object.keys(PLANS.currencies).map(cur =>
        '<span class="pack-amount" data-cur="' + cur + '" hidden><strong>' + esc(fmt(cur, k.price[cur])) + '</strong>' +
        '<small>once' + (PLANS.currencies[cur].note ? ', ' + esc(PLANS.currencies[cur].note) : '') + ' \u00b7 ' + esc(perCall(cur, k.price[cur], k.credits)) + '</small></span>').join('') + '</p>' +
      '<p class="pack-blurb">' + esc(k.blurb) + '</p>' +
      '<button type="button" class="btn-ghost pack-cta" data-buy="' + k.id + '">Buy ' + esc(k.name) + '</button>' +
    '</div>').join('');
  return '  <section class="panel packs" id="credits">\n' +
    '    <h2>Or pay for what you use, and nothing else</h2>\n' +
    '    <p>One credit is one AI call. Credits are bought outright: no renewal, no card kept on file, and they do not expire. If you need these tools twice a year, this is the cheaper way round \u2014 and if you use them most weeks, a plan works out at less per call, which is why both are here.</p>\n' +
    '    <div class="pack-grid">' + cards + '</div>\n' +
    '    <p class="pack-note">Have a plan as well? The calls it includes are spent first and your credits only after them, so the same call is never charged twice. All ' + total + ' tools that run in your browser stay free either way, credits or no credits.</p>\n' +
    '  </section>\n';
}

function pricingBody() {
  const n = counts();
  const total = n.total.toLocaleString('en-GB');
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
              '<strong>' + esc(fmt(cur, per === 'annual' ? Math.round(price(cur, per) / 12 * 100) / 100 : price(cur, per))) + '</strong><small>/month' + (per === 'annual' ? ', billed ' + esc(fmt(cur, price(cur, per))) + ' a year' : '') + (PLANS.currencies[cur].note ? ' ' + esc(PLANS.currencies[cur].note) : '') + '</small>') +
          '</span>').join('')).join('') +
      '</p>' +
      '<ul class="plan-features">' + p.features.map(f => '<li>' + esc(String(f).replace('{TOTAL}', total)) + '</li>').join('') + '</ul>' +
      (p.id === 'free'
        ? '<a class="btn-ghost plan-cta" href="/">Use the tools</a>'
        : '<button type="button" class="btn-primary plan-cta" data-checkout="' + p.id + '">Choose ' + esc(p.name) + '</button>') +
      '</div>';
  }).join('');

  return '<article class="pricing">\n' +
    '  <p class="eyebrow">Plans</p>\n' +
    '  <h1>Free for everything that runs on your device. Paid for what cannot.</h1>\n' +
    '  <p class="lede">All ' + total + ' tools stay free with no account. What is paid for is the part that needs a server: AI calls, and settings that follow you between devices. Take those by the month, or buy credits once and use them whenever.</p>\n' +
    '  <div class="io-msg" id="pricing-msg"></div>\n' +
    '  <div class="plan-controls">\n' +
    '    <div class="biz-seg" role="tablist" aria-label="Billing period"><button type="button" class="biz-seg-btn is-on" data-period="monthly">Monthly</button><button type="button" class="biz-seg-btn" data-period="annual">Annual <small>2 months free</small></button></div>\n' +
    '    <div class="biz-seg" role="tablist" aria-label="Where you pay from">' + Object.entries(PLANS.currencies).map(([cur, c], i) => '<button type="button" class="biz-seg-btn' + (i === 0 ? ' is-on' : '') + '" data-cur="' + cur + '" title="' + esc(c.label) + '">' + esc(cur === 'INR' ? 'India · ₹ Razorpay' : 'UK &amp; elsewhere · £ Stripe').replace('&amp;amp;', '&amp;') + '</button>').join('') + '</div>\n' +
    '  </div>\n' +
    '  <div class="plan-grid">' + cards + '</div>\n' +
    '  <p class="plan-note" id="plan-note"></p>\n' +
    packsBody(total) +
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
    document.querySelectorAll('.pack-amount').forEach(function (el) { el.hidden = el.dataset.cur !== cur; });
    document.querySelectorAll('[data-period]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.period === period); });
    document.querySelectorAll('[data-cur]').forEach(function (b) { if (b.classList.contains('biz-seg-btn')) b.classList.toggle('is-on', b.dataset.cur === cur); });
    note.textContent = cur === 'INR' ? 'Charged in rupees through Razorpay: UPI, cards, net banking. GST invoice on request.' : 'Charged in pounds sterling through Stripe, by card, by MVR IT Services LTD (UK). VAT invoice on request; the same rail serves customers outside India and the UK.';
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
  document.querySelectorAll('[data-buy]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!window.Account || !window.Account.enabled) { say('Credits are not switched on yet. Everything that runs on your device is free and needs no account.', 'note'); return; }
      window.Account.ready.then(function (s) {
        if (!s.user) { location.href = '/account/?next=' + encodeURIComponent('/pricing/#credits'); return; }
        b.disabled = true; say('Opening checkout\u2026', 'note');
        return window.Account.buyCredits(b.dataset.buy, providers[cur]).then(function (r) {
          if (r && r.paid) { say('Thank you. The credits appear on your account page within a minute.', 'note'); setTimeout(function () { location.href = '/account/?credits=added'; }, 1500); }
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
    '      <dl class="acct-facts"><div><dt>Plan</dt><dd id="acct-plan-name"></dd></div><div><dt>Renews</dt><dd id="acct-renews"></dd></div><div><dt>AI calls this month</dt><dd id="acct-usage"></dd></div><div><dt>Credits in hand</dt><dd id="acct-credits"></dd></div><div><dt>Paid through</dt><dd id="acct-provider"></dd></div></dl>\n' +
    '      <div class="io-actions"><a class="btn-primary" id="acct-upgrade" href="/pricing/">See plans</a><a class="btn-ghost" id="acct-credits-buy" href="/pricing/#credits">Buy credits</a><button type="button" class="btn-ghost" id="acct-manage" hidden>Manage billing</button><button type="button" class="btn-ghost" id="acct-cancel" hidden>Cancel at period end</button><button type="button" class="btn-ghost" id="acct-signout">Sign out</button></div>\n' +
    '    </div>\n' +
    '    <section class="panel"><h2>Saved settings</h2><p class="acct-hint">Tool settings you save while signed in — a Tally column mapping, for instance — are kept here and offered on any device.</p><ul class="acct-saved" id="acct-saved"><li class="acct-empty">Nothing saved yet.</li></ul></section>\n' +
    '    <section class="panel"><h2>Your data</h2><p class="acct-hint">Everything we hold about this account, as one file — or gone. Deleting cancels any subscription first, then removes the saved settings, the usage counts and the sign-in itself. It cannot be undone. <a href="/trust/">What we hold and why</a>.</p><div class="io-actions"><button type="button" class="btn-ghost" id="acct-export">Download my data</button><button type="button" class="btn-ghost acct-danger" id="acct-delete">Delete my account</button></div></section>\n' +
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
  if (/checkout=success/.test(location.search)) say('Payment received. Your plan appears below as soon as the provider confirms it \u2014 usually within a minute. This page updates on its own.', 'note');
  if (/credits=added/.test(location.search)) say('Payment received. The credits appear below as soon as the provider confirms it \u2014 usually within a minute. They do not expire.', 'note');

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
    A.usageThisMonth().then(function (u) {
      var used = u ? (u.calls || 0) : 0, fromPack = u ? (u.packCalls || 0) : 0;
      $('acct-usage').textContent = String(used) + (fromPack ? ' + ' + fromPack + ' from credits' : '');
    }).catch(function () {});
    /* the balance is on the record itself, which is already loaded */
    var credits = Math.max(0, Math.floor(r.credits || 0));
    $('acct-credits').textContent = credits ? String(credits) + (credits === 1 ? ' credit' : ' credits') : 'none';
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
  $('acct-export').addEventListener('click', function () {
    var b = $('acct-export'); busy(b, true); say('Collecting…', 'note');
    A.exportData().then(function (data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = '1234tools-account-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      say('Downloaded. That file is everything we hold about this account.', 'note');
    }).catch(function (e) { say(e.message, 'error'); }).then(function () { busy(b, false); });
  });
  $('acct-delete').addEventListener('click', function () {
    var typed = prompt('This deletes the account, its saved settings and usage counts, and cancels any subscription. It cannot be undone.\\n\\nType DELETE to confirm:');
    if (typed !== 'DELETE') { say('Not deleted.', 'note'); return; }
    var b = $('acct-delete'); busy(b, true); say('Deleting…', 'note');
    A.deleteAccount().then(function (r) {
      say('Deleted' + (r && r.cancelled ? ', and the ' + r.cancelled + ' subscription was cancelled' : '') + '. Nothing about you remains on our side.', 'note');
    }).catch(function (e) { say(e.message, 'error'); busy(b, false); });
  });
});
`;
}

/* ------------------------------------------------------------------ */

function trustBody() {
  /* Read, not remembered — and not lifted out of the plan's feature text,
     which now carries a placeholder for exactly this number. */
  const total = counts().total.toLocaleString('en-GB');
  const row = (k, v) => '<tr><th scope="row">' + k + '</th><td>' + v + '</td></tr>';
  return '<article class="trust">\n' +
    '  <p class="eyebrow">Trust</p>\n' +
    '  <h1>Security, privacy and compliance</h1>\n' +
    '  <p class="lede">What runs where, what we hold, who else touches it, and how to exercise your rights. Written to be checked, not to reassure.</p>\n' +
    '  <section class="panel"><h2>Two kinds of tool</h2>' +
    '<p><strong>On your device.</strong> ' + total + ' tools that run entirely in your browser: PDF, image, QR, text, calculators, converters, the Tally converter. Nothing you put into them is transmitted, stored or seen by us. No account is needed and none is created. They work with the network off.</p>' +
    '<p><strong>In the cloud.</strong> The <a href="/ai/">AI tools</a>, which need a language model on a server. Each page states above the button exactly what it will send; files are read on your device so that only their text goes; personal identifiers are masked on the device before sending and restored in the answer; and neither what you send nor what comes back is stored by us. An account is needed only for these and for settings you want on more than one device.</p></section>\n' +
    '  <section class="panel"><h2>What we hold, if you have an account</h2><div class="table-scroll"><table class="biz-table trust-table"><tbody>' +
    row('Email address', 'to sign you in and to reach you about your account') +
    row('Plan, status, period dates', 'so the tools know what you are entitled to') +
    row('Payment references', 'a subscription id and, for Stripe, a customer id — never card or bank details, which we never receive') +
    row('AI usage count, per month', 'to enforce the monthly allowance; pruned after 13 months') +
    row('Saved tool settings', 'only if you choose to save them, e.g. a Tally column mapping') +
    row('Credits in hand', 'the balance of any credits bought outright, and one row per payment so the same money cannot be credited twice') +
    row('Webhook records from payment providers', 'for reconciliation and disputes; pruned after 13 months') +
    row('AI inputs and outputs', '<strong>not stored.</strong> We count that a call happened; the text is not kept') +
    '</tbody></table></div><p class="acct-hint">All of it is downloadable from your <a href="/account/">account page</a> as one file, and deletable there in one step.</p></section>\n' +
    '  <section class="panel"><h2>Who else touches your data</h2><div class="table-scroll"><table class="biz-table trust-table"><thead><tr><th>Processor</th><th>What for</th><th>Where</th></tr></thead><tbody>' +
    '<tr><td>Google Cloud (Firebase)</td><td>Sign-in, the account database, the functions that run the gateway and the payment webhooks</td><td>Mumbai (asia-south1) for data and functions; Firebase Authentication is a global Google service</td></tr>' +
    '<tr><td>Anthropic</td><td>The language model behind the AI tools, via our own server; receives the (masked) text you send</td><td>United States. API data is not used to train models under Anthropic’s terms and is retained by them only briefly for abuse prevention</td></tr>' +
    '<tr><td>Razorpay</td><td>Payments in India; you pay on their page</td><td>India</td></tr>' +
    '<tr><td>Stripe</td><td>Payments in the UK and elsewhere; you pay on their page; billing portal</td><td>Stripe Payments UK Ltd, with processing in the EU and US under their safeguards</td></tr>' +
    '<tr><td>GitHub Pages</td><td>Serves the site’s static pages</td><td>Global CDN</td></tr>' +
    '<tr><td>Google Analytics, Microsoft Clarity</td><td>Page-view statistics, <strong>only if you allow them</strong> in the cookie prompt; never anything you type into a tool</td><td>Global</td></tr>' +
    '</tbody></table></div><p class="acct-hint">A data processing agreement covering these sub-processors is available on request from the contact page.</p></section>\n' +
    '  <section class="panel"><h2>How it is protected</h2><ul class="tips">' +
    '<li>Everything travels over TLS. The site is static; there is no server that can be logged into, and no place a tool’s input could be written to.</li>' +
    '<li>The database rules allow a browser to read its own record and write its own saved settings, and nothing else. Plans are written only by our functions after a payment provider has spoken through a signed webhook — every webhook signature is verified, and a replayed event is ignored.</li>' +
    '<li>API keys for the model and the payment providers live in Google Secret Manager and are read by the functions at run time; no key is ever sent to a browser.</li>' +
    '<li>The AI tools mask personal identifiers on your device before sending, show you what was masked, and restore it in the answer. The model sees structure, not people.</li>' +
    '<li>Card and bank details are entered on Razorpay’s or Stripe’s pages and never pass through us.</li>' +
    '<li>If a breach ever affected personal data we hold, we would tell affected people and the ICO within 72 hours of knowing.</li></ul></section>\n' +
    '  <section class="panel"><h2>Your rights, and how to use them</h2>' +
    '<p>1234Tools is operated by <strong>MVR IT Services LTD</strong>, a company registered in England and Wales (no. 10251131), which is the data controller. UK GDPR and the EU GDPR apply to people in the UK and EU; India’s Digital Personal Data Protection Act 2023 applies to people in India. Under all three you can:</p><ul class="tips">' +
    '<li><strong>Access and take away</strong> what we hold — the <em>Download my data</em> button on your account page gives you all of it, as JSON, immediately.</li>' +
    '<li><strong>Erase</strong> it — <em>Delete my account</em> does so immediately and irreversibly, cancelling any subscription first.</li>' +
    '<li><strong>Correct</strong> it — your email is set by your sign-in provider; anything else, write to us.</li>' +
    '<li><strong>Object or withdraw consent</strong> — analytics can be refused or withdrawn in the cookie prompt at any time; the AI tools send nothing unless you press the button.</li>' +
    '<li><strong>Complain</strong> — to us first, via the <a href="/contact/">contact page</a>, and to the <a href="https://ico.org.uk/make-a-complaint/">Information Commissioner’s Office</a> in the UK, your local supervisory authority in the EU, or the Data Protection Board of India.</li></ul>' +
    '<p>Requests that need a person are answered within 30 days, usually much sooner.</p></section>\n' +
    '  <section class="panel"><h2>Retention, in one place</h2><ul class="tips"><li>Account record and saved settings: until you delete the account.</li><li>AI usage counts: 13 months.</li><li>Payment webhook records: 13 months.</li><li>AI inputs and outputs: not retained.</li><li>Server logs: Google Cloud’s default of 30 days; they record that a function ran, not what was sent to it.</li></ul></section>\n' +
    '</article>\n';
}

/* ------------------------------------------------------------------ */

function main() {
  const parts = shell();
  const pages = [
    { slug: 'pricing', title: 'Plans and pricing — 1234Tools', description: 'Every tool that runs in your browser is free with no account. Pro and Business pay for what needs a server: AI calls and settings that follow you between devices. Rupees through Razorpay, pounds through Stripe.', body: pricingBody(), name: 'Pricing' },
    { slug: 'account', title: 'Your account — 1234Tools', description: 'Sign in to 1234Tools to use the AI tools and keep saved settings across devices. Nothing else on the site needs an account.', body: accountBody(), name: 'Account' },
    /* the trust page is public and indexable from the start: it is the part people search for before they sign up */
    { slug: 'trust', title: 'Security, privacy and compliance — 1234Tools', description: 'What runs on your device and what runs in the cloud, what 1234Tools holds about an account, every sub-processor and where it is, how the AI tools mask personal data, and how to exercise your GDPR and DPDP rights.', body: trustBody(), name: 'Trust & security', indexable: true, noAccount: true }
  ];
  let built = 0;
  for (const p of pages) {
    const pathOnly = '/' + p.slug + '/';
    let html = headFor(parts, p.slug, p.title, p.description) + parts.mid + '\n' + crumbs.render(trailFor(pathOnly), p.name) + '\n' + p.body + parts.tail;
    if (p.indexable) html = html.replace('<meta name="robots" content="noindex,nofollow">\n', '');
    if (p.noAccount) html = html.replace('<script src="/assets/firebase-config.js"></script>\n<script src="/assets/account.js" defer></script>\n', '');
    html = outbound.rewrite(html, p.slug).html;
    if (write(p.slug + '/index.html', html)) built++;
  }
  /* indexable pages belong in the sitemap; the dark ones stay out of it */
  const smRel = 'sitemap-1.xml';
  const sm = fs.readFileSync(path.join(ROOT, smRel), 'utf8');
  const add = pages.filter(p => p.indexable && sm.indexOf('<loc>' + SITE + '/' + p.slug + '/</loc>') < 0)
    .map(p => '<url><loc>' + SITE + '/' + p.slug + '/</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>');
  if (add.length) write(smRel, sm.replace('</urlset>', add.join('\n') + '\n</urlset>'));
  console.log('\nbuild-account.js' + (CHECK ? '  (--check: nothing will be written)' : '') + (LIVE ? '  (--live: indexable)' : '  (dark: noindex, unlinked)'));
  console.log('  pages               ' + pages.map(p => '/' + p.slug + '/').join(', '));
  console.log('  written             ' + built);
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
