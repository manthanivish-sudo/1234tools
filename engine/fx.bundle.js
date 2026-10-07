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
    /* The pages load this as /engine/fx.bundle.js now, an absolute path with
       no ../ in it, and the old prefix arithmetic then asked for
       /business/currency-converter/assets/rates.json, which does not exist.
       Resolving against the script's own address works for either form. */
    try { if (s && s.src) return new URL('../assets/rates.json', s.src).href; } catch (e) { /* old browser */ }
    var up = ((s && s.getAttribute('src')) || '').match(/(\.\.\/)+/);
    return (up ? up[0] : '/') + 'assets/rates.json';
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
    /* A copy saved when the list was shorter is refetched once, so a newly
       listed currency does not sit greyed out for up to six hours. */
    var fresh = cached && (Date.now() - cached.fetchedAt) < MAX_AGE && cached.listed === Object.keys(COMMON).length;

    if (fresh) {
      return Promise.resolve({
        rates: cached.rates, base: cached.base, date: cached.date,
        source: cached.source, fetched: cached.fetched || null, stale: false, offline: false
      });
    }

    var fallback = function (reason) {
      /* Serve what was last stored rather than nothing — clearly labelled as
         out of date. */
      if (cached) {
        return Promise.resolve({
          rates: cached.rates, base: cached.base, date: cached.date,
          source: cached.source, fetched: cached.fetched || null, stale: true, offline: true
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
          source: json.source, fetched: json.fetched || null, fetchedAt: Date.now(), listed: Object.keys(COMMON).length
        };
        writeCache(payload);
        return {
          rates: json.rates, base: json.base, date: json.date,
          source: json.source, fetched: json.fetched || null, stale: false, offline: false
        };
      })
      .catch(function () {
        return fallback('Could not load the rates file, and none are saved on this device yet.');
      });
  }

  /* The currencies worth listing. build/fetch-rates.js reads this list to
     decide what goes into assets/rates.json, so adding a currency here is all
     that is needed — but it only appears once the daily job has run.

     Every currency in circulation that the first feed (fawazahmed0's
     currency-api, CC0) publishes a rate for: the ISO 4217 codes in use, and
     the Guernsey, Jersey and Manx pounds and the Tuvaluan dollar, which are
     issued locally at par with sterling and the Australian dollar. Left out:
     codes for money that is no longer legal tender (HRK, BGN since the euro
     in 2026, ANG since the Caribbean guilder, ZWL, SLL, CUC), the IMF's SDR
     (XDR), the offshore yuan (CNH, a market for CNY rather than a currency),
     metals and crypto. The names are CLDR's English ones, tidied; the pages
     state the count as "150+", and build/tests/claims/calc-business.js fails
     if assets/rates.json ever holds fewer. */
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
    NPR: 'Nepalese Rupee', MUR: 'Mauritian Rupee', FJD: 'Fijian Dollar',
    /* the rest of the world, A to Z */
    AFN: 'Afghan Afghani', ALL: 'Albanian Lek', AMD: 'Armenian Dram',
    AOA: 'Angolan Kwanza', AWG: 'Aruban Florin', AZN: 'Azerbaijani Manat',
    BAM: 'Bosnia and Herzegovina Convertible Mark', BBD: 'Barbadian Dollar',
    BIF: 'Burundian Franc', BMD: 'Bermudian Dollar', BND: 'Brunei Dollar',
    BOB: 'Bolivian Boliviano', BSD: 'Bahamian Dollar',
    BTN: 'Bhutanese Ngultrum', BWP: 'Botswana Pula',
    BYN: 'Belarusian Rouble', BZD: 'Belize Dollar', CDF: 'Congolese Franc',
    CRC: 'Costa Rican Colón', CUP: 'Cuban Peso', CVE: 'Cape Verdean Escudo',
    DJF: 'Djiboutian Franc', DOP: 'Dominican Peso', DZD: 'Algerian Dinar',
    ERN: 'Eritrean Nakfa', FKP: 'Falkland Islands Pound',
    GEL: 'Georgian Lari', GGP: 'Guernsey Pound', GIP: 'Gibraltar Pound',
    GMD: 'Gambian Dalasi', GNF: 'Guinean Franc', GTQ: 'Guatemalan Quetzal',
    GYD: 'Guyanese Dollar', HNL: 'Honduran Lempira', HTG: 'Haitian Gourde',
    IMP: 'Manx Pound', IQD: 'Iraqi Dinar', IRR: 'Iranian Rial',
    JEP: 'Jersey Pound', JMD: 'Jamaican Dollar', KGS: 'Kyrgyzstani Som',
    KHR: 'Cambodian Riel', KMF: 'Comorian Franc', KPW: 'North Korean Won',
    KYD: 'Cayman Islands Dollar', KZT: 'Kazakhstani Tenge', LAK: 'Lao Kip',
    LBP: 'Lebanese Pound', LRD: 'Liberian Dollar', LSL: 'Lesotho Loti',
    LYD: 'Libyan Dinar', MDL: 'Moldovan Leu', MGA: 'Malagasy Ariary',
    MKD: 'Macedonian Denar', MMK: 'Myanmar Kyat', MNT: 'Mongolian Tugrik',
    MOP: 'Macanese Pataca', MRU: 'Mauritanian Ouguiya',
    MVR: 'Maldivian Rufiyaa', MWK: 'Malawian Kwacha',
    MZN: 'Mozambican Metical', NAD: 'Namibian Dollar',
    NIO: 'Nicaraguan Córdoba', PAB: 'Panamanian Balboa', PEN: 'Peruvian Sol',
    PGK: 'Papua New Guinean Kina', PYG: 'Paraguayan Guarani',
    RSD: 'Serbian Dinar', RWF: 'Rwandan Franc',
    SBD: 'Solomon Islands Dollar', SCR: 'Seychellois Rupee',
    SDG: 'Sudanese Pound', SHP: 'Saint Helena Pound',
    SLE: 'Sierra Leonean Leone', SOS: 'Somali Shilling',
    SRD: 'Surinamese Dollar', SSP: 'South Sudanese Pound',
    STN: 'São Tomé and Príncipe Dobra', SVC: 'Salvadoran Colón',
    SYP: 'Syrian Pound', SZL: 'Swazi Lilangeni', TJS: 'Tajikistani Somoni',
    TMT: 'Turkmenistani Manat', TND: 'Tunisian Dinar', TOP: 'Tongan Paʻanga',
    TTD: 'Trinidad and Tobago Dollar', TVD: 'Tuvaluan Dollar',
    UYU: 'Uruguayan Peso', UZS: 'Uzbekistani Som', VES: 'Venezuelan Bolívar',
    VUV: 'Vanuatu Vatu', WST: 'Samoan Tala',
    XAF: 'Central African CFA Franc', XCD: 'East Caribbean Dollar',
    XCG: 'Caribbean Guilder', XOF: 'West African CFA Franc',
    XPF: 'CFP Franc', YER: 'Yemeni Rial', ZMW: 'Zambian Kwacha',
    ZWG: 'Zimbabwe Gold'
  };

  /* The last 90 days, one file a day as the site served them
     (build/rates-history.js keeps it), asked for only when the chart is
     opened, and held for the rest of the visit. */
  var HISTORY_URL = RATES_URL.replace(/rates\.json$/, 'rates-history.json');
  var historyP = null;
  function getHistory() {
    if (!historyP) {
      historyP = typeof fetch !== 'function' ? Promise.reject(new Error('This browser cannot load the history file.'))
        : fetch(HISTORY_URL, { cache: 'no-cache' }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function (h) {
          if (!h || !Array.isArray(h.days) || !h.rates) throw new Error('unexpected history file');
          return h;
        });
      historyP.catch(function () { historyP = null; });
    }
    return historyP;
  }

  window.MVRFx = { getRates: getRates, getHistory: getHistory, COMMON: COMMON };
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

  /* The query string and the fragment of the link, the fragment winning. A
     shared link carries its figures after the #, which never reaches a
     server or analytics. */
  var linkParams = function () { var q = new URLSearchParams(location.search); try { var h = new URLSearchParams(location.hash.replace(/^#/, '')); h.forEach(function (v, k) { q.set(k, v); }); } catch (e) {} return q; };

  /* The share bar's hand-off: the same three lines in every engine. */
  function announce(state) {
    (window.MVRTool = window.MVRTool || {}).shareState = function () { return state; };
    document.dispatchEvent(new CustomEvent('mvr:result', { detail: state }));
  }

  /* Grouping and decimals follow the reader's preferences: Indian grouping
     for somebody who reads lakhs, whole units for somebody who asked for
     them. The currency of each figure is the one it is in, never the
     preference: this page's whole point is two currencies. */
  var LOCALE_FOR = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', AED: 'en-AE', SGD: 'en-SG', AUD: 'en-AU', CAD: 'en-CA', ZAR: 'en-ZA', GBP: 'en-GB' };
  function localeOf(code) {
    var P = window.Prefs;
    var g = P ? P.get('grouping') : 'auto';
    if (g === 'in') return 'en-IN';
    if (g === 'intl') return 'en-GB';
    return P ? (LOCALE_FOR[code] || 'en-GB') : 'en-GB';
  }
  function money(v, code, rate) {
    if (!isFinite(v)) return '—';
    var P = window.Prefs;
    /* a rate under 1 keeps up to six decimals: 1 JPY is 0.0049 GBP, not 0.00 */
    var dp = Math.abs(v) < 1 ? 6 : rate ? 4 : (P ? P.decimals(2) : 2);
    var min = rate || Math.abs(v) < 1 ? Math.min(2, dp) : dp;
    try {
      return v.toLocaleString(localeOf(code), { style: 'currency', currency: code, minimumFractionDigits: Math.min(min, dp), maximumFractionDigits: dp });
    } catch (e) {
      return v.toLocaleString(localeOf(code), { maximumFractionDigits: 4 }) + ' ' + code;
    }
  }
  /* "fetched 3 hours ago", from the time the site's daily job took the rates */
  function ago(iso) {
    var t = Date.parse(iso || '');
    if (!isFinite(t)) return '';
    var h = (Date.now() - t) / 3600000;
    if (h < 0) h = 0;
    if (h < 1) return 'fetched less than an hour ago';
    if (h < 48) return 'fetched ' + Math.floor(h) + (Math.floor(h) === 1 ? ' hour' : ' hours') + ' ago';
    return 'fetched ' + Math.floor(h / 24) + ' days ago';
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : (d || 'date unknown');
  }
  function amountsOf(text) {
    return String(text || '').split(/[\n;\t]+|,(?=\s)|,(?=\d{4})/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 500);
  }
  function readAmount(s) {
    var t = String(s).replace(/[\s  ]/g, '').replace(/[^\d.,\-]/g, '');
    /* 1,234.56 and 12,34,567.89: commas are grouping; one comma and no point with 1–2 digits after it is a decimal comma */
    if (/^-?\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
    else t = t.replace(/,/g, '');
    var n = Number(t);
    return t !== '' && isFinite(n) ? n : null;
  }

  window.MVRTool.mountCurrency = function (root) {
    var io = root.querySelector('.tool-io');
    var COMMON = window.MVRFx.COMMON;
    var codes = Object.keys(COMMON);
    var P = window.Prefs;
    var has = function (c) { return c !== null && Object.prototype.hasOwnProperty.call(COMMON, c); };
    /* open on the reader's own currency when they have chosen one */
    var mine = P && P.chosen && P.chosen('currency') ? P.currency('GBP') : null;
    var defFrom = has(mine) ? mine : 'GBP';
    var defTo = defFrom === 'USD' ? 'GBP' : 'USD';

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

    var from = currencySelect('fx-from', 'From', defFrom);
    var to = currencySelect('fx-to', 'To', defTo);

    var feeWrap = el('div', 'field');
    feeWrap.appendChild(Object.assign(el('label', null, 'Bank or card fee (%)'), { htmlFor: 'fx-fee' }));
    var fee = el('input', 'control');
    fee.id = 'fx-fee'; fee.type = 'number'; fee.step = 'any'; fee.min = '0'; fee.max = '50';
    fee.inputMode = 'decimal'; fee.value = '0';
    fee.setAttribute('aria-describedby', 'fx-fee-hint');
    feeWrap.appendChild(fee);
    var feeHint = el('p', 'field-hint', 'The margin your provider takes on top of the mid-market rate, often 0.5% to 4%. Leave at 0 for the reference rate.');
    feeHint.id = 'fx-fee-hint';
    feeWrap.appendChild(feeHint);

    form.appendChild(amtWrap);
    form.appendChild(from.wrap);
    form.appendChild(to.wrap);
    form.appendChild(feeWrap);

    var swap = el('button', 'swap', '⇅ Swap currencies');
    swap.type = 'button';
    form.appendChild(swap);

    /* several amounts at once, one a line */
    var many = el('details', 'conv-batch fx-many');
    many.appendChild(el('summary', null, 'Convert several amounts'));
    var manyLabel = el('label', 'visually-hidden', 'Amounts to convert, one a line');
    manyLabel.htmlFor = 'fx-many';
    var manyIn = el('textarea', 'control');
    manyIn.id = 'fx-many'; manyIn.rows = 5; manyIn.spellcheck = false;
    manyIn.placeholder = 'One amount a line, such as invoice totals';
    var manyOut = el('div', 'conv-batch-out');
    var manyActs = el('div', 'io-actions');
    var manyCopy = el('button', 'btn-ghost', 'Copy results'); manyCopy.type = 'button';
    var manyCsv = el('button', 'btn-ghost', 'Download CSV'); manyCsv.type = 'button';
    manyActs.appendChild(manyCopy); manyActs.appendChild(manyCsv);
    manyActs.hidden = true;
    many.appendChild(manyLabel); many.appendChild(manyIn); many.appendChild(manyOut); many.appendChild(manyActs);
    form.appendChild(many);

    /* readout */
    var results = el('div', 'tool-results');
    var status = el('div', 'io-msg');
    var table = el('div', 'fx-table');
    var hist = el('section', 'panel fx-history');
    hist.setAttribute('aria-label', 'How the rate has moved, up to the last 90 days');
    var histHead = el('div', 'fx-history-head');
    histHead.appendChild(el('h3', null, 'Up to the last 90 days'));
    var histBtn = el('button', 'btn-ghost', 'Show the chart');
    histBtn.type = 'button';
    histBtn.setAttribute('aria-expanded', 'false');
    histHead.appendChild(histBtn);
    var histBody = el('div', 'fx-history-body');
    histBody.hidden = true;
    hist.appendChild(histHead); hist.appendChild(histBody);

    io.appendChild(results);
    io.appendChild(status);
    io.appendChild(form);
    io.appendChild(table);
    io.appendChild(hist);

    var state = { rates: null, date: '', source: '', stale: false, base: null, fetched: null };

    /* A link can name the amount and the pair: ?amount=250&from=GBP&to=USD,
       or the same after a # when it came from the share bar. Only listed
       currencies are taken; anything else keeps the defaults. */
    var touched = false, fromLink = false;
    try {
      var lp = linkParams();
      var qa = lp.get('amount'), qf = lp.get('from'), qt = lp.get('to'), qfee = lp.get('fee');
      if (qa !== null && qa.trim() !== '' && isFinite(Number(qa))) { amount.value = String(Number(qa)); fromLink = true; }
      if (has(qf)) { from.sel.value = qf; fromLink = true; }
      if (has(qt)) { to.sel.value = qt; fromLink = true; }
      if (qfee !== null && isFinite(Number(qfee)) && Number(qfee) >= 0 && Number(qfee) <= 50) fee.value = String(Number(qfee));
    } catch (e) { /* no URL, no prefill */ }

    function tell(summary) {
      var params = { amount: amount.value, from: from.sel.value, to: to.sel.value };
      if (Number(fee.value) > 0) params.fee = fee.value;
      announce({ kind: 'currency', params: params, summary: summary, changed: touched || fromLink });
    }
    var rateOf = function (f, t) { return state.base === f ? state.rates[t] : (state.rates[t] / state.rates[f]); };
    var feePct = function () { var x = Number(fee.value); return isFinite(x) && x > 0 && x <= 50 ? x : 0; };

    var manyRows = [];
    function paintMany(f, t) {
      manyOut.innerHTML = '';
      var lines = amountsOf(manyIn.value);
      manyActs.hidden = lines.length === 0;
      manyRows = [];
      if (!lines.length || !state.rates) return;
      var rate = rateOf(f, t), k = 1 - feePct() / 100;
      manyRows = lines.map(function (s) { var n = readAmount(s); return { s: s, n: n, out: n === null ? NaN : n * rate * k }; });
      var tb = el('table', 'schedule conv-batch-table');
      var thead = el('thead'), hr = el('tr');
      [f, t + (feePct() ? ' after the ' + feePct() + '% fee' : '')].forEach(function (h, i) { var th = el('th', i ? 'num' : null, h); th.scope = 'col'; hr.appendChild(th); });
      thead.appendChild(hr); tb.appendChild(thead);
      var body = el('tbody');
      var sum = 0, sumIn = 0;
      manyRows.forEach(function (r) {
        var tr = el('tr', r.n === null ? 'is-bad' : null);
        tr.appendChild(el('td', null, r.n === null ? r.s : money(r.n, f)));
        tr.appendChild(el('td', 'num', r.n === null ? 'not an amount' : money(r.out, t)));
        if (r.n !== null) { sum += r.out; sumIn += r.n; }
        body.appendChild(tr);
      });
      tb.appendChild(body);
      var tf = el('tfoot'), fr = el('tr', 'table-foot');
      fr.appendChild(el('td', null, 'Total ' + money(sumIn, f)));
      fr.appendChild(el('td', 'num', money(sum, t)));
      tf.appendChild(fr); tb.appendChild(tf);
      var w = el('div', 'table-scroll'); w.appendChild(tb);
      manyOut.appendChild(w);
      var bad = manyRows.filter(function (r) { return r.n === null; }).length;
      if (bad) manyOut.appendChild(el('p', 'field-msg', bad + (bad === 1 ? ' line is' : ' lines are') + ' not an amount this page can read, marked in the list.'));
    }
    var manyText = function (sep) {
      var f = from.sel.value, t = to.sel.value;
      return [f, t].join(sep) + '\n' + manyRows.map(function (r) {
        return sep === ',' ? [r.n === null ? '"' + r.s.replace(/"/g, '""') + '"' : String(r.n), r.n === null ? '' : String(Math.round(r.out * 1e6) / 1e6)].join(',')
          : [r.n === null ? r.s : money(r.n, f), r.n === null ? '' : money(r.out, t)].join('\t');
      }).join('\n');
    };
    manyCopy.addEventListener('click', function () { if (navigator.clipboard) navigator.clipboard.writeText(manyText('\t')).then(function () { manyCopy.textContent = 'Copied'; setTimeout(function () { manyCopy.textContent = 'Copy results'; }, 1200); }); });
    manyCsv.addEventListener('click', function () {
      var blob = new Blob([manyText(',')], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = 'currency-' + from.sel.value + '-' + to.sel.value + '.' + (blob.type === 'text/csv' ? 'csv' : 'txt');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });

    function paint() {
      var f = from.sel.value, t = to.sel.value;
      var v = amount.value === '' ? null : Number(amount.value);
      results.innerHTML = '';
      table.innerHTML = '';
      paintMany(f, t);
      if (!histBody.hidden) drawHistory();

      if (!state.rates) { tell(null); return; }
      if (v === null || !isFinite(v)) {
        results.innerHTML = '<div class="result"><span class="result-label">Enter an amount above</span></div>';
        tell(null);
        return;
      }

      var rate = rateOf(f, t);
      var out = v * rate;
      var pct = feePct();

      var main = el('div', 'result result-primary');
      main.appendChild(el('span', 'result-label', money(v, f) + ' ='));
      main.appendChild(el('span', 'result-value', money(out, t)));
      results.appendChild(main);

      var rows = [['1 ' + f + ' buys', money(rate, t, true)], ['1 ' + t + ' buys', money(1 / rate, f, true)]];
      if (pct) rows.push(['After a ' + pct + '% fee you get', money(out * (1 - pct / 100), t)], ['The fee costs', money(out * pct / 100, t)], ['Rate after the fee', money(rate * (1 - pct / 100), t, true)]);
      rows.push(['Rate date', longDate(state.date) + (state.fetched ? ', ' + ago(state.fetched) : '')], ['Source', state.source]);
      rows.forEach(function (row) {
        var r = el('div', 'result');
        r.appendChild(el('span', 'result-label', row[0]));
        r.appendChild(el('span', 'result-value', row[1]));
        results.appendChild(r);
      });

      /* the same amount in the other major currencies */
      var majors = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'INR', 'AED', 'SGD', 'ZAR'];
      table.appendChild(el('h3', null, 'Same amount in other currencies'));
      var grid = el('div', 'fx-grid');
      majors.filter(function (c) { return c !== f; }).forEach(function (c) {
        if (!state.rates[c]) return;
        var cell = el('div', 'fx-cell');
        cell.appendChild(el('span', 'fx-code', c));
        cell.appendChild(el('span', 'fx-val', money(v * rateOf(f, c), c)));
        grid.appendChild(cell);
      });
      table.appendChild(grid);

      var summary = money(v, f) + ' = ' + money(out, t);
      if (state.date && (summary + ' · rate ' + state.date).length <= 90) summary += ' · rate ' + state.date;
      tell(summary);
    }

    /* the chart: one line, the rate from the From currency to the To one on
       each day the site served, with the low, the high and the change */
    var history = null;
    function drawHistory() {
      histBody.innerHTML = '';
      if (!history) return;
      var f = from.sel.value, t = to.sel.value;
      var days = [], vals = [];
      history.days.forEach(function (d, i) {
        var a = f === history.base ? 1 : (history.rates[f] || [])[i];
        var b = t === history.base ? 1 : (history.rates[t] || [])[i];
        if (a > 0 && b > 0) { days.push(d); vals.push(b / a); }
      });
      if (days.length < 2) { histBody.appendChild(el('p', 'io-msg is-note', 'Not enough days of history for ' + f + ' to ' + t + ' yet: the file keeps one day at a time from when each currency was first listed.')); return; }
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var first = vals[0], lastV = vals[vals.length - 1];
      var chg = (lastV / first - 1) * 100;
      var labels = days.map(function (d) { var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(d); return m ? Number(m[2]) + ' ' + MONTHS[Number(m[1]) - 1].slice(0, 3) : d; });
      var host = el('div', 'fx-history-chart');
      histBody.appendChild(host);
      if (window.MVRTool.chart) {
        window.MVRTool.chart(host, { type: 'line', title: '1 ' + f + ' in ' + t + ', ' + longDate(days[0]) + ' to ' + longDate(days[days.length - 1]), format: 'number', labels: labels,
          series: [{ name: '1 ' + f + ' in ' + t, values: vals, area: true }] }, { currency: t, currencyLocked: true });
      }
      var dl = el('dl', 'fx-history-stats');
      [['Lowest', money(lo, t, true)], ['Highest', money(hi, t, true)], ['Change over the period', (chg >= 0 ? '+' : '−') + Math.abs(chg).toFixed(2) + '%'], ['Days with a rate', String(days.length)]].forEach(function (x) {
        var d = el('div'); d.appendChild(el('dt', null, x[0])); d.appendChild(el('dd', null, x[1])); dl.appendChild(d);
      });
      histBody.appendChild(dl);
      histBody.appendChild(el('p', 'field-hint', 'One reading a day, as this site served it; days when no rate moved or the daily job did not run are left out.'));
    }
    histBtn.addEventListener('click', function () {
      var open = histBody.hidden;
      histBody.hidden = !open;
      histBtn.setAttribute('aria-expanded', String(open));
      histBtn.textContent = open ? 'Hide the chart' : 'Show the chart';
      if (!open) return;
      if (history) { drawHistory(); return; }
      histBody.innerHTML = '';
      histBody.appendChild(el('p', 'io-msg is-note', 'Loading the history…'));
      window.MVRFx.getHistory().then(function (h) { history = h; drawHistory(); }, function () {
        histBody.innerHTML = '';
        histBody.appendChild(el('p', 'io-msg is-error', 'Could not load the history file. Check the connection and try again.'));
      });
    });

    function load() {
      status.className = 'io-msg is-note';
      status.textContent = 'Loading today’s rates…';
      window.MVRFx.getRates().then(function (res) {
        state.rates = res.rates;
        state.date = res.date;
        state.source = res.source;
        state.stale = res.stale;
        state.fetched = res.fetched || null;
        /* The base of the data, never the currency on screen. Every pair is a
           cross-rate derived from it, and treating the selected currency as the
           base would silently return the wrong number for every pair that does
           not happen to start there. */
        state.base = res.base;
        state.rates[res.base] = 1;

        /* A listed currency the file has no rate for (the fallback feed lacks
           a few) stays in the list, greyed out, rather than converting to a
           dash. */
        [from.sel, to.sel].forEach(function (sel) {
          Array.prototype.forEach.call(sel.options, function (o) {
            var none = !(state.rates[o.value] > 0);
            o.disabled = none;
            o.textContent = o.value + ' — ' + COMMON[o.value] + (none ? ' (no rate today)' : '');
          });
        });

        var when = longDate(res.date) + (res.fetched ? ', ' + ago(res.fetched) : '');
        if (res.stale) {
          status.className = 'io-msg is-warn';
          status.textContent = 'Could not load the rates file, so these are the last rates saved on this device (' + when + '). Treat them as out of date.';
        } else {
          status.className = 'io-msg is-note';
          status.textContent = 'Daily reference rates of ' + when + '. These are mid-market rates — a bank or card provider will add a margin.';
        }
        paint();
      }).catch(function (e) {
        state.rates = null;
        status.className = 'io-msg is-error';
        status.textContent = e.message;
        results.innerHTML = '';
        tell(null);
      });
    }

    /* Changing a currency is now a repaint, not a refetch: one file covers
       every pair. */
    var used = function () { touched = true; paint(); };
    from.sel.addEventListener('change', used);
    to.sel.addEventListener('change', used);
    amount.addEventListener('input', used);
    fee.addEventListener('input', used);
    manyIn.addEventListener('input', used);
    swap.addEventListener('click', function () {
      var f = from.sel.value;
      from.sel.value = to.sel.value;
      to.sel.value = f;
      used();
    });
    if (P && P.onChange) P.onChange(function () { paint(); });

    load();
  };
})();
