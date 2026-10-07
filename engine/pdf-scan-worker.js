/**
 * engine/pdf-scan-worker.js: the heavy half of Scan to PDF, off the page.
 *
 * Loaded two ways:
 *   - as a dedicated Web Worker (new Worker('.../pdf-scan-worker.js')): it
 *     imports pdf-scan-vision.js next to it and answers messages;
 *   - as a classic script on the page, where a worker or OffscreenCanvas is
 *     missing: it then only defines self.MVRScanJobs, the same two jobs, and
 *     the page runs them itself (pdf-scan-vision.js must be loaded first).
 *
 * Jobs (each takes the photo as a Blob, so nothing is copied to send it):
 *   detect(blob)  -> { photoW, photoH, thumb: { width, height, data }, quad,
 *                      confidence, method, ms }
 *       The photo is decoded with its EXIF orientation applied, shrunk to
 *       1280 px on its long side, and the page searched for there. quad is
 *       [TL, TR, BR, BL] as fractions of the photo's width and height, so it
 *       holds at any resolution. thumb is a 640 px copy for the page card.
 *   process(blob, { quad, turns, mode, quality, maxSide })
 *                 -> { kind: 'jpeg' | 'grey' | 'raw', bytes | grey | rgb,
 *                      width, height, snapped, ratioMethod, ms }
 *       Full resolution (capped at 16 megapixels, Safari's canvas ceiling,
 *       and shrunk first when the page in the photo is far larger than the
 *       output, so the warp does not alias): straightened to the page's own
 *       proportions, at most maxSide px on the long side, turned by quarter
 *       turns, enhanced, then encoded. Colour and greyscale go out as JPEG
 *       from the browser's encoder (kind 'raw' if it hands back anything
 *       else); black and white as 8-bit grey for lossless Flate in the PDF.
 *
 * Messages in:  { id, op: 'detect' | 'process', blob, opts }
 * Messages out: { hello: true, ok } once, then { id, ok, result | error }
 */
/* eslint-env worker, browser */
(function (root) {
  'use strict';
  var isWorker = typeof document === 'undefined' && typeof importScripts === 'function';
  if (isWorker) {
    try { importScripts('pdf-scan-vision.js'); }
    catch (e) { root.postMessage({ hello: true, ok: false, error: 'pdf-scan-vision.js could not be loaded' }); return; }
  }
  var V = root.MVRScanVision;
  var MAX_PIXELS = 16000000;
  var now = function () { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); };

  function canvas(w, h) {
    if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  async function decode(blob) {
    if (typeof createImageBitmap !== 'function') throw new Error('This browser cannot decode photos here.');
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch (e) {
      try { return await createImageBitmap(blob); }
      catch (e2) { throw new Error('this browser could not read it as a picture' + (/hei[cf]$/i.test(blob.name || '') ? ' (HEIC photos open only in some browsers: save it as JPEG first)' : '')); }
    }
  }

  /** The bitmap drawn at w x h, as RGBA pixels. */
  function pixels(bm, w, h) {
    var c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(bm, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h);
    c.width = c.height = 1;
    return { width: d.width, height: d.height, data: d.data };
  }

  async function detect(blob) {
    var t0 = now();
    var bm = await decode(blob), W = bm.width, H = bm.height;
    var s = Math.min(1, 1280 / Math.max(W, H));
    var img = pixels(bm, Math.max(1, Math.round(W * s)), Math.max(1, Math.round(H * s)));
    if (bm.close) bm.close();
    var det = V.detectQuad(img);
    var th = V.downscale(img, 640);
    if (th === img) th = { width: img.width, height: img.height, data: img.data };
    return {
      photoW: W, photoH: H,
      thumb: { width: th.width, height: th.height, data: th.data },
      quad: det.quad.map(function (p) { return [p[0] / img.width, p[1] / img.height]; }),
      confidence: det.confidence, method: det.method, ms: Math.round(now() - t0)
    };
  }

  function len(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

  async function encodeJpeg(img, quality) {
    var c = canvas(img.width, img.height), x = c.getContext('2d');
    x.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    var blob = c.convertToBlob
      ? await c.convertToBlob({ type: 'image/jpeg', quality: quality })
      : await new Promise(function (r) { c.toBlob(r, 'image/jpeg', quality); });
    c.width = c.height = 1;
    if (!blob) throw new Error('the browser could not encode the page');
    return { type: blob.type, bytes: new Uint8Array(await blob.arrayBuffer()) };
  }

  async function processPage(blob, o) {
    var t0 = now();
    o = o || {};
    var maxSide = o.maxSide > 0 ? o.maxSide : 2500;
    var bm = await decode(blob), W = bm.width, H = bm.height;
    var q = (o.quad || [[0, 0], [1, 0], [1, 1], [0, 1]]).map(function (p) { return [p[0] * W, p[1] * H]; });
    var quadLong = Math.max(len(q[0], q[1]), len(q[3], q[2]), len(q[0], q[3]), len(q[1], q[2]));
    var s = 1;
    if (quadLong > 1.6 * maxSide) s = 1.25 * maxSide / quadLong;
    if (W * H * s * s > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (W * H));
    var w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
    var img = pixels(bm, w, h);
    if (bm.close) bm.close();
    var sx = w / W, sy = h / H;
    q = q.map(function (p) { return [p[0] * sx, p[1] * sy]; });
    var size = V.suggestSize(q, { imageWidth: w, imageHeight: h, maxSide: maxSide });
    var out = V.warp(img, q, size.width, size.height);
    img = null;
    var turns = ((o.turns | 0) % 4 + 4) % 4;
    if (turns) out = V.rotate90(out, turns);
    var mode = o.mode || 'colour';
    if (mode !== 'none') out = V.enhance(out, mode);
    var res = { width: out.width, height: out.height, snapped: size.snapped, ratioMethod: size.method, workW: w, workH: h, photoW: W, photoH: H };
    if (mode === 'bw') {
      var n = out.width * out.height, g = new Uint8Array(n), d = out.data;
      for (var i = 0, j = 0; i < n; i++, j += 4) g[i] = d[j];
      res.kind = 'grey'; res.grey = g;
    } else {
      var enc = await encodeJpeg(out, o.quality > 0 ? o.quality : 0.85);
      if (enc.type === 'image/jpeg') { res.kind = 'jpeg'; res.bytes = enc.bytes; }
      else {
        var m = out.width * out.height, rgb = new Uint8Array(m * 3), dd = out.data;
        for (var a = 0, b = 0; a < m; a++, b += 4) { rgb[a * 3] = dd[b]; rgb[a * 3 + 1] = dd[b + 1]; rgb[a * 3 + 2] = dd[b + 2]; }
        res.kind = 'raw'; res.rgb = rgb;
      }
    }
    res.ms = Math.round(now() - t0);
    return res;
  }

  var jobs = { detect: detect, process: processPage };
  root.MVRScanJobs = jobs;

  if (isWorker) {
    var ok = !!V && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function';
    if (ok) { try { ok = !!new OffscreenCanvas(1, 1).getContext('2d'); } catch (e) { ok = false; } }
    root.onmessage = function (ev) {
      var m = ev.data || {};
      if (!jobs[m.op]) { root.postMessage({ id: m.id, ok: false, error: 'unknown job ' + m.op }); return; }
      jobs[m.op](m.blob, m.opts).then(function (r) {
        var t = [];
        ['bytes', 'grey', 'rgb'].forEach(function (k) { if (r[k] && r[k].buffer) t.push(r[k].buffer); });
        if (r.thumb && r.thumb.data && r.thumb.data.buffer) t.push(r.thumb.data.buffer);
        root.postMessage({ id: m.id, ok: true, result: r }, t);
      }, function (e) {
        root.postMessage({ id: m.id, ok: false, error: (e && e.message) || String(e) });
      });
    };
    root.postMessage({ hello: true, ok: ok });
  }
}(self));
