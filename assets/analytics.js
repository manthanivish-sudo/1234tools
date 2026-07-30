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
    '.io-pane', '.io-msg', '.pdf-file-name', '.page-grid', '.stat-val'
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
       property misconfiguration cannot quietly turn it off. */
    gtag('config', GA4, { anonymize_ip: true });
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
    /* Belt and braces: the project must also be set to Strict masking in the
       Clarity dashboard. This call asserts it from the page as well. */
    window.clarity('consent');
  }

  function start() {
    loadGa4();
    loadClarity();
  }

  /* ---------- banner ---------- */
  function prefix() {
    /* This script's own src tells us how deep the page is. */
    var src = (self && self.getAttribute('src')) || '';
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
