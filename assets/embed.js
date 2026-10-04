/**
 * /embed/: the picker that writes the embed code for any calculator or
 * converter, without opening the tool first.
 *
 * The code it writes is the code assets/share.js's Embed button writes on
 * the tool's own page, with "Include my figures" off — the same address,
 * the same four utm_ parameters, the same height, the same paragraph.
 * build-embed.js checks, for every embeddable page, that the title, the
 * canonical and the utm_ values this file derives from the search index are
 * the ones share.js reads off that page, and refuses to write /embed/ if one
 * is not.
 *
 * The search index is fetched from this site on first use, the way the
 * site's own search box fetches it. Nothing else is loaded, nothing is
 * stored, and nothing is sent.
 */
(function () {
  'use strict';

  var root = document.getElementById('get-code');
  var dataEl = document.getElementById('embed-data');
  if (!root || !dataEl) return;
  var data;
  try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var SITE_NAME = '1234Tools';
  var KIND_NAME = { calc: 'Calculator', converter: 'Unit converter', currency: 'Currency converter' };
  var MAX = 12;

  var q = document.getElementById('embed-q');
  var hint = document.getElementById('embed-hint');
  var results = document.getElementById('embed-results');
  var out = document.getElementById('embed-out');
  var nameEl = document.getElementById('embed-name');
  var metaEl = document.getElementById('embed-meta');
  var openEl = document.getElementById('embed-open');
  var code = document.getElementById('embed-code');
  var copyBtn = document.getElementById('embed-copy');
  var prevBtn = document.getElementById('embed-preview-btn');
  var prev = document.getElementById('embed-preview');
  var status = document.getElementById('embed-status');
  var picked = null;

  /* ---------- the index, from this site, on first use ---------- */

  var waiting = [], loading = false;
  function withIndex(then) {
    if (window.SEARCH_INDEX) { then(window.SEARCH_INDEX); return; }
    waiting.push(then);
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = '/assets/search-index.js';
    s.onload = function () {
      loading = false;
      var run = waiting; waiting = [];
      run.forEach(function (f) { f(window.SEARCH_INDEX || []); });
    };
    s.onerror = function () {
      loading = false; waiting = [];
      say('Could not load the list of tools. Check the connection and try again.');
    };
    document.head.appendChild(s);
  }

  /* ---------- what can be embedded, and the code share.js writes ---------- */

  function kindOf(p) {
    if (Object.prototype.hasOwnProperty.call(data.kinds, p)) return data.kinds[p];
    return /^conversions\/[^\/]+\/[^\/]+\/$/.test(p) ? 'converter' : null;
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function codeFor(title, p) {
    var kind = kindOf(p);
    var parts = p.replace(/\/$/, '').split('/');
    var canonical = data.site + '/' + p;
    var u = new URL(canonical);
    u.searchParams.set('embed', '1');
    u.searchParams.set('utm_source', 'embed');
    u.searchParams.set('utm_medium', 'share');
    u.searchParams.set('utm_campaign', parts[0]);
    u.searchParams.set('utm_content', parts.slice(1).join('/'));
    return '<iframe src="' + escHtml(u.href) + '" width="100%" height="' + (data.heights[kind] || 600) +
      '" style="border:0;border-radius:12px;max-width:720px" loading="lazy" title="' + escHtml(title + ' — ' + SITE_NAME) + '"></iframe>\n' +
      '<p style="font:14px system-ui"><a href="' + escHtml(canonical) + '">' + escHtml(title) + '</a> by ' + SITE_NAME +
      ' — free, runs in the browser.</p>';
  }

  /* ---------- search ---------- */

  /* Lower case, punctuation to spaces: "km/h" and "km h" are the same search. */
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim(); }

  function inOrder(name, words) {
    var at = 0;
    for (var w = 0; w < words.length; w++) {
      var k = name.indexOf(words[w], at);
      if (k < 0) return false;
      at = k + words[w].length;
    }
    return true;
  }

  function search(index, text) {
    var t = norm(text);
    var words = t.split(' ').filter(Boolean);
    if (!words.length) return { list: [], count: 0 };
    var hits = [];
    for (var i = 0; i < index.length; i++) {
      var e = index[i];
      if (!kindOf(e[1])) continue;
      var name = norm(e[0]);
      /* Each typed word has to start a word of the name or the address, so
         "gst" finds the GST calculator and not every Angstrom conversion. */
      var hay = ' ' + name + ' ' + norm(e[1]);
      var all = true;
      for (var w = 0; w < words.length; w++) if (hay.indexOf(' ' + words[w]) < 0) { all = false; break; }
      if (!all) continue;
      /* The whole phrase at the start, then anywhere, then the words in the
         order typed ("kilometer mile" before "mile … kilometer"), then the
         rest; shorter names first within each, so the plain pair beats the
         per-hour one. */
      var rank = name.indexOf(t) === 0 ? 0 : (name.indexOf(t) > 0 ? 1 : (inOrder(name, words) ? 2 : 3));
      hits.push({ e: e, rank: rank, len: name.length, i: i });
    }
    hits.sort(function (a, b) { return a.rank - b.rank || a.len - b.len || a.i - b.i; });
    return { list: hits.slice(0, MAX).map(function (h) { return h.e; }), count: hits.length };
  }

  function render() {
    var text = q.value;
    withIndex(function (index) {
      if (text !== q.value) return;            /* a newer keystroke owns the list */
      var r = search(index, text);
      results.textContent = '';
      if (!text.trim()) { hint.textContent = 'Start typing to search.'; return; }
      if (!r.count) { hint.textContent = 'Nothing that can be embedded matches that. Try fewer words.'; return; }
      hint.textContent = r.count > MAX ? 'Showing ' + MAX + ' of ' + r.count + ' matches. Add a word to narrow it.' : r.count + (r.count === 1 ? ' match.' : ' matches.');
      r.list.forEach(function (e) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = e[0];
        b.setAttribute('data-path', e[1]);
        b.addEventListener('click', function () { pick(e); });
        results.appendChild(b);
      });
    });
  }

  /* ---------- the chosen tool ---------- */

  function pick(e) {
    picked = e;
    var kind = kindOf(e[1]);
    nameEl.textContent = e[0];
    metaEl.textContent = '· ' + KIND_NAME[kind] + ' · ' + (data.heights[kind] || 600) + ' px high';
    openEl.href = '/' + e[1];
    code.value = codeFor(e[0], e[1]);
    out.hidden = false;
    prev.hidden = true;
    prev.textContent = '';
    prevBtn.setAttribute('aria-expanded', 'false');
    prevBtn.textContent = 'Preview it here';
    Array.prototype.forEach.call(results.querySelectorAll('.chip'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-path') === e[1]);
    });
    say('');
  }

  function pickPath(p) {
    withIndex(function (index) {
      for (var i = 0; i < index.length; i++) {
        if (index[i][1] === p && kindOf(p)) { pick(index[i]); break; }
      }
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      copyBtn.focus({ preventScroll: true });
    });
  }

  /* ---------- copy, the way the share bar copies ---------- */

  function copyText(text) {
    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
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
    if (msg) statusTimer = setTimeout(function () { status.textContent = ''; }, 4000);
  }

  copyBtn.addEventListener('click', function () {
    if (!picked) return;
    copyText(code.value).then(function (ok) {
      say(ok ? 'Embed code copied' : 'Could not copy — select the code instead');
      if (ok) { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy embed code'; }, 1500); }
    });
  });

  prevBtn.addEventListener('click', function () {
    if (!picked) return;
    if (!prev.hidden) {
      prev.hidden = true; prev.textContent = '';
      prevBtn.setAttribute('aria-expanded', 'false'); prevBtn.textContent = 'Preview it here';
      return;
    }
    var kind = kindOf(picked[1]);
    var f = document.createElement('iframe');
    f.src = '/' + picked[1] + '?embed=1';
    f.width = '100%';
    f.height = String(data.heights[kind] || 600);
    f.title = picked[0] + ' — ' + SITE_NAME;
    prev.appendChild(f);
    prev.hidden = false;
    prevBtn.setAttribute('aria-expanded', 'true');
    prevBtn.textContent = 'Hide the preview';
  });

  q.addEventListener('focus', function () { withIndex(function () {}); });
  q.addEventListener('input', render);
  q.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    var first = results.querySelector('.chip');
    if (first) first.click();
  });

  /* "Get the code" on the dozen at the bottom of the page. */
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-embed-path]') : null;
    if (b) pickPath(b.getAttribute('data-embed-path'));
  });

  window.MVREmbed = { codeFor: codeFor, kindOf: kindOf };
})();
