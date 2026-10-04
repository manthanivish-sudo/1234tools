/* The Example panel's two moving parts, written by build-proof.js:
 *
 *   - the before/after comparison: a range input moves --pos, which the
 *     stylesheet turns into a clip-path. Without this file the two pictures
 *     simply sit side by side.
 *   - "Try these numbers" / "Try it": the link's #fragment carries the
 *     example's inputs, the same keys a shared link carries. On this page the
 *     tool is already mounted, so the values are put into its fields here,
 *     the tool recomputes as if they were typed, and the page scrolls to it.
 *     Opened in a new tab, the same link fills the tool through render-core.
 *
 * Nothing is sent anywhere; the fragment never leaves the browser.
 */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sliders() {
    var figs = document.querySelectorAll('.proof-ba[data-proof-slider]');
    Array.prototype.forEach.call(figs, function (fig) {
      var r = fig.querySelector('.proof-range');
      if (!r || fig.classList.contains('is-live')) return;
      var set = function () { fig.style.setProperty('--pos', r.value + '%'); };
      r.hidden = false;
      r.addEventListener('input', set);
      set();
      fig.classList.add('is-live');
    });
  }

  function toolBox() {
    return document.querySelector('.tool .calc, .tool .tool-io');
  }

  function scrollToTool(focus) {
    var box = toolBox();
    if (!box) return;
    box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (focus) { try { focus.focus({ preventScroll: true }); } catch (e) { /* old browser */ } }
    box.classList.remove('proof-flash');
    void box.offsetWidth;
    box.classList.add('proof-flash');
    setTimeout(function () { box.classList.remove('proof-flash'); }, 1600);
  }

  function fire(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function field(root, key) {
    var safe = window.CSS && CSS.escape ? CSS.escape(key) : key.replace(/"/g, '');
    return root.querySelector('[name="' + safe + '"]') ||
      root.querySelector('#fx-' + safe) ||
      (key === 'v' ? root.querySelector('#u-value') : null);
  }

  function fill(kind, params) {
    var tool = document.querySelector('article.tool');
    if (!tool) return null;
    if (kind === 'text') {
      var ta = tool.querySelector('.tool-io textarea.code-area') || tool.querySelector('.tool-io textarea');
      if (!ta || !params.has('text')) return null;
      ta.value = params.get('text');
      fire(ta);
      return ta;
    }
    var first = null, last = null;
    params.forEach(function (v, k) {
      var el = field(tool, k);
      if (!el) return;
      if (el.tagName === 'SELECT' && !Array.prototype.some.call(el.options, function (o) { return o.value === v; })) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      first = first || el;
      last = el;
    });
    if (last) last.dispatchEvent(new Event('change', { bubbles: true }));
    return first;
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-proof-try]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var kind = a.getAttribute('data-proof-try');
    var href = a.getAttribute('href') || '';
    e.preventDefault();
    if (kind === 'tool' || href.charAt(0) !== '#' || href === '#main') { scrollToTool(null); return; }
    var params;
    try { params = new URLSearchParams(href.slice(1)); } catch (err) { scrollToTool(null); return; }
    var got = fill(kind, params);
    /* the address now carries the figures, as a shared link would */
    try { history.replaceState(null, '', location.pathname + location.search + href); } catch (err) { /* file:// */ }
    scrollToTool(got);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sliders);
  else sliders();
})();
