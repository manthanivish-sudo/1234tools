/* The version this browser runs, shown at the foot of every page.
 *
 * build/release.js rewrites the REC line below at release time (see
 * build/version-record.js): v is the release's service-worker cache number
 * (sw.js's 1234tools-vNNN), date the day the release was built, and built_on
 * the commit it was built on top of. That is the parent of the release
 * commit, whose own id does not exist yet when the release tree is built.
 *
 * sw.js precaches this file and serves it cache-first from the cache named
 * for the same release, so the line shows what this visitor's browser has
 * installed, not what the server has now. When a newer release takes over
 * while the page is open (or one is waiting), the line offers a reload.
 * build-site.js writes the empty line into every page's footer; without
 * JavaScript it stays empty.
 */
(function () {
  'use strict';
  var REC = {"v":199,"date":"2026-10-10","built_on":"92c13e781"};
  window.MVR_VERSION = REC;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* "5 Oct 2026": the same in every locale, so no preference applies */
  function day(iso) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || '');
    return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : '';
  }

  function offer(box) {
    if (box.querySelector('.site-ver-update')) return;
    var sep = document.createElement('span');
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = ' · ';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'site-ver-update';
    b.textContent = 'Update ready — reload';
    b.addEventListener('click', function () { location.reload(); });
    var live = box.querySelector('[role="status"]');
    live.appendChild(sep);
    live.appendChild(b);
  }

  /* Only a page that a worker already served can be running an old release.
     sw.js calls skipWaiting() on install and clients.claim() on activate, so
     a newer release normally arrives as a controllerchange; a worker left
     waiting is offered too. Either way a reload is all it takes. */
  function watch(box) {
    var sw = navigator.serviceWorker;
    if (!sw || !sw.controller) return;
    sw.addEventListener('controllerchange', function () { offer(box); });
    if (sw.getRegistration) {
      sw.getRegistration().then(function (reg) { if (reg && reg.waiting) offer(box); }).catch(function () {});
    }
  }

  function fill() {
    var box = document.querySelector('[data-site-ver]');
    if (!box || box.firstChild) return;
    var num = document.createElement('span');
    num.className = 'site-ver-num';
    num.textContent = 'Version ' + REC.v + (day(REC.date) ? ' · ' + day(REC.date) : '');
    var live = document.createElement('span');
    live.setAttribute('role', 'status');
    box.appendChild(num);
    box.appendChild(live);
    watch(box);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill);
  else fill();
})();
