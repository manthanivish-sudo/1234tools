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

noto-emoji/              336 of Google's Noto Emoji (Apache-2.0, noto-emoji/LICENSE), as SVG bodies
                         in one JSON file (noto-subset.json, 1.0 MB), cut from @iconify-json/noto 1.2.9
                         (https://registry.npmjs.org/@iconify-json/noto/-/noto-1.2.9.tgz) by
                         build/ai-image/make-noto-subset.js. Not byte-for-byte: a subset, with each
                         icon's SVG ids prefixed so several can be inlined together. Fetched only
                         when a sticker picker is opened (Thumbnail Maker, Reel Maker).
