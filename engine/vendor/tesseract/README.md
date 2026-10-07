# tesseract.js, vendored

The OCR engine behind the "OCR PDF" and "Image to Text" tools, loaded only by
`engine/pdf-ocr-engine.js` (window.MVROcr). Everything runs on the device; no
file here, and nothing it loads, comes from anywhere but this site. The
loader sets every path tesseract.js would otherwise take from jsDelivr
(workerPath, corePath, langPath), and `build/tests/pdf-ocr-engine.js` fails if
any request leaves 127.0.0.1.

## Sources

| Package | Version | Licence | From |
|---|---|---|---|
| tesseract.js | 6.0.1 | Apache-2.0 | https://registry.npmjs.org/tesseract.js/-/tesseract.js-6.0.1.tgz (sha256 4a208f2560a527ea9fc339ba2fdf125c13bca6638c194a149379601a1418d0ed) |
| tesseract.js-core | 6.1.2 | Apache-2.0 | https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-6.1.2.tgz (sha256 1b5863e7d912de9fc639222a38ede7876b2344565f8ad8d9527b242b0d793e24) |

Fetched with `npm pack` outside the repository. The code files are byte for
byte as published; the source maps (`*.map`) were left out.

## Files

| File | Bytes | sha256 | Why it is here |
|---|---:|---|---|
| tesseract.min.js | 62,961 | 10fff78484067759c43028a02a72d76d0b90eb17302bb23b58a9ec5410bc928b | tesseract.js `dist/`: the page-side API (`Tesseract.createWorker`). Injected by the loader on first use. |
| worker.min.js | 111,162 | 38645599043239c0eb6db08a6504a92dcdc292200535f3e9339cd77c4443b842 | tesseract.js `dist/`: the Web Worker. Started directly (workerBlobURL false), so the core's .wasm is found beside it. |
| tesseract-core-simd-lstm.js | 124,752 | be3504705d7111d1d1f3f7f9dff326c26d334031ede36e31c4d3cf883027e982 | Emscripten loader for the SIMD build, LSTM engine only. Used where WebAssembly SIMD exists (Chrome 91+, Firefox 89+, Safari 16.4+). |
| tesseract-core-simd-lstm.wasm | 2,871,377 | 187d76742dfc0d8929f0b49a619f145bb6370730776c7bd0d3e20c6b2098808d | Its WebAssembly. |
| tesseract-core-lstm.js | 124,747 | 48a3ee8e00924cb8c7f0cc0d099b1318fea120af56b3ee8fb3a70dd2311806c2 | The same without SIMD, for older browsers (Safari before 16.4). |
| tesseract-core-lstm.wasm | 2,871,085 | 220e2e87551edccb85519796a170469f8ab2a8055216789e3b8b1ada18b7bc2b | Its WebAssembly. |
| LICENSE | 11,357 | b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1 | tesseract.js's LICENSE.md (Apache-2.0). Also the licence of Tesseract itself. |
| LICENSE-tesseract.js-core | 11,358 | c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08 | tesseract.js-core's LICENSE (Apache-2.0; the same text, bracket style aside). |
| tesseract.min.js.LICENSE.txt | 149 | cdf963ced7d25a0f98901a547647b4d6e2dbe0197fd78c87a059a87b0e542fe2 | Named by the first line of tesseract.min.js; as published. |
| worker.min.js.LICENSE.txt | 466 | 45f54171aeaa1d10c0c1a66f374b7bba1f02472b1487fbe892eec04f840002ac | Named by the first line of worker.min.js; as published. |
| THIRD-PARTY-NOTICES.txt | 24,792 | 1be15eceb869ae5694083ef43f7fda8aa096d9ca8837c9aebe2b8d6222c62f09 | The licence texts of the C libraries linked into the .wasm files (below). |

No file is near the 24 MiB split threshold of `build/split-models.js`; the
largest is 2.7 MiB.

## Which core, and why only these two

tesseract.js-core ships eight files: four builds (with or without SIMD, with
or without the legacy engine), each as a `.js` + `.wasm` pair or as one
`.wasm.js` with the WebAssembly inlined as base64.

* **LSTM only.** The tools always run OEM 1 (LSTM_ONLY) with tessdata_fast
  models, which carry no legacy-engine data, so the legacy builds
  (`tesseract-core.*`, `tesseract-core-simd.*`, 3.47 MB of wasm each) would be
  dead weight.
* **`.js` + `.wasm`, not `.wasm.js`.** The pair is 2.99 MB against 3.95 MB for
  the `.wasm.js` (1.09 MB against 1.46 MB gzipped), the .wasm compiles while it
  streams, and the browser can cache the compiled module. tesseract.js picks a
  `.wasm.js` by itself when given a folder, so the loader does the SIMD check
  itself (the same probe as wasm-feature-detect) and passes the full URL of the
  `.js` file as corePath; tesseract.js then loads exactly that file. The `.js`
  file looks for its `.wasm` next to the worker script, which is why
  `worker.min.js` sits in this folder.
* **With and without SIMD.** A browser downloads one of the two pairs, about
  3 MB (tesseract.min.js and worker.min.js add 170 KB).

Verified in headless Chrome by `build/tests/pdf-ocr-engine.js`: the SIMD pair
is what Chrome fetches, and with the SIMD probe answering "no" the plain pair
is fetched and reads the same text exactly. Not run in Firefox or Safari.

## What is linked into the .wasm files

tesseract.js-core 6.1.2 builds Tesseract with Leptonica and Leptonica's image
libraries, all linked statically (build.sh and build-scripts/ at tag v6.1.2;
the versions are those of the submodules at that tag). Strings inside both
.wasm files confirm each one.

| Library | Version | Licence | Evidence in the .wasm |
|---|---|---|---|
| Tesseract (Balearica fork) | 5.1.0-284-g9c08 | Apache-2.0 | version string; `/src/third_party/tesseract/...` paths |
| Leptonica | 1.82 development snapshot (commit 4af068b) | BSD-2-Clause | `leptonica-%d.%d.%d`, pix* functions |
| libpng | 1.6.38 | PNG Reference Library License v2 | `1.6.38.git`, png_* messages |
| zlib | 1.2.12 | zlib | `1.2.12`, inflate/deflate messages |
| libtiff | 4.3.0 | libtiff (BSD-like) | TIFF* functions and messages |
| **libjpeg (IJG)** | **9a** | IJG licence (permissive; needs the line "this software is based in part on the work of the Independent JPEG Group" in the documentation) | `9a  19-Jan-2014`, `Copyright (C) 2014, Thomas G. Lane, Guido Vollbeding`, JPEG error messages |
| libwebp | 1.2.2 | BSD-3-Clause, with Google's patent grant | VP8Decode / VP8GetHeaders messages, `WEBPVP8L` |
| GIFLIB | 5.1.4 | MIT | Leptonica's GIF reader messages (`could not open gif stream from memory`, `failed to read GIF data`), which Leptonica compiles only when it has GIFLIB |
| OpenLibm | commit ae2d916 | MIT / BSD / ISC | built by build.sh; not confirmable from the stripped binary (Emscripten has its own libm) |

The Emscripten runtime is also compiled in: musl libc (MIT), libc++ and
libc++abi (Apache-2.0 with LLVM exception), and Emscripten's own glue (MIT).

libjpeg **is** in the binary. Leptonica uses it to read JPEG input; the
loader never hands Tesseract a JPEG (every image is redrawn on a canvas and
passed as PNG), but the code is there and the IJG acknowledgement above
applies to distributing it. Full licence texts: THIRD-PARTY-NOTICES.txt.

## Acknowledgement

This software is based in part on the work of the Independent JPEG Group.

(The IJG, libpng and libtiff licences were accepted by the site's owner on
6 October 2026; the same line appears in engine/vendor/README.txt.)

## JavaScript bundled in tesseract.min.js and worker.min.js

From the published source maps: tesseract.min.js holds tesseract.js and
regenerator-runtime (MIT). worker.min.js holds tesseract.js's worker,
regenerator-runtime (MIT), zlibjs (MIT; it inflates the .gz language data),
wasm-feature-detect (Apache-2.0), idb-keyval (Apache-2.0; unused, the cache is
off), bmp-js (MIT), is-url (MIT), buffer (MIT), base64-js (MIT) and ieee754
(BSD-3-Clause).

## What stays on the device

tesseract.js can keep language data in IndexedDB; the loader turns that off
(cacheMethod 'none'). The site's service worker (sw.js) already keeps
everything under /engine/ cache-first in its Cache Storage, versioned by
release: tesseract.min.js, worker.min.js, the core .js and .wasm, and the
gzipped language data. The test reads that cache back and checks IndexedDB
stays empty.

## Updating

1. `npm pack tesseract.js@<v> tesseract.js-core@<v>` outside the repository.
2. Copy the files listed above from `dist/` and the core package; check
   `getCore.js` in the new tesseract.js still loads a corePath ending in "js"
   as given, and that the core's `.js` still finds its `.wasm` beside the
   worker script.
3. Rerun the string check on the .wasm for the linked libraries, update this
   file and THIRD-PARTY-NOTICES.txt, and run
   `node build/tests/pdf-ocr-engine.js`.
4. Bump `V` in sw.js so returning visitors fetch the new files.
