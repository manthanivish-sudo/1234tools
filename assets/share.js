/**
 * The share bar on every tool page.
 *
 * build-share.js writes an empty, hidden placeholder into each tool page:
 *
 *   <div class="share" data-share data-share-kind="calc"
 *        data-share-sec="finance" data-share-slug="compound-interest" hidden></div>
 *
 * and this fills it in: WhatsApp, Telegram, X, Facebook, LinkedIn, Reddit and
 * email as plain intent links, Copy link, a QR code of the link, and on the
 * calculators an embed snippet and a downloadable result card. On a phone with
 * a share sheet, a "Share…" button comes first.
 *
 * What it does not do:
 *
 * - load anything from anyone. Every channel is a URL the visitor's own click
 *   opens; no button, SDK or pixel from any network is on the page. The one
 *   script it may fetch is /engine/qr.bundle.js, from this site, on the first
 *   click on QR or Result card.
 * - send the figures anywhere. A tool's figures go in a link only when the
 *   visitor ticks "Include my figures", which is off on every page load and
 *   never remembered. They then travel after the # of the link
 *   (…/compound-interest/?utm_source=whatsapp…#principal=5000), and a fragment
 *   is never sent to any server: not ours, not GitHub's, not to analytics.
 * - store anything. No cookie, no localStorage.
 *
 * The figures come from the tool itself. An engine that can reproduce its
 * result from a link announces what it would put in one (an mvr:result event,
 * and MVRTool.shareState() for a bar that boots late). Pages whose work is a
 * file — PDF, image, AI — announce nothing and share the tool alone.
 *
 * window.MVRShare exposes card() → Promise<Blob> and url(channel, figures)
 * for the browser test.
 */
(function () {
  'use strict';

  var host = document.querySelector('[data-share]');
  if (!host) return;

  var SITE_NAME = '1234Tools';
  var FIG_KINDS = { calc: 1, converter: 1, currency: 1 };
  var TXT_KINDS = { code: 1, qr: 1 };
  var EMBED_HEIGHT = { calc: 640, converter: 560, currency: 600 };
  var TOGGLE_LABEL = {
    calc: 'Include my figures', converter: 'Include my figures', currency: 'Include my figures',
    code: 'Include my text', qr: 'Include this code’s content'
  };

  /* ---------- the page's own facts ---------- */

  function readHead() {
    var h1 = document.querySelector('article h1');
    var title = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
    if (!title) {
      var ogt = document.querySelector('meta[property="og:title"]');
      title = ogt ? String(ogt.getAttribute('content') || '').replace(/\s+[—|].*$/, '').trim() : document.title;
    }
    var d = document.querySelector('meta[name="description"]');
    var c = document.querySelector('link[rel="canonical"]');
    var canonical = location.origin + location.pathname;
    try { if (c && c.href) { var cu = new URL(c.href); cu.search = ''; cu.hash = ''; canonical = cu.href; } } catch (e) { /* keep the address */ }
    /* The section's name as the page's own breadcrumb says it. */
    var crumb = document.querySelectorAll('.crumbs li a');
    return {
      title: title,
      description: d ? String(d.getAttribute('content') || '').trim() : '',
      canonical: canonical,
      sec: host.getAttribute('data-share-sec') || '',
      slug: host.getAttribute('data-share-slug') || '',
      kind: host.getAttribute('data-share-kind') || 'io',
      warn: host.getAttribute('data-share-warn') || '',
      secName: crumb.length > 1 ? crumb[1].textContent.trim() : ''
    };
  }

  var meta = readHead();
  var kind = meta.kind;
  var isAI = meta.sec === 'ai';
  var state = null;

  /* ---------- links ---------- */

  function hasParams(s) { return !!(s && s.params && Object.keys(s.params).length); }

  function url(channel, withFigures) {
    var u = new URL(meta.canonical);
    u.search = ''; u.hash = '';
    if (channel === 'embed') u.searchParams.set('embed', '1');
    u.searchParams.set('utm_source', channel);
    u.searchParams.set('utm_medium', 'share');
    u.searchParams.set('utm_campaign', meta.sec);
    u.searchParams.set('utm_content', meta.slug);
    if (withFigures && hasParams(state)) {
      var f = new URLSearchParams();
      Object.keys(state.params).forEach(function (k) { f.set(k, state.params[k]); });
      u.hash = f.toString();
    }
    return u.href;
  }

  var enc = encodeURIComponent;

  /* Cut at a word boundary and say so. */
  function clip(s, n) {
    s = String(s || '');
    if (s.length <= n) return s;
    var cut = s.slice(0, n - 1);
    var sp = cut.lastIndexOf(' ');
    if (sp > n * 0.6) cut = cut.slice(0, sp);
    return cut.replace(/[\s,;:.—-]+$/, '') + '…';
  }

  /* ---------- embed mode: the tool alone, inside somebody else's page ---------- */

  if (document.documentElement.classList.contains('is-embed')) {
    embedMode();
    return;
  }

  function embedMode() {
    var after = document.querySelector('.tool .calc') || document.querySelector('.tool .tool-io');
    if (after) {
      var p = document.createElement('p');
      p.className = 'embed-credit';
      var a1 = document.createElement('a');
      a1.href = url('embed-credit', false); a1.target = '_blank'; a1.rel = 'noopener';
      a1.textContent = SITE_NAME;
      var lead = document.createElement('span');
      lead.appendChild(document.createTextNode('Powered by '));
      lead.appendChild(a1);
      var a2 = document.createElement('a');
      a2.href = url('embed-open', false); a2.target = '_blank'; a2.rel = 'noopener';
      a2.textContent = 'Open the full tool ↗';
      p.appendChild(lead);
      p.appendChild(a2);
      after.parentNode.insertBefore(p, after.nextSibling);
    }
    /* The host page keeps the frame: any link inside the tool opens a tab. */
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (a && !a.getAttribute('target')) { a.target = '_blank'; a.rel = 'noopener'; }
    }, true);
  }

  /* ---------- icons: 24x24 strokes in the sprite's style ---------- */

  var ICON = {
    native: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
    whatsapp: '<path d="M3.6 20.4l1.2-3.9a8.6 8.6 0 1 1 3.3 3.1z"/><path d="M9.2 8.2c-.3 2.9 2.5 6 5.5 6.3l1.2-1.4-1.8-1-1 .8a4.4 4.4 0 0 1-2.4-2.4l.8-1-1-1.8z"/>',
    telegram: '<path d="M21.5 3.6L2.6 11l6.2 2.3 2.4 6.9 3.3-4.3 4.8 3.4z"/><path d="M8.8 13.3L21.5 3.6"/>',
    x: '<path d="M4.5 4.5l15 15M19.5 4.5l-15 15"/>',
    facebook: '<path d="M14.5 21v-8h3l.4-3.4h-3.4V7.6c0-1 .3-1.7 1.7-1.7H18V3c-.3 0-1.4-.1-2.7-.1-2.6 0-4.4 1.6-4.4 4.6v2.1H8V13h2.9v8"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.8 10.5v6M7.8 7.6v.01M11.4 16.5v-6M11.4 13.2c0-1.7 1-2.7 2.4-2.7s2.2.9 2.2 2.7v3.3"/>',
    reddit: '<ellipse cx="12" cy="14.5" rx="8" ry="5.5"/><path d="M12 9l1.2-5 3.6.9"/><circle cx="18.6" cy="5.2" r="1.4"/><path d="M9 13.4v.01M15 13.4v.01M9.4 16.6c1.6 1 3.6 1 5.2 0"/>',
    email: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.6 7l8.4 6 8.4-6"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    qr: '<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h2.5v2.5M20.5 14.5v.01M14.5 20.5h.01M18 18h2.5v2.5"/>',
    embed: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.6 4.5l-3.2 15"/>',
    card: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 16l5-5 4 4 2.5-2.5 5.5 5.5"/><circle cx="15.5" cy="9" r="1.5"/>'
  };
  /* The platforms' own marks, filled, in their own colours (set in CSS by
     data-ch). A person finds the green WhatsApp bubble faster than they
     read the word, which is the point of a share row. Paths from Simple
     Icons 13.21 (CC0-1.0); the marks themselves belong to their owners,
     whose brand guidelines allow them on share buttons. */
  var BRAND = {
    whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
    telegram: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
    x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
    facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
    linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    reddit: 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z'
  };
  function svg(name) {
    if (BRAND[name]) return '<svg class="ico ico-brand" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="' + BRAND[name] + '"/></svg>';
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON[name] + '</svg>';
  }

  /* ---------- the bar ---------- */

  var CHANNELS = [
    ['whatsapp', 'WhatsApp', 'Share on WhatsApp'],
    ['telegram', 'Telegram', 'Share on Telegram'],
    ['x', 'X', 'Share on X'],
    ['facebook', 'Facebook', 'Share on Facebook'],
    ['linkedin', 'LinkedIn', 'Share on LinkedIn'],
    ['reddit', 'Reddit', 'Share on Reddit'],
    ['email', 'Email', 'Share by email']
  ];

  var canFigures = !!(FIG_KINDS[kind] || TXT_KINDS[kind]);
  var canEmbed = !!FIG_KINDS[kind];
  var canNative = typeof navigator.share === 'function';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function button(ch, label, aria, extraCls) {
    var b = el('button', 'share-btn' + (extraCls ? ' ' + extraCls : ''));
    b.type = 'button';
    b.setAttribute('data-ch', ch);
    b.setAttribute('aria-label', aria);
    b.innerHTML = svg(ch) + '<span></span>';
    b.lastChild.textContent = label;
    return b;
  }

  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', kind === 'page' ? 'Share this page' : 'Share this tool');
  host.textContent = '';

  var head = el('div', 'share-head');
  head.appendChild(el('span', 'share-title', 'Share'));
  var toggleWrap = el('label', 'share-toggle');
  toggleWrap.hidden = true;
  var toggle = el('input');
  toggle.type = 'checkbox';
  toggle.id = 'share-figures';
  toggle.checked = false;
  var toggleText = el('span', 'share-toggle-text', TOGGLE_LABEL[kind] || 'Include my figures');
  if (meta.warn === 'pay') toggleText.appendChild(el('span', 'share-warn', 'This link will contain your pay figures'));
  toggleWrap.appendChild(toggle);
  toggleWrap.appendChild(toggleText);
  if (canFigures) head.appendChild(toggleWrap);
  host.appendChild(head);

  var resultLine = el('p', 'share-result');
  resultLine.hidden = true;
  host.appendChild(resultLine);

  var row = el('div', 'share-row');
  var nativeBtn = null;
  if (canNative) {
    nativeBtn = button('native', 'Share…', 'Share…', 'share-native');
    row.appendChild(nativeBtn);
  }
  var anchors = {};
  CHANNELS.forEach(function (c) {
    var a = el('a', 'share-btn' + (BRAND[c[0]] ? ' is-brand' : ''));
    a.setAttribute('data-ch', c[0]);
    a.setAttribute('aria-label', c[2]);
    if (c[0] !== 'email') { a.target = '_blank'; a.rel = 'noopener'; }
    a.innerHTML = svg(c[0]) + '<span></span>';
    a.lastChild.textContent = c[1];
    anchors[c[0]] = a;
    row.appendChild(a);
  });
  var sep = el('span', 'share-sep');
  sep.setAttribute('aria-hidden', 'true');
  row.appendChild(sep);
  var copyBtn = button('copy', 'Copy link', 'Copy link');
  row.appendChild(copyBtn);
  var qrBtn = button('qr', 'QR', 'Show link as QR code');
  qrBtn.setAttribute('aria-expanded', 'false');
  qrBtn.setAttribute('aria-controls', 'share-pop');
  row.appendChild(qrBtn);
  var embedBtn = null, cardBtn = null;
  if (canEmbed) {
    embedBtn = button('embed', 'Embed', 'Embed this tool');
    embedBtn.setAttribute('aria-expanded', 'false');
    embedBtn.setAttribute('aria-controls', 'share-pop');
    row.appendChild(embedBtn);
    cardBtn = button('card', 'Result card', 'Download a result card');
    row.appendChild(cardBtn);
  }
  host.appendChild(row);

  var status = el('div', 'share-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  host.appendChild(status);

  var pop = el('div', 'share-pop');
  pop.id = 'share-pop';
  pop.setAttribute('role', 'dialog');
  pop.hidden = true;
  host.appendChild(pop);

  host.hidden = false;

  /* ---------- text ---------- */

  /* Figures go with the link only when the box is ticked, and only when the
     tool has something to carry. */
  function F() {
    return !!(canFigures && toggle.checked && !toggleWrap.hidden && state && (state.summary || hasParams(state)));
  }

  function messages() {
    var T = meta.title, D = clip(meta.description, 160), S = state && state.summary;
    var fig = F();
    var text = fig && S ? S + ' — ' + T + ', free on ' + SITE_NAME : T + ' — ' + D;
    var redditTitle = fig && S ? S + ' — ' + T : T + (isAI ? ' (free to try)' : (kind === 'page' ? ' — ' + SITE_NAME : ' (free, runs in your browser)'));
    return { T: T, text: text, redditTitle: redditTitle, fig: fig };
  }

  function hrefs() {
    var m = messages(), fig = m.fig;
    anchors.whatsapp.href = 'https://wa.me/?text=' + enc(m.text + '\n' + url('whatsapp', fig));
    anchors.telegram.href = 'https://t.me/share/url?url=' + enc(url('telegram', fig)) + '&text=' + enc(m.text);
    /* X counts any URL as 23 characters, so 256 of text keeps the post
       inside 280 with the space and the link. */
    anchors.x.href = 'https://x.com/intent/post?text=' + enc(clip(m.text, 256)) + '&url=' + enc(url('x', fig));
    anchors.facebook.href = 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url('facebook', fig));
    anchors.linkedin.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(url('linkedin', fig));
    anchors.reddit.href = 'https://www.reddit.com/submit?url=' + enc(url('reddit', fig)) + '&title=' + enc(clip(m.redditTitle, 300));
    anchors.email.href = 'mailto:?subject=' + enc(m.T + ' — ' + SITE_NAME) + '&body=' + enc(m.text + '\n\n' + url('email', fig));
  }

  function update(s) {
    state = s || null;
    if (canFigures) {
      var show = !!(state && state.changed && (state.summary || hasParams(state)));
      if (!show && toggle.checked) toggle.checked = false;
      toggleWrap.hidden = !show;
    }
    var fig = F();
    if (fig) {
      resultLine.textContent = '';
      if (state.summary) {
        resultLine.appendChild(document.createTextNode('Sharing: '));
        resultLine.appendChild(el('strong', null, state.summary));
      } else {
        resultLine.textContent = 'Sharing the link with what you entered';
      }
    }
    resultLine.hidden = !fig;
    hrefs();
    if (!pop.hidden) renderPop(pop.getAttribute('data-mode'));
  }

  /* ---------- analytics, only where the visitor already said yes ---------- */

  function track(method) {
    if (typeof window.gtag !== 'function') return;
    try {
      window.gtag('event', 'share', {
        method: method,
        content_type: kind === 'page' ? 'page' : 'tool',
        item_id: meta.sec + '/' + meta.slug,
        with_figures: F() ? 1 : 0
      });
    } catch (e) { /* analytics never breaks the page */ }
  }

  /* ---------- copy ---------- */

  function copyText(text) {
    var fallback = function () {
      try {
        var ta = el('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = !!(document.execCommand && document.execCommand('copy'));
        ta.remove();
        return ok;
      } catch (e) { return false; }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve(fallback());
  }

  var statusTimer = 0;
  function say(msg) {
    status.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { status.textContent = ''; }, 4000);
  }

  function done(btn, label) {
    var span = btn.querySelector('span');
    var was = span.textContent;
    span.textContent = label;
    btn.classList.add('is-done');
    setTimeout(function () { span.textContent = was; btn.classList.remove('is-done'); }, 1500);
  }

  /* ---------- the QR engine, from this site, on demand ---------- */

  var qrLoading = null;
  function loadQR() {
    if (window.QR && typeof window.QR.encode === 'function') return Promise.resolve(window.QR);
    if (qrLoading) return qrLoading;
    qrLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/engine/qr.bundle.js';
      s.onload = function () { window.QR ? resolve(window.QR) : reject(new Error('no QR')); };
      s.onerror = function () { qrLoading = null; reject(new Error('could not load')); };
      document.head.appendChild(s);
    });
    return qrLoading;
  }

  /* ---------- the popover: QR of the link, or the embed code ---------- */

  var opener = null;
  function renderPop(mode) {
    pop.textContent = '';
    pop.setAttribute('data-mode', mode);
    var acts = el('div', 'io-actions');
    if (mode === 'qr') {
      pop.setAttribute('aria-label', 'QR code for this link');
      var link = url('qr', F());
      var box = el('div', 'share-qr-result');
      pop.appendChild(box);
      var line = el('p', 'share-url share-result-url', link);
      pop.appendChild(line);
      loadQR().then(function (QR) {
        if (pop.getAttribute('data-mode') !== 'qr' || pop.hidden) return;
        var markup = QR.toSVG(QR.encode(link, 'M'), { scale: 6, quiet: 4, dark: '#06080f', light: '#ffffff' });
        box.innerHTML = markup;           // produced by the site's own QR engine
        var dl = el('a', 'btn-ghost', 'Download SVG');
        dl.href = 'data:image/svg+xml;charset=utf-8,' + enc(markup);
        dl.setAttribute('download', (meta.slug.split('/').pop() || 'link') + '-link.svg');
        acts.insertBefore(dl, acts.firstChild);
      }, function () {
        say('Could not load the QR engine');
      });
    } else {
      pop.setAttribute('aria-label', 'Embed code');
      var ta = el('textarea', 'share-embed-result');
      ta.readOnly = true;
      ta.setAttribute('aria-label', 'Embed code');
      ta.value = embedCode();
      pop.appendChild(ta);
      var cp = el('button', 'btn-ghost', 'Copy embed code');
      cp.type = 'button';
      cp.addEventListener('click', function () {
        copyText(ta.value).then(function (ok) {
          say(ok ? 'Embed code copied' : 'Could not copy — select the code instead');
          if (ok) { cp.textContent = 'Copied'; setTimeout(function () { cp.textContent = 'Copy embed code'; }, 1500); }
        });
        track('embed');
      });
      acts.appendChild(cp);
    }
    var close = el('button', 'btn-ghost share-close', 'Close');
    close.type = 'button';
    close.addEventListener('click', function () { closePop(); });
    acts.appendChild(close);
    pop.appendChild(acts);
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function embedCode() {
    var src = url('embed', F());
    return '<iframe src="' + escHtml(src) + '" width="100%" height="' + (EMBED_HEIGHT[kind] || 600) +
      '" style="border:0;border-radius:12px;max-width:720px" loading="lazy" title="' + escHtml(meta.title + ' — ' + SITE_NAME) + '"></iframe>\n' +
      '<p style="font:14px system-ui"><a href="' + escHtml(meta.canonical) + '">' + escHtml(meta.title) + '</a> by ' + SITE_NAME +
      ' — free, runs in the browser.</p>';
  }

  function openPop(mode, btn) {
    [qrBtn, embedBtn].forEach(function (b) { if (b) b.setAttribute('aria-expanded', 'false'); });
    opener = btn;
    renderPop(mode);
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  }

  function closePop() {
    if (pop.hidden) return;
    pop.hidden = true;
    pop.textContent = '';
    pop.removeAttribute('data-mode');
    [qrBtn, embedBtn].forEach(function (b) { if (b) b.setAttribute('aria-expanded', 'false'); });
    if (opener) opener.focus();
  }

  host.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !pop.hidden) { e.preventDefault(); closePop(); }
  });

  /* ---------- wiring ---------- */

  Object.keys(anchors).forEach(function (ch) {
    anchors[ch].addEventListener('click', function () { track(ch); });
  });

  copyBtn.addEventListener('click', function () {
    var link = url('copy', F());
    copyText(link).then(function (ok) {
      if (ok) { done(copyBtn, 'Copied'); say('Link copied'); }
      else say('Could not copy — select the address bar instead');
    });
    track('copy');
  });

  qrBtn.addEventListener('click', function () {
    if (!pop.hidden && pop.getAttribute('data-mode') === 'qr') { closePop(); return; }
    openPop('qr', qrBtn);
    track('qr');
  });

  if (embedBtn) {
    embedBtn.addEventListener('click', function () {
      if (!pop.hidden && pop.getAttribute('data-mode') === 'embed') { closePop(); return; }
      openPop('embed', embedBtn);
    });
  }

  if (nativeBtn) {
    nativeBtn.addEventListener('click', function () {
      var m = messages();
      track('native');
      try {
        var p = navigator.share({ title: m.T, text: m.text, url: url('native', m.fig) });
        if (p && p.catch) p.catch(function () { /* cancelled: say nothing */ });
      } catch (e) { /* no share sheet after all */ }
    });
  }

  if (cardBtn) {
    cardBtn.addEventListener('click', function () {
      say('Drawing the card…');
      track('card');
      card().then(function (blob) {
        var name = (meta.slug.split('/').pop() || 'result') + '-1234tools.png';
        var file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
        if (file && navigator.canShare && navigator.share) {
          var ok = false;
          try { ok = navigator.canShare({ files: [file] }); } catch (e) { ok = false; }
          if (ok) {
            say('');
            var p = navigator.share({ files: [file], title: meta.title, text: messages().text });
            if (p && p.catch) p.catch(function () { /* cancelled */ });
            return;
          }
        }
        var href = URL.createObjectURL(blob);
        var a = el('a');
        a.href = href; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(href); }, 2000);
        say('Card saved');
      }, function () { say('Could not draw the card'); });
    });
  }

  toggle.addEventListener('change', function () { update(state); });

  /* A shared link opened while this same page is already open changes only
     the fragment, which does not reload by itself. */
  if (canFigures) {
    window.addEventListener('hashchange', function () {
      if (/=/.test(location.hash)) location.reload();
    });
  }

  /* ---------- the result card: 1080 x 1080 PNG ---------- */

  /* What the page shows, read from the page, so currency and grouping
     preferences come out exactly as the reader sees them. */
  function readRows() {
    var box = document.querySelector('.tool .tool-results');
    if (!box) return { primary: null, rest: [] };
    var all = Array.prototype.slice.call(box.querySelectorAll('.result')).map(function (r) {
      var l = r.querySelector('.result-label'), v = r.querySelector('.result-value');
      return { label: l ? l.textContent.trim() : '', value: v ? v.textContent.trim() : '', primary: r.classList.contains('result-primary'), node: r };
    }).filter(function (r) { return r.value; });
    var primary = all.filter(function (r) { return r.primary; })[0] || all[0] || null;
    var rest = all.filter(function (r) { return r !== primary && r.label && !/^source$/i.test(r.label); }).slice(0, 3);
    return { primary: primary, rest: rest };
  }

  function loadImg(src) {
    return new Promise(function (resolve, reject) {
      var i = new Image();
      i.onload = function () { resolve(i); };
      i.onerror = reject;
      i.src = src;
    });
  }

  function card() {
    var W = 1080, PAD = 72, R = 1008;
    var fonts = document.fonts && document.fonts.load ? [
      document.fonts.load('800 96px "Sora"'), document.fonts.load('700 54px "Sora"'),
      document.fonts.load('500 30px "Inter"'), document.fonts.load('600 30px "Inter"')
    ].map(function (p) { return p.catch(function () {}); }) : [];
    var link = url('card', F());
    return Promise.all([
      Promise.all(fonts),
      loadImg('/assets/img/logo.svg').catch(function () { return null; }),
      loadQR().catch(function () { return null; })
    ]).then(function (got) {
      var logo = got[1], QR = got[2];
      var c = document.createElement('canvas');
      c.width = W; c.height = W;
      var x = c.getContext('2d');
      var spacing = function (v) { if ('letterSpacing' in x) x.letterSpacing = v; };

      x.fillStyle = '#06080f';
      x.fillRect(0, 0, W, W);
      [[-120, -160, 'rgba(247,201,72,.17)', 'rgba(247,201,72,0)'], [1200, 1180, 'rgba(124,92,255,.16)', 'rgba(124,92,255,0)']].forEach(function (g) {
        var grad = x.createRadialGradient(g[0], g[1], 0, g[0], g[1], 700);
        grad.addColorStop(0, g[2]); grad.addColorStop(1, g[3]);
        x.fillStyle = grad;
        x.fillRect(0, 0, W, W);
      });

      /* brand row */
      if (logo) x.drawImage(logo, PAD, 72, 56, 56);
      x.textBaseline = 'alphabetic';
      x.fillStyle = '#f4f6fb';
      x.font = '700 34px "Sora", sans-serif';
      x.fillText(SITE_NAME, 144, 112);

      /* section pill, right-aligned */
      var secLabel = (meta.secName || meta.sec || '').toUpperCase();
      if (secLabel) {
        x.font = '600 22px "Inter", sans-serif';
        spacing('2.6px');
        var tw = Math.min(x.measureText(secLabel).width, 520);
        var pw = tw + 44, px0 = R - pw;
        roundRect(x, px0, 72, pw, 44, 22);
        x.strokeStyle = 'rgba(247,201,72,.32)'; x.lineWidth = 1.5; x.stroke();
        x.fillStyle = '#d8dfef';
        x.fillText(secLabel, px0 + 22, 102, 520);
        spacing('0px');
      }

      /* title: up to two lines, shrinking before it clamps */
      var size = 54, lines;
      [54, 44, 38].some(function (s) {
        size = s;
        x.font = '700 ' + s + 'px "Sora", sans-serif';
        lines = wrap(x, meta.title, 936);
        return lines.length <= 2;
      });
      lines = clampLines(x, lines, 2, 936);
      x.fillStyle = '#f4f6fb';
      lines.forEach(function (ln, i) { x.fillText(ln, PAD, 196 + i * Math.round(size * 1.18)); });

      /* the answer */
      var rows = readRows();
      if (rows.primary) {
        x.font = '500 28px "Inter", sans-serif';
        spacing('2.2px');
        x.fillStyle = 'rgba(247,201,72,.62)';
        x.fillText(fit(x, (rows.primary.label || 'Result').toUpperCase(), 936), PAD, 352);
        spacing('0px');
        var vs = 96;
        do { x.font = '800 ' + vs + 'px "Sora", sans-serif'; } while (x.measureText(rows.primary.value).width > 936 && (vs -= 4) >= 64);
        x.save();
        x.shadowColor = 'rgba(247,201,72,.3)'; x.shadowBlur = 26;
        x.fillStyle = '#f7c948';
        x.fillText(fit(x, rows.primary.value, 936), PAD, 462);
        x.restore();
      }
      rows.rest.forEach(function (r, i) {
        var y = 540 + i * 68;
        x.font = '600 32px "Inter", sans-serif';
        var val = fit(x, r.value, 560);
        var vw = x.measureText(val).width;
        x.fillStyle = '#d5dceb';
        x.textAlign = 'right';
        x.fillText(val, R, y);
        x.textAlign = 'left';
        x.font = '500 28px "Inter", sans-serif';
        x.fillStyle = '#8790a5';
        x.fillText(fit(x, r.label, 936 - vw - 28), PAD, y);
        x.fillStyle = 'rgba(255,255,255,.08)';
        x.fillRect(PAD, y + 24, 936, 1);
      });

      /* footer */
      x.fillStyle = 'rgba(255,255,255,.09)';
      x.fillRect(PAD, 868, 724, 1);
      x.font = '600 30px "Inter", sans-serif';
      x.fillStyle = '#f7c948';
      var path = '1234tools.com' + new URL(meta.canonical).pathname;
      x.fillText(fit(x, path, 720), PAD, 930);
      x.font = '500 24px "Inter", sans-serif';
      x.fillStyle = '#8790a5';
      x.fillText('Free · runs in your browser · no account', PAD, 972);

      /* QR tile: the link, scannable from the picture */
      var T0 = 824, TS = 184;
      roundRect(x, T0, T0, TS, TS, 16);
      x.fillStyle = '#ffffff';
      x.fill();
      if (QR) {
        try {
          var q = QR.encode(link, 'M');
          var n = q.size + 4;
          var m = Math.floor((TS - 8) / n);
          var off = T0 + Math.floor((TS - m * n) / 2) + 2 * m;
          x.fillStyle = '#06080f';
          for (var r = 0; r < q.size; r++) {
            for (var col = 0; col < q.size; col++) {
              if (q.matrix[r][col] === 1) x.fillRect(off + col * m, off + r * m, m, m);
            }
          }
        } catch (e) { /* a card without a code is still a card */ }
      }

      return new Promise(function (resolve, reject) {
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob failed')); }, 'image/png');
      });
    });
  }

  function roundRect(x, X, Y, w, h, r) {
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + w, Y, X + w, Y + h, r);
    x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r);
    x.arcTo(X, Y, X + w, Y, r);
    x.closePath();
  }

  function wrap(x, text, maxW) {
    var words = String(text).split(/\s+/), out = [], cur = '';
    words.forEach(function (w) {
      var next = cur ? cur + ' ' + w : w;
      if (x.measureText(next).width <= maxW || !cur) cur = next;
      else { out.push(cur); cur = w; }
    });
    if (cur) out.push(cur);
    return out;
  }

  function clampLines(x, lines, n, maxW) {
    if (lines.length <= n) return lines;
    var keep = lines.slice(0, n);
    keep[n - 1] = fit(x, keep[n - 1] + ' ' + lines.slice(n).join(' '), maxW);
    return keep;
  }

  function fit(x, s, maxW) {
    s = String(s);
    if (x.measureText(s).width <= maxW) return s;
    while (s.length > 1 && x.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s.replace(/\s+$/, '') + '…';
  }

  /* ---------- start ---------- */

  window.MVRShare = { card: card, url: url, state: function () { return state; } };

  update(window.MVRTool && typeof window.MVRTool.shareState === 'function' ? window.MVRTool.shareState() : null);
  document.addEventListener('mvr:result', function (e) { update(e.detail); });
})();
