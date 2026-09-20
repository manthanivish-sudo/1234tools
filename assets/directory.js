/**
 * The directory's filter. Everything is already in the page; this only
 * hides rows. No request, no index to download, and it works with the
 * network off like the rest of the site.
 */
(function () {
  'use strict';
  var search = document.getElementById('dirSearch');
  if (!search) return;
  var rows = [].slice.call(document.querySelectorAll('.dir-row'));
  var sections = [].slice.call(document.querySelectorAll('.dir-section'));
  var catChips = [].slice.call(document.querySelectorAll('.filter-chips .chip'));
  var priceChips = [].slice.call(document.querySelectorAll('.filter-price .chip'));
  var empty = document.querySelector('.dir-empty');
  var reset = document.getElementById('dirReset');
  var families = document.querySelector('.dir-families');
  var state = { q: '', cat: 'all', price: 'all' };

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
       untouched view — a search for "payroll" should not offer them */
    if (families) families.hidden = !(state.cat === 'all' && state.price === 'all' && !terms.length);
    if (empty) empty.hidden = shown !== 0;
  }

  function pick(list, el, key) {
    list.forEach(function (c) { c.classList.toggle('is-on', c === el); });
    state[key] = el.getAttribute('data-' + (key === 'cat' ? 'cat' : 'price'));
    apply();
  }

  search.addEventListener('input', function () { state.q = search.value; apply(); });
  search.addEventListener('search', function () { state.q = search.value; apply(); });
  catChips.forEach(function (c) { c.addEventListener('click', function () { pick(catChips, c, 'cat'); }); });
  priceChips.forEach(function (c) { c.addEventListener('click', function () { pick(priceChips, c, 'price'); }); });
  if (reset) reset.addEventListener('click', function () {
    search.value = ''; state = { q: '', cat: 'all', price: 'all' };
    catChips.forEach(function (c, i) { c.classList.toggle('is-on', i === 0); });
    priceChips.forEach(function (c, i) { c.classList.toggle('is-on', i === 0); });
    apply(); search.focus();
  });

  /* ?q= and ?cat= so a filtered view can be linked to */
  try {
    var p = new URLSearchParams(location.search);
    if (p.get('q')) { search.value = p.get('q'); state.q = p.get('q'); }
    var c = p.get('cat');
    if (c) { var hit = catChips.filter(function (x) { return x.getAttribute('data-cat') === c; })[0]; if (hit) pick(catChips, hit, 'cat'); }
  } catch (e) { /* an old browser: the page still lists everything */ }
  apply();
})();
