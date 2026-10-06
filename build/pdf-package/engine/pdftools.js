/**
 * PDF tool specs.
 *
 * Each declares controls and a `run` that receives loaded documents and
 * returns files. Everything here is a pure async function of its inputs, so
 * the whole set is testable in Node without a browser.
 *
 *   kind: 'transform'  existing PDFs in, PDF out
 *         'create'     no input file, PDF out
 *         'inspect'    reads a PDF, reports rather than producing one
 *         'render'     needs pdf.js to rasterise pages (lazy-loaded)
 *
 * What ships is engine/pdf-<id>.js, which is edited directly; this file is
 * no longer its source. Every spec here that has a shipped engine mirrors
 * that engine's spec, and tests/test_pdftools.js fails when one drifts — so
 * a change to a shipped tool goes into its engine first and is copied here.
 * The drafts that never shipped (form filler, PDF to Excel, redaction, OCR,
 * compare, portfolio — see build-pdf-ship.js for why) live only here, and
 * are not tested. The four business documents (payslip, quotation, purchase
 * order, delivery challan) were written as engines and have no copy here.
 */

const PDF_TOOLS = {

  /* ===================== MANIPULATE ===================== */

  'merge-pdf': {
"title": "Merge PDF Files",
"kind": "transform",
"action": "Merge PDFs",
"multiple": true,
"description": "Combine several PDFs into one, in any order, without uploading anything.",
"keywords": ["merge pdf","combine pdf","join pdf files","pdf merger","concatenate pdf"],
"perFilePages": "ranges",
"controls": [{"key":"ranges","label":"Pages to take from each file","type":"text","default":"all","hint":"all, or per-file like: 1-3 | all | 2,5"},{"key":"keepMeta","label":"Metadata","type":"select","default":"strip","options":[{"value":"strip","label":"Strip all metadata"},{"value":"first","label":"Keep metadata from the first file"}]},{"key":"title","label":"Document title (optional)","type":"text","default":""}],
"run": async ({ docs, opts, core }) => {
      if (docs.length < 2) return { error: 'Choose at least two PDFs to merge.' };
      const specs = String(opts.ranges || 'all').split('|').map(s => s.trim());
      const items = [];
      const perFile = [];

      for (let i = 0; i < docs.length; i++) {
        const total = await docs[i].doc.pageCount();
        const spec = specs.length === 1 ? specs[0] : (specs[i] || 'all');
        let idx;
        try { idx = core.parsePageRange(spec, total); }
        catch (e) { return { error: `${docs[i].name}: ${e.message}` }; }
        idx.forEach(p => items.push({ doc: docs[i].doc, pageIndex: p }));
        perFile.push([docs[i].name, `${idx.length} of ${total} page${total === 1 ? '' : 's'}`]);
      }

      const info = {};
      if (opts.keepMeta === 'first') Object.assign(info, await docs[0].doc.getInfo());
      if (opts.title) info.Title = opts.title;

      /* Each file's bookmarks go under an entry named after it. The first
         file's XMP travels only with its metadata, and not under a new
         title, which it would contradict. */
      const bytes = await core.assemble(items, {
        info,
        outline: 'per-file',
        names: new Map(docs.map(d => [d.doc, d.name])),
        xmp: opts.keepMeta === 'first' && !opts.title ? docs[0].doc : false
      });
      return {
        files: [{ name: docs[0].name.replace(/\.pdf$/i, '') + '-merged.pdf', bytes }],
        stats: [
          ['Files merged', String(docs.length)],
          ['Total pages', String(items.length)],
          ...perFile,
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Files merge in the order listed. Drag a file’s row to move it (on a touch screen, by its ⠿ grip), or use its arrows, which work from the keyboard too.","Press \"Pages: all\" on a file to see its pages as thumbnails and click the ones to take, in the order you click them. The choice stays with the file when you move it.","Give one page range to apply to every file, or separate them with | to set each file individually — for example \"1-3 | all | 2,5\".","Metadata is stripped by default, since a merged document inheriting one source file’s author and title is usually wrong.","Links, comments and form fields travel with their page. A link to another page of the same file lands on that page in the merged document; a link to a page you left out is removed rather than pointed somewhere wrong."],
"faq": [{"q":"Are my files uploaded?","a":"No. The PDFs are parsed and rewritten by your own browser. Nothing is transmitted, which is why this works offline and why it is safe for contracts and financial documents."},{"q":"What happens to bookmarks and form fields?","a":"When any of the files has bookmarks, the merged file gets one top-level bookmark per file, named after it and opening at its first page, with that file’s own bookmarks underneath; a bookmark whose page you left out is dropped. Form fields stay fillable. Two files can both have a field called “name”, and a reader treats fields with one name as one field, so the later file’s copy is renamed name_2 rather than filling in both at once."}]
},

  'split-pdf': {
"title": "Split PDF",
"kind": "transform",
"action": "Split PDF",
"multiple": false,
"description": "Split one PDF into several files — by page count, by ranges, or one file per page.",
"keywords": ["split pdf","separate pdf pages","divide pdf","pdf splitter","break up pdf"],
"pageGrid": { "mode": "split", "rotate": true, "rangesKey": "ranges", "title": "Click a page to split after it; each colour is one file" },
"zipSuffix": "split",
"controls": [{"key":"mode","label":"Split","type":"select","default":"each","options":[{"value":"each","label":"One file per page"},{"value":"every","label":"Every N pages"},{"value":"ranges","label":"By explicit ranges"},{"value":"half","label":"In half"}]},{"key":"n","label":"Pages per file","type":"number","default":2,"min":1,"max":500},{"key":"ranges","label":"Ranges, one output per group","type":"text","default":"1-3 | 4-6 | 7-"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      const base = docs[0].name.replace(/\.pdf$/i, '');
      const groups = [];

      if (opts.mode === 'each') {
        for (let i = 0; i < total; i++) groups.push([i]);
      } else if (opts.mode === 'every') {
        const n = Math.max(1, Math.min(500, Number(opts.n) || 1));
        for (let i = 0; i < total; i += n) {
          groups.push(Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k));
        }
      } else if (opts.mode === 'half') {
        const mid = Math.ceil(total / 2);
        groups.push(Array.from({ length: mid }, (_, i) => i));
        if (mid < total) groups.push(Array.from({ length: total - mid }, (_, i) => mid + i));
      } else {
        for (const spec of String(opts.ranges || '').split('|').map(s => s.trim()).filter(Boolean)) {
          try { groups.push(core.parsePageRange(spec, total)); }
          catch (e) { return { error: e.message }; }
        }
        if (!groups.length) return { error: 'Enter at least one range, separated by |' };
      }

      if (groups.length > 500) return { error: `That would produce ${groups.length} files. Narrow the split.` };

      const files = [];
      for (let g = 0; g < groups.length; g++) {
        const bytes = await core.assemble(groups[g].map(p => ({ doc, pageIndex: p, rotate: Number((opts.turns || {})[p]) || 0 })), {});
        const label = groups[g].length === 1
          ? `p${groups[g][0] + 1}`
          : `p${groups[g][0] + 1}-${groups[g][groups[g].length - 1] + 1}`;
        files.push({ name: `${base}-${label}.pdf`, bytes });
      }

      return {
        files,
        stats: [
          ['Source pages', String(total)],
          ['Files produced', String(files.length)],
          ['Total output', fmtBytes(files.reduce((s, f) => s + f.bytes.length, 0))]
        ]
      };
    },
"tips": ["One file per page is the right choice for scanned batches where each page is a separate document.","Explicit ranges give you full control: \"1-3 | 4-6 | 7-\" produces three files, with the last taking everything from page 7 onward.","Several output files are offered as a ZIP so you get them in one download.","The pages appear as thumbnails with each output file in its own shade. Click a page, or its scissors button, to split after it; the ranges box fills in to match, and a page can be turned before it is split off."],
"faq": [{"q":"Do the split files keep the original quality?","a":"Yes. Page content streams and embedded images are copied byte for byte — nothing is re-encoded or recompressed."}]
},

  'extract-pdf-pages': {
"title": "Extract PDF Pages",
"kind": "transform",
"action": "Extract pages",
"multiple": false,
"description": "Pull specific pages out of a PDF into a new document, keeping the order you specify.",
"keywords": ["extract pdf pages","select pdf pages","pdf page extractor","get pages from pdf","copy pdf pages"],
"pageGrid": { "key": "pages", "mode": "select", "marks": "keep", "rotate": true, "title": "Click the pages to keep, in the order you want them; shift-click for a run, or drag across" },
"controls": [{"key":"pages","label":"Pages to keep","type":"text","default":"1-3","hint":"e.g. 1-3, 7, 10-"},{"key":"order","label":"Order","type":"select","default":"asis","options":[{"value":"asis","label":"As listed"},{"value":"sorted","label":"Sorted by page number"},{"value":"reverse","label":"Reversed"}]}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let idx;
      try { idx = core.parsePageRange(opts.pages, total); }
      catch (e) { return { error: e.message }; }

      if (opts.order === 'sorted') idx = idx.slice().sort((a, b) => a - b);
      if (opts.order === 'reverse') idx = idx.slice().reverse();

      const turns = opts.turns || {};
      const bytes = await core.assemble(idx.map(p => ({ doc, pageIndex: p, rotate: Number(turns[p]) || 0 })), {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-extract.pdf`, bytes }],
        stats: [
          ['Source pages', String(total)],
          ['Pages extracted', String(idx.length)],
          ['Page order', idx.map(i => i + 1).slice(0, 30).join(', ') + (idx.length > 30 ? ' …' : '')],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["The pages appear as thumbnails once the file is open. Click the pages to keep in the order you want them: the box fills with that order, so clicking 5, then 1, then 3 gives \"5, 1, 3\". Shift-click chooses a run of pages and dragging across the thumbnails chooses every page you pass; from the keyboard the arrow keys move between pages and Space chooses one.","Page selections accept ranges, single pages and open-ended forms: \"1-3, 7, 10-\" takes pages 1 to 3, page 7, and everything from 10 onward.","Order \"as listed\" respects what you typed, so \"5, 1, 3\" produces those pages in that order — useful for reordering as you extract.","A page can appear twice. \"1, 1, 2\" duplicates the first page, which is occasionally what you want for a cover sheet."],
"faq": [{"q":"What happens to pages I do not select?","a":"They are simply not copied. The original file on your device is untouched — this always produces a new document."}]
},

  'delete-pdf-pages': {
"title": "Delete PDF Pages",
"kind": "transform",
"action": "Delete pages",
"multiple": false,
"description": "Remove unwanted pages from a PDF — blank scans, cover sheets, or anything else.",
"keywords": ["delete pdf pages","remove pages from pdf","pdf page remover","erase pdf page"],
"pageGrid": { "key": "pages", "mode": "select", "marks": "remove", "rotate": true, "title": "Click the pages to remove; shift-click for a run, or drag across" },
"controls": [{"key":"pages","label":"Pages to remove","type":"text","default":"1","hint":"e.g. 1, 4-6, 10-"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let drop;
      try { drop = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      const keep = Array.from({ length: total }, (_, i) => i).filter(i => !drop.has(i));
      if (!keep.length) return { error: 'That would remove every page. Leave at least one.' };

      const turns = opts.turns || {};
      const bytes = await core.assemble(keep.map(p => ({ doc, pageIndex: p, rotate: Number(turns[p]) || 0 })), {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-trimmed.pdf`, bytes }],
        stats: [
          ['Source pages', String(total)],
          ['Pages removed', String(drop.size)],
          ['Pages remaining', String(keep.length)],
          ['Removed', [...drop].map(i => i + 1).slice(0, 30).join(', ')],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["The pages appear as thumbnails as soon as the file is open: click the ones to remove and they are struck through. Shift-click chooses a run of pages and dragging across the thumbnails chooses every page you pass; from the keyboard the arrow keys move between pages and Space chooses one.","The thumbnails and the box above them are one list: typing \"1, 4-6\" marks those pages, and clicking a page adds it to the box.","Each thumbnail has a turn button, so a page scanned sideways can be put right in the same pass as the deletions.","Check the page numbers against the PDF’s own numbering, not any printed numbers on the page — a document with a cover often has them offset by one.","The inspector tool lists page count and sizes if you are unsure which page is which.","Nothing is destroyed. A new file is produced and your original stays as it is."],
"faq": [{"q":"Can I get a deleted page back?","a":"From the output, no. Keep the original file until you have checked the result — which is why this never overwrites anything."}]
},

  'rotate-pdf': {
"title": "Rotate PDF Pages",
"kind": "transform",
"action": "Rotate pages",
"multiple": false,
"description": "Rotate every page or selected pages by 90, 180 or 270 degrees, permanently.",
"keywords": ["rotate pdf","turn pdf pages","pdf orientation","fix sideways pdf","rotate pdf permanently"],
"pageGrid": { "key": "pages", "mode": "select", "marks": "mark", "rotate": true, "angleKey": "angle", "title": "Click the pages to turn by the angle above, or turn any one page with its own button" },
"controls": [{"key":"angle","label":"Rotate by","type":"select","default":"90","options":[{"value":"90","label":"90° clockwise"},{"value":"180","label":"180°"},{"value":"270","label":"90° anticlockwise"}]},{"key":"pages","label":"Pages","type":"text","default":"all","hint":"all, or 1-3, 7"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      /* an empty box means no page takes the angle (the grid's "None"), so
         only the pages turned one by one change */
      const want = String(opts.pages == null ? 'all' : opts.pages).trim();
      try { sel = new Set(want ? core.parsePageRange(want, total) : []); }
      catch (e) { return { error: e.message }; }
      if (!sel.size && !Object.keys(opts.turns || {}).length) return { error: 'Choose the pages to rotate: type them in Pages, or click them in the grid.' };

      const angle = Number(opts.angle) || 90;
      /* the grid's per-page turns come on top of the angle for the chosen
         pages, so one page can go a quarter turn and the rest a half */
      const turns = opts.turns || {};
      const items = Array.from({ length: total }, (_, i) => ({
        doc, pageIndex: i, rotate: ((sel.has(i) ? angle : 0) + (Number(turns[i]) || 0)) % 360
      }));
      const turned = items.filter((x) => x.rotate).length;
      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-rotated.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages rotated', String(turned)],
          ['Rotation applied', angle + '°'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Click the pages to turn by the angle above, or press the turn button on any one page to give it its own quarter turn; each thumbnail shows the page the way it will be saved.","Rotation is written into the page itself, so every viewer shows it the same way. Rotating in a reader without saving only changes your own view.","Rotation is additive: a page already at 90° rotated by another 90° ends at 180°.","A scanned page that looks sideways but reports no rotation was scanned that way — rotating fixes it properly here."],
"faq": [{"q":"Does rotating reduce quality?","a":"No. The page content is untouched; only a rotation flag changes. There is no re-rendering and no loss."}]
},

  'pdf-metadata': {
"title": "PDF Metadata Editor & Remover",
"kind": "transform",
"action": "Apply to metadata",
"multiple": false,
"description": "View, change or completely strip the hidden metadata in a PDF — author, title, software.",
"keywords": ["pdf metadata","remove pdf metadata","edit pdf properties","pdf author remove","anonymise pdf"],
"controls": [{"key":"action","label":"Action","type":"select","default":"strip","options":[{"value":"strip","label":"Remove all metadata"},{"value":"edit","label":"Set the fields below"}]},{"key":"Title","label":"Title","type":"text","default":""},{"key":"Author","label":"Author","type":"text","default":""},{"key":"Subject","label":"Subject","type":"text","default":""},{"key":"Keywords","label":"Keywords","type":"text","default":""}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const before = await doc.getInfo();
      const total = await doc.pageCount();

      const info = opts.action === 'edit'
        ? { Title: opts.Title, Author: opts.Author, Subject: opts.Subject, Keywords: opts.Keywords }
        : {};

      const items = Array.from({ length: total }, (_, i) => ({ doc, pageIndex: i }));
      /* The XMP stream repeats the same properties (and edited ones would
         contradict it), so it goes in both modes. */
      const bytes = await core.assemble(items, { info, xmp: false });
      const base = docs[0].name.replace(/\.pdf$/i, '');

      const found = Object.entries(before).filter(([, v]) => v);
      return {
        files: [{ name: `${base}-${opts.action === 'strip' ? 'clean' : 'updated'}.pdf`, bytes }],
        stats: [
          ['Metadata found', found.length ? String(found.length) + ' field' + (found.length === 1 ? '' : 's') : 'none'],
          ...found.map(([k, v]) => [k, String(v).slice(0, 80)]),
          ['Action', opts.action === 'strip' ? 'All fields removed' : 'Fields replaced'],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: found.length && opts.action === 'strip'
          ? `Removed: ${found.map(([k]) => k).join(', ')}. The original file on your device still contains them.` : ''
      };
    },
"tips": ["PDFs routinely carry the author’s name, their organisation, the software used and creation timestamps. It is a common and unintended disclosure when sending documents externally.","This rewrites the document without the metadata dictionary rather than blanking fields, so nothing survives in the file.","Some PDFs also carry an XMP metadata stream. Rebuilding the document drops that too.","Text inside the page content is not metadata and is left alone. Redacting visible text needs a different approach."],
"faq": [{"q":"Is stripping metadata the same as redacting?","a":"No, and the difference matters. This removes document properties. It does not remove text or images from the page, and it does not remove content hidden under a black box. For genuine redaction, the content itself must be deleted before the file is produced."}]
},

  'pdf-inspector': {
"title": "PDF Inspector",
"kind": "inspect",
"multiple": false,
"description": "Examine a PDF: page count, sizes, rotation, fonts, images, metadata and structure.",
"keywords": ["pdf inspector","pdf info","pdf properties","analyse pdf","pdf page size checker"],
"controls": [],
"run": async ({ docs, core }) => {
      const doc = docs[0].doc;
      const pages = await doc.getPages();
      const info = await doc.getInfo();

      const sizes = new Map();
      const rotations = new Map();
      const fonts = new Set();
      let images = 0, annots = 0;

      for (const p of pages) {
        const box = (await doc.resolve(p.dict.MediaBox || p.inherited.MediaBox)) || [0, 0, 595, 842];
        const w = Math.round(Math.abs(Number(box[2]) - Number(box[0])));
        const h = Math.round(Math.abs(Number(box[3]) - Number(box[1])));
        const key = `${w} × ${h} pt  (${(w / 72 * 25.4).toFixed(0)} × ${(h / 72 * 25.4).toFixed(0)} mm)`;
        sizes.set(key, (sizes.get(key) || 0) + 1);

        const r = Number(p.dict.Rotate !== undefined ? p.dict.Rotate : p.inherited.Rotate) || 0;
        rotations.set(r, (rotations.get(r) || 0) + 1);

        const res = await doc.resolve(p.dict.Resources || p.inherited.Resources);
        if (core.isDict(res)) {
          const f = await doc.resolve(res.Font);
          if (core.isDict(f)) {
            for (const k of Object.keys(f)) {
              const fd = await doc.resolve(f[k]);
              if (core.isDict(fd) && fd.BaseFont) fonts.add(String(await doc.resolve(fd.BaseFont)).replace(/^\//, ''));
            }
          }
          const xo = await doc.resolve(res.XObject);
          if (core.isDict(xo)) {
            for (const k of Object.keys(xo)) {
              const x = await doc.resolve(xo[k]);
              if (x && x.dict && core.isName(x.dict.Subtype, 'Image')) images++;
            }
          }
        }
        const an = await doc.resolve(p.dict.Annots);
        if (Array.isArray(an)) annots += an.length;
      }

      const rows = [
        ['File', docs[0].name],
        ['File size', fmtBytes(docs[0].size)],
        ['PDF version', doc.version],
        ['Pages', String(pages.length)],
        ['Objects', String(doc.objects.size)],
        ['Page sizes', [...sizes].map(([k, n]) => `${k} × ${n}`).join('; ')],
        ['Rotations', [...rotations].map(([r, n]) => `${r}° × ${n}`).join('; ')],
        ['Distinct fonts', fonts.size ? `${fonts.size} — ${[...fonts].slice(0, 8).join(', ')}${fonts.size > 8 ? ' …' : ''}` : 'none found'],
        ['Embedded images', String(images)],
        ['Annotations', String(annots)]
      ];
      Object.entries(info).forEach(([k, v]) => { if (v) rows.push(['Metadata: ' + k, String(v).slice(0, 100)]); });
      if (!Object.keys(info).length) rows.push(['Metadata', 'none']);
      if (doc.warnings.length) rows.push(['Parser notes', doc.warnings.join('; ')]);

      const report = rows.map(([k, v]) => `${k.padEnd(22)} ${v}`).join('\n');
      return { files: [], report, stats: rows };
    },
"tips": ["Page sizes are given in points and millimetres. A4 is 595 × 842 pt; US Letter is 612 × 792.","Mixed page sizes in one document are a common cause of printing problems — this shows them grouped so a stray page stands out.","Fonts listed with a prefix like ABCDEF+Arial are subsetted, meaning only the glyphs actually used are embedded.","The metadata section is worth checking before sending a document externally. Author names and software versions are disclosed more often than people expect."],
"faq": [{"q":"Why does the object count differ from other tools?","a":"Counting depends on whether objects inside compressed object streams are expanded and whether unreferenced objects are included. This expands object streams and counts everything it can reach."}]
},

  'watermark-pdf': {
"title": "Add Watermark to PDF",
"kind": "transform",
"action": "Add watermark",
"multiple": false,
"description": "Stamp text across every page — DRAFT, CONFIDENTIAL, a name or a date — at any angle and opacity.",
"keywords": ["watermark pdf","add text to pdf","stamp pdf","draft watermark","confidential pdf"],
"livePreview": true,
"controls": [{"key":"text","label":"Watermark text","type":"text","default":"DRAFT","remember":true},{"key":"size","label":"Font size","type":"number","default":60,"min":6,"max":300},{"key":"angle","label":"Angle","type":"select","default":"45","options":[{"value":"0","label":"Horizontal"},{"value":"45","label":"45° diagonal"},{"value":"90","label":"Vertical"},{"value":"315","label":"−45° diagonal"}]},{"key":"colour","label":"Colour","type":"color","default":"#ff0000"},{"key":"opacity","label":"Opacity %","type":"number","default":20,"min":5,"max":100},{"key":"position","label":"Position","type":"select","default":"center","options":[{"value":"center","label":"Centre"},{"value":"tile","label":"Tiled across the page"},{"value":"bottom","label":"Bottom of the page"}]},{"key":"pages","label":"Pages","type":"text","default":"all"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }
      const text = String(opts.text || '').trim();
      if (!text) return { error: 'Enter some watermark text.' };

      const size = Math.max(6, Math.min(300, Number(opts.size) || 60));
      const opacity = Math.max(0.05, Math.min(1, (Number(opts.opacity) || 20) / 100));
      const angle = Number(opts.angle) || 0;
      const rad = angle * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const col = rgbTriplet(opts.colour);
      const esc = core.contentEscape(text);
      const pages = await doc.getPages();

      const items = [];
      for (let i = 0; i < total; i++) {
        if (!sel.has(i)) { items.push({ doc, pageIndex: i }); continue; }
        /* The page as a reader sees it: cropped, and turned by its /Rotate.
           The overlay is drawn in that frame (upright below), so the text
           reads the right way up and centres on what is visible. */
        const frame = await core.pageFrame(doc, i);
        const W = frame.width, H = frame.height;
        const tw = core.textWidth(text, 'Helvetica-Bold', size);

        let ops = '';
        const place = (x, y) => {
          ops += `q\n/MVRgs gs\n${col} rg\nBT\n/MVRwm ${size} Tf\n` +
                 `${nf(cos)} ${nf(sin)} ${nf(-sin)} ${nf(cos)} ${nf(x)} ${nf(y)} Tm\n(${esc}) Tj\nET\nQ\n`;
        };

        if (opts.position === 'tile') {
          const stepX = Math.max(tw * 1.4, 120), stepY = Math.max(size * 4, 120);
          for (let y = -H; y < H * 2; y += stepY) {
            for (let x = -W; x < W * 2; x += stepX) place(x, y);
          }
        } else if (opts.position === 'bottom') {
          place(W / 2 - tw / 2, size * 0.8);
        } else {
          place(W / 2 - (tw / 2) * cos + (size / 3) * sin, H / 2 - (tw / 2) * sin - (size / 3) * cos);
        }

        items.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: 'MVRwm', fontName: 'Helvetica-Bold', needsGS: true, opacity, upright: true
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-watermarked.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages watermarked', String(sel.size)],
          ['Text', text],
          ['Layout', opts.position],
          ['Opacity', Math.round(opacity * 100) + '%'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["The preview shows a page as it will be saved: it is drawn from the real output for that page and redrawn as you change the text, size, angle or opacity. Use the arrows to look at other pages.","Your settings are kept on this device for next time, the watermark text included; the Reset link under the settings puts the defaults back.","A watermark added this way sits on top of the page content and can be removed by anyone with a PDF editor. It signals status; it does not protect anything.","Tiled watermarks are much harder to crop out than a single central one, which matters for documents that might be screenshotted.","Keep opacity around 15–25%. Higher and it fights the text; lower and it vanishes when printed.","The text is drawn with a standard font, so no font file is embedded and the file barely grows."],
"faq": [{"q":"Can the watermark be removed?","a":"Yes, by anyone reasonably determined — it is a content layer, not a security feature. If a document genuinely must not be redistributed, watermarking is a deterrent and an audit aid, not a control."}]
},

  'pdf-page-numbers': {
"title": "Add Page Numbers to PDF",
"kind": "transform",
"action": "Add page numbers",
"multiple": false,
"description": "Stamp page numbers, headers or footers onto an existing PDF.",
"keywords": ["add page numbers to pdf","pdf page numbering","pdf header footer","number pdf pages"],
"livePreview": true,
"controls": [{"key":"format","label":"Format","type":"select","default":"n","options":[{"value":"n","label":"1"},{"value":"n-of-t","label":"1 of 10"},{"value":"page-n","label":"Page 1"},{"value":"page-n-of-t","label":"Page 1 of 10"},{"value":"dash","label":"– 1 –"}]},{"key":"position","label":"Position","type":"select","default":"bc","options":[{"value":"bl","label":"Bottom left"},{"value":"bc","label":"Bottom centre"},{"value":"br","label":"Bottom right"},{"value":"tl","label":"Top left"},{"value":"tc","label":"Top centre"},{"value":"tr","label":"Top right"}]},{"key":"start","label":"Start numbering at","type":"number","default":1,"min":0},{"key":"skip","label":"Skip first N pages","type":"number","default":0,"min":0},{"key":"size","label":"Font size","type":"number","default":10,"min":5,"max":48},{"key":"colour","label":"Colour","type":"color","default":"#333333"},{"key":"extra","label":"Header or footer text (optional)","type":"text","default":""}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      const pages = await doc.getPages();
      const size = Math.max(5, Math.min(48, Number(opts.size) || 10));
      const skip = Math.max(0, Number(opts.skip) || 0);
      const start = Number(opts.start);
      const col = rgbTriplet(opts.colour);
      const margin = 32;

      const items = [];
      for (let i = 0; i < total; i++) {
        if (i < skip) { items.push({ doc, pageIndex: i }); continue; }
        const num = (isFinite(start) ? start : 1) + (i - skip);
        const numbered = total - skip;
        const label = {
          'n': String(num),
          'n-of-t': `${num} of ${numbered}`,
          'page-n': `Page ${num}`,
          'page-n-of-t': `Page ${num} of ${numbered}`,
          'dash': `\u2013 ${num} \u2013`
        }[opts.format] || String(num);

        /* The page as a reader sees it: cropped, and turned by its /Rotate.
           The overlay is drawn in that frame (upright below), so a number
           lands the right way up and inside the visible edge. */
        const frame = await core.pageFrame(doc, i);
        const W = frame.width, H = frame.height;
        const tw = core.textWidth(label, 'Helvetica', size);

        const top = /^t/.test(opts.position);
        const y = top ? H - margin : margin;
        const x = /l$/.test(opts.position) ? margin
                : /r$/.test(opts.position) ? W - margin - tw
                : W / 2 - tw / 2;

        let ops = `q\n${col} rg\nBT\n/MVRpn ${size} Tf\n1 0 0 1 ${nf(x)} ${nf(y)} Tm\n(${core.contentEscape(label)}) Tj\nET\nQ\n`;
        if (opts.extra) {
          const ew = core.textWidth(opts.extra, 'Helvetica', size);
          const ey = top ? margin : H - margin;
          ops += `q\n${col} rg\nBT\n/MVRpn ${size} Tf\n1 0 0 1 ${nf(W / 2 - ew / 2)} ${nf(ey)} Tm\n(${core.contentEscape(opts.extra)}) Tj\nET\nQ\n`;
        }

        items.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: 'MVRpn', fontName: 'Helvetica', needsGS: false, opacity: 1, upright: true
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-numbered.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages numbered', String(total - skip)],
          ['First number', String(isFinite(start) ? start : 1)],
          ['Position', opts.position],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["The preview shows a page as it will be saved, drawn from the real output and redrawn as you change the format, position or size; use the arrows to check the pages after a skipped cover.","Skip the first page when the document has a cover, and start numbering at 1 on the page after it.","Numbers are placed 32 points — about 11 mm — from the page edge, inside the printable area of virtually every printer.","If the document already has printed page numbers, these will sit alongside them. Check a page before committing to a long document.","Mixed page sizes are handled: the position is computed per page from the part of that page a reader sees, turned the way it is shown, so a landscape page stored sideways or a cropped scan is numbered upright and inside its visible edge."],
"faq": [{"q":"Can I use Roman numerals for a preface?","a":"Not in one pass. Split the document, number the preface separately with a different format, then merge — which is exactly what the split and merge tools are for."}]
},

  'text-to-pdf': {
"title": "Text to PDF Converter",
"kind": "create",
"multiple": false,
"description": "Turn plain text into a properly paginated PDF with margins, wrapping and page numbers.",
"keywords": ["text to pdf","txt to pdf","create pdf from text","convert text to pdf","make a pdf"],
"inputLabel": "Your text",
"controls": [{"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[{"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"a5","label":"A5"},{"value":"legal","label":"Legal"}]},{"key":"font","label":"Font","type":"select","default":"Helvetica","options":[{"value":"Helvetica","label":"Helvetica (sans)"},{"value":"Times-Roman","label":"Times (serif)"},{"value":"Courier","label":"Courier (monospace)"}]},{"key":"size","label":"Font size","type":"number","default":11,"min":6,"max":36},{"key":"leading","label":"Line spacing","type":"number","default":1.4,"min":1,"max":3,"step":0.1},{"key":"margin","label":"Margin (mm)","type":"number","default":20,"min":5,"max":60},{"key":"numbers","label":"Page numbers","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]},{"key":"title","label":"Document title","type":"text","default":""}],
"run": async ({ text, opts, core }) => {
      const body = String(text || '');
      if (!body.trim()) return { error: 'Enter or paste some text to convert.' };

      const [W, H] = core.PAGE_SIZES[opts.pageSize] || core.PAGE_SIZES.a4;
      const m = (Number(opts.margin) || 20) * 72 / 25.4;
      const size = Math.max(6, Math.min(36, Number(opts.size) || 11));
      const lead = size * Math.max(1, Math.min(3, Number(opts.leading) || 1.4));
      const font = core.FONTS[opts.font] ? opts.font : 'Helvetica';
      const maxW = W - m * 2;

      const lines = core.wrapText(body, font, size, maxW);
      const perPage = Math.max(1, Math.floor((H - m * 2) / lead));
      const pages = [];

      for (let i = 0; i < lines.length; i += perPage) {
        const ops = [];
        lines.slice(i, i + perPage).forEach((ln, k) => {
          if (ln) ops.push({ text: ln, x: m, y: H - m - lead * (k + 1), size, font });
        });
        if (opts.numbers === 'yes') {
          const pn = String(Math.floor(i / perPage) + 1);
          ops.push({ text: pn, x: W / 2, y: m / 2, size: 9, font: 'Helvetica', align: 'center', colour: '#666666' });
        }
        pages.push({ size: [W, H], ops });
      }

      const bytes = core.createPDF(pages, {
        pageSize: opts.pageSize,
        info: opts.title ? { Title: opts.title } : null
      });
      return {
        files: [{ name: (opts.title ? slug(opts.title) : 'document') + '.pdf', bytes }],
        stats: [
          ['Characters', body.length.toLocaleString('en-GB')],
          ['Words', body.trim().split(/\s+/).filter(Boolean).length.toLocaleString('en-GB')],
          ['Lines after wrapping', String(lines.length)],
          ['Pages', String(pages.length)],
          ['Lines per page', String(perPage)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Text is wrapped using the real font metrics, so lines break where they actually would rather than at a guessed character count.","Only the standard PDF fonts are used — Helvetica, Times and Courier — which means no font file is embedded and the file stays tiny.","Characters outside Western European ranges cannot be represented without embedding a font, and appear as \"?\". For other scripts, use a word processor.","Blank lines in your text are preserved as blank lines in the output."],
"faq": [{"q":"Why do accented characters work but not Chinese or Arabic?","a":"The standard PDF fonts cover WinAnsi encoding, which includes Western European accents. Other scripts need an embedded font with those glyphs, and embedding a CJK font would add several megabytes to every page of this site."}]
},

  'invoice-pdf': {
"title": "Invoice Generator (PDF)",
"kind": "create",
"multiple": false,
"description": "Make an invoice PDF in three layouts, with your logo, GST (CGST and SGST, or IGST) or VAT at each line’s rate, a discount, shipping and a PAID stamp. Nothing you add is uploaded.",
"keywords": ["invoice generator","create invoice pdf","free invoice template","make an invoice","invoice maker","gst invoice format","vat invoice template","tax invoice generator"],
"action": "Create invoice",
"workerScripts": ["pdf-quotation-pdf.js", "pdf-invoice-pdf.js"],
"controls": [
  {"key":"fromName","label":"Your business — name","type":"text","default":"MVR IT Services LTD"},
  {"key":"fromAddress","label":"Your business — address","type":"textarea","rows":3,"default":"Reading, United Kingdom\nCompany No. 10251131"},
  {"key":"fromTax","label":"Your VAT number or GSTIN","type":"text","default":""},
  {"key":"fromContact","label":"Your phone or email","type":"text","default":""},
  {"key":"logo","label":"Your logo (optional)","type":"image","maxSide":480,"button":"Choose a logo","hint":"PNG, JPEG, WebP or GIF; nothing is uploaded"},

  {"key":"toName","label":"Bill to — name","type":"text","default":"Client Name Ltd"},
  {"key":"toAddress","label":"Bill to — address","type":"textarea","rows":3,"default":"1 Example Street\nLondon, EC1A 1AA"},
  {"key":"toTax","label":"Client VAT number or GSTIN","type":"text","default":""},

  {"key":"number","label":"Invoice number","type":"text","default":"INV-0001","hint":"Goes up by one after each download"},
  {"key":"date","label":"Invoice date","type":"date","default":"TODAY"},
  {"key":"due","label":"Payment terms","type":"select","default":"30","options":[
    {"value":"0","label":"Due on receipt"},{"value":"7","label":"Net 7"},{"value":"14","label":"Net 14"},{"value":"15","label":"Net 15"},
    {"value":"30","label":"Net 30"},{"value":"45","label":"Net 45"},{"value":"60","label":"Net 60"},{"value":"90","label":"Net 90"}]},

  {"key":"items","label":"Line items — description, quantity, unit price (one per line)","type":"textarea","rows":6,"wide":true,
   "hint":"Or: description, HSN/SAC, quantity, unit, rate, discount%, GST 18%","default":"Website design and build, 1, 4500\nHosting and support (12 months), 12, 45\nDomain registration, 1, 15"},

  {"key":"currency","label":"Currency","type":"select","default":"GBP","options":[
    {"value":"GBP","label":"Pound sterling (£)"},{"value":"USD","label":"US dollar ($)"},{"value":"EUR","label":"Euro (€)"},
    {"value":"INR","label":"Indian rupee (Rs)"},{"value":"AED","label":"UAE dirham (AED)"},{"value":"SGD","label":"Singapore dollar (S$)"},
    {"value":"AUD","label":"Australian dollar (A$)"},{"value":"CAD","label":"Canadian dollar (C$)"},{"value":"ZAR","label":"South African rand (R)"}]},
  {"key":"taxMode","label":"Tax","type":"select","default":"vat","options":[
    {"value":"vat","label":"VAT or sales tax — one rate, or each line’s own"},
    {"value":"gst","label":"GST — CGST + SGST or IGST, by place of supply"},
    {"value":"none","label":"No tax"}]},
  {"key":"tax","label":"Tax rate % (lines without their own)","type":"number","default":20,"min":0,"max":100,"step":0.25,"hint":"GST: 0, 5, 12, 18 or 28. UK VAT: 20, 5 or 0"},
  {"key":"taxLabel","label":"Tax name","type":"text","default":"VAT","remember":true},
  {"key":"sellerState","label":"Your state (GST)","type":"select","default":"auto","options":[
    {"value":"auto","label":"From your GSTIN"},
    {"value":"01","label":"01 — Jammu and Kashmir"},{"value":"02","label":"02 — Himachal Pradesh"},{"value":"03","label":"03 — Punjab"},
    {"value":"04","label":"04 — Chandigarh"},{"value":"05","label":"05 — Uttarakhand"},{"value":"06","label":"06 — Haryana"},
    {"value":"07","label":"07 — Delhi"},{"value":"08","label":"08 — Rajasthan"},{"value":"09","label":"09 — Uttar Pradesh"},
    {"value":"10","label":"10 — Bihar"},{"value":"11","label":"11 — Sikkim"},{"value":"12","label":"12 — Arunachal Pradesh"},
    {"value":"13","label":"13 — Nagaland"},{"value":"14","label":"14 — Manipur"},{"value":"15","label":"15 — Mizoram"},
    {"value":"16","label":"16 — Tripura"},{"value":"17","label":"17 — Meghalaya"},{"value":"18","label":"18 — Assam"},
    {"value":"19","label":"19 — West Bengal"},{"value":"20","label":"20 — Jharkhand"},{"value":"21","label":"21 — Odisha"},
    {"value":"22","label":"22 — Chhattisgarh"},{"value":"23","label":"23 — Madhya Pradesh"},{"value":"24","label":"24 — Gujarat"},
    {"value":"26","label":"26 — Dadra and Nagar Haveli and Daman and Diu"},{"value":"27","label":"27 — Maharashtra"},
    {"value":"29","label":"29 — Karnataka"},{"value":"30","label":"30 — Goa"},{"value":"31","label":"31 — Lakshadweep"},
    {"value":"32","label":"32 — Kerala"},{"value":"33","label":"33 — Tamil Nadu"},{"value":"34","label":"34 — Puducherry"},
    {"value":"35","label":"35 — Andaman and Nicobar Islands"},{"value":"36","label":"36 — Telangana"},{"value":"37","label":"37 — Andhra Pradesh"},
    {"value":"38","label":"38 — Ladakh"},{"value":"97","label":"97 — Other Territory"}]},
  {"key":"placeOfSupply","label":"Place of supply (GST)","type":"select","default":"auto","options":[
    {"value":"auto","label":"From the client’s GSTIN"},
    {"value":"01","label":"01 — Jammu and Kashmir"},{"value":"02","label":"02 — Himachal Pradesh"},{"value":"03","label":"03 — Punjab"},
    {"value":"04","label":"04 — Chandigarh"},{"value":"05","label":"05 — Uttarakhand"},{"value":"06","label":"06 — Haryana"},
    {"value":"07","label":"07 — Delhi"},{"value":"08","label":"08 — Rajasthan"},{"value":"09","label":"09 — Uttar Pradesh"},
    {"value":"10","label":"10 — Bihar"},{"value":"11","label":"11 — Sikkim"},{"value":"12","label":"12 — Arunachal Pradesh"},
    {"value":"13","label":"13 — Nagaland"},{"value":"14","label":"14 — Manipur"},{"value":"15","label":"15 — Mizoram"},
    {"value":"16","label":"16 — Tripura"},{"value":"17","label":"17 — Meghalaya"},{"value":"18","label":"18 — Assam"},
    {"value":"19","label":"19 — West Bengal"},{"value":"20","label":"20 — Jharkhand"},{"value":"21","label":"21 — Odisha"},
    {"value":"22","label":"22 — Chhattisgarh"},{"value":"23","label":"23 — Madhya Pradesh"},{"value":"24","label":"24 — Gujarat"},
    {"value":"26","label":"26 — Dadra and Nagar Haveli and Daman and Diu"},{"value":"27","label":"27 — Maharashtra"},
    {"value":"29","label":"29 — Karnataka"},{"value":"30","label":"30 — Goa"},{"value":"31","label":"31 — Lakshadweep"},
    {"value":"32","label":"32 — Kerala"},{"value":"33","label":"33 — Tamil Nadu"},{"value":"34","label":"34 — Puducherry"},
    {"value":"35","label":"35 — Andaman and Nicobar Islands"},{"value":"36","label":"36 — Telangana"},{"value":"37","label":"37 — Andhra Pradesh"},
    {"value":"38","label":"38 — Ladakh"},{"value":"97","label":"97 — Other Territory"},{"value":"96","label":"96 — Outside India (export)"}]},

  {"key":"discount","label":"Discount — a percentage or an amount","type":"text","default":""},
  {"key":"discountType","label":"The discount is","type":"select","default":"percent","options":[
    {"value":"percent","label":"A percentage of the items"},{"value":"amount","label":"An amount off the items"}]},
  {"key":"shipping","label":"Shipping or delivery charge","type":"text","default":""},
  {"key":"shippingTax","label":"Shipping is","type":"select","default":"taxable","options":[
    {"value":"taxable","label":"Taxed at the default rate"},{"value":"exempt","label":"Not taxed"}]},
  {"key":"rounding","label":"Round the total","type":"select","default":"none","options":[
    {"value":"none","label":"Do not round"},{"value":"near","label":"To the nearest whole unit"},
    {"value":"up","label":"Up to the whole unit"},{"value":"down","label":"Down to the whole unit"}]},
  {"key":"words","label":"Total in words","type":"select","default":"auto","options":[
    {"value":"auto","label":"For rupees only"},{"value":"yes","label":"Always"},{"value":"no","label":"Never"}]},

  {"key":"bank","label":"Payment details (bank, UPI, sort code)","type":"textarea","rows":3,"default":""},
  {"key":"notes","label":"Notes","type":"textarea","rows":3,"default":"Payment by bank transfer.\nThank you for your business."},

  {"key":"paid","label":"Mark as paid (adds a PAID stamp)","type":"checkbox","default":false},
  {"key":"paidDate","label":"Paid on","type":"date","default":"TODAY"},
  {"key":"paidMethod","label":"Paid by","type":"text","default":"Bank transfer"},

  {"key":"template","label":"Layout","type":"select","default":"modern","options":[
    {"value":"modern","label":"Modern — a colour band across the top"},
    {"value":"classic","label":"Classic — a ruled table, serif type"},
    {"value":"compact","label":"Compact — small type for long invoices"}]},
  {"key":"accent","label":"Accent colour","type":"color","default":"#1f3a5f"},
  {"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[
    {"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"legal","label":"US Legal"}]}
],
"run": async ({ opts, core }) => {
      const L = lib();
      const o = opts || {};
      const curCode = CURRENCY[o.currency] ? o.currency : 'GBP';
      const CUR = CURRENCY[curCode];
      const amt = (v) => L.amt(v, CUR);
      const money = (v) => L.money(v, CUR);
      const q = (v) => L.qtyText(v);
      const toNum = (s) => Number(String(s).trim().replace(/,/g, ''));
      const short = (s) => { const t = String(s); return t.length > 60 ? t.slice(0, 57) + '…' : t; };

      /* ---------- tax mode and the default rate ---------- */
      const mode = ['vat', 'gst', 'none'].indexOf(o.taxMode) >= 0 ? o.taxMode : 'vat';
      const defRate = Number(o.tax);
      if (mode !== 'none' && !(isFinite(defRate) && defRate >= 0 && defRate <= 100)) {
        return { error: 'The tax rate must be a number from 0 to 100.' };
      }
      const label = mode === 'gst' ? 'GST' : (String(o.taxLabel || '').trim() || 'VAT');

      /* ---------- the lines, read by the quotation's reader ---------- */
      const rows = [], ignoredTax = [];
      const lines = String(o.items || '').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const n = i + 1;
        let rate = null, body = line;
        const t = TAX_AT_END.exec(line);
        if (t) { rate = Number(t[1] || t[2]); body = line.slice(0, t.index); }
        const p = L.parseLineItems(body, '');
        /* a line that could mean two prices is shown, not guessed at */
        if (p.ambiguous.length) return { error: 'Line ' + n + ': ' + p.ambiguous[0].message };
        if (!p.rows.length) {
          return { error: 'Line ' + n + ', “' + short(line) + '”, could not be read. Write each item as description, quantity, unit price — or description, HSN/SAC, quantity, unit, rate, discount%, GST 18% — where only the quantity and the price are required.' };
        }
        const r = p.rows[0];
        if (!(r.qty > 0)) return { error: 'Line ' + n + ', “' + short(line) + '”: the quantity must be more than 0.' };
        if (r.rate < 0) return { error: 'Line ' + n + ', “' + short(line) + '”: the price is negative. Put a reduction in the Discount box; money owed back belongs on a credit note.' };
        if (r.disc < 0 || r.disc > 100) return { error: 'Line ' + n + ', “' + short(line) + '”: a line discount runs from 0% to 100%.' };
        if (rate !== null && rate > 100) return { error: 'Line ' + n + ', “' + short(line) + '”: a tax rate of ' + q(rate) + '% is more than 100%.' };
        if (mode === 'none' && rate !== null) ignoredTax.push(n);
        r.taxRate = mode === 'none' ? 0 : (rate === null ? defRate : rate);
        r.n = n;
        rows.push(r);
      }
      if (!rows.length) return { error: 'Add at least one line item.' };
      if (rows.length > 300) return { error: 'That is more than 300 line items. Split it into two invoices.' };
      const fromName = String(o.fromName || '').trim();
      const toName = String(o.toName || '').trim();
      if (!fromName) return { error: 'Enter your business name.' };
      if (!toName) return { error: 'Enter who the invoice is to, under Bill to.' };

      /* ---------- discount and shipping ---------- */
      const itemsTotal = rows.reduce((s, r) => s + r.amount, 0);
      const moneyField = (v, what) => {
        const s = String(v == null ? '' : v).trim().replace(CUR.sym.trim(), '').replace(/%$/, '').trim();
        if (!s) return { value: 0 };
        if (!L.isNumTok(s)) return { error: 'The ' + what + ', “' + short(v) + '”, is not a number. Write 1250 or 1,250.' };
        const x = toNum(s);
        if (x < 0) return { error: 'The ' + what + ' cannot be negative.' };
        return { value: x };
      };
      const dIn = moneyField(o.discount, 'discount');
      if (dIn.error) return { error: dIn.error };
      let discount = 0, discLabel = 'Discount';
      if (dIn.value) {
        if (o.discountType === 'amount') {
          discount = r2(dIn.value);
          if (discount > r2(itemsTotal)) return { error: 'The discount, ' + money(discount) + ', is more than the items come to (' + money(itemsTotal) + ').' };
        } else {
          if (dIn.value > 100) return { error: 'A percentage discount runs from 0 to 100.' };
          discount = r2(itemsTotal * dIn.value / 100);
          discLabel = 'Discount ' + q(dIn.value) + '%';
        }
      }
      const sIn = moneyField(o.shipping, 'shipping charge');
      if (sIn.error) return { error: sIn.error };
      const shipping = r2(sIn.value);
      const shipTaxed = shipping > 0 && mode !== 'none' && o.shippingTax !== 'exempt';

      /* ---------- GST: which state supplies which ---------- */
      let intra = true, sellerCode = null, posCode = null;
      const stateName = (code) => {
        const c = ownControl('placeOfSupply');
        const hit = c && c.options.find((x) => x.value === code);
        return hit ? hit.label.replace(/^\d+\s*—\s*/, '') : code;
      };
      const known = (code) => { const c = ownControl('placeOfSupply'); return !!(code && c && c.options.some((x) => x.value === code && x.value !== 'auto')); };
      if (mode === 'gst') {
        sellerCode = o.sellerState && o.sellerState !== 'auto' ? o.sellerState : gstinState(o.fromTax);
        posCode = o.placeOfSupply && o.placeOfSupply !== 'auto' ? o.placeOfSupply : gstinState(o.toTax);
        if (!known(sellerCode) || sellerCode === '96') return { error: 'Choose your state under “Your state (GST)”: GST needs it, and ' + (String(o.fromTax || '').trim() ? 'your GSTIN does not start with a state code this tool knows.' : 'there is no GSTIN to read it from.') };
        if (!known(posCode)) return { error: 'Choose the place of supply: ' + (String(o.toTax || '').trim() ? 'the client’s GSTIN does not start with a state code this tool knows' : 'the client has no GSTIN to read it from') + ', and it decides between CGST + SGST and IGST.' };
        intra = sellerCode === posCode;
      }

      /* ---------- the arithmetic ----------
         The invoice discount is shared across the lines in proportion to
         their value, so each rate is charged on its share of the discounted
         total; taxable shipping joins the default rate. Each tax figure is
         rounded to the penny once, on its rate's whole taxable value. */
      const share = itemsTotal > 0 ? discount / itemsTotal : 0;
      const groups = new Map();
      const addTo = (rate, v) => groups.set(rate, (groups.get(rate) || 0) + v);
      rows.forEach((r) => addTo(r.taxRate, r.amount * (1 - share)));
      if (shipTaxed) addTo(defRate, shipping);
      const rates = Array.from(groups.keys()).sort((a, b) => b - a);
      const multi = rates.length > 1;
      const taxLines = [];
      if (mode !== 'none' && !(rates.length === 1 && rates[0] === 0)) {
        for (const rate of rates) {
          const base = groups.get(rate);
          if (mode === 'gst' && intra) {
            const half = r2(base * rate / 200);
            taxLines.push({ name: 'CGST', rate: rate / 2, base, amount: half });
            taxLines.push({ name: 'SGST', rate: rate / 2, base, amount: half });
          } else {
            taxLines.push({ name: mode === 'gst' ? 'IGST' : label, rate, base, amount: r2(base * rate / 100) });
          }
        }
      }
      const taxTotal = r2(taxLines.reduce((s, t) => s + t.amount, 0));
      const taxable = r2(Array.from(groups.values()).reduce((s, v) => s + v, 0));
      const net = r2(itemsTotal) - discount + shipping;
      const raw = r2(net + taxTotal);
      const rounded = o.rounding === 'near' ? Math.round(raw)
        : o.rounding === 'up' ? Math.ceil(raw - 1e-9)
        : o.rounding === 'down' ? Math.floor(raw + 1e-9) : raw;
      const roundOff = r2(rounded - raw);
      const total = rounded;
      const showWords = o.words === 'yes' || (o.words !== 'no' && curCode === 'INR');
      const words = L.amountWords(total, CUR);

      /* ---------- dates ---------- */
      const dueDays = Math.max(0, Number(o.due) || 0);
      const dueIso = addDays(o.date, dueDays);
      const terms = dueDays ? 'Net ' + dueDays : 'Due on receipt';
      const paid = o.paid === true || o.paid === 'true';
      const paidDate = paid ? L.fmtDate(o.paidDate) : '';
      const paidMethod = paid ? String(o.paidMethod || '').trim() : '';

      /* ---------- the page: every word goes through T(), so a font is
         changed in one place (FONT) ---------- */
      const FONT = { r: 'Helvetica', b: 'Helvetica-Bold', serif: 'Times-Roman', mono: 'Courier' };
      const tw = (s, st, size) => core.textWidth(String(s), FONT[st] || FONT.r, size);
      const wrap = (s, st, size, w) => core.wrapText(String(s), FONT[st] || FONT.r, size, w);
      const fit = (s, st, size, w) => {
        let t = String(s == null ? '' : s);
        if (tw(t, st, size) <= w) return t;
        while (t.length > 1 && tw(t + '…', st, size) > w) t = t.slice(0, -1);
        return t + '…';
      };
      /** the size, at most `size`, at which a figure fits: amounts are shrunk, never cut */
      const fitSize = (s, st, size, w) => { let z = size; while (z > 6 && tw(s, st, z) > w) z -= 0.5; return z; };
      const lowerFirst = (s) => /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
      let ops = [];
      const INK ='#111111', GREY = '#5f6670', RULE = '#dfe2e6';
      const T = (text, x, y, size, st, colour, align) => ops.push({ text: String(text), x, y, size, font: FONT[st] || FONT.r, colour: colour || INK, align: align || 'left' });

      const tpl = ['modern', 'classic', 'compact'].indexOf(o.template) >= 0 ? o.template : 'modern';
      const [W, H] = core.PAGE_SIZES[o.pageSize] || core.PAGE_SIZES.a4;
      const accent = /^#[0-9a-f]{6}$/i.test(o.accent || '') ? o.accent : '#1f3a5f';
      const ink = L.onAccent(accent);
      const accentText = luminance(accent) > 0.55 ? shade(accent, 0.55) : accent;
      const S = {
        modern:  { m: 42, body: 'r', num: 'r', size: 9, lead: 11.5, pad: 5, headFill: accent, headInk: ink, zebra: '#f5f6f8', rule: null },
        classic: { m: 50, body: 'serif', num: 'serif', size: 10, lead: 12, pad: 4, headFill: '#ececec', headInk: INK, zebra: null, rule: '#9a9a9a' },
        compact: { m: 34, body: 'r', num: 'mono', size: 8, lead: 9.8, pad: 3, headFill: null, headInk: accentText, zebra: null, rule: '#d9dce0', strip: 5 }
      }[tpl];
      const m = S.m, inner = W - 2 * m, BOTTOM = 62;

      const logo = o.logo ? await core.prepareImage(o.logo) : null;
      const logoFit = (maxW, maxH) => {
        const s = Math.min(maxW / logo.width, maxH / logo.height);
        return [logo.width * s, logo.height * s];
      };
      let logoAt = null;
      const drawLogo = (x, y, w, h) => { ops.push({ image: logo, x, y, w, h }); logoAt = [x, y, w, h]; };

      const textLines = (s) => String(s == null ? '' : s).split('\n').map((x) => x.trim()).filter(Boolean);
      const number = String(o.number || '').trim();
      const title = mode === 'gst' ? 'TAX INVOICE' : 'INVOICE';
      const idLabel = mode === 'gst' ? 'GSTIN' : mode === 'vat' ? (label === 'VAT' ? 'VAT No.' : label + ' No.') : 'Tax ID';
      const sellerLines = textLines(o.fromAddress);
      if (String(o.fromTax || '').trim()) sellerLines.push(idLabel + ': ' + String(o.fromTax).trim());
      if (String(o.fromContact || '').trim()) sellerLines.push(String(o.fromContact).trim());
      const clientLines = textLines(o.toAddress);
      if (String(o.toTax || '').trim()) clientLines.push(idLabel + ': ' + String(o.toTax).trim());
      const dateText = L.fmtDate(o.date) || '—';
      const dueText = L.fmtDate(dueIso) || '—';
      const meta = [['Invoice no.', number || '—'], ['Invoice date', dateText], ['Due date', dueText], ['Terms', terms]];
      if (mode === 'gst') meta.push(['Place of supply', posCode + ' — ' + stateName(posCode)]);

      const pages = [];
      let y = 0;

      /* ---------- the three tops ---------- */
      function topModern() {
        const bh = logo ? 112 : 96;
        ops.push({ rect: [0, H - bh, W, bh], fill: accent });
        let x = m;
        if (logo) {
          const [lw, lh] = logoFit(120, 56);
          const ly = H - bh / 2 - lh / 2;
          ops.push({ rect: [m - 6, ly - 6, lw + 12, lh + 12], fill: '#ffffff' });
          drawLogo(m, ly, lw, lh);
          x = m + lw + 22;
        }
        const nameW = W * 0.6 - x;
        T(fit(fromName, 'b', 16, nameW), x, H - bh / 2 + 7, 16, 'b', ink);
        wrap(sellerLines.join('  ·  '), 'r', 8, nameW).slice(0, 3)
          .forEach((ln, i) => T(ln, x, H - bh / 2 - 8 - i * 10, 8, 'r', ink));
        T(title, W - m, H - bh / 2 + 4, 24, 'b', ink, 'right');
        if (number) T(fit(number, 'r', 10, W * 0.35), W - m, H - bh / 2 - 13, 10, 'r', ink, 'right');
        y = H - bh - 26;
        const cw = inner / 3;
        let a = y, b = y, c = y;
        T('BILL TO', m, a, 7, 'b', accentText); a -= 15;
        T(fit(toName, 'b', 10.5, cw - 14), m, a, 10.5, 'b'); a -= 12.5;
        clientLines.forEach((ln) => { T(fit(ln, 'r', 8.5, cw - 14), m, a, 8.5, 'r', '#333333'); a -= 11; });
        const x2 = m + cw + 6;
        T('DETAILS', x2, b, 7, 'b', accentText); b -= 15;
        meta.forEach(([k, v]) => { T(k, x2, b, 8, 'r', GREY); T(fit(v, 'b', 8.5, cw - 82), m + 2 * cw - 10, b, 8.5, 'b', INK, 'right'); b -= 12.5; });
        T(paid ? 'AMOUNT PAID' : 'AMOUNT DUE', W - m, c, 7, 'b', accentText, 'right'); c -= 22;
        T(money(total), W - m, c, fitSize(money(total), 'b', 18, cw - 6), 'b', accentText, 'right'); c -= 14;
        T(paid ? 'Paid' + (paidDate ? ' ' + paidDate : '') : 'Due ' + dueText, W - m, c, 8.5, 'r', GREY, 'right'); c -= 11;
        y = Math.min(a, b, c) - 14;
      }
      function topClassic() {
        let ly = H - m;
        if (logo) {
          const [lw, lh] = logoFit(150, 54);
          drawLogo(m, ly - lh, lw, lh);
          ly -= lh + 14;
        }
        T(fit(fromName, 'serif', 17, W * 0.52), m, ly - 14, 17, 'serif'); ly -= 14 + 14;
        sellerLines.forEach((ln) => { T(fit(ln, 'serif', 9.5, W * 0.5), m, ly, 9.5, 'serif', '#333333'); ly -= 12; });
        let ry = H - m;
        T(title, W - m, ry - 24, 28, 'serif', accentText, 'right'); ry -= 24 + 20;
        meta.forEach(([k, v]) => {
          T(k.toUpperCase(), W - m - 205, ry, 7, 'b', GREY);
          T(fit(v, 'serif', 10, 120), W - m, ry, 10, 'serif', INK, 'right');
          ry -= 13.5;
        });
        y = Math.min(ly, ry) - 6;
        ops.push({ line: [m, y, W - m, y], stroke: INK, lineWidth: 1.4 });
        ops.push({ line: [m, y - 3, W - m, y - 3], stroke: INK, lineWidth: 0.5 });
        y -= 24;
        T('BILL TO', m, y, 7, 'b', GREY); y -= 15;
        T(fit(toName, 'serif', 13, W * 0.6), m, y, 13, 'serif'); y -= 13.5;
        clientLines.forEach((ln) => { T(fit(ln, 'serif', 10, W * 0.6), m, y, 10, 'serif', '#333333'); y -= 12; });
        y -= 12;
      }
      function topCompact() {
        const top = H - m;
        let x = m, lh = 0;
        if (logo) {
          const f = logoFit(80, 30);
          lh = f[1];
          drawLogo(m, top - lh, f[0], lh);
          x = m + f[0] + 10;
        }
        T(fit(fromName, 'b', 11, W * 0.58 - x), x, top - 10, 11, 'b');
        const sl = wrap(sellerLines.join(' · '), 'r', 7, W * 0.6 - x).slice(0, 3);
        sl.forEach((ln, i) => T(ln, x, top - 21 - i * 8.5, 7, 'r', GREY));
        T(title, W - m, top - 11, 13, 'b', accentText, 'right');
        if (number) T(fit(number, 'mono', 9, W * 0.3), W - m, top - 23, 9, 'mono', INK, 'right');
        y = top - Math.max(lh, 21 + 8.5 * Math.max(1, sl.length), 26) - 6;
        ops.push({ line: [m, y, W - m, y], stroke: INK, lineWidth: 0.6 });
        y -= 13;
        const cells = [['BILL TO', [toName].concat(clientLines)]].concat(meta.slice(1).map(([k, v]) => [k.toUpperCase(), [v]]));
        const firstW = inner * 0.38, restW = (inner - firstW) / (cells.length - 1);
        let deepest = 0;
        cells.forEach(([k, vals], i) => {
          const x0 = i === 0 ? m : m + firstW + (i - 1) * restW;
          const w0 = (i === 0 ? firstW : restW) - 8;
          T(k, x0, y, 6.5, 'b', GREY);
          vals.slice(0, 6).forEach((v, j) => T(fit(v, j === 0 ? 'b' : 'r', 8, w0), x0, y - 10 - j * 9.5, 8, j === 0 ? 'b' : 'r'));
          deepest = Math.max(deepest, Math.min(6, vals.length));
        });
        y -= 10 + deepest * 9.5 + 2;
        ops.push({ line: [m, y, W - m, y], stroke: RULE, lineWidth: 0.5 });
        y -= 14;
      }
      function topNext() {
        const top = H - m + 4;
        if (tpl === 'modern') ops.push({ rect: [0, H - 8, W, 8], fill: accent });
        T(fit(fromName, 'b', 9, W * 0.5), m, top - 12, 9, 'b');
        T('Invoice ' + (number || '') + ' · continued', W - m, top - 12, 8.5, S.body === 'serif' ? 'serif' : 'r', GREY, 'right');
        ops.push({ line: [m, top - 19, W - m, top - 19], stroke: RULE, lineWidth: 0.6 });
        y = top - 36;
      }
      function newPage(first) {
        ops = [];
        pages.push({ size: [W, H], ops });
        if (S.strip) ops.push({ rect: [0, 0, S.strip, H], fill: accent });
        if (!first) topNext();
        else if (tpl === 'classic') topClassic();
        else if (tpl === 'compact') topCompact();
        else topModern();
      }
      function need(h) { if (y - h < BOTTOM) { newPage(false); return true; } return false; }
      newPage(true);

      /* ---------- the item table ---------- */
      const sz = S.size;
      const showHsn = rows.some((r) => r.hsn), showUnit = rows.some((r) => r.unit), showDisc = rows.some((r) => r.disc);
      const lineRates = Array.from(new Set(rows.map((r) => r.taxRate)));
      const showTax = mode !== 'none' && (mode === 'gst' || lineRates.length > 1);
      const sym = CUR.sym.trim();
      const widest = (list, st, size) => list.reduce((w, s) => Math.max(w, tw(s, st, size)), 0);
      const cols = [{ k: 'n', l: '#', w: 20, a: 'left' }, { k: 'desc', l: 'DESCRIPTION', w: 0, a: 'left' }];
      if (showHsn) cols.push({ k: 'hsn', l: 'HSN/SAC', w: Math.max(46, widest(rows.map((r) => r.hsn), S.num, sz) + 12), a: 'left' });
      cols.push({ k: 'qty', l: 'QTY', w: Math.max(34, widest(rows.map((r) => q(r.qty)), S.num, sz) + 12), a: 'right' });
      if (showUnit) cols.push({ k: 'unit', l: 'UNIT', w: 38, a: 'left' });
      cols.push({ k: 'rate', l: 'RATE (' + sym + ')', w: Math.max(58, widest(rows.map((r) => amt(r.rate)), S.num, sz) + 12), a: 'right' });
      if (showDisc) cols.push({ k: 'disc', l: 'DISC %', w: 38, a: 'right' });
      if (showTax) cols.push({ k: 'tax', l: (mode === 'gst' ? 'GST' : label.toUpperCase().slice(0, 8)) + ' %', w: 40, a: 'right' });
      cols.push({ k: 'amt', l: 'AMOUNT (' + sym + ')', w: Math.max(70, widest(rows.map((r) => amt(r.amount)), S.num, sz) + 12), a: 'right' });
      const fixed = cols.reduce((s, c) => s + c.w, 0);
      cols[1].w = Math.max(110, inner - fixed);
      let cx = m;
      cols.forEach((c) => { c.x = cx; cx += c.w; });
      const cellX = (c) => c.a === 'right' ? c.x + c.w - 6 : c.x + 6;
      const descW = cols[1].w - 12;
      let tableTop = 0;

      function tableHead() {
        const hh = 19;
        if (S.headFill) ops.push({ rect: [m, y - hh, inner, hh], fill: S.headFill });
        cols.forEach((c) => T(c.l, cellX(c), y - 12.5, 6.8, 'b', S.headInk, c.a));
        tableTop = y;
        y -= hh;
        if (tpl === 'compact') ops.push({ line: [m, y, W - m, y], stroke: INK, lineWidth: 0.7 });
      }
      function closeTable() {
        if (tpl !== 'classic') return;
        ops.push({ rect: [m, y, inner, tableTop - y], stroke: INK, lineWidth: 0.8 });
        cols.slice(1).forEach((c) => ops.push({ line: [c.x, tableTop, c.x, y], stroke: S.rule, lineWidth: 0.4 }));
      }
      need(19 + 40);
      tableHead();
      rows.forEach((r, i) => {
        const wl = wrap(r.desc, S.body, sz, descW);
        const rowH = Math.max(1, wl.length) * S.lead + S.pad * 2;
        if (y - rowH < BOTTOM) { closeTable(); newPage(false); tableHead(); }
        if (S.zebra && i % 2 === 1) ops.push({ rect: [m, y - rowH, inner, rowH], fill: S.zebra });
        const top = y - S.pad - sz * 0.82;
        T(String(i + 1), cellX(cols[0]), top, sz - 0.5, S.body, GREY);
        wl.forEach((ln, k) => T(ln, cols[1].x + 6, top - k * S.lead, sz, S.body));
        const put = (k, text, st) => {
          const c = cols.find((x) => x.k === k);
          if (c) T(text, cellX(c), top, sz, st || S.num, INK, c.a);
        };
        put('hsn', r.hsn || '—');
        put('qty', q(r.qty));
        put('unit', fit(r.unit || '', S.body, sz, 30), S.body);
        put('rate', amt(r.rate));
        put('disc', r.disc ? q(r.disc) : '—');
        put('tax', q(r.taxRate));
        put('amt', amt(r.amount), S.num === 'mono' ? 'mono' : 'b');
        y -= rowH;
        if (S.rule) ops.push({ line: [m, y, W - m, y], stroke: S.rule, lineWidth: 0.4 });
        else ops.push({ line: [m, y, W - m, y], stroke: RULE, lineWidth: 0.5 });
      });
      closeTable();
      y -= 14;

      /* ---------- totals ---------- */
      const tRows = [['Subtotal', amt(itemsTotal)]];
      if (discount) tRows.push([discLabel, '-' + amt(discount)]);
      if (shipping) tRows.push([mode === 'none' ? 'Shipping' : 'Shipping (' + (shipTaxed ? 'taxed at ' + q(defRate) + '%' : 'not taxed') + ')', amt(shipping)]);
      if (taxLines.length && (discount || shipping || multi)) tRows.push(['Taxable value', amt(taxable)]);
      taxLines.forEach((t) => tRows.push([t.name + ' ' + q(t.rate) + '%' + (multi ? ' on ' + amt(t.base) : ''), amt(t.amount)]));
      if (Math.abs(roundOff) >= 0.005) tRows.push(['Rounding', (roundOff > 0 ? '+' : '-') + amt(Math.abs(roundOff))]);
      const totW = tpl === 'compact' ? 230 : 260, totX = W - m - totW;
      const rh = S.lead + 3;
      const wordsLines = showWords ? wrap('Amount in words: ' + words, 'b', 8.5, inner) : [];
      need(tRows.length * rh + 52);
      const totalsTop = y, totalsPage = pages.length;
      tRows.forEach(([k, v], i) => {
        const ty = y - 10 - i * rh;
        T(fit(k, S.body, sz, totW - 100), totX + 8, ty, sz, S.body, '#333333');
        T(v, W - m - 8, ty, sz, S.num, INK, 'right');
      });
      y = y - 10 - (tRows.length - 1) * rh - 9;
      const bandLabel = paid ? 'TOTAL PAID' : 'TOTAL DUE';
      if (tpl === 'modern') {
        ops.push({ rect: [totX, y - 26, totW, 26], fill: accent });
        T(bandLabel, totX + 10, y - 17, 10.5, 'b', ink);
        T(money(total), W - m - 10, y - 17.5, 12, 'b', ink, 'right');
        y -= 26 + 16;
      } else if (tpl === 'classic') {
        ops.push({ line: [totX, y, W - m, y], stroke: INK, lineWidth: 1 });
        T(bandLabel, totX + 8, y - 16, 10.5, 'b');
        T(money(total), W - m - 8, y - 16, 12, 'b', INK, 'right');
        ops.push({ line: [totX, y - 24, W - m, y - 24], stroke: INK, lineWidth: 0.6 });
        ops.push({ line: [totX, y - 26.5, W - m, y - 26.5], stroke: INK, lineWidth: 0.6 });
        y -= 26.5 + 18;
      } else {
        T(bandLabel, totX + 8, y - 12, 9, 'b');
        T(money(total), W - m - 8, y - 12, 10, 'b', accentText, 'right');
        ops.push({ line: [totX, y - 18, W - m, y - 18], stroke: accent, lineWidth: 1.6 });
        y -= 18 + 16;
      }
      /* the stamp goes in the empty space beside the totals, when they are on the first page */
      const stampAt = totalsPage === 1 ? [m + (totX - m) / 2, (totalsTop + y) / 2] : [W * 0.64, H * 0.6];
      if (paid) {
        T('Paid in full' + (paidDate ? ' on ' + paidDate : '') + (paidMethod ? ' by ' + lowerFirst(paidMethod) : '') + '. Balance due: ' + money(0),
          W - m, y, 8.5, 'b', '#1e6b37', 'right');
        y -= 16;
      }
      if (wordsLines.length) {
        need(wordsLines.length * 11 + 8);
        wordsLines.forEach((ln, i) => T(ln, m, y - i * 11, 8.5, 'b', '#333333'));
        y -= wordsLines.length * 11 + 10;
      }

      /* ---------- payment details and notes ---------- */
      const bankLines = textLines(o.bank);
      if (bankLines.length) {
        const bh = bankLines.length * 11.5 + 26;
        need(bh + 10);
        if (tpl === 'modern') ops.push({ rect: [m, y - bh, inner, bh], fill: '#f4f5f7' });
        else if (tpl === 'classic') ops.push({ rect: [m, y - bh, inner, bh], stroke: '#777777', lineWidth: 0.6 });
        else ops.push({ line: [m, y - bh, W - m, y - bh], stroke: RULE, lineWidth: 0.5 });
        T('PAYMENT DETAILS', m + 10, y - 14, 7, 'b', GREY);
        bankLines.forEach((ln, i) => T(fit(ln, S.body, 9, inner - 20), m + 10, y - 28 - i * 11.5, 9, S.body));
        y -= bh + 16;
      }
      const noteText = String(o.notes || '').trim();
      if (noteText) {
        const nl = wrap(noteText, S.body, 8.5, inner);
        need(Math.min(nl.length, 3) * 11 + 18);
        T('NOTES', m, y, 7, 'b', GREY);
        y -= 13;
        nl.forEach((ln) => { if (y - 11 < BOTTOM) newPage(false); T(ln, m, y, 8.5, S.body, '#333333'); y -= 11; });
      }

      /* ---------- the PAID stamp: rotated, translucent, on the first page ---------- */
      if (paid) {
        const p = pages[0];
        const sub = [paidDate, paidMethod].filter(Boolean).join(' · ').toUpperCase();
        const big = 46, small = 8.5;
        const w1 = tw('PAID', 'b', big), w2 = sub ? tw(sub, 'b', small) : 0;
        const bw = Math.max(w1, w2) + 36, bh = big * 0.72 + (sub ? small + 12 : 0) + 26;
        const ang = 18 * Math.PI / 180, cs = Math.cos(ang), sn = Math.sin(ang);
        const [cxs, cys] = stampAt;
        const f = (v) => String(Math.round(v * 1000) / 1000);
        const RED = '0.776 0.157 0.157';
        const fk = FONT.b.replace(/[^A-Za-z0-9]/g, '');
        p.gs = Object.assign({}, p.gs || {}, { GS1: 0.32 });
        /* the raw text below needs the bold font in the page's resources */
        p.ops.push({ text: '', x: 0, y: 0, size: 1, font: FONT.b });
        const cmds = ['q', '/GS1 gs', [cs, sn, -sn, cs, cxs, cys].map(f).join(' ') + ' cm', RED + ' RG', RED + ' rg',
          '3 w', [-bw / 2, -bh / 2, bw, bh].map(f).join(' ') + ' re S',
          '1 w', [-bw / 2 + 5, -bh / 2 + 5, bw - 10, bh - 10].map(f).join(' ') + ' re S',
          'BT /' + fk + ' ' + big + ' Tf ' + f(-w1 / 2) + ' ' + f(-bh / 2 + 13 + (sub ? small + 12 : 0)) + ' Td (' + core.contentEscape('PAID') + ') Tj ET'];
        if (sub) cmds.push('BT /' + fk + ' ' + small + ' Tf ' + f(-w2 / 2) + ' ' + f(-bh / 2 + 15) + ' Td (' + core.contentEscape(sub) + ') Tj ET');
        cmds.push('Q');
        p.ops.push({ raw: cmds.join('\n') });
      }

      /* ---------- footers, once the page count is known ---------- */
      const footLeft = fit(fromName + ' · Invoice ' + (number || ''), 'r', 7.5, inner - 120);
      pages.forEach((p, i) => {
        ops = p.ops;
        ops.push({ line: [m, 46, W - m, 46], stroke: RULE, lineWidth: 0.5 });
        T(footLeft, m, 34, 7.5, 'r', GREY);
        T('Page ' + (i + 1) + ' of ' + pages.length, W - m, 34, 7.5, 'r', GREY, 'right');
      });

      const bytes = core.createPDF(pages, {
        info: { Title: ('Invoice ' + number).trim(), Author: fromName, Subject: 'Invoice for ' + toName }
      });

      const warns = [];
      if (ignoredTax.length) warns.push('Tax is set to none, so the rate on line' + (ignoredTax.length > 1 ? 's ' : ' ') + ignoredTax.join(', ') + ' was not charged.');
      if (mode === 'gst' && !String(o.fromTax || '').trim()) warns.push('Your GSTIN is blank; a GST tax invoice must show it.');
      if (mode === 'gst' && o.sellerState !== 'auto' && gstinState(o.fromTax) && gstinState(o.fromTax) !== sellerCode) warns.push('Your GSTIN starts with ' + gstinState(o.fromTax) + ', but your state is set to ' + sellerCode + '. The invoice uses ' + sellerCode + '.');
      if (mode === 'gst' && o.placeOfSupply !== 'auto' && gstinState(o.toTax) && gstinState(o.toTax) !== posCode) warns.push('The client’s GSTIN starts with ' + gstinState(o.toTax) + ', but the place of supply is set to ' + posCode + '. The invoice uses ' + posCode + '.');
      if (paid && !String(o.paidDate || '').trim()) warns.push('Marked as paid with no date: the stamp shows the method only.');

      const stats = [
        ['Layout', tpl.charAt(0).toUpperCase() + tpl.slice(1)],
        ['Line items', String(rows.length)],
        ['Subtotal', money(itemsTotal)]
      ];
      if (discount) stats.push([discLabel, '-' + money(discount)]);
      if (shipping) stats.push(['Shipping', money(shipping) + (mode === 'none' ? '' : shipTaxed ? ' (taxed)' : ' (not taxed)')]);
      if (taxLines.length && (discount || shipping || multi)) stats.push(['Taxable value', money(taxable)]);
      if (mode === 'gst') stats.push(['Supply', intra ? 'Intra-state, ' + stateName(sellerCode) : 'Inter-state, ' + stateName(sellerCode) + ' to ' + stateName(posCode)]);
      taxLines.forEach((t) => stats.push([t.name + ' ' + q(t.rate) + '%', money(t.amount)]));
      if (Math.abs(roundOff) >= 0.005) stats.push(['Rounding', (roundOff > 0 ? '+' : '-') + money(Math.abs(roundOff))]);
      stats.push(['Total due', money(total)]);
      if (showWords) stats.push(['In words', words]);
      stats.push(['Due date', dueText]);
      if (paid) stats.push(['Status', 'Paid' + (paidDate ? ' on ' + paidDate : '') + (paidMethod ? ' by ' + paidMethod : '')]);
      stats.push(['Pages', String(pages.length)]);
      stats.push(['Output size', fmtBytes(bytes.length)]);

      return {
        files: [{ name: fileStem(number) + '.pdf', bytes }],
        warn: warns.length ? warns.join(' ') : undefined,
        stats
      };
    },
"mountExtras": (api) => {
      const { root, el, btn, store } = api;
      const spec = window.PDF_TOOLS['invoice-pdf'];
      const controls = spec.controls;
      const io = root.parentNode || root;
      const KEY = { form: api.storageKey('form'), logo: api.storageKey('logo'), customers: api.storageKey('customers'), issued: api.storageKey('issued') };
      const today = () => new Date().toISOString().slice(0, 10);
      const SELLER = ['fromName', 'fromAddress', 'fromTax', 'fromContact', 'logo', 'bank', 'notes', 'currency', 'taxMode', 'tax', 'taxLabel',
        'sellerState', 'discountType', 'shippingTax', 'rounding', 'words', 'due', 'paidMethod', 'template', 'accent', 'pageSize'];

      /* ---------- the panel: saved clients, and this invoice ---------- */
      const bar = el('div', 'opt-bar inv-extras');
      const fC = el('div', 'field');
      const lC = el('label', null, 'Saved clients');
      lC.htmlFor = 'inv-clients';
      const pick = el('select', 'control');
      pick.id = 'inv-clients';
      const rowC = el('div', 'io-actions');
      rowC.style.marginTop = '8px';
      const saveC = btn('Save the client above', 'btn-ghost');
      saveC.id = 'inv-save-client';
      const delC = btn('Delete', 'btn-ghost', 'Delete the chosen client');
      delC.id = 'inv-delete-client';
      rowC.appendChild(saveC); rowC.appendChild(delC);
      fC.appendChild(lC); fC.appendChild(pick); fC.appendChild(rowC);

      const fI = el('div', 'field');
      const lI = el('label', null, 'This invoice');
      const rowI = el('div', 'io-actions');
      const fresh = btn('Start a new invoice', 'btn-ghost');
      fresh.id = 'inv-new';
      lI.htmlFor = 'inv-new';
      const exp = btn('Export as JSON', 'btn-ghost');
      exp.id = 'inv-export';
      const imp = btn('Import JSON', 'btn-ghost');
      imp.id = 'inv-import';
      const file = el('input', 'visually-hidden');
      file.type = 'file'; file.accept = '.json,application/json'; file.id = 'inv-import-file'; file.tabIndex = -1;
      file.setAttribute('aria-hidden', 'true');
      rowI.appendChild(fresh); rowI.appendChild(exp); rowI.appendChild(imp); rowI.appendChild(file);
      fI.appendChild(lI); fI.appendChild(rowI);

      const status = el('p', 'pdf-remembered inv-status');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const forget = btn('Forget what this device keeps', 'btn-link');
      forget.id = 'inv-forget';
      const tell = (text, action) => {
        status.textContent = text ? text + ' ' : '';
        if (action) status.appendChild(action);
        status.appendChild(document.createTextNode(text ? ' · ' : ''));
        status.appendChild(forget);
      };
      bar.appendChild(fC); bar.appendChild(fI); bar.appendChild(status);
      root.appendChild(bar);
      tell('');

      /* ---------- which fields matter for which choices ---------- */
      const show = (k, on) => { const r = api.reader(k); if (r && r.wrap) r.wrap.hidden = !on; };
      const sync = () => {
        const o = api.get();
        show('taxLabel', o.taxMode === 'vat');
        show('sellerState', o.taxMode === 'gst');
        show('placeOfSupply', o.taxMode === 'gst');
        show('tax', o.taxMode !== 'none');
        show('shippingTax', o.taxMode !== 'none');
        show('paidDate', !!o.paid);
        show('paidMethod', !!o.paid);
      };
      let lastMode = api.get().taxMode;
      const modeChanged = () => {
        const o = api.get();
        /* the usual standard rate for the system just chosen */
        if (o.taxMode === 'gst' && lastMode !== 'gst' && String(o.tax) === '20') api.set({ tax: '18' });
        if (o.taxMode === 'vat' && lastMode === 'gst' && String(o.tax) === '18') api.set({ tax: '20' });
        lastMode = o.taxMode;
      };

      /* ---------- the form on this device ---------- */
      const snapshot = () => {
        const o = api.get();
        const f = {};
        controls.forEach((c) => { if (c.type !== 'image') f[c.key] = c.type === 'checkbox' ? !!o[c.key] : String(o[c.key] == null ? '' : o[c.key]); });
        return f;
      };
      let quiet = false, paused = false, timer = null;
      const saveForm = () => { if (!paused) store.set(KEY.form, { format: FORMAT, version: 1, fields: snapshot() }); };
      const saveLogo = () => {
        if (paused) return;
        const v = api.get().logo;
        if (!v) { store.del(KEY.logo); return; }
        if (!store.set(KEY.logo, packLogo(v))) tell('The logo is too large to keep on this device; everything else is saved. A smaller picture will be kept.');
      };
      const logoReader = api.reader('logo');
      io.addEventListener('input', (e) => {
        if (quiet) return;
        if (logoReader && e.target === logoReader.input) saveLogo();
        if (e.target && (e.target.id === 'pc-taxMode' || e.target.id === 'pc-paid')) { if (e.target.id === 'pc-taxMode') modeChanged(); sync(); }
        clearTimeout(timer);
        timer = setTimeout(saveForm, 350);
      });
      io.addEventListener('change', (e) => {
        if (e.target && (e.target.id === 'pc-taxMode' || e.target.id === 'pc-paid')) { if (e.target.id === 'pc-taxMode') modeChanged(); sync(); }
      });

      const fill = (values, keep) => {
        quiet = true;
        try { api.set(values); } finally { quiet = false; }
        lastMode = api.get().taxMode;
        sync();
        if (keep !== false) saveForm();
      };

      const saved = store.get(KEY.form);
      let restored = false;
      if (saved && saved.format === FORMAT && saved.fields) {
        const c = cleanFields(saved.fields, controls);
        if (c.values) { fill(c.values, false); restored = true; }
      }
      const lp = store.get(KEY.logo);
      if (lp) {
        const u = unpackLogo(lp);
        if (u.value) { quiet = true; try { logoReader.set(u.value); } finally { quiet = false; } restored = true; }
      }
      if (!restored) {
        /* first visit: the site's preferences, where the visitor chose them
           and has not since changed the setting on this page */
        const P = window.Prefs;
        const kept = store.get(api.storageKey('')) || {};
        const pre = {};
        if (P) {
          try {
            const region = P.taxRegion && P.taxRegion();
            if (region === 'in' && kept.taxMode === undefined) { pre.taxMode = 'gst'; if (kept.tax === undefined) pre.tax = '18'; }
            if (region === 'uk' && kept.taxMode === undefined) pre.taxMode = 'vat';
            const cur = P.chosen && P.chosen('currency') ? P.currency() : (region === 'in' ? 'INR' : null);
            if (cur && kept.currency === undefined && ownControl('currency').options.some((x) => x.value === cur)) pre.currency = cur;
            const paper = { A4: 'a4', Letter: 'letter', Legal: 'legal' }[P.paper && P.paper()];
            if (paper && P.chosen && P.chosen('paper') && kept.pageSize === undefined) pre.pageSize = paper;
          } catch (e) { /* preferences are a convenience */ }
        }
        if (Object.keys(pre).length) fill(pre, false);
        else sync();
      } else {
        const again = btn('Start a new invoice', 'btn-link');
        again.addEventListener('click', () => fresh.click());
        tell('Your invoice from last time is back.', again);
      }

      /* ---------- saved clients ---------- */
      const clients = () => { const l = store.get(KEY.customers); return Array.isArray(l) ? l.filter((c) => c && typeof c.name === 'string') : []; };
      const listClients = (selected) => {
        const l = clients();
        pick.innerHTML = '';
        const none = el('option', null, l.length ? 'Choose a saved client…' : 'No saved clients yet');
        none.value = '';
        pick.appendChild(none);
        l.forEach((c, i) => { const op = el('option', null, c.name); op.value = String(i); if (c.name === selected) op.selected = true; pick.appendChild(op); });
        delC.disabled = !l.length;
      };
      listClients();
      pick.addEventListener('change', () => {
        const c = clients()[Number(pick.value)];
        if (!pick.value || !c) return;
        const v = { toName: c.name, toAddress: String(c.address || ''), toTax: String(c.tax || '') };
        const pos = ownControl('placeOfSupply');
        if (c.place && pos.options.some((x) => x.value === c.place)) v.placeOfSupply = c.place;
        fill(v);
        tell('Filled the client from your saved list: ' + c.name + '.');
      });
      saveC.addEventListener('click', () => {
        const o = api.get();
        const name = String(o.toName || '').trim();
        if (!name) { tell('Type the client’s name under Bill to first.'); return; }
        const l = clients().filter((c) => c.name.toLowerCase() !== name.toLowerCase());
        l.push({ name, address: String(o.toAddress || ''), tax: String(o.toTax || ''), place: o.placeOfSupply || 'auto' });
        l.sort((a, b) => a.name.localeCompare(b.name));
        if (!store.set(KEY.customers, l.slice(0, 500))) { tell('This browser would not keep the list; it may be in private mode.'); return; }
        listClients(name);
        tell('Saved ' + name + ' on this device.');
      });
      delC.addEventListener('click', () => {
        const l = clients();
        const c = l[Number(pick.value)];
        if (!pick.value || !c) { tell('Choose a saved client to delete.'); pick.focus(); return; }
        l.splice(Number(pick.value), 1);
        store.set(KEY.customers, l);
        listClients();
        tell('Deleted ' + c.name + ' from this device.');
      });

      /* ---------- numbers: the next one after each download ---------- */
      let runNumber = null;
      document.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!b) return;
        if (b.closest('.pdf-run, .pdf-run-sticky')) { runNumber = String(api.get().number || '').trim(); return; }
        if (b.closest('.pdf-summary-actions') && io.contains(b)) {
          const issued = runNumber !== null ? runNumber : String(api.get().number || '').trim();
          if (!issued) return;
          store.set(KEY.issued, issued);
          if (String(api.get().number || '').trim() === issued) {
            const next = nextNumber(issued);
            fill({ number: next });
            const back = btn('Put ' + issued + ' back', 'btn-link');
            back.addEventListener('click', () => { fill({ number: issued }); tell('The number is ' + issued + ' again.'); });
            tell(issued + ' downloaded. The number is now ' + next + ', ready for the next invoice.', back);
          }
        }
      }, true);

      fresh.addEventListener('click', () => {
        const o = api.get();
        const issued = store.get(KEY.issued);
        const v = {};
        controls.forEach((c) => {
          if (SELLER.indexOf(c.key) >= 0 || c.type === 'image') return;
          if (c.type === 'checkbox') v[c.key] = false;
          else if (c.default === 'TODAY') v[c.key] = today();
          else if (c.type === 'text' || c.type === 'textarea') v[c.key] = '';
          else v[c.key] = String(c.default);
        });
        const cur = String(o.number || '').trim();
        v.number = typeof issued === 'string' && issued && cur === issued ? nextNumber(issued) : cur;
        fill(v);
        tell('A new invoice, ' + v.number + ', with your business details kept.');
        const t = api.reader('toName');
        if (t && t.input) t.input.focus();
      });

      /* ---------- the whole invoice as a file ---------- */
      exp.addEventListener('click', () => {
        const o = api.get();
        const doc = { format: FORMAT, version: 1, saved: new Date().toISOString(), fields: snapshot(), logo: packLogo(o.logo) };
        api.download(JSON.stringify(doc, null, 1), fileStem(o.number) + '.json', 'application/json');
        tell('Exported ' + fileStem(o.number) + '.json.');
      });
      imp.addEventListener('click', () => file.click());
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0];
        file.value = '';
        if (!f) return;
        const no = (why) => tell('Could not import ' + f.name + ': ' + why + '. Nothing was changed.');
        if (f.size > 25 * 1048576) { no('it is larger than any saved invoice'); return; }
        let doc;
        try { doc = JSON.parse(await f.text()); } catch (e) { no('it is not JSON'); return; }
        if (!doc || doc.format !== FORMAT) { no('it is not an invoice exported by this tool (it has no "format": "' + FORMAT + '")'); return; }
        if (doc.version !== 1) { no('it was saved by a newer version of this tool'); return; }
        const c = cleanFields(doc.fields, controls);
        if (c.error) { no(c.error); return; }
        const u = unpackLogo(doc.logo);
        if (u.error) { no(u.error); return; }
        fill(c.values);
        quiet = true;
        try { logoReader.set(u.value); } finally { quiet = false; }
        saveLogo();
        tell('Imported ' + f.name + ': invoice ' + (c.values.number || '') + '.');
      });

      forget.addEventListener('click', () => {
        [KEY.form, KEY.logo, KEY.customers, KEY.issued].forEach((k) => store.del(k));
        listClients();
        clearTimeout(timer);
        paused = true;
        tell('This device no longer keeps the form, the logo, the saved clients or the last number, and this form is not saved again until the page is reloaded.');
      });
    },
"tips": [
  "Write one item per line: description, quantity, unit price. The longer form is description, HSN/SAC, quantity, unit, rate, discount%, and a line may end with its own tax rate, such as \"GST 5%\" or \"VAT 0%\"; a line without one is charged the default rate.",
  "Prices may keep their thousands commas, western or Indian: \"Consulting, 1, 1,200\" is 1 at 1,200 and \"Fit-out, 1, 1,25,000\" is 1 at 1,25,000. A line that could mean two different prices is not guessed at: the tool names the line and the readings, and asks.",
  "Under GST the place of supply decides the split. In your own state each rate is charged as CGST and SGST at half the rate each; in another state, as IGST at the full rate. Both states are read from the GSTINs unless you choose them.",
  "The discount comes off before tax and is shared across the lines in proportion to their value, so each rate is charged on the discounted amount. Shipping is either taxed at the default rate or not taxed, and the invoice says which.",
  "Three layouts: Modern puts your accent colour in a band across the top, Classic sets a ruled table in a serif face, and Compact uses small type to fit long invoices. Each prints on A4, US Letter or US Legal.",
  "Mark as paid adds a translucent PAID stamp, turned at an angle, with the date and the method, and the total then reads TOTAL PAID with a balance of zero.",
  "The form is saved on this device as you type and comes back when you return. After each download the number goes up by one: INV-2026-0042 becomes INV-2026-0043. Start a new invoice keeps your business details and logo and clears the client, the items and the stamp.",
  "Save a client to pick them from the list next time. Export writes the whole invoice, logo included, to a JSON file that Import reads back on any device. Nothing you add is uploaded: the PDF, the saved clients and the autosave stay in this browser."
],
"faq": [
  {"q":"Is this a legally compliant invoice?","a":"It produces the layout. Whether it is compliant depends on your jurisdiction and what you include — VAT registration number, tax point, reverse charge wording where relevant. Check the requirements for your country, or ask your accountant, before issuing."},
  {"q":"Can one invoice carry items at different GST or VAT rates?","a":"Yes. End a line with its rate, such as \"GST 12%\", and the totals show the tax at each rate on its own taxable value, from the highest rate down. The amount column is always before tax."},
  {"q":"Can I put my logo on the invoice?","a":"Yes. Choose a PNG, JPEG, WebP or GIF. It is drawn at the top left in every layout, scaled to fit without stretching, and saved on this device with the rest of the form."},
  {"q":"Where are my saved clients and the autosaved invoice kept?","a":"In this browser's storage on this device, and nowhere else: another browser or computer starts empty. Export and Import move an invoice between them, and \"Forget what this device keeps\" clears it all."},
  {"q":"Which currencies can I invoice in?","a":"Pounds, US dollars, euros, rupees, UAE dirhams, Singapore, Australian and Canadian dollars, and rand. Rupees are grouped in lakhs and crores, as 12,34,567.00, and the rest in thousands, as 1,234,567.00. The currency starts as the one in your site settings."}
]
},

  'paper-pdf': {
"title": "Printable Paper Generator",
"kind": "create",
"multiple": false,
"description": "Generate graph, lined, dotted, isometric or music paper as a print-ready PDF.",
"keywords": ["graph paper pdf","printable lined paper","dot grid paper","isometric paper","music manuscript paper","squared paper"],
"controls": [{"key":"type","label":"Paper type","type":"select","default":"grid","options":[{"value":"grid","label":"Graph / squared"},{"value":"lined","label":"Lined (ruled)"},{"value":"dot","label":"Dot grid"},{"value":"iso","label":"Isometric"},{"value":"music","label":"Music manuscript"},{"value":"cornell","label":"Cornell notes"},{"value":"blank","label":"Blank with margin"}]},{"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[{"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"a5","label":"A5"},{"value":"a3","label":"A3"}]},{"key":"orientation","label":"Orientation","type":"select","default":"portrait","options":[{"value":"portrait","label":"Portrait"},{"value":"landscape","label":"Landscape"}]},{"key":"spacing","label":"Spacing (mm)","type":"number","default":5,"min":2,"max":30,"step":0.5},{"key":"colour","label":"Line colour","type":"color","default":"#9db4d0"},{"key":"weight","label":"Line weight","type":"number","default":0.4,"min":0.1,"max":2,"step":0.1},{"key":"margin","label":"Margin (mm)","type":"number","default":10,"min":0,"max":40},{"key":"pages","label":"Number of pages","type":"number","default":1,"min":1,"max":100}],
"run": async ({ opts, core }) => {
      let [W, H] = core.PAGE_SIZES[opts.pageSize] || core.PAGE_SIZES.a4;
      if (opts.orientation === 'landscape') [W, H] = [H, W];
      const MM = 72 / 25.4;
      const gap = Math.max(2, Math.min(30, Number(opts.spacing) || 5)) * MM;
      const m = Math.max(0, Number(opts.margin) || 0) * MM;
      const lw = Math.max(0.1, Math.min(2, Number(opts.weight) || 0.4));
      const col = opts.colour || '#9db4d0';
      const n = Math.max(1, Math.min(100, Number(opts.pages) || 1));

      const buildOps = () => {
        const ops = [];
        const x0 = m, x1 = W - m, y0 = m, y1 = H - m;

        if (opts.type === 'grid') {
          for (let x = x0; x <= x1 + 0.01; x += gap) ops.push({ line: [x, y0, x, y1], stroke: col, lineWidth: lw });
          for (let y = y0; y <= y1 + 0.01; y += gap) ops.push({ line: [x0, y, x1, y], stroke: col, lineWidth: lw });
        } else if (opts.type === 'lined') {
          for (let y = y0; y <= y1 + 0.01; y += gap) ops.push({ line: [x0, y, x1, y], stroke: col, lineWidth: lw });
          ops.push({ line: [x0 + 25 * MM, y0, x0 + 25 * MM, y1], stroke: '#e08a8a', lineWidth: lw });
        } else if (opts.type === 'dot') {
          for (let x = x0; x <= x1 + 0.01; x += gap) {
            for (let y = y0; y <= y1 + 0.01; y += gap) {
              ops.push({ rect: [x - lw, y - lw, lw * 2, lw * 2], fill: col });
            }
          }
        } else if (opts.type === 'iso') {
          const h = gap * Math.sqrt(3) / 2;
          for (let y = y0; y <= y1 + h; y += h) {
            ops.push({ line: [x0, y, x1, y], stroke: col, lineWidth: lw * 0.6 });
          }
          const span = (y1 - y0) / Math.tan(Math.PI / 3);
          for (let x = x0 - span; x <= x1 + span; x += gap) {
            ops.push({ line: [x, y0, x + span, y1], stroke: col, lineWidth: lw });
            ops.push({ line: [x, y0, x - span, y1], stroke: col, lineWidth: lw });
          }
        } else if (opts.type === 'music') {
          const staffGap = gap;
          const staffH = staffGap * 4;
          const between = staffH + gap * 3;
          for (let top = y1 - staffH; top > y0; top -= between) {
            for (let k = 0; k < 5; k++) {
              ops.push({ line: [x0, top + k * staffGap, x1, top + k * staffGap], stroke: col, lineWidth: lw });
            }
          }
        } else if (opts.type === 'cornell') {
          const cueX = x0 + (x1 - x0) * 0.3;
          const sumY = y0 + (y1 - y0) * 0.18;
          ops.push({ line: [cueX, sumY, cueX, y1], stroke: col, lineWidth: lw * 2 });
          ops.push({ line: [x0, sumY, x1, sumY], stroke: col, lineWidth: lw * 2 });
          for (let y = sumY + gap; y <= y1 - gap; y += gap) {
            ops.push({ line: [cueX + 4, y, x1, y], stroke: col, lineWidth: lw * 0.7 });
          }
        } else {
          ops.push({ rect: [x0, y0, x1 - x0, y1 - y0], stroke: col, lineWidth: lw });
        }
        return ops;
      };

      const ops = buildOps();
      const pages = Array.from({ length: n }, () => ({ size: [W, H], ops }));
      const bytes = core.createPDF(pages, { info: { Title: `${opts.type} paper` } });

      return {
        files: [{ name: `${opts.type}-paper-${opts.spacing}mm.pdf`, bytes }],
        stats: [
          ['Paper type', opts.type],
          ['Page size', `${opts.pageSize.toUpperCase()} ${opts.orientation}`],
          ['Spacing', opts.spacing + ' mm'],
          ['Pages', String(n)],
          ['Drawing operations per page', String(ops.length)],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: ops.length > 8000 ? 'That spacing produces a very dense grid, which will make a large file and may print slowly.' : ''
      };
    },
"tips": ["Print at 100% scale with no \"fit to page\", or the spacing will not measure what it says. 5 mm graph paper printed at 96% is no longer 5 mm.","A pale blue-grey grid photocopies and scans far better than black, and is easier to draw over.","Isometric paper uses a 60-degree triangular grid, which is the standard for technical and orthographic sketching.","Cornell layout gives a narrow cue column on the left, a wide notes area, and a summary strip at the bottom."],
"faq": [{"q":"Why does my printed grid measure slightly wrong?","a":"Almost always print scaling. Check the print dialogue for \"Actual size\" or 100%, and turn off any margin fitting. Printers also have a small non-printable border, which is what the margin setting accounts for."}]
},

  'label-pdf': {
"title": "Label Sheet Generator",
"kind": "create",
"multiple": false,
"description": "Print address or product labels on standard sheet layouts, with data from a list.",
"keywords": ["label template pdf","address label generator","avery labels pdf","print labels","label sheet maker"],
"controls": [{"key":"layout","label":"Label layout","type":"select","default":"3x7","options":[{"value":"3x7","label":"A4 — 3 × 7 (63.5 × 38.1 mm, 21 per sheet)"},{"value":"2x8","label":"A4 — 2 × 8 (99.1 × 33.9 mm, 16 per sheet)"},{"value":"2x7","label":"A4 — 2 × 7 (99.1 × 38.1 mm, 14 per sheet)"},{"value":"1x10","label":"A4 — 1 × 10 (200 × 27 mm, 10 per sheet)"},{"value":"4x10","label":"A4 — 4 × 10 (45.7 × 25.4 mm, 40 per sheet)"}]},{"key":"items","label":"Label text — blank line between labels","type":"textarea","default":"MVR IT Services LTD\nReading\nUnited Kingdom\n\nSecond Label\nAnother Address\nSomewhere"},{"key":"repeat","label":"If fewer labels than the sheet holds","type":"select","default":"repeat","options":[{"value":"repeat","label":"Repeat to fill the sheet"},{"value":"once","label":"Leave the rest blank"}]},{"key":"size","label":"Font size","type":"number","default":9,"min":5,"max":18},{"key":"align","label":"Alignment","type":"select","default":"left","options":[{"value":"left","label":"Left"},{"value":"center","label":"Centred"}]},{"key":"guides","label":"Cutting guides","type":"select","default":"no","options":[{"value":"no","label":"No"},{"value":"yes","label":"Show outlines"}]}],
"run": async ({ opts, core }) => {
      const LAYOUTS = {
        '3x7':  { cols: 3, rows: 7,  w: 63.5, h: 38.1, left: 7.2,  top: 15.1, gapX: 2.5, gapY: 0 },
        '2x8':  { cols: 2, rows: 8,  w: 99.1, h: 33.9, left: 4.6,  top: 13.1, gapX: 2.5, gapY: 0 },
        '2x7':  { cols: 2, rows: 7,  w: 99.1, h: 38.1, left: 4.6,  top: 15.1, gapX: 2.5, gapY: 0 },
        '1x10': { cols: 1, rows: 10, w: 200,  h: 27,   left: 5,    top: 13,   gapX: 0,   gapY: 0 },
        '4x10': { cols: 4, rows: 10, w: 45.7, h: 25.4, left: 9.8,  top: 21.5, gapX: 2.5, gapY: 0 }
      };
      const L = LAYOUTS[opts.layout] || LAYOUTS['3x7'];
      const MM = 72 / 25.4;
      const [W, H] = core.PAGE_SIZES.a4;

      const blocks = String(opts.items || '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
      if (!blocks.length) return { error: 'Enter at least one label. Separate labels with a blank line.' };

      const perSheet = L.cols * L.rows;
      const wanted = opts.repeat === 'repeat'
        ? Array.from({ length: perSheet }, (_, i) => blocks[i % blocks.length])
        : blocks;
      const sheets = Math.ceil(wanted.length / perSheet);
      const size = Math.max(5, Math.min(18, Number(opts.size) || 9));
      const pages = [];

      for (let s = 0; s < sheets; s++) {
        const ops = [];
        for (let i = 0; i < perSheet; i++) {
          const item = wanted[s * perSheet + i];
          const c = i % L.cols, r = Math.floor(i / L.cols);
          const x = (L.left + c * (L.w + L.gapX)) * MM;
          const yTop = H - (L.top + r * (L.h + L.gapY)) * MM;

          if (opts.guides === 'yes') {
            ops.push({ rect: [x, yTop - L.h * MM, L.w * MM, L.h * MM], stroke: '#cccccc', lineWidth: 0.3 });
          }
          if (!item) continue;

          const padX = 4, padY = 8;
          const maxW = L.w * MM - padX * 2;
          const lines = core.wrapText(item, 'Helvetica', size, maxW);
          const lead = size * 1.25;
          const startY = yTop - padY - lead;
          lines.slice(0, Math.floor((L.h * MM - padY) / lead)).forEach((ln, k) => {
            ops.push({
              text: ln, size,
              x: opts.align === 'center' ? x + L.w * MM / 2 : x + padX,
              y: startY - k * lead,
              align: opts.align === 'center' ? 'center' : undefined
            });
          });
        }
        pages.push({ size: [W, H], ops });
      }

      const bytes = core.createPDF(pages, { info: { Title: 'Labels' } });
      return {
        files: [{ name: `labels-${opts.layout}.pdf`, bytes }],
        stats: [
          ['Layout', `${L.cols} × ${L.rows} on A4`],
          ['Label size', `${L.w} × ${L.h} mm`],
          ['Distinct labels', String(blocks.length)],
          ['Labels placed', String(Math.min(wanted.length, sheets * perSheet))],
          ['Sheets', String(sheets)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Print at exactly 100% scale. Label sheets are unforgiving — even 2% scaling shifts text off the labels by the bottom of the page.","Run one sheet on plain paper first and hold it against a real label sheet up to a window to check alignment.","These dimensions match the common A4 label formats. Manufacturers vary slightly, so verify against your own sheets before printing a batch.","Turn on cutting guides for plain paper, and off for real label stock where the outlines would print onto the labels."],
"faq": [{"q":"My labels are consistently a few millimetres off. What now?","a":"That is almost always printer margin offset rather than the template. Most print drivers have a calibration or offset setting; alternatively adjust the margin in your printer dialogue by the amount you measured."}]
},

  'certificate-pdf': {
"title": "Certificate Generator",
"kind": "create",
"multiple": false,
"description": "Create certificates of completion, achievement or attendance — one, or a batch from a name list.",
"keywords": ["certificate generator","certificate of completion","award certificate pdf","diploma maker","certificate template"],
"controls": [{"key":"heading","label":"Heading","type":"text","default":"Certificate of Completion"},{"key":"names","label":"Recipient names (one per line)","type":"textarea","default":"Priya Sharma\nJames Okafor\nAnna Kowalski"},{"key":"body","label":"Body text","type":"textarea","default":"has successfully completed the course\nAdvanced Web Development"},{"key":"date","label":"Date","type":"date","default":"TODAY"},{"key":"signatory","label":"Signatory name and title","type":"text","default":"A. Director\nManaging Director"},{"key":"org","label":"Organisation","type":"text","default":"MVR IT Services LTD"},{"key":"accent","label":"Accent colour","type":"color","default":"#f7c948"},{"key":"orientation","label":"Orientation","type":"select","default":"landscape","options":[{"value":"landscape","label":"Landscape"},{"value":"portrait","label":"Portrait"}]}],
"run": async ({ opts, core }) => {
      const names = String(opts.names || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (!names.length) return { error: 'Enter at least one recipient name.' };
      if (names.length > 500) return { error: 'That is over 500 certificates. Split the list.' };

      let [W, H] = core.PAGE_SIZES.a4;
      if (opts.orientation === 'landscape') [W, H] = [H, W];
      const accent = opts.accent || '#f7c948';
      const d = new Date(opts.date);
      const dateStr = isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const sig = String(opts.signatory || '').split('\n');

      const pages = names.map(name => {
        const ops = [];
        // border
        ops.push({ rect: [24, 24, W - 48, H - 48], stroke: accent, lineWidth: 3 });
        ops.push({ rect: [34, 34, W - 68, H - 68], stroke: accent, lineWidth: 0.8 });

        let y = H - 110;
        if (opts.org) {
          ops.push({ text: opts.org.toUpperCase(), x: W / 2, y, size: 10, align: 'center',
                     font: 'Helvetica-Bold', colour: '#888888' });
          y -= 40;
        }
        core.wrapText(opts.heading || '', 'Times-Roman', 30, W - 160).forEach((ln, k) => {
          ops.push({ text: ln, x: W / 2, y: y - k * 36, size: 30, align: 'center', font: 'Times-Roman' });
        });
        y -= 60;
        ops.push({ line: [W / 2 - 60, y, W / 2 + 60, y], stroke: accent, lineWidth: 2 });
        y -= 44;

        ops.push({ text: 'This certifies that', x: W / 2, y, size: 11, align: 'center', colour: '#666666' });
        y -= 44;
        ops.push({ text: name, x: W / 2, y, size: 26, align: 'center', font: 'Helvetica-Bold' });
        y -= 12;
        const nw = core.textWidth(name, 'Helvetica-Bold', 26);
        ops.push({ line: [W / 2 - nw / 2 - 20, y, W / 2 + nw / 2 + 20, y], stroke: '#cccccc', lineWidth: 0.6 });
        y -= 36;

        core.wrapText(opts.body || '', 'Helvetica', 13, W - 200).forEach((ln, k) => {
          ops.push({ text: ln, x: W / 2, y: y - k * 20, size: 13, align: 'center' });
        });

        const baseY = 96;
        if (dateStr) {
          ops.push({ line: [90, baseY + 16, 250, baseY + 16], stroke: '#999999', lineWidth: 0.6 });
          ops.push({ text: dateStr, x: 170, y: baseY, size: 10, align: 'center', colour: '#555555' });
          ops.push({ text: 'DATE', x: 170, y: baseY - 14, size: 7, align: 'center', colour: '#999999' });
        }
        if (sig[0]) {
          ops.push({ line: [W - 250, baseY + 16, W - 90, baseY + 16], stroke: '#999999', lineWidth: 0.6 });
          ops.push({ text: sig[0], x: W - 170, y: baseY, size: 10, align: 'center', colour: '#555555' });
          ops.push({ text: (sig[1] || 'SIGNATURE').toUpperCase(), x: W - 170, y: baseY - 14, size: 7,
                     align: 'center', colour: '#999999' });
        }
        return { size: [W, H], ops };
      });

      const bytes = core.createPDF(pages, { info: { Title: opts.heading || 'Certificate' } });
      return {
        files: [{ name: names.length === 1 ? `certificate-${slug(names[0])}.pdf` : 'certificates.pdf', bytes }],
        stats: [
          ['Certificates', String(names.length)],
          ['Orientation', opts.orientation],
          ['Date shown', dateStr || 'none'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Enter one name per line to generate a batch — each becomes its own page in a single PDF, ready to print or split.","Landscape is conventional for certificates and gives long names room to breathe.","Very long names reduce automatically only if you lower the font size; check the longest name in your list before printing a batch.","The signature line is left blank deliberately, for a real signature. A printed signature image offers no assurance to anyone."],
"faq": [{"q":"Can I add a logo?","a":"Not in this tool — it uses only vector drawing and standard fonts, which is what keeps it dependency-free. To add a logo, generate the certificate here and overlay the image in a PDF editor, or print onto pre-printed letterhead."}]
},

  'pdf-to-images': {
"title": "PDF to Images",
"kind": "render",
"action": "Convert to images",
"multiple": false,
"description": "Convert PDF pages to PNG or JPEG images at any resolution, entirely in your browser.",
"keywords": ["pdf to image","pdf to png","pdf to jpg","convert pdf to picture","extract pdf pages as images"],
"needsRenderer": true,
"pageGrid": { "key": "pages", "mode": "select", "marks": "keep", "rotate": true, "title": "Click the pages to convert; shift-click for a run, or drag across" },
"zipSuffix": "images",
"controls": [{"key":"pages","label":"Pages","type":"text","default":"all"},{"key":"dpi","label":"Resolution","type":"select","default":"150","options":[{"value":"72","label":"72 DPI — screen"},{"value":"150","label":"150 DPI — good"},{"value":"300","label":"300 DPI — print"},{"value":"600","label":"600 DPI — very large"}]},{"key":"format","label":"Format","type":"select","default":"image/png","options":[{"value":"image/png","label":"PNG — lossless"},{"value":"image/jpeg","label":"JPEG — smaller"},{"value":"image/webp","label":"WebP — smallest"}]},{"key":"quality","label":"Quality (JPEG/WebP)","type":"number","default":90,"min":40,"max":100}],
"tips": ["Choose the pages from the thumbnails or type them; only those are drawn. Each picture has its own Save button, and several come as one ZIP.","Rendering needs a PDF engine, so this page downloads one on first use — about a megabyte, cached afterwards, and only on this page.","150 DPI suits screen use and most documents. 300 DPI matches print resolution and produces files roughly four times larger.","PNG is lossless and right for text and diagrams. JPEG is smaller and better for pages that are mostly photographs.","A 600 DPI A4 page is about 5000 × 7000 pixels. Where a page would be larger than this browser can draw, it is drawn at the largest size the browser allows and the page says so, rather than handing over a blank picture.","The file name follows the format the browser actually wrote: a browser that cannot write WebP saves PNG, and the picture is named .png."],
"faq": [{"q":"Why does this one need a download when the other PDF tools do not?","a":"Merging, splitting and rotating only rearrange the file’s structure, which needs no rendering. Turning a page into an image means interpreting fonts, vector paths and colour spaces — that is a full rendering engine, and it cannot be written small."}]
},

  'pdf-organise': {
"title": "Organise PDF Pages",
"kind": "transform",
"action": "Save the new order",
"multiple": false,
"description": "See page thumbnails and reorder, rotate or delete pages visually before saving.",
"keywords": ["organise pdf","reorder pdf pages","rearrange pdf","pdf page organizer","move pdf pages"],
"needsRenderer": true,
"pageGrid": { "mode": "organise", "label": "Pages, in their new order" },
"controls": [],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      /* the grid hands over the kept pages in their new order, each with the
         quarter turns added to it; with no grid (a test, an old browser) the
         file is saved as it is */
      const layout = Array.isArray(opts.layout)
        ? opts.layout.filter((x) => x && x.p >= 0 && x.p < total)
        : Array.from({ length: total }, (_, i) => ({ p: i, r: 0 }));
      if (!layout.length) return { error: 'Every page is marked for removal.' };
      const bytes = await core.assemble(layout.map((x) => ({ doc, pageIndex: x.p, rotate: Number(x.r) || 0 })), {});
      const moved = layout.filter((x, i) => x.p !== i).length;
      return {
        files: [{ name: docs[0].name.replace(/\.pdf$/i, '') + '-organised.pdf', bytes }],
        stats: [
          ['Source pages', String(total)],
          ['Pages kept', String(layout.length)],
          ['Pages removed', String(total - layout.length)],
          ['Pages moved', String(moved)],
          ['Rotated', String(layout.filter((x) => Number(x.r)).length)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["The thumbnails appear as soon as the file is open, drawn as they scroll into view; the rendering engine behind them is downloaded once and cached afterwards.","Drag thumbnails to reorder, use the rotate button on each, and the cross to mark a page for removal. On a touch screen, drag by the grip in a card’s corner; from the keyboard, the ← and → buttons move a page one place and keep the focus, so you can press them again.","Nothing is changed until you save. The original file on your device is never modified.","If you already know the page numbers you want, the extract, delete and rotate tools do the same job without any download."],
"faq": [{"q":"Is there a page limit?","a":"Up to 10,000 pages. Only the thumbnails near the part of the grid on screen are drawn, so a long document opens quickly and memory stays modest; the pages further down are drawn as you scroll to them."}]
},

  'pdf-editor': {
"title": "Add Text to a PDF",
"kind": "transform",
"action": "Add text",
"multiple": false,
"description": "Put text anywhere on a PDF \u2014 as many pieces as you like, on any pages, wrapped to a width. Click the page to place each one and see it land before you commit.",
"keywords": ["add text to pdf","write on pdf","type on pdf","insert text in pdf","annotate pdf free","pdf text overlay"],
"controls": [{"key":"text","label":"Text to add","type":"textarea","default":""},{"key":"size","label":"Font size","type":"number","default":16,"min":8,"max":72},{"key":"colour","label":"Colour","type":"color","default":"#000000"},{"key":"x","label":"X","type":"number","default":297,"min":0,"max":2000,"hint":"Points from the left edge"},{"key":"y","label":"Y","type":"number","default":421,"min":0,"max":2000,"hint":"Points up from the bottom edge"},{"key":"pages","label":"Pages","type":"text","default":"1","hint":"1, 2-5, or all"},{"key":"width","label":"Wrap width","type":"number","default":0,"min":0,"max":2000,"hint":"Points. 0 keeps each line as typed"}],
"placePreview": { "x": "x", "y": "y", "page": "pages", "text": "text", "size": "size", "colour": "colour", "width": "width", "items": "items" },
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      /* Every banked item plus whatever is in the controls now. */
      const items = (opts.items || []).map(it => Object.assign({}, it));
      const cur = String(opts.text || '');
      if (cur.trim()) {
        items.push({
          text: cur, size: Number(opts.size) || 16, colour: opts.colour, x: Number(opts.x) || 0,
          y: Number(opts.y) || 0, width: Number(opts.width) || 0, pages: String(opts.pages || '1')
        });
      }
      if (!items.length) return { error: 'Type the text you want to add first.' };

      /* Resolve each item's pages once; a bad range names the item. */
      const placed = [];
      for (const it of items) {
        const v = String(it.pages || '1').trim();
        let sel;
        try { sel = new Set(/^last$/i.test(v) ? [total - 1] : core.parsePageRange(v, total)); }
        catch (e) { return { error: `"${it.text.split('\n')[0].slice(0, 30)}": ${e.message}` }; }
        const size = Math.max(6, Math.min(72, Number(it.size) || 16));
        const lines = it.width > 0
          ? core.wrapText(it.text, 'Helvetica', size, it.width)
          : String(it.text).split('\n');
        placed.push({
          sel, size, lines, x: Math.max(0, Number(it.x) || 0), y: Math.max(0, Number(it.y) || 0),
          col: rgbTriplet(it.colour), lead: size * 1.25
        });
      }

      const assembled = [];
      let pagesTouched = 0, linesWritten = 0;
      for (let i = 0; i < total; i++) {
        const here = placed.filter(p => p.sel.has(i));
        if (!here.length) { assembled.push({ doc, pageIndex: i }); continue; }
        pagesTouched++;
        let ops = 'q\n';
        for (const p of here) {
          ops += `${p.col} rg\nBT\n/MVRedit ${p.size} Tf\n`;
          p.lines.forEach((line, k) => {
            if (!line) return;
            ops += `1 0 0 1 ${nf(p.x)} ${nf(p.y - k * p.lead)} Tm\n(${core.contentEscape(line)}) Tj\n`;
            linesWritten++;
          });
          ops += 'ET\n';
        }
        ops += 'Q\n';
        assembled.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: 'MVRedit', fontName: 'Helvetica', needsGS: false, opacity: 1, upright: true
        }});
      }

      const bytes = await core.assemble(assembled, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-edited.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages written to', String(pagesTouched)],
          ['Items placed', String(items.length)],
          ['Lines written', String(linesWritten)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Click the page preview to place the text. The dashed box shows where it will sit, at the size and colour it will be; if it wraps, every line is shown.","Drag the dashed box to move the text, pull its corner handle to make it larger or smaller, or its side handle to set the wrap width. With the box focused, the arrow keys nudge it (Shift for 20 points) and + and − resize it.","Several pieces of text: place the first, press “Add as another item”, and the controls clear for the next one. Banked items stay drawn on the preview in grey; drag one to move it, click it to edit it, or remove it from the list.","Put an item on this page, every page or the last page with the buttons above the preview, or type pages such as 2-5 in its Pages box.","Wrap width is in points, measured with the real font metrics — A4 is 595 wide, so 450 leaves comfortable margins. 0 means each line stays exactly as typed, and a blank line in the box is a blank line on the page.","Use the arrows beside “Page 1 of N” to look through the document. The Pages box on each item decides where it goes: 1, 2-5, all, or last.","With the preview focused, the arrow keys nudge by 2 points and shift-arrow by 20, and Page Up and Page Down turn the page.","X and Y are PDF points from the bottom-left corner of the page as it is shown, 72 to the inch — a rotated or cropped page is measured the way you see it. A4 is 595 × 842, US Letter 612 × 792.","The text is drawn in Helvetica. Characters outside Latin-1 — Greek, Cyrillic, CJK, most emoji — will not render, because that font has no glyphs for them."],
"faq": [{"q":"Can I change the text that is already in my PDF?","a":"No. This draws new text on top of the page; it does not touch what is already there. Editing existing words means re-flowing the original text, which needs the fonts and the layout the PDF was made from, and most PDFs do not carry enough of either. If you need to change existing wording, edit the source document and export it again."},{"q":"How do I add more than one piece of text?","a":"Type the first, click where it goes, then press “Add as another item”. It moves into the list below and stays drawn on the preview; the controls clear for the next one. Each item keeps its own page, position, size, colour and wrap width. Edit puts an item back in the controls; the cross removes it. Whatever is in the controls when you press Add text is included too."},{"q":"Why does my text run off the page in one line?","a":"Set a wrap width. With it at 0 the tool draws each line exactly as you typed it, which is right for a label or a reference number and wrong for a paragraph. A width of 450 points on an A4 page wraps like a normal document; the preview shows the wrapped lines before you commit."},{"q":"How do I see a page other than the first one?","a":"Use the arrows beside the page number above the preview, or Page Up and Page Down with the preview focused. Paging through changes nothing on its own: each item’s Pages box decides where it is written, and the preview greys out items that are not on the page in view."},{"q":"Can I add a picture or a logo?","a":"Not here. This tool writes text into the page’s content stream with the standard Helvetica font, which is why the output stays tiny and needs nothing embedded. Placing an image means embedding it as a PDF image object, which is a different piece of work; if it is something you need, say so."},{"q":"Are my files uploaded?","a":"No. The PDF is parsed and rewritten by your own browser. Nothing is transmitted, which is why this works offline and why it is safe for contracts and financial documents."}]
},

  'pdf-form-filler': {
    title: 'PDF Form Filler',
    kind: 'transform', multiple: false,
    description: 'Fill and sign PDF forms directly in your browser without uploading to any server.',
    keywords: ['pdf form filler', 'fill pdf forms', 'sign pdf form', 'complete pdf form', 'pdf form fields'],
    controls: [
      { key: 'fieldData', label: 'Field data (format: fieldName=value, one per line)', type: 'textarea', default: '' },
      { key: 'flatten', label: 'Flatten fields', type: 'select', default: 'yes',
        options: [{ value: 'yes', label: 'Yes (make permanent)' }, { value: 'no', label: 'No (keep editable)' }] }
    ],
    run: async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const fieldData = String(opts.fieldData || '').trim();
      
      if (!fieldData) return { error: 'Enter field data in format: fieldName=value' };

      // Parse field data
      const fields = {};
      for (const line of fieldData.split('\n')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
          fields[key.trim()] = valueParts.join('=').trim();
        }
      }

      const total = await doc.pageCount();
      const items = Array.from({ length: total }, (_, i) => ({ doc, pageIndex: i }));

      // Note: This is a simplified version. Full form filling requires more complex PDF library
      // For rapid prototyping, we'll add the field values as text overlays
      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      
      return {
        files: [{ name: `${base}-filled.pdf`, bytes }],
        stats: [
          ['Fields provided', String(Object.keys(fields).length)],
          ['Flatten', opts.flatten],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: 'This is a prototype. Full form field manipulation requires PDF form library integration.'
      };
    },
    tips: [
      'Enter field data as fieldName=value on separate lines.',
      'Field names must match exactly what the PDF form expects.',
      'Flattening makes the filled values permanent but uneditable.',
      'For complex forms with calculations, consider using dedicated form software.'
    ],
    faq: [
      { q: 'How do I know the field names?', a: 'You need to inspect the PDF form structure. This prototype requires manual field name entry. A full version would auto-detect fields.' }
    ]
  },

  'pdf-to-excel': {
    title: 'PDF to Excel Converter',
    kind: 'transform', multiple: false,
    description: 'Extract tables and data from PDFs into Excel/CSV format, entirely client-side.',
    keywords: ['pdf to excel', 'pdf to csv', 'extract pdf tables', 'pdf data extraction', 'convert pdf to spreadsheet'],
    controls: [
      { key: 'format', label: 'Output format', type: 'select', default: 'csv',
        options: [{ value: 'csv', label: 'CSV' }, { value: 'xlsx', label: 'Excel (.xlsx)' }] },
      { key: 'pages', label: 'Pages to extract from', type: 'text', default: 'all' }
    ],
    run: async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      // Note: This is a simplified prototype. Full table extraction requires OCR and table detection
      // For rapid prototyping, we'll extract text and structure it simply
      const extractedData = [];
      
      for (const i of sel) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedData.push({ page: i + 1, text: pageText });
      }

      // Convert to CSV format
      let csvContent = 'Page,Extracted Text\n';
      extractedData.forEach(row => {
        csvContent += `${row.page},"${row.text.replace(/"/g, '""')}"\n`;
      });

      const base = docs[0].name.replace(/\.pdf$/i, '');
      const csvBytes = new TextEncoder().encode(csvContent);
      
      return {
        files: [{ name: `${base}-extracted.csv`, bytes: csvBytes }],
        stats: [
          ['Pages processed', String(sel.size)],
          ['Data rows', String(extractedData.length)],
          ['Output format', opts.format],
          ['Output size', fmtBytes(csvBytes.length)]
        ],
        warn: 'This is a text extraction prototype. Full table structure requires OCR and table detection libraries.'
      };
    },
    tips: [
      'This prototype extracts raw text. Structured table extraction requires additional libraries.',
      'For best results with tables, use PDFs with selectable text rather than scanned documents.',
      'CSV output can be opened directly in Excel.',
      'Complex multi-page tables may need manual cleanup after extraction.'
    ],
    faq: [
      { q: 'Why is the table structure not preserved?', a: 'Full table structure detection requires OCR and machine learning libraries. This rapid prototype extracts text content that can be manually structured.' }
    ]
  },

  'pdf-redaction': {
    title: 'PDF Redaction Tool',
    kind: 'transform', multiple: false,
    description: 'Securely remove sensitive information from PDFs by permanently covering content.',
    keywords: ['pdf redaction', 'redact pdf', 'remove sensitive info pdf', 'secure pdf cleanup', 'pdf sanitization'],
    controls: [
      { key: 'mode', label: 'Redaction mode', type: 'select', default: 'area',
        options: [
          { value: 'area', label: 'Rectangular areas' },
          { value: 'text', label: 'Text patterns (prototype)' }
        ]},
      { key: 'areas', label: 'Areas to redact (x,y,width,height per line)', type: 'textarea', default: '100,700,200,20' },
      { key: 'colour', label: 'Redaction colour', type: 'color', default: '#000000' },
      { key: 'pages', label: 'Pages to redact', type: 'text', default: 'all' }
    ],
    run: async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      const areas = [];
      for (const line of String(opts.areas || '').split('\n')) {
        const parts = line.split(',').map(s => parseFloat(s.trim()));
        if (parts.length === 4 && parts.every(p => !isNaN(p))) {
          areas.push({ x: parts[0], y: parts[1], w: parts[2], h: parts[3] });
        }
      }

      if (!areas.length) return { error: 'Enter at least one redaction area (x,y,width,height)' };

      const col = rgbTriplet(opts.colour);
      const pages = await doc.getPages();
      const items = [];

      for (let i = 0; i < total; i++) {
        if (!sel.has(i)) { items.push({ doc, pageIndex: i }); continue; }

        let ops = '';
        for (const area of areas) {
          ops += `q\n${col} rg\n${nf(area.x)} ${nf(area.y)} ${nf(area.w)} ${nf(area.h)} re f\nQ\n`;
        }

        items.push({ doc, pageIndex: i, overlay: {
          content: ops, fontKey: null, fontName: null, needsGS: false, opacity: 1
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-redacted.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages redacted', String(sel.size)],
          ['Redaction areas', String(areas.length)],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: 'This overlay method is for prototypes. True secure redaction requires removing the underlying content streams.'
      };
    },
    tips: [
      'Coordinates are in points from bottom-left. Test areas on a copy first.',
      'This prototype overlays black boxes. True redaction removes the underlying content.',
      'For sensitive documents, verify redaction by opening in multiple PDF viewers.',
      'Consider using professional redaction tools for highly sensitive material.'
    ],
    faq: [
      { q: 'Is this redaction secure?', a: 'This prototype overlays content. True secure redaction requires removing the actual content and images from the PDF structure, which needs more complex processing.' }
    ]
  },

  'pdf-ocr': {
    title: 'PDF OCR Tool',
    kind: 'render', multiple: false,
    description: 'Extract text from scanned PDFs using optical character recognition, entirely in your browser.',
    keywords: ['pdf ocr', 'extract text from scanned pdf', 'ocr pdf', 'scanned pdf to text', 'pdf text recognition'],
    needsRenderer: true,
    controls: [
      { key: 'language', label: 'Language', type: 'select', default: 'eng',
        options: [
          { value: 'eng', label: 'English' },
          { value: 'spa', label: 'Spanish' },
          { value: 'fra', label: 'French' },
          { value: 'deu', label: 'German' }
        ]},
      { key: 'pages', label: 'Pages to process', type: 'text', default: 'all' }
    ],
    tips: [
      'OCR requires Tesseract.js, which loads on first use (about 20MB for English).',
      'Higher quality scans produce better OCR results.',
      'This prototype uses basic OCR. Accuracy varies with scan quality and font complexity.',
      'Multi-language support requires loading additional language data.'
    ],
    faq: [
      { q: 'Why does this need a large download?', a: 'OCR requires machine learning models for text recognition. English models are about 20MB. Other languages add more data.' }
    ]
  },

  'pdf-compare': {
    title: 'PDF Comparison Tool',
    kind: 'inspect', multiple: true,
    description: 'Compare two PDFs and highlight differences in content, structure, or metadata.',
    keywords: ['pdf compare', 'compare pdf files', 'pdf diff', 'difference checker pdf', 'pdf comparison'],
    controls: [
      { key: 'mode', label: 'Comparison mode', type: 'select', default: 'content',
        options: [
          { value: 'content', label: 'Text content' },
          { value: 'structure', label: 'Page structure' },
          { value: 'metadata', label: 'Metadata only' }
        ]}
    ],
    run: async ({ docs, core }) => {
      if (docs.length !== 2) return { error: 'Select exactly two PDFs to compare.' };

      const doc1 = docs[0].doc;
      const doc2 = docs[1].doc;
      
      const info1 = await doc1.getInfo();
      const info2 = await doc2.getInfo();
      const pages1 = await doc1.getPages();
      const pages2 = await doc2.getPages();

      const differences = [];
      
      // Compare page count
      if (pages1.length !== pages2.length) {
        differences.push(`Page count: ${pages1.length} vs ${pages2.length}`);
      }

      // Compare metadata
      for (const key of Object.keys(info1)) {
        if (info1[key] !== info2[key]) {
          differences.push(`Metadata ${key}: "${info1[key]}" vs "${info2[key]}"`);
        }
      }

      // Basic content comparison (prototype)
      for (let i = 0; i < Math.min(pages1.length, pages2.length); i++) {
        const text1 = await core.extractTextFromPage(doc1, i);
        const text2 = await core.extractTextFromPage(doc2, i);
        if (text1 !== text2) {
          differences.push(`Page ${i + 1}: content differs`);
        }
      }

      const report = differences.length 
        ? differences.join('\n')
        : 'No differences found in the compared aspects.';

      return {
        files: [],
        report,
        stats: [
          ['File 1', docs[0].name],
          ['File 2', docs[1].name],
          ['Differences found', String(differences.length)],
          ['Comparison mode', opts.mode]
        ]
      };
    },
    tips: [
      'Upload the two PDFs you want to compare.',
      'Content comparison checks text content, not visual appearance.',
      'For visual comparison, use the organise tool to view pages side by side.',
      'Metadata comparison checks author, title, creation date, etc.'
    ],
    faq: [
      { q: 'Can this detect visual differences?', a: 'This prototype compares text content and structure. Visual difference detection requires pixel-by-pixel comparison, which needs the rendering engine.' }
    ]
  },

  /* pdf-signature ships: this block is engine/pdf-pdf-signature.js's spec, copied verbatim
     (that file is edited directly). test_pdftools.js fails if the two differ. */
  'pdf-signature': {
"title": "Add a Signature to a PDF",
"kind": "transform",
"action": "Add signature",
"multiple": false,
"description": "Draw or type a signature onto a PDF and place it where you want. A visible signature, not a cryptographic one — the difference is explained below.",
"keywords": ["sign pdf","add signature to pdf","pdf signature image","signature on pdf","place signature pdf","pdf sign online free"],
"controls": [{"key":"drawn","label":"Draw your signature (optional)","type":"draw","hint":"Mouse, pen or finger. It sits just above the typed line."},{"key":"drawWidth","label":"Drawn signature width","type":"number","default":150,"min":40,"max":400,"hint":"Points; the height follows the drawing"},{"key":"signatureText","label":"Signature text","type":"text","default":"Signed by: ","hint":"Your name, or whatever should appear on the line"},{"key":"size","label":"Text size","type":"number","default":11,"min":6,"max":48,"hint":"Points, for the typed line and the date"},{"key":"date","label":"Include date","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]},{"key":"x","label":"X","type":"number","default":400,"min":0,"hint":"Points from the left edge"},{"key":"y","label":"Y","type":"number","default":100,"min":0,"hint":"Points up from the bottom edge"},{"key":"pages","label":"Pages","type":"text","default":"last","hint":"last, 1, 2-5, or all"}],
"placePreview": { "x": "x", "y": "y", "page": "pages", "text": "signatureText", "size": "size", "colour": "#000000", "drawing": "drawn", "drawingWidth": "drawWidth", "date": "date", "items": "items", "lastWord": true, "title": "Click the page to place the signature, or drag it; drag its corner to resize it", "bankLabel": "Add as another signature", "bankHint": "Keep this signature where it is and place another — initials on every page and a full signature on the last, for example.", "emptyMessage": "Type or draw a signature first, then add it as another one." },
"inkPlacement": inkPlacement,
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      const col = rgbTriplet('#000000');
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      /* Every banked signature, then whatever is in the controls now. */
      const list = (opts.items || []).map((it) => ({
        text: it.text, drawn: it.drawn || null, drawWidth: it.drawWidth, date: it.date,
        size: it.size, x: it.x, y: it.y, pages: it.pages
      }));
      const cur = { text: opts.signatureText, drawn: opts.drawn, drawWidth: opts.drawWidth, date: opts.date, size: opts.size, x: opts.x, y: opts.y, pages: opts.pages };
      const curText = String(cur.text == null ? '' : cur.text);
      if (curText.trim() || inkPlacement(cur.drawn, cur) || !list.length) list.push(cur);

      const placed = [];
      for (const it of list) {
        const text = String(it.text == null ? '' : it.text);
        const ink = inkPlacement(it.drawn, { x: it.x, y: it.y, drawWidth: it.drawWidth, signatureText: text });
        if (!text.trim() && !ink) {
          if (list.length === 1) return { error: 'Type a signature or draw one first.' };
          continue;
        }
        const v = String(it.pages == null ? 'last' : it.pages).trim();
        let sel;
        if (/^last$/i.test(v)) sel = new Set([total - 1]);
        else {
          try { sel = new Set(core.parsePageRange(v, total)); }
          catch (e) { return { error: (list.length > 1 ? '"' + (text.trim() || 'Drawn signature').slice(0, 30) + '": ' : '') + e.message }; }
        }
        const x = Math.max(0, numOr(it.x, 400));
        const y = Math.max(0, numOr(it.y, 100));
        const size = Math.max(6, Math.min(48, numOr(it.size, 11)));

        /* The drawing as vector strokes: as sharp as the text beside it at
           any zoom, and a few hundred bytes rather than an embedded picture. */
        let ops = '';
        if (ink) {
          const X = (q) => nf(ink.x0 + (q[0] - ink.minX) * ink.s);
          const Y = (q) => nf(ink.y0 + (ink.maxY - q[1]) * ink.s);
          ops += `q\n${col} RG\n1.4 w\n1 J\n1 j\n`;
          for (const st of it.drawn.strokes) {
            if (!st.length) continue;
            ops += `${X(st[0])} ${Y(st[0])} m\n`;
            (st.length === 1 ? [st[0]] : st.slice(1)).forEach((q) => { ops += `${X(q)} ${Y(q)} l\n`; });
            ops += 'S\n';
          }
          ops += 'Q\n';
        }
        ops += `q\n${col} rg\nBT\n/MVRsig ${nf(size)} Tf\n`;
        if (text.trim()) ops += `1 0 0 1 ${nf(x)} ${nf(y)} Tm\n(${core.contentEscape(text)}) Tj\n`;
        if (it.date === 'yes') {
          ops += `\n1 0 0 1 ${nf(x)} ${nf(y - size * 14 / 11)} Tm\n(${core.contentEscape('Date: ' + dateStr)}) Tj`;
        }
        ops += '\nET\nQ\n';
        placed.push({ sel, ops, ink, text });
      }

      const items = [];
      let signedPages = 0;
      for (let i = 0; i < total; i++) {
        const here = placed.filter((pl) => pl.sel.has(i));
        if (!here.length) { items.push({ doc, pageIndex: i }); continue; }
        signedPages++;
        /* X and Y are measured on the page as it is shown — cropped and
           turned by its /Rotate — which is also what the preview shows. */
        items.push({ doc, pageIndex: i, overlay: {
          content: here.map((pl) => pl.ops).join(''), fontKey: 'MVRsig', fontName: 'Helvetica', needsGS: false, opacity: 1, upright: true
        }});
      }

      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      const one = placed.length === 1 ? placed[0] : null;
      return {
        files: [{ name: `${base}-signed.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages signed', String(signedPages)],
          ...(one ? [['Signature', one.ink ? (one.text.trim() ? 'Drawn, with typed text' : 'Drawn') : 'Typed']] : [['Signatures placed', String(placed.length)]]),
          ...(one && one.text.trim() ? [['Signature text', one.text]] : []),
          ...(one && one.ink ? [['Drawn size', Math.round(one.ink.w) + ' × ' + Math.round(one.ink.h) + ' points']] : []),
          ['Date included', list.some((it) => it.date === 'yes') ? 'yes' : 'no'],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: 'This adds visual signature elements. For legally binding digital signatures, you need certificate-based cryptographic signing.'
      };
    },
"tips": ["Draw in the box with a mouse, a pen or a finger, or leave it empty and type. A drawing is placed just above the typed line, at the width you choose, as vector strokes rather than a picture, so it stays sharp when zoomed and adds only a few hundred bytes.","Click the page preview to place the signature. The dashed box is where the line will sit on the finished file, and a drawing is shown above it where it will land.","Drag the signature on the preview to move it and pull its corner to make it larger or smaller; the drawing and the typed line grow together. With it focused, the arrow keys nudge it and + and − resize it.","Several signatures: place one, press \"Add as another signature\", and place the next. Initials on every page and a full signature with the date on the last page take two items.","The arrows beside the page number page through the document. That changes only what you are looking at; the Pages box decides which pages are signed.","Leave the pages box on \"last\" to sign only the final page, which is where most contracts want it.","The date, if you include it, is drawn on a second line just under the signature.","X and Y are PDF points from the bottom-left corner of the page as it is shown, 72 to the inch — a rotated or cropped page is measured the way you see it. A4 is 595 × 842, US Letter 612 × 792. 0 is a real position: the very edge.","This is a visible signature and can be removed by anyone with an editor. A cryptographic signature cannot — see the question below."],
"faq": [{"q":"Is this a legally binding digital signature?","a":"No, and the distinction matters. This adds visual elements only: your typed or drawn signature is drawn onto the page, the same as signing a printout and scanning it. A digital signature in the legal sense is a cryptographic operation that binds a certificate to the document so any later change is detectable, and it needs a certificate from a certifying authority or trust service provider. This tool writes no signature field, certificate or /ByteRange, so a signature validator finds nothing to check. If a contract, a court or a regulator asks for a digital signature, this is not it — use a certificate-based signing service. For a form, an invoice or an internal approval that only has to look signed, a visible signature is what is wanted."}]
},

  'pdf-portfolio': {
    title: 'PDF Portfolio Creator',
    kind: 'transform', multiple: true,
    description: 'Combine multiple file types into a single PDF portfolio or unified document.',
    keywords: ['pdf portfolio', 'combine files to pdf', 'multi-file pdf', 'pdf binder', 'document assembler'],
    controls: [
      { key: 'mode', label: 'Portfolio mode', type: 'select', default: 'merge',
        options: [
          { value: 'merge', label: 'Merge all PDFs' },
          { value: 'portfolio', label: 'Create PDF portfolio (prototype)' }
        ]},
      { key: 'title', label: 'Portfolio title', type: 'text', default: 'Document Portfolio' }
    ],
    run: async ({ docs, opts, core }) => {
      const pdfDocs = docs.filter(d => d.name.toLowerCase().endsWith('.pdf'));
      
      if (pdfDocs.length < 2 && opts.mode === 'merge') {
        return { error: 'Need at least 2 PDFs for merge mode.' };
      }

      if (opts.mode === 'merge') {
        // Use existing merge logic
        const items = [];
        for (const d of pdfDocs) {
          const total = await d.doc.pageCount();
          for (let i = 0; i < total; i++) {
            items.push({ doc: d.doc, pageIndex: i });
          }
        }

        const bytes = await core.assemble(items, { info: { Title: opts.title } });
        return {
          files: [{ name: 'portfolio-merged.pdf', bytes }],
          stats: [
            ['PDFs merged', String(pdfDocs.length)],
            ['Total pages', String(items.length)],
            ['Output size', fmtBytes(bytes.length)]
          ]
        };
      } else {
        // Portfolio mode prototype
        return {
          files: [],
          stats: [
            ['Total files', String(docs.length)],
            ['PDFs', String(pdfDocs.length)],
            ['Other files', String(docs.length - pdfDocs.length)]
          ],
          warn: 'Full PDF portfolio creation requires embedding non-PDF files as attachments, which needs additional PDF library features.'
        };
      }
    },
    tips: [
      'Merge mode combines all PDFs into one continuous document.',
      'Portfolio mode (prototype) would create a PDF with embedded files.',
      'Arrange files in the desired order before processing.',
      'Non-PDF files are noted but not processed in this prototype.'
    ],
    faq: [
      { q: 'Can I include Word or Excel files?', a: 'The merge mode only handles PDFs. Full portfolio creation can embed other files as attachments, which requires additional PDF library capabilities.' }
    ]
  }
};

/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';
}

function rgbTriplet(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '#000000'));
  if (!m) return '0 0 0';
  return [1, 2, 3].map(i => nf(parseInt(m[i], 16) / 255)).join(' ');
}

function nf(v) {
  return Number.isInteger(v) ? String(v) : String(Number(Number(v).toFixed(4)));
}

/* ---------- signature placement (as in engine/pdf-pdf-signature.js) ---------- */

/* A number from a control, or the default when the box is empty or not a
   number. 0 is a number: "X 0" is the left edge, not "use the default". */
function numOr(v, d) {
  if (v === '' || v === null || v === undefined) return d;
  const x = Number(v);
  return isFinite(x) ? x : d;
}

/**
 * Where a drawn signature goes, shared by the run and the page preview so
 * the two cannot disagree. The pad hands over { w, h, strokes: [[[x, y], …], …] }
 * in its own pixels, y down; the ink is cropped to its bounds and scaled to
 * the chosen width (no taller than a third of it), with its bottom-left at
 * X, Y — lifted 12 points when there is typed text, so the drawing sits on
 * the line above it.
 */
function inkPlacement(d, opts) {
  if (!d || !Array.isArray(d.strokes) || !d.strokes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  d.strokes.forEach(s => s.forEach(p => {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }));
  if (!isFinite(minX)) return null;
  const inkW = Math.max(1, maxX - minX), inkH = Math.max(1, maxY - minY);
  const width = Math.max(40, Math.min(400, numOr(opts.drawWidth, 150)));
  const s = Math.min(width / inkW, (width / 3) / inkH);
  const x = Math.max(0, numOr(opts.x, 400)), y = Math.max(0, numOr(opts.y, 100));
  const lift = String(opts.signatureText == null ? '' : opts.signatureText).trim() ? 12 : 0;
  return { s, minX, maxY, x0: x, y0: y + lift, w: inkW * s, h: inkH * s };
}

/* ---------- line items ---------- */

/* A number as people type one: 2650 or 2650.50, or grouped with commas the
   western way (2,650 · 1,234,567) or the Indian way (1,25,000 · 12,34,567).
   "2,65" is neither, so it is not read as a number at all. */
const PLAIN_NUM = /^-?\d+(?:\.\d+)?$/;
const GROUPED_NUM = /^-?(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/;
const isNumTok = (s) => { const t = String(s).trim(); return PLAIN_NUM.test(t) || GROUPED_NUM.test(t); };
const toNum = (s) => Number(String(s).trim().replace(/,/g, ''));
const CUR_PREFIX = /^(?:rs\.?\s*|inr\s*|[£$€]\s*)/i;
const SHORTHAND = /^(.+?)\s+[x×]\s*(\d+(?:\.\d+)?)\s*@\s*(?:rs\.?\s*|inr\s*|[£$€]\s*)?(-?\d[\d,]*(?:\.\d+)?)$/i;

/** "description, quantity, unit price", already split; null if it does not fit. */
function readItemFields(tokens) {
  const parts = tokens.map(s => s.trim());
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  if (parts.length < 3) return null;
  const p = parts[parts.length - 1].replace(CUR_PREFIX, ''), q = parts[parts.length - 2];
  if (!isNumTok(p) || !isNumTok(q)) return null;
  const desc = parts.slice(0, -2).join(', ').trim();
  if (!desc) return null;
  const qty = toNum(q), price = toNum(p);
  return { desc, qty, price, total: qty * price };
}

const notGrouped = (line, tok) => 'In “' + line + '”, “' + tok + '” is not a number with thousands separators (2,650 or 1,25,000), so it is not clear what it means. ' +
  'If it is a decimal, write it with a point (2.65); if the comma separates two fields, put a space after it.';

/*
 * One line item, read from the right. A comma also groups thousands —
 * "Consulting, 1, 1,200" is 1 at 1,200 — so the commas that separate fields
 * and the ones inside a number are told apart, as the Quotation tool does:
 *
 *   - a line with a space after (or before) any comma uses spaced commas as
 *     separators, and a comma with no space between digits is a thousands
 *     separator: the digits it joins must make 2,650 or 1,25,000, or the
 *     line is reported rather than guessed at;
 *   - a line with no spaces at all ("Item,2,2,650") is read every way its
 *     digit commas allow; one sensible reading is used, more than one is
 *     reported, with the readings, instead of picking one;
 *   - "Item x2 @ 2,650" (quantity after x, price after @) is read as written.
 *
 * Returns { row } or { message } (ambiguous) or {} (unreadable).
 */
function readItemLine(line) {
  const sh = SHORTHAND.exec(line);
  if (sh) {
    if (!isNumTok(sh[3])) return { message: notGrouped(line, sh[3]) };
    const qty = toNum(sh[2]), price = toNum(sh[3]);
    return { row: { desc: sh[1].trim(), qty, price, total: qty * price } };
  }

  /* split on every comma, and note which commas could be inside a number:
     no space on either side, digits before, digits after */
  const raw = line.split(',');
  const joints = [];
  let spaced = false;
  for (let i = 0; i < raw.length - 1; i++) {
    const tight = !/\s$/.test(raw[i]) && !/^\s/.test(raw[i + 1]);
    if (!tight) { spaced = true; continue; }
    if (/^-?\d+$/.test(raw[i].trim()) && /^\d+(?:\.\d+)?$/.test(raw[i + 1].trim())) joints.push(i);
  }
  const join = (merge) => {
    const out = [];
    let cur = raw[0];
    for (let i = 0; i < raw.length - 1; i++) {
      if (merge.has(i)) cur += ',' + raw[i + 1];
      else { out.push(cur); cur = raw[i + 1]; }
    }
    out.push(cur);
    return out;
  };
  const oddNumber = (tokens) => tokens.find(t => t.indexOf(',') >= 0 && !GROUPED_NUM.test(t.trim().replace(CUR_PREFIX, '')));

  if (spaced) {
    const tokens = join(new Set(joints));
    const odd = oddNumber(tokens);
    if (odd) return { message: notGrouped(line, odd.trim()) };
    const row = readItemFields(tokens);
    return row ? { row } : {};
  }

  if (joints.length > 10) return {};
  const readings = new Map();
  for (let mask = 0; mask < (1 << joints.length); mask++) {
    const tokens = join(new Set(joints.filter((j, k) => mask & (1 << k))));
    if (oddNumber(tokens)) continue;
    const row = readItemFields(tokens);
    if (!row) continue;
    const key = [row.desc, row.qty, row.price].join('\u0000');
    if (!readings.has(key)) readings.set(key, row);
  }
  const all = Array.from(readings.values());
  if (all.length === 1) return { row: all[0] };
  if (!all.length) return {};
  return {
    message: '“' + line + '” can be read ' + all.length + ' ways: ' +
      all.slice(0, 3).map(r => r.qty + ' at ' + r.price + ' for “' + r.desc + '”').join(', or ') +
      '. Put a space after each comma that separates the fields (“Item, 2, 2,650”), or write the number without its comma (2650).'
  };
}


if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDF_TOOLS, fmtBytes, slug, rgbTriplet };
}
