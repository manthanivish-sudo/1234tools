Third-party code served from this site for the on-device tools. Each file is
byte-for-byte as published on npm; the licence text sits beside it.

gifenc.esm.js            gifenc 1.0.3 (MIT, LICENSE-gifenc.txt)
                         https://registry.npmjs.org/gifenc/-/gifenc-1.0.3.tgz  dist/gifenc.esm.js
                         GIF palette quantisation and encoding for engine/aiimg-core.js encodeGIF.

mp4-muxer.mjs            mp4-muxer 5.2.2 (MIT, LICENSE-mp4-muxer.txt)
                         https://registry.npmjs.org/mp4-muxer/-/mp4-muxer-5.2.2.tgz  build/mp4-muxer.mjs
                         sha256 d2c4c782f180c86ed30b1f5d9487a34a0d370bf9b4535285734ea187d38f9bb5
                         Boxes WebCodecs H.264 chunks, and AAC or Opus audio, into MP4 with the
                         moov before the mdat (fastStart 'in-memory'). Used only through the
                         openMuxer() adapter in engine/aiimg-core.js. Its author has succeeded it
                         with Mediabunny (https://mediabunny.dev), which is MPL-2.0 — outside this
                         site's Apache-2.0/MIT/BSD rule — so that is not vendored; openMuxer() is
                         the one place to change if that decision changes.

ort/                     ONNX Runtime Web 1.30.0 (MIT) — see ort/README.txt.

pdfjs/                   pdf.js (Apache-2.0) — see the licence file in that folder.

fonts/                   Noto Sans (Regular, Bold) and Noto Sans Devanagari (Regular, Bold),
                         SIL OFL 1.1 — see fonts/README.md and the OFL files beside them.
                         Subset into PDFs by build/pdf-package/engine/pdffont.js for text the
                         standard PDF fonts cannot hold; fetched only when such text is drawn.

harfbuzz/                HarfBuzz shaping (Old MIT) built as harfbuzzjs 1.6.3 (MIT) — see
                         harfbuzz/README.md. Shapes Devanagari for the PDF tools, driven by
                         engine/pdf-shaper.js; the ES-module loader is not shipped.

tesseract/               Tesseract.js 6.0.1 and tesseract.js-core 6.1.2 (Apache-2.0), LSTM
                         builds only — see tesseract/README.md. The core links Leptonica
                         (BSD-2), libpng, libtiff, zlib, libwebp (BSD-3), giflib (MIT) and IJG
                         libjpeg 9a (IJG licence, attribution in THIRD-PARTY-NOTICES.txt).
                         Language data in engine/models/tessdata/.
