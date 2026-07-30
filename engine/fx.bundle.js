/**
 * Daily currency rates, served from this site.
 *
 * These used to be fetched straight from cdn.jsdelivr.net, with
 * open.er-api.com as a fallback, on page load and before any consent — which
 * meant this one page contacted a third party while privacy/index.html said no
 * page did. The fetching now happens once a day on a GitHub runner
 * (build/fetch-rates.js, driven by .github/workflows/update-rates.yml) and the
 * result is committed as assets/rates.json, so the browser only ever asks this
 * site. Nothing is lost: the upstream feeds publish daily, so a file rebuilt
 * daily is exactly as current as fetching live was.
 *
 * Rates are still cached in localStorage, which is what keeps the converter
 * working offline. The date is always surfaced, because "the rate" is
 * meaningless without knowing when it was taken.
 */
(function () {
  'use strict';

  var CACHE_KEY = 'mvr-fx-v2';        // v1 held per-base payloads from the old feeds
  var MAX_AGE = 6 * 60 * 60 * 1000;   // refetch after 6h; the file rebuilds daily

  /* Resolved from this script's own src, the way assets/analytics.js does it,
     so the path holds wherever the page sits in the tree. */
  var RATES_URL = (function () {
    var s = document.currentScript;
    var up = ((s && s.getAttribute('src')) || '').match(/(\.\.\/)+/);
    return (up ? up[0] : '') + 'assets/rates.json';
  })();

  /* The old per-base cache can never be read again, so drop it rather than
     leave a few KB of dead rates on every returning visitor's device. */
  try { localStorage.removeItem('mvr-fx-v1'); } catch (e) {}

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function writeCache(payload) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); }
    catch (e) { /* private mode or quota — the converter still works this session */ }
  }

  /**
   * One base for every pair; the page derives cross-rates from it. Callers must
   * use the returned `base`, not the currency they happen to be displaying.
   *
   * @returns {Promise<{rates:Object, base:string, date:string, source:string,
   *                    stale:boolean, offline:boolean}>}
   */
  function getRates() {
    var cached = readCache();
    var fresh = cached && (Date.now() - cached.fetchedAt) < MAX_AGE;

    if (fresh) {
      return Promise.resolve({
        rates: cached.rates, base: cached.base, date: cached.date,
        source: cached.source, stale: false, offline: false
      });
    }

    var fallback = function (reason) {
      /* Serve what was last stored rather than nothing — clearly labelled as
         out of date. */
      if (cached) {
        return Promise.resolve({
          rates: cached.rates, base: cached.base, date: cached.date,
          source: cached.source, stale: true, offline: true
        });
      }
      return Promise.reject(new Error(reason));
    };

    if (typeof fetch !== 'function') {
      return fallback('This browser cannot load the rates file, and none are saved on this device yet.');
    }

    return fetch(RATES_URL, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        if (!json || !json.rates || !json.base) throw new Error('unexpected rates file');
        var payload = {
          rates: json.rates, base: json.base, date: json.date,
          source: json.source, fetchedAt: Date.now()
        };
        writeCache(payload);
        return {
          rates: json.rates, base: json.base, date: json.date,
          source: json.source, stale: false, offline: false
        };
      })
      .catch(function () {
        return fallback('Could not load the rates file, and none are saved on this device yet.');
      });
  }

  /* The currencies worth listing. build/fetch-rates.js reads this list to
     decide what goes into assets/rates.json, so adding a currency here is all
     that is needed — but it only appears once the daily job has run. */
  var COMMON = {
    GBP: 'British Pound', USD: 'US Dollar', EUR: 'Euro', JPY: 'Japanese Yen',
    AUD: 'Australian Dollar', CAD: 'Canadian Dollar', CHF: 'Swiss Franc',
    CNY: 'Chinese Yuan', INR: 'Indian Rupee', AED: 'UAE Dirham',
    SAR: 'Saudi Riyal', SGD: 'Singapore Dollar', HKD: 'Hong Kong Dollar',
    NZD: 'New Zealand Dollar', SEK: 'Swedish Krona', NOK: 'Norwegian Krone',
    DKK: 'Danish Krone', PLN: 'Polish Zloty', CZK: 'Czech Koruna',
    HUF: 'Hungarian Forint', RON: 'Romanian Leu', TRY: 'Turkish Lira',
    ZAR: 'South African Rand', NGN: 'Nigerian Naira', KES: 'Kenyan Shilling',
    EGP: 'Egyptian Pound', BRL: 'Brazilian Real', MXN: 'Mexican Peso',
    ARS: 'Argentine Peso', CLP: 'Chilean Peso', COP: 'Colombian Peso',
    KRW: 'South Korean Won', THB: 'Thai Baht', MYR: 'Malaysian Ringgit',
    IDR: 'Indonesian Rupiah', PHP: 'Philippine Peso', VND: 'Vietnamese Dong',
    PKR: 'Pakistani Rupee', BDT: 'Bangladeshi Taka', LKR: 'Sri Lankan Rupee',
    ILS: 'Israeli Shekel', QAR: 'Qatari Riyal', KWD: 'Kuwaiti Dinar',
    BHD: 'Bahraini Dinar', OMR: 'Omani Rial', JOD: 'Jordanian Dinar',
    RUB: 'Russian Ruble', UAH: 'Ukrainian Hryvnia', ISK: 'Icelandic Krona',
    TWD: 'Taiwan Dollar', MAD: 'Moroccan Dirham', GHS: 'Ghanaian Cedi',
    TZS: 'Tanzanian Shilling', UGX: 'Ugandan Shilling', ETB: 'Ethiopian Birr',
    NPR: 'Nepalese Rupee', MUR: 'Mauritian Rupee', FJD: 'Fijian Dollar'
  };

  window.MVRFx = { getRates: getRates, COMMON: COMMON };
})();

/* ---------- Currency converter UI ---------- */
(function () {
  'use strict';
  window.MVRTool = window.MVRTool || {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  window.MVRTool.mountCurrency = function (root) {
    var io = root.querySelector('.tool-io');
    var COMMON = window.MVRFx.COMMON;
    var codes = Object.keys(COMMON);

    /* form */
    var form = el('div', 'gen-form');

    var amtWrap = el('div', 'field');
    amtWrap.appendChild(Object.assign(el('label', null, 'Amount'), { htmlFor: 'fx-amount' }));
    var amount = el('input', 'control');
    amount.id = 'fx-amount'; amount.type = 'number'; amount.step = 'any';
    amount.inputMode = 'decimal'; amount.value = '100';
    amtWrap.appendChild(amount);

    function currencySelect(id, label, def) {
      var w = el('div', 'field');
      w.appendChild(Object.assign(el('label', null, label), { htmlFor: id }));
      var s = el('select', 'control');
      s.id = id;
      codes.forEach(function (c) {
        var o = el('option', null, c + ' — ' + COMMON[c]);
        o.value = c;
        if (c === def) o.selected = true;
        s.appendChild(o);
      });
      w.appendChild(s);
      return { wrap: w, sel: s };
    }

    var from = currencySelect('fx-from', 'From', 'GBP');
    var to = currencySelect('fx-to', 'To', 'USD');

    form.appendChild(amtWrap);
    form.appendChild(from.wrap);
    form.appendChild(to.wrap);

    var swap = el('button', 'swap', '⇅ Swap currencies');
    swap.type = 'button';
    form.appendChild(swap);

    /* readout */
    var results = el('div', 'tool-results');
    var status = el('div', 'io-msg');
    var table = el('div', 'fx-table');

    io.appendChild(results);
    io.appendChild(status);
    io.appendChild(form);
    io.appendChild(table);

    var state = { rates: null, date: '', source: '', stale: false, base: null };

    function money(v, code) {
      if (!isFinite(v)) return '—';
      try {
        return v.toLocaleString('en-GB', {
          style: 'currency', currency: code,
          maximumFractionDigits: Math.abs(v) < 1 ? 6 : 2
        });
      } catch (e) {
        return v.toLocaleString('en-GB', { maximumFractionDigits: 4 }) + ' ' + code;
      }
    }

    function paint() {
      var f = from.sel.value, t = to.sel.value;
      var v = amount.value === '' ? null : Number(amount.value);
      results.innerHTML = '';
      table.innerHTML = '';

      if (!state.rates) return;
      if (v === null || !isFinite(v)) {
        results.innerHTML = '<div class="result"><span class="result-label">Enter an amount above</span></div>';
        return;
      }

      var rate = state.base === f ? state.rates[t]
               : (state.rates[t] / state.rates[f]);
      var out = v * rate;

      var main = el('div', 'result result-primary');
      main.innerHTML = '<span class="result-label">' + money(v, f) + ' =</span>' +
                       '<span class="result-value">' + money(out, t) + '</span>';
      results.appendChild(main);

      [['1 ' + f + ' buys', money(rate, t)],
       ['1 ' + t + ' buys', money(1 / rate, f)],
       ['Rate date', state.date || 'unknown'],
       ['Source', state.source]].forEach(function (row) {
        var r = el('div', 'result');
        r.innerHTML = '<span class="result-label">' + row[0] + '</span>' +
                      '<span class="result-value">' + row[1] + '</span>';
        results.appendChild(r);
      });

      /* the same amount in the other major currencies */
      var majors = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'INR', 'AED', 'SGD', 'ZAR'];
      var head = el('h3', null, 'Same amount in other currencies');
      table.appendChild(head);
      var grid = el('div', 'fx-grid');
      majors.filter(function (c) { return c !== f; }).forEach(function (c) {
        if (!state.rates[c]) return;
        var r2 = state.base === f ? state.rates[c] : (state.rates[c] / state.rates[f]);
        var cell = el('div', 'fx-cell');
        cell.appendChild(el('span', 'fx-code', c));
        cell.appendChild(el('span', 'fx-val', money(v * r2, c)));
        grid.appendChild(cell);
      });
      table.appendChild(grid);
    }

    function load() {
      status.className = 'io-msg is-note';
      status.textContent = 'Loading today’s rates…';
      window.MVRFx.getRates().then(function (res) {
        state.rates = res.rates;
        state.date = res.date;
        state.source = res.source;
        state.stale = res.stale;
        /* The base of the data, never the currency on screen. Every pair is a
           cross-rate derived from it, and treating the selected currency as the
           base would silently return the wrong number for every pair that does
           not happen to start there. */
        state.base = res.base;
        state.rates[res.base] = 1;

        if (res.stale) {
          status.className = 'io-msg is-warn';
          status.textContent = 'Could not load the rates file, so these are the last rates saved on this device (' +
                               (res.date || 'date unknown') + '). Treat them as out of date.';
        } else {
          status.className = 'io-msg is-note';
          status.textContent = 'Daily reference rates, ' + (res.date || 'date unknown') +
                               '. These are mid-market rates — a bank or card provider will add a margin.';
        }
        paint();
      }).catch(function (e) {
        state.rates = null;
        status.className = 'io-msg is-error';
        status.textContent = e.message;
        results.innerHTML = '';
      });
    }

    /* Changing a currency is now a repaint, not a refetch: one file covers
       every pair. */
    from.sel.addEventListener('change', paint);
    to.sel.addEventListener('change', paint);
    amount.addEventListener('input', paint);
    swap.addEventListener('click', function () {
      var f = from.sel.value;
      from.sel.value = to.sel.value;
      to.sel.value = f;
      paint();
    });

    load();
  };
})();
