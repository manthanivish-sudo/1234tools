/* Site shell: theme (light/dark/system), navigation, search, offline. */
(function () {
  'use strict';
  var base = window.__BASE__ || './';
  var doc = document.documentElement;
  var KEY = '1234tools-theme';

  /* ---------- theme: three modes ----------
     'dark'   force dark          'light'  force light
     'system' follow the OS via prefers-color-scheme in CSS
     Default is dark. */

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

  /* ---------- header height ----------
     Sticky parts of the page sit below the header (app.css, --hdr-h). Its
     height changes with the width and when the menu opens, so it is
     measured rather than guessed; a hidden header measures 0. */
  var hdr = document.querySelector('.site-header');
  if (hdr) {
    var setHdrH = function () { doc.style.setProperty('--hdr-h', hdr.offsetHeight + 'px'); };
    setHdrH();
    if (window.ResizeObserver) new ResizeObserver(setHdrH).observe(hdr);
    else window.addEventListener('resize', setHdrH);
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
     Scores title matches. One word: exact > prefix > word-prefix > substring,
     as it always was. Several words are an AND: every typed word must start
     a word of the title — "invoice extractor" finds "Invoice & Receipt Data
     Extractor", "km miles" finds "Convert Kilometer to Mile" — ranked under
     an exact or whole-prefix match and above a plain substring. Runs over
     ~1,300 entries well inside a frame, so no debounce needed. */
  var q = document.getElementById('q');
  var box = document.getElementById('results');
  if (!q || !box) return;

  /* What breaks a title into words. Punctuation is a separator, not a word:
     "Invoice & Receipt" is two words, "Take-Home" is two, "Hash (SHA-256)"
     is three. */
  var SEP = /[\s&(),\/\-]+/;

  /* The short forms people type for units, mapped to the word the conversion
     titles use. Consulted only when the typed word itself starts no word of
     the title, so nothing that matched before stops matching. */
  var ALIAS = {
    km: 'kilometer', kms: 'kilometer', kilometre: 'kilometer', kilometres: 'kilometer', mi: 'mile', metre: 'meter', metres: 'meter',
    cm: 'centimeter', mm: 'millimeter', ft: 'foot', feet: 'foot', yd: 'yard', kg: 'kilogram', kgs: 'kilogram', kilo: 'kilogram', kilos: 'kilogram',
    gm: 'gram', mg: 'milligram', lb: 'pound', lbs: 'pound', oz: 'ounce', st: 'stone', ml: 'milliliter', millilitre: 'milliliter',
    litre: 'liter', litres: 'liter', ltr: 'liter', gal: 'gallon', tbsp: 'tablespoon', tsp: 'teaspoon', kph: 'kilometers', kmh: 'kilometers',
    mph: 'miles', kpa: 'kilopascal', atm: 'atmosphere', kj: 'kilojoule', kcal: 'kilocalorie', kwh: 'kilowatt', kw: 'kilowatt', hp: 'horsepower',
    kb: 'kilobyte', mb: 'megabyte', gb: 'gigabyte', tb: 'terabyte', sec: 'second', secs: 'second', min: 'minute', mins: 'minute',
    hr: 'hour', hrs: 'hour', wk: 'week', yr: 'year', deg: 'degree', rad: 'radian', sqft: 'square', sqm: 'square'
  };

  /* Index of the first title word that starts with the typed word, or -1. */
  function wordAt(words, w) {
    for (var i = 0; i < words.length; i++) if (words[i].indexOf(w) === 0) return i;
    return -1;
  }
  /* The same, forgiving a unit's short form and a plural: "miles" starts
     no word of "Convert Kilometer to Mile", "mile" does. Returns where
     the word matched and whether it matched a title word whole, which is
     what separates "Mile" from "Millimeter" when both start with "mil". */
  function matchWord(words, w) {
    var forms = [w];
    if (ALIAS[w]) forms.push(ALIAS[w]);
    if (w.length > 3 && /s$/.test(w)) forms.push(w.slice(0, -1));                 /* miles -> mile */
    if (w.length > 4 && /(ch|sh|ss|x|z)es$/.test(w)) forms.push(w.slice(0, -2));  /* inches -> inch */
    for (var f = 0; f < forms.length; f++) {
      var at = wordAt(words, forms[f]);
      if (at >= 0) return { at: at, exact: words[at] === forms[f] };
    }
    return null;
  }

  function score(title, term) {
    var t = title.toLowerCase();
    if (t === term) return 1000;
    if (t.indexOf(term) === 0) return 500;
    var words = t.split(SEP);
    var typed = term.split(SEP).filter(Boolean);
    var i, at;
    if (typed.length <= 1) {
      for (i = 0; i < words.length; i++) {
        if (words[i].indexOf(term) === 0) return 300 - i;
      }
      if (t.indexOf(term) > -1) return 100;
      /* nothing matched the word as typed: try it as a unit's short form */
      at = matchWord(words, term);
      return at ? 300 - at.at : 0;
    }
    /* every typed word starts a word of the title; earliest first word
       wins, words in the typed order beat the same words reversed, a word
       matched whole beats a prefix, and a shorter title beats a longer one
       carrying the same words */
    var first = -1, last = -1, ordered = true, exact = 0;
    for (i = 0; i < typed.length; i++) {
      at = matchWord(words, typed[i]);
      if (!at) break;
      if (at.exact) exact++;
      if (first < 0 || at.at < first) first = at.at;
      if (at.at < last) ordered = false;
      last = at.at;
    }
    if (i === typed.length) return 300 - first + (ordered ? 10 : 0) + exact * 2 - (words.length - typed.length) * 0.01;
    if (t.indexOf(term) > -1) return 100;
    for (i = 0; i < typed.length; i++) if (t.indexOf(typed[i]) < 0) return 0;
    return 60;   /* every word somewhere in the title, not at the start of one */
  }

  /* The index is ~9 KB gzipped. Most visitors arrive from a search
     engine on the exact tool they wanted and never use the box, so it
     is fetched on first interaction rather than on every page load. */
  var indexState = 'idle';
  var waiting = [];
  function ensureIndex(then) {
    if (indexState === 'ready') { then(); return; }
    /* Queue, rather than drop. Focusing the box starts the fetch, so a fast
       typist finished their term while it was still in flight and the render
       that was waiting on it was thrown away — the box stayed empty until they
       pressed one more key. */
    waiting.push(then);
    if (indexState === 'loading') return;
    indexState = 'loading';
    var s = document.createElement('script');
    s.src = base + 'assets/search-index.js';
    s.onload = function () {
      indexState = 'ready';
      var run = waiting;
      waiting = [];
      for (var i = 0; i < run.length; i++) run[i]();
    };
    s.onerror = function () { indexState = 'idle'; waiting = []; };
    document.head.appendChild(s);
  }

  /* Pages that are not tools. They are deliberately NOT in
     assets/search-index.js: that file is the register the site counts
     tools from, so a page in it would make every total on the site one
     too many. Keywords are the words somebody would actually type when
     they want the thing, not the words on the page. */
  var SEARCH_PAGES = [
    ['Settings', 'settings/', 'settings', 'currency rupee pound dollar euro symbol lakh crore grouping comma separator decimal date format dd mm paper size a4 letter legal units metric imperial week preferences options language locale'],
    ['All tools', 'tools/', 'grid', 'directory list browse everything index'],
    ['Collections', 'for/', 'collections', 'accountant bookkeeper school teacher landlord shop freelancer developer role job'],
    ['How-to guides', 'guides/', 'feed', 'guide how to walkthrough steps tutorial'],
    ['Comparisons', 'compare/', 'compare', 'alternative versus vs instead of tally capium quickbooks zoho bridging'],
    ['Plans and pricing', 'pricing/', 'employer-cost', 'price cost subscription credits pay per use free plan pro business'],
    ['Privacy and security', 'trust/', 'shield', 'privacy gdpr dpdp data security processor compliance what you hold'],
    ['Your account', 'account/', 'shield', 'sign in login register account profile']
  ];

  function search(term) {
    var idx = window.SEARCH_INDEX || [], hits = [];
    for (var i = 0; i < idx.length; i++) {
      var s = score(idx[i][0], term);
      if (s > 0) hits.push([s, idx[i]]);
    }
    /* A page matches on its title or on any of its keywords, and is
       scored a little below an equally good tool match, because
       somebody typing into a tool site usually wants a tool. */
    for (var j = 0; j < SEARCH_PAGES.length; j++) {
      var pg = SEARCH_PAGES[j];
      var ps = Math.max(score(pg[0], term), score(pg[3], term) ? 60 : 0);
      if (ps > 0) hits.push([ps - 1, pg]);
    }
    hits.sort(function (a, b) { return b[0] - a[0]; });
    return hits.slice(0, 20).map(function (h) { return h[1]; });
  }

  /* The box matches names. When the name is not the word in the visitor's
     head, the Tool Finder takes the job in plain words instead, so every
     result list — and especially the empty one — ends with a way there. */
  function finderLink(term) {
    var a = document.createElement('a');
    a.className = 'search-more';
    a.href = base + 'utilities/tool-finder/?q=' + encodeURIComponent(term);
    a.textContent = 'Not the name? Describe the job to the Tool Finder →';
    return a;
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
      box.appendChild(finderLink(term));
      box.hidden = false;
      return;
    }
    box.innerHTML = hits.map(function (h) {
      return '<a href="' + base + h[1] + '">' +
             '<svg class="ico" aria-hidden="true"><use href="' + base + 'assets/icons.svg#i-' + h[2] + '"></use></svg>' +
             '<span>' + h[0] + '</span></a>';
    }).join('');
    box.appendChild(finderLink(term));
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

/* ---------- recently used tools ----------
   The homepage's "Popular tools" list is hand-picked and the same for
   everyone. This is the part that is actually personal, and it is honest
   because it never leaves the device: the last few tools you opened, read back
   on the homepage. No identifier, no history of when, nothing transmitted, and
   analytics.js masks the rendered list so it cannot reach a session replay
   either. Disclosed in cookies/index.html as 1234tools-recent. */
(function () {
  'use strict';
  var KEY = '1234tools-recent';
  var MAX = 6;

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
    } catch (e) { return []; }
  }

  /* Tool pages only. Hubs, the homepage and the legal pages all have an h1 and
     are not worth remembering, so the mount point is what distinguishes them —
     and, since the home page and the section hubs now carry the Tool Finder's
     own .tool-io, so does depth: a tool lives at section/slug/ or deeper, a hub
     one level up. */
  var h1 = document.querySelector('main h1');
  var here = location.pathname.replace(/^\//, '');
  var depth = here.split('/').filter(Boolean).length;
  if (h1 && here && depth >= 2 && !/(^|\/)index\.html$/.test(here) &&
      document.querySelector('.tool, .tool-io')) {
    var list = read().filter(function (x) { return x && x.u !== here; });
    list.unshift({ u: here, t: h1.textContent.trim().slice(0, 80) });
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) {}
  }

  var host = document.getElementById('recent-tools');
  if (!host) return;
  var recent = read().filter(function (x) { return x && x.u && x.t; });
  if (!recent.length) return;

  var head = document.createElement('h2');
  head.className = 'section-title';
  head.textContent = 'Pick up where you left off';

  var grid = document.createElement('div');
  grid.className = 'grid grid-feature';
  recent.forEach(function (x) {
    var a = document.createElement('a');
    a.className = 'card';
    a.href = x.u;
    var s = document.createElement('strong');
    /* textContent, never innerHTML: these titles come back out of storage, and
       storage is writable by anything else running on this origin. */
    s.textContent = x.t;
    a.appendChild(s);
    grid.appendChild(a);
  });

  host.appendChild(head);
  host.appendChild(grid);
  host.hidden = false;
})();

/* ---------- tool chaining, recent outputs, save to folder ----------
   engine/handoff.js, fetched only on a tool page and only after the tool has
   mounted: nothing in it is needed before the first interaction. */
(function () {
  'use strict';
  if (window.MVRHandoff || document.querySelector('script[src*="/engine/handoff.js"]')) return;
  if (!document.querySelector('article.tool, .tool[data-tool]')) return;
  if (document.documentElement.classList.contains('is-embed')) return;
  var me = document.currentScript && document.currentScript.src;
  var src = me ? me.replace(/assets\/app\.js(\?.*)?$/, 'engine/handoff.js') : '/engine/handoff.js';
  var s = document.createElement('script');
  s.src = src;
  s.async = true;
  document.head.appendChild(s);
})();

/* ---------- keyboard: the shortcut sheet (?) ----------
   One list of the shortcuts the page in front of you actually has: the
   site-wide ones, then the ones the tool's shell binds (read from which
   shell is on the page, so a calculator is not told about Ctrl+Enter). */
(function () {
  'use strict';
  var dlg = null, from = null;

  function has(shell) { return !!document.querySelector('script[src*="/engine/' + shell + '.js"]'); }
  function rows() {
    var groups = [['On every page', [
      ['/', 'Search the tools'],
      ['?', 'Show this list'],
      ['Esc', 'Close a menu, the category list or this list']
    ]]];
    if (document.querySelector('article.tool, .tool[data-tool]')) {
      groups.push(['On this tool', [
        ['Tab', 'Move between controls (Shift+Tab goes back). When a file result arrives, focus moves to its Download button'],
        ['↑ ↓', 'Move through a Send to… menu; Enter opens the tool, Esc closes the menu']
      ]]);
    }
    if (has('render-dev')) groups.push(['Developer and text tools', [
      ['Ctrl+Enter', 'Run now'],
      ['Ctrl+Shift+C', 'Copy the output'],
      ['Ctrl+S', 'Download the output'],
      ['Esc', 'Close the open panel']
    ]]);
    if (has('render-image')) groups.push(['Image tools', [
      ['Ctrl+V', 'Paste an image from the clipboard'],
      ['Arrow keys', 'Move a selection box (Shift: 10 px steps)'],
      ['Ctrl+arrow keys', 'Resize a selection box']
    ]]);
    if (has('render-pdf')) groups.push(['PDF page grids', [
      ['Arrow keys', 'Move between pages'],
      ['Space', 'Choose a page; Shift extends the choice'],
      ['Ctrl+A', 'Choose every page'],
      ['R', 'Turn a page'],
      ['Alt+arrow keys', 'Move a page (organiser)'],
      ['Delete', 'Remove or restore a page (organiser)']
    ]]);
    if (has('render-qr') && /qr-code-scanner/.test(location.pathname)) groups.push(['QR scanner', [
      ['Ctrl+V', 'Scan a pasted image']
    ]]);
    return groups;
  }

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'kbd-sheet';
    dlg.setAttribute('aria-labelledby', 'kbd-sheet-title');
    var h = document.createElement('h2');
    h.id = 'kbd-sheet-title';
    h.textContent = 'Keyboard shortcuts';
    dlg.appendChild(h);
    rows().forEach(function (g) {
      var h3 = document.createElement('h3');
      h3.textContent = g[0];
      dlg.appendChild(h3);
      var dl = document.createElement('dl');
      g[1].forEach(function (r) {
        var dt = document.createElement('dt');
        r[0].split('+').forEach(function (part, i) {
          if (i) dt.appendChild(document.createTextNode('+'));
          var k = document.createElement('kbd');
          k.textContent = part;
          dt.appendChild(k);
        });
        var dd = document.createElement('dd');
        dd.textContent = r[1];
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
      dlg.appendChild(dl);
    });
    var p = document.createElement('p');
    p.className = 'kbd-mac';
    p.textContent = 'On a Mac, ⌘ works wherever Ctrl is shown.';
    dlg.appendChild(p);
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn-ghost kbd-close';
    close.textContent = 'Close';
    close.addEventListener('click', function () { dlg.close(); });
    dlg.appendChild(close);
    dlg.addEventListener('close', function () {
      if (from && document.contains(from) && from.focus) from.focus();
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
  }

  function open() {
    if (!dlg) build();
    if (dlg.open) return;
    from = document.activeElement;
    dlg.showModal();
    dlg.querySelector('.kbd-close').focus();
  }
  window.MVRShortcuts = { open: open };

  document.addEventListener('keydown', function (e) {
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    var a = document.activeElement;
    if (a && (/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) || a.isContentEditable)) return;
    if (typeof HTMLDialogElement !== 'function') return;
    e.preventDefault();
    open();
  });
})();
