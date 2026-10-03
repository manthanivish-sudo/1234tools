/**
 * The directory's filter. Everything is already in the page; this only
 * hides rows. No request, no index to download, and it works with the
 * network off like the rest of the site.
 *
 * Four filters, ANDed: the words typed, the category, the price and the job
 * (Make, Convert, Check, Calculate, Clean up). And the keyboard: / jumps to
 * the search box, ↓ from there goes to the first row still showing, ↑ and ↓
 * walk the visible rows, Enter opens one (it is a link), Escape goes back
 * to the search box.
 */
(function () {
  'use strict';
  var search = document.getElementById('dirSearch');
  if (!search) return;
  var rows = [].slice.call(document.querySelectorAll('.dir-row'));
  var sections = [].slice.call(document.querySelectorAll('.dir-section'));
  var catChips = [].slice.call(document.querySelectorAll('.filter-chips .chip'));
  var priceChips = [].slice.call(document.querySelectorAll('.filter-price .chip'));
  var verbChips = [].slice.call(document.querySelectorAll('.filter-verb .chip'));
  var empty = document.querySelector('.dir-empty');
  var reset = document.getElementById('dirReset');
  var families = document.querySelector('.dir-families');
  var fresh = function () { return { q: '', cat: 'all', price: 'all', verb: 'all' }; };
  var state = fresh();

  /* the words a row can be found by, worked out once */
  rows.forEach(function (r) {
    r._hay = (r.textContent || '').toLowerCase().replace(/\s+/g, ' ');
  });

  function apply() {
    var q = state.q.trim().toLowerCase();
    var terms = q ? q.split(/\s+/) : [];
    var shown = 0;
    rows.forEach(function (r) {
      var ok = (state.cat === 'all' || r.getAttribute('data-cat') === state.cat)
        && (state.price === 'all' || r.getAttribute('data-price') === state.price)
        && (state.verb === 'all' || r.getAttribute('data-verb') === state.verb)
        && terms.every(function (t) { return r._hay.indexOf(t) >= 0; });
      r.hidden = !ok;
      if (ok) shown++;
    });
    sections.forEach(function (s) {
      if (s === families) return;
      var any = [].slice.call(s.querySelectorAll('.dir-row')).some(function (r) { return !r.hidden; });
      s.hidden = !any;
    });
    /* the conversion families are not rows, so they only belong on an
       untouched view — a search for "payroll" should not offer them. A
       "Convert" filter is the one exception: they are all conversions. */
    if (families) families.hidden = !(state.cat === 'all' && state.price === 'all' && !terms.length &&
      (state.verb === 'all' || state.verb === 'Convert'));
    if (empty) empty.hidden = shown !== 0;
  }

  function pick(list, el, key) {
    list.forEach(function (c) { c.classList.toggle('is-on', c === el); });
    state[key] = el.getAttribute('data-' + key);
    apply();
  }

  search.addEventListener('input', function () { state.q = search.value; apply(); });
  search.addEventListener('search', function () { state.q = search.value; apply(); });
  catChips.forEach(function (c) { c.addEventListener('click', function () { pick(catChips, c, 'cat'); }); });
  priceChips.forEach(function (c) { c.addEventListener('click', function () { pick(priceChips, c, 'price'); }); });
  verbChips.forEach(function (c) { c.addEventListener('click', function () { pick(verbChips, c, 'verb'); }); });
  if (reset) reset.addEventListener('click', function () {
    search.value = ''; state = fresh();
    [catChips, priceChips, verbChips].forEach(function (list) {
      list.forEach(function (c, i) { c.classList.toggle('is-on', i === 0); });
    });
    apply(); search.focus();
  });

  /* ---------- the keyboard ---------- */
  function visible() { return rows.filter(function (r) { return !r.hidden && !(r.closest('.dir-section') || {}).hidden; }); }
  function typing(el) { return el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable); }

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var el = document.activeElement;
    if (e.key === '/' && !typing(el)) {
      /* this page's own search box wins over the site search in the header */
      e.preventDefault(); e.stopImmediatePropagation(); search.focus(); search.select();
      return;
    }
    var list, at;
    if (el === search && e.key === 'ArrowDown') {
      list = visible();
      if (list.length) { e.preventDefault(); list[0].focus(); }
      return;
    }
    if (el && el.classList && el.classList.contains('dir-row')) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        list = visible(); at = list.indexOf(el);
        e.preventDefault();
        if (e.key === 'ArrowDown' && at < list.length - 1) list[at + 1].focus();
        else if (e.key === 'ArrowUp') { if (at > 0) list[at - 1].focus(); else search.focus(); }
      } else if (e.key === 'Escape') {
        e.preventDefault(); search.focus();
      }
    }
  }, true);

  /* ?q=, ?cat= and ?verb= so a filtered view can be linked to */
  try {
    var p = new URLSearchParams(location.search);
    if (p.get('q')) { search.value = p.get('q'); state.q = p.get('q'); }
    var c = p.get('cat');
    if (c) { var hit = catChips.filter(function (x) { return x.getAttribute('data-cat') === c; })[0]; if (hit) pick(catChips, hit, 'cat'); }
    var v = p.get('verb');
    if (v) { var vh = verbChips.filter(function (x) { return x.getAttribute('data-verb').toLowerCase() === v.toLowerCase(); })[0]; if (vh) pick(verbChips, vh, 'verb'); }
  } catch (e) { /* an old browser: the page still lists everything */ }
  apply();
})();
