/* The conversion hubs' picker and filter. build-conversions.js inlines this
   into each hub's CONV block, beside a JSON island with the units:
     { "f": { "<family>": { "u": { "<key>": [title, symbol, factor, offset, slug, plural] }, "o": [keys] } } }
   The picker converts as you type with the converter's own arithmetic and
   formatting, and Convert opens the pair's page with the value in the
   fragment (#v=5), which the converter reads. Without script the form still
   submits ?v=&from=&to= to the default pair's page, which reads those too. */
(function () {
  'use strict';
  var me = document.currentScript;
  var root = me && me.closest('.conv-hub');
  if (!root) return;
  var data;
  try { data = JSON.parse(root.querySelector('.conv-data').textContent); } catch (e) { return; }

  function loc() { try { return window.Prefs && window.Prefs.locale ? window.Prefs.locale() : 'en-GB'; } catch (e) { return 'en-GB'; } }
  /* render-core.js fmt.number, unchanged */
  function fmt(v) {
    if (!isFinite(v)) return v > 0 ? '∞' : (isNaN(v) ? '—' : '−∞');
    var abs = Math.abs(v);
    if (abs !== 0 && (abs < 1e-4 || abs >= 1e12)) return v.toExponential(6);
    var dp = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
    return Number(v.toFixed(dp)).toLocaleString(loc(), { maximumFractionDigits: dp });
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- the picker ---------- */
  var form = root.querySelector('.conv-form');
  var vIn = form && form.querySelector('[name="v"]');
  var fSel = form && form.querySelector('[name="from"]');
  var tSel = form && form.querySelector('[name="to"]');
  var live = root.querySelector('.conv-live');
  var famOf = function (sel) {
    var o = sel.options[sel.selectedIndex];
    if (!o) return null;
    return (o.parentNode && o.parentNode.getAttribute && o.parentNode.getAttribute('data-fam')) || root.getAttribute('data-conv-fam');
  };
  var unit = function (fam, key) { var f = data.f[fam]; return f && f.u[key] ? f.u[key] : null; };
  var convert = function (v, a, b) {
    var r = (v * a[2] + a[3] - b[3]) / b[2];
    if ((a[3] || b[3]) && Math.abs(r) < 1e-9) r = 0;
    return r;
  };
  var target = null;

  function fillTo(fam) {
    if (tSel.getAttribute('data-fam') === fam) return;
    var keep = tSel.value;
    tSel.innerHTML = '';
    data.f[fam].o.forEach(function (k) {
      var u = data.f[fam].u[k];
      var o = document.createElement('option');
      o.value = k; o.textContent = u[0] + ' (' + u[1] + ')';
      tSel.appendChild(o);
    });
    tSel.setAttribute('data-fam', fam);
    tSel.value = keep;
    if (tSel.value !== keep) tSel.selectedIndex = 0;
  }

  function update() {
    if (!form) return;
    var fam = famOf(fSel);
    if (!fam) return;
    if (root.getAttribute('data-conv-fam') === '') fillTo(fam);
    if (tSel.value === fSel.value) {
      var keys = data.f[fam].o;
      tSel.value = keys[0] === fSel.value ? keys[1] : keys[0];
    }
    var a = unit(fam, fSel.value), b = unit(fam, tSel.value);
    var raw = vIn.value.trim();
    var v = raw === '' ? 1 : Number(raw);
    if (!a || !b || !isFinite(v)) { live.innerHTML = '<span class="conv-live-msg">Type a number to convert</span>'; target = null; return; }
    target = '/conversions/' + fam + '/' + a[4] + '-to-' + b[4] + '/' + (raw === '' ? '' : '#v=' + encodeURIComponent(String(v)));
    live.innerHTML = '<span class="conv-live-in">' + esc(fmt(v) + ' ' + a[1]) + ' =</span> ' +
      '<span class="conv-live-out">' + esc(fmt(convert(v, a, b)) + ' ' + b[1]) + '</span>';
  }

  if (form && vIn && fSel && tSel && live) {
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    var swap = form.querySelector('.conv-swap');
    if (swap) swap.addEventListener('click', function () {
      var f = fSel.value; fSel.value = tSel.value; tSel.value = f; update();
    });
    form.addEventListener('submit', function (e) {
      update();
      if (!target) return;
      e.preventDefault();
      location.href = target;
    });
    update();
  }

  /* ---------- the filter over the full list ---------- */
  var box = root.querySelector('.conv-filter input');
  var all = root.querySelector('.conv-all');
  var count = root.querySelector('.conv-count');
  if (!box || !all) return;
  box.parentNode.hidden = false;
  var bySlug = {};
  Object.keys(data.f).forEach(function (fam) {
    bySlug[fam] = {};
    Object.keys(data.f[fam].u).forEach(function (k) {
      var u = data.f[fam].u[k];
      bySlug[fam][u[4]] = [u[0].toLowerCase(), u[1].toLowerCase(), u[4].replace(/-/g, ' '), u[5].toLowerCase(), k.toLowerCase()];
    });
  });
  var rows = [].slice.call(all.querySelectorAll('li')).map(function (li) {
    var a = li.querySelector('a');
    var m = /\/conversions\/([^/]+)\/([^/]+)\/$/.exec(a.getAttribute('href')) || [];
    var p = String(m[2] || '').split('-to-');
    var f = bySlug[m[1]] || {};
    return { li: li, a: a, from: f[p[0]] || [], to: f[p[1]] || [] };
  });
  var groups = [].slice.call(all.querySelectorAll('[data-grp]'));
  var folds = [].slice.call(all.querySelectorAll('details'));
  var total = rows.length;

  function hit(aliases, s) {
    for (var i = 0; i < aliases.length; i++) {
      var x = aliases[i];
      if (x === s || x.indexOf(s) === 0 || x.indexOf(' ' + s) >= 0) return true;
    }
    return false;
  }
  var lastVal = '';
  function filter() {
    var q = box.value.toLowerCase().replace(/\s+/g, ' ').trim();
    var num = /^(-?\d+(?:[.,]\d+)?)\s*/.exec(q);
    lastVal = '';
    if (num) { lastVal = num[1].replace(',', '.'); q = q.slice(num[0].length); }
    var lr = q ? q.split(/\s+(?:to|into|in)\s+|\s*(?:→|->)\s*/) : [];
    var words = q ? q.split(' ').filter(function (w) { return w && w !== 'to' && w !== 'into'; }) : [];
    var shown = 0;
    rows.forEach(function (r) {
      var ok = true;
      if (lr.length === 2 && lr[0] && lr[1]) ok = hit(r.from, lr[0]) && hit(r.to, lr[1]);
      else if (words.length) ok = words.every(function (w) { return hit(r.from, w) || hit(r.to, w); });
      r.li.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach(function (g) { g.hidden = !g.querySelector('li:not([hidden])'); });
    folds.forEach(function (d) {
      var any = !!d.querySelector('li:not([hidden])');
      d.hidden = !any;
      d.open = q ? any : d.hasAttribute('data-open');
    });
    if (count) count.textContent = !q ? '' : !shown
      ? 'Nothing matches that. Try a unit name or symbol, such as “mile” or “km”.'
      : (shown === 1 ? '1 match' : shown + ' matches') + ' of ' + total + (lastVal ? ' · Enter opens the first with ' + lastVal : ' · Enter opens the first');
  }
  box.addEventListener('input', filter);
  box.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var first = rows.filter(function (r) { return !r.li.hidden; })[0];
    if (!first || !box.value.trim()) return;
    e.preventDefault();
    location.href = first.a.getAttribute('href') + (lastVal ? '#v=' + encodeURIComponent(lastVal) : '');
  });
  if (box.value) filter();
})();
