# Fonts for Unicode text in generated PDFs

Embedded (subset) by `build/pdf-package/engine/pdffont.js` when text goes beyond
what the base-14 PDF fonts can show; Devanagari is shaped with HarfBuzz
(`engine/pdf-shaper.js`, `engine/vendor/harfbuzz/`). Served from this site and
fetched only when a document needs them.

Each `.ttf` is byte-for-byte the file in the npm package named below.

| File | Package (npm) | Path in package | Font version | Bytes | SHA-256 |
|---|---|---|---|---|---|
| NotoSans-Regular.ttf | @expo-google-fonts/noto-sans 0.4.2 | 400Regular/NotoSans_400Regular.ttf | 2.015 | 629024 | fe8c022f48d8dd29f17b744d16f9346f4357e16f7d4f7be58b000ae7c291b614 |
| NotoSans-Bold.ttf | @expo-google-fonts/noto-sans 0.4.2 | 700Bold/NotoSans_700Bold.ttf | 2.015 | 630968 | 13a813c49624ae3ba3c5c6e72c5ebffc4b9e1e6ea32f421c04069b037c6ad431 |
| NotoSansDevanagari-Regular.ttf | @expo-google-fonts/noto-sans-devanagari 0.4.1 | 400Regular/NotoSansDevanagari_400Regular.ttf | 2.006 | 221084 | 084a94d89eb54aafb93a056e15425c34fd859f6342875165d304837b3bcfc2d2 |
| NotoSansDevanagari-Bold.ttf | @expo-google-fonts/noto-sans-devanagari 0.4.1 | 700Bold/NotoSansDevanagari_700Bold.ttf | 2.006 | 221652 | 67f1ec9e2ac30b261090e32953b2df0adf6c942ab26ac47efb490fa7315bddab |
| OFL-NotoSans.txt | @expo-google-fonts/noto-sans 0.4.2 | LICENSE_FONT | — | 4396 | cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a |
| OFL-NotoSansDevanagari.txt | @expo-google-fonts/noto-sans-devanagari 0.4.1 | LICENSE_FONT | — | 4386 | a216f6f8d85c7228093e0ee5e258d9d377e6671f68acb4db1930b29583d0f331 |

Tarballs: `https://registry.npmjs.org/@expo-google-fonts/noto-sans/-/noto-sans-0.4.2.tgz`
and `https://registry.npmjs.org/@expo-google-fonts/noto-sans-devanagari/-/noto-sans-devanagari-0.4.1.tgz`.
The packages redistribute the Google Fonts builds; the fonts' own copyright
lines are "Copyright 2022 The Noto Project Authors" (notofonts/latin-greek-cyrillic
and notofonts/devanagari).

## Licence

SIL Open Font License 1.1 — the full text, with each family's copyright line,
is in `OFL-NotoSans.txt` and `OFL-NotoSansDevanagari.txt`. The OFL allows
embedding and subsetting in documents; a subset embedded in a PDF is not a
"Modified Version" that would need renaming (the PDF carries it under a
subset tag, e.g. `ABCDEF+NotoSans-Regular`). The fonts have no Reserved Font
Name, and `fsType` is 0 (installable embedding).

## Coverage, for choosing between them

- Noto Sans (this Google Fonts build): Latin, Greek, Cyrillic, common symbols
  and currency (₹ €), *and* the whole Devanagari block with its shaping
  tables (`dev2`).
- Noto Sans Devanagari: Devanagari plus ASCII, most of Latin-1, part of Latin
  Extended-A (it has Ł Ą Ż ā; it lacks ō ĉ ĥ and others), common punctuation,
  ₹ € ™. No Greek, no Cyrillic. `PDFFont.pickFont` sends Devanagari mixed with
  anything it lacks to Noto Sans instead.
