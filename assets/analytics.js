/**
 * Consent-gated analytics.
 *
 * GA4 and Microsoft Clarity both set cookies and both send data off-device, so
 * under PECR neither may run before the visitor agrees. Nothing here contacts
 * a third party until a choice is stored: no script tag is injected, no
 * beacon fires, no cookie is written. Declining is a real decline, not a
 * dismissed banner.
 *
 * Ids come from the script tag's data attributes so build-site.js owns them in
 * one place. With neither id set this file does nothing at all, which is what
 * makes it safe to ship before the accounts exist.
 *
 * The site's whole claim is that files never leave the browser, and that stays
 * true: this measures pages, not the contents of the tools. Everything a
 * visitor types or produces is masked before Clarity is allowed to see it.
 */
(function () {
  'use strict';

  var self = document.currentScript;
  var GA4 = (self && self.getAttribute('data-ga4')) || '';
  var CLARITY = (self && self.getAttribute('data-clarity')) || '';
  if (!GA4 && !CLARITY) return;
  /* Inside somebody else's page (a tool embedded with ?embed=1) there is no
     banner, no GA4 and no Clarity: a third-party frame is not a place to ask
     for consent, and nothing should be measured there. */
  if (/[?&]embed=1(?:&|$)/.test(location.search)) return;

  var KEY = '1234tools-consent';
  var PRIVACY = 'privacy/index.html';

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: session only */ }
  }

  /* Global Privacy Control and Do Not Track are explicit, machine-readable
     refusals. Honouring them means never asking, which is the point of them. */
  function refusedBySignal() {
    return navigator.globalPrivacyControl === true ||
           navigator.doNotTrack === '1' || window.doNotTrack === '1';
  }

  /* ---------- masking ----------
     Clarity replays sessions. These tools hold payslips, invoice line items,
     names on certificates and take-home pay — none of which may be recorded.
     Masked elements still register position and interaction, so heatmaps and
     scroll depth survive; only the text is withheld.

     Matched on intent rather than by listing every class: an enumeration goes
     stale the moment a tool page invents .search-results or .calc-result, and
     the sweep in build/consent-check.js caught exactly that on all 1,218 pages.
     Anything named like a result, an output, a readout or a preview is masked
     on principle. Over-masking costs a little replay detail; under-masking
     records someone's salary. */
  var MASK = [
    'input', 'textarea', 'select', 'canvas', '[contenteditable]',
    '[class*="result"]', '[class*="output"]', '[class*="readout"]',
    '[class*="preview"]', '[class*="display"]',
    /* The homepage's "pick up where you left off" strip is the visitor's own
       history. It never leaves the device and must not reach a replay either. */
    '#recent-tools',
    '.io-pane', '.io-msg', '.pdf-file-name', '.page-grid', '.stat-val',
    /* a calculator's schedule table: fertile-window dates, loan balances */
    '.tool-table',
    /* the calculator shell (render-core.js) and its siblings: charts, saved
       scenarios, recent results, the formula filled in with the visitor's
       numbers, the worked steps, the print header, the converters' batch and
       live tables, the currency grid and the scientific calculator's history */
    '.tool-chart', '.calc-recent', '.calc-compare', '.formula-filled', '.working',
    '.print-head', '.conv-batch', '.conv-live', '.fx-grid', '.calc-history'
  ].join(',');

  function mask(root) {
    var nodes = (root.matches && root.matches(MASK)) ? [root] : [];
    if (root.querySelectorAll) {
      nodes = nodes.concat(Array.prototype.slice.call(root.querySelectorAll(MASK)));
    }
    nodes.forEach(function (n) { n.setAttribute('data-clarity-mask', 'true'); });
  }

  /* Results are built after the page loads, so masking once is not enough:
     anything added later must be masked before Clarity can observe it. */
  function watchForNewNodes() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        Array.prototype.forEach.call(r.addedNodes, function (n) {
          if (n.nodeType === 1) mask(n);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---------- loaders ---------- */
  function loadGa4() {
    if (!GA4) return;
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    /* Consent Mode v2. Only analytics_storage is granted: nothing here is
       advertising, and the ad signals stay denied whatever the visitor picks. */
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted'
    });
    gtag('consent', 'update', { analytics_storage: 'granted' });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4);
    document.head.appendChild(s);

    gtag('js', new Date());
    /* IP anonymisation is the default in GA4; this pins it explicitly so a
       property misconfiguration cannot quietly turn it off.

       page_location is the address with every query parameter dropped except
       the utm_* tags and ?src=: a link from the Tool Finder can carry the
       figures somebody typed (?amount=48000), and those are theirs, not a
       page name. The fragment, where shared links keep their figures, is
       never part of it. */
    var loc = pageLocation();
    gtag('set', { page_location: loc });
    gtag('config', GA4, { anonymize_ip: true, page_location: loc });
  }

  function pageLocation() {
    var keep = [];
    try {
      new URLSearchParams(location.search).forEach(function (v, k) {
        if (/^utm_/.test(k) || k === 'src') keep.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
      });
    } catch (e) { /* an old browser sends the bare path */ }
    return location.origin + location.pathname + (keep.length ? '?' + keep.join('&') : '');
  }

  function loadClarity() {
    if (!CLARITY) return;
    mask(document.documentElement);
    watchForNewNodes();
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY);
    /* consentv2, not the legacy clarity('consent'). The old call applies one
       state to every consent type, so it was granting ad storage as well —
       the opposite of what this banner asks for, and inconsistent with the GA4
       defaults above, which deny every ad signal. Naming the two storages
       separately is the only way to deny one and grant the other.

       Note the capital S in both keys: Clarity's API is ad_Storage and
       analytics_Storage, while the values it reports back are lower case.
       Getting the case wrong fails silently.

       Masking is belt and braces with the project's Strict setting in the
       Clarity dashboard; neither replaces the other. */
    window.clarity('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted'
    });
  }

  /* ---------- tool_done and tool_error ----------
     Whether a tool did its job, per tool, and nothing else: the page's own
     path as the tool, the kind of output as a file extension or the shell's
     result kind, and how it left (saved, sent to another tool, or shown on
     the page). Never a file name, a figure, a size or an error's wording —
     those can carry what somebody typed. Only reached through start(), so
     with consent refused or not yet given nothing here is even listening.

     A run is one input: one tool_done at most, armed again when the visitor
     gives the tool a new file. Tools with no file input (calculators,
     converters, text tools) count once per page view, on the first result
     the visitor changed, after it has settled for a second and a half.
     ANALYTICS-SETUP.md says how to read completion rate from these. */
  var KINDS = { jpeg: 'jpg', htm: 'html', '': 'file' };
  function outputKind(name) {
    var m = /\.([a-z0-9]{1,8})$/i.exec(name || '');
    var e = m ? m[1].toLowerCase() : '';
    return KINDS.hasOwnProperty(e) ? KINDS[e] : e;
  }
  function toolEvents() {
    if (!GA4) return;
    var tool = document.querySelector('article.tool, .tool[data-tool]');
    if (!tool) return;
    var slug = location.pathname.replace(/index\.html$/, '').replace(/^\/+|\/+$/g, '');
    var done = false, failed = false, settle = 0;
    function send(name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params); }
    function finish(kind, how) {
      clearTimeout(settle);
      if (done) return;
      done = true;
      send('tool_done', { tool: slug, output_kind: kind, method: how });
    }
    function rearm() { done = false; failed = false; }
    tool.addEventListener('change', function (e) { if (e.target && e.target.type === 'file') rearm(); }, true);
    tool.addEventListener('drop', rearm, true);
    /* Bubble phase on window: after engine/handoff.js has decided, in the
       capture phase, whether this save is really a hand-off to another tool. */
    window.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
      if (!a || a.hasAttribute('data-ho-skip')) return;
      finish(outputKind(a.getAttribute('download')), e.defaultPrevented ? 'send_to' : 'download');
    });
    document.addEventListener('mvr:result', function (e) {
      var d = e.detail || {};
      if (!d.changed || done) return;
      clearTimeout(settle);
      settle = setTimeout(function () { finish(String(d.kind || 'result').slice(0, 20), 'result'); }, 1500);
    });
    function errorShown(n) {
      return n && n.nodeType === 1 && n.classList.contains('is-error') && (n.textContent || '').trim();
    }
    new MutationObserver(function (records) {
      if (failed) return;
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        var hit = errorShown(r.target) || Array.prototype.some.call(r.addedNodes || [], errorShown);
        if (hit) {
          failed = true;
          send('tool_error', { tool: slug, stage: done ? 'after_result' : 'before_result' });
          return;
        }
      }
    }).observe(tool, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  }

  function start() {
    loadGa4();
    loadClarity();
    toolEvents();
  }

  /* ---------- banner ---------- */
  function prefix() {
    /* This script's own src tells us how deep the page is. Every page now
       loads it from the root (/assets/analytics.js), and a relative link
       then pointed at /guides/<slug>/privacy/index.html — a 404 behind the
       one link the consent bar offers. A root-absolute src means a
       root-absolute link. */
    var src = (self && self.getAttribute('src')) || '';
    if (src.charAt(0) === '/') return '/';
    var up = src.match(/(\.\.\/)+/);
    return up ? up[0] : '';
  }

  function banner() {
    var wrap = document.createElement('div');
    wrap.className = 'cc';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-label', 'Cookie choice');

    var p = document.createElement('p');
    p.className = 'cc-text';
    p.innerHTML = '<strong>Analytics cookies?</strong> Your files never leave your ' +
      'device either way — this only measures which pages get visited, so the site ' +
      'can be improved. <a href="' + prefix() + PRIVACY + '">What is collected</a>.';

    var actions = document.createElement('div');
    actions.className = 'cc-actions';

    var no = document.createElement('button');
    no.type = 'button';
    no.textContent = 'No thanks';
    no.addEventListener('click', function () { remember('denied'); wrap.remove(); });

    var yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'cc-yes';
    yes.textContent = 'Allow';
    yes.addEventListener('click', function () {
      remember('granted'); wrap.remove(); start();
    });

    actions.appendChild(no);
    actions.appendChild(yes);
    wrap.appendChild(p);
    wrap.appendChild(actions);
    document.body.appendChild(wrap);
    yes.focus();
  }

  /* Lets the privacy page offer a way back. Exposed even when a choice is
     already stored, so it can always be changed. */
  window.ccChoice = {
    get: function () { return refusedBySignal() ? 'denied (browser signal)' : (stored() || 'not set'); },
    set: function (v) {
      remember(v);
      if (v === 'granted') start();
      else location.reload();
    },
    reopen: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    }
  };

  if (refusedBySignal()) return;
  var choice = stored();
  if (choice === 'granted') start();
  else if (choice !== 'denied') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', banner);
    } else banner();
  }
})();
