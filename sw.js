/* Offline support.
   Precaching 900 pages would be a rude thing to do to someone's data plan,
   so we precache only the shell and cache tool pages as they are visited. */

var V = '1234tools-v195';
var SHELL = [
  './', './index.html',
  './assets/app.css', './assets/app.js', './assets/icons.svg',
  './engine/render-core.js', './engine/units.bundle.js', './engine/tools.bundle.js',
  './assets/fonts/sora-latin.woff2', './assets/fonts/inter-latin.woff2',
  './manifest.webmanifest',
  './assets/version.js',
  './engine/handoff.js'
];
/* The footer's version record (written by build/release.js with this V) is
   precached so the cache named V holds the record of the same release. It
   alone skips the HTTP cache: /assets/ is max-age=600, and a record kept from
   the last release would label this one with the old number until the next. */
var FRESH = { './assets/version.js': true };

/* The hand-off store (engine/handoff.js) for the share target below. A
   failure here must not stop the worker installing: offline use matters more. */
try { importScripts('./engine/handoff.js'); } catch (err) { /* no share target */ }

/* An installed tool chosen in a phone's share sheet is opened with a POST
   (share_target in its manifest). Nothing is uploaded: the files and text are
   put into IndexedDB under a one-time id and the tool opens with that id
   after the #, where engine/handoff.js reads and deletes it. */
function sharedIn(req) {
  var to = new URL(req.url);
  to.search = '';
  return req.formData().then(function (fd) {
    var files = fd.getAll('files').filter(function (f) { return f && typeof f !== 'string' && f.size; })
      .map(function (f) { return { name: f.name || 'shared', type: f.type, blob: f }; });
    var text = ['title', 'text', 'url'].map(function (k) { return fd.get(k); })
      .filter(function (v) { return typeof v === 'string' && v.trim(); }).join('\n');
    if (!self.MVRHandoff || (!files.length && !text)) return Response.redirect(to.href, 303);
    return self.MVRHandoff.put({ from: 'your share sheet', files: files, text: text }).then(function (id) {
      return Response.redirect(to.href + '#handoff=' + id, 303);
    });
  }).catch(function () { return Response.redirect(to.href, 303); });
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(V)
      .then(function (c) {
        return Promise.allSettled(SHELL.map(function (u) {
          return c.add(FRESH[u] ? new Request(u, { cache: 'no-cache' }) : u);
        }));
      })
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
  if (req.method === 'POST' && /[?&]share-target(?:[=&]|$)/.test(req.url) &&
      new URL(req.url).origin === location.origin) { e.respondWith(sharedIn(req)); return; }
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Off-origin requests pass straight through, uncached. Sora and Inter used
  // to be fetched from Google and needed a rule here; they are self-hosted now
  // and precached with the rest of the shell. What is left off-origin is
  // analytics, which must never be served from cache: a replayed beacon would
  // be a false pageview, and caching one would outlive a consent withdrawal.
  if (url.origin !== location.origin) return;

  // Assets and engine code: cache-first, they are versioned by cache name.
  // mjs/bcmap/pfb/ttf are the vendored pdf.js engine, its CMaps and its
  // standard fonts; without them the two rendering tools would refetch ~1.7 MB
  // on every use and would not work offline at all. wasm and onnx are the AI
  // image runtime and its models, which must never be fetched twice. Under
  // /engine/models/ everything is cache-first whatever its extension: a model
  // sharded into .part0/.part1, a tokenizer's .json, a mel filterbank. That
  // prefix rule is deliberately narrow — assets/rates.json is refreshed daily
  // and must stay network-first. The sky and grain libraries are small images
  // that behave like model assets, so they take the same rule.
  if (/^\/engine\/(models|skies|grain)\//.test(url.pathname) ||
      /\.(css|js|mjs|wasm|onnx|bcmap|pfb|ttf|woff2?|png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          // only a good answer is kept: a 404 or a passing 5xx for a model
          // piece would otherwise be served from the cache until the next V
          if (res.ok) {
            var copy = res.clone();
            caches.open(V).then(function (c) { c.put(req, copy); });
          }
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
        // ignoreSearch matters for installed tools: their start_url carries a
        // ?src=pwa marker, and an exact match would miss the copy cached when
        // the page was first visited, stranding the app on the offline notice.
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          // './', not './index.html': on Cloudflare /index.html answers with a
          // redirect to /, and a redirected response cannot answer a navigation.
          return hit || caches.match('./') || new Response(
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
