# Wave 2 (PDF) — notes

Branch `wave/w2pdf-2026-10-06`, from `main` a90208e9d. Run on the owner's
Windows machine in a local worktree (not the cloud); Chrome at the default
path; ports 8850–8869. This file is rewritten as items land; the final
counts are in "Final state" at the bottom once it exists.

## Drop 1 complete

- **A. PDF to images Save buttons**: each card saves its own picture under
  its own name; the extension follows `blob.type` (Safari without WebP gets
  `.png`). Tested: pdf-fixes 11a.
- **B. Shell v2** (engine/render-pdf.js, engine/pdf-worker.js):
  1. Lazy page grids (IntersectionObserver, two renders at a time, kept per
     rotation) on delete, extract, rotate, split, organise, PDF to images
     and merge (a grid per file behind "Pages: all"). Click, shift-click,
     drag-paint, keyboard (arrows, Space, Shift+arrows, Ctrl+A, R; organise
     Alt+arrows, Delete), two-way sync with the range box (order kept),
     per-page turn buttons, split points with scissors.
  2. Merge rows drag to reorder (mouse anywhere, touch by the grip), arrows
     keep the focus; per-file page choices move with their file.
  3. pdfcore runs in a Web Worker behind the same spec.run(); progress per
     page written; Cancel terminates the worker (files re-sent to a new one
     on the next run). Falls back to the page where no worker can start.
  4. Live preview for watermark and page numbers: the real output of the
     page in view (assemble writes only that page), re-rendered as you type.
  5. Text and signature items: drag, corner resize, side handle for wrap
     width, keyboard nudge/resize/delete/edit, several items, "this page /
     every page / the last page" buttons. Signature now banks items too.
  6. Guards: bytes per file and in total scaled to navigator.deviceMemory
     (1 GB at 4 GB+), 10,000 pages, canvas pixel ceiling for PDF to images;
     per-file messages by name.
  7. Passwords: a per-file password box; decryption by our own standard
     security handler (see Decisions), RC4 40/128, AES-128, AES-256,
     object streams, owner-only restrictions.
  8. Output names after the source (merge after the first file; ZIPs after
     the source).
  9. Settings kept per tool (`1234tools-pdf-<id>-v1`): selects, numbers,
     colours and fields marked `remember`; never page ranges, typed text,
     signatures or passwords; a Reset link.
- **C. Invoice** rebuilt (helper agent): three layouts, logo, GST
  CGST/SGST/IGST or VAT per line, discount and shipping, currency from
  prefs, saved clients, autosave, JSON export/import, next number, PAID
  stamp; reuses the quotation's parser and words through
  `PDF_TOOLS['quotation-pdf'].lib` and `workerScripts`. "2,650" is parsed
  as quotation does (ambiguity reported).
- **D. New tools**: Compress PDF (pictures re-encoded at a chosen DPI in
  the worker with OffscreenCanvas, only where smaller; streams deflated;
  duplicates folded; object streams + xref stream; metadata optional;
  presets incl. "Email: under 2 MB" which says when it misses), Protect PDF
  (AES-256 default, AES-128, permissions, owner password), Unlock PDF.

## Decisions taken (reversible)

- **qpdf WASM not used.** `@neslinesli93/qpdf-wasm` 0.3.0 is ISC, ships no
  qpdf LICENSE/NOTICE, and its wasm statically links libjpeg-turbo 2.1.1
  (IJG + BSD-3 + zlib); IJG is not on the allowed list. Per the brief's
  fallback the standard security handler is implemented in pdfcore
  (`build/pdf-package/engine/pdfcrypt.js`: MD5, RC4, AES, SHA-2, R2–R6
  open; R4 AES-128 and R6 AES-256 write), verified by pdf.js and MuPDF.
- **Tesseract is vendored although its core also links IJG libjpeg 9a**
  (plus Leptonica BSD-2, libpng, libtiff, zlib, libwebp BSD-3, giflib MIT):
  there is no alternative OCR engine, every licence is permissive, the IJG
  attribution is in engine/vendor/tesseract/THIRD-PARTY-NOTICES.txt.
  **Decision needed**: accept IJG/libpng/libtiff as permissive, or remove
  OCR PDF and Image to Text (delete engine/vendor/tesseract,
  engine/models/tessdata, the two specs and pages).
- Organise is now a worker tool with the grid on file load (no "Show the
  pages" press); its old claims and tests were rewritten.
- Watermark text is remembered (marked `remember: true`); signature text
  never is.
- Hub: tools that use pdf.js go in "Needs a rendering engine";
  build-pdf-ship.js now moves cards between grids and refreshes their
  descriptions from the specs.

## Baseline at a90208e9d (before any change)

test_pdfcore 305/305, test_pdftools 869/869 (the brief says 7 known
failures; on this machine there were 0), pdf-fixes 120/120, claims --only
pdf 196/196 (17 manual), content/_check --only pdf 0 errors.
