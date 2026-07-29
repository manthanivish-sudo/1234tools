/**
 * Live currency rates.
 *
 * Two keyless, CORS-enabled sources, tried in order. Both publish daily
 * reference rates, so results are cached for the day in localStorage —
 * which also means the converter keeps working offline using the last
 * figures it fetched. The date fetched is always surfaced to the user,
 * because "the rate" is meaningless without knowing when it was taken.
 */
(function () {
  'use strict';

  var CACHE_KEY = 'mvr-fx-v1';
  var MAX_AGE = 6 * 60 * 60 * 1000;   // refetch after 6h; upstream updates daily

  var SOURCES = [
    {
      name: 'Currency API (CDN)',
      url: function (base) {
        return 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/' +
               base.toLowerCase() + '.json';
      },
      parse: function (json, base) {
        var block = json[base.toLowerCase()];
        if (!block) return null;
        var rates = {};
        Object.keys(block).forEach(function (k) { rates[k.toUpperCase()] = block[k]; });
        return { rates: rates, date: json.date };
      }
    },
    {
      name: 'ExchangeRate-API (open)',
      url: function (base) { return 'https://open.er-api.com/v6/latest/' + base.toUpperCase(); },
      parse: function (json) {
        if (json.result !== 'success' || !json.rates) return null;
        return {
          rates: json.rates,
          date: (json.time_last_update_utc || '').slice(5, 16)
        };
      }
    }
  ];

  function readCache(base) {
    try {
      var all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return all[base.toUpperCase()] || null;
    } catch (e) { return null; }
  }

  function writeCache(base, payload) {
    try {
      var all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      all[base.toUpperCase()] = payload;
      localStorage.setItem(CACHE_KEY, JSON.stringify(all));
    } catch (e) { /* private mode or quota — the converter still works this session */ }
  }

  /**
   * @returns {Promise<{rates:Object, date:string, source:string, stale:boolean, offline:boolean}>}
   */
  function getRates(base) {
    base = (base || 'GBP').toUpperCase();
    var cached = readCache(base);
    var fresh = cached && (Date.now() - cached.fetchedAt) < MAX_AGE;

    if (fresh) {
      return Promise.resolve({
        rates: cached.rates, date: cached.date, source: cached.source,
        stale: false, offline: false
      });
    }

    if (typeof fetch !== 'function') {
      return cached
        ? Promise.resolve({ rates: cached.rates, date: cached.date, source: cached.source, stale: true, offline: true })
        : Promise.reject(new Error('This browser cannot fetch live rates, and none are cached on this device yet.'));
    }

    var attempt = function (i) {
      if (i >= SOURCES.length) {
        // Every source failed. Fall back to whatever was last stored rather
        // than showing nothing — clearly labelled as out of date.
        if (cached) {
          return Promise.resolve({
            rates: cached.rates, date: cached.date, source: cached.source,
            stale: true, offline: true
          });
        }
        return Promise.reject(new Error('Could not reach a rate source, and no rates are cached on this device yet.'));
      }
      var src = SOURCES[i];
      return fetch(src.url(base), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (json) {
          var parsed = src.parse(json, base);
          if (!parsed || !parsed.rates) throw new Error('unexpected response shape');
          var payload = {
            rates: parsed.rates, date: parsed.date,
            source: src.name, fetchedAt: Date.now()
          };
          writeCache(base, payload);
          return { rates: parsed.rates, date: parsed.date, source: src.name, stale: false, offline: false };
        })
        .catch(function () { return attempt(i + 1); });
    };

    return attempt(0);
  }

  /* The currencies worth listing. The CDN source also carries hundreds of
     crypto tickers, which would bury the fiat currencies people came for. */
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

    function load(base) {
      status.className = 'io-msg is-note';
      status.textContent = 'Fetching the latest rates…';
      window.MVRFx.getRates(base).then(function (res) {
        state.rates = res.rates;
        state.date = res.date;
        state.source = res.source;
        state.stale = res.stale;
        state.base = base;
        state.rates[base] = 1;

        if (res.stale) {
          status.className = 'io-msg is-warn';
          status.textContent = 'Could not reach a rate source, so these are the last rates saved on this device (' +
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

    from.sel.addEventListener('change', function () { load(from.sel.value); });
    to.sel.addEventListener('change', paint);
    amount.addEventListener('input', paint);
    swap.addEventListener('click', function () {
      var f = from.sel.value;
      from.sel.value = to.sel.value;
      to.sel.value = f;
      load(from.sel.value);
    });

    load('GBP');
  };
})();
