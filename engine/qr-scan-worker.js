/* ============================================================
   The QR Code Scanner's picture reader, off the main thread.

   Pictures dropped on the scanner, one or a hundred, are drawn to a canvas
   on the page (the one step a worker cannot do for every image type) and
   their pixels handed here, where the site's own readers look for every QR
   code (engine/qr-detect.js) and every linear barcode (engine/qr-barcode.js)
   in them. A large photo can take a few hundred milliseconds to search, and
   doing that here keeps the page scrolling and the Cancel button working.

   message in:  { id, views: [{ data: ImageData, view }], bars: ImageData|null }
   message out: { id, codes: [{ text, format, corners, view, ... }] }
   ============================================================ */
'use strict';
importScripts('qr.bundle.js', 'qr-detect.js', 'qr-barcode.js');

self.onmessage = function (e) {
  const m = e.data || {};
  const codes = [];
  try {
    /* views are tried in turn; the first that holds any QR code wins */
    for (const v of m.views || []) {
      const list = self.QRDetect.scanAll(v.data);
      if (list.length) {
        list.forEach(function (g) { g.format = 'qr_code'; g.view = v.view; codes.push(g); });
        break;
      }
    }
    if (m.bars) {
      self.QRBarcode.scan(m.bars).forEach(function (b) { codes.push(b); });
    }
    self.postMessage({ id: m.id, codes: codes });
  } catch (err) {
    self.postMessage({ id: m.id, codes: codes, error: String(err && err.message || err) });
  }
};
