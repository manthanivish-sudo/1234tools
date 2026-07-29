/* Offline support.
   Precaching 900 pages would be a rude thing to do to someone's data plan,
   so we precache only the shell and cache tool pages as they are visited. */

var V = 'mvr-v5';
var SHELL = [
  './', './index.html',
  './assets/app.css', './assets/app.js', './assets/icons.svg',
  './engine/render-core.js', './engine/units.bundle.js', './engine/tools.bundle.js',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(V)
      .then(function (c) { return Promise.allSettled(SHELL.map(function (u) { return c.add(u); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== V; })
                               .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Brand assets and web fonts live off-origin (the parent site and
  // Google Fonts). Cache them so the logo and Sora/Inter survive offline.
  if (url.origin !== location.origin) {
    if (/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|mvritservices\.com)$/.test(url.hostname)) {
      e.respondWith(
        caches.match(req).then(function (hit) {
          return hit || fetch(req, { mode: 'cors' }).then(function (res) {
            var copy = res.clone();
            caches.open(V).then(function (c) { c.put(req, copy); });
            return res;
          }).catch(function () { return hit || Response.error(); });
        })
      );
    }
    return;
  }

  // Assets and engine code: cache-first, they are versioned by cache name.
  if (/\.(css|js|woff2?|png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(V).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // Pages: network-first so content stays fresh, cache as fallback.
  e.respondWith(
    fetch(req)
      .then(function (res) {
        var copy = res.clone();
        caches.open(V).then(function (c) { c.put(req, copy); });
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html') || new Response(
            '<!doctype html><meta charset=utf-8><title>Offline</title>' +
            '<body style="font-family:system-ui;background:#06080f;color:#f4f6fb;' +
            'display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
            '<div><h1 style="color:#f7c948;font-family:Sora,system-ui">Offline</h1>' +
            '<p>This tool has not been opened before, so it is not stored on your device yet.<br>' +
            'Reconnect to open it once, and it will work offline afterwards.</p></div>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      })
  );
});
