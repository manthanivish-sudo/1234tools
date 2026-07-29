/* Site shell: theme (light/dark/system), navigation, search, offline. */
(function () {
  'use strict';
  var base = window.__BASE__ || './';
  var doc = document.documentElement;
  var KEY = 'mvr-theme';

  /* ---------- theme: three modes ----------
     'dark'   force dark          'light'  force light
     'system' follow the OS via prefers-color-scheme in CSS
     Default is dark to match mvritservices.com, which is dark-only. */

  function current() {
    try { var t = localStorage.getItem(KEY); return (t === 'light' || t === 'system') ? t : 'dark'; }
    catch (e) { return 'dark'; }
  }

  function resolved(mode) {
    if (mode !== 'system') return mode;
    return (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }

  function paintMeta(mode) {
    // Keep the browser/OS chrome colour in step with what is actually shown.
    var c = resolved(mode) === 'light' ? '#ffffff' : '#06080f';
    var tags = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < tags.length; i++) tags[i].setAttribute('content', c);
  }

  function apply(mode, persist) {
    doc.setAttribute('data-theme', mode);
    paintMeta(mode);
    var btns = document.querySelectorAll('[data-theme-set]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', String(btns[i].dataset.themeSet === mode));
    }
    if (persist) { try { localStorage.setItem(KEY, mode); } catch (e) {} }
  }

  apply(current(), false);

  var switcher = document.querySelector('.theme-switch');
  if (switcher) {
    switcher.addEventListener('click', function (e) {
      var b = e.target.closest('[data-theme-set]');
      if (b) apply(b.dataset.themeSet, true);
    });
  }

  // Repaint chrome when the OS flips and we are following it.
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: light)');
    var onChange = function () { if (current() === 'system') paintMeta('system'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ---------- mobile navigation ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('navlinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- category sidebar ----------
     A persistent rail on wide screens; an off-canvas drawer below,
     where it traps focus and closes on Escape or scrim tap. */
  var sidebar = document.getElementById('sidebar');
  var openBtn = document.getElementById('sidebarOpen');
  var closeBtn = document.getElementById('sidebarClose');
  var scrim = document.getElementById('scrim');

  function setSidebar(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('open', open);
    if (scrim) scrim.hidden = !open;
    document.body.classList.toggle('nav-locked', open);
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    if (open) { var f = sidebar.querySelector('.side-link'); if (f) f.focus(); }
    else if (openBtn) openBtn.focus();
  }

  if (openBtn) openBtn.addEventListener('click', function () { setSidebar(true); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setSidebar(false); });
  if (scrim) scrim.addEventListener('click', function () { setSidebar(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) setSidebar(false);
  });

  /* ---------- footer year ---------- */
  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- search ----------
     Scores title matches: exact > prefix > word-prefix > substring.
     Runs over ~1,000 entries well inside a frame, so no debounce needed. */
  var q = document.getElementById('q');
  var box = document.getElementById('results');
  if (!q || !box) return;

  function score(title, term) {
    var t = title.toLowerCase();
    if (t === term) return 1000;
    if (t.indexOf(term) === 0) return 500;
    var words = t.split(/[\s(),]+/);
    for (var i = 0; i < words.length; i++) {
      if (words[i].indexOf(term) === 0) return 300 - i;
    }
    return t.indexOf(term) > -1 ? 100 : 0;
  }

  /* The index is ~9 KB gzipped. Most visitors arrive from a search
     engine on the exact tool they wanted and never use the box, so it
     is fetched on first interaction rather than on every page load. */
  var indexState = 'idle';
  function ensureIndex(then) {
    if (indexState === 'ready') { then(); return; }
    if (indexState === 'loading') return;
    indexState = 'loading';
    var s = document.createElement('script');
    s.src = base + 'assets/search-index.js';
    s.onload = function () { indexState = 'ready'; then(); };
    s.onerror = function () { indexState = 'idle'; };
    document.head.appendChild(s);
  }

  function search(term) {
    var idx = window.SEARCH_INDEX || [], hits = [];
    for (var i = 0; i < idx.length; i++) {
      var s = score(idx[i][0], term);
      if (s > 0) hits.push([s, idx[i]]);
    }
    hits.sort(function (a, b) { return b[0] - a[0]; });
    return hits.slice(0, 20).map(function (h) { return h[1]; });
  }

  function render(term) {
    if (!term) { box.hidden = true; box.innerHTML = ''; return; }
    var hits = search(term);
    if (!hits.length) {
      box.textContent = '';
      var p = document.createElement('p');
      p.className = 'search-empty';
      p.textContent = 'No tool matches “' + term + '”. Try a unit name, or the quantity you want to work out.';
      box.appendChild(p);
      box.hidden = false;
      return;
    }
    box.innerHTML = hits.map(function (h) {
      return '<a href="' + base + h[1] + '">' +
             '<svg class="ico" aria-hidden="true"><use href="' + base + 'assets/icons.svg#i-' + h[2] + '"></use></svg>' +
             '<span>' + h[0] + '</span></a>';
    }).join('');
    box.hidden = false;
  }

  q.addEventListener('focus', function () { ensureIndex(function () {}); });
  q.addEventListener('input', function () {
    var term = q.value.trim().toLowerCase();
    if (indexState !== 'ready') {
      ensureIndex(function () { render(q.value.trim().toLowerCase()); });
      return;
    }
    render(term);
  });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { q.value = ''; render(''); q.blur(); }
    if (e.key === 'Enter') { var a = box.querySelector('a'); if (a) location.href = a.href; }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-wrap')) render('');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== q &&
        !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); q.focus();
    }
  });

  /* ---------- offline ---------- */
  if ('serviceWorker' in navigator) {
    addEventListener('load', function () {
      navigator.serviceWorker.register(base + 'sw.js').catch(function () {});
    });
  }
})();
