/**
 * Preferences: the things a person should only have to say once.
 *
 * A bookkeeper in Coimbatore wants ₹ and lakhs; an agent in Leeds wants £
 * and thousands; both want the date the way their bank writes it and the
 * paper size their printer actually holds. Until now every tool decided
 * for itself, so the same person answered the same question on every page.
 *
 * This holds the answers. It is small, has no dependencies, and loads
 * before the engines so a tool can read a preference while it renders
 * rather than asking again.
 *
 * WHERE THEY LIVE
 *   localStorage, under one key, on the device. That is the whole store for
 *   somebody with no account, which is most people here and deliberately
 *   so — a preference is not worth an email address.
 *
 *   Signed in, /settings/ also keeps a copy in Firestore so the same
 *   answers follow you to another machine. Only that page does it: it is
 *   the only page that loads the account library, because a tool page
 *   loading Firebase to find out you like rupees would be a poor trade.
 *
 * WHAT IT WILL NOT DO
 *   It will not change a number that comes from a statute. A tool that
 *   applies Indian income tax stays in rupees whatever this says, because
 *   the rupee is part of the rule, not a decoration on it. Those tools say
 *   so on the page instead of quietly ignoring you.
 */
(function () {
  'use strict';

  var KEY = '1234tools.prefs';
  var VERSION = 1;

  /* Every preference, its default, and what it is allowed to be. A value
     that is not in this list is dropped on read: a stale key from an older
     version, or something another script scribbled, must not reach a
     formatter and come out as text in the middle of somebody's invoice. */
  var OPTIONS = {
    currency: {
      label: 'Currency',
      hint: 'Used wherever the amount is just an amount. Tools that apply a country’s tax rules keep that country’s currency and say so.',
      values: [
        ['auto', 'Whatever the tool suggests'],
        ['INR', 'Indian rupee — ₹'],
        ['GBP', 'Pound sterling — £'],
        ['USD', 'US dollar — $'],
        ['EUR', 'Euro — €'],
        ['AED', 'UAE dirham — د.إ'],
        ['SGD', 'Singapore dollar — S$'],
        ['AUD', 'Australian dollar — A$'],
        ['CAD', 'Canadian dollar — C$'],
        ['ZAR', 'South African rand — R']
      ]
    },
    grouping: {
      label: 'Digit grouping',
      hint: 'Indian grouping puts the first break after three digits and every two after that, which is how a lakh is read.',
      values: [
        ['auto', 'Follow the currency'],
        ['in', 'Indian — 12,34,567.89'],
        ['intl', 'International — 1,234,567.89']
      ]
    },
    moneyDecimals: {
      label: 'Paise and pence',
      hint: 'Whole numbers are easier to scan on a long schedule; the arithmetic is unchanged either way, only what is shown.',
      values: [
        ['auto', 'Follow the tool'],
        ['2', 'Always show two decimals'],
        ['0', 'Round to whole units']
      ]
    },
    dateFormat: {
      label: 'Dates',
      values: [
        ['auto', 'Follow the currency’s country'],
        ['dmy', '31/03/2026'],
        ['mdy', '03/31/2026'],
        ['iso', '2026-03-31'],
        ['long', '31 March 2026']
      ]
    },
    paper: {
      label: 'Paper size',
      hint: 'What the PDF tools reach for first. A4 nearly everywhere; Letter in the United States and Canada.',
      values: [['A4', 'A4 — 210 × 297 mm'], ['Letter', 'Letter — 8.5 × 11 in'], ['Legal', 'Legal — 8.5 × 14 in']]
    },
    weekStart: {
      label: 'Week starts on',
      values: [['mon', 'Monday'], ['sun', 'Sunday']]
    },
    units: {
      label: 'Measurements',
      values: [['metric', 'Metric — kg, cm, km, °C'], ['imperial', 'Imperial — lb, in, miles, °F']]
    },
    taxRegion: {
      label: 'Where you do business',
      hint: 'Which set of books and which tax vocabulary the accounting tools open with. It changes the starting point, never the arithmetic.',
      values: [['auto', 'Ask me each time'], ['in', 'India — GST'], ['uk', 'United Kingdom — VAT']]
    }
  };

  var DEFAULTS = {
    currency: 'auto', grouping: 'auto', moneyDecimals: 'auto', dateFormat: 'auto',
    paper: 'A4', weekStart: 'mon', units: 'metric', taxRegion: 'auto'
  };

  /* localStorage throws in a locked-down browser and returns nothing in a
     private window. Neither is an error worth showing anybody: the site
     works on defaults, it just cannot remember. */
  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var box = JSON.parse(raw);
      if (!box || typeof box !== 'object') return null;
      return box;
    } catch (e) { return null; }
  }
  function write(box) {
    try { window.localStorage.setItem(KEY, JSON.stringify(box)); return true; }
    catch (e) { return false; }
  }

  function clean(values) {
    var out = {};
    for (var k in DEFAULTS) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULTS, k)) continue;
      var v = values && values[k];
      var allowed = OPTIONS[k].values.some(function (pair) { return pair[0] === v; });
      out[k] = allowed ? v : DEFAULTS[k];
    }
    return out;
  }

  var state = clean((read() || {}).values);
  var stamp = (read() || {}).updatedAt || 0;
  var listeners = [];

  function all() {
    var copy = {};
    for (var k in state) if (Object.prototype.hasOwnProperty.call(state, k)) copy[k] = state[k];
    return copy;
  }
  function get(k) { return Object.prototype.hasOwnProperty.call(state, k) ? state[k] : DEFAULTS[k]; }

  function announce(changed) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](all(), changed); } catch (e) { /* one bad listener must not stop the rest */ }
    }
    try { window.dispatchEvent(new CustomEvent('prefs:change', { detail: { prefs: all(), changed: changed } })); }
    catch (e) { /* very old browser: the callbacks above already ran */ }
  }

  function setAll(patch, opts) {
    var changed = [];
    for (var k in patch) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULTS, k)) continue;
      var v = patch[k];
      if (!OPTIONS[k].values.some(function (pair) { return pair[0] === v; })) continue;
      if (state[k] === v) continue;
      state[k] = v; changed.push(k);
    }
    if (!changed.length) return [];
    stamp = Date.now();
    write({ v: VERSION, values: all(), updatedAt: stamp });
    if (!(opts && opts.quiet)) announce(changed);
    return changed;
  }
  function set(k, v) { return setAll(defineOne(k, v)).length > 0; }
  function defineOne(k, v) { var o = {}; o[k] = v; return o; }

  function reset() {
    state = clean(null); stamp = Date.now();
    write({ v: VERSION, values: all(), updatedAt: stamp });
    announce(Object.keys(DEFAULTS));
  }

  /* ---------- what a tool actually asks ---------- */

  /* The tool's own suggestion wins only while the reader has not said
     otherwise, and a locked tool wins always. */
  function currency(suggested) {
    var c = get('currency');
    return c === 'auto' ? (suggested || 'GBP') : c;
  }

  var LOCALE_FOR = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', AED: 'en-AE', SGD: 'en-SG', AUD: 'en-AU', CAD: 'en-CA', ZAR: 'en-ZA', GBP: 'en-GB' };

  /* Grouping is its own question. Somebody may keep books in pounds and
     still read them in lakhs, and the currency alone cannot tell us.
     localeFor() takes a currency that is already settled; locale() settles
     it first. The difference matters for a tool whose currency is fixed by
     a statute: the rupee is part of the rule, the grouping is not, so a
     locked tool still groups the way the reader asked. */
  function localeFor(code) {
    var g = get('grouping');
    if (g === 'in') return 'en-IN';
    if (g === 'intl') return 'en-GB';
    return LOCALE_FOR[code] || 'en-GB';
  }
  function locale(suggested) { return localeFor(currency(suggested)); }

  function decimals(fallback) {
    var d = get('moneyDecimals');
    if (d === '0') return 0;
    if (d === '2') return 2;
    return typeof fallback === 'number' ? fallback : 2;
  }

  function money(v, opts) {
    opts = opts || {};
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    var code = opts.locked ? (opts.code || 'GBP') : currency(opts.code);
    var loc = localeFor(code);
    var dp = decimals(typeof opts.decimals === 'number' ? opts.decimals : 2);
    try {
      return v.toLocaleString(loc, { style: 'currency', currency: code, minimumFractionDigits: dp, maximumFractionDigits: dp });
    } catch (e) {
      /* an unknown code, or an engine without the currency data */
      return code + ' ' + v.toLocaleString(loc, { minimumFractionDigits: dp, maximumFractionDigits: dp });
    }
  }

  function number(v, dp, suggested) {
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    var loc = locale(suggested);
    try {
      return v.toLocaleString(loc, typeof dp === 'number' ? { minimumFractionDigits: dp, maximumFractionDigits: dp } : { maximumFractionDigits: 6 });
    } catch (e) { return String(v); }
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function date(d) {
    var dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    var f = get('dateFormat');
    if (f === 'auto') f = currency() === 'USD' ? 'mdy' : 'dmy';
    var dd = String(dt.getDate()).padStart(2, '0');
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    var yy = dt.getFullYear();
    if (f === 'iso') return yy + '-' + mm + '-' + dd;
    if (f === 'mdy') return mm + '/' + dd + '/' + yy;
    if (f === 'long') return dt.getDate() + ' ' + MONTHS[dt.getMonth()] + ' ' + yy;
    return dd + '/' + mm + '/' + yy;
  }

  /* ---------- a copy that follows you, if you are signed in ---------- */

  /* Only /settings/ calls these, because only /settings/ loads the account
     library. The newer of the two copies wins; a tie keeps the local one,
     since that is the machine somebody is sitting at. */
  function applyRemote(remote) {
    if (!remote || typeof remote !== 'object') return false;
    var theirs = Number(remote.updatedAt) || 0;
    if (theirs <= stamp) return false;
    state = clean(remote.values || remote);
    stamp = theirs;
    write({ v: VERSION, values: all(), updatedAt: stamp });
    announce(Object.keys(DEFAULTS));
    return true;
  }
  function forSync() { return { values: all(), updatedAt: stamp }; }

  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* Another tab changed them. Follow along rather than making somebody
     wonder why two windows of the same site disagree. */
  try {
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY) return;
      var box = read();
      if (!box) return;
      state = clean(box.values);
      stamp = box.updatedAt || Date.now();
      announce(Object.keys(DEFAULTS));
    });
  } catch (e) { /* no storage events here; the page is still correct */ }

  window.Prefs = {
    OPTIONS: OPTIONS, DEFAULTS: DEFAULTS,
    get: get, set: set, setAll: setAll, all: all, reset: reset, onChange: onChange,
    currency: currency, locale: locale, decimals: decimals,
    money: money, number: number, date: date,
    paper: function () { return get('paper'); },
    weekStart: function () { return get('weekStart'); },
    units: function () { return get('units'); },
    taxRegion: function () { return get('taxRegion'); },
    /* true when the reader has actually chosen, rather than left it alone */
    chosen: function (k) { return get(k) !== DEFAULTS[k]; },
    forSync: forSync, applyRemote: applyRemote, VERSION: VERSION
  };
})();
