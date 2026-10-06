/**
 * The PDF tools' worker: pdfcore and the tool's spec, off the main thread.
 *
 * render-pdf.js starts one of these per tool page and talks to it with
 * postMessage. Parsing a 300-page file or writing a merged one used to run
 * on the page's own thread and freeze it; here it runs beside the page,
 * which keeps scrolling, and a Cancel terminates the worker outright, which
 * is the only cancel that actually stops a synchronous parse.
 *
 * Messages in:
 *   { type: 'init', core, scripts }                 importScripts each URL
 *   { type: 'load', id, fileId, bytes, password }   parse and keep a file
 *   { type: 'drop', fileId }                        forget a file
 *   { type: 'run', id, specId, files, opts, text, preview }
 *   { type: 'call', id, fn, args }                  one core function
 * Messages out:
 *   { type: 'ready' } | { type: 'fatal', message }
 *   { type: 'loaded', id, fileId, pages, security }
 *   { type: 'progress', id, done, total, label }
 *   { type: 'result', id, result }                  file buffers transferred
 *   { type: 'error', id, code, message }
 *
 * Specs are the same files the page loads; they only ever touch
 * window.PDF_TOOLS and window.MVRPdfCore, so `window` is aliased to the
 * worker's global before they are imported.
 */
/* eslint-env worker */
'use strict';
self.window = self;

const docs = new Map();          // fileId -> { doc, name, size, pages }
let current = null;              // id of the run in progress, for progress messages

function fail(id, e) {
  const message = (e && e.message) ? e.message : String(e || 'unknown error');
  const code = (e && e.code) || (/password/i.test(message) ? 'password' : 'error');
  self.postMessage({ type: 'error', id, code, message });
}

/** Every distinct ArrayBuffer behind the result's files, to transfer. */
function transferables(result) {
  const seen = new Set();
  const list = [];
  for (const f of (result && result.files) || []) {
    if (!f || !f.bytes || !f.bytes.buffer) continue;
    /* a view on part of a larger buffer is copied, so transferring it does
       not hand the worker's other data to the page */
    if (f.bytes.byteOffset !== 0 || f.bytes.byteLength !== f.bytes.buffer.byteLength) f.bytes = f.bytes.slice();
    if (!seen.has(f.bytes.buffer)) { seen.add(f.bytes.buffer); list.push(f.bytes.buffer); }
  }
  return list;
}

/** The page objects a written PDF holds: the writer puts each one as
    "/Type /Page", so counting them costs a scan, not a second parse. */
function pageCount(f) {
  if (!f || !f.bytes || (f.type && f.type !== 'application/pdf')) return null;
  const b = f.bytes;
  let n = 0;
  for (let i = 0, end = b.length - 11; i < end; i++) {
    /* "/Type /Page" not followed by "s" */
    if (b[i] === 47 && b[i + 1] === 84 && b[i + 2] === 121 && b[i + 3] === 112 && b[i + 4] === 101 && b[i + 5] === 32 &&
        b[i + 6] === 47 && b[i + 7] === 80 && b[i + 8] === 97 && b[i + 9] === 103 && b[i + 10] === 101 && b[i + 11] !== 115) n++;
  }
  return n || null;
}

/** A result has to survive structured cloning: drop anything that cannot. */
function cloneable(result) {
  if (!result || typeof result !== 'object') return result;
  const out = {};
  for (const k of ['error', 'warn', 'report', 'stats', 'files', 'note', 'data']) {
    if (result[k] !== undefined) out[k] = result[k];
  }
  if (out.files) {
    out.files = out.files.map((f) => ({ name: f.name, bytes: f.bytes, type: f.type || null, pages: f.pages || pageCount(f) }));
  }
  return out;
}

/* One message at a time: a preview run and a real run share the core's
   progress and preview hooks, so they must never interleave. */
let queue = Promise.resolve();
self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.type === 'drop') { docs.delete(m.fileId); return; }
  queue = queue.then(() => handle(m));
};

async function handle(m) {
  const core = self.MVRPdfCore;
  try {
    if (m.type === 'init') {
      importScripts(m.core);
      for (const s of m.scripts || []) importScripts(s);
      self.postMessage({ type: 'ready' });
      return;
    }
    if (m.type === 'load') {
      const bytes = new Uint8Array(m.bytes);
      const doc = await core.PDFDocument.load(bytes, { password: m.password || '' });
      const pages = await doc.pageCount();
      docs.set(m.fileId, { doc, name: m.name, size: bytes.length, pages });
      self.postMessage({ type: 'loaded', id: m.id, fileId: m.fileId, pages, security: doc.security || null, warnings: doc.warnings.slice(0, 5) });
      return;
    }
    if (m.type === 'run' || m.type === 'call') {
      current = m.id;
      let last = 0;
      core.setProgress && core.setProgress((done, total, label) => {
        /* at most ~30 messages a second: a 5,000-page merge would otherwise
           queue thousands of them */
        const now = Date.now();
        if (done < total && now - last < 33) return;
        last = now;
        self.postMessage({ type: 'progress', id: m.id, done, total, label: label || '' });
      });
      core.setPreview && core.setPreview(m.preview || null);
      let result;
      try {
        if (m.type === 'call') {
          const fn = core[m.fn];
          if (typeof fn !== 'function') throw new Error('No core function ' + m.fn);
          result = { data: await fn.apply(null, m.args || []) };
        } else {
          const spec = (self.PDF_TOOLS || {})[m.specId];
          if (!spec || typeof spec.run !== 'function') throw new Error('This tool has nothing to run.');
          const list = [];
          for (const f of m.files || []) {
            const d = docs.get(f.fileId);
            if (!d) { const e = new Error('The worker lost ' + f.name + '; choose it again.'); e.code = 'missing'; throw e; }
            list.push({ doc: d.doc, name: f.name, size: d.size, pages: d.pages, fileId: f.fileId });
          }
          result = await spec.run({
            docs: list, opts: m.opts || {}, core, text: m.text || '',
            preview: m.preview || null,
            progress: (done, total, label) => self.postMessage({ type: 'progress', id: m.id, done, total, label: label || '' })
          });
        }
      } finally {
        core.setProgress && core.setProgress(null);
        core.setPreview && core.setPreview(null);
        current = null;
      }
      const out = cloneable(result);
      self.postMessage({ type: 'result', id: m.id, result: out }, transferables(out));
      return;
    }
  } catch (e) {
    if (m.type === 'init') { self.postMessage({ type: 'fatal', message: (e && e.message) || String(e) }); return; }
    fail(m.id, e);
  }
}

/* An out-of-memory or a thrown error outside a handler still has to reach
   the page, or its progress bar would spin for ever. */
self.addEventListener('error', (ev) => {
  self.postMessage({ type: 'error', id: current, code: 'crash', message: ev.message || 'The PDF engine stopped.' });
});
self.addEventListener('unhandledrejection', (ev) => {
  const r = ev.reason;
  self.postMessage({ type: 'error', id: current, code: 'crash', message: (r && r.message) || String(r) });
});
