/**
 * OCR engine for the PDF and image tools: Tesseract (through tesseract.js 6)
 * running in a Web Worker, entirely on the device.
 *
 *   const ocr = await MVROcr.create({ langs: ['eng'], onProgress, signal });
 *   const r = await ocr.recognize(canvas, { pageSegMode: 3 });
 *   // r = { text, confidence, words, lines, width, height }
 *   ocr.terminate();
 *
 * Nothing is fetched from anywhere but this site. tesseract.js reaches for
 * jsDelivr for its worker, its core and its language data unless told
 * otherwise, so every path below is set explicitly: the worker and core come
 * from engine/vendor/tesseract/, the language data from
 * engine/models/tessdata/ (stored gzipped; the worker inflates it).
 *
 * The core: we always run the LSTM engine (OEM 1), so only the LSTM-only
 * builds are shipped, with and without SIMD. We pick one here and hand
 * tesseract.js the full URL of its .js file (when corePath ends in "js" it
 * loads that file and skips its own detection). The .js file finds its .wasm
 * next to the worker script, which is why worker.min.js and the core files
 * share one folder. That pair is about 1 MB smaller than the .wasm.js builds,
 * which carry the same WebAssembly inline as base64.
 *
 * What stays on the device: nothing of tesseract.js's own. Its IndexedDB
 * cache is switched off (cacheMethod 'none'), because the site's service
 * worker already keeps every file under /engine/ cache-first in its Cache
 * Storage, versioned with each release: the worker, the core and its .wasm,
 * and the gzipped language data as downloaded (eng 1.9 MB, hin 0.9 MB). A
 * second copy in IndexedDB would hold the same data inflated (4.1 MB and
 * 1.1 MB) under a key no release ever renews. Without a service worker (a
 * private window, or before the first one installs) the browser's HTTP cache
 * applies, as for any other engine file.
 *
 * Images: canvas (HTML or Offscreen), ImageBitmap, ImageData, Blob/File or an
 * <img>. Each is drawn onto a white canvas and handed to Tesseract as a PNG,
 * so transparency reads as paper, a photo's EXIF orientation is applied as
 * the browser shows it, and every box comes back in that canvas's pixels.
 *
 * Classic script; attaches window.MVROcr. Loads tesseract.min.js on first use.
 */
(function () {
  'use strict';
  if (window.MVROcr) return;

  /* engine/ resolved from this script's own URL, so the loader works from
     /pdf/<tool>/ pages and from a site served under a subpath. */
  const ENGINE_BASE = (function () {
    const s = document.currentScript ||
      document.querySelector('script[src*="pdf-ocr-engine.js"]');
    return new URL('./', s ? s.src : location.href).href;
  })();
  const VENDOR = ENGINE_BASE + 'vendor/tesseract/';
  const LANG_PATH = ENGINE_BASE + 'models/tessdata';

  const LANG_NAMES = { eng: 'English', hin: 'Hindi' };
  const OEM_LSTM_ONLY = 1;

  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };

  /* SIMD: the same probe wasm-feature-detect uses (a function returning a
     v128 built with i8x16.splat). Safari before 16.4 and old Firefox lack it. */
  let simdKnown;
  function hasSimd() {
    if (simdKnown === undefined) {
      try {
        simdKnown = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3,
          2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
      } catch (e) { simdKnown = false; }
    }
    return simdKnown;
  }
  const corePath = () => VENDOR + (hasSimd() ? 'tesseract-core-simd-lstm.js' : 'tesseract-core-lstm.js');

  /* tesseract.min.js, once, on first use. */
  let libPromise = null;
  function loadLibrary() {
    if (window.Tesseract && window.Tesseract.createWorker) return Promise.resolve(window.Tesseract);
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = VENDOR + 'tesseract.min.js';
      s.async = true;
      s.onload = () => {
        if (window.Tesseract && window.Tesseract.createWorker) resolve(window.Tesseract);
        else reject(new Error('The OCR engine did not load.'));
      };
      s.onerror = () => reject(new Error('The OCR engine could not be downloaded.'));
      document.head.appendChild(s);
    }).catch((e) => { libPromise = null; throw e; });
    return libPromise;
  }

  /* ---------- images ---------- */

  function blankCanvas(w, h) {
    let c;
    if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(w, h);
    else { c = document.createElement('canvas'); c.width = w; c.height = h; }
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    return { c, g };
  }

  function toPng(c) {
    if (c.convertToBlob) return c.convertToBlob({ type: 'image/png' });
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('The image could not be encoded.'))), 'image/png'));
  }

  /* Any supported image -> { blob: PNG, width, height } on white. */
  async function prepare(image) {
    if (!image) throw new Error('No image to read.');
    let src = image, owned = null;
    if (typeof Blob !== 'undefined' && image instanceof Blob) {
      src = owned = await createImageBitmap(image);
    }
    try {
      let w, h;
      if (typeof ImageData !== 'undefined' && src instanceof ImageData) {
        w = src.width; h = src.height;
        /* putImageData ignores the white fill, so composite through a bitmap. */
        const bmp = await createImageBitmap(src);
        try {
          const { c, g } = blankCanvas(w, h);
          g.drawImage(bmp, 0, 0);
          return { blob: await toPng(c), width: w, height: h };
        } finally { if (bmp.close) bmp.close(); }
      }
      w = src.naturalWidth || src.videoWidth || src.width;
      h = src.naturalHeight || src.videoHeight || src.height;
      if (!w || !h) throw new Error('The image is empty.');
      const { c, g } = blankCanvas(w, h);
      g.drawImage(src, 0, 0, w, h);
      return { blob: await toPng(c), width: w, height: h };
    } finally {
      if (owned && owned.close) owned.close();
    }
  }

  /* ---------- results ---------- */

  const box = (b) => (b ? { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 } : null);

  /* tesseract.js 6's JSON gives a baseline and a row height per line, not per
     word, so each word takes the line's baseline at its own left and right
     edges, and fontSize is the line's row height (x-height plus ascender
     plus descender: about 0.9 of the em size for most Latin fonts). */
  function mapWord(w, lineBase, fontSize) {
    const b = box(w.bbox);
    let baseline = null;
    if (lineBase && b) {
      const span = lineBase.x1 - lineBase.x0;
      const at = (x) => (span ? lineBase.y0 + (lineBase.y1 - lineBase.y0) * (x - lineBase.x0) / span : lineBase.y0);
      baseline = { x0: b.x0, y0: Math.round(at(b.x0) * 10) / 10, x1: b.x1, y1: Math.round(at(b.x1) * 10) / 10 };
    }
    const out = { text: w.text, confidence: w.confidence, bbox: b, baseline };
    if (fontSize) out.fontSize = fontSize;
    return out;
  }

  function shape(data, width, height) {
    const lines = [], words = [];
    for (const block of data.blocks || []) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) {
          const base = line.baseline ? box(line.baseline) : null;
          const rh = line.rowAttributes && Number(line.rowAttributes.rowHeight);
          const fontSize = rh > 0 ? Math.round(rh * 10) / 10 : undefined;
          const lw = (line.words || []).map((w) => mapWord(w, base, fontSize));
          words.push(...lw);
          const l = {
            text: (line.text || '').replace(/\s+$/, ''),
            confidence: line.confidence,
            bbox: box(line.bbox),
            baseline: base,
            words: lw
          };
          if (fontSize) l.fontSize = fontSize;
          lines.push(l);
        }
      }
    }
    return { text: data.text || '', confidence: data.confidence, words, lines, width, height };
  }

  /* ---------- progress ---------- */

  function langLabel(langs) {
    const names = langs.map((l) => LANG_NAMES[l] || l);
    const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
    return 'Loading ' + list + ' language data';
  }

  /* tesseract.js statuses -> one fraction for create (engine 0-0.4, data
     0.4-0.95, set-up 0.95-1) and one for each recognize (0-1). */
  function progressMapper(langs) {
    const dataLabel = langLabel(langs);
    return (m) => {
      const p = Math.max(0, Math.min(1, Number(m.progress) || 0));
      switch (m.status) {
        case 'loading tesseract core': return ['create', 0.3 * p, 'Loading the OCR engine'];
        case 'initializing tesseract': return ['create', 0.3 + 0.1 * p, 'Loading the OCR engine'];
        case 'loading language traineddata': return ['create', 0.4 + 0.55 * p, dataLabel];
        case 'initializing api': return ['create', 0.95 + 0.05 * p, dataLabel];
        case 'recognizing text': return ['read', p, 'Reading the text'];
        default: return null;
      }
    };
  }

  /* ---------- create ---------- */

  async function create(opts) {
    opts = opts || {};
    const langs = (opts.langs && opts.langs.length ? opts.langs : ['eng']).slice();
    for (const l of langs) if (!LANG_NAMES[l]) throw new Error('No OCR data for language "' + l + '".');
    const signal = opts.signal;
    let onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
    if (signal && signal.aborted) throw abortError();

    const report = (f, label) => { if (onProgress) { try { onProgress(f, label); } catch (e) { /* the caller's problem */ } } };
    report(0, 'Loading the OCR engine');

    const Tesseract = await loadLibrary();
    if (signal && signal.aborted) throw abortError();

    const mapStatus = progressMapper(langs);
    let readProgress = null;       /* the running recognize's own callback, if any */
    let created = false;
    let dead = false;
    let rawWorker = null;          /* the Web Worker, so an abort can stop it at any point */
    let api = null;
    let failCreate = null;
    let failRead = null;

    const kill = () => {
      if (dead) return;
      dead = true;
      try { if (api) api.terminate(); } catch (e) { /* */ }
      try { if (rawWorker) rawWorker.terminate(); } catch (e) { /* */ }
    };

    const logger = (m) => {
      const r = mapStatus(m);
      if (!r) return;
      if (r[0] === 'create' && !created) report(r[1], r[2]);
      else if (r[0] === 'read' && created) {
        if (readProgress) { try { readProgress(r[1], r[2]); } catch (e) { /* */ } } else report(r[1], r[2]);
      }
    };
    /* tesseract.js 6 throws on a worker-side failure unless given an error
       handler, and a failed language download never settles createWorker. */
    const errorHandler = (err) => {
      const msg = String((err && err.message) || err).replace(/^(Error:\s*)+/, '');
      const net = /fetching .*\/(\w+)\.traineddata.*Response code: (\d+)/.exec(msg);
      const e = new Error(net
        ? 'The ' + (LANG_NAMES[net[1]] || net[1]) + ' language data could not be downloaded (HTTP ' + net[2] + ').'
        : msg);
      if (!created && failCreate) failCreate(e);
      else if (failRead) failRead(e);
    };

    const createPromise = new Promise((resolve, reject) => {
      failCreate = (e) => { kill(); reject(e); };
      /* createWorker constructs its Web Worker synchronously, before its first
         await, so wrapping the constructor for this one call hands us the
         worker an abort during loading must stop. */
      const NativeWorker = window.Worker;
      window.Worker = function (url, o) { const w = new NativeWorker(url, o); rawWorker = w; return w; };
      window.Worker.prototype = NativeWorker.prototype;
      let p;
      try {
        p = Tesseract.createWorker(langs, OEM_LSTM_ONLY, {
          workerPath: VENDOR + 'worker.min.js',
          corePath: corePath(),
          langPath: LANG_PATH,
          workerBlobURL: false,
          gzip: true,
          cacheMethod: 'none',
          legacyCore: false,
          legacyLang: false,
          logger,
          errorHandler
        });
      } catch (e) {
        window.Worker = NativeWorker;
        failCreate(e);
        return;
      }
      window.Worker = NativeWorker;
      if (rawWorker) {
        rawWorker.addEventListener('error', (ev) => {
          const e = new Error((ev && ev.message) || 'The OCR engine stopped with an error.');
          if (!created) failCreate(e);
          else if (failRead) failRead(e);
        });
      }
      p.then(resolve, (e) => failCreate(e instanceof Error ? e : new Error(String(e))));
    });

    let onAbort = null;
    const abortPromise = new Promise((_, reject) => {
      if (!signal) return;
      onAbort = () => { kill(); if (failRead) failRead(abortError()); reject(abortError()); };
      signal.addEventListener('abort', onAbort, { once: true });
    });
    abortPromise.catch(() => { /* observed through the races below */ });

    try {
      api = await Promise.race([createPromise, abortPromise]);
    } catch (e) {
      kill();
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
      throw e;
    }
    if (dead) { kill(); throw abortError(); }
    created = true;
    report(1, langLabel(langs));

    /* One job at a time: tesseract.js runs jobs in order anyway; queueing here
       keeps each recognize's progress its own. */
    let queue = Promise.resolve();

    async function run(image, ropts) {
      ropts = ropts || {};
      if (dead) throw (signal && signal.aborted) ? abortError() : new Error('The OCR engine has been closed.');
      const rsignal = ropts.signal;
      if (rsignal && rsignal.aborted) throw abortError();
      const img = await prepare(image);
      if (dead) throw abortError();

      const params = {};
      if (ropts.pageSegMode !== undefined && ropts.pageSegMode !== null) params.tessedit_pageseg_mode = String(ropts.pageSegMode);
      if (ropts.dpi) params.user_defined_dpi = String(Math.round(ropts.dpi));

      readProgress = typeof ropts.onProgress === 'function' ? ropts.onProgress : null;
      let onRAbort = null;
      try {
        const result = await new Promise((resolve, reject) => {
          failRead = reject;
          if (rsignal) {
            onRAbort = () => { kill(); reject(abortError()); };
            rsignal.addEventListener('abort', onRAbort, { once: true });
          }
          api.recognize(img.blob, params, { text: true, blocks: true }).then(resolve, (e) => reject(dead ? abortError() : (e instanceof Error ? e : new Error(String(e)))));
        });
        return shape(result.data, img.width, img.height);
      } finally {
        failRead = null;
        readProgress = null;
        if (rsignal && onRAbort) rsignal.removeEventListener('abort', onRAbort);
      }
    }

    return {
      langs: langs.slice(),
      /** recognize(image, { pageSegMode?, dpi?, onProgress?, signal? }).
       *  pageSegMode is Tesseract's PSM number (3 automatic, the default; 6 one
       *  block; 7 one line; 11 sparse text). An abort here closes the engine. */
      recognize(image, ropts) {
        const job = queue.then(() => run(image, ropts));
        queue = job.catch(() => { /* the next job runs regardless */ });
        return job;
      },
      terminate() {
        kill();
        if (signal && onAbort) signal.removeEventListener('abort', onAbort);
        onProgress = null;
      },
      get closed() { return dead; }
    };
  }

  window.MVROcr = {
    create,
    languages: Object.assign({}, LANG_NAMES),
    /** For the tools' own notes: what create() will fetch, before it does. */
    files(langs) {
      return {
        core: corePath(),
        wasm: corePath().replace(/\.js$/, '.wasm'),
        worker: VENDOR + 'worker.min.js',
        data: (langs || ['eng']).map((l) => LANG_PATH + '/' + l + '.traineddata.gz')
      };
    }
  };
})();
