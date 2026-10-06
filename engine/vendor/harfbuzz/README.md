# HarfBuzz (text shaping) for generated PDFs

Used by `engine/pdf-shaper.js` (MVRShaper) to shape Devanagari — conjuncts,
the pre-base i-matra, reph, nukta — before `build/pdf-package/engine/pdffont.js`
embeds the glyphs. Served from this site and fetched only on the first call.

| File | Source | Bytes | SHA-256 |
|---|---|---|---|
| harfbuzz.wasm | harfbuzzjs 1.6.3 (npm), `dist/harfbuzz.wasm` — HarfBuzz 14.6.0, the shaping build | 441359 | 5f67e3bd1c4f40ffd07c12d7faa30ebc40cc65998ce058fde5b3c6504607bfb4 |
| LICENSE | harfbuzzjs 1.6.3, `LICENSE` (MIT) | 1079 | 5d09767b2cc476f08028b56d9384dc45061c5a3e90f9ad966e44addc8d26c8b1 |
| COPYING | HarfBuzz's `COPYING` ("Old MIT") | 1971 | ba8f810f2455c2f08e2d56bb49b72f37fcf68f1f4fade38977cfd7372050ad64 |

Tarball: `https://registry.npmjs.org/harfbuzzjs/-/harfbuzzjs-1.6.3.tgz`.
`harfbuzz.wasm` is byte-for-byte the file in the package.

Not vendored: `harfbuzz-subset.wasm` (subsetting is done in pdffont.js),
and harfbuzzjs's `harfbuzz.js` / `index.mjs`. The emscripten loader is an ES
module (it uses `import.meta`), which a classic Web Worker cannot load with
`importScripts`; pdf-shaper.js instantiates the wasm itself and supplies its
five imports (`_abort_js`, `_emscripten_runtime_keepalive_clear`,
`_setitimer_js`, `emscripten_resize_heap`, `proc_exit`).

## Licences

- harfbuzzjs: MIT — `LICENSE`.
- HarfBuzz: "Old MIT" — `COPYING`. Permissive; requires the copyright notice
  and the two paragraphs to accompany copies.
