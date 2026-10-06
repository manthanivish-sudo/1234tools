# Tesseract language data (tessdata_fast)

Trained LSTM models for the OCR engine (`engine/pdf-ocr-engine.js`, tesseract.js
6 with OEM 1, LSTM only). The "fast" models are 8-bit integer networks: the
speed/accuracy balance the Tesseract project ships by default in Linux
distributions. They carry no legacy-engine data, which is why the vendored
cores are the LSTM-only builds.

* Source: https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/
  (repository tesseract-ocr/tessdata_fast, branch main at 8741641, 1 August
  2024; eng.traineddata last changed in 923915d, 14 September 2017;
  hin.traineddata in 4e7c9ce, 26 February 2018). Downloaded 6 October 2026.
* Licence: Apache-2.0, the repository's LICENSE, copied beside these files.

## Files

The models are stored gzipped (level 9, made with Node's zlib) and fetched as
`<lang>.traineddata.gz`: tesseract.js 6 appends `.gz` to the name when its
`gzip` option is true (the default, and what the loader sets), checks the
gzip magic bytes and inflates in the worker. The inflated bytes are exactly
the upstream files. If a host ever sends the .gz with `Content-Encoding: gzip`,
the browser inflates it first and tesseract.js sees no magic bytes and uses it
as is, so either way works.

| File | Bytes | sha256 |
|---|---:|---|
| eng.traineddata.gz | 1,962,155 | b130d16b69e3888bc099133991a50a5b50e1da0e3ff6ca31a5496fab0fb386c3 |
| hin.traineddata.gz | 920,821 | 2bc56d6b657329759a9e10759cc157ad9d546e91e0698c04d23a36df43d97986 |
| LICENSE | 11,358 | cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30 |

Upstream, inflated:

| File | Bytes | sha256 |
|---|---:|---|
| eng.traineddata | 4,113,088 | 7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2 |
| hin.traineddata | 1,122,751 | 4c73ffc59d497c186b19d1e90f5d721d678ea6b2e277b719bee4e2af12271825 |

Both are far below the 24 MiB split threshold of `build/split-models.js`.

To check a file: `node -e "const z=require('zlib'),c=require('crypto');console.log(c.createHash('sha256').update(z.gunzipSync(require('fs').readFileSync(process.argv[1]))).digest('hex'))" eng.traineddata.gz`
should print the upstream sha256 above.

## Adding a language

Download `<lang>.traineddata` from the same place, gzip it to
`<lang>.traineddata.gz`, add it to the tables here, and add its English name
to `LANG_NAMES` in `engine/pdf-ocr-engine.js` (the loader refuses languages it
does not list). Bump `V` in sw.js when a file here changes, since the service
worker keeps these cache-first.
