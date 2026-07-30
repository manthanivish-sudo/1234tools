# PDF Tools — integration guide

16 PDF tools, dependency-free except for one optional lazy-loaded library.
Everything runs in the browser; no file is ever uploaded.

**968 assertions passing.** Output verified independently with PyMuPDF, not
only with my own parser.

---

## What's in the box

```
verify.js              run this first — checks nothing is missing
engine/pdfcore.js      PDF parser + writer + page operations   (the engine)
engine/pdftools.js     16 tool specs                            (declarative)
engine/render-pdf.js   UI renderer for all of them
engine/zip.js          multi-file downloads — you already have this one,
                       included so the package stands alone
assets/pdf-icons.svg   18 <symbol> blocks to merge into icons.svg
assets/pdf-styles.css  CSS to append to app.css
tests/                 two suites (968 assertions) + fixture generator
sample-output/          real PDFs produced by these tools
```

Everything sits where `verify.js` expects it: `engine/`, `assets/`, `tests/`.
If you flatten the package, `verify.js` and both suites will still find the
engine — they search the usual layouts — but keeping the structure is simplest.

---

## The 16 tools

**Manipulate existing PDFs** — no dependencies at all

| id | Tool |
|---|---|
| `merge-pdf` | Merge PDF Files |
| `split-pdf` | Split PDF |
| `extract-pdf-pages` | Extract PDF Pages |
| `delete-pdf-pages` | Delete PDF Pages |
| `rotate-pdf` | Rotate PDF Pages |
| `pdf-metadata` | Metadata Editor & Remover |
| `pdf-inspector` | PDF Inspector |
| `watermark-pdf` | Add Watermark |
| `pdf-page-numbers` | Add Page Numbers |

**Create PDFs from scratch** — no dependencies

| id | Tool |
|---|---|
| `text-to-pdf` | Text to PDF |
| `invoice-pdf` | Invoice Generator |
| `paper-pdf` | Printable Paper (graph, lined, dot, isometric, music, Cornell) |
| `label-pdf` | Label Sheet Generator |
| `certificate-pdf` | Certificate Generator |

**Needs pdf.js** — self-hosted, loaded on first use, only on these two pages
(see [Vendoring pdf.js](#vendoring-pdfjs))

| id | Tool |
|---|---|
| `pdf-to-images` | PDF to Images |
| `pdf-organise` | Organise PDF Pages (visual thumbnails) |

---

## Vendoring pdf.js

`render-pdf.js` resolves pdf.js from `vendor/pdfjs/` **relative to its own
`src`**, not to the page — tool pages sit one directory down, and the site has
been served from a subpath before, so neither a relative specifier nor a
root-absolute one survives both. If you place `render-pdf.js` somewhere other
than `engine/`, the vendor directory moves with it.

Fetch it from npm rather than copying by hand, so the bytes can be checksummed
against the published tarball:

```sh
curl -sL https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-4.6.82.tgz | tar -xz
mkdir -p engine/vendor/pdfjs
cp package/build/pdf.min.mjs package/build/pdf.worker.min.mjs package/LICENSE engine/vendor/pdfjs/
cp -r package/cmaps package/standard_fonts engine/vendor/pdfjs/
```

| Path | Size | Fetched when |
|---|---|---|
| `pdf.min.mjs` | 330 KB | first use of either tool |
| `pdf.worker.min.mjs` | 1.4 MB | first use of either tool |
| `standard_fonts/` | 804 KB | document declares a base-14 font without embedding it |
| `cmaps/` | 1.5 MB | document uses a predefined CJK encoding |

Only the first two are always needed; the other two are requested per document,
so the common case downloads 1.7 MB and no more. pdf.js is Apache-2.0 and its
`LICENSE` ships alongside it.

Two things are easy to get wrong:

- **Line endings.** If `core.autocrlf` is on, git will rewrite `pdf.min.mjs` on
  checkout and it will no longer match upstream. `engine/vendor/pdfjs/** -text`
  in `.gitattributes` prevents that.
- **Service worker.** The engine is `.mjs` and the data files are `.bcmap`,
  `.pfb` and `.ttf`. A cache rule matching only `.js` will miss all of them, and
  the tools will refetch 1.7 MB on every use and stay broken offline.

---

## Integration, five steps

Run `node verify.js` first. It confirms every file is present, that every
`core.*` the specs call is actually exported, and that the writer produces a
valid PDF — before you touch your build.

### 1. Copy the engine files

```
engine/pdfcore.js
engine/pdftools.js
engine/render-pdf.js
```

### 2. Merge the icons

Open `assets/pdf-icons.svg`, copy every `<symbol>` block, and paste it into
`assets/icons.svg` immediately before the closing `</svg>`. They already
follow your conventions — 24×24 grid, 1.75 stroke, `currentColor`.

That adds 18 symbols: one per tool plus a generic `i-pdf` for the category.

### 3. Append the CSS

```bash
cat assets/pdf-styles.css >> assets/app.css
```

It reuses your existing tokens, so it picks up light, dark and system modes
with no extra work.

### 4. Wire up `build.js`

```js
// near the other requires
const { PDF_TOOLS } = require('./engine/pdftools.js');

// in CATEGORIES
pdf: { name: 'PDF Tools' },

// in the TOTAL calculation
+ Object.keys(PDF_TOOLS).length

// in NAV_CATS counts
counts.pdf = Object.keys(PDF_TOOLS).length;

// in the page-building section
for (const [id, spec] of Object.entries(PDF_TOOLS)) index.push(buildPdfToolPage(id, spec));
```

Then add the page builder. It mirrors `buildImageToolPage` almost exactly:

```js
function buildPdfToolPage(id, spec) {
  const url = `pdf/${id}.html`;
  const canonical = `${SITE}/${url}`;
  const title = fitTitle([
    `${spec.title} — Free & Private | ${BRAND}`,
    `${spec.title} | ${BRAND}`,
    spec.title
  ]);
  const related = Object.entries(PDF_TOOLS).filter(([k]) => k !== id).slice(0, 8)
    .map(([k, s2]) => ({ title: s2.title, url: `${k}.html` }));

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'SoftwareApplication', name: spec.title, description: spec.description,
        url: canonical, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'PDF Tools', item: `${SITE}/pdf/index.html` },
        { '@type': 'ListItem', position: 3, name: spec.title, item: canonical }
      ]},
      ...(spec.faq?.length ? [{ '@type': 'FAQPage', mainEntity: spec.faq.map(f => ({
        '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [])
    ]
  };

  const body = `
<nav class="crumbs"><a href="../index.html">Home</a> › <a href="index.html">PDF Tools</a> › <span>${esc(spec.title)}</span></nav>
<article class="tool" data-tool="${id}">
  <p class="eyebrow">PDF Tools</p>
  <h1>${icon(id, '../', 'ico-title')}${esc(spec.title)}</h1>
  <p class="lede">${esc(spec.description)}</p>
  <div class="tool-io"></div>
  <section class="panel"><h2>Privacy</h2><p class="privacy-line">Your files never leave your device. PDFs are parsed and rewritten by your own browser, so nothing is uploaded, queued or logged.${spec.needsRenderer ? ' This tool downloads a rendering engine on first use; your file still never leaves the device.' : ''}</p></section>
  ${contentBlocks(spec)}
  ${relatedList(related, '')}
</article>
<script>
document.addEventListener('DOMContentLoaded',function(){
  var spec = window.PDF_TOOLS['${id}'];
  spec.id = '${id}';
  var root = document.querySelector('.tool');
  try { MVRTool.mountPDF(spec, root); }
  catch (e) {
    root.querySelector('.tool-io').innerHTML =
      '<div class="io-msg is-error">This tool needs browser features yours does not support. Try a current version of Chrome, Firefox, Edge or Safari.</div>';
  }
});
</script>`;

  write(url, shell({ title, description: spec.description, canonical, body, jsonld, depth: 1,
    activeCat: 'pdf',
    extraHead: ['<script src="../engine/pdfcore.bundle.js" defer></script>',
                '<script src="../engine/zip.js" defer></script>',
                '<script src="../engine/render-pdf.js" defer></script>',
                `<script src="../engine/pdf-${id}.js" defer></script>`].join('\n') }));

  return { id, title: spec.title, description: spec.description, category: 'pdf',
           iconId: id, keywords: spec.keywords || [], url };
}
```

### 5. Emit the bundles

Alongside your other bundle writers:

```js
fs.copyFileSync(path.join(__dirname, 'engine/render-pdf.js'),
                path.join(OUT, 'engine/render-pdf.js'));

const pdfCoreSrc = fs.readFileSync(path.join(__dirname, 'engine/pdfcore.js'), 'utf8')
  .replace(/if \(typeof module[\s\S]*$/, '');
fs.writeFileSync(path.join(OUT, 'engine/pdfcore.bundle.js'),
  '(function(){\n' + pdfCoreSrc +
  '\nwindow.MVRPdfCore={PDFDocument:PDFDocument,assemble:assemble,' +
  'parsePageRange:parsePageRange,createPDF:createPDF,textWidth:textWidth,' +
  'wrapText:wrapText,contentEscape:contentEscape,PAGE_SIZES:PAGE_SIZES,' +
  'FONTS:FONTS,latin1:latin1,isDict:isDict,isName:isName};\n})();');

// one bundle per tool, matching the pattern used elsewhere
const pdfRaw = fs.readFileSync(path.join(__dirname, 'engine/pdftools.js'), 'utf8');
const PDF_HELPERS = pdfRaw.slice(pdfRaw.indexOf('/* ---------- shared helpers'),
                                pdfRaw.indexOf('if (typeof module'));
for (const [id, spec] of Object.entries(PDF_TOOLS)) {
  const parts = [];
  for (const [k, v] of Object.entries(spec)) {
    parts.push(typeof v === 'function'
      ? `${JSON.stringify(k)}: ${v.toString()}`
      : `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  }
  fs.writeFileSync(path.join(OUT, `engine/pdf-${id}.js`),
    '(function(){\n' + PDF_HELPERS + '\nwindow.PDF_TOOLS = window.PDF_TOOLS || {};\n' +
    `window.PDF_TOOLS[${JSON.stringify(id)}] = {\n${parts.join(',\n')}\n};\n})();`);
}
```

`render-pdf.js` uses `window.MVRZip` for multi-file downloads. Your project
already has `engine/zip.js`; a copy is included here only so the package is
self-contained. **Do not overwrite yours** — they are the same file.

---

## Running the tests

Nothing to configure. From the package root:

```bash
node verify.js                    # checks the package is complete
python3 tests/make-fixtures.py    # needs: pip install reportlab pymupdf pillow
node tests/test_pdfcore.js        # 304 assertions
node tests/test_pdftools.js       # 664 assertions
```

Fixtures land in `tests/fixtures/`, output in `tests/output/`. Paths resolve
relative to the test files, so this works from any directory. Point
`MVR_PDF_FIXTURES` at another directory if you keep fixtures elsewhere.

Once integrated, add them to your `test.js`:

```js
['PDF engine', 'test_pdfcore.js'],
['PDF tools',  'test_pdftools.js'],
```

The fixtures are deliberately varied, because that is where PDF parsing
actually breaks: classic xref tables versus compressed xref streams, object
streams, inherited page attributes, mixed page sizes, rotation, and an
embedded JPEG.

## How the engine works, and its limits

### What it does

Parses **both** cross-reference forms: the classic `xref` table and the
compressed xref *stream* from PDF 1.5, including object streams. Inflation
uses the platform's own `DecompressionStream`, so no compressor ships.

If the cross-reference table is damaged it falls back to scanning the file for
`N G obj` patterns, which is how it survives files that other tools reject.

Page content streams and embedded images are copied **byte for byte**. Nothing
is re-encoded, so merging and splitting are lossless.

### What it deliberately does not do

**Encrypted PDFs are rejected** with a clear message rather than a partial
parse. Password removal is both fiddly and legally questionable.

**Bookmarks, form fields and annotations are not carried through merges.**
Rebuilding the page tree from scratch is what makes the output reliably valid;
reconciling outline trees from several documents is where most mergers produce
broken files.

**There is no text editing, and there cannot be.** PDF text is positioned
glyphs in subset fonts with no concept of reflow. Every tool advertising
"edit PDF text" either OCRs the page or renders it and overlays a text box.
The watermark and page-number tools do the honest version of this: they append
a content layer.

### One fix applied while writing the suites

`assemble()` bound the overlay font by writing onto `out.Resources.Font`
directly. In real documents that entry is an **indirect reference**, not a
dictionary, so the new key landed on a `Ref` instance and vanished at
serialisation. The watermark and page-number tools then emitted content
naming a font the page never declared, and allocated one orphan font object
per page.

Measured on `classic5.pdf` before and after: `/MVRwm` went from unbound to
bound, orphan `Helvetica-Bold` objects from 6 to 2, file size from 4901 to
4430 bytes, and the watermark rendered 2348 → 4030 marked pixels — lenient
viewers were substituting a fallback face at the wrong metrics, and a strict
one is entitled to drop the text entirely.

`assemble()` now resolves through the writer before adding overlay keys, and
does the same for `ExtGState`. Two assertions in `test_pdfcore.js` and three
in `test_pdftools.js` pin the behaviour.

### Fonts

Creation uses the base-14 fonts — Helvetica, Times, Courier — which need no
embedding. That keeps output tiny.

Text is encoded as **WinAnsi**, which is *not* Latin-1: positions 0x80–0x9F
carry smart quotes, en and em dashes, ellipses, bullets and the euro sign.
Those are mapped properly, because most text pasted from a word processor
contains them. Verified round-tripping through PyMuPDF exactly.

Scripts outside WinAnsi — CJK, Arabic, Devanagari — cannot be represented
without embedding a font, and appear as `?`. The tools say so.

---

## Verification

`sample-output/` holds real files produced by these tools. They are written by
`test_pdftools.js` (into `tests/output/`), and every one is re-opened with
PyMuPDF afterwards — page counts and extracted text both checked, so the
proof does not rely on our own parser:

| File | What it proves |
|---|---|
| `out-merged.pdf` | 9 pages from two documents with different xref formats, text intact |
| `out-invoice.pdf` | Line items, VAT, totals, alignment — £5,055 + 20% = £6,066 |
| `out-cert.pdf` | 3-page batch from a name list |
| `out-grid.pdf` · `out-music.pdf` | Vector paper generation |
| `out-labels.pdf` | 21-up A4 label sheet |
| `out-wm.pdf` | Watermark over intact original text |
| `out-numbered.pdf` | Page numbers over intact original text |
| `out-clean.pdf` | Metadata stripped — PyMuPDF confirms no fields survive |
| `out-winansi.pdf` | Smart quotes, dashes, euro — exact round trip |
| `out-pipeline.pdf` | merge → delete → watermark → number, stacked overlays intact |

---

## Two things worth checking yourself

1. **Open the sample output in Acrobat**, not just a browser. Browser PDF
   viewers are forgiving; Acrobat is the strict one, and it is what your users
   will often have.

2. **The two pdf.js tools need a real browser** to verify. The suites cover
   everything up to the rendering call, but rasterising a page cannot be
   tested in Node.
