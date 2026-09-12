/**
 * Per-tool install prompt.
 *
 * A tool page that carries its own manifest can be installed as its own app,
 * with its own icon and its own window. This offers that, once, at a moment
 * when the visitor has shown the tool is useful to them.
 *
 * What this deliberately does not do, because no web page can:
 *
 *   - install anything without the person choosing to. Chrome only fires
 *     beforeinstallprompt after its own engagement heuristics are satisfied,
 *     the prompt has to be triggered by a real click, and it can be shown
 *     once per event.
 *   - install anything at all on iOS. There is no API. Safari requires
 *     Share -> Add to Home Screen by hand, so all we can do is say so
 *     clearly, with the right words for the browser in front of us.
 *
 * So the offer is dismissible, remembers a refusal for a month, and never
 * reappears once the app is installed.
 */
(function () {
  'use strict';

  var MONTH = 30 * 24 * 60 * 60 * 1000;

  var manifest = document.querySelector('link[rel="manifest"]');
  var toolName = (document.querySelector('h1') || {}).textContent || 'this tool';
  toolName = toolName.trim();

  /* Only pages that carry their own manifest are installable on their own. */
  if (!manifest || !/\.webmanifest$/.test(manifest.getAttribute('href') || '')) return;

  /* Each tool installs as its own app, so a refusal has to be remembered per
     tool. A single key would mean turning down the generator silently took the
     scanner's offer away with it — they share an origin, not an identity. */
  var KEY = 'mvr-install-dismissed:' +
            manifest.getAttribute('href').replace(/^.*\//, '').replace(/\.webmanifest$/, '');

  var deferred = null;
  var banner = null;

  function standalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           window.navigator.standalone === true;
  }

  function dismissedRecently() {
    try {
      var at = Number(localStorage.getItem(KEY) || 0);
      return at && (Date.now() - at) < MONTH;
    } catch (e) { return false; }
  }

  function remember() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  }

  /* Running as an installed app: drop the site furniture, it is an app now. */
  if (standalone()) {
    document.documentElement.classList.add('is-installed');
    return;
  }

  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  var isFirefox = /firefox|fxios/i.test(ua);

  /** The exact words for the browser in front of the reader. */
  function instructions() {
    if (isIOS && isSafari) {
      return ['Add it to your Home Screen',
        'Tap the Share button at the bottom of Safari, choose “Add to Home Screen”, then tap Add. ' +
        toolName + ' then opens like an app, full screen and without the address bar.'];
    }
    if (isIOS) {
      return ['Open this page in Safari first',
        'Only Safari can add a page to the iPhone Home Screen. Open this page there, tap Share, ' +
        'then choose “Add to Home Screen”.'];
    }
    if (isFirefox) {
      return ['Add it to your Home Screen',
        'Open the menu and choose “Install” or “Add to Home screen”. On desktop Firefox there is ' +
        'no install option, so a bookmark is the nearest thing.'];
    }
    return ['Install ' + toolName,
      'Open your browser menu and look for “Install app” or “Add to Home screen”. ' +
      'Your browser decides when to offer this, so it may appear after you have used the page once or twice.'];
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---- the offer ---- */

  var consentWatch = null;

  function showBanner() {
    if (banner || standalone() || dismissedRecently()) return;

    /* The cookie choice comes first. Two bars stacked at the bottom of a phone
       is one too many, and consent is the more pressing question of the two,
       so wait for that banner to go before offering anything. */
    if (document.querySelector('.cc')) {
      if (!consentWatch && window.MutationObserver) {
        consentWatch = new MutationObserver(function () {
          if (document.querySelector('.cc')) return;
          consentWatch.disconnect();
          consentWatch = null;
          showBanner();
        });
        consentWatch.observe(document.body, { childList: true });
      }
      return;
    }

    banner = el('div', 'install-bar');
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Install this tool');

    var icon = document.createElement('img');
    var iconHref = (document.querySelector('link[rel="apple-touch-icon"]') || {}).href;
    if (iconHref) {
      icon.src = iconHref;
      icon.alt = '';
      icon.width = 44;
      icon.height = 44;
      icon.className = 'install-icon';
      banner.appendChild(icon);
    }

    var copy = el('div', 'install-copy');
    copy.appendChild(el('strong', null, 'Keep ' + toolName + ' on your device'));
    copy.appendChild(el('span', null, deferred
      ? 'Installs as its own app. It works offline, and nothing you scan or type leaves the device.'
      : instructions()[1]));
    banner.appendChild(copy);

    var actions = el('div', 'install-actions');
    if (deferred) {
      var install = el('button', 'btn-primary', 'Install');
      install.type = 'button';
      install.addEventListener('click', run);
      actions.appendChild(install);
    }
    var no = el('button', 'btn-ghost', deferred ? 'Not now' : 'Got it');
    no.type = 'button';
    no.addEventListener('click', function () {
      remember();
      hide();
    });
    actions.appendChild(no);
    banner.appendChild(actions);

    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('is-up'); });
  }

  function hide() {
    if (!banner) return;
    banner.classList.remove('is-up');
    var gone = banner;
    banner = null;
    setTimeout(function () { if (gone.parentNode) gone.parentNode.removeChild(gone); }, 300);
  }

  /** The prompt can only be opened from a real click, and only once. */
  function run() {
    if (!deferred) return;
    var prompt = deferred;
    deferred = null;
    hide();
    prompt.prompt();
    prompt.userChoice.then(function (choice) {
      if (choice && choice.outcome !== 'accepted') remember();
      renderPanel();
    }).catch(function () {});
  }

  /* ---- the always-available panel, for anyone who dismissed the bar ---- */

  var panel = null;
  function renderPanel() {
    var host = document.querySelector('.tool') || document.querySelector('main');
    if (!host) return;
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    if (standalone()) return;

    panel = el('section', 'panel install-panel');
    var words = instructions();
    panel.appendChild(el('h2', null, deferred ? 'Install this tool' : words[0]));
    panel.appendChild(el('p', null, deferred
      ? toolName + ' can be installed as its own app, with its own icon. It opens full screen, ' +
        'works with no connection at all, and still runs entirely on your device.'
      : words[1]));

    if (deferred) {
      var b = el('button', 'btn-primary', 'Install ' + toolName);
      b.type = 'button';
      b.addEventListener('click', run);
      panel.appendChild(b);
    }

    var io = host.querySelector('.tool-io');
    if (io && io.nextSibling) host.insertBefore(panel, io.nextSibling);
    else host.appendChild(panel);
  }

  /* ---- wiring ---- */

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    renderPanel();
    if (used) showBanner();
  });

  window.addEventListener('appinstalled', function () {
    remember();
    hide();
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
  });

  /* Wait until the tool has actually been used before interrupting. A prompt
     shown before someone knows what the page does is just an obstacle. */
  var used = false;
  function markUsed() {
    if (used) return;
    used = true;
    setTimeout(showBanner, 1200);
  }
  document.addEventListener('mvr:tool-used', markUsed);

  document.addEventListener('DOMContentLoaded', function () {
    renderPanel();
    // iOS gets no event, so the offer is time-based there and on any browser
    // that never fires one.
    setTimeout(function () { if (!used) markUsed(); }, 45000);
  });
})();
