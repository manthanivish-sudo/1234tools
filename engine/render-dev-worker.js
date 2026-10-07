/* ============================================================
   The developer and text tools' Web Worker (render-dev.js starts it).

   It loads the page's own engine scripts, the same files the page ran, and
   calls the same transform, so a big input or a runaway regex is worked on
   here and the page never freezes. The page can end this worker at any
   moment (Cancel, or a tool's time limit); nothing here outlives it.

   Message in:  { job, scripts: [url…], ns: 'DEV_TOOLS', tool: id, text, opts }
   Message out: { job, res } or { job, fallback: true } when the engine cannot
   run here (it needs the page) or its result cannot be copied back; the page
   then runs it itself.
   ============================================================ */
'use strict';
self.window = self;
let loaded = '';

self.onmessage = function (e) {
  const d = e.data || {};
  const key = (d.scripts || []).join('\n');
  try {
    if (loaded !== key) {
      // only this site's own engine files, never another origin's
      const own = (d.scripts || []).filter(function (u) {
        try { return new URL(u, self.location.href).origin === self.location.origin; } catch (err) { return false; }
      });
      importScripts.apply(self, own);
      loaded = key;
    }
  } catch (err) {
    self.postMessage({ job: d.job, fallback: true, why: 'load' });
    return;
  }
  const spec = self[d.ns] && self[d.ns][d.tool];
  if (!spec || typeof spec.transform !== 'function') { self.postMessage({ job: d.job, fallback: true, why: 'spec' }); return; }
  let res;
  try { res = spec.transform(String(d.text || ''), d.opts || {}) || {}; }
  catch (err) {
    // a ReferenceError means the engine needs the page (document, DOMParser…)
    if (err && (err.name === 'ReferenceError' || err.name === 'TypeError')) { self.postMessage({ job: d.job, fallback: true, why: err.message }); return; }
    res = { error: 'Something went wrong processing that input.' };
  }
  try { self.postMessage({ job: d.job, res: res }); }
  catch (err) { self.postMessage({ job: d.job, fallback: true, why: 'clone' }); }
};
