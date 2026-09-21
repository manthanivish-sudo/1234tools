/**
 * build-practice.js — the four pages of the practice product.
 *
 *   /practice/            the front door: sign in, then what you are
 *   /practice/clients/    a practice's clients, its staff, its invitations
 *   /practice/client/     one client: their paperwork, and adding to it
 *   /practice/join/       claiming an invitation
 *
 * They are static pages that fetch. Everything on them is drawn from the
 * London project at run time, because what a person may see is decided by
 * the Firestore rules against the login in front of them, not by anything
 * that could be baked in here.
 *
 * Dark for now — noindex, and nothing links to them — like /account/ was
 * until the accounts were real. The product is not launched; a login page
 * in the index serves nobody.
 *
 * These pages load assets/practice.js and assets/uk-config.js, and NOT
 * assets/account.js: the practice lives in a different Firebase project,
 * in London, and mixing the two libraries on one page would put a UK
 * practice's records a `initializeApp` away from the Mumbai one.
 *
 *   node build-practice.js [--check] [--live]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crumbs = require('./build-crumbs.js');
const { trailFor } = require('./build/sections.js');
const outbound = require('./build-outbound.js');
const prefs = require('./build-prefs.js');
const { apply: sidebarFor } = require('./build-sidebar.js');

const ROOT = __dirname;
const CHECK = process.argv.includes('--check');
const LIVE = process.argv.includes('--live');
const SITE = 'https://www.1234tools.com';

const changes = [];
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === content) return false;
  changes.push(rel);
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

function headFor(parts, urlPath, title, description) {
  const url = SITE + urlPath;
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
  if (!LIVE) h = h.replace('<link rel="canonical"', '<meta name="robots" content="noindex,nofollow">\n<link rel="canonical">'.replace('<link rel="canonical">', '<link rel="canonical"'));
  /* the London project, and only on these pages */
  return h.replace('</head>', '') + '<script src="/assets/uk-config.js"></script>\n<script src="/assets/practice.js" defer></script>\n';
}

/* ------------------------------------------------------------------ */
/* the shared furniture of a page that needs a login                  */
/* ------------------------------------------------------------------ */

const signInPanel = (what) =>
  '  <section class="panel prac-signin" id="prac-signin" hidden>\n' +
  '    <h2>Sign in</h2>\n' +
  '    <p class="acct-hint">' + esc(what) + '</p>\n' +
  '    <form id="prac-form" class="acct-form" novalidate>\n' +
  '      <div class="field"><label for="prac-email">Email</label><input class="control" id="prac-email" type="email" autocomplete="email" required></div>\n' +
  '      <div class="field"><label for="prac-password">Password</label><input class="control" id="prac-password" type="password" autocomplete="current-password" minlength="8" required><span class="field-hint">At least 8 characters</span></div>\n' +
  '      <div class="io-actions"><button type="submit" class="btn-primary" id="prac-signin-btn">Sign in</button><button type="button" class="btn-ghost" id="prac-signup-btn">Create an account</button><button type="button" class="btn-ghost" id="prac-reset-btn">Forgot password</button></div>\n' +
  '    </form>\n' +
  '    <p class="acct-privacy">This is a separate login from the rest of 1234Tools, and the data it reaches is held in London. <a href="/trust/">What we hold and where</a>.</p>\n' +
  '  </section>\n';

const offPanel =
  '  <section class="panel" id="prac-off" hidden><h2>Not switched on yet</h2>' +
  '<p>The practice product is being built. Every tool on the rest of the site works as usual and needs no account. <a href="/">Back to the tools</a>.</p></section>\n';

/* The script every page starts with: boot, decide what to show, and put a
   sentence on the screen when something goes wrong. */
const COMMON = `
  var $ = function (id) { return document.getElementById(id); };
  var msg = $('prac-msg');
  function say(t, k) { if (!msg) return; msg.textContent = t || ''; msg.className = 'io-msg' + (k ? ' is-' + k : ''); if (t) msg.scrollIntoView({ block: 'nearest' }); }
  function busy(b, on) { if (!b) return; b.disabled = !!on; b.dataset.was = b.dataset.was || b.textContent; b.textContent = on ? 'Working…' : b.dataset.was; }
  var P = window.Practice;
  var qs = new URLSearchParams(location.search);
  function show(id, on) { var el = $(id); if (el) el.hidden = !on; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function when(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return window.Prefs ? window.Prefs.date(d) : d.toLocaleDateString('en-GB');
  }
  function size(n) {
    n = Number(n) || 0;
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  }
  function wireSignIn() {
    var f = $('prac-form'); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault(); say(''); var b = $('prac-signin-btn'); busy(b, true);
      P.signIn($('prac-email').value, $('prac-password').value)
        .catch(function (err) { say(err.message, 'error'); })
        .then(function () { busy(b, false); });
    });
    $('prac-signup-btn').addEventListener('click', function () {
      say(''); var b = $('prac-signup-btn'); busy(b, true);
      P.signUp($('prac-email').value, $('prac-password').value)
        .catch(function (err) { say(err.message, 'error'); })
        .then(function () { busy(b, false); });
    });
    $('prac-reset-btn').addEventListener('click', function () {
      var em = $('prac-email').value;
      if (!em) { say('Type your email first, then press Forgot password.', 'note'); return; }
      P.resetPassword(em).then(function () { say('If there is an account for ' + em + ', a reset link is on its way.', 'note'); })
        .catch(function (err) { say(err.message, 'error'); });
    });
  }
`;

/* ------------------------------------------------------------------ */
/* /practice/ — the front door                                        */
/* ------------------------------------------------------------------ */

function frontBody() {
  return '<article class="practice">\n' +
    '  <p class="eyebrow">Practice</p>\n' +
    '  <h1>Your practice</h1>\n' +
    '  <p class="lede">A practice, its clients, and the paperwork each of them sends you — kept in London, and visible only to the people you have put inside it. A client sees their own folder and nothing else, not even the name of another client.</p>\n' +
    '  <div class="io-msg" id="prac-msg"></div>\n' +
    offPanel +
    signInPanel('One login for your practice. If somebody has sent you an invitation, sign in first and then open their link.') +
    '  <section class="prac-me" id="prac-me" hidden>\n' +
    '    <div class="acct-card">\n' +
    '      <div class="acct-who"><span class="acct-avatar" id="prac-avatar"></span><div><strong id="prac-email-out"></strong><span class="acct-plan" id="prac-kind"></span></div></div>\n' +
    '      <div class="io-actions"><button type="button" class="btn-ghost" id="prac-signout">Sign out</button></div>\n' +
    '    </div>\n' +
    '    <section class="panel" id="prac-list-panel" hidden><h2>Practices you are in</h2><ul class="prac-list" id="prac-list"></ul></section>\n' +
    '    <section class="panel" id="prac-client-panel" hidden><h2>Your folder</h2><p id="prac-client-line"></p>' +
    '<div class="io-actions"><a class="btn-primary" id="prac-client-link" href="#">Open your documents</a></div></section>\n' +
    '    <section class="panel" id="prac-start-panel" hidden>\n' +
    '      <h2>Start a practice</h2>\n' +
    '      <p class="acct-hint">For the firm that acts for the clients. If you are the client, you do not start one — ask your accountant for an invitation.</p>\n' +
    '      <form id="prac-start" class="acct-form" novalidate>\n' +
    '        <div class="field"><label for="prac-name">Practice name</label><input class="control" id="prac-name" type="text" maxlength="120" required placeholder="Hale &amp; Partners"></div>\n' +
    '        <div class="field"><label for="prac-country">Where you practise</label><select class="control" id="prac-country"><option value="GB">United Kingdom</option><option value="IN">India</option></select></div>\n' +
    '        <div class="io-actions"><button type="submit" class="btn-primary" id="prac-start-btn">Start it</button></div>\n' +
    '      </form>\n' +
    '    </section>\n' +
    '  </section>\n' +
    '</article>\n' +
    '<script>\n' + frontScript() + '</script>\n';
}

function frontScript() {
  return `document.addEventListener('DOMContentLoaded', function () {${COMMON}
  if (!P || !P.enabled) { show('prac-off', true); return; }
  wireSignIn();

  function paint(s) {
    show('prac-signin', !s.user);
    show('prac-me', !!s.user);
    if (!s.user) return;
    $('prac-email-out').textContent = s.user.email || '(no email)';
    $('prac-avatar').textContent = (s.user.email || '?').charAt(0).toUpperCase();
    var me = s.me || { kind: 'none' };
    $('prac-kind').textContent = me.kind === 'client' ? 'Client' : me.kind === 'staff' ? 'Practice' : 'No practice yet';
    $('prac-kind').className = 'acct-plan is-' + (me.kind === 'none' ? 'free' : 'pro');

    show('prac-list-panel', me.kind === 'staff');
    show('prac-client-panel', me.kind === 'client');
    show('prac-start-panel', me.kind === 'none');

    if (me.kind === 'staff') {
      $('prac-list').innerHTML = (me.practices || []).map(function (p) {
        return '<li><a href="/practice/clients/?p=' + encodeURIComponent(p.practiceId) + '">' + esc(p.name || 'Practice') + '</a>' +
               '<span class="prac-role">' + esc(p.role) + '</span></li>';
      }).join('') || '<li class="acct-empty">None yet.</li>';
    }
    if (me.kind === 'client') {
      $('prac-client-line').textContent = (me.clientName || 'Your business') + ', looked after by ' + (me.practiceName || 'your accountant') + '.';
      $('prac-client-link').href = '/practice/client/?p=' + encodeURIComponent(me.practiceId) + '&c=' + encodeURIComponent(me.clientId);
    }
  }

  P.onChange(paint);
  P.ready.then(paint);

  $('prac-signout').addEventListener('click', function () { P.signOut().then(function () { say('Signed out.', 'note'); }); });
  $('prac-start').addEventListener('submit', function (e) {
    e.preventDefault(); say(''); var b = $('prac-start-btn'); busy(b, true);
    P.createPractice({ name: $('prac-name').value, country: $('prac-country').value })
      .then(function (r) { location.href = '/practice/clients/?p=' + encodeURIComponent(r.practiceId); })
      .catch(function (err) { say(err.message, 'error'); busy(b, false); });
  });
});
`;
}

/* ------------------------------------------------------------------ */
/* /practice/clients/ — one practice                                  */
/* ------------------------------------------------------------------ */

function clientsBody() {
  return '<article class="practice">\n' +
    '  <p class="eyebrow"><a href="/practice/">Practice</a></p>\n' +
    '  <h1 id="prac-title">Clients</h1>\n' +
    '  <p class="lede" id="prac-sub">The businesses this practice acts for.</p>\n' +
    '  <div class="io-msg" id="prac-msg"></div>\n' +
    offPanel +
    signInPanel('Sign in to reach this practice.') +
    '  <div id="prac-main" hidden>\n' +
    '    <section class="panel"><h2>Clients</h2><ul class="prac-list" id="prac-clients"><li class="acct-empty">Loading…</li></ul></section>\n' +
    '    <section class="panel">\n' +
    '      <h2>Take on a client</h2>\n' +
    '      <form id="prac-add" class="acct-form" novalidate>\n' +
    '        <div class="field"><label for="c-name">Business name</label><input class="control" id="c-name" type="text" maxlength="160" required placeholder="Acme Trading Ltd"></div>\n' +
    '        <div class="field"><label for="c-ref">Your reference <span class="ask-opt">(optional)</span></label><input class="control" id="c-ref" type="text" maxlength="60" placeholder="ACM01"></div>\n' +
    '        <div class="field"><label for="c-country">Country</label><select class="control" id="c-country"><option value="GB">United Kingdom</option><option value="IN">India</option></select></div>\n' +
    '        <div class="field"><label for="c-year">Year end <span class="ask-opt">(optional)</span></label><input class="control" id="c-year" type="text" maxlength="10" placeholder="31 March"></div>\n' +
    '        <div class="io-actions"><button type="submit" class="btn-primary" id="c-add-btn">Add the client</button></div>\n' +
    '      </form>\n' +
    '    </section>\n' +
    '    <section class="panel" id="prac-staff-panel">\n' +
    '      <h2>Who is in the practice</h2>\n' +
    '      <ul class="prac-list" id="prac-members"></ul>\n' +
    '      <form id="prac-invite" class="acct-form" novalidate>\n' +
    '        <div class="field"><label for="m-email">Invite a colleague</label><input class="control" id="m-email" type="email" maxlength="200" placeholder="colleague@firm.co.uk"></div>\n' +
    '        <div class="field"><label for="m-role">As</label><select class="control" id="m-role"><option value="staff">Staff — sees every client</option><option value="owner">Owner — can also invite and remove</option></select></div>\n' +
    '        <div class="io-actions"><button type="submit" class="btn-ghost" id="m-invite-btn">Make an invitation</button></div>\n' +
    '      </form>\n' +
    '      <div class="prac-link" id="m-link" hidden><p class="acct-hint">Send them this link. It only works for the address you typed, and it expires in 14 days.</p><input class="control" id="m-link-url" readonly></div>\n' +
    '    </section>\n' +
    '  </div>\n' +
    '</article>\n' +
    '<script>\n' + clientsScript() + '</script>\n';
}

function clientsScript() {
  return `document.addEventListener('DOMContentLoaded', function () {${COMMON}
  if (!P || !P.enabled) { show('prac-off', true); return; }
  wireSignIn();
  var pid = qs.get('p') || '';
  if (!pid) { say('This page needs to know which practice. Open it from your practice list.', 'error'); return; }

  function draw(list) {
    $('prac-clients').innerHTML = list.length ? list.map(function (c) {
      return '<li><a href="/practice/client/?p=' + encodeURIComponent(pid) + '&c=' + encodeURIComponent(c.id) + '">' + esc(c.name || c.id) + '</a>' +
             (c.reference ? '<span class="prac-role">' + esc(c.reference) + '</span>' : '') + '</li>';
    }).join('') : '<li class="acct-empty">No clients yet. Add the first one below.</li>';
  }

  function load() {
    P.listClients(pid).then(draw).catch(function (e) { say(e.message, 'error'); });
    P.listMembers(pid).then(function (m) {
      $('prac-members').innerHTML = m.map(function (x) {
        return '<li><span>' + esc(x.name || x.email || x.uid) + '</span><span class="prac-role">' + esc(x.role) + '</span></li>';
      }).join('');
    }).catch(function () { /* staff list is not essential to the page */ });
  }

  function paint(s) {
    show('prac-signin', !s.user);
    show('prac-main', !!s.user);
    if (!s.user) return;
    var me = s.me || {};
    if (me.kind === 'client') { location.href = '/practice/client/?p=' + encodeURIComponent(me.practiceId) + '&c=' + encodeURIComponent(me.clientId); return; }
    var mine = (me.practices || []).filter(function (p) { return p.practiceId === pid; })[0];
    if (!mine) { say('You are not a member of that practice. If you were expecting to be, ask for an invitation.', 'error'); show('prac-main', false); return; }
    $('prac-title').textContent = mine.name || 'Clients';
    $('prac-sub').textContent = 'The businesses this practice acts for. You are ' + (mine.role === 'owner' ? 'an owner' : 'staff') + '.';
    show('prac-staff-panel', true);
    $('prac-invite').hidden = mine.role !== 'owner';
    load();
  }
  P.onChange(paint);
  P.ready.then(paint);

  $('prac-add').addEventListener('submit', function (e) {
    e.preventDefault(); say(''); var b = $('c-add-btn'); busy(b, true);
    P.saveClient(pid, null, { name: $('c-name').value, reference: $('c-ref').value, country: $('c-country').value, yearEnd: $('c-year').value })
      .then(function () { $('prac-add').reset(); say('Client added.', 'note'); load(); })
      .catch(function (err) { say(err.message, 'error'); })
      .then(function () { busy(b, false); });
  });

  $('prac-invite').addEventListener('submit', function (e) {
    e.preventDefault(); say(''); var b = $('m-invite-btn'); busy(b, true);
    P.inviteMember({ practiceId: pid, email: $('m-email').value, role: $('m-role').value })
      .then(function (r) {
        $('m-link-url').value = location.origin + '/practice/join/?code=' + r.code;
        show('m-link', true);
        $('m-link-url').select();
        say('Invitation made for ' + r.email + '. Copy the link below and send it to them.', 'note');
      })
      .catch(function (err) { say(err.message, 'error'); })
      .then(function () { busy(b, false); });
  });
});
`;
}

/* ------------------------------------------------------------------ */
/* /practice/client/ — one client's paperwork                         */
/* ------------------------------------------------------------------ */

function clientBody() {
  return '<article class="practice">\n' +
    '  <p class="eyebrow"><a href="/practice/">Practice</a></p>\n' +
    '  <h1 id="prac-title">Documents</h1>\n' +
    '  <p class="lede" id="prac-sub">Invoices, receipts, bills and statements, kept where your accountant can reach them.</p>\n' +
    '  <div class="io-msg" id="prac-msg"></div>\n' +
    offPanel +
    signInPanel('Sign in to reach this client.') +
    '  <div id="prac-main" hidden>\n' +
    '    <section class="panel">\n' +
    '      <h2>Send a document</h2>\n' +
    '      <p class="acct-hint">PDFs, photographs, CSV and Excel files, up to 25 MB each. The file goes from this device straight to the London store; it does not pass through anything else on the way.</p>\n' +
    '      <form id="prac-up" class="acct-form" novalidate>\n' +
    '        <div class="field"><label for="d-file">File</label><input class="control" id="d-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.csv,.xlsx,.xls" required></div>\n' +
    '        <div class="field"><label for="d-kind">What is it</label><select class="control" id="d-kind"><option value="invoice">Sales invoice</option><option value="receipt">Receipt</option><option value="bill">Purchase bill</option><option value="statement">Bank statement</option><option value="other" selected>Something else</option></select></div>\n' +
    '        <div class="field"><label for="d-note">A note for your accountant <span class="ask-opt">(optional)</span></label><input class="control" id="d-note" type="text" maxlength="300" placeholder="Paid by card, 3 March"></div>\n' +
    '        <div class="io-actions"><button type="submit" class="btn-primary" id="d-up-btn">Send it</button></div>\n' +
    '      </form>\n' +
    '    </section>\n' +
    '    <section class="panel"><h2>What is here</h2><div class="table-scroll"><table class="biz-table"><thead><tr><th>Document</th><th>What</th><th>Size</th><th>Sent</th><th></th></tr></thead><tbody id="prac-docs"><tr><td colspan="5">Loading…</td></tr></tbody></table></div></section>\n' +
    '    <section class="panel" id="prac-invite-panel" hidden>\n' +
    '      <h2>Let the client send their own</h2>\n' +
    '      <p class="acct-hint">An invitation makes a login that sees this folder and nothing else — not your other clients, and not the books.</p>\n' +
    '      <form id="prac-cinvite" class="acct-form" novalidate>\n' +
    '        <div class="field"><label for="ci-email">Their email</label><input class="control" id="ci-email" type="email" maxlength="200" placeholder="books@acme.co.uk"></div>\n' +
    '        <div class="io-actions"><button type="submit" class="btn-ghost" id="ci-btn">Make an invitation</button></div>\n' +
    '      </form>\n' +
    '      <div class="prac-link" id="ci-link" hidden><p class="acct-hint">Send them this link. It only works for the address you typed, and it expires in 14 days.</p><input class="control" id="ci-link-url" readonly></div>\n' +
    '    </section>\n' +
    '  </div>\n' +
    '</article>\n' +
    '<script>\n' + clientScript() + '</script>\n';
}

function clientScript() {
  return `document.addEventListener('DOMContentLoaded', function () {${COMMON}
  if (!P || !P.enabled) { show('prac-off', true); return; }
  wireSignIn();
  var pid = qs.get('p') || '', cid = qs.get('c') || '';
  var staff = false;
  if (!pid || !cid) { say('This page needs to know which client. Open it from your client list.', 'error'); return; }

  var KIND = { invoice: 'Sales invoice', receipt: 'Receipt', bill: 'Purchase bill', statement: 'Bank statement', other: 'Other' };

  function load() {
    P.listDocuments(pid, cid).then(function (list) {
      $('prac-docs').innerHTML = list.length ? list.map(function (d) {
        return '<tr><td><a href="#" data-open="' + esc(d.path) + '">' + esc(d.name) + '</a>' +
          (d.note ? '<br><span class="prac-note">' + esc(d.note) + '</span>' : '') + '</td>' +
          '<td>' + esc(KIND[d.kind] || 'Other') + '</td><td>' + size(d.size) + '</td><td>' + esc(when(d.uploadedAt)) + '</td>' +
          '<td>' + (staff ? '<button type="button" class="btn-ghost prac-del" data-id="' + esc(d.id) + '" data-path="' + esc(d.path) + '">Remove</button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="5">Nothing here yet.</td></tr>';
    }).catch(function (e) { say(e.message, 'error'); });
  }

  function paint(s) {
    show('prac-signin', !s.user);
    show('prac-main', !!s.user);
    if (!s.user) return;
    var me = s.me || {};
    staff = me.kind === 'staff' && (me.practices || []).some(function (p) { return p.practiceId === pid; });
    var isTheClient = me.kind === 'client' && me.practiceId === pid && me.clientId === cid;
    if (!staff && !isTheClient) { say('This client is not one you have access to.', 'error'); show('prac-main', false); return; }
    show('prac-invite-panel', staff);
    if (isTheClient) { $('prac-title').textContent = me.clientName || 'Your documents'; }
    else {
      P.getClient(pid, cid).then(function (c) { if (c) $('prac-title').textContent = c.name || 'Documents'; }).catch(function () { /* the title is not the point of the page */ });
    }
    load();
  }
  P.onChange(paint);
  P.ready.then(paint);

  $('prac-up').addEventListener('submit', function (e) {
    e.preventDefault(); say(''); var b = $('d-up-btn'); busy(b, true);
    var f = $('d-file').files[0];
    P.uploadDocument(pid, cid, f, { kind: $('d-kind').value, note: $('d-note').value })
      .then(function () { $('prac-up').reset(); say('Sent. Your accountant can see it now.', 'note'); load(); })
      .catch(function (err) { say(err.message, 'error'); })
      .then(function () { busy(b, false); });
  });

  $('prac-docs').addEventListener('click', function (e) {
    var open = e.target.closest('[data-open]');
    if (open) {
      e.preventDefault();
      P.documentUrl(open.dataset.open).then(function (u) { window.open(u, '_blank', 'noopener'); })
        .catch(function (err) { say(err.message, 'error'); });
      return;
    }
    var del = e.target.closest('.prac-del');
    if (del) {
      if (!confirm('Remove this document? The file goes with it.')) return;
      P.deleteDocument(pid, cid, del.dataset.id, del.dataset.path)
        .then(function () { say('Removed.', 'note'); load(); })
        .catch(function (err) { say(err.message, 'error'); });
    }
  });

  $('prac-cinvite').addEventListener('submit', function (e) {
    e.preventDefault(); say(''); var b = $('ci-btn'); busy(b, true);
    P.inviteClient({ practiceId: pid, clientId: cid, email: $('ci-email').value })
      .then(function (r) {
        $('ci-link-url').value = location.origin + '/practice/join/?code=' + r.code;
        show('ci-link', true); $('ci-link-url').select();
        say('Invitation made for ' + r.email + '. Copy the link below and send it to them.', 'note');
      })
      .catch(function (err) { say(err.message, 'error'); })
      .then(function () { busy(b, false); });
  });
});
`;
}

/* ------------------------------------------------------------------ */
/* /practice/join/ — claiming an invitation                           */
/* ------------------------------------------------------------------ */

function joinBody() {
  return '<article class="practice">\n' +
    '  <p class="eyebrow">Practice</p>\n' +
    '  <h1>An invitation</h1>\n' +
    '  <p class="lede" id="prac-sub">Somebody has asked you to join them. Sign in with the address they sent it to, and it is done.</p>\n' +
    '  <div class="io-msg" id="prac-msg"></div>\n' +
    offPanel +
    signInPanel('Sign in with the address the invitation was sent to — it will not work with any other.') +
    '  <section class="panel" id="prac-claim" hidden>\n' +
    '    <h2 id="claim-head">Accept</h2>\n' +
    '    <p id="claim-line"></p>\n' +
    '    <div class="io-actions"><button type="button" class="btn-primary" id="claim-btn">Accept the invitation</button><button type="button" class="btn-ghost" id="prac-signout">Sign in as somebody else</button></div>\n' +
    '  </section>\n' +
    '  <section class="panel" id="prac-done" hidden><h2>Done</h2><p id="done-line"></p><div class="io-actions"><a class="btn-primary" id="done-link" href="/practice/">Carry on</a></div></section>\n' +
    '</article>\n' +
    '<script>\n' + joinScript() + '</script>\n';
}

function joinScript() {
  return `document.addEventListener('DOMContentLoaded', function () {${COMMON}
  if (!P || !P.enabled) { show('prac-off', true); return; }
  wireSignIn();
  var code = qs.get('code') || '';
  if (!code) { say('That link is missing its code. Ask whoever invited you to send it again.', 'error'); return; }

  function paint(s) {
    show('prac-signin', !s.user);
    show('prac-claim', !!s.user);
    if (!s.user) return;
    $('claim-line').textContent = 'You are signed in as ' + (s.user.email || 'this account') + '. An invitation only works for the address it was sent to.';
  }
  P.onChange(paint);
  P.ready.then(paint);

  $('prac-signout').addEventListener('click', function () { P.signOut().then(function () { say('Signed out. Sign in with the invited address.', 'note'); }); });

  $('claim-btn').addEventListener('click', function () {
    say(''); var b = $('claim-btn'); busy(b, true);
    P.claimInvite(code).then(function (r) {
      show('prac-claim', false); show('prac-done', true);
      if (r.role === 'client') {
        $('done-line').textContent = 'You can now send documents to your accountant and see everything you have sent.';
        $('done-link').href = '/practice/client/?p=' + encodeURIComponent(r.practiceId) + '&c=' + encodeURIComponent(r.clientId);
        $('done-link').textContent = 'Open your folder';
      } else {
        $('done-line').textContent = 'You are now ' + (r.role === 'owner' ? 'an owner' : 'staff') + ' of the practice.';
        $('done-link').href = '/practice/clients/?p=' + encodeURIComponent(r.practiceId);
        $('done-link').textContent = 'Open the practice';
      }
    }).catch(function (err) { say(err.message, 'error'); busy(b, false); });
  });
});
`;
}

/* ------------------------------------------------------------------ */

function main() {
  const parts = shell();
  const pages = [
    { url: '/practice/', rel: 'practice/index.html', name: 'Practice', title: 'Your practice — 1234Tools', description: 'A practice, its clients, and the paperwork each of them sends. Held in London; a client sees their own folder and nothing else.', body: frontBody() },
    { url: '/practice/clients/', rel: 'practice/clients/index.html', name: 'Clients', title: 'Clients — 1234Tools', description: 'The businesses a practice acts for, the staff who can see them, and the invitations that let either in.', body: clientsBody() },
    { url: '/practice/client/', rel: 'practice/client/index.html', name: 'Client', title: 'Client documents — 1234Tools', description: 'One client\'s invoices, receipts, bills and statements, sent from the device they are on straight to a London store.', body: clientBody() },
    { url: '/practice/join/', rel: 'practice/join/index.html', name: 'Invitation', title: 'An invitation — 1234Tools', description: 'Accept an invitation to a practice, or to a client folder within one.', body: joinBody() }
  ];

  let built = 0;
  for (const p of pages) {
    let html = headFor(parts, p.url, p.title, p.description) + parts.mid + '\n' +
      crumbs.render(trailFor(p.url), p.name) + '\n' + p.body + parts.tail;
    html = prefs.apply(sidebarFor(outbound.rewrite(html, 'practice').html, p.rel));
    if (write(p.rel, html)) built++;
  }

  console.log('\nbuild-practice.js' + (CHECK ? '  (--check: nothing will be written)' : '') + (LIVE ? '  (--live: indexable)' : '  (dark: noindex, unlinked)'));
  console.log('  pages               ' + pages.map(p => p.url).join(', '));
  console.log('  written             ' + built);
  console.log('  project             mvr-1234tools-uk (London) via assets/uk-config.js');
  console.log('\n  ' + changes.length + ' file(s) ' + (CHECK ? 'would change' : 'changed') + '\n');
}

if (require.main === module) main();
/* exported so the page scripts can be parsed before a browser sees them:
   a syntax error in one of these strings is invisible to node --check */
module.exports = { main, frontScript, clientsScript, clientScript, joinScript };
