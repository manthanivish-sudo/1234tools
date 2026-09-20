/**
 * /settings/ — the page where the answers are given once.
 *
 * Every field here is read by tools all over the site through
 * assets/prefs.js. The page itself is static: the current values are
 * painted in by script on load, because they live on the reader's device
 * and not in the HTML we serve everybody.
 *
 * It does not load the account library. A person who clicks "change the
 * currency" from a loan calculator should not have Firebase arrive with
 * it; the sign-in panel fetches that library only when somebody actually
 * asks for their preferences to follow them to another machine.
 */
'use strict';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Mirrors assets/prefs.js. The page is generated, so the two are checked
   against each other at build time rather than trusted to stay in step. */
const ORDER = ['currency', 'grouping', 'moneyDecimals', 'dateFormat', 'paper', 'weekStart', 'units', 'taxRegion'];

const GROUPS = [
  {
    name: 'Money',
    blurb: 'Used by every calculator, invoice, payslip and set of books on the site.',
    keys: ['currency', 'grouping', 'moneyDecimals']
  },
  {
    name: 'Dates and the week',
    blurb: 'How a date is written back to you, and which column a calendar starts in.',
    keys: ['dateFormat', 'weekStart']
  },
  {
    name: 'Documents and measurements',
    blurb: 'What the PDF tools reach for, and which units the converters open on.',
    keys: ['paper', 'units']
  },
  {
    name: 'Your books',
    blurb: 'The starting point for the bookkeeping and tax tools.',
    keys: ['taxRegion']
  }
];

function readOptions(fs, path, root) {
  /* The single source of truth is the script the browser runs. Parsing it
     here means a preference cannot exist on the page and not in the store,
     or the other way round. */
  const src = fs.readFileSync(path.join(root, 'assets/prefs.js'), 'utf8');
  const box = {};
  const win = {
    addEventListener() {}, dispatchEvent() {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  };
  const CustomEventShim = function () {};
  new Function('window', 'CustomEvent', src)(win, CustomEventShim);
  box.OPTIONS = win.Prefs.OPTIONS;
  box.DEFAULTS = win.Prefs.DEFAULTS;
  const missing = ORDER.filter(k => !box.OPTIONS[k]);
  const extra = Object.keys(box.OPTIONS).filter(k => ORDER.indexOf(k) < 0);
  if (missing.length || extra.length) {
    throw new Error('the settings page and assets/prefs.js disagree: missing ' + (missing.join(', ') || 'none') + ', not shown ' + (extra.join(', ') || 'none'));
  }
  return box;
}

function field(key, opt, def) {
  const id = 'pref-' + key;
  return '<div class="field">' +
    '<label for="' + id + '">' + esc(opt.label) + '</label>' +
    '<select class="control" id="' + id + '" data-pref="' + key + '">' +
    opt.values.map(v => '<option value="' + esc(v[0]) + '"' + (v[0] === def ? ' selected' : '') + '>' + esc(v[1]) + '</option>').join('') +
    '</select>' +
    (opt.hint ? '<span class="field-hint">' + esc(opt.hint) + '</span>' : '') +
    '</div>';
}

function body(fs, path, root, locked) {
  const { OPTIONS, DEFAULTS } = readOptions(fs, path, root);

  const groups = GROUPS.map(g =>
    '  <section class="panel pref-group">\n' +
    '    <h2>' + esc(g.name) + '</h2>\n' +
    '    <p class="pref-blurb">' + esc(g.blurb) + '</p>\n' +
    '    <div class="pref-fields">' + g.keys.map(k => field(k, OPTIONS[k], DEFAULTS[k])).join('') + '</div>\n' +
    '  </section>\n').join('');

  /* Naming the tools that will not follow is the whole difference between
     a preference and a promise we quietly break. */
  const lockedList = locked.length
    ? '  <section class="panel">\n' +
      '    <h2>Where this will not apply</h2>\n' +
      '    <p>' + locked.length + ' tools keep their own currency, because in those the currency is part of the rule and not a label on it: Indian income tax is written in rupees, UK National Insurance in pounds, and converting the symbol would leave the arithmetic saying something untrue. Each of them says so under its own results.</p>\n' +
      '    <ul class="pref-locked">' + locked.map(t => '<li><a href="' + t.url + '">' + esc(t.title) + '</a> <span class="pref-why">' + esc(t.why) + '</span></li>').join('') + '</ul>\n' +
      '  </section>\n'
    : '';

  return '<article class="prefs">\n' +
    '  <p class="eyebrow">Settings</p>\n' +
    '  <h1>Set it once, and every tool follows</h1>\n' +
    '  <p class="lede">Which currency, how digits are grouped, how a date is written, which paper your printer holds. Answer here and the tools stop asking. Nothing on this page needs an account, and nothing on it leaves your device unless you ask for it to.</p>\n' +
    '  <div class="io-msg" id="pref-msg"></div>\n' +
    '  <section class="panel pref-preview" id="pref-preview">\n' +
    '    <h2>What that looks like</h2>\n' +
    '    <dl class="pref-sample">' +
    '<div><dt>A large amount</dt><dd id="s-money">—</dd></div>' +
    '<div><dt>A small one</dt><dd id="s-small">—</dd></div>' +
    '<div><dt>A plain number</dt><dd id="s-num">—</dd></div>' +
    '<div><dt>A date</dt><dd id="s-date">—</dd></div>' +
    '<div><dt>Paper</dt><dd id="s-paper">—</dd></div>' +
    '<div><dt>The week starts</dt><dd id="s-week">—</dd></div>' +
    '</dl>\n' +
    '  </section>\n' +
    groups +
    '  <section class="panel">\n' +
    '    <h2>Where these are kept</h2>\n' +
    '    <p>On this device, in this browser, and nowhere else. They are not sent anywhere, they are not part of any account, and clearing your browser data removes them. A different browser, or the same browser on your phone, starts fresh.</p>\n' +
    '    <div class="pref-sync" id="pref-sync">\n' +
    '      <p id="pref-sync-state">If you have an account, these can follow you to another machine instead.</p>\n' +
    '      <div class="io-actions"><button type="button" class="btn-ghost" id="pref-sync-on">Keep them with my account</button><button type="button" class="btn-ghost" id="pref-reset">Back to the defaults</button></div>\n' +
    '      <p class="field-hint">Pressing the first button loads the sign-in library on this page — the only thing here that does. Until then nothing about you has been sent.</p>\n' +
    '    </div>\n' +
    '  </section>\n' +
    lockedList +
    '</article>\n';
}

function script() {
  /* Written as one string rather than a file because it is small, belongs
     to this page alone, and would otherwise be a third request. */
  return `document.addEventListener('DOMContentLoaded', function () {
  var P = window.Prefs;
  var msg = document.getElementById('pref-msg');
  function say(t, k) { msg.textContent = t || ''; msg.className = 'io-msg' + (k ? ' is-' + k : ''); }
  if (!P) { say('Preferences could not load on this page, so nothing here will save. Everything else on the site still works.', 'error'); return; }

  var selects = [].slice.call(document.querySelectorAll('[data-pref]'));
  function paintFields() { selects.forEach(function (s) { s.value = P.get(s.dataset.pref); }); }

  /* A sample big enough to show grouping, and odd enough to show rounding. */
  function paintPreview() {
    var d = new Date(2026, 2, 31);
    document.getElementById('s-money').textContent = P.money(1234567.891);
    document.getElementById('s-small').textContent = P.money(49.5);
    document.getElementById('s-num').textContent = P.number(9876543.21, 2);
    document.getElementById('s-date').textContent = P.date(d);
    document.getElementById('s-paper').textContent = P.paper();
    document.getElementById('s-week').textContent = P.weekStart() === 'sun' ? 'Sunday' : 'Monday';
  }

  selects.forEach(function (s) {
    s.addEventListener('change', function () {
      P.set(s.dataset.pref, s.value);
      paintPreview();
      say('Saved on this device.', 'note');
      push();
    });
  });
  P.onChange(function () { paintFields(); paintPreview(); });
  paintFields(); paintPreview();

  document.getElementById('pref-reset').addEventListener('click', function () {
    P.reset(); paintFields(); paintPreview(); say('Back to the defaults.', 'note'); push();
  });

  /* ---- the copy that follows you, loaded only when asked ---- */
  var account = null, state = document.getElementById('pref-sync-state'), btn = document.getElementById('pref-sync-on');

  function load(src) {
    return new Promise(function (ok, no) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement('script'); s.src = src;
      s.onload = ok; s.onerror = function () { no(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function push() {
    if (!account || !account.user) return;
    window.Account.savePrefs(P.forSync()).catch(function () { /* saved locally either way */ });
  }

  btn.addEventListener('click', function () {
    btn.disabled = true; say('Loading the sign-in library\\u2026', 'note');
    load('/assets/firebase-config.js')
      .then(function () { return load('/assets/account.js'); })
      .then(function () {
        if (!window.Account || !window.Account.enabled) throw new Error('Accounts are not switched on yet. Your preferences are still saved on this device.');
        return window.Account.ready;
      })
      .then(function (s) {
        account = s;
        if (!s.user) { location.href = '/account/?next=' + encodeURIComponent('/settings/'); return; }
        return window.Account.loadPrefs().then(function (remote) {
          var took = remote && P.applyRemote(remote);
          if (took) { paintFields(); paintPreview(); say('Taken from your account \\u2014 that copy was newer than this one.', 'note'); }
          else { return window.Account.savePrefs(P.forSync()).then(function () { say('Kept with your account. Any machine you sign in on will use these.', 'note'); }); }
        }).then(function () {
          state.textContent = 'Signed in as ' + (s.user.email || 'your account') + '. These follow you now.';
          btn.hidden = true;
        });
      })
      .catch(function (e) { say(e.message || String(e), 'error'); })
      .then(function () { btn.disabled = false; });
  });

  /* Already signed in on this device? Say so without loading anything:
     the account library sets this flag when it has run on another page. */
  try {
    if (window.localStorage.getItem('1234tools.signedIn') === '1') {
      state.textContent = 'You have signed in on this device before. Press below to keep these preferences with that account.';
    }
  } catch (e) { /* no storage; the default wording is correct */ }
});
`;
}

module.exports = { body, script, ORDER, GROUPS };
