/**
 * Text out of a PDF, in the page, with the pdf.js the site already vendors.
 *
 *   MVRPdfText.extract(file | ArrayBuffer, { maxPages }) ->
 *     { numPages, pages: [text, ...], text }
 *
 * pdf.js hands back positioned glyph runs, not lines. Runs are grouped by
 * their vertical position so a line reads as a line, which is what makes an
 * invoice's rows recoverable rather than a soup of words. A scanned PDF has
 * no text layer and comes back empty; the caller says so to the reader.
 */
(function () {
  'use strict';
  const BASE = (function () {
    const s = document.currentScript || document.querySelector('script[src$="pdf-text.js"]');
    return new URL('vendor/pdfjs/', s ? s.src : location.href).href;
  })();
  let lib = null;
  async function ensure() {
    if (lib) return lib;
    const mod = await import(BASE + 'pdf.min.mjs');
    mod.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.mjs';
    lib = mod;
    return mod;
  }

  function linesOf(items) {
    /* group by baseline (transform[5]); tolerance scales with font height */
    const rows = [];
    for (const it of items) {
      if (!it.str) continue;
      const y = it.transform[5], h = Math.abs(it.transform[3]) || 8;
      let row = rows.find(r => Math.abs(r.y - y) <= Math.max(2, h * 0.5));
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push(it);
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map(r => {
      r.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let out = '', lastEnd = null;
      for (const it of r.items) {
        const x = it.transform[4];
        if (lastEnd !== null) {
          const gap = x - lastEnd;
          /* a wide gap is a column boundary: mark it with a tab so tables survive */
          out += gap > (Math.abs(it.transform[0]) || 8) * 1.5 ? '\t' : (gap > 1 ? ' ' : '');
        }
        out += it.str;
        lastEnd = x + (it.width || 0);
      }
      return out.replace(/[ \t]+$/g, '');
    }).filter(l => l.trim());
  }

  async function extract(src, opts) {
    const o = opts || {};
    const pdfjs = await ensure();
    const buf = src instanceof ArrayBuffer ? src : await src.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), cMapUrl: BASE + 'cmaps/', cMapPacked: true, standardFontDataUrl: BASE + 'standard_fonts/' }).promise;
    const n = Math.min(pdf.numPages, o.maxPages || 50);
    const pages = [];
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      pages.push(linesOf(tc.items).join('\n'));
    }
    return { numPages: pdf.numPages, pages, text: pages.map((p, i) => (n > 1 ? '--- page ' + (i + 1) + ' ---\n' : '') + p).join('\n\n') };
  }

  window.MVRPdfText = { extract };
})();
