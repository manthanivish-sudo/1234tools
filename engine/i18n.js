/**
 * The words of a tool, in another language.
 *
 * Loaded only on a translated twin of a tool page (today /hi/<section>/<slug>/,
 * written by build-tools-hi.js). English pages never load it, and every shell
 * hook that reads it falls back to the English string when it is absent, so
 * an English page behaves exactly as it did before this file existed.
 *
 * The page sets the map first, inline, from build/tools-hi/:
 *
 *   window.MVR_I18N_STRINGS = {
 *     lang: 'hi',
 *     s: { 'Download': 'डाउनलोड करें', ... },          exact strings
 *     p: [ ['^(\\d+) files?$', '$1 फ़ाइलें'], ... ]      patterns (anchored);
 *     k: [ 'MozJPEG (WebAssembly)', ... ]              kept in English on purpose
 *   };                                                  $n is the group as is,
 *                                                       %n the group translated
 *
 * and this file exposes
 *
 *   MVR_I18N.t(s)        the string in the page's language, or s unchanged
 *   MVR_I18N.watch(root) translate root now, and whatever the shell writes
 *                        into it later (text, placeholder, title, aria-label,
 *                        alt, label, button values)
 *
 * The shells (render-image, render-pdf, render-qr, render-dev, render-core,
 * aiimg-core) call watch() on the article they mount into, and t() for the
 * few strings that never reach the page as text (window.prompt).
 *
 * What is never touched: what the visitor typed or opened, and what a tool
 * made from it — textarea, input values, pre, code, contenteditable, and
 * anything under [data-i18n="off"]. A translated word in a JSON document
 * would be a corrupted document.
 *
 * With window.MVR_I18N_COLLECT set before this file runs (the tests and the
 * string harvester do that), every string seen that has Latin letters and
 * no translation is kept, and MVR_I18N.misses() returns them.
 */
(function () {
  'use strict';
  if (window.MVR_I18N) return;
  const map = window.MVR_I18N_STRINGS || { s: {}, p: [] };
  const S = map.s || {};
  const K = new Set(map.k || []); /* strings that stay as they are: names, formats, codes */
  const P = (map.p || []).map(function (x) { return [new RegExp(x[0]), x[1]]; });
  const COLLECT = !!window.MVR_I18N_COLLECT;
  const missed = new Set();
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'label', 'data-tip'];
  const SKIP = 'textarea,pre,code,script,style,[contenteditable=""],[contenteditable="true"],[data-i18n="off"]';
  const norm = function (s) { return String(s).replace(/\s+/g, ' ').trim(); };

  function lookup(key) {
    if (Object.prototype.hasOwnProperty.call(S, key)) return S[key];
    for (let i = 0; i < P.length; i++) {
      const m = P[i][0].exec(key);
      if (!m) continue;
      return P[i][1].replace(/([$%])(\d)/g, function (all, kind, n) {
        const g = m[Number(n)];
        if (g === undefined) return '';
        return kind === '$' ? g : t(g);
      });
    }
    return null;
  }

  /** The string in the page's language; the string itself when there is none. */
  function t(s) {
    if (s === null || s === undefined) return s;
    const raw = String(s);
    const key = norm(raw);
    if (!key) return raw;
    if (K.has(key)) return raw;
    const out = lookup(key);
    if (out === null) {
      if (COLLECT && /[A-Za-z]{2,}/.test(key)) missed.add(key);
      return raw;
    }
    /* keep the spacing around the words, which the layout may rely on */
    const lead = /^\s*/.exec(raw)[0], tail = /\s*$/.exec(raw)[0];
    return lead + out + tail;
  }

  const skipped = function (el) { return !!(el && el.closest && el.closest(SKIP)); };

  function doText(node) {
    const p = node.parentElement;
    if (!p || skipped(p)) return;
    const v = node.data;
    if (!/[A-Za-z]/.test(v)) return;
    const next = t(v);
    if (next !== v) node.data = next;
  }

  function doAttrs(el) {
    if (skipped(el)) return;
    for (let i = 0; i < ATTRS.length; i++) {
      const a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a);
      if (!/[A-Za-z]/.test(v)) continue;
      const next = t(v);
      if (next !== v) el.setAttribute(a, next);
    }
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && /[A-Za-z]/.test(el.value)) {
      const nv = t(el.value);
      if (nv !== el.value) el.value = nv;
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    if (skipped(root)) return;
    doAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1 && n.matches(SKIP)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n = tw.nextNode();
    while (n) {
      if (n.nodeType === 3) doText(n); else doAttrs(n);
      n = tw.nextNode();
    }
  }

  const watched = new WeakSet();
  function watch(root) {
    if (!root || watched.has(root)) return;
    watched.add(root);
    walk(root);
    if (typeof MutationObserver !== 'function') return;
    new MutationObserver(function (list) {
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else for (let j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['value']) });
  }

  window.MVR_I18N = {
    lang: map.lang || 'en',
    t: t,
    watch: watch,
    misses: function () { return Array.from(missed); }
  };
})();
